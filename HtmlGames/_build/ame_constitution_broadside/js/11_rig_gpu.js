// ───────────────────────── 繩與帆的 GPU 緩衝 ─────────────────────────
function buildRig(owner) {          // 還綁著的繩（靜態，照雕刻作品的形狀）；帆在 sailBuf、垂下來的繩在 looseBuf
  var L = [];
  owner.ropes.forEach(function (r) {
    if (r.dead) return;
    for (var j = 0; j + 5 < r.pts.length; j += 3) L.push(r.pts[j], r.pts[j + 1], r.pts[j + 2], r.col[0], r.col[1], r.col[2], r.pts[j + 3], r.pts[j + 4], r.pts[j + 5], r.col[0], r.col[1], r.col[2]);
  });
  owner.lines = upload(owner.lines, new Float32Array(L), 6, [[0, 3, 0], [2, 3, 3]]);
  owner.rigDirty = false;
}
/** 帆的網格（一個 owner 一份，索引畫）：頂點法線 ＝ 相鄰三角形的面積加權平均 ⇒ 布是圓的，不是一面一面的。
 *  關物理 ⇒ 位置就是雕刻作品那一刻（T.p0），只在 rigDirty 時重做；開物理 ⇒ 每一格畫面重做。
 *  帆的布片（34_shreds.js）接在帆後面、同一個緩衝 ⇒ 陰影、反射照帆畫。 */
