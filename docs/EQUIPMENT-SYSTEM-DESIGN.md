# 装备系统设计文档

> 设计时间：2026-09-02 20:00  
> 基于：灾厄之后·重制版 装备规则  
> 优先级：**极高**（战斗系统的前置依赖）

---

## 📋 需求分析

### 核心规则（来自源文件）

#### 1. 装备分类

**武器（14 种）**
```
近战：匕首(d4)、短剑(d6)、铁剑(d8)、双手剑(d10)、战斧(d8)、战锤(d8)
远程：猎弓(d6)、长弓(d8)、轻弩(d8)、重弩(d12)
特殊：法杖(d4)、短矛(d6)
```

**护甲（10 种）**
```
轻甲：皮甲(AC+2)
中甲：锁甲(AC+4)
重甲：板甲(AC+6)
部件：头盔、手套、护腿、肩甲、铁靴、盾牌、全罩盔
```

**槽位系统**
```
主手 - 武器
副手 - 盾牌/双持武器
身体 - 护甲
头部 - 头盔
手部 - 手套
腿部 - 护腿
脚部 - 铁靴
肩部 - 肩甲
饰品 - 护符/戒指
```

#### 2. 材料档位系统

**四档材料（影响伤害和 AC）**
```
一阶（铁/兽皮）
  - 武器：基础伤害（1d8）
  - 护甲：基础 AC（+2）
  - 价格：×1.0

二阶（精铁/骨白岩）
  - 武器：+1 伤害（1d8+1）
  - 护甲：+1 AC（+3）
  - 价格：×2.5

三阶（秘银/龙骨化石）
  - 武器：升档+1（1d10+1）
  - 护甲：+2 AC（+4）
  - 价格：×10.0

灾厄（黑曜铁/血晶石/星铁）
  - 武器：升档+2（1d10+2）
  - 护甲：+3 AC（+5）
  - 价格：×50.0
  - 副作用：黑曜铁有诅咒
```

#### 3. 装备属性

**基础属性**
- 名称
- 类型（武器/护甲）
- 槽位
- 材料档位
- 伤害骰（武器）/ AC 加成（护甲）
- 重量（轻/中/重）
- 耐久（当前/上限）
- 价格

**词缀系统（可选）**
- 品质词缀（普通/精良/卓越/传奇）
- 属性词缀（+力量/+敏捷等）
- 特效词缀（吸血/穿刺/火焰等）

#### 4. 耐久系统

```javascript
// 武器耐久
每次命中：-1
大失败：-5

// 护甲耐久
被命中：-伤害值
破损（1-50%）：AC -1
报废（0）：无防护
```

---

## 🏗️ 模块架构设计

### 核心职责

```
equipment-system.js
├── 装备数据定义（武器/护甲模板）
├── 装备创建（根据材料生成装备）
├── 装备管理（穿戴/卸下/切换）
├── 耐久系统（损耗/修复）
├── 背包系统（添加/移除/查找）
└── 装备效果计算（伤害/AC/调整值）
```

---

## 🔧 核心数据结构

### 装备对象
```javascript
Equipment {
  id: string,              // 唯一 ID
  name: string,            // 名称（"精铁铁剑"）
  type: 'weapon' | 'armor',
  category: string,        // 武器类型/护甲类型
  slot: string,            // 槽位（'mainHand', 'body'等）
  
  // 材料
  material: {
    tier: 1 | 2 | 3 | 4,   // 一阶/二阶/三阶/灾厄
    name: string,          // 材料名称
    price: number          // 材料价格
  },
  
  // 武器属性
  weapon: {
    damageBase: number,    // 基础骰子面数（8 = d8）
    damageBonus: number,   // 材料加成（+0/+1/+2）
    damageType: string,    // 伤害类型（劈砍/穿刺）
    speed: string,         // 攻速（快/中/慢）
    twoHanded: boolean     // 是否双手
  },
  
  // 护甲属性
  armor: {
    acBonus: number,       // AC 加成
    weight: string,        // 重量（轻/中/重）
    stealthPenalty: boolean // 潜行劣势
  },
  
  // 耐久
  durability: {
    current: number,
    max: number
  },
  
  // 价格
  price: number,
  
  // 词缀（可选）
  affixes: [],
  
  // 特殊效果（可选）
  effects: []
}
```

