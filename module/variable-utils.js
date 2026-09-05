/**
 * variable-utils.js - 变量工具函数（对齐 ST 的 statRoot / safeGet / displayValue 范式）
 *
 * 功能：
 * - statRoot：获取统一数据根（合并 gameData + variableSystem）
 * - safeGet：安全读取嵌套路径（支持数组索引）
 * - displayValue：格式化显示值（数字/数组/对象/空值）
 *
 * 对齐 ST 的变量读取范式：
 * - 优先读取 variableSystem（turn/session/global 三级变量）
 * - 回退读取 gameData（持久状态）
 * - 支持嵌套路径（如 "character.name" / "quests.active[0].name"）
 *
 * @module variable-utils
 * @version 1.0.0
 */

var variableUtils = (function() {
    'use strict';

    /**
     * 获取统一数据根（合并 gameData + variableSystem）
     * @param {Object} [options] - 选项
     * @param {boolean} [options.includeVariables=true] - 是否包含 variableSystem
     * @returns {Object} 统一数据根
     */
    function statRoot(options) {
        options = options || {};
        var includeVariables = options.includeVariables !== false;
        
        var root = {};
        
        // 1. 先填充 gameData（持久状态）
        var gameData = null;
        if (typeof window !== 'undefined') {
            if (window.gameData) {
                gameData = window.gameData;
            } else if (window.gameState && typeof window.gameState.getGameData === 'function') {
                gameData = window.gameState.getGameData();
            }
        }
        
        if (gameData && typeof gameData === 'object') {
            // 深拷贝 gameData 到 root
            try {
                root = JSON.parse(JSON.stringify(gameData));
            } catch (e) {
                console.warn('[VariableUtils] gameData 深拷贝失败:', e);
                root = Object.assign({}, gameData);
            }
        }
        
        // 2. 合并 variableSystem（三级变量）
        if (includeVariables && typeof window !== 'undefined' && window.variableSystem) {
            try {
                var vars = window.variableSystem.getAll();
                if (vars && typeof vars === 'object') {
                    // 把 variableSystem 的变量合并到 root.variables
                    root.variables = Object.assign({}, root.variables || {}, vars);
                }
            } catch (e) {
                console.warn('[VariableUtils] variableSystem 读取失败:', e);
            }
        }
        
        return root;
    }

    /**
     * 安全读取嵌套路径（支持数组索引）
     * @param {Object} obj - 数据对象
     * @param {string} path - 路径（如 "character.name" / "quests.active[0].name"）
     * @param {*} [defaultValue] - 默认值
     * @returns {*} 读取到的值
     * 
     * @example
     * safeGet({a: {b: [1, 2, 3]}}, 'a.b[1]') // => 2
     * safeGet({a: {b: 1}}, 'a.c', 'default') // => 'default'
     */
    function safeGet(obj, path, defaultValue) {
        if (!obj || !path) return defaultValue;
        
        // 解析路径：支持 "a.b.c" / "a.b[0].c" / "a.b[0]"
        var segments = [];
        var current = '';
        var inBracket = false;
        
        for (var i = 0; i < path.length; i++) {
            var ch = path[i];
            
            if (ch === '[') {
                if (current) {
                    segments.push(current);
                    current = '';
                }
                inBracket = true;
            } else if (ch === ']') {
                if (current) {
                    segments.push(current);
                    current = '';
                }
                inBracket = false;
            } else if (ch === '.' && !inBracket) {
                if (current) {
                    segments.push(current);
                    current = '';
                }
            } else {
                current += ch;
            }
        }
        
        if (current) {
            segments.push(current);
        }
        
        // 逐段读取
        var value = obj;
        for (var j = 0; j < segments.length; j++) {
            if (value === null || value === undefined) return defaultValue;
            
            var segment = segments[j];
            
            // 尝试转换为数字（数组索引）
            var index = Number(segment);
            if (Number.isInteger(index) && index >= 0) {
                value = value[index];
            } else {
                value = value[segment];
            }
        }
        
        return value !== undefined ? value : defaultValue;
    }

    /**
     * 格式化显示值（数字/数组/对象/空值）
     * @param {*} value - 要格式化的值
     * @param {string} [emptyText='--'] - 空值时的显示文本
     * @returns {string} 格式化后的字符串
     * 
     * @example
     * displayValue(123) // => '123'
     * displayValue([1, 2, 3]) // => '1, 2, 3'
     * displayValue({a: 1}) // => '{"a":1}'
     * displayValue(null) // => '--'
     * displayValue(undefined, '无') // => '无'
     */
    function displayValue(value, emptyText) {
        if (emptyText === undefined) emptyText = '--';
        
        if (value === null || value === undefined) return emptyText;
        
        if (typeof value === 'string') {
            return value || emptyText;
        }
        
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
        
        if (Array.isArray(value)) {
            if (value.length === 0) return emptyText;
            return value.map(function(item) {
                if (typeof item === 'object' && item !== null) {
                    return JSON.stringify(item);
                }
                return String(item);
            }).join(', ');
        }
        
        if (typeof value === 'object') {
            var keys = Object.keys(value);
            if (keys.length === 0) return emptyText;
            return JSON.stringify(value);
        }
        
        return String(value);
    }

    /**
     * 检查值是否应该渲染（非空、非 undefined、非空数组/对象）
     * @param {*} value - 要检查的值
     * @returns {boolean} 是否应该渲染
     */
    function shouldRenderValue(value) {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string' && !value.trim()) return false;
        if (Array.isArray(value) && value.length === 0) return false;
        if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) return false;
        return true;
    }

    /**
     * 检查值是否为空（空串、空数组、空对象、null、undefined）
     * @param {*} value - 要检查的值
     * @returns {boolean} 是否为空
     */
    function isEmptyValue(value) {
        return !shouldRenderValue(value);
    }

    return {
        statRoot: statRoot,
        safeGet: safeGet,
        displayValue: displayValue,
        shouldRenderValue: shouldRenderValue,
        isEmptyValue: isEmptyValue
    };
})();

if (typeof window !== 'undefined') {
    window.variableUtils = variableUtils;
}
