/**
 * worldbook-engine.js - 世界书触发引擎（灾厄之后版）
 *
 * 消费 calamity-data.js 中的世界书数据，按关键词触发注入：
 * - matchNPCs：NPC 条目（伊莎·圣焰 / 凯尔·拾灰者 / 尾铃 ...）
 * - matchWorldbook：地理 / 势力 / 生物 / 种族 / 武器 / 护甲 / 装备 / 检定 / 系统 条目
 * - matchActionGuide：按行动关键词返回对应系统规则（战斗 / 检定 / 战利品 / 锻造 ...）
 */

var worldbookEngine = (function() {

    // 从条目名提取可匹配关键词（去掉分类前缀与常见后缀，按分隔符拆分）
    function _keywords(key) {
        var cleaned = String(key)
            .replace(/^(区域|系统|时间线|装备|检定|生物|种族|武器|护甲|势力|地理|世界观|NPC)[·\s]*/, '')
            .replace(/总纲$/, '')
            .replace(/规则$/, '')
            .replace(/系统$/, '')
            .replace(/检定$/, '')
            .replace(/生成规则$/, '');
        var parts = cleaned.split(/[·与和、,，\s]+/);
        return parts.filter(function(p) { return p.length >= 2; });
    }

    // 排除不按关键词触发的条目
    function _isSkippable(key) {
        return key === '生成规则' || key === '总纲' || key === '开局大纲' || key === '开局生成规则';
    }

    /**
     * 在指定分类内做关键词匹配
     * @param {string} userInput - 本次用户输入
     * @param {string} lastAIReply - 上一次 AI 完整回复
     * @param {string[]} categories - 要扫描的分类
     * @returns {Array<{category, key, content}>}
     */
    function match(userInput, lastAIReply, categories) {
        if (!window.calamityData || !window.calamityData.isRegistered()) return [];
        var searchText = (userInput || '') + (lastAIReply || '');
        if (!searchText) return [];
        var result = [];
        var seen = {};

        categories.forEach(function(cat) {
            var entries = window.calamityData.getCategory(cat);
            Object.keys(entries).forEach(function(key) {
                if (_isSkippable(key)) return;
                var kws = _keywords(key);
                var hit = kws.some(function(kw) { return searchText.indexOf(kw) !== -1; });
                if (hit && !seen[cat + '/' + key]) {
                    seen[cat + '/' + key] = true;
                    result.push({ category: cat, key: key, content: entries[key] });
                }
            });
        });

        return result;
    }

    /**
     * 匹配 NPC 条目
     * @returns {Array<{name, content}>} 兼容旧接口：name 为条目名
     */
    function matchNPCs(userInput, lastAIReply) {
        return match(userInput, lastAIReply, ['NPC']).map(function(item) {
            return { name: item.key, content: item.content };
        });
    }

    /**
     * 通用世界书匹配（Prompt 注入用）
     */
    function matchWorldbook(userInput, lastAIReply) {
        return match(userInput, lastAIReply, ['NPC', '地理', '势力', '生物', '种族', '武器', '护甲', '装备', '检定']);
    }

    /**
     * 按行动关键词返回对应系统规则内容（战斗 / 检定 / 战利品 / 锻造 / 炼金 / 任务 / 关系）
     * @returns {string|null} 匹配到的规则内容
     */
    function matchActionGuide(userInput) {
        if (!userInput || !window.calamityData) return null;
        var cd = window.calamityData;
        var text = userInput;

        // 战斗相关
        if (/战斗|攻击|砍|劈|射击|射箭|施法|法术|防御|闪避|先攻|回合|杀/.test(text)) {
            var combat = cd.get('系统', '战斗规则');
            var combatCheck = cd.get('检定', '战斗检定');
            return [combatCheck, combat].filter(Boolean).join('\n\n') || null;
        }
        // 检定相关
        if (/检定|侦查|搜索|观察|聆听|潜行|说服|恐吓|欺骗|运动|攀爬|游泳|开锁|解除|调查|感知/.test(text)) {
            return cd.get('检定', '通用检定') || null;
        }
        // 战利品
        if (/战利品|搜刮|尸体|掉落|拾取|捡/.test(text)) {
            return cd.get('系统', '战利品系统') || null;
        }
        // 锻造 / 炼金
        if (/锻造|打造|修理|修复|炼金|制药|附魔/.test(text)) {
            return cd.get('系统', '锻造规则') || null;
        }
        // 任务
        if (/任务|委托|悬赏|接取/.test(text)) {
            return cd.get('系统', '任务系统') || null;
        }
        // 交易
        if (/买|卖|交易|购买|价格|商/.test(text)) {
            return cd.get('世界观', '经济') || null;
        }
        return null;
    }

    /**
     * 组装世界书注入块（NPC + 通用 + 行动指导），供 prompt-builder 使用
     * @returns {{npcBlocks: Array, wbBlocks: Array, actionGuide: string|null}}
     */
    function buildWorldbookBlocks(userInput, lastAIReply) {
        return {
            npcBlocks: matchNPCs(userInput, lastAIReply),
            wbBlocks: matchWorldbook(userInput, lastAIReply),
            actionGuide: matchActionGuide(userInput)
        };
    }

    /**
     * 构建当前任务数据块（让 LLM 知道玩家当前任务）
     * @param {Object} gameData - 游戏数据
     * @returns {string} 任务数据文本（空串表示无任务）
     */
    function buildQuestBlock(gameData) {
        if (!gameData || !gameData.quests || !Array.isArray(gameData.quests.active)) return '';
        
        var activeQuests = gameData.quests.active;
        if (activeQuests.length === 0) return '';
        
        var lines = ['## 当前任务'];
        
        activeQuests.forEach(function(quest, index) {
            lines.push('');
            lines.push('### 任务 ' + (index + 1) + '：' + (quest.name || '未命名'));
            
            if (quest.type) lines.push('- 类型：' + quest.type);
            if (quest.tier) lines.push('- 难度：' + quest.tier);
            if (quest.giver) lines.push('- 发布者：' + quest.giver);
            if (quest.description) lines.push('- 描述：' + quest.description);
            
            if (quest.objectives && quest.objectives.length > 0) {
                lines.push('- 目标：');
                quest.objectives.forEach(function(obj) {
                    var status = obj.completed ? '[已完成]' : '[进行中]';
                    lines.push('  - ' + status + ' ' + (obj.description || ''));
                });
            }
            
            if (quest.rewards && Object.keys(quest.rewards).length > 0) {
                var rewardParts = [];
                if (quest.rewards.gold) rewardParts.push(quest.rewards.gold + '金币');
                if (quest.rewards.exp) rewardParts.push(quest.rewards.exp + '经验');
                if (rewardParts.length > 0) {
                    lines.push('- 奖励：' + rewardParts.join('，'));
                }
            }
        });
        
        return lines.join('\n');
    }

    return {
        matchNPCs: matchNPCs,
        matchWorldbook: matchWorldbook,
        matchActionGuide: matchActionGuide,
        buildWorldbookBlocks: buildWorldbookBlocks,
        buildQuestBlock: buildQuestBlock
    };
})();

if (typeof window !== 'undefined') {
    window.worldbookEngine = worldbookEngine;
}
