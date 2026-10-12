// ───────────────────────── 航行 ─────────────────────────
// 航速 ＝ VMAX × 還在的帆面積比例 × 風向係數（POLAR）×（進水越多越慢）；降旗 ⇒ 停船（heave to），沉了 ⇒ 0。加減速時間常數 20 秒（船重）。
// 自動操舵：讓敵艦保持在 sh.side 那一舷的正橫（sh.side ＝ 敵艦現在在哪一舷，見 chooseSide），太遠往敵艦偏、太近偏開
// ⇒ 兩艘都用同一舷 ⇒ 繞著彼此轉；一艘一舷 ⇒ 並肩同向。兩舷各有砲班、各自開火，船不必為了開火換舷。
// 手動操舵（我艦）：A／D ＝ 畫面上的左轉／右轉（打滿與回正各要 0.7 秒），轉向率 ＝ 舵角 × 最大轉向率。
// 轉向率跟航速成正比（舵要有水流過）；舵輪被打飛 ⇒ 改用舵柄滑車，只剩 35%。
// 帆裝三段（W／S）：收帆（三面上桅帆＋jib）／戰鬥帆（再加上桅頂帆、後桅縱帆、前支索帆）／滿帆（全部，預設）；
// 收起來的帆不畫、鏈彈打不到、不算航速；帆收得越多瞄得越穩。
// ⛔ 沒做搶風／順風換舷：頂風那一段只是慢下來（係數 0.25，靠慣性帶過去），不會停死。
var VMAX = 3.6;                                                    // m/s（約 7 節）：滿帆、側順風
var POLAR = [[0, 0.72], [45, 1], [90, 0.92], [112, 0.6], [125, 0.32], [180, 0.25]];   // 船頭跟「風吹去的方向」的夾角（度）→ 係數
function polar(deg) {
  for (var i = 1; i < POLAR.length; i++) if (deg <= POLAR[i][0]) { var a = POLAR[i - 1], b = POLAR[i]; return a[1] + (b[1] - a[1]) * (deg - a[0]) / (b[0] - a[0]); }
  return POLAR[POLAR.length - 1][1];
}
function pointName(deg) { return deg < 30 ? '順風' : deg < 70 ? '側順風' : deg < 105 ? '橫風' : deg < 125 ? '迎風' : '頂風'; }
function sailArea(s) {
  var v = s.verts, A = 0;
  for (var j = 0; j < s.tris.length; j += 3) {
    var a = s.tris[j] * 3, b = s.tris[j + 1] * 3, d = s.tris[j + 2] * 3;
    A += len(cross([v[b] - v[a], v[b + 1] - v[a + 1], v[b + 2] - v[a + 2]], [v[d] - v[a], v[d + 1] - v[a + 1], v[d + 2] - v[a + 2]])) / 2;
  }
  return A;
}
/** 水線（z ＝ ZW）上船體的前後端（中線附近）與船頭浪位置的半寬。⛔ 用外框 HULL_X ⇒ 船頭浪出現在船首前面 24 m 的水上。 */
function waterline() {
  var x0 = 1e9, x1 = -1, x, y, lo = 1e9, hi = -1;
  for (x = 0; x < BASE.sx; x++) for (y = CY - 60; y <= CY + 60; y++) if (BASE.get(x, y, ZW)) { if (x < x0) x0 = x; if (x > x1) x1 = x; break; }
  WL_X0 = x0; WL_X1 = x1;
  for (y = 0; y < BASE.sy; y++) if (BASE.get(x1 - 25, y, ZW)) { if (y < lo) lo = y; if (y > hi) hi = y; }
  BOW_HALF = hi >= lo ? (hi - lo) / 2 + 3 : 20;
}
function fwd(yaw) { return [Math.cos(yaw), 0, -Math.sin(yaw)]; }          // 船頭（格 +x）在世界的方向；yaw 變大 ＝ 往格 +y 那一側轉 ＝ 畫面上的左轉
function sideName(side) { return side === 'S' ? '左舷' : '右舷'; }        // 模型的 S（格 +y）在畫面上是左舷（見 makeShip）
var SAILSETS = ['全收', '收帆', '戰鬥帆', '滿帆'];
/** 帆裝 k 張不張這面帆：0 全收（一面都不張）／1 收帆（三面上桅帆＋jib）／2 戰鬥帆（再加上桅頂帆、後桅縱帆、前支索帆）／3 滿帆。
 *  收起來的帆不畫、不算航速、鏈彈打不到、依靠的格或繩斷了也不掉 —— 只有桅斷了（依靠跟著斷開的那一團走）才跟著走。 */
