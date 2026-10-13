// ───────────────────────── 畫質（TASK-0522） ─────────────────────────
// 主選單：低／中／高（GFX_PRESET）；畫質設定頁可以一項一項調，跟三檔都對不上 ⇒ 主選單顯示「自訂」。
// ⛔ 只改畫面：這裡的值一個都不能被 step() 讀到（反向對照：同一個種子，低與高跑同樣秒數，戰局讀數逐項相同）。
//   浪的大小（SEA_K）是物理，在細節設定；這裡的「海面細緻度」只是網格多密、漣漪幾道。
// 每一項怎麼畫在 60_render.js（管線：陰影圖 → 反射 → 場景 → 折射 → 海 → 粒子 → 縮放貼到畫布）。
// 網址：?gfx=low|mid|high（縮圖、對拍用），單項 ?g_shadow= ?g_refl= ?g_refr= ?g_sea= ?g_res= ?g_aa= ?g_rain= ?g_drops= ?g_dropspl=（數字 ＝ 第幾檔，從 0 起）。
// 雨有兩種、各自一項：「雨」＝ 整個畫面一層的雨絲（01_gl.js P.rain）；「雨滴（3D）」＝ 3D 空間裡的雨絲粒子（14_rain.js）。高 ＝ 只開 3D（Tim 2026-10-13）；自訂可以兩種一起開。3D 雨滴打在海面與船上的水花另外一項（雨滴水花，Tim：要能開關）。
var GFX_ITEMS = [
  { k: 'shadow', name: '陰影', opt: ['關', '低（1024）', '高（2048、柔邊）'] },
  { k: 'refl', name: '海面反射', opt: ['關（只反射天空）', '低（船身，1/4 解析度）', '高（船身＋砲與帆，1/2 解析度）'] },
  { k: 'refr', name: '海水折射', opt: ['關（不透明）', '低（半透明）', '高（折射＋水深）'] },
  { k: 'sea', name: '海面細緻度', opt: ['低', '中', '高'] },
  { k: 'res', name: '解析度', opt: ['50%', '75%', '100%'] },
  { k: 'aa', name: '反鋸齒', opt: ['關', '開（MSAA 4×）'] },
  { k: 'rain', name: '雨', opt: ['關', '低（稀）', '高（密）'] },     // 只在暴風雨下（08_weather.js）：整個畫面一層
  { k: 'drops', name: '雨滴（3D）', opt: ['關', '少（1500）', '中（3000）', '多（6000）'] },   // 只在暴風雨下：3D 空間裡的雨絲粒子（14_rain.js）
  { k: 'dropspl', name: '雨滴水花', opt: ['關', '開'] }];                                   // 3D 雨滴打在海面與船上濺起的小水花
var GFX_PRESET = {
  low: { shadow: 0, refl: 0, refr: 0, sea: 0, res: 1, aa: 0, rain: 0, drops: 0, dropspl: 0 },
  mid: { shadow: 1, refl: 1, refr: 1, sea: 1, res: 2, aa: 1, rain: 1, drops: 0, dropspl: 0 },
  high: { shadow: 2, refl: 2, refr: 2, sea: 2, res: 2, aa: 1, rain: 0, drops: 3, dropspl: 1 } };
var GFX_NAME = { low: '低', mid: '中', high: '高', custom: '自訂' }, GFX_DEFAULT = 'mid';
var GFX = {}, GFX_FPS = false;                     // GFX_FPS：畫面右上角顯示 FPS（畫質設定頁的勾選）
var GFX_RES = [0.5, 0.75, 1];                      // 解析度：乘在畫布的像素上（畫布 ＝ 螢幕像素，裝置像素比最多 1.5）
function gfxSet(level) { var p = GFX_PRESET[level]; for (var k in p) GFX[k] = p[k]; }
/** 現在的畫質是哪一檔（三檔都對不上 ⇒ custom）。 */
function gfxLevel() {
  for (var l in GFX_PRESET) { var p = GFX_PRESET[l], ok = true; for (var k in p) if (GFX[k] !== p[k]) ok = false; if (ok) return l; }
  return 'custom';
}
function gfxText() { return GFX_ITEMS.map(function (it) { return it.name + ' ' + it.opt[GFX[it.k]].replace(/（.*$/, ''); }).join('・'); }
gfxSet(GFX_PRESET[Q.get('gfx')] ? Q.get('gfx') : GFX_DEFAULT);
GFX_ITEMS.forEach(function (it) { var v = parseInt(Q.get('g_' + it.k), 10); if (isFinite(v)) GFX[it.k] = clamp(v, 0, it.opt.length - 1); });
