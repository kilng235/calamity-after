/**
 * 装备系统 (Equipment System)
 * 
 * 功能：
 * - 装备创建（武器/护甲）
 * - 装备管理（穿戴/卸下）
 * - 背包系统
 * - 耐久系统
 * - AC 计算
 * - 伤害计算
 * 
 * @module equipment-system
 * @version 1.0.0
 */

import { getDice } from './dice-pool.js';
import { calculateModifier } from './check-system.js';

// ==================== 常量定义 ====================

// 材料数据（4档）
const MATERIALS = {
  1: { name: '铁', priceMultiplier: 1.0 },
  2: { name: '精铁', priceMultiplier: 2.5 },
  3: { name: '秘银', priceMultiplier: 10.0 },
  4: { name: '黑曜铁', priceMultiplier: 50.0 }
};

// 武器模板（废土风格）
const WEAPON_TEMPLATES = {
  '废土匕首': {
    category: 'dagger',
    slot: 'mainHand',
    damageBase: 4,
    damageType: '穿刺',
    speed: '快',
    twoHanded: false,
    basePrice: 5,
    durabilityMax: 60,
    description: '生锈的刀刃用破布缠成握把，锋刃参差不齐但依然致命。拾荒者的标配武器。'
  },
  
  '钢管': {
    category: 'club',
    slot: 'mainHand',
    damageBase: 4,
    damageType: '钝击',
    speed: '快',
    twoHanded: false,
    basePrice: 2,
    durabilityMax: 80,
    description: '废墟中捡来的钢管，一端焊着废铁块增加重量。最原始也最可靠的武器。'
  },
  
  '废土短刃': {
    category: 'shortsword',
    slot: 'mainHand',
    damageBase: 6,
    damageType: '劈砍',
    speed: '快',
    twoHanded: false,
    basePrice: 10,
    durabilityMax: 70,
    description: '从旧世界刀具改装而来，刀身打磨过但仍有缺口。轻便灵活，适合快速攻击。'
  },
  
  '投掷手斧': {
    category: 'handaxe',
    slot: 'mainHand',
    damageBase: 6,
    damageType: '劈砍',
    speed: '快',
    twoHanded: false,
    ranged: false,  // 可投掷但也能近战
    basePrice: 8,
    durabilityMax: 65,
    description: '单手轻斧，斧柄经过平衡处理可用于投掷。佣兵喜爱的多用途武器。'
  },
  
  '废土长刀': {
    category: 'longsword',
    slot: 'mainHand',
    damageBase: 8,
    damageType: '劈砍/穿刺',
    speed: '中',
    twoHanded: false,
    basePrice: 15,
    durabilityMax: 80,
    description: '由废墟钢材重铸的单手长刀，刀身布满焊痕。铁匠镇的标准武器，平衡可靠。'
  },
  
  '重型斩刀': {
    category: 'greatsword',
    slot: 'mainHand',
    damageBase: 10,
    damageType: '劈砍',
    speed: '慢',
    twoHanded: true,
    basePrice: 30,
    durabilityMax: 100,
    description: '双手大刀，刀身宽厚沉重。挥舞时势大力沉，一击可斩断变异生物的骨骼。'
  },
  
  '伐木战斧': {
    category: 'battleaxe',
    slot: 'mainHand',
    damageBase: 8,
    damageType: '劈砍',
    speed: '中',
    twoHanded: false,
    basePrice: 15,
    durabilityMax: 80,
    description: '从伐木斧改造而来，斧刃磨得锋利。既能砍柴也能砍人，实用主义的选择。'
  },
  
  '破城重锤': {
    category: 'warhammer',
    slot: 'mainHand',
    damageBase: 8,
    damageType: '钝击',
    speed: '中',
    twoHanded: false,
    basePrice: 15,
    durabilityMax: 90,
    description: '沉重的铁锤，锤头由实心钢块锻造。一击可以砸碎护甲，震断骨骼。'
  },
  
  '废土猎弓': {
    category: 'huntingbow',
    slot: 'mainHand',
    damageBase: 6,
    damageType: '穿刺',
    speed: '中',
    twoHanded: true,
    ranged: true,
    basePrice: 20,
    durabilityMax: 70,
    description: '拾荒者手工制作的简易木弓，弓弦是变异生物的筋腱。射程不远但足够狩猎。'
  },
  
  '强化猎弓': {
    category: 'longbow',
    slot: 'mainHand',
    damageBase: 8,
    damageType: '穿刺',
    speed: '慢',
    twoHanded: true,
    ranged: true,
    basePrice: 30,
    durabilityMax: 80,
    description: '精心打造的复合弓，弓臂经过加固处理。射程远，穿透力强，猎人的首选。'
  },
  
  '轻型弩弓': {
    category: 'lightcrossbow',
    slot: 'mainHand',
    damageBase: 8,
    damageType: '穿刺',
    speed: '中',
    twoHanded: true,
    ranged: true,
    basePrice: 25,
    durabilityMax: 75,
    description: '机械弩弓，扳机和弓臂由拾荒零件拼装。装填慢但威力大，无需太多训练即可使用。'
  },
  
  '重型弩弓': {
    category: 'heavycrossbow',
    slot: 'mainHand',
    damageBase: 12,
    damageType: '穿刺',
    speed: '慢',
    twoHanded: true,
    ranged: true,
    basePrice: 50,
    durabilityMax: 90,
    description: '沉重的攻城弩弓，需要踩踏拉弦。弩箭可以射穿护甲，一击致命。佣兵联盟的制式武器。'
  }
};

