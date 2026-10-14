// ───────────────────────── 航行 ─────────────────────────
// 航速 ＝ VMAX × 還在的帆面積比例 × 風向係數（POLAR）×（進水越多越慢）；降旗 ⇒ 停船（heave to），沉了 ⇒ 0。加減速時間常數 20 秒（船重）。
// 自動操舵：讓敵艦保持在 sh.side 那一舷的正橫（sh.side ＝ 敵艦現在在哪一舷，見 chooseSide），太遠往敵艦偏、太近偏開
// ⇒ 兩艘都用同一舷 ⇒ 繞著彼此轉；一艘一舷 ⇒ 並肩同向。兩舷各有砲班、各自開火，船不必為了開火換舷。
// 手動操舵（我艦）：A／D ＝ 畫面上的左轉／右轉（打滿與回正各要 0.7 秒），轉向率 ＝ 舵角 × 最大轉向率。
// 轉向率跟航速成正比（舵要有水流過）；舵輪被打飛 ⇒ 改用舵柄滑車，只剩 35%。
// 帆裝三段（W／S）：收帆（三面上桅帆＋jib）／戰鬥帆（再加上桅頂帆、後桅縱帆、前支索帆）／滿帆（全部，預設）；
// 收起來的帆不畫、鏈彈打不到、不算航速；帆收得越多瞄得越穩。
// 頂風失速（只管手動操舵；電腦操舵照舊 —— 它不會搶風，失速會卡死）：風從船頭兩側 60° 以內吹來 ⇒ 帆被吹回來，
//   推力 ×(1 − 失速)；船頭被風推開（往原本那一舷倒，航速一半以下推得動、越慢越大）⇒ 帶著速度才轉得過去（搶風 tack），
//   太慢就卡住、被推回原本那一舷；往下風轉一圈（順風換舷 wear）永遠轉得過去。45° 以內全失速、45–60° 漸變。
//   量過（2026-10-13，滿帆、舵打滿往風裡轉）：寫實 ⇒ 從近迎風（風從船頭 65°）卡住、從橫風帶 6.5 節 71 秒搶過；娛樂 ⇒ 從近迎風 48 秒搶過。
//   失速 ＝ 細節設定的「頂風失速」（0 ＝ 頂風只是慢，係數 0.25 靠慣性帶過去）× 玩法的加成（娛樂 0.4）。
var VMAX = 3.6;                                                    // m/s（約 7 節）：滿帆、側順風
var NOGO_DEG = 60, NOGO_FULL = 45, IRONS_PUSH = 0.02;              // 頂風失速：開始、全失速的角度（風從船頭偏幾度）、船頭被推開的轉向率（rad/s，船停住時）
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
/** 船型 T 的水線（z ＝ T.zw）上船體的前後端（中線附近，T.wl0／wl1）與船頭浪位置的半寬（T.bowHalf）。⛔ 用外框 ⇒ 船頭浪出現在船首前面 24 m 的水上。 */
function waterline(T) {
  var x0 = 1e9, x1 = -1, x, y, lo = 1e9, hi = -1, G = T.base, CY = T.cy, ZW = T.zw;
  for (x = 0; x < G.sx; x++) for (y = CY - 60; y <= CY + 60; y++) if (G.get(x, y, ZW)) { if (x < x0) x0 = x; if (x > x1) x1 = x; break; }
  T.wl0 = x0; T.wl1 = x1;
  for (y = 0; y < G.sy; y++) if (G.get(x1 - 25, y, ZW)) { if (y < lo) lo = y; if (y > hi) hi = y; }
  T.bowHalf = hi >= lo ? (hi - lo) / 2 + 3 : 20;
}
/** 電腦想保持的交戰距離（m）：開局距離夾在 90～220 m（以前距離只有 90／140／220 三檔、開局就在這個距離）。 */
function aiRange() { return clamp(DIST, 90, 220); }
function fwd(yaw) { return [Math.cos(yaw), 0, -Math.sin(yaw)]; }          // 船頭（格 +x）在世界的方向；yaw 變大 ＝ 往格 −y（左舷 P）那一側轉 ＝ 畫面上的左轉
function sideName(side) { return side === 'S' ? '右舷' : '左舷'; }        // 模型的 S（格 +y）＝ 右舷（shipBaseMatrix 照雕刻引擎的手性）
var SAILSETS = ['全收', '收帆', '戰鬥帆', '滿帆'];
/** 帆裝 k 張不張這面帆：0 全收（一面都不張）／1 收帆（三面上桅帆＋jib）／2 戰鬥帆（再加上桅頂帆、後桅縱帆、前支索帆）／3 滿帆。
 *  收起來的帆不畫、不算航速、鏈彈打不到、依靠的格或繩斷了也不掉 —— 只有桅斷了（依靠跟著斷開的那一團走）才跟著走。 */
