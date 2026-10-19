// ── 分鏡（時間軸）：每一幕的開局、鏡頭、字幕 ──
// Tim 2026-10-18：「可以安排多個場景 然後有歷史的厚重&魔法的神秘(魔法船)」「可以的話 讓所有船都出場」「儘可能在影片中展現遊戲各種特色(包含體素破壞 進水模擬 撞擊傷害等)」
//   「加上一些歷史故事介紹」「時長可以拉長一些」「例如南北戰爭的海戰」「船的演化」「船的各種資訊介紹(六分儀」「帆的發明」「各種船隻的專有名詞等 帶點科普教育意義」
//   「黑船打開日本國門」「造船的取材(需要用原本就彎曲的木材造彎曲部分才有足夠強度)」「獎帆船與拜占庭的覆滅」
// 九段：開場（先打一場：憲法號對餘燼號）→ 序幕（沒有船：帆的發明、最早的海戰、三列槳座戰船、烏鴉 —— 放映時背景把十七艘全部載好）→ 一、槳與帆 → 二、風帆的極致 → 三、蒸汽與鐵 → 四、1862 漢普頓錨地 → 五、每一格都算數（引擎）→ 六、傳說與魔法 → 七、全艦隊與片名。
// 十七艘一艘不漏（持火號、皇家號、收穫號、三叉戟號、憲法號、拿破崙號、蘇士奎哈納號、光榮號、維吉尼亞號、莫尼特號、哨兵號、炎羽號、餘燼號、夜隼號、風暴角號、潮墓號、夜燈號）。
//   出自十三位雕刻者（遊戲 config/game.json 的 ships[].author，2026-10-19 數：basecamp 三艘、summit 兩艘、meadow 兩艘，其餘一人一艘）；每一位都要在畫面上署名一次（炎羽號 kiara 只在撞角那幕出場 ⇒ 寫在代演那行）。
// 史實：各作品的研究檔（Sculpture/works/<作品>/references、notes.md）寫的照寫；研究檔沒有的只寫公認、確定的（年份、事件），沒把握的數字不寫。
//   代演：歷史場面裡由別艘船演的，畫面上寫明（坎伯蘭號 ← 炎羽號、國會號 ← 憲法號）；導演直接動手的也寫明（trNote），之後怎麼演變都交給遊戲算：
//     國會號的火與最後的殉爆（congress）、光榮號水線下的破口（ports）、三叉戟號兩面帆上的火（greekfire：噴口搆不到帆）、餘燼號的火藥庫（magazine）。
var TR_SCORE = null;
var TR_SUN0 = null;
/** 太陽的方位角（世界；遊戲的 SUN 是「往太陽的方向」）。 */
function trSunAz(d) { d = d || SUN; return Math.atan2(d[2], d[0]); }
/** 船頭朝方位角 h（世界）⇒ yaw（fwd(yaw) ＝ [cos, 0, −sin] ⇒ 方位角 ＝ −yaw）。 */
function trYaw(h) { return -h; }
/** 船頭朝 h、要順風（風往船頭左右 off 弧度的方向吹）⇒ WIND_FIX 的 rot（度；WIND0 往 +z 吹 ＝ 方位角 π/2）。 */
function trWind(h, off, s) { return [((h + (off === undefined ? 0.6 : off)) - Math.PI / 2) * 180 / Math.PI, s || 1.15]; }
/** 對船的相對鏡頭：ra ＝ 相對船頭的方位（0 船頭、+π/2 右舷、π 船尾）、el 仰角、d 距離、up 注視點抬高、fx 注視點沿船頭前後移。 */
function trRel(sh, ra, el, d, up, fx) {
  var c = shipCenter(sh), f = fwd(sh.yaw); c = [c[0] + f[0] * (fx || 0), c[1] + (up || 0), c[2] + f[2] * (fx || 0)];
  return { eye: trOrbit(c, trAzOf(sh) + ra, el, d), look: c };
}
/** 鏡頭貼著海面時別鑽到浪底下。 */
function trAbove(c, h) { var y = seaH(c.eye[0], c.eye[2], SIMT) + (h || 1.2); if (c.eye[1] < y) c.eye[1] = y; return c; }
/** 兩端內插（一幕裡從 a 慢慢到 b）。 */
function trK2(u, D, a, b) { return trKey([[0, a], [D, b]], u); }
/** 開砲（一舷或兩舷）：砲全部裝好、瞄 foe 的格座標 aim（沒給 ＝ 船中段、照遊戲的瞄準高度）。 */
function trVolley(sh, foe, ammo, aim) {
  sh.guns.forEach(function (g) { if (g.alive) g.reload = 0; });
  setAim(sh, aim || [foe.T.cx, foe.T.cy, foe.T.geo.aim], foe);
  return broadside(sh, ammo || 0, false);
}
/** 對空鳴砲（沒有敵艦也能開）：每一步開下一門裝好的。 */
function trSalute(sh) { fireOne(sh, 0); }
/** 船上某一種模型（meta kind）的中心（世界）；沒有 ⇒ null。 */
function trModelAt(sh, kind, k) { var L = sh.models.filter(function (m) { return m.meta && m.meta.kind === kind; }), m = L[k || 0]; return m ? M4.pt(sh.M, m.c[0], m.c[1], m.c[2]) : null; }
/** 第一根煙囪的排煙口（世界）。 */
function trFunnelAt(sh) { var F = funnelsOf(sh.T)[0]; return F ? M4.pt(sh.M, F.p[0], F.p[1], F.p[2]) : null; }
/** 船上一格（格座標）⇒ 世界。 */
function trCellAt(sh, x, y, z) { return M4.pt(sh.M, x, y, z); }
/** 導演開的水線下破口（砲門那一幕：示範側傾）：一舷（side ＋1 右舷、−1 左舷）x0..x1 欄、水線下 dz0..dz1 格，從最外那一格往裡拆到通進艙內（最多 30 格）⇒ 之後的進水、側傾全照遊戲算。回拆了幾格。 */
function trBreach(sh, side, x0, x1, dz0, dz1) {
  var T = sh.T, g = sh.grid, n = 0, Y0 = side > 0 ? g.sy - 1 : 0, dy = side > 0 ? -1 : 1;
  for (var x = x0; x <= x1; x++) for (var z = T.zw - dz0; z <= T.zw - dz1; z++) {
    var y = Y0; while (y !== T.cy && !g.get(x, y, z)) y += dy;
    for (var k = 0; k < 30 && y !== T.cy && g.get(x, y, z); k++, y += dy) { removeVoxel(sh, x, y, z, false); n++; }
  }
  return n;
}
/** 導演點火（國會號那一幕；遊戲裡只有希臘火會點火）：TASK-0717 的 burnSplash 在 ⇒ 用它（同一套延燒、救火）；沒有 ⇒ 什麼都不做。 */
function trIgnite(sh, L) { if (typeof burnSplash === 'function') burnSplash(sh, L, { owner: -1, ammo: 3 }); }
var TR_LOOK = {
  dusk: { sky: [0.30, 0.25, 0.36], horizon: [0.93, 0.55, 0.32], ground: [0.17, 0.12, 0.10], fog: 0.0024, sun: 0.62, lum: 0.72, foam: 0 },
  gold: { sky: [0.40, 0.47, 0.60], horizon: [0.96, 0.78, 0.55], ground: [0.20, 0.17, 0.13], fog: 0.0017, sun: 0.92, lum: 0.92 },
  grey: { sky: [0.42, 0.45, 0.49], horizon: [0.62, 0.63, 0.64], ground: [0.16, 0.16, 0.15], fog: 0.0030, sun: 0.55, lum: 0.80 },
  night: { sky: [0.015, 0.025, 0.06], horizon: [0.05, 0.07, 0.12], ground: [0.015, 0.02, 0.03], fog: 0.0030, sun: 0.10, lum: 0.30 },
  storm: { sky: [0.10, 0.12, 0.15], horizon: [0.17, 0.19, 0.22], ground: [0.06, 0.06, 0.06], fog: 0.0048, sun: 0.22, lum: 0.42, foam: 1 },
  fog: { sky: [0.36, 0.40, 0.43], horizon: [0.48, 0.52, 0.55], ground: [0.12, 0.13, 0.13], fog: 0.0085, sun: 0.35, lum: 0.62 },
  // 剖面：遊戲會拿掉船邊（往鏡頭那側多 30 m）的海面好看到水線以下 ⇒ 露出來的是地平線以下的霧色；霧色壓成深青綠 ⇒ 那一塊讀起來像深水
  vortex: { sky: [0.12, 0.16, 0.20], horizon: [0.22, 0.27, 0.31], ground: [0.07, 0.08, 0.09], fog: 0.0012, sun: 0.45, lum: 0.55, foam: 1 },   // 大漩渦：暴風雨的霧太濃（0.0048）⇒ 遠鏡頭只剩一片灰
  section: { sky: [0.36, 0.46, 0.55], horizon: [0.11, 0.23, 0.29], ground: [0.10, 0.12, 0.13], fog: 0.0014, sun: 1.0, lum: 1.0 }
};
/** 兩種天色之間（u 從 0 到 1）。 */
function trLookMix(a, b, u) { var o = {}; for (var k in a) o[k] = typeof a[k] === 'number' ? trMix(a[k], b[k] === undefined ? a[k] : b[k], u) : trMixV(a[k], b[k] || a[k], u); return o; }
/** 綠色鬼火（只畫：照 τ 算的固定軌跡，不抽亂數、不碰模擬）。 */
function trWisps(push, sh, n, tau, rgb, size, spread) {
  var c = shipCenter(sh), f = fwd(sh.yaw), r = [-f[2], 0, f[0]];
  for (var i = 0; i < n; i++) {
    var a = i * 2.39996, ph = tau * (0.22 + 0.05 * (i % 5)) + a;
    var x = Math.sin(a * 3.1 + ph * 0.7) * spread * 0.55, z = Math.cos(a * 1.7 + ph) * spread * 0.22, y = 2 + ((i * 0.37 + tau * 0.12) % 1) * spread * 0.45;
    var p = [c[0] + f[0] * x + r[0] * z, c[1] + y - 6, c[2] + f[2] * x + r[2] * z];
    var fl = 0.5 + 0.5 * Math.sin(tau * (1.3 + (i % 7) * 0.21) + i);
    push(p, size * (0.6 + 0.6 * fl), rgb, 0.10 + 0.22 * fl);
  }
}
/** 右下角一行小字（代演、導演點火之類的說明）。 */
function trNote(g, s, al) { trText(g, s, TR_CW - 120, TR_CH * 0.925 - 26, '400 22px ' + TR_SANS, '#bdb39d', al * 0.85, 'right', 1); }

