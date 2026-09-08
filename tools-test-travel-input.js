// 旅行接线测试（Node，动态 import ESM）：意图解析 / 提示块格式 / travelTo 集成 / 结算合并
let pass = 0, fail = 0;
function check(name, cond) {
  console.log((cond ? '✅' : '❌') + ' ' + name);
  cond ? pass++ : fail++;
}

(async function main() {
  const tables = await import('./module/travel-tables.js');
  const input = await import('./module/travel-input.js');
  const system = await import('./module/travel-system.js');

  const LOCATIONS = tables.TRAVEL_LOCATIONS;

  // ── 词表 ──
  check('1. TRAVEL_LOCATIONS 导出 10 区域（含锈钉镇/地下裂谷）',
    LOCATIONS.length === 10 && LOCATIONS.includes('锈钉镇') && LOCATIONS.includes('地下裂谷'));

  // ── 解析器：动词门 / 地名门 / 唯一性门 ──
  const p = (m, cur) => input.parseTravelIntent(m, cur, LOCATIONS);
  let r = p('前往灰烬森林打怪', '锈钉镇');
  check('2. 前往+全名 → 意图灰烬森林', r.intent === true && r.destination === '灰烬森林');
  r = p('出发！去裂隙看看', '锈钉镇');
  check('3. 别名「裂隙」→ 深渊裂隙', r.intent === true && r.destination === '深渊裂隙');
  r = p('从灰烬森林回锈钉镇', '灰烬森林');
  check('4. 排除当前地：目的地解析为锈钉镇', r.intent === true && r.destination === '锈钉镇');
  r = p('去废墟转转', '锈钉镇');
  check('5. 别名「废墟」→ 旧王城废墟', r.intent === true && r.destination === '旧王城废墟');
  r = p('去灰烬森林和迷雾沼泽', '锈钉镇');
  check('6. 双目的地 → 歧义拒绝', r.intent === false && r.reason === 'ambiguous' && r.mentioned.length === 2);
  r = p('灰烬森林真危险啊', '锈钉镇');
  check('7. 有地名无动词 → 不触发', r.intent === false && r.reason === 'no-verb');
  r = p('出发！', '锈钉镇');
  check('8. 有动词无地名 → 不触发', r.intent === false && r.reason === 'no-destination');
  r = p('回灰烬森林深处看看', '灰烬森林');
  check('9. 目的地=当前地 → 不触发', r.intent === false && r.reason === 'no-destination');

  // ── 提示块格式（mock 结果，确定性断言）──
  const okResult = {
    success: true,
    route: { from: '锈钉镇', to: '灰烬森林', hours: 2, danger: '低', note: '' },
    effectiveDanger: '中', nightTravel: true,
    encounterHint: '路线：锈钉镇 → 灰烬森林（约 2 小时）；危险等级：中；路途遭遇：灰烬狼 ×3（威胁中）；偷袭判定失败，敌方获得先攻，玩家第一轮处于被动；夜间遭遇，视野受限',
    encounter: { occurred: true, creature: '灰烬狼', count: 3, threat: '中', surprise: true, narrative: '' },
    newLocation: '灰烬森林', arrivedAt: {}
  };
  const blockOk = input.buildTravelPromptBlock(okResult);
  check('10. 成功提示块：系统权威头/遭遇协议/落点指示齐备',
    blockOk.indexOf('【旅行结算·系统权威】') >= 0 && blockOk.indexOf('路途遭遇规则') >= 0
    && blockOk.indexOf('灰烬狼 ×3') >= 0 && blockOk.indexOf('progress.currentPlace') >= 0);
  const noEnc = JSON.parse(JSON.stringify(okResult));
  noEnc.encounter = null;
  noEnc.encounterHint = '路线：锈钉镇 → 灰烬森林（约 2 小时）；危险等级：低；本段路途无遭遇，写赶路叙事（风景/气氛/路标），不强行插入战斗';
  check('11. 无遭遇提示块：含「本段路途无遭遇」',
    input.buildTravelPromptBlock(noEnc).indexOf('本段路途无遭遇') >= 0);
  const failResult = { success: false, error: '没有直达路线', hint: '需先移动到中途区域' };
  const blockFail = input.buildTravelPromptBlock(failResult);
  check('12. 失败提示块：含此路不通语义与 hint',
    blockFail.indexOf('路线不可用') >= 0 && blockFail.indexOf('需先移动到中途区域') >= 0
    && blockFail.indexOf('不得让玩家凭空抵达') >= 0);

  // ── travelTo 集成（克隆上结算，原 gd 不污染）──
  const gd = { gameTime: { year: 300, month: 11, day: 12, hour: 7, minute: 10 }, progress: { currentLocation: '锈钉镇' } };
  const clone = JSON.parse(JSON.stringify(gd));
  const t1 = system.travelTo('灰烬森林', clone);
  check('13. travelTo 成功：克隆 location/unlocked 更新、原 gd 未污染',
    t1.success === true && clone.progress.currentLocation === '灰烬森林'
    && clone.progress.unlockedLocations.includes('灰烬森林')
    && gd.progress.currentLocation === '锈钉镇' && gd.progress.unlockedLocations === undefined);
  check('14. travelTo 推进 gameTime：07:10 + 2h = 09:10',
    clone.gameTime.hour === 9 && clone.gameTime.minute === 10);
  check('15. travelTo 返回 encounterHint 字符串与 encounter 字段',
    typeof t1.encounterHint === 'string' && t1.encounterHint.length > 0
    && (t1.encounter === null || t1.encounter.occurred === true));
  const t2 = system.travelTo('魔法荒原', JSON.parse(JSON.stringify(gd)));
  check('16. 不可直达：锈钉镇→魔法荒原 返回结构化错误',
    t2.success === false && t2.error === '没有直达路线' && t2.hint === '需先移动到中途区域');
  const lockedGd = { gameTime: { year: 300, month: 11, day: 12, hour: 7, minute: 0 }, progress: { currentLocation: '深渊裂隙', unlockedLocations: [] } };
  const t3 = system.travelTo('地下裂谷', lockedGd);
  check('17. 未解锁：缺前置 → 路线未解锁',
    t3.success === false && t3.error === '路线未解锁' && t3.missingRequirements.indexOf('深渊裂隙') >= 0);
  const nightGd = { gameTime: { year: 300, month: 11, day: 12, hour: 23, minute: 0 }, progress: { currentLocation: '锈钉镇' } };
  const t4 = system.travelTo('灰烬森林', nightGd);
  check('18. 夜路升档：低→中 且 nightTravel=true',
    t4.success === true && t4.nightTravel === true && t4.effectiveDanger === '中');

  // ── 结算合并 ──
  const finalGd = { gameTime: { year: 300, month: 11, day: 12, hour: 8, minute: 0 }, progress: { currentLocation: '锈钉镇', gold: 50 } };
  const applied = input.applyTravelSettlement(finalGd, clone);
  check('19. 结算合并：gameTime/location/unlocked 覆盖，其余字段保留',
    applied === true && finalGd.gameTime.hour === 9 && finalGd.progress.currentLocation === '灰烬森林'
    && finalGd.progress.unlockedLocations.indexOf('灰烬森林') >= 0 && finalGd.progress.gold === 50);

  // ── 运行时正名映射（开局存档「佣兵镇·锈钉」↔ 路网「锈钉镇」）──
  const rCanon = p('去灰烬森林', '佣兵镇·锈钉');
  check('20. 正名当前地归一：佣兵镇·锈钉 下解析出灰烬森林（正名不挡门）',
    rCanon.intent === true && rCanon.destination === '灰烬森林');
  const finalGd2 = { gameTime: {}, progress: { currentLocation: '灰烬森林', gold: 1 } };
  const clone2 = { gameTime: { year: 300, month: 11, day: 12, hour: 9, minute: 10 }, progress: { currentLocation: '锈钉镇', unlockedLocations: ['锈钉镇', '灰烬森林'] } };
  check('21. 结算写回正名：锈钉镇 → 佣兵镇·锈钉（位置与 unlocked 同步映射）',
    input.applyTravelSettlement(finalGd2, clone2) === true
    && finalGd2.progress.currentLocation === '佣兵镇·锈钉'
    && finalGd2.progress.unlockedLocations.indexOf('佣兵镇·锈钉') >= 0
    && finalGd2.progress.unlockedLocations.indexOf('灰烬森林') >= 0);

  console.log('\n' + (fail === 0 ? '✅ 全部通过（' + pass + ' 项）' : '❌ 失败 ' + fail + ' 项 / 通过 ' + pass + ' 项'));
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('测试执行异常:', e); process.exit(1); });
