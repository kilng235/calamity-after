/**
 * identity-system.js - 废土世界观身份体系管理器（灾厄之后·重制版）
 *
 * 包含 6 大阵营世界观身份 + 1 个自由人身份：
 *   1. 遗迹猎手 (先驱者探索队 / 废墟探险)
 *   2. 圣火祭司 (圣火教会 / 圣火骑士团)
 *   3. 荒原游侠 (荒原巡逻队 / 独立斥候)
 *   4. 机械工匠 (工匠同盟 / 钢铁商会)
 *   5. 异化行者 (变异者同盟 / 灰烬浪人)
 *   6. 旧日学者 (文明复兴学社 / 历史学会)
 *   7. 自由人   (流浪佣兵 / 自由探索者)
 *
 * 职责：
 * - 登记册注册/进入游戏时接入身份条目
 * - 注入领域检定优势（Advantage）与专业叙事视角（Perspective）到 AI 提示词
 * - 提供专属初始信物包定义（Kit）与开局专属主线任务定义
 */
var identitySystem = (function() {
    'use strict';

    // ───────── 7 大身份注册表 ─────────
    const REGISTRY = {
        '遗迹猎手': {
            faction: '先驱者探索队',
            item: { name: '加密的先驱者磁盘', type: '特殊信物', desc: '记录着旧时代避难所坐标的加密磁盘，需寻找专业技师破译' },
            advantage: '遗迹机关察觉、古代科技识别、结构危险（陷阱/坍塌）规避类检定',
            perspective: [
                '对旧时代高科技设备与先驱者造物极度敏锐，进入废墟先搜寻控制台与密室暗门',
                '行事谨慎，习惯用撬棒与解码器解决障碍，正路不通走野路'
            ],
            quest: {
                name: '失落避难所的讯号',
                desc: '破译随身携带的加密磁盘，寻找 09 号废弃避难所的隐藏入口',
                target: '寻找破译技师'
            }
        },
        '圣火祭司': {
            faction: '圣火教团',
            item: { name: '受祝福的圣火徽记', type: '宗教信物', desc: '教团神圣徽章，可在圣火哨卡获得免费补给，对信徒具有感召力' },
            advantage: '神圣与宗教知识、医疗急救、对抗异端时的意志与心理威吓检定',
            perspective: [
                '言行恪守教义，见到伤者本能以圣火之名行医祈福，谈及净化与信仰时庄重肃穆',
                '对辐射变异生物与掠夺者怀有天然敌意与警惕，在教团聚落享有崇高威望'
            ],
            quest: {
                name: '圣火教团的密信',
                desc: '将神圣密函送达风蚀哨站的主教手中，调查近期渗透的异教徒谣言',
                target: '前往风蚀哨站'
            }
        },
        '荒原游侠': {
            faction: '荒原巡逻队',
            item: { name: '风蚀荒原生存地图', type: '地图工具', desc: '详尽标记了避风洞、水源与兽径的羊皮纸地图，野外旅行迷路率归零' },
            advantage: '野外追踪识痕、伏击潜伏、恶劣天气与猛兽危险直觉类检定',
            perspective: [
                '野外自动读痕辨迹（足迹、风向、兽径），对沙暴与突发异兽有直觉性警觉',
                '习惯以弓弩和陷阱先发制人，极难在野外遭遇战中被偷袭'
            ],
            quest: {
                name: '沙暴中的失踪巡逻队',
                desc: '循着风蚀平原的血迹与残骸，追查荒原失联巡逻分队的下落',
                target: '搜寻巡逻队痕迹'
            }
        },
        '机械工匠': {
            faction: '工匠同盟',
            item: { name: '多功能改装扳手', type: '工艺工具', desc: '精密合金工具，锻造与改装金币消耗永久降低 20%' },
            advantage: '器械修理、锻造工艺、机关逆向拆解、机械造物弱点识别类检定',
            perspective: [
                '见到装备与器械先评估磨损与工艺结构，忍不住想拆解研究并加装配件',
                '谈材料工艺使用专业行话，在野外可尝试修复损坏的防御炮台与机械'
            ],
            quest: {
                name: '动力核心过载之谜',
                desc: '收集高纯度动力元件，修复哨站外围报废的自卫炮台',
                target: '收集核心零件'
            }
        },
        '异化行者': {
            faction: '灰烬浪人',
            item: { name: '变异体抑制药剂', type: '特种药剂', desc: '强效基因稳定剂，辐射抗性永久+2，但进城需防备守卫盘查' },
            advantage: '毒素与辐射耐受、危险本能感知、地下黑市与边陲流民交涉类检定',
            perspective: [
                '对环境中的辐射尘与生化毒素具有敏锐直觉，行事孤僻警惕',
                '熟悉废土底层法则，在贫民窟与黑市如鱼得水，但对正规军守卫心存戒备'
            ],
            quest: {
                name: '血脉异动的源头',
                desc: '前往回声谷废墟寻找旧时代基因冷冻液，压制体内的血脉异化',
                target: '探索回声谷废墟'
            }
        },
        '旧日学者': {
            faction: '文明复兴学社',
            item: { name: '古代文献残卷', type: '学术文献', desc: '记载着大灾变前夕历史的珍贵文献，解读古铭文必定具备优势' },
            advantage: '古文字释读、历史考证、古代科研装置操作、神秘学魔法知识类检定',
            perspective: [
                '见到古代铭文、终端和遗存优先尝试考证释读，习惯引经据典，理性优先于直觉',
                '在学者和文明据点备受礼遇，执着于还原大灾变前后的历史真相'
            ],
            quest: {
                name: '灾厄编年史残页',
                desc: '探访灰烬森林中的古代方尖碑，拓印石碑铭文以拼凑灾厄历史',
                target: '拓印古代方尖碑'
            }
        },
        '自由人': {
            faction: '无阵营羁绊',
            item: { name: '磨损的旅行行囊', type: '便携装备', desc: '加厚防水皮质行囊，使角色负重上限永久额外提高 10 磅' },
            advantage: '雇佣议价、市井应变、杂务生存与全地形机动类检定',
            perspective: [
                '不属于任何教派与势力，行事务实灵活，全看报酬与风险是否对等',
                '全阵营中立，在各大势力夹缝中保持游刃有余，不受阵营规矩束缚'
            ],
            quest: {
                name: '荒原的第一桶金',
                desc: '在公会大厅自由接取委托，完成第一次荒原狩猎以赚取立足本金',
                target: '完成初次委托'
            }
        }
    };

    const DEFAULT_ID = '自由人';
    let _active = null;

    function activate(identity) {
        const id = (identity && REGISTRY[identity]) ? identity : DEFAULT_ID;
        const entry = REGISTRY[id];
        _active = {
            id: id,
            faction: entry.faction,
            item: entry.item,
            advantage: entry.advantage,
            perspective: entry.perspective.slice(),
            quest: entry.quest,
            boundary: '仅上述身份领域适用；与种族/特质优势不叠加（同一动作只取一次优势）'
        };
        console.log('[IdentitySystem] 废土身份已接入：' + id + ' (' + entry.faction + ')');
        return _active;
    }

    function activateFromSave() {
        try {
            const gd = (window.gameData !== undefined) ? window.gameData : null;
            const id = gd && gd.character && gd.character.identity;
            if (id) return activate(id);
        } catch (e) { /* ignore */ }
        return activate(DEFAULT_ID);
    }

    function deactivate() { _active = null; }

    function getActive() { return _active; }

    function getEntry(id) { return REGISTRY[id] || REGISTRY[DEFAULT_ID]; }

    function listAll() { return Object.keys(REGISTRY); }

    function buildBlock() {
        if (!_active) return '';
        const lines = [
            '【玩家身份：' + _active.id + ' ｜ 所属：' + _active.faction + '】',
            '• 身份检定优势：' + _active.advantage + '（检定掷二取一）',
            '• 专属信物：' + _active.item.name + '（' + _active.item.desc + '）',
            '• 专业叙事视角：' + _active.perspective.join('；'),
            '• 规则边界：' + _active.boundary
        ];
        return lines.join('\n');
    }

    const publicApi = {
        activate: activate,
        activateFromSave: activateFromSave,
        deactivate: deactivate,
        getActive: getActive,
        getEntry: getEntry,
        listAll: listAll,
        buildBlock: buildBlock,
        REGISTRY: REGISTRY
    };

    if (typeof window !== 'undefined') {
        window.identitySystem = publicApi;
    }

    return publicApi;
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = identitySystem;
}
