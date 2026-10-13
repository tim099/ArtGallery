// ───────────────────────── HUD ─────────────────────────
// ───────────────────────── 廣播（畫面上方的訊息） ─────────────────────────
// 一行一則、最多 5 行，各自 4 秒後淡掉（⛔ 以前只有一行、新的蓋掉舊的 ⇒ 同一刻兩件事只看得到一件）。
// 砲被打飛：同一個半秒內的併成一行；傷亡：第一個人倒下起算 5 秒，報這 5 秒裡陣亡、受傷各幾個（不洗版；是 0 的那一項不報）。
var MSGS = [], MSG_MAX = 5, MSG_LIFE = 4;
/** imp：重要的（殉爆、斷成兩截、沉沒、降旗）⇒ 留 8 秒，滿了先擠掉不重要的。 */
function note(sh, text, imp) {
  if (DEMO >= 0 && !RUNNING) return;
  var who = sh.i === PLAYER_I ? '我艦' : '敵艦', el = document.createElement('div');
  el.innerHTML = '<span style="color:' + (sh.i === 0 ? 'var(--blue)' : 'var(--red)') + '">' + who + '</span>　' + text;
  $('msg').appendChild(el); MSGS.push({ el: el, t: imp ? 8 : MSG_LIFE, imp: !!imp });
  while (MSGS.length > MSG_MAX) { var j = MSGS.findIndex(function (m) { return !m.imp; }); MSGS.splice(j < 0 ? 0 : j, 1)[0].el.remove(); }
}
function stepMsgs(dt) {
  for (var i = 0; i < MSGS.length; i++) { var m = MSGS[i]; m.t -= dt; m.el.style.opacity = clamp(m.t / 0.6, 0, 1); if (m.t <= 0) { m.el.remove(); MSGS.splice(i--, 1); } }
}
function clearMsgs() { MSGS.forEach(function (m) { m.el.remove(); }); MSGS = []; }
/** 砲被打飛（blowModel 呼叫）：先記著，下一次 newsFlush 併成一行。 */
function newsGun(sh, m, drop) {
  var g = sh.guns.filter(function (x) { return x.model === m; })[0]; if (!g) return;
  var no = /(\d+)$/.exec(m.name), lab = sideName(g.side) + (g.type === 'chase' || g.type === 'carr' ? GUNS[g.type].short : GUNS[g.type].short + ' ') + (g.type === 'chase' ? '' : no ? +no[1] : '');
  sh.news.guns.push(lab + (drop ? '（掉下去）' : ''));
}
var NEWS_WIN = 5;                                  // 傷亡廣播的時間區間（秒；Tim：3 → 5）
/** 普通水手（砲手）以外的人倒下：船長、軍官、舵手 ⇒ 當下各報一則（船長 ＝ 重要）；陸戰隊、桅頂水手、送藥手 ⇒ 記著，併進 5 秒那一行（人多，一個一個報會洗版）。 */
function newsCrew(sh, c, dead, cause) {
  if (c.role === ROLE.GUN) return;
  var cap = c.art === ART_CAPTAIN, how = dead ? (cause === '落水' ? '落水' : '陣亡') : '受傷倒下', why = cause && cause !== '落水' ? '（' + cause + '）' : '';
  if (cap) { note(sh, '<b style="color:var(--gold)">船長' + how + '！</b>' + why, true); return; }
  if (c.role === ROLE.OFFICER || c.role === ROLE.HELM) {
    var left = sh.crew.filter(function (o) { return o.role === c.role && able(o); }).length, nm = ROLE_NAME[c.role];
    note(sh, nm + how + why + (left ? '（還有 ' + left + ' 位）' : '　<b style="color:#ff9a7a">' + nm + '全倒' + (c.role === ROLE.OFFICER ? ' —— 沒人指揮，瞄準變散' : '') + '</b>'), !left);
    return;
  }
  var by = dead ? sh.news.kr : sh.news.wr; by[c.role] = (by[c.role] || 0) + 1;
}
function roleList(by) { var r = []; for (var k in by) r.push(ROLE_NAME[k] + ' ' + by[k]); return r.length ? '（' + r.join('、') + '）' : ''; }
/** 每半秒（survey 那一拍）：把記著的砲併成一行；傷亡滿 NEWS_WIN 秒報一次。 */
function newsFlush(sh) {
  var N = sh.news;
  if (N.guns.length) {
    var gl0 = N.guns.length, list = gl0 > 5 ? N.guns.slice(0, 4).join('、') + '…' : N.guns.join('、');   // 一次太多（殉爆）⇒ 只列前四門
    note(sh, (gl0 === 1 ? N.guns[0] + ' 被打飛' : gl0 + ' 門砲被打飛：' + list) + '（砲還在 ' + sh.gunsAlive + '／' + sh.guns.length + '）'); N.guns = [];
  }
  var dk = sh.kills - N.k, dw = sh.wounds - N.w;
  if (N.t < 0 && (dk > 0 || dw > 0)) N.t = SIMT;                       // 第一個人倒下 ⇒ 開始數
  if (N.t >= 0 && SIMT - N.t >= NEWS_WIN) {
    var parts = []; if (dk > 0) parts.push('陣亡 ' + dk + roleList(N.kr)); if (dw > 0) parts.push('受傷 ' + dw + roleList(N.wr));   // 是 0 的那一項不報；陸戰隊等另列
    N.kr = {}; N.wr = {};
    if (parts.length) note(sh, NEWS_WIN + ' 秒內 ' + parts.join('、'));   // 累計看兩邊面板（⛔ 也寫進來 ⇒ 一行太長、蓋到面板）
    N.k = sh.kills; N.w = sh.wounds; N.t = -1;
  }
}
/** 面板的一行：砲長與現在瞄哪裡（我艦手動 ⇒ 玩家的瞄準模式，砲長待命）。 */
function capText(sh) {
  var C = CAPTAINS[sh.cap], manual = sh.i === PLAYER_I && !AUTOFIRE;
  return '砲長 ' + (C ? C.name : '—') + '：' + (manual ? '待命（我在瞄：' + AIM_NAME[sh.pMode || 'free'] + '）' : sh.aimMode ? '瞄' + AIM_NAME[sh.aimMode] : '觀察中');
}
function panel(sh, title) {
  var hull = sh.grid.count / sh.orig, fl = clamp(sh.sink / 9, 0, 1);
  var m = sh.masts.map(function (x) { return x.name + (x.up ? '✓' : '✗'); }).join(' ');
  return '<h3>' + title + (sh.fate && !sh.sunk ? '　<span style="color:var(--gold)">' + sh.fate + '</span>' : '') + '</h3>船體 ' + (hull * 100).toFixed(1) + '%（打掉 ' + sh.lost.toLocaleString() + ' 格）<div class="bar"><i style="width:' + (hull * 100).toFixed(1) + '%"></i></div>' +
    '進水 ' + (sh.sunk ? '沉沒' : (fl * 100).toFixed(0) + '%') + '（水線下破洞 ' + (sh.inflow || 0).toLocaleString() + ' 格）' + (sh.lift > 0.05 ? '　浮高 ' + sh.lift.toFixed(1) + ' m' : sh.lift < -0.05 ? '　吃水深 ' + (-sh.lift).toFixed(1) + ' m' : '') + '<div class="bar water"><i style="width:' + (fl * 100).toFixed(0) + '%"></i></div>' +
    '航速 ' + (sh.spd * 1.944).toFixed(1) + ' 節（' + sh.pos + '）　' + SAILSETS[sh.sailSet] + ' ' + Math.round(sh.sailFrac * 100) + '%<br>' +
    ((SAIL === 'off' ? '停船' : sh.manual ? '手動操舵' : '自動操舵') + '　舵 ' + (sh.rudder > 0.05 ? '左 ' + Math.round(sh.rudder * 100) + '%' : sh.rudder < -0.05 ? '右 ' + Math.round(-sh.rudder * 100) + '%' : '正') + '<br>') +
    capText(sh) + '<br>' +
    '船員 ' + (sh.able || 0) + '/' + sh.crew0 + '（傷 ' + sh.wounded + '　亡 ' + sh.dead + '）　' + supplyText(sh) + '<br>' +
    '砲 有人 ' + (sh.gunsManned || 0) + '／還在 ' + sh.gunsAlive + '／' + sh.guns.length + '　' + m + '<br>' + gunRow(sh, 'S') + '<br>' + gunRow(sh, 'P') + '<br>開火 ' + sh.fired + '　命中 ' + sh.hits;
}
/** 一舷的砲列（長砲｜carronade＋追擊砲；船頭在左）：形狀 ＝ 裝填（● 好　◌ 裝填中　○ 開不了　✕ 毀），
 *  顏色 ＝ 人手（綠 滿編、黃 人數不足但能開（裝填慢）、灰 少於最少人數、紅 毀）；▶ ＝ 這一舷有砲對得到目標（我艦看瞄準點、其他看敵艦中央）。
 *  面板兩舷都列 ⇒ 觀戰也看得到、沒在用的那一舷壞了幾門也看得到。 */
