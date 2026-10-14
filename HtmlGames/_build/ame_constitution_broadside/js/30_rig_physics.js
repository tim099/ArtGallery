// ───────────────────────── 帆與繩的物理（可關） ─────────────────────────
// 開（PHYS）：帆是一塊布（質點＋距離約束，Verlet），被「相對風」（真風 − 船速）吹鼓 —— 轉向、頂風時帆會往另一邊鼓；
//   斷掉的繩與掉下來的帆不消失：掛在還綁著的那一端擺，整個鬆脫就往下掉，落到甲板上會停住。
//   帆被打穿：洞裡那一塊布切成布片，照同一套布的物理飄下去（34_shreds.js）。
// 關：跟以前一樣 —— 帆停在雕刻作品模擬的那一刻、斷掉的就不見。
// ⛔ 物理只管畫出來的樣子：航速、命中、帆算不算數照原本的規則（s.dead／s.furled），而且這一段不碰 rnd()
//   ⇒ 開或關，同一個種子走出同一局。
// 座標：船的格座標（跟繩與帆的資料同一套）；重力與相對風用 sh.inv 換進來（1 格 ＝ S 公尺，速度單位 格/秒）。
var WIND_SAIL = 10;           // 推帆的風速（m/s）；WIND 的大小是煙飄的速度，只共用方向。Tim 2026-10-12：7 太不明顯 ⇒ 10，再乘細節設定的風壓（WIND_K）
var GUST = [0.24, 0.12, 0.06], FLUTTER = 0.35, SLACK = 1.02;   // 陣風三個頻率的幅度、布上走過去的波紋（風壓 ±35%）、布比作品的形狀鬆 2%（鼓得深一點）
var KW = 0.05;                // 風壓：加速度（格/秒²）＝ KW ×（相對風在法線上的分量）²
var KD = 0.3, DAMP = 0.985;   // 繩的空氣阻力（1/秒）、每一步的速度保留
var SEG = 6;                  // 布與繩的迭代次數、帆幾步走一次、垂繩上限照物理分級（09_phx.js rigLv：高 ＝ 4 次、隔一步（30 Hz）、500 條）
var CACC = null, CCNT = null, PHYS_MS = 0, PROF = { cloth: 0, rope: 0, shred: 0, buf: 0 };
// 帆桁追風（物理開著才轉）：方帆桁讓帆的法線落在「相對風吹去的方向」與船頭的角平分線上，最多轉離正橫 40°（再多就頂到支索與 shroud）；
//   gaff／boom（後桅縱帆）往下風擺，帆面跟船身的夾角 ＝ (180° − 相對風角)／2，8°–80°；頂風 ±25° 內不換邊（遲滯）。每秒最多轉 8°。
//   帆的綁點、帆腳與綁在帆桁上的繩跟著轉（繩照弧長在兩端之間內插：一端綁甲板的 brace 就只有帆桁那一頭轉）。
//   ⚠ 帆桁轉了，砲彈打到帆桁的位置跟著變 ⇒ 物理開或關不再走出逐格同一局（只差在打到帆桁的那幾下）。
var BRACE_MAX = 0.70, BOOM_MIN = 0.14, BOOM_MAX = 1.40, BRACE_RATE = 0.14, BRACE_HYST = 2.7;
function braceYards(sh, wl, dt) {
  var psi = Math.atan2(wl[1], wl[0]);                                // 相對風吹去的方向（格座標、從船頭往 +y 量）：0 ＝ 正後方來的風
  if (Math.abs(psi) < BRACE_HYST || !sh.braceSide) sh.braceSide = psi >= 0 ? 1 : -1;
  sh.yards.forEach(function (m) {
    if (!m.alive) return;
    var tgt = m.yk === 'gaff' || m.yk === 'boom' ? -sh.braceSide * clamp((Math.PI - Math.abs(psi)) / 2, BOOM_MIN, BOOM_MAX)
      : Math.abs(psi) < BRACE_HYST ? clamp(psi / 2, -BRACE_MAX, BRACE_MAX) : sh.braceSide * BRACE_MAX;
    m.rot += clamp(tgt - m.r0 - m.rot, -BRACE_RATE * dt, BRACE_RATE * dt);
  });
  sh.psi = psi;
}
// 掛著的模型擺（Tim 2026-10-14：吊艇架上的小艇跟著繩子搖晃；物理開著才擺，跟帆桁追風一樣只管畫出來的樣子）：
//   單擺，轉軸 ＝ 兩條吊索上端的連線（10_ship.js hangFalls）。ψ ＝ 偏離鉛直的角度：ψ'' ＝ −(g sinψ ＋ a cosψ)／L − c ψ'，
//   a ＝ 吊點（世界）在擺動方向上的加速度（船橫搖、轉向、被打中一晃 ⇒ 擺起來）。畫出來的角度 ＝ 重力在船身座標裡的方向 ＋ ψ（船傾斜時照樣朝下）。
//   吊索跟著轉（繞同一根軸，上端在軸上不動）。最多 ±0.6 rad（再多就撞船殼）。
var SWING_DAMP = 0.35, SWING_MAX = 0.6;
function rotAxis(P, q, A, ang) {
  var c = Math.cos(ang), s = Math.sin(ang), v = sub(P, q), d = dot(A, v), x = cross(A, v);
  return [q[0] + v[0] * c + x[0] * s + A[0] * d * (1 - c), q[1] + v[1] * c + x[1] * s + A[1] * d * (1 - c), q[2] + v[2] * c + x[2] * s + A[2] * d * (1 - c)];
}
function swingHangs(sh, gv) {
  (sh.hangs || []).forEach(function (m) {
    if (!m.alive) return;
    var A = m.sax, e = norm(cross(A, [0, 0, -1])), gA = dot(gv, A), gp = sub(gv, mul(A, gA)), eq = Math.atan2(dot(gp, e), -gp[2]);
    var w = M4.pt(sh.M, m.spv[0], m.spv[1], m.spv[2]), a = 0;
    if (m.pw && m.pw2) { var ew = norm(M4.dir(sh.M, e[0], e[1], e[2])); a = clamp(dot([(w[0] - 2 * m.pw[0] + m.pw2[0]) / (DT * DT), (w[1] - 2 * m.pw[1] + m.pw2[1]) / (DT * DT), (w[2] - 2 * m.pw[2] + m.pw2[2]) / (DT * DT)], ew), -30, 30); }
    m.pw2 = m.pw; m.pw = w;
    var L = m.sL * S;
    m.psiV += (-(G * Math.sin(m.psi) + a * Math.cos(m.psi)) / L - SWING_DAMP * m.psiV) * DT; m.psi += m.psiV * DT;
    m.sw = clamp(eq + m.psi, -SWING_MAX, SWING_MAX);
    if (Math.abs(m.sw - m.swA) > 0.004) {                                // 吊索跟著轉（上端在軸上）
      m.swA = m.sw;
      m.falls.forEach(function (j) {
        var r = sh.ropes[j]; if (r.dead) return;
        var p0 = r.pts0, out = new Float32Array(p0.length);
        for (var k = 0; k < p0.length; k += 3) { var q = rotAxis([p0[k], p0[k + 1], p0[k + 2]], m.spv, A, m.sw); out[k] = q[0]; out[k + 1] = q[1]; out[k + 2] = q[2]; }
        r.pts = out; r.bb = ropeBox(out);
      });
      sh.rigDirty = true;
    }
  });
}
/** 物理關掉 ⇒ 掛著的回到作品的位置。 */
function unswingHangs(sh) { (sh.hangs || []).forEach(function (m) { m.sw = m.swA = m.psi = m.psiV = 0; m.pw = m.pw2 = null; m.falls.forEach(function (j) { var r = sh.ropes[j]; if (!r.dead) { r.pts = r.pts0; r.bb = ropeBox(r.pts); } }); }); }
/** 綁在帆桁上的繩重算形狀（帆桁轉了 0.25° 以上才算；物理關掉時 rot 歸零 ⇒ 回到作品的形狀）。 */
function yardRopes(sh, force) {
  var moved = force || sh.yards.some(function (m) { return Math.abs(m.rot - (m.rotA || 0)) > 0.004; });
  if (!moved) return;
  sh.yards.forEach(function (m) { m.rotA = m.rot; });
  sh.yRopes.forEach(function (r) {
    var A = r.ya >= 0 ? sh.models[r.ya] : null, B = r.yb >= 0 ? sh.models[r.yb] : null;
    if ((!A || !A.rot) && (!B || !B.rot)) { r.pts = r.pts0; r.bb = ropeBox(r.pts); return; }
    var p0 = r.pts0, n = p0.length / 3, acc = new Float32Array(n), tot = 0, j;
    for (j = 1; j < n; j++) { tot += Math.hypot(p0[j * 3] - p0[j * 3 - 3], p0[j * 3 + 1] - p0[j * 3 - 2], p0[j * 3 + 2] - p0[j * 3 - 1]); acc[j] = tot; }
    var out = new Float32Array(p0.length);
    for (j = 0; j < n; j++) {
      var P0 = [p0[j * 3], p0[j * 3 + 1], p0[j * 3 + 2]], t = tot > 0 ? acc[j] / tot : 0;
      var pa = A && A.rot ? rotZ(P0, A.piv, A.rot) : P0, pb = B && B.rot ? rotZ(P0, B.piv, B.rot) : P0;
      if (A && B && A === B) pb = pa;
      out[j * 3] = pa[0] * (1 - t) + pb[0] * t; out[j * 3 + 1] = pa[1] * (1 - t) + pb[1] * t; out[j * 3 + 2] = P0[2];
    }
    r.pts = out; r.bb = ropeBox(out);
  });
  sh.rigDirty = true;
}
/** 綁著的布點跟著帆桁轉（每一步都放回「作品的位置繞轉軸轉 rot」；鬆開的點交給物理）。 */
function yardPins(sh, c) {
  var T = c.T.sim, yk = T.yk; if (!yk) return;
  for (var i = 0; i < T.n; i++) {
    if (!c.pin[i] || yk[i] < 0) continue;
    var m = sh.models[yk[i]]; if (!m.rot) { if (!c.yr) continue; }
    var o = i * 3, w = rotZ([T.p0[o], T.p0[o + 1], T.p0[o + 2]], m.piv, m.rot);
    c.p[o] = c.q[o] = w[0]; c.p[o + 1] = c.q[o + 1] = w[1];
  }
  c.yr = sh.yards.some(function (m) { return m.rot; });
}
/** 一面帆的布（兩艘船共用；載入時算一次）：
 *  只留一層 —— 雕刻作品的帆是正反兩層、相差 0.11 格，兩層都畫遠看會互相打架成棋盤格；
 *  邊（距離約束）＋ 同一條格線上隔一點的兩點（跨點約束，布不會揉成一團）；
 *  外緣在轉角（> 29°）處切成幾段：筆直的那幾段是綁在帆桁／支索／斜桁上的邊（作品裡整條固定在線段上；鼓起來的自由邊不會直），
 *  綁邊上的點各自找靠的格（0.6 m 內）或繩（0.4 m 內）—— 帆桁被打掉一截，只有那一截的布鬆開；
 *  不在綁邊上的角 ＝ 帆腳：綁在帆自己的繩（sheet／tack，端點 1 m 內）、旁邊的格或繩上。
 *  hk：0 不綁、1 格、2 繩、3 找不到靠的（帆還在就綁著）、4 模型（帆桁：綁邊靠在帆桁的網格上）。
 *  sim.yk：每個綁著的粗格點跟著哪根帆桁轉（帆桁追風，見 braceYards；-1 ＝ 不轉）。 */
