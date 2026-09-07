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
  TIER_2: { dc: 15, name: '二阶', example: '法力药水（大）80金档（二阶高）' },
  TIER_3: { dc: 20, name: '三阶', example: '传奇法力药水 200金档' }
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
//
// 数据权威源：`data-source/世界书/装备/炼金配方表.yaml`（24 条）+ `data-source/世界书/系统/炼金规则.yaml`
// 字段说明：
//   tier          1=一阶(DC10) / 2=二阶(DC15) / 3=三阶(DC20)
//   category      6 类：恢复 / 法力 / 增益 / 战斗 / 介质 / 稀有禁术
//   dc            检定 DC（一阶10/二阶15/三阶20，权威源在 YAML 每行）
//   basePrice     零售基准价（金）；稀有议价为 null（见 priceRange）
//   baseEffect    标准强度档基线药效
//   materials     配方原料（与 YAML「原料」列对齐，物质名遵循世界书）
//   note          强度档影响 / 补充说明（与 YAML「备注」列对齐）
//   rare          true = 稀有禁术（需代工/授权，AI 与玩家不能自炼）
//   commissionNPC 代工炼金师（null=可自炼；稀有禁术指向杜兰·碎星等）
//   commissionFaction 所需势力授权（如 '圣火骑士团'）
//   priceRange    议价区间 [min, max] 金（稀有禁术用，basePrice=null）
//
// 已知遗留问题（不影响当前契约测试）：
//   - material-system.js 尚未覆盖炼金原料（草药/净化苔藓/圣水 等）；hasMaterials()
//     调用当前会因材料名缺失而返回 false。需后续在 material-system.js 增加
//     `ALCHEMY_MATERIALS` 字典与基础价表，本表原料名以世界书为权威源。
//   - 介质类与稀有禁术类的 usePotion() 行为：介质类不直接作用于角色（用法见
//     「背包系统·使用」），稀有禁术需先经杜兰·碎星代工才进入 gameData。

