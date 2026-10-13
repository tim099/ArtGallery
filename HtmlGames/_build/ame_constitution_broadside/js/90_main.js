// ───────────────────────── 主迴圈 ─────────────────────────
var last = 0, acc = 0, FPS = 60, fpsT = 0;
function frame(ts) {
  var dt = last ? Math.min(0.1, (ts - last) / 1000) : DT; last = ts;
  FPS = FPS * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
  if (RUNNING && !PAUSED) {
    acc += dt; var n = 0;
    while (acc >= DT && n < 4) { step(); acc -= DT; n++; }
    if (n === 4) acc = 0;
  }
  camFollow(dt);                                                      // 追砲彈（03_camera.js）
  SHIPS.forEach(function (sh) { sh.rs.flush(); });
  camUpdate(dt); render(); hud(dt);
  if (GFX_FPS && (fpsT -= dt) <= 0) { fpsT = 0.5; $('fps').textContent = 'FPS ' + Math.round(FPS) + '　畫質 ' + GFX_NAME[gfxLevel()] + '　' + CAM.w + '×' + CAM.h + (RT && RT.s ? '　MSAA ' + RT.s + '×' : ''); }   // 畫質設定頁的「顯示 FPS」
  requestAnimationFrame(frame);
}

// ───────────────────────── 載入 ─────────────────────────
if (DEBUG) window.__game = {
  start: function (mode, dist) { MODE = mode || 'pve'; DIST = dist || DIST; start(); },
  run: function (sec) { var n = Math.round(sec / DT); for (var i = 0; i < n; i++) { step(); if (i % 30 === 29) SHIPS.forEach(function (sh) { sh.rs.flush(); }); } SHIPS.forEach(function (sh) { sh.rs.flush(); }); camUpdate(1); render(); hud(1); return this.stats(); },
  fire: function (ammo, aim) { var me = SHIPS[PLAYER_I]; if (aim) me.aim = aim; return broadside(me, ammo || 0); },
  one: function (ammo, aim) { var me = SHIPS[PLAYER_I]; if (aim) me.aim = aim; fireOne(me, ammo || 0); return BALLS.length; },
  ships: function () { return SHIPS; }, balls: function () { return BALLS; }, pieces: function () { return PIECES; },
  camera: function () { return { mode: CAM.mode, follow: CAM.follow ? { age: +CAM.follow.age.toFixed(2), owner: CAM.follow.owner, alive: CAM.follow.alive } : null, pick: CAM.pick || null, track: CAM.track, yaw: CAM.yaw, dist: CAM.dist, tgt: CAM.tgt.slice(), eye: CAM.eye.slice() }; },
  strike: function (o) { for (var k in o) STRIKE[k] = o[k]; return { rules: STRIKE, text: strikeText() }; },
  /** 量降旗用：第 i 艘還能動的人照順序倒下，直到死傷比例到 frac（role 給了只倒那個職位）；下一次 survey 才判降旗。 */
  casualty: function (i, frac, role) {
    var sh = SHIPS[i], need = Math.ceil(sh.crew0 * frac) - (sh.crew0 - sh.crew.filter(able).length);
    sh.crew.forEach(function (c) { if (need > 0 && able(c) && (role === undefined || c.role === role)) { killCrew(sh, c, '量測'); need--; } });
    return sh.crew.filter(able).length;
  },
  /** 畫質（07_gfx.js）：給 level（low／mid／high）或 { shadow: 2, … } 就換；回傳現在的設定與管線的讀數。 */
  gfx: function (o) { if (typeof o === 'string') gfxSet(o); else if (o) for (var k in o) GFX[k] = o[k]; if (o && typeof gfxShow === 'function' && $('gfxB')) gfxShow(); return { level: gfxLevel(), gfx: JSON.parse(JSON.stringify(GFX)), w: CAM.w, h: CAM.h, msaa: RT ? RT.s : null, shadow: SHM ? SHM.n : null, refl: RT && RT.R ? [RT.R.w, RT.R.h] : null, sea: SEAG ? { lv: SEAG.lv, verts: SEAG.verts, tris: SEAG.n / 3 } : null }; },
  /** 浪（08_sea.js）：(x, z) 的水面高度（t 不給 ＝ 現在）；sea() ＝ 浪的設定。 */
  sea: function (x, z, t) { return x === undefined ? { k: SEA_K, waves: WAVES } : seaH(x, z, t === undefined ? SIMT : t); },
  camFollow: function (dt) { camFollow(dt); return CAM.follow; },
  predict: function (b) { return ballPredict(b); },
  cam: function (o) { for (var k in o) CAM[k] = o[k]; CAM.snap = true; camUpdate(1); render(); },
  phys: function (on) { if (on !== undefined) setPhys(!!on); return PHYS; },
  /** 物理效果（09_phx.js）：給 level（full／high／mid／low）或 { rig: 1, … } 就換；回傳現在的設定。 */
  phx: function (o) { if (typeof o === 'string') phxSet(o); else if (o) for (var k in o) PHX[k] = o[k]; if (o) { if ((PHX.rig > 0) !== PHYS) setPhys(PHX.rig > 0); if ($('phxB')) phxShow(); } return { level: phxLevel(), phx: JSON.parse(JSON.stringify(PHX)), phys: PHYS, rig: rigLv(), debris: DEB_KS[PHX.debris], fx: FX_KS[PHX.fx] }; },
  /** 帆桁追風的讀數：相對風吹去的方向、每根帆桁現在離正橫幾度（作品的角度＋追風轉的）。 */
  yards: function (i) { var sh = SHIPS[i || 0]; return { psi: sh.psi === undefined ? null : +(sh.psi * 57.3).toFixed(1), side: sh.braceSide || 0, ropes: sh.yRopes.length,
    yards: sh.yards.map(function (m) { return { name: m.name, kind: m.yk, deg: +((m.r0 + m.rot) * 57.3).toFixed(1), rot: +(m.rot * 57.3).toFixed(1), alive: m.alive }; }) }; },
  /** 量殉爆用：第 i 艘的第 k 間彈藥庫（0 後、1 前）。how：'keg' 點一桶（連鎖照血量走）、'mag' 整間直接殉爆。 */
  ignite: function (i, k, how) {
    var sh = SHIPS[i], mag = sh.mags[k]; if (!mag) return null;
    if (how === 'mag') magBoom(sh, mag); else { var m = mag.kegs.filter(function (x) { return x.alive; })[0]; if (m) ignite(sh, m, 0); }
    return this.powder(i);
  },
  /** 砲長的讀數：每艘的砲長、現在的模式、換過幾次、各模式的局勢分數。 */
  captain: function () { return SHIPS.map(function (sh) { var foe = SHIPS[1 - sh.i], v = {}; AIM_MODES.forEach(function (m) { v[m] = +aimValue(foe, m).toFixed(2); }); return { cap: sh.cap, mode: sh.aimMode, switches: sh.modes || 0, pMode: sh.pMode, value: v }; }); },
  /** 手持物的讀數：上一格畫了幾件、每艘現在誰拿著什麼。 */
  items: function () { return { drawn: ITEMS_N, ships: SHIPS.map(function (sh) { var r = {}; sh.crew.forEach(function (c) { var it = heldItem(sh, c, crewFrame(sh, c)); if (it) r[it.id] = (r[it.id] || 0) + 1; }); return r; }) }; },
  powder: function (i) { var sh = SHIPS[i]; return { never: powderNever(), hp: POWDER_HP, blast: BLAST_K, broken: !!sh.broken, cartBooms: sh.cartN || 0, keel: sh.keel || null, fate: sh.fate,
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
    return { templates: sh.T.cloth.map(function (T) { return { name: T.name, n: T.n, sim: T.sim.n, grid: T.grid, simEdges: T.sim.ea.length, simPins: Array.prototype.filter.call(T.sim.hk, function (x) { return x; }).length, pins: T.pins, clews: T.clews, sides: T.sides }; }),
      sails: sh.cl.map(function (c, k) {
        var d = 0, P0 = c.T.sim.p0; if (c.p) for (var j = 0; j < c.T.sim.n * 3; j += 3) d = Math.max(d, Math.hypot(c.p[j] - P0[j], c.p[j + 1] - P0[j + 1], c.p[j + 2] - P0[j + 2]));
        return { name: c.T.name, live: !!c.p && !c.hidden && !c.gone, loose: !!c.loose, torn: !!c.torn, pins: c.npin, maxMove: +d.toFixed(2) };
      }),
      loose: sh.loose.length, loosePinned: sh.loose.filter(function (o) { return o.pin[0] || o.pin[o.n - 1]; }).length, loosePts: sh.loose.reduce(function (a, o) { return a + o.n; }, 0) };
  },
  stats: function () { return { t: +SIMT.toFixed(2), ships: SHIPS.map(function (s) { return { lost: s.lost, count: s.grid.count, quads: s.rs.quads(), sink: +s.sink.toFixed(3), lift: +s.lift.toFixed(3), massLost: +massLost(s).toFixed(1), mass0: Math.round(s.mass0 || 0), roll: +s.rollA.toFixed(3), inflow: s.inflow, guns: s.gunsAlive, masts: s.masts.map(function (m) { return m.name + (m.up ? '✓' : '✗'); }).join(' '), fired: s.fired, hits: s.hits, ropesDead: s.ropes.filter(function (r) { return r.dead; }).length, sailsDead: s.sails.filter(function (x) { return x.dead; }).length,
    crew: s.crew0, able: s.able, wounded: s.wounded, dead: s.dead, causes: s.causes, manned: s.gunsManned, struck: s.struck, fate: s.fate,
    knots: +(s.spd * 1.944).toFixed(2), yaw: +s.yaw.toFixed(3), x: +s.px.toFixed(1), z: +s.pz.toFixed(1), sail: +s.sailFrac.toFixed(3), point: s.pos,
    side: s.side, manual: s.manual, rudder: +s.rudder.toFixed(2), sailSet: SAILSETS[s.sailSet] }; }), over: OVER, end: OVER ? $('endT').textContent : '', pieces: PIECES.map(function (p) { return p.n; }), debris: D.n, pts: PT.n, balls: BALLS.length, masts: SHIPS.length ? SHIPS[0].T.masts : [] }; }
};
/** 讀數的一段：這艘船是讀快取還是現場解析（06_cache.js）。 */
function cacheText(st) { return !st ? '' : st.hit ? '（讀快取 ' + (st.readMs / 1000).toFixed(2) + ' 秒）' : '（現場解析；' + st.why + '）'; }
if (DEBUG) {
  /** 快取對拍：船型 id 讀回的那幾份 ＝ 現在這份程式現場算的？逐位元組比（船體網格每個區塊、模型網格的頂點與佔用格、海面遮罩、浮力表、布模板）。 */
  window.__game.hullCheck = function (id) {
    var T = HULLT[id || SHIP_SET[0]]; if (!T) return null;
    function same(a, b) {
      if (a === b) return true;
      if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) { if (a.length !== b.length || a.constructor !== b.constructor) return false; for (var i = 0; i < a.length; i++) if (a[i] !== b[i] && !(a[i] !== a[i] && b[i] !== b[i])) return false; return true; }
      if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return a !== a && b !== b;
      var ka = Object.keys(a), kb = Object.keys(b); if (ka.length !== kb.length) return false;
      return ka.every(function (k) { return same(a[k], b[k]); });
    }
    var g = T.base, r = { id: T.id, cached: T.cached, chunks: 0, chunkDiff: 0, quads: T.pristine.quads() };
    for (var cz = 0; cz < g.nz; cz++) for (var cy = 0; cy < g.ny; cy++) for (var cx = 0; cx < g.nx; cx++) {
      var i = g.ci(cx, cy, cz); if (g.tab[i] === null) continue;
      var m = VK.meshChunk(g, cx, cy, cz), c = T.pristine.meshes.get(i); r.chunks++;
      if (!(m ? c && same(m, c) : !c)) r.chunkDiff++;
    }
    r.hullMask = same(hullMask(T), T.hullHB);
    var H = { base: g, zw: T.zw }; hydrostatics(H); r.hyd = same(H.hyd, T.hyd) && H.disp === T.disp;
    r.models = (T.rig.meshes || []).map(function (m, k) {
      var tri = meshTris(m), got = new Float32Array(tri.length); gl.bindBuffer(gl.ARRAY_BUFFER, T.meshes[k].vbo); gl.getBufferSubData(gl.ARRAY_BUFFER, 0, got);
      return same(tri, got) && same(meshOcc(m), T.meshes[k].occ);
    }).filter(function (ok) { return !ok; }).length + ' 份不同／' + (T.rig.meshes || []).length;
    r.rbox = same(T.rig.ropes.map(function (rp) { return ropeBox(rp.pts); }), T.rbox);
    r.cloth = T.rig.sails.map(function (s, k) { return same(clothTemplate(T, s), T.cloth[k]); }).filter(function (ok) { return !ok; }).length + ' 面不同／' + T.rig.sails.length;
    return r;
  };
}
var t0 = performance.now();
function say(s) { $('load').textContent = s; }
say('解碼船體…');
programs(); geometry(); bbSetup(); QIDX = new VK.QuadIndex(gl);
hullSay = function (s) { var go = $('go'); if (go.disabled) go.textContent = '解析' + s; };   // 解析中：開戰鈕寫進度（設定照樣能調）
requestAnimationFrame(frame);                                       // 解析中也畫（天、海；船載好才有）
yieldUI().then(function () {                                        // 先讓主選單畫出來，再開始解析
  return Promise.all(SHIP_SET.filter(function (id, i, a) { return a.indexOf(id) === i; }).map(loadHull));   // 只載選到的船（預設兩艘都是憲法號 ⇒ 一份）
}).then(function () {
  var T = HULLT[SHIP_SET[0]], h = T.h, chk = T.chk;
  if (SLIDERS_SHOW) SLIDERS_SHOW();
  var line = '1:1 ' + T.name + ' ' + chk.voxels.toLocaleString() + ' 格 checksum ' + chk.checksum.toString(16) + (chk.ok ? '（＝ 封裝檔 header，逐格相同 ✓）' : '（✗ 跟封裝檔對不上：' + h.voxels + '／' + h.checksum.toString(16) + '）') +
    '\n合併後 ' + T.pristine.quads().toLocaleString() + ' 個四邊形、繩 ' + T.rig.ropes.length + '、帆 ' + T.rig.sails.length + '、桅 ' + T.masts.length +
    '\n解碼 ' + (T.decodeMs / 1000).toFixed(2) + ' 秒、網格化 ' + (T.meshMs / 1000).toFixed(2) + ' 秒' + cacheText(hullInfo(T.id).cache) +
    '\n設定：' + PREFS.state;
  say(line); window.__vxk = { verify: chk, quads: T.pristine.quads(), masts: T.masts.length, decodeMs: +T.decodeMs.toFixed(1), meshMs: +T.meshMs.toFixed(1), ms: T.ms,
    cache: hullInfo(T.id).cache, prefs: PREFS.state };
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
}).catch(function (e) { fail('載入失敗：' + (e && e.message || e)); console.error(e); });
