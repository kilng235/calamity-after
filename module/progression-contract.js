/**
 * 灾厄之后·重制版 - 升级进度契约（自动生成，勿手动编辑）
 * 生成时间: 2026-09-06 13:00:58
 * 来源: data-source/世界书/系统/经验与成长.yaml §4 等级进度总表
 *
 * command-processor.syncLevel 单源消费此契约（表内查行，表外按 beyond 公式延续）；
 * 调整成长曲线请编辑源 YAML 后重跑转换器。表内自洽校验警告数: 0
 */
var progressionContract = {
  generatedAt: "2026-09-06 13:00:58",
  source: 'data-source/世界书/系统/经验与成长.yaml',
  levels: {
  "1": {
    "cumXp": 0,
    "attrPoints": 0,
    "pb": 2,
    "rank": "见习"
  },
  "2": {
    "cumXp": 50,
    "attrPoints": 1,
    "pb": 2,
    "rank": "见习"
  },
  "3": {
    "cumXp": 150,
    "attrPoints": 1,
    "pb": 2,
    "rank": "正式"
  },
  "4": {
    "cumXp": 300,
    "attrPoints": 2,
    "pb": 2,
    "rank": "正式"
  },
  "5": {
    "cumXp": 500,
    "attrPoints": 1,
    "pb": 3,
    "rank": "精锐"
  },
  "6": {
    "cumXp": 750,
    "attrPoints": 1,
    "pb": 3,
    "rank": "精锐"
  },
  "7": {
    "cumXp": 1050,
    "attrPoints": 1,
    "pb": 3,
    "rank": "王牌"
  },
  "8": {
    "cumXp": 1400,
    "attrPoints": 2,
    "pb": 3,
    "rank": "王牌"
  },
  "9": {
    "cumXp": 1800,
    "attrPoints": 1,
    "pb": 4,
    "rank": "王牌"
  },
  "10": {
    "cumXp": 2250,
    "attrPoints": 1,
    "pb": 4,
    "rank": "传奇"
  }
},
  beyond: { xpFactorPerLevel: 50, attrPointsBase: 1, asiEveryLevels: 4, pbFirstAt: 5, pbStepLevels: 4 }
};

if (typeof window !== 'undefined') { window.progressionContract = progressionContract; }
