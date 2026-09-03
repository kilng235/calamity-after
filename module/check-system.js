/**
 * D20 检定系统 (D20 Check System)
 * 
 * 功能：
 * - 执行 D20 检定（普通检定）
 * - 执行对抗检定
 * - 计算属性调整值
 * - 处理优势/劣势
 * - 判定背景特长
 * - 处理天然 20/1
 * 
 * 检定公式：
 * d20 + 属性调整值 + 熟练加值(PB) >= DC
 * 
 * @module check-system
 * @version 1.0.0
 */

import { getD20, get2D20 } from './dice-pool.js';

// ==================== 常量定义 ====================

// 属性调整值速查表（性能优化）
const MODIFIER_TABLE = {
  1: -5, 2: -4, 3: -4,
  4: -3, 5: -3,
  6: -2, 7: -2,
  8: -1, 9: -1,
  10: 0, 11: 0,
  12: 1, 13: 1,
  14: 2, 15: 2,
  16: 3, 17: 3,
  18: 4, 19: 4,
  20: 5, 21: 5,
  22: 6, 23: 6,
  24: 7, 25: 7,
  26: 8, 27: 8,
  28: 9, 29: 9,
  30: 10
};

// DC 难度描述
const DC_DESCRIPTIONS = {
  5: '极易',
  10: '普通',
  15: '困难',
  20: '极难',
  25: '近乎不可能',
  30: '传奇'
};

// 背景特长与属性映射
const BACKGROUND_ATTRIBUTE_MAP = {
  '士兵': ['力量', '体质'],
  '学者': ['智力', '感知'],
  '游荡者': ['敏捷', '魅力'],
  '工匠': ['力量', '智力'],
  '猎人': ['敏捷', '感知'],
  '商人': ['魅力', '智力'],
  '盗贼': ['敏捷'],
  '圣武士': ['魅力', '力量'],
  '法师': ['智力'],
  '牧师': ['感知']
};

// ==================== 核心函数 ====================

/**
 * 计算属性调整值
 * @param {number} attributeValue - 属性值（1-30）
 * @returns {number} 调整值（-5 到 +10）
 */
export function calculateModifier(attributeValue) {
  // 使用速查表（更快）
  if (MODIFIER_TABLE[attributeValue] !== undefined) {
    return MODIFIER_TABLE[attributeValue];
  }
  
  // 回退到公式计算（超出表范围）
  return Math.floor((attributeValue - 10) / 2);
}

/**
 * 解析优势/劣势状态
 * @param {boolean} hasAdvantage - 是否有优势
 * @param {boolean} hasDisadvantage - 是否有劣势
 * @returns {'advantage' | 'disadvantage' | 'none'} 最终状态
 */
export function resolveAdvantage(hasAdvantage, hasDisadvantage) {
  // 优劣抵消
  if (hasAdvantage && hasDisadvantage) {
    return 'none';
  }
  
  if (hasAdvantage) {
    return 'advantage';
  }
  
  if (hasDisadvantage) {
    return 'disadvantage';
  }
  
  return 'none';
}

/**
 * 检查背景特长是否给予优势
 * @param {string} attribute - 检定属性
 * @param {string[]} characterBackgrounds - 角色背景特长列表
 * @param {string[]} relevantSkills - 本次检定相关的背景特长
 * @returns {boolean} 是否获得优势
 */
export function checkBackground(attribute, characterBackgrounds = [], relevantSkills = []) {
  // 检查角色是否拥有相关背景特长
  for (const skill of relevantSkills) {
    if (characterBackgrounds.includes(skill)) {
      // 进一步检查该背景是否对当前属性有效
      const validAttributes = BACKGROUND_ATTRIBUTE_MAP[skill];
      if (validAttributes && validAttributes.includes(attribute)) {
        return true;
      }
      // 如果没有明确映射，默认给予优势
      return true;
    }
  }
  
  return false;
}

/**
 * 格式化检定公式
 * @param {number} roll - 骰值
 * @param {number} modifier - 调整值
 * @param {number} pb - 熟练加值
 * @param {number} customModifier - 自定义调整值
 * @param {number} total - 总值
 * @returns {string} 格式化的公式字符串
 */
function formatFormula(roll, modifier, pb, customModifier, total) {
  const parts = [roll];
  
  if (modifier !== 0) {
    parts.push(`${modifier >= 0 ? '+' : ''}${modifier}`);
  }
  
  if (pb !== 0) {
    parts.push(`+${pb}`);
  }
  
  if (customModifier !== 0) {
    parts.push(`${customModifier >= 0 ? '+' : ''}${customModifier}`);
  }
  
  return `${parts.join(' ')} = ${total}`;
}

