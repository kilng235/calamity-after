# UI界面系统设计文档

> 设计时间：2026-09-02 23:00  
> 完成时间：2026-09-02 23:45  
> 风格参考：start-screen.html（羊皮纸+皮革+金色装饰+火光粒子）  
> 优先级：**最高**  
> 状态：✅ **已完成（注册+主游戏界面）**

---

## 📋 系统概述

### 核心界面
```
✅ 1. 注册界面（角色创建）- start-screen.html
✅ 2. 主游戏界面（核心玩法）- game.html
⏳ 3. 设置界面（AI配置）- settings.html（待开发）
```

### 设计风格
```
- 废土/中世纪混搭
- 羊皮纸质感
- 皮革书封面
- 金色装饰
- 火光粒子效果
- 烛光摇曳动画
```

---

## 🎨 视觉设计规范

### 色彩变量
```css
:root {
  /* 羊皮纸 */
  --parchment: #d8c8a0;
  --parchment-dark: #c4b088;
  --parchment-light: #e8dcc0;
  
  /* 墨水 */
  --ink: #2a1e10;
  --ink-light: #4a3820;
  --ink-faded: #6a5838;
  
  /* 金色 */
  --gold: #b8942a;
  --gold-bright: #d4aa38;
  --gold-glow: rgba(184,148,42,0.3);
  --gold-light: #e8c860;
  
  /* 皮革 */
  --leather: #3a2818;
  --leather-dark: #2a1c10;
  --leather-light: #5a4028;
  
  /* 功能色 */
  --red-ink: #8a2a1a;
  --blue-ink: #1a3a6a;
  --danger: #8a2a1a;
}
```

### 背景效果
```css
body {
  background: #1a1510;
  /* 底部火光映照 */
  background-image:
    radial-gradient(ellipse 80% 40% at 50% 110%, rgba(180,80,30,0.15) 0%, transparent 60%),
    radial-gradient(ellipse 60% 30% at 50% 100%, rgba(200,120,40,0.08) 0%, transparent 70%);
}

/* 余烬粒子层 */
body::before {
  animation: emberDrift 20s ease-in-out infinite alternate;
}
```

---

## 📱 界面架构

### 1. 注册界面（Character Creation）

```
┌─────────────────────────────────────┐
│   皮革书封面                          │
│  ┌───────────────────────────┐      │
│  │  羊皮纸页面                 │      │
│  │                            │      │
│  │  ✦ 灾厄之后·登记 ✦         │      │
│  │                            │      │
│  │  角色姓名：[_________]      │      │
│  │                            │      │
│  │  六维属性分配：            │      │
│  │  力量：[14] [+] [-]        │      │
│  │  敏捷：[16] [+] [-]        │      │
│  │  体质：[12] [+] [-]        │      │
│  │  智力：[10] [+] [-]        │      │
│  │  感知：[13] [+] [-]        │      │
│  │  魅力：[15] [+] [-]        │      │
│  │                            │      │
│  │  剩余点数：27              │      │
│  │                            │      │
│  │  背景故事：               │      │
│  │  [文本框...]              │      │
│  │                            │      │
│  │  [开始冒险]               │      │
│  └───────────────────────────┘      │
└─────────────────────────────────────┘
```

### 2. 主游戏界面（Main Game）

```
┌─────────────────────────────────────────────┐
│ 顶部状态栏                                    │
│ HP: ████████░░ 30/30  金币: 58  命运点: 3/3  │
├─────────────────────────────────────────────┤
│                                             │
│  左侧面板        中间正文区域       右侧面板  │
│  ┌────────┐    ┌──────────┐     ┌────────┐ │
│  │角色信息 │    │          │     │快捷操作 │ │
│  │        │    │ 正文显示  │     │        │ │
│  │六维属性 │    │          │     │攻击    │ │
│  │        │    │ 战斗日志  │     │检定    │ │
│  │装备栏  │    │          │     │背包    │ │
│  │        │    │          │     │        │ │
│  │背包    │    │          │     │战斗信息 │ │
│  └────────┘    └──────────┘     └────────┘ │
│                                             │
├─────────────────────────────────────────────┤
│ 底部输入栏                                    │
│ [输入文本...] [发送] [骰子] [设置]           │
└─────────────────────────────────────────────┘
```

