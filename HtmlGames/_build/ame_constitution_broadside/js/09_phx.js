// ───────────────────────── 物理效果分級（TASK-0526） ─────────────────────────
// 主選單：全開／高／中／低（PHX_PRESET）；「物理設定…」頁一項一項調，跟四檔都對不上 ⇒ 主選單顯示「自訂」。
// 管的是「給人看的物理」：帆與繩（30_rig_physics.js）、碎木（12_effects.js 的碎片）、煙與水花（粒子）、船邊水花（13_water.js：船頭浪、船尾白沫、拍浪、擦撞與落水的水滴與白沫）；
//   以及進水（33_flood.js：公式或粒子 —— ⛔ 粒子會改戰局，Tim 要的：開了就完全由粒子判斷）。
//   ⛔ 浪不在這裡：浪的大小改戰局（砲彈打到浪頭、船的姿態），在細節設定。
// 戰局：
//   · 船邊水花：自己的亂數（rndW）、不回寫模擬；開著時原本的航跡與水花照樣抽亂數、只是不放（PT_MUTE）⇒ 開關不改戰局。
//   · 進水：粒子模式改戰局（進水量、下沉、傾斜照艙內的水），粗／中／細各自一局；開戰時決定（FLOOD_LV），戰鬥中改了下一場生效。
//   · 碎木、煙與水花少生幾顆不改戰局：照固定的節拍跳過（不抽亂數）。煙與水花的參數照樣由呼叫端抽完亂數（只是不放進去）；
//     碎木自己的亂數（轉軸、落水、落地）走另一條（rndD，12_effects.js）。⛔ 碎木以前跟戰局共用 rnd() ⇒ 少一顆碎木，後面的亂數全部錯位、整局都變。
//   · 帆與繩：低／中／高只差布與繩的細緻度（迭代次數、帆幾步走一次、垂繩上限），不碰 rnd()、不改命中；
//     關 ⇒ 帆停在雕刻作品那一刻、帆桁不追風 —— 帆桁的角度會改到打中帆桁的那幾下（30_rig_physics.js），跟以前「關掉物理」一樣。
// 網址：?phx=full|high|mid|low，單項 ?p_rig= ?p_debris= ?p_fx= ?p_water= ?p_flood=（第幾檔，從 0 起）；舊的 ?phys=0 ＝ 帆與繩關。
var PHX_ITEMS = [
  { k: 'rig', name: '帆與繩', opt: ['關（靜態）', '低', '中', '高'] },
  { k: 'rigfar', name: '遠方帆繩', opt: ['照常', '遠方半速', '遠方⅓・視野外最慢'] },   // 遠處、視野外的船帆與繩少算幾步（30_rig_physics.js rigFarM；Tim 2026-10-14）
  { k: 'debris', name: '碎木', opt: ['20%', '45%', '70%', '100%'] },
  { k: 'fx', name: '煙與水花', opt: ['40%', '65%', '85%', '100%'] },
  { k: 'water', name: '船邊水花', opt: ['關（原本的）', '低', '中', '高'] },
  { k: 'flood', name: '進水', opt: ['公式', '粒子 粗', '粒子 中', '粒子 細'] }];
var PHX_PRESET = { full: { rig: 3, rigfar: 1, debris: 3, fx: 3, water: 3, flood: 3 }, high: { rig: 2, rigfar: 1, debris: 2, fx: 2, water: 2, flood: 2 }, mid: { rig: 1, rigfar: 2, debris: 1, fx: 1, water: 1, flood: 1 }, low: { rig: 0, rigfar: 2, debris: 0, fx: 0, water: 0, flood: 0 } };   // rigfar：全開也是遠方半速（150 m 外看不出差別）
var PHX_NAME = { full: '全開', high: '高', mid: '中', low: '低', custom: '自訂' }, PHX_DEFAULT = CFG.menu.phx;   // 預設檔：config/game.json 的 menu.phx
// 帆與繩每一檔：it 布與繩的迭代次數、every 帆幾步走一次（2 ＝ 30 Hz，4 ＝ 15 Hz；一半的帆錯開一步）、loose 垂下來的繩最多幾條、shred 帆的布片每艘最多幾片（34_shreds.js）。高 ＝ 原本的。
var RIG_LV = [null, { it: 2, every: 4, loose: 150, shred: 40 }, { it: 3, every: 2, loose: 300, shred: 80 }, { it: 4, every: 2, loose: 500, shred: 150 }];
var DEB_KS = [0.2, 0.45, 0.7, 1], FX_KS = [0.4, 0.65, 0.85, 1];
var PHX = {}, PHX_RIG_LAST = 3;                 // PHX_RIG_LAST：B 鍵關掉再開，回到關之前那一檔
function phxSet(level) { var p = PHX_PRESET[level]; for (var k in p) PHX[k] = p[k]; }
/** 現在是哪一檔（四檔都對不上 ⇒ custom）。 */
function phxLevel() {
  for (var l in PHX_PRESET) { var p = PHX_PRESET[l], ok = true; for (var k in p) if (PHX[k] !== p[k]) ok = false; if (ok) return l; }
  return 'custom';
}
function phxText() { return PHX_ITEMS.map(function (it) { return it.name + ' ' + it.opt[PHX[it.k]].replace(/（.*$/, ''); }).join('・'); }
function rigLv() { return RIG_LV[PHX.rig] || RIG_LV[3]; }
phxSet(PHX_PRESET[Q.get('phx')] ? Q.get('phx') : PHX_DEFAULT);
PHX_ITEMS.forEach(function (it) { var v = parseInt(Q.get('p_' + it.k), 10); if (isFinite(v)) PHX[it.k] = clamp(v, 0, it.opt.length - 1); });
if (Q.get('phys') === '0' && !Q.has('p_rig')) PHX.rig = 0;
PHYS = PHX.rig > 0;                             // 帆與繩開不開（04_state.js 的 PHYS）跟著這一項走
