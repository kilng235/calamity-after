/**
 * 骰子系统 (Dice System) - 实时掷骰版本
 * 
 * 功能：
 * - 每次检定时实时生成随机骰值
 * - 支持所有骰子类型 (d20, d4, d6, d8, d10, d12)
 * - 支持优势/劣势（掷2次取高/低）
 * - 简单、直观、刺激
 * 
 * 设计理念：
 * - 拥抱随机性，每次掷骰都是全新的命运
 * - 符合传统 DND 桌游体验
 * - 紧张刺激的即时反馈
 * 
 * @module dice-pool
 * @version 2.0.0 (实时掷骰)
 */

// ==================== 统计数据（可选） ====================

let rollHistory = {
  d20: [],
  d4: [],
  d6: [],
  d8: [],
  d10: [],
  d12: []
};

let rollCounts = {
  d20: 0,
  d4: 0,
  d6: 0,
  d8: 0,
  d10: 0,
  d12: 0
};

// ==================== 核心掷骰函数 ====================

/**
 * 掷一枚指定面数的骰子（模块内部随机源）
 * @param {number} sides - 骰子面数 (4, 6, 8, 10, 12, 20)
 * @returns {number} 骰值 (1 到 sides)
 */
function rollOne(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * 掷多个骰子
 * @param {number} sides - 骰子面数
 * @param {number} count - 骰子数量
 * @returns {number[]} 骰值数组
 */
function rollMultiple(sides, count) {
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(rollOne(sides));
  }
  return results;
}

/**
 * 通用掷骰接口（兼容锻造/炼金/词缀系统的 rollDice(数量, 面数) 签名）
 * @param {number} count - 骰子数量
 * @param {number} [sides] - 骰子面数；省略时按 rollDice(面数) 掷一枚
 * @returns {number} 骰值总和
 */
export function rollDice(count, sides) {
  if (sides === undefined) {
    return rollOne(count);
  }
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += rollOne(sides);
  }
  return total;
}

// ==================== 导出函数 ====================

/**
 * 取用一枚 d20（检定用）
 * @returns {{ value: number, cycled: boolean, timestamp: number }}
 */
export function getD20() {
  const value = rollOne(20);
  
  // 记录统计
  rollCounts.d20++;
  rollHistory.d20.push(value);
  if (rollHistory.d20.length > 100) {
    rollHistory.d20.shift(); // 只保留最近 100 次
  }
  
  return {
    value,
    cycled: false, // 实时掷骰不存在循环
    timestamp: Date.now()
  };
}

/**
 * 取用两枚 d20（优势/劣势用）
 * @returns {{ values: number[], cycled: boolean, rolls: Array }}
 */
export function get2D20() {
  const value1 = rollOne(20);
  const value2 = rollOne(20);
  
  // 记录统计
  rollCounts.d20 += 2;
  rollHistory.d20.push(value1, value2);
  if (rollHistory.d20.length > 100) {
    rollHistory.d20.splice(0, 2);
  }
  
  return {
    values: [value1, value2],
    cycled: false,
    rolls: [
      { value: value1, cycled: false, timestamp: Date.now() },
      { value: value2, cycled: false, timestamp: Date.now() }
    ]
  };
}

/**
 * 取用一枚 d4
 * @returns {{ value: number, cycled: boolean }}
 */
export function getD4() {
  const value = rollDice(4);
  rollCounts.d4++;
  rollHistory.d4.push(value);
  if (rollHistory.d4.length > 100) rollHistory.d4.shift();
  
  return { value, cycled: false };
}

/**
 * 取用一枚 d6
 * @returns {{ value: number, cycled: boolean }}
 */
export function getD6() {
  const value = rollDice(6);
  rollCounts.d6++;
  rollHistory.d6.push(value);
  if (rollHistory.d6.length > 100) rollHistory.d6.shift();
  
  return { value, cycled: false };
}

/**
 * 取用一枚 d8
 * @returns {{ value: number, cycled: boolean }}
 */
export function getD8() {
  const value = rollDice(8);
  rollCounts.d8++;
  rollHistory.d8.push(value);
  if (rollHistory.d8.length > 100) rollHistory.d8.shift();
  
  return { value, cycled: false };
}

/**
 * 取用一枚 d10
 * @returns {{ value: number, cycled: boolean }}
 */
export function getD10() {
  const value = rollDice(10);
  rollCounts.d10++;
  rollHistory.d10.push(value);
  if (rollHistory.d10.length > 100) rollHistory.d10.shift();
  
  return { value, cycled: false };
}

/**
 * 取用一枚 d12
 * @returns {{ value: number, cycled: boolean }}
 */
export function getD12() {
  const value = rollDice(12);
  rollCounts.d12++;
  rollHistory.d12.push(value);
  if (rollHistory.d12.length > 100) rollHistory.d12.shift();
  
  return { value, cycled: false };
}

/**
 * 通用取骰函数
 * @param {string} type - 骰子类型：'d20' | 'd4' | 'd6' | 'd8' | 'd10' | 'd12'
 * @returns {{ value: number, cycled: boolean }}
 */
