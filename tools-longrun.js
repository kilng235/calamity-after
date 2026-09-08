/**
 * tools-longrun.js - 无头长跑验证器（方案 B）
 *
 * 在 Node 中加载真实模块链（calamityData / prompt-builder / api-service /
 * response-parser / command-processor / worldbook-engine / identity-system /
 * memory-store / memory-api / story-engine / travel-* / game-state），
 * 复刻 index.html 主循环语义，按脚本剧本执行 N 回合，自动采集：
 *   - P1 块遵从率（实体/悬念块输出统计）
 *   - 命令拒绝率、旅行遭遇/偷袭率、夜路比例
 *   - 典章字数分布与记忆系统增长曲线（验证 keep3 封顶效果）
 *   - token 消耗、单回合耗时
 *
 * 模式：
 *   - 无 .api-key.local → 自动 stub 模式（合成响应，仅验证机械链路）
 *   - 有 .api-key.local + --yes → 真机长跑（消耗 token，按你的通道/模型计价）
 *
 * 用法：
 *   node tools-longrun.js                # 默认 24 回合；有 key 自动真跑（无 key 自动 stub）
 *   node tools-longrun.js --stub         # 强制 stub
 *   node tools-longrun.js --turns 30     # 自定义回合数
 *   node tools-longrun.js --yes         # 真跑需明确确认（防误消耗）
 *
 * 凭据文件（不入库）：
 *   .api-key.local  格式 { endpoint, apiKey, model, type }
 *
 * 产物：longrun/run-YYYYMMDD-HHMMSS/{ narrative.md, metrics.json, final-gameData.json }
 */

globalThis.window = globalThis;
globalThis.location = { protocol: 'http:' };   // api-service _getRunEnv 读取 location.protocol（Node 无 window.location）
globalThis.addEventListener = () => {};         // dice-pool.js 等模块顶层注册 DOM 监听，Node 无此方法
globalThis.removeEventListener = () => {};      // 同上（哨兵）

import fs from 'node:fs';
import path from 'node:path';
const ROOT = import.meta.dirname;
const OUT_BASE = path.join(ROOT, 'longrun');

// ---- 参数解析（支持 --flag value 与 --flag=value 两种风格） ----
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i];
    if (!s.startsWith('--')) continue;
    const key = s.replace(/^--/, '');
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { out[key] = next; i++; }
    else if (s.includes('=')) { out[key] = s.slice(s.indexOf('=') + 1); }
    else out[key] = true;
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const forceStub = !!args.stub;
const wantTurns = Number(args.turns) || 24;
const confirmed = !!args.yes;

// ---- localStorage shim（内存；不入磁盘，避免污染） ----
const _ls = {};
const localStorageShim = {
  getItem(k) { return Object.prototype.hasOwnProperty.call(_ls, k) ? _ls[k] : null; },
  setItem(k, v) { _ls[k] = String(v); },
  removeItem(k) { delete _ls[k]; }
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageShim, writable: false });

// ---- IIFE 模块加载（顺序按依赖） ----
// 大多数模块末尾用 `window.X = X` 自挂（`<script>` 顶层 var 即全局）；api-service 只声明 `var apiService = (...)()`
// 没有自挂——`new Function` 不像 `<script>` 把顶层 var 提升为全局，所以手动捕获后挂 window
const IIFE = [
  'numeric-contract', 'progression-contract',           // game-state 读（可选）
  'calamity-data',
  'json-repair-helper',                                 // response-parser 读
  'api-service',
  'command-engine',
  'command-processor',
  'response-parser',
  'worldbook-engine',
  'memory-store',
  'memory-api',
  'identity-system',
  'story-engine',
  'prompt-builder'                                       // 最后：依赖以上所有
];
for (const m of IIFE) {
  const code = fs.readFileSync(path.join(ROOT, 'module', m + '.js'), 'utf8');
  const capture = m === 'api-service' ? '; return apiService;' : '';
  const result = new Function(code + capture)();
  if (result) globalThis[m === 'api-service' ? 'apiService' : m.replace(/-./g, (s) => s[1].toUpperCase())] = result;
}

