export const GATHERING_TABLES = {
  '地理/灰烬森林': {
    cooldownMinutes: 30,
    materials: [
      { name: '草药',     weight: 44, amount: '1d3' },
      { name: '焦木',     weight: 20, amount: '1d2' },
      { name: '硫磺矿',   weight: 15, amount: '1' },
      { name: '力量草',   weight: 10, amount: '1' },
      { name: '琥珀',     weight: 4,  amount: '1' },
      { name: '净化苔藓', weight: 4,  amount: '1' },
      { name: '稀有草药', weight: 2,  amount: '1' },
      { name: '祖母绿',   weight: 1,  amount: '1' }
    ]
  },

  '地理/佣兵镇·锈钉': {
    cooldownMinutes: 15,
    materials: [
      { name: '清水',     weight: 20, amount: '1d2' },
      { name: '草药',     weight: 20, amount: '1d2' },
      { name: '燃煤',     weight: 15, amount: '1d2' },
      { name: '兽骨',     weight: 10, amount: '1' },
      { name: '铁矿石',   weight: 10, amount: '1' },
      { name: '油脂',     weight: 8,  amount: '1' },
      { name: '鸟羽',     weight: 7,  amount: '1' },
      { name: '铜矿石',   weight: 7,  amount: '1' },
      { name: '符文材料', weight: 3,  amount: '1' }
    ]
  },

  '地理/深渊裂隙': {
    cooldownMinutes: 45,
    materials: [
      { name: '黑曜石',   weight: 20, amount: '1d2' },
      { name: '燃煤',     weight: 15, amount: '1d2' },
      { name: '铁矿石',   weight: 12, amount: '1' },
      { name: '硫磺矿',   weight: 12, amount: '1' },
      { name: '铜矿石',   weight: 10, amount: '1' },
      { name: '锡矿石',   weight: 10, amount: '1' },
      { name: '银矿石',   weight: 8,  amount: '1' },
      { name: '紫水晶',   weight: 6,  amount: '1' },
      { name: '黑曜铁',   weight: 3,  amount: '1' },
      { name: '血晶石',   weight: 2,  amount: '1' },
      { name: '秘银',     weight: 1,  amount: '1' },
      { name: '星铁',     weight: 1,  amount: '1' }
    ]
  },

  '地理/地下裂谷': {
    cooldownMinutes: 45,
    materials: [
      { name: '荧光苔藓', weight: 14, amount: '1d2' },
      { name: '暗视草药', weight: 10, amount: '1' },
      { name: '兽骨',     weight: 17, amount: '1d2' },
      { name: '灰蛞蝓黏液', weight: 12, amount: '1' },
      { name: '磷光菌核', weight: 11, amount: '1' },
      { name: '石蜈蚣毒腺', weight: 7, amount: '1' },
      { name: '燃煤',     weight: 10, amount: '1d2' },
      { name: '黑曜石',   weight: 5,  amount: '1d2' },
      { name: '银矿石',   weight: 3,  amount: '1' },
      { name: '硫磺矿',   weight: 1,  amount: '1' },
      { name: '紫水晶',   weight: 5,  amount: '1' },
      { name: '魔力结晶', weight: 5,  amount: '1' }
    ]
  },

  '地理/龙骨山脉': {
    cooldownMinutes: 30,
    materials: [
      { name: '燃煤',     weight: 24, amount: '1d2' },
      { name: '铁矿石',   weight: 20, amount: '1d2' },
      { name: '铜矿石',   weight: 11, amount: '1' },
      { name: '锡矿石',   weight: 9,  amount: '1' },
      { name: '精铁',     weight: 8,  amount: '1' },
      { name: '银矿石',   weight: 9,  amount: '1' },
      { name: '骨白岩',   weight: 9,  amount: '1' },
      { name: '龙骨化石', weight: 2,  amount: '1' },
      { name: '黄玉',     weight: 2,  amount: '1' },
      { name: '玛瑙',     weight: 2,  amount: '1' },
      { name: '蓝宝石',   weight: 1,  amount: '1' },
      { name: '红宝石',   weight: 1,  amount: '1' },
      { name: '星铁',     weight: 1,  amount: '1' },
      { name: '星辉宝石', weight: 1,  amount: '1' }
    ]
  },

  '地理/魔法荒原': {
    cooldownMinutes: 60,
    materials: [
      { name: '晶壳蝎毒液', weight: 15, amount: '1' },
      { name: '魔力结晶', weight: 12, amount: '1' },
      { name: '符文材料', weight: 10, amount: '1' },
      { name: '清水',     weight: 11, amount: '1' },
      { name: '草药',     weight: 7,  amount: '1' },
      { name: '力量草',   weight: 7,  amount: '1' },
      { name: '灵藤',     weight: 8,  amount: '1' },
      { name: '兽骨',     weight: 7,  amount: '1' },
      { name: '油脂',     weight: 5,  amount: '1' },
      { name: '能量矿石', weight: 6,  amount: '1' },
      { name: '扭曲木',   weight: 10, amount: '1' },
      { name: '星铁',     weight: 1,  amount: '1' },
      { name: '能量晶簇', weight: 1,  amount: '1' }
    ]
  }
};

export function listGatheringLocations() {
  return Object.keys(GATHERING_TABLES);
}
