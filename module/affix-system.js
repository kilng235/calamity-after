/**
 * 词缀系统 - 灾厄之后独立版
 * 基于世界书词缀表.yaml
 * 
 * 核心功能：
 * - 词缀池管理（6大主题池 + 品质分级池）
 * - 词缀随机生成（按装备品质和材料主题）
 * - 词缀效果应用（状态效果）
 * - 词条强度骰（d10）
 * - AI词条生成CoT辅助
 */

import { rollDice } from './dice-pool.js';
import { materialSystem, MATERIAL_THEME_MAP, MATERIALS } from './material-system.js';

// ============== 装备品质与词条数 ==============

export const EQUIPMENT_QUALITY = {
  '普通': { tier: 1, affixCount: 1, color: '白' },
  '罕见': { tier: 2, affixCount: 2, color: '绿' },
  '稀有': { tier: 3, affixCount: 2, color: '蓝' },
  '史诗': { tier: 4, affixCount: 3, color: '紫' },
  '传说': { tier: 5, affixCount: 3, color: '橙' }
};

// ============== 材料→主题倾向（从材料系统导入，此处保留兼容映射） ==============

export const MATERIAL_THEME = {
  '黑曜石': { theme: '火焰', mainStatus: '燃烧', pool: 'fire' },
  '硫磺矿': { theme: '毒素', mainStatus: '中毒', pool: 'poison' },
  '精铁': { theme: '锋锐', mainStatus: '出血', pool: 'sharp' },
  '秘银': { theme: '精准', mainStatus: '失衡', pool: 'precision' },
  '血晶石': { theme: '深渊', mainStatus: '恐慌', pool: 'abyss' },
  '星铁': { theme: '星辉', mainStatus: '加速', pool: 'star' },
  '焦木': { theme: '朴素', mainStatus: '减速', pool: 'basic' },
  '宝石': { theme: '灵光', mainStatus: '灵巧', pool: 'gem' },
  // 从材料系统补充的新材料映射
  '红宝石': { theme: '火焰', mainStatus: '燃烧', pool: 'fire' },
  '祖母绿': { theme: '毒素', mainStatus: '中毒', pool: 'poison' },
  '银（纯）': { theme: '星辉', mainStatus: '加速', pool: 'star' },
  '魔法结晶': { theme: '星辉', mainStatus: '加速', pool: 'star' },
  '龙骨化石': { theme: '深渊', mainStatus: '恐慌', pool: 'abyss' },
  '黑曜铁': { theme: '深渊', mainStatus: '恐慌', pool: 'abyss' },
  '能量矿石': { theme: '星辉', mainStatus: '加速', pool: 'star' },
  '能量晶簇': { theme: '星辉', mainStatus: '加速', pool: 'star' },
  '星辉宝石': { theme: '星辉', mainStatus: '加速', pool: 'star' },
  '完美钻石': { theme: '星辉', mainStatus: '加速', pool: 'star' },
  '远古符文': { theme: '深渊', mainStatus: '震慑', pool: 'abyss' },
  '紫水晶': { theme: '灵光', mainStatus: '灵巧', pool: 'gem' },
  '黄玉': { theme: '灵光', mainStatus: '专注', pool: 'gem' },
  '玛瑙': { theme: '灵光', mainStatus: '灵巧', pool: 'gem' },
  '琥珀': { theme: '灵光', mainStatus: '专注', pool: 'gem' },
  '蓝宝石': { theme: '灵光', mainStatus: '专注', pool: 'gem' }
};

// ============== 6大主题池 ==============

