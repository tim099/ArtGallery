// ───────────────────────── 砲彈 ─────────────────────────
// 連發（Tim 2026-10-14：風暴角號船頭的三管速射砲）：砲種表的 burst ＝ 一份彈藥打幾發（預設 1）、burstGap ＝ 每發隔幾秒。
//   第一發照常（開火的閘、扣藥箱、開始裝填）；剩下的 burst − 1 發由 burstStep 照間隔一發一發打（每發重新挑點、照樣散布；射界外那一發跳過）。
//   模型有 muzzle-a／b／c ⇒ 輪流從那幾根砲管出彈。burst ＝ 1 的砲一個亂數都不多抽 ⇒ 別的船戰局不變。
function fireGun(sh, g, target, ammo) {
  if (sh.struck || !g.alive || g.reload > 0 || gunRate(g) <= 0) return false;      // 砲要有人操作；降旗了就不開（排在齊射裡還沒開的也一樣）
  if (!bears(sh, g, target)) return false;                            // 目標不在這門砲的砲門射界 ⇒ 不開（呼叫端先用 gunTarget 挑好這門打得到的點）
  var GS = GUNS[g.type], r = fireShot(sh, g, target, ammo, g.muzs ? g.muzs[0] : g.muz);
  g.reload = sh.reloadT * GS.reload * rr(0.9, 1.1); g.firedAt = SIMT; sh.fired++;
  g.needCart = true;                                                // 下一發要從砲旁的藥箱拿一份火藥與彈藥（沒有 ⇒ 等送藥手，23_powder.js）
  shotFx(sh, g, r.mw, r.dir);
  if ((GS.burst || 1) > 1) { g.burstLeft = GS.burst - 1; g.burstK = 1; g.burstAmmo = ammo; g.burstT = SIMT + (GS.burstGap || 0.15); }   // 連發：同一份彈藥再打 burst − 1 發
  return true;
}
/** 連發剩下的那幾發（每一步、每艘；50_sim.js）：到時間就照現在的瞄準點再打一發；砲沒了、泡水、沒人、降旗 ⇒ 剩下的作廢。 */
function burstStep(sh) {
  for (var i = 0; i < sh.guns.length; i++) {
    var g = sh.guns[i]; if (!(g.burstLeft > 0) || SIMT < g.burstT) continue;
    if (sh.struck || sh.sunk || !g.alive || g.wet || gunRate(g) <= 0) { g.burstLeft = 0; continue; }
    var t = gunTarget(sh, g, aimPoint(sh));
    if (t && bears(sh, g, t)) { var r = fireShot(sh, g, t, g.burstAmmo, g.muzs ? g.muzs[g.burstK % g.muzs.length] : g.muz); sh.fired++; shotFx(sh, g, r.mw, r.dir); }
    g.burstK++; g.burstLeft--; g.burstT = SIMT + (GUNS[g.type].burstGap || 0.15);
  }
}
/** 一發砲彈：從 muz（格座標的砲口）照 target 算仰角、前置量、散布，放進 BALLS。回：{ mw 世界的砲口, dir 出膛方向 }。 */
function fireShot(sh, g, target, ammo, muz) {
  var mw = M4.pt(sh.M, muz[0], muz[1], muz[2]);
  var side = gunAxis(sh, g);
  var GS = GUNS[g.type], V = GS.V;                                    // 初速照砲種（carronade：32 磅、短砲身 ⇒ 初速低、彈大）
  var foe = aimShip(sh), rel = sub(foe.vel, sh.vel);              // 前置量：砲彈帶著本艦的船速 ⇒ 瞄對方「相對本艦」飛行時間後的位置（瞄的那艘，52_fleet.js）
  target = add(target, mul(rel, Math.hypot(target[0] - mw[0], target[2] - mw[2]) / V));
  var dx = target[0] - mw[0], dz = target[2] - mw[2], dy = target[1] - mw[1], d = Math.hypot(dx, dz);
  var v2 = V * V, disc = v2 * v2 - G * (G * d * d + 2 * dy * v2);
  var el = disc < 0 ? 0.26 : Math.atan((v2 - Math.sqrt(disc)) / (G * d));
  var az = Math.atan2(dz, dx), saz = Math.atan2(side[2], side[0]), da = Math.atan2(Math.sin(az - saz), Math.cos(az - saz));
  da = clamp(da, -0.45, 0.45); az = saz + da;                      // 砲門只容得下 ±26°
  var spread = handAim(sh) && !sh.autoNow ? 0.0045 : sh.aiSpread || 0.008;   // 玩家自己瞄的那幾發（含自動開砲時的手動那一舷）；sh.autoNow ＝ 這一發是電腦開的（50_sim.js 另一舷那一輪）
  if (!sh.crew.some(function (c) { return c.role === ROLE.OFFICER && able(c); })) spread *= 1.7;   // 軍官全倒 ⇒ 沒人指揮，瞄得散
  spread *= [0.7, 0.75, 0.85, 1][sh.sailSet];                       // 帆收得越多，船越穩
  spread *= wxSpread(sh);                                          // 天氣：暴風雨裡船晃得越快，點火那一下差得越多（晴天 ×1）
  el = clamp(el + gauss() * spread, -0.17, 0.26); az += gauss() * spread;
  var dir = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
  var b = { p: mw.slice(), v: add(mul(dir, V * rr(0.985, 1.015)), sh.vel), owner: sh.i, ammo: ammo, trav: 0, alive: true, age: 0, bounced: false, big: GS.big, hole: GS.hole, dmg: DMG[g.type] };   // dmg：每發傷害（砲種，細節設定）；hole：洞的倍率（4 磅彈小）
  windShot(sh, b, dx, dz); BALLS.push(b);
  return { mw: mw, dir: dir };
}
/** 開火的火光、煙、後座、聲音（連發每一發都有）。 */
function shotFx(sh, g, mw, dir) {
  flash(add(mw, mul(dir, 1)), dir, 14, false); smoke(add(mw, mul(dir, 1.5)), dir, 10, false);
  sh.rollV += g.side === 'P' ? 0.0012 : -0.0012;                      // 後座：船往反方向晃一下（開火那一舷抬起；roll 正 ＝ 右舷 S 那邊往下）
  sfx('boom', mw, sh.i === PLAYER_I ? 1 : 0.8);
  return true;
}
/** 齊射：各砲平行開火 —— 瞄準點跟著那門砲在船上的前後位置平移，整排落在對方船身上（⛔ 不是 14 發擠進同一個洞）。 */
function broadside(sh, ammo, careful) {                            // careful：電腦開的 ⇒ 隔著友船的那門不開（52_fleet.js；玩家自己按的照開）
  if (sh.struck) return 0;
  var k = 0, mid = 0, n = 0;
  sh.guns.forEach(function (g) { mid += g.muz[0]; n++; }); mid /= n || 1;
  var tgt = aimPoint(sh), FK = careful ? friendKeels(sh) : [];
  sh.guns.forEach(function (g) {
    if (!g.alive || g.reload > 0 || gunRate(g) <= 0 || !gunTarget(sh, g, tgt)) return;   // 兩舷都看：每一門自己判定，有機會打中敵艦的才排進齊射
    if (FK.length && friendInLine(FK, M4.pt(sh.M, g.muz[0], g.muz[1], g.muz[2]), tgt)) { sh.ffHold = (sh.ffHold || 0) + 1; return; }
    var off = (g.muz[0] - mid) * S * (ammo === 2 ? 0.15 : 1);      // 鏈彈是對著桅杆打的 ⇒ 往瞄準點收攏
    EVENTS.push({ t: SIMT + k * 0.075 + rr(0, 0.03), sh: sh.i, g: g, ammo: ammo, off: off }); k++;   // 瞄準點在開火那一刻才算（兩艘都在動）
  });
  if (k) { sh.salvo++; sh.salvoT = SIMT; }
  return k;
}
/** 玩家自己瞄（瞄準圈、空白鍵齊射照它）：沒開自動開砲；或開著但點了敵艦（sh.hand：那一舷手動、另一舷照樣自動；Tim 2026-10-14）。 */
function handAim(sh) { return sh.i === PLAYER_I && (!AUTOFIRE || !!sh.hand); }
/** 暫時把瞄準點換成 (aim, on) 跑 f（瞄準、前置量、gunTarget 都讀 sh.aim／aimShip）——另一舷的那一輪齊射用（50_sim.js aiSecond），跑完換回來。 */
function withAim(sh, aim, on, f) { var a = sh.aim, o = sh.aimOn; sh.aim = aim; sh.aimOn = on; try { return f(); } finally { sh.aim = a; sh.aimOn = o; } }
/** 另一舷的齊射（Tim 2026-10-13：兩側都有敵人時兩舷都開）：瞄 on 那艘的 aim（格座標），只排 guns 這幾門；瞄準點記在每一發上（e.on、e.aim），
 *  開火那一刻照它算 ⇒ 主要那一輪換了瞄準點也不會把這一輪拉過去。 */
