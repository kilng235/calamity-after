/**
 * 炼金系统 - 灾厄之后独立版
 * 基于世界书炼金规则.yaml
 * 
 * 核心功能：
 * - 炼金检定（智力 vs DC）
 * - 配方管理（药水、毒药、增益药剂）
 * - 成败判定（成功出货/失败材料全损/大失败出事故物）
 * - 药效强度骰（d10）
 * - 品级爬升（普通/良品/杰出）
 * - 炼金代工
 */

import { rollDice } from './dice-pool.js';
import { performCheck } from './check-system.js';
import { materialSystem } from './material-system.js';

// ============== DC 档位 ==============

export const ALCHEMY_DC = {
  TIER_1: { dc: 10, name: '一阶', example: '法力药水 5金档' },
  TIER_2: { dc: 15, name: '二阶', example: '法力药水 25金档' },
  TIER_3: { dc: 20, name: '三阶', example: '法力药水 80金档' }
};

// ============== 成败判定 ==============

export const ALCHEMY_RESULT = {
  SUCCESS: '成功',
  FAILURE: '失败',
  CRITICAL_FAILURE: '大失败'
};

// ============== 药效强度骰 ==============

export const POTION_STRENGTH = {
  WEAK: { min: 1, max: 2, name: '弱', multiplier: 0.5, note: '药效按配方基线一半，或带轻微副作用' },
  STANDARD: { min: 3, max: 7, name: '标准', multiplier: 1.0, note: '按配方基线全效' },
  STRONG: { min: 8, max: 9, name: '强', multiplier: 2.0, note: '药效按基线加倍，或附加 1 条增益状态' },
  PERFECT: { min: 10, max: 10, name: '完美', multiplier: 2.5, note: '药效上限 + 保留 1 个配方特质' }
};

// ============== 品级爬升 ==============

export const ALCHEMY_GRADE = {
  NORMAL: { min: 0, max: 4, name: '普通', bonus: 0 },
  GOOD: { min: 5, max: 9, name: '良品', bonus: 1 }, // 强度骰结果 +1 档
  EXCELLENT: { min: 10, max: Infinity, name: '杰出', bonus: 2 } // 强度骰结果 +1 档 + 配方特质
};

// ============== 失败瑕疵词条 ==============

export const FAILURE_FLAWS = [
  { name: '杂质', effect: '药效混乱、副作用', narrative: '药液浑浊，散发刺鼻气味' },
  { name: '不稳定', effect: '碰撤易炸、需即时使用', narrative: '瓶内液体不断冒泡，随时可能爆裂' },
  { name: '剧毒', effect: '误用中毒', narrative: '药液呈现不祥的暗紫色，散发致命毒气' }
];

// ============== 炼金代工 ==============

export const ALchemists = {
  '杜兰·碎星': {
    location: '流浪（锈钉镇偶驻）',
    race: '犬人',
    specialty: '稀有炼金、禁忌药剂、灾厄金属精炼',
    priceModifier: 1.40, // +30~50%
    note: '流浪炼金术士，唯一可加工禁术材料的铁匠'
  },
  '艾莉丝': {
    location: '锈钉镇「苔藓与露」药剂店',
    race: '银叶精灵',
    specialty: '银叶药剂、净化苔藓、草药',
    priceModifier: 1.0, // 基准价
    note: '出售成品，不接代工'
  },
  '艾拉·棘藤': {
    location: '灰烬森林',
    race: '精灵',
    specialty: '草药工艺、自然系',
    priceModifier: 1.30, // +20~40%
    note: '银叶营地合作订单，自然系专精'
  }
};

// ============== 炼金配方模板 ==============

