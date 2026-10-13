// ───────────────────────── 畫 ─────────────────────────
var CUBE = null, DEBVAO = null, DEBBUF = null, PTVAO = null, PTBUF = null, SKYVAO = null, SEAG = null;
function geometry() {
  // 方塊：24 頂點（每面 4 個，各帶法線）
  var F = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], V = [], I = [];
  F.forEach(function (n, fi) {
    var a = n[0] ? 0 : n[1] ? 1 : 2, u = (a + 1) % 3, w = (a + 2) % 3;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c) { var p = [0, 0, 0]; p[a] = n[a] * 0.5; p[u] = c[0] * 0.5; p[w] = c[1] * 0.5; V.push(p[0], p[1], p[2], n[0], n[1], n[2]); });
    var b = fi * 4, flip = (n[a] > 0) ? false : true;
    if (!flip) I.push(b, b + 1, b + 2, b, b + 2, b + 3); else I.push(b, b + 2, b + 1, b, b + 3, b + 2);
  });
  DEBVAO = gl.createVertexArray(); gl.bindVertexArray(DEBVAO);
  var vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(V), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
  var ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(I), gl.STATIC_DRAW);
  DEBBUF = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, DEBBUF); gl.bufferData(gl.ARRAY_BUFFER, DINST.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 36, 0); gl.vertexAttribDivisor(2, 1);
  gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 36, 16); gl.vertexAttribDivisor(3, 1);
  gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 1, gl.FLOAT, false, 36, 32); gl.vertexAttribDivisor(4, 1);
  gl.bindVertexArray(null);
  PTVAO = gl.createVertexArray(); gl.bindVertexArray(PTVAO); PTBUF = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, PTBUF); gl.bufferData(gl.ARRAY_BUFFER, PBUF.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 36, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 36, 16); gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 36, 32); gl.bindVertexArray(null);
  SKYVAO = gl.createVertexArray(); gl.bindVertexArray(SKYVAO); var sb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, sb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0); gl.bindVertexArray(null);
}
// 海面網格的細緻度（畫質）：seg 一圈幾格、min 最密的網格間距（m）、det 細漣漪幾道。網格間距往外照比例變粗（同心圓，跟透視一樣近密遠疏），到 4 km
var SEA_LV = [{ seg: 96, min: 1.2, det: 4 }, { seg: 160, min: 0.7, det: 8 }, { seg: 256, min: 0.4, det: 14 }];
/** 海面網格（第 lv 檔）：同心圓，頂點 (dx, dz, 那一圈的間距)，離中心 4 km；中心每格跟著鏡頭（render 給 uC）。 */
function seaGrid(lv) {
  var L = SEA_LV[lv], seg = L.seg, f = 2 * Math.PI / seg, R = [0], i, j;
  while (R[R.length - 1] < 4000) { var r0 = R[R.length - 1]; R.push(r0 + Math.max(L.min, r0 * f)); }
  var V = new Float32Array(R.length * seg * 3), I = new Uint32Array((R.length - 1) * seg * 6), q = 0;
  for (i = 0; i < R.length; i++) for (j = 0; j < seg; j++) { var k = (i * seg + j) * 3, a = j * f; V[k] = Math.cos(a) * R[i]; V[k + 1] = Math.sin(a) * R[i]; V[k + 2] = Math.max(L.min, R[i] * f); }
  for (i = 0; i < R.length - 1; i++) for (j = 0; j < seg; j++) { var a0 = i * seg + j, a1 = i * seg + (j + 1) % seg; I[q++] = a0; I[q++] = a0 + seg; I[q++] = a1; I[q++] = a1; I[q++] = a0 + seg; I[q++] = a1 + seg; }
  var g = SEAG || { vao: gl.createVertexArray(), vb: gl.createBuffer(), ib: gl.createBuffer() };
  gl.bindVertexArray(g.vao); gl.bindBuffer(gl.ARRAY_BUFFER, g.vb); gl.bufferData(gl.ARRAY_BUFFER, V, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, I, gl.STATIC_DRAW); gl.bindVertexArray(null);
  g.n = I.length; g.lv = lv; g.snap = L.min * 2; g.verts = V.length / 3; SEAG = g;
}
/** 船殼外形（原本的，不管被打掉多少）：每個 (x, z) 最外那一格離中線多遠（格）⇒ R8 貼圖，海的著色器拿來判斷「在不在船艙裡」。 */
function hullTex(T, hb) {                              // 船型 T 的海面遮罩（T.hullTex）：每個 (x, z) 船殼最外那一格離中線多遠；hb ＝ 快取的那張（06_cache.js）
  var TW = T.hullTW = T.base.sx, TH = T.hullTH = Math.min(256, T.base.sz);
  T.hullHB = hb = hb || hullMask(T);                   // 留著：存快取、對拍用（__game.hullCheck）
  T.hullTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, T.hullTex); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, TW, TH, 0, gl.RED, gl.UNSIGNED_BYTE, hb);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
}
function hullMask(T) {
  var TW = T.base.sx, TH = Math.min(256, T.base.sz), CY = T.cy, hb = new Uint8Array(TW * TH);
  T.base.each(function (x, y, z) { if (z >= TH) return; var d = Math.min(255, Math.ceil(Math.abs(y + 0.5 - CY))); if (d > hb[z * TW + x]) hb[z * TW + x] = d; });
  return hb;
}
function resize() {
  var dpr = Math.min(window.devicePixelRatio || 1, 1.5), w = Math.max(1, cv.clientWidth * dpr | 0), h = Math.max(1, cv.clientHeight * dpr | 0);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  var k = GFX_RES[GFX.res] || 1;                                       // 解析度（畫質）：場景照這個大小畫，最後縮放貼到畫布
  CAM.w = Math.max(1, Math.round(w * k)); CAM.h = Math.max(1, Math.round(h * k));
}
// ── 畫質管線（TASK-0522；設定在 07_gfx.js 的 GFX） ──
// 場景畫在自己的 framebuffer RT.A（反鋸齒開 ⇒ MSAA 4×），大小 ＝ 畫布 × 解析度；畫完解析到 RT.B、縮放貼到畫布。
// RT.B 也是折射的「海底下那一層」：畫完不透明的東西、畫海之前，A 的顏色與深度複製到 B（GFX.refr ＝ 2），海的著色器讀它。
// 陰影圖每艘船一張（SHM.maps[i]：正交投影罩住那艘船的外接球，從太陽那邊看的深度）：船殼、模型、帆、附近斷開的那一團畫進去；
//   收的那邊（體素、模型、帆、海）兩張都看、取暗的。陰影關 ⇒ 兩張 1×1 的假圖（取樣器的型別要對，⛔ 沒綁 ⇒ 畫不出來）。
// 反射：鏡頭對海面（y ＝ 0）鏡像，把船畫進 RT.R（低 1/4、高 1/2 解析度；水面以下丟掉），海照螢幕座標＋法線擾動讀。浪的起伏不進鏡像（擾動蓋過去）。
// ⛔ 這裡不碰模擬的狀態（反向對照見 07_gfx.js）。帆與繩的緩衝（buildRig／sailBuf）一格只做一次，在所有趟之前（prepRig）。
var RT = null, SHM = null, DUMMY = null, PASS = { vp: null, eye: null, clip: -1e9, sh: 1 }, LAST_BOLT = null;
var MIRROR = new Float32Array([1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), FAR_M = new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 1]);
function mkTex(ifmt, fmt, type, w, h, lin, cmp) {
  var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, null);
  var f = lin ? gl.LINEAR : gl.NEAREST; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (cmp) { gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL); }
  return t;
}
function mkRB(fmt, w, h, s) { var r = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, r); if (s) gl.renderbufferStorageMultisample(gl.RENDERBUFFER, s, fmt, w, h); else gl.renderbufferStorage(gl.RENDERBUFFER, fmt, w, h); return r; }
/** framebuffer：col／dep 是貼圖或 renderbuffer（null ＝ 沒有）。 */
function mkFB(col, dep) {
  var f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  function at(pt, o) { if (!o) return; if (o instanceof WebGLTexture) gl.framebufferTexture2D(gl.FRAMEBUFFER, pt, gl.TEXTURE_2D, o, 0); else gl.framebufferRenderbuffer(gl.FRAMEBUFFER, pt, gl.RENDERBUFFER, o); }
  at(gl.COLOR_ATTACHMENT0, col); at(gl.DEPTH_ATTACHMENT, dep);
  if (!col) { gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE); }
  var ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fb: f, col: col, dep: dep, ok: ok };
}
function freeFB(o) { if (!o) return; gl.deleteFramebuffer(o.fb); [o.col, o.dep].forEach(function (x) { if (x instanceof WebGLTexture) gl.deleteTexture(x); else if (x) gl.deleteRenderbuffer(x); }); }
/** 場景、解析、反射的 framebuffer：大小、反鋸齒、反射品質變了才重建。MSAA 建不起來 ⇒ 不反鋸齒（RT.s ＝ 0）。 */
function targets(w, h) {
  var s = GFX.aa ? Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 0) : 0, rq = GFX.refl;
  if (RT && RT.w === w && RT.h === h && RT.want === s && RT.rq === rq) return;
  if (RT) { freeFB(RT.A); freeFB(RT.B); freeFB(RT.R); }
  RT = { w: w, h: h, want: s, s: s, rq: rq };
  RT.A = mkFB(mkRB(gl.RGBA8, w, h, s), mkRB(gl.DEPTH_COMPONENT24, w, h, s));
  if (!RT.A.ok && s) { freeFB(RT.A); RT.s = 0; RT.A = mkFB(mkRB(gl.RGBA8, w, h, 0), mkRB(gl.DEPTH_COMPONENT24, w, h, 0)); }
  RT.B = mkFB(mkTex(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, w, h, true), mkTex(gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, w, h, false));
  if (rq) { var d = rq === 2 ? 2 : 4, rw = Math.max(1, w / d | 0), rh = Math.max(1, h / d | 0); RT.R = mkFB(mkTex(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, rw, rh, true), mkRB(gl.DEPTH_COMPONENT24, rw, rh, 0)); RT.R.w = rw; RT.R.h = rh; }
  else RT.R = null;
}
/** 陰影圖（兩張）：大小照畫質（關 ⇒ 1×1 的假圖）。off ＝ 收陰影時沿法線推出去的距離（約 1.5 個陰影圖格子）。 */
function shadowMaps() {
  var n = [1, 1024, 2048][GFX.shadow] || 1;
  if (SHM && SHM.n === n) return;
  if (SHM) SHM.maps.forEach(function (m) { freeFB(m.F); });
  SHM = { n: n, off: 0, maps: [0, 1].map(function () { var F = mkFB(null, mkTex(gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, n, n, true, true)); return { F: F, m: FAR_M }; }) };
}
function ortho(r, n, f) { return new Float32Array([1 / r, 0, 0, 0, 0, 1 / r, 0, 0, 0, 0, -2 / (f - n), 0, 0, 0, -(f + n) / (f - n), 1]); }
/** 帆與繩的緩衝：一格做一次（之後陰影、反射、場景都用同一份）。 */
function prepRig() {
  SHIPS.concat(PIECES).forEach(function (ow) {
    var dirty = ow.rigDirty;
    if (dirty) buildRig(ow);
    if (ow.sink > 40) return;
    var tb = DEBUG ? performance.now() : 0;
    if (dirty || (PHYS && ow.crew)) sailBuf(ow);                     // 物理開著：船上的帆每一格重做；斷開的那一團是靜態的
    if (PHYS && ow.crew) looseBuf(ow);
    if (DEBUG) PROF.buf += performance.now() - tb;
  });
}
function drawHulls(prog, near) {                                       // near(c)：只畫靠近 c 的（陰影圖用；沒給 ⇒ 全畫）
  SHIPS.forEach(function (sh) { if (sh.sink > 40 || (near && !near(sh))) return; gl.uniformMatrix4fv(prog.u.uModel, false, sh.M); sh.rs.draw(); });
  PIECES.forEach(function (pc) { if (near && !near(pc)) return; gl.uniformMatrix4fv(prog.u.uModel, false, pc.M); pc.rs.draw(); });
}
function drawModels(prog, near) {
  SHIPS.forEach(function (sh) {
    if (sh.sink > 40 || (near && !near(sh))) return;
    sh.models.forEach(function (m) {
      var me = sh.T.meshes[m.mesh]; if (!m.alive || !me) return;
      gl.uniformMatrix4fv(prog.u.uModel, false, M4.mul(sh.M, modelLocal(m)));
      gl.bindVertexArray(me.vao); gl.drawArrays(gl.TRIANGLES, 0, me.n);
    });
  });
  PIECES.forEach(function (pc) { if (near && !near(pc)) return; (pc.mods || []).forEach(function (m) {      // 跟著斷開的那一團走的模型
    var me = pc.T.meshes[m.mesh]; if (!me) return;
    gl.uniformMatrix4fv(prog.u.uModel, false, M4.mul(pc.M, m.L));
    gl.bindVertexArray(me.vao); gl.drawArrays(gl.TRIANGLES, 0, me.n);
  }); });
  FLY.forEach(function (f) { var me = f.T.meshes[f.mesh]; if (!me || !f.M) return; gl.uniformMatrix4fv(prog.u.uModel, false, f.M); gl.bindVertexArray(me.vao); gl.drawArrays(gl.TRIANGLES, 0, me.n); });
}
function drawSails(prog, near) {
  SHIPS.concat(PIECES).forEach(function (ow) {
    if (ow.sink > 40 || !ow.sb || !ow.sb.n || (near && !near(ow))) return;
    gl.uniformMatrix4fv(prog.u.uModel, false, ow.M);
    gl.bindVertexArray(ow.sb.vao); gl.drawElements(gl.TRIANGLES, ow.sb.n, gl.UNSIGNED_INT, 0);
  });
}
/** 陰影圖：每艘船一張，罩住它的外接球（船型的格子外框對角線的一半）。不在了 ⇒ 那張的矩陣把所有點丟到範圍外。 */
function shadowPass() {
  gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 3);
  gl.viewport(0, 0, SHM.n, SHM.n);
  [0, 1].forEach(function (i) {
    var sh = SHIPS[i], M = SHM.maps[i];
    if (!sh || sh.sink > 40) { M.m = FAR_M; return; }
    var B = sh.T.base, R = sh.T.shR || (sh.T.shR = 0.5 * S * Math.hypot(B.sx, B.sy, B.sz)), c = M4.pt(sh.M, B.sx / 2, B.sy / 2, B.sz / 2), D = R + 30;
    M.m = M4.mul(ortho(R, D - R - 10, D + R + 10), M4.lookAt([c[0] + SUN[0] * D, c[1] + SUN[1] * D, c[2] + SUN[2] * D], c, [0, 1, 0]));
    SHM.off = 1.5 * 2 * R / SHM.n;
    var near = function (o) { if (o === sh) return true; if (o.crew) return false; var p = o.c || (o.M ? [o.M[12], o.M[13], o.M[14]] : c); return Math.hypot(p[0] - c[0], p[2] - c[2]) < R * 1.3; };
    gl.bindFramebuffer(gl.FRAMEBUFFER, M.F.fb); gl.clear(gl.DEPTH_BUFFER_BIT);
    PASS.vp = M.m;
    gl.useProgram(P.dvox.prog); setCommon(P.dvox); drawHulls(P.dvox, near);
    gl.useProgram(P.dtri.prog); setCommon(P.dtri); drawModels(P.dtri, near); drawSails(P.dtri, near);
  });
  PASS.vp = null; gl.disable(gl.POLYGON_OFFSET_FILL);
}
/** 反射：鏡像的鏡頭把船畫進 RT.R（水面以下丟掉）。低 ＝ 船身；高 ＝ 再加砲、模型與帆。 */
function reflPass() {
  var R = RT.R; gl.bindFramebuffer(gl.FRAMEBUFFER, R.fb); gl.viewport(0, 0, R.w, R.h);
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  PASS.vp = M4.mul(CAM.vp, MIRROR); PASS.eye = [CAM.eye[0], -CAM.eye[1], CAM.eye[2]]; PASS.clip = 0; PASS.sh = 0;
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.frontFace(gl.CW);                      // 鏡像 ⇒ 繞序反過來
  gl.useProgram(P.vox.prog); setCommon(P.vox); drawHulls(P.vox);
  gl.frontFace(gl.CCW);
  if (GFX.refl === 2) {
    gl.disable(gl.CULL_FACE); gl.useProgram(P.tri.prog); setCommon(P.tri); gl.uniform1f(P.tri.u.uLit, 1); drawModels(P.tri);
    gl.useProgram(P.sail.prog); setCommon(P.sail); drawSails(P.sail);
  }
  PASS.vp = null; PASS.eye = null; PASS.clip = -1e9; PASS.sh = 1;
}
/** 船艙遮罩的 uniform（海與白沫共用，01_gl.js HULL_GLSL）。開始沉（sinkingFinal）之前，船艙裡不畫海水（Tim 2026-10-12：船身下沉一點點，海面就從破洞、甲板開口看進去像淹了） */
function hullUniforms(prog) {
  var u = prog.u, hide = [0, 1].map(function (i) { var s = SHIPS[i]; return s && !s.sinkingFinal && !s.sunk && s.T.hullTex ? 1 : 0; });   // 每艘照自己船型的遮罩（兩型可以不一樣）
  gl.uniform2f(u.uHide, hide[0], hide[1]);
  [0, 1].forEach(function (i) {
    var s = SHIPS[i], T = s && s.T; if (!T || !T.hullTex) return;
    gl.uniformMatrix4fv(u['uInv' + i], false, s.inv);
    gl.activeTexture(gl.TEXTURE1 + i); gl.bindTexture(gl.TEXTURE_2D, T.hullTex); gl.uniform1i(u['uHull' + i], 1 + i); gl.uniform3f(u['uHullK' + i], T.hullTW, T.hullTH, T.cy);
  });
  gl.activeTexture(gl.TEXTURE0);
}
function render() {
  resize(); var w = CAM.w, h = CAM.h;
  // 閃電（天氣，08_weather.js）：那一格的天空與環境光拉亮、0.3 秒內退掉；雷聲照距離延後（340 m/s）。只在畫面，畫完把天色還回去
  var bolt = wxBolt(SIMT), sky0 = SKY, hor0 = HORIZON;
  if (bolt && bolt.f > 0) { SKY = lerp3(SKY, [0.82, 0.86, 0.98], bolt.f * 0.7); HORIZON = lerp3(HORIZON, [0.76, 0.79, 0.88], bolt.f * 0.6); }
  if (bolt && bolt.n !== LAST_BOLT) { LAST_BOLT = bolt.n; if (RUNNING && !STILL) setTimeout(function () { sfx('thunder', null, 1 / (1 + bolt.d / 1500)); }, bolt.d / 340 * 1000); }
  targets(w, h); shadowMaps();
  if (!DUMMY) { DUMMY = mkTex(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, 1, 1, false); }
  prepRig();
  if (GFX.shadow) shadowPass(); else SHM.maps.forEach(function (m) { m.m = FAR_M; });
  gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, SHM.maps[0].F.dep); gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, SHM.maps[1].F.dep);
  gl.activeTexture(gl.TEXTURE0);
  if (RT.R) reflPass();
  gl.bindFramebuffer(gl.FRAMEBUFFER, RT.A.fb); gl.viewport(0, 0, w, h);
  gl.clearColor(HORIZON[0], HORIZON[1], HORIZON[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
  // 天
  gl.depthMask(false); gl.useProgram(P.sky.prog); setCommon(P.sky); gl.uniformMatrix4fv(P.sky.u.uInv, false, CAM.inv);
  gl.bindVertexArray(SKYVAO); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.depthMask(true);
  // 船與斷開的那幾團
  gl.enable(gl.CULL_FACE); gl.useProgram(P.vox.prog); setCommon(P.vox); drawHulls(P.vox);
  // 碎片
  var n = 0;
  for (var i = 0; i < D.n; i++) {
    var o = i * 3, p;
    if (D.st[i] === 2) { var sh = SHIPS[D.ship[i]]; p = M4.pt(sh.M, D.p[o], D.p[o + 1], D.p[o + 2]); } else p = [D.p[o], D.p[o + 1], D.p[o + 2]];
    var k = n * 9, fade = Math.min(1, D.life[i] / 1.5);
    DINST[k] = p[0]; DINST[k + 1] = p[1]; DINST[k + 2] = p[2]; DINST[k + 3] = D.size[i] * fade;
    DINST[k + 4] = D.q[i * 4]; DINST[k + 5] = D.q[i * 4 + 1]; DINST[k + 6] = D.q[i * 4 + 2]; DINST[k + 7] = D.q[i * 4 + 3]; DINST[k + 8] = D.col[i]; n++;
  }
  if (n) {
    gl.useProgram(P.deb.prog); setCommon(P.deb); gl.bindVertexArray(DEBVAO); gl.bindBuffer(gl.ARRAY_BUFFER, DEBBUF); gl.bufferSubData(gl.ARRAY_BUFFER, 0, DINST, 0, n * 9);
    gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, n);
  }
  drawCrew();
  // 模型、繩與帆
  gl.disable(gl.CULL_FACE); gl.useProgram(P.tri.prog); setCommon(P.tri);
  gl.uniform1f(P.tri.u.uLit, 1); drawModels(P.tri);
  gl.uniform1f(P.tri.u.uLit, 0); gl.vertexAttrib3f(1, 0, 1, 0);
  SHIPS.concat(PIECES).forEach(function (ow) {
    if (ow.sink > 40) return;
    gl.uniformMatrix4fv(P.tri.u.uModel, false, ow.M);
    if (ow.lines && ow.lines.n) { gl.bindVertexArray(ow.lines.vao); gl.drawArrays(gl.LINES, 0, ow.lines.n); }
    if (PHYS && ow.ll && ow.ll.n) { gl.bindVertexArray(ow.ll.vao); gl.drawArrays(gl.LINES, 0, ow.ll.n); }
  });
  gl.useProgram(P.sail.prog); setCommon(P.sail); drawSails(P.sail);
  // 折射（高）：畫海之前的場景複製到 RT.B（顏色＋深度），海的著色器讀它
  if (GFX.refr === 2) {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, RT.A.fb); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, RT.B.fb);
    gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, RT.A.fb);
  }
  // 海
  if (GFX.refr) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); }
  if (!SEAG || SEAG.lv !== GFX.sea) seaGrid(GFX.sea);
  gl.useProgram(P.water.prog); setCommon(P.water); gl.uniform1f(P.water.u.uDet, SEA_LV[GFX.sea].det);
  gl.uniform2f(P.water.u.uC, Math.round(CAM.eye[0] / SEAG.snap) * SEAG.snap, Math.round(CAM.eye[2] / SEAG.snap) * SEAG.snap);   // 中心照網格間距對齊 ⇒ 近處的頂點不在浪上滑動
  gl.uniform1f(P.water.u.uReflOn, RT.R ? 1 : 0); gl.uniform1f(P.water.u.uRefr, GFX.refr); gl.uniform2f(P.water.u.uView, w, h);
  gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, RT.R ? RT.R.col : DUMMY); gl.uniform1i(P.water.u.uRefl, 6);
  gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, RT.B.col); gl.uniform1i(P.water.u.uScene, 7);
  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, RT.B.dep); gl.uniform1i(P.water.u.uSceneD, 3);
  hullUniforms(P.water);
  gl.bindVertexArray(SEAG.vao); gl.drawElements(gl.TRIANGLES, SEAG.n, gl.UNSIGNED_INT, 0);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  wpDrawFoam(hullUniforms);                                              // 船邊水花的白沫（13_water.js）：貼著浪、不寫深度
  flDraw();                                                              // 艙內的水面（33_flood.js，粒子模式）
  // 粒子＋砲彈＋瞄準點
  var m = 0;
  function pushPt(p, s, c, a, ty) { if (m * 9 >= PBUF.length) return; var k = m * 9; PBUF[k] = p[0]; PBUF[k + 1] = p[1]; PBUF[k + 2] = p[2]; PBUF[k + 3] = s; PBUF[k + 4] = c[0]; PBUF[k + 5] = c[1]; PBUF[k + 6] = c[2]; PBUF[k + 7] = a; PBUF[k + 8] = ty === undefined ? -1 : ty; m++; }
  for (i = 0; i < PT.n; i++) { var f = PT.life[i] / PT.max[i], s = PT.s1[i] + (PT.s0[i] - PT.s1[i]) * f; pushPt([PT.p[i * 3], PT.p[i * 3 + 1], PT.p[i * 3 + 2]], s, [PT.c[i * 3], PT.c[i * 3 + 1], PT.c[i * 3 + 2]], PT.a[i] * Math.min(1, f * 3), PT.ty[i]); }
  wpPushSpray(pushPt);                                                   // 船邊水花的水滴（13_water.js）
  flPushJets(pushPt);                                                    // 從破口噴進來的水（33_flood.js）
  BALLS.forEach(function (b) { pushPt(b.p, 0.32, [0.08, 0.08, 0.08], 1); });
  var me = SHIPS[PLAYER_I], mWorld = m;                                   // mWorld 之後的是瞄準圈：另一批畫、不做深度測試（被船身擋住也看得到）
  if (me && me.aim && !AUTOFIRE && !STILL) {
    // 圈：直立，水平軸跟著敵艦的船長方向（扣掉視線方向的分量）⇒ 從側面看跟著敵艦轉；快正對船頭／船尾時改用鏡頭的右方
    // ⛔ 世界固定的平面 ⇒ 敵艦一轉就側成一條線；⛔ 只用船身側面那個平面 ⇒ 從船頭船尾看一樣是一條線
    var fs = SHIPS[1 - PLAYER_I], c = M4.pt(fs.M, me.aim[0], me.aim[1], me.aim[2]), vd = norm(sub(CAM.look, CAM.eye)), ax = shipAxis(fs);
    var u = sub(ax, mul(vd, dot(ax, vd))), ul = len(u);
    u = ul > 0.35 ? mul(u, 1 / ul) : norm(cross(vd, [0, 1, 0]));
    for (i = 0; i < 16; i++) { var an = i / 16 * 6.2832 + SIMT; pushPt(add(c, add(mul(u, Math.cos(an) * 2.2), [0, Math.sin(an) * 2.2, 0])), 0.5, [1, 0.85, 0.3], 0.9); }
  }
  if (m) {
    gl.depthMask(false); gl.useProgram(P.pt.prog); setCommon(P.pt); gl.uniform1f(P.pt.u.uPx, CAM.h / (2 * Math.tan(0.45)));
    gl.uniform1f(P.pt.u.uUseFx, FX_TEX ? 1 : 0); if (FX_TEX) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, FX_TEX); gl.uniform1i(P.pt.u.uFx, 0); }
    gl.bindVertexArray(PTVAO); gl.bindBuffer(gl.ARRAY_BUFFER, PTBUF); gl.bufferSubData(gl.ARRAY_BUFFER, 0, PBUF, 0, m * 9);
    if (mWorld) gl.drawArrays(gl.POINTS, 0, mWorld);
    if (m > mWorld) { gl.disable(gl.DEPTH_TEST); gl.drawArrays(gl.POINTS, mWorld, m - mWorld); gl.enable(gl.DEPTH_TEST); }
    gl.depthMask(true);
  }
  // 雨（天氣 × 畫質的「雨」）：最上面一層，不做深度測試
  var rk = WX.rain * [0, 0.55, 1][GFX.rain || 0];
  if (rk > 0) {
    gl.enable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.useProgram(P.rain.prog);
    gl.uniform1f(P.rain.u.uT, SIMT); gl.uniform1f(P.rain.u.uRain, rk); gl.uniform2f(P.rain.u.uView, w, h);
    gl.uniform1f(P.rain.u.uYaw, Math.atan2(CAM.look[2] - CAM.eye[2], CAM.look[0] - CAM.eye[0]));
    gl.bindVertexArray(SKYVAO); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.enable(gl.DEPTH_TEST);
  }
  SKY = sky0; HORIZON = hor0;
  gl.disable(gl.BLEND); gl.bindVertexArray(null);
  // 收尾：RT.A（MSAA ⇒ 先解析到 RT.B）縮放貼到畫布
  var src = RT.A.fb;
  if (RT.s) { gl.bindFramebuffer(gl.READ_FRAMEBUFFER, RT.A.fb); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, RT.B.fb); gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST); src = RT.B.fb; }
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  gl.blitFramebuffer(0, 0, w, h, 0, 0, cv.width, cv.height, gl.COLOR_BUFFER_BIT, w === cv.width && h === cv.height ? gl.NEAREST : gl.LINEAR);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

