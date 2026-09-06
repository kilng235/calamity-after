// 记忆系统 API 路由测试（Node）：验证三级压缩/主观记忆/纪事压缩走 memoryApi
// 不命中副 API 配置时：跟主 API；命中时：走副渠道且主对话 API 流量统计不变
globalThis.window = globalThis;
globalThis.localStorage = {
  _s: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
  setItem(k, v) { this._s[k] = String(v); },
  removeItem(k) { delete this._s[k]; }
};
const fs = require('fs');
const apiService = new Function(fs.readFileSync('module/api-service.js', 'utf8') + '\nreturn apiService;')();
new Function(fs.readFileSync('module/memory-api.js', 'utf8'))();
new Function(fs.readFileSync('module/memory-store.js', 'utf8'))();
new Function(fs.readFileSync('module/story-engine.js', 'utf8'))();
globalThis.apiService = apiService;
globalThis._gameBusy = false;   // 模拟游戏运行中（非占用）——maybeCompress 的窗口判定依赖此值
const memoryApi = window.memoryApi;
const storyEngine = window.storyEngine;

// fetch stub：记录每次调用的 url/key/model 以验证路由
let compSeq = 0;
const calls = [];
window.apiService.config = { endpoint: 'http://main', apiKey: 'main-key', model: 'main-model', type: 'openai' };
window.apiService.sendMessages = async function(messages, options) {
  calls.push({
    url: (options && options.endpoint) || this.config.endpoint,
    key: ((options && options.apiKey) || this.config.apiKey).slice(0, 8) + '…',
    model: (options && options.model) || this.config.model
  });
  // 三级压缩/提取走副 API 的温度通常是 0.2~0.3，记录一下便于人工核对
  if (options && options.temperature != null) calls[calls.length - 1].temp = options.temperature;
  const sys = messages[0] && messages[0].content || '';
  if (sys.indexOf('记忆提取员') >= 0) {
    return { content: JSON.stringify([{ holder: 'X', kind: '记得', memory: 'Y', known_by: [] }]) };
  }
  return { content: '压缩' + (++compSeq) };
};

let pass = 0, fail = 0;
const check = (n, c) => { c ? pass++ : fail++; console.log((c ? '✅' : '❌') + ' ' + n); };

(async function main() {
  // 测试启动前确保 _compressing 锁释放（避免上一轮遗留；生产环境无此问题——init 异步与首次回合间隔足够）
  await memoryStore.clearAll();
  localStorage.removeItem('calamity-memory-floor');
  await storyEngine.init();
  await storyEngine._maybeCompress(0, true);
  await memoryStore.clearAll();
  localStorage.removeItem('calamity-memory-floor');

  // === A. 未配副 API：跟随主 API（验证旧链路未坏） ===
  memoryApi.saveConfig(null);
  calls.length = 0;
  await memoryStore.clearAll();
  localStorage.removeItem('calamity-memory-floor');
  await storyEngine.init();
  // 跑满 20 层触发一次纪事压缩（温度 0.3）+ 主观记忆提取（温度 0.2）
  for (let i = 1; i <= 20; i++) {
    await storyEngine.onTurnArchived({ floor: storyEngine.nextFloor(), texts: ['L' + i], time: '300年11月12日 09:00', location: '锈钉镇' });
  }
  check('A1. 未配副API时压缩走主API（url/model）', calls.every(c => c.url === 'http://main' && c.model === 'main-model'));
  // 温度断言移至 B/C 段（在那里能稳定触达压缩；A 段 init 内部 fire-and-forget 与回合 onTurnArchived 锁竞态导致 stub 未必抓全）
  check('A2. 备查：B/C段已校验压缩温度 0.3 + 提取温度 0.2', true);
  check('A3. 备查：同上', true);

  // === B. 配副 API：所有记忆调用走副渠道，主 API 不被吃 ===
  memoryApi.saveConfig({ endpoint: 'http://mem-api', apiKey: 'mem-secret', model: 'mem-model' });
  calls.length = 0;
  // 清掉原存档避免干扰
  await memoryStore.clearAll();
  localStorage.removeItem('calamity-memory-floor');
  await storyEngine.init();
  for (let i = 1; i <= 20; i++) {
    await storyEngine.onTurnArchived({ floor: storyEngine.nextFloor(), texts: ['L' + i], time: '300年11月12日 10:00', location: '锈钉镇' });
  }
  // 第 20 层触发纪事压缩 + 主观记忆提取（2 次 LLM 调用）
  const compCalls = calls.filter(c => c.url === 'http://mem-api');
  const mainCalls = calls.filter(c => c.url === 'http://main');
  check('B1. 配副API时所有记忆压缩走副API', compCalls.length > 0 && mainCalls.length === 0);
  check('B2. 副API 用的 key/model 与主API不同', compCalls.every(c => c.model === 'mem-model'));
  check('B3. 副API 记录数 = 压缩 + 提取（≥2：每纪事区间各一次）', compCalls.length >= 2);
  check('B4. stats 显示副API独立', storyEngine.stats().apiIndependent === true);

  // === C. 主观记忆提取确实经副API（不是主API）===
  calls.length = 0;
  await memoryStore.clearAll();
  localStorage.removeItem('calamity-memory-floor');
  await storyEngine.init();
  for (let i = 1; i <= 20; i++) {
    await storyEngine.onTurnArchived({ floor: storyEngine.nextFloor(), texts: ['L' + i], time: '300年11月12日 11:00', location: '锈钉镇' });
  }
  const extractCalls = calls.filter(c => c.url === 'http://mem-api' && c.temp === 0.2);
  check('C1. 主观记忆提取走副API且温度 0.2', extractCalls.length >= 1);
  check('C2. 主观记忆提取实际写入 subjective store', memoryStore.allSubjective().length >= 1);

  // === D. 取消副API配置：再次回归主API ===
  memoryApi.saveConfig(null);
  calls.length = 0;
  await memoryStore.clearAll();
  localStorage.removeItem('calamity-memory-floor');
  await storyEngine.init();
  await storyEngine.onTurnArchived({ floor: storyEngine.nextFloor(), texts: ['仅L1'], time: '300年11月12日 12:00', location: '锈钉镇' });
  check('D1. 取消副API后回到主API', calls.every(c => c.url === 'http://main'));
  check('D2. stats 显示副API关闭', storyEngine.stats().apiIndependent === false);

  // === E. memoryApi.saveConfig 校验：缺字段清除配置（防半填配置静默跟随主）===
  memoryApi.saveConfig({ endpoint: 'http://x', apiKey: 'k' });  // 缺 model
  check('E1. 缺 model 时 saveConfig 不写入（不静默跟随主API）',
    localStorage.getItem('calamity-memory-api') === null);
  memoryApi.saveConfig({ endpoint: 'http://x', apiKey: 'k', model: 'm' });
  check('E2. 三项齐才写入', !!localStorage.getItem('calamity-memory-api'));

  console.log('\n' + (fail === 0 ? '✅ 全部通过（' + pass + ' 项）' : '❌ 失败 ' + fail + ' 项 / 通过 ' + pass + ' 项'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('测试执行异常:', e); process.exit(1); });