// ---- ESM 模块 ----
const promptDataMod = await import('./module/prompt-data-core-calamity.js');
const npcPromptsMod = await import('./module/prompt-data-npc-calamity.js');
const worldPromptsMod = await import('./module/prompt-data-world-calamity.js');
const equipmentMod = await import('./module/equipment-system.js');
const materialMod = await import('./module/material-system.js');
const questMod = await import('./module/quest-system.js');
const skillMod = await import('./module/skill-system.js');
const gameStateMod = await import('./module/game-state.js');
const travelInputMod = await import('./module/travel-input.js');
const travelSystemMod = await import('./module/travel-system.js');
const travelTablesMod = await import('./module/travel-tables.js');

// 把 ESM 数据绑成全局（与 index.html 等价的 window 别名，供 IIFE 读取）
globalThis.gameState = gameStateMod;

// worldbook-engine 需要 window.gameData — defineProperty 代理 getter
Object.defineProperty(globalThis, 'gameData', {
  get: () => gameStateMod.getGameData(),
  configurable: true
});

// ---- 世界书构建器（从 index.html 同步复制；确定性纯函数） ----
const { promptData } = promptDataMod;
const npcPrompts = npcPromptsMod.calamityPrompts;
const worldPrompts = worldPromptsMod.calamityPrompts;

function buildEquipmentWorldbook() {
  const eqDefault = equipmentMod.default;
  const { WEAPON_TEMPLATES, ARMOR_TEMPLATES } = eqDefault;
  const { MATERIALS } = materialMod;
  const wb = { "装备": {}, "武器": {}, "护甲": {} };
  const matLines = Object.entries(MATERIALS).map((e) => '- ' + e[0] + '级：' + e[1].name + '（价格×' + e[1].priceMultiplier + '）').join('\n');
  const wepSummary = Object.entries(WEAPON_TEMPLATES).map((e) => {
    const t = e[1];
    return '- ' + e[0] + '：1d' + t.damageBase + ' ' + t.damageType + '，' + t.speed + '，' + t.slot + (t.twoHanded ? '（双手）' : '') + (t.ranged ? '（远程）' : '');
  }).join('\n');
  const armSummary = Object.entries(ARMOR_TEMPLATES).map((e) => {
    const t = e[1];
    return '- ' + e[0] + '：AC ' + t.acBase + '，' + t.weight + (t.stealthPenalty ? '，潜行劣势' : '');
  }).join('\n');
  wb["装备"]["装备数据清单"] = '# 装备数据清单\n\n## 材料等级\n' + matLines + '\n\n## 武器列表\n' + wepSummary + '\n\n## 护甲列表\n' + armSummary;
  for (const [name, t] of Object.entries(WEAPON_TEMPLATES)) {
    wb["武器"][name] = '# ' + name + '\n\n## 基础数值\n- 伤害骰：1d' + t.damageBase + '（' + t.damageType + '）\n- 攻速：' + t.speed + '\n- 槽位：' + t.slot + (t.twoHanded ? '（双手）' : '') + (t.ranged ? '（远程）' : '') + '\n- 基础价格：' + t.basePrice + ' 金币\n- 耐久上限：' + t.durabilityMax + '\n\n## 描述\n' + t.description;
  }
  for (const [name, t] of Object.entries(ARMOR_TEMPLATES)) {
    wb["护甲"][name] = '# ' + name + '\n\n## 基础数值\n- AC 基础：' + t.acBase + '\n- 重量：' + t.weight + '\n- 敏捷加值：' + (t.dexBonus === 'full' ? '全额' : t.dexBonus === 'limited' ? '上限 +2' : '无') + (t.stealthPenalty ? '\n- 潜行：劣势' : '') + (t.strengthReq ? '\n- 力量需求：' + t.strengthReq : '') + '\n- 基础价格：' + t.basePrice + ' 金币\n- 耐久上限：' + t.durabilityMax + '\n\n## 描述\n' + t.description;
  }
  return wb;
}
function buildQuestWorldbook() {
  const { QUEST_TYPE, QUEST_TIER } = questMod;
  const wb = { "任务": {} };
  const typeLines = Object.entries(QUEST_TYPE).map((e) => '- **' + e[1] + '**').join('\n');
  const tierLines = Object.entries(QUEST_TIER).map((t) => '- **' + t[1].name + '**：奖励 ' + t[1].rewardMin + '~' + t[1].rewardMax + ' 金币，声望 +' + t[1].repMin + '~' + t[1].repMax).join('\n');
  wb["任务"]["任务类型"] = '# 任务类型\n\n' + typeLines;
  wb["任务"]["任务等级"] = '# 任务等级\n\n' + tierLines;
  return wb;
}
function buildSkillWorldbook() {
  const { SKILL_LEVEL, LEARN_SOURCE, SCENE_KEYWORDS } = skillMod;
  const wb = { "技能": {} };
  const levelLines = Object.entries(SKILL_LEVEL).map((e) => '- **Lv' + e[0] + '**（' + e[1].name + '）：加值 +' + e[1].bonus).join('\n');
  const sourceLines = Object.entries(LEARN_SOURCE).map((e) => '- **' + e[1] + '**').join('\n');
  const keywordLines = Object.entries(SCENE_KEYWORDS).map(([c, ks]) => ks.length ? '- **' + c + '**：' + ks.join('、') : null).filter(Boolean).join('\n');
  wb["技能"]["技能等级"] = '# 技能等级\n\n' + levelLines;
  wb["技能"]["习得来源"] = '# 习得来源\n\n' + sourceLines;
  wb["技能"]["场景关键词"] = '# 场景关键词\n\n' + keywordLines;
  return wb;
}

