// 临时分析脚本：扫描 polarday 预设的宏使用与结构
const fs = require('fs');
const path = 'c:\\Users\\Administrator\\.trae-cn\\attachments\\6a993993d48928480dafeae3\\5ea80a0d-f556-4169-9b86-0ffcd867991e_c63c64d1-c70f-43ca-97fa-71bd44ae1618_【梁元】polarday 0.1.9 fixed（v4Mj二创版 1.6）.json';

const raw = JSON.parse(fs.readFileSync(path, 'utf8'));

console.log('=== 基本信息 ===');
console.log('prompts 数量:', (raw.prompts || []).length);
console.log('prompt_order character_ids:', (raw.prompt_order || []).map(o => o.character_id));

// 所有宏（不限长度）
const macroRe = /\{\{[\s\S]*?\}\}/g;
const macroCount = new Map();
for (const p of raw.prompts || []) {
  const content = typeof p.content === 'string' ? p.content : '';
  let m;
  const re = new RegExp(macroRe.source, 'g');
  while ((m = re.exec(content)) !== null) {
    const key = m[0].length > 60 ? m[0].slice(0, 60) + '...' : m[0];
    macroCount.set(key, (macroCount.get(key) || 0) + 1);
  }
}
console.log('\n=== 全部宏（按出现次数） ===');
[...macroCount.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(String(v).padStart(3), k.replace(/\n/g, '\\n')));

// prompt_order 结构
console.log('\n=== prompt_order（第一个 character_id 的顺序） ===');
const order0 = (raw.prompt_order || [])[0];
if (order0) {
  console.log('character_id:', order0.character_id, ' 顺序项数量:', order0.order.length);
  const promptMap = new Map((raw.prompts || []).map(p => [p.identifier, p]));
  order0.order.forEach((item, i) => {
    const p = promptMap.get(item.identifier);
    const name = p ? (p.name || '') : '(不存在)';
    const marker = p && p.marker ? '[marker]' : '        ';
    const role = p ? (p.role || 'system') : '?';
    console.log(String(i).padStart(3), item.enabled === false ? '✗禁用' : '✓启用', marker, role.padEnd(9), item.identifier.slice(0, 20).padEnd(20), name.slice(0, 30));
  });
}

// 生成参数
console.log('\n=== 生成参数 ===');
['temperature', 'frequency_penalty', 'presence_penalty', 'top_p', 'top_k', 'openai_max_context', 'openai_max_tokens', 'stream_openai'].forEach(k => {
  if (raw[k] !== undefined) console.log(k, '=', raw[k]);
});

// {{trim}} 与 {{角色}} 上下文
console.log('\n=== 特殊宏上下文 ===');
for (const p of raw.prompts || []) {
  const content = typeof p.content === 'string' ? p.content : '';
  if (/\{\{\/?trim\}\}/.test(content)) {
    console.log('--- trim 出现在:', p.name, '(identifier:', p.identifier + ')');
    const idx = content.indexOf('{{trim}}');
    console.log(JSON.stringify(content.slice(Math.max(0, idx - 80), idx + 100)));
  }
  if (/\{\{角色\}\}/.test(content)) {
    console.log('--- {{角色}} 出现在:', p.name);
    const idx = content.indexOf('{{角色}}');
    console.log(JSON.stringify(content.slice(Math.max(0, idx - 100), idx + 100)));
  }
  if (/\{\{personality\}\}/i.test(content)) {
    console.log('--- {{personality}} 出现在:', p.name);
    const idx = content.search(/\{\{personality\}\}/i);
    console.log(JSON.stringify(content.slice(Math.max(0, idx - 80), idx + 120)));
  }
  if (/\{\{scenario\}\}/i.test(content)) {
    console.log('--- {{scenario}} 出现在:', p.name);
    const idx = content.search(/\{\{scenario\}\}/i);
    console.log(JSON.stringify(content.slice(Math.max(0, idx - 80), idx + 120)));
  }
}
