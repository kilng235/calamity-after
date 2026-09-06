// 状态命令测试：conditions 白名单 / 层级钳制 / delete 解除 / 未知名拒绝
globalThis.window = globalThis;
const fs = require('fs');
new Function(fs.readFileSync(__dirname + '/module/command-engine.js', 'utf8'))();
new Function(fs.readFileSync(__dirname + '/module/command-processor.js', 'utf8'))();
const processor = window.commandProcessor;

let pass = 0, fail = 0;
const check = (name, cond) => { cond ? pass++ : fail++; console.log((cond ? '✅' : '❌') + ' ' + name); };
const base = () => ({
  character: { name: '凛夏', level: 1 }, hp: { current: 100, max: 100 },
  attributes: { 力量: 10, 敏捷: 10, 体质: 10, 感知: 10, 智力: 10, 魅力: 10 },
  equipment: {}, inventory: [],
  currency: { gold: 10 }, conditions: {}, gameTime: { year: 300, month: 11, day: 12, hour: 7, minute: 10 },
  progress: { currentLocation: '佣兵镇·锈钉', currentPlace: '佣兵公会大厅' }
});

// 1. 获得状态
let r = processor.applyCommands(base(), [{ action: 'set', key: '状态.中毒', value: { 来源: '感染撕咬' } }]);
check('1. set 状态.中毒 落地（带来源）', r.gameData.conditions['中毒'] && r.gameData.conditions['中毒'].来源 === '感染撕咬');

// 2. 布尔形式（失明为旧名：契约迁移为规范名「目盲」）
r = processor.applyCommands(base(), [{ action: 'set', key: '状态.失明', value: true }]);
check('2. set 状态.失明 迁移为目盲落地', r.gameData.conditions['目盲'] === true && r.gameData.conditions['失明'] === undefined);

// 3. 力竭层级钳制 1~3
r = processor.applyCommands(base(), [
  { action: 'set', key: '状态.力竭.层级', value: 7 }
]);
check('3a. 力竭层级 7 钳制为 3', r.gameData.conditions['力竭'].层级 === 3);
r = processor.applyCommands(base(), [{ action: 'set', key: '状态.力竭.层级', value: 0 }]);
check('3b. 力竭层级 0 下限钳制为 1', r.gameData.conditions['力竭'].层级 === 1);

// 4. 侵蚀层级钳制 1~2
r = processor.applyCommands(base(), [{ action: 'set', key: '状态.侵蚀.层级', value: 5 }]);
check('4. 侵蚀层级 5 钳制为 2', r.gameData.conditions['侵蚀'].层级 === 2);

// 5. 未知状态名拒绝
r = processor.applyCommands(base(), [{ action: 'set', key: '状态.无敌模式', value: true }]);
check('5. 未知状态名「无敌模式」被拒绝', r.gameData.conditions['无敌模式'] === undefined);

// 6. 解除状态
r = processor.applyCommands(base(), [
  { action: 'set', key: '状态.燃烧', value: true },
  { action: 'delete', key: '状态.燃烧' }
]);
check('6. delete 状态.燃烧 解除', r.gameData.conditions['燃烧'] === undefined);

// 7. 元素交互由 AI 执行（两命令连贯：中毒转燃烧）
r = processor.applyCommands(base(), [
  { action: 'delete', key: '状态.中毒' },
  { action: 'set', key: '状态.燃烧', value: true }
]);
check('7. 元素交互转化（删中毒+得燃烧）连贯执行', r.gameData.conditions['燃烧'] === true && r.gameData.conditions['中毒'] === undefined);

// ==================== MP / 装备槽 / 负重（登记档案修复批） ====================
// 8. MP 别名落地（此前被拒：MP 不在可写根/别名表）
r = processor.applyCommands(base(), [{ action: 'set', key: 'MP', value: 30 }]);
check('8a. set MP = 30 落地 character.mp', r.gameData.character.mp === 30);
r = processor.applyCommands(base(), [{ action: 'set', key: '法力', value: 20 }]);
check('8b. set 法力 = 20 落地 character.mp', r.gameData.character.mp === 20);
r = processor.applyCommands(base(), [{ action: 'set', key: '角色.MP', value: 15 }]);
check('8c. 角色.MP 大小写归一（不产生 character.MP 垃圾键）', r.gameData.character.mp === 15 && r.gameData.character.MP === undefined);

// 9. MP 上限钳制（智力×5；智力 10 → 50）
r = processor.applyCommands(base(), [{ action: 'set', key: 'MP', value: 100 }]);
check('9. MP 超上限钳回 智力×5 = 50', r.gameData.character.mp === 50);

// 10. 装备槽中文别名归一（此前落到 equipment.主手 中文键成死数据）
r = processor.applyCommands(base(), [
  { action: 'set', key: '装备.主手', value: { name: '铁废土短刃', durability: { current: 70, max: 70 } } },
  { action: 'add', key: '装备.主手.耐久', value: -1 }
]);
check('10a. 装备.主手 → mainHand 且 add 耐久 = -1 作用于 durability.current（max 保留）',
  r.gameData.equipment.mainHand && r.gameData.equipment.mainHand.name === '铁废土短刃'
  && r.gameData.equipment.mainHand.durability.current === 69 && r.gameData.equipment.mainHand.durability.max === 70
  && r.gameData.equipment['主手'] === undefined);
