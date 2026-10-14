// ───────────────────────── HUD ─────────────────────────
// ───────────────────────── 廣播（畫面上方的訊息） ─────────────────────────
// 一行一則、最多 5 行，各自 4 秒後淡掉（⛔ 以前只有一行、新的蓋掉舊的 ⇒ 同一刻兩件事只看得到一件）。
// 砲被打飛：同一個半秒內的併成一行；傷亡：第一個人倒下起算 5 秒，報這 5 秒裡陣亡、受傷各幾個（不洗版；是 0 的那一項不報）。
var MSGS = [], MSG_MAX = 5, MSG_LIFE = 4;
/** imp：重要的（殉爆、斷成兩截、沉沒、降旗）⇒ 留 8 秒，滿了先擠掉不重要的。 */
function note(sh, text, imp) {
  if (DEMO >= 0 && !RUNNING) return;
  var who = sh.i === PLAYER_I ? '我艦' : sh.name, el = document.createElement('div');   // 我艦照舊；其他每艘用艦名（TASK-0552：多船時分得出是哪一艘），顏色照陣營
  el.innerHTML = '<span style="color:' + (teamIdx(sh) === 0 ? 'var(--blue)' : 'var(--red)') + '">' + who + '</span>　' + text;
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
  var cap = c.art === ART_CAPTAIN, how = dead ? (cause === '落水' || cause === '溺水' ? cause : '陣亡') : '受傷倒下', why = cause && cause !== '落水' && cause !== '溺水' ? '（' + cause + '）' : '';
  if (cap) { note(sh, '<b style="color:var(--gold)">船長' + how + '！</b>' + why, true); return; }
  if (c.role === ROLE.OFFICER || c.role === ROLE.HELM) {
    var left = sh.crew.filter(function (o) { return o.role === c.role && able(o); }).length, nm = ROLE_NAME[c.role], off = c.role === ROLE.OFFICER;   // 軍官照階級報（大副、二副…；40_crew.js makeCrew）
    note(sh, (off && c.rank !== undefined ? officerRank(c.rank) : nm) + how + why + (left ? '（還有 ' + left + ' 位' + (off ? '軍官' : '') + '）' : '　<b style="color:#ff9a7a">' + nm + '全倒' + (c.role === ROLE.OFFICER ? ' —— 沒人指揮，瞄準變散' : '') + '</b>'), !left);
    return;
  }
  var by = dead ? sh.news.kr : sh.news.wr; by[c.role] = (by[c.role] || 0) + 1;
}
/** 船員站不下（40_crew.js makeCrew 記的 sh.crewShort）⇒ 開戰時每一型報一行、援軍進場時報那一艘（TASK-0570：⛔ 不默默少人）。
 *  只報船隻配置頁改過的那幾項（預設本來就站不下的每一場都報會洗版；那些照實列在船隻配置頁）。 */
