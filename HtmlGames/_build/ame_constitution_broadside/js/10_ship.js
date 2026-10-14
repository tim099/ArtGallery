// ───────────────────────── 船 ─────────────────────────
// 格 → 船體（公尺）：(x, y, z) ⇒ (S(x−cx), S(z−zw), S(y−cy))。船體 ＝ 世界的軸（+X 船頭、+Y 上、+Z ＝ 右舷）。
// 雕刻引擎的格是另一個手性（面向船頭 +x、上 +z，+y 在右手邊 ＝ 右舷 S：basecamp 的命名、船尾名牌 EMBER 在雕刻引擎的 view 裡讀起來是正的）
// ⇒ 這是一個鏡射（行列式 −1）：船殼的繞序反過來（畫船時 frontFace CW，見 60_render.js shipFace）。
// ⛔ 2026-10-13 以前是 −S(y−cy)（旋轉、不是鏡射）⇒ 整艘船畫成作品的鏡像：EMBER 反著寫、右舷 S 出現在畫面左邊。
function shipBaseMatrix(T) {
  return new Float32Array([S, 0, 0, 0, 0, 0, S, 0, 0, S, 0, 0, -S * T.cx, -S * T.zw, -S * T.cy, 1]);
}
function shipMatrix(sh) {
  var m = trans(sh.px, -sh.sink + sh.lift + (sh.wl || 0) + sh.bob, sh.pz);   // wl：船底的平均水面、bob：船身相對它的起伏（08_sea.js）
  m = M4.mul(m, rotM([0, 1, 0], sh.yaw));
  m = M4.mul(m, rotM([0, 0, 1], sh.pitchA + (sh.pitchW || 0)));
  m = M4.mul(m, rotM([1, 0, 0], sh.rollA + (sh.rollW || 0)));
  return M4.mul(m, shipBaseMatrix(sh.T));
}
function shipCenter(sh) { return M4.pt(sh.M, sh.T.cx, sh.T.cy, sh.T.geo.center); }
function toLocal(sh, p) { return M4.pt(sh.inv, p[0], p[1], p[2]); }

