/**
 * 骰子池系统 (Dice Pool System)
 * 
 * 功能：
 * - 预掷 75 枚骰子（d20×15, d4/d6/d8/d10/d12×10）
 * - 依次取用（不可跳选、不可编造）
 * - 用完循环重复使用
 * - 持久化存储
 * 
 * 核心规则：
 * 1. 第一次检定用第一枚骰子，第二次用第二枚，依此类推
 * 2. 不得跳选有利骰子，必须按顺序使用
 * 3. 用完后循环使用（并在输出中标注"骰子池循环"）
 * 4. 只在游戏开始或用户明确要求时刷新
 * 
 * @module dice-pool
 * @version 1.0.0
 */

// ==================== 常量定义 ====================

const DICE_CONFIG = {
  d20: 15,   // 检定用
  d4: 10,    // 匕首/法杖
  d6: 10,    // 短剑/铁斧/猎弓
  d8: 10,    // 铁剑/长弓
  d10: 10,   // 双手剑/战斧
  d12: 10    // 重弩
};

const STORAGE_KEY = 'calamity-dice-pool';

// ==================== 模块级缓存 ====================

let cachedPool = null;

// ==================== 核心数据结构 ====================

/**
 * @typedef {Object} DicePoolState
 * @property {number[]} d20 - d20 骰子数组（15 枚）
 * @property {number[]} d4 - d4 骰子数组（10 枚）
 * @property {number[]} d6 - d6 骰子数组（10 枚）
 * @property {number[]} d8 - d8 骰子数组（10 枚）
 * @property {number[]} d10 - d10 骰子数组（10 枚）
 * @property {number[]} d12 - d12 骰子数组（10 枚）
 * @property {Object} indices - 当前使用索引
 * @property {Object} totalUsed - 总使用次数
 * @property {number} createdAt - 创建时间戳
 */

// ==================== 工具函数 ====================

/**
 * 掷多个骰子
 * @param {number} sides - 骰子面数
 * @param {number} count - 骰子数量
 * @returns {number[]} 骰子结果数组
 */
function rollMultiple(sides, count) {
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(Math.floor(Math.random() * sides) + 1);
  }
  return results;
}

/**
 * 保存骰子池到存储
 * @param {DicePoolState} pool - 骰子池状态
 */
function saveDicePool(pool) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pool));
    cachedPool = pool;
  } catch (error) {
    console.error('❌ 保存骰子池失败:', error);
  }
}

/**
 * 从存储加载骰子池
 * @returns {DicePoolState|null} 骰子池状态，如果不存在返回 null
 */
function loadDicePoolFromStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const pool = JSON.parse(saved);
      cachedPool = pool;
      return pool;
    }
  } catch (error) {
    console.error('❌ 加载骰子池失败:', error);
  }
  return null;
}

// ==================== 导出函数 ====================

/**
 * 初始化骰子池（预掷所有骰子）
 * @returns {DicePoolState} 骰子池状态
 */
export function initDicePool() {
  console.log('🎲 初始化骰子池...');
  
  const pool = {
    // 预掷所有骰子
    d20: rollMultiple(20, DICE_CONFIG.d20),
    d4: rollMultiple(4, DICE_CONFIG.d4),
    d6: rollMultiple(6, DICE_CONFIG.d6),
    d8: rollMultiple(8, DICE_CONFIG.d8),
    d10: rollMultiple(10, DICE_CONFIG.d10),
    d12: rollMultiple(12, DICE_CONFIG.d12),
    
    // 当前使用索引
    indices: {
      d20: 0,
      d4: 0,
      d6: 0,
      d8: 0,
      d10: 0,
      d12: 0
    },
    
    // 总使用次数（用于判断是否循环）
    totalUsed: {
      d20: 0,
      d4: 0,
      d6: 0,
      d8: 0,
      d10: 0,
      d12: 0
    },
    
    // 元数据
    createdAt: Date.now()
  };
  
  // 保存到存储
  saveDicePool(pool);
  
  console.log('✅ 骰子池初始化完成');
  console.log(`   d20: ${pool.d20.slice(0, 5).join(', ')}...`);
  
  return pool;
}