function clothTemplate(H, s) {                         // H：船型（帆的布模板、繩的外框在 H.cloth／H.rbox）
  var v = s.verts, tr = s.tris, nv = v.length / 3, h = nv >> 1, T = [], one = nv % 2 === 0, i, j, k;
  for (j = 0; j < tr.length; j += 3) {
    var lo = tr[j] < h;
    if ((tr[j + 1] < h) !== lo || (tr[j + 2] < h) !== lo) one = false;
    if (lo) T.push(tr[j], tr[j + 1], tr[j + 2]);
  }
  if (!one || T.length * 2 !== tr.length) { T = Array.prototype.slice.call(tr); h = nv; }
  var n = h, p0 = new Float32Array(v.slice(0, n * 3));
  function P(q) { return [p0[q * 3], p0[q * 3 + 1], p0[q * 3 + 2]]; }
  var E = new Map(), ea = [], eb = [], use = [];
  for (j = 0; j < T.length; j += 3) for (k = 0; k < 3; k++) {
    var a = T[j + k], b = T[j + (k + 1) % 3], kk = a < b ? a * 65536 + b : b * 65536 + a, e = E.get(kk);
    if (e === undefined) { e = ea.length; E.set(kk, e); ea.push(a); eb.push(b); use.push(0); }
    use[e]++;
  }
  // 外緣：只被一個三角形用到的邊，接成一圈
  var bn = []; for (i = 0; i < n; i++) bn.push([]);
  ea.forEach(function (a, e) { if (use[e] === 1) { bn[a].push(eb[e]); bn[eb[e]].push(a); } });
  var loop = [], st = -1; for (i = 0; i < n; i++) if (bn[i].length === 2) { st = i; break; }
  if (st >= 0) { var pv = -1, cu = st; do { loop.push(cu); var nx = bn[cu][0] === pv ? bn[cu][1] : bn[cu][0]; pv = cu; cu = nx; } while (cu !== st && cu !== undefined && loop.length <= n); }
  var L = loop.length, corner = [];
  for (k = 0; k < L; k++) { var A = P(loop[(k + L - 1) % L]), M = P(loop[k]), C = P(loop[(k + 1) % L]); if (dot(norm(sub(M, A)), norm(sub(C, M))) < Math.cos(0.5)) corner.push(k); }
  var hk = new Int8Array(n), hv = new Int32Array(n).fill(-1), sides = [];
  for (k = 0; k < corner.length; k++) {
    var side = [], k1 = corner[(k + 1) % corner.length];
    for (var t = corner[k]; ; t = (t + 1) % L) { side.push(loop[t]); if (t === k1 && side.length > 1) break; if (side.length > L) break; }
    var a0 = P(side[0]), a1 = P(side[side.length - 1]), ch = len(sub(a1, a0)), md = 0;
    side.forEach(function (q) { var w = P(q); md = Math.max(md, Math.sqrt(segDist2(w, a0[0], a0[1], a0[2], a1[0], a1[1], a1[2]))); });
    var bound = ch > 25 && md < 0.75;
    sides.push({ n: side.length, len: +ch.toFixed(1), dev: +md.toFixed(2), bound: bound });
    if (bound) side.forEach(function (q) { hk[q] = 3; });
  }
  function ropeNear(w, r2) {
    var best = -1, bd = r2, r = Math.sqrt(r2);
    H.rig.ropes.forEach(function (o, j2) {
      var b2 = H.rbox[j2]; if (w[0] < b2[0] - r || w[0] > b2[3] + r || w[1] < b2[1] - r || w[1] > b2[4] + r || w[2] < b2[2] - r || w[2] > b2[5] + r) return;
      for (var q = 0; q + 5 < o.pts.length; q += 3) { var d = segDist2(w, o.pts[q], o.pts[q + 1], o.pts[q + 2], o.pts[q + 3], o.pts[q + 4], o.pts[q + 5]); if (d < bd) { bd = d; best = j2; } }
    });
    return best;
  }
  for (i = 0; i < n; i++) {
    if (hk[i] !== 3) continue;
    var yw = yardNear(H, P(i), 3); if (yw >= 0) { hk[i] = 4; hv[i] = yw; continue; }   // 綁在帆桁上（帆桁改成模型之後，那裡已經沒有格）
    var w = P(i), an = anchorNear(H, w[0], w[1], w[2], 6);
    if (an >= 0) { hk[i] = 1; hv[i] = an; } else { var rp = ropeNear(w, 16); if (rp >= 0) { hk[i] = 2; hv[i] = rp; } }
  }
  var own = []; H.rig.ropes.forEach(function (r, j2) { if (sailRope(r, s.name)) own.push(j2); });   // 帆自己的 sheet、tack（10_ship.js sailRope：照 meta，沒有才照名字）
  var clews = 0, clewYard = {};                          // 帆腳 → 跟哪根帆桁轉（-1 ＝ 不轉）
  corner.forEach(function (kc) {
    var q = loop[kc]; if (hk[q]) return;
    var w = P(q), best = -1, bd = 100, end = null;
    own.forEach(function (j2) { var pts = H.rig.ropes[j2].pts; [0, pts.length - 3].forEach(function (o) { var dx = pts[o] - w[0], dy = pts[o + 1] - w[1], dz = pts[o + 2] - w[2], d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = j2; end = [pts[o], pts[o + 1], pts[o + 2]]; } }); });
    clewYard[q] = end ? yardNear(H, end, 3) : -1;        // 帆自己的 sheet 靠帆那一端在哪根帆桁上（topsail 以上：下一根帆桁的兩端）；course 的綁甲板繩栓 ⇒ 不轉（basecamp 2026-10-12）
    if (best < 0) { var an = anchorNear(H, w[0], w[1], w[2], 6); if (an >= 0) { hk[q] = 1; hv[q] = an; clews++; return; } best = ropeNear(w, 16); }
    if (best >= 0) { hk[q] = 2; hv[q] = best; clews++; }
  });
  var pins = 0; for (i = 0; i < n; i++) if (hk[i]) pins++;
  // 物理在粗格上算（規則格 ⇒ 隔一點取一點：25×25 → 13×13，約束少 4 倍）；畫的時候細格照權重從粗格內插回來
  var cg = coarseOf(n, T), sim = meshCons(cg.idx.map(P), cg.tris);
  sim.fine = cg.idx; sim.hk = new Int8Array(cg.idx.length); sim.hv = new Int32Array(cg.idx.length);
  cg.idx.forEach(function (f, ci) { sim.hk[ci] = hk[f]; sim.hv[ci] = hv[f]; });
  // 跟著哪根帆桁轉：綁邊上的點 ＝ 這面帆的帆桁（meta sail）裡離這一點最近的那根（線段：方帆桁 arm-P–arm-S、gaff／boom pivot–end）；
  //   帆腳 ＝ 它的 sheet 綁在哪根帆桁上（上面的 clewYard）。course 的帆腳綁在甲板繩栓上、不轉 ⇒ 帆桁轉了，帆頂跟著轉、帆腳留著，中間的布交給物理。
  //   ⛔ 帆腳跟著自己的帆桁轉 ⇒ course 整面被拖著轉、sheet 與 tack 也被拖離繩栓（2026-10-12 的版本）。
  var ys = []; (H.rig.models || []).forEach(function (m, k) {
    var mt = m.meta || {}, pt = m.points || {}; if (mt.kind !== 'yard' || mt.sail !== s.name || !pt.pivot) return;
    var a = pt['arm-P'] || pt.pivot, b = pt['arm-S'] || pt.end || pt.pivot; ys.push({ k: k, a: a, b: b });
  });
  sim.yk = new Int16Array(cg.idx.length).fill(-1);
  if (ys.length) cg.idx.forEach(function (f, ci) {
    if (!sim.hk[ci]) return;
    if (f in clewYard) { sim.yk[ci] = clewYard[f]; return; }
    var w = P(f), bi = -1, bd = 1e18;
    ys.forEach(function (y) { var d = segDist2(w, y.a[0], y.a[1], y.a[2], y.b[0], y.b[1], y.b[2]); if (d < bd) { bd = d; bi = y.k; } });
    sim.yk[ci] = bi;
  });
  var foot = -1; Object.keys(clewYard).forEach(function (q) { if (clewYard[q] >= 0) foot = clewYard[q]; });
  var vcol = texColors(s.texture, n);                   // 有貼圖（旗）⇒ 每個頂點照 UV 取貼圖的顏色；整面的顏色（布片、碎布）取平均
  return { name: s.name, col: vcol ? vcol.avg : s.color || [0.95, 0.92, 0.85], vcol: vcol ? vcol.c : null, n: n, p0: p0, tris: new Uint16Array(T), sim: sim, mi: cg.mi, mw: cg.mw, grid: cg.kind,
    hk: hk, hv: hv, sides: sides, pins: pins, clews: clews, foot: foot };   // foot：帆腳跟著轉的帆桁（-1 ＝ 不轉；砲彈打帆照高度內插轉角用）
}
/** 旗的貼圖（.vxk 帆的 texture：w×h 的 RGBA、base64，uv 每個頂點一對）⇒ 前 n 個頂點（正面那一份）的顏色：每個頂點取它四周一格布寬的平均（不透明的才算）。
 *  Tim 2026-10-13：夜隼號的旗變成白旗 —— 遊戲畫帆只用一個顏色，夜隼號那面旗的顏色欄是帆布白（憲法號的是紅）。沒有貼圖 ⇒ null（照舊單色）。 */
