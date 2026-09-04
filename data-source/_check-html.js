const fs = require('fs');
const path = require('path');
const root = 'e:/笔记/写卡/RGB/灾厄之后-独立版';
['index.html', 'game.html', '测试-AI链路.html'].forEach(f => {
  const c = fs.readFileSync(path.join(root, f), 'utf8');
  console.log('=== ' + f + ' ===');
  // 1. calamity-data.js loaded?
  console.log('  calamity-data.js script: ' + /<script[^>]*src="[^"]*calamity-data\.js"/.test(c));
  // 2. data module imports present?
  console.log('  core import: ' + c.includes("prompt-data-core-calamity.js"));
  console.log('  npc import: ' + c.includes("prompt-data-npc-calamity.js"));
  console.log('  world import: ' + c.includes("prompt-data-world-calamity.js"));
  console.log('  register call: ' + c.includes('window.calamityData.register'));
  // 3. script tag balance
  const open = (c.match(/<script/g) || []).length;
  const close = (c.match(/<\/script>/g) || []).length;
  console.log('  script tags open/close: ' + open + '/' + close);
});
