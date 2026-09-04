// 检查 order.enabled 与 prompt.enabled 冲突（ST 语义：order 状态优先）
const fs = require('fs');
const presetPath = 'c:/Users/Administrator/.trae-cn/attachments/6a993993d48928480dafeae3/5ea80a0d-f556-4169-9b86-0ffcd867991e_c63c64d1-c70f-43ca-97fa-71bd44ae1618_【梁元】polarday 0.1.9 fixed（v4Mj二创版 1.6）.json';
const raw = JSON.parse(fs.readFileSync(presetPath, 'utf8'));

const promptMap = new Map((raw.prompts || []).map(p => [p.identifier, p]));
const order = (raw.prompt_order || []).find(o => o.character_id === 100001);

let conflict = 0;
(order.order || []).forEach(item => {
  const p = promptMap.get(item.identifier);
  if (!p) { console.log('order 引用了不存在的 prompt: ' + item.identifier); return; }
  if (item.enabled === true && p.enabled === false) {
    conflict++;
    console.log('冲突(order开/prompt关): ' + (p.name || p.identifier));
  }
  if (item.enabled === false && p.enabled === true) {
    console.log('(order关/prompt开，ST 也不执行，无碍): ' + (p.name || p.identifier));
  }
});
console.log('\n会因当前实现被误跳过的条目数: ' + conflict);

// marker 检查：哪些是 marker
console.log('\n=== marker 提示词 ===');
(raw.prompts || []).filter(p => p.marker).forEach(p => console.log('  ' + (p.name || p.identifier) + ' (id=' + p.identifier + ')'));

// 预填充提示词角色确认
console.log('\n=== assistant 角色提示词 ===');
(raw.prompts || []).filter(p => p.role === 'assistant').forEach(p => console.log('  ' + (p.name || p.identifier)));
