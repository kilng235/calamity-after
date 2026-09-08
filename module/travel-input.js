/**
 * travel-input.js - 旅行意图解析 + 结算合并（纯函数，无副作用）
 *
 * 自然语言旅行入口的接线件（index.html 主循环消费）：
 *   1. parseTravelIntent(message, currentLocation, locations)
 *      从玩家消息解析旅行意图：动词门 + 地名门（包含匹配，排除当前地）+ 唯一性门。
 *      三重门任一不满足即无意图——宁可不触发，不让系统误判。
 *   2. buildTravelPromptBlock(result)
 *      把 travelTo 的返回转成注入 prompt 的系统块（成功=旅行叙事指令；失败=此路不通）。
 *   3. applyTravelSettlement(finalGd, settledClone)
 *      把克隆上的结算字段（gameTime / progress.currentLocation / unlockedLocations）
 *      合并进最终 gameData，返回 true 表示调用方应强制 importGameData 落盘。
 *
 * 邻接/前置解锁校验不在本模块——travelTo 自带查边与 requires 校验并返回结构化错误。
 * 事务语义由调用方保证：结算先落在 gd 克隆上，AI 响应成功后才合并落盘（终止即丢弃）。
 */

// 旅行动词（全包含匹配，无顺序问题；覆盖常见口语变体。"回"单字安全：地名门要求命中已知区域且非当前地）
const TRAVEL_VERBS = ['前往', '出发去', '动身去', '赶往', '启程', '旅行到', '移动到', '移動到', '旅行', '赶路', '回到', '返回', '出发', '回', '去'];

// 地名短别名（无歧义缩写 → 标准区域名；均为标准名的真子串，全名命中时优先跳过别名）
const LOCATION_ALIASES = {
  '锈钉': '锈钉镇',
  '废墟': '旧王城废墟',
  '裂隙': '深渊裂隙',
  '沼泽': '迷雾沼泽',
  '荒原': '魔法荒原',
  '山脉': '龙骨山脉'
};

// 运行时正名 ↔ 路网名：开局存档 progress.currentLocation 用「佣兵镇·锈钉」（世界书地理总纲正名），
// 路网/遭遇池用「锈钉镇」（地理总纲正文与玩家口语同名）。映射在本模块内双向收敛，其余区域两域同名。
const CANONICAL_TO_TRAVEL = { '佣兵镇·锈钉': '锈钉镇' };
const TRAVEL_TO_CANONICAL = { '锈钉镇': '佣兵镇·锈钉' };

/**
 * 解析旅行意图
 * @param {string} message - 玩家消息
 * @param {string} currentLocation - 当前所在地（progress.currentLocation）
 * @param {Array<string>} locations - 全部已知区域名（travel-tables.TRAVEL_LOCATIONS）
 * @returns {{intent:false, reason:string, mentioned?:Array<string>}|{intent:true, destination:string}}
 */
export function parseTravelIntent(message, currentLocation, locations) {
  const msg = String(message || '');
  if (!msg.trim()) return { intent: false, reason: 'empty' };

  // ① 动词门
  const hasVerb = TRAVEL_VERBS.some((v) => msg.indexOf(v) !== -1);
  if (!hasVerb) return { intent: false, reason: 'no-verb' };

  // ② 地名门：全名包含匹配 + 别名展开，排除当前所在地（当前地先做正名→路网名归一）
  const curTravel = CANONICAL_TO_TRAVEL[currentLocation] || currentLocation;
  const mentioned = [];
  const names = Array.isArray(locations) ? locations : [];
  for (const name of names) {
    if (!name || name === curTravel) continue;
    if (msg.indexOf(name) !== -1) { mentioned.push(name); continue; }
    for (const alias in LOCATION_ALIASES) {
      if (LOCATION_ALIASES[alias] === name && msg.indexOf(alias) !== -1) {
        mentioned.push(name);
        break;
      }
    }
  }

  // ③ 唯一性门
  if (mentioned.length === 0) return { intent: false, reason: 'no-destination' };
  if (mentioned.length > 1) return { intent: false, reason: 'ambiguous', mentioned };
  return { intent: true, destination: mentioned[0] };
}

/**
 * 构造注入 prompt 的旅行系统块
 * @param {Object} result - travelTo 返回值（成功或结构化失败）
 * @returns {string} 系统块文本（空串=不注入）
 */
export function buildTravelPromptBlock(result) {
  if (!result) return '';
  if (!result.success) {
    const reason = result.error || '路线不可用';
    const hint = result.hint ? '；' + result.hint : '';
    return '【旅行结算·系统权威】玩家表达了旅行意图，但系统判定路线不可用（' + reason + hint + '）。'
      + '叙事应体现此路不通（道路阻断/需前置条件/被劝返等），不得让玩家凭空抵达目的地；其余内容照常推进。';
  }
  const lines = [
    '【旅行结算·系统权威】本轮玩家从 ' + result.route.from + ' 前往 ' + result.route.to
      + '（约 ' + result.route.hours + ' 小时' + (result.nightTravel ? '，夜间赶路' : '')
      + '，危险：' + result.effectiveDanger + '）。',
    result.encounterHint,
    '按「路途遭遇规则」呈现：叙事覆盖整段路程并以抵达 ' + result.route.to + ' 收束；'
      + '遭遇内容已由系统掷骰确定，禁止更改、回避或自行添加遭遇；战斗按「战斗规则」进行。',
    '抵达后用命令更新 progress.currentPlace 为目的地内合理地点（区域位置已由系统结算，无需命令）。'
  ];
  return lines.join('\n');
}

/**
 * 合并旅行结算进最终 gameData（在 AI 命令应用之后调用，引擎权威覆盖）。
 * 结算里的路网名写回运行时正名（锈钉镇→佣兵镇·锈钉），与开局存档词汇一致。
 * @param {Object} finalGd - 命令应用后的 gameData
 * @param {Object} settledClone - travelTo 完成结算的 gd 克隆（含 gameTime/progress 变更）
 * @returns {boolean} true=有结算需要落盘（调用方应强制 importGameData）
 */
export function applyTravelSettlement(finalGd, settledClone) {
  if (!finalGd || !settledClone || !settledClone.progress) return false;
  finalGd.gameTime = settledClone.gameTime;
  if (!finalGd.progress) finalGd.progress = {};
  finalGd.progress.currentLocation = TRAVEL_TO_CANONICAL[settledClone.progress.currentLocation] || settledClone.progress.currentLocation;
  finalGd.progress.unlockedLocations = (settledClone.progress.unlockedLocations || [])
    .map((n) => TRAVEL_TO_CANONICAL[n] || n);
  return true;
}
