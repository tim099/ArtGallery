// ───────────────────────── 天氣（TASK-0523） ─────────────────────────
// 主選單「天氣」：晴（預設）／暴風雨；網址 ?weather=storm。開戰前選、整場不變。
// 進戰局的（物理）：浪（seaH 再乘 sea）、風（煙飄的速度與帆上的風再乘 wind）、航速（乘 speed）、操舵（最大轉向率乘 agile）、
//   開砲的散布（aim：照船搖晃的角速度放大，wxSpread）。
// 只在畫面的：天色（SKY／HORIZON／GROUND）、霧（fog）、陽光（sun：直射光的強度）、水手與碎木的亮度（lum）、浪頭的白沫（foam）、
//   雨（rain，大小再看畫質設定的「雨」）、閃電（bolt：照模擬時間的雜湊挑時刻，不抽亂數；打雷的聲音照距離延後）。
// ⛔ 晴天的每一個係數都是 1（或 0 且有分支擋著）⇒ 跟加天氣之前逐位元組相同：同一個種子的戰局、縮圖都一樣（反向對照）。
//   新的效果一律寫成「晴天剛好是 1 的乘數」，⛔ 不要另外抽 rnd()（會讓晴天的亂數錯位）。
var WEATHERS = {
  clear: { name: '晴', sea: 1, wind: 1, speed: 1, agile: 1, aim: 0, sky: SKY, horizon: HORIZON, ground: GROUND, fog: 0.0016, sun: 1, lum: 1, foam: 0, rain: 0, bolt: 0 },
  storm: { name: '暴風雨', sea: 2.5, wind: 2.2, speed: 1.15, agile: 0.8, aim: 1,
    sky: [0.25, 0.28, 0.32], horizon: [0.34, 0.36, 0.38], ground: [0.13, 0.13, 0.12], fog: 0.0042, sun: 0.3, lum: 0.62, foam: 1, rain: 1, bolt: 1 } };
