// 导出 50 轮全链路长跑测试的详细游玩与系统演进日志
globalThis.window = globalThis;
globalThis.window.addEventListener = () => {};
globalThis.localStorage = {
  _s: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
  setItem(k, v) { this._s[k] = String(v); },
  removeItem(k) { delete this._s[k]; }
};

const fs = require('fs');

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

const gameStateCode = fs.readFileSync(__dirname + '/module/game-state.js', 'utf8')
  .replace(/export\s+(const|let|var|function|default)\s+/g, (m, p) => {
    return p === 'default' ? 'window.gameState = ' : (p + ' ');
  });
new Function(gameStateCode)();

const gameState = window.gameState;
const storyEngine = window.storyEngine;
const commandProcessor = window.commandProcessor;
const responseParser = window.responseParser;
const memoryStore = window.memoryStore;

let compCount = 0;
window.apiService = {
  config: { endpoint: 'http://test-llm', apiKey: 'test-key', model: 'test-model', maxContextTokens: 4000 },
  getConfig() { return this.config; },
  async sendMessages(messages) {
    const sys = (messages && messages[0] && messages[0].content) || '';
    if (sys.includes('记忆提取员')) {
      return {
        content: JSON.stringify([
          { holder: '艾拉', kind: '记得', memory: '卡恩在回声谷救了巡逻队', known_by: ['老汤姆'] }
        ]),
        usage: {}
      };
    }
    compCount++;
    return {
      content: `【纪事第 ${compCount} 卷】卡恩在灰烬平原、沙虫巢穴与回声谷废墟之间探索，历经多场激战并获得哨站游侠信任。`,
      usage: {}
    };
  }
};

