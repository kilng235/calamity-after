/**
 * battle-tracker.js - 战斗追踪器（P1：战斗状态可见化）
 *
 * 职责：解析 AI 输出的 <battle> 卡（含跨回合的延续卡），维护内存态战斗快照
 *   battleState = { active, round, distance, result, actors[] }
 * 并渲染右侧「战斗信息」面板（主角 HP 条 + 敌人 HP 条 + 回合/距离）。
 *
 * 设计边界：
 *   - 敌人 HP 来自卡内 HP 行 `[ 名称 HP：剩余/上限 ]`（「输出格式·战斗」协议），不进 gameData
 *   - 主角 HP 以命令引擎落地值（gameData.hp）为权威，渲染时实时读取
 *   - 回合撤销后由 rebuildFromNarrative() 从叙事流最后一张战斗卡重建（DOM 即真相）
 *   - 同时兼容原始卡文本与渲染后 DOM 文本（渲染器会改写部分行首标记）
 */
var battleTracker = (function() {

    // _state 战斗快照；_hasBattle 标记本局游戏是否出现过战斗
    let _state = null;
    let _hasBattle = false;

    function _blankState(playerName) {
        return {
            active: true,
            round: 0,
            distance: '',
            result: null,
            playerName: playerName,
            actors: []      // {name, side:'player'|'enemy', hp:{cur,max}|null, lastHit}
        };
    }

    function resetState(playerName) {
        _state = _blankState(playerName || '冒险者');
    }

    /** 确保主角在 actors 里（置顶） */
    function _ensurePlayer(state, playerName) {
        let p = state.actors.find(a => a.side === 'player');
        if (!p) {
            p = { name: playerName, side: 'player', hp: null, lastHit: null };
            state.actors.unshift(p);
        }
        p.name = playerName;
        return p;
    }

    /** 从先攻顺序行提取行动者名单（保留已追踪的 HP——跨卡延续可能重复先攻行） */
    function _parseInitiative(line, playerName) {
        const body = line.replace(/^([^：:]*)[:：]/, '').trim();
        const parts = body.split(/[→→]+/).map(s => s.trim()).filter(Boolean);
        const state = _state;
        const prev = new Map(state.actors.map(a => [a.name, a]));
        state.actors = [];
        _ensurePlayer(state, playerName);
        for (const part of parts) {
            const name = part.replace(/[（(][^）)]*[）)]/g, '').trim();
            if (!name) continue;
            const isPlayer = name === playerName;
            if (isPlayer) continue;   // 主角已置顶
            if (state.actors.some(a => a.name === name)) continue;
            state.actors.push(prev.get(name) || { name: name, side: 'enemy', hp: null, lastHit: null });
        }
    }

    /**
     * 摄取一张 battle 卡文本（原始格式或渲染后文本均可）
     * @returns 修改后的 state（供测试断言）
     */
    function ingest(text, gd) {
        const playerName = (gd && gd.character && gd.character.name) || '冒险者';
        const raw = String(text || '');
        if (!raw.trim()) return _state;

        // 战斗激活判定：开始横幅 / 先攻顺序 / 敌人 HP 行，任一锚点即可开启战斗上下文
        const startsWithBanner = /战斗开始/.test(raw);
        const hasAnchors = startsWithBanner
            || /先攻顺序[:：]/.test(raw)
            || /\[\s*[^\]\n]+?\s+HP\s*[:：]/.test(raw);
        if (startsWithBanner) {
            resetState(playerName);
            _hasBattle = true;
        } else if (!_hasBattle || !_state) {
            if (!hasAnchors) {
                // 无战斗开始标记且无任何战斗锚点 → 普通文本，忽略
                return _state;
            }
            resetState(playerName);
            _hasBattle = true;
        }

        let currentTurnName = null;   // 当前回合块的行动者

        for (let rawLine of raw.split('\n')) {
            const line = rawLine.trim();
            if (!line) continue;

            // 回合分隔
            let m = line.match(/第\s*(\d+)\s*回合/);
            if (m) { _state.round = parseInt(m[1]); continue; }

            // 先攻顺序（原始行与渲染行两种形态）
            m = line.match(/^(?:✦\s*)?先攻顺序[:：]\s*(.+)$/) || line.match(/^✦\s*先攻[:：]\s*(.+)$/);
            if (m) { _parseInitiative(m[1], playerName); continue; }

            // 交战距离（原始与渲染形态）
            m = line.match(/^交战距离[:：]\s*(.+)$/) || line.match(/^↔\s*(.+)$/);
            if (m) { _state.distance = m[1].trim(); continue; }

            // 行动者回合标记（原始【X的回合】/ 渲染 ◆ X）
            m = line.match(/^【(.+?)(?:的回合)?】/) || line.match(/^◆\s*(.+)$/);
            if (m) {
                currentTurnName = m[1].trim();
                continue;
            }

            // 敌人 HP 行：[ 名称 HP：a/b ]
            m = line.match(/^\[?\s*(.+?)\s+HP\s*[:：]\s*(\d+)\s*\/\s*(\d+)\s*\]?$/);
            if (m) {
                const name = m[1].trim();
                let actor = _state.actors.find(a => a.name === name);
                if (!actor) {
                    actor = { name: name, side: 'enemy', hp: null, lastHit: null };
                    _state.actors.push(actor);
                }
                actor.hp = { cur: parseInt(m[2]), max: parseInt(m[3]) };
                continue;
            }

            // 伤害行：[ 伤害：N ]（记录到当前回合行动者名下，供 P2 数学校验使用）
            m = line.match(/^\[\s*伤害[:：]\s*(\d+)\s*\]$/);
            if (m) {
                const actor = _state.actors.find(a => a.name === currentTurnName);
                if (actor) actor.lastHit = { damage: parseInt(m[1]) };
                continue;
            }

            // 战斗结果
            m = line.match(/(胜利|战败|逃脱|已死亡)/);
            if (m && !/横幅|banner/.test(line)) {
                _state.result = m[1];
                _state.active = false;
                continue;
            }
        }
        return _state;
    }

    /** 从叙事流最后一张战斗卡重建（撤销后调用；渲染后文本同样可解析） */
    function rebuildFromNarrative() {
        const nd = document.getElementById('narrative-display');
        const gd = (window.gameData !== undefined) ? window.gameData : null;
        if (!nd) return _state;
        const cards = nd.querySelectorAll('.battle-card');
        if (!cards.length) {
            _state = null;
            _hasBattle = false;
            return _state;
        }
        const last = cards[cards.length - 1];
        ingest(last.textContent, gd);
        return _state;
    }

    // ───────── 面板渲染 ─────────

    function _hpBar(cur, max) {
        const pct = max > 0 ? Math.max(0, Math.min(100, Math.round(cur / max * 100))) : 0;
        return '<div class="bi-hp"><div class="bi-hp-fill" style="width:' + pct + '%"></div></div>';
    }

    function renderPanel() {
        const panel = document.getElementById('combat-info') || document.getElementById('battle-info');
        if (!panel) return;
        const gd = (window.gameData !== undefined) ? window.gameData : null;

        if (!_hasBattle || !_state) {
            panel.innerHTML = '<div style="color: var(--ink-faded);">当前无战斗</div>';
            return;
        }

        const html = [];
        // 头部：回合/距离/结果
        const head = [];
        if (_state.round > 0) head.push('第 ' + _state.round + ' 回合');
        if (_state.distance) head.push('↔ ' + _state.distance);
        html.push('<div class="bi-head">' + (head.length ? head.join(' ｜ ') : '战斗进行中') + '</div>');

        if (_state.result) {
            html.push('<div class="bi-result ' + (_state.result === '胜利' ? 'win' : 'lose') + '">⚔ ' + _state.result + '</div>');
        }

        // 主角 HP 条（gameData 权威）
        if (gd && gd.hp) {
            html.push(
                '<div class="bi-row">' +
                  '<div class="bi-name">' + (gd.character && gd.character.name || '冒险者') + '</div>' +
                  _hpBar(gd.hp.current, gd.hp.max) +
                  '<div class="bi-hp-text">' + gd.hp.current + '/' + gd.hp.max + '</div>' +
                '</div>'
            );
        }

        // 敌人 HP 条（卡内 HP 行）
        _state.actors.filter(a => a.side === 'enemy').forEach(a => {
            const hp = a.hp;
            html.push(
                '<div class="bi-row' + (hp && hp.cur <= 0 ? ' bi-dead' : '') + '">' +
                  '<div class="bi-name">' + a.name + '</div>' +
                  (hp ? _hpBar(hp.cur, hp.max) + '<div class="bi-hp-text">' + hp.cur + '/' + hp.max + '</div>'
                      : '<div class="bi-hp-text">—</div>') +
                '</div>'
            );
        });

        panel.innerHTML = html.join('');
    }

    function getState() { return _state; }
    function hasBattle() { return _hasBattle; }
    /** 测试/调试：强制重置 */
    function _reset(playerName) { _state = null; _hasBattle = false; if (playerName !== undefined) resetState(playerName); }

    return {
        ingest: ingest,
        rebuildFromNarrative: rebuildFromNarrative,
        renderPanel: renderPanel,
        getState: getState,
        hasBattle: hasBattle,
        _reset: _reset
    };
})();

if (typeof window !== 'undefined') {
    window.battleTracker = battleTracker;
}
