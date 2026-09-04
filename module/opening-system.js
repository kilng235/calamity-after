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
    region: '佣兵镇',
    town: '锈钉',
    place: '佣兵公会大厅',
    full: '佣兵镇·锈钉，佣兵公会大厅'
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
  '佣兵': {
    scene: '来公会报到登记，接待员递上登记表',
    greeting: '「新面孔。名字、种族、特质，自己填，填完盖手印。」',
    interaction: '接待员直接递上登记表，引导完成建档'
  },
  '拾荒者': {
    scene: '顺路兑战利品，顺手接单',
    greeting: '「又来兑货？正好，昨晚上新贴了个活。」',
    interaction: '先兑换战利品，再引导接任务'
  },
  '学者': {
    scene: '雇向导查资料，接单作野外保障',
    greeting: '「要雇向导？灰烬森林那边正好有个委托，顺路。」',
    interaction: '先谈雇佣向导，再引导接任务'
  },
  '猎人': {
    scene: '卖猎物顺带问行情，接单',
    greeting: '「今天的猎物不错。正好有个材料狩猎的活，接不接？」',
    interaction: '先卖猎物，再引导接任务'
  },
  '商贩': {
    scene: '谈供货押运，接单',
    greeting: '「要谈押运？正好有个灰烬森林的活，顺路。」',
    interaction: '先谈押运合作，再引导接任务'
  },
  '工匠': {
    scene: '交订单修装备，接单',
    greeting: '「修装备？正好，修完有个活给你看看。」',
    interaction: '先修装备，再引导接任务'
  },
  '医师': {
    scene: '收药材卖药剂，接单',
    greeting: '「收药材？正好有个灰烬森林的活，需要医师。」',
    interaction: '先收药材，再引导接任务'
  }
};

// ============== 初始任务模板 ==============

export const INITIAL_QUEST = {
  id: 'quest_initial_001',
  name: '灰烬森林材料狩猎',
  type: '佣兵委托',
  issuer: '佣兵公会',
  targetArea: '灰烬森林',
  description: '灰烬森林外围材料狩猎，收集灰烬狼皮和焦木蜥鳞片',
  objectives: [
    {
      id: 'obj_1',
      type: 'collect',
      target: '灰烬狼皮',
      required: 3,
      current: 0,
      reward: 3
    },
    {
      id: 'obj_2',
      type: 'collect',
      target: '焦木蜥鳞片',
      required: 2,
      current: 0,
      reward: 5
    }
  ],
  deadline: {
    days: 3,
    display: '3天'
  },
  rewards: {
    gold: 19, // 3*3 + 2*5 = 19
    reputation: {
      faction: '佣兵公会',
      amount: 5
    },
    commission: 0.1 // 公会抽成10%
  },
  notes: '按市价结算，公会抽一成'
};

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
    const quest = this.createInitialQuest();

    // 生成开局叙事
    const narrative = this.generateOpeningNarrative(character);

    // 创建世界书开局数据
    const openingData = this.createOpeningWorldbookData(character, quest, narrative);

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
      name: data.name || '无名佣兵',
      race: data.race || '人类',
      identity: data.identity || '佣兵',
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
    defaults.carryCapacity = 15 + strMod * 5;

    // 初始装备
    defaults.equipment = {
      mainHand: { ...OPENING_ANCHOR.initialState.startingWeapon },
      offHand: null,
      head: null,
      body: null,
      accessory: null
    };

    // 初始背包
    defaults.inventory = [];

    // 初始技能
    defaults.skills = [];

    // 初始法术
    defaults.spells = [];

    // 初始MP（按智力）
    defaults.mp = defaults.attributes.智力 * 5;
    defaults.mpMax = defaults.mp;

    // 初始时间地点
    defaults.time = { ...OPENING_ANCHOR.time };
    defaults.location = { ...OPENING_ANCHOR.location };

    return defaults;
  }

  /**
   * 创建初始任务
   */
  createInitialQuest() {
    return {
      ...INITIAL_QUEST,
      status: '进行中',
      acceptedTime: { ...OPENING_ANCHOR.time },
      deadlineTime: {
        year: OPENING_ANCHOR.time.year,
        month: OPENING_ANCHOR.time.month,
        day: OPENING_ANCHOR.time.day + 3,
        hour: OPENING_ANCHOR.time.hour,
        minute: OPENING_ANCHOR.time.minute
      }
    };
  }

  /**
   * 生成开局叙事
   */
  generateOpeningNarrative(character) {
    const identity = character.identity;
    const opening = IDENTITY_OPENINGS[identity] || IDENTITY_OPENINGS['佣兵'];

    // 基础场景描述
    let narrative = `锈钉镇的清晨比想象中醒得早。天还没全亮，铁匠铺的锤声就隔着两条街传过来，一下一下，像给整座镇子敲着起床的鼓点。你裹着旧斗篷穿过主街，灰烬雾还没散，空气里混着铁锈、隔夜麦酒和木柴烧过的味道。三百年了，这座镇子就这样醒过来，日复一日。\n\n`;

    // 身份差异化场景
    narrative += `佣兵公会在主街尽头，门脸不大，一块铁牌歪歪斜斜钉在门框上，写着「自由佣兵联盟」几个褪色的字。推门进去，炭火盆的暖意扑面而来，大厅里已经坐了三两拨人。柜台后一个矮人女人抬起头，${opening.scene}\n\n`;

    // 接待员对话
    narrative += `${opening.greeting}\n\n`;

    // 任务介绍
    narrative += `你填完表，她扫了一眼，从柜台下抽出一张皱巴巴的纸：「正好，昨晚上新贴的。灰烬森林材料狩猎，灰烬狼皮三张，焦木蜥鳞片两片，三天限期，按市价收。狼皮一张三金，鳞片一片五金，公会抽一成。接不接？」\n\n`;

    // 主线钩子
    narrative += `告示板的角落里，还钉着一张边角泛黄的旧单子，墨迹被潮气洇开大半，只隐约能认出几个字：老维特，失踪，赏金待定。铁钉已经生锈，像是钉在那里很久了。\n\n`;

    // 出城
    narrative += `你把材料狩猎的单子从木钉上取下来，卷好，塞进斗篷内袋。出城时铁匠铺门口的矮人铁匠看了一眼你腰间的铁剑，咧嘴一笑：「新来的吧，第一单活？」你没答话，他也不再问，回身继续敲他的铁。镇门口的老守门人叼着烟斗，扫过你的登记凭证，摆摆手：「灰烬森林别往深了走，天黑前回来。」\n\n`;

    // 结尾
    narrative += `公会大门在你身后合上，灰烬雾正从镇外漫进来。灰烬森林的方向，天边泛着一层灰白。\n\n接下来，往哪走，是你自己的事了。`;

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
