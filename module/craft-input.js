/**
 * craft-input.js - 锻造/修理/改装意图解析 + 结算合并（纯函数接线件，无自身副作用）
 *
 * 自然语言锻造入口（index.html 主循环消费），沿用 travel-input.js 的事务语义：
 *   1. parseCraftIntent(message, gd)
 *      四个动词族互斥解析：锻造（打造装备）/ 修理（瑕疵装备）/ 改装（加装改装件）/ 拆卸。
 *      目标门：装备模板名（世界书名，最长匹配）/ 改装件名 / 可修目标存在性。
 *   2. settleCraft(gdClone, intent)
 *      在 gd 克隆上执行锻造系统结算：
 *      - forge: createWeapon/createArmor 出一阶模板 → craftEquipment（自锻成本=基准价÷2，
 *        DC10，工具从背包派生）→ 成品/瑕疵品入克隆背包；良品/杰出按品质档生成词缀
 *      - repair: repairEquipment（原 DC+2）
 *      - install: 先扣改装件价（失败=材料消耗）→ installMod（自装检定，失败不毁装备）
 *      - remove: removeMod（自拆 DC10 失败改装件损毁；消息含「铁匠/代拆」走代拆 1 金保成功）
 *   3. buildCraftPromptBlock(result)
 *      把结算结果转成注入 prompt 的系统块（按四个动词族各有一套叙事指令）。
 *   4. applyCraftSettlement(finalGd, settledClone)
 *      AI 回复成功后把克隆上的 inventory / currency / equipment 合并进最终 gameData。
 *
 * 权威分工：成本/DC/检定/槽位/混装全部由引擎判定；稀有材料锻造（二阶+）暂未开放，
 * 接线件固定一阶材料档（DC10），词缀词条数按锻造分档映射品质档。
 */

import equipmentData from './equipment-system.js';
import { forgingSystem, WEAPON_MODS, ARMOR_MODS } from './forging-system.js';
import { affixSystem } from './affix-system.js';

// 四个动词族（互斥；forge 族须再过模板名门）
const FORGE_VERBS = ['锻造', '打造', '打一把', '打一件', '打把', '做一把', '做把', '手工制作'];
// 稀有/传说材料词（世界书：零售价另计，不套 ÷2）——接线件暂未开放二阶+材料档锻造
const RARE_MATERIAL_WORDS = ['秘银', '精铁', '黑曜铁', '血晶石', '星铁', '银矿', '龙骨'];
const REPAIR_VERBS = ['修理', '修复', '修补'];
const INSTALL_VERBS = ['改装', '加装', '安装'];
const REMOVE_VERBS = ['拆卸', '拆除'];

// 锻造分档 → 词缀品质档（词条数：普通 1 / 罕见 2 / 史诗 3，见词缀表「装备品质决定词条数」）
const GRADE_TO_QUALITY = { 1: '普通', 2: '罕见', 3: '史诗' };

/**
 * 世界书名 → 引擎模板名 反查表（equipmentContract.mapping 引擎名→世界书名 的逆向）
 */
function reverseMapping() {
  const ec = (typeof window !== 'undefined' && window.equipmentContract) || null;
  const rev = {};
  if (!ec || !ec.mapping) return rev;
  for (const group of ['weapons', 'armors']) {
    for (const [engineName, worldName] of Object.entries(ec.mapping[group] || {})) {
      rev[worldName] = engineName;
    }
  }
  return rev;
}

/**
 * 全部可锻造目标：世界书显示名（契约键）→ { engineName, kind:'weapon'|'armor' }
 * 契约 weapons/armors 键 = 世界书名；引擎模板键 = 映射逆向（自映射条目同名）
 */
function craftableTemplates() {
  const ec = (typeof window !== 'undefined' && window.equipmentContract) || null;
  const rev = reverseMapping();
  const out = {};
  const skipped = (ec && ec.skipped) || [];
  const groups = [['weapons', 'weapon'], ['armors', 'armor']];
  for (const [group, kind] of groups) {
    const worldNames = ec && ec[group] ? Object.keys(ec[group]) : [];
    for (const worldName of worldNames) {
      if (skipped.indexOf(worldName) !== -1) continue;  // 局部防护件（手套/护腿/肩甲/铁靴）无引擎模板
      out[worldName] = { engineName: rev[worldName] || worldName, kind };
    }
  }
  return out;
}

