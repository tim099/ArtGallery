// ───────────────────────── 艦隊指揮官（TASK-0551） ─────────────────────────
// Tim 2026-10-14：「加一個艦隊指揮官 AI 用來制定全局策略」「我方友艦也聽我方指揮官」。
// ⛔ 這一檔是純邏輯：只讀「局勢」、只回「命令」，不碰遊戲的全域變數 ⇒ 遊戲（52_fleet.js cmdTick）與 2D 沙盒（sandbox）載入同一份。
//
// 局勢 view：{ t（秒）, wind: [x, z]（風吹去的方向，單位向量）, side（'blue'／'red'：替哪一方想）, ships: [s…] }
//   s：{ id, team, x, z, yaw（船頭 ＝ [cos, −sin]）, spd（m/s）, hp（船殼 0..1）, guns（砲 0..1）, crew（人 0..1）, mass（開戰排水量）, len（水線長 m）,
//        out（沉了、在沉、降旗）, cmd（指揮得動：玩家自己開的那艘 ⇒ false）, tgt（現在打的那艘 id；玩家那艘照它自己的）}
// 命令 orders：{ [id]: { target（打哪艘 id；null ⇒ 照船自己挑）, mode（'engage' 交戰 ／ 'line' 戰列跟隨）, leader（戰列：跟著誰；站位每一步照它現在的位置算，cmdHelmLine）, throttle（油門；沒寫 ＝ 1）} }
// 記憶 mem：每一方一份（配對、集火的目標、戰列的順序），下一次想的時候接著用 ⇒ 不會每想一次就整個換一套。
var CMD_STRATS = ['free', 'pair', 'focus', 'line'];
var CMD_NAMES = { free: '各自為戰', pair: '一對一配對', focus: '集火', line: '戰列' };
var CMD_LINE_GAP = 90;                                                   // 戰列：前後兩艘的中心隔多遠（m；憲法號水線長 55 m ⇒ 頭尾隔 35 m）

function cmdDist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
function cmdStrength(s) { return 0.5 * s.hp + 0.3 * s.guns + 0.2 * s.crew; }   // 還剩多少戰力（0..1）
function cmdCenter(L) { var x = 0, z = 0; L.forEach(function (s) { x += s.x; z += s.z; }); return L.length ? { x: x / L.length, z: z / L.length } : null; }

/** 替 view.side 那一方想一次。strat：CMD_STRATS 其中一個；free ⇒ 不下命令（船照自己的：最近的敵艦）。 */
function cmdThink(view, strat, mem) {
  var own = view.ships.filter(function (s) { return s.team === view.side && !s.out; });
  var foes = view.ships.filter(function (s) { return s.team !== view.side && !s.out; });
  var orders = {};
  if (!own.length || !foes.length || strat === 'free' || !CMD_NAMES[strat]) return orders;
  if (strat === 'pair') cmdPair(own, foes, mem, orders);
  else if (strat === 'focus') cmdFocus(own, foes, mem, orders);
  else if (strat === 'line') cmdLine(own, foes, mem, orders);
  own.forEach(function (s) { if (!s.cmd) delete orders[s.id]; });          // 玩家自己開的那艘不下命令（但算在配對、戰列裡）
  return orders;
}

/** 一對一配對：每艘敵艦最多分到 ⌈我方艘數 ÷ 敵方艘數⌉ 艘（⇒ 不會三艘圍一艘、另一艘沒人管）。
 *  原本的配對還有效（目標沒出局、沒超過上限）就留著；其他的照「距離 ＋ 那艘已經有幾艘在打 × 300 m」最小的貪心補上（先補離敵人近的）。
 *  玩家那艘（cmd false）照它自己正在打的算進去。 */
function cmdPair(own, foes, mem, orders) {
  var cap = Math.ceil(own.length / foes.length), load = {}, asg = mem.pair || {}, ids = foes.map(function (f) { return f.id; });
  foes.forEach(function (f) { load[f.id] = 0; });
  var free = [];
  own.forEach(function (s) {
    var t = !s.cmd && s.tgt !== undefined && s.tgt !== null ? s.tgt : asg[s.id];
    if (t !== undefined && ids.indexOf(t) >= 0 && load[t] < cap) { load[t]++; asg[s.id] = t; } else free.push(s);
  });
  free.sort(function (a, b) { return Math.min.apply(null, foes.map(function (f) { return cmdDist(a, f); })) - Math.min.apply(null, foes.map(function (f) { return cmdDist(b, f); })) || a.id - b.id; });
  free.forEach(function (s) {
    var best = null, bc = 1e18;
    foes.forEach(function (f) { if (load[f.id] >= cap) return; var c = cmdDist(s, f) + 300 * load[f.id]; if (c < bc - 1e-9) { bc = c; best = f; } });
    if (!best) foes.forEach(function (f) { var c = cmdDist(s, f) + 300 * load[f.id]; if (c < bc - 1e-9) { bc = c; best = f; } });
    asg[s.id] = best.id; load[best.id]++;
  });
  mem.pair = asg;
  own.forEach(function (s) { orders[s.id] = { target: asg[s.id], mode: 'engage' }; });
}

