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
// ── 功能艙與家具（TASK-0568 第二階段）──
// 清單在 config/game.json：furniture（家具：名字、外框 [長, 寬, 高] 格、血量、彼此間隔）、rooms（功能艙：名字、必要件 need { 家具: 件數 }、加強件 extra（空間大就多擺）、
//   人手 staff ＋ 每 staffPer 件多一人、治療 heal 秒、歸隊時的血量比例 back）。
// 每一型哪幾間配什麼功能：預設 ＝ config ships[].rooms { 房名: 功能 }，玩家在船隻配置頁改的存在 SHIP_ROOMS（69_prefs.js）。
// 家具 ＝ 模型（跟砲、火藥桶同一套：有血量、被打到扣血、歸零整個飛出去）；雕刻的家具還沒做（TASK-0569）⇒ 先用程式產生的方塊模型（furnMesh）。
var FURN = CFG.furniture || {}, ROOM_FN = CFG.rooms || {}, SHIP_ROOMS = {};
var ROOM_AISLE = 6;                                                     // 門口往裡留幾格走道（0.6 m）
var ROOMFN_Q = Q.get('roomfn');                                        // 量的時候：?roomfn=medical ⇒ 每一型每一間都配這個功能（放得下的才擺；蓋過存檔與設定檔）
/** 那一型每一間配的功能（預設 ← 玩家改的；'' ＝ 空著）。 */
function roomFnsDefault(id) { var h = HULL_KNOWN.filter(function (x) { return x.id === id; })[0]; return Object.assign({}, h && h.rooms); }
function roomFns(id) {
  var d = roomFnsDefault(id), p = SHIP_ROOMS[id] || {};
  Object.keys(p).forEach(function (k) { d[k] = p[k]; });
  if (ROOMFN_Q && ROOM_FN[ROOMFN_Q]) { var T = HULLT[id]; (T ? hullRooms(T) : []).forEach(function (r) { d[r.name] = ROOMFN_Q; }); }
  Object.keys(d).forEach(function (k) { if (!d[k] || !ROOM_FN[d[k]]) delete d[k]; });
  return d;
}
/** 程式產生的家具模型（雕刻的家具到之前的佔位）：幾個方塊，網格格式跟 .vxk 的模型一樣（verts 相對外框最小角、tris、tmat → mats）。
 *  床：四根腳、床板、床墊、枕頭；ax ＝ 'x' ⇒ 長邊沿 x，'y' ⇒ 沿 y。 */
function furnBoxes(item, ax) {
  var f = FURN[item], L = f.size[0], W = f.size[1], H = f.size[2], B = [];
  if (item === 'bed') B = [[0, 0, 0, 1, 1, H - 2, 0], [L - 1, 0, 0, L, 1, H - 2, 0], [0, W - 1, 0, 1, W, H - 2, 0], [L - 1, W - 1, 0, L, W, H - 2, 0],
    [0, 0, H - 2, L, W, H - 1, 0], [1, 1, H - 1, L - 1, W - 1, H, 1], [L - 4, 1.5, H - 0.5, L - 1, W - 1.5, H + 0.5, 2]];
  else B = [[0, 0, 0, L, W, H, 0]];
  return ax === 'y' ? B.map(function (b) { return [b[1], b[0], b[2], b[4], b[3], b[5], b[6]]; }) : B;
}
function boxMesh(boxes, mats) {
  var v = [], t = [], tm = [];
  boxes.forEach(function (b) {
    var x0 = b[0], y0 = b[1], z0 = b[2], x1 = b[3], y1 = b[4], z1 = b[5];
    [[[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]],
     [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]],
     [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]].forEach(function (q) {   // 每一面四個角，繞向朝外
      var n = v.length / 3; q.forEach(function (p) { v.push(p[0], p[1], p[2]); });
      t.push(n, n + 1, n + 2, n, n + 2, n + 3); tm.push(b[6], b[6]);
    });
  });
  return { verts: v, tris: t, tmat: tm, mats: mats };
}
var FURN_MATS = [[0.42, 0.28, 0.16], [0.82, 0.78, 0.66], [0.93, 0.92, 0.88]];   // 木頭、帆布床墊、枕頭
/** 那一型的家具網格（每種家具兩個方向各一份，第一次用到才做、接在 T.meshes 後面）⇒ 網格的索引。 */
function furnMesh(T, item, ax) {
  T.furn = T.furn || {}; var key = item + ax;
  if (T.furn[key] === undefined) {
    var m = boxMesh(furnBoxes(item, ax), FURN_MATS), up = upload(null, meshTris(m), 9, [[0, 3, 0], [1, 3, 3], [2, 3, 6]]);
    up.occ = meshOcc(m); T.meshes.push(up); T.furn[key] = T.meshes.length - 1;
  }
  return T.furn[key];
}
/** 門：長方體四面牆上、往外連續 ROOM_DOOR 格都站得住（腳下實心、頭上 14 格空）的格（跟 rooms.py doors 同一個判斷）。
 *  ⛔ 只看外面那一格 ⇒ 長方體外側還有一點地板（船殼的弧度、最大內接長方形沒框到的角落）也被當成門，床排不進去。 */
