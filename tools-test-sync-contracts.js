// 同步机制扩展对账测试（Node）：④数值契约 ⑤升级进度契约 ⑥装备契约
// （①状态白名单 ②别名表 ③可写根 见 tools-test-contract.js）
//
// 对账层次（每个契约三层）：
//   源 yaml/契约文件 ↔ 生成的 contract JS ↔ 引擎实际行为
// 另有第 4 层：契约数值 ↔ 世界书权威表述（宽松正则，防"两边一起改错"）
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
new Function(fs.readFileSync(path.join(ROOT, 'module/status-contract.js'), 'utf8'))();
new Function(fs.readFileSync(path.join(ROOT, 'module/numeric-contract.js'), 'utf8'))();
new Function(fs.readFileSync(path.join(ROOT, 'module/progression-contract.js'), 'utf8'))();
new Function(fs.readFileSync(path.join(ROOT, 'module/equipment-contract.js'), 'utf8'))();
new Function(fs.readFileSync(path.join(ROOT, 'module/command-engine.js'), 'utf8'))();
new Function(fs.readFileSync(path.join(ROOT, 'module/command-processor.js'), 'utf8'))();
const processor = window.commandProcessor;

let pass = 0, fail = 0;
const check = (n, c) => { c ? pass++ : fail++; console.log((c ? '✅' : '❌') + ' ' + n); };

const base = () => ({
  character: { name: '凛夏', level: 1, exp: 0, proficiencyBonus: 2 },
  hp: { current: 100, max: 100 },
  attributes: { 力量: 10, 敏捷: 10, 体质: 10, 感知: 10, 智力: 10, 魅力: 10 },
  equipment: {}, inventory: [],
  currency: { gold: 10 }, conditions: {},
  gameTime: { year: 300, month: 11, day: 12, hour: 7, minute: 10 },
  progress: { currentLocation: '佣兵镇·锈钉', currentPlace: '佣兵公会大厅' }
});

