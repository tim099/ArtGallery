// ───────────────────────── 方舷放置 Sharkside 宣傳片的導演（框架移植自 kaguya 的 Blockside 宣傳片：ArtGallery/HtmlVideos/_build/kaguya_blockside_trailer） ─────────────────────────
// 這一段只活在宣傳片那份複製裡：splice.py 把它插在核心閉包的結尾前（同一個閉包 ⇒ 看得到 SHIPS、simStep、reset、shapiMake……）。核心本體不帶它。
// 畫面 ＝ 片長時間 t 的純函數（HTML_VIDEO_WORKFLOW.md ②）：
//   · 每一幕 ＝ 固定的開局（種子、風、天氣、船型、位置）＋ 固定步長（DT，鎖 30 Hz）的模擬；亂數走核心的 rngMake（reset() 重設）。
//     核心裡少數幾處用 Math.random（咬一口的碎木方向…）⇒ cue、setup、trBite／trShot／trBlast 一律在 trSeeded 裡跑（每一幕照種子重設的 trRng）。
//   · 看第 t 秒 ⇒ 那一幕從開局走 n ＝ floor(τ / DT) 步（τ ＝ 那一幕的模擬秒數，慢動作照 rate／warp 換算）⇒ 照 t 算的鏡頭畫。
//   · 播放中 ⇒ 接著走；換幕（或測試用的 ?t=）⇒ 重開那一幕再走（播放器沒有拖曳的時間軸：只往前播、播完重播）。
//   · 會跟著鏡頭或畫面時間走的東西先關掉：遠方帆繩降級（rigfar）、碎木依鏡頭淘汰（DEB_CAP）、3D 雨、門的動畫、殉爆慢動作、物理減速、艙內水面的時間混合。
// 走不完（重的一幕、剛換幕）⇒ 落後 TR_LAG 秒以內：時鐘照走、先畫算到的那一刻，下一格補；更久 ⇒ 時鐘停在走得到的那一步（畫面一律是 F(t)，只是播得比真實慢），右上角寫「準備中」。
// 聲音：按下播放才建（使用者手勢）；模擬裡的砲聲、碎裂聲只在播放中、從上一格到這一格之間的那幾步發出；配樂照時間軸即時排程（audio.js：往前排 1.5 秒）。
//
// 跟 kaguya 那一版不一樣的地方（2026-10-30，gura 宣傳片的框架；理由見 README.md）：
//   ① 擺位：核心的 reset() 走 spawnSteps（spawnFleet 沒人叫了）⇒ 改包 spawnSteps ＋ makeShipSteps，sc.fleet[].x/z/yaw 從造船那一步就照它擺。
//   ② 步長：reset() 照 PHX.step 定 DT ⇒ PHX.step 鎖 TR_STEP（30 Hz），開機與每一幕都鎖 ⇒ trAt／trTimeOfStep 一律同一個 DT。
//   ③ BED_SLICE、CORE_JUDGE 關掉；音效轉第四個參數（砲種、材質）；cues 照 at 排序；配樂匯流排缺了就建；每格叫核心的 sndGc（frame() 不跑）。
//   ④ 拿掉 Blockside 那支片才用的：城鎮、旱地行舟、金角灣巨鏈、海圖內嵌（v1 沒有海圖：sc.map 不支援）。
//   ⑤ 新增：TR_API（核心的外殼 API，shapiMake）、trRng／trSeeded、trBite／trShot／trBlast、內嵌美術 trImg／trPic（overlay.js）。

var TR_W = 1280, TR_H = 720, TR_FOV = 0.9;
if (Q.get('res') === '1080') { TR_W = 1920; TR_H = 1080; }
var TR = {
  S: [], DUR: 0, t: 0, last: 0, playing: false, buffering: false, ready: false, still: Q.get('still') === '1',
  cur: -1, k: 0, sk: 0, cue: 0, place: null, spawning: false, live: false, loadN: 0, loadAll: 0, loadName: '', err: null, dirty: false, imgPend: 0,
  framed: (function () { try { return window.self !== window.top; } catch (e) { return true; } })(),
  wantT: Q.has('t') ? Math.max(0, parseFloat(Q.get('t')) || 0) : null, drawnT: -1
};
var TR_LATEST = 'https://tim099.github.io/Sharkside/';
var TR_STEP = 1;                                                        // PHX.step 鎖這一檔：PHX_STEP_HZ[1] ＝ 30 Hz（每一幕同一個 DT ⇒ ?t= 跟順著播走同一串步）
var TR_RAND0 = Math.random;                                             // 真的 Math.random（trSeeded 換掉時，聲音照舊用它：聲音不能吃 trRng 的序列）
var TR_API = null;                                                      // 核心的外殼 API（91_shellapi.js shapiMake）：trBoot 建（trApi() 第一次用到也會建）