### 3. 设置界面（Settings）

```
┌─────────────────────────────────────┐
│   皮革书封面                          │
│  ┌───────────────────────────┐      │
│  │  羊皮纸页面                 │      │
│  │                            │      │
│  │  ✦ 游戏设置 ✦              │      │
│  │                            │      │
│  │  【AI配置】                │      │
│  │  API类型：                 │      │
│  │  ○ SillyTavern            │      │
│  │  ○ OpenAI API             │      │
│  │  ○ Claude API             │      │
│  │  ○ 本地API                │      │
│  │                            │      │
│  │  API密钥：                 │      │
│  │  [________________________] │      │
│  │                            │      │
│  │  模型选择：                │      │
│  │  [下拉选择...]             │      │
│  │                            │      │
│  │  【预设管理】              │      │
│  │  系统提示词：              │      │
│  │  [文本框...]              │      │
│  │                            │      │
│  │  【显示设置】              │      │
│  │  ☑ 显示标签               │      │
│  │  ☑ 美化模式               │      │
│  │  ☑ 粒子效果               │      │
│  │                            │      │
│  │  [保存] [返回]             │      │
│  └───────────────────────────┘      │
└─────────────────────────────────────┘
```

---

## 🔧 技术实现

### 实际文件结构
```
灾厄之后-独立版/
├── start-screen.html    // 注册界面（角色创建）✅
├── game.html            // 主游戏界面 ✅
├── settings.html        // 设置界面 ⏳
├── module/
│   ├── dice-pool.js
│   ├── check-system.js
│   ├── game-state.js
│   ├── equipment-system.js
│   ├── creature-system.js
│   ├── combat-system.js
│   ├── narrative-system.js
│   └── ai-service.js    // ⏳ 待创建
└── docs/
    └── UI界面系统设计.md
```

**说明：**
- 所有样式内联在 HTML 中（无单独 CSS 文件）
- 直接使用 ES6 模块导入
- 数据存储使用 localStorage

### 页面切换
```javascript
// scene-manager.js
class SceneManager {
  static scenes = {
    register: 'register.html',
    mainGame: 'index.html',
    settings: 'settings.html'
  };
  
  static switchTo(sceneName) {
    window.location.href = this.scenes[sceneName];
  }
}
```

---

## 📊 实现进度

### Phase 1：注册界面 ✅ **已完成**
```
✅ 基础布局（皮革+羊皮纸）
✅ 世界观介绍页（翻页效果）
✅ 角色姓名输入
✅ 性别、年龄、种族选择
✅ 六维属性分配（滑块+点数池）
✅ 特质面板显示
✅ 背景故事生成
✅ 数据存储到 localStorage
✅ 跳转到主界面
✅ 金色粒子效果
✅ 烛光摇曳动画
```

**文件：** `start-screen.html`（38KB，833行）  
**风格：** 完全使用原版开场白界面的 UI 风格

### Phase 2：主游戏界面 ✅ **已完成**
```
✅ 三栏布局（左280px | 中间自适应 | 右280px）
✅ 顶部状态栏（HP条、金币、命运点）
✅ 左侧角色面板
  ✅ 角色信息（种族、等级、经验）
  ✅ 六维属性（含调整值）
  ✅ 装备栏
  ✅ 背包
✅ 中间正文显示区
  ✅ 滚动查看历史
  ✅ 正文格式化显示
  ✅ 欢迎消息
✅ 右侧操作面板
  ✅ 快捷操作按钮
  ✅ 战斗信息显示
✅ 底部输入栏
  ✅ 文本输入
  ✅ 发送按钮
  ✅ 骰子按钮
  ✅ Enter 快捷发送
✅ 集成现有系统
  ✅ game-state
  ✅ narrative-system
  ✅ combat-system
  ✅ check-system
✅ 功能演示
  ✅ 自动战斗演示
  ✅ 快捷检定
  ✅ 实时状态更新
```

