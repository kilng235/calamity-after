// 战斗追踪器测试：原始卡摄取 / 跨卡延续 / 敌人HP行 / 结果 / 渲染后文本重建
globalThis.window = globalThis;
const fs = require('fs');
new Function(fs.readFileSync(__dirname + '/module/battle-tracker.js', 'utf8'))();
const bt = window.battleTracker;

let pass = 0, fail = 0;
const check = (name, cond) => { cond ? pass++ : fail++; console.log((cond ? '✅' : '❌') + ' ' + name); };

const gd = { character: { name: '凛夏' }, hp: { current: 72, max: 100 } };

// 样例1：开局卡（权威格式样例 + 敌人HP行）
const card1 = `
╔════════════════════════════╗
║          ⚔️  战斗开始  ⚔️   ║
╚════════════════════════════╝
先攻顺序：凛夏（15） → 灰烬狼A（12） → 灰烬狼B（8）
交战距离：10米

━━━━━ 第1回合 ━━━━━

【凛夏的回合】
行动：使用铁剑攻击灰烬狼A
[ 攻击检定：d20(14) + 3 = 17 vs AC 13 ]
✓ 命中
[ 伤害：5 ]
[ 灰烬狼A HP：19/24 ]

【灰烬狼A的回合】
行动：撕咬凛夏
[ 攻击检定：d20(8) + 2 = 10 vs AC 15 ]
✗ 未命中
`;
let st = bt.ingest(card1, gd);
check('1. 战斗激活且无结果', st.active === true && st.result === null);
check('2. 回合=1 距离=10米', st.round === 1 && st.distance === '10米');
check('3. 主角+双狼三名行动者', st.actors.length === 3 && st.actors[0].name === '凛夏' && st.actors[0].side === 'player');
check('4. 灰烬狼A HP 行解析 19/24', st.actors.find(a => a.name === '灰烬狼A').hp.cur === 19);
check('5. 灰烬狼B 无 HP（未受击）', st.actors.find(a => a.name === '灰烬狼B').hp === null);
check('6. 伤害事件归属当前行动者（凛夏）', st.actors[0].lastHit && st.actors[0].lastHit.damage === 5);

// 样例2：延续卡（无开始横幅，跨回复）
const card2 = `
━━━━━ 第2回合 ━━━━━

【凛夏的回合】
行动：挥剑横扫
✓ 命中
💥 重击！伤害翻倍！
[ 伤害：12 ]
[ 灰烬狼A HP：7/24 ]

【灰烬狼B的回合】
行动：扑咬
[ 伤害：8 ]
`;
st = bt.ingest(card2, gd);
check('7. 延续卡不重置：仍是同一场战斗', st.round === 2 && st.actors.length === 3);
check('8. 灰烬狼A HP 更新 7/24', st.actors.find(a => a.name === '灰烬狼A').hp.cur === 7);

// 样例3：结束卡
st = bt.ingest('⚔️ 战斗结束\n胜利！击败灰烬狼A、灰烬狼B。', gd);
check('9. 结果=胜利 且战斗结束', st.active === false && st.result === '胜利');

// 样例4：渲染后文本重建（渲染器改写了行首标记）
bt._reset();
const rendered = [
  '⚔️ 战斗开始',
  '✦ 先攻：凛夏（15） → 灰烬狼A（12）',
  '↔ 10 米',
  '第 1 回合',
  '◆ 凛夏',
  '行动：攻击灰烬狼A',
  '✓ 命中',
  '[ 伤害：6 ]',
  '[ 灰烬狼A HP：18/24 ]',
].join('\n');
st = bt.ingest(rendered, gd);
check('10. 渲染后文本：开始横幅识别', st.active === true);
check('11. 渲染后文本：先攻名单解析', st.actors.some(a => a.name === '灰烬狼A'));
check('12. 渲染后文本：距离与回合', st.distance === '10 米' && st.round === 1);
check('13. 渲染后文本：HP 行解析', st.actors.find(a => a.name === '灰烬狼A').hp.cur === 18);

// 样例5：无战斗卡
bt._reset();
st = bt.ingest('普通的叙事文本，没有战斗。', gd);
check('14. 无战斗标记不激活', bt.hasBattle() === false);

console.log('\n' + (fail === 0 ? '✅ 全部通过（' + pass + ' 项）' : '❌ 失败 ' + fail + ' 项 / 通过 ' + pass + ' 项'));
process.exit(fail ? 1 : 0);