/**
 * 生成检定叙事文本
 * @param {string} description - 检定描述
 * @param {boolean} success - 是否成功
 * @param {boolean} criticalSuccess - 是否大成功
 * @param {boolean} criticalFailure - 是否大失败
 * @returns {string} 叙事文本
 */
function formatNarrative(description, success, criticalSuccess, criticalFailure) {
  if (criticalSuccess) {
    return `【大成功】${description}！你完美地达成了目标，甚至获得了额外收益。`;
  }
  
  if (criticalFailure) {
    return `【大失败】${description}失败了！不仅如此，还带来了意想不到的麻烦。`;
  }
  
  if (success) {
    return `【成功】${description}，你成功达成了目标。`;
  }
  
  return `【失败】${description}失败了。`;
}

/**
 * 执行 D20 检定
 * @param {Object} request - 检定请求
 * @param {string} request.attribute - 主属性：'力量' | '敏捷' | '体质' | '感知' | '智力' | '魅力'
 * @param {number} request.dc - 难度值（DC）
 * @param {string} request.description - 检定描述
 * @param {Object} request.gameState - 游戏状态（包含属性、背景、PB）
 * @param {boolean} [request.advantage] - 是否有优势
 * @param {boolean} [request.disadvantage] - 是否有劣势
 * @param {string[]} [request.relevantSkills] - 相关背景特长
 * @param {number} [request.customModifier] - 自定义调整值
 * @returns {Object} 检定结果
 */
export function performCheck(request) {
  // 1. 获取游戏状态
  const gameState = request.gameState || {};
  const attributes = gameState.attributes || {};
  const backgrounds = gameState.backgrounds || [];
  const pb = gameState.proficiencyBonus || 0;
  
  // 2. 获取属性值
  const attributeValue = attributes[request.attribute] || 10;
  const modifier = calculateModifier(attributeValue);
  
  // 3. 检查背景特长
  const hasSkillAdvantage = checkBackground(
    request.attribute,
    backgrounds,
    request.relevantSkills || []
  );
  
  // 4. 解析优势/劣势
  const advantage = request.advantage || hasSkillAdvantage;
  const disadvantage = request.disadvantage || false;
  const finalAdvantage = resolveAdvantage(advantage, disadvantage);
  
  // 5. 掷骰
  let roll, rolls;
  
  if (finalAdvantage === 'none') {
    // 正常掷骰
    const result = getD20();
    roll = result.value;
    rolls = [roll];
  } else {
    // 优势/劣势：掷2次
    const result = get2D20();
    rolls = result.values;
    
    if (finalAdvantage === 'advantage') {
      roll = Math.max(...rolls);
    } else {
      roll = Math.min(...rolls);
    }
  }
  
  // 6. 计算总值
  const customModifier = request.customModifier || 0;
  const total = roll + modifier + pb + customModifier;
  
  // 7. 判定成功/失败
  const success = total >= request.dc;
  const criticalSuccess = roll === 20;
  const criticalFailure = roll === 1;
  
  // 8. 优势来源
  const advantageSources = [];
  if (hasSkillAdvantage && request.relevantSkills) {
    advantageSources.push(`背景「${request.relevantSkills.join('、')}」`);
  }
  if (request.advantage && !hasSkillAdvantage) {
    advantageSources.push('环境因素');
  }
  
  // 9. 构建结果
  return {
    // 基础信息
    type: 'normal',
    attribute: request.attribute,
    description: request.description,
    
    // 骰子结果
    roll: roll,
    rolls: rolls,
    selectedRoll: roll,
    
    // 计算过程
    attributeValue: attributeValue,
    modifier: modifier,
    proficiencyBonus: pb,
    customModifier: customModifier,
    total: total,
    
    // 判定结果
    dc: request.dc,
    dcDescription: getDCDescription(request.dc),
    success: success,
    criticalSuccess: criticalSuccess,
    criticalFailure: criticalFailure,
    
    // 优势/劣势
    hasAdvantage: finalAdvantage === 'advantage',
    hasDisadvantage: finalAdvantage === 'disadvantage',
    advantageSources: advantageSources,
    
    // 命运点（如果使用）
    fatePointUsed: request.useFatePoint || false,
    
    // 格式化输出
    formula: formatFormula(roll, modifier, pb, customModifier, total),
    narrative: formatNarrative(request.description, success, criticalSuccess, criticalFailure),
    
    // 时间戳
    timestamp: Date.now()
  };
}

/**
 * 执行对抗检定
 * @param {Object} request - 检定请求
 * @param {string} request.attribute - 发起者属性
 * @param {string} request.description - 检定描述
 * @param {Object} request.gameState - 游戏状态
 * @param {Object} request.opponent - 对抗者信息
 * @param {string} request.opponent.attribute - 对抗者属性
 * @param {number} request.opponent.modifier - 对抗者调整值
 * @returns {Object} 检定结果
 */