const equipmentWorldbook = buildEquipmentWorldbook();
const questWorldbook = buildQuestWorldbook();
const skillWorldbook = buildSkillWorldbook();
const mergedWorld = Object.assign({}, worldPrompts, equipmentWorldbook, questWorldbook, skillWorldbook);

window.calamityData.register(promptData, npcPrompts, mergedWorld);

// ---- API 凭据 / stub 决策 ----
const KEY_FILE = path.join(ROOT, '.api-key.local');
let cfg = null, stubMode = true;
if (fs.existsSync(KEY_FILE)) {
  try {
    cfg = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
    if (cfg && cfg.endpoint && cfg.apiKey && cfg.model) stubMode = false;
  } catch (e) { console.warn('[LongRun] .api-key.local 解析失败，回退 stub:', e.message); }
}
if (forceStub) stubMode = true;

if (!stubMode && !confirmed) {
  console.log('\n⚠️  检测到 .api-key.local 但未加 --yes，拒绝自动发起 API 调用以防误消耗。');
  console.log('  模式（推测）：模型=' + cfg.model + '  端点=' + new URL(cfg.endpoint).host);
  console.log('  估算：' + wantTurns + ' 回合 × ~10k prompt + ~1.5k output ≈ ' + Math.round(wantTurns * 11.5) + 'k tokens');
  console.log('  真跑请加 --yes：  node tools-longrun.js --yes');
  process.exit(0);
}

