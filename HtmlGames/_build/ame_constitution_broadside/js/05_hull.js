// ───────────────────────── 船型（一種船一份；兩艘同型就共用） ─────────────────────────
// 船型 T：內嵌的 .vxk（<script type="application/x-vxk" id="…">）解碼之後的一切 —— 格子（T.base）、合併過的網格（T.pristine）、
//   繩與帆與模型（T.rig）、模型的網格（T.meshes）、桅（T.masts）、帆的布模板（T.cloth）、水線（T.wl0／wl1／bowHalf）、
//   海面遮罩（T.hullTex）、浮力表（T.hyd／disp），以及從 header 來的中線、外框、設計水線（T.cx／cy／hx0／hx1／zw／sz）。
// 每艘船 sh.T 指向它的船型；⛔ 船型是共用的、不能改（被打掉的格子在 sh.grid：Grid.share 寫的時候才複製那一塊）。
// 只在被選到時才解碼（Tim 2026-10-12：預設只載憲法號，其他船選了才載）—— 資料本身還是內嵌在同一個 HTML 裡
//   （畫廊的 iframe 只開 allow-scripts、讀不了旁邊的檔，展品也要零外部依賴），省的是解碼與網格化的時間和記憶體。
// 公尺／格（S）每種船都要一樣（模擬裡的距離、速度、碰撞都用同一個 S）；不一樣就不載、說為什麼。
// 認得的船（el ＝ 內嵌 .vxk 的 id）；選單只列 HTML 裡真的有內嵌資料的那幾艘 ⇒ 加一艘 ＝ template 加一個 x-vxk 標籤＋這裡一行。
var HULL_KNOWN = [{ id: 'constitution', el: 'ship', name: '憲法號' }, { id: 'ember', el: 'ship-ember', name: '餘燼號' }];
var HULL_LIST = HULL_KNOWN.filter(function (h) { return !!document.getElementById(h.el); });
var HULLS = {}, HULLT = {};                                             // id → 載入中的 Promise ／ 載好的船型
var SHIP_SET = ['constitution', 'constitution'];                         // [我艦, 敵艦] 的船型（主選單選；網址 ?ship=我艦,敵艦）
if (Q.has('ship')) Q.get('ship').split(',').forEach(function (w, i) { if (i < 2 && hullInfo(w)) SHIP_SET[i] = w; });
function hullInfo(id) { return HULL_LIST.filter(function (h) { return h.id === id; })[0] || null; }
/** 船型（解碼、網格化一次，之後都拿同一份）。分成幾步、每步之間讓出一次（Tim 2026-10-12：進到主選單之後才解析，解析完之前不能開戰、但可以調設定）；
 *  每一步開始時呼叫 hullSay（主選單的開戰鈕寫進度）。 */
function loadHull(id) {
  if (HULLS[id]) return HULLS[id];
  var info = hullInfo(id);
  if (!info) return Promise.reject(new Error('沒有這艘船：' + id));
  var t0 = performance.now();
  hullSay(info.name + '：解碼…');
  return (HULLS[id] = yieldUI().then(function () { return Promise.all([VK.loadEmbedded(info.el), cacheGet(info)]); })   // 解碼與讀快取一起跑（06_cache.js）
    .then(function (r) { return buildHull(info, r[0], t0, r[1]); })
    .then(function (T) { HULLT[id] = T; cachePut(T, info); return T; }));
}
/** 讓出一次（MessageChannel：一個新的工作 ⇒ 瀏覽器可以先畫一格、處理點擊）。⛔ 不用 setTimeout：分頁在背景時會被壓到一秒一次。 */
function yieldUI() { return new Promise(function (r) { var ch = new MessageChannel(); ch.port1.onmessage = function () { r(); }; ch.port2.postMessage(0); }); }
var hullSay = function () {};                                            // 90_main.js 換成寫進度的那支
/** C：快取的記錄（06_cache.js；null ⇒ 全部現場算）。現場算的時候，要存的那幾份另外留在 T.keep，給 cachePut 存。 */
function buildHull(info, model, t0, C) {
  var h = model.header, t1 = performance.now();                            // 到這裡是解碼（loadEmbedded，跟讀快取一起），之後是網格化
  if (C && (C.voxels !== h.voxels || C.checksum !== h.checksum)) C = null;  // 雙保險：鍵是 .vxk 原文的雜湊，格數與 checksum 也要一樣
  if (S && Math.abs(h.meters_per_voxel - S) > 1e-9) throw new Error(info.name + ' 是 ' + h.meters_per_voxel + ' 公尺一格，跟已經載入的船（' + S + '）不一樣 —— 模擬只吃同一個比例');
  S = h.meters_per_voxel;
  var T = { id: info.id, name: info.name, model: model, h: h, rig: h.rig || { ropes: [], sails: [] },
    sz: h.size[2], cx: (h.bbox[0] + h.bbox[3]) / 2, cy: h.size[1] / 2, hx0: h.bbox[0], hx1: h.bbox[3], zw: hullZW(h) };   // 外框：含艏斜桅與後桅帆桁
  T.cached = !!C; T.keep = C ? null : {};
  T.ms = {};                                                               // 每一段花多久（毫秒；讀數 window.__vxk.ms）
  function tm(k, f) { var a = performance.now(); f(); T.ms[k] = +(performance.now() - a).toFixed(1); }
  var steps = [
    ['格子', function () { tm('grid', function () { T.base = VK.Grid.fromModel(model); }); tm('verify', function () { T.chk = VK.verify(T.base, h); }); }],   // 格子不存快取：照解出來的比 checksum
    ['模型網格', function () { tm('meshes', function () { buildMeshes(T, C && C.models); }); }],
    ['水線與浮力', function () {
      tm('waterline', function () { waterline(T); }); tm('hullTex', function () { hullTex(T, C && C.hb); });
      tm('hydro', function () { if (C) { T.hyd = C.hyd; T.disp = C.disp; } else hydrostatics(T); });
    }],
    ['船體網格', function () { tm('pristine', function () { T.pristine = new VK.RegionSet(gl, T.base, QIDX); if (C) meshesFromCache(T.pristine, C.mesh); else T.pristine.buildAll(); }); }],
    ['桅與帆', function () {
      tm('masts', function () { findMasts(T); }); tm('cloth', function () { clothSetup(T, C); });
      var mt = 12 * KEG_T; (T.rig.models || []).forEach(function (m) { mt += modelT({ kind: modelKind(m) }, 1); });   // 模型的重量（砲照實、取用點 12 桶）
      T.ballast0 = Math.max(0, Math.round((T.disp - T.base.count * VOX_T - mt) / 25) * 25);   // 剛好浮在設計水線的壓艙物（滑桿一格 25 噸）
    }]
  ];
  var p = Promise.resolve();
  steps.forEach(function (s, i) { p = p.then(function () { hullSay(info.name + '：' + s[0] + '（' + (i + 1) + '／' + steps.length + '）…'); return yieldUI(); }).then(s[1]); });
  return p.then(function () { T.decodeMs = t1 - t0; T.meshMs = performance.now() - t1; return T; });
}
/** 設計水線（格的 z）：組裝件或關聯的 meta `kind=ship, waterline_z`（跟 basecamp 提議中）；沒有 ⇒ ZW0（憲法號 63）。 */
function hullZW(h) {
  var p = (h.parts || []).filter(function (q) { return q.meta && q.meta.kind === 'ship'; })[0], m = (p && p.meta) || h.meta || {};
  return isFinite(+m.waterline_z) && +m.waterline_z > 0 ? +m.waterline_z : ZW0;
}