// 护甲模板（完全符合 DND 5E / BG3 规则 + 废土风格）
const ARMOR_TEMPLATES = {
  // === 轻甲 (Light Armor) ===
  '废布拼装甲': {
    category: 'cloth',
    slot: 'body',
    acBase: 11,
    weight: '轻',
    stealthPenalty: false,
    dexBonus: 'full',
    basePrice: 5,
    durabilityMax: 50,
    description: '用废弃帆布和破布层层缝制，内衬填充干草。聊胜于无的防护，至少能挡住刮擦。'
  },
  
  '变异兽皮甲': {
    category: 'leather',
    slot: 'body',
    acBase: 11,
    weight: '轻',
    stealthPenalty: false,
    dexBonus: 'full',
    basePrice: 10,
    durabilityMax: 60,
    description: '鞣制的变异生物皮革护胸，焦木巨蜥或灰烬狼的皮。柔软轻便，拾荒者的标配。'
  },
  
  '钉铆强化甲': {
    category: 'studdedleather',
    slot: 'body',
    acBase: 12,
    weight: '轻',
    stealthPenalty: false,
    dexBonus: 'full',
    basePrice: 45,
    durabilityMax: 70,
    description: '皮甲表面钉满废铁钉和铆钉加固，关键部位缝有金属片。兼顾防护和灵活性。'
  },
  
  // === 中甲 (Medium Armor) ===
  '废土兽皮甲': {
    category: 'hide',
    slot: 'body',
    acBase: 12,
    weight: '中',
    stealthPenalty: false,
    dexBonus: 'limited',
    basePrice: 10,
    durabilityMax: 60,
    description: '粗糙的变异巨熊皮或灰烬狼皮，毛发焦黑。厚重但保暖，适合废土游荡者。'
  },
  
  '拾荒链甲衫': {
    category: 'chainshirt',
    slot: 'body',
    acBase: 13,
    weight: '中',
    stealthPenalty: false,
    // 世界书《护甲/锁甲.yaml》：不获敏捷调整值（笨重，重甲惩罚）——映射条目的规则字段
    dexBonus: 'none',
    basePrice: 50,
    durabilityMax: 75,
    description: '旧世界防暴链甲改装，链环部分修补过。穿在皮甲外，沉重但可靠。'
  },
  
  '废铁鳞片甲': {
    category: 'scalemail',
    slot: 'body',
    acBase: 14,
    weight: '中',
    stealthPenalty: true,
    dexBonus: 'limited',
    basePrice: 50,
    durabilityMax: 80,
    description: '废铁片裁剪成鳞片状，缝在皮甲底上。走动时金属片碰撞作响，潜行困难。'
  },
  
  '防暴胸甲': {
    category: 'breastplate',
    slot: 'body',
    acBase: 14,
    weight: '中',
    stealthPenalty: false,
    dexBonus: 'limited',
    basePrice: 400,
    durabilityMax: 85,
    description: '旧世界防暴装备的胸甲部分，打磨除锈后重新上油。保护要害且不影响行动。'
  },
  
  '军用重甲': {
    category: 'halfplate',
    slot: 'body',
    acBase: 15,
    weight: '中',
    stealthPenalty: true,
    dexBonus: 'limited',
    basePrice: 750,
    durabilityMax: 90,
    description: '军警部队的半身板甲，护胸、护肩、护臂齐全。沉重且行动受限，但防护优秀。'
  },
  
  // === 重甲 (Heavy Armor) ===
  '废铁环甲': {
    category: 'ringmail',
    slot: 'body',
    acBase: 14,
    weight: '重',
    stealthPenalty: true,
    dexBonus: 'none',
    strengthReq: 0,
    basePrice: 30,
    durabilityMax: 85,
    description: '废铁环串联成的简易护甲，环与环之间有缝隙。笨重且防护有限，但总比没有好。'
  },
  
  '佣兵重甲': {
    category: 'chainmail',
    slot: 'body',
    acBase: 16,
    weight: '重',
    stealthPenalty: true,
    dexBonus: 'none',
    strengthReq: 13,
    basePrice: 75,
    durabilityMax: 90,
    description: '完整的锁甲，链环密集覆盖全身。需要强壮体魄才能长时间穿戴。佣兵联盟制式装备。'
  },
  
  '铁匠镇守甲': {
    category: 'splint',
    slot: 'body',
    acBase: 17,
    weight: '重',
    stealthPenalty: true,
    dexBonus: 'none',
    strengthReq: 15,
    basePrice: 200,
    durabilityMax: 95,
    description: '铁匠精心锻造的夹板甲，金属条纵向拼接。极其沉重，只有精锐卫兵才配备。'
  },
  
  '拼装重甲': {
    category: 'plate',
    slot: 'body',
    acBase: 18,
    weight: '重',
    stealthPenalty: true,
    dexBonus: 'none',
    strengthReq: 15,
    basePrice: 1500,
    durabilityMax: 100,
    description: '由废铁板拼接焊合的全身重甲，焊痕密布、锈迹斑斑。防护力惊人但极其笨重，只有最强壮的战士才能驾驭。传说是镇守使的标志。'
  },
  
  // === 盾牌 ===
  '废铁盾牌': {
    category: 'shield',
    slot: 'offHand',
    acBase: 2,
    weight: '中',
    stealthPenalty: false,
    dexBonus: 'none',
    basePrice: 10,
    durabilityMax: 80,
    description: '废铁板锤打成型的圆盾，边缘不规则。中心焊有加固肋条，握把是缠绕的皮条。'
  },
  
  // === 其他部位 ===
  '废土头盔': {
    category: 'helmet',
    slot: 'head',
    acBase: 0,
    weight: '轻',
    stealthPenalty: false,
    dexBonus: 'none',
    basePrice: 10,
    durabilityMax: 60,
    description: '铁皮敲打成的简易头盔，护住头顶和后脑。提供少量 AC 加成，也能防止落石与流矢伤头。'
  }
};

