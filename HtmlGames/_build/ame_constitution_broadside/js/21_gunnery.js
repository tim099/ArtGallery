// ───────────────────────── 砲彈 ─────────────────────────
function fireGun(sh, g, target, ammo) {
  if (sh.struck || !g.alive || g.reload > 0 || gunRate(g) <= 0) return false;      // 砲要有人操作；降旗了就不開（排在齊射裡還沒開的也一樣）
  if (!bears(sh, g, target)) return false;                            // 目標不在這門砲的砲門射界 ⇒ 不開（呼叫端先用 gunTarget 挑好這門打得到的點）
  var mw = M4.pt(sh.M, g.muz[0], g.muz[1], g.muz[2]);
  var side = gunAxis(sh, g);
  var V = g.type === 'carr' ? 140 : g.type === 'chase' ? 165 : V0;                               // carronade：32 磅、短砲身 ⇒ 初速低、彈大
  var foe = SHIPS[1 - sh.i], rel = sub(foe.vel, sh.vel);           // 前置量：砲彈帶著本艦的船速 ⇒ 瞄對方「相對本艦」飛行時間後的位置
  target = add(target, mul(rel, Math.hypot(target[0] - mw[0], target[2] - mw[2]) / V));
  var dx = target[0] - mw[0], dz = target[2] - mw[2], dy = target[1] - mw[1], d = Math.hypot(dx, dz);
  var v2 = V * V, disc = v2 * v2 - G * (G * d * d + 2 * dy * v2);
  var el = disc < 0 ? 0.26 : Math.atan((v2 - Math.sqrt(disc)) / (G * d));
  var az = Math.atan2(dz, dx), saz = Math.atan2(side[2], side[0]), da = Math.atan2(Math.sin(az - saz), Math.cos(az - saz));
  da = clamp(da, -0.45, 0.45); az = saz + da;                      // 砲門只容得下 ±26°
  var spread = sh.i === PLAYER_I && !AUTOFIRE ? 0.0045 : sh.aiSpread || 0.008;
  if (!sh.crew.some(function (c) { return c.role === ROLE.OFFICER && able(c); })) spread *= 1.7;   // 軍官全倒 ⇒ 沒人指揮，瞄得散
  spread *= [0.7, 0.75, 0.85, 1][sh.sailSet];                       // 帆收得越多，船越穩
  el = clamp(el + gauss() * spread, -0.17, 0.26); az += gauss() * spread;
  var dir = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
  var b = { p: mw.slice(), v: add(mul(dir, V * rr(0.985, 1.015)), sh.vel), owner: sh.i, ammo: ammo, trav: 0, alive: true, age: 0, bounced: false, big: g.type === 'carr' };
  BALLS.push(b); g.reload = sh.reloadT * (g.type === 'carr' ? 0.7 : 1) * rr(0.9, 1.1); g.firedAt = SIMT; sh.fired++;
  flash(add(mw, mul(dir, 1)), dir, 14, false); smoke(add(mw, mul(dir, 1.5)), dir, 10, false);
  sh.rollV += g.side === 'P' ? -0.0012 : 0.0012;                      // 後座：船往反方向晃一下
  sfx('boom', mw, sh.i === PLAYER_I ? 1 : 0.8);
  if (CAM.mode === 1 && (sh.i === PLAYER_I || MODE === 'eve')) CAM.follow = b;
  return true;
}
/** 齊射：各砲平行開火 —— 瞄準點跟著那門砲在船上的前後位置平移，整排落在對方船身上（⛔ 不是 14 發擠進同一個洞）。 */
function broadside(sh, ammo) {
  if (sh.struck) return 0;
  var k = 0, mid = 0, n = 0;
  sh.guns.forEach(function (g) { mid += g.muz[0]; n++; }); mid /= n || 1;
  var tgt = aimPoint(sh);
  sh.guns.forEach(function (g) {
    if (!g.alive || g.reload > 0 || gunRate(g) <= 0 || !gunTarget(sh, g, tgt)) return;   // 兩舷都看：每一門自己判定，有機會打中敵艦的才排進齊射
    var off = (g.muz[0] - mid) * S * (ammo === 2 ? 0.15 : 1);      // 鏈彈是對著桅杆打的 ⇒ 往瞄準點收攏
    EVENTS.push({ t: SIMT + k * 0.075 + rr(0, 0.03), sh: sh.i, g: g, ammo: ammo, off: off }); k++;   // 瞄準點在開火那一刻才算（兩艘都在動）
  });
  if (k) { sh.salvo++; sh.salvoT = SIMT; }
  return k;
}
function fireOne(sh, ammo) {
  if (sh.struck) return;
  var tgt = aimPoint(sh), best = null, bd = 1e9;
  sh.guns.forEach(function (g) { if (!g.alive || g.reload > 0 || gunRate(g) <= 0 || !gunTarget(sh, g, tgt)) return; var w = M4.pt(sh.M, g.muz[0], g.muz[1], g.muz[2]), d = len(sub(w, tgt)); if (d < bd) { bd = d; best = g; } });
  if (best) fireGun(sh, best, gunTarget(sh, best, tgt), ammo);
}
/** 這門砲的砲軸（世界、水平）：舷側砲 ＝ 那一舷的正橫；追擊砲 ＝ 它自己的砲管方向（格 (0.342, 0.940)：正橫偏船頭 20°）。 */
function gunAxis(sh, g) {
  var sg = g.side === 'P' ? -1 : 1, a = g.type === 'chase' ? M4.dir(sh.M, 0.342, 0.940 * sg, 0) : M4.dir(sh.M, 0, sg, 0);
  return norm([a[0], 0, a[2]]);
}
/** 這門砲對不對得到 w：從砲口量，跟它的砲軸夾角 < 0.45 rad（砲門 ±26°）。 */
function bears(sh, g, w) {
  var m = M4.pt(sh.M, g.muz[0], g.muz[1], g.muz[2]), ax = gunAxis(sh, g);
  var a = Math.atan2(w[2] - m[2], w[0] - m[0]) - Math.atan2(ax[2], ax[0]);
  return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.45;
}
/** 這門砲打哪裡（每一門自己判定）：對得到 w ⇒ w；對不到 ⇒ 敵艦船身上（水線上那一段的中線、跟 w 同高，取 13 點）
 *  這門砲射界內、離 w 最近的那一點；整艘都在射界外 ⇒ null。⇒ 瞄準點在射界外，只要還有機會打中敵艦就開。 */
