/**
 * 正文生成系统 (Narrative System)
 * 
 * 将游戏事件转化为格式化的卡牌正文输出
 * 基于《输出格式.yaml》规范
 * 参考姬侠传的 response-parser 和 game-helpers
 * 
 * @module narrative-system
 */


// ==================== 时间系统 ====================

let gameTime = {
  year: 303,
  month: 5,
  day: 12,
  hour: 14,
  minute: 30
};

/**
 * 获取当前游戏时间
 */
export function getGameTime() {
  return { ...gameTime };
}

/**
 * 设置游戏时间
 */
export function setGameTime(time) {
  Object.assign(gameTime, time);
}

/**
 * 推进时间
 * @param {number} minutes - 推进的分钟数
 */
export function advanceTime(minutes) {
  gameTime.minute += minutes;
  
  while (gameTime.minute >= 60) {
    gameTime.minute -= 60;
    gameTime.hour++;
  }
  
  while (gameTime.hour >= 24) {
    gameTime.hour -= 24;
    gameTime.day++;
  }
  
  // 简化：每月30天
  while (gameTime.day > 30) {
    gameTime.day -= 30;
    gameTime.month++;
  }
  
  while (gameTime.month > 12) {
    gameTime.month -= 12;
    gameTime.year++;
  }
}

/**
 * 格式化时间标记
 * @returns {string} "灾厄303年5月12日 14:30"
 */
function formatTimeStamp() {
  const { year, month, day, hour, minute } = gameTime;
  const h = String(hour).padStart(2, '0');
  const m = String(minute).padStart(2, '0');
  return `灾厄${year}年${month}月${day}日 ${h}:${m}`;
}

// ==================== 输出格式化 ====================

/**
 * 格式化完整输出
 * @param {Object} options
 * @param {string} options.narrative - 叙事正文
 * @param {Object} options.tags - 标签对象 { check, battle, relation, skill, exp, gold, task }
 * @returns {string} 格式化的完整输出
 */
export function formatOutput({ narrative, tags = {} }) {
  const timeStamp = formatTimeStamp();
  
  let output = `\n----- ✦ ${timeStamp} ✦ -----\n\n<content>\n\n`;
  
  // 叙事正文
  output += narrative + '\n\n';
  
  // 标签（只输出有内容的）
  const tagOrder = ['check', 'battle', 'relation', 'skill', 'exp', 'gold', 'task'];
  tagOrder.forEach(tagName => {
    if (tags[tagName]) {
      output += tags[tagName] + '\n\n';
    }
  });
  
  output += '</content>\n';
  
  return output;
}

// ==================== 战斗标签生成 ====================

/**
 * 生成 <battle> 标签
 * @param {Object} combat - 战斗实例
 * @returns {string}
 */
export function formatBattleTag(combat) {
  let output = '<battle>\n\n';
  
  // 战斗开始
  output += '╔═══════════════════════════════════════════════╗\n';
  output += '║          ⚔️  战斗开始  ⚔️                    ║\n';
  output += '╚═══════════════════════════════════════════════╝\n';
  output += `先攻顺序：${combat.turnOrder.map(t => `${t.name}（${t.initiative}）`).join(' → ')}\n`;
  output += `交战距离：10米\n\n`;
  
  // 按回合整理日志
  const logsByRound = {};
  combat.log.forEach(log => {
    if (!logsByRound[log.round]) {
      logsByRound[log.round] = [];
    }
    logsByRound[log.round].push(log);
  });
  
  // 输出每回合
  Object.keys(logsByRound).sort((a, b) => a - b).forEach(round => {
    if (round === '0') return; // 跳过初始化日志
    
    output += `━━━━━ 第${round}回合 ━━━━━\n\n`;
    
    const roundLogs = logsByRound[round];
    let currentActor = null;
    
    roundLogs.forEach(log => {
      // 回合开始标记
      if (log.type === 'turn') {
        currentActor = log.actor;
        output += `【${currentActor}的回合】\n`;
        return;
      }
      
      // 攻击行动
      if (log.type === 'attack') {
        const attackMatch = log.message.match(/(.+)：d20\((\d+)\)\s*\+\s*(\d+)\s*=\s*(\d+)\s*vs AC\s*(\d+)/);
        if (attackMatch) {
          const [, action, roll, bonus, total, ac] = attackMatch;
          output += `行动：${action}\n`;
          output += `[ 攻击检定：d20(${roll}) + ${bonus} = ${total} vs AC ${ac} ]\n`;
        }
      }
      
      // 命中/未命中
      if (log.type === 'damage') {
        const damageMatch = log.message.match(/(\d+) 点伤害/);
        if (damageMatch) {
          output += `✓ 命中\n`;
          output += `[ 伤害：${damageMatch[1]} ]\n`;
        }
      }
      
      if (log.type === 'miss') {
        output += `✗ 未命中\n`;
      }
      
      // 重击
      if (log.type === 'critical') {
        output += `💥 重击！伤害翻倍！\n`;
      }
    });
    
    output += '\n';
  });
  
  // 战斗结束
  output += '╔═══════════════════════════════════════════════╗\n';
  output += '║          ⚔️  战斗结束  ⚔️                    ║\n';
  output += '╚═══════════════════════════════════════════════╝\n';
  
  if (combat.status === 'victory') {
    const defeatedEnemies = combat.enemies.filter(e => !e.isAlive);
    output += `胜利！击败${defeatedEnemies.map(e => e.name).join('、')}。\n`;
  } else if (combat.status === 'defeat') {
    output += `战败！${combat.player.name}被击败...\n`;
  } else if (combat.status === 'escaped') {
    output += `成功逃离战斗。\n`;
  }
  
  output += '\n</battle>';
  
  return output;
}

