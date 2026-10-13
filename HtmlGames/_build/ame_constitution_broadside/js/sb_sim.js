// ───────────────────────── 2D 策略沙盒：模擬（TASK-0551） ─────────────────────────
// 只算指揮官要的東西：船的位置、航向、航速（照風）、兩舷的砲、三條血（船殼、砲、人）—— 沒有格子、沒有砲彈的飛行、沒有帆與繩。
// 跟遊戲共用（同一份檔）：指揮官 53_commander.js（cmdThink、cmdHelmLine）。
// 照抄遊戲的公式（遊戲改了要跟著改；出處寫在旁邊）：帆速曲線、逆風壓縮、航速與加減速、轉向率、交戰操舵（31_sailing.js）、開局編隊（52_fleet.js spawnFleet）。
// 數字從遊戲量（SB_CAL、SB_HULLS；量法與讀數在 README「指揮官」與 TASK-0551）。
var SB_POLAR = [[0, 0.72], [45, 1], [90, 0.92], [112, 0.6], [125, 0.32], [180, 0.25]];   // ＝ 31_sailing.js POLAR
var SB_VMAX = 3.6, SB_DT = 0.1;                                                          // ＝ 31_sailing.js VMAX；沙盒一步 0.1 秒（遊戲 1/60）
var SB_FUN = { speed: 1.4, agile: 1.5 };                                                 // 玩法「娛樂」的加成（04_state.js LIM.funspeed／funagile 的預設）
// 船型（遊戲量的，2026-10-14：開一場、讀 __game.ships() 的砲（兩舷、砲種）、船員、船隻設定、水線長、開戰排水量）。reload ＝ 砲種的裝填倍率平均（10_ship.js GUNS）。
var SB_HULLS = {
  constitution: { name: '憲法號', guns: { P: 27, S: 27 }, reload: 0.87, crew: 313, speed: 1, agile: 1, upwind: 1, len: 55.5, mass: 2154 },
  ember: { name: '餘燼號', guns: { P: 45, S: 45 }, reload: 0.99, crew: 540, speed: 0.85, agile: 0.7, upwind: 1, len: 62.4, mass: 3098 },
  falcon: { name: '夜隼號', guns: { P: 6, S: 6 }, reload: 0.6, crew: 55, speed: 1.2, agile: 1.6, upwind: 1.25, len: 20.2, mass: 75 }
};
// 校準（遊戲量的，2026-10-14；量法：兩艘憲法號平行對轟、每秒拉回原位，距離 100／150／200／300／400／600／800 m 各 60 秒，兩邊合計）：
//   hit：每一發打中的機率 ＝ 兩邊的命中 ÷ 開火（兩邊差很多：一邊 ~30%、一邊 ~70%，跟距離無關 —— 風讓船傾、上風舷與下風舷的砲口高低不同；沙盒不模擬傾斜 ⇒ 取平均）。
//     對方小一號 ⇒ 乘 (水線長 ÷ 55.5)^0.7（只量了憲法號，這是估的）。
//   每中一發：倒 crewHit 人（1,174 人 ÷ 905 發）、少 gunHit 門砲（105 ÷ 905）、帆掉 sailHit（60 秒內帆剩 15–78%，合計 8.42 ÷ 905）。
//   船殼：遊戲沉船靠水線下的洞慢慢進水（60 秒上百發只沉 0–0.016 m）⇒ 沙盒用「幾發沉」近似：憲法號 hullHits 發，別的船型照排水量^0.7 換算；
//     hullHits 對的是「一對一 140 m 約 290 秒打沉」（遊戲 README 的電腦對電腦讀數；sbCalSink 量）。
//   開火：一門裝填 reload × 船型倍率 秒（遊戲 RELOAD 7），電腦兩輪之間再等 wait 秒（50_sim.js ai 的 aiWait 1–3.5 秒平均）⇒ 憲法號約 8.3 秒一輪（量的：60 秒 170–190 發 ≈ 27 門 × 7 輪）。
var SB_CAL = { hit: [[100, 0.60], [150, 0.50], [200, 0.51], [300, 0.41], [400, 0.38], [600, 0.35], [800, 0.33], [1000, 0.2]], crewHit: 1.30, gunHit: 0.116, sailHit: 0.0093,
  hullHits: 400, reload: 7, wait: 2.25, rmax: 1000, arc: 0.45, sinkT: 20 };
