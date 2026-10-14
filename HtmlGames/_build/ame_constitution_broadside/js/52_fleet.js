// ───────────────────────── 艦隊（TASK-0537：多船的架構） ─────────────────────────
// 每艘有陣營（sh.team：'blue'／'red'）；「我的對手」不再是 SHIPS[1 − sh.i]，而是 foeOf(sh)：
//   每一步開始時挑一次（pickFoes）—— 玩家點過的那艘（還在、是敵船）優先，否則最近的、還沒沉的敵船；敵船全沉了 ⇒ 最近的那艘（照舊指著它，像以前一樣）。
//   ⇒ 一對一時永遠是另一艘 ⇒ 跟以前一位元都不差。只用船的位置（px、pz）、不抽亂數。
// 友軍跟敵軍只差在挑目標（Tim 2026-10-13）：同陣營不當目標；砲彈照舊打得到每一艘 ⇒ 誤擊照樣扣血、算傷亡（讀數 sh.ff：被友船打中幾發）。
// 瞄準點（sh.aim）是「那艘船」的格座標 ⇒ 一併記是哪艘（sh.aimOn，setAim）；換目標之前瞄的那一點不會被套到另一艘的座標上。
// 船數上限 MAX_SHIPS（00_core.js）；GPU 的格（陰影圖、船艙遮罩、透視）只給視野裡最近的幾艘（畫質設定「陰影船數」「船艙遮罩」；60_render.js gpuSlots），其他的靠全局陰影圖。
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
    var od = ORDERS[sh.i], ot = od && od.target !== null && od.target !== undefined ? SHIPS[od.target] : null;   // 指揮官的命令（TASK-0551；53_commander.js）
    if (ot && c.indexOf(ot) >= 0 && !isOut(ot)) { sh.foe = ot; return; }
    var live = c.filter(function (o) { return !o.sunk; }); if (live.length) c = live;
    var best = null, bd = 1e18;
    c.forEach(function (o) { var d = (o.px - sh.px) * (o.px - sh.px) + (o.pz - sh.pz) * (o.pz - sh.pz); if (d < bd) { bd = d; best = o; } });
    sh.foe = best;
  });
}
function foeOf(sh) { if (sh.foe === undefined) pickFoes(); return sh.foe; }
// ───────────────────────── 指揮官（TASK-0551；策略在 53_commander.js，這裡是遊戲那一側的轉接） ─────────────────────────
// 每一方一個指揮官（細節設定「艦隊指揮官」我方／敵方，?cmd=我方,敵方，存檔 cmd；預設兩方都是一對一配對）。每 CMD_EVERY 步想一次（3 秒；開局、候補進場也想一次），不抽亂數。
// 命令 ORDERS[船的序號]：目標進 pickFoes（命令的目標還在打、是敵艦才用，不然照舊挑最近的）、戰列跟隨的舵進 31_sailing.js（cmdHelmLine）。
// 收命令的：電腦開的船（觀戰時玩家那艘也是）；對戰電腦／沙盒裡玩家自己那艘不收（Tim 2026-10-14：玩家對友艦下令之後再說），但算在配對與戰列裡（可以當排頭）。
// 一對一：配對 ⇒ 目標就是唯一那艘敵艦 ＝ 本來就挑到的那艘 ⇒ 一位元都不差。
var CMD_SIDE = { blue: 'pair', red: 'pair' }, CMD_MEM = { blue: {}, red: {} }, ORDERS = {}, CMD_EVERY = 180;
// ?cmd=我方,敵方 在 69_prefs.js 讀（要等 53_commander.js 的 CMD_NAMES）
/** 遊戲的船 ⇒ 指揮官看的局勢（53_commander.js 開頭的格式）。 */
function cmdView(side) {
  var W = norm(WIND);
  return { t: SIMT, side: side, wind: [W[0], W[2]], ships: SHIPS.map(function (s) {
    return { id: s.i, team: s.team, x: s.px, z: s.pz, yaw: s.yaw, spd: s.spd, hp: 1 - clamp(s.sink / 4.2, 0, 1), guns: s.guns.length ? (s.gunsAlive === undefined ? s.guns.length : s.gunsAlive) / s.guns.length : 0,
      crew: s.crew0 ? s.crew.filter(able).length / s.crew0 : 0, mass: s.mass0 || shipT(s), len: (s.T.wl1 - s.T.wl0) * S, out: isOut(s), cmd: !(s.i === PLAYER_I && MODE !== 'eve'), tgt: s.foe ? s.foe.i : null };
  }) };
}
function cmdTick() { ORDERS = {}; ['blue', 'red'].forEach(function (side) { var o = cmdThink(cmdView(side), CMD_SIDE[side], CMD_MEM[side]); for (var k in o) ORDERS[k] = o[k]; }); }
function cmdReset() { CMD_MEM = { blue: {}, red: {} }; ORDERS = {}; }
/** 瞄準點落在哪艘船（設瞄準點那一刻的那艘；沒有 ⇒ 現在的目標）。 */
function aimShip(sh) { return sh.aim && sh.aimOn ? sh.aimOn : foeOf(sh); }
function setAim(sh, aim, on) { sh.aim = aim; sh.aimOn = aim ? on || foeOf(sh) : null; }
/** 旗艦：那個陣營還在打的船（沒沉、沒在沉、沒降旗）裡，開戰時排水量（sh.mass0；還沒算 ⇒ 現算）最大的；都出局了 ⇒ 沒沉的裡最大的；全沉了 ⇒ 最大的那艘
 *  （Tim 2026-10-13：上方面板只顯示雙方旗艦；有候補之後降旗的船還浮在場上 ⇒ ⛔ 只看沒沉 ⇒ 面板停在降旗的那艘）。
 *  ⛔ 照「現在」的排水量排 ⇒ 被打掉幾噸就換旗艦、面板一直跳。 */