function setHas(name, k) {
  if (k >= 3) return true;
  if (k <= 0) return false;
  if (/topsail$/.test(name) || name === 'jib') return true;
  return k >= 2 && (/topgallant$/.test(name) || name === 'spanker' || name === 'fore-topmast-staysail');
}
function applySailSet(sh) { sh.sails.forEach(function (s) { s.furled = !setHas(s.name, sh.sailSet); }); sh.rigDirty = true; }
function setSails(sh, k) {
  k = clamp(k, 0, SAILSETS.length - 1); if (k === sh.sailSet) return;
  sh.sailSet = k; applySailSet(sh); note(sh, '帆裝：' + SAILSETS[k]);
}
function sideGuns(sh, side) { return sh.guns.filter(function (g) { return g.alive && gunRate(g) > 0 && g.side === side; }).length; }   // 這一舷開得動的砲
function sail(sh, dt) {
  var F = fwd(sh.yaw), W = norm(WIND), deg = Math.acos(clamp(dot(F, W), -1, 1)) * 57.2958;
  sh.sailFrac = sh.sails.reduce(function (a, s) { return a + (s.dead || s.furled ? 0 : s.area * s.hp / s.hpMax); }, 0) / sh.sailArea0;   // 被打中還沒掉的帆：照剩下的耐久算推力
  sh.pos = pointName(deg);
  var stop = SAIL === 'off', manual = SAIL === 'manual' && sh.i === PLAYER_I;
  sh.manual = manual;
  var target = sh.sunk || stop ? 0 : VMAX * SPEEDK * sh.sailFrac * polar(deg) * (1 - clamp(sh.sink / 9, 0, 0.8)) * (sh.struck ? 0.15 : 1);
  if (sh.spd0) { sh.spd = target; sh.spd0 = false; }                    // 開局就在走
  sh.spd += (target - sh.spd) * Math.min(1, dt / (stop ? 6 : 20));     // 停船：收帆、轉進風裡，6 秒內停下
  // 舵
  var foe = SHIPS[1 - sh.i], tY = sh.yaw, rate = 0;
  var wheel = sh.models.some(function (m) { return m.kind === 'wheel' && m.alive; });
  var rmax = (0.012 + 0.016 * sh.spd / SPEEDK) * (wheel ? 1 : 0.35) * AGILK;   // ⛔ 用 sh.spd 直接算 ⇒ 調快航速連帶變得更會轉
  if (stop) { sh.rudder = 0; rate = 0; }
  else if (manual && !sh.struck && !sh.sunk) {
    var want = (KEYS.l ? 1 : 0) - (KEYS.r ? 1 : 0);                    // 舵角正 ＝ yaw 變大 ＝ 畫面上左轉
    sh.rudder += clamp(want - sh.rudder, -1.5 * dt, 1.5 * dt);
    rate = sh.rudder * rmax;
  } else {
    if (!sh.struck && !sh.sunk && foe) {
      // 這一舷的砲都開不了、另一舷還有 ⇒ 把另一舷轉向敵艦
      var other = sh.side === 'S' ? 'P' : 'S', present = sideGuns(sh, sh.side) || !sideGuns(sh, other) ? sh.side : other, sg = present === 'P' ? -1 : 1;
      var dx = foe.px - sh.px, dz = foe.pz - sh.pz, d = Math.hypot(dx, dz) || 1;
      tY = (sg > 0 ? Math.atan2(-dx / d, -dz / d) : Math.atan2(dx / d, dz / d)) + sg * clamp((d - DIST) / DIST * 1.5, -0.4, 0.4);   // 敵艦在那一舷正橫的航向 ＋ 距離修正
    }
    var e = Math.atan2(Math.sin(tY - sh.yaw), Math.cos(tY - sh.yaw));
    rate = clamp(e * 0.5, -rmax, rmax); sh.rudder = rmax > 0 ? rate / rmax : 0;
  }
  sh.yawRate += (rate - sh.yawRate) * Math.min(1, dt / 2);
  sh.yaw += sh.yawRate * dt;
  F = fwd(sh.yaw);
  sh.vel = mul(F, sh.spd);
  sh.px += sh.vel[0] * dt; sh.pz += sh.vel[2] * dt;
  // 航跡：船尾留一條白沫、船頭兩側推出的浪（點精靈，不撞任何東西）
  if ((sh.wakeT -= dt) <= 0 && sh.spd > 0.4 && sh.sink < 6) {
    sh.wakeT = 0.12;
    var st = M4.pt(sh.M, WL_X0 - 4, CY, ZW);
    spawnPt([st[0] + gauss() * 0.8, 0.06, st[2] + gauss() * 0.8], [0, 0, 0], rr(9, 13), [0.93, 0.96, 1], 0.3 * Math.min(1, sh.spd / 2), rr(1.2, 2), rr(4, 6), 0, 0, 2);
    [1, -1].forEach(function (k) {
      var bw = M4.pt(sh.M, WL_X1 - 25, CY + k * BOW_HALF, ZW), out = M4.dir(sh.M, 0, k, 0); out = norm([out[0], 0, out[2]]);
      spawnPt([bw[0], 0.08, bw[2]], mul(out, rr(0.4, 1) * sh.spd * 0.4), rr(1.5, 2.5), [0.95, 0.97, 1], 0.5, rr(0.8, 1.3), rr(2, 3), 0, 0, 2);
    });
  }
}

