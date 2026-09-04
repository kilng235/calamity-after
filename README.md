# 灾厄之后·重制版 - 独立前端项目

> 基于姬侠传/瀚海架构的独立 Web 应用  
> 废土西幻 RPG · D20 检定 · 原生 JS 零依赖

---

## 项目概述

**灾厄之后·重制版**是一款基于 D20 检定系统的废土西幻 RPG 游戏，采用姬侠传的模块化架构，以**独立前端**方式运行（浏览器直接打开，无需构建、无需后端）。

> 当前版本为「独立版」：核心游戏逻辑（检定/战斗/装备/生物/正文生成/命令引擎）与 AI 叙事层（世界书数据 → Prompt 编排）均已接线，待真实 LLM 端到端测试，详见「当前状态」。

---

## 技术栈

- **前端框架**：原生 JavaScript（无依赖）
- **模块系统**：ES6 Modules + IIFE 混合
- **数据存储**：IndexedDB + localStorage
- **样式**：CSS3（废土羊皮纸/皮革主题）
- **构建工具**：无需构建，直接运行

---

## 项目结构

```
灾厄之后-独立版/
├── index.html                    # 主游戏页面（书式 SPA：首页/创建/游戏/设置/指南）
├── game.html                     # 独立游戏页面
├── register.html                 # 开场登记（角色创建）
├── settings.html                 # 设置页面
├── start-screen.html             # 开场白页面
│
├── module/                       # 核心模块（27 个 JS 文件）
│   │                             # ── 游戏逻辑层（已接线）──
│   ├── dice-pool.js              # 骰子系统 v2.0（实时掷骰）
│   ├── check-system.js           # D20 检定系统
│   ├── combat-system.js          # 战斗系统（回合制）
│   ├── equipment-system.js       # 装备系统（武器/护甲/双持/耐久）
│   ├── creature-system.js        # 生物系统（怪物/战利品）
│   ├── narrative-system.js       # 正文生成（检定/战斗/时间标签）
│   ├── game-state.js             # 游戏状态管理
│   ├── command-engine.js         # 状态命令引擎（中文别名/白名单）
│   ├── command-processor.js      # 命令调度处理器
│   ├── game-ui.js                # UI 更新渲染
│   ├── game-utils.js             # 通用工具函数
│   ├── variable-system.js        # 变量系统
│   │                             # ── AI/LLM 层（已接线）──
│   ├── api-service.js            # LLM API 接口
│   ├── calamity-data.js          # 世界书数据访问层（统一访问 3 个数据模块）
│   ├── prompt-builder.js         # Prompt 编排（灾厄世界观版）
│   ├── response-parser.js        # AI 响应解析
│   ├── worldbook-engine.js       # 世界书引擎（关键词触发注入）
│   ├── pipeline.js               # 消息处理流水线
│   ├── memory-recall.js          # 记忆召回
│   ├── embedding-service.js      # 向量化服务
│   ├── storage-service.js        # 存档服务
│   ├── idb-storage.js            # IndexedDB 封装
│   ├── json-repair-helper.js     # JSON 修复工具
│   │                             # ── 数据层（从 YAML 生成）──
│   ├── prompt-data-core-calamity.js   # 系统规则（116 YAML 转换）
│   ├── prompt-data-npc-calamity.js    # NPC 人设
│   ├── prompt-data-world-calamity.js  # 世界观
│   └── dice-pool-prerolled-backup.js  # 骰子池 v1 预掷版备份
│
├── data-source/                  # 源数据（YAML 世界书，116 个）
│   ├── 世界书/                   # NPC/世界观/地理/种族/生物/系统/装备
│   └── tools/                    # 数据转换工具
│       └── convert-yaml-to-js.js
│
├── docs/                         # 设计文档与报告
│   ├── 开发进度清单.md           # 开发进度清单（当前状态）
│   ├── CURRENT-TASK.md           # 当前任务
│   ├── UI界面系统设计.md          # UI 设计
│   ├── 战斗系统设计.md            # 战斗系统设计
│   ├── 生物系统设计.md            # 生物系统设计
│   ├── 装备系统设计.md            # 装备系统设计
│   ├── 正文生成系统设计.md        # 正文生成设计
│   ├── CHECK-SYSTEM-DESIGN.md    # 检定系统设计
│   ├── DICE-POOL-DESIGN.md       # 骰子池设计
│   └── reports/                  # 历史报告（数据质量/转换）
│
├── img/ui/                       # UI 图片资源（羊皮纸/皮革纹理）
│
├── 测试-*.html                   # 8 个系统测试页面
├── CHANGELOG.md                  # 更新日志
├── PROJECT-STATUS.md             # 项目状态（当前）
├── SUMMARY.md                    # 项目摘要（当前）
└── package.json                  # 项目配置
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

- **数据转换**：116 个 YAML → 3 个 JS 数据模块（质量 90/100）
- **骰子系统**：v2.0 实时掷骰（D20 + 骰子池）
- **D20 检定系统**：属性检定 + DC 判定 + 优势/劣势
- **战斗系统**：回合制 + 命中/伤害/重击
- **装备系统**：武器/护甲/双持/耐久度
- **生物系统**：怪物数据 + 战利品
- **正文生成系统**：检定/战斗/时间标签渲染
- **命令引擎 + 命令处理器**：AI 状态命令安全应用（中文别名归一化、白名单治理）
- **游戏状态管理**：属性/背包/关系/任务
- **UI**：书式 SPA（首页/创建/游戏/设置/指南）+ 独立页面
- **AI 数据层接线**：`calamity-data.js` 数据访问层 + `worldbook-engine.js` 关键词注入 + `prompt-builder.js` 灾厄世界观编排，已接入 index.html / game.html 运行时
- **测试页**：8 个系统测试页面（AI 链路 13/13 通过，含世界书注入 + prompt 编排）

### ⏳ 待完成（真实 LLM 端到端）

- **真实 LLM 调用**：配置 API Key 后验证 世界书数据 → Prompt → LLM → 响应解析 → 命令应用
- **输出格式校验**：确认 LLM 输出符合 `<content>` / `<命令>` / `<SUMMARY>` 闭合标签规范

### 🔧 已知问题

1. **命令引擎测试 1 项失败**：「解析：JSON 数组写法」——测试期望解析期归一化 key，实现将归一化放在 command-engine 层（职责划分差异，端到端链路正常）
2. **数据缺口**：6 个 NPC 缺六维属性（伊莎/塞壬/维克多/莉娜/莫拉/马库斯）
3. **数据模块体积**：3 个数据模块合计约 620KB，首屏加载偏重（可后续按需加载）

---

## 核心特性

### 游戏系统

- ✅ **D20 检定系统**：基于 DND 5E 简化
- ✅ **回合制战斗**：命中判定 + 伤害计算 + 重击机制
- ✅ **装备系统**：武器/护甲/双持 + 耐久度
- ✅ **生物系统**：怪物图鉴 + 战利品掉落
- ✅ **正文生成**：检定/战斗/时间标签自动渲染
- ✅ **命令引擎**：AI 状态命令安全应用 + 中文别名归一化
- ✅ **背包系统**：负重管理
- ✅ **经验成长**：等级/属性提升

### 技术特性

- ✅ **零依赖**：无需 npm，直接运行 HTML
- ✅ **模块化**：27 个独立 JS 模块，职责清晰
- ✅ **本地优先**：IndexedDB 存储，无需服务器
- ✅ **世界书驱动**：116 条灾厄世界书数据按关键词注入 Prompt
- ✅ **向量化召回**：语义记忆检索（可选）
- ✅ **测试完备**：8 个系统测试页面

---

## 数据完整度

**当前状态：90/100（良好）**

- ✅ 116 个 YAML 文件全部转换成功
- ✅ 必填字段完整性：40/40
- ⚠️ 推荐字段完整性：20/30（6 个 NPC 缺六维属性）
- ✅ 内容质量：30/30

详见：`docs/reports/data-quality-report.md`

---

## 贡献指南

### 数据优化

如需修改 NPC/系统规则/世界观：

1. 编辑 `data-source/世界书/*.yaml`
2. 运行转换脚本：`node data-source/tools/convert-yaml-to-js.js`
3. 重新测试游戏

### 代码贡献

请遵循姬侠传的代码风格：
- 使用 ES6 Modules
- 每个模块职责单一
- 添加 JSDoc 注释

---

## 许可证

MIT License

---

## 致谢

- 基于 [姬侠传/瀚海](https://github.com/Ji-Haitang/char_card_1) 架构
- 使用 SillyTavern 生态
- 灵感来源于 DND 5E
