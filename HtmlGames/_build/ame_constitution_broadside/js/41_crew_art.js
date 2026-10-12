// ───────────────────────── 船員貼圖：替代品（程式畫）／美術（#art-crew） ─────────────────────────
// 格子：每格 CELL_W × CELL_H；欄 ＝ 動作（FR），列 ＝ 角色×隊伍（role*2 + team，0 藍 1 紅）；人一律朝右畫，腳底在格子底邊中間。
var CELL_W = 64, CELL_H = 128, CREW_TEX = null, CREW_ART = false, BBVAO = null, BBBUF = null, BBMAX = 1400, BB = new Float32Array(BBMAX * 12);
var FX_TEX = null, HUD_ART = null;
function drawFigure(g, ox, oy, role, team, f) {
  var blue = team === 0, skin = '#d9a77c', pants = '#e6dfcc', shoe = '#1b1b1b';
  var jacket = role === ROLE.MARINE ? (blue ? '#1f3a6e' : '#b8322a') : role === ROLE.OFFICER ? (blue ? '#1b2a4d' : '#4f1616') : role === ROLE.TOP ? '#d8d2c0' : (blue ? '#2c4f8f' : '#9c2f2f');
  var hat = role === ROLE.OFFICER ? '#111' : role === ROLE.MARINE ? (blue ? '#0f1e3d' : '#1b1b1b') : (blue ? '#16294d' : '#4a1212');
  var sc = role === ROLE.POWDER ? 0.74 : 1;
  g.save(); g.translate(ox + CELL_W / 2, oy + CELL_H - 2);
  if (f === FR.DEAD) { g.translate(-26, -3); g.rotate(-Math.PI / 2); g.scale(0.58, 0.58); }
  else if (f === FR.WOUNDED) { g.translate(0, 0); }
  g.scale(sc, sc);
  function rect(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function line(x0, y0, x1, y1, w, c) { g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  var sitting = f === FR.WOUNDED, hip = sitting ? -22 : -52, top = hip - 38;
  // 腿
  if (sitting) { line(-4, hip, 20, -6, 6, pants); line(2, hip, 26, -4, 6, pants); rect(20, -9, 9, 5, shoe); }
  else {
    var a = f === FR.RUN_A ? 0.45 : f === FR.RUN_B ? -0.45 : f === FR.WORK_A ? 0.25 : 0.06;
    line(-3, hip, -3 - Math.sin(a) * 50, hip + Math.cos(a) * 50, 6, pants); line(3, hip, 3 + Math.sin(a) * 50, hip + Math.cos(a) * 50, 6, pants);
    rect(-3 - Math.sin(a) * 50 - 4, hip + Math.cos(a) * 50 - 3, 10, 5, shoe); rect(3 + Math.sin(a) * 50 - 2, hip + Math.cos(a) * 50 - 3, 10, 5, shoe);
  }
  // 身體（彎腰：推彈、搬東西）
  var lean = f === FR.WORK_A ? 0.35 : sitting ? 0.25 : 0;
  g.save(); g.translate(0, hip); g.rotate(lean);
  rect(-10, -38, 20, 40, jacket);
  if (role === ROLE.MARINE) { line(-9, -36, 9, -2, 3, '#f2efe6'); line(9, -36, -9, -2, 3, '#f2efe6'); }
  if (role === ROLE.OFFICER) { rect(-12, -38, 6, 4, '#e2b84a'); rect(6, -38, 6, 4, '#e2b84a'); }
  if (role === ROLE.TOP) { for (var k = -32; k < 0; k += 8) rect(-10, k, 20, 3, blue ? '#2c4f8f' : '#9c2f2f'); }
  if (sitting) rect(-6, -26, 10, 9, '#9c1c1c');                         // 傷
  // 手臂
  var sh0 = [8, -34];
  if (f === FR.WORK_A) { line(sh0[0], sh0[1], 30, -16, 5, jacket); line(-6, -34, 26, -12, 5, jacket); line(18, -18, 40, -12, 3, '#6b4a2a'); }      // 推彈桿
  else if (f === FR.WORK_B) { line(sh0[0], sh0[1], 18, -64, 5, jacket); line(-6, -34, 8, -66, 5, jacket); }                                        // 拉砲索
  else if (f === FR.FIRE && (role === ROLE.MARINE || role === ROLE.TOP)) { line(sh0[0], sh0[1], 26, -32, 5, jacket); line(-6, -34, 22, -30, 5, jacket); line(4, -30, 46, -34, 3, '#4b3621'); }  // 舉槍
  else if (f === FR.FIRE && role === ROLE.OFFICER) { line(sh0[0], sh0[1], 26, -54, 5, jacket); line(24, -52, 40, -78, 2, '#cfd6dc'); }               // 舉劍
  else if (f === FR.FIRE) { line(sh0[0], sh0[1], 28, -50, 5, jacket); }                                                                             // 砲長：手一揮
  else if (sitting) { line(sh0[0], sh0[1], 2, -22, 5, jacket); }
  else { line(sh0[0], sh0[1], 11, -2, 5, jacket); line(-8, -34, -11, -2, 5, jacket); if (role === ROLE.MARINE) line(14, 2, 14, -60, 3, '#4b3621'); }
  // 頭、帽子
  g.fillStyle = skin; g.beginPath(); g.arc(1, -47, 8, 0, 6.2832); g.fill();
  if (role === ROLE.OFFICER) { g.fillStyle = hat; g.beginPath(); g.ellipse(1, -55, 15, 5, 0, 0, 6.2832); g.fill(); rect(-3, -62, 8, 6, hat); }
  else if (role === ROLE.MARINE) rect(-7, -68, 16, 14, hat);
  else if (role !== ROLE.POWDER) { rect(-9, -57, 20, 4, hat); rect(-6, -63, 14, 7, hat); }
  g.restore();
  g.restore();
}
function crewPlaceholder() {
  var c = document.createElement('canvas'); c.width = NFR * CELL_W; c.height = NROLE * 2 * CELL_H;
  var g = c.getContext('2d');
  for (var role = 0; role < NROLE; role++) for (var team = 0; team < 2; team++) for (var f = 0; f < NFR; f++) drawFigure(g, f * CELL_W, (role * 2 + team) * CELL_H, role, team, f);
  return c;
}
/** 6 列的 crew.png ⇒ 12 列（每個角色一列藍隊、一列紅隊）：鍵色 #FF00FF／#C000C0／#800080 換成隊色的亮／中／暗。 */
function teamRecolor(im, cw, ch) {
  var c = document.createElement('canvas'); c.width = im.width; c.height = ch * NROLE * 2;
  var g = c.getContext('2d');
  var TEAM = [[[111, 155, 255], [62, 104, 196], [33, 60, 128]], [[255, 111, 111], [196, 62, 62], [128, 33, 33]]];
  for (var r = 0; r < NROLE; r++) for (var t = 0; t < 2; t++) g.drawImage(im, 0, r * ch, im.width, ch, 0, (r * 2 + t) * ch, im.width, ch);
  var d = g.getImageData(0, 0, c.width, c.height), px = d.data;
  for (var i = 0; i < px.length; i += 4) {
    if (px[i + 1] > 8 || px[i] !== px[i + 2]) continue;
    var k = px[i] === 255 ? 0 : px[i] === 192 ? 1 : px[i] === 128 ? 2 : -1; if (k < 0) continue;
    var row = Math.floor(i / 4 / c.width / ch), col = TEAM[row & 1][k];
    px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2];
  }
  g.putImageData(d, 0, 0);
  return c;
}
function texFrom(src) {
  var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
/** 美術交件了就換上（尺寸要能整除成 8 欄 × 12 列）；沒交、或尺寸不對 ⇒ 留著替代品，並在讀數裡說為什麼。 */
function loadArt() {
  CREW_TEX = texFrom(crewPlaceholder());
  var why = [];
  var p1 = VK.embeddedImage('art-crew').then(function (im) {
    if (!im) { why.push('船員：替代品（art/crew.png 沒交）'); return; }
    var cw = im.width / NFR, ch = cw * 2, rows = im.height / ch;
    if (im.width % NFR || (rows !== NROLE && rows !== NROLE * 2)) { why.push('船員：替代品（art/crew.png 是 ' + im.width + '×' + im.height + '；要 ' + NFR + ' 欄、每格寬:高 ＝ 1:2、' + NROLE + ' 列或 ' + NROLE * 2 + ' 列）'); console.warn('art/crew.png 尺寸不對，改用替代品'); return; }
    CREW_TEX = texFrom(rows === NROLE ? teamRecolor(im, cw, ch) : im); CREW_ART = true; why.push('船員：美術 ' + im.width + '×' + im.height + (rows === NROLE ? '（鍵色換隊色）' : ''));
  });
  var p2 = VK.embeddedImage('art-fx').then(function (im) {
    if (!im) { why.push('特效：替代品'); return; }
    if (im.width !== im.height) { why.push('特效：替代品（art/fx.png 要是正方形 4×4 格）'); return; }
    FX_TEX = texFrom(im); why.push('特效：美術 ' + im.width + '×' + im.height);
  });
  var p3 = VK.embeddedImage('art-hud').then(function (im) {
    if (!im) { why.push('HUD：文字符號'); return; }
    HUD_ART = { src: im.src, cw: im.width / 8, ch: im.height / 2 }; why.push('HUD：美術 ' + im.width + '×' + im.height);
  });
  return Promise.all([p1, p2, p3]).then(function () { return why.join('、'); });
}
function bbSetup() {
  P.bb = VK.compile(gl,
    '#version 300 es\nlayout(location=0) in vec2 aQ; layout(location=1) in vec4 iP; layout(location=2) in vec4 iU; layout(location=3) in vec4 iS;\n' +
    'uniform mat4 uVP; uniform vec3 uRight; out vec2 vUV; out vec3 vW; out float vS;\n' +
    'void main(){ vec3 w=iP.xyz+uRight*(aQ.x*iS.x)+vec3(0.0,aQ.y*iP.w,0.0); vW=w; vUV=vec2(mix(iU.x,iU.z,aQ.x+0.5),mix(iU.w,iU.y,aQ.y)); vS=iS.y; gl_Position=uVP*vec4(w,1.0); }\n',
    '#version 300 es\nprecision highp float; in vec2 vUV; in vec3 vW; in float vS; uniform sampler2D uTex; uniform vec3 uEye,uFog; uniform float uFogD; out vec4 o;\n' +
    'void main(){ vec4 t=texture(uTex,vUV); if(t.a<0.5) discard; vec3 c=t.rgb*vS; if(vW.y<0.0) c=mix(c,vec3(0.04,0.18,0.22),0.6);\n' +
    ' float fd=length(vW-uEye); o=vec4(mix(c,uFog,1.0-exp(-fd*uFogD)),1.0); }\n');
  BBVAO = gl.createVertexArray(); gl.bindVertexArray(BBVAO);
  var q = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, q); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, 0, 0.5, 0, 0.5, 1, -0.5, 0, 0.5, 1, -0.5, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  BBBUF = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, BBBUF); gl.bufferData(gl.ARRAY_BUFFER, BB.byteLength, gl.DYNAMIC_DRAW);
  [[1, 0], [2, 16], [3, 32]].forEach(function (a) { gl.enableVertexAttribArray(a[0]); gl.vertexAttribPointer(a[0], 4, gl.FLOAT, false, 48, a[1]); gl.vertexAttribDivisor(a[0], 1); });
  gl.bindVertexArray(null);
}
/** 這個人現在該畫哪一格動作。 */
function crewFrame(sh, c) {
  if (c.st === 2 || c.st === 4) return c.st === 4 ? FR.RUN_A : FR.DEAD;
  if (c.st === 1) return FR.WOUNDED;
  var ph = Math.floor(c.t * 2.5) & 1;
  if (c.walk || c.moving) return ph ? FR.RUN_A : FR.RUN_B;
  if (c.role === ROLE.GUN && c.gun) {
    if (SIMT - (c.gun.firedAt || -9) < 0.7) return FR.FIRE;
    if (c.gun.reload > 0 && c.gun.manned >= c.gun.crewMin) return ph ? FR.WORK_A : FR.WORK_B;
    return FR.IDLE;
  }
  if (c.role === ROLE.MARINE || c.role === ROLE.TOP) return c.fireT > 0 ? FR.FIRE : c.role === ROLE.TOP ? (Math.floor(c.t * 0.7) & 1 ? FR.WORK_B : FR.IDLE) : FR.IDLE;
  if (c.role === ROLE.OFFICER) return sh.salvoT && SIMT - sh.salvoT < 1.2 ? FR.FIRE : FR.IDLE;
  if (c.role === ROLE.HELM) return FR.WORK_B;
  return FR.IDLE;
}
function drawCrew() {
  var n = 0, fw = norm([CAM.look[0] - CAM.eye[0], 0, CAM.look[2] - CAM.eye[2]]), right = [-fw[2], 0, fw[0]];
  SHIPS.forEach(function (sh) {
    if (sh.sink > 40) return;
    var team = sh.i, faceW = M4.dir(sh.M, 0, 1, 0);
    sh.crew.forEach(function (c) {
      if (c.st === 3 || n >= BBMAX) return;
      var w = c.st === 4 ? c.fw : M4.pt(sh.M, c.pos[0], c.pos[1], c.pos[2]), f = crewFrame(sh, c), row = c.role * 2 + team;
      var fd = c.walk ? M4.dir(sh.M, c.walk.to[0] - c.pos[0], c.walk.to[1] - c.pos[1], 0) : mul(faceW, c.face), flip = dot(fd, right) < 0;
      var u0 = f / NFR, u1 = (f + 1) / NFR, v0 = row / (NROLE * 2), v1 = (row + 1) / (NROLE * 2), k = n * 12, h = 1.75;
      BB[k] = w[0]; BB[k + 1] = w[1]; BB[k + 2] = w[2]; BB[k + 3] = h;
      BB[k + 4] = flip ? u1 : u0; BB[k + 5] = v0; BB[k + 6] = flip ? u0 : u1; BB[k + 7] = v1;
      BB[k + 8] = h * CELL_W / CELL_H; BB[k + 9] = c.st === 1 ? 0.85 : 1; BB[k + 10] = 0; BB[k + 11] = 0; n++;
    });
  });
  if (!n) return;
  gl.useProgram(P.bb.prog); setCommon(P.bb); gl.uniform3fv(P.bb.u.uRight, right);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, CREW_TEX); gl.uniform1i(P.bb.u.uTex, 0);
  gl.bindVertexArray(BBVAO); gl.bindBuffer(gl.ARRAY_BUFFER, BBBUF); gl.bufferSubData(gl.ARRAY_BUFFER, 0, BB, 0, n * 12);
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n); gl.bindVertexArray(null);
}