var ROOM_DOOR = 8;
function roomDoors(g, r) {
  var x0 = r.min[0], y0 = r.min[1], z0 = r.min[2], x1 = r.max[0], y1 = r.max[1], out = [];
  function st(x, y) { if (!g.get(x, y, z0 - 1)) return false; for (var k = 0; k < 14; k++) if (g.get(x, y, z0 + k)) return false; return true; }
  function open(x, y, dx, dy) { for (var k = 1; k <= ROOM_DOOR; k++) if (!st(x + dx * k, y + dy * k)) return false; return true; }
  for (var x = x0; x <= x1; x++) { if (open(x, y0, 0, -1)) out.push([x, y0]); if (open(x, y1, 0, 1)) out.push([x, y1]); }
  for (var y = y0; y <= y1; y++) { if (open(x0, y, -1, 0)) out.push([x0, y]); if (open(x1, y, 1, 0)) out.push([x1, y]); }
  return out;
}
/** 半程式化布局：照艙房大小排家具 ⇒ [{ item, ax, at:[x,y,z] }]（at ＝ 外框最小角，格座標）；放不下必要件 ⇒ null。
 *  長邊順著艙房的長邊；靠牆一排一排擺（第一排貼離門最遠的那面長牆），每件之間隔 gap；門口往裡 ROOM_AISLE 格不擺；腳下每一格都要站得住、頭上要空。
 *  先擺必要件，剩下的空間全部擺加強件（Tim：加強件可以就是多擺同一樣東西）。同一間、同一個功能每次排出來一樣（沒有亂數）。 */
