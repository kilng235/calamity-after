# 灾厄之后·重制版 - 项目状态

> 更新时间：2026-09-04
> 项目阶段：P0 修复完成（结构/协议/链路），待真实 LLM 端到端测试

---

## ✅ 已完成工作

### 1. 数据层（完成，工作流已修复）

- ✅ 转换器重写：输出与运行时一致的**扁平 promptData 格式**，直写 `module/`；`npm run convert` 一键再生成
- ✅ 成对 XML 包装标签（`<SettlementProtocol>` 等）转换时剥离，Prompt 不再含残留闭合标签
- ✅ 骰子池条目（`系统/骰子池`）纳入数据模块（117 条），供每轮实时展开注入
- ✅ 数据完整度 90/100（0 严重 / 20 警告 / 1 建议）

### 2. 协议一致性清理（完成）

- ✅ 结算协议/关系系统/法术总纲/技能总纲/经验与成长：废弃值标签（`<relation>/<gold>/<skill>/<exp>/<spell>`）指令全部改为 `<命令>` 区落地
- ✅ ST 宏残留清理：`<user>` → 玩家；`{{roll:d20}}` 宏改由 prompt-builder 实时展开（骰子池条目每轮注入新鲜骰值）
- ✅ 数据同步协议：新增 `skills`/`spells` 可写根与字段定义（14 根），别名表补 `技能列表/法术列表`
- ✅ 命令引擎护栏：容器整体赋值拒绝（`set 好感度 = 10` / `set 角色 = {...}` 类命令不再核爆状态）

### 3. 主链路修复（完成）

- ✅ **对话历史**：滚动窗口（最近 8 轮）存 localStorage，经 `promptBuilder.buildMessages({ history })` 注入消息链；worldbook 扫描回退到历史最近 assistant 消息
- ✅ **任务块链路**：`parsed.quests` → `commandProcessor.applyQuests` → `gameData.quests`（主链路收敛为单一路径）
- ✅ **API 超时中断**：非流式请求默认 180s AbortController 超时，`_gameBusy` 不再永久锁死
- ✅ **Gemini key 移出 URL**：4 处调用全部改走 `x-goog-api-key` 请求头

### 4. 结构修复（完成）

- ✅ index.html 删除 871 行死代码块（含语法错误的旧经典脚本块：双份 UI 函数/旧 sendMessage/init）
- ✅ 死链修复：`start-screen.html` / `settings.html` 跳转改为 SPA 视图路由；补回回车发送绑定
- ✅ 重复脚本加载去除（api-service / json-repair-helper 各只加载一次）
- ✅ 骰子池导出修复：`dice-pool.js` 新增 `rollDice(数量, 面数)` 兼容导出，词缀/锻造/炼金三模块恢复可加载
- ✅ 锻造/炼金检定契约修复：`performCheck({attribute, gameState})` + `criticalSuccess/criticalFailure` 字段对齐
- ✅ 遗留模块冻结：pipeline/memory-recall/storage-service/idb-storage/game-ui/game-utils/dice-pool v1 移入 `module/legacy/`（8 个，不参与运行时）
- ✅ `variableSystem.getAll()` 补齐；生物 id typo 修复

### 5. 世界书注入治理（完成）

- ✅ 注入上限：单轮 ≤8 条、总字符 ≤6000，超预算整条跳过
- ✅ 优先级：NPC > 检定 > 地理 > 势力 > 生物 > 种族 > 武器 > 护甲 > 装备
- ✅ 骰子池条目不走关键词匹配（由 prompt-builder 每轮展开注入）

---

## 📊 验证结果（2026-09-04）

- ✅ 32/32 运行时模块 node 加载通过（legacy 8 个不参与）
- ✅ index.html 全部内联脚本语法检查通过（0 错误）
- ✅ 数据 key 一致性：旧 116 条全保留 + 新增 `系统/骰子池`，内容无丢失
- ✅ 端到端链路烟雾测试：history 注入 / 骰池实时展开 / worldbook 上限 / 命令护栏 / applyQuests 全部通过

---

## 🚀 下一步计划

1. **真实 LLM 端到端测试**：配置 API Key 验证完整链路（核心）
2. **制作系统接入**：锻造/炼金/词缀/法术/开局接入 index.html 运行时；测试页改为 import 真模块
3. **equipment 状态源收口**：equipment-system 单例并入 gameData 或建立同步
4. **法术总纲重写**：sheet_spells ST 数据库设计改为命令流
5. **NPC 数据补充**：6 个 NPC 六维属性（90 → 97 分）

---

## ⚠️ 已知问题

1. **equipment 双状态源**：combat-system 读 equipment-system 模块级单例，与 gameData.equipment 不同步
2. **opening-system 未接线**：registerOpening 无调用方，开局注入通道断开
3. **quest-system.js 与 gameData.quests 并行**：主链路已收敛，独立 questManager 仍是旁路
4. **法术总纲 sheet_spells**：ST 数据库表格设计残留
5. **CORS 代理默认启用**：第三方 Worker 中转（设置可关），Key 与对话经外部转发

---

## 🔄 更新日志

### 2026-09-03
- 初始化项目结构；116 YAML → 3 数据模块；核心系统实现；书式 SPA；AI 数据层接线

### 2026-09-04（P0 修复批）
- 修复 index.html 死代码块（871 行）与两处死链；去除重复脚本加载
- 对话历史 / 任务块 / API 超时 / Gemini key 请求头四项主链路修复
- 转换器重写（扁平格式 + 包装标签剥离）；骰子池纳入数据并实时展开注入
- 协议一致性清理（废弃标签全改 `<命令>` 区）；命令引擎容器护栏；skills/spells 可写根
- worldbook 注入上限与优先级；rollDice 兼容导出；锻造/炼金检定契约修复
- 遗留模块移入 `module/legacy/`；variableSystem.getAll 补齐

---

**下一步**：配置 API Key 做真实 LLM 端到端测试