// ==================== 契约合并（世界书数值单源） ====================

// equipment-contract.js 由 convert-yaml-to-js.js 从 装备/武器|护甲/*.yaml 生成：
// - mapping：引擎模板保留结构字段（槽位/双手/描述等），数值字段（伤害骰/耐久/基准价格/AC/重量档）以世界书为权威覆盖
// - registered：世界书独有条目按 yaml 数值注册为新模板（结构字段按槽位合成）
// AC 换算规则：身体甲 acBase = 10 + AC加成（引擎模型 acBase 含基准 10）；盾/头为加值本身
(function applyEquipmentContract() {
  const ct = (typeof window !== 'undefined' && window.equipmentContract) || null;
  if (!ct) return;
  const num = (v, fb) => (typeof v === 'number' && isFinite(v)) ? v : fb;

  Object.keys((ct.mapping && ct.mapping.weapons) || {}).forEach(engineName => {
    const t = WEAPON_TEMPLATES[engineName];
    const src = ct.weapons[ct.mapping.weapons[engineName]];
    if (!t || !src) return;
    t.damageBase = num(src.die, t.damageBase);
    if (src.damageType) t.damageType = src.damageType;
    if (src.speed) t.speed = src.speed;
    t.durabilityMax = num(src.durabilityMax, t.durabilityMax);
    t.basePrice = num(src.basePrice, t.basePrice);
    t.contractSource = ct.mapping.weapons[engineName];
  });

  Object.keys((ct.mapping && ct.mapping.armors) || {}).forEach(engineName => {
    const t = ARMOR_TEMPLATES[engineName];
    const src = ct.armors[ct.mapping.armors[engineName]];
    if (!t || !src) return;
    const isBody = t.slot === 'body';
    const bonus = num(src.acBonus, isBody ? t.acBase - 10 : t.acBase);
    t.acBase = isBody ? 10 + bonus : bonus;
    if (src.weightClass) t.weight = src.weightClass;
    t.durabilityMax = num(src.durabilityMax, t.durabilityMax);
    t.basePrice = num(src.basePrice, t.basePrice);
    t.contractSource = ct.mapping.armors[engineName];
  });

  const SLOT_MAP = { '主手': 'mainHand', '副手': 'offHand', '身体': 'body', '头部': 'head', '足部': 'feet' };
  Object.keys((ct.registered && ct.registered.weapons) || {}).forEach(name => {
    if (WEAPON_TEMPLATES[name]) return;
    const src = ct.weapons[name];
    if (!src) return;
    WEAPON_TEMPLATES[name] = {
      category: ct.registered.weapons[name],
      slot: 'mainHand',
      damageBase: num(src.die, 4),
      damageType: src.damageType || '穿刺',
      speed: src.speed || '中',
      twoHanded: /双手/.test(src.slotText || ''),
      ranged: /远程/.test(src.slotText || ''),
      basePrice: num(src.basePrice, 10),
      durabilityMax: num(src.durabilityMax, 60),
      description: '（世界书装备条目自动注册，描述见世界书）',
      contractSource: name
    };
  });
  Object.keys((ct.registered && ct.registered.armors) || {}).forEach(name => {
    if (ARMOR_TEMPLATES[name]) return;
    const src = ct.armors[name];
    if (!src) return;
    const slot = SLOT_MAP[(src.slotText || '').slice(0, 2)] || 'body';
    const isBody = slot === 'body';
    ARMOR_TEMPLATES[name] = {
      category: ct.registered.armors[name],
      slot: slot,
      acBase: isBody ? 10 + num(src.acBonus, 0) : num(src.acBonus, 0),
      weight: src.weightClass || '中',
      stealthPenalty: src.weightClass === '重',
      dexBonus: src.weightClass === '轻' ? 'full' : (src.weightClass === '中' ? 'limited' : 'none'),
      basePrice: num(src.basePrice, 50),
      durabilityMax: num(src.durabilityMax, 60),
      description: '（世界书装备条目自动注册，描述见世界书）',
      contractSource: name
    };
  });
})();

