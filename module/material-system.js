/**
 * 矿物与材料系统 - 灾厄之后独立版
 * 基于世界书矿物与材料总纲.yaml
 * 
 * 核心功能：
 * - 31种材料定义（价格/单位/档位/作用）
 * - 材料分类（矿石/宝石/燃料/魔法介质/灾厄材料）
 * - 材料获取/消耗/交易接口
 * - 与锻造/炼金/词缀系统集成
 */

// ============== 材料档位 ==============

export const MATERIAL_TIER = {
  TIER_1: { level: 1, name: '一阶', priceRange: '1~5金', forgeDC: 10 },
  TIER_1_HIGH: { level: 1.5, name: '一阶高', priceRange: '5~10金', forgeDC: 10 },
  TIER_1_LOW: { level: 0.5, name: '一阶低', priceRange: '0.5~1金', forgeDC: 10 },
  TIER_2: { level: 2, name: '二阶', priceRange: '10~30金', forgeDC: 15 },
  TIER_2_LOW: { level: 2, name: '二阶低', priceRange: '5~15金', forgeDC: 15 },
  TIER_2_MID: { level: 2, name: '二阶中', priceRange: '15~30金', forgeDC: 15 },
  TIER_2_HIGH: { level: 2, name: '二阶高', priceRange: '25~40金', forgeDC: 15 },
  TIER_3: { level: 3, name: '三阶', priceRange: '50~200金', forgeDC: 20 },
  TIER_3_LOW: { level: 3, name: '三阶低', priceRange: '50~80金', forgeDC: 20 },
  TIER_3_EXTREME: { level: 3, name: '三阶极', priceRange: '200+金', forgeDC: 20 }
};

// ============== 材料分类 ==============

export const MATERIAL_CATEGORY = {
  ORE: '矿石',
  REFINED_METAL: '精炼金属',
  GEM: '宝石',
  FUEL: '燃料',
  BONE: '骨质材料',
  MAGICAL: '魔法介质',
  CALAMITY: '灾厄材料',
  WOOD: '木材',
  SPECIAL: '特殊材料'
};

// ============== 31种材料定义 ==============

