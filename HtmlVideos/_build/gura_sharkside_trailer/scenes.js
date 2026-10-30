// ── 分鏡：方舷放置 Sharkside 宣傳片（2026-10-30 gura；Tim：「接著嘗試做html版宣傳片吧」）──
// 導演框架照 kaguya 的 Blockside 宣傳片（director.js、overlay.js、audio.js 的說明在那裡）；這一份只有方舷放置自己的幕。
// 十三幕：開場（鯊魚咬餘燼號）→ 片名 → 咬一口（連咬、暴擊）→ 放置（艦隊自己打、格數往上跳）→ 結算商店（強化三選一、升級）
//   → 軍火箱（噴火、砲擊、火藥桶、鏈彈）→ 海區（一區十個海域；古代航道、鐵甲時代、大漩渦）→ 黃金寶船 → 巨齒鯊 → 潛回亞特蘭提斯／離線收益 → 片尾。
// 每一幕都是遊戲當下算出來的：咬、武器、技能由導演照時間「代按」（核心外殼 API 的 bite／shot／blast，跟遊戲裡玩家按下去走同一條），之後怎麼碎、怎麼進水、怎麼沉全是遊戲算的。
//   畫面上的格數、賞金、連咬倍率是照遊戲的樣子排的數字（片子裡沒有存檔與經濟），不是當下的帳 ⇒ 片尾小字寫明。
// ⛔ 咬的那一舷照「這一刻的鏡頭在哪一邊」挑（trSideFor）：不能交給核心的 side 0（它看 CAM.eye ⇒ 換幕預跑時 CAM 還是上一幕的 ⇒ 同一個 t 會咬到不同舷）。
var TR_SCORE = null;
var TR_SUN0 = null;
/** 齊射（框架的 trVolley 不看船在不在：沉了、還沒做好 ⇒ 跳過）。 */
function trVol(a, b) { if (a && b && !a.sunk && !b.sunk && a.guns) trVolley(a, b, 0); }
/** foe 第 k 大的帆（照外框面積；旗、掉了的不算）的中心（格座標）；沒有 ⇒ 船中段高處。 */
function trSailAim(foe, k) {
  var L = foe.sails.filter(function (s) { return !s.flag && !s.dead && !s.furled; }).map(function (s) { var b = s.bb; return { b: b, a: (b[3] - b[0]) * (b[5] - b[2]) }; }).sort(function (x, y) { return y.a - x.a; });
  var q = L[Math.min(k, L.length - 1)]; if (!q) return [foe.T.cx, foe.T.cy, foe.T.zw + 190];
  return [(q.b[0] + q.b[3]) / 2, (q.b[1] + q.b[4]) / 2, (q.b[2] + q.b[5]) / 2];
}

// ── 方舷放置的幕的小工具 ──
/** 片長秒 u（一幕裡，含 lead）⇒ 模擬秒 τ（同 director 的 trAt：v ＝ u − lead；有 warp 照 trTau，沒有 ⇒ pre ＋ v × rate）。cue 照它排。 */
function trTauU(sc, u) { var v = Math.max(0, u - (sc.lead || 0)); return sc.warp ? trTau(sc, v) : (sc.pre || 0) + v * (sc.rate || 1); }
/** 船的水平前方 f、右舷 r（世界）。 */
function trFR(sh) { var f = fwd(sh.yaw); return { f: [f[0], 0, f[2]], r: [-f[2], 0, f[0]] }; }
/** 世界點 eye 在 sh 的哪一舷（核心 bite 的 side：照格座標的 y；跟 91_shellapi.js 的 side 0 同一個判法，只是鏡頭由這裡給）。 */
function trSideFor(sh, eye) { var a = toLocal(sh, eye), c = toLocal(sh, shipCenter(sh)); return a[1] > c[1] ? 1 : -1; }
/** 船殼上的一點（世界）：沿船長 fx（0～1）、side 那一舷的外緣、水線上 dz 格。 */
function trHullPt(sh, fx, side, dz) {
  var T = sh.T, x = T.hx0 + (T.hx1 - T.hx0) * fx, y = side > 0 ? T.base.sy - 1 : 0, z = (T.zw || 0) + (dz || 0);
  return M4.pt(sh.M, x, y, z);
}
/** 敵艦照方舷放置的放置模式打底（Sharkside 10_data.js BAL：eHard 0.15、eFlood 6、ePump 0.4）⇒ 碎得跟遊戲一樣快。 */
function trFrag(S) { S.forEach(function (sh) { if (sh.team !== 'red' || !sh.cfg) return; sh.cfg.hard *= 0.2; sh.cfg.flood *= 5; sh.cfg.pump *= 0.4; }); }
/** 位置：從 (0,0) 沿船頭 a 公尺、往右舷 b 公尺（船頭朝 h）。 */
function trPos(h, a, b) { return [Math.cos(h) * a - Math.sin(h) * b, Math.sin(h) * a + Math.cos(h) * b]; }
/** 一幕：trAdd ＋ 咬（bites）與照片長秒排的 cue（cuesU：[[u, fn(S, sc)]…]），setup 先清這一輪咬到的點、敵艦打底。 */
function trScene(o) {
  var bites = o.bites || [], cu = o.cuesU || [], user = o.setup;
  delete o.bites; delete o.cuesU; delete o.setup;
  var sc = trAdd(o);
  sc.bl = bites.map(function (b, k) { b.k = k; return b; });
  sc.setup = function (S) { sc.bw = []; if (o.frag !== false) trFrag(S); if (user) user(S, sc); };
  sc.cues = (o.cues || []).concat(cu.map(function (q) { return { at: trTauU(sc, q[0]), fn: q[1] }; }), sc.bl.map(function (b) { return { at: trTauU(sc, b.u), fn: function (S, s2) { trDoBite(s2 || sc, b); } }; }))
    .sort(function (a, b) { return a.at - b.at; });                     // ⛔ 不排 ⇒ 導演照陣列順序觸發（kaguya 莫尼特號那幕的 cue 晚了 2.5 秒）
  return sc;
}
/** 咬一口（cue 裡跑）：照這一刻的鏡頭挑那一舷；at 可以是函式（例：咬砲塔）。記下咬到的那一點（相對船心）給字幕層畫嘴。 */
function trDoBite(sc, b) {
  var sh = SHIPS[b.s]; if (!sh || sh.sunk) return;
  var eye = sc.cam(b.u, trTauU(sc, b.u), SHIPS, sc).eye, side = b.side || trSideFor(sh, eye), at, dir;
  if (b.at) { at = b.at(sh, side, eye); dir = b.dir ? b.dir(sh, side, eye) : undefined; } else at = { fx: b.fx, side: side, dz: b.dz };
  var res = trBite(sh, at, b.r, dir), c = shipCenter(sh);
  sc.bw[b.k] = res ? { sh: sh, off: [res.w[0] - c[0], res.w[1] - c[1], res.w[2] - c[2]], n: res.n, mdl: res.mdl || 0 } : null;
}
/** 字幕層：這一幕的嘴、飄字、連咬（照片長秒；點的位置跟著船走）。 */
function trBitesDraw(g, u, sc) {
  (sc.bl || []).forEach(function (b) {
    var w = sc.bw && sc.bw[b.k]; if (!w) return;
    var du = u - b.u; if (du < 0 || du > 1.6) return;
    var c = shipCenter(w.sh), p = trProject([c[0] + w.off[0], c[1] + w.off[1], c[2] + w.off[2]]); if (!p) return;
    var k = b.big ? 1.7 : b.crit ? 1.3 : (b.k2 || 1);
    if (b.tap !== false) trTap(g, p[0], p[1], du / 0.5);
    if (du < 0.9) trJaw(g, p[0], p[1], k, du / 0.9, b.word, b.crit);
    if (b.gain) trFloatG(g, p[0], p[1] - 80 * k, b.gain, (du - 0.15) / 1.35, b.crit ? '#ffe08a' : TR_SK.gold, Math.round(46 * Math.min(1.4, k)));
    if (b.combo >= 2) trComboG(g, b.combo, b.mult, du / 1.6, b.crit);
  });
}
/** 這一幕咬下去的那幾刻（鏡頭震動用）。 */
function trHits(list) { return list.map(function (b) { return b.u; }); }
/** 飄在船頭上的賞金（照片長秒排的固定數字）：list ＝ [[u, 第幾艘, '字', 大小]]。 */
function trGainsDraw(g, u, S, list) {
  list.forEach(function (q) {
    var du = u - q[0]; if (du < 0 || du > 1.5) return;
    var sh = S[q[1]]; if (!sh) return; var c = shipCenter(sh), p = trProject([c[0], c[1] + 10, c[2]]); if (!p) return;
    trFloatG(g, p[0] + (q[4] || 0), p[1], q[2], du / 1.5, q[5] || TR_SK.gold, q[3] || 44);
  });
}

