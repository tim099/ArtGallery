// ───────────────────────── 船 ─────────────────────────
function shipBaseMatrix() {   // 格 → 船體（公尺）：(x, y, z) ⇒ (S(x−CX), S(z−ZW), −S(y−CY))
  return new Float32Array([S, 0, 0, 0, 0, 0, -S, 0, 0, S, 0, 0, -S * CX, -S * ZW, S * CY, 1]);
}
function shipMatrix(sh) {
  var m = trans(sh.px, -sh.sink + sh.bob, sh.pz);
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
    i: i, team: team, grid: grid, rs: rsSet, yaw: yaw, px: 0, pz: pz, sink: 0, sinkV: 0, rollA: 0, pitchA: 0, rollV: 0, bob: 0,
    phase: rnd() * 6.28, orig: grid.count, flood: new Float32Array(SZ * 3), lost: 0, seeds: [], impulse: [0, 0, 0],
    guns: [], ropes: [], sails: [], rigDirty: true, lines: null, tris: null, masts: [], aim: null, reloadT: MODE === 'sandbox' && i === PLAYER_I ? RELOAD_SANDBOX : RELOAD,
    fired: 0, hits: 0, salvo: 0, aiWait: rr(1, 3), sunk: false, struck: false, fate: '', silentT: -1, gunsAlive: 0, mastsUp: 3, sinkingFinal: false,
    spd: 0, spd0: true, yawRate: 0, vel: [0, 0, 0], wakeT: 0, sailFrac: 1, pos: '',
    side: 'S', manual: false, rudder: 0, sailSet: 3, bumpT: 0
  };
  // 長砲：兩舷各 14 門（關聯 砲-S／砲-P）；砲口 ＝ 外框裡最外那一層的中心（S 那一舷 y 最大、P 那一舷 y 最小）。
  // ⚠ 程式裡的 'S'／'P' 照模型的名字，但 S（格 +y）在右手座標裡是船的左手邊（面向船頭 +x、上 +z ⇒ 右手是 −y）
  //   ⇒ 畫面上是左舷。給人看的一律照畫面（sideName）；A／D 也照畫面的左右。
  (MODEL.header.parts || []).forEach(function (p) {
    var mt = /\/砲-([SP])\d+$/.exec(p.path); if (!mt) return;
    var side = mt[1], b = p.box, edge = side === 'S' ? -1 : 1e9, sx = 0, sz = 0, n = 0, cnt = 0, x, y, z;
    for (x = b[0]; x <= b[3]; x++) for (y = b[1]; y <= b[4]; y++) for (z = b[2]; z <= b[5]; z++) if (BASE.get(x, y, z)) { cnt++; if (side === 'S' ? y > edge : y < edge) edge = y; }
    var y0 = side === 'S' ? edge - 1 : edge, y1 = side === 'S' ? edge : edge + 1;
    for (x = b[0]; x <= b[3]; x++) for (z = b[2]; z <= b[5]; z++) for (y = y0; y <= y1; y++) if (BASE.get(x, y, z)) { sx += x; sz += z; n++; }
    sh.guns.push({ name: p.path.split('/').pop(), type: 'long', side: side, box: b, muz: [sx / n + 0.5, side === 'S' ? edge + 1.5 : edge - 0.5, sz / n + 0.5], orig: cnt, alive: true, reload: rr(0, 1.2),
      thr: 0.55, hp01: 1 });   // 長砲還是格子：外框裡剩不到 55% 就毀（照舊）。⛔ 不跟著砲的耐久往下壓：外框約一半是船殼木板，門檻一低，砲身打爛也到不了 ⇒ 等長砲改成模型再套耐久
  });
  // 模型（carronade、追擊砲、舵輪）：整個是一塊剛體 —— 被打到就整個飛出去，⛔ 不拆格
  sh.models = (RIG.models || []).map(function (m, k) {
    var b = m.bbox, kind = /carronade/.test(m.name) ? 'carr' : /chase/.test(m.name) ? 'chase' : /wheel/.test(m.name) ? 'wheel' : 'model';
    var cx = Math.floor((b[0] + b[3]) / 2), cy = Math.floor((b[1] + b[4]) / 2), fz = Math.floor(b[2]) - 1;
    while (fz > 0 && !BASE.get(cx, cy, fz)) fz--;                     // 腳下那一格甲板（被打掉 ⇒ 掉下去）
    var hpm = kind === 'carr' || kind === 'chase' ? GUN_HP : 1;      // 砲（carronade、追擊砲）照細節設定的耐久；舵輪一打就飛
    return { k: k, name: m.name.split('/').pop(), kind: kind, hp: hpm, hpMax: hpm, side: /carronade-S/.test(m.name) ? 'S' : /carronade-P/.test(m.name) ? 'P' : '',
      mesh: m.mesh, origin: m.origin, bb: b, c: [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2], foot: VK.pack(cx, cy, fz), alive: true };
  });
  sh.models.forEach(function (m) {                                       // 兩舷的 carronade 與船頭的追擊砲也是砲（S 那一舷砲口朝 +y、P 那一舷朝 −y）
    var b = m.bb;
    if (m.kind === 'carr' && m.side)
      sh.guns.push({ name: m.name, type: 'carr', side: m.side, model: m, muz: [(b[0] + b[3]) / 2, m.side === 'S' ? b[4] + 1.5 : b[1] - 1.5, b[2] + 9.75], alive: true, reload: rr(0, 1.2) });
    else if (m.kind === 'chase')                                          // 砲口 (648.1, 194.5, 98.75)：外框裡砲管朝 (0.342, 0.940)
      sh.guns.push({ name: 'chase18', type: 'chase', side: 'S', model: m, muz: [b[3] - 1.9 + 0.5, b[4] + 1.0, b[2] + 10.75], alive: true, reload: rr(0, 1.2) });
  });
  sh.guns.sort(function (a, b) { return b.muz[0] - a.muz[0]; });
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
    sh.sails.push(sailAnchors(sh, { verts: s.verts, tris: s.tris, col: s.color, name: s.name }, [ax / k, ay / k, az / k]));
  });
  // 帆自己的繩（`<帆名>.sheet-S`、`.tack-P`…）：帆腳那一端綁在帆上 ⇒ 帆掉了或被帶走，它們跟著斷
  // （⛔ 只靠繩的依靠不夠：sheet 與 tack 互相掛著、另一端綁甲板，帆沒了也還浮在半空）
  sh.sails.forEach(function (s, k) { s.k = k; s.hp = s.hpMax = SAIL_HP; s.lines = []; sh.ropes.forEach(function (r, j) { if (r.name && r.name.indexOf(s.name + '.') === 0) s.lines.push(j); }); });
  sh.ropes.forEach(function (r) { r.never = r.lz = !!r.dead; });        // 一開始就不畫的繩不會變成垂下來的繩（物理，見 physStep）
  sh.cl = CLOTHT.map(function (T) { return { T: T, p: null, hidden: true }; }); sh.loose = [];
  sh.sails.forEach(function (s) { s.area = sailArea(s); }); sh.sailArea0 = sh.sails.reduce(function (a, s) { return a + s.area; }, 0) || 1;
  applySailSet(sh);
  MASTS.forEach(function (m) { sh.masts.push({ name: m.name, x: m.x, z0: m.z0, z1: m.z1, orig: m.orig, up: true }); });
  sh.crew = makeCrew(sh); sh.crew0 = sh.crew.length; sh.wounded = 0; sh.dead = 0; sh.causes = {};
  sh.M = shipMatrix(sh); sh.inv = M4.inv(sh.M);
  return sh;
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
      var mod = models.filter(function (m) { var b = m.bb; return P[0] > b[0] - 4 && P[0] < b[3] + 4 && P[1] > b[1] - 4 && P[1] < b[4] + 4 && P[2] > b[2] - 4 && P[2] < b[5] + 4; })[0];
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