// ==================== 装备状态 ====================

let equippedSlots = {
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
};

let inventory = [];
let nextEquipmentId = 1;

// ==================== 工具函数 ====================

/**
 * 生成装备 ID
 * @returns {string} ID
 */
function generateId() {
  return `equip_${nextEquipmentId++}`;
}

/**
 * 计算材料伤害加成
 * @param {number} tier - 材料档位
 * @returns {number} 加成值
 */
function calculateDamageBonus(tier) {
  // 材料伤害加成查数值契约（源：武器 yaml 材料加成公式表：一阶 +0 / 二阶 +1 / 三阶 +1 / 灾厄 +2）
  const nc = (typeof window !== 'undefined' && window.numericContract) || null;
  const tbl = (nc && nc.材料伤害加成) || { 档1: 0, 档2: 1, 档3: 1, 档4: 2 };
  const t = Math.min(4, Math.max(1, tier));
  return tbl['档' + t] !== undefined ? tbl['档' + t] : 0;
}

/**
 * 升级骰子面数
 * @param {number} baseSize - 基础骰子
 * @param {number} tier - 材料档位
 * @returns {number} 升级后骰子
 */
function upgradeDice(baseSize, tier) {
  // 骰面升级参数走数值契约（三阶起骰面 +2，封顶 d12）
  const nc = (typeof window !== 'undefined' && window.numericContract) || null;
  const s = (nc && nc.材料升骰) || { 起始档: 3, 面数加成: 2, 骰面上限: 12 };
  if (tier >= s.起始档) {
    return Math.min(s.骰面上限, baseSize + s.面数加成);
  }
  return baseSize;
}