export const ALCHEMY_RECIPES = {
  // 治疗类
  '治疗药水': {
    tier: 1,
    dc: 10,
    basePrice: 2,
    baseEffect: '恢复 20 生命值',
    category: '治疗',
    materials: { '草药': 2, '清水': 1 }
  },
  '强效治疗药水': {
    tier: 2,
    dc: 15,
    basePrice: 25,
    baseEffect: '恢复 50 生命值',
    category: '治疗',
    materials: { '草药': 5, '魔力精华': 1, '清水': 1 }
  },
  '超级治疗药水': {
    tier: 3,
    dc: 20,
    basePrice: 80,
    baseEffect: '恢复 100 生命值',
    category: '治疗',
    materials: { '稀有草药': 3, '魔力结晶': 2, '圣水': 1 }
  },

  // 法力类
  '法力药水（小）': {
    tier: 1,
    dc: 10,
    basePrice: 5,
    baseEffect: '恢复 10 法力值',
    category: '法力',
    materials: { '魔力苔藓': 2, '清水': 1 }
  },
  '法力药水（中）': {
    tier: 2,
    dc: 15,
    basePrice: 25,
    baseEffect: '恢复 25 法力值',
    category: '法力',
    materials: { '魔力苔藓': 5, '能量晶簇': 1, '清水': 1 }
  },
  '法力药水（大）': {
    tier: 3,
    dc: 20,
    basePrice: 80,
    baseEffect: '恢复 50 法力值',
    category: '法力',
    materials: { '稀有魔力苔藓': 3, '能量结晶': 2, '蒸馏水': 1 }
  },

  // 增益类
  '力量药剂': {
    tier: 1,
    dc: 10,
    basePrice: 5,
    baseEffect: '力量检定获优势，持续 1 小时',
    category: '增益',
    materials: { '巨魔之血': 1, '烈酒': 1 }
  },
  '敏捷药剂': {
    tier: 1,
    dc: 10,
    basePrice: 5,
    baseEffect: '敏捷检定获优势，持续 1 小时',
    category: '增益',
    materials: { '豹之筋': 1, '清水': 1 }
  },
  '智力药剂': {
    tier: 2,
    dc: 15,
    basePrice: 15,
    baseEffect: '智力检定获优势，持续 1 小时',
    category: '增益',
    materials: { '猫头鹰羽毛': 2, '墨水': 1 }
  },
  '护体药水': {
    tier: 2,
    dc: 15,
    basePrice: 20,
    baseEffect: 'AC +2，持续 10 回合',
    category: '增益',
    materials: { '铁矿石粉': 3, '树胶': 2 }
  },

  // 毒药类
  '基础毒药': {
    tier: 1,
    dc: 10,
    basePrice: 8,
    baseEffect: '涂抹武器，命中附加中毒状态',
    category: '毒药',
    materials: { '毒蛇腺': 1, '酒精': 1 }
  },
  '麻痹毒素': {
    tier: 2,
    dc: 15,
    basePrice: 25,
    baseEffect: '涂抹武器，命中可能附加麻痹状态',
    category: '毒药',
    materials: { '蜘蛛毒液': 2, '曼陀罗': 1 }
  },
  '致命毒药': {
    tier: 3,
    dc: 20,
    basePrice: 100,
    baseEffect: '摄入即死（体质豁免 DC15 成功则伤害 50）',
    category: '毒药',
    materials: { '灾厄精华': 1, '暗影露水': 2 }
  },

  // 实用类
  '解毒剂': {
    tier: 1,
    dc: 10,
    basePrice: 3,
    baseEffect: '移除一个中毒状态',
    category: '实用',
    materials: { '净化苔藓': 2, '清水': 1 }
  },
  '隐形药水': {
    tier: 2,
    dc: 15,
    basePrice: 30,
    baseEffect: '获得隐形状态，持续 10 回合',
    category: '实用',
    materials: { '变色龙鳞片': 2, '月光草': 1 }
  },
  '抗火药水': {
    tier: 2,
    dc: 15,
    basePrice: 20,
    baseEffect: '火焰抗性，持续 1 小时',
    category: '实用',
    materials: { '火蜥蜴血': 2, '冰霜花': 1 }
  }
};

// ============== 炼金系统类 ==============

class AlchemySystem {
  constructor() {
    this.brewingHistory = [];
  }

  /**
   * 计算材料成本（委托给材料系统）
   * @param {number} basePrice - 成品基准价
   * @returns {number} 自炼成本（基准价 ÷ 2）
   */
  calculateMaterialCost(basePrice) {
    return materialSystem.calculateAlchemyCost(basePrice);
  }

