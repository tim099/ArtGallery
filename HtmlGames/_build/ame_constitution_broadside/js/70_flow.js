// ───────────────────────── 開局 ─────────────────────────
function reset() {
  END_AT = 0; END_WAIT = null;
  rs = SEED; rsD = SEED ^ RSD0; rsW = SEED ^ RSW0; rsF = SEED ^ RSF0; rsC = SEED ^ RSC0; SH_STAT.cut = SH_STAT.tris = 0; FLOOD_LV = PHX.flood; WP_STAT.spray = WP_STAT.foam = 0; WP_STAT.src = {}; DEB_ACC = PT_ACC = 0; SIMT = 0; windInit(); stepWind(0);   // 開局的風：這一場的風向、風速（08_weather.js windInit）              // 碎木、水花、進水粒子的亂數，少生的節拍跟著重設（12_effects.js、13_water.js、33_flood.js）；進水模式在這裡定（戰鬥中改了下一場生效）
  SHIPS.forEach(function (sh) { sh.rs.dispose(); });
  PIECES.forEach(function (pc) { pc.rs.dispose(); });
  SHIPS = []; PIECES = []; BALLS = []; EVENTS = []; FLY = []; BOOMS = []; SELFB = []; BLASTS = []; D.n = 0; PT.n = 0; WS.n = WF.n = 0; SIMT = 0; OVER = false; PAUSED = false;   // 彈種（AMMO_I）重開時保留（Tim 2026-10-12）
  clearMsgs(); fleetReset();                                          // 上方艦隊：每一場開局全折疊（61_hud.js）
  PSLOW.ts = 1; PSLOW.ms = 0;                                         // 物理減速（73_slowmo.js）：重開從 1× 起、重新量
  SLOW.active = false; SLOW.ts = 1; SLOW.t = 0; SLOW.camSave = null; SLOW.kicks = 0;   // 殉爆的慢動作與特寫（73_slowmo.js）：⛔ 不清 ⇒ 殉爆、自爆後馬上重開，新的一局接著慢、幾秒後鏡頭被拉回上一局的爆心
  PLAYER_I = 0;
  spawnFleet(fleetSpec());                                           // 編隊（52_fleet.js）：一對一 ＝ 以前那兩艘、同一個位置；船型要先載好（loadHull）
  cmdReset(); cmdTick();                                             // 指揮官（52_fleet.js、53_commander.js）：開局先想一次
  pickFoes();
  KEYS.l = KEYS.r = false;
  if (MODE !== LAST_MODE) { setAutoFire(MODE === 'eve'); LAST_MODE = MODE; }   // 自動開砲：換了模式才套預設（觀戰開、其他關），同一個模式重開保留（Tim 2026-10-12）
  SHIPS.forEach(function (sh) { stepShip(sh, 0); survey(sh); });
  pickCaptains();                                                    // 砲長（51_captain.js）
  CAM.mode = 0; CAM.follow = null; CAM.trMe = CAM.trYaw = null; CAM.pan = [0, 0]; CAM.see = null; CAM.dist = DIST * 1.05 + 40; CAM.tgt = [0, 8, 0]; CAM.yaw = 2.2; CAM.pitch = 0.22; CAM.snap = true;
  if (!CAMQ) { CAM.mode = 4; CAM.aoff = 0.35; CAM.dist = 78; CAM.pitch = 0.2; }   // 預設：我艦→敵艦（?cam= 給了 ⇒ 那個固定機位）
  if (CAMQ === 'close') { CAM.dist = 85; CAM.tgt = [10, 9, -DIST / 2 + 12]; CAM.yaw = 1.95; CAM.pitch = 0.16; }
  if (CAMQ === 'blue') { CAM.dist = 88; CAM.tgt = [4, 12, DIST / 2 - 10]; CAM.yaw = -1.8; CAM.pitch = 0.15; }
  if (CAMQ === 'deck') { CAM.mode = 4; CAM.aoff = +(Q.get('aoff') || 0.3); CAM.dist = +(Q.get('dist') || 56); CAM.pitch = +(Q.get('pitch') || 0.3); }   // 縮圖：跟著我艦、近一點高一點 ⇒ 看得到甲板上的人
  if (CAMQ === 'high') { CAM.dist = DIST + 120; CAM.yaw = 2.5; CAM.pitch = 0.62; }
}

function start() {
  initAudio(); if (AC && AC.state === 'suspended') AC.resume();
  $('cover').style.display = 'none'; $('end').className = '';
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // 不然空白鍵會再按一次「開戰」
  reset(); RUNNING = true;
  var seenT = {}; SHIPS.forEach(function (sh) { if (!seenT[sh.T.id]) { seenT[sh.T.id] = 1; crewShortNote(sh); } });   // 船員站不下：每一型報一次
  note(SHIPS[PLAYER_I], AUTOFIRE ? '自動開砲中（G 關掉就自己打）' : '點敵艦設瞄準點，空白鍵齊射（G 自動開砲）');
  if (WX.aim) note(SHIPS[PLAYER_I], '暴風雨：浪大、風強 —— 船晃得越兇砲越散，舵也難使');
}

