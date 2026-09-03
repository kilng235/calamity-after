/**
 * command-processor.js - 命令应用调度器（灾厄 DND 版）
 *
 * 职责（对齐墨色江湖 responseCommandProcessor 模式）：
 * 1. 应用前：规范化 gameData（防中间态）
 * 2. 逐条应用命令（单条失败不中断，记录报告）
 * 3. 应用后收口：数值钳制、经验升级查表、背包条目形状、状态到期结算
 * 4. 落盘与 UI 刷新（通过 window.CalamityStateBridge 桥接 game-state / UI）
 *
 * 依赖：command-engine.js（全局）、game-state.js（经 CalamityStateBridge）
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

    /**
     * 防御式规范化 gameData：保证字段类型与形状合法（不改变语义）。
     */
    function normalizeGameData(gd) {
        if (!gd || typeof gd !== 'object') return gd;

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
        if (!Array.isArray(progress.completedQuests)) progress.completedQuests = [];
        if (!Array.isArray(progress.unlockedLocations)) progress.unlockedLocations = ['锈钉镇'];

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

        // 命运点（结算协议：上限 1，不积累）
        var fpBefore = gd.fatePoints.current;
        gd.fatePoints.max = Math.max(0, 规范化整数(gd.fatePoints.max, 1));
        gd.fatePoints.current = 取区间(gd.fatePoints.current, 0, gd.fatePoints.max, gd.fatePoints.max);
        if (fpBefore !== gd.fatePoints.current) corrections.push('fatePoints 钳制');

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
     * 对当前存档直接应用命令（走 CalamityStateBridge，供 pipeline 调用）。
     * 桥由 game.html 注入：{ getGameData, saveGameData, refreshUI }
     */
    function processCurrent(commands) {
        var bridge = (typeof window !== 'undefined') ? window.CalamityStateBridge : null;
        if (!bridge || typeof bridge.getGameData !== 'function') {
            log('⚠️ CalamityStateBridge 未注入，命令未应用');
            return null;
        }
        var current = bridge.getGameData();
        var result = applyCommands(current, commands);
        bridge.saveGameData(result.gameData);
        if (typeof bridge.refreshUI === 'function') bridge.refreshUI();
        return result;
    }

    // ==================== 导出 ====================

    return {
        applyCommands: applyCommands,
        processCurrent: processCurrent,
        normalizeGameData: normalizeGameData,
        normalizeGameTime: normalizeGameTime,
        命令后校准: 命令后校准
    };
})();

if (typeof window !== 'undefined') {
    window.commandProcessor = commandProcessor;
}
