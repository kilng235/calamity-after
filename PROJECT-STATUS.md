# 灾厄之后·重制版 - 项目状态

> 更新时间：2026-09-02 17:40  
> 项目阶段：数据迁移完成，准备开始核心系统开发

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
  - `module/prompt-data-core-calamity.js`（140 KB）- 系统规则
  - `module/prompt-data-npc-calamity.js`（73 KB）- NPC 人设
  - `module/prompt-data-world-calamity.js`（164 KB）- 世界观

### 3. 数据质量评估（完成）

- ✅ 生成数据质量报告
- ✅ 识别 20 个警告项
- ✅ 数据完整度评分：90/100（良好）
- ✅ 生成薄弱点深度分析报告

### 4. 前端资源（完成）

- ✅ 复制开场白界面（`start-screen.html`）
- ✅ 废土羊皮纸主题 CSS（已内置在开场白中）

---

## 📊 当前项目结构

```
灾厄之后-独立版/
├── README.md                     ✅ 项目说明
├── package.json                  ✅ 项目配置
├── PROJECT-STATUS.md             ✅ 本文档
│
├── module/                       ✅ 已生成的 JS 模块
│   ├── prompt-data-core-calamity.js
│   ├── prompt-data-npc-calamity.js
│   └── prompt-data-world-calamity.js
│
├── data-source/                  ✅ 源数据
│   ├── 世界书/（116 个 YAML）
│   └── tools/convert-yaml-to-js.js
│
├── docs/                         ✅ 文档
│   └── reports/
│       ├── data-quality-report.md
│       ├── data-weakness-analysis.md
│       └── conversion-summary.md
│
├── start-screen.html             ✅ 开场白界面
│
├── styles/                       📁 空目录（待创建）
├── img/                          📁 空目录（待添加资源）
├── bgm/                          📁 空目录（待添加资源）
└── apk/                          📁 空目录（待配置）
```

---

## 🚀 下一步计划

### 阶段 1：复制姬侠传核心模块（Week 1，Day 1-2）

**需要从姬侠传复制的核心模块（优先级排序）：**

#### 优先级 1：基础设施（必需）
- [ ] `api-service.js` - LLM API 接口（OpenAI/Gemini）
- [ ] `game-state.js` - 游戏状态管理
- [ ] `idb-storage.js` - IndexedDB 封装
- [ ] `storage-service.js` - 存档系统
- [ ] `game-utils.js` - 工具函数

#### 优先级 2：核心系统（必需）
- [ ] `pipeline.js` - 消息处理流水线
- [ ] `prompt-builder.js` - Prompt 编排
- [ ] `response-parser.js` - 响应解析
- [ ] `variable-system.js` - 三级变量系统
- [ ] `worldbook-engine.js` - 世界书触发引擎

#### 优先级 3：游戏逻辑（必需）
- [ ] `game-events.js` - 事件处理
- [ ] `game-ui.js` - UI 更新
- [ ] `memory-recall.js` - 记忆召回（可选向量化）

#### 优先级 4：姬侠传特色功能（改造）
- [ ] `turn-based-battle-new.html` 逻辑 → 改造为 `combat-system.js`
- [ ] `alchemy.html` 逻辑 → 改造为 `forge-system.js`
- [ ] `event-history-service.js` → 适配灾厄的历史记录

---

### 阶段 2：新增灾厄专属模块（Week 1，Day 3-5）

#### 新模块清单

```javascript
module/
├── check-system.js               🆕 D20 检定系统
├── dice-pool.js                  🆕 骰子池管理（预掷 + 依次取用）
├── combat-system.js              🔧 战斗系统（改造自姬侠传）
├── forge-system.js               🔧 锻造系统（改造自炼丹）
├── relation-system.js            🔧 关系系统（改造自姬侠传好感度）
├── settlement-engine.js          🆕 结算协议执行器
├── equipment-system.js           🆕 装备与耐久度管理
└── background-system.js          🆕 背景特长（优势机制）
```

---

### 阶段 3：UI 开发（Week 2）

#### 主要页面

```
index.html                        主游戏页
  ├─ 角色面板（六维 + HP + 装备）
  ├─ 背包系统（12 槽 + 负重）
  ├─ 关系面板（NPC 好感度 + 势力声望）
  └─ 聊天区（主剧情）

combat.html                       战斗页
  ├─ 敌人列表（HP + 防御值）
  ├─ 攻击/技能按钮
  ├─ 战斗日志
  └─ 交战距离显示

forge.html                        锻造页
  ├─ 材料选择（17 种矿石）
  ├─ 装备类型选择
  ├─ 检定掷骰
  └─ 词缀预览（144 词缀表）

map.html                          地图页
  ├─ 11 个区域卡片
  ├─ 当前位置高亮
  └─ 区域描述

faction.html                      势力页
  ├─ 5 大势力
  ├─ 声望条
  └─ 势力任务
```

---

### 阶段 4：ST 版本（Week 3）