function texColors(tx, n) {
  if (!tx || !tx.rgba || !tx.uv || tx.uv.length < n * 2 || !tx.w || !tx.h) return null;
  var b = atob(tx.rgba), W = tx.w, H = tx.h, am = tx.alpha_min || 0, f = 0.5 / Math.sqrt(n), c = new Float32Array(n * 3), avg = [0, 0, 0], i;
  if (b.length < W * H * 4) return null;
  for (i = 0; i < n; i++) {
    var u = tx.uv[i * 2], v = tx.uv[i * 2 + 1], x0 = clamp(Math.floor((u - f) * W), 0, W - 1), x1 = clamp(Math.ceil((u + f) * W) - 1, x0, W - 1);
    var y0 = clamp(Math.floor((v - f) * H), 0, H - 1), y1 = clamp(Math.ceil((v + f) * H) - 1, y0, H - 1), r = 0, g = 0, bl = 0, k = 0;
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) { var o = (y * W + x) * 4; if (b.charCodeAt(o + 3) < am) continue; r += b.charCodeAt(o); g += b.charCodeAt(o + 1); bl += b.charCodeAt(o + 2); k++; }
    if (!k) { r = g = bl = 242; k = 1; }
    c[i * 3] = r / k / 255; c[i * 3 + 1] = g / k / 255; c[i * 3 + 2] = bl / k / 255; avg[0] += c[i * 3] / n; avg[1] += c[i * 3 + 1] / n; avg[2] += c[i * 3 + 2] / n;
  }
  return { c: c, avg: avg };
}
/** 一塊布的約束：邊（三角形的邊）＋ 跨點（同一條格線上隔一點的兩點，布不會揉成一團）；靜止長度 ＝ 雕刻作品那一刻的距離。 */
function meshCons(pos, T) {
  var n = pos.length, E = new Map(), ea = [], eb = [], adj = [], te = [], i, j, k;
  for (i = 0; i < n; i++) adj.push([]);
  for (j = 0; j < T.length; j += 3) for (k = 0; k < 3; k++) {
    var a = T[j + k], b = T[j + (k + 1) % 3], kk = a < b ? a * 65536 + b : b * 65536 + a, e = E.get(kk);
    if (e === undefined) { e = ea.length; E.set(kk, e); ea.push(a); eb.push(b); adj[a].push(b); adj[b].push(a); }
    te.push(e);
  }
  var B = new Set(), ba = [], bb = [];
  for (i = 0; i < n; i++) for (j = 0; j < adj[i].length; j++) for (k = j + 1; k < adj[i].length; k++) {
    var x = adj[i][j], y = adj[i][k];
    if (dot(norm(sub(pos[x], pos[i])), norm(sub(pos[y], pos[i]))) > -0.9) continue;
    var kb = x < y ? x * 65536 + y : y * 65536 + x; if (B.has(kb)) continue; B.add(kb); ba.push(x); bb.push(y);
  }
  var p0 = new Float32Array(n * 3), rest = new Float32Array(ea.length), brest = new Float32Array(ba.length);
  pos.forEach(function (w, q) { p0[q * 3] = w[0]; p0[q * 3 + 1] = w[1]; p0[q * 3 + 2] = w[2]; });
  for (i = 0; i < ea.length; i++) rest[i] = len(sub(pos[ea[i]], pos[eb[i]])) * SLACK;
  for (i = 0; i < ba.length; i++) brest[i] = len(sub(pos[ba[i]], pos[bb[i]])) * SLACK;
  return { n: n, p0: p0, tris: T, te: new Uint16Array(te), ea: new Uint16Array(ea), eb: new Uint16Array(eb), rest: rest, ba: new Uint16Array(ba), bb: new Uint16Array(bb), brest: brest };
}
/** 細格 → 粗格：方帆 N×N、三角帆（第 r 列 N−r 點）、N 是單數 ⇒ 取偶數列偶數行；其他形狀 ⇒ 不縮（粗格 ＝ 細格）。
 *  回：idx（粗格點 → 細格點）、tris（粗格三角形）、mi／mw（每個細格點由哪幾個粗格點、各佔多少內插）。 */
