// ───────────────────────── 宣傳片導演（kaguya，2026-10-18；ArtGallery/HtmlVideos/_build/kaguya_blockside_trailer） ─────────────────────────
// 這一段只活在宣傳片那份複製裡：splice.py 把它插在遊戲閉包的結尾前（同一個閉包 ⇒ 看得到 SHIPS、simStep、reset……）。遊戲本體不帶它。
// 畫面 ＝ 片長時間 t 的純函數（HTML_VIDEO_WORKFLOW.md ②）：
//   · 每一幕 ＝ 固定的開局（種子、風、天氣、船型、位置）＋ 固定步長（DT）的模擬；亂數全走遊戲的 rngMake（reset() 重設）。
//   · 看第 t 秒 ⇒ 那一幕從開局走 n ＝ floor(τ / DT) 步（τ ＝ 那一幕的模擬秒數，慢動作照 rate 換算）⇒ 照 t 算的鏡頭畫。
//   · 播放中 ⇒ 接著走；換幕（或測試用的 ?t=）⇒ 重開那一幕再走（播放器沒有拖曳的時間軸：只往前播、播完重播）（同一頁 reset() 走同一條路：同一個開局量三次雜湊相同）。
//   · 會跟著鏡頭或畫面時間走的東西先關掉：遠方帆繩降級（rigfar）、碎木依鏡頭淘汰（DEB_CAP）、3D 雨、門的動畫、殉爆慢動作、物理減速、艙內水面的時間混合。
// 走不完（重的一幕、剛拖過去）⇒ 落後 TR_LAG 秒以內：時鐘照走、先畫算到的那一刻，下一格補；更久 ⇒ 時鐘停在走得到的那一步（畫面一律是 F(t)，只是播得比真實慢），右上角寫「準備中」。
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
 *  lead（開頭幾秒是黑底字卡：模擬停在 pre、預跑分到這幾格做；over 畫字卡）,
 *  cues:[{at: 模擬秒, fn(S)}], cam(u, τ, S) ⇒ {eye, look, fov}, look（只改畫面的天色）, sun, cut, fx(push, τ, S), cap(g, u, sc), over(g, u)（壓在黑場上面的字） } */
function trAdd(sc) { sc.i = TR.S.length; sc.t0 = TR.DUR; TR.DUR += sc.dur; sc.rate = sc.rate || 1; sc.pre = sc.pre || 0; sc.lead = sc.lead || 0; TR.S.push(sc); return sc; }
function trSceneIx(t) { for (var i = 0; i < TR.S.length; i++) if (t < TR.S[i].t0 + TR.S[i].dur) return i; return TR.S.length - 1; }
// 慢動作（sc.warp；Tim 2026-10-19：「爆炸部分會lag & 破音(殉爆特別嚴重)」「火藥庫可以參考遊戲 用慢動作」）：
//   sc.warp ＝ [[v, 倍率], …]：v ＝ 字卡之後的片長秒，兩格之間倍率線性變；同一個 v 給兩格 ⇒ 那一刻直接跳過去（殉爆那一下）。τ(v) ＝ pre ＋ ∫ 倍率 dv。
//   遊戲的殉爆慢動作（73_slowmo.js）：模擬一步照舊 DT，只是每格畫面走得少；碎木、火光、煙、水花改成每格照「畫面的 dt × 倍率」走（SLOW_VIS、slowVisStep）—— ⛔ 留在模擬步上 ⇒ 0.1 倍時十格才動一下。
//   這裡照同一套做，只是「每格畫面」換成固定的 TR_Q 片長秒（一個「格位」）⇒ 同一個 t 同一格（?t= 跟順著播走同一串格位）：
//   有 warp 的幕，TR.k 數的是「預跑的模擬步（pre）＋ 之後的格位」；真的模擬步另外數在 TR.sk（cues 照它）。
var TR_Q = 1 / 30;
var TR_LAG = 0.75;                                                      // 模擬短暫落後時鐘多少秒以內不停錶（trFrame）
function trRate(sc, v) {
  var W = sc.warp; if (v <= W[0][0]) return W[0][1];
  for (var i = 1; i < W.length; i++) if (v < W[i][0]) { var a = W[i - 1], b = W[i]; return a[1] + (b[1] - a[1]) * (v - a[0]) / (b[0] - a[0]); }
  return W[W.length - 1][1];
}
function trTau(sc, v) {
  if (!sc.warp) return sc.pre + v * sc.rate;
  var W = sc.warp, s = sc.pre, x = 0;
  if (v <= W[0][0]) return s + v * W[0][1];
  s += W[0][0] * W[0][1]; x = W[0][0];
  for (var i = 1; i < W.length && x < v; i++) {
    var b = Math.min(v, W[i][0]); if (b <= x) continue;
    s += (b - x) * (trRate(sc, x + 1e-9) + trRate(sc, b - 1e-9)) / 2; x = b;   // 兩格之間線性 ⇒ 梯形
  }
  if (x < v) s += (v - x) * W[W.length - 1][1];
  return s;
}
function trPreSteps(sc) { return Math.floor(sc.pre / DT + 1e-6); }
/** 片長 t ⇒ 那一幕、模擬秒 τ、要走到第幾步 n（有 warp ＝ 第幾個格位）、兩步之間的比例 a。 */
function trAt(t) {
  var i = trSceneIx(t), sc = TR.S[i], u = Math.min(sc.dur, Math.max(0, t - sc.t0)), v = Math.max(0, u - sc.lead), tau = trTau(sc, v), n, a;
  if (sc.warp) {
    var j = Math.floor(v / TR_Q + 1e-6), s = Math.floor(trTau(sc, j * TR_Q) / DT + 1e-6);   // 走完第 j 個格位 ⇒ 模擬走到第 s 步
    n = trPreSteps(sc) + j; a = tau / DT - s;
  } else { n = Math.floor(tau / DT + 1e-6); a = tau / DT - n; }
  return { i: i, sc: sc, u: u, tau: tau, n: n, a: Math.min(1, Math.max(0, a)) };
}
/** 第 i 幕走到第 k 步（有 warp ＝ 第 k 個格位）時，片長是幾秒（時鐘停在走得到的那一步時用）。 */
function trTimeOfStep(sc, k) {
  if (sc.warp) return sc.t0 + sc.lead + Math.max(0, k - trPreSteps(sc)) * TR_Q;
  return sc.t0 + sc.lead + Math.max(0, (k * DT - sc.pre) / sc.rate);
}

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
// 擱淺那一幕（sc.fleet[].noAvoid）：艦長不避淺（遊戲的艦長看到前面淺就轉開 ⇒ 開不上礁；54_helm.js bedAvoid）
var trBedAv0 = bedAvoid;
bedAvoid = function (sh) { return TRAILER && sh.trNoAvoid ? null : trBedAv0(sh); };
// ── 海圖（sc.map ＝ { area, at: [往東, 往南]（海域座標，m）＝ 世界原點 }；Tim 2026-10-19：「是否可以讓影片中包含Blocksail的沿岸地形」「可以只匯入一小部分要用到的海圖」）──
//   資料：splice.py 從 maps/<海域>/ 內嵌成 TR_MAPS（只放要用的那幾塊；沒放的當深海）。遊戲平常是 <script> 一塊塊背景載、跟著船換中心（08_seabed.js bedFocus）、
//   遠景在背景讀（63_bed_gl.js bedFarStep）、網格一格只建 2 塊 ⇒ 都不是 t 的函數。這裡改成：開一幕時一口氣解碼全部內嵌的塊、網格全建好，整幕不換、不丟；遠景不讀。
//   ⇒ ?t= 停在換幕那一秒，地形也已經在（同一個 t 同一格）。同一份海圖、同一個原點 ⇒ 第二次直接用（TR_BED）；沒有 sc.map ⇒ BED ＝ null（每一處跟沒有海圖一樣）。
var TR_BED = {};
function trBedOn(m) {
  trTownsAway();
  if (!m) { BED = null; return; }
  var key = m.area + '@' + m.at.join(',');
  if (TR_BED[key]) { BED = TR_BED[key]; trTownsBack(); return; }
  Object.keys(TR_BED).forEach(function (k0) { BED = TR_BED[k0]; Object.keys(BED.ch).forEach(function (k) { var C = BED.ch[k]; evEmit('bedDrop', C.cx, C.cy); }); delete TR_BED[k0]; });   // 網格、樹照塊的編號存 ⇒ 換一份海圖先丟掉舊的
  var src = TR_MAPS[m.area]; if (!src) throw new Error('沒有內嵌海圖：' + m.area);
  var A = JSON.parse(JSON.stringify(src.area)), have = src.chunks;
  A.chunks = A.chunks.map(function (c) { return [c[0], c[1], c[2] && have[bedKey(c[0], c[1])] ? 1 : 0]; });   // 沒內嵌的塊當深海（⛔ 不去讀檔）
  var D = BED = { wantArea: A.id, host: null, ask: {}, A: A, ch: {}, pend: {}, peek: {}, idx: null, top: -Infinity, miss: 0, loads: 0, drops: 0, site: -1 };
  D.G = A.chunk / A.step; D.n = A.n; D.nx = A.x[1] - A.x[0] + 1; D.has = new Uint8Array(D.nx * (A.y[1] - A.y[0] + 1));
  A.chunks.forEach(function (c) { var i = bedIdx(c[0], c[1]); if (i >= 0) D.has[i] = c[2]; });
  D.slot = new Array(D.has.length); D.ax = m.at[0]; D.az = m.at[1]; D.cx = Math.floor(D.ax / A.chunk); D.cy = Math.floor(D.az / A.chunk);
  BEDFAR.todo = [];                                                      // 遠景不讀（要的塊都是細的）
  Object.keys(have).sort().forEach(function (k) { var C = bedDecode(have[k]), i = bedIdx(C.cx, C.cy); D.slot[i] = C; D.ch[k] = C; D.top = Math.max(D.top, C.max); D.loads++; evEmit('bedChunk', C.cx, C.cy, C); });
  while (BEDGL_Q.length) { var k = BEDGL_Q.shift(), C = D.ch[k]; if (C) bedUpload(k, C, bedLod(C)); }   // 網格全建好（⛔ 遊戲一格 2 塊 ⇒ 換幕後幾格地形一塊塊長出來）
  TR_BED[key] = D;
  trTownsBack();
}