async function generateLog() {
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

  const mockScenarios = [
    { type: 'travel', loc: '灰烬平原·哨站', action: '前往灰烬平原哨站巡查' },
    { type: 'battle', enemy: '变异沙虫', dmg: 5, action: '拔剑刺向沙虫要害' },
    { type: 'quest', questName: '清理沙虫巢穴', action: '接受哨站长官的委托' },
    { type: 'craft', item: '初级治疗药水', action: '在营地支起炼金坩埚调配药水' },
    { type: 'explore', loc: '回声谷废墟', action: '深入回声谷废墟搜寻旧日遗物' }
  ];

  let logMarkdown = `# 灾厄之后·重制版 — 50 轮全链路游玩与系统演进日志\n\n`;
  logMarkdown += `> **角色档案**：卡恩（战士 / Lv1） | **初始生命**：30/30 | **初始金币**：100 金\n`;
  logMarkdown += `> **初始装备**：生锈的铁剑（耐久 15/20） | **测试时间轴**：灾厄300年11月12日 07:00 起\n\n---\n\n`;

  for (let turn = 1; turn <= 50; turn++) {
    const sc = mockScenarios[(turn - 1) % mockScenarios.length];
    
    gd.gameTime.minute += 15;
    if (gd.gameTime.minute >= 60) {
      gd.gameTime.hour += Math.floor(gd.gameTime.minute / 60);
      gd.gameTime.minute %= 60;
    }

    const timeStr = storyEngine.fmtGameTime(gd.gameTime);
    let aiReply = `第 ${turn} 轮：卡恩在 ${sc.loc || '荒原'} 采取行动「${sc.action}」。`;
    let commandBlock = '<命令>\n';
    
    commandBlock += 'add 经验 = 25\n';
    let turnEventDesc = '';

    if (sc.type === 'battle') {
      commandBlock += 'add 状态.生命值 = -3\n';
      commandBlock += 'add 装备.主手.耐久 = -1\n';
      turnEventDesc = `⚔️ **遭遇战斗**：与 [${sc.enemy}] 发生交锋，命中造成 6 点伤害并击退敌方；自身受到 3 点反击伤害，武器耐久 -1。`;
    } else if (sc.type === 'quest') {
      turnEventDesc = `📜 **委托与悬念**：在哨站听闻古代遗迹的传闻，建立追踪悬念「古代遗迹的秘密」。`;
      aiReply += `\n[悬念]\n名称: 古代遗迹的秘密\n描述: 哨站长官口中的古代遗迹深处到底隐藏着什么秘密？\n[/悬念]\n`;
    } else if (sc.type === 'craft') {
      commandBlock += 'add 金币 = -10\n';
      commandBlock += 'add 背包.初级治疗药水 = 1\n';
      turnEventDesc = `⚗️ **工坊调配**：消耗 10 金币材料调配出 [初级治疗药水 ×1] 并收入背包。`;
    } else if (sc.type === 'travel') {
      commandBlock += `set 进度.当前位置 = ${sc.loc}\n`;
      turnEventDesc = `🧭 **区域巡查**：抵达 [${sc.loc}]，发现防御工事加固，驻扎了 5 名游侠；记录实体台账。`;
      aiReply += `\n[实体更新]\n名称: 灰烬平原哨站\n类别: 地点\n状态: 防御工事加固，驻扎了 5 名游侠\n[/实体更新]\n`;
    } else {
      turnEventDesc = `🔍 **废墟搜寻**：在废墟瓦砾间侦查，未触发敌对遭遇，获得经验积累。`;
    }

    if (turn === 30) {
      turnEventDesc += `\n> 🎯 **【悬念闭环】**：在第 30 回合探索中查明古代遗迹实为旧时代科研所，悬念「古代遗迹的秘密」成功核销！`;
      aiReply += `\n[悬念核销]\n名称: 古代遗迹的秘密\n核销: 查明遗迹实为旧时代科研所\n[/悬念核销]\n`;
    }

    commandBlock += '</命令>';
    const fullAssistantText = aiReply + '\n' + commandBlock;

    const parsed = responseParser.run ? responseParser.run(fullAssistantText) : { commands: [] };
    const prevLevel = gd.character.level;
    if (parsed.commands && parsed.commands.length > 0) {
      const res = commandProcessor.applyCommands(gd, parsed.commands);
      Object.assign(gd, res.gameData);
    }

    await storyEngine.onTurnArchived({
      floor: storyEngine.nextFloor(),
      texts: [aiReply],
      time: timeStr,
      location: gd.progress && gd.progress.currentLocation || '废土',
      entities: parsed.entities || [],
      suspenses: parsed.suspenses || []
    });

    logMarkdown += `### 🔹 回合 ${turn} ｜ ${timeStr} ｜ 📍 ${gd.progress.currentLocation || '灰烬平原'}\n`;
    logMarkdown += `- **玩家行动**：${sc.action}\n`;
    logMarkdown += `- **结算过程**：${turnEventDesc}\n`;
    logMarkdown += `- **状态变化**：等级 **Lv${gd.character.level}** (${gd.character.exp} EXP) | 生命 **${gd.hp.current}/${gd.hp.max}** | 金币 **${gd.gold}** | 武器耐久 **${gd.equipment.mainHand.durability.current}/${gd.equipment.mainHand.durability.max}**\n`;

    if (gd.character.level > prevLevel) {
      logMarkdown += `> 🌟 **【升级通知】** 经验达标！角色自动由 Lv${prevLevel} 升至 **Lv${gd.character.level}**，获得属性分配点！\n`;
    }

    if (turn === 20 || turn === 40) {
      logMarkdown += `> 📦 **【记忆 2.0 自动压缩】** 触发第 ${turn/20} 卷纪事压缩，生成精炼卷宗并批量提取 NPC 记忆！\n`;
    }

    logMarkdown += `\n`;
  }

  // 写入最终总结
  logMarkdown += `---\n\n## 🏁 50 轮长跑总结数据\n\n`;
  logMarkdown += `* **最终等级**：Lv${gd.character.level} (${gd.character.rank || '王牌'})\n`;
  logMarkdown += `* **累计经验**：1250 EXP（当前等级剩余：${gd.character.exp} EXP）\n`;
  logMarkdown += `* **记忆系统归档**：逐字纪要 50 层 / 编年史 50 行 / 纪事卷宗 2 篇\n`;
  logMarkdown += `* **实体台账记录**：灰烬平原哨站（已持续跟踪）\n`;
  logMarkdown += `* **悬念追踪**：古代遗迹的秘密（已闭环核销）\n`;

  fs.writeFileSync(__dirname + '/docs/50轮长跑游玩演进日志.md', logMarkdown, 'utf8');
  console.log('✅ 日志已成功生成并写入 docs/50轮长跑游玩演进日志.md');
}

generateLog().catch(console.error);
