// 回合终止功能测试（Node）：手动中止 vs 超时区分 + signal 传递到 fetch（OpenAI/Gemini）+ 正常请求不受影响
globalThis.window = globalThis;
globalThis.localStorage = {
  _s: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
  setItem(k, v) { this._s[k] = String(v); },
  removeItem(k) { delete this._s[k]; }
};
const fs = require('fs');
// api-service.js 无 window 导出守卫（浏览器 <script> 顶层 var 模式），测试用返回值捕获
const apiService = new Function(fs.readFileSync(__dirname + '/module/api-service.js', 'utf8') + '\nreturn apiService;')();
globalThis.apiService = apiService;

let pass = 0, fail = 0;
function check(name, cond) {
  console.log((cond ? '✅' : '❌') + ' ' + name);
  cond ? pass++ : fail++;
}
function abortErr() { const e = new Error('The operation was aborted'); e.name = 'AbortError'; return e; }
const MSGS = [{ role: 'user', content: '测试' }];

// fetch stub：挂起直到 opts.signal 中止（无论 signal 来自调用方还是 apiService 内置超时）
function hangFetch() {
  return function(url, opts) {
    return new Promise((resolve, reject) => {
      const sig = opts && opts.signal;
      if (sig) {
        if (sig.aborted) return reject(abortErr());
        sig.addEventListener('abort', () => reject(abortErr()));
      }
      // 无 signal 则永不返回
    });
  };
}
function okFetch(body) {
  return function() {
    return Promise.resolve({ ok: true, json: async () => body, text: async () => '' });
  };
}

(async function main() {
  apiService.updateConfig({ endpoint: 'http://test', apiKey: 'k', model: 'm', type: 'openai' });

  // A. 手动终止（调用方 signal）：报"已手动终止"且带 isManualAbort 标记（OpenAI）
  apiService.updateConfig({ type: 'openai', requestTimeoutMs: 60000 });
  globalThis.fetch = hangFetch();
  const c1 = new AbortController();
  setTimeout(() => c1.abort(), 20);
  let errA = null;
  try { await apiService.sendMessages(MSGS, { signal: c1.signal }); }
  catch (e) { errA = e; }
  check('1. OpenAI 手动终止：isManualAbort 标记 + 友好文案', errA && errA.isManualAbort === true && errA.message.indexOf('已手动终止') >= 0);

  // B. 内置超时（未传 signal）：仍报"请求超时"，不带 isManualAbort
  apiService.updateConfig({ requestTimeoutMs: 60 });
  globalThis.fetch = hangFetch();
  let errB = null;
  try { await apiService.sendMessages(MSGS); }
  catch (e) { errB = e; }
  check('2. 内置超时：文案为请求超时且无 isManualAbort', errB && !errB.isManualAbort && errB.message.indexOf('请求超时') >= 0);

  // C. 正常请求不受影响
  globalThis.fetch = okFetch({ choices: [{ message: { content: 'ok' } }], usage: {} });
  const okC = await apiService.sendMessages(MSGS);
  check('3. 正常请求不受影响（返回内容 ok）', okC && okC.content === 'ok');

  // D. Gemini 手动终止：signal 已传到 fetch（此前 _callGemini 漏传 signal 的 bug 已修）
  apiService.updateConfig({ type: 'gemini', requestTimeoutMs: 60000 });
  globalThis.fetch = function(url, opts) {
    // 校验 fetchOptions 确实带上了 signal
    check('4. Gemini fetch 收到 signal', Boolean(opts && opts.signal));
    return hangFetch()(url, opts);
  };
  const c2 = new AbortController();
  setTimeout(() => c2.abort(), 20);
  let errD = null;
  try { await apiService.sendMessages(MSGS, { signal: c2.signal }); }
  catch (e) { errD = e; }
  check('5. Gemini 手动终止：isManualAbort 标记', errD && errD.isManualAbort === true);

  // E. 副 API 覆盖路径（memory-api 复用同一实现）同样支持手动终止
  apiService.updateConfig({ type: 'openai' });
  globalThis.fetch = hangFetch();
  const c3 = new AbortController();
  setTimeout(() => c3.abort(), 20);
  let errE = null;
  try { await apiService.sendMessages(MSGS, { signal: c3.signal, endpoint: 'http://mem', apiKey: 'mk', model: 'mm' }); }
  catch (e) { errE = e; }
  check('6. 调用级覆盖配置下手动终止同样生效', errE && errE.isManualAbort === true);

  console.log('\n' + (fail === 0 ? '✅ 全部通过（' + pass + ' 项）' : '❌ 失败 ' + fail + ' 项 / 通过 ' + pass + ' 项'));
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('测试执行异常:', e); process.exit(1); });
