// ───────────────────────── 輸入 ─────────────────────────
var drag = null, PTRS = new Map(), PINCH = null;          // PTRS：按著的指頭（觸控）；兩指（PINCH）⇒ 張合 ＝ 縮放、一起拖 ＝ 平移（同右鍵拖曳；Tim 2026-10-13），不轉鏡頭也不瞄準
function pinchD() { var a = Array.from(PTRS.values()); return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1; }
function pinchM() { var a = Array.from(PTRS.values()); return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 }; }
/** 平移（右鍵拖曳、兩指拖曳）：換成自由鏡頭，從現在看的那一點開始移。dx／dy ＝ 螢幕像素。 */
function panBy(dx, dy) {
  if (CAM.mode === 1) CAM.mode = 0;
  if (CAM.mode > 1) { CAM.tgt = CAM.look.slice(); CAM.mode = 0; }      // 從跟著船的鏡頭換成自由鏡頭
  var fw = norm([CAM.look[0] - CAM.eye[0], 0, CAM.look[2] - CAM.eye[2]]), rt = [-fw[2], 0, fw[0]], k = CAM.dist * 0.0018;
  CAM.tgt = add(CAM.tgt, add(mul(rt, -dx * k), mul(fw, dy * k)));
}
cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
document.addEventListener('contextmenu', function (e) { if (!/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) e.preventDefault(); });   // 面板、按鈕、說明上長按也不跳選單（輸入框照常）
cv.addEventListener('pointerdown', function (e) {
  cv.setPointerCapture(e.pointerId); PTRS.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (PTRS.size === 2) { var m0 = pinchM(); PINCH = { d: pinchD(), dist: CAM.dist, x0: m0.x, y0: m0.y, mx: m0.x, my: m0.y, moved: false }; drag = null; return; }
  if (PTRS.size > 2) return;
  drag = { x: e.clientX, y: e.clientY, b: e.button, moved: false };
});
cv.addEventListener('pointermove', function (e) {
  if (PTRS.has(e.pointerId)) PTRS.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (PINCH && PTRS.size === 2) {
    CAM.dist = clamp(PINCH.dist * PINCH.d / pinchD(), 12, 900);
    var m = pinchM();                                                  // 兩指中點移了 8 px 以上才開始平移（⛔ 不設門檻 ⇒ 只是張合時手指晃一下畫面也跟著跑）
    if (!PINCH.moved && Math.hypot(m.x - PINCH.x0, m.y - PINCH.y0) < 8) return;
    PINCH.moved = true; panBy(m.x - PINCH.mx, m.y - PINCH.my); PINCH.mx = m.x; PINCH.my = m.y;
    return;
  }
  if (!drag) return;
  var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 5) return;
  drag.moved = true; drag.x = e.clientX; drag.y = e.clientY;
  if (drag.b === 2) panBy(dx, dy);
  else { if (CAM.mode === 1) CAM.mode = 0; if (CAM.mode === 4) CAM.aoff += dx * 0.006; else CAM.yaw += dx * 0.006; CAM.pitch = clamp(CAM.pitch + dy * 0.005, 0.02, 1.45); }
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
  var me = SHIPS[PLAYER_I], hit = null, on = null;                   // 除了自己，每艘還浮著的船都射一次（友艦也瞄得到），取最近的那一個（t：沿射線多遠；每艘的公尺／格一樣）
  SHIPS.forEach(function (o) {
    if (o === me || o.sunk) return;
    var oL = toLocal(o, p0), dL = M4.dir(o.inv, d[0], d[1], d[2]), h = VK.raycast(o.grid, oL, dL, 3000);
    if (h && (!hit || h.t < hit.t)) { hit = h; on = o; }
  });
  // Tim 2026-10-14：「點海會取消瞄準；點在船身上（也可以瞄友軍，可以變色）就變成那一邊的砲手控」
  //   點到船 ⇒ 瞄準點設在那艘（敵艦 ⇒ 也是我的目標，52_fleet.js pickFoes；友艦 ⇒ 圈變藍、打下去照樣是誤擊）；瞄準模式回到自由。
  //   自動開砲開著 ⇒ 對得到它的那一舷交給玩家（me.hand；空白鍵齊射），另一舷照樣自動（50_sim.js aiSecond）。
  //   點到海 ⇒ 取消瞄準（手動 ⇒ 回到預設的瞄法；自動開砲 ⇒ 回到全自動）。
  if (hit) {
    setAim(me, [hit.x + 0.5, hit.y + 0.5, hit.z + 0.5], on); me.pMode = AIM_P = 'free'; sfx('crack', null, 0.08);
    if (!isFoe(me, on)) note(me, '瞄準友艦 ' + on.name + teamTag(on) + ' —— 打下去一樣會傷到它');
    if (AUTOFIRE && !me.hand) { me.hand = true; note(me, '手動瞄準：這一舷你來打（空白鍵齊射），另一舷照樣自動 —— 點海面回到全自動'); }
  } else if (me.aim) {
    setAim(me, null);
    if (AUTOFIRE && me.hand) { me.hand = false; note(me, '取消瞄準 —— 回到全自動開砲'); } else note(me, '取消瞄準');
  }
}
window.addEventListener('keydown', function (e) {
  if (!RUNNING) return;
  var k = e.key.toLowerCase(); if (e.code === 'Space') k = ' ';
  if (k === 'escape') { e.preventDefault(); if (HELP.open) helpClose(); else if (FLX) floodClose(); else if (FLX3) xrayToggle(); else gsetToggle(); return; }   // 遊戲內的設定面板
  if (k === ' ' || k === 'a' || k === 'd' || k === 'w' || k === 's' || k.indexOf('arrow') === 0) e.preventDefault();
  kbLit(k, true);
  doKey(k, e.repeat);
});
/** 鍵盤按著的時候，畫面上對應的按鈕也亮成按下的顏色（Tim 2026-10-14；跟手指按住同一個 .down）；方向鍵照 A／D／W／S 的按鈕。 */
var KB_ALIAS = { arrowleft: 'a', arrowright: 'd', arrowup: 'w', arrowdown: 's' };
function kbLit(k, on) { k = KB_ALIAS[k] || k; [].forEach.call(document.querySelectorAll('.kb[data-k]'), function (b) { if (b.dataset.k === k) b.classList.toggle('down', on); }); }
/** 一個鍵的動作（鍵盤與畫面上的按鈕共用 ⇒ 手機也能玩）。打舵（A／D）是「按住」：這裡只按下，放開走 keyUp。 */
function doKey(k, repeat) {
  if (!RUNNING) return;
  var me = SHIPS[PLAYER_I];
  if (k === ' ') { if (!PAUSED && !me.sunk) broadside(me, AMMO_I); }   // 降旗了 ⇒ broadside／fireOne 自己擋
  else if (k === 'f') { if (!PAUSED) fireOne(me, AMMO_I); }
  else if (k === '1' || k === '2' || k === '3') AMMO_I = +k - 1;
  else if (k === 'q') { me.pMode = AIM_P = AIM_CYCLE[(AIM_CYCLE.indexOf(me.pMode || 'free') + 1) % AIM_CYCLE.length]; note(me, '瞄準：' + AIM_NAME[me.pMode] + (me.pMode === 'free' ? '（點敵艦設瞄準點）' : '')); }   // 瞄準模式（51_captain.js）
  else if (k === 'c') { CAM.mode = CAM_ORDER[(CAM_ORDER.indexOf(CAM.mode) + 1) % CAM_ORDER.length]; CAM.follow = null; if (CAM.mode === 2 || CAM.mode === 3) { CAM.dist = 75; } else if (CAM.mode === 0) CAM.dist = DIST + 40; else if (CAM.mode === 4) { CAM.dist = 78; CAM.aoff = 0.35; } }
  else if (k === 'p') { PAUSED = !PAUSED; frzShow(); pauseLabel(); }                               // 停格（72_floodui.js：停格時上方一條、進水細節頁）
  else if (k === 'i') { if (PAUSED) floodToggle(); }                 // 停格時：進水圖表／透視（72_floodui.js）
  else if (k === 'x') xrayToggle();
  else if (k === 'z') cutToggle();                                    // 停格時：剖面、隱藏甲板（74_cutaway.js）
  else if (k === 'l') deckCycle();
  else if (k === 'm') { muted = !muted; gsetShow(); }
  else if (k === 'h' || k === '?') helpToggle();
  else if (k === 'r') { gsetClose(); helpClose(); RUNNING = false; END_AT = 0; END_WAIT = null; $('cover').style.display = ''; $('end').className = ''; }
  else if (k === '4' || k === '5' || k === '6') setSailMode(['auto', 'manual', 'off'][+k - 4]);   // 航行（TASK-0567，Tim 2026-10-14：不用 Tab 循環，三個鍵直接切）
  else if (k === 'o') gsetToggle();                                    // 設定（Esc 也可以）
  else if (k === 'a' || k === 'd' || k === 'arrowleft' || k === 'arrowright') {   // 打舵：自動或停船中一碰就換手動
    if (SAIL !== 'manual') setSailMode('manual'); KEYS[k === 'a' || k === 'arrowleft' ? 'l' : 'r'] = true;
  }
  else if (k === 'v') setCamTrack(!CAM.track);
  else if (k === 'g') setAutoFire(!AUTOFIRE);
  else if (k === 'b') setPhys(!PHYS);
  else if (k === 'n') { gsetClose(); helpClose(); start(); }                                        // 重新開始：同樣的模式、距離、滑桿，不用打完
  else if (k === 'w' || k === 's' || k === 'arrowup' || k === 'arrowdown') {     // 帆裝
    if (!repeat) setSails(me, me.sailSet + (k === 'w' || k === 'arrowup' ? 1 : -1));
  }
}
function keyUp(k) { if (k === 'a' || k === 'arrowleft') KEYS.l = false; if (k === 'd' || k === 'arrowright') KEYS.r = false; }
window.addEventListener('keyup', function (e) { var k = e.key.toLowerCase(); if (e.code === 'Space') k = ' '; kbLit(k, false); keyUp(k); });
window.addEventListener('blur', function () { KEYS.l = KEYS.r = false; [].forEach.call(document.querySelectorAll('.kb.down'), function (b) { b.classList.remove('down'); }); });   // 切走視窗 ⇒ 收不到 keyup，按下的顏色一起清掉
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
  if (RUNNING && SHIPS.length) note(SHIPS[PLAYER_I], SAIL_NAMES[m] + '（4 自動／5 手動／6 停船）');
}
/** 自由鏡頭跟不跟著兩艘的中點走（預設跟；鏡頭「看敵艦／看我艦」本來就跟著那一艘）。 */
function setCamTrack(on) {
  CAM.track = on; CAM.trMe = CAM.trYaw = null;
  $('camT').classList.toggle('on', on);
  if (RUNNING && SHIPS.length) note(SHIPS[PLAYER_I], on ? '鏡頭跟著船' : '鏡頭固定（V 切換）');
}
/** 自動開砲（我艦）：觀戰預設開、其他模式預設關（reset 時照模式設）。 */
function setAutoFire(on) {
  AUTOFIRE = on; $('autoF').classList.toggle('on', on); if (SHIPS[PLAYER_I]) SHIPS[PLAYER_I].hand = false;   // 切換 ⇒ 手動瞄準那一舷也收掉
  if (RUNNING && SHIPS.length) note(SHIPS[PLAYER_I], on ? '自動開砲' : '自己開砲（點敵艦瞄準、空白鍵齊射）');
}
[].forEach.call(document.querySelectorAll('#hudctl [data-s]'), function (b) { b.onclick = function () { setSailMode(b.dataset.s); }; });
$('autoF').onclick = function () { setAutoFire(!AUTOFIRE); };
$('camT').onclick = function () { setCamTrack(!CAM.track); };
$('physT').onclick = function () { setPhys(!PHYS); };
$('restartB').onclick = function () { if (RUNNING) { gsetClose(); helpClose(); start(); } };
$('boomB').onclick = function () { if (selfDestruct()) { gsetClose(); helpClose(); PAUSED = false; } };   // 自爆：關掉設定、解除停格，看煙花（23_powder.js）
// 遊戲內的設定面板（⚙ 設定、Esc）：打開 ⇒ 暫停（關掉回到打開之前的暫停狀態）；畫質、物理效果的檔位跟主選單是同一份（07_gfx.js／09_phx.js）
var GSET = { open: false, paused: false };
function gsetOpen() { if (!RUNNING || GSET.open) return; helpClose(); GSET.open = true; GSET.paused = PAUSED; PAUSED = true; $('gset').classList.add('on'); $('gsetBg').classList.add('on'); gsetShow(); }
function gsetClose() { if (!GSET.open) return; GSET.open = false; PAUSED = GSET.paused; $('gset').classList.remove('on'); $('gsetBg').classList.remove('on'); }
function gsetToggle() { if (GSET.open) gsetClose(); else gsetOpen(); }
function gsetShow() {
  var gl = gfxLevel(), xl = phxLevel();
  [].forEach.call(document.querySelectorAll('#gset [data-gg]'), function (b) { b.classList.toggle('on', b.dataset.gg === gl); });
  [].forEach.call(document.querySelectorAll('#gset [data-gx]'), function (b) { b.classList.toggle('on', b.dataset.gx === xl); });
  $('gsGfx').textContent = gl === 'custom' ? '（自訂）' : ''; $('gsPhx').textContent = xl === 'custom' ? '（自訂）' : '';
  $('muteT').classList.toggle('on', muted); $('fpsT').classList.toggle('on', GFX_FPS);
  $('slowT').classList.toggle('on', SLOW.on); $('slowCamT').classList.toggle('on', SLOW.cam); $('boomB').classList.toggle('dis', !canSelfDestruct());
  $('fullT').classList.toggle('on', fsOn()); $('fullT').classList.toggle('dis', !fsCan()); $('gsFull').textContent = fsCan() ? '' : '（這裡不給全螢幕：iPhone 的 Safari 只給影片）';
}
$('setB').onclick = gsetToggle;
// 說明（設定裡的「H 說明」、H、?）：打開 ⇒ 暫停（關掉回到打開之前的暫停狀態，跟設定一樣）；外面蓋一層 #helpBg，點外面、✕、H、Esc 都關（Tim 2026-10-13：手機上不好關說明）
var HELP = { open: false, paused: false };
function helpOpen() { if (!RUNNING || HELP.open) return; gsetClose(); HELP.open = true; HELP.paused = PAUSED; PAUSED = true; $('help').classList.add('on'); $('helpBg').classList.add('on'); }
function helpClose() { if (!HELP.open) return; HELP.open = false; PAUSED = HELP.paused; $('help').classList.remove('on'); $('helpBg').classList.remove('on'); }
function helpToggle() { if (HELP.open) helpClose(); else helpOpen(); }
$('helpBg').onclick = helpClose; $('helpX').onclick = helpClose; $('helpB').onclick = helpOpen;
$('gsetBg').onclick = gsetClose;                                    // 面板外點一下 ⇒ 關（不會順便瞄準、開砲：底下的東西被這一層蓋住）
$('gsGo').onclick = gsetClose;
$('menuB').onclick = function () { doKey('r'); };
$('muteT').onclick = function () { muted = !muted; gsetShow(); };
$('fpsT').onclick = function () { GFX_FPS = !GFX_FPS; gfxShow(); };
// 全螢幕（設定面板的「F11 全螢幕」；Tim 2026-10-13：主要給手機用）：整頁（documentElement）進出全螢幕；畫布大小每一格照量（60_render.js resize）⇒ 不用另外處理。
//   畫廊彈窗的 iframe（sandbox＋allow="fullscreen"，ArtGallery/index.html）進得去（量過：fullscreenEnabled、點了 fs ＝ true、按鈕亮）。
//   不給全螢幕的地方（iPhone 的 Safari 只給影片、沒開 fullscreen 權限的 iframe）⇒ 按鈕變灰、寫原因。Esc 是瀏覽器自己退出全螢幕的鍵（頁面收不到那一下）。
//   「F11」只是提示電腦上按 F11 也能全螢幕（Tim：只是提示）—— 那是瀏覽器自己的全螢幕，頁面不攔（⛔ 攔了要猜瀏覽器的全螢幕開了沒：拿視窗跟螢幕比大小，縮放與無頭 Chrome 都會猜錯）。
//   不存檔：進全螢幕一定要使用者點一下才行，開局自動進不去。
function fsOn() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
function fsCan() { return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled); }
function fsToggle() {
  if (!fsCan()) return;
  var d = document, e = d.documentElement;
  try {
    var r = fsOn() ? (d.exitFullscreen || d.webkitExitFullscreen).call(d) : (e.requestFullscreen || e.webkitRequestFullscreen).call(e, { navigationUI: 'hide' });
    if (r && r.catch) r.catch(function () { gsetShow(); });                          // 被拒（沒有點擊、權限）⇒ 按鈕照實際狀態
  } catch (err) { gsetShow(); }
}
$('fullT').onclick = fsToggle;
['fullscreenchange', 'webkitfullscreenchange'].forEach(function (ev) { document.addEventListener(ev, gsetShow); });   // 進出（含 Esc 退出）⇒ 按鈕跟著亮滅
[].forEach.call(document.querySelectorAll('#gset [data-gg]'), function (b) { b.onclick = function () { gfxSet(b.dataset.gg); gfxShow(); }; });
[].forEach.call(document.querySelectorAll('#gset [data-gx]'), function (b) { b.onclick = function () { phxSet(b.dataset.gx); phxSync(); }; });
$('endA').onclick = start;
[].forEach.call(document.querySelectorAll('#ammo span'), function (s) { s.onclick = function () { AMMO_I = +s.dataset.a; }; });
[].forEach.call(document.querySelectorAll('#modes button'), function (b) { b.onclick = function () { MODE = b.dataset.m; [].forEach.call(document.querySelectorAll('#modes button'), function (x) { x.className = x === b ? 'on' : ''; }); }; });
/** 選單：滑桿的上下限從 LIM 來；數值只在使用者動了那一條時才從滑桿讀回（⛔ 一開頭就讀回 ⇒ 網址給的 0.33 被 step 吃成 0.35）。
 *  船殼、砲、帆、火藥桶、航行、降旗的滑桿在「細節設定」那一頁（從主選單進）；主選單只留一行摘要（#detV）。 */
