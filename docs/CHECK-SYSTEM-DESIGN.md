# D20 检定系统设计文档

> 设计时间：2026-09-02  
> 基于：灾厄之后·重制版 通用检定规则  
> 参考：DND 5E SRD

---

## 📋 需求分析

### 核心规则摘要

#### 1. 检定公式
```
结果 = d20 + 属性调整值 + 熟练加值(PB)
成功条件：结果 ≥ DC
```

#### 2. 六维属性系统（DND 5E）
```javascript
{
  力量: 10,  // Strength
  敏捷: 10,  // Dexterity
  体质: 10,  // Constitution
  感知: 10,  // Wisdom
  智力: 10,  // Intelligence
  魅力: 10   // Charisma
}

// 调整值计算
调整值 = Math.floor((属性值 - 10) / 2)

// 示例
力量 14 → 调整值 +2
力量 8  → 调整值 -1
```

#### 3. DC 难度三档
- **普通 10**：常人专注即可
- **困难 15**：需专业训练或有利条件
- **极难 20**：精英水平

#### 4. 优势/劣势机制
- **优势**：掷两次 d20，取较高值
- **劣势**：掷两次 d20，取较低值
- **优劣抵消**：有优势也有劣势 → 正常掷骰
- **多源优势合并**：多个优势 = 1 重优势（不叠加）

#### 5. 背景特长系统
- 角色有相关背景特长 → 自动获优势
- 示例：「士兵」背景在战斗检定中获优势

#### 6. 天然 20/1（大成功/大失败）
- **天然 20**：完美达成或额外收益
- **天然 1**：受挫且代价加重

#### 7. 命运点系统
- 每游戏日恢复 1 点（上限 1 点）
- 花 1 点可重骰任意一次检定

#### 8. 对抗检定
```
发起者：d20 + 调整值
对抗者：d20 + 调整值
总值高者获胜，平局发起者胜
```

#### 9. 骰子来源
- 从骰子池依次取用（不得编造）
- 优势/劣势消耗 2 枚骰子

---

## 🏗️ 模块架构设计

### 模块职责划分

```
check-system.js
├── performCheck()           核心检定函数
├── performContestCheck()    对抗检定函数
├── calculateModifier()      调整值计算
├── resolveAdvantage()       优势/劣势处理
├── checkBackground()        背景特长判定
├── formatCheckResult()      格式化检定结果
└── [工具函数]
```

### 依赖关系

```
check-system.js
├── dice-pool.js             骰子池（取用 d20）
├── game-state.js            游戏状态（六维属性、背景特长、命运点）
└── game-utils.js            工具函数
```

---

## 📐 数据结构设计

### 1. 检定请求（CheckRequest）

```javascript
{
  type: 'normal' | 'contest',    // 检定类型：普通 / 对抗
  attribute: string,              // 主属性：'力量' | '敏捷' | ...
  dc: number,                     // 难度：10 | 15 | 20
  description: string,            // 检定描述：'撬开锈锁'
  
  // 修正项
  advantage: boolean,             // 是否有优势
  disadvantage: boolean,          // 是否有劣势
  customModifier: number,         // 自定义调整值（额外加成）
  
  // 背景特长
  relevantSkills: string[],       // 相关背景特长
  
  // 命运点
  useFatePoint: boolean,          // 是否使用命运点重骰
  
  // 对抗检定专用
  opponent: {
    attribute: string,
    modifier: number
  }
}
```

### 2. 检定结果（CheckResult）

