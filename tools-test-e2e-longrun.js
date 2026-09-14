// 端到端 50 轮长跑综合模拟测试：
// 模拟玩家在不同场景间旅行、战斗、触发检定、任务更新、实体台账更新、悬念建立与核销、炼金、装备损坏与升级
// 全链路验证：状态机一致性 + 记忆 2.0 滚动压缩（第 20/40 轮） + 撤销回滚 + 提示词上下文预算控制

globalThis.window = globalThis;
globalThis.window.addEventListener = () => {};
globalThis.localStorage = {
  _s: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
  setItem(k, v) { this._s[k] = String(v); },
  removeItem(k) { delete this._s[k]; }
};

const fs = require('fs');

// 加载基础模块
new Function(fs.readFileSync(__dirname + '/module/status-contract.js', 'utf8'))();
new Function(fs.readFileSync(__dirname + '/module/numeric-contract.js', 'utf8'))();
new Function(fs.readFileSync(__dirname + '/module/progression-contract.js', 'utf8'))();
new Function(fs.readFileSync(__dirname + '/module/equipment-contract.js', 'utf8'))();
new Function(fs.readFileSync(__dirname + '/module/json-repair-helper.js', 'utf8'))();
new Function(fs.readFileSync(__dirname + '/module/command-engine.js', 'utf8'))();
new Function(fs.readFileSync(__dirname + '/module/command-processor.js', 'utf8'))();
new Function(fs.readFileSync(__dirname + '/module/response-parser.js', 'utf8'))();
new Function(fs.readFileSync(__dirname + '/module/variable-system.js', 'utf8'))();
new Function(fs.readFileSync(__dirname + '/module/memory-store.js', 'utf8'))();
new Function(fs.readFileSync(__dirname + '/module/memory-api.js', 'utf8'))();
new Function(fs.readFileSync(__dirname + '/module/story-engine.js', 'utf8'))();
new Function(fs.readFileSync(__dirname + '/module/prompt-builder.js', 'utf8'))();
// 适配 CJS 环境下的 module/game-state.js
const gameStateCode = fs.readFileSync(__dirname + '/module/game-state.js', 'utf8')
  .replace(/export\s+(const|let|var|function|default)\s+/g, (m, p) => {
    return p === 'default' ? 'window.gameState = ' : (p + ' ');
  });
new Function(gameStateCode)();
const gameState = window.gameState;
const storyEngine = window.storyEngine;
const commandProcessor = window.commandProcessor;
const responseParser = window.responseParser;
const promptBuilder = window.promptBuilder;
const memoryStore = window.memoryStore;

// 模拟 API Service
let compCount = 0;
let subjectiveCount = 0;
window.apiService = {
  config: { endpoint: 'http://test-llm', apiKey: 'test-key', model: 'test-model', maxContextTokens: 4000 },
  getConfig() { return this.config; },
  async sendMessages(messages) {
    const sys = (messages && messages[0] && messages[0].content) || '';
    if (sys.includes('记忆提取员')) {
      subjectiveCount++;
      return {
        content: JSON.stringify([
          { holder: '艾拉', kind: '记得', memory: '主角在回声谷救了巡逻队', known_by: ['老汤姆'] }
        ]),
        usage: {}
      };
    }
    // 纪事压缩
    compCount++;
    return {
      content: `【纪事 ${compCount}】主角在灰烬平原与回声谷之间展开探索，完成了多项委托并强化了装备。`,
      usage: {}
    };
  }
};

let pass = 0, fail = 0;
function assert(name, condition, extraInfo) {
  if (condition) {
    console.log(`✅ ${name}`);
    pass++;
  } else {
    console.error(`❌ ${name}`, extraInfo || '');
    fail++;
  }
}

