// ───────────────────────── 進水、傾斜、沉沒 ─────────────────────────
function stepShip(sh, dt) {
  // 進水：水線下每個破洞的流量 ∝ √(水深)（貼著水面的洞進得慢）；抽水機每秒抽掉一點 ⇒ 小洞撐得住
  var wz = Math.min(SZ - 1, Math.floor(ZW + (sh.sink - sh.bob) / S)), N = 0, Q = 0, Dsp = 0, Dbs = 0;
  for (var z = 0; z <= wz; z++) { var c = sh.flood[z * 3]; if (!c) continue; N += c; Q += c * Math.sqrt((wz - z) * S + 0.05); Dsp += sh.flood[z * 3 + 1]; Dbs += sh.flood[z * 3 + 2]; }
  sh.inflow = N;
  if (!sh.sunk) {
    sh.sink = Math.max(0, sh.sink + (Q * 1.1e-5 - 0.004) * FLOOD * dt);      // 進水與抽水一起照滑桿縮放（⛔ 只縮進水 ⇒ 調慢之後抽水永遠贏、永遠不沉）
    if (sh.sink > 4.2 && !sh.sinkingFinal && FLOOD > 0) { sh.sinkingFinal = true; note(sh, '進水太多，開始沉了'); }
    if (sh.sinkingFinal) { sh.sinkV += 0.06 * FLOOD * dt; sh.sink += sh.sinkV * dt; }
    if (sh.sink > 9) { sh.sunk = true; note(sh, '沉沒'); }
  } else { sh.sinkV = Math.min(sh.sinkV + 0.05 * dt, 1.2); sh.sink += sh.sinkV * dt; }
  // 傾斜：破洞那一舷往下（格座標 +y ＝ 船體 −Z；繞 +X 轉負角時 −Z 那邊下沉）
  var rollT = -clamp(Dsp / (N + 900), -1, 1) * (sh.sinkingFinal ? 0.55 : 0.21);
  var pitchT = -clamp(Dbs / (N + 1500), -1, 1) * 0.07;
  sh.rollV += ((rollT - sh.rollA) * 0.9 - sh.rollV * 0.8) * dt;
  sh.rollA += sh.rollV * dt;
  sh.rollW = Math.sin(SIMT * 0.53 + sh.phase) * 0.012;
  sh.pitchA += (pitchT - sh.pitchA) * 0.3 * dt;
  sh.bob = Math.sin(SIMT * 0.7 + sh.phase) * 0.18;
  sh.M = M4.mul(shipMatrix(sh), M4.ident()); sh.inv = M4.inv(sh.M);
  sh.center = shipCenter(sh); sh.rad2 = 62 * 62;
  manning(sh);
  for (var i = 0; i < sh.guns.length; i++) if (sh.guns[i].reload > 0) sh.guns[i].reload -= dt * gunRate(sh.guns[i]);   // 人少裝填慢、沒人不裝填
}
function survey(sh) {               // 每半秒量一次：砲還在不在、桅還在不在、繩與帆的錨還在不在
  var alive = 0;
  sh.models.forEach(function (m) {
    if (!m.alive) return;
    var f = m.foot, x = f & 1023, y = (f >> 10) & 1023, z = f >> 20;
    if (!countBox(sh.grid, x - 2, y - 2, z - 1, x + 2, y + 2, z)) blowModel(sh, m, [0, -1, 0], true);   // 腳下的甲板被打掉 ⇒ 掉下去
  });
  sh.guns.forEach(function (g) {
    if (g.alive) g.alive = g.model ? g.model.alive : countBox(sh.grid, g.box[0], g.box[1], g.box[2], g.box[3], g.box[4], g.box[5]) >= g.orig * 0.55;
    if (g.alive) alive++;
  });
  sh.gunsAlive = alive;
  var up = 0;
  sh.masts.forEach(function (m) { if (m.up) { m.up = countBox(sh.grid, m.x - 8, CY - 8, m.z0, m.x + 8, CY + 8, m.z1) > m.orig * 0.3; if (!m.up) note(sh, m.name + '倒了'); } if (m.up) up++; });
  sh.mastsUp = up;
  sh.ropes.forEach(function (r) { if (r.dead) return; if ((r.a >= 0 && !gp(sh.grid, r.a)) || (r.b >= 0 && !gp(sh.grid, r.b))) { r.dead = true; sh.rigDirty = true; } });
  sh.ropes.forEach(function (r) { if (!r.dead && r.par && r.par.some(function (j) { return sh.ropes[j].dead; })) { r.dead = true; sh.rigDirty = true; } });
  sh.sails.forEach(function (s) {
    if (!s.dead && !s.furled && (s.as.some(function (a) { return !gp(sh.grid, a); }) || s.par.some(function (j) { return sh.ropes[j].dead; }))) dropSail(sh, s);
  });
  sh.crew.forEach(function (c) {   // 腳下 3×3 都沒了 ⇒ 掉下去（走路中的不算：途中跨過艙口邊）
    if (c.st >= 3 || c.walk || c.moving) return;
    var x = Math.floor(c.pos[0]), y = Math.floor(c.pos[1]);
    if (!countBox(sh.grid, x - 1, y - 1, c.pos[2] - 1, x + 1, y + 1, c.pos[2] - 1)) fall(sh, c);
  });
  chooseSide(sh); reassign(sh); manning(sh);
  sh.able = sh.crew.filter(able).length;
  sh.gunsManned = sh.guns.filter(function (g) { return g.alive && gunRate(g) > 0; }).length;
  strikeCheck(sh);
}
/** 降旗：規則在選單設定（STRIKE），每半秒量一次。死傷 ＝ 1 − 還能動的／開戰時的人數（傷與亡都算）。
 *  全員倒下一定停（死傷門檻上限就是 100%）—— 那不是投降，是沒人能打了。 */
function strikeCheck(sh) {
  if (sh.struck || sh.sunk) return;
  var cas = 1 - sh.able / sh.crew0, pc = '死傷 ' + Math.round(cas * 100) + '%';
  if (sh.gunsManned > 0) sh.silentT = -1; else if (sh.silentT < 0) sh.silentT = SIMT;   // 砲全啞：毀了或沒人操作
  var why = null;
  if (sh.able === 0) why = '全員倒下';
  else if (cas >= STRIKE.cas) why = '降旗（' + pc + '）';
  else if (STRIKE.guns && sh.silentT >= 0 && SIMT - sh.silentT >= 10) why = '降旗（砲全啞 10 秒）';
  else if (STRIKE.masts && sh.mastsUp === 0 && cas >= 0.33) why = '降旗（桅全倒、' + pc + '）';
  else if (STRIKE.officers && cas >= 0.25 && !sh.crew.some(function (c) { return c.role === ROLE.OFFICER && able(c); })) why = '降旗（軍官全倒、' + pc + '）';
  if (!why) return;
  sh.struck = true; sh.fate = why; note(sh, why);
}
/** 選單與結算畫面用的一句話：現在的降旗規則。 */
function strikeText() {
  var r = [];
  if (STRIKE.cas < 1) r.push('死傷 ' + Math.round(STRIKE.cas * 100) + '%');
  if (STRIKE.guns) r.push('砲全啞 10 秒');
  if (STRIKE.masts) r.push('桅全倒且死傷 ≥ 33%');
  if (STRIKE.officers) r.push('軍官全倒且死傷 ≥ 25%');
  return r.length ? '任一條成立就降旗：' + r.join('／') : '不降旗：打到沉或全員倒下';
}
function gp(g, p) { return g.get(p & 1023, (p >> 10) & 1023, p >> 20); }

