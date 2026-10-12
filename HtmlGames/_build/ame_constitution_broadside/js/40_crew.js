// ───────────────────────── 船員（billboard） ─────────────────────────
// 一個人 ＝ 一張面向鏡頭、但永遠直立的貼圖。位置存格座標（腳底那一格的上緣），畫的時候用船的矩陣換到世界。
// 砲要有人操作：人數 < 最少人數就不能開；裝填速度 ∝ (人數／滿編)^0.85。死傷的人不再操作；
// 人不夠時，倖存者集中到還開得動的砲 ⇒ 其餘的砲沒人操作（HUD ○）。調度見 reassign。
var ROLE = { GUN: 0, POWDER: 1, OFFICER: 2, MARINE: 3, TOP: 4, HELM: 5 }, NROLE = 6;
var FR = { IDLE: 0, WORK_A: 1, WORK_B: 2, FIRE: 3, RUN_A: 4, RUN_B: 5, WOUNDED: 6, DEAD: 7 }, NFR = 8;
var CREW_FULL = { long: 6, carr: 3, chase: 4 }, CREW_MIN = { long: 3, carr: 2, chase: 2 };   // 兩舷各一班；24 磅長砲一班 12 人＋送藥童 ⇒ 一個人物約兩人
var ROLE_NAME = ['砲手', '送藥手', '軍官', '陸戰隊', '桅頂水手', '舵手'];
var ART_CAPTAIN = 6, NART = 7;                    // 貼圖的列：0–5 照職位，6 船長（每艘船第一個軍官；職位照舊是軍官）
function standZ(g, x, y, z0, z1, head) {          // (x, y) 這一柱裡，z0..z1 之間可以站的高度（腳下實心、頭上 head 格空）；沒有 ⇒ -1
  for (var z = z1; z >= z0; z--) {
    if (!g.get(x, y, z - 1) || g.get(x, y, z)) continue;
    var ok = true;
    for (var h = 1; h < head; h++) if (g.get(x, y, z + h)) { ok = false; break; }
    if (ok) return z;
  }
  return -1;
}
function standNear(g, x, y, z0, z1, head, taken) {   // (x, y) 附近 4 格內找一個可以站、還沒人站的位置
  for (var r = 0; r <= 4; r++) for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    var k = (x + dx) + ',' + (y + dy); if (taken[k]) continue;
    var z = standZ(g, x + dx, y + dy, z0, z1, head);
    if (z >= 0) { taken[k] = 1; return [x + dx + 0.5, y + dy + 0.5, z]; }
  }
  return null;
}
function makeCrew(sh) {
  var g = BASE, taken = {}, crew = [];
  sh.models.forEach(function (m) { var b = m.bb; for (var x = Math.floor(b[0]) - 1; x <= Math.ceil(b[3]) + 1; x++) for (var y = Math.floor(b[1]) - 1; y <= Math.ceil(b[4]) + 1; y++) taken[x + ',' + y] = 1; });
  function add(role, at, gun, face) { if (at) crew.push({ role: role, home: at, pos: at.slice(), gun: gun, face: face || 1, st: 0, t: rnd() * 10, walk: null, fireT: 0, shotT: rr(2, 6), lost: 0 }); }
  sh.guns.forEach(function (gn) {
    var b, z0, z1, xs, ys, i, n = CREW_FULL[gn.type];
    if (gn.type === 'long') { b = gn.box; z0 = b[2] - 8; z1 = b[2] + 3; }
    else if (gn.type === 'chase') { b = gn.model.bb.map(Math.floor); z0 = b[2] - 3; z1 = b[2] + 3; }
    else { b = gn.model.bb.map(Math.floor); z0 = b[2] - 6; z1 = b[2] + 3; }
    var cx = Math.floor((b[0] + b[3]) / 2), sg = gn.side === 'P' ? -1 : 1, y0 = sg > 0 ? b[1] : b[4];
    // 砲的兩側、砲尾後面（inboard：S 那一舷的砲是 y 小的那邊、P 那一舷的砲是 y 大的那邊）
    var spots = [[b[0] - 3, y0 + 10 * sg], [b[3] + 3, y0 + 10 * sg], [b[0] - 3, y0 + 4 * sg], [b[3] + 3, y0 + 4 * sg], [b[0] - 2, y0 - 3 * sg], [b[3] + 2, y0 - 3 * sg], [cx, y0 - 6 * sg], [cx - 5, y0 - 10 * sg]];
    gn.crewFull = n; gn.crewMin = CREW_MIN[gn.type]; gn.spots = [];
    for (i = 0; i < n; i++) {
      var at = standNear(g, spots[i][0], spots[i][1], z0, z1, 14, taken);
      if (!at) continue;
      add(ROLE.GUN, at, gn, 1); var c = crew[crew.length - 1]; c.deck = gunDeck(gn); c.side = gn.side; gn.spots.push({ at: at, who: c });
    }
  });
  // 送藥手：每三門長砲一個，在中線的艙口與砲之間來回
  ['S', 'P'].forEach(function (side) { sh.guns.filter(function (gn) { return gn.type === 'long' && gn.side === side; }).forEach(function (gn, i) {
    if (i % 3) return;
    var sg = side === 'P' ? -1 : 1, b = gn.box, at = standNear(g, Math.floor((b[0] + b[3]) / 2), sg > 0 ? b[1] - 14 : b[4] + 14, b[2] - 8, b[2] + 3, 12, taken);
    var hatch = at && standNear(g, Math.floor(at[0]), CY + 6 * sg, b[2] - 8, b[2] + 3, 12, taken);         // 往中線（艙口旁）跑，目的地也要站得住
    if (at && hatch) { add(ROLE.POWDER, at, null, 1); crew[crew.length - 1].run = [at.slice(), hatch]; }
  }); });
  // spar deck 的高度：從 carronade 推；陸戰隊沿 S 那一舷（格 +y）的舷牆、軍官在後甲板、舵手在舵輪旁
  var carr = sh.models.filter(function (m) { return m.kind === 'carr'; }), wheel = sh.models.filter(function (m) { return m.kind === 'wheel'; })[0];
  var sz0 = carr.length ? Math.floor(carr[0].bb[2]) - 6 : 100, sz1 = sz0 + 9;
  for (var x = HULL_X0 + 160; x < HULL_X1 - 220 && crew.filter(function (c) { return c.role === ROLE.MARINE; }).length < 12; x += 37) {
    // 從中線往外走到舷牆前一格（⛔ 從外往裡掃會先碰到舷外的 channels 平台）
    var last = -1;
    for (var y = CY + 4; y < CY + 80; y++) { if (standZ(g, x, y, sz0, sz1, 14) >= 0) last = y; else if (last >= 0) break; }
    if (last >= 0) add(ROLE.MARINE, standNear(g, x, last - 2, sz0, sz1, 14, taken), null, 1);
  }
  var qx = wheel ? Math.floor(wheel.c[0]) : HULL_X0 + 160;
  [[qx + 22, CY + 8], [qx + 30, CY - 6], [qx + 40, CY + 14], [qx + 14, CY - 12]].forEach(function (p) { add(ROLE.OFFICER, standNear(g, p[0], p[1], sz0, sz1, 14, taken), null, 1); });
  var cap = crew.filter(function (c) { return c.role === ROLE.OFFICER; })[0]; if (cap) cap.art = ART_CAPTAIN;   // 船長：只換貼圖
  if (wheel) [[qx - 4, CY + 3], [qx - 4, CY - 3]].forEach(function (p) { add(ROLE.HELM, standNear(g, p[0], p[1], sz0, sz1, 14, taken), null, -1); });
  // 桅頂：每根桅的平台上找四個可以站的位置
  sh.masts.forEach(function (m) {
    var found = 0;
    for (var z = 250; z < 470 && found < 4; z += 1) for (var k = 0; k < 8 && found < 4; k++) {
      var a = k / 8 * 6.2832, px = Math.round(m.x + Math.cos(a) * 11), py = Math.round(CY + Math.sin(a) * 11);
      if (taken[px + ',' + py + ',' + z]) continue;
      if (g.get(px, py, z - 1) && !g.get(px, py, z) && !g.get(px, py, z + 6)) { taken[px + ',' + py + ',' + z] = 1; add(ROLE.TOP, [px + 0.5, py + 0.5, z], null, 1); found++; }
    }
  });
  return crew;
}
function able(c) { return c.st === 0; }
/** 每門砲現在有幾個人在崗（走過去的路上不算）。 */
function manning(sh) {
  sh.guns.forEach(function (g) { g.manned = 0; });
  sh.crew.forEach(function (c) { if (able(c) && c.gun && !c.walk) c.gun.manned++; });
}
/** 重新分派（每半秒），每層甲板各自來：
 *  ① 開得動的砲（在崗 ≥ crewMin）留著，人不動；
 *  ② 開不了的砲照在崗人數多到少，向「最近的空閒的人、或同樣開不了的砲」借人，借到能開就留下 ⇒ 人只走到隔壁幾門；
 *  ③ 借不夠的砲人放出來；空閒的人夠一整門才去開空砲，剩下的補滿留下的砲（都挑最近的）。
 *  只有換砲的人才走路。砲甲板 ＝ 長砲＋追擊砲（同一層、人可以互補）；上甲板 ＝ carronade。 */