function broadsideAt(sh, ammo, on, aim, guns) {
  if (sh.struck) return 0;
  var k = 0, mid = 0;
  guns.forEach(function (g) { mid += g.muz[0]; }); mid /= guns.length || 1;
  guns.forEach(function (g) {
    var off = (g.muz[0] - mid) * S * (ammo === 2 ? 0.15 : 1);
    EVENTS.push({ t: SIMT + k * 0.075 + rr(0, 0.03), sh: sh.i, g: g, ammo: ammo, off: off, on: on, aim: aim }); k++;
  });
  if (k) { sh.salvo++; sh.salvoT = SIMT; sh.salvo2 = (sh.salvo2 || 0) + 1; }
  return k;
}
function fireOne(sh, ammo) {
  if (sh.struck) return;
  var tgt = aimPoint(sh), best = null, bd = 1e9;
  sh.guns.forEach(function (g) { if (!g.alive || g.reload > 0 || gunRate(g) <= 0 || !gunTarget(sh, g, tgt)) return; var w = M4.pt(sh.M, g.muz[0], g.muz[1], g.muz[2]), d = len(sub(w, tgt)); if (d < bd) { bd = d; best = g; } });
  if (best) fireGun(sh, best, gunTarget(sh, best, tgt), ammo);
}
/** 這門砲的砲軸（世界、水平）：模型的固定點 muzzle − breech（舷側砲 ＝ 那一舷的正橫；追擊砲 ＝ 正橫偏船頭 20°）。 */
function gunAxis(sh, g) {
  var a = M4.dir(sh.M, g.ax[0], g.ax[1], 0);
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
  var foe = aimShip(sh); if (!foe || !foe.M) return null;
  var z = clamp(toLocal(foe, w)[2], foe.T.geo.aimZ[0], foe.T.geo.aimZ[1]), best = null, bd = 1e18;   // 高度範圍照敵艦的船型（05_hull.js GEO0）
  for (var k = 0; k <= 12; k++) {
    var p = M4.pt(foe.M, foe.T.wl0 + 15 + (foe.T.wl1 - foe.T.wl0 - 30) * k / 12, foe.T.cy, z);
    if (!bears(sh, g, p)) continue;
    var d = (p[0] - w[0]) * (p[0] - w[0]) + (p[2] - w[2]) * (p[2] - w[2]); if (d < bd) { bd = d; best = p; }
  }
  return best;
}
/** 有沒有哪一門（還在、有人操作的）砲有機會打中敵艦（瞄準 w；對不到 w 就看敵艦船身）；side 給了只看那一舷。 */
function anyBears(sh, w, side) { return sh.guns.some(function (g) { return g.alive && gunRate(g) > 0 && (!side || g.side === side) && !!gunTarget(sh, g, w); }); }
function shipAxis(sh) { var ax = M4.dir(sh.M, 1, 0, 0); return norm([ax[0], 0, ax[2]]); }
function aimPoint(sh) {
  var foe = foeOf(sh);
  if (handAim(sh) && !sh.autoNow && sh.pMode && sh.pMode !== 'free') { var t = modeAim(foe, sh.pMode, false).t; return M4.pt(foe.M, t[0], t[1], t[2]); }   // 我艦手動的瞄準模式：那個模式的中心點（51_captain.js）
  if (sh.aim) { var on = aimShip(sh); return M4.pt(on.M, sh.aim[0], sh.aim[1], sh.aim[2]); }   // 瞄準點是那艘的格座標
  return M4.pt(foe.M, foe.T.cx, foe.T.cy, foe.T.geo.aim);
}

