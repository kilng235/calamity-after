// 渲染器逻辑测试：DOM 桩 + 从 index.html 提取真实渲染代码
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('index.html', 'utf8');

const start = html.indexOf("const NARRATIVE_LATIN");
const end = html.indexOf('function displayNarrative(text)');
if (start < 0 || end < 0) { console.log('提取失败'); process.exit(1); }
const rendererSrc = html.slice(start, end);

// DOM 桩
function makeNode(tag) {
  const node = {
    tagName: tag, children: [], _text: '', _cls: '', style: {},
    set textContent(v) { this._text = String(v); this.children = []; },
    get textContent() { return this._text; },
    appendChild(c) { this.children.push(c); return c; },
    set className(c) { this._cls = c; },
    get className() { return this._cls || ''; },
    querySelector() { return null; },
    innerHTML: '',
  };
  node.classList = {
    add: (c) => { const s = new Set(node._cls ? node._cls.split(' ') : []); s.add(c); node._cls = [...s].join(' '); },
    remove: (c) => { node._cls = (node._cls || '').split(' ').filter(x => x !== c).join(' '); },
    contains: (c) => (node._cls || '').split(' ').includes(c),
  };
  return node;
}
const doc = { createElement: makeNode };
const sb = { console, document: doc };
vm.createContext(sb);
vm.runInContext(rendererSrc + `\nfunction displayNarrative(text){ return renderNarrativePage(text); }`, sb);

const dump = (n, d = 0) => {
  const cls = n.className ? '.' + n.className.split(' ').join('.') : '';
  const t = n._text ? ' "' + n._text.slice(0, 28) + '"' : '';
  console.log('  '.repeat(d) + n.tagName + cls + t);
  (n.children || []).forEach(c => dump(c, d + 1));
};
const find = (n, cls) => {
  if (n.className && n.className.split(' ').includes(cls)) return true;
  return (n.children || []).some(c => find(c, cls));
};

let pass = 0, fail = 0;
const check = (name, cond) => { cond ? pass++ : fail++; console.log((cond ? '✓' : '✗') + ' ' + name); };

// 1. 检定卡（规范框线）
const checkText = `----- ✦ 灾厄300年11月12日 07:10 ✦ -----

你屏住呼吸，贴着断墙缓缓移动。灰烬雾在你的脚边打着旋。

「什么人？」废墟后传来一声低喝。

<check>
╔═══════════════════════════════╗
║  ⚡ 感知检定                    ║
╠═══════════════════════════════╣
║  骰值: d20(14)                 ║
║  调整: +2 (属性) +2 (熟练)     ║
║  总计: 18                      ║
║  难度: DC 15                   ║
║  结果: ✧ 成功 ✧                ║
╚═══════════════════════════════╝
</check>

你听见了压低的呼吸声——至少两个人。`;
const p1 = vm.runInContext('displayNarrative(' + JSON.stringify(checkText) + ')', sb);
check('书页容器', p1.className === 'turn-page');
check('页眉存在', find(p1, 'turn-head'));
check('拉丁词 Examen', p1.children[0].children[1]._text === 'Examen');
check('时间头', find(p1, 'turn-deco'));
check('首字下沉段落', find(p1, 'lore-p'));
check('对白行', find(p1, 'quote-line'));
check('检定卡', find(p1, 'check-card'));
check('检定标题', find(p1, 'ck-title'));
check('检定成功着色', find(p1, 'ck-result') && JSON.stringify(p1).includes('ck-result ok'));
check('无 <check> 字面残留', !p1.children.some(c => (c._text || '').includes('<check>')));