if (TRAILER) {
  document.body.classList.add('trailer');
  gfxSet(GFX_PRESET[Q.get('gfx')] ? Q.get('gfx') : 'high');
  GFX.drops = 0; GFX.dropspl = 0; GFX.fall = 0; GFX.door = 0; GFX.rain = 2;   // fall：艙內瀑布的粒子用 Math.random（63_flood_gl.js）
  PHX.rigfar = 0; PHX.sailhit = 0; PHX.step = TR_STEP;                  // rigfar 0：帆繩不照鏡頭遠近降級（⛔ 戰局會跟著鏡頭走）
  DT = DT_BASE = 1 / PHX_STEP_HZ[TR_STEP];                              // 第一次 trSetup 之前的 trAt 也用同一個 DT
  SLOW.on = false; SLOW.cam = false; PSLOW.on = false; SIM_SPEED = 1;
  DEB_CAP = Infinity; FL_SNAP = true; ERR_HOOK = null; STILL = true;
  BED_SLICE = false;                                                    // 海圖、樹不分格排隊（frame() 不跑 ⇒ 排了沒人做）
  CORE_JUDGE = false;                                                   // 核心不判勝負（⛔ 一方倒了就 OVER、片子停在結算）
  evOff('sfx', sfxPlay); evOn('sfx', function (k, at, v, o) { if (TR.live && k !== 'thunder') trSfx(k, at, v, o); }, 0, true);
}
var trGlFail0 = glFail;                                                 // 核心報錯（載入失敗…）：#err 在宣傳片裡是藏起來的 ⇒ 也寫在載入畫面上
glFail = function (msg) { if (TRAILER) { TR.err = String(msg); try { trUI(); } catch (e) { } } return trGlFail0.apply(this, arguments); };
/** 音效：照核心的 sfxPlay（帶第四個參數：砲種、材質…）；聲音的 Math.random 一律用真的（⛔ 吃到 trRng ⇒ 有沒有出聲，之後的碎木就不一樣）。 */
function trSfx(k, at, v, o) { var r = Math.random; Math.random = TR_RAND0; try { sfxPlay(k, at, v, o); } finally { Math.random = r; } }

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
/** 兩端內插（一幕裡從 a 慢慢到 b）。 */
function trK2(u, D, a, b) { return trKey([[0, a], [D, b]], u); }
/** 一鏡到底的鏡頭路徑：K ＝ [[u, 向量], …]，Catmull-Rom 曲線過每一格（trKey 每到一格就停一下，這個不停）。 */
function trSpline(K, u) {
  if (u <= K[0][0]) return K[0][1].slice();
  var n = K.length; if (u >= K[n - 1][0]) return K[n - 1][1].slice();
  var i = 0; while (i < n - 2 && u >= K[i + 1][0]) i++;
  var p0 = K[Math.max(0, i - 1)][1], p1 = K[i][1], p2 = K[i + 1][1], p3 = K[Math.min(n - 1, i + 2)][1], t = (u - K[i][0]) / (K[i + 1][0] - K[i][0]), t2 = t * t, t3 = t2 * t;
  return p1.map(function (_, d) { return 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3); });
}
/** 船上一點（m；船的座標：x 往船頭、y 往上、z 往右舷，原點 ＝ 船心）⇒ 世界座標。 */
function trOnShip(sh, x, y, z) {
  var c = shipCenter(sh), f = fwd(sh.yaw), r = [-f[2], 0, f[0]];          // r：右舷（船頭往前、右手邊）
  return [c[0] + f[0] * x + r[0] * z, c[1] + y, c[2] + f[2] * x + r[2] * z];
}
/** 繞著 c 的軌道鏡頭：方位角 az（世界，0 ＝ +x、π/2 ＝ +z）、仰角 el、距離 d。 */
function trOrbit(c, az, el, d) { return [c[0] + Math.cos(az) * Math.cos(el) * d, c[1] + Math.sin(el) * d, c[2] + Math.sin(az) * Math.cos(el) * d]; }
/** 船頭方向的方位角（世界）：fwd(yaw) ＝ [cos yaw, 0, −sin yaw] ⇒ atan2(−sin, cos) ＝ −yaw。 */
function trAzOf(sh) { return -sh.yaw; }
/** 船頭朝方位角 h（世界）⇒ yaw。 */
function trYaw(h) { return -h; }
/** 太陽的方位角（世界；核心的 SUN 是「往太陽的方向」）。 */
function trSunAz(d) { d = d || SUN; return Math.atan2(d[2], d[0]); }
/** 船頭朝 h、要順風（風往船頭左右 off 弧度的方向吹）⇒ wind 欄位 [度, 倍]（WIND_FIX 的 rot：0° 往 +z 吹 ＝ 方位角 π/2）。 */
function trWind(h, off, s) { return [((h + (off === undefined ? 0.6 : off)) - Math.PI / 2) * 180 / Math.PI, s || 1.15]; }
/** 對船的相對鏡頭：ra ＝ 相對船頭的方位（0 船頭、+π/2 右舷、π 船尾）、el 仰角、d 距離、up 注視點抬高、fx 注視點沿船頭前後移。 */
function trRel(sh, ra, el, d, up, fx) {
  var c = shipCenter(sh), f = fwd(sh.yaw); c = [c[0] + f[0] * (fx || 0), c[1] + (up || 0), c[2] + f[2] * (fx || 0)];
  return { eye: trOrbit(c, trAzOf(sh) + ra, el, d), look: c };
}
/** 鏡頭貼著海面時別鑽到浪底下。 */
function trAbove(c, h) { var y = seaH(c.eye[0], c.eye[2], SIMT) + (h || 1.2); if (c.eye[1] < y) c.eye[1] = y; return c; }
/** 天色（sc.look；只改畫面）：幾組現成的。 */
var TR_LOOK = {
  dusk: { sky: [0.30, 0.25, 0.36], horizon: [0.93, 0.55, 0.32], ground: [0.17, 0.12, 0.10], fog: 0.0024, sun: 0.62, lum: 0.72, foam: 0 },
  gold: { sky: [0.40, 0.47, 0.60], horizon: [0.96, 0.78, 0.55], ground: [0.20, 0.17, 0.13], fog: 0.0017, sun: 0.92, lum: 0.92 },
  grey: { sky: [0.42, 0.45, 0.49], horizon: [0.62, 0.63, 0.64], ground: [0.16, 0.16, 0.15], fog: 0.0030, sun: 0.55, lum: 0.80 },
  night: { sky: [0.015, 0.025, 0.06], horizon: [0.05, 0.07, 0.12], ground: [0.015, 0.02, 0.03], fog: 0.0030, sun: 0.10, lum: 0.30 },
  storm: { sky: [0.10, 0.12, 0.15], horizon: [0.17, 0.19, 0.22], ground: [0.06, 0.06, 0.06], fog: 0.0048, sun: 0.22, lum: 0.42, foam: 1 },
  abyss: { sky: [0.03, 0.08, 0.14], horizon: [0.06, 0.20, 0.30], ground: [0.02, 0.05, 0.08], fog: 0.0040, sun: 0.30, lum: 0.45 }
};
/** 兩種天色之間（u 從 0 到 1）。 */
function trLookMix(a, b, u) { var o = {}; for (var k in a) o[k] = typeof a[k] === 'number' ? trMix(a[k], b[k] === undefined ? a[k] : b[k], u) : trMixV(a[k], b[k] || a[k], u); return o; }