export const AFFIX_POOLS = {
  fire: {
    name: '火焰池',
    candidateStatuses: ['燃烧', '减速', '目盲', '感电'],
    narrativeImages: ['灰烬', '炭渣', '焦痕', '烟缕', '烤骨', '火舌', '炭晶', '烬纹', '火咬'],
    statusEffects: {
      '燃烧': { type: 'dot', damage: 'd4', duration: 3, description: '每轮末受到火焰伤害' },
      '减速': { type: 'debuff', effect: '速度减半', duration: 2, description: '烟呛导致行动迟缓' },
      '目盲': { type: 'debuff', effect: '视觉检定自动失败', duration: 1, description: '闪光导致暂时失明' },
      '感电': { type: 'dot', damage: 'd4', duration: 2, description: '电光造成持续伤害' }
    }
  },
  poison: {
    name: '毒素池',
    candidateStatuses: ['中毒', '侵蚀', '减速', '失衡', '麻痹'],
    narrativeImages: ['苦胆', '瘴纹', '毒涎', '蚀痕', '腐皮', '疽脉', '霉咒', '锈胆', '苦刺'],
    statusEffects: {
      '中毒': { type: 'dot', damage: 'd6', duration: 3, description: '毒素持续侵蚀' },
      '侵蚀': { type: 'dot', damage: 'd4', duration: 4, description: '酸性腐蚀持续伤害' },
      '减速': { type: 'debuff', effect: '速度-2', duration: 2, description: '毒雾导致行动迟缓' },
      '失衡': { type: 'debuff', effect: '敏捷检定劣势', duration: 2, description: '迷乱导致失去平衡' },
      '麻痹': { type: 'control', effect: '无法行动', duration: 1, description: '神经毒素导致瘫痪' }
    }
  },
  sharp: {
    name: '锋锐池',
    candidateStatuses: ['出血', '失衡', '护体', '燃烧', '残废'],
    narrativeImages: ['血脊', '刃霜', '破痕', '断骨', '刃鸣', '白痕', '铁吻', '裂肤', '利齿'],
    statusEffects: {
      '出血': { type: 'dot', damage: 'd6', duration: 3, description: '伤口持续流血' },
      '失衡': { type: 'debuff', effect: 'AC-2', duration: 2, description: '被击退失去平衡' },
      '护体': { type: 'buff', effect: 'AC+2', duration: 3, description: '穿刺穿透后的防御姿态' },
      '燃烧': { type: 'dot', damage: 'd4', duration: 2, description: '摩擦生热引发燃烧' },
      '残废': { type: 'debuff', effect: '力量检定劣势', duration: 3, description: '切割伤导致肢体残废' }
    }
  },
  precision: {
    name: '精准池',
    candidateStatuses: ['失衡', '灵巧', '专注', '加速'],
    narrativeImages: ['针眼', '定针', '瞄心', '星瞄', '准星', '瞬息', '一发', '几何', '丝准'],
    statusEffects: {
      '失衡': { type: 'debuff', effect: '目标AC-2', duration: 2, description: '精准打击破坏平衡' },
      '灵巧': { type: 'buff', effect: '敏捷检定优势', duration: 3, description: '手感提升灵活性' },
      '专注': { type: 'buff', effect: '专注检定优势', duration: 3, description: '精神高度集中' },
      '加速': { type: 'buff', effect: '速度翻倍', duration: 2, description: '反应速度大幅提升' }
    }
  },
  abyss: {
    name: '深渊池',
    candidateStatuses: ['恐慌', '震慑', '失能', '护体', '魅惑'],
    narrativeImages: ['渊语', '低回', '丧钟', '丧爪', '噬名', '丧心', '渊啮', '丧誓', '渊眼'],
    statusEffects: {
      '恐慌': { type: 'control', effect: '无法靠近攻击源', duration: 2, description: '深渊恐惧笼罩心灵' },
      '震慑': { type: 'control', effect: '无法行动', duration: 1, description: '灵魂震慑导致呆滞' },
      '失能': { type: 'control', effect: '无法行动且AC-2', duration: 1, description: '灵魂震慑导致完全失能' },
      '护体': { type: 'buff', effect: '深渊抗性', duration: 5, description: '深渊之力形成护体' },
      '魅惑': { type: 'control', effect: '目标被魅惑', duration: 2, description: '低语魅惑目标心智' }
    }
  },
  star: {
    name: '星辉池',
    candidateStatuses: ['加速', '护体', '灵巧', '耀眼', '专注', '感电'],
    narrativeImages: ['星痕', '星霜', '光翼', '星眸', '银羽', '星喙', '晨星', '辉纹', '流光'],
    statusEffects: {
      '加速': { type: 'buff', effect: '速度+2', duration: 3, description: '星辉加速行动' },
      '护体': { type: 'buff', effect: 'AC+2', duration: 3, description: '星光形成护盾' },
      '灵巧': { type: 'buff', effect: '敏捷检定优势', duration: 3, description: '星辉提升灵活性' },
      '耀眼': { type: 'debuff', effect: '目标目盲', duration: 1, description: '星光反射致盲' },
      '专注': { type: 'buff', effect: '智力检定优势', duration: 3, description: '星辉启迪心智' },
      '感电': { type: 'dot', damage: 'd4', duration: 2, description: '静电造成持续伤害' }
    }
  },
  basic: {
    name: '朴素池',
    candidateStatuses: ['减速', '目盲', '力竭', '燃烧'],
    narrativeImages: ['灰啖', '锈誓', '拾荒', '枯骨', '土面', '苦旅', '断念', '灰喙', '锈脊'],
    statusEffects: {
      '减速': { type: 'debuff', effect: '速度-2', duration: 2, description: '负重导致行动迟缓' },
      '目盲': { type: 'debuff', effect: '视觉检定劣势', duration: 1, description: '尘土遮蔽视线' },
      '力竭': { type: 'debuff', effect: '力量检定劣势', duration: 2, description: '重击导致力竭' },
      '燃烧': { type: 'dot', damage: 'd4', duration: 2, description: '焦灼引发燃烧' }
    }
  },
  gem: {
    name: '灵光池',
    candidateStatuses: ['灵巧', '专注', '耀眼', '加速'],
    narrativeImages: ['光翼', '银羽', '星眸', '辉纹', '流光', '晨星', '星痕'],
    statusEffects: {
      '灵巧': { type: 'buff', effect: '敏捷检定优势', duration: 3, description: '灵光提升灵活性' },
      '专注': { type: 'buff', effect: '专注检定优势', duration: 3, description: '灵光增强专注' },
      '耀眼': { type: 'debuff', effect: '目标目盲', duration: 1, description: '灵光闪耀致盲' },
      '加速': { type: 'buff', effect: '速度+2', duration: 2, description: '灵光加速行动' }
    }
  }
};

