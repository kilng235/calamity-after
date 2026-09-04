/**
 * calamity-data.js - 灾厄之后·世界书数据访问层
 *
 * 统一访问三个自动生成的数据模块（ES Module）：
 *   prompt-data-core-calamity.js  → 扁平对象 promptData（'分类/条目名' → 内容，116 条）
 *   prompt-data-npc-calamity.js   → 嵌套对象 calamityPrompts（{ NPC: {...} }）
 *   prompt-data-world-calamity.js → 嵌套对象 calamityPrompts（{ 世界观: {...} }）
 *
 * 由于数据模块是 ES Module，无法用经典 <script> 加载，由各页面内联
 * <script type="module"> 导入后调用 register() 注入；本层保持 IIFE 格式，
 * 供 worldbook-engine / prompt-builder 同步消费。
 */

var calamityData = (function() {

    var _core = {};   // 扁平：'NPC/伊莎·圣焰' -> 内容
    var _npc = {};    // 嵌套：{ NPC: { 伊莎·圣焰: 内容 } }
    var _world = {};  // 嵌套：{ 世界观: { 文风指引: 内容 } }
    var _opening = null; // 开局数据

    /**
     * 注册数据（由页面内联 module 脚本调用）
     * @param {Object} core - promptData 扁平对象
     * @param {Object} npc - npc 模块的 calamityPrompts
     * @param {Object} world - world 模块的 calamityPrompts
     */
    function register(core, npc, world) {
        _core = core || {};
        _npc = npc || {};
        _world = world || {};
        return true;
    }

    function isRegistered() {
        return Object.keys(_core).length > 0
            || Object.keys(_npc).length > 0
            || Object.keys(_world).length > 0;
    }

    /**
     * 取单个条目：优先嵌套（NPC/世界观），其次扁平 '分类/条目名'
     */
    function get(category, key) {
        var nested = (_npc[category] && _npc[category][key])
            || (_world[category] && _world[category][key]);
        if (nested) return nested;
        return _core[category + '/' + key] || '';
    }

    /** 按扁平 key 直接取（如 '系统/输出格式'） */
    function getFlat(key) {
        return _core[key] || '';
    }

    /** 取某分类下全部条目 { 条目名: 内容 }（嵌套与扁平合并，嵌套优先） */
    function getCategory(category) {
        var result = {};
        var prefix = category + '/';
        Object.keys(_core).forEach(function(k) {
            if (k.indexOf(prefix) === 0) result[k.slice(prefix.length)] = _core[k];
        });
        var nested = Object.assign({}, _npc[category] || {}, _world[category] || {});
        Object.keys(nested).forEach(function(k) { result[k] = nested[k]; });
        return result;
    }

    /** 全部分类名 */
    function categories() {
        var set = {};
        Object.keys(_core).forEach(function(k) {
            var slash = k.indexOf('/');
            if (slash !== -1) set[k.slice(0, slash)] = true;
        });
        Object.keys(_npc).forEach(function(k) { set[k] = true; });
        Object.keys(_world).forEach(function(k) { set[k] = true; });
        return Object.keys(set);
    }

    /** 在指定分类内按关键词检索条目名 */
    function search(category, keyword) {
        var cat = getCategory(category);
        var result = [];
        Object.keys(cat).forEach(function(key) {
            if (key.indexOf(keyword) !== -1) result.push({ key: key, content: cat[key] });
        });
        return result;
    }

    /** 跨分类全量检索 */
    function searchAll(keyword) {
        var result = [];
        categories().forEach(function(cat) {
            search(cat, keyword).forEach(function(item) {
                result.push({ category: cat, key: item.key, content: item.content });
            });
        });
        return result;
    }

    /** 具名 NPC 名单（排除生成规则） */
    function npcNames() {
        return Object.keys(getCategory('NPC')).filter(function(k) { return k !== '生成规则'; });
    }

    /** 注册开局数据 */
    function registerOpening(openingData) {
        _opening = openingData;
        return true;
    }

    /** 获取开局数据 */
    function getOpening() {
        return _opening;
    }

    /** 检查是否已开局 */
    function hasOpening() {
        return _opening !== null;
    }

    return {
        register: register,
        isRegistered: isRegistered,
        get: get,
        getFlat: getFlat,
        getCategory: getCategory,
        categories: categories,
        search: search,
        searchAll: searchAll,
        npcNames: npcNames,
        registerOpening: registerOpening,
        getOpening: getOpening,
        hasOpening: hasOpening
    };
})();

if (typeof window !== 'undefined') {
    window.calamityData = calamityData;
}
