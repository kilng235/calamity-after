/**
 * alchemy-input.js - 炼金意图解析 + 结算合并（纯函数接线件，无自身副作用）
 *
 * 自然语言炼制入口（index.html 主循环消费），沿用 travel-input.js 的事务语义：
 *   1. parseBrewIntent(message, gd)
 *      从玩家消息解析炼制意图：动词门 + 配方名门（全名优先取最长，模糊档位歧义不触发）。
 *   2. settleBrew(gdClone, recipeName)
 *      在 gd 克隆上执行 alchemySystem.brewPotion（含技能/材料/金币校验与检定），
 *      成功把成品药水、大失败把事故物写入克隆背包。
 *   3. buildAlchemyPromptBlock(result)
 *      把炼制结算转成注入 prompt 的系统块（成功/失败/大失败/缺前置各有一套叙事指令）。
 *   4. applyAlchemySettlement(finalGd, settledClone)
 *      AI 回复成功后把克隆上的 inventory / currency 合并进最终 gameData。
 *
 * 权威分工：药剂炼制技能/材料/金币/检定全部由引擎判定，AI 只负责叙事。
 * 事务语义由调用方保证：结算先落在 gd 克隆上，AI 响应成功后才合并落盘（终止即丢弃）。
 */

import { alchemySystem, ALCHEMY_RECIPES } from './alchemy-system.js';

// 炼制动词（全包含匹配）
const BREW_VERBS = ['炼制', '炼药', '制药', '调配', '酿造', '熬制', '配置药剂', '配制'];

/**
 * 去掉配方名里的档位括号：「法力药水（小）」→「法力药水」
 */
function baseName(name) {
  return name.replace(/（[^）]*）/g, '');
}

/**
 * 解析炼制意图
 * @param {string} message - 玩家消息
 * @param {Object} gd - gameData（未使用字段级数据，保留签名对齐其他接线件）
 * @returns {{intent:false, reason:string, candidates?:Array<string>}|{intent:true, recipeName:string}}
 */
export function parseBrewIntent(message, gd) {
  const msg = String(message || '');
  if (!msg.trim()) return { intent: false, reason: 'empty' };

  // ① 动词门
  const hasVerb = BREW_VERBS.some((v) => msg.indexOf(v) !== -1);
  if (!hasVerb) return { intent: false, reason: 'no-verb' };

  const names = Object.keys(ALCHEMY_RECIPES);

  // ② 配方名门（全名匹配，取最长——「强效治疗药水」优先于其子串「治疗药水」）
  const fullHits = names.filter((n) => msg.indexOf(n) !== -1);
  if (fullHits.length > 0) {
    const longest = fullHits.reduce((a, b) => (b.length > a.length ? b : a));
    const contained = fullHits.every((n) => longest.indexOf(n) !== -1);
    if (contained) return { intent: true, recipeName: longest };
    return { intent: false, reason: 'ambiguous', candidates: fullHits };
  }

  // ③ 模糊门：去档位括号后匹配（「炼制法力药水」→ 小/中/大三候选 → 让玩家说清档位）
  const baseHits = names.filter((n) => msg.indexOf(baseName(n)) !== -1);
  if (baseHits.length === 1) return { intent: true, recipeName: baseHits[0] };
  if (baseHits.length > 1) return { intent: false, reason: 'ambiguous', candidates: baseHits };
  return { intent: false, reason: 'no-recipe' };
}

/**
 * 在 gd 克隆上执行炼制（含前置校验与检定；成品/事故物入克隆背包）
 * @param {Object} gdClone - 深拷贝的 gameData
 * @param {string} recipeName - parseBrewIntent 给出的配方名
 * @returns {Object} 结算结果 {phase:'precheck'|'brew', success, ...}
 */