  /**
   * 执行炼金检定
   * @param {Object} character - 角色数据
   * @param {number} dc - 难度等级
   * @param {Object} options - 额外选项
   * @returns {Object} 检定结果
   */
  performAlchemyCheck(character, dc, options = {}) {
    const attributeName = '智力';
    const attributeValue = character.attributes?.[attributeName] || 10;
    const modifier = Math.floor((attributeValue - 10) / 2);

    // 工具优势/劣势
    let advantage = options.advantage || false;
    let disadvantage = options.disadvantage || false;

    if (!character.hasTool?.['炼金工具']) {
      disadvantage = true; // 徒手有劣势
    } else {
      advantage = true; // 持工具获优势
    }

    // 无药剂炼制技能时承受劣势
    if (!character.skills?.['药剂炼制']) {
      disadvantage = true;
    }

    // 执行检定（check-system 契约：attribute + gameState + dc）
    const checkResult = performCheck({
      attribute: attributeName,
      gameState: character,
      dc,
      advantage,
      disadvantage,
      description: '炼金检定'
    });

    // 判定成败
    let result = ALCHEMY_RESULT.SUCCESS;

    if (checkResult.criticalFailure) {
      result = ALCHEMY_RESULT.CRITICAL_FAILURE;
    } else if (checkResult.total < dc) {
      result = ALCHEMY_RESULT.FAILURE;
    }

    // 计算富余值和品级
    const surplus = checkResult.total - dc;
    let grade = ALCHEMY_GRADE.NORMAL;
    
    if (surplus >= 10) {
      grade = ALCHEMY_GRADE.EXCELLENT;
    } else if (surplus >= 5) {
      grade = ALCHEMY_GRADE.GOOD;
    }

    // 天然20品质档上移一档
    if (checkResult.criticalSuccess && result === ALCHEMY_RESULT.SUCCESS) {
      if (grade === ALCHEMY_GRADE.NORMAL) {
        grade = ALCHEMY_GRADE.GOOD;
      } else if (grade === ALCHEMY_GRADE.GOOD) {
        grade = ALCHEMY_GRADE.EXCELLENT;
      }
    }

    const finalResult = {
      ...checkResult,
      attribute: attributeName,
      modifier,
      surplus,
      grade: grade.name,
      gradeBonus: grade.bonus,
      result,
      success: result === ALCHEMY_RESULT.SUCCESS,
      criticalFailure: result === ALCHEMY_RESULT.CRITICAL_FAILURE
    };

    this.brewingHistory.push({
      timestamp: Date.now(),
      result: finalResult,
      character: character.name
    });

    return finalResult;
  }

  /**
   * 掷药效强度骰
   * @param {number} gradeBonus - 品级加成（良品+1，杰出+2）
   * @returns {Object} 强度结果
   */
  rollPotionStrength(gradeBonus = 0) {
    const roll = rollDice(1, 10);
    let strength;

    if (roll >= 10) {
      strength = POTION_STRENGTH.PERFECT;
    } else if (roll >= 8) {
      strength = POTION_STRENGTH.STRONG;
    } else if (roll >= 3) {
      strength = POTION_STRENGTH.STANDARD;
    } else {
      strength = POTION_STRENGTH.WEAK;
    }

    // 品级加成：强度骰结果 +1 档
    let finalStrength = strength;
    if (gradeBonus >= 2) {
      // 杰出：+2档
      if (strength === POTION_STRENGTH.WEAK) {
        finalStrength = POTION_STRENGTH.STRONG;
      } else if (strength === POTION_STRENGTH.STANDARD) {
        finalStrength = POTION_STRENGTH.PERFECT;
      }
    } else if (gradeBonus >= 1) {
      // 良品：+1档
      if (strength === POTION_STRENGTH.WEAK) {
        finalStrength = POTION_STRENGTH.STANDARD;
      } else if (strength === POTION_STRENGTH.STANDARD) {
        finalStrength = POTION_STRENGTH.STRONG;
      } else if (strength === POTION_STRENGTH.STRONG) {
        finalStrength = POTION_STRENGTH.PERFECT;
      }
    }

    return {
      roll,
      strength: strength.name,
      finalStrength: finalStrength.name,
      multiplier: finalStrength.multiplier,
      note: finalStrength.note,
      upgraded: strength !== finalStrength
    };
  }

  /**
   * 炼制药水
   * @param {Object} character - 角色数据
   * @param {string} recipeName - 配方名
   * @param {Object} options - 额外选项
   * @returns {Object} 炼制结果
   */
  brewPotion(character, recipeName, options = {}) {
    const recipe = ALCHEMY_RECIPES[recipeName];
    if (!recipe) {
      return { success: false, error: '未知配方' };
    }

    // 检查材料
    if (!this.hasMaterials(character, recipe.materials)) {
      return { success: false, error: '材料不足' };
    }

    // 计算材料成本
    const materialCost = this.calculateMaterialCost(recipe.basePrice);
    
    // 检查金币
    if ((character.gold || 0) < materialCost) {
      return { success: false, error: '金币不足', required: materialCost };
    }

    // 执行炼金检定
    const checkResult = this.performAlchemyCheck(character, recipe.dc, options);

    // 消耗材料和金币（无论成功失败）
    this.consumeMaterials(character, recipe.materials);
    character.gold -= materialCost;

    // 大失败：出事故物
    if (checkResult.criticalFailure) {
      const flaw = FAILURE_FLAWS[Math.floor(Math.random() * FAILURE_FLAWS.length)];
      return {
        success: false,
        checkResult,
        result: ALCHEMY_RESULT.CRITICAL_FAILURE,
        materialCost,
        accidentItem: {
          name: `事故物·${recipeName}`,
          flaw: flaw.name,
          effect: flaw.effect,
          narrative: flaw.narrative,
          sellPrice: Math.ceil(recipe.basePrice * 0.1) // 事故物只值基准价成数
        },
        message: `大失败！材料全损，获得事故物「${flaw.name}」`
      };
    }

    // 失败：材料全损，无产出
    if (!checkResult.success) {
      return {
        success: false,
        checkResult,
        result: ALCHEMY_RESULT.FAILURE,
        materialCost,
        message: '炼制失败，材料全损，无产出'
      };
    }

    // 成功：掷药效强度骰
    const strengthResult = this.rollPotionStrength(checkResult.gradeBonus);
    
    // 创建药水
    const potion = this.createPotion(recipe, checkResult, strengthResult);

    return {
      success: true,
      checkResult,
      result: ALCHEMY_RESULT.SUCCESS,
      potion,
      strength: strengthResult,
      grade: checkResult.grade,
      materialCost,
      message: `炼制成功！品质：${checkResult.grade}，药效：${strengthResult.finalStrength}`
    };
  }

