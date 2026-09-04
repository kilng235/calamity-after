# 灾厄之后·重制版 - 项目状态

> 更新时间：2026-09-03  
> 项目阶段：游戏逻辑层 + AI 叙事层均已接线，待真实 LLM 端到端测试

---

## ✅ 已完成工作

### 1. 项目初始化（完成）

- ✅ 创建独立项目目录结构
- ✅ 编写项目 README.md
- ✅ 配置 package.json

### 2. 数据迁移（完成）

- ✅ 编写数据转换脚本（`data-source/tools/convert-yaml-to-js.js`）
- ✅ 转换 116 个 YAML 文件为 JS 模块
- ✅ 生成 3 个提示词模块：
  - `module/prompt-data-core-calamity.js`（约 382 KB）- 系统规则
  - `module/prompt-data-npc-calamity.js`（约 74 KB）- NPC 人设
  - `module/prompt-data-world-calamity.js`（约 168 KB）- 世界观

### 3. 数据质量评估（完成）

- ✅ 生成数据质量报告
- ✅ 识别 20 个警告项
- ✅ 数据完整度评分：90/100（良好）
- ✅ 生成薄弱点深度分析报告

### 4. 核心系统开发（完成，已接线）

- ✅ **骰子系统**：`dice-pool.js` v2.0 实时掷骰（取代 v1 预掷版，旧版备份于 `dice-pool-prerolled-backup.js`）
- ✅ **D20 检定系统**：`check-system.js`（属性检定 + DC 判定 + 优势/劣势）
- ✅ **战斗系统**：`combat-system.js`（回合制 + 命中/伤害/重击）
- ✅ **装备系统**：`equipment-system.js`（武器/护甲/双持/耐久度）
- ✅ **生物系统**：`creature-system.js`（怪物数据 + 战利品）
- ✅ **正文生成系统**：`narrative-system.js`（检定/战斗/时间标签）
- ✅ **命令引擎 + 命令处理器**：`command-engine.js` + `command-processor.js`（AI 状态命令安全应用，中文别名归一化 + 白名单治理）
- ✅ **游戏状态管理**：`game-state.js`（属性/背包/关系/任务）
- ✅ **UI 系统**：`game-ui.js` + 书式 SPA

### 5. UI 开发（完成）

- ✅ `index.html` 书式 SPA（首页/创建/游戏/设置/指南 视图）
- ✅ `game.html` 独立游戏页面
- ✅ `register.html` 开场登记（角色创建：六维 + HP/MP/AC/负重）
- ✅ `settings.html` 设置页面
- ✅ `start-screen.html` 开场白页面
- ✅ 废土羊皮纸/皮革主题 UI 资源（`img/ui/`）

### 6. 测试（完成）

- ✅ 8 个系统测试页面（骰子/检定/战斗/装备/生物/正文生成/命令引擎/AI 链路）
- ✅ AI 链路测试 7/7 通过
- ✅ 命令引擎测试 19/20（1 项为测试断言与实现职责差异，见已知问题）

### 7. AI 数据层接线（完成）

- ✅ **数据访问层**：`calamity-data.js`（IIFE，统一访问 3 个 ES 数据模块：扁平 `promptData` + 嵌套 `calamityPrompts`）
- ✅ **worldbook-engine 适配**：重写为消费 `calamityData`，按关键词触发 NPC / 地理 / 势力 / 生物 / 种族 / 武器 / 护甲 / 装备 / 检定 条目注入
- ✅ **prompt-builder 重写**：自包含灾厄版本，移除全部姬侠传依赖（`PROMPT_CORE_*` / `templateEngine` / `tokenUtils` / 天山派 / 伊州 等），按灾厄世界观编排（角色状态 + 世界观核心 + 输出规范 + 检定规则 + 世界书注入 + 行动指导）
- ✅ **运行时接入**：index.html / game.html 加载 `calamity-data.js`，内联 module 脚本导入 3 个数据模块并注册到 `window.calamityData`
- ✅ **端到端验证**：Node 脚本 22/22 通过（数据访问 → worldbook 匹配 → prompt 编排 → 降级容错）；`测试-AI链路.html` 扩展至 13 项测试覆盖世界书注入

---

## 📊 当前项目结构

