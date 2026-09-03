/**
 * 生物系统 (Creature System)
 * 
 * 提供生物创建、属性管理、攻击行为、战利品掉落等功能
 * 基于灾厄之后生物总纲
 * 
 * @module creature-system
 */

import { getDice } from './dice-pool.js';

// ==================== 威胁等级基准 ====================

/**
 * 威胁等级数据（按生物总纲）
 */
const THREAT_LEVELS = {
  '低': {
    ac: 10,
    hp: 12,
    damage: '1d6',
    exp: [5, 10],
    attackBonus: 2
  },
  '中': {
    ac: 12,
    hp: 24,
    damage: '1d8',
    exp: [15, 25],
    attackBonus: 3
  },
  '中高': {
    ac: 14,
    hp: 36,
    damage: '1d10',
    exp: [25, 40],
    attackBonus: 4
  },
  '高': {
    ac: 16,
    hp: 48,
    damage: '1d12',
    exp: [40, 50],
    attackBonus: 5
  },
  '极高': {
    ac: 18,
    hp: 72,
    damage: '1d12+4',
    exp: [50, 100],
    attackBonus: 6
  }
};

// ==================== 生物模板 ====================

/**
 * 生物模板数据库
 */
const CREATURE_TEMPLATES = {
  '灰烬狼': {
    id: 'ashwolf',
    name: '灰烬狼',
    threatLevel: '中',
    type: '变异生物',
    region: '灰烬森林',
    
    abilities: [
      {
        name: '群体狩猎',
        description: '头狼存活时，狼群命中检定获优势',
        effect: 'pack_tactics'
      },
      {
        name: '咬住不放',
        description: '命中后下一轮可续咬（1d6伤害，无需再检定命中）',
        effect: 'grapple_bite'
      }
    ],
    
    weaknesses: [
      { name: '畏惧火光', description: '持火把者对其威吓检定获优势' }
    ],
    
    loot: [
      { item: '灰烬狼皮', chance: 0.8, value: 15 },
      { item: '灰烬狼牙', chance: 0.5, value: 8 }
    ],
    
    description: '皮毛灰白的群居狼群，昼伏夜出的变异猎手。',
    appearance: '皮毛灰白，与灰烬环境融为一体，静止时难辨形迹。',
    behavior: 'pack'
  },
  
  '焦木巨蜥': {
    id: 'charredlizard',
    name: '焦木巨蜥',
    threatLevel: '中高',
    type: '变异生物',
    region: '灰烬森林',
    
    abilities: [
      {
        name: '潜伏突袭',
        description: '初次攻击前，目标需感知检定（DC15）察觉，失败则首击获优势',
        effect: 'ambush'
      },
      {
        name: '尾扫',
        description: '若两个以上敌人近身，改用尾扫（1d8，可同时命中相邻目标）',
        effect: 'tail_sweep'
      }
    ],
    
    weaknesses: [
      { name: '弱点腹鳞', description: '将其掀翻后，对其攻击获优势' },
      { name: '畏惧强光', description: '照明弹或烈焰可迫其后退' }
    ],
    
    loot: [
      { item: '巨蜥鳞片', chance: 0.9, value: 25 },
      { item: '巨蜥皮', chance: 0.7, value: 18 }
    ],
    
    description: '体长约两米的焦黑巨蜥，领域性强的伏击猎手。',
    appearance: '体长约两米，鳞片焦黑带炭化纹路，伏在灰烬中与焦木难以区分。',
    behavior: 'ambush'
  },
  
  '变异鼠群': {
    id: 'mutantratswarm',
    name: '变异鼠群',
    threatLevel: '低',
    type: '变异生物',
    region: '废墟/下水道',
    
    abilities: [
      {
        name: '群体包围',
        description: '数量众多，攻击时获优势',
        effect: 'swarm'
      }
    ],
    
    weaknesses: [
      { name: '易受范围伤害', description: '对火焰、爆炸等范围伤害易受伤' }
    ],
    
    loot: [
      { item: '鼠皮', chance: 0.6, value: 3 }
    ],
    
    description: '成群结队的变异老鼠，凶猛且饥饿。',
    appearance: '眼睛发红，毛发脏乱，成群涌动。',
    behavior: 'swarm'
  },
  
  '石甲虫': {
    id: 'stonebeetle',
    name: '石甲虫',
    threatLevel: '低',
    type: '普通生物',
    region: '洞穴/废墟',
    
    abilities: [],
    
    weaknesses: [
      { name: '行动缓慢', description: '先攻检定劣势' }
    ],
    
    loot: [
      { item: '甲虫壳', chance: 0.7, value: 5 }
    ],
    
    description: '外壳坚硬的大型甲虫，动作缓慢。',
    appearance: '灰褐色外壳，约手掌大小，钳状口器。',
    behavior: 'simple'
  },
  
  '灰烬蚊': {
    id: 'ashmosquito',
    name: '灰烬蚊',
    threatLevel: '低',
    type: '变异生物',
    region: '灰烬森林',
    
    abilities: [
      {
        name: '吸血',
        description: '命中后吸取1点生命值',
        effect: 'drain'
      }
    ],
    
    weaknesses: [
      { name: '脆弱', description: '生命值极低，易被击杀' }
    ],
    
    loot: [],
    
    description: '嗡嗡作响的大型蚊虫，吸食血液。',
    appearance: '比普通蚊子大三倍，翅膀灰白透明。',
    behavior: 'simple'
  },
  
  // === BG3 灵感生物 ===
  
  '废土掠夺者': {
    id: 'wastelandraider',
    name: '废土掠夺者',
    threatLevel: '低',
    type: '变异生物',
    region: '废墟/废土',
    
    abilities: [
      {
        name: '群体战术',
        description: '同伴在5英尺内时攻击获优势',
        effect: 'pack_tactics'
      },
      {
        name: '懦夫',
        description: 'HP低于50%时可能逃跑',
        effect: 'coward'
      }
    ],
    
    weaknesses: [
      { name: '装备简陋', description: '防御值低' }
    ],
    
    loot: [
      { item: '废铁武器', chance: 0.6, value: 5 },
      { item: '破布', chance: 0.4, value: 2 }
    ],
    
    description: '成群结队的掠夺者，装备简陋但凶残狡猾。',
    appearance: '身材瘦小，穿着破烂护甲，手持生锈武器。',
    behavior: 'pack'
  },
  
  '白骨行者': {
    id: 'bonew alker',
    name: '白骨行者',
    threatLevel: '低',
    type: '异常生物',
    region: '旧王城废墟/沉没之城',
    
    abilities: [
      {
        name: '远程射击',
        description: '可使用弓箭进行远程攻击',
        effect: 'ranged'
      }
    ],
    
    weaknesses: [
      { name: '骨架脆弱', description: '受到钝击伤害时额外+2伤害' }
    ],
    
    loot: [
      { item: '古老骨骸', chance: 0.7, value: 8 },
      { item: '破损武器', chance: 0.5, value: 5 }
    ],
    
    description: '游荡的白骨骷髅，灾厄前死者的残骸被唤醒。',
    appearance: '骨架完整但老旧，空洞的眼眶闪烁幽光。',
    behavior: 'simple'
  },
  
  '感染者': {
    id: 'infected',
    name: '感染者',
    threatLevel: '中',
    type: '异常生物',
    region: '废墟/隔离区',
    
    abilities: [
      {
        name: '不死韧性',
        description: '首次HP归0时50%概率保留1HP',
        effect: 'undead_fortitude'
      },
      {
        name: '感染撕咬',
        description: '命中后目标需体质豁免（DC12），失败中毒',
        effect: 'infectious_bite'
      }
    ],
    
    weaknesses: [
      { name: '行动迟缓', description: '先攻检定劣势' },
      { name: '畏惧火焰', description: '受到火焰伤害时士气崩溃' }
    ],
    
    loot: [
      { item: '灾厄结晶', chance: 0.3, value: 20 },
      { item: '破损装备', chance: 0.6, value: 8 }
    ],
    
    description: '被灾厄感染的人类，失去理智但保留战斗本能。',
    appearance: '皮肤灰白腐烂，双眼浑浊，动作僵硬但充满攻击性。',
    behavior: 'simple'
  },
  
  '灰烬蛛': {
    id: 'ashspider',
    name: '灰烬蛛',
    threatLevel: '中',
    type: '变异生物',
    region: '灰烬森林/洞穴',
    
    abilities: [
      {
        name: '毒刺',
        description: '命中后目标需体质豁免（DC12），失败额外1d6毒伤',
        effect: 'poison_sting'
      },
      {
        name: '结网',
        description: '可以释放蛛网困住目标（力量DC13挣脱）',
        effect: 'web'
      }
    ],
    
    weaknesses: [
      { name: '畏火', description: '火焰伤害+2' }
    ],
    
    loot: [
      { item: '蛛网丝', chance: 0.8, value: 12 },
      { item: '毒腺', chance: 0.6, value: 15 }
    ],
    
    description: '巨大的变异蜘蛛，栖息于灰烬森林的洞穴中。',
    appearance: '体型如小狗，腹部灰白，八条腿布满焦黑斑点。',
    behavior: 'ambush'
  },
  
  '嗜血掠食者': {
    id: 'bloodthirstypredator',
    name: '嗜血掠食者',
    threatLevel: '中',
    type: '变异生物',
    region: '荒野/废土',
    
    abilities: [
      {
        name: '狂暴突进',
        description: '击杀目标后可立即对另一目标发起攻击',
        effect: 'rampage'
      },
      {
        name: '嗜血撕咬',
        description: 'HP低于50%时攻击获优势',
        effect: 'bloodlust'
      }
    ],
    
    weaknesses: [
      { name: '狂暴易激', description: '智力检定劣势' }
    ],
    
    loot: [
      { item: '掠食者毛皮', chance: 0.7, value: 18 },
      { item: '尖牙', chance: 0.6, value: 10 }
    ],
    
    description: '凶残的类人掠食者，以狩猎和杀戮为乐。',
    appearance: '弓背行走，獠牙外露，眼中闪烁嗜血的光芒。',
    behavior: 'aggressive'
  },
  
  '废土暴徒': {
    id: 'wastelandbrute',
    name: '废土暴徒',
    threatLevel: '中高',
    type: '变异生物',
    region: '废墟/废土',
    
    abilities: [
      {
        name: '强力打击',
        description: '重击时伤害骰额外+1d10',
        effect: 'brutal_strike'
      }
    ],
    
    weaknesses: [
      { name: '愚笨', description: '智力检定劣势，易被欺骗' }
    ],
    
    loot: [
      { item: '巨棒', chance: 0.8, value: 20 },
      { item: '厚皮', chance: 0.6, value: 15 }
    ],
    
    description: '体型巨大的暴徒，力大无穷但智力低下。',
    appearance: '身高近三米，肌肉虬结，手持巨大木棒。',
    behavior: 'simple'
  },
  
  '废土巨兽': {
    id: 'wastelandbehemoth',
    name: '废土巨兽',
    threatLevel: '高',
    type: '变异生物',
    region: '荒野/废土',
    
    abilities: [
      {
        name: '狂暴冲撞',
        description: '冲锋攻击命中后目标需力量豁免（DC14），失败击倒',
        effect: 'charge'
      },
      {
        name: '巨力震地',
        description: '可以震碎周围地面，5英尺内所有目标需敏捷豁免',
        effect: 'ground_slam'
      }
    ],
    
    weaknesses: [
      { name: '行动笨拙', description: '敏捷检定劣势' }
    ],
    
    loot: [
      { item: '巨兽角', chance: 0.9, value: 35 },
      { item: '厚皮', chance: 0.8, value: 25 }
    ],
    
    description: '废土中罕见的巨型生物，领域性极强。',
    appearance: '巨大如牛，头顶双角，全身覆盖厚重皮层。',
    behavior: 'aggressive'
  },
  
  '再生魔物': {
    id: 'regenerator',
    name: '再生魔物',
    threatLevel: '高',
    type: '异常生物',
    region: '魔法荒原/深渊裂隙',
    
    abilities: [
      {
        name: '快速再生',
        description: '每回合恢复5HP',
        effect: 'regeneration'
      },
      {
        name: '多重攻击',
        description: '可以进行两次攻击',
        effect: 'multiattack'
      }
    ],
    
    weaknesses: [
      { name: '弱点火焰', description: '受到火焰伤害的回合无法再生' },
      { name: '弱点强酸', description: '受到强酸伤害的回合无法再生' }
    ],
    
    loot: [
      { item: '再生组织', chance: 0.8, value: 40 },
      { item: '魔物血液', chance: 0.7, value: 30 }
    ],
    
    description: '可怕的魔物，拥有惊人的再生能力。',
    appearance: '皮肤呈灰绿色，伤口会快速愈合，散发腐臭。',
    behavior: 'aggressive'
  },
  
  '灾厄幽灵': {
    id: 'calamitywraith',
    name: '灾厄幽灵',
    threatLevel: '高',
    type: '异常生物',
    region: '旧王城废墟/魔法荒原',
    
    abilities: [
      {
        name: '虚体',
        description: '物理伤害减半',
        effect: 'incorporeal'
      },
      {
        name: '生命汲取',
        description: '造成伤害的一半转化为自身HP',
        effect: 'life_drain'
      },
      {
        name: '黑暗缠绕',
        description: '目标视野受限，攻击检定劣势',
        effect: 'darkness'
      }
    ],
    
    weaknesses: [
      { name: '阳光敏感', description: '日光下攻击和防御劣势' },
      { name: '神圣易伤', description: '受到神圣伤害时额外+4' }
    ],
    
    loot: [
      { item: '灵魂碎片', chance: 0.6, value: 50 },
      { item: '灾厄精华', chance: 0.4, value: 60 }
    ],
    
    description: '灾厄中诞生的幽魂，吞噬生命维持存在。',
    appearance: '半透明的人形轮廓，周身缠绕黑雾，眼眶空洞。',
    behavior: 'ethereal'
  },
  
  '灾厄龙蜥': {
    id: 'calamitydragon',
    name: '灾厄龙蜥',
    threatLevel: '极高',
    type: '异常生物',
    region: '深渊裂隙/灾厄核心',
    
    abilities: [
      {
        name: '灾厄吐息',
        description: '锥形范围，DC15敏捷豁免，失败3d8伤害',
        effect: 'breath_weapon'
      },
      {
        name: '厚鳞护甲',
        description: '非魔法武器伤害-2',
        effect: 'scaled_armor'
      },
      {
        name: '恐惧光环',
        description: '首次遭遇需通过意志豁免（DC13），失败恐惧',
        effect: 'fear_aura'
      }
    ],
    
    weaknesses: [
      { name: '弱点腹部', description: '攻击腹部时伤害+4' }
    ],
    
    loot: [
      { item: '龙蜥鳞片', chance: 1.0, value: 100 },
      { item: '龙心结晶', chance: 0.8, value: 150 },
      { item: '龙骨', chance: 0.6, value: 120 }
    ],
    
    description: '灾厄中诞生的最强大生物，拥有龙的力量。',
    appearance: '体长五米，鳞片漆黑泛紫光，双眼如燃烧的火焰。',
    behavior: 'boss'
  }
};