r = processor.applyCommands(base(), [
  { action: 'set', key: '装备.身体', value: { name: '铁废布拼装甲', durability: { current: 10, max: 40 } } },
  { action: 'add', key: '装备.身体.耐久', value: -50 },
  { action: 'set', key: '装备.足部', value: { name: '旧皮靴' } }
]);
check('10b. 装备.身体/装备.足部 → body/feet；耐久扣穿钳到 0',
  r.gameData.equipment.body && r.gameData.equipment.body.name === '铁废布拼装甲'
  && r.gameData.equipment.body.durability.current === 0 && r.gameData.equipment.body.durability.max === 40
  && r.gameData.equipment.feet && r.gameData.equipment.feet.name === '旧皮靴');
r = processor.applyCommands(base(), [
  { action: 'set', key: '装备.主手', value: { name: '铁剑', durability: { current: 50, max: 50 } } },
  { action: 'set', key: '装备.主手.耐久', value: 30 }
]);
check('10c. set 耐久 = 30 作用 current（整对象写法仍走深合并）',
  r.gameData.equipment.mainHand.durability.current === 30 && r.gameData.equipment.mainHand.durability.max === 50);
r = processor.applyCommands(base(), [
  { action: 'set', key: '装备.mainHand', value: { name: '直写标准槽', durability: { current: 80, max: 80 } } }
]);
check('10d. 装备.mainHand 直写标准槽不受影响', r.gameData.equipment.mainHand.name === '直写标准槽');

// 11. 旧存档中文槽位垃圾键迁移（normalize 阶段完成）
let dirty = base();
dirty.equipment['主手'] = { name: '锈铁剑', durability: { current: 30, max: 30 } };
dirty.equipment['身体'] = { name: '旧布甲' };
dirty.character['MP'] = 42;   // 旧存档大写 MP 垃圾键
r = processor.applyCommands(dirty, [{ action: 'set', key: '生命值', value: 90 }]);
check('11a. 中文槽位键迁入标准槽位且原键删除', r.gameData.equipment.mainHand && r.gameData.equipment.mainHand.name === '锈铁剑' && r.gameData.equipment['主手'] === undefined && r.gameData.equipment.body && r.gameData.equipment.body.name === '旧布甲');
check('11b. 大写 character.MP 迁移为 character.mp', r.gameData.character.mp === 42 && r.gameData.character.MP === undefined);
// 标准槽位已有装备时，中文键版本被丢弃（不覆盖有效数据）
let dirty2 = base();
dirty2.equipment.mainHand = { name: '新武器' };
dirty2.equipment['主手'] = { name: '旧武器' };
r = processor.applyCommands(dirty2, []);
check('11c. 标准槽位已有装备时中文键版本被丢弃', r.gameData.equipment.mainHand.name === '新武器' && r.gameData.equipment['主手'] === undefined);

// 12. 负重仍被拒绝（无存储字段，协议明令禁止写入）
r = processor.applyCommands(base(), [{ action: 'add', key: '负重', value: 34 }]);
check('12. set 负重 被拒绝（派生值不入档）', r.report.rejected.length === 1 && r.gameData['负重'] === undefined);

// 13. 全档案登记流程（对齐用户实测输入）不再出现拒绝
r = processor.applyCommands({}, [
  { action: 'set', key: '角色.名字', value: '张慕' },
  { action: 'set', key: '属性.力量', value: 12 },
  { action: 'set', key: '生命值', value: 100 },
  { action: 'set', key: '生命上限', value: 100 },
  { action: 'set', key: 'MP', value: 50 },
  { action: 'set', key: 'AC', value: 11 },
  { action: 'add', key: '金币', value: 10 },
  { action: 'push', key: '特质', value: '武艺' },
  { action: 'push', key: '特质', value: '警觉' },
  { action: 'set', key: '装备.主手', value: { name: '铁废土短刃', durability: { current: 70, max: 70 } } },
  { action: 'set', key: '装备.身体', value: { name: '铁废布拼装甲', durability: { current: 40, max: 40 } } },
  { action: 'push', key: '背包', value: { name: '磨刀石', count: 1 } }
]);
check('13. 登记档案全流程 12 条命令 0 拒绝', r.report.rejected.length === 0);

// ==================== 负重机制（引擎自动结算） ====================
const encOf = gd => processor.computeEncumbrance(gd);

// 14. 重量来源：物品自带 weight 优先，无 weight 按名称估算
let gd14 = base();
gd14.inventory = [
  { name: '治疗药水', count: 2, weight: 0.5 },   // 自带 weight → 1.0
  { name: '板甲', count: 1 },                    // 估算 15
  { name: '神秘零件', count: 3 }                 // 无命中 → type/misc 兜底 1 → 3
];
const enc14 = encOf(gd14);
check('14. 重量三级来源（weight 字段/名称估算/类型兜底）', enc14.total === 19);

