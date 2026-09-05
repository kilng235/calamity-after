/**
 * [已冻结] status-system.js - 状态引擎（AI 叙事架构下无调用方）
 *
 * 冻结原因：本项目状态由「AI 叙述 + 世界书规则（状态列表）+ 命令区 conditions 可写根」驱动，
 * 本模块的状态定义（28 条）与元素交互引擎无任何调用方，且与世界书状态列表构成双源。
 * 数据权威源：世界书「状态列表」（28 状态/元素交互/判定提示）；
 * 主角状态持久化由 数据同步协议 conditions 可写根承担（command-processor 白名单钳制）。
 * 若未来需要引擎级状态结算：解冻时须重写，并删世界书状态列表双源。
 */
/**
 * status-system.js - 状态效果系统（灾厄之后·重制版）
 * 
 * 功能：
 * - 管理负面状态和有利状态
 * - 状态应用/移除/持续时间
 * - 状态效果计算（优势/劣势、每回合伤害等）
 * - 元素交互（燃烧+水=熄灭，寒冷+水=麻痹等）
 * 
 * 规则来源：data-source/世界书/系统/状态列表.yaml
 */

// ==================== 状态定义 ====================

/**
 * 负面状态定义
 */
const NEGATIVE_STATUS = {
  '目盲': {
    type: 'negative',
    effect: '需视觉的检定自动失败；自身命中与行动检定劣势，敌方对其命中检定优势',
    removeCondition: '恢复视力',
    onApply: (target) => {
      // 需视觉的检定自动失败
      return { autoFailVision: true, disadvantage: ['attack', 'action'], advantageToEnemy: true };
    }
  },
  '耳聋': {
    type: 'negative',
    effect: '需听觉的检定自动失败；社交类检定劣势',
    removeCondition: '恢复听力',
    onApply: (target) => {
      return { autoFailHearing: true, disadvantage: ['social'] };
    }
  },
  '失能': {
    type: 'negative',
    effect: '无法行动（跳过其行动轮），无法言语与施法',
    removeCondition: '来源结束',
    onApply: (target) => {
      return { cannotAct: true, cannotSpeak: true, cannotCast: true };
    }
  },
  '昏迷': {
    type: 'negative',
    effect: '失能且倒地；对昏迷者的近战命中视为大成功（伤害骰×2）',
    removeCondition: '受击或被摇晃后掷检定苏醒',
    onApply: (target) => {
      return { cannotAct: true, prone: true, criticalHitBonus: true };
    }
  },
  '麻痹': {
    type: 'negative',
    effect: '失能且无法移动；敌方对其命中检定优势',
    removeCondition: '来源结束',
    onApply: (target) => {
      return { cannotAct: true, cannotMove: true, advantageToEnemy: true };
    }
  },
  '震慑': {
    type: 'negative',
    effect: '失能约一回合；敌方对其命中检定优势',
    removeCondition: '时效自然结束',
    duration: 1, // 1 回合
    onApply: (target) => {
      return { cannotAct: true, advantageToEnemy: true };
    }
  },
  '石化': {
    type: 'negative',
    effect: '失能且无法移动，躯体如雕像；受到的伤害减半',
    removeCondition: '解石化手段',
    onApply: (target) => {
      return { cannotAct: true, cannotMove: true, damageReduction: 0.5 };
    }
  },
  '中毒': {
    type: 'negative',
    effect: '自身所有检定劣势',
    removeCondition: '时效过去或服用解毒剂',
    onApply: (target) => {
      return { disadvantage: ['all'] };
    }
  },
  '恐慌': {
    type: 'negative',
    effect: '恐惧源在视线内时自身全部检定劣势；无法主动靠近恐惧源',
    removeCondition: '脱离视线，或掷检定克服',
    onApply: (target, source) => {
      return { disadvantage: ['all'], cannotApproach: source, conditional: true };
    }
  },
  '魅惑': {
    type: 'negative',
    effect: '无法伤害或敌视魅惑源；魅惑源对其魅力类检定优势',
    removeCondition: '魅惑源受伤害，或时效结束',
    onApply: (target, source) => {
      return { cannotHarm: source, charmSource: source };
    }
  },
  '受擒': {
    type: 'negative',
    effect: '无法移动；对擒抱者以外的目标检定劣势',
    removeCondition: '对抗力量检定挣脱，或擒抱者倒下',
    onApply: (target, grappler) => {
      return { cannotMove: true, disadvantage: ['all'], grappler: grappler };
    }
  },
  '束缚': {
    type: 'negative',
    effect: '无法移动；自身检定劣势，敌方对其命中检定优势',
    removeCondition: '割断/破坏束缚物，或掷检定挣脱',
    onApply: (target) => {
      return { cannotMove: true, disadvantage: ['all'], advantageToEnemy: true };
    }
  },
  '倒地': {
    type: 'negative',
    effect: '自身检定劣势；近战对其优势、远程对其劣势',
    removeCondition: '用一次机会行动起身',
    onApply: (target) => {
      return { prone: true, disadvantage: ['all'], meleeAdvantage: true, rangedDisadvantage: true };
    }
  },
  '力竭': {
    type: 'negative',
    effect: '唯一可叠层：1~3 级，每级所有检定总值 −1；满 3 级陷入昏迷',
    removeCondition: '每游戏日完整休息 −1 级',
    stackable: true,
    maxStacks: 3,
    onApply: (target, level = 1) => {
      return { exhaustionLevel: level, checkPenalty: level };
    }
  },
  '燃烧': {
    type: 'negative',
    effect: '每轮末从骰子池取一枚 d6 作伤害，直至扑灭',
    removeCondition: '用主行动扑灭，或环境熄灭',
    dotDamage: '1d6',
    onApply: (target) => {
      return { dot: '1d6', dotType: 'fire' };
    }
  },
  '出血': {
    type: 'negative',
    effect: '每轮末从骰子池取一枚 d4 作伤害，直至包扎',
    removeCondition: '用主行动包扎',
    dotDamage: '1d4',
    onApply: (target) => {
      return { dot: '1d4', dotType: 'bleed' };
    }
  },
  '残废': {
    type: 'negative',
    effect: '对应肢体动作检定劣势',
    removeCondition: '战斗外治疗或完整休息后恢复',
    onApply: (target, limb) => {
      return { limb: limb, disadvantage: ['related'] };
    }
  },
  '失衡': {
    type: 'negative',
    effect: '防御失稳：对该目标的下一次攻击检定获优势',
    removeCondition: '被命中后移除，或回合结束自行恢复',
    duration: 1,
    onApply: (target) => {
      return { offBalance: true };
    }
  },
  '减速': {
    type: 'negative',
    effect: '移动/闪避/先攻检定劣势',
    removeCondition: '来源结束或时效自然结束',
    onApply: (target) => {
      return { disadvantage: ['movement', 'dodge', 'initiative'] };
    }
  },
  '侵蚀': {
    type: 'negative',
    effect: '护甲 AC 加成 −1（可叠 2 层，每层 −1）',
    removeCondition: '战斗结束恢复',
    stackable: true,
    maxStacks: 2,
    onApply: (target, level = 1) => {
      return { acPenalty: level };
    }
  },
  '寒冷': {
    type: 'negative',
    effect: '每轮末从骰子池取一枚 d4 作伤害；遇水/湿环境升级为「麻痹」',
    removeCondition: '脱离寒冷来源或取暖',
    dotDamage: '1d4',
    onApply: (target) => {
      return { dot: '1d4', dotType: 'cold', upgradeCondition: 'wet' };
    }
  },
  '感电': {
    type: 'negative',
    effect: '敏捷相关检定劣势；遇水/湿环境升级为「麻痹」',
    removeCondition: '时效自然结束（约一回合）',
    duration: 1,
    onApply: (target) => {
      return { disadvantage: ['dexterity'], upgradeCondition: 'wet' };
    }
  }
};