### 装备槽位
```javascript
EquipmentSlots {
  mainHand: Equipment | null,
  offHand: Equipment | null,
  body: Equipment | null,
  head: Equipment | null,
  hands: Equipment | null,
  legs: Equipment | null,
  feet: Equipment | null,
  shoulders: Equipment | null,
  accessory1: Equipment | null,
  accessory2: Equipment | null
}
```

### 背包
```javascript
Inventory {
  items: Equipment[],
  maxSlots: number,        // 背包容量
  gold: number             // 金钱
}
```

---

## 📊 武器模板数据

```javascript
WEAPON_TEMPLATES = {
  '匕首': {
    category: 'dagger',
    slot: 'mainHand',
    damageBase: 4,         // d4
    damageType: '穿刺',
    speed: '快',
    twoHanded: false,
    basePrice: 5
  },
  
  '短剑': {
    category: 'shortsword',
    slot: 'mainHand',
    damageBase: 6,         // d6
    damageType: '劈砍',
    speed: '快',
    twoHanded: false,
    basePrice: 10
  },
  
  '铁剑': {
    category: 'longsword',
    slot: 'mainHand',
    damageBase: 8,         // d8
    damageType: '劈砍/穿刺',
    speed: '中',
    twoHanded: false,
    basePrice: 15
  },
  
  '双手剑': {
    category: 'greatsword',
    slot: 'mainHand',
    damageBase: 10,        // d10
    damageType: '劈砍',
    speed: '慢',
    twoHanded: true,
    basePrice: 30
  },
  
  // ... 其他武器
}
```

---

## 🎯 核心函数设计

### 1. 创建装备
```javascript
/**
 * 创建武器
 * @param {string} weaponType - 武器类型（'铁剑'）
 * @param {number} materialTier - 材料档位（1-4）
 * @returns {Equipment} 装备对象
 */
function createWeapon(weaponType, materialTier = 1) {
  const template = WEAPON_TEMPLATES[weaponType];
  const material = MATERIALS[materialTier];
  
  // 计算伤害加成
  const damageBonus = calculateDamageBonus(materialTier);
  const upgradedDice = upgradeDice(template.damageBase, materialTier);
  
  return {
    id: generateId(),
    name: `${material.name}${weaponType}`,
    type: 'weapon',
    category: template.category,
    slot: template.slot,
    material: {
      tier: materialTier,
      name: material.name,
      price: material.price
    },
    weapon: {
      damageBase: upgradedDice,
      damageBonus: damageBonus,
      damageType: template.damageType,
      speed: template.speed,
      twoHanded: template.twoHanded
    },
    durability: {
      current: 80,
      max: 80
    },
    price: template.basePrice * material.priceMultiplier
  };
}
```

### 2. 穿戴装备
```javascript
/**
 * 穿戴装备
 * @param {Equipment} equipment - 装备
 * @returns {boolean} 是否成功
 */
function equipItem(equipment) {
  const slot = equipment.slot;
  
  // 卸下旧装备
  const oldEquipment = equippedSlots[slot];
  if (oldEquipment) {
    unequipItem(slot);
  }
  
  // 穿戴新装备
  equippedSlots[slot] = equipment;
  
  // 从背包移除
  removeFromInventory(equipment.id);
  
  return true;
}
```

### 3. 计算总 AC
```javascript
/**
 * 计算角色总 AC
 * @returns {number} AC 值
 */
function calculateTotalAC() {
  let baseAC = 10;  // 基础 AC
  
  // 护甲加成
  const bodyArmor = equippedSlots.body;
  if (bodyArmor) {
    baseAC += bodyArmor.armor.acBonus;
  }
  
  // 盾牌加成
  const shield = equippedSlots.offHand;
  if (shield && shield.category === 'shield') {
    baseAC += shield.armor.acBonus;
  }
  
  // 敏捷调整值（轻甲/中甲可加）
  const dexMod = calculateModifier(attributes.敏捷);
  if (!bodyArmor || bodyArmor.armor.weight === '轻') {
    baseAC += dexMod;
  } else if (bodyArmor.armor.weight === '中') {
    baseAC += Math.min(dexMod, 2);  // 中甲最多+2
  }
  // 重甲不加敏捷
  
  return baseAC;
}
```

