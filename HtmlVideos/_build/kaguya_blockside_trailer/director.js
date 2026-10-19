// ───────────────────────── 宣傳片導演（kaguya，2026-10-18；ArtGallery/HtmlVideos/_build/kaguya_blockside_trailer） ─────────────────────────
// 這一段只活在宣傳片那份複製裡：splice.py 把它插在遊戲閉包的結尾前（同一個閉包 ⇒ 看得到 SHIPS、simStep、reset……）。遊戲本體不帶它。
// 畫面 ＝ 片長時間 t 的純函數（HTML_VIDEO_WORKFLOW.md ②）：
//   · 每一幕 ＝ 固定的開局（種子、風、天氣、船型、位置）＋ 固定步長（DT）的模擬；亂數全走遊戲的 rngMake（reset() 重設）。
//   · 看第 t 秒 ⇒ 那一幕從開局走 n ＝ floor(τ / DT) 步（τ ＝ 那一幕的模擬秒數，慢動作照 rate 換算）⇒ 照 t 算的鏡頭畫。
//   · 播放中 ⇒ 接著走；換幕（或測試用的 ?t=）⇒ 重開那一幕再走（播放器沒有拖曳的時間軸：只往前播、播完重播）（同一頁 reset() 走同一條路：同一個開局量三次雜湊相同）。
//   · 會跟著鏡頭或畫面時間走的東西先關掉：遠方帆繩降級（rigfar）、碎木依鏡頭淘汰（DEB_CAP）、3D 雨、門的動畫、殉爆慢動作、物理減速、艙內水面的時間混合。
// 走不完（重的一幕、剛拖過去）⇒ 時鐘停在走得到的那一步（畫面一律是 F(t)，只是播得比真實慢），右上角寫「準備中」。
// 聲音：按下播放才建（使用者手勢）；模擬裡的砲聲、碎裂聲只在播放中、從上一格到這一格之間的那幾步發出（快轉時不出聲）；配樂照時間軸即時排程（audio.js：往前排 1.5 秒；暫停、跳時間、重播 ⇒ 從新的 t 重排）。

var TR_W = 1280, TR_H = 720, TR_FOV = 0.9;
if (Q.get('res') === '1080') { TR_W = 1920; TR_H = 1080; }
var TR = {
  S: [], DUR: 0, t: 0, last: 0, playing: false, buffering: false, ready: false, still: Q.get('still') === '1',
  cur: -1, k: 0, place: null, live: false, loadN: 0, loadAll: 0, loadName: '', err: null,
  framed: (function () { try { return window.self !== window.top; } catch (e) { return true; } })(),
  wantT: Q.has('t') ? Math.max(0, parseFloat(Q.get('t')) || 0) : null, drawnT: -1
};
var TR_LATEST = 'https://tim099.github.io/Blockside/';

if (TRAILER) {
  document.body.classList.add('trailer');
  gfxSet(GFX_PRESET[Q.get('gfx')] ? Q.get('gfx') : 'high');
  GFX.drops = 0; GFX.dropspl = 0; GFX.fall = 0; GFX.door = 0; GFX.rain = 2; GFX.shships = MAX_SHIPS;
  PHX.rigfar = 0; PHX.sailhit = 0;
  SLOW.on = false; SLOW.cam = false; PSLOW.on = false; SIM_SPEED = 1;
  DEB_CAP = Infinity; FL_SNAP = true; ERR_HOOK = null; STILL = true;
  COL_ON = false;                                                       // 陣營旗（藍、紅）不加：十世紀的持火號掛藍色艦旗不對；各船自己的旗照作品
  evOff('sfx', sfxPlay); evOn('sfx', function (k, at, v) { if (TR.live && k !== 'thunder') sfxPlay(k, at, v); }, 0, true);
}

