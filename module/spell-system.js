/**
 * 法术系统 - 灾厄之后独立版
 * 基于世界书法术总纲.yaml
 *
 * 核心功能：
 * - 6学派 × 3级 = 18个法术
 * - 智力MP系统（MP上限 = 智力 × 5）
 * - 法术习得（五来源 + 书籍/卷轴）
 * - 施法检定（d20 + 智力调整 + PB vs DC）
 * - 法术等级升级（Lv1/Lv2精通/Lv3奥义）
 */

// ============== 法术学派 ==============

export const SPELL_SCHOOL = {
  FIRE: '火焰',
  ICE: '寒冰',
  CONJURATION: '咒法',
  PROTECTION: '防护',
  SHADOW: '暗影',
  UNIVERSAL: '通用'
};

// ============== 法术等级 ==============

export const SPELL_LEVEL = {
  1: { mpCost: 5, intReq: 8, dc: 12, name: '一阶' },
  2: { mpCost: 10, intReq: 10, dc: 15, name: '二阶' },
  3: { mpCost: 15, intReq: 12, dc: 18, name: '三阶' },
  4: { mpCost: 15, intReq: 14, dc: 20, name: '四阶' },
  5: { mpCost: 15, intReq: 16, dc: 22, name: '五阶' }
};

// ============== 习得等级 ==============

export const LEARN_TIER = {
  1: { name: '基础', suffix: '' },
  2: { name: '精通', suffix: '·精通' },
  3: { name: '奥义', suffix: '·奥义' }
};

// ============== 习得来源 ==============

export const LEARN_SOURCE = {
  NPC_TEACH: 'NPC教学',
  COMBAT_IMITATE: '战斗模仿',
  SOCIAL_LEARN: '社交获得',
  OBSERVE_LEARN: '旁观学习',
  SCROLL_READ: '卷轴习得',
  BOOK_READ: '书籍习得'
};

// ============== 18个法术定义 ==============