export function settleBrew(gdClone, recipeName) {
  const recipe = ALCHEMY_RECIPES[recipeName];
  if (!recipe) return { phase: 'precheck', success: false, reason: '未知配方' };

  // 前置：药剂炼制技能（世界书炼金规则：无技能只能代工/购买）
  const hasSkill = (gdClone.skills || []).some((s) => s && s.name === '药剂炼制');
  if (!hasSkill) {
    return { phase: 'precheck', success: false, reason: 'no-skill', recipeName };
  }

  const brew = alchemySystem.brewPotion(gdClone, recipeName);
  if (brew.success) {
    gdClone.inventory.push(Object.assign({}, brew.potion, { amount: 1, type: '消耗品' }));
  } else if (brew.accidentItem) {
    gdClone.inventory.push(Object.assign({}, brew.accidentItem, { amount: 1, type: '材料' }));
  }
  return Object.assign({ phase: 'brew', recipeName }, brew);
}

/**
 * 构造注入 prompt 的炼金系统块
 * @param {Object} result - settleBrew 返回值
 * @returns {string} 系统块文本（空串=不注入）
 */
export function buildAlchemyPromptBlock(result) {
  if (!result) return '';
  if (result.phase === 'precheck') {
    return '【炼金结算·系统权威】玩家想炼制「' + result.recipeName + '」，但角色没有「药剂炼制」技能。'
      + '叙事应体现不会炼制（手法生疏/不敢下手），引导其向炼金师代工或购买成品；不得产出药水，材料与金币不消耗。';
  }
  const check = result.checkResult || {};
  const checkLine = '炼金检定 d20=' + check.roll + (check.modifier >= 0 ? '+' : '') + (check.modifier || 0)
    + ' vs DC' + check.dc + '，总计 ' + check.total + '（' + (check.grade || '—') + '）';
  if (result.success) {
    return [
      '【炼金结算·系统权威】玩家炼制「' + result.recipeName + '」成功。' + checkLine + '，药效强度：' + (result.strength ? result.strength.finalStrength : '标准') + '。',
      '成品「' + result.potion.name + '」（' + result.potion.effect + '）已入背包，材料与 ' + result.materialCost + ' 金成本已扣除。',
      '按检定结果叙事炼制过程（备料/控火/成色），自然带出品级与药效；不得更改成败、药效数值或消耗。'
    ].join('\n');
  }
  if (result.accidentItem) {
    return [
      '【炼金结算·系统权威】玩家炼制「' + result.recipeName + '」大失败（天然1）。' + checkLine + '。',
      '材料全损、' + result.materialCost + ' 金已扣，获得事故物「' + result.accidentItem.name + '」（瑕疵：' + result.accidentItem.flaw + '，' + result.accidentItem.effect + '）已入背包。',
      '按世界书炼金规则叙事失控场面（炸炉/变质/异味），事故物属性不得更改。'
    ].join('\n');
  }
  if (result.error === '材料不足') {
    return '【炼金结算·系统权威】玩家想炼制「' + result.recipeName + '」，但背包材料不足（所需见「炼金配方表」）。'
      + '叙事应体现凑不齐原料而作罢，引导采集或购买；不得凭空补料。';
  }
  if (result.error === '金币不足') {
    return '【炼金结算·系统权威】玩家想炼制「' + result.recipeName + '」，但金币不足（自炼成本 ' + (result.required || '?') + ' 金）。'
      + '叙事应体现付不起辅料/工费而作罢；不得凭空给钱。';
  }
  return '【炼金结算·系统权威】玩家炼制「' + result.recipeName + '」失败。' + (check.dc ? checkLine + '。' : '')
    + '材料全损、无产出，叙事失败的炼制过程；不得产出药水。';
}

/**
 * 合并炼制结算进最终 gameData（在 AI 命令应用之后调用，引擎权威覆盖）。
 * @returns {boolean} true=有结算需要落盘
 */
export function applyAlchemySettlement(finalGd, settledClone) {
  if (!finalGd || !settledClone) return false;
  finalGd.inventory = (settledClone.inventory || []).slice();
  if (!finalGd.currency) finalGd.currency = {};
  finalGd.currency.gold = (settledClone.currency && settledClone.currency.gold) || 0;
  return true;
}