function gunRow(sh, side) {
  function cell(g) {
    var st = !g.alive ? 'dead' : g.manned < g.crewMin ? 'none' : g.manned < g.crewFull ? 'short' : 'full';
    var k = !g.alive ? 3 : gunRate(g) <= 0 ? 2 : g.needCart && !(g.box > 0) ? 4 : g.reload > 0 ? 1 : 0;   // 4 ＝ 等火藥與彈藥（藥箱空了）
    var hp = !g.alive ? 0 : Math.max(0, g.model.hp / g.model.hpMax), hurt = g.alive && hp < 0.999;   // 受損 ⇒ 底下一條血條（.hp::after，寬 ＝ 剩下的血量）
    var cls = 'g-' + st + (hurt ? ' hp' : ''), sty = hurt ? '--hp:' + Math.round(hp * 100) + '%;' : '';
    if (HUD_ART) return '<span class="ico ' + cls + '" style="' + sty + 'background-position:' + ((3 + (k === 4 ? 1 : k)) * 100 / 7).toFixed(3) + '% 0"></span>';
    return '<span class="' + cls + '"' + (sty ? ' style="' + sty + '"' : '') + '>' + '●◌○✕△'[k] + '</span>';
  }
  var rows = sh.decks.map(function (D) { return sh.guns.filter(function (x) { return x.deck === D.key && x.side === side; }); });   // 每層砲甲板一段（由下往上）
  var foe = SHIPS[1 - sh.i], w = sh.i === PLAYER_I && !AUTOFIRE ? aimPoint(sh) : foe && foe.center;
  var on = w && anyBears(sh, w, side), lab = (on ? '<b style="color:var(--gold)">▶' : '<span style="color:var(--dim)">　') + sideName(side) + (on ? '</b> ' : '</span> ');
  return '<span class="gr">' + lab + rows.map(function (r) { return r.map(cell).join(''); }).join('｜') + '</span>';
}
/** 補給一行：送藥手還能動的／全部、等火藥的砲幾門、取用點還剩幾桶。 */
function supplyText(sh) {
  var pm = sh.crew.filter(function (c) { return c.role === ROLE.POWDER; }), ok = pm.filter(able).length;
  var wait = sh.guns.filter(function (g) { return g.alive && g.needCart && !(g.box > 0) && gunRate(g) > 0; }).length;
  return '送藥手 ' + ok + '/' + pm.length + (wait ? '　<span style="color:#ffb35a">等火藥 ' + wait + ' 門</span>' : '');
}
var HUDN = 0;
/** HUD 圖示表（art/hud.png，8 欄 × 2 列）：第一列 船員 傷 亡 裝填好 裝填中 沒人 毀 鏈；只換掉砲列的符號。 */
function hudArt() {
  var st = document.createElement('style');
  st.textContent = '.ico{display:inline-block;width:14px;height:14px;vertical-align:-2px;background-image:url(' + HUD_ART.src + ');background-size:800% 200%;}';
  document.head.appendChild(st);
}
// ───────────────────────── 左下：羅盤與船身 ─────────────────────────
// 羅盤跟著鏡頭轉（畫面上方 ＝ 鏡頭看的方向）；「北」＝ 世界 −z（只是參考方向，航向照它算：東 ＝ +x）。
// 圈上：我艦（中間，尖端 ＝ 船頭）、風（從哪吹來的箭頭）、敵艦方位（紅點）、兩舷的砲門射界（±26°，對得到敵艦的那一舷亮）。
var COMPASS = ['北', '北北東', '東北', '東北東', '東', '東南東', '東南', '南南東', '南', '南南西', '西南', '西南西', '西', '西北西', '西北', '北北西'];
function bearing(x, z) { return ((Math.atan2(x, -z) * 57.2958) % 360 + 360) % 360; }
function compassName(b) { return COMPASS[Math.round(b / 22.5) % 16]; }
function deg3(b) { return ('00' + Math.round(b) % 360).slice(-3) + '°'; }
function drawNav(sh) {
  if (!CAM.look) return;
  var c2 = $('navc'), g = c2.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2), W = 150;
  if (c2.width !== W * dpr || c2.height !== W * dpr) { c2.width = c2.height = W * dpr; }   // ⛔ 只比寬：canvas 預設 300×150，dpr 2（手機）時寬剛好是 300 ⇒ 高停在 150，羅盤被拉成兩倍高、下半截切掉
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, W);
  var f = norm([CAM.look[0] - CAM.eye[0], 0, CAM.look[2] - CAM.eye[2]]), rt = [-f[2], 0, f[0]], cx = W / 2, cy = W / 2, R = 56;
  function P(d, k) { return [cx + (d[0] * rt[0] + d[2] * rt[2]) * R * k, cy - (d[0] * f[0] + d[2] * f[2]) * R * k]; }
  function dirOf(b) { var a = b / 57.2958; return [Math.sin(a), 0, -Math.cos(a)]; }
  function line(a, b, col, w) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
  g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, R, 0, 6.2832); g.stroke();
  for (var b = 0; b < 360; b += 30) line(P(dirOf(b), b % 90 ? 0.93 : 0.86), P(dirOf(b), 1), 'rgba(255,255,255,.35)', 1);
  g.font = '11px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#e8c26a';
  var pn = P(dirOf(0), 1.17); g.fillText('北', pn[0], pn[1]);
  var F = fwd(sh.yaw), foe = SHIPS[1 - sh.i];
  // 兩舷的射界
  ['S', 'P'].forEach(function (side) {
    var st = M4.dir(sh.M, 0, side === 'S' ? 1 : -1, 0); st = norm([st[0], 0, st[2]]);
    var on = foe && foe.center && anyBears(sh, foe.center, side), p = P([0, 0, 0], 0);
    g.fillStyle = on ? 'rgba(232,194,106,.45)' : 'rgba(232,194,106,.13)'; g.beginPath(); g.moveTo(p[0], p[1]);
    for (var t = -0.45; t <= 0.4501; t += 0.15) { var q = P(add(mul(st, Math.cos(t)), mul(F, Math.sin(t))), 0.97); g.lineTo(q[0], q[1]); }
    g.closePath(); g.fill();
  });
  // 風：從圈外吹進來的箭頭
  var Wd = norm(WIND), from = [-Wd[0], 0, -Wd[2]], a0 = P(from, 1.2), a1 = P(from, 0.62), hd = norm([a1[0] - a0[0], 0, a1[1] - a0[1]]);
  line(a0, a1, '#8fd3ff', 2.5);
  g.fillStyle = '#8fd3ff'; g.beginPath(); g.moveTo(a1[0] + hd[0] * 4, a1[1] + hd[2] * 4); g.lineTo(a1[0] - hd[0] * 6 - hd[2] * 5, a1[1] - hd[2] * 6 + hd[0] * 5); g.lineTo(a1[0] - hd[0] * 6 + hd[2] * 5, a1[1] - hd[2] * 6 - hd[0] * 5); g.fill();
  // 敵艦方位
  if (foe && foe.center && sh.center) {
    var e = norm([foe.center[0] - sh.center[0], 0, foe.center[2] - sh.center[2]]), pe = P(e, 0.86);
    g.fillStyle = foe.sunk ? '#666' : '#ff6f6f'; g.beginPath(); g.arc(pe[0], pe[1], 4.5, 0, 6.2832); g.fill();
  }
  // 我艦（尖端 ＝ 船頭）
  var S2 = norm([F[2], 0, -F[0]]), tip = P(F, 0.42), l = P(add(mul(F, -0.32), mul(S2, 0.12)), 1), r2 = P(add(mul(F, -0.32), mul(S2, -0.12)), 1);
  g.fillStyle = sh.i === 0 ? '#6f9bff' : '#ff6f6f'; g.beginPath(); g.moveTo(tip[0], tip[1]); g.lineTo(l[0], l[1]); g.lineTo(r2[0], r2[1]); g.closePath(); g.fill();
  // 文字
  var hb = bearing(F[0], F[2]), wb = bearing(from[0], from[2]), roll = (sh.rollA + (sh.rollW || 0)) * 57.2958, pitch = sh.pitchA * 57.2958;
  var hull = sh.grid.count / sh.orig * 100, fl = clamp(sh.sink / 9, 0, 1) * 100;
  $('navt').innerHTML =
    '航向 ' + deg3(hb) + '（' + compassName(hb) + '）　' + (sh.spd * 1.944).toFixed(1) + ' 節<br>' +
    '<span style="color:#8fd3ff">風 從 ' + deg3(wb) + '（' + compassName(wb) + '）</span>　' + sh.pos + (sh.irons > 0.05 ? '　<b style="color:#ff9a7a">失速' + (sh.irons < 0.95 ? ' ' + Math.round(sh.irons * 100) + '%' : '') + '</b>' : '') + '<br>' +
    '船體 ' + hull.toFixed(1) + '%　進水 ' + (sh.sunk ? '沉沒' : fl.toFixed(0) + '%') + (sh.lift > 0.05 ? '　浮高 ' + sh.lift.toFixed(1) + ' m' : sh.lift < -0.05 ? '　吃水深 ' + (-sh.lift).toFixed(1) + ' m' : '') + '<br>' +
    '傾斜 ' + Math.abs(roll).toFixed(1) + '°' + (Math.abs(roll) < 0.2 ? '' : roll < 0 ? '（左低）' : '（右低）') + '　縱傾 ' + pitch.toFixed(1) + '°<br>' +
    SAILSETS[sh.sailSet] + ' ' + Math.round(sh.sailFrac * 100) + '%　舵 ' + (sh.rudder > 0.05 ? '左 ' + Math.round(sh.rudder * 100) + '%' : sh.rudder < -0.05 ? '右 ' + Math.round(-sh.rudder * 100) + '%' : '正');
}
function hud(dt) {
  stepMsgs(dt);
  if (!SHIPS.length || (HUDN++ % 6)) return;
  var me = SHIPS[PLAYER_I], foe = SHIPS[1 - PLAYER_I];
  $('me').innerHTML = panel(me, '我艦 ' + me.T.name + '（藍）');
  $('foe').innerHTML = panel(foe, '敵艦 ' + foe.T.name + '（紅）');
  // 下方：我艦的砲列（跟面板同一支）＋ 射界外警告；觀戰只顯示鏡頭
  var aw = aimPoint(me), bs = anyBears(me, aw, 'S') ? 'S' : anyBears(me, aw, 'P') ? 'P' : null;
  var warn = bs || AUTOFIRE ? '' : '　<b style="color:#ff9a7a">⚠ 射界外</b>';
  $('guns').innerHTML = gunRow(me, bs || me.side) + warn + '　' + CAM_NAMES[CAM.mode] + (PAUSED ? '　⏸ 暫停' : '');
  [].forEach.call(document.querySelectorAll('#ammo span'), function (s) { s.className = +s.dataset.a === AMMO_I ? 'on' : ''; });
  var ak = $('aimk'); if (ak) ak.innerHTML = '<b>Q</b> 瞄準：' + (AUTOFIRE ? '砲長' : AIM_NAME[me.pMode || 'free']);
  var t = DEBUG ? '格：' + SHIPS.map(function (s) { return s.grid.count; }).join('／') + '　四邊形：' + SHIPS.map(function (s) { return s.rs.quads(); }).join('／') + '　碎片 ' + D.n + '　粒子 ' + PT.n + '　脫落 ' + PIECES.length + (PHYS ? '　物理 ' + PHYS_MS.toFixed(2) + ' ms/步、垂繩 ' + SHIPS.map(function (s) { return s.loose.length; }).join('／') : '') + '　' + FPS.toFixed(0) + ' fps' : '';
  $('tip').textContent = t;
  drawNav(me);
}
// 結算畫面照模擬時間延後跳（暫停時不會跳出來）：沉了 2.5 秒；降旗、殉爆、全員倒下 5.5 秒（Tim：先看完精彩畫面 —— 殉爆的火球、斷成兩截）
var END_AT = 0, END_SINK = 2.5, END_OTHER = 5.5;
function checkEnd() {
  if (MODE === 'sandbox' || DEMO >= 0) return;
  if (OVER) { if (END_AT && SIMT >= END_AT) { END_AT = 0; $('end').className = 'on'; } return; }
  var me = SHIPS[PLAYER_I], foe = SHIPS[1 - PLAYER_I], txt = null;
  function fate(sh) { return sh.sunk ? '沉沒' : sh.fate; }
  if (foe.sunk || foe.struck) txt = '勝利！敵艦' + fate(foe);
  else if (me.sunk || me.struck) txt = '敗北……我艦' + fate(me);
  if (!txt) return;
  OVER = true;
  $('endT').textContent = txt;
  $('endS').innerHTML = '打掉的格數：我艦 ' + me.lost.toLocaleString() + '　敵艦 ' + foe.lost.toLocaleString() + '<br>開火／命中：' + me.fired + '／' + me.hits + '　經過 ' + SIMT.toFixed(0) + ' 秒' +
    '<br><span style="color:var(--dim)">' + strikeText() + '</span>';
  END_AT = SIMT + (foe.sunk || me.sunk ? END_SINK : END_OTHER);   // 重開／回選單時歸零（⛔ 不歸零 ⇒ 結束後幾秒內按重新開始，新的一局會跳出結算）
}