function crewShortNote(sh) {
  var d = crewDefault(sh.T.id), cw = sh.cw;
  var L = (sh.crewShort || []).filter(function (r) { return r[3] === 'guns' ? Object.keys(GUNS).some(function (t) { return gunCrew(cw, t) !== gunCrew(d, t); }) : cw[r[3]] !== d[r[3]]; });
  if (L.length) note(sh, '船員站不下（' + sh.T.name + '型）：' + L.map(function (r) { return r[0] + ' ' + r[2] + '／' + r[1]; }).join('、'));
}
/** 落水的水手（43_swim.js）：爬回船上、爬上友艦、被敵艦撈走、撈起別艘的 ⇒ 記著，第一件起算 NEWS_WIN 秒那一艘報一行（Tim 2026-10-14：⛔ 一個一個報會洗版）。 */
var SWIM_TXT = { back: '爬回船上', ally: '爬上友艦', foe: '被敵艦撈走', gotAlly: '撈起友艦水手', gotFoe: '撈起敵艦水手（加入我方）' };
function swimNews(sh, k) { var N = sh.news; N.sw = N.sw || {}; N.sw[k] = (N.sw[k] || 0) + 1; if (!(N.st >= 0)) N.st = SIMT; }
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
  if (N.st >= 0 && SIMT - N.st >= NEWS_WIN) {
    var sp = []; for (var k in SWIM_TXT) if (N.sw[k]) sp.push(SWIM_TXT[k] + ' ' + N.sw[k]);
    if (sp.length) note(sh, NEWS_WIN + ' 秒內 落水水手 ' + sp.join('、'));
    N.sw = {}; N.st = -1;
  }
}
/** 面板的一行：砲長與現在瞄哪裡（我艦手動 ⇒ 玩家的瞄準模式，砲長待命）。 */
function capText(sh) {
  var C = CAPTAINS[sh.cap], manual = handAim(sh);
  return '砲長 ' + (C ? C.name : '—') + '：' + (manual ? '待命（我在瞄：' + AIM_NAME[sh.pMode || 'free'] + '）' : sh.aimMode ? '瞄' + AIM_NAME[sh.aimMode] : '觀察中');
}
// 進水 %（HUD；TASK-0535，Tim 2026-10-13：原本 ＝ 下沉 ÷ 9 m ⇒ 26% 時已經注定要沉、50% 就淹過船體 ⇒ 改用艙內積水算：船重＋積水 ＝ 浮力 ⇒ 100%）。
//   浮力算到「開始沉」那條線（下沉 SINK_FINAL ＝ 4.2 m，32_hull.js；約略是甲板泡水）：W100 ＝ 船從現在的浮高再往下 4.2 m 要多吃的水（浮力表 T.hyd；
//   船被打輕、浮高了 ⇒ W100 跟著變大）。粒子模式 W ＝ 艙內的積水；公式模式沒有水量 ⇒ W ＝ 現在比原本多吃的水（下沉照浮力表換算）。
//   ⇒ 兩種模式都是開始沉那一刻 100%。只是顯示：航速照舊用下沉 ÷ 9 m（31_sailing.js，模擬）。
var SINK_FINAL = 4.2;
/** 浮高 L 公尺（負 ＝ 吃水深）時比設計水線的排水輕幾噸（32_hull.js liftFor 的反函數）。 */
function tonsAt(T, L) {
  var HYD = T.hyd, n = HYD.length - 1, z = T.zw - L / S;
  if (z <= 0) return HYD[0] * RHO_W; if (z >= n) return HYD[n] * RHO_W;
  var i = Math.floor(z); return (HYD[i] + (HYD[i + 1] - HYD[i]) * (z - i)) * RHO_W;
}
/** 進水 %（0–1）。 */
function floodPct(sh) {
  if (sh.sinkingFinal || sh.sunk) return 1;
  var T = sh.T; if (!T || !T.hyd) return clamp(sh.sink / SINK_FINAL, 0, 1);
  var base = T.disp - (sh.mass0 || shipT(sh)) + massLost(sh), L0 = liftFor(T, base), W100 = base - tonsAt(T, L0 - SINK_FINAL);
  var W = sh.fl && !sh.broken ? sh.fl.vol * RHO_W : base - tonsAt(T, L0 - sh.sink);
  return W100 > 0 ? clamp(W / W100, 0, 1) : 1;
}
function panel(sh, title) {
  var hull = sh.grid.count / sh.orig, fl = floodPct(sh);
  var m = sh.masts.map(function (x) { return x.name + (x.up ? '✓' : '✗'); }).join(' ');
  // 排水量（Tim 2026-10-13）＝ 開戰時整艘船的重量（格＋砲＋火藥桶＋壓艙物，sh.mass0）：浮著的船排開的水跟自己一樣重；預設壓艙物剛好在設計水線 ⇒ 也就是設計排水量。
  // 「現在」＝ 扣掉被打掉的（格、打飛的砲、炸掉的桶，massLost，跟減重上浮同一支）；艙內的積水不算（那是進水，看下一行）
  var m0 = sh.mass0 || shipT(sh), disp = Math.round(m0), now = Math.round(m0 - massLost(sh));   // 兩個都取到 1 噸（⛔ 開戰時的取到 10 噸 ⇒ 第一格「2,150・現在 2,154」，現在比開戰還重）
  // 橫向兩欄（TASK-0564，Tim 2026-10-14：佔畫面中間 ⇒ 儘量橫鋪、別往下壓）：左 ＝ 船體、進水、航行；右 ＝ 砲長、船員、砲、開火。砲一門一門的狀態在底下的砲位圖（gmapDraw）。
  return '<h3>' + title + '<span class="disp">排水量 ' + disp.toLocaleString() + ' 噸・現在 ' + now.toLocaleString() + ' 噸</span>' + (sh.fate && !sh.sunk ? '　<span style="color:var(--gold)">' + sh.fate + '</span>' : '') + '</h3><div class="pcols"><div class="pc">船體 ' + (hull * 100).toFixed(1) + '%（打掉 ' + sh.lost.toLocaleString() + ' 格）<div class="bar"><i style="width:' + (hull * 100).toFixed(1) + '%"></i></div>' +
    '進水 ' + (sh.sunk ? '沉沒' : (fl * 100).toFixed(0) + '%') + (sh.fl && !sh.broken ? '（艙內積水 ' + Math.round(sh.fl.vol * RHO_W).toLocaleString() + ' 噸・破口 ' + sh.fl.area.toFixed(1) + ' m²）' : '（水線下破洞 ' + (sh.inflow || 0).toLocaleString() + ' 格）') + (sh.lift > 0.05 ? '　浮高 ' + sh.lift.toFixed(1) + ' m' : sh.lift < -0.05 ? '　吃水深 ' + (-sh.lift).toFixed(1) + ' m' : '') + '<div class="bar water"><i style="width:' + (fl * 100).toFixed(0) + '%"></i></div>' +
    (sh.spd < -0.05 ? '倒車 ' + (-sh.spd * 1.944).toFixed(1) : '航速 ' + (sh.spd * 1.944).toFixed(1)) + ' 節（' + sh.pos + '）　' + (sh.thr === null || sh.thr === undefined ? '' : '動力 ' + (sh.thr > 0 ? '前進' : sh.thr < 0 ? '倒車' : '停') + '　') + SAILSETS[sh.sailSet] + ' ' + Math.round(sh.sailFrac * 100) + '%<br>' +
    ((SAIL === 'off' ? '停船' : sh.manual ? '手動操舵' : '自動操舵') + '　舵 ' + (sh.rudder > 0.05 ? '左 ' + Math.round(sh.rudder * 100) + '%' : sh.rudder < -0.05 ? '右 ' + Math.round(-sh.rudder * 100) + '%' : '正')) + '<br>' + navText(sh) + '</div><div class="pc">' +
    capText(sh) + '<br>' +
    '船員 ' + (sh.able || 0) + '/' + sh.crew0 + '（傷 ' + sh.wounded + '　亡 ' + sh.dead + '）' + handsText(sh) + medText(sh) + swimText(sh) + '　' + supplyText(sh) + '<br>' +
    '砲 有人 ' + (sh.gunsManned || 0) + '／還在 ' + sh.gunsAlive + '／' + sh.guns.length + '　' + m + '<br>開火 ' + sh.fired + '　命中 ' + sh.hits +
    '<div class="legend">砲位圖：● 好 ◌ 裝填 ○ 開不了 △ 等火藥 ≈ 泡水 ✕ 毀｜<b style="color:#7be37b">綠</b> 滿編 <b style="color:#f0d264">黃</b> 不足 <b style="color:#9a9a9a">灰</b> 沒人｜最上層在船內、越下層越外</div></div></div>';
}
// ───────────────────────── 上方艦隊（TASK-0552；Tim 2026-10-14） ─────────────────────────
// 場上每一艘一個圓形按鈕：我方沿左邊、敵方沿右邊往下排（照 SHIPS 的順序 ⇒ 我艦、敵方第一艘在最上面；候補還有幾艘接在最後）。
//   外圈 ＝ 船體（金）、內圈 ＝ 進水（水藍），中間 ＝ 那一型的側面投影（05_hull.js sideImg；我方船頭朝右、敵方朝左 ⇒ 都朝畫面中間）與艦名；
//   ★ ＝ 我艦；沉沒、下沉、降旗寫在圖上、整顆變暗。按鈕的畫布只在讀數變了才重畫（key）。
// 點一顆 ⇒ 中間展開那一艘的詳細資訊（panel，同時最多一艘）；點同一顆或點資訊本身 ⇒ 收回。預設全折疊、每一場開局全折疊（fleetReset，70_flow.js reset）。
var INFO_SH = null, SB_EL = {}, SUNK_HIDE = 60;   // SUNK_HIDE：沉了幾秒（模擬時間）之後上方的圓鈕收掉（Tim 2026-10-14：補船之後那一欄才不會越排越長）
// 點資訊或旁邊的砲位圖任何地方 ⇒ 收回。用 pointerdown：⛔ click 要按下、放開都落在同一個元素 —— 卡片每 6 格整個重畫（innerHTML），按下到放開之間剛好重畫 ⇒ click 不觸發（Tim：收起有時沒反應）
['info', 'gmap'].forEach(function (id) { $(id).addEventListener('pointerdown', function (e) { e.preventDefault(); if (e.target.closest && e.target.closest('[data-see]')) { camSee(INFO_SH); return; } INFO_SH = null; fleetHud(SHIPS[PLAYER_I]); }); });
/** 「🎥 看這艘」（詳細資訊的標題列；Tim 2026-10-14）：鏡頭換成看那一艘（看我艦那一種：跟著它、繞著它轉，拖曳、平移、縮放照舊）；資訊不收。按 C 換鏡頭 ⇒ 回到照常的循環。 */
function camSee(o) { if (!o) return; CAM.mode = 3; CAM.follow = null; CAM.pan = [0, 0]; CAM.see = o.i === PLAYER_I ? null : o; CAM.dist = 75; CAM.trYaw = null; }
function fleetReset() { INFO_SH = null; for (var k in SB_EL) SB_EL[k].el.remove(); SB_EL = {}; [].forEach.call(document.querySelectorAll('.sbres'), function (e) { e.remove(); }); }
function sbMake(o, box) {
  var el = document.createElement('div'), cv = document.createElement('canvas'); el.className = 'sb'; el.appendChild(cv);
  var nl = document.createElement('span'), nr = document.createElement('span'); nl.className = 'sbn l'; nr.className = 'sbn r'; el.appendChild(nl); el.appendChild(nr);   // 船員、砲（sbNums）
  el.onclick = function (e) { e.stopPropagation(); INFO_SH = INFO_SH === o ? null : o; fleetHud(SHIPS[PLAYER_I]); };
  box.insertBefore(el, box.querySelector('.sbres')); return { el: el, cv: cv, box: box, key: '', nl: nl, nr: nr, nk: '' };
}
/** 圓鈕兩側的數字：左下 還能動的船員、右下 還在的砲（像素圖示：HUD 美術的「船員」「裝填好」；沒有美術 ⇒ emoji）。 */
function sbIcon(k, emo) { return HUD_ART ? '<span class="ico" style="background-position:' + (k * 100 / 7).toFixed(3) + '% 0"></span>' : '<i>' + emo + '</i>'; }
function sbNums(b, o) {
  var cr = 0, gn = 0; o.crew.forEach(function (c) { if (able(c)) cr++; }); o.guns.forEach(function (g) { if (g.alive && !g.wet) gn++; });   // 泡水的不算（Tim 2026-10-14：只算還能用的）
  var k = cr + '/' + gn + (HUD_ART ? 'a' : ''); if (k === b.nk) return; b.nk = k;
  b.nl.innerHTML = sbIcon(0, '👤') + cr; b.nr.innerHTML = sbIcon(3, '💥') + gn;
  b.nl.title = '船員還能動的 ' + cr + ' 人'; b.nr.title = '還能用的砲 ' + gn + ' 門（沒被打掉、沒泡水）';
}
/** 船隻配置頁最上面那個大圓鈕（跟艦隊圓鈕同一種畫法：天與海、側面投影、艦名；沒有圓環）。 */
function badgeDraw(cv, T, name) {
  var dpr = window.devicePixelRatio || 1, W = Math.round((cv.clientWidth || 150) * dpr); if (!W) return;
  cv.width = cv.height = W; var g = cv.getContext('2d'), R = W / 2; g.clearRect(0, 0, W, W);
  g.fillStyle = 'rgba(12,18,26,.92)'; g.beginPath(); g.arc(R, R, R - 1, 0, 6.2832); g.fill();
  var sky = g.createLinearGradient(0, R * 0.2, 0, R * 1.8); sky.addColorStop(0, '#6f8aa3'); sky.addColorStop(0.62, '#a9bccb'); sky.addColorStop(0.63, '#3e6680'); sky.addColorStop(1, '#2a4a60');
  g.fillStyle = sky; g.beginPath(); g.arc(R, R, R * 0.86, 0, 6.2832); g.fill();
  g.lineWidth = Math.max(2, 2 * dpr); g.strokeStyle = '#e8c26a'; g.beginPath(); g.arc(R, R, R - 2 * dpr, 0, 6.2832); g.stroke();
  var im = T && T.sideImg;
  if (im) { var bw = R * 1.5, bh = R * 1.15, k = Math.min(bw / im.width, bh / im.height), iw = im.width * k, ih = im.height * k;
    g.save(); g.beginPath(); g.arc(R, R, R * 0.86, 0, 6.2832); g.clip(); g.imageSmoothingEnabled = true; g.drawImage(im, R - iw / 2, R * 1.12 - ih, iw, ih); g.restore(); }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#000'; g.shadowBlur = 4 * dpr; g.fillStyle = '#fff';
  g.font = 'bold ' + Math.round(R * 0.2) + 'px "Noto Sans TC","Microsoft JhengHei",sans-serif'; g.fillText(name, R, R * 1.4, R * 1.3);
}
function sbDraw(b, o, flip) {
  var hull = o.grid.count / o.orig, fl = o.sunk ? 1 : floodPct(o), st = o.sunk ? '沉沒' : o.sinkingFinal ? '下沉' : o.struck ? '降旗' : '';
  var dpr = window.devicePixelRatio || 1, W = Math.round(b.el.clientWidth * dpr), me = o.i === PLAYER_I;
  var key = [hull.toFixed(3), fl.toFixed(2), st, me, W].join();
  b.el.classList.toggle('on', INFO_SH === o); b.el.classList.toggle('out', !!st);
  b.el.title = (me ? '我艦 ' : '') + o.name + '　船體 ' + (hull * 100).toFixed(1) + '%　進水 ' + Math.round(fl * 100) + '%' + (st ? '　' + st : '');
  if (key === b.key || !W) return; b.key = key;
  var cv = b.cv; cv.width = cv.height = W;
  var g = cv.getContext('2d'), R = W / 2, tc = teamIdx(o) === 0 ? '#6f9bff' : '#ff6f6f';
  function ring(r, w, f, col) {
    g.lineWidth = w; g.lineCap = 'butt'; g.strokeStyle = 'rgba(255,255,255,.13)'; g.beginPath(); g.arc(R, R, r, 0, 6.2832); g.stroke();
    if (f > 0.002) { g.strokeStyle = col; g.beginPath(); g.arc(R, R, r, -Math.PI / 2, -Math.PI / 2 + 6.2832 * Math.min(1, f)); g.stroke(); }
  }
  g.fillStyle = 'rgba(12,18,26,.88)'; g.beginPath(); g.arc(R, R, R - 1, 0, 6.2832); g.fill();
  var sky = g.createLinearGradient(0, R * 0.3, 0, R * 1.7); sky.addColorStop(0, '#6f8aa3'); sky.addColorStop(0.62, '#a9bccb'); sky.addColorStop(0.63, '#3e6680'); sky.addColorStop(1, '#2a4a60');
  g.fillStyle = sky; g.beginPath(); g.arc(R, R, R * 0.62, 0, 6.2832); g.fill();                              // 圓心：天與海（深色的船身才看得到）
  g.lineWidth = Math.max(1, dpr); g.strokeStyle = tc; g.beginPath(); g.arc(R, R, R - 1, 0, 6.2832); g.stroke();   // 陣營色的外框
  ring(R * 0.86, R * 0.13, hull, '#e8c26a');                                                                  // 外圈：船體
  ring(R * 0.69, R * 0.11, fl, fl >= 0.7 ? '#ff7a6a' : '#4fb3ff');                                            // 內圈：進水（七成以上轉紅）
  g.globalAlpha = st ? 0.4 : 1;
  var im = o.T.sideImg;
  if (im) {
    var bw = R * 1.12, bh = R * 0.9, k = Math.min(bw / im.width, bh / im.height), iw = im.width * k, ih = im.height * k;
    g.save(); g.beginPath(); g.arc(R, R, R * 0.62, 0, 6.2832); g.clip();
    g.translate(R, R * 1.06 - ih); if (flip) g.scale(-1, 1); g.imageSmoothingEnabled = true; g.drawImage(im, -iw / 2, 0, iw, ih); g.restore();
  }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#000'; g.shadowBlur = 3 * dpr;
  g.fillStyle = '#fff'; g.font = 'bold ' + Math.round(R * 0.27) + 'px "Noto Sans TC","Microsoft JhengHei",sans-serif'; g.fillText(o.name, R, R * 1.28, R * 1.1);
  g.globalAlpha = 1;
  if (st) { g.fillStyle = st === '降旗' ? '#fff' : '#ff9a8a'; g.font = 'bold ' + Math.round(R * 0.3) + 'px sans-serif'; g.fillText(st, R, R * 0.92); }
  if (me) { g.fillStyle = '#e8c26a'; g.font = Math.round(R * 0.3) + 'px sans-serif'; g.fillText('★', R, R * 0.4); }
}
function fleetHud(me) {
  if (!me) return;
  var pt = playerTeam();
  ['L', 'R'].forEach(function (s) {
    var box = $('fleet' + s), team = s === 'L' ? pt : other(pt);
    SHIPS.forEach(function (o) {
      if (o.team !== team) return;
      if (o.sunk && o.sunkHud == null) o.sunkHud = SIMT;                                                      // 沉沒那一刻（模擬時間；只給 HUD 用）
      if (o.sunk && SIMT - o.sunkHud > SUNK_HIDE) { if (SB_EL[o.i]) { SB_EL[o.i].el.remove(); delete SB_EL[o.i]; } if (INFO_SH === o) INFO_SH = null; return; }
      var b = SB_EL[o.i]; if (!b || b.box !== box) { if (b) b.el.remove(); b = SB_EL[o.i] = sbMake(o, box); }
      sbDraw(b, o, s === 'R'); sbNums(b, o);
    });
    var n = RESERVE[team].length, rc = box.querySelector('.sbres');
    if (n && !rc) { rc = document.createElement('div'); rc.className = 'sbres'; box.appendChild(rc); }
    if (rc) { if (n) rc.textContent = '候補 ' + n; else rc.remove(); }
  });
  var el = $('info'), o = INFO_SH;
  if (o && SHIPS.indexOf(o) < 0) o = INFO_SH = null;
  if (!o) { el.style.display = 'none'; gmapDraw(null); }
  else {
    var fs = flagship(o.team), many = teamShips(o.team).length > 1 || RESERVE[o.team].length > 0;
    var who = o.i === PLAYER_I ? '我艦' : o.team === pt ? (many && o === fs ? '我方旗艦' : '友艦') : (many && o === fs ? '敵方旗艦' : '敵艦');
    var title = who + ' ' + o.name + (o.name !== o.T.name ? '<span class="cls">（' + o.T.name + '型）</span>' : '') + teamTag(o);
    var seeing = CAM.mode === 3 && (CAM.see === o || (!CAM.see && o.i === PLAYER_I));
    el.innerHTML = panel(o, title).replace('<h3>', '<h3><span class="fold">▲ 收起</span><span class="fold see' + (seeing ? ' on' : '') + '" data-see="1">🎥 ' + (seeing ? '看著這艘' : '看這艘') + '</span>');   // 放在標題最前面再靠右浮動（⛔ 放最後 ⇒ 窄的時候浮到排水量那一行、壓到右欄）
    el.style.display = 'block'; el.style.borderLeftColor = teamIdx(o) === 0 ? 'var(--blue)' : 'var(--red)';
    gmapDraw(o);
  }
}
// ───────────────────────── 砲位圖（TASK-0564；Tim 2026-10-14） ─────────────────────────
// 展開的那一艘：俯視船體（05_hull.js navImg，船頭朝上、右舷在右；Tim 2026-10-14）直接鋪在詳細資訊旁邊（沒有底框；窄螢幕排到下面），每門砲畫在它的砲口位置。
//   比例尺固定（電腦 GMAP_K px／公尺、手機 2.5，跟卡片並排）⇒ 小船就小；一條 10 m 在船的下面（GMAP_FOOT：⛔ 疊在右下角會蓋到船尾的砲）。上下幾層的砲同一個位置 ⇒ 沿砲軸往外錯開：最上層往船內 1.4 m、往下每一層再往外 2.3 m。
//   砲的符號與顏色跟下方 HUD（gunCell）同一套：形狀 ＝ 裝填（● 好 ◌ 裝填中 ○ 開不了 △ 等火藥 ≈ 泡水 ✕ 毀）、顏色 ＝ 人手（綠 滿編、黃 不足、灰 沒人、紅 毀、藍 泡水）；
//   不寫「左舷／右舷」（Tim 2026-10-14 拿掉：船頭朝上 ⇒ 左右就是左右舷）。
var GMAP_K = 4, GMAP_PAD = 4.5, GMAP_FOOT = 18;                                          // px／公尺；四周留白（公尺：最下層的砲畫在船殼外）
var GMAP_COL = { full: '#7be37b', short: '#f0d264', none: '#9a9a9a', dead: '#ff5b5b', wet: '#58b7ff' };
function gmapDraw(sh) {
  var cv = $('gmap'), T = sh && sh.T, NI = T && T.navImg;
  if (!NI) { cv.style.display = 'none'; return; }
  var D = sh.decks, n = D.length;
  var narrow = window.innerWidth <= 760, K = narrow ? 2.5 : GMAP_K, dpr = window.devicePixelRatio || 1, C = NAV_CELL, s = K * S, P0 = Math.max(GMAP_PAD, -1.4 + 2.3 * (n - 1) + 2) * K;   // s：每一格幾 px；P0：留白（px）—— 最下層錯開得最外面（三叉戟號四層砲甲板 ⇒ 5.5 m，⛔ 固定 4.5 m 那層畫到圖外）
  var W = NI.width * C * s + 2 * P0, H = NI.height * C * s + 2 * P0 + GMAP_FOOT;
  function scr(x, y) { return [(y - T.navX0 * C) * s + P0, ((T.navGH - T.navY0) * C - x) * s + P0]; }   // 格 (x, y) ⇒ 畫面（圖上 (u, v) ＝ (y/C − x0, H − y0 − x/C)）
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = Math.round(W) + 'px'; }
  cv.style.display = 'block';
  var g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  g.save(); g.shadowColor = 'rgba(0,0,0,.75)'; g.shadowBlur = 6; g.globalAlpha = sh.sunk ? 0.45 : 0.97;
  g.drawImage(NI, P0, P0, NI.width * C * s, NI.height * C * s); g.restore();
  var R = Math.max(narrow ? 1.5 : 2.2, Math.min(4, K * 0.55));
  sh.guns.forEach(function (gn) {
    var k = 0; for (var q = 0; q < n; q++) if (D[q].key === gn.deck) k = q;
    var off = (-1.4 + 2.3 * (n - 1 - k)) / S, p = scr(gn.muz[0] + gn.ax[0] * off, gn.muz[1] + gn.ax[1] * off), X = p[0], Y = p[1];
    var st = !gn.alive ? 'dead' : gn.wet ? 'wet' : gn.manned < gn.crewMin ? 'none' : gn.manned < gn.crewFull ? 'short' : 'full';
    var sym = !gn.alive ? 3 : gn.wet ? 5 : gunRate(gn) <= 0 ? 2 : gn.needCart && !(gn.box > 0) ? 4 : gn.reload > 0 ? 1 : 0, col = GMAP_COL[st];
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.4;
    g.beginPath();
    if (sym === 3) { g.moveTo(X - R, Y - R); g.lineTo(X + R, Y + R); g.moveTo(X + R, Y - R); g.lineTo(X - R, Y + R); g.stroke(); }
    else if (sym === 4) { g.fillStyle = '#ffb35a'; g.moveTo(X, Y - R); g.lineTo(X + R, Y + R * 0.8); g.lineTo(X - R, Y + R * 0.8); g.closePath(); g.fill(); }
    else { g.arc(X, Y, R, 0, 6.2832); if (sym === 0 || sym === 5) g.fill(); else { if (sym === 2) g.setLineDash([1.5, 1.5]); g.stroke(); g.setLineDash([]); } }
  });
  g.font = 'bold ' + (narrow ? 9 : 11) + 'px "Noto Sans TC","Microsoft JhengHei",sans-serif'; g.shadowColor = '#000'; g.shadowBlur = 3;
  var bar = 10 * K, yb = H - 4; g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2; g.beginPath(); g.moveTo(W - 6 - bar, yb); g.lineTo(W - 6, yb); g.stroke();   // 10 m：船下面那一條留白（GMAP_FOOT）
  g.fillStyle = 'rgba(255,255,255,.85)'; g.textAlign = 'right'; g.textBaseline = 'bottom'; g.fillText('10 m', W - 6 - bar - 4, yb + 3); g.textAlign = 'left'; g.textBaseline = 'middle';
}
/** 一門砲的符號：形狀 ＝ 裝填（● 好　◌ 裝填中　○ 開不了　△ 等火藥　≈ 泡水　✕ 毀），顏色 ＝ 人手（綠 滿編、黃 人數不足但能開（裝填慢）、灰 少於最少人數、紅 毀、藍 泡水）；受損 ⇒ 底下一條血條。 */
function gunCell(g) {
  var st = !g.alive ? 'dead' : g.wet ? 'wet' : g.manned < g.crewMin ? 'none' : g.manned < g.crewFull ? 'short' : 'full';
  var k = !g.alive ? 3 : g.wet ? 5 : gunRate(g) <= 0 ? 2 : g.needCart && !(g.box > 0) ? 4 : g.reload > 0 ? 1 : 0;   // 4 ＝ 等火藥與彈藥（藥箱空了）
  var hp = !g.alive ? 0 : Math.max(0, g.model.hp / g.model.hpMax), hurt = g.alive && hp < 0.999;   // 受損 ⇒ 底下一條血條（.hp::after，寬 ＝ 剩下的血量）
  var cls = 'g-' + st + (hurt ? ' hp' : ''), sty = hurt ? '--hp:' + Math.round(hp * 100) + '%;' : '';
  if (HUD_ART) return '<span class="ico ' + cls + '" style="' + sty + 'background-position:' + ((3 + (k === 4 ? 1 : k === 5 ? 2 : k)) * 100 / 7).toFixed(3) + '% 0"></span>';
  return '<span class="' + cls + ' gk' + k + '"' + (sty ? ' style="' + sty + '"' : '') + '>' + '●◌○✕△≈'[k] + '</span>';   // gk<k>：比較寬的符號（✕ △）在 HUD 的固定格子裡縮小字級（template.html）
}
/** HUD 放哪：追擊砲 ⇒ 砲軸偏船頭 'bow'、偏船尾 'stern'（⛔ 只看砲軸：憲法號、餘燼號船頭的追擊砲朝兩舷外 60–75°，會被當成側舷）；
 *  其他砲 ⇒ 砲軸（格座標，+x ＝ 船頭）幾乎朝船頭／船尾才算，不然 ＝ 側舷 'side'。 */