function coarseOf(n, T) {
  var N = Math.round(Math.sqrt(n)), M = Math.round((Math.sqrt(8 * n + 1) - 1) / 2), kind = null, off = null, i, j, k;
  function ok(rc) {
    for (j = 0; j < T.length; j += 3) for (k = 0; k < 3; k++) { var a = rc(T[j + k]), b = rc(T[j + (k + 1) % 3]); if (Math.abs(a[0] - b[0]) > 1 || Math.abs(a[1] - b[1]) > 1) return false; }
    return true;
  }
  var sq = function (q) { return [Math.floor(q / N), q % N]; };
  if (N * N === n && N % 2 && ok(sq)) kind = 'sq';
  else if (M * (M + 1) / 2 === n && M % 2) {
    off = []; for (i = 0; i <= M; i++) off.push(i * M - i * (i - 1) / 2);
    var row = new Int32Array(n); for (i = 0; i < M; i++) for (j = off[i]; j < off[i + 1]; j++) row[j] = i;
    var tr = function (q) { return [row[q], q - off[row[q]]]; };
    if (ok(tr)) { kind = 'tri'; N = M; }
  }
  var mi = new Int32Array(n * 4), mw = new Float32Array(n * 4);
  if (!kind) {
    for (i = 0; i < n; i++) { mi[i * 4] = i; mw[i * 4] = 1; }
    return { kind: 'full', idx: Array.from({ length: n }, function (_, q) { return q; }), tris: Array.prototype.slice.call(T), mi: mi, mw: mw };
  }
  var Nc = (N + 1) / 2, idx = [], ct = [], R, C;
  var offc = []; for (R = 0; R <= Nc; R++) offc.push(kind === 'sq' ? R * Nc : R * Nc - R * (R - 1) / 2);
  function rowLen(R) { return kind === 'sq' ? Nc : Nc - R; }
  function fine(r, c) { return kind === 'sq' ? r * N + c : off[r] + c; }
  function cc(r, c) { return offc[r / 2] + c / 2; }                    // 細格 (r, c)（都是偶數）在粗格的編號
  for (R = 0; R < Nc; R++) for (C = 0; C < rowLen(R); C++) idx.push(fine(2 * R, 2 * C));
  for (R = 0; R + 1 < Nc; R++) for (C = 0; C + 1 < rowLen(R); C++) {
    var a = offc[R] + C;
    if (kind === 'sq') { ct.push(a, a + 1, a + Nc + 1, a, a + Nc + 1, a + Nc); continue; }
    ct.push(a, a + 1, offc[R + 1] + C);
    if (C + 2 < rowLen(R)) ct.push(a + 1, offc[R + 1] + C + 1, offc[R + 1] + C);
  }
  for (var r = 0; r < N; r++) for (var c = 0; c < (kind === 'sq' ? N : N - r); c++) {
    var f = fine(r, c) * 4, w = [];
    if (!(r & 1) && !(c & 1)) w = [[r, c]];
    else if (!(r & 1)) w = [[r, c - 1], [r, c + 1]];
    else if (!(c & 1)) w = [[r - 1, c], [r + 1, c]];
    else w = kind === 'sq' ? [[r - 1, c - 1], [r - 1, c + 1], [r + 1, c - 1], [r + 1, c + 1]] : [[r - 1, c + 1], [r + 1, c - 1]];   // 三角帆的對角線是 (r+1, c)–(r, c+1) 那一斜
    w.forEach(function (x, q) { mi[f + q] = cc(x[0], x[1]); mw[f + q] = 1 / w.length; });
  }
  return { kind: kind, idx: idx, tris: ct, mi: mi, mw: mw };
}
function clothSetup(H, C) {                            // 船型 H 的布模板；暫存區（兩艘、各型共用）照目前最大的那一型配；C ＝ 快取的記錄（06_cache.js：rbox、cloth）
  H.rbox = C ? C.rbox : H.rig.ropes.map(function (r) { return ropeBox(r.pts); });
  H.cloth = C ? C.cloth : H.rig.sails.map(function (s) { return clothTemplate(H, s); });
  var mv = 1, mc = 1, sv = 0, si = 0;
  H.cloth.forEach(function (C) { mv = Math.max(mv, C.n); mc = Math.max(mc, C.sim.n); sv += C.n; si += C.tris.length; });
  if (!CACC || CACC.length < mc * 3) { CACC = new Float32Array(mc * 3); CCNT = new Uint8Array(mc); }
  if (!SBV || SBV.length < Math.max(1, sv) * 9) SBV = new Float32Array(Math.max(1, sv) * 9);
  if (!SBI || SBI.length < Math.max(1, si)) SBI = new Uint32Array(Math.max(1, si));
  if (!SBN || SBN.length < mv * 3) { SBN = new Float32Array(mv * 3); SBP = new Float32Array(mv * 3); }
}
/** 張開的帆從雕刻作品那一刻的形狀開始（開局、收帆後再張、物理剛打開）。 */
function clothInit(c) {
  var T = c.T.sim; c.p = Float32Array.from(T.p0); c.q = Float32Array.from(T.p0);
  c.pin = new Uint8Array(T.n); for (var i = 0; i < T.n; i++) c.pin[i] = T.hk[i] ? 1 : 0;
  c.brk = new Uint8Array(T.ea.length); c.bbrk = new Uint8Array(T.ba.length); c.tv = new Uint8Array(c.T.n); c.torn = false; c.loose = false; c.free = 0; c.gone = false; c.npin = -1;
}
/** 靠的東西還在不在：格（被打掉 ⇒ 不在）、繩（斷了）、模型（飛了）；3 ＝ 帆還算數就在。 */
function holds(sh, s, k, v) { return k === 1 ? gp(sh.grid, v) > 0 : k === 2 ? !sh.ropes[v].dead : k === 3 ? !!s && !s.dead : k === 4 ? sh.models[v].alive : false; }
function clothPins(sh, s, c) {
  var T = c.T.sim, n = 0;
  for (var i = 0; i < T.n; i++) if (c.pin[i]) { if (holds(sh, s, T.hk[i], T.hv[i])) n++; else c.pin[i] = 0; }
  c.npin = n;
}
/** 撕開：打到的那一點 r 格內的邊斷掉（布上開一個洞，大一點就裂成兩半）。r：鏈彈 7、實心與爆裂穿過 3。
 *  洞裡那一塊布不是消失：切成布片、照物理飄下去（34_shreds.js shredCut；b ＝ 砲彈）。 */