// 風會變（Tim 2026-10-13：風速、風向在遊戲中變動，照天氣；暴風雨變得快、風速高）：
//   風向 ＝ 開局的風向 ＋ dir ×（三道正弦，權重 0.6／0.3／0.1、週期 per）；風速倍率 WIND_SPD ＝ 1 ＋ spd ×（另外三道，週期再 ×0.73）。
//   每道都寫成 sin(ωt＋φ) − sin φ ⇒ 開局那一刻 ＝ 原本的風；相位照種子的雜湊（不抽亂數）⇒ 同一個種子同一陣風。
//   晴：週期 233／97／41 秒，風向最多偏約 23°、風速 ±30%；暴風雨：71／29／11 秒，風向最多約 70°、風速 0.4–1.6 倍（再乘 wind 2.2）。
//   WIND（00_core.js）每一步就地改：方向給航行（風向係數、頂風失速）、帆、羅盤；長度 ＝ 開局的長度 × WIND_SPD（煙飄的速度）。
//   航速 ∝ √WIND_SPD（31_sailing.js）、帆上的風 × WIND_SPD（30_rig_physics.js）。浪的方向不跟：湧浪是開局那陣風吹出來的（08_sea.js 建一次）。
WEATHERS.clear.gusts = { dir: 0.2, spd: 0.15, per: [233, 97, 41] };
WEATHERS.storm.gusts = { dir: 0.6, spd: 0.3, per: [71, 29, 11] };
// 開局的風（Tim 2026-10-14：起始風向、風速也要隨機）：每一場開局（70_flow.js reset）挑一次 —— 風向相對 WIND0 轉 WIND_ROT（0–360°）、風速倍率 WIND_S0（0.6–1.5；航速 ∝ √）。
//   帶 ?seed 或 ?demo（對拍、縮圖）⇒ 照種子的雜湊、同一個種子同一陣風；一般開戰 ⇒ Math.random()，每一場不同。兩種都不抽 rnd()（戰局的亂數順序不動）。
//   ?wdir=度（相對 WIND0，往 +z 轉為正）、?wspd=倍率 ⇒ 指定（?wdir=0&wspd=1 ＝ 以前固定的那陣風）。浪跟著轉（08_sea.js SEA_A）。
//   ⛔ 以前固定 WIND0（往 +z 吹）⇒ 開局藍方（+z 往 −z）永遠頂風、紅方永遠在上風：4 對 4 電腦對電腦 12 場紅方贏 10 場，策略比不出來（TASK-0551）。
var WIND0 = WIND.slice(), WIND_A0 = Math.atan2(WIND0[2], WIND0[0]), WIND_L0 = Math.hypot(WIND0[0], WIND0[2]), WIND_SPD = 1, WIND_LOG = { a: WIND_A0, s: 1, t: 0 };
var WIND_ROT = 0, WIND_S0 = 1;
var WX_ID = WEATHERS[Q.get('weather')] ? Q.get('weather') : 'clear', WX = WEATHERS[WX_ID];
function seedHash(k) { var x = Math.sin((SEED % 99991) * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); }
function windInit() {
  var pin = Q.has('seed') || DEMO >= 0, u1 = pin ? seedHash(11) : Math.random(), u2 = pin ? seedHash(12) : Math.random();
  WIND_ROT = Q.has('wdir') && isFinite(+Q.get('wdir')) ? +Q.get('wdir') * Math.PI / 180 : u1 * 2 * Math.PI;
  WIND_S0 = Q.has('wspd') && isFinite(+Q.get('wspd')) ? clamp(+Q.get('wspd'), 0.3, 3) : 0.6 + 0.9 * u2;
  SEA_A = WIND_ROT;
}
/** 每一步（50_sim.js step 開頭、70_flow.js 開局）：照模擬時間算現在的風，改 WIND 與 WIND_SPD；風向轉了 20° 以上、風速變了三成以上 ⇒ 上方廣播（15 秒內不重複）。 */
function stepWind(t) {
  var g = WX.gusts, wt = [0.6, 0.3, 0.1], da = 0, ds = 0;
  for (var i = 0; i < 3; i++) {
    var om = 2 * Math.PI / g.per[i], p1 = seedHash(i) * 6.2832, p2 = seedHash(i + 7) * 6.2832;
    da += wt[i] * (Math.sin(om * t + p1) - Math.sin(p1)); ds += wt[i] * (Math.sin(om * 1.37 * t + p2) - Math.sin(p2));
  }
  var a = WIND_A0 + WIND_ROT + g.dir * da; WIND_SPD = WIND_S0 * Math.max(0.4, 1 + g.spd * ds);
  WIND[0] = Math.cos(a) * WIND_L0 * WIND_SPD; WIND[1] = 0; WIND[2] = Math.sin(a) * WIND_L0 * WIND_SPD;
  if (t <= 0) { WIND_LOG = { a: a, s: WIND_SPD, t: 0 }; return; }
  if (t - WIND_LOG.t < 15 || !SHIPS[PLAYER_I]) return;
  var turn = Math.atan2(Math.sin(a - WIND_LOG.a), Math.cos(a - WIND_LOG.a)) * 57.3, ds2 = WIND_SPD / WIND_LOG.s;
  if (Math.abs(turn) >= 20 || ds2 > 1.3 || ds2 < 0.77) {
    var msg = Math.abs(turn) >= 20 ? '風向轉了 ' + Math.round(Math.abs(turn)) + '°（現在從 ' + compassName(bearing(-WIND[0], -WIND[2])) + ' 吹來）' : '';
    if (ds2 > 1.3 || ds2 < 0.77) msg += (msg ? '，' : '') + (ds2 > 1 ? '風勢增強' : '風勢減弱') + '（約 ' + windKnots().toFixed(0) + ' 節）';
    note(SHIPS[PLAYER_I], msg); WIND_LOG = { a: a, s: WIND_SPD, t: t };
  }
}
/** 帆上的風速（節）：給 HUD 與廣播看。 */
function windKnots() { return WIND_SAIL * WIND_K * WX.wind * WIND_SPD * 1.944; }
/** 換天氣：天色跟著換（00_core.js 的 SKY／HORIZON／GROUND；晴天 ＝ 原本那三個陣列本身）。 */
function setWeather(id) {
  WX_ID = WEATHERS[id] ? id : 'clear'; WX = WEATHERS[WX_ID];
  SKY = WX.sky; HORIZON = WX.horizon; GROUND = WX.ground;
  [].forEach.call(document.querySelectorAll('#wxs button'), function (b) { b.className = b.dataset.w === WX_ID ? 'on' : ''; });
}
/** 開砲散布的倍率：晴天 1；暴風雨 ＝ 1.25 ＋ 9 ×（橫搖角速度 ＋ 一半的縱搖角速度，rad/s）—— 船晃得越快，點火那一下差得越多。 */
function wxSpread(sh) {
  if (!WX.aim || !sh.wv) return 1;
  return 1.25 + 9 * (Math.abs(sh.wv.rv) + 0.5 * Math.abs(sh.wv.pv));
}
/** 閃電（只在畫面）：每 0.1 秒一格，照模擬時間的雜湊決定那一格有沒有打（平均約 7 秒一次）；回傳最近一道的亮度（0.3 秒內衰減）與它在哪（方位、多遠）。 */
function wxBolt(t) {
  if (!WX.bolt) return null;
  for (var k = 0; k < 4; k++) {
    var n = Math.floor(t * 10) - k, h = fract(Math.sin(n * 91.7 + 13.1) * 43758.5453);
    if (h < 0.014) { var age = t - n / 10; return { f: Math.max(0, 1 - age / 0.3) * (0.6 + 0.4 * fract(h * 977)), n: n, az: fract(h * 7919) * 6.2832, d: 600 + 1800 * fract(h * 31337) }; }
  }
  return null;
}
function fract(x) { return x - Math.floor(x); }