function gunTarget(sh, g, w) {
  if (bears(sh, g, w)) return w;
  var foe = SHIPS[1 - sh.i]; if (!foe || !foe.M) return null;
  var z = clamp(toLocal(foe, w)[2], 40, 320), best = null, bd = 1e18;
  for (var k = 0; k <= 12; k++) {
    var p = M4.pt(foe.M, WL_X0 + 15 + (WL_X1 - WL_X0 - 30) * k / 12, CY, z);
    if (!bears(sh, g, p)) continue;
    var d = (p[0] - w[0]) * (p[0] - w[0]) + (p[2] - w[2]) * (p[2] - w[2]); if (d < bd) { bd = d; best = p; }
  }
  return best;
}
/** 有沒有哪一門（還在、有人操作的）砲有機會打中敵艦（瞄準 w；對不到 w 就看敵艦船身）；side 給了只看那一舷。 */
function anyBears(sh, w, side) { return sh.guns.some(function (g) { return g.alive && gunRate(g) > 0 && (!side || g.side === side) && !!gunTarget(sh, g, w); }); }
function shipAxis(sh) { var ax = M4.dir(sh.M, 1, 0, 0); return norm([ax[0], 0, ax[2]]); }
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
      var hm = hitModel(sh, L, b.ammo === 2 ? 10 : 1.5);
      if (hm) {                                                          // 打到模型：整個飛出去，砲彈被擋掉一大半
        if (sh.i !== b.owner && !b.hitOnce) { SHIPS[b.owner].hits++; b.hitOnce = true; }
        blowModel(sh, hm, b.v);
        if (b.ammo === 1) { explode(b.p.slice(), sh, 0); blastModels(sh, L, 22, b.p); b.alive = false; return; }
        b.v = mul(b.v, b.ammo === 2 ? 0.5 : 0.55);
        if (len(b.v) < 30) { ballToDebris(b); return; }
      }
      if (b.ammo === 2) cutRig(sh, L, 14, b);
      else if (b.ammo === 0 && (s & 3) === 0) cutRig(sh, L, 3, b);
      if ((s & 3) === 1 && sh.i !== b.owner) hurt(sh, L, 4, 0, null, '砲彈');      // 砲彈直接掠過
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
    r = shatter(sh, L, dirL, rr(10, 13) * Math.pow(HARDK, -0.3), mul(b.v, 0.05), 650, 0.85);
    explode(w, sh, r.n); blastModels(sh, L, 22, w); hurt(sh, L, 13, 30, null, '爆炸'); b.alive = false; return;
  }
  if (b.ammo === 2) {                                                   // 鏈彈：橫著的一片
    r = slab(sh, L, dirL, b);
    b.v = mul(b.v, Math.max(0, 1 - r.cost * 0.004 * HARDK));
    if (r.n) hurt(sh, L, 9, 16, dirL, '鏈彈');
    if (len(b.v) < 30) { ballToDebris(b); }
    if (r.n > 30) { sfx('crack', w, 0.9); smoke(w, [0, 0.2, 0], 3, false); }
    return;
  }
  var R = rr(3.4, 4.6) * (b.big ? 1.25 : 1) * Math.pow(HARDK, -0.25);
  r = shatter(sh, L, dirL, R, b.v, 260, 0.55);   // 實心彈：一口一口往裡鑽（carronade 的 32 磅彈洞大一點；越硬洞越小）
  if (r.n) hurt(sh, L, R * 1.1, R * 2.6, dirL, '碎木');                          // 碎木往前噴：船裡的人主要是被這個傷到的
  var nsp = sp - r.cost * 0.24 * HARDK;
  if (r.n > 0) { sfx('crack', w, 0.6 + Math.min(1, r.n / 200)); if (r.n > 40) smoke(w, mul(norm(b.v), -0.3), 2, false); }
  if (nsp < 28) { ballToDebris(b); return; }
  b.v = mul(b.v, nsp / sp);
}
/** 格座標 L 落在哪個還在的模型外框裡（外擴 m 格）。 */
function hitModel(sh, L, m) {
  for (var i = 0; i < sh.models.length; i++) {
    var o = sh.models[i], b = o.bb;
    if (o.alive && L[0] > b[0] - m && L[0] < b[3] + m && L[1] > b[1] - m && L[1] < b[4] + m && L[2] > b[2] - m && L[2] < b[5] + m) return o;
  }
  return null;
}
/** 模型整個飛出去：剛體（拋出、翻滾、落水）；綁在它身上的砲與繩一起失效。drop ＝ 腳下甲板沒了，只是掉下去。 */
function blowModel(sh, m, vel, drop) {
  if (!m.alive) return;
  m.alive = false;
  var M0 = M4.mul(sh.M, trans(m.origin[0], m.origin[1], m.origin[2])), c0 = M4.pt(sh.M, m.c[0], m.c[1], m.c[2]);
  var vd = norm(vel), sp = drop ? 0 : clamp(len(vel) * 0.07, 5, 16);
  FLY.push({ mesh: m.mesh, M0: M0, c0: c0, c: c0.slice(), R: M4.ident(), t: 0, wet: false,
    v: add(drop ? [0, -0.5, 0] : add(mul(vd, sp), [gauss() * 2, rr(4, 9), gauss() * 2]), sh.vel),
    w: drop ? [gauss() * 0.4, 0, gauss() * 0.4] : [gauss() * 4, gauss() * 4, gauss() * 4] });
  sh.guns.forEach(function (g) { if (g.model === m) g.alive = false; });
  sh.ropes.forEach(function (r) { if (!r.dead && r.mods && r.mods.indexOf(m.k) >= 0) { r.dead = true; sh.rigDirty = true; } });
  if (!drop) {
    hurt(sh, m.c, 7, 15, null, '砲被打飛');
    flash(c0, vd, 10, false);
    for (var i = 0; i < 14; i++) spawnPt(c0, add(mul(vd, rr(3, 12)), [gauss() * 4, rr(1, 6), gauss() * 4]), rr(0.2, 0.5), [1, 0.85, 0.5], 1, 0.25, 0.1, G, 0.5, 3);
    sfx('crack', c0, 1.3);
  }
  if (m.kind === 'wheel') note(sh, '舵輪被打飛了');
  else if (m.kind === 'carr' && !drop) note(sh, m.name + ' 被打飛');
}
/** 爆炸：r 格內的模型往外飛。 */
function blastModels(sh, L, r, w) {
  sh.models.forEach(function (m) {
    if (!m.alive) return;
    var d = len(sub(m.c, L)); if (d > r) return;
    var cw = M4.pt(sh.M, m.c[0], m.c[1], m.c[2]);
    blowModel(sh, m, mul(norm(sub(cw, w)), 200 * (1 - d / r) + 60));
  });
}
function stepFly(f, dt) {
  f.t += dt;
  f.v[1] -= G * dt;
  if (f.c[1] < 0) {
    if (!f.wet) { f.wet = true; splash(f.c, true); }
    f.v = mul(f.v, 1 - 2.5 * dt); f.v[1] = Math.max(f.v[1], -1.0); f.w = mul(f.w, 1 - 2 * dt);
  }
  f.c = add(f.c, mul(f.v, dt));
  var a = len(f.w) * dt; if (a > 0) f.R = M4.mul(rotM(f.w, a), f.R);
  f.M = M4.mul(M4.mul(M4.mul(trans(f.c[0], f.c[1], f.c[2]), f.R), trans(-f.c0[0], -f.c0[1], -f.c0[2])), f.M0);
  return f.t < 25 && f.c[1] > -25;
}
var MESHES = [];
function buildMeshes() {          // 每份網格一個 VAO：三角形展開、平面法線、材質色（P.tri 畫）
  (RIG.meshes || []).forEach(function (m) {
    var v = m.verts, T = [];
    for (var j = 0; j < m.tris.length; j += 3) {
      var a = m.tris[j] * 3, b = m.tris[j + 1] * 3, d = m.tris[j + 2] * 3, c = m.mats[m.tmat[j / 3]];
      var n = norm(cross([v[b] - v[a], v[b + 1] - v[a + 1], v[b + 2] - v[a + 2]], [v[d] - v[a], v[d + 1] - v[a + 1], v[d + 2] - v[a + 2]]));
      T.push(v[a], v[a + 1], v[a + 2], n[0], n[1], n[2], c[0], c[1], c[2], v[b], v[b + 1], v[b + 2], n[0], n[1], n[2], c[0], c[1], c[2],
             v[d], v[d + 1], v[d + 2], n[0], n[1], n[2], c[0], c[1], c[2]);
    }
    MESHES.push(upload(null, new Float32Array(T), 9, [[0, 3, 0], [1, 3, 3], [2, 3, 6]]));
  });
}
function ballToDebris(b) { spawnDebris(b.p, mul(b.v, 0.3), 36, 0.15, 20); b.alive = false; }
function slab(sh, L, dirL, b) {
  var side = norm(cross(dirL, [0, 0, 1])), cost = 0, n = 0, removed = [];
  for (var a = -13; a <= 13; a++) for (var h = -2; h <= 2; h++) for (var d = -2; d <= 2; d++) {
    if (Math.abs(a) > (10.5 + 2.5 * hash3(a, h, d + (L[2] | 0))) * Math.pow(HARDK / 2, -0.25)) continue;   // 越硬撕開的那一片越窄
    var x = Math.floor(L[0] + side[0] * a + dirL[0] * d), y = Math.floor(L[1] + side[1] * a + dirL[1] * d), z = Math.floor(L[2] + h);
    var c = removeVoxel(sh, x, y, z, true); if (c) { cost += (HARD[c] || 1) * 2.4; n++; removed.push(x, y, z, c); }
  }
  for (var j = 0; j < removed.length; j += 4) if (rnd() < 0.5) {
    var w = M4.pt(sh.M, removed[j] + 0.5, removed[j + 1] + 0.5, removed[j + 2] + 0.5);
    spawnDebris(w, add(add(mul(norm(b.v), rr(4, 20)), [gauss() * 3, rr(0, 4), gauss() * 3]), sh.vel), removed[j + 3], rr(0.05, 0.11), rr(6, 12));
  }
  sh.impulse = add(sh.impulse, mul(norm(b.v), n * 2));
  return { cost: cost, n: n };
}
function explode(w, sh, n) {
  flash(w, [0, 1, 0], 50, true);
  for (var i = 0; i < 26; i++) spawnPt(w, [gauss() * 7, rr(1, 9), gauss() * 7], rr(0.3, 0.8), [1, rr(0.45, 0.7), 0.15], 0.9, rr(1.5, 3), rr(3, 5), 0, 2.5, 3);
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
      if (segDist2(L, p[j], p[j + 1], p[j + 2], p[j + 3], p[j + 4], p[j + 5]) < r2) { rp.dead = true; rp.cutL = [L[0], L[1], L[2]]; changed = true; break; }   // cutL：垂下來的繩從這裡分成兩段
    }
  });
  if (b.ammo === 2) sh.sails.forEach(function (s) {
    if (s.dead || s.furled) return;
    var v = s.verts;
    for (var j = 0; j < v.length; j += 9) { var dx = v[j] - L[0], dy = v[j + 1] - L[1], dz = v[j + 2] - L[2]; if (dx * dx + dy * dy + dz * dz < 64) { tearCloth(sh, s, L); dropSail(sh, s, true); changed = true; break; } }
  });
  if (changed) sh.rigDirty = true;
}
function segDist2(p, ax, ay, az, bx, by, bz) {
  var vx = bx - ax, vy = by - ay, vz = bz - az, wx = p[0] - ax, wy = p[1] - ay, wz = p[2] - az, l2 = vx * vx + vy * vy + vz * vz;
  var t = l2 > 0 ? clamp((wx * vx + wy * vy + wz * vz) / l2, 0, 1) : 0, dx = wx - vx * t, dy = wy - vy * t, dz = wz - vz * t;
  return dx * dx + dy * dy + dz * dz;
}
/** 帆掉了：變成十來片大塊的平面布片（點精靈，不是 3D 碎屑 —— 不撞甲板、不轉四元數），飄著往下掉、碰水就沒。
 *  物理開著 ⇒ 布留著，掛在還綁著的地方擺（全鬆了就往下掉）；只有被鏈彈撕開（torn）才另外撒布片。
 *  ⛔ 亂數照抽、只是不撒 ⇒ 開或關物理，後面的亂數序列一樣（戰局不變）。 */
