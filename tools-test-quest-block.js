// 任务块协议端到端测试：解析 → 落库 → 面板数据
globalThis.window = globalThis;
const fs = require('fs');
new Function(fs.readFileSync(__dirname + '/module/response-parser.js', 'utf8'))();
new Function(fs.readFileSync(__dirname + '/module/command-processor.js', 'utf8'))();
const parser = window.responseParser;
const processor = window.commandProcessor;

const resp = '<content>\n----- ✦ 灾厄300年11月12日 09:30 ✦ -----\n\n艾莉丝递来一张字条。\n\n[新任务]\n名称：枯萎的焦木\n类型：个人请求\n发布者：艾莉丝\n等级：杂务\n描述：采集质地坚硬、未完全沙化的焦木树心×4\n目标：\n- 采集焦木树心 0/4\n奖励：4 金币\n[/新任务]\n</content>\n<命令>\n无\n</命令>';

const p = parser.run(resp);
console.log('1. 解析出任务数:', p.quests.length, '(期望 1)');
console.log('2. 任务名:', p.quests[0] && p.quests[0].quest.name, '(期望 枯萎的焦木)');
console.log('3. 目标数:', p.quests[0] && p.quests[0].quest.objectives.length, '(期望 1)');
console.log('4. mainText 残留任务块标签:', p.mainText.indexOf('新任务') >= 0, '(期望 false)');
console.log('5. mainText 保留正文:', p.mainText.indexOf('艾莉丝递来一张字条') >= 0, '(期望 true)');

// 落库：以带开局任务的存档为底
const startGd = {
  quests: { active: [{ id: 'quest_opening', name: '灰烬森林材料狩猎', status: 'active', objectives: [] }], completed: [], failed: [] }
};
const result = processor.applyQuests(startGd, p.quests);
const active = result.gameData.quests.active;
console.log('6. 落库后活跃任务数:', active.length, '(期望 2)');
console.log('7. 新任务在列:', active.some(q => q.name === '枯萎的焦木'), '(期望 true)');

// 完成块测试
const p2 = parser.run('剧情……\n[任务完成]\n名称：枯萎的焦木\n[/任务完成]');
const r2 = processor.applyQuests(result.gameData, p2.quests);
console.log('8. 完成块解析:', p2.quests.length === 1 && p2.quests[0].type === 'complete', '(期望 true)');
console.log('9. 完成后活跃任务数:', r2.gameData.quests.active.length, '(期望 1)');
console.log('10. 进入已完成:', r2.gameData.quests.completed.some(q => q.name === '枯萎的焦木'), '(期望 true)');

const pass = p.quests.length === 1 && p.quests[0].quest.name === '枯萎的焦木'
  && p.mainText.indexOf('新任务') < 0 && p.mainText.indexOf('艾莉丝') >= 0
  && active.length === 2 && r2.gameData.quests.active.length === 1;
console.log(pass ? '✅ 全部通过' : '❌ 存在失败项');
process.exit(pass ? 0 : 1);
