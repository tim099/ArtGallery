// ───────────────────────── 碎片（每格一顆小方塊，GPU instancing） ─────────────────────────
var DMAX = 45000, D = {
  n: 0, p: new Float32Array(DMAX * 3), v: new Float32Array(DMAX * 3), q: new Float32Array(DMAX * 4), w: new Float32Array(DMAX * 3),
  life: new Float32Array(DMAX), size: new Float32Array(DMAX), col: new Uint8Array(DMAX), st: new Uint8Array(DMAX), ship: new Int8Array(DMAX)
};
var DINST = new Float32Array(DMAX * 9);
// 碎木自己的亂數（轉軸、落水、落地）：⛔ 跟戰局共用 rnd() ⇒ 少生一顆碎木（物理分級），後面的亂數全部錯位、整局都變（09_phx.js）。開局跟 rs 一起重設（70_flow.js）
var RSD0 = 0x2545F491, rsD = SEED ^ RSD0, DEB_ACC = 0, PT_ACC = 0;   // DEB_ACC／PT_ACC：照分級少生的節拍（不抽亂數）
function rndD() { rsD |= 0; rsD = rsD + 0x6D2B79F5 | 0; var t = Math.imul(rsD ^ rsD >>> 15, 1 | rsD); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function spawnDebris(p, v, col, size, life) {
  var k = DEB_KS[PHX.debris]; if (k < 1) { DEB_ACC += k; if (DEB_ACC < 1) return; DEB_ACC -= 1; }   // 物理分級：少生幾顆（呼叫端的亂數已經抽完 ⇒ 戰局不變）
  var i;
  if (D.n < DMAX) i = D.n++;
  else { i = (rndD() * DMAX) | 0; }     // 滿了 ⇒ 隨便頂掉一顆（只影響畫面，不影響模擬判定）
  D.p[i * 3] = p[0]; D.p[i * 3 + 1] = p[1]; D.p[i * 3 + 2] = p[2];
  D.v[i * 3] = v[0]; D.v[i * 3 + 1] = v[1]; D.v[i * 3 + 2] = v[2];
  var ax = norm([rndD() - 0.5, rndD() - 0.5, rndD() - 0.5]), sp = 4 + 14 * rndD();
  D.w[i * 3] = ax[0] * sp; D.w[i * 3 + 1] = ax[1] * sp; D.w[i * 3 + 2] = ax[2] * sp;
  D.q[i * 4] = 0; D.q[i * 4 + 1] = 0; D.q[i * 4 + 2] = 0; D.q[i * 4 + 3] = 1;
  D.life[i] = life; D.size[i] = size; D.col[i] = col; D.st[i] = 1; D.ship[i] = -1;
}
function stepDebris(dt) {
  for (var i = 0; i < D.n; i++) {
    var st = D.st[i]; if (!st) continue;
    D.life[i] -= dt;
    if (D.life[i] <= 0) { kill(i); i--; continue; }
    var o = i * 3;
    if (st === 2) {                                            // 落在甲板上：跟著船（座標存的是格座標）；底下那一格沒了 ⇒ 重新掉
      var hs = SHIPS[D.ship[i]];
      if (hs.grid.get(D.p[o] | 0, D.p[o + 1] | 0, (D.p[o + 2] | 0) - 1)) continue;
      var wp = M4.pt(hs.M, D.p[o], D.p[o + 1], D.p[o + 2]);
      D.p[o] = wp[0]; D.p[o + 1] = wp[1]; D.p[o + 2] = wp[2]; D.v[o] = D.v[o + 1] = D.v[o + 2] = 0; D.st[i] = st = 1;
    }
    if (st === 1) { D.v[o + 1] -= G * dt; D.v[o] *= 1 - 0.15 * dt; D.v[o + 2] *= 1 - 0.15 * dt; }
    D.p[o] += D.v[o] * dt; D.p[o + 1] += D.v[o + 1] * dt; D.p[o + 2] += D.v[o + 2] * dt;
    // 轉
    var qi = i * 4, qx = D.q[qi], qy = D.q[qi + 1], qz = D.q[qi + 2], qw = D.q[qi + 3], wx = D.w[o] * dt * 0.5, wy = D.w[o + 1] * dt * 0.5, wz = D.w[o + 2] * dt * 0.5;
    var nx = qx + wx * qw + wy * qz - wz * qy, ny = qy + wy * qw + wz * qx - wx * qz, nz = qz + wz * qw + wx * qy - wy * qx, nw = qw - wx * qx - wy * qy - wz * qz, l = Math.hypot(nx, ny, nz, nw);
    D.q[qi] = nx / l; D.q[qi + 1] = ny / l; D.q[qi + 2] = nz / l; D.q[qi + 3] = nw / l;
    if (st === 1) {
      if (D.p[o + 1] < seaH(D.p[o], D.p[o + 2], SIMT)) {                                    // 落水：慢慢沉
        D.st[i] = 3; D.v[o] *= 0.1; D.v[o + 1] = -0.25; D.v[o + 2] *= 0.1; D.life[i] = Math.min(D.life[i], 4);
        if (rndD() < 0.04) spawnPt(add([D.p[o], 0.05, D.p[o + 2]], [0, 0, 0]), [0, 1.5, 0], 0.5, [0.9, 0.95, 1], 0.6, 0.6, 0, 1);
        continue;
      }
      if (D.v[o + 1] < 0) for (var s = 0; s < SHIPS.length; s++) {       // 掉到甲板上 ⇒ 停住
        var sh = SHIPS[s], L = M4.pt(sh.inv, D.p[o], D.p[o + 1], D.p[o + 2]);
        if (L[0] < 0 || L[2] < 0 || L[0] >= sh.grid.sx) continue;
        if (sh.grid.get(L[0] | 0, L[1] | 0, L[2] | 0)) {
          D.st[i] = 2; D.ship[i] = s; D.p[o] = L[0]; D.p[o + 1] = L[1]; D.p[o + 2] = Math.floor(L[2]) + 1.0 + D.size[i] * 5;
          D.life[i] = Math.min(D.life[i], 25 + 20 * rndD()); break;
        }
      }
    }
  }
}
function kill(i) {
  var j = D.n - 1;
  if (i !== j) {
    D.p.copyWithin(i * 3, j * 3, j * 3 + 3); D.v.copyWithin(i * 3, j * 3, j * 3 + 3); D.w.copyWithin(i * 3, j * 3, j * 3 + 3); D.q.copyWithin(i * 4, j * 4, j * 4 + 4);
    D.life[i] = D.life[j]; D.size[i] = D.size[j]; D.col[i] = D.col[j]; D.st[i] = D.st[j]; D.ship[i] = D.ship[j];
  }
  D.st[j] = 0; D.n--;
}

// ───────────────────────── 粒子（煙、水花、火光、砲彈） ─────────────────────────
var PMAX = 12000, PT = { n: 0, p: new Float32Array(PMAX * 3), v: new Float32Array(PMAX * 3), life: new Float32Array(PMAX), max: new Float32Array(PMAX),
  s0: new Float32Array(PMAX), s1: new Float32Array(PMAX), c: new Float32Array(PMAX * 3), a: new Float32Array(PMAX), grav: new Float32Array(PMAX), drag: new Float32Array(PMAX), ty: new Float32Array(PMAX) };
var PBUF = new Float32Array(PMAX * 9);
function spawnPt(p, v, life, col, a, s0, s1, grav, drag, ty) {
  var k = FX_KS[PHX.fx]; if (k < 1) { PT_ACC += k; if (PT_ACC < 1) return; PT_ACC -= 1; }   // 物理分級：少生幾顆（參數的亂數呼叫端已經抽完）
  if (PT.n >= PMAX) return;
  var i = PT.n++;
  PT.p[i * 3] = p[0]; PT.p[i * 3 + 1] = p[1]; PT.p[i * 3 + 2] = p[2]; PT.v[i * 3] = v[0]; PT.v[i * 3 + 1] = v[1]; PT.v[i * 3 + 2] = v[2];
  PT.life[i] = PT.max[i] = life; PT.c[i * 3] = col[0]; PT.c[i * 3 + 1] = col[1]; PT.c[i * 3 + 2] = col[2]; PT.a[i] = a; PT.s0[i] = s0; PT.s1[i] = s1; PT.grav[i] = grav || 0; PT.drag[i] = drag || 0;
  PT.ty[i] = (ty || 0) * 4 + ((i * 7) & 3);         // 類型 × 4 ＋ 變體
}
function stepPts(dt) {
  for (var i = 0; i < PT.n; i++) {
    PT.life[i] -= dt;
    if (PT.life[i] <= 0) {
      var j = --PT.n;
      if (i !== j) { PT.p.copyWithin(i * 3, j * 3, j * 3 + 3); PT.v.copyWithin(i * 3, j * 3, j * 3 + 3); PT.c.copyWithin(i * 3, j * 3, j * 3 + 3);
        PT.life[i] = PT.life[j]; PT.max[i] = PT.max[j]; PT.a[i] = PT.a[j]; PT.s0[i] = PT.s0[j]; PT.s1[i] = PT.s1[j]; PT.grav[i] = PT.grav[j]; PT.drag[i] = PT.drag[j]; PT.ty[i] = PT.ty[j]; }
      i--; continue;
    }
    var o = i * 3, k = 1 - PT.drag[i] * dt;
    PT.v[o] = PT.v[o] * k + WIND[0] * WX.wind * PT.drag[i] * dt; PT.v[o + 1] = PT.v[o + 1] * k - PT.grav[i] * dt; PT.v[o + 2] = PT.v[o + 2] * k + WIND[2] * WX.wind * PT.drag[i] * dt;   // 天氣：暴風雨煙飄得快
    PT.p[o] += PT.v[o] * dt; PT.p[o + 1] += PT.v[o + 1] * dt; PT.p[o + 2] += PT.v[o + 2] * dt;
    if (PT.grav[i] > 0 && PT.p[o + 1] < 0) PT.life[i] = Math.min(PT.life[i], 0.05);
  }
}
function smoke(p, dir, n, big) {
  for (var i = 0; i < n; i++) {
    var v = add(mul(dir, rr(2, big ? 9 : 14)), [gauss() * 1.2, rr(0.3, 1.6), gauss() * 1.2]);
    var g = rr(0.62, 0.86);
    // 2.5–5.5 秒就散：齊射的煙不要一直擋著看砲彈落點
    spawnPt(add(p, mul(dir, rr(0, 2))), v, rr(2.5, 5.5), [g, g, g * 0.98], rr(0.35, 0.55), rr(1.2, 2.2) * (big ? 1.6 : 1), rr(6, 11) * (big ? 1.5 : 1), -0.05, 1.1, 0);
  }
}
function flash(p, dir, n, big) {
  for (var i = 0; i < n; i++) spawnPt(p, add(mul(dir, rr(5, 30)), [gauss() * 3, gauss() * 3, gauss() * 3]), rr(0.08, 0.22), [1, rr(0.6, 0.85), 0.3], 1, rr(1, 2.5) * (big ? 2 : 1), 0.3, 0, 4, 1);
}
function splash(p, big) {
  var n = big ? 60 : 26;
  for (var i = 0; i < n; i++) spawnPt([p[0] + gauss() * 0.6, 0.1, p[2] + gauss() * 0.6], [gauss() * 1.6, rr(4, big ? 14 : 10), gauss() * 1.6], rr(0.8, 1.8), [0.92, 0.96, 1], 0.75, rr(0.4, 1.0), rr(0.8, 1.6), G, 0.3, 2);
  for (i = 0; i < 10; i++) spawnPt([p[0] + gauss() * 1.5, 0.15, p[2] + gauss() * 1.5], [gauss() * 0.4, 0.2, gauss() * 0.4], rr(1.5, 3), [0.95, 0.97, 1], 0.35, 1.5, 4, 0, 0.5, 2);
  sfx('splash', p, big ? 1.2 : 0.7);
}

