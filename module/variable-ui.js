/**
 * variable-ui.js - 变量→UI 绑定框架（对齐 ST 的 setCardValue / schedulePopulate 范式）
 *
 * 功能：
 * - setCardValue：设置卡片值（空值时隐藏卡片）
 * - setAlwaysCardValue：设置卡片值（始终显示）
 * - schedulePopulate：防抖刷新调度器（对齐 ST 的 VARIABLE_UPDATE_ENDED 事件）
 * - registerSlot：注册变量→UI 绑定槽位
 * - populateAll：根据注册表刷新所有绑定的 UI 元素
 *
 * 对齐 ST 的状态栏刷新机制：
 * - 防抖刷新（默认 80ms）
 * - 签名机制（数据未变则跳过）
 * - 注册表驱动（声明式绑定）
 *
 * @module variable-ui
 * @version 1.0.0
 */

var variableUI = (function() {
    'use strict';

    // ==================== 内部状态 ====================

    var _populateTimer = null;
    var _lastPopulateSignature = null;
    var _slots = [];  // 注册的 UI 绑定槽位

    // ==================== 卡片值设置 ====================

    /**
     * 设置卡片值（空值时隐藏卡片）
     * @param {string} selector - CSS 选择器（值元素）
     * @param {Object} data - 数据对象
     * @param {string} path - 数据路径
     * @param {string} [defaultText='--'] - 默认文本
     * @returns {boolean} 是否成功设置
     * 
     * @example
     * setCardValue('#hp-current', gameData, 'hp.current', '0')
     */
    function setCardValue(selector, data, path, defaultText) {
        if (defaultText === undefined) defaultText = '--';
        
        var $value = document.querySelector(selector);
        if (!$value) return false;
        
        var raw = (window.variableUtils && window.variableUtils.safeGet) 
            ? window.variableUtils.safeGet(data, path) 
            : null;
        
        var $card = $value.closest('.card, .card-full, .quest-card, .info-line');
        
        // 空值检查
        var shouldRender = (window.variableUtils && window.variableUtils.shouldRenderValue)
            ? window.variableUtils.shouldRenderValue(raw)
            : (raw !== null && raw !== undefined && raw !== '');
        
        if (!shouldRender) {
            if ($card) $card.style.display = 'none';
            return false;
        }
        
        // 显示卡片
        if ($card) {
            $card.style.display = '';
            $card.classList.toggle('is-empty', false);
        }
        
        // 设置值
        var displayText = (window.variableUtils && window.variableUtils.displayValue)
            ? window.variableUtils.displayValue(raw, defaultText)
            : String(raw);
        
        $value.textContent = displayText;
        return true;
    }

    /**
     * 设置卡片值（始终显示，即使为空）
     * @param {string} selector - CSS 选择器（值元素）
     * @param {Object} data - 数据对象
     * @param {string} path - 数据路径
     * @param {string} [defaultText='--'] - 默认文本
     * @returns {boolean} 是否成功设置
     */
    function setAlwaysCardValue(selector, data, path, defaultText) {
        if (defaultText === undefined) defaultText = '--';
        
        var $value = document.querySelector(selector);
        if (!$value) return false;
        
        var raw = (window.variableUtils && window.variableUtils.safeGet) 
            ? window.variableUtils.safeGet(data, path) 
            : null;
        
        var displayText = (window.variableUtils && window.variableUtils.displayValue)
            ? window.variableUtils.displayValue(raw, defaultText)
            : String(raw);
        
        $value.textContent = displayText;
        return true;
    }

    // ==================== 防抖刷新调度器 ====================

    /**
     * 防抖刷新调度器（对齐 ST 的 schedulePopulate）
     * @param {number} [delay=80] - 延迟毫秒数
     * @param {boolean} [force=false] - 是否强制刷新（忽略签名检查）
     */
    function schedulePopulate(delay, force) {
        if (delay === undefined) delay = 80;
        if (force === undefined) force = false;
        
        if (_populateTimer) {
            clearTimeout(_populateTimer);
        }
        
        _populateTimer = setTimeout(function() {
            requestAnimationFrame(function() {
                populateAll({ force: force });
            });
        }, delay);
    }

    /**
     * 根据注册表刷新所有绑定的 UI 元素
     * @param {Object} [options] - 选项
     * @param {boolean} [options.force=false] - 是否强制刷新
     */
    function populateAll(options) {
        options = options || {};
        var force = options.force || false;
        
        // 获取统一数据根
        var data = (window.variableUtils && window.variableUtils.statRoot)
            ? window.variableUtils.statRoot()
            : null;
        
        if (!data) {
            console.warn('[VariableUI] 无法获取数据根，跳过刷新');
            return;
        }
        
        // 签名机制（数据未变则跳过）
        var sig = JSON.stringify(data);
        if (!force && sig === _lastPopulateSignature) {
            return;
        }
        _lastPopulateSignature = sig;
        
        // 遍历注册表，刷新每个槽位
        _slots.forEach(function(slot) {
            try {
                var pathValue = slot.path ? (window.variableUtils && window.variableUtils.safeGet
                    ? window.variableUtils.safeGet(data, slot.path)
                    : null) : null;

                if (slot.formatter) {
                    var text = slot.formatter(data, pathValue);
                    var $el = document.querySelector(slot.selector);
                    if ($el) $el.textContent = text;
                } else if (slot.always) {
                    setAlwaysCardValue(slot.selector, data, slot.path, slot.defaultText);
                } else {
                    setCardValue(slot.selector, data, slot.path, slot.defaultText);
                }

                if (slot.secondarySelector && slot.secondaryFormatter) {
                    var secResult = slot.secondaryFormatter(data, pathValue);
                    var $sec = document.querySelector(slot.secondarySelector);
                    if ($sec && secResult !== null && secResult !== undefined) {
                        if (typeof secResult === 'object') {
                            Object.keys(secResult).forEach(function(k) { $sec.style[k] = secResult[k]; });
                        } else {
                            $sec.style.cssText = String(secResult);
                        }
                    }
                }
            } catch (e) {
                console.warn('[VariableUI] 刷新槽位失败:', slot, e);
            }
        });
    }

    // ==================== 注册表 ====================

    /**
     * 注册变量→UI 绑定槽位
     * @param {string} selector - CSS 选择器
     * @param {string} path - 数据路径（传 null 时仅走 formatter）
     * @param {Object} [options] - 选项
     * @param {string} [options.defaultText='--'] - 默认文本
     * @param {boolean} [options.always=false] - 是否始终显示（即使为空）
     * @param {Function} [options.formatter] - 自定义格式化 (data, pathValue) => string
     * @param {string} [options.secondarySelector] - 次要选择器（如 HP 条填充）
     * @param {Function} [options.secondaryFormatter] - 次要格式化 (data, pathValue) => string|object
     * @returns {Object} 注册的槽位对象
     */
    function registerSlot(selector, path, options) {
        options = options || {};
        
        var slot = {
            selector: selector,
            path: path,
            defaultText: options.defaultText || '--',
            always: options.always || false,
            formatter: options.formatter || null,
            secondarySelector: options.secondarySelector || null,
            secondaryFormatter: options.secondaryFormatter || null
        };
        
        _slots.push(slot);
        return slot;
    }

    /**
     * 批量注册变量→UI 绑定槽位
     * @param {Array<{selector, path, options}>} slots - 槽位列表
     * @returns {Array} 注册的槽位对象列表
     */
    function registerSlots(slots) {
        if (!Array.isArray(slots)) return [];
        
        return slots.map(function(item) {
            return registerSlot(item.selector, item.path, item.options);
        });
    }

    /**
     * 清除所有注册的槽位
     */
    function clearSlots() {
        _slots = [];
    }

    /**
     * 获取所有注册的槽位
     * @returns {Array} 槽位列表
     */
    function getSlots() {
        return _slots.slice();
    }

    // ==================== 导出 ====================

    return {
        setCardValue: setCardValue,
        setAlwaysCardValue: setAlwaysCardValue,
        schedulePopulate: schedulePopulate,
        populateAll: populateAll,
        registerSlot: registerSlot,
        registerSlots: registerSlots,
        clearSlots: clearSlots,
        getSlots: getSlots
    };
})();

if (typeof window !== 'undefined') {
    window.variableUI = variableUI;
}
