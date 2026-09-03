# UI 系统未来计划

> 创建时间：2026-09-02 23:55  
> 最后更新：2026-09-03（设置界面对标姬侠传补全：高级 AI 参数/测试消息/历史配置/Embedding）  
> 当前完成度：**45%**  
> 目标完成度：**100%（完整可玩游戏）**

---

## 📊 当前状态

### ✅ 已完成（30%）

#### 核心界面（20%）
```
✅ start-screen.html - 注册界面
   - 角色创建
   - 属性分配
   - 世界观介绍
   - 数据保存

✅ game.html - 主游戏界面（基础框架）
   - 三栏布局
   - 状态栏
   - 正文显示
   - 输入框
   - 快捷按钮
```

#### 功能演示（10%）
```
⚠️ 自动战斗演示（3%）
   - 只能自动战斗
   - 无法手动控制
   
⚠️ 快捷检定（3%）
   - 只能点按钮
   - 无法选择技能
   
⚠️ 状态显示（4%）
   - 只能查看
   - 无法操作
```

---

## 🎯 开发路线图

### Week 1：核心功能（Day 2-4）

#### Day 2（明天）：必需功能 → 60%
```
上午（2-3h）：
[x] 1. 设置界面（+10%）✅ 2026-09-03 完成，并对标姬侠传 config-modal.js 补全
    - settings.html（含 AI 配置/显示设置/游戏设置/向量化记忆四区）
    - AI 配置直接读写 jxz_apiConfig，与 module/api-service.js 对齐
    - 【对标补全】最大输出 Token / 上下文窗口 Token
    - 【对标补全】Top P / Top K / 频率惩罚 / 存在惩罚（带启用勾选，默认不发送）
    - 【对标补全】📨 发送测试消息（真实 LLM 调用 + 回复预览，调 apiService.sendTestMessage）
    - 【对标补全】⌘ 历史配置切换（保存最近 3 条，下拉回填，存 calamity_apiConfigHistory）
    - 【对标补全】Ⅳ. 向量化记忆配置（Embedding 地址/密钥/模型/Rerank/测试连接，读写 jxz_embeddingConfig）
    - 【对标补全】API Key 仅存本地的安全提示 + escapeHtml 转义
    - 显示设置存 localStorage.settings，game.html 加载时应用（粒子/烛光/字号）
    - 修复：game.html 调用不存在的 gameState.initializePlayer 导致 init 中断的旧 bug
    - 显示模式切换

下午（3-4h）：
[ ] 2. 手动战斗控制（+10%）
    - 敌人选择器
    - 行动按钮（攻击/物品/逃跑）
    - 武器选择（主手/副手/双持）
    - 实时战斗状态

晚上（2-3h）：
[ ] 3. 背包管理（+5%）
    - 背包弹窗
    - 物品列表
    - 使用/丢弃功能
    
[ ] 4. 装备管理（+5%）
    - 装备详情面板
    - 装备切换
    - 耐久显示
```

**Day 2 完成后：基础可玩 ✅**

---

#### Day 3：辅助功能 → 70%
```
上午（2h）：
[ ] 5. 保存/加载系统（+5%）
    - 存档列表
    - 保存/加载
    - 删除存档
    
[ ] 6. 游戏菜单（+3%）
    - ESC 菜单
    - 继续/保存/退出

下午（3h）：
[ ] 7. 战斗 UI 优化（+2%）
    - 战斗动画
    - 伤害数字飘字
    - 音效（可选）
```

---

#### Day 4：AI 集成 → 80%
```
全天（6-8h）：
[ ] 8. AI 服务接口（+10%）
    - ai-service.js
    - SillyTavern 集成
    - OpenAI API 集成
    - Claude API 集成
    - 意图识别系统
```

**Week 1 完成后：完整可玩 ✅**

---

### Week 2：扩展功能（Day 5-7）

#### Day 5：对话系统 → 85%
```
全天（6h）：
[ ] 9. NPC 对话界面（+5%）
    - 对话框
    - 选项按钮
    - 对话历史
    - NPC 头像（可选）
```

---

#### Day 6：任务+地图 → 95%
```
上午（3h）：
[ ] 10. 任务系统（+5%）
    - 任务列表面板
    - 任务详情
    - 任务追踪
    - 任务完成提示

下午（3h）：
[ ] 11. 地图系统（+5%）
    - 世界地图
    - 地点列表
    - 快速旅行
    - 当前位置标记
```

---

#### Day 7：技能树 → 100%
```
全天（6h）：
[ ] 12. 技能/天赋界面（+5%）
    - 技能树
    - 技能升级
    - 技能详情
    - 技能点分配
```

**Week 2 完成后：功能完整 ✅**

---

## 📋 详细功能清单

### 1. 设置界面（settings.html）

