// ───────────────────────── 剖面與隱藏甲板（停格的選項；Tim 2026-10-13） ─────────────────────────
// 停格條多兩個：✂ 剖面（Z）＝ 船剖成兩半、拿掉靠鏡頭那一半（鏡頭繞過中線就換邊）；☰ 甲板（L）＝ 由上往下一層一層拿掉，
//   拿到只剩船底再按 ⇒ 全部回來（Loop）。兩個可以一起開。繼續（P）⇒ 都收起（跟透視一樣）。
// 甲板的切高照舷弧逐欄（x）量（deckCut）：船中段兩旁（中線 ±6、±14 格）站得住的高度出現得夠多 ⇒ 一層，再往船頭船尾一欄一欄跟著走（高低差 4 格內）；
//   拿掉第 k 層 ＝ 那層的地板與底下的樑以上都不畫。最下面那層（船底）不拿。
// 開著時：陰影關掉（拿掉的甲板不該再擋光：剖面圖要看得清楚）；剖面另外不畫船附近的海面與白沫（跟透視一樣，再往鏡頭那一側多拿 XR_CUT ⇒ 從側面看得到水線下）。
//   只拿掉甲板 ⇒ 海照畫（船殼裡的海本來就有遮罩；⛔ 也拿 ⇒ 船邊一圈白色的長方形）。
// 只動畫面：船殼、模型、繩、帆照格座標在著色器裡丟掉（01_gl.js CUT_GLSL）；人：站的那一點在拿掉的那一邊就不畫；碎片、粒子、斷開的那幾團不剖。
var CUTV = { half: false, deck: 0 }, CUT_NAMES = ['住艙甲板', '底艙甲板'], XR_CUT = 300;   // XR_CUT：剖面時海面往鏡頭那一側多拿掉幾格（30 m；60_render.js）
function cutOn() { return CUTV.half || CUTV.deck > 0; }
/** 船型的甲板切高（記在 T 上）：{ W, n（拿得掉的層數）, names, rows（第 k 層的切高，逐欄）, tex（R32F，寬 W、高 n） }。 */
function deckCut(sh) {
  var T = sh.T; if (T.cutD) return T.cutD;
  var g = T.base, CY = T.cy, W = g.sx, x, z;
  var zMax = sh.decks.length ? sh.decks[sh.decks.length - 1].zr[1] + 3 : Math.min(g.sz - 12, T.zw + 80);
  var FL = [];                                                            // 每一欄站得住的高度（腳下實心、頭上 1 m 空）
  for (x = 0; x < W; x++) {
    var zs = [];
    if (x >= T.hx0 && x <= T.hx1) [-14, -6, 6, 14].forEach(function (dy) {
      var y = CY + dy;
      for (var z = 2; z <= zMax; z++) { if (!g.get(x, y, z - 1) || g.get(x, y, z)) continue; var h = 1; while (h < 10 && !g.get(x, y, z + h)) h++; if (h === 10 && zs.indexOf(z) < 0) zs.push(z); }
    });
    FL.push(zs);
  }
  var xm = Math.round((T.wl0 + T.wl1) / 2), cnt = {}, ns = 0;               // 船中段 ±30 欄：每個高度出現幾欄
  for (x = xm - 30; x <= xm + 30; x++) { ns++; FL[x].forEach(function (z) { cnt[z] = (cnt[z] || 0) + 1; }); }
  var seeds = [];                                                         // 相差 4 格內併成一層（取出現最多的那個高度），出現在兩成五的欄以上才算
  Object.keys(cnt).map(Number).sort(function (a, b) { return b - a; }).forEach(function (z) {
    var s = seeds[seeds.length - 1];
    if (s && s.z1 - z <= 4) { s.n += cnt[z]; s.z1 = z; if (cnt[z] > s.best) { s.best = cnt[z]; s.z = z; } } else seeds.push({ z: z, z1: z, n: cnt[z], best: cnt[z] });
  });
  seeds = seeds.filter(function (s) { return s.n >= ns * 0.25; });
  var prof = seeds.map(function (s) {                                     // 往船頭、船尾一欄一欄跟著走（找不到 ⇒ 照上一欄的高度延伸）
    var Z = new Float32Array(W).fill(s.z);
    [1, -1].forEach(function (dir) {
      var cur = s.z;
      for (var x = xm; x >= 0 && x < W; x += dir) {
        var best = null; FL[x].forEach(function (z) { if (Math.abs(z - cur) <= 4 && (best === null || Math.abs(z - cur) < Math.abs(best - cur))) best = z; });
        if (best !== null) cur = best;
        Z[x] = cur;
      }
    });
    return Z;
  });
  var n = Math.max(0, prof.length - 1), rows = [], names = [], low = sh.decks.length ? sh.decks[0].zr[0] : 1e9, below = 0;
  for (var k = 0; k < n; k++) {
    var Z = prof[k], runs = [];                                           // 地板＋底下的樑有多厚：船中段兩旁往下數連續的實心格，取九成的那個（最多 6 格；不切到下一層頭頂 1.2 m）
    for (x = T.hx0; x <= T.hx1; x += 2) [-20, -10, 10, 20].forEach(function (dy) { var y = CY + dy, r = 0; while (r < 8 && g.get(x, y, Z[x] - 1 - r)) r++; if (r) runs.push(r); });
    runs.sort(function (a, b) { return a - b; });
    var dep = Math.min(6, runs.length ? runs[Math.floor(runs.length * 0.9)] : 1), R = new Float32Array(W);
    for (x = 0; x < W; x++) R[x] = Math.max(prof[k + 1][x] + 12, Z[x] - dep);
    rows.push(R);
    var zc = Z[xm], D = sh.decks.filter(function (D) { return zc >= D.zr[0] && zc <= D.zr[1]; })[0];
    names.push(D ? D.name : zc < low ? CUT_NAMES[Math.min(below++, CUT_NAMES.length - 1)] : '第 ' + (k + 1) + ' 層');
  }
  var tex = gl.createTexture(), data = new Float32Array(W * Math.max(1, n));
  rows.forEach(function (R, k) { data.set(R, k * W); });
  gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, W, Math.max(1, n), 0, gl.RED, gl.FLOAT, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.activeTexture(gl.TEXTURE0);
  return T.cutD = { W: W, n: n, names: names, rows: rows, tex: tex, floors: prof.map(function (Z) { return Z[xm]; }) };
}
/** 剖哪一邊：鏡頭在中線的哪一邊就拿掉那一邊（+1 ＝ 格 +y）。 */
function cutSide(sh) { return toLocal(sh, CAM.eye)[1] >= sh.T.cy ? 1 : -1; }
/** 畫一艘船（或斷開的那幾團）之前：設好剖面的 uniform。不是兩艘船本身、或沒開 ⇒ 關。 */
function cutSet(prog, ow) {
  var u = prog.u; if (!u.uCut) return;
  if (!cutOn() || SHIPS.indexOf(ow) < 0) { gl.uniform4f(u.uCut, 0, 0, -1, 0); return; }
  var D = deckCut(ow);
  gl.uniform4f(u.uCut, ow.T.cy, CUTV.half ? cutSide(ow) : 0, CUTV.deck > 0 && D.n ? Math.min(CUTV.deck, D.n) - 1 : -1, 1);
  if (u.uCutW) gl.uniform2f(u.uCutW, D.W, Math.max(1, D.n));
  if (u.uCutInv) gl.uniformMatrix4fv(u.uCutInv, false, ow.inv);
  gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_2D, D.tex); gl.uniform1i(u.uCutT, 8); gl.activeTexture(gl.TEXTURE0);
}
/** 這個人在拿掉的那一邊？（drawCrew；墜落中的不管） */
function cutHides(sh, c) {
  if (!cutOn() || c.st === 4 || c.st === 5) return false;
  var p = c.pos;
  if (CUTV.half && cutSide(sh) * (p[1] - sh.T.cy) > 0) return true;
  if (CUTV.deck > 0) { var D = deckCut(sh); if (D.n && p[2] >= D.rows[Math.min(CUTV.deck, D.n) - 1][clamp(Math.floor(p[0]), 0, D.W - 1)]) return true; }
  return false;
}
function cutToggle() { if (!RUNNING || !PAUSED) return; CUTV.half = !CUTV.half; frzShow(); }
/** 甲板：全部 → 拿掉最上面一層 → … → 只剩船底 → 全部（照我艦的層數）。 */
function deckCycle() {
  if (!RUNNING || !PAUSED || !SHIPS[PLAYER_I]) return;
  var n = deckCut(SHIPS[PLAYER_I]).n; CUTV.deck = n ? (CUTV.deck + 1) % (n + 1) : 0; frzShow();
}
/** 停格條上「甲板」那顆的字。 */
function deckLabel() {
  var sh = SHIPS[PLAYER_I]; if (!CUTV.deck || !sh) return '☰ 甲板（L）';
  var D = deckCut(sh), k = Math.min(CUTV.deck, D.n);
  return '☰ ' + (k >= D.n ? '只剩船底' : '拿掉到' + D.names[k - 1]) + '（L）';
}
$('frzCut').onclick = cutToggle; $('frzDeck').onclick = deckCycle;
