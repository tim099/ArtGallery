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
      out.push({ name: full, deck: deckOfPath(T, p.path || ''), min: [0, 1, 2].map(function (k) { return Math.min(b.min[k], b.max[k]); }), max: [0, 1, 2].map(function (k) { return Math.max(b.min[k], b.max[k]); }), door: b.door || null });
    });
  });
  T.rooms = out; T.roomsBad = bad;
  return out;
}
// ── 房間與物品（TASK-0568；Tim 2026-10-14 改設計）──
// 結構：甲板 → 房間 → 物品（床、砲）；甲板本身也是一個大房間。房間是容器：房間類型（config rooms：醫療…）決定能擺哪幾樣物品（rooms[].items；物品 furniture[].type ＝ 它屬於哪一類），
//   玩家在船隻配置頁的俯視格子編輯器（0.5 m 一格，ROOM_TILE）直接擺、轉 90°、拿掉，或一鍵「自動擺滿」（roomAuto）。
//   物品給 buff（furniture[].buff，例：藥箱 治療速度 +15%）：同一間加總、上限 rooms[].buffCap，套用到同一間的物品（roomBuff）；容納 hold（病床躺 1 人）。
// 每一型一份擺法：SHIP_ROOMS[船型][房名] ＝ { type, items: [{ it, x, y, r }] }（x、y ＝ 房間裡第幾格（物品的最小角），r ＝ 1 ⇒ 轉 90°（長邊沿 y））；
//   沒有 items ⇒ 開戰時自動擺滿；null ⇒ 空著。存檔、匯出入：69_prefs.js。
//   預設 ＝ config ships[].rooms { 房名: '類型'（自動擺滿）｜{ type, items }（自訂；甲板也是）}；沒寫的艙房空著、沒寫的甲板照舊的取用點。
//   預設在設定後台編：後台嵌一份 ?admin=rooms 的遊戲（只開船隻配置頁的甲板與艙房、不讀不存 localStorage），改了就把那一型的預設 postMessage 回後台（ADMIN_ROOMS）。
// 物品 ＝ 模型（跟砲同一套血量、命中、飛出去；打壞的不再能用、不再給 buff）；雕刻的物品（TASK-0569）之前用程式產生的方塊（furnMesh）。
var FURN = CFG.furniture || {}, ROOM_FN = CFG.rooms || {}, SHIP_ROOMS = {}, ROOM_TILE = 5, ROOM_HEAD = 14;
var ROOM_AISLE = 6;                                                     // 門口走道：格子的中心離門 0.6 m 以內 ⇒ 不能擺（⇒ 門口往裡一格、門的兩旁各多一格；⛔ 整格碰到就算 ⇒ 往裡兩格，1.5×2 m 的房間擺不下床）
var ROOMFN_Q = Q.get('roomfn');                                        // 量的時候：?roomfn=medical ⇒ 每一型每一間都配這個類型、自動擺滿（蓋過存檔與設定檔）
var ADMIN_ROOMS = Q.get('admin') === 'rooms';
/** 設定檔的預設 ⇒ { 房名: 擺法 }（格式跟存檔同一套：69_prefs.js roomPlanParse）。 */
function roomPlanDefault(id) { var h = HULL_KNOWN.filter(function (x) { return x.id === id; })[0], d = {}; Object.keys((h && h.rooms) || {}).forEach(function (k) { var v = roomPlanParse(h.rooms[k]); if (v) d[k] = v; }); return d; }
/** 後台模式：那一型現在的擺法寫成預設的格式（艙房：自動 ⇒ '類型'、自訂 ⇒ { type, items }；甲板只寫自訂的；空著的不寫）。 */
function roomsDefaultSnap(id) {
  var T = HULLT[id], o = {}; if (!T) return null;
  hullRooms(T).forEach(function (r) { var p = roomPlan(id, r.name); if (p) o[r.name] = p.items ? { type: p.type, items: p.items } : p.type; });
  hullDeckKit(T).decks.forEach(function (D) { var p = deckPlan(id, D.id); if (p.items) o[D.id] = { type: 'deck', items: p.items }; });
  return o;
}
/** 那一型那一間的擺法：{ type, items? }；空著 ⇒ null。（甲板那一間走 deckPlan） */
function roomPlan(id, name) {
  if (ROOMFN_Q && ROOM_FN[ROOMFN_Q] && !ROOM_FN[ROOMFN_Q].deck) return { type: ROOMFN_Q };
  var S = SHIP_ROOMS[id], p = S && Object.prototype.hasOwnProperty.call(S, name) ? S[name] : roomPlanDefault(id)[name];
  return p && p.type && ROOM_FN[p.type] && !ROOM_FN[p.type].deck ? p : null;
}
// ── 甲板 ＝ 一間大房間（Tim 2026-10-14：火藥桶（取用點）也是物品，玩家可以擺、拿掉）──
// 每一層砲甲板一間，房名 ＝ 那一層甲板的關聯路徑（甲板-gun…；沒有甲板 meta ⇒ d0、d1…），類型 deck（config rooms.deck：只能擺 keg）。
//   擺法存在同一個 SHIP_ROOMS[船型][房名]；⚠ 跟艙房不一樣：沒有存 ⇒「自動」＝ 照舊的取用點（23_powder.js makeStations 找的那幾處：預設戰局不變），
//   { type:'deck', items:[] } ＝ 那一層不放。格子：腳下站得住（站的高度跟著舷弧、一格裡差 1 格以內）、頭上 0.8 m 空；砲的外框外擴 2 格 ＝ 砲班的位置（s ＝ 3，不能擺）。
/** 船型層級的砲甲板與預設取用點（配置頁還沒開戰也算得出來）：拿船型的模型做一艘「空殼」，跑跟開戰時同一套 gunDecks／makeMags／makeStations ⇒
 *  { decks: [{ id, name, zr, gunsBB }], auto: { 房名: [{ name, spot, mag }] } }（spot ＝ 三桶那一塊的最小角，格座標）。 */