// ── 小工具 ──
function trClamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function trSmooth(a, b, x) { var u = trClamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); }
function trMix(a, b, u) { return a + (b - a) * u; }
function trMixV(a, b, u) { return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; }
/** 關鍵格內插：K ＝ [[u, 值], …]（u 遞增），值是數或 3 維向量；兩格之間 smoothstep。 */
function trKey(K, u) {
  if (u <= K[0][0]) return K[0][1];
  for (var i = 1; i < K.length; i++) if (u <= K[i][0]) {
    var w = trSmooth(K[i - 1][0], K[i][0], u), a = K[i - 1][1], b = K[i][1];
    return typeof a === 'number' ? trMix(a, b, w) : trMixV(a, b, w);
  }
  return K[K.length - 1][1];
}
/** 船上一點（m；船的座標：x 往船頭、y 往上、z 往右舷，原點 ＝ 船心）⇒ 世界座標。 */
function trOnShip(sh, x, y, z) {
  var c = shipCenter(sh), f = fwd(sh.yaw), r = [-f[2], 0, f[0]];          // r：右舷（船頭往前、右手邊）
  return [c[0] + f[0] * x + r[0] * z, c[1] + y, c[2] + f[2] * x + r[2] * z];
}
/** 繞著 c 的軌道鏡頭：方位角 az（世界，0 ＝ +x）、仰角 el、距離 d。 */
function trOrbit(c, az, el, d) { return [c[0] + Math.cos(az) * Math.cos(el) * d, c[1] + Math.sin(el) * d, c[2] + Math.sin(az) * Math.cos(el) * d]; }
/** 船頭方向的方位角（世界）：fwd(yaw) ＝ [cos yaw, 0, −sin yaw] ⇒ atan2(−sin, cos) ＝ −yaw。 */
function trAzOf(sh) { return -sh.yaw; }

// ── 時間軸 ──
/** 加一幕。sc：{ dur, seed, wx, wind:[度, 倍], fleet:[{team, hull, x, z, yaw, hold, sail, tele}], mode, rig, flood, pre（開幕時模擬已經走了幾秒）, rate（模擬秒／片長秒）,
 *  cues:[{at: 模擬秒, fn(S)}], cam(u, τ, S) ⇒ {eye, look, fov}, look（只改畫面的天色）, sun, cut, fx(push, τ, S), cap(g, u, sc) } */
function trAdd(sc) { sc.i = TR.S.length; sc.t0 = TR.DUR; TR.DUR += sc.dur; sc.rate = sc.rate || 1; sc.pre = sc.pre || 0; TR.S.push(sc); return sc; }
function trSceneIx(t) { for (var i = 0; i < TR.S.length; i++) if (t < TR.S[i].t0 + TR.S[i].dur) return i; return TR.S.length - 1; }
/** 片長 t ⇒ 那一幕、模擬秒 τ、要走到第幾步 n、兩步之間的比例 a。 */
function trAt(t) {
  var i = trSceneIx(t), sc = TR.S[i], u = Math.min(sc.dur, Math.max(0, t - sc.t0)), tau = sc.pre + u * sc.rate;
  var n = Math.floor(tau / DT + 1e-6);
  return { i: i, sc: sc, u: u, tau: tau, n: n, a: Math.min(1, Math.max(0, tau / DT - n)) };
}
/** 第 i 幕走到第 k 步時，片長是幾秒（時鐘停在走得到的那一步時用）。 */
function trTimeOfStep(sc, k) { return sc.t0 + Math.max(0, (k * DT - sc.pre) / sc.rate); }