/**
 * 从既有装备实例反解世界书名（剥离材料名前缀 → 引擎模板名 → 映射）
 */
function resolveWorldName(item) {
  if (!item) return '';
  if (item.worldName) return item.worldName;
  const ec = (typeof window !== 'undefined' && window.equipmentContract) || null;
  const matLen = (item.material && item.material.name ? item.material.name : '').length;
  const engineName = matLen ? item.name.slice(matLen) : item.name;
  if (!ec || !ec.mapping) return engineName;
  const fwd = (item.type === 'armor' || item.armor) ? ec.mapping.armors : ec.mapping.weapons;
  return (fwd && fwd[engineName]) || engineName;
}

/**
 * 最长匹配工具：从 candidates（数组）里挑消息命中的最长项
 * 误触发收紧：命中名词紧邻前缀为「的」（所属格叙事，如"父亲的铁剑"）→ 返回 null；
 * 命中位置落在引号内（「」/“”）或整句为疑问句 → 返回 null。
 */
function longestMatch(msg, candidates) {
  const hits = [];
  for (const c of candidates) {
    const idx = msg.indexOf(c);
    if (idx === -1) continue;
    if (idx > 0 && msg[idx - 1] === '的') continue;
    if (isInsideQuotes(msg, idx)) continue;
    hits.push(c);
  }
  if (hits.length === 0) return null;
  const longest = hits.reduce((a, b) => (b.length > a.length ? b : a));
  return hits.every((c) => longest.indexOf(c) !== -1) ? longest : undefined; // undefined = 歧义
}

function isInsideQuotes(msg, idx) {
  for (const q of [['「', '」'], ['“', '”'], ['"', '"']]) {
    const open = msg.lastIndexOf(q[0], idx);
    if (open === -1) continue;
    const close = msg.indexOf(q[1], open + 1);
    if (close !== -1 && idx < close) return true;
  }
  return false;
}

function isQuestion(msg) {
  return /[？?]\s*$/.test(msg.trim()) || /要不要|能否|可以吗|是不是/.test(msg);
}

/**
 * 解析锻造/修理/改装/拆卸意图
 * @returns {{intent:false, reason:string}|{intent:true, family:'forge'|'repair'|'install'|'remove', ...}}
 */
export function parseCraftIntent(message, gd) {
  const msg = String(message || '');
  if (!msg.trim()) return { intent: false, reason: 'empty' };

  const hasForge = FORGE_VERBS.some((v) => msg.indexOf(v) !== -1);
  const hasRepair = REPAIR_VERBS.some((v) => msg.indexOf(v) !== -1);
  const hasInstall = INSTALL_VERBS.some((v) => msg.indexOf(v) !== -1);
  const hasRemove = REMOVE_VERBS.some((v) => msg.indexOf(v) !== -1);
  const verbCount = [hasForge, hasRepair, hasInstall, hasRemove].filter(Boolean).length;
  if (verbCount === 0) return { intent: false, reason: 'no-verb' };
  if (verbCount > 1) return { intent: false, reason: 'ambiguous' };
  // 疑问句/提议句（"要不要给你的剑加装…？"）是叙事或提议而非执行指令
  if (isQuestion(msg)) return { intent: false, reason: 'question' };
  // 完成时叙事（"父亲手工打造的铁剑"）是背景描述而非锻造指令
  if (/[锻打]造[了过]?的/.test(msg)) return { intent: false, reason: 'narrative' };

  if (hasForge) {
    const rare = RARE_MATERIAL_WORDS.find((w) => msg.indexOf(w) !== -1);
    if (rare) return { intent: true, family: 'forge', rareUnsupported: rare };
    const templates = craftableTemplates();
    const name = longestMatch(msg, Object.keys(templates));
    if (name === null) return { intent: false, reason: 'no-template' };
    if (name === undefined) return { intent: false, reason: 'ambiguous' };
    return { intent: true, family: 'forge', displayName: name, ...templates[name] };
  }

  if (hasRepair) {
    const target = findRepairable(gd);
    if (!target) return { intent: false, reason: 'no-repairable' };
    return { intent: true, family: 'repair', rawMessage: msg };
  }

  // 改装/拆卸共用改装件名门
  const modName = longestMatch(msg, [...Object.keys(WEAPON_MODS), ...Object.keys(ARMOR_MODS)]);
  if (modName === null) return { intent: false, reason: 'no-mod' };
  if (modName === undefined) return { intent: false, reason: 'ambiguous' };

  if (hasInstall) return { intent: true, family: 'install', modName };
  return { intent: true, family: 'remove', modName, rawMessage: msg };
}

