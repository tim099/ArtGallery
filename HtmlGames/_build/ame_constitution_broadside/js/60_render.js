// ───────────────────────── 畫 ─────────────────────────
var CUBE = null, DEBVAO = null, DEBBUF = null, PTVAO = null, PTBUF = null, WATERVAO = null, SKYVAO = null;
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
  WATERVAO = gl.createVertexArray(); gl.bindVertexArray(WATERVAO); var wb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, wb);
  var E = 4000; gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-E, -E, E, -E, E, E, -E, -E, E, E, -E, E]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0); gl.bindVertexArray(null);
  SKYVAO = gl.createVertexArray(); gl.bindVertexArray(SKYVAO); var sb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, sb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0); gl.bindVertexArray(null);
}
function resize() {
  var dpr = Math.min(window.devicePixelRatio || 1, 1.5), w = Math.max(1, cv.clientWidth * dpr | 0), h = Math.max(1, cv.clientHeight * dpr | 0);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  CAM.w = w; CAM.h = h;
}
function render() {
  resize(); gl.viewport(0, 0, CAM.w, CAM.h);
  gl.clearColor(HORIZON[0], HORIZON[1], HORIZON[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
  // 天
  gl.depthMask(false); gl.useProgram(P.sky.prog); setCommon(P.sky); gl.uniformMatrix4fv(P.sky.u.uInv, false, CAM.inv);
  gl.bindVertexArray(SKYVAO); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.depthMask(true);
  // 船與斷開的那幾團
  gl.enable(gl.CULL_FACE); gl.useProgram(P.vox.prog); setCommon(P.vox);
  SHIPS.forEach(function (sh) { if (sh.sink > 40) return; gl.uniformMatrix4fv(P.vox.u.uModel, false, sh.M); sh.rs.draw(); });
  PIECES.forEach(function (pc) { gl.uniformMatrix4fv(P.vox.u.uModel, false, pc.M); pc.rs.draw(); });
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
  // 帆與繩
  gl.disable(gl.CULL_FACE); gl.useProgram(P.tri.prog); setCommon(P.tri);
  var owners = SHIPS.concat(PIECES);
  gl.uniform1f(P.tri.u.uLit, 1);
  SHIPS.forEach(function (sh) {
    if (sh.sink > 40) return;
    sh.models.forEach(function (m) {
      if (!m.alive || !MESHES[m.mesh]) return;
      gl.uniformMatrix4fv(P.tri.u.uModel, false, M4.mul(sh.M, trans(m.origin[0], m.origin[1], m.origin[2])));
      gl.bindVertexArray(MESHES[m.mesh].vao); gl.drawArrays(gl.TRIANGLES, 0, MESHES[m.mesh].n);
    });
  });
  FLY.forEach(function (f) { if (!MESHES[f.mesh] || !f.M) return; gl.uniformMatrix4fv(P.tri.u.uModel, false, f.M); gl.bindVertexArray(MESHES[f.mesh].vao); gl.drawArrays(gl.TRIANGLES, 0, MESHES[f.mesh].n); });
  gl.uniform1f(P.tri.u.uLit, 0); gl.vertexAttrib3f(1, 0, 1, 0);
  owners.forEach(function (ow) {
    var dirty = ow.rigDirty;
    if (dirty) buildRig(ow);
    if (ow.sink > 40) return;
    var tb = DEBUG ? performance.now() : 0;
    if (dirty || (PHYS && ow.crew)) sailBuf(ow);                     // 物理開著：船上的帆每一格重做；斷開的那一團是靜態的
    if (PHYS && ow.crew) looseBuf(ow);
    if (DEBUG) PROF.buf += performance.now() - tb;
    gl.uniformMatrix4fv(P.tri.u.uModel, false, ow.M);
    if (ow.lines && ow.lines.n) { gl.bindVertexArray(ow.lines.vao); gl.drawArrays(gl.LINES, 0, ow.lines.n); }
    if (PHYS && ow.ll && ow.ll.n) { gl.bindVertexArray(ow.ll.vao); gl.drawArrays(gl.LINES, 0, ow.ll.n); }
  });
  gl.useProgram(P.sail.prog); setCommon(P.sail);
  owners.forEach(function (ow) {
    if (ow.sink > 40 || !ow.sb || !ow.sb.n) return;
    gl.uniformMatrix4fv(P.sail.u.uModel, false, ow.M);
    gl.bindVertexArray(ow.sb.vao); gl.drawElements(gl.TRIANGLES, ow.sb.n, gl.UNSIGNED_INT, 0);
  });
  // 海
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(P.water.prog); setCommon(P.water); gl.uniform1f(P.water.u.uT, SIMT); gl.bindVertexArray(WATERVAO); gl.drawArrays(gl.TRIANGLES, 0, 6);
  // 粒子＋砲彈＋瞄準點
  var m = 0;
  function pushPt(p, s, c, a, ty) { if (m >= PMAX) return; var k = m * 9; PBUF[k] = p[0]; PBUF[k + 1] = p[1]; PBUF[k + 2] = p[2]; PBUF[k + 3] = s; PBUF[k + 4] = c[0]; PBUF[k + 5] = c[1]; PBUF[k + 6] = c[2]; PBUF[k + 7] = a; PBUF[k + 8] = ty === undefined ? -1 : ty; m++; }
  for (i = 0; i < PT.n; i++) { var f = PT.life[i] / PT.max[i], s = PT.s1[i] + (PT.s0[i] - PT.s1[i]) * f; pushPt([PT.p[i * 3], PT.p[i * 3 + 1], PT.p[i * 3 + 2]], s, [PT.c[i * 3], PT.c[i * 3 + 1], PT.c[i * 3 + 2]], PT.a[i] * Math.min(1, f * 3), PT.ty[i]); }
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
  gl.disable(gl.BLEND); gl.bindVertexArray(null);
}