### 4. 计算武器伤害
```javascript
/**
 * 掷武器伤害
 * @param {Equipment} weapon - 武器
 * @returns {number} 伤害值
 */
function rollWeaponDamage(weapon) {
  // 掷伤害骰
  const diceType = `d${weapon.weapon.damageBase}`;
  const roll = getDice(diceType).value;
  
  // 材料加成
  const bonus = weapon.weapon.damageBonus;
  
  // 力量调整值
  const strMod = calculateModifier(attributes.力量);
  
  return roll + bonus + strMod;
}
```

### 5. 耐久损耗
```javascript
/**
 * 武器耐久损耗
 * @param {Equipment} weapon - 武器
 * @param {boolean} criticalFailure - 是否大失败
 */
function damageWeaponDurability(weapon, criticalFailure = false) {
  const damage = criticalFailure ? 5 : 1;
  weapon.durability.current = Math.max(0, weapon.durability.current - damage);
  
  // 损坏提示
  if (weapon.durability.current === 0) {
    console.log(`⚠️ ${weapon.name}已损坏！`);
  } else if (weapon.durability.current < weapon.durability.max * 0.2) {
    console.log(`⚠️ ${weapon.name}耐久度过低（${weapon.durability.current}/${weapon.durability.max}）`);
  }
}
```

---

## 🧪 测试计划

### 测试场景

**场景 1：创建装备**
```javascript
// 创建一把铁剑（一阶材料）
const ironSword = createWeapon('铁剑', 1);
// 预期：名称="铁铁剑"，伤害=1d8，价格=15金

// 创建一把精铁铁剑（二阶材料）
const steelSword = createWeapon('铁剑', 2);
// 预期：名称="精铁铁剑"，伤害=1d8+1，价格=37.5金
```

**场景 2：穿戴装备**
```javascript
// 穿戴武器
equipItem(ironSword);
// 预期：主手装备铁剑，背包移除

// 创建护甲
const leatherArmor = createArmor('皮甲', 1);
equipItem(leatherArmor);
// 预期：身体装备皮甲
```

**场景 3：计算 AC**
```javascript
// 空手 AC
calculateTotalAC();  // 10 + 敏捷调整值

// 装备皮甲
equipItem(leatherArmor);
calculateTotalAC();  // 10 + 2(皮甲) + 敏捷调整值
```

**场景 4：掷伤害**
```javascript
// 使用铁剑攻击
rollWeaponDamage(ironSword);
// 预期：1d8 + 力量调整值
```

**场景 5：耐久损耗**
```javascript
// 正常损耗
damageWeaponDurability(ironSword, false);
// 预期：耐久 80 → 79

// 大失败
damageWeaponDurability(ironSword, true);
// 预期：耐久 79 → 74
```

---

## 📦 实现计划

### Phase 1：数据定义（1 小时）
- [ ] 定义武器模板（14 种）
- [ ] 定义护甲模板（10 种）
- [ ] 定义材料数据（4 档）
- [ ] 定义装备数据结构

### Phase 2：核心功能（2 小时）
- [ ] `createWeapon()` - 创建武器
- [ ] `createArmor()` - 创建护甲
- [ ] `equipItem()` - 穿戴装备
- [ ] `unequipItem()` - 卸下装备
- [ ] `calculateTotalAC()` - 计算 AC
- [ ] `rollWeaponDamage()` - 掷伤害

### Phase 3：背包系统（1 小时）
- [ ] `addToInventory()` - 添加物品
- [ ] `removeFromInventory()` - 移除物品
- [ ] `getInventory()` - 获取背包
- [ ] `sortInventory()` - 整理背包

### Phase 4：耐久系统（30 分钟）
- [ ] `damageWeaponDurability()` - 武器损耗
- [ ] `damageArmorDurability()` - 护甲损耗
- [ ] `repairEquipment()` - 修理装备

### Phase 5：测试（1 小时）
- [ ] 创建测试页面
- [ ] 5 个测试场景
- [ ] 边界测试

**预计总时间：5.5 小时（1 天）**

---

## 🎯 关键设计决策

### 1. 为什么材料影响伤害？
- 符合 DND 规则（魔法武器 +1/+2/+3）
- 增加装备深度
- 给锻造系统留空间

### 2. 为什么分离模板和实例？
- 模板存储基础数据（不变）
- 实例存储具体装备（可变）
- 便于创建多个同类装备

### 3. 为什么用槽位系统？
- 限制装备数量
- 符合 RPG 惯例
- 易于 UI 展示

---

**当前状态**：设计完成，准备实现  
**预计完成时间**：今天晚上（5.5 小时）  
**下一步**：创建 `module/equipment-system.js`
