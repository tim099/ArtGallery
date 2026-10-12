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
 *  關物理 ⇒ 位置就是雕刻作品那一刻（T.p0），只在 rigDirty 時重做；開物理 ⇒ 每一格畫面重做。 */
var SBV = null, SBI = null, SBN = null, SBP = null;
function sailBuf(ow) {
  var nv = 0, ni = 0, isShip = !!ow.crew;
  (ow.cl || []).forEach(function (c, k) {
    if (isShip) { var s = ow.sails[k]; if (PHYS ? (!c.p || c.hidden || c.gone) : (s.dead || s.furled)) return; }
    var T = c.T, p = (PHYS || !isShip) && c.p ? clothFine(c, SBP) : T.p0, tr = T.tris, base = nv, col = T.col, j, i;
    SBN.fill(0, 0, T.n * 3);
    for (j = 0; j < tr.length; j += 3) {
      if (c.torn && (c.tv[tr[j]] || c.tv[tr[j + 1]] || c.tv[tr[j + 2]])) continue;
      var a = tr[j] * 3, b = tr[j + 1] * 3, d = tr[j + 2] * 3;
      var ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[d] - p[a], vy = p[d + 1] - p[a + 1], vz = p[d + 2] - p[a + 2];
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      SBN[a] += nx; SBN[a + 1] += ny; SBN[a + 2] += nz; SBN[b] += nx; SBN[b + 1] += ny; SBN[b + 2] += nz; SBN[d] += nx; SBN[d + 1] += ny; SBN[d + 2] += nz;
      SBI[ni++] = base + tr[j]; SBI[ni++] = base + tr[j + 1]; SBI[ni++] = base + tr[j + 2];
    }
    for (i = 0; i < T.n; i++) {
      var o = (base + i) * 9, q = i * 3;
      SBV[o] = p[q]; SBV[o + 1] = p[q + 1]; SBV[o + 2] = p[q + 2]; SBV[o + 3] = SBN[q]; SBV[o + 4] = SBN[q + 1]; SBV[o + 5] = SBN[q + 2];
      SBV[o + 6] = col[0]; SBV[o + 7] = col[1]; SBV[o + 8] = col[2];
    }
    nv += T.n;
  });
  if (!ow.sb) {
    ow.sb = { vao: gl.createVertexArray(), vbo: gl.createBuffer(), ebo: gl.createBuffer(), n: 0 };
    gl.bindVertexArray(ow.sb.vao); gl.bindBuffer(gl.ARRAY_BUFFER, ow.sb.vbo);
    [[0, 0], [1, 3], [2, 6]].forEach(function (a) { gl.enableVertexAttribArray(a[0]); gl.vertexAttribPointer(a[0], 3, gl.FLOAT, false, 36, a[1] * 4); });
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ow.sb.ebo); gl.bindVertexArray(null);
  }
  gl.bindVertexArray(ow.sb.vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, ow.sb.vbo); gl.bufferData(gl.ARRAY_BUFFER, SBV.subarray(0, nv * 9), gl.DYNAMIC_DRAW);
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

