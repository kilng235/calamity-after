# D20 检定系统设计完成总结

> ⚠️ **历史记录**：本文档记录 2026-09-02 的设计里程碑。检定系统已实现于 `module/check-system.js`，当前项目状态见 [PROJECT-STATUS.md](../PROJECT-STATUS.md)（已更新至 2026-09-03）。
>
> 完成时间：2026-09-02 18:10  
> 状态：✅ 需求分析与架构设计完成  
> 下一步：开始代码实现

---

## ✅ 已完成工作

### 1. 需求分析完成
- ✅ 深入研读源 YAML 文件（通用检定.yaml + 属性系统.yaml）
- ✅ 提取核心规则（检定公式、DC 难度、优势/劣势）
- ✅ 明确特殊机制（背景特长、命运点、天然 20/1）
- ✅ 理解骰子池机制（依次取用、不可编造）

### 2. 架构设计完成
- ✅ 定义数据结构（CheckRequest + CheckResult）
- ✅ 设计核心函数（5 个主函数）
- ✅ 规划依赖关系（dice-pool + game-state + game-utils）
- ✅ 设计输出格式（XML 标签格式）

### 3. 测试计划完成
- ✅ 设计 4 个测试场景（基础/优势/对抗/天然）
- ✅ 规划实现检查清单（4 个阶段）

---

## 📋 核心设计要点

### 检定公式
```
总值 = d20 + 属性调整值 + 熟练加值(PB) + 自定义调整值
成功条件：总值 ≥ DC

调整值 = Math.floor((属性值 - 10) / 2)
```

### 六维属性（DND 5E）
```javascript
{
  力量: 10,  // 近战伤害、负重、体力
  敏捷: 10,  // 命中、AC、潜行、巧手
  体质: 10,  // 抗性、耐力
  感知: 10,  // 侦察、追踪、聆听
  智力: 10,  // 魔法、炼金、鉴定
  魅力: 10   // 说服、威吓、交易
}
```

### DC 难度三档
- **10 - 普通**：常人专注即可
- **15 - 困难**：需专业训练
- **20 - 极难**：精英水平

### 优势/劣势机制
- **优势**：掷 2 次 d20，取较高值
- **劣势**：掷 2 次 d20，取较低值
- **优劣抵消**：同时有优劣 = 正常掷骰
- **来源**：背景特长、环境因素、装备词缀

### 特殊规则
- **天然 20**：自动成功 + 额外收益
- **天然 1**：自动失败 + 额外代价
- **命运点**：每日 1 点，可重骰任意检定
- **背景特长**：相关场景自动获优势

---

## 🏗️ 模块架构

### 核心函数（5 个）

```javascript
// 1. 调整值计算
calculateModifier(attributeValue: number): number

// 2. 优势/劣势处理
resolveAdvantage(hasAdvantage: boolean, hasDisadvantage: boolean): string

// 3. 背景特长判定
checkBackground(attribute: string, relevantSkills: string[]): boolean

// 4. 基础检定（核心）
performCheck(request: CheckRequest): CheckResult

// 5. 对抗检定
performContestCheck(request: CheckRequest): CheckResult
```

### 数据结构

```javascript
// 检定请求
CheckRequest {
  type: 'normal' | 'contest',
  attribute: string,
  dc: number,
  description: string,
  advantage: boolean,
  disadvantage: boolean,
  relevantSkills: string[],
  useFatePoint: boolean,
  opponent: { attribute, modifier }
}

// 检定结果
CheckResult {
  roll: number,               // 骰值
  modifier: number,           // 调整值
  total: number,              // 总值
  dc: number,                 // DC
  success: boolean,           // 是否成功
  criticalSuccess: boolean,   // 天然 20
  criticalFailure: boolean,   // 天然 1
  hasAdvantage: boolean,
  formula: string,            // '15 + 2 + 2 = 19'
  narrative: string           // 叙事文本
}
```

---

## 🧪 测试场景设计

### 场景 1：基础检定
```javascript
// 撬开锈锁（敏捷 vs DC 10）
performCheck({
  attribute: '敏捷',
  dc: 10,
  description: '撬开锈锁'
})
```

### 场景 2：优势检定
```javascript
// 潜行（游荡者背景获优势）
performCheck({
  attribute: '敏捷',
  dc: 15,
  description: '潜行绕过哨兵',
  relevantSkills: ['游荡者']
})
```