/** 帆裝（W／S）：這面帆最少在哪一段打開（1 收帆、2 戰鬥帆、3 滿帆）。
 *  照 meta（TASK-0539，造船規格 §9.1）：有 `set` ⇒ 照它；否則照種類 `sail` 的預設（topsail、jib 1；topgallant、gaff 2；其他 3）。
 *  沒有 meta 的舊匯出照名字（以前的規則，一一對應：結尾 topsail、jib ⇒ 1；結尾 topgallant、spanker、fore-topmast-staysail ⇒ 2；其他 3）。 */
var SAIL_SET0 = { topsail: 1, jib: 1, topgallant: 2, gaff: 2 };
function sailSetLevel(s) {
  var m = s.meta;
  if (m && m.kind === 'sail' && m.sail) return +m.set || SAIL_SET0[m.sail] || 3;
  var name = s.name;
  if (/topsail$/.test(name) || name === 'jib') return 1;
  if (/topgallant$/.test(name) || name === 'spanker' || name === 'fore-topmast-staysail') return 2;
  return 3;
}
function setHas(s, k) {
  if (k >= 3) return true;
  if (k <= 0) return false;
  return sailSetLevel(s) <= k;
}
/** 旗（餘燼號階段十九：船尾旗 ensign、主桅長旗 pennant；繩帆格式裡也是「帆」，沒有 meta ⇒ 照名字）：不收、不算推力；降旗時船尾旗降下來（strikeColors）。 */
/** 旗：照 meta `kind=flag`（TASK-0539）；有 meta 但不是 flag ⇒ 不是；沒有 meta 的舊匯出照名字（ensign／pennant／flag 開頭）。 */
function isFlag(s) { var m = s.meta; if (m && m.kind) return m.kind === 'flag'; return /^(ensign|pennant|flag)/.test(s.name); }
/** 降旗：降船尾旗（meta `flag=ensign`；沒有 meta ⇒ 名字叫 ensign 的那面）。 */
function strikeColors(sh) { sh.sails.forEach(function (s) { if (s.flag && (s.meta && s.meta.kind ? s.meta.flag === 'ensign' : s.name === 'ensign')) { s.furled = true; s.struck = true; } }); sh.rigDirty = true; }
function applySailSet(sh) { sh.sails.forEach(function (s) { s.furled = s.flag ? !!s.struck : !setHas(s, sh.sailSet); }); sh.rigDirty = true; }
function setSails(sh, k) {
  k = clamp(k, 0, SAILSETS.length - 1); if (k === sh.sailSet) return;
  sh.sailSet = k; applySailSet(sh); note(sh, '帆裝：' + SAILSETS[k]);
}
function sideGuns(sh, side) { return sh.guns.filter(function (g) { return g.alive && gunRate(g) > 0 && g.side === side; }).length; }   // 這一舷開得動的砲
// 額外動力的油門（Tim 2026-10-14：持續按住收帆 ＝ 往後推的動力；往前也是按住才有 ＝ 油門，獨立於帆之外）：我艦 cfg.base > 0、手動操舵時
//   按住 W／加帆鈕 ASTERN_HOLD 秒以上 ⇒ 往前推、按住 S／收帆鈕 ⇒ 往後推、都沒按（或兩個一起按）⇒ 不推，只靠帆。點一下照舊是加帆／收帆。
//   帆照樣往前推 ⇒ 淨推力 ＝ 帆² ± 基底²，航速 ＝ ±√|淨|（帆全收＋倒車 ⇒ 倒退基底那麼快）。自動航行中按住 ⇒ 換手動（跟 A／D 一樣）；倒退時舵效反過來（像倒車）。
//   自動航行、電腦的船 ⇒ 一直往前推（跟以前一樣）；停船（6）照舊停。
var ASTERN_HOLD = 0.4;
function sail(sh, dt) {
  var F = fwd(sh.yaw), W = norm(WIND), deg = Math.acos(clamp(dot(F, W), -1, 1)) * 57.2958;
  var UP = sh.cfg.upwind || 1, dU = UP === 1 || deg <= 90 ? deg : 90 + (deg - 90) / UP;   // 逆風性能：迎風那一半的角度壓縮（1.25 ⇒ 風從船頭 52.5° 才開始失速、45° 跑得像 36° 的船…）；1 ⇒ 一位元都不動
  sh.sailFrac = sh.sails.reduce(function (a, s) { return a + (s.dead || s.furled ? 0 : s.area * s.hp / s.hpMax); }, 0) / sh.sailArea0;   // 被打中還沒掉的帆：照剩下的血量算推力
  sh.pos = pointName(deg);
  var stop = SAIL === 'off', manual = SAIL === 'manual' && sh.i === PLAYER_I;
  var BK = sh.cfg.base || 0, ME = BK > 0 && !stop && sh.i === PLAYER_I && !sh.struck && !sh.sunk;
  var kF = ME && KEYS.f !== null && SIMT - KEYS.f >= ASTERN_HOLD, kB = ME && KEYS.b !== null && SIMT - KEYS.b >= ASTERN_HOLD;   // 按住 W／S
  if ((kF || kB) && !manual) { setSailMode('manual'); manual = true; }
  var THR = manual && BK > 0 ? (kF === kB ? 0 : kF ? 1 : -1) : 1;   // 油門：手動 ⇒ 按住才有；自動、電腦的船 ⇒ 1
  sh.thr = BK > 0 ? THR : null;
  sh.manual = manual;
  var SPK = sh.cfg.speed * playK('speed') * WX.speed;                 // 航速倍率（船隻設定 × 玩法的加成 × 天氣：暴風雨風大 ×1.15）
  var nogo = manual && !stop && !sh.sunk ? STALL_K * playK('stall') * clamp((NOGO_DEG - (180 - dU)) / (NOGO_DEG - NOGO_FULL), 0, 1) : 0;   // 頂風失速的程度
  sh.irons = nogo;
  var target = sh.sunk || stop ? 0 : VMAX * SPK * Math.sqrt(WIND_SPD) * sh.sailFrac * polar(dU) * (1 - nogo) * (1 - clamp(sh.sink / 9, 0, 0.8)) * (sh.struck ? 0.15 : 1) * (sh.throttle || 1);   // throttle：讓開友艦砲線時放慢（52_fleet.js lineClear；平常 1）
  if (BK > 0 && !sh.sunk && !stop && THR) { var vb = BK / 1.9438 * (1 - clamp(sh.sink / 9, 0, 0.8)) * (sh.struck ? 0.15 : 1) * (sh.throttle || 1); var NT = target * target + THR * vb * vb; target = NT >= 0 ? Math.sqrt(NT) : -Math.sqrt(-NT); }   // 基底航速（節 ⇒ m/s）：額外動力，推力跟帆相加 ⇒ √(帆² ＋ 基底²)；倒車 ⇒ 帆² − 基底²（負 ＝ 往後）；手動沒按住 ⇒ 只有帆；進水、降旗、讓砲線照樣慢
  if (sh.spd0) { sh.spd = target; sh.spd0 = false; }                    // 開局就在走
  sh.spd += (target - sh.spd) * Math.min(1, dt / (stop || sh.throttle < 1 ? 6 : 20));     // 停船：收帆、轉進風裡，6 秒內停下
  // 舵
  sh.throttle = 1;                                                      // 油門每一步重設（戰列跟隨、讓開砲線要放慢才改；下一步的目標航速才用到）
  var foe = foeOf(sh), tY = sh.yaw, rate = 0;
  var wheel = sh.models.some(function (m) { return m.kind === 'wheel' && m.alive; });
  var rud = sh.models.filter(function (m) { return m.kind === 'rudder'; }), rudK = rud.length && !rud.some(function (m) { return m.alive; }) ? 0.12 : 1;   // 舵是模型（夜隼號）而且被打掉了 ⇒ 只剩調帆轉向
  var rmax = (0.012 + 0.016 * Math.abs(sh.spd) / SPK) * (wheel ? 1 : 0.35) * rudK * (UP === 1 ? 1 : 1 + (UP - 1) * clamp((deg - 90) / 45, 0, 1)) * sh.cfg.agile * playK('agile') * WX.agile;   // 天氣：暴風雨浪大、舵難使 ×0.8。⛔ 用 sh.spd 直接算 ⇒ 調快航速連帶變得更會轉
  if (stop) { sh.rudder = 0; rate = 0; }
  else if (manual && !sh.struck && !sh.sunk) {
    var want = (KEYS.l ? 1 : 0) - (KEYS.r ? 1 : 0);                    // 舵角正 ＝ yaw 變大 ＝ 畫面上左轉
    sh.rudder += clamp(want - sh.rudder, -1.5 * dt, 1.5 * dt);
    rate = sh.rudder * rmax * (sh.spd < 0 ? -1 : 1);                   // 倒退 ⇒ 舵效反過來（左舵 ⇒ 船尾往左、船頭往右）
    if (nogo > 0) {                                                     // 船頭被風推開：往讓船頭離開風的那一側（正頂風 ⇒ 照上次那一側）
      var off = -Math.sin(sh.yaw) * W[0] - Math.cos(sh.yaw) * W[2];     // d(船頭·風吹去的方向)/d(yaw)：正 ＝ yaw 變大會離開風
      if (Math.abs(off) > 0.02) sh.ironSide = off > 0 ? 1 : -1;
      rate += (sh.ironSide || 1) * nogo * IRONS_PUSH * clamp(1 - sh.spd / (VMAX * SPK * 0.5), 0, 1);
      if (nogo > 0.5 && !(SIMT - (sh.ironsT || -99) < 20)) { sh.ironsT = SIMT; note(sh, '頂風失速：帆被吹回來了 —— 帶著速度轉過去，或往下風轉一圈'); }
    }
  } else {
    if (!sh.struck && !sh.sunk && foe) {
      // 這一舷的砲都開不了、另一舷還有 ⇒ 把另一舷轉向敵艦
      var other = sh.side === 'S' ? 'P' : 'S', present = sideGuns(sh, sh.side) || !sideGuns(sh, other) ? sh.side : other, sg = present === 'P' ? 1 : -1;   // sg：敵艦要在畫面左邊（左舷 P）⇒ +1
      var dx = foe.px - sh.px, dz = foe.pz - sh.pz, d = Math.hypot(dx, dz) || 1;
      var R = aiRange();                                                 // 想保持的交戰距離：遠了往敵艦切（遠很多 ⇒ 最多切 1.2 rad，幾乎船頭對著開過去）、近了往外拉（最多 0.4）
      tY = (sg > 0 ? Math.atan2(-dx / d, -dz / d) : Math.atan2(dx / d, dz / d)) + sg * clamp((d - R) / R * 1.5, -0.4, 1.2);   // 敵艦在那一舷正橫的航向 ＋ 距離修正
    }
    var od = ORDERS[sh.i], ld = od && od.mode === 'line' ? SHIPS[od.leader] : null;   // 戰列跟隨（指揮官，53_commander.js cmdHelmLine）：跟著前一艘的船尾
    if (ld && !ld.sunk && !sh.struck && !sh.sunk) { var hl = cmdHelmLine({ x: sh.px, z: sh.pz, yaw: sh.yaw }, { x: ld.px, z: ld.pz, yaw: ld.yaw }); tY = hl.yaw; sh.throttle = hl.throttle; sh.station = hl.station; } else sh.station = null;
    if (od && od.throttle !== undefined && !ld) sh.throttle = od.throttle;   // 指揮官給的油門（戰列的排頭等後面的跟上）
    if (!sh.struck && !sh.sunk) { var av = friendAvoid(sh); if (av === null) av = lineClear(sh); if (av !== null) tY = av; }   // throttle 每一步重設（lineClear 要放慢才改）   // 讓友船 ＞ 讓開友艦的砲線（52_fleet.js；沒有友船 ⇒ null）
    var e = Math.atan2(Math.sin(tY - sh.yaw), Math.cos(tY - sh.yaw));
    rate = clamp(e * 0.5, -rmax, rmax); sh.rudder = rmax > 0 ? rate / rmax : 0;
  }
  sh.yawRate += (rate - sh.yawRate) * Math.min(1, dt / 2);
  sh.yaw += sh.yawRate * dt;
  F = fwd(sh.yaw);
  sh.vel = mul(F, sh.spd);
  sh.px += sh.vel[0] * dt; sh.pz += sh.vel[2] * dt;
  // 航跡：船尾留一條白沫、船頭兩側推出的浪（點精靈，不撞任何東西）；船邊水花開著 ⇒ 換成 13_water.js 的（這裡照樣抽亂數、不放進去）
  if ((sh.wakeT -= dt) <= 0 && sh.spd > 0.4 && sh.sink < 6) {
    sh.wakeT = 0.12; PT_MUTE = PHX.water > 0;
    var T = sh.T, st = M4.pt(sh.M, T.wl0 - 4, T.cy, T.zw);
    spawnPt([st[0] + gauss() * 0.8, seaH(st[0], st[2], SIMT) + 0.06, st[2] + gauss() * 0.8], [0, 0, 0], rr(9, 13), [0.93, 0.96, 1], 0.3 * Math.min(1, sh.spd / 2), rr(1.2, 2), rr(4, 6), 0, 0, 2);
    [1, -1].forEach(function (k) {
      var bw = M4.pt(sh.M, T.wl1 - 25, T.cy + k * T.bowHalf, T.zw), out = M4.dir(sh.M, 0, k, 0); out = norm([out[0], 0, out[2]]);
      spawnPt([bw[0], seaH(bw[0], bw[2], SIMT) + 0.08, bw[2]], mul(out, rr(0.4, 1) * sh.spd * 0.4), rr(1.5, 2.5), [0.95, 0.97, 1], 0.5, rr(0.8, 1.3), rr(2, 3), 0, 0, 2);
    });
    PT_MUTE = false;
  }
}

