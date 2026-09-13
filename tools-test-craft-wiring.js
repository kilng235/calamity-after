// 系统接线测试（Node）：采集/炼金/施法意图门 + 引擎结算 + 事务合并
// 模式先例：travel-input.js 三重门 → 引擎权威结算（落克隆）→ 块注入 → 合并落盘
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

globalThis.window = globalThis;
globalThis.addEventListener = globalThis.addEventListener || function () {};
globalThis.removeEventListener = globalThis.removeEventListener || function () {};
globalThis.localStorage = {
  _s: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
  setItem(k, v) { this._s[k] = String(v); },
  removeItem(k) { delete this._s[k]; }
};

// 契约先于引擎加载（模拟 index.html 脚本顺序）
new Function(fs.readFileSync(path.join(ROOT, 'module/numeric-contract.js'), 'utf8'))();
new Function(fs.readFileSync(path.join(ROOT, 'module/status-contract.js'), 'utf8'))();
new Function(fs.readFileSync(path.join(ROOT, 'module/equipment-contract.js'), 'utf8'))();
new Function(fs.readFileSync(path.join(ROOT, 'module/command-engine.js'), 'utf8'))();
new Function(fs.readFileSync(path.join(ROOT, 'module/command-processor.js'), 'utf8'))();
const processor = window.commandProcessor;