// ── 亂數（Math.random 的替身）：每一幕照種子重設 ⇒ 同一個 t 同一格 ──
var TR_RS = 1;
/** mulberry32（跟核心 rngMake 同一個演算法）：[0, 1)。 */
function trRng() { var s = TR_RS | 0; s = s + 0x6D2B79F5 | 0; TR_RS = s; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function trRngSeed(seed) { TR_RS = ((seed >>> 0) ^ 0x51A4C5D1) | 0; }
/** fn 跑的時候 Math.random 換成 trRng（核心的咬一口用 Math.random 噴碎木；scenes.js 自己的隨機也走這裡）。回 fn 的回傳值。 */
function trSeeded(fn) { var r0 = Math.random; Math.random = trRng; try { return fn(); } finally { Math.random = r0; } }

// ── 核心的外殼 API（91_shellapi.js）：咬、砲擊、爆炸（scenes.js 的 cues 用）──
function trApi() { return TR_API || (TR_API = shapiMake()); }
/** 這一步的鏡頭（照這一幕的 cam(u, τ) 算；⛔ 不讀 CAM：CAM 是上一格畫面的鏡頭，?t= 跟順著播不一樣）。 */
function trCamNow() {
  var sc = TR.S[TR.cur]; if (!sc || !sc.cam) return null;
  var t = trTimeOfStep(sc, TR.k);
  try { return sc.cam(Math.min(sc.dur, Math.max(0, t - sc.t0)), SIMT, SHIPS, sc); } catch (e) { return null; }
}
/** sh 對著這一步鏡頭的那一舷（+1／−1；核心 bite 的 side 0 照 CAM.eye 算 ⇒ 這裡先換成照導演的鏡頭）。 */
function trCamSide(sh) { var c = trCamNow(), e = c && c.eye || CAM.eye; return toLocal(sh, e)[1] > toLocal(sh, shipCenter(sh))[1] ? 1 : -1; }
/** 咬一口（核心 shapi.bite）：at ＝ { fx, side, dz }（side 0／沒給 ⇒ 對著鏡頭那一舷）或格座標 [x, y, z]＋dir；r 半徑（格，2–24）。回 { n, w, arm, mdl } 或 null。 */
function trBite(sh, at, r, dir) {
  if (!sh) return null;
  if (at && !Array.isArray(at) && !(at.side > 0 || at.side < 0)) at = Object.assign({}, at, { side: trCamSide(sh) });
  return trSeeded(function () { return trApi().bite(sh, at, r, dir); });
}
/** 憑空一發（核心 shapi.shot）：from → to（世界座標）；o ＝ { kind: 'solid'|'shell'|'chain'|'fire', v, m, dmg, hole, owner, fx }。回那顆彈。 */
function trShot(from, to, o) { return trSeeded(function () { return trApi().shot(from, to, o); }); }
/** 在世界座標 w 炸開（核心 shapi.blast）：R 半徑（格，4–80）、o ＝ { name, f, fx }。回碰到幾艘。 */
function trBlast(w, R, o) { return trSeeded(function () { return trApi().blast(w, R, o); }); }
/** 齊射（核心 setAim ＋ broadside）：sh 的砲全部裝好、瞄 foe 的格座標 aim（沒給 ＝ 船中段）。 */
function trVolley(sh, foe, ammo, aim) {
  sh.guns.forEach(function (g) { if (g.alive) g.reload = 0; });
  setAim(sh, aim || [foe.T.cx, foe.T.cy, foe.T.geo.aim], foe);
  return broadside(sh, ammo || 0, false);
}

// ── 時間軸 ──
/** 加一幕。sc：{ id, dur, seed, wx, wind:[度, 倍], fleet:[{team, hull, x, z, yaw, hold, sail, tele, ram, noAvoid}], mode, phx, pre（開幕時模擬已經走了幾秒）, rate（模擬秒／片長秒）, warp,
 *  lead（開頭幾秒是黑底字卡：模擬停在 pre、預跑分到這幾格做；over 畫字卡）, free（沒有船的序幕：長格照真實時間跳）, needAll,
 *  cues:[{at: 模擬秒, fn(S, sc)}]（照 at 排序；在 trSeeded 裡跑）, setup(S, sc), cam(u, τ, S, sc) ⇒ {eye, look, fov}, look（天色）, fx(push, u, τ, S, sc),
 *  cap(g, u, τ, S, sc), over(g, u)（壓在黑場上面的字）, marks, ports, portWant, cut, xray, dist, gap, cmd, autoFire, fadeIn, fadeOut, black(u), bars, vig }。 */
function trAdd(sc) {
  sc.i = TR.S.length; sc.t0 = TR.DUR; TR.DUR += sc.dur; sc.rate = sc.rate || 1; sc.pre = sc.pre || 0; sc.lead = sc.lead || 0; sc.fleet = sc.fleet || [];
  if (sc.cues) sc.cues = sc.cues.slice().sort(function (a, b) { return a.at - b.at; });   // ⛔ 沒排 ⇒ trStepTo 照陣列順序觸發，早的被晚的擋住（kaguya 莫尼特號那一幕）
  TR.S.push(sc); return sc;
}
function trSceneIx(t) { for (var i = 0; i < TR.S.length; i++) if (t < TR.S[i].t0 + TR.S[i].dur) return i; return TR.S.length - 1; }
// 慢動作（sc.warp ＝ [[v, 倍率], …]：v ＝ 字卡之後的片長秒，兩格之間倍率線性變；同一個 v 給兩格 ⇒ 那一刻直接跳過去）：τ(v) ＝ pre ＋ ∫ 倍率 dv。
//   每格畫面換成固定的 TR_Q 片長秒（一個「格位」）⇒ 同一個 t 同一格；有 warp 的幕 TR.k 數「預跑的模擬步（pre）＋ 之後的格位」，真的模擬步另外數在 TR.sk（cues 照它）。
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
/** 第 i 幕走到第 k 步（有 warp ＝ 第 k 個格位）時，片長是幾秒。 */
function trTimeOfStep(sc, k) {
  if (sc.warp) return sc.t0 + sc.lead + Math.max(0, k - trPreSteps(sc)) * TR_Q;
  return sc.t0 + sc.lead + Math.max(0, (k * DT - sc.pre) / sc.rate);
}

// ── 擺位（sc.fleet[].x/z/yaw）──
//   核心的 reset() ⇒ resetSteps ⇒ spawnSteps(fleetSpec())（⛔ spawnFleet 沒人叫：kaguya 那一版覆寫 spawnFleet ⇒ 擺位一直沒生效）。
//   ⇒ spawnSteps 前後各加一步：開著 TR.spawning 的時候 makeShipSteps 照 TR.place 的 x/z/yaw 造船（跟 coreAdd 一樣從第一步就在那裡：網格、帆、水格都照那個位置），
//     最後一步再擺一次（大漩渦 vxPlace 會重排）、重算矩陣、清掉畫面內插的上一步 ⇒ resetSteps 接著的 stepShip(sh, 0)、survey 都在新的位置上。
var trMakeSteps0 = makeShipSteps;
makeShipSteps = function (i, team, yaw, pz, T, px) {
  var p = TRAILER && TR.spawning && TR.place ? TR.place[i] : null;
  if (p && p.x !== undefined) { px = p.x; pz = p.z; if (p.yaw !== undefined) yaw = p.yaw; }
  return trMakeSteps0(i, team, yaw, pz, T, px);
};
var trSpawnSteps0 = spawnSteps;
spawnSteps = function (spec) {
  var L = trSpawnSteps0(spec);
  if (!TRAILER) return L;
  return [function () { TR.spawning = true; }].concat(L, [trPlaceFix]);
};
function trPlaceFix() {
  TR.spawning = false;
  (TR.place || []).forEach(function (p, i) {
    var sh = SHIPS[i]; if (!sh || p.x === undefined) return;
    sh.px = p.x; sh.pz = p.z; if (p.yaw !== undefined) sh.yaw = p.yaw;
    sh.M = shipMatrix(sh); sh.inv = M4.inv(sh.M); sh.center = shipCenter(sh);
    sh.Mp = null; sh.Mpre = null; sh.yawL = undefined;                    // 畫面內插（03_camera.js renderLerp）的上一步：⛔ 留著 ⇒ 第一格從預設的位置滑過來
  });
}
// 撞船（sc.fleet[].ram）：艦長不讓船、直直對著敵艦開；不避淺（noAvoid）
var trHelm0 = helmSteer, trFriendAv0 = friendAvoid, trFoeAv0 = foeAvoid, trBedAv0 = bedAvoid;
helmSteer = function (sh, foe) {
  if (TRAILER && sh.trRam && foe) return { yaw: Math.atan2(-(foe.pz - sh.pz), foe.px - sh.px), v: null };
  return trHelm0(sh, foe);
};
friendAvoid = function (sh, L, T) { return TRAILER && sh.trRam ? null : trFriendAv0(sh, L, T); };
foeAvoid = function (sh) { return TRAILER && sh.trRam ? null : trFoeAv0(sh); };
bedAvoid = function (sh) { return TRAILER && sh.trNoAvoid ? null : trBedAv0(sh); };
/** 海圖：v1 不內嵌（BED ＝ null，每一處跟沒有海圖一樣）。要海圖 ⇒ 照 kaguya 的 trBedOn＋splice.py trailer_maps() 補回來（README）。 */
function trBedOn(m) {
  if (m && !TR.mapWarn) { TR.mapWarn = 1; console.warn('宣傳片 v1 沒有內嵌海圖：sc.map 不理（' + JSON.stringify(m) + '）'); }
  BED = null;
}

// ── 開一幕（照參數設好全域 ⇒ reset）──
var TR_PHX0 = null;
function trSetup(sc) {
  if (!TR_PHX0) TR_PHX0 = Object.assign({}, PHX);
  trBedOn(sc.map);
  SEED = (sc.seed || 1797) >>> 0;
  trRngSeed(SEED);
  WIND_FIX = { rot: sc.wind ? sc.wind[0] : 0, s0: sc.wind ? sc.wind[1] : 1 };   // ⛔ 兩個鍵都要給（少一個 ⇒ 風是 NaN）
  setWeather(sc.wx || 'clear');
  DIST = sc.dist || 140; FLEET_GAP = sc.gap || 70;
  CMD_SIDE.blue = sc.cmd ? sc.cmd[0] : 'free'; CMD_SIDE.red = sc.cmd ? sc.cmd[1] : 'free'; CMD_GAUGE.blue = CMD_GAUGE.red = false;
  FLEET_DBG = sc.fleet.map(function (f) { return { team: f.team, hull: f.hull }; });
  FIELD_N = Math.max(2, FLEET_DBG.length);
  for (var k in TR_PHX0) PHX[k] = TR_PHX0[k];
  PHX.rigfar = 0; PHX.sailhit = 0;
  if (sc.phx) for (k in sc.phx) PHX[k] = sc.phx[k];
  PHX.step = TR_STEP;                                                   // ⛔ 每一幕同一個步長（sc.phx 也改不了）：trAt 換幕前就要用 DT
  setPhys(PHX.rig > 0);
  TR.place = sc.fleet;
  CORE_JUDGE = false;
  flowMode(sc.mode || 'sandbox'); reset(); setAutoFire(!!sc.autoFire);
  flowRun(true); flowPause(false); OVER = false;
  if (Math.abs(DT - 1 / PHX_STEP_HZ[TR_STEP]) > 1e-12) console.error('宣傳片：DT 不是鎖住的那一檔', DT);
  SHIPS.forEach(function (sh, i) {
    var f = sc.fleet[i]; if (!f) return;
    if (f.hold) { sh.aiWait = sh.aiWait2 = Infinity; }
    if (f.sail !== undefined) { sh.sailSet = f.sail; applySailSet(sh); }
    if (f.tele !== undefined && sh.cfg.base > 0) { sh.tele = f.tele; sh.power = TELE[f.tele]; sh.teleHand = true; }
    sh.trRam = !!f.ram; sh.trNoAvoid = !!f.noAvoid;
  });
  SHIPS.forEach(function (sh) { sh.portWant = sc.portWant === undefined ? 1 : sc.portWant; });   // 砲門預設開著（遊戲照交戰自己開關 ⇒ ?t= 跳到的一格跟順著播的不一樣）
  CUTV.half = !!(sc.cut && sc.cut.half); CUTV.deck = sc.cut && sc.cut.deck || 0; FLX3 = !!sc.xray;
  TR.cur = sc.i; TR.k = 0; TR.sk = 0; TR.cue = 0;
  TR.placed = SHIPS.map(function (sh) { return [sh.px, sh.pz, sh.yaw]; });   // 讀數（?debug=1：__tr.placed()）
  if (sc.setup) trSeeded(function () { sc.setup(SHIPS, sc); });
}
/** 走到第 i 幕的第 n 步（有 warp ＝ 第 n 個格位）；budget（毫秒）用完就先停（回 false）。 */
function trStepTo(i, n, budget) {
  var sc = TR.S[i];
  if (TR.cur !== i || n < TR.k) { var live = TR.live; TR.live = false; trSetup(sc); TR.live = live; }
  var t0 = performance.now(), cues = sc.cues || [], P = sc.warp ? trPreSteps(sc) : Infinity;
  function step() {
    while (TR.cue < cues.length && Math.round(cues[TR.cue].at / DT) <= TR.sk) { var c = cues[TR.cue++]; trSeeded(function () { c.fn(SHIPS, sc); }); }
    simStep(); TR.sk++;
  }
  while (TR.k < n) {
    if (TR.k < P) step();
    else {                                                              // 一個格位（warp）：模擬走到這個格位結束的 τ；倍率 < 1 ⇒ 只給人看的照格位的模擬秒走
      var j = TR.k - P, ta = trTau(sc, j * TR_Q), tb = trTau(sc, (j + 1) * TR_Q), s = Math.floor(tb / DT + 1e-6), slow = tb - ta < TR_Q - 1e-9;
      var rl = slow && (tb - ta) <= 0.75 * TR_Q ? rigLv() : null, ev0 = rl ? rl.every : 0;   // 慢動作裡布每一步都算（布不回寫戰局）
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
  MSLOTS = [];                                                           // 船艙遮罩每一格重挑（⛔ 上一格的 ⇒ ?t= 跳到的一格跟順著播的不一樣）
  if (look) { keep = { sky: SKY, hor: HORIZON, gr: GROUND, fog: WX.fog, sun: WX.sun, lum: WX.lum, foam: WX.foam };
    var L = typeof look === 'function' ? look(A.u, A.tau) : look;
    if (L.sky) SKY = L.sky; if (L.horizon) HORIZON = L.horizon; if (L.ground) GROUND = L.ground;
    if (L.fog !== undefined) WX.fog = L.fog; if (L.sun !== undefined) WX.sun = L.sun; if (L.lum !== undefined) WX.lum = L.lum; if (L.foam !== undefined) WX.foam = L.foam;
    if (L.sunDir) SUN = L.sunDir; }
  TR.fxNow = sc.fx ? function (push) { sc.fx(push, A.u, A.tau, SHIPS, sc); } : null;
  if (typeof portsAnim === 'function') { portsAnim(); if (sc.ports) trPorts(sc.ports, A.tau); }
  render();
  TR.fxNow = null;
  TR.marks = (sc.marks || []).map(function (mk) { var w = null; try { w = mk.at(SHIPS); } catch (e) { w = null; } return Object.assign({}, mk, { s: w ? trProject(w) : null }); });
  if (keep) { SKY = keep.sky; HORIZON = keep.hor; GROUND = keep.gr; WX.fog = keep.fog; WX.sun = keep.sun; WX.lum = keep.lum; WX.foam = keep.foam; SUN = sun0; }
  renderLerp(false);
}
/** 砲門：每片蓋板的開合照這一幕的模擬秒 τ 直接算（o ＝ { open, close, until }）⇒ 同一個 t 同一格。 */
function trPorts(o, tau) {
  if (o.until !== undefined && tau >= o.until) return;
  SHIPS.forEach(function (sh) {
    if (!sh.ports) return;
    sh.ports.L.forEach(function (P) {
      if (P.gone || P.dead) return;
      var t1 = o.open + P.rank * PORT_RANK, t2 = o.close + P.rank * PORT_RANK;
      function opening(x) { return x <= 0 ? 0 : x < PORT_UP ? x / PORT_UP : Math.min(2, 1 + (x - PORT_UP) / PORT_RUN); }
      var s = opening(Math.min(tau, t2) - t1);
      if (tau > t2) {
        s = Math.min(s, 1 + Math.max(0, s - 1) * portLoad(P.g));
        var x = tau - t2, pull = Math.max(0, s - 1) * PORT_IN;
        s = x < pull ? s - x / PORT_IN : Math.max(0, Math.min(1, s) - (x - pull) / PORT_DOWN);
      }
      P.s = s; portPose(P);
    });
  });
}

// ── 每一格（主迴圈 frame() 在預告片模式整格交給這裡）──
// 時鐘：播放中照真實時間走（配樂不斷）；換幕那一格重開一局＋預跑（藏在切鏡的黑場裡）⇒ 下一格照實際過去的時間往前跳；
//   其他的長格 ⇒ 時鐘停在走得到的那一步，配樂從那一秒重接（TR.resync）。序幕（sc.free）⇒ 長格照真實時間跳（最多 1.5 秒）。
function trFrame(ts) {
  if (typeof sndGc === 'function') sndGc();                              // 放完的音效、音符拆掉出口（核心 frame() 每格做；宣傳片接手了 frame ⇒ 這裡做）
  if (!TR.ready) { trUI(); return; }
  var dt = TR.last ? (ts - TR.last) / 1000 : 0; TR.last = ts;
  var free = TR.S[trSceneIx(TR.t)].free;
  var catchup = false;
  if (free && dt > 0.25) dt = Math.min(dt, 1.5);
  else if (dt > 0.25) { if (TR.playing && dt <= 1.4 && !TR.resync && !TR.waitLoad) catchup = true; else { dt = 1 / 60; if (TR.playing) TR.resync = true; } }
  var t = TR.t;
  if (TR.playing) t = Math.min(TR.DUR, t + dt);
  var A = trAt(t), prevT = TR.t;
  TR.waitLoad = false;
  var need = !trSceneLoaded(A.i) || (A.sc.needAll && !TR.loadDone && !TR.still);
  TR.needLoad = need;
  var busy = TR.loadBusy && TR.playing && !A.sc.free && !TR.still;
  if (need || busy) {
    TR.waitLoad = true;
    if (!TR.playing) { TR.buffering = true; trUI(); return; }
    TR.resync = true;
    t = Math.max(0, Math.min(t, A.sc.t0 - 1e-3)); A = trAt(t);
    if (!trSceneLoaded(A.i)) { TR.needLoad = true; trUI(); return; }
  }
  var cut = TR.cur !== A.i || A.n < TR.k;
  var lead = !TR.still && TR.playing && A.u < A.sc.lead;
  TR.live = TR.playing && !TR.resync && !lead && !cut;                  // 預跑（換幕那一口、字卡前導）不出聲
  if (cut && !TR.still && TR.playing) { trStepTo(A.i, lead ? 0 : Math.min(A.n, Math.floor(A.sc.pre / DT + 1e-6)), 0); TR.live = TR.playing && !TR.resync && !lead; }
  var done = trStepTo(A.i, A.n, TR.still ? 0 : lead ? (A.u > A.sc.lead - 0.5 ? 400 : 100) : cut || catchup ? 400 : 100);
  TR.live = false;
  var shown = A;
  if (lead) TR.buffering = TR.waitLoad;
  else if (!done) {
    var tk = trTimeOfStep(A.sc, TR.k);
    if (TR.playing && !TR.still && t - tk <= TR_LAG) { shown = trAt(Math.max(A.sc.t0, Math.min(t, tk))); TR.buffering = TR.waitLoad; TR.lagMax = Math.max(TR.lagMax || 0, t - tk); }
    else { t = tk; A = shown = trAt(t); TR.buffering = true; if (TR.playing) TR.resync = true; }
  } else TR.buffering = TR.waitLoad;
  TR.t = t;
  if (TR.playing && TR.resync && !TR.buffering && !TR.waitLoad) { TR.resync = false; trMusicAt(t); }
  else if (TR.playing && TR.resync) trMusicStop();
  if (TR.playing) { trAudioTick(prevT, t); if (typeof burnSndFrame === 'function') burnSndFrame(); }   // burnSndFrame：船上延燒的火聲（核心 frame() 每格做）
  if (TR.drawnT !== t || TR.dirty) { if (!lead) trDraw(shown); TR.drawnT = t; TR.dirty = false; }
  trOverlay(t, shown);
  if (TR.playing && t >= TR.DUR) trPause(true);
  trUI();
  if (TR.wantT !== null && !TR.buffering && Math.abs(t - TR.wantT) < 1e-6 && !TR.imgPend) {   // 截圖用（?t=…&still=1）：到了那一秒、美術都解碼好了
    if (!window.__trReady) { window.__trReady = true; document.title = 'READY ' + t.toFixed(2) + (DEBUG ? ' ' + trHash() : ''); if (DEBUG) trDbgDump(); }
  }
}
/** ?t=…&still=1&debug=1 到了那一秒 ⇒ 讀數寫進 <pre id="trDbg">（無頭 Chrome --dump-dom 讀：雜湊、步長、擺位、每艘的位置、這一幕的 sc.dbg）。 */
function trDbgDump() {
  var sc = TR.S[TR.cur] || {}, pre = trEl('trDbg') || document.body.appendChild(document.createElement('pre'));
  pre.id = 'trDbg'; pre.style.display = 'none';
  pre.textContent = JSON.stringify({ t: TR.t, scene: sc.id, cur: TR.cur, k: TR.k, sk: TR.sk, simt: +SIMT.toFixed(4), dt: DT, hz: Math.round(1 / DT), step: PHX.step, hash: trHash(),
    place: (sc.fleet || []).map(function (f) { return [f.x, f.z, f.yaw]; }), placed: TR.placed, ships: window.__tr ? window.__tr.ships() : null, dbg: sc.dbg || null, err: TR.err, imgPend: TR.imgPend });
}

// ── 測試入口（?debug=1 才有）：拖到某一秒、讀戰局雜湊（反向對照「同一個 t 同一格」用）──
/** 戰局雜湊（FNV-1a）：步數、幕、砲彈／碎塊／碎木／粒子的數量、碎木位置的總和（咬一口用 Math.random 噴碎木 ⇒ 驗 trSeeded）、每艘的位置、航向、格數、吃水、命中、死傷。 */
function trHash() {
  var ds = 0; for (var i = 0; i < D.n; i++) ds += D.p[i * 3] + D.p[i * 3 + 1] * 3 + D.p[i * 3 + 2] * 7;
  var s = 'k' + TR.k + 'i' + TR.cur + 'b' + BALLS.length + 'p' + PIECES.length + 'd' + D.n + 'ds' + ds.toFixed(2) + 'pt' + PT.n;
  SHIPS.forEach(function (sh) { s += '|' + sh.px.toFixed(4) + ',' + sh.pz.toFixed(4) + ',' + sh.yaw.toFixed(5) + ',' + sh.grid.count + ',' + (sh.sink || 0).toFixed(4) + ',' + (sh.hits || 0) + ',' + (sh.dead || 0); });
  var h = 2166136261; for (var j = 0; j < s.length; j++) { h ^= s.charCodeAt(j); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
if (TRAILER && DEBUG) window.__tr = {
  seek: function (t) {
    var B = trAt(Math.max(0, Math.min(TR.DUR, t)));
    if (!trSceneLoaded(B.i)) return { err: '那一幕的船還沒載好（先 await __tr.load()）', need: trHulls(B.i).filter(function (h) { return !HULLT[h]; }) };   // ⛔ 沒載好就開局 ⇒ 開到一半丟錯、戰局壞掉
    trSeek(t); var A = trAt(TR.t); trStepTo(A.i, A.n, 0); trDraw(A); TR.drawnT = TR.t; return { t: TR.t, i: A.i, k: TR.k, hash: trHash() };
  },
  load: function () { return Promise.all(trHulls().map(loadHull)).then(function () { return trHulls().filter(function (h) { return !!HULLT[h]; }); }); },   // 測試：整支片的船全部載好（?t= 只載那一幕的）
  hash: trHash, state: function () { return { t: TR.t, cur: TR.cur, k: TR.k, sk: TR.sk, dt: DT, step: PHX.step, playing: TR.playing, buffering: TR.buffering, ready: TR.ready, dur: TR.DUR, imgPend: TR.imgPend, err: TR.err }; },
  scenes: function () { return TR.S.map(function (s) { return { i: s.i, t0: s.t0, dur: s.dur, id: s.id || '' }; }); },
  placed: function () { return { want: (TR.S[TR.cur] || { fleet: [] }).fleet.map(function (f) { return [f.x, f.z, f.yaw]; }), got: TR.placed }; },
  setupCost: function (only) { return TR.S.filter(function (sc) { return only === undefined || sc.i === only; }).map(function (sc) { var t0 = performance.now(); trSetup(sc); var t1 = performance.now(), n = Math.floor(sc.pre / DT + 1e-6); for (var k = 0; k < n; k++) { simStep(); TR.k++; } var t2 = performance.now(), m = Math.round(1 / DT); for (k = 0; k < m; k++) { simStep(); TR.k++; } var t3 = performance.now();
    return { id: sc.id, reset: Math.round(t1 - t0), pre: Math.round(t2 - t1), sec1: Math.round(t3 - t2), ships: SHIPS.length }; }); },
  ships: function () { return SHIPS.map(function (s) { return { name: s.name, id: s.T.id, x: +s.px.toFixed(2), z: +s.pz.toFixed(2), yaw: +s.yaw.toFixed(4), spd: +(s.spd || 0).toFixed(2), sink: +(s.sink || 0).toFixed(2), count: s.grid.count, hits: s.hits }; }); },
  imgs: function () { return Object.keys(TR_IMG_SRC).map(function (k) { var im = TR_IMGS[k]; return [k, im ? (im.complete && im.naturalWidth ? im.naturalWidth + '×' + im.naturalHeight : 'loading') : '-']; }); },
  ev: function (src) { return eval(src); }   // 除錯：在核心閉包裡求值（只在 ?debug=1）
};

// ── 開機：照時間軸把要用到的船型載好 ──
function trHulls(onlyI) {
  var L = [];
  TR.S.forEach(function (sc, i) { if (onlyI !== undefined && i !== onlyI) return; sc.fleet.forEach(function (f) { if (L.indexOf(f.hull) < 0) L.push(f.hull); }); });
  return L;
}
// 分散載入：開頭只載第一個序幕（sc.free）之前那幾幕的船 ⇒ ▶ 就能按；其他的照出場順序在背景一艘一艘載。?t=（縮圖、驗收）⇒ 只載那一幕的船。
function trSceneLoaded(i) { return TR.S[i].fleet.every(function (f) { return !!HULLT[f.hull]; }); }
/** 載下一艘之前等：播到有船的幕不載；沒在播（封面）、序幕、這一幕缺船（needLoad）才載。 */
function trLoadGate() {
  return new Promise(function (r) { (function poll() { if (TR.still || !TR.playing || TR.needLoad || TR.S[trSceneIx(TR.t)].free) r(); else setTimeout(poll, 40); })(); });
}
/** 熱身：一種船第一次出場要算一堆跟著船型快取的東西 ⇒ 載好就挑一幕有它、船都載好了、船最少的開一次局（不走模擬、不畫），再丟掉。 */
function trWarm(id) {
  var sc = TR.S.filter(function (s) { return !s.free && s.fleet.some(function (f) { return f.hull === id; }) && trSceneLoaded(s.i); })
    .sort(function (a, b) { return a.fleet.length - b.fleet.length || a.i - b.i; })[0];
  if (!sc) return;
  var live = TR.live, t0 = performance.now(), cur = TR.cur, k = TR.k, sk = TR.sk, simt = SIMT;
  TR.live = false; trSetup(sc);
  if (cur >= 0 && TR.S[cur].free) { trSetup(TR.S[cur]); TR.k = k; TR.sk = sk; SIMT = simt; } else TR.cur = -1;   // 序幕接回原狀（⛔ 只標 cur = −1 ⇒ 序幕從第 0 步重算、時鐘倒退）
  TR.live = live;
  (TR.warmLog = TR.warmLog || []).push([id, sc.id, Math.round(performance.now() - t0)]);
}
function trBoot() {
  trWire();
  TR_API = TR_API || shapiMake();
  if (DEBUG) (function gap(prev) { requestAnimationFrame(function (ts) { if (prev && ts - prev > 50) (TR.gapLog = TR.gapLog || []).push([Math.round(ts), Math.round(ts - prev), TR.loadName, TR.loadN]); gap(ts); }); })(0);
  trScenes();
  var miss = trHulls().filter(function (h) { return TR_HULLS_IN.indexOf(String(h).split('@')[0]) < 0; });
  if (miss.length) { TR.err = '船型沒內嵌：' + miss.join('、') + '（splice.py 照 scenes.js 的 hull: \'…\' 字樣找；換個寫法讓它找得到，或建置時加 --hulls）'; console.error(TR.err); trUI(); return; }
  var only = TR.wantT !== null ? trSceneIx(Math.min(TR.wantT, TR.DUR)) : undefined;
  var pro = TR.S.findIndex(function (s) { return s.free; }), first = [];
  if (only !== undefined) first = trHulls(only);
  else TR.S.slice(0, pro > 0 ? pro : TR.S.length).forEach(function (s, i) { trHulls(i).forEach(function (h) { if (first.indexOf(h) < 0) first.push(h); }); });
  var L = trHulls(only);
  TR.loadAll = L.length; TR.loadN = 0;
  if (!first.length) trReady();
  hullSay = function (s) { TR.loadStep = s; trUI(); };
  L.reduce(function (p, id) {
    var t0;
    return p.then(trLoadGate).then(function () { TR.loadBusy = true; TR.loadName = (hullInfo(id) || {}).name || id; trUI(); t0 = performance.now(); return loadHull(id); }).then(function () {
      TR.loadN++; (TR.loadLog = TR.loadLog || []).push([id, Math.round(performance.now() - t0)]);
      if (!TR.ready && first.every(function (h) { return !!HULLT[h]; })) trReady();
      trUI();
      return new Promise(function (r) { setTimeout(r, 20); });             // 讓一格畫面出去再熱身（⛔ 接著做 ⇒ 一口氣太久，配樂斷一下）
    }).then(function () {
      if (!TR.still && (!TR.playing || TR.waitLoad || TR.S[trSceneIx(TR.t)].free)) trWarm(id);
      TR.loadBusy = false;
      return new Promise(function (r) { setTimeout(r, 20); });
    });
  }, Promise.resolve()).then(function () { TR.loadDone = true; if (!TR.ready) trReady(); trUI(); })
    .catch(function (e) { TR.err = String(e && e.message || e); console.error(e); trUI(); });
}
function trReady() {
  TR.ready = true;
  if (TR.wantT !== null) { TR.t = Math.min(TR.wantT, TR.DUR); TR.wantT = TR.t; }
  trMusicPrep();
}
