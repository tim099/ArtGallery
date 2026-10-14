// ───────────────────────── 預備水手（缺人手時補位；平常在水線下的甲板待命，也會上別層甲板走動） ─────────────────────────
// Tim 2026-10-13：通用水手待在水線下的甲板待命，缺人手時補上；也可以在其他甲板遊蕩。
// 補哪些位：砲班（每層、每一舷補回開戰時的人數；砲沒了就少補）、送藥手（每層補回開戰時的人數）、舵手（舵輪還在）。交戰的那一舷先補。
//   每半秒（survey）點一次名：缺幾個就派幾個最近的閒著的水手；走到那一層甲板（爬完梯子那一刻）就換成那個職位，
//   之後照原本的調度走（砲班 reassign、送藥手 stepMonkey）；舵手先走到倒下那位的站位再換。
// 梯子照模型的 meta（basecamp：關聯 meta kind=ladders，固定點 <梯名>.foot／lo／hi／head ＝ 腳踩的那一格）：
//   走到 foot → 沿 lo、hi 爬 → 在 head 下梯；一座梯子一次上一個人（前一個爬了 LADDER_GAP 秒，下一個才上）。
//   沒有梯子的 meta（舊的 .vxk）⇒ 預備水手待在最下層的砲甲板，只補那一層。
// 走得到的甲板 ＝ 砲甲板（sh.decks）＋梯子的一頭落在砲甲板以外的高度（憲法號：住艙甲板，地板在設計水線下 0.3 m）；待命 ＝ 最下面那層。
// 走路格：每層每 NAV_C 格一點，站得住（頭上 1.2 m 空）、不在砲與舵輪裡、跟最大那一片連得通（相鄰高低差 ≤ NAV_DZ：憲法號砲甲板 x 570 有一階 0.3 m，⛔ 2 格 ⇒ 前段整片接不上）；
//   找路 ＝ 走路格上的 BFS 再拉直。
//   ⛔ 走路格只照開戰時的船：甲板被打穿照樣走過去（跟砲班換砲一樣），站著不動時腳下沒了才掉（survey）。
// 一個人物 ＝ 一個預備水手（數量在細節設定，0 ＝ 沒有）；開戰時的人數算進 crew0（降旗的死傷 % 跟著算）。
var NAV_C = 2, NAV_HEAD = 12, NAV_DZ = 3, HAND_SP = [11, 20], CLIMB_SP = [6, 9], LADDER_GAP = 0.9, HAND_PATHS = 2, HAND_ROAM = 0.25, HAND_BACK = 0.6, CLIMB_LIFT = 2;
var NAV_DX = [1, -1, 0, 0, 1, 1, -1, -1], NAV_DY = [0, 0, 1, -1, 1, -1, 1, -1];
/** 梯子：關聯 meta kind=ladders 的固定點 <梯名>.foot／lo／hi／head（格中心）⇒ [{ name, pts }]（站位座標：x、y 照格中心，z ＝ 腳踩的那一格；foot 在下）。 */
function shipLadders(T) {
  var out = [];
  (T.h.parts || []).forEach(function (p) {
    if (!p.meta || (p.meta.kind !== 'ladders' && p.meta.kind !== 'ladder')) return;
    var by = {};
    Object.keys(p.points || {}).forEach(function (k) {
      var i = k.lastIndexOf('.'), nm = i < 0 ? '' : k.slice(0, i), w = i < 0 ? k : k.slice(i + 1), v = p.points[k];
      (by[nm] = by[nm] || {})[w] = [v[0], v[1], Math.floor(v[2])];
    });
    Object.keys(by).forEach(function (nm) {
      var b = by[nm]; if (!b.foot || !b.head) return;
      var pts = [b.foot, b.lo, b.hi, b.head].filter(Boolean); if (b.foot[2] > b.head[2]) pts.reverse();
      out.push({ name: (p.path || '') + (nm ? '/' + nm : ''), pts: pts });
    });
  });
  return out;
}
function lvOf(Ls, z) { for (var i = 0; i < Ls.length; i++) if (z >= Ls[i].zr[0] && z <= Ls[i].zr[1]) return i; return -1; }
/** 走得到的甲板（由下往上）：砲甲板＋梯子一頭落在砲甲板以外的高度（相差 8 格內併成一層，上下各留 5 格的舷弧，不蓋到砲甲板）。 */
function navLevels(sh, lads) {
  var Ls = sh.decks.map(function (D) { return { key: D.key, name: D.name, zr: D.zr }; }), ext = [];
  lads.forEach(function (l) {
    [l.pts[0], l.pts[l.pts.length - 1]].forEach(function (p) {
      if (lvOf(Ls, p[2]) >= 0) return;
      var e = ext.filter(function (e) { return p[2] >= e[0] - 8 && p[2] <= e[1] + 8; })[0];
      if (e) { e[0] = Math.min(e[0], p[2]); e[1] = Math.max(e[1], p[2]); } else ext.push([p[2], p[2]]);
    });
  });
  var low = Ls.length ? Ls[0].zr[0] : 1e9;
  ext.forEach(function (e, i) {
    var zr = [e[0] - 5, e[1] + 5];
    Ls.forEach(function (L) { if (L.zr[0] > e[1] && zr[1] >= L.zr[0]) zr[1] = L.zr[0] - 1; if (L.zr[1] < e[0] && zr[0] <= L.zr[1]) zr[0] = L.zr[1] + 1; });
    Ls.push({ key: 'h' + i, name: e[1] < low ? '住艙甲板' : '甲板（z ' + e[0] + '）', zr: zr });
  });
  return Ls.sort(function (a, b) { return a.zr[0] - b.zr[0]; });
}
/** a 往 d 方向走一格 ⇒ 那一格（站不住、高低差太大、斜走切到角 ⇒ -1）。邊上一圈一定站不住 ⇒ 不用另外查界。 */
function navStep(N, a, d) {
  var Z = N.Z, b = a + NAV_DX[d] + NAV_DY[d] * N.nx;
  if (Z[b] < 0 || Math.abs(Z[b] - Z[a]) > NAV_DZ) return -1;
  if (d >= 4 && (Z[a + NAV_DX[d]] < 0 || Z[a + NAV_DY[d] * N.nx] < 0)) return -1;
  return b;
}
/** 一層的走路格（照船型與那一層的高度記在 T 上：兩艘同型共用、重開一場不重算）。 */
function navBuild(sh, L) {
  var T = sh.T, g = T.base, C = T.navC || (T.navC = {}), key = L.zr.join(',') + ':' + sh.models.length;
  if (C[key]) return C[key];
  var x0 = Math.max(0, T.hx0 - 4), nx = Math.ceil((Math.min(g.sx, T.hx1 + 5) - x0) / NAV_C) + 1, ny = Math.ceil(g.sy / NAV_C), n = nx * ny, i, x, y;
  var Z = new Int16Array(n).fill(-1);
  for (y = 1; y < ny - 1; y++) for (x = 1; x < nx - 1; x++) {
    var gx = x0 + x * NAV_C, gy = y * NAV_C; if (gx >= g.sx || gy >= g.sy) continue;
    var z = standZ(g, gx, gy, L.zr[0], L.zr[1], NAV_HEAD);
    if (z >= 0 && !blocked(gx, gy, z)) Z[x + y * nx] = z;
  }
  var N = { x0: x0, nx: nx, ny: ny, Z: Z }, comp = new Int32Array(n).fill(-1), q = new Int32Array(n), best = -1, bestN = 0, nc = 0;   // 連通（8 鄰）；留最大那一片
  for (i = 0; i < n; i++) {
    if (Z[i] < 0 || comp[i] >= 0) continue;
    var h = 0, t = 0; q[t++] = i; comp[i] = nc;
    while (h < t) { var a = q[h++]; for (var d = 0; d < 8; d++) { var b = navStep(N, a, d); if (b >= 0 && comp[b] < 0) { comp[b] = nc; q[t++] = b; } } }
    if (t > bestN) { bestN = t; best = nc; }
    nc++;
  }
  var ok = new Uint8Array(n), cells = new Int32Array(bestN), k = 0;
  for (i = 0; i < n; i++) if (comp[i] === best) { ok[i] = 1; cells[k++] = i; }
  N.ok = ok; N.cells = cells; N.parts = nc;
  return C[key] = N;
}
function navCell(N, p) { var x = Math.round((p[0] - 0.5 - N.x0) / NAV_C), y = Math.round((p[1] - 0.5) / NAV_C); return x < 0 || y < 0 || x >= N.nx || y >= N.ny ? -1 : x + y * N.nx; }
function navPos(N, i) { return [N.x0 + (i % N.nx) * NAV_C + 0.5, ((i / N.nx) | 0) * NAV_C + 0.5, N.Z[i]]; }
/** p 附近 r 點內、連得通的最近那一點（高度差一格 ＝ 遠 8 點的平面距離²；4 格以上最後才挑）；沒有 ⇒ -1。
 *  ⛔ 只看平面距離 ⇒ 梯子 head（甲板 z 82）吸到旁邊艙口圍欄的頂上（z 85），人下梯往上跳一下。 */
