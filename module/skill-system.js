/**
 * skill-system.js - 技能系统（灾厄之后·重制版）
 * 
 * 功能：
 * - 技能习得与管理（5种来源）
 * - 技能升级（Lv1→Lv2→Lv3）
 * - 技能检定（d20 + 调整值 + PB + 技能加值）
 * - 技能命名规则（场景关键词+动作动词）
 * - 重复习得改名规则（·精通、·奥义）
 * - 年度限制（≤5/年）
 * 
 * 规则来源：data-source/世界书/系统/技能总纲.yaml
 */

// ==================== 技能等级定义 ====================

/**
 * 技能等级加值表
 */
export const SKILL_LEVEL = {
  1: { bonus: 0, name: '基础', suffix: '' },
  2: { bonus: 2, name: '精通', suffix: '·精通' },
  3: { bonus: 4, name: '奥义', suffix: '·奥义' }
};

/**
 * 习得来源枚举
 */
export const LEARN_SOURCE = {
  NPC_TEACH: 'NPC教学',
  COMBAT_IMITATE: '战斗模仿',
  SOCIAL_LEARN: '社交获得',
  OBSERVE_LEARN: '旁观学习',
  LOOT_LEARN: '战利品习得'
};

/**
 * 六类场景关键词
 */
export const SCENE_KEYWORDS = {
  WEAPON: ['剑术斩击', '斧术劈砍', '弓术连射', '锤术重击', '长枪穿刺', '匕首暗刺'],
  HEAL: ['草药熬制', '伤口缝合', '急救包扎', '净化解毒'],
  CRAFT: ['金属锻造', '药剂炼制', '皮革缝制', '木工雕刻', '织物编织'],
  SOCIAL: ['讨价还价', '言语说服', '威吓压制', '鼓舞士气', '暗中观察', '伪装身份'],
  OBSERVE: ['视觉追踪', '听觉定位', '痕迹辨识', '地形记忆'],
  LOOT: [] // 动态生成：物品名 + 掌握/精通/亲和
};

/**
 * 动作动词
 */
export const ACTION_VERBS = ['斩击', '劈砍', '连射', '重击', '穿刺', '暗刺', '熬制', '缝合', '包扎', '解毒', '锻造', '炼制', '缝制', '雕刻', '编织', '说服', '压制', '鼓舞', '观察', '伪装', '追踪', '定位', '辨识', '记忆'];

// ==================== 技能管理 ====================

/**
 * 技能管理器
 */
class SkillManager {
  constructor() {
    this.skills = new Map();           // 技能表 { skillName: { level, source, learnLog } }
    this.annualCount = 0;              // 本年度随机 NPC 来源习得次数
    this.maxAnnualCount = 5;           // 年度上限
  }

  /**
   * 生成技能名
   * @param {string} scene - 场景关键词
   * @param {string} action - 动作动词
   * @returns {string} 技能名
   */
  generateSkillName(scene, action) {
    return `${scene}${action}`;
  }

  /**
   * 生成战利品技能名
   * @param {string} itemName - 物品名
   * @param {string} mastery - 掌握程度（掌握/精通/亲和）
   * @returns {string} 技能名
   */
  generateLootSkillName(itemName, mastery = '掌握') {
    return `${itemName}·${mastery}`;
  }

  /**
   * 检查是否可以习得（年度限制）
   * @param {string} source - 习得来源
   * @returns {Object} 检查结果
   */
  canLearn(source) {
    // 战利品习得不消耗年度限制
    if (source === LEARN_SOURCE.LOOT_LEARN) {
      return { canLearn: true };
    }

    // 随机 NPC 来源受年度限制
    if ([LEARN_SOURCE.COMBAT_IMITATE, LEARN_SOURCE.SOCIAL_LEARN, LEARN_SOURCE.OBSERVE_LEARN].includes(source)) {
      if (this.annualCount >= this.maxAnnualCount) {
        return { canLearn: false, reason: '年度习得次数已达上限（5次/年）' };
      }
    }

    return { canLearn: true };
  }

