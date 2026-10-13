// ───────────────────────── 主迴圈 ─────────────────────────
var last = 0, acc = 0, FPS = 60, fpsT = 0;
function frame(ts, noRaf) {                                         // noRaf：__game.live 同步呼叫（不再排下一格，⛔ 排了 ⇒ 兩條畫面迴圈、模擬走兩倍快）
  var f0 = PF ? performance.now() : 0;                                // 逐幀分段計時（?debug=1）
  var dt = last ? Math.min(0.1, (ts - last) / 1000) : DT; last = ts;
  FPS = FPS * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
  if (RUNNING && !PAUSED) {
    var sk = slowTick(dt); SLOW_VIS = sk < 1;                         // 殉爆的慢動作（73_slowmo.js）：模擬一步照舊 DT，只是每格累積的時間 × 倍率
    acc += dt * sk; var n = 0;
    while (acc >= DT && n < 4) { step(); acc -= DT; n++; }
    if (n === 4) acc = 0;
    if (SLOW_VIS) { if (PF) PF.t = performance.now(); slowVisStep(dt * sk); if (PF) pfLap('slowvis'); }
    SLOW_VIS = false;                                                 // 快轉（__game.run）不經過這裡 ⇒ 照常在 step() 走
  }
  if (PF) PF.t = performance.now();
  camFollow(dt);                                                      // 追砲彈（03_camera.js）
  if (!PAUSED && !STILL) stepRain(dt);                                // 3D 雨滴（14_rain.js）：照畫面的時間走；停格、縮圖不動
  if (PF) pfLap('rain');
  remesh(RM_BUDGET);                                                  // 重網格化，每格有預算（60_render.js）
  if (PF) pfLap('flush');
  camUpdate(dt); render(); if (PF) pfLap('render'); hud(dt); frzShow(); slowShow();                        // 停格條（72_floodui.js）
  if (PF) { pfLap('hud'); pfEnd(f0, RUNNING && !PAUSED ? n : 0); }
  if (GFX_FPS && (fpsT -= dt) <= 0) { fpsT = 0.5; $('fps').textContent = 'FPS ' + Math.round(FPS) + '　畫質 ' + GFX_NAME[gfxLevel()] + '　' + CAM.w + '×' + CAM.h + (RT && RT.s ? '　MSAA ' + RT.s + '×' : ''); }   // 畫質設定頁的「顯示 FPS」
  if (!noRaf) requestAnimationFrame(frame);
}

