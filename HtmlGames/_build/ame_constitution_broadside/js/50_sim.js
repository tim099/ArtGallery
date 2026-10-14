// ───────────────────────── 電腦 ─────────────────────────
function ai(sh, dt) {
  var foe = foeOf(sh);                                              // 自己的目標（52_fleet.js；一對一 ＝ 另一艘）
  if (sh.sunk || sh.struck || sh.sinkingFinal || !foe) return;
  if (foe.sunk || foe.struck || foe.sinkingFinal) return;            // 對方降旗或在沉 ⇒ 停火
  captainThink(sh, foe);                                            // 砲長：該換瞄準模式就換（51_captain.js）
  if (sh.hand && (!sh.aimOn || isOut(sh.aimOn))) { sh.hand = false; setAim(sh, null); }   // 手動瞄的那艘出局了 ⇒ 回到全自動
  aiSecond(sh, foe, dt);                                            // 另一舷：對不到目標、但對得到別的敵艦的那幾門（沒有別的敵艦 ⇒ 什麼都不做）
  if (sh.hand && sh.i === PLAYER_I) return;                         // 自動開砲＋手動瞄準（71_input.js pick）：目標那一舷交給玩家（不改瞄準點、不替他開）
  sh.aiWait -= dt; if (sh.aiWait > 0) return;
  if (!anyBears(sh, foe.center)) { sh.aiWait = 0.5; return; }       // 哪一舷都對不到 ⇒ 等船轉過來
  var ready = 0, alive = 0, held = 0, FK = friendKeels(sh);         // 隔著友船的那幾門不算（52_fleet.js；沒有友船 ⇒ 空的）
  sh.guns.forEach(function (g) { if (g.alive && gunRate(g) > 0 && gunTarget(sh, g, foe.center)) { if (FK.length && friendInLine(FK, M4.pt(sh.M, g.muz[0], g.muz[1], g.muz[2]), foe.center)) { held++; return; } alive++; if (g.reload <= 0) ready++; } });
  if (!ready && held) { sh.ffHold = (sh.ffHold || 0) + held; sh.aiWait = 0.3; return; }   // 對得到的都隔著友船 ⇒ 忍住、等一下再看（不每一步重算）
  if (!ready || ready < Math.ceil(alive * 0.65)) return;
  var a = modeAim(foe, sh.aimMode || 'hull', true), t = a.t, ammo = a.ammo;   // 砲長選的模式裡亂挑一點（⛔ 以前固定 45% 船殼／27% 砲甲板／28% 桅，船殼瞄的是設計水線 ⇒ 敵艦浮高了還打在水面上）
  var err = Math.max(0.6, 4.5 - sh.salvo * 0.55) / S;
  setAim(sh, [t[0] + gauss() * err * 1.6, t[1], t[2] + gauss() * err * 0.5], foe);
  sh.aiSpread = 0.006;
  broadside(sh, ammo, true);
  sh.aiWait = rr(1.0, 3.5);
}
/** 兩舷都開（Tim 2026-10-13：「兩側都有敵人時，也只能單側開砲」）：主要目標 foe 照舊（ai）；另外挑一艘別的敵艦（近的先），
 *  拿「對不到 foe、對得到它」的那幾門（還沒排進齊射、沒隔著友船）另開一輪 —— 自己的節奏 sh.aiWait2、自己的瞄準點（broadsideAt）。
 *  只有別的敵艦時才動（一對一 ⇒ 一進來就回去，不抽亂數 ⇒ 一位元都不差）。 */
function aiSecond(sh, foe, dt) {
  // 保留給主要那一輪的砲：平常 ＝ 對得到 foe 的；玩家手動瞄準時（sh.hand，自動開砲開著、點了一艘船）＝ 打得到瞄準圈的那幾門
  //   （Tim 2026-10-14：「能打到瞄準圈的砲不自動開砲，其他的自動瞄準、自動開砲」；瞄的可以是友艦）⇒ 其他敵艦（含 foe）都可以當這一輪的目標。
  var hand = sh.hand && sh.i === PLAYER_I && sh.aim && sh.aimOn, ex = hand ? sh.aimOn : foe;
  var others = SHIPS.filter(function (o) { return isFoe(sh, o) && o !== ex && !o.sunk && !o.struck && !o.sinkingFinal && o.center; });
  if (!others.length) return;
  sh.aiWait2 = (sh.aiWait2 || 0) - dt; if (sh.aiWait2 > 0) return;
  sh.aiWait2 = 0.5;                                                 // 沒開成 ⇒ 半秒後再看
  others.sort(function (a, b) { return Math.hypot(a.px - sh.px, a.pz - sh.pz) - Math.hypot(b.px - sh.px, b.pz - sh.pz); });
  var pend = EVENTS.filter(function (e) { return e.sh === sh.i; }).map(function (e) { return e.g; }), FK = friendKeels(sh);
  var exAim = hand ? sh.aim : [ex.T.cx, ex.T.cy, ex.T.geo.aim], exW = hand ? M4.pt(ex.M, exAim[0], exAim[1], exAim[2]) : ex.center;
  var free = sh.guns.filter(function (g) { return g.alive && gunRate(g) > 0 && pend.indexOf(g) < 0 && !withAim(sh, exAim, ex, function () { return gunTarget(sh, g, exW); }); });
  for (var j = 0; j < others.length; j++) {
    var o = others[j], oAim = [o.T.cx, o.T.cy, o.T.geo.aim], alive = [], ready = [];
    free.forEach(function (g) {
      if (!withAim(sh, oAim, o, function () { return gunTarget(sh, g, o.center); })) return;
      if (FK.length && friendInLine(FK, M4.pt(sh.M, g.muz[0], g.muz[1], g.muz[2]), o.center)) return;
      alive.push(g); if (g.reload <= 0) ready.push(g);
    });
    if (!ready.length || ready.length < Math.ceil(alive.length * 0.65)) continue;
    var a = modeAim(o, sh.aimMode || 'hull', true), t = a.t, err = Math.max(0.6, 4.5 - sh.salvo * 0.55) / S;
    var aim = [t[0] + gauss() * err * 1.6, t[1], t[2] + gauss() * err * 0.5];
    var tgt = M4.pt(o.M, aim[0], aim[1], aim[2]);
    var guns = ready.filter(function (g) { return withAim(sh, aim, o, function () { return gunTarget(sh, g, tgt); }); });
    sh.aiSpread = 0.006;
    if (broadsideAt(sh, a.ammo, o, aim, guns)) { sh.aiWait2 = rr(1.0, 3.5); return; }
  }
}