// ── 開一幕（跟擬真沙盒 flabSetup 同一條：照參數設好全域 ⇒ reset）──
var trSpawn0 = spawnFleet;
spawnFleet = function (spec) {
  trSpawn0(spec);
  if (!TRAILER || !TR.place) return;
  TR.place.forEach(function (p, i) {
    var sh = SHIPS[i]; if (!sh || p.x === undefined) return;
    sh.px = p.x; sh.pz = p.z; sh.yaw = p.yaw;
    sh.M = shipMatrix(sh); sh.inv = M4.inv(sh.M);                         // ⛔ 不重算 ⇒ 第一步的內插從預設的位置滑過來
  });
};
// 撞船那一幕（sc.fleet[].ram）：艦長不讓船、直直對著敵艦開（遊戲的艦長會轉舷側對敵、讓船 ⇒ 撞不上）
var trHelm0 = helmSteer, trFriendAv0 = friendAvoid, trFoeAv0 = foeAvoid;
helmSteer = function (sh, foe) {
  if (TRAILER && sh.trRam && foe) return { yaw: Math.atan2(-(foe.pz - sh.pz), foe.px - sh.px), v: null };
  return trHelm0(sh, foe);
};
friendAvoid = function (sh, L, T) { return TRAILER && sh.trRam ? null : trFriendAv0(sh, L, T); };
foeAvoid = function (sh) { return TRAILER && sh.trRam ? null : trFoeAv0(sh); };
var TR_PHX0 = null;
function trSetup(sc) {
  if (!TR_PHX0) TR_PHX0 = Object.assign({}, PHX);
  SEED = (sc.seed || 1797) >>> 0;
  WIND_FIX = { rot: sc.wind ? sc.wind[0] : 0, s0: sc.wind ? sc.wind[1] : 1 };   // ⛔ 兩個鍵都要給（少一個 ⇒ 風是 NaN）
  setWeather(sc.wx || 'clear');
  DT = 1 / 60; DIST = sc.dist || 140; FLEET_GAP = sc.gap || 70;
  CMD_SIDE.blue = sc.cmd ? sc.cmd[0] : 'free'; CMD_SIDE.red = sc.cmd ? sc.cmd[1] : 'free'; CMD_GAUGE.blue = CMD_GAUGE.red = false;
  FLEET_DBG = sc.fleet.map(function (f) { return { team: f.team, hull: f.hull }; });
  FIELD_N = Math.max(2, FLEET_DBG.length);
  for (var k in TR_PHX0) PHX[k] = TR_PHX0[k];
  PHX.rigfar = 0; PHX.sailhit = 0;
  if (sc.phx) for (k in sc.phx) PHX[k] = sc.phx[k];
  setPhys(PHX.rig > 0);
  TR.place = sc.fleet;
  flowMode(sc.mode || 'sandbox'); reset(); setAutoFire(!!sc.autoFire);
  flowRun(true); flowPause(false); OVER = false;
  SHIPS.forEach(function (sh, i) {
    var f = sc.fleet[i]; if (!f) return;
    if (f.hold) { sh.aiWait = sh.aiWait2 = Infinity; }
    if (f.sail !== undefined) { sh.sailSet = f.sail; applySailSet(sh); }
    if (f.tele !== undefined && sh.cfg.base > 0) { sh.tele = f.tele; sh.power = TELE[f.tele]; sh.teleHand = true; }
  });
  SHIPS.forEach(function (sh, i) { var f = sc.fleet[i]; sh.trRam = !!(f && f.ram); });
  SHIPS.forEach(function (sh) { sh.portWant = sc.portWant === undefined ? 1 : sc.portWant; });   // 砲門（TASK-0719，62_ports.js）：預設開著（＝ 低畫質的樣子）⇒ 遊戲照交戰自己開關的那一套不會讓 ?t= 跳到的一格跟順著播的不一樣
  CUTV.half = !!(sc.cut && sc.cut.half); CUTV.deck = sc.cut && sc.cut.deck || 0; FLX3 = !!sc.xray;
  TR.cur = sc.i; TR.k = 0; TR.cue = 0;
  if (sc.setup) sc.setup(SHIPS);
}
/** 走到第 i 幕的第 n 步；budget（毫秒）用完就先停（回 false）。 */
function trStepTo(i, n, budget) {
  var sc = TR.S[i];
  if (TR.cur !== i || n < TR.k) { var live = TR.live; TR.live = false; trSetup(sc); TR.live = live; }
  var t0 = performance.now(), cues = sc.cues || [];
  while (TR.k < n) {
    while (TR.cue < cues.length && Math.round(cues[TR.cue].at / DT) <= TR.k) { cues[TR.cue].fn(SHIPS, sc); TR.cue++; }
    simStep(); TR.k++;
    if (budget && performance.now() - t0 > budget) return TR.k >= n;
  }
  return true;
}