if (stubMode) {
  // 安装 stub：覆盖 apiService.sendMessages；压缩/提取按 system 关键词分流，主调用走合成叙事
  let stubTurn = 0;
  const stubCompress = () => ({ content: '【stub压缩】主角在锈钉镇及周边活动，与 NPC 互动并完成任务。', usage: { prompt_tokens: 1500, completion_tokens: 80 } });
  const stubExtract = () => ({ content: JSON.stringify([{ holder: '维克多·金牙', kind: '记得', memory: '主角是可靠的新人佣兵', known_by: [] }]), usage: { prompt_tokens: 1200, completion_tokens: 60 } });
  // 主调用合成：交替生成实体块 / 悬念块，验证 P1 遵从率统计；命令块简单 set 经验
  const stubMain = () => {
    const t = stubTurn++;
    let blocks = '';
    if (t % 2 === 1) blocks += '\n[实体更新]\n名称：维克多·金牙\n状态：在佣兵公会大厅\n变更：与玩家交谈\n[/实体更新]';
    if (t % 3 === 1) blocks += '\n[悬念]\n名称：委托板上的血手印\n描述：公告板角落有个未干血手印\n[/悬念]';
    const content = '<content>【stub 第 ' + (t + 1) + ' 回合】你在佣兵镇活动，与 NPC 互动并接取任务。\n赶路与战斗按系统掷骰结果呈现。</content>\n'
      + '<命令>\nadd 经验 = 5\n</命令>\n'
      + blocks + '\n'
      + '<SUMMARY>第 ' + (t + 1) + ' 回合：玩家进行了一次互动。</SUMMARY>';
    return { content: content, usage: { prompt_tokens: 3000 + t * 100, completion_tokens: 400 + t * 20 } };
  };
  window.apiService.sendMessages = async (messages) => {
    const sys = messages && messages[0] && messages[0].content || '';
    if (sys.indexOf('剧情记录员') >= 0) return stubCompress();
    if (sys.indexOf('记忆提取员') >= 0) return stubExtract();
    return stubMain();
  };
  // stub 模式下也要让压缩路径激活 → 给 apiService 一个假 apiKey
  const realConfig = window.apiService.getConfig();
  window.apiService.updateConfig(Object.assign({}, realConfig, { apiKey: realConfig.apiKey || 'stub-key', endpoint: realConfig.endpoint || 'http://stub', model: realConfig.model || 'stub-model' }));
}

// ---- 初始角色（佣兵身份，手工 kit 与 saveCharacter 等价的最小骨架） ----
const identity = '佣兵';
const attributes = { 力量: 14, 敏捷: 12, 体质: 13, 智力: 9, 感知: 11, 魅力: 10 };
const ac = 10 + Math.floor((attributes.敏捷 - 10) / 2);
const initialGd = {
  character: { name: '长跑测试员', race: '人类', gender: '女', age: 24, level: 1, exp: 0, expToNextLevel: 50, proficiencyBonus: 2, ac: ac, identity: identity },
  attributes,
  backgrounds: ['流民'],
  fatePoints: { current: 1, max: 3, lastRefreshDate: null },
  hp: { current: 13, max: 13 },
  equipment: {
    mainHand: { name: '铁剑', slot: 'mainHand', damage: '1d8+1', durability: { current: 20, max: 20 } },
    body: { name: '皮甲', slot: 'body', ac: 11, durability: { current: 15, max: 15 } }
  },
  inventory: [
    { name: '治疗药水', count: 2, weight: 0.3 },
    { name: '干粮', count: 5, weight: 0.5 },
    { name: '火把', count: 3, weight: 0.2 }
  ],
  currency: { gold: 40 },
  progress: { currentLocation: '佣兵镇·锈钉', currentPlace: '佣兵公会大厅', completedQuests: [], unlockedLocations: ['佣兵镇·锈钉'], backstory: '从北方边隘流浪到锈钉镇的年轻佣兵，凭着一把铁剑和不怕死的性子在公会站稳了脚跟。' },
  relationships: { '维克多·金牙': { 好感度: 0 }, '巴克': { 好感度: 0 } },
  quests: { active: [{ name: '灰烬森林讨伐', description: '清理灰烬森林外围的灰烬狼群', type: '支线', tier: '普通', objectives: [{ description: '击杀 3 头灰烬狼', completed: false }], rewards: {}, giver: '维克多·金牙' }], completed: [], failed: [] },
  skills: [],
  spells: [],
  gameTime: { year: 300, month: 11, day: 12, hour: 7, minute: 10, season: '秋' },
  tone: '',
  stats: { totalChecks: 0, successfulChecks: 0, criticalSuccesses: 0, criticalFailures: 0, combatsWon: 0, deaths: 0 },
  meta: { version: '1.0.0', createdAt: Date.now(), lastSavedAt: Date.now(), playTime: 0 }
};

