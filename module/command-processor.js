/**
 * command-processor.js - 命令应用调度器（灾厄 DND 版）
 *
 * 职责（对齐墨色江湖 responseCommandProcessor 模式）：
 * 1. 应用前：规范化 gameData（防中间态）
 * 2. 逐条应用命令（单条失败不中断，记录报告）
 * 3. 应用后收口：数值钳制、经验升级查表、背包条目形状、状态到期结算
 * 4. 落盘与 UI 刷新：由调用方（index.html 主链路）执行 gameState.importGameData + refreshGameUI
 *
 * 依赖：command-engine.js（全局）；gameData 由调用方传入，本模块不持有状态
 *
 * @module command-processor
 * @version 1.0.0
 */

var commandProcessor = (function () {
    'use strict';

    // ==================== 工具 ====================

    function 规范化数值(v, fallback) {
        var n = Number(v);
        return Number.isFinite(n) ? n : (fallback || 0);
    }

    function 规范化整数(v, fallback) {
        return Math.trunc(规范化数值(v, fallback));
    }

    function 取区间(v, min, max, fallback) {
        var n = 规范化数值(v, fallback);
        return Math.max(min, Math.min(max, n));
    }

    function 规范化文本(v, fallback) {
        return typeof v === 'string' ? v : (fallback || '');
    }

    function log() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[CommandProcessor]');
        console.log.apply(console, args);
    }

    // ==================== 应用前规范化 ====================

    // 主角状态白名单（与世界书「状态列表」同步维护）：值 0=负面 / 1=有利（面板着色用）
    var STATUS_WHITELIST = {
        '目盲': 0, '耳聋': 0, '失明': 0, '失能': 0, '昏迷': 0, '麻痹': 0, '震慑': 0, '石化': 0, '中毒': 0, '恐慌': 0, '魅惑': 0,
        '受擒': 0, '束缚': 0, '倒地': 0, '力竭': 0, '燃烧': 0, '出血': 0, '残废': 0, '失衡': 0, '减速': 0, '侵蚀': 0, '寒冷': 0, '感电': 0,
        '隐形': 1, '加速': 1, '耀眼': 1, '灵巧': 1, '专注': 1, '护体': 1
    };

    /** 主角状态规范化：白名单过滤 + 力竭/侵蚀层级钳制（应用前与应用后都调用） */
    function 规范条件(gd) {
        var conditions = gd.conditions = gd.conditions || {};
        Object.keys(conditions).forEach(function (name) {
            if (!STATUS_WHITELIST.hasOwnProperty(name)) {
                delete conditions[name];   // 未知状态名拒绝落地
                return;
            }
            var v = conditions[name];
            if (name === '力竭') {
                var lvl = (v && v.层级) ? 规范化整数(v.层级, 1) : 1;
                conditions[name] = { 层级: Math.max(1, Math.min(3, lvl)) };
            } else if (name === '侵蚀') {
                var st = (v && v.层级) ? 规范化整数(v.层级, 1) : 1;
                conditions[name] = { 层级: Math.max(1, Math.min(2, st)) };
            } else {
                conditions[name] = (v && typeof v === 'object') ? v : true;
            }
        });
    }

    /**
     * 防御式规范化 gameData：保证字段类型与形状合法（不改变语义）。
     */
    function normalizeGameData(gd) {        if (!gd || typeof gd !== 'object') return gd;

        var c = gd.character = gd.character || {};
        c.name = 规范化文本(c.name, '旅行者');
        c.race = 规范化文本(c.race, '人类');
        c.gender = 规范化文本(c.gender, '男');
        c.age = 取区间(c.age, 1, 999, 25);
        c.level = Math.max(1, 规范化整数(c.level, 1));
        c.exp = Math.max(0, 规范化数值(c.exp, 0));
        c.expToNextLevel = Math.max(1, 规范化数值(c.expToNextLevel, 100));
        c.proficiencyBonus = Math.max(0, 规范化整数(c.proficiencyBonus, 2));
        c.ac = Math.max(0, 规范化整数(c.ac, 10));

        if (!gd.attributes || typeof gd.attributes !== 'object') gd.attributes = {};
        ['力量', '敏捷', '体质', '感知', '智力', '魅力'].forEach(function (key) {
            gd.attributes[key] = 取区间(gd.attributes[key], 1, 30, 10);
        });

        if (!Array.isArray(gd.backgrounds)) gd.backgrounds = [];

        var fp = gd.fatePoints = gd.fatePoints || {};
        fp.max = Math.max(0, 规范化整数(fp.max, 1));
        fp.current = 取区间(fp.current, 0, fp.max, fp.max);

        var hp = gd.hp = gd.hp || {};
        hp.max = Math.max(1, 规范化数值(hp.max, 10));
        hp.current = 取区间(hp.current, 0, hp.max, hp.max);

        if (!gd.equipment || typeof gd.equipment !== 'object') gd.equipment = {};
        ['mainHand', 'offHand', 'body', 'head', 'hands', 'legs', 'feet', 'shoulders', 'accessory1', 'accessory2']
            .forEach(function (slot) {
                if (gd.equipment[slot] !== undefined && (gd.equipment[slot] === null || typeof gd.equipment[slot] === 'object')) {
                    // 合法：null 或装备对象
                } else {
                    gd.equipment[slot] = null;
                }
            });

        if (!Array.isArray(gd.inventory)) gd.inventory = [];

        var currency = gd.currency = gd.currency || {};
        currency.gold = Math.max(0, 规范化数值(currency.gold, 0));

        var progress = gd.progress = gd.progress || {};
        progress.currentLocation = 规范化文本(progress.currentLocation, '锈钉镇');
        if (progress.currentPlace === undefined || progress.currentPlace === null) {
            // 旧存档一次性迁移：开局仍在锈钉镇的，补齐据点名与开局场所
            if (progress.currentLocation === '锈钉镇' || progress.currentLocation === '佣兵镇·锈钉') {
                progress.currentLocation = '佣兵镇·锈钉';
                progress.currentPlace = '佣兵公会大厅';
            } else {
                progress.currentPlace = '';
            }
        }
        progress.currentPlace = 规范化文本(progress.currentPlace || '', '');
        if (!Array.isArray(progress.completedQuests)) progress.completedQuests = [];
        if (!Array.isArray(progress.unlockedLocations)) progress.unlockedLocations = ['锈钉镇'];

        // 主角状态规范化（白名单 + 层级钳制）
        规范条件(gd);

        // 任务系统规范化
        var quests = gd.quests = gd.quests || {};
        if (!Array.isArray(quests.active)) quests.active = [];
        if (!Array.isArray(quests.completed)) quests.completed = [];
        if (!Array.isArray(quests.failed)) quests.failed = [];
        
        // 规范化每个任务对象
        function normalizeQuest(quest) {
            if (!quest || typeof quest !== 'object') return null;
            return {
                id: 规范化文本(quest.id, 'quest_' + Date.now()),
                name: 规范化文本(quest.name, '未命名任务'),
                description: 规范化文本(quest.description, ''),
                type: 规范化文本(quest.type, '主线'),
                tier: 规范化文本(quest.tier, '普通'),
                objectives: Array.isArray(quest.objectives) ? quest.objectives.map(function(obj) {
                    return {
                        description: 规范化文本(obj.description, ''),
                        completed: Boolean(obj.completed)
                    };
                }) : [],
                rewards: (quest.rewards && typeof quest.rewards === 'object') ? quest.rewards : {},
                giver: 规范化文本(quest.giver, ''),
                createdAt: Number(quest.createdAt) || Date.now(),
                completedAt: quest.completedAt ? Number(quest.completedAt) : null,
                status: ['active', 'completed', 'failed'].indexOf(quest.status) >= 0 ? quest.status : 'active'
            };
        }
        
        quests.active = quests.active.map(normalizeQuest).filter(Boolean);
        quests.completed = quests.completed.map(normalizeQuest).filter(Boolean);
        quests.failed = quests.failed.map(normalizeQuest).filter(Boolean);

        if (!gd.relationships || typeof gd.relationships !== 'object') gd.relationships = {};

        gd.gameTime = normalizeGameTime(gd.gameTime);
        gd.tone = 规范化文本(gd.tone, '');

        return gd;
    }

    /**
     * 游戏时间规范化：灾厄纪年（年 1-999 / 月 1-12 / 日 1-31 / 时 0-23 / 分 0-59）。
     */
    function normalizeGameTime(t) {
        var base = { year: 303, month: 5, day: 12, hour: 14, minute: 0, season: '春' };
        t = (t && typeof t === 'object') ? t : {};
        var normalized = {
            year: 取区间(t.year, 1, 999, base.year),
            month: 取区间(t.month, 1, 12, base.month),
            day: 取区间(t.day, 1, 31, base.day),
            hour: 取区间(t.hour, 0, 23, base.hour),
            minute: 取区间(t.minute, 0, 59, base.minute),
            season: ['春', '夏', '秋', '冬'].indexOf(t.season) >= 0 ? t.season : base.season
        };
        return normalized;
    }

    // ==================== 应用后收口 ====================

    /**
     * 经验/等级同步：exp 超过 expToNextLevel 时连续升级（对齐 game-state.levelUp）。
     */
    function syncLevel(gd) {
        var c = gd.character;
        var leveledUp = 0;
        while (c.exp >= c.expToNextLevel) {
            c.exp -= c.expToNextLevel;
            c.expToNextLevel = Math.floor(c.expToNextLevel * 1.5);
            c.level += 1;
            leveledUp += 1;
            if (c.level % 4 === 0) c.proficiencyBonus += 1;
            gd.hp.max += 5;
        }
        if (leveledUp > 0) {
            gd.hp.current = Math.min(gd.hp.max, gd.hp.current + leveledUp * 5);
            log('升级 ×' + leveledUp + '，当前等级 ' + c.level);
        }
        return leveledUp;
    }

    /**
     * 收口钳制：命令全部应用后统一执行（对齐墨色江湖"命令后校准"）。
     */
    function 命令后校准(gd) {
        var corrections = [];

        // HP
        var hpBefore = gd.hp.current;
        gd.hp.current = 取区间(gd.hp.current, 0, gd.hp.max, gd.hp.max);
        if (hpBefore !== gd.hp.current) corrections.push('hp.current 钳制 ' + hpBefore + ' -> ' + gd.hp.current);

        // 命运点（结算协议：上限 3；「身份时刻」经身份体系结算增加）
        var fpBefore = gd.fatePoints.current;
        gd.fatePoints.max = Math.max(0, 规范化整数(gd.fatePoints.max, 3));
        gd.fatePoints.current = 取区间(gd.fatePoints.current, 0, gd.fatePoints.max, gd.fatePoints.max);
        if (fpBefore !== gd.fatePoints.current) corrections.push('fatePoints 钳制');

        // 主角状态（白名单过滤 + 层级钳制）
        var condBefore = JSON.stringify(gd.conditions || {});
        规范条件(gd);
        if (JSON.stringify(gd.conditions || {}) !== condBefore) corrections.push('conditions 规范');

        // 金币非负
        var goldBefore = gd.currency.gold;
        gd.currency.gold = Math.max(0, 规范化数值(gd.currency.gold, 0));
        if (goldBefore !== gd.currency.gold) corrections.push('currency.gold 钳制 ' + goldBefore + ' -> ' + gd.currency.gold);

        // 属性区间
        Object.keys(gd.attributes).forEach(function (key) {
            var before = gd.attributes[key];
            gd.attributes[key] = 取区间(gd.attributes[key], 1, 30, 10);
            if (before !== gd.attributes[key]) corrections.push('attributes.' + key + ' 钳制 ' + before + ' -> ' + gd.attributes[key]);
        });

        // 经验非负 + 升级查表
        gd.character.exp = Math.max(0, 规范化数值(gd.character.exp, 0));
        syncLevel(gd);

        // AC 重算（10 + 敏捷调整值，装备加成由 equipment-system 叠加）
        // 这里只保证下限，装备 AC 由战斗系统在用时计算
        gd.character.ac = Math.max(0, 规范化整数(gd.character.ac, 10));

        // 时间规范化
        gd.gameTime = normalizeGameTime(gd.gameTime);

        // 好感值钳制 [-100, 100]
        if (gd.relationships && typeof gd.relationships === 'object') {
            Object.keys(gd.relationships).forEach(function (name) {
                var rel = gd.relationships[name];
                if (rel && typeof rel === 'object' && Number.isFinite(Number(rel.好感度))) {
                    var before = rel.好感度;
                    rel.好感度 = Math.max(-100, Math.min(100, Number(rel.好感度)));
                    if (before !== rel.好感度) corrections.push('relationships.' + name + '.好感度 钳制');
                }
            });
        }

        return corrections;
    }

    // ==================== 主入口 ====================

    /**
     * 将命令列表应用到 gameData（深拷贝工作流：失败不污染原状态）。
     * @param {Object} sourceGameData
     * @param {Array<{action,key,value}>} commands
     * @returns {{gameData: Object, report: {applied: Array, rejected: Array, corrections: Array}}}
     */
    function applyCommands(sourceGameData, commands) {
        var gd = JSON.parse(JSON.stringify(sourceGameData));
        gd = normalizeGameData(gd);
        var report = { applied: [], rejected: [], corrections: [] };

        (Array.isArray(commands) ? commands : []).forEach(function (cmd, index) {
            if (!cmd || typeof cmd !== 'object') return;
            var result = commandEngine.applyCommand(gd, cmd);
            if (result.ok) {
                gd = result.gameData;
                report.applied.push({ index: index, action: cmd.action, key: cmd.key, value: cmd.value });
                log('✓ ' + cmd.action + ' ' + cmd.key);
            } else {
                report.rejected.push({ index: index, action: cmd.action, key: cmd.key, reason: result.reason });
                log('✗ 丢弃命令 ' + cmd.action + ' ' + cmd.key + '：' + result.reason);
            }
        });

        report.corrections = 命令后校准(gd);
        return { gameData: gd, report: report };
    }

    /**
     * 处理任务列表（新任务/完成任务/任务失败）
     * @param {Object} sourceGameData - 当前游戏数据
     * @param {Array<{type: string, quest: Object}>} quests - 解析出的任务列表
     * @returns {{gameData: Object, report: {added: Array, completed: Array, failed: Array}}}
     */
    function applyQuests(sourceGameData, quests) {
        var gd = JSON.parse(JSON.stringify(sourceGameData));
        gd = normalizeGameData(gd);
        var report = { added: [], completed: [], failed: [] };
        
        if (!Array.isArray(quests)) return { gameData: gd, report: report };
        
        quests.forEach(function(item) {
            if (!item || !item.quest) return;
            var quest = item.quest;
            var type = item.type;
            
            if (type === 'new') {
                // 添加新任务
                var newQuest = {
                    id: quest.id || 'quest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                    name: quest.name || '未命名任务',
                    description: quest.description || '',
                    type: quest.type || '主线',
                    tier: quest.tier || '普通',
                    objectives: Array.isArray(quest.objectives) ? quest.objectives : [],
                    rewards: quest.rewards || {},
                    giver: quest.giver || '',
                    createdAt: Date.now(),
                    completedAt: null,
                    status: 'active'
                };
                gd.quests.active.push(newQuest);
                report.added.push(newQuest);
                log('✓ 新任务：' + newQuest.name);
                
            } else if (type === 'complete') {
                // 完成任务（按名称匹配）
                var questName = quest.name;
                var index = gd.quests.active.findIndex(function(q) { return q.name === questName; });
                if (index >= 0) {
                    var completedQuest = gd.quests.active[index];
                    completedQuest.status = 'completed';
                    completedQuest.completedAt = Date.now();
                    gd.quests.active.splice(index, 1);
                    gd.quests.completed.push(completedQuest);
                    
                    // 同步到 progress.completedQuests（向后兼容）
                    if (!gd.progress.completedQuests.includes(completedQuest.name)) {
                        gd.progress.completedQuests.push(completedQuest.name);
                    }
                    
                    report.completed.push(completedQuest);
                    log('✓ 任务完成：' + completedQuest.name);
                } else {
                    log('⚠️ 未找到进行中的任务：' + questName);
                }
                
            } else if (type === 'fail') {
                // 任务失败（按名称匹配）
                var failQuestName = quest.name;
                var failIndex = gd.quests.active.findIndex(function(q) { return q.name === failQuestName; });
                if (failIndex >= 0) {
                    var failedQuest = gd.quests.active[failIndex];
                    failedQuest.status = 'failed';
                    failedQuest.completedAt = Date.now();
                    gd.quests.active.splice(failIndex, 1);
                    gd.quests.failed.push(failedQuest);
                    report.failed.push(failedQuest);
                    log('✗ 任务失败：' + failedQuest.name);
                } else {
                    log('⚠️ 未找到进行中的任务：' + failQuestName);
                }
            }
        });
        
        return { gameData: gd, report: report };
    }
    

    // ==================== 导出 ====================

    return {
        applyCommands: applyCommands,
        applyQuests: applyQuests,
        normalizeGameData: normalizeGameData,
        normalizeGameTime: normalizeGameTime,
        命令后校准: 命令后校准
    };
})();

if (typeof window !== 'undefined') {
    window.commandProcessor = commandProcessor;
}
