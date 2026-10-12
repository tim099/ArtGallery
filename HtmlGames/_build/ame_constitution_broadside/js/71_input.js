// ───────────────────────── 輸入 ─────────────────────────
var drag = null;
cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
cv.addEventListener('pointerdown', function (e) { cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, b: e.button, moved: false }; });
cv.addEventListener('pointermove', function (e) {
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
cv.addEventListener('pointerup', function (e) {
  if (drag && !drag.moved && drag.b === 0 && RUNNING) pick(e.clientX, e.clientY);
  drag = null;
});
cv.addEventListener('wheel', function (e) { e.preventDefault(); CAM.dist = clamp(CAM.dist * Math.pow(1.0015, e.deltaY), 12, 900); }, { passive: false });
function pick(cx, cy) {
  var r = cv.getBoundingClientRect(), nx = (cx - r.left) / r.width * 2 - 1, ny = 1 - (cy - r.top) / r.height * 2;
  var a = M4.pt(CAM.inv, nx, ny, -1), bq = CAM.inv, w0 = bq[3] * nx + bq[7] * ny + bq[11] * -1 + bq[15], w1 = bq[3] * nx + bq[7] * ny + bq[11] + bq[15];
  var p0 = mul(M4.pt(CAM.inv, nx, ny, -1), 1 / w0), p1 = mul(M4.pt(CAM.inv, nx, ny, 1), 1 / w1), d = norm(sub(p1, p0));
  var foe = SHIPS[1 - PLAYER_I], oL = toLocal(foe, p0), dL = M4.dir(foe.inv, d[0], d[1], d[2]);
  var hit = VK.raycast(foe.grid, oL, dL, 3000);
  if (hit) { SHIPS[PLAYER_I].aim = [hit.x + 0.5, hit.y + 0.5, hit.z + 0.5]; sfx('crack', null, 0.08); }
}
window.addEventListener('keydown', function (e) {
  if (!RUNNING) return;
  var me = SHIPS[PLAYER_I], k = e.key.toLowerCase();
  if (k === ' ' || e.code === 'Space') { e.preventDefault(); if (!PAUSED && !me.sunk) broadside(me, AMMO_I); }   // 降旗了 ⇒ broadside／fireOne 自己擋
  else if (k === 'f') { if (!PAUSED) fireOne(me, AMMO_I); }
  else if (k === '1' || k === '2' || k === '3') AMMO_I = +k - 1;
  else if (k === 'c') { CAM.mode = CAM_ORDER[(CAM_ORDER.indexOf(CAM.mode) + 1) % CAM_ORDER.length]; CAM.follow = null; if (CAM.mode === 2 || CAM.mode === 3) { CAM.dist = 75; } else if (CAM.mode === 0) CAM.dist = DIST + 40; else if (CAM.mode === 4) { CAM.dist = 78; CAM.aoff = 0.35; } }
  else if (k === 'p') PAUSED = !PAUSED;
  else if (k === 'm') { muted = !muted; }
  else if (k === 'h' || k === '?') $('help').classList.toggle('on');
  else if (k === 'r') { RUNNING = false; $('cover').style.display = ''; $('end').className = ''; }
  else if (k === 'tab') {                                           // 航行：自動 → 手動 → 停船 → 自動（觀戰沒有手動）
    e.preventDefault();
    var order = ['auto', 'manual', 'off'];
    setSailMode(order[(order.indexOf(SAIL) + 1) % order.length]);
  }
  else if (k === 'a' || k === 'd' || k === 'arrowleft' || k === 'arrowright') {   // 打舵：自動或停船中一碰就換手動
    e.preventDefault();
    if (SAIL !== 'manual') setSailMode('manual'); KEYS[k === 'a' || k === 'arrowleft' ? 'l' : 'r'] = true;
  }
  else if (k === 'v') setCamTrack(!CAM.track);
  else if (k === 'g') setAutoFire(!AUTOFIRE);
  else if (k === 'b') setPhys(!PHYS);
  else if (k === 'n') start();                                        // 重新開始：同樣的模式、距離、滑桿，不用打完
  else if (k === 'w' || k === 's' || k === 'arrowup' || k === 'arrowdown') {     // 帆裝
    e.preventDefault();
    if (!e.repeat) setSails(me, me.sailSet + (k === 'w' || k === 'arrowup' ? 1 : -1));
  }
});
window.addEventListener('keyup', function (e) { var k = e.key.toLowerCase(); if (k === 'a' || k === 'arrowleft') KEYS.l = false; if (k === 'd' || k === 'arrowright') KEYS.r = false; });
window.addEventListener('blur', function () { KEYS.l = KEYS.r = false; });
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
/** 選單：滑桿的上下限從 LIM 來；數值只在使用者動了那一條時才從滑桿讀回（⛔ 一開頭就讀回 ⇒ 網址給的 0.33 被 step 吃成 0.35）。 */
function sliders() {
  var f = $('flood'), h = $('hard'), c = $('cas'), sp = $('speed'), ag = $('agile');
  // 硬度跨 40 倍 ⇒ 對數刻度：滑桿 0..1 ↔ 硬度 LIM 下限 × (上限／下限)^v
  var hk = Math.log(LIM.hard[1] / LIM.hard[0]);
  f.min = LIM.flood[0]; f.max = LIM.flood[1]; h.min = 0; h.max = 1; h.step = 0.005; c.min = LIM.cas[0] * 100; c.max = LIM.cas[1] * 100;
  f.value = FLOOD; h.value = Math.log(HARDK / LIM.hard[0]) / hk; c.value = STRIKE.cas * 100;
  sp.min = LIM.speed[0]; sp.max = LIM.speed[1]; sp.value = SPEEDK; ag.min = LIM.agile[0]; ag.max = LIM.agile[1]; ag.value = AGILK;
  function show() {
    $('speedV').textContent = SPEEDK.toFixed(2) + '×（最快約 ' + (VMAX * SPEEDK * 1.944).toFixed(0) + ' 節）';
    $('agileV').textContent = AGILK.toFixed(2) + '×（滿帆側風約 ' + ((0.012 + 0.016 * VMAX * 0.92) * AGILK * 57.3).toFixed(1) + '°/秒）';
    $('floodV').textContent = FLOOD === 0 ? '0×（不會沉）' : FLOOD.toFixed(2) + '×' + (FLOOD < 0.5 ? '（慢）' : FLOOD < 1.2 ? '' : '（快）');
    $('hardV').textContent = HARDK.toFixed(1) + '×' + (HARDK < 1 ? '（容易打穿）' : HARDK > 10 ? '（幾乎打不穿）' : HARDK > 3 ? '（很難打穿）' : '');
    $('casV').textContent = STRIKE.cas >= 1 ? '100%（全員倒下才停）' : Math.round(STRIKE.cas * 100) + '%';
    $('strikeV').textContent = strikeText();
  }
  f.oninput = function () { FLOOD = +f.value; show(); };
  sp.oninput = function () { SPEEDK = +sp.value; show(); };
  ag.oninput = function () { AGILK = +ag.value; show(); };
  h.oninput = function () { HARDK = Math.round(LIM.hard[0] * Math.exp(h.value * hk) * 10) / 10; show(); };
  c.oninput = function () { STRIKE.cas = c.value / 100; show(); };
  ['guns', 'masts', 'officers'].forEach(function (k) {
    var b = $('st-' + k); b.checked = STRIKE[k];
    b.onchange = function () { STRIKE[k] = b.checked; show(); };
  });
  show();
}
sliders();
[].forEach.call(document.querySelectorAll('#dists button'), function (b) { b.onclick = function () { DIST = +b.dataset.d; [].forEach.call(document.querySelectorAll('#dists button'), function (x) { x.className = x === b ? 'on' : ''; }); }; });
[].forEach.call(document.querySelectorAll('#sails button'), function (b) { b.onclick = function () { setSailMode(b.dataset.s); }; });
setSailMode(SAIL); setCamTrack(true); $('physT').classList.toggle('on', PHYS); $('phys').checked = PHYS;
$('go').onclick = start;
$('endC').onclick = function () { $('end').className = ''; };
$('endR').onclick = function () { RUNNING = false; $('end').className = ''; $('cover').style.display = ''; };