function makeShip(i, team, yaw, pz, T, px) {                          // T：船型（05_hull.js）；px：編隊裡的前後位置（52_fleet.js spawnFleet；沒給 ＝ 0）
  var grid = T.base.share(), rsSet = new VK.RegionSet(gl, grid, QIDX);
  rsSet.shareFrom(T.pristine);
  var sh = {                                                            // cfg：船隻設定（開戰時那一型的值，04_state.js）
    T: T, cfg: cfgCopy(T.id), i: i, team: team, grid: grid, rs: rsSet, yaw: yaw, px: px || 0, pz: pz, sink: 0, sinkV: 0, lift: 0, liftT: 0, rollA: 0, pitchA: 0, rollV: 0, bob: 0,
    phase: rnd() * 6.28, orig: grid.count, flood: new Float32Array(T.sz * 3), lost: 0, seeds: [], impulse: [0, 0, 0],
    guns: [], ropes: [], sails: [], rigDirty: true, lines: null, tris: null, masts: [], aim: null, reloadT: MODE === 'sandbox' && i === PLAYER_I ? RELOAD_SANDBOX : RELOAD,
    fired: 0, hits: 0, salvo: 0, aiWait: rr(1, 3), sunk: false, struck: false, fate: '', silentT: -1, gunsAlive: 0, mastsUp: T.masts.length, sinkingFinal: false,
    spd: 0, spd0: true, yawRate: 0, vel: [0, 0, 0], wakeT: 0, sailFrac: 1, pos: '',
    side: 'S', manual: false, rudder: 0, sailSet: 3, bumpT: 0
  };
  // 模型（砲、火藥桶、舵輪）：整個是一塊剛體 —— 被打到扣血，歸零整個飛出去（火藥桶 ⇒ 殉爆，見 23_powder.js），⛔ 不拆格。
  // 種類照 basecamp 給的 meta（TASK-0517）：{kind:'gun', gun:'24l'|'32c'|'18chase'}、{kind:'powder', powder_lb}；舵輪沒有 meta ⇒ 照名字。
  sh.models = (T.rig.models || []).map(function (m, k) {
    var b = m.bbox, kind = modelKind(m), pv = (m.points || {}).pivot;
    var cx = Math.floor((b[0] + b[3]) / 2), cy = Math.floor((b[1] + b[4]) / 2), fz = Math.floor(b[2]) - 1;
    var foot = -1;
    if (kind === 'yard' && pv) foot = anchorNear(T, pv[0], pv[1], pv[2], 8);   // 帆桁：「腳」是轉軸旁最近的那一格桅（桅斷了跟著走、被打掉就掉）；⛔ 往下找：艏斜桅下面是空的，spritsail 一開局就掉
    var st = (m.points || {})['stock-top'];
    if (kind === 'rudder' && st) foot = anchorNear(T, st[0], st[1], st[2], 8);   // 舵：掛在艉柱上 ⇒「腳」是舵頭旁的船尾（⛔ 往下找：舵底在 z 0，腳落到 z −1 ⇒ 開局就掉）
    var bl = (m.points || {}).bail;
    if (foot < 0 && bl) foot = anchorNear(T, bl[0], bl[1], bl[2], 8);   // 提著的燈（夜燈號船首像的提燈，固定點 bail ＝ 提環頂、手握的地方）：「腳」是手（⛔ 往下找：底下是海 ⇒ 開局就掉、燈不亮）
    var hang = false;
    if (foot < 0) { var z0 = fz; while (fz > 0 && !T.base.get(cx, cy, fz)) fz--; if (z0 - fz <= 12 || kind !== 'model') foot = VK.pack(cx, cy, fz); else hang = true; }   // 腳下那一格甲板（被打掉 ⇒ 掉下去）
    // 掛著的（吊艇架上的小艇；Tim 2026-10-14：一開場就掉）：底下 1.2 m 內沒有甲板 ⇒ 掛在吊索上（下面 hangFalls 找；吊索全斷才掉）。
    //   ⛔ 照舊往下找 ⇒ 找到海底 z 0 ⇒ 第一次 survey 就掉。foot 暫時是正下方（找到吊索之後換成吊索上端的那一格 ⇒ 吊艇架被打斷帶走時跟著走）
    if (foot < 0) foot = VK.pack(cx, cy, fz);
    var hpm = kind === 'powder' ? powderHP() : kind === 'wheel' ? Math.round(GUN_HP * 0.6) : kind === 'model' ? 1 : GUN_HP;   // 細節設定的血量；舵輪 6 成；帆桁、舵跟砲一樣
    var mt = m.meta || {};
    return { T: T, k: k, name: m.name.split('/').pop(), path: m.name, kind: kind, hp: hpm, hpMax: hpm, mesh: m.mesh, origin: m.origin, bb: b, pts: m.points || {}, meta: mt,
      c: [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2], foot: foot, alive: true,
      rot: 0, r0: (+mt.rotate_z_deg || 0) * Math.PI / 180, piv: pv, yk: mt.yard, sail: mt.sail, hang: hang };   // 帆桁：rot ＝ 在作品的角度（r0）之外又轉了多少（追風，30_rig_physics.js）
  });
  sh.yards = sh.models.filter(function (m) { return m.kind === 'yard' && m.piv; });
  // 砲：長砲（24 磅，兩舷各 14）、carronade（32 磅，兩舷各 12）、追擊砲（18 磅，船頭兩舷各 1）都是模型。
  // 砲軸 ＝ 固定點 muzzle − breech（格座標、水平）；砲口 ＝ muzzle 再往外 1.5 格（muzzle 在砲口內膛那一格）。
  // 程式裡的 'S'／'P' 照砲軸（+y ＝ S，跟模型名字一致）＝ 右舷／左舷（shipBaseMatrix 照雕刻引擎的手性鏡射過來）。給人看的走 sideName；A／D 照畫面的左右。
  sh.models.forEach(function (m) {
    if (!GUNS[m.kind]) return;
    var A = gunMuzzle(m);
    sh.guns.push(m.gun = { name: m.name, type: m.kind, side: A.ax[1] >= 0 ? 'S' : 'P', model: m, ax: A.ax, muz: A.muz, muzs: A.muzs, alive: true, reload: rr(0, 1.2), box: BOX_N, needCart: false });   // box：砲旁藥箱裡的份數
  });
  sh.guns.sort(gunOrder);
  sh.decks = gunDecks(sh); sh.weatherDeck = sh.decks.length ? sh.decks[sh.decks.length - 1].key : null;   // 砲甲板（照砲的高度分層）；最上面那層 ＝ 露天
  sh.deckZ = {}; sh.decks.forEach(function (D) { sh.deckZ[D.key] = D.zr; });
  sh.mags = makeMags(sh);                                                // 彈藥庫（23_powder.js）
  sh.stations = makeStations(sh);                                        // 兩層甲板的火藥與彈藥取用點（火藥桶也是模型，加在 sh.models 後面）
  shipRooms(sh);                                                        // 空艙房與功能艙的家具（36_rooms.js；TASK-0568）：家具也是模型 ⇒ 排在命中的分桶之前
  sh.mIdx = modelIndex(sh.models);
  // 繩與帆：兩端（帆取最高那一排）各找最近的實心格當錨 —— 錨被打掉或跟船分家 ⇒ 繩斷、帆掉
  T.rig.ropes.forEach(function (r) {
    var n = r.pts.length / 3;
    sh.ropes.push({ pts: r.pts, col: r.color, bb: ropeBox(r.pts), a: anchorNear(T, r.pts[0], r.pts[1], r.pts[2], 5), b: anchorNear(T, r.pts[n * 3 - 3], r.pts[n * 3 - 2], r.pts[n * 3 - 1], 5), name: r.name, meta: r.meta || null });
  });
  linkRopes(T, sh.ropes, sh.models);
  hangFalls(sh); sh.rbin = new Set();
  T.rig.sails.forEach(function (s) {
    var vz = -1e9, ax = 0, ay = 0, az = 0, k = 0, j;
    for (j = 2; j < s.verts.length; j += 3) vz = Math.max(vz, s.verts[j]);
    for (j = 0; j < s.verts.length; j += 3) if (s.verts[j + 2] > vz - 2) { ax += s.verts[j]; ay += s.verts[j + 1]; az += s.verts[j + 2]; k++; }
    sh.sails.push(sailAnchors(sh, { verts: s.verts, tris: s.tris, col: s.color, name: s.name, meta: s.meta || null, bb: ropeBox(s.verts) }, [ax / k, ay / k, az / k]));
  });
  // 帆自己的繩（`<帆名>.sheet-S`、`.tack-P`…）：帆腳那一端綁在帆上 ⇒ 帆掉了或被帶走，它們跟著斷
  // （⛔ 只靠繩的依靠不夠：sheet 與 tack 互相掛著、另一端綁甲板，帆沒了也還浮在半空）
  sh.sails.forEach(function (s, k) { s.k = k; s.hp = s.hpMax = SAIL_HP; s.lines = []; sh.ropes.forEach(function (r, j) { if (sailRope(r, s.name)) s.lines.push(j); }); });
  sh.sails.forEach(function (s) {
    s.yards = sh.yards.filter(function (y) { return y.sail === s.name; });   // 掛這面帆的帆桁（spanker：gaff＋boom）
    // 帆腳跟著轉的帆桁：topsail 以上 ＝ 下一根（sheet 綁在它兩端）；course ＝ 沒有（綁甲板）；spanker（沒有帆腳，下緣綁 boom）＝ 低的那根
    var f = T.cloth[s.k] ? T.cloth[s.k].foot : -1, low = s.yards.slice().sort(function (a, b) { return a.piv[2] - b.piv[2]; });
    s.footYard = f >= 0 ? sh.models[f] : low.length > 1 ? low[0] : null;
    if (low.length > 1) s.yards = low.reverse();                          // 帆頂那根排第一（打中帆照它轉回作品角度）
  });
  ropeYards(sh);
  sh.ropes.forEach(function (r) { r.never = r.lz = !!r.dead; });        // 一開始就不畫的繩不會變成垂下來的繩（物理，見 physStep）
  sh.cl = T.cloth.map(function (C) { return { T: C, p: null, hidden: true }; }); sh.loose = []; sh.shreds = [];   // shreds：帆的布片（34_shreds.js）
  sh.sails.forEach(function (s) { s.flag = isFlag(s); s.area = s.flag ? 0 : sailArea(s); }); sh.sailArea0 = sh.sails.reduce(function (a, s) { return a + s.area; }, 0) || 1;   // 旗不算推力（面積 0）
  applySailSet(sh);
  T.masts.forEach(function (m) { sh.masts.push({ name: m.name, x: m.x, z0: m.z0, z1: m.z1, orig: m.orig, z0top: m.z0top, up: true }); });
  sh.crew = makeCrew(sh); sh.crew0 = sh.crew.length; sh.wounded = 0; sh.dead = 0; sh.kills = 0; sh.wounds = 0; sh.causes = {};   // kills／wounds：累計（廣播傷亡用；wounded 會在傷者陣亡時減回去）
  sh.news = { guns: [], t: -9, k: 0, w: 0, kr: {}, wr: {} };
  sh.M = shipMatrix(sh); sh.inv = M4.inv(sh.M);
  sh.fl = flNew(sh);                                                    // 進水：粒子模式（33_flood.js；公式模式 ⇒ null）
  return sh;
}
// 砲種（meta gun 的代碼 ⇒ 程式裡的種類）：名字、初速（m/s）、裝填倍率、彈大不大（洞大一點）、砲班滿編／最少、重量（噸，浮力用）、每發傷害（DMG 的鍵，細節設定）。
// 長砲 24 磅、carronade 32 磅、追擊砲 18 磅是憲法號的；32 磅長砲是給餘燼號的（basecamp TASK-0519：下層砲甲板 28 門，新做一門）；4 磅砲是夜隼號的（兩舷各 6）。
// hole：實心彈的洞大小倍率（沒寫 ＝ 1；big ＝ 1.25）。
var GUNS = CFG.guns;   // config/game.json 的 guns（TASK-0542）：code、name、short、V 初速（m/s）、reload 裝填倍率、big、hole、crew 砲班滿編、min 最少、mass 重量（噸）
var GUN_CODE = {}; Object.keys(GUNS).forEach(function (k) { GUN_CODE[GUNS[k].code] = k; });
/** 砲甲板：照舷側砲（不含追擊砲）的高度（外框底）分層 —— 排好之後相差 10 格以上就是另一層（甲板有舷弧，同一層前後差 6 格）；
 *  追擊砲再歸到最近的那一層（⛔ 一起排：船尾追擊砲的高度落在兩層之間，會把上下兩層砲甲板接成一層）。
 *  每層：站人的高度範圍 zr（照那一層第一門不是追擊砲的砲：carronade 那層 −6～+3、其他 −8～+5）、名字、最上面那層 ＝ 露天（陸戰隊、砲長的「甲板人員」）。
 *  憲法號：長砲 z 82–86＋追擊砲 88 ／ carronade 105–108 ⇒ 兩層，跟以前照砲種分（長砲＋追擊砲 ／ carronade）一樣；餘燼號兩層砲甲板都是長砲 ⇒ 照種類分不出來。 */