function flagship(team) {
  var L = teamShips(team), act = L.filter(function (o) { return !isOut(o); }), live = L.filter(function (o) { return !o.sunk; });
  if (act.length) L = act; else if (live.length) L = live;
  var best = null, bm = -1;
  L.forEach(function (o) { var m = o.mass0 || shipT(o); if (m > bm) { bm = m; best = o; } });
  return best;
}
function teamTag(sh) { return teamIdx(sh) === 0 ? '（藍）' : '（紅）'; }
function playerTeam() { var me = SHIPS[PLAYER_I]; return me ? me.team : 'blue'; }
function foeTeam() { return playerTeam() === 'blue' ? 'red' : 'blue'; }
/** 那個陣營打完了沒：場上每艘都沉了或降旗，而且沒有候補了（RESERVE）。 */
function teamDown(team) { var L = teamShips(team); return L.length > 0 && L.every(function (o) { return o.sunk || o.struck; }) && !RESERVE[team].length; }
/** 開局的編隊（70_flow.js reset；Tim 2026-10-13「兩邊船頭相對互相接近」「友軍就排在旁邊」）：
 *  兩邊船頭相對（藍往 −z、紅往 +z），船頭（水線最前那一格）相距 DIST；同一邊排成橫隊（並排，左右隔 FLEET_GAP），船頭對齊。
 *  spec：[{ team, hull }]，一對一 ＝ [我艦, 敵艦]；SHIPS 照這個順序建（i ＝ 序號；我艦是 0）。艘數超過 MAX_SHIPS ⇒ 截掉。 */
var FLEET_GAP = 70;                                                       // 同一邊並排的兩艘，中心左右隔多遠（m；船寬 13 m）
var FLEET_DBG = null;                                                     // ?debug=1 的 __game.fleet([...])：直接給一串（蓋過主選單的編成）
/** 主選單的編成（FLEET_SET，05_hull.js）⇒ 一串：我艦、敵方第一艘、我方其他、敵方其他（一對一 ＝ [我艦, 敵艦]，跟以前同一個順序）。 */
/** 艦名（TASK-0552）：照編成的順序（我艦、敵方第一艘、我方其他、敵方其他；候補也在裡面）發 —— 那一型的艦名池（05_hull.js names）裡第一個還沒用的，
 *  用完拿公共池 SHIP_NAMES_PUB，再用完 ⇒ 原名＋序號。同一場（兩邊合起來）不重名；只看編成 ⇒ 重開同一場名字不變、不抽 rnd()。 */
