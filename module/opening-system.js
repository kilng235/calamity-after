/**
 * 开局系统 - 灾厄之后独立版
 * 基于世界书开局大纲.yaml + 开局生成规则.yaml
 *
 * 核心功能：
 * - 初始角色状态创建
 * - 开局叙事生成（按身份差异化）
 * - 初始任务创建
 * - 世界书接入（开局数据注入AI提示词）
 */

// ============== 固定锚点 ==============

export const OPENING_ANCHOR = {
  time: {
    year: 300,
    month: 11,
    day: 12,
    hour: 7,
    minute: 10,
    display: '灾厄纪年300年11月12日 07:10'
  },
  location: {
    region: '锈钉镇',
    town: '锈钉',
    place: '佣兵公会大厅',
    full: '锈钉镇，佣兵公会大厅'
  },
  initialState: {
    gold: 15,
    hp: 100,
    hpMax: 100,
    fatePoint: 1,
    level: 1,
    ac: 10,
    startingWeapon: {
      name: '铁剑',
      type: '剑',
      slot: 'mainHand',
      durability: 80,
      durabilityMax: 80,
      damage: { dice: 1, sides: 8 },
      quality: '普通'
    }
  }
};

// ============== 身份差异化 ==============

export const IDENTITY_OPENINGS = {
  '遗迹猎手': {
    scene: '正对着便携解码器调试参数，抬头审视公会内的陈设',
    greeting: '「遗迹猎手？听说你们这行最近都在盯着 09 号废弃避难所的动静。」',
    interaction: '先交流旧日避难所情报，再引导接任务'
  },
  '圣火祭司': {
    scene: '手抚胸前圣火徽记，低声念诵着晨祷词',
    greeting: '「愿圣火庇佑你，祭司。风蚀哨站那边近来异端传言四起，教团正需要信使。」',
    interaction: '先给予教团礼遇，再引导接任务'
  },
  '荒原游侠': {
    scene: '身上带着沙尘与刺鼻的驱兽草气息，目光警觉扫视四周',
    greeting: '「游侠，外面的风暴停了？失踪的荒原巡逻队至今还没消息，大家都指望你们探路。」',
    interaction: '先问候荒原气象与失联巡逻队，再引导接任务'
  },
  '机械工匠': {
    scene: '腰间挂满扳手与精密机件，正打量着大厅那台老旧的供暖锅炉',
    greeting: '「工匠师傅！哨站外围的自卫炮台又瘫痪了两台，正缺懂行的人去看看。」',
    interaction: '先商讨器械维修委托，再引导接任务'
  },
  '异化行者': {
    scene: '兜帽压得很低，隐匿斗篷下隐约浮现微弱的能量纹路',
    greeting: '「……坐吧，别太招摇。听说回声谷深处有些旧时代的生化制剂，兴许对你有用。」',
    interaction: '保持低调交易，再引导接任务'
  },
  '旧日学者': {
    scene: '手里捧着炭笔与羊皮纸手记，正仔细辨识公会石柱上的风化铭文',
    greeting: '「学者阁下，灰烬森林方尖碑的古文字，公会里没人认得，正想请您过目。」',
    interaction: '先探讨历史文献残卷，再引导接任务'
  },
  '自由人': {
    scene: '靠在吧台旁要了杯廉价麦酒，神色轻松自若',
    greeting: '「新面孔。名字、种族、特质，自己填，填完盖手印。荒原很大，全看你自己挑活。」',
    interaction: '直接递上登记表，引导完成自由建档'
  }
};