// ============== 品质分级池 ==============

export const QUALITY_POOLS = {
  normal: {
    name: '普通池',
    bonus: 0,
    description: '只走主题池'
  },
  good: {
    name: '良品池',
    bonus: 1,
    candidateStatuses: ['护体', '加速', '灵巧', '专注', '耀眼'],
    description: '主题池去除最弱项、加权到中上级'
  },
  excellent: {
    name: '杰出池',
    bonus: 2,
    candidateStatuses: ['护体（深渊抗性）', '震慑', '目盲（闪光）', '麻痹（神经毒）'],
    description: '进稀有级状态，含 2+ 主题跨界组合倾向'
  }
};

// ============== 词条强度骰 ==============

export const AFFIX_STRENGTH = {
  WEAK: { min: 1, max: 2, name: '弱', multiplier: 0.75, description: '状态持效减弱' },
  STANDARD: { min: 3, max: 7, name: '标准', multiplier: 1.0, description: '基准效果' },
  STRONG: { min: 8, max: 9, name: '强', multiplier: 1.25, description: '状态增强' },
  PERFECT: { min: 10, max: 10, name: '完美', multiplier: 1.5, description: '状态触顶' }
};

// ============== 词缀命名风格 ==============

export const AFFIX_NAMING_STYLES = {
  material: {
    name: '材质派',
    examples: ['灰啖', '黑棱', '枯骨', '白痕', '土面', '炭晶', '锈脊']
  },
  wound: {
    name: '伤痕派',
    examples: ['血脊', '烧骨', '断筋', '焦纹', '瘀痕', '刃霜', '裂肤']
  },
  story: {
    name: '战绩派',
    examples: ['拾荒者之礼', '断念', '苦旅', '灰喙', '锈誓', '渊语', '星眸']
  }
};

// ============== 词缀系统类 ==============

class AffixSystem {
  constructor() {
    this.generatedAffixes = [];
  }

  /**
   * 获取材料对应的主题池（优先本地映射，回退到材料系统）
   */
  getThemePool(materialName) {
    const theme = MATERIAL_THEME[materialName];
    if (theme) {
      return AFFIX_POOLS[theme.pool];
    }
    // 回退到材料系统的主题映射
    const systemTheme = materialSystem.getTheme(materialName);
    if (systemTheme) {
      const poolMap = {
        '火焰': 'fire', '毒素': 'poison', '锋锐': 'sharp',
        '精准': 'precision', '深渊': 'abyss', '星辉': 'star',
        '朴素': 'basic', '灵光': 'gem'
      };
      const poolKey = poolMap[systemTheme];
      if (poolKey && AFFIX_POOLS[poolKey]) {
        return AFFIX_POOLS[poolKey];
      }
    }
    // 默认返回通用池
    return this.getUniversalPool();
  }