function trScenes() {
  if (TR.S.length) return;
  TR_SUN0 = SUN.slice();
  var SA = trSunAz(TR_SUN0), PI = Math.PI;
  var DUSK_SUN = norm([-0.93, 0.10, -0.36]), GOLD_SUN = norm([-0.78, 0.30, -0.55]), MOON = norm([0.35, 0.55, -0.75]);
  function L(o, sun) { var x = Object.assign({}, o); if (sun) x.sunDir = sun; return x; }
  function one(hull, h, extra) { return [Object.assign({ team: 'blue', hull: hull, x: 0, z: 0, yaw: trYaw(h), hold: 1 }, extra || {})]; }
  function BY(s) { return '雕刻：' + s; }
  /** 一幕標準的「歷史的行列」：船名下三分之一＋故事＋名詞卡＋（選）資料卡。 */
  function hist(o) {
    var h = o.h;
    return trAdd({ id: o.id, dur: o.dur, seed: o.seed, wx: o.wx || 'clear', wind: o.wind || trWind(h, o.wOff, o.wS), mode: o.mode || 'sandbox', pre: o.pre === undefined ? 1.0 : o.pre,
      phx: o.phx, dist: o.dist, gap: o.gap, autoFire: o.autoFire, cmd: o.cmd, rate: o.rate, era: o.era, portWant: o.portWant, ports: o.ports, needAll: o.needAll,
      fleet: o.fleet || one(o.hull, h, o.ext), look: o.look, year: o.year, marks: o.marks, cut: o.cut, cues: o.cues, setup: o.setup, fadeIn: o.fadeIn, fadeOut: o.fadeOut, black: o.black, fx: o.fx,
      cam: o.cam,
      cap: function (g, u, tau, S, sc) {
        var D = sc.dur;
        if (o.name) trLower(g, { year: o.yl, name: o.name, line: o.line, by: o.by, col: o.col }, trFade(u, o.lowAt || 0.4, D - 0.3, 0.4));
        if (o.story) trStory(g, o.story, u, o.storyAt || 0.9, D - 0.3);
        if (o.term) trTerm(g, o.term, trFade(u, o.termAt || D * 0.42, D - 0.3, 0.5));
        if (o.spec) trSpec(g, o.spec, trFade(u, o.specAt || D * 0.5, D - 0.3, 0.5), u);
        if (o.note) trNote(g, o.note, trFade(u, 0.6, D - 0.3, 0.4));
        if (o.cap2) o.cap2(g, u, tau, S, sc);
      } });
  }

  // ═════ 開場：先打一場（Tim 2026-10-19：「可以多加一些戰鬥畫面(最好一開始就有 抓住玩家目光)」）═════
  //   只用兩艘：憲法號（遊戲內建，不用載）、餘燼號（封面時先載）⇒ 按下 ▶ 就有；這一幕播的時候不載別的船（trLoadGate），對轟不會頓。慢動作 0.6 倍看木屑。
  var hK0 = trSunAz(DUSK_SUN) - PI / 2 + 0.35;
  hist({ id: 'hook', dur: 10, seed: 1812, h: hK0, wind: trWind(hK0, 0.6, 0.8), pre: 1.0, rate: 0.6, fadeIn: 0.5, look: L(TR_LOOK.dusk, DUSK_SUN),
    fleet: [{ team: 'blue', hull: 'constitution', x: 0, z: 0, yaw: trYaw(hK0), hold: 1, sail: 1 },
            { team: 'red', hull: 'ember', x: Math.cos(hK0 - PI / 2) * 58, z: Math.sin(hK0 - PI / 2) * 58, yaw: trYaw(hK0), hold: 1, sail: 1 }],
    cues: [{ at: 1.0 + 0.5, fn: function (S) { trVolley(S[1], S[0], 0); } },
           { at: 1.0 + 2.4, fn: function (S) { trVolley(S[0], S[1], 0); } }],
    cam: function (u, tau, S) { var a = S[0], b = S[1], c = [(a.px + b.px) / 2, 0, (a.pz + b.pz) / 2], f = fwd(a.yaw), az = trAzOf(a) + trK2(u, 10, 0.50, 0.30);
      return trAbove({ eye: trOrbit([c[0] + f[0] * 8, 6, c[2] + f[2] * 8], az, trK2(u, 10, 0.06, 0.10), trK2(u, 10, 72, 60)), look: [c[0] - f[0] * 8, 6, c[2] - f[2] * 8] }, 2); },
    note: '遊戲裡的對戰（虛構）',
    cap2: function (g, u) { trLine(g, '每一發砲彈、每一塊木屑，都是遊戲當下算出來的。', trFade(u, 5.4, 9.6, 0.6), TR_CH * 0.80); } });

  // ═════ 序幕：沒有船（Tim 2026-10-19：「開頭播一段科普 不用船隻的 趁這段時間載入第一幕的船隻」「那或是在一開頭就載入全部 … 可以多加一些科普內容在開頭」）═════
  //   只有海＋會動的插圖；十七艘全部在這一幕載好、熱身完（序幕之後那一幕 needAll）⇒ 之後整支片不再載船。2026-10-19 量：冷載全部 ~20 秒＋熱身 ~5 秒 ⇒ 31 秒。
  //   史實（沒把握的數字不寫）：薩拉米斯海戰 西元前 480 年；三列槳座戰船每舷上中下 31／27／27 支槳、約 170 名槳手、船首包銅撞角；米列海戰 西元前 260 年，羅馬人的「烏鴉」吊橋。
  var hP = trSunAz(DUSK_SUN), DP = 31;
  trAdd({ id: 'prologue', free: true, dur: DP, seed: 3000, wind: trWind(hP, 2.4, 0.55), mode: 'sandbox', pre: 0.5, fadeIn: 0, fadeOut: 0, fleet: [], look: L(TR_LOOK.dusk, DUSK_SUN),
    cam: function (u) {
      var f = [Math.cos(hP), 0, Math.sin(hP)], d = 2.6 * u, e = [f[0] * d, 2.4 + 0.5 * Math.sin(u * 0.35), f[2] * d];   // 貼著海面往夕陽慢慢滑
      return trAbove({ eye: e, look: [e[0] + f[0] * 300, e[1] - 9 + 3 * trSmooth(0, DP, u), e[2] + f[2] * 300], fov: 0.95 }, 1.6);
    },
    black: function (u) { return Math.max(1 - trSmooth(0, 1.6, u), trSmooth(DP - 0.7, DP, u)); },
    cap: function (g, u) {
      trLine(g, '約五千年前，尼羅河上，有人第一次把布掛上了桅杆。', trFade(u, 0.8, 4.9, 0.6), TR_CH * 0.46);
      trLine(g, '從此，人類借著風，去了遠方。', trFade(u, 2.3, 4.9, 0.6), TR_CH * 0.54);
      trLine(g, '約西元前 1175 年，埃及神廟的牆上刻下了一場海戰：', trFade(u, 5.4, 9.9, 0.6), TR_CH * 0.46);
      trLine(g, '法老拉美西斯三世的船隊，迎戰「海上民族」。', trFade(u, 6.7, 9.9, 0.6), TR_CH * 0.54);
      trTrireme(g, u - 10.4, trFade(u, 10.4, 18.0, 0.6), TR_CW * 0.46, TR_CH * 0.45, 1);   // 名詞卡在右上 ⇒ 插圖放低一點（底板上緣 ≥ 卡片下緣）
      trTerm(g, { zh: '三列槳座戰船', en: 'trireme', def: ['槳手分上、中、下三層坐，', '一層層錯開，槳才不會打架。'] }, trFade(u, 12.2, 18.0, 0.5));
      trLine(g, '西元前 480 年，薩拉米斯海峽。', trFade(u, 10.8, 18.0, 0.6), TR_CH * 0.72);
      trLine(g, '雅典的三列槳座戰船，用船首包銅的撞角，', trFade(u, 12.0, 18.0, 0.6), TR_CH * 0.78);
      trLine(g, '撞沉了波斯的戰船。', trFade(u, 13.2, 18.0, 0.6), TR_CH * 0.84);
      trCorvus(g, u - 18.6, trFade(u, 18.6, 25.6, 0.6), TR_CW * 0.47, TR_CH * 0.40, 0.85);
      trLine(g, '西元前 260 年，不擅海戰的羅馬人，在船頭立起一座吊橋「烏鴉」：', trFade(u, 19.0, 25.6, 0.6), TR_CH * 0.72);
      trLine(g, '放下來，尖釘釘住敵船，步兵衝過去 ——', trFade(u, 20.4, 25.6, 0.6), TR_CH * 0.78);
      trLine(g, '把海戰打成了陸戰。', trFade(u, 21.8, 25.6, 0.6), TR_CH * 0.84);
      trLine(g, '這一千多年裡，海戰靠的是槳、撞角與接舷肉搏 ——', trFade(u, 26.1, 30.3, 0.6), TR_CH * 0.46);
      trLine(g, '直到有一種船，從船首噴出了火。', trFade(u, 27.4, 30.3, 0.6), TR_CH * 0.54);
    } });

  // ═════ 一、槳與帆（持火號）═════
  var hD = trSunAz(DUSK_SUN) - PI / 2 + 0.25;
  hist({ id: 'open-dromon', dur: 8.6, seed: 911, h: hD, wind: trWind(hD, 2.4, 0.6), pre: 5.4, fadeIn: 0, hull: 'dromon', ext: { tele: 0 }, look: L(TR_LOOK.dusk, DUSK_SUN), year: 950,
    needAll: true,   // 十七艘全部載好才進場（序幕載；director.js trFrame）
    cues: [7.0, 7.15, 7.3, 7.45, 7.6, 7.75, 7.9].map(function (s) { return { at: 1.0 + s, fn: function (S) { var sh = S[0], g = sh.guns.filter(function (q) { return GUNS[q.type] && GUNS[q.type].close; })[0] || sh.guns[0]; if (!g) return; evEmit('gfJet', M4.pt(sh.M, g.muz[0], g.muz[1], g.muz[2]), norm(add(gunAxis(sh, g), [0, 0.12, 0])), sh.vel); } }; }),
    // 2026-10-19：前 4.4 秒的黑底字幕搬到序幕（沒有船）⇒ 這一幕從船出現那一刻開始；pre 1.0 → 5.4（模擬時間跟以前同一條：希臘火照樣在模擬第 8 秒噴），鏡頭照舊的時間（u ＋ 4.4）
    cam: function (u, tau, S) { u += 4.4; return trAbove(trRel(S[0], trK2(u, 13, 1.2, 0.5), 0.05, trK2(u, 13, 36, 24), 1.5, 4)); },
    black: function (u) { return 1 - trSmooth(0, 1.4, u); },
    yl: '十世紀 · 東羅馬帝國', name: '持火號', line: '雙層槳、三角帆，船首青銅噴口，甲板上弩砲與投石機', by: BY('erina'), lowAt: 2.2, storyAt: 3.2,
    story: ['東羅馬帝國的戰艦，從船首的銅管噴出「希臘火」。', '配方是帝國的最高機密，至今沒有人知道它確切的成分。'],
    term: { zh: '三角帆', en: 'lateen sail', def: ['斜掛在長帆桁上的三角形帆。', '比方帆更能斜著逆風前進。'] }, termAt: 5.4 });
  // 東羅馬帝國的覆滅（1453；Tim：「拜占庭 改稱為東羅馬帝國」）：持火號往霧裡退去
  hist({ id: 'byzantium', dur: 8, seed: 1453, h: hD + 0.4, wind: trWind(hD + 0.4, 2.4, 0.5), pre: 1.0, hull: 'dromon', ext: { tele: 0 }, look: L(trLookMix(TR_LOOK.dusk, TR_LOOK.fog, 0.6), DUSK_SUN), year: 1453,
    cam: function (u, tau, S) { return trAbove(trRel(S[0], trK2(u, 8, PI - 0.5, PI - 0.25), 0.06, trK2(u, 8, 40, 75), 2)); },
    cap2: function (g, u) {
      trTitle(g, '1453', '君士坦丁堡陷落', trFade(u, 0.5, 7.6, 0.6), TR_CH * 0.36);
      trLine(g, '鄂圖曼人把戰船拖過山丘，放進了金角灣。', trFade(u, 1.8, 7.6, 0.6), TR_CH * 0.66);
      trLine(g, '延續千年的東羅馬帝國，在這一年結束。', trFade(u, 3.2, 7.6, 0.6), TR_CH * 0.73);
    } });

  // ═════ 一、槳與帆 ═════
  var hC = SA - PI / 2 - 0.3;
  hist({ id: 'cosecha', dur: 10, seed: 1618, h: hC, hull: 'cosecha', look: L(TR_LOOK.gold, GOLD_SUN), year: 1618, pre: 1.2,
    cam: function (u, tau, S) { return trAbove(trRel(S[0], trK2(u, 10, 2.25, 1.65), 0.10, trK2(u, 10, 72, 56), 5)); },
    yl: '1618 · 西班牙 · 虛構船', name: '收穫號', line: '死神的鐮刀，原本是農具', by: BY('calli'),
    story: ['大帆船（galleon）載著美洲的白銀，橫渡大西洋。', '收穫號照 1618 年西班牙造船法令的比例造成。'],
    term: { zh: '艉樓', en: 'sterncastle', def: ['船尾一層層疊高的樓，', '是船長指揮與住的地方。'] } });
  var hR = SA - PI / 2 + 0.2;
  hist({ id: 'reale', dur: 10, seed: 1694, h: hR, wind: trWind(hR, 2.2, 0.5), pre: 1.5, hull: 'reale', ext: { tele: 0 }, look: L(TR_LOOK.gold, GOLD_SUN), year: 1694,
    cam: function (u, tau, S) { return trAbove(trRel(S[0], trK2(u, 10, 1.2, 1.65), 0.06, 42, 1, trK2(u, 10, 8, -6))); },
    yl: '1694 · 法蘭西', name: '皇家號', line: '法王路易十四的旗艦　三十二對長槳，一槳七人', by: BY('apex-one'),
    story: ['東羅馬亡了，槳帆船又在地中海划了三百年。', '1571 年的勒班陀，是最後一場以槳帆船為主的大海戰。'],
    term: { zh: '槳帆船', en: 'galley', def: ['靠划手推動，帆只在順風時幫忙。', '皇家號有 432 名划手。'] }, spec: 'reale', specAt: 6.2 });
  // 海戰：槳帆船對大帆船（Tim 2026-10-19：「影片中可以多一點海戰片段」）—— 遊戲裡的對戰（虛構）：皇家號划槳衝向收穫號、船頭的砲先開；收穫號轉舷側整排還擊
  var hY = SA - PI / 2 + 0.5;
  hist({ id: 'galleys', dur: 10, seed: 1690, h: hY, year: 1694, pre: 1.0, look: L(TR_LOOK.gold, GOLD_SUN),
    fleet: [{ team: 'blue', hull: 'reale', x: 0, z: 0, yaw: trYaw(hY), hold: 1, tele: 0 },
            { team: 'red', hull: 'cosecha', x: Math.cos(hY) * 95, z: Math.sin(hY) * 95, yaw: trYaw(hY + PI / 2), hold: 1, sail: 1 }],
    cues: [1.8, 2.1, 2.4, 2.7].map(function (s) { return { at: 1.0 + s, fn: function (S) { var sh = S[0], foe = S[1]; sh.guns.forEach(function (g) { if (g.alive) g.reload = 0; }); setAim(sh, [foe.T.cx, foe.T.cy, foe.T.geo.aim], foe); fireOne(sh, 0); } }; })
      .concat([{ at: 1.0 + 4.6, fn: function (S) { trVolley(S[1], S[0], 0); } }, { at: 1.0 + 8.2, fn: function (S) { trVolley(S[1], S[0], 0); } }]),
    cam: function (u, tau, S) { return trAbove(trRel(S[0], trK2(u, 10, -2.35, -1.95), 0.06, trK2(u, 10, 46, 38), 3, 18)); },
    term: { zh: '艏砲', en: 'bow gun', def: ['裝在船頭、朝前開火的砲。', '槳帆船的砲幾乎都在這裡。'] }, termAt: 1.6,
    note: '遊戲裡的對戰（虛構）',
    cap2: function (g, u) {
      trTag(g, '槳帆船 對 大帆船', '', trFade(u, 0.4, 5.0, 0.4));
      trStory(g, ['槳帆船的砲只裝在船頭：要開砲，就得把整艘船對準敵人。', '大帆船整舷都是砲 —— 舷側齊射，讓槳帆船慢慢退出了大洋。'], u, 2.0, 9.7, 2.4);
    } });

  // ═════ 二、風帆的極致 ═════
  var hT = SA - PI / 2;
  hist({ id: 'sextant', dur: 9, seed: 1757, h: hT, hull: 'tridente', look: L(TR_LOOK.gold, GOLD_SUN), year: 1757, pre: 1.0,
    cam: function (u, tau, S) { var c = trRel(S[0], trK2(u, 9, 1.95, 2.2), 0.04, trK2(u, 9, 120, 110), 10); return trAbove(c); },
    cap2: function (g, u) {
      g.save(); g.globalAlpha = 0.55 * trFade(u, 0.3, 8.7, 0.6); g.fillStyle = '#05070b'; g.fillRect(0, 0, TR_CW * 0.46, TR_CH); g.restore();
      trSextant(g, u, trFade(u, 0.4, 8.7, 0.6), TR_CW * 0.22, TR_CH * 0.20, 1);
      trText(g, '六分儀', 120, TR_CH * 0.62, '600 58px ' + TR_SERIF, '#f6eedb', trFade(u, 0.8, 8.7, 0.6), 'left', 6);
      trText(g, 'sextant', 330, TR_CH * 0.625, 'italic 400 30px ' + TR_SERIF, '#d6c9a8', trFade(u, 0.8, 8.7, 0.6), 'left', 2);
      trText(g, '量太陽與地平線的夾角，換算成緯度。', 120, TR_CH * 0.70, '400 32px ' + TR_SERIF, '#efe6d0', trFade(u, 1.4, 8.7, 0.6), 'left', 2);
      trText(g, '十八世紀中葉出現；從此在大洋中央，', 120, TR_CH * 0.75, '400 32px ' + TR_SERIF, '#efe6d0', trFade(u, 2.2, 8.7, 0.6), 'left', 2);
      trText(g, '也量得出自己在南北的哪一條線上。', 120, TR_CH * 0.80, '400 32px ' + TR_SERIF, '#efe6d0', trFade(u, 2.6, 8.7, 0.6), 'left', 2);
      trTerm(g, { zh: '節', en: 'knot', def: ['1 節 ＝ 每小時 1 海里（1.852 公里）。', '以前把打了結的繩子放進海裡，', '數有幾個結被拉出去。'] }, trFade(u, 4.4, 8.7, 0.5));
    } });
  hist({ id: 'tridente', dur: 10, seed: 1769, h: hT, hull: 'tridente', year: 1769, pre: 1.2,
    cues: (function () { var L2 = []; for (var k = 0; k < 90; k++) L2.push({ at: 1.2 + 1.0 + k * 0.05, fn: function (S) { trSalute(S[0]); } }); return L2; })(),
    setup: function (S) { S[0].guns.forEach(function (g) { g.reload = 0; }); },
    cam: function (u, tau, S) { return trAbove(trRel(S[0], trK2(u, 10, 1.95, 1.35), 0.08, trK2(u, 10, 98, 80), 8)); },
    yl: '1769 · 哈瓦那', name: '三叉戟號', line: '原型：聖特立尼達號　四層砲甲板', by: BY('gura'),
    story: ['原型在哈瓦那下水，是少見的四層砲甲板戰艦。', '1805 年特拉法加海戰被英軍俘獲，在之後的暴風雨裡沉沒。'],
    term: { zh: '戰列艦', en: 'ship of the line', def: ['排成一列，用整舷的砲對轟的大戰艦。', '一舷齊射叫 broadside。'] }, spec: 'tridente', specAt: 6.4 });
  var hK = SA - PI / 2 + 0.15;
  hist({ id: 'constitution', dur: 10, seed: 1797, h: hK, hull: 'constitution', year: 1797, pre: 1.5,
    cam: function (u, tau, S) { return trAbove(trRel(S[0], trK2(u, 10, 0.5, 1.0), trK2(u, 10, 0.05, 0.13), trK2(u, 10, 62, 78), 12)); },
    yl: '1797 · 波士頓', name: '憲法號', line: '照 1849 年的圖紙，從龍骨造起', by: BY('basecamp'),
    story: ['1812 年戰爭裡，英艦的砲彈從它的船舷上彈開，', '從此人稱「老鐵甲」—— 它至今仍在美國海軍服役。'],
    term: { zh: '巡防艦', en: 'frigate', def: ['比戰列艦小、快，', '負責巡邏、護航與追擊。'] }, spec: 'constitution', specAt: 6.0 });
  // 造船的取材：剖開船身看肋骨
  hist({ id: 'timber', dur: 9, seed: 1798, h: hK, hull: 'constitution', year: 1797, pre: 1.0, cut: { half: true }, ext: { sail: 0 }, look: L(TR_LOOK.section),
    cam: function (u, tau, S) { return trAbove(trRel(S[0], trK2(u, 9, -1.5, -1.2), 0.10, trK2(u, 9, 56, 44), 0, trK2(u, 9, 8, -6))); },
    story: ['船的肋骨要彎，木頭卻不能鋸彎 —— 鋸斷的木紋撐不住。', '造船匠到林子裡找天生彎曲的樹幹與枝杈；', '憲法號用的是喬治亞州的南方活橡木。'], storyAt: 0.7,
    term: { zh: '彎材', en: 'compass timber', def: ['木紋順著彎曲長的木料，', '做肋骨與肘材，受力不會從中斷開。'] }, termAt: 5.4,
    cap2: function (g, u) { trTimberArt(g, u - 1.2, trFade(u, 1.2, 8.7, 0.5), TR_CW * 0.52, TR_CH * 0.30); } });
  // 海戰：舷側齊射（Tim 2026-10-19：「影片中可以多一點海戰片段」）—— 遊戲裡的對戰（虛構）：憲法號與三叉戟號並排對轟；三叉戟號一輪鏈彈專打憲法號的帆與索具
  var hB2 = SA - PI / 2 - 0.2;
  hist({ id: 'broadside', dur: 12, seed: 1805, h: hB2, year: 1805, pre: 1.2,
    fleet: [{ team: 'blue', hull: 'constitution', x: 0, z: 0, yaw: trYaw(hB2), hold: 1, sail: 1 },
            { team: 'red', hull: 'tridente', x: Math.cos(hB2 - PI / 2) * 78, z: Math.sin(hB2 - PI / 2) * 78, yaw: trYaw(hB2), hold: 1, sail: 1 }],
    cues: [{ at: 1.2 + 1.0, fn: function (S) { trVolley(S[1], S[0], 0); } },
           { at: 1.2 + 3.2, fn: function (S) { trVolley(S[0], S[1], 0); } },
           { at: 1.2 + 5.6, fn: function (S) { var f = S[0]; trVolley(S[1], f, 2, [f.T.cx, f.T.cy, f.T.zw + 190]); } },
           { at: 1.2 + 9.0, fn: function (S) { trVolley(S[0], S[1], 0); } }],
    cam: function (u, tau, S) { var a = S[0], b = S[1], c = [(a.px + b.px) / 2, 0, (a.pz + b.pz) / 2], f = fwd(a.yaw), az = trAzOf(a) + trK2(u, 12, 0.32, 0.18);
      return trAbove({ eye: trOrbit([c[0] + f[0] * 10, 8, c[2] + f[2] * 10], az, trK2(u, 12, 0.10, 0.16), trK2(u, 12, 95, 80)), look: [c[0] - f[0] * 6, 7, c[2] - f[2] * 6] }, 2); },
    term: { zh: '鏈彈', en: 'chain shot', def: ['兩顆半球用鐵鍊連著，飛出去會旋轉，', '專門割斷帆與索具。'] }, termAt: 6.0,
    note: '遊戲裡的對戰（虛構）',
    cap2: function (g, u) {
      trTag(g, '舷側齊射', 'broadside', trFade(u, 0.4, 5.4, 0.4));
      trStory(g, ['砲彈打穿木頭船身時，飛濺的木屑往往比砲彈本身傷人更多。'], u, 3.6, 11.7);
    } });

  // ═════ 三、蒸汽與鐵 ═════
  var hN = SA - PI / 2 - 0.15;
  hist({ id: 'napoleon', dur: 10, seed: 1850, h: hN, hull: 'napoleon', ext: { tele: 0 }, year: 1850, pre: 2.0,
    cam: function (u, tau, S) { return trAbove(trRel(S[0], trK2(u, 10, 2.45, 2.0), 0.10, trK2(u, 10, 94, 78), 6)); },
    marks: [{ at: function (S) { return trFunnelAt(S[0]); }, zh: '煙囪', en: 'funnel', a: 2.0, b: 9.7, dx: 170, dy: -120 }],
    yl: '1850 · 土倫', name: '拿破崙號', line: '第一艘生來就用螺旋槳的戰列艦', by: BY('kotoko'),
    story: ['法國造艦師杜皮伊・德・洛姆設計。', '帆還在，但船從此不必等風。'],
    term: { zh: '螺旋槳', en: 'screw propeller', def: ['藏在船尾的水面下推船，', '不像明輪那樣暴露在砲火裡。'] } });
  var hS = SA - PI / 2 + 0.1;
  hist({ id: 'susquehanna', dur: 11, seed: 1853, h: hS, hull: 'susquehanna', ext: { tele: 0 }, look: L(TR_LOOK.grey), year: 1853, pre: 1.5,
    cam: function (u, tau, S) { return trAbove(trRel(S[0], 1.57, 0.04, trK2(u, 11, 50, 42), 2, trK2(u, 11, 10, -6))); },
    marks: [{ at: function (S) { return trModelAt(S[0], 'propeller'); }, zh: '明輪', en: 'paddle wheel', a: 2.2, b: 10.7, dx: 150, dy: -170 }],
    yl: '1853 · 浦賀', name: '蘇士奎哈納號', line: '駛入江戶灣的黑船', by: BY('crest-001'),
    story: ['1853 年 7 月，培理准將率四艘黑船駛入江戶灣。', '隔年簽下《神奈川條約》，日本兩百多年的鎖國從此結束。'],
    term: { zh: '明輪', en: 'paddle wheel', def: ['船側的大水車，', '蒸汽機帶著它一槳一槳划水。'] }, termAt: 6.0 });
  var hG = SA - PI / 2 - 0.1;
  hist({ id: 'gloire', dur: 10, seed: 1859, h: hG, hull: 'gloire', ext: { tele: 0 }, year: 1859, pre: 1.5, portWant: 0,   // 航行：砲門關著、砲收在裡面（TASK-0719）
    cam: function (u, tau, S) { return trAbove(trRel(S[0], trK2(u, 10, 0.7, 1.2), 0.07, trK2(u, 10, 86, 94), 4)); },
    yl: '1859 · 土倫', name: '光榮號', line: '第一艘遠洋鐵甲戰列艦', by: BY('kaguya'),
    story: ['同樣出自杜皮伊・德・洛姆之手。', '橡木船身外披 120 毫米鍛鐵 —— 英國因此趕造了鐵殼的勇士號。'],
    term: { zh: '鐵甲艦', en: 'ironclad', def: ['船殼外包上厚鐵板，', '木殼戰艦的砲彈從此打不穿。'] }, spec: 'gloire', specAt: 6.2 });


  // 砲門（Tim 2026-10-19：「炮門(同時也在動畫內展示) 是否可以用光榮號展示 炮門可以開關(關閉時炮往內縮)」「如果模擬海戰進水側傾呢」；TASK-0719）：
  //   光榮號對蘇士奎哈納號（遊戲裡的對戰，不是史實的哪一場）：關著航行 → 從船頭往船尾一片片掀起、推出砲 → 右舷齊射、對方還擊 → 右舷水線下的破口（導演開的，畫面註明）
  //   → 之後全照遊戲：進水、往右舷傾（公式模式：破洞那一舷往下，上限 12° ＋ 浪的橫搖）、吃水變深 ⇒ 右舷砲口入水 ⇒ 那一片蓋板自己闔上（62_ports.js）、那一門開不了（E1）。
  //   2026-10-19 量（u 14）：傾 10.9°、多吃水 0.35 m，右舷 17 個砲口 13 個在水下、12 片蓋板闔上（乾著的 5 片照樣開著）；第二輪齊射 3 發因為砲口在水下打不出去（E1）、4 門照開。
  //   ⚠ 2026-10-19 量：撞角撞穿只拆 1,663 格、傾 0.6°；打到傾 12° 要好幾分鐘 ⇒ 破口由導演開（右舷 x 440–640、水線下 2–14 格），開了 2 秒傾 10°、4 秒 14°（含浪）、右舷 18 門 14 門入水。
  //   蓋板：破口之前照 τ 算（trPorts）；之後交給遊戲 ⇒ 用 ?t= 跳到「正在闔上」的那一格會直接擺成闔好的樣子（遊戲的 snap），順著播放才看得到闔上的動作。
  var hQ = SA - PI / 2 + 0.15;
  hist({ id: 'ports', dur: 15, seed: 1861, h: hQ, year: 1859, pre: 1.5, portWant: 0, phx: { flood: 0 }, ports: { open: 1.5 + 2.2, close: 1e9, until: 1.5 + 7.6 },
    fleet: [{ team: 'blue', hull: 'gloire', x: 0, z: 0, yaw: trYaw(hQ), hold: 1, sail: 1 },
            { team: 'red', hull: 'susquehanna', x: Math.cos(hQ + PI / 2) * 115, z: Math.sin(hQ + PI / 2) * 115, yaw: trYaw(hQ), hold: 1, sail: 0 }],
    cues: [{ at: 1.5 + 5.8, fn: function (S) { trVolley(S[0], S[1], 0); } },
           { at: 1.5 + 7.0, fn: function (S) { trVolley(S[1], S[0], 0); } },
           { at: 1.5 + 7.6, fn: function (S) { trBreach(S[0], 1, 440, 640, 14, 2); S[0].portWant = null; } },
           { at: 1.5 + 12.0, fn: function (S) { trVolley(S[0], S[1], 0); } }],
    cam: function (u, tau, S) { return trAbove(trRel(S[0], trK2(u, 15, 2.05, 1.75), 0.04, trK2(u, 15, 34, 27), -0.6, 6), 1.0); },
    term: { zh: '砲門', en: 'gunport', def: ['船側開給砲口的方窗；', '不開火時放下蓋板，擋浪也擋水。'] }, termAt: 2.4,
    cap2: function (g, u) {
      trTag(g, '砲門開關', '交戰才掀蓋推砲；砲口一碰水就關上', trFade(u, 2.2, 7.4, 0.4));
      trStory(g, ['1859 年下水的光榮號，砲門下緣只高出水線 1.88 公尺，', '以「很濕」出名。'], u, 0.6, 7.4, 0.5);
      // ⛔ 舊字幕「遊戲裡也一樣：…」緊接在瑪麗玫瑰號後面，讀起來像遊戲裡砲門也會灌水（ame 2026-10-19 照這個讀法問「闔上之前灌進多少噸」）—— 遊戲的破口拿原本的船殼比，砲門開口不算洞 ⇒ 0 噸
      trStory(g, ['1545 年，瑪麗玫瑰號轉彎時傾側，海水從開著的砲門灌進去。', '遊戲裡，水只從打出來的破口進來；船一傾，低的那一舷砲口入水 ——', '那幾片蓋板自己闔上，那幾門砲也打不了。'], u, 8.4, 14.8, 1.2);
      trNote(g, '水線下的破口由導演開（示範側傾）；之後的進水、側傾、關砲門都是遊戲算的', trFade(u, 8.0, 14.8, 0.4));
    } });

  // 船上的職位（Tim 2026-10-19：「影片中也介紹船上各種職位」；TASK-0720 廚房與廚師）：光榮號剖開甲板 —— 前半拿掉艏樓、艉樓、上甲板看砲甲板（砲組、送藥手），後半只拿掉艏樓、艉樓看上甲板的爐灶（廚師、伙夫）
  //   剖幾層只改畫面（CUTV，74_cutaway.js）⇒ 照 u 切（同一個 t 同一格）；開場讓每一桌都餓了 ⇒ 伙夫在這一幕裡自己走去爐灶（遊戲的派工，不是導演擺的）；開六門砲（對空）⇒ 砲組裝填、送藥手跑
  //   字幕的史實照 TASK-0720 的史料報告（Leech 1843、Masefield 1905）；「吃飽工作比較快」沒有史料 ⇒ 寫成「遊戲裡」
  function trCrewAt(sh, pick) {                                          // 挑一個人（pick(c) 回分數，越小越好；null ＝ 不要）⇒ 他頭頂的世界座標
    var best = null, bs = 1e9; (sh.crew || []).forEach(function (c) { if (!crewAble(c)) return; var v = pick(c); if (v !== null && v < bs) { bs = v; best = c; } });
    return best ? M4.pt(sh.M, best.pos[0], best.pos[1], best.pos[2] + 17) : null;
  }
  var hR = SA - PI / 2 - 0.1;
  hist({ id: 'crew', dur: 14, seed: 1860, h: hR, hull: 'gloire', ext: { tele: 0 }, year: 1859, pre: 2.0,   // 伙夫從砲甲板排隊爬梯子上去要 20 秒以上（2026-10-19 量）、預跑 10 秒換幕就卡 1 秒 ⇒ 伙夫標在前半段（砲甲板上走向梯子），後半段只標爐灶前的廚師
    look: L(TR_LOOK.section), cut: { deck: 3 },
    setup: function (S) { var G = S[0].galley; if (G) G.mess.forEach(function (M) { M.fed = -1e3; M.who.forEach(function (c) { c.fedT = -1e3; }); }); },
    cues: [2.2, 2.45, 2.7, 2.95, 3.2, 3.45].map(function (s) { return { at: s, fn: function (S) { trSalute(S[0]); } }; }),
    cam: function (u, tau, S) {
      var sh = S[0], two = u >= 6.8; CUTV.deck = two ? 2 : 3;               // 只改畫面：後半少拿一層（上甲板留著，爐灶在上面）
      var c = two ? trCellAt(sh, 790, 200, 122) : trCellAt(sh, trMix(570, 630, u / 6.8), 200, 100);
      var az = trAzOf(sh) + (two ? trK2(u - 6.8, 7.2, 0.55, 0.85) : trK2(u, 6.8, 1.45, 1.25));   // 後半從右舷船頭往船尾看 ⇒ 帆在爐灶後面，不擋字
      return trAbove({ eye: trOrbit(c, az, two ? 0.62 : 0.6, two ? trK2(u - 6.8, 7.2, 14, 11) : trK2(u, 6.8, 24, 19)), look: c });
    },
    black: function (u) { return Math.max(0, 1 - Math.abs(u - 6.8) / 0.32); },   // 換一層：黑一下
    marks: [
      { at: function (S) { var sh = S[0]; return trCrewAt(sh, function (c) { return c.role === ROLE.GUN && c.pos[1] > 200 ? Math.abs(c.pos[0] - 600) : null; }); }, zh: '砲組', en: 'gun crew', a: 0.8, b: 6.4, dx: 130, dy: -190 },
      { at: function (S) { var sh = S[0]; return trCrewAt(sh, function (c) { return c.role === ROLE.POWDER ? Math.abs(c.pos[0] - 610) + (c.walk ? 0 : 400) : null; }); }, zh: '送藥手', en: 'powder monkey', a: 2.4, b: 6.4, dx: 170, dy: -130 },
      { at: function (S) { var sh = S[0]; return trCrewAt(sh, function (c) { return c.role === ROLE.COOK ? 0 : null; }); }, zh: '廚師', en: 'cook', a: 7.4, b: 13.6, dx: 170, dy: -150 },
      { at: function (S) { var sh = S[0]; return trCrewAt(sh, function (c) { return c.role === ROLE.HAND && c.hand && c.hand.job && c.hand.job.kind === 'eat' ? Math.abs(c.pos[0] - 600) : null; }); }, zh: '伙夫', en: 'mess cook', a: 3.6, b: 6.4, dx: -230, dy: -110 }
    ],
    term: { zh: '伙夫', en: 'mess cook', def: ['每桌每週輪一人，', '去廚房領回全桌的飯。'] }, termAt: 3.4,
    note: '史料：Leech 1843、Masefield 1905',
    cap2: function (g, u) {
      trTag(g, '船上的職位', '一艘戰艦，是一座漂浮的小鎮', trFade(u, 0.4, 6.3, 0.4));
      trStory(g, ['砲組：一門砲配八個人加一個男孩，有人瞄準、有人裝填、有人洗砲膛。', '送藥童：從彈藥庫毛氈簾的小洞接過火藥包，用外套蓋著跑回砲位。'], u, 1.0, 6.4, 1.6);
      trStory(g, ['廚師：多半由傷殘的老水手擔任；一聲「清甲板備戰」，就得把爐火熄掉。', '水手：每四到八人一桌，每週輪一人當伙夫，去廚房領回全桌的飯。'], u, 7.4, 13.7, 1.8);
      var ag = trFade(u, 10.6, 13.7, 0.4);
      if (ag > 0.003) { g.save(); g.globalAlpha = ag * 0.62; g.fillStyle = 'rgba(4,6,10,1)'; g.fillRect(96, 86, 760, 122); g.restore(); }   // 暗底：鏡頭左上是帆（白的）⇒ 字讀不出來
      trTag(g, '遊戲裡', '吃過飯的水手，裝填、抽水、修補都快一成', ag);
    } });

  // ═════ 四、1862 · 漢普頓錨地（美國南北戰爭）═════
  var hV = SA - PI / 2;
  hist({ id: 'hampton', dur: 9, seed: 1862, h: hV, hull: 'virginia', ext: { tele: 0 }, look: L(TR_LOOK.grey), year: 1862, pre: 1.0, era: false,
    cam: function (u, tau, S) { return trAbove(trRel(S[0], trK2(u, 9, 0.35, 0.75), 0.03, trK2(u, 9, 60, 42), 1, 18)); },
    marks: [{ at: function (S) { var sh = S[0]; return trCellAt(sh, sh.T.cx, sh.T.cy, sh.T.zw + 40); }, zh: '砲廓', en: 'casemate', a: 4.2, b: 8.7, dx: 180, dy: -150 }],
    cap2: function (g, u) {
      trTitle(g, '1862 · 漢普頓錨地', '美國南北戰爭', trFade(u, 0.4, 4.0, 0.6), TR_CH * 0.40);
      trStory(g, ['南軍把燒毀的梅里馬克號，改造成鐵甲艦維吉尼亞號。', '斜斜的鐵屋頂下藏著砲，船首裝了一支鑄鐵撞角。'], u, 4.0, 8.7);
      trTerm(g, { zh: '砲廓', en: 'casemate', def: ['斜鐵板蓋住的砲室，', '砲彈打上來就滑開。'] }, trFade(u, 5.0, 8.7, 0.5));
    } });
  var hX = SA - PI / 2 + 0.9;
  hist({ id: 'ram', dur: 10, seed: 52, h: hX, look: L(TR_LOOK.grey), year: 1862, era: false, pre: 0.5, phx: { shipdmg: 1, shiphit: 3 },
    fleet: [{ team: 'blue', hull: 'virginia', x: 0, z: 0, yaw: trYaw(hX), hold: 1, tele: 0, ram: 1 }, { team: 'red', hull: 'phoenix', x: Math.cos(hX) * 62, z: Math.sin(hX) * 62, yaw: trYaw(hX + PI / 2), hold: 1, sail: 0 }],
    cam: function (u, tau, S) { var b = shipCenter(S[1]); return trAbove({ eye: trOrbit(b, trAzOf(S[1]) + PI + 0.55, 0.12, trK2(u, 10, 52, 44)), look: [b[0], 2, b[2]] }); },
    note: '坎伯蘭號由炎羽號代演（雕刻：kiara）',
    story: ['3 月 8 日，維吉尼亞號的撞角撞進北軍的坎伯蘭號。', '坎伯蘭號沉了 —— 船上的砲直到最後一刻都還在開。'],
    term: { zh: '撞角', en: 'ram', def: ['船首水線下的尖角，', '用整艘船的重量撞穿敵艦。'] }, termAt: 5.2,
  });
  var hY = SA - PI / 2 - 0.2;
  hist({ id: 'congress', dur: 13, seed: 1841, h: hY, hull: 'constitution', ext: { sail: 1 }, year: 1862, era: false, pre: 0.8, rate: 1.6,   // 從下午燒到深夜：模擬 1.6 倍
    look: function (u) { return L(trLookMix(TR_LOOK.dusk, TR_LOOK.night, trSmooth(2, 10, u)), DUSK_SUN); },
    cues: [{ at: 1.0, fn: function (S) { var sh = S[0], T = sh.T;
             [[60, 0, 52], [-120, 30, 46], [180, -20, 50], [-260, 10, 48], [0, -35, 56]].forEach(function (o) { trIgnite(sh, [T.cx + o[0], T.cy + o[1], T.zw + o[2]]); });
             if (typeof burnSailAt === 'function') sh.sails.filter(function (q) { return !q.flag && !q.dead; }).slice(1, 4).forEach(function (q) { var n = (sh.T.cloth[q.k] && sh.T.cloth[q.k].n) || 1; burnSailAt(sh, q, Math.floor(n * 0.55)); }); } },
           { at: 0.8 + 11.0 * 1.6, fn: function (S) { var sh = S[0], m = (sh.mags || []).filter(function (q) { return !q.gone; }).sort(function (a, b) { return b.lb - a.lb; })[0]; if (m) magBoom(sh, m); } }],
    cam: function (u, tau, S) { return trAbove(trRel(S[0], trKey([[0, 1.75], [8, 1.45], [13, 1.3]], u), 0.08, trKey([[0, 72], [8, 62], [13, 105]], u), 6)); },
    note: '國會號由憲法號代演；起火與最後的殉爆都是導演點的',
    story: ['同一天，國會號擱淺、中彈起火。', '大火從下午燒到深夜，燒進了火藥庫。'] });
  var hM = SA - PI / 2;
  hist({ id: 'monitor', dur: 12, seed: 1863, h: hM, look: L(TR_LOOK.grey), year: 1862, pre: 1.0, mode: 'eve',
    // 觀戰模式自己打：11 秒只開 6 砲、0 命中（11 吋砲裝填慢、砲塔一圈 22.5 秒）⇒ 照時間排齊射：維吉尼亞號三輪舷側、莫尼特號砲塔轉過來以後單發
    cues: [1.0 + 1.2, 1.0 + 5.0, 1.0 + 8.5].map(function (s) { return { at: s, fn: function (S) { trVolley(S[0], S[1], 0); } }; })
      .concat([1.0 + 6.0, 1.0 + 7.4, 1.0 + 9.6, 1.0 + 10.8].map(function (s) { return { at: s, fn: function (S) { S[1].guns.forEach(function (g) { if (g.alive) g.reload = 0; }); fireOne(S[1], 0); } }; })),
    fleet: [{ team: 'blue', hull: 'virginia', x: 0, z: 0, yaw: trYaw(hM), tele: 2 }, { team: 'red', hull: 'monitor', x: Math.cos(hM + PI / 2) * 55, z: Math.sin(hM + PI / 2) * 55, yaw: trYaw(hM + PI), tele: 2 }],
    cam: function (u, tau, S) { var a = shipCenter(S[0]), b = shipCenter(S[1]), m = trMixV(a, b, 0.5), az = Math.atan2(b[2] - a[2], b[0] - a[0]) + PI / 2;
      return trAbove({ eye: trOrbit(m, az + trK2(u, 12, -0.3, 0.2), 0.10, trK2(u, 12, 82, 64)), look: [m[0], 2.5, m[2]] }); },
    marks: [{ at: function (S) { var sh = S[1], g = sh.guns[0]; return g ? M4.pt(sh.M, g.muz[0], g.muz[1], g.muz[2]) : null; }, zh: '旋轉砲塔', en: 'turret', a: 6.0, b: 11.6, dx: -200, dy: -160 }],
    yl: '1862 年 3 月 9 日', name: '莫尼特號　對　維吉尼亞號', line: '史上第一場鐵甲艦對決', by: BY('meadow · ame'),
    story: ['隔天清晨，北軍的莫尼特號趕到。', '兩艘鐵甲艦互轟了一整個上午，誰也打不穿誰。'],
    term: { zh: '乾舷', en: 'freeboard', def: ['甲板離水面的高度。', '莫尼特號只有 18 吋 —— 像一塊浮著的木筏。'] }, termAt: 6.4 });
  // 修正：monitor 那一幕要開火 ⇒ 觀戰模式＋自動開砲
  TR.S[TR.S.length - 1].autoFire = true; TR.S[TR.S.length - 1].cmd = ['free', 'free']; TR.S[TR.S.length - 1].mode = 'eve';
  var hP = SA - PI / 2 + 0.2;
  hist({ id: 'sentinel', dur: 8, seed: 1868, h: hP, hull: 'sentinel', ext: { tele: 1 }, look: L(TR_LOOK.grey), year: 1868, pre: 1.0,
    cam: function (u, tau, S) { return trAbove(trRel(S[0], trK2(u, 8, 0.6, 1.0), 0.06, trK2(u, 8, 46, 56), 2)); },
    yl: '1860 年代末 · 虛構', name: '哨兵號', line: '戰後改裝的莫尼特號：五座速射砲，一座圓形司令塔', by: BY('meadow'),
    cap2: function (g, u) { trLine(g, '從那一天起，世界上的木造戰艦都過時了。', trFade(u, 0.5, 4.6, 0.6), TR_CH * 0.30); } });

  // ═════ 五、每一格都算數（引擎）═════
  var hE = SA - PI / 2;
  hist({ id: 'voxel', dur: 9, seed: 31, h: hE, wind: trWind(hE, 1.0, 0.8), pre: 1.0, fadeIn: 0.15,
    fleet: [{ team: 'blue', hull: 'ember', x: 0, z: 0, yaw: trYaw(hE), hold: 1, sail: 1 }, { team: 'red', hull: 'falcon', x: Math.cos(hE - PI / 2) * 46, z: Math.sin(hE - PI / 2) * 46, yaw: trYaw(hE), hold: 1, sail: 1 }],
    cues: [{ at: 1.3, fn: function (S) { trVolley(S[0], S[1], 0); } }],
    cam: function (u, tau, S) { return trAbove(trRel(S[1], trK2(u, 9, 1.75, 1.35), 0.07, trK2(u, 9, 34, 26), 2)); },
    cap2: function (g, u, tau) {
      trTitle(g, '每一格，都算數', '', trFade(u, 0.2, 2.2, 0.4), TR_CH * 0.45);
      trTag(g, '木殼戰艦的傷', '實心彈打穿船殼；飛濺的木屑，比砲彈本身傷人更多', trFade(u, 2.2, 8.6, 0.4));
      trTerm(g, { zh: '實心彈', en: 'round shot', def: ['實心的鐵球，', '靠速度打穿船殼、折斷桅杆。'] }, trFade(u, 4.4, 8.6, 0.5));
      trLower(g, { name: '餘燼號　→　夜隼號', line: '九十門砲的一舷齊射', by: BY('basecamp · summit') }, trFade(u, 4.8, 8.6, 0.4));
    } });
  TR.S[TR.S.length - 1].rate = 0.5;
  var hF = SA - PI / 2;
  hist({ id: 'flood', dur: 14, seed: 41, h: hF, wind: trWind(hF, 1.0, 0.7), pre: 6.0, cut: { half: true }, phx: { flood: 3 }, look: L(TR_LOOK.section),
    fleet: [{ team: 'blue', hull: 'cosecha', x: 0, z: 0, yaw: trYaw(hF), hold: 1, sail: 1 }, { team: 'red', hull: 'constitution', x: Math.cos(hF + PI / 2) * 60, z: Math.sin(hF + PI / 2) * 60, yaw: trYaw(hF), hold: 1, sail: 1 }],
    cues: [{ at: 0.4, fn: function (S) { trVolley(S[1], S[0], 0, [S[0].T.cx, S[0].T.cy, S[0].T.zw + 3]); } }, { at: 2.4, fn: function (S) { trVolley(S[1], S[0], 0, [S[0].T.cx - 40, S[0].T.cy, S[0].T.zw + 2]); } }],
    cam: function (u, tau, S) { return trAbove(trRel(S[0], trK2(u, 14, -1.5, -1.15), 0.12, trK2(u, 14, 48, 38), -1)); },
    // Tim：「可以不用寫進水模擬 而是用科普的方式講船隻進水」「以及那個時代船隻缺乏水密艙 因此更容易沉」「可以提一下鐵達尼號」
    cap2: function (g, u) {
      trTag(g, '船為什麼會沉？', '', trFade(u, 0.3, 13.6, 0.4));
      trStory(g, ['船浮著，是因為它排開的水跟它一樣重（阿基米德原理）。', '吃水線下開一個洞，水灌進來，船越來越重、吃得越深；', '水積在一側，船就傾斜 —— 木匠帶著木塞去堵砲眼，水手輪班抽水。'], u, 1.4, 6.9);
      trTerm(g, { zh: '吃水線', en: 'waterline', def: ['船浮著時，水面在船身畫出的那條線。', '線下開一個洞，水就灌進來。'] }, trFade(u, 3.4, 6.9, 0.5));
      trStory(g, ['那個時代的木造戰艦大多沒有水密艙：', '水從一個破洞進來，就能流遍整個船艙。', '1912 年的鐵達尼號有 16 個水密艙，淹掉 4 個還能浮 —— 冰山劃開了前 5 個。'], u, 7.3, 13.6);
      trTerm(g, { zh: '水密艙', en: 'watertight compartment', def: ['用隔艙板把船身分成一格一格，', '一格破了，水不會流進別格。', '中國的帆船很早就這樣造。'] }, trFade(u, 8.6, 13.6, 0.5));
    } });
  TR.S[TR.S.length - 1].rate = 1.3;
  var hH = SA - PI / 2 + 0.3;
  hist({ id: 'greekfire', dur: 11, seed: 672, h: hH, wind: trWind(hH, 1.0, 0.8), pre: 0.8, mode: 'sandbox',
    // 持火號船頭對著三叉戟號的右舷、停在 34 m 外（船心量；siphon 朝船首、射程 ~30 m；觀戰模式的艦長沒對準就不開）⇒ 照時間噴
    //   ⚠ 2026-10-19 新版持火號（erina 3b9b24e）：26 m 時船頭離三叉戟號的舷側只剩 ~5 m，開場的慣性 0.9 秒就撞上去、噴口撞壞 ⇒ 34 m
    fleet: [{ team: 'blue', hull: 'dromon', x: Math.cos(hH + PI / 2) * 34, z: Math.sin(hH + PI / 2) * 34, yaw: trYaw(hH - PI / 2), tele: 4, hold: 1 },
            { team: 'red', hull: 'tridente', x: 0, z: 0, yaw: trYaw(hH), hold: 1, sail: 3 }],
    cues: [1.5, 2.0, 2.5, 3.2, 4.0, 5.0, 6.2].map(function (s) { return { at: 0.8 + s, fn: function (S) { var sh = S[0], foe = S[1]; sh.guns.forEach(function (g) { if (g.alive) g.reload = 0; }); setAim(sh, [foe.T.cx + (s - 3) * 40, foe.T.cy, foe.T.zw + 45 + s * 8], foe); fireOne(sh, AMMO_GF); } }; }).concat([{ at: 0.8 + 4.2, fn: function (S) { var foe = S[1]; if (typeof burnSailAt === 'function') foe.sails.filter(function (q) { return !q.flag && !q.dead; }).slice(0, 2).forEach(function (q) { var n = (foe.T.cloth[q.k] && foe.T.cloth[q.k].n) || 1; burnSailAt(foe, q, Math.floor(n * 0.3)); }); } }]).sort(function (a, b) { return a.at - b.at; }),
    cam: function (u, tau, S) { return trAbove(trRel(S[1], trK2(u, 11, 2.1, 1.45), 0.10, trK2(u, 11, 72, 100), 12)); },
    // 帆：噴口的仰角搆不到下層帆（2026-10-19 量：瞄準點抬到帆的高度也是 sailN 0）⇒ 第 4 秒由導演在兩面下層帆上點火（遊戲裡希臘火打到帆就是從那一點燒起來，21_gunnery.js burnSailAt）—— 代演，跟國會號一樣寫進代演清單
    term: { zh: '希臘火', en: 'Greek fire', def: ['東羅馬帝國的液態燃燒武器，', '潑到哪裡燒到哪裡，水也不容易澆熄。'] }, termAt: 5.5,
    story: ['木頭、帆布、繩子、塗在船縫裡的柏油 —— 一艘帆船，幾乎全是燃料。', '火從帆的邊緣焦黑、一塊塊燒穿；船員提著水桶去救。'], storyAt: 1.4,
    cap2: function (g, u) {
      trTag(g, '海上最怕的是火', '', trFade(u, 0.3, 10.6, 0.4));
      trNote(g, '帆上的火由導演點（噴口搆不到帆）；甲板上的火與之後的延燒是遊戲算的', trFade(u, 4.8, 10.6, 0.4));
    } });
  var hB = SA - PI / 2;
  hist({ id: 'magazine', dur: 8, seed: 66, h: hB, hull: 'ember', ext: { sail: 2 }, pre: 0.8,
    cues: [{ at: 1.6, fn: function (S) { var sh = S[0], m = (sh.mags || []).filter(function (q) { return !q.gone; }).sort(function (a, b) { return b.lb - a.lb; })[0]; if (m) magBoom(sh, m); } }],
    cam: function (u, tau, S) { return trAbove(trRel(S[0], 1.9, 0.10, trK2(u, 8, 125, 140), 6)); },
    term: { zh: '火藥庫', en: 'magazine', def: ['存放火藥的艙，放在吃水線以下最深處，', '離砲火最遠、淹水也最快。一旦起火 ——'] }, termAt: 0.4,
    cap2: function (g, u) {
      trTag(g, '殉爆', '火藥庫一炸，船斷成兩截', trFade(u, 2.0, 7.6, 0.4));
      trNote(g, '火藥庫由導演引爆；之後斷船、進水、下沉都是遊戲算的', trFade(u, 1.8, 7.6, 0.4));
    } });
  TR.S[TR.S.length - 1].rate = 0.6;

  // ═════ 六、傳說與魔法 ═════
  var hW = trSunAz(MOON) - PI / 2;
  hist({ id: 'stormkaap', dur: 13, seed: 1488, h: hW, wx: 'storm', wind: trWind(hW, PI, 1.3), pre: 1.5, fadeIn: 0.6, hull: 'stormkaap', ext: { tele: 0 }, look: L(TR_LOOK.storm, MOON),
    fx: function (push, u, tau, S) { trWisps(push, S[0], 46, tau, [0.35, 1, 0.55], 1.6, 40); },
    cam: function (u, tau, S) { return trAbove(trRel(S[0], trK2(u, 13, 0.3, 1.15), trK2(u, 13, 0.02, 0.09), trK2(u, 13, 34, 54), 6, 4), 1.6); },
    yl: '傳說 · 好望角', name: '風暴角號', line: '以它永遠繞不過的岬角為名　管風琴一停，魔法就熄', by: BY('summit'), col: '#5fe08f', lowAt: 4.6, storyAt: 5.4,
    story: ['傳說有一位荷蘭船長，發誓要繞過好望角，哪怕繞到世界末日。', '他的船從此在海上漂流，永遠靠不了岸。'],
    cap2: function (g, u) { trLine(g, '有些船，不在任何一本航海日誌裡。', trFade(u, 0.6, 4.2, 0.6), TR_CH * 0.50); } });
  // 古海圖：此處有龍、那個時代的海圖測繪（Tim：「此處有龍 的由來 以及那時代的海圖測繪等」「可以放在魔法篇(奇幻又有科普)」）—— 背景是夜隼號在霧裡穿過礁區
  var hO = SA - PI / 2 + 0.6;
  hist({ id: 'charts', dur: 16, seed: 1510, h: hO, wind: trWind(hO, 0.8, 0.9), pre: 1.5, hull: 'falcon', look: L(trLookMix(TR_LOOK.fog, TR_LOOK.dusk, 0.35), DUSK_SUN),
    cam: function (u, tau, S) { return trAbove(trRel(S[0], trK2(u, 16, 1.0, 1.6), 0.06, trK2(u, 16, 30, 24), 3, 2)); },
    yl: '《桅頂的賭注》', name: '夜隼號', line: '能在退潮的礁區裡跳舞', by: BY('summit'), lowAt: 12.4,
    cap2: function (g, u) {
      var al = trFade(u, 0.5, 12.2, 0.8);
      g.save(); var gr = g.createLinearGradient(880, 0, TR_CW, 0); gr.addColorStop(0, 'rgba(4,6,10,0.62)'); gr.addColorStop(1, 'rgba(4,6,10,0.28)'); g.globalAlpha = al; g.fillStyle = gr; g.fillRect(880, TR_CH * 0.14, TR_CW - 880, TR_CH * 0.54); g.restore();   // 字的暗底（字壓在船上會難讀）
      trChart(g, u, al, 110, TR_CH * 0.12, 760, 600, trSmooth(7.6, 11.5, u));
      function R(s, y, a, b) { trText(g, s, 920, y, '400 32px ' + TR_SERIF, '#efe6d0', trFade(u, a, b, 0.6), 'left', 2); }
      trText(g, '此處有龍', 920, TR_CH * 0.22, '600 58px ' + TR_SERIF, '#f6eedb', trFade(u, 0.8, 7.2, 0.6), 'left', 6);
      trText(g, 'HIC SVNT DRACONES', 920, TR_CH * 0.285, 'italic 400 28px ' + TR_SERIF, '#d6c9a8', trFade(u, 0.8, 7.2, 0.6), 'left', 2);
      R('真正寫著這句話的古物其實很少——', TR_CH * 0.37, 1.6, 7.2);
      R('最有名的是約 1510 年的杭特–萊諾克斯地球儀，', TR_CH * 0.42, 2.2, 7.2);
      R('就寫在東南亞的海岸邊。', TR_CH * 0.47, 2.6, 7.2);
      R('更多的古地圖，是在沒人去過的海上畫海怪：', TR_CH * 0.54, 3.6, 7.2);
      R('1539 年奧勞斯・馬格努斯的《海圖》，滿是巨蛇與鯨。', TR_CH * 0.59, 4.2, 7.2);
      trText(g, '海圖怎麼畫出來', 920, TR_CH * 0.22, '600 52px ' + TR_SERIF, '#f6eedb', trFade(u, 7.6, 12.2, 0.6), 'left', 6);
      R('波特蘭海圖：從羅盤玫瑰拉出一條條恆向線，', TR_CH * 0.32, 8.0, 12.2);
      R('沿著同一個羅盤方向走，就順著其中一條。', TR_CH * 0.37, 8.4, 12.2);
      R('測深：繩子綁鉛錘垂到海底，錘底抹獸脂，', TR_CH * 0.44, 9.0, 12.2);
      R('帶回海底的泥沙 —— 一點一點記成水深數字。', TR_CH * 0.49, 9.4, 12.2);
      R('經度：1761 年哈里森的航海鐘通過海上試驗，', TR_CH * 0.56, 10.0, 12.2);
      R('加上六分儀量出的緯度，船才知道自己在哪裡。', TR_CH * 0.61, 10.4, 12.2);
    } });
  var hQ = SA - PI / 2 + 0.4;
  hist({ id: 'tidegrave', dur: 8, seed: 1729, h: hQ, wind: trWind(hQ, 0.9, 0.7), pre: 1.5, hull: 'tidegrave', ext: { sail: 2 }, look: L(TR_LOOK.fog, MOON),
    fx: function (push, u, tau, S) { trWisps(push, S[0], 30, tau, [0.55, 0.85, 1.0], 1.3, 46); },
    cam: function (u, tau, S) { return trAbove(trRel(S[0], trK2(u, 8, 2.75, 2.3), 0.06, trK2(u, 8, 72, 55), 6)); },
    yl: '虛構 · 幽靈船', name: '潮墓號', line: '破星盤與珊瑚冠下的鬼船', by: BY('Sirius'), col: '#8fb8d8' });
  var hL = trSunAz(MOON) - PI / 2 + 0.3;
  hist({ id: 'nightlamp', dur: 8, seed: 1795, h: hL, hull: 'nightlamp', look: L(TR_LOOK.night, MOON), pre: 1.5,
    cam: function (u, tau, S) { return trAbove(trRel(S[0], trK2(u, 8, 0.35, 0.8), 0.08, trK2(u, 8, 48, 62), 8, 18)); },
    yl: '虛構', name: '夜燈號', line: '整艘黑，光只留給燈　船首的維納斯高舉提燈', by: BY('basecamp'), col: '#f0c060' });
  var hU = trSunAz(MOON) - PI / 2 - 0.4;
  hist({ id: 'ember', dur: 8, seed: 1803, h: hU, hull: 'ember', look: L(trLookMix(TR_LOOK.night, TR_LOOK.dusk, 0.25), MOON), pre: 1.5,
    cam: function (u, tau, S) { return trAbove(trRel(S[0], trK2(u, 8, PI - 0.6, PI - 0.25), 0.07, trK2(u, 8, 60, 48), 10)); },
    yl: '虛構', name: '餘燼號', line: '浴火鳳凰為首，九十門砲　船長室裡吊著一顆餘燼之心', by: BY('basecamp'), col: '#ff8a4a' });
  hist({ id: 'maelstrom', dur: 10, seed: 1866, wx: 'maelstrom', wind: [0, 1.2], pre: 3.0, dist: 260, look: L(TR_LOOK.vortex, MOON),
    fleet: [{ team: 'blue', hull: 'stormkaap', hold: 1 }, { team: 'red', hull: 'tidegrave', hold: 1 }],
    fx: function (push, u, tau, S) { trWisps(push, S[0], 24, tau, [0.35, 1, 0.55], 2.2, 40); },
    cam: function (u, tau, S) { var a = trK2(u, 10, 0.6, 1.5); return trAbove({ eye: trOrbit([0, 0, 0], a, trK2(u, 10, 0.62, 0.42), trK2(u, 10, 235, 175)), look: [0, -40, 0] }); },
    cap2: function (g, u) { trLine(g, '海的盡頭，還有更深的海。', trFade(u, 0.8, 9.6, 0.6), TR_CH * 0.80); } });
  TR.S[TR.S.length - 1].mode = 'sandbox';

  // ═════ 七、全艦隊與片名 ═════
  var fleetAll = ['constitution', 'tridente', 'ember', 'napoleon', 'gloire', 'susquehanna', 'virginia', 'monitor', 'reale',
                  'nightlamp', 'stormkaap', 'tidegrave', 'cosecha', 'phoenix', 'falcon', 'sentinel', 'dromon'];
  //   開頭 1.8 秒是黑底字卡（lead）：十七艘重開＋預跑 3 秒 ≈ 1.4 秒（2026-10-19 量），藏在字卡底下分格做 ⇒ 片子最高潮那一下不停、配樂不斷（director.js trFrame）。
  var FL = 1.8;
  trAdd({ id: 'fleet', dur: 11 + FL, lead: FL, seed: 17, wind: [20, 1.1], mode: 'eve', autoFire: true, pre: 3, dist: 200, gap: 85, cmd: ['line', 'line'], phx: { rig: 0 }, rate: 0.6, fadeIn: 0,
    fleet: fleetAll.map(function (h, i) { return { team: i % 2 ? 'red' : 'blue', hull: h }; }),
    cam: function (u, tau, S) { var v = Math.max(0, u - FL), a = trK2(v, 11, -0.9, -0.2); return { eye: trOrbit([0, 0, 0], a, trK2(v, 11, 0.42, 0.30), trK2(v, 11, 500, 420)), look: [0, 0, 0] }; },
    black: function (u) { return 1 - trSmooth(FL, FL + 0.7, u); },
    over: function (g, u) {
      trText(g, '十七艘船　十三位造船者', TR_CW / 2, TR_CH * 0.47, '600 64px ' + TR_SERIF, '#f2e6c8', trFade(u, 0.15, FL + 0.1, 0.45), 'center', 6);   // 黑場掀開前就淡完（⛔ 疊在淡入的艦隊上會糊）
    },
    cap: function (g, u) { trLine(g, '每一艘，都是一格一格雕出來的。', trFade(u, FL + 4.6, FL + 10.6, 0.6), TR_CH * 0.80); } });
  var hZ = trSunAz(DUSK_SUN) + PI * 0.85;
  trAdd({ id: 'title', dur: 14, seed: 1812, wind: trWind(hZ), mode: 'sandbox', pre: 2.0, fadeOut: 0, fleet: one('constitution', hZ), look: L(TR_LOOK.dusk, DUSK_SUN),
    cam: function (u, tau, S) { return trAbove(trRel(S[0], trK2(u, 14, 2.6, 2.9), 0.08, trK2(u, 14, 120, 150), 14)); },
    cap: function (g, u) {
      trTitle(g, 'BLOCKSIDE', '方　舷', trFade(u, 1.0, 99, 1.4), TR_CH * 0.30);
      trLine(g, '每一格，都算數。', trFade(u, 2.6, 99, 1.0), TR_CH * 0.47);
    } });
  TR.endShow = 10;

  // ── 配樂 ──（秒 ＝ 片長；照年代換曲（TASK-0718 年代篇，Tim 2026-10-19：「把新曲也用在影片內(符合該時代背景的音樂)」）：
  //   東羅馬聖詠〈神與我們同在〉→ 1453〈生命躺臥墓中〉→ 西班牙〈福利亞〉→ 路易十四〈感恩讚前奏曲〉→〈擲彈兵進行曲〉→〈總統進行曲〉→〈出征敘利亞〉→ 黑船〈櫻花〉→〈出征敘利亞〉
  //   → 1862〈共和國戰歌〉（3 月 8 日）→〈自由的戰鬥吶喊〉（3 月 9 日）→ 引擎篇〈把那傢伙吹倒〉→ 風暴角號〈漂泊的荷蘭人〉→ 魔法篇 風暴角號主題曲 → 全艦隊 夜燈號主題曲
  //   ⚠ 曲子在遊戲成品裡（02_music.js TUNES）；舊成品沒有這首 ⇒ trMusicPrep 跳過那一段（不會壞，只是沒聲音）。每段在換幕前後各 0.4 秒交疊（切鏡的黑場裡交叉淡入淡出）。
  var T = {}; TR.S.forEach(function (s) { T[s.id] = s.t0; });
  function seg(tune, a, b, o) {
    o = o || {}; var tn = tuneById(tune), pl = tn ? tuneEvents(tn).len * 60 / tn.Q : 30, from = o.from || 0, x = o.x === undefined ? 0.4 : o.x, at = a - x, L = b - a + 2 * x;
    return { at: at, tune: tune, from: from, to: from + L, loops: Math.ceil((from + L) / pl) + 1, fin: o.fin || 0.8, fout: o.fout || 0.8, gain: o.gain || 1 };
  }
  TR_SCORE = [
    { at: T.hook + 0.1, tune: 'nightlamp', from: 20.857, to: 20.857 + T.prologue - T.hook + 0.4, fin: 0.3, fout: 1.4, gain: 1.0 },   // 開場：片尾那一段主題（頭尾呼應）
    { at: T.hook + 0.83, hit: 1, v: 1.1, f0: 60, f1: 28, len: 2.4 }, { at: T.hook + 4.0, hit: 1, v: 1.1, f0: 60, f1: 28, len: 2.4 },   // 兩輪齊射（模擬 τ 1.5、3.4 ⇒ 慢動作 0.6 倍）
    { at: T.prologue + 0.2, bell: 147, v: 0.9 },
    { at: T.prologue + 0.6, pad: [38, 45, 50], len: T['open-dromon'] - T.prologue - 0.8, v: 0.42, fin: 3, fout: 1.6, inst: 'drone' },   // 序幕：伊頌那種持續音（沒有船、只有海）
    { at: T.prologue + 10.4, bell: 196, v: 0.4 }, { at: T.prologue + 18.6, bell: 196, v: 0.4 }, { at: T.prologue + 26.1, bell: 147, v: 0.5 },   // 序幕換一段（三列槳座、烏鴉、希臘火）
    seg('methimon', T['open-dromon'] - 1.2, T.byzantium, { x: 0, fin: 2.0, fout: 1.0 }),
    { at: T['open-dromon'] + 1.2, hit: 1, v: 0.9, f0: 60, f1: 30, len: 2.2 },
    seg('zoientafo', T.byzantium, T.cosecha), { at: T.byzantium, hit: 1, v: 0.8, f0: 50, f1: 25, len: 3 },
    seg('folia', T.cosecha, T.reale), seg('tedeum', T.reale, T.sextant),
    seg('granadera', T.sextant, T.constitution), seg('presidents', T.constitution, T.napoleon),
    { at: T.cosecha, bell: 196, v: 0.35 }, { at: T.reale, bell: 196, v: 0.35 }, { at: T.tridente, bell: 196, v: 0.35 }, { at: T.constitution, bell: 196, v: 0.35 },
    seg('syrie', T.napoleon, T.susquehanna), seg('sakura', T.susquehanna, T.gloire), seg('syrie', T.gloire, T.hampton, { from: 10 }),
    { at: T.napoleon, bell: 220, v: 0.4 }, { at: T.susquehanna, bell: 220, v: 0.4 }, { at: T.gloire, bell: 220, v: 0.4 },
    { at: T.hampton, hit: 1, v: 1, f0: 55, f1: 28, len: 2.6 },
    seg('battlehymn', T.hampton, T.monitor), seg('battlecry', T.monitor, T.voxel, { fout: 1.4 }),
    { at: T.ram + 3.6, hit: 1, v: 1.1 }, { at: T.congress, hit: 1, v: 0.8 }, { at: T.congress + 11.0, hit: 1, v: 1.3, f0: 45, f1: 22, len: 3.5 }, { at: T.monitor, hit: 1, v: 0.9 },
    { at: T.voxel - 1.6, rise: 1.6, v: 1 }, { at: T.voxel, hit: 1, v: 1.2, f0: 80, f1: 34, len: 1.8 },
    { at: T.voxel + 0.3, tune: 'blowtheman', from: 0, to: T.stormkaap - T.voxel - 0.3, loops: 8, fin: 0.3, fout: 1.2, gain: 1.05 },
    { at: T.flood, hit: 1, v: 0.9 }, { at: T.greekfire, hit: 1, v: 0.9 }, { at: T.magazine, hit: 1, v: 0.9 },
    { at: T.stormkaap - 0.4, hit: 1, v: 1, f0: 50, f1: 26, len: 3 },
    seg('dutchman', T.stormkaap, T.charts, { x: 0.2, fin: 0.6, fout: 1.6 }),
    { at: T.charts - 0.4, tune: 'stormkaap', from: 0, to: T.fleet - T.charts + 0.4, loops: 2, fin: 1.5, fout: 1.5, gain: 1.15 },
    { at: T.fleet - 1.8, rise: 1.8, v: 1.1 }, { at: T.fleet, hit: 1, v: 1.3, f0: 70, f1: 30, len: 2.4 },
    { at: T.fleet + 0.1, tune: 'nightlamp', from: 20.857, to: 20.857 + (TR.DUR - T.fleet - 0.1), fin: 0.4, fout: 4, gain: 1.1 },
    { at: T.title, hit: 1, v: 1.2, f0: 55, f1: 28, len: 3 }, { at: T.title + 1.0, bell: 147, v: 0.8 }
  ];
}