// 7 大身份专属初始主线任务字典
export const IDENTITY_QUESTS = {
  '遗迹猎手': {
    id: 'quest_identity_relic_hunter',
    name: '失落避难所的讯号',
    type: '身份主线',
    issuer: '先驱者遗物',
    targetArea: '09号避难所周边',
    description: '破译随身携带的加密磁盘，寻找 09 号废弃避难所的隐藏入口',
    objectives: [
      { id: 'obj_1', type: 'explore', target: '寻找懂得破译磁盘的技师', required: 1, current: 0, reward: 20 }
    ],
    deadline: { days: 7, display: '7天' },
    rewards: { gold: 20, exp: 50, fatePoint: 1 }
  },
  '圣火祭司': {
    id: 'quest_identity_pyro_priest',
    name: '圣火教团的密信',
    type: '身份主线',
    issuer: '圣火大教堂',
    targetArea: '风蚀哨站',
    description: '将神圣密函送达风蚀哨站的主教手中，调查近期渗透的异教徒谣言',
    objectives: [
      { id: 'obj_1', type: 'travel', target: '抵达风蚀哨站会见主教', required: 1, current: 0, reward: 20 }
    ],
    deadline: { days: 5, display: '5天' },
    rewards: { gold: 15, exp: 50, fatePoint: 1 }
  },
  '荒原游侠': {
    id: 'quest_identity_wasteland_ranger',
    name: '沙暴中的失踪巡逻队',
    type: '身份主线',
    issuer: '巡逻队哨卡',
    targetArea: '风蚀荒原',
    description: '循着风蚀平原的血迹与残骸，追查荒原失联巡逻分队的下落',
    objectives: [
      { id: 'obj_1', type: 'investigate', target: '搜寻失踪巡逻队遗留痕迹', required: 1, current: 0, reward: 20 }
    ],
    deadline: { days: 5, display: '5天' },
    rewards: { gold: 20, exp: 50, fatePoint: 1 }
  },
  '机械工匠': {
    id: 'quest_identity_mech_artisan',
    name: '动力核心过载之谜',
    type: '身份主线',
    issuer: '工匠工坊',
    targetArea: '哨站外围',
    description: '收集高纯度动力元件，修复哨站外围报废的自卫炮台',
    objectives: [
      { id: 'obj_1', type: 'repair', target: '收集动力核心并修复自卫炮台', required: 1, current: 0, reward: 25 }
    ],
    deadline: { days: 5, display: '5天' },
    rewards: { gold: 25, exp: 50, fatePoint: 1 }
  },
  '异化行者': {
    id: 'quest_identity_mutant_stalker',
    name: '血脉异动的源头',
    type: '身份主线',
    issuer: '自身本能',
    targetArea: '回声谷废墟',
    description: '前往回声谷废墟寻找旧时代基因冷冻液，压制体内的血脉异化',
    objectives: [
      { id: 'obj_1', type: 'collect', target: '采集回声谷旧科研所冷冻液', required: 1, current: 0, reward: 20 }
    ],
    deadline: { days: 7, display: '7天' },
    rewards: { gold: 10, exp: 50, fatePoint: 1 }
  },
  '旧日学者': {
    id: 'quest_identity_ancient_scholar',
    name: '灾厄编年史残页',
    type: '身份主线',
    issuer: '文明复兴学社',
    targetArea: '灰烬森林',
    description: '探访灰烬森林中的古代方尖碑，拓印石碑铭文以拼凑灾厄历史',
    objectives: [
      { id: 'obj_1', type: 'investigate', target: '拓印古代方尖碑铭文', required: 1, current: 0, reward: 20 }
    ],
    deadline: { days: 5, display: '5天' },
    rewards: { gold: 15, exp: 50, fatePoint: 1 }
  },
  '自由人': {
    id: 'quest_identity_freeman',
    name: '荒原的第一桶金',
    type: '佣兵委托',
    issuer: '佣兵公会',
    targetArea: '灰烬森林',
    description: '灰烬森林外围材料狩猎，收集灰烬狼皮和焦木蜥鳞片，完成初次立足委托',
    objectives: [
      { id: 'obj_1', type: 'collect', target: '灰烬狼皮', required: 3, current: 0, reward: 3 },
      { id: 'obj_2', type: 'collect', target: '焦木蜥鳞片', required: 2, current: 0, reward: 5 }
    ],
    deadline: { days: 3, display: '3天' },
    rewards: { gold: 19, exp: 50, fatePoint: 1 }
  }
};

// ============== 默认初始任务 (兼容) ==============
export const INITIAL_QUEST = IDENTITY_QUESTS['自由人'];

// ============== 主线钩子 ==============

export const MAIN_PLOT_HOOK = {
  id: 'hook_main_001',
  name: '老维特失踪',
  location: '告示板角落',
  description: '泛黄旧单，墨迹洇开，铁钉生锈',
  triggerCondition: '玩家主动询问',
  autoProgress: false,
  reward: '待定'
};

// ============== 可选支线事件 ==============