/**
 * 从骰子池取用一枚骰子
 * @param {string} type - 骰子类型：'d20' | 'd4' | 'd6' | 'd8' | 'd10' | 'd12'
 * @returns {{ value: number, cycled: boolean, index: number }} 骰子结果
 */
export function getDice(type) {
  // 验证类型
  if (!DICE_CONFIG[type]) {
    throw new Error(`❌ 无效的骰子类型: ${type}`);
  }
  
  // 加载骰子池（优先使用缓存）
  let pool = cachedPool || loadDicePoolFromStorage();
  
  // 如果不存在，初始化
  if (!pool) {
    pool = initDicePool();
  }
  
  // 获取当前索引和骰子数组
  const index = pool.indices[type];
  const diceArray = pool[type];
  const arrayLength = diceArray.length;
  
  // 取用骰子
  const value = diceArray[index];
  
  // 更新索引（循环）
  pool.indices[type] = (index + 1) % arrayLength;
  
  // 更新总使用次数
  pool.totalUsed[type]++;
  
  // 判断是否循环（超过数组长度表示已循环）
  const cycled = pool.totalUsed[type] > arrayLength;
  
  // 保存状态
  saveDicePool(pool);
  
  // 调试日志
  if (cycled && pool.totalUsed[type] === arrayLength + 1) {
    console.log(`🔄 ${type} 骰子池循环使用`);
  }
  
  return { 
    value, 
    cycled,
    index: pool.totalUsed[type] // 返回总使用次数作为索引
  };
}

/**
 * 取用多枚骰子（用于优势/劣势）
 * @param {string} type - 骰子类型
 * @param {number} count - 数量
 * @returns {Array<{ value: number, cycled: boolean }>} 骰子结果数组
 */
export function getMultipleDice(type, count) {
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(getDice(type));
  }
  return results;
}

// ==================== 便捷访问函数 ====================

/**
 * 取用一枚 d20（检定用）
 * @returns {{ value: number, cycled: boolean }}
 */
export function getD20() {
  return getDice('d20');
}

/**
 * 取用两枚 d20（优势/劣势用）
 * @returns {{ values: number[], cycled: boolean, rolls: Array }}
 */
export function get2D20() {
  const results = getMultipleDice('d20', 2);
  return {
    values: results.map(r => r.value),
    cycled: results.some(r => r.cycled),
    rolls: results
  };
}

/**
 * 取用一枚 d4
 * @returns {{ value: number, cycled: boolean }}
 */
export function getD4() {
  return getDice('d4');
}

/**
 * 取用一枚 d6
 * @returns {{ value: number, cycled: boolean }}
 */
export function getD6() {
  return getDice('d6');
}

/**
 * 取用一枚 d8
 * @returns {{ value: number, cycled: boolean }}
 */
export function getD8() {
  return getDice('d8');
}

/**
 * 取用一枚 d10
 * @returns {{ value: number, cycled: boolean }}
 */
export function getD10() {
  return getDice('d10');
}

/**
 * 取用一枚 d12
 * @returns {{ value: number, cycled: boolean }}
 */
export function getD12() {
  return getDice('d12');
}

// ==================== 调试与查看函数 ====================

/**
 * 查看接下来的 N 枚骰子（不消耗）
 * @param {string} type - 骰子类型
 * @param {number} count - 查看数量（默认 5）
 * @returns {number[]} 接下来 N 枚骰子的值
 */
export function peekDice(type, count = 5) {
  const pool = cachedPool || loadDicePoolFromStorage();
  
  if (!pool) {
    return [];
  }
  
  const diceArray = pool[type];
  const startIndex = pool.indices[type];
  const arrayLength = diceArray.length;
  
  const results = [];
  for (let i = 0; i < count; i++) {
    const index = (startIndex + i) % arrayLength;
    results.push(diceArray[index]);
  }
  
  return results;
}

/**
 * 查看骰子池完整状态（调试用）
 * @returns {Object} 骰子池状态摘要
 */
