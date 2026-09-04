/**
 * 锻造系统 - 灾厄之后独立版
 * 基于世界书锻造规则.yaml
 * 
 * 核心功能：
 * - 锻造检定（力量/智力 vs DC）
 * - 材料消耗与成本计算
 * - 装备制作与强化
 * - 工艺改装件系统
 * - 铁匠代工
 */

import { rollDice } from './dice-pool.js';
import { performCheck } from './check-system.js';
import { materialSystem, MATERIALS, MATERIAL_THEME_MAP } from './material-system.js';

// ============== 工匠工具 ==============

export const CRAFT_TOOLS = {
  '铁匠工具': {
    attribute: '力量',
   用途: ['钝器', '护甲', '重型武器', '匕首等精细锻造'],
    slotCost: 1,
    priceSource: '世界观-经济'
  },
  '炼金工具': {
    attribute: '智力',
   用途: ['药剂', '法杖', '施法媒介'],
    slotCost: 1,
    priceSource: '世界观-经济'
  }
};

// ============== DC 档位 ==============

export const FORGE_DC = {
  TIER_1: { dc: 10, name: '一阶', material: '一阶材料' },
  TIER_2: { dc: 15, name: '二阶', material: '二阶材料' },
  TIER_3: { dc: 20, name: '三阶', material: '三阶材料' }
};

// ============== 成果分级 ==============

export const FORGE_RESULT_GRADE = {
  FAILURE: { min: null, max: -1, name: '失败', grade: 0 },
  NORMAL: { min: 0, max: 4, name: '普通', grade: 1 },
  GOOD: { min: 5, max: 9, name: '良品', grade: 2 },
  EXCELLENT: { min: 10, max: Infinity, name: '杰出', grade: 3 }
};

// ============== 工艺改装件 ==============

export const WEAPON_MODS = {
  // 系别伤害强化
  '锐刃打磨': {
    effect: '近战伤害骰 +1 档（如 1d8→1d10），耐久上限 −5',
    price: 5,
    dc: 10,
    applyTo: ['剑', '斧', '匕首'],
    category: '伤害强化'
  },
  '弓弦强化': {
    effect: '远程伤害骰 +1 档，耐久上限 −5',
    price: 6,
    dc: 10,
    applyTo: ['猎弓', '长弓'],
    category: '伤害强化'
  },
  '配重锤头': {
    effect: '钝击伤害骰 +1 档',
    price: 6,
    dc: 10,
    applyTo: ['铁锤', '战锤'],
    category: '伤害强化'
  },
  '锻打矛尖': {
    effect: '穿刺伤害骰 +1 档',
    price: 4,
    dc: 10,
    applyTo: ['短矛'],
    category: '伤害强化'
  },
  '弩臂强化': {
    effect: '弩矢伤害骰 +1 档（重弩 1d12 已达上限，装之无效）',
    price: 6,
    dc: 10,
    applyTo: ['轻弩'],
    category: '伤害强化'
  },
  
  // 附加与倍率伤害
  '火油浸刃': {
    effect: '命中附加 1d4 燃烧伤害（即时结算，不挂状态）；每场战斗前需浸油（油料费 1 金）',
    price: 7,
    dc: 10,
    applyTo: ['剑', '斧', '匕首', '短矛'],
    category: '附加伤害'
  },
  '淬火重锋': {
    effect: '重击（天然 20）时伤害骰倍率 ×2 → ×3',
    price: 15,
    dc: 20,
    applyTo: ['任意近战武器'],
    category: '倍率伤害'
  },
  
  // 攻速与操控
  '握柄改造': {
    effect: '双手武器攻速 +1 档；先攻检定获优势',
    price: 8,
    dc: 10,
    applyTo: ['双手剑', '战斧', '战锤'],
    category: '攻速操控'
  },
  '短柄改造': {
    effect: '双手武器可单手持握，代价伤害骰 −1 档',
    price: 10,
    dc: 15,
    applyTo: ['双手剑', '战斧', '战锤'],
    category: '攻速操控'
  },
  '速射匣': {
    effect: '重弩免除装填 1 回合；轻弩获可移动射击',
    price: 12,
    dc: 15,
    applyTo: ['轻弩', '重弩'],
    category: '攻速操控'
  },
  '弩机校准': {
    effect: '远程命中相关检定获优势',
    price: 10,
    dc: 15,
    applyTo: ['轻弩', '重弩'],
    category: '攻速操控'
  },
  
  // 射程与特化
  '配重调整': {
    effect: '投掷武器射程 ×2',
    price: 4,
    dc: 10,
    applyTo: ['匕首', '短矛'],
    category: '射程特化'
  },
  '角木复合弓臂': {
    effect: '弓射程 ×1.5，耐久上限 −5',
    price: 7,
    dc: 15,
    applyTo: ['猎弓', '长弓'],
    category: '射程特化'
  },
  '加长改造': {
    effect: '近战触及 +1m',
    price: 6,
    dc: 10,
    applyTo: ['短剑', '铁斧', '铁锤'],
    category: '射程特化'
  },
  '镀银层': {
    effect: '对不死生物特攻：命中时伤害按易伤口径翻倍',
    price: 8,
    dc: 15,
    applyTo: ['剑', '斧', '匕首', '矛头'],
    category: '射程特化'
  },
  '猎兽倒钩': {
    effect: '命中后将目标拉近约 5 米',
    price: 5,
    dc: 10,
    applyTo: ['匕首', '短矛', '铁斧'],
    category: '射程特化'
  },
  '双持锁扣': {
    effect: '副手武器的词缀状态挂载恢复生效（全卡唯一例外）',
    price: 15,
    dc: 20,
    applyTo: ['匕首', '短剑'],
    category: '射程特化'
  }
};