#### 布局设计
```
┌─────────────────────────────────────┐
│   皮革书封面                          │
│  ┌───────────────────────────┐      │
│  │  ⚙ 游戏设置                │      │
│  │                            │      │
│  │  【AI 配置】               │      │
│  │  API 类型：                │      │
│  │  ○ SillyTavern            │      │
│  │  ○ OpenAI API             │      │
│  │  ○ Claude API             │      │
│  │  ○ 本地 API               │      │
│  │                            │      │
│  │  API 密钥：[__________]    │      │
│  │  模型：[gpt-4 ▼]          │      │
│  │                            │      │
│  │  【显示设置】              │      │
│  │  正文模式：                │      │
│  │  ○ 原始格式               │      │
│  │  ● 美化格式               │      │
│  │  ○ 隐藏标签               │      │
│  │                            │      │
│  │  特效：                    │      │
│  │  ☑ 粒子效果               │      │
│  │  ☑ 烛光摇曳               │      │
│  │  ☐ 音效                   │      │
│  │                            │      │
│  │  【预设管理】              │      │
│  │  系统提示词：              │      │
│  │  [文本框...]              │      │
│  │                            │      │
│  │  [保存设置] [返回游戏]     │      │
│  └───────────────────────────┘      │
└─────────────────────────────────────┘
```

#### 数据结构
```javascript
localStorage.settings = {
  ai: {
    type: 'SillyTavern' | 'OpenAI' | 'Claude' | 'Local',
    apiKey: string,
    model: string,
    systemPrompt: string
  },
  display: {
    narrativeMode: 'raw' | 'beautified' | 'hidden',
    particles: boolean,
    candlelight: boolean,
    sound: boolean,
    fontSize: number
  },
  game: {
    autoSave: boolean,
    autoSaveInterval: number
  }
}
```

---

### 2. 手动战斗控制

#### 改造 game.html 右侧面板
```html
<div class="panel-section" id="combat-panel">
  <div class="panel-title">⚔ 战斗控制</div>
  
  <!-- 敌人选择器 -->
  <div class="enemy-selector">
    <div class="enemy-card selected">
      <div class="enemy-name">灰烬狼</div>
      <div class="enemy-hp-bar">
        <div class="hp-fill" style="width: 67%;"></div>
      </div>
      <div class="enemy-hp-text">16/24</div>
    </div>
  </div>
  
  <!-- 行动按钮 -->
  <div class="action-buttons">
    <button class="action-btn" onclick="attackMain()">
      🗡 主手攻击
    </button>
    <button class="action-btn" onclick="attackOff()">
      🗡 副手攻击
    </button>
    <button class="action-btn" onclick="attackDual()">
      ⚔ 双持攻击
    </button>
    <button class="action-btn" onclick="useItem()">
      🧪 使用物品
    </button>
    <button class="action-btn danger" onclick="flee()">
      🏃 逃跑
    </button>
  </div>
  
  <!-- 战斗信息 -->
  <div class="combat-info">
    <div>回合：第 2 回合</div>
    <div>当前：你的回合</div>
    <div>伤害：8 / 受击：5</div>
  </div>
</div>
```

#### 交互流程
```
1. 玩家点击"开始战斗"
   → 创建战斗
   → 显示敌人列表
   → 等待玩家选择

2. 玩家选择目标
   → 高亮选中的敌人

3. 玩家选择行动
   → 点击"主手攻击"
   → 执行攻击
   → 更新UI
   → 敌人回合（自动）
   → 回到玩家回合

4. 战斗结束
   → 显示结果
   → 发放奖励
   → 隐藏战斗面板
```

---

### 3. 背包管理

#### 弹窗设计
```html
<!-- 背包弹窗（模态框） -->
<div class="modal" id="inventory-modal">
  <div class="modal-content parchment-page">
    <div class="modal-header">
      <h3>🎒 背包</h3>
      <button class="close-btn" onclick="closeInventory()">✕</button>
    </div>
    
    <div class="modal-body">
      <!-- 物品网格 -->
      <div class="item-grid">
        <div class="item-card">
          <div class="item-icon">🗡</div>
          <div class="item-name">铁剑</div>
          <div class="item-count">×1</div>
          <button class="item-use-btn">使用</button>
        </div>
        
        <div class="item-card">
          <div class="item-icon">🧪</div>
          <div class="item-name">治疗药水</div>
          <div class="item-count">×3</div>
          <button class="item-use-btn">使用</button>
        </div>
        
        <!-- 空槽位 -->
        <div class="item-card empty"></div>
      </div>
    </div>
    
    <div class="modal-footer">
      <div class="inventory-stats">
        负重：15/50 | 物品：5/30
      </div>
    </div>
  </div>
</div>
```