export const MATERIALS = {
  // ===== 一阶材料 =====
  '铁矿石': {
    price: 1,
    unit: '块',
    tier: MATERIAL_TIER.TIER_1,
    category: MATERIAL_CATEGORY.ORE,
    effect: '基础武器/护甲原料；铁剑额外 +1 暴击范围（命中 18-20 算大成功）',
    narrative: '崩落王朝的脊梁',
    theme: null
  },
  '精铁': {
    price: 6,
    unit: '块',
    tier: MATERIAL_TIER.TIER_1_HIGH,
    category: MATERIAL_CATEGORY.REFINED_METAL,
    effect: '武器公式 +1；矮人工匠用它锻造时检定再 +1',
    narrative: '矮人工匠招牌',
    theme: '锋锐'
  },
  '铜矿石': {
    price: 1.5,
    unit: '块',
    tier: MATERIAL_TIER.TIER_1,
    category: MATERIAL_CATEGORY.ORE,
    effect: '基础锻造；可铸币；作导电媒介（炼金副料）',
    narrative: '遗民学者的货币记忆',
    theme: null
  },
  '锡矿石': {
    price: 1,
    unit: '块',
    tier: MATERIAL_TIER.TIER_1,
    category: MATERIAL_CATEGORY.ORE,
    effect: '合金成分（与铜合成青铜）；封印仪式副材料',
    narrative: '灾厄前的封印材料',
    theme: null
  },
  '燃煤': {
    price: 0.5,
    unit: '筐（10kg）',
    tier: MATERIAL_TIER.TIER_1_LOW,
    category: MATERIAL_CATEGORY.FUEL,
    effect: '锻造必备消耗品；北方山脉产',
    narrative: '文明最后的燃料',
    theme: null
  },
  '焦炭': {
    price: 0.5,
    unit: '筐',
    tier: MATERIAL_TIER.TIER_1_LOW,
    category: MATERIAL_CATEGORY.FUEL,
    effect: '锻造燃料；让锻造检定获得 +10% 加成（DC 隐含 -1）',
    narrative: '精灵高温工艺',
    theme: null
  },
  '焦木': {
    price: 0.5,
    unit: '段',
    tier: MATERIAL_TIER.TIER_1_LOW,
    category: MATERIAL_CATEGORY.WOOD,
    effect: '握柄/剑柄/弓身；装备时火抗 +1（被动）',
    narrative: '灰烬森林的遗骸',
    theme: '朴素'
  },

  // ===== 二阶材料 =====
  '银矿石': {
    price: 5,
    unit: '块',
    tier: MATERIAL_TIER.TIER_2_LOW,
    category: MATERIAL_CATEGORY.ORE,
    effect: '提纯得「银（纯）」；精炼工艺训练用',
    narrative: '旧教会圣物原料',
    theme: null
  },
  '银（纯）': {
    price: 8,
    unit: '块',
    tier: MATERIAL_TIER.TIER_2,
    category: MATERIAL_CATEGORY.REFINED_METAL,
    effect: '不死生物特攻（×2 伤害）；狼人/恶魔侦察',
    narrative: '不死猎手的传承',
    theme: '星辉'
  },
  '骨白岩': {
    price: 8,
    unit: '块',
    tier: MATERIAL_TIER.TIER_2,
    category: MATERIAL_CATEGORY.BONE,
    effect: '轻量护甲 AC +1（重量减半）；武器握柄贴骨减震',
    narrative: '龙骨山脉遗骸',
    theme: null
  },
  '龙骨化石': {
    price: 30,
    unit: '块',
    tier: MATERIAL_TIER.TIER_2_HIGH,
    category: MATERIAL_CATEGORY.BONE,
    effect: '诅咒武器时附加「龙威」（被命中敌人震慑 1 轮）；法杖可增「咆哮」法术',
    narrative: '远古神龙的遗泽',
    theme: '深渊'
  },
  '黑曜石': {
    price: 5,
    unit: '块',
    tier: MATERIAL_TIER.TIER_2_LOW,
    category: MATERIAL_CATEGORY.ORE,
    effect: '锋利材料（武器穿刺伤害 +1）；箭头磨料',
    narrative: '深渊裂隙的玻璃',
    theme: '火焰'
  },
  '硫磺矿': {
    price: 3,
    unit: '块',
    tier: MATERIAL_TIER.TIER_2_LOW,
    category: MATERIAL_CATEGORY.ORE,
    effect: '烟火/酸蚀武器原料；爆炸物制作（叙事）',
    narrative: '灾厄的气息凝结',
    theme: '毒素'
  },
  '紫水晶': {
    price: 15,
    unit: '颗',
    tier: MATERIAL_TIER.TIER_2_MID,
    category: MATERIAL_CATEGORY.GEM,
    effect: '感知检定 +1（防魅惑/精神控制）；法师可作护符',
    narrative: '防心灵侵蚀的护符',
    theme: '灵光'
  },
  '黄玉': {
    price: 30,
    unit: '颗',
    tier: MATERIAL_TIER.TIER_2_HIGH,
    category: MATERIAL_CATEGORY.GEM,
    effect: '智力检定 +1（学习/法术相关）；法器镶嵌',
    narrative: '学者议会的认证',
    theme: '灵光'
  },
  '玛瑙': {
    price: 20,
    unit: '颗',
    tier: MATERIAL_TIER.TIER_2_MID,
    category: MATERIAL_CATEGORY.GEM,
    effect: '体质检定 +1（抗疾病）；饰品佩戴',
    narrative: '游牧民族的护身符',
    theme: '灵光'
  },
  '琥珀': {
    price: 25,
    unit: '颗',
    tier: MATERIAL_TIER.TIER_2_MID,
    category: MATERIAL_CATEGORY.GEM,
    effect: '驱散检定 +1（对诅咒）；可封存小物品（叙事道具）',
    narrative: '远古封印的容器',
    theme: '灵光'
  },
  '磷光菌核': {
    price: 15,
    unit: '颗',
    tier: MATERIAL_TIER.TIER_2_MID,
    category: MATERIAL_CATEGORY.SPECIAL,
    effect: '炼金/照明；暗处光亮 +10m 半径（被动）',
    narrative: '灾厄催生的发光生命',
    theme: null
  },
  '魔法结晶': {
    price: 40,
    unit: '颗',
    tier: MATERIAL_TIER.TIER_2_HIGH,
    category: MATERIAL_CATEGORY.MAGICAL,
    effect: '施法媒介；法杖装备附魔 +1（法术伤害 +1）；4档法力药水配方',
    narrative: '魔法荒原的馈赠',
    theme: '星辉'
  },

  // ===== 三阶材料 =====
  '秘银': {
    price: 120,
    unit: '块',
    tier: MATERIAL_TIER.TIER_3,
    category: MATERIAL_CATEGORY.REFINED_METAL,
    effect: '武器+护甲公式；武器削魔（敌方法术防御 -2）；轻量坚韧',
    narrative: '黄金纪元的失落工艺',
    theme: '精准',
    restricted: true
  },
  '黑曜铁': {
    price: 80,
    unit: '块',
    tier: MATERIAL_TIER.TIER_3,
    category: MATERIAL_CATEGORY.CALAMITY,
    effect: '武器公式；深渊/魔物特攻（×2）；副作用：诅咒（佩戴者每日须对抗，否则失控）',
    narrative: '灾厄深渊的凝固怒火',
    theme: '深渊',
    restricted: true
  },
  '血晶石': {
    price: 100,
    unit: '块',
    tier: MATERIAL_TIER.TIER_3,
    category: MATERIAL_CATEGORY.CALAMITY,
    effect: '武器公式；武器附「血痕」（命中恢复 1 HP）；深渊特攻',
    narrative: '灾厄血泪的结晶',
    theme: '深渊',
    restricted: true
  },
  '星铁': {
    price: 200,
    unit: '块',
    tier: MATERIAL_TIER.TIER_3_EXTREME,
    category: MATERIAL_CATEGORY.CALAMITY,
    effect: '武器公式；锋利 +1 + 坚韧 +1；重量极轻',
    narrative: '神陨之地的天外之铁',
    theme: '星辉',
    restricted: true
  },
  '蓝宝石': {
    price: 60,
    unit: '颗',
    tier: MATERIAL_TIER.TIER_3_LOW,
    category: MATERIAL_CATEGORY.GEM,
    effect: '智识+感知检定 +1；法器镶嵌',
    narrative: '法师议会的徽记',
    theme: '灵光'
  },
  '红宝石': {
    price: 60,
    unit: '颗',
    tier: MATERIAL_TIER.TIER_3_LOW,
    category: MATERIAL_CATEGORY.GEM,
    effect: '力量+魅力检定 +1；威吓/说服场景加成',
    narrative: '佣兵联盟的勇气',
    theme: '火焰'
  },
  '祖母绿': {
    price: 80,
    unit: '颗',
    tier: MATERIAL_TIER.TIER_3_LOW,
    category: MATERIAL_CATEGORY.GEM,
    effect: '体质+敏捷检定 +1；毒素抗性 +1',
    narrative: '森林族的信物',
    theme: '毒素'
  },
  '能量矿石': {
    price: 50,
    unit: '块',
    tier: MATERIAL_TIER.TIER_3_LOW,
    category: MATERIAL_CATEGORY.MAGICAL,
    effect: 'MP 容量 +1（可镶嵌装备）；高阶法力药水配方',
    narrative: '能量荒原的能量结晶',
    theme: '星辉'
  },
  '能量晶簇': {
    price: 200,
    unit: '簇',
    tier: MATERIAL_TIER.TIER_3_EXTREME,
    category: MATERIAL_CATEGORY.MAGICAL,
    effect: '传奇装备核心材料；MP 容量 +5（镶嵌）；传奇药水配方',
    narrative: '皇室宝库的镇国之宝',
    theme: '星辉',
    restricted: true
  },
  '星辉宝石': {
    price: 200,
    unit: '颗',
    tier: MATERIAL_TIER.TIER_3_EXTREME,
    category: MATERIAL_CATEGORY.GEM,
    effect: '治疗效果 +50%；神圣仪式材料；可净化黑曜铁诅咒',
    narrative: '古神眼泪的化石',
    theme: '星辉',
    restricted: true
  },
  '完美钻石': {
    price: 200,
    unit: '颗',
    tier: MATERIAL_TIER.TIER_3_EXTREME,
    category: MATERIAL_CATEGORY.GEM,
    effect: '复活仪式材料（与「移除诅咒」法术联动）；高纯度价值',
    narrative: '大教堂密室的复活媒介',
    theme: '星辉',
    restricted: true
  },
  '远古符文': {
    price: 200,
    unit: '片',
    tier: MATERIAL_TIER.TIER_3_EXTREME,
    category: MATERIAL_CATEGORY.SPECIAL,
    effect: '词缀附魔槽 +1（装备可附额外词条）；远古法术材料',
    narrative: '黄金纪元的失落知识',
    theme: '深渊',
    restricted: true
  }
};

