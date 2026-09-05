/**
 * game-state.js - 游戏状态管理（灾厄之后·重制版）
 * 
 * 功能：
 * - 管理游戏运行时状态
 * - 提供状态持久化（localStorage）
 * - 支持状态读取和保存
 * 
 * @module game-state
 * @version 1.0.0
 */

// ==================== 默认游戏数据 ====================

const defaultGameData = {
  // 角色基础信息
  character: {
    name: '旅行者',
    race: '人类',
    gender: '男',
    age: 25,
    level: 1,
    exp: 0,
    expToNextLevel: 100,
    proficiencyBonus: 2,  // 熟练加值
    ac: 10  // 护甲等级（由装备系统重算）
  },
  
  // 六维属性（DND 5E）
  attributes: {
    '力量': 10,
    '敏捷': 10,
    '体质': 10,
    '感知': 10,
    '智力': 10,
    '魅力': 10
  },
  
  // 背景特长
  backgrounds: [],
  
  // 命运点
  fatePoints: {
    current: 1,
    max: 1,
    lastRefreshDate: null
  },
  
  // 生命值
  hp: {
    current: 10,
    max: 10
  },
  
  // 装备（10 槽位，与 equipment-system/combat-system 对齐）
  equipment: {
    mainHand: null,
    offHand: null,
    body: null,
    head: null,
    hands: null,
    legs: null,
    feet: null,
    shoulders: null,
    accessory1: null,
    accessory2: null
  },
  
  // 背包
  inventory: [],

  // 技能列表（对齐技能总纲：{name, level(1-3), source, learnedAt}）
  skills: [],

  // 法术列表（对齐法术总纲：{name, school, level(1-3), source, learnedAt}）
  spells: [],
  
  // 金钱
  currency: {
    gold: 50
  },
  
  // 游戏进度
  progress: {
    currentLocation: '佣兵镇',
    currentPlace: '',
    completedQuests: [],
    unlockedLocations: ['佣兵镇']
  },
  
  // 任务系统（对齐 ST 的"任务"顶层容器）
  quests: {
    active: [],      // 进行中的任务
    completed: [],   // 已完成的任务
    failed: []       // 失败的任务
  },
  
  // 关系系统
  relationships: {},
  
  // 游戏时间（灾厄纪年，与登记册开局对齐：时间线设定当前为灾厄300年）
  gameTime: {
    year: 300,
    month: 11,
    day: 12,
    hour: 7,
    minute: 10,
    season: '秋'
  },
  
  // 统计数据
  stats: {
    totalChecks: 0,
    successfulChecks: 0,
    criticalSuccesses: 0,
    criticalFailures: 0,
    combatsWon: 0,
    deaths: 0
  },
  
  // 元数据
  meta: {
    version: '1.0.0',
    createdAt: Date.now(),
    lastSavedAt: null,
    playTime: 0  // 总游戏时间（分钟）
  }
};

// ==================== 游戏状态对象 ====================

let gameData = structuredClone(defaultGameData);

// ==================== 存储相关 ====================

const STORAGE_KEY = 'calamity-game-state';

/**
 * 保存游戏数据到 localStorage
 * @returns {boolean} 是否保存成功
 */
export function saveGameData() {
  try {
    gameData.meta.lastSavedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gameData));
    console.log('✓ 游戏数据已保存');
    return true;
  } catch (error) {
    console.error('❌ 保存游戏数据失败:', error);
    return false;
  }
}

/**
 * 从 localStorage 加载游戏数据
 * @returns {boolean} 是否加载成功
 */
export function loadGameData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const loaded = JSON.parse(saved);
      // 旧存档迁移（必须在 mergeWithDefaults 之前：合并后 currentPlace 会被默认值填充，无法识别旧存档）：
      // currentPlace 字段引入前创建的存档，若开局仍在锈钉镇，补齐据点名与开局场所
      const prog = loaded.progress || {};
      if (prog.currentPlace === undefined) {
        if (prog.currentLocation === '锈钉镇' || prog.currentLocation === '佣兵镇·锈钉') {
          prog.currentLocation = '佣兵镇·锈钉';
          prog.currentPlace = '佣兵公会大厅';
        } else {
          prog.currentPlace = '';
        }
      }
      gameData = mergeWithDefaults(loaded, defaultGameData);
      console.log('✓ 游戏数据已加载');
      return true;
    }
    console.log('⚠️ 未找到存档，使用默认数据');
    return false;
  } catch (error) {
    console.error('❌ 加载游戏数据失败:', error);
    return false;
  }
}