#### 功能
```javascript
✅ 打开/关闭背包
✅ 显示物品列表
✅ 使用物品（药水/消耗品）
✅ 丢弃物品
✅ 物品详情（悬停显示）
✅ 物品分类（全部/武器/护甲/消耗品）
✅ 负重计算
```

---

### 4. 装备管理

#### 装备面板设计
```html
<div class="equipment-panel">
  <!-- 角色纸娃娃（可选） -->
  <div class="character-model">
    <div class="equip-slot head" onclick="showEquipMenu('head')">
      头部
    </div>
    <div class="equip-slot body" onclick="showEquipMenu('body')">
      身体
    </div>
    <div class="equip-slot mainHand" onclick="showEquipMenu('mainHand')">
      主手: 铁剑
    </div>
    <div class="equip-slot offHand" onclick="showEquipMenu('offHand')">
      副手: 空
    </div>
  </div>
  
  <!-- 装备详情 -->
  <div class="equipment-detail">
    <div class="equip-name">铁剑</div>
    <div class="equip-stats">
      伤害：1d8+1
      材料：铁 (+1)
      耐久：29/30
    </div>
    <button class="equip-btn" onclick="unequip('mainHand')">
      卸下
    </button>
    <button class="equip-btn" onclick="repair('mainHand')">
      修理
    </button>
  </div>
</div>
```

---

### 5. 保存/加载系统

#### 存档列表界面
```html
<div class="save-list">
  <div class="save-slot">
    <div class="save-info">
      <div class="save-name">存档 1</div>
      <div class="save-time">2026-09-02 23:50</div>
      <div class="save-progress">
        凛夏 | Lv.3 | 灰烬森林
      </div>
    </div>
    <div class="save-actions">
      <button onclick="loadSave(1)">读取</button>
      <button onclick="deleteSave(1)">删除</button>
    </div>
  </div>
  
  <div class="save-slot empty">
    <button onclick="newSave(2)">+ 新建存档</button>
  </div>
</div>
```

#### 数据结构
```javascript
localStorage.saves = [
  {
    id: 1,
    name: '存档 1',
    timestamp: 1693680600000,
    character: { ... },
    gameState: { ... },
    progress: {
      location: '灰烬森林',
      mainQuest: 3,
      playTime: 7200
    }
  }
]
```

---

### 6. 游戏菜单（ESC）

#### 菜单设计
```html
<div class="game-menu-overlay" id="game-menu">
  <div class="game-menu">
    <h2>⚔ 游戏菜单 ⚔</h2>
    
    <button class="menu-btn" onclick="resumeGame()">
      ▶ 继续游戏
    </button>
    <button class="menu-btn" onclick="saveGame()">
      💾 保存游戏
    </button>
    <button class="menu-btn" onclick="loadGame()">
      📂 读取存档
    </button>
    <button class="menu-btn" onclick="openSettings()">
      ⚙ 设置
    </button>
    <button class="menu-btn" onclick="returnToMainMenu()">
      🏠 返回主菜单
    </button>
    <button class="menu-btn danger" onclick="quitGame()">
      ❌ 退出游戏
    </button>
  </div>
</div>
```

#### 快捷键
```
ESC - 打开/关闭菜单
F5 - 快速保存
F9 - 快速读取
```

---

### 7. 对话系统

#### 对话框设计
```html
<div class="dialogue-box">
  <div class="npc-info">
    <div class="npc-avatar">
      <img src="npc/blacksmith.png" alt="铁匠老陈">
    </div>
    <div class="npc-name">铁匠老陈</div>
  </div>
  
  <div class="dialogue-content">
    <p>欢迎，冒险者。需要我帮你打造装备吗？</p>
  </div>
  
  <div class="dialogue-options">
    <button class="option-btn" onclick="selectOption(1)">
      1. 我想看看你的商品
    </button>
    <button class="option-btn" onclick="selectOption(2)">
      2. 能帮我修理装备吗？
    </button>
    <button class="option-btn" onclick="selectOption(3)">
      3. 再见
    </button>
  </div>
</div>
```

---

### 8. 任务系统

#### 任务面板
```html
<div class="quest-panel">
  <div class="quest-tabs">
    <button class="tab active">进行中</button>
    <button class="tab">已完成</button>
    <button class="tab">失败</button>
  </div>
  
  <div class="quest-list">
    <div class="quest-item active">
      <div class="quest-title">清理废墟</div>
      <div class="quest-progress">
        击败灰烬狼：3/5
      </div>
      <div class="quest-reward">
        奖励：50 经验，20 金币
      </div>
    </div>
  </div>
  
  <div class="quest-detail">
    <h3>清理废墟</h3>
    <p>铁匠老陈委托你清理废墟中的灰烬狼...</p>
  </div>
</div>
```

---

### 9. 地图系统