/** 砲軸（水平、單位長）與砲口（muzzle 再往外 1.5 格）：m ＝ 模型（pts、name、c、bb）。 */
function gunMuzzle(m) {                                               // ⛔ 不叫 gunAxis：21_gunnery.js 有一個 gunAxis(sh, g)（世界座標的砲軸），同名的後面那個蓋掉前面
  var mz = m.pts.muzzle, br = m.pts.breech, ax;
  if (mz && br) ax = [mz[0] - br[0], mz[1] - br[1]];
  else { var sg0 = /-P\d*$|-P$/.test(m.name) ? -1 : 1; ax = [0, sg0]; mz = [m.c[0], sg0 > 0 ? m.bb[4] - 0.5 : m.bb[1] + 0.5, m.c[2]]; }   // 沒有固定點（舊的 .vxk）⇒ 外框外緣
  var al = Math.hypot(ax[0], ax[1]) || 1; ax = [ax[0] / al, ax[1] / al];
  var mk = Object.keys(m.pts || {}).filter(function (k) { return /^muzzle-[a-z]$/.test(k); }).sort();   // 多管砲（風暴角號的三管砲：muzzle-a／b／c）⇒ 連發時輪流出彈（21_gunnery.js burstStep）
  return { ax: ax, muz: [mz[0] + ax[0] * 1.5, mz[1] + ax[1] * 1.5, mz[2]], muzs: mk.length ? mk.map(function (k) { var q = m.pts[k]; return [q[0] + ax[0] * 1.5, q[1] + ax[1] * 1.5, q[2]]; }) : null };
}
/** 砲的順序：船頭往船尾、同一個 x 先左舷（砲甲板的「主砲」＝ 每層第一門側舷砲 ⇒ 切高照它；送藥手的分對也照這個順序）。 */
function gunOrder(a, b) { return b.muz[0] - a.muz[0] || a.muz[1] - b.muz[1]; }
function gunDecks(sh) {
  if (hullDecks(sh.T).length) return gunDecksMeta(sh);                 // 有甲板 meta（35_decks.js）⇒ 照 meta 分；沒有 ⇒ 底下照砲的高度分（舊匯出的退路）
  var side = sh.guns.filter(function (g) { return g.type !== 'chase'; }); if (!side.length) side = sh.guns;
  var zs = side.map(function (g) { return Math.floor(g.model.bb[2]); }).sort(function (a, b) { return a - b; }), G = [];
  zs.forEach(function (z) { var L = G[G.length - 1]; if (L && z - L.z1 <= 10) L.z1 = z; else G.push({ z0: z, z1: z }); });
  var decks = G.map(function (L, i) { return { key: 'd' + i, z0: L.z0, z1: L.z1, guns: [] }; });
  sh.guns.forEach(function (g) {
    var z = Math.floor(g.model.bb[2]), D = null, bd = 1e9;
    decks.forEach(function (d) { var dd = z < d.z0 ? d.z0 - z : z > d.z1 ? z - d.z1 : 0; if (dd < bd) { bd = dd; D = d; } });   // 在那一層的範圍裡 ⇒ 0；不在 ⇒ 最近的那一層
    g.deck = D.key; D.guns.push(g);
  });
  var low = decks.length - (decks.length > 1 ? 1 : 0);
  decks.forEach(function (D, i) {
    var main = D.guns.filter(function (g) { return g.type !== 'chase'; })[0] || D.guns[0], a = Math.floor(main.model.bb[2]);
    D.zr = main.type === 'carr' ? [a - 6, a + 3] : [a - 8, a + 5];
    D.weather = i === decks.length - 1;
    D.name = D.weather && decks.length > 1 ? '上甲板' : low === 1 ? '砲甲板' : low === 2 ? (i === 0 ? '下層砲甲板' : '上層砲甲板') : '第 ' + (i + 1) + ' 層砲甲板';
  });
  return decks;
}
/** 照甲板 meta 分砲甲板：每門砲照模型的關聯路徑（甲板-gun/…）找所在的那一層，路徑看不出來 ⇒ 照砲架底的高度（deckAt）；
 *  有砲的那幾層由下往上排成 d0、d1…（名字照 meta），站人的高度範圍照那一層第一門不是追擊砲的砲（同舊的算法）；最上面那層 ＝ 露天（陸戰隊、砲長的「甲板人員」）。 */
