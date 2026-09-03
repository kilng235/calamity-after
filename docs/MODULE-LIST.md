# 已复制模块清单

> 更新时间：2026-09-02 17:45  
> 来源：姬侠传项目（/tmp/char_card_1/module/）  
> 目标：灾厄之后-独立版/module/

---

## 📦 模块统计

- **总模块数**：18 个
- **总大小**：~800 KB
- **来源**：15 个姬侠传模块 + 3 个灾厄数据模块

---

## ✅ 已复制的姬侠传模块（15 个）

### 第一批：基础设施模块（5 个）

| 模块 | 大小 | 功能 |
|------|------|------|
| `api-service.js` | 23 KB | LLM API 接口（OpenAI/Gemini） |
| `game-state.js` | 22 KB | 游戏状态管理 |
| `game-utils.js` | 24 KB | 工具函数集合 |
| `idb-storage.js` | 4.7 KB | IndexedDB 封装 |
| `storage-service.js` | 58 KB | 存档系统（独立前端） |

### 第二批：核心系统模块（5 个）

| 模块 | 大小 | 功能 |
|------|------|------|
| `pipeline.js` | 74 KB | 消息处理流水线 |
| `prompt-builder.js` | 47 KB | Prompt 编排器 |
| `response-parser.js` | 10 KB | 响应解析器 |
| `variable-system.js` | 3.3 KB | 三级变量系统 |
| `worldbook-engine.js` | 2.5 KB | 世界书触发引擎 |

### 第三批：游戏逻辑模块（5 个）

| 模块 | 大小 | 功能 |
|------|------|------|
| `game-events.js` | 55 KB | 事件处理系统 |
| `game-ui.js` | 47 KB | UI 更新函数 |
| `memory-recall.js` | 60 KB | 记忆召回（向量化） |
| `embedding-service.js` | 8.3 KB | 向量化服务 |
| `json-repair-helper.js` | 4.0 KB | JSON 修复工具 |

---

## 📊 灾厄数据模块（3 个）

| 模块 | 大小 | 功能 |
|------|------|------|
| `prompt-data-core-calamity.js` | 140 KB | 系统规则（19 个文件） |
| `prompt-data-npc-calamity.js` | 73 KB | NPC 人设（14 个） |
| `prompt-data-world-calamity.js` | 164 KB | 世界观/地理/势力 |

---

## 🔗 模块依赖关系

### 依赖层级

```
Layer 1: 基础设施（无依赖）
├── game-utils.js
├── idb-storage.js
└── json-repair-helper.js

Layer 2: 核心服务（依赖 Layer 1）
├── api-service.js → game-utils
├── storage-service.js → idb-storage
├── embedding-service.js → api-service
└── variable-system.js → 无依赖

Layer 3: 数据与引擎（依赖 Layer 1-2）
├── prompt-data-*.js → 无依赖（纯数据）
├── worldbook-engine.js → variable-system
└── response-parser.js → json-repair-helper

Layer 4: 业务逻辑（依赖 Layer 1-3）
├── game-state.js → variable-system, storage-service
├── prompt-builder.js → prompt-data-*, worldbook-engine
├── memory-recall.js → embedding-service, storage-service
└── game-events.js → game-state, game-utils

Layer 5: 流程编排（依赖 Layer 1-4）
├── pipeline.js → api-service, prompt-builder, response-parser, game-state
└── game-ui.js → game-state, game-events
```

---

## ⚠️ 需要注意的依赖

### 1. 姬侠传特定数据引用

以下模块可能引用了姬侠传的数据结构，需要适配：

- `prompt-builder.js` - 引用 NPC 数据结构
- `game-events.js` - 引用技能/物品列表
- `game-state.js` - 引用属性系统

### 2. 缺失的模块

以下模块在姬侠传中存在，但暂未复制（可按需添加）：