function fleetNames(spec) {
  var used = {};
  function take(L) { for (var k = 0; k < L.length; k++) if (!used[L[k]]) return L[k]; return null; }
  return spec.map(function (f) {
    var H = hullInfo(f.hull) || { name: f.hull }, nm = take(H.names || [H.name]) || take(SHIP_NAMES_PUB);
    for (var n = 2; !nm; n++) if (!used[H.name + ' ' + n]) nm = H.name + ' ' + n;
    used[nm] = true; return { team: f.team, hull: f.hull, name: nm };
  });
}
function fleetSpec() {
  if (FLEET_DBG) return FLEET_DBG;
  var b = FLEET_SET[0], r = FLEET_SET[1], L = [{ team: 'blue', hull: b[0] }, { team: 'red', hull: r[0] }];
  b.slice(1).forEach(function (h) { L.push({ team: 'blue', hull: h }); });
  r.slice(1).forEach(function (h) { L.push({ team: 'red', hull: h }); });
  return L;
}
// ───────────────────────── 候補（Tim 2026-10-13：「最大進場數量設定，超出的船在船沉後候補進場」「例如同場上限 8，編成 16 艘 ⇒ 後面 8 艘變成候補」） ─────────────────────────
// 編成（最多 FLEET_MAX）裡同時在場最多 FIELD_N 艘（主選單滑桿 2～MAX_SHIPS；?field=）；其他的照編成順序排進候補 RESERVE[陣營]。
// 開局：每一方先 1 艘（我艦一定在場），剩下的名額照「比例」一艘一艘分（下面 propSide），每一方上場的是它編成裡的前幾艘。
// 空出名額 ＝ 場上的船沉了、在沉、或降旗（⛔ 降旗不算 ⇒ 一方在場的全降旗、候補永遠進不來，勝負卡住）；每半秒（survey 那一拍）看一次。
// 補哪一方（細節設定「候補補位」REINF_MODE；Tim：「候補算法由妳決定，有多種的話可以在詳細設定中開放選擇」）：
//   · prop 比例（預設）：剩餘戰力 ＝ 場上還在打的 ＋ 候補；那一方應得 ＝ FIELD_N × 自己剩餘 ÷ 兩方剩餘；補給「應得 − 在場」最多的那一方
//     （一樣多 ⇒ 在場少的；再一樣 ⇒ 跟上一次補的不同邊）。⇒ 大致誰沉誰補，懸殊時人少的那一方也保得住一點名額、人多的保有優勢。
//   · own 誰沉誰補：每一方守住自己的名額，沉一艘從自己的候補補一艘；自己沒候補了 ⇒ 那個名額空著。
//   · alt 輪流：空出名額就兩方輪流補（輪到的那一方沒候補 ⇒ 給另一方）。
// 進場的位置：那一方場上的船的中心往「離敵方中心」的方向再退 120 m（至少離敵方中心 260 m；那一方場上沒船 ⇒ 開局那一側），
//   左右錯開到離每一艘還浮著的船 70 m 以上；船頭對著敵方中心。廣播「援軍進場」。
// 船數 ≤ FIELD_N ⇒ 沒有候補，一切照舊（一對一一位元都不差）。
var FIELD_N = MAX_SHIPS, REINF_MODE = 'prop', RESERVE = { blue: [], red: [] }, REINF = { last: null, outQ: [] };
if (Q.has('field') && isFinite(+Q.get('field'))) FIELD_N = clamp(Math.round(+Q.get('field')), 2, MAX_SHIPS);
if (['prop', 'own', 'alt'].indexOf(Q.get('reinf')) >= 0) REINF_MODE = Q.get('reinf');
var REINF_NAMES = { prop: '比例', own: '誰沉誰補', alt: '輪流' };
function isOut(o) { return o.sunk || o.struck || o.sinkingFinal; }
function other(team) { return team === 'blue' ? 'red' : 'blue'; }
/** 比例制挑下一個名額給哪一方：act ＝ 在場還在打的艘數、res ＝ 候補艘數（兩個都是 { blue, red }）。都沒候補 ⇒ null。 */
function propSide(act, res, last) {
  var tot = act.blue + res.blue + act.red + res.red, best = null, bd = -1e9;
  ['blue', 'red'].forEach(function (s) {
    if (!res[s]) return;
    var d = FIELD_N * (act[s] + res[s]) / tot - act[s];
    if (!best || d > bd + 1e-9 || (Math.abs(d - bd) <= 1e-9 && (act[s] < act[best] || (act[s] === act[best] && last === best)))) { best = s; bd = d; }
  });
  return best;
}
/** 開局分配：spec（編成的一串）⇒ { field（上場的，照 spec 順序）, reserve（{ blue: [船型…], red: […] }）}。 */
function fieldSplit(spec) {
  var tot = { blue: 0, red: 0 }, act = { blue: 0, red: 0 }, last = null;
  spec.forEach(function (f) { tot[f.team]++; });
  ['blue', 'red'].forEach(function (s) { if (tot[s]) act[s] = 1; });
  for (var n = act.blue + act.red; n < FIELD_N; n++) {
    var s = propSide(act, { blue: tot.blue - act.blue, red: tot.red - act.red }, last); if (!s) break;
    act[s]++; last = s;
  }
  var k = { blue: 0, red: 0 }, field = [], reserve = { blue: [], red: [] };
  spec.forEach(function (f) { if (k[f.team]++ < act[f.team]) field.push(f); else reserve[f.team].push(f); });   // 候補：整筆（船型＋艦名）
  return { field: field, reserve: reserve };
}
/** 每半秒（50_sim.js step，survey 那一拍）：有空出來的名額就照 REINF_MODE 補。 */
function reinforce() {
  if (OVER || (!RESERVE.blue.length && !RESERVE.red.length) || teamDown('blue') || teamDown('red')) return;   // 有一方打完了 ⇒ 不補（⛔ 不擋 ⇒ 勝負那一拍對面還補一艘進場）
  SHIPS.forEach(function (o) { if (isOut(o) && !o.outSeen) { o.outSeen = true; REINF.outQ.push(o.team); } });
  var act = { blue: 0, red: 0 }; SHIPS.forEach(function (o) { if (!isOut(o)) act[o.team]++; });
  var free = FIELD_N - act.blue - act.red;
  while (free > 0) {
    var res = { blue: RESERVE.blue.length, red: RESERVE.red.length }, s = null;
    if (REINF_MODE === 'own') { while (REINF.outQ.length && !s) { var t = REINF.outQ.shift(); if (res[t]) s = t; } }
    else if (REINF_MODE === 'alt') { var nx = REINF.last ? other(REINF.last) : (REINF.outQ[0] || 'blue'); s = res[nx] ? nx : res[other(nx)] ? other(nx) : null; }
    else s = propSide(act, res, REINF.last);
    if (!s) break;
    spawnReserve(s); act[s]++; free--; REINF.last = s;
  }
  if (REINF_MODE !== 'own') REINF.outQ = [];
}
/** 候補的下一艘進場（位置見上面）。 */
function spawnReserve(team) {
  var f = RESERVE[team].shift(), T = f && HULLT[f.hull]; if (!T) return null;
  function mid(L) { if (!L.length) return null; var x = 0, z = 0; L.forEach(function (o) { x += o.px; z += o.pz; }); return [x / L.length, z / L.length]; }
  var afloat = SHIPS.filter(function (o) { return !o.sunk; });
  var E = mid(afloat.filter(function (o) { return o.team !== team && !isOut(o); })) || mid(afloat.filter(function (o) { return o.team !== team; })) || [0, team === 'blue' ? -DIST / 2 : DIST / 2];
  var O = mid(afloat.filter(function (o) { return o.team === team && !isOut(o); }));
  var dx = O ? O[0] - E[0] : 0, dz = O ? O[1] - E[1] : (team === 'blue' ? 1 : -1), dl = Math.hypot(dx, dz);
  if (dl < 1) { dx = 0; dz = team === 'blue' ? 1 : -1; dl = 1; }
  dx /= dl; dz /= dl;
  var R = Math.max((O ? Math.hypot(O[0] - E[0], O[1] - E[1]) : 0) + 120, 260), P = null;
  [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5].some(function (q) {
    var p = [E[0] + dx * R + dz * q * 80, E[1] + dz * R - dx * q * 80];
    if (afloat.every(function (o) { return Math.hypot(o.px - p[0], o.pz - p[1]) > 70; })) { P = p; return true; }
    return false;
  });
  if (!P) P = [E[0] + dx * (R + 150), E[1] + dz * (R + 150)];
  var hx = E[0] - P[0], hz = E[1] - P[1], yaw = Math.atan2(-hz, hx);       // 船頭對著敵方中心（fwd(yaw) ＝ [cos, 0, −sin]）
  var sh = makeShip(SHIPS.length, team, yaw, P[1], T, P[0]); sh.name = f.name;
  SHIPS.push(sh); stepShip(sh, 0); survey(sh); pickCaptain(sh); cmdTick(); pickFoes();   // cmdTick：指揮官馬上把它排進去
  note(sh, '援軍進場' + (sh.name !== T.name ? '（' + T.name + '型）' : '') + teamTag(sh) + (RESERVE[team].length ? '（候補還有 ' + RESERVE[team].length + ' 艘）' : '（候補用完）'), true);
  crewShortNote(sh);
  return sh;
}
/** 我艦出局（沉了、在沉、降旗）⇒ 自動換到友艦操控（Tim 2026-10-13：「玩家操作的船沉沒時，自動切換到友軍船艦操控」）：
 *  我方還在打的船裡開戰排水量最大的（旗艦），一樣大 ⇒ 離原本那艘近的；一艘都沒有 ⇒ 等（候補進場後下一拍換過去）。
 *  每半秒看一次（50_sim.js，跟 reinforce 同一拍）。換過去的那艘：砲長照它自己的、瞄準模式接玩家的（AIM_P），沙盒的快速裝填跟過去。
 *  一對一沒有友艦 ⇒ 不會換（照舊等結算）。 */