function gunDecksMeta(sh) {
  var T = sh.T, by = {}, list = [];
  sh.guns.forEach(function (g) {
    var d = deckOfPath(T, g.model.path) || deckAt(T, g.model.c[0], Math.floor(g.model.bb[2])) || hullDecks(T)[0];
    if (!by[d.i]) { by[d.i] = { meta: d, guns: [] }; list.push(by[d.i]); }
    by[d.i].guns.push(g);
  });
  list.sort(function (a, b) { return a.meta.level - b.meta.level; });
  return list.map(function (L, i) {
    var zs = L.guns.map(function (g) { return Math.floor(g.model.bb[2]); });
    var D = { key: 'd' + i, z0: Math.min.apply(null, zs), z1: Math.max.apply(null, zs), guns: L.guns, meta: L.meta, name: L.meta.name, weather: i === list.length - 1 };
    L.guns.forEach(function (g) { g.deck = D.key; });
    var main = L.guns.filter(function (g) { return g.type !== 'chase'; })[0] || L.guns[0], a = Math.floor(main.model.bb[2]);
    D.zr = main.type === 'carr' ? [a - 6, a + 3] : [a - 8, a + 5];
    return D;
  });
}
/** 格座標 P 附近 r 格內有沒有帆桁的網格（照佔用格）⇒ 回那根帆桁的模型編號（T.rig.models 的序號 ＝ sh.models 的序號），沒有 ⇒ -1。 */
function yardNear(T, P, r) {
  var ms = T.rig.models || [];
  for (var k = 0; k < ms.length; k++) {
    var m = ms[k], b = m.bbox; if (!m.meta || m.meta.kind !== 'yard') continue;
    if (P[0] < b[0] - r || P[0] > b[3] + r || P[1] < b[1] - r || P[1] > b[4] + r || P[2] < b[2] - r || P[2] > b[5] + r) continue;
    var oc = T.meshes[m.mesh] && T.meshes[m.mesh].occ; if (!oc) continue;
    var x0 = Math.floor(P[0] - m.origin[0]) + 1, y0 = Math.floor(P[1] - m.origin[1]) + 1, z0 = Math.floor(P[2] - m.origin[2]) + 1;
    for (var dz = -r; dz <= r; dz++) for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
      var x = x0 + dx, y = y0 + dy, z = z0 + dz;
      if (x >= 0 && y >= 0 && z >= 0 && x < oc.nx && y < oc.ny && z < oc.nz && oc.a[x + oc.nx * (y + oc.ny * z)]) return k;
    }
  }
  return -1;
}
/** 繩的兩端各跟著哪根帆桁轉（-1 ＝ 不跟）：端點靠在帆桁上（綁在帆桁上的 brace、lift、footrope，topsail 以上的 sheet…）。
 *  course 的 sheet 與 tack 兩端都不在帆桁上（帆腳綁甲板繩栓）⇒ 不轉，跟帆腳一起留著（clothTemplate 的 clewYard）。同一型的兩艘共用一份（T.ropeYard）。 */