/**
 * 初始化或加载游戏数据
 * @returns {Object} 游戏数据
 */
export function initGameData() {
  const loaded = loadGameData();
  if (!loaded) {
    console.log('🎮 初始化新游戏');
    gameData = structuredClone(defaultGameData);
    saveGameData();
  }
  return gameData;
}

/**
 * 用外部处理过的状态树整体替换当前 gameData（命令处理器落盘用）。
 * @param {Object} external - 已规范化/钳制的完整 gameData
 * @returns {Object} 替换后的 gameData
 */
export function importGameData(external) {
  if (!external || typeof external !== 'object') return gameData;
  gameData = mergeWithDefaults(external, defaultGameData);
  saveGameData();
  return gameData;
}

/**
 * 重置游戏数据
 * @returns {Object} 重置后的游戏数据
 */
export function resetGameData() {
  gameData = structuredClone(defaultGameData);
  gameData.meta.createdAt = Date.now();
  saveGameData();
  console.log('🔄 游戏数据已重置');
  return gameData;
}

// ==================== 数据访问 ====================

/**
 * 获取当前游戏数据
 * @returns {Object} 游戏数据对象
 */
export function getGameData() {
  return gameData;
}

/**
 * 获取角色属性
 * @returns {Object} 属性对象
 */
export function getAttributes() {
  return gameData.attributes;
}

/**
 * 设置角色属性
 * @param {string} attribute - 属性名
 * @param {number} value - 属性值
 */
export function setAttribute(attribute, value) {
  if (gameData.attributes.hasOwnProperty(attribute)) {
    gameData.attributes[attribute] = Math.max(1, Math.min(30, value));
    saveGameData();
  }
}

/**
 * 获取背景特长
 * @returns {string[]} 背景特长列表
 */
export function getBackgrounds() {
  return gameData.backgrounds;
}

/**
 * 添加背景特长
 * @param {string} background - 背景特长名称
 */
export function addBackground(background) {
  if (!gameData.backgrounds.includes(background)) {
    gameData.backgrounds.push(background);
    saveGameData();
  }
}

/**
 * 获取命运点
 * @returns {Object} 命运点信息
 */
export function getFatePoints() {
  return gameData.fatePoints;
}

/**
 * 使用命运点
 * @returns {boolean} 是否成功使用
 */
export function useFatePoint() {
  if (gameData.fatePoints.current > 0) {
    gameData.fatePoints.current--;
    saveGameData();
    console.log(`✓ 使用命运点，剩余：${gameData.fatePoints.current}`);
    return true;
  }
  console.log('❌ 命运点不足');
  return false;
}

/**
 * 刷新命运点（每游戏日）
 */
export function refreshFatePoints() {
  gameData.fatePoints.current = gameData.fatePoints.max;
  gameData.fatePoints.lastRefreshDate = Date.now();
  saveGameData();
  console.log('✓ 命运点已刷新');
}

/**
 * 获取熟练加值
 * @returns {number} 熟练加值
 */
export function getProficiencyBonus() {
  return gameData.character.proficiencyBonus;
}

// ==================== 金钱管理 ====================

/**
 * 获取金钱
 * @returns {number} 当前金钱
 */
export function getGold() {
  return gameData.currency.gold;
}

/**
 * 增加金钱
 * @param {number} amount - 金额
 */
export function addGold(amount) {
  gameData.currency.gold += amount;
  saveGameData();
  console.log(`✓ 获得 ${amount} 金币`);
}

/**
 * 减少金钱
 * @param {number} amount - 金额
 * @returns {boolean} 是否成功（金钱足够）
 */
export function removeGold(amount) {
  if (gameData.currency.gold >= amount) {
    gameData.currency.gold -= amount;
    saveGameData();
    console.log(`✓ 支付 ${amount} 金币`);
    return true;
  }
  console.log('❌ 金钱不足');
  return false;
}

// ==================== 经验与升级 ====================

/**
 * 增加经验值
 * @param {number} exp - 经验值
 */
export function addExp(exp) {
  gameData.character.exp += exp;
  console.log(`✓ 获得 ${exp} 经验值`);
  
  // 检查升级
  while (gameData.character.exp >= gameData.character.expToNextLevel) {
    levelUp();
  }
  
  saveGameData();
}

/**
 * 升级
 */