function gunDir(g) { if (g.type === 'chase') return g.ax[0] >= 0 ? 'bow' : 'stern'; return g.ax[0] > 0.7 ? 'bow' : g.ax[0] < -0.7 ? 'stern' : 'side'; }
/** 我艦的砲（Tim 2026-10-14）：沒有字、沒有底板（符號描黑邊直接壓在畫面上）。
 *  側舷砲貼著羅盤左右兩邊往外長（#gunsL 左舷、#gunsR 右舷；船頭那門靠羅盤、每層砲甲板一行、最上層在上；那一舷有砲對得到目標 ⇒ 靠羅盤那一側一條金線）；
 *  船頭砲在羅盤上面（#gunsB）、船尾砲在羅盤下面（#gunsA）—— 跟羅盤裡船頭朝上的船同一個方向；左舷的在左、對得到 ⇒ 靠羅盤那一側一條金線；沒有就藏起來。
 *  下方面板原本那一格（#guns）只剩「⚠ 射界外」。 */
function gunHud(me) {
  var foe = foeOf(me), w = handAim(me) ? aimPoint(me) : foe && foe.center;
  ['P', 'S'].forEach(function (side) {
    var rows = me.decks.map(function (D) { return me.guns.filter(function (x) { return x.deck === D.key && x.side === side && gunDir(x) === 'side'; }); }).filter(function (r) { return r.length; }).reverse();
    var on = w && me.guns.some(function (g) { return g.side === side && gunDir(g) === 'side' && g.alive && gunRate(g) > 0 && gunTarget(me, g, w); });
    var box = $(side === 'P' ? 'gunsL' : 'gunsR'), h = rows.map(function (r) { return '<div>' + r.map(gunCell).join('') + '</div>'; }).join('');   // 左舷那一欄 rtl（template.html）⇒ 兩舷都是船頭靠羅盤、換行也從羅盤那邊接
    if (box.innerHTML !== h) box.innerHTML = h;
    box.classList.toggle('on', !!on);
  });
  [['bow', 'gunsB'], ['stern', 'gunsA']].forEach(function (E) {
    var L = me.guns.filter(function (g) { return gunDir(g) === E[0]; }).sort(function (a, b) { return a.ax[1] - b.ax[1]; });   // 左舷（−y）在左
    var on = w && L.some(function (g) { return g.alive && gunRate(g) > 0 && gunTarget(me, g, w); }), box = $(E[1]), h = L.map(gunCell).join('');
    if (box.innerHTML !== h) box.innerHTML = h;
    box.style.display = L.length ? '' : 'none'; box.classList.toggle('on', !!on);
  });
  var aw = aimPoint(me), bears = anyBears(me, aw, 'S') || anyBears(me, aw, 'P');
  var s = bears || !handAim(me) ? '' : '<b style="color:#ff9a7a">⚠ 射界外</b>', gb = $('guns');
  if (gb.innerHTML !== s) gb.innerHTML = s;
  gb.style.display = s ? '' : 'none';
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
/** 羅盤那一團（#navBox）往下壓、底邊貼在下方面板（#ctl）頂上 BOT_GAP px（Tim 2026-10-14）：量現在差多少、改 margin-bottom（負的 ⇒ 落進兩組大圓鈕之間；砲列壓在大圓鈕底下）。
 *  #botC 可能被 scale（手機橫拿 .82）⇒ 量到的差先除回去；差不到半格不動。 */
var BOT_GAP = 2;
function botFit() {
  var nb = $('navBox'), ctl = $('ctl'), bc = $('botC'); if (!nb || !ctl) return;
  var k = bc.getBoundingClientRect().width / (bc.offsetWidth || 1) || 1, d = (ctl.getBoundingClientRect().top - BOT_GAP - nb.getBoundingClientRect().bottom) / k;
  if (Math.abs(d) < 0.5) return;
  nb.style.marginBottom = Math.min(0, (parseFloat(nb.style.marginBottom) || 0) - d) + 'px';   // ⛔ 不給正的：面板比大圓鈕高的時候照舊排在面板上面
}
// ───────────────────────── 左下：羅盤與船身 ─────────────────────────
// 羅盤跟著鏡頭轉（畫面上方 ＝ 鏡頭看的方向）；「北」＝ 世界 −z（只是參考方向，航向照它算：東 ＝ +x）。
// 圈上：我艦（中間，尖端 ＝ 船頭）、風（從哪吹來的箭頭）、敵艦方位（紅點）、兩舷的砲門射界（±26°，對得到敵艦的那一舷亮）。
var COMPASS = ['北', '北北東', '東北', '東北東', '東', '東南東', '東南', '南南東', '南', '南南西', '西南', '西南西', '西', '西北西', '西北', '北北西'];
function bearing(x, z) { return ((Math.atan2(x, -z) * 57.2958) % 360 + 360) % 360; }
function compassName(b) { return COMPASS[Math.round(b / 22.5) % 16]; }
function deg3(b) { return ('00' + Math.round(b) % 360).slice(-3) + '°'; }
/** 羅盤的射界（drawNav）：世界方位角（度，atan2(z, x)）的連續段 [起, 迄]。all ＝ 開得動的砲、on ＝ 這一刻對得到敵艦的。 */
var ARC_BIN = { all: new Uint8Array(360), on: new Uint8Array(360) };
function gunArcs(sh, foe) {
  var A = ARC_BIN.all, O = ARC_BIN.on, w = foe && foe.center; A.fill(0); O.fill(0);
  sh.guns.forEach(function (gn) {
    if (!gn.alive || gunRate(gn) <= 0) return;
    var ax = gunAxis(sh, gn), a = Math.round(Math.atan2(ax[2], ax[0]) * 57.2958), on = w && !!gunTarget(sh, gn, w);
    for (var d = -26; d <= 26; d++) { var k = ((a + d) % 360 + 360) % 360; A[k] = 1; if (on) O[k] = 1; }   // ±26° ＝ ±0.45 rad
  });
  function runs(B) {
    var out = [], s0 = -1, k, i;
    for (k = 0; k < 360 && B[k]; k++); if (k === 360) return [[0, 360]];   // 整圈都有
    for (i = 1; i <= 360; i++) { var j = (k + i) % 360; if (B[j] && s0 < 0) s0 = k + i; if (!B[j] && s0 >= 0) { out.push([s0, k + i - 1]); s0 = -1; } }   // 從空的那一格開始掃 ⇒ 跨 0° 的段不會斷成兩截
    return out;
  }
  return { all: runs(A), on: runs(O) };
}
var TURN_T = 10, TURN_COL = '#7ef0c8', TURN_OFF = 0.22;   // 羅盤外圈的轉向弧：預測幾秒後的船頭、顏色（跟射界的金、風的藍、敵艦的紅分開）、起點離船頭幾 rad（約 13°，讓開航速箭頭）
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
  var pn = P(dirOf(0), 1.17); g.fillText('N', pn[0], pn[1]);
  var F = fwd(sh.yaw), foe = foeOf(sh);
  // 射界（Tim 2026-10-13：照真的能開的砲畫）：每一門還開得動的砲（沒毀、有人）自己的砲門射界（砲軸 ±0.45 rad，跟 bears 同一個數）的聯集 ⇒ 暗；
  //   這一刻對得到敵艦的那幾門（gunTarget，跟開砲同一支）再疊一層亮的。追擊砲（船頭、餘燼號的船尾）各自的方向都畫得出來；砲打掉、沒人操作 ⇒ 那一塊消失。
  //   以 1° 一格累計再畫連續的段（聯集、跨 ±180° 都不用另外處理）；從船的中心畫（羅盤的比例下砲口在船上的前後差可以不管）。
  var arc = gunArcs(sh, foe), p0 = P([0, 0, 0], 0);
  [[arc.all, 'rgba(232,194,106,.13)'], [arc.on, 'rgba(232,194,106,.45)']].forEach(function (L) {
    L[0].forEach(function (r) {
      g.fillStyle = L[1]; g.beginPath(); g.moveTo(p0[0], p0[1]);
      for (var d = r[0]; ; d = Math.min(d + 3, r[1])) { var t = d / 57.2958, q = P([Math.cos(t), 0, Math.sin(t)], 0.97); g.lineTo(q[0], q[1]); if (d >= r[1]) break; }   // 每 3° 一點，最後一點落在段尾
      g.closePath(); g.fill();
    });
  });
  // 風：三條平行的風線從圈外吹進來（Tim 2026-10-14：一眼看出是風向），中間那條最長、尖端一個 ＞；風越強越長、越粗、越開（TASK-0566）：
  //   長 ＝ 0.25 ＋ 節 ÷ 60（0.3–0.95 個半徑；兩邊那兩條 ×0.65）、粗 ＝ 1 ＋ 節 ÷ 30（到 3 px）、間距 4 ＋ 節 ÷ 12 px ⇒ 晴天約 14 節短細、暴風雨 50 節長到圓心附近
  var Wd = norm(WIND), from = [-Wd[0], 0, -Wd[2]], kn = windKnots(), wl = clamp(0.25 + kn / 60, 0.3, 0.95), ww = clamp(1 + kn / 30, 1, 3), gap = clamp(4 + kn / 12, 4, 9);
  var a0 = P(from, 1.2), a1 = P(from, 1.2 - wl), hd = norm([a1[0] - a0[0], 0, a1[1] - a0[1]]), nx = -hd[2], ny = hd[0], hs = 3 + ww * 1.5;
  g.lineCap = 'round';
  [[0, 1], [gap, 0.65], [-gap, 0.65]].forEach(function (q) {
    var o0 = [a0[0] + nx * q[0], a0[1] + ny * q[0]], o1 = [o0[0] + (a1[0] - a0[0]) * q[1], o0[1] + (a1[1] - a0[1]) * q[1]];
    line(o0, o1, '#8fd3ff', ww);
  });
  g.beginPath(); g.moveTo(a1[0] - hd[0] * hs + nx * hs * 0.8, a1[1] - hd[2] * hs + ny * hs * 0.8); g.lineTo(a1[0], a1[1]); g.lineTo(a1[0] - hd[0] * hs - nx * hs * 0.8, a1[1] - hd[2] * hs - ny * hs * 0.8); g.stroke();
  g.lineCap = 'butt';
  // 其他船的方位（TASK-0537：全部畫，敵紅、友藍、沉了灰；一對一 ＝ 以前那一個紅點）
  SHIPS.forEach(function (o) {
    if (o === sh || !o.center || !sh.center) return;
    var e = norm([o.center[0] - sh.center[0], 0, o.center[2] - sh.center[2]]), pe = P(e, 0.86);
    g.fillStyle = o.sunk ? '#666' : isFoe(sh, o) ? '#ff6f6f' : '#6f9bff'; g.beginPath(); g.arc(pe[0], pe[1], 4.5, 0, 6.2832); g.fill();
  });
  // 我艦：從上面俯瞰的船（05_hull.js navImg，載入時算一次；船頭朝上、右舷在右 ⇒ 只轉不翻），船長（含艏斜桅）＝ 半徑的 1.575 倍（中心到兩端約 0.79 R，還在圈裡）
  //   （⛔ 0.8 倍 ⇒ 船長寬比約 6:1，在 150 px 的圈裡細成一條線；Tim 2026-10-13：1.05 倍再放大 1.5 倍）；外面一圈我方的顏色。沒有圖 ⇒ 以前的三角形
  var tc = teamIdx(sh) === 0 ? '#6f9bff' : '#ff6f6f', NI = sh.T.navImg;
  if (NI) {
    var tip = P(F, 1), sc = R * 1.575 / NI.height;
    g.save(); g.translate(cx, cy); g.rotate(Math.atan2(tip[1] - cy, tip[0] - cx) + Math.PI / 2); g.scale(sc, sc);
    g.shadowColor = tc; g.shadowBlur = 5; g.imageSmoothingEnabled = true; g.drawImage(NI, -sh.T.navU, -sh.T.navV);
    g.restore();
  } else {
    var S2 = norm([F[2], 0, -F[0]]), tip0 = P(F, 0.42), l = P(add(mul(F, -0.32), mul(S2, 0.12)), 1), r2 = P(add(mul(F, -0.32), mul(S2, -0.12)), 1);
    g.fillStyle = tc; g.beginPath(); g.moveTo(tip0[0], tip0[1]); g.lineTo(l[0], l[1]); g.lineTo(r2[0], r2[1]); g.closePath(); g.fill();
  }
  // 航速（TASK-0566）：從船頭往前延伸的白色箭頭，長 ＝ 節 ÷ 12 × 0.5 個半徑（最長到 1.32，圈外一點）；不到 0.3 節不畫
  var sk = Math.abs(sh.spd) * 1.944, FS = sh.spd < 0 ? mul(F, -1) : F;   // 倒車（31_sailing.js）⇒ 箭頭從船尾往後
  if (sk >= 0.3) {
    var s0 = P(FS, 0.8), s1 = P(FS, Math.min(1.32, 0.8 + sk / 12 * 0.5)), sd = norm([s1[0] - s0[0], 0, s1[1] - s0[1]]);
    g.lineCap = 'round'; line(s0, s1, '#ffffff', 2.5); g.lineCap = 'butt';
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(s1[0] + sd[0] * 5, s1[1] + sd[2] * 5); g.lineTo(s1[0] - sd[2] * 4, s1[1] + sd[0] * 4); g.lineTo(s1[0] + sd[2] * 4, s1[1] - sd[0] * 4); g.closePath(); g.fill();
  }
  // 轉向（Tim 2026-10-13：用圖示表現轉彎的方向與快慢，沿外圈畫）：從船頭的方向沿外圈畫到「照現在的轉向率，TURN_T 秒後船頭會在哪」，
  //   箭頭 ＝ 轉的方向，弧越長轉得越快（最多 120°）；幾乎直走（< 0.2°/秒）只畫船頭那一點。跟船頭在羅盤上用同一支 P(fwd(yaw)) ⇒ 弧的起點就是船頭指的方向。
  //   弧的起點往轉的那一側偏 TURN_OFF（Tim 2026-10-14：⛔ 從船頭正前方起畫 ⇒ 跟航速箭頭疊在一起）；船頭那一點只在停住（沒有航速箭頭）時畫。
  var yr = sh.yawRate || 0, span = clamp(yr * TURN_T, -2.094, 2.094), hp = P(F, 1.07);
  g.fillStyle = TURN_COL;
  if (sk < 0.3) { g.beginPath(); g.arc(hp[0], hp[1], 2.5, 0, 6.2832); g.fill(); }
  if (Math.abs(yr) > 0.0035) {
    var nT = Math.max(2, Math.ceil(Math.abs(span) / 0.05)), pt = [], a0T = sh.yaw + (span > 0 ? TURN_OFF : -TURN_OFF);
    for (var iT = 0; iT <= nT; iT++) pt.push(P(fwd(a0T + span * iT / nT), 1.07));
    g.strokeStyle = TURN_COL; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(pt[0][0], pt[0][1]);
    for (iT = 1; iT <= nT; iT++) g.lineTo(pt[iT][0], pt[iT][1]);
    g.stroke();
    var e1 = pt[nT], e0 = pt[nT - 1], tl = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]) || 1, tx = (e1[0] - e0[0]) / tl, ty = (e1[1] - e0[1]) / tl;   // 箭頭：沿弧的切線
    g.beginPath(); g.moveTo(e1[0] + tx * 6, e1[1] + ty * 6); g.lineTo(e1[0] - ty * 4.5, e1[1] + tx * 4.5); g.lineTo(e1[0] + ty * 4.5, e1[1] - tx * 4.5); g.closePath(); g.fill();
  }
  // 文字搬進詳細資訊（navText，TASK-0566：羅盤電腦版跟手機版一樣只剩圓盤）
}
/** 羅盤以前底下那幾行（TASK-0566 搬進詳細資訊的左欄）：航向與轉向、風（從哪吹來、節、相對位置、失速）、傾斜與縱傾。照那一艘自己的（不只我艦）。 */
function navText(sh) {
  var F = fwd(sh.yaw), Wd = norm(WIND), hb = bearing(F[0], F[2]), wb = bearing(-Wd[0], -Wd[2]), yr = sh.yawRate || 0;
  var roll = (sh.rollA + (sh.rollW || 0)) * 57.2958, pitch = (sh.pitchA + (sh.pitchW || 0)) * 57.2958;
  return '航向 ' + deg3(hb) + '（' + compassName(hb) + '）' + (Math.abs(yr) > 0.0035 ? '　<span style="color:' + TURN_COL + '">' + (yr > 0 ? '左' : '右') + '轉 ' + (Math.abs(yr) * 57.2958).toFixed(1) + '°/秒</span>' : '') + '<br>' +   // yawRate 正 ＝ 畫面上左轉（31_sailing.js fwd）
    '<span style="color:#8fd3ff">風 從 ' + deg3(wb) + '（' + compassName(wb) + '）' + windKnots().toFixed(0) + ' 節</span>' + (sh.irons > 0.05 ? '　<b style="color:#ff9a7a">失速' + (sh.irons < 0.95 ? ' ' + Math.round(sh.irons * 100) + '%' : '') + '</b>' : '') + '<br>' +
    '傾斜 ' + Math.abs(roll).toFixed(1) + '°' + (Math.abs(roll) < 0.2 ? '' : roll < 0 ? '（左低）' : '（右低）') + '　縱傾 ' + pitch.toFixed(1) + '°';
}
/** P 那顆按鈕：停格中寫「繼續」、平常寫「停格」（Tim 2026-10-14）。 */
function pauseLabel() { var b = $('pauseK'), s = '<b>P</b> ' + (PAUSED ? '繼續' : '停格'); if (b && b.innerHTML !== s) b.innerHTML = s; }
function hud(dt) {
  stepMsgs(dt);
  if (ROOMS_DBG) roomLabels();                                                   // 空艙房的名字（36_rooms.js；?rooms=1）：每一格跟著鏡頭
  if (!SHIPS.length || (HUDN++ % 6)) return;
  var me = SHIPS[PLAYER_I];
  fleetHud(me);                                                                  // 上方：每艘一個圓形按鈕＋中間一艘的詳細資訊（TASK-0552）
  gunHud(me);                                                                   // 我艦的砲：兩舷貼左右兩邊、追擊砲與射界外警告在下方面板
  botFit();
  pauseLabel();
  [].forEach.call(document.querySelectorAll('#ammo span'), function (s) { s.className = +s.dataset.a === AMMO_I ? 'on' : ''; });
  // 瞄準模式＋鏡頭名稱：羅盤底下一行空心字（Tim 2026-10-14；Q 那顆按鈕只寫「瞄準」）；鏡頭名稱要常駐（Tim：拿掉之後看不出現在是哪個鏡頭）
  var cn = CAM.mode === 3 && CAM.see && SHIPS.indexOf(CAM.see) >= 0 ? '看' + CAM.see.name : CAM_NAMES[CAM.mode];   // 「🎥 看這艘」⇒ 寫那一艘的名字
  var mt = $('modeT'), ms = '瞄準 <b>' + (!handAim(me) ? '砲長' : (AUTOFIRE ? '手動一舷・' : '') + AIM_NAME[me.pMode || 'free']) + '</b>　鏡頭 <b>' + cn + '</b>';
  if (mt && mt.innerHTML !== ms) mt.innerHTML = ms;
  var t = DEBUG ? '格：' + SHIPS.map(function (s) { return s.grid.count; }).join('／') + '　四邊形：' + SHIPS.map(function (s) { return s.rs.quads(); }).join('／') + '　碎片 ' + D.n + '　粒子 ' + PT.n + '　脫落 ' + PIECES.length + (PHYS ? '　物理 ' + PHYS_MS.toFixed(2) + ' ms/步、垂繩 ' + SHIPS.map(function (s) { return s.loose.length; }).join('／') : '') + '　' + FPS.toFixed(0) + ' fps' : '';
  $('tip').textContent = t;
  drawNav(me);
}
// 結算畫面照模擬時間延後跳（暫停時不會跳出來；殉爆的慢動作中跟著變慢）（Tim：先看完精彩畫面 —— 殉爆的火球、斷成兩截）：
//   輸的那艘已經沉了 ⇒ 再等 END_SINK 秒；已經開始沉（殉爆斷船、進水太多）⇒ 等它沉下去（sunk）再等 END_SINK 秒，最多等 END_MAX 秒（END_WAIT）；
//   降旗、全員倒下（沒在沉）⇒ END_OTHER 秒。Tim 2026-10-13：讓玩家欣賞完沉船 ⇒ 沉了 2.5 → 5 秒、開始沉的等它沉下去（以前一律 5.5 秒，斷船的那艘沉到一半就被結算蓋住）。
//   只管什麼時候亮出結算畫面：OVER、結算的文字照舊在分出勝負那一步定 ⇒ 戰局讀數不變。
var END_AT = 0, END_SINK = 5, END_OTHER = 5.5, END_MAX = 40, END_WAIT = null;
function checkEnd() {
  if (MODE === 'sandbox' || DEMO >= 0) return;
  if (OVER) {
    if (END_WAIT && (END_WAIT.sunk || SIMT >= END_AT)) { END_AT = Math.min(END_AT, SIMT + END_SINK); END_WAIT = null; }
    if (END_AT && !END_WAIT && SIMT >= END_AT) { END_AT = 0; $('end').className = 'on'; }
    return;
  }
  // 照陣營（TASK-0537）：敵方每艘都沉了或降旗 ⇒ 勝；我方每艘都是 ⇒ 敗。一對一 ⇒ 跟以前同一句、同一個判定順序。
  var me = SHIPS[PLAYER_I], mt = playerTeam(), ft = foeTeam(), mine = teamShips(mt), foes = teamShips(ft), txt = null, lose = null;
  function fate(sh) { return sh.sunk ? '沉沒' : sh.fate; }
  function who(L, one) { return L.length === 1 ? one + fate(L[0]) : one.replace('艦', '方') + ' ' + L.length + ' 艘全數' + (L.every(function (o) { return o.sunk; }) ? '沉沒' : '沉沒或降旗'); }
  if (foes.length && teamDown(ft)) { txt = '勝利！' + who(foes, '敵艦'); lose = foes; }
  else if (me.selfD) txt = '自爆！我艦引爆了彈藥庫';                      // 自爆（23_powder.js selfDestruct）：第一間炸的那一刻就結算（文字不等最後那間）
  else if (teamDown(mt)) { txt = '敗北……' + who(mine, '我艦'); lose = mine; }
  if (!txt) return;
  OVER = true;
  function sum(L, k) { return L.reduce(function (a, o) { return a + o[k]; }, 0); }
  $('endT').textContent = txt;
  $('endS').innerHTML = '打掉的格數：我' + (mine.length > 1 ? '方 ' : '艦 ') + sum(mine, 'lost').toLocaleString() + '　敵' + (foes.length > 1 ? '方 ' : '艦 ') + sum(foes, 'lost').toLocaleString() + '<br>開火／命中：' + me.fired + '／' + me.hits + '　經過 ' + SIMT.toFixed(0) + ' 秒' +
    '<br><span style="color:var(--dim)">' + strikeText() + '</span>';
  lose = lose || mine;                                              // 重開／回選單時 END_AT、END_WAIT 歸零（⛔ 不歸零 ⇒ 結束後幾秒內按重新開始，新的一局會跳出結算）
  var sinking = lose.filter(function (o) { return o.sinkingFinal && !o.sunk; })[0];   // 輸的那邊還有在沉的 ⇒ 等它沉下去
  if (sinking) { END_WAIT = sinking; END_AT = SIMT + END_MAX; }
  else if (lose.some(function (o) { return o.sunk; })) END_AT = SIMT + END_SINK;
  else END_AT = SIMT + END_OTHER;
}