/** 兩艘的龍骨線（各取 7 點）最近不到 14 公尺 ⇒ 沿那個方向各推開一半、航速掉一點（⛔ 不推 ⇒ 手動開過去會穿船）。
 *  任兩艘都算（TASK-0537；照 SHIPS 的順序兩兩配對，一對一 ＝ 以前那一對）；龍骨線每艘只算一次。 */
function collide() {
  if (SHIPS.length < 2) return;
  function keel(sh) { var T = sh.T, r = []; for (var k = 0; k < 7; k++) r.push(M4.pt(sh.M, T.wl0 + 15 + (T.wl1 - T.wl0 - 30) * k / 6, T.cy, T.zw)); return r; }
  var K = SHIPS.map(keel);
  for (var i = 0; i < SHIPS.length; i++) for (var j = i + 1; j < SHIPS.length; j++) collidePair(SHIPS[i], SHIPS[j], K[i], K[j]);
}
function collidePair(A, B, ka, kb) {
  var best = 1e9, pa = null, pb = null;
  ka.forEach(function (a) { kb.forEach(function (b) { var d = Math.hypot(a[0] - b[0], a[2] - b[2]); if (d < best) { best = d; pa = a; pb = b; } }); });
  if (best >= 14) return;
  var n = best > 1e-3 ? [(pa[0] - pb[0]) / best, 0, (pa[2] - pb[2]) / best] : [0, 0, 1], push = (14 - best) / 2;
  A.px += n[0] * push; A.pz += n[2] * push; B.px -= n[0] * push; B.pz -= n[2] * push;
  A.spd *= 0.97; B.spd *= 0.97;
  wpBump(pa, pb, A, B);                                                // 船邊水花（13_water.js；只給人看）
  if (SIMT - (A.bumpT || -9) > 5) { A.bumpT = SIMT; sfx('crack', pa, 1); note(SHIPS[PLAYER_I], '兩艘擦撞'); }
}
/** 敵艦在哪一舷（給自動操舵用；有遲滯，不在正前／正後來回跳）。只影響操舵 —— 開火是每門砲各自看對不對得到。 */
function chooseSide(sh) {
  var foe = foeOf(sh); if (!foe || !foe.center || sh.struck || sh.sunk) return;   // 開局逐艘量的時候，另一艘可能還沒算過位置
  var st = M4.dir(sh.M, 0, 1, 0), dx = foe.center[0] - sh.center[0], dz = foe.center[2] - sh.center[2];
  var k = (dx * st[0] + dz * st[2]) / ((Math.hypot(dx, dz) || 1) * (Math.hypot(st[0], st[2]) || 1));
  var want = k > 0.2 ? 'S' : k < -0.2 ? 'P' : sh.side;
  if (want === sh.side) return;
  sh.side = want;
}