export function inspectDicePool() {
  const pool = cachedPool || loadDicePoolFromStorage();
  
  if (!pool) {
    return { initialized: false };
  }
  
  return {
    initialized: true,
    d20: {
      next5: peekDice('d20', 5),
      currentIndex: pool.indices.d20,
      totalUsed: pool.totalUsed.d20,
      cycled: pool.totalUsed.d20 > DICE_CONFIG.d20,
      totalDice: DICE_CONFIG.d20
    },
    d4: {
      next5: peekDice('d4', 5),
      currentIndex: pool.indices.d4,
      totalUsed: pool.totalUsed.d4,
      cycled: pool.totalUsed.d4 > DICE_CONFIG.d4
    },
    d6: {
      next5: peekDice('d6', 5),
      currentIndex: pool.indices.d6,
      totalUsed: pool.totalUsed.d6,
      cycled: pool.totalUsed.d6 > DICE_CONFIG.d6
    },
    d8: {
      next5: peekDice('d8', 5),
      currentIndex: pool.indices.d8,
      totalUsed: pool.totalUsed.d8,
      cycled: pool.totalUsed.d8 > DICE_CONFIG.d8
    },
    d10: {
      next5: peekDice('d10', 5),
      currentIndex: pool.indices.d10,
      totalUsed: pool.totalUsed.d10,
      cycled: pool.totalUsed.d10 > DICE_CONFIG.d10
    },
    d12: {
      next5: peekDice('d12', 5),
      currentIndex: pool.indices.d12,
      totalUsed: pool.totalUsed.d12,
      cycled: pool.totalUsed.d12 > DICE_CONFIG.d12
    },
    createdAt: new Date(pool.createdAt).toLocaleString('zh-CN'),
    totalDiceUsed: Object.values(pool.totalUsed).reduce((sum, val) => sum + val, 0)
  };
}

/**
 * 重置骰子池（重新掷所有骰子）
 * @param {boolean} userRequested - 是否用户主动要求
 * @returns {DicePoolState} 新的骰子池
 */
export function resetDicePool(userRequested = false) {
  if (userRequested) {
    console.log('🎲 用户要求重新掷骰池');
  } else {
    console.log('🎲 系统重新掷骰池');
  }
  
  const newPool = initDicePool();
  
  // 触发事件（供 UI 监听）
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dice-pool-reset', {
      detail: { userRequested, timestamp: Date.now() }
    }));
  }
  
  return newPool;
}

/**
 * 检查骰子池是否已初始化
 * @returns {boolean}
 */
export function isDicePoolInitialized() {
  if (cachedPool) return true;
  
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved !== null;
  } catch {
    return false;
  }
}

/**
 * 获取骰子池统计信息
 * @returns {Object} 统计信息
 */
export function getDicePoolStats() {
  const pool = cachedPool || loadDicePoolFromStorage();
  
  if (!pool) {
    return { initialized: false };
  }
  
  // 计算每种骰子的平均值
  const calculateAverage = (diceArray) => {
    const sum = diceArray.reduce((a, b) => a + b, 0);
    return (sum / diceArray.length).toFixed(2);
  };
  
  return {
    initialized: true,
    averages: {
      d20: calculateAverage(pool.d20),
      d4: calculateAverage(pool.d4),
      d6: calculateAverage(pool.d6),
      d8: calculateAverage(pool.d8),
      d10: calculateAverage(pool.d10),
      d12: calculateAverage(pool.d12)
    },
    totalDice: 75,
    totalUsed: Object.values(pool.totalUsed).reduce((sum, val) => sum + val, 0),
    createdAt: new Date(pool.createdAt).toLocaleString('zh-CN')
  };
}

// ==================== 模块初始化 ====================

// 页面加载时检查骰子池是否存在
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    if (!isDicePoolInitialized()) {
      console.log('🎲 首次运行，初始化骰子池');
      initDicePool();
    } else {
      console.log('🎲 骰子池已存在，加载中...');
      const pool = loadDicePoolFromStorage();
      if (pool) {
        console.log(`✅ 骰子池加载成功（创建于 ${new Date(pool.createdAt).toLocaleString('zh-CN')}）`);
      }
    }
  });
}

// ==================== 导出 ====================

export default {
  // 核心函数
  initDicePool,
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
  
  // 调试函数
  peekDice,
  inspectDicePool,
  getDicePoolStats,
  
  // 管理函数
  resetDicePool,
  isDicePoolInitialized
};
