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
  camera: function () { return { mode: CAM.mode, track: CAM.track, yaw: CAM.yaw, dist: CAM.dist, tgt: CAM.tgt.slice(), eye: CAM.eye.slice() }; },
  strike: function (o) { for (var k in o) STRIKE[k] = o[k]; return { rules: STRIKE, text: strikeText() }; },
  /** 量降旗用：第 i 艘還能動的人照順序倒下，直到死傷比例到 frac（role 給了只倒那個職位）；下一次 survey 才判降旗。 */
  casualty: function (i, frac, role) {
    var sh = SHIPS[i], need = Math.ceil(sh.crew0 * frac) - (sh.crew0 - sh.crew.filter(able).length);
    sh.crew.forEach(function (c) { if (need > 0 && able(c) && (role === undefined || c.role === role)) { killCrew(sh, c, '量測'); need--; } });
    return sh.crew.filter(able).length;
  },
  cam: function (o) { for (var k in o) CAM[k] = o[k]; CAM.snap = true; camUpdate(1); render(); },
  phys: function (on) { if (on !== undefined) setPhys(!!on); return PHYS; },
  /** 量殉爆用：第 i 艘的第 k 間彈藥庫（0 後、1 前）。how：'keg' 點一桶（連鎖照血量走）、'mag' 整間直接殉爆。 */
  ignite: function (i, k, how) {
    var sh = SHIPS[i], mag = sh.mags[k]; if (!mag) return null;
    if (how === 'mag') magBoom(sh, mag); else { var m = mag.kegs.filter(function (x) { return x.alive; })[0]; if (m) ignite(sh, m, 0); }
    return this.powder(i);
  },
  powder: function (i) { var sh = SHIPS[i]; return { never: powderNever(), hp: POWDER_HP, blast: BLAST_K, broken: !!sh.broken, keel: sh.keel || null, fate: sh.fate,
    mags: sh.mags.map(function (g) { return { name: g.name, lb: g.lb, kegs: g.kegs.length, alive: g.kegs.filter(function (m) { return m.alive; }).length, boomed: g.boomed, gone: g.gone, R: g.R ? +(g.R * S).toFixed(2) : 0, removed: g.removed || 0, broke: !!g.broke }; }),
    pieces: PIECES.map(function (p) { return { n: p.n, hull: !!p.hull, mods: (p.mods || []).length, y: +p.c[1].toFixed(2) }; }),
    stations: sh.stations.map(function (st) { return { name: st.name, at: st.at, kegs: st.kegs.filter(function (m) { return m.alive; }).length }; }) }; },
  /** 補給的讀數：送藥手各自在做什麼、每門砲的藥箱。 */
  supply: function (i) { var sh = SHIPS[i]; var pm = sh.crew.filter(function (c) { return c.role === ROLE.POWDER; });
    return { monkeys: pm.length, able: pm.filter(able).length, states: pm.reduce(function (a, c) { var s = c.st ? 'down' : c.pm.st; a[s] = (a[s] || 0) + 1; return a; }, {}),
      boxes: sh.guns.map(function (g) { return g.alive ? g.box : '✕'; }).join(''), waiting: sh.guns.filter(function (g) { return g.alive && g.needCart && !(g.box > 0); }).length, noDrop: sh.guns.filter(function (g) { return !g.drop; }).length }; },
  prof: function (reset) { var r = { cloth: +PROF.cloth.toFixed(1), rope: +PROF.rope.toFixed(1), buf: +PROF.buf.toFixed(1), perStep: +PHYS_MS.toFixed(3) }; if (reset) PROF = { cloth: 0, rope: 0, buf: 0 }; return r; },
  /** 帆與繩的讀數：每面帆最鼓的那一點離雕刻作品形狀多遠（格）、還綁著幾個點、垂下來的繩幾條。 */
  cloth: function (i) {
    var sh = SHIPS[i || 0];
    return { templates: CLOTHT.map(function (T) { return { name: T.name, n: T.n, sim: T.sim.n, grid: T.grid, simEdges: T.sim.ea.length, simPins: Array.prototype.filter.call(T.sim.hk, function (x) { return x; }).length, pins: T.pins, clews: T.clews, sides: T.sides }; }),
      sails: sh.cl.map(function (c, k) {
        var d = 0, P0 = c.T.sim.p0; if (c.p) for (var j = 0; j < c.T.sim.n * 3; j += 3) d = Math.max(d, Math.hypot(c.p[j] - P0[j], c.p[j + 1] - P0[j + 1], c.p[j + 2] - P0[j + 2]));
        return { name: c.T.name, live: !!c.p && !c.hidden && !c.gone, loose: !!c.loose, torn: !!c.torn, pins: c.npin, maxMove: +d.toFixed(2) };
      }),
      loose: sh.loose.length, loosePinned: sh.loose.filter(function (o) { return o.pin[0] || o.pin[o.n - 1]; }).length, loosePts: sh.loose.reduce(function (a, o) { return a + o.n; }, 0) };
  },
  stats: function () { return { t: +SIMT.toFixed(2), ships: SHIPS.map(function (s) { return { lost: s.lost, count: s.grid.count, quads: s.rs.quads(), sink: +s.sink.toFixed(3), roll: +s.rollA.toFixed(3), inflow: s.inflow, guns: s.gunsAlive, masts: s.masts.map(function (m) { return m.name + (m.up ? '✓' : '✗'); }).join(' '), fired: s.fired, hits: s.hits, ropesDead: s.ropes.filter(function (r) { return r.dead; }).length, sailsDead: s.sails.filter(function (x) { return x.dead; }).length,
    crew: s.crew0, able: s.able, wounded: s.wounded, dead: s.dead, causes: s.causes, manned: s.gunsManned, struck: s.struck, fate: s.fate,
    knots: +(s.spd * 1.944).toFixed(2), yaw: +s.yaw.toFixed(3), x: +s.px.toFixed(1), z: +s.pz.toFixed(1), sail: +s.sailFrac.toFixed(3), point: s.pos,
    side: s.side, manual: s.manual, rudder: +s.rudder.toFixed(2), sailSet: SAILSETS[s.sailSet] }; }), over: OVER, end: OVER ? $('endT').textContent : '', pieces: PIECES.map(function (p) { return p.n; }), debris: D.n, pts: PT.n, balls: BALLS.length, masts: MASTS }; }
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
  programs(); geometry(); buildMeshes(); bbSetup(); waterline(); hullTex();
  QIDX = new VK.QuadIndex(gl);
  PRISTINE = new VK.RegionSet(gl, BASE, QIDX); PRISTINE.buildAll();
  findMasts(); clothSetup();
  var t2 = performance.now();
  var line = '1:1 船體 ' + chk.voxels.toLocaleString() + ' 格 checksum ' + chk.checksum.toString(16) + (chk.ok ? '（＝ 封裝檔 header，逐格相同 ✓）' : '（✗ 跟封裝檔對不上：' + h.voxels + '／' + h.checksum.toString(16) + '）') +
    '\n合併後 ' + PRISTINE.quads().toLocaleString() + ' 個四邊形、繩 ' + RIG.ropes.length + '、帆 ' + RIG.sails.length + '、桅 ' + MASTS.length +
    '\n解碼 ' + ((t1 - t0) / 1000).toFixed(2) + ' 秒、網格化 ' + ((t2 - t1) / 1000).toFixed(2) + ' 秒';
  say(line); window.__vxk = { verify: chk, quads: PRISTINE.quads(), masts: MASTS.length };
  loadArt().then(function (why) { line += '\n素材：' + why; say(line); window.__vxk.art = why; if (HUD_ART) hudArt(); });
  if (!chk.ok) { fail('船體資料跟封裝檔對不上，停下來（不畫半艘船）。\n' + line); return; }
  $('go').disabled = false; $('go').textContent = '開戰';
  if (DEMO >= 0) {                                             // 快轉：電腦對電腦、固定步長
    MODE = 'eve'; reset(); RUNNING = true;
    var steps = Math.round(DEMO / DT), phys = PHYS, from = Math.max(0, steps - 360);     // 帆與繩只畫最後那一格 ⇒ 物理只在最後 6 秒跑（不影響戰局）
    if (phys && from > 0) setPhys(false);
    for (var i = 0; i < steps; i++) { if (phys && i === from && from > 0) setPhys(true); step(); if (i % 30 === 29) SHIPS.forEach(function (sh) { sh.rs.flush(); }); }
    SHIPS.forEach(function (sh) { sh.rs.flush(); }); RUNNING = false; $('cover').style.display = 'none';
    window.__vxk.demo = { t: SIMT, lost: SHIPS.map(function (s) { return s.lost; }), pieces: PIECES.length, debris: D.n };
  } else {
    // 選單後面先擺好兩艘船當背景
    reset();
  }
  requestAnimationFrame(frame);
}).catch(function (e) { fail('載入失敗：' + (e && e.message || e)); console.error(e); });