#### 地图界面
```html
<div class="map-container">
  <div class="map-canvas">
    <!-- Canvas 绘制地图 -->
  </div>
  
  <div class="location-list">
    <div class="location-item discovered">
      <div class="location-name">🏠 锈钉镇</div>
      <button class="travel-btn" onclick="travel('town')">
        前往
      </button>
    </div>
    
    <div class="location-item discovered current">
      <div class="location-name">🌲 灰烬森林</div>
      <span class="current-mark">当前位置</span>
    </div>
    
    <div class="location-item undiscovered">
      <div class="location-name">❓ 未知区域</div>
    </div>
  </div>
</div>
```

---

### 10. 技能树

#### 技能界面
```html
<div class="skill-tree">
  <div class="skill-category">
    <h3>⚔ 战斗技能</h3>
    
    <div class="skill-node unlocked">
      <div class="skill-icon">🗡</div>
      <div class="skill-name">重击</div>
      <div class="skill-level">Lv.2/5</div>
      <button class="upgrade-btn" onclick="upgradeSkill('heavy_strike')">
        升级（需要 1 技能点）
      </button>
    </div>
    
    <div class="skill-node locked">
      <div class="skill-icon">⚔</div>
      <div class="skill-name">连击</div>
      <div class="skill-requirement">
        需要：重击 Lv.3
      </div>
    </div>
  </div>
</div>
```

---

## 📊 开发时间估算

| 功能 | 优先级 | 时间 | 累计完成度 |
|------|--------|------|-----------|
| ✅ 注册界面 | 🔴 | - | 10% |
| ✅ 主游戏框架 | 🔴 | - | 20% |
| ✅ 快捷功能 | 🔴 | - | 30% |
| 1. 设置界面 | 🔴 | 2-3h | 40% |
| 2. 手动战斗 | 🔴 | 3-4h | 50% |
| 3. 背包管理 | 🔴 | 2-3h | 55% |
| 4. 装备管理 | 🔴 | 2-3h | 60% |
| **→ 基础可玩** | | **1天** | **60%** |
| 5. 保存/加载 | 🟡 | 2h | 65% |
| 6. 游戏菜单 | 🟡 | 1-2h | 68% |
| 7. 战斗优化 | 🟡 | 2h | 70% |
| 8. AI 集成 | 🟡 | 6-8h | 80% |
| **→ 完整可玩** | | **3天** | **80%** |
| 9. 对话系统 | 🟢 | 6h | 85% |
| 10. 任务系统 | 🟢 | 6h | 90% |
| 11. 地图系统 | 🟢 | 6h | 95% |
| 12. 技能树 | 🔵 | 6-8h | 100% |
| **→ 功能完整** | | **7天** | **100%** |

---

## ✅ Milestone 定义

### Milestone 1：基础可玩（60%）
```
目标时间：Day 2 晚上
必需功能：
  ✅ 角色创建
  ✅ 主界面框架
  ✅ 设置界面
  ✅ 手动战斗
  ✅ 背包管理
  ✅ 装备管理

可以做到：
  - 创建角色
  - 进入游戏
  - 手动战斗
  - 使用物品
  - 更换装备
  - 配置设置
```

### Milestone 2：完整可玩（80%）
```
目标时间：Week 1 结束（Day 4）
新增功能：
  ✅ 保存/加载
  ✅ 游戏菜单
  ✅ 战斗优化
  ✅ AI 对话

可以做到：
  - 保存进度
  - 多存档管理
  - AI 对话
  - 完整游戏循环
```

### Milestone 3：功能完整（100%）
```
目标时间：Week 2 结束（Day 7）
新增功能：
  ✅ 对话系统
  ✅ 任务系统
  ✅ 地图系统
  ✅ 技能树

可以做到：
  - 接受任务
  - 完成目标
  - 探索地图
  - 升级技能
  - 完整 RPG 体验
```

---

## 🎯 质量标准

### 每个功能必须达到：

**视觉质量**
```
✅ 符合羊皮纸+皮革风格
✅ 金色装饰点缀
✅ 动画流畅（60fps）
✅ 响应式布局
```

**交互质量**
```
✅ 点击反馈明确
✅ 悬停效果
✅ 快捷键支持
✅ 错误提示友好
```

**功能质量**
```
✅ 数据持久化
✅ 错误处理
✅ 边界情况考虑
✅ 性能优化
```

---

## 📝 开发原则

1. **先完成，再完美**
   - 先实现功能
   - 后优化细节

2. **保持风格统一**
   - 所有界面使用相同配色
   - 所有按钮使用相同样式

3. **用户体验优先**
   - 减少点击次数
   - 提供快捷键
   - 及时反馈

4. **模块化设计**
   - 每个功能独立
   - 便于维护
   - 便于扩展

---

**文档创建完成！** 📋✨

**接下来：休息，明天继续！** 😊