// ==================== 工具函数 ====================

/**
 * 生成唯一ID
 */
function generateId() {
  return `creature_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 解析伤害表达式
 * @param {string} damageStr - 伤害表达式（如 "1d8", "1d12+4"）
 * @returns {Object} { diceCount, diceSize, bonus }
 */
function parseDamage(damageStr) {
  const match = damageStr.match(/(\d+)d(\d+)([+-]\d+)?/);
  if (!match) {
    throw new Error(`无效的伤害表达式: ${damageStr}`);
  }
  
  return {
    diceCount: parseInt(match[1]),
    diceSize: parseInt(match[2]),
    bonus: match[3] ? parseInt(match[3]) : 0
  };
}

// ==================== 核心函数 ====================

/**
 * 从模板创建生物实例
 * @param {string} templateName - 模板名称
 * @returns {Object} 生物实例
 */
export function createCreature(templateName) {
  const template = CREATURE_TEMPLATES[templateName];
  if (!template) {
    throw new Error(`未知的生物模板: ${templateName}`);
  }
  
  const stats = THREAT_LEVELS[template.threatLevel];
  
  return {
    id: generateId(),
    templateId: template.id,
    templateName: templateName,
    name: template.name,
    type: template.type,
    region: template.region,
    threatLevel: template.threatLevel,
    
    // 战斗属性
    ac: stats.ac,
    hp: {
      current: stats.hp,
      max: stats.hp
    },
    damage: stats.damage,
    attackBonus: stats.attackBonus,
    
    // 状态
    isAlive: true,
    conditions: [],
    
    // 能力
    abilities: template.abilities || [],
    weaknesses: template.weaknesses || [],
    
    // 战利品
    loot: template.loot || [],
    
    // 描述
    description: template.description,
    appearance: template.appearance,
    behavior: template.behavior || 'simple'
  };
}

/**
 * 生物攻击
 * @param {Object} creature - 生物实例
 * @param {number} targetAC - 目标AC
 * @param {boolean} hasAdvantage - 是否有优势
 * @param {boolean} hasDisadvantage - 是否有劣势
 * @returns {Object} 攻击结果
 */
export function creatureAttack(creature, targetAC, hasAdvantage = false, hasDisadvantage = false) {
  if (!creature.isAlive) {
    return {
      hit: false,
      message: `${creature.name}已死亡，无法攻击`
    };
  }
  
  // 命中检定
  let roll = getDice('d20').value;
  
  // 优势/劣势
  if (hasAdvantage && !hasDisadvantage) {
    const roll2 = getDice('d20').value;
    roll = Math.max(roll, roll2);
    console.log(`${creature.name}攻击时有优势（${roll}/${roll2}）`);
  } else if (hasDisadvantage && !hasAdvantage) {
    const roll2 = getDice('d20').value;
    roll = Math.min(roll, roll2);
    console.log(`${creature.name}攻击时有劣势（${roll}/${roll2}）`);
  }
  
  const total = roll + creature.attackBonus;
  const crit = roll === 20;
  const critFail = roll === 1;
  const hit = (total >= targetAC && !critFail) || crit;
  
  let damage = 0;
  if (hit) {
    // 掷伤害
    const dmg = parseDamage(creature.damage);
    for (let i = 0; i < dmg.diceCount; i++) {
      damage += getDice(`d${dmg.diceSize}`).value;
    }
    damage += dmg.bonus;
    
    // 重击伤害翻倍
    if (crit) {
      damage *= 2;
      console.log(`💥 ${creature.name}重击！伤害翻倍！`);
    }
  }
  
  return {
    hit,
    crit,
    critFail,
    roll,
    total,
    damage,
    attackBonus: creature.attackBonus,
    targetAC,
    creature: creature.name
  };
}

/**
 * 生物受到伤害
 * @param {Object} creature - 生物实例
 * @param {number} damage - 伤害值
 */
export function damageCreature(creature, damage) {
  if (!creature.isAlive) {
    console.log(`${creature.name}已死亡`);
    return;
  }
  
  const oldHP = creature.hp.current;
  creature.hp.current = Math.max(0, creature.hp.current - damage);
  
  console.log(`${creature.name}受到${damage}点伤害（${oldHP} → ${creature.hp.current}）`);
  
  if (creature.hp.current === 0) {
    creature.isAlive = false;
    console.log(`💀 ${creature.name}被击败！`);
  }
}

/**
 * 治疗生物
 * @param {Object} creature - 生物实例
 * @param {number} amount - 治疗量
 */
export function healCreature(creature, amount) {
  if (!creature.isAlive) {
    console.log(`${creature.name}已死亡，无法治疗`);
    return;
  }
  
  const oldHP = creature.hp.current;
  creature.hp.current = Math.min(creature.hp.max, creature.hp.current + amount);
  
  console.log(`${creature.name}恢复${amount}点生命（${oldHP} → ${creature.hp.current}）`);
}

/**
 * 生物死亡掉落战利品
 * @param {Object} creature - 生物实例
 * @returns {Object} 战利品信息
 */
export function dropLoot(creature) {
  if (creature.isAlive) {
    console.log(`${creature.name}还活着，无法掉落战利品`);
    return null;
  }
  
  const drops = [];
  
  // 掷战利品
  creature.loot.forEach(lootEntry => {
    const roll = Math.random();
    if (roll < lootEntry.chance) {
      drops.push({
        item: lootEntry.item,
        value: lootEntry.value || 0
      });
    }
  });
  
  // 计算经验值
  const stats = THREAT_LEVELS[creature.threatLevel];
  const exp = Math.floor(
    stats.exp[0] + Math.random() * (stats.exp[1] - stats.exp[0])
  );
  
  // 计算金币（经验值 / 5）
  const gold = Math.floor(exp / 5);
  
  console.log(`${creature.name}掉落: ${drops.length}件物品, ${exp}经验, ${gold}金币`);
  
  return {
    items: drops,
    exp: exp,
    gold: gold,
    creature: creature.name
  };
}

/**
 * 获取所有生物模板
 * @returns {Object} 生物模板
 */
export function getAllCreatureTemplates() {
  return CREATURE_TEMPLATES;
}

/**
 * 获取生物模板
 * @param {string} templateName - 模板名称
 * @returns {Object} 模板数据
 */
export function getCreatureTemplate(templateName) {
  return CREATURE_TEMPLATES[templateName];
}

/**
 * 获取威胁等级数据
 * @param {string} level - 威胁等级
 * @returns {Object} 等级数据
 */
export function getThreatLevel(level) {
  return THREAT_LEVELS[level];
}

// ==================== 导出 ====================

export default {
  // 创建
  createCreature,
  
  // 战斗
  creatureAttack,
  damageCreature,
  healCreature,
  
  // 战利品
  dropLoot,
  
  // 查询
  getAllCreatureTemplates,
  getCreatureTemplate,
  getThreatLevel,
  
  // 常量
  CREATURE_TEMPLATES,
  THREAT_LEVELS
};
