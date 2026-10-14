// ───────────────────────── 船員（billboard） ─────────────────────────
// 一個人 ＝ 一張面向鏡頭、但永遠直立的貼圖。位置存格座標（腳底那一格的上緣），畫的時候用船的矩陣換到世界。
// 砲要有人操作：人數 < 最少人數就不能開；裝填速度 ∝ (人數／滿編)^0.85。死傷的人不再操作；
// 人不夠時，倖存者集中到還開得動的砲 ⇒ 其餘的砲沒人操作（HUD ○）。調度見 reassign。
var ROLE = { GUN: 0, POWDER: 1, OFFICER: 2, MARINE: 3, TOP: 4, HELM: 5, HAND: 6 }, NROLE = 6;   // NROLE：貼圖照職位的列數（HAND 預備水手沒有自己那一列，畫成砲手；42_hands.js）
var FR = { IDLE: 0, WORK_A: 1, WORK_B: 2, FIRE: 3, RUN_A: 4, RUN_B: 5, WOUNDED: 6, DEAD: 7 }, NFR = 8;
// 砲班：滿編／最少照砲種表（GUNS 的 crew／min，10_ship.js）—— 兩舷各一班；24 磅長砲一班 12 人＋送藥童 ⇒ 一個人物約兩人
// Tim 2026-10-12：砲班減一人（長砲 6 → 5、追擊砲 4 → 3），多出來的去搬火藥與彈藥（送藥手，23_powder.js）；射速照舊（裝填 ∝ 在崗／滿編）
var ROLE_NAME = ['砲手', '送藥手', '軍官', '陸戰隊', '桅頂水手', '舵手', '水手'];
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
var CREW_BLOCK = [];                               // 站位要避開的模型（砲、舵輪）：外框外擴 1 格、而且高度對得上那一層甲板
function blocked(x, y, z) {
  for (var i = 0; i < CREW_BLOCK.length; i++) {
    var b = CREW_BLOCK[i].bb;
    if (x >= Math.floor(b[0]) - 1 && x <= Math.ceil(b[3]) + 1 && y >= Math.floor(b[1]) - 1 && y <= Math.ceil(b[4]) + 1 && z >= b[2] - 3 && z <= b[5]) return true;
  }
  return false;
}
function standNear(g, x, y, z0, z1, head, taken, rmax) {   // (x, y) 附近 rmax 格內（沒給 ＝ 4）找一個可以站、還沒人站、不在模型裡的位置
  for (var r = 0; r <= (rmax || 4); r++) for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    var k = (x + dx) + ',' + (y + dy); if (taken[k]) continue;
    var z = standZ(g, x + dx, y + dy, z0, z1, head);
    if (z >= 0 && !blocked(x + dx, y + dy, z)) { taken[k] = 1; return [x + dx + 0.5, y + dy + 0.5, z]; }
  }
  return null;
}
function makeCrew(sh) {
  var g = sh.T.base, CY = sh.T.cy, HULL_X0 = sh.T.hx0, HULL_X1 = sh.T.hx1, taken = {}, crew = [];
  sh.cw = shipCrew(sh.T.id); sh.pmWant = 0;                          // 船員配置（05_hull.js：預設 ← 船隻配置頁）；pmWant：送藥手該有幾個（23_powder.js makeMonkeys 數）
  // ⛔ 以前用平面的 taken 標模型外框：長砲改成模型之後，砲甲板的砲把上面 spar deck 的站位也佔掉了；火藥桶（艙底）更把大半個平面佔掉
  CREW_BLOCK = sh.models.filter(function (m) { return m.kind !== 'powder' || m.station; });   // 取用點的桶在甲板上 ⇒ 要避
  function add(role, at, gun, face) { if (at) crew.push({ role: role, home: at, pos: at.slice(), gun: gun, face: face || 1, st: 0, t: rnd() * 10, walk: null, fireT: 0, shotT: rr(2, 6), lost: 0, hp: CREW_HP, hitT: 0 }); }
  sh.guns.forEach(function (gn) {
    var b = gn.model.bb.map(Math.floor), z0, z1, i, n = Math.min(gunCrew(sh.cw, gn.type), GUN_CREW_MAX);   // 砲班滿編（船隻配置；預設 ＝ 砲種表）
    if (gn.type === 'chase') { z0 = b[2] - 3; z1 = b[2] + 3; }
    else if (gn.type === 'carr') { z0 = b[2] - 6; z1 = b[2] + 3; }
    else { z0 = b[2] - 8; z1 = b[2] + 3; }                            // 長砲（24、32 磅）
    var cx = Math.floor((b[0] + b[3]) / 2), sg = gn.side === 'P' ? -1 : 1, y0 = sg > 0 ? b[1] : b[4], spots;
    if (Math.abs(gn.ax[0]) <= Math.abs(gn.ax[1])) {
      // 往舷外開的砲（舷側砲、偏正橫的追擊砲）：砲的兩側（沿 x）、砲尾後面（inboard：S 那一舷的砲是 y 小的那邊、P 那一舷的砲是 y 大的那邊）
      spots = [[b[0] - 3, y0 + 10 * sg], [b[3] + 3, y0 + 10 * sg], [b[0] - 3, y0 + 4 * sg], [b[3] + 3, y0 + 4 * sg], [b[0] - 2, y0 - 3 * sg], [b[3] + 2, y0 - 3 * sg], [cx, y0 - 6 * sg], [cx - 5, y0 - 10 * sg]];
    } else {
      // 往船頭／船尾開的砲（餘燼號的船尾追擊砲：砲軸 −170°～−175°）：同一個排法轉 90° —— 砲的兩側（沿 y）、砲尾往船裡那一頭（沿 x）。
      // ⛔ 照上面那組排 ⇒ 站位落在船尾板外面或砲身上，四門船尾追擊砲各只找到 1 個位置、一個砲手都分不到（0／3），永遠開不了
      var ex = gn.ax[0] > 0 ? 1 : -1, x0 = ex > 0 ? b[0] : b[3], cyg = Math.floor((b[1] + b[4]) / 2);
      spots = [[x0 + 10 * ex, b[1] - 3], [x0 + 10 * ex, b[4] + 3], [x0 + 4 * ex, b[1] - 3], [x0 + 4 * ex, b[4] + 3], [x0 - 3 * ex, b[1] - 2], [x0 - 3 * ex, b[4] + 2], [x0 - 6 * ex, cyg], [x0 - 10 * ex, cyg - 5]];
    }
    gn.crewFull = n; gn.crewMin = GUNS[gn.type].min; gn.crewStd = GUNS[gn.type].crew; gn.spots = [];   // crewStd：射速照砲種表的人數算（多的人是替補，gunRate）
    for (i = 0; i < n; i++) {
      var at = standNear(g, spots[i][0], spots[i][1], z0, z1, 14, taken);
      if (!at) continue;
      add(ROLE.GUN, at, gn, 1); var c = crew[crew.length - 1]; c.deck = gunDeck(gn); c.side = gn.side; gn.spots.push({ at: at, who: c });
    }
    if (gn.spots.length < Math.min(n, gn.crewMin)) {                  // 站不到開得動的人數（三叉戟號船頭：6 磅砲擠在三叉戟砲旁邊，兩側被它的模型與砲班佔掉，各只站得到 1 個 ⇒ 開局就是灰的）
      var gy = Math.floor((b[1] + b[4]) / 2);                          //   ⇒ 補到最少人數為止：以砲為中心往外找同一層站得住、沒被佔的格（放寬到 3 m）；照舊找得到的砲不走這裡 ⇒ 其他船一位元不動
      for (i = gn.spots.length; i < n && gn.spots.length < gn.crewMin; i++) {
        var at2 = standNear(g, cx, gy, z0, z1, 14, taken, 30); if (!at2) break;
        add(ROLE.GUN, at2, gn, 1); var c2 = crew[crew.length - 1]; c2.deck = gunDeck(gn); c2.side = gn.side; gn.spots.push({ at: at2, who: c2 });
      }
    }
    if (gn.spots[1]) gn.spots[1].who.rammer = true;                  // 只給畫用：裝填時拿推彈桿的那一個（41_crew_art.js 手持物）
  });
  // 送藥手：每一對砲（同一個 x 的兩舷）一個，從那一層的取用點搬火藥與彈藥到要裝填的砲（23_powder.js makeMonkeys／stepMonkey）
  makeMonkeys(sh, crew, taken, add);
  // spar deck 的高度：從 carronade 推；陸戰隊沿 S 那一舷（格 +y）的舷牆、軍官在後甲板、舵手在舵輪旁
  var carr = sh.models.filter(function (m) { return m.kind === 'carr'; }), wheel = sh.models.filter(function (m) { return m.kind === 'wheel'; })[0];
  var GZ = sh.T.geo, CW = sh.cw, sz0 = carr.length ? Math.floor(carr[0].bb[2]) - 6 : GZ.spar ? GZ.spar[0] : 100, sz1 = carr.length || !GZ.spar ? sz0 + 9 : GZ.spar[1];   // 沒有 carronade ⇒ 船型給的高度（05_hull.js GEO0；夜隼號主甲板到後甲板）
  for (var x = HULL_X0 + GZ.marines[0]; x < HULL_X1 - GZ.marines[1] && crew.filter(function (c) { return c.role === ROLE.MARINE; }).length < CW.marines; x += CW.marineGap) {   // 每 marineGap 格一個、最多 marines 個（船員配置）
    // 從中線往外走到舷牆前一格（⛔ 從外往裡掃會先碰到舷外的 channels 平台）
    var last = -1, m0 = sz0, m1 = sz1;
    if (GZ.spar) {   // 船型給了站人的範圍（夜隼號 z 28–47：主甲板到後甲板，舷側的繫繩欄、錨鏈台頂也在裡面 ⇒ 陸戰隊站到船殼外 y 113–116）⇒ 只看這一段甲板 −1～+2 格
      var zd = -1; for (var z = sz0; z <= sz1 && zd < 0; z++) if (standZ(g, x, CY + 10, z, z, 14) >= 0) zd = z;   // 最低那一層 ＝ 甲板（甲板上的東西都比它高）
      if (zd < 0) continue; m0 = zd - 1; m1 = zd + 2;
    }
    for (var y = CY + 4; y < CY + 80; y++) { if (standZ(g, x, y, m0, m1, 14) >= 0) last = y; else if (last >= 0) break; }
    if (last >= 0) add(ROLE.MARINE, standNear(g, x, last - 2, m0, m1, 14, taken), null, 1);
  }
  var qx = wheel ? Math.floor(wheel.c[0]) : HULL_X0 + 160;
  [[qx + 22, CY + 8], [qx + 30, CY - 6], [qx + 40, CY + 14], [qx + 14, CY - 12], [qx + 48, CY - 2], [qx + 22, CY - 20], [qx + 36, CY + 22], [qx + 56, CY + 10]].slice(0, CW.officers).forEach(function (p) { add(ROLE.OFFICER, standNear(g, p[0], p[1], sz0, sz1, 14, taken), null, 1); });   // 後四個給船隻配置頁多調的
  crew.filter(function (c) { return c.role === ROLE.OFFICER; }).forEach(function (c, k) { c.rank = k; if (!k) c.art = ART_CAPTAIN; });   // 階級照順序：船長（換貼圖）、大副、二副、三副、見習軍官（廣播用，61_hud.js newsCrew）
  if (wheel) { var wx = Math.floor(wheel.bb[0]) - 3; [[wx, CY + 3], [wx, CY - 3], [wx - 5, CY + 7], [wx - 5, CY - 7]].slice(0, CW.helm).forEach(function (p) { add(ROLE.HELM, standNear(g, p[0], p[1], sz0, sz1, 14, taken), null, -1); }); }   // 舵輪後面（⛔ 舵輪中心往後 4 格還在舵輪的外框裡 ⇒ 以前一個舵手都站不上去）
  // 桅頂：每根桅最低的那層平台（從那根桅最低的橫帆桁往上，第一層有 6 個以上站得住的點；沒有帆桁 meta ⇒ 從 z 200）上分散站四個人；頭頂 1.4 m 空（同一般站位）。
  //   憲法號：前桅 263、主桅 286、後桅 241（帆桁 254／276／232 ⇒ 跟以前從 200 找一樣）；夜隼號：前桅 127、主桅 137。
  //   ⛔ 從 250 找 ⇒ 跳過後桅的桅頂；⛔ 不夠四個就往上找 ⇒ 站到 377–465 的高處橫桁上；⛔ 頭頂只看 0.6 m
  var TOP_A = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15], TOP_R = [12, 15, 9, 18];   // 角度照「先對角、再補中間」排 ⇒ 四個人分散在平台四周
  function topSpot(m, k, r, z) {
    var a = k / 16 * 6.2832, px = Math.round(m.x + Math.cos(a) * r), py = Math.round(CY + Math.sin(a) * r);
    if (taken[px + ',' + py + ',' + z] || !g.get(px, py, z - 1) || g.get(px, py, z)) return null;
    for (var h = 1; h < 14; h++) if (g.get(px, py, z + h)) return null;
    return [px, py];
  }
  if (CW.top > 0) sh.masts.forEach(function (m) {
    for (var z = m.z0top || 200; z < 470; z++) {
      var n = 0; TOP_A.forEach(function (k) { TOP_R.forEach(function (r) { if (topSpot(m, k, r, z)) n++; }); });
      if (n < 6) continue;
      var found = 0;
      TOP_A.forEach(function (k) {
        for (var i = 0; i < TOP_R.length && found < CW.top; i++) { var p = topSpot(m, k, TOP_R[i], z); if (p) { taken[p[0] + ',' + p[1] + ',' + z] = 1; add(ROLE.TOP, [p[0] + 0.5, p[1] + 0.5, z], null, 1); found++; return; } }
      });
      return;
    }
  });
  makeHands(sh, crew, add);                                          // 預備水手：最後才生（數量 0 ⇒ 跟以前一樣，rnd() 一個都不多抽）
  medInit(sh);                                                       // 醫療艙走得到的床、要幾個人手（44_medic.js；沒有 ⇒ sh.med ＝ null，照舊）
  // 站不下的（船隻配置頁調多了、船小）⇒ 記著，開戰時上方廣播一行（52_fleet.js crewShortNote）；⛔ 不默默少人
  function cnt(r) { return crew.filter(function (c) { return c.role === r; }).length; }
  //   ⚠ 預設本來就有站不下的（憲法號陸戰隊 11／12、送藥手 26／27；夜隼號陸戰隊 2／12）：開戰只報玩家改過的那幾項（61_hud.js crewShortNote），全部照實列在船隻配置頁（CREW_SEEN）
  sh.crewShort = [['砲班', sh.guns.reduce(function (a, gn) { return a + gn.crewFull; }, 0), cnt(ROLE.GUN), 'guns'], ['送藥手', sh.pmWant, cnt(ROLE.POWDER), 'monkeys'], ['軍官', CW.officers, cnt(ROLE.OFFICER), 'officers'],
    ['舵手', wheel ? CW.helm : 0, cnt(ROLE.HELM), 'helm'], ['陸戰隊', CW.marines, cnt(ROLE.MARINE), 'marines'], ['桅頂水手', CW.top * sh.masts.length, cnt(ROLE.TOP), 'top'], ['預備水手', CW.hands, cnt(ROLE.HAND), 'hands']].filter(function (r) { return r[2] < r[1]; });
  CREW_SEEN[sh.T.id] = { n: crew.length, short: sh.crewShort, sig: crewSig(CW) };
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
 *  只有換砲的人才走路。每層砲甲板（照砲的高度分，sh.decks）各自調度：憲法號 ＝ 砲甲板（長砲＋追擊砲）／上甲板（carronade）。 */
