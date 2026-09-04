/**
 * vector-store.js - 向量化记忆的极简 IndexedDB 存储垫片
 *
 * 为 legacy/memory-recall.js 提供 storageService 所需的最小接口：
 *   - loadAllEmbeddings(): 同步返回全量向量记录（供启动预热缓存，legacy 契约是同步的）
 *   - saveEmbedding(id, f32, meta): 写入单条（meta = { text, week, fingerprint, createdAt }）
 *   - deleteEmbedding(id) / clearAll()
 *
 * 实现方式：内存镜像 + IndexedDB 异步落盘。
 * vectorStore.init() 先把 IDB 数据读进镜像，之后同步读全部走镜像，写操作同时更新镜像与 IDB。
 * 向量以 ArrayBuffer 存 IDB（JSON 无法序列化 TypedArray，IDB 可以）。
 * 数据库名 calamity-vecmem / objectStore embeddings（keyPath id）。
 */
var vectorStore = (function() {
    const DB_NAME = 'calamity-vecmem';
    const STORE = 'embeddings';
    let _db = null;
    let _mirror = [];   // [{ id, vector: ArrayBuffer|Float32Array, text, week, fingerprint, createdAt }]
    let _loaded = false;

    function openDb() {
        return new Promise(function(resolve, reject) {
            if (_db) { resolve(_db); return; }
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = function(e) {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE, { keyPath: 'id' });
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

    async function init() {
        try {
            const db = await openDb();
            const store = db.transaction(STORE, 'readonly').objectStore(STORE);
            const all = await reqAsPromise(store.getAll());
            _mirror = all || [];
            _loaded = true;
            console.log('[VectorStore] 已从 IDB 载入 ' + _mirror.length + ' 条向量记录');
        } catch (e) {
            _mirror = [];
            _loaded = true;
            console.warn('[VectorStore] IDB 载入失败（以空库运行）:', e && e.message || e);
        }
        return true;
    }

    /**
     * 同步返回全量记录（legacy memory-recall.init() 的同步契约）
     */
    function loadAllEmbeddings() {
        return _mirror.slice();
    }

    async function saveEmbedding(id, f32, meta) {
        const rec = {
            id: id,
            vector: f32 instanceof Float32Array ? f32.buffer.slice(0) : f32,
            text: (meta && meta.text) || '',
            week: (meta && meta.week) || 0,
            fingerprint: (meta && meta.fingerprint) || '',
            createdAt: (meta && meta.createdAt) || Date.now()
        };
        const idx = _mirror.findIndex(r => r.id === id);
        if (idx >= 0) _mirror[idx] = rec; else _mirror.push(rec);
        try {
            const db = await openDb();
            const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
            await reqAsPromise(store.put(rec));
        } catch (e) {
            console.warn('[VectorStore] IDB 落盘失败（仅内存保留）:', e && e.message || e);
        }
        return true;
    }

    async function deleteEmbedding(id) {
        _mirror = _mirror.filter(r => r.id !== id);
        try {
            const db = await openDb();
            const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
            await reqAsPromise(store.delete(id));
        } catch (e) { /* 内存已删，落盘失败可容忍 */ }
        return true;
    }

    async function clearAll() {
        _mirror = [];
        try {
            const db = await openDb();
            const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
            await reqAsPromise(store.clear());
        } catch (e) { /* ignore */ }
        return true;
    }

    return {
        init: init,
        loadAllEmbeddings: loadAllEmbeddings,
        saveEmbedding: saveEmbedding,
        deleteEmbedding: deleteEmbedding,
        clearAll: clearAll
    };
})();

if (typeof window !== 'undefined') {
    window.vectorStore = vectorStore;
    // memory-recall.js 的 init() 通过全局 storageService.loadAllEmbeddings() 预热缓存
    window.storageService = window.storageService || vectorStore;
}
