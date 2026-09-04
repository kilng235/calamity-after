/**
 * response-parser.js - 响应解析器（灾厄 DND 版）
 *
 * 职责：
 * - 剥离思考区（ANAL/thinking）
 * - 提取 <content>/<MAIN_TEXT> 正文（内嵌 <check>/<battle> 保留给 UI 渲染）
 * - 提取 <SUMMARY> 摘要
 * - 提取并解析 <命令> 区（墨色江湖式 add/set/push/delete，多写法归一化）
 *
 * 命令解析移植自 MoRanJiangHu storyResponseParser：
 * - JSON 写法：[{action,key,value}] / {tavern_commands:[...]} / {set:{...}} 对象映射
 * - 行式写法：`add 金币 = 100`（分隔符 = ＝ : ： => 或空格；支持中文动作别名）
 * - 值解析：引号字符串 / true / false / null / 数字 / JSON（jsonrepair 兜底）
 * - 预处理：字符串感知移除 // 注释；JSON value 位置白名单算术求值
 *
 * @module response-parser
 * @version 2.0.0
 */

var responseParser = (function () {

    // ==================== 思考区剥离 ====================

    function removeThinkingContent(text) {
        if (!text) return '';
        var result = text;

        // 步骤1: 循环移除完整的 ANAL 块
        var prevResult;
        do {
            prevResult = result;
            result = result.replace(
                /<([^>\/]+)>([\s\S]*?)<\/([^>]+)>/g,
                function (match, openTag, inner, closeTag) {
                    var normOpen = openTag.replace(/[\s_]/g, '').toUpperCase();
                    var normClose = closeTag.replace(/[\s_]/g, '').toUpperCase();
                    if (normOpen.indexOf('ANAL') !== -1 || normClose.indexOf('ANAL') !== -1 ||
                        normOpen.indexOf('THINK') !== -1 || normClose.indexOf('THINK') !== -1) {
                        return '';
                    }
                    return match;
                }
            );
        } while (result !== prevResult);

        // 步骤2: 截断未闭合的 ANAL/THINK 开始标签
        var openTagPattern = /<([^>\/]+)>/g;
        var m;
        var lastThinkingStart = -1;
        while ((m = openTagPattern.exec(result)) !== null) {
            var normalized = m[1].replace(/[\s_]/g, '').toUpperCase();
            if (normalized.indexOf('ANAL') !== -1 || normalized.indexOf('THINK') !== -1) {
                lastThinkingStart = m.index;
            }
        }
        if (lastThinkingStart !== -1) {
            result = result.substring(0, lastThinkingStart);
        }

        return result.trim();
    }

    // ==================== 正文提取 ====================

    function extractMainText(text) {
        if (!text) return '';

        // 优先：<content>（结算协议格式）或 <MAIN_TEXT>（兼容）
        var candidates = [
            { open: /<[\s_]*[Cc][Oo][Nn][Tt][Ee][Nn][Tt][\s_]*>/, close: /<[\s_]*\/[\s_]*[Cc][Oo][Nn][Tt][Ee][Nn][Tt][\s_]*>/ },
            { open: /<[\s]*[Mm][Aa][Ii][Nn][\s_]*[Tt][Ee][Xx][Tt][\s]*>/, close: /<[\s]*\/[\s]*[Mm][Aa][Ii][Nn][\s_]*[Tt][Ee][Xx][Tt][\s]*>/ }
        ];
        for (var i = 0; i < candidates.length; i++) {
            var openMatch = candidates[i].open.exec(text);
            if (openMatch) {
                var contentStart = openMatch.index + openMatch[0].length;
                var closeMatch = candidates[i].close.exec(text.substring(contentStart));
                if (closeMatch) {
                    return text.substring(contentStart, contentStart + closeMatch.index).trim();
                }
                // 闭合缺失：截到下一个结构标签（命令/摘要）或串尾
                var structuralRe = /<[\s_]*\/?[\s_]*(?:命令|[Cc][Oo][Mm][Mm][Aa][Nn][Dd]|[Ss][Uu][Mm][Mm][Aa][Rr][Yy]|[Cc][Oo][Nn][Tt][Ee][Nn][Tt])[（\)【】\s_>:：]*>?/;
                var structMatch = structuralRe.exec(text.substring(contentStart));
                if (structMatch && structMatch.index > 0) {
                    return text.substring(contentStart, contentStart + structMatch.index).trim();
                }
                return stripTrailingCommandBlock(text.substring(contentStart)).trim();
            }
        }

        // 回退：无标签时取「命令区/摘要之前」的全部叙述文本
        // 注意：保留 <check> 和 <battle> 块（它们是叙事的一部分）
        var commandIndex = findCommandBlockStart(text);
        var summaryIndex = text.indexOf('<SUMMARY');
        var cutIndex = -1;
        if (commandIndex > -1) cutIndex = commandIndex;
        if (summaryIndex > -1 && (cutIndex === -1 || summaryIndex < cutIndex)) cutIndex = summaryIndex;
        // 把 <命令> 和 <SUMMARY> 之前的所有内容都作为正文（含 <battle>/<check>）
        var searchScope = cutIndex > -1 ? text.substring(0, cutIndex) : text;
        return searchScope.trim();
    }

    /** 无闭合 <content> 时，剪掉尾部未闭合的 <命令> 段 */
    function stripTrailingCommandBlock(text) {
        var openIdx = text.lastIndexOf('<命令');
        if (openIdx === -1) {
            var m = /<[Cc]?[Oo]?[Mm]?[Mm]?[Aa]?[Nn]?[Dd]?/.exec(text);
            openIdx = m ? m.index : -1;
        }
        return openIdx > -1 ? text.substring(0, openIdx) : text;
    }

    function findCommandBlockStart(text) {
        var re = /<[\s_]*(?:命令|[Cc][Oo][Mm][Mm][Aa][Nn][Dd])[\s_]*>/;
        var m = re.exec(text);
        return m ? m.index : -1;
    }

    // ==================== 摘要提取 ====================

    function extractSummaries(text) {
        if (!text) return [];
        var summaries = [];
        var regex = /<[\s_]*[Ss][Uu][Mm][Mm][Aa][Rr][Yy][\s_]*>([\s\S]*?)<[\s_]*\/[\s_]*[Ss][Uu][Mm][Mm][Aa][Rr][Yy][\s_]*>/g;
        var match;
        while ((match = regex.exec(text)) !== null) {
            var content = match[1].trim();
            if (content) summaries.push(content);
        }
        return summaries;
    }

    // ==================== 任务块提取 ====================

    /**
     * 提取任务块（支持 [新任务]...[/新任务] 和 <新任务>...</新任务> 两种写法）
     * @param {string} text - 原始文本
     * @returns {Array<{type: string, content: string}>} 任务块列表
     */
    function extractQuestBlocks(text) {
        if (!text) return [];
        var quests = [];
        
        // 匹配 [新任务]...[/新任务] 或 <新任务>...</新任务>
        var newQuestRegex = /[\[<][\s_]*(?:新任务|新任務|NewQuest|new_quest)[\s_]*[\]>]([\s\S]*?)[\[<][\s_]*\/[\s_]*(?:新任务|新任務|NewQuest|new_quest)[\s_]*[\]>]/gi;
        var match;
        while ((match = newQuestRegex.exec(text)) !== null) {
            quests.push({ type: 'new', content: match[1].trim() });
        }
        
        // 匹配 [任务完成]...[/任务完成] 或 <任务完成>...</任务完成>
        var completeQuestRegex = /[\[<][\s_]*(?:任务完成|任務完成|QuestComplete|quest_complete)[\s_]*[\]>]([\s\S]*?)[\[<][\s_]*\/[\s_]*(?:任务完成|任務完成|QuestComplete|quest_complete)[\s_]*[\]>]/gi;
        while ((match = completeQuestRegex.exec(text)) !== null) {
            quests.push({ type: 'complete', content: match[1].trim() });
        }
        
        // 匹配 [任务失败]...[/任务失败] 或 <任务失败>...</任务失败>
        var failQuestRegex = /[\[<][\s_]*(?:任务失败|任務失敗|QuestFailed|quest_failed)[\s_]*[\]>]([\s\S]*?)[\[<][\s_]*\/[\s_]*(?:任务失败|任務失敗|QuestFailed|quest_failed)[\s_]*[\]>]/gi;
        while ((match = failQuestRegex.exec(text)) !== null) {
            quests.push({ type: 'fail', content: match[1].trim() });
        }
        
        return quests;
    }

    /**
     * 解析单个任务块内容（键值对格式）
     * @param {string} content - 任务块内容
     * @returns {Object} 任务对象
     */
    function parseQuestContent(content) {
        if (!content) return null;
        
        var quest = {
            name: '',
            description: '',
            type: '主线',
            tier: '普通',
            objectives: [],
            rewards: {},
            giver: null
        };
        
        var lines = content.split('\n');
        var currentSection = null;
        var currentObjective = null;
        
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            
            // 解析键值对（支持 "键：值" / "键=值" / "键: 值"）
            var kvMatch = line.match(/^([^:=：]+)[=:：]\s*([\s\S]*)$/);
            if (kvMatch) {
                var key = kvMatch[1].trim().toLowerCase();
                var value = kvMatch[2].trim();
                
                if (key === '名称' || key === 'name') {
                    quest.name = value;
                } else if (key === '描述' || key === 'description' || key === '说明') {
                    quest.description = value;
                } else if (key === '类型' || key === 'type') {
                    quest.type = value;
                } else if (key === '等级' || key === 'tier' || key === '难度') {
                    quest.tier = value;
                } else if (key === '发布者' || key === 'giver' || key === 'npc') {
                    quest.giver = value;
                } else if (key === '目标' || key === 'objectives') {
                    currentSection = 'objectives';
                    if (value) {
                        // 单行目标
                        quest.objectives.push({ description: value, completed: false });
                    }
                } else if (key === '奖励' || key === 'rewards') {
                    currentSection = 'rewards';
                    if (value) {
                        // 解析奖励（如 "100金币" 或 "{gold: 100}"）
                        var rewardMatch = value.match(/(\d+)\s*(金币|gold)/i);
                        if (rewardMatch) {
                            quest.rewards.gold = Number(rewardMatch[1]);
                        }
                        var expMatch = value.match(/(\d+)\s*(经验|exp)/i);
                        if (expMatch) {
                            quest.rewards.exp = Number(expMatch[1]);
                        }
                    }
                }
            } else if (line.match(/^[-*•]\s+/)) {
                // 列表项（- / * / • 开头）
                var itemText = line.replace(/^[-*•]\s+/, '').trim();
                if (currentSection === 'objectives') {
                    // 检查是否已完成（如 "[x] 收集灰烬狼皮"）
                    var completed = /^\[x\]/i.test(itemText);
                    itemText = itemText.replace(/^\[x\]\s*/i, '').trim();
                    quest.objectives.push({ description: itemText, completed: completed });
                } else if (currentSection === 'rewards') {
                    // 解析奖励项
                    var rewardMatch = itemText.match(/(\d+)\s*(金币|gold)/i);
                    if (rewardMatch) {
                        quest.rewards.gold = Number(rewardMatch[1]);
                    }
                    var expMatch = itemText.match(/(\d+)\s*(经验|exp)/i);
                    if (expMatch) {
                        quest.rewards.exp = Number(expMatch[1]);
                    }
                }
            }
        }
        
        return quest.name ? quest : null;
    }

    // ==================== 通用 XML 块提取 ====================

    /**
     * 鲁棒提取 XML 标签块（容忍大小写、标签内外空格/下划线）
     * @returns {{found:boolean, closed:boolean, content:string}}
     */
    function extractXmlBlock(text, tagName) {
        if (!text || !tagName) return { found: false, closed: false, content: '' };
        var chars = String(tagName).split('').map(function (ch) {
            var lower = ch.toLowerCase(), upper = ch.toUpperCase();
            if (lower === upper) return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return '[' + lower + upper + ']';
        });
        var tagPattern = chars.join('[\\s_]*');
        var openRe = new RegExp('<[\\s_]*' + tagPattern + '[\\s_]*>');
        var closeRe = new RegExp('<[\\s_]*\\/[\\s_]*' + tagPattern + '[\\s_]*>');

        var openMatch = openRe.exec(text);
        if (!openMatch) return { found: false, closed: false, content: '' };

        var contentStart = openMatch.index + openMatch[0].length;
        var closeMatch = closeRe.exec(text.substring(contentStart));
        if (!closeMatch) {
            return { found: true, closed: false, content: '' };
        }
        return { found: true, closed: true, content: text.substring(contentStart, contentStart + closeMatch.index).trim() };
    }

    // ==================== 命令解析（移植自墨色江湖） ====================

    var COMMAND_ACTION_ALIASES = {
        'add': 'add', '增加': 'add', '新增': 'add', '累加': 'add', '加上': 'add',
        'set': 'set', '设置': 'set', '设为': 'set', '写入': 'set',
        'push': 'push', '追加': 'push', '插入': 'push',
        'delete': 'delete', '删除': 'delete', '移除': 'delete',
        'sub': 'sub', '扣减': 'sub', '减少': 'sub'
    };

    function 归一化命令动作(raw) {
        var key = (raw || '').trim().toLowerCase();
        return COMMAND_ACTION_ALIASES[key] || (COMMAND_ACTION_ALIASES[(raw || '').trim()]) || null;
    }

    /** 字符串感知地移除 // 注释 */
    function 移除注释(input) {
        var lines = (input || '').replace(/\r\n/g, '\n').split('\n');
        return lines.map(function (line) {
            var inString = false, escaped = false;
            for (var i = 0; i < line.length; i++) {
                var ch = line[i];
                if (inString) {
                    if (escaped) { escaped = false; continue; }
                    if (ch === '\\') { escaped = true; continue; }
                    if (ch === '"') inString = false;
                    continue;
                }
                if (ch === '"') { inString = true; continue; }
                if (ch === '/' && line[i + 1] === '/') return line.slice(0, i).trimEnd();
            }
            return line;
        }).join('\n');
    }

    /**
     * 白名单算术求值：只处理 `:` 或 `=`/`＝`/`：` 后、以数字开头数字结尾、
     * 仅含数字与四则运算符的表达式；含引号的行整体跳过（防误伤字符串值）。
     */
    function 求值算术表达式(input) {
        var lines = (input || '').split('\n');
        var evaluated = lines.map(function (line) {
            var quoteCount = (line.match(/"/g) || []).length;
            if (quoteCount % 2 === 1) return line; // 字符串未闭合，跳过
            return line.replace(
                /((?::|=|＝|：)\s*)([0-9][0-9+\-*/ ]+[0-9])\s*(?=[,}\]]|$)/,
                function (match, prefix, expr) {
                    var trimmed = expr.trim();
                    if (!/[+\-*/]/.test(trimmed)) return prefix + trimmed;
                    if (!/^[0-9+\-*/ .()]+$/.test(trimmed)) return prefix + trimmed;
                    try {
                        var result = new Function('return (' + trimmed + ')')();
                        if (Number.isFinite(result)) return prefix + result;
                    } catch (e) { /* 保原文 */ }
                    return prefix + trimmed;
                }
            );
        });
        return evaluated.join('\n');
    }

    function 预处理命令文本(input) {
        return 求值算术表达式(移除注释(input));
    }

    function 清理命令尾部分隔符(text) {
        var trimmed = (text || '').trim();
        var depth = 0, inString = false, escaped = false;
        var cutIndex = trimmed.length;
        for (var i = 0; i < trimmed.length; i++) {
            var ch = trimmed[i];
            if (inString) {
                if (escaped) { escaped = false; continue; }
                if (ch === '\\') { escaped = true; continue; }
                if (ch === '"') inString = false;
                continue;
            }
            if (ch === '"') { inString = true; continue; }
            if (ch === '{' || ch === '[') depth++;
            else if (ch === '}' || ch === ']') depth--;
            else if (depth === 0 && '；;，,'.indexOf(ch) !== -1) {
                cutIndex = i;
                break;
            }
        }
        return trimmed.slice(0, cutIndex).trim();
    }

    /** 值解析：字符串/布尔/null/数字/JSON，兜底返回原始文本 */
    function 解析命令值(rawText) {
        var text = (rawText || '').trim();
        if (!text) return null;
        if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith('「') && text.endsWith('」'))) {
            return text.slice(1, -1);
        }
        if (text === 'true') return true;
        if (text === 'false') return false;
        if (text === 'null' || text === '无' || text === '空') return null;
        if (/^[+\-]?\d+(\.\d+)?$/.test(text)) return Number(text);

        if (text.startsWith('{') || text.startsWith('[')) {
            var parsed = safeParseJson(text);
            if (parsed !== null) return parsed;
            // 剥掉外层括号重包一层再试
            var inner = text.replace(/^[{[]/, '').replace(/[}\]]$/, '').trim();
            var reparsed = safeParseJson('{ ' + inner + ' }');
            if (reparsed !== null) return reparsed;
        }
        return text;
    }

    function safeParseJson(text) {
        try { return JSON.parse(text); } catch (e) { /* fallthrough */ }
        if (typeof window !== 'undefined' && window.safeParseLLMJson) {
            return window.safeParseLLMJson(text);
        }
        return null;
    }

    /** 括号平衡续行：从 startIndex 行起吞并后续行直到括号闭合 */
    function 收集多行命令值(lines, startIndex) {
        var depth = 0, inString = false, escaped = false;
        for (var i = startIndex; i < lines.length; i++) {
            var line = lines[i];
            for (var j = 0; j < line.length; j++) {
                var ch = line[j];
                if (inString) {
                    if (escaped) { escaped = false; continue; }
                    if (ch === '\\') { escaped = true; continue; }
                    if (ch === '"') inString = false;
                    continue;
                }
                if (ch === '"') { inString = true; continue; }
                if (ch === '{' || ch === '[') depth++;
                else if (ch === '}' || ch === ']') depth--;
            }
            if (depth <= 0) return { value: lines.slice(startIndex, i + 1).join('\n'), next: i + 1 };
        }
        return { value: lines.slice(startIndex).join('\n'), next: lines.length };
    }

    /**
     * 标准化 JSON 命令对象：action/key、op/path、对象映射三种写法。
     */
    function 标准化单个命令(obj) {
        if (!obj || typeof obj !== 'object') return null;
        var action = obj.action || obj.op || obj.type;
        var key = obj.key || obj.path || obj.target;
        if (typeof action === 'string' && typeof key === 'string') {
            var normalized = 归一化命令动作(action);
            if (!normalized) return null;
            if (normalized === 'sub') return { action: 'add', key: key.trim(), value: -Number(obj.value) || 0 };
            if (normalized === 'delete') return { action: 'delete', key: key.trim(), value: null };
            return { action: normalized, key: key.trim(), value: obj.value };
        }
        return null;
    }

    function 标准化命令对象列表(list) {
        var commands = [];
        (Array.isArray(list) ? list : []).forEach(function (obj) {
            var cmd = 标准化单个命令(obj);
            if (cmd) commands.push(cmd);
        });
        return commands;
    }

    /** 对象映射写法：{"set":{"金币":100},"push":{"背包":{...}}} */
    function 解析对象映射命令(obj) {
        var commands = [];
        Object.keys(obj).forEach(function (action) {
            var normalized = 归一化命令动作(action);
            if (!normalized) return;
            var payload = obj[action];
            if (!payload || typeof payload !== 'object') return;
            if (normalized === 'delete') {
                Object.keys(payload).forEach(function (key) {
                    commands.push({ action: 'delete', key: key.trim(), value: null });
                });
                return;
            }
            Object.keys(payload).forEach(function (key) {
                var value = payload[key];
                if (Array.isArray(value)) {
                    // {"push":{"背包":[item1, item2]}}：数组逐元素展开
                    value.forEach(function (element) {
                        commands.push({ action: normalized, key: key.trim(), value: element });
                    });
                    return;
                }
                if (normalized === 'sub') {
                    commands.push({ action: 'add', key: key.trim(), value: -Number(value) || 0 });
                } else {
                    commands.push({ action: normalized, key: key.trim(), value: value });
                }
            });
        });
        return commands;
    }

    /** 单行文本的括号净增量（字符串感知）：`{`/`[` 计 +1，`}`/`]` 计 -1 */
    function 括号增量(text) {
        var depth = 0, inString = false, escaped = false;
        for (var k = 0; k < text.length; k++) {
            var ch = text[k];
            if (inString) {
                if (escaped) { escaped = false; continue; }
                if (ch === '\\') { escaped = true; continue; }
                if (ch === '"') inString = false;
                continue;
            }
            if (ch === '"') { inString = true; continue; }
            if (ch === '{' || ch === '[') depth++;
            else if (ch === '}' || ch === ']') depth--;
        }
        return depth;
    }

    var ACTION_PREFIXES = ['增加', '新增', '累加', '加上', '设置', '设为', '写入', '追加', '插入', '删除', '移除', '扣减', '减少'];

    /** 从粘连 token 中拆出动作前缀：'增加金币' → {action:'add', rest:'金币'} */
    function 拆动作前缀(token) {
        for (var p = 0; p < ACTION_PREFIXES.length; p++) {
            if (token.indexOf(ACTION_PREFIXES[p]) === 0 && token.length > ACTION_PREFIXES[p].length) {
                var action = 归一化命令动作(ACTION_PREFIXES[p]);
                if (action) return { action: action, rest: token.slice(ACTION_PREFIXES[p].length).trim() };
            }
        }
        return null;
    }

    /**
     * 行式命令解析：`add 金币 = 100` / `set 时间.日 : 13` / 中文动作别名 / 粘连形态「增加金币 = 30」。
     */
    function 解析行式命令(block) {
        var commands = [];
        var lines = (block || '').replace(/\r\n/g, '\n').split('\n');
        var i = 0;
        while (i < lines.length) {
            var rawLine = lines[i];
            var line = rawLine.trim();
            i += 1;
            if (!line) continue;

            // 剥前缀修饰：[#3] / #3 / [3] / - / * / • / 1. / 1、
            line = line.replace(/^(?:\[#\d+\]|#\d+|\[\d+\]|[-*•]|\d+[.、])\s*/, '');
            if (!line || /^(无|none|\/|#)/i.test(line)) continue;

            var action = null, key = '', valueText = '';
            var match = line.match(/^([^\s=＝:：]+)\s+([^\s=＝:：]+)(?:\s*(?:=|＝|:|：|=>)\s*|\s+)?([\s\S]*)$/);
            if (match) {
                action = 归一化命令动作(match[1]);
                key = match[2].trim();
                valueText = (match[3] || '').trim();
                if (!action) {
                    var split = 拆动作前缀(match[1]);
                    if (split) {
                        action = split.action;
                        key = (split.rest + ' ' + key).trim();
                    }
                }
            } else {
                // 粘连形态：动作词与键无空格分隔（'增加金币 = 30'）
                var m2 = line.match(/^([^\s=＝:：]+)(?:\s*(?:=|＝|:|：|=>)\s*|\s+)([\s\S]*)$/);
                if (m2) {
                    var split2 = 拆动作前缀(m2[1]);
                    if (split2) {
                        action = split2.action;
                        key = split2.rest;
                        valueText = (m2[2] || '').trim();
                    }
                }
            }
            if (!action || !key) continue;

            // 多行值：以 {/[ 开头且未闭合时吞并后续行
            if (valueText && /^[{[]/.test(valueText)) {
                var depth = 括号增量(valueText);
                if (depth > 0) {
                    var j = i;
                    while (depth > 0 && j < lines.length) {
                        valueText += '\n' + lines[j];
                        depth += 括号增量(lines[j]);
                        j += 1;
                    }
                    i = j;
                }
            }

            if (action === 'delete') {
                commands.push({ action: 'delete', key: key, value: null });
                continue;
            }

            var value = 解析命令值(清理命令尾部分隔符(valueText));
            if (action === 'sub') {
                commands.push({ action: 'add', key: key, value: -Math.abs(Number(value) || 0) });
            } else {
                commands.push({ action: action, key: key, value: value });
            }
        }
        return commands;
    }

    /**
     * 命令块总入口：先试 JSON（数组/tavern_commands/对象映射），失败再走行式。
     * @returns {Array<{action,key,value}>}
     */
    function 解析命令块(commandBlock) {
        var block = (commandBlock || '').trim();
        if (!block) return [];
        // 剥 markdown 围栏与残留标签
        block = block.replace(/```(?:json)?/gi, '').replace(/<\/?[\s_]*(?:命令|[Cc][Oo][Mm][Mm][Aa][Nn][Dd])[\s_]*>/g, '').trim();
        if (/^(无|none)$/i.test(block)) return [];

        var cleaned = 预处理命令文本(block);

        // JSON 路径
        var json = safeParseJson(cleaned);
        if (json !== null) {
            if (Array.isArray(json)) {
                var list = 标准化命令对象列表(json);
                if (list.length) return list;
            } else if (json && typeof json === 'object') {
                if (Array.isArray(json.tavern_commands)) {
                    var cmds = 标准化命令对象列表(json.tavern_commands);
                    if (cmds.length) return cmds;
                }
                var mapped = 解析对象映射命令(json);
                if (mapped.length) return mapped;
            }
        }

        // 行式路径
        return 解析行式命令(cleaned);
    }

    // ==================== 总入口 ====================

    function run(rawText) {
        var cleaned = removeThinkingContent(rawText || '');

        // 命令区：优先 <命令> 标签，缺失时兜底从全文扫描行式命令
        var commandBlock = extractXmlBlock(cleaned, '命令');
        var commandText = commandBlock.found && commandBlock.closed ? commandBlock.content : '';
        var fallbackScan = false;
        if (!commandText) {
            // 兜底：仅当全文存在明显的行式命令时才扫描（避免误吞正文）
            var scanMatch = cleaned.match(/^\s*(?:增加|新增|设置|设为|写入|追加|插入|删除|扣减|减少|add|set|push|delete|sub)\s+[^\s=＝:：]+\s*(?:=|＝|:|：|=>)\s*\S+/mi);
            if (scanMatch) {
                var openIdx = cleaned.lastIndexOf('命令');
                var head = cleaned.indexOf(scanMatch[0]);
                commandText = head > -1 ? cleaned.substring(head) : scanMatch[0];
                fallbackScan = true;
            }
        }

        var commands = [];
        var parseError = '';
        try {
            commands = 解析命令块(commandText);
        } catch (e) {
            parseError = e && e.message ? e.message : String(e);
            console.error('[ResponseParser] 命令解析异常:', e);
        }

        // 提取任务块
        var questBlocks = extractQuestBlocks(cleaned);
        var quests = [];
        for (var i = 0; i < questBlocks.length; i++) {
            var block = questBlocks[i];
            var parsed = parseQuestContent(block.content);
            if (parsed) {
                quests.push({
                    type: block.type,  // 'new' / 'complete' / 'fail'
                    quest: parsed
                });
            }
        }

        return {
            raw: rawText,
            cleanedText: cleaned,
            mainText: extractMainText(cleaned),
            summaries: extractSummaries(cleaned),
            commandBlockFound: commandBlock.found,
            commandBlockClosed: commandBlock.closed,
            commands: commands,
            quests: quests,  // 新增：解析出的任务列表
            parseError: parseError,
            parseIncomplete: (commandBlock.found && !commandBlock.closed) || Boolean(parseError)
        };
    }

    return {
        removeThinkingContent: removeThinkingContent,
        extractMainText: extractMainText,
        extractSummaries: extractSummaries,
        extractXmlBlock: extractXmlBlock,
        extractQuestBlocks: extractQuestBlocks,
        parseQuestContent: parseQuestContent,
        解析命令块: 解析命令块,
        run: run
    };
})();

if (typeof window !== 'undefined') {
    window.responseParser = responseParser;
}