/** 模型（砲、火藥桶）的總重（噸）：照匯出的模型清單＋取用點的 12 桶（細節設定的例子用；開戰時每艘照自己的模型算）。 */
function modelMassT(T, gunw) { if (!T) return 0; var t = 12 * KEG_T; (T.rig.models || []).forEach(function (m) { t += modelT({ kind: modelKind(m) }, gunw); }); return t; }
var CFG_ID = myHull();                             // 細節設定的「船隻設定」正在編輯哪一型
var SLIDERS_SHOW = null;                               // 載入完（HYD 算好）再顯示一次 ⇒ 減重上浮的例子有數字
function sliders() {
  var lf = $('ballast'), f = $('flood'), h = $('hard'), c = $('cas'), sp = $('speed'), ag = $('agile'), uw = $('upwind'), gh = $('gunhp'), gw = $('gunw'), sl = $('sailhp'), ph = $('powderhp'), bl = $('blast'), bv = $('blastv'), ch = $('crewhp');
  var dm = { long: $('dmg24'), long32: $('dmg32l'), carr: $('dmg32'), chase: $('dmg18'), long4: $('dmg4') }, DLIM = { long: LIM.dmg24, long32: LIM.dmg32l, carr: LIM.dmg32, chase: LIM.dmg18, long4: LIM.dmg4 }, bx = $('box'), cy = $('carry'), wk = $('wind'), dr = $('drown');
  var st = $('stall'), fs = $('funspeed'), fa = $('funagile'), fl = $('funstall'), fp = $('funpowder'), se = $('sea');   // 頂風失速、娛樂加成、浪
  [[se, 'sea'], [st, 'stall'], [fs, 'funspeed'], [fa, 'funagile'], [fl, 'funstall'], [fp, 'funpowder']].forEach(function (e) { e[0].min = LIM[e[1]][0]; e[0].max = LIM[e[1]][1]; });
  dr.min = LIM.drown[0]; dr.max = LIM.drown[1];
  bx.min = LIM.box[0]; bx.max = LIM.box[1]; cy.min = LIM.carry[0]; cy.max = LIM.carry[1]; wk.min = LIM.wind[0]; wk.max = LIM.wind[1];
  // 硬度跨 40 倍 ⇒ 對數刻度：滑桿 0..1 ↔ 硬度 LIM 下限 × (上限／下限)^v
  var hk = Math.log(LIM.hard[1] / LIM.hard[0]);
  lf.min = LIM.ballast[0]; lf.max = LIM.ballast[1]; gw.min = LIM.gunw[0]; gw.max = LIM.gunw[1];
  f.min = LIM.flood[0]; f.max = LIM.flood[1]; h.min = 0; h.max = 1; h.step = 0.005; c.min = LIM.cas[0] * 100; c.max = LIM.cas[1] * 100;
  sp.min = LIM.speed[0]; sp.max = LIM.speed[1]; ag.min = LIM.agile[0]; ag.max = LIM.agile[1]; uw.min = LIM.upwind[0]; uw.max = LIM.upwind[1];
  gh.min = LIM.gunhp[0]; gh.max = LIM.gunhp[1]; sl.min = LIM.sailhp[0]; sl.max = LIM.sailhp[1]; ph.min = LIM.powderhp[0]; ph.max = LIM.powderhp[1];
  bl.min = LIM.blast[0]; bl.max = LIM.blast[1]; bv.min = LIM.blastv[0] * 100; bv.max = LIM.blastv[1] * 100; ch.min = LIM.crewhp[0]; ch.max = LIM.crewhp[1];
  for (var t in dm) { dm[t].min = DLIM[t][0]; dm[t].max = DLIM[t][1]; }
  function am(r, k) { return $('am-' + r + '-' + k); }
  function C() { return shipCfg(CFG_ID); }             // 正在編輯的那一型（船隻配置頁）
  // 船員（船隻配置頁；TASK-0570）：每一項一條滑桿；砲班照砲種各一條（這一型沒有的砲種藏起來）。改了寫進 SHIP_CREW（05_hull.js），存檔跟著存（69_prefs.js）
  var CR = {}, crBox = $('crewItems');
  CREW_ITEMS.concat([{ k: 'gh' }], Object.keys(GUNS).map(function (t) { return { k: 'g-' + t, gun: t, name: GUNS[t].name, lim: [GUNS[t].min, GUN_CREW_MAX] }; })).forEach(function (it) {
    var row = document.createElement('div');
    if (it.k === 'gh') { row.className = 'row note'; row.textContent = '砲班（每門砲幾個人）'; crBox.appendChild(row); return; }
    row.className = 'row slide';
    row.innerHTML = '<label for="cr-' + it.k + '">' + it.name + '</label><input type="range" id="cr-' + it.k + '" step="1" min="' + it.lim[0] + '" max="' + it.lim[1] + '"><span id="cr-' + it.k + 'V"></span>';
    crBox.appendChild(row);
    var el = row.querySelector('input');
    el.oninput = function () { var p = SHIP_CREW[CFG_ID] = SHIP_CREW[CFG_ID] || {}, v = Math.round(+el.value); if (it.gun) (p.guns = p.guns || {})[it.gun] = v; else p[it.k] = v; show(); };
    CR[it.k] = { it: it, el: el, row: row };
  });
  /** 這一型的砲（照砲種）、幾根桅、有沒有舵輪：船型載好才知道（沒載 ⇒ null）。 */
  function hullCounts(id) {
    var T = HULLT[id]; if (!T) return null;
    var g = {}, n = 0, wheel = false;
    (T.rig.models || []).forEach(function (m) { var k = modelKind(m); if (GUNS[k]) { g[k] = (g[k] || 0) + 1; n++; } if (k === 'wheel') wheel = true; });
    return { guns: g, n: n, masts: T.masts.length, wheel: wheel };
  }
  function rankList(n) { var r = OFFICER_RANKS.slice(0, n); if (n > OFFICER_RANKS.length) r.push('見習軍官 ' + (n - OFFICER_RANKS.length)); return r.join('、'); }
  // 艙房（船隻配置頁；TASK-0568）：這一型標好的空艙房一間一列 —— 配什麼功能（放不下必要件的那個選項不能選、寫出原因）、照大小排出來幾件家具
  function roomsPut() {
    var box = $('roomItems'), T = HULLT[CFG_ID], R = T ? hullRooms(T) : [], fns = roomFns(CFG_ID), html = '';
    R.forEach(function (r, i) {
      var opts = '<option value="">空著</option>' + Object.keys(ROOM_FN).map(function (k) {
        var lay = roomLayout(T, r, k), F = ROOM_FN[k], why = '';
        if (!lay) why = '（放不下：要 ' + Object.keys(F.need || {}).map(function (it) { return (FURN[it] ? FURN[it].name : it) + ' ' + F.need[it]; }).join('、') + '）';
        return '<option value="' + k + '"' + (lay ? '' : ' disabled') + '>' + F.name + (lay ? '（' + FURN[(F.extra || Object.keys(F.need)[0])].name + ' ' + lay.length + '）' : why) + '</option>';
      }).join('');
      var sz = [0, 1].map(function (k) { return ((r.max[k] - r.min[k] + 1) * S).toFixed(1); }).join('×') + ' m';
      html += '<div class="row slide"><label for="rm-' + i + '">' + r.name.replace(/^甲板-/, '').replace('/艙房-鏡像/', ' 左 ').replace('/艙房/', ' 右 ') + '</label><select id="rm-' + i + '" data-r="' + r.name.replace(/"/g, '') + '">' + opts + '</select><span>' + sz + '</span></div>';
    });
    box.innerHTML = html;
    [].forEach.call(box.querySelectorAll('select'), function (s) {
      s.value = fns[s.dataset.r] || '';
      if (s.selectedOptions[0] && s.selectedOptions[0].disabled) s.value = '';
      s.onchange = function () { (SHIP_ROOMS[CFG_ID] = SHIP_ROOMS[CFG_ID] || {})[s.dataset.r] = s.value; show(); };
    });
  }
  function roomsShow() {
    var T = HULLT[CFG_ID], R = T ? hullRooms(T) : [], fns = roomFns(CFG_ID), n = {};
    R.forEach(function (r) { var f = fns[r.name]; if (f && roomLayout(T, r, f)) n[f] = (n[f] || 0) + 1; });
    $('roomSum').textContent = !T ? '船型載入後列得出艙房。' : !R.length ? '這一型還沒標空艙房（造船規格 §9.2：艙房子作品的固定點 <房名>.min／.max、關聯 meta kind=rooms）。'
      : R.length + ' 間空艙房' + (Object.keys(n).length ? '：' + Object.keys(n).map(function (f) { return ROOM_FN[f].name + ' ' + n[f] + ' 間'; }).join('、') : '，都空著') + '。家具照艙房大小排（先擺必要件、剩下的空間多擺）；門口留 0.6 m 走道。' + (ROOMFN_Q ? '　⚠ 網址 ?roomfn= 蓋過' : '');
  }
  function crewPut() {
    var cw = shipCrew(CFG_ID), hc = hullCounts(CFG_ID);
    Object.keys(CR).forEach(function (key) { var e = CR[key]; e.el.value = e.it.gun ? gunCrew(cw, e.it.gun) : cw[e.it.k]; if (e.it.gun) e.row.style.display = !hc || hc.guns[e.it.gun] ? '' : 'none'; });
  }
  function crewShow() {
    var cw = shipCrew(CFG_ID), d = crewDefault(CFG_ID), hc = hullCounts(CFG_ID);
    function v(key, txt, x, x0) { $('cr-' + key + 'V').textContent = txt + (x === x0 ? '' : '　（預設 ' + x0 + '）'); }
    var n = cw.officers; v('officers', n + ' 人' + (n ? '（' + rankList(n) + '）' : '（沒有軍官：沒人指揮，瞄準變散）'), n, d.officers);
    n = cw.helm; v('helm', n + ' 人' + (hc && !hc.wheel ? '（這型沒有舵輪 ⇒ 不站人）' : '（站在舵輪後面；倒下時預備水手會補）'), n, d.helm);
    n = cw.marines; v('marines', n + ' 人（沿右舷舷牆站，用火槍打敵艦露天的人）', n, d.marines);
    n = cw.top; v('top', n + ' 人 × ' + (hc ? hc.masts + ' 根桅 ＝ ' + n * hc.masts : '每根桅'), n, d.top);
    n = cw.monkeys; v('monkeys', n ? n + ' 人 × 每一對砲' + (hc ? '（約 ' + Math.ceil(hc.n / 2) + ' 對）' : '') + '：從取用點搬火藥與彈藥' : '0（沒有：砲旁的藥箱用完就停）', n, d.monkeys);
    n = cw.hands; v('hands', n + ' 人（在住艙甲板待命，缺人手時補位）' + (Q.has('hands') ? '　⚠ 網址 ?hands= 蓋過' : ''), n, d.hands);
    var gsum = 0;
    Object.keys(GUNS).forEach(function (t) {
      var x = gunCrew(cw, t), std = GUNS[t].crew, c = hc ? hc.guns[t] || 0 : 0; gsum += x * c;
      v('g-' + t, x + ' 人' + (hc ? ' × ' + c + ' 門 ＝ ' + x * c : '') + '（' + (x < std ? '標準 ' + std + '：人少裝填慢' : x > std ? '標準 ' + std + '：多的 ' + (x - std) + ' 人是替補' : '標準') + '；最少 ' + GUNS[t].min + ' 人才開得動）', x, gunCrew(d, t));
    });
    if (hc) {
      var pm = Math.ceil(hc.n / 2) * cw.monkeys, hl = hc.wheel ? cw.helm : 0, tp = cw.top * hc.masts, tot = gsum + pm + cw.officers + hl + cw.marines + tp + cw.hands;
      var seen = CREW_SEEN[CFG_ID], ss = !seen ? '這一型還沒上過船：站不站得下，開戰時才知道（站不下的那一項會在上方廣播）。'
        : seen.sig !== crewSig(cw) ? '改過之後還沒開過戰：站不站得下，下一場開戰時才知道（站不下的那一項會在上方廣播）。'
        : '上一場實際上船 ' + seen.n + ' 人' + (seen.short.length ? '；站位不夠、站不下的：' + seen.short.map(function (r) { return r[0] + ' ' + r[2] + '／' + r[1]; }).join('、') + '。' : '，全部站得下。');
      $('crewSum').textContent = '全船約 ' + tot + ' 人：砲班 ' + gsum + '、送藥手約 ' + pm + '、軍官 ' + cw.officers + '、舵手 ' + hl + '、陸戰隊 ' + cw.marines + '、桅頂 ' + tp + '、預備水手 ' + cw.hands + '。' + ss;
    } else $('crewSum').textContent = '船型載入後算得出全船人數。';
    $('shipSt').textContent = PREFS.write ? '改了就自動存在這個瀏覽器（重新整理、下次打開都還在）；換瀏覽器或裝置：用下面的匯出、匯入。'
      : '⚠ 這一頁現在存不了' + (PREFS.state ? '（' + PREFS.state + '）' : '（網址帶了設定參數、或是在畫廊的彈窗裡）') + ' —— 要留住請用下面的「匯出」。';
  }
  function put() {                                     // 變數 ⇒ 滑桿位置（開頭、重設預設值、換編輯的船時）
    var k = C(); $('cfgShip').value = CFG_ID;
    lf.value = k.ballast !== undefined ? k.ballast : LIM.ballast[2]; f.value = k.flood; h.value = Math.log(k.hard / LIM.hard[0]) / hk; c.value = STRIKE.cas * 100; sp.value = k.speed; ag.value = k.agile; uw.value = k.upwind;
    gh.value = GUN_HP; gw.value = k.gunw; sl.value = SAIL_HP; ph.value = POWDER_HP; bl.value = BLAST_K; bv.value = Math.round(BLAST_V * 100); ch.value = CREW_HP;
    for (var t in dm) dm[t].value = DMG[t];
    bx.value = BOX_N; cy.value = CARRY_N; wk.value = WIND_K; dr.value = DROWN_T;
    se.value = SEA_K; st.value = STALL_K; fs.value = FUN.speed; fa.value = FUN.agile; fl.value = FUN.stall; fp.value = FUN.powder;
    for (var r = 0; r < 3; r++) for (var k = 0; k < 3; k++) am(r, k).value = AMMO_K[r][k];
    ['guns', 'masts', 'officers'].forEach(function (k) { $('st-' + k).checked = STRIKE[k]; });
    [0, 1].forEach(function (i) { $('cap' + i).value = CAP_SET[i]; });
    crewPut(); roomsPut();
  }
  function show() {
    var K = C(), SPEEDK = K.speed, AGILK = K.agile, FLOOD = K.flood, HARDK = K.hard, GUNW_K = K.gunw, BALLAST_T = K.ballast !== undefined ? K.ballast : LIM.ballast[2];   // 正在編輯的那一型
    var fun = PLAY === 'fun' ? '（娛樂：' : '（', SPE = SPEEDK * playK('speed'), AGE = AGILK * playK('agile');   // 娛樂 ⇒ 括號裡寫乘過加成的實際值
    $('speedV').textContent = SPEEDK.toFixed(2) + '×' + fun + '最快約 ' + (VMAX * SPE * 1.944).toFixed(0) + ' 節）';
    $('agileV').textContent = AGILK.toFixed(2) + '×' + fun + '滿帆側風約 ' + ((0.012 + 0.016 * VMAX * 0.92) * AGE * 57.3).toFixed(1) + '°/秒）';
    var UPK = K.upwind; $('upwindV').textContent = UPK.toFixed(2) + '×（' + (UPK === 1 ? '照舊：' : '') + '風從船頭 ' + (90 - (90 - NOGO_DEG) * UPK).toFixed(0) + '° 開始失速、' + (90 - (90 - NOGO_FULL) * UPK).toFixed(0) + '° 全失速（手動操舵）；近迎風轉向最多 ×' + UPK.toFixed(2) + '）';
    var SK = STALL_K * playK('stall'), WA = WAVES.reduce(function (a, w) { return a + w.a; }, 0) * SEA_K;   // WA：幾道浪疊在一起最高的那一下（振幅）
    $('seaV').textContent = SEA_K <= 0 ? '0（平靜）' : SEA_K.toFixed(2) + '×（浪高最多約 ' + (WA * 2).toFixed(1) + ' m，主浪週期 ' + (2 * Math.PI / WAVES[0].w).toFixed(1) + ' 秒）';
    $('stallV').textContent = Math.round(STALL_K * 100) + '%' + (PLAY === 'fun' ? '（娛樂：實際 ' + Math.round(SK * 100) + '%）' : '') + (SK <= 0 ? '（不會失速）' : SK >= 0.95 ? '（寫實）' : '');
    $('funspeedV').textContent = FUN.speed.toFixed(2) + '×'; $('funagileV').textContent = FUN.agile.toFixed(2) + '×'; $('funstallV').textContent = FUN.stall.toFixed(2) + '×';
    $('funpowderV').textContent = FUN.powder.toFixed(2) + '×' + (powderNever() ? '（火藥拉滿：不會爆）' : '（火藥血量 ' + POWDER_HP + ' ⇒ ' + Math.round(POWDER_HP * FUN.powder) + '）');
    $('floodV').textContent = FLOOD === 0 ? '0×（不會沉）' : FLOOD.toFixed(2) + '×' + (FLOOD < 0.5 ? '（慢）' : FLOOD < 1.2 ? '' : '（快）');
    var HT = HULLT[CFG_ID], m0 = (HT ? HT.base.count * VOX_T : 0) + modelMassT(HT, GUNW_K) + BALLAST_T, l0 = liftFor(HT, HT ? HT.disp - m0 : 0), lx = liftFor(HT, HT ? HT.disp - m0 + 70 : 0);   // 照我艦的船型   // 開戰時浮在哪；例子：再打掉 10 萬格（70 噸）
    var gm = 0, kinds = {}; if (HT) (HT.rig.models || []).forEach(function (m) { var k = modelKind(m); if (GUNS[k]) { gm += GUNS[k].mass * GUNW_K; kinds[k] = 1; } });
    $('gunwV').textContent = GUNW_K.toFixed(2) + '×（' + Object.keys(GUNS).filter(function (k) { return !HT || kinds[k]; }).map(function (k) { return GUNS[k].name + ' ' + (GUNS[k].mass * GUNW_K).toFixed(1) + ' 噸'; }).join('、') + (gm ? '；全部 ' + Math.round(gm) + ' 噸' : '') + '）';
    $('ballastV').textContent = BALLAST_T + ' 噸' + (l0 === null ? '' : '（' + HT.name + ' ' + Math.round(m0).toLocaleString() + ' 噸 ⇒ ' + (Math.abs(l0) < 0.05 ? '剛好在設計水線' : l0 > 0 ? '浮高 ' + l0.toFixed(1) + ' m' : '吃水深 ' + (-l0).toFixed(1) + ' m') + '；打掉 10 萬格再浮 ' + (lx - l0).toFixed(2) + ' m）');
    $('hardV').textContent = HARDK.toFixed(1) + '×' + (HARDK < 1 ? '（容易打穿）' : HARDK > 10 ? '（幾乎打不穿）' : HARDK > 3 ? '（很難打穿）' : '');
    function shots(hp, dmg) { return dmg > 0 ? Math.ceil(hp / dmg - 1e-9) : '∞'; }
    $('gunhpV').textContent = GUN_HP + '（24 磅實心 ' + shots(GUN_HP, DMG.long * ammoK(0, VS_GUN)) + ' 發、舵輪 ' + Math.round(GUN_HP * 0.6) + '）';
    $('sailhpV').textContent = SAIL_HP + '（24 磅鏈彈 ' + shots(SAIL_HP, DMG.long * ammoK(2, VS_SAIL)) + ' 發）';
    $('crewhpV').textContent = CREW_HP + (CREW_HP === LIM.crewhp[2] ? '' : CREW_HP > LIM.crewhp[2] ? '（耐打）' : '（脆）');
    $('powderhpV').textContent = powderNever() ? '拉滿（不會爆）' : POWDER_HP + (PLAY === 'fun' ? '（娛樂：實際 ' + powderHP() + '）' : '') + (powderHP() >= 600 ? '（很難殉爆，' : powderHP() >= 250 ? '（偶爾殉爆，' : '（很容易殉爆，') + '藥包 ' + Math.round(powderHP() * CART_K) + '）';   // 照實際的（娛樂乘過加成）；300 量過六艘一艘殉爆 ⇒ 偶爾
    $('blastV').textContent = BLAST_K.toFixed(2) + '×（前彈藥庫半徑約 ' + (MAG_R * Math.pow(BLAST_K, 1 / 3) * (S || 0.1)).toFixed(1) + ' m）';
    var r0 = MAG_R * Math.pow(BLAST_K * (1 - BLAST_V), 1 / 3) * (S || 0.1), r1 = MAG_R * Math.pow(BLAST_K * (1 + BLAST_V), 1 / 3) * (S || 0.1);
    $('blastvV').textContent = BLAST_V <= 0 ? '0（每次一樣）' : '±' + Math.round(BLAST_V * 100) + '%（前彈藥庫半徑 ' + r0.toFixed(1) + '～' + r1.toFixed(1) + ' m）';
    $('boxV').textContent = BOX_N + ' 份（開戰時裝滿）';
    $('drownV').textContent = DROWN_T ? '約 ' + DROWN_T + ' 秒（浮上水面、往自己的船游，爬回來當預備水手；受傷的減半）' : '0（關：落水當場算陣亡、淹到的跟著船沉）';
    $('windV').textContent = WIND_K.toFixed(2) + '×（帆上的風約 ' + (WIND_SAIL * WIND_K).toFixed(0) + ' m/s，陣風 ±' + Math.round(GUST[0] * 100) + '%）';
    $('carryV').textContent = CARRY_N + ' 份' + (CARRY_N > BOX_N ? '（比藥箱多 ⇒ 一趟送好幾門）' : '');
    $('dmg24V').textContent = DMG.long; $('dmg32lV').textContent = DMG.long32; $('dmg32V').textContent = DMG.carr; $('dmg18V').textContent = DMG.chase; $('dmg4V').textContent = DMG.long4;
    $('casV').textContent = STRIKE.cas >= 1 ? '100%（全員倒下才停）' : Math.round(STRIKE.cas * 100) + '%';
    $('strikeV').textContent = strikeText();
    var amDef = AMMO_K.every(function (r, i) { return r.every(function (v, j) { return v === AMMO_K0[i][j]; }); });
    $('detV').textContent = '玩法 ' + (PLAY === 'fun' ? '娛樂（航速 ×' + FUN.speed.toFixed(2) + '、靈活 ×' + FUN.agile.toFixed(2) + '、頂風失速 ' + Math.round(SK * 100) + '%）' : '寫實（頂風失速 ' + Math.round(SK * 100) + '%）') + '・天氣 ' + WX.name + '・浪 ' + (SEA_K > 0 ? SEA_K.toFixed(2) + '×' : '平靜') + '・' + fleetHulls().map(function (id) { var c = shipCfg(id), hi = hullInfo(id); return (hi ? hi.name : id) + '：硬度 ' + c.hard.toFixed(1) + '×・進水 ' + c.flood.toFixed(2) + '×・壓艙物 ' + (c.ballast !== undefined ? c.ballast + ' 噸' : '（載入後）') + '・砲重 ' + c.gunw.toFixed(2) + '×・航速 ' + c.speed.toFixed(2) + '×・靈活 ' + c.agile.toFixed(2) + '×・逆風 ' + c.upwind.toFixed(2) + '×・預備水手 ' + shipCrew(id).hands; }).join('；') + '・血量 砲 ' + GUN_HP + '／帆 ' + SAIL_HP + '／船員 ' + CREW_HP +
      '・傷害 ' + DMG.long + '／' + DMG.long32 + '／' + DMG.carr + '／' + DMG.chase + '／' + DMG.long4 + (amDef ? '' : '・彈種倍率已改') + '・藥箱 ' + BOX_N + '、一次搬 ' + CARRY_N + '・溺水 ' + (DROWN_T ? DROWN_T + ' 秒' : '關') +
      '・火藥桶 ' + (powderNever() ? '不會爆' : '血量 ' + powderHP() + '、殉爆 ' + BLAST_K.toFixed(2) + '×' + (BLAST_V > 0 ? ' ±' + Math.round(BLAST_V * 100) + '%' : '')) + '・砲長 ' + CAP_SET.map(function (k) { return CAPTAINS[k] ? CAPTAINS[k].name : '隨機'; }).join('／') + '・' + strikeText();
    crewShow(); roomsShow();
  }
  lf.oninput = function () { C().ballast = Math.round(+lf.value); show(); };
  f.oninput = function () { C().flood = +f.value; show(); };
  sp.oninput = function () { C().speed = +sp.value; show(); };
  ag.oninput = function () { C().agile = +ag.value; show(); };
  uw.oninput = function () { C().upwind = +uw.value; show(); };
  h.oninput = function () { C().hard = Math.round(LIM.hard[0] * Math.exp(h.value * hk) * 10) / 10; show(); };
  c.oninput = function () { STRIKE.cas = c.value / 100; show(); };
  gh.oninput = function () { GUN_HP = Math.round(+gh.value); show(); };
  gw.oninput = function () { C().gunw = +gw.value; show(); };
  sl.oninput = function () { SAIL_HP = Math.round(+sl.value); show(); };
  ph.oninput = function () { POWDER_HP = Math.round(+ph.value); show(); };
  bl.oninput = function () { BLAST_K = +bl.value; show(); };
  bv.oninput = function () { BLAST_V = Math.round(+bv.value) / 100; show(); };
  ch.oninput = function () { CREW_HP = Math.round(+ch.value); show(); };
  bx.oninput = function () { BOX_N = Math.round(+bx.value); show(); };
  cy.oninput = function () { CARRY_N = Math.round(+cy.value); show(); };
  dr.oninput = function () { DROWN_T = Math.round(+dr.value); show(); };
  st.oninput = function () { STALL_K = +st.value; show(); };
  se.oninput = function () { SEA_K = +se.value; show(); };
  fs.oninput = function () { FUN.speed = +fs.value; show(); }; fa.oninput = function () { FUN.agile = +fa.value; show(); }; fl.oninput = function () { FUN.stall = +fl.value; show(); }; fp.oninput = function () { FUN.powder = +fp.value; show(); };
  wk.oninput = function () { WIND_K = +wk.value; show(); };          // 物理是每一步讀 ⇒ 遊戲中也能調（只管畫面）
  Object.keys(dm).forEach(function (t) { dm[t].oninput = function () { DMG[t] = Math.round(+dm[t].value); show(); }; });
  for (var r = 0; r < 3; r++) for (var k = 0; k < 3; k++) (function (r, k) {
    var el = am(r, k);
    el.oninput = function () { var v = parseFloat(el.value); if (isFinite(v)) { AMMO_K[r][k] = clamp(Math.round(v), AMMO_LIM[0], AMMO_LIM[1]); show(); } };
    el.onchange = function () { el.value = AMMO_K[r][k]; };          // 打了界外或空白 ⇒ 回到夾過的值
  })(r, k);
  ['guns', 'masts', 'officers'].forEach(function (k) { var b = $('st-' + k); b.onchange = function () { STRIKE[k] = b.checked; show(); }; });
  [0, 1].forEach(function (i) { var s = $('cap' + i); capOptions(s, CAP_SET[i]); s.onchange = function () { CAP_SET[i] = s.value; show(); }; });   // 砲長
  var cs = $('cfgShip'); hullOptions(cs, CFG_ID);                // 船隻設定：編輯哪一型（選到還沒載的船 ⇒ 先載，壓艙物的預設要船型才算得出來）
  cs.onchange = function () { CFG_ID = cs.value; loadHull(CFG_ID).then(function () { put(); show(); }); put(); show(); };
  fleetUI();                                                     // 主選單：艦隊編成
  // 細節設定那一頁：主選單 ⇄ 細節設定（同一個 #cover 裡兩張卡片，一次顯示一張）
  function page(w) { $('detail').style.display = w === 'det' ? '' : 'none'; $('gfxp').style.display = w === 'gfx' ? '' : 'none'; $('phxp').style.display = w === 'phx' ? '' : 'none'; $('shipp').style.display = w === 'ship' ? '' : 'none'; document.querySelector('#cover .card:not(#detail):not(#gfxp):not(#phxp):not(#shipp)').style.display = w ? 'none' : ''; $('cover').scrollTop = 0; }   // w：'' 主選單、'det' 細節設定、'gfx' 畫質設定、'phx' 物理設定、'ship' 船隻配置
  [].forEach.call(document.querySelectorAll('#plays button'), function (b) { b.onclick = function () { setPlay(b.dataset.p); show(); }; });   // 主選單：玩法
  $('detB').onclick = function () { page('det'); };
  $('detX').onclick = function () { page(''); };
  $('gfxB').onclick = function () { page('gfx'); };
  $('gfxX').onclick = function () { page(''); };
  $('phxB').onclick = function () { page('phx'); };
  $('phxX').onclick = function () { page(''); };
  $('shipB').onclick = function () { page('ship'); loadHull(CFG_ID).then(function () { put(); show(); }); };   // 船隻配置：先載那一型（砲數、桅數、壓艙物的預設要船型）
  $('shipX').onclick = function () { page(''); };
  var rArm = 0;                                        // 這一型回到預設：按兩下（Tim：編起來很花時間 ⇒ 不要一按就沒了；⛔ 不用 confirm()：畫廊彈窗的 iframe 沒開 allow-modals，confirm 直接回 false）
  $('shipR').onclick = function () {
    var b = $('shipR'), hi = hullInfo(CFG_ID);
    if (performance.now() - rArm > 4000) { rArm = performance.now(); b.textContent = '再按一次：' + (hi ? hi.name : CFG_ID) + '的船員、艙房與性能都回到預設'; setTimeout(function () { if (performance.now() - rArm >= 3900) b.textContent = '這一型回到預設'; }, 4000); return; }
    rArm = 0; b.textContent = '這一型回到預設';
    delete SHIP_CREW[CFG_ID]; delete SHIP_ROOMS[CFG_ID]; delete PREF_BALLAST[CFG_ID];
    var c = C(); SHIP_KEYS.forEach(function (k) { c[k] = k === 'ballast' ? (HULLT[CFG_ID] ? HULLT[CFG_ID].ballast0 : undefined) : cfgBase(k, CFG_ID); });
    put(); show();
  };
  $('shipE').onclick = function () {                   // 匯出：每一型整份（69_prefs.js shipsExport）
    var s = JSON.stringify(shipsExport(), null, 1), a = document.createElement('a'), d = new Date();
    a.href = URL.createObjectURL(new Blob([s], { type: 'application/json' }));
    a.download = 'constitution_broadside_ships_' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '.json';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    $('shipSt').textContent = '已匯出 ' + a.download + '（每一型的船員與性能）。';
  };
  $('shipI').onclick = function () { $('shipF').value = ''; $('shipF').click(); };
  $('shipF').onchange = function () {
    var f = $('shipF').files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var n = -1; try { n = shipsImport(JSON.parse(r.result)); } catch (e) { n = -1; }
      put(); show();
      $('shipSt').textContent = n < 0 ? '⚠ 匯入失敗：' + f.name + ' 不是這個遊戲匯出的船隻配置。' : '已匯入 ' + f.name + '：' + n + ' 型船' + (PREFS.write ? '（已存）。' : '（這一頁存不了，下次打開要再匯入）。');
    };
    r.readAsText(f);
  };
  gfxUI(); phxUI();
  $('detR').onclick = function () {                    // 重設預設值：LIM 的第三格、降旗全不勾
    // 船隻配置頁（每一型的船員與性能）不跟著重設：那一頁有自己的「這一型回到預設」（TASK-0570：編起來很花時間）
    GUN_HP = LIM.gunhp[2]; SAIL_HP = LIM.sailhp[2]; POWDER_HP = LIM.powderhp[2]; BLAST_K = LIM.blast[2]; BLAST_V = LIM.blastv[2]; CREW_HP = LIM.crewhp[2];
    DMG.long = LIM.dmg24[2]; DMG.long32 = LIM.dmg32l[2]; DMG.carr = LIM.dmg32[2]; DMG.chase = LIM.dmg18[2]; DMG.long4 = LIM.dmg4[2]; BOX_N = LIM.box[2]; CARRY_N = LIM.carry[2]; WIND_K = LIM.wind[2]; HANDS = LIM.hands[2]; DROWN_T = LIM.drown[2];
    AMMO_K = AMMO_K0.map(function (r) { return r.slice(); });
    SEA_K = LIM.sea[2]; STALL_K = LIM.stall[2]; FUN.speed = LIM.funspeed[2]; FUN.agile = LIM.funagile[2]; FUN.stall = LIM.funstall[2]; FUN.powder = LIM.funpowder[2];
    STRIKE.cas = LIM.cas[2]; STRIKE.guns = STRIKE.masts = STRIKE.officers = false; CAP_SET = ['random', 'random'];
    put(); show(); prefsReset();                         // 存檔跟著清（69_prefs.js：只剩主選單的選擇）
  };
  window.addEventListener('keydown', function (e) { if (!RUNNING && e.key === 'Escape' && ($('detail').style.display !== 'none' || $('gfxp').style.display !== 'none' || $('phxp').style.display !== 'none' || $('shipp').style.display !== 'none')) page(''); });
  put(); show(); SLIDERS_SHOW = function () { put(); show(); };
}
/** 畫質（07_gfx.js）：主選單的低／中／高、畫質設定頁每一項的按鈕、顯示 FPS。改了立刻生效（render 每一格讀 GFX）。 */
function gfxUI() {
  var box = $('gfxItems');
  box.innerHTML = GFX_ITEMS.map(function (it) {
    return '<div class="row"><label>' + it.name + '</label>' + it.opt.map(function (o, v) { return '<button data-k="' + it.k + '" data-v="' + v + '">' + o + '</button>'; }).join('') + '</div>';
  }).join('');
  [].forEach.call(box.querySelectorAll('button'), function (b) { b.onclick = function () { GFX[b.dataset.k] = +b.dataset.v; gfxShow(); }; });
  [].forEach.call(document.querySelectorAll('#gfxs button[data-g], #gfxPre button'), function (b) { b.onclick = function () { gfxSet(b.dataset.g); gfxShow(); }; });
  var f = $('gfxFps'); f.checked = GFX_FPS; f.onchange = function () { GFX_FPS = f.checked; gfxShow(); };
  gfxShow();
}
function gfxShow() {
  var lv = gfxLevel();
  [].forEach.call(document.querySelectorAll('#gfxs button[data-g], #gfxPre button'), function (b) { b.className = b.dataset.g === lv ? 'on' : ''; });
  var gb = $('gfxB'); gb.textContent = lv === 'custom' ? '自訂（畫質設定…）' : '畫質設定…'; gb.className = lv === 'custom' ? 'on' : '';
  [].forEach.call(document.querySelectorAll('#gfxItems button'), function (b) { b.className = GFX[b.dataset.k] === +b.dataset.v ? 'on' : ''; });
  $('gfxLv').textContent = '現在：' + GFX_NAME[lv]; $('gfxFps').checked = GFX_FPS; $('fps').className = GFX_FPS ? 'hud on' : 'hud';
  if (typeof gsetShow === 'function') gsetShow();
}
/** 物理效果（09_phx.js）：主選單的全開／高／中／低、物理設定頁每一項的按鈕。帆與繩換到「關」或從「關」換出來 ⇒ setPhys（跟 B 鍵同一支）。 */
function phxUI() {
  var box = $('phxItems');
  box.innerHTML = PHX_ITEMS.map(function (it) {
    return '<div class="row"><label>' + it.name + '</label>' + it.opt.map(function (o, v) { return '<button data-k="' + it.k + '" data-v="' + v + '">' + o + '</button>'; }).join('') + '</div>';
  }).join('');
  [].forEach.call(box.querySelectorAll('button'), function (b) { b.onclick = function () { PHX[b.dataset.k] = +b.dataset.v; phxSync(); }; });
  [].forEach.call(document.querySelectorAll('#phxs button[data-x], #phxPre button'), function (b) { b.onclick = function () { phxSet(b.dataset.x); phxSync(); }; });
  phxShow();
}
function phxSync() { if ((PHX.rig > 0) !== PHYS) setPhys(PHX.rig > 0); phxShow(); }
function phxShow() {
  var lv = phxLevel();
  [].forEach.call(document.querySelectorAll('#phxs button[data-x], #phxPre button'), function (b) { b.className = b.dataset.x === lv ? 'on' : ''; });
  var pb = $('phxB'); pb.textContent = lv === 'custom' ? '自訂（物理設定…）' : '物理設定…'; pb.className = lv === 'custom' ? 'on' : '';
  [].forEach.call(document.querySelectorAll('#phxItems button'), function (b) { b.className = PHX[b.dataset.k] === +b.dataset.v ? 'on' : ''; });
  $('phxLv').textContent = '現在：' + PHX_NAME[lv];
  if (typeof gsetShow === 'function') gsetShow();
}
/** 玩法：娛樂／寫實（04_state.js 的 PLAY）＋主選單按鈕的亮燈。航行每一步都讀（playK）；按鈕在主選單，沒開戰時才按得到。 */
function setPlay(p) { PLAY = p === 'real' ? 'real' : 'fun'; [].forEach.call(document.querySelectorAll('#plays button'), function (x) { x.className = x.dataset.p === PLAY ? 'on' : ''; }); }
/** 選單列船：HULL_LIST 的每一艘。 */
function hullOptions(sel, v) { sel.innerHTML = HULL_LIST.map(function (h) { return '<option value="' + h.id + '">' + h.name + '</option>'; }).join(''); sel.value = v; }
/** 主選單的艦隊編成（TASK-0537）：我方、敵方各一列，每艘一個選單；第二艘起有 ×（拿掉）；＋ 加一艘（照那一邊最後一艘的船型），合計到 MAX_SHIPS 就停用。
 *  我方第一艘 ＝ 我艦。改了就重建這兩列。 */