/** 砲彈這一步（每 5 cm 一小段：450 m/s 的彈一步 150 段）。
 *  省時間（TASK-0531：開戰第一輪對砲幾十顆彈同時飛，每格 240–320 ms，掉到 15 FPS 以下；判定一個都不能變）：
 *    · 海面：比最高的浪（七道振幅和 1.14 m × 浪 × 天氣）還高就不可能落水 ⇒ 不算 seaH。
 *    · 繩、帆、人、模型：進了某艘船的外接球，先挑出「這一步飛得到的範圍」（這一點起算、這一步最多飛 sp × dt）裡的（ballNear），
 *      後面的小段只看這幾個（順序照原本的；模型照原本的桶、只是跳過沒挑到的）⇒ 判定與亂數順序跟全看一模一樣。量過：同一個種子戰局讀數逐字相同。
 *    量過（觀戰種子 1797，第一輪對砲最慢的一格）：繩 120–160 → 12–17 ms、人 40–46 → 1–2 ms（之後再加帆與模型）。 */
function stepBall(b, dt) {
  b.age += dt;
  var sp = len(b.v), steps = Math.max(1, Math.ceil(sp * dt / 0.05)), h = dt / steps, top = SEA_K > 0 ? 1.15 * SEA_K * WX.sea : 0, near = null;
  for (var s = 0; s < steps && b.alive; s++) {
    b.v[1] -= G * h;
    b.p[0] += b.v[0] * h; b.p[1] += b.v[1] * h; b.p[2] += b.v[2] * h; b.trav += len(b.v) * h;
    var sea = b.p[1] < top ? seaH(b.p[0], b.p[2], SIMT) : -1e9;         // 水面跟著浪（08_sea.js）；比最高的浪還高 ⇒ 不用算
    if (b.p[1] < sea) {
      var spd = len(b.v), ang = Math.asin(-b.v[1] / spd);
      if (b.ammo === 0 && !b.bounced && ang < 0.11 && spd > 90) {       // 打水漂：低角度的實心彈會跳一下
        b.v[1] = -b.v[1] * 0.45; b.v[0] *= 0.7; b.v[2] *= 0.7; b.p[1] = sea + 0.01; b.bounced = true; splash(b.p, false); continue;
      }
      splash(b.p, true); b.alive = false; return;
    }
    for (var i = 0; i < SHIPS.length; i++) {
      var sh = SHIPS[i];
      if (i === b.owner && b.trav < 6) continue;
      var cc = sh.center, dx = b.p[0] - cc[0], dy = b.p[1] - cc[1], dz = b.p[2] - cc[2];
      if (dx * dx + dy * dy + dz * dz > sh.rad2) continue;
      var L = M4.pt(sh.inv, b.p[0], b.p[1], b.p[2]), nb = (near || (near = []))[i] || (near[i] = ballNear(sh, L, sp * dt));
      var hm = hitModel(sh, L, b.ammo === 2 ? 10 : 1.5, b.hitM, nb.id);          // 同一顆砲彈對同一個模型只算一次（穿過外框要好幾個小步；⛔ 每步都扣 ⇒ 一發扣好幾次血）
      if (hm) {                                                          // 打到模型：扣血（每發傷害 × 彈種對砲倍率；歸零整個飛出去），砲彈被擋掉一大半
        if (sh.i !== b.owner && !b.hitOnce) { SHIPS[b.owner].hits++; ffHit(sh, b); windHit(b); b.hitOnce = true; }
        (b.hitM = b.hitM || []).push(hm);
        damageModel(sh, hm, b.v, b.dmg * ammoK(b.ammo, VS_GUN));
        if (b.ammo === 1) { explode(b.p.slice(), sh, 0); blastModels(sh, L, 22, b.p, b.hitM, b.dmg); hurt(sh, L, 13, 30, null, '爆炸', crewBase(b)); b.alive = false; return; }   // 直接打中的那一門已經扣過，不再吃爆風
        b.v = mul(b.v, b.ammo === 2 ? 0.5 : 0.55);
        if (len(b.v) < 30) { ballToDebris(b); return; }
      }
      if (b.ammo === 2) cutRig(sh, L, 14, b, nb.ropes, nb.sails);
      else if ((s & 3) === 0) cutRig(sh, L, 3, b, nb.ropes, nb.sails);             // 實心與爆裂：細繩照斷、穿過帆會打洞（帆扣得少，見彈種倍率）
      if ((s & 3) === 1 && sh.i !== b.owner) hurt(sh, L, 4, 0, null, '砲彈', crewBase(b) * 2, nb.crew);      // 砲彈直接掠過：兩倍
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
/** 讀數（TASK-0551）：順風打（砲線朝風吹去的方向 ⇒ 打的是自己的下風舷）／逆風打各開了幾發、中了幾發（sh.fireDn／fireUp、hitDn／hitUp）。 */
function windShot(sh, b, dx, dz) { b.dn = dx * WIND[0] + dz * WIND[2] > 0; if (b.dn) sh.fireDn = (sh.fireDn || 0) + 1; else sh.fireUp = (sh.fireUp || 0) + 1; }
function windHit(b) { var o = SHIPS[b.owner]; if (b.dn) o.hitDn = (o.hitDn || 0) + 1; else o.hitUp = (o.hitUp || 0) + 1; }
function impact(b, sh, L) {
  var dirL = norm(M4.dir(sh.inv, b.v[0], b.v[1], b.v[2])), sp = len(b.v), r, w = b.p.slice();
  if (sh.i !== b.owner) { SHIPS[b.owner].hits += (b.hitOnce ? 0 : 1); if (!b.hitOnce) { ffHit(sh, b); windHit(b); } } b.hitOnce = true;
  if (b.ammo === 1) {                                                   // 爆裂彈：第一下就炸
    r = shatter(sh, L, dirL, rr(10, 13) * Math.pow(sh.cfg.hard, -0.3), mul(b.v, 0.05), 650, 0.85);
    explode(w, sh, r.n); blastModels(sh, L, 22, w, null, b.dmg); hurt(sh, L, 13, 30, null, '爆炸', crewBase(b)); b.alive = false; return;
  }
  if (b.ammo === 2) {                                                   // 鏈彈：橫著的一片
    r = slab(sh, L, dirL, b);
    b.v = mul(b.v, Math.max(0, 1 - r.cost * 0.004 * sh.cfg.hard));
    if (r.n) hurt(sh, L, 9, 16, dirL, '鏈彈', crewBase(b));
    if (len(b.v) < 30) { ballToDebris(b); }
    if (r.n > 30) { sfx('crack', w, 0.9); smoke(w, [0, 0.2, 0], 3, false); }
    return;
  }
  var R = rr(3.4, 4.6) * (b.big ? 1.25 : b.hole || 1) * Math.pow(sh.cfg.hard, -0.25);
  r = shatter(sh, L, dirL, R, b.v, 260, 0.55);   // 實心彈：一口一口往裡鑽（carronade 的 32 磅彈洞大一點；越硬洞越小）
  if (r.n) hurt(sh, L, R * 1.1, R * 2.6, dirL, '碎木', crewBase(b));             // 碎木往前噴：船裡的人主要是被這個傷到的
  var nsp = sp - r.cost * 0.24 * sh.cfg.hard;
  if (r.n > 0) { sfx('crack', w, 0.6 + Math.min(1, r.n / 200)); if (r.n > 40) smoke(w, mul(norm(b.v), -0.3), 2, false); }
  if (nsp < 28) { ballToDebris(b); return; }
  b.v = mul(b.v, nsp / sp);
}
/** 格座標 L 落在哪個還在的模型外框裡（外擴 m 格）。 */
function hitModel(sh, L, m, skip, nb) {                                 // skip：這顆砲彈已經打過的（略過它、找後面那一個）；nb：只看蓋了這個戳記的（stepBall 的 ballNear；沒給 ⇒ 全看）
  var bk = L[0] >= 0 ? sh.mIdx[Math.floor(L[0] / 16)] : null; if (!bk) return null;   // 只看這一桶（modelIndex；登記時外擴 12 格 ≥ 鏈彈的 10）
  for (var i = 0; i < bk.length; i++) {
    if (nb && bk[i].nb !== nb) continue;
    var o = bk[i], b = o.bb, Q = o.rot ? unrotL(o, L) : L;                 // 轉過的帆桁：把彈點轉回作品裡的角度再比
    if (o.alive && !(skip && skip.indexOf(o) >= 0) && Q[0] > b[0] - m && Q[0] < b[3] + m && Q[1] > b[1] - m && Q[1] < b[4] + m && Q[2] > b[2] - m && Q[2] < b[5] + m &&
        (m > 2 || inMesh(o, Q))) return o;                               // 實心／爆裂彈：外框裡還要真的碰到砲身或砲架（鏈彈橫掃 2.4 m ⇒ 外框就算）
  }
  return null;
}
/** 繞帆桁的轉軸（鉛直）把格座標轉 a（弧度；+x 轉向 +y 為正，跟雕刻引擎同一個方向）。 */
function rotZ(P, piv, a) { var c = Math.cos(a), s = Math.sin(a), x = P[0] - piv[0], y = P[1] - piv[1]; return [piv[0] + x * c - y * s, piv[1] + x * s + y * c, P[2]]; }
function unrotL(o, L) { return rotZ(L, o.piv, -o.rot); }
/** 模型在船的格座標裡的擺法：平移到 origin；帆桁另外繞轉軸轉 rot。 */
function modelLocal(m) {
  if (m.sw) { var q = m.spv; return M4.mul(M4.mul(M4.mul(trans(q[0], q[1], q[2]), rotM(m.sax, m.sw)), trans(-q[0], -q[1], -q[2])), trans(m.origin[0], m.origin[1], m.origin[2])); }   // 掛著擺的（小艇；30_rig_physics.js swingHangs）
  if (!m.rot || !m.piv) return trans(m.origin[0], m.origin[1], m.origin[2]);
  var p = m.piv;
  return M4.mul(M4.mul(M4.mul(trans(p[0], p[1], p[2]), rotM([0, 0, 1], m.rot)), trans(-p[0], -p[1], -p[2])), trans(m.origin[0], m.origin[1], m.origin[2]));
}
/** 格座標 L 在不在這個模型的網格裡（佔用格，外擴一格 ≈ 砲彈半徑）。⛔ 只看外框：長砲的外框 1.3 × 3.1 m，空的角落也算 ⇒ 砲甲板一半的彈都打得到砲。 */
function inMesh(o, L) {
  var oc = o.T.meshes[o.mesh] && o.T.meshes[o.mesh].occ; if (!oc) return true;
  var x = Math.floor(L[0] - o.origin[0]) + 1, y = Math.floor(L[1] - o.origin[1]) + 1, z = Math.floor(L[2] - o.origin[2]) + 1;
  return x >= 0 && y >= 0 && z >= 0 && x < oc.nx && y < oc.ny && z < oc.nz && oc.a[x + oc.nx * (y + oc.ny * z)] === 1;
}
/** 網格 ⇒ 佔用格（每格 0.1 m，座標跟網格一樣相對模型的 origin、整體位移一格）：三角形每 0.4 格取一點，往法線反方向半格那一格算實心；再外擴一格。 */
function meshOcc(m) {
  var v = m.verts, mx = [0, 0, 0], j, a;
  for (j = 0; j < v.length; j += 3) for (a = 0; a < 3; a++) mx[a] = Math.max(mx[a], v[j + a]);
  var nx = Math.ceil(mx[0]) + 3, ny = Math.ceil(mx[1]) + 3, nz = Math.ceil(mx[2]) + 3, s = new Uint8Array(nx * ny * nz), o = new Uint8Array(nx * ny * nz);
  function mark(x, y, z) { x = Math.floor(x) + 1; y = Math.floor(y) + 1; z = Math.floor(z) + 1; if (x >= 0 && y >= 0 && z >= 0 && x < nx && y < ny && z < nz) s[x + nx * (y + ny * z)] = 1; }
  for (j = 0; j < m.tris.length; j += 3) {
    var A = m.tris[j] * 3, B = m.tris[j + 1] * 3, C = m.tris[j + 2] * 3;
    var e1 = [v[B] - v[A], v[B + 1] - v[A + 1], v[B + 2] - v[A + 2]], e2 = [v[C] - v[A], v[C + 1] - v[A + 1], v[C + 2] - v[A + 2]], n = norm(cross(e1, e2));
    var st = Math.max(1, Math.ceil(Math.max(len(e1), len(e2), len(sub(e1, e2))) / 0.4));
    for (var p = 0; p <= st; p++) for (var q = 0; q <= st - p; q++) {
      var u = p / st, w = q / st;
      mark(v[A] + e1[0] * u + e2[0] * w - n[0] * 0.5, v[A + 1] + e1[1] * u + e2[1] * w - n[1] * 0.5, v[A + 2] + e1[2] * u + e2[2] * w - n[2] * 0.5);
    }
  }
  for (var z = 0; z < nz; z++) for (var y = 0; y < ny; y++) for (var x = 0; x < nx; x++) {
    if (!s[x + nx * (y + ny * z)]) continue;
    for (var dz = -1; dz <= 1; dz++) for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      var X = x + dx, Y = y + dy, Z = z + dz; if (X >= 0 && Y >= 0 && Z >= 0 && X < nx && Y < ny && Z < nz) o[X + nx * (Y + ny * Z)] = 1;
    }
  }
  var cnt = 0; for (j = 0; j < o.length; j++) cnt += o[j];
  return { nx: nx, ny: ny, nz: nz, a: o, fill: cnt / o.length };
}
/** 模型整個飛出去：剛體（拋出、翻滾、落水）；綁在它身上的砲與繩一起失效。drop ＝ 腳下甲板沒了，只是掉下去。 */
function blowModel(sh, m, vel, drop) {
  if (!m.alive) return;
  m.alive = false;
  var M0 = M4.mul(sh.M, modelLocal(m)), c0 = M4.pt(sh.M, m.c[0], m.c[1], m.c[2]);
  var vd = norm(vel), sp = drop ? 0 : clamp(len(vel) * 0.07, 5, 16);
  FLY.push({ T: sh.T, mesh: m.mesh, M0: M0, c0: c0, c: c0.slice(), R: M4.ident(), t: 0, wet: false,
    v: add(drop ? [0, -0.5, 0] : add(mul(vd, sp), [gauss() * 2, rr(4, 9), gauss() * 2]), sh.vel),
    w: drop ? [gauss() * 0.4, 0, gauss() * 0.4] : [gauss() * 4, gauss() * 4, gauss() * 4] });
  sh.guns.forEach(function (g) { if (g.model === m) g.alive = false; });
  sh.ropes.forEach(function (r) { if (!r.dead && r.mods && r.mods.indexOf(m.k) >= 0) { r.dead = true; sh.rigDirty = true; } });
  if (!drop && m.kind !== 'powder') {
    hurt(sh, m.c, 7, 15, null, '砲被打飛', 140);
    flash(c0, vd, 10, false);
    for (var i = 0; i < 14; i++) spawnPt(c0, add(mul(vd, rr(3, 12)), [gauss() * 4, rr(1, 6), gauss() * 4]), rr(0.2, 0.5), [1, 0.85, 0.5], 1, 0.25, 0.1, G, 0.5, 3);
    sfx('crack', c0, 1.3);
  }
  if (m.kind === 'wheel') note(sh, '舵輪被打飛了');
  else if (m.kind === 'rudder') note(sh, drop ? '舵掉了' : '舵被打飛了');
  else if (m.kind === 'yard' && !drop) note(sh, '帆桁 ' + m.name.replace('yard-', '') + ' 被打斷');
  else if (GUNS[m.kind]) newsGun(sh, m, drop);                    // 廣播（同一刻好幾門 ⇒ 併成一行，見 61_hud.js）
}
/** 模型被打中：扣血（細節設定的砲血量；舵輪 6 成），歸零才整個飛出去。還撐得住 ⇒ 火星、聲音、旁邊的人被碎片波及。
 *  火藥桶另走 powderHit（歸零殉爆；拉滿 ＝ 不會爆 ⇒ 不扣）。 */
function damageModel(sh, m, vel, dmg) {
  if (!m.alive || !(dmg > 0)) return;
  if (m.kind === 'powder') { powderHit(sh, m, dmg); return; }
  if (m.gun) boxHit(sh, m.gun, dmg);                                    // 砲旁的藥箱（23_powder.js）
  m.hp -= dmg;
  if (m.hp <= 0) { blowModel(sh, m, vel); return; }
  var c0 = M4.pt(sh.M, m.c[0], m.c[1], m.c[2]), vd = norm(vel);
  for (var i = 0; i < 8; i++) spawnPt(c0, add(mul(vd, rr(-6, -2)), [gauss() * 3, rr(1, 4), gauss() * 3]), rr(0.15, 0.35), [1, 0.8, 0.45], 1, 0.2, 0.08, G, 0.5, 3);
  hurt(sh, m.c, 3, 8, null, '碎木', dmg * 0.7);
  sfx('crack', c0, 0.8);
}
/** 爆炸：r 格內的模型往外飛。傷害 ＝ 每發傷害 × 爆裂彈對砲倍率 × (1 − 0.75·d／r)。skip：直接打中的那一門（已經扣過）。 */
function blastModels(sh, L, r, w, skip, dmg) {
  var k = (dmg || 100) * ammoK(1, VS_GUN);
  sh.models.forEach(function (m) {
    if (!m.alive || (skip && skip.indexOf(m) >= 0)) return;
    var d = len(sub(m.c, L)); if (d > r) return;
    var cw = M4.pt(sh.M, m.c[0], m.c[1], m.c[2]);
    damageModel(sh, m, mul(norm(sub(cw, w)), 200 * (1 - d / r) + 60), k * (1 - 0.75 * d / r));
  });
}
/** 對人的基準傷害：1.4 × 每發傷害 × 彈種對人倍率（24 磅實心 ⇒ 140 ⇒ 碎木錐裡約 85% 當場陣亡，跟以前一樣）。 */
function crewBase(b) { return 1.4 * b.dmg * ammoK(b.ammo, VS_CREW); }
function stepFly(f, dt) {
  f.t += dt;
  f.v[1] -= G * dt;
  if (f.c[1] < seaH(f.c[0], f.c[2], SIMT)) {
    if (!f.wet) { f.wet = true; splash(f.c, true); }
    f.v = mul(f.v, 1 - 2.5 * dt); f.v[1] = Math.max(f.v[1], -1.0); f.w = mul(f.w, 1 - 2 * dt);
  }
  f.c = add(f.c, mul(f.v, dt));
  var a = len(f.w) * dt; if (a > 0) f.R = M4.mul(rotM(f.w, a), f.R);
  f.M = M4.mul(M4.mul(M4.mul(trans(f.c[0], f.c[1], f.c[2]), f.R), trans(-f.c0[0], -f.c0[1], -f.c0[2])), f.M0);
  return f.t < 25 && f.c[1] > -25;
}
function buildMeshes(H, C) {      // 船型 H 的每份模型網格一個 VAO：三角形展開、平面法線、材質色（P.tri 畫）；C ＝ 快取的 [{ tri, occ }]（06_cache.js）
  H.meshes = []; var keep = [];
  (H.rig.meshes || []).forEach(function (m, k) {
    var d = C ? C[k] : { tri: meshTris(m), occ: meshOcc(m) };
    var up = upload(null, d.tri, 9, [[0, 3, 0], [1, 3, 3], [2, 3, 6]]);
    up.occ = d.occ; H.meshes.push(up); keep.push(d);
  });
  if (H.keep) H.keep.models = keep;
}
function meshTris(m) {
  var v = m.verts, T = [];
  for (var j = 0; j < m.tris.length; j += 3) {
    var a = m.tris[j] * 3, b = m.tris[j + 1] * 3, d = m.tris[j + 2] * 3, c = m.mats[m.tmat[j / 3]];
    var n = norm(cross([v[b] - v[a], v[b + 1] - v[a + 1], v[b + 2] - v[a + 2]], [v[d] - v[a], v[d + 1] - v[a + 1], v[d + 2] - v[a + 2]]));
    T.push(v[a], v[a + 1], v[a + 2], n[0], n[1], n[2], c[0], c[1], c[2], v[b], v[b + 1], v[b + 2], n[0], n[1], n[2], c[0], c[1], c[2],
           v[d], v[d + 1], v[d + 2], n[0], n[1], n[2], c[0], c[1], c[2]);
  }
  return new Float32Array(T);
}
function ballToDebris(b) { spawnDebris(b.p, mul(b.v, 0.3), 36, 0.15, 20); b.alive = false; }
function slab(sh, L, dirL, b) {
  var side = norm(cross(dirL, [0, 0, 1])), cost = 0, n = 0, removed = [];
  for (var a = -13; a <= 13; a++) for (var h = -2; h <= 2; h++) for (var d = -2; d <= 2; d++) {
    if (Math.abs(a) > (10.5 + 2.5 * hash3(a, h, d + (L[2] | 0))) * Math.pow(sh.cfg.hard / 2, -0.25)) continue;   // 越硬撕開的那一片越窄
    var x = Math.floor(L[0] + side[0] * a + dirL[0] * d), y = Math.floor(L[1] + side[1] * a + dirL[1] * d), z = Math.floor(L[2] + h);
    var c = removeVoxel(sh, x, y, z, true); if (c) { cost += (HARD[c] || 1) * 2.4; n++; removed.push(x, y, z, c); }
  }
  for (var j = 0; j < removed.length; j += 4) if (rnd() < 0.5) {
    var w = M4.pt(sh.M, removed[j] + 0.5, removed[j + 1] + 0.5, removed[j + 2] + 0.5);
    spawnDebris(w, add(add(mul(norm(b.v), rr(4, 20)), [gauss() * 3, rr(0, 4), gauss() * 3]), sh.vel), removed[j + 3], rr(0.05, 0.11), rr(6, 12));
  }
  spawnPlates(sh, removed, norm(b.v), len(b.v), 12, 6);                 // 鏈彈撕下來的那一條：片狀的多一點
  sh.impulse = add(sh.impulse, mul(norm(b.v), n * 2));
  return { cost: cost, n: n };
}
function explode(w, sh, n) {
  flash(w, [0, 1, 0], 50, true);
  for (var i = 0; i < 26; i++) spawnPt(w, [gauss() * 7, rr(1, 9), gauss() * 7], rr(0.3, 0.8), [1, rr(0.45, 0.7), 0.15], 0.9, rr(1.5, 3), rr(3, 5), 0, 2.5, 3);
  smoke(w, [0, 1, 0], 22, true); sfx('blast', w, 1.4);
}
/** 這顆彈這一步在 sh 上飛得到的範圍（格座標 L 起算、最多再飛 reach 公尺）裡的繩、帆、人、模型：碰得到這個範圍（再外擴 16 格 ≥ 斷繩的 14、
 *  傷人的 4、帆的 8、模型的 10）的才留，順序照原本的。繩與帆與模型的外框、帆桁的角度、人的位置在砲彈這一段都不會變（帆桁轉、人走路在別段）⇒ 用一整步。
 *  跟著帆桁轉的（帆、帆桁模型）：判定時把彈點繞轉軸轉回作品的角度 ⇒ 離轉軸的水平距離不變 ⇒ 用圓柱挑（轉軸到範圍的水平距離 ≤ 外框四角離轉軸最遠的 ＋ 外擴 × 1.5）。
 *  模型不另外列：蓋戳記（o.nb ＝ 這一次的編號），hitModel 照原本的桶走、沒戳記的跳過 ⇒ 打到哪一個的先後跟原本一樣。 */
var NB_ID = 0;
function ballNear(sh, L, reach) {
  var H = (reach + 0.5) / S + 16, xa = L[0] - H, xb = L[0] + H, ya = L[1] - H, yb = L[1] + H, za = L[2] - H, zb = L[2] + H, id = ++NB_ID;
  function box(bb, r) { return bb[0] - r <= xb && bb[3] + r >= xa && bb[1] - r <= yb && bb[4] + r >= ya && bb[2] - r <= zb && bb[5] + r >= za; }
  function cyl(p, bb, r) {
    if (bb[2] - r > zb || bb[5] + r < za) return false;
    var R = 0; [[bb[0], bb[1]], [bb[3], bb[1]], [bb[0], bb[4]], [bb[3], bb[4]]].forEach(function (q) { R = Math.max(R, Math.hypot(q[0] - p[0], q[1] - p[1])); });
    var dx = Math.max(xa - p[0], 0, p[0] - xb), dy = Math.max(ya - p[1], 0, p[1] - yb);
    return Math.hypot(dx, dy) <= R + r * 1.5;
  }
  sh.models.forEach(function (o) { if (o.alive && (o.rot && o.piv ? cyl(o.piv, o.bb, 10) : box(o.bb, 10))) o.nb = id; });
  return { id: id,
    ropes: sh.ropes.filter(function (rp) { return !rp.dead && box(rp.bb, 0); }),
    sails: sh.sails.filter(function (s) { var y0 = s.yards && s.yards[0]; return !s.dead && !s.furled && (y0 ? cyl(y0.piv, s.bb, 8) : box(s.bb, 8)); }),
    crew: sh.crew.filter(function (c) { var p = c.pos; return p[0] >= xa && p[0] <= xb && p[1] >= ya && p[1] <= yb && p[2] + 9 >= za && p[2] + 9 <= zb; }) };
}
/** 經過的繩（距離 < r 格）斷掉；鏈彈穿過帆 ⇒ 帆掉下來。ropes／sails：只看這幾條、這幾面（stepBall 先挑好的，ballNear；沒給 ⇒ 全部）。 */
function cutRig(sh, L, r, b, ropes, sails) {
  var r2 = r * r, changed = false;
  (ropes || sh.ropes).forEach(function (rp) {
    if (rp.dead) return;
    var bb = rp.bb;
    if (L[0] < bb[0] - r || L[0] > bb[3] + r || L[1] < bb[1] - r || L[1] > bb[4] + r || L[2] < bb[2] - r || L[2] > bb[5] + r) return;
    var p = rp.pts;
    for (var j = 0; j + 5 < p.length; j += 3) {
      if (segDist2(L, p[j], p[j + 1], p[j + 2], p[j + 3], p[j + 4], p[j + 5]) < r2) { rp.dead = true; rp.cutL = [L[0], L[1], L[2]]; changed = true; break; }   // cutL：垂下來的繩從這裡分成兩段
    }
  });
  // 帆：鏈彈纏上（彈心 0.8 m 內有頂點）；實心與爆裂穿過（0.4 m 內）也扣、打個小洞。扣 ＝ 每發傷害 × 彈種對帆倍率
  var chain = b.ammo === 2, rs2 = chain ? 64 : 16, rb = chain ? 8 : 4;
  (sails || sh.sails).forEach(function (s) {
    if (s.dead || s.furled) return;
    var v = s.verts, sb = s.bb;
    if (b.sails && b.sails.indexOf(s) >= 0) return;                    // 同一顆彈穿過一面帆要好幾個小步 ⇒ 只算一次（記帆本身：兩艘的同編號帆是不同的帆）
    // 帆跟著帆桁轉過 ⇒ 彈點轉回作品的角度再比（撕洞、布片照真正的彈點）。帆頂照自己的帆桁、帆腳照 footYard（course 沒有 ⇒ 0），中間照高度內插
    var y0 = s.yards && s.yards[0], aH = y0 ? y0.rot : 0, aF = s.footYard ? s.footYard.rot : 0, a = aF + (aH - aF) * clamp((L[2] - sb[2]) / Math.max(1, sb[5] - sb[2]), 0, 1);
    var Ls = y0 && a ? rotZ(L, y0.piv, -a) : L;
    if (Ls[0] < sb[0] - rb || Ls[0] > sb[3] + rb || Ls[1] < sb[1] - rb || Ls[1] > sb[4] + rb || Ls[2] < sb[2] - rb || Ls[2] > sb[5] + rb) return;
    for (var j = 0; j < v.length; j += chain ? 9 : 3) { var dx = v[j] - Ls[0], dy = v[j + 1] - Ls[1], dz = v[j + 2] - Ls[2]; if (dx * dx + dy * dy + dz * dz < rs2) {
      tearCloth(sh, s, L, chain ? 7 : 3, b); s.hp -= b.dmg * ammoK(b.ammo, VS_SAIL); (b.sails = b.sails || []).push(s);
      if (s.hp <= 0) dropSail(sh, s, true); else if (chain) shredSail(sh, s, L);   // 歸零才掉；還撐得住 ⇒ 撕下幾片（鏈彈）、少一份推力
      changed = true; break; } }
  });
  if (changed) sh.rigDirty = true;
}
function segDist2(p, ax, ay, az, bx, by, bz) {
  var vx = bx - ax, vy = by - ay, vz = bz - az, wx = p[0] - ax, wy = p[1] - ay, wz = p[2] - az, l2 = vx * vx + vy * vy + vz * vz;
  var t = l2 > 0 ? clamp((wx * vx + wy * vy + wz * vz) / l2, 0, 1) : 0, dx = wx - vx * t, dy = wy - vy * t, dz = wz - vz * t;
  return dx * dx + dy * dy + dz * dz;
}
/** 帆掉了：變成十來片大塊的平面布片（點精靈，不是 3D 碎屑 —— 不撞甲板、不轉四元數），飄著往下掉、碰水就沒。
 *  物理開著 ⇒ 布留著，掛在還綁著的地方擺（全鬆了就往下掉）；被打穿的那一塊已經在 tearCloth 變成真的布片（34_shreds.js）⇒ 不撒點精靈。
 *  ⛔ 亂數照抽、只是不撒 ⇒ 開或關物理，後面的亂數序列一樣（戰局不變）。 */
function dropSail(owner, s, torn) {
  s.dead = true; owner.rigDirty = true; sailLinesDie(owner, s);
  if (s.furled) return;                                              // 收在帆桁上的：跟著掉，沒有布片
  var cl = PHYS && owner.cl ? owner.cl[s.k] : null;
  if (cl && cl.gone) cl = null;
  if (cl && !cl.p) cl.late = true;                                   // 物理開著、布還沒建（開局第一步之前就掉）⇒ 下一步 physStep 照「late」建布、垂下來；⛔ 撒點精靈（那是沒物理的樣子；TASK-0579）
  else if (cl) { cl.loose = true; clothPins(owner, s, cl); }
  var M = owner.M, v = s.verts, nv = v.length / 3, n = clamp(Math.round(nv / 90), 6, 16), c = s.col || [0.95, 0.92, 0.85];
  for (var k = 0; k < n; k++) {
    var j = ((rnd() * nv) | 0) * 3, w = M4.pt(M, v[j], v[j + 1], v[j + 2]), sz = rr(1.6, 3), t = rr(0.85, 1);
    var vel = [gauss() * 1.5, rr(-0.5, 1.5), gauss() * 1.5], life = rr(5, 9);
    if (!cl) spawnPt(w, vel, life, [c[0] * t, c[1] * t, c[2] * t], 1, sz, sz * 0.85, 3, 1.2, 4);   // 終端速度 ≈ 3／1.2 ＝ 2.5 m/s，跟著風飄
  }
}
/** 帆被打中但還撐得住：撕下幾片布（不掉）。物理開著、布在 ⇒ tearCloth 已經撕下真的布片（34_shreds.js），這裡照樣抽亂數、不放（PT_MUTE）。 */
function shredSail(owner, s, L) {
  var w = M4.pt(owner.M, L[0], L[1], L[2]), c = s.col || [0.95, 0.92, 0.85], cl = owner.cl && owner.cl[s.k];
  PT_MUTE = !!(PHYS && cl && !cl.gone);                              // 物理開著 ⇒ 不撒點精靈（布還沒建也一樣；TASK-0579）
  for (var k = 0; k < 3; k++) { var sz = rr(1.2, 2.2); spawnPt(w, [gauss() * 1.5, rr(-0.5, 1.5), gauss() * 1.5], rr(4, 7), c, 1, sz, sz * 0.85, 3, 1.2, 4); }
  PT_MUTE = false;
}
function sailLinesDie(owner, s) { (s.lines || []).forEach(function (j) { owner.ropes[j].dead = true; }); owner.rigDirty = true; }

