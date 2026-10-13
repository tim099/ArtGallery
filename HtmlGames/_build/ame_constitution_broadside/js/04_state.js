// ───────────────────────── 全域狀態與選單設定（網址參數、滑桿上下限、降旗規則、模式） ─────────────────────────
var QIDX = null;                                   // 四邊形索引（每種船共用）；船型的資料在 05_hull.js
var SHIPS = [], PIECES = [], BALLS = [], EVENTS = [], FLY = [], PLAYER_I = 0;
// 選單的滑桿：[下限, 上限, 預設]。網址參數與滑桿共用這一組（⛔ 各一組 ⇒ ?demo 跑的不是網址寫的那組）；讀不懂的值 ⇒ 預設
var LIM = { hard: [0.5, 20, 3], flood: [0, 2, 0.35], ballast: [0, 2000, 1075], gunw: [0, 5, 1], cas: [0.1, 1, 1], speed: [0.25, 3, 1], agile: [0.25, 3, 1],
  // 細節設定頁：血量（砲／帆／船員／火藥桶）、每發傷害（砲種）、殉爆威力。火藥桶預設 675（很難殉爆但有機率；Tim 2026-10-12：450 還是很容易炸 ⇒ 1.5 倍），拉滿 1000 ＝ 不會爆
  gunhp: [20, 500, 200], sailhp: [20, 500, 100], crewhp: [20, 300, 100], powderhp: [20, 1000, 675], blast: [0.25, 4, 1], blastv: [0, 0.9, 0.4],   // blastv：每次爆炸的威力浮動 ±（Tim 2026-10-13：自爆太固定）
  dmg24: [10, 300, 100], dmg32l: [10, 300, 130], dmg32: [10, 300, 120], dmg18: [10, 300, 70],   // dmg32l：32 磅長砲（餘燼號）
  box: [1, 8, 2], carry: [1, 6, 1], wind: [0.25, 3, 1],                                     // 補給：砲旁藥箱放幾份、送藥手一次搬幾份（Tim：可以一次存 n 發）
  hands: [0, 120, 40],                                                                        // 預備水手（每艘幾個人物；0 ＝ 沒有，42_hands.js）
  drown: [0, 120, 45],                                                                        // 溺水時間（秒；落水、被水淹過頭的人撐多久，43_swim.js；0 ＝ 照以前：落水當場算陣亡）
  sea: [0, 3, 1],                                                                             // 浪的大小（08_sea.js）：0 ＝ 平靜、1 ＝ 中浪（浪高約 1–2 m）、3 ＝ 大浪
  stall: [0, 1, 1],                                                                           // 頂風失速（31_sailing.js）：0 ＝ 頂風只是慢、1 ＝ 寫實
  funspeed: [1, 3, 1.4], funagile: [1, 3, 1.5], funstall: [0, 1, 0.4],                       // 娛樂加成：玩法選「娛樂」時再乘的倍率（寫實 ＝ 都是 1）
  funpowder: [0.1, 1, 4 / 9] };                                                               // 火藥血量（Tim 2026-10-13：娛樂 300 剛好 —— 觸發得了殉爆、又不會太頻繁）：675 × 4/9 ＝ 300