// ── 畫一格 ──
function trResize() { if (cv.width !== TR_W || cv.height !== TR_H) { cv.width = TR_W; cv.height = TR_H; } camSize(TR_W, TR_H); return true; }
function trCam(c) {
  var fov = c.fov || 0.9; TR_FOV = fov;
  var pr = M4.persp(fov, CAM.w / CAM.h, 0.5, 6000), vp = M4.mul(pr, M4.lookAt(c.eye, c.look, [0, 1, 0]));
  camSet({ mode: 0, track: false, follow: null, see: null, trMe: null, trYaw: null, eye: c.eye, look: c.look, tgt: c.look.slice(), vp: vp, inv: M4.inv(vp) });
}
var trHalo0 = lanternHalo;
lanternHalo = function (push) { trHalo0(push); if (TRAILER && TR.fxNow) TR.fxNow(push); };
function trDraw(A) {
  var sc = A.sc, look = sc.look, keep = null, sun0 = SUN;
  remesh(Infinity);
  renderLerp(true, A.a);
  trResize();
  trCam(sc.cam(A.u, A.tau, SHIPS, sc));
  SSLOTS = []; MSLOTS = [];
  if (look) { keep = { sky: SKY, hor: HORIZON, gr: GROUND, fog: WX.fog, sun: WX.sun, lum: WX.lum, foam: WX.foam };
    var L = typeof look === 'function' ? look(A.u, A.tau) : look;
    if (L.sky) SKY = L.sky; if (L.horizon) HORIZON = L.horizon; if (L.ground) GROUND = L.ground;
    if (L.fog !== undefined) WX.fog = L.fog; if (L.sun !== undefined) WX.sun = L.sun; if (L.lum !== undefined) WX.lum = L.lum; if (L.foam !== undefined) WX.foam = L.foam;
    if (L.sunDir) SUN = L.sunDir; }
  TR.fxNow = sc.fx ? function (push) { sc.fx(push, A.u, A.tau, SHIPS, sc); } : null;
  if (typeof portsAnim === 'function') { portsAnim(); if (sc.ports) trPorts(sc.ports, A.tau); }   // 砲門的演出在畫面那一格（遊戲 90_main.js 也是）
  render();
  TR.fxNow = null;
  // 指示線的那一點：船的位置還在內插（跟畫面同一刻）時投影
  TR.marks = (sc.marks || []).map(function (mk) { var w = null; try { w = mk.at(SHIPS); } catch (e) { w = null; } return Object.assign({}, mk, { s: w ? trProject(w) : null }); });
  if (keep) { SKY = keep.sky; HORIZON = keep.hor; GROUND = keep.gr; WX.fog = keep.fog; WX.sun = keep.sun; WX.lum = keep.lum; WX.foam = keep.foam; SUN = sun0; }
  renderLerp(false);
}

/** 砲門那一幕：每片蓋板的開合照這一幕的模擬秒 τ 直接算（o ＝ { open, close, until }：開門、關門的 τ；until 之後不管，交給遊戲），⛔ 不靠 portsAnim 一格一格累積 ⇒ 同一個 t 同一格。
 *  段落與秒數照遊戲（62_ports.js：掀蓋 PORT_UP、推砲 PORT_RUN、收砲 PORT_IN、放蓋 PORT_DOWN、從船頭往船尾每片晚 PORT_RANK）；砲的後座、裝填照模擬（portLoad）。 */
function trPorts(o, tau) {
  if (o.until !== undefined && tau >= o.until) return;                  // 之後交給遊戲（62_ports.js：交戰開、砲口入水關）
  SHIPS.forEach(function (sh) {
    if (!sh.ports) return;
    sh.ports.L.forEach(function (P) {
      if (P.gone || P.dead) return;
      var t1 = o.open + P.rank * PORT_RANK, t2 = o.close + P.rank * PORT_RANK;
      function opening(x) { return x <= 0 ? 0 : x < PORT_UP ? x / PORT_UP : Math.min(2, 1 + (x - PORT_UP) / PORT_RUN); }
      var s = opening(Math.min(tau, t2) - t1);
      if (tau > t2) {
        s = Math.min(s, 1 + Math.max(0, s - 1) * portLoad(P.g));         // 砲已經在裡面（剛開過火、在裝填）⇒ 直接放蓋
        var x = tau - t2, pull = Math.max(0, s - 1) * PORT_IN;
        s = x < pull ? s - x / PORT_IN : Math.max(0, Math.min(1, s) - (x - pull) / PORT_DOWN);
      }
      P.s = s; portPose(P);
    });
  });
}

