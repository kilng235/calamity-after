/**
 * prompt-builder.js - Prompt 编排（灾厄之后版）
 *
 * 自包含实现，无姬侠传依赖（不引用 PROMPT_CORE_* / templateEngine / tokenUtils / customWorldbook）。
 * 消费 calamity-data.js 世界书数据 + worldbook-engine.js 关键词注入，
 * 输出可直接交给 api-service.sendMessages 的 { messages: [...] }。
 *
 * 消息结构（启用 ST 预设时）：
 *   ① 预设 before 段（worldInfo marker 之前的提示词，宏已执行）
 *   ② system  （游戏系统提示词，注入在预设 worldInfo marker 位置，落在包装标签内）
 *   ③ 预设 before 段剩余部分
 *   ④ user    （[Start a new chat]，仅当存在上一次回复）
 *   ⑤ assistant（上一次 AI 回复，仅当存在）
 *   ⑥ user    （本次用户输入，即 ST 的 chatHistory 末端）
 *   ⑦ 预设 after 段（chatHistory 之后的提示词，Post-History Instructions）
 *   ⑧ 预设 prefill 段（assistant 预填充，消息链最末，还原 ST 预填充语义）
 *
 * 未启用预设时：system（游戏系统提示词）+ ④⑤⑥ 简单三段式。
 * 预设无 worldInfo marker 时：system 退回消息链首位，其余同上。
 */

