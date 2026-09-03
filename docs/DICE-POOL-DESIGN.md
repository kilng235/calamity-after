# 骰子池系统设计文档

> 设计时间：2026-09-02 18:15  
> 基于：灾厄之后·重制版 骰子池机制  
> 优先级：**极高**（检定系统的核心依赖）

---

## 📋 需求分析

### 核心规则（来自源文件）

#### 1. 骰子池内容
```
d20 × 15 枚   - 用于检定
d4  × 10 枚   - 用于匕首/法杖伤害
d6  × 10 枚   - 用于短剑/铁斧/猎弓伤害
d8  × 10 枚   - 用于铁剑/长弓伤害
d10 × 10 枚   - 用于双手剑/战斧伤害
d12 × 10 枚   - 用于重弩伤害

总计：75 枚骰子
```

#### 2. 使用规则
- **依次取用**：第一次检定用第一枚 d20，第二次用第二枚，以此类推
- **不得跳选**：不能挑选有利的骰子，必须按顺序使用
- **不得编造**：所有骰值必须从预掷池中取用
- **用完循环**：15 枚 d20 用完后，从头开始重复使用
- **重复使用需注明**：在输出中标注"（骰子池循环）"

#### 3. 特殊情况
- **优势/劣势**：消耗 2 枚骰子，取高/低值
- **重击**：天然 20 时，武器伤害骰 ×2
- **命运点重骰**：消耗 1 点命运点，重新取用下一枚骰子

#### 4. 刷新机制
- **什么时候刷新**：
  - 游戏开始时
  - 用户明确要求"重新掷骰池"
  - 存档加载时（可选：加载旧骰池 or 重新生成）
- **不自动刷新**：战斗结束、休息、场景切换都不刷新

---

## 🏗️ 模块架构设计

### 核心职责

```
dice-pool.js
├── 初始化骰子池（预掷 75 枚）
├── 按顺序取用骰子
├── 追踪使用索引
├── 循环重复使用
├── 持久化存储（IndexedDB）
└── 调试/查看功能
```

### 数据结构

```javascript
// 骰子池状态
DicePoolState {
  // 预掷的骰子数组
  d20: number[],      // 15 枚
  d4: number[],       // 10 枚
  d6: number[],       // 10 枚
  d8: number[],       // 10 枚
  d10: number[],      // 10 枚
  d12: number[],      // 10 枚
  
  // 当前使用索引（用于依次取用）
  indices: {
    d20: number,      // 0-14（循环）
    d4: number,       // 0-9
    d6: number,
    d8: number,
    d10: number,
    d12: number
  },
  
  // 元数据
  createdAt: number,  // 创建时间戳
  totalUsed: {        // 总使用次数（用于判断是否循环）
    d20: number,
    d4: number,
    // ...
  }
}
```

---

## 🔧 核心函数设计

### 1. initDicePool() - 初始化骰子池

```javascript
/**
 * 初始化骰子池（预掷所有骰子）
 * @returns {DicePoolState} 骰子池状态
 */
export function initDicePool() {
  const pool = {
    d20: rollMultiple(20, 15),
    d4: rollMultiple(4, 10),
    d6: rollMultiple(6, 10),
    d8: rollMultiple(8, 10),
    d10: rollMultiple(10, 10),
    d12: rollMultiple(12, 10),
    
    indices: {
      d20: 0,
      d4: 0,
      d6: 0,
      d8: 0,
      d10: 0,
      d12: 0
    },
    
    totalUsed: {
      d20: 0,
      d4: 0,
      d6: 0,
      d8: 0,
      d10: 0,
      d12: 0
    },
    
    createdAt: Date.now()
  };
  
  // 保存到存储
  saveDicePool(pool);
  
  return pool;
}

/**
 * 掷多个骰子
 * @param {number} sides - 骰子面数
 * @param {number} count - 骰子数量
 * @returns {number[]} 骰子结果数组
 */
function rollMultiple(sides, count) {
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(Math.floor(Math.random() * sides) + 1);
  }
  return results;
}
```

### 2. getDice() - 取用骰子

```javascript
/**
 * 从骰子池取用一枚骰子
 * @param {string} type - 骰子类型：'d20' | 'd4' | 'd6' | 'd8' | 'd10' | 'd12'
 * @returns {Object} { value: number, cycled: boolean }
 */
export function getDice(type) {
  const pool = loadDicePool();
  
  // 获取当前索引
  const index = pool.indices[type];
  const diceArray = pool[type];
  
  // 取用骰子
  const value = diceArray[index];
  
  // 更新索引（循环）
  pool.indices[type] = (index + 1) % diceArray.length;
  
  // 更新总使用次数
  pool.totalUsed[type]++;
  
  // 判断是否循环
  const cycled = pool.totalUsed[type] > diceArray.length;
  
  // 保存状态
  saveDicePool(pool);
  
  return { value, cycled };
}

// 便捷访问函数
export function getD20() {
  return getDice('d20');
}

export function getD4() {
  return getDice('d4');
}

export function getD6() {
  return getDice('d6');
}

export function getD8() {
  return getDice('d8');
}

export function getD10() {
  return getDice('d10');
}

export function getD12() {
  return getDice('d12');
}
```

