// ───────────────────────── 全域狀態與選單設定（網址參數、滑桿上下限、降旗規則、模式） ─────────────────────────
var QIDX = null;                                   // 四邊形索引（每種船共用）；船型的資料在 05_hull.js
var SHIPS = [], PIECES = [], BALLS = [], EVENTS = [], FLY = [], PLAYER_I = 0;
// 選單的滑桿：[下限, 上限, 預設]。網址參數與滑桿共用這一組（⛔ 各一組 ⇒ ?demo 跑的不是網址寫的那組）；讀不懂的值 ⇒ 預設
// 值住在 config/game.json 的 lim（TASK-0542 設定後台）；各鍵的意思：
//   hard flood ballast gunw speed agile upwind：船隻設定（下面 SHIP_KEYS）；cas：降旗的死傷比例
//   gunhp sailhp crewhp powderhp：血量（砲／帆／船員／火藥桶；火藥桶拉滿上限 ＝ 不會爆）；blast：殉爆威力；blastv：每次爆炸的威力浮動 ±
//   dmg12 dmg6 dmg3c：12 磅長砲、6 磅砲、3 磅追擊砲（風暴角號，TASK-0547；預設照彈重內插：4 磅 35、18 磅 70、24 磅 100）
//   dmgtr：三叉戟砲（三叉戟號船頭的奇幻三管速射砲，gura 酒館 24555；一發 18 磅 ⇒ 70）
//   dmg24 dmg32l dmg32 dmg18 dmg4：每發傷害（24 磅長砲、32 磅長砲（餘燼號）、32 磅 carronade、18 磅追擊砲、4 磅砲（夜隼號））
//   box：砲旁藥箱放幾份；carry：送藥手一次搬幾份；wind：帆的風壓；hands：預備水手（每艘幾個人物，42_hands.js）；drown：溺水時間（秒，43_swim.js）
//   sea：浪的大小（0 平靜、1 中浪、3 大浪）；stall：頂風失速（0 只是慢、1 寫實）；funspeed funagile funstall funpowder：娛樂加成（玩法選娛樂時再乘）
var LIM = CFG.lim;
function qnum(k, lim) { var v = parseFloat(Q.get(k)); return isFinite(v) ? clamp(v, lim[0], lim[1]) : lim[2]; }
// 玩法（Tim 2026-10-13：配置分成寫實與娛樂兩組，主選單切換，預設娛樂）：細節設定的滑桿 ＝ 寫實的基準，
//   娛樂 ＝ 在那之上再乘娛樂加成（航速、靈活性、頂風失速）。⇒ 兩組共用同一份滑桿，切換不會把調好的數字蓋掉。網址 ?play=real／fun
var PLAY = Q.has('play') ? (Q.get('play') === 'real' ? 'real' : 'fun') : CFG.menu.play;   // 沒給 ⇒ 設定檔的預設（menu.play）
var STALL_K = qnum('stall', LIM.stall);
var FUN = { speed: qnum('funspeed', LIM.funspeed), agile: qnum('funagile', LIM.funagile), stall: qnum('funstall', LIM.funstall), powder: qnum('funpowder', LIM.funpowder) };
function playK(k) { return PLAY === 'fun' ? FUN[k] : 1; }
// 船隻設定（照船型套；Tim 2026-10-12：不同船套用不同設定）：每一型一組，開戰時複製到每艘船（sh.cfg）。
//   hard  船殼硬度倍率（越硬越難打穿、洞越小；被打的那艘照自己的）：預設 3（Tim：原本 2 ⇒ 1.5 倍）
//   flood 進水速度倍率（0 ＝ 不會沉）
//   ballast 壓艙物（噸）：不會被打掉的重量；預設 ＝ 那一型「剛好在設計水線」（T.ballast0：憲法號 1,075），越輕浮得越高（減重上浮，32_hull.js）
//   gunw  砲的重量倍率（照實 ＝ 1：長砲 2.5 噸、carronade 0.9、追擊砲 2.1）：越重 ⇒ 吃水越深、砲被打飛浮得越多
//   speed 航速倍率（乘在 VMAX 上）；agile 靈活性倍率（乘在最大轉向率上；跟航速倍率分開 —— 轉向率用的是除掉倍率的航速）。玩法選娛樂 ⇒ 兩個再乘娛樂加成（playK）
//   upwind 逆風性能（31_sailing.js）：風從船頭那一半（迎風、頂風）的角度照它壓縮 ⇒ 同一個角度跑得快、吃風更近（失速晚開始）、越接近頂風轉得越快（最多 ×它）；1 ＝ 照舊
// 起始值 ＝ 網址參數（?hard= …，套到每一型）或 LIM 的預設；壓艙物網址沒給 ⇒ 存檔裡那一型的（同一份船才算，69_prefs.js）⇒ 那一型的 ballast0（船型載好才知道）。
//   base  基底航速（節；31_sailing.js；Tim 2026-10-14：風暴角號是幽靈船、之後的蒸汽船）：額外動力帶來的航速 —— 不管風向、風速、掛幾面帆都有，
//         跟帆的航速脫鉤（不乘 speed、玩法加成、天氣）；實際航速 ＝ √(帆的航速² ＋ 它²)：兩種動力的推力相加（蒸汽帆船；阻力 ∝ 速度²、各自單獨能跑到的航速就是那份推力 ⇒ 推力相加 ＝ 平方相加）。0 ＝ 沒有 ⇒ 照舊
var SHIP_KEYS = ['hard', 'flood', 'ballast', 'gunw', 'speed', 'agile', 'upwind', 'base'], SHIP_CFG = {};
// 船型自己的預設（沒列的 ＝ LIM 的預設）。Tim 2026-10-13：憲法號要比餘燼號快、靈活 ⇒ 憲法號照舊 1（巡防艦），
//   餘燼號是兩層砲甲板、90 門砲的重船 ⇒ 航速 0.85、靈活 0.7。網址參數（?speed= …）照舊套到每一型。
//   夜隼號（Tim 2026-10-13：「速度更快、更靈活，彌補火力劣勢」「加強逆風航速與轉彎，彌補火力跟防禦不足」「材質硬度兩倍試試」）：
//   12 門 4 磅砲的雙桅小船（brigantine：主桅縱帆，吃風比全橫帆的船近）⇒ 航速 1.2、靈活 1.6、逆風 1.25、硬度 6（預設 3 的兩倍）。
//   值住在 config/game.json 每艘船的 cfg（TASK-0542）。
var HULL_CFG0 = {}; CFG.ships.forEach(function (s) { if (s.cfg) HULL_CFG0[s.id] = s.cfg; });
function cfgBase(k, id) { var d = HULL_CFG0[id]; return d && d[k] !== undefined ? d[k] : LIM[k][2]; }
var PREF_BALLAST = {};                                   // 存檔裡的壓艙物：id → { v: 噸, chk: 存的時候那艘船的 checksum }（船重匯過 ⇒ 不套）
function cfgDefault(k, T, id) {
  if (k !== 'ballast') return Q.has(k) ? qnum(k, LIM[k]) : cfgBase(k, id);
  if (Q.has('ballast')) return Math.round(qnum('ballast', LIM.ballast));
  var pb = T && PREF_BALLAST[T.id];
  if (pb && pb.chk === T.h.checksum) return pb.v;
  return T && isFinite(T.ballast0) ? T.ballast0 : LIM.ballast[2];
}
/** 那一型的設定（第一次用到才建；壓艙物等船型載好才填）。 */
function shipCfg(id) {
  var c = SHIP_CFG[id];
  if (!c) { c = SHIP_CFG[id] = {}; SHIP_KEYS.forEach(function (k) { if (k !== 'ballast') c[k] = cfgDefault(k, null, id); }); }
  if (c.ballast === undefined && HULLT[id]) c.ballast = cfgDefault('ballast', HULLT[id]);
  return c;
}
function cfgCopy(id) { var c = shipCfg(id), o = {}; SHIP_KEYS.forEach(function (k) { o[k] = c[k]; }); return o; }
var GUN_HP = Math.round(qnum('gunhp', LIM.gunhp));          // 砲的血量（舵輪 6 成）：預設 200 ⇒ 24 磅實心兩發（Tim 2026-10-12：100 太脆，翻倍）
var SAIL_HP = Math.round(qnum('sailhp', LIM.sailhp));       // 帆的血量
var CREW_HP = Math.round(qnum('crewhp', LIM.crewhp));       // 船員的血量：歸零陣亡、掉到一半以下受傷倒下、一半以上照常作戰（只閃紅）
var POWDER_HP = Math.round(qnum('powderhp', LIM.powderhp)); // 火藥桶的血量：歸零殉爆；拉滿（LIM 上限）＝ 不會爆；預設 675 ＝ 很難但有機率
var BLAST_K = qnum('blast', LIM.blast);                             // 殉爆威力倍率（能量；爆炸半徑 ∝ 立方根）
var BLAST_V = qnum('blastv', LIM.blastv);                           // 每一次爆炸（火藥桶、彈藥庫、藥包）的威力再乘 1 ± 這個數之間的亂數（23_powder.js blastRoll）
var BOX_N = Math.round(qnum('box', LIM.box)), CARRY_N = Math.round(qnum('carry', LIM.carry));   // 砲旁藥箱容量、送藥手一次搬幾份（火藥與彈藥一份 ＝ 裝填一次）
var HANDS = Math.round(qnum('hands', LIM.hands));                  // 預備水手：缺人手時補位（42_hands.js）
var HEAL_T = Math.round(qnum('heal', LIM.heal));                  // 醫療艙：治好一個傷員要幾秒（滿人手、沒有 buff；0 ＝ 關 ⇒ 傷員照舊 12 秒抬下去；44_medic.js）
var NAV_RE = qnum('navre', LIM.navre);                              // 尋路動態更新：每幾秒看一次有沒有甲板、梯子被打壞（0 ＝ 關；42_hands.js navRefresh；TASK-0572）
var DROWN_T = Math.round(qnum('drown', LIM.drown));                // 落水求生：浮上水面、往自己的船游，撐這麼久（× 0.6～1.2）就溺水（43_swim.js）
var SEA_K = qnum('sea', LIM.sea);                                   // 浪的大小（08_sea.js；物理與畫面共用）
var WIND_K = qnum('wind', LIM.wind);                                // 帆的風壓倍率（只管物理開著時帆被吹成什麼樣子；不改航速）
function powderNever() { return POWDER_HP >= LIM.powderhp[1]; }      // 拉滿 ＝ 不會爆：兩種玩法都是（娛樂的倍率不管它）
function powderHP() { return Math.round(POWDER_HP * playK('powder')); }   // 實際的火藥血量：娛樂再乘 FUN.powder（預設 675 ⇒ 300）
// 每發傷害（砲種）：砲彈開火時帶著 b.dmg
var DMG = { long12: Math.round(qnum('dmg12', LIM.dmg12)), long6: Math.round(qnum('dmg6', LIM.dmg6)), chase3: Math.round(qnum('dmg3c', LIM.dmg3c)), trident: Math.round(qnum('dmgtr', LIM.dmgtr)), long: Math.round(qnum('dmg24', LIM.dmg24)), long32: Math.round(qnum('dmg32l', LIM.dmg32l)), carr: Math.round(qnum('dmg32', LIM.dmg32)), chase: Math.round(qnum('dmg18', LIM.dmg18)), long4: Math.round(qnum('dmg4', LIM.dmg4)) };
// 彈種倍率（%）：列 ＝ 實心／爆裂／鏈彈，欄 ＝ 對砲（模型：砲、舵輪、火藥桶）／對帆／對人。網址 ?ammo= 九個數字（照列）
var AMMO_LIM = CFG.ammo.lim, AMMO_K0 = CFG.ammo.k;   // config/game.json 的 ammo（上下限、預設）。爆裂對人原訂 115：量過死亡平均 42（舊版 27）⇒ 100（35，傷亡合計 62 對舊版 65）
var AMMO_K = AMMO_K0.map(function (r) { return r.slice(); });
if (Q.has('ammo')) Q.get('ammo').split(',').forEach(function (w, i) { var v = parseFloat(w); if (i < 9 && isFinite(v)) AMMO_K[(i / 3) | 0][i % 3] = clamp(Math.round(v), AMMO_LIM[0], AMMO_LIM[1]); });
var VS_GUN = 0, VS_SAIL = 1, VS_CREW = 2;
function ammoK(ammo, vs) { return AMMO_K[ammo][vs] / 100; }
// 降旗規則（選單設定）：死傷比例到 cas 就降旗（1 ＝ 全員倒下才停）；三個勾選各自是另一條。預設 ＝ 不降旗，打到沉或全員倒下。
// 網址：?strike=60,guns,masts,officers（數字是死傷百分比，後面列出要勾的規則）
var STRIKE = { cas: LIM.cas[2], guns: false, masts: false, officers: false };
if (Q.has('strike')) Q.get('strike').split(',').forEach(function (w) {
  var v = parseFloat(w);
  if (isFinite(v)) STRIKE.cas = clamp(v / 100, LIM.cas[0], LIM.cas[1]);
  else if (w === 'guns' || w === 'masts' || w === 'officers') STRIKE[w] = true;
});
// 砲長（51_captain.js）：[我艦, 敵艦]，random ＝ 開局抽；網址 ?cap=sink,mast
var CAP_SET = ['random', 'random'];
if (Q.has('cap')) Q.get('cap').split(',').forEach(function (w, i) { if (i < 2) CAP_SET[i] = w; });
var LAST_MODE = null;                                // 上一場的模式（自動開砲換了模式才套預設，見 reset）
// DIST：開局兩邊船頭相距幾公尺（主選單滑桿，範圍 LIM_DIST；網址 ?dist=）。Tim 2026-10-13：「距離改成滑桿、50～1000 m」「兩邊船頭相對互相接近，而不是直接橫排一開場就開砲」。
//   電腦想保持的交戰距離另算（aiRange，31_sailing.js：夾在 90～220 m；⛔ 照 DIST ⇒ 開局 1000 m 時電腦在 1000 m 外繞圈、打不到）。
var LIM_DIST = CFG.dist;                              // config/game.json 的 dist：[下限, 上限, 預設]
var MODE = CFG.menu.mode, DIST = Q.has('dist') && isFinite(+Q.get('dist')) ? clamp(Math.round(+Q.get('dist')), LIM_DIST[0], LIM_DIST[1]) : LIM_DIST[2], SIMT = 0, RUNNING = false, PAUSED = false, OVER = false, AMMO_I = 0;
var SAIL = Q.has('sail') ? (Q.get('sail') === 'off' ? 'off' : Q.get('sail') === 'manual' ? 'manual' : 'auto') : CFG.menu.sail;   // 航行：auto ＝ 兩艘自動、manual ＝ 我艦手動、off ＝ 停船；沒給 ⇒ menu.sail
var KEYS = { l: false, r: false, f: null, b: null };  // 手動操舵：按住的舵鍵；f／b ＝ 加帆（W）／收帆（S）按下那一刻的 SIMT（按住 ⇒ 額外動力的油門 前進／倒車，31_sailing.js；放開 ⇒ null）
// 殉爆的慢動作與特寫（73_slowmo.js）：on／cam 是設定；ts 現在的時間倍率。SLOW_VIS：這一格畫面裡只給人看的效果改由 frame 走（step() 讀它決定要不要跳過）
var PSLOW = { on: Q.get('pslow') === '1', ts: 1, ms: 0, budget: qnum('pslowb', LIM.pslowb) };   // 物理減速（73_slowmo.js；Tim 2026-10-14：預設關）：ts ＝ 現在的倍率、ms ＝ 一步模擬平均幾毫秒、budget ＝ 門檻（模擬最多佔真實時間幾成）
var SLOW = { on: Q.get('slowmo') !== '0', cam: Q.get('slowcam') !== '0', ts: 1, t: 0, min: 1, hold: 0, active: false, camSave: null, camT: 0, camMode: 0, kicks: 0 }, SLOW_VIS = false;
var AUTOFIRE = false;                                  // 自動開砲：電腦替我艦瞄準、開火（觀戰 ＝ 一般戰鬥＋自動開砲預設開；G 切換）
var PHYS = Q.get('phys') !== '0';                      // 帆與繩的物理（選單勾選、B 鍵、下方按鈕；?phys=0 關）：關 ＝ 靜態，跟以前一樣