/**
 * 找可修目标（全部装备槽优先，其次背包）：瑕疵且可修复的装备
 * @param {Object} gd - gameData
 * @param {string} [nameHint] - 玩家点名的装备名（世界书名/物品名包含匹配），不点名取第一个
 */
function findRepairable(gd, nameHint, ref) {
  const eq = gd.equipment || {};
  // 精确定位（UI 面板传入槽位/物品 id）：优先按槽位，其次背包按 id
  if (ref && ref.slot && eq[ref.slot]) {
    const it = eq[ref.slot];
    if (it.repairable && it.flaw && (!ref.itemId || it.id === ref.itemId)) return it;
  }
  if (ref && ref.itemId) {
    const inv = (gd.inventory || []).find((i) => i && i.id === ref.itemId && i.repairable && i.flaw);
    if (inv) return inv;
  }
  const slots = ['mainHand', 'offHand', 'body', 'head', 'hands', 'legs', 'feet', 'shoulders', 'accessory1', 'accessory2']
    .map((k) => eq[k]).filter(Boolean);
  const pool = slots.concat((gd.inventory || []).filter(Boolean));
  const flawed = pool.filter((i) => i.repairable && i.flaw);
  if (!nameHint) return flawed[0] || null;
  return flawed.find((i) => i.name.indexOf(nameHint) !== -1 || resolveWorldName(i).indexOf(nameHint) !== -1) || null;
}

/**
 * 改装件适用判定（install 槽位搜索与面板渲染共用的口径）
 */
function modApplies(mod, item) {
  const wn = item.worldName || resolveWorldName(item);
  return mod.applyTo.some((t) =>
    item.name.indexOf(t) !== -1 || String(wn).indexOf(t) !== -1 ||
    String(item.type || '').indexOf(t) !== -1 ||
    (mod.applyTo.indexOf('任意护甲') !== -1 && item.type === 'armor') ||
    (mod.applyTo.indexOf('任意近战武器') !== -1 && item.type === 'weapon' && !(item.weapon && item.weapon.ranged)));
}

/**
 * 在 gd 克隆上执行锻造系统结算
 * @param {Object} gdClone - 深拷贝的 gameData
 * @param {Object} intent - parseCraftIntent 返回值（intent:true 分支）
 * @returns {Object} 结算结果 {family, phase:'precheck'|'craft'|'repair'|'install'|'remove', ...}
 */
