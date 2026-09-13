/**
 * spell-input.js - 施法意图解析 + 结算合并（纯函数接线件，无自身副作用）
 *
 * 自然语言施法入口（index.html 主循环消费），沿用 travel-input.js 的事务语义：
 *   1. parseCastIntent(message, gd)
 *      从玩家消息解析施法意图：动词门 + 法术名门（最长匹配）。
 *   2. settleCast(gdClone, spellName)
 *      在 gd 克隆上执行施法：已习得走 castSpell（持杖从主手派生），
 *      未习得自动查背包卷轴走 castFromScroll（卷轴消耗在克隆背包完成）。
 *   3. buildSpellPromptBlock(result)
 *      把施法结算转成注入 prompt 的系统块（成功=按效果叙事；失败=MP 已耗等）。
 *   4. applyCastSettlement(finalGd, settledClone)
 *      AI 回复成功后把克隆上的 character.mp / inventory 合并进最终 gameData。
 *
 * 权威分工：习得/MP/检定由引擎判定；战斗中的伤害与状态按「战斗规则」由叙事层落地。
 * 事务语义由调用方保证：结算先落在 gd 克隆上，AI 响应成功后才合并落盘（终止即丢弃）。
 */

import { spellSystem, SPELLS } from './spell-system.js';

// 施法动词（全包含匹配）
const CAST_VERBS = ['施放', '施展', '吟唱', '释放法术', '念诵', '施法'];

// 法术名短别名（无歧义缩写；均为标准名的真子串时不参与——全名命中优先）
const SPELL_ALIASES = {
  '火球': '火球术',
  '冰暴': '冰风暴',
  '护盾': '护盾术',
  '治愈': '治愈轻伤',
  '解咒': '移除诅咒',
  '鉴定': '鉴定术'
};

const SCROLL_PREFIX = '卷轴·';

/**
 * 解析施法意图
 * @param {string} message - 玩家消息
 * @param {Object} gd - gameData（未使用字段级数据，保留签名对齐其他接线件）
 * @returns {{intent:false, reason:string}|{intent:true, spellName:string}}
 */
export function parseCastIntent(message, gd) {
  const msg = String(message || '');
  if (!msg.trim()) return { intent: false, reason: 'empty' };

  // ① 动词门
  const hasVerb = CAST_VERBS.some((v) => msg.indexOf(v) !== -1);
  if (!hasVerb) return { intent: false, reason: 'no-verb' };

  const names = Object.keys(SPELLS);

  // ② 法术名门（全名最长匹配；别名仅在无全名命中时参与）
  const fullHits = names.filter((n) => msg.indexOf(n) !== -1);
  if (fullHits.length > 0) {
    const longest = fullHits.reduce((a, b) => (b.length > a.length ? b : a));
    if (fullHits.every((n) => longest.indexOf(n) !== -1)) {
      return { intent: true, spellName: longest };
    }
    return { intent: false, reason: 'ambiguous' };
  }
  const aliasHits = [];
  for (const alias in SPELL_ALIASES) {
    if (msg.indexOf(alias) !== -1) aliasHits.push(SPELL_ALIASES[alias]);
  }
  const uniq = aliasHits.filter((n, i) => aliasHits.indexOf(n) === i);
  if (uniq.length === 1) return { intent: true, spellName: uniq[0] };
  if (uniq.length > 1) return { intent: false, reason: 'ambiguous' };
  return { intent: false, reason: 'no-spell' };
}

/**
 * 在 gd 克隆上执行施法
 * @param {Object} gdClone - 深拷贝的 gameData
 * @param {string} spellName - parseCastIntent 给出的法术名
 * @returns {Object} 结算结果 {phase:'cast'|'precheck', success, viaScroll?, ...}
 */
