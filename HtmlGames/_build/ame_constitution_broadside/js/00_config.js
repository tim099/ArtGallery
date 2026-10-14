// ───────────────────────── 設定檔（TASK-0542） ─────────────────────────
// 各項設定的初始值與船隻清單住在 config/game.json（設定後台 admin.py 改的就是它）；建置時 vxk_inline.py 把它內嵌成
//   <script type="application/x-asset" id="game-config">，這裡在所有檔之前讀成 CFG。用到它的：
//   limits（船數上限，00_core.js）、menu（主選單預設：玩法、模式、航行、畫質、物理效果）、lim／dist／ammo（滑桿與彈種倍率，04_state.js）、
//   guns（砲種表，10_ship.js）、geo0／crew0（船型高度與船員配置的預設，05_hull.js）、ships（船：內嵌 id、名字、船隻設定、高度、船員，05_hull.js）。
// ⛔ 程式裡不再有這些值的第二份：要改預設 ＝ 改 game.json（或開設定後台），不是改 js。
// 讀不到（沒有內嵌、JSON 壞了）⇒ 停在載入畫面、寫原因 —— 不照某一份舊值跑（那會是一場沒人知道的不同設定）。
var CFG = window.VoxelKit.embeddedJSON('game-config');
if (!CFG || CFG.v !== 1 || !Array.isArray(CFG.ships) || !CFG.ships.length) {
  var cfgWhy = !CFG ? '沒有內嵌的設定檔（#game-config）或 JSON 壞了' : CFG.v !== 1 ? '設定檔版本 ' + CFG.v + ' 看不懂' : '設定檔裡沒有船';
  document.getElementById('cover').textContent = '載入失敗：' + cfgWhy + '（config/game.json，重建：python -I admin.py build）';
  throw new Error(cfgWhy);
}
