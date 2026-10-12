// ───────────────────────── 全域狀態與選單設定（網址參數、滑桿上下限、降旗規則、模式） ─────────────────────────
var BASE = null, PRISTINE = null, QIDX = null, MODEL = null, RIG = null;
var SHIPS = [], PIECES = [], BALLS = [], EVENTS = [], FLY = [], PLAYER_I = 0;
// 選單的滑桿：[下限, 上限, 預設]。網址參數與滑桿共用這一組（⛔ 各一組 ⇒ ?demo 跑的不是網址寫的那組）；讀不懂的值 ⇒ 預設
var LIM = { hard: [0.5, 20, 2], flood: [0, 2, 0.35], cas: [0.1, 1, 1], speed: [0.25, 3, 1], agile: [0.25, 3, 1],
  gunhp: [1, 10, 1], sailhp: [1, 10, 1], powderhp: [1, 11, 11], blast: [0.25, 4, 1] };   // 細節設定頁：砲／帆／火藥桶的耐久（整數）、殉爆威力
function qnum(k, lim) { var v = parseFloat(Q.get(k)); return isFinite(v) ? clamp(v, lim[0], lim[1]) : lim[2]; }
var HARDK = qnum('hard', LIM.hard);     // 船殼硬度倍率（越硬越難打穿、洞越小）
var FLOOD = qnum('flood', LIM.flood);   // 進水速度倍率（0 ＝ 不會沉）
var SPEEDK = qnum('speed', LIM.speed);  // 航速倍率（乘在 VMAX 上）
var AGILK = qnum('agile', LIM.agile);   // 靈活性倍率（乘在最大轉向率上；跟航速倍率分開 —— 轉向率用的是除掉倍率的航速）
var GUN_HP = Math.round(qnum('gunhp', LIM.gunhp));          // 砲的耐久：被打中幾下才毀（1 ＝ 一打就飛，跟以前一樣）
var SAIL_HP = Math.round(qnum('sailhp', LIM.sailhp));       // 帆的耐久：被鏈彈打中幾次才掉（1 ＝ 一中就掉，跟以前一樣）
var POWDER_HP = Math.round(qnum('powderhp', LIM.powderhp)); // 火藥桶的耐久：打中幾下才殉爆；拉滿（LIM 上限）＝ 不會爆（預設）—— 彈藥庫模型上船後才生效
var BLAST_K = qnum('blast', LIM.blast);                     // 殉爆威力倍率 —— 同上
function powderNever() { return POWDER_HP >= LIM.powderhp[1]; }
// 降旗規則（選單設定）：死傷比例到 cas 就降旗（1 ＝ 全員倒下才停）；三個勾選各自是另一條。預設 ＝ 不降旗，打到沉或全員倒下。
// 網址：?strike=60,guns,masts,officers（數字是死傷百分比，後面列出要勾的規則）
var STRIKE = { cas: LIM.cas[2], guns: false, masts: false, officers: false };
if (Q.has('strike')) Q.get('strike').split(',').forEach(function (w) {
  var v = parseFloat(w);
  if (isFinite(v)) STRIKE.cas = clamp(v / 100, LIM.cas[0], LIM.cas[1]);
  else if (w === 'guns' || w === 'masts' || w === 'officers') STRIKE[w] = true;
});
var MODE = 'pve', DIST = 140, SIMT = 0, RUNNING = false, PAUSED = false, OVER = false, AMMO_I = 0;
var SAIL = Q.get('sail') === 'off' ? 'off' : Q.get('sail') === 'manual' ? 'manual' : 'auto';   // 航行：auto ＝ 兩艘自動（預設）、manual ＝ 我艦手動、off ＝ 停船
var KEYS = { l: false, r: false };                    // 手動操舵：按住的舵鍵
var AUTOFIRE = false;                                  // 自動開砲：電腦替我艦瞄準、開火（觀戰 ＝ 一般戰鬥＋自動開砲預設開；G 切換）
var PHYS = Q.get('phys') !== '0';                      // 帆與繩的物理（選單勾選、B 鍵、下方按鈕；?phys=0 關）：關 ＝ 靜態，跟以前一樣