/**
 * 有利状态定义
 */
const POSITIVE_STATUS = {
  '隐形': {
    type: 'positive',
    effect: '敌方对其命中检定劣势；其命中与潜行检定优势',
    removeCondition: '发动攻击后显形，或时效结束',
    onApply: (target) => {
      return { advantageToEnemy: false, advantage: ['attack', 'stealth'], invisible: true };
    }
  },
  '加速': {
    type: 'positive',
    effect: '移动/闪避/先攻检定优势；免疫「减速」',
    removeCondition: '时效结束，或被「减速」抵消',
    onApply: (target) => {
      return { advantage: ['movement', 'dodge', 'initiative'], immuneSlow: true };
    }
  },
  '耀眼': {
    type: 'positive',
    effect: '魅力/社交类检定优势',
    removeCondition: '离开对应场景',
    onApply: (target) => {
      return { advantage: ['charisma', 'social'] };
    }
  },
  '灵巧': {
    type: 'positive',
    effect: '巧手/开锁/精密操作类检定优势',
    removeCondition: '离开对应场景',
    onApply: (target) => {
      return { advantage: ['sleightOfHand', 'lockpicking', 'precision'] };
    }
  },
  '专注': {
    type: 'positive',
    effect: '对应领域检定优势；免疫「恐慌」的检定劣势',
    removeCondition: '离开对应场景或时效结束',
    onApply: (target, domain) => {
      return { advantage: [domain], immunePanic: true };
    }
  },
  '护体': {
    type: 'positive',
    effect: '所受劈砍/穿刺/钝击伤害减半（向下取整）',
    removeCondition: '1 轮后自动结束',
    duration: 1,
    onApply: (target) => {
      return { damageReduction: 0.5, damageTypes: ['slashing', 'piercing', 'bludgeoning'] };
    }
  }
};

