/**
 * world-events.js - 废土世界动态突发遭遇池与种族历法节日系统
 * 
 * 核心功能：
 * 1. 9 大种族废土节日体系（随 gameTime 历法推进触发，提供全图 Buff 与 NPC 节日狂欢氛围）
 * 2. 四大突发动态遭遇池（危机战斗、废土奇遇、道德阵营、天灾异象）
 * 3. 7 大身份专属特权判定联动（专属解决路径）
 * 4. 自动生成提示词注入块（buildWorldEventsBlock），供 prompt-builder 接入
 */

(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.worldEventsSystem = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  'use strict';

  // ==================== 1. 9 大种族废土历法节日表 ====================
  const FESTIVALS = [
    {
      id: 'fest_human_reignition',
      name: '重燃节',
      race: '人类',
      date: { month: 11, day: 12 }, // 与开局同日，开局第一天即可感受节日
      theme: '纪念大灾变后首个避难所点燃第一炉钢铁火种之日',
      atmosphere: '小镇主街挂满红布条与生锈铁链，酒馆传出悠扬的风琴声，矮人铁匠与人类守卫痛饮麦酒，气氛热烈。',
      buff: { name: '重燃之火', effect: '全属性检定+1，酒馆消费减半，士气高涨' },
      specialEvent: '酒馆老板免费派发「重燃特调麦酒」，邀请你加入篝火点燃仪式。'
    },
    {
      id: 'fest_dwarf_furnace_echo',
      name: '熔炉余响祭',
      race: '矮人',
      date: { month: 12, day: 25 },
      theme: '矮人向地心熔岩与祖先锻锤致敬之日，彻夜打铁与狂欢',
      atmosphere: '镇上所有锻造炉彻夜不熄，锤击声震耳欲聋，矮人长须上沾满麦酒泡沫，彼此比试着锻造手艺。',
      buff: { name: '熔炉庇护', effect: '装备修理与锻造费用减免 30%，矮人 NPC 好感度提升' },
      specialEvent: '公会大厅举行「烈火拼酒大会」，获胜者可赢得精炼合金块与 20 金币。'
    },
    {
      id: 'fest_elf_ash_weeping',
      name: '落烬抚魂夜',
      race: '精灵',
      date: { month: 10, day: 31 },
      theme: '精灵悼念古树森林大火与逝去生灵的静默之夜',
      atmosphere: '微风中飘散着冷光荧菇的幽光，精灵们在树下静默祈祷，废土的喧嚣在此刻归于肃穆宁静。',
      buff: { name: '自然感知', effect: '草药与植物采集暴击率+50%，森林野外宿营 MP 完全恢复' },
      specialEvent: '林间深处的古老灵木散发微光，触碰可获得 1 点临时命运点加成。'
    },
    {
      id: 'fest_tiger_blood_hunt',
      name: '血猎狂欢节',
      race: '虎族',
      date: { month: 1, day: 15 },
      theme: '虎族展示武力与狩猎技巧的盛会，角逐最强荒原猎手',
      atmosphere: '战鼓擂动，虎族战士身上涂满战纹，公会门前挂满了巨大的变异兽头颅战利品。',
      buff: { name: '猎杀直觉', effect: '物理暴击率+5%，上缴狩猎战利品获得双倍公会声望' },
      specialEvent: '荒原猎人大师在镇口摆下比武擂台，向所有旅人发起无伤害切磋挑战。'
    },
    {
      id: 'fest_goat_crag_march',
      name: '踏峰负重誓',
      race: '羊人',
      date: { month: 3, day: 20 },
      theme: '羊人青年翻越高海拔险峰的成年礼与耐力盛典',
      atmosphere: '羊人商队唱着高亢的山歌穿过街道，免费沿途分发风干羊奶酪与登山麻绳。',
      buff: { name: '岩羊之蹄', effect: '负重上限临时+15kg，山地与岩壁攀爬移动体力消耗减半' },
      specialEvent: '羊人长者正在寻找一名勇者，协助将一坛祭祖圣水送往高耸的风蚀悬崖。'
    },
    {
      id: 'fest_dog_pledge_night',
      name: '忠魂篝火夜',
      race: '犬人',
      date: { month: 5, day: 1 },
      theme: '犬人围聚在巨大篝火旁讲述信使传奇与先祖誓约之夜',
      atmosphere: '巨大的篝火照亮夜空，犬人信使们分享着荒原各处的秘闻，哨兵们忠诚地巡视四周。',
      buff: { name: '忠诚警戒', effect: '野外宿营被偷袭率清零，打听情报交涉检定获优势' },
      specialEvent: '老信使赠送你一枚「先锋斥候哨」，吹响可在荒原召唤附近的斥候协助指路。'
    },
    {
      id: 'fest_ear_gear_expo',
      name: '机巧齿轮博览',
      race: '灵耳族',
      date: { month: 7, day: 7 },
      theme: '灵耳族展示精密发条、机关与旧时代科技遗物破解成果之日',
      atmosphere: '集市上摆满了发条机械玩偶与精密仪器，到处是齿轮啮合与蒸汽喷吐的清脆声响。',
      buff: { name: '机巧灵思', effect: '机关拆解、开锁与旧日科技识别检定必定获优势' },
      specialEvent: '学者摊位上出现一台「旧时代幸运轮盘」，可投入 5 废料抽取稀有机械零件。'
    },
    {
      id: 'fest_rabbit_gale_sprint',
      name: '朔风逐日赛',
      race: '兔耳族',
      date: { month: 9, day: 9 },
      theme: '兔耳族斥候在风蚀荒原举办的极速越野与物资争夺狂欢',
      atmosphere: '年轻的兔耳族斥候身轻如燕地在房顶与断壁间飞跃穿梭，沿途观众爆发出热烈欢呼。',
      buff: { name: '极速疾风', effect: '先攻骰+2，全图旅行耗时缩短 30%，闪避率+10%' },
      specialEvent: '你可以报名参与荒原越野速跑，凭借敏捷或耐力检定赢取冠军奖金 25 金币。'
    },
    {
      id: 'fest_cat_silent_prowl',
      name: '暗月静步祭',
      race: '猫人',
      date: { month: 8, day: 15 },
      theme: '猫人崇尚潜行与无声狩猎的黑夜祭典，地下暗流涌动',
      atmosphere: '镇上的路灯被特意调暗，黑市入口挂上了双重黑纱，猫人游侠们无声地在阴影中穿梭。',
      buff: { name: '阴影帷幕', effect: '潜行与巧手检定+3，黑市免收交易中介费' },
      specialEvent: '神秘的暗影走私商仅在今夜现身，出售稀有的特种毒刃与消音箭矢。'
    }
  ];

  // ==================== 2. 四大动态突发遭遇池 ====================
  const ENCOUNTERS = [
    // ⚔️ 危机与战斗类
    {
      id: 'enc_combat_scavenger_ambush',
      category: 'combat',
      title: '狭道伏击的掠夺者斥候',
      weight: 25,
      environment: ['荒原', '峡谷', '道路', '森林'],
      description: '前方的风蚀岩缝后闪过一丝反光，三名装备简陋但手持锯齿砍刀的灰烬掠夺者正试图包抄你的退路。',
      options: [
        { label: '拔刃迎战', desc: '以攻为守，正面迎击这群亡命徒（力量/敏捷战斗检定）' },
        { label: '隐蔽伏击', desc: '借助地形绕后先发制人（潜行检定）' },
        { label: '声东击西', desc: '投掷杂物引开注意后迅速脱离（敏捷/智力检定）' }
      ],
      identityHooks: {
        '荒原游侠': '游侠提前察觉到了泥土上的新鲜靴印，直接反设陷阱将掠夺者首领定在原地，不战而胜。',
        '异化行者': '展示体表的异化纹路与黑市标记，掠夺者认出是浪人同道，心生忌惮主动退去。'
      }
    },
    {
      id: 'enc_combat_berserk_beast',
      category: 'combat',
      title: '狂暴的焦木蜥母兽',
      weight: 20,
      environment: ['灰烬森林', '荒原', '沼泽'],
      description: '地面传来沉闷的震动，一头鳞甲焦黑、口吐灼热硫磺气息的变异焦木蜥母兽从灌木丛中猛扑而出！',
      options: [
        { label: '直击弱点', desc: '观察腹部软甲并精准斩击（感知/武艺检定）' },
        { label: '拉开距离', desc: '使用远程武器与火把驱赶（敏捷/射击检定）' }
      ],
      identityHooks: {
        '圣火祭司': '高举圣火徽记念诵净化祷言，圣洁的光芒灼痛母兽双眼，令其陷入盲目恐惧。',
        '机械工匠': '迅速将随身废料组装为简易震撼诱饵，巨响直接震晕母兽。'
      }
    },

    // 🏕️ 废土奇遇与探索类
    {
      id: 'enc_discovery_crashed_drone',
      category: 'discovery',
      title: '先驱者坠毁货运无人机',
      weight: 25,
      environment: ['荒原', '遗迹', '山地'],
      description: '半埋在沙堆里的是一架旧时代的八旋翼货运无人机，机身受损严重，但机腹下的合金货柜指示灯仍在微弱闪烁。',
      options: [
        { label: '小心撬开', desc: '使用工具仔细撬开外层防暴锁（巧手/力量检定）' },
        { label: '拆解零件', desc: '回收无人机上的高级电路板与高纯电池（智力检定）' }
      ],
      identityHooks: {
        '遗迹猎手': '识别出这是 09 号避难所的专用货运型号，用随身先驱者密钥一秒无损解锁，获得完好的高阶补给包！',
        '旧日学者': '破译无人机黑匣子中的航线日志，在地图上标出了一处隐藏避难所的准确坐标。'
      }
    },
    {
      id: 'enc_discovery_wandering_trader',
      category: 'discovery',
      title: '神秘的独眼流浪商人',
      weight: 20,
      environment: ['城镇', '荒原', '道路', '森林'],
      description: '一名牵着变异双头驮兽的驼背老者在路旁停下，兜帽下露出一只义眼，沙哑地问你是否需要稀罕货物。',
      options: [
        { label: '查看珍品', desc: '浏览他带来的旧时代罕见蓝图与药剂（花费金币）' },
        { label: '打听传闻', desc: '用麦酒换取荒原近期的秘密情报（魅力检定）' }
      ],
      identityHooks: {
        '自由人': '凭借老道的市井还价手腕，所有商品直接按 7 折底价成交，并获赠一包特制风干肉！',
        '机械工匠': '顺手帮老商人修复了驮兽的蒸汽背架，老商人感激地免费赠送了一枚高纯度动力电池。'
      }
    },

    // ⚖️ 道德抉择与阵营类
    {
      id: 'enc_faction_injured_messenger',
      category: 'faction',
      title: '被流民围困的圣火信使',
      weight: 20,
      environment: ['荒原', '哨站', '废墟'],
      description: '一名负伤咳血的圣火教团年轻信使背靠残墙，几名饥寒交迫的流民手持木棍围着他，想要抢夺他身上的医药包与口粮。',
      options: [
        { label: '拔刀护教', desc: '震慑或击退流民，保护圣火信使（圣火教团好感提升，流民敌对）' },
        { label: '调解分粮', desc: '自掏腰包分发口粮化解冲突（魅力检定，消耗自身干粮）' },
        { label: '冷眼旁观', desc: '废土弱肉强食，不干涉他人命运' }
      ],
      identityHooks: {
        '圣火祭司': '祭司庄严现身，圣火威严令流民敬畏叩拜，同时施展神圣急救治愈信使，获得教团至高赞赏。',
        '自由人': '以中立佣兵身份居中斡旋，既保全信使性命，又帮流民从信使处争取到了合理带路雇佣金，双赢收取佣金！'
      }
    },

    // 🌦️ 废土天灾与环境异象类
    {
      id: 'enc_hazard_radiation_duststorm',
      category: 'hazard',
      title: '突发黑日辐射尘暴',
      weight: 20,
      environment: ['荒原', '沙漠', '峡谷', '山地'],
      description: '天边骤然翻滚起暗红色的辐射沙暴，狂风裹挟着灼热的放射性微尘席卷而来，能见度瞬间降至数米之内！',
      options: [
        { label: '寻找岩洞掩体', desc: '在沙暴吞没前寻觅坚固避风洞（感知/生存检定）' },
        { label: '就地扎营加固', desc: '使用防雨布与重物就地搭建抗辐射帐篷（体质/工具检定）' }
      ],
      identityHooks: {
        '荒原游侠': '展开《风蚀荒原生存地图》，熟练领路进入三步之隔的天然防风地窖，全队毫发无伤。',
        '异化行者': '变异体质天生耐受辐射，在尘暴中呼吸自若，甚至借着风暴掩护寻得一处被狂风吹出的旧地宫入口。'
      }
    }
  ];

  // ==================== 3. 世界事件管理器 ====================
  class WorldEventsSystem {
    constructor() {
      this.festivals = FESTIVALS;
      this.encounters = ENCOUNTERS;
    }

    /**
     * 根据当前游戏日期获取今日节日
     * @param {{ month: number, day: number }} gameDate 
     * @returns {Object|null}
     */
    getTodayFestival(gameDate) {
      if (!gameDate) return null;
      const m = Number(gameDate.month);
      const d = Number(gameDate.day);
      return this.festivals.find(f => f.date.month === m && f.date.day === d) || null;
    }

    /**
     * 随机触发一次动态遭遇
     * @param {Object} context { location, identity, weather, dangerLevel }
     * @returns {Object|null}
     */
    rollEncounter(context = {}) {
      const loc = context.location || '荒原';
      const identity = context.identity || '自由人';
      
      // 过滤与当前环境相符的遭遇
      const matched = this.encounters.filter(enc => {
        return enc.environment.some(env => loc.includes(env) || env === '荒原');
      });

      const pool = matched.length > 0 ? matched : this.encounters;
      const totalWeight = pool.reduce((sum, e) => sum + e.weight, 0);
      let rand = Math.random() * totalWeight;

      for (const enc of pool) {
        if (rand < enc.weight) {
          const identityHook = enc.identityHooks && enc.identityHooks[identity];
          return {
            ...enc,
            identityHook: identityHook || null
          };
        }
        rand -= enc.weight;
      }
      return pool[0];
    }

    /**
     * 构建注入到 AI Prompt 中的动态世界事件与节日上下文块
     * @param {Object} gameData 
     * @returns {string}
     */
    buildBlock(gameData) {
      if (!gameData) return '';
      const lines = [];
      const gameTime = gameData.gameTime || { month: 11, day: 12 };
      const identity = (gameData.character && gameData.character.identity) || '自由人';

      // 1. 历法节日判定
      const todayFest = this.getTodayFestival(gameTime);
      if (todayFest) {
        lines.push('【🏮 今日废土历法庆典：' + todayFest.name + '（' + todayFest.race + '族）】');
        lines.push('• 节日风貌：' + todayFest.atmosphere);
        lines.push('• 全图增益：' + todayFest.buff.name + '（' + todayFest.buff.effect + '）');
        lines.push('• 限时互动：' + todayFest.specialEvent);
      }

      return lines.join('\n');
    }
  }

  const instance = new WorldEventsSystem();
  if (typeof window !== 'undefined') {
    window.worldEventsSystem = instance;
  }
  return instance;
}));
