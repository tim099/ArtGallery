// ───────────────────────── 全域狀態與選單設定（網址參數、滑桿上下限、降旗規則、模式） ─────────────────────────
var BASE = null, PRISTINE = null, QIDX = null, MODEL = null, RIG = null;
var SHIPS = [], PIECES = [], BALLS = [], EVENTS = [], FLY = [], PLAYER_I = 0;
// 選單的滑桿：[下限, 上限, 預設]。網址參數與滑桿共用這一組（⛔ 各一組 ⇒ ?demo 跑的不是網址寫的那組）；讀不懂的值 ⇒ 預設
var LIM = { hard: [0.5, 20, 3], flood: [0, 2, 0.35], ballast: [0, 2000, 1075], gunw: [0, 5, 1], cas: [0.1, 1, 1], speed: [0.25, 3, 1], agile: [0.25, 3, 1],
  // 細節設定頁：血量（砲／帆／船員／火藥桶）、每發傷害（砲種）、殉爆威力。火藥桶預設 675（很難殉爆但有機率；Tim 2026-10-12：450 還是很容易炸 ⇒ 1.5 倍），拉滿 1000 ＝ 不會爆
  gunhp: [20, 500, 200], sailhp: [20, 500, 100], crewhp: [20, 300, 100], powderhp: [20, 1000, 675], blast: [0.25, 4, 1],
  dmg24: [10, 300, 100], dmg32: [10, 300, 120], dmg18: [10, 300, 70],
  box: [1, 8, 2], carry: [1, 6, 1], wind: [0.25, 3, 1] };                                   // 補給：砲旁藥箱放幾份、送藥手一次搬幾份（Tim：可以一次存 n 發）
function qnum(k, lim) { var v = parseFloat(Q.get(k)); return isFinite(v) ? clamp(v, lim[0], lim[1]) : lim[2]; }
var HARDK = qnum('hard', LIM.hard);     // 船殼硬度倍率（越硬越難打穿、洞越小）：預設 3（Tim 2026-10-12：原本 2 ⇒ 1.5 倍）
var FLOOD = qnum('flood', LIM.flood);   // 進水速度倍率（0 ＝ 不會沉）
var GUNW_K = qnum('gunw', LIM.gunw);    // 砲的重量倍率（照實 ＝ 1：長砲 2.5 噸、carronade 0.9、追擊砲 2.1）：越重 ⇒ 吃水越深、砲被打飛浮得越多（Tim 2026-10-12）
var BALLAST_T = Math.round(qnum('ballast', LIM.ballast));   // 壓艙物（噸）：不會被打掉的重量；預設 1,075 ⇒ 開戰時剛好在設計水線，越輕浮得越高（減重上浮，見 32_hull.js）
var SPEEDK = qnum('speed', LIM.speed);  // 航速倍率（乘在 VMAX 上）
var AGILK = qnum('agile', LIM.agile);   // 靈活性倍率（乘在最大轉向率上；跟航速倍率分開 —— 轉向率用的是除掉倍率的航速）
var GUN_HP = Math.round(qnum('gunhp', LIM.gunhp));          // 砲的血量（舵輪 6 成）：預設 200 ⇒ 24 磅實心兩發（Tim 2026-10-12：100 太脆，翻倍）
var SAIL_HP = Math.round(qnum('sailhp', LIM.sailhp));       // 帆的血量
var CREW_HP = Math.round(qnum('crewhp', LIM.crewhp));       // 船員的血量：歸零陣亡、掉到一半以下受傷倒下、一半以上照常作戰（只閃紅）
var POWDER_HP = Math.round(qnum('powderhp', LIM.powderhp)); // 火藥桶的血量：歸零殉爆；拉滿（LIM 上限）＝ 不會爆；預設 675 ＝ 很難但有機率
var BLAST_K = qnum('blast', LIM.blast);                             // 殉爆威力倍率（能量；爆炸半徑 ∝ 立方根）
var BOX_N = Math.round(qnum('box', LIM.box)), CARRY_N = Math.round(qnum('carry', LIM.carry));   // 砲旁藥箱容量、送藥手一次搬幾份（火藥與彈藥一份 ＝ 裝填一次）
var WIND_K = qnum('wind', LIM.wind);                                // 帆的風壓倍率（只管物理開著時帆被吹成什麼樣子；不改航速）
function powderNever() { return POWDER_HP >= LIM.powderhp[1]; }
// 每發傷害（砲種）：砲彈開火時帶著 b.dmg
var DMG = { long: Math.round(qnum('dmg24', LIM.dmg24)), carr: Math.round(qnum('dmg32', LIM.dmg32)), chase: Math.round(qnum('dmg18', LIM.dmg18)) };
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
var MODE = 'pve', DIST = 140, SIMT = 0, RUNNING = false, PAUSED = false, OVER = false, AMMO_I = 0;
var SAIL = Q.get('sail') === 'off' ? 'off' : Q.get('sail') === 'manual' ? 'manual' : 'auto';   // 航行：auto ＝ 兩艘自動（預設）、manual ＝ 我艦手動、off ＝ 停船
var KEYS = { l: false, r: false };                    // 手動操舵：按住的舵鍵
var AUTOFIRE = false;                                  // 自動開砲：電腦替我艦瞄準、開火（觀戰 ＝ 一般戰鬥＋自動開砲預設開；G 切換）
var PHYS = Q.get('phys') !== '0';                      // 帆與繩的物理（選單勾選、B 鍵、下方按鈕；?phys=0 關）：關 ＝ 靜態，跟以前一樣

