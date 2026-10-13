// ───────────────────────── 艦隊（TASK-0537：多船的架構） ─────────────────────────
// 每艘有陣營（sh.team：'blue'／'red'）；「我的對手」不再是 SHIPS[1 − sh.i]，而是 foeOf(sh)：
//   每一步開始時挑一次（pickFoes）—— 玩家點過的那艘（還在、是敵船）優先，否則最近的、還沒沉的敵船；敵船全沉了 ⇒ 最近的那艘（照舊指著它，像以前一樣）。
//   ⇒ 一對一時永遠是另一艘 ⇒ 跟以前一位元都不差。只用船的位置（px、pz）、不抽亂數。
// 友軍跟敵軍只差在挑目標（Tim 2026-10-13）：同陣營不當目標；砲彈照舊打得到每一艘 ⇒ 誤擊照樣扣血、算傷亡（讀數 sh.ff：被友船打中幾發）。
// 瞄準點（sh.aim）是「那艘船」的格座標 ⇒ 一併記是哪艘（sh.aimOn，setAim）；換目標之前瞄的那一點不會被套到另一艘的座標上。
// 船數上限 MAX_SHIPS（00_core.js）：GPU 的格數（陰影圖、船艙遮罩、透視）照它生著色器，執行時只跑場上那幾艘（uNS）。
/** 誤擊的讀數：被友船打中幾發（sh.ff）、打中友船幾發（ffOut）。一顆彈只算一次（跟 hits 同一個 hitOnce）。 */
function ffHit(sh, b) { var o = SHIPS[b.owner]; if (o && o !== sh && o.team === sh.team) { sh.ff = (sh.ff || 0) + 1; o.ffOut = (o.ffOut || 0) + 1; } }
/** 落水的人上不了自己的船 ⇒ 往哪幾艘游（43_swim.js）：友船先、再敵船，各照 SHIPS 的順序（一對一 ＝ [敵艦]）。 */
function swimOthers(sh) { var o = SHIPS.filter(function (x) { return x !== sh; }); return o.filter(function (x) { return x.team === sh.team; }).concat(o.filter(function (x) { return x.team !== sh.team; })); }
function teamIdx(sh) { return sh.team === 'red' ? 1 : 0; }              // 貼圖的列、羅盤的顏色：藍 0、紅 1
function isFoe(a, b) { return !!a && !!b && a !== b && a.team !== b.team; }
function teamShips(team) { return SHIPS.filter(function (o) { return o.team === team; }); }
function pickFoes() {
  SHIPS.forEach(function (sh) {
    var c = SHIPS.filter(function (o) { return isFoe(sh, o); }); if (!c.length) { sh.foe = null; return; }
    if (sh.i === PLAYER_I && sh.aimOn && c.indexOf(sh.aimOn) >= 0 && !sh.aimOn.sunk) { sh.foe = sh.aimOn; return; }   // 玩家點過的那艘
    var live = c.filter(function (o) { return !o.sunk; }); if (live.length) c = live;
    var best = null, bd = 1e18;
    c.forEach(function (o) { var d = (o.px - sh.px) * (o.px - sh.px) + (o.pz - sh.pz) * (o.pz - sh.pz); if (d < bd) { bd = d; best = o; } });
    sh.foe = best;
  });
}
function foeOf(sh) { if (sh.foe === undefined) pickFoes(); return sh.foe; }
/** 瞄準點落在哪艘船（設瞄準點那一刻的那艘；沒有 ⇒ 現在的目標）。 */
function aimShip(sh) { return sh.aim && sh.aimOn ? sh.aimOn : foeOf(sh); }
function setAim(sh, aim, on) { sh.aim = aim; sh.aimOn = aim ? on || foeOf(sh) : null; }
/** 旗艦：那個陣營還沒沉的船裡，開戰時排水量（sh.mass0；還沒算 ⇒ 現算）最大的；全沉了 ⇒ 最大的那艘（Tim 2026-10-13：上方面板只顯示雙方旗艦）。
 *  ⛔ 照「現在」的排水量排 ⇒ 被打掉幾噸就換旗艦、面板一直跳。 */
