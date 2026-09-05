# 灾厄之后·独立版 — 项目分析报告

> **分析日期**：2026-09-05
> **分析范围**：`index.html`（215KB SPA）/ `module/`（33 个运行时模块）/ `data-source/`（117 个 YAML）/ `docs/`（30 份设计文档）
> **方法**：4 路并行 Explore 子代理深度扫描 + 设计文档交叉验证 + 源码定向核验
> **数据基础**：所有结论均标注 `文件:行号`，可追溯

---

## 执行摘要 (TL;DR)

| 维度 | 状态 |
|------|------|
| **数据层** | ✅ 117 条世界书，扁平 13 分类，`npm run convert` 一键再生成 |
| **AI/LLM 协议** | ✅ prompt-builder + worldbook-engine + command-engine 双护栏已稳定 |
| **命令引擎** | ✅ 14 根可写 + 中文别名 + 容器护栏 + 行式命令归一化 |
| **记忆 2.0** | ✅ P0（summary/chronicle）已生效；P1/P2 待落地 |
| **核心阻塞** | ❌ 4 项 — `CalamityStateBridge` 死桥 / equipment 双状态源 / opening-system 未接线 / CORS 代理默认开启 |
| **真实 LLM 测试** | ❌ 未做 — 配置 API Key 即可验证完整链路 |
| **严重风险** | 3 项 / **高风险** 4 项 / **中风险** 16 项 / **低风险** 10 项 |

**一句话**：协议层与数据层已稳，运行层仍有 4 个会立刻影响玩家体验的阻塞项。

---

## 一、项目概览

### 1.1 项目定位

- **名称**：灾厄之后·重制版 — 独立前端游戏（基于姬侠传/瀚海架构）
- **类型**：D20 检定废土西幻 RPG，单文件书式 SPA
- **运行方式**：浏览器直接打开 `index.html`，零构建零后端
- **存储**：localStorage（状态/配置/上下文）+ IndexedDB（记忆正文）

### 1.2 技术栈

| 层 | 技术 |
|----|------|
| **前端框架** | 原生 JavaScript（无 React/Vue） |
| **模块系统** | ES Modules（游戏逻辑层）+ IIFE 挂 window（AI/命令层）双轨 |
| **数据存储** | localStorage + IndexedDB（`calamity-memory`） |
| **构建工具** | 无构建；`npm run convert` 从 YAML 再生成 JS 数据模块 |
| **依赖** | 仅 `js-yaml ^5.4.1`（dev） |

### 1.3 规模数据

| 项 | 数量 |
|----|------|
| **运行时模块** | 32 个（活跃）+ 8 个（legacy 冻结） |
| **世界书源文件** | 117 个 YAML/TXT（10 个顶层目录 → 13 个扁平分类） |
| **生成数据条目** | core 117 / npc 18 / world 99 |
| **测试页** | 19 个（`测试-*.html`，不入库） |
| **工程脚本** | 8 个 `tools-*.js` + 1 个 `tools-serve.py` |
| **设计文档** | 30 份（`docs/` 下，含蓝图 / 设计 / 待办 / 报告） |

---

## 二、架构总览

### 2.1 双层模型

```
┌─────────────────────────────────────────────────────┐
│  index.html 内联脚本（UI 渲染 / 事件 / 编排）       │
│  ── 经典 script（navigate/render）+ type=module     │
└─────────────────────────────────────────────────────┘
                ↓ ESM import        ↑ window.get
┌──────────────────────┐  ┌──────────────────────┐
│  ES Modules 层        │  │  IIFE 层              │
│  （游戏逻辑 + 持久）   │  │  （AI/命令/编排）     │
│  ─ game-state         │  │  ─ prompt-builder    │
│  ─ dice-pool          │  │  ─ worldbook-engine  │
│  ─ equipment-system   │  │  ─ response-parser   │
│  ─ combat-system      │  │  ─ command-engine    │
│  ─ skill/spell/quest  │  │  ─ command-processor │
│  ─ material/affix/    │  │  ─ api-service       │
│    forging/alchemy    │  │  ─ story-engine      │
│  ─ narrative/opening  │  │  ─ memory-*          │
└──────────────────────┘  └──────────────────────┘
         ↑                            ↑
         └──── 桥路 ──────────────────┘
    window.calamityData.register (ESM→IIFE)
    window.gameData getter       (ESM→IIFE)
```

**双层原因**：游戏逻辑层要 ES Module 静态分析友好；AI/命令层需要挂 window 给 index.html 内联脚本用。代价是状态共享走 getter/桥，存在时序竞争与状态漂移风险（见风险 S2）。