export const OPTIONAL_EVENTS = [
  {
    id: 'event_001',
    name: '求救马车',
    location: '出城沿途',
    trigger: 'random',
    weight: 1
  },
  {
    id: 'event_002',
    name: '拾荒者痕迹',
    location: '出城沿途',
    trigger: 'random',
    weight: 1
  },
  {
    id: 'event_003',
    name: '迷路的商队',
    location: '出城沿途',
    trigger: 'random',
    weight: 1
  }
];

// ============== 开局系统类 ==============

class OpeningSystem {
  constructor() {
    this.initialized = false;
  }

  /**
   * 初始化游戏（玩家发送「登记档案」后调用）
   */
  initializeGame(characterData) {
    // 创建初始角色状态
    const character = this.createInitialCharacter(characterData);

    // 创建初始任务
    const quest = this.createInitialQuest(character.identity);

    // 生成开局叙事
    const narrative = this.generateOpeningNarrative(character);

    // 创建世界书开局数据
    const openingData = this.createOpeningWorldbookData(character, quest, narrative);
    this.openingData = openingData;

    this.initialized = true;

    return {
      success: true,
      character,
      quest,
      narrative,
      openingData,
      message: '开局初始化完成'
    };
  }

  /**
   * 创建初始角色
   */
  createInitialCharacter(data) {
    const defaults = {
      name: data.name || '无名流浪者',
      race: data.race || '人类',
      identity: data.identity || '自由人',
      attributes: data.attributes || {
        力量: 10,
        敏捷: 10,
        体质: 10,
        智力: 10,
        感知: 10,
        魅力: 10
      },
      talents: data.talents || [],
      ...OPENING_ANCHOR.initialState
    };

    // 计算AC（按六维派生）
    const dexMod = Math.floor((defaults.attributes.敏捷 - 10) / 2);
    defaults.ac = 10 + dexMod;

    // 计算负重
    const strMod = Math.floor((defaults.attributes.力量 - 10) / 2);
    const extraCarry = (defaults.identity === '自由人') ? 10 : 0;
    defaults.carryCapacity = 15 + strMod * 5 + extraCarry;

    // 初始装备
    defaults.equipment = {
      mainHand: { ...OPENING_ANCHOR.initialState.startingWeapon },
      offHand: null,
      head: null,
      body: null,
      accessory: null
    };

    // 初始背包（包含身份专属初始信物）
    defaults.inventory = [];
    if (typeof window !== 'undefined' && window.identitySystem && window.identitySystem.getEntry) {
      const idEntry = window.identitySystem.getEntry(defaults.identity);
      if (idEntry && idEntry.item) {
        defaults.inventory.push({
          id: 'item_identity_' + (defaults.identity || 'freeman'),
          name: idEntry.item.name,
          type: idEntry.item.type,
          description: idEntry.item.desc,
          count: 1,
          weight: 1,
          quality: '精良'
        });
      }
    }

    // 初始技能
    defaults.skills = [];

    // 初始法术
    defaults.spells = [];

    // 初始MP（按智力，系数走数值契约）
    const perInt = (typeof window !== 'undefined' && window.numericContract && window.numericContract.法力) ? (window.numericContract.法力.每点智力 || 5) : 5;
    defaults.mp = defaults.attributes.智力 * perInt;
    defaults.mpMax = defaults.mp;

    // 初始时间地点
    defaults.time = { ...OPENING_ANCHOR.time };
    defaults.location = { ...OPENING_ANCHOR.location };

    return defaults;
  }

  /**
   * 创建初始任务（根据身份动态匹配）
   */
  createInitialQuest(identity) {
    const idKey = identity || '自由人';
    const questTemplate = IDENTITY_QUESTS[idKey] || IDENTITY_QUESTS['自由人'];
    return {
      ...questTemplate,
      status: '进行中',
      acceptedTime: { ...OPENING_ANCHOR.time },
      deadlineTime: {
        year: OPENING_ANCHOR.time.year,
        month: OPENING_ANCHOR.time.month,
        day: OPENING_ANCHOR.time.day + (questTemplate.deadline ? questTemplate.deadline.days : 3),
        hour: OPENING_ANCHOR.time.hour,
        minute: OPENING_ANCHOR.time.minute
      }
    };
  }

