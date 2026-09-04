/**
 * vector-store.js - 向量化记忆的极简 IndexedDB 存储垫片
 *
 * 为 legacy/memory-recall.js 提供 storageService 所需的最小接口：
 *   L0 摘要层（loadAllEmbeddings / saveEmbedding / deleteEmbedding）
 *   L2 事件层（loadAllL2Embeddings / saveL2Embedding / deleteL2Embedding，含 npc/location/keywords 结构化字段）
 *
 * 实现方式：内存镜像 + IndexedDB 异步落盘。
 * vectorStore.init() 先把 IDB 数据读进镜像，之后同步读全部走镜像（legacy 契约是同步的），
 * 写操作同时更新镜像与 IDB。
 * 向量以 ArrayBuffer 存 IDB（JSON 无法序列化 TypedArray，IDB 可以）。
 * 数据库 calamity-vecmem v2：store embeddings（L0 摘要/篇章）+ events（L2 事件）。
 */
var vectorStore = (function() {
    const DB_NAME = 'calamity-vecmem';
    const DB_VERSION = 2;
    const STORE_L0 = 'embeddings';
    const STORE_L2 = 'events';
    let _db = null;
    let _mirror = [];    // L0: [{ id, vector, text, week, fingerprint, createdAt, kind }]
    let _mirrorL2 = [];  // L2: [{ id, vector, text, week, fingerprint, createdAt, npc, location, keywords }]
    let _loaded = false;

    function openDb() {
        return new Promise(function(resolve, reject) {
            if (_db) { resolve(_db); return; }
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = function(e) {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_L0)) {
                    db.createObjectStore(STORE_L0, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(STORE_L2)) {
                    db.createObjectStore(STORE_L2, { keyPath: 'id' });
                }
            };
            req.onsuccess = function(e) { _db = e.target.result; resolve(_db); };
            req.onerror = function(e) { reject(e.target.error || new Error('IDB 打开失败')); };
        });
    }

    function reqAsPromise(req) {
        return new Promise(function(resolve, reject) {
            req.onsuccess = function() { resolve(req.result); };
            req.onerror = function() { reject(req.error || new Error('IDB 请求失败')); };
        });
    }

    function getAllFrom(store) {
        return reqAsPromise(store.getAll()) || [];
    }

    // 镜像中的向量统一为 Float32Array（IDB 载入的是 ArrayBuffer，需转换，否则 .length 判断失效）
    function _normVec(v) {
        if (v instanceof Float32Array) return v;
        if (v instanceof ArrayBuffer) return new Float32Array(v);
        if (Array.isArray(v)) return new Float32Array(v);
        return null;
    }

    async function init() {
        try {
            const db = await openDb();
            _mirror = ((await getAllFrom(db.transaction(STORE_L0, 'readonly').objectStore(STORE_L0))) || [])
                .map(r => Object.assign({}, r, { vector: _normVec(r.vector) }));
            _mirrorL2 = ((await getAllFrom(db.transaction(STORE_L2, 'readonly').objectStore(STORE_L2))) || [])
                .map(r => Object.assign({}, r, { vector: _normVec(r.vector) }));
            _loaded = true;
            console.log('[VectorStore] 已从 IDB 载入 L0 摘要 ' + _mirror.length + ' 条 / L2 事件 ' + _mirrorL2.length + ' 条');
        } catch (e) {
            _mirror = [];
            _mirrorL2 = [];
            _loaded = true;
            console.warn('[VectorStore] IDB 载入失败（以空库运行）:', e && e.message || e);
        }
        return true;
    }

    /** 同步返回全量 L0 记录（legacy memory-recall.init() 的同步契约） */
    function loadAllEmbeddings() {
        return _mirror.slice();
    }

    /** 同步返回全量 L2 事件记录（legacy memory-recall.initL2() 的同步契约） */
    function loadAllL2Embeddings() {
        return _mirrorL2.slice();
    }

    async function saveEmbedding(id, f32, meta) {
        const rec = {
            id: id,
            vector: _normVec(f32),
            text: (meta && meta.text) || '',
            week: (meta && meta.week) || 0,
            fingerprint: (meta && meta.fingerprint) || '',
            createdAt: (meta && meta.createdAt) || Date.now(),
            kind: (meta && meta.kind) || 'turn',
            floor: (meta && meta.floor) || 0
        };
        const idx = _mirror.findIndex(r => r.id === id);
        if (idx >= 0) _mirror[idx] = rec; else _mirror.push(rec);
        try {
            const db = await openDb();
            const store = db.transaction(STORE_L0, 'readwrite').objectStore(STORE_L0);
            await reqAsPromise(store.put(Object.assign({}, rec, { vector: rec.vector ? rec.vector.buffer.slice(0) : null })));
        } catch (e) {
            console.warn('[VectorStore] IDB 落盘失败（仅内存保留）:', e && e.message || e);
        }
        return true;
    }

    async function deleteEmbedding(id) {
        _mirror = _mirror.filter(r => r.id !== id);
        try {
            const db = await openDb();
            const store = db.transaction(STORE_L0, 'readwrite').objectStore(STORE_L0);
            await reqAsPromise(store.delete(id));
        } catch (e) { /* 内存已删，落盘失败可容忍 */ }
        return true;
    }

    async function saveL2Embedding(id, f32, meta) {
        const rec = {
            id: id,
            vector: _normVec(f32),
            text: (meta && meta.text) || '',
            week: (meta && meta.week) || 0,
            fingerprint: (meta && meta.fingerprint) || '',
            createdAt: (meta && meta.createdAt) || Date.now(),
            npc: (meta && meta.npc) || [],
            location: (meta && meta.location) || '',
            keywords: (meta && meta.keywords) || []
        };
        const idx = _mirrorL2.findIndex(r => r.id === id);
        if (idx >= 0) _mirrorL2[idx] = rec; else _mirrorL2.push(rec);
        try {
            const db = await openDb();
            const store = db.transaction(STORE_L2, 'readwrite').objectStore(STORE_L2);
            await reqAsPromise(store.put(Object.assign({}, rec, { vector: rec.vector ? rec.vector.buffer.slice(0) : null })));
        } catch (e) {
            console.warn('[VectorStore] L2 落盘失败（仅内存保留）:', e && e.message || e);
        }
        return true;
    }

    async function deleteL2Embedding(id) {
        _mirrorL2 = _mirrorL2.filter(r => r.id !== id);
        try {
            const db = await openDb();
            const store = db.transaction(STORE_L2, 'readwrite').objectStore(STORE_L2);
            await reqAsPromise(store.delete(id));
        } catch (e) { /* ignore */ }
        return true;
    }

    async function clearAll() {
        _mirror = [];
        _mirrorL2 = [];
        try {
            const db = await openDb();
            await reqAsPromise(db.transaction(STORE_L0, 'readwrite').objectStore(STORE_L0).clear());
            await reqAsPromise(db.transaction(STORE_L2, 'readwrite').objectStore(STORE_L2).clear());
        } catch (e) { /* ignore */ }
        return true;
    }

    return {
        init: init,
        loadAllEmbeddings: loadAllEmbeddings,
        saveEmbedding: saveEmbedding,
        deleteEmbedding: deleteEmbedding,
        loadAllL2Embeddings: loadAllL2Embeddings,
        saveL2Embedding: saveL2Embedding,
        deleteL2Embedding: deleteL2Embedding,
        clearAll: clearAll
    };
})();

if (typeof window !== 'undefined') {
    window.vectorStore = vectorStore;
    // memory-recall.js 的 init()/initL2() 通过全局 storageService 预热缓存
    window.storageService = window.storageService || vectorStore;
}
