// ───────────────────────── 船型（一種船一份；兩艘同型就共用） ─────────────────────────
// 船型 T：內嵌的 .vxk（<script type="application/x-vxk" id="…">）解碼之後的一切 —— 格子（T.base）、合併過的網格（T.pristine）、
//   繩與帆與模型（T.rig）、模型的網格（T.meshes）、桅（T.masts）、帆的布模板（T.cloth）、水線（T.wl0／wl1／bowHalf）、
//   海面遮罩（T.hullTex）、浮力表（T.hyd／disp），以及從 header 來的中線、外框、設計水線（T.cx／cy／hx0／hx1／zw／sz）。
// 每艘船 sh.T 指向它的船型；⛔ 船型是共用的、不能改（被打掉的格子在 sh.grid：Grid.share 寫的時候才複製那一塊）。
// 只在被選到時才解碼（Tim 2026-10-12：預設只載憲法號，其他船選了才載）—— 資料本身還是內嵌在同一個 HTML 裡
//   （畫廊的 iframe 只開 allow-scripts、讀不了旁邊的檔，展品也要零外部依賴），省的是解碼與網格化的時間和記憶體。
// 公尺／格（S）每種船都要一樣（模擬裡的距離、速度、碰撞都用同一個 S）；不一樣就不載、說為什麼。
var HULL_LIST = [{ id: 'constitution', el: 'ship', name: '憲法號' }];   // 選單列得出來的船（el ＝ 內嵌 .vxk 的 id）
var HULLS = {}, HULLT = {};                                             // id → 載入中的 Promise ／ 載好的船型
var SHIP_SET = ['constitution', 'constitution'];                         // [我艦, 敵艦] 的船型
function hullInfo(id) { return HULL_LIST.filter(function (h) { return h.id === id; })[0] || null; }
/** 船型（解碼、網格化一次，之後都拿同一份）。 */
function loadHull(id) {
  if (HULLS[id]) return HULLS[id];
  var info = hullInfo(id);
  if (!info) return Promise.reject(new Error('沒有這艘船：' + id));
  var t0 = performance.now();
  return (HULLS[id] = VK.loadEmbedded(info.el).then(function (model) { var T = buildHull(info, model); T.decodeMs = T.t1 - t0; return (HULLT[id] = T); }));
}
function buildHull(info, model) {
  var h = model.header, t1 = performance.now();                            // 到這裡是解碼（loadEmbedded），之後是網格化
  if (S && Math.abs(h.meters_per_voxel - S) > 1e-9) throw new Error(info.name + ' 是 ' + h.meters_per_voxel + ' 公尺一格，跟已經載入的船（' + S + '）不一樣 —— 模擬只吃同一個比例');
  S = h.meters_per_voxel;
  var T = { id: info.id, name: info.name, model: model, h: h, rig: h.rig || { ropes: [], sails: [] },
    sz: h.size[2], cx: (h.bbox[0] + h.bbox[3]) / 2, cy: h.size[1] / 2, hx0: h.bbox[0], hx1: h.bbox[3], zw: hullZW(h) };   // 外框：含艏斜桅與後桅帆桁
  T.base = VK.Grid.fromModel(model);
  T.chk = VK.verify(T.base, h);
  buildMeshes(T); waterline(T); hullTex(T); hydrostatics(T);
  T.pristine = new VK.RegionSet(gl, T.base, QIDX); T.pristine.buildAll();
  findMasts(T); clothSetup(T);
  T.t1 = t1; T.meshMs = performance.now() - t1;
  return T;
}
/** 設計水線（格的 z）：組裝件或關聯的 meta `kind=ship, waterline_z`（跟 basecamp 提議中）；沒有 ⇒ ZW0（憲法號 63）。 */
function hullZW(h) {
  var p = (h.parts || []).filter(function (q) { return q.meta && q.meta.kind === 'ship'; })[0], m = (p && p.meta) || h.meta || {};
  return isFinite(+m.waterline_z) && +m.waterline_z > 0 ? +m.waterline_z : ZW0;
}
