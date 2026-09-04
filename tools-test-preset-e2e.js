// 全链路验证：polarday 预设 → prompt-builder.buildMessages → 最终 API 消息链
global.window = {
  worldbookEngine: { buildWorldbookBlocks: () => ({ npcBlocks: [], wbBlocks: [], actionGuide: '测试行动指导' }) },
  calamityData: { get: () => '', hasOpening: () => false }
};

const fs = require('fs');
const presetFile = 'c:/Users/Administrator/.trae-cn/attachments/6a993993d48928480dafeae3/5ea80a0d-f556-4169-9b86-0ffcd867991e_c63c64d1-c70f-43ca-97fa-71bd44ae1618_【梁元】polarday 0.1.9 fixed（v4Mj二创版 1.6）.json';

require('./module/preset-importer.js');
require('./module/prompt-builder.js');
const importer = global.window.presetImporter;
const builder = global.window.promptBuilder;

let pass = 0, fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓ ' + name + (detail ? ' — ' + detail : '')); }
  else { fail++; console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); }
};

const raw = JSON.parse(fs.readFileSync(presetFile, 'utf8'));
const preset = importer.规范化酒馆预设(raw);
builder.setSTPreset(preset);

const gd = {
  character: { name: '灰烬行者', race: '人类', gender: '男', age: 25, level: 3 },
  hp: { current: 18, max: 24 }, fatePoints: { current: 1, max: 2 },
  currency: { gold: 45 }
};
const result = builder.buildMessages({
  userMessage: '我环顾四周，寻找掩体',
  gameData: gd,
  lastAssistantReply: '上一轮回复：你沿着废弃公路前行。'
});
const msgs = result.messages;

console.log('=== 最终消息链（' + msgs.length + ' 条） ===');
msgs.forEach((m, i) => console.log('  [' + String(i).padStart(2) + '] ' + m.role.padEnd(9) + ' ' + String(m.content.length).padStart(5) + '字  ' + m.content.slice(0, 45).replace(/\n/g, '\\n')));

console.log('\n=== 检查项 ===');
const find = (re) => msgs.findIndex(m => re.test(m.content));

// 1. 宏零残留（排除游戏侧内容）
const presetMsgs = msgs.filter(m => !m.content.includes('当前状态') && !m.content.includes('玩家行动'));
check('预设部分宏零残留', !presetMsgs.some(m => /\{\{[^{}]*\}\}/.test(m.content)));

// 2. 系统提示词注入在 <WorldContext> 与 </WorldContext> 之间
const openW = find(/^<WorldContext>/), closeW = find(/^<\/WorldContext>/), sys = find(/当前状态/);
check('存在 <WorldContext> 开标签', openW >= 0);
check('存在系统提示词', sys >= 0);
check('系统提示词在 WorldContext 内', openW >= 0 && sys > openW && sys < closeW,
  'open=' + openW + ' sys=' + sys + ' close=' + closeW);

// 3. 消息顺序：WorldContext 开 → 系统 → WorldContext 关 → Documentation 开/关 → [Start a new chat] → 上次回复 → 本次输入 → after 模板 → prefill
const chatStart = msgs.findIndex(m => m.content === '[Start a new chat]');
const lastReply = find(/上一轮回复/);
const userInput = find(/玩家行动|我环顾四周，寻找掩体/);
const thinkTpl = find(/thinking/);
const prefill = msgs.findIndex(m => m.role === 'assistant' && /thinking/.test(m.content));
check('[Start a new chat] 在系统之后', chatStart > sys);
check('上次回复在 chatStart 后', lastReply === chatStart + 1);
check('本次输入在上次回复后', userInput === lastReply + 1);
check('思维链模板在本次输入后（post-history）', thinkTpl > userInput);
check('末条为 assistant 预填充', msgs[msgs.length - 1].role === 'assistant');

// 4. after 段（post-history）包含输出模板/正文模板
check('输入之后存在正文模板', msgs.slice(userInput + 1).some(m => /正文示例模板/.test(m.content)));

// 5. {{lastUserMessage}} 替换进 NarrativeBeat
check('用户输入已注入 NarrativeBeat', msgs.some(m => /<NarrativeBeat>/.test(m.content) && m.content.includes('我环顾四周，寻找掩体')));

// 6. 变量内容注入（矜持化内容应通过模板 getvar 出现在最终链中）
const 矜持 = raw.prompts.find(p => /矜持化/.test(p.name || ''));
const probeMatch = 矜持.content.match(/\{\{(?:setvar|addvar)::[^:]+::([\s\S]*?)\}\}/);
const probe = probeMatch ? probeMatch[1].trim().slice(0, 25) : '';
check('矜持化内容已进入最终链（order 优先级修正）', probe && msgs.some(m => m.content.includes(probe)), '"' + probe.slice(0, 20).replace(/\n/g, '\\n') + '"');

// 7. 全链无 setvar/addvar/getvar 残留
check('无变量宏残留', !msgs.some(m => /\{\{(setvar|addvar|getvar|incvar|decvar)/i.test(m.content)));

// 8. 无预设禁用角色泄漏（assistant 只出现在 上次回复/预填充）
const assistantIdx = msgs.map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i >= 0);
check('assistant 仅上次回复与预填充', assistantIdx.length === 2, JSON.stringify(assistantIdx));

// 9. 生成参数透出
const gen = importer.提取生成参数(preset);
check('生成参数提取', gen && gen.temperature === 1 && gen.max_output_tokens === 65536);

// 10. 回退路径：无 worldInfo marker 的预设 → 系统提示词回消息链首位
const fallbackPreset = JSON.parse(JSON.stringify(preset));
fallbackPreset.prompt_order.forEach(o => o.order.forEach(it => {
  if (it.identifier === 'worldInfoBefore' || it.identifier === 'worldInfoAfter') it.enabled = false;
}));
builder.setSTPreset(fallbackPreset);
const fb = builder.buildMessages({ userMessage: '测试', gameData: gd, lastAssistantReply: '' });
check('无 marker 回退：系统提示词在首位', fb.messages[0].role === 'system' && /当前状态/.test(fb.messages[0].content));

// 11. 关闭预设 → 原生三段式
builder.setSTPreset(null);
const off = builder.buildMessages({ userMessage: '测试', gameData: gd, lastAssistantReply: 'x' });
check('关闭预设：system + [Start] + 回复 + 输入', off.messages.length === 4 && off.messages[0].role === 'system' && off.messages[3].role === 'user');

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