export const SPELLS = {
  // ===== 火焰学派 =====
  '火把': {
    school: SPELL_SCHOOL.FIRE,
    level: 1,
    mpCost: 5,
    dc: 12,
    action: '主行动',
    range: '接触',
    duration: '即时',
    effect: '点燃一盏火把/篝火/蜡烛/火绒；野外场景必备',
    damage: null,
    status: null,
    scrollPrice: 30
  },
  '火焰箭': {
    school: SPELL_SCHOOL.FIRE,
    level: 2,
    mpCost: 10,
    dc: 15,
    action: '主行动',
    range: '远程30m',
    duration: '即时',
    effect: '2d6火焰伤害；可与词缀「火焰」叠加',
    damage: { dice: 2, sides: 6, type: '火焰' },
    status: null,
    scrollPrice: 80
  },
  '火球术': {
    school: SPELL_SCHOOL.FIRE,
    level: 3,
    mpCost: 15,
    dc: 18,
    action: '主行动',
    range: '远程40m·半径5m',
    duration: '即时',
    effect: '中心点3d6火焰伤害，边缘1d6；命中目标挂「燃烧」',
    damage: { dice: 3, sides: 6, type: '火焰', splash: { dice: 1, sides: 6 } },
    status: { name: '燃烧', duration: 3 },
    scrollPrice: 150
  },

  // ===== 寒冰学派 =====
  '霜指': {
    school: SPELL_SCHOOL.ICE,
    level: 1,
    mpCost: 5,
    dc: 12,
    action: '主行动',
    range: '接触(5m)',
    duration: '即时',
    effect: '挂「寒冷」1轮（每轮末d4）',
    damage: { dice: 1, sides: 4, type: '寒冷' },
    status: { name: '寒冷', duration: 1 },
    scrollPrice: 30
  },
  '寒冰护甲': {
    school: SPELL_SCHOOL.ICE,
    level: 2,
    mpCost: 10,
    dc: 15,
    action: '反应(受击时)',
    range: '个人',
    duration: '1轮',
    effect: '施法者获「护体」1轮（物理减半）+ AC+2',
    damage: null,
    status: { name: '护体', duration: 1, acBonus: 2 },
    scrollPrice: 80
  },
  '冰风暴': {
    school: SPELL_SCHOOL.ICE,
    level: 3,
    mpCost: 15,
    dc: 18,
    action: '主行动',
    range: '近距10m·半径4m',
    duration: '即时',
    effect: '2d8寒冷伤害；区域内目标全挂「减速」；遇湿环境升级为「石化」',
    damage: { dice: 2, sides: 8, type: '寒冷', aoe: true },
    status: { name: '减速', duration: 2 },
    scrollPrice: 150
  },

  // ===== 咒法学派 =====
  '法师之手': {
    school: SPELL_SCHOOL.CONJURATION,
    level: 1,
    mpCost: 5,
    dc: 12,
    action: '主行动',
    range: '5m',
    duration: '即时',
    effect: '远距拾取/推动小型物体（10公斤内）',
    damage: null,
    status: null,
    scrollPrice: 30
  },
  '束缚之绳': {
    school: SPELL_SCHOOL.CONJURATION,
    level: 2,
    mpCost: 10,
    dc: 15,
    action: '主行动',
    range: '远程15m',
    duration: '持续3轮',
    effect: '目标挂「束缚」（无法移动+检定劣势+敌方对其命中优势）',
    damage: null,
    status: { name: '束缚', duration: 3, breakDC: 13 },
    scrollPrice: 80
  },
  '裂隙召唤': {
    school: SPELL_SCHOOL.CONJURATION,
    level: 3,
    mpCost: 15,
    dc: 18,
    action: '主行动',
    range: '近距5m·门形',
    duration: '持续1轮',
    effect: '撕开灾厄裂隙，拉出随机深渊生物（低-中威胁）；持续1轮后消失',
    damage: null,
    status: null,
    summon: true,
    scrollPrice: 150
  },

  // ===== 防护学派 =====
  '治愈轻伤': {
    school: SPELL_SCHOOL.PROTECTION,
    level: 1,
    mpCost: 5,
    dc: 12,
    action: '主行动',
    range: '接触',
    duration: '即时',
    effect: '恢复2d6 HP（主角或接触目标）',
    damage: null,
    heal: { dice: 2, sides: 6 },
    status: null,
    scrollPrice: 30
  },
  '护盾术': {
    school: SPELL_SCHOOL.PROTECTION,
    level: 2,
    mpCost: 10,
    dc: 15,
    action: '反应(受击时)',
    range: '个人',
    duration: '1轮',
    effect: 'AC+5；只防一次攻击（被命中后消失）',
    damage: null,
    status: { name: '护盾', duration: 1, acBonus: 5, singleUse: true },
    scrollPrice: 80
  },
  '移除诅咒': {
    school: SPELL_SCHOOL.PROTECTION,
    level: 3,
    mpCost: 15,
    dc: 18,
    action: '主行动',
    range: '接触',
    duration: '即时',
    effect: '解除目标的「诅咒」「中毒」「魅惑」之一',
    damage: null,
    status: null,
    removeStatus: ['诅咒', '中毒', '魅惑'],
    scrollPrice: 150
  },

  // ===== 暗影学派 =====
  '暗影伪装': {
    school: SPELL_SCHOOL.SHADOW,
    level: 1,
    mpCost: 5,
    dc: 12,
    action: '主行动',
    range: '个人',
    duration: '1轮',
    effect: '获「隐形」1轮；攻击后显形',
    damage: null,
    status: { name: '隐形', duration: 1, breakOnAttack: true },
    scrollPrice: 30
  },
  '毒液飞溅': {
    school: SPELL_SCHOOL.SHADOW,
    level: 2,
    mpCost: 10,
    dc: 15,
    action: '主行动',
    range: '近距5m·锥形',
    duration: '即时',
    effect: '1d6毒素伤害；目标挂「中毒」2轮',
    damage: { dice: 1, sides: 6, type: '毒素', aoe: true },
    status: { name: '中毒', duration: 2 },
    scrollPrice: 80
  },
  '恐惧凝视': {
    school: SPELL_SCHOOL.SHADOW,
    level: 3,
    mpCost: 15,
    dc: 18,
    action: '主行动',
    range: '10m单目标',
    duration: '2轮',
    effect: '目标挂「恐慌」2轮；施法者需保持目光接触',
    damage: null,
    status: { name: '恐慌', duration: 2, breakDC: 14 },
    scrollPrice: 150
  },

  // ===== 通用学派 =====
  '魔法伎俩': {
    school: SPELL_SCHOOL.UNIVERSAL,
    level: 1,
    mpCost: 5,
    dc: 12,
    action: '主行动',
    range: '接触',
    duration: '即时',
    effect: '制造微小魔法幻象（飞烟/火光/微声）；侦察/社交辅助',
    damage: null,
    status: null,
    scrollPrice: 30
  },
  '鉴定术': {
    school: SPELL_SCHOOL.UNIVERSAL,
    level: 2,
    mpCost: 10,
    dc: 15,
    action: '主行动',
    range: '接触物品',
    duration: '即时',
    effect: '揭示物品魔法性质/制作年代/所属流派/是否陷阱',
    damage: null,
    status: null,
    identify: true,
    scrollPrice: 80
  },
  '变形自我': {
    school: SPELL_SCHOOL.UNIVERSAL,
    level: 3,
    mpCost: 15,
    dc: 18,
    action: '主行动',
    range: '个人',
    duration: '1小时',
    effect: '变形成小型动物（鼠/雀/猫），保留智力但力量归零；获「加速」；变回需主行动',
    damage: null,
    status: { name: '加速', duration: 60 },
    transform: true,
    scrollPrice: 150
  }
};