// ==================== 检定标签生成 ====================

/**
 * 生成 <check> 标签（框线版）
 * @param {Object} checkResult - 检定结果
 * @returns {string}
 */
export function formatCheckTag(checkResult) {
  const skillName = checkResult.skillName || checkResult.attribute;
  let output = '<check>\n';
  
  // 顶部框线
  output += '╔═══════════════════════════════╗\n';
  output += `║  ${getSkillIcon(skillName)} ${skillName}检定`.padEnd(36, ' ') + '║\n';
  output += '╠═══════════════════════════════╣\n';
  
  // 骰值
  output += `║  骰值: d20(${checkResult.roll})`.padEnd(36, ' ') + '║\n';
  
  // 调整值
  let modifierLine = '║  调整: ';
  if (checkResult.modifier !== 0) {
    modifierLine += `+${checkResult.modifier} (属性) `;
  }
  if (checkResult.proficiencyBonus !== 0) {
    modifierLine += `+${checkResult.proficiencyBonus} (熟练)`;
  }
  output += modifierLine.padEnd(36, ' ') + '║\n';
  
  // 总计
  output += `║  总计: ${checkResult.total}`.padEnd(36, ' ') + '║\n';
  
  // 难度
  output += `║  难度: DC ${checkResult.dc}`.padEnd(36, ' ') + '║\n';
  
  // 结果
  let resultText = checkResult.success ? '✧ 成功 ✧' : '✗ 失败 ✗';
  if (checkResult.criticalSuccess) {
    resultText = '✧✧ 大成功！ ✧✧';
  } else if (checkResult.criticalFailure) {
    resultText = '✗✗ 大失败！ ✗✗';
  }
  output += `║  结果: ${resultText}`.padEnd(36, ' ') + '║\n';
  
  // 底部框线
  output += '╚═══════════════════════════════╝\n';
  output += '</check>';
  
  return output;
}

function getSkillIcon(skill) {
  const icons = {
    '感知': '⚡',
    '运动': '🏃',
    '调查': '🔍',
    '隐匿': '🥷',
    '说服': '💬',
    '威吓': '😠',
    '敏捷': '🎯',
    '力量': '💪',
    '魅力': '✨',
    '智力': '📚'
  };
  return icons[skill] || '🎲';
}

// ==================== 经验标签生成 ====================

/**
 * 生成 <exp> 标签
 * @param {number} exp - 经验值
 * @param {string} source - 来源描述
 * @returns {string}
 */
export function formatExpTag(exp, source = '') {
  if (exp === 0) return '';
  
  let output = '<exp>\n';
  output += `[ 经验：${source} ｜ +${exp} XP ]\n`;
  output += '</exp>';
  
  return output;
}

// ==================== 金币标签生成 ====================

/**
 * 生成 <gold> 标签
 * @param {number} gold - 金币变动
 * @param {string} source - 来源描述
 * @param {number} current - 当前总金币
 * @returns {string}
 */
export function formatGoldTag(gold, source = '', current = 0) {
  if (gold === 0) return '';
  
  let output = '<gold>\n';
  const sign = gold > 0 ? '+' : '';
  output += `[ 金币：${source} ｜ ${sign}${gold} ｜ 当前：${current} ]\n`;
  output += '</gold>';
  
  return output;
}

