// ───────────────────────── 進水：粒子模式（TASK-0525） ─────────────────────────
// 兩種模式（Tim 2026-10-13）：物理效果的「進水」第 0 檔 ＝ 公式（32_hull.js：水線下破洞數 × √水深）；1–3 檔 ＝ 粒子（粗／中／細）。全開 ＝ 細。
// 粒子模式：進水量、下沉、傾斜完全由艙內的水決定 ——
//   · 破口：船殼最外那一層被打掉、而且往艙內一路通到原本是空的地方（flHoleRedo），每 c × c 格算一塊（面積 ＝ 通的格數 × S²）。
//     流量照 Torricelli：FL_C × 面積 × √(2g × 水頭差) × 滑桿／預設（細節設定的「進水速度」；預設 0.35 ⇒ ×1 ＝ 物理的流量）。
//     水頭差 ＝ 外面的水面（seaH，照浪）減艙內在那個洞的水面，兩邊都不低於洞本身 ⇒ 浮出水面的洞不進水；艙內的水比外面高 ⇒ 往外流。
//   · 流進來的水是粒子（每顆帶 vj m³）：從洞往艙內噴（初速 √(2g × 水頭差)），照重力在船的座標裡落下，碰到船體或水面就併進水格。粒子滿了 ⇒ 直接併進洞旁那一格。
//   · 水格（每格 c 格見方，存水量 m³）：往下流（照那一格最密的那一層開著幾成：甲板擋、艙口與破洞讓水下去）；滿了往上擠；
//     往旁邊流照水面的世界高度（船的矩陣，含傾斜與浪的搖晃）⇒ 船一傾斜，水往低的那一舷跑，再把船壓得更斜（自由液面）。
//   · 抽水機：每秒從最低的那一層水抽掉 FL_PUMP ×（滑桿／預設）m³（約每分鐘 18 噸：四台鏈式抽水機全力抽）。
//     ⛔ 照公式那邊的抽水換算（0.004 m/s × 水線面積 ≈ 每秒 0.84 m³）⇒ 比水線附近那幾個洞進得還快，戰鬥 420 秒艙裡一滴水都留不住（量過）。
//   · 船：艙內的水 ＝ 加上去的重量 ⇒ 照浮力表（32_hull.js liftFor）算多吃水多少，sh.sink 照它慢慢跟過去（FL_TAU 秒）；
//     水的重心偏哪一舷 ⇒ 往那邊傾斜（穩心高 FL_GM，見下）、偏船頭船尾 ⇒ 縱傾（FL_GML）；上限跟公式一樣（開始沉之前 0.21 rad、縱傾 0.07）。
//     開始沉（下沉 4.2 m）之後照舊加速沉下去；斷成兩截照舊（公式，一定沉）。
// 精細等級 FL_LV：c 水格邊長幾格、ev 幾步算一次水格、jn 粒子上限（每艘）、vj 每顆帶多少 m³、dn 每次最多重算幾格被打壞的水格與破口。
// 戰局：自己的亂數 rndF（開局重設）；各檔水格不同 ⇒ 各檔是各自的一局（同一個種子各自逐字重現）。⛔ 不碰 rnd()、不讀畫面的設定。
//   進水模式開戰時決定（FLOOD_LV，70_flow.js），戰鬥中改了下一場生效。
var FL_LV = [null, { c: 10, ev: 4, jn: 300, vj: 0.25, dn: 120 }, { c: 7, ev: 2, jn: 800, vj: 0.08, dn: 200 }, { c: 5, ev: 2, jn: 2000, vj: 0.03, dn: 300 }];
// FL_GM 穩心高（Tim 2026-10-13：傾斜收一點）：1.1 m（巡防艦的量級）⇒ 水往低的那一舷跑（自由液面），一舷有洞積 200 噸就斜到上限 12°、兩舷都有洞也一樣；
//   4 m ⇒ 一舷有洞 180／380／600／840 噸時 1.9°／4.7°／8.4°／12°，兩舷都有洞 1,140 噸才 3.7°（沙盒 60 秒量的；2 m、3 m 還是很快頂到上限，5 m 一舷 830 噸才 8.3°）。
var FL_C = 1.0, FL_PUMP = 0.3, FL_GM = 4, FL_GML = 60, FL_TAU = 2;
var FL_HIDE = false, FLOOD_LV = 0, RSF0 = 0x3C6EF372, rsF = SEED ^ RSF0;
function rndF() { rsF |= 0; rsF = rsF + 0x6D2B79F5 | 0; var t = Math.imul(rsF ^ rsF >>> 15, 1 | rsF); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function rgF(a, b) { return a + (b - a) * rndF(); }
/** 船型 T 的水格（邊長 c 格；第一次用到時算，掛在 T.flc[c]）：兩舷船殼最外那一格（yP／yM，每個 (x, z)）、每格能裝多少（cap：艙內空的比例）、往下通多少（pd：最密那一層開著的比例）。 */
function flType(T, c) {
  var K = T.flc || (T.flc = {}); if (K[c]) return K[c];
  var B = T.base, zTop = Math.min(B.sz, T.zw + 46), x0 = Math.max(0, T.wl0 - 4), x1 = Math.min(B.sx - 1, T.wl1 + 4), cy = T.cy, TW = T.hullTW, HB = T.hullHB;
  var nxv = x1 - x0 + 1, yP = new Int16Array(nxv * zTop).fill(-1), yM = new Int16Array(nxv * zTop).fill(-1), ylo = 1e9, yhi = -1, x, y, z;
  for (z = 0; z < Math.min(zTop, T.hullTH); z++) for (x = x0; x <= x1; x++) {
    var hb = HB[z * TW + x]; if (!hb) continue;
    var k = z * nxv + x - x0;
    for (y = Math.min(B.sy - 1, Math.ceil(cy + hb)); y > cy; y--) if (B.get(x, y, z)) { yP[k] = y; break; }
    for (y = Math.max(0, Math.floor(cy - hb - 1)); y < cy; y++) if (B.get(x, y, z)) { yM[k] = y; break; }
    if (yP[k] < 0 || yM[k] < 0) { yP[k] = yM[k] = -1; continue; }
    if (yM[k] < ylo) ylo = yM[k]; if (yP[k] > yhi) yhi = yP[k];
  }
  var NX = Math.ceil(nxv / c), NY = Math.ceil((yhi - ylo + 1) / c), NZ = Math.ceil(zTop / c), N = NX * NY * NZ;
  var F = { c: c, X0: x0, Y0: ylo, NX: NX, NY: NY, NZ: NZ, N: N, nxv: nxv, zTop: zTop, yP: yP, yM: yM, cap: new Float32Array(N), pd: new Float32Array(N) };
  var intC = new Int32Array(N), solC = new Int32Array(N), intL = new Int32Array(N * c), solL = new Int32Array(N * c);
  for (z = 0; z < zTop; z++) for (x = x0; x <= x1; x++) {
    var kk = z * nxv + x - x0, a = yM[kk] + 1, b = yP[kk] - 1; if (yP[kk] < 0 || b < a) continue;
    var cxi = ((x - x0) / c) | 0, czi = (z / c) | 0, lz = z % c;
    for (var cyi = ((a - ylo) / c) | 0; cyi <= (((b - ylo) / c) | 0); cyi++) {
      var lo = Math.max(a, ylo + cyi * c), hi = Math.min(b, ylo + cyi * c + c - 1), cell = (czi * NY + cyi) * NX + cxi;
      intC[cell] += hi - lo + 1; intL[cell * c + lz] += hi - lo + 1;
    }
  }
  B.each(function (x, y, z) {
    if (z >= zTop || x < x0 || x > x1) return;
    var kk = z * nxv + x - x0; if (!(y > yM[kk] && y < yP[kk])) return;
    var cell = (((z / c) | 0) * NY + (((y - ylo) / c) | 0)) * NX + (((x - x0) / c) | 0); solC[cell]++; solL[cell * c + z % c]++;
  });
  for (var i = 0; i < N; i++) {
    F.cap[i] = (intC[i] - solC[i]) / (c * c * c);
    var p = 1, any = false;
    for (var l = 0; l < c; l++) { var il = intL[i * c + l]; if (il > 0) { any = true; p = Math.min(p, (il - solL[i * c + l]) / il); } }
    F.pd[i] = any ? p : 0;
  }
  return K[c] = F;
}
/** 開一艘船的進水狀態（makeShip；公式模式 ⇒ null）。 */
function flNew(sh) {
  var L = FL_LV[FLOOD_LV]; if (!L) return null;
  var F = flType(sh.T, L.c), N = F.N, H = 2 * F.NX * F.NZ;
  return { L: L, F: F, cap: F.cap.slice(), pd: F.pd.slice(), A: new Float32Array(N), on: new Uint8Array(N), act: new Int32Array(4096), actN: 0, dmark: new Uint8Array(N), dirty: [],
    hA: new Float32Array(H), hX: new Float32Array(H), hY: new Float32Array(H), hZ: new Float32Array(H), hYi: new Float32Array(H), hAcc: new Float32Array(H), hmark: new Uint8Array(H), hon: new Uint8Array(H), hdirty: [], holes: [],
    J: { n: 0, p: new Float32Array(L.jn * 3), v: new Float32Array(L.jn * 3), vol: new Float32Array(L.jn), life: new Float32Array(L.jn) },
    vol: 0, area: 0, open: 0, inQ: 0, outQ: 0, inTot: 0, outTot: 0, pumped: 0, comX: 0, comY: 0, sinkT: 0, step: 0, gen: 0, mesh: null };
}
function flAct(fl, i) {
  if (fl.on[i]) return; fl.on[i] = 1;
  if (fl.actN >= fl.act.length) { var a = new Int32Array(fl.act.length * 2); a.set(fl.act); fl.act = a; }
  fl.act[fl.actN++] = i;
}
/** 打掉一格（20_shatter.js removeVoxel）：那一格所在的水格、靠近船殼的話那一塊破口，記下來待重算。 */
function floodTouch(sh, x, y, z) {
  var fl = sh.fl, F = fl.F, c = F.c;
  if (z >= F.zTop || z < 0 || x < F.X0 || x >= F.X0 + F.nxv) return;
  var iy = ((y - F.Y0) / c) | 0, bx = ((x - F.X0) / c) | 0, bz = (z / c) | 0;
  if (y >= F.Y0 && iy < F.NY) { var i = (bz * F.NY + iy) * F.NX + bx; if (!fl.dmark[i]) { fl.dmark[i] = 1; fl.dirty.push(i); } }
  var k = z * F.nxv + x - F.X0, yp = F.yP[k]; if (yp < 0) return;
  var side = Math.abs(y - yp) <= Math.abs(y - F.yM[k]) ? 0 : 1, d = side ? y - F.yM[k] : yp - y;
  if (d > 30 || d < -2) return;
  var h = (side * F.NX + bx) * F.NZ + bz; if (!fl.hmark[h]) { fl.hmark[h] = 1; fl.hdirty.push(h); }
}
/** 被打壞的水格重算（照現在的格）：能裝多少、往下通多少。 */
function flCellRedo(sh, fl, i) {
  var F = fl.F, c = F.c, ix = i % F.NX, iy = ((i / F.NX) | 0) % F.NY, iz = (i / (F.NX * F.NY)) | 0, Gd = sh.grid, it = 0, st = 0, p = 1, any = false;
  for (var l = 0; l < c; l++) {
    var z = iz * c + l, il = 0, sl = 0; if (z >= F.zTop) break;
    for (var dx = 0; dx < c; dx++) {
      var x = F.X0 + ix * c + dx; if (x - F.X0 >= F.nxv) break;
      var k = z * F.nxv + x - F.X0; if (F.yP[k] < 0) continue;
      var a = Math.max(F.yM[k] + 1, F.Y0 + iy * c), b = Math.min(F.yP[k] - 1, F.Y0 + iy * c + c - 1);
      for (var y = a; y <= b; y++) { il++; if (Gd.get(x, y, z)) sl++; }
    }
    it += il; st += sl; if (il > 0) { any = true; p = Math.min(p, (il - sl) / il); }
  }
  fl.cap[i] = (it - st) / (c * c * c); fl.pd[i] = any ? p : 0;
}
/** 一塊破口重算：c × c 個船殼最外的點，每點從外往裡走，先碰到還在的格 ⇒ 不通；先走到原本是空的（艙內）⇒ 通。面積 ＝ 通的點數 × S²，記下中心與艙內那一側。 */
function flHoleRedo(sh, fl, h) {
  var F = fl.F, c = F.c, side = (h / (F.NX * F.NZ)) | 0, r = h % (F.NX * F.NZ), bx = (r / F.NZ) | 0, bz = r % F.NZ, Gd = sh.grid, B = sh.T.base, s = side ? 1 : -1;
  var n = 0, sx = 0, sy = 0, sz = 0, si = 0;
  for (var dz = 0; dz < c; dz++) for (var dx = 0; dx < c; dx++) {
    var x = F.X0 + bx * c + dx, z = bz * c + dz; if (x - F.X0 >= F.nxv || z >= F.zTop) continue;
    var k = z * F.nxv + x - F.X0, y0 = side ? F.yM[k] : F.yP[k]; if (y0 < 0) continue;
    for (var t = 0; t < 30; t++) { var y = y0 + s * t; if (Gd.get(x, y, z)) break; if (!B.get(x, y, z)) { n++; sx += x; sy += y0; sz += z; si += y; break; } }
  }
  fl.hA[h] = n * S * S;
  if (n) { fl.hX[h] = sx / n + 0.5; fl.hY[h] = sy / n + 0.5; fl.hZ[h] = sz / n + 0.5; fl.hYi[h] = si / n + 0.5; if (!fl.hon[h]) { fl.hon[h] = 1; fl.holes.push(h); } }
}
/** 艙內那一點 (x, y, z)（格座標）所在的水格；不在格子範圍 ⇒ −1。 */
function flCell(F, x, y, z) {
  var ix = Math.floor((x - F.X0) / F.c), iy = Math.floor((y - F.Y0) / F.c), iz = Math.floor(z / F.c);
  if (ix < 0 || iy < 0 || iz < 0 || ix >= F.NX || iy >= F.NY || iz >= F.NZ) return -1;
  return (iz * F.NY + iy) * F.NX + ix;
}
/** 水併進第 i 格（那一格裝不了水 ⇒ 往上找三格）。 */
function flDeposit(fl, i, v) {
  var NXY = fl.F.NX * fl.F.NY;
  for (var t = 0; t < 4 && i >= 0 && i < fl.F.N; t++, i += NXY) if (fl.cap[i] > 0.02) { fl.A[i] += v; flAct(fl, i); return; }
  fl.lost = (fl.lost || 0) + v;
}
/** 每一步（32_hull.js stepShip，粒子模式）：粒子飛、每 ev 步算一次水格（破口進出水、往下往旁邊流、抽水、讀數）。 */
function floodStep(sh, fl, dt) {
  if (!(dt > 0)) return;
  var F = fl.F, L = fl.L, J = fl.J, Vc = Math.pow(F.c * S, 3), gL = M4.dir(sh.inv, 0, -G, 0), i, o;
  // 粒子：照重力（船的座標，格／秒²）落下；碰到船體、滿的水格、出界或活太久 ⇒ 併進上一個位置的水格
  for (i = 0; i < J.n; i++) {
    o = i * 3;
    var px = J.p[o], py = J.p[o + 1], pz = J.p[o + 2], c0 = flCell(F, px, py, pz);
    J.v[o] += gL[0] * dt; J.v[o + 1] += gL[1] * dt; J.v[o + 2] += gL[2] * dt;
    J.p[o] += J.v[o] * dt; J.p[o + 1] += J.v[o + 1] * dt; J.p[o + 2] += J.v[o + 2] * dt; J.life[i] -= dt;
    var c1 = flCell(F, J.p[o], J.p[o + 1], J.p[o + 2]);
    if (J.life[i] <= 0 || c1 < 0 || sh.grid.get(Math.floor(J.p[o]), Math.floor(J.p[o + 1]), Math.floor(J.p[o + 2])) || fl.A[c1] >= fl.cap[c1] * Vc * 0.95) {
      flDeposit(fl, c0 >= 0 ? c0 : c1, J.vol[i]);
      var j = --J.n;
      if (i !== j) { J.p.copyWithin(o, j * 3, j * 3 + 3); J.v.copyWithin(o, j * 3, j * 3 + 3); J.vol[i] = J.vol[j]; J.life[i] = J.life[j]; }
      i--;
    }
  }
  if (++fl.step % L.ev) return;
  flTick(sh, fl, dt * L.ev);
}
function flTick(sh, fl, dtc) {
  var F = fl.F, L = fl.L, J = fl.J, c = F.c, NX = F.NX, NY = F.NY, NXY = NX * NY, N = F.N, A = fl.A, cap = fl.cap, pd = fl.pd, M = sh.M, Vc = Math.pow(c * S, 3), hc = c * S, fk = sh.cfg.flood / LIM.flood[2], i, k, m;   // 滑桿／預設：預設 ⇒ 物理的流量
  // 0. 被打壞的水格、破口（每次最多 dn 個 ⇒ 一發殉爆不會卡一下）
  for (k = 0; k < L.dn && fl.dirty.length; k++) { i = fl.dirty.shift(); fl.dmark[i] = 0; flCellRedo(sh, fl, i); }
  for (k = 0; k < L.dn && fl.hdirty.length; k++) { var hd = fl.hdirty.shift(); fl.hmark[hd] = 0; flHoleRedo(sh, fl, hd); }
  // 水面的世界高度：格 (ix, iy, iz) 的底 ＋ 裝了幾成 × 格高
  var h0 = M[1] * (F.X0 + 0.5 * c) + M[5] * (F.Y0 + 0.5 * c) + M[13], dhx = M[1] * c, dhy = M[5] * c, dhz = M[9] * c;
  function head(i) { var ix = i % NX, iy = ((i / NX) | 0) % NY, iz = (i / NXY) | 0; return h0 + ix * dhx + iy * dhy + iz * dhz + (cap[i] > 0 ? A[i] / (cap[i] * Vc) : 0) * hc; }
  // 1. 破口：外面的水面 vs 艙內在洞那裡的水面（都不低於洞）⇒ 進或出
  var inQ = 0, outQ = 0, area = 0, open = 0;
  for (k = 0; k < fl.holes.length; k++) {
    var h = fl.holes[k], ar = fl.hA[h]; if (!(ar > 0)) continue;
    area += ar; open++;
    var side = (h / (NX * F.NZ)) | 0, s = side ? 1 : -1, P = M4.pt(M, fl.hX[h], fl.hY[h], fl.hZ[h]), hOut = seaH(P[0], P[2], SIMT);
    var ci = flCell(F, fl.hX[h], fl.hYi[h] + s * 0.5 * c, fl.hZ[h]), hIn = -1e9;
    if (ci >= 0 && A[ci] > 1e-6) { var q = ci; while (q + NXY < N && A[q] >= cap[q] * Vc * 0.98 && A[q + NXY] > 1e-6) q += NXY; hIn = head(q); }
    var d = Math.max(hOut, P[1]) - Math.max(hIn, P[1]);
    if (d > 0.001) {
      var dv = FL_C * ar * Math.sqrt(2 * G * d) * fk * dtc; inQ += dv;
      fl.hAcc[h] += dv;
      var sp = Math.sqrt(2 * G * d) / S;                                        // 噴進來的速度（格／秒）
      while (fl.hAcc[h] >= L.vj) {
        fl.hAcc[h] -= L.vj;
        if (J.n < L.jn) {
          var jo = J.n * 3; J.p[jo] = fl.hX[h] + rgF(-0.4, 0.4) * c; J.p[jo + 1] = fl.hYi[h] + s; J.p[jo + 2] = fl.hZ[h] + rgF(-0.4, 0.4) * c;
          J.v[jo] = rgF(-0.25, 0.25) * sp; J.v[jo + 1] = s * rgF(0.5, 1.0) * sp; J.v[jo + 2] = rgF(-0.1, 0.25) * sp; J.vol[J.n] = L.vj; J.life[J.n] = 3; J.n++;
        } else if (ci >= 0) flDeposit(fl, ci, L.vj);
      }
    } else if (d < -0.001 && ci >= 0) {
      var ov = Math.min(FL_C * ar * Math.sqrt(2 * G * -d) * fk * dtc, A[ci]); A[ci] -= ov; outQ += ov;
      if (PHX.water && ov > 0.01) wpPour(P, M4.dir(M, 0, -s, 0), ov / dtc);    // 往外流：只給人看（13_water.js，自己的亂數）
    }
  }
  fl.inQ = inQ / dtc; fl.outQ = outQ / dtc; fl.inTot += inQ; fl.outTot += outQ; fl.area = area; fl.open = open;
  // 2. 水格：往下（照這一格往下通幾成）、滿了往上擠、往旁邊（照水面的世界高度；來回換方向走 ⇒ 不偏一邊）
  var n0 = fl.actN, act = fl.act, dir = fl.gen & 1, t, j;
  for (t = 0; t < n0; t++) {
    i = act[t]; var a = A[i]; if (a <= 1e-7) continue;
    if (i >= NXY && pd[i] > 0.02) { j = i - NXY; var room = cap[j] * Vc - A[j]; if (room > 0) { m = Math.min(a, room) * Math.min(1, pd[i] * 4); A[i] -= m; A[j] += m; flAct(fl, j); } }
    var ex = A[i] - cap[i] * Vc;
    if (ex > 1e-6 && i + NXY < N && cap[i + NXY] > 0.02 && pd[i + NXY] > 0.02) { A[i] -= ex; A[i + NXY] += ex; flAct(fl, i + NXY); }
  }
  for (t = 0; t < n0; t++) {
    i = act[dir ? n0 - 1 - t : t]; if (A[i] <= 1e-7 || !(cap[i] > 0.02) || A[i] / (cap[i] * Vc) < 0.03) continue;
    var hi = head(i), ix = i % NX, iy = ((i / NX) | 0) % NY;
    for (var nb = 0; nb < 4; nb++) {
      j = nb === 0 ? (ix > 0 ? i - 1 : -1) : nb === 1 ? (ix < NX - 1 ? i + 1 : -1) : nb === 2 ? (iy > 0 ? i - NX : -1) : (iy < NY - 1 ? i + NX : -1);
      if (j < 0 || !(cap[j] > 0.02)) continue;
      var dh = hi - head(j); if (dh <= 1e-4) continue;
      m = Math.min(0.5 * dh / hc * Math.min(cap[i], cap[j]) * Vc * 0.25, A[i] * 0.25);
      A[i] -= m; A[j] += m; flAct(fl, j); hi = head(i);
    }
  }
  // 3. 抽水：從最低的那幾層抽（⛔ act 要重拿：上面 flAct 可能換過一條更長的陣列）
  act = fl.act;
  var need = FL_PUMP * fk * dtc, lowz = 1e9;
  for (t = 0; t < fl.actN; t++) if (A[act[t]] > 1e-7) lowz = Math.min(lowz, (act[t] / NXY) | 0);
  for (var zz = lowz; zz < lowz + 3 && need > 0 && lowz < 1e9; zz++) for (t = 0; t < fl.actN && need > 0; t++) {
    i = act[t]; if (((i / NXY) | 0) !== zz || A[i] <= 0) continue; m = Math.min(A[i], need); A[i] -= m; need -= m; fl.pumped += m;
  }
  // 4. 收掉空的格；讀數：水量、重心（公尺，離船型中線：x 往船頭、y 往格 +y 那一舷為正）
  var w = 0, mx = 0, my = 0, keep = 0, cx = sh.T.cx, cy = sh.T.cy;
  for (t = 0; t < fl.actN; t++) {
    i = act[t];
    if (A[i] <= 1e-7) { A[i] = 0; fl.on[i] = 0; continue; }
    act[keep++] = i; w += A[i];
    mx += A[i] * (F.X0 + ((i % NX) + 0.5) * c - cx); my += A[i] * (F.Y0 + ((((i / NX) | 0) % NY) + 0.5) * c - cy);
  }
  fl.actN = keep;
  for (t = 0; t < J.n; t++) { w += J.vol[t]; mx += J.vol[t] * (J.p[t * 3] - cx); my += J.vol[t] * (J.p[t * 3 + 1] - cy); }
  fl.vol = w; fl.comX = w > 0 ? mx / w * S : 0; fl.comY = w > 0 ? my / w * S : 0; fl.gen++;
}
/** 艙內的水 ⇒ 該多吃水多少（m）：浮力表上「少掉的重量 − 水」跟「少掉的重量」的差。 */
function floodSinkT(sh, fl) {
  if (sh.flBase === undefined) return 0;
  var W = fl.vol * RHO_W, a = liftFor(sh.T, sh.flBase), b = liftFor(sh.T, sh.flBase - W);
  return fl.sinkT = a === null || b === null ? 0 : Math.max(0, a - b);
}
/** 水的重心 ⇒ 橫傾、縱傾的目標（rad；正負跟公式一樣：水在格 +y 那一舷 ⇒ 正 ⇒ 那一舷（右舷）往下；水在船頭 ⇒ 負 ⇒ 船頭往下）。 */
function floodTilt(sh, fl) {
  var W = fl.vol * RHO_W, D = (sh.mass0 || shipT(sh)) + W, lim = sh.sinkingFinal ? 0.55 : 0.21;
  return [clamp(Math.atan(W * fl.comY / (D * FL_GM)), -lim, lim), -clamp(Math.atan(W * fl.comX / (D * FL_GML)), -0.07, 0.07)];
}

// ── 畫：艙內的水面（每一格水柱的頂，四個角照同一個世界高度擺 ⇒ 船傾斜時水面還是平的）；噴進來的粒子跟點精靈一起畫 ──
function flGL() {
  P.pool = VK.compile(gl,
    '#version 300 es\nlayout(location=0) in vec4 aP; uniform mat4 uModel,uVP; out vec3 vW; out float vF; void main(){ vec4 w=uModel*vec4(aP.xyz,1.0); vW=w.xyz; vF=aP.w; gl_Position=uVP*w; }\n',
    '#version 300 es\nprecision highp float; in vec3 vW; in float vF; uniform vec3 uEye,uSun,uFog,uSky; uniform float uFogD,uSeaT,uX; out vec4 o;\n' + SHADOW_GLSL +
    'void main(){ vec2 r=vec2(sin(vW.x*3.1+uSeaT*2.3)+sin(vW.z*4.3-uSeaT*1.7),cos(vW.z*2.7-uSeaT*1.9)+cos(vW.x*3.7+uSeaT*2.1))*0.03; vec3 n=normalize(vec3(r.x,1.0,r.y));\n' +
    ' vec3 v=normalize(uEye-vW); float fr=0.04+0.96*pow(1.0-max(dot(n,v),0.0),5.0), sk=shadowK(vW,n);\n' +
    ' vec3 c=mix(vec3(0.08,0.27,0.3)*(0.45+0.55*sk),uSky*0.75,clamp(fr*0.8+0.08,0.0,1.0))+vec3(1.0,0.92,0.75)*pow(max(dot(reflect(-v,n),uSun),0.0),90.0)*(0.25+sk);\n' +
    ' if(uX>0.5) c=mix(c,vec3(0.2,0.6,0.95),0.45);\n' +
    ' float fd=length(vW-uEye); o=vec4(mix(c,uFog,1.0-exp(-fd*uFogD)),uX>0.5?0.62:0.78); }\n');
}
/** 艙內水面的網格（格座標，每個頂點帶「裝了幾成」）：水格有算過才重做。 */
function flMesh(sh, fl) {
  var F = fl.F, c = F.c, NX = F.NX, NY = F.NY, NXY = NX * NY, A = fl.A, cap = fl.cap, M = sh.M, Vc = Math.pow(c * S, 3), hc = c * S;
  var me = fl.mesh || (fl.mesh = { vao: gl.createVertexArray(), vb: gl.createBuffer(), buf: new Float32Array(6 * 4 * 512), n: 0, cap: 0, gen: -1 });
  if (me.gen === fl.gen) return me;
  var h0 = M[1] * (F.X0 + 0.5 * c) + M[5] * (F.Y0 + 0.5 * c) + M[13], q = 0, t, i, u;
  // 先找每一根水柱最上面那一格水面的世界高度（同一根有兩層水 ⇒ 只記上面那層）；四個角取周圍水柱的平均 ⇒ 水面連成一片，⛔ 一格一個高度 ⇒ 像一階一階的方塊
  var CH = me.ch && me.ch.length === NX * NY ? me.ch : (me.ch = new Float32Array(NX * NY)), CZ = me.cz && me.cz.length === NX * NY ? me.cz : (me.cz = new Int16Array(NX * NY));
  CZ.fill(-1); var tops = me.tops || (me.tops = []); tops.length = 0;
  for (t = 0; t < fl.actN; t++) {
    i = fl.act[t]; if (!(cap[i] > 0.02) || A[i] < 0.02 * cap[i] * Vc) continue;
    u = i + NXY; if (u < F.N && cap[u] > 0.02 && A[u] >= 0.02 * cap[u] * Vc) continue;          // 上面那一格也有水 ⇒ 不是水面
    var ix = i % NX, iy = ((i / NX) | 0) % NY, iz = (i / NXY) | 0, col = iy * NX + ix;
    var hw = h0 + ix * M[1] * c + iy * M[5] * c + iz * M[9] * c + Math.min(1, A[i] / (cap[i] * Vc)) * hc;
    tops.push(i, hw); if (iz > CZ[col]) { CZ[col] = iz; CH[col] = hw; }
  }
  function corner(ix, iy, iz, hw) {                                         // 角 (ix, iy) 周圍四根水柱裡、跟這一格差不到半格的水面平均
    var s = 0, n = 0;
    for (var a = ix - 1; a <= ix; a++) for (var b = iy - 1; b <= iy; b++) {
      if (a < 0 || b < 0 || a >= NX || b >= NY) continue; var k = b * NX + a;
      if (CZ[k] >= 0 && Math.abs(CZ[k] - iz) <= 1 && Math.abs(CH[k] - hw) < 0.6 * hc) { s += CH[k]; n++; }
    }
    return n ? s / n : hw;
  }
  for (t = 0; t < tops.length; t += 2) {
    i = tops[t]; var hw0 = tops[t + 1], jx = i % NX, jy = ((i / NX) | 0) % NY, jz = (i / NXY) | 0, f = Math.min(1, A[i] / (cap[i] * Vc));
    var x0 = F.X0 + jx * c, y0 = F.Y0 + jy * c, zl = jz * c - 0.5 * c, zh = jz * c + 1.5 * c;
    var cs = [[x0, y0, corner(jx, jy, jz, hw0)], [x0 + c, y0, corner(jx + 1, jy, jz, hw0)], [x0 + c, y0 + c, corner(jx + 1, jy + 1, jz, hw0)], [x0, y0 + c, corner(jx, jy + 1, jz, hw0)]];
    if ((q + 6) * 4 > me.buf.length) { var nb = new Float32Array(me.buf.length * 2); nb.set(me.buf); me.buf = nb; }
    [0, 1, 2, 0, 2, 3].forEach(function (e) {
      var p = cs[e], z = clamp((p[2] - (M[1] * p[0] + M[5] * p[1] + M[13])) / M[9], zl, zh);   // 同一個世界高度 ⇒ 船傾斜時水面還是平的
      me.buf[q * 4] = p[0]; me.buf[q * 4 + 1] = p[1]; me.buf[q * 4 + 2] = z; me.buf[q * 4 + 3] = f; q++;
    });
  }
  gl.bindVertexArray(me.vao); gl.bindBuffer(gl.ARRAY_BUFFER, me.vb);
  if (q * 4 > me.cap) { me.cap = me.buf.length; gl.bufferData(gl.ARRAY_BUFFER, me.cap * 4, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0); }
  if (q) gl.bufferSubData(gl.ARRAY_BUFFER, 0, me.buf, 0, q * 4);
  gl.bindVertexArray(null);
  me.n = q; me.gen = fl.gen; return me;
}
/** 畫艙內的水面（海與白沫之後；開始沉、斷了就不畫 —— 那時候海已經畫進船艙）。 */
function flDraw() {
  if (!P.pool || FL_HIDE) return;                                           // FL_HIDE：對照用（__game.flood(i, { hide: true })）
  var any = false;
  SHIPS.forEach(function (sh) {
    var fl = sh.fl; if (!fl || !fl.actN || sh.broken || sh.sinkingFinal || sh.sunk) return;
    var me = flMesh(sh, fl); if (!me.n) return;
    if (!any) { any = true; gl.useProgram(P.pool.prog); setCommon(P.pool); gl.uniform1f(P.pool.u.uX, FLX3 ? 1 : 0); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.disable(gl.CULL_FACE); if (FLX3) gl.disable(gl.DEPTH_TEST); }   // 停格的「🔍 透視」開著 ⇒ 隔著船殼看得到（72_floodui.js）
    gl.uniformMatrix4fv(P.pool.u.uModel, false, sh.M); gl.bindVertexArray(me.vao); gl.drawArrays(gl.TRIANGLES, 0, me.n);
  });
  if (any) { gl.depthMask(true); gl.enable(gl.DEPTH_TEST); }
}
/** 噴進來的粒子放進點精靈的緩衝（60_render.js 的 pushPt）。 */
function flPushJets(pushPt) {
  var b = 0.55 + 0.45 * WX.sun, col = [0.72 * b, 0.84 * b, 0.9 * b];
  SHIPS.forEach(function (sh) {
    var fl = sh.fl; if (!fl || !fl.J.n || sh.broken || sh.sinkingFinal || sh.sunk) return;
    var J = fl.J, M = sh.M;
    for (var i = 0; i < J.n; i++) { var o = i * 3; pushPt(M4.pt(M, J.p[o], J.p[o + 1], J.p[o + 2]), 0.12 + 0.6 * Math.cbrt(J.vol[i]), col, 0.75, -1); }
  });
}
