/**
 * 开局系统 - 灾厄之后独立版（动态开局随机引擎增强版）
 * 基于《世界书开局大纲.yaml》 + 《开局生成规则.yaml》
 *
 * 核心功能：
 * - 4 大突发情境随机（常规公会 / 废墟苏醒 / 酒馆突发冲突 / 沙暴避难所）
 * - 时间与天气动态摇骰（清晨灰烬雾 / 正午黑日 / 黄昏酸雨 / 深夜静风）
 * - 身份专属主线 + 随机告示板可选支线（3 选 1）
 * - 开局彩蛋随身杂物随机掉落
 * - 初始角色状态、装备信物与世界书动态注入
 */

// ============== 动态开局情境随机池 ==============

export const SCENARIO_SEEDS = [
  {
    id: 'guild_normal',
    weight: 40,
    name: '公会常规接单',
    location: { region: '锈钉镇', town: '锈钉', place: '佣兵公会大厅', full: '锈钉镇 · 佣兵公会大厅' },
    leadIntro: '推门进去，炭火盆的暖意扑面而来，大厅里已经坐了三两拨交头接耳的佣兵。柜台后的办事员抬起头',
    atmosphere: '空气里混着铁锈、隔夜麦酒和木柴烧过的味道，一切井然有序却暗流涌动。'
  },
  {
    id: 'ruin_awakening',
    weight: 25,
    name: '废墟遇险苏醒',
    location: { region: '锈钉镇郊外', town: '废弃前哨站', place: '坍塌的防御工事', full: '锈钉镇郊外 · 废弃前哨坍塌处' },
    leadIntro: '你从一阵剧烈的头痛中睁开双眼，身旁是一具刚断气不久的变异沙虫幼体，武器就在三步开外的碎石堆中。公会的巡逻队正快步向你走来',
    atmosphere: '四周弥漫着刺鼻的焦糊味与风沙，远处的警报钟声刚刚停歇。'
  },
  {
    id: 'tavern_brawl',
    weight: 20,
    name: '酒馆突发冲突',
    location: { region: '锈钉镇', town: '锈钉', place: '跃马酒馆与公会偏厅', full: '锈钉镇 · 跃马酒馆与公会偏厅' },
    leadIntro: '你刚坐下，几名浑身裹着破烂防弹插板的灰烬掠夺者便踹门而入寻衅滋事，酒保不动声色地从柜台下抽出短筒火铳，公会办事员隔着吧台对你使了个眼色',
    atmosphere: '玻璃杯碎裂的声音与拔刀出鞘的金属摩擦声交织在一起，火药味瞬间弥漫。'
  },
  {
    id: 'storm_shelter',
    weight: 15,
    name: '沙尘暴避难所',
    location: { region: '风蚀走廊', town: '避难地窖', place: '03号加固防空洞', full: '风蚀走廊 · 03号加固防空地窖' },
    leadIntro: '头顶厚重的铁门在狂暴的辐射尘暴中剧烈震颤。你与几名避难的旅人挤在昏暗的应急油灯下，公会驻防员一边分发过滤芯一边核对幸存者身份',
    atmosphere: '昏黄的灯光在风声中摇曳，空气中充斥着干燥的尘土与紧张的喘息声。'
  }
];

// ============== 天气与时间随机池 ==============

export const WEATHER_SEEDS = [
  { time: { hour: 6, minute: 45, display: '灾厄300年11月12日 06:45（破晓）' }, weather: '灰烬晨雾', effect: '能见度偏低，荒原轮廓若隐若现' },
  { time: { hour: 11, minute: 30, display: '灾厄300年11月12日 11:30（烈日）' }, weather: '黑日高悬', effect: '紫外与辐射偏高，荒原干渴消耗略增' },
  { time: { hour: 17, minute: 50, display: '灾厄300年11月12日 17:50（黄昏）' }, weather: '微酸性晚雨', effect: '地面泥泞湿滑，需披紧防雨斗篷' },
  { time: { hour: 21, minute: 15, display: '灾厄300年11月12日 21:15（深夜）' }, weather: '干燥静风', effect: '气温骤降，夜间荒原异兽出没频繁' }
];

// ============== 随机告示板可选支线池 (3 选 1) ==============

