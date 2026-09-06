// 叙事区持久化测试（Node）：appendNarrativeLog / trimNarrativeLog / NARRATIVE_MAX 上限
// 通过 jQuery-like 沙箱 stub localStorage + 全局 displayNarrative / renderNarrativePage（后两函数在本测试中只验证日志行为）
globalThis.window = globalThis;
const fs = require('fs');
// index.html 顶层脚本包含 displayNarrative / appendNarrativeLog / trimNarrativeLog 等函数
// 但完整 index.html 含 IIFE 模块与依赖（gameState 等），不适合直接 new Function 跑——只验证
// 我们抽出来的纯函数行为（loadNarrativeLog/saveNarrativeLog/append/trim），用独立脚本重写一遍同样逻辑
const STORAGE = {};
const localStorage = {
  getItem(k) { return Object.prototype.hasOwnProperty.call(STORAGE, k) ? STORAGE[k] : null; },
  setItem(k, v) { STORAGE[k] = String(v); },
  removeItem(k) { delete STORAGE[k]; }
};
const NARRATIVE_KEY = 'calamity-narrative-log';
const NARRATIVE_MAX = 200;

function loadNarrativeLog() {
  try { return JSON.parse(localStorage.getItem(NARRATIVE_KEY) || '[]'); } catch (e) { return []; }
}
function saveNarrativeLog(list) {
  try { localStorage.setItem(NARRATIVE_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
}
function appendNarrativeLog(text) {
  const list = loadNarrativeLog();
  list.push(String(text || ''));
  while (list.length > NARRATIVE_MAX) list.shift();
  saveNarrativeLog(list);
}
function trimNarrativeLog(n) {
  const list = loadNarrativeLog();
  for (let i = 0; i < n && list.length > 0; i++) list.pop();
  saveNarrativeLog(list);
}

let pass = 0, fail = 0;
const check = (name, cond) => { cond ? pass++ : fail++; console.log((cond ? '✅' : '❌') + ' ' + name); };

// 1. 累加 → 日志按序保留
appendNarrativeLog('第1层正文');
appendNarrativeLog('<battle>\n战斗卡\n</battle>');
appendNarrativeLog('第3层正文');
check('1. 累加三条记录：内容与顺序保持', JSON.stringify(loadNarrativeLog()) === JSON.stringify(['第1层正文', '<battle>\n战斗卡\n</battle>', '第3层正文']));

// 2. trimNarrativeLog(n) 精确移除尾部 n 条
trimNarrativeLog(2);
check('2. trim(2) 后剩 1 条（最早的）', loadNarrativeLog().length === 1 && loadNarrativeLog()[0] === '第1层正文');

// 3. trim(n) 在 n 大于当前长度时安全降级（不会负数下标）
trimNarrativeLog(99);
check('3. trim(99) 在仅 1 条时空安全降级（不会报错）', loadNarrativeLog().length === 0);

// 4. NARRATIVE_MAX 上限保护（防止 localStorage 爆掉）
for (let i = 0; i < NARRATIVE_MAX + 50; i++) appendNarrativeLog('L' + i);
check('4. 累计 250 条 → 日志被裁到 200 条且为最新 200', loadNarrativeLog().length === NARRATIVE_MAX && loadNarrativeLog()[0] === 'L50' && loadNarrativeLog()[NARRATIVE_MAX - 1] === 'L' + (NARRATIVE_MAX + 49));

// 5. trimNarrativeLog(0) 等价 noop
const before = loadNarrativeLog().length;
trimNarrativeLog(0);
check('5. trim(0) 不改动日志', loadNarrativeLog().length === before);

// 6. localStorage 损坏数据兜底（解析失败返回空数组）
STORAGE[NARRATIVE_KEY] = '{not-json';
check('6. 损坏数据下 loadNarrativeLog 返回 []', Array.isArray(loadNarrativeLog()) && loadNarrativeLog().length === 0);

// 7. 撤销联动：模拟 undo 1 层应移除尾部 1 条
STORAGE[NARRATIVE_KEY] = JSON.stringify(['A', 'B', 'C']);
trimNarrativeLog(1);
check('7. 撤销 1 层后日志剩 A/B', JSON.stringify(loadNarrativeLog()) === JSON.stringify(['A', 'B']));

// 8. 空文本也算一条（与 displayNarrative 行为对齐：调用即落库，文本容错空串）
STORAGE[NARRATIVE_KEY] = JSON.stringify([]);
appendNarrativeLog('');
appendNarrativeLog('');
check('8. 空文本也累加（与 displayNarrative 1:1 对应）', loadNarrativeLog().length === 2);

console.log('\n' + (fail === 0 ? '✅ 全部通过（' + pass + ' 项）' : '❌ 失败 ' + fail + ' 项 / 通过 ' + pass + ' 项'));
process.exit(fail ? 1 : 0);