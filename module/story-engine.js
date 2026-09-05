/**
 * story-engine.js - 记忆系统核心（v2.0）
 *
 * 架构（见 docs/记忆系统2.0-工程蓝图.md）：
 *   核心（常启）：每层纪要 → 编年史一行 → 滚动合并（纪事20层→卷宗100层→典章300层）
 *                 注入 = 典章/卷宗/纪事(常驻) + 编年史尾窗(常驻) + 词法命中展开(按需)
 *   向量模块（可选，calamity-memory-vec）：摘要向量化，召回与词法按楼层去重合并
 *   通道：所有 LLM 压缩调用走 memoryApi（副API，未配置跟随主API）
 *
 * 依赖：memoryStore（同步镜像读）、memoryApi、gameState（词法检索名词源）
 *       向量模块另需：embeddingService、memoryRecall（可选）
 */
var storyEngine = (function() {
    const NAME = { 1: '纪事', 2: '卷宗', 3: '典章' };
    const LIMIT = { 1: 150, 2: 400, 3: 600 };
    const CHRONICLE_TAIL = 100;     // 编年史常驻尾窗行数
    const RECALL_TOPK = 3;          // 词法命中展开楼层数
    const LINE_MAX = 40;            // 编年史行正文上限

    let _compressing = false;

    // ---------- 配置 ----------
    function ls(key, def) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }
    function lsNum(key, def) {
        const v = parseInt(ls(key)); return isNaN(v) ? def : v;
    }
    function enabled() { return ls('calamity-memory-enabled') !== '0'; }
    function vecEnabled() {
        return ls('calamity-memory-vec') === '1'
            && window.embeddingService && embeddingService.isEnabled()
            && window.memoryRecall;
    }
    function every() { return Math.max(5, lsNum('calamity-memory-every', 20)); }
    function keep1() { return Math.max(2, lsNum('calamity-memory-keep1', 5)); }
    function keep2() { return Math.max(2, lsNum('calamity-memory-keep2', 3)); }

    // ---------- 初始化 ----------
    async function init() {
        await memoryStore.init();
        // 楼层号事实源迁移：旧键 calamity-vec-floor-max → calamity-memory-floor
        if (!ls('calamity-memory-floor')) {
            const legacy = lsNum('calamity-vec-floor-max', 0);
            try { localStorage.setItem('calamity-memory-floor', String(legacy)); } catch (e) { /* ignore */ }
        }
        // 重试上次未完成的压缩（异步，不阻塞启动）
        maybeCompress(memoryStore.maxFloor(), true);
        console.log('[StoryEngine] 初始化完成，当前楼层 ' + currentFloor());
    }

    function nextFloor() {
        const n = lsNum('calamity-memory-floor', 0) + 1;
        try { localStorage.setItem('calamity-memory-floor', String(n)); } catch (e) { /* ignore */ }
        return n;
    }
    function currentFloor() { return Math.max(lsNum('calamity-memory-floor', 0), memoryStore.maxFloor()); }

    // ---------- 归档 ----------
    function fmtTime(gameTime) {
        const t = gameTime || {};
        const pad = n => (n < 10 ? '0' + n : '' + n);
        return (t.year || 300) + '年' + (t.month || 1) + '月' + (t.day || 1) + '日 '
            + pad(t.hour || 0) + ':' + pad(t.minute || 0);
    }

    async function onTurnArchived(payload) {
        if (!enabled() || !payload) return;
        const p = payload;
        const text = (p.texts || []).join('；');
        if (!text) return;
        await memoryStore.put('summary', {
            floor: p.floor, text: text, time: p.time || '', location: p.location || '',
            createdAt: Date.now()
        });
        await memoryStore.put('chronicle', {
            floor: p.floor, time: p.time || '', location: p.location || '',
            text: text.length > LINE_MAX ? text.slice(0, LINE_MAX) : text,
            createdAt: Date.now()
        });
        // 向量模块（可选）：异步向量化，失败静默（纪要文本已归档，不影响核心链路）
        if (vecEnabled()) {
            vectorizeFloor(p.floor, text).catch(e =>
                console.warn('[StoryEngine] 向量化失败（跳过）:', e && e.message || e));
        }
        // 压缩链：await 保证归档返回时常驻线状态确定（撤销与压缩不撞车）
        await maybeCompress(p.floor).catch(e =>
            console.warn('[StoryEngine] 压缩流程异常:', e && e.message || e));
    }

    async function vectorizeFloor(floor, text) {
        const fp = embeddingService.getFingerprint();
        const vecs = await embeddingService.embed([text]);
        if (!vecs || !vecs[0]) return;
        const id = 'emb_' + floor + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
        await memoryStore.put('embeddings', {
            id: id, floor: floor, text: text,
            vector: new Float32Array(vecs[0]).buffer,
            fingerprint: fp, kind: 'turn', createdAt: Date.now()
        });
        if (window.memoryRecall) {
            memoryRecall.addToCache({
                id: id, vector: new Float32Array(vecs[0]), text: text,
                week: 0, fingerprint: fp, createdAt: Date.now()
            });
        }
    }

    // ---------- 滚动合并 ----------
    function compressPrompt(level) {
        return '你是剧情记录员。将输入的按时间排列的剧情记录压缩成一段可脱离原文独立使用的'
            + LIMIT[level] + ' 字以内的' + NAME[level] + '。\n\n'
            + '要求：\n'
            + '1. 写清关键行动如何引出后果、人物为何改变目标或立场、冲突如何升级或收束，保留具体人物、地点、物品与结果。\n'
            + '2. 已经完成、取消、失败或作废的事项与建立的事项同等重要，必须写明结局，禁止只留开端不留结局。\n'
            + '3. 禁止"局势变化了""经历了一系列事件""关系加深了"等空壳概括。\n'
            + '4. 怀疑、误解、声称保持人物认知表述，不得升级为世界事实。\n'
            + '5. 只依据输入，不补写未发生的情节。时间一律用输入给出的绝对时间（如"300年11月14日"），不得使用"三天前"等相对时间。\n\n'
            + '直接输出' + NAME[level] + '正文，不要评论、标题或列表。';
    }

    function pendingLoad() { try { return JSON.parse(ls('calamity-memory-pending') || '[]'); } catch (e) { return []; } }
    function pendingSave(list) { try { localStorage.setItem('calamity-memory-pending', JSON.stringify(list)); } catch (e) { /* ignore */ } }

    async function compressStory(level, from, to, sources) {
        let inputs = [];
        if (sources && sources.length) {
            inputs = sources.map(r => r.text);
        } else {
            for (let f = from; f <= to; f++) {
                const s = memoryStore.getSummary(f);
                if (s) inputs.push('第' + f + '层(' + (s.time || '') + '·' + (s.location || '') + ')：' + s.text);
            }
            // 输入超长保护：异常缺口（如长期未配置 API 后补压）时只取最近 80 层，优先保留新近因果
            if (inputs.length > 80) inputs = inputs.slice(-80);
        }
        if (!inputs.length) return null;
        const res = await memoryApi.sendMessages([
            { role: 'system', content: compressPrompt(level) },
            { role: 'user', content: inputs.join('\n') }
        ], { temperature: 0.3, stream: false, maxOutputTokens: 2000 });
        const text = res && res.content ? String(res.content).trim() : '';
        if (!text) throw new Error('压缩返回为空');
        const id = 'st_l' + level + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
        await memoryStore.put('story', {
            id: id, level: level, from: from, to: to,
            text: '【第' + from + '~' + to + '层·' + NAME[level] + '】' + text,
            absorbedBy: null, createdAt: Date.now()
        });
        if (sources && sources.length) {
            for (const r of sources) {
                await memoryStore.put('story', Object.assign({}, r, { absorbedBy: id }));
            }
        }
        console.log('[StoryEngine] ' + NAME[level] + '压缩完成：第' + from + '~' + to + '层 → ' + id);
        return id;
    }

    function unabsorbed(level) {
        return memoryStore.allStory()
            .filter(r => r.level === level && !r.absorbedBy)
            .sort((a, b) => a.from - b.from);
    }

    async function doCompressTask(task) {
        if (task.level > 1) {
            const sources = memoryStore.allStory()
                .filter(r => r.level === task.level - 1 && !r.absorbedBy)
                .sort((a, b) => a.from - b.from).slice(0, task.batch);
            if (sources.length < task.batch) return;   // 源不足（可能已被回滚），放弃
            await compressStory(task.level, sources[0].from, sources[sources.length - 1].to, sources);
        } else {
            await compressStory(1, task.from, task.to, null);
        }
    }

    async function maybeCompress(currentFloor, isRetry) {
        if (_compressing) return;
        if (!enabled()) return;
        if (!isRetry && window._gameBusy) return;
        if (!window.memoryApi || !window.apiService) return;
        const cfg = memoryApi.getConfig();
        if (!cfg || !cfg.apiKey) return;
        _compressing = true;
        try {
            // 1. 重试上次失败任务
            let pending = pendingLoad();
            for (const task of pending.slice()) {
                try { await doCompressTask(task); pending = pending.filter(t => t !== task); pendingSave(pending); }
                catch (e) { console.warn('[StoryEngine] 压缩重试失败（下轮再试）:', e && e.message || e); break; }
            }
            // 2. 覆盖度驱动：未覆盖楼层 ≥ every 时补压一篇纪事（API 曾不可用导致的缺口也会在后续回合补上）
            const ev = every();
            const covered = memoryStore.allStory().reduce((m, r) => Math.max(m, r.to || 0), 0);
            if (currentFloor - covered >= ev) {
                const from = covered + 1;
                if (!unabsorbed(1).some(r => r.from === from)) {
                    try { await compressStory(1, from, currentFloor, null); }
                    catch (e) {
                        console.warn('[StoryEngine] 纪事压缩失败（已入重试队列）:', e && e.message || e);
                        pending.push({ level: 1, from: from, to: currentFloor, batch: 0 });
                        pendingSave(pending);
                    }
                }
            }
            // 3. 未吸收纪事超限 → 最旧 keep1 篇合并成卷宗（循环直到不超限）
            while (unabsorbed(1).length > keep1()) {
                const b = unabsorbed(1).slice(0, keep1());
                try { await compressStory(2, b[0].from, b[b.length - 1].to, b); break; }
                catch (e) {
                    console.warn('[StoryEngine] 卷宗合并失败（已入重试队列）:', e && e.message || e);
                    pending.push({ level: 2, batch: keep1() }); pendingSave(pending); break;
                }
            }
            // 4. 未吸收卷宗超限 → 最旧 keep2 篇合并成典章
            while (unabsorbed(2).length > keep2()) {
                const b = unabsorbed(2).slice(0, keep2());
                try { await compressStory(3, b[0].from, b[b.length - 1].to, b); break; }
                catch (e) {
                    console.warn('[StoryEngine] 典章合并失败（已入重试队列）:', e && e.message || e);
                    pending.push({ level: 3, batch: keep2() }); pendingSave(pending); break;
                }
            }
        } finally { _compressing = false; }
    }

    // ---------- 词法检索 ----------
    function keywordsFromGameData(gd) {
        const kw = [];
        try {
            if (gd) {
                if (gd.relationships) kw.push(...Object.keys(gd.relationships));
                if (gd.tasks) {
                    (Array.isArray(gd.tasks) ? gd.tasks : []).forEach(t => { if (t && t.name) kw.push(t.name); });
                }
                if (Array.isArray(gd.inventory)) gd.inventory.forEach(i => { if (i && i.name) kw.push(i.name); });
                const loc = gd.progress && gd.progress.currentLocation;
                if (loc) kw.push(loc);
            }
        } catch (e) { /* ignore */ }
        return kw.filter(Boolean);
    }

    function lexicalRecall(userMessage, gd, topK) {
        topK = topK || RECALL_TOPK;
        const kws = keywordsFromGameData(gd);
        // 兜底：用户消息中 ≥2 字的连续片段（捕获新专名；长度截断避免长句匹配）
        if (userMessage && userMessage.length >= 2) {
            kws.push(String(userMessage).slice(0, 60));
        }
        if (!kws.length) return [];
        const excludeAbove = currentFloor() - 9;   // 近期楼层已在逐字上下文，排除
        const scored = [];
        for (const line of memoryStore.allChronicle()) {
            if (line.floor > excludeAbove) continue;
            const hay = (line.text || '') + (line.location || '');
            if (!hay) continue;
            let score = 0;
            for (const kw of kws) {
                if (!kw) continue;
                let idx = 0, count = 0;
                while ((idx = hay.indexOf(kw, idx)) !== -1) { count++; idx += kw.length; }
                score += count;
            }
            if (score > 0) scored.push({ floor: line.floor, score: score });
        }
        return scored.sort((a, b) => b.score - a.score).slice(0, topK);
    }

    // ---------- 注入 ----------
    function renderChronicleLines(lines) {
        let prevDate = '';
        return lines.map(l => {
            let timeStr = l.time || '';
            // 同日连续层省略日期段，控制行长
            const m = /^(\d+年\d+月\d+日)\s*(.+)$/.exec(timeStr);
            const datePart = m ? m[1] : '';
            if (datePart && datePart === prevDate) timeStr = m ? m[2] : timeStr;
            if (datePart) prevDate = datePart;
            return '第' + l.floor + '层｜' + timeStr + (l.location ? '·' + l.location : '') + '｜' + (l.text || '');
        }).join('\n');
    }

    async function buildRecallBlock(userMessage, gd) {
        const items = [];
        const seen = {};
        // 词法命中 → 展开该层纪要全文
        for (const hit of lexicalRecall(userMessage, gd)) {
            const s = memoryStore.getSummary(hit.floor);
            if (s) {
                seen[hit.floor] = true;
                items.push('第' + hit.floor + '层(' + (s.time || '') + '·' + (s.location || '') + ')：' + s.text);
            }
        }
        // 向量召回（可选）：与词法结果按楼层去重
        if (vecEnabled()) {
            try {
                const excludeIds = memoryStore.allEmbeddings()
                    .filter(r => r.floor > currentFloor() - 9).map(r => r.id);
                const recs = await memoryRecall.recallRelevantMemories(userMessage, 6, excludeIds, 600);
                (recs || []).forEach(r => {
                    if (r && r.floor && !seen[r.floor] && r.text) {
                        seen[r.floor] = true;
                        items.push('第' + r.floor + '层(' + (r.time || '') + '·' + (r.location || '') + ')：' + r.text);
                    }
                });
            } catch (e) {
                console.warn('[StoryEngine] 向量召回失败（词法结果兜底）:', e && e.message || e);
            }
        }
        if (!items.length) return '';
        return '【相关记忆召回】以下是历史楼层的剧情详情，仅供保持剧情连贯参考（非当前对话内容）：\n'
            + items.join('\n');
    }

    async function buildInjectBlocks(userMessage, gd) {
        if (!enabled()) return [];
        const blocks = [];
        const l3 = unabsorbed(3);
        const l2 = unabsorbed(2).slice(-keep2());
        const l1 = unabsorbed(1).slice(-keep1());
        if (l3.length) {
            blocks.push('【世界纪事·典章】（远期主线因果，作为既定历史对待）\n' + l3.map(r => r.text).join('\n\n'));
        }
        if (l2.length) {
            blocks.push('【世界纪事·卷宗】（中期剧情脉络）\n' + l2.map(r => r.text).join('\n\n'));
        }
        if (l1.length) {
            blocks.push('【世界纪事·最近纪事】（近期阶段事件）\n' + l1.map(r => r.text).join('\n\n'));
        }
        const tail = memoryStore.allChronicle().slice(-CHRONICLE_TAIL);
        if (tail.length) {
            blocks.push('【剧情编年史】（逐层索引：第N行=第N层发生的事）\n' + renderChronicleLines(tail));
        }
        const recall = await buildRecallBlock(userMessage, gd);
        if (recall) blocks.push(recall);
        return blocks;
    }

    // ---------- 撤销 ----------
    function snapshotIds() {
        return {
            storyIds: memoryStore.allStory().map(r => r.id),
            summaryFloors: memoryStore.allSummaries().map(r => r.floor),
            chronicleFloors: memoryStore.allChronicle().map(r => r.floor),
            vecIds: memoryStore.allEmbeddings().map(r => r.id)
        };
    }

    async function rollback(snap) {
        if (!snap) return;
        // 等待进行中的压缩结束，避免回滚与压缩并发产生孤儿记录
        let waited = 0;
        while (_compressing && waited < 30000) {
            await new Promise(r => setTimeout(r, 200));
            waited += 200;
        }
        // 1. 删除快照后新产生的 story 记录
        const keep = new Set(snap.storyIds || []);
        for (const r of memoryStore.allStory()) {
            if (!keep.has(r.id)) await memoryStore.del('story', r.id);
        }
        // 2. absorbedBy 指向已删记录者解除吸收（恢复注入与计数）
        for (const r of memoryStore.allStory()) {
            if (r.absorbedBy && !keep.has(r.absorbedBy)) {
                await memoryStore.put('story', Object.assign({}, r, { absorbedBy: null }));
            }
        }
        // 3. 删除快照之后归档的 summary/chronicle 行
        const sKeep = new Set(snap.summaryFloors || []);
        for (const r of memoryStore.allSummaries()) {
            if (!sKeep.has(r.floor)) await memoryStore.del('summary', r.floor);
        }
        const cKeep = new Set(snap.chronicleFloors || []);
        for (const r of memoryStore.allChronicle()) {
            if (!cKeep.has(r.floor)) await memoryStore.del('chronicle', r.floor);
        }
        // 4. 向量记录差量回滚（沿用既有模式）
        const vKeep = new Set(snap.vecIds || []);
        for (const r of memoryStore.allEmbeddings()) {
            if (!vKeep.has(r.id)) await memoryStore.del('embeddings', r.id);
        }
        console.log('[StoryEngine] 已回滚至快照（纪要 '
            + (snap.summaryFloors || []).length + ' 层 / 常驻线 ' + (snap.storyIds || []).length + ' 篇）');
    }

    // ---------- 查看器支撑 ----------
    function stats() {
        return {
            enabled: enabled(),
            vec: vecEnabled(),
            apiIndependent: window.memoryApi ? memoryApi.isIndependent() : false,
            floor: currentFloor(),
            summary: memoryStore.allSummaries().length,
            chronicle: memoryStore.allChronicle().length,
            l1: unabsorbed(1).length, l2: unabsorbed(2).length, l3: unabsorbed(3).length,
            nextChronicleAt: memoryStore.allStory().reduce((m, r) => Math.max(m, r.to || 0), 0) + every()
        };
    }

    function recompute() {
        return maybeCompress(currentFloor(), true);
    }

    return {
        init: init,
        onTurnArchived: onTurnArchived,
        nextFloor: nextFloor,
        fmtGameTime: fmtTime,
        buildInjectBlocks: buildInjectBlocks,
        snapshotIds: snapshotIds,
        rollback: rollback,
        stats: stats,
        recompute: recompute,
        lexicalRecall: lexicalRecall,
        // 内部暴露（测试用）
        _compressStory: compressStory,
        _maybeCompress: maybeCompress
    };
})();

if (typeof window !== 'undefined') {
    window.storyEngine = storyEngine;
}
