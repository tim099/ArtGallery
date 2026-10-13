// ───────────────────────── 電腦 ─────────────────────────
function ai(sh, dt) {
  var foe = SHIPS[1 - sh.i];
  if (sh.sunk || sh.struck || sh.sinkingFinal) return;
  if (foe.sunk || foe.struck || foe.sinkingFinal) return;            // 對方降旗或在沉 ⇒ 停火
  captainThink(sh, foe);                                            // 砲長：該換瞄準模式就換（51_captain.js）
  sh.aiWait -= dt; if (sh.aiWait > 0) return;
  if (!anyBears(sh, foe.center)) { sh.aiWait = 0.5; return; }       // 哪一舷都對不到 ⇒ 等船轉過來
  var ready = 0, alive = 0;
  sh.guns.forEach(function (g) { if (g.alive && gunRate(g) > 0 && gunTarget(sh, g, foe.center)) { alive++; if (g.reload <= 0) ready++; } });
  if (!ready || ready < Math.ceil(alive * 0.65)) return;
  var a = modeAim(foe, sh.aimMode || 'hull', true), t = a.t, ammo = a.ammo;   // 砲長選的模式裡亂挑一點（⛔ 以前固定 45% 船殼／27% 砲甲板／28% 桅，船殼瞄的是設計水線 ⇒ 敵艦浮高了還打在水面上）
  var err = Math.max(0.6, 4.5 - sh.salvo * 0.55) / S;
  sh.aim = [t[0] + gauss() * err * 1.6, t[1], t[2] + gauss() * err * 0.5];
  sh.aiSpread = 0.006;
  broadside(sh, ammo);
  sh.aiWait = rr(1.0, 3.5);
}

// ───────────────────────── 一步 ─────────────────────────
function step() {
  if (PF) PF.t = performance.now();                                 // 逐幀分段計時（?debug=1，00_core.js）
  SIMT += DT;
  stepWind(SIMT);                                                  // 風會變（08_weather.js）
  for (var i = 0; i < EVENTS.length; i++) {
    var e = EVENTS[i]; if (e.t > SIMT) continue;
    EVENTS.splice(i--, 1);
    var sh = SHIPS[e.sh], et = sh.sunk ? null : gunTarget(sh, e.g, add(aimPoint(sh), mul(shipAxis(sh), e.off)));   // 開火那一刻才挑點（兩艘都在動）
    if (et) fireGun(sh, e.g, et, e.ammo);
  }
  if (PF) pfLap('fire');
  SHIPS.forEach(function (sh) { sail(sh, DT); stepShip(sh, DT); if (PF) pfLap('ship'); stepCrew(sh, DT); if (PF) pfLap('crew'); });
  collide();
  if (AUTOFIRE) ai(SHIPS[PLAYER_I], DT);                           // 自動開砲：我艦也交給電腦瞄準開火
  if (MODE !== 'sandbox') ai(SHIPS[1 - PLAYER_I], DT);            // 沙盒的敵艦不還手
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
  if ((Math.round(SIMT / DT) % 30) === 0) { SHIPS.forEach(survey); SHIPS.forEach(newsFlush); }
  if (PF) pfLap('survey');
  if (!OVER || END_AT) checkEnd();                                 // 結束判定每一步看（結算畫面照模擬時間延後跳）
  if (PF) pfLap('end');
}

