/**
 * preset-importer.js - ST 酒馆预设导入器 + 宏引擎（经典脚本，非 ES module）
 *
 * 功能：
 * 1. 解析 ST 预设 JSON（prompts / prompt_order / 生成参数）
 * 2. ST 宏引擎：按 prompt_order 顺序执行提示词，顺序处理变量宏
 *    - {{setvar::名::值}}  设置变量，宏本身从文本中移除
 *    - {{addvar::名::值}}  向变量追加内容
 *    - {{getvar::名}}      替换为变量当前值（未设置为空串）
 *    - {{incvar::名}} / {{decvar::名}}  数值自增/自减
 *    - {{random::a::b::c}} / {{random:a,b,c}} / {{pick:...}}  随机选一
 *    - {{user}}/{{用户}}、{{char}}/{{角色}}、{{lastUserMessage}}、{{input}} 等输入宏
 *    - {{persona}}/{{personality}}/{{scenario}}/{{description}} → 空串（独立游戏无角色卡）
 *    - {{//注释}}  整段移除
 *    - {{trim}}   ST 语义：按 {{trim}} 分段、每段去首尾空白后拼接
 * 3. 变量状态为请求级：每次构建消息链从头执行，不跨请求持久化（与 ST 一致）
 *
 * 暴露（window.presetImporter / module.exports）：
 * - 规范化酒馆预设(raw) / 导入ST预设(jsonText)
 * - 获取酒馆预设角色ID列表 / 获取酒馆预设顺序
 * - 构建预设消息链(preset, ctx) → {before, after, prefill, worldbookInjected}（宏已执行；
 *   worldInfo marker 处注入 ctx.worldbookText，chatHistory marker 分割前后段，
 *   assistant 恒入 prefill）
 * - 替换文本宏(text, ctx)（静态宏）
 * - 解析变量宏(content)（导入时预览用）
 * - 保存预设 / 加载当前预设 / 加载启用状态 / 清除预设
 */

