/**
 * tools-test-opening-random.js - 验证身份系统与动态开局随机引擎
 */
import { openingSystem, IDENTITY_QUESTS, SCENARIO_SEEDS, WEATHER_SEEDS, RANDOM_TRINKETS } from './module/opening-system.js';
import identitySystem from './module/identity-system.js';

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

console.log('=== 测试 1: 7 大身份注册与专属信物/优势 ===');
const identities = identitySystem.listAll();
assert(identities.length === 7, `应存在 7 大身份，实际：${identities.length}`);
assert(identities.includes('自由人'), '身份列表必须包含「自由人」');
assert(identities.includes('遗迹猎手'), '身份列表必须包含「遗迹猎手」');
assert(identities.includes('圣火祭司'), '身份列表必须包含「圣火祭司」');

const freeman = identitySystem.activate('自由人');
assert(freeman.faction === '无阵营羁绊', '自由人所属阵营正确');
assert(freeman.item.name === '磨损的旅行行囊', '自由人专属信物正确');

console.log('\n=== 测试 2: 开局随机种子引擎多轮抽取 ===');
assert(SCENARIO_SEEDS.length === 4, '应有 4 种开局突发情境种子');
assert(WEATHER_SEEDS.length === 4, '应有 4 种天气/时间种子');
assert(RANDOM_TRINKETS.length >= 5, '应有至少 5 种开局随身彩蛋杂物');

const scenarios = new Set();
const weathers = new Set();
for (let i = 0; i < 30; i++) {
  const sc = openingSystem.rollScenario();
  const wt = openingSystem.rollWeather();
  scenarios.add(sc.name);
  weathers.add(wt.weather);
}
assert(scenarios.size > 1, `随机情境多样性验证通过（抽取到 ${scenarios.size} 种不同情境）`);
assert(weathers.size > 1, `随机天气多样性验证通过（抽取到 ${weathers.size} 种不同天气）`);

console.log('\n=== 测试 3: 角色建档与动态初始化全链路 ===');
const initResult = openingSystem.initializeGame({
  name: '测试者',
  race: '人类',
  identity: '遗迹猎手',
  attributes: { 力量: 12, 敏捷: 14, 体质: 10, 智力: 12, 感知: 10, 魅力: 10 }
});

assert(initResult.success === true, '开局初始化成功');
assert(initResult.character.identity === '遗迹猎手', '角色身份装配正确');
assert(initResult.quest.name === '失落避难所的讯号', '遗迹猎手专属主线匹配正确');
assert(initResult.character.weather !== undefined, '角色状态包含随机天气');
assert(initResult.character.inventory.length >= 1, '背包成功注入身份信物与彩蛋道具');
assert(initResult.narrative.includes('失落避难所的讯号'), '开局叙事动态融入专属任务');

console.log(`\n========================================`);
console.log(`测试结果: ${passed}/${total} 通过`);
console.log(`========================================`);
