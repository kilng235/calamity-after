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
        '受擒': 0, '束缚': 0, '倒地': 0, '力竭': 0, '燃烧': 0, '残废': 0, '失衡': 0, '减速': 0, '侵蚀': 0, '寒冷': 0, '感电': 0,
        '出血': 0,
        '隐形': 1, '加速': 1, '耀眼': 1, '灵巧': 1, '专注': 1, '护体': 1,
        '超重': 0   // 引擎派生状态：总重 > 负重上限时自动落地/解除（命令后校准），AI 不经命令维护
    };

    // ==================== 负重结算（背包系统：上限 10 + 力量×2 公斤） ====================

    /**
     * 重量估算表（公斤/单位）：按名称关键词匹配，未命中按 item.type 兜底，最后默认 1kg。
     * 数据源优先级：物品自带 weight 字段 > 本表估算。档位对齐装备总纲（板甲重/皮甲轻）与背包系统重量表。
     */
    var WEIGHT_KEYWORDS = [
        [/板甲|全罩盔/, 15], [/锁甲/, 10], [/皮甲|皮革甲/, 5], [/布甲|拼装甲/, 3], [/盾/, 4],
        [/头盔|面盔|盔/, 2], [/铁靴|护腿|肩甲|护手|臂甲/, 1.5],
        [/双手剑|巨剑|战斧|战锤|巨锤/, 4], [/长弓|重弩/, 3],
        [/铁剑|短剑|短矛|长矛|铁斧|铁锤|猎弓|轻弩|法杖|长枪/, 2], [/匕首|投掷/, 0.8],
        [/药剂|药水|绷带|卷轴|血清|萃取/, 0.3],
        [/矿石|矿锭|精铁|黑曜铁|皮革|毛皮|鳞片|牙齿|毒腺|草药|材料|焦木/, 1.5],
        [/干粮|肉干|口粮|水袋|食物/, 1],
        [/信件|地图|委托书|文件|笔记/, 0.1]
    ];
    var WEIGHT_TYPE_DEFAULTS = { weapon: 2, armor: 5, shield: 4, consumable: 0.3, material: 1.5, food: 1, document: 0.1, misc: 1 };

    function 估算重量(item) {
        var name = String(item && item.name || '');
        for (var i = 0; i < WEIGHT_KEYWORDS.length; i++) {
            if (WEIGHT_KEYWORDS[i][0].test(name)) return WEIGHT_KEYWORDS[i][1];
        }
        var type = String(item && item.type || '').toLowerCase();
        return WEIGHT_TYPE_DEFAULTS[type] !== undefined ? WEIGHT_TYPE_DEFAULTS[type] : 1;
    }

    /** 单件重量（公斤）：物品自带 weight 字段优先，否则按名称/类别估算 */
    function 物品重量(item) {
        if (!item || typeof item !== 'object') return 0;
        var w = Number(item.weight);
        if (Number.isFinite(w) && w >= 0) return w;
        return 估算重量(item);
    }

    var EQUIP_SLOTS = ['mainHand', 'offHand', 'body', 'head', 'hands', 'legs', 'feet', 'shoulders', 'accessory1', 'accessory2'];

    /**
     * 负重结算：装备 10 槽 + 背包（weight × count），上限 = 10 + 力量×2（背包系统）。
     * 供命令后校准（超重状态）、prompt-builder 状态块与角色面板共用。
     */
    function computeEncumbrance(gd) {
        var cap = 10 + ((gd && gd.attributes && Number(gd.attributes['力量'])) || 10) * 2;
        var total = 0;
        var slots = (gd && gd.equipment) || {};
        EQUIP_SLOTS.forEach(function (s) {
            var it = slots[s];
            if (it && typeof it === 'object') total += 物品重量(it);
        });
        var inv = (gd && Array.isArray(gd.inventory)) ? gd.inventory : [];
        inv.forEach(function (it) {
            if (it && typeof it === 'object') total += 物品重量(it) * (Math.max(1, Math.trunc(Number(it.count)) || 1));
        });
        total = Math.round(total * 10) / 10;
        return { total: total, cap: cap, over: total > cap, extreme: total > cap * 1.5 };
    }

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
        // expToNextLevel 为派生值（=等级×50，《经验与成长》§4）；AI 写入会被 syncLevel 纠偏
        c.expToNextLevel = Math.max(1, 规范化数值(c.expToNextLevel, 50));
        c.proficiencyBonus = Math.max(0, 规范化整数(c.proficiencyBonus, 2));
        c.ac = Math.max(0, 规范化整数(c.ac, 10));
        // MP：法术/炼金系统读写 character.mp；迁移旧存档误写的大写 character.MP 垃圾键
        if (c.MP !== undefined && c.mp === undefined) { c.mp = c.MP; }
        delete c.MP;
        c.mp = Math.max(0, 规范化数值(c.mp, 0));

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
        // 旧存档垃圾键迁移：AI 曾写出的中文槽位键（装备.主手 等）迁入标准槽位后删除
        // （标准槽位已有装备时丢弃中文键版本，避免覆盖有效数据）
        var SLOT_MAP = (typeof commandEngine !== 'undefined' && commandEngine.EQUIP_SLOT_MAP) || {};
        Object.keys(SLOT_MAP).forEach(function (cnKey) {
            if (gd.equipment[cnKey] === undefined) return;
            var slot = SLOT_MAP[cnKey];
            if ((gd.equipment[slot] === undefined || gd.equipment[slot] === null) && gd.equipment[cnKey] && typeof gd.equipment[cnKey] === 'object') {
                gd.equipment[slot] = gd.equipment[cnKey];
            }
            delete gd.equipment[cnKey];
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
        // 未分配属性点：引擎派生（升级获得，面板分配），钳制非负防 AI 误写
        progress.unspentPoints = Math.max(0, 规范化整数(progress.unspentPoints, 0));

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
        var pointsGained = 0;
        // 升级所需经验 = 等级 × 50（《经验与成长》§4 线性表；expToNextLevel 为引擎派生值，AI 写入无效）
        while (c.exp >= c.level * 50) {
            c.exp -= c.level * 50;
            c.level += 1;
            leveledUp += 1;
            // PB：进入新等阶 +1（Lv5/9/13/17；1-4:+2, 5-8:+3, 9-12:+4, 13-16:+5, 17-20:+6）
            if (c.level === 5 || c.level === 9 || c.level === 13 || c.level === 17) c.proficiencyBonus += 1;
            // 每级最大生命 +10（§73：HP 上限 = 100 + 10×(等级−1)）
            gd.hp.max += 10;
            // 属性点：每级 +1，逢 4 级 ASI 额外 +1（存 progress.unspentPoints，玩家在角色面板手动分配）
            var pts = (c.level % 4 === 0) ? 2 : 1;
            gd.progress = gd.progress || {};
            gd.progress.unspentPoints = (gd.progress.unspentPoints || 0) + pts;
            pointsGained += pts;
        }
        c.expToNextLevel = c.level * 50;   // 派生显示值（同步纠偏旧存档）
        if (leveledUp > 0) {
            // 升级回复：与新生命上限同步 +10/级（相对生命比例不变，设计中性）
            gd.hp.current = Math.min(gd.hp.max, gd.hp.current + leveledUp * 10);
            log('升级 ×' + leveledUp + '，当前等级 ' + c.level + '，属性点 +' + pointsGained + '（待面板分配）');
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

        // 负重结算（引擎派生状态）：超重自动落地/解除，极端超重（>1.5×上限）层级 2
        var enc = computeEncumbrance(gd);
        if (enc.over) {
            var next = enc.extreme ? { 层级: 2 } : true;
            if (JSON.stringify(gd.conditions['超重']) !== JSON.stringify(next)) corrections.push('超重状态结算（' + enc.total + '/' + enc.cap + 'kg）');
            gd.conditions['超重'] = next;
        } else if (gd.conditions['超重'] !== undefined) {
            delete gd.conditions['超重'];
            corrections.push('超重解除（' + enc.total + '/' + enc.cap + 'kg）');
        }

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

        // MP 钳制：上限 = 智力 × 5（与 spell-system.calculateMPMax 同公式）
        var mpMaxCap = Math.max(0, (gd.attributes['智力'] || 10) * 5);
        var mpBefore = gd.character.mp;
        gd.character.mp = Math.max(0, Math.min(mpMaxCap, Number(gd.character.mp) || 0));
        if (mpBefore !== gd.character.mp) corrections.push('character.mp 钳制');

        // 时间规范化
        gd.gameTime = normalizeGameTime(gd.gameTime);

        // 好感值钳制 [-100, 100]；人情值钳制 [0, 100]（关系系统双轴）
        if (gd.relationships && typeof gd.relationships === 'object') {
            Object.keys(gd.relationships).forEach(function (name) {
                var rel = gd.relationships[name];
                if (rel && typeof rel === 'object' && Number.isFinite(Number(rel.好感度))) {
                    var before = rel.好感度;
                    rel.好感度 = Math.max(-100, Math.min(100, Number(rel.好感度)));
                    if (before !== rel.好感度) corrections.push('relationships.' + name + '.好感度 钳制');
                }
                if (rel && typeof rel === 'object' && Number.isFinite(Number(rel.人情值))) {
                    var fqBefore = rel.人情值;
                    rel.人情值 = Math.max(0, Math.min(100, Number(rel.人情值)));
                    if (fqBefore !== rel.人情值) corrections.push('relationships.' + name + '.人情值 钳制');
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
        var report = { added: [], completed: [], failed: [], duplicated: [] };

        if (!Array.isArray(quests)) return { gameData: gd, report: report };

        quests.forEach(function(item) {
            if (!item || !item.quest) return;
            var quest = item.quest;
            var type = item.type;

            if (type === 'new') {
                // 同名去重：任务已在 进行中/已完成/失败 任一状态时拒绝重复登记
                // （护栏：开局初始任务已落库，AI 第一回合常误报 [新任务] 重复接取）
                var newName = String(quest.name || '').trim();
                var exists = newName && (gd.quests.active.some(function (q) { return q.name === newName; })
                    || gd.quests.completed.some(function (q) { return q.name === newName; })
                    || gd.quests.failed.some(function (q) { return q.name === newName; }));
                if (exists) {
                    report.duplicated.push(newName);
                    log('⚠️ 任务已存在，跳过重复登记：' + newName);
                    return;
                }
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
        computeEncumbrance: computeEncumbrance,
        物品重量: 物品重量,
        命令后校准: 命令后校准
    };
})();

if (typeof window !== 'undefined') {
    window.commandProcessor = commandProcessor;
}
