// 记忆系统 2.0 端到端测试（Node，内存镜像模式）：归档→编年史→滚动合并→注入→词法检索→撤销→向量开关
globalThis.window = globalThis;
globalThis.localStorage = {
  _s: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
  setItem(k, v) { this._s[k] = String(v); },
  removeItem(k) { delete this._s[k]; }
};
// 不提供 indexedDB → memoryStore 以内存镜像运行（put/del 的落盘失败被容忍）
const fs = require('fs');
new Function(fs.readFileSync(__dirname + '/module/memory-store.js', 'utf8'))();
new Function(fs.readFileSync(__dirname + '/module/memory-api.js', 'utf8'))();
new Function(fs.readFileSync(__dirname + '/module/story-engine.js', 'utf8'))();

const memoryStore = window.memoryStore;
const memoryApi = window.memoryApi;
const storyEngine = window.storyEngine;

// ---- stub：apiService（记录调用目标 + 返回固定压缩文本）----
let compSeq = 0;
const apiCalls = [];
window.apiService = {
  config: { endpoint: 'http://main', apiKey: 'main-key', model: 'main-model' },
  getConfig() { return this.config; },
  async sendMessages(messages, options) {
    apiCalls.push({ url: (options && options.endpoint) || 'http://main', model: (options && options.model) || 'main-model' });
    return { content: '测试压缩' + (++compSeq) + '：主角与莉娅在铁矿镇击退狼群，护送任务完成。', usage: {} };
  }
};
const gd = { relationships: { 莉娅: { 好感度: 10 } }, tasks: [], inventory: [{ name: '铁剑' }], progress: { currentLocation: '铁矿镇' }, gameTime: { year: 300, month: 11, day: 12, hour: 7, minute: 10 } };
window.gameState = { getGameData: () => gd };

let pass = 0, fail = 0;
function check(name, cond) {
  console.log((cond ? '✅' : '❌') + ' ' + name);
  cond ? pass++ : fail++;
}

