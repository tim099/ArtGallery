// ───────────────────────── 船 ─────────────────────────
function shipBaseMatrix() {   // 格 → 船體（公尺）：(x, y, z) ⇒ (S(x−CX), S(z−ZW), −S(y−CY))
  return new Float32Array([S, 0, 0, 0, 0, 0, -S, 0, 0, S, 0, 0, -S * CX, -S * ZW, S * CY, 1]);
}
function shipMatrix(sh) {
  var m = trans(sh.px, -sh.sink + sh.lift + sh.bob, sh.pz);
  m = M4.mul(m, rotM([0, 1, 0], sh.yaw));
  m = M4.mul(m, rotM([0, 0, 1], sh.pitchA));
  m = M4.mul(m, rotM([1, 0, 0], sh.rollA + (sh.rollW || 0)));
  return M4.mul(m, shipBaseMatrix());
}
function shipCenter(sh) { return M4.pt(sh.M, CX, CY, 140); }
function toLocal(sh, p) { return M4.pt(sh.inv, p[0], p[1], p[2]); }

function makeShip(i, team, yaw, pz) {
  var grid = BASE.share(), rsSet = new VK.RegionSet(gl, grid, QIDX);
  rsSet.shareFrom(PRISTINE);
  var sh = {
    i: i, team: team, grid: grid, rs: rsSet, yaw: yaw, px: 0, pz: pz, sink: 0, sinkV: 0, lift: 0, liftT: 0, rollA: 0, pitchA: 0, rollV: 0, bob: 0,
    phase: rnd() * 6.28, orig: grid.count, flood: new Float32Array(SZ * 3), lost: 0, seeds: [], impulse: [0, 0, 0],
    guns: [], ropes: [], sails: [], rigDirty: true, lines: null, tris: null, masts: [], aim: null, reloadT: MODE === 'sandbox' && i === PLAYER_I ? RELOAD_SANDBOX : RELOAD,
    fired: 0, hits: 0, salvo: 0, aiWait: rr(1, 3), sunk: false, struck: false, fate: '', silentT: -1, gunsAlive: 0, mastsUp: 3, sinkingFinal: false,
    spd: 0, spd0: true, yawRate: 0, vel: [0, 0, 0], wakeT: 0, sailFrac: 1, pos: '',
    side: 'S', manual: false, rudder: 0, sailSet: 3, bumpT: 0
  };
  // 模型（砲、火藥桶、舵輪）：整個是一塊剛體 —— 被打到扣血，歸零整個飛出去（火藥桶 ⇒ 殉爆，見 23_powder.js），⛔ 不拆格。
  // 種類照 basecamp 給的 meta（TASK-0517）：{kind:'gun', gun:'24l'|'32c'|'18chase'}、{kind:'powder', powder_lb}；舵輪沒有 meta ⇒ 照名字。
  sh.models = (RIG.models || []).map(function (m, k) {
    var b = m.bbox, kind = modelKind(m), pv = (m.points || {}).pivot;
    var cx = Math.floor((b[0] + b[3]) / 2), cy = Math.floor((b[1] + b[4]) / 2), fz = Math.floor(b[2]) - 1;
    var foot = -1;
    if (kind === 'yard' && pv) foot = anchorNear(pv[0], pv[1], pv[2], 8);   // 帆桁：「腳」是轉軸旁最近的那一格桅（桅斷了跟著走、被打掉就掉）；⛔ 往下找：艏斜桅下面是空的，spritsail 一開局就掉
    if (foot < 0) { while (fz > 0 && !BASE.get(cx, cy, fz)) fz--; foot = VK.pack(cx, cy, fz); }   // 腳下那一格甲板（被打掉 ⇒ 掉下去）
    var hpm = kind === 'powder' ? POWDER_HP : kind === 'wheel' ? Math.round(GUN_HP * 0.6) : kind === 'model' ? 1 : GUN_HP;   // 細節設定的血量；舵輪 6 成；帆桁跟砲一樣
    var mt = m.meta || {};
    return { k: k, name: m.name.split('/').pop(), path: m.name, kind: kind, hp: hpm, hpMax: hpm, mesh: m.mesh, origin: m.origin, bb: b, pts: m.points || {}, meta: mt,
      c: [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2], foot: foot, alive: true,
      rot: 0, r0: (+mt.rotate_z_deg || 0) * Math.PI / 180, piv: pv, yk: mt.yard, sail: mt.sail };   // 帆桁：rot ＝ 在作品的角度（r0）之外又轉了多少（追風，30_rig_physics.js）
  });
  sh.yards = sh.models.filter(function (m) { return m.kind === 'yard' && m.piv; });
  // 砲：長砲（24 磅，兩舷各 14）、carronade（32 磅，兩舷各 12）、追擊砲（18 磅，船頭兩舷各 1）都是模型。
  // 砲軸 ＝ 固定點 muzzle − breech（格座標、水平）；砲口 ＝ muzzle 再往外 1.5 格（muzzle 在砲口內膛那一格）。
  // ⚠ 程式裡的 'S'／'P' 照砲軸（+y ＝ S，跟模型名字一致），但 S（格 +y）在右手座標裡是船的左手邊（面向船頭 +x、上 +z ⇒ 右手是 −y）
  //   ⇒ 畫面上是左舷。給人看的一律照畫面（sideName）；A／D 也照畫面的左右。
  sh.models.forEach(function (m) {
    if (!GUN_TYPE[m.kind]) return;
    var mz = m.pts.muzzle, br = m.pts.breech, ax;
    if (mz && br) ax = [mz[0] - br[0], mz[1] - br[1]];
    else { var sg0 = /-P\d*$|-P$/.test(m.name) ? -1 : 1; ax = [0, sg0]; mz = [m.c[0], sg0 > 0 ? m.bb[4] - 0.5 : m.bb[1] + 0.5, m.c[2]]; }   // 沒有固定點（舊的 .vxk）⇒ 外框外緣
    var al = Math.hypot(ax[0], ax[1]) || 1; ax = [ax[0] / al, ax[1] / al];
    sh.guns.push(m.gun = { name: m.name, type: m.kind, side: ax[1] >= 0 ? 'S' : 'P', model: m, ax: ax,
      muz: [mz[0] + ax[0] * 1.5, mz[1] + ax[1] * 1.5, mz[2]], alive: true, reload: rr(0, 1.2), box: BOX_N, needCart: false });   // box：砲旁藥箱裡的份數
  });
  sh.guns.sort(function (a, b) { return b.muz[0] - a.muz[0] || a.muz[1] - b.muz[1]; });
  sh.mags = makeMags(sh);                                                // 彈藥庫（23_powder.js）
  sh.stations = makeStations(sh);                                        // 兩層甲板的火藥與彈藥取用點（火藥桶也是模型，加在 sh.models 後面）
  sh.mIdx = modelIndex(sh.models);
  // 繩與帆：兩端（帆取最高那一排）各找最近的實心格當錨 —— 錨被打掉或跟船分家 ⇒ 繩斷、帆掉
  RIG.ropes.forEach(function (r) {
    var n = r.pts.length / 3;
    sh.ropes.push({ pts: r.pts, col: r.color, bb: ropeBox(r.pts), a: anchorNear(r.pts[0], r.pts[1], r.pts[2], 5), b: anchorNear(r.pts[n * 3 - 3], r.pts[n * 3 - 2], r.pts[n * 3 - 1], 5), name: r.name });
  });
  linkRopes(sh.ropes, sh.models);
  RIG.sails.forEach(function (s) {
    var vz = -1e9, ax = 0, ay = 0, az = 0, k = 0, j;
    for (j = 2; j < s.verts.length; j += 3) vz = Math.max(vz, s.verts[j]);
    for (j = 0; j < s.verts.length; j += 3) if (s.verts[j + 2] > vz - 2) { ax += s.verts[j]; ay += s.verts[j + 1]; az += s.verts[j + 2]; k++; }
    sh.sails.push(sailAnchors(sh, { verts: s.verts, tris: s.tris, col: s.color, name: s.name, bb: ropeBox(s.verts) }, [ax / k, ay / k, az / k]));
  });
  // 帆自己的繩（`<帆名>.sheet-S`、`.tack-P`…）：帆腳那一端綁在帆上 ⇒ 帆掉了或被帶走，它們跟著斷
  // （⛔ 只靠繩的依靠不夠：sheet 與 tack 互相掛著、另一端綁甲板，帆沒了也還浮在半空）
  sh.sails.forEach(function (s, k) { s.k = k; s.hp = s.hpMax = SAIL_HP; s.lines = []; sh.ropes.forEach(function (r, j) { if (r.name && r.name.indexOf(s.name + '.') === 0) s.lines.push(j); }); });
  sh.sails.forEach(function (s) { s.yards = sh.yards.filter(function (y) { return y.sail === s.name; }); });   // 掛這面帆的帆桁（spanker：gaff＋boom）
  ropeYards(sh);
  sh.ropes.forEach(function (r) { r.never = r.lz = !!r.dead; });        // 一開始就不畫的繩不會變成垂下來的繩（物理，見 physStep）
  sh.cl = CLOTHT.map(function (T) { return { T: T, p: null, hidden: true }; }); sh.loose = [];
  sh.sails.forEach(function (s) { s.area = sailArea(s); }); sh.sailArea0 = sh.sails.reduce(function (a, s) { return a + s.area; }, 0) || 1;
  applySailSet(sh);
  MASTS.forEach(function (m) { sh.masts.push({ name: m.name, x: m.x, z0: m.z0, z1: m.z1, orig: m.orig, up: true }); });
  sh.crew = makeCrew(sh); sh.crew0 = sh.crew.length; sh.wounded = 0; sh.dead = 0; sh.kills = 0; sh.wounds = 0; sh.causes = {};   // kills／wounds：累計（廣播傷亡用；wounded 會在傷者陣亡時減回去）
  sh.news = { guns: [], t: -9, k: 0, w: 0, kr: {}, wr: {} };
  sh.M = shipMatrix(sh); sh.inv = M4.inv(sh.M);
  return sh;
}
var GUN_TYPE = { long: '24 磅長砲', carr: '32 磅 carronade', chase: '18 磅追擊砲' };
/** 格座標 P 附近 r 格內有沒有帆桁的網格（照佔用格）⇒ 回那根帆桁的模型編號（RIG.models 的序號 ＝ sh.models 的序號），沒有 ⇒ -1。 */
function yardNear(P, r) {
  var ms = RIG.models || [];
  for (var k = 0; k < ms.length; k++) {
    var m = ms[k], b = m.bbox; if (!m.meta || m.meta.kind !== 'yard') continue;
    if (P[0] < b[0] - r || P[0] > b[3] + r || P[1] < b[1] - r || P[1] > b[4] + r || P[2] < b[2] - r || P[2] > b[5] + r) continue;
    var oc = MESHES[m.mesh] && MESHES[m.mesh].occ; if (!oc) continue;
    var x0 = Math.floor(P[0] - m.origin[0]) + 1, y0 = Math.floor(P[1] - m.origin[1]) + 1, z0 = Math.floor(P[2] - m.origin[2]) + 1;
    for (var dz = -r; dz <= r; dz++) for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
      var x = x0 + dx, y = y0 + dy, z = z0 + dz;
      if (x >= 0 && y >= 0 && z >= 0 && x < oc.nx && y < oc.ny && z < oc.nz && oc.a[x + oc.nx * (y + oc.ny * z)]) return k;
    }
  }
  return -1;
}
/** 繩的兩端各跟著哪根帆桁轉（-1 ＝ 不跟）：端點靠在帆桁上（綁在帆桁上的 brace、lift、footrope…）；
 *  帆自己的繩（sheet、tack）靠帆那一端跟著帆的帆桁（帆腳跟著帆轉）。兩艘共用一份（ROPE_YARD）。 */
