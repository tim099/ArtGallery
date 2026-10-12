// ───────────────────────── 輸入 ─────────────────────────
var drag = null, PTRS = new Map(), PINCH = null;          // PTRS：按著的指頭（觸控）；兩指 ⇒ 縮放（PINCH），不轉鏡頭也不瞄準
function pinchD() { var a = Array.from(PTRS.values()); return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1; }
cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
cv.addEventListener('pointerdown', function (e) {
  cv.setPointerCapture(e.pointerId); PTRS.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (PTRS.size === 2) { PINCH = { d: pinchD(), dist: CAM.dist }; drag = null; return; }
  if (PTRS.size > 2) return;
  drag = { x: e.clientX, y: e.clientY, b: e.button, moved: false };
});
cv.addEventListener('pointermove', function (e) {
  if (PTRS.has(e.pointerId)) PTRS.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (PINCH && PTRS.size === 2) { CAM.dist = clamp(PINCH.dist * PINCH.d / pinchD(), 12, 900); return; }
  if (!drag) return;
  var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 5) return;
  drag.moved = true; drag.x = e.clientX; drag.y = e.clientY;
  if (CAM.mode === 1) CAM.mode = 0;
  if (drag.b === 2) {
    if (CAM.mode > 1) CAM.tgt = CAM.look.slice();                 // 從跟著船的鏡頭換成自由鏡頭：從現在看的那一點開始平移
    var fw = norm([CAM.look[0] - CAM.eye[0], 0, CAM.look[2] - CAM.eye[2]]), rt = [-fw[2], 0, fw[0]], k = CAM.dist * 0.0018;
    CAM.tgt = add(CAM.tgt, add(mul(rt, -dx * k), mul(fw, dy * k))); if (CAM.mode > 1) CAM.mode = 0;
  } else { if (CAM.mode === 4) CAM.aoff += dx * 0.006; else CAM.yaw += dx * 0.006; CAM.pitch = clamp(CAM.pitch + dy * 0.005, 0.02, 1.45); }
});
function ptrEnd(e) { PTRS.delete(e.pointerId); if (PTRS.size < 2) PINCH = null; }
cv.addEventListener('pointerup', function (e) {
  if (drag && !drag.moved && drag.b === 0 && RUNNING && !PINCH) pick(e.clientX, e.clientY);
  drag = null; ptrEnd(e);
});
cv.addEventListener('pointercancel', function (e) { drag = null; ptrEnd(e); });
cv.addEventListener('wheel', function (e) { e.preventDefault(); CAM.dist = clamp(CAM.dist * Math.pow(1.0015, e.deltaY), 12, 900); }, { passive: false });
function pick(cx, cy) {
  var r = cv.getBoundingClientRect(), nx = (cx - r.left) / r.width * 2 - 1, ny = 1 - (cy - r.top) / r.height * 2;
  var a = M4.pt(CAM.inv, nx, ny, -1), bq = CAM.inv, w0 = bq[3] * nx + bq[7] * ny + bq[11] * -1 + bq[15], w1 = bq[3] * nx + bq[7] * ny + bq[11] + bq[15];
  var p0 = mul(M4.pt(CAM.inv, nx, ny, -1), 1 / w0), p1 = mul(M4.pt(CAM.inv, nx, ny, 1), 1 / w1), d = norm(sub(p1, p0));
  var foe = SHIPS[1 - PLAYER_I], oL = toLocal(foe, p0), dL = M4.dir(foe.inv, d[0], d[1], d[2]);
  var hit = VK.raycast(foe.grid, oL, dL, 3000);
  if (hit) { SHIPS[PLAYER_I].aim = [hit.x + 0.5, hit.y + 0.5, hit.z + 0.5]; SHIPS[PLAYER_I].pMode = AIM_P = 'free'; sfx('crack', null, 0.08); }   // 點了 ⇒ 瞄準模式回到自由
}
window.addEventListener('keydown', function (e) {
  if (!RUNNING) return;
  var k = e.key.toLowerCase(); if (e.code === 'Space') k = ' ';
  if (k === ' ' || k === 'tab' || k === 'a' || k === 'd' || k === 'w' || k === 's' || k.indexOf('arrow') === 0) e.preventDefault();
  doKey(k, e.repeat);
});
/** 一個鍵的動作（鍵盤與畫面上的按鈕共用 ⇒ 手機也能玩）。打舵（A／D）是「按住」：這裡只按下，放開走 keyUp。 */
function doKey(k, repeat) {
  if (!RUNNING) return;
  var me = SHIPS[PLAYER_I];
  if (k === ' ') { if (!PAUSED && !me.sunk) broadside(me, AMMO_I); }   // 降旗了 ⇒ broadside／fireOne 自己擋
  else if (k === 'f') { if (!PAUSED) fireOne(me, AMMO_I); }
  else if (k === '1' || k === '2' || k === '3') AMMO_I = +k - 1;
  else if (k === 'q') { me.pMode = AIM_P = AIM_CYCLE[(AIM_CYCLE.indexOf(me.pMode || 'free') + 1) % AIM_CYCLE.length]; note(me, '瞄準：' + AIM_NAME[me.pMode] + (me.pMode === 'free' ? '（點敵艦設瞄準點）' : '')); }   // 瞄準模式（51_captain.js）
  else if (k === 'c') { CAM.mode = CAM_ORDER[(CAM_ORDER.indexOf(CAM.mode) + 1) % CAM_ORDER.length]; CAM.follow = null; if (CAM.mode === 2 || CAM.mode === 3) { CAM.dist = 75; } else if (CAM.mode === 0) CAM.dist = DIST + 40; else if (CAM.mode === 4) { CAM.dist = 78; CAM.aoff = 0.35; } }
  else if (k === 'p') PAUSED = !PAUSED;
  else if (k === 'm') { muted = !muted; }
  else if (k === 'h' || k === '?') $('help').classList.toggle('on');
  else if (k === 'r') { RUNNING = false; END_AT = 0; $('cover').style.display = ''; $('end').className = ''; $('help').classList.remove('on'); }
  else if (k === 'tab') {                                           // 航行：自動 → 手動 → 停船 → 自動（觀戰沒有手動）
    var order = ['auto', 'manual', 'off'];
    setSailMode(order[(order.indexOf(SAIL) + 1) % order.length]);
  }
  else if (k === 'a' || k === 'd' || k === 'arrowleft' || k === 'arrowright') {   // 打舵：自動或停船中一碰就換手動
    if (SAIL !== 'manual') setSailMode('manual'); KEYS[k === 'a' || k === 'arrowleft' ? 'l' : 'r'] = true;
  }
  else if (k === 'v') setCamTrack(!CAM.track);
  else if (k === 'g') setAutoFire(!AUTOFIRE);
  else if (k === 'b') setPhys(!PHYS);
  else if (k === 'n') start();                                        // 重新開始：同樣的模式、距離、滑桿，不用打完
  else if (k === 'w' || k === 's' || k === 'arrowup' || k === 'arrowdown') {     // 帆裝
    if (!repeat) setSails(me, me.sailSet + (k === 'w' || k === 'arrowup' ? 1 : -1));
  }
}
function keyUp(k) { if (k === 'a' || k === 'arrowleft') KEYS.l = false; if (k === 'd' || k === 'arrowright') KEYS.r = false; }
window.addEventListener('keyup', function (e) { keyUp(e.key.toLowerCase()); });
window.addEventListener('blur', function () { KEYS.l = KEYS.r = false; });
// 畫面上的按鍵提示（下方控制列 .kb、說明裡的 kbd[data-k]）：點 ＝ 按那個鍵；data-hold 的（打舵）按住才算
[].forEach.call(document.querySelectorAll('[data-k]'), function (b) {
  var k = b.dataset.k;
  if (b.dataset.hold) {
    b.addEventListener('pointerdown', function (e) { e.preventDefault(); b.classList.add('down'); doKey(k, false); try { b.setPointerCapture(e.pointerId); } catch (x) { } });   // 手指滑出按鈕也算按著，放開才鬆舵
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { b.addEventListener(ev, function () { b.classList.remove('down'); keyUp(k); }); });
  } else b.addEventListener('click', function (e) { e.preventDefault(); doKey(k, false); });
});
/** 航行模式（選單與遊戲中同一個）：auto 兩艘自動、manual 我艦手動、off 兩艘停船。 */
var SAIL_NAMES = { auto: '自動航行', manual: '手動操舵（A／D 打舵）', off: '停船' };
function setSailMode(m) {
  SAIL = m; KEYS.l = KEYS.r = false;
  [].forEach.call(document.querySelectorAll('[data-s]'), function (x) { x.classList.toggle('on', x.dataset.s === SAIL); });
  if (RUNNING && SHIPS.length) note(SHIPS[PLAYER_I], SAIL_NAMES[m] + '（Tab 切換）');
}
/** 自由鏡頭跟不跟著兩艘的中點走（預設跟；鏡頭「看敵艦／看我艦」本來就跟著那一艘）。 */
function setCamTrack(on) {
  CAM.track = on; CAM.trMe = CAM.trYaw = null;
  $('camT').classList.toggle('on', on);
  if (RUNNING && SHIPS.length) note(SHIPS[PLAYER_I], on ? '鏡頭跟著船' : '鏡頭固定（V 切換）');
}
/** 自動開砲（我艦）：觀戰預設開、其他模式預設關（reset 時照模式設）。 */
function setAutoFire(on) {
  AUTOFIRE = on; $('autoF').classList.toggle('on', on);
  if (RUNNING && SHIPS.length) note(SHIPS[PLAYER_I], on ? '自動開砲' : '自己開砲（點敵艦瞄準、空白鍵齊射）');
}
[].forEach.call(document.querySelectorAll('#hudctl [data-s]'), function (b) { b.onclick = function () { setSailMode(b.dataset.s); }; });
$('autoF').onclick = function () { setAutoFire(!AUTOFIRE); };
$('camT').onclick = function () { setCamTrack(!CAM.track); };
$('physT').onclick = function () { setPhys(!PHYS); };
$('restartB').onclick = function () { if (RUNNING) start(); };
$('endA').onclick = start;
$('phys').onchange = function () { setPhys($('phys').checked); };
[].forEach.call(document.querySelectorAll('#ammo span'), function (s) { s.onclick = function () { AMMO_I = +s.dataset.a; }; });
[].forEach.call(document.querySelectorAll('#modes button'), function (b) { b.onclick = function () { MODE = b.dataset.m; [].forEach.call(document.querySelectorAll('#modes button'), function (x) { x.className = x === b ? 'on' : ''; }); }; });
/** 選單：滑桿的上下限從 LIM 來；數值只在使用者動了那一條時才從滑桿讀回（⛔ 一開頭就讀回 ⇒ 網址給的 0.33 被 step 吃成 0.35）。
 *  船殼、砲、帆、火藥桶、航行、降旗的滑桿在「細節設定」那一頁（從主選單進）；主選單只留一行摘要（#detV）。 */