  /**
   * 获取通用池（所有状态均匀分布）
   */
  getUniversalPool() {
    const allStatuses = [];
    const allEffects = {};
    
    Object.values(AFFIX_POOLS).forEach(pool => {
      allStatuses.push(...pool.candidateStatuses);
      Object.assign(allEffects, pool.statusEffects);
    });

    // 去重
    const uniqueStatuses = [...new Set(allStatuses)];

    return {
      name: '通用池',
      candidateStatuses: uniqueStatuses,
      statusEffects: allEffects,
      narrativeImages: ['灰啖', '锈誓', '拾荒', '枯骨', '土面', '苦旅', '断念', '灰喙', '锈脊', '蚀痕']
    };
  }

  /**
   * 根据装备品质获取词条数
   */
  getAffixCount(quality) {
    const qualityDef = EQUIPMENT_QUALITY[quality];
    return qualityDef ? qualityDef.affixCount : 1;
  }

  /**
   * 掷词条强度骰
   */
  rollAffixStrength() {
    const roll = rollDice(1, 10);
    
    if (roll >= 10) {
      return { ...AFFIX_STRENGTH.PERFECT, roll };
    } else if (roll >= 8) {
      return { ...AFFIX_STRENGTH.STRONG, roll };
    } else if (roll >= 3) {
      return { ...AFFIX_STRENGTH.STANDARD, roll };
    } else {
      return { ...AFFIX_STRENGTH.WEAK, roll };
    }
  }