function qnum(k, lim) { var v = parseFloat(Q.get(k)); return isFinite(v) ? clamp(v, lim[0], lim[1]) : lim[2]; }
// 玩法（Tim 2026-10-13：配置分成寫實與娛樂兩組，主選單切換，預設娛樂）：細節設定的滑桿 ＝ 寫實的基準，
//   娛樂 ＝ 在那之上再乘娛樂加成（航速、靈活性、頂風失速）。⇒ 兩組共用同一份滑桿，切換不會把調好的數字蓋掉。網址 ?play=real／fun
var PLAY = Q.get('play') === 'real' ? 'real' : 'fun';
var STALL_K = qnum('stall', LIM.stall);
var FUN = { speed: qnum('funspeed', LIM.funspeed), agile: qnum('funagile', LIM.funagile), stall: qnum('funstall', LIM.funstall), powder: qnum('funpowder', LIM.funpowder) };
function playK(k) { return PLAY === 'fun' ? FUN[k] : 1; }
// 船隻設定（照船型套；Tim 2026-10-12：不同船套用不同設定）：每一型一組，開戰時複製到每艘船（sh.cfg）。
//   hard  船殼硬度倍率（越硬越難打穿、洞越小；被打的那艘照自己的）：預設 3（Tim：原本 2 ⇒ 1.5 倍）
//   flood 進水速度倍率（0 ＝ 不會沉）
//   ballast 壓艙物（噸）：不會被打掉的重量；預設 ＝ 那一型「剛好在設計水線」（T.ballast0：憲法號 1,075），越輕浮得越高（減重上浮，32_hull.js）
//   gunw  砲的重量倍率（照實 ＝ 1：長砲 2.5 噸、carronade 0.9、追擊砲 2.1）：越重 ⇒ 吃水越深、砲被打飛浮得越多
//   speed 航速倍率（乘在 VMAX 上）；agile 靈活性倍率（乘在最大轉向率上；跟航速倍率分開 —— 轉向率用的是除掉倍率的航速）。玩法選娛樂 ⇒ 兩個再乘娛樂加成（playK）
// 起始值 ＝ 網址參數（?hard= …，套到每一型）或 LIM 的預設；壓艙物網址沒給 ⇒ 存檔裡那一型的（同一份船才算，69_prefs.js）⇒ 那一型的 ballast0（船型載好才知道）。
var SHIP_KEYS = ['hard', 'flood', 'ballast', 'gunw', 'speed', 'agile'], SHIP_CFG = {};
var PREF_BALLAST = {};                                   // 存檔裡的壓艙物：id → { v: 噸, chk: 存的時候那艘船的 checksum }（船重匯過 ⇒ 不套）
function cfgDefault(k, T) {
  if (k !== 'ballast') return qnum(k, LIM[k]);
  if (Q.has('ballast')) return Math.round(qnum('ballast', LIM.ballast));
  var pb = T && PREF_BALLAST[T.id];
  if (pb && pb.chk === T.h.checksum) return pb.v;
  return T && isFinite(T.ballast0) ? T.ballast0 : LIM.ballast[2];
}
/** 那一型的設定（第一次用到才建；壓艙物等船型載好才填）。 */
function shipCfg(id) {
  var c = SHIP_CFG[id];
  if (!c) { c = SHIP_CFG[id] = {}; SHIP_KEYS.forEach(function (k) { if (k !== 'ballast') c[k] = cfgDefault(k); }); }
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
var DROWN_T = Math.round(qnum('drown', LIM.drown));                // 落水求生：浮上水面、往自己的船游，撐這麼久（× 0.6～1.2）就溺水（43_swim.js）
var SEA_K = qnum('sea', LIM.sea);                                   // 浪的大小（08_sea.js；物理與畫面共用）
var WIND_K = qnum('wind', LIM.wind);                                // 帆的風壓倍率（只管物理開著時帆被吹成什麼樣子；不改航速）
function powderNever() { return POWDER_HP >= LIM.powderhp[1]; }      // 拉滿 ＝ 不會爆：兩種玩法都是（娛樂的倍率不管它）
function powderHP() { return Math.round(POWDER_HP * playK('powder')); }   // 實際的火藥血量：娛樂再乘 FUN.powder（預設 675 ⇒ 300）
// 每發傷害（砲種）：砲彈開火時帶著 b.dmg
var DMG = { long: Math.round(qnum('dmg24', LIM.dmg24)), long32: Math.round(qnum('dmg32l', LIM.dmg32l)), carr: Math.round(qnum('dmg32', LIM.dmg32)), chase: Math.round(qnum('dmg18', LIM.dmg18)) };
// 彈種倍率（%）：列 ＝ 實心／爆裂／鏈彈，欄 ＝ 對砲（模型：砲、舵輪、火藥桶）／對帆／對人。網址 ?ammo= 九個數字（照列）
var AMMO_LIM = [0, 400], AMMO_K0 = [[100, 10, 100], [160, 10, 100], [50, 100, 100]];   // 爆裂對人原訂 115：量過死亡平均 42（舊版 27）⇒ 100（35，傷亡合計 62 對舊版 65）
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
var MODE = 'pve', DIST = 140, SIMT = 0, RUNNING = false, PAUSED = false, OVER = false, AMMO_I = 0;
var SAIL = Q.get('sail') === 'off' ? 'off' : Q.get('sail') === 'manual' ? 'manual' : 'auto';   // 航行：auto ＝ 兩艘自動（預設）、manual ＝ 我艦手動、off ＝ 停船
var KEYS = { l: false, r: false };                    // 手動操舵：按住的舵鍵
// 殉爆的慢動作與特寫（73_slowmo.js）：on／cam 是設定；ts 現在的時間倍率。SLOW_VIS：這一格畫面裡只給人看的效果改由 frame 走（step() 讀它決定要不要跳過）
var SLOW = { on: Q.get('slowmo') !== '0', cam: Q.get('slowcam') !== '0', ts: 1, t: 0, min: 1, hold: 0, active: false, camSave: null, camT: 0, camMode: 0, kicks: 0 }, SLOW_VIS = false;
var AUTOFIRE = false;                                  // 自動開砲：電腦替我艦瞄準、開火（觀戰 ＝ 一般戰鬥＋自動開砲預設開；G 切換）
var PHYS = Q.get('phys') !== '0';                      // 帆與繩的物理（選單勾選、B 鍵、下方按鈕；?phys=0 關）：關 ＝ 靜態，跟以前一樣