### 3. getMultipleDice() - 取用多枚骰子

```javascript
/**
 * 从骰子池取用多枚骰子（用于优势/劣势）
 * @param {string} type - 骰子类型
 * @param {number} count - 数量
 * @returns {Object[]} [{ value, cycled }, ...]
 */
export function getMultipleDice(type, count) {
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(getDice(type));
  }
  return results;
}

/**
 * 取用 2 枚 d20（用于优势/劣势）
 * @returns {Object} { values: number[], cycled: boolean }
 */
export function get2D20() {
  const results = getMultipleDice('d20', 2);
  return {
    values: results.map(r => r.value),
    cycled: results.some(r => r.cycled)
  };
}
```

### 4. peekDice() - 查看骰子池（调试用）

```javascript
/**
 * 查看骰子池剩余骰子（不消耗）
 * @param {string} type - 骰子类型
 * @param {number} count - 查看数量
 * @returns {number[]} 接下来 N 枚骰子的值
 */
export function peekDice(type, count = 5) {
  const pool = loadDicePool();
  const diceArray = pool[type];
  const startIndex = pool.indices[type];
  
  const results = [];
  for (let i = 0; i < count; i++) {
    const index = (startIndex + i) % diceArray.length;
    results.push(diceArray[index]);
  }
  
  return results;
}

/**
 * 查看骰子池完整状态（调试用）
 * @returns {Object} 骰子池状态摘要
 */
export function inspectDicePool() {
  const pool = loadDicePool();
  
  return {
    d20: {
      next5: peekDice('d20', 5),
      index: pool.indices.d20,
      totalUsed: pool.totalUsed.d20,
      cycled: pool.totalUsed.d20 > 15
    },
    d4: {
      next5: peekDice('d4', 5),
      index: pool.indices.d4,
      totalUsed: pool.totalUsed.d4
    },
    // ... 其他骰子类型
    createdAt: new Date(pool.createdAt).toLocaleString()
  };
}
```

### 5. resetDicePool() - 重置骰子池

```javascript
/**
 * 重置骰子池（重新掷所有骰子）
 * @param {boolean} userRequested - 是否用户主动要求
 * @returns {DicePoolState} 新的骰子池
 */
export function resetDicePool(userRequested = false) {
  if (userRequested) {
    console.log('🎲 用户要求重新掷骰池');
  }
  
  const newPool = initDicePool();
  
  // 触发事件（供 UI 监听）
  dispatchEvent(new CustomEvent('dice-pool-reset', {
    detail: { userRequested }
  }));
  
  return newPool;
}
```

### 6. 存储函数

```javascript
/**
 * 保存骰子池到 IndexedDB
 * @param {DicePoolState} pool - 骰子池状态
 */
function saveDicePool(pool) {
  // 使用 idb-storage.js
  const key = 'dice-pool';
  localStorage.setItem(key, JSON.stringify(pool));
}

/**
 * 从 IndexedDB 加载骰子池
 * @returns {DicePoolState} 骰子池状态
 */
function loadDicePool() {
  const key = 'dice-pool';
  const saved = localStorage.getItem(key);
  
  if (saved) {
    return JSON.parse(saved);
  }
  
  // 首次运行，初始化
  return initDicePool();
}

/**
 * 检查骰子池是否已初始化
 * @returns {boolean}
 */
export function isDicePoolInitialized() {
  const key = 'dice-pool';
  return localStorage.getItem(key) !== null;
}
```

---

## 🎨 输出格式设计

### 正常取用（无循环）
```javascript
const dice = getD20();
// { value: 15, cycled: false }

// 在检定输出中：
// <roll>15</roll>
```

### 循环取用
```javascript
// 第 16 次使用 d20
const dice = getD20();
// { value: 8, cycled: true }

// 在检定输出中：
// <roll>8（骰子池循环）</roll>
```

### 优势/劣势
```javascript
const dice = get2D20();
// { values: [12, 17], cycled: false }

// 在检定输出中：
// <rolls>12, 17</rolls>
// <selected>17</selected>
```

---

## 🧪 测试用例设计

### 测试场景 1：初始化
```javascript
// 测试：初始化骰子池
const pool = initDicePool();

// 验证：
// - d20 数组长度 = 15
// - d4 数组长度 = 10
// - 所有骰值在合法范围内（d20: 1-20）
// - 所有索引为 0
// - totalUsed 为 0
```

### 测试场景 2：依次取用
```javascript
// 测试：连续取用 3 枚 d20
const dice1 = getD20();
const dice2 = getD20();
const dice3 = getD20();

// 验证：
// - 取到的值不同（极小概率相同）
// - indices.d20 递增（0→1→2）
// - totalUsed.d20 = 3
// - 所有 cycled = false
```

### 测试场景 3：循环取用
```javascript
// 测试：连续取用 16 枚 d20
for (let i = 0; i < 16; i++) {
  const dice = getD20();
  console.log(`第 ${i+1} 次:`, dice);
}

// 验证：
// - 前 15 次: cycled = false
// - 第 16 次: cycled = true
// - 第 16 次的值 = 第 1 次的值（循环）
```