/**
 * 计算护甲 AC（BG3 规则：材料影响 +AC）
 * @param {number} baseAC - 基础 AC
 * @param {number} tier - 材料档位
 * @returns {number} 总 AC
 */
function calculateArmorAC(baseAC, tier) {
  // 材料档位提供 +AC 加成
  // 一阶: +0, 二阶: +1, 三阶: +2, 灾厄: +3
  return baseAC + (tier - 1);
}

// ==================== 装备创建 ====================

/**
 * 创建武器
 * @param {string} weaponType - 武器类型
 * @param {number} materialTier - 材料档位 (1-4)
 * @returns {Object} 装备对象
 */
export function createWeapon(weaponType, materialTier = 1) {
  const template = WEAPON_TEMPLATES[weaponType];
  if (!template) {
    throw new Error(`未知的武器类型: ${weaponType}`);
  }
  
  const material = MATERIALS[materialTier];
  const damageBonus = calculateDamageBonus(materialTier);
  const upgradedDice = upgradeDice(template.damageBase, materialTier);
  
  return {
    id: generateId(),
    name: `${material.name}${weaponType}`,
    type: 'weapon',
    category: template.category,
    slot: template.slot,
    
    material: {
      tier: materialTier,
      name: material.name
    },
    
    weapon: {
      damageBase: upgradedDice,
      baseDie: template.damageBase,   // 出厂规格骰面：双持资格按此判定（材料升骰不改体积手感）
      damageBonus: damageBonus,
      damageType: template.damageType,
      speed: template.speed,
      twoHanded: template.twoHanded,
      ranged: template.ranged || false
    },
    
    durability: {
      current: template.durabilityMax,
      max: template.durabilityMax
    },
    
    price: Math.floor(template.basePrice * material.priceMultiplier)
  };
}

/**
 * 创建护甲
 * @param {string} armorType - 护甲类型
 * @param {number} materialTier - 材料档位 (1-4)
 * @returns {Object} 装备对象
 */
export function createArmor(armorType, materialTier = 1) {
  const template = ARMOR_TEMPLATES[armorType];
  if (!template) {
    throw new Error(`未知的护甲类型: ${armorType}`);
  }
  
  const material = MATERIALS[materialTier];
  const acBonus = calculateArmorAC(template.acBase, materialTier);
  
  return {
    id: generateId(),
    name: `${material.name}${armorType}`,
    type: 'armor',
    category: template.category,
    slot: template.slot,
    
    material: {
      tier: materialTier,
      name: material.name
    },
    
    armor: {
      acBase: acBonus,         // 护甲 AC 值
      weight: template.weight,
      stealthPenalty: template.stealthPenalty,
      dexBonus: template.dexBonus || 'none',
      strengthReq: template.strengthReq || 0
    },
    
    durability: {
      current: template.durabilityMax,
      max: template.durabilityMax
    },
    
    price: Math.floor(template.basePrice * material.priceMultiplier)
  };
}

// ==================== 装备管理 ====================

/**
 * 穿戴装备（支持双持）
 * @param {Object} equipment - 装备对象
 * @param {string} targetSlot - 目标槽位（可选，用于指定装备到副手）
 * @returns {Object|null} 被替换的旧装备
 */
export function equipItem(equipment, targetSlot = null) {
  // 如果指定了目标槽位，使用目标槽位（用于双持）
  const slot = targetSlot || equipment.slot;
  
  // 检查双手武器冲突
  if (equipment.weapon && equipment.weapon.twoHanded) {
    // 双手武器：需要卸下副手
    if (equippedSlots.offHand) {
      console.log(`⚠️ 双手武器需要卸下副手`);
      unequipItem('offHand');
    }
  }
  
  // 检查主手是否是双手武器（装备副手时）
  if (slot === 'offHand') {
    const mainHand = equippedSlots.mainHand;
    if (mainHand && mainHand.weapon && mainHand.weapon.twoHanded) {
      console.log(`⚠️ 主手是双手武器，无法装备副手`);
      return null;
    }
    
    // 检查是否符合双持条件
    if (equipment.weapon) {
      const canDualWield = checkDualWieldRequirements(equipment);
      if (!canDualWield.allowed) {
        console.log(`❌ ${canDualWield.reason}`);
        return null;
      }
    }
  }
  
  // 卸下旧装备
  const oldEquipment = equippedSlots[slot];
  if (oldEquipment) {
    addToInventory(oldEquipment);
  }
  
  // 穿戴新装备
  equippedSlots[slot] = equipment;
  removeFromInventory(equipment.id);
  
  const slotName = slot === 'mainHand' ? '主手' : slot === 'offHand' ? '副手' : slot;
  console.log(`✓ 装备 ${equipment.name} 到 ${slotName}`);
  return oldEquipment;
}