// ───────────────────────── 一步 ─────────────────────────
function step() {
  if (PF) PF.t = performance.now();                                 // 逐幀分段計時（?debug=1，00_core.js）
  SIMT += DT;
  if ((Math.round(SIMT / DT) % CMD_EVERY) === 0) cmdTick();        // 指揮官每 3 秒想一次（52_fleet.js；不抽亂數）
  pickFoes();                                                      // 每艘的目標（52_fleet.js）：這一步之內都用同一個
  stepWind(SIMT);                                                  // 風會變（08_weather.js）
  for (var i = 0; i < EVENTS.length; i++) {
    var e = EVENTS[i]; if (e.t > SIMT) continue;
    EVENTS.splice(i--, 1);
    var sh = SHIPS[e.sh];
    if (e.on) withAim(sh, e.aim, e.on, function () { sh.autoNow = true; var et2 = sh.sunk ? null : gunTarget(sh, e.g, add(aimPoint(sh), mul(shipAxis(sh), e.off))); if (et2) fireGun(sh, e.g, et2, e.ammo); sh.autoNow = false; });   // 另一舷那一輪：照它自己的瞄準點（21_gunnery.js broadsideAt）
    else { var et = sh.sunk ? null : gunTarget(sh, e.g, add(aimPoint(sh), mul(shipAxis(sh), e.off))); if (et) fireGun(sh, e.g, et, e.ammo); }   // 開火那一刻才挑點（兩艘都在動）
  }
  SHIPS.forEach(burstStep);                                        // 連發剩下的那幾發（21_gunnery.js；burst ＝ 1 的砲什麼都不做）
  if (PF) pfLap('fire');
  SHIPS.forEach(function (sh) { sail(sh, DT); stepShip(sh, DT); if (PF) pfLap('ship'); stepCrew(sh, DT); if (PF) pfLap('crew'); });
  collide();
  SHIPS.forEach(function (sh) {                                    // 照 SHIPS 的順序（一對一：我艦先、敵艦後 ⇒ 跟以前同一個順序抽亂數）
    if (sh.i === PLAYER_I) { if (AUTOFIRE) ai(sh, DT); }            // 自動開砲：我艦也交給電腦瞄準開火
    else if (MODE !== 'sandbox') ai(sh, DT);                        // 沙盒的其他船不還手
  });
  if (PF) pfLap('ai');
  for (i = 0; i < BALLS.length; i++) { stepBall(BALLS[i], DT); if (!BALLS[i].alive) { if (CAM.follow === BALLS[i]) { CAM.hold = 1.2; } BALLS.splice(i--, 1); } }
  if (PF) pfLap('balls');
  SHIPS.forEach(function (sh) { integrity(sh); sh.impulse = [0, 0, 0]; });
  if (PF) pfLap('integrity');
  for (i = 0; i < PIECES.length; i++) if (!stepPiece(PIECES[i], DT)) { PIECES[i].rs.dispose(); PIECES.splice(i--, 1); }
  for (i = 0; i < FLY.length; i++) if (!stepFly(FLY[i], DT)) FLY.splice(i--, 1);
  if (PF) pfLap('pieces');
  if (SLOW_VIS) stepWater(DT, 'ship');                             // 殉爆慢動作中：只給人看的照畫面的時間走（73_slowmo.js），這裡只生船邊的水花
  else { stepDebris(DT); if (PF) pfLap('debris'); stepPts(DT); if (PF) pfLap('pts'); stepWater(DT); }
  if (PF) pfLap('water');                       // 船邊水花（13_water.js；只給人看、自己的亂數）
  if (PHYS) { var pt0 = performance.now(); SHIPS.forEach(function (sh) { if (sh.sink < 40) physStep(sh); }); PHYS_MS = PHYS_MS * 0.98 + (performance.now() - pt0) * 0.02; }   // 讀數只看、不回寫模擬
  if (PF) pfLap('phys');
  stepPowder();                                                    // 殉爆排程（23_powder.js）
  stepBlasts();                                                    // 還沒挖完的彈坑接著挖（23_powder.js）
  if (PF) pfLap('powder');
  if ((Math.round(SIMT / DT) % 30) === 0) { SHIPS.forEach(survey); SHIPS.forEach(newsFlush); reinforce(); playerHandoff(); }   // reinforce：空出名額 ⇒ 候補進場；playerHandoff：我艦出局 ⇒ 換到友艦（52_fleet.js；沒有候補／我艦還在打 ⇒ 直接回去）
  if (PF) pfLap('survey');
  if (!OVER || END_AT) checkEnd();                                 // 結束判定每一步看（結算畫面照模擬時間延後跳）
  if (PF) pfLap('end');
}