function sbPolar(deg) { for (var i = 1; i < SB_POLAR.length; i++) if (deg <= SB_POLAR[i][0]) { var a = SB_POLAR[i - 1], b = SB_POLAR[i]; return a[1] + (b[1] - a[1]) * (deg - a[0]) / (b[0] - a[0]); } return SB_POLAR[SB_POLAR.length - 1][1]; }
function sbHit(d, tgt) { return sbHitD(d) * Math.min(1, Math.pow(tgt.H.len / 55.5, 0.7)); }
function sbHitD(d) { var H = SB_CAL.hit; if (d <= H[0][0]) return H[0][1]; for (var i = 1; i < H.length; i++) if (d <= H[i][0]) { var a = H[i - 1], b = H[i]; return a[1] + (b[1] - a[1]) * (d - a[0]) / (b[0] - a[0]); } return 0; }
function sbRng(seed) { var s = (seed >>> 0) || 1; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function sbClamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function sbWrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

/** 開一場：opt ＝ { blue: [船型…], red: […], cmd: { blue, red }（策略）, dist（船頭相距 m）, seed, wind（風吹去的方向 rad；不給 ⇒ 照種子）, windSpd, play（'fun'／'real'）}。 */
function sbNew(opt) {
  var rng = sbRng(opt.seed || 1), wa = opt.wind !== undefined ? opt.wind : rng() * Math.PI * 2;
  var W = { t: 0, rng: rng, ships: [], wind: [Math.cos(wa), Math.sin(wa)], windSpd: opt.windSpd || 1, play: opt.play || 'fun', dist: opt.dist || 140,
    cmd: opt.cmd || { blue: 'pair', red: 'pair' }, mem: { blue: {}, red: {} }, orders: {}, over: null, log: [] };
  // 開局編隊（＝ 52_fleet.js spawnFleet）：藍往 −z、紅往 +z，船頭相距 dist；同一邊橫隊左右隔 70 m、從中間往兩側排
  function slots(m) { var r = []; for (var q = 0; q < m; q++) r.push((q - (m - 1) / 2) * 70); return r.sort(function (a, b) { return Math.abs(a) - Math.abs(b) || a - b; }); }
  var spec = [];
  [['blue', opt.blue], ['red', opt.red]].forEach(function (p) { p[1].forEach(function (h, j) { spec.push({ team: p[0], hull: h, j: j }); }); });
  spec.sort(function (a, b) { return a.j - b.j || (a.team === 'blue' ? -1 : 1); });   // 我艦、敵方第一艘、我方第二艘…（遊戲的 SHIPS 順序）
  var X = { blue: slots(opt.blue.length), red: slots(opt.red.length) };
  spec.forEach(function (f, i) {
    var H = SB_HULLS[f.hull], blue = f.team === 'blue', bow = H.len / 2;
    W.ships.push({ id: i, team: f.team, hull: f.hull, H: H, x: X[f.team][f.j], z: blue ? W.dist / 2 + bow : -W.dist / 2 - bow, yaw: blue ? Math.PI / 2 : -Math.PI / 2,
      yawRate: 0, spd: -1, side: 'S', hp: 1, sail: 1, guns: { P: H.guns.P, S: H.guns.S }, crew: 1, reload: { P: 0, S: 0 }, out: false, sunk: false, sinkT: 0, foe: null, throttle: 1,
      fired: 0, hits: 0, hitsTaken: 0, kills: 0 });
  });
  sbThink(W);
  return W;
}
function sbPlayK(W, k) { return W.play === 'fun' ? SB_FUN[k] : 1; }
function sbView(W, side) {
  return { t: W.t, side: side, wind: W.wind, ships: W.ships.map(function (s) {
    return { id: s.id, team: s.team, x: s.x, z: s.z, yaw: s.yaw, spd: s.spd, hp: s.hp, guns: (s.guns.P + s.guns.S) / (s.H.guns.P + s.H.guns.S), crew: s.crew, mass: s.H.mass, len: s.H.len, out: s.out, cmd: true, tgt: s.foe ? s.foe.id : null };
  }) };
}
function sbThink(W) { W.orders = {}; ['blue', 'red'].forEach(function (side) { var o = cmdThink(sbView(W, side), W.cmd[side], W.mem[side]); for (var k in o) W.orders[k] = o[k]; }); }
function sbFoe(W, s) {                                                     // ＝ 52_fleet.js pickFoes：命令的目標（還在打的敵艦）；不然最近的
  var o = W.orders[s.id], t = o && o.target !== null && o.target !== undefined ? W.ships[o.target] : null;
  if (t && t.team !== s.team && !t.out) return t;
  var best = null, bd = 1e18;
  W.ships.forEach(function (e) { if (e.team === s.team || e.out) return; var d = Math.hypot(e.x - s.x, e.z - s.z); if (d < bd) { bd = d; best = e; } });
  return best;
}
/** 一步。 */
function sbStep(W) {
  var dt = SB_DT; W.t += dt; W.n = (W.n || 0) + 1;
  if (W.n % Math.round(3 / dt) === 0) sbThink(W);                          // 指揮官每 3 秒想一次（＝ 遊戲 CMD_EVERY）
  W.ships.forEach(function (s) { if (!s.sunk) s.foe = sbFoe(W, s); });
  W.ships.forEach(function (s) { if (!s.sunk) sbSail(W, s, dt); });
  sbCollide(W);
  W.ships.forEach(function (s) { if (!s.out) sbFire(W, s, dt); });
  W.ships.forEach(function (s) {
    if (!s.out && (s.hp <= 0 || s.crew <= 0)) { s.out = true; s.fate = s.hp <= 0 ? '沉' : '全員倒下'; s.outT = W.t; W.log.push({ t: W.t, id: s.id, fate: s.fate }); }
    if (s.out && s.hp <= 0 && !s.sunk && (s.sinkT += dt) > SB_CAL.sinkT) s.sunk = true;
  });
  ['blue', 'red'].forEach(function (tm) { if (!W.over && W.ships.filter(function (s) { return s.team === tm; }).every(function (s) { return s.out; })) W.over = { t: W.t, loser: tm, winner: tm === 'blue' ? 'red' : 'blue' }; });
}
/** 航行與操舵（＝ 31_sailing.js sail 的電腦那一段；手動、頂風失速、天氣不抄）。 */
function sbSail(W, s, dt) {
  var F = [Math.cos(s.yaw), -Math.sin(s.yaw)], deg = Math.acos(sbClamp(F[0] * W.wind[0] + F[1] * W.wind[1], -1, 1)) * 57.2958;
  var UP = s.H.upwind || 1, dU = UP === 1 || deg <= 90 ? deg : 90 + (deg - 90) / UP, SPK = s.H.speed * sbPlayK(W, 'speed');
  var sailFrac = s.sail;                                                    // 帆還剩多少（每中一發掉 sailHit；遊戲是帆一面一面掉）
  var target = s.out ? (s.hp <= 0 ? 0 : SB_VMAX * SPK * Math.sqrt(W.windSpd) * sailFrac * sbPolar(dU) * 0.15) : SB_VMAX * SPK * Math.sqrt(W.windSpd) * sailFrac * sbPolar(dU) * s.throttle;
  if (s.spd < 0) s.spd = target;                                            // 開局就在走（＝ sh.spd0）
  s.spd += (target - s.spd) * Math.min(1, dt / (s.throttle < 1 ? 6 : 20));
  s.throttle = 1;
  var tY = s.yaw, foe = s.foe;
  var rmax = (0.012 + 0.016 * s.spd / SPK) * s.H.agile * sbPlayK(W, 'agile');
  if (!s.out && foe) {
    var st = [Math.sin(s.yaw), Math.cos(s.yaw)], dx = foe.x - s.x, dz = foe.z - s.z, d = Math.hypot(dx, dz) || 1, k = (dx * st[0] + dz * st[1]) / d;   // ＝ chooseSide
    if (k > 0.2) s.side = 'S'; else if (k < -0.2) s.side = 'P';
    var other = s.side === 'S' ? 'P' : 'S', present = s.guns[s.side] > 0 || !s.guns[other] ? s.side : other, sg = present === 'P' ? 1 : -1, R = sbClamp(W.dist, 90, 220);
    tY = (sg > 0 ? Math.atan2(-dx / d, -dz / d) : Math.atan2(dx / d, dz / d)) + sg * sbClamp((d - R) / R * 1.5, -0.4, 1.2);   // ＝ 31_sailing.js 交戰操舵
    var o = W.orders[s.id], ld = o && o.mode === 'line' ? W.ships[o.leader] : null;
    if (ld && !ld.sunk) { var hl = cmdHelmLine(s, ld); tY = hl.yaw; s.throttle = hl.throttle; s.station = hl.station; } else s.station = null;
    if (o && o.throttle !== undefined && !ld) s.throttle = o.throttle;
    var av = sbAvoid(W, s); if (av !== null) tY = av;
  }
  var e = sbWrap(tY - s.yaw), rate = sbClamp(e * 0.5, -rmax, rmax);
  s.yawRate += (rate - s.yawRate) * Math.min(1, dt / 2);
  s.yaw += s.yawRate * dt;
  s.x += Math.cos(s.yaw) * s.spd * dt; s.z += -Math.sin(s.yaw) * s.spd * dt;
}
/** 讓友船（粗版的 52_fleet.js friendAvoid：中心距離 < 船長 ＋ 20 m 而且在靠近 ⇒ 往遠離它那一側打 0.8 rad）。 */
function sbAvoid(W, s) {
  var best = null, bd = 1e9;
  W.ships.forEach(function (o) {
    if (o === s || o.team !== s.team || o.sunk) return;
    var dx = o.x - s.x, dz = o.z - s.z, d = Math.hypot(dx, dz), lim = (s.H.len + o.H.len) / 2 + 20;
    var close = ((Math.cos(s.yaw) * s.spd - Math.cos(o.yaw) * o.spd) * dx + (-Math.sin(s.yaw) * s.spd + Math.sin(o.yaw) * o.spd) * dz) / (d || 1);
    if (d < lim && (close > 0.05 || d < lim - 15) && d < bd) { bd = d; best = { dx: dx, dz: dz }; }
  });
  if (!best) return null;
  var left = [-Math.sin(s.yaw), -Math.cos(s.yaw)];
  return s.yaw + ((best.dx * left[0] + best.dz * left[1]) > 0 ? -1 : 1) * 0.8;
}
/** 擦撞（粗版的 31_sailing.js collide：中心距離 < 兩艘船寬 ⇒ 推開、各掉一點速度）。 */
function sbCollide(W) {
  var L = W.ships.filter(function (s) { return !s.sunk; });
  for (var i = 0; i < L.length; i++) for (var j = i + 1; j < L.length; j++) {
    var a = L[i], b = L[j], dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz), lim = 16;
    if (d >= lim) continue;
    var n = d > 1e-3 ? [dx / d, dz / d] : [0, 1], p = (lim - d) / 2;
    a.x += n[0] * p; a.z += n[1] * p; b.x -= n[0] * p; b.z -= n[1] * p; a.spd *= 0.97; b.spd *= 0.97;
  }
}
/** 開砲：兩舷各自裝填；敵艦落在那一舷正橫 ±arc、距離 ≤ rmax ⇒ 那一舷齊射（目標優先，再來最近的）；友船擋在砲線 < 9 m ⇒ 不開（＝ 52_fleet.js friendInLine）。
 *  每一門照距離的命中率擲一次；中一發 ⇒ 船殼、砲（朝它那一舷）、人各掉一點。 */
