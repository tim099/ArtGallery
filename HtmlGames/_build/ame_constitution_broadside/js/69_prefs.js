// ───────────────────────── 設定存檔（localStorage；Tim 2026-10-13：直接開網頁時，設定存在玩家自己的瀏覽器，下次打開自動套用） ─────────────────────────
// 存：玩法（娛樂／寫實）、細節設定（血量、傷害、彈種倍率、火藥、補給、風壓、降旗、頂風失速、娛樂加成）、船隻配置頁（SHIP_CFG＋SHIP_CREW，照船型）、砲長、選了哪兩艘船、彈種、自動開砲、帆與繩的物理，
//   以及主選單的模式、距離、航行。不存整場戰局。
// 只存「跟預設不一樣」的那幾項：沒動過的照程式的預設走 ⇒ 之後改了預設值（例：火藥 450 → 675），沒動過的玩家也吃得到新的。
//   壓艙物的預設跟船走（T.ballast0）⇒ 存的時候記那艘船的 checksum，船重匯過就不套（PREF_BALLAST，04_state.js）。
// 網址參數優先：網址有的那一項照網址；網址帶了任何設定參數 ⇒ 只讀不寫（照連結開的那一場不蓋掉玩家自己的存檔）。
// ?demo（縮圖、對拍）⇒ 不讀也不寫：快轉出來的那一格不受存檔影響。?prefs=0 同（量預設用）。
// 讀寫都包 try/catch：畫廊彈窗的 iframe 只開 allow-scripts（不透明來源），一碰 localStorage 就丟錯 ⇒ 照預設跑。
// 格式帶版本號（v）；看不懂的版本、壞掉的 JSON ⇒ 整份不套；型別不對、界外的值 ⇒ 那一項不套（界外的夾回範圍）。
// 什麼時候存：每秒比一次（跟上次存的不一樣才寫）＋ 關頁、切到背景時。全部回到預設 ⇒ 刪掉那一筆。
var PREFS_KEY = 'ame_constitution_broadside.prefs', PREFS_VER = 1;
var PREF_Q = ['wdir', 'wspd', 'ship', 'blue', 'red', 'hard', 'flood', 'ballast', 'gunw', 'speed', 'agile', 'upwind', 'base', 'gunhp', 'sailhp', 'crewhp', 'powderhp', 'blast', 'blastv', 'dmg24', 'dmg32l', 'dmg32', 'dmg18', 'dmg12', 'dmg6', 'dmg3c', 'dmgtr',
  'box', 'carry', 'hands', 'drown', 'heal', 'wind', 'ammo', 'strike', 'cap', 'phys', 'sail', 'play', 'stall', 'funspeed', 'funagile', 'funstall', 'funpowder', 'sea',
  'gfx', 'g_shadow', 'g_refl', 'g_refr', 'g_sea', 'g_res', 'g_aa', 'phx', 'p_rig', 'p_rigfar', 'p_debris', 'p_fx', 'weather', 'g_rain', 'g_drops', 'g_dropspl', 'g_shships', 'g_masks', 'dist', 'field', 'reinf', 'cmd', 'blue', 'red', 'slowmo', 'slowcam', 'roomfn', 'navre', 'smoke', 'pslow', 'pslowb', 'debcap'];          // 會蓋過存檔的網址參數（04_state.js、05_hull.js 讀的那些）