/**
 * 检查双持需求
 * @param {Object} weapon - 要双持的武器
 * @returns {Object} { allowed: boolean, reason: string }
 */
function checkDualWieldRequirements(weapon) {
  const mainHand = equippedSlots.mainHand;
  
  // 没有主手武器
  if (!mainHand || !mainHand.weapon) {
    return {
      allowed: false,
      reason: '双持需要先装备主手武器'
    };
  }
  
  // 主手是双手武器
  if (mainHand.weapon.twoHanded) {
    return {
      allowed: false,
      reason: '主手是双手武器，无法双持'
    };
  }
  
  // 副手武器不是轻型武器（DND 5E 规则）
  // 目前允许所有单手武器双持，以后可以添加"轻型"属性限制
  if (weapon.weapon.twoHanded) {
    return {
      allowed: false,
      reason: '副手武器必须是单手武器'
    };
  }
  
  // 副手是远程武器
  if (weapon.weapon.ranged) {
    return {
      allowed: false,
      reason: '无法双持远程武器'
    };
  }

  // 轻武器检查（世界书·战斗规则：主手+副手各持一把轻武器，基础伤害骰≤1d6；法杖不可双持）
  // 按「出厂规格骰面」判定——材料升骰改锋利度不改体积手感；旧存档无 baseDie 时按当前骰面兜底
  const isLightWeapon = (w) => {
    if (!w || !w.weapon) return false;
    const die = (w.weapon.baseDie !== undefined) ? w.weapon.baseDie : w.weapon.damageBase;
    return die <= 6 && w.category !== 'staff';
  };
  if (!isLightWeapon(weapon)) {
    return {
      allowed: false,
      reason: '副手武器不是轻武器（基础伤害骰≤1d6，法杖除外），无法双持'
    };
  }
  if (mainHand && !isLightWeapon(mainHand)) {
    return {
      allowed: false,
      reason: '主手武器不是轻武器（基础伤害骰≤1d6，法杖除外），无法双持'
    };
  }

  return { allowed: true, reason: '' };
}

/**
 * 检查是否正在双持
 * @returns {boolean}
 */
export function isDualWielding() {
  const mainHand = equippedSlots.mainHand;
  const offHand = equippedSlots.offHand;
  
  return !!(mainHand && mainHand.weapon && 
            offHand && offHand.weapon &&
            !mainHand.weapon.twoHanded);
}

/**
 * 获取双持信息
 * @returns {Object|null}
 */
export function getDualWieldInfo() {
  if (!isDualWielding()) {
    return null;
  }
  
  return {
    mainHand: equippedSlots.mainHand,
    offHand: equippedSlots.offHand,
    canAttackWithBoth: true
  };
}

/**
 * 卸下装备
 * @param {string} slot - 槽位
 * @returns {Object|null} 被卸下的装备
 */
export function unequipItem(slot) {
  const equipment = equippedSlots[slot];
  if (!equipment) {
    return null;
  }
  
  equippedSlots[slot] = null;
  addToInventory(equipment);
  
  console.log(`✓ 卸下 ${equipment.name}`);
  return equipment;
}

/**
 * 获取已装备的物品
 * @returns {Object} 装备槽位
 */
export function getEquippedItems() {
  return { ...equippedSlots };
}

/**
 * 获取指定槽位的装备
 * @param {string} slot - 槽位
 * @returns {Object|null} 装备
 */
export function getEquippedItem(slot) {
  return equippedSlots[slot];
}

// ==================== 背包系统 ====================