function hullDeckKit(T) {
  if (T.deckKit) return T.deckKit;
  var models = (T.rig.models || []).map(function (m, k) { var b = m.bbox; return { T: T, k: k, name: m.name.split('/').pop(), path: m.name, kind: modelKind(m), bb: b, pts: m.points || {}, meta: m.meta || {}, mesh: m.mesh, c: [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2], alive: true }; });
  var P = { T: T, models: models, guns: [] };
  models.forEach(function (m) { if (!GUNS[m.kind]) return; var A = gunMuzzle(m); P.guns.push({ name: m.name, type: m.kind, model: m, ax: A.ax, muz: A.muz }); });
  P.guns.sort(gunOrder);
  P.decks = P.guns.length ? gunDecks(P) : [];
  P.mags = makeMags(P);
  var auto = {}, kit = { decks: [], auto: auto };
  P.decks.forEach(function (D) { kit.decks.push({ id: deckId(D), key: D.key, name: D.name, zr: D.zr, meta: D.meta || null }); auto[deckId(D)] = []; });
  makeStations(P, true).forEach(function (st) { var D = P.decks.filter(function (d) { return d.key === st.deck; })[0]; auto[deckId(D)].push({ name: st.name, spot: st.kegs[0].origin.slice(), mag: st.mag.name }); });
  kit.gunsBB = models.filter(function (m) { return GUNS[m.kind] || m.kind === 'wheel'; }).map(function (m) { return m.bb; });
  return T.deckKit = kit;
}
/** 那一層砲甲板當房間時的房名（擺法的鍵）。 */
function deckId(D) { return D.meta ? D.meta.path : D.key; }
/** 那一層甲板的擺法：存的 ← 設定檔的預設 ← { type:'deck' }（自動 ＝ 照舊的取用點）。 */
function deckPlan(id, name) {
  var S = SHIP_ROOMS[id], p = S && Object.prototype.hasOwnProperty.call(S, name) ? S[name] : roomPlanDefault(id)[name];
  return p && p.type === 'deck' ? p : { type: 'deck' };
}
/** 那一層甲板照擺法擺上的取用點（格子）⇒ 跟 roomItems 同一個格式（auto ⇒ 照舊找的那幾處換成格子）。 */
function deckItems(T, D, pl) {
  if (!pl.items) return { type: 'deck', items: deckAutoItems(T, D), bad: [], why: '', auto: true };
  var c = roomCheck(T, { grid: deckGrid(T, D) }, 'deck', pl.items); return { type: 'deck', items: c.items, bad: c.bad, why: '' };
}
/** 甲板的俯視格子（記在船型上）：跟 roomGrid 同一個格式，多 zt（每一格站的高度）；s：0 站不住、1 可以擺、3 砲班的位置。 */
function deckGrid(T, D) {
  T.deckG = T.deckG || {}; var id = deckId(D); if (T.deckG[id]) return T.deckG[id];
  var g = T.base, hb = T.h.bbox, dm = D.meta, xa = dm ? dm.x0 : T.hx0, xb = dm ? dm.x1 : T.hx1, ya = Math.floor(hb[1]), yb = Math.ceil(hb[4]);
  var nx = Math.floor((xb - xa + 1) / ROOM_TILE), ny = Math.floor((yb - ya + 1) / ROOM_TILE), G = { nx: nx, ny: ny, x0: xa, y0: ya, s: new Uint8Array(nx * ny), zt: new Int16Array(nx * ny), deck: true };
  var BB = hullDeckKit(T).gunsBB;
  for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) {
    var x0 = xa + i * ROOM_TILE, y0 = ya + j * ROOM_TILE, z = -1, ok = 1;
    for (var x = x0; x < x0 + ROOM_TILE && ok; x++) for (var y = y0; y < y0 + ROOM_TILE && ok; y++) {
      var zz = standZ(g, x, y, D.zr[0], D.zr[1], 8);
      if (zz < 0 || (z >= 0 && Math.abs(zz - z) > 1)) ok = 0; else if (z < 0) z = zz;
    }
    var k = i + j * nx; G.zt[k] = z;
    if (ok && BB.some(function (b) { return x0 + ROOM_TILE + 2 > b[0] && x0 - 2 < b[3] && y0 + ROOM_TILE + 2 > b[1] && y0 - 2 < b[4] && z + 8 > b[2] && z - 3 < b[5]; })) ok = 3;
    G.s[k] = ok;
  }
  return T.deckG[id] = G;
}
/** 自動的取用點換成格子（配置頁顯示、第一次改的時候抄下來）：最小角落在哪一格（四捨五入）。 */
function deckAutoItems(T, D) {
  var G = deckGrid(T, D), it = Object.keys(FURN).filter(function (k) { return FURN[k].role === 'powder'; })[0];
  return it ? (hullDeckKit(T).auto[deckId(D)] || []).map(function (a) { return { it: it, x: Math.round((a.spot[0] - G.x0) / ROOM_TILE), y: Math.round((a.spot[1] - G.y0) / ROOM_TILE), r: 0 }; }) : [];
}
/** 房間的俯視格子（0.5 m 一格；第一次用到才算，記在那一間上）：{ nx, ny, x0, y0, z, s }。
 *  s[i + j·nx]：0 ＝ 不能擺（腳下沒有地板、頭上 1.4 m 內有東西）、1 ＝ 可以擺、2 ＝ 門口走道（站得住、不能擺）。格子從最小角排起，不到一格的零頭平分在兩邊。 */