```
灾厄之后-独立版/
├── index.html                     ✅ 主游戏页面（书式 SPA）
├── game.html                      ✅ 独立游戏页面
├── register.html                  ✅ 开场登记
├── settings.html                  ✅ 设置页面
├── start-screen.html              ✅ 开场白
├── 测试-*.html                    ✅ 8 个系统测试页面
│
├── module/                        ✅ 27 个 JS 模块
│   ├── 游戏逻辑层（已接线）：
│   │   dice-pool.js / check-system.js / combat-system.js
│   │   equipment-system.js / creature-system.js / narrative-system.js
│   │   game-state.js / command-engine.js / command-processor.js
│   │   game-ui.js / game-utils.js / variable-system.js
│   ├── AI/LLM 层（已接线）：
│   │   api-service.js / prompt-builder.js / worldbook-engine.js
│   │   calamity-data.js / response-parser.js / json-repair-helper.js
│   │   pipeline.js / memory-recall.js / embedding-service.js
│   │   storage-service.js / idb-storage.js
│   └── 数据层：
│       prompt-data-core-calamity.js / prompt-data-npc-calamity.js
│       prompt-data-world-calamity.js / dice-pool-prerolled-backup.js
│
├── data-source/                   ✅ 源数据（116 个 YAML 世界书）
├── docs/                          ✅ 设计文档与报告
├── img/ui/                        ✅ UI 图片资源
├── README.md                      ✅ 项目说明（已更新）
├── CHANGELOG.md                   ✅ 更新日志
└── package.json                   ✅ 项目配置
```

---

## 🚀 下一步计划

### 优先级 1：真实 LLM 端到端测试

AI 数据层已接线（世界书数据 → worldbook-engine → prompt-builder → api-service 链路已打通），需配置 API Key 后做真实调用验证：

- [ ] 配置 API Key 后验证：世界书数据 → Prompt → LLM → 响应解析 → 命令应用
- [ ] 校验 LLM 输出是否符合「输出格式」（`<content>` / `<命令>` / `<SUMMARY>` 闭合标签）
- [ ] 校验命令落地与白名单治理

### 优先级 2：修复已知问题

- [ ] **命令引擎测试**：统一「解析期归一化 key」的职责划分（修测试或改解析层）
- [ ] **数据补充**：6 个 NPC 六维属性（伊莎/塞壬/维克多/莉娜/莫拉/马库斯）
- [ ] **数据模块加载优化**：3 个数据模块合计约 620KB，可考虑按需加载或压缩

### 优先级 3：完善与发布

- [ ] 移动端适配
- [ ] 用户手册

---

## ⚠️ 已知问题

1. **命令引擎测试 1 项失败**：「解析：JSON 数组写法」——测试期望解析期归一化 key，实现将归一化放在 command-engine 层（职责划分差异，端到端链路正常）
2. **数据缺口**：6 个 NPC 缺六维属性
3. **数据模块体积**：3 个数据模块合计约 620KB，首屏加载偏重（可后续按需加载）

---

## 📚 参考资源

### 项目文档
- [项目 README](./README.md)
- [开发进度清单](./docs/开发进度清单.md)
- [数据质量报告](./docs/reports/data-quality-report.md)
- [薄弱点分析](./docs/reports/data-weakness-analysis.md)

### 外部参考
- [姬侠传项目](https://github.com/Ji-Haitang/char_card_1)
- [SillyTavern 文档](https://docs.sillytavern.app/)
- [DND 5E SRD](https://www.5esrd.com/)

---

## 🔄 更新日志

### 2026-09-02
- ✅ 初始化项目结构
- ✅ 完成数据转换（116 个 YAML → 3 个 JS 模块）
- ✅ 生成数据质量报告（90/100）
- ✅ 复制姬侠传核心模块并适配

### 2026-09-03
- ✅ 骰子系统升级为 v2.0 实时掷骰
- ✅ D20 检定 / 战斗 / 装备 / 生物 / 正文生成系统实现
- ✅ 命令引擎 + 命令处理器实现
- ✅ 书式 SPA UI + 独立页面完成
- ✅ 8 个系统测试页面 + AI 链路测试 7/7 通过
- ✅ 更新过时文档（README / PROJECT-STATUS / SUMMARY / 开发进度清单 / CURRENT-TASK）
- ✅ 修复检定字段名不匹配 bug（「undefined检定」）
- ✅ AI 数据层接线：calamity-data 数据访问层 + worldbook-engine 适配 + prompt-builder 重写 + 运行时接入
- ✅ AI 链路测试扩展至 13 项（世界书注入 + prompt 编排），Node 端到端验证 22/22 通过

---

**下一步**：配置 API Key 做真实 LLM 端到端测试