### 2.2 模块拓扑与依赖图

**核心枢纽**（被引用最多）：
1. `prompt-builder` — 中心编排器，依赖 `calamityData + worldbookEngine + presetImporter`
2. `calamity-data` — 唯一的数据访问层，3 个 prompt-data 全部汇入此
3. `game-state` — 唯一活跃状态源，30+ 导出 + `window.gameData` getter
4. `command-engine / command-processor` — AI 输出命令的应用双层

**叶子节点**：`dice-pool.js`、`command-engine.js`、`json-repair-helper.js`、`api-service.js`、`embedding-service.js`、`memory-store.js`、`material-system.js`

### 2.3 legacy 冻结模块

| 文件 | 原用途 | 冻结原因 | 当前状态 |
|------|--------|----------|----------|
| `dice-pool-prerolled-backup.js` | 旧版预掷 75 枚骰 | 被外层 `dice-pool.js` 替代 | 完全未加载 |
| `game-events.js` | 事件/战斗/iframe 消息 | index.html 内联替代 | 完全未加载 |
| `game-ui.js` | markdownit 渲染 | index.html 内联替代 | 完全未加载 |
| `game-utils.js` | 环境检测/武学/模糊匹配 | 完全未使用 | 完全未加载 |
| `idb-storage.js` | 旧通用 IDB K/V | 被 `memory-store.js` 领域化 | 完全未加载 |
| `memory-recall.js` | 向量召回引擎 | 仍在被 `story-engine` 引用 | **应迁回 module/** |
| `pipeline.js` | 旧两阶段流水线+SSE | index.html 内联替代 | 完全未加载 |
| `storage-service.js` | 旧 Write-Through | 内联 localStorage 替代 | 完全未加载 |

---

## 三、AI/LLM 叙事链路

### 3.1 链路 9 步（用户输入 → 状态落盘）

```
[Step 1]  index.html:4133-4228   window.sendMessage
            · 前置闸门：_gameBusy 防重入
            · 撤销快照：pushUndoSnapshot 拍 gameData+聊天上下文+叙事页
            · history 取自 fitHistoryBudget(loadChatContext(), gd, message)
            ↓
[Step 2]  index.html:4004-4008   记忆召回
            · window.recallMemoriesForPrompt → storyEngine.buildInjectBlocks
            · 失败/未启用 → 返回空串静默降级
            ↓
[Step 3]  module/prompt-builder.js:303-375   buildMessages
            · worldbook-engine.buildWorldbookBlocks 关键词触发
            · _buildSystem 组装 9 段（状态/任务/世界观/输出/检定/骰池/开局/世界书/行动）
            · 骰子池每轮 _expandDiceMacros 重新掷出 {{roll:dN}}
            · 输出 messages[]：system → ST预设before → history → ... → userContent → ST预设after/prefill
            ↓
[Step 4]  index.html:4171-4173   记忆召回块注入
            · recalledBlock splice 到 messages[1]（紧跟主 system 后）
            ↓
[Step 5]  module/api-service.js:127-161   apiService.sendMessages
            · 调用级 options 覆盖
            · AbortController 超时中断（默认 180s）
            · 路由分发：gemini → _callGemini；其他 → _callOpenAI
            · CORS 代理：corsProxyEnabled 时走 proxy?target=<encoded>
            ↓
[Step 6]  module/response-parser.js:633-689   responseParser.run
            · removeThinkingContent 剥 ANAL/THINK 思考区（循环 + 截断）
            · 命令块：extractXmlBlock('命令')；缺失时 fallback 行式
            · extractMainText 优先 <content>/<MAIN_TEXT>；缺失时取命令/SUMMARY 之前
            · extractSummaries 抽 <SUMMARY>...</SUMMARY>
            · extractQuestBlocks 抽 [新任务]/[任务完成]/[任务失败]
            ↓
[Step 7]  index.html:4195-4206   命令+任务应用
            · commandProcessor.applyCommands(gd, parsed.commands) 深拷贝
            · 拒绝记录：report.rejected 非空时 UI 提示
            · commandProcessor.applyQuests(finalGd, parsed.quests)
            · 命令后校准：HP钳制/属性区间/经验升级/AC下限/好感[-100,100]
            ↓
[Step 8]  module/game-state.js:205-210 + 142-152   落盘
            · gameState.importGameData → mergeWithDefaults → saveGameData
            · STORAGE_KEY='calamity-game-state' 持久化
            · 副作用：refreshGameUI() 重渲染
            ↓
[Step 9]  index.html:4214-4217   多轮上下文与记忆归档
            · appendChatContext → CHAT_CONTEXT_KEY='calamity-chat-context'（≤16 条）
            · saveToHistory → 'calamity-chat-history'（≤50 条原始响应）
            · storeSummariesToMemory → storyEngine.onTurnArchived（异步、失败静默）
```

### 3.2 反作弊机制（骰子池）

- **数据层**：骰子池条目键 `世界书-系统.骰子池`，被 `_isSkippable` 排除出关键词匹配（worldbook-engine.js:30-32）
- **注入层**：`_buildDicePool` 每轮（每次 buildMessages 调用）重新 `_expandDiceMacros` 展开宏（prompt-builder.js:45-49）
- **不可绕过**：宏在 system 段第 6 段渲染（检定规则之后、开局数据之前），模型无法拒绝消费骰值
- **真随机性**：每次发送都是新随机种子，编造难度大

**残留风险**：若 LLM 通过 chat 历史读到旧骰值并复述，仍能蒙对——**真随机性依赖每轮重建 prompt**（详见风险 S19/S20）。

### 3.3 命令引擎护栏

**14 个可写根路径**（command-engine.js:22-26）：
```
character, attributes, backgrounds, fatePoints, hp,
equipment, inventory, currency, progress,
relationships, gameTime, tone, skills, spells
```

**保留域**（明确拒绝）：`['stats', 'meta']`（command-engine.js:29）

**容器型根键整键命中 → 拒绝**（line 174-180）：
- `set 背包 = [...]` ✗ 拒绝
- `set 属性 = {...}` ✗ 拒绝
- `set 关系 = 10` ✗ 拒绝
- `set 时间 = {...}` ✗ 拒绝

**13 个中文动作前缀归一化**（line 512）：`增加/新增/累加/加上/设置/设为/写入/追加/插入/删除/移除/扣减/减少`

---

## 四、数据层与 SPA

### 4.1 数据管道

```
data-source/世界书/**/*.yaml  ──┐
                               │
                       npm run convert
                               ↓
                  data-source/tools/convert-yaml-to-js.js
                  · UTF-8 原文读取
                  · CRLF→LF + 去首尾空行
                  · stripWrapperTags 剥离首开标签 + 末闭标签（不核对同名）
                  · key = 最深目录名/去扩展文件名
                               ↓
                  module/prompt-data-{core,npc,world}-calamity.js
                  直写 module/（非 data-source/module/）
                               ↓
              index.html:3204 <script type="module">
                  import { promptData } from '...'
                  + import equipment/creature/status/quest/skill 五个 ESM
                  + Object.assign({}, worldPrompts, equipmentWorldbook, ...)
                  ↓
              window.calamityData.register(promptData, npcPrompts, mergedWorld)
                               ↓
              prompt-builder → worldbook-engine → keyword match → 注入 prompt