// ---- 身份激活 + 故事系统初始化 ----
window.identitySystem.activate(identity);
await window.storyEngine.init();
gameStateMod.importGameData(initialGd);
window.identitySystem.activateFromSave();

// ---- 输出目录（每次 run 一个目录） ----
const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15); // YYYYMMDDTHHMMSS
const runDir = path.join(OUT_BASE, 'run-' + ts);
fs.mkdirSync(runDir, { recursive: true });
const narrativeFile = path.join(runDir, 'narrative.md');
fs.writeFileSync(narrativeFile, '# 长跑验证 · narrative\n\n');

// ---- 剧本（24 回合，覆盖城镇/旅行/遭遇/战斗/休整/返镇/交付） ----
const SCRIPT = [
  '我打量佣兵公会大厅四周，找找有什么适合新手的委托。',
  '走到委托板前，仔细读灰烬森林讨伐委托的细节。',
  '找公会职员登记这个委托，问问出发前有什么要准备的。',
  '去铁匠铺看看，顺便修整一下皮甲。',
  '和铁匠聊聊，问问他最近有没有什么新鲜的怪谈。',
  '返回佣兵公会大厅，准备明天一早出发。',
  '当晚我在旅馆休息，养足精神等天亮。',
  '天亮后离开佣兵镇，踏上前往灰烬森林的小路。',
  '路上留意四周动静，一有异响就拔剑戒备。',
  '抵达灰烬森林外围，开始搜索狼群踪迹。',
  '发现脚印和被啃食的猎物残骸，沿痕迹继续追。',
  '与三头灰烬狼遭遇，挺身迎战，保护身后退路。',
  '战斗结束，原地短暂包扎伤口，统计战果。',
  '继续深入森林一段，在水潭边停下稍作休整。',
  '整理背包，决定带着战利品返回锈钉镇。',
  '原路返回佣兵镇，沿途保持警觉。',
  '抵达镇子，直奔公会交差领赏。',
  '去杂货铺买两瓶治疗药水补充补给。',
  '回到铁匠铺，花些金币修整铁剑和皮甲。',
  '今晚在旅馆休整，把今天的收获整理记下。',
  '次日清早出发，这次目标是龙骨山脉的矿道入口。',
  '沿山路走了大半天，在山脚一处避风的岩洞里扎营过夜。',
  '天亮后继续向矿道进发，到达入口后观察地形。',
  '记录下矿道入口位置和周边环境，准备下次正式探索。'
];

// ---- 主循环 ----
const turnMetrics = [];
let history = [];
let apiCallsTotal = { prompt: 0, completion: 0 };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function storeSummaries(summaries, extra, gd) {
  const texts = (summaries || []).map(s => String(s).trim()).filter(s => s.length > 1);
  const entities = Array.isArray(extra.entities) ? extra.entities : [];
  const suspenses = Array.isArray(extra.suspenses) ? extra.suspenses : [];
  if (!texts.length && !entities.length && !suspenses.length) return 0;
  const location = (gd.progress && gd.progress.currentLocation) || '';
  const time = window.storyEngine.fmtGameTime(gd.gameTime);
  const floor = texts.length ? window.storyEngine.nextFloor() : window.storyEngine.currentFloor();
  await window.storyEngine.onTurnArchived({ floor, texts, time, location, entities, suspenses });
  return texts.length;
}