// ── 每一格（主迴圈 frame() 在預告片模式整格交給這裡）──
// 時鐘：播放中照真實時間走（配樂不斷）；
//   · 換幕那一格要重開一局＋預跑（0.1–0.5 秒，藏在切鏡的黑場裡）⇒ 下一格照實際過去的時間往前跳（跳過的是黑場）；
//   · 其他的長格（背景載船卡住主執行緒、模擬跟不上）⇒ 時鐘不跳、停在走得到的那一步，配樂從那一秒重接（TR.resync）。
//   · 序幕（sc.free：沒有船、沒有模擬）⇒ 長格照真實時間跳（最多 1.5 秒）—— 第一幕的船就是在這時候背景載的。
function trFrame(ts) {
  if (!TR.ready) { trUI(); return; }
  var dt = TR.last ? (ts - TR.last) / 1000 : 0; TR.last = ts;
  var free = TR.S[trSceneIx(TR.t)].free;                                // 序幕（沒有船、沒有模擬）：長格照真實時間跳過去（背景載船卡住的那一下只是畫面頓一下，字幕與配樂照走）
  if (free && dt > 0.25) dt = Math.min(dt, 1.5);
  else if (dt > 0.25 && !(TR.cutStall && dt < 0.75)) { dt = 1 / 60; if (TR.playing) TR.resync = true; }
  TR.cutStall = false;
  var t = TR.t;
  if (TR.playing && !TR.waitLoad) t = Math.min(TR.DUR, t + dt);
  var A = trAt(t), prevT = TR.t;
  TR.waitLoad = false;
  if (!trSceneLoaded(A.i)) {                                            // 這一幕的船還沒載好 ⇒ 停在上一幕的最後一格（黑場）
    TR.waitLoad = true;
    if (!TR.playing) { TR.buffering = true; trUI(); return; }             // 停著（剛拖過去）⇒ 時間留在要看的那一秒，載好再畫
    TR.resync = true;
    t = Math.max(0, Math.min(t, A.sc.t0 - 1e-3)); A = trAt(t);
    if (!trSceneLoaded(A.i)) { trUI(); return; }
  }
  TR.live = TR.playing && !TR.resync;
  var cut = TR.cur !== A.i || A.n < TR.k;
  var done = trStepTo(A.i, A.n, TR.still ? 0 : 28);
  TR.live = false;
  if (cut && TR.playing) TR.cutStall = true;
  if (!done) { t = trTimeOfStep(A.sc, TR.k); A = trAt(t); TR.buffering = true; if (TR.playing) TR.resync = true; } else TR.buffering = TR.waitLoad;
  TR.t = t;
  if (TR.playing && TR.resync && !TR.buffering && !TR.waitLoad) { TR.resync = false; trMusicAt(t); }
  else if (TR.playing && TR.resync) trMusicStop();
  if (TR.playing) trAudioTick(prevT, t);
  if (TR.drawnT !== t || TR.dirty) { trDraw(A); TR.drawnT = t; TR.dirty = false; }
  trOverlay(t, A);
  if (TR.playing && t >= TR.DUR) trPause(true);
  trUI();
  if (TR.wantT !== null && !TR.buffering && Math.abs(t - TR.wantT) < 1e-6) { window.__trReady = true; document.title = 'READY ' + t.toFixed(2); }
}