function roomLayout(T, r, fn) {
  var F = ROOM_FN[fn]; if (!F) return null;
  var g = T.base, X = r.max[0] - r.min[0] + 1, Y = r.max[1] - r.min[1] + 1, z = r.min[2], doors = roomDoors(g, r);
  var items = [], need = F.need || {};
  Object.keys(need).forEach(function (it) { for (var k = 0; k < need[it]; k++) items.push({ item: it, need: true }); });
  var placed = [], taken = {};
  function blocked(x, y) { return doors.some(function (d) { return Math.abs(d[0] - x) <= ROOM_AISLE && Math.abs(d[1] - y) <= ROOM_AISLE; }); }
  function fits(x0, y0, w, l) {
    if (x0 < r.min[0] || y0 < r.min[1] || x0 + w - 1 > r.max[0] || y0 + l - 1 > r.max[1]) return false;
    for (var x = x0; x < x0 + w; x++) for (var y = y0; y < y0 + l; y++) {
      if (taken[x + ',' + y] || blocked(x, y) || !g.get(x, y, z - 1)) return false;
      for (var k = 0; k < 14; k++) if (g.get(x, y, z + k)) return false;
    }
    return true;
  }
  function take(x0, y0, w, l, gap) { for (var x = x0 - gap; x < x0 + w + gap; x++) for (var y = y0 - gap; y < y0 + l + gap; y++) taken[x + ',' + y] = 1; }
  // 掃的順序：從離門最遠的那個角開始（門在哪一邊 ⇒ 從另一邊往門那邊擺）
  var dx = 0, dy = 0; doors.forEach(function (d) { dx += d[0] - (r.min[0] + r.max[0]) / 2; dy += d[1] - (r.min[1] + r.max[1]) / 2; });
  function place(item) {
    var f = FURN[item], L = f.size[0], W = f.size[1], gap = f.gap || 0;
    var ax = Y >= X ? 'y' : 'x', w = ax === 'y' ? W : L, l = ax === 'y' ? L : W;   // w：x 方向佔幾格、l：y 方向
    var xs = [], ys = [], x, y;
    for (x = r.min[0]; x + w - 1 <= r.max[0]; x++) xs.push(x);
    for (y = r.min[1]; y + l - 1 <= r.max[1]; y++) ys.push(y);
    if (dx < 0) xs.reverse(); if (dy < 0) ys.reverse();                  // 門在 −x ⇒ 從 +x 那頭開始（門在 +x ⇒ 由小到大本來就是從另一頭）；⛔ 反過來就是貼著門擺
    var outer = ax === 'y' ? xs : ys, inner = ax === 'y' ? ys : xs;
    for (var i = 0; i < outer.length; i++) for (var j = 0; j < inner.length; j++) {
      x = ax === 'y' ? outer[i] : inner[j]; y = ax === 'y' ? inner[j] : outer[i];
      if (fits(x, y, w, l)) { take(x, y, w, l, gap); placed.push({ item: item, ax: ax, at: [x, y, z], w: w, l: l }); return true; }
    }
    return false;
  }
  for (var i = 0; i < items.length; i++) if (!place(items[i].item)) return null;
  var need0 = placed.length;
  if (F.extra && FURN[F.extra]) while (place(F.extra)) { if (placed.length > 64) break; }
  placed.need = need0;
  return placed;
}
/** 開戰時：每艘船自己一份艙房；配了功能、放得下必要件的那幾間擺上家具（加進 sh.models，跟砲同一套血量與命中）。 */
function shipRooms(sh) {
  var fns = roomFns(sh.T.id);
  sh.rooms = hullRooms(sh.T).map(function (r) {
    var o = { name: r.name, min: r.min, max: r.max, door: r.door, fn: null, furn: [] }, fn = fns[r.name], lay = fn ? roomLayout(sh.T, r, fn) : null;
    if (!lay) return o;
    o.fn = fn;
    lay.forEach(function (p, k) {
      var f = FURN[p.item], mesh = furnMesh(sh.T, p.item, p.ax), bb = [p.at[0], p.at[1], p.at[2], p.at[0] + p.w, p.at[1] + p.l, p.at[2] + f.size[2] + 1];
      var m = { T: sh.T, k: sh.models.length, name: p.item + '-' + (k + 1), path: r.name + '/' + p.item + '-' + (k + 1), kind: 'furn', item: p.item, room: o, hp: f.hp, hpMax: f.hp, mesh: mesh, origin: p.at.slice(), bb: bb, pts: {}, meta: { kind: 'furniture', item: p.item },
        c: [(bb[0] + bb[3]) / 2, (bb[1] + bb[4]) / 2, (bb[2] + bb[5]) / 2], foot: VK.pack(Math.floor(bb[0] + 1), Math.floor(bb[1] + 1), p.at[2] - 1), alive: true, need: k < lay.need };
      sh.models.push(m); o.furn.push(m);
    });
    return o;
  });
  sh.roomLines = null;
}
/** 那一間現在的能力 ＝ 還在的家具各自剩下的血量比例加起來（醫療艙 ＝ 幾張床的份量；空間大、擺得多 ⇒ 大）；之後再乘人手（第二階段）。 */
function roomCap(o) { var s = 0; o.furn.forEach(function (m) { if (m.alive) s += m.hp / m.hpMax; }); return s; }
/** 打壞了幾成：現在的能力 ÷ 剛擺好時（0–1）。 */
function roomEff(o) { return o.fn && o.furn.length ? roomCap(o) / o.furn.length : 0; }
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
      html += '<span style="position:absolute;left:' + sx.toFixed(0) + 'px;top:' + sy.toFixed(0) + 'px;transform:translate(-50%,-100%)">' + r.name.split('/').slice(-2).join('/') + (r.fn ? '・' + ROOM_FN[r.fn].name + ' ' + r.furn.filter(function (m) { return m.alive; }).length + '／' + r.furn.length : '') + '</span>';
    });
  });
  if (box.innerHTML !== html) box.innerHTML = html;
}
/** 讀數（__game.rooms）：每艘每一間的名字、組裝件座標、尺寸（m）。 */
function roomsInfo() {
  return SHIPS.map(function (sh) {
    return { ship: sh.name, type: sh.T.id, bad: sh.T.roomsBad, rooms: (sh.rooms || []).map(function (r) { return { name: r.name, min: r.min, max: r.max, m: [0, 1, 2].map(function (k) { return +((r.max[k] - r.min[k] + 1) * S).toFixed(2); }), fn: r.fn, furn: r.furn.length, alive: r.furn.filter(function (m) { return m.alive; }).length, cap: +roomCap(r).toFixed(2), eff: +roomEff(r).toFixed(2) }; }) };
  });
}