**文件：** `game.html`（17KB，420行）  
**风格：** 羊皮纸+皮革混搭，三栏布局

### Phase 3：设置界面 ⏳ **待开发**
```
⏳ AI配置表单
⏳ API密钥输入
⏳ 预设管理
⏳ 显示设置
⏳ 保存到 localStorage
```

**预计时间：** 1天

---

## 🎮 交互设计

### 注册界面交互
```
1. 姓名输入
   - 自动聚焦
   - 字符限制（2-10字）
   - 实时验证

2. 属性分配
   - 点击 [+] 增加1点
   - 点击 [-] 减少1点
   - 总点数27点
   - 每项范围 8-18

3. 背景故事
   - 可选填写
   - 字数提示

4. 开始冒险
   - 验证必填项
   - 保存角色数据
   - 跳转主界面
```

### 主界面交互
```
1. 正文区域
   - 滚动查看历史
   - 三种显示模式切换

2. 左侧面板
   - 查看角色信息
   - 管理装备
   - 打开背包

3. 右侧面板
   - 快捷操作按钮
   - 战斗信息显示

4. 底部输入
   - 输入文本
   - 发送消息
   - 快捷骰子
```

---

## 🎨 动画效果

### 页面切换动画
```css
@keyframes pageOpen {
  0% {
    opacity: 0;
    transform: rotateY(-5deg) scale(0.97);
  }
  100% {
    opacity: 1;
    transform: rotateY(0) scale(1);
  }
}
```

### 烛光摇曳
```css
@keyframes candleFlicker {
  0%, 100% {
    opacity: 0.7;
    transform: scale(1);
  }
  20% {
    opacity: 0.9;
    transform: scale(1.02) translateY(-1px);
  }
  40% {
    opacity: 0.6;
    transform: scale(0.98) translateY(1px);
  }
}
```

### 余烬漂移
```css
@keyframes emberDrift {
  0% {
    transform: translateY(0) translateX(0);
  }
  100% {
    transform: translateY(-20px) translateX(10px);
  }
}
```

---

## 💾 数据存储

### LocalStorage 结构
```javascript
{
  // 角色数据
  character: {
    name: "凛夏",
    attributes: {
      力量: 14,
      敏捷: 16,
      体质: 12,
      智力: 10,
      感知: 13,
      魅力: 15
    },
    hp: { current: 30, max: 30 },
    gold: 50,
    exp: 0,
    level: 1
  },
  
  // 游戏进度
  gameState: {
    time: { year: 303, month: 5, day: 12, hour: 14, minute: 30 },
    location: "铁匠镇",
    inventory: [],
    equipment: {}
  },
  
  // 设置
  settings: {
    aiType: "SillyTavern",
    apiKey: "",
    model: "gpt-4",
    displayMode: "beautified",
    showTags: true,
    showParticles: true
  },
  
  // 对话历史
  chatHistory: []
}
```

---

## 🔌 AI集成接口

### AI服务抽象层
```javascript
// ai-service.js
class AIService {
  static async sendMessage(message) {
    const settings = this.getSettings();
    
    switch (settings.aiType) {
      case 'SillyTavern':
        return await this.sendToST(message);
      case 'OpenAI':
        return await this.sendToOpenAI(message);
      case 'Claude':
        return await this.sendToClaude(message);
      default:
        return await this.sendToLocal(message);
    }
  }
  
  static async sendToST(message) {
    // SillyTavern集成
  }
  
  static async sendToOpenAI(message) {
    // OpenAI API集成
  }
}
```

---

---

## ✅ 实际完成功能

### start-screen.html（注册界面）

#### 视觉效果
```
✅ 皮革书封面
✅ 羊皮纸质感
✅ 金色装饰边框
✅ 手抄本双层边框
✅ 角饰装饰（❧）
✅ 火光粒子效果（Canvas）
✅ 烛光摇曳动画
✅ 页面翻开动画
✅ 按钮涟漪效果
```