```
index-SR.html                     SillyTavern 流式版
  ├─ 对接 ST 的 getvar/setvar
  ├─ 流式响应解析
  └─ 变量同步

st-converter.js                   ST 存档转换器
  ├─ .jsonl → 独立前端格式
  └─ 数据迁移逻辑
```

---

### 阶段 5：测试与优化（Week 4）

- [ ] 端到端测试
- [ ] 双模式切换测试
- [ ] 性能优化
- [ ] 移动端适配

---

## 📋 开发检查清单

### Week 1：核心系统

#### Day 1-2：复制姬侠传模块
- [ ] 从姬侠传项目复制 15 个核心模块
- [ ] 调整模块间的 import/export 路径
- [ ] 测试基础 API 调用

#### Day 3：D20 检定系统
- [ ] 实现 `check-system.js`
  - [ ] d20 掷骰函数
  - [ ] 属性调整值计算
  - [ ] 优势/劣势机制
  - [ ] 背景特长判定
  - [ ] DC 难度对比

#### Day 4：骰子池系统
- [ ] 实现 `dice-pool.js`
  - [ ] 预掷 75 个骰子（d20×15, d4/d6/d8/d10/d12×10）
  - [ ] 依次取用逻辑
  - [ ] 用完循环
  - [ ] 手动重骰支持（命运点）

#### Day 5：战斗系统
- [ ] 实现 `combat-system.js`
  - [ ] 命中判定（d20 + 攻击加值 vs AC）
  - [ ] 伤害计算（武器骰 + 属性加值）
  - [ ] 天然 20 重击（×2）
  - [ ] 耐久度扣减
  - [ ] 敌人 HP 管理

---

### Week 2：UI 开发

#### Day 1-2：主游戏界面
- [ ] 创建 `index.html` 基础结构
- [ ] 集成角色面板
- [ ] 集成背包系统
- [ ] 集成聊天区

#### Day 3：战斗界面
- [ ] 改造姬侠传的 `turn-based-battle-new.html`
- [ ] 适配灾厄战斗规则
- [ ] 测试战斗流程

#### Day 4：锻造界面
- [ ] 改造姬侠传的 `alchemy.html`
- [ ] 适配 17 种材料
- [ ] 适配 144 词缀表
- [ ] 测试锻造流程

#### Day 5：地图与势力
- [ ] 创建 `map.html`（11 个区域）
- [ ] 创建 `faction.html`（5 大势力）
- [ ] 测试场景切换

---

### Week 3：ST 版本

#### Day 1-2：ST 集成
- [ ] 创建 `index-SR.html`
- [ ] 对接 ST 变量系统
- [ ] 测试流式响应

#### Day 3：存档转换
- [ ] 实现 `st-converter.js`
- [ ] 测试 .jsonl 导入
- [ ] 测试数据迁移

#### Day 4-5：双模式测试
- [ ] ST 版功能测试
- [ ] 独立前端功能测试
- [ ] 存档互相转换测试

---

### Week 4：优化与发布

#### Day 1-2：测试
- [ ] 端到端流程测试
- [ ] 边界情况测试
- [ ] 性能测试

#### Day 3-4：优化
- [ ] 代码优化
- [ ] UI 响应式优化
- [ ] 移动端适配

#### Day 5：文档与发布
- [ ] 完善文档
- [ ] 编写用户手册
- [ ] 准备发布

---

## 🎯 当前优先级

### 立即行动（本周）

**优先级 1：复制姬侠传核心模块**
- 目标：15 个核心模块复制并调整
- 时间：2 天
- 产出：基础游戏框架可运行

**优先级 2：实现 D20 检定系统**
- 目标：`check-system.js` 完成
- 时间：1 天
- 产出：检定机制可用

**优先级 3：实现骰子池**
- 目标：`dice-pool.js` 完成
- 时间：1 天
- 产出：骰子预掷机制可用

---

## ⚠️ 风险与注意事项

### 技术风险

1. **姬侠传模块依赖复杂**
   - 风险：模块间耦合度高，可能需要同时复制多个依赖
   - 缓解：先复制基础设施模块，再复制业务模块

2. **骰子池实现复杂**
   - 风险：预掷 + 依次取用的逻辑需要严格测试
   - 缓解：参考姬侠传的随机数管理机制，编写单元测试

3. **双模式同步困难**
   - 风险：ST 版与独立前端的数据结构可能不一致
   - 缓解：使用 `st-converter.js` 统一数据格式

### 数据风险

1. **6 个 NPC 缺六维属性**
   - 影响：检定系统无法完整使用
   - 缓解：可以先用默认值，后续补充

2. **词缀表 144 行**
   - 风险：AI 生成词缀时可能超出 token 限制
   - 缓解：分批次加载，或使用向量化检索

---

## 📚 参考资源

### 项目文档
- [项目 README](./README.md)
- [数据质量报告](./docs/reports/data-quality-report.md)
- [薄弱点分析](./docs/reports/data-weakness-analysis.md)
- [转换工具说明](./data-source/tools/README-DATA-CONVERTER.md)

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
- ✅ 复制开场白界面
- ✅ 编写项目文档

---

**下一步**：开始复制姬侠传核心模块（预计 2 天）