export function settleCraft(gdClone, intent) {
  const { family } = intent;

  if (family === 'forge') {
    if (intent.rareUnsupported) {
      return { family, phase: 'precheck', success: false, reason: 'rare-unsupported', material: intent.rareUnsupported };
    }
    // 一阶材料档模板实例（稀有材料锻造暂未开放，固定 tier 1 / DC10）
    const instance = intent.kind === 'armor'
      ? equipmentData.createArmor(intent.engineName, 1)
      : equipmentData.createWeapon(intent.engineName, 1);
    instance.worldName = intent.displayName;
    instance.basePrice = instance.price;  // craftEquipment 读 basePrice（实例字段名是 price）
    const toolType = intent.displayName === '法杖' ? '炼金工具' : '铁匠工具';
    const craft = forgingSystem.craftEquipment(gdClone, {
      equipment: instance,
      materials: {},
      dc: 10,
      toolType
    });
    if (craft.checkResult && craft.checkResult.gradeLevel >= 2) {
      // 良品/杰出：按品质档生成词缀并挂到成品（词条数 2/3，主题按材料，杰出追加二级池）
      const qualityName = GRADE_TO_QUALITY[craft.checkResult.gradeLevel];
      const affixes = affixSystem.generateAffixes(
        (instance.material && instance.material.name) || '铁',
        qualityName,
        intent.kind === 'armor' ? '护甲' : '武器',
        { grade: craft.checkResult.grade }
      );
      affixSystem.applyAffixesToEquipment(craft.equipment, affixes);
      craft.affixes = affixes;
    }
    if (craft.success || craft.equipment) {
      gdClone.inventory.push(Object.assign({}, craft.equipment, { amount: 1 }));
    }
    return Object.assign({ family, phase: 'craft', displayName: intent.displayName }, craft);
  }

  if (family === 'repair') {
    const target = findRepairable(gdClone, intent.displayName, { slot: intent.slot, itemId: intent.itemId });
    if (!target) return { family, phase: 'precheck', success: false, reason: 'no-repairable' };
    const toolType = resolveWorldName(target) === '法杖' ? '炼金工具' : '铁匠工具';
    const result = forgingSystem.repairEquipment(gdClone, target, toolType);
    return Object.assign({ family, phase: 'repair', targetName: target.name }, result);
  }

  if (family === 'install') {
    const mod = WEAPON_MODS[intent.modName] || ARMOR_MODS[intent.modName];
    // 目标：UI 传 slot 时精确定位（不适用即拒绝，不回落）；否则全装备槽第一件适用装备
    const eq = gdClone.equipment || {};
    const slotKeys = ['mainHand', 'offHand', 'body', 'head', 'hands', 'legs', 'feet', 'shoulders', 'accessory1', 'accessory2'];
    let target = null;
    if (intent.slot) {
      const it = eq[intent.slot];
      if (!it) return { family, phase: 'precheck', success: false, reason: 'no-target', modName: intent.modName };
      it.worldName = resolveWorldName(it);
      if (!modApplies(mod, it)) {
        return { family, phase: 'precheck', success: false, reason: 'not-applicable-slot', modName: intent.modName, slot: intent.slot };
      }
      target = it;
    }
    if (!target) {
      for (const k of slotKeys) {
        const item = eq[k];
        if (!item) continue;
        item.worldName = resolveWorldName(item);
        if (modApplies(mod, item)) { target = item; break; }
      }
    }
    if (!target) {
      return { family, phase: 'precheck', success: false, reason: 'no-target', modName: intent.modName };
    }
    const gold = (gdClone.currency && gdClone.currency.gold) || 0;
    if (gold < mod.price) {
      return { family, phase: 'precheck', success: false, reason: 'gold', modName: intent.modName, required: mod.price };
    }
    const toolType = target.worldName === '法杖' ? '炼金工具' : '铁匠工具';
    const result = forgingSystem.installMod(gdClone, target, intent.modName, { toolType });
    // 扣费口径：只有当引擎进入检定（成功安装或检定失败=改装件材料消耗）才扣费；
    // 结构性拒绝（槽位满/混装/不适用，result.error）不扣——世界书「失败不毁装备，改装件材料消耗」仅指检定失败
    if (!result.error) {
      gdClone.currency.gold = gold - mod.price;
      result.cost = mod.price;
    }
    return Object.assign({ family, phase: 'install', targetName: target.name, modName: intent.modName }, result);
  }

  // remove：UI 传 slot 时精确定位该槽；否则扫全槽找装着该改装件的装备
  const modName = intent.modName;
  const eq = gdClone.equipment || {};
  const slotKeys = ['mainHand', 'offHand', 'body', 'head', 'hands', 'legs', 'feet', 'shoulders', 'accessory1', 'accessory2'];
  const trySlots = intent.slot ? [intent.slot] : slotKeys;
  for (const k of trySlots) {
    const target = eq[k];
    if (!target || !Array.isArray(target.mods)) continue;
    const idx = target.mods.findIndex((m) => m && m.name === modName);
    if (idx !== -1) {
      const byBlacksmith = /铁匠|代拆/.test(intent.rawMessage || '');
      const toolType = resolveWorldName(target) === '法杖' ? '炼金工具' : '铁匠工具';
      const result = forgingSystem.removeMod(gdClone, target, idx, byBlacksmith, toolType);
      return Object.assign({ family, phase: 'remove', targetName: target.name, modName }, result);
    }
  }
  return { family, phase: 'precheck', success: false, reason: 'mod-not-found', modName };
}

