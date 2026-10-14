// ───────────────────────── 海浪（TASK-0522） ─────────────────────────
// 物理與畫面共用同一組浪（WAVES）：水面高度 h(x, z, t) ＝ SEA_K × Σ a·sin(kx·x ＋ kz·z − ω·t ＋ φ)，深水色散 ω ＝ √(g·k)。
//   浪向跟著風（WIND，開局固定）：主浪順風，其他幾道偏一點 ⇒ 海面不會整片一條一條。SEA_K ＝ 細節設定的「浪」（0 ＝ 平靜的海）。
//   WAVES 照載入時的風（WIND0）建一次；每一場開局的風向不同（08_weather.js windInit）⇒ 整組浪跟著轉 SEA_A（rad）：
//   水面高度在 p 點 ＝ 原本那組浪在「p 反轉 SEA_A」那一點的高度、坡度再轉回來。SEA_A ＝ 0 ⇒ 跟以前逐位元組相同。
//   著色器是同一個轉法（uniform uSeaA，setCommon 給；⛔ 沒給的程式預設 0 ＝ 不轉，浪不會塌）。
var SEA_A = 0;
// 用到水面高度的（seaH）：砲彈落水與打水漂（21_gunnery.js；03_camera.js 的推算）、碎片與斷開的一團浮沉（12／21／22）、
//   落水的人（40）、垂到水裡的繩（30）、航跡（31）、船的起伏與搖晃（stepWaves，32_hull.js 每步呼叫）。
// 船的起伏：船底 5（船長）× 2（兩舷）個點的水面擬合一個平面 ⇒ 平均高度、縱向坡度、橫向坡度，彈簧阻尼跟過去（船有慣性）。
//   短浪在 54 m 的船長上被平均掉，長浪才搖得動船。sh.wl ＝ 船底的平均水面（絕對高度）、sh.bob ＝ 船身相對它的起伏（彈簧的落後量）
//   ⇒ 進水、電腦瞄水線那些「水線在船上的哪一層」照舊用 sink − lift − bob（相對的），船的矩陣多加 sh.wl（10_ship.js shipMatrix）。
// 畫面（60_render.js 的海面網格）頂點照同一個 h 位移，法線在片段裡照解析的坡度算；細的漣漪只在法線裡、跟畫質走 ——
//   ⛔ 漣漪不進物理 ⇒ 畫質不改戰局。⛔ 相位寫死、不抽 rnd() ⇒ 浪不打亂亂數的順序。
// 七道：波長之間不是整數比、方向左右交錯（⛔ 四道整齊的浪 ⇒ 海面一格一格的重複紋路，Tim 2026-10-13）
var WAVES = [                                   // a 振幅（m，再乘 SEA_K）、L 波長（m）、d 偏離風向幾度、ph 相位
  { a: 0.40, L: 78, d: 0, ph: 0.0 },              // 主浪（週期 7.1 秒）：搖得動整艘船
  { a: 0.24, L: 51, d: 31, ph: 1.7 },
  { a: 0.19, L: 37, d: -23, ph: 4.1 },
  { a: 0.12, L: 26.5, d: 52, ph: 2.3 },
  { a: 0.09, L: 19, d: -61, ph: 5.2 },
  { a: 0.06, L: 13.3, d: 14, ph: 0.9 },
  { a: 0.04, L: 9.1, d: -38, ph: 3.6 }];          // 最短的：船上感覺不到，只看得到