function ropeYards(sh) {
  var T = sh.T;
  if (!T.ropeYard) T.ropeYard = T.rig.ropes.map(function (r) { var n = r.pts.length / 3; return [yardNear(T, [r.pts[0], r.pts[1], r.pts[2]], 3), yardNear(T, [r.pts[n * 3 - 3], r.pts[n * 3 - 2], r.pts[n * 3 - 1]], 3)]; });
  sh.ropes.forEach(function (r, j) { r.pts0 = r.pts; r.ya = T.ropeYard[j][0]; r.yb = T.ropeYard[j][1]; });
  sh.yRopes = sh.ropes.filter(function (r) { return r.ya >= 0 || r.yb >= 0; });
}
/** 模型的種類：meta 優先（basecamp TASK-0517：kind／gun），沒有 meta 才照名字（舊的 .vxk；舵輪本來就沒有 meta）。 */
function modelKind(m) {
  var mt = m.meta || {};
  if (mt.kind === 'gun') return GUN_CODE[mt.gun] || 'long';           // 不認得的代碼 ⇒ 當長砲
  if (mt.kind === 'powder') return 'powder';
  if (mt.kind === 'yard') return 'yard';                              // 帆桁（basecamp 階段三十三：15 根各一件模型，可以繞轉軸轉）
  if (mt.kind === 'wheel') return 'wheel';                            // 餘燼號的舵輪叫「舵輪」、有 meta（⛔ 只照名字 ⇒ 認不出來，船只剩舵柄滑車的 35% 轉向）
  if (mt.kind === 'rudder') return 'rudder';                          // 夜隼號的舵是模型（summit：方艉船掛在艉板外）；憲法號、餘燼號的舵是船殼的格子
  return /carronade/.test(m.name) ? 'carr' : /chase/.test(m.name) ? 'chase' : /\/砲-[SP]\d+$/.test(m.name) ? 'long' : /wheel/.test(m.name) ? 'wheel' : 'model';
}
/** 模型照 x 分桶（每 16 格一桶，外框外擴 12 格登記）⇒ hitModel 只看砲彈所在那一桶（193 個模型 × 每顆砲彈每個小步全掃太貴）。
 *  桶裡照模型編號排 ⇒ 先碰到誰跟全掃一樣。 */
function modelIndex(models) {
  var idx = [];
  models.forEach(function (m) {
    for (var bx = Math.max(0, Math.floor((m.bb[0] - 12) / 16)); bx <= Math.floor((m.bb[3] + 12) / 16); bx++) (idx[bx] = idx[bx] || []).push(m);
  });
  return idx;
}
/** 兩端附近沒有實心格的繩（ratline 掛在 shroud 上）⇒ 掛在端點旁邊那條繩上：那條斷了它也斷、那條跟著桅倒它也跟著倒。 */
/** 掛著的模型（m.hang：吊艇架上的小艇）的吊索 ＝ 一端落在它外框（外擴 0.4 m）裡、或綁在它上面的繩 ⇒ m.falls（繩的序號）；
 *  survey（32_hull.js）：吊索全斷 ⇒ 掉下去。foot 換成吊索另一端（上端）的那一格（吊艇架）⇒ 那一截被打斷帶走時跟著走（22_pieces.js）。找不到吊索 ⇒ 照舊（腳下沒東西 ⇒ 掉）。 */
function hangFalls(sh) {
  sh.models.forEach(function (m) {
    if (!m.hang) return;
    var b = m.bb; m.falls = [];
    function inBox(P) { return P[0] > b[0] - 4 && P[0] < b[3] + 4 && P[1] > b[1] - 4 && P[1] < b[4] + 4 && P[2] > b[2] - 4 && P[2] < b[5] + 4; }
    var tops = [];
    sh.ropes.forEach(function (r, j) {
      var n = r.pts.length / 3, A = [r.pts[0], r.pts[1], r.pts[2]], Bp = [r.pts[n * 3 - 3], r.pts[n * 3 - 2], r.pts[n * 3 - 1]];
      var atA = r.ma === m.k || inBox(A), atB = r.mb === m.k || inBox(Bp);
      if (atA === atB) return;                                            // 兩端都不在（別的繩）或都在（小艇自己身上的繩）
      m.falls.push(j); tops.push(atA ? Bp : A); r.pts0 = r.pts0 || r.pts;
      var top = atA ? r.b : r.a; if (top >= 0 && m.falls.length === 1) m.foot = top;
    });
    if (!m.falls.length) { m.falls = null; return; }
    // 擺（30_rig_physics.js swingHangs）：轉軸 ＝ 兩條吊索上端的連線（只有一條 ⇒ 沿船身），吊點 ＝ 第一條的上端，擺長 ＝ 中心到轉軸的距離
    var ax = tops.length > 1 ? sub(tops[1], tops[0]) : [1, 0, 0]; if (len(ax) < 1) ax = [1, 0, 0];
    var v = sub(m.c, tops[0]); ax = norm(ax); var vp = sub(v, mul(ax, dot(v, ax)));
    m.sax = ax; m.spv = tops[0]; m.sL = Math.max(len(vp), 3); m.sw = 0; m.swA = 0; m.psi = 0; m.psiV = 0; m.pw = null;
    (sh.hangs = sh.hangs || []).push(m);
  });
}
// ── 繩的檢查（Tim 2026-10-14：破壞後有浮空的纜線；?ropecheck=1 ＋ ?dump=1 記進 #dump、ropecheck.py 跑很多局寫報告）──
// 浮空 ＝ 繩還活著（沒斷、沒被帶走），可是有一端撐它的東西已經沒了：
//   格：端點附近（作品裡端點到錨的距離 d0 ＋ 1 格，至少 2 格）已經沒有實心格 —— ⛔ 只看錨那一格不夠：錨是端點 0.5 m 內最近的實心格，常常是隔壁的結構
//   模型：那個模型沒了（飛出去、被斷開的那一截帶走）；帆桁（端點在帆桁的網格上，T.ropeYard：帆桁轉、它跟著轉）：同模型；
//   繩：靠的那條繩斷了、或它自己也浮空。
/** 繩 r 的一端（e：0 ＝ 起點、1 ＝ 終點）靠什麼：{ k: 'yard'|'grid'|'model'|'rope'|'none', a（帆桁或模型序號／錨格／繩序號）, d0（端點到錨格中心，格）, P（端點）}。記在繩上。
 *  ⚠ 帆桁優先：端點在帆桁上的繩，錨（0.5 m 內最近的實心格）常常抓到桅 ⇒ 帆桁飛了、被帶走，錨還在 ⇒ 以前不斷（浮空的主因之一）。 */