function levelUp() {
  gameData.character.level++;
  gameData.character.exp -= gameData.character.expToNextLevel;
  gameData.character.expToNextLevel = Math.floor(gameData.character.expToNextLevel * 1.5);
  
  // 每 4 级熟练加值 +1
  if (gameData.character.level % 4 === 0) {
    gameData.character.proficiencyBonus++;
  }
  
  // 生命值增加
  gameData.hp.max += 5;
  gameData.hp.current = gameData.hp.max;
  
  console.log(`🎉 升级！当前等级：${gameData.character.level}`);
}

// ==================== 任务管理 ====================

/**
 * 添加新任务
 * @param {Object} quest - 任务对象
 * @returns {Object} 添加后的任务
 */
export function addQuest(quest) {
  if (!quest || !quest.name) {
    console.warn('⚠️ 任务对象缺少 name 字段');
    return null;
  }
  
  const newQuest = {
    id: quest.id || `quest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: quest.name,
    description: quest.description || '',
    type: quest.type || '主线',  // 主线/支线/日常/紧急
    tier: quest.tier || '普通',  // 普通/困难/史诗/传说
    objectives: quest.objectives || [],  // [{description, completed}]
    rewards: quest.rewards || {},
    giver: quest.giver || null,  // 任务发布者
    createdAt: quest.createdAt || Date.now(),
    completedAt: null,
    status: 'active'  // active/completed/failed
  };
  
  gameData.quests.active.push(newQuest);
  saveGameData();
  console.log(`✓ 新任务：${newQuest.name}`);
  return newQuest;
}

/**
 * 完成任务
 * @param {string} questId - 任务 ID
 * @returns {boolean} 是否成功
 */
export function completeQuest(questId) {
  const index = gameData.quests.active.findIndex(q => q.id === questId);
  if (index === -1) {
    console.warn(`⚠️ 未找到进行中的任务：${questId}`);
    return false;
  }
  
  const quest = gameData.quests.active[index];
  quest.status = 'completed';
  quest.completedAt = Date.now();
  
  // 从 active 移到 completed
  gameData.quests.active.splice(index, 1);
  gameData.quests.completed.push(quest);
  
  // 同步到 progress.completedQuests（向后兼容）
  if (!gameData.progress.completedQuests.includes(quest.name)) {
    gameData.progress.completedQuests.push(quest.name);
  }
  
  saveGameData();
  console.log(`✓ 任务完成：${quest.name}`);
  return true;
}

/**
 * 任务失败
 * @param {string} questId - 任务 ID
 * @returns {boolean} 是否成功
 */
export function failQuest(questId) {
  const index = gameData.quests.active.findIndex(q => q.id === questId);
  if (index === -1) {
    console.warn(`⚠️ 未找到进行中的任务：${questId}`);
    return false;
  }
  
  const quest = gameData.quests.active[index];
  quest.status = 'failed';
  quest.completedAt = Date.now();
  
  gameData.quests.active.splice(index, 1);
  gameData.quests.failed.push(quest);
  
  saveGameData();
  console.log(`✗ 任务失败：${quest.name}`);
  return true;
}

/**
 * 获取进行中的任务
 * @returns {Object[]} 进行中的任务列表
 */
export function getActiveQuests() {
  return gameData.quests.active;
}

/**
 * 根据名称查找任务
 * @param {string} questName - 任务名称
 * @returns {Object|null} 任务对象
 */
export function findQuestByName(questName) {
  const allQuests = [
    ...gameData.quests.active,
    ...gameData.quests.completed,
    ...gameData.quests.failed
  ];
  return allQuests.find(q => q.name === questName) || null;
}

/**
 * 更新任务目标进度
 * @param {string} questId - 任务 ID
 * @param {number} objectiveIndex - 目标索引
 * @param {boolean} completed - 是否完成
 * @returns {boolean} 是否成功
 */
export function updateQuestObjective(questId, objectiveIndex, completed) {
  const quest = gameData.quests.active.find(q => q.id === questId);
  if (!quest || !quest.objectives[objectiveIndex]) {
    console.warn(`⚠️ 未找到任务或目标：${questId}[${objectiveIndex}]`);
    return false;
  }
  
  quest.objectives[objectiveIndex].completed = completed;
  saveGameData();
  return true;
}

// ==================== 统计数据 ====================

/**
 * 记录检定
 * @param {boolean} success - 是否成功
 * @param {boolean} critical - 是否天然 20/1
 */
export function recordCheck(success, critical = false) {
  gameData.stats.totalChecks++;
  if (success) {
    gameData.stats.successfulChecks++;
    if (critical) {
      gameData.stats.criticalSuccesses++;
    }
  } else if (critical) {
    gameData.stats.criticalFailures++;
  }
  saveGameData();
}

/**
 * 获取统计数据
 * @returns {Object} 统计数据
 */
export function getStats() {
  return gameData.stats;
}

// ==================== 工具函数 ====================

/**
 * 深度合并对象（用于版本兼容）
 * @param {Object} loaded - 加载的数据
 * @param {Object} defaults - 默认数据
 * @returns {Object} 合并后的数据
 */
function mergeWithDefaults(loaded, defaults) {
  const merged = structuredClone(defaults);
  
  function deepMerge(target, source) {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        target[key] = target[key] || {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }
  
  deepMerge(merged, loaded);
  return merged;
}

/**
 * 检查存档是否存在
 * @returns {boolean}
 */
export function hasSaveData() {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

// ==================== 旧档迁移 ====================

const EQUIPMENT_SLOT_ALIASES = {
  weapon: 'mainHand',
  mainHand: 'mainHand',
  offHand: 'offHand',
  armor: 'body',
  body: 'body',
  head: 'head',
  hands: 'hands',
  legs: 'legs',
  feet: 'feet',
  shoulders: 'shoulders',
  accessory: 'accessory1',
  accessory1: 'accessory1',
  accessory2: 'accessory2'
};

/**
 * 从旧版 localStorage['character'] 档案迁移到 gameData（唯一真源）。
 * 仅当 gameData 仍是默认角色（旅行者）且旧档案存在时执行。
 * @returns {boolean} 是否执行了迁移
 */
export function migrateFromCharacter() {
  let legacy;
  try {
    legacy = JSON.parse(localStorage.getItem('character') || 'null');
  } catch (error) {
    console.warn('⚠️ 旧角色档案解析失败', error);
    return false;
  }
  if (!legacy) return false;
  if (gameData.character.name !== '旅行者') return false; // 已有真实角色，不覆盖

  const c = gameData.character;
  c.name = legacy.name || c.name;
  c.race = legacy.race || c.race;
  c.gender = legacy.gender || c.gender;
  c.age = Number(legacy.age) || c.age;
  c.level = Number(legacy.level) || c.level;
  c.exp = Number(legacy.exp) || 0;
  c.proficiencyBonus = Number(legacy.proficiencyBonus) || c.proficiencyBonus;
  c.ac = Number(legacy.ac) || c.ac;

  if (legacy.attributes) {
    for (const key of Object.keys(gameData.attributes)) {
      if (Number.isFinite(Number(legacy.attributes[key]))) {
        gameData.attributes[key] = Number(legacy.attributes[key]);
      }
    }
  }
  if (legacy.hp && Number.isFinite(Number(legacy.hp.current))) {
    gameData.hp.current = Number(legacy.hp.current);
    gameData.hp.max = Number(legacy.hp.max) || gameData.hp.max;
  }
  gameData.currency.gold = Number(legacy.gold) || 0;

  if (legacy.equipment && typeof legacy.equipment === 'object') {
    for (const [slot, item] of Object.entries(legacy.equipment)) {
      const target = EQUIPMENT_SLOT_ALIASES[slot];
      if (target && item) gameData.equipment[target] = item;
    }
  }
  if (Array.isArray(legacy.inventory)) gameData.inventory = legacy.inventory;
  if (legacy.backstory) gameData.progress.backstory = legacy.backstory;

  saveGameData();
  console.log('✓ 已从旧角色档案迁移到 calamity-game-state');
  return true;
}

// ==================== 导出 ====================

export default {
  // 数据
  gameData,

  // 初始化与保存
  initGameData,
  loadGameData,
  saveGameData,
  resetGameData,
  hasSaveData,
  importGameData,
  
  // 访问器
  getGameData,
  getAttributes,
  setAttribute,
  getBackgrounds,
  addBackground,
  getFatePoints,
  useFatePoint,
  refreshFatePoints,
  getProficiencyBonus,
  
  // 金钱
  getGold,
  addGold,
  removeGold,
  
  // 经验
  addExp,
  
  // 统计
  recordCheck,
  getStats,

  // 任务
  addQuest,
  completeQuest,
  failQuest,
  getActiveQuests,
  findQuestByName,
  updateQuestObjective,

  // 迁移
  migrateFromCharacter
};

// ==================== 自动初始化 ====================

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    initGameData();
    console.log('🎮 游戏状态系统已加载');
  });
}