function roomGrid(T, r) {
  if (r.grid) return r.grid;
  var g = T.base, X = r.max[0] - r.min[0] + 1, Y = r.max[1] - r.min[1] + 1, nx = Math.floor(X / ROOM_TILE), ny = Math.floor(Y / ROOM_TILE);
  var G = { nx: nx, ny: ny, x0: r.min[0] + Math.floor((X - nx * ROOM_TILE) / 2), y0: r.min[1] + Math.floor((Y - ny * ROOM_TILE) / 2), z: r.min[2], s: new Uint8Array(nx * ny) };
  var doors = roomDoors(g, r).concat(r.door ? [[r.door[0], r.door[1]]] : []), z = G.z, head = Math.min(ROOM_HEAD, r.max[2] - z + 1);   // 標了 <房名>.door ⇒ 也算門（夜隼號 2 號：前後各差一階，牆上找不到門）
  for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) {
    var ok = 1, cx = G.x0 + i * ROOM_TILE + (ROOM_TILE - 1) / 2, cy = G.y0 + j * ROOM_TILE + (ROOM_TILE - 1) / 2;
    var aisle = doors.some(function (d) { return Math.abs(d[0] - cx) <= ROOM_AISLE && Math.abs(d[1] - cy) <= ROOM_AISLE; });
    for (var x = G.x0 + i * ROOM_TILE; x < G.x0 + (i + 1) * ROOM_TILE && ok; x++) for (var y = G.y0 + j * ROOM_TILE; y < G.y0 + (j + 1) * ROOM_TILE && ok; y++) {
      if (!g.get(x, y, z - 1)) ok = 0;
      for (var k = 0; k < head && ok; k++) if (g.get(x, y, z + k)) ok = 0;
    }
    G.s[i + j * nx] = ok && aisle ? 2 : ok;
  }
  return r.grid = G;
}
/** 物品佔幾格：[x 方向, y 方向]（外框 size[0] ＝ 長邊；r ＝ 1 ⇒ 長邊沿 y）。 */
function itemTiles(it, r) { var f = FURN[it], a = Math.ceil(f.size[0] / ROOM_TILE), b = Math.ceil(f.size[1] / ROOM_TILE); return r ? [b, a] : [a, b]; }
/** p（{ it, x, y, r }）擺得下嗎：可以 ⇒ ''，不行 ⇒ 原因。items ＝ 這一間已經擺的（skip ＝ 不算的那一件：改位置時）。
 *  擺上去之後每一件都要有一邊挨著從門口走得到的空格（⛔ 不檢查 ⇒ 床排滿一圈，裡面那張沒人走得到）；沒有門的房間不檢查這一項。 */