export const RANDOM_SIDE_HOOKS = [
  {
    name: '商队的受惊驮兽',
    type: '悬赏支线',
    desc: '行商老安德森的驮兽在镇外受惊走失，悬赏 12 金币寻找带有蓝色记号的驮包',
    target: '搜寻受惊驮兽'
  },
  {
    name: '水泵站的异响',
    type: '清理支线',
    desc: '镇北地下沉淀池滤网被变异水蛭堵塞，供水管道受损，急需清理',
    target: '清理地下沉淀池'
  },
  {
    name: '旧时代留声机',
    type: '寻物支线',
    desc: '酒馆老板高价收购一台据传遗留在回声谷边缘科研站旧宿舍内的完好音乐盒',
    target: '搜寻科研站旧宿舍'
  },
  {
    name: '通缉：黑眼巴克',
    type: '悬赏通缉',
    desc: '流窜在风蚀平原的独眼掠夺者斥候，击败并带回其身份狗牌可兑换公会赏金',
    target: '追缉黑眼巴克'
  }
];

// ============== 开局随身彩蛋杂物池 ==============

export const RANDOM_TRINKETS = [
  { name: '停摆的旧怀表', desc: '背面刻着模糊的字母「To K.」，虽然不走了，但工艺极精巧' },
  { name: '半壶烈性黑麦酒', desc: '锈钉镇特产烈酒，能在寒夜中提神暖身，微量恢复体能' },
  { name: '手绘的避风洞草图', desc: '不知哪位游侠随手画在羊皮纸背面的捷径，标记了附近的一处安全水源' },
  { name: '打磨光滑的变异兽牙', desc: '串在皮绳上的兽牙护身符，据说能带来荒原好运' },
  { name: '一小盒防锈油脂', desc: '保养金属武器与机关的必备耗材，可擦拭武器减少磨损' }
];

// ============== 7 大身份开场差异对话 ==============

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

// ============== 7 大身份专属主线字典 ==============

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

export const INITIAL_QUEST = IDENTITY_QUESTS['自由人'];

// ============== 开局系统主引擎 ==============

export class OpeningSystem {
  constructor() {
    this.initialized = false;
    this.openingData = null;
  }

  /**
   * 摇骰抽取随机情境
   */
  rollScenario() {
    const totalWeight = SCENARIO_SEEDS.reduce((s, item) => s + item.weight, 0);
    let rand = Math.random() * totalWeight;
    for (const sc of SCENARIO_SEEDS) {
      if (rand < sc.weight) return sc;
      rand -= sc.weight;
    }
    return SCENARIO_SEEDS[0];
  }

  /**
   * 摇骰抽取天气
   */
  rollWeather() {
    const idx = Math.floor(Math.random() * WEATHER_SEEDS.length);
    return WEATHER_SEEDS[idx];
  }

  /**
   * 摇骰抽取彩蛋杂物
   */
  rollTrinket() {
    const idx = Math.floor(Math.random() * RANDOM_TRINKETS.length);
    return RANDOM_TRINKETS[idx];
  }

  /**
   * 摇骰抽取告示板随机支线
   */
  rollSideHook() {
    const idx = Math.floor(Math.random() * RANDOM_SIDE_HOOKS.length);
    return RANDOM_SIDE_HOOKS[idx];
  }

  /**
   * 创建初始角色（融合情境种子、信物与彩蛋杂物）
   */
  createInitialCharacter(data, seedData) {
    const weather = seedData ? seedData.weather : this.rollWeather();
    const scenario = seedData ? seedData.scenario : this.rollScenario();
    const trinket = seedData ? seedData.trinket : this.rollTrinket();

    const defaults = {
      name: data.name || '无名流浪者',
      race: data.race || '人类',
      identity: data.identity || '自由人',
      attributes: data.attributes || { 力量: 10, 敏捷: 10, 体质: 10, 智力: 10, 感知: 10, 魅力: 10 },
      talents: data.talents || [],
      gold: 15,
      hp: 100,
      hpMax: 100,
      fatePoint: 1,
      level: 1
    };

    const dexMod = Math.floor((defaults.attributes.敏捷 - 10) / 2);
    defaults.ac = 10 + dexMod;

    const strMod = Math.floor((defaults.attributes.力量 - 10) / 2);
    const extraCarry = (defaults.identity === '自由人') ? 10 : 0;
    defaults.carryCapacity = 15 + strMod * 5 + extraCarry;

    defaults.equipment = {
      mainHand: { name: '废土短刃', type: '剑', slot: 'mainHand', durability: 80, durabilityMax: 80, damage: { dice: 1, sides: 6 }, quality: '普通' },
      offHand: null, body: null, head: null, accessory: null
    };

    defaults.inventory = [];

    // 注入身份信物
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

    // 注入随机彩蛋杂物
    if (trinket) {
      defaults.inventory.push({
        id: 'item_trinket_' + Date.now().toString(36),
        name: trinket.name,
        type: 'trinket',
        description: trinket.desc,
        count: 1,
        weight: 0.5,
        quality: '纪念'
      });
    }

    defaults.time = {
      year: 300, month: 11, day: 12,
      hour: weather.time.hour,
      minute: weather.time.minute,
      display: weather.time.display
    };
    defaults.weather = weather.weather;
    defaults.weatherEffect = weather.effect;
    defaults.location = { ...scenario.location };

    const perInt = (typeof window !== 'undefined' && window.numericContract && window.numericContract.法力) ? (window.numericContract.法力.每点智力 || 5) : 5;
    defaults.mp = defaults.attributes.智力 * perInt;
    defaults.mpMax = defaults.mp;

    return defaults;
  }

