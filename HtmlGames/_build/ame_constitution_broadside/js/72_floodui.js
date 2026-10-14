// ───────────────────────── 停格與進水細節頁（Tim 2026-10-13） ─────────────────────────
// P ＝「停格」（以前叫暫停；停住模擬、照樣能轉鏡頭）：上方出現一條「⏸ 停格中　進水：📊 圖表（I）🔍 透視（X）　▶ 繼續（P）」。設定、說明打開時不出現（它們自己會暫停）。
// 進水細節分兩個開關（Tim 2026-10-13：不然圖表會擋住 3D）——只在停格時打得開，繼續就都收起：
//   📊 圖表（FLX，I）：數字與剖面的面板，右上 ✕ 也能關；🔍 透視（FLX3，X）：3D 裡的艙內水面與破口隔著船殼看得到，
//   而且船附近的海面與白沫不畫（Tim 2026-10-13：會影響觀察）⇒ 看得到水線下的船殼與破口。
//   兩艘各一段：數字（積水、破口（水下幾個）、進出水、抽水、下沉、傾斜、水的重心、粒子與水格）＋ 側視、俯視的剖面（艙內的水、破口、外面的水面、設計水線）。
//   透視：艙內的水面不做深度測試（33_flood.js flDraw）、破口畫成點（水下紅；水上橙、小而淡 —— 暴風雨打爛的船水上的洞上百個，⛔ 一樣大 ⇒ 糊成一片，flHoleMarks）。
// 公式模式沒有艙內的水 ⇒ 只寫公式的讀數。⛔ 只讀模擬、不改（停格中沒有在走）。
var FLX = false, FLX3 = false;
/** 每一格（90_main.js frame）：停格條顯示與否；繼續了 ⇒ 進水細節頁收起。 */
function frzShow() {
  var on = RUNNING && PAUSED && !GSET.open && !HELP.open;
  $('frz').classList.toggle('on', on); $('msg').style.visibility = on ? 'hidden' : '';   // 停格條跟上方廣播同一個位置（⛔ 不藏 ⇒ 廣播的字透過半透明的條）
  if (!on) { if (FLX) floodClose(); FLX3 = false; CUTV.half = false; CUTV.deck = 0; }   // 剖面、隱藏甲板也跟著收（74_cutaway.js）
  $('frzFlood').classList.toggle('on', FLX); $('frzX').classList.toggle('on', FLX3);
  $('frzCut').classList.toggle('on', CUTV.half); $('frzDeck').classList.toggle('on', CUTV.deck > 0); $('frzDeck').textContent = deckLabel();
}
/** 船型 T 在格座標的 [中心 x, 中線 y, 半長, 半寬]（設計水線那一層；透視時拿掉附近海面用，01_gl.js nearShip）。 */
function xrBox(T) {
  if (!T.xrB) { var hb = 0; for (var x = T.wl0; x <= T.wl1; x++) hb = Math.max(hb, T.hullHB[T.zw * T.hullTW + x] || 0); T.xrB = [(T.wl0 + T.wl1) / 2, T.cy, (T.wl1 - T.wl0) / 2, hb]; }
  return T.xrB;
}
function xrayToggle() { if (!RUNNING || !PAUSED) return; FLX3 = !FLX3; frzShow(); }   // 按了就更新按鈕（⛔ 只靠每一格的 frzShow ⇒ 分頁在背景時按鈕不動）
function floodOpen() { if (!RUNNING || !PAUSED) return; FLX = true; $('floodp').classList.add('on'); floodPanel(); frzShow(); }
function floodClose() { FLX = false; $('floodp').classList.remove('on'); $('frzFlood').classList.remove('on'); }
function floodToggle() { if (FLX) floodClose(); else floodOpen(); }
$('frzFlood').onclick = floodToggle; $('frzX').onclick = xrayToggle;
$('frzGo').onclick = function () { PAUSED = false; frzShow(); };
$('floodX').onclick = floodClose;
function deg(a) { return (a * 57.2958).toFixed(1) + '°'; }
/** 填進水細節頁：兩艘各一段，畫完剖面。 */
function floodPanel() {
  var box = $('floodBody');
  box.innerHTML = SHIPS.map(function (sh, k) {
    var fl = sh.fl, who = (k === PLAYER_I ? '我艦' : sh.team === playerTeam() ? '友艦' : '敵艦') + ' ' + sh.name, lines;
    var tilt = '橫傾 ' + deg(sh.rollA) + (sh.rollA > 0.002 ? '（往' + sideName('S') + '）' : sh.rollA < -0.002 ? '（往' + sideName('P') + '）' : '') + '・縱傾 ' + deg(sh.pitchA) + (sh.pitchA < -0.002 ? '（船頭低）' : sh.pitchA > 0.002 ? '（船尾低）' : '');
    if (!fl || sh.broken) {
      lines = '<div>' + (sh.broken ? '斷成兩截 ⇒ 照公式（一定沉）' : '公式模式（物理效果「進水」選粒子才看得到艙內的水）') + '</div>' +
        '<div>水線下打掉 ' + (sh.inflow || 0).toLocaleString() + ' 格・下沉 ' + sh.sink.toFixed(2) + ' m・' + tilt + '</div>';
      return '<div class="fpS"><div class="fpH">' + who + '</div>' + lines + '</div>';
    }
    var under = 0, uA = 0;
    fl.holes.forEach(function (h) { if (!(fl.hA[h] > 0)) return; var P = M4.pt(sh.M, fl.hX[h], fl.hY[h], fl.hZ[h]); if (P[1] < seaH(P[0], P[2], SIMT)) { under++; uA += fl.hA[h]; } });
    lines = '<div>艙內積水 <b>' + Math.round(fl.vol * RHO_W).toLocaleString() + ' 噸</b>（' + fl.vol.toFixed(1) + ' m³）・破口 ' + fl.open + ' 處 ' + fl.area.toFixed(2) + ' m²，水下 ' + under + ' 處 ' + uA.toFixed(2) + ' m²</div>' +
      '<div>進水 ' + fl.inQ.toFixed(2) + ' m³/s・往外流 ' + fl.outQ.toFixed(2) + ' m³/s・累計 進 ' + fl.inTot.toFixed(0) + '／出 ' + fl.outTot.toFixed(0) + '／抽掉 ' + fl.pumped.toFixed(0) + ' m³</div>' +
      '<div>下沉 ' + sh.sink.toFixed(2) + ' m（照水該 ' + fl.sinkT.toFixed(2) + '；4.2 m 開始沉）・' + tilt + '</div>' +
      '<div>水的重心：' + (Math.abs(fl.comY) < 0.05 ? '在中線' : '偏' + sideName(fl.comY > 0 ? 'S' : 'P') + ' ' + Math.abs(fl.comY).toFixed(1) + ' m') + '・' + (fl.comX >= 0 ? '偏船頭 ' : '偏船尾 ') + Math.abs(fl.comX).toFixed(1) + ' m・噴進來的水 ' + fl.J.n + ' 顆・水格 ' + fl.actN + ' 格（邊長 ' + (fl.F.c * S).toFixed(1) + ' m）</div>' +
      '<div class="fpL">側視（船頭在右）</div><canvas class="fpC" id="fpS' + k + '"></canvas><div class="fpL">俯視（船頭在右、' + sideName('P') + '在上）</div><canvas class="fpC" id="fpT' + k + '"></canvas>';
    return '<div class="fpS"><div class="fpH">' + who + '</div>' + lines + '</div>';
  }).join('');
  // 剖面等下一格再畫：⛔ 剛換掉 innerHTML 就量 clientWidth ⇒ 第一次打開量到 24 px（量過），剖面縮成一小塊
  requestAnimationFrame(function () { if (FLX) SHIPS.forEach(function (sh, k) { if (sh.fl && !sh.broken && $('fpS' + k)) { fpDraw($('fpS' + k), sh, 0); fpDraw($('fpT' + k), sh, 1); } }); });
}
window.addEventListener('resize', function () { if (FLX) floodPanel(); });
/** 剖面：view 0 側視（x × z，沿船寬加總）、1 俯視（x × y，沿高度加總）。灰 ＝ 艙內空間、藍 ＝ 水（越滿越深）、紅點 ＝ 水下的破口、橙點 ＝ 水上的、青線 ＝ 外面的水面、虛線 ＝ 設計水線。 */
function fpDraw(cv, sh, view) {
  var fl = sh.fl, F = fl.F, c = F.c, NX = F.NX, NY = F.NY, NZ = F.NZ, NXY = NX * NY, Vc = Math.pow(c * S, 3), A = fl.A, cap = fl.cap;
  var NV = view ? NY : NZ, dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth || 600, h = Math.max(40, Math.round(w * NV / NX));
  cv.style.height = h + 'px'; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  var g = cv.getContext('2d'), cw = cv.width / NX, ch = cv.height / NV, a, b, k;
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, cv.width, cv.height);
  var capS = new Float32Array(NX * NV), watS = new Float32Array(NX * NV);
  for (k = 0; k < F.N; k++) {
    if (!(cap[k] > 0.02)) continue;
    var ix = k % NX, iy = ((k / NX) | 0) % NY, iz = (k / NXY) | 0, j = (view ? iy : iz) * NX + ix;
    capS[j] += cap[k] * Vc; watS[j] += A[k];
  }
  for (b = 0; b < NV; b++) for (a = 0; a < NX; a++) {
    var q = b * NX + a; if (!(capS[q] > 0)) continue;
    var y0 = view ? b * ch : (NV - 1 - b) * ch;                          // 側視：z 往上；俯視（從上往下看、船頭在右）：格 +y（右舷）在下
    g.fillStyle = 'rgba(150,150,140,0.45)'; g.fillRect(a * cw, y0, cw + 0.5, ch + 0.5);
    if (watS[q] > 1e-4) { var f = Math.min(1, watS[q] / capS[q]); g.fillStyle = 'rgba(40,140,230,' + (0.35 + 0.65 * f).toFixed(2) + ')'; g.fillRect(a * cw, y0, cw + 0.5, ch + 0.5); }
  }
  var M = sh.M, px = function (x) { return (x - F.X0) / c * cw; }, pv = function (v) { return view ? (v - F.Y0) / c * ch : cv.height - v / c * ch; };
  if (!view) {
    g.setLineDash([4 * dpr, 4 * dpr]); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = dpr; g.beginPath(); g.moveTo(0, pv(sh.T.zw)); g.lineTo(cv.width, pv(sh.T.zw)); g.stroke(); g.setLineDash([]);
    g.strokeStyle = 'rgba(80,230,255,0.9)'; g.lineWidth = 1.5 * dpr; g.beginPath();
    for (a = 0; a <= NX; a++) {                                            // 外面的水面（中線上）：那一點的世界水面換回船上的高度
      var x = F.X0 + a * c, W0 = M4.pt(M, x, sh.T.cy, sh.T.zw), hs = seaH(W0[0], W0[2], SIMT), z = (hs - (M[1] * x + M[5] * sh.T.cy + M[13])) / M[9];
      if (a) g.lineTo(px(x), pv(z)); else g.moveTo(px(x), pv(z));
    }
    g.stroke();
  }
  fl.holes.forEach(function (hh) {
    if (!(fl.hA[hh] > 0)) return;
    var P = M4.pt(M, fl.hX[hh], fl.hY[hh], fl.hZ[hh]), wet = P[1] < seaH(P[0], P[2], SIMT), r = Math.max(1.5 * dpr, Math.sqrt(fl.hA[hh]) / 2 / (c * S) * cw * 1.3);   // 照洞的實際大小（⛔ 固定像素 ⇒ 手機上的剖面整排紅點糊成一條）
    g.fillStyle = wet ? 'rgba(255,60,50,0.95)' : 'rgba(255,170,40,0.85)'; g.beginPath(); g.arc(px(fl.hX[hh]), pv(view ? fl.hY[hh] : fl.hZ[hh]), r, 0, 6.2832); g.fill();
  });
}
/** 透視開著：破口在 3D 裡畫成點（不做深度測試 ⇒ 隔著船殼看得到；60_render.js 瞄準圈那一批）。水下的紅、照洞的大小；水上的橙、小而淡。 */
function flHoleMarks(pushPt) {
  SHIPS.forEach(function (sh) {
    var fl = sh.fl; if (!fl || sh.broken || sh.sinkingFinal || sh.sunk) return;
    fl.holes.forEach(function (h) {
      if (!(fl.hA[h] > 0)) return;
      var P = M4.pt(sh.M, fl.hX[h], fl.hY[h], fl.hZ[h]), wet = P[1] < seaH(P[0], P[2], SIMT);
      if (wet) pushPt(P, 0.25 + Math.sqrt(fl.hA[h]) * 0.8, [1, 0.25, 0.2], 0.95); else pushPt(P, 0.12 + Math.sqrt(fl.hA[h]) * 0.25, [1, 0.65, 0.15], 0.45);
    });
  });
}
