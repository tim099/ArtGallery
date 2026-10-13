// ───────────────────────── 砲長：瞄準模式與策略（Tim 2026-10-12） ─────────────────────────
// 瞄準模式：水線（敵艦「現在」的水線 ⇒ 浮高了就跟著往下）／砲甲板／帆具／甲板人員／彈藥庫（彈藥庫頂離水面 1 m 內才有意義），各配合適的彈種。
// 砲長（每艘一個，細節設定可選、預設隨機）：每隔幾秒照局勢替每個模式打分 ＝ 偏好 × 局勢 × 隨機 ±15%，最高的那個比現在的高兩成才換，換的時候上方廣播。
//   戰鬥中會換著打（Tim：不是固定用一種）：同一個模式打久了分數慢慢打折（45 秒折到一半）；現在這個模式打了沒用（局勢 ≈ 0：桅都倒了…）就馬上換。
//   局勢：水線 ＝ 0.6 ＋ 敵艦浮高（1.2 m 加滿 2.4）＋ 敵艦進水（4 m 加滿 0.4）—— Tim：敵艦浮高時改瞄水線；
//         砲甲板 ＝ 0.2 ＋ 0.8 × 敵艦還有人操作的砲比例；帆具 ＝ 還站著的桅比例 × 帆面積比例；甲板人員 ＝ 0.2 ＋ 0.8 × 還能動的人比例；
//         彈藥庫 ＝ 最淺那間的頂離水面 d：露出水面 3、1 m 內 3 × (1 − d)、更深 0（火藥拉滿不會爆 ⇒ 0）。
// 我艦手動時：Q 循環瞄準模式（點敵艦 ⇒ 回到自由）；瞄的是那個模式的中心點（不抽亂數 ⇒ HUD 每一格算也不影響戰局）。自動開砲 ⇒ 交給我艦的砲長。
var AIM_MODES = ['water', 'hull', 'rig', 'deck', 'mag'], AIM_CYCLE = ['free', 'water', 'hull', 'rig', 'deck', 'mag'];
var AIM_NAME = { free: '自由', water: '水線', hull: '砲甲板', rig: '帆具', deck: '甲板人員', mag: '彈藥庫' };
var CAPTAINS = {
  steady: { name: '穩健派', tip: '照局勢平均分配', think: 10, w: { water: 1.2, hull: 1.2, rig: 0.8, deck: 0.6, mag: 1.5 } },
  sink: { name: '擊沉派', tip: '專打水線，敵艦浮高就追著水線打', think: 8, w: { water: 2.2, hull: 0.7, rig: 0.4, deck: 0.4, mag: 2.0 } },
  mast: { name: '拆桅派', tip: '先拆桅讓對方跑不動，再打水線', think: 8, w: { water: 0.8, hull: 0.6, rig: 2.4, deck: 0.5, mag: 1.2 } },
  kill: { name: '殺傷派', tip: '打砲甲板與甲板上的人，讓對方開不了砲', think: 8, w: { water: 0.6, hull: 1.6, rig: 0.4, deck: 2.0, mag: 1.0 } },
  gamble: { name: '賭徒', tip: '彈藥庫一靠近水面就全押上去', think: 6, w: { water: 1.0, hull: 0.8, rig: 0.6, deck: 0.6, mag: 5.0 } }
};
var CAP_KEYS = Object.keys(CAPTAINS), AIM_P = 'free';   // AIM_P：我艦手動的瞄準模式（重開時保留）
/** 開局：每艘挑一個砲長（細節設定的；隨機 ⇒ 抽種子亂數）。 */
function pickCaptains() { SHIPS.forEach(pickCaptain); }
/** 一艘的砲長（開局每艘、候補進場時那一艘；52_fleet.js spawnReserve）。 */
function pickCaptain(sh) {
  var k = sh.i === PLAYER_I ? CAP_SET[0] : sh.team !== playerTeam() ? CAP_SET[1] : 'random'; if (!CAPTAINS[k]) k = CAP_KEYS[(rnd() * CAP_KEYS.length) | 0];   // 細節設定的兩格：我艦／敵船（友船隨機）
  sh.cap = k; sh.aimMode = null; sh.capT = -99; sh.pMode = sh.i === PLAYER_I ? AIM_P : 'free';
}
/** 敵艦現在的水線（格座標的 z）：設計水線 ＋ 進水 − 浮高 − 浪。 */
function wlZ(foe) { return foe.T.zw + (foe.sink - foe.lift - foe.bob) / S; }
/** 最淺那間還在的彈藥庫：{ mag, d（頂離水面幾公尺，負 ＝ 露出水面）}；沒有 ⇒ null。 */
function magNear(foe) {
  var wl = wlZ(foe), best = null;
  (foe.mags || []).forEach(function (m) { if (m.gone) return; var d = (wl - m.box[5]) * S; if (!best || d < best.d) best = { mag: m, d: d }; });
  return best;
}
/** 每個模式的局勢分數（0 ＝ 打了沒用）。 */
function aimValue(foe, mode) {
  if (mode === 'water') return 0.6 + 2.4 * clamp(foe.lift / 1.2, 0, 1) + 0.4 * clamp(foe.sink / 4, 0, 1);
  if (mode === 'hull') return 0.2 + 0.8 * (foe.gunsManned || 0) / Math.max(1, foe.guns.length);
  if (mode === 'rig') return (foe.mastsUp || 0) / Math.max(1, foe.masts.length) * foe.sailFrac;   // 照那艘有幾根桅（夜隼號 2）
  if (mode === 'deck') return 0.2 + 0.8 * (foe.able || 0) / Math.max(1, foe.crew0);
  if (mode === 'mag') { if (powderNever()) return 0; var n = magNear(foe); return !n ? 0 : n.d <= 0 ? 3 : n.d < 1 ? 3 * (1 - n.d) : 0; }
  return 0;
}
/** 砲長想一想：該換模式就換、廣播一則。 */
function captainThink(sh, foe) {
  var C = CAPTAINS[sh.cap]; if (!C || SIMT - sh.capT < C.think) return;
  sh.capT = SIMT;
  var tired = sh.aimMode ? Math.max(0.5, 1 - (SIMT - sh.modeT) / 90) : 1, sc = {}, best = null, bs = -1;   // 打久了會膩：45 秒折到一半
  AIM_MODES.forEach(function (m) { var v = aimValue(foe, m), s = C.w[m] * v * rr(0.85, 1.15) * (m === sh.aimMode ? tired : 1); sc[m] = v > 0 ? s : 0; if (sc[m] > bs) { bs = sc[m]; best = m; } });
  var cur = sh.aimMode ? sc[sh.aimMode] : -1;
  if (best === sh.aimMode || (sh.aimMode && cur > 0.05 && bs < cur * 1.2)) return;
  var first = !sh.aimMode; sh.aimMode = best; sh.modeT = SIMT; sh.modes = (sh.modes || 0) + 1;
  var why = best === 'water' && foe.lift > 0.3 ? '敵艦浮高 ' + foe.lift.toFixed(1) + ' m' : best === 'mag' ? (function (n) { return n.d <= 0 ? '彈藥庫露出水面' : '彈藥庫離水面 ' + n.d.toFixed(1) + ' m'; })(magNear(foe)) : !first && tired < 0.75 ? '換個打法' : '';
  note(sh, '砲長（' + C.name + '）：' + (first ? '先瞄' : '改瞄') + AIM_NAME[best] + (why ? '（' + why + '）' : ''), best === 'mag');
}
/** 那個模式要瞄哪裡（敵艦的格座標）與用什麼彈；rand ⇒ 在範圍裡亂挑一點（電腦），否則中心點（我艦手動，不抽亂數）。 */
function modeAim(foe, mode, rand) {
  function R(a, b) { return rand ? rr(a, b) : (a + b) / 2; }
  function P(p) { return rand ? rnd() < p : p >= 0.5; }
  var wl = wlZ(foe), CY = foe.T.cy, WL_X0 = foe.T.wl0, WL_X1 = foe.T.wl1, xm = (WL_X0 + WL_X1) / 2;
  if (mode === 'mag') {
    var n = magNear(foe); if (n) return { t: [R(n.mag.box[0] + 4, n.mag.box[3] - 4), CY, wl + R(0.5, 4)], ammo: 0 };
    mode = 'water';
  }
  if (mode === 'water') return { t: [R(WL_X0 + 40, WL_X1 - 40), CY, wl + R(1, 9)], ammo: 0 };                 // 水面上 0.1–0.9 m（砲彈碰到水就沒了）
  if (mode === 'rig') {
    var masts = foe.masts.filter(function (m) { return m.up; });
    if (masts.length) { var m = rand ? masts[(rnd() * masts.length) | 0] : masts.reduce(function (a, b) { return Math.abs(b.x - xm) < Math.abs(a.x - xm) ? b : a; }); return { t: [m.x, CY, R(foe.T.geo.rigAim[0], foe.T.geo.rigAim[1])], ammo: P(0.7) ? 2 : 0 }; }
    mode = 'hull';
  }
  if (mode === 'deck') {
    var on = foe.crew.filter(function (c) { return c.st === 0 && (c.deck === foe.weatherDeck || c.role === ROLE.MARINE || c.role === ROLE.OFFICER || c.role === ROLE.HELM); });
    if (on.length) { var c = rand ? on[(rnd() * on.length) | 0] : on[0]; return { t: [rand ? c.pos[0] : xm, CY, c.pos[2] + 10], ammo: P(0.8) ? 1 : 0 }; }
    mode = 'hull';
  }
  return { t: [R(WL_X0 + 60, WL_X1 - 60), CY, R(foe.T.geo.deckAim[0], foe.T.geo.deckAim[1])], ammo: P(0.3) ? 1 : 0 };   // 砲甲板（高度照船型，05_hull.js GEO0）
}
/** 細節設定的砲長選單：選項 ＝ 隨機 ＋ 各砲長（說明當 title）。 */
function capOptions(sel, v) {
  sel.innerHTML = '<option value="random">隨機</option>' + CAP_KEYS.map(function (k) { return '<option value="' + k + '" title="' + CAPTAINS[k].tip + '">' + CAPTAINS[k].name + '（' + CAPTAINS[k].tip + '）</option>'; }).join('');
  sel.value = v;
}
