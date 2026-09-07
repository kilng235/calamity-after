/**
 * gathering-tables.js - 采集点权重表
 *
 * 与「data-source/世界书/地理/*.yaml」挂接点对应。
 * 当前仅实现 1 个示范区域（灰烬森林），其他区域留 TODO：
 *   - 佣兵镇·锈钉（待补：铁器/情报/补给相关材料）
 *   - 深渊裂隙（待补：黑曜铁/秘银/血晶石/星铁 等灾厄金属）
 *   - 地下裂谷（待补：磷光菌核等地下特产）
 *   - 魔法荒原（待补：魔力结晶/扭曲木 等魔法介质）
 *   - 灰烬森林 ✓（本文件已实现）
 *
 * 字段说明：
 *   name        材料名（必在 MATERIALS 中）
 *   weight      权重（整数，table 全部 weight 之和作为分母）
 *   amount      数量表达式 — "1" / "1d3" / "2d4" 等骰子表达式
 *   tier        可选 — 该材料在此区域的稀有档（用于叙事）
 *
 * cooldownMinutes: 同地点采集冷却（游戏内分钟数）。
 *                  防止玩家无限刷低权重高价值材料。
 *
 * 设计原则：
 *   - 高价值材料（灾厄金属/稀有草药等）权重极低（≤2）
 *   - 区域特色材料（焦木在灰烬森林）权重高（15~25）
 *   - 通用草药类始终可获取（玩家起步经济来源）
 *   - 重量之和 = 100 便于按百分比心算
 */

export const GATHERING_TABLES = {
  // ───────── 灰烬森林 ─────────
  // 区域特征：旧王国西部，灾厄时烧毁；主要产物：焦木/硫磺矿/祖母绿/琥珀
  // 设计参考：地理总纲.yaml 行 8
  '地理/灰烬森林': {
    cooldownMinutes: 30,
    materials: [
      { name: '草药',     weight: 40, amount: '1d3' },   // 常见，入门采集
      { name: '焦木',     weight: 20, amount: '1d2' },   // 区域特色
      { name: '硫磺矿',   weight: 15, amount: '1' },     // 区域有硫磺
      { name: '力量草',   weight: 10, amount: '1' },     // 野生分布
      { name: '琥珀',     weight: 8,  amount: '1' },     // 旧王国遗物
      { name: '净化苔藓', weight: 4,  amount: '1' },     // 罕见于灾厄区边缘
      { name: '稀有草药', weight: 2,  amount: '1' },     // 极稀有
      { name: '祖母绿',   weight: 1,  amount: '1' }      // 远古宝石
    ]
    // 总权重 = 100；祖母绿出现率 ≈ 1%，稀有草药 ≈ 2%
  }

  // ───────── TODO：其他区域 ─────────
  // '地理/佣兵镇·锈钉': { cooldownMinutes: ..., materials: [...] },  // 铁器/情报/补给
  // '地理/深渊裂隙':     { cooldownMinutes: ..., materials: [...] },  // 灾厄金属
  // '地理/地下裂谷':     { cooldownMinutes: ..., materials: [...] },  // 磷光菌核等地下特产
  // '地理/魔法荒原':     { cooldownMinutes: ..., materials: [...] }   // 魔力结晶/扭曲木
};

/**
 * 辅助：列出所有已注册采集点 key（用于诊断/UI）
 */
export function listGatheringLocations() {
  return Object.keys(GATHERING_TABLES);
}