/**
 * 添加到背包
 * @param {Object} equipment - 装备
 * @returns {boolean} 是否成功
 */
export function addToInventory(equipment) {
  inventory.push(equipment);
  return true;
}

/**
 * 从背包移除
 * @param {string} equipmentId - 装备 ID
 * @returns {Object|null} 被移除的装备
 */
export function removeFromInventory(equipmentId) {
  const index = inventory.findIndex(e => e.id === equipmentId);
  if (index !== -1) {
    return inventory.splice(index, 1)[0];
  }
  return null;
}

/**
 * 获取背包内容
 * @returns {Array} 装备列表
 */
export function getInventory() {
  return [...inventory];
}

/**
 * 根据 ID 查找装备
 * @param {string} equipmentId - 装备 ID
 * @returns {Object|null} 装备
 */
export function findEquipmentById(equipmentId) {
  return inventory.find(e => e.id === equipmentId) || null;
}

// ==================== 战斗相关 ====================

/**
 * 计算总 AC（完全符合 BG3/DND 5E 规则）
 * @param {Object} attributes - 角色属性
 * @returns {Object} AC 信息
 */
export function calculateTotalAC(attributes) {
  let totalAC = 10;
  let acBreakdown = { base: 10, armor: 0, dex: 0, shield: 0, head: 0 };
  
  const dexMod = calculateModifier(attributes.敏捷 || 10);
  
  // 护甲 AC
  const bodyArmor = equippedSlots.body;
  if (bodyArmor && bodyArmor.armor) {
    // 使用护甲的基础 AC（替代基础 10）
    totalAC = bodyArmor.armor.acBase;
    acBreakdown.base = bodyArmor.armor.acBase;
    acBreakdown.armor = bodyArmor.armor.acBase - 10;
    
    // 检查力量需求（重甲）
    if (bodyArmor.armor.strengthReq > 0) {
      const str = attributes.力量 || 10;
      if (str < bodyArmor.armor.strengthReq) {
        console.log(`⚠️ ${bodyArmor.name}需要力量 ${bodyArmor.armor.strengthReq}（当前 ${str}），移动速度 -10 英尺`);
      }
    }
    
    // 敏捷调整值（根据护甲类型）
    if (bodyArmor.armor.dexBonus === 'full') {
      // 轻甲：全敏捷加成
      totalAC += dexMod;
      acBreakdown.dex = dexMod;
    } else if (bodyArmor.armor.dexBonus === 'limited') {
      // 中甲：最多 +2 敏捷
      const limitedDex = Math.min(dexMod, 2);
      totalAC += limitedDex;
      acBreakdown.dex = limitedDex;
    }
    // 重甲（dexBonus === 'none'）：不加敏捷
  } else {
    // 无护甲：10 + 全敏捷
    totalAC += dexMod;
    acBreakdown.dex = dexMod;
  }
  
  // 盾牌加成
  const shield = equippedSlots.offHand;
  if (shield && shield.category === 'shield') {
    totalAC += shield.armor.acBase;
    acBreakdown.shield = shield.armor.acBase;
  }

  // 头盔加成（世界书：头盔 +2 / 全罩盔 +3；头部槽为加值模型，与盾牌同算法）
  const headGear = equippedSlots.head;
  if (headGear && headGear.armor && headGear.armor.acBase > 0) {
    totalAC += headGear.armor.acBase;
    acBreakdown.head = headGear.armor.acBase;
  }
  
  return {
    total: totalAC,
    breakdown: acBreakdown,
    hasShield: !!shield,
    armorType: bodyArmor ? bodyArmor.armor.weight : '无'
  };
}

/**
 * 掷武器伤害（支持双持）
 * @param {Object} attributes - 角色属性
 * @param {boolean} useOffHand - 是否使用副手攻击
 * @returns {Object} 伤害结果
 */