#### 功能模块
```
✅ 双页结构
  - Page 1: 世界观介绍
  - Page 2: 角色登记表单
✅ 完整角色创建
  - 姓名输入
  - 性别选择（男/女/其他）
  - 年龄输入（16-80）
  - 种族选择（8种：人类/矮人/精灵/羊人/虎族/犬人/灵耳族/兔耳族）
  - 六维属性分配（滑块控制，点数池系统）
  - 特质面板（AC/负重/MP 自动计算）
✅ 背景档案生成
  - 自动生成格式化的角色档案
  - 显示在文本框中
✅ 数据保存
  - 保存到 localStorage
  - 跳转到 game.html
```

#### 交互体验
```
✅ 属性滑块实时更新
✅ 点数池颜色提示
✅ 种族提示信息
✅ 属性值闪烁动画
✅ 按钮悬停/点击效果
✅ 涟漪点击反馈
```

---

### game.html（主游戏界面）

#### 布局结构
```
Grid 布局：3列 × 3行
┌──────────────────────────────────┐
│  顶部状态栏 (60px)                │
├─────────┬────────────┬───────────┤
│ 左侧面板 │ 中间正文区  │ 右侧面板  │
│ (280px) │   (flex)   │ (280px)  │
│         │            │           │
├─────────┴────────────┴───────────┤
│  底部输入栏 (80px)                │
└──────────────────────────────────┘
```

#### 顶部状态栏
```
✅ 玩家姓名显示
✅ HP 条（动态颜色：绿/橙/红）
✅ 金币显示（💰）
✅ 命运点显示（⚡）
```

#### 左侧面板
```
✅ 角色信息区
  - 种族
  - 等级
  - 经验值
✅ 六维属性区
  - 属性值 + 调整值显示
  - Grid 2列布局
✅ 装备栏
  - 动态显示装备
  - 无装备时显示提示
✅ 背包
  - 物品列表
  - 空背包提示
```

#### 中间正文区
```
✅ 滚动显示区域
✅ 欢迎消息
✅ 正文格式化显示
✅ 自动滚动到底部
✅ 历史消息保留
```

#### 右侧面板
```
✅ 快捷操作按钮
  - ⚔ 开始战斗
  - 🎲 进行检定
  - 🎒 打开背包
  - ⚙ 设置
✅ 战斗信息显示
  - 当前战斗状态
  - 动态更新
```

#### 底部输入栏
```
✅ 文本输入框
✅ 发送按钮
✅ 骰子按钮（快捷掷骰）
✅ Enter 快捷发送
✅ 输入聚焦高亮
```

#### 核心功能
```
✅ 角色数据加载（从 localStorage）
✅ 实时状态更新
  - HP 条动态变化
  - 经验/金币同步
✅ 自动战斗演示
  - 创建战斗
  - 自动执行回合
  - 生成完整正文
  - 更新状态
  - 发放奖励
✅ 快捷检定
  - 执行检定
  - 显示结果
✅ 消息显示
  - 玩家输入显示
  - 系统消息显示
✅ 模块集成
  - game-state.js
  - narrative-system.js
  - combat-system.js
  - check-system.js
```

---

## 🎨 视觉风格统一

### 色彩系统
```css
羊皮纸：#d8c8a0 ~ #e8dcc0
墨水：  #2a1e10 ~ #6a5838
金色：  #b8942a ~ #e8c860
皮革：  #2a1c10 ~ #5a4028
```

### 动画效果
```
✅ 页面打开动画（rotateY + scale）
✅ 烛光摇曳（opacity + scale 循环）
✅ 余烬漂移（translateY + translateX）
✅ 金色粒子（Canvas 实时渲染）
✅ 按钮涟漪（radial-gradient 扩散）
✅ 属性闪烁（scale 脉冲）
✅ 悬停效果（transform + box-shadow）
```

---

## 📊 数据流程

### 角色创建流程
```
1. 用户访问 start-screen.html
2. 填写角色信息
3. 点击"铭刻档案并发送"
4. JavaScript 收集表单数据
5. 保存到 localStorage.character
6. 1秒后跳转到 game.html
```

### 游戏初始化流程
```
1. game.html 加载
2. 从 localStorage 读取 character
3. 如果没有数据 → 重定向到 start-screen.html
4. 初始化游戏状态
5. 更新 UI 显示
6. 显示欢迎消息
7. 等待玩家操作
```