console.log('\n══════ 长跑验证器 · 启动 ══════');
console.log('模式：' + (stubMode ? 'STUB（合成响应）' : '真机（' + cfg.model + ' @ ' + new URL(cfg.endpoint).host + '）'));
console.log('剧本：' + Math.min(wantTurns, SCRIPT.length) + ' 回合');
console.log('产物目录：' + path.relative(ROOT, runDir));
console.log('');

const totalToRun = Math.min(wantTurns, SCRIPT.length);
for (let t = 0; t < totalToRun; t++) {
  const message = SCRIPT[t];
  const gd = gameStateMod.getGameData();
  const t0 = Date.now();

  // 1. 召回
  let recalledBlock = '';
  try { recalledBlock = (await window.storyEngine.buildInjectBlocks(message, gd)).join('\n\n'); } catch (e) { console.warn('[Recall]', e.message); }

  // 2. prompt 组装
  let prompt;
  try { prompt = window.promptBuilder.buildMessages({ gameData: gd, userMessage: message, history }); }
  catch (e) { console.warn('[BuildPrompt]', e.message); prompt = { messages: [{ role: 'system', content: '叙事者' }, { role: 'user', content: message }] }; }
  if (recalledBlock) prompt.messages.splice(1, 0, { role: 'system', content: recalledBlock });

  // 3. 旅行意图
  let pendingTravel = null, travelInfo = null;
  try {
    const ti = travelInputMod.parseTravelIntent(message, gd.progress && gd.progress.currentLocation, travelTablesMod.TRAVEL_LOCATIONS);
    if (ti.intent) {
      const settledClone = JSON.parse(JSON.stringify(gd));
      const tr = travelSystemMod.travelTo(ti.destination, settledClone);
      const tb = travelInputMod.buildTravelPromptBlock(tr);
      if (tb) prompt.messages.splice(1, 0, { role: 'system', content: tb });
      if (tr && tr.success) pendingTravel = { result: tr, settled: settledClone };
      travelInfo = { destination: ti.destination, fired: true, succeeded: !!(tr && tr.success),
        night: tr && tr.nightTravel, danger: tr && tr.effectiveDanger,
        encounter: tr && tr.encounter ? tr.encounter.creature + '×' + tr.encounter.count : null,
        surprise: tr && tr.encounter ? tr.encounter.surprise : null };
    }
  } catch (e) { console.warn('[Travel]', e.message); }

  // 4. LLM 调用（重试 ×3）
  let aiResult = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { aiResult = await window.apiService.sendMessages(prompt.messages, { stream: false }); break; }
    catch (e) { console.warn('  [Turn ' + (t + 1) + '] API 失败 ' + attempt + '/3: ' + (e.message || e)); await sleep(2000 * attempt); }
  }
  if (!aiResult) {
    turnMetrics.push({ turn: t + 1, failed: true, message });
    fs.appendFileSync(narrativeFile, '## 第 ' + (t + 1) + ' 回合（API 失败，跳过）\n**玩家** > ' + message + '\n\n');
    continue;
  }
  const responseContent = (aiResult && aiResult.content) || '';
  const usage = aiResult.usage || {};
  apiCallsTotal.prompt += (usage.prompt_tokens || usage.totalTokenCount || 0);
  apiCallsTotal.completion += (usage.completion_tokens || usage.candidatesTokenCount || 0);

  // 5. 解析 + 命令 + 任务
  const parsed = window.responseParser.run(responseContent);
  let finalGd = gd;
  let rejected = 0, applied = 0;
  if (parsed.commands && parsed.commands.length) {
    const r = window.commandProcessor.applyCommands(gd, parsed.commands);
    applied = parsed.commands.length;
    rejected = (r.report && r.report.rejected ? r.report.rejected.length : 0);
    finalGd = r.gameData || gd;
  }
  if (parsed.quests && parsed.quests.length) {
    const q = window.commandProcessor.applyQuests(finalGd, parsed.quests);
    finalGd = q.gameData || finalGd;
  }

  // 6. 旅行结算 + 落盘
  let travelApplied = false;
  if (pendingTravel) travelApplied = travelInputMod.applyTravelSettlement(finalGd, pendingTravel.settled);
  gameStateMod.importGameData(finalGd);

  // 7. 历史（逐字上下文 8 轮 = 16 条）
  history.push({ role: 'user', content: message });
  history.push({ role: 'assistant', content: parsed.mainText || '' });
  if (history.length > 16) history = history.slice(-16);

  // 8. 记忆归档（取最新 gd，避免 index.html 的 stale-ref quirk）
  try { await storeSummaries(parsed.summaries, { entities: parsed.entities, suspenses: parsed.suspenses }, gameStateMod.getGameData()); } catch (e) { console.warn('[Memory]', e.message); }

  const dur = Date.now() - t0;
  const stats = window.storyEngine.stats();

  // 9. 记录指标
  turnMetrics.push({
    turn: t + 1, durationMs: dur, location: (gd.progress && gd.progress.currentLocation) || '',
    input: message,
    usage: { prompt: usage.prompt_tokens || usage.totalTokenCount || 0, completion: usage.completion_tokens || usage.candidatesTokenCount || 0 },
    entities: (parsed.entities || []).length, suspenses: (parsed.suspenses || []).length, summaries: (parsed.summaries || []).length,
    commands: applied, commandsRejected: rejected,
    blocksRejected: (parsed.commands && parsed.commands.length === 0 && parsed.quests && parsed.quests.length === 0) ? 0 : 0,
    travel: travelInfo,
    travelApplied,
    parseIncomplete: !!parsed.parseIncomplete,
    memFloor: stats.floor, memSummary: stats.summary, memChron: stats.chronicle,
    memL1: stats.l1, memL2: stats.l2, memL3: stats.l3,
    memLedger: stats.ledger, memSuspAct: stats.suspenseActive, memSubj: stats.subjective
  });

  // 10. 控制台进度 + 日志追加
  const upTok = usage.prompt_tokens || usage.totalTokenCount || 0;
  const dnTok = usage.completion_tokens || usage.candidatesTokenCount || 0;
  console.log('[' + (t + 1) + '/' + totalToRun + '] ' + (dur / 1000).toFixed(1) + 's ↑' + upTok + ' ↓' + dnTok
    + ' | 实' + (parsed.entities || []).length + ' 悬' + (parsed.suspenses || []).length
    + ' | 命' + applied + '(拒' + rejected + ')'
    + (travelInfo ? ' | 旅行→' + travelInfo.destination + (travelInfo.encounter ? ' 遇' + travelInfo.encounter + (travelInfo.surprise ? ' 被偷' : ' 未偷') : ' 无遭遇') : '')
    + ' | 楼层' + stats.floor);
  fs.appendFileSync(narrativeFile,
    '## 第 ' + (t + 1) + ' 回合\n'
    + '**玩家** > ' + message + '\n\n'
    + '**AI**\n\n' + (parsed.mainText || '（无）') + '\n\n'
    + '—— 耗时 ' + dur + 'ms · tokens ↑' + upTok + ' ↓' + dnTok
    + ' · 实体块 ' + (parsed.entities || []).length + ' · 悬念块 ' + (parsed.suspenses || []).length
    + ' · 命令 ' + applied + '（拒 ' + rejected + '）'
    + (travelInfo ? ' · 旅行→' + travelInfo.destination : '')
    + '\n\n---\n\n');
}