/**
 * 构造注入 prompt 的锻造系统块
 * @returns {string} 系统块文本（空串=不注入）
 */
export function buildCraftPromptBlock(result) {
  if (!result) return '';
  const checkLine = result.checkResult
    ? '锻造检定 d20=' + result.checkResult.roll + ' vs DC' + result.checkResult.dc + '，总计 ' + result.checkResult.total + '（' + result.checkResult.grade + '）'
    : '';

  if (result.phase === 'precheck') {
    const reasons = {
      'rare-unsupported': '稀有/传说材料锻造（' + (result.material || '') + ' 等）按「锻造规则」需按零售价另计，本系统暂未开放——只能购买成品或委托铁匠代工。',
      'no-repairable': '没有需要修复的瑕疵装备。',
      'no-target': result.modName
        ? '身上没有可安装「' + result.modName + '」的目标（武器改装件装主手、护甲改装件装身体护甲）。'
        : '身上没有可改装的目标。',
      'gold': result.required ? '金币不足（改装件需 ' + result.required + ' 金）。' : '金币不足。',
      'mod-not-found': '身上没有任何装备安装着「' + result.modName + '」。'
    };
    return '【锻造结算·系统权威】玩家表达了锻造相关意图，但' + (reasons[result.reason] || '前置条件不满足。')
      + '叙事应体现无法进行的原因并引导补足条件；不得凭空产出装备或改装效果。';
  }

  if (result.phase === 'craft') {
    if (result.success) {
      const lines = [
        '【锻造结算·系统权威】玩家锻造「' + result.displayName + '」成功。' + checkLine + '，自锻成本 ' + result.materialCost + ' 金已扣。',
        '成品「' + result.equipment.name + '」已入背包。'
      ];
      if (result.affixes && result.affixes.length > 0) {
        lines.push('自然词条（按「词缀表」生成，已挂到装备）：' +
          result.affixes.map((a) => '「' + a.name + '」（' + a.status + '，' + a.strength + '强度，' + a.description + '）').join('、') + '。');
      }
      lines.push('按「锻造规则」叙事锻造过程（选料/锻打/淬火），装备属性与词条不得更改；命名按「装备命名规则」双轨制。');
      return lines.filter(Boolean).join('\n');
    }
    if (result.equipment && result.equipment.flaw) {
      return [
        '【锻造结算·系统权威】玩家锻造「' + result.displayName + '」失败。' + checkLine + '，自锻成本 ' + result.materialCost + ' 金已扣。',
        '产出瑕疵品「' + result.equipment.name + '」（瑕疵：' + result.equipment.flaw + '——' + result.equipment.flawEffect.narrative + '，机制：' + result.equipment.flawEffect.mechanic + '）已入背包，可按 DC+2 修复。',
        '按「锻造规则·失败后果」叙事瑕疵细节；不得改为成功。'
      ].join('\n');
    }
    if (result.error === '金币不足') {
      return '【锻造结算·系统权威】玩家想锻造「' + result.displayName + '」，但金币不足（自锻原材料需 ' + result.required + ' 金）。'
        + '叙事应体现凑不齐材料款而作罢；不得凭空锻造。';
    }
    return '【锻造结算·系统权威】玩家锻造「' + result.displayName + '」未能完成（' + (result.error || '前置不满足') + '）。'
      + '按未执行叙事；不得产出装备。';
  }

  if (result.phase === 'repair') {
    if (result.success) {
      return '【锻造结算·系统权威】玩家修复「' + result.targetName + '」成功。' + checkLine + '。'
        + '瑕疵已消除（品质回到普通），叙事修复过程（校正/补锻）；不得保留瑕疵。';
    }
    return '【锻造结算·系统权威】玩家修复「' + result.targetName + '」失败。' + checkLine + '。'
      + '瑕疵仍在（可再次尝试，DC+2），叙事修复未成；不得改为成功。';
  }

  if (result.phase === 'install') {
    const modEffect = (WEAPON_MODS[result.modName] || ARMOR_MODS[result.modName]).effect;
    if (result.success) {
      return '【锻造结算·系统权威】玩家在「' + result.targetName + '」上安装改装件「' + result.modName + '」成功（费用 ' + result.cost + ' 金已扣）。'
        + (checkLine ? checkLine + '。' : '')
        + '效果为「' + modEffect + '」，按「锻造规则·工艺改装件」叙事安装过程；效果不得更改。';
    }
    if (result.error) {
      return '【锻造结算·系统权威】玩家想在「' + result.targetName + '」上安装「' + result.modName + '」，但系统判定不可安装（' + result.error + '）。'
        + '未扣除任何费用，改装件与装备均完好；叙事安装未能进行的原因（同类已装/槽位已满/不适用）。';
    }
    return '【锻造结算·系统权威】玩家在「' + result.targetName + '」上安装「' + result.modName + '」失败。'
      + (checkLine ? checkLine + '。' : '') + '改装件材料已消耗（' + result.cost + ' 金），装备完好；不得改为成功。';
  }

  // remove
  if (result.success) {
    return '【锻造结算·系统权威】玩家从「' + result.targetName + '」拆卸「' + result.modName + '」'
      + (result.returnedMod && result.returnedMod.name ? '成功，改装件完好回收。' : '完成。')
      + '叙事拆卸过程；装备与改装件状态不得更改。';
  }
  if (result.error) {
    return '【锻造结算·系统权威】玩家想从「' + result.targetName + '」拆卸「' + result.modName + '」，但' + result.error + '。'
      + '改装件完好仍装在装备上；叙事未能拆卸的原因。';
  }
  return '【锻造结算·系统权威】玩家从「' + result.targetName + '」拆卸「' + result.modName + '」失败（自拆检定未过）。'
    + '改装件已损毁、装备完好；不得改为成功。';
}