function flagship(team) {
  var L = teamShips(team), live = L.filter(function (o) { return !o.sunk; }); if (live.length) L = live;
  var best = null, bm = -1;
  L.forEach(function (o) { var m = o.mass0 || shipT(o); if (m > bm) { bm = m; best = o; } });
  return best;
}
function teamTag(sh) { return teamIdx(sh) === 0 ? '（藍）' : '（紅）'; }
function playerTeam() { var me = SHIPS[PLAYER_I]; return me ? me.team : 'blue'; }
function foeTeam() { return playerTeam() === 'blue' ? 'red' : 'blue'; }
/** 那個陣營打完了沒：每艘都沉了或降旗。 */
function teamDown(team) { var L = teamShips(team); return L.length > 0 && L.every(function (o) { return o.sunk || o.struck; }); }
/** 開局的編隊（70_flow.js reset）：每一邊照編成排成縱隊（沿船長方向）、兩邊面對面 ±DIST/2；一邊一艘 ⇒ 跟以前同一個位置。
 *  spec：[{ team, hull }]，一對一 ＝ [我艦, 敵艦]；SHIPS 照這個順序建（i ＝ 序號；我艦是 0）。艘數超過 MAX_SHIPS ⇒ 截掉。 */
var FLEET_GAP = 85;                                                       // 同一邊兩艘之間隔多遠（m，沿船長方向；憲法號水線長 55 m ⇒ 頭尾隔 30 m）
var FLEET_DBG = null;                                                     // ?debug=1 的 __game.fleet([...])：直接給一串（蓋過主選單的編成）
/** 主選單的編成（FLEET_SET，05_hull.js）⇒ 一串：我艦、敵方第一艘、我方其他、敵方其他（一對一 ＝ [我艦, 敵艦]，跟以前同一個順序）。 */
function fleetSpec() {
  if (FLEET_DBG) return FLEET_DBG;
  var b = FLEET_SET[0], r = FLEET_SET[1], L = [{ team: 'blue', hull: b[0] }, { team: 'red', hull: r[0] }];
  b.slice(1).forEach(function (h) { L.push({ team: 'blue', hull: h }); });
  r.slice(1).forEach(function (h) { L.push({ team: 'red', hull: h }); });
  return L;
}
function spawnFleet(spec) {
  spec = spec.slice(0, MAX_SHIPS);
  var n = { blue: 0, red: 0 }, k = { blue: 0, red: 0 };
  spec.forEach(function (f) { n[f.team]++; });
  spec.forEach(function (f, i) {
    var blue = f.team === 'blue', j = k[f.team]++, off = (j - (n[f.team] - 1) / 2) * FLEET_GAP;
    SHIPS.push(makeShip(i, f.team, blue ? 0 : Math.PI, blue ? DIST / 2 : -DIST / 2, HULLT[f.hull], blue ? off : -off));   // 一邊一艘 ⇒ px 0，跟以前一樣
  });
}

