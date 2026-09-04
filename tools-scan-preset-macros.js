const fs = require('fs');
const path = 'c:/Users/Administrator/.trae-cn/attachments/6a993993d48928480dafeae3/5ea80a0d-f556-4169-9b86-0ffcd867991e_c63c64d1-c70f-43ca-97fa-71bd44ae1618_【梁元】polarday 0.1.9 fixed（v4Mj二创版 1.6）.json';
const raw = JSON.parse(fs.readFileSync(path, 'utf8'));

// 1. 检查 setvar/addvar 值中是否有嵌套 {{ }}（会破坏非贪婪正则）
console.log('=== setvar/addvar 值中嵌套宏检查 ===');
let nestedCount = 0;
(raw.prompts || []).forEach(p => {
  const content = p.content || '';
  const re = /\{\{(setvar|addvar)::([^:]+)::([\s\S]*?)\}\}/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const value = m[3];
    if (/\{\{|\}\}/.test(value)) {
      nestedCount++;
      if (nestedCount <= 10) {
        console.log('[' + p.identifier + '] 嵌套: ' + m[0].slice(0, 200).replace(/\n/g, '\\n'));
      }
    }
  }
});
console.log('嵌套总数: ' + nestedCount);

// 2. setvar/addvar 值里出现的内部宏名统计（用平衡扫描：找完整 {{...}} 再看里面）
console.log('\n=== 值内宏名统计（平衡扫描） ===');
const innerMacros = {};
(raw.prompts || []).forEach(p => {
  const content = p.content || '';
  // 先匹配所有 {{...}} 直到平衡的 }}
  const re = /\{\{((?:[^{}]|\{[^{]*\})*?)\}\}/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const body = m[1];
    if (/^(setvar|addvar)::/i.test(body)) {
      const parts = body.split('::');
      const value = parts.slice(2).join('::');
      const inner = value.match(/\{\{([^{}]*)\}\}/g) || [];
      inner.forEach(x => {
        const n = x.replace(/^\{\{|\}\}$/g, '').split(/::|:/)[0].trim();
        innerMacros[n] = (innerMacros[n] || 0) + 1;
      });
    }
  }
});
Object.entries(innerMacros).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(v + '\t' + k));

// 3. random 完整形态
console.log('\n=== random 宏完整形态 ===');
(raw.prompts || []).forEach(p => {
  const content = p.content || '';
  const re = /\{\{random[^{}]*\}\}/gi;
  let m;
  while ((m = re.exec(content)) !== null) {
    console.log('[' + (p.name || p.identifier).slice(0, 20) + '] ' + m[0].slice(0, 150));
  }
});

// 4. 变量名检查：是否含冒号或花括号
console.log('\n=== 变量名特殊字符检查 ===');
const varNames = new Set();
(raw.prompts || []).forEach(p => {
  const content = p.content || '';
  const re = /\{\{(?:setvar|addvar|getvar|incvar|decvar)::([^:]+?)(?:::|[\}])/gi;
  let m;
  while ((m = re.exec(content)) !== null) varNames.add(m[1].trim());
});
const weird = [...varNames].filter(n => /[{}:]/.test(n));
console.log('变量总数: ' + varNames.size + '，含特殊字符: ' + weird.length);
weird.slice(0, 10).forEach(n => console.log('  异常名: ' + n));

// 5. getvar 引用的变量是否都有 setvar 来源（找出引擎执行时会得到空串的 getvar）
console.log('\n=== getvar 引用 vs setvar 定义 ===');
const defined = new Set();
(raw.prompts || []).forEach(p => {
  const content = p.content || '';
  const re = /\{\{(?:setvar|addvar)::([^:]+?)::/g;
  let m;
  while ((m = re.exec(content)) !== null) defined.add(m[1].trim());
});
const undefinedRefs = new Set();
(raw.prompts || []).forEach(p => {
  const content = p.content || '';
  const re = /\{\{getvar::([^:{}]+)\}\}/gi;
  let m;
  while ((m = re.exec(content)) !== null) {
    const n = m[1].trim();
    if (!defined.has(n)) undefinedRefs.add(n);
  }
});
console.log('未定义即引用的变量: ' + undefinedRefs.size);
[...undefinedRefs].slice(0, 20).forEach(n => console.log('  ' + n));

// 6. 顺序执行依赖检查：getvar 所在提示词在 order 中是否晚于定义它的 setvar 提示词
console.log('\n=== 启用顺序（前30条） ===');
const order = (raw.prompt_order || []).find(o => o.character_id === 100001);
const promptMap = new Map((raw.prompts || []).map(p => [p.identifier, p]));
if (order) {
  order.order.forEach((item, idx) => {
    const p = promptMap.get(item.identifier);
    const label = p ? (p.name || p.identifier) : item.identifier;
    console.log(String(idx).padStart(2) + ' ' + (item.enabled ? '✓' : '✗') + ' ' + String(label).slice(0, 45));
  });
}
