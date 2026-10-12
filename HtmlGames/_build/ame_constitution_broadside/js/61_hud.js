// ───────────────────────── HUD ─────────────────────────
var MSGT = 0;
function note(sh, text) {
  if (DEMO >= 0 && !RUNNING) return;
  var who = sh.i === PLAYER_I ? '我艦' : '敵艦';
  var el = $('msg'); el.innerHTML = '<span style="color:' + (sh.i === 0 ? 'var(--blue)' : 'var(--red)') + '">' + who + '</span>　' + text; el.style.opacity = 1; MSGT = 3;
}
function panel(sh, title) {
  var hull = sh.grid.count / sh.orig, fl = clamp(sh.sink / 9, 0, 1);
  var m = sh.masts.map(function (x) { return x.name + (x.up ? '✓' : '✗'); }).join(' ');
  return '<h3>' + title + (sh.fate && !sh.sunk ? '　<span style="color:var(--gold)">' + sh.fate + '</span>' : '') + '</h3>船體 ' + (hull * 100).toFixed(1) + '%（打掉 ' + sh.lost.toLocaleString() + ' 格）<div class="bar"><i style="width:' + (hull * 100).toFixed(1) + '%"></i></div>' +
    '進水 ' + (sh.sunk ? '沉沒' : (fl * 100).toFixed(0) + '%') + '（水線下破洞 ' + (sh.inflow || 0).toLocaleString() + ' 格）<div class="bar water"><i style="width:' + (fl * 100).toFixed(0) + '%"></i></div>' +
    '航速 ' + (sh.spd * 1.944).toFixed(1) + ' 節（' + sh.pos + '）　' + SAILSETS[sh.sailSet] + ' ' + Math.round(sh.sailFrac * 100) + '%<br>' +
    ((SAIL === 'off' ? '停船' : sh.manual ? '手動操舵' : '自動操舵') + '　舵 ' + (sh.rudder > 0.05 ? '左 ' + Math.round(sh.rudder * 100) + '%' : sh.rudder < -0.05 ? '右 ' + Math.round(-sh.rudder * 100) + '%' : '正') + '<br>') +
    '船員 ' + (sh.able || 0) + '/' + sh.crew0 + '（傷 ' + sh.wounded + '　亡 ' + sh.dead + '）<br>' +
    '砲 有人 ' + (sh.gunsManned || 0) + '／還在 ' + sh.gunsAlive + '／' + sh.guns.length + '　' + m + '<br>' + gunRow(sh, 'S') + '<br>' + gunRow(sh, 'P') + '<br>開火 ' + sh.fired + '　命中 ' + sh.hits;
}
/** 一舷的砲列（長砲｜carronade＋追擊砲；船頭在左）：形狀 ＝ 裝填（● 好　◌ 裝填中　○ 開不了　✕ 毀），
 *  顏色 ＝ 人手（綠 滿編、黃 人數不足但能開（裝填慢）、灰 少於最少人數、紅 毀）；▶ ＝ 這一舷有砲對得到目標（我艦看瞄準點、其他看敵艦中央）。
 *  面板兩舷都列 ⇒ 觀戰也看得到、沒在用的那一舷壞了幾門也看得到。 */