  /**
   * 创建初始主线任务
   */
  createInitialQuest(identity) {
    const idKey = identity || '自由人';
    const questTemplate = IDENTITY_QUESTS[idKey] || IDENTITY_QUESTS['自由人'];
    return {
      ...questTemplate,
      status: '进行中',
      acceptedTime: { year: 300, month: 11, day: 12, hour: 7, minute: 10, display: '灾厄300年11月12日 07:10' },
      deadlineTime: {
        year: 300, month: 11, day: 12 + (questTemplate.deadline ? questTemplate.deadline.days : 3),
        hour: 7, minute: 10
      }
    };
  }

  /**
   * 生成动态随机开局叙事
   */
  generateOpeningNarrative(character, seedData) {
    const identity = character.identity || '自由人';
    const opening = IDENTITY_OPENINGS[identity] || IDENTITY_OPENINGS['自由人'];
    const questTemplate = IDENTITY_QUESTS[identity] || IDENTITY_QUESTS['自由人'];
    const scenario = seedData.scenario;
    const weather = seedData.weather;
    const sideHook = seedData.sideHook;
    const trinket = seedData.trinket;

    let narrative = `【灾厄纪元 300 年 · 废土】\n时值 ${weather.time.display}，荒原上方笼罩着一袭薄薄的「${weather.weather}」。${weather.effect}。\n\n`;
    narrative += `📍 **当前位置**：${scenario.location.full}\n${scenario.atmosphere}\n\n`;
    narrative += `${scenario.leadIntro}，${opening.scene}。\n\n`;
    narrative += `${opening.greeting}\n\n`;
    narrative += `办完建档手续，办事员递来一张加盖了火漆的信笺：「这是匹配你身份的当务之急——『${questTemplate.name}』。${questTemplate.description}。」\n\n`;

    if (sideHook) {
      narrative += `在旁边的告示板一角，你注意到还悬赏着另一条偶发事件：\n> 📜 **[可选告示] ${sideHook.name}**：${sideHook.desc}。\n\n`;
    }

    if (trinket) {
      narrative += `你检查了一下行囊，除了随身武器与身份信物外，内袋里还静静躺着一件旧物——『${trinket.name}』（${trinket.desc}）。\n\n`;
    }

    narrative += `命运的齿轮已然咬合，废土的沙尘在脚下蔓延。\n接下来，往哪走，全看你自己的抉择。`;

    return narrative;
  }

  /**
   * 初始化游戏（主入口）
   */
  initializeGame(characterData) {
    const seedData = {
      scenario: this.rollScenario(),
      weather: this.rollWeather(),
      trinket: this.rollTrinket(),
      sideHook: this.rollSideHook()
    };

    const character = this.createInitialCharacter(characterData, seedData);
    const quest = this.createInitialQuest(character.identity);
    const narrative = this.generateOpeningNarrative(character, seedData);

    const openingData = {
      entryName: '开局数据',
      category: '开局',
      content: {
        time: character.time,
        location: character.location,
        weather: character.weather,
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
        sideHook: seedData.sideHook,
        scenario: seedData.scenario.name,
        openingNarrative: narrative
      }
    };

    this.openingData = openingData;
    this.initialized = true;

    return {
      success: true,
      character,
      quest,
      narrative,
      openingData,
      seedData,
      message: '开局初始化完成'
    };
  }
}

export const openingSystem = new OpeningSystem();

if (typeof window !== 'undefined') {
  window.openingSystem = openingSystem;
  window.IDENTITY_QUESTS = IDENTITY_QUESTS;
  window.IDENTITY_OPENINGS = IDENTITY_OPENINGS;
}