function placeOk(G, type, items, p, skip) {
  var f = FURN[p.it], F = ROOM_FN[type];
  if (!f) return '不認得的物品';
  if (F && F.items && F.items.indexOf(p.it) < 0) return '這一類房間不能擺' + f.name;
  var t = itemTiles(p.it, p.r), i, j;
  if (p.x < 0 || p.y < 0 || p.x + t[0] > G.nx || p.y + t[1] > G.ny) return '超出房間';
  var occ = new Int16Array(G.nx * G.ny), all = items.filter(function (q) { return q !== skip; }).concat([p]);
  for (i = 0; i < occ.length; i++) occ[i] = -1;
  for (var n = 0; n < all.length; n++) {
    var q = all[n], tq = itemTiles(q.it, q.r);
    for (j = q.y; j < q.y + tq[1]; j++) for (i = q.x; i < q.x + tq[0]; i++) {
      var k = i + j * G.nx;
      if (q === p) {
        if (!G.s[k]) return '腳下站不住（沒有地板或頭上有東西）'; if (G.s[k] === 2) return '擋到門口'; if (G.s[k] === 3) return '擋到砲（砲班的位置）';
        if (occ[k] >= 0) return '跟' + FURN[all[occ[k]].it].name + '重疊';
        if (G.zt && Math.abs(G.zt[k] - G.zt[p.x + p.y * G.nx]) > 1) return '地面不平';
      }
      occ[k] = n;
    }
  }
  return roomReachAll(G, all, occ) ? '' : '會把別的物品圍住（走不到）';
}
/** 每一件都有一邊挨著從門口（s ＝ 2）沿空格走得到的格嗎（沒有門 ⇒ 不檢查）。 */
function roomReachAll(G, all, occ) {
  var seen = new Uint8Array(G.nx * G.ny), q = [], k;
  for (k = 0; k < G.s.length; k++) if (G.s[k] === 2) { seen[k] = 1; q.push(k); }
  if (!q.length) return true;
  while (q.length) {
    k = q.pop(); var i = k % G.nx, j = (k - i) / G.nx;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var a = i + d[0], b = j + d[1], m = a + b * G.nx; if (a < 0 || b < 0 || a >= G.nx || b >= G.ny || seen[m] || !G.s[m] || occ[m] >= 0) return; seen[m] = 1; q.push(m); });
  }
  return all.every(function (p) {
    var t = itemTiles(p.it, p.r);
    for (var j = p.y - 1; j <= p.y + t[1]; j++) for (var i = p.x - 1; i <= p.x + t[0]; i++) {
      var edge = (i === p.x - 1 || i === p.x + t[0]) !== (j === p.y - 1 || j === p.y + t[1]);   // 四邊、不含四個角
      if (edge && i >= 0 && j >= 0 && i < G.nx && j < G.ny && seen[i + j * G.nx]) return true;
    }
    return false;
  });
}
/** 一鍵「自動擺滿」：先擺必要件（need），再擺加強件（extra：各幾件），剩下的空間擺 fill 擺到滿 ⇒ { items, why }（放不下必要件 ⇒ items ＝ null、why ＝ 原因）。
 *  擺法：長邊順著房間的長邊先試、不行再轉；從離門最遠的格開始找（沒有門 ⇒ 從最小角）；同一間、同一個類型每次擺出來一樣（沒有亂數）。 */