function dropSail(owner, s, torn) {
  s.dead = true; owner.rigDirty = true; sailLinesDie(owner, s);
  if (s.furled) return;                                              // 收在帆桁上的：跟著掉，沒有布片
  var cl = PHYS && owner.cl ? owner.cl[s.k] : null;
  if (cl && (!cl.p || cl.gone)) cl = null;
  if (cl) { cl.loose = true; clothPins(owner, s, cl); }
  var M = owner.M, v = s.verts, nv = v.length / 3, n = clamp(Math.round(nv / 90), 6, 16), c = s.col || [0.95, 0.92, 0.85];
  for (var k = 0; k < n; k++) {
    var j = ((rnd() * nv) | 0) * 3, w = M4.pt(M, v[j], v[j + 1], v[j + 2]), sz = rr(1.6, 3), t = rr(0.85, 1);
    var vel = [gauss() * 1.5, rr(-0.5, 1.5), gauss() * 1.5], life = rr(5, 9);
    if (!cl || torn) spawnPt(w, vel, life, [c[0] * t, c[1] * t, c[2] * t], 1, sz, sz * 0.85, 3, 1.2, 4);   // 終端速度 ≈ 3／1.2 ＝ 2.5 m/s，跟著風飄
  }
}
function sailLinesDie(owner, s) { (s.lines || []).forEach(function (j) { owner.ropes[j].dead = true; }); owner.rigDirty = true; }

