// ───────────────────────── 艦隊（TASK-0537：多船的架構） ─────────────────────────
// 每艘有陣營（sh.team：'blue'／'red'）；「我的對手」不再是 SHIPS[1 − sh.i]，而是 foeOf(sh)：
//   每一步開始時挑一次（pickFoes）—— 玩家點過的那艘（還在、是敵船）優先，否則最近的、還沒沉的敵船；敵船全沉了 ⇒ 最近的那艘（照舊指著它，像以前一樣）。
//   ⇒ 一對一時永遠是另一艘 ⇒ 跟以前一位元都不差。只用船的位置（px、pz）、不抽亂數。
// 友軍跟敵軍只差在挑目標（Tim 2026-10-13）：同陣營不當目標；砲彈照舊打得到每一艘 ⇒ 誤擊照樣扣血、算傷亡（讀數 sh.ff：被友船打中幾發）。
// 瞄準點（sh.aim）是「那艘船」的格座標 ⇒ 一併記是哪艘（sh.aimOn，setAim）；換目標之前瞄的那一點不會被套到另一艘的座標上。
// 船數上限 MAX_SHIPS（00_core.js）：GPU 的格數（陰影圖、船艙遮罩、透視）照它生著色器，執行時只跑場上那幾艘（uNS）。
/** 誤擊的讀數：被友船打中幾發（sh.ff）、打中友船幾發（ffOut）。一顆彈只算一次（跟 hits 同一個 hitOnce）。 */
function ffHit(sh, b) { var o = SHIPS[b.owner]; if (o && o !== sh && o.team === sh.team) { sh.ff = (sh.ff || 0) + 1; o.ffOut = (o.ffOut || 0) + 1; } }
/** 落水的人上不了自己的船 ⇒ 往哪幾艘游（43_swim.js）：友船先、再敵船，各照 SHIPS 的順序（一對一 ＝ [敵艦]）。 */
function swimOthers(sh) { var o = SHIPS.filter(function (x) { return x !== sh; }); return o.filter(function (x) { return x.team === sh.team; }).concat(o.filter(function (x) { return x.team !== sh.team; })); }
function teamIdx(sh) { return sh.team === 'red' ? 1 : 0; }              // 貼圖的列、羅盤的顏色：藍 0、紅 1
function isFoe(a, b) { return !!a && !!b && a !== b && a.team !== b.team; }
function teamShips(team) { return SHIPS.filter(function (o) { return o.team === team; }); }
function pickFoes() {
  SHIPS.forEach(function (sh) {
    var c = SHIPS.filter(function (o) { return isFoe(sh, o); }); if (!c.length) { sh.foe = null; return; }
    if (sh.i === PLAYER_I && sh.aimOn && c.indexOf(sh.aimOn) >= 0 && !sh.aimOn.sunk) { sh.foe = sh.aimOn; return; }   // 玩家點過的那艘
    var live = c.filter(function (o) { return !o.sunk; }); if (live.length) c = live;
    var best = null, bd = 1e18;
    c.forEach(function (o) { var d = (o.px - sh.px) * (o.px - sh.px) + (o.pz - sh.pz) * (o.pz - sh.pz); if (d < bd) { bd = d; best = o; } });
    sh.foe = best;
  });
}
function foeOf(sh) { if (sh.foe === undefined) pickFoes(); return sh.foe; }
/** 瞄準點落在哪艘船（設瞄準點那一刻的那艘；沒有 ⇒ 現在的目標）。 */
function aimShip(sh) { return sh.aim && sh.aimOn ? sh.aimOn : foeOf(sh); }
function setAim(sh, aim, on) { sh.aim = aim; sh.aimOn = aim ? on || foeOf(sh) : null; }
/** 旗艦：那個陣營還沒沉的船裡，開戰時排水量（sh.mass0；還沒算 ⇒ 現算）最大的；全沉了 ⇒ 最大的那艘（Tim 2026-10-13：上方面板只顯示雙方旗艦）。
 *  ⛔ 照「現在」的排水量排 ⇒ 被打掉幾噸就換旗艦、面板一直跳。 */
function flagship(team) {
  var L = teamShips(team), live = L.filter(function (o) { return !o.sunk; }); if (live.length) L = live;
  var best = null, bm = -1;
  L.forEach(function (o) { var m = o.mass0 || shipT(o); if (m > bm) { bm = m; best = o; } });
  return best;
}
function teamTag(sh) { return teamIdx(sh) === 0 ? '（藍）' : '（紅）'; }
function playerTeam() { var me = SHIPS[PLAYER_I]; return me ? me.team : 'blue'; }
function foeTeam() { return playerTeam() === 'blue' ? 'red' : 'blue'; }
/** 那個陣營打完了沒：每艘都沉了或降旗。 */
function teamDown(team) { var L = teamShips(team); return L.length > 0 && L.every(function (o) { return o.sunk || o.struck; }); }
/** 開局的編隊（70_flow.js reset）：每一邊照 SHIP_SET 排成橫隊、面對面 ±DIST/2；一邊一艘 ⇒ 跟以前同一個位置。
 *  FLEET：[{ team, hull }]，一對一 ＝ [我艦, 敵艦]；SHIPS 照這個順序建（i ＝ 序號；我艦是 0）。艘數超過 MAX_SHIPS ⇒ 截掉。 */
var FLEET_GAP = 70;                                                       // 同一邊兩艘之間隔多遠（m，沿船長方向）
var FLEET_DBG = null;                                                     // ?debug=1 的 __game.fleet([...])：測多船用（主選單、網址、存檔照舊只開兩艘 —— Tim 2026-10-13「目前仍然只用兩船」）
function fleetSpec() { return FLEET_DBG || [{ team: 'blue', hull: SHIP_SET[0] }, { team: 'red', hull: SHIP_SET[1] }]; }
function spawnFleet(spec) {
  spec = spec.slice(0, MAX_SHIPS);
  var n = { blue: 0, red: 0 }, k = { blue: 0, red: 0 };
  spec.forEach(function (f) { n[f.team]++; });
  spec.forEach(function (f, i) {
    var blue = f.team === 'blue', j = k[f.team]++, off = (j - (n[f.team] - 1) / 2) * FLEET_GAP;
    SHIPS.push(makeShip(i, f.team, blue ? 0 : Math.PI, blue ? DIST / 2 : -DIST / 2, HULLT[f.hull], blue ? off : -off));   // 一邊一艘 ⇒ px 0，跟以前一樣
  });
}
