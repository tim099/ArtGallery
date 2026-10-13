// ───────────────────────── 設定存檔（localStorage；Tim 2026-10-13：直接開網頁時，設定存在玩家自己的瀏覽器，下次打開自動套用） ─────────────────────────
// 存：玩法（娛樂／寫實）、細節設定（血量、傷害、彈種倍率、火藥、補給、風壓、降旗、頂風失速、娛樂加成）、船隻設定（SHIP_CFG，照船型）、砲長、選了哪兩艘船、彈種、自動開砲、帆與繩的物理，
//   以及主選單的模式、距離、航行。不存整場戰局。
// 只存「跟預設不一樣」的那幾項：沒動過的照程式的預設走 ⇒ 之後改了預設值（例：火藥 450 → 675），沒動過的玩家也吃得到新的。
//   壓艙物的預設跟船走（T.ballast0）⇒ 存的時候記那艘船的 checksum，船重匯過就不套（PREF_BALLAST，04_state.js）。
// 網址參數優先：網址有的那一項照網址；網址帶了任何設定參數 ⇒ 只讀不寫（照連結開的那一場不蓋掉玩家自己的存檔）。
// ?demo（縮圖、對拍）⇒ 不讀也不寫：快轉出來的那一格不受存檔影響。?prefs=0 同（量預設用）。
// 讀寫都包 try/catch：畫廊彈窗的 iframe 只開 allow-scripts（不透明來源），一碰 localStorage 就丟錯 ⇒ 照預設跑。
// 格式帶版本號（v）；看不懂的版本、壞掉的 JSON ⇒ 整份不套；型別不對、界外的值 ⇒ 那一項不套（界外的夾回範圍）。
// 什麼時候存：每秒比一次（跟上次存的不一樣才寫）＋ 關頁、切到背景時。全部回到預設 ⇒ 刪掉那一筆。
var PREFS_KEY = 'ame_constitution_broadside.prefs', PREFS_VER = 1;
var PREF_Q = ['ship', 'hard', 'flood', 'ballast', 'gunw', 'speed', 'agile', 'gunhp', 'sailhp', 'crewhp', 'powderhp', 'blast', 'blastv', 'dmg24', 'dmg32l', 'dmg32', 'dmg18',
  'box', 'carry', 'hands', 'wind', 'ammo', 'strike', 'cap', 'phys', 'sail', 'play', 'stall', 'funspeed', 'funagile', 'funstall', 'funpowder', 'sea',
  'gfx', 'g_shadow', 'g_refl', 'g_refr', 'g_sea', 'g_res', 'g_aa', 'phx', 'p_rig', 'p_debris', 'p_fx', 'weather', 'g_rain', 'g_drops', 'g_dropspl', 'slowmo', 'slowcam'];          // 會蓋過存檔的網址參數（04_state.js、05_hull.js 讀的那些）