// ---- 汇总报告 ----
const successTurns = turnMetrics.filter(m => !m.failed);
const aggregate = {
  mode: stubMode ? 'stub' : 'real',
  model: stubMode ? 'stub' : cfg.model,
  endpoint: stubMode ? 'stub' : new URL(cfg.endpoint).host,
  startedAt: new Date().toISOString(),
  turns: turnMetrics.length, failedTurns: turnMetrics.filter(m => m.failed).length,
  totalPromptTokens: apiCallsTotal.prompt,
  totalCompletionTokens: apiCallsTotal.completion,
  avgDurationMs: successTurns.length ? Math.round(successTurns.reduce((s, m) => s + m.durationMs, 0) / successTurns.length) : 0,
  p1: {
    entityTurns: successTurns.filter(m => m.entities > 0).length,
    suspenseTurns: successTurns.filter(m => m.suspenses > 0).length,
    totalEntityBlocks: successTurns.reduce((s, m) => s + m.entities, 0),
    totalSuspenseBlocks: successTurns.reduce((s, m) => s + m.suspenses, 0)
  },
  commands: {
    total: successTurns.reduce((s, m) => s + m.commands, 0),
    rejected: successTurns.reduce((s, m) => s + m.commandsRejected, 0)
  },
  travel: {
    fired: successTurns.filter(m => m.travel && m.travel.fired).length,
    encounters: successTurns.filter(m => m.travel && m.travel.encounter).length,
    surprises: successTurns.filter(m => m.travel && m.travel.surprise).length,
    night: successTurns.filter(m => m.travel && m.travel.night).length,
    routes: successTurns.filter(m => m.travel).map(m => ({ dest: m.travel.destination, night: m.travel.night, danger: m.travel.danger, encounter: m.travel.encounter, surprise: m.travel.surprise }))
  },
  memoryFinal: window.storyEngine.stats(),
  sagas: window.memoryStore.allStory()
    .filter(r => r.level === 3 && !r.absorbedBy)
    .map(r => ({ from: r.from, to: r.to, len: r.text.length, text: r.text }))
};