- `game-config.js` - 游戏配置
- `game-skills.js` - 技能系统
- `item-list.js` - 物品列表
- `bgm-manager.js` - BGM 管理
- `button-sfx.js` - 音效管理

---

## 🛠️ 下一步适配任务

### 优先级 1：路径调整

所有模块的 `import` 语句可能需要调整：

```javascript
// 姬侠传原路径
import { gameData } from './game-state.js';
import { promptData } from './prompt-data-jixiachuan.js';

// 灾厄之后新路径（需替换）
import { gameData } from './game-state.js';
import { calamityPrompts } from './prompt-data-core-calamity.js';
```

### 优先级 2：数据结构适配

**`game-state.js` 需要修改：**
- 六维属性：姬侠传 6 属性 → 灾厄 DND 6 属性
- 技能系统：姬侠传技能列表 → 灾厄背景特长
- 装备系统：姬侠传装备 → 灾厄装备 + 词缀

**`prompt-builder.js` 需要修改：**
- 引用灾厄的 3 个数据模块
- 适配灾厄的结算协议
- 适配灾厄的输出格式

### 优先级 3：新增灾厄专属模块

需要创建的新模块：

```
module/
├── check-system.js          🆕 D20 检定系统
├── dice-pool.js             🆕 骰子池管理
├── combat-system.js         🆕 战斗系统
├── forge-system.js          🆕 锻造系统
├── settlement-engine.js     🆕 结算协议执行器
└── relation-system.js       🆕 关系系统
```

---

## 📋 模块适配检查清单

### 基础设施模块（无需修改）
- [x] `game-utils.js` - 通用工具，无需修改
- [x] `idb-storage.js` - 通用存储，无需修改
- [x] `json-repair-helper.js` - 通用工具，无需修改

### 核心服务模块（小幅修改）
- [ ] `api-service.js` - 可能需要调整 API 配置
- [ ] `storage-service.js` - 可能需要调整存档结构
- [ ] `embedding-service.js` - 可选模块，可暂时保留
- [x] `variable-system.js` - 通用变量系统，无需修改

### 数据与引擎模块（需修改）
- [ ] `prompt-builder.js` - **需大幅修改**：引用灾厄数据模块
- [ ] `worldbook-engine.js` - 小幅修改：适配灾厄世界书格式
- [x] `response-parser.js` - 通用解析器，小幅修改

### 业务逻辑模块（需大幅修改）
- [ ] `game-state.js` - **需大幅修改**：六维属性 + 背景特长 + 命运点
- [ ] `game-events.js` - **需修改**：适配灾厄事件系统
- [ ] `game-ui.js` - **需修改**：适配灾厄 UI
- [ ] `memory-recall.js` - 可选模块，可暂时保留

### 流程编排模块（需修改）
- [ ] `pipeline.js` - 需修改：集成灾厄的结算协议
- [ ] `game-ui.js` - 已在上面

---

## 🎯 建议的适配顺序

### Day 1：测试基础设施（今天）
1. 创建测试 HTML 文件
2. 导入基础模块测试是否报错
3. 修复 import 路径问题

### Day 2：适配 game-state.js
1. 修改六维属性定义
2. 添加命运点系统
3. 添加背景特长字段
4. 测试状态保存/加载

### Day 3：适配 prompt-builder.js
1. 引入灾厄 3 个数据模块
2. 重写 Prompt 编排逻辑
3. 集成结算协议
4. 测试 Prompt 生成

### Day 4-5：创建灾厄专属模块
1. 实现 `check-system.js`
2. 实现 `dice-pool.js`
3. 实现 `combat-system.js`
4. 集成测试

---

## 📚 参考文档

- [姬侠传模块文档](./docs/jixiachuan-modules.md)（待创建）
- [灾厄数据格式](./docs/calamity-data-format.md)（待创建）
- [模块适配指南](./docs/module-adaptation.md)（待创建）

---

**下一步**：创建测试 HTML 文件，测试模块导入