### 战斗流程
```
1. 玩家点击"开始战斗"
2. 创建战斗实例（combatSystem.startCombat）
3. 自动执行战斗回合（100ms 间隔）
4. 生成战斗正文（narrativeSystem）
5. 显示在正文区
6. 更新 HP/经验/金币
7. 保存到 localStorage
```

---

## 🔌 模块集成示例

### game.html 中的导入
```javascript
import * as gameState from './module/game-state.js';
import * as narrativeSystem from './module/narrative-system.js';
import * as combatSystem from './module/combat-system.js';
import * as checkSystem from './module/check-system.js';
```

### 自动战斗实现
```javascript
window.quickBattle = function() {
  const character = JSON.parse(localStorage.getItem('character'));
  const combat = combatSystem.startCombat(character, ['灰烬狼']);
  
  const interval = setInterval(() => {
    if (combat.status !== 'active') {
      clearInterval(interval);
      
      // 生成正文
      const narrative = narrativeSystem.generateCombatNarrative(combat);
      displayNarrative(narrative);
      
      // 更新状态
      updateHPBar(combat.player.hp.current, combat.player.hp.max);
      
      // 发放奖励
      character.exp += combat.rewards.exp;
      character.gold += combat.rewards.gold;
      localStorage.setItem('character', JSON.stringify(character));
      
      return;
    }
    
    // 执行玩家回合
    const actor = combatSystem.getCurrentActor(combat);
    if (actor.type === 'player') {
      const targets = combatSystem.getAliveEnemies(combat);
      combatSystem.playerAttack(combat, targets[0].id, 'mainHand');
    }
  }, 100);
};
```

---

## 📈 性能优化

### 已实现
```
✅ CSS 内联（减少请求）
✅ ES6 模块化（按需加载）
✅ Canvas 粒子优化（requestAnimationFrame）
✅ 滚动条美化（Webkit）
✅ 事件委托（减少监听器）
```

---

## 🧪 测试清单

### 注册界面测试
```
✅ 页面加载正常
✅ 世界观文字显示
✅ 翻页动画流畅
✅ 属性滑块可拖动
✅ 点数池实时更新
✅ 种族提示正常
✅ 背景档案生成
✅ 保存并跳转成功
```

### 主界面测试
```
✅ 角色数据正确显示
✅ HP 条颜色正常
✅ 属性调整值计算正确
✅ "开始战斗"功能正常
  ✅ 战斗正文生成
  ✅ HP 更新
  ✅ 经验和金币更新
✅ "进行检定"功能正常
  ✅ 检定正文生成
✅ 输入框发送正常
✅ 骰子功能正常
```

---

## 🎯 下一步开发

### Phase 3：设置界面（1天）
```
⏳ 创建 settings.html
⏳ AI 配置表单
  - API 类型选择
  - API 密钥输入
  - 模型选择
⏳ 预设管理
  - 系统提示词
  - 角色设定
⏳ 显示设置
  - 正文显示模式
  - 粒子效果开关
⏳ 保存功能
```

### Phase 4：AI 集成（2天）
```
⏳ 创建 ai-service.js
⏳ SillyTavern 集成
⏳ OpenAI API 集成
⏳ Claude API 集成
⏳ 意图识别系统
⏳ 世界书引擎
```

### Phase 5：完善功能（1-2天）
```
⏳ 背包系统完善
⏳ 装备管理界面
⏳ 手动战斗控制
⏳ 保存/加载游戏
⏳ 音效系统（可选）
```

---

## ✅ 完成总结

**UI 界面系统完成度：67%（2/3）**

✅ **已完成：**
- start-screen.html（注册界面）
- game.html（主游戏界面）

⏳ **待开发：**
- settings.html（设置界面）

**总代码量：** ~55KB（start-screen 38KB + game 17KB）  
**总行数：** ~1250行

**所有核心功能已就绪，可以开始游戏！** 🎮✨

---

**文档更新完成！** 📝✨  
**最后更新时间：2026-09-02 23:50**
