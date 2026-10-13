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
var WX_ID = WEATHERS[Q.get('weather')] ? Q.get('weather') : 'clear', WX = WEATHERS[WX_ID];
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
