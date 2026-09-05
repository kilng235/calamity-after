/**
 * memory-api.js - 记忆系统副 API 通道
 *
 * 记忆系统的全部 LLM 调用（三级压缩、主观记忆提取、台账维护）统一走这里：
 *   - 配置了 calamity-memory-api（{endpoint, apiKey, model, type}）→ 使用独立渠道
 *   - 未配置 → 自动跟随主对话 API（apiService 自身配置）
 *
 * 传输复用 apiService（其 sendMessages 支持调用级 endpoint/apiKey/model 覆盖），
 * 因此主对话的流式/超时/代理逻辑对记忆调用同样生效。
 */
var memoryApi = (function() {
    const LS_KEY = 'calamity-memory-api';

    function getStored() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (!raw) return null;
            const cfg = JSON.parse(raw);
            return (cfg && cfg.endpoint && cfg.apiKey && cfg.model) ? cfg : null;
        } catch (e) { return null; }
    }

    function saveConfig(cfg) {
        try {
            if (cfg && cfg.endpoint && cfg.apiKey && cfg.model) {
                localStorage.setItem(LS_KEY, JSON.stringify({
                    endpoint: cfg.endpoint, apiKey: cfg.apiKey,
                    model: cfg.model, type: cfg.type || 'openai'
                }));
            } else {
                localStorage.removeItem(LS_KEY);
            }
        } catch (e) { /* ignore */ }
    }

    function getConfig() {
        return getStored() || (window.apiService ? apiService.getConfig() : null);
    }

    /** 是否处于独立渠道（供 UI 显示"独立/跟随主API"） */
    function isIndependent() { return !!getStored(); }

    async function sendMessages(messages, options) {
        const override = getStored();
        const opts = Object.assign({}, options || {});
        if (override) {
            opts.endpoint = override.endpoint;
            opts.apiKey = override.apiKey;
            opts.model = override.model;
            opts.type = override.type;
        }
        return apiService.sendMessages(messages, opts);
    }

    return {
        getConfig: getConfig,
        saveConfig: saveConfig,
        isIndependent: isIndependent,
        sendMessages: sendMessages
    };
})();

if (typeof window !== 'undefined') {
    window.memoryApi = memoryApi;
}
