# 当前任务：AI 数据层接线

> 任务时间：2026-09-03  
> 状态：✅ 已完成

---

## 背景

游戏逻辑层（检定/战斗/装备/生物/正文生成/命令引擎）已全部完成并测试通过。此前核心缺口是 **AI 叙事层未接入运行时**：

- `prompt-data-*-calamity.js` 三个数据模块（116 个 YAML 转换而来）**仅被测试页引用**，index.html/game.html 运行时未加载
- `prompt-builder.js` 仍为姬侠传版本，引用不存在的 `PROMPT_CORE_*` 全局常量与姬侠传地点（天山派/伊州等）
- `worldbook-engine.js` 期望姬侠传常量，需改为消费 `promptData` 对象

---

## 任务目标

将世界书数据接入运行时 Prompt 链路，使 AI 叙事层可端到端运行：

```
世界书数据 (promptData) → worldbook-engine 条目注入 → prompt-builder 编排
→ api-service 调用 LLM → response-parser 解析 → command-engine 应用状态
```

---

## 完成情况

### 1. 数据模块接入运行时 ✅
- [x] 新建 `module/calamity-data.js`（IIFE 数据访问层）：统一访问扁平 `promptData` + 嵌套 `calamityPrompts`
- [x] index.html / game.html 加载 `calamity-data.js`，内联 module 脚本导入 3 个数据模块并注册到 `window.calamityData`
- [x] 提供 `get / getFlat / getCategory / categories / search / searchAll / npcNames` 检索接口

### 2. worldbook-engine 适配 ✅
- [x] 重写为消费 `calamityData` 对象
- [x] 实现条目匹配：按关键词触发（NPC / 地理 / 势力 / 生物 / 种族 / 武器 / 护甲 / 装备 / 检定）
- [x] 实现条目注入：`matchNPCs` / `matchWorldbook` / `buildWorldbookBlocks`
- [x] 行动指导：`matchActionGuide` 按行动关键词返回对应系统规则（战斗 / 检定 / 战利品 / 锻造 / 任务 / 交易）

### 3. prompt-builder 重写 ✅
- [x] 移除姬侠传常量引用（`PROMPT_CORE_*`、`templateEngine`、`tokenUtils`、`customWorldbook`）
- [x] 移除姬侠传地点引用（天山派/伊州等）
- [x] 按灾厄世界观重写 Prompt 编排（自包含 IIFE）：
  - system：角色状态 + 世界观核心（灾厄概述/文风指引/扮演准则）+ 输出规范（输出格式/结算协议/数据同步协议）+ 检定规则（通用检定）+ 世界书注入 + 行动指导
  - user：玩家输入（+ 行动规则参考）
  - assistant：上一次 AI 回复（如存在）
- [x] 数据未注册时优雅降级（仍可构建最小 Prompt）

### 4. 端到端验证 ✅
- [x] Node 脚本验证 22/22 通过（数据访问 → worldbook 匹配 → prompt 编排 → 降级容错）
- [x] `测试-AI链路.html` 扩展至 13 项测试（新增：数据注册 / NPC 匹配 / 通用匹配 / 行动指导 / prompt 编排 / 历史消息）

---

## 遗留事项

- [ ] 配置 API Key 后做真实 LLM 端到端测试（世界书数据 → Prompt → LLM → 响应解析 → 命令应用）
- [ ] 校验 LLM 输出是否符合「输出格式」（`<content>` / `<命令>` / `<SUMMARY>` 闭合标签）
- [ ] 数据模块体积优化（3 个模块合计约 620KB，可考虑按需加载）

---

## 参考文件

- 数据：`module/prompt-data-core-calamity.js` / `prompt-data-npc-calamity.js` / `prompt-data-world-calamity.js`
- 数据访问层：`module/calamity-data.js`（新增）
- 已适配：`module/worldbook-engine.js` / `module/prompt-builder.js`
- 已就绪：`module/api-service.js` / `module/response-parser.js` / `module/command-engine.js`
- 测试：`测试-AI链路.html` / `测试-模块导入.html`