export const ALCHEMY_RECIPES = {
  // ───────── 恢复类（5） ─────────
  '治疗药水': {
    tier: 1,
    category: '恢复',
    dc: 10,
    basePrice: 6,
    baseEffect: '治疗 20 HP',
    materials: { '草药': 2, '净化苔藓': 1 },
    note: '弱 10 / 强 40 或附再生',
    rare: false,
    commissionNPC: null,
    commissionFaction: null,
    priceRange: null
  },
  '强效治疗药水': {
    tier: 2,
    category: '恢复',
    dc: 15,
    basePrice: 71,
    baseEffect: '治疗 40 HP',
    materials: { '草药': 5, '魔力精华': 1, '清水': 1 },
    note: '二阶',
    rare: false,
    commissionNPC: null,
    commissionFaction: null,
    priceRange: null
  },
  '超级治疗药水': {
    tier: 3,
    category: '恢复',
    dc: 20,
    basePrice: 280,
    baseEffect: '治疗 100 HP',
    materials: { '稀有草药': 3, '魔力结晶': 2, '圣水': 1 },
    note: '三阶，决战备药',
    rare: false,
    commissionNPC: null,
    commissionFaction: null,
    priceRange: null
  },
  '解毒剂': {
    tier: 1,
    category: '恢复',
    dc: 10,
    basePrice: 4,
    baseEffect: '解除中毒·瘴气',
    materials: { '蛇胆': 1, '解毒药草': 1 },
    note: '强可提前免疫短暂',
    rare: false,
    commissionNPC: null,
    commissionFaction: null,
    priceRange: null
  },
  '精力药水': {
    tier: 1,
    category: '恢复',
    dc: 10,
    basePrice: 6,
    baseEffect: '短时免除疲劳劣势',
    materials: { '力量草': 1, '兽骨萃取': 1 },
    note: '完美可延时效',
    rare: false,
    commissionNPC: null,
    commissionFaction: null,
    priceRange: null
  },

  // ───────── 法力类（4）数值对齐世界书：低/中/高阶 5/15/30，传奇全满 ─────────
  '低阶法力药水': {
    tier: 1,
    category: '法力',
    dc: 10,
    basePrice: 100,
    baseEffect: '恢复 5 法力值',
    materials: { '魔力结晶': 1 },
    note: '一阶，日常应急',
    rare: false,
    commissionNPC: null,
    commissionFaction: null,
    priceRange: null
  },
  '中阶法力药水': {
    tier: 2,
    category: '法力',
    dc: 15,
    basePrice: 102,
    baseEffect: '恢复 15 法力值',
    materials: { '魔力结晶': 1, '草药': 1 },
    note: '二阶，战前准备',
    rare: false,
    commissionNPC: null,
    commissionFaction: null,
    priceRange: null
  },
  '高阶法力药水': {
    tier: 2,
    category: '法力',
    dc: 15,
    basePrice: 200,
    baseEffect: '恢复 30 法力值',
    materials: { '能量矿石': 1 },
    note: '二阶高，战役级',
    rare: false,
    commissionNPC: null,
    commissionFaction: null,
    priceRange: null
  },
  '传奇法力药水': {
    tier: 3,
    category: '法力',
    dc: 20,
    basePrice: 1660,
    baseEffect: '恢复全部法力值',
    materials: { '能量晶簇': 2, '魔力精华': 1 },
    note: '三阶，决战/剧情高潮',
    rare: false,
    commissionNPC: null,
    commissionFaction: null,
    priceRange: null
  },

  // ───────── 增益类（4）情境优势 / 状态池，不引入独立数值加成 ─────────
  '力量药剂': {
    tier: 1,
    category: '增益',
    dc: 10,
    basePrice: 4,
    baseEffect: '力量相关检定获优势（有限时）',
    materials: { '力量草': 1, '兽骨': 1 },
    note: '',
    rare: false,
    commissionNPC: null,
    commissionFaction: null,
    priceRange: null
  },
  '银叶药剂': {
    tier: 2,
    category: '增益',
    dc: 15,
    basePrice: 20,
    baseEffect: '疗伤 + 4~6 小时体力回复',
    materials: { '银叶': 1 },
    note: '精灵工艺代表',
    rare: false,
    commissionNPC: null,
    commissionFaction: null,
    priceRange: null
  },
  '暗视药剂': {
    tier: 1,
    category: '增益',
    dc: 10,
    basePrice: 4,
    baseEffect: '暗视 4 小时',
    materials: { '荧光苔藓': 1, '暗视草药': 1 },
    note: '深坑探索标配',
    rare: false,
    commissionNPC: null,
    commissionFaction: null,
    priceRange: null
  },
  '灵巧药剂': {
    tier: 2,
    category: '增益',
    dc: 12,
    basePrice: 4,
    baseEffect: '敏捷相关检定获优势（有限时）',
    materials: { '灵藤': 1, '鸟羽': 1 },
    note: '',
    rare: false,
    commissionNPC: null,
    commissionFaction: null,
    priceRange: null
  },

  // ───────── 战斗类（5）投掷物 / 淬毒 / 负面状态 ─────────
  '火焰瓶': {
    tier: 1,
    category: '战斗',
    dc: 10,
    basePrice: 12,
    baseEffect: '命中即时 1d4 燃烧 / 范围爆燃',
    materials: { '硫磺矿': 1 },
    note: '掷投，中断附「燃烧」',
    rare: false,
    commissionNPC: null,
    commissionFaction: null,
    priceRange: null
  },
  '烟幕弹': {
    tier: 1,
    category: '战斗',
    dc: 10,
    basePrice: 12,
    baseEffect: '遮蔽视线 / 脱战',
    materials: { '硫磺矿': 1 },
    note: '',
    rare: false,
    commissionNPC: null,
    commissionFaction: null,
    priceRange: null
  },
  '麻痹药剂': {
    tier: 2,
    category: '战斗',
    dc: 15,
    basePrice: 64,
    baseEffect: '命中挂「麻痹」状态',
    materials: { '晶壳蝎毒液': 1, '石蜈蚣毒腺': 1 },
    note: '',
    rare: false,
    commissionNPC: null,
    commissionFaction: null,
    priceRange: null
  },
  '腐蚀药剂': {
    tier: 2,
    category: '战斗',
    dc: 15,
    basePrice: 8,
    baseEffect: '蚀甲 /「侵蚀」状态 / 耐久',
    materials: { '灰蛞蝓黏液': 1 },
    note: '',
    rare: false,
    commissionNPC: null,
    commissionFaction: null,
    priceRange: null
  },
  '剧毒油': {
    tier: 1,
    category: '战斗',
    dc: 12,
    basePrice: 4,
    baseEffect: '淬毒：命中附加中毒 DoT',
    materials: { '毒液': 1, '油脂': 1 },
    note: '',
    rare: false,
    commissionNPC: null,
    commissionFaction: null,
    priceRange: null
  },

  // ───────── 介质类（3）施法媒介 / 器具 ─────────
  '魔法墨水': {
    tier: 2,
    category: '介质',
    dc: 15,
    basePrice: 132,
    baseEffect: '卷轴书写 / 施法媒介',
    materials: { '魔力结晶': 1, '晶壳蝎毒液': 1 },
    note: '',
    rare: false,
    commissionNPC: null,
    commissionFaction: null,
    priceRange: null
  },
  '照明药剂': {
    tier: 1,
    category: '介质',
    dc: 10,
    basePrice: 62,
    baseEffect: '照明 / 信号',
    materials: { '荧光苔藓': 1, '磷光菌核': 1 },
    note: '含磷光菌核成本',
    rare: false,
    commissionNPC: null,
    commissionFaction: null,
    priceRange: null
  },
  '净化苔藓粉': {
    tier: 1,
    category: '介质',
    dc: 10,
    basePrice: 2,
    baseEffect: '净水 / 去毒',
    materials: { '净化苔藓': 1 },
    note: '',
    rare: false,
    commissionNPC: null,
    commissionFaction: null,
    priceRange: null
  },

  // ───────── 稀有禁术类（3）灾厄金属 / 禁忌药剂 ─────────
  '禁忌药剂': {
    tier: 3,
    category: '稀有禁术',
    dc: 20,
    basePrice: null,                    // 议价，无基准价
    baseEffect: '强效但高风险（副作用）',
    materials: { '灾厄金属': 1, '禁忌材料': 1 },
    note: '杜兰专精，按议价',
    rare: true,
    commissionNPC: '杜兰·碎星',
    commissionFaction: null,
    priceRange: [100, 500]
  },
  '灾厄金属精炼': {
    tier: 3,
    category: '稀有禁术',
    dc: 20,
    basePrice: null,                    // 加工价（见矿物总纲）
    baseEffect: '提纯为三阶材料',
    materials: { '黑曜铁': 1, '血晶石': 1, '星铁': 1 },
    note: '需势力授权 / 杜兰代工',
    rare: true,
    commissionNPC: '杜兰·碎星',
    commissionFaction: null,
    priceRange: null
  },
  '符文药剂': {
    tier: 2,
    category: '稀有禁术',
    dc: 15,
    basePrice: null,                    // 议价
    baseEffect: '附符文效果（定制）',
    materials: { '符文材料': 1, '银叶': 1 },
    note: '精灵符文学派 / 杜兰',
    rare: true,
    commissionNPC: '杜兰·碎星',
    commissionFaction: null,
    priceRange: [30, 150]
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

    // 自炼成本按世界书规则：成品基准价 ÷ 2（与「炼金规则.yaml」一致）
    // 注：calculateRealMaterialCost 仍存在，作为诊断工具与 NPC 经济计算用；
    //     但 brewPotion 的玩家扣费口径遵循世界书规则，不按材料价推导
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
   *
   * 类别 → 行为映射（对齐世界书 6 类）：
   *   恢复     直接补 HP（旧「治疗」类的语义迁移）
   *   法力     直接补 MP（含「全满」特判，传奇法力药水走该分支）
   *   增益     挂 statusEffects（已知与 status-system 的 `statuses[]` 字段名错位，
   *           留待 S8 修复；本类挂载位置保持向下兼容）
   *   战斗     投掷/淬毒类（火焰瓶/烟幕弹/麻痹药剂/腐蚀药剂/剧毒油）；
   *           不直接作用于角色，标记为「待应用」由战斗流程消费
   *   介质     卷轴/照明/净水粉等器具类；不直接作用于角色，标记 specialEffect
   *   稀有禁术 灾厄金属精炼/禁忌药剂/符文药剂：需先经 commissionNPC 代工，
   *           直接调用返回错误，由代工流程接管
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
      case '恢复':
        character.hp = Math.min(
          (character.hp || 0) + potion.effectValue,
          character.maxHp || character.hp
        );
        result.healed = potion.effectValue;
        break;
      case '法力': {
        // 「恢复全部法力值」（传奇法力药水）：按当前 MP 上限直接补满，钳制同常量药水
        const fullRestore = /全部|全满/.test(potion.effect || '');
        const amount = fullRestore
          ? Math.max(0, (character.maxMp || 0) - (character.mp || 0))
          : potion.effectValue;
        character.mp = Math.min(
          (character.mp || 0) + amount,
          character.maxMp || character.mp
        );
        result.restored = amount;
        break;
      }
      case '增益':
        if (!character.statusEffects) character.statusEffects = [];
        character.statusEffects.push({
          name: potion.name,
          duration: 10,
          effect: potion.effect
        });
        result.buffApplied = true;
        break;
      case '战斗':
        // 投掷/淬毒类：标记为「待应用」，由 combat-system 消费
        // 战斗流程应在攻击 roll 后读取 potion.consumable === 'combat_throw'
        // 或 potion.consumable === 'weapon_coat' 决定何时触发
        result.requiresCombatContext = true;
        result.consumable = /命中|淬毒|涂装/.test(potion.effect || '')
          ? 'weapon_coat'      // 麻痹药剂/腐蚀药剂/剧毒油 → 武器涂层
          : 'combat_throw';    // 火焰瓶/烟幕弹 → 投掷
        result.message = `${potion.name} 需在战斗中使用（${result.consumable}）`;
        break;
      case '介质':
        // 介质类：魔法墨水/照明药剂/净化苔藓粉 → 不直接作用于角色
        // 卷轴媒介由法术系统消费，照明/净水粉由背包「使用」流程消费
        result.specialEffect = potion.effect;
        result.requiresEquipmentContext = /卷轴|书写/.test(potion.effect || '')
          ? 'scroll_medium'
          : 'utility_item';
        break;
      case '稀有禁术':
        // 灾厄金属精炼/禁忌药剂/符文药剂：必须经 commissionNPC 代工
        // 直接使用返回错误（与炼金规则.yaml「稀有禁术类」对齐）
        return {
          success: false,
          error: '稀有禁术不可直接使用',
          requiresNPC: potion.commissionNPC || '杜兰·碎星',
          hint: '需先在炼金代工处委托'
        };
      default:
        // 未知类别（旧版 '治疗'/'毒药'/'实用' 等已废弃命名）
        result.specialEffect = potion.effect;
        result.unknownCategory = potion.category;
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