function navSnap(N, p, r) {
  var cx = Math.round((p[0] - 0.5 - N.x0) / NAV_C), cy = Math.round((p[1] - 0.5) / NAV_C), best = -1, bd = 1e9;
  for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
    var x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= N.nx || y >= N.ny) continue;
    var i = x + y * N.nx; if (!N.ok[i]) continue;
    var dz = Math.abs(N.Z[i] - p[2]), d = dx * dx + dy * dy + dz * 8 + (dz > 3 ? 1e4 : 0); if (d < bd) { bd = d; best = i; }
  }
  return best;
}
var NQ = null, NP = null, NV = null, NSTAMP = 0;
/** 走路格上 a → b 的路（BFS，8 鄰）；走不到 ⇒ null。 */
function navPath(N, a, b) {
  var n = N.nx * N.ny, u, v, d;
  if (!NQ || NQ.length < n) { NQ = new Int32Array(n); NP = new Int32Array(n); NV = new Uint32Array(n); NSTAMP = 0; }
  var s = ++NSTAMP, h = 0, t = 0; NQ[t++] = a; NV[a] = s; NP[a] = -1;
  while (h < t) {
    u = NQ[h++]; if (u === b) break;
    for (d = 0; d < 8; d++) { v = navStep(N, u, d); if (v >= 0 && N.ok[v] && NV[v] !== s) { NV[v] = s; NP[v] = u; NQ[t++] = v; } }
  }
  if (NV[b] !== s) return null;
  var p = []; for (u = b; u >= 0; u = NP[u]) p.push(u);
  return p.reverse();
}
/** a、b 之間直直走過去，每一點都連得通？ */
function navSee(N, a, b) {
  var nx = N.nx, ax = a % nx, ay = (a / nx) | 0, bx = b % nx, by = (b / nx) | 0, n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 2, prev = a;
  for (var k = 1; k <= n; k++) {
    var c = Math.round(ax + (bx - ax) * k / n) + Math.round(ay + (by - ay) * k / n) * nx; if (c === prev) continue;
    if (!N.ok[c] || Math.abs(N.Z[c] - N.Z[prev]) > NAV_DZ) return false;
    var dx = c % nx - prev % nx, dy = ((c / nx) | 0) - ((prev / nx) | 0);
    if (dx && dy && (!N.ok[prev + dx] || !N.ok[prev + dy * nx])) return false;
    prev = c;
  }
  return true;
}
/** 拉直：從每一點往前找看得到的最遠那一點（最多往前 80 點）。 */
function navSmooth(N, p) {
  var out = [p[0]], i = 0;
  while (i < p.length - 1) {
    var j = Math.min(p.length - 1, i + 80);
    while (j > i + 1 && !navSee(N, p[i], p[j])) j--;
    out.push(p[j]); i = j;
  }
  return out;
}
/** 層 a → 層 b 經過哪幾層（梯子連著的才算；走不到 ⇒ null）。 */
function lvPath(H, a, b) {
  var prev = {}, q = [a]; prev[a] = -1;
  while (q.length) {
    var u = q.shift(); if (u === b) break;
    H.ladders.forEach(function (L) { var v = L.lo === u ? L.hi : L.hi === u ? L.lo : -1; if (v >= 0 && !(v in prev)) { prev[v] = u; q.push(v); } });
  }
  if (!(b in prev)) return null;
  var p = []; for (var u = b; u >= 0; u = prev[u]) p.push(u);
  return p.reverse();
}
/** 從 from 層（x）去 to 層（目的地 tx）的走法：每換一層 ＝ 走到梯子那一頭＋爬；梯子挑「走過去＋從那裡再走＋排在前面的人」最短的那座
 *  （L.q：路上要爬這座的人數，一個人 ＝ 等 LADDER_GAP 秒 ⇒ 換算成跑得到的格數；⛔ 不算 ⇒ 開戰第一輪 26 個人全擠後梯子，10 秒只補上 2 個）。 */