### 场景 3：对抗检定
```javascript
// 说服 NPC
performContestCheck({
  attribute: '魅力',
  description: '说服铁匠赊账',
  opponent: { modifier: 1 }
})
```

### 场景 4：天然 20/1
```javascript
// 测试大成功/大失败
// （需要 mock 骰子池返回特定值）
```

---

## 📊 实现计划

### Phase 1：核心函数（2 小时）
- [ ] `calculateModifier()` - 调整值计算
- [ ] `resolveAdvantage()` - 优势/劣势处理
- [ ] `performCheck()` - 基础检定
- [ ] `checkBackground()` - 背景特长判定

### Phase 2：高级功能（1 小时）
- [ ] `performContestCheck()` - 对抗检定
- [ ] `formatCheckResult()` - 格式化输出
- [ ] 天然 20/1 处理
- [ ] 命运点重骰

### Phase 3：测试（1 小时）
- [ ] 创建 `test-check-system.html`
- [ ] 编写 4 个测试用例
- [ ] 边界测试（属性 3-20）

### Phase 4：文档（30 分钟）
- [ ] 函数 JSDoc 注释
- [ ] README 更新

**预计总时间：4.5 小时（1 天内完成）**

---

## 🎯 关键设计决策

### 1. 为什么不用 class？
- 保持与姬侠传风格一致（纯函数式）
- 更容易测试和调试
- 无状态设计，避免副作用

### 2. 为什么分离 CheckRequest 和 CheckResult？
- 清晰的输入/输出边界
- 便于序列化存档
- 方便 UI 层消费数据

### 3. 为什么优势/劣势返回字符串而非布尔？
- 三种状态：'advantage' | 'disadvantage' | 'none'
- 避免双布尔的复杂判断
- 更直观的状态表达

### 4. 为什么背景特长返回布尔？
- 背景特长只影响是否获得优势
- 简单的是/否判断足够
- 来源信息记录在 CheckResult.advantageSources

---

## 🚀 下一步行动

### 立即开始（今天）

**1. 创建模块文件**
```bash
touch module/check-system.js
```

**2. 实现核心函数（按顺序）**
- Step 1: `calculateModifier()` - 最简单，先完成
- Step 2: `resolveAdvantage()` - 逻辑清晰
- Step 3: `checkBackground()` - 依赖 game-state
- Step 4: `performCheck()` - 核心函数，集成所有功能

**3. 创建测试页面**
```bash
touch test-check-system.html
```

**4. 编写测试用例**
- 测试基础检定
- 测试优势/劣势
- 测试边界情况

---

## 📚 参考文档

| 文档 | 路径 | 说明 |
|------|------|------|
| **设计文档** | docs/CHECK-SYSTEM-DESIGN.md | 完整设计方案 |
| **源规则** | data-source/世界书/检定/通用检定.yaml | 官方规则 |
| **属性系统** | data-source/世界书/系统/属性系统.yaml | 六维定义 |
| **骰子池** | data-source/世界书/系统/骰子池.txt | 骰子机制 |

---

## 💡 设计亮点

### 1. 完整的 DND 5E 兼容
- 六维属性标准映射
- 调整值计算公式一致
- 优势/劣势机制完整实现

### 2. 灵活的扩展性
- CheckRequest 可添加新字段
- CheckResult 包含完整计算过程
- 易于添加新的检定类型

### 3. 清晰的数据流
```
用户操作 
  → CheckRequest 
  → performCheck() 
  → CheckResult 
  → UI 展示
```

### 4. 测试友好
- 纯函数设计
- 明确的输入/输出
- 易于 mock 依赖（骰子池）

---

## ⚠️ 潜在风险与缓解

### 风险 1：骰子池依赖未实现
- **影响**：无法从骰子池取用 d20
- **缓解**：先用 `Math.random()` mock，后续集成真实骰子池

### 风险 2：game-state 结构不匹配
- **影响**：无法读取属性/背景特长
- **缓解**：先定义最小化 game-state 接口，后续适配

### 风险 3：输出格式需求变化
- **影响**：formatCheckResult() 需要重写
- **缓解**：分离格式化逻辑，易于替换

---

**当前状态**：✅ 设计完成，准备实现  
**预计完成时间**：今天晚上（4.5 小时）  
**下一步**：创建 `module/check-system.js`