function gunRow(sh, side) {
  function cell(g) {
    var st = !g.alive ? 'dead' : g.manned < g.crewMin ? 'none' : g.manned < g.crewFull ? 'short' : 'full';
    var k = !g.alive ? 3 : gunRate(g) <= 0 ? 2 : g.reload > 0 ? 1 : 0;
    if (HUD_ART) return '<span class="ico g-' + st + '" style="background-position:' + ((3 + k) * 100 / 7).toFixed(3) + '% 0"></span>';
    return '<span class="g-' + st + '">' + '●◌○✕'[k] + '</span>';
  }
  var gs = sh.guns.filter(function (x) { return x.type === 'long' && x.side === side; }), cs = sh.guns.filter(function (x) { return x.type !== 'long' && x.side === side; });
  var foe = SHIPS[1 - sh.i], w = sh.i === PLAYER_I && !AUTOFIRE ? aimPoint(sh) : foe && foe.center;
  var on = w && anyBears(sh, w, side), lab = (on ? '<b style="color:var(--gold)">▶' : '<span style="color:var(--dim)">　') + sideName(side) + (on ? '</b> ' : '</span> ');
  return '<span class="gr">' + lab + gs.map(cell).join('') + '｜' + cs.map(cell).join('') + '</span>';
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
  if (c2.width !== W * dpr) { c2.width = c2.height = W * dpr; }
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
    '<span style="color:#8fd3ff">風 從 ' + deg3(wb) + '（' + compassName(wb) + '）</span>　' + sh.pos + '<br>' +
    '船體 ' + hull.toFixed(1) + '%　進水 ' + (sh.sunk ? '沉沒' : fl.toFixed(0) + '%') + '<br>' +
    '傾斜 ' + Math.abs(roll).toFixed(1) + '°' + (Math.abs(roll) < 0.2 ? '' : roll < 0 ? '（左低）' : '（右低）') + '　縱傾 ' + pitch.toFixed(1) + '°<br>' +
    SAILSETS[sh.sailSet] + ' ' + Math.round(sh.sailFrac * 100) + '%　舵 ' + (sh.rudder > 0.05 ? '左 ' + Math.round(sh.rudder * 100) + '%' : sh.rudder < -0.05 ? '右 ' + Math.round(-sh.rudder * 100) + '%' : '正');
}
function hud(dt) {
  if (MSGT > 0) { MSGT -= dt; if (MSGT <= 0) $('msg').style.opacity = 0; }
  if (!SHIPS.length || (HUDN++ % 6)) return;
  var me = SHIPS[PLAYER_I], foe = SHIPS[1 - PLAYER_I];
  $('me').innerHTML = panel(me, '我艦 憲法號（藍）');
  $('foe').innerHTML = panel(foe, '敵艦 憲法號（紅）');
  // 下方：我艦的砲列（跟面板同一支）＋ 射界外警告；觀戰只顯示鏡頭
  var aw = aimPoint(me), bs = anyBears(me, aw, 'S') ? 'S' : anyBears(me, aw, 'P') ? 'P' : null;
  var warn = bs || AUTOFIRE ? '' : '　<b style="color:#ff9a7a">⚠ 射界外</b>';
  $('guns').innerHTML = gunRow(me, bs || me.side) + warn + '　' + CAM_NAMES[CAM.mode] + (PAUSED ? '　⏸ 暫停' : '');
  [].forEach.call(document.querySelectorAll('#ammo span'), function (s) { s.className = +s.dataset.a === AMMO_I ? 'on' : ''; });
  var t = DEBUG ? '格：' + SHIPS.map(function (s) { return s.grid.count; }).join('／') + '　四邊形：' + SHIPS.map(function (s) { return s.rs.quads(); }).join('／') + '　碎片 ' + D.n + '　粒子 ' + PT.n + '　脫落 ' + PIECES.length + (PHYS ? '　物理 ' + PHYS_MS.toFixed(2) + ' ms/步、垂繩 ' + SHIPS.map(function (s) { return s.loose.length; }).join('／') : '') + '　' + FPS.toFixed(0) + ' fps' : '';
  $('tip').textContent = t;
  drawNav(me);
}
function checkEnd() {
  if (OVER || MODE === 'sandbox' || DEMO >= 0) return;
  var me = SHIPS[PLAYER_I], foe = SHIPS[1 - PLAYER_I], txt = null;
  function fate(sh) { return sh.sunk ? '沉沒' : sh.fate; }
  if (foe.sunk || foe.struck) txt = '勝利！敵艦' + fate(foe);
  else if (me.sunk || me.struck) txt = '敗北……我艦' + fate(me);
  if (!txt) return;
  OVER = true;
  $('endT').textContent = txt;
  $('endS').innerHTML = '打掉的格數：我艦 ' + me.lost.toLocaleString() + '　敵艦 ' + foe.lost.toLocaleString() + '<br>開火／命中：' + me.fired + '／' + me.hits + '　經過 ' + SIMT.toFixed(0) + ' 秒' +
    '<br><span style="color:var(--dim)">' + strikeText() + '</span>';
  setTimeout(function () { $('end').className = 'on'; }, 2500);
}