  /**
   * 从候选状态中随机选择不重复的状态
   */
  selectRandomStatuses(candidateStatuses, count) {
    const shuffled = [...candidateStatuses].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  /**
   * 生成词缀名称
   */
  generateAffixName(narrativeImages, style = 'material') {
    const images = narrativeImages || AFFIX_NAMING_STYLES[style]?.examples || [];
    return images[Math.floor(Math.random() * images.length)];
  }

  /**
   * 生成词缀（AI CoT 5步）
   * @param {string} material - 主要材料
   * @param {string} quality - 装备品质
   * @param {string} equipmentType - 装备类型（武器/护甲）
   * @param {Object} gradeInfo - 品质分级信息（良品/杰出）
   * @returns {Array} 词缀列表
   */
  generateAffixes(material, quality, equipmentType = '武器', gradeInfo = null) {
    // 步骤1：读材料→主题
    const mainPool = this.getThemePool(material);
    
    // 步骤2：读装备品质→词条数N
    const affixCount = this.getAffixCount(quality);
    
    // 步骤3：从主题池中抽N个不重复状态
    let candidateStatuses = [...mainPool.candidateStatuses];
    
    // 品质分级池追加候选
    if (gradeInfo?.grade === '良品') {
      candidateStatuses.push(...QUALITY_POOLS.good.candidateStatuses);
    } else if (gradeInfo?.grade === '杰出') {
      candidateStatuses.push(...QUALITY_POOLS.excellent.candidateStatuses);
    }
    
    const selectedStatuses = this.selectRandomStatuses(candidateStatuses, affixCount);
    
    // 步骤4：每个词条生成详细信息
    const affixes = selectedStatuses.map(statusName => {
      // 4a. 起叙事名
      const affixName = this.generateAffixName(mainPool.narrativeImages);
      
      // 4b. 获取状态效果
      const statusEffect = mainPool.statusEffects[statusName] || {
        type: 'unknown',
        effect: statusName,
        duration: 2,
        description: `${statusName}效果`
      };
      
      // 4c. 掷强度骰
      const strength = this.rollAffixStrength();
      
      // 4d. 应用强度乘数
      const finalDuration = Math.ceil((statusEffect.duration || 2) * strength.multiplier);
      
      // 4e. 生成叙事描写
      const narrative = this.generateNarrative(affixName, statusName, equipmentType);
      
      return {
        name: affixName,
        status: statusName,
        type: statusEffect.type,
        effect: statusEffect.effect,
        duration: finalDuration,
        strength: strength.name,
        strengthMultiplier: strength.multiplier,
        narrative,
        description: `${statusEffect.description}（持续${finalDuration}回合）`
      };
    });

    // 步骤5：硬校验效果唯一性
    const uniqueAffixes = this.ensureUniqueEffects(affixes);

    this.generatedAffixes.push({
      timestamp: Date.now(),
      material,
      quality,
      affixes: uniqueAffixes
    });

    return uniqueAffixes;
  }

  /**
   * 生成叙事描写
   */
  generateNarrative(affixName, statusName, equipmentType) {
    const narratives = {
      '武器': {
        '燃烧': `${affixName}：剑锋划过如灰烬复燃，伤口灼烧不愈`,
        '出血': `${affixName}：刃口撕裂肌肤，鲜血如泉涌出`,
        '中毒': `${affixName}：毒素渗入伤口，四肢逐渐麻痹`,
        '麻痹': `${affixName}：神经毒素直击要害，目标瞬间僵直`,
        '恐慌': `${affixName}：深渊低语回荡耳边，恐惧笼罩心灵`,
        '加速': `${affixName}：星辉加持，挥剑速度倍增`
      },
      '护甲': {
        '护体': `${affixName}：星光凝聚成盾，抵御致命一击`,
        '灵巧': `${affixName}：轻盈如羽，闪避更加灵活`,
        '专注': `${affixName}：精神高度集中，洞察敌人破绽`,
        '加速': `${affixName}：行动如风，反应速度大幅提升`
      }
    };

    const typeNarratives = narratives[equipmentType] || narratives['武器'];
    return typeNarratives[statusName] || `${affixName}：赋予${statusName}效果`;
  }

  /**
   * 确保效果唯一性（不重复同一状态）
   */
  ensureUniqueEffects(affixes) {
    const seen = new Set();
    return affixes.filter(affix => {
      if (seen.has(affix.status)) {
        return false;
      }
      seen.add(affix.status);
      return true;
    });
  }

  /**
   * 应用词缀到装备
   */
  applyAffixesToEquipment(equipment, affixes) {
    if (!equipment.affixes) {
      equipment.affixes = [];
    }
    
    equipment.affixes.push(...affixes);
    
    // 更新装备名称（加入词缀名）
    if (affixes.length > 0) {
      const affixNames = affixes.map(a => a.name).join('·');
      equipment.displayName = `${equipment.material || ''}·${affixNames}·${equipment.baseName || equipment.name}`;
    }
    
    return equipment;
  }

  /**
   * 攻击时触发词缀效果
   */
  triggerAttackAffix(affix, target) {
    if (!affix || affix.type === 'buff') {
      return { triggered: false, reason: '非攻击词缀' };
    }

    // 应用状态效果到目标
    if (!target.statusEffects) {
      target.statusEffects = [];
    }

    const statusEffect = {
      name: affix.status,
      type: affix.type,
      effect: affix.effect,
      duration: affix.duration,
      source: affix.name,
      appliedAt: Date.now()
    };

    target.statusEffects.push(statusEffect);

    return {
      triggered: true,
      status: affix.status,
      effect: affix.effect,
      duration: affix.duration,
      narrative: affix.narrative
    };
  }

  /**
   * 穿戴时触发词缀效果
   */
  triggerWearAffix(affix, wearer) {
    if (!affix || affix.type !== 'buff') {
      return { triggered: false, reason: '非穿戴词缀' };
    }

    // 应用增益效果到穿戴者
    if (!wearer.buffs) {
      wearer.buffs = [];
    }

    const buff = {
      name: affix.name,
      status: affix.status,
      effect: affix.effect,
      duration: affix.duration,
      source: '装备词缀',
      appliedAt: Date.now()
    };

    wearer.buffs.push(buff);

    return {
      triggered: true,
      buff: buff.name,
      effect: affix.effect,
      duration: affix.duration
    };
  }

  /**
   * 移除穿戴词缀效果（离开场景时）
   */
  removeWearAffixes(wearer, equipmentId) {
    if (!wearer.buffs) return [];

    const removed = wearer.buffs.filter(b => b.source === '装备词缀');
    wearer.buffs = wearer.buffs.filter(b => b.source !== '装备词缀');
    
    return removed;
  }

  /**
   * 获取词缀生成历史
   */
  getGenerationHistory() {
    return this.generatedAffixes;
  }

  /**
   * 获取所有可用状态列表
   */
  getAllAvailableStatuses() {
    const allStatuses = new Set();
    Object.values(AFFIX_POOLS).forEach(pool => {
      pool.candidateStatuses.forEach(status => allStatuses.add(status));
    });
    return Array.from(allStatuses);
  }

  /**
   * 获取特定主题池的信息
   */
  getPoolInfo(poolName) {
    return AFFIX_POOLS[poolName] || null;
  }
}

// 导出单例
export const affixSystem = new AffixSystem();

// 导出类供测试使用
export { AffixSystem };