// ============== 法术系统类 ==============

class SpellSystem {
  constructor() {
    this.learnDC = { 1: 12, 2: 15, 3: 18, 4: 20, 5: 22 };
  }

  /**
   * 获取法术信息
   */
  getSpell(spellName) {
    return SPELLS[spellName] || null;
  }

  /**
   * 获取所有法术
   */
  getAllSpells() {
    return Object.entries(SPELLS).map(([name, data]) => ({
      name,
      ...data
    }));
  }

  /**
   * 按学派获取法术
   */
  getSpellsBySchool(school) {
    return Object.entries(SPELLS)
      .filter(([_, data]) => data.school === school)
      .map(([name, data]) => ({ name, ...data }));
  }

  /**
   * 按等级获取法术
   */
  getSpellsByLevel(level) {
    return Object.entries(SPELLS)
      .filter(([_, data]) => data.level === level)
      .map(([name, data]) => ({ name, ...data }));
  }

  /**
   * 计算角色MP上限
   */
  calculateMPMax(intelligence) {
    return intelligence * 5;
  }

  /**
   * 检查角色是否可以学习该法术（智力门槛）
   */
  canLearnSpell(character, spellName) {
    const spell = SPELLS[spellName];
    if (!spell) return { canLearn: false, reason: '法术不存在' };

    const intReq = SPELL_LEVEL[spell.level].intReq;
    if (character.attributes?.智力 < intReq) {
      return { canLearn: false, reason: `智力不足（需要${intReq}，当前${character.attributes?.智力}）` };
    }

    // 检查是否已习得
    const learned = character.spells?.find(s => s.name === spellName);
    if (learned) {
      if (learned.tier >= 3) {
        return { canLearn: false, reason: '已达最高等级（奥义）' };
      }
      return { canLearn: true, currentTier: learned.tier, nextTier: learned.tier + 1 };
    }

    return { canLearn: true, currentTier: 0, nextTier: 1 };
  }

  /**
   * 检查MP是否足够
   */
  hasEnoughMP(character, spellName) {
    const spell = SPELLS[spellName];
    if (!spell) return false;
    const mpCost = SPELL_LEVEL[spell.level].mpCost;
    return (character.mp || 0) >= mpCost;
  }

