/**
 * quest-system.js - 任务系统（灾厄之后·重制版）
 * 
 * 功能：
 * - 任务定义与管理
 * - 任务接取/放弃/完成
 * - 任务目标追踪（击杀、收集、到达、对话等）
 * - 任务奖励发放（金币、物品、声望）
 * - 任务进度管理（未接取/进行中/已完成/失败）
 * - 任务时限检查
 * 
 * 规则来源：data-source/世界书/系统/任务系统.yaml
 */

// ==================== 任务类型定义 ====================

/**
 * 任务类型枚举
 */
export const QUEST_TYPE = {
  MERCENARY: '佣兵委托',      // 佣兵公会发布的公开悬赏
  FACTION: '势力任务',        // 各势力发布的任务
  PERSONAL: '个人请求',       // NPC 直接委托
  MAIN_STORY: '主线钩子'     // 剧情关键任务
};

/**
 * 任务进度枚举
 */
export const QUEST_STATUS = {
  AVAILABLE: '未接取',
  ACTIVE: '进行中',
  COMPLETED: '已完成',
  FAILED: '失败'
};

/**
 * 任务等级（五档）
 */
export const QUEST_TIER = {
  TRIVIAL: { name: '杂务委托', rewardMin: 0.5, rewardMax: 5, repMin: 1, repMax: 3 },
  COMMON: { name: '日常委托', rewardMin: 10, rewardMax: 50, repMin: 2, repMax: 5 },
  DANGEROUS: { name: '危险任务', rewardMin: 50, rewardMax: 150, repMin: 5, repMax: 10 },
  HIGH_RISK: { name: '高危任务', rewardMin: 150, rewardMax: 300, repMin: 8, repMax: 15 },
  CALAMITY: { name: '灾厄级', rewardMin: 300, rewardMax: 500, repMin: 10, repMax: 15 }
};

/**
 * 任务目标类型
 */
export const OBJECTIVE_TYPE = {
  KILL: '击杀',           // 击杀指定数量的怪物
  COLLECT: '收集',        // 收集指定数量的物品
  REACH: '到达',          // 到达指定地点
  TALK: '对话',           // 与指定 NPC 对话
  DELIVER: '交付',        // 交付指定物品
  ESCORT: '护送',         // 护送 NPC 到指定地点
  INVESTIGATE: '调查'     // 调查指定地点/事件
};

// ==================== 任务模板 ====================

/**
 * 创建任务模板
 * @param {Object} config - 任务配置
 * @returns {Object} 任务对象
 */
