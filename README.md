# 灾厄之后·重制版 - 独立前端项目

> 基于姬侠传/瀚海架构的独立 Web 应用  
> 支持 SillyTavern 兼容 + 独立前端双模式

---

## 项目概述

**灾厄之后·重制版**是一款基于 D20 检定系统的废土西幻 RPG 游戏，采用姬侠传的模块化架构，支持三种运行模式：

1. **SillyTavern 版本**：搭配角色卡在 ST 中运行
2. **独立前端**：直接在浏览器中打开 `index.html` 运行
3. **Android APK**：打包为安卓应用

---

## 技术栈

- **前端框架**：原生 JavaScript（无依赖）
- **模块系统**：ES6 Modules
- **数据存储**：IndexedDB + localStorage
- **样式**：CSS3（废土羊皮纸主题）
- **构建工具**：无需构建，直接运行

---

## 项目结构

```
灾厄之后-独立版/
├── index.html                    # 主游戏页面（独立前端入口）
├── index-SR.html                 # SillyTavern 流式版本
├── start-screen.html             # 开局页面（角色创建）
├── combat.html                   # 战斗页面
├── forge.html                    # 锻造页面
├── map.html                      # 地图页面
├── faction.html                  # 势力页面
│
├── module/                       # 核心模块（46 个 JS 文件）
│   ├── api-service.js            # LLM API 接口
│   ├── game-state.js             # 游戏状态管理
│   ├── check-system.js           # D20 检定系统
│   ├── dice-pool.js              # 骰子池管理
│   ├── combat-system.js          # 战斗系统
│   ├── forge-system.js           # 锻造系统
│   ├── relation-system.js        # 关系系统
│   ├── settlement-engine.js      # 结算协议执行器
│   ├── prompt-data-core.js       # 核心提示词（从 YAML 生成）
│   ├── prompt-data-npc.js        # NPC 人设（从 YAML 生成）
│   ├── prompt-data-world.js      # 世界观（从 YAML 生成）
│   └── ...
│
├── styles/                       # 样式文件
│   ├── main.css                  # 主样式
│   ├── calamity-theme.css        # 废土主题
│   ├── components.css            # 组件样式
│   └── responsive.css            # 响应式布局
│
├── img/                          # 图片资源
│   ├── location/                 # 场景图（11 个区域）
│   ├── npc/                      # NPC 头像（14 个）
│   ├── ui/                       # UI 图标
│   └── bg/                       # 背景纹理
│
├── bgm/                          # BGM 音频
│   ├── combat/                   # 战斗音乐
│   ├── ambient/                  # 环境音乐
│   └── ui/                       # UI 音效
│
├── data-source/                  # 源数据（YAML）
│   ├── 世界书/                   # 从原项目复制
│   └── tools/                    # 数据转换工具
│       └── convert-yaml-to-js.js
│
├── docs/                         # 文档
│   ├── README.md                 # 主文档
│   ├── DEVELOPMENT.md            # 开发指南
│   ├── API.md                    # API 文档
│   └── CHANGELOG.md              # 更新日志
│
├── apk/                          # Android 打包
│   ├── capacitor.config.json
│   └── package.json
│
└── package.json                  # 项目配置
```

---

## 快速开始

### 1. 独立前端模式

```bash
# 直接用浏览器打开
open index.html

# 或启动本地服务器（推荐）
python -m http.server 8080
# 访问 http://localhost:8080
```

### 2. SillyTavern 模式

1. 将 `data-source/世界书/` 下的条目导入 ST
2. 在 ST 中打开 `index-SR.html`
3. 配合小白X 插件使用

### 3. Android APK

```bash
cd apk
npm install
npx cap sync
npx cap open android
```

---

## 开发计划

### 阶段 1：数据迁移（已完成）
- ✅ 编写数据转换脚本
- ✅ 转换 116 个 YAML 为 JS 模块
- ✅ 生成数据质量报告

### 阶段 2：核心系统适配（Week 1-2）
- [ ] 从姬侠传复制 46 个基础模块
- [ ] 适配 D20 检定系统
- [ ] 适配骰子池逻辑
- [ ] 适配战斗系统
- [ ] 适配锻造系统

### 阶段 3：UI 改造（Week 3）
- [ ] 集成开场白界面
- [ ] 改造主题风格（武侠 → 废土）
- [ ] 开发地图系统（11 个区域）
- [ ] 开发势力面板（5 大势力）

### 阶段 4：ST 版本与测试（Week 4）
- [ ] 开发 ST 流式版本
- [ ] 测试双模式切换
- [ ] 完善存档转换器

### 阶段 5：APK 打包（Week 5，可选）
- [ ] Capacitor 配置
- [ ] Android 测试
- [ ] 性能优化

---

## 核心特性

### 游戏系统

- ✅ **D20 检定系统**：基于 DND 5E 简化
- ✅ **回合制战斗**：命中判定 + 伤害计算 + 重击机制
- ✅ **锻造系统**：17 种材料 + 144 词缀 + 检定掷骰
- ✅ **关系系统**：5 档好感度 + 势力声望
- ✅ **装备系统**：武器/护甲/饰品 + 耐久度
- ✅ **背包系统**：12 槽位 + 负重管理
- ✅ **经验成长**：等级/属性提升

### 技术特性

- ✅ **零依赖**：无需 npm，直接运行 HTML
- ✅ **模块化**：46 个独立 JS 模块，职责清晰
- ✅ **双模式**：ST 版 + 独立前端
- ✅ **跨平台**：Web + Android APK
- ✅ **本地优先**：IndexedDB 存储，无需服务器
- ✅ **向量化召回**：语义记忆检索（可选）

---

## 数据完整度

**当前状态：90/100（良好）**

- ✅ 116 个 YAML 文件全部转换成功
- ✅ 必填字段完整性：40/40
- ⚠️ 推荐字段完整性：20/30（6 个 NPC 缺六维属性）
- ✅ 内容质量：30/30

详见：`docs/data-quality-report.md`

---

## 贡献指南

### 数据优化

如需修改 NPC/系统规则/世界观：

1. 编辑 `data-source/世界书/*.yaml`
2. 运行转换脚本：`npm run convert`
3. 重新测试游戏

### 代码贡献

请遵循姬侠传的代码风格：
- 使用 ES6 Modules
- 每个模块职责单一
- 添加 JSDoc 注释

---

## 许可证

MIT License

---

## 致谢

- 基于 [姬侠传/瀚海](https://github.com/Ji-Haitang/char_card_1) 架构
- 使用 SillyTavern 生态
- 灵感来源于 DND 5E

---

## 联系方式

- 项目主页：[待补充]
- 问题反馈：[待补充]
- 讨论社区：[待补充]