  /**
   * 消耗MP
   */
  consumeMP(character, spellName) {
    const spell = SPELLS[spellName];
    if (!spell) return 0;
    const mpCost = SPELL_LEVEL[spell.level].mpCost;
    character.mp = (character.mp || 0) - mpCost;
    return mpCost;
  }

  /**
   * 施法检定
   */
  castSpell(character, spellName, options = {}) {
    const spell = SPELLS[spellName];
    if (!spell) return { success: false, reason: '法术不存在' };

    // 检查MP
    if (!this.hasEnoughMP(character, spellName)) {
      return { success: false, reason: 'MP不足' };
    }

    // 检查是否已习得（书籍习得需要，卷轴不需要）
    if (!options.fromScroll) {
      const learned = character.spells?.find(s => s.name === spellName);
      if (!learned) {
        return { success: false, reason: '尚未习得该法术' };
      }
    }

    // 消耗MP
    const mpCost = this.consumeMP(character, spellName);

    // 施法检定
    const int = character.attributes?.智力 || 10;
    const intMod = Math.floor((int - 10) / 2);
    const pb = 1 + Math.ceil((character.level || 1) / 4);
    const hasStaff = options.hasStaff !== false;

    let roll = Math.floor(Math.random() * 20) + 1;
    let roll2 = null;
    let total = roll + intMod + pb;

    // 不持杖劣势（掷两次取低）
    if (!hasStaff) {
      roll2 = Math.floor(Math.random() * 20) + 1;
      roll = Math.min(roll, roll2);
      total = roll + intMod + pb;
    }

    const dc = spell.dc;
    const isCritical = roll === 20;
    const isFumble = roll === 1;
    const surplus = total - dc;

    let result = {
      spellName,
      spell,
      mpCost,
      roll,
      roll2,
      intMod,
      pb,
      total,
      dc,
      surplus,
      isCritical,
      isFumble,
      hasStaff,
      success: false
    };

    if (isFumble) {
      result.success = false;
      result.grade = '大失败';
      result.message = '天然1 - 法术失控！';
    } else if (isCritical || surplus >= 0) {
      result.success = true;
      result.grade = isCritical || surplus >= 10 ? '杰出' : surplus >= 5 ? '良品' : '普通';
      result.message = '施法成功';

      // 强化效果（Lv2/Lv3）
      const learned = character.spells?.find(s => s.name === spellName);
      if (learned) {
        if (learned.tier === 2) {
          result.enhanced = true;
          result.enhanceDesc = '精通强化';
        } else if (learned.tier === 3) {
          result.enhanced = true;
          result.enhanceDesc = '奥义强化';
        }
      }
    } else {
      result.success = false;
      result.grade = '失败';
      result.message = '施法失败，MP已消耗';
    }

    return result;
  }

  /**
   * 习得法术（书籍/卷轴/NPC教学等）
   */
  learnSpell(character, spellName, source, options = {}) {
    const spell = SPELLS[spellName];
    if (!spell) return { success: false, reason: '法术不存在' };

    // 智力检查
    const intReq = SPELL_LEVEL[spell.level].intReq;
    if (character.attributes?.智力 < intReq) {
      return { success: false, reason: `智力不足（需要${intReq}）` };
    }

    // 检查是否已习得
    if (!character.spells) character.spells = [];
    const existing = character.spells.find(s => s.name === spellName);

    if (existing) {
      if (existing.tier >= 3) {
        return { success: false, reason: '已达最高等级（奥义），静默拒绝' };
      }

      // 升级
      existing.tier += 1;
      existing.source = source;
      existing.learnLog = existing.learnLog || [];
      existing.learnLog.push({
        tier: existing.tier,
        source,
        time: new Date().toISOString(),
        ...options
      });

      const tierInfo = LEARN_TIER[existing.tier];
      const newName = spellName + tierInfo.suffix;

      return {
        success: true,
        action: 'upgrade',
        spellName,
        newName,
        fromTier: existing.tier - 1,
        toTier: existing.tier,
        message: `法术习得：${newName} Lv${existing.tier - 1}→Lv${existing.tier}（来源：${source}）`
      };
    } else {
      // 新习得
      character.spells.push({
        name: spellName,
        school: spell.school,
        level: spell.level,
        tier: 1,
        source,
        learnLog: [{
          tier: 1,
          source,
          time: new Date().toISOString(),
          ...options
        }]
      });

      // 更新法术计数
      character.spellCount = (character.spellCount || 0) + 1;

      return {
        success: true,
        action: 'learn',
        spellName,
        tier: 1,
        message: `法术习得：${spellName} Lv1（来源：${source}）`
      };
    }
  }