// ───────────────────────── 載入 ─────────────────────────
if (DEBUG) window.__game = {
  start: function (mode, dist) { MODE = mode || 'pve'; DIST = dist || DIST; start(); },
  fleet: function (spec, mode) {   // 多船（TASK-0537）：spec ＝ [{ team: 'blue'|'red', hull: 'constitution'|… }]，第一艘是我艦；船型要先載好（loadHull）；null ⇒ 回到兩艘
    FLEET_DBG = spec; MODE = mode || 'eve'; start();
    return SHIPS.map(function (s) { return { i: s.i, team: s.team, hull: s.T.id, px: s.px, pz: s.pz, foe: s.foe ? s.foe.i : null }; });
  },
  loadHull: function (id) { return loadHull(id).then(function (T) { return T.id; }); },
  foes: function () { return SHIPS.map(function (s) { return { i: s.i, team: s.team, foe: s.foe ? s.foe.i : null, aimOn: s.aimOn ? s.aimOn.i : null, ff: s.ff || 0, ffOut: s.ffOut || 0, ffHold: s.ffHold || 0, avoid: s.avoidN || 0, salvo: s.salvo, salvo2: s.salvo2 || 0, hits: s.hits, sunk: s.sunk, struck: s.struck, x: +s.px.toFixed(1), z: +s.pz.toFixed(1) }; }); },
  mask: function (k) { MASK_OFF = k === undefined ? -1 : k; render(); return MASK_OFF; },   // 船艙遮罩（60_render.js）：關掉第 k 艘的、畫一格
  gpu: function () { render(); function ix(L) { return L.map(function (s) { return s.i; }); } return { max: MAX_SHIPS, shships: GFX.shships, masks: GFX.masks, shadow: ix(SSLOTS), global: ix(SSLOTS.rest), mask: ix(MSLOTS), noMask: ix(MSLOTS.rest), glob: SHM.glob, layers: SHM.layers, shadowN: SHM.n, offG: +SHM.offG.toFixed(3), hullLayers: HULLA.key, err: gl.getError() }; },   // GPU 的格（60_render.js gpuSlots）
  cut: function (o) { if (o) for (var k in o) CUTV[k] = o[k]; render(); return CUTV; },     // 剖面與隱藏甲板（74_cutaway.js）：{ half, deck }
  menuFleet: function (F) { if (F) { FLEET_SET = fleetTrim(F.map(function (L) { return L.slice(); })); fleetUI(); pickShip(); } return { set: FLEET_SET, spec: fleetSpec(), html: [$('fleet0').innerHTML.length, $('fleet1').innerHTML.length] }; },
  run: function (sec) { var n = Math.round(sec / DT); for (var i = 0; i < n; i++) { step(); if (i % 30 === 29) remesh(Infinity); } remesh(Infinity); camUpdate(1); render(); hud(1); PF.cur = {}; return this.stats(); },   // PF.cur：快轉的不算進下一格畫面
  fire: function (ammo, aim) { var me = SHIPS[PLAYER_I]; if (aim) setAim(me, aim); return broadside(me, ammo || 0); },
  one: function (ammo, aim) { var me = SHIPS[PLAYER_I]; if (aim) setAim(me, aim); fireOne(me, ammo || 0); return BALLS.length; },
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
  /** 天氣（08_weather.js）：給 id（clear／storm）就換；回傳現在的天氣。 */
  weather: function (id) { if (id) setWeather(id); return { id: WX_ID, wx: WX, wind: WIND.slice(), from: +bearing(-WIND[0], -WIND[2]).toFixed(1), spd: +WIND_SPD.toFixed(3), knots: +windKnots().toFixed(1) }; },
  /** 浪（08_sea.js）：(x, z) 的水面高度（t 不給 ＝ 現在）；sea() ＝ 浪的設定。 */
  sea: function (x, z, t) { return x === undefined ? { k: SEA_K, waves: WAVES } : seaH(x, z, t === undefined ? SIMT : t); },
  camFollow: function (dt) { camFollow(dt); return CAM.follow; },
  predict: function (b) { return ballPredict(b); },
  cam: function (o) { for (var k in o) CAM[k] = o[k]; CAM.snap = true; camUpdate(1); render(); },
  phys: function (on) { if (on !== undefined) setPhys(!!on); return PHYS; },
  /** 進水（33_flood.js，粒子模式）：第 i 艘的水量、破口、進出水、抽水、粒子、重心、該下沉多少；公式模式 ⇒ null。 */
  flood: function (i, o) {
    if (o && 'hide' in o) FL_HIDE = !!o.hide;
    if (o && o.gm > 0) FL_GM = o.gm;                                   // 調穩心高（量傾斜用）
    var sh = SHIPS[i || 0], fl = sh.fl; if (!fl) return null;
    var cells = 0; for (var t = 0; t < fl.actN; t++) if (fl.A[fl.act[t]] > 0) cells++;
    return { lv: FLOOD_LV, c: fl.F.c, grid: [fl.F.NX, fl.F.NY, fl.F.NZ], m3: +fl.vol.toFixed(3), t: +(fl.vol * RHO_W).toFixed(2), cells: cells, jets: fl.J.n, holes: fl.open, area: +fl.area.toFixed(3),
      inQ: +fl.inQ.toFixed(3), outQ: +fl.outQ.toFixed(3), inTot: +fl.inTot.toFixed(2), outTot: +fl.outTot.toFixed(2), pumped: +fl.pumped.toFixed(2), lost: +(fl.lost || 0).toFixed(3),
      comX: +fl.comX.toFixed(2), comY: +fl.comY.toFixed(2), sinkT: +fl.sinkT.toFixed(3), sink: +sh.sink.toFixed(3), roll: +sh.rollA.toFixed(4), pitch: +sh.pitchA.toFixed(4), dirty: fl.dirty.length + fl.hdirty.length };
  },
  /** 量進水用：第 i 艘在格 (x, z) 那一舷（side 0 ＝ 格 +y、1 ＝ −y）的船殼打一個半徑 r 格的洞（從最外那一格往艙內打穿）。回打掉幾格。 */
  hole: function (i, x, z, side, r) {
    var sh = SHIPS[i || 0], B = sh.T.base, y0 = -1, y, s = side ? 1 : -1, n = 0; r = r || 4;
    if (side) { for (y = 0; y < sh.T.cy; y++) if (B.get(x, y, z)) { y0 = y; break; } } else { for (y = B.sy - 1; y > sh.T.cy; y--) if (B.get(x, y, z)) { y0 = y; break; } }
    if (y0 < 0) return null;
    for (var dz = -r; dz <= r; dz++) for (var dx = -r; dx <= r; dx++) {
      if (dx * dx + dz * dz > r * r) continue;
      for (var t = 0; t < 16; t++) { var yy = y0 + s * t; if (t > 2 && !B.get(x + dx, yy, z + dz)) break; if (removeVoxel(sh, x + dx, yy, z + dz, false)) n++; }
    }
    sh.rs.flush(); return { removed: n, skin: y0 };
  },
  /** 船邊水花（13_water.js）：現在的檔、水滴與白沫各幾顆、開局以來生了幾顆。{ hide: true } ⇒ 照算、不畫（量繪製成本）。 */
  /** 逐幀分段計時（TASK-0531）：最慢的 top 格（預設 8）各段幾 ms、這一格走了幾步模擬；{ clear: true } ⇒ 清掉重記；{ sum: true } ⇒ 再附上全部格的各段總和與平均。 */
  /** 照真的畫面迴圈跑 sec 秒模擬（同步呼叫 frame()，dt ＝ 實際經過的時間 ⇒ 追趕迴圈補幾步跟真的玩一樣；預覽分頁在背景時 rAF 停也量得到）。finish ⇒ 每格 gl.finish()（把 GPU 的時間也算進去）。 */
  live: function (sec, finish) {
    var end = SIMT + sec, n = 0, t0 = performance.now(); last = 0;
    while (SIMT < end && n < sec * 400) { frame(performance.now(), true); if (finish) gl.finish(); n++; }
    return { frames: n, ms: Math.round(performance.now() - t0), simt: +SIMT.toFixed(2), fps: +(n / ((performance.now() - t0) / 1000)).toFixed(1) };
  },
  frames: function (o) {
    o = o || {}; if (o.clear) { PF.ring = []; PF.cur = {}; return 'cleared'; }
    var R = PF.ring, f2 = function (x) { return +x.toFixed(1); }, fmt = function (c) { var r = { simt: f2(c.simt), total: f2(c.total), steps: c.steps }; Object.keys(c).filter(function (k) { return ['simt', 'total', 'steps'].indexOf(k) < 0 && c[k] >= 0.5; }).sort(function (a, b) { return c[b] - c[a]; }).forEach(function (k) { r[k] = f2(c[k]); }); return r; };
    var top = R.slice().sort(function (a, b) { return b.total - a.total; }).slice(0, o.top || 8).map(fmt), out = { frames: R.length, top: top };
    if (o.sum) { var s = {}; R.forEach(function (c) { for (var k in c) if (k !== 'simt' && k !== 'steps') s[k] = (s[k] || 0) + c[k]; }); for (var k in s) s[k] = f2(s[k] / Math.max(1, R.length)); out.avg = s; }
    return out;
  },
  /** 殉爆的慢動作與特寫（73_slowmo.js）：給 { on, cam } 就改設定；回現在的倍率、狀態、殉爆幾次。 */
  slow: function (o) { if (o) { if ('on' in o) SLOW.on = !!o.on; if ('cam' in o) SLOW.cam = !!o.cam; gsetShow(); } return { on: SLOW.on, cam: SLOW.cam, active: SLOW.active, ts: +SLOW.ts.toFixed(3), min: SLOW.min, hold: SLOW.hold, t: +SLOW.t.toFixed(2), kicks: SLOW.kicks, camHeld: !!SLOW.camSave }; },
  /** 3D 雨滴（14_rain.js）：現在幾滴、上一格畫了幾條、水花幾個、開了以來落海與打到船幾次。{ bench: n } ⇒ 量 n 格（走一格＋填緩衝畫一次）各花幾 ms。 */
  rain: function (o) {
    var b = null; if (o && o.bench) { var t0 = performance.now(), i; for (i = 0; i < o.bench; i++) stepRain(1 / 60); var t1 = performance.now(); for (i = 0; i < o.bench; i++) rdDraw(); gl.finish(); b = { step: +((t1 - t0) / o.bench).toFixed(3), draw: +((performance.now() - t1) / o.bench).toFixed(3) }; }
    return { bench: b, lv: GFX.drops, n: RD.n, drawn: RD.drawn, splash: RS.n, hit: { sea: RD_STAT.hitSea, ship: RD_STAT.hitShip }, v: RD.v.map(function (x) { return +x.toFixed(2); }), top: +RD.top.toFixed(1) }; },
  water: function (o) { if (o && 'hide' in o) WP_HIDE = !!o.hide; return { lv: PHX.water, spray: WS.n, foam: WF.n, emitted: { spray: WP_STAT.spray, foam: WP_STAT.foam }, src: WP_STAT.src }; },
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
  captain: function () { return SHIPS.map(function (sh) { var foe = foeOf(sh), v = {}; AIM_MODES.forEach(function (m) { v[m] = +aimValue(foe, m).toFixed(2); }); return { cap: sh.cap, mode: sh.aimMode, switches: sh.modes || 0, pMode: sh.pMode, value: v }; }); },
  /** 手持物的讀數：上一格畫了幾件、每艘現在誰拿著什麼。 */
  items: function () { return { drawn: ITEMS_N, ships: SHIPS.map(function (sh) { var r = {}; sh.crew.forEach(function (c) { var it = heldItem(sh, c, crewFrame(sh, c)); if (it) r[it.id] = (r[it.id] || 0) + 1; }); return r; }) }; },
  powder: function (i) { var sh = SHIPS[i]; return { never: powderNever(), hp: powderHP(), blast: BLAST_K, broken: !!sh.broken, cartBooms: sh.cartN || 0, keel: sh.keel || null, fate: sh.fate,
    mags: sh.mags.map(function (g) { return { name: g.name, lb: g.lb, kegs: g.kegs.length, alive: g.kegs.filter(function (m) { return m.alive; }).length, boomed: g.boomed, gone: g.gone, R: g.R ? +(g.R * S).toFixed(2) : 0, removed: g.removed || 0, broke: !!g.broke }; }),
    pieces: PIECES.map(function (p) { return { n: p.n, hull: !!p.hull, mods: (p.mods || []).length, y: +p.c[1].toFixed(2) }; }),
    stations: sh.stations.map(function (st) { return { name: st.name, at: st.at, kegs: st.kegs.filter(function (m) { return m.alive; }).length }; }) }; },
  /** 預備水手的讀數（42_hands.js）：走得到的甲板（走路格幾點、分成幾片）、梯子（兩頭在哪一層、爬過幾次）、人在哪一層、在做什麼、派了幾次、補上幾個。 */
  hands: function (i) {
    var sh = SHIPS[i || 0], H = sh.nav; if (!H) return null;
    var hs = sh.crew.filter(function (c) { return c.role === ROLE.HAND; }), st = {}, on = {};
    hs.forEach(function (c) { var k = c.st ? 'down' : c.hand.climb ? 'climb' : c.hand.job ? 'job-' + c.hand.job.kind : c.hand.wp || c.hand.legs.length ? 'walk' : 'wait'; st[k] = (st[k] || 0) + 1; if (!c.st) { var n = H.levels[c.hand.lv].key; on[n] = (on[n] || 0) + 1; } });
    return { n: hs.length, states: st, on: on, called: H.called, joined: H.joined, ms: +H.ms.toFixed(1), home: H.levels[H.home].key, reach: H.reach.map(function (j) { return H.levels[j].key; }), gun0: H.gun0, pm0: H.pm0, helm0: H.helm0,
      levels: H.levels.map(function (L) { return { key: L.key, name: L.name, zr: L.zr, cells: L.N.cells.length, parts: L.N.parts }; }),
      ladders: H.ladders.map(function (L) { return { name: L.name, from: H.levels[L.lo].key, to: H.levels[L.hi].key, x: Math.round(L.x), used: L.n }; }) };
  },
  /** 落水求生的讀數（43_swim.js）：現在在水裡幾個（浮上來中／在游／在踩水／溺水沉下去中）、累計落水、救上來、溺水、被敵艦撈走／撈起敵艦的、名單上幾個人。 */
  swim: function (i) {
    var sh = SHIPS[i || 0], st = {};
    sh.crew.forEach(function (c) { if (c.st !== 5) return; var k = c.swim.dead ? 'sinking' : c.fv[1] > 0 ? 'rising' : c.fv[0] || c.fv[2] ? 'swimming' : 'treading'; st[k] = (st[k] || 0) + 1; });
    return { now: st, total: sh.swims || 0, saved: sh.saved || 0, drowned: sh.causes['溺水'] || 0, lostTo: sh.lostTo || 0, gained: sh.gained || 0, crew: sh.crew.length, drownT: DROWN_T };
  },
  /** 量落水用：第 i 艘最上面那層甲板上還能動的人，挑最靠舷邊的 n 個推下海（往舷外 3 m/s）。 */
  overboard: function (i, n) {
    var sh = SHIPS[i || 0], cy = sh.T.cy, out = sh.crew.filter(function (c) { return c.st === 0 && c.pos[2] >= sh.deckZ[sh.weatherDeck][0]; })
      .sort(function (a, b) { return Math.abs(b.pos[1] - cy) - Math.abs(a.pos[1] - cy); }).slice(0, n || 1);
    out.forEach(function (c) { var s = c.pos[1] >= cy ? 1 : -1; fall(sh, c, add(mul(norm(M4.dir(sh.M, 0, s, 0)), 3), [0, 2, 0])); });
    return out.length;
  },
  /** 補給的讀數：送藥手各自在做什麼、每門砲的藥箱。 */
  supply: function (i) { var sh = SHIPS[i]; var pm = sh.crew.filter(function (c) { return c.role === ROLE.POWDER; });
    return { monkeys: pm.length, able: pm.filter(able).length, states: pm.reduce(function (a, c) { var s = c.st ? 'down' : c.pm.st; a[s] = (a[s] || 0) + 1; return a; }, {}),
      boxes: sh.guns.map(function (g) { return g.alive ? g.box : '✕'; }).join(''), waiting: sh.guns.filter(function (g) { return g.alive && g.needCart && !(g.box > 0); }).length, noDrop: sh.guns.filter(function (g) { return !g.drop; }).length }; },
  prof: function (reset) { var r = { cloth: +PROF.cloth.toFixed(1), rope: +PROF.rope.toFixed(1), shred: +PROF.shred.toFixed(1), buf: +PROF.buf.toFixed(1), perStep: +PHYS_MS.toFixed(3) }; if (reset) PROF = { cloth: 0, rope: 0, shred: 0, buf: 0 }; return r; },
  /** 帆與繩的讀數：每面帆最鼓的那一點離雕刻作品形狀多遠（格）、還綁著幾個點、垂下來的繩幾條。 */
  cloth: function (i) {
    var sh = SHIPS[i || 0];
    return { templates: sh.T.cloth.map(function (T) { return { name: T.name, n: T.n, sim: T.sim.n, grid: T.grid, simEdges: T.sim.ea.length, simPins: Array.prototype.filter.call(T.sim.hk, function (x) { return x; }).length, pins: T.pins, clews: T.clews, sides: T.sides }; }),
      sails: sh.cl.map(function (c, k) {
        var d = 0, P0 = c.T.sim.p0; if (c.p) for (var j = 0; j < c.T.sim.n * 3; j += 3) d = Math.max(d, Math.hypot(c.p[j] - P0[j], c.p[j + 1] - P0[j + 1], c.p[j + 2] - P0[j + 2]));
        return { name: c.T.name, live: !!c.p && !c.hidden && !c.gone, loose: !!c.loose, torn: !!c.torn, pins: c.npin, maxMove: +d.toFixed(2) };
      }),
      loose: sh.loose.length, loosePinned: sh.loose.filter(function (o) { return o.pin[0] || o.pin[o.n - 1]; }).length, loosePts: sh.loose.reduce(function (a, o) { return a + o.n; }, 0),
      shreds: (sh.shreds || []).length, shredWet: (sh.shreds || []).filter(function (f) { return f.wet; }).length, shredPts: (sh.shreds || []).reduce(function (a, f) { return a + f.n; }, 0), shredCut: SH_STAT.cut, shredTris: SH_STAT.tris };   // 布片（34_shreds.js）：現在幾片、落水幾片、開局以來切了幾片
  },
  stats: function () { return { t: +SIMT.toFixed(2), ships: SHIPS.map(function (s) { return { lost: s.lost, count: s.grid.count, quads: s.rs.quads(), sink: +s.sink.toFixed(3), lift: +s.lift.toFixed(3), massLost: +massLost(s).toFixed(1), mass0: Math.round(s.mass0 || 0), roll: +s.rollA.toFixed(3), inflow: s.inflow, water: s.fl ? +(s.fl.vol * RHO_W).toFixed(1) : undefined, guns: s.gunsAlive, masts: s.masts.map(function (m) { return m.name + (m.up ? '✓' : '✗'); }).join(' '), fired: s.fired, hits: s.hits, ropesDead: s.ropes.filter(function (r) { return r.dead; }).length, sailsDead: s.sails.filter(function (x) { return x.dead; }).length,
    crew: s.crew0, able: s.able, wounded: s.wounded, dead: s.dead, causes: s.causes, manned: s.gunsManned, struck: s.struck, fate: s.fate,
    knots: +(s.spd * 1.944).toFixed(2), yaw: +s.yaw.toFixed(3), x: +s.px.toFixed(1), z: +s.pz.toFixed(1), sail: +s.sailFrac.toFixed(3), point: s.pos,
    side: s.side, manual: s.manual, rudder: +s.rudder.toFixed(2), sailSet: SAILSETS[s.sailSet] }; }), over: OVER, end: OVER ? $('endT').textContent : '', pieces: PIECES.map(function (p) { return p.n; }), debris: D.n, pts: PT.n, balls: BALLS.length, masts: SHIPS.length ? SHIPS[0].T.masts : [] }; }
};
/** 讀數的一段：這艘船是讀快取還是現場解析（06_cache.js）。 */
function cacheText(st) { return !st ? '' : st.hit ? '（讀快取 ' + (st.readMs / 1000).toFixed(2) + ' 秒）' : '（現場解析；' + st.why + '）'; }
if (DEBUG) {
  /** 快取對拍：船型 id 讀回的那幾份 ＝ 現在這份程式現場算的？逐位元組比（船體網格每個區塊、模型網格的頂點與佔用格、海面遮罩、浮力表、布模板）。 */
  window.__game.hullCheck = function (id) {
    var T = HULLT[id || myHull()]; if (!T) return null;
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
programs(); geometry(); wpGL(); flGL(); rdGL(); bbSetup(); QIDX = new VK.QuadIndex(gl);
hullSay = function (s) { var go = $('go'); if (go.disabled) go.textContent = '解析' + s; };   // 解析中：開戰鈕寫進度（設定照樣能調）
requestAnimationFrame(frame);                                       // 解析中也畫（天、海；船載好才有）
yieldUI().then(function () {                                        // 先讓主選單畫出來，再開始解析
  return Promise.all(fleetHulls().map(loadHull));                   // 只載編成裡的船（預設兩艘都是憲法號 ⇒ 一份）
}).then(function () {
  var T = HULLT[myHull()], h = T.h, chk = T.chk;
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
    // ?dump=1：每半秒記每艘的最大橫傾、開始沉／沉沒／降旗的時間，跑完寫進頁面（#dump；無頭 Chrome --dump-dom 讀，量進水模式用）
    var rec = Q.get('dump') === '1' ? SHIPS.map(function () { return { maxList: 0, maxPre: 0, maxSinkPre: 0, final: null, sunk: null, struck: null }; }) : null;
    for (var i = 0; i < steps; i++) {
      if (phys && i === from && from > 0) setPhys(true); step(); if (i % 30 === 29) remesh(Infinity);
      if (rec && i % 30 === 29) SHIPS.forEach(function (sh, k) { var r = rec[k]; r.maxList = Math.max(r.maxList, Math.abs(sh.rollA)); if (!sh.sinkingFinal) { r.maxPre = Math.max(r.maxPre, Math.abs(sh.rollA)); r.maxSinkPre = Math.max(r.maxSinkPre, sh.sink); r.maxPctPre = Math.max(r.maxPctPre || 0, floodPct(sh)); } if (sh.sinkingFinal && r.final === null) r.final = +SIMT.toFixed(1); if (sh.sunk && r.sunk === null) r.sunk = +SIMT.toFixed(1); if (sh.struck && r.struck === null) r.struck = +SIMT.toFixed(1); });
    }
    remesh(Infinity); RUNNING = false; $('cover').style.display = 'none';
    if (rec) { var pre = document.createElement('pre'); pre.id = 'dump'; document.body.appendChild(pre);
      pre.textContent = JSON.stringify({ seed: SEED, t: +SIMT.toFixed(1), flood: FLOOD_LV, ships: SHIPS.map(function (sh, k) { var r = rec[k];
        return { maxListDeg: +(r.maxList * 57.3).toFixed(1), maxPreDeg: +(r.maxPre * 57.3).toFixed(1), maxSinkPre: +r.maxSinkPre.toFixed(2), maxPctPre: Math.round((r.maxPctPre || 0) * 100), final: r.final, sunk: r.sunk, struck: r.struck, fate: sh.fate, lost: sh.lost, hits: sh.hits, dead: sh.dead, cart: sh.cartN || 0, magGone: sh.mags.filter(function (m) { return m.gone; }).length, mastsDown: sh.masts.filter(function (m) { return !m.up; }).length, sink: +sh.sink.toFixed(2), water: sh.fl ? Math.round(sh.fl.vol * RHO_W) : null, area: sh.fl ? +sh.fl.area.toFixed(1) : null, inflow: sh.inflow }; }) }); }
    window.__vxk.demo = { t: SIMT, lost: SHIPS.map(function (s) { return s.lost; }), pieces: PIECES.length, debris: D.n };
  } else {
    // 選單後面先擺好兩艘船當背景
    reset();
  }
}).catch(function (e) { fail('載入失敗：' + (e && e.message || e)); console.error(e); });