var promptBuilder = (function() {

    // ST 预设注入：保存当前激活的预设（启用后按消息级注入，见 buildMessages）
    var _stPreset = null;

    function _wb(cat, key) {
        return (window.calamityData && window.calamityData.get(cat, key)) || '';
    }

    /**
     * 展开 {{roll:dN}} 宏为实时骰值（仅用于骰子池条目，每轮构建时重新掷出）
     */
    function _expandDiceMacros(text) {
        if (!text || text.indexOf('{{roll:') === -1) return text;
        return text.replace(/\{\{roll:d(\d+)\}\}/g, function(_, sidesStr) {
            var sides = parseInt(sidesStr, 10) || 20;
            return String(1 + Math.floor(Math.random() * sides));
        });
    }

    /**
     * 骰子池块：每轮注入实时掷出的骰值（反作弊设计：模型依序取用，不得编造）
     */
    function _buildDicePool() {
        var pool = _wb('系统', '骰子池');
        if (!pool) return '';
        return '# 骰子池（本轮实时掷出，按序取用）\n' + _expandDiceMacros(pool);
    }

    function _fmtAttr(attributes) {
        var names = ['力量', '敏捷', '体质', '感知', '智力', '魅力'];
        return names.map(function(n) {
            var v = (attributes && attributes[n]) || 10;
            var mod = Math.floor((v - 10) / 2);
            var modStr = (mod >= 0 ? '+' : '') + mod;
            return n + ' ' + v + ' (' + modStr + ')';
        }).join('，');
    }

    function _fmtEquipment(equipment) {
        var slotNames = {
            mainHand: '主手', offHand: '副手', body: '身体', head: '头部',
            hands: '手部', legs: '腿部', feet: '脚部', shoulders: '肩部',
            accessory1: '饰品1', accessory2: '饰品2'
        };
        var parts = [];
        Object.keys(slotNames).forEach(function(slot) {
            var item = equipment && equipment[slot];
            if (item && item.name) {
                var extra = item.durability !== undefined ? '（耐久 ' + item.durability + '）' : '';
                parts.push(slotNames[slot] + '：' + item.name + extra);
            }
        });
        return parts.length ? parts.join('；') : '无';
    }

    function _fmtInventory(inventory) {
        if (!inventory || !inventory.length) return '空';
        return inventory.map(function(item) {
            var n = item.name || item.id || '未知物品';
            var count = item.count !== undefined ? ' ×' + item.count : '';
            return n + count;
        }).join('，');
    }

    function _fmtRelationships(relationships) {
        if (!relationships || !Object.keys(relationships).length) return '无';
        return Object.keys(relationships).map(function(name) {
            var r = relationships[name] || {};
            var parts = [];
            if (r.好感度 !== undefined) parts.push('好感 ' + r.好感度);
            if (r.关系状态) parts.push(r.关系状态);
            return name + '（' + (parts.join('，') || '中立') + '）';
        }).join('；');
    }

    /**
     * 角色当前状态块（来自 gameData）
     */
    function _buildStateBlock(gd) {
        var c = gd.character || {};
        var t = gd.gameTime || {};
        var p = gd.progress || {};
        var lines = [];
        lines.push('# 当前状态');
        lines.push('## 角色');
        lines.push('姓名：' + (c.name || '旅行者') + '　种族：' + (c.race || '人类')
            + '　性别：' + (c.gender || '男') + '　年龄：' + (c.age || 25));
        lines.push('等级：' + (c.level || 1) + '　经验：' + (c.exp || 0) + '/' + (c.expToNextLevel || 100)
            + '　熟练加值：+' + (c.proficiencyBonus || 2) + '　AC：' + (c.ac || 10));
        lines.push('HP：' + (gd.hp ? gd.hp.current : '?') + '/' + (gd.hp ? gd.hp.max : '?')
            + '　命运点：' + (gd.fatePoints ? gd.fatePoints.current : 0) + '/' + (gd.fatePoints ? gd.fatePoints.max : 1)
            + '　金币：' + (gd.currency ? gd.currency.gold : 0));
        lines.push('## 属性');
        lines.push(_fmtAttr(gd.attributes));
        if (gd.backgrounds && gd.backgrounds.length) {
            lines.push('## 背景特长');
            lines.push(gd.backgrounds.join('，'));
        }
        lines.push('## 装备');
        lines.push(_fmtEquipment(gd.equipment));
        lines.push('## 背包');
        lines.push(_fmtInventory(gd.inventory));
        // 负重（引擎派生：command-processor.computeEncumbrance；超重由引擎自动落地状态，AI 按叙事规则演出后果）
        if (typeof window !== 'undefined' && window.commandProcessor && window.commandProcessor.computeEncumbrance) {
            var enc = window.commandProcessor.computeEncumbrance(gd);
            lines.push('## 负重');
            lines.push('当前总重：' + enc.total + ' / ' + enc.cap + ' 公斤（上限 10+力量×2）'
                + (enc.extreme ? '——极端超重！行动受限（行走困难/无法奔跑），力量与敏捷检定劣势'
                   : enc.over ? '——已超重！力量相关检定劣势，应尽快卸载物品'
                   : ''));
        }
        lines.push('## 位置与时间');
        lines.push('当前位置：' + (p.currentLocation || '未知') + '　灾厄纪年：' + (t.year || 300) + '年'
            + (t.month || '') + '月' + (t.day || '') + '日 ' + (t.hour || '') + ':' + (String(t.minute || 0).padStart(2, '0'))
            + '（' + (t.season || '') + '）');
        if (p.completedQuests && p.completedQuests.length) {
            lines.push('已完成任务：' + p.completedQuests.join('，'));
        }
        lines.push('## 关系');
        lines.push(_fmtRelationships(gd.relationships));
        return lines.join('\n');
    }

    /**
     * 世界观核心（灾厄概述 + 文风指引 + 扮演准则）
     */
    function _buildWorldview() {
        var parts = [];
        var overview = _wb('世界观', '灾厄概述');
        var style = _wb('世界观', '文风指引');
        var role = _wb('扮演准则', '扮演准则');
        if (overview) parts.push('# 世界观：灾厄概述\n' + overview);
        if (style) parts.push('# 文风指引\n' + style);
        if (role) parts.push('# 扮演准则\n' + role);
        return parts.join('\n\n');
    }

    /**
     * 输出规范（输出格式 + 结算协议 + 数据同步协议）
     */
    function _buildOutputRules() {
        var parts = [];
        var format = _wb('系统', '输出格式');
        var settle = _wb('系统', '结算协议');
        var sync = _wb('系统', '数据同步协议');
        if (format) parts.push('# 输出格式（强制遵守）\n' + format);
        if (settle) parts.push('# 结算协议（每轮思考流程）\n' + settle);
        if (sync) parts.push('# 数据同步协议（命令可写白名单）\n' + sync);
        return parts.join('\n\n');
    }

    /**
     * 检定规则（通用检定）
     */
    function _buildCheckRules() {
        var check = _wb('检定', '通用检定');
        return check ? '# 检定规则\n' + check : '';
    }

    /**
     * 世界书注入块（关键词匹配到的条目）
     */
    function _buildWorldbookBlocks(npcBlocks, wbBlocks) {
        var parts = [];
        if (npcBlocks && npcBlocks.length) {
            parts.push('# 在场 NPC');
            npcBlocks.forEach(function(npc) {
                parts.push('## ' + npc.name + '\n' + npc.content);
            });
        }
        if (wbBlocks && wbBlocks.length) {
            parts.push('# 相关世界书条目');
            wbBlocks.forEach(function(b) {
                parts.push('## [' + b.category + '] ' + b.key + '\n' + b.content);
            });
        }
        return parts.join('\n\n');
    }

    /**
     * 行动指导（按行动关键词匹配到的系统规则）
     */
    function _buildActionGuide(actionGuide) {
        return actionGuide ? '# 行动规则（本次行动相关）\n' + actionGuide : '';
    }

    /**
     * 开局数据块（如果已开局）
     */
    function _buildOpeningBlock() {
        if (!window.calamityData || !window.calamityData.hasOpening()) {
            return '';
        }
        var opening = window.calamityData.getOpening();
        if (!opening || !opening.content) return '';

        var parts = [];
        parts.push('# 开局数据');

        var c = opening.content;
        if (c.time) {
            parts.push('## 当前时间\n' + c.time.display);
        }
        if (c.location) {
            parts.push('## 当前位置\n' + c.location.full);
        }
        if (c.character) {
            var char = c.character;
            parts.push('## 角色初始状态');
            parts.push('姓名：' + char.name + ' 种族：' + char.race + ' 身份：' + char.identity);
            parts.push('等级：' + char.level + ' HP：' + char.hp + '/' + char.hpMax + ' MP：' + char.mp + '/' + char.mpMax);
            parts.push('金币：' + char.gold + ' 命运点：' + char.fatePoint + ' AC：' + char.ac);
        }
        if (c.initialQuest) {
            var q = c.initialQuest;
            parts.push('## 初始任务');
            parts.push('任务名：' + q.name);
            parts.push('类型：' + q.type + ' 发布者：' + q.issuer);
            parts.push('目标区域：' + q.targetArea);
            parts.push('描述：' + q.description);
            parts.push('目标：' + q.objectives.map(o => o.target + ' ×' + o.required).join('、'));
            parts.push('时限：' + q.deadline.display);
            parts.push('奖励：' + q.rewards.gold + '金 + 声望' + q.rewards.reputation.amount);
            parts.push('**该任务已在任务面板登记为「进行中」，禁止再输出 [新任务] 块重复上报；目标进度随剧情推进自动同步，接取/交付只需正文呈现**');
        }
        if (c.mainPlotHook) {
            var hook = c.mainPlotHook;
            parts.push('## 主线钩子（未触发）');
            parts.push(hook.name + '：' + hook.description);
            parts.push('触发条件：' + hook.triggerCondition);
        }
        if (c.openingNarrative) {
            parts.push('## 开局叙事');
            parts.push(c.openingNarrative);
        }

        return parts.join('\n');
    }

    /**
     * 构建完整 system 消息
     */
    function _buildSystem(gd, npcBlocks, wbBlocks, actionGuide) {
        var sections = [];
        sections.push(_buildStateBlock(gd));

        // 身份条目（身份体系脚本按当前存档身份接入：领域检定优势 + 专业叙事视角）
        if (typeof window !== 'undefined' && window.identitySystem) {
            var identityBlock = window.identitySystem.buildBlock();
            if (identityBlock) sections.push(identityBlock);
        }

        // 当前任务数据（让 LLM 知道玩家当前任务）
        var questBlock = (window.worldbookEngine && window.worldbookEngine.buildQuestBlock) 
            ? window.worldbookEngine.buildQuestBlock(gd) 
            : '';
        if (questBlock) sections.push(questBlock);
        
        sections.push(_buildWorldview());
        sections.push(_buildOutputRules());
        sections.push(_buildCheckRules());
        var dicePool = _buildDicePool();
        if (dicePool) sections.push(dicePool);
        var opening = _buildOpeningBlock();
        if (opening) sections.push(opening);
        var wb = _buildWorldbookBlocks(npcBlocks, wbBlocks);
        if (wb) sections.push(wb);
        var ag = _buildActionGuide(actionGuide);
        if (ag) sections.push(ag);
        return sections.join('\n\n');
    }

    /**
     * 构建用户消息（本次输入 + 行动指导）
     */
    function _buildUser(userMessage, actionGuide) {
        var lines = [];
        lines.push('# 玩家行动');
        lines.push(userMessage || '');
        if (actionGuide) {
            lines.push('');
            lines.push('# 行动规则参考');
            lines.push(actionGuide);
        }
        return lines.join('\n');
    }

    /**
     * 主入口
     * @param {Object} params
     * @param {string} params.userMessage - 本次用户输入
     * @param {Object} params.gameData - 游戏状态
     * @param {string} [params.lastAssistantReply] - 上一次 AI 回复
     * @param {Array<{role,content}>} [params.history] - 滚动对话历史（多轮上下文）
     * @returns {{messages: Array<{role, content}>}}
     */
    function buildMessages(params) {
        params = params || {};
        var userMessage = params.userMessage || '';
        var gd = params.gameData || {};
        var lastAssistantReply = params.lastAssistantReply || '';
        var history = Array.isArray(params.history) ? params.history : [];

        // 世界书触发（无显式上轮回复时，回退到历史中最近的 assistant 消息）
        var scanText = lastAssistantReply;
        if (!scanText) {
            for (var hi = history.length - 1; hi >= 0; hi--) {
                if (history[hi] && history[hi].role === 'assistant' && history[hi].content) {
                    scanText = String(history[hi].content);
                    break;
                }
            }
        }
        var blocks = (window.worldbookEngine && window.worldbookEngine.buildWorldbookBlocks(userMessage, scanText)) || { npcBlocks: [], wbBlocks: [], actionGuide: null };
        var npcBlocks = blocks.npcBlocks;
        var wbBlocks = blocks.wbBlocks;
        var actionGuide = blocks.actionGuide;

        var systemContent = _buildSystem(gd, npcBlocks, wbBlocks, actionGuide);
        var userContent = _buildUser(userMessage, actionGuide);

        var messages = [];

        // ST 预设消息链（marker 感知，还原 ST 结构语义）：
        //   游戏系统提示词 → 注入到预设的 worldInfo marker 位置（落在 <WorldContext> 等包装标签内）；
        //   预设无该 marker 时退回消息链首位
        //   before   → worldInfo marker 之前的预设提示词
        //   历史+本次输入 → before 之后（即 ST 的 chatHistory 位置）
        //   after    → 历史与输入之后（Post-History Instructions，靠近回复端）
        //   prefill  → assistant 预填充，整个消息链最末（模型接着它续写）
        var presetChain = null;
        if (_stPreset && Array.isArray(_stPreset.prompts) && _stPreset.prompts.length > 0) {
            presetChain = _buildSTPresetMessages(userMessage, gd, systemContent);
        }
        if (!presetChain || !presetChain.worldbookInjected) {
            messages.push({ role: 'system', content: systemContent });
        }
        var ci;
        if (presetChain) {
            for (ci = 0; ci < presetChain.before.length; ci++) {
                messages.push(presetChain.before[ci]);
            }
        }

        // 对话历史（滚动窗口，来自本地 chat context；置于 before 段之后、本次输入之前）
        for (ci = 0; ci < history.length; ci++) {
            var hmsg = history[ci];
            if (hmsg && (hmsg.role === 'user' || hmsg.role === 'assistant') && hmsg.content) {
                messages.push({ role: hmsg.role, content: String(hmsg.content) });
            }
        }

        if (lastAssistantReply) {
            messages.push({ role: 'user', content: '[Start a new chat]' });
            messages.push({ role: 'assistant', content: lastAssistantReply });
        }
        messages.push({ role: 'user', content: userContent });

        if (presetChain) {
            for (ci = 0; ci < presetChain.after.length; ci++) {
                messages.push(presetChain.after[ci]);
            }
            for (ci = 0; ci < presetChain.prefill.length; ci++) {
                messages.push(presetChain.prefill[ci]);
            }
        }

        return { messages: messages };
    }

    /**
     * 构建当前 ST 预设的消息链（宏引擎执行后的最终形态）
     * @param {string} userMessage   本次用户输入（供 {{lastUserMessage}} 等输入宏使用）
     * @param {Object} gd            游戏状态（取玩家名）
     * @param {string} worldbookText 游戏系统提示词（注入到预设的 worldInfo marker 位置）
     * @returns {{before:Array, after:Array, prefill:Array, worldbookInjected:boolean}}
     */
    function _buildSTPresetMessages(userMessage, gd, worldbookText) {
        var empty = { before: [], after: [], prefill: [], worldbookInjected: false };
        if (!_stPreset) return empty;
        var importer = (typeof window !== 'undefined' && window.presetImporter) ? window.presetImporter : null;
        if (!importer || typeof importer.构建预设消息链 !== 'function') return empty;
        var c = (gd && gd.character) || {};
        var chain = importer.构建预设消息链(_stPreset, {
            userName: c.name || '旅行者',
            charName: '旁白',
            lastUserMessage: userMessage || '',
            worldbookText: worldbookText || ''
        });
        return (chain && Array.isArray(chain.before)) ? chain : empty;
    }

    /**
     * 设置当前激活的 ST 预设
     * @param {Object|null} preset  规范化后的预设对象，传 null 清除
     */
    function setSTPreset(preset) {
        _stPreset = preset || null;
    }

    function getSTPreset() {
        return _stPreset;
    }

    return {
        buildMessages: buildMessages,
        setSTPreset: setSTPreset,
        getSTPreset: getSTPreset
    };
})();

if (typeof window !== 'undefined') {
    window.promptBuilder = promptBuilder;
}
