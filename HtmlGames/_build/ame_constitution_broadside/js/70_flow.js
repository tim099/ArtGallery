// ───────────────────────── 開局 ─────────────────────────
function reset() {
  END_AT = 0;
  rs = SEED;
  SHIPS.forEach(function (sh) { sh.rs.dispose(); });
  PIECES.forEach(function (pc) { pc.rs.dispose(); });
  SHIPS = []; PIECES = []; BALLS = []; EVENTS = []; FLY = []; BOOMS = []; D.n = 0; PT.n = 0; SIMT = 0; OVER = false; PAUSED = false; AMMO_I = 0;
  clearMsgs();
  PLAYER_I = 0;
  SHIPS.push(makeShip(0, 'blue', 0, DIST / 2));
  SHIPS.push(makeShip(1, 'red', Math.PI, -DIST / 2));
  KEYS.l = KEYS.r = false; setAutoFire(MODE === 'eve');
  SHIPS.forEach(function (sh) { stepShip(sh, 0); survey(sh); });
  CAM.mode = 0; CAM.follow = null; CAM.trMe = CAM.trYaw = null; CAM.dist = DIST * 1.05 + 40; CAM.tgt = [0, 8, 0]; CAM.yaw = 2.2; CAM.pitch = 0.22; CAM.snap = true;
  if (!CAMQ) { CAM.mode = 4; CAM.aoff = 0.35; CAM.dist = 78; CAM.pitch = 0.2; }   // 預設：我艦→敵艦（?cam= 給了 ⇒ 那個固定機位）
  if (CAMQ === 'close') { CAM.dist = 85; CAM.tgt = [10, 9, -DIST / 2 + 12]; CAM.yaw = 1.95; CAM.pitch = 0.16; }
  if (CAMQ === 'blue') { CAM.dist = 88; CAM.tgt = [4, 12, DIST / 2 - 10]; CAM.yaw = -1.8; CAM.pitch = 0.15; }
  if (CAMQ === 'high') { CAM.dist = DIST + 120; CAM.yaw = 2.5; CAM.pitch = 0.62; }
}

function start() {
  initAudio(); if (AC && AC.state === 'suspended') AC.resume();
  $('cover').style.display = 'none'; $('end').className = '';
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // 不然空白鍵會再按一次「開戰」
  reset(); RUNNING = true;
  note(SHIPS[PLAYER_I], AUTOFIRE ? '自動開砲中（G 關掉就自己打）' : '點敵艦設瞄準點，空白鍵齊射（G 自動開砲）');
}