/** 模型（砲、火藥桶）的總重（噸）：照匯出的模型清單＋取用點的 12 桶（細節設定的例子用；開戰時每艘照自己的模型算）。 */
function modelMassT(T) { if (!T) return 0; var t = 12 * KEG_T; (T.rig.models || []).forEach(function (m) { t += modelT({ kind: modelKind(m) }); }); return t; }
var SLIDERS_SHOW = null;                               // 載入完（HYD 算好）再顯示一次 ⇒ 減重上浮的例子有數字
function sliders() {
  var lf = $('ballast'), f = $('flood'), h = $('hard'), c = $('cas'), sp = $('speed'), ag = $('agile'), gh = $('gunhp'), gw = $('gunw'), sl = $('sailhp'), ph = $('powderhp'), bl = $('blast'), ch = $('crewhp');
  var dm = { long: $('dmg24'), carr: $('dmg32'), chase: $('dmg18') }, DLIM = { long: LIM.dmg24, carr: LIM.dmg32, chase: LIM.dmg18 }, bx = $('box'), cy = $('carry'), wk = $('wind');
  bx.min = LIM.box[0]; bx.max = LIM.box[1]; cy.min = LIM.carry[0]; cy.max = LIM.carry[1]; wk.min = LIM.wind[0]; wk.max = LIM.wind[1];
  // 硬度跨 40 倍 ⇒ 對數刻度：滑桿 0..1 ↔ 硬度 LIM 下限 × (上限／下限)^v
  var hk = Math.log(LIM.hard[1] / LIM.hard[0]);
  lf.min = LIM.ballast[0]; lf.max = LIM.ballast[1]; gw.min = LIM.gunw[0]; gw.max = LIM.gunw[1];
  f.min = LIM.flood[0]; f.max = LIM.flood[1]; h.min = 0; h.max = 1; h.step = 0.005; c.min = LIM.cas[0] * 100; c.max = LIM.cas[1] * 100;
  sp.min = LIM.speed[0]; sp.max = LIM.speed[1]; ag.min = LIM.agile[0]; ag.max = LIM.agile[1];
  gh.min = LIM.gunhp[0]; gh.max = LIM.gunhp[1]; sl.min = LIM.sailhp[0]; sl.max = LIM.sailhp[1]; ph.min = LIM.powderhp[0]; ph.max = LIM.powderhp[1];
  bl.min = LIM.blast[0]; bl.max = LIM.blast[1]; ch.min = LIM.crewhp[0]; ch.max = LIM.crewhp[1];
  for (var t in dm) { dm[t].min = DLIM[t][0]; dm[t].max = DLIM[t][1]; }
  function am(r, k) { return $('am-' + r + '-' + k); }
  function put() {                                     // 變數 ⇒ 滑桿位置（開頭、重設預設值時）
    lf.value = BALLAST_T; f.value = FLOOD; h.value = Math.log(HARDK / LIM.hard[0]) / hk; c.value = STRIKE.cas * 100; sp.value = SPEEDK; ag.value = AGILK;
    gh.value = GUN_HP; gw.value = GUNW_K; sl.value = SAIL_HP; ph.value = POWDER_HP; bl.value = BLAST_K; ch.value = CREW_HP;
    for (var t in dm) dm[t].value = DMG[t];
    bx.value = BOX_N; cy.value = CARRY_N; wk.value = WIND_K;
    for (var r = 0; r < 3; r++) for (var k = 0; k < 3; k++) am(r, k).value = AMMO_K[r][k];
    ['guns', 'masts', 'officers'].forEach(function (k) { $('st-' + k).checked = STRIKE[k]; });
    [0, 1].forEach(function (i) { $('cap' + i).value = CAP_SET[i]; });
  }
  function show() {
    $('speedV').textContent = SPEEDK.toFixed(2) + '×（最快約 ' + (VMAX * SPEEDK * 1.944).toFixed(0) + ' 節）';
    $('agileV').textContent = AGILK.toFixed(2) + '×（滿帆側風約 ' + ((0.012 + 0.016 * VMAX * 0.92) * AGILK * 57.3).toFixed(1) + '°/秒）';
    $('floodV').textContent = FLOOD === 0 ? '0×（不會沉）' : FLOOD.toFixed(2) + '×' + (FLOOD < 0.5 ? '（慢）' : FLOOD < 1.2 ? '' : '（快）');
    var HT = HULLT[SHIP_SET[0]], m0 = (HT ? HT.base.count * VOX_T : 0) + modelMassT(HT) + BALLAST_T, l0 = liftFor(HT, HT ? HT.disp - m0 : 0), lx = liftFor(HT, HT ? HT.disp - m0 + 70 : 0);   // 照我艦的船型   // 開戰時浮在哪；例子：再打掉 10 萬格（70 噸）
    var gm = 0; if (HT) (HT.rig.models || []).forEach(function (m) { var k = modelKind(m); if (GUN_T[k]) gm += GUN_T[k] * GUNW_K; });
    $('gunwV').textContent = GUNW_K.toFixed(2) + '×（長砲 ' + (2.5 * GUNW_K).toFixed(1) + ' 噸、carronade ' + (0.9 * GUNW_K).toFixed(1) + '、追擊砲 ' + (2.1 * GUNW_K).toFixed(1) + (gm ? '；全部 ' + Math.round(gm) + ' 噸' : '') + '）';
    $('ballastV').textContent = BALLAST_T + ' 噸' + (l0 === null ? '' : '（' + HT.name + ' ' + Math.round(m0).toLocaleString() + ' 噸 ⇒ ' + (Math.abs(l0) < 0.05 ? '剛好在設計水線' : l0 > 0 ? '浮高 ' + l0.toFixed(1) + ' m' : '吃水深 ' + (-l0).toFixed(1) + ' m') + '；打掉 10 萬格再浮 ' + (lx - l0).toFixed(2) + ' m）');
    $('hardV').textContent = HARDK.toFixed(1) + '×' + (HARDK < 1 ? '（容易打穿）' : HARDK > 10 ? '（幾乎打不穿）' : HARDK > 3 ? '（很難打穿）' : '');
    function shots(hp, dmg) { return dmg > 0 ? Math.ceil(hp / dmg - 1e-9) : '∞'; }
    $('gunhpV').textContent = GUN_HP + '（24 磅實心 ' + shots(GUN_HP, DMG.long * ammoK(0, VS_GUN)) + ' 發、舵輪 ' + Math.round(GUN_HP * 0.6) + '）';
    $('sailhpV').textContent = SAIL_HP + '（24 磅鏈彈 ' + shots(SAIL_HP, DMG.long * ammoK(2, VS_SAIL)) + ' 發）';
    $('crewhpV').textContent = CREW_HP + (CREW_HP === LIM.crewhp[2] ? '' : CREW_HP > LIM.crewhp[2] ? '（耐打）' : '（脆）');
    $('powderhpV').textContent = powderNever() ? '拉滿（不會爆）' : POWDER_HP + (POWDER_HP >= 600 ? '（很難殉爆，' : POWDER_HP >= 350 ? '（偶爾殉爆，' : '（很容易殉爆，') + '藥包 ' + Math.round(POWDER_HP * CART_K) + '）';
    $('blastV').textContent = BLAST_K.toFixed(2) + '×（前彈藥庫半徑約 ' + (MAG_R * Math.pow(BLAST_K, 1 / 3) * (S || 0.1)).toFixed(1) + ' m）';
    $('boxV').textContent = BOX_N + ' 份（開戰時裝滿）';
    $('windV').textContent = WIND_K.toFixed(2) + '×（帆上的風約 ' + (WIND_SAIL * WIND_K).toFixed(0) + ' m/s，陣風 ±' + Math.round(GUST[0] * 100) + '%）';
    $('carryV').textContent = CARRY_N + ' 份' + (CARRY_N > BOX_N ? '（比藥箱多 ⇒ 一趟送好幾門）' : '');
    $('dmg24V').textContent = DMG.long; $('dmg32V').textContent = DMG.carr; $('dmg18V').textContent = DMG.chase;
    $('casV').textContent = STRIKE.cas >= 1 ? '100%（全員倒下才停）' : Math.round(STRIKE.cas * 100) + '%';
    $('strikeV').textContent = strikeText();
    var amDef = AMMO_K.every(function (r, i) { return r.every(function (v, j) { return v === AMMO_K0[i][j]; }); });
    $('detV').textContent = '船殼硬度 ' + HARDK.toFixed(1) + '×・進水 ' + FLOOD.toFixed(2) + '×・壓艙物 ' + BALLAST_T + ' 噸・砲重 ' + GUNW_K.toFixed(2) + '×・血量 砲 ' + GUN_HP + '／帆 ' + SAIL_HP + '／船員 ' + CREW_HP +
      '・傷害 ' + DMG.long + '／' + DMG.carr + '／' + DMG.chase + (amDef ? '' : '・彈種倍率已改') + '・藥箱 ' + BOX_N + '、一次搬 ' + CARRY_N +
      '・火藥桶 ' + (powderNever() ? '不會爆' : '血量 ' + POWDER_HP + '、殉爆 ' + BLAST_K.toFixed(2) + '×') + '・航速 ' + SPEEDK.toFixed(2) + '×・靈活 ' + AGILK.toFixed(2) + '×・砲長 ' + CAP_SET.map(function (k) { return CAPTAINS[k] ? CAPTAINS[k].name : '隨機'; }).join('／') + '・' + strikeText();
  }
  lf.oninput = function () { BALLAST_T = Math.round(+lf.value); show(); };
  f.oninput = function () { FLOOD = +f.value; show(); };
  sp.oninput = function () { SPEEDK = +sp.value; show(); };
  ag.oninput = function () { AGILK = +ag.value; show(); };
  h.oninput = function () { HARDK = Math.round(LIM.hard[0] * Math.exp(h.value * hk) * 10) / 10; show(); };
  c.oninput = function () { STRIKE.cas = c.value / 100; show(); };
  gh.oninput = function () { GUN_HP = Math.round(+gh.value); show(); };
  gw.oninput = function () { GUNW_K = +gw.value; show(); };
  sl.oninput = function () { SAIL_HP = Math.round(+sl.value); show(); };
  ph.oninput = function () { POWDER_HP = Math.round(+ph.value); show(); };
  bl.oninput = function () { BLAST_K = +bl.value; show(); };
  ch.oninput = function () { CREW_HP = Math.round(+ch.value); show(); };
  bx.oninput = function () { BOX_N = Math.round(+bx.value); show(); };
  cy.oninput = function () { CARRY_N = Math.round(+cy.value); show(); };
  wk.oninput = function () { WIND_K = +wk.value; show(); };          // 物理是每一步讀 ⇒ 遊戲中也能調（只管畫面）
  Object.keys(dm).forEach(function (t) { dm[t].oninput = function () { DMG[t] = Math.round(+dm[t].value); show(); }; });
  for (var r = 0; r < 3; r++) for (var k = 0; k < 3; k++) (function (r, k) {
    var el = am(r, k);
    el.oninput = function () { var v = parseFloat(el.value); if (isFinite(v)) { AMMO_K[r][k] = clamp(Math.round(v), AMMO_LIM[0], AMMO_LIM[1]); show(); } };
    el.onchange = function () { el.value = AMMO_K[r][k]; };          // 打了界外或空白 ⇒ 回到夾過的值
  })(r, k);
  ['guns', 'masts', 'officers'].forEach(function (k) { var b = $('st-' + k); b.onchange = function () { STRIKE[k] = b.checked; show(); }; });
  [0, 1].forEach(function (i) { var s = $('cap' + i); capOptions(s, CAP_SET[i]); s.onchange = function () { CAP_SET[i] = s.value; show(); }; });   // 砲長
  // 細節設定那一頁：主選單 ⇄ 細節設定（同一個 #cover 裡兩張卡片，一次顯示一張）
  function page(det) { $('detail').style.display = det ? '' : 'none'; document.querySelector('#cover .card:not(#detail)').style.display = det ? 'none' : ''; $('cover').scrollTop = 0; }
  $('detB').onclick = function () { page(true); };
  $('detX').onclick = function () { page(false); };
  $('detR').onclick = function () {                    // 重設預設值：LIM 的第三格、降旗全不勾
    FLOOD = LIM.flood[2]; BALLAST_T = LIM.ballast[2]; HARDK = LIM.hard[2]; SPEEDK = LIM.speed[2]; AGILK = LIM.agile[2];
    GUN_HP = LIM.gunhp[2]; GUNW_K = LIM.gunw[2]; SAIL_HP = LIM.sailhp[2]; POWDER_HP = LIM.powderhp[2]; BLAST_K = LIM.blast[2]; CREW_HP = LIM.crewhp[2];
    DMG.long = LIM.dmg24[2]; DMG.carr = LIM.dmg32[2]; DMG.chase = LIM.dmg18[2]; BOX_N = LIM.box[2]; CARRY_N = LIM.carry[2]; WIND_K = LIM.wind[2];
    AMMO_K = AMMO_K0.map(function (r) { return r.slice(); });
    STRIKE.cas = LIM.cas[2]; STRIKE.guns = STRIKE.masts = STRIKE.officers = false; CAP_SET = ['random', 'random'];
    put(); show();
  };
  window.addEventListener('keydown', function (e) { if (!RUNNING && e.key === 'Escape' && $('detail').style.display !== 'none') page(false); });
  put(); show(); SLIDERS_SHOW = show;
}
sliders();
[].forEach.call(document.querySelectorAll('#dists button'), function (b) { b.onclick = function () { DIST = +b.dataset.d; [].forEach.call(document.querySelectorAll('#dists button'), function (x) { x.className = x === b ? 'on' : ''; }); }; });
[].forEach.call(document.querySelectorAll('#sails button'), function (b) { b.onclick = function () { setSailMode(b.dataset.s); }; });
setSailMode(SAIL); setCamTrack(true); $('physT').classList.toggle('on', PHYS); $('phys').checked = PHYS;
$('go').onclick = start;
$('endC').onclick = function () { $('end').className = ''; };
$('endR').onclick = function () { RUNNING = false; $('end').className = ''; $('cover').style.display = ''; };

