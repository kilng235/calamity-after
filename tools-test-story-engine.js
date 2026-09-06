// 记忆系统 2.0 端到端测试（Node，内存镜像模式）：归档→编年史→滚动合并→注入→词法检索→撤销→向量开关→P1账本套件
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
new Function(fs.readFileSync(__dirname + '/module/response-parser.js', 'utf8'))();

const memoryStore = window.memoryStore;
const memoryApi = window.memoryApi;
const storyEngine = window.storyEngine;
const responseParser = window.responseParser;

// ---- stub：apiService（压缩返回固定文本；主观记忆提取请求返回固定 JSON）----
let compSeq = 0;
const apiCalls = [];
const EXTRACT_JSON = JSON.stringify([
  { holder: '莉娅', kind: '记得', memory: '主角在狼群袭击中救过她一命', known_by: ['老王'] },
  { holder: '莉娅', kind: '怀疑', memory: '镇长与失踪的矿工队有关', known_by: [] },
  { holder: '老王', kind: '误解', memory: '以为主角是圣火骑士团的探子', known_by: [] }
]);
window.apiService = {
  config: { endpoint: 'http://main', apiKey: 'main-key', model: 'main-model' },
  getConfig() { return this.config; },
  async sendMessages(messages, options) {
    apiCalls.push({ url: (options && options.endpoint) || 'http://main', model: (options && options.model) || 'main-model' });
    const sys = messages && messages[0] && messages[0].content || '';
    if (sys.indexOf('记忆提取员') >= 0) return { content: EXTRACT_JSON, usage: {} };
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

  // ==================== P1 账本套件（实体台账 / 悬念簿 / 主观记忆） ====================

  // 实体台账：upsert + 别名归并 + 变更史
  await storyEngine._applyEntities([{ name: '巴克', kind: 'NPC', aliases: ['老巴克'], state: '铁匠铺老板，左臂截肢', change: '因主角送药而感激' }], 61, '300年11月12日 11:20');
  await storyEngine._applyEntities([{ name: '老巴克', kind: 'NPC', aliases: [], state: '脾气好转', change: '承诺半价修理' }], 62, '300年11月12日 11:40');
  const ledgerAll = memoryStore.allLedger();
  check('22. 台账别名归并：不同名字的两轮回合仍为同一实体', ledgerAll.length === 1);
  const ld = ledgerAll[0];
  check('23. 台账规范名保持首次登记名，别名双向归并', ld.name === '巴克' && (ld.aliases || []).some(a => a === '老巴克') && ld.state === '脾气好转');
  check('24. 台账变更史按序保留且最新在后', (ld.history || []).length === 2 && ld.history[1].change === '承诺半价修理');

  // 悬念簿：建立/核销
  await storyEngine._applySuspenses([{ type: 'new', name: '地窖哭声', desc: '夜间传出哭声' }], 62, '');
  await storyEngine._applySuspenses([{ type: 'new', name: '地窖哭声', desc: '重复建立' }], 63, '');
  check('25. 悬念建立：重复建立不重复开线', memoryStore.allSuspense().filter(r => r.name === '地窖哭声').length === 1 && memoryStore.allSuspense()[0].status === 'active');
  await storyEngine._applySuspenses([{ type: 'resolve', name: '地窖哭声', result: '是变异鼠群' }], 64, '');
  check('26. 悬念核销：状态转 resolved 且记录结果', memoryStore.allSuspense().every(r => r.name !== '地窖哭声' || (r.status === 'resolved' && r.result === '是变异鼠群')));

  // 主观记忆：提取 + 幂等（注：第20/40/60层压缩时钩子已自动提取三个区间，按 rangeId 断言）
  const subjBefore = memoryStore.allSubjective().length;
  await storyEngine._extractSubjectiveMemories(41, 60);
  const subj1 = memoryStore.allSubjective().filter(r => r.rangeId === 'l1_41_60');
  check('27. 主观记忆提取入库（l1_41_60 区间 3 条）', subj1.length === 3 && subj1.every(r => r.holder && r.text));
  await storyEngine._extractSubjectiveMemories(41, 60);
  check('28. 提取幂等：同区间二次调用不重复（总数不变）', memoryStore.allSubjective().length === subjBefore);

  // 主演/龙套分级：主演（关系簿中的莉娅）至多 3 条，龙套（路人甲）只注入最近 1 条
  await memoryStore.put('subjective', { id: 'sub_t1', rangeId: 'l1_41_60', from: 41, to: 60, holder: '莉娅', kind: '记得', text: '莉娅第三条记忆', knownBy: [], createdAt: Date.now() });
  await memoryStore.put('subjective', { id: 'sub_t2', rangeId: 'l1_41_60', from: 41, to: 60, holder: '莉娅', kind: '记得', text: '莉娅第四条记忆', knownBy: [], createdAt: Date.now() });
  await memoryStore.put('subjective', { id: 'sub_t3', rangeId: 'l1_41_60', from: 41, to: 60, holder: '路人甲', kind: '记得', text: '路人甲唯一的记忆', knownBy: [], createdAt: Date.now() });
  const subjBlock = storyEngine._buildSubjectiveBlock('随便走走', gd);
  check('29. 主演至多 3 条 / 龙套只保留 1 条', (subjBlock.match(/- 莉娅（/g) || []).length === 3 && (subjBlock.match(/- 路人甲（/g) || []).length === 1);

  // 注入块：台账/人物记忆在场，已核销悬念不再注入
  const blocks3 = await storyEngine.buildInjectBlocks('巴克的铺子还开着吗', gd);
  const joined3 = blocks3.join('\n---\n');
  check('30. 注入含【实体台账】且别名命中（含变更史）', blocks3.some(b => b.indexOf('【实体台账】') >= 0) && joined3.indexOf('老巴克') >= 0 && joined3.indexOf('此前：') >= 0);
  check('31. 已核销的悬念不再注入', joined3.indexOf('地窖哭声') === -1);
  check('32. 注入含【人物记忆】且标注认知性质', blocks3.some(b => b.indexOf('【人物记忆】') >= 0) && joined3.indexOf('莉娅（怀疑）') >= 0 && joined3.indexOf('老王（误解）') >= 0);

  // 撤销联动：台账/悬念/主观记忆全量内容回滚
  const snap2 = storyEngine.snapshotIds();
  await storyEngine._applyEntities([{ name: '巴克', kind: 'NPC', aliases: [], state: '铺子被烧毁', change: '锈钉镇骚乱中被焚' }], 65, '');
  await storyEngine._applySuspenses([{ type: 'new', name: '纵火者之谜', desc: '谁烧了铁匠铺' }], 65, '');
  await memoryStore.put('subjective', { id: 'sub_extra', rangeId: 'l1_41_60', from: 41, to: 60, holder: '老王', kind: '记得', text: '快照后的新记忆', knownBy: [], createdAt: Date.now() });
  check('33. 快照后变动生效', memoryStore.allLedger()[0].state === '铺子被烧毁' && memoryStore.allSuspense().some(r => r.name === '纵火者之谜'));
  await storyEngine.rollback(snap2);
  check('34. 回滚后天账/悬念/主观记忆恢复到快照态', memoryStore.allLedger()[0].state === '脾气好转'
    && !memoryStore.allSuspense().some(r => r.name === '纵火者之谜')
    && !memoryStore.allSubjective().some(r => r.id === 'sub_extra'));

  // 解析器：实体更新/悬念块提取与剥离
  const sampleP1 = '<content>铁匠铺剧情。</content>\n[实体更新]\n名称：巴克\n状态：铺子重开\n变更：重修屋顶\n[/实体更新]\n[悬念]\n名称：夜半钟声\n描述：钟楼无人自鸣\n[/悬念]\n<SUMMARY>测试</SUMMARY>';
  const parsedP1 = responseParser.run(sampleP1);
  check('35. 解析器提取实体与悬念并从正文剥离', parsedP1.entities.length === 1 && parsedP1.suspenses.length === 1
    && parsedP1.suspenses[0].type === 'new' && parsedP1.entities[0].name === '巴克'
    && parsedP1.cleanedText.indexOf('实体更新') === -1 && parsedP1.cleanedText.indexOf('夜半钟声') === -1);
  const parsedP1b = responseParser.run('[悬念核销]\n名称：夜半钟声\n结果：是风铃\n[/悬念核销]');
  check('36. 悬念核销块解析（type=resolve + 结果字段）', parsedP1b.suspenses.length === 1 && parsedP1b.suspenses[0].type === 'resolve' && parsedP1b.suspenses[0].result === '是风铃');

  // 无纪要但有账本变动的回合：不推进楼层号（避免编年史空洞），台账照常落地
  const floorBefore = storyEngine.currentFloor();
  await storyEngine.onTurnArchived({ floor: floorBefore, texts: [], time: '300年11月12日 12:00', location: '', entities: [{ name: '神秘罗盘', kind: '物品', state: '在杂货铺橱窗里' }], suspenses: [] });
  check('37. 无纪要回合不推进楼层且台账落地', storyEngine.currentFloor() === floorBefore && memoryStore.allLedger().some(r => r.name === '神秘罗盘'));

  // stats 暴露 P1 计数
  const stP1 = storyEngine.stats();
  check('38. stats 含 P1 计数（台账/悬念/主观记忆）', typeof stP1.ledger === 'number' && typeof stP1.suspenseActive === 'number' && typeof stP1.subjective === 'number');

  console.log('\n' + (fail === 0 ? '✅ 全部通过（' + pass + ' 项）' : '❌ 失败 ' + fail + ' 项 / 通过 ' + pass + ' 项'));
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('测试执行异常:', e); process.exit(1); });