// ── 測試入口（?debug=1 才有）：拖到某一秒、讀戰局雜湊（反向對照「同一個 t 同一格」用）──
function trHash() {
  var s = 'k' + TR.k + 'i' + TR.cur + 'b' + BALLS.length + 'p' + PIECES.length + 'd' + D.n + 'pt' + PT.n;
  SHIPS.forEach(function (sh) { s += '|' + sh.px.toFixed(4) + ',' + sh.pz.toFixed(4) + ',' + sh.yaw.toFixed(5) + ',' + sh.grid.count + ',' + (sh.sink || 0).toFixed(4) + ',' + (sh.hits || 0) + ',' + (sh.dead || 0); });
  var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
if (TRAILER && DEBUG) window.__tr = {
  seek: function (t) { trSeek(t); var A = trAt(TR.t); trStepTo(A.i, A.n, 0); trDraw(A); TR.drawnT = TR.t; return { t: TR.t, i: A.i, k: TR.k, hash: trHash() }; },
  hash: trHash, state: function () { return { t: TR.t, cur: TR.cur, k: TR.k, playing: TR.playing, buffering: TR.buffering, ready: TR.ready, dur: TR.DUR }; },
  scenes: function () { return TR.S.map(function (s) { return { i: s.i, t0: s.t0, dur: s.dur, id: s.id || '' }; }); },
  setupCost: function (only) { return TR.S.filter(function (sc) { return only === undefined || sc.i === only; }).map(function (sc) { var t0 = performance.now(); trSetup(sc); var t1 = performance.now(), n = Math.floor(sc.pre / DT + 1e-6); for (var k = 0; k < n; k++) { simStep(); TR.k++; } var t2 = performance.now(), m = Math.round(1 / DT); for (k = 0; k < m; k++) { simStep(); TR.k++; } var t3 = performance.now();
    return { id: sc.id, reset: Math.round(t1 - t0), pre: Math.round(t2 - t1), sec1: Math.round(t3 - t2), ships: SHIPS.length }; }); },
  timeSteps: function (i, sec) { var sc = TR.S[i]; trSetup(sc); var t0 = performance.now(), n = Math.round(sec / DT); for (var k = 0; k < n; k++) { simStep(); TR.k++; } return { ms: performance.now() - t0, perSimSec: (performance.now() - t0) / 1000 / sec }; },
  ships: function () { return SHIPS.map(function (s) { return { name: s.name, id: s.T.id, x: +s.px.toFixed(1), z: +s.pz.toFixed(1), yaw: +s.yaw.toFixed(3), spd: +(s.spd || 0).toFixed(2), sink: +(s.sink || 0).toFixed(2), count: s.grid.count, hits: s.hits }; }); },
  ev: function (src) { return eval(src); }   // 除錯：在遊戲閉包裡求值（只在 ?debug=1）
};

// ── 開機：照時間軸把要用到的船型載好 ──
function trHulls(onlyI) {
  var L = [];
  TR.S.forEach(function (sc, i) { if (onlyI !== undefined && i !== onlyI) return; sc.fleet.forEach(function (f) { if (L.indexOf(f.hull) < 0) L.push(f.hull); }); });
  return L;
}
// 分散載入（Tim 2026-10-18：「如果是在演出過程中載入呢」「第一幕用到的船開頭載入 第一幕時載入第二幕用到的船」）：
//   開頭只載第一幕的船 ⇒ ▶ 就能按；其他的照出場順序在背景一艘一艘載（一路往前載，不等）。
//   播到某一幕、它的船還沒載好 ⇒ 時鐘停在上一幕最後一格（黑場）、配樂停，右上角寫「載入船隻…」；載好從同一秒接著播。
//   ?t=（縮圖、驗收）⇒ 只載那一幕的船。
function trSceneLoaded(i) { return TR.S[i].fleet.every(function (f) { return !!HULLT[f.hull]; }); }
function trBoot() {
  trWire();
  if (DEBUG) (function gap(prev) { requestAnimationFrame(function (ts) { if (prev && ts - prev > 50) (TR.gapLog = TR.gapLog || []).push([Math.round(ts), Math.round(ts - prev), TR.loadName, TR.loadN]); gap(ts); }); })(0);   // 量：長格（> 50 ms）在載哪一艘時出現
  trScenes();
  var only = TR.wantT !== null ? trSceneIx(Math.min(TR.wantT, TR.DUR)) : undefined;
  var L = trHulls(only), first = trHulls(only === undefined ? 0 : only);
  TR.loadAll = L.length; TR.loadN = 0;
  if (!first.length) trReady();                                          // 序幕沒有船 ⇒ 引擎好了就能播，持火號在序幕放映時背景載（Tim 2026-10-19）
  hullSay = function (s) { TR.loadStep = s; trUI(); };
  L.reduce(function (p, id) {
    var t0;
    return p.then(function () { TR.loadName = (hullInfo(id) || {}).name || id; trUI(); t0 = performance.now(); return loadHull(id); }).then(function () {
      TR.loadN++; (TR.loadLog = TR.loadLog || []).push([id, Math.round(performance.now() - t0)]);   // 每艘從開始載到載好幾毫秒（?debug=1：__tr.ev('TR.loadLog')）
      if (!TR.ready && first.every(function (h) { return !!HULLT[h]; })) trReady();
      trUI();
      return new Promise(function (r) { setTimeout(r, 0); });              // 讓一格畫面出去再載下一艘
    });
  }, Promise.resolve()).then(function () { TR.loadDone = true; if (!TR.ready) trReady(); trUI(); })
    .catch(function (e) { TR.err = String(e && e.message || e); console.error(e); trUI(); });
}
function trReady() {
  TR.ready = true;
  if (TR.wantT !== null) { TR.t = Math.min(TR.wantT, TR.DUR); TR.wantT = TR.t; }
  trMusicPrep();
}