function tearCloth(sh, s, L, r, b) {
  var c = sh.cl && sh.cl[s.k]; if (!PHYS || !c || !c.p) return;
  var old = Uint8Array.from(c.tv);                                     // 撕之前藏著的（之前的洞）⇒ 只有這一發新藏的才變布片
  var T = c.T.sim, p = c.p, r2 = (r || 7) * (r || 7), bi = 0, bd = 1e9, i;
  for (i = 0; i < T.n; i++) { var dx = p[i * 3] - L[0], dy = p[i * 3 + 1] - L[1], dz = p[i * 3 + 2] - L[2], d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; bi = i; } }   // 照布現在的位置
  var cx = p[bi * 3], cy = p[bi * 3 + 1], cz = p[bi * 3 + 2];
  function near(q) { var dx = p[q * 3] - cx, dy = p[q * 3 + 1] - cy, dz = p[q * 3 + 2] - cz; return dx * dx + dy * dy + dz * dz < r2; }
  for (i = 0; i < T.ea.length; i++) if (near(T.ea[i]) || near(T.eb[i])) c.brk[i] = 1;
  for (i = 0; i < T.ba.length; i++) if (near(T.ba[i]) || near(T.bb[i])) c.bbrk[i] = 1;
  // 畫的那層：碰到斷掉約束的粗格點，從它內插的細格點都不畫（洞的邊緣多吃一圈）。
  // ⛔ 只藏彈點附近的細格點：粗格點間距約 1 m，常常只切斷一個粗格點 —— 它沒了約束一直往下掉，
  //   旁邊沒藏到的細格三角形還從它內插，被拉成一條條直到海裡的布帶（Tim 2026-10-12 截到）。
  var touch = new Uint8Array(T.n), mi = c.T.mi, mw = c.T.mw;
  for (i = 0; i < T.ea.length; i++) if (c.brk[i]) { touch[T.ea[i]] = 1; touch[T.eb[i]] = 1; }
  for (i = 0; i < c.T.n; i++) for (var k = 0; k < 4; k++) { var o = i * 4 + k; if (!mw[o]) break; if (touch[mi[o]]) { c.tv[i] = 1; break; } }
  c.torn = true;
  if (b) shredCut(sh, c, old, b);
}
function solve(ea, eb, rest, brk, p, pin, k) {
  for (var e = 0; e < ea.length; e++) {
    if (brk && brk[e]) continue;
    var a = ea[e], b = eb[e], wa = pin[a] ? 0 : 1, wb = pin[b] ? 0 : 1; if (!(wa + wb)) continue;
    var ia = a * 3, ib = b * 3, dx = p[ib] - p[ia], dy = p[ib + 1] - p[ia + 1], dz = p[ib + 2] - p[ia + 2], l = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (l < 1e-9) continue;
    var f = (l - rest[e]) / l * k / (wa + wb);
    if (wa) { p[ia] += dx * f; p[ia + 1] += dy * f; p[ia + 2] += dz * f; }
    if (wb) { p[ib] -= dx * f; p[ib + 1] -= dy * f; p[ib + 2] -= dz * f; }
  }
}
/** 落在格子裡（甲板、船殼）⇒ 退回上一步的位置（上一步本來就在格子裡的不管：繩頭從錨格裡長出來）。 */
function hitGrid(g, p, q, o) {
  if (g.get(Math.floor(p[o]), Math.floor(p[o + 1]), Math.floor(p[o + 2])) && !g.get(Math.floor(q[o]), Math.floor(q[o + 1]), Math.floor(q[o + 2]))) { p[o] = q[o]; p[o + 1] = q[o + 1]; p[o + 2] = q[o + 2]; }
}
function clothStep(sh, c, wl, gv) {                    // c.kw：風壓倍率（帆的布片，34_shreds.js；帆 ＝ 1）；c.ev：這一塊幾步走一次（遠方的船放大，physStep）
  var T = c.T.sim, n = T.n, p = c.p, q = c.q, pin = c.pin, tr = T.tris, A = CACC, N = CCNT, HC = (c.ev || rigLv().every) * DT, dt2 = HC * HC, inv = 1 / (3 * HC), dmp = DAMP * DAMP, kw = KW * (c.kw || 1), i, j, x;
  A.fill(0, 0, n * 3); N.fill(0, 0, n);
  for (j = 0; j < tr.length; j += 3) {           // 風壓：每個三角形沿法線推，大小 ∝（相對風在法線上的分量）²，相對風扣掉布自己的速度
    if (c.torn && (c.brk[T.te[j]] || c.brk[T.te[j + 1]] || c.brk[T.te[j + 2]])) continue;
    var a = tr[j] * 3, b = tr[j + 1] * 3, d = tr[j + 2] * 3;
    var ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[d] - p[a], vy = p[d + 1] - p[a + 1], vz = p[d + 2] - p[a + 2];
    var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (l < 1e-9) continue;
    nx /= l; ny /= l; nz /= l;
    var rx = wl[0] - (p[a] - q[a] + p[b] - q[b] + p[d] - q[d]) * inv, ry = wl[1] - (p[a + 1] - q[a + 1] + p[b + 1] - q[b + 1] + p[d + 1] - q[d + 1]) * inv, rz = wl[2] - (p[a + 2] - q[a + 2] + p[b + 2] - q[b + 2] + p[d + 2] - q[d + 2]) * inv;
    var dn = rx * nx + ry * ny + rz * nz, f = kw * dn * Math.abs(dn);
    f *= 1 + FLUTTER * Math.sin((p[a] * 0.9 + p[a + 2]) * 0.06 - SIMT * 5.5);   // 一道一道走過布面的風（不抽亂數）
    var fx = f * nx, fy = f * ny, fz = f * nz;
    A[a] += fx; A[a + 1] += fy; A[a + 2] += fz; A[b] += fx; A[b + 1] += fy; A[b + 2] += fz; A[d] += fx; A[d + 1] += fy; A[d + 2] += fz;
    N[a / 3]++; N[b / 3]++; N[d / 3]++;
  }
  for (i = 0; i < n; i++) {
    if (pin[i]) continue;
    var o = i * 3, kk = N[i] ? 1 / N[i] : 0;
    for (x = 0; x < 3; x++) { var cur = p[o + x], vel = (cur - q[o + x]) * dmp; q[o + x] = cur; p[o + x] = cur + vel + (A[o + x] * kk + gv[x]) * dt2; }
    if (c.loose) hitGrid(sh.grid, p, q, o);
  }
  for (var it = 0, itn = rigLv().it; it < itn; it++) { solve(T.ea, T.eb, T.rest, c.torn ? c.brk : null, p, pin, 1); if (it & 1) solve(T.ba, T.bb, T.brest, c.torn ? c.bbrk : null, p, pin, 0.5); }
}
/** 剛斷的繩 ⇒ 垂下來的繩：重新取樣（每段 ≤ SEG 格，原本的弧度與鬆緊照留），兩端各記著靠什麼；被打斷的從斷點分成兩段。 */
function spawnLoose(sh, r) {
  var src = r.pts, m = src.length / 3, P = [], i, t;
  for (i = 0; i + 1 < m; i++) {
    var a = [src[i * 3], src[i * 3 + 1], src[i * 3 + 2]], b = [src[i * 3 + 3], src[i * 3 + 4], src[i * 3 + 5]], k = Math.max(1, Math.ceil(len(sub(b, a)) / SEG));
    for (t = 0; t < k; t++) P.push(lerp3(a, b, t / k));
  }
  P.push([src[m * 3 - 3], src[m * 3 - 2], src[m * 3 - 1]]);
  function end(an, mk, pr) { return an >= 0 ? [1, an] : mk !== undefined ? [4, mk] : pr !== undefined ? [2, pr] : [0, -1]; }
  var ea = end(r.a, r.ma, r.pa), eb = end(r.b, r.mb, r.pb), parts = [[P, ea, eb]];
  if (r.cutL) {
    var bi = 0, bd = 1e9;
    for (i = 0; i + 1 < P.length; i++) { var d = segDist2(r.cutL, P[i][0], P[i][1], P[i][2], P[i + 1][0], P[i + 1][1], P[i + 1][2]); if (d < bd) { bd = d; bi = i; } }
    parts = [[P.slice(0, bi + 1), ea, [0, -1]], [P.slice(bi + 1), [0, -1], eb]];
  }
  parts.forEach(function (pt) {
    var Q = pt[0], n = Q.length; if (n < 2) return;
    var p = new Float32Array(n * 3), rest = new Float32Array(n - 1);
    Q.forEach(function (w, j) { p[j * 3] = w[0]; p[j * 3 + 1] = w[1]; p[j * 3 + 2] = w[2]; if (j) rest[j - 1] = len(sub(w, Q[j - 1])); });
    var o = { p: p, q: Float32Array.from(p), rest: rest, n: n, pin: new Uint8Array(n), hk: [pt[1][0], pt[2][0]], hv: [pt[1][1], pt[2][1]], col: r.col, free: 0 };
    o.pin[0] = o.hk[0] ? 1 : 0; o.pin[n - 1] = o.hk[1] ? 1 : 0;
    ropePins(sh, o); sh.loose.push(o);
  });
  if (sh.loose.length > rigLv().loose) {                                  // 太多 ⇒ 先丟已經整條鬆掉的，再丟最早的
    var drop = sh.loose.findIndex(function (o) { return !o.pin[0] && !o.pin[o.n - 1]; });
    sh.loose.splice(drop >= 0 ? drop : 0, 1);
  }
}
function ropePins(sh, o) {
  if (o.pin[0] && !holds(sh, null, o.hk[0], o.hv[0])) o.pin[0] = 0;
  if (o.pin[o.n - 1] && !holds(sh, null, o.hk[1], o.hv[1])) o.pin[o.n - 1] = 0;
}
function ropeStep(sh, o, wl, gv, dt) {                 // dt：這一次走多久（遠方的船 ＝ 幾步一次 × DT；沒給 ＝ DT）
  dt = dt || DT;
  var p = o.p, q = o.q, n = o.n, pin = o.pin, dt2 = dt * dt, dmp = dt === DT ? DAMP : Math.pow(DAMP, dt / DT), i, x;
  for (i = 0; i < n; i++) {
    if (pin[i]) continue;
    var j = i * 3;
    for (x = 0; x < 3; x++) { var cur = p[j + x], vel = (cur - q[j + x]) * dmp; q[j + x] = cur; p[j + x] = cur + vel + (gv[x] + KD * (wl[x] - vel / dt)) * dt2; }
    hitGrid(sh.grid, p, q, j);
  }
  for (var it = 0, itn = rigLv().it; it < itn; it++) for (i = 0; i + 1 < n; i++) {
    var wa = pin[i] ? 0 : 1, wb = pin[i + 1] ? 0 : 1; if (!(wa + wb)) continue;
    var ia = i * 3, ib = ia + 3, dx = p[ib] - p[ia], dy = p[ib + 1] - p[ia + 1], dz = p[ib + 2] - p[ia + 2], l = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (l < 1e-9) continue;
    var f = (l - o.rest[i]) / l / (wa + wb);
    if (wa) { p[ia] += dx * f; p[ia + 1] += dy * f; p[ia + 2] += dz * f; }
    if (wb) { p[ib] -= dx * f; p[ib + 1] -= dy * f; p[ib + 2] -= dz * f; }
  }
}
function underWater(sh, p, i) { var w = M4.pt(sh.M, p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); return w[1] < seaH(w[0], w[2], SIMT) - 0.5; }
/** 每一步：相對風與重力換進船的格座標 → 剛斷的繩變成垂下來的繩 → 每面帆、每條垂下來的繩各走一步；每 0.1 秒量一次靠的東西還在不在。 */
// ── 遠方的船帆與繩降速（Tim 2026-10-14：「可以設定降速模擬，特別是遠方船隻」）──
// 物理設定「遠方帆繩」；每艘每一步照離鏡頭多遠、在不在視野裡給倍率 m（1 ＝ 照常）：
//   布：每 every × m 步走一次（時間間隔跟著放大；最多 RIG_FAR_HC 秒 ⇒ Verlet 的布步長太大會炸開，m 照它截）；垂下來的繩：每 m 步走一次、dt ＝ m × DT。
//   這一段本來就只管畫出來的樣子（不碰 rnd()、不改命中）⇒ 開關不改戰局。鏡頭還沒算過（快轉、無頭對拍）⇒ 照常。
var RIG_FAR = [null, { d1: 150, m1: 2, d2: 1e9, m2: 2, off: 2 }, { d1: 100, m1: 2, d2: 200, m2: 3, off: 4 }], RIG_FAR_HC = 0.1;
function rigFarM(sh) {
  var F = RIG_FAR[PHX.rigfar], e = CAM.eye, vp = CAM.vp; if (!F || !e || !vp) return 1;
  var B = sh.T.base, R = 0.5 * S * Math.hypot(B.sx, B.sy, B.sz), c = M4.pt(sh.M, B.sx / 2, B.sy / 2, B.sz / 2), d = Math.hypot(c[0] - e[0], c[1] - e[1], c[2] - e[2]);
  var m = d > F.d2 ? F.m2 : d > F.d1 ? F.m1 : 1, cw = vp[3] * c[0] + vp[7] * c[1] + vp[11] * c[2] + vp[15], vis = d < R;
  if (!vis && cw > 0.1) { var k = 1 + 2 * R / cw, x = (vp[0] * c[0] + vp[4] * c[1] + vp[8] * c[2] + vp[12]) / cw, y = (vp[1] * c[0] + vp[5] * c[1] + vp[9] * c[2] + vp[13]) / cw; vis = Math.abs(x) < k && Math.abs(y) < k; }   // 外接球大概碰到畫面
  return vis ? m : Math.max(m, F.off);
}
function physStep(sh) {
  var W = norm(WIND), ws = WIND_SAIL * WIND_K * (1 + GUST[0] * Math.sin(SIMT * 0.9 + sh.phase) + GUST[1] * Math.sin(SIMT * 2.7 + 1.3) + GUST[2] * Math.sin(SIMT * 6.1 + sh.phase * 2)) * WX.wind * WIND_SPD;   // 陣風（不用亂數）；天氣：暴風雨 ×2.2；風速會變（08_weather.js）
  var wl = M4.dir(sh.inv, W[0] * ws - sh.vel[0], W[1] * ws - sh.vel[1], W[2] * ws - sh.vel[2]), gv = M4.dir(sh.inv, 0, -G, 0);
  var si = Math.round(SIMT / DT), chk = si % 6 === 0, i, ev = rigLv().every, m = sh.rigM = rigFarM(sh), evk = ev * Math.max(1, Math.min(m, Math.floor(RIG_FAR_HC / (ev * DT) + 1e-6)));   // evk：布幾步走一次（遠方放大）
  if (sh.yards.length) { braceYards(sh, wl, DT); if (chk) yardRopes(sh); }
  if (sh.hangs) swingHangs(sh, gv);
  for (i = 0; i < sh.ropes.length; i++) { var r = sh.ropes[i]; if (r.dead && !r.lz) { r.lz = true; if (!r.moved) spawnLoose(sh, r); } }
  sh.sails.forEach(function (s, k) {
    var c = sh.cl[k];
    if (c.gone) return;
    if (s.dead && !c.loose) {                                         // 物理打開之前就掉了的（late）⇒ 現在才垂下來；收著的時候掉的 ⇒ 不畫
      if (!c.late || s.furled) { c.gone = true; return; }
      clothInit(c); c.hidden = false; c.loose = true;
    }
    c.late = false;
    if (s.furled && !s.dead) { c.hidden = true; return; }
    if (c.hidden || !c.p) { var keep = c.p && c.torn ? { brk: c.brk, bbrk: c.bbrk, tv: c.tv } : null; clothInit(c); c.hidden = false; if (keep) { c.brk = keep.brk; c.bbrk = keep.bbrk; c.tv = keep.tv; c.torn = true; } }   // 收帆再張：形狀重來、破洞留著
    if (chk || c.npin < 0) clothPins(sh, s, c);
    yardPins(sh, c);
    c.ev = evk;
    if ((si + k + sh.i + 1) % evk === 0) { var t0 = DEBUG ? performance.now() : 0; clothStep(sh, c, wl, gv); if (DEBUG) PROF.cloth += performance.now() - t0; }
    if (chk && c.loose && !c.npin) { c.free += 0.1; if (c.free > 12 || underWater(sh, c.p, 0) && underWater(sh, c.p, c.T.sim.n >> 1)) c.gone = true; }
  });
  for (i = 0; i < sh.loose.length; i++) {
    var o = sh.loose[i];
    if (chk) {
      ropePins(sh, o);
      if (!o.pin[0] && !o.pin[o.n - 1]) { o.free += 0.1; if (o.free > 15 || underWater(sh, o.p, 0) && underWater(sh, o.p, o.n - 1)) { sh.loose.splice(i--, 1); continue; } }
    }
    if (m > 1 && (si + i + sh.i) % m) continue;                          // 遠方：每 m 步走一次
    var t1 = DEBUG ? performance.now() : 0; ropeStep(sh, o, wl, gv, m * DT); if (DEBUG) PROF.rope += performance.now() - t1;
  }
  var t2 = DEBUG ? performance.now() : 0; shredStep(sh, wl, gv, si, chk); if (DEBUG) PROF.shred += performance.now() - t2;   // 帆的布片（34_shreds.js）
}
/** 開關物理（選單、B 鍵、下方按鈕）：開 ⇒ 帆從雕刻作品那一刻的形狀開始動；之前就斷掉的繩、掉下來的帆也垂下來
 *  （被斷開的那一團帶走的、一開始就不畫的除外）。關 ⇒ 回到靜態。 */
