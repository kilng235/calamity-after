/**
 * travel-tables.js - 旅行路网表
 *
 * 与「data-source/世界书/地理/地理总纲.yaml」区域关联节对应。
 * 世界书约束（设计依据）：
 *   - 锈钉镇是枢纽，「可通往所有区域」
 *   - 灰烬森林南接魔法荒原
 *   - 旧王城废墟地下（排水渠）连接沉没之城（世界书原文「半日路程」）
 *   - 龙骨山脉南麓有遗忘修道院（石阶山路两公里）
 *   - 深渊裂隙向南延伸出地下裂谷（约十五公里）
 *   - 迷雾沼泽地下河汇入旧王城地下水系（暗流河通道）
 *
 * 字段说明：
 *   from / to   区域名（与 gameData.progress.currentLocation 的取值一致）
 *   hours       旅行耗时（游戏内小时；advanceTime(hours × 60) 推进）
 *   danger      道路危险（低/中/中高/高/极高）——继承两侧区域危险，夜路可升档
 *   note        一句话路线描述（供 AI 叙事注入）
 *   requires    可选——抵达目的地的前置解锁区域（用于地下/嵌套区域）
 *
 * 路网为无向边表：from→to 可走 ⇔ to→from 可走（耗时同）。
 *
 * 耗时标定：
 *   - 山路 ≈ 5km/h，官道 ≈ 6km/h
 *   - 唯一世界书明示：废墟→沉没之城「半日路程」= 12h
 *   - 其余按各区域「位置」描述的相对方位内插
 *
 * 遭遇系统（TODO，见 docs/缺少系统清单.md）：
 *   当前 danger 仅作叙事提示（encounterHint 注入 prompt）；
 *   未来接生物模板掷骰 + 夜路升档。
 */

export const TRAVEL_ROUTES = [
  // ── 枢纽辐射（锈钉镇 → 各区域）──
  { from: '锈钉镇',     to: '灰烬森林',   hours: 2,  danger: '低',   note: '镇西大路，商队常走，灰烬森林外围可见' },
  { from: '锈钉镇',     to: '龙骨山脉',   hours: 8,  danger: '中',   note: '北上矿道，自由佣兵联盟采矿队路线' },
  { from: '锈钉镇',     to: '旧王城废墟', hours: 10, danger: '中高', note: '东南官道，临近废墟迷雾渐浓，建议雇佣向导' },
  { from: '锈钉镇',     to: '迷雾沼泽',   hours: 6,  danger: '中',   note: '南下小径，需备浸药面罩遮挡瘴气' },
  { from: '锈钉镇',     to: '深渊裂隙',   hours: 12, danger: '高',   note: '北山险道，穿越龙骨山脉北部，建议考察队引路' },

  // ── 区域间连接（世界书明确关联）──
  { from: '灰烬森林',   to: '魔法荒原',   hours: 4,  danger: '中高', note: '森林南接荒原，能量异常渐显，结晶反光可见' },
  { from: '旧王城废墟', to: '魔法荒原',   hours: 3,  danger: '高',   note: '废墟以西即荒原，能量流与迷雾交界地带' },
  { from: '旧王城废墟', to: '沉没之城',   hours: 12, danger: '中高', note: '经排水渠下潜，半日路程；需绳索与照明', requires: ['旧王城废墟'] },
  { from: '龙骨山脉',   to: '遗忘修道院', hours: 2,  danger: '低',   note: '南麓石阶山路蜿蜒两公里' },
  { from: '龙骨山脉',   to: '深渊裂隙',   hours: 6,  danger: '高',   note: '山脉北部向神陨之地过渡，变异生物出没' },
  { from: '深渊裂隙',   to: '地下裂谷',   hours: 1,  danger: '极高', note: '裂隙南缘地下通道入口，磷光菌核微光指路', requires: ['深渊裂隙'] },
  { from: '迷雾沼泽',   to: '旧王城废墟', hours: 8,  danger: '中高', note: '暗流河通道，地下河汇入旧王城地下水系，需浮具' },
];

/**
 * 起点（新游戏初始位置）
 */
export const START_LOCATION = '锈钉镇';

/**
 * 夜路时段（游戏内小时）：出发或抵达落在此区间 → danger 升一档（叙事提示）
 */
export const NIGHT_HOURS = [22, 23, 0, 1, 2, 3, 4, 5];

/**
 * 查找路线（无向）
 * @param {string} fromA
 * @param {string} toB
 * @returns {Object|null} 路线对象（from/to 归一为 A=出发地）或 null
 */
export function findRoute(fromA, toB) {
  const r = TRAVEL_ROUTES.find(
    (route) => (route.from === fromA && route.to === toB)
            || (route.from === toB && route.to === fromA)
  );
  if (!r) return null;
  // 归一：返回的 from 永远是出发地
  return r.from === fromA ? r : { ...r, from: r.to, to: r.from };
}

/**
 * 列出某区域的全部相邻路线（用于 UI/诊断）
 * @param {string} locationName
 * @returns {Array<Object>} 每条 { destination, hours, danger, note, requires }
 */
export function listRoutesFrom(locationName) {
  return TRAVEL_ROUTES
    .filter((r) => r.from === locationName || r.to === locationName)
    .map((r) => ({
      destination: r.from === locationName ? r.to : r.from,
      hours: r.hours,
      danger: r.danger,
      note: r.note,
      requires: r.requires || null
    }));
}

/**
 * 夜路检查：小时是否落在夜路时段
 * @param {number} hour - 游戏内小时（0-23）
 * @returns {boolean}
 */
export function isNightHour(hour) {
  return NIGHT_HOURS.includes(hour);
}

/**
 * danger 升档（夜路修正用）
 */
const DANGER_LADDER = ['低', '中', '中高', '高', '极高'];

export function escalateDanger(danger) {
  const idx = DANGER_LADDER.indexOf(danger);
  if (idx === -1 || idx === DANGER_LADDER.length - 1) return danger;
  return DANGER_LADDER[idx + 1];
}