  /**
   * 检查材料是否足够（委托给材料系统）
   */
  hasMaterials(character, requiredMaterials) {
    return materialSystem.hasMaterials(character, requiredMaterials);
  }

  /**
   * 消耗材料（委托给材料系统）
   */
  consumeMaterials(character, materials) {
    return materialSystem.consumeMaterials(character, materials);
  }

  /**
   * 创建药水
   */
  createPotion(recipe, checkResult, strengthResult) {
    const baseEffectValue = this.parseEffectValue(recipe.baseEffect);
    const finalEffectValue = Math.ceil(baseEffectValue * strengthResult.multiplier);
    
    return {
      id: `potion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `${strengthResult.finalStrength === '完美' ? '完美' : ''}${recipe.name}`.trim(),
      category: recipe.category,
      tier: recipe.tier,
      quality: checkResult.grade,
      strength: strengthResult.finalStrength,
      effect: recipe.baseEffect.replace(/\d+/, finalEffectValue.toString()),
      effectValue: finalEffectValue,
      brewed: true,
      brewedAt: Date.now(),
      basePrice: recipe.basePrice
    };
  }

  /**
   * 解析效果数值
   */
  parseEffectValue(effect) {
    const match = effect.match(/(\d+)/);
    return match ? parseInt(match[1]) : 10;
  }

  /**
   * 使用药水
   */
  usePotion(character, potion) {
    if (!potion.brewed) {
      return { success: false, error: '该物品不是药水' };
    }

    // 应用效果
    let result = {
      success: true,
      potion: potion.name,
      effect: potion.effect,
      message: `使用了${potion.name}`
    };

    // 根据类别应用效果
    switch (potion.category) {
      case '治疗':
        character.hp = Math.min(
          (character.hp || 0) + potion.effectValue,
          character.maxHp || character.hp
        );
        result.healed = potion.effectValue;
        break;
      case '法力':
        character.mp = Math.min(
          (character.mp || 0) + potion.effectValue,
          character.maxMp || character.mp
        );
        result.restored = potion.effectValue;
        break;
      case '增益':
        if (!character.statusEffects) character.statusEffects = [];
        character.statusEffects.push({
          name: potion.name,
          duration: 10,
          effect: potion.effect
        });
        result.buffApplied = true;
        break;
      case '实用':
        // 根据具体效果处理
        result.specialEffect = potion.effect;
        break;
    }

    return result;
  }

  /**
   * 计算代工价格
   */
  calculateAlchemistPrice(basePrice, alchemistName, relationship = '友好') {
    const alchemist = ALchemists[alchemistName];
    if (!alchemist) return basePrice;
    if (alchemistName === '艾莉丝') {
      return { error: '艾莉丝只出售成品，不接代工' };
    }

    let price = basePrice * alchemist.priceModifier;

    // 好感度折扣
    const relationshipModifiers = {
      '冷淡': 1.20,
      '友好': 1.0,
      '信任': 0.90,
      '亲密': 0.75
    };
    price *= relationshipModifiers[relationship] || 1.0;

    return Math.ceil(price);
  }

  /**
   * 获取配方列表
   */
  getRecipeList(category = null) {
    if (category) {
      return Object.entries(ALCHEMY_RECIPES)
        .filter(([_, recipe]) => recipe.category === category)
        .map(([name, recipe]) => ({ name, ...recipe }));
    }
    return Object.entries(ALCHEMY_RECIPES).map(([name, recipe]) => ({ name, ...recipe }));
  }

  /**
   * 获取炼制历史
   */
  getBrewingHistory(characterName) {
    if (characterName) {
      return this.brewingHistory.filter(h => h.character === characterName);
    }
    return this.brewingHistory;
  }
}

// 导出单例
export const alchemySystem = new AlchemySystem();

// 导出类供测试使用
export { AlchemySystem };
