/**
 * story-engine.js - 记忆系统核心（v2.1，含 P1 账本套件）
 *
 * 架构（见 docs/记忆系统2.0-工程蓝图.md）：
 *   核心（常启）：每层纪要 → 编年史一行 → 滚动合并（纪事20层→卷宗100层→典章300层）
 *                 注入 = 典章/卷宗/纪事(常驻) + 编年史尾窗(常驻) + 词法命中展开(按需)
 *   向量模块（可选，calamity-memory-vec）：摘要向量化，召回与词法按楼层去重合并
 *   P1 账本套件：实体台账（[实体更新] 块维护）+ 悬念簿（[悬念]/[悬念核销]）+ 主观记忆
 *                （挂纪事压缩批量提取，走副API；主演/龙套分级注入）
 *   通道：所有 LLM 压缩/提取调用走 memoryApi（副API，未配置跟随主API）
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

    // P1 账本套件参数
    const LEDGER_HISTORY_MAX = 5;   // 台账每实体变更史上限
    const LEDGER_STATE_MAX = 80;    // 台账当前态字数上限
    const LEDGER_CHANGE_MAX = 60;   // 台账单条变更字数上限
    const SUSPENSE_ACTIVE_MAX = 8;  // 悬念注入条数上限
    const SUSPENSE_BLOCK_MAX = 600; // 悬念块字数预算
    const SUBJ_PER_HOLDER_MAX = 3;  // 主观记忆每人上限（提取与主演注入共用）
    const SUBJ_BATCH_MAX = 10;      // 主观记忆整批上限
    const SUBJ_MEMORY_MAX = 50;     // 单条主观记忆字数上限
    const SUBJ_BLOCK_MAX = 500;     // 人物记忆块字数预算
    const LEDGER_BLOCK_MAX = 400;   // 实体台账块字数预算
    const LEDGER_INJECT_MAX = 6;    // 台账注入实体数上限

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
        // P1 账本套件：实体台账/悬念簿先落地（不依赖纪要文本；floor 为本回合楼层号）
        if (Array.isArray(p.entities) && p.entities.length) {
            await applyEntities(p.entities, p.floor, p.time || '')
                .catch(e => console.warn('[StoryEngine] 实体台账落地失败（跳过）:', e && e.message || e));
        }
        if (Array.isArray(p.suspenses) && p.suspenses.length) {
            await applySuspenses(p.suspenses, p.floor, p.time || '')
                .catch(e => console.warn('[StoryEngine] 悬念簿落地失败（跳过）:', e && e.message || e));
        }
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

    // ---------- P1 账本套件：实体台账 ----------
    function clampText(v, max) {
        const s = String(v == null ? '' : v).trim();
        return s.length > max ? s.slice(0, max) : s;
    }
    function uid(prefix) {
        return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    }

    /** 实体的规范名归并：按 名称/别名 双向匹配（大小写不敏感），命中即视为同一实体 */
    function findLedgerRecord(name) {
        const key = String(name || '').trim().toLowerCase();
        if (!key) return null;
        return memoryStore.allLedger().find(r =>
            r.name.toLowerCase() === key || (r.aliases || []).some(a => String(a).toLowerCase() === key)) || null;
    }

    /**
     * 应用 [实体更新] 块解析出的实体列表（upsert，幂等）。
     * 规范名保持首次登记的名字（后续别名归并进 aliases，注入时提示 AI 沿用规范名）；
     * 权威数值（金币/背包/好感度等）不进台账——那由命令引擎 gameData 承载。
     */
    async function applyEntities(entities, floor, time) {
        for (const ent of entities) {
            const name = clampText(ent.name, 20);
            if (!name) continue;
            const kind = clampText(ent.kind, 10) || 'NPC';
            const aliases = (Array.isArray(ent.aliases) ? ent.aliases : [])
                .map(a => clampText(a, 20)).filter(a => a && a.toLowerCase() !== name.toLowerCase());
            const state = clampText(ent.state, LEDGER_STATE_MAX);
            const change = clampText(ent.change, LEDGER_CHANGE_MAX);
            if (!state && !change) continue;

            const existing = findLedgerRecord(name);
            if (existing) {
                const mergedAliases = Array.from(new Set([]
                    .concat(existing.aliases || [], aliases)
                    .filter(a => a.toLowerCase() !== existing.name.toLowerCase())));
                // 新名与规范名不同 → 旧名与新名都进别名，保证后续回合可归并
                if (name.toLowerCase() !== existing.name.toLowerCase()) {
                    if (mergedAliases.indexOf(name) === -1) mergedAliases.push(name);
                    if (mergedAliases.indexOf(existing.name) === -1) mergedAliases.push(existing.name);
                }
                const hist = (existing.history || []).slice();
                if (change || (state && state !== existing.state)) {
                    hist.push({ floor: floor, time: time, change: change || ('状态更新：' + state) });
                }
                await memoryStore.put('ledger', Object.assign({}, existing, {
                    kind: existing.kind || kind,
                    aliases: mergedAliases.slice(-6),
                    state: state || existing.state,
                    history: hist.slice(-LEDGER_HISTORY_MAX),
                    lastFloor: floor, updatedAt: Date.now()
                }));
            } else {
                await memoryStore.put('ledger', {
                    id: 'ld_' + name, name: name, kind: kind,
                    aliases: aliases.slice(-6), state: state,
                    history: change ? [{ floor: floor, time: time, change: change }] : [],
                    createdFloor: floor, lastFloor: floor, createdAt: Date.now(), updatedAt: Date.now()
                });
            }
        }
        return true;
    }

    // ---------- P1 账本套件：悬念簿 ----------
    /**
     * 应用 [悬念]（建立）/ [悬念核销]（收束）块。核销未建立的悬念时按已核销存档，
     * 保留叙事事实（悬念可能在账本启用前建立）。
     */
    async function applySuspenses(suspenses, floor, time) {
        for (const item of suspenses) {
            const name = clampText(item.name, 30);
            if (!name) continue;
            const existing = memoryStore.allSuspense()
                .find(r => r.name.toLowerCase() === name.toLowerCase());
            if (item.type === 'resolve') {
                const result = clampText(item.result || item.desc, LEDGER_STATE_MAX);
                if (existing) {
                    if (existing.status !== 'resolved') {
                        await memoryStore.put('suspense', Object.assign({}, existing, {
                            status: 'resolved', result: result, resolvedFloor: floor, resolvedTime: time
                        }));
                    }
                } else {
                    await memoryStore.put('suspense', {
                        id: uid('sp'), name: name, desc: '', status: 'resolved', result: result,
                        floor: floor, time: time, resolvedFloor: floor, createdAt: Date.now()
                    });
                }
            } else {
                if (existing) {
                    // 重复建立：仅未决时补写描述，不重复开线
                    if (existing.status === 'active' && item.desc && !existing.desc) {
                        await memoryStore.put('suspense', Object.assign({}, existing,
                            { desc: clampText(item.desc, LEDGER_STATE_MAX) }));
                    }
                } else {
                    await memoryStore.put('suspense', {
                        id: uid('sp'), name: name, desc: clampText(item.desc, LEDGER_STATE_MAX),
                        status: 'active', floor: floor, time: time, createdAt: Date.now()
                    });
                }
            }
        }
        return true;
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

    /** 收集楼层区间的压缩/提取输入行（超长保护：只取最近 80 层，优先保留新近因果） */
    function collectInputs(from, to) {
        const inputs = [];
        for (let f = from; f <= to; f++) {
            const s = memoryStore.getSummary(f);
            if (s) inputs.push('第' + f + '层(' + (s.time || '') + '·' + (s.location || '') + ')：' + s.text);
        }
        if (inputs.length > 80) inputs = inputs.slice(-80);
        return inputs;
    }

    async function compressStory(level, from, to, sources) {
        let inputs = [];
        if (sources && sources.length) {
            inputs = sources.map(r => r.text);
        } else {
            inputs = collectInputs(from, to);
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

    // ---------- P1 账本套件：主观记忆批量提取（挂纪事压缩，走副API） ----------
    function extractPrompt() {
        return '你是记忆提取员。从输入的按时间排列的剧情记录中，提取 NPC 的主观记忆'
            + '（某个 NPC 记得/相信/怀疑/误解的事），只提取会影响后续剧情认知的长期印象。\n\n'
            + '要求：\n'
            + '1. 每条格式：{"holder":"NPC名","kind":"记得|相信|怀疑|误解","memory":"≤50字","known_by":["知情者NPC名"]}\n'
            + '2. kind 为怀疑/误解时必须如实标注，禁止把人物认知写成世界事实；known_by 写除 holder 外还有哪些 NPC 知晓（无则空数组）。\n'
            + '3. 每个 NPC 最多 ' + SUBJ_PER_HOLDER_MAX + ' 条，总共最多 ' + SUBJ_BATCH_MAX + ' 条；优先保留对后续剧情影响最大的。\n'
            + '4. 只依据输入，不补写未发生的情节。\n\n'
            + '直接输出 JSON 数组，不要评论、标题或代码块标记。';
    }

    function safeParseJsonArray(text) {
        const t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
        try {
            const v = JSON.parse(t);
            return Array.isArray(v) ? v : null;
        } catch (e) { return null; }
    }

    /**
     * 纪事压缩成功后的二次调用：从同区间提取主观记忆。
     * 幂等：rangeId（l1_from_to）已有记录则跳过（重试/重掷/重算安全）；
     * 失败只告警不阻塞压缩链，该区间记为"本轮未提取"（不重试，等下一纪事）。
     */
    async function extractSubjectiveMemories(from, to) {
        if (!window.memoryApi || !window.apiService) return;
        const rangeId = 'l1_' + from + '_' + to;
        if (memoryStore.allSubjective().some(r => r.rangeId === rangeId)) return;
        const inputs = collectInputs(from, to);
        if (!inputs.length) return;
        const res = await memoryApi.sendMessages([
            { role: 'system', content: extractPrompt() },
            { role: 'user', content: inputs.join('\n') }
        ], { temperature: 0.2, stream: false, maxOutputTokens: 1500 });
        const list = safeParseJsonArray(res && res.content);
        if (!list) throw new Error('主观记忆提取返回非 JSON 数组');
        const perHolder = {};
        let total = 0;
        for (const item of list) {
            if (!item || total >= SUBJ_BATCH_MAX) break;
            const holder = clampText(item.holder, 20);
            const memory = clampText(item.memory, SUBJ_MEMORY_MAX);
            if (!holder || !memory) continue;
            perHolder[holder] = (perHolder[holder] || 0) + 1;
            if (perHolder[holder] > SUBJ_PER_HOLDER_MAX) continue;
            const knownBy = (Array.isArray(item.known_by) ? item.known_by : [])
                .map(k => clampText(k, 20)).filter(Boolean).slice(0, 3);
            const kind = ['记得', '相信', '怀疑', '误解'].indexOf(item.kind) >= 0 ? item.kind : '记得';
            await memoryStore.put('subjective', {
                id: uid('sub'), rangeId: rangeId, from: from, to: to,
                holder: holder, kind: kind, text: memory, knownBy: knownBy,
                createdAt: Date.now()
            });
            total++;
        }
        console.log('[StoryEngine] 主观记忆提取完成：第' + from + '~' + to + '层 → ' + total + ' 条');
    }

    /** 纪事压缩成功后统一触发的提取钩子（await 于压缩互斥锁内，避免与撤销回滚并发；失败不阻塞压缩链） */
    async function hookSubjectiveExtraction(from, to) {
        try {
            await extractSubjectiveMemories(from, to);
        } catch (e) {
            console.warn('[StoryEngine] 主观记忆提取失败（跳过本区间）:', e && e.message || e);
        }
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
            // P1：纪事压缩成功 → 同区间主观记忆提取（await 于压缩锁内，失败不阻塞）
            await hookSubjectiveExtraction(task.from, task.to);
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
                    try {
                        await compressStory(1, from, currentFloor, null);
                        // P1：纪事压缩成功 → 同区间主观记忆提取
                        await hookSubjectiveExtraction(from, currentFloor);
                    }
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

    // ---------- P1 注入块：悬念簿 / 人物记忆 / 实体台账 ----------
    function buildSuspenseBlock() {
        const active = memoryStore.allSuspense()
            .filter(r => r.status === 'active')
            .sort((a, b) => b.floor - a.floor)
            .slice(0, SUSPENSE_ACTIVE_MAX);
        if (!active.length) return '';
        let budget = 0;
        const lines = [];
        for (const s of active) {
            const line = '- ' + s.name + (s.desc ? '：' + s.desc : '') + '（第' + s.floor + '层建立）';
            if (budget + line.length > SUSPENSE_BLOCK_MAX) break;
            budget += line.length;
            lines.push(line);
        }
        if (!lines.length) return '';
        return '【未决悬念】（已抛出但尚未收束的剧情线索：核销前保持未解状态，不要自行当作已解决）\n' + lines.join('\n');
    }

    /** 主演/龙套分级：关系簿/任务发布者/本回合消息/近期编年史中出现过的 holder 为主演 */
    function subjectiveHolderTiers(gd, userMessage) {
        const leads = new Set();
        const msg = String(userMessage || '');
        try {
            if (gd) {
                if (gd.relationships) Object.keys(gd.relationships).forEach(n => leads.add(n));
                const quests = (gd.quests && Array.isArray(gd.quests.active)) ? gd.quests.active : [];
                quests.forEach(q => { if (q && q.giver) leads.add(q.giver); });
            }
        } catch (e) { /* ignore */ }
        const recentChron = memoryStore.allChronicle().slice(-30)
            .map(r => (r.text || '') + (r.location || '')).join('\n');
        const tiers = {};
        const byHolder = {};
        for (const r of memoryStore.allSubjective()) {
            (byHolder[r.holder] = byHolder[r.holder] || []).push(r);
            if (leads.has(r.holder) || (msg && msg.indexOf(r.holder) >= 0) || recentChron.indexOf(r.holder) >= 0) {
                tiers[r.holder] = '主演';
            }
        }
        Object.keys(byHolder).forEach(h => { if (!tiers[h]) tiers[h] = '龙套'; });
        return { tiers: tiers, byHolder: byHolder };
    }

    function buildSubjectiveBlock(userMessage, gd) {
        if (!memoryStore.allSubjective().length) return '';
        const meta = subjectiveHolderTiers(gd, userMessage);
        // 主演优先（每人至多 SUBJ_PER_HOLDER_MAX 条），龙套只保留最近 1 条
        const holderNames = Object.keys(meta.byHolder)
            .sort((a, b) => (meta.tiers[b] === '主演') - (meta.tiers[a] === '主演'));
        let budget = 0, count = 0;
        const lines = [];
        for (const holder of holderNames) {
            const recs = meta.byHolder[holder].sort((a, b) => (b.to || 0) - (a.to || 0));
            const cap = meta.tiers[holder] === '主演' ? SUBJ_PER_HOLDER_MAX : 1;
            for (const r of recs.slice(0, cap)) {
                if (count >= SUBJ_BATCH_MAX || budget >= SUBJ_BLOCK_MAX) break;
                const known = (r.knownBy && r.knownBy.length) ? '（知情者：' + r.knownBy.join('、') + '）' : '';
                const line = '- ' + holder + '（' + r.kind + '）：' + r.text + known;
                if (budget + line.length > SUBJ_BLOCK_MAX) break;
                budget += line.length; count++;
                lines.push(line);
            }
            if (count >= SUBJ_BATCH_MAX || budget >= SUBJ_BLOCK_MAX) break;
        }
        if (!lines.length) return '';
        return '【人物记忆】登场 NPC 的主观认知（是人物自己的记忆/怀疑/误解，不代表世界事实，仅供把握其言行立场）\n' + lines.join('\n');
    }

    function buildLedgerBlock(userMessage, gd) {
        const recs = memoryStore.allLedger();
        if (!recs.length) return '';
        const msg = String(userMessage || '');
        const recentCut = currentFloor() - every() * 2;   // 近期活跃实体
        const scored = [];
        for (const r of recs) {
            let score = 0;
            if (msg && (msg.indexOf(r.name) >= 0 || (r.aliases || []).some(a => msg.indexOf(a) >= 0))) score += 10;
            if ((r.lastFloor || 0) >= recentCut) {
                score += 2 + Math.min(1, ((r.lastFloor || 0) - recentCut) / Math.max(1, every() * 2));
            }
            if (score > 0) scored.push({ r: r, score: score });
        }
        scored.sort((a, b) => b.score - a.score);
        let budget = 0, count = 0;
        const lines = [];
        for (const item of scored) {
            if (count >= LEDGER_INJECT_MAX || budget >= LEDGER_BLOCK_MAX) break;
            const r = item.r;
            const hist = (r.history || []).slice(-2).map(h => '此前：' + h.change).join('；');
            const aliasPart = (r.aliases && r.aliases.length) ? '[别称：' + r.aliases.join('/') + ']' : '';
            const line = '- ' + r.name + '（' + r.kind + '）' + aliasPart + '：' + (r.state || '（无当前态记录）')
                + (hist ? '；' + hist : '');
            if (budget + line.length > LEDGER_BLOCK_MAX) break;
            budget += line.length; count++;
            lines.push(line);
        }
        if (!lines.length) return '';
        return '【实体台账】场景相关实体的当前态与近况（金币/背包/好感度等权威数值以状态面板为准，此处为世界事实）\n' + lines.join('\n');
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
        // P1 账本套件注入（顺序对齐设计方案管线：检索 → 悬念 → 人物记忆 → 实体台账）
        const suspenseBlock = buildSuspenseBlock();
        if (suspenseBlock) blocks.push(suspenseBlock);
        const subjectiveBlock = buildSubjectiveBlock(userMessage, gd);
        if (subjectiveBlock) blocks.push(subjectiveBlock);
        const ledgerBlock = buildLedgerBlock(userMessage, gd);
        if (ledgerBlock) blocks.push(ledgerBlock);
        return blocks;
    }

    // ---------- 撤销 ----------
    function snapshotIds() {
        return {
            storyIds: memoryStore.allStory().map(r => r.id),
            summaryFloors: memoryStore.allSummaries().map(r => r.floor),
            chronicleFloors: memoryStore.allChronicle().map(r => r.floor),
            vecIds: memoryStore.allEmbeddings().map(r => r.id),
            // P1 账本套件：记录量小（<100 条级），快照直接存全量内容（覆盖式回滚，
            // 比 id 差量更精确——台账 upsert 会被原地更新，id 集合差量无法恢复旧态）
            ledgerRecs: JSON.parse(JSON.stringify(memoryStore.allLedger())),
            suspenseRecs: JSON.parse(JSON.stringify(memoryStore.allSuspense())),
            subjectiveRecs: JSON.parse(JSON.stringify(memoryStore.allSubjective()))
        };
    }

    /** 恢复 P1 store 到快照内容（旧快照无该字段时跳过，保持向后兼容） */
    async function restoreP1Store(store, snapKey) {
        const snapList = snapKey ? snapKey : null;
        if (!Array.isArray(snapList)) return;   // 旧快照（P1 之前）不含此字段 → 不动该 store
        const keep = new Set(snapList.map(r => r.id));
        for (const r of memoryStore['all' + store.charAt(0).toUpperCase() + store.slice(1)]()) {
            if (!keep.has(r.id)) await memoryStore.del(store, r.id);
        }
        for (const r of snapList) {
            await memoryStore.put(store, JSON.parse(JSON.stringify(r)));
        }
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
        // 5. P1 账本套件回滚：台账/悬念/主观记忆恢复到快照内容（旧快照无字段时跳过）
        await restoreP1Store('ledger', snap.ledgerRecs);
        await restoreP1Store('suspense', snap.suspenseRecs);
        await restoreP1Store('subjective', snap.subjectiveRecs);
        console.log('[StoryEngine] 已回滚至快照（纪要 '
            + (snap.summaryFloors || []).length + ' 层 / 常驻线 ' + (snap.storyIds || []).length + ' 篇）');
    }

    // ---------- 查看器支撑 ----------
    function stats() {
        const suspenseAll = memoryStore.allSuspense();
        return {
            enabled: enabled(),
            vec: vecEnabled(),
            apiIndependent: window.memoryApi ? memoryApi.isIndependent() : false,
            floor: currentFloor(),
            summary: memoryStore.allSummaries().length,
            chronicle: memoryStore.allChronicle().length,
            l1: unabsorbed(1).length, l2: unabsorbed(2).length, l3: unabsorbed(3).length,
            nextChronicleAt: memoryStore.allStory().reduce((m, r) => Math.max(m, r.to || 0), 0) + every(),
            ledger: memoryStore.allLedger().length,
            suspenseActive: suspenseAll.filter(r => r.status === 'active').length,
            suspenseTotal: suspenseAll.length,
            subjective: memoryStore.allSubjective().length
        };
    }

    function recompute() {
        return maybeCompress(currentFloor(), true);
    }

    return {
        init: init,
        onTurnArchived: onTurnArchived,
        nextFloor: nextFloor,
        currentFloor: currentFloor,
        fmtGameTime: fmtTime,
        buildInjectBlocks: buildInjectBlocks,
        snapshotIds: snapshotIds,
        rollback: rollback,
        stats: stats,
        recompute: recompute,
        lexicalRecall: lexicalRecall,
        // 内部暴露（测试用）
        _compressStory: compressStory,
        _maybeCompress: maybeCompress,
        _applyEntities: applyEntities,
        _applySuspenses: applySuspenses,
        _extractSubjectiveMemories: extractSubjectiveMemories,
        _buildLedgerBlock: buildLedgerBlock,
        _buildSubjectiveBlock: buildSubjectiveBlock,
        _buildSuspenseBlock: buildSuspenseBlock
    };
})();

if (typeof window !== 'undefined') {
    window.storyEngine = storyEngine;
}
