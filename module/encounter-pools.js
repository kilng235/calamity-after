/**
 * encounter-pools.js - 路途遭遇池
 *
 * 数据来源：data-source/世界书/生物/*.yaml 的「区域」「威胁等级」字段
 * （2026-09-07 人工提取归一化）
 *
 * 归一化规则：
 *   - 生物 yaml「区域：X（备注）」→ 主区域 X 归入本表 key
 *   - 跨区域生物（如感染者「旧王城废墟、灰烬森林边缘」）→ 进主区域池
 *   - 威胁等级为空的剧情级生物（深空行者/灾厄龙蜥）→ 不进池，
 *     只应在特定剧情由 LLM 安排出现
 *   - 锈钉镇为安全区（用户决策 2026-09-07）：无野外遭遇，城内冲突走剧情
 *
 * 字段说明：
 *   creature  生物名（与世界书生物条目名一致，供 LLM 检索「生物总纲」）
 *   weight    权重（池内按权重抽 1 种）
 *   count     数量表达式（'1' / '2d3' 骰子表达式，群体生物按世界书习性标注）
 *   threat    威胁等级（低/中/中高/高，叙事提示用）
 *
 * 设计原则：
 *   - 招牌生物权重高（灰烬狼之于灰烬森林）
 *   - 威胁「高」的深水生物权重低（深潜者只在地下裂谷下层）
 *   - 权重和不必为 100（这里只做相对概率，不做百分比心算）
 */

export const ENCOUNTER_POOLS = {
  // ── 安全区 ──
  '锈钉镇': [],

  // ── 灰烬森林（7 种）──
  '灰烬森林': [
    { creature: '灰烬狼',     weight: 30, count: '2d3', threat: '中' },   // 招牌，五至八头一群（战斗按 2d3 呈现）
    { creature: '灰烬蚊',     weight: 25, count: '1d4', threat: '低' },
    { creature: '灰烬蛛',     weight: 15, count: '1',   threat: '中' },
    { creature: '嗜血掠食者', weight: 12, count: '1',   threat: '中' },
    { creature: '感染者',     weight: 10, count: '1',   threat: '中' },   // 森林边缘游荡
    { creature: '焦木巨蜥',   weight: 6,  count: '1',   threat: '中高' },
    { creature: '枯死树精',   weight: 2,  count: '1',   threat: '中' }    // 焦黑深林极少数
  ],

  // ── 龙骨山脉（3 种）──
  '龙骨山脉': [
    { creature: '石甲虫',     weight: 35, count: '1d2', threat: '低' },   // 矿洞与岩坡
    { creature: '洞穴蝙蝠',   weight: 30, count: '1d4', threat: '低' },   // 矿洞群居
    { creature: '雪豹',       weight: 15, count: '1',   threat: '中' }    // 雪线附近
  ],

  // ── 遗忘修道院（2 种，弱遭遇区）──
  '遗忘修道院': [
    { creature: '山鼠',       weight: 40, count: '1d3', threat: '低' },   // 废墟啃食书籍
    { creature: '猫头鹰',     weight: 30, count: '1',   threat: '低' }    // 穹顶阁楼（无威胁，气氛为主）
  ],

  // ── 旧王城废墟（5 种）──
  '旧王城废墟': [
    { creature: '变异鼠群',   weight: 30, count: '1d3', threat: '低' },   // 下水道/废墟底层
    { creature: '石缝蛇',     weight: 25, count: '1',   threat: '低' },
    { creature: '白骨行者',   weight: 18, count: '1',   threat: '低' },
    { creature: '灰蛞蝓',     weight: 15, count: '1d2', threat: '低' },   // 潮湿巷道
    { creature: '感染者',     weight: 10, count: '1',   threat: '中' }
    // 灾厄幽灵（高）不进随机池：废墟深层剧情安排
  ],

  // ── 魔法荒原（4 种）──
  '魔法荒原': [
    { creature: '晶壳蝎',     weight: 30, count: '1d2', threat: '中' },   // 结晶地/能量流边缘
    { creature: '能量蠕虫',   weight: 25, count: '1d2', threat: '中' },   // 能量流中
    { creature: '废土掠夺者', weight: 15, count: '1d2', threat: '低' },   // 荒原边缘
    { creature: '废土巨兽',   weight: 8,  count: '1',   threat: '高' }    // 深荒原稀有
  ],

  // ── 迷雾沼泽（2 种）──
  '迷雾沼泽': [
    { creature: '瘴蚊',       weight: 40, count: '1d4', threat: '低' },   // 瘴气区
    { creature: '沼泽巨蜥',   weight: 20, count: '1',   threat: '中' }    // 浅滩潜伏
  ],

  // ── 深渊裂隙（4 种）──
  '深渊裂隙': [
    { creature: '裂隙犬',     weight: 30, count: '1d2', threat: '中' },   // 外围荒原
    { creature: '折射蝶',     weight: 20, count: '1d3', threat: '低' },   // 裂隙区边缘
    { creature: '影蜥',       weight: 15, count: '1',   threat: '中高' }, // 空间裂隙区
    { creature: '再生魔物',   weight: 10, count: '1',   threat: '高' }
    // 灾厄龙蜥不进随机池：灾厄核心剧情专属
  ],

  // ── 地下裂谷（3 种）──
  '地下裂谷': [
    { creature: '石蜈蚣',     weight: 30, count: '1d2', threat: '中' },   // 岩壁/上层通道
    { creature: '穴居巨蝠',   weight: 20, count: '1d3', threat: '中' },   // 中层洞厅
    { creature: '深潜者',     weight: 8,  count: '1',   threat: '高' }    // 下层裂谷
  ],

  // ── 沉没之城（3 种）──
  '沉没之城': [
    { creature: '石蝠',       weight: 35, count: '1d3', threat: '低' },   // 穹顶与梁架
    { creature: '灰蛞蝓',     weight: 20, count: '1d2', threat: '低' },
    { creature: '灾厄幽灵',   weight: 10, count: '1',   threat: '高' }    // 半沉城市深处
  ]
};

/**
 * 剧情专属生物（不进随机遭遇池，由 LLM 按剧情安排）
 */
export const STORY_ONLY_CREATURES = ['深空行者', '灾厄龙蜥'];

/**
 * 遭遇概率表（按道路 danger 查）
 */
export const ENCOUNTER_RATE = {
  '低':   10,
  '中':   25,
  '中高': 40,
  '高':   55,
  '极高': 70
};

/**
 * 列出有遭遇池的区域（诊断/UI）
 */
export function listEncounterLocations() {
  return Object.keys(ENCOUNTER_POOLS).filter((k) => ENCOUNTER_POOLS[k].length > 0);
}