  /**
   * 习得技能
   * @param {string} skillName - 技能名
   * @param {string} source - 习得来源
   * @returns {Object} 习得结果
   */
  learnSkill(skillName, source) {
    // 检查年度限制
    const canLearnCheck = this.canLearn(source);
    if (!canLearnCheck.canLearn) {
      return { success: false, reason: canLearnCheck.reason };
    }

    const existingSkill = this.skills.get(skillName);

    if (!existingSkill) {
      // 新技能：Lv1
      this.skills.set(skillName, {
        name: skillName,
        level: 1,
        source: source,
        learnLog: [{ level: 1, source: source, time: Date.now() }]
      });

      // 更新年度计数
      if ([LEARN_SOURCE.COMBAT_IMITATE, LEARN_SOURCE.SOCIAL_LEARN, LEARN_SOURCE.OBSERVE_LEARN].includes(source)) {
        this.annualCount++;
      }

      return { success: true, learned: true, skill: this.skills.get(skillName) };
    }

    // 已习得：检查等级
    if (existingSkill.level >= 3) {
      // Lv3 后再次习得：静默拒绝
      return { success: false, reason: '技能已达最高等级（Lv3）', silent: true };
    }

    // 升级：Lv1→Lv2 或 Lv2→Lv3
    const oldLevel = existingSkill.level;
    const newLevel = oldLevel + 1;
    const newSuffix = SKILL_LEVEL[newLevel].suffix;
    const newName = skillName.replace(/·(精通|奥义)?$/, '') + newSuffix;

    // 更新技能
    this.skills.delete(skillName);
    this.skills.set(newName, {
      name: newName,
      level: newLevel,
      source: source,
      learnLog: [...existingSkill.learnLog, { level: newLevel, source: source, time: Date.now() }]
    });

    // 更新年度计数
    if ([LEARN_SOURCE.COMBAT_IMITATE, LEARN_SOURCE.SOCIAL_LEARN, LEARN_SOURCE.OBSERVE_LEARN].includes(source)) {
      this.annualCount++;
    }

    return { 
      success: true, 
      upgraded: true, 
      oldLevel, 
      newLevel, 
      oldName: skillName, 
      newName,
      skill: this.skills.get(newName)
    };
  }

  /**
   * 获取技能
   * @param {string} skillName - 技能名
   * @returns {Object|null} 技能对象
   */
  getSkill(skillName) {
    return this.skills.get(skillName) || null;
  }

  /**
   * 获取所有技能
   * @returns {Array} 技能列表
   */
  getAllSkills() {
    return Array.from(this.skills.values());
  }

  /**
   * 获取技能检定加值
   * @param {string} skillName - 技能名
   * @returns {number} 加值（0 表示无此技能）
   */
  getSkillBonus(skillName) {
    const skill = this.skills.get(skillName);
    if (!skill) return 0;
    return SKILL_LEVEL[skill.level].bonus;
  }

  /**
   * 检查是否有某技能
   * @param {string} skillName - 技能名
   * @returns {boolean}
   */
  hasSkill(skillName) {
    return this.skills.has(skillName);
  }

  /**
   * 计算技能检定总值
   * @param {Object} character - 角色对象
   * @param {string} skillName - 技能名
   * @param {string} attribute - 属性名
   * @returns {Object} 检定详情
   */
  calculateSkillCheck(character, skillName, attribute) {
    const skill = this.skills.get(skillName);
    const attributeValue = character.attributes?.[attribute] || 10;
    const modifier = Math.floor((attributeValue - 10) / 2);
    const pb = character.proficiencyBonus || 2;
    const skillBonus = skill ? SKILL_LEVEL[skill.level].bonus : 0;

    return {
      attribute,
      attributeValue,
      modifier,
      pb,
      skillBonus,
      totalBonus: modifier + pb + skillBonus,
      hasSkill: !!skill,
      skillLevel: skill?.level || 0
    };
  }

  /**
   * 重置年度计数（新年）
   */
  resetAnnualCount() {
    this.annualCount = 0;
  }

  /**
   * 导出技能数据（用于存档）
   * @returns {Object} 技能数据
   */
  exportData() {
    return {
      skills: Array.from(this.skills.entries()),
      annualCount: this.annualCount
    };
  }

  /**
   * 导入技能数据（从存档恢复）
   * @param {Object} data - 技能数据
   */
  importData(data) {
    this.skills = new Map(data.skills);
    this.annualCount = data.annualCount || 0;
  }
}

// ==================== 导出 ====================

// 创建全局技能管理器实例
export const skillManager = new SkillManager();

export default {
  SKILL_LEVEL,
  LEARN_SOURCE,
  SCENE_KEYWORDS,
  ACTION_VERBS,
  SkillManager,
  skillManager
};