async function main() {
let pass = 0, fail = 0;
const check = (n, c) => { c ? pass++ : fail++; console.log((c ? '✅' : '❌') + ' ' + n); };

const base = () => ({
  character: { name: '凛夏', level: 1, exp: 0, mp: 0 },
  hp: { current: 60, max: 100 },
  attributes: { 力量: 10, 敏捷: 10, 体质: 10, 感知: 10, 智力: 14, 魅力: 10 },
  equipment: { mainHand: null, offHand: null, body: null },
  inventory: [],
  currency: { gold: 20 },
  conditions: {},
  skills: [],
  spells: [],
  gameTime: { year: 300, month: 11, day: 12, hour: 7, minute: 10 },
  gatherCooldowns: {},
  progress: { currentLocation: '灰烬森林', currentPlace: '' }
});

const clone = (gd) => JSON.parse(JSON.stringify(gd));

// ---------- 采集接线 ----------
const gatherMod = await import('./module/gather-input.js');
const matMod = await import('./module/material-system.js');

// G1. 动词门：无动词不触发
check('G1. 采集意图：无动词不触发',
  gatherMod.parseGatherIntent('看看四周', base()).reason === 'no-verb');

// G2. 地点门：当前地在采集区 → 触发并映射到表 key
const gd1 = base();  // progress.currentLocation = '灰烬森林'
const g2 = gatherMod.parseGatherIntent('我在附近采集一些草药', gd1);
check('G2. 采集意图：当前地灰烬森林 + 动词 → 触发（地理/灰烬森林）',
  g2.intent === true && g2.locationKey === '地理/灰烬森林');

// G3. 地点门：锈钉镇别名映射（键名跟随 ee710f0 地名统一）
const gdTown = base();
gdTown.progress.currentLocation = '锈钉镇';
const g3 = gatherMod.parseGatherIntent('在镇子附近采集点材料', gdTown);
check('G3. 采集意图：锈钉镇别名 → 地理/锈钉镇',
  g3.intent === true && g3.locationKey === '地理/锈钉镇');

// G4. 地点门：明示其他采集区（不在当前地）→ 不触发
const g4 = gatherMod.parseGatherIntent('去深渊裂隙采集黑曜石', gd1);
check('G4. 采集意图：明示非当前地 → 不触发（wrong-location）',
  g4.intent === false && g4.reason === 'wrong-location');

// G5. 地点门：歧义（同时提及两个采集区）→ 不触发
const g5 = gatherMod.parseGatherIntent('去灰烬森林和魔法荒原采集', gd1);
check('G5. 采集意图：两区域歧义 → 不触发', g5.intent === false && g5.reason === 'ambiguous');

// G6. 非采集区当前地 → 不触发
const gdRuins = base();
gdRuins.progress.currentLocation = '旧王城废墟';
check('G6. 采集意图：当前地无采集表 → 不触发',
  gatherMod.parseGatherIntent('采集一些材料', gdRuins).reason === 'no-location');

// G7. 采集结算：产出入背包 + 冷却记录 + 二连失败
const gdG = base();
const settledG = clone(gdG);
const g7 = gatherMod.settleGather(settledG, '地理/灰烬森林');
check('G7. 采集结算：成功产出入克隆背包 + 冷却写入',
  g7.success === true && settledG.inventory.length > 0 &&
  Object.keys(settledG.gatherCooldowns).includes('地理/灰烬森林'));
const g7b = gatherMod.settleGather(clone(settledG), '地理/灰烬森林');
check('G7b. 采集冷却：立即再采失败（cooldownRemaining > 0）',
  g7b.success === false && g7b.cooldownRemaining > 0);

// G8. 采集注入块：成功块含产出与权威声明；冷却块含引导
const g8a = gatherMod.buildGatherPromptBlock(g7);
const g8b = gatherMod.buildGatherPromptBlock(g7b);
check('G8. 采集块：成功块含【采集结算·系统权威】+冷却块含尚未刷新',
  g8a.indexOf('【采集结算·系统权威】') !== -1 && g8a.indexOf('不得增减产出') !== -1 &&
  g8b.indexOf('尚未刷新') !== -1);

// G9. 采集合并：inventory/gatherCooldowns 落到 finalGd
const finalGd9 = base();
check('G9. 采集合并：产出与冷却落进最终 gameData',
  gatherMod.applyGatherSettlement(finalGd9, settledG) === true &&
  finalGd9.inventory.length > 0 &&
  Object.keys(finalGd9.gatherCooldowns).length > 0);

// ---------- 炼金接线 ----------
const alchMod = await import('./module/alchemy-system.js');
const brewMod = await import('./module/alchemy-input.js');

// B1. 动词门 + 全名最长匹配（强效治疗药水 优先于子串 治疗药水）
const b1 = brewMod.parseBrewIntent('我来炼制强效治疗药水', base());
check('B1. 炼金意图：最长匹配 → 强效治疗药水',
  b1.intent === true && b1.recipeName === '强效治疗药水');

// B2. 歧义：一条消息同时点名两个配方（非包含关系）→ 不触发 + 候选清单
const b2 = brewMod.parseBrewIntent('帮我炼制中阶法力药水和传奇法力药水', base());
check('B2. 炼金意图：双配方歧义 → 不触发 + 候选清单',
  b2.intent === false && b2.reason === 'ambiguous' && b2.candidates.length === 2);

// B3. 无动词 / 无配方 不触发
check('B3. 炼金意图：无动词/无配方不触发',
  brewMod.parseBrewIntent('治疗药水来一瓶', base()).reason === 'no-verb' &&
  brewMod.parseBrewIntent('炼制一个不存在的东西', base()).reason === 'no-recipe');

// B4. 预检：无药剂炼制技能 → 结构化拒绝（材料金币不扣）
const gd4 = base();
gd4.currency.gold = 100;
const settled4 = clone(gd4);
const b4 = brewMod.settleBrew(settled4, '治疗药水');
check('B4. 炼金预检：无技能拒绝 + 零消耗',
  b4.phase === 'precheck' && b4.success === false && b4.reason === 'no-skill' &&
  settled4.currency.gold === 100 && settled4.inventory.length === 0);

// B5. 成功炼制：成品入克隆背包 + currency.gold 扣除（有技能+有工具+有材料）
const gd5 = base();
gd5.skills = [{ name: '药剂炼制', level: 1 }];
gd5.inventory = [
  { name: '炼金工具', amount: 1, type: '工具' },
  { name: '草药', amount: 10, type: '材料' },
  { name: '净化苔藓', amount: 10, type: '材料' }
];
const settled5 = clone(gd5);
// 强制天然 20：炼金检定走真实 d20，不 stub 会让 B5/B7/B8 随机假红（智力14+工具优势下失败率 ~12%）
const origRandom5 = Math.random;
Math.random = () => 0.999999;
let b5;
try { b5 = brewMod.settleBrew(settled5, '治疗药水'); } finally { Math.random = origRandom5; }
check('B5. 炼金结算：成品药水入背包（brewed+消耗品）+ 金币扣 3（currency.gold）',
  b5.success === true &&
  settled5.inventory.some(i => i.name === b5.potion.name && i.brewed === true && i.type === '消耗品') &&
  settled5.currency.gold === 20 - 3);

// B6. 材料不足：拒绝且金币不扣
const gd6 = base();
gd6.skills = [{ name: '药剂炼制', level: 1 }];
const settled6 = clone(gd6);
const b6 = brewMod.settleBrew(settled6, '治疗药水');
check('B6. 炼金结算：材料不足拒绝 + 金币不扣',
  b6.success === false && b6.error === '材料不足' && settled6.currency.gold === 20);

// B7. 炼金注入块：成功/预检/材料不足三形态
check('B7. 炼金块：三种形态均含权威声明与叙事指令',
  brewMod.buildAlchemyPromptBlock(b5).indexOf('【炼金结算·系统权威】') !== -1 &&
  brewMod.buildAlchemyPromptBlock(b4).indexOf('药剂炼制') !== -1 &&
  brewMod.buildAlchemyPromptBlock(b6).indexOf('材料不足') !== -1);

// B8. 炼金合并：inventory + currency 落到最终 gameData
const finalGd8 = base();
check('B8. 炼金合并：背包与金币落到最终 gameData',
  brewMod.applyAlchemySettlement(finalGd8, settled5) === true &&
  finalGd8.currency.gold === 17 && finalGd8.inventory.some(i => i.brewed === true));

// B9. usePotion 对 gameData 形状：恢复（hp 对象钳制上限）
const gd9 = base();
const healPotion = { name: '治疗药水', brewed: true, category: '恢复', effect: '治疗 20 HP', effectValue: 20 };
const u9 = alchMod.alchemySystem.usePotion(gd9, healPotion);
check('B9. usePotion 恢复：hp.current 60→80（钳制 max=100）',
  u9.success === true && gd9.hp.current === 80 && gd9.hp.max === 100);

// B10. usePotion 恢复溢出：钳制在 max
gd9.hp.current = 95;
alchMod.alchemySystem.usePotion(gd9, healPotion);
check('B10. usePotion 恢复溢出：95+20 → 100（不超上限）', gd9.hp.current === 100);

// B11. usePotion 法力：MP 上限按智力×5 派生（智力14 → 70）
const gd11 = base();  // 智力 14
gd11.character.mp = 10;
const manaPotion = { name: '法力药水（小）', brewed: true, category: '法力', effect: '恢复 10 法力值', effectValue: 10 };
const u11 = alchMod.alchemySystem.usePotion(gd11, manaPotion);
check('B11. usePotion 法力：mp 10→20（上限 70 按智力×5）',
  u11.restored === 10 && gd11.character.mp === 20);

// B12. usePotion 增益：写 conditions（键=状态名，source=炼金）
const gd12 = base();
const buffPotion = { name: '力量药剂', brewed: true, category: '增益', effect: '力量检定获优势，持续 1 小时' };
const u12 = alchMod.alchemySystem.usePotion(gd12, buffPotion);
check('B12. usePotion 增益：conditions[力量药剂] 存在（source=炼金）',
  u12.buffApplied === true && gd12.conditions['力量药剂'] && gd12.conditions['力量药剂'].source === '炼金');

// B13. usePotion 战斗类：返回标记且不直接生效；稀有禁术拒绝
const gd13 = base();
const u13 = alchMod.alchemySystem.usePotion(gd13, { name: '火焰瓶', brewed: true, category: '战斗', effect: '投掷火焰' });
const u13b = alchMod.alchemySystem.usePotion(gd13, { name: '禁忌药剂', brewed: true, category: '稀有禁术', effect: '禁忌' });
check('B13. usePotion 战斗类标记待应用 + 稀有禁术拒绝',
  u13.requiresCombatContext === true && u13.consumable === 'combat_throw' &&
  u13b.success === false && u13b.requiresNPC === '杜兰·碎星');

// ---------- 施法接线 ----------
const spellMod = await import('./module/spell-system.js');
const castMod = await import('./module/spell-input.js');

// C1. 动词门 + 全名匹配 + 别名
const c1 = castMod.parseCastIntent('我施放火球术轰过去', base());
const c1b = castMod.parseCastIntent('吟唱火球术', base());
const c1c = castMod.parseCastIntent('施放一个没听过的法术', base());
check('C1. 施法意图：全名命中/别名火球→火球术/未知法术不触发',
  c1.intent === true && c1.spellName === '火球术' &&
  c1b.intent === true && c1b.spellName === '火球术' &&
  c1c.intent === false && c1c.reason === 'no-spell');

// C2. 未习得且无卷轴 → 结构化拒绝
const settled14 = clone(base());
const c2 = castMod.settleCast(settled14, '火球术');
check('C2. 施法预检：未习得且无卷轴 → not-learned',
  c2.phase === 'precheck' && c2.reason === 'not-learned');

// C3. 卷轴施法：走 castFromScroll，卷轴从背包消失，MP 扣除
const gd15 = base();
gd15.character.mp = 50;
gd15.inventory = [{ name: '卷轴·火球术', amount: 1, type: '卷轴' }];
const settled15 = clone(gd15);
const c3 = castMod.settleCast(settled15, '火球术');
check('C3. 卷轴施法：viaScroll + 卷轴消耗 + MP 扣 15（50→35）',
  c3.phase === 'cast' && c3.viaScroll === true && c3.scrollConsumed === true &&
  settled15.inventory.length === 0 && settled15.character.mp === 35);

// C4. 已习得施法：直接 castSpell；旧档 tier 缺省不炸
const gd16 = base();
gd16.character.mp = 50;
gd16.spells = [{ name: '火球术', school: '火焰', level: 3, source: '卷轴' }];  // 无 tier（旧档）
const settled16 = clone(gd16);
const c4 = castMod.settleCast(settled16, '火球术');
check('C4. 已习得施法：castSpell 走通 + 旧档无 tier 不炸',
  c4.phase === 'cast' && c4.viaScroll === false && typeof c4.mpCost === 'number' &&
  settled16.character.mp === 50 - c4.mpCost);

// C5. MP 不足：已习得但 MP 为 0 → 结构化拒绝且不扣（MP 检查先于扣减）
const gd17 = base();
gd17.character.mp = 0;
gd17.spells = [{ name: '火把', school: '通用', level: 1, tier: 1 }];
const settled17 = clone(gd17);
const c5 = castMod.settleCast(settled17, '火把');
check('C5. MP 不足：拒绝且 MP 保持 0',
  c5.success === false && c5.reason === 'MP不足' && settled17.character.mp === 0);

// C6. 施法注入块：成功块含权威声明+法术效果；预检块含引导
const c6a = castMod.buildSpellPromptBlock(c3);
const c6b = castMod.buildSpellPromptBlock(c2);
check('C6. 施法块：成功/预检两形态',
  c6a.indexOf('【施法结算·系统权威】') !== -1 && c6a.indexOf('火球术') !== -1 &&
  c6b.indexOf('未习得') !== -1);

// C7. 施法合并：mp/inventory 落到最终 gameData
const finalGd7 = base();
check('C7. 施法合并：mp 与卷轴消耗落到最终 gameData',
  castMod.applyCastSettlement(finalGd7, settled15) === true &&
  finalGd7.character.mp === 35 && finalGd7.inventory.length === 0);

// ---------- 命令通道协同 ----------
// C8. AI push spells：命令后校准补 tier=1
const r8 = processor.applyCommands(base(), [
  { action: 'push', key: 'spells', value: { name: '治愈轻伤', school: '通用', level: 1, source: 'NPC教学' } }
]);
check('C8. AI push spells：校准补 tier=1',
  r8.gameData.spells[0].tier === 1);

// C9. 施法结算 + 命令后校准协同：MP 先扣后钳制（成败随机，但扣 MP 确定：70-15=55）
const gd19 = base();
gd19.attributes['智力'] = 14;  // 上限 70
gd19.character.mp = 70;
gd19.spells = [{ name: '火球术', school: '火焰', level: 3, tier: 2 }];
const settled19 = clone(gd19);
const c9 = castMod.settleCast(settled19, '火球术');
const r9 = processor.applyCommands(settled19, [{ action: 'set', key: '状态.力竭.层级', value: 1 }]);
check('C9. 结算与校准协同：施法扣 MP 后校准不回弹（70-15=55）',
  c9.mpCost === 15 && r9.gameData.character.mp === 55);

// B14. 增益跨回合存活：引擎署名（source=炼金）条目不被状态白名单校准抹除
const gd14 = base();
alchMod.alchemySystem.usePotion(gd14, buffPotion);
const r14 = processor.applyCommands(gd14, [{ action: 'set', key: '状态.力竭.层级', value: 1 }]);
check('B14. 增益跨回合存活：conditions 引擎署名条目豁免白名单校准',
  r14.gameData.conditions['力量药剂'] && r14.gameData.conditions['力量药剂'].source === '炼金' &&
  r14.gameData.conditions['力竭']);

// ---------- 锻造/改装接线 ----------
const craftMod = await import('./module/craft-input.js');
const forgeMod2 = await import('./module/forging-system.js');

// F0. 契约前置：equipment-contract 已在顶部加载（craft-input 依赖 createWeapon + mapping）

// F1. 意图门：世界书名匹配 + 无模板不触发 + 动词族互斥
const f1 = craftMod.parseCraftIntent('我来锻造一把铁剑', base());
const f1b = craftMod.parseCraftIntent('锻造一个不存在的东西', base());
const f1c = craftMod.parseCraftIntent('锻造并顺便安装锐刃打磨', base());
check('F1. 锻造意图：铁剑→废土长刀 / 无模板不触发 / 动词族互斥',
  f1.intent === true && f1.engineName === '废土长刀' && f1.kind === 'weapon' &&
  f1b.intent === false && f1b.reason === 'no-template' &&
  f1c.intent === false && f1c.reason === 'ambiguous');

// F2. 锻造结算（成功）：成品入背包 + currency 扣 7.5（铁剑 15÷2，精确值）
const gdF = base();
gdF.currency.gold = 20;
gdF.inventory = [{ name: '铁匠工具', amount: 1, type: '工具' }];
const settledF = clone(gdF);
const origRandomF = Math.random;
Math.random = () => 0.999999;  // 强制天然 20 → 杰出
let f2;
try { f2 = craftMod.settleCraft(settledF, f1); } finally { Math.random = origRandomF; }
const f2item = settledF.inventory.find(i => i.worldName === '铁剑');
check('F2. 锻造结算：成品入背包（type=weapon/worldName）+ 金币 20→12.5 + 杰出 3 词条',
  f2.success === true && !!f2item && f2item.type === 'weapon' &&
  settledF.currency.gold === 12.5 &&
  f2.affixes && f2.affixes.length === 3 && f2item.affixes && f2item.affixes.length === 3);

// F3. 锻造预检：金币不足 → 结构化拒绝且零消耗
const gdF3 = base();
gdF3.currency.gold = 0;
const settledF3 = clone(gdF3);
const f3 = craftMod.settleCraft(settledF3, craftMod.parseCraftIntent('打造一件皮甲', gdF3));
check('F3. 锻造预检：金币不足拒绝 + 零消耗（皮甲 25÷2=12.5）',
  f3.success === false && f3.error === '金币不足' && f3.required === 12.5 && settledF3.currency.gold === 0);

// F4. 法杖走炼金工具：工具从背包派生（无炼金工具 → 检定劣势但仍可尝试）
const f4 = craftMod.parseCraftIntent('锻造一根法杖', base());
check('F4. 锻造意图：法杖模板可解析（worldName=法杖）',
  f4.intent === true && f4.displayName === '法杖');

// F5. 修理：瑕疵装备在背包 → 修复成功后 flaw 消除
const gdF5 = base();
gdF5.inventory = [{
  name: '铁废土长刀', type: 'weapon', worldName: '铁剑',
  material: { tier: 1, name: '铁' },
  weapon: { damageBase: 8, baseDie: 8, damageBonus: 0, damageType: '劈砍', speed: '中', twoHanded: false },
  durability: { current: 80, max: 80 }, price: 15,
  flaw: '卷刃', flawEffect: { narrative: '迟滞', mechanic: '伤害骰-1档' }, repairable: true, repairDC: 12
}];
const settledF5 = clone(gdF5);
const origRandomF5 = Math.random;
Math.random = () => 0.999999;
let f5;
try { f5 = craftMod.settleCraft(settledF5, craftMod.parseCraftIntent('把这把剑修理一下', gdF5)); } finally { Math.random = origRandomF5; }
check('F5. 修理结算：瑕疵消除 + repairable 清理',
  f5.phase === 'repair' && f5.success === true &&
  !settledF5.inventory[0].flaw && !settledF5.inventory[0].repairable);

// F6. 改装安装：主手武器 + 锐刃打磨（stub 成功）→ mods 入列 + 金币扣 5
const gdF6 = base();
gdF6.currency.gold = 50;
gdF6.equipment.mainHand = {
  name: '铁废土长刀', type: 'weapon', worldName: '铁剑',
  material: { tier: 1, name: '铁' },
  weapon: { damageBase: 8, baseDie: 8, damageBonus: 0, damageType: '劈砍', speed: '中', twoHanded: false },
  durability: { current: 80, max: 80 }, price: 15
};
const settledF6 = clone(gdF6);
const origRandomF6 = Math.random;
Math.random = () => 0.999999;
let f6;
try { f6 = craftMod.settleCraft(settledF6, craftMod.parseCraftIntent('给主手武器改装锐刃打磨', gdF6)); } finally { Math.random = origRandomF6; }
check('F6. 改装安装：mods 入列 + 金币 50→45 + worldName 解析',
  f6.phase === 'install' && f6.success === true &&
  settledF6.equipment.mainHand.mods.length === 1 && settledF6.equipment.mainHand.mods[0].name === '锐刃打磨' &&
  settledF6.currency.gold === 45 && settledF6.equipment.mainHand.worldName === '铁剑');

// F7. 混装互斥：双手剑先装短柄改造（伤害骰档位调整组），重复安装同组改装件应结构性拒绝且不扣费
// （yaml 分组设计上同组成员不作用于同一装备，现实触发路径 = 重复安装）
const gdF7 = base();
gdF7.currency.gold = 100;
gdF7.equipment.mainHand = {
  name: '铁重型斩刀', type: 'weapon',
  material: { tier: 1, name: '铁' },
  weapon: { damageBase: 10, baseDie: 10, damageBonus: 0, damageType: '劈砍', speed: '慢', twoHanded: true },
  durability: { current: 70, max: 70 }, price: 30
};
const settledF7 = clone(gdF7);
const origRandomF7 = Math.random;
Math.random = () => 0.999999;
let f7a, f7;
try {
  f7a = craftMod.settleCraft(settledF7, craftMod.parseCraftIntent('给主手武器加装短柄改造', gdF7));
  f7 = craftMod.settleCraft(settledF7, craftMod.parseCraftIntent('再加装短柄改造', settledF7));
} finally { Math.random = origRandomF7; }
check('F7. 改装混装拒绝：伤害骰档位组同类取一 + 金币不扣',
  f7a.success === true && settledF7.currency.gold === 100 - 10 &&
  f7.phase === 'install' && f7.success === false && f7.error.indexOf('禁止混装') !== -1 &&
  settledF7.currency.gold === 90);

// F8. 拆卸：自拆检定成功 → 改装件移除
const settledF8 = clone(settledF6);
const origRandomF8 = Math.random;
Math.random = () => 0.999999;
let f8;
try { f8 = craftMod.settleCraft(settledF8, craftMod.parseCraftIntent('把锐刃打磨拆卸下来', settledF6)); } finally { Math.random = origRandomF8; }
check('F8. 拆卸结算：mods 清空 + 移除成功',
  f8.phase === 'remove' && f8.success === true && settledF8.equipment.mainHand.mods.length === 0);

// F9. 注入块：四族形态均含权威声明
check('F9. 锻造块：锻造/修理/改装/拆卸四形态',
  craftMod.buildCraftPromptBlock(f2).indexOf('【锻造结算·系统权威】') !== -1 &&
  craftMod.buildCraftPromptBlock(f5).indexOf('修复') !== -1 &&
  craftMod.buildCraftPromptBlock(f6).indexOf('工艺改装件') !== -1 &&
  craftMod.buildCraftPromptBlock(f8).indexOf('拆卸') !== -1);

// F10. 合并：inventory/currency/equipment 落到最终 gameData
const finalF10 = base();
check('F10. 锻造合并：背包/金币/装备槽落到最终 gameData',
  craftMod.applyCraftSettlement(finalF10, settledF6) === true &&
  finalF10.currency.gold === 45 && finalF10.equipment.mainHand.mods.length === 1);

// F11. 商店装（无 worldName，引擎名≠世界书名）改装：映射正向解析（质检 🔴2 回归）
const gdF11 = base();
gdF11.currency.gold = 50;
gdF11.equipment.mainHand = {
  name: '铁废土短刃', type: 'weapon',
  material: { tier: 1, name: '铁' },
  weapon: { damageBase: 6, baseDie: 6, damageBonus: 0, damageType: '劈砍', speed: '快', twoHanded: false },
  durability: { current: 70, max: 70 }, price: 8
};
const settledF11 = clone(gdF11);
const origRandomF11 = Math.random;
Math.random = () => 0.999999;
let f11;
try { f11 = craftMod.settleCraft(settledF11, craftMod.parseCraftIntent('给我的短剑加装锐刃打磨', gdF11)); } finally { Math.random = origRandomF11; }
check('F11. 商店装改装：worldName 正向解析（废土短刃→短剑）+ 安装成功',
  f11.phase === 'install' && f11.success === true &&
  settledF11.equipment.mainHand.mods[0].name === '锐刃打磨' && settledF11.currency.gold === 45);

// F12. 盾牌在 offHand：铆钉加固全槽位搜索命中（质检 🔴1 回归）
const gdF12 = base();
gdF12.currency.gold = 50;
gdF12.equipment.offHand = {
  name: '铁废铁盾牌', type: 'armor',
  material: { tier: 1, name: '铁' },
  armor: { acBase: 2, weight: '轻', dexBonus: 'none', strengthReq: 0 },
  durability: { current: 65, max: 65 }, price: 10
};
const settledF12 = clone(gdF12);
const origRandomF12 = Math.random;
Math.random = () => 0.999999;
let f12;
try { f12 = craftMod.settleCraft(settledF12, craftMod.parseCraftIntent('给盾牌加装铆钉加固', gdF12)); } finally { Math.random = origRandomF12; }
check('F12. 盾牌改装：offHand 槽位命中 + 安装成功',
  f12.phase === 'install' && f12.success === true &&
  settledF12.equipment.offHand.mods[0].name === '铆钉加固');

// F13. 混装拒绝的注入块：不谎称已消耗（质检 🔴3 回归）
const f13block = craftMod.buildCraftPromptBlock(f7);
check('F13. 混装拒绝块：明确未扣费 + 无 undefined',
  f13block.indexOf('未扣除任何费用') !== -1 && f13block.indexOf('undefined') === -1);

// F14. 局部防护件（skipped）不在可锻造列表（质检 🔴4 回归）
check('F14. skipped 模板：锻造手套 → no-template',
  craftMod.parseCraftIntent('锻造一副手套', base()).reason === 'no-template');

// F15. 稀有材料锻造拦截（质检 🟡10 回归）
const f15 = craftMod.parseCraftIntent('锻造一把秘银短剑', base());
check('F15. 稀有材料：秘银 → rareUnsupported 拦截 + 引导块',
  f15.intent === true && f15.rareUnsupported === '秘银' &&
  craftMod.buildCraftPromptBlock(craftMod.settleCraft(clone(base()), f15)).indexOf('暂未开放') !== -1);

// F16. 叙事句误触发收紧（质检 🔴5 回归）：所属格 / 疑问句不触发
check('F16. 误触发收紧：「父亲的铁剑」与疑问句不触发锻造',
  craftMod.parseCraftIntent('这把铁剑是我父亲手工打造的', base()).intent === false &&
  craftMod.parseCraftIntent('要不要给你的剑加装锐刃打磨？', base()).intent === false);

// F17. 炼金成本同样精确 ÷2（与锻造口径统一；6/2=3 不变）
check('F17. 炼金成本精确 ÷2：1.5→0.75 / 6→3',
  (await import('./module/material-system.js')).materialSystem.calculateAlchemyCost(1.5) === 0.75 &&
  (await import('./module/material-system.js')).materialSystem.calculateAlchemyCost(6) === 3);

console.log('\n' + (fail === 0 ? '✅ 全部通过（' + pass + ' 项）' : '❌ 失败 ' + fail + ' 项 / 通过 ' + pass + ' 项'));
process.exit(fail === 0 ? 0 : 1);
}
main();
