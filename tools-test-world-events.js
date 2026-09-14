/**
 * tools-test-world-events.js - 验证废土动态突发遭遇池与种族历法节日系统
 */
import worldEventsSystem from './module/world-events.js';
import promptBuilder from './module/prompt-builder.js';

let passed = 0;
let total = 0;

function assert(condition, msg) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    console.error(`  ✗ ${msg}`);
    process.exitCode = 1;
  }
}

console.log('=== 测试 1: 9 大种族历法节日体系完整性 ===');
assert(worldEventsSystem.festivals.length === 9, `应注册 9 大种族节日，实际：${worldEventsSystem.festivals.length}`);

// 开局首日节日测试 (11月12日 -> 人类重燃节)
const fest1112 = worldEventsSystem.getTodayFestival({ month: 11, day: 12 });
assert(fest1112 !== null, '11月12日成功检测到节日');
assert(fest1112.name === '重燃节', '节日名称为重燃节');
assert(fest1112.race === '人类', '重燃节属于人类');
assert(fest1112.buff.name === '重燃之火', '重燃节专属增益正确');

// 仲冬节日测试 (12月25日 -> 矮人熔炉余响祭)
const fest1225 = worldEventsSystem.getTodayFestival({ month: 12, day: 25 });
assert(fest1225 !== null && fest1225.name === '熔炉余响祭', '12月25日成功匹配矮人熔炉余响祭');

// 非节日日期测试
const festNone = worldEventsSystem.getTodayFestival({ month: 6, day: 1 });
assert(festNone === null, '非节日日期正确返回 null');

console.log('\n=== 测试 2: 四大动态突发遭遇池与身份特权联动 ===');
assert(worldEventsSystem.encounters.length >= 6, `遭遇池至少包含 6 种以上经典突发遭遇，实际：${worldEventsSystem.encounters.length}`);

// 摇骰抽取遭遇并验证身份联动钩子
let hasIdentityHook = false;
for (let i = 0; i < 20; i++) {
  const enc = worldEventsSystem.rollEncounter({ location: '风蚀荒原', identity: '荒原游侠' });
  if (enc && enc.identityHook) {
    hasIdentityHook = true;
    break;
  }
}
assert(hasIdentityHook === true, '荒原游侠在荒原遭遇中成功触发了专属特权应对路径');

console.log('\n=== 测试 3: Prompt 注入块构建与世界书联动 ===');
const mockGameData = {
  character: { name: '罗恩', race: '人类', identity: '遗迹猎手' },
  gameTime: { year: 300, month: 11, day: 12, hour: 8, minute: 0 }
};

const block = worldEventsSystem.buildBlock(mockGameData);
assert(block.includes('今日废土历法庆典：重燃节'), '生成的 Prompt 块成功包含重燃节信息');
assert(block.includes('重燃之火'), '生成的 Prompt 块成功包含节日 Buff 说明');

console.log(`\n========================================`);
console.log(`测试结果: ${passed}/${total} 通过`);
console.log(`========================================`);
