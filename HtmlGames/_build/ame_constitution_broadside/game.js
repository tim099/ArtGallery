/* 憲法號對轟 —— 遊戲本體（體素的解碼、網格、算繪、射線、連通在 VoxelKit）。
 * 世界：公尺、Y 朝上、海面 y = 0。船的格座標 (x 船長、y 船寬、z 高) ⇒ 船體座標 (x, z, −y)（行列式 +1，繞序不翻）。
 * 兩艘都是同一份 1:1 組裝件：共用資料，被打到的區塊才各自複製（VoxelKit.Grid.share）。
 * 模擬固定步長 1/60 秒、亂數有種子 ⇒ ?demo=<秒>&seed=<n> 每次快轉出同一格（縮圖與驗收用）。
 */
(function () {
  'use strict';
  var VK = window.VoxelKit, M4 = VK.M4;
  var Q = new URLSearchParams(location.search);
  var DEMO = Q.has('demo') ? Math.max(0, parseFloat(Q.get('demo')) || 0) : -1;
  var STILL = Q.get('still') === '1', DEBUG = Q.get('debug') === '1';
  var SEED = (parseInt(Q.get('seed'), 10) >>> 0) || 1797;
  var CAMQ = Q.get('cam') || '';
  if (STILL) document.getElementById('stage').classList.add('still');
  function $(id) { return document.getElementById(id); }

  // ───────────────────────── 亂數（有種子） ─────────────────────────
  var rs = SEED;
  function rnd() { rs |= 0; rs = rs + 0x6D2B79F5 | 0; var t = Math.imul(rs ^ rs >>> 15, 1 | rs); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  function rr(a, b) { return a + (b - a) * rnd(); }
  function gauss() { var u = rnd() || 1e-9, v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2831853 * v); }
  function hash3(x, y, z) { var h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ───────────────────────── 常數 ─────────────────────────
  var DT = 1 / 60, G = 9.81, V0 = 175, ZW = 63;     // ZW：設計水線（吃水 63 格，basecamp 的下水段同一個數）
  var RELOAD = 7, RELOAD_SANDBOX = 1.6;
  var AMMO = ['實心彈', '爆裂彈', '鏈彈'];
  var S, CX, CY, SZ, HULL_X0, HULL_X1;              // 由封裝檔的 header 決定
  var SUN = norm([-0.45, 0.62, -0.38]), SKY = [0.42, 0.58, 0.80], HORIZON = [0.80, 0.80, 0.77], GROUND = [0.30, 0.27, 0.22];
  var WIND = [1.6, 0, 0.7];

  function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function len(a) { return Math.hypot(a[0], a[1], a[2]); }
  function rotM(axis, ang) {          // 繞任意軸的 mat4
    var a = norm(axis), c = Math.cos(ang), s = Math.sin(ang), t = 1 - c, x = a[0], y = a[1], z = a[2];
    return new Float32Array([t * x * x + c, t * x * y + s * z, t * x * z - s * y, 0, t * x * y - s * z, t * y * y + c, t * y * z + s * x, 0,
      t * x * z + s * y, t * y * z - s * x, t * z * z + c, 0, 0, 0, 0, 1]);
  }
  function trans(x, y, z) { var m = M4.ident(); m[12] = x; m[13] = y; m[14] = z; return m; }

  // ───────────────────────── WebGL ─────────────────────────
  var cv = $('cv'), gl = cv.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true });
  function fail(msg) { var e = $('err'); e.style.display = 'block'; e.textContent = msg; $('load').textContent = msg; }
  if (!gl) { fail('這個瀏覽器沒有 WebGL2，畫不出來。'); return; }

  var P = {};
  function programs() {
    P.vox = VK.compile(gl, VK.VOXEL_VS, VK.VOXEL_FS);
    P.deb = VK.compile(gl,
      '#version 300 es\nlayout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec4 iP; layout(location=3) in vec4 iQ; layout(location=4) in float iC;\n' +
      'uniform mat4 uVP; out vec3 vN; out vec3 vW; flat out float vC;\n' +
      'vec3 rq(vec4 q, vec3 v){ return v+2.0*cross(q.xyz, cross(q.xyz,v)+q.w*v); }\n' +
      'void main(){ vec3 w=iP.xyz+rq(iQ,aP*iP.w); vW=w; vN=rq(iQ,aN); vC=iC; gl_Position=uVP*vec4(w,1.0); }\n',
      '#version 300 es\nprecision highp float; in vec3 vN; in vec3 vW; flat in float vC; uniform vec3 uSun,uEye,uFog,uSky,uGround; uniform float uFogD; out vec4 o;\n' +
      'void main(){ uint c=uint(vC+0.5); vec3 b=vec3(float((c>>5u)&7u)/7.0,float((c>>2u)&7u)/7.0,float(c&3u)/3.0); vec3 n=normalize(vN);\n' +
      ' vec3 col=b*(mix(uGround,uSky,n.y*0.5+0.5)*0.62+vec3(1.0,0.96,0.88)*max(dot(n,uSun),0.0)*0.78);\n' +
      ' if(vW.y<0.0) col=mix(col,vec3(0.04,0.18,0.22),0.6); float fd=length(vW-uEye); o=vec4(mix(col,uFog,1.0-exp(-fd*uFogD)),1.0); }\n');
    P.tri = VK.compile(gl,
      '#version 300 es\nlayout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec3 aC; uniform mat4 uModel,uVP; out vec3 vN; out vec3 vW; out vec3 vC;\n' +
      'void main(){ vec4 w=uModel*vec4(aP,1.0); vW=w.xyz; vN=mat3(uModel)*aN; vC=aC; gl_Position=uVP*w; }\n',
      '#version 300 es\nprecision highp float; in vec3 vN; in vec3 vW; in vec3 vC; uniform vec3 uSun,uEye,uFog,uSky,uGround; uniform float uFogD,uLit; out vec4 o;\n' +
      'void main(){ vec3 n=normalize(vN); float d=abs(dot(n,uSun)); vec3 col=uLit>0.5 ? vC*(mix(uGround,uSky,0.6)*0.65+vec3(1.0,0.96,0.88)*d*0.7) : vC;\n' +
      ' if(vW.y<0.0) col=mix(col,vec3(0.04,0.18,0.22),0.6); float fd=length(vW-uEye); o=vec4(mix(col,uFog,1.0-exp(-fd*uFogD)),1.0); }\n');
    P.pt = VK.compile(gl,
      '#version 300 es\nlayout(location=0) in vec3 aP; layout(location=1) in float aS; layout(location=2) in vec4 aC; uniform mat4 uVP; uniform float uPx; out vec4 vC; out float vK;\n' +
      'void main(){ vec4 c=uVP*vec4(aP,1.0); gl_Position=c; gl_PointSize=clamp(aS*uPx/max(c.w,0.1),1.0,256.0); vC=aC; vK=aS<0.0?1.0:0.0; }\n',
      '#version 300 es\nprecision highp float; in vec4 vC; out vec4 o;\n' +
      'void main(){ vec2 d=gl_PointCoord*2.0-1.0; float r=dot(d,d); if(r>1.0) discard; float a=vC.a*(1.0-r*r); o=vec4(vC.rgb*(1.0-0.25*r),a); }\n');
    P.water = VK.compile(gl,
      '#version 300 es\nlayout(location=0) in vec2 aP; uniform mat4 uVP; out vec3 vW; void main(){ vW=vec3(aP.x,0.0,aP.y); gl_Position=uVP*vec4(vW,1.0); }\n',
      '#version 300 es\nprecision highp float; in vec3 vW; uniform vec3 uEye,uSun,uFog,uSky; uniform float uT,uFogD; out vec4 o;\n' +
      'vec2 wv(vec2 p,vec2 d,float f,float s){ float k=dot(p,d)*f+uT*s; return d*cos(k)*f; }\n' +
      'void main(){ vec2 p=vW.xz; float fd0=length(vW-uEye); float k0=1.0-smoothstep(120.0,520.0,fd0), k1=1.0-smoothstep(60.0,260.0,fd0), k2=1.0-smoothstep(25.0,110.0,fd0);\n' +
      ' vec2 g=0.10*k0*wv(p,normalize(vec2(1.0,0.3)),0.35,1.3)+0.07*k1*wv(p,normalize(vec2(-0.4,1.0)),0.6,1.9)+0.04*k2*wv(p,normalize(vec2(0.7,-0.7)),1.3,2.7)+0.02*k2*wv(p,normalize(vec2(0.2,0.9)),2.9,3.9);\n' +
      ' vec3 n=normalize(vec3(-g.x,1.0,-g.y)); vec3 v=normalize(uEye-vW); float fr=0.04+0.96*pow(1.0-max(dot(n,v),0.0),5.0);\n' +
      ' vec3 r=reflect(-v,n); vec3 sky=mix(uFog,uSky,clamp(r.y*1.6,0.0,1.0)); float sp=pow(max(dot(r,uSun),0.0),180.0)*1.6;\n' +
      ' vec3 deep=vec3(0.03,0.16,0.21); vec3 c=mix(deep,sky,fr)+vec3(1.0,0.92,0.75)*sp; float fd=length(vW-uEye);\n' +
      ' c=mix(c,uFog,1.0-exp(-fd*uFogD)); o=vec4(c,mix(0.86,1.0,clamp(fd/600.0,0.0,1.0))); }\n');
    P.sky = VK.compile(gl,
      '#version 300 es\nlayout(location=0) in vec2 aP; uniform mat4 uInv; out vec3 vD; void main(){ vec4 a=uInv*vec4(aP,1.0,1.0); vD=a.xyz/a.w; gl_Position=vec4(aP,0.9999,1.0); }\n',
      '#version 300 es\nprecision highp float; in vec3 vD; uniform vec3 uEye,uSun,uFog,uSky; out vec4 o;\n' +
      'void main(){ vec3 d=normalize(vD-uEye); float h=clamp(d.y,0.0,1.0); vec3 c=mix(uFog,uSky,pow(h,0.55)); float s=max(dot(d,uSun),0.0);\n' +
      ' c+=vec3(1.0,0.85,0.6)*(pow(s,600.0)*3.0+pow(s,12.0)*0.18); if(d.y<0.0) c=uFog; o=vec4(c,1.0); }\n');
  }
  function setCommon(p) {
    var u = p.u;
    if (u.uVP) gl.uniformMatrix4fv(u.uVP, false, CAM.vp);
    if (u.uSun) gl.uniform3fv(u.uSun, SUN);
    if (u.uEye) gl.uniform3fv(u.uEye, CAM.eye);
    if (u.uFog) gl.uniform3fv(u.uFog, HORIZON);
    if (u.uSky) gl.uniform3fv(u.uSky, SKY);
    if (u.uGround) gl.uniform3fv(u.uGround, GROUND);
    if (u.uFogD) gl.uniform1f(u.uFogD, 0.0016);
    if (u.uWater) gl.uniform1f(u.uWater, 0.0);
    if (u.uTint) gl.uniform1f(u.uTint, 0.0);
  }

  // ───────────────────────── 音效（按下開始後才建；沒有聲音也完整） ─────────────────────────
  var AC = null, master = null, noiseBuf = null, muted = false;
  function initAudio() {
    if (AC || DEMO >= 0) return;
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = 0.8; master.connect(AC.destination);
      var n = AC.sampleRate * 2; noiseBuf = AC.createBuffer(1, n, AC.sampleRate);
      var d = noiseBuf.getChannelData(0), s = 22222;
      for (var i = 0; i < n; i++) { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; d[i] = s / 0x3fffffff - 1; }
    } catch (e) { AC = null; }
  }
  function sfx(kind, at, vol) {
    if (!AC || muted) return;
    var dist = at ? len(sub(at, CAM.eye)) : 0, v = (vol || 1) / (1 + dist / 70);
    if (v < 0.01) return;
    var t = AC.currentTime + Math.min(0.25, dist / 340) * 0.5, g = AC.createGain(); g.connect(master);
    var src = AC.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = 0.6 + Math.random() * 0.5;
    var f = AC.createBiquadFilter(); src.connect(f); f.connect(g);
    function env(a, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a * v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d); src.start(t, Math.random()); src.stop(t + d + 0.05); }
    if (kind === 'boom') {
      f.type = 'lowpass'; f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(90, t + 0.9); env(1.1, 1.3);
      var o = AC.createOscillator(), og = AC.createGain(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(32, t + 0.6);
      og.gain.setValueAtTime(0.9 * v, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.7); o.connect(og); og.connect(master); o.start(t); o.stop(t + 0.75);
    } else if (kind === 'crack') { f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 900; f.Q.value = 0.8; env(1.4, 0.35); }
    else if (kind === 'splash') { f.type = 'highpass'; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2500, t + 0.5); env(0.6, 0.8); }
    else if (kind === 'blast') { f.type = 'lowpass'; f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(60, t + 1.8); env(1.6, 2.2); }
    else if (kind === 'creak') { f.type = 'lowpass'; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(80, t + 2.5); env(1.2, 2.8); }
  }

  // ───────────────────────── 鏡頭 ─────────────────────────
  var CAM = { yaw: 2.2, pitch: 0.24, dist: 175, tgt: [0, 6, 0], eye: [0, 0, 0], vp: null, inv: null, mode: 0, follow: null, hold: 0, w: 1, h: 1 };
  var CAM_NAMES = ['自由鏡頭', '追砲彈', '看敵艦', '看我艦'];
  function camUpdate(dt) {
    var tgt = CAM.tgt, dist = CAM.dist, yaw = CAM.yaw, pitch = CAM.pitch, eye;
    if (CAM.mode === 1 && CAM.follow) {
      var b = CAM.follow, vd = norm(b.v);
      eye = add(sub(b.p, mul(vd, 9)), [0, 2.2, 0]); tgt = add(b.p, mul(vd, 25));
      CAM.eye = lerp3(CAM.eye, eye, 1 - Math.exp(-dt * 10)); CAM.look = lerp3(CAM.look || tgt, tgt, 1 - Math.exp(-dt * 10));
    } else {
      if (CAM.mode === 2 || CAM.mode === 3) { var sh = SHIPS[CAM.mode === 2 ? 1 - PLAYER_I : PLAYER_I]; if (sh) tgt = shipCenter(sh); }
      eye = [tgt[0] + Math.cos(yaw) * Math.cos(pitch) * dist, tgt[1] + Math.sin(pitch) * dist, tgt[2] + Math.sin(yaw) * Math.cos(pitch) * dist];
      if (eye[1] < 1.5) eye[1] = 1.5;
      var k = CAM.snap ? 1 : 1 - Math.exp(-dt * 6); CAM.snap = false;
      CAM.eye = lerp3(CAM.eye, eye, k); CAM.look = lerp3(CAM.look || tgt, tgt, k);
    }
    var proj = M4.persp(0.9, CAM.w / CAM.h, 0.5, 5000), view = M4.lookAt(CAM.eye, CAM.look, [0, 1, 0]);
    CAM.vp = M4.mul(proj, view); CAM.inv = M4.inv(CAM.vp);
  }
  function lerp3(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }

  // ───────────────────────── 船 ─────────────────────────
  var BASE = null, PRISTINE = null, QIDX = null, MODEL = null, RIG = null;
  var SHIPS = [], PIECES = [], BALLS = [], EVENTS = [], PLAYER_I = 0;
  var MODE = 'pve', DIST = 140, SIMT = 0, RUNNING = false, PAUSED = false, OVER = false, AMMO_I = 0;

  function shipBaseMatrix() {   // 格 → 船體（公尺）：(x, y, z) ⇒ (S(x−CX), S(z−ZW), −S(y−CY))
    return new Float32Array([S, 0, 0, 0, 0, 0, -S, 0, 0, S, 0, 0, -S * CX, -S * ZW, S * CY, 1]);
  }
  function shipMatrix(sh) {
    var m = trans(sh.px, -sh.sink + sh.bob, sh.pz);
    m = M4.mul(m, rotM([0, 1, 0], sh.yaw));
    m = M4.mul(m, rotM([0, 0, 1], sh.pitchA));
    m = M4.mul(m, rotM([1, 0, 0], sh.rollA + (sh.rollW || 0)));
    return M4.mul(m, shipBaseMatrix());
  }
  function shipCenter(sh) { return M4.pt(sh.M, CX, CY, 140); }
  function toLocal(sh, p) { return M4.pt(sh.inv, p[0], p[1], p[2]); }

  function makeShip(i, team, yaw, pz) {
    var grid = BASE.share(), rsSet = new VK.RegionSet(gl, grid, QIDX);
    rsSet.shareFrom(PRISTINE);
    var sh = {
      i: i, team: team, grid: grid, rs: rsSet, yaw: yaw, px: 0, pz: pz, sink: 0, sinkV: 0, rollA: 0, pitchA: 0, rollV: 0, bob: 0,
      phase: rnd() * 6.28, orig: grid.count, flood: new Float32Array(SZ * 3), lost: 0, seeds: [], impulse: [0, 0, 0],
      guns: [], ropes: [], sails: [], rigDirty: true, lines: null, tris: null, masts: [], aim: null, reloadT: MODE === 'sandbox' && i === PLAYER_I ? RELOAD_SANDBOX : RELOAD,
      fired: 0, hits: 0, salvo: 0, aiWait: rr(1, 3), sunk: false, struck: false, gunsAlive: 0, mastsUp: 3, sinkingFinal: false
    };
    // 砲：S 舷 14 門（兩艘都是右舷朝對方）；砲口 ＝ 外框裡 y 最大那一層的中心
    (MODEL.header.parts || []).forEach(function (p) {
      if (!/\/砲-S\d+$/.test(p.path)) return;
      var b = p.box, maxY = -1, sx = 0, sz = 0, n = 0, cnt = 0, x, y, z;
      for (x = b[0]; x <= b[3]; x++) for (y = b[1]; y <= b[4]; y++) for (z = b[2]; z <= b[5]; z++) if (BASE.get(x, y, z)) { cnt++; if (y > maxY) maxY = y; }
      for (x = b[0]; x <= b[3]; x++) for (z = b[2]; z <= b[5]; z++) for (y = maxY - 1; y <= maxY; y++) if (BASE.get(x, y, z)) { sx += x; sz += z; n++; }
      sh.guns.push({ name: p.path.split('/').pop(), box: b, muz: [sx / n + 0.5, maxY + 1.5, sz / n + 0.5], orig: cnt, alive: true, reload: rr(0, 1.2) });
    });
    sh.guns.sort(function (a, b) { return b.muz[0] - a.muz[0]; });
    // 繩與帆：兩端（帆取最高那一排）各找最近的實心格當錨 —— 錨被打掉或跟船分家 ⇒ 繩斷、帆掉
    RIG.ropes.forEach(function (r) {
      var n = r.pts.length / 3;
      sh.ropes.push({ pts: r.pts, col: r.color, bb: ropeBox(r.pts), a: anchorNear(r.pts[0], r.pts[1], r.pts[2], 5), b: anchorNear(r.pts[n * 3 - 3], r.pts[n * 3 - 2], r.pts[n * 3 - 1], 5), name: r.name });
    });
    linkRopes(sh.ropes);
    RIG.sails.forEach(function (s) {
      var vz = -1e9, ax = 0, ay = 0, az = 0, k = 0, j;
      for (j = 2; j < s.verts.length; j += 3) vz = Math.max(vz, s.verts[j]);
      for (j = 0; j < s.verts.length; j += 3) if (s.verts[j + 2] > vz - 2) { ax += s.verts[j]; ay += s.verts[j + 1]; az += s.verts[j + 2]; k++; }
      sh.sails.push({ verts: s.verts, tris: s.tris, col: s.color, a: anchorNear(ax / k, ay / k, az / k, 8), name: s.name });
    });
    MASTS.forEach(function (m) { sh.masts.push({ name: m.name, x: m.x, z0: m.z0, z1: m.z1, orig: m.orig, up: true }); });
    sh.M = shipMatrix(sh); sh.inv = M4.inv(sh.M);
    return sh;
  }
  /** 兩端附近沒有實心格的繩（ratline 掛在 shroud 上）⇒ 掛在端點旁邊那條繩上：那條斷了它也斷、那條跟著桅倒它也跟著倒。 */
  function linkRopes(ropes) {
    ropes.forEach(function (r, i) {
      if (r.a >= 0 && r.b >= 0) return;
      r.par = [];
      var n = r.pts.length / 3;
      [[0, r.a], [n - 1, r.b]].forEach(function (e) {
        if (e[1] >= 0) return;
        var P = [r.pts[e[0] * 3], r.pts[e[0] * 3 + 1], r.pts[e[0] * 3 + 2]], best = -1, bd = 9;      // 0.3 公尺內
        ropes.forEach(function (o, j) {
          if (j === i || P[0] < o.bb[0] - 3 || P[0] > o.bb[3] + 3 || P[1] < o.bb[1] - 3 || P[1] > o.bb[4] + 3 || P[2] < o.bb[2] - 3 || P[2] > o.bb[5] + 3) return;
          for (var k = 0; k + 5 < o.pts.length; k += 3) { var d = segDist2(P, o.pts[k], o.pts[k + 1], o.pts[k + 2], o.pts[k + 3], o.pts[k + 4], o.pts[k + 5]); if (d < bd) { bd = d; best = j; } }
        });
        if (best >= 0 && r.par.indexOf(best) < 0) r.par.push(best);
      });
      if (!r.par.length) r.dead = true;     // 兩端都不靠格、也不靠別的繩 ⇒ 綁在模型上（例：舵索綁舵輪），模型這版不收
    });
  }
  function ropeBox(p) {
    var b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
    for (var j = 0; j < p.length; j += 3) for (var a = 0; a < 3; a++) { if (p[j + a] < b[a]) b[a] = p[j + a]; if (p[j + a] > b[a + 3]) b[a + 3] = p[j + a]; }
    return b;
  }
  function anchorNear(x, y, z, r) {
    var bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z), best = -1, bd = 1e9;
    for (var dz = -r; dz <= r; dz++) for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
      if (!BASE.get(bx + dx, by + dy, bz + dz)) continue;
      var d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = VK.pack(bx + dx, by + dy, bz + dz); }
    }
    return best;
  }
  var MASTS = [];
  function findMasts() {   // 桅的 x 從帆的名字推（fore／main／mizzen），探針：桅身中段一小塊
    var acc = {};
    RIG.sails.forEach(function (s) {
      var mm = /^(fore|main|mizzen)-(course|topsail|topgallant|royal)$/.exec(s.name); if (!mm) return; var k = mm[1];
      acc[k] = acc[k] || [0, 0];
      for (var j = 0; j < s.verts.length; j += 3) { acc[k][0] += s.verts[j]; acc[k][1]++; }
    });
    var label = { fore: '前桅', main: '主桅', mizzen: '後桅' };
    ['fore', 'main', 'mizzen'].forEach(function (k) {
      if (!acc[k]) return;
      var ax = Math.round(acc[k][0] / acc[k][1]), mx = ax, bn = 0, best = null;
      for (var x = ax - 45; x <= ax + 45; x++) { var c = countBox(BASE, x, CY - 4, 250, x, CY + 4, 290); if (c > bn) { bn = c; mx = x; } }   // 桅身：中線上一根直立的柱子
      for (var z0 = 220; z0 <= 420 && !best; z0 += 20) { var n = countBox(BASE, mx - 8, CY - 8, z0, mx + 8, CY + 8, z0 + 20); if (n > 20) best = { z0: z0, n: n }; }
      if (best) MASTS.push({ name: label[k], x: mx, z0: best.z0, z1: best.z0 + 20, orig: best.n });
    });
  }
  function countBox(g, x0, y0, z0, x1, y1, z1) { var n = 0; for (var x = x0; x <= x1; x++) for (var y = y0; y <= y1; y++) for (var z = z0; z <= z1; z++) if (g.get(x, y, z)) n++; return n; }

  // ───────────────────────── 繩與帆的 GPU 緩衝 ─────────────────────────
  function buildRig(owner) {
    var L = [], T = [];
    owner.ropes.forEach(function (r) {
      if (r.dead) return;
      for (var j = 0; j + 5 < r.pts.length; j += 3) L.push(r.pts[j], r.pts[j + 1], r.pts[j + 2], r.col[0], r.col[1], r.col[2], r.pts[j + 3], r.pts[j + 4], r.pts[j + 5], r.col[0], r.col[1], r.col[2]);
    });
    owner.sails.forEach(function (s) {
      if (s.dead) return;
      var v = s.verts, c = s.col;
      for (var j = 0; j < s.tris.length; j += 3) {
        var a = s.tris[j] * 3, b = s.tris[j + 1] * 3, d = s.tris[j + 2] * 3;
        var n = norm(cross([v[b] - v[a], v[b + 1] - v[a + 1], v[b + 2] - v[a + 2]], [v[d] - v[a], v[d + 1] - v[a + 1], v[d + 2] - v[a + 2]]));
        [a, b, d].forEach(function (k) { T.push(v[k], v[k + 1], v[k + 2], n[0], n[1], n[2], c[0], c[1], c[2]); });
      }
    });
    owner.lines = upload(owner.lines, new Float32Array(L), 6, [[0, 3, 0], [2, 3, 3]]);
    owner.tris = upload(owner.tris, new Float32Array(T), 9, [[0, 3, 0], [1, 3, 3], [2, 3, 6]]);
    owner.rigDirty = false;
  }
  function upload(o, data, stride, attrs) {
    if (!o) { o = { vao: gl.createVertexArray(), vbo: gl.createBuffer(), n: 0 }; gl.bindVertexArray(o.vao); gl.bindBuffer(gl.ARRAY_BUFFER, o.vbo);
      attrs.forEach(function (a) { gl.enableVertexAttribArray(a[0]); gl.vertexAttribPointer(a[0], a[1], gl.FLOAT, false, stride * 4, a[2] * 4); }); gl.bindVertexArray(null); }
    gl.bindBuffer(gl.ARRAY_BUFFER, o.vbo); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW); o.n = data.length / stride;
    return o;
  }

  // ───────────────────────── 碎片（每格一顆小方塊，GPU instancing） ─────────────────────────
  var DMAX = 45000, D = {
    n: 0, p: new Float32Array(DMAX * 3), v: new Float32Array(DMAX * 3), q: new Float32Array(DMAX * 4), w: new Float32Array(DMAX * 3),
    life: new Float32Array(DMAX), size: new Float32Array(DMAX), col: new Uint8Array(DMAX), st: new Uint8Array(DMAX), ship: new Int8Array(DMAX)
  };
  var DINST = new Float32Array(DMAX * 9);
  function spawnDebris(p, v, col, size, life) {
    var i;
    if (D.n < DMAX) i = D.n++;
    else { i = (rnd() * DMAX) | 0; }      // 滿了 ⇒ 隨便頂掉一顆（只影響畫面，不影響模擬判定）
    D.p[i * 3] = p[0]; D.p[i * 3 + 1] = p[1]; D.p[i * 3 + 2] = p[2];
    D.v[i * 3] = v[0]; D.v[i * 3 + 1] = v[1]; D.v[i * 3 + 2] = v[2];
    var ax = norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]), sp = rr(4, 18);
    D.w[i * 3] = ax[0] * sp; D.w[i * 3 + 1] = ax[1] * sp; D.w[i * 3 + 2] = ax[2] * sp;
    D.q[i * 4] = 0; D.q[i * 4 + 1] = 0; D.q[i * 4 + 2] = 0; D.q[i * 4 + 3] = 1;
    D.life[i] = life; D.size[i] = size; D.col[i] = col; D.st[i] = 1; D.ship[i] = -1;
  }
  function stepDebris(dt) {
    for (var i = 0; i < D.n; i++) {
      var st = D.st[i]; if (!st) continue;
      D.life[i] -= dt;
      if (D.life[i] <= 0) { kill(i); i--; continue; }
      var o = i * 3;
      if (st === 2) {                                            // 落在甲板上：跟著船（座標存的是格座標）；底下那一格沒了 ⇒ 重新掉
        var hs = SHIPS[D.ship[i]];
        if (hs.grid.get(D.p[o] | 0, D.p[o + 1] | 0, (D.p[o + 2] | 0) - 1)) continue;
        var wp = M4.pt(hs.M, D.p[o], D.p[o + 1], D.p[o + 2]);
        D.p[o] = wp[0]; D.p[o + 1] = wp[1]; D.p[o + 2] = wp[2]; D.v[o] = D.v[o + 1] = D.v[o + 2] = 0; D.st[i] = st = 1;
      }
      if (st === 1) { D.v[o + 1] -= G * dt; D.v[o] *= 1 - 0.15 * dt; D.v[o + 2] *= 1 - 0.15 * dt; }
      D.p[o] += D.v[o] * dt; D.p[o + 1] += D.v[o + 1] * dt; D.p[o + 2] += D.v[o + 2] * dt;
      // 轉
      var qi = i * 4, qx = D.q[qi], qy = D.q[qi + 1], qz = D.q[qi + 2], qw = D.q[qi + 3], wx = D.w[o] * dt * 0.5, wy = D.w[o + 1] * dt * 0.5, wz = D.w[o + 2] * dt * 0.5;
      var nx = qx + wx * qw + wy * qz - wz * qy, ny = qy + wy * qw + wz * qx - wx * qz, nz = qz + wz * qw + wx * qy - wy * qx, nw = qw - wx * qx - wy * qy - wz * qz, l = Math.hypot(nx, ny, nz, nw);
      D.q[qi] = nx / l; D.q[qi + 1] = ny / l; D.q[qi + 2] = nz / l; D.q[qi + 3] = nw / l;
      if (st === 1) {
        if (D.p[o + 1] < 0) {                                    // 落水：慢慢沉
          D.st[i] = 3; D.v[o] *= 0.1; D.v[o + 1] = -0.25; D.v[o + 2] *= 0.1; D.life[i] = Math.min(D.life[i], 4);
          if (rnd() < 0.04) spawnPt(add([D.p[o], 0.05, D.p[o + 2]], [0, 0, 0]), [0, 1.5, 0], 0.5, [0.9, 0.95, 1], 0.6, 0.6, 0, 1);
          continue;
        }
        if (D.v[o + 1] < 0) for (var s = 0; s < SHIPS.length; s++) {       // 掉到甲板上 ⇒ 停住
          var sh = SHIPS[s], L = M4.pt(sh.inv, D.p[o], D.p[o + 1], D.p[o + 2]);
          if (L[0] < 0 || L[2] < 0 || L[0] >= sh.grid.sx) continue;
          if (sh.grid.get(L[0] | 0, L[1] | 0, L[2] | 0)) {
            D.st[i] = 2; D.ship[i] = s; D.p[o] = L[0]; D.p[o + 1] = L[1]; D.p[o + 2] = Math.floor(L[2]) + 1.0 + D.size[i] * 5;
            D.life[i] = Math.min(D.life[i], rr(25, 45)); break;
          }
        }
      }
    }
  }
  function kill(i) {
    var j = D.n - 1;
    if (i !== j) {
      D.p.copyWithin(i * 3, j * 3, j * 3 + 3); D.v.copyWithin(i * 3, j * 3, j * 3 + 3); D.w.copyWithin(i * 3, j * 3, j * 3 + 3); D.q.copyWithin(i * 4, j * 4, j * 4 + 4);
      D.life[i] = D.life[j]; D.size[i] = D.size[j]; D.col[i] = D.col[j]; D.st[i] = D.st[j]; D.ship[i] = D.ship[j];
    }
    D.st[j] = 0; D.n--;
  }

  // ───────────────────────── 粒子（煙、水花、火光、砲彈） ─────────────────────────
  var PMAX = 12000, PT = { n: 0, p: new Float32Array(PMAX * 3), v: new Float32Array(PMAX * 3), life: new Float32Array(PMAX), max: new Float32Array(PMAX),
    s0: new Float32Array(PMAX), s1: new Float32Array(PMAX), c: new Float32Array(PMAX * 3), a: new Float32Array(PMAX), grav: new Float32Array(PMAX), drag: new Float32Array(PMAX) };
  var PBUF = new Float32Array(PMAX * 8);
  function spawnPt(p, v, life, col, a, s0, s1, grav, drag) {
    if (PT.n >= PMAX) return;
    var i = PT.n++;
    PT.p[i * 3] = p[0]; PT.p[i * 3 + 1] = p[1]; PT.p[i * 3 + 2] = p[2]; PT.v[i * 3] = v[0]; PT.v[i * 3 + 1] = v[1]; PT.v[i * 3 + 2] = v[2];
    PT.life[i] = PT.max[i] = life; PT.c[i * 3] = col[0]; PT.c[i * 3 + 1] = col[1]; PT.c[i * 3 + 2] = col[2]; PT.a[i] = a; PT.s0[i] = s0; PT.s1[i] = s1; PT.grav[i] = grav || 0; PT.drag[i] = drag || 0;
  }
  function stepPts(dt) {
    for (var i = 0; i < PT.n; i++) {
      PT.life[i] -= dt;
      if (PT.life[i] <= 0) {
        var j = --PT.n;
        if (i !== j) { PT.p.copyWithin(i * 3, j * 3, j * 3 + 3); PT.v.copyWithin(i * 3, j * 3, j * 3 + 3); PT.c.copyWithin(i * 3, j * 3, j * 3 + 3);
          PT.life[i] = PT.life[j]; PT.max[i] = PT.max[j]; PT.a[i] = PT.a[j]; PT.s0[i] = PT.s0[j]; PT.s1[i] = PT.s1[j]; PT.grav[i] = PT.grav[j]; PT.drag[i] = PT.drag[j]; }
        i--; continue;
      }
      var o = i * 3, k = 1 - PT.drag[i] * dt;
      PT.v[o] = PT.v[o] * k + WIND[0] * PT.drag[i] * dt; PT.v[o + 1] = PT.v[o + 1] * k - PT.grav[i] * dt; PT.v[o + 2] = PT.v[o + 2] * k + WIND[2] * PT.drag[i] * dt;
      PT.p[o] += PT.v[o] * dt; PT.p[o + 1] += PT.v[o + 1] * dt; PT.p[o + 2] += PT.v[o + 2] * dt;
      if (PT.grav[i] > 0 && PT.p[o + 1] < 0) PT.life[i] = Math.min(PT.life[i], 0.05);
    }
  }
  function smoke(p, dir, n, big) {
    for (var i = 0; i < n; i++) {
      var v = add(mul(dir, rr(2, big ? 9 : 14)), [gauss() * 1.2, rr(0.3, 1.6), gauss() * 1.2]);
      var g = rr(0.62, 0.86);
      spawnPt(add(p, mul(dir, rr(0, 2))), v, rr(4, 9), [g, g, g * 0.98], rr(0.35, 0.55), rr(1.2, 2.2) * (big ? 1.6 : 1), rr(6, 11) * (big ? 1.5 : 1), -0.05, 1.1);
    }
  }
  function flash(p, dir, n, big) {
    for (var i = 0; i < n; i++) spawnPt(p, add(mul(dir, rr(5, 30)), [gauss() * 3, gauss() * 3, gauss() * 3]), rr(0.08, 0.22), [1, rr(0.6, 0.85), 0.3], 1, rr(1, 2.5) * (big ? 2 : 1), 0.3, 0, 4);
  }
  function splash(p, big) {
    var n = big ? 60 : 26;
    for (var i = 0; i < n; i++) spawnPt([p[0] + gauss() * 0.6, 0.1, p[2] + gauss() * 0.6], [gauss() * 1.6, rr(4, big ? 14 : 10), gauss() * 1.6], rr(0.8, 1.8), [0.92, 0.96, 1], 0.75, rr(0.4, 1.0), rr(0.8, 1.6), G, 0.3);
    for (i = 0; i < 10; i++) spawnPt([p[0] + gauss() * 1.5, 0.15, p[2] + gauss() * 1.5], [gauss() * 0.4, 0.2, gauss() * 0.4], rr(1.5, 3), [0.95, 0.97, 1], 0.35, 1.5, 4, 0, 0.5);
    sfx('splash', p, big ? 1.2 : 0.7);
  }

  // ───────────────────────── 拆格：砲彈打碎船殼 ─────────────────────────
  var HARD = { 36: 3.5, 146: 3.5 };   // 鐵（砲身、錨、鑄鐵灰）比木頭難打穿
  function removeVoxel(sh, x, y, z, seeds) {
    var c = sh.grid.set(x, y, z, 0);
    if (c <= 0) return 0;
    sh.rs.touch(x, y, z); sh.lost++;
    if (z < SZ) { sh.flood[z * 3]++; sh.flood[z * 3 + 1] += y > CY ? 1 : -1; sh.flood[z * 3 + 2] += x > CX ? 1 : -1; }
    if (seeds) { var s = sh.seeds; s.push(VK.pack(x + 1, y, z), VK.pack(x - 1, y, z), VK.pack(x, y + 1, z), VK.pack(x, y - 1, z), VK.pack(x, y, z + 1), VK.pack(x, y, z - 1)); }
    return c;
  }
  /** 一塊被打碎：形狀不規則（順著船長方向的木紋拉長、邊緣參差）、外緣有幾條順紋裂開；碎屑往砲彈前進的方向噴。回：打掉幾格的「硬度和」。 */
  function shatter(sh, c, dirL, R, velW, debrisCap, grainK) {
    var cost = 0, n = 0, rI = Math.ceil(R * 1.6), cx = Math.floor(c[0]), cy = Math.floor(c[1]), cz = Math.floor(c[2]);
    var removed = [];
    for (var dz = -rI; dz <= rI; dz++) for (var dy = -rI; dy <= rI; dy++) for (var dx = -rI; dx <= rI; dx++) {
      var x = cx + dx, y = cy + dy, z = cz + dz, d = Math.sqrt(dx * dx * grainK + dy * dy + dz * dz);
      if (d > R * (0.6 + 0.62 * hash3(x, y, z))) continue;
      var col = removeVoxel(sh, x, y, z, true);
      if (col) { cost += HARD[col] || 1; n++; removed.push(x, y, z, col); }
    }
    // 順紋裂開：外緣挑幾點，沿船長方向把同色的那一條撕掉
    for (var k = 0; k < 3 && n > 8; k++) {
      var a = rnd() * 6.2832, rx = cx + Math.round(Math.cos(a) * R * 1.25), rzz = cz + Math.round(Math.sin(a) * R * 0.9), ry = cy, base = 0;
      for (var dyy = 0; dyy < 5 && !base; dyy++) { ry = cy + [0, 1, -1, 2, -2][dyy]; base = sh.grid.get(rx, ry, rzz); }
      if (!base) continue;
      var dirx = Math.cos(a) < 0 ? -1 : 1, L = (rr(3, 11)) | 0;
      for (var t = 0; t < L; t++) { var xx = rx + dirx * t; if (sh.grid.get(xx, ry, rzz) !== base) break; var cc = removeVoxel(sh, xx, ry, rzz, true); if (cc) { removed.push(xx, ry, rzz, cc); cost += 1; n++; } }
    }
    // 碎屑
    var keep = removed.length / 4, pr = Math.min(1, debrisCap / Math.max(1, keep)), sp = len(velW), vd = norm(velW);
    for (var j = 0; j < removed.length; j += 4) {
      if (rnd() > pr) continue;
      var w = M4.pt(sh.M, removed[j] + 0.5, removed[j + 1] + 0.5, removed[j + 2] + 0.5);
      var v = add(mul(vd, sp * rr(0.03, 0.2)), [gauss() * 3.2, rr(0.5, 5), gauss() * 3.2]);
      spawnDebris(w, v, removed[j + 3], rr(0.05, 0.11), rr(6, 14));
    }
    sh.impulse = add(sh.impulse, mul(vd, n));
    return { cost: cost, n: n };
  }

  // ───────────────────────── 砲彈 ─────────────────────────
  function fireGun(sh, g, target, ammo) {
    if (!g.alive || g.reload > 0) return false;
    var mw = M4.pt(sh.M, g.muz[0], g.muz[1], g.muz[2]);
    var side = norm(M4.dir(sh.M, 0, 1, 0)); side[1] = 0; side = norm(side);
    var dx = target[0] - mw[0], dz = target[2] - mw[2], dy = target[1] - mw[1], d = Math.hypot(dx, dz);
    var v2 = V0 * V0, disc = v2 * v2 - G * (G * d * d + 2 * dy * v2);
    var el = disc < 0 ? 0.26 : Math.atan((v2 - Math.sqrt(disc)) / (G * d));
    var az = Math.atan2(dz, dx), saz = Math.atan2(side[2], side[0]), da = Math.atan2(Math.sin(az - saz), Math.cos(az - saz));
    da = clamp(da, -0.45, 0.45); az = saz + da;                      // 砲門只容得下 ±26°
    var spread = sh.i === PLAYER_I && MODE !== 'eve' ? 0.0045 : sh.aiSpread || 0.008;
    el = clamp(el + gauss() * spread, -0.17, 0.26); az += gauss() * spread;
    var dir = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
    var b = { p: mw.slice(), v: mul(dir, V0 * rr(0.985, 1.015)), owner: sh.i, ammo: ammo, trav: 0, alive: true, age: 0, bounced: false };
    BALLS.push(b); g.reload = sh.reloadT * rr(0.9, 1.1); sh.fired++;
    flash(add(mw, mul(dir, 1)), dir, 14, false); smoke(add(mw, mul(dir, 1.5)), dir, 10, false);
    sh.rollV += 0.0012;                                                 // 後座：船往反方向晃一下
    sfx('boom', mw, sh.i === PLAYER_I ? 1 : 0.8);
    if (CAM.mode === 1 && (sh.i === PLAYER_I || MODE === 'eve')) CAM.follow = b;
    return true;
  }
  /** 齊射：各砲平行開火 —— 瞄準點跟著那門砲在船上的前後位置平移，整排落在對方船身上（⛔ 不是 14 發擠進同一個洞）。 */
  function broadside(sh, ammo) {
    var k = 0, tgt = aimPoint(sh), ax = M4.dir(sh.M, 1, 0, 0); ax = norm([ax[0], 0, ax[2]]);
    var mid = 0, n = 0;
    sh.guns.forEach(function (g) { mid += g.muz[0]; n++; }); mid /= n || 1;
    sh.guns.forEach(function (g) {
      if (!g.alive || g.reload > 0) return;
      var off = (g.muz[0] - mid) * S * (ammo === 2 ? 0.15 : 1);      // 鏈彈是對著桅杆打的 ⇒ 往瞄準點收攏
      EVENTS.push({ t: SIMT + k * 0.075 + rr(0, 0.03), sh: sh.i, g: g, ammo: ammo, tgt: add(tgt, mul(ax, off)) }); k++;
    });
    if (k) sh.salvo++;
    return k;
  }
  function fireOne(sh, ammo) {
    var tgt = aimPoint(sh), best = null, bd = 1e9;
    sh.guns.forEach(function (g) { if (!g.alive || g.reload > 0) return; var w = M4.pt(sh.M, g.muz[0], g.muz[1], g.muz[2]), d = len(sub(w, tgt)); if (d < bd) { bd = d; best = g; } });
    if (best) fireGun(sh, best, tgt, ammo);
  }
  function aimPoint(sh) {
    var foe = SHIPS[1 - sh.i];
    if (sh.aim) return M4.pt(foe.M, sh.aim[0], sh.aim[1], sh.aim[2]);
    return M4.pt(foe.M, CX, CY, 90);
  }

  function stepBall(b, dt) {
    b.age += dt;
    var sp = len(b.v), steps = Math.max(1, Math.ceil(sp * dt / 0.05)), h = dt / steps;
    for (var s = 0; s < steps && b.alive; s++) {
      b.v[1] -= G * h;
      b.p[0] += b.v[0] * h; b.p[1] += b.v[1] * h; b.p[2] += b.v[2] * h; b.trav += len(b.v) * h;
      if (b.p[1] < 0) {
        var spd = len(b.v), ang = Math.asin(-b.v[1] / spd);
        if (b.ammo === 0 && !b.bounced && ang < 0.11 && spd > 90) {       // 打水漂：低角度的實心彈會跳一下
          b.v[1] = -b.v[1] * 0.45; b.v[0] *= 0.7; b.v[2] *= 0.7; b.p[1] = 0.01; b.bounced = true; splash(b.p, false); continue;
        }
        splash(b.p, true); b.alive = false; return;
      }
      for (var i = 0; i < SHIPS.length; i++) {
        var sh = SHIPS[i];
        if (i === b.owner && b.trav < 6) continue;
        var cc = sh.center, dx = b.p[0] - cc[0], dy = b.p[1] - cc[1], dz = b.p[2] - cc[2];
        if (dx * dx + dy * dy + dz * dz > sh.rad2) continue;
        var L = M4.pt(sh.inv, b.p[0], b.p[1], b.p[2]);
        if (b.ammo === 2) cutRig(sh, L, 14, b);
        else if (b.ammo === 0 && (s & 3) === 0) cutRig(sh, L, 3, b);
        if (!sh.grid.get(L[0] | 0, L[1] | 0, L[2] | 0)) {
          if (b.ammo !== 2) continue;
          // 鏈彈：兩顆彈中間一條鏈、轉著飛，約 2.4 公尺寬 ⇒ 沿那條橫桿取樣，碰到哪裡就從哪裡咬下去
          var dL = norm(M4.dir(sh.inv, b.v[0], b.v[1], b.v[2])), sd = norm(cross(dL, [0, 0, 1])), hitL = null;
          for (var q = -12; q <= 12 && !hitL; q += 3) { var Lq = [L[0] + sd[0] * q, L[1] + sd[1] * q, L[2]]; if (sh.grid.get(Lq[0] | 0, Lq[1] | 0, Lq[2] | 0)) hitL = Lq; }
          if (!hitL) continue;                                              // 橫掃是以彈心為中心 ⇒ 照彈心那一點咬
        }
        impact(b, sh, L);
        if (!b.alive) return;
      }
    }
    if (b.age > 12) b.alive = false;
  }
  function impact(b, sh, L) {
    var dirL = norm(M4.dir(sh.inv, b.v[0], b.v[1], b.v[2])), sp = len(b.v), r, w = b.p.slice();
    if (sh.i !== b.owner) SHIPS[b.owner].hits += (b.hitOnce ? 0 : 1); b.hitOnce = true;
    if (b.ammo === 1) {                                                   // 爆裂彈：第一下就炸
      r = shatter(sh, L, dirL, rr(10, 13), mul(b.v, 0.05), 650, 0.85);
      explode(w, sh, r.n); b.alive = false; return;
    }
    if (b.ammo === 2) {                                                   // 鏈彈：橫著的一片
      r = slab(sh, L, dirL, b);
      b.v = mul(b.v, Math.max(0, 1 - r.cost * 0.004));
      if (len(b.v) < 30) { ballToDebris(b); }
      if (r.n > 30) { sfx('crack', w, 0.9); smoke(w, [0, 0.2, 0], 3, false); }
      return;
    }
    r = shatter(sh, L, dirL, rr(3.4, 4.6), b.v, 260, 0.55);              // 實心彈：一口一口往裡鑽
    var nsp = sp - r.cost * 0.24;
    if (r.n > 0) { sfx('crack', w, 0.6 + Math.min(1, r.n / 200)); if (r.n > 40) smoke(w, mul(norm(b.v), -0.3), 2, false); }
    if (nsp < 28) { ballToDebris(b); return; }
    b.v = mul(b.v, nsp / sp);
  }
  function ballToDebris(b) { spawnDebris(b.p, mul(b.v, 0.3), 36, 0.15, 20); b.alive = false; }
  function slab(sh, L, dirL, b) {
    var side = norm(cross(dirL, [0, 0, 1])), cost = 0, n = 0, removed = [];
    for (var a = -13; a <= 13; a++) for (var h = -2; h <= 2; h++) for (var d = -2; d <= 2; d++) {
      if (Math.abs(a) > 10.5 + 2.5 * hash3(a, h, d + (L[2] | 0))) continue;
      var x = Math.floor(L[0] + side[0] * a + dirL[0] * d), y = Math.floor(L[1] + side[1] * a + dirL[1] * d), z = Math.floor(L[2] + h);
      var c = removeVoxel(sh, x, y, z, true); if (c) { cost += (HARD[c] || 1) * 2.4; n++; removed.push(x, y, z, c); }
    }
    for (var j = 0; j < removed.length; j += 4) if (rnd() < 0.5) {
      var w = M4.pt(sh.M, removed[j] + 0.5, removed[j + 1] + 0.5, removed[j + 2] + 0.5);
      spawnDebris(w, add(mul(norm(b.v), rr(4, 20)), [gauss() * 3, rr(0, 4), gauss() * 3]), removed[j + 3], rr(0.05, 0.11), rr(6, 12));
    }
    sh.impulse = add(sh.impulse, mul(norm(b.v), n * 2));
    return { cost: cost, n: n };
  }
  function explode(w, sh, n) {
    flash(w, [0, 1, 0], 50, true);
    for (var i = 0; i < 26; i++) spawnPt(w, [gauss() * 7, rr(1, 9), gauss() * 7], rr(0.3, 0.8), [1, rr(0.45, 0.7), 0.15], 0.9, rr(1.5, 3), rr(3, 5), 0, 2.5);
    smoke(w, [0, 1, 0], 22, true); sfx('blast', w, 1.4);
  }
  /** 經過的繩（距離 < r 格）斷掉；鏈彈穿過帆 ⇒ 帆掉下來。 */
  function cutRig(sh, L, r, b) {
    var r2 = r * r, changed = false;
    sh.ropes.forEach(function (rp) {
      if (rp.dead) return;
      var bb = rp.bb;
      if (L[0] < bb[0] - r || L[0] > bb[3] + r || L[1] < bb[1] - r || L[1] > bb[4] + r || L[2] < bb[2] - r || L[2] > bb[5] + r) return;
      var p = rp.pts;
      for (var j = 0; j + 5 < p.length; j += 3) {
        if (segDist2(L, p[j], p[j + 1], p[j + 2], p[j + 3], p[j + 4], p[j + 5]) < r2) { rp.dead = true; changed = true; break; }
      }
    });
    if (b.ammo === 2) sh.sails.forEach(function (s) {
      if (s.dead) return;
      var v = s.verts;
      for (var j = 0; j < v.length; j += 9) { var dx = v[j] - L[0], dy = v[j + 1] - L[1], dz = v[j + 2] - L[2]; if (dx * dx + dy * dy + dz * dz < 64) { dropSail(sh, s); changed = true; break; } }
    });
    if (changed) sh.rigDirty = true;
  }
  function segDist2(p, ax, ay, az, bx, by, bz) {
    var vx = bx - ax, vy = by - ay, vz = bz - az, wx = p[0] - ax, wy = p[1] - ay, wz = p[2] - az, l2 = vx * vx + vy * vy + vz * vz;
    var t = l2 > 0 ? clamp((wx * vx + wy * vy + wz * vz) / l2, 0, 1) : 0, dx = wx - vx * t, dy = wy - vy * t, dz = wz - vz * t;
    return dx * dx + dy * dy + dz * dz;
  }
  function dropSail(owner, s) {
    s.dead = true; owner.rigDirty = true;
    var M = owner.M, v = s.verts;
    for (var j = 0; j < v.length; j += 3 * 7) { var w = M4.pt(M, v[j], v[j + 1], v[j + 2]); spawnDebris(w, [gauss(), rr(-1, 1), gauss()], 255, rr(0.25, 0.5), rr(4, 8)); }
  }

  // ───────────────────────── 斷開的一團：倒下、落水 ─────────────────────────
  function isAnchor(x, y, z) { return z <= 12; }   // 龍骨（龍骨是直的 ⇒ 整條都在最底下）
  function integrity(sh) {
    if (!sh.seeds.length) return;
    var seeds = sh.seeds; sh.seeds = [];
    var pieces = VK.detached(sh.grid, seeds, isAnchor, 900000);
    pieces.forEach(function (pc) { spawnPiece(sh, pc); });
  }
  function spawnPiece(sh, pc) {
    var n = pc.length, i, x, y, z, c;
    if (n < 40) {                                               // 小碎塊直接變碎屑
      for (i = 0; i < n; i++) { x = pc[i] & 1023; y = (pc[i] >> 10) & 1023; z = pc[i] >> 20; c = removeVoxel(sh, x, y, z, false);
        if (c) spawnDebris(M4.pt(sh.M, x + 0.5, y + 0.5, z + 0.5), [gauss(), rr(-0.5, 1), gauss()], c, rr(0.06, 0.1), rr(8, 16)); }
      return;
    }
    var g = new VK.Grid([BASE.sx, BASE.sy, BASE.sz]), sx = 0, sy = 0, sz = 0, minz = 1e9, set = new Set();
    for (i = 0; i < n; i++) {
      x = pc[i] & 1023; y = (pc[i] >> 10) & 1023; z = pc[i] >> 20; c = removeVoxel(sh, x, y, z, false);
      if (!c) continue; g.set(x, y, z, c); sx += x; sy += y; sz += z; if (z < minz) minz = z; set.add(pc[i]);
    }
    var px = 0, py = 0, pz = 0, pn = 0;
    for (i = 0; i < n; i++) { z = pc[i] >> 20; if (z <= minz + 2) { px += (pc[i] & 1023); py += (pc[i] >> 10) & 1023; pz += z; pn++; } }
    var rs2 = new VK.RegionSet(gl, g, QIDX); rs2.buildAll();
    var M0 = sh.M, c0 = M4.pt(M0, sx / n + 0.5, sy / n + 0.5, sz / n + 0.5), pivot = M4.pt(M0, px / pn + 0.5, py / pn + 0.5, pz / pn);
    var imp = sh.impulse; imp = [imp[0], 0, imp[2]]; if (len(imp) < 1e-6) imp = [rnd() - 0.5, 0, rnd() - 0.5];
    var axis = norm(cross([0, 1, 0], norm(imp)));
    var piece = { grid: g, rs: rs2, M0: M0, c0: c0, c: c0.slice(), R: M4.ident(), v: [0, 0, 0], w: mul(axis, rr(0.18, 0.35)), pivot: pivot, n: n,
      hinge: c0[1] - pivot[1] > 2.5, t: 0, wet: false, ropes: [], sails: [], rigDirty: true, lines: null, tris: null };
    // 繩與帆跟著走：兩端都在這一團 ⇒ 帶走；只有一端 ⇒ 斷
    var moved = new Set();
    sh.ropes.forEach(function (r, j) {
      if (r.dead || r.par) return;
      var ia = set.has(r.a), ib = set.has(r.b);
      if (ia && ib) { piece.ropes.push({ pts: r.pts, col: r.col, bb: r.bb }); r.dead = true; moved.add(j); }
      else if (ia || ib) r.dead = true;
    });
    sh.ropes.forEach(function (r) {
      if (r.dead || !r.par) return;
      var ends = [r.a, r.b].filter(function (a) { return a >= 0; });
      if (r.par.length && r.par.every(function (j) { return moved.has(j); }) && ends.every(function (a) { return set.has(a); })) { piece.ropes.push({ pts: r.pts, col: r.col, bb: r.bb }); r.dead = true; }
      else if (r.par.some(function (j) { return moved.has(j); }) || ends.some(function (a) { return set.has(a); })) r.dead = true;
    });
    sh.sails.forEach(function (s) { if (!s.dead && set.has(s.a)) { s.dead = true; piece.sails.push({ verts: s.verts, tris: s.tris, col: s.col, a: s.a }); } });
    sh.rigDirty = true;
    PIECES.push(piece);
    if (n > 3000) { sfx('creak', c0, 1.4); note(sh, (c0[1] - pivot[1] > 8 ? '桅杆斷了！' : '一大塊船體脫落')); }
  }
  function stepPiece(pc, dt) {
    pc.t += dt;
    var g = [0, -G, 0];
    if (pc.hinge) {                                               // 繞斷口倒：細棒繞端點 α ＝ (r × g)·3／(4|r|²)
      var r = sub(pc.c, pc.pivot), r2 = dot(r, r), alpha = mul(cross(r, g), 3 / (4 * r2));
      pc.w = add(pc.w, mul(alpha, dt));
      var ang = len(pc.w) * dt;
      if (ang > 0) { var Rm = rotM(pc.w, ang); r = M4.dir(Rm, r[0], r[1], r[2]); pc.c = add(pc.pivot, r); pc.R = M4.mul(Rm, pc.R); }
      var tilt = Math.acos(clamp(r[1] / Math.sqrt(r2), -1, 1));
      if (tilt > 1.25 || pc.t > 6) { pc.hinge = false; pc.v = cross(pc.w, r); }
    } else {
      pc.v = add(pc.v, mul(g, dt));
      if (pc.c[1] < 0) {
        var float = pc.t < 40 ? -0.6 : -0.6 - (pc.t - 40) * 0.8;                     // 浮在水面 40 秒，之後慢慢沉
        pc.v[1] += ((float - pc.c[1]) * 3 - pc.v[1] * 2.5) * dt + G * dt;
        pc.v = mul(pc.v, 1 - 1.6 * dt); pc.w = mul(pc.w, 1 - 1.8 * dt);
        if (!pc.wet) { pc.wet = true; for (var k = 0; k < Math.min(6, 1 + pc.n / 8000); k++) splash(add(pc.c, [gauss() * 4, 0, gauss() * 4]), true); } }
      pc.c = add(pc.c, mul(pc.v, dt));
      var a2 = len(pc.w) * dt; if (a2 > 0) pc.R = M4.mul(rotM(pc.w, a2), pc.R);
    }
    pc.M = M4.mul(M4.mul(M4.mul(trans(pc.c[0], pc.c[1], pc.c[2]), pc.R), trans(-pc.c0[0], -pc.c0[1], -pc.c0[2])), pc.M0);
    return pc.c[1] > -40 && pc.t < 120;
  }

  // ───────────────────────── 進水、傾斜、沉沒 ─────────────────────────
  function stepShip(sh, dt) {
    // 進水：水線下每個破洞的流量 ∝ √(水深)（貼著水面的洞進得慢）；抽水機每秒抽掉一點 ⇒ 小洞撐得住
    var wz = Math.min(SZ - 1, Math.floor(ZW + (sh.sink - sh.bob) / S)), N = 0, Q = 0, Dsp = 0, Dbs = 0;
    for (var z = 0; z <= wz; z++) { var c = sh.flood[z * 3]; if (!c) continue; N += c; Q += c * Math.sqrt((wz - z) * S + 0.05); Dsp += sh.flood[z * 3 + 1]; Dbs += sh.flood[z * 3 + 2]; }
    sh.inflow = N;
    if (!sh.sunk) {
      sh.sink = Math.max(0, sh.sink + (Q * 1.1e-5 - 0.004) * dt);
      if (sh.sink > 4.2 && !sh.sinkingFinal) { sh.sinkingFinal = true; note(sh, '進水太多，開始沉了'); }
      if (sh.sinkingFinal) { sh.sinkV += 0.06 * dt; sh.sink += sh.sinkV * dt; }
      if (sh.sink > 9) { sh.sunk = true; note(sh, '沉沒'); }
    } else { sh.sinkV = Math.min(sh.sinkV + 0.05 * dt, 1.2); sh.sink += sh.sinkV * dt; }
    // 傾斜：破洞那一舷往下（右舷 ＝ 格座標 +y ＝ 船體 −Z；繞 +X 轉負角時 −Z 那邊下沉）
    var rollT = -clamp(Dsp / (N + 900), -1, 1) * (sh.sinkingFinal ? 0.55 : 0.21);
    var pitchT = -clamp(Dbs / (N + 1500), -1, 1) * 0.07;
    sh.rollV += ((rollT - sh.rollA) * 0.9 - sh.rollV * 0.8) * dt;
    sh.rollA += sh.rollV * dt;
    sh.rollW = Math.sin(SIMT * 0.53 + sh.phase) * 0.012;
    sh.pitchA += (pitchT - sh.pitchA) * 0.3 * dt;
    sh.bob = Math.sin(SIMT * 0.7 + sh.phase) * 0.18;
    sh.M = M4.mul(shipMatrix(sh), M4.ident()); sh.inv = M4.inv(sh.M);
    sh.center = shipCenter(sh); sh.rad2 = 62 * 62;
    for (var i = 0; i < sh.guns.length; i++) if (sh.guns[i].reload > 0) sh.guns[i].reload -= dt;
  }
  function survey(sh) {               // 每半秒量一次：砲還在不在、桅還在不在、繩與帆的錨還在不在
    var alive = 0;
    sh.guns.forEach(function (g) { var b = g.box; if (g.alive) g.alive = countBox(sh.grid, b[0], b[1], b[2], b[3], b[4], b[5]) >= g.orig * 0.55; if (g.alive) alive++; });
    sh.gunsAlive = alive;
    var up = 0;
    sh.masts.forEach(function (m) { if (m.up) { m.up = countBox(sh.grid, m.x - 8, CY - 8, m.z0, m.x + 8, CY + 8, m.z1) > m.orig * 0.3; if (!m.up) note(sh, m.name + '倒了'); } if (m.up) up++; });
    sh.mastsUp = up;
    sh.ropes.forEach(function (r) { if (r.dead) return; if ((r.a >= 0 && !gp(sh.grid, r.a)) || (r.b >= 0 && !gp(sh.grid, r.b))) { r.dead = true; sh.rigDirty = true; } });
    sh.ropes.forEach(function (r) { if (!r.dead && r.par && r.par.some(function (j) { return sh.ropes[j].dead; })) { r.dead = true; sh.rigDirty = true; } });
    sh.sails.forEach(function (s) { if (!s.dead && s.a >= 0 && !gp(sh.grid, s.a)) dropSail(sh, s); });
    if (!sh.struck && alive === 0) { sh.struck = true; note(sh, '舷側的砲全毀，降旗'); }
  }
  function gp(g, p) { return g.get(p & 1023, (p >> 10) & 1023, p >> 20); }

  // ───────────────────────── 電腦 ─────────────────────────
  function ai(sh, dt) {
    if (sh.sunk || sh.struck || sh.sinkingFinal) return;
    sh.aiWait -= dt; if (sh.aiWait > 0) return;
    var ready = 0, alive = 0;
    sh.guns.forEach(function (g) { if (g.alive) { alive++; if (g.reload <= 0) ready++; } });
    if (!ready || ready < Math.ceil(alive * 0.65)) return;
    var foe = SHIPS[1 - sh.i], r = rnd(), ammo = 0, t;
    var masts = foe.masts.filter(function (m) { return m.up; });
    if (r < 0.45 || !masts.length) t = [rr(HULL_X0 + 80, HULL_X1 - 120), CY, rr(56, 76)];
    else if (r < 0.72) { t = [rr(HULL_X0 + 120, HULL_X1 - 160), CY, rr(84, 104)]; ammo = rnd() < 0.25 ? 1 : 0; }
    else { var m = masts[(rnd() * masts.length) | 0]; t = [m.x, CY, rr(150, 300)]; ammo = rnd() < 0.6 ? 2 : 0; }
    var err = Math.max(0.6, 4.5 - sh.salvo * 0.55) / S;
    sh.aim = [t[0] + gauss() * err * 1.6, t[1], t[2] + gauss() * err * 0.5];
    sh.aiSpread = 0.006;
    broadside(sh, ammo);
    sh.aiWait = rr(1.0, 3.5);
  }

  // ───────────────────────── 一步 ─────────────────────────
  function step() {
    SIMT += DT;
    for (var i = 0; i < EVENTS.length; i++) {
      var e = EVENTS[i]; if (e.t > SIMT) continue;
      EVENTS.splice(i--, 1);
      var sh = SHIPS[e.sh]; if (!sh.sunk) fireGun(sh, e.g, e.tgt, e.ammo);
    }
    SHIPS.forEach(function (sh) { stepShip(sh, DT); });
    if (MODE === 'eve') { ai(SHIPS[0], DT); ai(SHIPS[1], DT); }
    else if (MODE === 'pve') ai(SHIPS[1], DT);
    for (i = 0; i < BALLS.length; i++) { stepBall(BALLS[i], DT); if (!BALLS[i].alive) { if (CAM.follow === BALLS[i]) { CAM.hold = 1.2; } BALLS.splice(i--, 1); } }
    SHIPS.forEach(function (sh) { integrity(sh); sh.impulse = [0, 0, 0]; });
    for (i = 0; i < PIECES.length; i++) if (!stepPiece(PIECES[i], DT)) { PIECES[i].rs.dispose(); PIECES.splice(i--, 1); }
    stepDebris(DT); stepPts(DT);
    if ((Math.round(SIMT / DT) % 30) === 0) { SHIPS.forEach(survey); checkEnd(); }
  }

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
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 32, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16); gl.bindVertexArray(null);
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
    // 帆與繩
    gl.disable(gl.CULL_FACE); gl.useProgram(P.tri.prog); setCommon(P.tri);
    var owners = SHIPS.concat(PIECES);
    owners.forEach(function (ow) {
      if (ow.rigDirty) buildRig(ow);
      if (ow.sink > 40) return;
      gl.uniformMatrix4fv(P.tri.u.uModel, false, ow.M);
      if (ow.tris && ow.tris.n) { gl.uniform1f(P.tri.u.uLit, 1); gl.bindVertexArray(ow.tris.vao); gl.drawArrays(gl.TRIANGLES, 0, ow.tris.n); }
      if (ow.lines && ow.lines.n) { gl.uniform1f(P.tri.u.uLit, 0); gl.vertexAttrib3f(1, 0, 1, 0); gl.bindVertexArray(ow.lines.vao); gl.drawArrays(gl.LINES, 0, ow.lines.n); }
    });
    // 海
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(P.water.prog); setCommon(P.water); gl.uniform1f(P.water.u.uT, SIMT); gl.bindVertexArray(WATERVAO); gl.drawArrays(gl.TRIANGLES, 0, 6);
    // 粒子＋砲彈＋瞄準點
    var m = 0;
    function pushPt(p, s, c, a) { if (m >= PMAX) return; var k = m * 8; PBUF[k] = p[0]; PBUF[k + 1] = p[1]; PBUF[k + 2] = p[2]; PBUF[k + 3] = s; PBUF[k + 4] = c[0]; PBUF[k + 5] = c[1]; PBUF[k + 6] = c[2]; PBUF[k + 7] = a; m++; }
    for (i = 0; i < PT.n; i++) { var f = PT.life[i] / PT.max[i], s = PT.s1[i] + (PT.s0[i] - PT.s1[i]) * f; pushPt([PT.p[i * 3], PT.p[i * 3 + 1], PT.p[i * 3 + 2]], s, [PT.c[i * 3], PT.c[i * 3 + 1], PT.c[i * 3 + 2]], PT.a[i] * Math.min(1, f * 3)); }
    BALLS.forEach(function (b) { pushPt(b.p, 0.32, [0.08, 0.08, 0.08], 1); });
    var me = SHIPS[PLAYER_I];
    if (me && me.aim && MODE !== 'eve' && !STILL) {
      var c = M4.pt(SHIPS[1 - PLAYER_I].M, me.aim[0], me.aim[1], me.aim[2]);
      for (i = 0; i < 16; i++) { var an = i / 16 * 6.2832 + SIMT; pushPt([c[0] + Math.cos(an) * 2.2, c[1] + Math.sin(an) * 2.2, c[2]], 0.5, [1, 0.85, 0.3], 0.9); }
    }
    if (m) {
      gl.depthMask(false); gl.useProgram(P.pt.prog); setCommon(P.pt); gl.uniform1f(P.pt.u.uPx, CAM.h / (2 * Math.tan(0.45)));
      gl.bindVertexArray(PTVAO); gl.bindBuffer(gl.ARRAY_BUFFER, PTBUF); gl.bufferSubData(gl.ARRAY_BUFFER, 0, PBUF, 0, m * 8); gl.drawArrays(gl.POINTS, 0, m); gl.depthMask(true);
    }
    gl.disable(gl.BLEND); gl.bindVertexArray(null);
  }

  // ───────────────────────── HUD ─────────────────────────
  var MSGT = 0;
  function note(sh, text) {
    if (DEMO >= 0 && !RUNNING) return;
    var who = MODE === 'eve' ? (sh.i === 0 ? '藍艦' : '紅艦') : (sh.i === PLAYER_I ? '我艦' : '敵艦');
    var el = $('msg'); el.innerHTML = '<span style="color:' + (sh.i === 0 ? 'var(--blue)' : 'var(--red)') + '">' + who + '</span>　' + text; el.style.opacity = 1; MSGT = 3;
  }
  function panel(sh, title) {
    var hull = sh.grid.count / sh.orig, fl = clamp(sh.sink / 9, 0, 1);
    var m = sh.masts.map(function (x) { return x.name + (x.up ? '✓' : '✗'); }).join(' ');
    return '<h3>' + title + '</h3>船體 ' + (hull * 100).toFixed(1) + '%（打掉 ' + sh.lost.toLocaleString() + ' 格）<div class="bar"><i style="width:' + (hull * 100).toFixed(1) + '%"></i></div>' +
      '進水 ' + (sh.sunk ? '沉沒' : (fl * 100).toFixed(0) + '%') + '（水線下破洞 ' + (sh.inflow || 0).toLocaleString() + ' 格）<div class="bar water"><i style="width:' + (fl * 100).toFixed(0) + '%"></i></div>' +
      '砲 ' + sh.gunsAlive + '/' + sh.guns.length + '　' + m + '<br>開火 ' + sh.fired + '　命中 ' + sh.hits;
  }
  var HUDN = 0;
  function hud(dt) {
    if (MSGT > 0) { MSGT -= dt; if (MSGT <= 0) $('msg').style.opacity = 0; }
    if (!SHIPS.length || (HUDN++ % 6)) return;
    var me = SHIPS[PLAYER_I], foe = SHIPS[1 - PLAYER_I];
    $('me').innerHTML = panel(me, MODE === 'eve' ? '藍艦 憲法號' : '我艦 憲法號（藍）');
    $('foe').innerHTML = panel(foe, MODE === 'eve' ? '紅艦 憲法號' : '敵艦 憲法號（紅）');
    var g = me.guns.map(function (x) { return !x.alive ? '✕' : x.reload > 0 ? '◌' : '●'; }).join('');
    $('guns').textContent = MODE === 'eve' ? '觀戰中　' + CAM_NAMES[CAM.mode] : '右舷砲 ' + g + '　' + CAM_NAMES[CAM.mode] + (PAUSED ? '　⏸ 暫停' : '');
    [].forEach.call(document.querySelectorAll('#ammo span'), function (s) { s.className = +s.dataset.a === AMMO_I ? 'on' : ''; });
    var t = DEBUG ? '格：' + SHIPS.map(function (s) { return s.grid.count; }).join('／') + '　四邊形：' + SHIPS.map(function (s) { return s.rs.quads(); }).join('／') + '　碎片 ' + D.n + '　粒子 ' + PT.n + '　脫落 ' + PIECES.length + '　' + FPS.toFixed(0) + ' fps' : '';
    $('tip').textContent = t;
  }
  function checkEnd() {
    if (OVER || MODE === 'sandbox' || DEMO >= 0) return;
    var me = SHIPS[PLAYER_I], foe = SHIPS[1 - PLAYER_I], txt = null;
    if (foe.sunk || foe.struck) txt = MODE === 'eve' ? (PLAYER_I === 0 ? '藍艦勝' : '紅艦勝') : '勝利！敵艦' + (foe.sunk ? '沉沒' : '降旗');
    else if (me.sunk || me.struck) txt = MODE === 'eve' ? '紅艦勝' : '敗北……我艦' + (me.sunk ? '沉沒' : '降旗');
    if (!txt) return;
    OVER = true;
    $('endT').textContent = txt;
    $('endS').innerHTML = '打掉的格數：我艦 ' + me.lost.toLocaleString() + '　敵艦 ' + foe.lost.toLocaleString() + '<br>開火／命中：' + me.fired + '／' + me.hits + '　經過 ' + SIMT.toFixed(0) + ' 秒';
    setTimeout(function () { $('end').className = 'on'; }, 2500);
  }

  // ───────────────────────── 開局 ─────────────────────────
  function reset() {
    rs = SEED;
    SHIPS.forEach(function (sh) { sh.rs.dispose(); });
    PIECES.forEach(function (pc) { pc.rs.dispose(); });
    SHIPS = []; PIECES = []; BALLS = []; EVENTS = []; D.n = 0; PT.n = 0; SIMT = 0; OVER = false; PAUSED = false; AMMO_I = 0;
    PLAYER_I = 0;
    SHIPS.push(makeShip(0, 'blue', 0, DIST / 2));
    SHIPS.push(makeShip(1, 'red', Math.PI, -DIST / 2));
    SHIPS.forEach(function (sh) { stepShip(sh, 0); survey(sh); });
    CAM.mode = 0; CAM.follow = null; CAM.dist = DIST * 1.05 + 40; CAM.tgt = [0, 8, 0]; CAM.yaw = 2.2; CAM.pitch = 0.22; CAM.snap = true;
    if (CAMQ === 'close') { CAM.dist = 85; CAM.tgt = [10, 9, -DIST / 2 + 12]; CAM.yaw = 1.95; CAM.pitch = 0.16; }
    if (CAMQ === 'blue') { CAM.dist = 88; CAM.tgt = [4, 12, DIST / 2 - 10]; CAM.yaw = -1.8; CAM.pitch = 0.15; }
    if (CAMQ === 'high') { CAM.dist = DIST + 120; CAM.yaw = 2.5; CAM.pitch = 0.62; }
  }

  function start() {
    initAudio(); if (AC && AC.state === 'suspended') AC.resume();
    $('cover').style.display = 'none'; $('end').className = '';
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // 不然空白鍵會再按一次「開戰」
    reset(); RUNNING = true;
    note(SHIPS[PLAYER_I], MODE === 'eve' ? '兩艘都交給電腦' : '點敵艦設瞄準點，空白鍵齊射');
  }

  // ───────────────────────── 輸入 ─────────────────────────
  var drag = null;
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  cv.addEventListener('pointerdown', function (e) { cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, b: e.button, moved: false }; });
  cv.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true; drag.x = e.clientX; drag.y = e.clientY;
    if (CAM.mode === 1) CAM.mode = 0;
    if (drag.b === 2) {
      var fw = norm([CAM.look[0] - CAM.eye[0], 0, CAM.look[2] - CAM.eye[2]]), rt = [-fw[2], 0, fw[0]], k = CAM.dist * 0.0018;
      CAM.tgt = add(CAM.tgt, add(mul(rt, -dx * k), mul(fw, dy * k))); if (CAM.mode > 1) CAM.mode = 0;
    } else { CAM.yaw += dx * 0.006; CAM.pitch = clamp(CAM.pitch + dy * 0.005, 0.02, 1.45); }
  });
  cv.addEventListener('pointerup', function (e) {
    if (drag && !drag.moved && drag.b === 0 && RUNNING && MODE !== 'eve') pick(e.clientX, e.clientY);
    drag = null;
  });
  cv.addEventListener('wheel', function (e) { e.preventDefault(); CAM.dist = clamp(CAM.dist * Math.pow(1.0015, e.deltaY), 12, 900); }, { passive: false });
  function pick(cx, cy) {
    var r = cv.getBoundingClientRect(), nx = (cx - r.left) / r.width * 2 - 1, ny = 1 - (cy - r.top) / r.height * 2;
    var a = M4.pt(CAM.inv, nx, ny, -1), bq = CAM.inv, w0 = bq[3] * nx + bq[7] * ny + bq[11] * -1 + bq[15], w1 = bq[3] * nx + bq[7] * ny + bq[11] + bq[15];
    var p0 = mul(M4.pt(CAM.inv, nx, ny, -1), 1 / w0), p1 = mul(M4.pt(CAM.inv, nx, ny, 1), 1 / w1), d = norm(sub(p1, p0));
    var foe = SHIPS[1 - PLAYER_I], oL = toLocal(foe, p0), dL = M4.dir(foe.inv, d[0], d[1], d[2]);
    var hit = VK.raycast(foe.grid, oL, dL, 3000);
    if (hit) { SHIPS[PLAYER_I].aim = [hit.x + 0.5, hit.y + 0.5, hit.z + 0.5]; sfx('crack', null, 0.08); }
  }
  window.addEventListener('keydown', function (e) {
    if (!RUNNING) return;
    var me = SHIPS[PLAYER_I], k = e.key.toLowerCase();
    if (k === ' ' || e.code === 'Space') { e.preventDefault(); if (MODE !== 'eve' && !PAUSED && !me.sunk) broadside(me, AMMO_I); }
    else if (k === 'f') { if (MODE !== 'eve' && !PAUSED) fireOne(me, AMMO_I); }
    else if (k === '1' || k === '2' || k === '3') AMMO_I = +k - 1;
    else if (k === 'c') { CAM.mode = (CAM.mode + 1) % 4; CAM.follow = null; if (CAM.mode === 2 || CAM.mode === 3) { CAM.dist = 75; } else if (CAM.mode === 0) CAM.dist = DIST + 40; }
    else if (k === 'p') PAUSED = !PAUSED;
    else if (k === 'm') { muted = !muted; }
    else if (k === 'h' || k === '?') $('help').classList.toggle('on');
    else if (k === 'r') { RUNNING = false; $('cover').style.display = ''; $('end').className = ''; }
  });
  [].forEach.call(document.querySelectorAll('#modes button'), function (b) { b.onclick = function () { MODE = b.dataset.m; [].forEach.call(document.querySelectorAll('#modes button'), function (x) { x.className = x === b ? 'on' : ''; }); }; });
  [].forEach.call(document.querySelectorAll('#dists button'), function (b) { b.onclick = function () { DIST = +b.dataset.d; [].forEach.call(document.querySelectorAll('#dists button'), function (x) { x.className = x === b ? 'on' : ''; }); }; });
  $('go').onclick = start;
  $('endC').onclick = function () { $('end').className = ''; };
  $('endR').onclick = function () { RUNNING = false; $('end').className = ''; $('cover').style.display = ''; };

  // ───────────────────────── 主迴圈 ─────────────────────────
  var last = 0, acc = 0, FPS = 60;
  function frame(ts) {
    var dt = last ? Math.min(0.1, (ts - last) / 1000) : DT; last = ts;
    FPS = FPS * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
    if (RUNNING && !PAUSED) {
      acc += dt; var n = 0;
      while (acc >= DT && n < 4) { step(); acc -= DT; n++; }
      if (n === 4) acc = 0;
    }
    if (CAM.hold > 0) { CAM.hold -= dt; if (CAM.hold <= 0) CAM.follow = null; }
    if (CAM.mode === 1 && !CAM.follow) { var bs = BALLS.filter(function (b) { return b.owner === PLAYER_I || MODE === 'eve'; }); if (bs.length) CAM.follow = bs[bs.length - 1]; }
    SHIPS.forEach(function (sh) { sh.rs.flush(); });
    camUpdate(dt); render(); hud(dt);
    requestAnimationFrame(frame);
  }

  // ───────────────────────── 載入 ─────────────────────────
  if (DEBUG) window.__game = {
    start: function (mode, dist) { MODE = mode || 'pve'; DIST = dist || DIST; start(); },
    run: function (sec) { var n = Math.round(sec / DT); for (var i = 0; i < n; i++) { step(); if (i % 30 === 29) SHIPS.forEach(function (sh) { sh.rs.flush(); }); } SHIPS.forEach(function (sh) { sh.rs.flush(); }); camUpdate(1); render(); hud(1); return this.stats(); },
    fire: function (ammo, aim) { var me = SHIPS[PLAYER_I]; if (aim) me.aim = aim; return broadside(me, ammo || 0); },
    one: function (ammo, aim) { var me = SHIPS[PLAYER_I]; if (aim) me.aim = aim; fireOne(me, ammo || 0); return BALLS.length; },
    ships: function () { return SHIPS; }, balls: function () { return BALLS; }, pieces: function () { return PIECES; },
    cam: function (o) { for (var k in o) CAM[k] = o[k]; CAM.snap = true; camUpdate(1); render(); },
    stats: function () { return { t: +SIMT.toFixed(2), ships: SHIPS.map(function (s) { return { lost: s.lost, count: s.grid.count, quads: s.rs.quads(), sink: +s.sink.toFixed(3), roll: +s.rollA.toFixed(3), inflow: s.inflow, guns: s.gunsAlive, masts: s.masts.map(function (m) { return m.name + (m.up ? '✓' : '✗'); }).join(' '), fired: s.fired, hits: s.hits, ropesDead: s.ropes.filter(function (r) { return r.dead; }).length, sailsDead: s.sails.filter(function (x) { return x.dead; }).length }; }), pieces: PIECES.map(function (p) { return p.n; }), debris: D.n, pts: PT.n, balls: BALLS.length, masts: MASTS }; }
  };
  var t0 = performance.now();
  function say(s) { $('load').textContent = s; }
  say('解碼船體…');
  VK.loadEmbedded('ship').then(function (model) {
    MODEL = model; var h = model.header;
    S = h.meters_per_voxel; SZ = h.size[2]; CX = (h.bbox[0] + h.bbox[3]) / 2; CY = h.size[1] / 2; HULL_X0 = h.bbox[0]; HULL_X1 = h.bbox[3];
    RIG = h.rig || { ropes: [], sails: [] };
    var t1 = performance.now();
    BASE = VK.Grid.fromModel(model);
    var chk = VK.verify(BASE, h);
    programs(); geometry();
    QIDX = new VK.QuadIndex(gl);
    PRISTINE = new VK.RegionSet(gl, BASE, QIDX); PRISTINE.buildAll();
    findMasts();
    var t2 = performance.now();
    var line = '1:1 船體 ' + chk.voxels.toLocaleString() + ' 格 checksum ' + chk.checksum.toString(16) + (chk.ok ? '（＝ 封裝檔 header，逐格相同 ✓）' : '（✗ 跟封裝檔對不上：' + h.voxels + '／' + h.checksum.toString(16) + '）') +
      '\n合併後 ' + PRISTINE.quads().toLocaleString() + ' 個四邊形、繩 ' + RIG.ropes.length + '、帆 ' + RIG.sails.length + '、桅 ' + MASTS.length +
      '\n解碼 ' + ((t1 - t0) / 1000).toFixed(2) + ' 秒、網格化 ' + ((t2 - t1) / 1000).toFixed(2) + ' 秒';
    say(line); window.__vxk = { verify: chk, quads: PRISTINE.quads(), masts: MASTS.length };
    if (!chk.ok) { fail('船體資料跟封裝檔對不上，停下來（不畫半艘船）。\n' + line); return; }
    $('go').disabled = false; $('go').textContent = '開戰';
    if (DEMO >= 0) {                                             // 快轉：電腦對電腦、固定步長
      MODE = 'eve'; reset(); RUNNING = true;
      var steps = Math.round(DEMO / DT);
      for (var i = 0; i < steps; i++) { step(); if (i % 30 === 29) SHIPS.forEach(function (sh) { sh.rs.flush(); }); }
      SHIPS.forEach(function (sh) { sh.rs.flush(); }); RUNNING = false; $('cover').style.display = 'none';
      window.__vxk.demo = { t: SIMT, lost: SHIPS.map(function (s) { return s.lost; }), pieces: PIECES.length, debris: D.n };
    } else {
      // 選單後面先擺好兩艘船當背景
      reset();
    }
    requestAnimationFrame(frame);
  }).catch(function (e) { fail('載入失敗：' + (e && e.message || e)); console.error(e); });
})();