export function performContestCheck(request) {
  // 1. 发起者检定
  const gameState = request.gameState || {};
  const attributes = gameState.attributes || {};
  const pb = gameState.proficiencyBonus || 0;
  
  const initiatorAttributeValue = attributes[request.attribute] || 10;
  const initiatorModifier = calculateModifier(initiatorAttributeValue);
  
  const initiatorDice = getD20();
  const initiatorRoll = initiatorDice.value;
  const initiatorTotal = initiatorRoll + initiatorModifier + pb;
  
  // 2. 对抗者检定
  const opponentDice = getD20();
  const opponentRoll = opponentDice.value;
  const opponentModifier = request.opponent.modifier || 0;
  const opponentTotal = opponentRoll + opponentModifier;
  
  // 3. 判定胜负（平局发起者胜）
  const success = initiatorTotal >= opponentTotal;
  const criticalSuccess = initiatorRoll === 20 && opponentRoll !== 20;
  const criticalFailure = initiatorRoll === 1 && opponentRoll !== 1;
  
  // 4. 构建结果
  return {
    type: 'contest',
    attribute: request.attribute,
    description: request.description,
    
    // 发起者
    roll: initiatorRoll,
    rolls: [initiatorRoll],
    selectedRoll: initiatorRoll,
    modifier: initiatorModifier,
    proficiencyBonus: pb,
    total: initiatorTotal,
    
    // 对抗者
    opponentRoll: opponentRoll,
    opponentModifier: opponentModifier,
    opponentTotal: opponentTotal,
    
    // 判定结果
    success: success,
    criticalSuccess: criticalSuccess,
    criticalFailure: criticalFailure,
    
    // 格式化输出
    formula: `${initiatorRoll} + ${initiatorModifier} + ${pb} = ${initiatorTotal} vs ${opponentTotal}`,
    narrative: formatContestNarrative(request.description, success, criticalSuccess, criticalFailure),
    
    timestamp: Date.now()
  };
}

/**
 * 生成对抗检定叙事文本
 */
function formatContestNarrative(description, success, criticalSuccess, criticalFailure) {
  if (criticalSuccess) {
    return `【压倒性胜利】${description}！你以绝对优势压倒了对手。`;
  }
  
  if (criticalFailure) {
    return `【惨败】${description}失败了！对手完全占据了上风。`;
  }
  
  if (success) {
    return `【胜利】${description}，你赢得了这场较量。`;
  }
  
  return `【失败】${description}失败了，对手更胜一筹。`;
}

/**
 * 获取 DC 难度描述
 * @param {number} dc - 难度值
 * @returns {string} 难度描述
 */
export function getDCDescription(dc) {
  if (dc <= 5) return DC_DESCRIPTIONS[5];
  if (dc <= 10) return DC_DESCRIPTIONS[10];
  if (dc <= 15) return DC_DESCRIPTIONS[15];
  if (dc <= 20) return DC_DESCRIPTIONS[20];
  if (dc <= 25) return DC_DESCRIPTIONS[25];
  return DC_DESCRIPTIONS[30];
}

/**
 * 快速检定（使用默认游戏状态）
 * @param {string} attribute - 属性
 * @param {number} dc - 难度
 * @param {string} description - 描述
 * @returns {Object} 检定结果
 */
export function quickCheck(attribute, dc, description) {
  // 使用默认属性值 10（调整值 0）
  const defaultGameState = {
    attributes: {
      '力量': 10,
      '敏捷': 10,
      '体质': 10,
      '感知': 10,
      '智力': 10,
      '魅力': 10
    },
    backgrounds: [],
    proficiencyBonus: 0
  };
  
  return performCheck({
    attribute,
    dc,
    description,
    gameState: defaultGameState
  });
}

// ==================== 工具函数 ====================

/**
 * 批量计算属性调整值
 * @param {Object} attributes - 属性对象
 * @returns {Object} 调整值对象
 */
export function calculateAllModifiers(attributes) {
  const modifiers = {};
  for (const [attr, value] of Object.entries(attributes)) {
    modifiers[attr] = calculateModifier(value);
  }
  return modifiers;
}

/**
 * 获取属性调整值的符号字符串
 * @param {number} modifier - 调整值
 * @returns {string} '+2' 或 '-1'
 */
export function formatModifier(modifier) {
  return modifier >= 0 ? `+${modifier}` : `${modifier}`;
}

// ==================== 导出 ====================

export default {
  // 核心函数
  performCheck,
  performContestCheck,
  calculateModifier,
  
  // 辅助函数
  resolveAdvantage,
  checkBackground,
  getDCDescription,
  quickCheck,
  
  // 工具函数
  calculateAllModifiers,
  formatModifier
};