function roomAuto(T, r, type) {
  var F = ROOM_FN[type]; if (!F) return { items: null, why: '不認得的房間類型' };
  r.autoC = r.autoC || {}; if (r.autoC[type]) return r.autoC[type];         // 記在那一間上（⛔ 拿回去的 items 不要改：要改先複製）
  var G = roomGrid(T, r), items = [], cand = [], i, j, dx = 0, dy = 0, nd = 0;
  for (i = 0; i < G.s.length; i++) if (G.s[i] === 2) { dx += i % G.nx; dy += Math.floor(i / G.nx); nd++; }
  for (j = 0; j < G.ny; j++) for (i = 0; i < G.nx; i++) cand.push([i, j, nd ? -Math.hypot(i - dx / nd, j - dy / nd) : i + j * G.nx]);
  cand.sort(function (a, b) { return a[2] - b[2] || a[1] - b[1] || a[0] - b[0]; });
  var r0 = G.ny > G.nx ? 1 : 0;
  function put(it) {
    for (var c = 0; c < cand.length; c++) for (var k = 0; k < 2; k++) {
      var p = { it: it, x: cand[c][0], y: cand[c][1], r: k ? 1 - r0 : r0 };
      if (!placeOk(G, type, items, p)) { items.push(p); return true; }
    }
    return false;
  }
  var need = F.need || {}, lack = [];
  Object.keys(need).forEach(function (it) { for (var k = 0; k < need[it]; k++) if (!FURN[it] || !put(it)) { lack.push((FURN[it] ? FURN[it].name : it) + ' ' + need[it]); break; } });
  if (lack.length) return r.autoC[type] = { items: null, why: '放不下必要件：' + lack.join('、') + '（可以擺的地方 ' + (G.nx * ROOM_TILE * S).toFixed(1) + '×' + (G.ny * ROOM_TILE * S).toFixed(1) + ' m）' };
  var ex = F.extra || {};
  Object.keys(ex).forEach(function (it) { for (var k = 0; k < ex[it]; k++) if (!FURN[it] || !put(it)) break; });
  if (F.fill && FURN[F.fill]) while (items.length < 64 && put(F.fill)) { /* 擺到滿 */ }
  return r.autoC[type] = { items: items, why: '' };
}
/** 存的擺法照順序一件一件驗（房間的形狀改了、物品清單改了 ⇒ 擺不下的那幾件不擺，記在 bad）。 */
function roomCheck(T, r, type, list) {
  var G = roomGrid(T, r), items = [], bad = [];
  (list || []).forEach(function (p) { var why = FURN[p.it] ? placeOk(G, type, items, p) : '不認得的物品'; if (why) bad.push((FURN[p.it] ? FURN[p.it].name : p.it) + '：' + why); else items.push(p); });
  return { items: items, bad: bad };
}
/** 那一間照擺法實際擺上的物品 ⇒ { type, items, bad, why, auto }（空著 ⇒ type ＝ null）。 */
function roomItems(T, r, plan) {
  if (!plan) return { type: null, items: [], bad: [], why: '' };
  if (!plan.items) { var a = roomAuto(T, r, plan.type); return { type: plan.type, items: a.items || [], bad: [], why: a.why, auto: true }; }
  var c = roomCheck(T, r, plan.type, plan.items); return { type: plan.type, items: c.items, bad: c.bad, why: '' };
}
/** 擺法缺哪幾樣必要件（its：物品 id 的清單）⇒ '' ＝ 都有；否則「病床 1」。缺必要件的那一間不能用。 */
function roomLack(type, its) {
  var need = (ROOM_FN[type] || {}).need || {};
  return Object.keys(need).filter(function (it) { return its.filter(function (x) { return x === it; }).length < need[it]; }).map(function (it) { return (FURN[it] ? FURN[it].name : it) + ' ' + need[it]; }).join('、');
}
/** 房間整合 buff：同一間裡（還在的）物品給的 buff 加總，每一種照 buffCap 封頂 ⇒ { 種類: { sum, cap, v } }。its：物品 id 的清單。 */
var BUFF_NAMES = { heal: '治療速度' };
function roomBuff(type, its) {
  var F = ROOM_FN[type] || {}, cap = F.buffCap || {}, o = {};
  its.forEach(function (it) { var b = (FURN[it] || {}).buff || {}; Object.keys(b).forEach(function (k) { (o[k] = o[k] || { sum: 0, cap: cap[k] === undefined ? Infinity : cap[k] }).sum += +b[k] || 0; }); });
  Object.keys(o).forEach(function (k) { o[k].v = Math.min(o[k].sum, o[k].cap); });
  return o;
}
/** buff 寫成一行字：「治療速度 +45%（上限 60%）」。 */
function buffText(B) { return Object.keys(B).map(function (k) { var b = B[k]; return (BUFF_NAMES[k] || k) + ' +' + Math.round(b.v * 100) + '%' + (b.sum > b.cap ? '（加總 ' + Math.round(b.sum * 100) + '%，上限 ' + Math.round(b.cap * 100) + '%）' : isFinite(b.cap) ? '（上限 ' + Math.round(b.cap * 100) + '%）' : ''); }).join('、'); }
/** 程式產生的物品模型（雕刻的物品到之前的佔位）：幾個方塊，網格格式跟 .vxk 的模型一樣（verts 相對外框最小角、tris、tmat → mats）。
 *  ax ＝ 'x' ⇒ 長邊沿 x，'y' ⇒ 沿 y。 */