function ropeEnd(r, e) {
  r.ends = r.ends || [];
  if (r.ends[e]) return r.ends[e];
  var src = r.pts0 || r.pts, n = src.length / 3, i = e ? n - 1 : 0, P = [src[i * 3], src[i * 3 + 1], src[i * 3 + 2]], an = e ? r.b : r.a, o;
  var yk = e ? r.yb : r.ya;
  if (yk >= 0) o = { k: 'yard', a: yk, P: P };
  else if (an >= 0) o = { k: 'grid', a: an, d0: Math.hypot((an & 1023) + 0.5 - P[0], ((an >> 10) & 1023) + 0.5 - P[1], (an >> 20) + 0.5 - P[2]), P: P };
  else if ((e ? r.mb : r.ma) !== undefined) o = { k: 'model', a: e ? r.mb : r.ma, P: P };
  else if ((e ? r.pb : r.pa) !== undefined) o = { k: 'rope', a: e ? r.pb : r.pa, P: P };
  else o = { k: 'none', a: -1, P: P };
  return r.ends[e] = o;
}
/** 8 格一塊（打掉的格記在哪一塊：sh.rbin）。 */
function ropeBin(x, y, z) { return (x >> 3) | ((y >> 3) << 8) | ((z >> 3) << 16); }
/** 那一端現在撐不撐得住：撐得住 ⇒ ''，撐不住 ⇒ 原因。depth：沿著繩往上追幾層（繩掛在繩上）。
 *  near（survey 用）：最近打掉的格所在的塊（含旁邊一圈）⇒ 格那一端只在端點落在裡面時才量（⛔ 每次全量：兩艘約 3 ms，八艘一格卡 12 ms）；不給 ⇒ 全量（讀數）。 */