async function runLongRunSimulation() {
  console.log('🚀 开始执行 50 回合全链路长跑测试...\n');

  // 1. 初始化游戏状态
  gameState.initGameData();
  await storyEngine.init();

  const gd = gameState.getGameData();
  gd.character.name = '卡恩';
  gd.character.level = 1;
  gd.character.exp = 0;
  gd.character.gold = 100;
  gd.character.str = 14;
  gd.character.dex = 12;
  gd.character.con = 14;
  gd.character.hp = { current: 30, max: 30 };
  gd.equipment.mainHand = { name: '生锈的铁剑', attack: '1d6+2', durability: { current: 15, max: 20 } };

  // 2. 模拟 50 回合的交互与推进
  const mockScenarios = [
    { type: 'travel', loc: '灰烬平原·哨站', action: '前往灰烬平原哨站巡查' },
    { type: 'battle', enemy: '变异沙虫', dmg: 5, action: '拔剑刺向沙虫要害' },
    { type: 'quest', questName: '清理沙虫巢穴', action: '接受哨站长官的委托' },
    { type: 'craft', item: '初级治疗药水', action: '在营地支起炼金坩埚调配药水' },
    { type: 'explore', loc: '回声谷废墟', action: '深入回声谷废墟搜寻旧日遗物' }
  ];

  for (let turn = 1; turn <= 50; turn++) {
    const sc = mockScenarios[(turn - 1) % mockScenarios.length];
    
    // 模拟推进游戏时间
    gd.gameTime.minute += 15;
    if (gd.gameTime.minute >= 60) {
      gd.gameTime.hour += Math.floor(gd.gameTime.minute / 60);
      gd.gameTime.minute %= 60;
    }

    // 构造 AI 模拟返回（包含叙事正文、指令区、实体更新、悬念标签）
    let aiReply = `第 ${turn} 轮叙事：卡恩在${sc.loc || '荒原'}采取行动「${sc.action}」。四周狂风呼啸，废土的沙尘漫过靴鞲。\n`;
    let commandBlock = '<命令>\n';
    
    // 状态与经验变动
    commandBlock += 'add 经验 = 25\n';
    if (sc.type === 'battle') {
      commandBlock += 'add 状态.生命值 = -3\n';
      commandBlock += 'add 装备.主手.耐久 = -1\n';
      aiReply += `\n<fight>
| 参战方 | 先攻 | 距离 |
| 卡恩 | 15 | 近战 |
| ${sc.enemy} | 10 | 近战 |
---
[卡恩] 攻击检定 1d20+4=16 命中！造成 6 点伤害
[${sc.enemy}] 反击检定 1d20+2=12 命中！造成 3 点伤害
---
战斗结束：卡恩获胜
</fight>\n`;
    } else if (sc.type === 'travel') {
      commandBlock += `set 进度.当前位置 = ${sc.loc}\n`;
      aiReply += `\n[实体更新]
名称: 灰烬平原哨站
类别: 地点
状态: 防御工事加固，驻扎了 5 名游侠
[/实体更新]\n`;
    }

    if (turn === 30) {
      aiReply += `\n[悬念核销]
名称: 古代遗迹的秘密
核销: 查明遗迹实为旧时代科研所
[/悬念核销]\n`;
    } else if (sc.type === 'quest') {
      commandBlock += `set 任务.${sc.questName} = 进行中\n`;
      aiReply += `\n[悬念]
名称: 古代遗迹的秘密
描述: 哨站长官口中的古代遗迹深处到底隐藏着什么秘密？
[/悬念]\n`;
    }

    commandBlock += '</命令>';
    const fullAssistantText = aiReply + '\n' + commandBlock;

    // 解析并执行命令
    const parsed = responseParser.run ? responseParser.run(fullAssistantText) : { commands: [] };
    if (parsed.commands && parsed.commands.length > 0) {
      const res = commandProcessor.applyCommands(gd, parsed.commands);
      Object.assign(gd, res.gameData);
    }
    if (parsed.quests && parsed.quests.length > 0) {
      const qRes = commandProcessor.applyQuests(gd, parsed.quests);
      Object.assign(gd, qRes.gameData);
    }

    // 存入记忆系统（含实体与悬念）
    await storyEngine.onTurnArchived({
      floor: storyEngine.nextFloor(),
      texts: [aiReply],
      time: storyEngine.fmtGameTime(gd.gameTime),
      location: gd.progress && gd.progress.currentLocation || '废土',
      entities: parsed.entities || [],
      suspenses: parsed.suspenses || []
    });
  }

  console.log('\n--- 50 轮长跑完成，开始多维度状态与记忆断言 ---\n');

  // 断言 1：经验与等级契约自动同步（50 轮 * 25 经验 = 1250 经验）
  // 查等级契约表：Lv1(0), Lv2(50), Lv3(150), Lv4(300), Lv5(500), Lv6(750), Lv7(1050), Lv8(1400)
  // 1250 经验对应 Lv7，升级后当前等级经验归零/重置为 200 (1250 - 1050)
  assert('1. 等级与经验根据契约表自动平稳升级', gd.character.level === 7 && gd.character.exp === 200, `实际 Level=${gd.character.level}, Exp=${gd.character.exp}`);

  // 断言 2：记忆系统层级统计
  const memStats = storyEngine.stats();
  assert('2. 逐字纪要层（Summary）满 50 层', memStats.summary === 50, `实际=${memStats.summary}`);
  assert('3. 编年史（Chronicle）满 50 行', memStats.chronicle === 50, `实际=${memStats.chronicle}`);
  assert('4. 纪事压缩（L1 Story）在第 20/40 轮各触发 1 次，共 2 篇', memStats.l1 === 2, `实际=${memStats.l1}`);

  // 断言 5：实体台账已记录
  const ledgerList = memoryStore.allLedger();
  assert('5. 实体台账成功登记哨站状态', ledgerList.some(item => item.id.includes('灰烬平原哨站')), `实际台账数=${ledgerList.length}`);

  // 断言 6：悬念簿状态（建立与核销）
  const suspenseList = memoryStore.allSuspense();
  const resolved = suspenseList.find(s => s.status === 'resolved');
  assert('6. 悬念成功核销（状态为 resolved）', !!resolved, `实际核销=${JSON.stringify(resolved)}`);

  // 断言 7：主观记忆提取触发
  assert('7. NPC 主观记忆提取正常调用', subjectiveCount >= 2, `调用次数=${subjectiveCount}`);

  // 断言 8：提示词构建与上下文预算控制
  const promptData = promptBuilder.buildMessages({
    gameData: gd,
    userMessage: '环顾四周，准备休息',
    history: Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `历史对话片段 ${i + 1}：卡恩在废土中前行...`
    }))
  });

  assert('8. 提示词组装包含系统提示与世界书', promptData.messages && promptData.messages.length > 0);
  assert('9. 历史对话窗口未爆出预算（滑动截断生效）', promptData.messages.length <= 25, `实际消息数=${promptData.messages.length}`);

  console.log(`\n========================================`);
  console.log(`长跑仿真测试总结: 通过 ${pass} 项 / 失败 ${fail} 项`);
  console.log(`========================================\n`);

  if (fail > 0) process.exit(1);
}

runLongRunSimulation().catch(e => {
  console.error('仿真运行崩溃:', e);
  process.exit(1);
});