### 测试场景 4：优势取用
```javascript
// 测试：优势检定（取 2 枚）
const dice = get2D20();

// 验证：
// - values 数组长度 = 2
// - indices.d20 增加 2
// - totalUsed.d20 增加 2
```

### 测试场景 5：持久化
```javascript
// 测试：保存与加载
const dice1 = getD20();
// 刷新页面或重启应用
const dice2 = getD20();

// 验证：
// - dice2 是第 2 枚骰子（不是重新从第 1 枚开始）
// - indices.d20 = 2
```

### 测试场景 6：重置
```javascript
// 测试：重置骰子池
getD20(); // 第 1 枚
getD20(); // 第 2 枚
resetDicePool(true);
const dice = getD20();

// 验证：
// - indices.d20 = 1（从头开始）
// - totalUsed.d20 = 1
// - 骰值不同（重新掷了）
```

---

## 📊 性能优化

### 1. 减少存储次数
```javascript
// 方案：使用节流（throttle）
let saveTimer = null;
function saveDicePoolThrottled(pool) {
  if (saveTimer) return;
  
  saveTimer = setTimeout(() => {
    localStorage.setItem('dice-pool', JSON.stringify(pool));
    saveTimer = null;
  }, 100); // 100ms 内只保存一次
}
```

### 2. 缓存骰子池
```javascript
// 方案：模块级缓存
let cachedPool = null;

function loadDicePool() {
  if (cachedPool) {
    return cachedPool;
  }
  
  const saved = localStorage.getItem('dice-pool');
  if (saved) {
    cachedPool = JSON.parse(saved);
    return cachedPool;
  }
  
  cachedPool = initDicePool();
  return cachedPool;
}
```

---

## 🚀 实现计划

### Phase 1：核心功能（1 小时）
- [ ] `initDicePool()` - 初始化
- [ ] `getDice()` - 取用单枚
- [ ] `getMultipleDice()` - 取用多枚
- [ ] 存储函数（saveDicePool/loadDicePool）

### Phase 2：便捷函数（30 分钟）
- [ ] `getD20()` / `getD4()` 等快捷函数
- [ ] `get2D20()` - 优势/劣势专用
- [ ] `resetDicePool()` - 重置

### Phase 3：调试工具（30 分钟）
- [ ] `peekDice()` - 查看接下来的骰子
- [ ] `inspectDicePool()` - 查看完整状态
- [ ] 骰子池可视化 UI

### Phase 4：测试（1 小时）
- [ ] 创建 `test-dice-pool.html`
- [ ] 6 个测试场景
- [ ] 边界测试

**预计总时间：3 小时**

---

## 📋 实现检查清单

### 必需功能
- [ ] ✅ 初始化骰子池（75 枚）
- [ ] ✅ 依次取用（不可跳选）
- [ ] ✅ 循环使用（用完重复）
- [ ] ✅ 持久化存储
- [ ] ✅ 循环标注（用于输出）

### 可选功能
- [ ] 🔧 查看接下来的骰子（调试）
- [ ] 🔧 骰子池可视化 UI
- [ ] 🔧 骰子池统计（平均值/分布）
- [ ] 🔧 手动编辑骰子池（作弊模式）

---

## ⚠️ 注意事项

### 1. 不要自动刷新
```javascript
// ❌ 错误：战斗结束自动刷新
function onCombatEnd() {
  resetDicePool(); // 不要这样做！
}

// ✅ 正确：只在明确要求时刷新
function onUserRequestReset() {
  resetDicePool(true);
}
```

### 2. 索引循环计算
```javascript
// 正确的循环逻辑
const nextIndex = (currentIndex + 1) % arrayLength;

// 示例：
// currentIndex = 14, arrayLength = 15
// nextIndex = (14 + 1) % 15 = 0 (循环回第一个)
```

### 3. 持久化时机
```javascript
// 每次取用后立即保存（或使用节流）
function getDice(type) {
  // ... 取用逻辑
  saveDicePool(pool); // 立即保存
  return { value, cycled };
}
```

---

## 🎯 关键设计决策

### 1. 为什么用数组而不是队列？
- **数组更简单**：直接通过索引访问
- **支持查看**：可以 peek 接下来的骰子
- **支持循环**：用模运算实现循环

### 2. 为什么需要 totalUsed？
- **判断是否循环**：totalUsed > arrayLength
- **统计用途**：了解骰子池使用频率
- **调试信息**：显示"这是第几次使用"

### 3. 为什么分离 getDice() 和 getD20()？
- **getDice() 通用**：处理所有骰子类型
- **getD20() 便捷**：调用时更简洁
- **类型安全**：getD20() 不需要传参数

---

## 📚 相关文档

| 文档 | 路径 | 说明 |
|------|------|------|
| **设计文档** | docs/DICE-POOL-DESIGN.md | 本文档 |
| **源规则** | data-source/世界书/系统/骰子池.txt | 官方规则 |
| **检定规则** | data-source/世界书/检定/通用检定.yaml | 骰子使用场景 |

---

**下一步**：开始实现 `module/dice-pool.js`