// ── 城鎮（海域有城：area.towns；TASK-0750 旱地行舟，Tim 2026-10-28「可以拍旱地行舟了」）──
//   檔案：遊戲照 area.towns 讀 maps/<海域>/towns.js、townkit/（bedScript）⇒ 宣傳片是單檔：splice.py 把要用的那幾個檔內嵌成 TR_FILES，bedScript 先查它（⛔ 不讀外部檔）。
//     TR_FILES 沒有那一個 ⇒ 照舊讀檔（測試：www/maps/<海域>/；量這一幕用到哪幾個模型，見 __tr.townFiles）。
//   一頁幾片海域：遊戲一頁只有一片、城從不收；宣傳片換海域 ⇒ 城的清單收起來（trTownsAway），換回來放回去（trTownsBack）。
//     ⛔ 不收 ⇒ 擱淺那一幕的船撞上看不見的君士坦丁堡碼頭（50_sim.js：有城就跑 quayStep）。
//   城區：遊戲照旗艦遠近、照 performance.now 一區一區補（63_towns.js townDistFrame）⇒ 不是 t 的函數；這裡照這一幕的 sc.townAt（世界；沒寫 ＝ 原點）挑，整幕不換。
//   等：這一幕有城 ⇒ 換進來時時鐘先停、畫面黑著（trFrame），每格照遊戲那一套往前做（收塊、種樹、挑城區；城的實例、地面在 render 裡的 townDraw 建），trTownSettled 才走 ⇒ 同一個 t 同一格。
var TR_TOWNS = {}, TR_FILE_USED = {};
var trScript0 = bedScript;
bedScript = function (src) {
  if (TRAILER && typeof TR_FILES !== 'undefined' && Object.prototype.hasOwnProperty.call(TR_FILES, src)) {
    try { (0, eval)(TR_FILES[src]); } catch (e) { return Promise.reject(e); }
    return Promise.resolve();
  }
  if (TRAILER) TR_FILE_USED[src] = 1;                                   // 測試：讀了哪幾個外部檔（要內嵌的清單）
  return trScript0(src);
};
var trDistWant0 = townDistWant;
townDistWant = function (p, me, town) {
  if (!TRAILER || town) return trDistWant0(p, me, town);
  var a = TR.townAt || [0, 0]; return trDistWant0(p, { px: a[0], pz: a[1] }, false);
};
function trTownsAway() {
  if (!BED || !BED.A || !TOWNS.list.length) return;
  TR_TOWNS[BED.A.id] = TOWNS.list; TOWNS.list = [];
}
function trTownsBack() {
  if (!BED || !BED.A || !(BED.A.towns || []).length) return;
  if (TR_TOWNS[BED.A.id]) { TOWNS.list = TR_TOWNS[BED.A.id]; delete TR_TOWNS[BED.A.id]; return; }
  townWant();                                                            // 第一次：照遊戲那一套去要（bedScript ⇒ TR_FILES）
}
/** 這一格照遊戲的畫面迴圈往前做（90_main.js frame、89_townui.js frame 那幾樣）：收塊、種樹、挑城區。 */
function trTownPump() {
  if (!BED) return;
  BED_BG = BED_PUMP_MS; bedPump(performance.now() + BED_PUMP_MS); treePump();
  if (TOWNS.list.length) townDistFrame();
}
function trTownScene(sc) { var M = sc.map && typeof TR_MAPS !== 'undefined' && TR_MAPS[sc.map.area]; return !!(M && (M.area.towns || []).length); }
/** 等城的那幾格：字幕層整片蓋黑、右上角寫進度（3D 照畫 ⇒ 城照遊戲那一套建）。 */
function trTownCover() {
  if (!trG) return;
  trG.setTransform(1, 0, 0, 1, 0, 0); trG.globalAlpha = 1; trG.fillStyle = '#000'; trG.fillRect(0, 0, TR_CW, TR_CH);
  var n = TOWNS.list.length, w = BED && BED.A ? (BED.A.towns || []).length : 0;
  trText(trG, '載入城鎮… ' + n + '／' + w + (TOWNS.kitBusy ? '　模型' : '') + (TREE_Q.length ? '　樹 ' + TREE_Q.length : ''), TR_CW - 60, 70, '400 24px ' + TR_SANS, '#bdb39d', 0.85, 'right', 1);
}
/** 城建好了沒：規劃到齊、模型解完、每座城要的城區都上了、實例與地面沒有建到一半、路面到了、樹種完。 */
function trTownSettled() {
  if (!BED || !BED.A) return true;
  var want = (BED.A.towns || []).length; if (!want) return true;
  if (TOWNS.err) return true;                                            // 出錯 ⇒ 不等（錯照舊印在主控台）
  if (TOWNS.list.length < want || TOWNS.kitBusy || !TOWNS.kit) return false;
  if (BED.inq && BED.inq.length) return false;
  if (TREE_Q.length || TREES.job) return false;                           // 樹（63_trees.js treePump）：排著的、擺到一半的
  return TOWNS.list.every(function (T) {
    var p = TOWNS.full[T.id];
    if (p && p.cut) { var W = trDistWant0(p, { px: (TR.townAt || [0, 0])[0], pz: (TR.townAt || [0, 0])[1] }, false), on = TOWNS.onD[T.id] || 0; if (W.list.some(function (i) { return !(on & (1 << i)); })) return false; }
    if (!T.inst || T.instRedo || T.ij || T.pend || !T.gt || !T.roadSurface) return false;
    for (var k in T.gt) { var q = T.gt[k]; if (q.dirty || q.job) return false; }
    return true;
  });
}
// ── 旱地行舟（sc.fleet[].haul ＝ { path: [[往東, 往南], …]（海域座標，m）, v: 每秒幾公尺, s0: 第 0 秒船中在路線上第幾公尺, launch: 1 ⇒ 下水之後交回遊戲 }；TASK-0750）──
//   1453 年 4 月 22 日：鄂圖曼艦隊從雙柱（今 Dolmabahçe）翻過佩拉後山拖進金角灣（Barbaro；kotoko-fusta-01m 研究檔 §6）。
//   陸上：照遊戲堡壘那一套站在地上（sh.fixed：不浮、不進水、不擱淺、不碰碼頭；32_hull.js stepShip 照 sh.gy 擺高度）；
//     位置、船頭、前後傾由導演每一步照路線擺（sailShip 之前；照 SIMT ⇒ 同一個 t 同一格）：船頭、船尾都在路線上（長船照軌道轉彎），龍骨那一條線貼著地形 ＋ 托架與滾木。
//   下水（launch）：龍骨那一條線落到浮著的吃水以下 ⇒ fixed 拿掉、照拖的速度往前滑 ⇒ 之後的浮、搖、進水都是遊戲算的。
var TR_HAUL_CLEAR = 0.6;                                                 // 托架＋滾木（研究檔 §6.2：滾輪直徑 0.25–0.3 m、托架縱梁）〔推算〕
function trHaulInit(sh, H, sc) {
  var at = sc.map ? sc.map.at : [0, 0], P = H.path.map(function (q) { return [q[0] - at[0], q[1] - at[1]]; }), cum = [0];
  for (var i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  var T = sh.T;
  return { P: P, cum: cum, L: cum[cum.length - 1], v: H.v || 0.8, s0: H.s0 || 0, launch: !!H.launch, half: (T.wl1 - T.wl0) * S / 2, draft: T.zw * S, land: true };
}
/** 路線上第 s 公尺（夾在兩端）⇒ [x, z]（世界）。 */
function trHaulAt(H, s) {
  s = Math.max(0, Math.min(H.L, s));
  var k = 1; while (k < H.P.length - 1 && H.cum[k] < s) k++;
  var a = H.P[k - 1], b = H.P[k], g = H.cum[k] - H.cum[k - 1], u = g > 1e-6 ? (s - H.cum[k - 1]) / g : 0;
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
}
function trHaulPose(sh) {
  var H = sh.trHaul, s = H.s0 + H.v * SIMT, b = trHaulAt(H, s + H.half), t = trHaulAt(H, s - H.half);
  var dx = b[0] - t[0], dz = b[1] - t[1], len = Math.hypot(dx, dz) || 1, hb = bedHgt(b[0], b[1]), hs = bedHgt(t[0], t[1]), up = 0;
  for (var k = 0; k <= 8; k++) { var u = k / 8; up = Math.max(up, bedHgt(t[0] + dx * u, t[1] + dz * u) - (hs + (hb - hs) * u)); }   // 地形凸出龍骨那一條線多少 ⇒ 整條抬高
  var keel = (hs + hb) / 2 + up + TR_HAUL_CLEAR;                         // 船中那一點龍骨底的高度
  if (H.launch && keel <= -H.draft) {                                    // 下水：龍骨落到浮著的吃水以下 ⇒ 交回遊戲
    H.land = false; sh.fixed = false; sh.spd = H.v; sh.vel = [Math.cos(sh.yaw) * H.v, 0, -Math.sin(sh.yaw) * H.v];
    sh.sailSet = 0; applySailSet(sh);                                    // 帆收起來（⛔ 張著帆、槳照預設全力 ⇒ 一下水就每秒 5.7 m，2026-10-28 量）
    if (sh.cfg.base > 0) { sh.tele = 2; sh.power = TELE[2]; sh.teleHand = true; }   // 槳慢慢划進金角灣
    return;
  }
  sh.yaw = Math.atan2(-dz, dx); sh.pitchA = Math.atan2(hb - hs, len); sh.rollA = 0; sh.pitchW = sh.rollW = 0; sh.bob = 0;
  sh.gy = keel + H.draft + (sh.sink || 0) - (sh.lift || 0);              // 32_hull.js stepShip：wl ＝ gy（10_ship.js shipMatrix 的高 ＝ −sink ＋ lift ＋ wl ＋ bob）
  sh.wl = sh.gy;
  var c = shipCenter(sh), x = (b[0] + t[0]) / 2, z = (b[1] + t[1]) / 2;
  sh.M = shipMatrix(sh); c = shipCenter(sh); sh.px += x - c[0]; sh.pz += z - c[2];
  sh.M = shipMatrix(sh); sh.inv = M4.inv(sh.M); sh.center = shipCenter(sh);
  sh.spd = 0; sh.vel = [0, 0, 0];
}
// 拖船的路不長樹（Barbaro：把佩拉上方的山整座剷平；Doukas：清掉加拉塔後面的灌木）：sc.clear ＝ { path: [[往東, 往南], …]（海域座標）, w: 半寬 m }
//   ⇒ 擺樹的遮罩（63_towns.js townClrOf；63_trees.js 每一塊擺樹前拿一次）再加上路線兩側 w 公尺；每一塊算一次、記在塊上。
var trClrOf0 = townClrOf;
townClrOf = function (C) {
  var M = trClrOf0(C), K = TRAILER && TR.clear;
  if (!K || !BED || !BED.A) return M;
  if (C.trK === K && C.trM0 === M) return C.trM;
  var G = TOWN_CLR_G, size = BED.A.chunk, m = Math.round(size / G), x0 = C.cx * size, z0 = C.cy * size, out = null;
  if (trSegDist(K.path, x0 + size / 2, z0 + size / 2) <= K.w + size) {
    for (var j = 0; j < m; j++) for (var i = 0; i < m; i++) {
      if (trSegDist(K.path, x0 + (i + 0.5) * G, z0 + (j + 0.5) * G) > K.w) continue;
      if (!out) { out = new Uint8Array(m * m); if (M) out.set(M); }
      out[j * m + i] = 1;
    }
  }
  C.trK = K; C.trM0 = M; C.trM = out || M;
  return C.trM;
};
/** 點 (x, z) 到折線 P 的距離。 */
function trSegDist(P, x, z) {
  var best = Infinity;
  for (var i = 1; i < P.length; i++) {
    var a = P[i - 1], b = P[i], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz, u = L2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2)) : 0;
    best = Math.min(best, Math.hypot(x - a[0] - dx * u, z - a[1] - dz * u));
  }
  return best;
}
// 拉縴的人：研究檔 §6.1 Kritovoulos「纜繩綁在四角、交給士兵拉，有的人力直拉、有的用絞盤」、Barbaro「一大群土耳其人拉」
//   ⇒ 每艘在陸上的船，船頭前面兩列（左右兩條纜）各 TR_HAUL_N 人、間距 TR_HAUL_GAP，照船走的路線擺、腳踩地形；拉纜繩 ⇒ 身子比走路前傾。
//   畫法照鎮民（63_towns.js 的城鎮看板：townFolkDraw 畫完城裡的人之後、同一支著色器、同一份人物圖集，另外一批實例）。
//   人物：圖集裡的成年男子那幾款（Blocksail townkit _folk_*）—— 遊戲沒有鄂圖曼士兵的立繪 ⇒ 只代表「一大群人」、不代表衣著〔代演，畫面上寫明〕。
var TR_HAUL_N = 14, TR_HAUL_GAP = 1.3, TR_HAUL_LEAD = 5, TR_HAUL_W = 2.4, TR_HAUL_OUT = [350, 450];
var TR_HAULER_IDS = ['soldier_m_01', 'builder_m_01', 'lumberjack_m_01', 'porter_m_01', 'miner_m_01', 'farmer_m_01', 'shipwright_m_01', 'kilnman_m_01', 'miller_m_01'];
var trFolkDraw0 = townFolkDraw;
townFolkDraw = function (P, K, eye, PL, fogD, clock) {
  var tris = trFolkDraw0(P, K, eye, PL, fogD, clock);
  return TRAILER ? tris + trHaulersDraw(P, K && K.folk, eye, fogD, clock) : tris;
};
function trHaulersDraw(P, F, eye, fogD, clock) {
  if (!F || !P.folk || !SHIPS.some(function (sh) { return sh.trHaul && sh.trHaul.land; })) return 0;
  var L = F.people.filter(function (p) { return TR_HAULER_IDS.indexOf(p.id) >= 0; }); if (!L.length) return 0;
  var SH = F.sheets, A = SH.map(function () { return []; }), n = 0, fw = sub(CAM.look, eye), rl = Math.hypot(fw[0], fw[2]) || 1, rx = -fw[2] / rl, rz = fw[0] / rl;
  SHIPS.forEach(function (sh, si) {
    var H = sh.trHaul; if (!H || !H.land) return;
    var s = H.s0 + H.v * SIMT;
    for (var side = -1; side <= 1; side += 2) for (var k = 0; k < TR_HAUL_N; k++) {
      var d = s + H.half + TR_HAUL_LEAD + k * TR_HAUL_GAP, p = trHaulAt(H, d), q = trHaulAt(H, d + 1), dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1;
      var w = TR_HAUL_W + 0.25 * Math.sin(k * 2.1 + si), x = p[0] - dz / l * side * w, z = p[1] + dx / l * side * w;
      if (Math.hypot(x - eye[0], z - eye[2]) > TR_HAUL_OUT[1]) continue;
      var pc = L[(si * 7 + k * 3 + (side > 0 ? 1 : 0)) % L.length], sheet = SH[pc.sheet]; if (!sheet.tex) continue;
      var face = dx * rx + dz * rz > 0 ? 1 : -1, wv = clock * 0.9 + k * 0.37 + si, r = Math.abs(Math.sin(wv * 6.2832));
      A[pc.sheet].push(x, bedHgt(x, z), z, pc.height * TOWN_FOLK_SCALE * F.ch / F.hpx, 1.03 - 0.03 * r, 0.96 + 0.04 * r, face * (0.16 + 0.03 * Math.sin(wv * 6.2832)), 0.05 * TOWN_FOLK_SCALE * r,
        face > 0 ? 0 : 0.5, pc.row / sheet.rows, face > 0 ? 0.5 : 0, (pc.row + 1) / sheet.rows, pc.cloth[(k + si) % pc.cloth.length], pc.hair[(k * 5 + si) % pc.hair.length], 0.94 + 0.12 * ((k * 7 + si * 3) % 10) / 10, face);
      n++;
    }
  });
  if (!n) return 0;
  var PF = P.folk; gl.useProgram(PF.prog); setCommon(PF);                // 同 townFolkDraw 那一段
  gl.uniform1f(PF.u.uFogD, fogD); gl.uniform3fv(PF.u.uEye, eye); gl.uniform3f(PF.u.uRight, rx, 0, rz);
  gl.uniform2f(PF.u.uIn, -2, -1); gl.uniform2f(PF.u.uOut, TR_HAUL_OUT[0], TR_HAUL_OUT[1]); gl.uniform1i(PF.u.uTex, 11);
  gl.bindVertexArray(P.folkVao); gl.bindBuffer(gl.ARRAY_BUFFER, P.folkBuf);
  A.forEach(function (B, s) {
    if (!B.length) return;
    gl.activeTexture(gl.TEXTURE11); gl.bindTexture(gl.TEXTURE_2D, SH[s].tex); gl.activeTexture(gl.TEXTURE0);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(B), gl.DYNAMIC_DRAW);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, B.length / 16);
  });
  return 2 * n;
}
var trSail1 = sailShip;
sailShip = function (sh, h) { if (TRAILER && sh.trHaul && sh.trHaul.land) trHaulPose(sh); return trSail1(sh, h); };