(function () {
  var wa = Math.atan2(WIND[2], WIND[0]);
  WAVES.forEach(function (w) { var k = 2 * Math.PI / w.L, a = wa + w.d * Math.PI / 180; w.kx = Math.cos(a) * k; w.kz = Math.sin(a) * k; w.w = Math.sqrt(G * k); });
})();
/** 水面高度（世界座標 x, z、時間 t）。 */
function seaH(x, z, t) {
  if (!(SEA_K > 0)) return 0;
  var c = Math.cos(SEA_A), s = Math.sin(SEA_A), rx = c * x + s * z, rz = c * z - s * x, h = 0;
  for (var i = 0; i < WAVES.length; i++) { var w = WAVES[i]; h += w.a * Math.sin(w.kx * rx + w.kz * rz - w.w * t + w.ph); }
  return h * SEA_K * WX.sea;                    // 天氣（08_weather.js）：暴風雨 ×2.5；晴天 ×1（逐位元組不變）
}
// 著色器用的同一組浪（常數照 WAVES 生成；uSeaK、uSeaT 在 setCommon 給）。seaH ＝ 高度，seaG ＝ 坡度（∂h/∂x, ∂h/∂z）；
// seaHs ＝ 照網格間距 s 拿掉太短的浪（⛔ 頂點間距比波長的 1/4 還粗 ⇒ 鋸齒、浪在網格上游動）；
// seaGf ＝ 照一個像素在海面上多寬（fp，公尺）淡掉太短的浪的坡度（⛔ 不淡 ⇒ 遠處的浪比像素還細，疊出規則的疊紋）。
var SEA_GLSL = (function () {
  var f = function (v) { var s = (+v).toPrecision(9); return s.indexOf('.') < 0 && s.indexOf('e') < 0 ? s + '.0' : s; };
  var h = [], g = [], hs = [], gf = [];
  WAVES.forEach(function (w) {
    var arg = 'dot(p,vec2(' + f(w.kx) + ',' + f(w.kz) + '))-' + f(w.w) + '*uSeaT+' + f(w.ph);
    h.push(f(w.a) + '*sin(' + arg + ')');
    g.push(f(w.a) + '*cos(' + arg + ')*vec2(' + f(w.kx) + ',' + f(w.kz) + ')');
    hs.push(f(w.a) + '*(1.0-smoothstep(' + f(w.L * 0.18) + ',' + f(w.L * 0.3) + ',s))*sin(' + arg + ')');
    gf.push(f(w.a) + '*(1.0-smoothstep(' + f(w.L * 0.25) + ',' + f(w.L * 0.6) + ',fp))*cos(' + arg + ')*vec2(' + f(w.kx) + ',' + f(w.kz) + ')');
  });
  return 'uniform float uSeaK, uSeaT, uSeaA;\n' +
    'vec2 seaP(vec2 p){ float c=cos(uSeaA), s=sin(uSeaA); return vec2(c*p.x+s*p.y,c*p.y-s*p.x); }\n' +   // 世界 ⇒ 原本那組浪的座標（反轉 uSeaA）
    'vec2 seaV(vec2 g){ float c=cos(uSeaA), s=sin(uSeaA); return vec2(c*g.x-s*g.y,s*g.x+c*g.y); }\n' +   // 坡度轉回世界
    'float seaH(vec2 p){ p=seaP(p); return uSeaK*(' + h.join('+') + '); }\n' +
    'vec2 seaG(vec2 p){ p=seaP(p); return seaV(uSeaK*(' + g.join('+') + ')); }\n' +
    'float seaHs(vec2 p,float s){ p=seaP(p); return uSeaK*(' + hs.join('+') + '); }\n' +
    'vec2 seaGf(vec2 p,float fp){ p=seaP(p); return seaV(uSeaK*(' + gf.join('+') + ')); }\n' +
    '#define SEA_WA (' + f(Math.atan2(WIND[2], WIND[0])) + '+uSeaA)\n';
})();
// 彈簧 [k, c]（k ＝ ωn²、c ＝ 2ζωn）：起伏、縱搖週期 2.5 秒、阻尼比 0.6 ⇒ 長浪（6.9 秒）幾乎同相跟著走；橫搖週期 5 秒、阻尼比 0.35 ⇒ 會晃、會落後一點。
//   ⛔ 起伏設成 5 秒（照巡防艦的固有週期）⇒ 跟主浪差不多快、落後 60°，船身對水面的上下跟浪本身一樣大（量過：相對 0.33 m 對浪 0.32 m），看起來像沒在跟
var WV_K = { h: [6.25, 3.0], p: [6.25, 3.0], r: [1.44, 0.84] };
/** 每步：船底的水面擬合平面 ⇒ 船的起伏、縱搖、橫搖（彈簧阻尼跟過去）。開戰第一步直接放在目標上（不從平的海晃過去）。 */
function stepWaves(sh, dt) {
  var T = sh.T, Lh = (T.hx1 - T.hx0) * S, c = sh.center || [sh.px, 0, sh.pz], F = fwd(sh.yaw), Z = [Math.sin(sh.yaw), 0, Math.cos(sh.yaw)];   // Z：船體 +Z（格 +y、右舷）在世界的方向
  var n = 0, hm = 0, su = 0, uu = 0, sw = 0, ww = 0;
  for (var a = -2; a <= 2; a++) for (var b = -1; b <= 1; b += 2) {
    var u = a * 0.2 * Lh, w = b * 0.1 * Lh, h = seaH(c[0] + F[0] * u + Z[0] * w, c[2] + F[2] * u + Z[2] * w, SIMT);
    hm += h; su += u * h; uu += u * u; sw += w * h; ww += w * w; n++;
  }
  hm /= n;
  var tp = Math.atan(su / uu), tr = -Math.atan(sw / ww);              // 縱搖正 ＝ 船頭（格 +x）抬起；橫搖正 ＝ 船體 +Z 那舷往下 ⇒ 水在 +Z 那邊高就取負
  var V = sh.wv;
  if (!V) V = sh.wv = { h: hm, hv: 0, p: tp, pv: 0, r: tr, rv: 0 };
  V.hv += (WV_K.h[0] * (hm - V.h) - WV_K.h[1] * V.hv) * dt; V.h += V.hv * dt;
  V.pv += (WV_K.p[0] * (tp - V.p) - WV_K.p[1] * V.pv) * dt; V.p += V.pv * dt;
  V.rv += (WV_K.r[0] * (tr - V.r) - WV_K.r[1] * V.rv) * dt; V.r += V.rv * dt;
  sh.wl = hm; sh.bob = V.h - hm; sh.pitchW = V.p; sh.rollW = V.r;
}