/** 兩艘的龍骨線（各取 7 點）最近不到 14 公尺 ⇒ 沿那個方向各推開一半、航速掉一點（⛔ 不推 ⇒ 手動開過去會穿船）。 */
function collide() {
  if (SHIPS.length < 2) return;
  var A = SHIPS[0], B = SHIPS[1], best = 1e9, pa = null, pb = null;
  function keel(sh) { var r = []; for (var k = 0; k < 7; k++) r.push(M4.pt(sh.M, WL_X0 + 15 + (WL_X1 - WL_X0 - 30) * k / 6, CY, ZW)); return r; }
  var ka = keel(A), kb = keel(B);
  ka.forEach(function (a) { kb.forEach(function (b) { var d = Math.hypot(a[0] - b[0], a[2] - b[2]); if (d < best) { best = d; pa = a; pb = b; } }); });
  if (best >= 14) return;
  var n = best > 1e-3 ? [(pa[0] - pb[0]) / best, 0, (pa[2] - pb[2]) / best] : [0, 0, 1], push = (14 - best) / 2;
  A.px += n[0] * push; A.pz += n[2] * push; B.px -= n[0] * push; B.pz -= n[2] * push;
  A.spd *= 0.97; B.spd *= 0.97;
  if (SIMT - (A.bumpT || -9) > 5) { A.bumpT = SIMT; sfx('crack', pa, 1); note(SHIPS[PLAYER_I], '兩艘擦撞'); }
}
/** 敵艦在哪一舷（給自動操舵用；有遲滯，不在正前／正後來回跳）。只影響操舵 —— 開火是每門砲各自看對不對得到。 */
function chooseSide(sh) {
  var foe = SHIPS[1 - sh.i]; if (!foe || !foe.center || sh.struck || sh.sunk) return;   // 開局逐艘量的時候，另一艘可能還沒算過位置
  var st = M4.dir(sh.M, 0, 1, 0), dx = foe.center[0] - sh.center[0], dz = foe.center[2] - sh.center[2];
  var k = (dx * st[0] + dz * st[2]) / ((Math.hypot(dx, dz) || 1) * (Math.hypot(st[0], st[2]) || 1));
  var want = k > 0.2 ? 'S' : k < -0.2 ? 'P' : sh.side;
  if (want === sh.side) return;
  sh.side = want;
}