  /**
   * 卷轴施法（一次性，不需要习得）
   */
  castFromScroll(character, spellName, options = {}) {
    const spell = SPELLS[spellName];
    if (!spell) return { success: false, reason: '法术不存在' };

    // 卷轴不需要习得，但需要MP
    if (!this.hasEnoughMP(character, spellName)) {
      return { success: false, reason: 'MP不足' };
    }

    // 卷轴施法检定（不需要习得检定）
    const result = this.castSpell(character, spellName, { ...options, fromScroll: true });

    // 无论成功失败，卷轴都消失
    result.scrollConsumed = true;

    return result;
  }

  /**
   * 长休恢复MP
   */
  longRest(character) {
    const mpMax = this.calculateMPMax(character.attributes?.智力 || 10);
    character.mp = mpMax;
    return { mpMax, restored: mpMax };
  }

  /**
   * 药水恢复MP
   */
  restoreMP(character, amount) {
    const mpMax = this.calculateMPMax(character.attributes?.智力 || 10);
    const before = character.mp || 0;
    character.mp = Math.min(mpMax, before + amount);
    const restored = character.mp - before;
    return { restored, current: character.mp, max: mpMax };
  }

  /**
   * 获取法术列表（按学派分组）
   */
  getSpellsBySchoolGrouped() {
    const grouped = {};
    Object.entries(SPELLS).forEach(([name, data]) => {
      if (!grouped[data.school]) grouped[data.school] = [];
      grouped[data.school].push({ name, ...data });
    });
    return grouped;
  }

  /**
   * 计算法术伤害
   */
  rollDamage(spellName, tier = 1) {
    const spell = SPELLS[spellName];
    if (!spell || !spell.damage) return null;

    const dmg = spell.damage;
    let dice = dmg.dice;
    let sides = dmg.sides;

    // 强化效果
    if (tier === 2) dice += 1;
    else if (tier === 3) dice += 2;

    let total = 0;
    const rolls = [];
    for (let i = 0; i < dice; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      rolls.push(roll);
      total += roll;
    }

    const result = {
      dice: `${dice}d${sides}`,
      rolls,
      total,
      type: dmg.type
    };

    // 溅射伤害
    if (dmg.splash) {
      let splashTotal = 0;
      const splashRolls = [];
      for (let i = 0; i < dmg.splash.dice; i++) {
        const roll = Math.floor(Math.random() * dmg.splash.sides) + 1;
        splashRolls.push(roll);
        splashTotal += roll;
      }
      result.splash = {
        dice: `${dmg.splash.dice}d${dmg.splash.sides}`,
        rolls: splashRolls,
        total: splashTotal,
        type: dmg.type
      };
    }

    return result;
  }

  /**
   * 计算治疗骰
   */
  rollHeal(spellName, tier = 1) {
    const spell = SPELLS[spellName];
    if (!spell || !spell.heal) return null;

    const heal = spell.heal;
    let dice = heal.dice;
    let sides = heal.sides;

    if (tier === 2) dice += 1;
    else if (tier === 3) dice += 2;

    let total = 0;
    const rolls = [];
    for (let i = 0; i < dice; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      rolls.push(roll);
      total += roll;
    }

    return {
      dice: `${dice}d${sides}`,
      rolls,
      total
    };
  }
}

// 导出单例
export const spellSystem = new SpellSystem();

// 导出类供测试使用
export { SpellSystem };