function sbFire(W, s, dt) {
  ['P', 'S'].forEach(function (side) {
    if (!s.guns[side]) return;
    s.reload[side] -= dt; if (s.reload[side] > 0) return;
    var nrm = side === 'S' ? [Math.sin(s.yaw), Math.cos(s.yaw)] : [-Math.sin(s.yaw), -Math.cos(s.yaw)], best = null, bs = 1e18;
    W.ships.forEach(function (e) {
      if (e.team === s.team || e.out) return;
      var dx = e.x - s.x, dz = e.z - s.z, d = Math.hypot(dx, dz); if (d > SB_CAL.rmax) return;
      if (Math.acos(sbClamp((dx * nrm[0] + dz * nrm[1]) / (d || 1), -1, 1)) > SB_CAL.arc + Math.atan2(e.H.len / 2, d)) return;   // 射界 ＋ 對方船身的半長
      if (sbBlocked(W, s, e)) return;
      var sc = d * (e === s.foe ? 0.5 : 1); if (sc < bs) { bs = sc; best = e; }
    });
    if (!best) { s.reload[side] = 0.3; return; }
    var n = Math.round(s.guns[side] * Math.max(0.3, s.crew)), d = Math.hypot(best.x - s.x, best.z - s.z), p = sbHit(d, best), h = 0;
    for (var k = 0; k < n; k++) if (W.rng() < p) h++;
    s.fired += n; s.hits += h; best.hitsTaken += h;
    if (W.fx) W.fx.push({ t: W.t, x0: s.x, z0: s.z, x1: best.x, z1: best.z, team: s.team, n: n });   // 畫面的齊射線（sb_ui.js；批次不記）
    if (h) {
      best.hp -= h / (SB_CAL.hullHits * Math.pow(best.H.mass / 2154, 0.7));
      best.crew = Math.max(0, best.crew - h * SB_CAL.crewHit / best.H.crew);
      best.sail = Math.max(0.05, best.sail - h * SB_CAL.sailHit);
      var tside = ((s.x - best.x) * Math.sin(best.yaw) + (s.z - best.z) * Math.cos(best.yaw)) > 0 ? 'S' : 'P';
      for (k = 0; k < h; k++) if (W.rng() < SB_CAL.gunHit && best.guns[tside] > 0) best.guns[tside]--;
    }
    s.reload[side] = SB_CAL.reload * s.H.reload / Math.max(0.3, s.crew) * (0.9 + 0.2 * W.rng()) + SB_CAL.wait * (0.45 + 1.1 * W.rng());
  });
}
function sbBlocked(W, s, e) {
  return W.ships.some(function (o) {
    if (o === s || o.team !== s.team || o.sunk) return false;
    var ax = e.x - s.x, az = e.z - s.z, L2 = ax * ax + az * az, t = sbClamp(((o.x - s.x) * ax + (o.z - s.z) * az) / L2, 0, 1);
    return t > 0.05 && t < 0.95 && Math.hypot(o.x - s.x - ax * t, o.z - s.z - az * t) < 9 + 6;
  });
}
/** 跑完一場（或到 tmax 秒）⇒ 結果。 */
function sbRun(opt, tmax) {
  var W = sbNew(opt), n = Math.round((tmax || 900) / SB_DT);
  for (var i = 0; i < n && !W.over; i++) sbStep(W);
  return sbResult(W);
}
function sbResult(W) {
  function left(tm) { return W.ships.filter(function (s) { return s.team === tm && !s.out; }).length; }
  return { winner: W.over ? W.over.winner : null, t: +W.t.toFixed(1), left: { blue: left('blue'), red: left('red') },
    hits: { blue: W.ships.filter(function (s) { return s.team === 'blue'; }).reduce(function (a, s) { return a + s.hits; }, 0), red: W.ships.filter(function (s) { return s.team === 'red'; }).reduce(function (a, s) { return a + s.hits; }, 0) } };
}
