// ───────────────────────── 空艙房（TASK-0568） ─────────────────────────
// 船上可以配置功能的空艙房：雕刻作品裡的關聯 meta kind=rooms，固定點 <房名>.min／.max（兩個角的那一格，含兩端、只框空氣；地板 ＝ 甲板面上第一層空氣），可選 <房名>.door。
//   造船規格 Sculpture_Shipbuilding.md §9.2；候選與檢查：rooms.py（scan／check）。鏡像的關聯固定點自己會翻過去 ⇒ 一舷標一次、另一舷照樣讀得到。
// 這一段只讀、不改戰局：沒有標的船 ⇒ 一間都沒有；不抽 rnd()。
// 除錯：?rooms=1 ⇒ 每艘船畫出每一間的外框（穿過船殼看得到）與名字；__game.rooms() 讀數。
var ROOMS_DBG = Q.get('rooms') === '1';
/** 那一型的空艙房（第一次用到才算，記在船型上）：[{ name, min, max, door, deck }]；只有一個角的記在 T.roomsBad（⛔ 不默默略過）。 */
function hullRooms(T) {
  if (T.rooms) return T.rooms;
  var out = [], bad = [];
  (T.h.parts || []).forEach(function (p) {
    if (!p.meta || p.meta.kind !== 'rooms') return;
    var by = {};
    Object.keys(p.points || {}).forEach(function (k) {
      var i = k.lastIndexOf('.'); if (i < 0) return;
      var v = p.points[k]; (by[k.slice(0, i)] = by[k.slice(0, i)] || {})[k.slice(i + 1)] = [Math.floor(v[0]), Math.floor(v[1]), Math.floor(v[2])];
    });
    Object.keys(by).sort().forEach(function (nm) {
      var b = by[nm], full = (p.path || '') + '/' + nm;
      if (!b.min || !b.max) { if (b.min || b.max) bad.push(full + '：只有一個角'); return; }
      out.push({ name: full, min: [0, 1, 2].map(function (k) { return Math.min(b.min[k], b.max[k]); }), max: [0, 1, 2].map(function (k) { return Math.max(b.min[k], b.max[k]); }), door: b.door || null });
    });
  });
  T.rooms = out; T.roomsBad = bad;
  return out;
}
/** 開戰時：每艘船自己一份（之後放功能、家具、效率）。 */
function shipRooms(sh) {
  sh.rooms = hullRooms(sh.T).map(function (r) { return { name: r.name, min: r.min, max: r.max, door: r.door, fn: null }; });
  sh.roomLines = null;
}
/** 除錯的外框：每一間 12 條邊（格的外緣：min .. max + 1），船的座標；畫法跟繩一樣（60_render.js）。 */
function roomLines(sh) {
  var L = [], c = [0.35, 0.95, 1];
  sh.rooms.forEach(function (r) {
    var a = r.min, b = [r.max[0] + 1, r.max[1] + 1, r.max[2] + 1], P = [];
    for (var i = 0; i < 8; i++) P.push([i & 1 ? b[0] : a[0], i & 2 ? b[1] : a[1], i & 4 ? b[2] : a[2]]);
    [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(function (e) {
      L.push(P[e[0]][0], P[e[0]][1], P[e[0]][2], c[0], c[1], c[2], P[e[1]][0], P[e[1]][1], P[e[1]][2], c[0], c[1], c[2]);
    });
  });
  sh.roomLines = upload(sh.roomLines, new Float32Array(L), 6, [[0, 3, 0], [2, 3, 3]]);
}
/** 除錯的名字：每一間的中心投到畫面上（每一格 HUD 那一拍更新）。 */
function roomLabels() {
  var box = $('roomLbl');
  if (!ROOMS_DBG) { if (box) box.innerHTML = ''; return; }
  if (!box) { box = document.createElement('div'); box.id = 'roomLbl'; box.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;font:11px sans-serif;color:#7ff;text-shadow:0 0 2px #000,0 0 2px #000'; $('stage').appendChild(box); }
  var W = innerWidth, H = innerHeight, vp = CAM.vp, html = '';
  SHIPS.forEach(function (sh) {
    if (sh.sunk || !sh.rooms) return;
    sh.rooms.forEach(function (r) {
      var w = M4.pt(sh.M, (r.min[0] + r.max[0] + 1) / 2, (r.min[1] + r.max[1] + 1) / 2, r.max[2] + 1);
      var cx = vp[0] * w[0] + vp[4] * w[1] + vp[8] * w[2] + vp[12], cy = vp[1] * w[0] + vp[5] * w[1] + vp[9] * w[2] + vp[13], cw = vp[3] * w[0] + vp[7] * w[1] + vp[11] * w[2] + vp[15];
      if (cw <= 0.1) return;
      var sx = (cx / cw + 1) / 2 * W, sy = (1 - cy / cw) / 2 * H;
      if (sx < -50 || sx > W + 50 || sy < -20 || sy > H + 20) return;
      html += '<span style="position:absolute;left:' + sx.toFixed(0) + 'px;top:' + sy.toFixed(0) + 'px;transform:translate(-50%,-100%)">' + r.name.split('/').slice(-2).join('/') + (r.fn ? '・' + r.fn : '') + '</span>';
    });
  });
  if (box.innerHTML !== html) box.innerHTML = html;
}
/** 讀數（__game.rooms）：每艘每一間的名字、組裝件座標、尺寸（m）。 */
function roomsInfo() {
  return SHIPS.map(function (sh) {
    return { ship: sh.name, type: sh.T.id, bad: sh.T.roomsBad, rooms: (sh.rooms || []).map(function (r) { return { name: r.name, min: r.min, max: r.max, m: [0, 1, 2].map(function (k) { return +((r.max[k] - r.min[k] + 1) * S).toFixed(2); }), fn: r.fn }; }) };
  });
}