const metricsPath = path.join(runDir, 'metrics.json');
fs.writeFileSync(metricsPath, JSON.stringify({ aggregate, turns: turnMetrics }, null, 2));
fs.writeFileSync(path.join(runDir, 'final-gameData.json'), JSON.stringify(gameStateMod.getGameData(), null, 2));

console.log('\n══════ 长跑完成 ══════');
console.log('回合：' + turnMetrics.length + '（失败 ' + aggregate.failedTurns + '）');
console.log('Tokens：↑' + aggregate.totalPromptTokens + ' ↓' + aggregate.totalCompletionTokens);
console.log('平均耗时：' + (aggregate.avgDurationMs / 1000).toFixed(1) + 's');
console.log('P1 块：实体 ' + aggregate.p1.entityTurns + '/' + successTurns.length + ' 回合 · 悬念 ' + aggregate.p1.suspenseTurns + '/' + successTurns.length);
console.log('命令：' + aggregate.commands.total + ' 条（拒 ' + aggregate.commands.rejected + '）');
console.log('旅行：触发 ' + aggregate.travel.fired + ' · 遭遇 ' + aggregate.travel.encounters + '（被偷 ' + aggregate.travel.surprises + '）· 夜路 ' + aggregate.travel.night);
console.log('记忆终态：楼层 ' + aggregate.memoryFinal.floor + ' · 纪要 ' + aggregate.memoryFinal.summary + ' · 编年史 ' + aggregate.memoryFinal.chronicle
  + ' · 纪事 ' + aggregate.memoryFinal.l1 + ' · 卷宗 ' + aggregate.memoryFinal.l2 + ' · 典章 ' + aggregate.memoryFinal.l3 + '（注入 ' + aggregate.memoryFinal.l3Injected + '）');
console.log('典章（输出 + 降级）字数组：' + aggregate.sagas.map(s => '[' + s.from + '~' + s.to + '] ' + s.len + '字').join(' | ') + '（降级注入由召回块补足）');
console.log('\n产物：');
console.log('  ' + path.relative(ROOT, narrativeFile));
console.log('  ' + path.relative(ROOT, metricsPath));
console.log('  ' + path.relative(ROOT, path.join(runDir, 'final-gameData.json')));

process.exit(0);