export function getDice(type) {
  const sides = parseInt(type.substring(1));
  
  if (![4, 6, 8, 10, 12, 20].includes(sides)) {
    throw new Error(`❌ 无效的骰子类型: ${type}`);
  }
  
  const value = rollOne(sides);
  
  // 记录统计
  rollCounts[type]++;
  rollHistory[type].push(value);
  if (rollHistory[type].length > 100) {
    rollHistory[type].shift();
  }
  
  return { value, cycled: false };
}

/**
 * 取用多枚骰子
 * @param {string} type - 骰子类型
 * @param {number} count - 数量
 * @returns {Array<{ value: number, cycled: boolean }>}
 */
export function getMultipleDice(type, count) {
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(getDice(type));
  }
  return results;
}

// ==================== 统计与调试函数 ====================

/**
 * 获取掷骰统计信息
 * @returns {Object} 统计信息
 */
export function getDicePoolStats() {
  const calculateAverage = (history) => {
    if (history.length === 0) return 0;
    const sum = history.reduce((a, b) => a + b, 0);
    return (sum / history.length).toFixed(2);
  };
  
  return {
    totalRolls: Object.values(rollCounts).reduce((a, b) => a + b, 0),
    rollCounts: { ...rollCounts },
    averages: {
      d20: calculateAverage(rollHistory.d20),
      d4: calculateAverage(rollHistory.d4),
      d6: calculateAverage(rollHistory.d6),
      d8: calculateAverage(rollHistory.d8),
      d10: calculateAverage(rollHistory.d10),
      d12: calculateAverage(rollHistory.d12)
    },
    recentD20: rollHistory.d20.slice(-10), // 最近 10 次 d20
    mode: 'real-time' // 标识实时掷骰模式
  };
}

/**
 * 查看最近的掷骰历史
 * @param {string} type - 骰子类型
 * @param {number} count - 查看数量
 * @returns {number[]} 最近的骰值
 */
export function peekDice(type, count = 5) {
  const history = rollHistory[type] || [];
  return history.slice(-count);
}

/**
 * 查看骰子系统状态（调试用）
 * @returns {Object} 状态信息
 */
export function inspectDicePool() {
  return {
    mode: 'real-time',
    initialized: true,
    d20: {
      totalRolled: rollCounts.d20,
      recent10: rollHistory.d20.slice(-10),
      average: getDicePoolStats().averages.d20,
      cycled: false // 实时掷骰不存在循环
    },
    d4: {
      totalRolled: rollCounts.d4,
      recent10: rollHistory.d4.slice(-10),
      average: getDicePoolStats().averages.d4
    },
    d6: {
      totalRolled: rollCounts.d6,
      recent10: rollHistory.d6.slice(-10),
      average: getDicePoolStats().averages.d6
    },
    d8: {
      totalRolled: rollCounts.d8,
      recent10: rollHistory.d8.slice(-10),
      average: getDicePoolStats().averages.d8
    },
    d10: {
      totalRolled: rollCounts.d10,
      recent10: rollHistory.d10.slice(-10),
      average: getDicePoolStats().averages.d10
    },
    d12: {
      totalRolled: rollCounts.d12,
      recent10: rollHistory.d12.slice(-10),
      average: getDicePoolStats().averages.d12
    }
  };
}

// ==================== 管理函数 ====================

/**
 * 重置统计数据
 */
export function resetDicePool() {
  rollHistory = {
    d20: [],
    d4: [],
    d6: [],
    d8: [],
    d10: [],
    d12: []
  };
  
  rollCounts = {
    d20: 0,
    d4: 0,
    d6: 0,
    d8: 0,
    d10: 0,
    d12: 0
  };
  
  console.log('🎲 骰子统计已重置');
  
  // 触发事件
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dice-pool-reset', {
      detail: { userRequested: true, timestamp: Date.now() }
    }));
  }
}

/**
 * 检查骰子系统是否已初始化（兼容性函数）
 * @returns {boolean} 实时掷骰始终返回 true
 */
export function isDicePoolInitialized() {
  return true; // 实时掷骰不需要初始化
}

/**
 * 初始化骰子系统（兼容性函数）
 * @returns {Object} 状态信息
 */
export function initDicePool() {
  console.log('🎲 实时掷骰模式：无需初始化');
  return {
    mode: 'real-time',
    initialized: true,
    message: '实时掷骰模式已启用'
  };
}

// ==================== 页面加载提示 ====================

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    console.log('🎲 骰子系统：实时掷骰模式');
    console.log('✨ 每次检定都会生成全新的随机骰值');
    console.log('🎯 拥抱随机性，享受紧张刺激的体验！');
  });
}

// ==================== 导出 ====================

export default {
  // 核心函数
  rollDice,
  getDice,
  getMultipleDice,
  
  // 便捷函数
  getD20,
  get2D20,
  getD4,
  getD6,
  getD8,
  getD10,
  getD12,
  
  // 统计函数
  getDicePoolStats,
  peekDice,
  inspectDicePool,
  
  // 管理函数
  resetDicePool,
  isDicePoolInitialized,
  initDicePool
};