/**
 * 合并锻造结算进最终 gameData（在 AI 命令应用之后调用，引擎权威覆盖）。
 * @returns {boolean} true=有结算需要落盘
 */
export function applyCraftSettlement(finalGd, settledClone) {
  if (!finalGd || !settledClone) return false;
  finalGd.inventory = (settledClone.inventory || []).slice();
  if (!finalGd.currency) finalGd.currency = {};
  finalGd.currency.gold = (settledClone.currency && settledClone.currency.gold) || 0;
  finalGd.equipment = settledClone.equipment || finalGd.equipment;
  return true;
}

/**
 * UI 辅助：可锻造模板清单（炼金/锻造面板用）——craftableTemplates 的导出包装
 */
export function listCraftableTemplates() {
  const ec = (typeof window !== 'undefined' && window.equipmentContract) || null;
  const out = craftableTemplates();
  return Object.entries(out).map(([displayName, t]) => {
    const entry = ec && ec[t.kind === 'armor' ? 'armors' : 'weapons'] ? ec[t.kind === 'armor' ? 'armors' : 'weapons'][displayName] : null;
    return { displayName, ...t, basePrice: (entry && entry.basePrice) || 0 };
  });
}

/**
 * UI 辅助：改装件目录（名称/效果/价格/DC/适用面/类别，锻造面板用）
 */
export function listCraftMods() {
  return [
    ...Object.entries(WEAPON_MODS).map(([name, m]) => ({ name, family: '武器', ...m })),
    ...Object.entries(ARMOR_MODS).map(([name, m]) => ({ name, family: '护甲', ...m }))
  ];
}
