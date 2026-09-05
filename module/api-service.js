/**
 * api-service.js - API 调用服务
 * 支持 OpenAI 兼容格式 + Gemini，流式 / 非流式。
 * 
 * 依赖：无
 */

var apiService = (function() {
    var config = {
        endpoint: '',
        apiKey: '',
        model: '',
        type: 'openai',
        temperature: 0.9,
        // 采样参数排除开关：仿 SillyTavern「排除该参数」——关闭时请求体里完全不带该字段，
        // 由服务端/模型自身默认值决定；开启时才带上下面的具体数值。默认全部关闭（不发送）。
        topP: 1,                    topPEnabled: false,
        topK: 200,                  topKEnabled: false,
        frequencyPenalty: 0.3,      frequencyPenaltyEnabled: false,
        presencePenalty: 0.2,       presencePenaltyEnabled: false,
        maxOutputTokens: 18000,
        maxContextTokens: 500000,
        streamMode: 'stream',  // 'stream' 流式 | 'non-stream' 非流式（正文与总结统一遵循）
        corsProxyUrl: '',      // 不内置第三方代理；需要跨域中转时在设置页填入自建代理地址（如 Cloudflare Worker）
        // 是否启用 CORS 代理。默认关闭（已移除内置第三方 Worker——经公共代理转发的 Key 与对话内容存在泄露风险）。
        // 用户在配置页填入自建代理地址并勾选后才启用。
        corsProxyEnabled: false
    };

    function loadConfig() {
        try {
            var saved = localStorage.getItem('jxz_apiConfig');
            if (saved) {
                var parsed = JSON.parse(saved);
                Object.assign(config, parsed);
                // 迁移：清除历史版本内置的第三方公共代理（jxz-cors-proxy Worker）——
                // 旧存档 localStorage 里可能仍保存着该地址，一并清除并停用
                if (config.corsProxyUrl && config.corsProxyUrl.indexOf('jxz-cors-proxy') >= 0) {
                    config.corsProxyUrl = '';
                    config.corsProxyEnabled = false;
                    try { saveConfig(); } catch (e) { /* ignore */ }   // 一次性洗掉 localStorage 里的旧地址
                    console.warn('[API] 已清除内置第三方 CORS 代理（隐私风险），如需中转请在设置页配置自建代理');
                }
            }
        } catch (e) {
            console.warn('加载 API 配置失败', e);
        }
    }

    function saveConfig() {
        localStorage.setItem('jxz_apiConfig', JSON.stringify(config));
    }

    function getConfig() {
        return config;
    }

    function updateConfig(newConfig) {
        Object.assign(config, newConfig);
        saveConfig();
    }

    // ========== 环境检测 & CORS 代理路由 ==========

    /**
     * 检测当前运行环境
     * @returns {'file'|'electron'|'webview'|'web'}
     */
    function _getRunEnv() {
        // Electron 环境
        if (typeof process !== 'undefined' && process.versions && process.versions.electron) {
            return 'electron';
        }
        // Android WebView（通过 window.Android 或 userAgent 判断）
        if (typeof window !== 'undefined' && window.Android) {
            return 'webview';
        }
        // file:// 协议本地运行
        if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
            return 'file';
        }
        // 其他：线上 web 部署
        return 'web';
    }

    /**
     * 根据启用开关决定实际请求 URL
     * 勾选启用且配置了 corsProxyUrl 时，通过代理中转（不再限定环境，APK 勾选后也可走代理）
     * @param {string} url - 原始 API URL
     * @returns {string}
     */
    function _resolveUrl(url) {
        if (config.corsProxyEnabled && config.corsProxyUrl) {
            var proxy = config.corsProxyUrl.replace(/\/+$/, '');
            return proxy + '?target=' + encodeURIComponent(url);
        }
        return url;
    }

    // 解析本次请求的最大输出 token：
    // - options.maxOutputTokens === null → 不限制（省略 max_tokens，由模型默认上限决定）
    // - 数字 → 使用该值
    // - 未指定 → 使用全局配置 config.maxOutputTokens
    function _resolveMaxOutputTokens(options) {
        if (options && Object.prototype.hasOwnProperty.call(options, 'maxOutputTokens')) {
            return options.maxOutputTokens;
        }
        return config.maxOutputTokens;
    }

    // 按「排除开关」把已启用的采样参数写进请求体/generationConfig；关闭的参数完全不写入 key，
    // 交由服务端/模型自身默认值决定（与 SillyTavern「排除该参数」效果一致）。
    // isGemini=true 时用 Gemini 的 camelCase 字段名，否则用 OpenAI 兼容的 snake_case。
    function _applyExtraSamplerParams(target, isGemini) {
        if (config.topPEnabled) target[isGemini ? 'topP' : 'top_p'] = config.topP;
        // top_k 仅 Gemini 原生支持；OpenAI 兼容接口会忽略该字段，严格实现还可能报 4xx，故不发送
        if (config.topKEnabled && isGemini) target.topK = config.topK;
        if (config.frequencyPenaltyEnabled) target[isGemini ? 'frequencyPenalty' : 'frequency_penalty'] = config.frequencyPenalty;
        if (config.presencePenaltyEnabled) target[isGemini ? 'presencePenalty' : 'presence_penalty'] = config.presencePenalty;
    }

    // 非流式请求默认超时（毫秒）：挂起时中断 fetch，避免调用方 busy 锁死
    var DEFAULT_REQUEST_TIMEOUT = 180000;

    async function sendMessages(messages, options) {
        // 调用级覆盖（记忆系统副API用）：options 传入 endpoint/apiKey/model/type 时使用覆盖配置
        var cfg = config;
        if (options && (options.endpoint || options.apiKey || options.model)) {
            cfg = Object.assign({}, config, {
                endpoint: options.endpoint || config.endpoint,
                apiKey: options.apiKey || config.apiKey,
                model: options.model || config.model,
                type: options.type || config.type
            });
        }
        if (!cfg.endpoint || !cfg.apiKey || !cfg.model) {
            throw new Error('请先配置 API 信息（endpoint, key, model）');
        }
        var signal = options && options.signal;
        var timeoutMs = (options && options.timeoutMs) || config.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT;
        if (!signal) {
            var controller = new AbortController();
            signal = controller.signal;
            setTimeout(function() { controller.abort(); }, timeoutMs);
        }
        var maxTokens = _resolveMaxOutputTokens(options);
        var temperature = (options && typeof options.temperature === 'number') ? options.temperature : null;
        try {
            if (cfg.type === 'gemini') {
                return await _callGemini(messages, signal, maxTokens, cfg, temperature);
            }
            return await _callOpenAI(messages, signal, maxTokens, cfg, temperature);
        } catch (e) {
            if (e && (e.name === 'AbortError' || e.name === 'TimeoutError')) {
                throw new Error('请求超时（' + Math.round(timeoutMs / 1000) + ' 秒），已中断');
            }
            throw e;
        }
    }

    async function _callOpenAI(messages, signal, maxTokens, cfg, temperature) {
        cfg = cfg || config;
        var url = _resolveUrl(cfg.endpoint.replace(/\/+$/, '') + '/chat/completions');
        console.log('[API] 发送请求到 OpenAI:', url);
        var _reqBody = {
            model: cfg.model,
            messages: messages,
            temperature: (typeof temperature === 'number') ? temperature : cfg.temperature
        };
        // maxTokens 为 null 表示不限制（省略 max_tokens）；数字按值；undefined 回退全局配置
        if (typeof maxTokens === 'number') {
            _reqBody.max_tokens = maxTokens;
        } else if (typeof maxTokens === 'undefined') {
            _reqBody.max_tokens = cfg.maxOutputTokens;
        }
        _applyExtraSamplerParams(_reqBody, false);
        var fetchOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + cfg.apiKey
            },
            body: JSON.stringify(_reqBody)
        };
        if (signal) fetchOptions.signal = signal;
        var response = await fetch(url, fetchOptions);
        if (!response.ok) {
            var text = '';
            try { text = await response.text(); } catch (e) {}
            throw new Error('API 错误 ' + response.status + (text ? ': ' + text.substring(0, 200) : ''));
        }
        var data = await response.json();
        console.log('[API] OpenAI 响应, usage:', data.usage);
        return {
            content: data.choices[0].message.content,
            usage: data.usage
        };
    }

    async function _callGemini(messages, signal, maxTokens, cfg, temperature) {
        cfg = cfg || config;
        var systemMsgs = messages.filter(function(m) { return m.role === 'system'; });
        var chatMsgs = messages.filter(function(m) { return m.role !== 'system'; });
        var systemPrompt = systemMsgs.map(function(m) { return m.content; }).join('\n\n');

        var contents = chatMsgs.map(function(m) {
            return {
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            };
        });

        var url = _resolveUrl(cfg.endpoint.replace(/\/+$/, '') + '/models/' + cfg.model + ':generateContent');
        console.log('[API] 发送请求到 Gemini:', url);

        var _genConfig = { temperature: (typeof temperature === 'number') ? temperature : cfg.temperature };
        if (typeof maxTokens === 'number') {
            _genConfig.maxOutputTokens = maxTokens;
        } else if (typeof maxTokens === 'undefined') {
            _genConfig.maxOutputTokens = cfg.maxOutputTokens;
        }
        _applyExtraSamplerParams(_genConfig, true);
        var response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey },
            body: JSON.stringify({
                contents: contents,
                systemInstruction: { parts: [{ text: systemPrompt }] },
                generationConfig: _genConfig
            })
        });
        if (!response.ok) {
            var text = '';
            try { text = await response.text(); } catch (e) {}
            throw new Error('Gemini 错误 ' + response.status + (text ? ': ' + text.substring(0, 200) : ''));
        }
        var data = await response.json();
        console.log('[API] Gemini 响应, usage:', data.usageMetadata);
        return {
            content: data.candidates[0].content.parts[0].text,
            usage: data.usageMetadata
        };
    }

    // ========== 模型列表 ==========

    async function fetchModels(endpoint, apiKey, type) {
        if (!endpoint || !apiKey) {
            throw new Error('请填写 API 地址和 Key');
        }
        if (type === 'gemini') {
            return _fetchGeminiModels(endpoint, apiKey);
        }
        return _fetchOpenAIModels(endpoint, apiKey);
    }

    async function _fetchOpenAIModels(endpoint, apiKey) {
        var url = _resolveUrl(endpoint.replace(/\/+$/, '') + '/models');
        var response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + apiKey }
        });
        if (!response.ok) {
            var text = '';
            try { text = await response.text(); } catch (e) {}
            throw new Error('获取模型列表失败 ' + response.status + (text ? ': ' + text.substring(0, 200) : ''));
        }
        var data = await response.json();
        var models = (data.data || []).map(function(m) {
            return { id: m.id, name: m.id };
        });
        // 按 id 字母排序
        models.sort(function(a, b) { return a.id.localeCompare(b.id); });
        return models;
    }

    async function _fetchGeminiModels(endpoint, apiKey) {
        var url = _resolveUrl(endpoint.replace(/\/+$/, '') + '/models');
        var response = await fetch(url, {
            method: 'GET',
            headers: { 'x-goog-api-key': apiKey }
        });
        if (!response.ok) {
            var text = '';
            try { text = await response.text(); } catch (e) {}
            throw new Error('获取模型列表失败 ' + response.status + (text ? ': ' + text.substring(0, 200) : ''));
        }
        var data = await response.json();
        var models = (data.models || []).map(function(m) {
            // Gemini 返回 "models/gemini-pro" 格式，只取后半部分
            var id = m.name || '';
            if (id.indexOf('models/') === 0) id = id.substring(7);
            return { id: id, name: m.displayName || id };
        });
        models.sort(function(a, b) { return a.id.localeCompare(b.id); });
        return models;
    }

    // ========== 测试消息 ==========

    async function sendTestMessage(tempConfig) {
        if (!tempConfig.endpoint || !tempConfig.apiKey || !tempConfig.model) {
            return { success: false, content: '', error: '请填写完整的 API 信息' };
        }
        var testMessages = [{ role: 'user', content: '你好，请用一句话回复' }];
        try {
            var result;
            if (tempConfig.type === 'gemini') {
                result = await _callGeminiWith(tempConfig, testMessages);
            } else {
                result = await _callOpenAIWith(tempConfig, testMessages);
            }
            return { success: true, content: result.content, error: '' };
        } catch (e) {
            return { success: false, content: '', error: e.message };
        }
    }

    async function _callOpenAIWith(cfg, messages) {
        var url = cfg.endpoint.replace(/\/+$/, '') + '/chat/completions';
        var response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + cfg.apiKey
            },
            body: JSON.stringify({
                model: cfg.model,
                messages: messages,
                temperature: cfg.temperature || 0.85,
                max_tokens: 100
            })
        });
        if (!response.ok) {
            var text = '';
            try { text = await response.text(); } catch (e) {}
            throw new Error('API 错误 ' + response.status + (text ? ': ' + text.substring(0, 200) : ''));
        }
        var data = await response.json();
        return { content: data.choices[0].message.content };
    }

    async function _callGeminiWith(cfg, messages) {
        var contents = messages.map(function(m) {
            return { role: 'user', parts: [{ text: m.content }] };
        });
        var url = cfg.endpoint.replace(/\/+$/, '') + '/models/' + cfg.model + ':generateContent';
        var response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey },
            body: JSON.stringify({
                contents: contents,
                generationConfig: { temperature: cfg.temperature || 0.85, maxOutputTokens: 100 }
            })
        });
        if (!response.ok) {
            var text = '';
            try { text = await response.text(); } catch (e) {}
            throw new Error('Gemini 错误 ' + response.status + (text ? ': ' + text.substring(0, 200) : ''));
        }
        var data = await response.json();
        return { content: data.candidates[0].content.parts[0].text };
    }

    // ========== 流式调用 (SSE) ==========

    /**
     * 流式发送消息
     * @param {Array} messages - 消息数组
     * @param {object} callbacks - { onToken(text), onThinking(text), onComplete(fullText, usage), onError(err) }
     * @returns {{ abort: Function }} 中断控制器
     */
    function sendMessagesStream(messages, callbacks, options) {
        if (!config.endpoint || !config.apiKey || !config.model) {
            callbacks.onError(new Error('请先配置 API 信息'));
            return { abort: function() {} };
        }

        var controller = new AbortController();
        var maxTokens = _resolveMaxOutputTokens(options);

        if (config.type === 'gemini') {
            _streamGemini(messages, callbacks, controller, maxTokens);
        } else {
            _streamOpenAI(messages, callbacks, controller, maxTokens);
        }

        return { abort: function() { controller.abort(); } };
    }

    async function _streamOpenAI(messages, callbacks, controller, maxTokens) {
        var url = _resolveUrl(config.endpoint.replace(/\/+$/, '') + '/chat/completions');
        var fullContent = '';
        var fullThinking = '';

        var requestBody = {
            model: config.model,
            messages: messages,
            temperature: config.temperature,
            stream: true
        };
        // maxTokens 为 null 表示不限制（省略 max_tokens）；数字按值；undefined 回退全局配置
        if (typeof maxTokens === 'number') {
            requestBody.max_tokens = maxTokens;
        } else if (typeof maxTokens === 'undefined') {
            requestBody.max_tokens = config.maxOutputTokens;
        }
        _applyExtraSamplerParams(requestBody, false);
        console.log('[API][DEBUG] 流式请求 body (非messages部分):', JSON.stringify({
            model: requestBody.model,
            temperature: requestBody.temperature,
            max_tokens: requestBody.max_tokens,
            stream: requestBody.stream
        }));

        try {
            var response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + config.apiKey
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            if (!response.ok) {
                var errText = '';
                try { errText = await response.text(); } catch (e) {}
                throw new Error('API 错误 ' + response.status + (errText ? ': ' + errText.substring(0, 200) : ''));
            }

            var reader = response.body.getReader();
            var decoder = new TextDecoder();
            var buffer = '';

            while (true) {
                var readResult = await reader.read();
                if (readResult.done) break;

                buffer += decoder.decode(readResult.value, { stream: true });
                var lines = buffer.split('\n');
                buffer = lines.pop(); // 保留不完整的最后一行

                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i].trim();
                    if (!line || !line.startsWith('data: ')) continue;
                    var dataStr = line.substring(6);
                    if (dataStr === '[DONE]') {
                        callbacks.onComplete(fullContent, null);
                        return;
                    }
                    try {
                        var chunk = JSON.parse(dataStr);
                        var delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
                        if (!delta) continue;

                        // DeepSeek reasoning_content（思考链）
                        if (delta.reasoning_content) {
                            fullThinking += delta.reasoning_content;
                            if (callbacks.onThinking) callbacks.onThinking(delta.reasoning_content);
                        }
                        // 正常内容
                        if (delta.content) {
                            fullContent += delta.content;
                            callbacks.onToken(delta.content);
                        }
                    } catch (e) {
                        // JSON 解析失败，跳过
                    }
                }
            }
            // 流结束但没收到 [DONE]
            callbacks.onComplete(fullContent, null);
        } catch (err) {
            if (err.name === 'AbortError') {
                // 用户中断，将已收到的内容作为完成
                callbacks.onComplete(fullContent, null);
            } else {
                callbacks.onError(err);
            }
        }
    }

    async function _streamGemini(messages, callbacks, controller, maxTokens) {
        var systemMsgs = messages.filter(function(m) { return m.role === 'system'; });
        var chatMsgs = messages.filter(function(m) { return m.role !== 'system'; });
        var systemPrompt = systemMsgs.map(function(m) { return m.content; }).join('\n\n');
        var contents = chatMsgs.map(function(m) {
            return {
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            };
        });

        var url = _resolveUrl(config.endpoint.replace(/\/+$/, '') + '/models/' + config.model + ':streamGenerateContent?alt=sse');
        var fullContent = '';
        var _streamGenConfig = { temperature: config.temperature };
        if (typeof maxTokens === 'number') {
            _streamGenConfig.maxOutputTokens = maxTokens;
        } else if (typeof maxTokens === 'undefined') {
            _streamGenConfig.maxOutputTokens = config.maxOutputTokens;
        }
        _applyExtraSamplerParams(_streamGenConfig, true);

        try {
            var response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
                body: JSON.stringify({
                    contents: contents,
                    systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
                    generationConfig: _streamGenConfig
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                var errText = '';
                try { errText = await response.text(); } catch (e) {}
                throw new Error('Gemini 错误 ' + response.status + (errText ? ': ' + errText.substring(0, 200) : ''));
            }

            var reader = response.body.getReader();
            var decoder = new TextDecoder();
            var buffer = '';

            while (true) {
                var readResult = await reader.read();
                if (readResult.done) break;

                buffer += decoder.decode(readResult.value, { stream: true });
                var lines = buffer.split('\n');
                buffer = lines.pop();

                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i].trim();
                    if (!line || !line.startsWith('data: ')) continue;
                    var dataStr = line.substring(6);
                    try {
                        var chunk = JSON.parse(dataStr);
                        var parts = chunk.candidates && chunk.candidates[0] &&
                                    chunk.candidates[0].content && chunk.candidates[0].content.parts;
                        if (parts && parts.length > 0 && parts[0].text) {
                            var text = parts[0].text;
                            fullContent += text;
                            callbacks.onToken(text);
                        }
                    } catch (e) {
                        // JSON 解析失败，跳过
                    }
                }
            }
            callbacks.onComplete(fullContent, null);
        } catch (err) {
            if (err.name === 'AbortError') {
                callbacks.onComplete(fullContent, null);
            } else {
                callbacks.onError(err);
            }
        }
    }

    // ========== 健康检查 ==========

    async function healthCheck() {
        try {
            await sendMessages([{ role: 'user', content: 'ping' }]);
            return true;
        } catch (e) {
            return false;
        }
    }

    return {
        loadConfig: loadConfig,
        saveConfig: saveConfig,
        getConfig: getConfig,
        updateConfig: updateConfig,
        sendMessages: sendMessages,
        sendMessagesStream: sendMessagesStream,
        fetchModels: fetchModels,
        sendTestMessage: sendTestMessage,
        healthCheck: healthCheck,
        getRunEnv: _getRunEnv,
        // ST 预设接入：把 ST 预设的生成参数合到当前 config
        applyGenerationParams: applyGenerationParams,
        resetGenerationParams: resetGenerationParams
    };
})();