var DMG_Q = { long: 'dmg24', long32: 'dmg32l', carr: 'dmg32', chase: 'dmg18', long4: 'dmg4', long12: 'dmg12', long6: 'dmg6', chase3: 'dmg3c', trident: 'dmgtr' };
var PREFS = { read: DEMO < 0 && Q.get('prefs') !== '0' && !Q.has('admin'), write: false, state: '', last: '' };   // ?admin=rooms（設定後台嵌的那一份）⇒ 不讀不存
PREFS.write = PREFS.read && !PREF_Q.some(function (k) { return Q.has(k); });
// ?cmd=我方,敵方（艦隊指揮官，52_fleet.js CMD_SIDE）：放這裡 —— ⛔ 放在 52_fleet.js 那時 53_commander.js 的 CMD_NAMES 還沒定義 ⇒ 帶 ?cmd 一開就丟錯、整頁停在載入
if (Q.has('cmd')) Q.get('cmd').split(',').forEach(function (w, i) { if (i < 2 && CMD_NAMES[w]) CMD_SIDE[i ? 'red' : 'blue'] = w; });
/** 現在的設定裡跟預設不一樣的那幾項（＋版本號）。 */
function prefsSnap() {
  var o = { v: PREFS_VER }, cfg = {};
  function put(k, v, d) { if (v !== d) o[k] = v; }
  if (FLEET_SET.some(function (L) { return L.length !== 1 || L[0] !== HULL_DEF; })) o.fleet = FLEET_SET.map(function (L) { return L.slice(); });   // 艦隊編成（TASK-0537；舊存檔的 ship ＝ 一邊一艘，讀的時候照樣認）
  Object.keys(SHIP_CFG).forEach(function (id) {
    var c = SHIP_CFG[id], T = HULLT[id], d = {};
    SHIP_KEYS.forEach(function (k) { if (k !== 'ballast' && c[k] !== cfgBase(k, id)) d[k] = c[k]; });   // 跟那一型的預設比（HULL_CFG0）
    if (T && c.ballast !== undefined) { if (c.ballast !== T.ballast0) { d.ballast = c.ballast; d.chk = T.h.checksum; } }
    else if (PREF_BALLAST[id]) { d.ballast = PREF_BALLAST[id].v; d.chk = PREF_BALLAST[id].chk; }   // 這一場沒載那艘船 ⇒ 存檔裡的照留
    if (Object.keys(d).length) cfg[id] = d;
  });
  if (Object.keys(cfg).length) o.cfg = cfg;
  var cr = crewSnap(true); if (Object.keys(cr).length) o.crew = cr;          // 船員配置（TASK-0570）：跟那一型的預設不一樣的
  var rm = roomsSnap(true); if (Object.keys(rm).length) o.rooms = rm;        // 艙房的擺法（TASK-0568）
  put('gunhp', GUN_HP, LIM.gunhp[2]); put('sailhp', SAIL_HP, LIM.sailhp[2]); put('crewhp', CREW_HP, LIM.crewhp[2]); put('powderhp', POWDER_HP, LIM.powderhp[2]);
  put('blast', BLAST_K, LIM.blast[2]); put('blastv', BLAST_V, LIM.blastv[2]); put('box', BOX_N, LIM.box[2]); put('carry', CARRY_N, LIM.carry[2]); put('hands', HANDS, LIM.hands[2]); put('drown', DROWN_T, LIM.drown[2]); put('heal', HEAL_T, LIM.heal[2]); put('navre', NAV_RE, LIM.navre[2]); put('smoke', SMOKE_K, SMOKE_LIM[2]); put('debcap', DEB_CAP, DEB_LIM[2]); put('wind', WIND_K, LIM.wind[2]);
  put('weather', WX_ID, 'clear'); put('sea', SEA_K, LIM.sea[2]); put('play', PLAY, CFG.menu.play); put('stall', STALL_K, LIM.stall[2]); put('funspeed', FUN.speed, LIM.funspeed[2]); put('funagile', FUN.agile, LIM.funagile[2]); put('funstall', FUN.stall, LIM.funstall[2]); put('funpowder', FUN.powder, LIM.funpowder[2]);
  var dm = {}; Object.keys(DMG_Q).forEach(function (t) { if (DMG[t] !== LIM[DMG_Q[t]][2]) dm[t] = DMG[t]; });
  if (Object.keys(dm).length) o.dmg = dm;
  var gs = gunsSnap(); if (Object.keys(gs).length) o.guns = gs;          // 砲的設定（68_guncfg.js）：跟砲種表預設不一樣的
  if (AMMO_K.some(function (r, i) { return r.some(function (v, j) { return v !== AMMO_K0[i][j]; }); })) o.ammoK = AMMO_K.map(function (r) { return r.slice(); });
  if (STRIKE.cas !== LIM.cas[2] || STRIKE.guns || STRIKE.masts || STRIKE.officers) o.strike = { cas: STRIKE.cas, guns: STRIKE.guns, masts: STRIKE.masts, officers: STRIKE.officers };
  if (CAP_SET.some(function (k) { return k !== 'random'; })) o.cap = CAP_SET.slice();
  var gd = GFX_PRESET[GFX_DEFAULT]; if (GFX_ITEMS.some(function (it) { return GFX[it.k] !== gd[it.k]; })) { o.gfx = {}; GFX_ITEMS.forEach(function (it) { o.gfx[it.k] = GFX[it.k]; }); }   // 畫質（07_gfx.js）：跟預設不一樣 ⇒ 整組存
  put('fps', GFX_FPS, false); put('slow', SLOW.on, true); put('pslow', PSLOW.on, false); put('pslowb', PSLOW.budget, LIM.pslowb[2]); put('slowcam', SLOW.cam, true);   // 殉爆的慢動作與特寫（73_slowmo.js）
  var xd = PHX_PRESET[PHX_DEFAULT]; if (PHX_ITEMS.some(function (it) { return PHX[it.k] !== xd[it.k]; })) { o.phx = {}; PHX_ITEMS.forEach(function (it) { o.phx[it.k] = PHX[it.k]; }); }   // 物理效果（09_phx.js）：跟預設不一樣 ⇒ 整組存
  put('ammo', AMMO_I, 0); put('mode', MODE, CFG.menu.mode); put('sail', SAIL, CFG.menu.sail); put('dist', DIST, LIM_DIST[2]); put('field', FIELD_N, MAX_SHIPS); put('reinf', REINF_MODE, 'prop'); if (CMD_SIDE.blue !== 'pair' || CMD_SIDE.red !== 'pair') o.cmd = [CMD_SIDE.blue, CMD_SIDE.red];
  if (LAST_MODE === MODE) put('auto', AUTOFIRE, MODE === 'eve');     // 換了模式還沒開局 ⇒ 開局時會照模式重套（70_flow.js reset），這時的值不算數
  return o;
}
/** 存檔 ⇒ 變數。網址有的那一項不套；每一項各自驗（型別、範圍），不對的那一項照預設。 */
function prefsApply(p) {
  function num(v, lim, int) { if (typeof v !== 'number' || !isFinite(v)) return undefined; v = clamp(v, lim[0], lim[1]); return int ? Math.round(v) : v; }
  function set(qk, v, lim, int, f) { if (Q.has(qk)) return; var x = num(v, lim, int); if (x !== undefined) f(x); }
  if (!Q.has('ship') && !Q.has('blue') && !Q.has('red')) {               // 編成：網址給了任何一個 ⇒ 整組照網址
    if (Array.isArray(p.ship)) p.ship.forEach(function (w, i) { if (i < 2 && hullInfo(w)) FLEET_SET[i] = [w]; });   // 舊存檔（一邊一艘）
    if (Array.isArray(p.fleet)) p.fleet.forEach(function (L, i) { if (i < 2 && Array.isArray(L)) { L = L.filter(function (w) { return typeof w === 'string' && hullInfo(w); }); if (L.length) FLEET_SET[i] = L; } });
    fleetTrim(FLEET_SET);
  }
  shipsApply(p);
  set('gunhp', p.gunhp, LIM.gunhp, true, function (x) { GUN_HP = x; });
  set('sailhp', p.sailhp, LIM.sailhp, true, function (x) { SAIL_HP = x; });
  set('crewhp', p.crewhp, LIM.crewhp, true, function (x) { CREW_HP = x; });
  set('powderhp', p.powderhp, LIM.powderhp, true, function (x) { POWDER_HP = x; });
  set('blast', p.blast, LIM.blast, false, function (x) { BLAST_K = x; });
  set('blastv', p.blastv, LIM.blastv, false, function (x) { BLAST_V = x; });
  set('box', p.box, LIM.box, true, function (x) { BOX_N = x; });
  set('carry', p.carry, LIM.carry, true, function (x) { CARRY_N = x; });
  set('hands', p.hands, LIM.hands, true, function (x) { HANDS = x; });
  set('drown', p.drown, LIM.drown, true, function (x) { DROWN_T = x; });
  set('navre', p.navre, LIM.navre, false, function (x) { NAV_RE = x; });
  set('heal', p.heal, LIM.heal, true, function (x) { HEAL_T = x; });
  set('debcap', p.debcap, DEB_LIM, true, function (x) { DEB_CAP = x; });   // 碎片上限（畫質頁；07_gfx.js）
  set('smoke', p.smoke, SMOKE_LIM, false, function (x) { SMOKE_K = Math.round(x * 10) / 10; });   // 煙消散（畫質頁；07_gfx.js）
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
  if (p.guns && typeof p.guns === 'object') gunsApply(p.guns);
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
  if (typeof p.pslow === 'boolean' && !Q.has('pslow')) PSLOW.on = p.pslow;   // 物理減速（73_slowmo.js）
  set('pslowb', p.pslowb, LIM.pslowb, false, function (x) { PSLOW.budget = Math.round(x * 100) / 100; });
  if (typeof p.slowcam === 'boolean' && !Q.has('slowcam')) SLOW.cam = p.slowcam;
  if (!Q.has('sail') && (p.sail === 'auto' || p.sail === 'manual' || p.sail === 'off')) SAIL = p.sail;
  if (p.mode === 'pve' || p.mode === 'eve' || p.mode === 'sandbox') MODE = p.mode;
  if (typeof p.auto === 'boolean') { AUTOFIRE = p.auto; LAST_MODE = MODE; }   // 存了自動開砲 ⇒ 開局不再照模式套預設（70_flow.js reset）
  if (!Q.has('field') && typeof p.field === 'number' && isFinite(p.field)) FIELD_N = clamp(Math.round(p.field), 2, MAX_SHIPS);   // 候補（52_fleet.js）
  if (!Q.has('reinf') && REINF_NAMES[p.reinf]) REINF_MODE = p.reinf;
  if (!Q.has('cmd') && Array.isArray(p.cmd)) p.cmd.forEach(function (w, i) { if (i < 2 && CMD_NAMES[w]) CMD_SIDE[i ? 'red' : 'blue'] = w; });   // 指揮官（TASK-0551）
  if (!Q.has('dist') && typeof p.dist === 'number' && isFinite(p.dist)) DIST = clamp(Math.round(p.dist), LIM_DIST[0], LIM_DIST[1]);   // 舊存檔的 90／140／220 照樣是合法的值
}
/** 船隻配置（船隻設定 cfg ＋ 船員 crew，照船型）：存檔、匯入共用這一支。每一項各自驗；網址有的那一項不套。 */
function shipsApply(p) {
  function num(v, lim, int) { if (typeof v !== 'number' || !isFinite(v)) return undefined; v = clamp(v, lim[0], lim[1]); return int ? Math.round(v) : v; }
  if (p.cfg && typeof p.cfg === 'object') Object.keys(p.cfg).forEach(function (id) {
    var d = p.cfg[id]; if (!hullInfo(id) || !d || typeof d !== 'object') return;
    var c = shipCfg(id);
    SHIP_KEYS.forEach(function (k) { if (k !== 'ballast' && !Q.has(k)) { var x = num(d[k], LIM[k]); if (x !== undefined) c[k] = x; } });
    var b = num(d.ballast, LIM.ballast, true), T = HULLT[id];
    if (b !== undefined && typeof d.chk === 'number' && !Q.has('ballast')) { PREF_BALLAST[id] = { v: b, chk: d.chk }; if (T && T.h.checksum === d.chk) c.ballast = b; }   // 船型載好、checksum 對得上才套（cfgDefault）
  });
  if (p.crew && typeof p.crew === 'object') Object.keys(p.crew).forEach(function (id) {
    var d = p.crew[id]; if (!hullInfo(id) || !d || typeof d !== 'object') return;
    var c = SHIP_CREW[id] = SHIP_CREW[id] || {};
    CREW_ITEMS.forEach(function (it) { var x = num(d[it.k], it.lim, true); if (x !== undefined) c[it.k] = x; });
    if (d.guns && typeof d.guns === 'object') Object.keys(d.guns).forEach(function (t) { if (!GUNS[t]) return; var x = num(d.guns[t], [GUNS[t].min, GUN_CREW_MAX], true); if (x !== undefined) (c.guns = c.guns || {})[t] = x; });
  });
  if (p.rooms && typeof p.rooms === 'object') Object.keys(p.rooms).forEach(function (id) {   // 艙房的擺法（房名、格子在船型載好之前驗不了 ⇒ 照收，開戰時 roomCheck 再驗；不認得的類型、物品不收）
    var d = p.rooms[id]; if (!hullInfo(id) || !d || typeof d !== 'object') return;
    var c = SHIP_ROOMS[id] = SHIP_ROOMS[id] || {};
    Object.keys(d).forEach(function (k) { var v = roomPlanParse(d[k]); if (v !== undefined) c[k] = v; });
  });
}
/** 存檔裡的一間 ⇒ 擺法：'' ⇒ null（空著）；'medical'（舊格式：只有類型）⇒ { type }（自動擺滿）；{ type, items } ⇒ 照收看得懂的物品；看不懂 ⇒ undefined（不收）。 */
function roomPlanParse(v) {
  if (v === '' || v === null) return null;
  if (typeof v === 'string') return ROOM_FN[v] ? { type: v } : undefined;
  if (!v || typeof v !== 'object' || !ROOM_FN[v.type]) return undefined;
  if (!Array.isArray(v.items)) return { type: v.type };
  return { type: v.type, items: v.items.filter(function (q) { return q && FURN[q.it] && [q.x, q.y].every(function (n) { return Number.isInteger(n) && n >= 0 && n < 400; }); }).map(function (q) { return { it: q.it, x: q.x, y: q.y, r: q.r ? 1 : 0 }; }) };
}
/** 艙房的擺法 { 船型: { 房名: '' ＝ 空著｜{ type }（自動擺滿）｜{ type, items } } }：diff ＝ 只留跟設定檔的預設不一樣的（存檔）；否則每一型玩家改過的全部（匯出）。 */
function roomsSnap(diff) {
  var o = {};
  Object.keys(SHIP_ROOMS).forEach(function (id) {
    var d = roomPlanDefault(id), p = SHIP_ROOMS[id], r = {};
    Object.keys(p).forEach(function (k) { if (!diff || JSON.stringify(p[k] || null) !== JSON.stringify(d[k] || null)) r[k] = p[k] || ''; });
    if (Object.keys(r).length) o[id] = r;
  });
  return o;
}
/** 船員配置：diff ＝ 只留跟那一型的預設不一樣的（存檔）；否則每一型整份（匯出）。 */
function crewSnap(diff) {
  var o = {};
  HULL_LIST.forEach(function (h) {
    var id = h.id, d = crewDefault(id), c = shipCrew(id), r = {}, g = {};
    CREW_ITEMS.forEach(function (it) { if (!diff || c[it.k] !== d[it.k]) r[it.k] = c[it.k]; });
    Object.keys(GUNS).forEach(function (t) { if (diff ? gunCrew(c, t) !== gunCrew(d, t) : true) g[t] = gunCrew(c, t); });
    if (Object.keys(g).length) r.guns = g;
    if (Object.keys(r).length) o[id] = r;
  });
  return o;
}
/** 匯出（船隻配置頁）：每一型整份的船隻設定與船員配置 ⇒ JSON 檔（換瀏覽器、換裝置再匯入；Tim 2026-10-14：編起來很花時間，要記錄）。 */
function shipsExport() {
  var cfg = {};
  HULL_LIST.forEach(function (h) { var c = cfgCopy(h.id), T = HULLT[h.id]; if (c.ballast === undefined || !T) { delete c.ballast; if (PREF_BALLAST[h.id]) { c.ballast = PREF_BALLAST[h.id].v; c.chk = PREF_BALLAST[h.id].chk; } } else c.chk = T.h.checksum; cfg[h.id] = c; });
  return { game: 'ame_constitution_broadside', kind: 'ships', v: 1, at: new Date().toISOString(), cfg: cfg, crew: crewSnap(false), rooms: roomsSnap(false) };
}
/** 匯入：看得懂才套（game／kind 對得上）；回傳套了幾型。 */
function shipsImport(o) {
  if (!o || o.game !== 'ame_constitution_broadside' || o.kind !== 'ships') return -1;
  var ids = {}; [o.cfg, o.crew, o.rooms].forEach(function (m) { if (m && typeof m === 'object') Object.keys(m).forEach(function (id) { if (hullInfo(id)) ids[id] = 1; }); });
  shipsApply(o); return Object.keys(ids).length;
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
/** 細節設定的「重設預設值」：那一頁回到預設之後馬上存（船隻配置頁的不動：TASK-0570）。 */
function prefsReset() { PREFS.last = ''; prefsSave(); }
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
  if (typeof distShow === 'function') distShow();
  $('autoF').classList.toggle('on', AUTOFIRE);
  if (!PREFS.write) return;
  setInterval(prefsSave, 1000);
  window.addEventListener('pagehide', prefsSave);
  document.addEventListener('visibilitychange', function () { if (document.hidden) prefsSave(); });
})();