function handRoute(sh, from, to, x, tx) {
  var H = sh.nav, path = lvPath(H, from, to); if (!path) return null;
  var legs = [];
  for (var i = 0; i + 1 < path.length; i++) {
    var a = path[i], b = path[i + 1], best = -1, bd = 1e9;
    H.ladders.forEach(function (L, k) { if ((L.lo === a && L.hi === b) || (L.lo === b && L.hi === a)) { var d = Math.abs(x - L.x) + Math.abs(L.x - tx) + L.q * LADDER_GAP * HAND_SP[1]; if (d < bd) { bd = d; best = k; } } });
    var L = H.ladders[best], up = L.lo === a;
    legs.push({ w: a, to: up ? L.ia : L.ib }, { c: best, up: up }); x = L.x; L.q++;
  }
  return legs;
}
/** 開戰時：建走路格、接梯子、記各職位開戰時的人數（補到這個數），在待命那一層生 HANDS 個預備水手（彼此隔 3 點以上）。 */
function makeHands(sh, crew, add) {
  sh.nav = null;
  if (HANDS <= 0 && DROWN_T <= 0) return;                               // 落水的人爬回船上也要走路格（43_swim.js board）
  var t0 = performance.now(), lads = shipLadders(sh.T), Ls = navLevels(sh, lads), LD = [];
  Ls.forEach(function (L) { L.N = navBuild(sh, L); });
  lads.forEach(function (l) {
    var a = l.pts[0], b = l.pts[l.pts.length - 1], la = lvOf(Ls, a[2]), lb = lvOf(Ls, b[2]);
    if (la < 0 || lb < 0 || la === lb) return;
    var ia = navSnap(Ls[la].N, a, 5), ib = navSnap(Ls[lb].N, b, 5); if (ia < 0 || ib < 0) return;   // 兩頭接不上走路格（10 格內）⇒ 這座不用
    var mid = l.pts.slice(1, -1).map(function (q) { return [q[0], q[1], q[2] + CLIMB_LIFT]; });   // lo、hi 抬 0.2 m：兩點連線會切過踏板的前緣（量過：腳在踏板裡 24／71 點 ⇒ 10）
    LD.push({ name: l.name, lo: la, hi: lb, ia: ia, ib: ib, pts: [navPos(Ls[la].N, ia), a].concat(mid, [b, navPos(Ls[lb].N, ib)]), x: (a[0] + b[0]) / 2, t0: -9, n: 0, q: 0 });
  });
  var home = -1;
  LD.forEach(function (L) { if (home < 0 || L.lo < home) home = L.lo; });
  if (home < 0) home = lvOf(Ls, sh.decks.length ? sh.decks[0].zr[0] : 0);
  if (home < 0) return;
  var H = sh.nav = { levels: Ls, ladders: LD, home: home, reach: [], gun0: {}, pm0: {}, helm0: 0, called: 0, joined: 0, ms: 0 };
  Ls.forEach(function (L, i) { if (lvPath(H, home, i)) H.reach.push(i); });
  crew.forEach(function (c) {
    if (c.role === ROLE.GUN) H.gun0[c.deck + c.side] = (H.gun0[c.deck + c.side] || 0) + 1;
    else if (c.role === ROLE.POWDER) H.pm0[c.deck] = (H.pm0[c.deck] || 0) + 1;
    else if (c.role === ROLE.HELM) H.helm0++;
  });
  var N = Ls[home].N, used = [];
  var NH = Math.round(HANDS * sh.T.crew.handsK);                      // 船員配置的倍率（config/game.json crew；夜隼號 ¼：小船）
  if (N.cells.length) for (var k = 0; k < NH; k++) {
    var i = -1;
    for (var tries = 0; tries < 12; tries++) {
      i = N.cells[(rnd() * N.cells.length) | 0];
      var ix = i % N.nx, iy = (i / N.nx) | 0;
      if (!used.some(function (u) { return Math.abs(u % N.nx - ix) < 3 && Math.abs(((u / N.nx) | 0) - iy) < 3; })) break;
    }
    used.push(i);
    add(ROLE.HAND, navPos(N, i), null, rnd() < 0.5 ? 1 : -1);
    var c = crew[crew.length - 1]; c.art = ROLE.GUN; c.deck = Ls[home].key; c.hand = { lv: home, wait: rr(0, 6), legs: [], wp: null, k: 0, climb: null, job: null, to: null };
  }
  H.ms = performance.now() - t0;
}
/** 每一步：爬梯子、照路走、出發下一段、到了就補位；閒著 ⇒ 站一會兒再走去別處（待命那一層多、偶爾上別層）。 */
function stepHand(sh, c, dt) {
  var H = c.hand, NV = sh.nav, fast = H.job ? 1 : 0;
  if (H.climb) {                                                         // 爬：沿 foot → lo → hi → head 一段一段走（三維）
    var P = H.climb.pts, to = P[H.climb.k], d = sub(to, c.pos), l = len(d), s = CLIMB_SP[fast] * dt;
    c.moving = true; H.to = to;
    if (l <= s) {
      c.pos = to.slice();
      if (++H.climb.k >= P.length) {
        H.lv = H.climb.lv; c.deck = NV.levels[H.lv].key; H.climb = null; c.moving = false;
        if (c.backRole !== undefined) { c.role = c.backRole; c.backRole = undefined; c.hand = null; c.home = c.pos.slice(); }   // 爬回船上的軍官、陸戰隊（43_swim.js board）：回原職
      }
    }
    else c.pos = add(c.pos, mul(d, s / l));
    return;
  }
  if (H.wp) {                                                            // 走：照拉直過的路一點一點走，高度跟著甲板
    var w = H.wp[H.k], dx = w[0] - c.pos[0], dy = w[1] - c.pos[1], dl = Math.hypot(dx, dy), st = HAND_SP[fast] * dt;
    c.moving = true; H.to = w;
    if (dl <= st) { c.pos = w.slice(); if (++H.k >= H.wp.length) { H.wp = null; c.moving = false; c.home = c.pos.slice(); } return; }
    c.pos[0] += dx / dl * st; c.pos[1] += dy / dl * st;
    var N = NV.levels[H.lv].N, ci = navCell(N, c.pos); if (ci >= 0 && N.Z[ci] >= 0) c.pos[2] = N.Z[ci];
    return;
  }
  c.moving = false;
  if (H.legs.length) { legStart(sh, c); return; }
  if (H.job) { handJoin(sh, c); return; }
  if (sh.struck || sh.sunk || (H.wait -= dt) > 0) return;
  wander(sh, c);
}
/** 出發下一段：走（要一次找路的額度，每艘每步 HAND_PATHS 次）或爬（梯子空出來才上）。走不到 ⇒ 整段作廢、站一會兒。 */
function legStart(sh, c) {
  var H = c.hand, NV = sh.nav, leg = H.legs[0];
  if (leg.c !== undefined) {
    var L = NV.ladders[leg.c]; if (SIMT - L.t0 < LADDER_GAP) return;
    L.t0 = SIMT; L.n++; L.q = Math.max(0, L.q - 1); H.legs.shift();
    H.climb = { pts: leg.up ? L.pts : L.pts.slice().reverse(), k: 0, lv: leg.up ? L.hi : L.lo };
    return;
  }
  if (sh.navN <= 0) return;
  sh.navN--;
  var N = NV.levels[leg.w].N, a = navSnap(N, c.pos, 4), p = a >= 0 ? navPath(N, a, leg.to) : null;
  if (!p) { H.legs = []; H.wait = 1; return; }                          // 走不到（站在走路格外、被隔開）⇒ 放棄這一趟（有任務 ⇒ 下一拍 handJoin 照現在的層判斷）
  H.legs.shift();
  H.wp = navSmooth(N, p).map(function (i) { return navPos(N, i); }); H.k = 0;
}
/** 閒著：在待命那一層 HAND_ROAM 的機會上別層；在別層 HAND_BACK 的機會回待命那一層；其餘在這一層隨便挑一點走過去。 */
function wander(sh, c) {
  var H = c.hand, NV = sh.nav, lv = H.lv, tl = lv;
  if (lv === NV.home) { if (NV.reach.length > 1 && rnd() < HAND_ROAM) { var o = NV.reach.filter(function (i) { return i !== NV.home; }); tl = o[(rnd() * o.length) | 0]; } }
  else if (rnd() < HAND_BACK && NV.reach.indexOf(lv) >= 0) tl = NV.home;
  var N = NV.levels[tl].N, to = N.cells[(rnd() * N.cells.length) | 0], legs = handRoute(sh, lv, tl, c.pos[0], navPos(N, to)[0]);
  H.wait = rr(3, 9);
  if (!legs) return;
  H.legs = legs.concat([{ w: tl, to: to }]);
}
/** 點名（每半秒，survey）：照開戰時的人數算每一格缺幾個，派最近的閒著的水手（交戰那一舷的砲班先、再來送藥手與舵手、另一舷最後）。 */
function callHands(sh) {
  var NV = sh.nav; if (!NV || sh.struck || sh.sunk) return;
  NV.ladders.forEach(function (L) { L.q = 0; });                       // 排隊的人數每半秒重數（倒下、放棄的路不會一直佔著）
  sh.crew.forEach(function (c) { if (c.role === ROLE.HAND && able(c)) c.hand.legs.forEach(function (l) { if (l.c !== undefined) NV.ladders[l.c].q++; }); });
  var idle = sh.crew.filter(function (c) { return c.role === ROLE.HAND && able(c) && !c.hand.job && !c.hand.climb; }); if (!idle.length) return;
  var going = {}, need = [];
  sh.crew.forEach(function (c) { if (c.role === ROLE.HAND && able(c) && c.hand.job) { var k = c.hand.job.kind + c.hand.job.key; going[k] = (going[k] || 0) + 1; } });
  sh.decks.forEach(function (D) {
    var lv = lvOf(NV.levels, D.zr[0]); if (NV.reach.indexOf(lv) < 0) return;
    ['S', 'P'].forEach(function (side) {
      var gs = sh.guns.filter(function (g) { return g.alive && !g.wet && g.deck === D.key && g.side === side; }); if (!gs.length) return;
      var want = Math.min(NV.gun0[D.key + side] || 0, gs.reduce(function (a, g) { return a + g.crewFull; }, 0));
      var have = sh.crew.filter(function (c) { return c.role === ROLE.GUN && able(c) && c.deck === D.key && c.side === side; }).length;
      var n = want - have - (going['gun' + D.key + side] || 0), wx = 0, ww = 0;
      gs.forEach(function (g) { var m = Math.max(0, g.crewFull - g.manned); wx += g.muz[0] * m; ww += m; });
      if (n > 0) need.push({ kind: 'gun', key: D.key + side, deck: D.key, side: side, lv: lv, n: n, x: ww ? wx / ww : gs[0].muz[0], pri: side === sh.side ? 0 : 2 });
    });
    var pm = sh.crew.filter(function (c) { return c.role === ROLE.POWDER && able(c) && c.deck === D.key; }).length, pn = (NV.pm0[D.key] || 0) - pm - (going['pm' + D.key] || 0);
    if (pn > 0 && sh.stations.some(function (s) { return s.deck === D.key && !s.mag.gone; })) need.push({ kind: 'pm', key: D.key, deck: D.key, lv: lv, n: pn, x: sh.T.cx, pri: 1 });
  });
  var wheel = sh.models.filter(function (m) { return m.kind === 'wheel'; })[0], hd = sh.crew.filter(function (c) { return c.role === ROLE.HELM && !able(c) && !c.relieved; });
  var hn = Math.min(hd.length, NV.helm0 - sh.crew.filter(function (c) { return c.role === ROLE.HELM && able(c); }).length - (going.helm || 0));
  if (wheel && wheel.alive && hn > 0) {
    var lvh = lvOf(NV.levels, hd[0].home[2]);
    if (NV.reach.indexOf(lvh) >= 0) for (var j = 0; j < hn; j++) need.push({ kind: 'helm', key: '', lv: lvh, n: 1, x: hd[j].home[0], spot: hd[j].home, pri: 1, who: hd[j] });
  }
  need.sort(function (a, b) { return a.pri - b.pri; });
  need.forEach(function (q) {
    for (var k = 0; k < q.n && idle.length; k++) {
      var bi = -1, bd = 1e9;
      idle.forEach(function (c, i) { var d = Math.abs(c.pos[0] - q.x) + 150 * Math.abs(c.hand.lv - q.lv); if (d < bd) { bd = d; bi = i; } });
      var c = idle[bi], H = c.hand, legs = handRoute(sh, H.lv, q.lv, c.pos[0], q.x);
      idle.splice(bi, 1); if (!legs) continue;
      if (q.kind === 'helm') { var si = navSnap(NV.levels[q.lv].N, q.spot, 4); if (si < 0) continue; legs.push({ w: q.lv, to: si }); q.who.relieved = true; }
      H.job = { kind: q.kind, key: q.key, deck: q.deck, side: q.side, lv: q.lv, spot: q.spot };
      H.legs = legs; H.wp = null; c.moving = false; NV.called++;
    }
  });
}
/** 到了：換成那個職位（砲班 ⇒ 下一拍 reassign 分砲；送藥手 ⇒ 接倒下那位的砲；舵手 ⇒ 站到舵輪後）。不在那一層（路斷了）⇒ 任務作廢、照常閒晃。 */
function handJoin(sh, c) {
  var H = c.hand, J = H.job, NV = sh.nav;
  if (H.lv !== J.lv) { H.job = null; H.wait = 1; return; }
  c.walk = null; c.moving = false; c.home = c.pos.slice(); c.hand = null; NV.joined++;
  if (J.kind === 'gun') { c.role = ROLE.GUN; c.deck = J.deck; c.side = J.side; c.gun = null; return; }
  if (J.kind === 'helm') { c.role = ROLE.HELM; c.deck = sh.weatherDeck; c.face = -1; return; }
  var dead = sh.crew.filter(function (o) { return o.role === ROLE.POWDER && o.deck === J.deck && !able(o) && !o.relieved; })[0];
  c.role = ROLE.POWDER; c.deck = J.deck; c.pm = { st: 'idle', t: 0 }; c.cart = false; c.guns = dead ? dead.guns : [];
  if (dead) { dead.relieved = true; c.home = dead.home.slice(); }
  c.guns.forEach(function (g) { if (!g.pm || !able(g.pm)) g.pm = c; });
}
/** HUD 一段：預備水手（閒著的／在路上補位的）。 */
function handsText(sh) {
  if (!sh.nav) return '';
  var h = sh.crew.filter(function (c) { return c.role === ROLE.HAND && able(c); }), go = h.filter(function (c) { return c.hand.job; }).length;
  return '　預備 ' + (h.length - go) + (go ? '（補位中 ' + go + '）' : '');
}