// ---------- yaml 独立解析（与转换器实现互为第二双眼睛） ----------
function parseNumericYaml(text) {
  const nested = {};
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r/, '').trim();
    if (!line || line.indexOf('#') === 0) continue;
    const m = line.match(/^([^\s:#][^:：]*)[：:]\s*(-?\d+(?:\.\d+)?)\s*(?:#.*)?$/);
    if (!m) continue;
    const keys = m[1].trim().split('.');
    let cur = nested;
    for (let i = 0; i < keys.length - 1; i++) { cur[keys[i]] = cur[keys[i]] || {}; cur = cur[keys[i]]; }
    cur[keys[keys.length - 1]] = Number(m[2]);
  }
  return nested;
}
function parseProgressionTable(yamlText) {
  const sec = yamlText.split(/^##\s/m).find(s => s.indexOf('§4') === 0) || '';
  const rows = {};
  for (const line of sec.split('\n')) {
    const m = line.match(/^\|\s*(\d+)\s*\|\s*([^|]*)\|\s*([^|]*)\|\s*([^|]*)\|\s*\+?(\d+)\s*\|\s*([^|]+)\|/);
    if (!m) continue;
    rows[Number(m[1])] = {
      cumXp: /—/.test(m[2]) ? 0 : Number((m[2].match(/\d+/) || [0])[0]),
      attrPoints: /—/.test(m[3]) ? 0 : (m[3].match(/\+1/g) || []).length,
      pb: Number(m[5]),
      rank: m[6].trim()
    };
  }
  return rows;
}
function parseItemStats(text) {
  const out = {};
  for (const line of text.split('\n')) {
    let m;
    if ((m = line.match(/伤害骰[：:]\s*1d(\d+)（?([^）]*)/))) { out.die = Number(m[1]); out.damageType = (m[2] || '').trim(); }
    else if ((m = line.match(/^-\s*AC\s*加成[：:]\s*\+?(\d+)/))) out.acBonus = Number(m[1]);
    else if ((m = line.match(/^-\s*重量[：:]\s*(轻|中|重)/))) out.weightClass = m[1];
    else if ((m = line.match(/耐久上限[：:]\s*(\d+)/))) out.durabilityMax = Number(m[1]);
    else if ((m = line.match(/基准价格[：:]\s*(\d+)/))) out.basePrice = Number(m[1]);
  }
  return out;
}
const yamlItem = (rel) => parseItemStats(fs.readFileSync(path.join(ROOT, 'data-source/世界书/装备', rel), 'utf8'));

const numericYaml = fs.readFileSync(path.join(ROOT, 'data-source/契约/数值常量.yaml'), 'utf8');
const growthYaml = fs.readFileSync(path.join(ROOT, 'data-source/世界书/系统/经验与成长.yaml'), 'utf8');
const attrSysYaml = fs.readFileSync(path.join(ROOT, 'data-source/世界书/系统/属性系统.yaml'), 'utf8');

(async function main() {
  // ===== 第 4 层：数值契约 =====
  const NC = window.numericContract;
  const yamlNum = parseNumericYaml(numericYaml);
  check('4a. 数值契约生成且 ≥15 项', NC && Object.keys(NC).length >= 8 && JSON.stringify(NC).length > 200);
  check('4b. 数值契约与 源yaml 点路径逐项一致', JSON.stringify(NC) === JSON.stringify(yamlNum));

  // 契约 ↔ 世界书权威表述（宽松正则）
  check('4c1. 属性系统：MP 上限 = 智力 × 5 与契约一致',
    /智力\s*[×x]\s*5/.test(attrSysYaml) && NC.法力.每点智力 === 5);
  check('4c2. 属性系统：负重上限 = 10 + 力量 × 2 与契约一致',
    /10\s*\+\s*力量\s*[×x]\s*2/.test(attrSysYaml) && NC.负重.基础 === 10 && NC.负重.每点力量 === 2);
  check('4c3. 属性系统：六维 3~20 硬约束与契约钳制一致',
    /3~20/.test(attrSysYaml) && NC.属性.下限 === 3 && NC.属性.上限 === 20);
  check('4c4. 属性系统：HP 上限 = 100 + 10×(等级−1) 与契约一致',
    /100\s*\+\s*10\s*[×x]\s*\(?\s*等级/.test(attrSysYaml) && NC.生命.基础上限 === 100 && NC.生命.每级成长 === 10);
  check('4c5. 经验与成长：最大生命值 +10/级与契约一致',
    /最大生命值\s*\+10/.test(growthYaml) && NC.生命.每级成长 === 10);

  // 契约 ↔ 引擎行为（AI 乱写数值必须被钳回契约界限）
  let r = processor.applyCommands(base(), [
    { action: 'set', key: '属性.力量', value: 25 },
    { action: 'set', key: '属性.魅力', value: 1 },
    { action: 'set', key: 'MP', value: 999 }
  ]);
  check('4d1. 属性 25 钳制为上限 20', r.gameData.attributes['力量'] === 20);
  check('4d2. 属性 1 钳制为下限 3', r.gameData.attributes['魅力'] === 3);
  check('4d3. MP 999 钳制为 智力×5 = 50', r.gameData.character.mp === 50);

  r = processor.applyCommands(base(), [{ action: 'set', key: '状态.力竭.层级', value: 9 }, { action: 'set', key: '状态.侵蚀.层级', value: 9 }]);
  check('4d4. 力竭层级 9 → 3（契约）', r.gameData.conditions['力竭'].层级 === 3);
  check('4d5. 侵蚀层级 9 → 2（契约）', r.gameData.conditions['侵蚀'].层级 === 2);

  const gdRel = base();
  gdRel.relationships = { '莉娅': { 好感度: 250, 人情值: -8 } };
  r = processor.applyCommands(gdRel, []);
  check('4d6. 好感度 250 → 100；人情值 -8 → 0（契约双轴）',
    r.gameData.relationships['莉娅'].好感度 === 100 && r.gameData.relationships['莉娅'].人情值 === 0);

  const gdPts = base();
  gdPts.progress.unspentPoints = 99;
  r = processor.applyCommands(gdPts, []);
  check('4d7. 溢出属性点 99 → 存储上限 10', r.gameData.progress.unspentPoints === 10);

  const gdFate = base();
  delete gdFate.fatePoints;
  r = processor.applyCommands(gdFate, []);
  check('4d8. 命运点上限缺省 = 3（契约）', r.gameData.fatePoints.max === 3);

  // ===== 第 5 层：升级进度契约 =====
  const PC = window.progressionContract;
  const yamlProg = parseProgressionTable(growthYaml);
  check('5a. 进度契约与 yaml §4 总表逐行一致（等级/累计XP/属性点/PB/等阶）',
    JSON.stringify(PC.levels) === JSON.stringify(Object.fromEntries(Object.entries(yamlProg).map(([k, v]) => [String(k), v]))));
  check('5b. 总表自洽：本级消耗 = (等级−1)×50 全部成立',
    Object.keys(PC.levels).every(k => {
      const lv = Number(k);
      if (lv < 2) return PC.levels[k].cumXp === 0;
      return PC.levels[k].cumXp - PC.levels[String(lv - 1)].cumXp === (lv - 1) * 50;
    }));
  check('5c. 等阶映射完整（Lv1 见习 … Lv10 传奇）',
    PC.levels['1'].rank === '见习' && PC.levels['10'].rank === '传奇');

  // 引擎行为：连续升级走表（含 Lv4/8 ASI、PB 跳档 5/9、表外公式延续）
  let gd = base();
  r = processor.applyCommands(gd, [{ action: 'add', key: '经验', value: 149 }]);
  let g = r.gameData;
  check('5d1. exp 149 → Lv2（余 99，下一级需 100）', g.character.level === 2 && g.character.exp === 99 && g.character.expToNextLevel === 100);
  check('5d2. Lv2 属性点 +1、HP 上限 110', g.progress.unspentPoints === 1 && g.hp.max === 110);

  r = processor.applyCommands(g, [{ action: 'add', key: '经验', value: 2051 }]);
  g = r.gameData;
  check('5d3. 连升到 Lv9（属性点累计 10 = 总表，PB 4，HP 180）',
    g.character.level === 9 && g.progress.unspentPoints === 10 && g.character.proficiencyBonus === 4 && g.hp.max === 180);

  r = processor.applyCommands(g, [{ action: 'add', key: '经验', value: 50 }]);
  g = r.gameData;
  check('5d4. Lv10：属性点受存储上限收口（攒存 ≤10，属性系统·属性点分配）、expToNext = 500（表外公式 10×50）',
    g.character.level === 10 && g.progress.unspentPoints === 10 && g.character.expToNextLevel === 500);

  r = processor.applyCommands(g, [{ action: 'add', key: '经验', value: 1250 }]);
  g = r.gameData;
  check('5d5. 表外 Lv11→12：属性点 12 级 +2（ASI 延续），PB 不变（攒存仍收口在 10）',
    g.character.level === 12 && g.character.proficiencyBonus === 4 && g.progress.unspentPoints === 10 && g.hp.max === 210);

  r = processor.applyCommands(g, [{ action: 'add', key: '经验', value: 400 }]);
  g = r.gameData;
  check('5d6. 表外 Lv13：PB 每 4 级 +1 延续跳 5', g.character.level === 13 && g.character.proficiencyBonus === 5 && g.hp.max === 220);

  // ===== 第 6 层：装备契约 =====
  const EC = window.equipmentContract;
  check('6a. 装备契约生成（武器 16 / 护甲 19 / 映射 26 / 注册 5）',
    EC && Object.keys(EC.weapons).length === 16 && Object.keys(EC.armors).length === 19
    && Object.keys(EC.mapping.weapons).length === 12 && Object.keys(EC.mapping.armors).length === 14
    && Object.keys(EC.registered.weapons).length === 4 && Object.keys(EC.registered.armors).length === 1);
  check('6b. 映射指向全部存在（引擎名→世界书名无悬空）',
    Object.keys(EC.mapping.weapons).every(en => EC.weapons[EC.mapping.weapons[en]])
    && Object.keys(EC.mapping.armors).every(en => EC.armors[EC.mapping.armors[en]]));

  // 契约条目 ↔ 世界书 yaml 独立抽查（7 件，含漂移最重的弓弩/板甲）
  const tiejian = yamlItem('武器/铁剑.yaml');
  check('6c1. 铁剑 yaml ↔ 契约（1d8/耐久80/15金）',
    EC.weapons['铁剑'].die === 8 && EC.weapons['铁剑'].durabilityMax === 80 && EC.weapons['铁剑'].basePrice === 15 && tiejian.die === 8);
  const choudan = yamlItem('护甲/板甲.yaml');
  check('6c2. 板甲 yaml ↔ 契约（AC+6/耐久80/150金）',
    EC.armors['板甲'].acBonus === 6 && EC.armors['板甲'].durabilityMax === 80 && EC.armors['板甲'].basePrice === 150 && choudan.acBonus === 6);
  const zhongdan = yamlItem('武器/重弩.yaml');
  check('6c3. 重弩 yaml ↔ 契约（1d12/耐久40/80金，引擎旧值 90/50 已纠偏）',
    EC.weapons['重弩'].die === 12 && EC.weapons['重弩'].durabilityMax === 40 && EC.weapons['重弩'].basePrice === 80 && zhongdan.durabilityMax === 40);

  // 引擎消费：模板数值被契约覆盖（import 在契约之后，模拟 index.html 脚本顺序）
  const eqMod = await import('./module/equipment-system.js');
  const eq = eqMod.default || eqMod;
  const WT = eq.WEAPON_TEMPLATES, AT = eq.ARMOR_TEMPLATES;
  check('6d1. 废土匕首 → 匕首数值（1d4/耐久60/3金，旧价 5 已纠偏）',
    WT['废土匕首'].damageBase === 4 && WT['废土匕首'].durabilityMax === 60 && WT['废土匕首'].basePrice === 3);
  check('6d2. 重型斩刀 → 双手剑数值（1d10/耐久70/30金，旧耐久 100 已纠偏）',
    WT['重型斩刀'].damageBase === 10 && WT['重型斩刀'].durabilityMax === 70 && WT['重型斩刀'].basePrice === 30);
  check('6d3. 变异兽皮甲 → 皮甲数值（acBase=10+2、25金，旧价 10 已纠偏）',
    AT['变异兽皮甲'].acBase === 12 && AT['变异兽皮甲'].basePrice === 25);
  check('6d4. 拼装重甲 → 板甲数值（acBase=10+6、150金、耐久80，旧 acBase18/1500金 已纠偏）',
    AT['拼装重甲'].acBase === 16 && AT['拼装重甲'].basePrice === 150 && AT['拼装重甲'].durabilityMax === 80);
  check('6d5. 盾牌为加值模型（acBase=+2，20金/耐久70）',
    AT['废铁盾牌'].acBase === 2 && AT['废铁盾牌'].basePrice === 20 && AT['废铁盾牌'].durabilityMax === 70);
  check('6d6. 钢管/投掷手斧 已有世界书条目且数值一致（钢管 2金/耐久80；投掷手斧 65/8金）',
    WT['钢管'].contractSource === '钢管' && WT['钢管'].basePrice === 2 && WT['钢管'].durabilityMax === 80
    && WT['投掷手斧'].contractSource === '投掷手斧' && WT['投掷手斧'].basePrice === 8 && WT['投掷手斧'].durabilityMax === 65);
  check('6d6b. 引擎模板 100% 有世界书对应（映射或注册，无单侧孤儿）',
    Object.keys(WT).every(n => !!WT[n].contractSource) && Object.keys(AT).every(n => !!AT[n].contractSource));
  check('6d6c. 世界书独有武器注册可创建（战斧 1d10/60/50金 双手；战锤 1d10/60/60金 双手）',
    !!WT['战斧'] && !!WT['战锤']
    && eq.createWeapon('战斧', 1).price === 50 && eq.createWeapon('战斧', 1).weapon.twoHanded === true
    && eq.createWeapon('战锤', 1).price === 60 && eq.createWeapon('战锤', 1).weapon.damageBase === 10);
  check('6d6d. 引擎独有护甲条目已落地世界书（废布 11/50/5；佣兵重甲 16/90/75 力量需求13 保留；铁匠镇守甲 17/95/200）',
    AT['废布拼装甲'].acBase === 11 && AT['废布拼装甲'].durabilityMax === 50 && AT['废布拼装甲'].basePrice === 5
    && AT['佣兵重甲'].acBase === 16 && AT['佣兵重甲'].durabilityMax === 90 && AT['佣兵重甲'].basePrice === 75
    && eq.createArmor('佣兵重甲', 1).armor.strengthReq === 13
    && AT['铁匠镇守甲'].acBase === 17 && AT['铁匠镇守甲'].durabilityMax === 95 && AT['铁匠镇守甲'].basePrice === 200);
  check('6d7. 世界书独有武器注册可创建（短矛 1d6/12金；法杖存在）',
    !!WT['短矛'] && !!WT['法杖'] && eq.createWeapon('短矛', 1).price === 12);
  check('6d8. 世界书独有护甲注册（全罩盔：头部槽、acBase=+3）',
    !!AT['全罩盔'] && AT['全罩盔'].slot === 'head' && AT['全罩盔'].acBase === 3);
  check('6d9. 局部防护件按映射声明不注册（手套/护腿/肩甲/铁靴）',
    EC.skipped.length === 4 && !AT['手套'] && !AT['护腿'] && !AT['肩甲'] && !AT['铁靴']);

  // AC 集成：属性系统公式 10 + 敏捷调整值 + 护甲AC加成（皮甲 +2、敏捷14）→ 引擎算出 14
  const armor = eq.createArmor('变异兽皮甲', 1);
  eq.equipItem(armor);
  const ac = eq.calculateTotalAC({ 敏捷: 14 });
  check('6d10. AC 集成：皮甲(12) + 敏捷调整值(+2) = 14（对齐属性系统派生表）', ac.total === 14);

  // AC 集成（头部）：世界书头盔 +2 由引擎计入总 AC（与盾牌同加值模型）
  eq.equipItem(eq.createArmor('废土头盔', 1));
  const acHelm = eq.calculateTotalAC({ 敏捷: 14 });
  check('6d11. 头部 AC 生效：皮甲(12)+敏捷(+2)+头盔(+2) = 16', acHelm.total === 16 && acHelm.breakdown.head === 2);

  eq.equipItem(eq.createArmor('废铁盾牌', 1), 'offHand');
  const acFull = eq.calculateTotalAC({ 敏捷: 14 });
  check('6d12. 全套叠加：身体12+敏捷2+盾2+盔2 = 18', acFull.total === 18 && acFull.breakdown.shield === 2 && acFull.breakdown.head === 2);
  eq.unequipItem('head'); eq.unequipItem('offHand'); eq.unequipItem('body');

  // 材料档位：武器伤害加成对齐世界书（三阶 +1 升骰 / 灾厄 +2；旧引擎 tier−1 的 +2/+3 已纠偏）
  const w3 = eq.createWeapon('废土长刀', 3);
  check('6d13. 材料三阶（秘银）铁剑：1d10+1（加成 1、骰面 10，旧值 +2 已纠偏）',
    w3.weapon.damageBonus === 1 && w3.weapon.damageBase === 10);
  const w4 = eq.createWeapon('废土长刀', 4);
  check('6d14. 材料灾厄铁剑：1d10+2（加成 2，旧值 +3 已纠偏）',
    w4.weapon.damageBonus === 2 && w4.weapon.damageBase === 10);
  const w2 = eq.createWeapon('废土长刀', 2);
  check('6d15. 材料二阶（精铁）铁剑：1d8+1（不升骰）',
    w2.weapon.damageBonus === 1 && w2.weapon.damageBase === 8);

  // 锁甲敏捷：世界书条目「不获敏捷调整值（笨重，重甲惩罚）」在引擎生效（旧中甲 limited 已纠偏）
  eq.equipItem(eq.createArmor('拾荒链甲衫', 1));
  const acLock = eq.calculateTotalAC({ 敏捷: 16 });
  check('6d16. 锁甲不获敏捷：AC 14 固定（敏捷 +3 不加成，旧值 16 已纠偏）',
    AT['拾荒链甲衫'].dexBonus === 'none' && acLock.total === 14 && acLock.breakdown.dex === 0);
  eq.unequipItem('body');

  // 双持资格：世界书战斗规则「基础伤害骰≤1d6 的轻武器，法杖除外」在引擎生效
  eq.unequipItem('mainHand'); eq.unequipItem('offHand');
  eq.equipItem(eq.createWeapon('废土短刃', 3));   // 秘银短剑：当前骰 1d8，出厂规格 1d6
  const offDagger = eq.createWeapon('废土匕首', 1);
  eq.equipItem(offDagger, 'offHand');
  const dualLight = eq.getEquippedItem('offHand') && eq.getEquippedItem('offHand').id === offDagger.id;
  check('6d17. 秘银短剑（升骰 1d8）主手 + 匕首副手：可双持（按出厂骰面判定，材料不改资格）', !!dualLight);

  eq.unequipItem('offHand'); eq.unequipItem('mainHand');
  eq.equipItem(eq.createWeapon('废土长刀', 1));   // 出厂 1d8 重武器
  const offD2 = eq.createWeapon('废土匕首', 1);
  eq.equipItem(offD2, 'offHand');
  const dualHeavy = eq.getEquippedItem('offHand') && eq.getEquippedItem('offHand').id === offD2.id;
  check('6d18. 长刀（1d8）主手 + 匕首副手：拒绝双持（旧引擎放行已纠偏）', !dualHeavy);

  eq.unequipItem('offHand'); eq.unequipItem('mainHand');
  eq.equipItem(eq.createWeapon('废土匕首', 1));
  const offStaff = eq.createWeapon('法杖', 1);
  eq.equipItem(offStaff, 'offHand');
  const dualStaff = eq.getEquippedItem('offHand') && eq.getEquippedItem('offHand').id === offStaff.id;
  check('6d19. 匕首主手 + 法杖副手：拒绝双持（法杖不可双持）', !dualStaff);
  eq.unequipItem('mainHand');

  // ===== 第 7 层：炼金对账（炼金配方表.yaml ↔ alchemy-system.ALCHEMY_RECIPES） =====
  const alchYaml = fs.readFileSync(path.join(ROOT, 'data-source/世界书/装备/炼金配方表.yaml'), 'utf8');
  const alchMod = await import('./module/alchemy-system.js');
  const R = (alchMod.default && alchMod.default.ALCHEMY_RECIPES) || alchMod.ALCHEMY_RECIPES;
  const wbAlch = (name) => {
    const line = alchYaml.split('\n').find(l => l.indexOf('| ' + name + ' |') === 0);
    if (!line) return null;
    const c = line.split('|').map(s => s.trim());
    const num = (s) => { const m = String(s).match(/[\d.]+/); return m ? Number(m[0]) : null; };
    return { dc: num(c[4]), effect: c[5], price: num(c[6]) };
  };
  const effectNum = (s) => { const m = String(s).match(/\d+/); return m ? Number(m[0]) : null; };

  // 第 7 层：2026-09-05 重写后，引擎命名已对齐世界书（低/中/高阶法力药水）。
  // 引擎与 YAML 同一名称即可直接对齐，无须配对。
  const mpNames = ['低阶法力药水', '中阶法力药水', '高阶法力药水'];
  const mpOk = mpNames.every(name => {
    const row = wbAlch(name); const rec = R[name];
    return row && rec && rec.dc === row.dc && rec.basePrice === row.price
      && effectNum(rec.baseEffect) === effectNum(row.effect);
  });
  check('7a. 法力三档对齐：引擎「低/中/高阶法力药水」与 YAML 同名条目（DC、价格、药效同验）',
    mpOk && effectNum(R['低阶法力药水'].baseEffect) === 5 && effectNum(R['高阶法力药水'].baseEffect) === 30);

  const legendWb = wbAlch('传奇法力药水');
  check('7b. 传奇法力药水两侧都有（DC20/1660金/全满，引擎旧缺已补）',
    !!R['传奇法力药水'] && !!legendWb && R['传奇法力药水'].dc === 20 && R['传奇法力药水'].basePrice === 1660
    && /全部|全满/.test(R['传奇法力药水'].baseEffect) && /全满/.test(legendWb.effect));

  const strongWb = wbAlch('强效治疗药水');
  check('7c. 强效治疗药水 40 HP 对齐（DC15/71金，校准到 4×materialSum 保证正收益）',
    effectNum(R['强效治疗药水'].baseEffect) === 40 && !!strongWb && strongWb.dc === 15 && strongWb.price === 71
    && effectNum(strongWb.effect) === 40);

  const superWb = wbAlch('超级治疗药水');
  check('7d. 超级治疗药水两侧都有（100 HP/DC20/280金，校准到 4×materialSum 保证正收益）',
    !!R['超级治疗药水'] && !!superWb && R['超级治疗药水'].dc === 20
    && R['超级治疗药水'].basePrice === 280 && effectNum(superWb.effect) === 100);

  // 7f. 类别字段已统一为世界书 6 类（旧「治疗/毒药/实用」已废弃命名不可残留）
  const expectedCategories = new Set(['恢复', '法力', '增益', '战斗', '介质', '稀有禁术']);
  const allCats = new Set(Object.values(R).map(r => r.category));
  const hasOnlyNewCats = [...allCats].every(c => expectedCategories.has(c));
  check('7f. 类别字段全部为新 6 类（恢复/法力/增益/战斗/介质/稀有禁术，无旧治疗/毒药/实用残留）',
    hasOnlyNewCats && allCats.size === 6);

  // 7g. 稀有禁术 3 条全部存在且 commissionNPC 指向杜兰·碎星
  const rareRecipes = ['禁忌药剂', '灾厄金属精炼', '符文药剂'];
  const rareOk = rareRecipes.every(n => R[n] && R[n].rare === true && R[n].commissionNPC === '杜兰·碎星');
  check('7g. 稀有禁术 3 条存在（rare=true，commissionNPC=杜兰·碎星）', rareOk);

  // 7h. 配方总数对齐：世界书 24 条
  const recipeCount = Object.keys(R).length;
  check('7h. ALCHEMY_RECIPES 总数 = 24（与世界书·炼金配方表逐行对齐）', recipeCount === 24);

  // 7i. ALCHEMY_RECIPES 引用的所有材料名都能在 MATERIALS 中找到（hasMaterials 实际可用）
  const { MATERIALS } = await import('./module/material-system.js');
  const recipeMats = new Set();
  Object.values(R).forEach(r => Object.keys(r.materials || {}).forEach(m => recipeMats.add(m)));
  const missingMats = [...recipeMats].filter(m => !MATERIALS[m]);
  check('7i. ALCHEMY_RECIPES 引用的所有材料都在 MATERIALS 中（hasMaterials 可用，' + recipeMats.size + ' 种材料 0 缺失）',
    missingMats.length === 0);

  // 7j. 至少覆盖：恢复/法力/增益/战斗/介质 5 类的非稀有材料均有合法价
  const nonRareMats = new Set();
  Object.values(R).forEach(r => { if (!r.rare) Object.keys(r.materials || {}).forEach(m => nonRareMats.add(m)); });
  const pricedMats = [...nonRareMats].filter(m => MATERIALS[m] && MATERIALS[m].price > 0);
  check('7j. 非稀有配方原料（非稀有材料 ' + nonRareMats.size + ' 种）全部有合法基准价（' + pricedMats.length + '/' + nonRareMats.size + '）',
    pricedMats.length === nonRareMats.size);

  // 7k. 稀有禁术 3 类的 commissionNPC + 至少一种材料 ≥ 2 阶（真正的稀有关键材料）
  const rareRecipesTier = Object.entries(R).filter(([_, r]) => r.rare);
  const rareOk2 = rareRecipesTier.every(([_, r]) =>
    r.commissionNPC && r.materials &&
    Object.keys(r.materials).some(m => MATERIALS[m] && MATERIALS[m].tier.level >= 2)
  );
  check('7k. 稀有禁术 ' + rareRecipesTier.length + ' 条：commissionNPC 已指 + 含 ≥ 2 阶材料',
    rareOk2 && rareRecipesTier.length === 3);

  // ============ T2：收购价接口 ============
  const { materialSystem } = await import('./module/material-system.js');
  const mSys = materialSystem;

  // 7l. 基础收购价：草药 0.5 金 × 0.5(公会收购) = 0.25 金
  check('7l. getSellPrice 基础：草药 (0.5×0.5) = 0.25',
    mSys.getSellPrice('草药') === 0.25);

  // 7m. 偏远修饰：0.25 × 1.35 = 0.3375 → 0.34
  check('7m. getSellPrice 偏远：草药 (0.25×1.35) = 0.34',
    mSys.getSellPrice('草药', { remote: true }) === 0.34);

  // 7n. 好感度修饰：冷淡×1.20 / 友好×1.0 / 信任×0.95 / 亲密×0.90
  check('7n. getSellPrice 好感度 4 档（冷淡 0.30 / 友好 0.25 / 信任 0.24 / 亲密 0.23）',
    mSys.getSellPrice('草药', { relationship: '冷淡' }) === 0.30 &&
    mSys.getSellPrice('草药', { relationship: '友好' }) === 0.25 &&
    mSys.getSellPrice('草药', { relationship: '信任' }) === 0.24 &&
    mSys.getSellPrice('草药', { relationship: '亲密' }) === 0.23);

  // 7o. 边界条件：未知材料 / restricted / amount 参数
  check('7o. getSellPrice 边界：未知材料 → 0；灾厄金属 (restricted) → 0；草药 amount=5 → 1.25',
    mSys.getSellPrice('不存在的材料') === 0 &&
    mSys.getSellPrice('灾厄金属') === 0 &&
    mSys.getSellPrice('草药', { amount: 5 }) === 1.25);

  // ============ T3：自炼真实成本 ============
  // 7p. calculateRealMaterialCost：单品/多量/组合/缺失
  const single = mSys.calculateRealMaterialCost({ '草药': 1 });
  const multi  = mSys.calculateRealMaterialCost({ '草药': 5 });
  const combo  = mSys.calculateRealMaterialCost({ '草药': 2, '净化苔藓': 1 });
  const hasMissing = mSys.calculateRealMaterialCost({ '草药': 1, '虚构材料': 1 });
  check('7p. calculateRealMaterialCost：草药×1=0.5 / 草药×5=2.5 / 组合(草药×2+净化苔藓×1)=1.5 / 含缺失材料 missing=[虚构材料]',
    single.cost === 0.5 &&
    multi.cost === 2.5 &&
    combo.cost === 1.5 &&
    hasMissing.cost === 0.5 &&
    hasMissing.missing.length === 1 &&
    hasMissing.missing[0] === '虚构材料');

  // 7q. brewPotion 按世界书规则扣费：materialCost = Math.ceil(basePrice/2)
  //     治疗药水 basePrice=6 → cost = 3，金币扣除按 3
  const brewChar = base();
  brewChar.hp = { current: 100, max: 100 };
  brewChar.attributes['智力'] = 20;
  brewChar.skills = { '药剂炼制': { level: 1 } };
  brewChar.hasTool = { '炼金工具': true };
  brewChar.inventory = [
    { name: '草药', amount: 5, type: '材料' },
    { name: '净化苔藓', amount: 5, type: '材料' }
  ];
  brewChar.gold = 5;
  const brewRes = alchMod.alchemySystem.brewPotion(brewChar, '治疗药水');
  check('7q. brewPotion 按世界书规则：materialCost = Math.ceil(basePrice/2) = 3 + 金币扣除按 3',
    brewRes.success === true &&
    brewRes.materialCost === 3 &&
    brewChar.gold === 5 - 3);  // 5 - 3 = 2

  // 7s. 自炼正收益断言：每个非稀有配方，basePrice - ceil(basePrice/2) > materialSum
  //     即"卖成品 - 自炼成本 - 买材料成本 > 0"，确保自炼是赚钱的
  const negativeProfit = [];
  for (const [name, r] of Object.entries(R)) {
    if (r.rare) continue;
    if (r.basePrice === null) continue;
    const matSum = Object.entries(r.materials).reduce((s, [m, n]) =>
      s + (MATERIALS[m]?.price || 0) * n, 0);
    const cost = Math.ceil(r.basePrice / 2);
    const profit = r.basePrice - cost - matSum;
    if (profit <= 0) {
      negativeProfit.push(`${name}: profit=${profit.toFixed(2)}`);
    }
  }
  check('7s. 自炼正收益：21 条非稀有配方 basePrice - ceil(bp/2) > materialSum（自炼赚钱）',
    negativeProfit.length === 0);

  // ============ T4：采集接口 ============
  const { GATHERING_TABLES, listGatheringLocations } = await import('./module/gathering-tables.js');

  // 7t. parseAmount 骰子表达式：'1d3' ∈ [1,3] / '1' = 1 / '2d6' ∈ [2,12]
  let parseOk = true;
  for (let i = 0; i < 100; i++) {
    const v = mSys.parseAmount('1d3');
    if (v < 1 || v > 3) { parseOk = false; break; }
  }
  let parseOk2 = true;
  for (let i = 0; i < 100; i++) {
    const v = mSys.parseAmount('2d6');
    if (v < 2 || v > 12) { parseOk2 = false; break; }
  }
  check('7t. parseAmount 骰子表达式：\'1d3\' ∈ [1,3] / \'2d6\' ∈ [2,12] / \'1\' = 1',
    parseOk && parseOk2 && mSys.parseAmount('1') === 1);

  // 7u. 1000 次灰烬森林模拟：草药 ~40% / 祖母绿 ~1% / 全部在 MATERIALS
  let herbCount = 0, emeraldCount = 0, invalidCount = 0;
  const forestTable = GATHERING_TABLES['地理/灰烬森林'];
  for (let i = 0; i < 1000; i++) {
    const { entry } = mSys.rollOneGather(forestTable.materials);
    if (entry.name === '草药') herbCount++;
    if (entry.name === '祖母绿') emeraldCount++;
    if (!MATERIALS[entry.name]) invalidCount++;
  }
  check('7u. 1000 次模拟：草药 ~40% (期望 400±100) + 祖母绿 ~1% (期望 10±10) + 0 无效材料',
    Math.abs(herbCount - 400) < 100 &&
    Math.abs(emeraldCount - 10) < 10 &&
    invalidCount === 0);

  // 7v. 采集 + 冷却：首次成功 + 立即二次调用失败 + cooldownRemaining > 0
  const gatherChar = base();
  gatherChar.gameTime = { year: 300, month: 11, day: 12, hour: 7, minute: 10 };
  gatherChar.inventory = [];
  const g1 = mSys.gatherMaterials('地理/灰烬森林', gatherChar);
  const g2 = mSys.gatherMaterials('地理/灰烬森林', gatherChar);  // 立即再调用
  check('7v. 采集冷却：首次成功 + 立即二次调用失败 + cooldownRemaining > 0 + 背包有材料',
    g1.success === true && g1.materials.length > 0 &&
    g2.success === false && g2.cooldownRemaining > 0 &&
    gatherChar.inventory.length > 0);

  // 7w. 未知采集点 → error
  check('7w. gatherMaterials 未知采集点 → success: false + error',
    mSys.gatherMaterials('地理/不存在的地点', gatherChar).success === false);

  // 7x. listGatheringLocations 至少 1 个（灰烬森林）
  check('7x. listGatheringLocations 返回 ≥1 个注册采集点',
    listGatheringLocations().length >= 1 &&
    listGatheringLocations().includes('地理/灰烬森林'));

  // 7r. 经济平衡断言：所有非稀有配方的 basePrice ≥ materialSum（自炼不亏本）
  //     容忍 1 金以内的舍入误差；稀有配方不校验（commissionNPC 议价）
  const balanceImbalanced = [];
  for (const [name, r] of Object.entries(R)) {
    if (r.rare) continue;
    if (r.basePrice === null) continue;
    const matSum = Object.entries(r.materials).reduce((s, [m, n]) => {
      return s + (MATERIALS[m]?.price || 0) * n;
    }, 0);
    if (r.basePrice + 1 < matSum) {
      balanceImbalanced.push(`${name}: basePrice=${r.basePrice} < matSum=${matSum.toFixed(2)}`);
    }
  }
  check('7r. 经济平衡：21 条非稀有配方 basePrice ≥ materialSum（自炼不亏本，容忍 1 金舍入）',
    balanceImbalanced.length === 0);

  const healed = alchMod.alchemySystem.usePotion(
    { mp: 10, maxMp: 50 },
    { brewed: true, name: '传奇法力药水', effect: '恢复全部法力值', category: '法力', effectValue: 10 }
  );
  check('7e. 传奇法力药水行为：MP 10 → 补满至 50（全满特判）',
    healed.success === true && healed.restored === 40 && healed.success && healed.restored === 40);

  console.log('\n' + (fail === 0 ? '✅ 全部通过（' + pass + ' 项）' : '❌ 失败 ' + fail + ' 项 / 通过 ' + pass + ' 项'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('测试执行异常:', e); process.exit(1); });