  /**
   * 生成开局叙事
   */
  generateOpeningNarrative(character) {
    const identity = character.identity || '自由人';
    const opening = IDENTITY_OPENINGS[identity] || IDENTITY_OPENINGS['自由人'];
    const questTemplate = IDENTITY_QUESTS[identity] || IDENTITY_QUESTS['自由人'];

    // 基础场景描述
    let narrative = `锈钉镇的清晨比想象中醒得早。天还没全亮，铁匠铺的锤声就隔着两条街传过来，一下一下，像给整座镇子敲着起床的鼓点。你裹着旧斗篷穿过主街，灰烬雾还没散，空气里混着铁锈、隔夜麦酒和木柴烧过的味道。三百年了，这座镇子就这样醒过来，日复一日。\n\n`;

    // 身份差异化场景
    narrative += `佣兵公会在主街尽头，门脸不大，一块铁牌歪歪斜斜钉在门框上，写着「自由佣兵联盟」几个褪色的字。推门进去，炭火盆的暖意扑面而来，大厅里已经坐了三两拨人。柜台后的办事员抬起头，${opening.scene}。\n\n`;

    // 接待员对话
    narrative += `${opening.greeting}\n\n`;

    // 任务介绍
    narrative += `办完登记手续，办事员递过一张专属委托信笺：「这是匹配你身份的当务之急——『${questTemplate.name}』。${questTemplate.description}。接好信物，荒原上多加小心。」\n\n`;

    // 主线钩子
    narrative += `告示板的角落里，还钉着一张边角泛黄的旧单子，墨迹被潮气洇开大半，只隐约能认出几个字：老维特，失踪，赏金待定。铁钉已经生锈，像是钉在那里很久了。\n\n`;

    // 出城
    narrative += `你把委托单收好塞进斗篷内袋。出城时铁匠铺门口的矮人铁匠看了一眼你腰间的武器，咧嘴一笑：「新面孔，第一单活？」你微微颔首，他也不再多问，回身继续敲他的铁。镇门口的老守门人叼着烟斗，扫过你的登记凭证，摆摆手：「荒原深处近来不太平，天黑前尽量找据点过夜。」\n\n`;

    // 结尾
    narrative += `公会大门在你身后合上，灰烬雾正从镇外漫进来。地平线的尽头，天边泛着一层肃杀的灰白。\n\n接下来，往哪走，是你自己的事了。`;

    return narrative;
  }

  /**
   * 创建开局世界书数据
   */
  createOpeningWorldbookData(character, quest, narrative) {
    return {
      entryName: '开局数据',
      category: '开局',
      content: {
        time: character.time,
        location: character.location,
        character: {
          name: character.name,
          race: character.race,
          identity: character.identity,
          attributes: character.attributes,
          hp: character.hp,
          hpMax: character.hpMax,
          mp: character.mp,
          mpMax: character.mpMax,
          gold: character.gold,
          level: character.level,
          ac: character.ac,
          fatePoint: character.fatePoint
        },
        initialQuest: quest,
        mainPlotHook: MAIN_PLOT_HOOK,
        optionalEvents: OPTIONAL_EVENTS,
        openingNarrative: narrative
      },
      keywords: ['开局', '初始', '锈钉', '佣兵公会', '灰烬森林'],
      enabled: true
    };
  }

  /**
   * 获取开局数据（供世界书使用）
   */
  getOpeningData() {
    if (!this.initialized) {
      return null;
    }
    return this.openingData;
  }

  /**
   * 检查是否需要开局引导
   */
  needsOpeningGuide(playerMessage) {
    const triggers = ['登记档案', '建档', '开始游戏', '新游戏'];
    return triggers.some(t => playerMessage.includes(t));
  }

  /**
   * 生成开局引导文本
   */
  generateOpeningGuide() {
    return `【开局引导】

请发送「登记档案」完成角色创建，格式如下：

姓名：[角色名]
种族：[人类/精灵/矮人/兽人/犬人/兔耳族/灵耳族/混血]
身份：[佣兵/拾荒者/学者/猎人/商贩/工匠/医师]
六维：力量[1-20] 敏捷[1-20] 体质[1-20] 智力[1-20] 感知[1-20] 魅力[1-20]
背景特质：[最多2项]

示例：
姓名：艾什
种族：人类
身份：佣兵
六维：力量14 敏捷12 体质13 智力10 感知11 魅力10
背景特质：旧日遗民、铁匠学徒

或者直接发送「默认开局」使用默认值（人类佣兵/全10六维）开始游戏。`;
  }
}

// 导出单例
export const openingSystem = new OpeningSystem();

// 导出类供测试使用
export { OpeningSystem };