/**
 * 所有状态合并
 */
const ALL_STATUS = { ...NEGATIVE_STATUS, ...POSITIVE_STATUS };

// ==================== 状态管理 ====================

/**
 * 应用状态到目标
 * @param {Object} target - 目标对象（角色或敌人）
 * @param {string} statusName - 状态名称
 * @param {Object} options - 选项（duration, source, level 等）
 * @returns {Object} 状态应用结果
 */
export function applyStatus(target, statusName, options = {}) {
  const statusDef = ALL_STATUS[statusName];
  if (!statusDef) {
    console.warn(`未知状态：${statusName}`);
    return { success: false, reason: '未知状态' };
  }

  // 初始化目标的状态数组
  if (!target.statuses) {
    target.statuses = [];
  }

  // 检查是否已存在同名状态
  const existingStatus = target.statuses.find(s => s.name === statusName);
  
  // 力竭和侵蚀可叠层
  if (statusDef.stackable) {
    if (existingStatus) {
      const currentLevel = existingStatus.level || 1;
      if (currentLevel >= statusDef.maxStacks) {
        return { success: false, reason: '已达最大叠层' };
      }
      existingStatus.level = currentLevel + 1;
      existingStatus.effects = statusDef.onApply(target, existingStatus.level);
      
      // 力竭满 3 级陷入昏迷
      if (statusName === '力竭' && existingStatus.level >= 3) {
        applyStatus(target, '昏迷');
      }
      
      return { success: true, stacked: true, level: existingStatus.level };
    }
  } else if (existingStatus) {
    // 不可叠层的状态，刷新持续时间
    existingStatus.duration = options.duration || statusDef.duration || -1;
    return { success: true, refreshed: true };
  }

  // 应用新状态
  const newStatus = {
    name: statusName,
    type: statusDef.type,
    duration: options.duration || statusDef.duration || -1, // -1 表示永久
    source: options.source || null,
    level: options.level || 1,
    effects: statusDef.onApply(target, options.source, options.level)
  };

  target.statuses.push(newStatus);

  // 元素交互检查
  checkElementalInteraction(target, statusName);

  return { success: true, applied: newStatus };
}

/**
 * 从目标移除状态
 * @param {Object} target - 目标对象
 * @param {string} statusName - 状态名称
 * @returns {Object} 移除结果
 */
export function removeStatus(target, statusName) {
  if (!target.statuses) {
    return { success: false, reason: '目标无状态' };
  }

  const index = target.statuses.findIndex(s => s.name === statusName);
  if (index === -1) {
    return { success: false, reason: '目标无此状态' };
  }

  const removed = target.statuses.splice(index, 1)[0];
  return { success: true, removed };
}

/**
 * 检查目标是否有某状态
 * @param {Object} target - 目标对象
 * @param {string} statusName - 状态名称
 * @returns {boolean}
 */
export function hasStatus(target, statusName) {
  if (!target.statuses) return false;
  return target.statuses.some(s => s.name === statusName);
}

/**
 * 获取目标的所有状态
 * @param {Object} target - 目标对象
 * @returns {Array} 状态数组
 */
export function getStatuses(target) {
  return target.statuses || [];
}

/**
 * 处理回合结束时的状态效果（DOT、持续时间等）
 * @param {Object} target - 目标对象
 * @returns {Object} 回合结束结果（伤害、状态移除等）
 */
