/* 憲法號對轟 —— 遊戲本體（體素的解碼、網格、算繪、射線、連通在 VoxelKit）。
 * 世界：公尺、Y 朝上、海面 y = 0。船的格座標 (x 船長、y 船寬、z 高) ⇒ 船體座標 (x, z, −y)（行列式 +1，繞序不翻）。
 * 同一型的兩艘共用一份 1:1 資料（船型 sh.T，05_hull.js），被打到的區塊才各自複製（VoxelKit.Grid.share）。
 * 模擬固定步長 1/60 秒、亂數有種子 ⇒ ?demo=<秒>&seed=<n> 每次快轉出同一格（縮圖與驗收用）。
 *
 * 拆檔：js/ 底下照功能分檔，檔名前面的數字就是順序。template.html 照這個順序列出（每檔一個帶 data-bundle="game" 的 script 標籤），
 *   vxk_inline.py 把同一個 bundle 接成一段、包進同一個閉包（(function () { 'use strict'; … })()）⇒ 各檔共用變數與函式，
 *   跟沒拆之前是同一個作用域；不會掛到 window、不會跟瀏覽器的全域名字撞。
 *   ⛔ 各檔沒有自己的作用域：新的頂層名字先搜一遍有沒有撞名（以前 IIFE 裡也撞過：船員的 kill 蓋掉碎屑的 kill）。
 *   ⛔ 頂層的敘述照檔案順序執行：要在載入時就跑的（讀網址、建 GL）放在用到它的檔之前。
 */
var VK = window.VoxelKit, M4 = VK.M4;
var Q = new URLSearchParams(location.search);
var DEMO = Q.has('demo') ? Math.max(0, parseFloat(Q.get('demo')) || 0) : -1;
var STILL = Q.get('still') === '1', DEBUG = Q.get('debug') === '1';
var SEED = (parseInt(Q.get('seed'), 10) >>> 0) || 1797;
var CAMQ = Q.get('cam') || '';
// 逐幀分段計時（?debug=1 才有；TASK-0531 找卡頓）：每一格畫面各段花幾 ms（模擬每一步的各段累加），留最近 PF.max 格；__game.frames() 讀最慢的幾格。
//   pfLap(k)：從上一個 lap（或這一段的起點 PF.t）到現在的時間記到 k。沒開 debug ⇒ PF ＝ null，呼叫端一個判斷就跳過。
var PF = DEBUG ? { t: 0, cur: {}, ring: [], max: 1200 } : null;
function pfLap(k) { var t = performance.now(); PF.cur[k] = (PF.cur[k] || 0) + t - PF.t; PF.t = t; }
function pfEnd(f0, steps) { var c = PF.cur; c.total = performance.now() - f0; c.steps = steps; c.simt = SIMT; PF.ring.push(c); if (PF.ring.length > PF.max) PF.ring.shift(); PF.cur = {}; }
if (STILL) document.getElementById('stage').classList.add('still');
function $(id) { return document.getElementById(id); }

// ───────────────────────── 亂數（有種子） ─────────────────────────
var rs = SEED;
function rnd() { rs |= 0; rs = rs + 0x6D2B79F5 | 0; var t = Math.imul(rs ^ rs >>> 15, 1 | rs); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function rr(a, b) { return a + (b - a) * rnd(); }
function gauss() { var u = rnd() || 1e-9, v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2831853 * v); }
function hash3(x, y, z) { var h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

// ───────────────────────── 常數 ─────────────────────────
// 同時在場最多幾艘船（TASK-0537；Tim 2026-10-13：上限 4 ⇒ 8）—— 設定後台調（TASK-0542：config/game.json 的 limits）。
// 每一格只給「視野裡離鏡頭最近的幾艘」GPU 的格（Tim 2026-10-13「優先選最近的 N 條船，超過的就沒陰影＆遮罩」「超過的靠全局覆蓋」「只選視野範圍內最近的」；60_render.js gpuSlots）：
//   · 自己的陰影圖：最近的 GFX.shships 艘（畫質設定「陰影船數」0～MAX_SHIPS，最高畫質 ＝ MAX_SHIPS）；其他的船畫進一張罩住它們的全局陰影圖（解析度低）。
//   · 船艙遮罩（與透視）：最近的 MASK_NEAR 艘；其他的沒有（遠處看不到艙裡）。
//   陰影圖、船艙遮罩都是貼圖陣列（各佔一個單元：陰影第 4 號、遮罩第 1 號）⇒ 船數不受貼圖單元限制。
// FLEET_MAX：編成最多幾艘（主選單；Tim 2026-10-13「編成可以設高一點」）—— 同時在場的最多 FIELD_N 艘（主選單滑桿 2～MAX_SHIPS），其他的候補（52_fleet.js）。
var MAX_SHIPS = CFG.limits.maxShips, MASK_NEAR = CFG.limits.maskNear, FLEET_MAX = CFG.limits.fleetMax;   // 預設 8／4／40
var DT = 1 / 60, G = 9.81, V0 = 175, ZW0 = 63;    // ZW0：沒有 meta 時的設計水線（憲法號吃水 63 格，basecamp 的下水段同一個數）；每種船的在 T.zw
var RELOAD = 7, RELOAD_SANDBOX = 1.6;
var AMMO = ['實心彈', '爆裂彈', '鏈彈'];
var S;                                            // 公尺／格（封裝檔的 header；每種船都要一樣）。中線、外框、水線…每種船各一份：sh.T（05_hull.js）
var SUN = norm([-0.45, 0.62, -0.38]), SKY = [0.42, 0.58, 0.80], HORIZON = [0.80, 0.80, 0.77], GROUND = [0.30, 0.27, 0.22];
var WIND = [0.6, 0, 1.65];   // 風往哪吹（m/s，煙飄的速度）；方向也是航行的風向：開局兩艘的航向跟它大致垂直（橫風起跑）

function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function len(a) { return Math.hypot(a[0], a[1], a[2]); }
function rotM(axis, ang) {          // 繞任意軸的 mat4
  var a = norm(axis), c = Math.cos(ang), s = Math.sin(ang), t = 1 - c, x = a[0], y = a[1], z = a[2];
  return new Float32Array([t * x * x + c, t * x * y + s * z, t * x * z - s * y, 0, t * x * y - s * z, t * y * y + c, t * y * z + s * x, 0,
    t * x * z + s * y, t * y * z - s * x, t * z * z + c, 0, 0, 0, 0, 1]);
}
function trans(x, y, z) { var m = M4.ident(); m[12] = x; m[13] = y; m[14] = z; return m; }

