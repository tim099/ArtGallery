// ───────────────────────── 船型快取（IndexedDB；Tim 2026-10-13：緩存船隻解析結果，加速下次啟動） ─────────────────────────
// 存的是載入時算一次、之後不改的東西：船體網格（每個區塊的四邊形）、模型網格（三角形＋佔用格）、海面遮罩、浮力表、帆的布模板。
//   格子本身不存：解碼很快（憲法號約 70 ms），而且 checksum 要照解出來的格子比（VK.verify）。
//   GPU 那一半（上傳、VAO）每次照樣做，只省 CPU 算的那一半。量過（2026-10-13，PC）：船體網格 CPU 240 ms，讀回同一份 6.8 MB 約 19 ms。
// 一型一筆（鍵 ＝ 船的 id）；兩艘同型共用那一筆。
// 失效：那筆記錄的 vxk（內嵌 .vxk 原文的雜湊：basecamp 每次重匯都會變，繩／帆／模型改了也會變）、code（頁面裡 JS 原文的雜湊：
//   產生網格的程式改了也要清）、fmt（快取格式）任何一個對不上 ⇒ 不用、現場解析完蓋掉它。
// 存不了（畫廊彈窗的 iframe 只開 allow-scripts：不透明來源，一碰 indexedDB 就丟錯；無痕模式；配額滿）⇒ 照常現場解析，不壞。
// ?cache=0 ⇒ 不讀也不寫（量現場解析的時間用）。
var CACHE_DB = 'ame_constitution_broadside', CACHE_FMT = 1, CACHE_ON = Q.get('cache') !== '0';
/** FNV-1a 32 位元（字串照 UTF-16 碼位）。 */
function fnv(s) { var h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
// 程式版本 ＝ 頁面上所有內嵌 JS 的原文（VoxelKit ＋ 遊戲本體）：改了任何一行都會換 ⇒ 寧可多清，不拿舊程式算的網格
var CODE_VER = fnv([].map.call(document.scripts, function (el) { return !el.type || /javascript/i.test(el.type) ? el.textContent : ''; }).join('\n'));
var cacheDB = null;
/** 開資料庫 ⇒ Promise<IDBDatabase|null>（開不了 ⇒ null；1.5 秒沒回也當開不了）。 */
function cacheOpen() {
  if (cacheDB) return cacheDB;
  return (cacheDB = new Promise(function (res) {
    var done = false; function ok(v) { if (!done) { done = true; res(v); } }
    setTimeout(function () { ok(null); }, 1500);
    try {
      var q = indexedDB.open(CACHE_DB, 1);
      q.onupgradeneeded = function () { q.result.createObjectStore('hull'); };
      q.onsuccess = function () { ok(q.result); };
      q.onerror = q.onblocked = function () { ok(null); };
    } catch (e) { ok(null); }
  }));
}
/** 那艘船的快取 ⇒ Promise<記錄|null>（從不 reject）。info.cache 留讀數：key、讀了多久、為什麼沒用。 */
function cacheGet(info) {
  var el = document.getElementById(info.el), st = info.cache = { vxk: fnv(el ? el.textContent : ''), code: CODE_VER, hit: false, why: '' };
  if (!CACHE_ON) { st.why = '?cache=0'; return Promise.resolve(null); }
  var t0 = performance.now();
  return cacheOpen().then(function (db) {
    if (!db) { st.why = '存不了（這個頁面不能用 IndexedDB）'; return null; }
    return new Promise(function (res) {
      try {
        var q = db.transaction('hull').objectStore('hull').get(info.id);
        q.onsuccess = function () {
          var r = q.result; st.readMs = performance.now() - t0;
          if (!r) st.why = '還沒有快取';
          else if (r.fmt !== CACHE_FMT || r.vxk !== st.vxk || r.code !== st.code) st.why = '快取過期（' + [r.fmt !== CACHE_FMT && '格式', r.vxk !== st.vxk && '船', r.code !== st.code && '程式'].filter(Boolean).join('、') + '換了）';
          else { st.hit = true; res(r); return; }
          res(null);
        };
        q.onerror = function () { st.why = '讀不了'; res(null); };
      } catch (e) { st.why = '讀不了'; res(null); }
    });
  });
}
/** 現場解析完的船型 ⇒ 存一筆（蓋掉舊的）。在背景做，失敗只記讀數。 */
function cachePut(T, info) {
  var st = info.cache;
  if (!CACHE_ON || st.hit || !T.keep) return;
  var g = T.base, ms = T.pristine.meshes, idx = [], n = 0;
  ms.forEach(function (m, i) { if (m) { idx.push(i, m.length); n += m.length; } });
  var all = new Uint16Array(n), o = 0;
  for (var k = 0; k < idx.length; k += 2) { all.set(ms.get(idx[k]), o); o += idx[k + 1]; }
  var rec = { fmt: CACHE_FMT, vxk: st.vxk, code: st.code, voxels: T.h.voxels, checksum: T.h.checksum, at: Date.now(), nx: g.nx, ny: g.ny,
    mesh: { all: all, idx: new Int32Array(idx) }, models: T.keep.models, hb: T.hullHB, hyd: T.hyd, disp: T.disp, rbox: T.rbox, cloth: T.cloth };
  T.keep = null;
  cacheOpen().then(function (db) {
    if (!db) return;
    try {
      var t0 = performance.now(), tx = db.transaction('hull', 'readwrite');
      tx.objectStore('hull').put(rec, info.id);
      tx.oncomplete = function () { st.saved = true; st.saveMs = performance.now() - t0; };
      tx.onerror = tx.onabort = function () { st.saved = false; st.why = '存不了：' + (tx.error && tx.error.name || '?'); };
    } catch (e) { st.saved = false; st.why = '存不了：' + (e && e.name || e); }
  });
}
/** 快取的船體網格 ⇒ RegionSet（跟 buildAll 同一份結果：每個區塊的四邊形，之後照樣 flush 上傳）。 */
function meshesFromCache(rs, M) {
  var g = rs.grid, o = 0;
  for (var k = 0; k < M.idx.length; k += 2) {
    var i = M.idx[k], n = M.idx[k + 1];
    rs.meshes.set(i, M.all.subarray(o, o + n)); o += n;
    rs.dirtyRegions.add(rs.rkey(i % g.nx, Math.floor(i / g.nx) % g.ny, Math.floor(i / (g.nx * g.ny))));
  }
  rs.flush();
}