// ───────────────────────── 艦隊電腦（TASK-0537 第二段） ─────────────────────────
// 只在同一邊有友船時才起作用（沒有友船 ⇒ 兩支都直接回「沒事」、不抽亂數）⇒ 一對一一位元都不差。
//   ① 讓船：照現在的相對速度 AV_T 秒內，友船的龍骨線會進到離我的不到 AV_NEAR（或已經不到 AV_HARD）⇒ 舵往遠離它的那一側打（蓋過追敵的航向）。
//      同向同速的縱隊（距離不變）不算 ⇒ 開局排成縱隊不會一開始就散開（⛔ 只看距離 ⇒ 縱隊頭尾隔 15 m，開局每一步都在讓）。
//   ② 不隔著友船開砲：電腦（含玩家開了自動開砲）排齊射時，砲口到瞄準點那條線離友船的龍骨線不到 FF_CLEAR 的那門不開（讀數 sh.ffHold：開局以來忍住幾門次）。
//      玩家自己按的齊射照開 —— 誤擊是玩法（Tim 2026-10-13：「有友軍傷害」）。
var FF_CLEAR = 9, AV_NEAR = 22, AV_HARD = 16, AV_T = 15, AV_TURN = 0.8;  // m、m、m、秒、rad（讓船時航向偏離自己船頭多少）；擦撞是 14 m（31_sailing.js collide）
function friendsOf(sh) { return SHIPS.filter(function (o) { return o !== sh && o.team === sh.team && !o.sunk && !o.sinkingFinal; }); }
/** 龍骨線（水線那一段的頭尾，世界座標）。 */
function keelLine(o) { var T = o.T; return [M4.pt(o.M, T.wl0, T.cy, T.zw), M4.pt(o.M, T.wl1, T.cy, T.zw)]; }
/** 兩條線段在水平面（x、z）上最近的距離與最近的兩點。 */
function segSeg(a, b, c, d) {
  function cr(p, q, r) { return (q[0] - p[0]) * (r[2] - p[2]) - (q[2] - p[2]) * (r[0] - p[0]); }
  function ptSeg(p, s0, s1) { var ux = s1[0] - s0[0], uz = s1[2] - s0[2], L = ux * ux + uz * uz, t = L > 0 ? clamp(((p[0] - s0[0]) * ux + (p[2] - s0[2]) * uz) / L, 0, 1) : 0, q = [s0[0] + ux * t, 0, s0[2] + uz * t]; return { d: Math.hypot(p[0] - q[0], p[2] - q[2]), q: q }; }
  if (cr(a, b, c) * cr(a, b, d) < 0 && cr(c, d, a) * cr(c, d, b) < 0) return { d: 0, p: a, q: c };   // 交叉
  var r1 = ptSeg(a, c, d), r2 = ptSeg(b, c, d), r3 = ptSeg(c, a, b), r4 = ptSeg(d, a, b), best = { d: r1.d, p: a, q: r1.q };
  if (r2.d < best.d) best = { d: r2.d, p: b, q: r2.q };
  if (r3.d < best.d) best = { d: r3.d, p: r3.q, q: c };
  if (r4.d < best.d) best = { d: r4.d, p: r4.q, q: d };
  return best;
}
/** 這一門從 from 打到 to，會不會先穿過友船（K：friendKeels 的結果，同一次齊射共用）。 */
function friendKeels(sh) { return friendsOf(sh).map(keelLine); }
function friendInLine(K, from, to) { for (var i = 0; i < K.length; i++) if (segSeg(from, to, K[i][0], K[i][1]).d < FF_CLEAR) return true; return false; }
/** 讓船：要讓 ⇒ 回傳該走的航向；不用 ⇒ null。只看最危險（最近）的那一艘友船。 */
function friendAvoid(sh) {
  var fr = friendsOf(sh); if (!fr.length) return null;
  var me = keelLine(sh), best = null;
  fr.forEach(function (o) {
    var r = segSeg(me[0], me[1], keelLine(o)[0], keelLine(o)[1]), n = sub(r.q, r.p); n[1] = 0; n = norm(n);
    var close = dot(sub(sh.vel, o.vel), n);                                // 往它靠近的速度（m/s）
    if (r.d < AV_HARD || (close > 0.05 && r.d - close * AV_T < AV_NEAR)) if (!best || r.d < best.d) best = { d: r.d, n: n };
  });
  if (!best) return null;
  var left = [-Math.sin(sh.yaw), 0, -Math.cos(sh.yaw)];                   // 左舷那一側（yaw 變大 ＝ 左轉，31_sailing.js fwd）
  var w = clamp(1 - (best.d - 14) / AV_NEAR, 0.4, 1);
  sh.avoidN = (sh.avoidN || 0) + 1;                                       // 讀數：開局以來讓了幾步
  return sh.yaw + (dot(best.n, left) > 0 ? -1 : 1) * AV_TURN * w;          // 友船在左 ⇒ 右轉
}