```

### 4.2 13 个扁平分类（117 条）

| 分类 | 数量 | 来源 |
|------|------|------|
| NPC | 18 | `世界书/NPC/` |
| 世界观 | 3 | `世界书/世界观/` |
| 势力 | 5 | `世界书/地理/势力/*`（嵌套二级） |
| 地理 | 5 | `世界书/地理/` |
| 种族 | 9 | `世界书/种族/` |
| 生物 | 33 | `世界书/生物/`（实际 32 具体 + 1 总纲） |
| 装备 | 2 | `世界书/装备/*` 总纲 |
| 武器 | 14 | `世界书/装备/武器/*` |
| 护甲 | 10 | `世界书/装备/护甲/*` |
| 检定 | 6 | `世界书/检定/` |
| 扮演准则 | 1 | `世界书/扮演准则/` |
| 时间线 | 1 | `世界书/时间线/` |
| 系统 | 20 | `世界书/系统/`（含骰子池） |

**worldbook 优先级**（注入顺序）：NPC > 检定 > 地理 > 势力 > 生物 > 种族 > 武器 > 护甲 > 装备（每轮 ≤8 条 / 6000 字符）

### 4.3 数据完整性

**两份报告**：
- `docs/reports/data-quality-report.md`：2026-09-02 / 116 条（**陈旧**）
- `data-source/reports/data-quality-report.md`：2026-09-05 / 117 条（**当前**）

**当前评分**：90/100（0 严重 / 20 警告 / 1 建议）

**20 警告逐项**：NPC 生成规则 2 / 伊莎 1 / 塞壬 1 / 尾铃·三面性 6 / 尾铃·性格调色盘 5 / 维克多 1 / 莉娜 1 / 莫拉 1 / 赛拉斯 1 / 马库斯 1

**6 个缺六维属性 NPC**：伊莎·圣焰、塞壬·渊语、维克多·金牙、莉娜·灰袍、莫拉·血币、马库斯·圣火

### 4.4 SPA 五视图

`VIEWS = ['home', 'create', 'game', 'settings', 'help']`

- **路由**：hashchange + `window.location.hash`；无 History API
- **navigate()**：经典 script（行 2617），仅切换 `#view-*` 的 `.active`
- **回车发送**：input 2089 inline `onkeypress` → `window.sendMessage`
- **openSettings**：模块块 4492 行暴露到 window，实际只调 `navigate('settings')`
- **设置表单/保存函数**：在 2723+ 经典 script，非独立 IIFE
- **静态视图**：手写 HTML；动态多用 `createElement`，列表类用 `innerHTML` 字符串

### 4.5 localStorage 键位清单

| 类别 | 键名 | 用途 | 大小上限 |
|------|------|------|----------|
| **状态** | `calamity-game-state` | 整棵 gameData JSON | — |
| | `calamityOpening` | 开局时间/地点/角色/初始任务/主线钩子 | — |
| | `character` | 仅旧档兼容迁移 | — |
| **API 配置** | `jxz_apiConfig` | API 全字段（含 cors 开关） | — |
| | `jxz_embeddingConfig` | Embedding 配置 | — |
| | `calamity_apiConfigHistory` | API 配置历史 | ≤3 条 |
| **UI/设置** | `settings` | `{display.fontSize, game.autoSave{,Interval}}` | **autosave 无定时器** |
| **多轮上下文** | `calamity-chat-context` | `{role, content}[]` 注入 prompt | ≤16 条 / 8 轮 |
| | `calamity-chat-history` | `{timestamp, user, ai}[]` 调试历史 | ≤50 条 |
| **撤销** | `calamity-undo-stack` | 完整快照 | ≤10 个 |
| **记忆控制** | `calamity-memory-enabled` | 1/0（缺省开） | — |
| | `calamity-memory-vec` | 1/0（缺省关） | — |
| | `calamity-memory-api` | `{endpoint, apiKey, model, type}` | — |
| | `calamity-memory-every/-keep1/-keep2` | 数字字符串（**只读无 UI**） | — |
| | `calamity-memory-floor` / `-pending` | 楼层/重试队列 | — |
| **ST 预设** | `calamity-st-preset` | 规范化预设 JSON | — |
| | `calamity-st-preset-enabled` | 1/0 | — |

**IndexedDB**：`calamity-memory`（4 store：summary / chronicle / story / embeddings），记忆正文不在 LS

### 4.6 记忆 2.0 状态

**结论**：P0 已生效，P1/P2 未实现。

**生效能力**：
- 启动链真实接线：3970 起 `memoryStore.init → vectorStore.init → memoryRecall.init → storyEngine.init`
- 每轮响应后 4217 行 `storeSummariesToMemory` 入库
- 每轮召回 4154 行 `storyEngine.buildInjectBlocks`
- 撤销接入 3934 行
- UI 完备（查看器/清空/重算）

**当前能力**：summary / chronicle 两 store、20 层纪事→5 篇卷宗→3 篇典章三级压缩、词法召回、可选向量召回、撤销集成

**未实现**（蓝图 vs 现状）：
- P1 主观记忆 / 实体台账：未实现
- P2 hash 迁移 / 旧 vecmem 迁移 / 衰减抽样 / 编辑：未实现
- `vector-store` L2 events 接口：no-op
- 副 API 默认跟随主 API（蓝图「全部独立」表述差异）
- Embedding rerank 有 UI 无 reranker 实例，dormant

---

## 五、玩法系统地图

### 5.1 核心循环

```
玩家输入 → LLM 叙事（骰池实时掷骰）→ <命令> 落盘
   ↓                                    ↓
   ←── UI 渲染 ←── gameData 推进 ←── 命令后校准
```

### 5.2 系统清单

| 系统 | 关键能力 | 数字契约 |
|------|----------|----------|
| **养成** | 六维属性（DND 5E 公式）/ 等级 / 熟练加值 / 命运点 / 7 身份开局 / HP×体质 / MP×智力 | 属性调整 = floor((值−10)/2)；PB = 1 + ceil(等级/4) |
| **D20 检定** | 普通 / 对抗 / 优势劣势 / nat20/nat1 / 背景特长 / 命运点重骰 | DC 区间 5/10/15/20/25/30 |
| **战斗** | 回合制 / 先攻（敏捷检定降序）/ 攻击 / 双持 / 防御 / 逃跑 / 战利品 | 暴击 d20×2；副手不加属性 mod；nat1 武器耐久−5 |
| **装备** | 10 槽位 / 12 武器 / 16 护甲 / 31 材料 / 耐久 / 词缀 | AC = 10 + 护甲 + 限敏/全敏 + 盾牌；6 主题 × 3 品质 × 4 强度 |
| **制作** | 锻造（18 武器改装 + 5 护甲改装）/ 炼金（15 配方）/ 材料经济 / NPC 代工 | DC 10/15/20；分级 surplus <0 / 5 / 10 |
| **技能法术** | 5 来源 × 3 等级 / 6 学派 × 3 阶 = 18 法术 / MP×INT5 / 卷轴 | 不持杖施法强制劣势 |
| **任务** | 5 类型 × 4 状态 × 5 难度 / 时限 / 奖励 / 佣兵扣 10% | `updateObjective(idx, bool)` 累计 |
| **状态** | 19 负面 + 6 正面 / 叠层模型 / 元素交互（水熄火 / 寒火互克 / 毒燃 / 速滞互消） | DOT 用期望值近似 |
| **世界** | 18 NPC / 7 身份 / 5 区域 / 5 势力 / 9 种族 / 23+ 生物 / 时间进位 60/24/30/12 | 好感 [-100, 100] |
| **叙事** | LLM 实时生成 / 骰池反作弊 / 记忆三级压缩 / 词法+向量召回 / 8 轮上下文 / 10 撤销快照 | 9 段 system 提示词 |

---

## 六、风险登记册（重点）

### 6.1 🔴 严重（影响核心功能 / 数据完整性）

#### S1. `CalamityStateBridge` 死桥
- **位置**：`module/command-processor.js:8, 360, 382`
- **现象**：代码引用 `window.CalamityStateBridge`，**整个 codebase 没有定义**
- **后果**：落盘 + UI 刷新段失效——命令应用后状态可能不持久、UI 可能不更新
- **修复**：要么在 index.html 定义桥对象，要么直接改 command-processor 调 `gameState.saveGameData()` + `refreshGameUI()`

#### S2. equipment-system 双状态源
- **位置**：`module/equipment-system.js:363-377`（单例）+ `module/game-state.js:56-67`（gameData）
- **现象**：UI `invEquip/invUnequip`（index.html 4406-4463）直接读写 `gameData.equipment`，**完全绕过 equipment-system**；combat 读单例 → 单例空 → 护甲永远失效
- **后果**：玩家穿了护甲，战斗中 AC 仍是 10 + dex（护甲基础值无效）
- **修复**：二选一——(a) 删 equipment-system 单例，全部走 gameData；(b) UI 改用 `equipItem` / `un-equipItem` API 并建立同步桥

#### S3. 未做真实 LLM 端到端测试
- **位置**：全项目
- **现象**：所有协议层（prompt 编排 / 命令解析 / 骰池反作弊 / quest 块落盘 / 记忆归档）**仅做理论链路验证**，未用真实 API Key 跑过完整 sendMessage
- **后果**：任何上游 LLM 输出格式偏差都可能暴露未覆盖的解析漏洞（思考区截断 / 命令未闭合 / JSON 修复降级）
- **修复**：配置 API Key 做端到端测试 + 增加 LLM 响应快照回归

### 6.2 🟠 高（影响玩家体验或安全）

#### S4. CORS 代理默认开启
- **位置**：`module/api-service.js:7-33` 默认配置 + `module/api-service.js:94-100` 代理逻辑
- **现象**：默认走第三方 Worker `https://jxz-cors-proxy.nicholaswuai.workers.dev/?target=...`
- **后果**：**API Key + 对话内容经第三方转发**；Worker 维护者/中间人可读到全部 prompt/响应/Key
- **修复**：默认关闭 CORS 代理；或自建 Worker 并在 README 说明风险

#### S5. opening-system 完全未接线
- **位置**：`module/opening-system.js` + `module/calamity-data.js:106`（`registerOpening` 定义）+ index.html 内联 `createOpeningData` (4647)
- **现象**：7 身份差异化开场全部失效；registerOpening 无调用方；开局数据走 `localStorage['calamityOpening']` 而非 prompt 注入
- **后果**：玩家启动看到的是默认「旅行者」，**没有锚点、没有初始任务、没有 7 身份视角**
- **修复**：在登记册 saveCharacter 完成时调 `openingSystem.initializeGame()` + `calamityData.registerOpening()`

#### S6. combat-system / creature-system 冻结到 legacy
- **位置**：`module/legacy/combat-system.js` + `module/legacy/creature-system.js`
- **现象**：33 个生物 YAML + 全部模板 + 战斗流程代码**全部冻结**；index.html 内联脚本替代
- **后果**：玩家遭遇战斗**没有 encounter 触发、没有真实 HP / 攻击骰 / AC 数值**；战斗叙事全靠 LLM 自觉
- **修复**：把这两个模块迁回 module/，改 ES Module 并接入运行时

#### S7. 记忆系统 P1/P2 未实现
- **位置**：`docs/记忆系统2.0-工程蓝图.md` vs `module/story-engine.js`
- **现象**：蓝图设计 P1 主观记忆/实体台账、P2 hash 迁移/衰减抽样/编辑 全部未实现
- **后果**：长期游玩后**实体关系、玩家意图、故事主题**无法被系统结构化记忆
- **修复**：按蓝图逐步落地；当前 P0（summary/chronicle）已可用

### 6.3 🟡 中（影响功能完整度 / 一致性）

#### S8. status 字段名三套并存
- **位置**：`status-system.js` 写 `target.statuses[]`；`affix-system.js:445-451` 写 `target.statusEffects[]`；`alchemy-system.js:536-542` 写 `character.statusEffects[]`
- **后果**：三条路径互相不可见——词缀触发的状态、炼金药水的状态、status-system 的状态**不在同一数组**
- **修复**：统一字段名；或 status-system 加 `applyStatusToEffects` 兼容入口

#### S9. spell-system 自实现掷骰
- **位置**：`module/spell-system.js:431-439, 638, 687`
- **现象**：完全自实现 `Math.random()` + 自算 PB，不委托 check-system
- **后果**：施法检定**不走骰子池**（破坏反作弊）；与 forging/alchemy 委托路径不一致
- **修复**：改成委托 `performCheck`；或在骰子池单独开 `getD20` 路径

#### S10. quest-system / skill-system 单例无调用
- **位置**：`quest-system.js`（questManager Map）+ `skill-system.js`（skillManager Map）
- **现象**：实现完整但运行时完全不调用；主链路走 gameData.quests + applyQuests
- **后果**：维护负担（两边都要看）；潜在误用风险
- **修复**：直接废弃独立单例；或重构为 gameData 的薄封装

#### S11. 任务名匹配脆弱
- **位置**：`module/command-processor.js:315, 337`
- **现象**：AI 写错任务名（击杀灰狼 vs 击杀毒狼）→ 主链路无法结算，**UI 静默无提示**
- **后果**：玩家以为任务完成，实际进度卡住
- **修复**：模糊匹配 + UI 显示「未匹配」警告

#### S12. 响应解析的脆弱性
- **位置**：`module/response-parser.js:46-58, 637-647, 333-353`
- **现象**：
  - 思考区未闭合时截断到最后一个 ANAL 开始位置
  - 命令块未闭合 fallback 扫行式起始 → 可能吞掉前文
  - JSON 修复第 3 层 `jsonrepair` 返回缺字段对象
  - 算术求值走 `new Function`（白名单较窄但仍是 eval 风险面）
- **修复**：补 fallback 边界测试；考虑用 Function 替代品（如 mathjs 子集）

#### S13. prompt-data 浅覆盖陷阱
- **位置**：index.html:3204 模块块
- **现象**：`Object.assign({}, worldPrompts, equipmentWorldbook, creatureWorldbook, ...)` 是顶层分类浅合并
- **后果**：运行时模板（equipment/creature/status/quest/skill 五个 ESM 动态构建）可覆盖同名分类的生成文件内容
- **修复**：分类名加前缀；或运行时模板改用单独命名空间

#### S14. `npm run report` 命令 bug
- **位置**：`package.json:9` `cat docs/reports/data-quality-report.md`
- **现象**：convert 写 `data-source/reports/`（117 条 / 9-5），cat 指向 `docs/reports/`（116 条 / 9-2）——**永远显示陈旧副本**
- **修复**：改成 `cat data-source/reports/data-quality-report.md`

#### S15. 登记册 DOM ID 不匹配
- **位置**：index.html 1869/1896（实际 `p1/p2`）vs 2617（重置钩子 `create-p1/create-p2`）
- **现象**：重置逻辑找的 ID 不存在
- **后果**：登记册重置不生效
- **修复**：统一 ID 命名

#### S16. 质量检查器逻辑缺陷
- **位置**：`data-source/tools/convert-yaml-to-js.js`
- **现象**：
  - `<500` warning 必先命中，`else if <200` critical 不可达
  - `emptyFields` 永远 0（递增代码缺失）
  - NPC 推荐数组定义了但未使用
  - `checkWorld` 传 baseName 而非路径，势力文件 basename 不含「势力」则不查
- **后果**：90/100 评分**虚高**——NPC 章节缺失、势力完整性等问题不被计入
- **修复**：修正分支顺序；启用 NPC 推荐数组；checkWorld 传完整路径

### 6.4 🟢 低（不影响功能但有改进空间）

#### S17. streamMode 是 UI 假象
- 设置面板保存 `streamMode`，主链路 4178 行硬传 `stream:false`
- 实际游戏不走 `sendMessagesStream`

#### S18. autosave 假开关
- `settings.game.autoSave + autoSaveInterval` 持久化但无定时器触发
- 这是架构优化待办清单 P0 项

#### S19. 容器型别名「泛化子路径」任意拼接
- `command-engine.js:57, 61, 89, 95`：AI 可写 `关系.任意新NPC名.好感度 = X`
- 属设计意图（玩家能跟新 NPC 建关系），但需评估是否需要 NPC 白名单

#### S20. game-state.js default export 快照陷阱
- `game-state.js:651-696` default export 对象
- `initGameData` / `loadGameData` 内的 `gameData = structuredClone(...)` 会让 default 引用陈旧
- 当前 index.html 用 `import * as gameState` 规避，但第三方按 ESM 习惯 `import gameState from` 会踩坑

#### S21. memory-recall.js 引用与位置冲突
- `module/legacy/memory-recall.js` 仍被 `module/story-engine.js` 引用
- 应迁回 module/ 顶层

#### S22. 设置面板无 timeout 输入
- `api-service.js` 支持 `requestTimeoutMs`，但 UI 无控件
- 用户只能手编 localStorage

#### S23. 多标签页 localStorage 覆盖
- 无锁机制；两个 tab 同时操作会互相覆盖

#### S24. tools-serve.py 与 npm serve 端口不一致
- 默认 8090 vs 8080；三套入口（README / package.json / Python）易混

#### S25. 前 4 个 preset 测试脚本硬编码外部 fixture
- `tools-analyze-preset.js` 等 4 个脚本不可移植

#### S26. calamity-data.js 注释陈旧
- 头部注释写 116 条，实际 core 已 117

---

## 七、修复路线图

### P0（核心阻塞 — 立即做）

1. 修 `CalamityStateBridge` 死桥（command-processor 落盘失效）
2. 修 equipment 双状态源（护甲失效）
3. 做一次真实 LLM 端到端测试

### P1（玩家可见 — 下个迭代）

4. 把 opening-system 接线（7 身份开局生效）
5. 把 combat-system / creature-system 迁回 module/ 并接入运行时
6. CORS 代理默认关闭

### P2（质量治理 — 中期）

7. 统一 status 字段名
8. spell-system 委托 check-system
9. 修 `npm run report` cat 路径
10. 修登记册 ID 不匹配
11. 推进记忆 P1/P2

### P3（清理 — 长期）

12. 废弃 quest-system / skill-system / narrative-system gameTime 单例
13. 质量检查器分支修正 + 启用 NPC 推荐数组
14. 清理 legacy/（保留 memory-recall.js 迁回）
15. 增加 LLM 响应快照回归测试

---

## 八、附录

### 8.1 模块清单（活跃）

| 模块 | 类型 | 行数 | 状态 |
|------|------|------|------|
| game-state.js | ESM | 705 | ✅ 主链路真相 |
| dice-pool.js | ESM | 405 | ✅ 活跃底层（7 个模块引用） |
| check-system.js | ESM | 471 | ⚠️ 实现完整未调用 |
| combat-system.js | ESM | 535 | ⚠️ 实现完整未调用 |
| narrative-system.js | ESM | 477 | ⚠️ 实现完整未调用 |
| equipment-system.js | ESM | 950 | ⚠️ 单例空转 |
| creature-system.js | — | — | ❌ 冻结到 legacy |
| status-system.js | ESM | 542 | ⚠️ 实现完整未调用 |
| quest-system.js | ESM | 423 | ⚠️ 单例无调用 |
| skill-system.js | ESM | 279 | ⚠️ 单例无调用 |
| spell-system.js | ESM | 704 | ⚠️ 单例无调用 |
| alchemy-system.js | ESM | 604 | ⚠️ 单例无调用 |
| forging-system.js | ESM | 617 | ⚠️ 单例无调用 |
| material-system.js | ESM | 631 | ⚠️ 数据完整未调用 |
| affix-system.js | ESM | 538 | ⚠️ 数据完整未调用 |
| opening-system.js | ESM | 390 | ❌ 完全未接线 |
| identity-system.js | ESM | — | ✅ 新增（身份注入） |
| prompt-data-{core,npc,world}-calamity.js | ESM | 生成 | ✅ 自动生成 |
| api-service.js | IIFE | 647 | ✅ 活跃枢纽 |
| prompt-builder.js | IIFE | 420 | ✅ 核心枢纽 |
| worldbook-engine.js | IIFE | 195 | ✅ 核心枢纽 |
| response-parser.js | IIFE | 705 | ✅ 核心枢纽 |
| command-engine.js | IIFE | 348 | ✅ 核心枢纽 |
| command-processor.js | IIFE | 415 | ✅ 核心枢纽（含死桥） |
| preset-importer.js | IIFE | 480 | ✅ ST 预设导入 |
| story-engine.js | IIFE | 424 | ✅ 记忆 2.0 P0 |
| memory-store.js / memory-api.js / embedding-service.js / vector-store.js | IIFE | — | ✅ 记忆配套 |
| calamity-data.js | IIFE | 139 | ✅ 数据访问层 |
| json-repair-helper.js | IIFE | 89 | ✅ JSON 修复 |
| variable-{system,utils,ui}.js | IIFE | — | ⚠️ 实现完整未充分调用 |

### 8.2 工程脚本

| 脚本 | 用途 | 备注 |
|------|------|------|
| `tools-analyze-preset.js` | 统计 polarday JSON | 硬编码外部 fixture |
| `tools-scan-preset-macros.js` | 嵌套宏扫描 | 硬编码外部 fixture |
| `tools-check-enabled-conflict.js` | 冲突检测 | 硬编码外部 fixture |
| `tools-test-preset-engine.js` | 预设宏引擎回归 | — |
| `tools-test-preset-e2e.js` | 预设端到端 | — |
| `tools-test-narrative-render.js` | 叙事渲染回归 | — |
| `tools-test-quest-block.js` | 任务块解析 | — |
| `tools-test-story-engine.js` | 故事引擎回归 | — |
| `tools-serve.py` | 静态服务器（默认 8090） | 与 `npm serve` 端口不同 |
| `tools/convert-yaml-to-js.js` | YAML→JS 转换器（npm run convert） | — |

### 8.3 数据契约（顶层）

```
defaultGameData = {
  character:    { name, race, gender, age, level, exp, expToNextLevel,
                  proficiencyBonus, ac }
  attributes:   { 力量, 敏捷, 体质, 感知, 智力, 魅力 }（钳制 1-30）
  backgrounds:  []
  fatePoints:   { current, max, lastRefreshDate }
  hp:           { current, max }
  equipment:    { mainHand, offHand, body, head, hands, legs, feet,
                  shoulders, accessory1, accessory2 }
  inventory:    []
  skills:       []
  spells:       []
  currency:     { gold }
  progress:     { currentLocation, currentPlace, completedQuests,
                  unlockedLocations, backstory }
  quests:       { active, completed, failed }
  relationships:{}
  gameTime:     { year, month, day, hour, minute, season }
  stats:        { totalChecks, successfulChecks, criticalSuccesses,
                  criticalFailures, combatsWon, deaths }
  meta:         { version, createdAt, lastSavedAt, playTime }
}
```

---

## 附：本报告关联文档

- `README.md` — 项目说明（最近更新 2026-09-04）
- `SUMMARY.md` — 2026-09-04 P0 修复摘要
- `PROJECT-STATUS.md` — 项目状态（P0 完成，待真实 LLM 测试）
- `CHANGELOG.md` — 装备系统更新日志（v1.1.0 双持）
- `docs/架构优化待办清单.md` — 姬侠传借鉴待办
- `docs/记忆系统2.0-工程蓝图.md` — 记忆系统 P0/P1/P2 蓝图
- `docs/CHECK-SYSTEM-DESIGN.md` — D20 检定设计
- `docs/DICE-POOL-COMPLETE.md` — 骰子池（旧版文档，v2.0 实时掷骰）
- `docs/UI界面系统设计.md` — UI 设计
- `docs/reports/data-quality-report.md` — 数据质量（陈旧 116）
- `data-source/reports/data-quality-report.md` — 数据质量（当前 117）

---

**报告生成**：2026-09-05
**下次复核建议**：完成 P0 修复后