function reassign(sh) {
  sh.crew.forEach(function (c) { if (c.gun && (!able(c) || !c.gun.alive)) leaveGun(c); });
  [['long', 'S'], ['long', 'P'], ['carr', 'S'], ['carr', 'P']].forEach(function (ds) {        // 每層甲板、每一舷各自調度
    var deck = ds[0], side = ds[1];
    var gs = sh.guns.filter(function (g) { return g.alive && g.side === side && gunDeck(g) === deck; });
    var men = sh.crew.filter(function (c) { return able(c) && c.role === ROLE.GUN && c.deck === deck && c.side === side; });
    var cur = new Map(); gs.forEach(function (g) { cur.set(g, 0); });
    men.forEach(function (c) { if (c.gun) cur.set(c.gun, cur.get(c.gun) + 1); });
    var kept = new Set(gs.filter(function (g) { return cur.get(g) >= g.crewMin; }));
    function short(c) { return !c.gun || (!kept.has(c.gun) && cur.get(c.gun) < c.gun.crewMin); }
    function move(c, g) {                        // c 換到 g
      if (c.gun) { cur.set(c.gun, cur.get(c.gun) - 1); leaveGun(c); }
      c.gun = g; cur.set(g, cur.get(g) + 1); goToGun(sh, c, g);
    }
    function nearest(list, g) { var bi = 0, bd = 1e9; list.forEach(function (c, i) { var d = Math.abs(g.muz[0] - c.pos[0]); if (d < bd) { bd = d; bi = i; } }); return list.splice(bi, 1)[0]; }
    gs.filter(function (g) { return !kept.has(g) && cur.get(g) > 0; })
      .sort(function (a, b) { return cur.get(b) - cur.get(a) || gs.indexOf(a) - gs.indexOf(b); })
      .forEach(function (g) {
        if (!cur.get(g)) return;                                           // 已經被別門借光
        var pool = men.filter(function (c) { return c.gun !== g && short(c); });
        if (cur.get(g) + pool.length < g.crewMin) return;                  // 借不夠 ⇒ 這門是借出去的那一方
        while (cur.get(g) < g.crewMin) move(nearest(pool, g), g);
        kept.add(g);
      });
    men.forEach(function (c) { if (c.gun && !kept.has(c.gun)) { cur.set(c.gun, cur.get(c.gun) - 1); leaveGun(c); } });
    var free = men.filter(function (c) { return !c.gun; });
    gs.forEach(function (g) {
      if (kept.has(g) || free.length < g.crewMin) return;
      while (cur.get(g) < g.crewMin) move(nearest(free, g), g);
      kept.add(g);
    });
    kept.forEach(function (g) { while (cur.get(g) < g.crewFull && free.length) move(nearest(free, g), g); });
  });
}
function gunDeck(g) { return g.type === 'carr' ? 'carr' : 'long'; }
/** 離開原本那門砲：站位讓出來（⛔ 不清 ⇒ 幾輪之後每個站位都被兩個人佔著）。 */
function leaveGun(c) {
  if (c.gun && c.gun.spots) c.gun.spots.forEach(function (s) { if (s.who === c) s.who = null; });
  c.gun = null;
}
/** 走去新砲：挑一個沒人、腳下還有甲板的站位；都沒有 ⇒ 在第一個站位附近重新找站得住的格（⛔ 退路不能落在砲身裡）。 */
function goToGun(sh, c, g) {
  var spot = (g.spots || []).filter(function (s) {
    if (s.who && able(s.who) && s.who.gun === g) return false;
    var x = Math.floor(s.at[0]), y = Math.floor(s.at[1]);
    return countBox(sh.grid, x - 1, y - 1, s.at[2] - 1, x + 1, y + 1, s.at[2] - 1) > 0;
  })[0];
  var to = spot ? spot.at : null;
  if (!to && g.spots && g.spots.length) { var a = g.spots[0].at; to = standNear(sh.grid, Math.floor(a[0]), Math.floor(a[1]), a[2] - 2, a[2] + 2, 14, {}); }
  if (!to) to = c.pos;
  if (spot) spot.who = c;
  c.walk = { to: to.slice(), sp: 18 };
}
/** 這一點附近的人：近的死、稍遠的傷（r 格數）。dir（格座標的單位向量）給了 ⇒ 前方（碎屑噴的方向）的範圍拉長。 */
function hurt(sh, L, rKill, rWound, dir, cause) {
  var k = 0, w = 0;
  sh.crew.forEach(function (c) {
    if (c.st > 1) return;
    var d = sub([c.pos[0], c.pos[1], c.pos[2] + 9], L), dist = len(d);
    if (dir) { var along = dot(d, dir); if (along > 0) dist = Math.sqrt(Math.max(0, dist * dist - along * along * 0.75)); }  // 前方的碎屑錐
    if (dist < rKill && rnd() < 0.85) { killCrew(sh, c, cause); k++; }
    else if (dist < rWound && rnd() < 0.55) { if (c.st === 0) { woundCrew(sh, c, cause); w++; } else if (rnd() < 0.4) { killCrew(sh, c, cause); k++; } }
  });
  return k + w;
}
function woundCrew(sh, c, cause) { if (c.st !== 0) return; c.st = 1; c.t = 0; c.walk = null; sh.wounded++; sh.causes[cause] = (sh.causes[cause] || 0) + 1; }
function killCrew(sh, c, cause) {
  if (c.st >= 2) return;
  if (c.st === 1) sh.wounded--;
  c.st = 2; c.t = 0; c.walk = null; sh.dead++; sh.causes[cause] = (sh.causes[cause] || 0) + 1;
}
/** 掉下去：腳下那一格沒了（甲板被打穿、桅頂跟著桅倒）⇒ 換成世界座標的落體，落水算失蹤（亡）。 */
function fall(sh, c, v) {
  if (c.st >= 2 && c.st !== 2) return;
  var w = M4.pt(sh.M, c.pos[0], c.pos[1], c.pos[2]);
  if (c.st < 2) { if (c.st === 1) sh.wounded--; sh.dead++; sh.causes['落水'] = (sh.causes['落水'] || 0) + 1; }
  c.st = 4; c.fw = w; c.fv = add(v || [gauss(), rr(0, 2), gauss()], sh.vel); c.t = 0; c.walk = null;
}
function stepCrew(sh, dt) {
  sh.crew.forEach(function (c) {
    c.t += dt;
    if (c.st === 4) {                                   // 落體
      c.fv[1] -= G * dt; c.fw = add(c.fw, mul(c.fv, dt));
      if (c.fw[1] < 0) { if (!c.splashed) { c.splashed = true; splash(c.fw, false); } c.st = 3; }
      return;
    }
    if (c.st === 1 && c.t > 12) { c.st = 3; return; }    // 傷者被抬下去
    if (c.st !== 0) return;
    if (c.walk) {
      var d = sub(c.walk.to, c.pos), l = Math.hypot(d[0], d[1]);
      if (l < 0.6) { c.pos = c.walk.to.slice(); c.home = c.pos.slice(); c.walk = null; }
      else { var s = Math.min(l, c.walk.sp * dt); c.pos[0] += d[0] / l * s; c.pos[1] += d[1] / l * s; }
    } else if (c.run) {                                 // 送藥手來回跑
      var tgt = c.run[Math.floor(c.t / 3) % 2], dd = sub(tgt, c.pos), ll = Math.hypot(dd[0], dd[1]);
      if (ll > 0.5) { var ss = Math.min(ll, 16 * dt); c.pos[0] += dd[0] / ll * ss; c.pos[1] += dd[1] / ll * ss; c.moving = true; } else c.moving = false;
    }
    if ((c.role === ROLE.MARINE || c.role === ROLE.TOP) && !sh.sunk && !sh.struck && !(MODE === 'sandbox' && sh.i !== PLAYER_I)) {   // 陸戰隊與桅頂水手：火槍（沙盒的敵艦不還手）
      c.shotT -= dt; c.fireT -= dt;
      if (c.shotT <= 0) { c.shotT = rr(4, 8); musket(sh, c); }
    }
  });
}
/** 火槍：打對方露天的人（spar deck、桅頂），距離越遠越難中。 */
function musket(sh, c) {
  var foe = SHIPS[1 - sh.i], w = M4.pt(sh.M, c.pos[0], c.pos[1], c.pos[2] + 14);
  var cand = foe.crew.filter(function (o) { return o.st === 0 && o.role !== ROLE.GUN && o.role !== ROLE.POWDER || (o.st === 0 && o.deck === 'carr'); });
  c.fireT = 0.4;
  spawnPt(w, [WIND[0] * 0.3, 0.4, WIND[2] * 0.3], rr(1.5, 2.5), [0.85, 0.85, 0.85], 0.35, 0.3, 1.4, -0.03, 0.8);
  if (!cand.length) return;
  var o = cand[(rnd() * cand.length) | 0], ow = M4.pt(foe.M, o.pos[0], o.pos[1], o.pos[2]), dist = len(sub(ow, w));
  if (rnd() < clamp(0.05 * 100 / dist, 0.01, 0.12)) { if (rnd() < 0.3) killCrew(foe, o, '火槍'); else woundCrew(foe, o, '火槍'); }
}
/** 一門砲：在崗的人數決定能不能開、裝填多快。 */
function gunRate(g) { return g.manned >= g.crewMin ? Math.pow(Math.min(1, g.manned / g.crewFull), 0.85) : 0; }