// 頂點：位置 3、法線 3、色 3、貼圖集的 uv 2（TASK-0579；沒有貼圖 ⇒ u ＝ −1，著色器照色畫）
var SBV = null, SBI = null, SBN = null, SBP = null, SB_STRIDE = 11, SAIL_UNIT = 9, SAIL_DUMMY = null;
/** 帆的貼圖集（30_rig_physics.js sailAtlas）⇒ GL 貼圖（第一次畫才建，記在船型上）；沒有 ⇒ 1×1 的空貼圖（取樣器一定要綁一張）。 */
function sailTex(T) {
  if (T && T.sailAtlas && !T.sailTexGL) {
    var A = T.sailAtlas, t = T.sailTexGL = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, A.w, A.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, A.data);
    [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(function (p) { gl.texParameteri(gl.TEXTURE_2D, p, gl.NEAREST); });   // 像素畫：一格一格（⛔ LINEAR ⇒ 洞的邊緣跟隔壁的色混在一起）
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(function (p) { gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE); });
  }
  if (T && T.sailTexGL) return T.sailTexGL;
  if (!SAIL_DUMMY) { SAIL_DUMMY = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, SAIL_DUMMY); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255])); }
  return SAIL_DUMMY;
}
function sailBuf(ow) {
  var nv = 0, ni = 0, isShip = !!ow.crew, F = isShip && PHYS && ow.shreds && ow.shreds.length ? ow.shreds : null, A = ow.T && ow.T.sailAtlas;
  if (F) {                                                               // 緩衝照帆的模板配（30_rig_physics.js clothSetup）；多了布片不夠 ⇒ 加大
    var mv = 0, mi = 0; ow.cl.forEach(function (c) { mv += c.T.n; mi += c.T.tris.length; }); F.forEach(function (f) { mv += f.n; mi += f.T.sim.tris.length; });
    if (SBV.length < mv * SB_STRIDE) SBV = new Float32Array(Math.ceil(mv * 1.33) * SB_STRIDE);
    if (SBI.length < mi) SBI = new Uint32Array(Math.ceil(mi * 1.33));
  }
  (ow.cl || []).forEach(function (c, k) {
    if (isShip) { var s = ow.sails[k]; if (PHYS ? (!c.p || c.hidden || c.gone) : (s.dead || s.furled)) return; }
    put((PHYS || !isShip) && c.p ? clothFine(c, SBP) : c.T.p0, c.T.n, c.T.tris, c.T.col, c.torn ? c.tv : null, c.T.vcol, c.T.uv, A && c.T.ti !== undefined ? A.rect[c.T.ti] : null);
  });
  if (F) F.forEach(function (f) { put(f.p, f.n, f.T.sim.tris, f.col, null, null, f.uv, A && f.uv && f.ti !== undefined ? A.rect[f.ti] : null); });   // 布片：有貼圖的帆撕下來的照原處的圖（34_shreds.js shredCut 記 uv）
  function put(p, n, tr, col, tv, vc, uv, r) {                            // tv：藏起來的細格點（撕開的洞）；vc：每個頂點的顏色（沒有貼圖集時的退路，30_rig_physics.js texColors）；uv＋r：貼圖集的那一格
    var base = nv, j, i;
    SBN.fill(0, 0, n * 3);
    for (j = 0; j < tr.length; j += 3) {
      if (tv && (tv[tr[j]] || tv[tr[j + 1]] || tv[tr[j + 2]])) continue;
      var a = tr[j] * 3, b = tr[j + 1] * 3, d = tr[j + 2] * 3;
      var ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[d] - p[a], vy = p[d + 1] - p[a + 1], vz = p[d + 2] - p[a + 2];
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      SBN[a] += nx; SBN[a + 1] += ny; SBN[a + 2] += nz; SBN[b] += nx; SBN[b + 1] += ny; SBN[b + 2] += nz; SBN[d] += nx; SBN[d + 1] += ny; SBN[d + 2] += nz;
      SBI[ni++] = base + tr[j]; SBI[ni++] = base + tr[j + 1]; SBI[ni++] = base + tr[j + 2];
    }
    for (i = 0; i < n; i++) {
      var o = (base + i) * SB_STRIDE, q = i * 3;
      SBV[o] = p[q]; SBV[o + 1] = p[q + 1]; SBV[o + 2] = p[q + 2]; SBV[o + 3] = SBN[q]; SBV[o + 4] = SBN[q + 1]; SBV[o + 5] = SBN[q + 2];
      if (vc) { SBV[o + 6] = vc[q]; SBV[o + 7] = vc[q + 1]; SBV[o + 8] = vc[q + 2]; } else { SBV[o + 6] = col[0]; SBV[o + 7] = col[1]; SBV[o + 8] = col[2]; }
      if (uv && r) { SBV[o + 9] = (r[0] + uv[i * 2] * r[2]) / A.w; SBV[o + 10] = (r[1] + uv[i * 2 + 1] * r[3]) / A.h; } else { SBV[o + 9] = -1; SBV[o + 10] = -1; }
    }
    nv += n;
  }
  if (!ow.sb) {
    ow.sb = { vao: gl.createVertexArray(), vbo: gl.createBuffer(), ebo: gl.createBuffer(), n: 0 };
    gl.bindVertexArray(ow.sb.vao); gl.bindBuffer(gl.ARRAY_BUFFER, ow.sb.vbo);
    [[0, 0, 3], [1, 3, 3], [2, 6, 3], [3, 9, 2]].forEach(function (a) { gl.enableVertexAttribArray(a[0]); gl.vertexAttribPointer(a[0], a[2], gl.FLOAT, false, SB_STRIDE * 4, a[1] * 4); });
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ow.sb.ebo); gl.bindVertexArray(null);
  }
  gl.bindVertexArray(ow.sb.vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, ow.sb.vbo); gl.bufferData(gl.ARRAY_BUFFER, SBV.subarray(0, nv * SB_STRIDE), gl.DYNAMIC_DRAW);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, SBI.subarray(0, ni), gl.DYNAMIC_DRAW); gl.bindVertexArray(null);
  ow.sb.n = ni;
}
/** 細格的位置：照權重從物理的粗格內插（粗格就是細格 ⇒ 原樣）。 */
function clothFine(c, out) {
  var T = c.T, p = c.p, mi = T.mi, mw = T.mw;
  for (var i = 0; i < T.n; i++) {
    var o = i * 4, x = 0, y = 0, z = 0;
    for (var k = 0; k < 4; k++) { var w = mw[o + k]; if (!w) break; var q = mi[o + k] * 3; x += p[q] * w; y += p[q + 1] * w; z += p[q + 2] * w; }
    out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
  }
  return out;
}
/** 垂下來的繩（物理開著才有）：每一格畫面重做。 */
function looseBuf(sh) {
  var L = [];
  sh.loose.forEach(function (o) {
    var p = o.p, c = o.col;
    for (var i = 0; i + 1 < o.n; i++) { var a = i * 3; L.push(p[a], p[a + 1], p[a + 2], c[0], c[1], c[2], p[a + 3], p[a + 4], p[a + 5], c[0], c[1], c[2]); }
  });
  sh.ll = upload(sh.ll, new Float32Array(L), 6, [[0, 3, 0], [2, 3, 3]]);
}
function upload(o, data, stride, attrs) {
  if (!o) { o = { vao: gl.createVertexArray(), vbo: gl.createBuffer(), n: 0 }; gl.bindVertexArray(o.vao); gl.bindBuffer(gl.ARRAY_BUFFER, o.vbo);
    attrs.forEach(function (a) { gl.enableVertexAttribArray(a[0]); gl.vertexAttribPointer(a[0], a[1], gl.FLOAT, false, stride * 4, a[2] * 4); }); gl.bindVertexArray(null); }
  gl.bindBuffer(gl.ARRAY_BUFFER, o.vbo); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW); o.n = data.length / stride;
  return o;
}