export function createQuest(config) {
  return {
    id: config.id || `quest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: config.name,                    // 任务名称
    type: config.type || QUEST_TYPE.MERCENARY,  // 任务类型
    tier: config.tier || QUEST_TIER.COMMON,     // 任务等级
    publisher: config.publisher,          // 发布者（NPC/势力/佣兵公会）
    targetArea: config.targetArea,        // 目标区域
    description: config.description,      // 任务描述
    objectives: config.objectives || [],  // 任务目标列表
    completionProof: config.completionProof || '', // 完成凭证
    status: QUEST_STATUS.AVAILABLE,       // 当前进度
    timeLimit: config.timeLimit || null,  // 任务时限（天）
    startTime: null,                      // 开始时间（接取时设置）
    rewards: config.rewards || {          // 奖励
      gold: 0,
      items: [],
      reputation: [],
      exp: 0
    },
    prerequisites: config.prerequisites || [], // 前置任务 ID
    followUp: config.followUp || null,    // 后续任务 ID
    notes: config.notes || '',            // 备注
    progress: {}                          // 进度追踪 { objectiveId: currentCount }
  };
}

// ==================== 任务管理 ====================

/**
 * 任务管理器
 */
class QuestManager {
  constructor() {
    this.quests = new Map();              // 所有任务 { id: quest }
    this.activeQuests = new Set();        // 活跃任务 ID
    this.completedQuests = new Set();     // 已完成任务 ID
  }

  /**
   * 添加任务到系统
   * @param {Object} quest - 任务对象
   */
  addQuest(quest) {
    this.quests.set(quest.id, quest);
  }

  /**
   * 获取任务
   * @param {string} questId - 任务 ID
   * @returns {Object|null} 任务对象
   */
  getQuest(questId) {
    return this.quests.get(questId) || null;
  }

  /**
   * 获取所有可用任务
   * @returns {Array} 可用任务列表
   */
  getAvailableQuests() {
    return Array.from(this.quests.values()).filter(q => q.status === QUEST_STATUS.AVAILABLE);
  }

  /**
   * 获取所有活跃任务
   * @returns {Array} 活跃任务列表
   */
  getActiveQuests() {
    return Array.from(this.activeQuests).map(id => this.quests.get(id)).filter(Boolean);
  }

  /**
   * 获取所有已完成任务
   * @returns {Array} 已完成任务列表
   */
  getCompletedQuests() {
    return Array.from(this.completedQuests).map(id => this.quests.get(id)).filter(Boolean);
  }

  /**
   * 接取任务
   * @param {string} questId - 任务 ID
   * @param {Object} player - 玩家对象（用于检查前置条件）
   * @returns {Object} 接取结果
   */
  acceptQuest(questId, player = {}) {
    const quest = this.quests.get(questId);
    if (!quest) {
      return { success: false, reason: '任务不存在' };
    }

    if (quest.status !== QUEST_STATUS.AVAILABLE) {
      return { success: false, reason: '任务不可接取' };
    }

    // 检查前置任务
    if (quest.prerequisites && quest.prerequisites.length > 0) {
      const missingPrereqs = quest.prerequisites.filter(id => !this.completedQuests.has(id));
      if (missingPrereqs.length > 0) {
        return { success: false, reason: '未完成前置任务', missing: missingPrereqs };
      }
    }

    // 检查活跃任务数量（建议不超过 3 条）
    if (this.activeQuests.size >= 3) {
      console.warn('活跃任务已达 3 条，建议先完成部分任务再接取新任务');
    }

    // 接取任务
    quest.status = QUEST_STATUS.ACTIVE;
    quest.startTime = Date.now();
    this.activeQuests.add(questId);

    // 初始化进度
    if (quest.objectives) {
      quest.objectives.forEach(obj => {
        quest.progress[obj.id] = 0;
      });
    }

    return { success: true, quest };
  }

  /**
   * 放弃任务
   * @param {string} questId - 任务 ID
   * @returns {Object} 放弃结果
   */
  abandonQuest(questId) {
    const quest = this.quests.get(questId);
    if (!quest) {
      return { success: false, reason: '任务不存在' };
    }

    if (quest.status !== QUEST_STATUS.ACTIVE) {
      return { success: false, reason: '任务非进行中' };
    }

    quest.status = QUEST_STATUS.FAILED;
    this.activeQuests.delete(questId);

    return { success: true, quest };
  }

  /**
   * 更新任务目标进度
   * @param {string} questId - 任务 ID
   * @param {string} objectiveId - 目标 ID
   * @param {number} amount - 进度增量
   * @returns {Object} 更新结果
   */
  updateObjective(questId, objectiveId, amount = 1) {
    const quest = this.quests.get(questId);
    if (!quest || quest.status !== QUEST_STATUS.ACTIVE) {
      return { success: false, reason: '任务不可更新' };
    }

    const objective = quest.objectives.find(o => o.id === objectiveId);
    if (!objective) {
      return { success: false, reason: '目标不存在' };
    }

    // 更新进度
    quest.progress[objectiveId] = (quest.progress[objectiveId] || 0) + amount;

    // 检查是否完成
    const completed = quest.progress[objectiveId] >= objective.count;

    // 检查所有目标是否完成
    const allCompleted = quest.objectives.every(obj => 
      (quest.progress[obj.id] || 0) >= obj.count
    );

    if (allCompleted) {
      quest.status = QUEST_STATUS.COMPLETED;
      this.activeQuests.delete(questId);
      this.completedQuests.add(questId);
    }

    return { 
      success: true, 
      completed: allCompleted,
      objectiveCompleted: completed,
      progress: quest.progress[objectiveId],
      required: objective.count
    };
  }

  /**
   * 完成任务并领取奖励
   * @param {string} questId - 任务 ID
   * @param {Object} player - 玩家对象
   * @returns {Object} 完成结果
   */
  completeQuest(questId, player) {
    const quest = this.quests.get(questId);
    if (!quest) {
      return { success: false, reason: '任务不存在' };
    }

    if (quest.status !== QUEST_STATUS.COMPLETED) {
      return { success: false, reason: '任务未完成' };
    }

    // 发放奖励
    const rewards = quest.rewards;
    const result = {
      success: true,
      rewards: {
        gold: 0,
        items: [],
        reputation: [],
        exp: 0
      }
    };

    // 金币奖励（佣兵公会委托扣 10% 佣金）
    if (rewards.gold > 0) {
      let gold = rewards.gold;
      if (quest.type === QUEST_TYPE.MERCENARY) {
        gold = Math.floor(gold * 0.9); // 扣 10% 佣金
      }
      if (player.addGold) {
        player.addGold(gold);
      }
      result.rewards.gold = gold;
    }

    // 物品奖励
    if (rewards.items && rewards.items.length > 0) {
      rewards.items.forEach(item => {
        if (player.addItem) {
          player.addItem(item);
        }
        result.rewards.items.push(item);
      });
    }

    // 声望奖励
    if (rewards.reputation && rewards.reputation.length > 0) {
      rewards.reputation.forEach(rep => {
        if (player.addReputation) {
          player.addReputation(rep.faction, rep.amount);
        }
        result.rewards.reputation.push(rep);
      });
    }

    // 经验奖励
    if (rewards.exp > 0) {
      if (player.addExp) {
        player.addExp(rewards.exp);
      }
      result.rewards.exp = rewards.exp;
    }

    return result;
  }

  /**
   * 检查任务时限
   * @param {string} questId - 任务 ID
   * @returns {Object} 检查结果
   */
  checkTimeLimit(questId) {
    const quest = this.quests.get(questId);
    if (!quest || quest.status !== QUEST_STATUS.ACTIVE) {
      return { success: false, reason: '任务非进行中' };
    }

    if (!quest.timeLimit) {
      return { success: true, expired: false }; // 无时限
    }

    const elapsed = Date.now() - quest.startTime;
    const elapsedDays = elapsed / (1000 * 60 * 60 * 24);
    const expired = elapsedDays > quest.timeLimit;

    if (expired) {
      quest.status = QUEST_STATUS.FAILED;
      this.activeQuests.delete(questId);
    }

    return { 
      success: true, 
      expired,
      elapsedDays: Math.floor(elapsedDays),
      timeLimit: quest.timeLimit
    };
  }

  /**
   * 按类型筛选任务
   * @param {string} type - 任务类型
   * @returns {Array} 任务列表
   */
  getQuestsByType(type) {
    return Array.from(this.quests.values()).filter(q => q.type === type);
  }

  /**
   * 按发布者筛选任务
   * @param {string} publisher - 发布者
   * @returns {Array} 任务列表
   */
  getQuestsByPublisher(publisher) {
    return Array.from(this.quests.values()).filter(q => q.publisher === publisher);
  }

  /**
   * 按目标区域筛选任务
   * @param {string} area - 区域名
   * @returns {Array} 任务列表
   */
  getQuestsByArea(area) {
    return Array.from(this.quests.values()).filter(q => q.targetArea === area);
  }

  /**
   * 导出任务数据（用于存档）
   * @returns {Object} 任务数据
   */
  exportData() {
    return {
      quests: Array.from(this.quests.entries()),
      activeQuests: Array.from(this.activeQuests),
      completedQuests: Array.from(this.completedQuests)
    };
  }

  /**
   * 导入任务数据（从存档恢复）
   * @param {Object} data - 任务数据
   */
  importData(data) {
    this.quests = new Map(data.quests);
    this.activeQuests = new Set(data.activeQuests);
    this.completedQuests = new Set(data.completedQuests);
  }
}

// ==================== 导出 ====================

// 创建全局任务管理器实例
export const questManager = new QuestManager();

export default {
  QUEST_TYPE,
  QUEST_STATUS,
  QUEST_TIER,
  OBJECTIVE_TYPE,
  createQuest,
  QuestManager,
  questManager
};