// ── 金角灣巨鏈（TASK-0750）：遊戲只把規劃裡的 chains 記下來（Blocksail world/town.js，TASK-0748）、不畫 ⇒ 導演畫灣口那一道（sc.chain：兩端 a、b，世界座標 [x, z]）。
//   樣子照 Barbaro（1453 年 4 月 2 日）：粗大的圓木用鐵件頭尾接起來、浮在水上 ⇒ 一根根浮木（碎片的長板形狀繞長軸轉四個角度疊成一根 ≈ 圓木）＋ 兩根之間幾節鐵環（小方塊）。
//   浮木照那一刻的浪高擺（seaH：兩頭的高低差 ⇒ 前後傾）⇒ 跟著浪起伏、同一個 t 同一格；岸上那一段（地面不在水下）鐵鏈沿地面拉到兩端的塔腳。
//   畫法：碎片的著色器 P.deb（方塊實例 ＝ 位置＋大小、四元數、色＋形狀）、自己一份 VAO 與緩衝（⛔ 不動遊戲的 DEBBUF）；掛在 drawCrew 後面 ⇒ 只畫主畫面（不投影、不進反射）。
var TR_CHAIN_LOG = 5.5, TR_CHAIN_GAP = 1.5, TR_CHAIN_LINK = 0.5;         // 浮木長（形狀 3 的長板 4.6 × 0.8 × 0.25 ⇒ ×1.2：寬 0.96 m）、兩根之間的鐵件長、一節鐵環
var TR_CHAIN_WOOD = 68 + 3 * 256, TR_CHAIN_IRON = 36;                    // 色（碎片的 8 位元色：紅 3 位、綠 3 位、藍 2 位）＋形狀（256 以上）：泡過水的深色木頭（長板）、黑鐵（方塊）
//   ⛔ 灰褐（141）：黃昏時跟被夕陽照亮的水面同一個色，150 m 外就看不見（2026-10-28 第一版截到）
var TRCH = { vao: null, buf: null };
function trChainGL() {
  var F = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], V = [], I = [];   // 方塊：同 60_render.js 碎片那一份
  F.forEach(function (n, fi) {
    var a = n[0] ? 0 : n[1] ? 1 : 2, u = (a + 1) % 3, w = (a + 2) % 3;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c) { var p = [0, 0, 0]; p[a] = n[a] * 0.5; p[u] = c[0] * 0.5; p[w] = c[1] * 0.5; V.push(p[0], p[1], p[2], n[0], n[1], n[2]); });
    var b = fi * 4; if (n[a] > 0) I.push(b, b + 1, b + 2, b, b + 2, b + 3); else I.push(b, b + 2, b + 1, b, b + 3, b + 2);
  });
  TRCH.vao = gl.createVertexArray(); gl.bindVertexArray(TRCH.vao);
  var vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(V), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
  var ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(I), gl.STATIC_DRAW);
  TRCH.buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, TRCH.buf);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 36, 0); gl.vertexAttribDivisor(2, 1);
  gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 36, 16); gl.vertexAttribDivisor(3, 1);
  gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 1, gl.FLOAT, false, 36, 32); gl.vertexAttribDivisor(4, 1);
  gl.bindVertexArray(null);
}
/** 四元數相乘（x, y, z, w）：a·b ＝ 先轉 b 再轉 a。 */
function trQMul(a, b) { return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]; }
/** 鏈的那一格實例：（長軸）方位 yq（繞 y）、前後傾 p（繞 z，長軸往上）、繞長軸轉 r。 */
function trChainPut(A, x, y, z, w, yq, p, r, col) {
  var q = trQMul(yq, trQMul([0, 0, Math.sin(p / 2), Math.cos(p / 2)], [Math.sin(r / 2), 0, 0, Math.cos(r / 2)]));
  A.push(x, y, z, w, q[0], q[1], q[2], q[3], col);
}
function trChainDraw() {
  var sc = TR.cur >= 0 ? TR.S[TR.cur] : null, C = sc && sc.chain; if (!C || !P.deb) return;
  var a = C.a, b = C.b, L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, A = [], s, w0 = -1, w1 = -1;
  var yq = [0, Math.sin(Math.atan2(-uz, ux) / 2), 0, Math.cos(Math.atan2(-uz, ux) / 2)];
  function X(s) { return a[0] + ux * s; } function Z(s) { return a[1] + uz * s; }
  for (s = 0; s <= L; s += 1) if (bedHgt(X(s), Z(s)) < -0.8) { if (w0 < 0) w0 = s; w1 = s; }   // 水上那一段（地面在水面 0.8 m 以下）
  if (w0 < 0) return;
  function link(s0, s1, yOf) { for (var t = s0; t < s1; t += TR_CHAIN_LINK) { var m = t + TR_CHAIN_LINK / 2; trChainPut(A, X(m), yOf(m), Z(m), 0.22, yq, 0, 0, TR_CHAIN_IRON); } }
  function ground(s) { var e = Math.min(s, L - s); return Math.max(bedHgt(X(s), Z(s)), seaH(X(s), Z(s), SIMT)) + 0.15 + 1.8 * Math.max(0, 1 - e / 4); }   // 兩端最後 4 m 往上拉到塔腳
  var n = Math.max(1, Math.floor((w1 - w0 - 2 + TR_CHAIN_GAP) / (TR_CHAIN_LOG + TR_CHAIN_GAP))), s0 = w0 + 1 + (w1 - w0 - 2 - (n * (TR_CHAIN_LOG + TR_CHAIN_GAP) - TR_CHAIN_GAP)) / 2;
  link(0, s0, ground);
  for (var i = 0; i < n; i++) {
    var p0 = s0 + i * (TR_CHAIN_LOG + TR_CHAIN_GAP), p1 = p0 + TR_CHAIN_LOG, m = (p0 + p1) / 2, h0 = seaH(X(p0), Z(p0), SIMT), h1 = seaH(X(p1), Z(p1), SIMT), pt = Math.atan2(h1 - h0, TR_CHAIN_LOG);
    for (var k = 0; k < 4; k++) trChainPut(A, X(m), (h0 + h1) / 2 + 0.05, Z(m), TR_CHAIN_LOG / 4.6, yq, pt, k * Math.PI / 4, TR_CHAIN_WOOD);   // 浮木：中心比水面高一點（露出一大半，遠看才看得出一根根）
    if (i < n - 1) link(p1, p1 + TR_CHAIN_GAP, function (t) { var q = (t - p1) / TR_CHAIN_GAP; return seaH(X(t), Z(t), SIMT) - 0.1 - 0.25 * Math.sin(q * Math.PI); });   // 兩根之間的鐵件：往下垂一點
  }
  link(s0 + n * (TR_CHAIN_LOG + TR_CHAIN_GAP) - TR_CHAIN_GAP, L, ground);
  if (!TRCH.vao) trChainGL();
  var PD = P.deb, cf = gl.isEnabled(gl.CULL_FACE);
  gl.useProgram(PD.prog); setCommon(PD); gl.disable(gl.CULL_FACE);
  gl.bindVertexArray(TRCH.vao); gl.bindBuffer(gl.ARRAY_BUFFER, TRCH.buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(A), gl.DYNAMIC_DRAW);
  gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, A.length / 9);
  gl.bindVertexArray(null); if (cf) gl.enable(gl.CULL_FACE);
  TRCH.n = A.length / 9; TRCH.logs = n; TRCH.wet = [w0, w1, Math.round(L)];   // 讀數（?debug=1：__tr.ev('TRCH')）
}
var trCrew0 = drawCrew;
drawCrew = function () { var r = trCrew0.apply(this, arguments); if (TRAILER) trChainDraw(); return r; };
var TR_PHX0 = null;
function trSetup(sc) {
  if (!TR_PHX0) TR_PHX0 = Object.assign({}, PHX);
  TR.townAt = sc.townAt || [0, 0];                                       // 城區照這一點挑（世界；trTownsBack 之前）
  TR.clear = sc.clear || null;                                           // 不長樹的路（海圖的塊在 trBedOn 擺樹 ⇒ 要在它之前）
  trBedOn(sc.map);                                                       // 海圖先（setWeather ⇒ vxInit 會照 BED 重烤漩渦）
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
  SHIPS.forEach(function (sh, i) { var f = sc.fleet[i]; sh.trRam = !!(f && f.ram); sh.trNoAvoid = !!(f && f.noAvoid); });
  SHIPS.forEach(function (sh, i) { var f = sc.fleet[i]; sh.trHaul = f && f.haul ? trHaulInit(sh, f.haul, sc) : null; if (sh.trHaul) { sh.fixed = true; trHaulPose(sh); } });   // 旱地行舟：開局就站在路線上
  SHIPS.forEach(function (sh) { sh.portWant = sc.portWant === undefined ? 1 : sc.portWant; });   // 砲門（TASK-0719，62_ports.js）：預設開著（＝ 低畫質的樣子）⇒ 遊戲照交戰自己開關的那一套不會讓 ?t= 跳到的一格跟順著播的不一樣
  CUTV.half = !!(sc.cut && sc.cut.half); CUTV.deck = sc.cut && sc.cut.deck || 0; FLX3 = !!sc.xray;
  TR.cur = sc.i; TR.k = 0; TR.sk = 0; TR.cue = 0;
  if (sc.setup) sc.setup(SHIPS);
}
/** 走到第 i 幕的第 n 步（有 warp ＝ 第 n 個格位）；budget（毫秒）用完就先停（回 false）。 */
function trStepTo(i, n, budget) {
  var sc = TR.S[i];
  if (TR.cur !== i || n < TR.k) { var live = TR.live; TR.live = false; trSetup(sc); TR.live = live; }
  var t0 = performance.now(), cues = sc.cues || [], P = sc.warp ? trPreSteps(sc) : Infinity;
  function step() {
    while (TR.cue < cues.length && Math.round(cues[TR.cue].at / DT) <= TR.sk) { cues[TR.cue].fn(SHIPS, sc); TR.cue++; }
    simStep(); TR.sk++;
  }
  while (TR.k < n) {
    if (TR.k < P) step();
    else {                                                              // 一個格位（warp）：模擬走到這個格位結束的 τ；倍率 < 1 ⇒ 只給人看的照格位的模擬秒走（遊戲 90_main.js frame 同一套）
      var j = TR.k - P, ta = trTau(sc, j * TR_Q), tb = trTau(sc, (j + 1) * TR_Q), s = Math.floor(tb / DT + 1e-6), slow = tb - ta < TR_Q - 1e-9;
      // 布與繩（30_rig_physics.js）照物理分級每 every 步算一次（最高兩檔 2 ⇒ 1 倍速一秒 30 次）⇒ 慢動作裡一秒模擬步變少、布就一頓一頓（0.5 倍 15 次）。
      //   ⇒ 倍率 ≤ 0.75 的格位裡布每一步都算（0.5 倍照樣一秒 30 次，開銷跟 1 倍速一樣）。布與繩不回寫戰局（50_sim.js），切點只看格位 ⇒ 同一個 t 同一格。
      var rl = slow && (tb - ta) <= 0.75 * TR_Q ? rigLv() : null, ev0 = rl ? rl.every : 0;
      SLOW_VIS = slow;
      try { if (rl) rl.every = 1; while (TR.sk < s) step(); }
      finally { if (rl) rl.every = ev0; SLOW_VIS = false; }
      if (slow) slowVisStep(tb - ta);
    }
    TR.k++;
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
  MSLOTS = [];                                                           // 船艙遮罩每一格重挑（⛔ 上一格的打九折 ⇒ ?t= 跳到的一格跟順著播的不一樣）；陰影 d416442 起照鏡頭分段、沒有 SSLOTS 了
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
  // 長格（換幕的那一口氣、背景載船的最後一段、模擬一時跟不上）：≤ 1.4 秒 ⇒ 畫面照實際過去的時間跳過去、下一格加大預算補算，配樂不停（audio.js 往前排了 1.5 秒）；
  //   更長 ⇒ 時鐘停在走得到的那一步、配樂停了從那一秒重接（TR.resync）。⛔ 以前一律停住重接 ⇒ 每次換幕、每艘船載完都斷一下（Tim 2026-10-19：「切換場景會卡很久」）。
  var catchup = false;
  if (free && dt > 0.25) dt = Math.min(dt, 1.5);
  else if (dt > 0.25) { if (TR.playing && dt <= 1.4 && !TR.resync && !TR.waitLoad) catchup = true; else { dt = 1 / 60; if (TR.playing) TR.resync = true; } }
  var t = TR.t;
  //   等船那幾格照樣往前走（下面缺船的話又拉回上一幕最後一格）：⛔ 等的時候不走 ⇒ 下一格停在上一幕（序幕）、那一幕不缺船 ⇒ 不等、配樂重接，
  //   再下一格又缺船 ⇒ 一格等一格不等，配樂每兩格重接一次（2026-10-28 整片模擬播放：序幕結尾等船 20 秒重接 119 次）
  if (TR.playing) t = Math.min(TR.DUR, t + dt);
  var A = trAt(t), prevT = TR.t;
  TR.waitLoad = false;
  // 這一幕的船還沒載好 ⇒ 停在上一幕的最後一格（黑場），右上角寫「載入船隻 n／17」；
  //   needAll 那一幕（序幕之後的第一幕；Tim 2026-10-19：「在一開頭就載入全部」）⇒ 十七艘全部載好、熱身完才進場 ⇒ 之後整支片不再載船。
  var need = !trSceneLoaded(A.i) || (A.sc.needAll && !TR.loadDone && !TR.still);
  TR.needLoad = need;                                                   // 載船的閘（trLoadGate）：播到有船的幕就停，這一幕缺船時開
  //   封面上按 ▶ 的時候手上正在載一艘 ⇒ 等它載完再開始（⛔ 不然剩下那一段在開場的對轟裡做完，開場就頓一下）；只等手上這一艘，閘不開（下一艘等序幕）
  var busy = TR.loadBusy && TR.playing && !A.sc.free && !TR.still;
  if (need || busy) {
    TR.waitLoad = true;
    if (!TR.playing) { TR.buffering = true; trUI(); return; }             // 停著（剛拖過去）⇒ 時間留在要看的那一秒，載好再畫
    TR.resync = true;
    t = Math.max(0, Math.min(t, A.sc.t0 - 1e-3)); A = trAt(t);
    if (!trSceneLoaded(A.i)) { TR.needLoad = true; trUI(); return; }
  }
  // 城（TASK-0750）：這一幕的海域有城 ⇒ 先開這一幕、照遊戲那一套往前建（城的實例、地面在 render 裡的 townDraw 建 ⇒ 要畫；畫完用字幕層蓋黑），trTownSettled 之前時鐘不走。
  if (trTownScene(A.sc)) {
    if (TR.cur !== A.i) trStepTo(A.i, 0, 0);
    trTownPump();
    if (!trTownSettled()) {
      TR.waitLoad = true; TR.buffering = true; if (TR.playing) TR.resync = true;
      //   播放中 ⇒ 時鐘停在這一幕的開頭（⛔ 不存 ⇒ 下一格從上一幕的尾巴算、落回上一幕 ⇒ 換幕重算整幕、算不完時鐘倒退，
      //   一路倒回弩砲那一幕再播回來、永遠進不了旱地行舟 —— 2026-10-28 整片模擬播放量到倒退 8 次）；停著（?t=）⇒ 留在要看的那一秒
      if (TR.playing) TR.t = A.sc.t0;
      trDraw(trAt(A.sc.t0)); trTownCover(); trUI(); return;
    }
  }
  var cut = TR.cur !== A.i || A.n < TR.k;
  // 字卡前導（sc.lead；全艦隊、進水那兩幕）：黑底字卡的那幾秒 ⇒ 這一格只重開（不預跑）、預跑照 100 ms 一格分著做、時鐘照走（黑場上沒有東西會停）；快到字卡尾還沒做完 ⇒ 一格給 400 ms 做完（下一格 catchup 跳過去）。
  //   2026-10-19 量（JIT 熱了以後）：十七艘重開 0.37–0.42 秒、模擬 1 秒要 0.34 秒 ⇒ 預跑 3 秒＋重開 ≈ 1.4 秒 —— 一口氣做 ⇒ 剛好卡在 catchup 的 1.4 秒上，慢一點的機器就停住、配樂重接（片子的最高潮那一下）。
  var lead = !TR.still && TR.playing && A.u < A.sc.lead;
  TR.live = TR.playing && !TR.resync && !lead && !cut;                  // 預跑（換幕那一口、字卡前導）不出聲：⛔ 幾秒的砲聲擠在一格裡發
  // 換幕：重開一局＋預跑一口氣做完（黑場裡，中間不畫）⇒ 停一次（0.2–0.5 秒），下一格照實際過去的時間跳過去（上面的 catchup）、配樂不斷。
  //   ⛔ 以前預跑也照 28 ms 分格做、每格還畫一次 ⇒ 預跑一超過 28 ms 時鐘就停住、配樂停了重接 —— 幾乎每次換幕都斷一下。
  //   補算那一格放寬到 400 ms（照 28 ms 算不完 ⇒ 又是時鐘停住、配樂重接）；模擬比即時快（2026-10-19 逐幕量：全艦隊最重 0.57 倍）⇒ 補得回來。
  if (cut && !TR.still && TR.playing) { trStepTo(A.i, lead ? 0 : Math.min(A.n, Math.floor(A.sc.pre / DT + 1e-6)), 0); TR.live = TR.playing && !TR.resync && !lead; }
  //   平常那一格 100 ms（以前 28）：全艦隊那一幕畫一格 26 ms、開戰後模擬一步 12 ms（2026-10-19 量）⇒ 每格模擬 ~20 ms，28 ms 只差一點 —— 中間頓一下（GC、建網格）下一格就算不完 ⇒ 時鐘停、配樂重接。
  //   寧可那一格長一點（畫面頓一下），配樂不斷。
  //   字卡上一格 100 ms（字是靜的，幀數低看不出來；2026-10-19 整片模擬播放：50 ms 時全艦隊的預跑在字卡裡做不完，淡入後連 6 格 340–490 ms 在補）。
  var done = trStepTo(A.i, A.n, TR.still ? 0 : lead ? (A.u > A.sc.lead - 0.5 ? 400 : 100) : cut || catchup ? 400 : 100);
  TR.live = false;
  var shown = A;                                                        // 這一格畫哪一刻（通常 ＝ 時鐘那一刻）
  if (lead) TR.buffering = TR.waitLoad;                                 // 字卡上做不完不停（下一格接著做）
  else if (!done) {
    // 短暫落後（TR_LAG 秒以內）：時鐘照走、配樂不停，這一格先畫算到的那一刻（也是 F(t)，只是早一點的 t），下一格接著補。
    //   ⛔ 以前一算不完就把時鐘拉回算到的那一步、配樂停了從那一秒重接（AudioContext 整個停 ⇒ 正在響的聲音被切斷、長音從頭起音）——
    //   殉爆斷船那一步自己就 228 ms（2026-10-19 火藥庫那幕量），每次都重接一次：Tim 聽到的「破音」。
    var tk = trTimeOfStep(A.sc, TR.k);
    if (TR.playing && !TR.still && t - tk <= TR_LAG) { shown = trAt(Math.max(A.sc.t0, Math.min(t, tk))); TR.buffering = TR.waitLoad; TR.lagMax = Math.max(TR.lagMax || 0, t - tk); }
    else { t = tk; A = shown = trAt(t); TR.buffering = true; if (TR.playing) TR.resync = true; }
  } else TR.buffering = TR.waitLoad;
  TR.t = t;
  if (TR.playing && TR.resync && !TR.buffering && !TR.waitLoad) { TR.resync = false; trMusicAt(t); }
  else if (TR.playing && TR.resync) trMusicStop();
  if (TR.playing) trAudioTick(prevT, t);
  if (TR.drawnT !== t || TR.dirty) { if (!lead) trDraw(shown); TR.drawnT = t; TR.dirty = false; }   // 字卡前導：整片黑，3D 不畫（模擬還在預跑的半路）
  trOverlay(t, shown);
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
/** 載下一艘之前等：⛔ 播到有船的幕不載（每艘最後一段一口氣 0.5–1 秒 ⇒ 畫面停、開場的對轟也會頓）；沒在播（封面）、序幕、這一幕缺船（needLoad）才載。 */
function trLoadGate() {
  return new Promise(function (r) { (function poll() { if (TR.still || !TR.playing || TR.needLoad || TR.S[trSceneIx(TR.t)].free) r(); else setTimeout(poll, 40); })(); });
}
/** 熱身（只在序幕、沒有船的時候）：一種船第一次出場要算一堆跟著船型快取的東西（房間、繩的綁點、水泵……）——
 *  2026-10-19 量：三叉戟號第一次重開 677 ms（makeShip 508）、第二次 47 ms；餘燼號＋夜隼號 678 → 79；拿破崙號 492 → 37。
 *  ⇒ 載好就挑一幕有它、船都載好了、船最少的開一次局（不走模擬、不畫），再丟掉；序幕下一格自己重開。快取只跟船型有關 ⇒ 之後每一格照舊是 F(t)。 */
function trWarm(id) {
  var sc = TR.S.filter(function (s) { return !s.free && s.fleet.some(function (f) { return f.hull === id; }) && trSceneLoaded(s.i); })
    .sort(function (a, b) { return a.fleet.length - b.fleet.length || a.i - b.i; })[0];
  if (!sc) return;                                                      // 有它的幕都還差別的船 ⇒ 第一次出場時再算
  var live = TR.live, t0 = performance.now(), cur = TR.cur, k = TR.k, sk = TR.sk, simt = SIMT;
  TR.live = false; trSetup(sc);
  // 序幕接回原狀：⛔ 只標 TR.cur = -1 ⇒ 序幕下一格從第 0 步重算到現在（~900 步），算不完時鐘就退回算到的那一步（2026-10-19 模擬播放量到：序幕從 15 秒退回 1 秒重播）。
  //   序幕沒有船 ⇒ 世界只有時間（SIMT、步數）⇒ 重開序幕、把兩個接回去就是同一格。
  if (cur >= 0 && TR.S[cur].free) { trSetup(TR.S[cur]); TR.k = k; TR.sk = sk; SIMT = simt; } else TR.cur = -1;
  TR.live = live;
  (TR.warmLog = TR.warmLog || []).push([id, sc.id, Math.round(performance.now() - t0)]);
}
function trBoot() {
  trWire();
  if (DEBUG) (function gap(prev) { requestAnimationFrame(function (ts) { if (prev && ts - prev > 50) (TR.gapLog = TR.gapLog || []).push([Math.round(ts), Math.round(ts - prev), TR.loadName, TR.loadN]); gap(ts); }); })(0);   // 量：長格（> 50 ms）在載哪一艘時出現
  trScenes();
  var only = TR.wantT !== null ? trSceneIx(Math.min(TR.wantT, TR.DUR)) : undefined;
  //   封面先載好序幕（第一個 sc.free）之前每一幕的船（開場的對轟、蓬特號）⇒ 按 ▶ 之後到序幕之前都不用停下來等船（播到有船的幕不載：trLoadGate）
  var pro = TR.S.findIndex(function (s) { return s.free; }), first = [];
  if (only !== undefined) first = trHulls(only);
  else TR.S.slice(0, pro > 0 ? pro : 1).forEach(function (s, i) { trHulls(i).forEach(function (h) { if (first.indexOf(h) < 0) first.push(h); }); });
  var L = trHulls(only);
  TR.loadAll = L.length; TR.loadN = 0;
  if (!first.length) trReady();                                          // 序幕沒有船 ⇒ 引擎好了就能播，持火號在序幕放映時背景載（Tim 2026-10-19）
  hullSay = function (s) { TR.loadStep = s; trUI(); };
  L.reduce(function (p, id) {
    var t0;
    return p.then(trLoadGate).then(function () { TR.loadBusy = true; TR.loadName = (hullInfo(id) || {}).name || id; trUI(); t0 = performance.now(); return loadHull(id); }).then(function () {
      TR.loadN++; (TR.loadLog = TR.loadLog || []).push([id, Math.round(performance.now() - t0)]);   // 每艘從開始載到載好幾毫秒（?debug=1：__tr.ev('TR.loadLog')）
      if (!TR.ready && first.every(function (h) { return !!HULLT[h]; })) trReady();
      trUI();
      return new Promise(function (r) { setTimeout(r, 20); });             // 讓一格畫面出去（配樂照這一格往前排）再熱身：⛔ 載完的最後一段＋熱身接著做 ⇒ 一口氣 1.5 秒以上，配樂排的音用完、斷一下
    }).then(function () {
      if (!TR.still && (!TR.playing || TR.waitLoad || TR.S[trSceneIx(TR.t)].free)) trWarm(id);   // 熱身只在沒在播、停著等船（黑場）、或序幕裡（播到有船的幕熱身 ⇒ 要把正在演的那一局丟掉）
      TR.loadBusy = false;
      return new Promise(function (r) { setTimeout(r, 20); });             // 再讓一格才載下一艘
    });
  }, Promise.resolve()).then(function () { TR.loadDone = true; if (!TR.ready) trReady(); trUI(); })
    .catch(function (e) { TR.err = String(e && e.message || e); console.error(e); trUI(); });
}
function trReady() {
  TR.ready = true;
  if (TR.wantT !== null) { TR.t = Math.min(TR.wantT, TR.DUR); TR.wantT = TR.t; }
  trMusicPrep();
}