export const ARMOR_MODS = {
  '焦木镶衬': {
    effect: '护甲重量降一档（中→轻），耐火叙事',
    price: 6,
    dc: 10,
    applyTo: ['任意护甲'],
    category: '轻量化'
  },
  '内衬加厚': {
    effect: 'AC +1，重量 +1 档',
    price: 8,
    dc: 15,
    applyTo: ['中甲', '重甲'],
    category: '防御强化'
  },
  '活动关节': {
    effect: '敏捷（杂技）检定不受护甲劣势',
    price: 10,
    dc: 15,
    applyTo: ['中甲', '重甲'],
    category: '灵活性'
  },
  '快速拆卸': {
    effect: '穿脱护甲时间减半',
    price: 5,
    dc: 10,
    applyTo: ['任意护甲'],
    category: '便利性'
  },
  '隐蔽涂装': {
    effect: '敏捷（隐匿）检定劣势减半',
    price: 7,
    dc: 15,
    applyTo: ['轻甲', '中甲'],
    category: '隐蔽性'
  }
};

// ============== 铁匠代工 ==============

export const BLACKSMITHS = {
  '凯尔·拾灰者': {
    location: '旧王城废墟',
    race: '矮人',
    specialty: '精工护甲、矿脉武器',
    priceModifier: 1.25, // +20~30% 取中
    note: '旧日遗民首领兼任铁匠，品质优先'
  },
  '杜兰·碎星': {
    location: '流浪（锈钉镇偶驻）',
    race: '犬人',
    specialty: '稀有材料、禁忌炼金',
    priceModifier: 1.40, // +30~50% 取中
    note: '流浪炼金术士，可接受禁术材料订单'
  },
  '艾拉·棘藤': {
    location: '灰烬森林',
    race: '精灵',
    specialty: '草药工艺、自然系',
    priceModifier: 1.30, // +20~40% 取中
    note: '银叶营地合作订单，自然系专精'
  },
  '赛拉斯·铁火': {
    location: '锈钉镇「断裂的王冠」',
    race: '人类',
    specialty: '通用锻造、杂项修理',
    priceModifier: 1.0, // 基准价
    note: '锈钉镇日常铁匠'
  },
  '月影·战兔': {
    location: '草原营地',
    race: '兔耳族',
    specialty: '轻甲、跳跃装备',
    priceModifier: 1.0,
    note: '兔脚斥候队装备供应'
  },
  '灵耳工坊': {
    location: '旧王城废墟',
    race: '灵耳族',
    specialty: '精密件、符文陷阱',
    priceModifier: 1.15, // +10~20%
    note: '与矮人符文匠合作'
  },
  '混血铁匠': {
    location: '锈钉镇铁匠区',
    race: '混血',
    specialty: '定制、跨族技艺',
    priceModifier: 1.05, // 基准价~+10%
    note: '接受各族订单'
  }
};

// ============== 锻造系统类 ==============

class ForgingSystem {
  constructor() {
    this.craftingHistory = [];
  }

  /**
   * 计算材料成本（委托给材料系统）
   * @param {number} basePrice - 成品基准价
   * @returns {number} 自锻原材料成本（基准价 ÷ 2）
   */
  calculateMaterialCost(basePrice) {
    return materialSystem.calculateForgingCost(basePrice);
  }

