// ───────────────────────── 帆的布片（帆與繩的物理開著才有） ─────────────────────────
// Tim 2026-10-13：物理開著時帆被打破，不撒點精靈，改成真的從帆上撕下來、照物理飄落的布。
// 從哪裡來：tearCloth（30_rig_physics.js）這一發新藏起來的細格三角形 ＝ 被打掉的那一塊布（方帆一發約 108 個三角形、30–40 m²；三角帆 48–80 個）。
//   切成幾片：亂數挑幾個種子三角形，其他照作品形狀上的重心歸到最近的那一顆 ⇒ 不規則的碎片（一片平均 SH_TRI 個三角形，鏈彈碎一點）。
//   每片是一小塊布：細格點 ＋ 邊與跨點約束（meshCons，長度照撕下來那一刻），跟帆走同一套 clothStep ——
//   風壓沿法線、大小 ∝（相對風在法線上的分量）²（攤平的時候慢慢飄、側過來掉得快）、重力、阻尼、碰到甲板擋住（hitGrid）。
//   風壓 ×SH_KW：帆的 KW 攤平落下是 4.4 m/s、一片 1.5 m 的布從 14 m 高 2 秒就落海（量過：每秒 5–9 m）⇒ ×3 ⇒ 攤平約 2.5 m/s，風一吹就跟著風走。
//   初速：被砲彈往前帶（彈的方向 1.5–4 m/s，鏈彈到 6）＋ 亂撒一點 ＋ 轉（每點加 ω × 離重心的距離 ⇒ 翻著飛）。
// 座標：船的格座標（跟帆一樣用 sh.M 畫、接在帆的緩衝後面（11_rig_gpu.js sailBuf）⇒ 陰影、反射都有）；相對風已扣掉船速 ⇒ 離開船就被吹向船尾。
// 落水（中間那一點碰到海面、而且不在船殼外形裡）：不再算物理，停在海上（格座標裡每一步退回船走的那一段）、慢慢往下沉，SH_WET 秒後拿掉。
// 落在甲板上：躺著；SH_LIFE 秒後拿掉。上限照物理分級（09_phx.js RIG_LV 的 shred：每艘幾片；滿了先丟落水的、再丟最早的）。
// ⛔ 只給人看：自己的亂數 rndC（開局重設，70_flow.js）、不碰 rnd()、不回寫模擬 ⇒ 開或關同一個種子戰局逐字相同。
//   原本的點精靈布片（21_gunnery.js dropSail／shredSail）在布片接手時照樣抽完 rnd()、只是不放。
var SH_TRI = 10, SH_KW = 3, SH_LIFE = 40, SH_WET = 3, SH_SINK = 0.3;
var RSC0 = 0x2B79F5A1, rsC = SEED ^ RSC0, SH_STAT = { cut: 0, tris: 0 }, SHT = null;
function rndC() { rsC |= 0; rsC = rsC + 0x6D2B79F5 | 0; var t = Math.imul(rsC ^ rsC >>> 15, 1 | rsC); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function rgC(a, b) { return a + (b - a) * rndC(); }
function gsC() { var u = rndC() || 1e-9, v = rndC(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2831853 * v); }
/** tearCloth 撕開之後：這一發新藏起來的三角形（old ＝ 撕之前的 c.tv）切成布片。b ＝ 砲彈（世界座標的速度）。 */
function shredCut(sh, c, old, b) {
  var lv = rigLv(); if (!lv.shred || !sh.shreds) return;
  var T = c.T, tr = T.tris, tv = c.tv, P0 = T.p0, nt = [], j, i, k;
  for (j = 0; j < tr.length; j += 3) if ((tv[tr[j]] || tv[tr[j + 1]] || tv[tr[j + 2]]) && !(old[tr[j]] || old[tr[j + 1]] || old[tr[j + 2]])) nt.push(j);
  if (!nt.length) return;
  if (!SHT || SHT.length < T.n * 3) SHT = new Float32Array(T.n * 3);
  var P = clothFine(c, SHT), chain = b.ammo === 2;
  // 分片：種子（亂數挑、不重複）＋ 每個三角形歸到重心最近的種子（作品形狀上量 ⇒ 被風吹皺了也照布上的位置分）
  var cen = nt.map(function (j) { var a = tr[j] * 3, e = tr[j + 1] * 3, d = tr[j + 2] * 3; return [(P0[a] + P0[e] + P0[d]) / 3, (P0[a + 1] + P0[e + 1] + P0[d + 1]) / 3, (P0[a + 2] + P0[e + 2] + P0[d + 2]) / 3]; });
  var K = clamp(Math.round(nt.length / (SH_TRI * (chain ? 0.6 : 1) * rgC(0.7, 1.3))), 1, nt.length), ord = nt.map(function (_, q) { return q; });
  for (i = 0; i < K; i++) { k = i + ((rndC() * (ord.length - i)) | 0); var tmp = ord[i]; ord[i] = ord[k]; ord[k] = tmp; }
  var grp = []; for (i = 0; i < K; i++) grp.push([]);
  cen.forEach(function (w, q) {
    var bi = 0, bd = 1e18;
    for (var g = 0; g < K; g++) { var s = cen[ord[g]], dx = w[0] - s[0], dy = w[1] - s[1], dz = w[2] - s[2], d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; bi = g; } }
    grp[bi].push(nt[q]);
  });
  var bv = M4.dir(sh.inv, b.v[0], b.v[1], b.v[2]), bl = len(bv) || 1, HC = lv.every * DT, col = T.col;
  grp.forEach(function (g) {
    if (!g.length) return;
    var map = new Map(), pos = [], lt = [], fuv = T.uv ? [] : null;   // fuv：貼圖的 uv（帆有貼圖 ⇒ 布片照原處的圖畫、洞照樣透空；TASK-0579）
    g.forEach(function (j) { for (var q = 0; q < 3; q++) { var f = tr[j + q], v = map.get(f); if (v === undefined) { v = pos.length; map.set(f, v); pos.push([P[f * 3], P[f * 3 + 1], P[f * 3 + 2]]); if (fuv) fuv.push(T.uv[f * 2], T.uv[f * 2 + 1]); } lt.push(v); } });
    var n = pos.length, cons = meshCons(pos, new Uint16Array(lt)), cx = 0, cy = 0, cz = 0;
    pos.forEach(function (w) { cx += w[0] / n; cy += w[1] / n; cz += w[2] / n; });
    var sp = rgC(1.5, chain ? 6 : 4) / S, v0 = [bv[0] / bl * sp + gsC() / S, bv[1] / bl * sp + gsC() / S, bv[2] / bl * sp + gsC() / S];
    var om = [gsC(), gsC(), gsC()], ok = rgC(1, 4) / (len(om) || 1); om = mul(om, ok);   // 轉速 1–4 rad/s
    var p = new Float32Array(n * 3), q = new Float32Array(n * 3), t = rgC(0.82, 1);
    pos.forEach(function (w, u) {
      var rx = w[0] - cx, ry = w[1] - cy, rz = w[2] - cz, vx = v0[0] + om[1] * rz - om[2] * ry, vy = v0[1] + om[2] * rx - om[0] * rz, vz = v0[2] + om[0] * ry - om[1] * rx;
      p[u * 3] = w[0]; p[u * 3 + 1] = w[1]; p[u * 3 + 2] = w[2]; q[u * 3] = w[0] - vx * HC; q[u * 3 + 1] = w[1] - vy * HC; q[u * 3 + 2] = w[2] - vz * HC;
    });
    if (!CACC || CACC.length < n * 3) { CACC = new Float32Array(n * 3); CCNT = new Uint8Array(n); }
    sh.shreds.push({ T: { sim: cons }, p: p, q: q, pin: new Uint8Array(n), n: n, col: [col[0] * t, col[1] * t, col[2] * t], uv: fuv ? Float32Array.from(fuv) : null, ti: T.ti, torn: false, loose: true, kw: SH_KW, age: 0, wet: 0 });
    SH_STAT.cut++; SH_STAT.tris += g.length;
  });
  var F = sh.shreds;
  while (F.length > lv.shred) { k = F.findIndex(function (f) { return f.wet; }); F.splice(k >= 0 ? k : 0, 1); }
}
/** 中間那一點碰到海面、而且不在船殼外形裡（掉進艙口的不算）⇒ 落水。 */
function shredWet(sh, f) {
  var p = f.p, o = (f.n >> 1) * 3, w = M4.pt(sh.M, p[o], p[o + 1], p[o + 2]);
  if (w[1] > seaH(w[0], w[2], SIMT)) return false;
  var T = sh.T, x = p[o] | 0, z = p[o + 2] | 0, hb = T.hullHB;
  return !(hb && x >= 0 && x < T.hullTW && z >= 0 && z < T.hullTH && Math.abs(p[o + 1] + 0.5 - T.cy) < hb[z * T.hullTW + x]);
}
/** 每一步（physStep 的最後）：在空中與甲板上的照布算（跟帆同一個節拍）、每 0.1 秒看落水與壽命；落水的停在海上往下沉。 */
function shredStep(sh, wl, gv, si, chk) {
  var F = sh.shreds; if (!F || !F.length) return;
  var go = (si + sh.i) % rigLv().every === 0, d = null, i, j;
  for (i = 0; i < F.length; i++) {
    var f = F[i];
    if (f.wet) {
      if (!d) d = M4.dir(sh.inv, -sh.vel[0] * DT, (-sh.vel[1] - SH_SINK) * DT, -sh.vel[2] * DT);   // 海上不動的一點，在船的格座標裡每一步往回退船走的那一段
      for (j = 0; j < f.n * 3; j += 3) { f.p[j] += d[0]; f.p[j + 1] += d[1]; f.p[j + 2] += d[2]; }
      if (chk && (f.wet += 0.1) > SH_WET) F.splice(i--, 1);
      continue;
    }
    if (go) clothStep(sh, f, wl, gv);
    if (!chk) continue;
    f.age += 0.1;
    if (f.age > SH_LIFE) { F.splice(i--, 1); continue; }
    if (shredWet(sh, f)) f.wet = 0.01;
  }
}