```javascript
{
  // 基础信息
  type: 'normal' | 'contest',
  attribute: string,
  description: string,
  
  // 骰子结果
  roll: number,                   // d20 掷骰结果
  rolls: number[],                // 优势/劣势时的多次掷骰
  selectedRoll: number,           // 最终选中的骰值
  
  // 计算过程
  attributeValue: number,         // 属性值
  modifier: number,               // 属性调整值
  proficiencyBonus: number,       // 熟练加值（PB）
  customModifier: number,         // 自定义调整值
  total: number,                  // 总值
  
  // 判定结果
  dc: number,                     // 目标 DC
  success: boolean,               // 是否成功
  criticalSuccess: boolean,       // 天然 20
  criticalFailure: boolean,       // 天然 1
  
  // 优势/劣势
  hasAdvantage: boolean,
  hasDisadvantage: boolean,
  advantageSources: string[],     // 优势来源
  
  // 命运点
  fatePointUsed: boolean,
  
  // 对抗检定专用
  opponentRoll: number,
  opponentTotal: number,
  
  // 格式化输出
  formula: string,                // '15 + 2 + 2 = 19'
  narrative: string               // 叙事文本
}
```

---

## 🔧 核心函数设计

### 1. performCheck() - 核心检定函数

```javascript
/**
 * 执行 D20 检定
 * @param {CheckRequest} request - 检定请求
 * @returns {CheckResult} 检定结果
 */
export function performCheck(request) {
  // 1. 获取角色属性
  const attributeValue = gameState.attributes[request.attribute];
  const modifier = calculateModifier(attributeValue);
  const pb = gameState.proficiencyBonus || 0;
  
  // 2. 检查背景特长
  const hasSkillAdvantage = checkBackground(
    request.attribute, 
    request.relevantSkills
  );
  
  // 3. 解析优势/劣势
  const advantage = request.advantage || hasSkillAdvantage;
  const disadvantage = request.disadvantage;
  const finalAdvantage = resolveAdvantage(advantage, disadvantage);
  
  // 4. 从骰子池取用 d20
  const diceCount = finalAdvantage === 'none' ? 1 : 2;
  const rolls = [];
  for (let i = 0; i < diceCount; i++) {
    rolls.push(dicePool.getD20());
  }
  
  // 5. 选择骰值（优势取高，劣势取低）
  let selectedRoll;
  if (finalAdvantage === 'advantage') {
    selectedRoll = Math.max(...rolls);
  } else if (finalAdvantage === 'disadvantage') {
    selectedRoll = Math.min(...rolls);
  } else {
    selectedRoll = rolls[0];
  }
  
  // 6. 计算总值
  const total = selectedRoll + modifier + pb + (request.customModifier || 0);
  
  // 7. 判定成功/失败
  const success = total >= request.dc;
  const criticalSuccess = selectedRoll === 20;
  const criticalFailure = selectedRoll === 1;
  
  // 8. 构建结果
  return {
    type: 'normal',
    attribute: request.attribute,
    description: request.description,
    
    roll: selectedRoll,
    rolls: rolls,
    selectedRoll: selectedRoll,
    
    attributeValue: attributeValue,
    modifier: modifier,
    proficiencyBonus: pb,
    customModifier: request.customModifier || 0,
    total: total,
    
    dc: request.dc,
    success: success,
    criticalSuccess: criticalSuccess,
    criticalFailure: criticalFailure,
    
    hasAdvantage: finalAdvantage === 'advantage',
    hasDisadvantage: finalAdvantage === 'disadvantage',
    advantageSources: hasSkillAdvantage ? [request.relevantSkills] : [],
    
    fatePointUsed: request.useFatePoint,
    
    formula: formatFormula(selectedRoll, modifier, pb, request.customModifier, total),
    narrative: formatNarrative(request.description, success, criticalSuccess, criticalFailure)
  };
}
```

### 2. calculateModifier() - 调整值计算

```javascript
/**
 * 计算属性调整值
 * @param {number} attributeValue - 属性值（3-20）
 * @returns {number} 调整值
 */
export function calculateModifier(attributeValue) {
  return Math.floor((attributeValue - 10) / 2);
}

// 速查表缓存（性能优化）
const MODIFIER_TABLE = {
  3: -4, 4: -3, 5: -3,
  6: -2, 7: -2,
  8: -1, 9: -1,
  10: 0, 11: 0,
  12: 1, 13: 1,
  14: 2, 15: 2,
  16: 3, 17: 3,
  18: 4, 19: 4,
  20: 5
};

export function calculateModifierFast(attributeValue) {
  return MODIFIER_TABLE[attributeValue] || 0;
}
```