var ROPE_YARD = null;
function ropeYards(sh) {
  if (!ROPE_YARD) ROPE_YARD = RIG.ropes.map(function (r) { var n = r.pts.length / 3; return [yardNear([r.pts[0], r.pts[1], r.pts[2]], 3), yardNear([r.pts[n * 3 - 3], r.pts[n * 3 - 2], r.pts[n * 3 - 1]], 3)]; });
  sh.ropes.forEach(function (r, j) { r.pts0 = r.pts; r.ya = ROPE_YARD[j][0]; r.yb = ROPE_YARD[j][1]; });
  sh.sails.forEach(function (s) {
    if (!s.yards.length) return;
    var v = s.verts;
    s.lines.forEach(function (j) {
      var r = sh.ropes[j], n = r.pts.length / 3; if (r.ya >= 0 || r.yb >= 0) return;
      function dmin(o) { var d = 1e18; for (var q = 0; q < v.length; q += 3) d = Math.min(d, (v[q] - r.pts[o]) * (v[q] - r.pts[o]) + (v[q + 1] - r.pts[o + 1]) * (v[q + 1] - r.pts[o + 1]) + (v[q + 2] - r.pts[o + 2]) * (v[q + 2] - r.pts[o + 2])); return d; }
      if (dmin(0) < dmin(n * 3 - 3)) r.ya = s.yards[0].k; else r.yb = s.yards[0].k;
    });
  });
  sh.yRopes = sh.ropes.filter(function (r) { return r.ya >= 0 || r.yb >= 0; });
}
/** 模型的種類：meta 優先（basecamp TASK-0517：kind／gun），沒有 meta 才照名字（舊的 .vxk；舵輪本來就沒有 meta）。 */
function modelKind(m) {
  var mt = m.meta || {};
  if (mt.kind === 'gun') return mt.gun === '32c' ? 'carr' : mt.gun === '18chase' ? 'chase' : 'long';
  if (mt.kind === 'powder') return 'powder';
  if (mt.kind === 'yard') return 'yard';                              // 帆桁（basecamp 階段三十三：15 根各一件模型，可以繞轉軸轉）
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
function linkRopes(ropes, models) {
  ropes.forEach(function (r, i) {
    if (r.a >= 0 && r.b >= 0) return;
    r.par = []; r.mods = [];
    var n = r.pts.length / 3;
    [[0, r.a, 'a'], [n - 1, r.b, 'b']].forEach(function (e) {
      if (e[1] >= 0) return;
      var P = [r.pts[e[0] * 3], r.pts[e[0] * 3 + 1], r.pts[e[0] * 3 + 2]], best = -1, bd = 9;      // 0.3 公尺內
      var yk = yardNear(P, 3);                                                // 帆桁：照網格（⛔ 照外框：轉過的帆桁外框很大，桅頂附近的 ratline 都會被當成綁在帆桁上）
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
    var a = anchorNear(P[0], P[1], P[2], 6);
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
function ropeBox(p) {
  var b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
  for (var j = 0; j < p.length; j += 3) for (var a = 0; a < 3; a++) { if (p[j + a] < b[a]) b[a] = p[j + a]; if (p[j + a] > b[a + 3]) b[a + 3] = p[j + a]; }
  return b;
}
function anchorNear(x, y, z, r) {
  var bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z), best = -1, bd = 1e9;
  for (var dz = -r; dz <= r; dz++) for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
    if (!BASE.get(bx + dx, by + dy, bz + dz)) continue;
    var d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = VK.pack(bx + dx, by + dy, bz + dz); }
  }
  return best;
}
var MASTS = [];
function findMasts() {   // 桅的 x 從帆的名字推（fore／main／mizzen），探針：桅身中段一小塊
  var acc = {};
  RIG.sails.forEach(function (s) {
    var mm = /^(fore|main|mizzen)-(course|topsail|topgallant|royal)$/.exec(s.name); if (!mm) return; var k = mm[1];
    acc[k] = acc[k] || [0, 0];
    for (var j = 0; j < s.verts.length; j += 3) { acc[k][0] += s.verts[j]; acc[k][1]++; }
  });
  var label = { fore: '前桅', main: '主桅', mizzen: '後桅' };
  ['fore', 'main', 'mizzen'].forEach(function (k) {
    if (!acc[k]) return;
    var ax = Math.round(acc[k][0] / acc[k][1]), mx = ax, bn = 0, best = null;
    for (var x = ax - 45; x <= ax + 45; x++) { var c = countBox(BASE, x, CY - 4, 250, x, CY + 4, 290); if (c > bn) { bn = c; mx = x; } }   // 桅身：中線上一根直立的柱子
    for (var z0 = 220; z0 <= 420 && !best; z0 += 20) { var n = countBox(BASE, mx - 8, CY - 8, z0, mx + 8, CY + 8, z0 + 20); if (n > 20) best = { z0: z0, n: n }; }
    if (best) MASTS.push({ name: label[k], x: mx, z0: best.z0, z1: best.z0 + 20, orig: best.n });
  });
}
function countBox(g, x0, y0, z0, x1, y1, z1) { var n = 0; for (var x = x0; x <= x1; x++) for (var y = y0; y <= y1; y++) for (var z = z0; z <= z1; z++) if (g.get(x, y, z)) n++; return n; }

