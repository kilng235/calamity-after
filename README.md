# 灾厄之后·重制版 - 独立前端项目

> 基于姬侠传/瀚海架构的独立 Web 应用
> 废土西幻 RPG · D20 检定 · 原生 JS 零依赖

---

## 项目概述

**灾厄之后·重制版**是一款基于 D20 检定系统的废土西幻 RPG，以**独立前端**方式运行（浏览器直接打开，无需构建、无需后端）。

> 当前版本：单文件书式 SPA（`index.html`，首页/登记册/游戏/设置/指南五视图）。游戏逻辑层与 AI 叙事层（世界书 → Prompt 编排 → 响应解析 → 命令落盘）均已接线，含多轮对话上下文、任务块结算、骰子池反作弊注入。待真实 LLM 端到端验证。

---

## 技术栈

- **前端框架**：原生 JavaScript（无框架依赖）
- **模块系统**：ES Modules（游戏逻辑层）+ IIFE 挂 window（命令/AI 层）
- **数据存储**：localStorage（存档/配置/对话上下文）
- **构建工具**：无需构建；数据层由 `npm run convert` 从 YAML 再生成

---

## 项目结构

```
灾厄之后-独立版/
├── index.html                    # 唯一入口（书式 SPA：首页/创建/游戏/设置/指南）
├── module/                       # 运行时模块（32 个）
│   │                             # ── 游戏逻辑层（ES Modules）──
│   ├── dice-pool.js              # 骰子系统 v2.0（实时掷骰 + rollDice(数量,面数) 兼容接口）
│   ├── check-system.js           # D20 检定系统
│   ├── combat-system.js          # 战斗系统（回合制）
│   ├── equipment-system.js       # 装备系统（武器/护甲/双持/耐久）
│   ├── creature-system.js        # 生物系统（怪物/战利品）
│   ├── narrative-system.js       # 正文生成（检定/战斗/时间标签）
│   ├── game-state.js             # 游戏状态（含 skills/spells 列表）
│   ├── skill-system.js / spell-system.js / status-system.js
│   ├── quest-system.js / material-system.js / affix-system.js
│   ├── forging-system.js / alchemy-system.js / opening-system.js
│   │                             # ── AI/LLM 层（IIFE 挂 window）──
│   ├── api-service.js            # LLM API（OpenAI 兼容 + Gemini，超时中断，key 走请求头）
│   ├── calamity-data.js          # 世界书数据访问层
│   ├── worldbook-engine.js       # 世界书触发引擎（关键词匹配 + 条目/字符预算上限）
│   ├── prompt-builder.js         # Prompt 编排（含滚动对话历史 + 骰子池实时展开）
│   ├── response-parser.js        # AI 响应解析（<content>/<命令>/<SUMMARY>/任务块）
│   ├── json-repair-helper.js     # JSON 修复
│   ├── command-engine.js         # 状态命令引擎（中文别名/白名单/容器护栏）
│   ├── command-processor.js      # 命令调度（applyCommands + applyQuests）
│   ├── preset-importer.js        # SillyTavern 预设导入 + 宏引擎
│   ├── variable-system.js / variable-utils.js / variable-ui.js
│   ├── storage / embedding 相关已冻结至 legacy/
│   │                             # ── 数据层（npm run convert 生成）──
│   ├── prompt-data-core-calamity.js   # 扁平 117 条（运行时主数据源）
│   ├── prompt-data-npc-calamity.js    # NPC 兜底
│   └── prompt-data-world-calamity.js  # 世界观兜底
│
├── module/legacy/                # 冻结的姬侠传遗留模块（8 个，不参与运行时）
│
├── data-source/                  # 源数据（117 个 YAML/TXT 世界书）
│   ├── 世界书/                   # NPC/世界观/地理/势力/种族/生物/系统/装备/检定/时间线
│   └── tools/convert-yaml-to-js.js  # 数据转换器（扁平格式 + 包装标签剥离）
│
├── docs/                         # 设计文档与报告
├── img/ui/                       # UI 图片资源（羊皮纸/皮革纹理）
├── 测试-*.html                   # 19 个系统测试页面（不入库，本地调试用）
├── CHANGELOG.md / PROJECT-STATUS.md / SUMMARY.md
└── package.json
```

---

## 快速开始

```bash
# 启动本地服务器（推荐，避免浏览器模块加载限制）
python -m http.server 8080
# 访问 http://localhost:8080
```

或直接用浏览器打开 `index.html`。

---

## 当前状态

### ✅ 已完成（游戏逻辑层 + AI 叙事层，已接线）

- **数据转换**：117 个 YAML/TXT → 3 个 JS 数据模块（质量 90/100），转换器输出与运行时格式一致，`npm run convert` 一键再生成
- **骰子系统**：v2.0 实时掷骰；骰子池条目经 `{{roll:dN}}` 宏展开每轮注入 Prompt（反作弊：模型依序取用）
- **D20 检定 / 战斗 / 装备 / 生物 / 正文生成**：完整实现并有真实模块测试页
- **命令引擎 + 处理器**：中文别名归一化、白名单治理、容器整体赋值护栏（`set 好感度 = 10` 之类会被拒绝）
- **多轮对话上下文**：滚动窗口（最近 8 轮）持久化并注入消息链
- **任务块链路**：`[新任务]/[任务完成]/[任务失败]` → `applyQuests` → gameData.quests
- **技能/法术列表**：`push 技能列表` / `push 法术列表` 命令可写
- **书式 SPA**：单页五视图，设置按钮/回车发送均正常路由
- **ST 预设导入**：prompt_order 消息链 + 宏引擎（setvar/random/{{user}} 等）
- **健壮性**：API 请求默认 180s 超时中断；Gemini key 走请求头不进 URL

### ⏳ 待完成

- **真实 LLM 端到端**：配置 API Key 后验证完整链路（世界书 → Prompt → LLM → 解析 → 命令/任务落地）
- **制作系统接入运行时**：锻造/炼金/词缀/法术/开局 5 个系统模块已完成可加载，但 index.html 尚未接入其 UI（测试页仍为内联副本，待改为 import 真模块）

### 🔧 已知问题

1. **equipment 双状态源**：equipment-system 模块级单例与 gameData.equipment 未同步（combat 读单例）
2. **opening-system 未接线**：开局注入通道（registerOpening）无调用方，初始数值与 game-state 冲突
3. **任务三实现并存**：主链路已收敛到 gameData.quests + applyQuests；quest-system.js 的 questManager 仍独立存在
4. **法术总纲 ST 残留**：sheet_spells 数据库表格设计属 SillyTavern 体系，独立版待重写为命令流
5. **数据缺口**：6 个 NPC 缺六维属性（伊莎/塞壬/维克多/莉娜/莫拉/马库斯）
6. **CORS 代理默认启用**：api-service 默认经第三方 Worker 中转（可在设置关闭），自建代理更安全

---

## 数据优化工作流

```bash
# 1. 编辑 data-source/世界书/ 下的 YAML
# 2. 一键再生成（直写 module/，格式与运行时一致）
npm run convert
# 3. 刷新页面验证
```

注意：`prompt-data-core-calamity.js` 为生成文件，勿手改；包装标签（`<Xxx>...</Xxx>`）会在转换时成对剥离。

---

## 许可证

MIT License

---
