/**
 * memory-store.js - 记忆系统的纯文本 IndexedDB 存储（calamity-memory v1）
 *
 * 四个 store：
 *   summary    每层纪要全文（keyPath: floor）——压缩输入 + 词法命中展开源
 *   chronicle  编年史一行（keyPath: floor）——主键即楼层号，天然防重
 *   story      纪事/卷宗/典章（keyPath: id，level 1/2/3 区分，absorbedBy 吸收标记）
 *   embeddings 向量模块的摘要向量（keyPath: id，含 floor 索引；vector 为 ArrayBuffer）
 *
 * 设计要点：
 *   - 全部为纯文本/二进制记录，无向量概念泄漏到核心链路（embeddings 只被向量模块使用）
 *   - 提供同步可用的内存镜像（init 预载），满足 storyEngine 高频同步读
 *   - embeddings 的读写同时兼容 legacy memory-recall 的同步契约（loadAllEmbeddings）
 */
var memoryStore = (function() {
    const DB_NAME = 'calamity-memory';
    const DB_VERSION = 1;
    const STORES = ['summary', 'chronicle', 'story', 'embeddings'];
    let _db = null;
    // 内存镜像：{summary:{floor:rec}, chronicle:{floor:rec}, story:[rec...], embeddings:[rec...]}
    const _mem = { summary: {}, chronicle: {}, story: [], embeddings: [] };
    let _loaded = false;

    function openDb() {
        return new Promise(function(resolve, reject) {
            if (_db) { resolve(_db); return; }
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = function(e) {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('summary')) db.createObjectStore('summary', { keyPath: 'floor' });
                if (!db.objectStoreNames.contains('chronicle')) db.createObjectStore('chronicle', { keyPath: 'floor' });
                if (!db.objectStoreNames.contains('story')) db.createObjectStore('story', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('embeddings')) {
                    const st = db.createObjectStore('embeddings', { keyPath: 'id' });
                    st.createIndex('floor', 'floor', { unique: false });
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
            for (const name of STORES) {
                const rows = (await reqAsPromise(db.transaction(name, 'readonly').objectStore(name).getAll())) || [];
                if (name === 'summary') {
                    _mem.summary = {};
                    rows.forEach(r => { _mem.summary[r.floor] = r; });
                } else if (name === 'chronicle') {
                    _mem.chronicle = {};
                    rows.forEach(r => { _mem.chronicle[r.floor] = r; });
                } else {
                    _mem[name] = rows;
                }
            }
            _loaded = true;
            console.log('[MemoryStore] 已载入 纪要 ' + Object.keys(_mem.summary).length
                + ' 层 / 编年史 ' + Object.keys(_mem.chronicle).length
                + ' 行 / 常驻线 ' + _mem.story.length + ' 篇 / 向量 ' + _mem.embeddings.length + ' 条');
        } catch (e) {
            _loaded = true;
            console.warn('[MemoryStore] IDB 载入失败（以空库运行）:', e && e.message || e);
        }
        return true;
    }

    function assertLoaded() {
        if (!_loaded) console.warn('[MemoryStore] init 未完成即被访问（返回镜像当前值）');
    }

    // ---- 同步读（走镜像） ----
    function getSummary(floor) { assertLoaded(); return _mem.summary[floor] || null; }
    function allSummaries() { assertLoaded(); return Object.values(_mem.summary).sort((a, b) => a.floor - b.floor); }
    function getChronicle(floor) { assertLoaded(); return _mem.chronicle[floor] || null; }
    function allChronicle() { assertLoaded(); return Object.values(_mem.chronicle).sort((a, b) => a.floor - b.floor); }
    function allStory() { assertLoaded(); return _mem.story.slice(); }
    function allEmbeddings() { assertLoaded(); return _mem.embeddings.slice(); }
    function maxFloor() {
        const s = Object.keys(_mem.summary).reduce((m, k) => Math.max(m, +k), 0);
        const c = Object.keys(_mem.chronicle).reduce((m, k) => Math.max(m, +k), 0);
        return Math.max(s, c);
    }

    // ---- 写（更新镜像 + 异步落盘） ----
    async function put(store, rec) {
        if (store === 'summary') _mem.summary[rec.floor] = rec;
        else if (store === 'chronicle') _mem.chronicle[rec.floor] = rec;
        else {
            const idx = _mem[store].findIndex(r => r.id === rec.id);
            if (idx >= 0) _mem[store][idx] = rec; else _mem[store].push(rec);
        }
        try {
            const db = await openDb();
            await reqAsPromise(db.transaction(store, 'readwrite').objectStore(store).put(rec));
        } catch (e) {
            console.warn('[MemoryStore] 落盘失败（仅内存保留）:', store, e && e.message || e);
        }
        return true;
    }

    async function del(store, key) {
        if (store === 'summary') delete _mem.summary[key];
        else if (store === 'chronicle') delete _mem.chronicle[key];
        else _mem[store] = _mem[store].filter(r => r.id !== key);
        try {
            const db = await openDb();
            await reqAsPromise(db.transaction(store, 'readwrite').objectStore(store).delete(key));
        } catch (e) { /* 内存已删，落盘失败可容忍 */ }
        return true;
    }

    async function clearStore(store) {
        if (store === 'summary') _mem.summary = {};
        else if (store === 'chronicle') _mem.chronicle = {};
        else _mem[store] = [];
        try {
            const db = await openDb();
            await reqAsPromise(db.transaction(store, 'readwrite').objectStore(store).clear());
        } catch (e) { /* ignore */ }
        return true;
    }

    async function clearAll() {
        for (const s of STORES) await clearStore(s);
        return true;
    }

    return {
        init: init,
        // 同步读
        getSummary: getSummary, allSummaries: allSummaries,
        getChronicle: getChronicle, allChronicle: allChronicle,
        allStory: allStory, allEmbeddings: allEmbeddings, maxFloor: maxFloor,
        // 异步写
        put: put, del: del, clearStore: clearStore, clearAll: clearAll,
        STORES: STORES
    };
})();

if (typeof window !== 'undefined') {
    window.memoryStore = memoryStore;
}
