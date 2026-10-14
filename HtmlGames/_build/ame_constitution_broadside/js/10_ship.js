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
    if (foot < 0) { while (fz > 0 && !T.base.get(cx, cy, fz)) fz--; foot = VK.pack(cx, cy, fz); }   // 腳下那一格甲板（被打掉 ⇒ 掉下去）
    var hpm = kind === 'powder' ? powderHP() : kind === 'wheel' ? Math.round(GUN_HP * 0.6) : kind === 'model' ? 1 : GUN_HP;   // 細節設定的血量；舵輪 6 成；帆桁、舵跟砲一樣
    var mt = m.meta || {};
    return { T: T, k: k, name: m.name.split('/').pop(), path: m.name, kind: kind, hp: hpm, hpMax: hpm, mesh: m.mesh, origin: m.origin, bb: b, pts: m.points || {}, meta: mt,
      c: [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2], foot: foot, alive: true,
      rot: 0, r0: (+mt.rotate_z_deg || 0) * Math.PI / 180, piv: pv, yk: mt.yard, sail: mt.sail };   // 帆桁：rot ＝ 在作品的角度（r0）之外又轉了多少（追風，30_rig_physics.js）
  });
  sh.yards = sh.models.filter(function (m) { return m.kind === 'yard' && m.piv; });
  // 砲：長砲（24 磅，兩舷各 14）、carronade（32 磅，兩舷各 12）、追擊砲（18 磅，船頭兩舷各 1）都是模型。
  // 砲軸 ＝ 固定點 muzzle − breech（格座標、水平）；砲口 ＝ muzzle 再往外 1.5 格（muzzle 在砲口內膛那一格）。
  // 程式裡的 'S'／'P' 照砲軸（+y ＝ S，跟模型名字一致）＝ 右舷／左舷（shipBaseMatrix 照雕刻引擎的手性鏡射過來）。給人看的走 sideName；A／D 照畫面的左右。
  sh.models.forEach(function (m) {
    if (!GUNS[m.kind]) return;
    var mz = m.pts.muzzle, br = m.pts.breech, ax;
    if (mz && br) ax = [mz[0] - br[0], mz[1] - br[1]];
    else { var sg0 = /-P\d*$|-P$/.test(m.name) ? -1 : 1; ax = [0, sg0]; mz = [m.c[0], sg0 > 0 ? m.bb[4] - 0.5 : m.bb[1] + 0.5, m.c[2]]; }   // 沒有固定點（舊的 .vxk）⇒ 外框外緣
    var al = Math.hypot(ax[0], ax[1]) || 1; ax = [ax[0] / al, ax[1] / al];
    sh.guns.push(m.gun = { name: m.name, type: m.kind, side: ax[1] >= 0 ? 'S' : 'P', model: m, ax: ax,
      muz: [mz[0] + ax[0] * 1.5, mz[1] + ax[1] * 1.5, mz[2]], alive: true, reload: rr(0, 1.2), box: BOX_N, needCart: false });   // box：砲旁藥箱裡的份數
  });
  sh.guns.sort(function (a, b) { return b.muz[0] - a.muz[0] || a.muz[1] - b.muz[1]; });
  sh.decks = gunDecks(sh); sh.weatherDeck = sh.decks.length ? sh.decks[sh.decks.length - 1].key : null;   // 砲甲板（照砲的高度分層）；最上面那層 ＝ 露天
  sh.deckZ = {}; sh.decks.forEach(function (D) { sh.deckZ[D.key] = D.zr; });
  sh.mags = makeMags(sh);                                                // 彈藥庫（23_powder.js）
  sh.stations = makeStations(sh);                                        // 兩層甲板的火藥與彈藥取用點（火藥桶也是模型，加在 sh.models 後面）
  sh.mIdx = modelIndex(sh.models);
  // 繩與帆：兩端（帆取最高那一排）各找最近的實心格當錨 —— 錨被打掉或跟船分家 ⇒ 繩斷、帆掉
  T.rig.ropes.forEach(function (r) {
    var n = r.pts.length / 3;
    sh.ropes.push({ pts: r.pts, col: r.color, bb: ropeBox(r.pts), a: anchorNear(T, r.pts[0], r.pts[1], r.pts[2], 5), b: anchorNear(T, r.pts[n * 3 - 3], r.pts[n * 3 - 2], r.pts[n * 3 - 1], 5), name: r.name, meta: r.meta || null });
  });
  linkRopes(T, sh.ropes, sh.models);
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
function gunDecks(sh) {
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
function linkRopes(T, ropes, models) {
  ropes.forEach(function (r, i) {
    if (r.a >= 0 && r.b >= 0) return;
    r.par = []; r.mods = [];
    var n = r.pts.length / 3;
    [[0, r.a, 'a'], [n - 1, r.b, 'b']].forEach(function (e) {
      if (e[1] >= 0) return;
      var P = [r.pts[e[0] * 3], r.pts[e[0] * 3 + 1], r.pts[e[0] * 3 + 2]], best = -1, bd = 9;      // 0.3 公尺內
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
    if (!r.par.length && !r.mods.length) r.dead = true;     // 哪裡都不靠（格、繩、模型都沒有）⇒ 不畫
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

