/**
 * encounter-system.js - 路途遭遇系统（第一期：纯叙事版）
 *
 * 设计决策（用户确认 2026-09-07）：
 *   - 锈钉镇无野外遭遇（安全区，城内冲突走剧情）
 *   - 第一期纯叙事：系统掷骰决定「是否遇到/遇到什么/几只/是否偷袭」，
 *     战斗过程由 LLM 按世界书「战斗规则」「生物总纲」跑团（骰池反作弊已兜底）
 *   - 偷袭失败轻惩罚：仅「敌方先攻」叙事劣势，不扣开场 HP
 *
 * 消费：
 *   encounter-pools.js  遭遇池 + 概率表
 *   travel-tables.js    路线 extraPool（道路附加生物）
 *
 * 产出 encounter 对象（由 travelTo 返回，encounterHint 注入下轮 prompt）：
 *   {
 *     occurred: true/false,
 *     creature, count, threat,
 *     surprise,                    // 偷袭成功（敌先攻）
 *     stealthCheck,                // 偷袭检定详情
 *     narrative                    // 一句话给 LLM 的指令性提示
 *   }
 */

import { ENCOUNTER_POOLS, ENCOUNTER_RATE } from './encounter-pools.js';

/**
 * 解析骰子表达式（'2d3' / '1d4' / '1'）——与 material-system.parseAmount 同规则，
 * 此处独立实现避免跨模块拉材料系统
 * @param {string|number} expr
 * @returns {number}
 */
export function parseCount(expr) {
  if (typeof expr === 'number') return expr;
  if (typeof expr !== 'string') return 1;
  const m = expr.match(/^(\d+)d(\d+)$/i);
  if (m) {
    const count = parseInt(m[1], 10);
    const sides = parseInt(m[2], 10);
    let total = 0;
    for (let i = 0; i < count; i++) {
      total += Math.floor(Math.random() * sides) + 1;
    }
    return total;
  }
  const n = parseInt(expr, 10);
  return isNaN(n) ? 1 : n;
}

/**
 * 按权重抽一种遭遇
 * @param {Array<{creature, weight, count, threat}>} pool
 * @returns {Object} 命中的条目
 */
export function rollOneEncounter(pool) {
  const totalWeight = pool.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * totalWeight;
  for (const e of pool) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return pool[pool.length - 1];
}

/**
 * 偷袭检定（轻惩罚版）
 * 玩家敏捷检定 d20 + 敏捷调整 vs DC12（夜路降至 DC10）
 * 失败 → 敌方先攻（叙事劣势）
 * @param {Object} character - 需 attributes.敏捷
 * @param {boolean} night
 * @returns {{ roll, modifier, dc, total, success }}
 */
export function rollStealthCheck(character, night) {
  const dex = character?.attributes?.['敏捷'] ?? 10;
  const modifier = Math.floor((dex - 10) / 2);
  const dc = night ? 10 : 12;
  const roll = Math.floor(Math.random() * 20) + 1;
  const total = roll + modifier;
  return { roll, modifier, dc, total, success: total >= dc };
}

/**
 * 构造遭遇池（目的地池 ∪ 路线 extraPool）
 * @param {string} destination - 目的区域
 * @param {Array<string>|undefined} extraPool - 路线附加生物名
 * @returns {Array} 合并后的池（extraPool 生物按 weight 8 中性权重插入）
 */
export function buildPool(destination, extraPool) {
  const destPool = ENCOUNTER_POOLS[destination] || [];
  if (!extraPool || extraPool.length === 0) return destPool;

  const merged = destPool.map((e) => ({ ...e }));
  const existing = new Set(merged.map((e) => e.creature));
  for (const name of extraPool) {
    if (!existing.has(name)) {
      merged.push({ creature: name, weight: 8, count: '1', threat: '中' });
    }
  }
  return merged;
}

/**
 * 路途遭遇判定（travelTo 内调用）
 * @param {Object} route - 路线（findRoute 返回，from 归一为出发地）
 * @param {string} effectiveDanger - 夜路升档后的危险
 * @param {boolean} night - 是否夜路
 * @param {Object} character - 角色（偷袭检定用）
 * @returns {Object|null} encounter 对象或 null（无遭遇）
 */
export function rollEncounter(route, effectiveDanger, night, character) {
  // ① 概率判定
  const rate = ENCOUNTER_RATE[effectiveDanger] ?? 0;
  const d100 = Math.floor(Math.random() * 100) + 1;
  if (d100 > rate) {
    return null;
  }

  // ② 构池抽怪
  const pool = buildPool(route.to, route.extraPool);
  if (pool.length === 0) {
    return null;   // 目的地与道路都无遭遇生物（如安全区）
  }
  const entry = rollOneEncounter(pool);
  const count = parseCount(entry.count);

  // ③ 偷袭检定（轻惩罚：仅先攻叙事）
  const stealth = rollStealthCheck(character, night);
  const surprise = !stealth.success;

  // ④ 产出
  return {
    occurred: true,
    creature: entry.creature,
    count,
    threat: entry.threat,
    surprise,
    stealthCheck: stealth,
    area: route.to,
    night,
    narrative: buildEncounterNarrative(entry.creature, count, entry.threat, surprise, night)
  };
}

/**
 * 构造叙事提示（注入 prompt 的指令性文本）
 */
function buildEncounterNarrative(creature, count, threat, surprise, night) {
  const parts = [`路途遭遇：${creature} ×${count}（威胁${threat}）`];
  if (surprise) {
    parts.push('偷袭判定失败，敌方获得先攻，玩家第一轮处于被动');
  } else {
    parts.push('玩家察觉及时，未被偷袭');
  }
  if (night) parts.push('夜间遭遇，视野受限');
  parts.push('按「生物总纲」呈现遭遇与习性，战斗按「战斗规则」进行，HP/伤害从骰子池取用');
  return parts.join('；');
}