function trScenes() {
  if (TR.S.length) return;
  TR_SUN0 = SUN.slice();
  TR_LOOK.vortex = { sky: [0.12, 0.16, 0.20], horizon: [0.22, 0.27, 0.31], ground: [0.07, 0.08, 0.09], fog: 0.0012, sun: 0.45, lum: 0.55, foam: 1 };   // 大漩渦（kaguya：暴風雨的霧太濃 ⇒ 遠鏡頭只剩一片灰）
  var PI = Math.PI, SA = trSunAz(TR_SUN0), H = SA - PI / 2;              // 船頭朝 H ⇒ 右舷對著太陽：鏡頭站在右舷、背對太陽 ⇒ 船身是亮的（kaguya 蓬特號第一版：鏡頭在背光那一舷，整片暗）
  var GSUN = norm([-0.78, 0.30, -0.55]), Hg = trSunAz(GSUN) - PI / 2;   // 黃昏的金色太陽（開場、黃金寶船）
  function L(o, sun) { var x = Object.assign({}, o); if (sun) x.sunDir = sun; return x; }
  function ship(team, hull, h, a, b, o) { var p = trPos(h, a || 0, b || 0); return Object.assign({ team: team, hull: hull, x: p[0], z: p[1], yaw: trYaw(h), hold: 1, sail: 3 }, o || {}); }   // sail：帆段 0 全收、1 收帆、2 戰鬥帆、3 滿帆（31_sailing.js SAILSETS；⛔ 第一版給 1 ⇒ 大帆全捲著，鏈彈瞄到收起來的帆、一條繩都沒斷）
  function shake(sc, u, amp) { return trShake(sc._hits || [], u, amp); }

  // ═════ 一、開場：鯊魚咬餘燼號（Tim 對 Blockside 宣傳片：「最好一開始就有 抓住玩家目光」）═════
  //   一片鰭從鏡頭這一側游向餘燼號 ⇒ 第一口（慢動作 0.3 倍看木屑）⇒ 藍鯊號一舷齊射從鏡頭後面打過去 ⇒ 第二口、暴擊。
  var hookB = [{ u: 2.6, s: 1, fx: 0.52, dz: 1, r: 15, word: 'CHOMP!', big: 1, gain: '+1.2萬' },
               { u: 4.7, s: 1, fx: 0.76, dz: 2, r: 11, word: 'CRUNCH!', gain: '+8,640', combo: 2, mult: '×1.15' },
               { u: 5.6, s: 1, fx: 0.30, dz: 1, r: 16, word: 'CRITICAL!', crit: 1, gain: '+2.4萬', combo: 3, mult: '×1.3' }];
  var hook = trScene({ id: 'hook', dur: 8, seed: 31, wind: trWind(Hg, 0.6, 0.9), pre: 1.0, fadeIn: 0.5, look: L(TR_LOOK.gold, GSUN),
    warp: [[0, 1], [2.5, 1], [2.62, 0.3], [3.7, 0.3], [4.0, 1]],
    fleet: [ship('blue', 'pinas', Hg, -6, 78), ship('red', 'ember', Hg, 0, 0)],
    bites: hookB,
    cuesU: [[3.95, function (S) { trVol(S[0], S[1]); }]],
    cam: function (u, tau, S, sc) {
      var c = trRel(S[1], PI / 2 - trK2(u, 8, 0.36, 0.10), trK2(u, 8, 0.05, 0.08), trK2(u, 8, 66, 54), 9, 0), o = trShake(trHits(hookB), u, 0.7);   // 餘燼號長、桅高 ⇒ 離 54～66 m 才整艘進得來（第一版 29～36 m：嘴在畫面外）
      c.eye = trAddV(c.eye, o); c.look = trAddV(c.look, o); return trAbove(c, 1.6);
    },
    cap: function (g, u, tau, S, sc) {
      var e = S[1];
      if (e && u < 2.7) {                                                // 鰭：從鏡頭這一側的海面游到咬的那一點（固定路徑、照 u）
        var c = shipCenter(e), F = trFR(e), side = trSideFor(e, CAM.eye || c), q = trSmooth(0.3, 2.55, u);
        var w = [c[0] + F.r[0] * side * trMix(30, 6, q) + F.f[0] * trMix(12, 1, q), 0, c[2] + F.r[2] * side * trMix(30, 6, q) + F.f[2] * trMix(12, 1, q)];
        w[1] = seaH(w[0], w[2], SIMT); var p = trProject(w), p2 = trProject([w[0] - F.f[0], w[1], w[2] - F.f[2]]);
        if (p) trFin(g, p[0], p[1], trClamp(4200 / Math.max(6, trDistTo(w)), 40, 220), trFade(u, 0.3, 2.62, 0.25), p2 && p2[0] > p[0]);
      }
      trBitesDraw(g, u, sc);
      trLine(g, '點哪裡，就咬哪裡。', trFade(u, 6.2, 7.9, 0.5), TR_CH * 0.82);
      trNote(g, '遊戲實機畫面・咬與武器由導演代按', trFade(u, 0.6, 7.7, 0.4));
    } });
  hook._hits = trHits(hookB);

  // ═════ 二、片名 ═════
  trScene({ id: 'title', dur: 5, seed: 2, wind: [0, 1], fadeIn: 0, fadeOut: 0.3, fleet: [ship('blue', 'flyingfish', H, 0, 0)],
    cam: function (u, tau, S) { return trAbove(trRel(S[0], PI / 2, 0.2, 60, 4)); },
    cap: function (g, u) {
      trCover(g, 'key/title-land', 1, 1.0 + 0.035 * u / 5, 0.5, 0.42);
      trFill(g, '#ffffff', 1 - trSmooth(0, 0.35, u));                      // 從開場的最後一口白閃進來
      var k = trPop((u - 0.25) / 0.6);
      trPicC(g, 'app/logo', TR_CW / 2, 182, 860 * k, trSmooth(0.25, 0.55, u));
      trText(g, '鯊魚艦隊的無盡海', TR_CW / 2, 372, '900 50px ' + TR_SANS, '#ffffff', trFade(u, 0.9, 9, 0.5), 'center', 10);
      trText(g, '放置 × 海戰 × 體素破壞', TR_CW / 2, 436, '600 30px ' + TR_SANS, '#cfeaff', trFade(u, 1.5, 9, 0.5), 'center', 6);
    } });

  // ═════ 三、咬一口：連咬、暴擊（遊戲 30_battle.js bite：1.6 秒內再咬 ⇒ 連咬 ×1.15、×1.3…；每第十口暴擊）═════
  var biteU = [1.4, 2.2, 3.0, 3.8, 4.6, 5.4, 6.2, 7.0, 7.8, 8.9], biteF = [0.24, 0.32, 0.4, 0.48, 0.56, 0.64, 0.72, 0.8, 0.36, 0.52], biteZ = [1, 2, 0, 2, 1, 3, 0, 2, 1, 1];
  var biteB = biteU.map(function (u, i) {
    var n = i + 1, crit = n === 10, m = 1 + 0.15 * (n - 1);
    return { u: u, s: 1, fx: biteF[i], dz: biteZ[i], r: crit ? 15 : 9, word: crit ? 'CRITICAL!' : null, crit: crit ? 1 : 0, combo: n, mult: '×' + m.toFixed(2).replace(/0$/, '').replace(/\.0$/, ''),
      gain: '+' + trFmtZh(Math.round(3200 * m * (crit ? 2 : 1) / 10) * 10) };
  });
  var bite = trScene({ id: 'bite', dur: 12, seed: 52, wind: trWind(H, 0.6, 1.0), pre: 1.0,
    fleet: [ship('blue', 'flyingfish', H, 10, -72), ship('red', 'labelle', H, 0, 0)],
    bites: biteB,
    cuesU: [[1.0, function (S) { trVol(S[0], S[1]); }], [5.2, function (S) { trVol(S[0], S[1]); }], [9.6, function (S) { trVol(S[0], S[1]); }]],
    cam: function (u, tau, S) {
      var c = trRel(S[1], PI / 2 + trK2(u, 12, -0.55, 0.25), trK2(u, 12, 0.11, 0.07), trK2(u, 12, 42, 33), 2.5, 0), o = trShake(trHits(biteB), u, 0.35);
      c.eye = trAddV(c.eye, o); return trAbove(c, 1.6);
    },
    cap: function (g, u, tau, S, sc) {
      trBitesDraw(g, u, sc);
      var last = -9; biteU.forEach(function (x) { if (x <= u) last = x; });
      trCharge(g, Math.min(1, (u - last) / 0.85), trFade(u, 0.4, 11.6, 0.4));
      trTicker(g, trKey([[0, 124000], [9.2, 318000], [12, 341000]], u), 4100, trFade(u, 0.3, 11.7, 0.4));
      trCardTL(g, 'upg/teeth', '🦷', '咬一口', '點敵艦哪裡，就咬哪裡', trFade(u, 0.4, 4.4, 0.4));
      trLine(g, '一口接一口：連咬越多，賺得越多 —— 每第十口暴擊！', trFade(u, 9.3, 11.8, 0.5), TR_CH * 0.80);
    } });

  // ═════ 四、放置：艦隊自己打（觀戰模式＋自動開砲；齊射另外由導演排，保證打得到）═════
  var idle = trScene({ id: 'idle', dur: 11, seed: 77, wind: trWind(H, 0.6, 1.1), pre: 1.0, mode: 'eve', autoFire: true,
    fleet: [ship('blue', 'pinas', H, -20, 64, { hold: 0 }), ship('blue', 'flyingfish', H, 46, 60, { hold: 0 }), ship('red', 'constitution', H, -26, -58, { hold: 0 }), ship('red', 'swallow', H, 44, -60, { hold: 0 })],
    cuesU: [[0.7, function (S) { trVol(S[0], S[2]); }], [1.7, function (S) { trVol(S[2], S[0]); }], [3.0, function (S) { trVol(S[1], S[3]); }],
            [4.4, function (S) { trVol(S[0], S[2]); }], [5.6, function (S) { trVol(S[3], S[1]); }], [6.5, function (S) { trVol(S[1], S[3]); }],
            [7.6, function (S) { if (S[3] && !S[3].sunk) TR_API.scuttle(S[3], '撐不住，開始沉了'); }], [8.6, function (S) { trVol(S[0], S[2]); }]],
    cam: function (u, tau, S) {
      var m = [0, 0]; S.forEach(function (sh) { m[0] += sh.px / S.length; m[1] += sh.pz / S.length; });
      return trAbove({ eye: trOrbit([m[0], 0, m[1]], SA + trK2(u, 11, -0.55, 0.15), trK2(u, 11, 0.30, 0.21), trK2(u, 11, 205, 165)), look: [m[0], 3, m[1]] }, 4);
    },
    cap: function (g, u, tau, S) {
      trTicker(g, trKey([[0, 1.24e8], [11, 8.62e8]], u), 3.4e7, trFade(u, 0.2, 10.8, 0.4));
      trGainsDraw(g, u, S, [[1.3, 2, '+86萬'], [2.2, 3, '+41萬'], [3.6, 3, '+52萬'], [4.9, 2, '+1.1億'], [6.0, 2, '+93萬'], [6.9, 3, '+64萬'],
        [8.0, 3, '⚓ 擊沉 +1.2億', 58, 0, '#ffe08a'], [9.1, 2, '+1.4億'], [10.0, 2, '+77萬']]);
      trCardTL(g, 'abil/volley', '⚓', '放置', '不點也會打：艦隊自己開船、自己開砲', trFade(u, 0.4, 5.4, 0.4));
      trLine(g, '打下來的每一格船殼，都是一格收入。', trFade(u, 5.8, 10.7, 0.5), TR_CH * 0.82);
    } });

  // ═════ 五、結算商店：強化三選一、升級（遊戲 50_ui.js：每一場打完跳出來）═════
  var CARDS = [['common', 'upg/gun', '🎯', '砲術訓練 +2 級', '免費升級兩級'], ['rare', 'buff/gold', '💰', '黃金潮', '收入 ×1.6・五場'], ['epic', 'bless/atk', '🔱', '海神的祝福', '火力 ×1.15・可以疊']];
  var UPS = [['upg/gun', '🎯', '砲術訓練', 41, 4.0], ['upg/teeth', '🦷', '鯊魚利齒', 15, 4.6], ['upg/value', '🪙', '鑑價師', 30, 5.2]];
  trScene({ id: 'shop', dur: 6.5, seed: 9, wind: trWind(H, 0.6, 1.0), pre: 2.0, fleet: [ship('blue', 'pinas', H, 0, 0)],
    cam: function (u, tau, S) { return trAbove(trRel(S[0], PI / 2 + trK2(u, 6.5, -0.3, 0.3), 0.1, 70, 8)); },
    cap: function (g, u) {
      trFill(g, 'rgba(6,18,32,1)', 0.72);
      trTicker(g, trKey([[0, 2.86e9], [3.9, 2.86e9], [4.1, 2.51e9], [4.7, 2.17e9], [5.3, 1.79e9], [6.5, 1.82e9]], u), 0, trFade(u, 0.1, 6.4, 0.3));
      var pick = trSmooth(2.45, 2.8, u), gone = trSmooth(3.1, 3.5, u);
      trText(g, '⚓ 海域 30 拿下了！挑一個強化帶走', TR_CW / 2, 200, '800 46px ' + TR_SANS, '#ffffff', trFade(u, 0.2, 3.4, 0.3) * (1 - gone), 'center', 3);
      CARDS.forEach(function (c, i) {
        var a = trSmooth(0.25 + i * 0.12, 0.6 + i * 0.12, u), sel = i === 2, al = a * (1 - gone) * (sel ? 1 : 1 - 0.75 * pick);
        trPerkCard(g, 580 + i * 380, 600 + 140 * (1 - a) - (sel ? 40 * pick : 0), 340, c[0], c[1], c[2], c[3], c[4], al, 0, sel ? 0.4 + 0.6 * pick : 0);
      });
      trTap(g, 1340, 560, (u - 2.35) / 0.5);
      var pa = trSmooth(3.4, 3.8, u);                                     // 升級列
      if (pa > 0.003) {
        g.save(); g.globalAlpha = pa; g.fillStyle = 'rgba(8,24,40,.94)'; trRound(g, 700, 300, 960, 470, 24); g.fill(); g.strokeStyle = 'rgba(127,216,255,.4)'; g.lineWidth = 2; g.stroke(); g.restore();
        trText(g, '升級', 760, 350, '800 36px ' + TR_SANS, TR_SK.sea, pa, 'left', 4);
        UPS.forEach(function (r, i) {
          var y = 440 + i * 112, n = r[3] + (u >= r[4] ? 1 : 0), hit = trSmooth(r[4], r[4] + 0.2, u) * (1 - trSmooth(r[4] + 0.5, r[4] + 0.9, u));
          g.save(); g.globalAlpha = pa; g.fillStyle = 'rgba(255,255,255,' + (0.05 + 0.08 * hit) + ')'; trRound(g, 740, y - 46, 880, 92, 16); g.fill(); g.restore();
          if (!trPic(g, r[0], 760, y - 36, 72, 72, pa)) trText(g, r[1], 796, y, '52px ' + TR_EMOJI, '#fff', pa, 'center');
          trText(g, r[2], 856, y - 12, '800 36px ' + TR_SANS, '#ffffff', pa, 'left');
          trText(g, 'Lv ' + n, 856, y + 26, '700 26px ' + TR_SANS, hit > 0 ? TR_SK.gold : TR_SK.sea, pa, 'left');
          g.save(); g.globalAlpha = pa; g.fillStyle = hit > 0 ? 'rgba(255,209,102,.95)' : 'rgba(43,139,214,.9)'; trRound(g, 1200, y - 30, 190, 60, 14); g.fill(); g.restore();
          trText(g, '升級', 1295, y, '800 30px ' + TR_SANS, hit > 0 ? '#2a1600' : '#ffffff', pa, 'center');
          trTap(g, 1295, y, (u - r[4] + 0.1) / 0.5);
          trFloatG(g, 1000, y - 10, '+1', (u - r[4]) / 1.0, TR_SK.good, 40);
        });
      }
      trSasha(g, 'smug', 20, TR_CH + 30, 600, trSmooth(3.9, 4.3, u), '升級、造船、挑強化 —— 數字一路往上！', 470, 6 * Math.sin(u * 2.4), true);
    } });

  // ═════ 六、軍火箱：四把特殊武器（遊戲 10_data.js WEAPONS；撿到軍火箱 ⇒ 十秒內點敵艦換成那一把）═════
  //   一場、四艘敵艦隔開排：每一把武器切一個鏡頭打一艘（噴火 → 燕子號、砲擊 → 拉貝爾號、火藥桶 → 憲法號的船殼、鏈彈 → 憲法號的帆）。
  var AR = [3.3, 6.6, 9.9], KEGS = [[7.0, 7.7, 0.62, 2], [8.2, 8.9, 0.36, 1]];
  function arSeg(u) { return u < AR[0] ? 0 : u < AR[1] ? 1 : u < AR[2] ? 2 : 3; }
  function arCam(u, S) {
    var s = arSeg(u), t = [S[1], S[2], S[3], S[3]][s], v = u - [0, AR[0], AR[1], AR[2]][s];
    if (s === 3) return trAbove(trRel(t, PI / 2 + 0.5 - 0.16 * trSmooth(0, 3.5, v), 0.12, 112, 20), 2);   // 憲法號大 ⇒ 鏈彈看整面帆（第一版 62 m：只看到下半截）
    if (s === 2) return trAbove(trRel(t, PI / 2 - 0.3 + 0.08 * v, 0.1, 84, 6), 1.6);
    return trAbove(trRel(t, PI / 2 - 0.35 + 0.12 * v, s === 1 ? 0.16 : 0.09, s === 1 ? 40 : 38, 3), 1.6);
  }
  function arSide(sh, u) { return trSideFor(sh, arCam(u, SHIPS).eye); }
  var arsenal = trScene({ id: 'arsenal', dur: 13.4, seed: 404, wind: trWind(H, 0.6, 1.0), pre: 1.0,
    warp: [[0, 1], [10.45, 1], [10.6, 0.45], [12.7, 0.45], [13.0, 1]],
    fleet: [ship('blue', 'pinas', H, 0, 110), ship('red', 'swallow', H, -175, 0), ship('red', 'labelle', H, 0, 0), ship('red', 'constitution', H, 185, 0)],
    cuesU: [
      // 噴火：從海面噴出幾團希臘火，落在甲板上（核心 shot kind 'fire'）
      [0.9, 1.3, 1.7, 2.1].map(function (x, i) { return [x, function (S) { var sh = S[1], s = arSide(sh, x), F = trFR(sh), c = shipCenter(sh);
        for (var k = 0; k < 3; k++) { var a = (i - 1.5) * 4 + (k - 1) * 1.6, to = [c[0] + F.f[0] * a + F.r[0] * s * 1.5, c[1] + 2.4, c[2] + F.f[2] * a + F.r[2] * s * 1.5];
          trShot([c[0] + F.r[0] * s * 18 + F.f[0] * a * 0.5, 0.4, c[2] + F.r[2] * s * 18 + F.f[2] * a * 0.5], to, { kind: 'fire', v: 32, dmg: 2, owner: S[0], fx: k === 0 }); } }]; }),
      // 砲擊：從上面憑空落下一顆大爆裂彈（kind 'shell'）
      [4.0, 5.0].map(function (x, i) { return [x, function (S) { var sh = S[2], s = arSide(sh, x), F = trFR(sh), c = shipCenter(sh), a = i ? -6 : 5, to = [c[0] + F.f[0] * a, c[1] + 3, c[2] + F.f[2] * a];
        trShot([to[0] + F.r[0] * s * 12, to[1] + 60, to[2] + F.r[2] * s * 12], to, { kind: 'shell', v: 110, m: 220, dmg: 3, owner: S[0] }); }]; }),
      // 火藥桶：落在船殼上炸開（核心 blast）
      KEGS.map(function (k) { return [k[1], function (S) { var sh = S[3]; trBlast(trHullPt(sh, k[2], arSide(sh, k[1]), k[3]), 22, { name: '鯊魚丟的火藥桶', f: 1.6 }); }]; }),
      // 鏈彈：從鏡頭這一側打憲法號最大的三面帆（kind 'chain'）
      [10.3, 10.65, 11.0].map(function (x, i) { return [x, function (S) { var sh = S[3], s = arSide(sh, x), F = trFR(sh), q = trSailAim(sh, i), to = M4.pt(sh.M, q[0], q[1], q[2]);
        trShot([to[0] + F.f[0] * 95 + F.r[0] * s * 22, to[1] + 3, to[2] + F.f[2] * 95 + F.r[2] * s * 22], to, { kind: 'chain', v: 170, m: 18, dmg: 3, owner: S[0], fx: true }); }]; })   // 從船頭前方縱射（方帆橫在船上 ⇒ ⛔ 從船側打 ＝ 貼著帆面滑過去，三發只斷 1 條繩）
    ].reduce(function (a, b) { return a.concat(b); }, []),
    cam: function (u, tau, S) { var c = arCam(u, S), o = trShake([4.55, 5.55, 7.7, 8.9], u, 0.8); c.eye = trAddV(c.eye, o); return c; },
    black: function (u) { return AR.reduce(function (m, x) { return Math.max(m, 1 - Math.abs(u - x) / 0.14); }, 0); },   // 換武器：閃黑一下
    cap: function (g, u, tau, S) {
      var s = arSeg(u), v = u - [0, AR[0], AR[1], AR[2]][s], end = [AR[0], AR[1], AR[2], 13.4][s];
      if (s === 0 && u < 1.0 && S[1]) {                                   // 撿到軍火箱
        var c = shipCenter(S[1]), F = trFR(S[1]), sd = arSide(S[1], 0.5), w = [c[0] + F.r[0] * sd * 12 + F.f[0] * 6, 0, c[2] + F.r[2] * sd * 12 + F.f[2] * 6];
        var p = trLootAt(g, 'loot/arms', '🧰', w, u, 1 - trSmooth(0.62, 0.85, u), 'rgba(255,209,102,.9)');
        if (p) trTap(g, p[0], p[1] - 20, (u - 0.5) / 0.45);
      }
      var CARD = [['wpn/fire', '🔥', '鯊魚噴火', '從海裡噴出希臘火：點到哪裡燒到哪裡'], ['wpn/cannon', '💣', '天降砲擊', '憑空一顆大爆裂彈：點哪裡炸哪裡'],
        ['wpn/keg', '🧨', '火藥桶', '碰到船就炸開；丟在海上變水雷'], ['wpn/chain', '⛓️', '鏈彈', '帆、繩、帆桁一掃就斷']][s];
      trCardTL(g, CARD[0], CARD[1], CARD[2], CARD[3], trFade(u, (s ? AR[s - 1] : 0.75) + 0.12, end - 0.12, 0.25), s === 0 ? '撿到軍火箱 ⇒ 十秒內點敵艦不咬，換成這一把' : null);
      KEGS.forEach(function (k) {                                         // 丟出去的桶（照片長秒的弧線；落地那一刻核心炸開）
        var q = (u - k[0]) / (k[1] - k[0]); if (q < 0 || q > 1 || !S[3]) return;
        var sh = S[3], sd = arSide(sh, k[1]), B = trHullPt(sh, k[2], sd, k[3]), F = trFR(sh), A = [B[0] + F.r[0] * sd * 18, 0.3, B[2] + F.r[2] * sd * 18];
        var w = [trMix(A[0], B[0], q), trMix(A[1], B[1], q) + 20 * q * (1 - q), trMix(A[2], B[2], q)], p = trProject(w); if (!p) return;
        if (!trPicC(g, 'wpn/keg', p[0], p[1], trClamp(3600 / Math.max(6, trDistTo(w)), 34, 120), 1, q * 9.4)) trText(g, '🧨', p[0], p[1], '56px ' + TR_EMOJI, '#fff', 1, 'center');
      });
      [[0.9, 1], [4.0, 2], [7.0, 3], [10.3, 3]].forEach(function (q) { var sh = S[q[1]]; if (!sh) return; var c = shipCenter(sh), p = trProject([c[0], c[1] + (q[0] > 10 ? 12 : 2), c[2]]); if (p) trTap(g, p[0], p[1], (u - q[0]) / 0.45); });
      trLine(g, '軍火箱裡有特殊武器 —— 撿到就換一把。', trFade(u, 0.5, 3.0, 0.4), TR_CH * 0.86);
    } });

  // ═════ 七、海區：一區十個海域，第十個是守將（遊戲 10_data.js REGIONS）═════
  var RG = ['加勒比淺灘', '古代航道', '西班牙大陸', '北海風暴', '幽靈海域', '風帆巨艦', '鐵甲時代', '遠東艦隊', '大漩渦', '深淵'], ML = 2.4;
  var hA = H;
  var ancient = trScene({ id: 'sea-ancient', dur: ML + 3.6, lead: ML, seed: 480, wind: trWind(hA, 0.6, 1.0), pre: 1.2, fadeIn: 0,
    fleet: [ship('blue', 'dromon', hA - PI / 2, 4, 36, { sail: 0 }), ship('red', 'reale', hA, 0, 0)],
    cuesU: [[ML + 1.0, 1], [ML + 1.4, 2], [ML + 1.8, 3], [ML + 2.4, 4]].map(function (q) { return [q[0], function (S) { var d = S[0], e = S[1]; if (!d || !e) return;
      var Fd = trFR(d), cd = shipCenter(d), Ld = (d.T.hx1 - d.T.hx0) * 0.05, from = [cd[0] + Fd.f[0] * Ld, cd[1] + 2.5, cd[2] + Fd.f[2] * Ld], s = trSideFor(e, from);
      trShot(from, trHullPt(e, 0.25 + q[1] * 0.12, s, 14), { kind: 'fire', v: 34, dmg: 2, owner: d, fx: q[1] === 1 }); }]; }),
    cam: function (u, tau, S) {
      var d = S[0], e = S[1], v = Math.max(0, u - ML), cd = shipCenter(d), ce = shipCenter(e), m = [(cd[0] + ce[0]) / 2, 0, (cd[2] + ce[2]) / 2], ax = Math.atan2(ce[2] - cd[2], ce[0] - cd[0]);   // 兩艘之間的側面看過去（⛔ 第一版站在持火號肩後 ⇒ 鏡頭在划槳的人堆裡）
      return trAbove({ eye: trOrbit(m, ax + PI / 2 + 0.55 - 0.12 * v / 3.6, 0.17, trK2(v, 3.6, 70, 60)), look: [m[0], 3, m[2]] }, 2);
    },
    black: function (u) { return 1 - trSmooth(ML - 0.05, ML + 0.4, u); },
    over: function (g, u) {                                               // 字卡：航海圖（十個海區的徽章，船一格一格往右）
      var al = trFade(u, 0.05, ML - 0.05, 0.25); if (al <= 0.003) return;
      trDeep(g, u, al);
      trText(g, '一區十個海域，第十個是守將', TR_CW / 2, 250, '900 56px ' + TR_SANS, '#ffffff', al, 'center', 4);
      var x0 = 220, dx = 164, y = 560, q = trSmooth(0.3, ML - 0.25, u) * 9;
      g.save(); g.globalAlpha = al * 0.6; g.strokeStyle = '#7fd8ff'; g.lineWidth = 4; g.setLineDash([10, 12]); g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + dx * 9, y); g.stroke(); g.restore();
      for (var i = 0; i < 10; i++) {
        var on = q >= i - 0.15, k = on ? 1 + 0.15 * (1 - trClamp01(q - i)) : 0.82;
        trPicC(g, 'region/' + (i < 9 ? 'region-' + (i + 1) : 'abyss'), x0 + i * dx, y, 128 * k, al * (on ? 1 : 0.45));
        trText(g, RG[i], x0 + i * dx, y + 100, '700 24px ' + TR_SANS, on ? '#ffffff' : '#6f8ea6', al, 'center');
      }
      trText(g, '⛵', x0 + q * dx, y - 96, '56px ' + TR_EMOJI, '#fff', al, 'center');
    },
    cap: function (g, u) { trRegion(g, 'region-2', '古代航道', '槳帆船與希臘火，穿越時空的對手', trFade(u, ML + 0.25, ML + 3.4, 0.35), 60); } });

  var iron = trScene({ id: 'sea-iron', dur: 3.8, seed: 1862, wind: trWind(H, 0.6, 1.0), pre: 1.0,
    fleet: [ship('blue', 'virginia', H, -8, 82, { sail: 0 }), ship('red', 'monitor', H, 0, 0, { sail: 0 })],
    bites: [1.5, 2.5].map(function (u, i) { return { u: u, s: 1, r: 13, word: i ? 'CRUNCH!' : 'CHOMP!', gain: i ? '+3.9萬' : '+3.1萬',
      at: function (sh, side, eye) { var T = trTurret(sh, eye); return T ? T.at : { fx: 0.5, side: side, dz: 4 }; },
      dir: function (sh, side, eye) { var T = trTurret(sh, eye); return T ? T.dir : undefined; } }; }),
    cuesU: [[0.6, function (S) { trVol(S[0], S[1]); }]],
    cam: function (u, tau, S) { var c = trRel(S[1], PI / 2 - 0.42 + 0.1 * u, 0.13, trK2(u, 3.8, 30, 26), 2.2), o = trShake([1.5, 2.5], u, 0.4); c.eye = trAddV(c.eye, o); return trAbove(c, 1.5); },
    cap: function (g, u, tau, S, sc) { trBitesDraw(g, u, sc); trRegion(g, 'region-7', '鐵甲時代', '連鐵甲艦的砲塔，都咬得動。', trFade(u, 0.15, 3.6, 0.3), 60); } });

  trScene({ id: 'sea-maelstrom', dur: 4.4, seed: 1866, wx: 'maelstrom', wind: [0, 1.2], pre: 0.6, dist: 140, mode: 'eve', autoFire: true, cmd: ['free', 'free'], look: TR_LOOK.vortex, frag: false,
    fleet: [{ team: 'blue', hull: 'pinas' }, { team: 'red', hull: 'tridente' }],
    cuesU: [[0.9, function (S) { trVol(S[0], S[1]); }], [1.8, function (S) { trVol(S[1], S[0]); }]],
    cam: function (u) { var a = trK2(u, 4.4, -0.42, -0.12), r = trK2(u, 4.4, 300, 240); return trAbove({ eye: [Math.cos(a) * r, trK2(u, 4.4, 0, -70), Math.sin(a) * r], look: [0, -200, 0], fov: 1.0 }, 4); },
    cap: function (g, u) { trRegion(g, 'region-9', '大漩渦', '海在旋轉 —— 守將三叉戟號在漩渦裡等妳。', trFade(u, 0.15, 4.2, 0.3), 60); } });

  // ═════ 八、黃金寶船（遊戲 30_battle.js：身價 ×5、幾乎不還手、打中掉更多寶物）═════
  var LOOT = [['loot/chest', '🧰', 1.4, 0.70, 9, '+12.4萬', 3.6], ['loot/barrel', '🛢️', 2.0, 0.28, 11, '+2.1萬', 4.3], ['loot/arms', '🧰', 2.7, 0.88, 8], ['loot/bottle', '🍾', 3.1, 0.48, 13]];
  trScene({ id: 'gold', dur: 6, seed: 1715, wind: trWind(Hg, 0.6, 1.0), pre: 1.0, look: L(TR_LOOK.gold, GSUN),
    fleet: [ship('blue', 'pinas', Hg, -4, 74), ship('red', 'cosecha', Hg, 0, 0)],
    setup: function (S) { if (S[1]) S[1].reloadT = 45; },
    cuesU: [[0.6, function (S) { trVol(S[0], S[1]); }], [2.5, function (S) { trVol(S[0], S[1]); }]],
    cam: function (u, tau, S) { return trAbove(trRel(S[1], PI / 2 - trK2(u, 6, 0.35, 0.05), trK2(u, 6, 0.1, 0.13), trK2(u, 6, 62, 54), 5), 2); },
    cap: function (g, u, tau, S) {
      var sh = S[1]; if (!sh) return;
      var c = shipCenter(sh), p = trProject([c[0], c[1] + 4, c[2]]), F = trFR(sh), sd = trSideFor(sh, CAM.eye || c);
      if (p) { g.save(); g.globalCompositeOperation = 'lighter'; var gr = g.createRadialGradient(p[0], p[1], 20, p[0], p[1], 520); gr.addColorStop(0, 'rgba(255,200,80,.30)'); gr.addColorStop(1, 'rgba(255,200,80,0)'); g.fillStyle = gr; g.fillRect(p[0] - 520, p[1] - 520, 1040, 1040); g.restore(); }
      var pt = trProject([c[0], c[1] + 17, c[2]]);
      if (pt) { trPicC(g, 'loot/goldmark', pt[0] - 120, pt[1], 84, trFade(u, 0.3, 5.8, 0.3)); trBold(g, '黃金寶船', pt[0] + 20, pt[1], 44, '#ffe08a', '#5a3300', trFade(u, 0.3, 5.8, 0.3), 'center', 8); }
      LOOT.forEach(function (o) {
        if (u < o[2]) return;
        var w = [c[0] + F.r[0] * sd * o[4] + F.f[0] * (o[3] - 0.5) * 40, 0, c[2] + F.r[2] * sd * o[4] + F.f[2] * (o[3] - 0.5) * 40], take = o[6] ? trSmooth(o[6], o[6] + 0.3, u) : 0;
        var q = trLootAt(g, o[0], o[1], w, u, trSmooth(o[2], o[2] + 0.25, u) * (1 - take), 'rgba(255,209,102,.8)');
        if (o[6] && q) { trTap(g, q[0], q[1] - 20, (u - o[6] + 0.15) / 0.45); trFloatG(g, q[0], q[1] - 60, o[5], (u - o[6]) / 1.3, TR_SK.gold, 50); }
      });
      trBold(g, '黃金寶船出現了！', TR_CW / 2, 150, 72, '#ffe08a', '#5a3300', trFade(u, 0.2, 2.6, 0.3), 'center', 12, 'rgba(255,190,60,.7)');
      trText(g, '身價 ×5、幾乎不還手、打中會掉更多寶物 —— 快咬！', TR_CW / 2, 228, '700 34px ' + TR_SANS, '#fff4d6', trFade(u, 0.4, 2.8, 0.3), 'center', 2);
      trLine(g, '漂出來的寶物，點一下就撿。', trFade(u, 3.3, 5.8, 0.4), TR_CH * 0.84);
    } });

  // ═════ 九、巨齒鯊（遊戲 ABIL mega：每艘敵艦都被狠狠咬一大口）═════
  var MG = 0.6, megaB = [1.55, 1.75, 1.95].map(function (u, i) { return { u: u, s: i + 1, fx: [0.45, 0.55, 0.5][i], dz: 0, r: 22, big: 1, tap: false, word: i === 1 ? 'MEGA CHOMP!' : null, gain: ['+4.2萬', '+5.8萬', '+9.6萬'][i] }; });
  var mega = trScene({ id: 'mega', dur: 6.4, seed: 1000, wind: trWind(H, 0.6, 1.0), pre: 1.0,
    warp: [[0, 1], [1.45, 1], [1.6, 0.35], [3.3, 0.35], [3.7, 1]],
    fleet: [ship('blue', 'pinas', H, 0, 150), ship('red', 'swallow', H, -62, 0), ship('red', 'labelle', H, 0, 4), ship('red', 'ember', H, 66, 0)],
    bites: megaB,
    cam: function (u, tau, S) {
      var m = [0, 0]; for (var i = 1; i < 4; i++) { m[0] += S[i].px / 3; m[1] += S[i].pz / 3; }
      var o = trShake(trHits(megaB), u, 1.2), c = { eye: trOrbit([m[0], 0, m[1]], SA + trK2(u, 6.4, -0.12, 0.08), trK2(u, 6.4, 0.13, 0.10), trK2(u, 6.4, 112, 96)), look: [m[0], 5, m[1]] };
      c.eye = trAddV(c.eye, o); return trAbove(c, 3);
    },
    cap: function (g, u, tau, S, sc) {
      var bp = trPop((u - 0.25) / 0.4), ba = trFade(u, 0.2, 1.2, 0.2);     // 按下技能鈕（下方中間）
      if (ba > 0.003) { g.save(); g.globalAlpha = ba; g.fillStyle = 'rgba(6,18,32,.85)'; trRound(g, TR_CW / 2 - 70 * bp, TR_CH - 210, 140 * bp, 140 * bp, 26); g.fill(); g.strokeStyle = '#ffd166'; g.lineWidth = 4; g.stroke(); g.restore();
        trPicC(g, 'abil/mega', TR_CW / 2, TR_CH - 210 + 70 * bp, 104 * bp, ba); trTap(g, TR_CW / 2, TR_CH - 140, (u - 0.4) / 0.45); }
      trMegaFx(g, (u - MG) / 2.2);
      trBitesDraw(g, u, sc);
      trLine(g, '技能：全艦齊射、鯊魚狂潮、巨齒鯊、緊急搶修。', trFade(u, 4.0, 6.2, 0.4), TR_CH * 0.84);
    } });

  // ═════ 十、潛回亞特蘭提斯（轉生）＋離線收益 ═════
  trScene({ id: 'atlantis', dur: 7, seed: 3, wind: [0, 1], fadeOut: 0.3, fleet: [ship('blue', 'flyingfish', H, 0, 0)],
    cam: function (u, tau, S) { return trAbove(trRel(S[0], PI / 2, 0.2, 60, 4)); },
    cap: function (g, u) {
      var x = trSmooth(3.7, 4.3, u);
      trCover(g, 'key/atlantis', 1 - x, 1.02 + 0.07 * trClamp01(u / 4.3), 0.5, 0.35);
      for (var i = 0; i < 18; i++) {                                      // 三叉戟碎片往上飄（固定軌跡）
        var a = i * 2.39996, px = TR_CW * (0.12 + 0.76 * (Math.sin(a * 5.3) * 0.5 + 0.5)), py = TR_CH * 1.05 - ((u * (90 + (i % 5) * 30) + i * 61) % (TR_CH * 0.9));
        trPicC(g, 'ui/shards', px, py, 46 + (i % 3) * 14, (1 - x) * 0.85 * trSmooth(0.2, 0.8, u), Math.sin(u + i) * 0.3);
      }
      trBold(g, '潛回亞特蘭提斯', TR_CW / 2, 250, 92, '#f1e6ff', '#2a0f4a', trFade(u, 0.4, 3.9, 0.4) * (1 - x), 'center', 14, 'rgba(181,140,255,.9)');
      trText(g, '打不動了就轉生：帶走三叉戟碎片，收入永久變多，再出海。', TR_CW / 2, 860, '700 40px ' + TR_SANS, '#ffffff', trFade(u, 0.9, 3.9, 0.4) * (1 - x), 'center', 2);
      trCover(g, 'key/welcome', x, 1.06 - 0.04 * trClamp01((u - 3.7) / 3.3), 0.5, 0.45);
      var ca = trFade(u, 4.4, 6.9, 0.35);                                  // 遊戲的「歡迎回來」（離線收益）
      if (ca > 0.003) {
        g.save(); g.globalAlpha = ca; g.fillStyle = 'rgba(6,18,32,.9)'; trRound(g, TR_CW / 2 - 440, 600, 880, 230, 28); g.fill(); g.strokeStyle = 'rgba(255,209,102,.8)'; g.lineWidth = 3; g.stroke(); g.restore();
        trText(g, '⚓ 歡迎回來！', TR_CW / 2, 660, '900 48px ' + TR_SANS, '#ffffff', ca, 'center', 2);
        trText(g, '妳不在的 8 小時，艦隊自己打了', TR_CW / 2, 728, '600 34px ' + TR_SANS, '#cfe6f5', ca, 'center', 1);
        trBold(g, trFmtZh(trKey([[4.6, 0], [5.8, 3.6e9]], u)) + ' 格', TR_CW / 2, 790, 58, TR_SK.gold, '#2a1600', ca, 'center', 9);
      }
      trLine(g, '關掉也在打：離線收益，回來就有一整箱。', trFade(u, 4.6, 6.9, 0.4), TR_CH * 0.93);
    } });

  // ═════ 十一、片尾 ═════
  trScene({ id: 'end', dur: 8.5, seed: 4, wind: [0, 1], fadeIn: 0.4, fadeOut: 0, fleet: [ship('blue', 'flyingfish', H, 0, 0)],
    cam: function (u, tau, S) { return trAbove(trRel(S[0], PI / 2, 0.2, 60, 4)); },
    cap: function (g, u) {
      trCover(g, 'key/title-land', 1, 1.06 - 0.04 * u / 8.5, 0.5, 0.42);
      trPicC(g, 'app/logo', TR_CW / 2, 178, 800 * trPop((u - 0.2) / 0.6), trSmooth(0.2, 0.5, u));
      trText(g, '鯊魚艦隊的無盡海', TR_CW / 2, 362, '900 46px ' + TR_SANS, '#ffffff', trFade(u, 0.7, 99, 0.4), 'center', 10);
      var ca = trFade(u, 1.2, 99, 0.4);
      if (ca > 0.003) { g.save(); g.globalAlpha = ca; g.fillStyle = 'rgba(6,18,32,.82)'; trRound(g, TR_CW / 2 - 400, 412, 800, 128, 26); g.fill(); g.strokeStyle = 'rgba(255,209,102,.85)'; g.lineWidth = 3; g.stroke(); g.restore(); }
      trText(g, '免費・網頁直接玩・手機也可以', TR_CW / 2, 452, '800 38px ' + TR_SANS, '#ffffff', ca, 'center', 2);
      trText(g, 'tim099.github.io/Sharkside', TR_CW / 2, 506, '800 36px ' + TR_SANS, TR_SK.gold, ca, 'center', 1);
      trSasha(g, 'smug', -10, TR_CH + 20, 600, trSmooth(1.6, 2.1, u), '還不快上船？本鯊魚的艦隊在等妳！', 470, 6 * Math.sin(u * 2.2), true);
      var cr = trFade(u, 2.4, 99, 0.5);
      var CL = trWrap(g, '出場的船：' + TR_CREDIT_SHIPS(), TR_CW - 160, '400 19px ' + TR_SANS);
      if (cr > 0.003) { g.save(); g.globalAlpha = cr * 0.8; g.fillStyle = 'rgba(3,9,16,.82)'; g.fillRect(0, TR_CH - 56 - 28 * CL.length, TR_CW, 56 + 28 * CL.length); g.restore(); }
      trText(g, '海戰核心與船：Blockside（ame 與每一艘船的造船者）　美術：Sirius　外殼與分鏡：gura　影片框架：kaguya　監製：Tim', TR_CW / 2, TR_CH - 30 - 28 * CL.length, '500 22px ' + TR_SANS, '#cfe2f0', cr, 'center', 1);
      CL.forEach(function (s, i) { trText(g, s, TR_CW / 2, TR_CH - 22 - 28 * (CL.length - 1 - i), '400 19px ' + TR_SANS, '#9fb8cc', cr, 'center', 1); });
    } });
  TR.endShow = 8;

  // ── 配樂（片長秒）：開場只有咬下去的重拍 ⇒ 片名一出來〈酒醉的水手〉（遊戲 02_music.js 'drunken'，Terry《The Shanty Book》1921）一路到片尾 ──
  var T = {}; TR.S.forEach(function (s) { T[s.id] = s.t0; });
  TR_SCORE = [
    { at: T.hook + 0.3, pad: [38, 45, 50], len: 7.4, v: 0.32, fin: 1.6, fout: 0.8, inst: 'drone' },
    { at: T.hook + 2.6, hit: 1, v: 1.3, f0: 60, f1: 26, len: 2.6 }, { at: T.hook + 4.7, hit: 1, v: 0.9, f0: 70, f1: 30, len: 1.6 }, { at: T.hook + 5.6, hit: 1, v: 1.2, f0: 55, f1: 24, len: 2.2 },
    { at: T.title - 1.3, rise: 1.3, v: 1.0 }, { at: T.title, hit: 1, v: 1.3, f0: 70, f1: 30, len: 2.4 }, { at: T.title + 0.4, bell: 147, v: 0.7 },
    trSeg('drunken', T.title + 0.2, TR.DUR, { x: 0, fin: 0.6, fout: 3.0, gain: 0.95 }),
    { at: T.arsenal + 4.55, hit: 1, v: 0.8 }, { at: T.arsenal + 7.7, hit: 1, v: 0.9 }, { at: T.arsenal + 8.9, hit: 1, v: 0.9 },
    { at: T['sea-ancient'], bell: 196, v: 0.5 },
    { at: T.mega + MG - 0.2, rise: 1.0, v: 0.9 }, { at: T.mega + 1.55, hit: 1, v: 1.4, f0: 55, f1: 24, len: 3.0 },
    { at: T.atlantis + 0.3, bell: 147, v: 0.6 }, { at: T.end + 0.3, hit: 1, v: 1.1, f0: 60, f1: 28, len: 2.6 }, { at: T.end + 1.2, bell: 196, v: 0.7 }
  ];
}
/** 砲塔的殼（莫尼特號）朝鏡頭那一面的一點與往裡的方向（船的格座標；核心 bite 的 at／dir）；沒有砲塔 ⇒ null。 */
function trTurret(sh, eye) {
  var A = (sh.arm || []).filter(function (a) { return !a.prop && a.A && a.A.bb; })[0]; if (!A) return null;
  var b = A.A.bb, C = [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2], e = toLocal(sh, eye), d = [e[0] - C[0], e[1] - C[1]], l = Math.hypot(d[0], d[1]) || 1, R = (b[4] - b[1]) / 2;
  return { at: [C[0] + d[0] / l * R, C[1] + d[1] / l * R, C[2] + 3], dir: [-d[0] / l, -d[1] / l, 0] };
}
/** 片尾：出場的船與造船者（核心的船型清單：名字、作者）。 */
function TR_CREDIT_SHIPS() {
  var seen = {}, out = [];
  TR.S.forEach(function (sc) { (sc.fleet || []).forEach(function (f) { if (seen[f.hull]) return; seen[f.hull] = 1; var h = (TR_API && TR_API.hulls ? TR_API.hulls() : []).filter(function (x) { return x.id === f.hull; })[0]; out.push((h ? h.name : f.hull) + (h && h.author ? '（' + h.author + '）' : '')); }); });
  return out.join('、');
}
