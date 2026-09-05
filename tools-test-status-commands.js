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
  currency: { gold: 10 }, conditions: {}, gameTime: { year: 300, month: 11, day: 12, hour: 7, minute: 10 },
  progress: { currentLocation: '佣兵镇·锈钉', currentPlace: '佣兵公会大厅' }
});

// 1. 获得状态
let r = processor.applyCommands(base(), [{ action: 'set', key: '状态.中毒', value: { 来源: '感染撕咬' } }]);
check('1. set 状态.中毒 落地（带来源）', r.gameData.conditions['中毒'] && r.gameData.conditions['中毒'].来源 === '感染撕咬');

// 2. 布尔形式
r = processor.applyCommands(base(), [{ action: 'set', key: '状态.失明', value: true }]);
check('2. set 状态.失明 = true 落地', r.gameData.conditions['失明'] === true);

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

console.log('\n' + (fail === 0 ? '✅ 全部通过（' + pass + ' 项）' : '❌ 失败 ' + fail + ' 项 / 通过 ' + pass + ' 项'));
process.exit(fail ? 1 : 0);