/** 集火：全隊打同一艘 —— 敵艦裡「剩的戰力 × 0.6 ＋ 離我方中心的距離 ÷ 1000 × 0.4」最小的（弱又近）；打到它出局才換。 */
function cmdFocus(own, foes, mem, orders) {
  var ids = foes.map(function (f) { return f.id; });
  if (mem.focus === undefined || ids.indexOf(mem.focus) < 0) {
    var c = cmdCenter(own), best = null, bs = 1e18;
    foes.forEach(function (f) { var sc = 0.6 * cmdStrength(f) + 0.4 * cmdDist(c, f) / 1000; if (sc < bs - 1e-9) { bs = sc; best = f; } });
    mem.focus = best.id;
  }
  own.forEach(function (s) { orders[s.id] = { target: mem.focus, mode: 'engage' }; });
}

/** 戰列：旗艦（開戰排水量最大、還在打的）帶頭、照自己的方式交戰；其他的排成縱隊，各自跟著前一艘的船尾（cmdHelmLine）。
 *  順序記在 mem.line（新進場的接到尾巴、出局的拿掉 ⇒ 後面的往前補）。每艘打離自己最近的敵艦（全隊用朝敵那一舷：跟著前一艘的航向走，舷側自然朝同一邊）。 */
function cmdLine(own, foes, mem, orders) {
  var lead = own.slice().sort(function (a, b) { return b.mass - a.mass || a.id - b.id; })[0];
  var L = (mem.line || []).filter(function (id) { return id !== lead.id && own.some(function (s) { return s.id === id; }); });
  own.forEach(function (s) { if (s.id !== lead.id && L.indexOf(s.id) < 0) L.push(s.id); });
  mem.line = L;
  function near(s) { var b = null, bd = 1e18; foes.forEach(function (f) { var d = cmdDist(s, f); if (d < bd) { bd = d; b = f; } }); return b; }
  var prev = lead, err = 0;
  L.forEach(function (id) {
    var s = own.filter(function (o) { return o.id === id; })[0];
    orders[id] = { target: near(s).id, mode: 'line', leader: prev.id };   // 站位每一步現算（cmdHelmLine）
    err += cmdDist(s, cmdHelmLine(s, prev).station);
    prev = s;
  });
  err = L.length ? err / L.length : 0; mem.lineErr = err;
  // 排頭：隊形還沒排好（跟隨的平均離站位 > 60 m）⇒ 0.75 等後面的跟上（⛔ 全速 ⇒ 大家一樣快，後面的永遠追不上：量過 4 艘 40 秒，第 3、4 艘離站位 185 → 208、249 → 264 m；
  //   ⛔ 0.5 ⇒ 頂風時整隊一起爬）
  orders[lead.id] = { target: near(lead).id, mode: 'engage', throttle: err > 60 ? 0.75 : 1 };
}

/** 戰列跟隨的舵與油門（遊戲與沙盒共用；每一步照前一艘「現在」的位置算 ⇒ 命令只記跟著誰，⛔ 站位在想的那一刻算 ⇒ 3 秒內前一艘走了十幾公尺、站位就過時）：
 *  站位 ＝ 前一艘往它船尾方向退 CMD_LINE_GAP；往「站位再往前 60 m」那一點開（⇒ 從後面追上來時斜著切進隊形、到了就順著前一艘的航向）；
 *  超過站位 ⇒ 放慢；落後 ⇒ 全速。s、lead：{ x, z, yaw }。回傳 { yaw, throttle, station }。 */
function cmdHelmLine(s, lead) {
  var fx = Math.cos(lead.yaw), fz = -Math.sin(lead.yaw), st = [lead.x - fx * CMD_LINE_GAP, lead.z - fz * CMD_LINE_GAP];
  var px = st[0] + fx * 60, pz = st[1] + fz * 60;
  var yaw = Math.atan2(-(pz - s.z), px - s.x);
  var ahead = (s.x - st[0]) * fx + (s.z - st[1]) * fz;                       // 正 ＝ 超過站位
  var same = Math.cos(s.yaw) * fx - Math.sin(s.yaw) * fz > 0.5;              // 船頭跟前一艘大致同向（60° 內）
  // 超前（而且同向）⇒ 不掉頭：跟前一艘平行、放慢，等它過去；落後或方向不同 ⇒ 往追蹤點開、全速。
  // ⛔ 不看同不同向 ⇒ 前一艘掉頭之後，本來在後面的變成「超前」⇒ 放慢，其實它該全速掉頭（量過：整隊 0.04–1 節爬）；
  // ⛔ 超前也往後面的追蹤點開 ⇒ 舵一直想掉頭、又被放慢 ⇒ 舵靠航速才轉得動（最慢 0.012 rad/s），卡在原地（量過：離站位 200 m、0.03 節）。
  if (same && ahead > 5) return { yaw: lead.yaw, throttle: ahead > 25 ? 0.35 : 0.7, station: st };
  return { yaw: yaw, throttle: 1, station: st };
}