### 3. resolveAdvantage() - 优势/劣势处理

```javascript
/**
 * 解析优势/劣势
 * @param {boolean} hasAdvantage - 是否有优势
 * @param {boolean} hasDisadvantage - 是否有劣势
 * @returns {'advantage' | 'disadvantage' | 'none'} 最终状态
 */
export function resolveAdvantage(hasAdvantage, hasDisadvantage) {
  if (hasAdvantage && hasDisadvantage) {
    return 'none'; // 优劣抵消
  }
  if (hasAdvantage) {
    return 'advantage';
  }
  if (hasDisadvantage) {
    return 'disadvantage';
  }
  return 'none';
}
```

### 4. checkBackground() - 背景特长判定

```javascript
/**
 * 检查背景特长是否给予优势
 * @param {string} attribute - 检定属性
 * @param {string[]} relevantSkills - 相关背景特长
 * @returns {boolean} 是否获得优势
 */
export function checkBackground(attribute, relevantSkills = []) {
  const characterBackgrounds = gameState.backgrounds || [];
  
  // 检查角色是否拥有相关背景特长
  for (const skill of relevantSkills) {
    if (characterBackgrounds.includes(skill)) {
      return true;
    }
  }
  
  return false;
}

// 背景特长与属性映射表
const BACKGROUND_ATTRIBUTE_MAP = {
  '士兵': ['力量', '体质'],
  '学者': ['智力', '感知'],
  '游荡者': ['敏捷', '魅力'],
  '工匠': ['力量', '智力'],
  '猎人': ['敏捷', '感知'],
  '商人': ['魅力', '智力']
};
```

### 5. performContestCheck() - 对抗检定

```javascript
/**
 * 执行对抗检定
 * @param {CheckRequest} request - 检定请求
 * @returns {CheckResult} 检定结果
 */
export function performContestCheck(request) {
  // 1. 发起者检定
  const initiatorRoll = dicePool.getD20();
  const initiatorModifier = calculateModifier(
    gameState.attributes[request.attribute]
  );
  const initiatorTotal = initiatorRoll + initiatorModifier;
  
  // 2. 对抗者检定
  const opponentRoll = dicePool.getD20();
  const opponentModifier = request.opponent.modifier;
  const opponentTotal = opponentRoll + opponentModifier;
  
  // 3. 判定胜负（平局发起者胜）
  const success = initiatorTotal >= opponentTotal;
  
  // 4. 构建结果
  return {
    type: 'contest',
    attribute: request.attribute,
    description: request.description,
    
    roll: initiatorRoll,
    rolls: [initiatorRoll],
    selectedRoll: initiatorRoll,
    
    modifier: initiatorModifier,
    total: initiatorTotal,
    
    opponentRoll: opponentRoll,
    opponentTotal: opponentTotal,
    
    success: success,
    criticalSuccess: initiatorRoll === 20,
    criticalFailure: initiatorRoll === 1,
    
    formula: `${initiatorRoll} + ${initiatorModifier} = ${initiatorTotal} vs ${opponentTotal}`,
    narrative: formatContestNarrative(request.description, success)
  };
}
```

---

## 🎨 输出格式设计

### 检定输出示例

```xml
<check>
  <desc>撬开锈锁</desc>
  <attr>敏捷</attr>
  <roll>15</roll>
  <mod>+2</mod>
  <pb>+2</pb>
  <total>19</total>
  <dc>10</dc>
  <result>成功</result>
  <narrative>你灵巧地拨动锁芯，咔哒一声，锈锁应声而开。</narrative>
</check>
```

### 优势检定输出示例

