/**
 * identity-system.js - 身份体系脚本管理器
 *
 * 职责：登记册注册完成、进入游戏或读档加载时，按当前存档身份接入对应的
 * 身份条目（领域检定优势 + 专业叙事视角），供 prompt-builder 每回合常驻注入。
 *
 * 接入时机（三处调用 activate）：
 *   1. 登记册 saveCharacter（注册完成，跳转游戏前）
 *   2. initGame（页面刷新/从存档进入游戏，按存档身份重挂）
 *   3. 手动 window.identitySystem.activate(身份)（调试/修复）
 *
 * 规则对齐：身份优势与种族/背景特质优势不叠加（同一动作只取一次优势）。
 */
var identitySystem = (function() {

    // ───────── 身份条目注册表 ─────────
    // 领域刻意收窄（每身份 1~2 个），优势 = 检定掷二取一，与特质优势不叠加
    const REGISTRY = {
        '佣兵': {
            advantage: '战斗威吓、雇佣委托谈判、武器养护类检定',
            perspective: [
                '评估交战双方战力对比是职业本能，战斗描写中自然带出局势判断',
                '谈委托先问风险与价码，对雇佣行规（定金、佣金抽成、死伤免责）熟稔'
            ]
        },
        '拾荒者': {
            advantage: '搜刮寻物、察觉危险结构（陷阱/坍塌/不稳地基）类检定',
            perspective: [
                '进入废墟先扫一遍值钱货和能用的杂物，对「还能用」的旧物敏感',
                '惯用非常规手段开门、取物、脱身，正路不通走野路'
            ]
        },
        '学者': {
            advantage: '文献考证、知识记忆、遗迹铭文解读类检定',
            perspective: [
                '见到古物、文字、符号先尝试释读，习惯引经据典对照',
                '对未知现象倾向寻找记载依据，理性优先于直觉'
            ]
        },
        '猎人': {
            advantage: '追踪、野外生存、伏击潜伏类检定',
            perspective: [
                '野外自动读痕辨迹（足迹、粪便、压草），留意风向与兽径',
                '对野外危险（猛兽、天气骤变）有直觉性警觉'
            ]
        },
        '商贩': {
            advantage: '估价、议价、市场行情判断类检定',
            perspective: [
                '见到物品本能换算价值和转售价，关注供需与利润空间',
                '议价时使用行话和商业手段（锚定、捆绑、以退为进）'
            ]
        },
        '工匠': {
            advantage: '修理、锻造工艺理解、器械机关类检定',
            perspective: [
                '见到装备器械先评估做工、材质与损耗，忍不住想拆解研究',
                '谈材料工艺使用行话，对粗糙手工有职业性挑剔'
            ]
        },
        '医师': {
            advantage: '伤势诊断、救治处置、医药毒理知识类检定',
            perspective: [
                '见到伤员先本能评估伤势（出血点、骨折、中毒迹象）',
                '战斗结束后的场景描写自然带上医疗观察，谈药材药剂使用行话'
            ]
        }
    };

    const DEFAULT_ID = '佣兵';
    let _active = null;   // { id, advantage, perspective, boundary }

    // ───────── 接入 / 卸载 ─────────

    /** 按身份接入对应条目；未知身份回退佣兵 */
    function activate(identity) {
        const id = (identity && REGISTRY[identity]) ? identity : DEFAULT_ID;
        const entry = REGISTRY[id];
        _active = {
            id: id,
            advantage: entry.advantage,
            perspective: entry.perspective.slice(),
            boundary: '仅上述身份领域适用；与种族/背景特质优势不叠加（同一动作只取一次优势）'
        };
        console.log('[IdentitySystem] 身份条目已接入：' + id);
        return _active;
    }

    /** 按存档自动接入（读档/刷新后的重挂），存档无身份时静默跳过 */
    function activateFromSave() {
        try {
            const gd = (window.gameData !== undefined) ? window.gameData : null;
            const id = gd && gd.character && gd.character.identity;
            if (id) return activate(id);
        } catch (e) { /* ignore */ }
        return null;
    }

    function deactivate() { _active = null; }

    function getActive() { return _active; }

    // ───────── 提示词块构建（prompt-builder 每回合调用） ─────────

    function buildBlock() {
        if (!_active) return '';
        const lines = [];
        lines.push('# 身份条目（' + _active.id + '）');
        lines.push('领域优势：' + _active.advantage + '——相关检定获得优势（掷二取一）。');
        _active.perspective.forEach(p => lines.push('专业视角：' + p));
        lines.push('边界：' + _active.boundary + '。');
        return lines.join('\n');
    }

    return {
        activate: activate,
        activateFromSave: activateFromSave,
        deactivate: deactivate,
        getActive: getActive,
        buildBlock: buildBlock,
        REGISTRY: REGISTRY
    };
})();

if (typeof window !== 'undefined') {
    window.identitySystem = identitySystem;
}
