/**
 * command-engine.js - 状态命令引擎（移植自墨色江湖 stateHelpers，DND 单缓冲版）
 *
 * 职责：
 * - 将 AI 输出的 add/set/push/delete 命令安全地应用到 gameData
 * - 键名归一化：中文别名 → gameData 规范路径
 * - 路径写穿：支持 a[0].b 数组索引、缺容器自动创建、对象深合并
 * - 白名单治理：可写根之外（stats/meta 等）的命令一律拒绝
 *
 * 本模块为纯函数层，不直接持有 gameData；由 command-processor 调度。
 *
 * @module command-engine
 * @version 1.0.0
 */

var commandEngine = (function () {
    'use strict';

    // ==================== 可写根路径 ====================

    /** AI 可写的 gameData 顶层根 */
    var WRITABLE_ROOTS = [
        'character', 'attributes', 'backgrounds', 'fatePoints', 'hp',
        'equipment', 'inventory', 'currency', 'progress', 'conditions',
        'relationships', 'gameTime', 'tone', 'skills', 'spells'
    ];

    /** 本地保留域：AI 一律不可写 */
    var RESERVED_ROOTS = ['stats', 'meta'];

    /**
     * 装备槽中文 → 标准槽位映射（与 prompt-builder._fmtEquipment 的槽位名一致）。
     * 命令引擎归一（装备.主手 → equipment.mainHand）与 command-processor 的
     * 旧存档垃圾键迁移共用此表。
     */
    var EQUIP_SLOT_MAP = {
        '主手': 'mainHand', '副手': 'offHand', '身体': 'body', '头部': 'head',
        '手部': 'hands', '腿部': 'legs', '脚部': 'feet', '足部': 'feet',
        '肩部': 'shoulders', '饰品1': 'accessory1', '饰品2': 'accessory2'
    };

    // ==================== 中文别名 → 规范路径 ====================

    /**
     * 别名规则：key 完全等于别名，或以 `别名.`/`别名[` 开头。
     * 值为函数时接收剩余子路径，返回规范路径；值为字符串时直接拼接。
     */
    var ALIAS_TABLE = {
        // 精确组合优先（避免拼接出中文字段名）
        '角色.名字': 'character.name',
        '角色.姓名': 'character.name',
        '角色.种族': 'character.race',
        '角色.性别': 'character.gender',
        '角色.年龄': 'character.age',
        '角色.等级': 'character.level',
        '角色.经验': 'character.exp',
        '时间.年': 'gameTime.year',
        '时间.年份': 'gameTime.year',
        '时间.月': 'gameTime.month',
        '时间.月份': 'gameTime.month',
        '时间.日': 'gameTime.day',
        '时间.日期': 'gameTime.day',
        '时间.时': 'gameTime.hour',
        '时间.小时': 'gameTime.hour',
        '时间.分': 'gameTime.minute',
        '时间.分钟': 'gameTime.minute',
        '时间.季节': 'gameTime.season',
        '关系.好感度': function (rest) { return 'relationships' + rest + '.好感度'; },
        
        // 泛化规则（用于未列举的子路径）
        // 注意：容器型别名在“整键命中”时返回 null → 拒绝整体赋值，防止 set 关系 = 10 之类把容器核爆
        '属性': function (rest) { return rest ? 'attributes' + rest : null; },
        '属性值': function (rest) { return rest ? 'attributes' + rest : null; },
        '六维': function (rest) { return rest ? 'attributes' + rest : null; },
        '角色': function (rest) {
            if (!rest) return null;
            // MP 大小写归一：AI 常按玩家档案写"角色.MP"，而法术/炼金系统读 character.mp（小写）
            if (/^\.MP/i.test(rest)) return 'character.mp' + rest.slice(3);
            return 'character' + rest;
        },
        '主角': function (rest) { return rest ? 'character' + rest : null; },
        '玩家': function (rest) { return rest ? 'character' + rest : null; },
        '名字': 'character.name',
        '姓名': 'character.name',
        '种族': 'character.race',
        '性别': 'character.gender',
        '年龄': 'character.age',
        '等级': 'character.level',
        '经验': 'character.exp',
        '经验值': 'character.exp',
        '升级经验': 'character.expToNextLevel',
        '熟练加值': 'character.proficiencyBonus',
        'AC': 'character.ac',
        '护甲等级': 'character.ac',
        '生命值': 'hp.current',
        '生命': 'hp.current',
        'HP': 'hp.current',
        '生命上限': 'hp.max',
        'HP上限': 'hp.max',
        '最大生命': 'hp.max',
        'MP': 'character.mp',
        '法力': 'character.mp',
        '法力值': 'character.mp',
        '命运点': 'fatePoints.current',
        '命运点上限': 'fatePoints.max',
        '背景特长': 'backgrounds',
        '特质': 'backgrounds',
        // 装备槽中文别名：面板与 normalize 只认标准槽位（mainHand 等），中文键是静默死数据
        '装备': function (rest) {
            if (!rest) return null;
            var m = /^\.([^.\[（]+)/.exec(rest);   // 括号注音（如 脚部（足部））截断后再查槽位表
            if (m && EQUIP_SLOT_MAP[m[1]]) return 'equipment.' + EQUIP_SLOT_MAP[m[1]] + rest.slice(m[0].length);
            return 'equipment' + rest;
        },
        '背包': 'inventory',
        '物品列表': 'inventory',
        '金币': 'currency.gold',
        '金钱': 'currency.gold',
        '资金': 'currency.gold',
        '进度': function (rest) { return rest ? 'progress' + rest : null; },
        '状态': function (rest) { return rest ? 'conditions' + rest : 'conditions'; },
        '当前状态': 'conditions',
        '当前位置': 'progress.currentLocation',
        '位置': 'progress.currentLocation',
        '所在地': 'progress.currentLocation',
        '当前场所': 'progress.currentPlace',
        '具体位置': 'progress.currentPlace',
        '场所': 'progress.currentPlace',
        '已解锁地点': 'progress.unlockedLocations',
        '已完成任务': 'progress.completedQuests',
        '关系': function (rest) { return rest ? 'relationships' + rest : null; },
        '好感': function (rest) { return rest ? 'relationships' + rest : null; },
        '好感度': function (rest) { return rest ? 'relationships' + rest : null; },
        '时间': function (rest) { return rest ? 'gameTime' + rest : null; },
        '游戏时间': function (rest) { return rest ? 'gameTime' + rest : null; },
        '灾厄纪年': function (rest) { return rest ? 'gameTime' + rest : null; },
        '年份': 'gameTime.year',
        '月份': 'gameTime.month',
        '日期': 'gameTime.day',
        '日': 'gameTime.day',
        '小时': 'gameTime.hour',
        '时': 'gameTime.hour',
        '分钟': 'gameTime.minute',
        '分': 'gameTime.minute',
        '季节': 'gameTime.season',
        '技能列表': 'skills',
        '法术列表': 'spells',
        '基调': 'tone',
        '剧情基调': 'tone',
        '叙事基调': 'tone'
    };

    // ==================== 通用工具 ====================

    function 深拷贝(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function 是对象(value) {
        return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }

    function 深合并对象(left, right) {
        if (Array.isArray(right)) return 深拷贝(right);
        if (!是对象(right)) return 深拷贝(right);
        var seed = 是对象(left) ? 深拷贝(left) : {};
        Object.keys(right).forEach(function (key) {
            seed[key] = 深合并对象(seed[key], right[key]);
        });
        return seed;
    }

    /**
     * 路径解析：支持 `a[0].b` 形式，返回 token 数组（string|number）。
     */
    function 解析路径片段(rawPath) {
        var tokens = [];
        var regex = /([^. \[\]]+)|\[(\d+)\]/g;
        var match;
        while ((match = regex.exec(rawPath || ''))) {
            if (match[1]) tokens.push(match[1]);
            if (match[2] !== undefined) tokens.push(Number(match[2]));
        }
        return tokens;
    }

    // ==================== 键归一化 ====================

    /**
     * 将原始命令键归一化为 `gameData.xxx` 规范路径。
     * @returns {{ok: boolean, path: string, reason: string}}
     */
    function normalizeCommandKey(rawKey) {
        var key = (rawKey || '').trim();
        if (!key) return { ok: false, path: '', reason: '空路径' };

        // 剥掉可能带上的 gameData. 前缀，统一走归一化
        if (key.indexOf('gameData.') === 0) key = key.slice('gameData.'.length);

        // 1. 精确别名命中（整键或带子路径）
        for (var alias in ALIAS_TABLE) {
            if (!Object.prototype.hasOwnProperty.call(ALIAS_TABLE, alias)) continue;
            var rule = ALIAS_TABLE[alias];
            if (key === alias) {
                if (typeof rule === 'function') {
                    var rootPath = rule('');
                    if (rootPath === null) {
                        return { ok: false, path: '', reason: '禁止对容器整体赋值，请带子路径：' + key + '.xxx' };
                    }
                    return { ok: true, path: 'gameData.' + rootPath };
                }
                return { ok: true, path: 'gameData.' + rule };
            }
            if (key.indexOf(alias + '.') === 0 || key.indexOf(alias + '[') === 0) {
                var rest = key.slice(alias.length);
                if (typeof rule === 'function') {
                    return { ok: true, path: 'gameData.' + rule(rest) };
                }
                return { ok: true, path: 'gameData.' + rule + rest };
            }
        }

        // 2. 直接以可写根开头
        for (var i = 0; i < WRITABLE_ROOTS.length; i++) {
            var root = WRITABLE_ROOTS[i];
            if (key === root || key.indexOf(root + '.') === 0 || key.indexOf(root + '[') === 0) {
                return { ok: true, path: 'gameData.' + key };
            }
        }

        // 3. 保留域明确拒绝
        for (var j = 0; j < RESERVED_ROOTS.length; j++) {
            if (key === RESERVED_ROOTS[j] || key.indexOf(RESERVED_ROOTS[j] + '.') === 0) {
                return { ok: false, path: '', reason: '保留域不可写：' + RESERVED_ROOTS[j] };
            }
        }

        return { ok: false, path: '', reason: '可写根路径之外：' + key };
    }

    // ==================== 路径写穿 ====================

    /**
     * 在 draft 上就地应用路径命令（draft 已由调用方深拷贝）。
     * 中间节点缺失时自动创建容器；对象 set 走深合并。
     */
    function 应用路径命令(draft, rawPath, action, nextValue) {
        var tokens = 解析路径片段(rawPath);

        if (tokens.length === 0) {
            // 命令目标就是 gameData 根本身：不允覆盖整树
            return { ok: false, reason: '禁止对根路径整体赋值' };
        }

        var cursor = draft;
        for (var index = 0; index < tokens.length - 1; index += 1) {
            var token = tokens[index];
            var nextToken = tokens[index + 1];
            if (typeof token === 'number') {
                if (!Array.isArray(cursor)) return { ok: false, reason: '索引路径宿主不是数组' };
                if (cursor[token] === undefined || cursor[token] === null) {
                    cursor[token] = typeof nextToken === 'number' ? [] : {};
                }
                cursor = cursor[token];
                continue;
            }
            if (cursor[token] === undefined || cursor[token] === null || typeof cursor[token] !== 'object') {
                cursor[token] = typeof nextToken === 'number' ? [] : {};
            }
            cursor = cursor[token];
        }

        var lastToken = tokens[tokens.length - 1];
        var current = cursor[lastToken];

        // 耐久语义化：协议命令 `add 装备.主手.耐久 = -1` 作用于装备对象的 durability（{current,max}）
        // 的 current（按 max 钳制）；装备对象内键为英文 durability（兼容中文 耐久 键），
        // 整对象 set 仍走通用深合并，两种写法兼容
        if (lastToken === '耐久' || lastToken === 'durability') {
            var durObj = null;
            if (是对象(cursor.durability) && Number.isFinite(Number(cursor.durability.current))) durObj = cursor.durability;
            else if (是对象(cursor['耐久']) && Number.isFinite(Number(cursor['耐久'].current))) durObj = cursor['耐久'];
            if (durObj) {
                var durMax = Number.isFinite(Number(durObj.max)) ? Number(durObj.max) : Infinity;
                if (action === 'add') {
                    durObj.current = Math.max(0, Math.min(durMax, Number(durObj.current) + (Number(nextValue) || 0)));
                    return { ok: true };
                }
                if (action === 'set') {
                    durObj.current = Math.max(0, Math.min(durMax, Number(nextValue) || 0));
                    return { ok: true };
                }
            }
        }

        if (typeof lastToken === 'number') {
            if (!Array.isArray(cursor)) return { ok: false, reason: '索引路径宿主不是数组' };
            if (action === 'delete') {
                if (lastToken >= 0 && lastToken < cursor.length) cursor.splice(lastToken, 1);
                return { ok: true };
            }
            if (action === 'push') {
                current = Array.isArray(current) ? current : [];
                current.push(深拷贝(nextValue));
                cursor[lastToken] = current;
                return { ok: true };
            }
            if (action === 'add' || action === 'sub') {
                cursor[lastToken] = (Number(current) || 0) + (action === 'sub' ? -1 : 1) * (Number(nextValue) || 0);
                return { ok: true };
            }
            cursor[lastToken] = 深拷贝(nextValue);
            return { ok: true };
        }

        if (action === 'delete') {
            delete cursor[lastToken];
            return { ok: true };
        }
        if (action === 'push') {
            current = Array.isArray(current) ? current : [];
            current.push(深拷贝(nextValue));
            cursor[lastToken] = current;
            return { ok: true };
        }
        if (action === 'add' || action === 'sub') {
            cursor[lastToken] = (Number(current) || 0) + (action === 'sub' ? -1 : 1) * (Number(nextValue) || 0);
            return { ok: true };
        }
        if (是对象(current) && 是对象(nextValue)) {
            cursor[lastToken] = 深合并对象(current, nextValue);
            return { ok: true };
        }
        cursor[lastToken] = 深拷贝(nextValue);
        return { ok: true };
    }

    // ==================== 对外 API ====================

    /**
     * 将单条命令应用到 gameData 副本。
     * @param {Object} gameData 当前状态（不会被修改）
     * @param {{action: string, key: string, value: any}} cmd
     * @returns {{ok: boolean, gameData: Object, reason: string}}
     */
    function applyCommand(gameData, cmd) {
        var action = (cmd.action || '').toLowerCase();
        // sub 兼容：解析层通常已转为负值 add，这里兜底支持
        if (action === 'sub') action = 'add', cmd = { action: 'add', key: cmd.key, value: -Math.abs(Number(cmd.value) || 0) };
        if (['set', 'add', 'push', 'delete'].indexOf(action) === -1) {
            return { ok: false, gameData: gameData, reason: '未知动作：' + action };
        }

        var norm = normalizeCommandKey(cmd.key);
        if (!norm.ok) {
            return { ok: false, gameData: gameData, reason: norm.reason };
        }

        var draft = 深拷贝(gameData);
        // 剥掉 'gameData.' 前缀得到树内路径
        var rest = norm.path.slice('gameData.'.length);
        var result = 应用路径命令(draft, rest, action, cmd.value);
        if (!result.ok) {
            return { ok: false, gameData: gameData, reason: result.reason };
        }
        return { ok: true, gameData: draft, reason: '' };
    }

    /**
     * 按路径只读查询。
     */
    function readValueByPath(gameData, rawKey) {
        var norm = normalizeCommandKey(rawKey);
        if (!norm.ok) return undefined;
        var tokens = 解析路径片段(norm.path.slice('gameData.'.length));
        var current = gameData;
        for (var i = 0; i < tokens.length; i++) {
            if (current === undefined || current === null) return undefined;
            current = current[tokens[i]];
        }
        return current;
    }

    // ==================== 导出 ====================

    return {
        WRITABLE_ROOTS: WRITABLE_ROOTS,
        RESERVED_ROOTS: RESERVED_ROOTS,
        EQUIP_SLOT_MAP: EQUIP_SLOT_MAP,
        normalizeCommandKey: normalizeCommandKey,
        applyCommand: applyCommand,
        readValueByPath: readValueByPath,
        parsePath: 解析路径片段
    };
})();

if (typeof window !== 'undefined') {
    window.commandEngine = commandEngine;
}
