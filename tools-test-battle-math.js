// 战斗数学校验测试：R1 伤害-HP一致 / R2 耐久漏扣 / R3 归零未结算 / 容错边界
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');

const start = html.indexOf('function battleMathCheck');
const end = html.indexOf('window.battleMathCheck');
if (start < 0 || end < 0) { console.log('提取 battleMathCheck 失败'); process.exit(1); }
const src = html.slice(start, end);

const sb = { console: { log(){}, warn(){}, info(){} }, window: {} };
vm.createContext(sb);
vm.runInContext(src + '\nbattleMathCheck', sb);
const check = sb.battleMathCheck;

let pass = 0, fail = 0;
const check1 = (name, cond) => { cond ? pass++ : fail++; console.log((cond ? '✅' : '❌') + ' ' + name); };
const mkGd = (hp, dur) => ({
  hp: { current: hp, max: 100 },
  equipment: dur === undefined ? {} : { mainHand: { name: '铁废土短刃', durability: { current: dur, max: 70 } } }
});
const playerName = '凛夏';

// R1：敌人回合伤害 5+3=8，主角命中 1 次（耐久不受 R1 影响）
const cardR1 = `
【凛夏的回合】
✓ 命中
[ 伤害：6 ]

【灰烬狼A的回合】
✓ 命中
[ 伤害：5 ]

【灰烬狼B的回合】
✓ 命中
[ 伤害：3 ]
`;
let r = check(mkGd(100, 70), mkGd(92, 69), cardR1, playerName);
check1('R1a 伤害一致（-8）不警示', r === null);
r = check(mkGd(100, 70), mkGd(97, 69), cardR1, playerName);
check1('R1b 伤害-HP 不一致警示（-8 vs -3）', r !== null && r.indexOf('-8') >= 0 && r.indexOf('-3') >= 0);
r = check(mkGd(90, 70), mkGd(97, 69), cardR1, playerName);
check1('R1c 治疗混合场景降级不警示', r === null);

// R2：主角命中 2 次（卡面承伤 8 与差分一致），耐久分文未动
const cardR2 = `
【凛夏的回合】
✓ 命中
[ 伤害：6 ]

【灰烬狼A的回合】
✓ 命中
[ 伤害：4 ]

【凛夏的回合】
✓ 命中
[ 伤害：5 ]

【灰烬狼B的回合】
✓ 命中
[ 伤害：4 ]
`;
r = check(mkGd(100, 70), mkGd(92, 70), cardR2, playerName);
check1('R2a 命中2次耐久未动 → 警示', r !== null && r.indexOf('耐久') >= 0);

// R2b 单次命中漏扣：仅 console 降级，不进叙事流
const cardR2b = `
【凛夏的回合】
✓ 命中
[ 伤害：6 ]

【灰烬狼A的回合】
✓ 命中
[ 伤害：6 ]
`;
r = check(mkGd(100, 70), mkGd(94, 70), cardR2b, playerName);
check1('R2b 单次命中漏扣仅 console（无叙事警示）', r === null);

// R3：卡面承伤 5 与差分一致（HP 5 → 0），无死亡结算
const cardR3 = `
【灰烬狼A的回合】
✓ 命中
[ 伤害：5 ]
`;
r = check(mkGd(5, 70), mkGd(0, 70), cardR3, playerName);
check1('R3a HP 归零未结算警示', r !== null && r.indexOf('归零') >= 0);

const cardR3b = cardR3 + '\n凛夏倒在了血泊之中。';
r = check(mkGd(5, 70), mkGd(0, 70), cardR3b, playerName);
check1('R3b HP 归零已结算不警示', r === null);

// 边界：无回合块结构
r = check(mkGd(100, 70), mkGd(50, 70), '一段没有回合块的普通战斗描述。', playerName);
check1('R1d 无回合块静默跳过', r === null);

console.log('\n' + (fail === 0 ? '✅ 全部通过（' + pass + ' 项）' : '❌ 失败 ' + fail + ' 项 / 通过 ' + pass + ' 项'));
process.exit(fail ? 1 : 0);