var presetImporter = (function() {

    // ───────── 基础读取 ─────────

    const _读取文本 = (value) => (typeof value === 'string' ? value : '');
    const _读取布尔 = (value) => value === true;
    const _读取数值 = (value) => {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string' && value.trim()) {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) return parsed;
        }
        return null;
    };

    // ───────── 规范化 ─────────

    const _规范化角色 = (raw, systemPrompt) => {
        if (raw === 'system' || raw === 'user' || raw === 'assistant') return raw;
        return 'system';
    };

    const _规范化提示词 = (raw) => {
        if (!raw || typeof raw !== 'object') return null;
        const identifier = _读取文本(raw.identifier).trim();
        if (!identifier) return null;
        const name = _读取文本(raw.name || raw.title).trim();
        return {
            identifier,
            name: name || identifier,
            role: _规范化角色(raw.role, raw.system_prompt),
            content: _读取文本(raw.content),
            system_prompt: _读取布尔(raw.system_prompt),
            enabled: raw.enabled !== false,
            marker: _读取布尔(raw.marker)
        };
    };

    const _规范化顺序项 = (raw) => {
        if (!raw || typeof raw !== 'object') return null;
        const identifier = _读取文本(raw.identifier).trim();
        if (!identifier) return null;
        return { identifier, enabled: raw.enabled !== false };
    };

    const _规范化顺序 = (raw) => {
        if (!raw || typeof raw !== 'object') return null;
        const characterId = _读取数值(raw.character_id);
        const orderRaw = Array.isArray(raw.order) ? raw.order : [];
        const order = orderRaw.map(_规范化顺序项).filter(Boolean);
        if (characterId === null || order.length === 0) return null;
        return { character_id: characterId, order };
    };

    const 规范化酒馆预设 = (raw) => {
        if (!raw || typeof raw !== 'object') return null;

        const prompts = (Array.isArray(raw.prompts) ? raw.prompts : [])
            .map(_规范化提示词).filter(Boolean);
        const prompt_order = (Array.isArray(raw.prompt_order) ? raw.prompt_order : [])
            .map(_规范化顺序).filter(Boolean);

        const generation = {
            temperature: _读取数值(raw.temperature) ?? 1.0,
            frequency_penalty: _读取数值(raw.frequency_penalty) ?? 0,
            presence_penalty: _读取数值(raw.presence_penalty) ?? 0,
            top_p: _读取数值(raw.top_p) ?? 1.0,
            top_k: _读取数值(raw.top_k) ?? 0,
            max_context_tokens: _读取数值(raw.openai_max_context) ?? 200000,
            max_output_tokens: _读取数值(raw.openai_max_tokens) ?? 4096,
            stream: raw.stream_openai !== false
        };

        // 导入时预提取 setvar 默认值（仅供 UI 预览；真正执行在构建消息链时）
        const variables = {};
        const re = /\{\{setvar::([^:]+?)::([\s\S]*?)\}\}/g;
        prompts.forEach((p) => {
            if (!p.content) return;
            let m;
            re.lastIndex = 0;
            while ((m = re.exec(p.content)) !== null) {
                const name = m[1].trim();
                if (name && !(name in variables)) variables[name] = m[2];
            }
        });

        const meta = {
            imported_at: Date.now(),
            source_name: _读取文本(raw.name) || prompts[0]?.name || '导入预设',
            prompt_count: prompts.length,
            enabled_count: prompts.filter((p) => p.enabled).length,
            has_order: prompt_order.length > 0
        };

        if (prompts.length === 0) return null;
        return { prompts, prompt_order, generation, variables, meta };
    };

    const 获取酒馆预设角色ID列表 = (preset) => {
        if (!preset || !Array.isArray(preset.prompt_order)) return [];
        return Array.from(new Set(preset.prompt_order.map((item) => item.character_id)));
    };

    const 获取酒馆预设顺序 = (preset, selectedCharacterId) => {
        if (!preset || !Array.isArray(preset.prompt_order) || preset.prompt_order.length === 0) {
            return null;
        }
        const normalizedId = typeof selectedCharacterId === 'number' && Number.isFinite(selectedCharacterId)
            ? Math.floor(selectedCharacterId)
            : null;
        if (normalizedId !== null) {
            const matched = preset.prompt_order.find((item) => item.character_id === normalizedId);
            if (matched) return matched;
        }
        const preferredDefault = preset.prompt_order.find((item) => item.character_id === 100001);
        if (preferredDefault) return preferredDefault;
        return preset.prompt_order[0] || null;
    };

    // ───────── 宏引擎 ─────────

    /**
     * 静态宏替换（不涉及变量状态）
     * @param {string} text
     * @param {{userName?:string, charName?:string, lastUserMessage?:string}} ctx
     */
    const 替换文本宏 = (text, ctx) => {
        if (typeof text !== 'string') return '';
        ctx = ctx || {};
        const user = ctx.userName || '旅行者';
        const char = ctx.charName || '旁白';
        const input = ctx.lastUserMessage || '';
        const now = new Date();
        return text
            .replace(/\{\{\s*user\s*\}\}/gi, user)
            .replace(/\{\{\s*用户\s*\}\}/gi, user)
            .replace(/\{\{\s*(?:char|角色)\s*\}\}/gi, char)
            .replace(/\{\{\s*lastusermessage\s*\}\}/gi, input)
            .replace(/\{\{\s*(?:userinput|lastinput|input)\s*\}\}/gi, input)
            .replace(/<\s*user_input\s*>/gi, input)
            .replace(/<\s*userinput\s*>/gi, input)
            .replace(/<\s*input\s*>/gi, input)
            // 独立游戏没有角色卡，卡相关宏替换为空串，避免原文泄漏给 AI
            .replace(/\{\{\s*(?:persona|personality|scenario|description|char_description)\s*\}\}/gi, '')
            .replace(/\{\{\s*time\s*\}\}/gi, () => now.toTimeString().slice(0, 5))
            .replace(/\{\{\s*date\s*\}\}/gi, () => now.toISOString().slice(0, 10));
    };

    /**
     * 创建有状态的宏引擎（一次请求共用一份变量表）
     * ST 语义：变量在 prompt_order 顺序执行中即时生效，请求结束即丢弃
     */
    /**
     * 从游戏状态读取变量：variableSystem → gameData → null
     * @param {string} key
     * @returns {string|null}
     */
    const _读取游戏变量 = (key) => {
        // 1. variableSystem（三级变量：turn → session → global）
        if (typeof window !== 'undefined' && window.variableSystem && typeof window.variableSystem.get === 'function') {
            const v = window.variableSystem.get(key);
            if (v !== undefined && v !== null) return String(v);
        }
        // 2. gameData（扁平映射：优先 gd.vars，其次直接按顶层键查找）
        if (typeof window !== 'undefined' && window.gameData) {
            const gd = window.gameData;
            // 先查 gd.vars（如果有的话）
            if (gd.vars && gd.vars[key] !== undefined && gd.vars[key] !== null) return String(gd.vars[key]);
            // 再查顶层键（如 gd.fatePoints, gd.currentLocation 等）
            if (gd[key] !== undefined && gd[key] !== null) {
                if (typeof gd[key] === 'object') return JSON.stringify(gd[key]);
                return String(gd[key]);
            }
            // 查嵌套常用路径
            if (gd.character && gd.character[key] !== undefined) return String(gd.character[key]);
            if (gd.progress && gd.progress[key] !== undefined) return String(gd.progress[key]);
            if (gd.gameTime && gd.gameTime[key] !== undefined) return String(gd.gameTime[key]);
            if (gd.fatePoints && gd.fatePoints[key] !== undefined) return String(gd.fatePoints[key]);
            if (gd.currency && gd.currency[key] !== undefined) return String(gd.currency[key]);
        }
        return null;
    };

    /**
     * 创建有状态的宏引擎（一次请求共用一份变量表）
     * ST 语义：变量在 prompt_order 顺序执行中即时生效，请求结束即丢弃
     * 增强：getvar 可回退读取 variableSystem + gameData（与游戏状态对齐）
     */
    const 创建宏引擎 = (ctx) => {
        const vars = {};

        const 执行 = (content) => {
            let text = typeof content === 'string' ? content : '';

            // 1. 注释宏
            text = text.replace(/\{\{\/\/[\s\S]*?\}\}/g, '');

            // 2. setvar（执行后从文本移除）
            text = text.replace(/\{\{setvar::([^:]+)::([\s\S]*?)\}\}/gi, (m, name, value) => {
                vars[name.trim()] = value;
                return '';
            });

            // 3. addvar
            text = text.replace(/\{\{addvar::([^:]+)::([\s\S]*?)\}\}/gi, (m, name, value) => {
                const key = name.trim();
                vars[key] = (vars[key] === undefined || vars[key] === null ? '' : String(vars[key])) + value;
                return '';
            });

            // 4. incvar / decvar（ST：{{incvar::名}} 或 {{incvar::名::步长}}）
            text = text.replace(/\{\{incvar::([^:}]+)(?:::([^\}]+))?\}\}/gi, (m, name, step) => {
                const key = name.trim();
                const delta = Number(step) || 1;
                vars[key] = (Number(vars[key]) || 0) + delta;
                return '';
            });
            text = text.replace(/\{\{decvar::([^:}]+)(?:::([^\}]+))?\}\}/gi, (m, name, step) => {
                const key = name.trim();
                const delta = Number(step) || 1;
                vars[key] = (Number(vars[key]) || 0) - delta;
                return '';
            });

            // 5. getvar（优先级：预设 vars → variableSystem → gameData → 空串）
            text = text.replace(/\{\{getvar::([^:{}]+)\}\}/gi, (m, name) => {
                const key = name.trim();
                if (vars[key] !== undefined && vars[key] !== null) return String(vars[key]);
                const gameValue = _读取游戏变量(key);
                return gameValue !== null ? gameValue : '';
            });

            // 6. random 冒号分隔形式（先于逗号形式，避免误匹配）
            text = text.replace(/\{\{random::([^{}]+)\}\}/gi, (m, list) => {
                const options = list.split('::').map((s) => s.trim()).filter(Boolean);
                return options.length ? options[Math.floor(Math.random() * options.length)] : '';
            });
            // 7. random / pick 逗号分隔形式
            text = text.replace(/\{\{(?:random|pick):([^{}]+)\}\}/gi, (m, list) => {
                const options = list.split(',').map((s) => s.trim()).filter(Boolean);
                return options.length ? options[Math.floor(Math.random() * options.length)] : '';
            });

            // 8. 静态宏
            text = 替换文本宏(text, ctx);

            // 9. trim：ST 语义为按 {{trim}} 分段、每段去首尾空白后拼接
            if (/\{\{\s*trim\s*\}\}/i.test(text)) {
                text = text.split(/\{\{\s*trim\s*\}\}/i).map((s) => s.trim()).join('');
            }

            return text;
        };

        return { vars, 执行 };
    };

    /**
     * 构建 ST 预设消息链：按 prompt_order 顺序执行宏引擎，输出最终消息。
     * marker 注入点（还原 ST 结构语义）：
     *   - worldInfoBefore / worldInfoAfter → 注入 ctx.worldbookText（首个遇到的 marker 处）
     *   - chatHistory → 历史与最新输入的分割点，其后的提示词即 Post-History
     *     Instructions，靠近回复端以获得最强指令遵循
     * @param {Object} preset  规范化后的预设
     * @param {{userName?:string, charName?:string, lastUserMessage?:string, worldbookText?:string}} ctx
     * @returns {{before:Array<{role,content}>, after:Array<{role,content}>, prefill:Array<{role,content}>, worldbookInjected:boolean}}
     *   before  → 历史之前的提示词（可能含注入的 worldbookText）
     *   after   → chatHistory 之后的提示词（不含 assistant）
     *   prefill → assistant 角色提示词（永远放消息链最末，还原 ST 预填充语义）
     *   worldbookInjected → worldbookText 是否已被注入（false 时调用方应自行放系统提示词）
     */
    const 构建预设消息链 = (preset, ctx) => {
        const empty = { before: [], after: [], prefill: [], worldbookInjected: false };
        if (!preset || !Array.isArray(preset.prompts) || preset.prompts.length === 0) return empty;

        const promptMap = new Map(preset.prompts.map((p) => [p.identifier, p]));
        const order = 获取酒馆预设顺序(preset, null);
        const engine = 创建宏引擎(ctx);
        const before = [];
        const after = [];
        const prefill = [];
        const used = new Set();
        let pastHistory = false;
        let worldbookInjected = false;

        const injectWorldbook = () => {
            if (worldbookInjected) return;
            worldbookInjected = true;
            const text = (ctx && typeof ctx.worldbookText === 'string') ? ctx.worldbookText.trim() : '';
            if (text) before.push({ role: 'system', content: text });
        };

        // ST 语义：进入 prompt_order 的提示词以 order 条目的 enabled 为准，
        // prompts 库里的 enabled 只是默认值（导入预设常见 order 开 / prompt 关的冲突，order 赢）
        const 处理 = (p) => {
            if (!p || p.marker) return;
            if (used.has(p.identifier)) return;
            used.add(p.identifier);
            const content = engine.执行(p.content || '').trim();
            if (!content) return;
            const role = p.role === 'user' || p.role === 'assistant' ? p.role : 'system';
            if (role === 'assistant') prefill.push({ role, content });
            else (pastHistory ? after : before).push({ role, content });
        };

        if (order && Array.isArray(order.order)) {
            order.order.forEach((item) => {
                if (!item) return;
                if (item.identifier === 'worldInfoBefore' || item.identifier === 'worldInfoAfter') {
                    if (item.enabled !== false) injectWorldbook();
                    return;
                }
                if (item.identifier === 'chatHistory' && item.enabled !== false) {
                    pastHistory = true;
                    return;
                }
                if (item.enabled === false) return;
                处理(promptMap.get(item.identifier));
            });
        } else {
            // 没有 prompt_order 结构时按 prompts 原顺序，此时自身的 enabled 才生效
            preset.prompts.forEach((p) => {
                if (!p || p.enabled === false || p.marker) return;
                处理(p);
            });
        }

        return { before, after, prefill, worldbookInjected };
    };

    /**
     * 解析变量宏：{{setvar::name::default}} → {name: default}（导入预览用）
     */
    const 解析变量宏 = (content) => {
        const variables = {};
        if (typeof content !== 'string') return variables;
        const re = /\{\{setvar::([^:]+?)::([\s\S]*?)\}\}/g;
        let m;
        while ((m = re.exec(content)) !== null) {
            const name = m[1].trim();
            if (name) variables[name] = m[2];
        }
        return variables;
    };

    /**
     * 按顺序拼接提示词（纯文本版，不含宏执行——兼容旧接口）
     */
    const 按顺序拼接提示词 = (preset, characterId) => {
        const order = 获取酒馆预设顺序(preset, characterId);
        if (!order) return '';
        const promptMap = new Map(preset.prompts.map((p) => [p.identifier, p]));
        const parts = [];
        for (const item of order.order) {
            if (item.enabled === false) continue;
            const prompt = promptMap.get(item.identifier);
            if (!prompt || prompt.enabled === false || prompt.marker) continue;
            if (prompt.content && prompt.content.trim()) parts.push(prompt.content);
        }
        return parts.join('\n\n');
    };

    // ───────── 生成参数 / 存储 / 导入 ─────────

    const 提取生成参数 = (preset) => {
        if (!preset || !preset.generation) return null;
        return { ...preset.generation };
    };

    const STORAGE_KEY = 'calamity-st-preset';

    const 保存预设 = (preset) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(preset));
            return true;
        } catch (e) {
            console.warn('[PresetImporter] 保存失败：', e);
            return false;
        }
    };

    const 加载当前预设 = () => {
        try {
            const text = localStorage.getItem(STORAGE_KEY);
            if (!text) return null;
            return JSON.parse(text);
        } catch (e) {
            console.warn('[PresetImporter] 加载失败：', e);
            return null;
        }
    };

    const 加载启用状态 = () => {
        try {
            return localStorage.getItem('calamity-st-preset-enabled') === '1';
        } catch (e) {
            return false;
        }
    };

    const 清除预设 = () => {
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem('calamity-st-preset-enabled');
            return true;
        } catch (e) {
            return false;
        }
    };

    /**
     * 主入口：JSON 文本 → 规范化预设 → 持久化
     */
    const 导入ST预设 = (jsonText) => {
        let raw;
        try {
            raw = JSON.parse(jsonText);
        } catch (e) {
            return { success: false, error: 'JSON 解析失败：' + e.message };
        }
        const preset = 规范化酒馆预设(raw);
        if (!preset) {
            return { success: false, error: '未找到有效的 prompts 数组' };
        }
        保存预设(preset);
        return { success: true, preset };
    };

    return {
        规范化酒馆预设,
        获取酒馆预设角色ID列表,
        获取酒馆预设顺序,
        替换文本宏,
        创建宏引擎,
        构建预设消息链,
        按顺序拼接提示词,
        解析变量宏,
        提取生成参数,
        保存预设,
        加载当前预设,
        加载启用状态,
        清除预设,
        导入ST预设
    };
})();

if (typeof window !== 'undefined') {
    window.presetImporter = presetImporter;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = presetImporter;
}