export function processEndOfTurn(target) {
  if (!target.statuses) return { damage: 0, removed: [] };

  const results = {
    damage: 0,
    damageType: null,
    removed: []
  };

  // 处理 DOT 伤害
  target.statuses.forEach(status => {
    if (status.effects && status.effects.dot) {
      // 简单处理：取平均值（后续可接入骰子系统）
      const dotMatch = status.effects.dot.match(/(\d+)d(\d+)/);
      if (dotMatch) {
        const numDice = parseInt(dotMatch[1]);
        const diceSize = parseInt(dotMatch[2]);
        const avgDamage = numDice * (diceSize + 1) / 2;
        results.damage += avgDamage;
        results.damageType = status.effects.dotType;
      }
    }
  });

  // 处理持续时间
  target.statuses = target.statuses.filter(status => {
    if (status.duration === -1) return true; // 永久
    if (status.duration > 0) {
      status.duration--;
      if (status.duration <= 0) {
        results.removed.push(status.name);
        return false;
      }
    }
    return true;
  });

  return results;
}

/**
 * 检查元素交互
 * @param {Object} target - 目标对象
 * @param {string} newStatus - 新应用的状态
 */
function checkElementalInteraction(target, newStatus) {
  if (!target.statuses) return;

  // 水熄：燃烧 + 水 → 燃烧解除
  if (newStatus === '水' && hasStatus(target, '燃烧')) {
    removeStatus(target, '燃烧');
  }

  // 毒燃：火焰 + 中毒 → 中毒解除，转为燃烧
  if (newStatus === '火焰' && hasStatus(target, '中毒')) {
    removeStatus(target, '中毒');
    applyStatus(target, '燃烧');
  }

  // 寒凝：寒冷 + 水 → 升级为麻痹
  if (hasStatus(target, '寒冷') && newStatus === '水') {
    removeStatus(target, '寒冷');
    applyStatus(target, '麻痹');
  }

  // 电涌：感电 + 水 → 升级为麻痹
  if (hasStatus(target, '感电') && newStatus === '水') {
    removeStatus(target, '感电');
    applyStatus(target, '麻痹');
  }

  // 寒火互克：寒冷 + 火焰 → 互相解除
  if (newStatus === '火焰' && hasStatus(target, '寒冷')) {
    removeStatus(target, '寒冷');
  }
  if (newStatus === '寒冷' && hasStatus(target, '火焰')) {
    removeStatus(target, '火焰');
  }

  // 速滞互消：加速 + 减速 → 互相解除
  if (newStatus === '加速' && hasStatus(target, '减速')) {
    removeStatus(target, '减速');
    removeStatus(target, '加速');
  }
  if (newStatus === '减速' && hasStatus(target, '加速')) {
    removeStatus(target, '加速');
    removeStatus(target, '减速');
  }
}

/**
 * 获取状态对检定的影响
 * @param {Object} target - 目标对象
 * @param {string} checkType - 检定类型（attack, social, dexterity 等）
 * @returns {Object} 影响结果 { advantage, disadvantage, autoFail }
 */
export function getStatusEffectOnCheck(target, checkType) {
  if (!target.statuses) return { advantage: false, disadvantage: false, autoFail: false };

  const result = {
    advantage: false,
    disadvantage: false,
    autoFail: false,
    penalty: 0
  };

  target.statuses.forEach(status => {
    const effects = status.effects;
    if (!effects) return;

    // 力竭的检定惩罚
    if (effects.checkPenalty) {
      result.penalty += effects.checkPenalty;
    }

    // 优势
    if (effects.advantage) {
      if (effects.advantage.includes('all') || effects.advantage.includes(checkType)) {
        result.advantage = true;
      }
    }

    // 劣势
    if (effects.disadvantage) {
      if (effects.disadvantage.includes('all') || effects.disadvantage.includes(checkType)) {
        result.disadvantage = true;
      }
    }

    // 自动失败
    if (effects.autoFailVision && ['perception', 'attack'].includes(checkType)) {
      result.autoFail = true;
    }
    if (effects.autoFailHearing && ['social', 'perception'].includes(checkType)) {
      result.autoFail = true;
    }
  });

  return result;
}

/**
 * 清除目标的所有状态
 * @param {Object} target - 目标对象
 */
export function clearAllStatuses(target) {
  if (target.statuses) {
    target.statuses = [];
  }
}

// ==================== 导出 ====================

export default {
  NEGATIVE_STATUS,
  POSITIVE_STATUS,
  ALL_STATUS,
  applyStatus,
  removeStatus,
  hasStatus,
  getStatuses,
  processEndOfTurn,
  getStatusEffectOnCheck,
  clearAllStatuses
};