  /**
   * 执行锻造检定
   * @param {Object} character - 角色数据
   * @param {string} toolType - 工具类型（铁匠工具/炼金工具）
   * @param {number} dc - 难度等级
   * @param {Object} options - 额外选项（优势/劣势）
   * @returns {Object} 检定结果
   */
  performForgingCheck(character, toolType, dc, options = {}) {
    const tool = CRAFT_TOOLS[toolType];
    if (!tool) {
      return { success: false, error: '未知工具类型' };
    }

    const attributeName = tool.attribute;
    const attributeValue = character.attributes?.[attributeName] || 10;
    const modifier = Math.floor((attributeValue - 10) / 2);

    // 工具优势/劣势
    let advantage = options.advantage || false;
    let disadvantage = options.disadvantage || false;

    if (!character.hasTool?.[toolType]) {
      disadvantage = true; // 徒手有劣势
    } else {
      advantage = true; // 持工具获优势
    }

    // 执行检定
    const checkResult = performCheck({
      character,
      attributeName,
      dc,
      advantage,
      disadvantage,
      context: '锻造检定'
    });

    // 计算成果分级
    const surplus = checkResult.total - dc;
    let grade = FORGE_RESULT_GRADE.FAILURE;
    
    if (checkResult.natural20) {
      // 天然20强制成功
      grade = surplus >= 10 ? FORGE_RESULT_GRADE.EXCELLENT : FORGE_RESULT_GRADE.GOOD;
    } else if (checkResult.natural1) {
      // 天然1强制大失败
      grade = FORGE_RESULT_GRADE.FAILURE;
    } else if (surplus >= 10) {
      grade = FORGE_RESULT_GRADE.EXCELLENT;
    } else if (surplus >= 5) {
      grade = FORGE_RESULT_GRADE.GOOD;
    } else if (surplus >= 0) {
      grade = FORGE_RESULT_GRADE.NORMAL;
    }

    const result = {
      ...checkResult,
      tool: toolType,
      attribute: attributeName,
      modifier,
      surplus,
      grade: grade.name,
      gradeLevel: grade.grade,
      success: surplus >= 0 || checkResult.natural20
    };

    this.craftingHistory.push({
      timestamp: Date.now(),
      result,
      character: character.name
    });

    return result;
  }