// ==================== 关系标签生成 ====================

/**
 * 生成 <relation> 标签
 * @param {Array} changes - 关系变动 [{ npc, change, current, level }]
 * @returns {string}
 */
export function formatRelationTag(changes) {
  if (!changes || changes.length === 0) return '';
  
  let output = '<relation>\n';
  
  changes.forEach(change => {
    const sign = change.change > 0 ? '+' : '';
    output += `[ ${change.npc} ｜ ${sign}${change.change} ｜ 当前：${change.current}（${change.level}）]\n`;
  });
  
  output += '</relation>';
  
  return output;
}

// ==================== 技能标签生成 ====================

/**
 * 生成 <skill> 标签
 * @param {Array} changes - 技能变动 [{ name, level, type }]
 * @returns {string}
 */
export function formatSkillTag(changes) {
  if (!changes || changes.length === 0) return '';
  
  let output = '<skill>\n';
  
  changes.forEach(change => {
    if (change.type === 'learned') {
      output += `[ 习得：${change.name} ]\n`;
    } else if (change.type === 'levelup') {
      output += `[ 升级：${change.name} ｜ Lv.${change.level} ]\n`;
    }
  });
  
  output += '</skill>';
  
  return output;
}

// ==================== 任务标签生成 ====================

/**
 * 生成 <task> 标签
 * @param {Array} tasks - 任务变动 [{ name, status, note }]
 * @returns {string}
 */
export function formatTaskTag(tasks) {
  if (!tasks || tasks.length === 0) return '';
  
  let output = '<task>\n';
  
  tasks.forEach(task => {
    output += `✧ ${task.name} | ${task.status}`;
    if (task.note) {
      output += ` | ${task.note}`;
    }
    output += '\n';
  });
  
  output += '</task>';
  
  return output;
}

// ==================== 战斗正文生成 ====================

/**
 * 生成战斗正文
 * @param {Object} combat - 战斗实例
 * @param {string} narrativeIntro - 叙事开场（可选）
 * @returns {string}
 */
export function generateCombatNarrative(combat, narrativeIntro = '') {
  // 叙事开场
  let narrative = narrativeIntro || generateCombatIntro(combat);
  
  // 生成战斗标签
  const battleTag = formatBattleTag(combat);
  
  // 生成结算标签
  const tags = {};
  
  if (combat.rewards) {
    tags.exp = formatExpTag(
      combat.rewards.exp,
      `击败${combat.enemies.map(e => e.name).join('、')}`
    );
    
    tags.gold = formatGoldTag(
      combat.rewards.gold,
      '战利品',
      0 // TODO: 需要从游戏状态获取当前金币
    );
  }
  
  // 组装完整输出
  return formatOutput({
    narrative: narrative + '\n' + battleTag,
    tags: tags
  });
}

/**
 * 生成战斗开场叙事
 * @param {Object} combat - 战斗实例
 * @returns {string}
 */
function generateCombatIntro(combat) {
  const enemies = combat.enemies.map(e => e.name).join('、');
  
  const intros = [
    `灰烬在你脚下腾起薄薄的烟尘。${enemies}从焦木后跃出，发出低沉的咆哮。`,
    `前方传来动静。${enemies}出现在视野中。`,
    `废墟的阴影中，${enemies}缓缓走出。`,
    `警戒！${enemies}发起攻击！`
  ];
  
  return intros[Math.floor(Math.random() * intros.length)];
}

// ==================== 检定正文生成 ====================

/**
 * 生成检定正文
 * @param {Object} checkResult - 检定结果
 * @param {string} context - 检定上下文描述
 * @returns {string}
 */
export function generateCheckNarrative(checkResult, context) {
  const narrative = context || `你尝试进行${checkResult.skillName || checkResult.attribute}检定。`;
  
  const checkTag = formatCheckTag(checkResult);
  
  return formatOutput({
    narrative: narrative + '\n\n' + checkTag,
    tags: {}
  });
}

// ==================== 导出 ====================

export default {
  // 时间系统
  getGameTime,
  setGameTime,
  advanceTime,
  
  // 输出格式化
  formatOutput,
  
  // 标签生成
  formatBattleTag,
  formatCheckTag,
  formatExpTag,
  formatGoldTag,
  formatRelationTag,
  formatSkillTag,
  formatTaskTag,
  
  // 正文生成
  generateCombatNarrative,
  generateCheckNarrative
};