// ============== 材料→主题映射（供词缀系统使用） ==============

export const MATERIAL_THEME_MAP = {
  '黑曜石': '火焰',
  '硫磺矿': '毒素',
  '精铁': '锋锐',
  '秘银': '精准',
  '血晶石': '深渊',
  '星铁': '星辉',
  '焦木': '朴素',
  '紫水晶': '灵光',
  '黄玉': '灵光',
  '玛瑙': '灵光',
  '琥珀': '灵光',
  '魔法结晶': '星辉',
  '银（纯）': '星辉',
  '龙骨化石': '深渊',
  '红宝石': '火焰',
  '祖母绿': '毒素',
  '蓝宝石': '灵光',
  '能量矿石': '星辉',
  '能量晶簇': '星辉',
  '星辉宝石': '星辉',
  '完美钻石': '星辉',
  '远古符文': '深渊',
  '黑曜铁': '深渊'
};

// ============== 材料系统类 ==============

class MaterialSystem {
  constructor() {
    this.priceModifiers = {
      remote: 1.35,      // 偏远聚落上浮 20~50%（取中35%）
      guildBuy: 0.5,     // 公会/商人收购按零售价 × 50%
      relationship: {
        '冷淡': 1.20,
        '友好': 1.0,
        '信任': 0.95,
        '亲密': 0.90
      }
    };
  }