function ropeEndWhy(sh, r, e, depth, near) {
  var E = ropeEnd(r, e), n = r.pts.length / 3, i = e ? n - 1 : 0, P = [r.pts[i * 3], r.pts[i * 3 + 1], r.pts[i * 3 + 2]];   // 端點照現在的形狀（帆桁轉了、小艇擺了）
  if (E.k === 'grid') {
    if (near !== undefined && (!near || !near.has(ropeBin(Math.floor(P[0]), Math.floor(P[1]), Math.floor(P[2]))))) return '';
    if (!gp(sh.grid, E.a)) return '錨格被打掉（應該已經斷）';
    var R = Math.max(2, E.d0 + 1), x0 = Math.floor(P[0]), y0 = Math.floor(P[1]), z0 = Math.floor(P[2]), Ri = Math.ceil(R), dx, dy, dz;
    for (dz = -1; dz <= 1; dz++) for (dy = -1; dy <= 1; dy++) for (dx = -1; dx <= 1; dx++) if (sh.grid.get(x0 + dx, y0 + dy, z0 + dz)) return '';   // 先看貼著的（大多數繩端埋在格裡）
    for (dz = -Ri; dz <= Ri; dz++) for (dy = -Ri; dy <= Ri; dy++) for (dx = -Ri; dx <= Ri; dx++) {
      if (dx * dx + dy * dy + dz * dz > R * R) continue;
      if (sh.grid.get(x0 + dx, y0 + dy, z0 + dz)) return '';
    }
    return '端點周圍 ' + R.toFixed(1) + ' 格內沒有格了（錨在 ' + E.d0.toFixed(1) + ' 格外、還在）';
  }
  if (E.k === 'model' || E.k === 'yard') { var m = sh.models[E.a]; return !m ? '模型不見了' : m.moved ? '綁的模型被斷開的那一截帶走了（' + m.name + '）' : !m.alive ? '綁的模型沒了（' + m.name + '）' : ''; }
  if (E.k === 'rope') { var q = sh.ropes[E.a]; if (!q || q.dead) return '靠的繩斷了（' + (q ? q.name : E.a) + '）'; return depth > 0 && ropeFloat(sh, q, depth - 1) ? '靠的繩浮空（' + q.name + '）' : ''; }
  return '';
}
/** 繩 r 浮空嗎 ⇒ null 或 { end, why }。 */
function ropeFloat(sh, r, depth, near) {
  if (r.dead || r.moved) return null;
  for (var e = 0; e < 2; e++) { var w = ropeEndWhy(sh, r, e, depth === undefined ? 4 : depth, near); if (w) return { end: e, why: w }; }
  return null;
}
/** 這艘現在浮空的繩：[{ j, name, end, why, kind, P }]。 */
function ropesFloating(sh) {
  var out = [];
  sh.ropes.forEach(function (r, j) { var f = ropeFloat(sh, r); if (f) { var E = ropeEnd(r, f.end); out.push({ j: j, name: r.name, end: f.end, why: f.why, kind: E.k, P: E.P.map(function (v) { return Math.round(v); }) }); } });
  return out;
}
/** 作品本身（開戰那一刻、還沒打）：每一端靠什麼、端點到錨幾格；遠的（> 2 格）與哪裡都不靠的列出來 ⇒ 雕刻那邊可以把繩端拉到碰到東西。 */
function ropeAuditStatic(sh) {
  var kinds = { yard: 0, grid: 0, model: 0, rope: 0, none: 0 }, far = [], none = [];
  sh.ropes.forEach(function (r, j) {
    [0, 1].forEach(function (e) {
      var E = ropeEnd(r, e); kinds[E.k]++;
      if (E.k === 'grid' && E.d0 > 2) far.push({ name: r.name, end: e, d0: +E.d0.toFixed(1), P: E.P.map(Math.round) });
      if (E.k === 'none') none.push({ name: r.name, end: e, P: E.P.map(Math.round) });
    });
  });
  return { ropes: sh.ropes.length, ends: kinds, far: far, none: none, floatAtStart: ropesFloating(sh).map(function (f) { return f.name + '#' + f.end + '：' + f.why; }) };
}
function linkRopes(T, ropes, models) {
  ropes.forEach(function (r, i) {
    if (r.a >= 0 && r.b >= 0) return;
    r.par = []; r.mods = [];
    var n = r.pts.length / 3, onSail = false;
    [[0, r.a, 'a'], [n - 1, r.b, 'b']].forEach(function (e) {
      if (e[1] >= 0) return;
      var P = [r.pts[e[0] * 3], r.pts[e[0] * 3 + 1], r.pts[e[0] * 3 + 2]], best = -1, bd = 9;      // 0.3 公尺內
      // 綁在帆角上（雕刻的 `sail:帆名/角`：帆腳垂在半空、只靠 sheet 拉住，例：風暴角號 spritsail）⇒ 端點就在帆的頂點上，算有靠（帆掉了它跟著斷：s.lines）
      //   ⛔ 不認 ⇒ 開局就判「哪裡都不靠」死掉、掛在它上面的帆跟著掉（TASK-0579 量到：spritsail-sheet-P／S 開局 dead、spritsail hp 滿血就掉）
      if (T.rig.sails.some(function (s) { var v = s.verts; for (var k = 0; k < v.length; k += 3) { var dx = v[k] - P[0], dy = v[k + 1] - P[1], dz = v[k + 2] - P[2]; if (dx * dx + dy * dy + dz * dz < 4) return true; } return false; })) onSail = true;
      var yk = yardNear(T, P, 3);                                                // 帆桁：照網格（⛔ 照外框：轉過的帆桁外框很大，桅頂附近的 ratline 都會被當成綁在帆桁上）
      if (yk >= 0) { r.mods.push(yk); r['m' + e[2]] = yk; return; }
      var mod = models.filter(function (m) { var b = m.bb; if (m.station || m.kind === 'yard') return false; return P[0] > b[0] - 4 && P[0] < b[3] + 4 && P[1] > b[1] - 4 && P[1] < b[4] + 4 && P[2] > b[2] - 4 && P[2] < b[5] + 4; })[0];
      if (mod) { r.mods.push(mod.k); r['m' + e[2]] = mod.k; return; }   // 綁在模型上（舵索綁舵輪）⇒ 模型飛了才斷
      ropes.forEach(function (o, j) {
        if (j === i || P[0] < o.bb[0] - 3 || P[0] > o.bb[3] + 3 || P[1] < o.bb[1] - 3 || P[1] > o.bb[4] + 3 || P[2] < o.bb[2] - 3 || P[2] > o.bb[5] + 3) return;
        for (var k = 0; k + 5 < o.pts.length; k += 3) { var d = segDist2(P, o.pts[k], o.pts[k + 1], o.pts[k + 2], o.pts[k + 3], o.pts[k + 4], o.pts[k + 5]); if (d < bd) { bd = d; best = j; } }
      });
      if (best >= 0) { if (r.par.indexOf(best) < 0) r.par.push(best); r['p' + e[2]] = best; }   // 哪一端掛在哪條繩（垂下來的繩要知道是哪一端鬆了）
    });
    if (!r.par.length && !r.mods.length && !onSail) r.dead = true;     // 哪裡都不靠（格、繩、模型、帆角都沒有）⇒ 不畫
  });
}
/** 帆的依靠：最高那一排、最低的前角與後角各找 0.6 公尺內的實心格；找不到就掛在 0.4 公尺內最近的繩（支索）上。 */
function sailAnchors(sh, sail, top) {
  var v = sail.verts, lo = 1e9, fx = null, bx = null, j;
  for (j = 2; j < v.length; j += 3) lo = Math.min(lo, v[j]);
  for (j = 0; j < v.length; j += 3) if (v[j + 2] < lo + 3) { if (!fx || v[j] > fx[0]) fx = [v[j], v[j + 1], v[j + 2]]; if (!bx || v[j] < bx[0]) bx = [v[j], v[j + 1], v[j + 2]]; }
  sail.as = []; sail.par = [];
  [top, fx, bx].forEach(function (P) {
    if (!P) return;
    var a = anchorNear(sh.T, P[0], P[1], P[2], 6);
    if (a >= 0) { if (sail.as.indexOf(a) < 0) sail.as.push(a); return; }
    var best = -1, bd = 16;
    sh.ropes.forEach(function (o, i) {
      var bb = o.bb; if (P[0] < bb[0] - 4 || P[0] > bb[3] + 4 || P[1] < bb[1] - 4 || P[1] > bb[4] + 4 || P[2] < bb[2] - 4 || P[2] > bb[5] + 4) return;
      for (var k = 0; k + 5 < o.pts.length; k += 3) { var d = segDist2(P, o.pts[k], o.pts[k + 1], o.pts[k + 2], o.pts[k + 3], o.pts[k + 4], o.pts[k + 5]); if (d < bd) { bd = d; best = i; } }
    });
    if (best >= 0 && sail.par.indexOf(best) < 0) sail.par.push(best);
  });
  sail.a = sail.as.length ? sail.as[0] : -1;
  return sail;
}
/** 這條繩（r：{ name, meta }）是不是這面帆自己的（帆腳的 sheet、tack）。
 *  照 meta（TASK-0539，造船規格 §9.1；Tim 2026-10-13「之後依 meta 判斷」）：繩的 meta 有 `sail` ⇒ 就是那面帆的（kind sheet／tack）。
 *  沒有 meta 的舊匯出才照名字：`<帆名>.xxx`（basecamp：憲法號、餘燼號）或 `<帆名>-sheet…`／`<帆名>-tack…`（summit：夜隼號）。
 *  ⛔ 只認 `<帆名>-` ⇒ `fore-topsail-lift-S`、`-brace-`、`-footrope-` 這些帆桁的繩也算進來。量過：新規則在憲法號、餘燼號一條都沒多認到。 */
