/**
 * travel-system.js - 旅行移动系统
 *
 * 消费 travel-tables.js 路网，提供 travelTo(destination, character)：
 *   1. 查边表（无向）
 *   2. 校验当前地点有路可达目的地
 *   3. 校验 requires 前置解锁（地下/嵌套区域）
 *   4. 夜路检查（22-06 时出发 → danger 升档，仅叙事提示）
 *   5. 推进 gameTime（hours × 60 分钟，与 narrative-system advanceTime 同口径）
 *   6. 更新 progress.currentLocation + unlockedLocations
 *   7. 返回 encounterHint 供 prompt-builder 注入下轮叙事
 *
 * 注意：本模块不直接 import game-state（避免循环依赖），
 * gameTime 推进与进度落盘由调用方（index.html 或 command-processor）执行。
 */

import {
  findRoute,
  isNightHour,
  escalateDanger,
  START_LOCATION
} from './travel-tables.js';

export { START_LOCATION };

/**
 * 推进游戏时间（分钟）——与 narrative-system.js advanceTime 同进位规则
 * 60秒/分、24时/天、30天/月、12月/年
 * @param {Object} gameTime - { year, month, day, hour, minute }
 * @param {number} minutes
 * @returns {Object} 新的 gameTime（原对象不修改）
 */
export function advanceGameTime(gameTime, minutes) {
  const t = { ...gameTime };
  t.minute += minutes;
  if (t.minute >= 60) {
    t.hour += Math.floor(t.minute / 60);
    t.minute %= 60;
  }
  if (t.hour >= 24) {
    t.day += Math.floor(t.hour / 24);
    t.hour %= 24;
  }
  if (t.day > 30) {
    t.month += Math.floor((t.day - 1) / 30);
    t.day = ((t.day - 1) % 30) + 1;
  }
  if (t.month > 12) {
    t.year += Math.floor((t.month - 1) / 12);
    t.month = ((t.month - 1) % 12) + 1;
  }
  return t;
}

/**
 * 旅行到目的地
 * @param {string} destination - 目标区域名（如 '魔法荒原'）
 * @param {Object} character - 角色数据（含 gameTime / progress）
 * @returns {{ success, ... } | { success: false, error }}
 *
 * 成功返回：
 *   route         实际路线（from 归一为出发地）
 *   effectiveDanger 夜路升档后的危险（供叙事）
 *   nightTravel   是否夜路
 *   arrivedAt     抵达后的 gameTime
 *   encounterHint 叙事提示（danger + note，供 prompt-builder）
 *   newLocation   新的 currentLocation
 *
 * 副作用（直接修改 character）：
 *   - character.gameTime 推进
 *   - character.progress.currentLocation 更新
 *   - character.progress.unlockedLocations 去重追加
 */
export function travelTo(destination, character) {
  const progress = character.progress || (character.progress = {});
  const currentLocation = progress.currentLocation || START_LOCATION;
  const gameTime = character.gameTime || { year: 300, month: 11, day: 12, hour: 7, minute: 10 };

  // 自我旅行（原地）
  if (currentLocation === destination) {
    return { success: false, error: '已在该区域' };
  }

  // 查路
  const route = findRoute(currentLocation, destination);
  if (!route) {
    return {
      success: false,
      error: '没有直达路线',
      from: currentLocation,
      to: destination,
      hint: '需先移动到中途区域'
    };
  }

  // 前置解锁校验
  const unlocked = progress.unlockedLocations || [currentLocation];
  if (route.requires) {
    const missing = route.requires.filter((r) => !unlocked.includes(r));
    if (missing.length > 0) {
      return {
        success: false,
        error: '路线未解锁',
        missingRequirements: missing,
        hint: `需先抵达：${missing.join('、')}`
      };
    }
  }

  // 夜路检查
  const nightTravel = isNightHour(gameTime.hour);
  const effectiveDanger = nightTravel ? escalateDanger(route.danger) : route.danger;

  // 推进时间
  const arrivedAt = advanceGameTime(gameTime, route.hours * 60);
  character.gameTime = arrivedAt;

  // 更新进度
  progress.currentLocation = destination;
  if (!progress.unlockedLocations) progress.unlockedLocations = [currentLocation];
  if (!progress.unlockedLocations.includes(destination)) {
    progress.unlockedLocations.push(destination);
  }

  return {
    success: true,
    route,
    effectiveDanger,
    nightTravel,
    arrivedAt,
    encounterHint: buildEncounterHint(route, effectiveDanger, nightTravel),
    newLocation: destination
  };
}

/**
 * 构造叙事提示（供 prompt-builder 注入；遭遇系统落地前为纯文本）
 */
function buildEncounterHint(route, effectiveDanger, nightTravel) {
  const parts = [`路线：${route.from} → ${route.to}（约 ${route.hours} 小时）`,
                 `危险等级：${effectiveDanger}`,
                 route.note];
  if (nightTravel) parts.push('⚠️ 夜间赶路，危险上升，叙事应体现紧张感与视野受限');
  return parts.join('；');
}