  /**
   * 获取材料信息
   */
  getMaterial(materialName) {
    return MATERIALS[materialName] || null;
  }

  /**
   * 获取所有材料列表
   */
  getAllMaterials() {
    return Object.entries(MATERIALS).map(([name, data]) => ({
      name,
      ...data
    }));
  }

  /**
   * 按分类获取材料
   */
  getMaterialsByCategory(category) {
    return Object.entries(MATERIALS)
      .filter(([_, data]) => data.category === category)
      .map(([name, data]) => ({ name, ...data }));
  }

  /**
   * 按档位获取材料
   */
  getMaterialsByTier(tierLevel) {
    return Object.entries(MATERIALS)
      .filter(([_, data]) => data.tier.level === tierLevel)
      .map(([name, data]) => ({ name, ...data }));
  }

  /**
   * 获取材料价格
   * @param {string} materialName - 材料名
   * @param {Object} options - 价格修正选项
   * @returns {number} 最终价格
   */
  getPrice(materialName, options = {}) {
    const material = MATERIALS[materialName];
    if (!material) return 0;

    let price = material.price;

    // 偏远聚落上浮
    if (options.remote) {
      price *= this.priceModifiers.remote;
    }

    // 好感度折扣
    if (options.relationship) {
      price *= this.priceModifiers.relationship[options.relationship] || 1.0;
    }

    // 数量
    if (options.amount) {
      price *= options.amount;
    }

    return Math.ceil(price * 100) / 100;
  }

  /**
   * 获取收购价（卖给公会/商人）
   */
  getSellPrice(materialName, amount = 1) {
    const material = MATERIALS[materialName];
    if (!material) return 0;
    return Math.ceil(material.price * this.priceModifiers.guildBuy * amount * 100) / 100;
  }

  /**
   * 获取材料对应的锻造DC
   */
  getForgeDC(materialName) {
    const material = MATERIALS[materialName];
    if (!material) return 10;
    return material.tier.forgeDC;
  }

  /**
   * 获取材料对应的主题（供词缀系统）
   */
  getTheme(materialName) {
    return MATERIAL_THEME_MAP[materialName] || null;
  }