export function rollWeaponDamage(attributes, useOffHand = false) {
  // 选择武器
  let weapon;
  if (useOffHand && isDualWielding()) {
    weapon = equippedSlots.offHand;
  } else {
    weapon = equippedSlots.mainHand;
  }
  
  if (!weapon || !weapon.weapon) {
    // 徒手攻击
    return {
      damage: 1 + calculateModifier(attributes.力量 || 10),
      damageType: '钝击',
      weapon: null,
      isOffHand: useOffHand
    };
  }
  
  // 检查耐久
  if (weapon.durability.current <= 0) {
    console.log(`❌ ${weapon.name}已损坏，无法使用！`);
    return { damage: 0, damageType: '', weapon: weapon, isOffHand: useOffHand };
  }
  
  // 掷伤害骰
  const diceType = `d${weapon.weapon.damageBase}`;
  const roll = getDice(diceType).value;
  
  // 材料加成
  const materialBonus = weapon.weapon.damageBonus;
  
  // 力量/敏捷调整值
  let abilityMod;
  if (weapon.weapon.ranged) {
    abilityMod = calculateModifier(attributes.敏捷 || 10);
  } else {
    abilityMod = calculateModifier(attributes.力量 || 10);
  }
  
  // 副手攻击不加属性调整值（DND 5E 规则）
  if (useOffHand && isDualWielding()) {
    abilityMod = 0;
    console.log(`ℹ️ 副手攻击不加属性调整值`);
  }
  
  const totalDamage = roll + materialBonus + abilityMod;
  
  return {
    roll: roll,
    materialBonus: materialBonus,
    abilityMod: abilityMod,
    damage: Math.max(1, totalDamage),
    damageType: weapon.weapon.damageType,
    weapon: weapon,
    isOffHand: useOffHand
  };
}

// ==================== 耐久系统 ====================

/**
 * 武器耐久损耗（支持双持）
 * @param {boolean} criticalFailure - 是否大失败
 * @param {boolean} useOffHand - 是否使用副手
 */
export function damageWeaponDurability(criticalFailure = false, useOffHand = false) {
  let weapon;
  if (useOffHand && isDualWielding()) {
    weapon = equippedSlots.offHand;
  } else {
    weapon = equippedSlots.mainHand;
  }
  
  if (!weapon || !weapon.weapon) return;
  
  const damage = criticalFailure ? 5 : 1;
  weapon.durability.current = Math.max(0, weapon.durability.current - damage);
  
  const percent = (weapon.durability.current / weapon.durability.max) * 100;
  
  if (weapon.durability.current === 0) {
    console.log(`💔 ${weapon.name}已损坏！`);
  } else if (percent < 20) {
    console.log(`⚠️ ${weapon.name}耐久度过低（${weapon.durability.current}/${weapon.durability.max}）`);
  }
}

/**
 * 护甲耐久损耗
 * @param {number} damageAmount - 伤害值
 */
export function damageArmorDurability(damageAmount) {
  const armor = equippedSlots.body;
  if (!armor || !armor.armor) return;
  
  armor.durability.current = Math.max(0, armor.durability.current - damageAmount);
  
  const percent = (armor.durability.current / armor.durability.max) * 100;
  
  if (armor.durability.current === 0) {
    console.log(`💔 ${armor.name}已损坏！`);
  } else if (percent < 20) {
    console.log(`⚠️ ${armor.name}耐久度过低（${armor.durability.current}/${armor.durability.max}）`);
  }
}

/**
 * 修理装备
 * @param {Object} equipment - 装备
 * @param {number} amount - 修理量（默认全修）
 */
export function repairEquipment(equipment, amount = null) {
  if (amount === null) {
    equipment.durability.current = equipment.durability.max;
  } else {
    equipment.durability.current = Math.min(
      equipment.durability.max,
      equipment.durability.current + amount
    );
  }
  
  console.log(`🔧 ${equipment.name}已修理（${equipment.durability.current}/${equipment.durability.max}）`);
}

// ==================== 导出 ====================

export default {
  // 创建
  createWeapon,
  createArmor,
  
  // 管理
  equipItem,
  unequipItem,
  getEquippedItems,
  getEquippedItem,
  
  // 背包
  addToInventory,
  removeFromInventory,
  getInventory,
  findEquipmentById,
  
  // 战斗
  calculateTotalAC,
  rollWeaponDamage,
  
  // 双持
  isDualWielding,
  getDualWieldInfo,
  
  // 耐久
  damageWeaponDurability,
  damageArmorDurability,
  repairEquipment,
  
  // 常量
  WEAPON_TEMPLATES,
  ARMOR_TEMPLATES,
  MATERIALS
};
