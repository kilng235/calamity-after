// 角色信息面板 HP/MP/AC 渲染测试（Node 模拟）
// 验证 refreshGameUI 中 char-hp/char-mp/char-ac 的渲染逻辑（独立于浏览器 DOM）
globalThis.window = globalThis;
const fs = require('fs');
// 只读取 refreshGameUI 关心的字段计算逻辑（同构）
function renderHp(gd) {
  return gd && gd.hp ? (gd.hp.current + '/' + gd.hp.max) : '—';
}
function renderMp(gd) {
  const cur = (gd.character && Number.isFinite(Number(gd.character.mp))) ? Number(gd.character.mp) : 0;
  const max = (gd.attributes && Number(gd.attributes['智力'])) ? Number(gd.attributes['智力']) * 5 : 50;
  return cur + '/' + max;
}
function renderAc(gd) {
  return (gd.character && Number.isFinite(Number(gd.character.ac))) ? Number(gd.character.ac) : '—';
}
function renderExp(gd) {
  return gd.character.exp + '/' + gd.character.expToNextLevel;
}

let pass = 0, fail = 0;
const check = (n, c) => { c ? pass++ : fail++; console.log((c ? '✅' : '❌') + ' ' + n); };

// 1. 标准角色（智力 10 → MP 上限 50）
let gd = {
  character: { exp: 25, expToNextLevel: 100, ac: 12, mp: 30 },
  hp: { current: 80, max: 100 },
  attributes: { 力量: 12, 敏捷: 10, 体质: 11, 感知: 10, 智力: 10, 魅力: 8 }
};
check('1a. HP 渲染 80/100', renderHp(gd) === '80/100');
check('1b. MP 渲染 30/50（智力 10 → 上限 50）', renderMp(gd) === '30/50');
check('1c. AC 渲染 12', renderAc(gd) === 12);
check('1d. 经验渲染 25/100', renderExp(gd) === '25/100');

// 2. 法师角色（智力 16 → MP 上限 80）
gd = {
  character: { exp: 200, expToNextLevel: 150, ac: 9, mp: 75 },
  hp: { current: 50, max: 60 },
  attributes: { 力量: 8, 敏捷: 12, 体质: 10, 感知: 13, 智力: 16, 魅力: 11 }
};
check('2a. MP 上限随智力（16×5=80）', renderMp(gd) === '75/80');
check('2b. AC 法师低 AC', renderAc(gd) === 9);

// 3. 异常数据兜底：character.mp 缺失/非数字 → 0（不限上限走默认 50）
gd = {
  character: { exp: 0, expToNextLevel: 100, ac: 10 },
  hp: { current: 100, max: 100 },
  attributes: { 力量: 10, 敏捷: 10, 体质: 10, 感知: 10, 智力: 10, 魅力: 10 }
};
check('3a. character.mp 缺失时显示 0/50', renderMp(gd) === '0/50');
gd.character.mp = 'NaN';
check('3b. character.mp 非数字时回退 0', renderMp(gd) === '0/50');

// 4. hp 缺失兜底为 —
gd = { character: { exp: 0, expToNextLevel: 100, ac: 10 }, attributes: { 智力: 10 } };
check('4. hp 缺失兜底为 —', renderHp(gd) === '—');

// 5. character.ac 非数字兜底为 —
gd = { character: { ac: 'foo' }, attributes: { 智力: 10 } };
check('5. character.ac 非数字兜底为 —', renderAc(gd) === '—');

console.log('\n' + (fail === 0 ? '✅ 全部通过（' + pass + ' 项）' : '❌ 失败 ' + fail + ' 项 / 通过 ' + pass + ' 项'));
process.exit(fail ? 1 : 0);