  /**
   * 制作装备
   * @param {Object} character - 角色数据
   * @param {Object} recipe - 配方（包含装备模板、材料需求、DC）
   * @param {Object} options - 额外选项
   * @returns {Object} 制作结果
   */
  craftEquipment(character, recipe, options = {}) {
    const { equipment, materials, dc, toolType = '铁匠工具' } = recipe;

    // 检查材料
    if (!this.hasMaterials(character, materials)) {
      return { success: false, error: '材料不足' };
    }

    // 计算材料成本
    const materialCost = this.calculateMaterialCost(equipment.basePrice || 0);
    
    // 检查金币
    if ((character.gold || 0) < materialCost) {
      return { success: false, error: '金币不足', required: materialCost };
    }

    // 执行锻造检定
    const checkResult = this.performForgingCheck(character, toolType, dc, options);

    // 消耗材料和金币（无论成功失败）
    this.consumeMaterials(character, materials);
    character.gold -= materialCost;

    if (!checkResult.success) {
      // 失败：装备带瑕疵但仍可用
      return {
        success: false,
        checkResult,
        equipment: this.createFlawedEquipment(equipment, checkResult),
        materialCost,
        message: '锻造失败，装备带有瑕疵但仍可使用'
      };
    }

    // 成功：创建装备
    const createdEquipment = this.createEquipment(equipment, checkResult);

    return {
      success: true,
      checkResult,
      equipment: createdEquipment,
      materialCost,
      grade: checkResult.grade,
      message: `锻造成功！品质：${checkResult.grade}`
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
   * 创建装备（成功）
   */
  createEquipment(template, checkResult) {
    return {
      ...template,
      id: `equip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      quality: checkResult.grade,
      grade: checkResult.gradeLevel,
      crafted: true,
      craftedAt: Date.now(),
      mods: [], // 改装件槽位（武器2/护甲2）
      maxModSlots: template.type === '武器' ? 2 : 2
    };
  }

  /**
   * 创建瑕疵装备（失败）
   */
  createFlawedEquipment(template, checkResult) {
    const flaws = ['卷刃', '错缝', '重量偏沉', '金属疲劳'];
    const flaw = flaws[Math.floor(Math.random() * flaws.length)];
    
    return {
      ...template,
      id: `equip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      quality: '瑕疵',
      flaw,
      flawEffect: this.getFlawEffect(flaw),
      crafted: true,
      craftedAt: Date.now(),
      repairable: true,
      repairDC: checkResult.dc + 2
    };
  }

  /**
   * 获取瑕疵效果
   */
  getFlawEffect(flaw) {
    const flawEffects = {
      '卷刃': { narrative: '攻击叙事描写有迟滞感', mechanic: '伤害骰-1档' },
      '错缝': { narrative: '护甲穿戴感不佳', mechanic: '敏捷检定劣势' },
      '重量偏沉': { narrative: '力量相关检定劣势', mechanic: '力量检定劣势' },
      '金属疲劳': { narrative: '耐久下降', mechanic: '耐久上限-10' }
    };
    return flawEffects[flaw] || { narrative: '未知瑕疵', mechanic: '无' };
  }

  /**
   * 修复瑕疵装备
   */
  repairEquipment(character, equipment) {
    if (!equipment.flaw || !equipment.repairable) {
      return { success: false, error: '该装备无需修复或不可修复' };
    }

    const checkResult = this.performForgingCheck(character, '铁匠工具', equipment.repairDC);
    
    if (checkResult.success) {
      delete equipment.flaw;
      delete equipment.flawEffect;
      delete equipment.repairable;
      delete equipment.repairDC;
      equipment.quality = '普通';
      return { success: true, message: '修复成功！', checkResult };
    } else {
      return { success: false, message: '修复失败', checkResult };
    }
  }

  /**
   * 安装改装件
   */
  installMod(character, equipment, modName) {
    const modList = equipment.type === '武器' ? WEAPON_MODS : ARMOR_MODS;
    const mod = modList[modName];
    
    if (!mod) {
      return { success: false, error: '未知改装件' };
    }

    // 检查槽位
    if (equipment.mods.length >= equipment.maxModSlots) {
      return { success: false, error: '改装槽位已满' };
    }

    // 检查同类互斥
    const sameCategory = equipment.mods.find(m => m.category === mod.category);
    if (sameCategory) {
      return { success: false, error: `同类改装件「${sameCategory}」已安装，禁止混装` };
    }

    // 检查装备类型
    const canApply = mod.applyTo.some(type => equipment.name.includes(type) || equipment.type.includes(type));
    if (!canApply && !mod.applyTo.includes('任意护甲') && !mod.applyTo.includes('任意近战武器')) {
      return { success: false, error: '该改装件不适用于此装备' };
    }

    // 执行安装检定
    const checkResult = this.performForgingCheck(character, '铁匠工具', mod.dc);
    
    if (checkResult.success) {
      equipment.mods.push({
        name: modName,
        ...mod,
        installedAt: Date.now()
      });
      return { success: true, message: `成功安装「${modName}」`, checkResult };
    } else {
      // 失败：改装件材料消耗，装备不毁
      return { success: false, message: '安装失败，改装件材料消耗', checkResult };
    }
  }

  /**
   * 拆卸改装件
   */
  removeMod(character, equipment, modIndex, byBlacksmith = false) {
    if (modIndex < 0 || modIndex >= equipment.mods.length) {
      return { success: false, error: '无效的改装件索引' };
    }

    const mod = equipment.mods[modIndex];

    if (byBlacksmith) {
      // 铁匠代拆：保成功，工费1金
      if ((character.gold || 0) < 1) {
        return { success: false, error: '金币不足（需要1金）' };
      }
      character.gold -= 1;
      equipment.mods.splice(modIndex, 1);
      return { success: true, message: `成功拆卸「${mod.name}」`, returnedMod: mod };
    } else {
      // 自拆：DC10检定
      const checkResult = this.performForgingCheck(character, '铁匠工具', 10);
      if (checkResult.success) {
        equipment.mods.splice(modIndex, 1);
        return { success: true, message: `成功拆卸「${mod.name}」`, checkResult, returnedMod: mod };
      } else {
        // 失败：改装件损毁
        equipment.mods.splice(modIndex, 1);
        return { success: false, message: '拆卸失败，改装件损毁', checkResult };
      }
    }
  }

  /**
   * 计算代工价格
   */
  calculateBlacksmithPrice(basePrice, blacksmithName, relationship = '友好') {
    const blacksmith = BLACKSMITHS[blacksmithName];
    if (!blacksmith) return basePrice;

    let price = basePrice * blacksmith.priceModifier;

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
   * 获取锻造历史
   */
  getCraftingHistory(characterName) {
    if (characterName) {
      return this.craftingHistory.filter(h => h.character === characterName);
    }
    return this.craftingHistory;
  }
}

// 导出单例
export const forgingSystem = new ForgingSystem();

// 导出类供测试使用
export { ForgingSystem };
