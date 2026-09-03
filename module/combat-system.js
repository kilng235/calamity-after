/**
 * 战斗系统 (Combat System)
 * 
 * 基于 DND 5E 回合制战斗规则
 * 提供完整的战斗流程：先攻、回合、攻击、结算
 * 
 * @module combat-system
 */

import { getDice } from './dice-pool.js';
import { performCheck, calculateModifier } from './check-system.js';
import { calculateTotalAC, rollWeaponDamage, isDualWielding, damageWeaponDurability, damageArmorDurability } from './equipment-system.js';
import { createCreature, creatureAttack, damageCreature, dropLoot } from './creature-system.js';

// ==================== 战斗状态 ====================

let activeCombat = null;
let combatIdCounter = 1;

// ==================== 工具函数 ====================

/**
 * 生成战斗ID
 */
function generateCombatId() {
  return `combat_${combatIdCounter++}`;
}

/**
 * 生成实体ID
 */
function generateEntityId(type) {
  return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ==================== 战斗创建 ====================

/**
 * 开始新战斗
 * @param {Object} playerData - 玩家数据 { name, hp, attributes, equipment }
 * @param {Array<string>} enemyNames - 敌人模板名称列表
 * @returns {Object} 战斗实例
 */
export function startCombat(playerData, enemyNames) {
  // 创建玩家实体
  const player = {
    id: 'player',
    type: 'player',
    name: playerData.name || '冒险者',
    hp: {
      current: playerData.hp?.current || 30,
      max: playerData.hp?.max || 30
    },
    attributes: playerData.attributes || {
      力量: 14,
      敏捷: 16,
      体质: 12,
      智力: 10,
      感知: 13,
      魅力: 15
    },
    equipment: playerData.equipment || {},
    conditions: [],
    proficiencyBonus: playerData.proficiencyBonus || 2
  };
  
  // 计算玩家AC
  player.ac = calculateTotalAC(player.attributes).total;
  
  // 创建敌人实体
  const enemies = enemyNames.map(name => {
    const creature = createCreature(name);
    return {
      id: generateEntityId('enemy'),
      ...creature
    };
  });
  
  // 创建战斗实例
  const combat = {
    id: generateCombatId(),
    status: 'pending',  // pending, active, victory, defeat, escaped
    
    player: player,
    enemies: enemies,
    
    round: 0,
    turn: 0,
    turnOrder: [],
    currentTurnIndex: 0,
    
    log: [],
    damageDealt: 0,
    damageTaken: 0,
    
    rewards: null
  };
  
  activeCombat = combat;
  
  // 先攻检定
  rollInitiative(combat);
  
  // 开始战斗
  combat.status = 'active';
  combat.round = 1;
  
  addLog(combat, 'start', null, null, `⚔️ 战斗开始！遭遇 ${enemies.map(e => e.name).join('、')}！`);
  
  return combat;
}

// ==================== 先攻检定 ====================

/**
 * 先攻检定
 * @param {Object} combat - 战斗实例
 */
function rollInitiative(combat) {
  const initiatives = [];
  
  // 玩家先攻
  const playerInit = getDice('d20').value + calculateModifier(combat.player.attributes.敏捷);
  initiatives.push({
    id: 'player',
    name: combat.player.name,
    initiative: playerInit,
    type: 'player'
  });
  
  addLog(combat, 'initiative', 'player', null, `${combat.player.name}先攻检定：${playerInit}`);
  
  // 敌人先攻
  combat.enemies.forEach(enemy => {
    const enemyInit = getDice('d20').value + enemy.attackBonus;
    initiatives.push({
      id: enemy.id,
      name: enemy.name,
      initiative: enemyInit,
      type: 'enemy'
    });
    
    addLog(combat, 'initiative', enemy.id, null, `${enemy.name}先攻检定：${enemyInit}`);
  });
  
  // 排序（从高到低）
  initiatives.sort((a, b) => b.initiative - a.initiative);
  
  combat.turnOrder = initiatives;
  
  const orderStr = initiatives.map(i => `${i.name}(${i.initiative})`).join(' → ');
  addLog(combat, 'initiative', null, null, `📊 行动顺序：${orderStr}`);
}

// ==================== 回合管理 ====================

/**
 * 获取当前行动者
 * @param {Object} combat - 战斗实例
 * @returns {Object} { id, name, type }
 */
export function getCurrentActor(combat) {
  if (combat.status !== 'active') return null;
  return combat.turnOrder[combat.currentTurnIndex];
}

/**
 * 下一个回合
 * @param {Object} combat - 战斗实例
 */
export function nextTurn(combat) {
  combat.currentTurnIndex++;
  
  // 回合结束，开始新回合
  if (combat.currentTurnIndex >= combat.turnOrder.length) {
    combat.currentTurnIndex = 0;
    combat.round++;
    addLog(combat, 'round', null, null, `\n━━━━━━ 第${combat.round}回合 ━━━━━━`);
  }
  
  // 检查战斗是否结束
  checkCombatEnd(combat);
  
  // 如果是敌人回合，自动执行
  const actor = getCurrentActor(combat);
  if (actor && actor.type === 'enemy' && combat.status === 'active') {
    enemyTurn(combat, actor.id);
  }
}

// ==================== 玩家行动 ====================

/**
 * 玩家攻击
 * @param {Object} combat - 战斗实例
 * @param {string} targetId - 目标敌人ID
 * @param {string} weaponSlot - 'mainHand' | 'offHand' | 'both'
 * @returns {Object} 攻击结果
 */
export function playerAttack(combat, targetId, weaponSlot = 'mainHand') {
  if (combat.status !== 'active') {
    return { success: false, message: '战斗未进行中' };
  }
  
  const actor = getCurrentActor(combat);
  if (actor.type !== 'player') {
    return { success: false, message: '不是玩家回合' };
  }
  
  // 查找目标
  const target = combat.enemies.find(e => e.id === targetId);
  if (!target || !target.isAlive) {
    return { success: false, message: '无效的目标' };
  }
  
  const results = [];
  
  // 主手攻击
  if (weaponSlot === 'mainHand' || weaponSlot === 'both') {
    const mainResult = executePlayerAttack(combat, target, false);
    results.push(mainResult);
  }
  
  // 副手攻击（双持）
  if (weaponSlot === 'offHand' || (weaponSlot === 'both' && isDualWielding())) {
    const offResult = executePlayerAttack(combat, target, true);
    results.push(offResult);
  }
  
  // 下一回合
  nextTurn(combat);
  
  return {
    success: true,
    results: results
  };
}

/**
 * 执行单次攻击
 */
function executePlayerAttack(combat, target, useOffHand) {
  const player = combat.player;
  const weaponName = useOffHand ? '副手' : '主手';
  
  // 命中检定
  const attackRoll = getDice('d20').value;
  const attackBonus = player.proficiencyBonus + calculateModifier(player.attributes.力量);
  const attackTotal = attackRoll + attackBonus;
  
  const hit = attackTotal >= target.ac || attackRoll === 20;
  const crit = attackRoll === 20;
  const critFail = attackRoll === 1;
  
  // 日志
  addLog(combat, 'attack', 'player', target.id, 
    `${player.name}用${weaponName}攻击${target.name}：d20(${attackRoll}) + ${attackBonus} = ${attackTotal} vs AC ${target.ac}`
  );
  
  let damage = 0;
  
  if (hit && !critFail) {
    // 计算伤害
    const damageResult = rollWeaponDamage(player.attributes, useOffHand);
    damage = damageResult.damage;
    
    if (crit) {
      damage *= 2;
      addLog(combat, 'critical', 'player', target.id, `💥 重击！伤害翻倍！`);
    }
    
    // 造成伤害
    damageCreature(target, damage);
    combat.damageDealt += damage;
    
    addLog(combat, 'damage', 'player', target.id, 
      `→ 命中！造成 ${damage} 点伤害（${target.name} HP: ${target.hp.current + damage} → ${target.hp.current}）`
    );
    
    // 武器耐久损耗
    damageWeaponDurability(false, useOffHand);
    
  } else {
    addLog(combat, 'miss', 'player', target.id, `→ 未命中！`);
    
    if (critFail) {
      addLog(combat, 'critical_fail', 'player', target.id, `💔 大失败！武器严重损耗！`);
      damageWeaponDurability(true, useOffHand);
    }
  }
  
  return { hit, crit, critFail, damage, target: target.name };
}

/**
 * 玩家防御
 * @param {Object} combat - 战斗实例
 */
export function playerDefend(combat) {
  if (combat.status !== 'active') return { success: false };
  
  const actor = getCurrentActor(combat);
  if (actor.type !== 'player') return { success: false };
  
  addLog(combat, 'defend', 'player', null, `${combat.player.name}采取防御姿态，下次受到的伤害减半！`);
  
  // TODO: 添加防御状态
  
  nextTurn(combat);
  return { success: true };
}

/**
 * 玩家逃跑
 * @param {Object} combat - 战斗实例
 */
export function playerFlee(combat) {
  if (combat.status !== 'active') return { success: false };
  
  const actor = getCurrentActor(combat);
  if (actor.type !== 'player') return { success: false };
  
  // 逃跑检定
  const fleeRoll = getDice('d20').value + calculateModifier(combat.player.attributes.敏捷);
  const fleeDC = 12;
  
  addLog(combat, 'flee', 'player', null, `${combat.player.name}尝试逃跑：${fleeRoll} vs DC ${fleeDC}`);
  
  if (fleeRoll >= fleeDC) {
    combat.status = 'escaped';
    addLog(combat, 'escaped', 'player', null, `✓ 成功逃离战斗！`);
    return { success: true, escaped: true };
  } else {
    addLog(combat, 'flee', 'player', null, `✗ 逃跑失败！敌人获得机会攻击！`);
    
    // 敌人机会攻击
    combat.enemies.forEach(enemy => {
      if (enemy.isAlive) {
        const oppResult = creatureAttack(enemy, combat.player.ac);
        if (oppResult.hit) {
          combat.player.hp.current -= oppResult.damage;
          combat.damageTaken += oppResult.damage;
          addLog(combat, 'damage', enemy.id, 'player', 
            `${enemy.name}机会攻击命中！造成${oppResult.damage}点伤害！`
          );
        }
      }
    });
    
    nextTurn(combat);
    return { success: true, escaped: false };
  }
}

// ==================== 敌人回合 ====================

/**
 * 敌人回合（AI）
 * @param {Object} combat - 战斗实例
 * @param {string} enemyId - 敌人ID
 */
function enemyTurn(combat, enemyId) {
  const enemy = combat.enemies.find(e => e.id === enemyId);
  if (!enemy || !enemy.isAlive) {
    nextTurn(combat);
    return;
  }
  
  addLog(combat, 'turn', enemyId, null, `\n【${enemy.name}的回合】`);
  
  // 简单AI：攻击玩家
  const attackResult = creatureAttack(enemy, combat.player.ac);
  
  addLog(combat, 'attack', enemyId, 'player',
    `${enemy.name}攻击${combat.player.name}：d20(${attackResult.roll}) + ${enemy.attackBonus} = ${attackResult.total} vs AC ${combat.player.ac}`
  );
  
  if (attackResult.hit) {
    combat.player.hp.current -= attackResult.damage;
    combat.damageTaken += attackResult.damage;
    
    if (attackResult.crit) {
      addLog(combat, 'critical', enemyId, 'player', `💥 重击！`);
    }
    
    addLog(combat, 'damage', enemyId, 'player',
      `→ 命中！造成 ${attackResult.damage} 点伤害（玩家 HP: ${combat.player.hp.current + attackResult.damage} → ${combat.player.hp.current}）`
    );
    
    // 护甲耐久损耗
    damageArmorDurability(attackResult.damage);
    
  } else {
    addLog(combat, 'miss', enemyId, 'player', `→ 未命中！`);
  }
  
  // 下一回合
  nextTurn(combat);
}

// ==================== 战斗结束 ====================

/**
 * 检查战斗是否结束
 * @param {Object} combat - 战斗实例
 * @returns {boolean}
 */
function checkCombatEnd(combat) {
  // 玩家死亡
  if (combat.player.hp.current <= 0) {
    combat.status = 'defeat';
    addLog(combat, 'defeat', null, null, `\n💀 ${combat.player.name}被击败了...`);
    return true;
  }
  
  // 所有敌人死亡
  const aliveEnemies = combat.enemies.filter(e => e.isAlive);
  if (aliveEnemies.length === 0) {
    combat.status = 'victory';
    addLog(combat, 'victory', null, null, `\n🎉 胜利！所有敌人被击败！`);
    
    // 结算奖励
    calculateRewards(combat);
    return true;
  }
  
  return false;
}

/**
 * 结算奖励
 * @param {Object} combat - 战斗实例
 */
function calculateRewards(combat) {
  let totalExp = 0;
  let totalGold = 0;
  const items = [];
  
  combat.enemies.forEach(enemy => {
    const loot = dropLoot(enemy);
    if (loot) {
      totalExp += loot.exp;
      totalGold += loot.gold;
      items.push(...loot.items);
    }
  });
  
  combat.rewards = {
    exp: totalExp,
    gold: totalGold,
    items: items
  };
  
  addLog(combat, 'reward', null, null, 
    `\n🎁 战利品：\n  经验值：${totalExp}\n  金币：${totalGold}\n  物品：${items.map(i => i.item).join('、') || '无'}`
  );
}

// ==================== 战斗日志 ====================

/**
 * 添加战斗日志
 */
function addLog(combat, type, actor, target, message) {
  combat.log.push({
    type,
    round: combat.round,
    actor,
    target,
    message,
    timestamp: Date.now()
  });
  
  console.log(`[战斗日志] ${message}`);
}

/**
 * 获取战斗日志
 * @param {Object} combat - 战斗实例
 * @returns {Array}
 */
export function getCombatLog(combat) {
  return combat.log;
}

// ==================== 查询函数 ====================

/**
 * 获取当前战斗
 */
export function getActiveCombat() {
  return activeCombat;
}

/**
 * 获取存活的敌人
 */
export function getAliveEnemies(combat) {
  return combat.enemies.filter(e => e.isAlive);
}

/**
 * 获取战斗统计
 */
export function getCombatStats(combat) {
  return {
    round: combat.round,
    damageDealt: combat.damageDealt,
    damageTaken: combat.damageTaken,
    enemiesDefeated: combat.enemies.filter(e => !e.isAlive).length,
    enemiesTotal: combat.enemies.length
  };
}

// ==================== 导出 ====================

export default {
  // 战斗创建
  startCombat,
  
  // 回合管理
  getCurrentActor,
  nextTurn,
  
  // 玩家行动
  playerAttack,
  playerDefend,
  playerFlee,
  
  // 查询
  getActiveCombat,
  getAliveEnemies,
  getCombatStats,
  getCombatLog
};