(async function main() {
  await storyEngine.init();
  check('1. 初始化后楼层为 0', storyEngine.stats().floor === 0);

  // 45 回合：第 20/40 层应各压出一篇纪事
  for (let i = 1; i <= 45; i++) {
    gd.gameTime.minute += 20;
    await storyEngine.onTurnArchived({
      floor: storyEngine.nextFloor(),
      texts: ['第' + i + '层剧情：莉娅在铁矿镇与主角相遇并交出铁剑'],
      time: storyEngine.fmtGameTime(gd.gameTime),
      location: '铁矿镇'
    });
  }
  let st = storyEngine.stats();
  check('2. 45 回合后纪要 45 层', st.summary === 45);
  check('3. 编年史 45 行', st.chronicle === 45);
  check('4. 纪事 2 篇（第20/40层触发）', st.l1 === 2);
  check('5. 压缩走主API（未配置副API）', apiCalls.every(c => c.url === 'http://main'));

  // 副API 配置后应走副渠道（等到第 60 层的压缩边界才会发请求）
  memoryApi.saveConfig({ endpoint: 'http://mem-api', apiKey: 'mem-key', model: 'mem-model' });
  for (let i = 46; i <= 60; i++) {
    await storyEngine.onTurnArchived({ floor: storyEngine.nextFloor(), texts: [' filler '], time: '300年11月12日 08:10', location: '铁矿镇' });
  }
  check('6. 副API 生效：压缩请求发往副渠道', apiCalls.some(c => c.url === 'http://mem-api' && c.model === 'mem-model'));
  memoryApi.saveConfig(null);

  // 补至 120 回合：第 120 层时纪事 #6 溢出合并出卷宗（吸收最早 5 篇纪事）
  for (let i = 61; i <= 120; i++) {
    await storyEngine.onTurnArchived({
      floor: storyEngine.nextFloor(),
      texts: ['第' + i + '层剧情：莉娅与主角在铁矿镇整备物资'],
      time: '300年11月12日 09:00', location: '铁矿镇'
    });
  }
  st = storyEngine.stats();
  check('7. 120 层：卷宗 1 篇', st.l2 === 1);
  check('8. 未吸收纪事剩 1 篇（第101~120层）', st.l1 === 1);
  const storyAll = memoryStore.allStory();
  const saga = storyAll.find(r => r.level === 2);
  check('9. 卷宗覆盖第1~100层', saga && saga.from === 1 && saga.to === 100);
  check('10. 被吸收纪事标记 absorbedBy（未删除）', storyAll.filter(r => r.level === 1).length === 6 && storyAll.filter(r => r.level === 1 && r.absorbedBy).length === 5);

  // 注入块
  const blocks = await storyEngine.buildInjectBlocks('莉娅现在在哪', gd);
  const joined = blocks.join('\n---\n');
  check('11. 注入含卷宗块', blocks.some(b => b.indexOf('【世界纪事·卷宗】') >= 0 && b.indexOf('第1~100层·卷宗') >= 0));
  check('12. 注入含最近纪事块（101~120）', joined.indexOf('第101~120层·纪事') >= 0);
  check('13. 注入含编年史尾窗（≤100行）', blocks.some(b => b.indexOf('【剧情编年史】') >= 0) && (joined.match(/第\d+层｜/g) || []).length === 100);
  check('14. 词法命中展开"莉娅"相关楼层纪要', joined.indexOf('【相关记忆召回】') >= 0 && joined.indexOf('莉娅在铁矿镇与主角相遇') >= 0);

  // 撤销：在第 119 层打快照 → 第 120 层触发合并 → 回滚应恢复到合并前
  // 先重放 1~119（干净状态）再验证
  await memoryStore.clearAll();
  localStorage.removeItem('calamity-memory-floor');
  localStorage.removeItem('calamity-memory-pending');
  await storyEngine.init();
  for (let i = 1; i <= 119; i++) {
    await storyEngine.onTurnArchived({ floor: storyEngine.nextFloor(), texts: ['第' + i + '层剧情：莉娅在铁矿镇'], time: '300年11月12日 10:00', location: '铁矿镇' });
  }
  const snap = storyEngine.snapshotIds();
  await storyEngine.onTurnArchived({ floor: storyEngine.nextFloor(), texts: ['第120层剧情：与莉娅告别'], time: '300年11月12日 10:20', location: '铁矿镇' });
  check('15. 第120层后卷宗已生成', memoryStore.allStory().some(r => r.level === 2));
  await storyEngine.rollback(snap);
  st = storyEngine.stats();
  check('16. 回滚后无卷宗', st.l2 === 0);
  check('17. 回滚后 5 篇纪事全部恢复未吸收', st.l1 === 5 && memoryStore.allStory().every(r => !r.absorbedBy));
  check('18. 回滚后纪要/编年史回到 119 层', st.summary === 119 && st.chronicle === 119);

  // 向量模块（可选开启）
  window.embeddingService = {
    isEnabled: () => localStorage.getItem('calamity-memory-vec') === '1',
    getFingerprint: () => 'fp-test-1',
    async embed(texts) { return texts.map(() => [1, 2, 3]); }
  };
  let vecRecallResult = [{ floor: 50, text: '第50层向量召回文本：莉娅赠予主角护符', time: '300年11月12日 09:40', location: '铁矿镇' }];
  window.memoryRecall = {
    addToCache() {}, removeFromCache() {},
    async recallRelevantMemories() { return vecRecallResult; }
  };
  localStorage.setItem('calamity-memory-vec', '1');
  // 清空重来，在第 50 层触发向量化，然后继续到 60 层
  await memoryStore.clearAll();
  localStorage.removeItem('calamity-memory-floor');
  localStorage.removeItem('calamity-memory-pending');
  await storyEngine.init();
  for (let i = 1; i <= 60; i++) {
    await storyEngine.onTurnArchived({ floor: storyEngine.nextFloor(), texts: ['第' + i + '层剧情：莉娅在铁矿镇巡逻'], time: '300年11月12日 11:00', location: '铁矿镇' });
  }
  const vecs = memoryStore.allEmbeddings();
  check('19. 向量开启时摘要已向量化入库（60条，指纹正确）', vecs.length === 60 && vecs.every(v => v.fingerprint === 'fp-test-1' && v.floor > 0));
  const blocks2 = await storyEngine.buildInjectBlocks('护符', gd);
  check('20. 向量召回与词法结果合并注入（含第50层向量命中）', blocks2.some(b => b.indexOf('护符') >= 0));
  // 关闭向量后不再有 embeddings 增长
  localStorage.setItem('calamity-memory-vec', '0');
  const before = memoryStore.allEmbeddings().length;
  await storyEngine.onTurnArchived({ floor: storyEngine.nextFloor(), texts: ['第61层剧情：休整'], time: '300年11月12日 11:20', location: '铁矿镇' });
  check('21. 向量关闭时不再入库', memoryStore.allEmbeddings().length === before);

  console.log('\n' + (fail === 0 ? '✅ 全部通过（' + pass + ' 项）' : '❌ 失败 ' + fail + ' 项 / 通过 ' + pass + ' 项'));
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('测试执行异常:', e); process.exit(1); });