/**
 * 把 ST 预设的 generation 字段合到当前 apiService.config
 * 只覆盖非 null 的字段；保留灾厄之后自定义的 endpoint/apiKey/model 不动
 * @param {Object} generation
 */
function applyGenerationParams(generation) {
    if (!generation || typeof generation !== 'object') return false;
    var current = apiService.getConfig();
    var next = Object.assign({}, current);
    if (typeof generation.temperature === 'number') {
        next.temperature = generation.temperature;
    }
    if (typeof generation.top_p === 'number') {
        next.topP = generation.top_p;
        next.topPEnabled = true;
    }
    if (typeof generation.top_k === 'number' && generation.top_k > 0) {
        next.topK = generation.top_k;
        next.topKEnabled = true;
    }
    if (typeof generation.frequency_penalty === 'number') {
        next.frequencyPenalty = generation.frequency_penalty;
        next.frequencyPenaltyEnabled = true;
    }
    if (typeof generation.presence_penalty === 'number') {
        next.presencePenalty = generation.presence_penalty;
        next.presencePenaltyEnabled = true;
    }
    if (typeof generation.max_output_tokens === 'number' && generation.max_output_tokens > 0) {
        next.maxOutputTokens = generation.max_output_tokens;
    }
    if (typeof generation.max_context_tokens === 'number' && generation.max_context_tokens > 0) {
        next.maxContextTokens = generation.max_context_tokens;
    }
    if (typeof generation.stream === 'boolean') {
        next.streamMode = generation.stream ? 'stream' : 'non-stream';
    }
    apiService.updateConfig(next);
    return true;
}

function resetGenerationParams() {
    apiService.updateConfig({
        temperature: 0.9,
        topP: 1, topPEnabled: false,
        topK: 200, topKEnabled: false,
        frequencyPenalty: 0.3, frequencyPenaltyEnabled: false,
        presencePenalty: 0.2, presencePenaltyEnabled: false,
        maxOutputTokens: 18000,
        streamMode: 'stream'
    });
    return true;
}
