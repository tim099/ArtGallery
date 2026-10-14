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
/** 船殼外形（原本的，不管被打掉多少）：每個 (x, z) 最外那一格離中線多遠（格）⇒ 海的著色器拿來判斷「在不在船艙裡」。
 *  這裡只算資料（T.hullHB、寬高）；上 GPU 是所有船型併成一個貼圖陣列（hullArr，畫的時候看到新的船型才重建）。 */
function hullTex(T, hb) {                              // hb ＝ 快取的那張（06_cache.js）
  T.hullTW = T.base.sx; T.hullTH = Math.min(256, T.base.sz);
  T.hullHB = hb || hullMask(T);                        // 存快取、對拍用（__game.hullCheck）
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
/** 陰影圖：深度貼圖陣列（SHM.tex，第 4 號），每一層一張、大小照畫質（關 ⇒ 1×1 的假圖）。off ＝ 收陰影時沿法線推出去的距離（約 1.5 個陰影圖格子）；offG ＝ 全局那一層的。
 *  SHM.maps[k] ＝ 第 k 層的 { F（畫進那一層的 framebuffer）, m（矩陣） }：前 SSLOTS.length 層 ＝ 陰影的格、下一層 ＝ 全局（有的話）。
 *  SHM.mats ＝ 著色器的 uShM（MAX_SHIPS＋1 個）：第 k 個 ＝ 第 k 格、最後一個 ＝ 全局。 */
function shadowMaps() {
  var n = [1, 1024, 2048][GFX.shadow] || 1;
  if (SHM && SHM.n === n) return;
  if (SHM) shadowFree();
  SHM = { n: n, off: 0, offG: 0, maps: [], tex: null, layers: 0, glob: false, mats: new Float32Array((MAX_SHIPS + 1) * 16) };
}
function shadowFree() { SHM.maps.forEach(function (m) { gl.deleteFramebuffer(m.F.fb); }); if (SHM.tex) gl.deleteTexture(SHM.tex); SHM.maps = []; SHM.tex = null; SHM.layers = 0; }
/** 陰影圖陣列照用到的層數配（TASK-0537：沒用到的不佔記憶體）：陰影的格數 ＋ 有船排不進去 ⇒ 再一層全局。不夠才重配、多了不收（換場又會用到）。 */
function shadowGrow() {
  var need = Math.max(1, SSLOTS.length + (SSLOTS.rest.length ? 1 : 0));
  if (SHM.layers >= need) return;
  shadowFree();
  var t = SHM.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
  gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.DEPTH_COMPONENT24, SHM.n, SHM.n, need, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
  [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(function (p) { gl.texParameteri(gl.TEXTURE_2D_ARRAY, p, gl.LINEAR); });
  [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(function (p) { gl.texParameteri(gl.TEXTURE_2D_ARRAY, p, gl.CLAMP_TO_EDGE); });
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
  for (var k = 0; k < need; k++) {
    var f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, t, 0, k); gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    SHM.maps.push({ F: { fb: f, ok: gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE }, m: FAR_M });
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  SHM.layers = need;
}
/** GPU 的格這一格給哪幾艘（Tim 2026-10-13：「優先選最近的 N 條船」「超過的靠全局覆蓋」「只選視野範圍內最近的」；N 是畫質設定）：
 *  · SSLOTS：自己的陰影圖，GFX.shships 艘（0～MAX_SHIPS）；排不進去的 SSLOTS.rest ⇒ 全局陰影圖。
 *  · MSLOTS：船艙遮罩與透視，GFX.masks 艘（0～MASK_NEAR）；排不進去的沒有。
 *  船數 ≤ N ⇒ 全部、照 SHIPS 的順序（一對一跟以前一樣）；否則 ⇒ 外接球碰到鏡頭視錐的船裡離鏡頭最近的 N 艘，
 *  上一格已經在裡面的打九折（⛔ 不打折 ⇒ 兩艘差不多遠時每一格換來換去、陰影閃）；選到的照 SHIPS 的順序排。 */
var SSLOTS = [], MSLOTS = [];
SSLOTS.rest = MSLOTS.rest = [];
function gpuSlots() {
  var cand = null;
  function pick(n, prev) {
    var L;
    if (SHIPS.length <= n) L = SHIPS.slice();
    else {
      if (!cand) {
        var vp = CAM.vp, pl = [];                                         // 視錐的六個面（列優先的矩陣：第 r 列 ＝ vp[r], vp[4+r], vp[8+r], vp[12+r]）
        [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]].forEach(function (q) {
          var a = [0, 1, 2, 3].map(function (c) { return vp[c * 4 + 3] + q[1] * vp[c * 4 + q[0]]; }), l = Math.hypot(a[0], a[1], a[2]) || 1;
          pl.push(a.map(function (v) { return v / l; }));
        });
        cand = SHIPS.map(function (s) {
          var B = s.T.base, R = s.T.shR || (s.T.shR = 0.5 * S * Math.hypot(B.sx, B.sy, B.sz)), c = M4.pt(s.M, B.sx / 2, B.sy / 2, B.sz / 2);
          return { s: s, vis: s.sink <= 40 && pl.every(function (p) { return p[0] * c[0] + p[1] * c[1] + p[2] * c[2] + p[3] > -R; }), d: Math.hypot(c[0] - CAM.eye[0], c[1] - CAM.eye[1], c[2] - CAM.eye[2]) };
        });
      }
      L = cand.filter(function (o) { return o.vis; }).map(function (o) { return { s: o.s, d: o.d * (prev.indexOf(o.s) >= 0 ? 0.9 : 1) }; })
        .sort(function (a, b) { return a.d - b.d || a.s.i - b.s.i; }).slice(0, n).map(function (o) { return o.s; }).sort(function (a, b) { return a.i - b.i; });
    }
    L.rest = SHIPS.filter(function (s) { return L.indexOf(s) < 0; });
    return L;
  }
  SSLOTS = pick(GFX.shships, SSLOTS); MSLOTS = pick(Math.min(GFX.masks, MASK_NEAR), MSLOTS);
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
// 重網格化（TASK-0531）：打掉的格要重建那幾個區塊的網格（VoxelKit RegionSet：dirty 裡的區塊 → meshChunk → 那一區重新上傳）。
//   畫面迴圈每一格最多 RM_BUDGET 塊（殉爆、斷船一次上千塊 ⇒ 那一格卡 170 ms）；先做斷開的那幾團（新建的）、再做船
//   ⇒ 半截船先長出來、船身那邊才拿掉 ⇒ 中間那幾格只會兩份疊在一起（位置一樣、看不出來），不會開洞。
//   快轉（__game.run、?demo）一次做完（remesh(Infinity)）⇒ 縮圖不變。只動畫面：格子本身在模擬那一步就改好了。
//   ⛔ 不改 VoxelKit：RegionSet.dirty 是公開的 Set，這裡先把超出預算的拿出來、flush 完再放回去。
var RM_BUDGET = 96;
function rsAllDirty(rs) { var t = rs.grid.tab; for (var i = 0; i < t.length; i++) if (t[i] !== null) rs.dirty.add(i); }   // 新建的一團：整份排進去（＝ buildAll，只是分批）
function rsFlushSome(rs, n) {
  var k = rs.dirty.size; if (k <= n) { rs.flush(); return k; }
  var rest = [], j = 0;
  rs.dirty.forEach(function (i) { if (j++ >= n) rest.push(i); });
  rest.forEach(function (i) { rs.dirty.delete(i); }); rs.flush(); rest.forEach(function (i) { rs.dirty.add(i); });
  return n;
}
function remesh(budget) {
  var left = budget;
  PIECES.concat(SHIPS).forEach(function (o) { if (left > 0 && o.rs.dirty.size) left -= rsFlushSome(o.rs, left); });
}
function drawHulls(prog, near) {                                       // near(c)：只畫靠近 c 的（陰影圖用；沒給 ⇒ 全畫）
  SHIPS.forEach(function (sh) { if (sh.sink > 40 || (near && !near(sh))) return; cutSet(prog, sh); vlampSet(prog, sh); gl.uniformMatrix4fv(prog.u.uModel, false, sh.M); sh.rs.draw(); });   // cutSet：剖面與隱藏甲板（74_cutaway.js）
  cutSet(prog, null); vlampSet(prog, null);
  PIECES.forEach(function (pc) { if (near && !near(pc)) return; gl.uniformMatrix4fv(prog.u.uModel, false, pc.M); pc.rs.draw(); });
}
function drawModels(prog, near) {
  SHIPS.forEach(function (sh) {
    if (sh.sink > 40 || (near && !near(sh))) return;
    cutSet(prog, sh);
    sh.models.forEach(function (m) {
      var me = sh.T.meshes[m.mesh]; if (!m.alive || !me) return;
      gl.uniformMatrix4fv(prog.u.uModel, false, M4.mul(sh.M, modelLocal(m)));
      if (prog.u.uGlow) gl.uniform1f(prog.u.uGlow, isLamp(m) ? lanternK(m) : 0);   // 取用點的火藥桶是後加的模型，沒有 meta
      gl.bindVertexArray(me.vao); gl.drawArrays(gl.TRIANGLES, 0, me.n);
    });
  });
  if (prog.u.uGlow) gl.uniform1f(prog.u.uGlow, 0);                     // 斷開的那一團、飛出去的模型：燈熄了
  cutSet(prog, null);
  PIECES.forEach(function (pc) { if (near && !near(pc)) return; (pc.mods || []).forEach(function (m) {      // 跟著斷開的那一團走的模型
    var me = pc.T.meshes[m.mesh]; if (!me) return;
    gl.uniformMatrix4fv(prog.u.uModel, false, M4.mul(pc.M, m.L));
    gl.bindVertexArray(me.vao); gl.drawArrays(gl.TRIANGLES, 0, me.n);
  }); });
  FLY.forEach(function (f) { var me = f.T.meshes[f.mesh]; if (!me || !f.M) return; gl.uniformMatrix4fv(prog.u.uModel, false, f.M); gl.bindVertexArray(me.vao); gl.drawArrays(gl.TRIANGLES, 0, me.n); });
}
/** 燈（餘燼號船尾三盞燈籠 meta kind=lantern、夜燈號船首像的提燈 kind=light）：燈罩發光、光暈、點光源。 */
function isLamp(m) { return !!(m.meta && (m.meta.kind === 'lantern' || m.meta.kind === 'light')); }
/** 火焰在哪（船的格座標）：固定點 wick（造船規格：火焰中心）；沒有 ⇒ 模型中心。 */
function lampAt(m) { return m.pts && m.pts.wick ? m.pts.wick : m.c; }
/** 這一格的點光源（01_gl.js LAMP_GLSL）：離鏡頭近的 LAMP_N 盞；亮度跟著燈晃、天越暗越亮（跟光暈同一條）。只給人看、不抽 rnd()。 */
var LAMPS = { n: 0, p: new Float32Array(LAMP_N * 4), c: new Float32Array(LAMP_N * 4) }, LAMP_R = 6, LAMP_I = 0.5;
/** 船殼上的燈（格子，config ships[].lamps：at ＝ 中心（格座標）、r ＝ 半徑幾格、color ＝ 發光的那種格子（rgb332 代碼）、rgb ＝ 光色）還亮著嗎：中心旁 3×3×3 還有格子。 */
function vlampOn(sh, L) { var x = Math.floor(L.at[0]), y = Math.floor(L.at[1]), z = Math.floor(L.at[2]); for (var dz = -1; dz <= 1; dz++) for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) if (sh.grid.get(x + dx, y + dy, z + dz)) return true; return false; }
var VLAMP_U = { p: new Float32Array(VLAMP_N * 4), c: new Float32Array(VLAMP_N * 4) };
/** 畫這艘船的船殼前：它的燈（亮著的）給著色器；ow ＝ null（斷開的那一團、陰影那一趟）⇒ 0 盞。 */
function vlampSet(prog, sh) {
  if (!prog.u.uVGN) return;
  var Ls = sh && !sh.sunk ? (sh.vlamps || []) : [], n = Math.min(VLAMP_N, Ls.length);
  gl.uniform1i(prog.u.uVGN, n); if (!n) return;
  for (var i = 0; i < n; i++) { var L = Ls[i]; VLAMP_U.p.set([L.at[0], L.at[1], L.at[2], L.r], i * 4); VLAMP_U.c.set([L.rgb[0], L.rgb[1], L.rgb[2], L.color], i * 4); }
  gl.uniform4fv(prog.u.uVG, VLAMP_U.p); gl.uniform4fv(prog.u.uVGC, VLAMP_U.c); gl.uniform1f(prog.u.uVGK, 0.85 + 0.1 * Math.sin(SIMT * 1.3));
}
function lampsUpdate() {
  var L = [], E = CAM.eye;
  SHIPS.forEach(function (sh) {
    if (sh.sink > 40) return;
    sh.vlamps = (sh.T.lamps || []).filter(function (V) { return vlampOn(sh, V); });   // 船殼上的燈：被打掉 ⇒ 熄（發光、點光源、光暈一起）
    sh.vlamps.forEach(function (V, j) { var w = M4.pt(sh.M, V.at[0], V.at[1], V.at[2]); L.push({ w: w, k: 0.9 + 0.1 * Math.sin(SIMT * 1.3 + j), rgb: V.rgb, d: (w[0] - E[0]) * (w[0] - E[0]) + (w[1] - E[1]) * (w[1] - E[1]) + (w[2] - E[2]) * (w[2] - E[2]) }); });
    sh.models.forEach(function (m) { if (!m.alive || !isLamp(m)) return; var q = lampAt(m), w = M4.pt(sh.M, q[0], q[1], q[2]); L.push({ w: w, k: lanternK(m), d: (w[0] - E[0]) * (w[0] - E[0]) + (w[1] - E[1]) * (w[1] - E[1]) + (w[2] - E[2]) * (w[2] - E[2]) }); });
  });
  L.sort(function (a, b) { return a.d - b.d; });
  LAMPS.n = Math.min(LAMP_N, L.length);
  for (var i = 0; i < LAMPS.n; i++) {
    var l = L[i], I = LAMP_I * l.k * (1.6 - WX.lum);
    var cl = l.rgb || [1, 0.62, 0.25];                                 // 模型的燈 ＝ 暖橘；船殼上的燈照 config 的光色
    LAMPS.p.set([l.w[0], l.w[1], l.w[2], LAMP_R], i * 4); LAMPS.c.set([cl[0] * I, cl[1] * I, cl[2] * I, 0], i * 4);
  }
}
/** 燈籠／提燈：亮度 0.8–1 慢慢晃，照模擬時間與燈的編號（⛔ 不抽 rnd()：只給人看）；打飛了就熄。 */
function lanternK(m) { var t = SIMT * 1.7 + m.k * 2.39; return 0.8 + 0.1 * Math.sin(t) + 0.1 * Math.sin(t * 2.71 + 1.3); }
function lanternHalo(push) {
  SHIPS.forEach(function (sh) {
    if (sh.sink > 40) return;
    (sh.vlamps || []).forEach(function (V, j) { var k = 0.9 + 0.1 * Math.sin(SIMT * 1.3 + j); push(M4.pt(sh.M, V.at[0], V.at[1], V.at[2]), V.r * S * (2.4 + 0.4 * k), V.rgb, 0.18 + 0.2 * k * (1.6 - WX.lum)); });   // 船殼上的燈的光暈（照它的光色）
    sh.models.forEach(function (m) {
      if (!m.alive || !isLamp(m)) return;
      var k = lanternK(m), sz = Math.max(m.bb[3] - m.bb[0], m.bb[5] - m.bb[2]) * S, q = lampAt(m);   // 燈多大（公尺）；光暈在火焰那一點
      push(M4.pt(sh.M, q[0], q[1], q[2]), sz * (2.4 + 0.4 * k), [1, 0.6, 0.2], 0.18 + 0.2 * k * (1.6 - WX.lum));   // 天越暗越亮（暴風雨的 lum 比晴天低）
    });
  });
}
function drawSails(prog, near) {
  if (prog.u.uSailT) gl.uniform1i(prog.u.uSailT, SAIL_UNIT);           // 帆的貼圖集（TASK-0579；11_rig_gpu.js sailTex）：固定第 9 號
  SHIPS.concat(PIECES).forEach(function (ow) {
    if (ow.sink > 40 || !ow.sb || !ow.sb.n || (near && !near(ow))) return;
    cutSet(prog, ow); gl.uniformMatrix4fv(prog.u.uModel, false, ow.M);
    gl.activeTexture(gl.TEXTURE0 + SAIL_UNIT); gl.bindTexture(gl.TEXTURE_2D, sailTex(ow.T)); gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(ow.sb.vao); gl.drawElements(gl.TRIANGLES, ow.sb.n, gl.UNSIGNED_INT, 0);
  });
}
/** 陰影圖：GPU 的每一格（gpuSlots）一層，罩住那艘的外接球（船型的格子外框對角線的一半）。那一格沒有船 ⇒ 矩陣把所有點丟到範圍外。
 *  有船排不進去（SSLOTS.rest）⇒ 下一層 ＝ 全局：一張罩住那幾艘全部的外接球（格子大、解析度低；近的那幾艘不畫進去 ⇒ 不會粗的疊在細的上面）。 */
function shadowPass() {
  gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 3);
  gl.viewport(0, 0, SHM.n, SHM.n);
  function one(M, R, c, near) {
    var D = R + 30;
    M.m = M4.mul(ortho(R, D - R - 10, D + R + 10), M4.lookAt([c[0] + SUN[0] * D, c[1] + SUN[1] * D, c[2] + SUN[2] * D], c, [0, 1, 0]));
    gl.bindFramebuffer(gl.FRAMEBUFFER, M.F.fb); gl.clear(gl.DEPTH_BUFFER_BIT);
    PASS.vp = M.m;
    gl.useProgram(P.dvox.prog); setCommon(P.dvox); drawHulls(P.dvox, near);
    gl.useProgram(P.dtri.prog); setCommon(P.dtri); drawModels(P.dtri, near);
    gl.useProgram(P.dsail.prog); setCommon(P.dsail); drawSails(P.dsail, near);   // 帆另一支：貼圖的洞不投影子（TASK-0579）
  }
  function ball(sh) { var B = sh.T.base; return { R: sh.T.shR || (sh.T.shR = 0.5 * S * Math.hypot(B.sx, B.sy, B.sz)), c: M4.pt(sh.M, B.sx / 2, B.sy / 2, B.sz / 2) }; }
  for (var i = 0; i < SSLOTS.length; i++) (function (M, sh) {
    if (!sh || sh.sink > 40) { M.m = FAR_M; return; }
    var b = ball(sh), R = b.R, c = b.c;
    SHM.off = 1.5 * 2 * R / SHM.n;
    one(M, R, c, function (o) { if (o === sh) return true; if (o.crew) return false; var p = o.c || (o.M ? [o.M[12], o.M[13], o.M[14]] : c); return Math.hypot(p[0] - c[0], p[2] - c[2]) < R * 1.3; });
  })(SHM.maps[i], SSLOTS[i]);
  var rest = SSLOTS.rest.filter(function (s) { return s.sink <= 40; }), MG = SHM.maps[SSLOTS.length];
  SHM.glob = rest.length > 0 && !!MG;
  if (SHM.glob) {                                                          // 全局：罩住排不進去的那幾艘（xz 的外框中心、半徑 ＝ 最遠那艘的距離＋它的外接球）
    var bs = rest.map(ball), x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, y = 0;
    bs.forEach(function (b) { x0 = Math.min(x0, b.c[0]); x1 = Math.max(x1, b.c[0]); z0 = Math.min(z0, b.c[2]); z1 = Math.max(z1, b.c[2]); y += b.c[1] / bs.length; });
    var C = [(x0 + x1) / 2, y, (z0 + z1) / 2], RG = 0;
    bs.forEach(function (b) { RG = Math.max(RG, Math.hypot(b.c[0] - C[0], b.c[1] - C[1], b.c[2] - C[2]) + b.R); });
    SHM.offG = 1.5 * 2 * RG / SHM.n;
    one(MG, RG, C, function (o) { if (o.crew) return rest.indexOf(o) >= 0; var p = o.c || (o.M ? [o.M[12], o.M[13], o.M[14]] : C); return bs.some(function (b) { return Math.hypot(p[0] - b.c[0], p[2] - b.c[2]) < b.R * 1.3; }); });
  } else if (MG) MG.m = FAR_M;
  PASS.vp = null; gl.disable(gl.POLYGON_OFFSET_FILL);
}
/** 著色器的 uShM（每一層的矩陣串起來；沒有那一層 ⇒ FAR_M）。 */
function shadowMats() {
  for (var k = 0; k < MAX_SHIPS; k++) SHM.mats.set(k < SSLOTS.length && SHM.maps[k] ? SHM.maps[k].m : FAR_M, k * 16);
  var MG = SHM.maps[SSLOTS.length]; SHM.mats.set(SHM.glob && MG ? MG.m : FAR_M, MAX_SHIPS * 16);
}
/** 船艙遮罩的貼圖陣列（uHullA，第 1 號）：載好的每一型一層（T.hullLayer），寬高取最大的那一型；載了新的船型 ⇒ 重建。 */
var HULLA = { tex: null, key: '' };
function hullArr() {
  var Ts = Object.keys(HULLT).map(function (id) { return HULLT[id]; }).filter(function (T) { return T.hullHB; }), key = Ts.map(function (T) { return T.id; }).join(',');
  if (HULLA.tex && HULLA.key === key) return;
  if (HULLA.tex) gl.deleteTexture(HULLA.tex);
  var W = 1, H = 1; Ts.forEach(function (T) { W = Math.max(W, T.hullTW); H = Math.max(H, T.hullTH); });
  var t = HULLA.tex = gl.createTexture(); HULLA.key = key;
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, t); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.R8, W, H, Math.max(1, Ts.length), 0, gl.RED, gl.UNSIGNED_BYTE, null);
  Ts.forEach(function (T, k) { T.hullLayer = k; gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, k, T.hullTW, T.hullTH, 1, gl.RED, gl.UNSIGNED_BYTE, T.hullHB); });
  [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(function (p) { gl.texParameteri(gl.TEXTURE_2D_ARRAY, p, gl.NEAREST); });
  [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(function (p) { gl.texParameteri(gl.TEXTURE_2D_ARRAY, p, gl.CLAMP_TO_EDGE); });
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
}
/** 反射：鏡像的鏡頭把船畫進 RT.R（水面以下丟掉）。低 ＝ 船身；高 ＝ 再加砲、模型與帆。 */
function reflPass() {
  var R = RT.R; gl.bindFramebuffer(gl.FRAMEBUFFER, R.fb); gl.viewport(0, 0, R.w, R.h);
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  PASS.vp = M4.mul(CAM.vp, MIRROR); PASS.eye = [CAM.eye[0], -CAM.eye[1], CAM.eye[2]]; PASS.clip = 0; PASS.sh = 0;
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);                   // 船的矩陣是鏡射（shipBaseMatrix）、反射的鏡頭又鏡射一次 ⇒ 兩次抵銷，繞序照常（CCW）
  gl.useProgram(P.vox.prog); setCommon(P.vox); drawHulls(P.vox);
  if (GFX.refl === 2) {
    gl.disable(gl.CULL_FACE); gl.useProgram(P.tri.prog); setCommon(P.tri); gl.uniform1f(P.tri.u.uLit, 1); drawModels(P.tri);
    gl.useProgram(P.sail.prog); setCommon(P.sail); drawSails(P.sail);
  }
  PASS.vp = null; PASS.eye = null; PASS.clip = -1e9; PASS.sh = 1;
}
/** 船艙遮罩的 uniform（海與白沫共用，01_gl.js HULL_GLSL）。開始沉（sinkingFinal）之前，船艙裡不畫海水（Tim 2026-10-12：船身下沉一點點，海面就從破洞、甲板開口看進去像淹了） */
var MASK_OFF = -1;                                                        // ?debug=1 的 __game.mask(k)：第 k 艘的遮罩關掉（量 4 艘時每一格遮罩都有作用：關掉那艘 ⇒ 它的船艙裡才看得到海）
var HU = { inv: new Float32Array(MASK_NEAR * 16), hide: new Float32Array(MASK_NEAR), k: new Float32Array(MASK_NEAR * 4), xb: new Float32Array(MASK_NEAR * 4) };
function hullUniforms(prog) {
  var u = prog.u;
  hullArr(); HU.hide.fill(0);
  for (var i = 0; i < MASK_NEAR; i++) {                                   // 遮罩的每一格（gpuSlots MSLOTS）照那艘船型的那一層；排不進去的船 ⇒ 沒有遮罩
    var s = MSLOTS[i], T = s && s.T;
    if (s) HU.inv.set(s.inv, i * 16);                                     // 透視（nearShip）也用
    if (!T || !T.hullHB || T.hullLayer === undefined) continue;
    HU.hide[i] = !s.sinkingFinal && !s.sunk && s.i !== MASK_OFF ? 1 : 0;
    HU.k[i * 4] = T.hullTW; HU.k[i * 4 + 1] = T.hullTH; HU.k[i * 4 + 2] = T.cy; HU.k[i * 4 + 3] = T.hullLayer;
  }
  gl.uniform1fv(u.uHide, HU.hide); gl.uniformMatrix4fv(u.uInv, false, HU.inv); gl.uniform4fv(u.uHullK, HU.k);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, HULLA.tex); gl.uniform1i(u.uHullA, 1);
  gl.activeTexture(gl.TEXTURE0);
}
function render() {
  resize(); var w = CAM.w, h = CAM.h;
  // 閃電（天氣，08_weather.js）：那一格的天空與環境光拉亮、0.3 秒內退掉；雷聲照距離延後（340 m/s）。只在畫面，畫完把天色還回去
  var bolt = wxBolt(SIMT), sky0 = SKY, hor0 = HORIZON;
  if (bolt && bolt.f > 0) { SKY = lerp3(SKY, [0.82, 0.86, 0.98], bolt.f * 0.7); HORIZON = lerp3(HORIZON, [0.76, 0.79, 0.88], bolt.f * 0.6); }
  if (bolt && bolt.n !== LAST_BOLT) { LAST_BOLT = bolt.n; if (RUNNING && !STILL) setTimeout(function () { sfx('thunder', null, 1 / (1 + bolt.d / 1500)); }, bolt.d / 340 * 1000); }
  targets(w, h); shadowMaps(); gpuSlots(); shadowGrow(); lampsUpdate();             // gpuSlots：這一格 GPU 的格給哪幾艘（視野裡最近的幾艘：畫質設定）
  if (!DUMMY) { DUMMY = mkTex(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, 1, 1, false); }
  prepRig();
  gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D_ARRAY, null); gl.activeTexture(gl.TEXTURE0);   // 畫陰影圖時不綁著它（⛔ 綁著 ⇒ 讀寫同一張）
  if (GFX.shadow && !cutOn()) shadowPass(); else { SHM.maps.forEach(function (m) { m.m = FAR_M; }); SHM.glob = false; }   // 剖面、隱藏甲板開著 ⇒ 不算陰影（拿掉的甲板不擋光；74_cutaway.js）
  shadowMats();
  gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D_ARRAY, SHM.tex);   // 陰影圖陣列：固定第 4 號（01_gl.js SHADOW_GLSL）
  gl.activeTexture(gl.TEXTURE0);
  if (RT.R) reflPass();
  gl.bindFramebuffer(gl.FRAMEBUFFER, RT.A.fb); gl.viewport(0, 0, w, h);
  gl.clearColor(HORIZON[0], HORIZON[1], HORIZON[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
  // 天
  gl.depthMask(false); gl.useProgram(P.sky.prog); setCommon(P.sky); gl.uniformMatrix4fv(P.sky.u.uInv, false, CAM.inv);
  gl.bindVertexArray(SKYVAO); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.depthMask(true);
  // 船與斷開的那幾團
  // 船的矩陣是鏡射（shipBaseMatrix：照雕刻引擎的手性）⇒ 船殼的正面變成順時針；帆的著色器看 gl_FrontFacing 翻法線，也要跟著
  gl.enable(gl.CULL_FACE); gl.frontFace(gl.CW); gl.useProgram(P.vox.prog); setCommon(P.vox); drawHulls(P.vox); gl.frontFace(gl.CCW);
  // 碎片
  var n = 0;
  for (var i = 0; i < D.n; i++) {
    var o = i * 3, p;
    if (D.st[i] === 2) { var sh = SHIPS[D.ship[i]]; p = M4.pt(sh.M, D.p[o], D.p[o + 1], D.p[o + 2]); } else p = [D.p[o], D.p[o + 1], D.p[o + 2]];
    var k = n * 9, fade = Math.min(1, D.life[i] / 1.5);
    DINST[k] = p[0]; DINST[k + 1] = p[1]; DINST[k + 2] = p[2]; DINST[k + 3] = D.size[i] * fade;
    DINST[k + 4] = D.q[i * 4]; DINST[k + 5] = D.q[i * 4 + 1]; DINST[k + 6] = D.q[i * 4 + 2]; DINST[k + 7] = D.q[i * 4 + 3]; DINST[k + 8] = D.col[i] + D.sh[i] * 256; n++;   // 形狀放在色的 256 以上（01_gl.js P.deb）
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
    cutSet(P.tri, ow); gl.uniformMatrix4fv(P.tri.u.uModel, false, ow.M);
    if (ow.lines && ow.lines.n) { gl.bindVertexArray(ow.lines.vao); gl.drawArrays(gl.LINES, 0, ow.lines.n); }
    if (PHYS && ow.ll && ow.ll.n) { gl.bindVertexArray(ow.ll.vao); gl.drawArrays(gl.LINES, 0, ow.ll.n); }
    if (ROOMS_DBG && ow.rooms && ow.rooms.length) { if (!ow.roomLines) roomLines(ow); gl.disable(gl.DEPTH_TEST); gl.bindVertexArray(ow.roomLines.vao); gl.drawArrays(gl.LINES, 0, ow.roomLines.n); gl.enable(gl.DEPTH_TEST); }   // 空艙房的外框（?rooms=1；穿過船殼看得到）
  });
  gl.frontFace(gl.CW); gl.useProgram(P.sail.prog); setCommon(P.sail); drawSails(P.sail); gl.frontFace(gl.CCW);
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
  gl.uniform1f(P.water.u.uXr, FLX3 || CUTV.half ? 1 : 0);              // 停格的「🔍 透視」、剖面：船附近的海面不畫（72_floodui.js、74_cutaway.js；只拿掉甲板 ⇒ 船殼裡本來就不畫海，船邊照畫）
  for (var xi = 0; xi < MASK_NEAR; xi++) (function (i) {              // 遮罩的格（gpuSlots MSLOTS）：排不進去的船沒有透視
    var s = MSLOTS[i], b = s ? xrBox(s.T) : null, e = s && CUTV.half ? cutSide(s) * XR_CUT : 0;   // 剖面：往鏡頭那一側多拿掉 XR_CUT 格（⛔ 只拿船邊 6 m ⇒ 從側面看，鏡頭到船之間的海面把水線下整片擋住）
    HU.xb[i * 4] = b ? b[0] : 0; HU.xb[i * 4 + 1] = b ? b[1] + e / 2 : 0; HU.xb[i * 4 + 2] = b ? b[2] : -1e9; HU.xb[i * 4 + 3] = b ? b[3] + Math.abs(e) / 2 : -1e9;
  })(xi);
  gl.uniform4fv(P.water.u.uXb, HU.xb);
  gl.bindVertexArray(SEAG.vao); gl.drawElements(gl.TRIANGLES, SEAG.n, gl.UNSIGNED_INT, 0);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  if (!FLX3 && !CUTV.half) wpDrawFoam(hullUniforms);                                              // 船邊水花的白沫（13_water.js）：貼著浪、不寫深度
  flDraw();                                                              // 艙內的水面（33_flood.js，粒子模式）
  // 粒子＋砲彈＋瞄準點
  var m = 0;
  function pushPt(p, s, c, a, ty) { if (m * 9 >= PBUF.length) return; var k = m * 9; PBUF[k] = p[0]; PBUF[k + 1] = p[1]; PBUF[k + 2] = p[2]; PBUF[k + 3] = s; PBUF[k + 4] = c[0]; PBUF[k + 5] = c[1]; PBUF[k + 6] = c[2]; PBUF[k + 7] = a; PBUF[k + 8] = ty === undefined ? -1 : ty; m++; }
  for (i = 0; i < PT.n; i++) { var f = PT.life[i] / PT.max[i], s = PT.s1[i] + (PT.s0[i] - PT.s1[i]) * f; pushPt([PT.p[i * 3], PT.p[i * 3 + 1], PT.p[i * 3 + 2]], s, [PT.c[i * 3], PT.c[i * 3 + 1], PT.c[i * 3 + 2]], PT.a[i] * Math.min(1, f * 3), PT.ty[i]); }
  wpPushSpray(pushPt);                                                   // 船邊水花的水滴（13_water.js）
  flPushJets(pushPt);                                                    // 從破口噴進來的水（33_flood.js）
  rdPushSplash(pushPt);                                                  // 雨滴打在海面與船上的水花（14_rain.js）
  lanternHalo(pushPt);                                                   // 燈籠的光暈
  BALLS.forEach(function (b) { pushPt(b.p, 0.32, [0.08, 0.08, 0.08], 1); });
  var me = SHIPS[PLAYER_I], mWorld = m;                                   // mWorld 之後的是瞄準圈：另一批畫、不做深度測試（被船身擋住也看得到）
  if (me && me.aim && handAim(me) && !STILL) {                          // 自己瞄的才畫圈（含自動開砲時點了敵艦的那一舷）
    // 圈：直立，水平軸跟著敵艦的船長方向（扣掉視線方向的分量）⇒ 從側面看跟著敵艦轉；快正對船頭／船尾時改用鏡頭的右方
    // ⛔ 世界固定的平面 ⇒ 敵艦一轉就側成一條線；⛔ 只用船身側面那個平面 ⇒ 從船頭船尾看一樣是一條線
    var fs = aimShip(me), ac = isFoe(me, fs) ? [1, 0.85, 0.3] : [0.45, 0.78, 1], c = M4.pt(fs.M, me.aim[0], me.aim[1], me.aim[2]), vd = norm(sub(CAM.look, CAM.eye)), ax = shipAxis(fs);   // ac：瞄友艦 ⇒ 藍圈（Tim 2026-10-14）
    var u = sub(ax, mul(vd, dot(ax, vd))), ul = len(u);
    u = ul > 0.35 ? mul(u, 1 / ul) : norm(cross(vd, [0, 1, 0]));
    for (i = 0; i < 16; i++) { var an = i / 16 * 6.2832 + SIMT; pushPt(add(c, add(mul(u, Math.cos(an) * 2.2), [0, Math.sin(an) * 2.2, 0])), 0.5, ac, 0.9); }
  }
  if (FLX3) flHoleMarks(pushPt);                                         // 停格的「🔍 透視」開著：破口畫成點、隔著船殼看得到（72_floodui.js）
  if (m) {
    gl.depthMask(false); gl.useProgram(P.pt.prog); setCommon(P.pt); gl.uniform1f(P.pt.u.uPx, CAM.h / (2 * Math.tan(0.45)));
    gl.uniform1f(P.pt.u.uUseFx, FX_TEX ? 1 : 0); if (FX_TEX) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, FX_TEX); gl.uniform1i(P.pt.u.uFx, 0); }
    gl.bindVertexArray(PTVAO); gl.bindBuffer(gl.ARRAY_BUFFER, PTBUF); gl.bufferSubData(gl.ARRAY_BUFFER, 0, PBUF, 0, m * 9);
    if (mWorld) gl.drawArrays(gl.POINTS, 0, mWorld);
    if (m > mWorld) { gl.disable(gl.DEPTH_TEST); gl.drawArrays(gl.POINTS, mWorld, m - mWorld); gl.enable(gl.DEPTH_TEST); }
    gl.depthMask(true);
  }
  rdDraw();                                                              // 3D 雨滴（14_rain.js；畫質的「雨滴（3D）」）：做深度測試、不寫深度
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