// 2. 战斗卡
const battleText = `<battle>

╔═══════════════════════════════════════════════╗
║          ⚔️  战斗开始  ⚔️                    ║
╚═══════════════════════════════════════════════╝
先攻顺序：凛夏（15） → 灰烬狼A（12）
交战距离：10米

━━━━━ 第1回合 ━━━━━

【凛夏的回合】
行动：使用铁剑攻击灰烬狼A
[ 攻击检定：d20(14) + 3 = 17 vs AC 13 ]
✓ 命中
[ 伤害：5 ]

【灰烬狼A的回合】
行动：撕咬凛夏
[ 攻击检定：d20(8) + 2 = 10 vs AC 15 ]
✗ 未命中

━━━━━ 第2回合 ━━━━━

【凛夏的回合】
行动：挥剑横扫
[ 攻击检定：d20(19) + 3 = 22 vs AC 13 ]
💥 重击！伤害翻倍！
[ 伤害：12 ]

╔═══════════════════════════════════════════════╗
║          ⚔️  战斗结束  ⚔️                    ║
╚═══════════════════════════════════════════════╝
胜利！击败灰烬狼A。`;
const p2 = vm.runInContext('displayNarrative(' + JSON.stringify(battleText) + ')', sb);
check('战斗卡', find(p2, 'battle-card'));
check('拉丁词 Bellum', p2.children[0].children[1]._text === 'Bellum');
check('战斗开始横幅', JSON.stringify(p2).includes('⚔️ 战斗开始'));
check('先攻行', find(p2, 'bt-init'));
check('距离行', find(p2, 'bt-dist'));
check('回合分隔×2', JSON.stringify(p2).match(/bt-turn/g) !== null && JSON.stringify(p2).match(/bt-turn/g).length >= 2);
check('行动者×3', JSON.stringify(p2).match(/bt-actor/g).length >= 3);
check('检定行', find(p2, 'bt-roll'));
check('命中/未命中', find(p2, 'bt-hit') && find(p2, 'bt-miss'));
check('伤害大数字', JSON.stringify(p2).includes('bt-dmg'));
check('重击强调', find(p2, 'bt-crit'));
check('结束横幅+结果', JSON.stringify(p2).includes('战斗结束') && find(p2, 'bt-result'));

// 3. 对抗检定 JSON 变体
const opposed = `<check>{"type":"opposed","skill":"魅力","yourRoll":12,"yourTotal":15,"opponentRoll":10,"opponentTotal":12,"success":true}</check>`;
const p3 = vm.runInContext('displayNarrative(' + JSON.stringify(opposed) + ')', sb);
check('对抗检定卡', find(p3, 'check-card') && JSON.stringify(p3).includes('对抗'));

// 4. 紧凑条
check('玩家输入条', vm.runInContext('displayNarrative(' + JSON.stringify('\n> 我挥剑攻击\n') + ')', sb).className === 'player-strip');
check('错误条', vm.runInContext('displayNarrative(' + JSON.stringify('\n❌ 错误: 请求超时\n') + ')', sb).className === 'error-strip');
check('掷骰条', vm.runInContext('displayNarrative(' + JSON.stringify('\n🎲 你掷出了：17\n') + ')', sb).className === 'sys-line');

// 5. 畸形检定 → 回退原文本不丢内容
const malformed = `<check>感知 d20+2 vs DC12，掷出 15，成功</check>`;
const p5 = vm.runInContext('displayNarrative(' + JSON.stringify(malformed) + ')', sb);
const allText = JSON.stringify(p5);
check('畸形检定回退 plain-pre', find(p5, 'plain-pre'));
check('内容未丢失', allText.includes('d20+2') && allText.includes('成功'));

// 6. 开局叙事（章节头/委托行）
const intro = `----- ✦ 灾厄300年11月12日 07:10 ✦ -----

【启程 · Profectio】　·　佣兵镇·锈钉，佣兵公会大厅

锈钉镇的清晨比想象中醒得早。天还没全亮，铁匠铺的锤声就隔着两条街传过来，你裹着旧斗篷穿过主街。

「新面孔。名字、种族、特质，自己填，填完盖手印。」

◈ 当前委托：灰烬森林材料狩猎：灰烬狼皮（0/3）、焦木蜥鳞片（0/2），时限 3天。`;
const p6 = vm.runInContext('displayNarrative(' + JSON.stringify(intro) + ')', sb);
check('章节头', find(p6, 'turn-chapter'));
check('委托行', find(p6, 'sys-line') && JSON.stringify(p6).includes('当前委托'));
check('拉丁词 Mandatum(含委托)', p6.children[0].children[1]._text === 'Mandatum');

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
