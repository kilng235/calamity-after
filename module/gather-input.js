/**
 * gather-input.js - 采集意图解析 + 结算合并（纯函数接线件，无自身副作用）
 *
 * 自然语言采集入口（index.html 主循环消费），完全沿用 travel-input.js 的事务语义：
 *   1. parseGatherIntent(message, gd)
 *      从玩家消息解析采集意图：动词门 + 地点门（只认当前所在采集区域）。
 *      宁可不触发，不让系统误判。
 *   2. settleGather(gdClone)
 *      在 gd 克隆上执行引擎采集（materialSystem.gatherMaterials）：
 *      产出自动入克隆背包、冷却记录写克隆 gatherCooldowns。
 *   3. buildGatherPromptBlock(result)
 *      把采集结算结果转成注入 prompt 的系统块（成功=采集叙事指令；失败=原因）。
 *   4. applyGatherSettlement(finalGd, settledClone)
 *      AI 回复成功后把克隆上的 inventory / gatherCooldowns 合并进最终 gameData。
 *
 * 事务语义由调用方保证：结算先落在 gd 克隆上，AI 响应成功后才合并落盘（终止即丢弃）。
 */

import { materialSystem } from './material-system.js';
import { GATHERING_TABLES, listGatheringLocations } from './gathering-tables.js';

// 采行动词（全包含匹配）
const GATHER_VERBS = ['采集', '收集', '采药', '采草药', '挖矿', '采矿', '搜寻材料', '搜集', '打猎'];

// 采集点 key → 表内显示名 → travel 地名（gd.progress.currentLocation）映射
// （键名跟随 ee710f0 地名统一：全项目 state 层用「锈钉镇」，世界书叙事保留「佣兵镇·锈钉」正名）
const TABLE_KEY_ALIASES = {
  '地理/锈钉镇': ['锈钉镇', '锈钉', '佣兵镇'],
  '地理/灰烬森林': ['灰烬森林'],
  '地理/深渊裂隙': ['深渊裂隙', '裂隙'],
  '地理/地下裂谷': ['地下裂谷', '裂谷'],
  '地理/龙骨山脉': ['龙骨山脉', '山脉'],
  '地理/魔法荒原': ['魔法荒原', '荒原']
};

/**
 * gd.progress.currentLocation（travel 地名）→ 采集点 key；不在 6 表内返回 null
 */
function locationToTableKey(currentLocation) {
  for (const key of listGatheringLocations()) {
    const aliases = TABLE_KEY_ALIASES[key] || [];
    if (aliases.indexOf(currentLocation) !== -1) return key;
  }
  return null;
}

/**
 * 解析采集意图
 * @param {string} message - 玩家消息
 * @param {Object} gd - gameData（读 progress.currentLocation / gatherCooldowns）
 * @returns {{intent:false, reason:string}|{intent:true, locationKey:string}}
 */
export function parseGatherIntent(message, gd) {
  const msg = String(message || '');
  if (!msg.trim()) return { intent: false, reason: 'empty' };

  // ① 动词门
  const hasVerb = GATHER_VERBS.some((v) => msg.indexOf(v) !== -1);
  if (!hasVerb) return { intent: false, reason: 'no-verb' };

  const currentKey = locationToTableKey(gd && gd.progress ? gd.progress.currentLocation : '');

  // ② 地点门：消息明示的采集区域（若提及多个 → 歧义不触发）
  const mentioned = [];
  for (const key of listGatheringLocations()) {
    if ((TABLE_KEY_ALIASES[key] || []).some((a) => msg.indexOf(a) !== -1)) mentioned.push(key);
  }
  if (mentioned.length > 1) return { intent: false, reason: 'ambiguous', mentioned };
  if (mentioned.length === 1) {
    if (mentioned[0] !== currentKey) return { intent: false, reason: 'wrong-location' };
    return { intent: true, locationKey: mentioned[0] };
  }

  // ③ 兜底：无明示区域 → 默认当前所在地（不在采集区则不触发）
  if (!currentKey) return { intent: false, reason: 'no-location' };
  return { intent: true, locationKey: currentKey };
}

/**
 * 在 gd 克隆上执行引擎采集
 * @param {Object} gdClone - 深拷贝的 gameData
 * @param {string} locationKey - parseGatherIntent 给出的采集点 key
 * @returns {Object} gatherMaterials 返回值（成功或结构化失败）
 */
export function settleGather(gdClone, locationKey) {
  return materialSystem.gatherMaterials(locationKey, gdClone);
}

/**
 * 构造注入 prompt 的采集系统块
 * @param {Object} result - settleGather 返回值
 * @returns {string} 系统块文本（空串=不注入）
 */
export function buildGatherPromptBlock(result) {
  if (!result) return '';
  if (!result.success) {
    if (result.error === '采集点尚未刷新') {
      return '【采集结算·系统权威】玩家表达了采集意图，但该采集点尚未刷新（还差约 ' + (result.cooldownRemaining || 0)
        + ' 游戏分钟）。叙事应体现此地刚被采集过、暂无可采的产出，引导玩家等待或前往别处；不得凭空产出材料。';
    }
    return '【采集结算·系统权威】玩家表达了采集意图，但系统判定此处无法采集（' + (result.error || '未知采集点') + '）。'
      + '叙事应体现此处没有可采集的资源；不得凭空产出材料。';
  }
  const lines = result.materials.map((m) => m.name + ' ×' + m.amount);
  return [
    '【采集结算·系统权威】本轮玩家在 ' + result.locationKey.replace('地理/', '') + ' 采集，系统已掷骰产出（入背包）：',
    lines.join('、') + '。',
    '按产出叙事采集过程（搜寻/辨识/收取，结合区域特征与材料叙事），不得增减产出门类或数量；'
      + '下次采集需等 ' + result.cooldownMinutes + ' 游戏分钟，可在叙事尾自然带出。'
  ].join('\n');
}

/**
 * 合并采集结算进最终 gameData（在 AI 命令应用之后调用，引擎权威覆盖）。
 * @returns {boolean} true=有结算需要落盘
 */
export function applyGatherSettlement(finalGd, settledClone) {
  if (!finalGd || !settledClone) return false;
  finalGd.inventory = (settledClone.inventory || []).slice();
  finalGd.gatherCooldowns = Object.assign({}, settledClone.gatherCooldowns || {});
  return true;
}