  /**
   * 检查材料是否受限（灾厄材料需要特殊授权）
   */
  isRestricted(materialName) {
    const material = MATERIALS[materialName];
    return material?.restricted || false;
  }

  /**
   * 检查角色是否可以加工受限材料
   */
  canProcessRestricted(character, materialName) {
    if (!this.isRestricted(materialName)) return true;

    // 检查是否有特殊NPC授权或势力声望
    const hasAuthorization = character.authorizations?.includes('灾厄材料加工') ||
      character.factionRep?.['旧日遗民'] >= 20 ||
      character.relationships?.['凯尔·拾灰者'] >= '信任' ||
      character.relationships?.['杜兰·碎星'] >= '信任';

    return hasAuthorization;
  }

  /**
   * 计算锻造材料成本（成品基准价 ÷ 2）
   */
  calculateForgingCost(equipmentBasePrice) {
    return Math.ceil(equipmentBasePrice / 2);
  }

  /**
   * 计算炼金材料成本（成品基准价 ÷ 2）
   */
  calculateAlchemyCost(potionBasePrice) {
    return Math.ceil(potionBasePrice / 2);
  }

  /**
   * 检查角色背包是否有足够材料
   */
  hasMaterials(character, requiredMaterials) {
    const inventory = character.inventory || [];
    for (const [materialName, amount] of Object.entries(requiredMaterials)) {
      const owned = inventory.find(item => item.name === materialName);
      if (!owned || owned.amount < amount) {
        return false;
      }
    }
    return true;
  }

  /**
   * 消耗材料
   */
  consumeMaterials(character, materials) {
    const inventory = character.inventory || [];
    const consumed = [];

    for (const [materialName, amount] of Object.entries(materials)) {
      const item = inventory.find(i => i.name === materialName);
      if (item && item.amount >= amount) {
        item.amount -= amount;
        consumed.push({ name: materialName, amount });
        if (item.amount <= 0) {
          const index = inventory.indexOf(item);
          inventory.splice(index, 1);
        }
      }
    }

    return consumed;
  }

  /**
   * 添加材料到背包
   */
  addMaterials(character, materials) {
    const inventory = character.inventory || [];
    const added = [];

    for (const [materialName, amount] of Object.entries(materials)) {
      const existing = inventory.find(i => i.name === materialName);
      if (existing) {
        existing.amount += amount;
      } else {
        const material = MATERIALS[materialName];
        inventory.push({
          name: materialName,
          amount,
          unit: material?.unit || '个',
          category: material?.category || '其他',
          type: '材料'
        });
      }
      added.push({ name: materialName, amount });
    }

    return added;
  }

  /**
   * 获取材料总价值
   */
  getInventoryValue(character) {
    const inventory = character.inventory || [];
    let totalValue = 0;
    const details = [];

    inventory.forEach(item => {
      if (MATERIALS[item.name]) {
        const value = MATERIALS[item.name].price * item.amount;
        totalValue += value;
        details.push({
          name: item.name,
          amount: item.amount,
          unitPrice: MATERIALS[item.name].price,
          totalValue: value
        });
      }
    });

    return { totalValue: Math.ceil(totalValue * 100) / 100, details };
  }

  /**
   * 获取配方所需材料清单（供锻造/炼金系统调用）
   */
  getRecipeMaterials(recipeType, recipeName) {
    // 这里可以从外部配方表加载，目前返回空
    // 锻造配方和炼金配方各自系统维护
    return {};
  }

  /**
   * 获取材料叙事描述
   */
  getMaterialNarrative(materialName) {
    const material = MATERIALS[materialName];
    if (!material) return '';
    return `${material.narrative}：${material.effect}`;
  }

  /**
   * 按主题获取材料列表（供词缀系统）
   */
  getMaterialsByTheme(theme) {
    return Object.entries(MATERIAL_THEME_MAP)
      .filter(([_, t]) => t === theme)
      .map(([name, _]) => ({
        name,
        ...MATERIALS[name]
      }));
  }
}

// 导出单例
export const materialSystem = new MaterialSystem();

// 导出类供测试使用
export { MaterialSystem };