var DMG_Q = { long: 'dmg24', long32: 'dmg32l', carr: 'dmg32', chase: 'dmg18' };
var PREFS = { read: DEMO < 0 && Q.get('prefs') !== '0', write: false, state: '', last: '' };
PREFS.write = PREFS.read && !PREF_Q.some(function (k) { return Q.has(k); });
/** 現在的設定裡跟預設不一樣的那幾項（＋版本號）。 */
function prefsSnap() {
  var o = { v: PREFS_VER }, cfg = {};
  function put(k, v, d) { if (v !== d) o[k] = v; }
  if (SHIP_SET.some(function (id) { return id !== 'constitution'; })) o.ship = SHIP_SET.slice();
  Object.keys(SHIP_CFG).forEach(function (id) {
    var c = SHIP_CFG[id], T = HULLT[id], d = {};
    SHIP_KEYS.forEach(function (k) { if (k !== 'ballast' && c[k] !== LIM[k][2]) d[k] = c[k]; });
    if (T && c.ballast !== undefined) { if (c.ballast !== T.ballast0) { d.ballast = c.ballast; d.chk = T.h.checksum; } }
    else if (PREF_BALLAST[id]) { d.ballast = PREF_BALLAST[id].v; d.chk = PREF_BALLAST[id].chk; }   // 這一場沒載那艘船 ⇒ 存檔裡的照留
    if (Object.keys(d).length) cfg[id] = d;
  });
  if (Object.keys(cfg).length) o.cfg = cfg;
  put('gunhp', GUN_HP, LIM.gunhp[2]); put('sailhp', SAIL_HP, LIM.sailhp[2]); put('crewhp', CREW_HP, LIM.crewhp[2]); put('powderhp', POWDER_HP, LIM.powderhp[2]);
  put('blast', BLAST_K, LIM.blast[2]); put('blastv', BLAST_V, LIM.blastv[2]); put('box', BOX_N, LIM.box[2]); put('carry', CARRY_N, LIM.carry[2]); put('hands', HANDS, LIM.hands[2]); put('wind', WIND_K, LIM.wind[2]);
  put('weather', WX_ID, 'clear'); put('sea', SEA_K, LIM.sea[2]); put('play', PLAY, 'fun'); put('stall', STALL_K, LIM.stall[2]); put('funspeed', FUN.speed, LIM.funspeed[2]); put('funagile', FUN.agile, LIM.funagile[2]); put('funstall', FUN.stall, LIM.funstall[2]); put('funpowder', FUN.powder, LIM.funpowder[2]);
  var dm = {}; Object.keys(DMG_Q).forEach(function (t) { if (DMG[t] !== LIM[DMG_Q[t]][2]) dm[t] = DMG[t]; });
  if (Object.keys(dm).length) o.dmg = dm;
  if (AMMO_K.some(function (r, i) { return r.some(function (v, j) { return v !== AMMO_K0[i][j]; }); })) o.ammoK = AMMO_K.map(function (r) { return r.slice(); });
  if (STRIKE.cas !== LIM.cas[2] || STRIKE.guns || STRIKE.masts || STRIKE.officers) o.strike = { cas: STRIKE.cas, guns: STRIKE.guns, masts: STRIKE.masts, officers: STRIKE.officers };
  if (CAP_SET.some(function (k) { return k !== 'random'; })) o.cap = CAP_SET.slice();
  var gd = GFX_PRESET[GFX_DEFAULT]; if (GFX_ITEMS.some(function (it) { return GFX[it.k] !== gd[it.k]; })) { o.gfx = {}; GFX_ITEMS.forEach(function (it) { o.gfx[it.k] = GFX[it.k]; }); }   // 畫質（07_gfx.js）：跟預設不一樣 ⇒ 整組存
  put('fps', GFX_FPS, false); put('slow', SLOW.on, true); put('slowcam', SLOW.cam, true);   // 殉爆的慢動作與特寫（73_slowmo.js）
  var xd = PHX_PRESET[PHX_DEFAULT]; if (PHX_ITEMS.some(function (it) { return PHX[it.k] !== xd[it.k]; })) { o.phx = {}; PHX_ITEMS.forEach(function (it) { o.phx[it.k] = PHX[it.k]; }); }   // 物理效果（09_phx.js）：跟預設不一樣 ⇒ 整組存
  put('ammo', AMMO_I, 0); put('mode', MODE, 'pve'); put('sail', SAIL, 'auto'); put('dist', DIST, 140);
  if (LAST_MODE === MODE) put('auto', AUTOFIRE, MODE === 'eve');     // 換了模式還沒開局 ⇒ 開局時會照模式重套（70_flow.js reset），這時的值不算數
  return o;
}
/** 存檔 ⇒ 變數。網址有的那一項不套；每一項各自驗（型別、範圍），不對的那一項照預設。 */
function prefsApply(p) {
  function num(v, lim, int) { if (typeof v !== 'number' || !isFinite(v)) return undefined; v = clamp(v, lim[0], lim[1]); return int ? Math.round(v) : v; }
  function set(qk, v, lim, int, f) { if (Q.has(qk)) return; var x = num(v, lim, int); if (x !== undefined) f(x); }
  if (!Q.has('ship') && Array.isArray(p.ship)) p.ship.forEach(function (w, i) { if (i < 2 && hullInfo(w)) SHIP_SET[i] = w; });
  if (p.cfg && typeof p.cfg === 'object') Object.keys(p.cfg).forEach(function (id) {
    var d = p.cfg[id]; if (!hullInfo(id) || !d || typeof d !== 'object') return;
    var c = shipCfg(id);
    SHIP_KEYS.forEach(function (k) { if (k !== 'ballast') set(k, d[k], LIM[k], false, function (x) { c[k] = x; }); });
    var b = num(d.ballast, LIM.ballast, true);
    if (b !== undefined && typeof d.chk === 'number') PREF_BALLAST[id] = { v: b, chk: d.chk };   // 船型載好、checksum 對得上才套（cfgDefault）
  });
  set('gunhp', p.gunhp, LIM.gunhp, true, function (x) { GUN_HP = x; });
  set('sailhp', p.sailhp, LIM.sailhp, true, function (x) { SAIL_HP = x; });
  set('crewhp', p.crewhp, LIM.crewhp, true, function (x) { CREW_HP = x; });
  set('powderhp', p.powderhp, LIM.powderhp, true, function (x) { POWDER_HP = x; });
  set('blast', p.blast, LIM.blast, false, function (x) { BLAST_K = x; });
  set('blastv', p.blastv, LIM.blastv, false, function (x) { BLAST_V = x; });
  set('box', p.box, LIM.box, true, function (x) { BOX_N = x; });
  set('carry', p.carry, LIM.carry, true, function (x) { CARRY_N = x; });
  set('hands', p.hands, LIM.hands, true, function (x) { HANDS = x; });
  set('wind', p.wind, LIM.wind, false, function (x) { WIND_K = x; });
  if (!Q.has('play') && (p.play === 'fun' || p.play === 'real')) PLAY = p.play;
  set('stall', p.stall, LIM.stall, false, function (x) { STALL_K = x; });
  set('sea', p.sea, LIM.sea, false, function (x) { SEA_K = x; });
  if (!Q.has('weather') && WEATHERS[p.weather]) { WX_ID = p.weather; WX = WEATHERS[WX_ID]; }   // 天色在 71_input.js 開頭 setWeather 套
  set('funspeed', p.funspeed, LIM.funspeed, false, function (x) { FUN.speed = x; });
  set('funagile', p.funagile, LIM.funagile, false, function (x) { FUN.agile = x; });
  set('funstall', p.funstall, LIM.funstall, false, function (x) { FUN.stall = x; });
  set('funpowder', p.funpowder, LIM.funpowder, false, function (x) { FUN.powder = x; });
  if (p.dmg && typeof p.dmg === 'object') Object.keys(DMG_Q).forEach(function (t) { set(DMG_Q[t], p.dmg[t], LIM[DMG_Q[t]], true, function (x) { DMG[t] = x; }); });
  if (!Q.has('ammo') && Array.isArray(p.ammoK)) p.ammoK.forEach(function (r, i) {
    if (i < 3 && Array.isArray(r)) r.forEach(function (v, j) { var x = num(v, AMMO_LIM, true); if (j < 3 && x !== undefined) AMMO_K[i][j] = x; });
  });
  if (!Q.has('strike') && p.strike && typeof p.strike === 'object') {
    var cas = num(p.strike.cas, LIM.cas); if (cas !== undefined) STRIKE.cas = cas;
    ['guns', 'masts', 'officers'].forEach(function (k) { if (typeof p.strike[k] === 'boolean') STRIKE[k] = p.strike[k]; });
  }
  if (!Q.has('cap') && Array.isArray(p.cap)) p.cap.forEach(function (w, i) { if (i < 2 && (w === 'random' || Object.prototype.hasOwnProperty.call(CAPTAINS, w))) CAP_SET[i] = w; });
  var a = num(p.ammo, [0, AMMO.length - 1], true); if (a !== undefined) AMMO_I = a;
  var qx = Q.has('phx') || Q.has('phys') || PHX_ITEMS.some(function (it) { return Q.has('p_' + it.k); });   // 網址指定了物理 ⇒ 存檔的那份不套
  if (!qx && p.phx && typeof p.phx === 'object') PHX_ITEMS.forEach(function (it) { var x = num(p.phx[it.k], [0, it.opt.length - 1], true); if (x !== undefined) PHX[it.k] = x; });
  else if (!qx && p.phys === false) PHX.rig = 0;                     // 舊格式（只存了帆與繩的開關）
  PHYS = PHX.rig > 0;
  if (p.gfx && typeof p.gfx === 'object' && !Q.has('gfx')) GFX_ITEMS.forEach(function (it) { var x = num(p.gfx[it.k], [0, it.opt.length - 1], true); if (x !== undefined && !Q.has('g_' + it.k)) GFX[it.k] = x; });
  if (typeof p.fps === 'boolean') GFX_FPS = p.fps;
  if (typeof p.slow === 'boolean' && !Q.has('slowmo')) SLOW.on = p.slow;
  if (typeof p.slowcam === 'boolean' && !Q.has('slowcam')) SLOW.cam = p.slowcam;
  if (!Q.has('sail') && (p.sail === 'auto' || p.sail === 'manual' || p.sail === 'off')) SAIL = p.sail;
  if (p.mode === 'pve' || p.mode === 'eve' || p.mode === 'sandbox') MODE = p.mode;
  if (typeof p.auto === 'boolean') { AUTOFIRE = p.auto; LAST_MODE = MODE; }   // 存了自動開砲 ⇒ 開局不再照模式套預設（70_flow.js reset）
  if ([].some.call(document.querySelectorAll('#dists button'), function (b) { return +b.dataset.d === p.dist; })) DIST = p.dist;
}
function prefsSave() {
  if (!PREFS.write) return;
  var o = prefsSnap(), s = JSON.stringify(o);
  if (s === PREFS.last) return;
  try {
    if (Object.keys(o).length > 1) window.localStorage.setItem(PREFS_KEY, s); else window.localStorage.removeItem(PREFS_KEY);   // 全部是預設 ⇒ 不留一筆
    PREFS.last = s;
  } catch (e) { PREFS.write = false; PREFS.state = '存不了（' + (e && e.name || e) + '）'; }
}
/** 細節設定的「重設預設值」：那一頁回到預設之後馬上存（只剩主選單的選擇；全部是預設 ⇒ 刪掉那一筆），也忘掉存檔裡別的船的壓艙物。 */
function prefsReset() { PREF_BALLAST = {}; PREFS.last = ''; prefsSave(); }
(function prefsLoad() {
  if (!PREFS.read) { PREFS.state = DEMO >= 0 ? '?demo ⇒ 不讀不存' : '?prefs=0 ⇒ 不讀不存'; return; }
  var s;
  try { s = window.localStorage.getItem(PREFS_KEY); } catch (e) { PREFS.read = PREFS.write = false; PREFS.state = '存不了（這個頁面不能用 localStorage）⇒ 照預設'; return; }
  if (s === null) PREFS.state = '沒有存檔（照預設）';
  else {
    var p = null; try { p = JSON.parse(s); } catch (e) { p = null; }
    if (!p || typeof p !== 'object' || p.v !== PREFS_VER) PREFS.state = '存檔看不懂（' + (p && typeof p === 'object' ? '版本 ' + p.v : '壞掉的 JSON') + '）⇒ 照預設';
    else { prefsApply(p); PREFS.state = '套用了本機存檔（' + (Object.keys(p).length - 1) + ' 項）'; }
  }
  if (!PREFS.write) PREFS.state += '；網址帶了設定參數 ⇒ 這一場不存';
  PREFS.last = JSON.stringify(prefsSnap());              // 套用後的樣子 ⇒ 玩家動了才寫（看不懂的存檔不會因為打開一次就被蓋掉）
  // 主選單按鈕的亮燈照套用後的值（航行與帆的物理由 71_input.js 照變數點）
  [].forEach.call(document.querySelectorAll('#modes button'), function (b) { b.className = b.dataset.m === MODE ? 'on' : ''; });
  [].forEach.call(document.querySelectorAll('#dists button'), function (b) { b.className = +b.dataset.d === DIST ? 'on' : ''; });
  $('autoF').classList.toggle('on', AUTOFIRE);
  if (!PREFS.write) return;
  setInterval(prefsSave, 1000);
  window.addEventListener('pagehide', prefsSave);
  document.addEventListener('visibilitychange', function () { if (document.hidden) prefsSave(); });
})();