// 15. 上限 = 10 + 力量×2；装备槽计入总重
let gd15 = base();
gd15.attributes['力量'] = 10;   // 上限 30
gd15.equipment.mainHand = { name: '铁剑' };       // 2
gd15.equipment.body = { name: '板甲' };           // 15
gd15.inventory = [{ name: '矿石', count: 4, weight: 2 }];  // 8
const enc15 = encOf(gd15);
check('15. 装备+背包计入总重（25/30，未超重）', enc15.cap === 30 && enc15.total === 25 && !enc15.over);

// 16. 超重自动落地 / 卸载后自动解除
let gd16 = base();   // 力量默认 10 → 上限 30
gd16.inventory = [
  { name: '矿石', count: 10, weight: 2 },   // 20
  { name: '焦木树心', count: 5, weight: 2 } // 10 → 总 30... 临界不算超；再加一件
];
gd16.inventory.push({ name: '磨刀石', count: 1 });  // +1 → 31
r = processor.applyCommands(gd16, [{ action: 'set', key: '生命值', value: 80 }]);
check('16a. 总重 31 > 30 → 超重状态自动落地', r.gameData.conditions['超重'] === true);
// 卸载 3 件矿石（weight 2×3=6 → 总 25 < 30）→ 自动解除
r = processor.applyCommands(r.gameData, [
  { action: 'delete', key: '背包[2]' },
  { action: 'delete', key: '背包[1]' },
  { action: 'delete', key: '背包[0]' }
]);
check('16b. 卸载后总重回落 → 超重自动解除', r.gameData.conditions['超重'] === undefined);

// 17. 极端超重（>1.5×上限 = 45）→ 层级 2
let gd17 = base();
gd17.inventory = [{ name: '矿石', count: 23, weight: 2 }];  // 46
r = processor.applyCommands(gd17, [{ action: 'set', key: '生命值', value: 70 }]);
check('17. 总重 46 > 45 → 超重 层级 2（极端超重）', r.gameData.conditions['超重'] && r.gameData.conditions['超重'].层级 === 2);

// 18. AI 无法用命令伪造/解除超重（引擎派生状态，结算时以实际重量为准）
let gd18 = base();
r = processor.applyCommands(gd18, [{ action: 'set', key: '状态.超重', value: true }]);
check('18. 未超重时命令写的超重被引擎解除', r.gameData.conditions['超重'] === undefined);

// ==================== 升级公式对齐（《经验与成长》§4）+ 属性点记账 ====================
// 19. Lv1→2：经验 60 → 升 1 级，余 10；线性曲线 expToNext = 等级×50；HP +10；属性点 +1
r = processor.applyCommands(base(), [{ action: 'add', key: '经验', value: 60 }]);
check('19. 升 Lv2：exp 余 10 / expToNext=100 / hp.max=110 / unspentPoints=1 / PB=2',
  r.gameData.character.level === 2 && r.gameData.character.exp === 10
  && r.gameData.character.expToNextLevel === 100 && r.gameData.hp.max === 110
  && r.gameData.progress.unspentPoints === 1 && r.gameData.character.proficiencyBonus === 2);

// 20. 一口气到 Lv5：累计 510 经验 → Lv5 余 10；属性点 1+1+2+1=5；PB 在 Lv5 进入新等阶 +1→3；hp.max=100+10×(5−1)=140
r = processor.applyCommands(base(), [{ action: 'add', key: '经验', value: 510 }]);
check('20. 升 Lv5：exp 余 10 / unspent=5 / PB=3 / hp.max=140',
  r.gameData.character.level === 5 && r.gameData.character.exp === 10
  && r.gameData.progress.unspentPoints === 5 && r.gameData.character.proficiencyBonus === 3
  && r.gameData.hp.max === 140);

// 21. expToNextLevel 为引擎派生值：AI 写 9999 会被纠偏为 等级×50
r = processor.applyCommands(base(), [{ action: 'set', key: '升级经验', value: 9999 }]);
check('21. AI 写升级经验被派生纠偏（Lv1 → 50）', r.gameData.character.expToNextLevel === 50);

// 22. 出血状态（此前白名单缺名被拒）
r = processor.applyCommands(base(), [{ action: 'set', key: '状态.出血', value: { 来源: '锋锐刃' } }]);
check('22. set 状态.出血 落地（白名单已补）', r.gameData.conditions['出血'] && r.gameData.conditions['出血'].来源 === '锋锐刃');

// 23. 人情值钳制 [0,100]（关系系统双轴）
r = processor.applyCommands(base(), [
  { action: 'set', key: '关系.莉娅.人情值', value: 150 },
  { action: 'set', key: '关系.莉娅.好感度', value: -200 }
]);
check('23. 人情值钳到 100 / 好感度钳到 -100', r.gameData.relationships['莉娅'].人情值 === 100 && r.gameData.relationships['莉娅'].好感度 === -100);

console.log('\n' + (fail === 0 ? '✅ 全部通过（' + pass + ' 项）' : '❌ 失败 ' + fail + ' 项 / 通过 ' + pass + ' 项'));
process.exit(fail ? 1 : 0);