function reassign(sh) {
  sh.crew.forEach(function (c) { if (c.gun && (!able(c) || !c.gun.alive || c.gun.wet)) leaveGun(c); });   // wet：砲口泡在水裡（43_swim.js）
  var ds2 = []; sh.decks.forEach(function (D) { ds2.push([D.key, 'S'], [D.key, 'P']); });
  ds2.forEach(function (ds) {                                          // 每層甲板、每一舷各自調度
    var deck = ds[0], side = ds[1];
    var gs = sh.guns.filter(function (g) { return g.alive && !g.wet && g.side === side && gunDeck(g) === deck; });
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
function gunDeck(g) { return g.deck; }                  // 那門砲在哪一層（10_ship.js gunDecks）
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
/** 這一點附近的人扣血（r 格數）：rKill 內吃滿基準傷害 base，rKill～rWound 從 0.55 遞減到 0.1，再乘 0.6～1.4 的隨機。
 *  base ＝ 1.4 × 每發傷害 × 彈種對人倍率（crewBase）⇒ 24 磅實心 140：rKill 內約 85% 當場陣亡（跟以前的 0.85 對齊）。
 *  dir（格座標的單位向量）給了 ⇒ 前方（碎屑噴的方向）的範圍拉長。list：只看這幾個人（砲彈掠過，21_gunnery.js ballNear 先挑好的；沒給 ⇒ 全船）。 */
function hurt(sh, L, rKill, rWound, dir, cause, base, list) {
  var n = 0;
  (list || sh.crew).forEach(function (c) {
    if (c.st > 1) return;
    var d = sub([c.pos[0], c.pos[1], c.pos[2] + 9], L), dist = len(d);
    if (dir) { var along = dot(d, dir); if (along > 0) dist = Math.sqrt(Math.max(0, dist * dist - along * along * 0.75)); }  // 前方的碎屑錐
    if (dist >= Math.max(rKill, rWound)) return;
    var f = dist < rKill ? 1 : 0.55 - 0.45 * (dist - rKill) / (rWound - rKill);
    damageCrew(sh, c, base * f * rr(0.6, 1.4), cause); n++;
  });
  return n;
}
/** 船員扣血：歸零陣亡；掉到一半以下受傷倒下（之後再被打到照樣扣，歸零才算陣亡）；一半以上照常作戰，只閃紅。 */
function damageCrew(sh, c, dmg, cause) {
  if (c.st > 1 || !(dmg > 0)) return;
  if (c.cart) cartHit(sh, c, dmg);                   // 手上的藥包：吃到夠重的一下就著火（23_powder.js）
  c.hp -= dmg; c.hitT = 0.4;
  if (c.hp <= 0) killCrew(sh, c, cause);
  else if (c.hp < CREW_HP * 0.5 && c.st === 0) woundCrew(sh, c, cause);
}
function woundCrew(sh, c, cause) { if (c.st !== 0) return; c.st = 1; c.t = 0; c.walk = null; c.cart = false; c.moving = false; sh.wounded++; sh.wounds++; sh.causes[cause] = (sh.causes[cause] || 0) + 1; newsCrew(sh, c, false, cause); }
function killCrew(sh, c, cause) {
  if (c.st >= 2) return;
  if (c.st === 1) sh.wounded--;
  c.fromW = c.st === 1;                               // 只給畫用：從跪著倒下（不是從站直倒）
  c.st = 2; c.t = 0; c.walk = null; c.cart = false; c.moving = false; c.hp = Math.min(c.hp, 0); sh.dead++; sh.kills++; sh.causes[cause] = (sh.causes[cause] || 0) + 1; newsCrew(sh, c, true, cause);
}
/** 掉下去：腳下那一格沒了（甲板被打穿、桅頂跟著桅倒）⇒ 換成世界座標的落體，落水算失蹤（亡）。 */
function fall(sh, c, v) {
  if (c.st >= 2 && c.st !== 2) return;
  var w = M4.pt(sh.M, c.pos[0], c.pos[1], c.pos[2]);
  if (c.st < 2 && DROWN_T > 0) { if (c.st === 1) { sh.wounded--; c.hurtSwim = true; } c.fellAlive = true; }   // 落水求生（43_swim.js）：先不算陣亡，落到水裡變成在游
  else if (c.st < 2) { if (c.st === 1) sh.wounded--; sh.dead++; sh.kills++; sh.causes['落水'] = (sh.causes['落水'] || 0) + 1; newsCrew(sh, c, true, '落水'); }
  c.st = 4; c.fw = w; c.fv = add(v || [gauss(), rr(0, 2), gauss()], sh.vel); c.t = 0; c.walk = null; c.cart = false; c.moving = false;
}
function stepCrew(sh, dt) {
  sh.navN = HAND_PATHS;                                 // 預備水手這一步還能找幾次路（42_hands.js）
  sh.crew.forEach(function (c) {
    c.t += dt; if (c.hitT > 0) c.hitT -= dt;            // hitT：被打中但沒倒下的閃紅
    if (c.st === 4) {                                   // 落體
      c.fv[1] -= G * dt; c.fw = add(c.fw, mul(c.fv, dt));
      if (c.fw[1] < seaH(c.fw[0], c.fw[2], SIMT)) { if (!c.splashed) { c.splashed = true; splash(c.fw, false); } if (c.fellAlive) { c.fellAlive = false; toSwim(sh, c, [c.fw[0], c.fw[1] - 1.2, c.fw[2]]); } else c.st = 3; }
      return;
    }
    if (c.st === 5) { stepSwim(sh, c, dt); return; }      // 在水裡（43_swim.js）
    if (c.st === 1) { if (!(sh.med && medHold(sh, c)) && c.t > 12) c.st = 3; return; }   // 傷者被抬下去；有醫療艙送得到 ⇒ 等預備水手搬、被扛著跟著走（44_medic.js）
    if (c.st !== 0) return;
    if (c.role === ROLE.HAND) { stepHand(sh, c, dt); return; }   // 預備水手：走路、爬梯子、補位（42_hands.js）
    if (c.walk) {
      var d = sub(c.walk.to, c.pos), l = Math.hypot(d[0], d[1]);
      if (l < 0.6) { c.pos = c.walk.to.slice(); c.home = c.pos.slice(); c.walk = null; }
      else { var s = Math.min(l, c.walk.sp * dt); c.pos[0] += d[0] / l * s; c.pos[1] += d[1] / l * s; }
    } else if (c.role === ROLE.POWDER) stepMonkey(sh, c, dt);   // 送藥手：取用點 ⇄ 砲
    if ((c.role === ROLE.MARINE || c.role === ROLE.TOP) && !sh.sunk && !sh.struck && !(MODE === 'sandbox' && sh.i !== PLAYER_I)) {   // 陸戰隊與桅頂水手：火槍（沙盒的敵艦不還手）
      c.shotT -= dt; c.fireT -= dt;
      if (c.shotT <= 0) { c.shotT = rr(4, 8); musket(sh, c); }
    }
  });
  if (sh.xfer) swimXfer(sh);                            // 游到敵艦的人換名單（43_swim.js；跑完 forEach 才換）
}
/** 火槍：打對方露天的人（spar deck、桅頂），距離越遠越難中。 */
function musket(sh, c) {
  var foe = foeOf(sh), w = M4.pt(sh.M, c.pos[0], c.pos[1], c.pos[2] + 14);
  if (!foe) return;
  var cand = foe.crew.filter(function (o) { return o.st === 0 && (o.role !== ROLE.GUN && o.role !== ROLE.POWDER && o.role !== ROLE.HAND || o.deck === foe.weatherDeck); });   // 露天的人（最上面那層砲甲板的砲班、走到那一層的預備水手也算）
  c.fireT = 0.4;
  spawnPt(w, [WIND[0] * 0.3, 0.4, WIND[2] * 0.3], rr(1.5, 2.5) / smokeK(), [0.85, 0.85, 0.85], 0.35, 0.3, 1.4, -0.03, 0.8);
  if (!cand.length) return;
  var o = cand[(rnd() * cand.length) | 0], ow = M4.pt(foe.M, o.pos[0], o.pos[1], o.pos[2]), dist = len(sub(ow, w));
  if (rnd() < clamp(0.05 * 100 / dist, 0.01, 0.12)) damageCrew(foe, o, rr(40, 125), '火槍');   // 血量 100 時約三成一槍斃命（跟以前的 0.3 對齊）
}
/** 一門砲：在崗的人數決定能不能開、裝填多快。 */
function gunRate(g) { return g.wet ? 0 : g.manned >= g.crewMin ? Math.pow(Math.min(1, g.manned / (g.crewStd || g.crewFull)), 0.85) : 0; }   // 照砲種表的人數：滿編調多 ⇒ 多的是替補、射速不再變快；調少 ⇒ 開得動但慢