function sailRope(r, sail) {
  if (r && r.meta && r.meta.sail) return r.meta.sail === sail;
  return sailRopeName(r && r.name, sail);
}
function sailRopeName(name, sail) { if (!name) return false; if (name.indexOf(sail + '.') === 0) return true; if (name.indexOf(sail + '-') !== 0) return false; var r = name.slice(sail.length + 1); return /^(sheet|tack)(-|$)/.test(r); }
function ropeBox(p) {
  var b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
  for (var j = 0; j < p.length; j += 3) for (var a = 0; a < 3; a++) { if (p[j + a] < b[a]) b[a] = p[j + a]; if (p[j + a] > b[a + 3]) b[a + 3] = p[j + a]; }
  return b;
}
function anchorNear(T, x, y, z, r) {                 // 船型 T 的原始格子裡，(x, y, z) 附近 r 格內最近的實心格
  var bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z), best = -1, bd = 1e9;
  for (var dz = -r; dz <= r; dz++) for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
    if (!T.base.get(bx + dx, by + dy, bz + dz)) continue;
    var d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = VK.pack(bx + dx, by + dy, bz + dz); }
  }
  return best;
}
/** 桅（Tim 2026-10-13：照 meta 判斷）：帆桁的 meta `mast`（fore／main／mizzen；bowsprit 不算）⇒ 有哪幾根桅；
 *  那根桅最低的橫帆桁（course／crossjack；沒有 ⇒ 最低一根不是 boom 的）轉軸 (x, z) ⇒ 桅在哪、桅頂平台大約多高（桅頂就在它上面）。
 *  桅身那一段（打斷就倒，32_hull.js survey）＝ 那根帆桁往下 20–40 格（桅頂下面的下桅）；x ＝ 往下 10–40 格、中線上格子最多的那一欄（桅會往後傾）。
 *  z0top ＝ 桅頂水手從這個高度往上找平台（40_crew.js）。
 *  ⛔ 以前從帆的名字推 x、在固定的 z 250–290 找、打斷段三根都是 z 220–240：夜隼號只有一半高 ⇒ 前桅找在 x 223（找到的是別的東西）；
 *  憲法號的後桅頂在 241，250–290 量到的是上桅。改照 meta 之後憲法號、餘燼號的前桅與主桅 x 不變、後桅 195 → 198（下桅）；打斷段變成每根桅自己的高度。
 *  沒有帆桁 meta 的舊 .vxk ⇒ 照以前的辦法（findMastsOld）。 */
function findMasts(T) {
  var CY = T.cy, ys = {}, label = { fore: '前桅', main: '主桅', mizzen: '後桅' }; T.masts = [];
  (T.rig.models || []).forEach(function (m) { var mt = m.meta || {}, pv = (m.points || {}).pivot; if (mt.kind === 'yard' && mt.mast && mt.mast !== 'bowsprit' && pv) (ys[mt.mast] = ys[mt.mast] || []).push({ y: mt.yard, p: pv }); });
  var keys = Object.keys(ys); if (!keys.length) return findMastsOld(T);
  keys.sort(function (a, b) { var o = ['fore', 'main', 'mizzen']; return (o.indexOf(a) + 1 || 9) - (o.indexOf(b) + 1 || 9); });   // 照以前的順序（前、主、後）
  keys.forEach(function (k) {
    var L = ys[k].filter(function (q) { return q.y === 'course' || q.y === 'crossjack'; });
    if (!L.length) L = ys[k].filter(function (q) { return q.y !== 'boom'; }).sort(function (a, b) { return a.p[2] - b.p[2]; });
    if (!L.length) return;
    var P = L[0].p, Lz = Math.floor(P[2]), ax = Math.round(P[0]), mx = ax, bn = 0;
    for (var x = ax - 45; x <= ax + 45; x++) { var c = countBox(T.base, x, CY - 4, Lz - 40, x, CY + 4, Lz - 10); if (c > bn) { bn = c; mx = x; } }
    var z0 = Lz - 40, n = countBox(T.base, mx - 8, CY - 8, z0, mx + 8, CY + 8, z0 + 20);
    if (n > 20) T.masts.push({ name: label[k] || k, x: mx, z0: z0, z1: z0 + 20, orig: n, z0top: Lz });
  });
}
function findMastsOld(T) {  // 桅的 x 從帆的名字推（fore／main／mizzen），探針：桅身中段一小塊
  var acc = {}, CY = T.cy; T.masts = [];
  T.rig.sails.forEach(function (s) {
    var mm = /^(fore|main|mizzen)-(course|topsail|topgallant|royal)$/.exec(s.name); if (!mm) return; var k = mm[1];
    acc[k] = acc[k] || [0, 0];
    for (var j = 0; j < s.verts.length; j += 3) { acc[k][0] += s.verts[j]; acc[k][1]++; }
  });
  var label = { fore: '前桅', main: '主桅', mizzen: '後桅' };
  ['fore', 'main', 'mizzen'].forEach(function (k) {
    if (!acc[k]) return;
    var ax = Math.round(acc[k][0] / acc[k][1]), mx = ax, bn = 0, best = null;
    for (var x = ax - 45; x <= ax + 45; x++) { var c = countBox(T.base, x, CY - 4, 250, x, CY + 4, 290); if (c > bn) { bn = c; mx = x; } }   // 桅身：中線上一根直立的柱子
    for (var z0 = 220; z0 <= 420 && !best; z0 += 20) { var n = countBox(T.base, mx - 8, CY - 8, z0, mx + 8, CY + 8, z0 + 20); if (n > 20) best = { z0: z0, n: n }; }
    if (best) T.masts.push({ name: label[k], x: mx, z0: best.z0, z1: best.z0 + 20, orig: best.n });
  });
}
function countBox(g, x0, y0, z0, x1, y1, z1) { var n = 0; for (var x = x0; x <= x1; x++) for (var y = y0; y <= y1; y++) for (var z = z0; z <= z1; z++) if (g.get(x, y, z)) n++; return n; }