function fleetUI() {
  var full = FLEET_SET[0].length + FLEET_SET[1].length >= FLEET_MAX;
  [0, 1].forEach(function (s) {
    var box = $('fleet' + s), L = FLEET_SET[s];
    box.innerHTML = L.map(function (id, j) {
      var lab = s === 0 ? (j ? '友艦 ' + j : '我艦') : '敵艦 ' + (j + 1);
      return '<span class="fs"><select data-s="' + s + '" data-j="' + j + '" aria-label="' + lab + '的船" title="' + lab + '"></select>' + (j ? '<button class="fx" data-s="' + s + '" data-j="' + j + '" aria-label="拿掉' + lab + '">×</button>' : '') + '</span>';
    }).join('') + '<button class="fa" data-s="' + s + '" aria-label="' + (s ? '加一艘敵艦' : '加一艘友艦') + '"' + (full ? ' disabled' : '') + '>＋</button>';
    [].forEach.call(box.querySelectorAll('select'), function (el) { hullOptions(el, L[+el.dataset.j]); el.onchange = function () { pickShip(s, +el.dataset.j, el.value); }; });
    [].forEach.call(box.querySelectorAll('button.fx'), function (b) { b.onclick = function () { L.splice(+b.dataset.j, 1); fleetUI(); pickShip(); }; });
    box.querySelector('button.fa').onclick = function () { if (FLEET_SET[0].length + FLEET_SET[1].length < FLEET_MAX) { L.push(L[L.length - 1]); fleetUI(); pickShip(); } };
  });
  var sp = fieldSplit(fleetSpec()), fb = sp.field.filter(function (f) { return f.team === 'blue'; }).length, fr = sp.field.length - fb;   // 開局誰上場（52_fleet.js）
  $('fleetN').textContent = FLEET_SET[0].length + ' 對 ' + FLEET_SET[1].length + (full ? '（編成上限 ' + FLEET_MAX + ' 艘）' : '') +
    (sp.reserve.blue.length || sp.reserve.red.length ? '　⇒ 開局 ' + fb + ' 對 ' + fr + ' 上場，候補 ' + sp.reserve.blue.length + '／' + sp.reserve.red.length + ' 艘（' + REINF_NAMES[REINF_MODE] + '）' : '');
}
/** 主選單換船（s 那一邊第 j 艘換成 id；不給 ⇒ 只是艘數變了）：還沒載的先載（開戰鈕暫時停用），載好就把背景的船換掉；細節設定跟著編輯我艦那一型。 */
function pickShip(s, j, id) {
  if (id) { FLEET_SET[s][j] = id; if (s === 0 && j === 0) CFG_ID = id; }
  var need = fleetHulls().filter(function (h) { return !HULLT[h]; });
  var go = $('go'); go.disabled = true; go.textContent = need.length ? '載入' + hullInfo(need[0]).name + '…' : '編隊中…';
  Promise.all(fleetHulls().map(loadHull)).then(function () {
    if (fleetHulls().some(function (h) { return !HULLT[h]; })) return;     // 又換了一艘、還在載
    go.disabled = false; go.textContent = '開戰';
    if (!RUNNING) reset();                                                  // 選單後面的兩艘換成選到的船
    if (SLIDERS_SHOW) SLIDERS_SHOW();
  }).catch(function (e) { go.textContent = '載不了：' + (e && e.message || e); console.error(e); });
}
sliders(); setPlay(PLAY); setWeather(WX_ID);
[].forEach.call(document.querySelectorAll('#wxs button'), function (b) { b.onclick = function () { setWeather(b.dataset.w); if (SLIDERS_SHOW) SLIDERS_SHOW(); }; });   // 主選單：天氣（08_weather.js）
/** 主選單：同時在場（滑桿 2～MAX_SHIPS，52_fleet.js FIELD_N）；編成超過它的照候補規則進場。 */
function fieldShow() { var f = $('field'); f.value = FIELD_N; $('fieldV').textContent = FIELD_N + ' 艘'; if ($('fleetN')) fleetUI(); }
(function () { var f = $('field'); f.min = 2; f.max = MAX_SHIPS; f.oninput = function () { FIELD_N = Math.round(+f.value); fieldShow(); }; fieldShow(); })();
/** 細節設定：艦隊指揮官（52_fleet.js CMD_SIDE；策略在 53_commander.js）。 */
function cmdShow() { [].forEach.call(document.querySelectorAll('.cmds'), function (row) { [].forEach.call(row.querySelectorAll('button'), function (b) { b.className = b.dataset.c === CMD_SIDE[row.dataset.side] ? 'on' : ''; }); }); }
[].forEach.call(document.querySelectorAll('.cmds'), function (row) { [].forEach.call(row.querySelectorAll('button'), function (b) { b.onclick = function () { CMD_SIDE[row.dataset.side] = b.dataset.c; cmdShow(); }; }); });
cmdShow();
/** 細節設定：候補補位（52_fleet.js REINF_MODE）。 */
function reinfShow() { [].forEach.call(document.querySelectorAll('#reinfs button'), function (b) { b.className = b.dataset.r === REINF_MODE ? 'on' : ''; }); if ($('fleetN')) fleetUI(); }
[].forEach.call(document.querySelectorAll('#reinfs button'), function (b) { b.onclick = function () { REINF_MODE = b.dataset.r; reinfShow(); }; });
reinfShow();
/** 主選單：開局距離（滑桿，04_state.js LIM_DIST）。開局才用 ⇒ 改了下一場生效。 */
function distShow() { var d = $('dist'); d.value = DIST; $('distV').textContent = DIST + ' m（船頭到船頭）'; }
(function () { var d = $('dist'); d.min = LIM_DIST[0]; d.max = LIM_DIST[1]; d.oninput = function () { DIST = Math.round(+d.value); distShow(); }; distShow(); })();
[].forEach.call(document.querySelectorAll('#sails button'), function (b) { b.onclick = function () { setSailMode(b.dataset.s); }; });
[].forEach.call(document.querySelectorAll('#modes button'), function (b) { b.className = b.dataset.m === MODE ? 'on' : ''; });   // 模式的預設照設定檔（menu.mode）
setSailMode(SAIL); setCamTrack(true); $('physT').classList.toggle('on', PHYS);
$('go').onclick = start;
$('endC').onclick = function () { $('end').className = ''; };
$('endR').onclick = function () { RUNNING = false; $('end').className = ''; $('cover').style.display = ''; };