```xml
<check>
  <desc>潜行绕过哨兵</desc>
  <attr>敏捷</attr>
  <advantage>背景「游荡者」</advantage>
  <rolls>8, 17</rolls>
  <selected>17</selected>
  <mod>+3</mod>
  <pb>+2</pb>
  <total>22</total>
  <dc>15</dc>
  <result>成功</result>
  <narrative>凭借多年游荡经验，你贴着墙壁无声移动，成功避开哨兵的视线。</narrative>
</check>
```

### 对抗检定输出示例

```xml
<check>
  <desc>与酒馆老板拼酒</desc>
  <type>对抗</type>
  <initiator>
    <attr>体质</attr>
    <roll>14</roll>
    <mod>+1</mod>
    <total>15</total>
  </initiator>
  <opponent>
    <roll>12</roll>
    <mod>+2</mod>
    <total>14</total>
  </opponent>
  <result>成功</result>
  <narrative>你一口闷下烈酒，老板的脸色却开始发白。你赢了！</narrative>
</check>
```

---

## 🧪 测试用例设计

### 测试场景 1：基础检定

```javascript
// 测试：普通难度撬锁
const result = performCheck({
  type: 'normal',
  attribute: '敏捷',
  dc: 10,
  description: '撬开锈锁',
  advantage: false,
  disadvantage: false
});

// 预期：
// - roll: 1-20
// - modifier: 根据敏捷属性计算
// - total: roll + modifier + pb
// - success: total >= 10
```

### 测试场景 2：优势检定

```javascript
// 测试：有背景特长的潜行
const result = performCheck({
  type: 'normal',
  attribute: '敏捷',
  dc: 15,
  description: '潜行绕过哨兵',
  advantage: false,
  disadvantage: false,
  relevantSkills: ['游荡者']
});

// 预期：
// - rolls.length: 2（优势掷两次）
// - selectedRoll: Math.max(rolls)
// - hasAdvantage: true
```

### 测试场景 3：对抗检定

```javascript
// 测试：说服 NPC
const result = performContestCheck({
  type: 'contest',
  attribute: '魅力',
  description: '说服铁匠赊账',
  opponent: {
    attribute: '魅力',
    modifier: 1
  }
});

// 预期：
// - opponentRoll: 1-20
// - success: initiatorTotal >= opponentTotal
```

### 测试场景 4：天然 20/1

```javascript
// 测试：大成功
// （需要 mock 骰子池返回 20）
const result = performCheck({
  type: 'normal',
  attribute: '力量',
  dc: 20,
  description: '掰开铁栅栏'
});

// 预期：
// - roll: 20
// - criticalSuccess: true
// - success: true（无论 DC 多高）
```

---

## 📋 实现检查清单

### Phase 1：核心函数（必需）
- [ ] `calculateModifier()` - 调整值计算
- [ ] `resolveAdvantage()` - 优势/劣势处理
- [ ] `performCheck()` - 基础检定
- [ ] `checkBackground()` - 背景特长判定

### Phase 2：高级功能（必需）
- [ ] `performContestCheck()` - 对抗检定
- [ ] `formatCheckResult()` - 格式化输出
- [ ] 天然 20/1 处理
- [ ] 命运点重骰

### Phase 3：工具函数（可选）
- [ ] `getAttributeModifier()` - 快速查询调整值
- [ ] `getDCDescription()` - DC 描述（普通/困难/极难）
- [ ] `formatNarrative()` - 叙事文本生成

### Phase 4：测试（必需）
- [ ] 单元测试（Jest）
- [ ] 集成测试（与骰子池）
- [ ] 边界测试（属性 3-20）

---

## 🚀 下一步行动

### 立即开始实现

1. **创建模块文件**：`module/check-system.js`
2. **实现核心函数**：
   - calculateModifier()
   - performCheck()
3. **创建测试页面**：`test-check-system.html`
4. **编写测试用例**

### 预计时间

- **核心实现**：2-3 小时
- **测试与调试**：1-2 小时
- **文档完善**：30 分钟
- **总计**：1 天

---

**下一步**：开始实现 `check-system.js`