function setPhys(on) {
  PHYS = on;
  if (on && !PHX.rig) PHX.rig = PHX_RIG_LAST; else if (!on && PHX.rig) { PHX_RIG_LAST = PHX.rig; PHX.rig = 0; }   // 物理分級的「帆與繩」跟著走（09_phx.js）
  $('physT').classList.toggle('on', on); if (typeof phxShow === 'function' && $('phxB')) phxShow();
  SHIPS.forEach(function (sh) {
    sh.loose = []; sh.shreds = [];
    if (!on) { (sh.yards || []).forEach(function (m) { m.rot = 0; }); if (sh.yRopes) yardRopes(sh, true); unswingHangs(sh); }   // 關 ⇒ 帆桁回到作品的角度、小艇不擺
    sh.ropes.forEach(function (r) { r.lz = !!(r.never || r.moved); });
    sh.cl.forEach(function (c, k) { c.p = null; c.hidden = true; c.loose = false; c.torn = false; c.gone = !!c.moved; c.late = sh.sails[k].dead; });
    sh.rigDirty = true;
  });
  if (RUNNING && SHIPS.length) note(SHIPS[PLAYER_I], on ? '帆與繩的物理：開（帆被風吹鼓、斷掉的會垂下來）' : '帆與繩的物理：關（靜態）');
}

