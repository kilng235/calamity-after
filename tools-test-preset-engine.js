// 宏引擎回归测试：用真实 polarday 预设验证 构建预设消息链
const fs = require('fs');
const importer = require('./module/preset-importer.js');

const presetPath = 'c:\\Users\\Administrator\\.trae-cn\\attachments\\6a993993d48928480dafeae3\\5ea80a0d-f556-4169-9b86-0ffcd867991e_c63c64d1-c70f-43ca-97fa-71bd44ae1618_【梁元】polarday 0.1.9 fixed（v4Mj二创版 1.6）.json';
const raw = JSON.parse(fs.readFileSync(presetPath, 'utf8'));

const preset = importer.规范化酒馆预设(raw);
if (!preset) { console.error('✗ 规范化失败'); process.exit(1); }
console.log('✓ 规范化成功：', preset.prompts.length, '条提示词，order:', preset.prompt_order.length, '组');

const ctx = { userName: '灰烬行者', charName: '旁白', lastUserMessage: '我推开酒馆的门，环顾四周' };
const chain = importer.构建预设消息链(preset, ctx);
const messages = chain.before.concat(chain.after, chain.prefill);
console.log('✓ 消息链构建：before ' + chain.before.length + ' + after ' + chain.after.length + ' + prefill ' + chain.prefill.length + ' = ' + messages.length + '条');

let fail = 0;
const check = (name, cond) => {
  console.log((cond ? '✓' : '✗ FAIL'), name);
  if (!cond) fail++;
};

// 1. 所有消息内容中不应残留任何 {{...}} 宏
const leftover = [];
messages.forEach((m, i) => {
  const found = m.content.match(/\{\{[\s\S]{0,60}?\}\}/g);
  if (found) leftover.push('msg[' + i + '](' + m.role + '): ' + found.join(' | '));
});
check('无残留宏（' + leftover.length + ' 处）' + (leftover.length ? '\n  ' + leftover.join('\n  ') : ''), leftover.length === 0);

// 2. 最后一条应为 assistant 预填充（💊︱模板-预填充 是 order 最后一条启用项）
check('末条消息为 assistant 预填充', messages.length > 0 && messages[messages.length - 1].role === 'assistant');

// 3. 预填充内容应已解析（含思维链定位文本，而不是 {{getvar::}}）
const last = messages[messages.length - 1];
check('预填充宏已执行（不含 getvar）', !/\{\{/.test(last.content));
console.log('  预填充内容预览:', JSON.stringify(last.content.slice(0, 120)));

// 4. 用户输入宏应替换为真实输入
const inputMsg = messages.find(m => m.content.includes('NarrativeBeat'));
check('用户输入模板存在且含真实输入', !!inputMsg && inputMsg.content.includes('我推开酒馆的门，环顾四周'));
if (inputMsg) console.log('  用户输入模板预览:', JSON.stringify(inputMsg.content.slice(0, 150)));

// 5. 叙事风格模块应拼装完成（<ProseStyle> 包裹）
const styleMsg = messages.find(m => m.content.includes('<ProseStyle>'));
check('叙事风格模块已拼装', !!styleMsg);
if (styleMsg) console.log('  叙事风格长度:', styleMsg.content.length, '字符，预览:', JSON.stringify(styleMsg.content.slice(0, 100)));

// 6. {{user}} 类静态宏
check('用户名可替换', importer.替换文本宏('{{user}}与{{用户}}', ctx) === '灰烬行者与灰烬行者');
check('角色名可替换', importer.替换文本宏('{{char}}/{{角色}}', ctx) === '旁白/旁白');
check('卡字段宏替换为空', importer.替换文本宏('A{{personality}}B{{scenario}}C', ctx) === 'ABC');

// 7. 单元测试：变量宏顺序语义（ST 语义：addvar 为字符串拼接，incvar/decvar 为数值运算）
const engine = importer.创建宏引擎(ctx);
let t = engine.执行('{{setvar::x::10}}{{addvar::x::5}}x={{getvar::x}}');
check('setvar/addvar/getvar 顺序执行（addvar 字符串拼接，与 ST 一致）', t === 'x=105');
t = engine.执行('{{incvar::x}}x={{getvar::x}}');
check('incvar 数值递增', t === 'x=106');
t = engine.执行('{{getvar::不存在的变量}}END');
check('未设置变量 → 空串', t === 'END');
t = engine.执行('{{//这是注释}}正文{{//多行\n注释}}');
check('注释宏剥离', t === '正文');
t = engine.执行('{{trim}}\n  A  {{trim}}\n  B {{trim}}');
check('trim 分段去空白', t === 'AB');
t = engine.执行('{{random::甲::乙::丙}}');
check('random 冒号形式', ['甲', '乙', '丙'].includes(t));
t = engine.执行('{{random:甲,乙}}');
check('random 逗号形式', ['甲', '乙'].includes(t));
t = engine.执行('{{random::1::2}}{{roll::1d20}}');
check('未识别宏保留原样（roll 等复杂宏不处理）', /\{\{roll::1d20\}\}/.test(t) && !/\{\{random/.test(t));

// 8. 禁用提示词的 setvar 不应生效（polarday 的 NSFW 模块默认禁用 → NSFW风格 为空）
const nsfwMsg = messages.find(m => m.content.includes('<SmutStyle>'));
check('禁用模块不注入（SmutStyle 默认关闭时消息为空被跳过）', !nsfwMsg);

// 9. 消息角色分布
const roleCount = {};
messages.forEach(m => { roleCount[m.role] = (roleCount[m.role] || 0) + 1; });
console.log('\n消息角色分布:', JSON.stringify(roleCount));
console.log('\n── 消息链一览 ──');
messages.forEach((m, i) => {
  console.log(String(i).padStart(2), m.role.padEnd(9), String(m.content.length).padStart(6) + '字', JSON.stringify(m.content.slice(0, 60)));
});

console.log('\n' + (fail === 0 ? '══ 全部通过 ══' : '══ ' + fail + ' 项失败 ══'));
process.exit(fail === 0 ? 0 : 1);