function playerHandoff() {
  var me = SHIPS[PLAYER_I]; if (OVER || !me || !isOut(me)) return null;
  var L = SHIPS.filter(function (o) { return o.team === me.team && !isOut(o); }); if (!L.length) return null;
  function m(o) { return o.mass0 || shipT(o); }
  L.sort(function (a, b) { return m(b) - m(a) || Math.hypot(a.px - me.px, a.pz - me.pz) - Math.hypot(b.px - me.px, b.pz - me.pz); });
  var nw = L[0];
  me.pMode = 'free'; me.hand = false; PLAYER_I = nw.i; nw.pMode = AIM_P; nw.hand = false;
  if (MODE === 'sandbox') { nw.reloadT = RELOAD_SANDBOX; me.reloadT = RELOAD; }
  KEYS.l = KEYS.r = false; CAM.trMe = CAM.trYaw = null;
  note(nw, '改操控 ' + nw.name + teamTag(nw) + '（' + me.name + (me.struck && !me.sunk && !me.sinkingFinal ? '降旗了' : '沉了') + '）', true);
  return nw;
}
function spawnFleet(spec) {
  var sp = fieldSplit(fleetNames(spec)); spec = sp.field; RESERVE = sp.reserve; REINF = { last: null, outQ: [] };
  var n = { blue: 0, red: 0 }, k = { blue: 0, red: 0 };
  spec.forEach(function (f) { n[f.team]++; });
  function slots(m) {                                                    // 橫隊的左右位置，從中間往兩側排（第一艘 ＝ 我艦／敵方第一艘在中間）
    var r = []; for (var q = 0; q < m; q++) r.push((q - (m - 1) / 2) * FLEET_GAP);
    return r.sort(function (a, b) { return Math.abs(a) - Math.abs(b) || a - b; });
  }
  var X = { blue: slots(n.blue), red: slots(n.red) };
  spec.forEach(function (f, i) {
    var blue = f.team === 'blue', off = X[f.team][k[f.team]++];        // 兩邊第 j 艘站同一個 x ⇒ 各自對著對面那一艘
    var T = HULLT[f.hull], bow = (T.wl1 - T.cx) * S;                    // 船的原點（x ＝ T.cx）到船頭的距離
    var sh = makeShip(i, f.team, blue ? Math.PI / 2 : -Math.PI / 2, blue ? DIST / 2 + bow : -DIST / 2 - bow, T, off); sh.name = f.name; SHIPS.push(sh);
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
/** 讓開砲線（Tim 2026-10-14：「友軍儘量避開砲線，我剛剛被擋住很久」）：電腦的友艦擋在某艘友艦（玩家那艘看它瞄的那艘，其他看各自的目標）的砲線上 ⇒
 *  舵往離開砲線最近的那一側打（航向 ＝ 垂直砲線、帶一半原本順著砲線的分量 ⇒ 不用整個掉頭），出了 LC_OUT 才放手（進 LC_IN、出 LC_OUT ⇒ 不在邊界抖）。
 *  「擋在砲線上」＝ 自己的龍骨線離「射手 → 目標」那一段不到 LC_IN（m），而且自己的中心落在中間那 8%–92%（在射手或目標旁邊的是擦撞，交給 friendAvoid）；
 *  只看 LC_RANGE 以內的砲線。優先序：擦撞（friendAvoid）＞ 讓開砲線 ＞ 追敵。沒有友船 ⇒ null（一對一一位元都不差）。讀數 sh.clearN（讓了幾步）。 */
var LC_IN = 22, LC_OUT = 36, LC_RANGE = 600;
function lineClear(sh) {
  var fr = friendsOf(sh); if (!fr.length) { sh.clearing = null; return null; }
  var me = keelLine(sh), mid = [(me[0][0] + me[1][0]) / 2, 0, (me[0][2] + me[1][2]) / 2], best = null;
  fr.forEach(function (f) {
    if (isOut(f)) return;
    var t = f.i === PLAYER_I ? aimShip(f) : foeOf(f); if (!t || t === sh || t.sunk) return;
    var a = [f.px, 0, f.pz], b = [t.px, 0, t.pz], L = Math.hypot(b[0] - a[0], b[2] - a[2]); if (L > LC_RANGE || L < 1) return;
    var ux = (b[0] - a[0]) / L, uz = (b[2] - a[2]) / L, tt = ((mid[0] - a[0]) * ux + (mid[2] - a[2]) * uz) / L;
    if (tt < 0.08 || tt > 0.92) return;
    var d = segSeg(a, b, me[0], me[1]).d; if (d >= (sh.clearing === f ? LC_OUT : LC_IN)) return;
    if (!best || d < best.d) best = { d: d, f: f, t: t, tt: tt, ux: ux, uz: uz, px: a[0] + ux * tt * L, pz: a[2] + uz * tt * L };
  });
  if (!best) { sh.clearing = null; return null; }
  sh.clearing = best.f; sh.clearN = (sh.clearN || 0) + 1;
  // 怎麼離開：砲線跟著射手與目標走 ⇒ 要的是「相對砲線」橫切的速度（⛔ 只看自己 ⇒ 並排同向同速時往前直走，砲線跟著一起走、永遠擋著）；
  //   砲線在自己那一點的速度 ＝ 射手與目標的速度照位置內插（⛔ 只算射手 ⇒ 射手與目標反向走時那一點幾乎不動，「放慢」反而停在線上：量過 16 → 40 秒）。
  //   選項：兩側（垂直砲線）× 斜 0／±30° 六個航向，加「放慢」（照原航向、帆速 × 0.3 ⇒ 讓射手跟砲線從前面過去）；
  //   每個 ⇒ 相對速度 ＝ 自己在那個航向的帆速（照風，polar）− 砲線在那一點的速度，橫切砲線的分量；離開要多久 ＝ 那一側離 LC_OUT 還多遠 ÷ 它 ＋ 轉過去的時間（約 0.05 rad/s）。挑最短的。
  //   ⛔ 只往近的那一側垂直走 ⇒ 那一側剛好頂風時船慢到 1 m/s 以下、舵也轉不動（量過：30 秒都出不去）。
  var nx = -best.uz, nz = best.ux, off = (mid[0] - best.px) * nx + (mid[2] - best.pz) * nz;   // 法線、自己在砲線的哪一側（正 ＝ 法線那邊）
  var W = norm(WIND), UP = sh.cfg.upwind || 1, F = fwd(sh.yaw), fv = best.f.vel || [0, 0, 0], tv = best.t.vel || [0, 0, 0], sv = [fv[0] + (tv[0] - fv[0]) * best.tt, 0, fv[2] + (tv[2] - fv[2]) * best.tt], bt = 1e9, bv = null, slow = false;
  var V0 = VMAX * sh.cfg.speed * playK('speed') * WX.speed * Math.sqrt(WIND_SPD) * sh.sailFrac;
  function spdAt(v) { var deg = Math.acos(clamp(dot(v, W), -1, 1)) * 57.2958; return V0 * polar(UP === 1 || deg <= 90 ? deg : 90 + (deg - 90) / UP); }
  function opt(v, spd, isSlow) {
    var rel = [v[0] * spd - sv[0], 0, v[2] * spd - sv[2]], turn = Math.acos(clamp(dot(v, F), -1, 1));
    [1, -1].forEach(function (s) {
      var a = s * (rel[0] * nx + rel[2] * nz); if (a <= 0.05) return;     // 往 s 那一側的相對速度
      var t = (LC_OUT - s * off) / a + turn / 0.05;
      if (t < bt) { bt = t; bv = v; slow = isSlow; }
    });
  }
  [1, -1].forEach(function (s) { [0, 0.58, -0.58].forEach(function (k) { var v = norm([s * nx + k * best.ux, 0, s * nz + k * best.uz]); opt(v, spdAt(v), false); }); });
  opt(F, spdAt(F) * 0.3, true);
  if (!bv) bv = F;
  if (slow) sh.throttle = 0.3;
  sh.clearSlow = slow;
  return Math.atan2(-bv[2], bv[0]);                                       // fwd(yaw) ＝ [cos, 0, −sin] ⇒ yaw ＝ atan2(−z, x)
}
