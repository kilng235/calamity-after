// 契约对账测试（Node）：世界书（yaml）↔ 引擎（代码）双源漂移拦截
// 三层契约：① 状态白名单（状态列表.yaml ↔ status-contract.js ↔ command-processor）
//          ② 中文别名表（数据同步协议 §3 ↔ command-engine 实际接受度）
//          ③ 可写根清单（数据同步协议 §1 ↔ command-engine WRITABLE_ROOTS）
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

globalThis.window = globalThis;
globalThis.localStorage = {
  _s: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
  setItem(k, v) { this._s[k] = String(v); },
  removeItem(k) { delete this._s[k]; }
};

// 契约与引擎（先加载契约，模拟 index.html 的脚本顺序）
new Function(fs.readFileSync(path.join(ROOT, 'module/status-contract.js'), 'utf8'))();
new Function(fs.readFileSync(path.join(ROOT, 'module/command-engine.js'), 'utf8'))();
new Function(fs.readFileSync(path.join(ROOT, 'module/command-processor.js'), 'utf8'))();
const engine = window.commandEngine;
const processor = window.commandProcessor;

let pass = 0, fail = 0;
const check = (n, c) => { c ? pass++ : fail++; console.log((c ? '✅' : '❌') + ' ' + n); };

// ---------- yaml 解析工具（独立实现，不依赖转换器） ----------
function parseStatusTables(yamlText) {
  const map = {};
  let polarity = null;
  for (const line of yamlText.split('\n')) {
    const h = line.match(/^##\s*(负面状态表|有利状态表)/);
    if (h) { polarity = h[1].indexOf('负面') === 0 ? 0 : 1; continue; }
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').map(c => c.trim());
    const name = cells[1];
    if (!name || name === '状态' || /^-+$/.test(name)) continue;
    if (polarity === null) continue;
    map[name] = polarity;
  }
  return map;
}
function parseAliasTable(yamlText) {
  const section = yamlText.split('## 3. 中文别名表')[1] || '';
  const rows = [];
  for (const line of section.split('\n')) {
    if (!line.startsWith('|') || /^\|[-\s|]+\|?$/.test(line.trim())) continue;
    const cells = line.split('|').map(c => c.trim()).filter(c => c !== '');
    if (cells.length < 2 || cells[0] === '中文别名') continue;
    rows.push({ aliases: cells[0], paths: cells[1] });
  }
  return rows;
}
function parseWritableRoots(yamlText) {
  const section = yamlText.split('## 1. 可写根路径')[1].split('## 2.')[0]
    .split('本地保留域')[0];   // 保留域（stats/meta）不是可写根
  const names = [];
  for (const m of section.matchAll(/^- \*\*(\w+)\*\*/gm)) names.push(m[1]);
  return names;
}

const syncYaml = fs.readFileSync(path.join(ROOT, 'data-source/世界书/系统/数据同步协议.yaml'), 'utf8');
const statusYaml = fs.readFileSync(path.join(ROOT, 'data-source/世界书/系统/状态列表.yaml'), 'utf8');

(async function main() {
  // ===== 第 1 层：状态白名单三源一致 =====
  const yamlStatuses = parseStatusTables(statusYaml);
  const contract = window.statusContract.statuses;

  const yamlOnly = Object.keys(yamlStatuses).filter(n => !(n in contract));
  const contractOnly = Object.keys(contract).filter(n => !(n in yamlStatuses));
  check('1a. 状态名：yaml 与契约无差异', yamlOnly.length === 0 && contractOnly.length === 0);
  const polMismatch = Object.keys(yamlStatuses).filter(n => contract[n] !== undefined && contract[n] !== yamlStatuses[n]);
  check('1b. 状态极性（负面0/有利1）：yaml 与契约一致', polMismatch.length === 0);

  const effective = processor.getStatusWhitelist();
  const effOnly = Object.keys(contract).filter(n => !(n in effective));
  const effMissing = Object.keys(effective).filter(n => !(n in contract));
  check('1c. 引擎生效白名单与契约一致', effOnly.length === 0 && effMissing.length === 0);

  const fbOnly = Object.keys(processor.FALLBACK_WHITELIST).filter(n => !(n in contract));
  const fbMissing = Object.keys(contract).filter(n => !(n in processor.FALLBACK_WHITELIST));
  check('1d. 引擎兜底名单与契约一致（兜底不漂移）', fbOnly.length === 0 && fbMissing.length === 0);
  check('1e. 旧存档迁移：失明 → 目盲', (() => {
    const gd = { conditions: { 失明: true } };
    processor.normalizeGameData(gd);
    return gd.conditions['目盲'] === true && gd.conditions['失明'] === undefined;
  })());

  // ===== 第 2 层：中文别名表（协议承诺的路径引擎必须真的接受） =====
  const aliasRows = parseAliasTable(syncYaml);
  check('2a. 别名表解析到行', aliasRows.length >= 15);

  let aliasFails = [];
  let aliasTested = 0;
  for (const row of aliasRows) {
    const aliases = row.aliases.split('/').map(s => s.trim()).filter(s => s && !s.includes('…') && !s.includes('...'))
      .flatMap(s => {
        const m = s.match(/^(.+)（(.+)）$/);   // 括号注音 = 两个等价别名（足部与脚部同槽）
        if (!m) return [s];
        return m[1].includes('.') ? [m[1], m[1].split('.')[0] + '.' + m[2]] : [m[1], m[2]];
      });
    const paths = row.paths.split('/').map(s => s.trim()).filter(s => s && !s.includes('…') && !s.includes('...'));
    // 路径校验模式：别名数与路径数对齐时逐一比对；不齐（如省略前缀写法）时只校验"引擎接受"
    const zipPaths = aliases.length === paths.length;
    aliases.forEach((alias, i) => {
      aliasTested++;
      const testAlias = alias
        .replace('{状态名}', '中毒').replace('{NPC名}', '莉娅')
        .replace('{技能名}', '炉火').replace('{X}', '中毒');
      let expected = (zipPaths ? paths[i] : '')
        .replace('{状态名}', '中毒').replace('{NPC名}', '莉娅');
      // 协议行省略共享前缀时（equipment.mainHand / offHand / body）继承首项前缀，仅多路径行适用
      if (expected && expected.indexOf('.') === -1 && paths.length > 1) {
        const prefix = (paths[0] || '').split('.')[0];
        if (prefix) expected = prefix + '.' + expected;
      }
      const norm = engine.normalizeCommandKey(testAlias);
      if (!norm.ok) { aliasFails.push(testAlias + ' → 被拒绝'); return; }
      const got = norm.path.replace(/^gameData\./, '');
      if (expected && got !== expected) aliasFails.push(testAlias + ' → ' + got + '（协议承诺 ' + expected + '）');
    });
  }
  check('2b. 协议别名逐一喂引擎：' + aliasTested + ' 个别名全部按承诺落地' + (aliasFails.length ? '，失败：' + aliasFails.join('；') : ''),
    aliasFails.length === 0 && aliasTested >= 40);

  // ===== 第 3 层：可写根清单 =====
  const yamlRoots = parseWritableRoots(syncYaml);
  const engineRoots = engine.WRITABLE_ROOTS;
  const rootOnlyYaml = yamlRoots.filter(r => !engineRoots.includes(r));
  const rootOnlyEngine = engineRoots.filter(r => !yamlRoots.includes(r));
  check('3. 可写根清单：yaml §1（' + yamlRoots.length + ' 根）与引擎（' + engineRoots.length + ' 根）一致'
    + (rootOnlyYaml.length || rootOnlyEngine.length ? '，差异：yaml独有[' + rootOnlyYaml + '] 引擎独有[' + rootOnlyEngine + ']' : ''),
    rootOnlyYaml.length === 0 && rootOnlyEngine.length === 0);

  console.log('\n' + (fail === 0 ? '✅ 全部通过（' + pass + ' 项）' : '❌ 失败 ' + fail + ' 项 / 通过 ' + pass + ' 项'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('测试执行异常:', e); process.exit(1); });