export function settleCast(gdClone, spellName) {
  if (!SPELLS[spellName]) return { phase: 'precheck', success: false, reason: '法术不存在' };

  const learned = (gdClone.spells || []).some((s) => s && s.name === spellName);
  let result;
  let scrollIndex = -1;

  if (learned) {
    result = spellSystem.castSpell(gdClone, spellName);
  } else {
    // 未习得：自动查背包卷轴（「卷轴·法术名」或含法术名的卷轴物品）
    scrollIndex = (gdClone.inventory || []).findIndex(
      (i) => i && /卷轴/.test(String(i.type || '') + String(i.name || '')) && String(i.name || '').indexOf(spellName) !== -1
    );
    if (scrollIndex === -1) {
      return { phase: 'precheck', success: false, reason: 'not-learned', spellName };
    }
    result = spellSystem.castFromScroll(gdClone, spellName);
  }

  // 卷轴施法后消耗卷轴（引擎只标记 scrollConsumed，物品删除在接线层完成）
  if (scrollIndex !== -1 && result.scrollConsumed) {
    gdClone.inventory.splice(scrollIndex, 1);
  }
  return Object.assign({ phase: 'cast', viaScroll: scrollIndex !== -1 }, result);
}

/**
 * 构造注入 prompt 的施法系统块
 * @param {Object} result - settleCast 返回值
 * @returns {string} 系统块文本（空串=不注入）
 */
export function buildSpellPromptBlock(result) {
  if (!result) return '';
  if (result.phase === 'precheck') {
    return '【施法结算·系统权威】玩家想施放「' + result.spellName + '」，但既未习得该法术、背包也没有对应卷轴。'
      + '叙事应体现法术未学（咒文陌生/法阵记不全），引导学习途径（NPC 教学/卷轴/书籍，见「法术总纲」）；不产生任何法术效果。';
  }
  const spell = result.spell || {};
  const checkLine = '施法检定 d20=' + result.roll + (result.roll2 != null ? '/' + result.roll2 + '（不持杖取低）' : '')
    + '，总计 ' + result.total + ' vs DC' + result.dc + '，MP -' + result.mpCost;
  if (result.success) {
    return [
      '【施法结算·系统权威】玩家施放「' + result.spellName + '」成功' + (result.viaScroll ? '（卷轴，已消耗）' : '')
        + (result.enhanced ? '，触发' + result.enhanceDesc : '') + '。' + checkLine + '。',
      '效果按法术描述执行：' + (spell.effect || '') + '。',
      spell.damage ? '伤害掷骰 ' + spell.damage + '（按「战斗规则」结算）。' : '',
      spell.status ? '命中附加状态「' + spell.status + '」（按状态列表执行）。' : '',
      '叙事吟唱/法阵/效果呈现，成败与数值不得更改；MP 消耗已由系统结算，无需命令。'
    ].filter(Boolean).join('\n');
  }
  if (result.isFumble) {
    return '【施法结算·系统权威】玩家施放「' + result.spellName + '」大失败（天然1）——法术失控！' + checkLine + '。'
      + '按世界书法术总纲叙事失控后果（法术反噬/目标偏移/效果畸变），MP 已消耗不得返还。';
  }
  if (result.reason === 'MP不足') {
    return '【施法结算·系统权威】玩家想施放「' + spell.name + '」，但 MP 不足（需 ' + spell.mpCost + '）。'
      + '叙事应体现法力枯竭施不出法术，引导长休（每日首次全满）或饮用法力药水；不产生效果。';
  }
  return '【施法结算·系统权威】玩家施放「' + result.spellName + '」失败（检定未过）。' + checkLine + '。'
    + '叙事法术失控边缘或效果微弱熄灭，MP 已消耗；不得改为成功。';
}

/**
 * 合并施法结算进最终 gameData（在 AI 命令应用之后调用，引擎权威覆盖）。
 * @returns {boolean} true=有结算需要落盘
 */
export function applyCastSettlement(finalGd, settledClone) {
  if (!finalGd || !settledClone) return false;
  if (!finalGd.character) finalGd.character = {};
  finalGd.character.mp = (settledClone.character && settledClone.character.mp) || 0;
  finalGd.inventory = (settledClone.inventory || []).slice();
  return true;
}
