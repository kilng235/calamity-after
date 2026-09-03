# 装备系统更新日志

> 版本：1.1.0  
> 更新时间：2026-09-02 21:30

---

## ✅ v1.1.0 - 双持系统

### 新增功能

#### 1. 双持战斗系统
```javascript
// 双持检测
isDualWielding() → boolean

// 双持信息
getDualWieldInfo() → { mainHand, offHand, canAttackWithBoth }

// 主手攻击（正常伤害）
rollWeaponDamage(attributes, false)
// 伤害 = 骰值 + 材料加成 + 力量调整值

// 副手攻击（不加属性）
rollWeaponDamage(attributes, true)
// 伤害 = 骰值 + 材料加成 + 0（DND 5E 规则）
```

#### 2. 装备限制检查
```
✅ 主手必须有单手武器
✅ 主手不能是双手武器
✅ 副手必须是单手武器
✅ 副手不能是远程武器
✅ 装备副手时自动检查双持条件
```

#### 3. 耐久系统更新
```javascript
// 支持主手/副手耐久损耗
damageWeaponDurability(criticalFailure, useOffHand)
```

---

## 📊 双持机制

### DND 5E 规则
```
1. 主手攻击（动作）
   - 伤害骰 + 属性调整值

2. 副手攻击（附赠动作）
   - 伤害骰 + 0（不加属性）
   
3. 武器限制
   - 双方都是单手近战武器
   - 副手武器必须是"轻型"（简化：允许所有单手）
```

### 灾厄实现
```
✅ 完全符合 DND 5E 核心规则
✅ 简化了"轻型"武器限制
✅ 副手攻击不加属性调整值
✅ 双持时无命中惩罚
```

---

## 🎮 使用示例

### 装备双持
```javascript
// 1. 创建主手武器
const mainSword = createWeapon('废土短刃', 1);
equipItem(mainSword);

// 2. 创建副手武器
const offDagger = createWeapon('废土匕首', 1);
equipItem(offDagger);

// 3. 检查双持状态
if (isDualWielding()) {
  console.log('✓ 双持激活');
}
```

### 双持攻击
```javascript
// 主手攻击
const mainDamage = rollWeaponDamage(attributes, false);
// 例：1d6 + 0 + 2 = 3-8 伤害

// 副手攻击
const offDamage = rollWeaponDamage(attributes, true);
// 例：1d4 + 0 + 0 = 1-4 伤害

// 总伤害
const total = mainDamage.damage + offDamage.damage;
```

---

## 📈 双持优劣势

### 优势
```
✅ 攻击次数 ×2
✅ 总伤害输出更高
✅ 命中失败时有备用攻击
```

### 劣势
```
❌ 副手攻击不加属性
❌ 无法装备盾牌（失去 +2 AC）
❌ 两把武器都会损耗耐久
```

---

## 🔄 v1.0.0 → v1.1.0 变更

### 新增 API
```javascript
// 新增函数
+ isDualWielding()
+ getDualWieldInfo()
+ checkDualWieldRequirements()

// 修改函数
~ rollWeaponDamage(attributes, useOffHand)
~ damageWeaponDurability(criticalFailure, useOffHand)
~ equipItem() - 增加双持检查
```

### 兼容性
```
✅ 向后兼容
✅ 旧代码无需修改
✅ rollWeaponDamage() 默认主手攻击
```

---

## 🧪 测试功能

### 新增测试按钮
```
🗡️ 主手攻击 - 测试主手伤害
🔪 副手攻击 - 测试副手伤害（不加属性）
⚔️ 双持攻击 - 测试主+副总伤害
```

### 双持状态显示
```
⚔️ 双持模式激活
主手：废土短刃
副手：废土匕首
ℹ️ 主手攻击加属性调整，副手攻击不加属性调整
```

---

## 📋 未来扩展

### 可选功能（以后）
```
1. 轻型武器属性
   - 只有轻型武器才能双持
   
2. 双武器战斗专长
   - 副手攻击也加属性调整值
   
3. 双持技能
   - 旋风斩：同时攻击两个目标
   - 连击：两次都命中时额外伤害
```

---

## ✅ 完成清单

- [x] 双持装备检查
- [x] 双持攻击（主手/副手）
- [x] 副手攻击不加属性
- [x] 双持状态检测
- [x] 双手武器冲突检测
- [x] 远程武器限制
- [x] 双持耐久损耗
- [x] 测试页面更新
- [x] 设计文档

---

**双持系统完成！完全符合 DND 5E 规则，简化了部分限制以提升游戏体验。** ⚔️