function furnBoxes(item, ax) {
  var f = FURN[item], L = f.size[0], W = f.size[1], H = f.size[2], B = [];
  if (item === 'bed') B = [[0, 0, 0, 1, 1, H - 2, 0], [L - 1, 0, 0, L, 1, H - 2, 0], [0, W - 1, 0, 1, W, H - 2, 0], [L - 1, W - 1, 0, L, W, H - 2, 0],    // 四根腳、床板、床墊、枕頭
    [0, 0, H - 2, L, W, H - 1, 0], [1, 1, H - 1, L - 1, W - 1, H, 1], [L - 4, 1.5, H - 0.5, L - 1, W - 1.5, H + 0.5, 2]];
  else if (item === 'table') B = [[1, 1, 0, 2, 2, H - 1, 0], [L - 2, 1, 0, L - 1, 2, H - 1, 0], [1, W - 2, 0, 2, W - 1, H - 1, 0], [L - 2, W - 2, 0, L - 1, W - 1, H - 1, 0], [0, 0, H - 1, L, W, H, 2]];   // 四根腳、檯面
  else if (item === 'medkit') B = [[0, 0, 0, L, W, H - 1, 0], [0, 0, H - 1, L, W, H, 3]];   // 箱子、紅蓋
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
var FURN_MATS = [[0.42, 0.28, 0.16], [0.82, 0.78, 0.66], [0.93, 0.92, 0.88], [0.7, 0.16, 0.14]];   // 木頭、帆布床墊、枕頭（檯面）、藥箱的紅蓋
/** 那一型的物品網格（每種物品兩個方向各一份，第一次用到才做、接在 T.meshes 後面）⇒ 網格的索引。 */
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
/** 開戰前就看得出來的「走不走得到」（船隻配置頁用）：預備水手待命那一層（最低那座梯子的下層）沿梯子走得到的甲板 ⇒ { 甲板序號: true }；沒有甲板 meta ⇒ null（不判斷）。
 *  開戰後照實際的走路格（42_hands.js：區域與斷掉的梯子）。 */
/** 梯子兩頭各通哪一層甲板 ⇒ [foot 那層, head 那層]（甲板 meta 的物件；那一頭落不到任何一層 ⇒ null；這艘沒有甲板 meta ⇒ 回 null，照高度判）。
 *  梯子關聯 meta 有 `<梯名>.decks`（例 "upper,forecastle"：兩層的甲板代號 deck、名字 name 或 level，逗號分隔）⇒ 直接照它接，不看其他判定（Tim 2026-10-14）；
 *    level 低的那層接 foot。寫錯（找不到那層、兩個同一層）⇒ 主控台警告、照下面自動判。
 *  沒有 ⇒ 兩頭各照那一欄的地板（deckAt：x 也看 —— 風暴角號後甲板與艏樓高度重疊、前後不重疊，照高度切不開；summit 2026-10-14）。 */
function ladDecks(T, l) {
  var D = hullDecks(T); if (!D.length) return null;
  if (l.link !== undefined && l.link !== null && l.link !== '') {
    var k = String(l.link).split(/[,，]/).map(function (s) { s = s.trim(); return D.filter(function (d) { return d.id === s || d.name === s || String(d.level) === s; })[0]; });
    if (k.length === 2 && k[0] && k[1] && k[0] !== k[1]) { var r = k[0].i < k[1].i ? [k[0], k[1]] : [k[1], k[0]]; r.link = true; return r; }
    console.warn('梯子 ' + l.name + ' 的 decks「' + l.link + '」對不上兩層甲板 ⇒ 照地板自動判');
  }
  var a = l.pts[0], b = l.pts[l.pts.length - 1];
  return [deckAt(T, a[0], a[2]), deckAt(T, b[0], b[2])];
}
function deckReach(T) {
  var D = hullDecks(T); if (!D.length) return null;
  var E = [], home = -1;
  shipLadders(T).forEach(function (l) { var k = ladDecks(T, l), da = k[0], db = k[1]; if (da && db && da !== db) { E.push([da.i, db.i]); var lo = Math.min(da.i, db.i); if (home < 0 || lo < home) home = lo; } });
  var R = {}; if (home < 0) return R;
  R[home] = true; var q = [home];
  while (q.length) { var u = q.shift(); E.forEach(function (e) { var v = e[0] === u ? e[1] : e[1] === u ? e[0] : -1; if (v >= 0 && !R[v]) { R[v] = true; q.push(v); } }); }
  return R;
}
/** 開戰時：每艘船自己一份房間；照擺法擺上物品（加進 sh.models，跟砲同一套血量與命中）。 */
function shipRooms(sh) {
  var T = sh.T;
  sh.rooms = hullRooms(T).map(function (r) {
    var o = { name: r.name, deck: r.deck, min: r.min, max: r.max, door: r.door, type: null, furn: [] }, R = roomItems(T, r, roomPlan(T.id, r.name));
    if (!R.type) return o;
    o.type = R.type;
    var G = roomGrid(T, r);
    R.items.forEach(function (p, k) {
      var f = FURN[p.it], t = itemTiles(p.it, p.r), lx = p.r ? f.size[1] : f.size[0], ly = p.r ? f.size[0] : f.size[1];
      var at = [G.x0 + p.x * ROOM_TILE + Math.floor((t[0] * ROOM_TILE - lx) / 2), G.y0 + p.y * ROOM_TILE + Math.floor((t[1] * ROOM_TILE - ly) / 2), G.z];
      var bb = [at[0], at[1], at[2], at[0] + lx, at[1] + ly, at[2] + f.size[2] + 1], nm = p.it + '-' + (k + 1);
      var m = { T: T, k: sh.models.length, name: nm, path: r.name + '/' + nm, kind: 'furn', item: p.it, hold: f.hold || 0, room: o, hp: f.hp, hpMax: f.hp, mesh: furnMesh(T, p.it, p.r ? 'y' : 'x'), origin: at, bb: bb, pts: {}, meta: { kind: 'furniture', item: p.it },
        c: [(bb[0] + bb[3]) / 2, (bb[1] + bb[4]) / 2, (bb[2] + bb[5]) / 2], foot: VK.pack(Math.floor(bb[0] + 1), Math.floor(bb[1] + 1), at[2] - 1), alive: true };
      sh.models.push(m); o.furn.push(m);
    });
    return o;
  });
  sh.roomLines = null;
}
/** 那一間現在的 buff（只算還在的物品）。 */
function roomBuffNow(o) { return roomBuff(o.type, o.furn.filter(function (m) { return m.alive; }).map(function (m) { return m.item; })); }
/** 那一間現在的能力 ＝ 還在的容納物品（病床）各自剩下的血量比例 × 容納人數加起來（醫療艙 ＝ 幾張床的份量）；之後再乘人手。 */
function roomCap(o) { var s = 0; o.furn.forEach(function (m) { if (m.alive && m.hold) s += m.hold * m.hp / m.hpMax; }); return s; }
/** 打壞了幾成：現在的能力 ÷ 剛擺好時（0–1）。 */
function roomEff(o) { var n = 0; o.furn.forEach(function (m) { n += m.hold; }); return o.type && n ? roomCap(o) / n : 0; }
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
      html += '<span style="position:absolute;left:' + sx.toFixed(0) + 'px;top:' + sy.toFixed(0) + 'px;transform:translate(-50%,-100%)">' + r.name.split('/').slice(-2).join('/') + (r.type ? '・' + ROOM_FN[r.type].name + ' ' + r.furn.filter(function (m) { return m.alive; }).length + '／' + r.furn.length : '') + '</span>';
    });
  });
  if (box.innerHTML !== html) box.innerHTML = html;
}
/** 讀數（__game.rooms）：每艘每一間的名字、組裝件座標、尺寸（m）、類型、物品（還在／擺上；打壞的帶 ×）、buff、能力。 */
function roomsInfo() {
  return SHIPS.map(function (sh) {
    return { ship: sh.name, type: sh.T.id, bad: sh.T.roomsBad, rooms: (sh.rooms || []).map(function (r) {
      var B = r.type ? roomBuffNow(r) : {}, b = {}; Object.keys(B).forEach(function (k) { b[k] = +B[k].v.toFixed(3); });
      return { name: r.name, min: r.min, max: r.max, m: [0, 1, 2].map(function (k) { return +((r.max[k] - r.min[k] + 1) * S).toFixed(2); }), type: r.type, furn: r.furn.length, alive: r.furn.filter(function (m) { return m.alive; }).length,
        items: r.furn.map(function (m) { return m.item + (m.alive ? '' : '×'); }).join(' '), buff: b, cap: +roomCap(r).toFixed(2), eff: +roomEff(r).toFixed(2) };
    }) };
  });
}
