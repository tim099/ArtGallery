// ── 字幕層（2D 畫布 #trCap，內部固定 1920×1080 ⇒ 每台機器的字都一樣大）與播放器外殼 ──
// 字幕、片名卡、淡入淡出全是 t 的純函數；控制列、載入進度、片尾按鈕是 DOM（shell.html）。
var TR_CW = 1920, TR_CH = 1080;
var TR_SERIF = '"Noto Serif TC","Source Han Serif TC","Songti TC","PMingLiU",serif';
var TR_SANS = '"Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif';
var trG = null;                                                         // 字幕層的 2D context：外殼（shell.html）插在遊戲的 <script> 後面 ⇒ 閉包跑的時候還沒有它，開機（trBoot）時才接
function trEl(id) { return document.getElementById(id); }

/** 一段文字的透明度：[a, b] 之間顯示，前後各 f 秒淡入淡出。 */
function trFade(u, a, b, f) { f = f || 0.5; return Math.min(trSmooth(a, a + f, u), 1 - trSmooth(b - f, b, u)); }
function trText(g, s, x, y, font, col, al, align, track) {
  if (al <= 0.003) return;
  g.save(); g.globalAlpha = al; g.font = font; g.fillStyle = col; g.textAlign = align || 'center'; g.textBaseline = 'middle';
  if (track) { try { g.letterSpacing = track + 'px'; } catch (e) {} }
  g.shadowColor = 'rgba(0,0,0,.65)'; g.shadowBlur = 18; g.fillText(s, x, y); g.restore();
}
/** 片名卡：大字＋小字（置中）。 */
function trTitle(g, big, small, al, y) {
  y = y || TR_CH * 0.46;
  trText(g, big, TR_CW / 2, y, '600 96px ' + TR_SERIF, '#f2e6c8', al, 'center', 6);
  if (small) trText(g, small, TR_CW / 2, y + 92, '400 34px ' + TR_SERIF, '#d8ccb0', al * 0.92, 'center', 4);
}
/** 一句話（置中、下方三分之一）。 */
function trLine(g, s, al, y) { trText(g, s, TR_CW / 2, y || TR_CH * 0.80, '500 46px ' + TR_SERIF, '#f4ecd8', al, 'center', 3); }
/** 船名下三分之一：年份、船名、一句、建造者。 */
function trLower(g, o, al) {
  if (al <= 0.003) return;
  var x = 120, y = TR_CH - 210, w = 8;
  g.save(); g.globalAlpha = al * 0.85; g.fillStyle = o.col || '#c9a45c'; g.fillRect(x - 28, y - 44, w, 150); g.restore();
  if (o.year) trText(g, o.year, x, y - 14, '400 30px ' + TR_SERIF, '#cdb98e', al, 'left', 6);
  trText(g, o.name, x, y + 34, '600 58px ' + TR_SERIF, '#f6eedb', al, 'left', 4);
  if (o.line) trText(g, o.line, x, y + 86, '400 30px ' + TR_SANS, '#e6dcc6', al * 0.95, 'left', 2);
  if (o.by) trText(g, o.by, TR_CW - 120, TR_CH - 92, '400 24px ' + TR_SANS, '#bfb59f', al * 0.8, 'right', 2);
}
/** 只給特色那幾幕用：左上角的小標（例：「體素破壞」）。 */
function trTag(g, s, sub, al) {
  if (al <= 0.003) return;
  trText(g, s, 120, 132, '600 44px ' + TR_SANS, '#ffe2a8', al, 'left', 8);
  if (sub) trText(g, sub, 120, 184, '400 28px ' + TR_SANS, '#efe3c9', al * 0.9, 'left', 2);
}
// ── 科普元件（Tim 2026-10-18：「加上一些歷史故事介紹」「船的演化」「船的各種資訊介紹(六分儀」「帆的發明」「各種船隻的專有名詞等 帶點科普教育意義」）──
/** 歷史故事：幾行字疊在船名上方，一行接一行淡入（u0 起、每行晚 gap 秒）。 */
function trStory(g, lines, u, u0, u1, gap) {
  var y0 = TR_CH - 268 - (lines.length - 1) * 50;
  lines.forEach(function (s, i) { trText(g, s, 120, y0 + i * 50, '400 34px ' + TR_SERIF, '#efe6d0', trFade(u, u0 + i * (gap || 0.45), u1, 0.6), 'left', 2); });
}
/** 名詞卡（右上）：o ＝ { zh, en, def:[行…] }。 */
function trTerm(g, o, al) {
  if (al <= 0.003) return;
  var w = 600, x = TR_CW - 120 - w, y = TR_CH * 0.075 + 40, h = 96 + o.def.length * 40;
  g.save(); g.globalAlpha = al * 0.78; g.fillStyle = 'rgba(10,12,16,0.82)'; g.fillRect(x, y, w, h);
  g.globalAlpha = al; g.strokeStyle = 'rgba(201,164,92,0.85)'; g.lineWidth = 2; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  g.fillStyle = '#c9a45c'; g.fillRect(x, y, 6, h); g.restore();
  trText(g, '名詞小辭典', x + 28, y + 26, '400 20px ' + TR_SANS, '#bfa774', al, 'left', 4);
  trText(g, o.zh, x + 28, y + 64, '600 40px ' + TR_SERIF, '#f6eedb', al, 'left', 3);
  g.save(); g.font = '600 40px ' + TR_SERIF; var zw = g.measureText(o.zh).width + 6 * o.zh.length; g.restore();
  if (o.en) trText(g, o.en, x + 40 + zw, y + 68, 'italic 400 26px ' + TR_SERIF, '#d6c9a8', al, 'left', 1);
  o.def.forEach(function (s, i) { trText(g, s, x + 28, y + 112 + i * 40, '400 27px ' + TR_SANS, '#e8dfca', al, 'left', 1); });
}
/** 船的資料卡（右下，做成航海儀表：一段六分儀的弧尺）：遊戲自己量的船卡（config/ship_cards.json，內嵌成 #ship-cards ⇒ SHIP_CARDS）。 */
function trSpec(g, id, al, u) {
  var c = SHIP_CARDS[id]; if (!c || al <= 0.003) return;
  var w = 470, x = TR_CW - 120 - w, y = TR_CH - 120 - 290, cx = x + w / 2, cy = y + 300, R = 250;
  g.save(); g.globalAlpha = al * 0.75; g.fillStyle = 'rgba(8,10,14,0.80)'; g.fillRect(x, y, w, 290); g.globalAlpha = al;
  g.strokeStyle = 'rgba(201,164,92,0.9)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R, Math.PI * 1.25, Math.PI * 1.75); g.stroke();
  for (var k = 0; k <= 60; k++) { var a = Math.PI * 1.25 + k / 60 * Math.PI * 0.5, L2 = k % 10 ? (k % 5 ? 8 : 14) : 22;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.lineTo(cx + Math.cos(a) * (R - L2), cy + Math.sin(a) * (R - L2)); g.stroke(); }
  var sw = Math.PI * 1.25 + (0.5 + 0.35 * Math.sin((u || 0) * 0.9)) * Math.PI * 0.5;   // 指針慢慢擺（只是裝飾）
  g.strokeStyle = 'rgba(240,215,150,0.9)'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(sw) * (R + 6), cy + Math.sin(sw) * (R + 6)); g.stroke();
  g.restore();
  var dv = { sail: '帆', steam: '蒸汽', oar: '槳', magic: '魔法' }[c.drive] || c.drive;
  var rows = [['排水量', c.tons.toLocaleString() + ' 噸'], ['水線長', c.len + ' 公尺'], ['砲', c.guns + ' 門'], ['船員', c.crew + ' 人'], ['動力', dv + (c.sails ? ' · 帆 ' + c.sails + ' 面' : '')]];
  trText(g, '遊戲數值', x + 26, y + 30, '400 19px ' + TR_SANS, '#bfa774', al, 'left', 4);
  rows.forEach(function (r, i) { trText(g, r[0], x + 26, y + 92 + i * 40, '400 25px ' + TR_SANS, '#cfc3a6', al, 'left', 2); trText(g, r[1], x + w - 26, y + 92 + i * 40, '600 28px ' + TR_SERIF, '#f6eedb', al, 'right', 1); });
}
/** 世界座標 ⇒ 字幕層的像素（導演的鏡頭 CAM.vp；在畫面之外或背後 ⇒ null）。 */
function trProject(p) {
  var m = CAM.vp; if (!m) return null;
  var x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  if (w <= 0.1) return null;
  return [(x / w + 1) / 2 * TR_CW, (1 - y / w) / 2 * TR_CH];
}
/** 指示線：從標籤拉一條線到船上的那一點（TR.marks：trDraw 在畫的那一刻、船的位置內插過之後算好）。 */
function trMarks(g, u) {
  (TR.marks || []).forEach(function (mk) {
    var al = trFade(u, mk.a, mk.b, 0.5); if (al <= 0.003 || !mk.s) return;
    var p = mk.s, lx = mk.lx !== undefined ? mk.lx : p[0] + (mk.dx || 160), ly = mk.ly !== undefined ? mk.ly : p[1] + (mk.dy || -140);
    g.save(); g.globalAlpha = al; g.strokeStyle = 'rgba(246,236,214,0.9)'; g.lineWidth = 2;
    g.beginPath(); g.arc(p[0], p[1], 7, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(lx, ly); g.lineTo(lx + (lx >= p[0] ? 28 : -28), ly); g.stroke(); g.restore();
    trText(g, mk.zh, lx + (lx >= p[0] ? 38 : -38), ly - 4, '600 32px ' + TR_SERIF, '#f6eedb', al, lx >= p[0] ? 'left' : 'right', 2);
    if (mk.en) trText(g, mk.en, lx + (lx >= p[0] ? 38 : -38), ly + 30, 'italic 400 22px ' + TR_SERIF, '#d6c9a8', al, lx >= p[0] ? 'left' : 'right', 1);
  });
}
/** 年代軸（上方細線）：船的演化 —— 槳、帆、蒸汽、鐵甲、砲塔；yr ＝ 這一幕的年份（點會滑過去）。 */
var TR_ERAS = [[900, '槳'], [1450, '帆'], [1840, '蒸汽'], [1859, '鐵甲', -1], [1862, '砲塔', 1]];   // 第三格：鐵甲與砲塔只差三年（刻度相距 13 px）⇒ 字往兩邊靠（−1 靠左、1 靠右），不然疊成「鐵砲塔」
function trTimeline(g, yr, al) {
  if (al <= 0.003) return;
  var x0 = 300, x1 = TR_CW - 300, y = 44;                              // 畫在上面那條黑邊裡（不壓到畫面）
  function X(v) { var a = Math.log(1900 - 880), b = Math.log(1900 - 1880), k = (Math.log(1900 - v) - a) / (b - a); return x0 + (x1 - x0) * Math.max(0, Math.min(1, k)); }   // 越近代越擠 ⇒ 用對數拉開
  g.save(); g.globalAlpha = al * 0.7; g.strokeStyle = 'rgba(230,215,180,0.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
  TR_ERAS.forEach(function (e) { var x = X(e[0]); g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x, y + 8); g.stroke(); }); g.restore();
  TR_ERAS.forEach(function (e) { var s = e[2] || 0; trText(g, e[1], X(e[0]) + s * 6, y + 24, '400 20px ' + TR_SANS, yr >= e[0] ? '#f1d899' : '#8f8672', al * 0.9, s < 0 ? 'right' : s > 0 ? 'left' : 'center', 3); });
  var px = X(yr); g.save(); g.globalAlpha = al; g.fillStyle = '#f1d899'; g.shadowColor = '#f1d899'; g.shadowBlur = 14; g.beginPath(); g.arc(px, y, 7, 0, Math.PI * 2); g.fill(); g.restore();
  trText(g, String(yr), px + 14, y - 20, '600 22px ' + TR_SERIF, '#f6eedb', al, 'center', 2);
}
/** 六分儀（插畫，照 u 擺動）：弧尺、刻度、指標臂、小鏡、望遠鏡；量太陽與地平線的夾角。 */
function trSextant(g, u, al, cx, cy, s) {
  if (al <= 0.003) return;
  s = s || 1; var R = 300 * s, a0 = Math.PI * 0.5 - 0.55, a1 = Math.PI * 0.5 + 0.55, sw = Math.PI * 0.5 + 0.38 * Math.sin(u * 0.8);
  g.save(); g.globalAlpha = al; g.lineCap = 'round';
  g.strokeStyle = 'rgba(214,180,110,0.95)'; g.lineWidth = 5 * s;
  g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R); g.stroke();   // 兩條邊框
  g.lineWidth = 9 * s; g.beginPath(); g.arc(cx, cy, R, a0, a1); g.stroke();                                    // 弧
  g.lineWidth = 2 * s; g.strokeStyle = 'rgba(250,236,200,0.9)';
  for (var k = 0; k <= 60; k++) { var a = a0 + k / 60 * (a1 - a0), L2 = (k % 5 ? 10 : 22) * s; g.beginPath(); g.moveTo(cx + Math.cos(a) * (R - 6 * s), cy + Math.sin(a) * (R - 6 * s)); g.lineTo(cx + Math.cos(a) * (R - 6 * s - L2), cy + Math.sin(a) * (R - 6 * s - L2)); g.stroke(); }
  g.strokeStyle = 'rgba(240,226,190,1)'; g.lineWidth = 6 * s; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(sw) * (R + 26 * s), cy + Math.sin(sw) * (R + 26 * s)); g.stroke();   // 指標臂
  g.fillStyle = 'rgba(160,200,230,0.85)'; g.fillRect(cx - 18 * s, cy - 10 * s, 36 * s, 20 * s);              // 指標鏡
  g.fillStyle = 'rgba(214,180,110,0.95)'; g.fillRect(cx + Math.cos(a0 + 0.12) * R * 0.55 - 60 * s, cy + Math.sin(a0 + 0.12) * R * 0.55 - 9 * s, 120 * s, 18 * s);   // 望遠鏡
  g.restore();
}

/** 彎材對照圖（Tim：「造船的取材(需要用原本就彎曲的木材造彎曲部分才有足夠強度)」）：
 *  左 ＝ 天生彎曲的樹幹（木紋順著彎）；右 ＝ 直木鋸成彎形（轉角的木紋被橫著切斷 ⇒ 一受力就從那裡裂開）。L 形的肘材（knee）。 */
function trTimberArt(g, u, al, x0, y0) {
  if (al <= 0.003) return;
  var W = 300, H = 300, T = 70;                                         // 一塊肘材：外框 W×H、臂寬 T
  function knee(ox, follow) {
    g.save(); g.translate(ox, y0);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(T, 0); g.lineTo(T, H - T); g.lineTo(W, H - T); g.lineTo(W, H); g.lineTo(0, H); g.closePath();   // L 形（內角直角）
    g.fillStyle = 'rgba(150,104,60,0.92)'; g.fill(); g.save(); g.clip();
    g.strokeStyle = 'rgba(70,42,20,0.85)'; g.lineWidth = 3;
    for (var k = 1; k < 7; k++) {
      var d = k * T / 7;
      g.beginPath();
      if (follow) { g.moveTo(d, -5); g.lineTo(d, H - T); g.arcTo(d, H - d, T, H - d, T - d + 1); g.lineTo(W + 5, H - d); }   // 木紋順著彎
      else { g.moveTo(d, -5); g.lineTo(d, H + 5); }                                                                         // 直木：木紋全是直的
      g.stroke();
    }
    if (!follow) for (var j = 1; j < 7; j++) { var e = H - T + j * T / 7; g.beginPath(); g.moveTo(T - 2, e); g.lineTo(W + 5, e); g.globalAlpha = 0.35; g.stroke(); g.globalAlpha = 1; }
    g.restore();
    g.strokeStyle = 'rgba(240,222,180,0.9)'; g.lineWidth = 2; g.stroke();
    if (!follow) {                                                       // 轉角的裂縫（木紋被切斷的那一段）
      var k2 = trSmooth(1.0, 3.5, u);
      g.strokeStyle = 'rgba(30,14,6,1)'; g.lineWidth = 4; g.beginPath(); g.moveTo(T + 4, H - T - 6);
      g.lineTo(T + 4 + 40 * k2, H - T + 22 * k2); g.lineTo(T + 4 + 70 * k2, H - T + 14 * k2 + 18 * k2); g.stroke();
    }
    g.restore();
  }
  g.save(); g.globalAlpha = al;
  g.fillStyle = 'rgba(8,10,14,0.72)'; g.fillRect(x0 - 40, y0 - 40, W * 2 + 200, H + 140);
  knee(x0, true); knee(x0 + W + 120, false);
  g.restore();
  trText(g, '✓ 天生彎曲的木材', x0 + W / 2, y0 + H + 46, '600 30px ' + TR_SANS, '#cfe8b8', al, 'center', 2);
  trText(g, '✗ 直木鋸成彎形', x0 + W * 1.5 + 120, y0 + H + 46, '600 30px ' + TR_SANS, '#f0b49a', al, 'center', 2);
  trText(g, '木紋順著彎', x0 + W / 2, y0 + H + 84, '400 24px ' + TR_SANS, '#e6dcc6', al, 'center', 1);
  trText(g, '轉角的木紋被切斷，從那裡裂開', x0 + W * 1.5 + 120, y0 + H + 84, '400 24px ' + TR_SANS, '#e6dcc6', al, 'center', 1);
}

/** 序幕的插圖（沒有船的那一段，Tim 2026-10-19：「開頭要有一些動畫或可播放的東西 可以多加一些科普內容在開頭」）：暗底＋金線的剪影，全是 u 的純函數。 */
function trArtPanel(g, x, y, w, h) { g.fillStyle = 'rgba(8,10,14,0.66)'; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(214,180,110,0.45)'; g.lineWidth = 2; g.strokeRect(x + 8, y + 8, w - 16, h - 16); }
function trWaterLine(g, x0, x1, y, u, s) {
  g.strokeStyle = 'rgba(214,190,140,0.6)'; g.lineWidth = 2 * s; g.beginPath();
  for (var x = x0; x <= x1; x += 8 * s) { var yy = y + Math.sin(x * 0.02 / s + u * 2.2) * 3 * s; if (x === x0) g.moveTo(x, yy); else g.lineTo(x, yy); }
  g.stroke();
}
/** 三列槳座戰船（trireme）：側面剪影（左 ＝ 船尾、右 ＝ 船首的包銅撞角與畫上的眼睛）、上中下三層槳 —— 每舷 31／27／27 支（共 170 名槳手），三層一起划：
 *  划水時槳葉在水裡往船尾拉，回槳時抬出水面往前送。 */
function trTrireme(g, u, al, cx, cy, s) {
  if (al <= 0.003) return;
  s = s || 1;
  var L = 900 * s, x0 = cx - L / 2, x1 = cx + L / 2, wl = cy + 64 * s, ph = u * 2.6;
  g.save(); g.globalAlpha = al; g.lineJoin = 'round'; g.lineCap = 'round';
  trArtPanel(g, x0 - 120 * s, cy - 170 * s, L + 260 * s, 340 * s);
  g.beginPath();                                                        // 船身：船尾翹起（左）、龍骨、船首水線上的撞角（右）
  g.moveTo(x0 - 30 * s, cy - 120 * s);
  g.quadraticCurveTo(x0 + 10 * s, wl + 6 * s, x0 + 110 * s, wl + 8 * s);
  g.lineTo(x1 - 60 * s, wl + 8 * s); g.lineTo(x1 - 20 * s, wl - 6 * s);
  g.lineTo(x1 - 10 * s, cy - 50 * s); g.lineTo(x0 + 70 * s, cy - 50 * s);
  g.quadraticCurveTo(x0 + 10 * s, cy - 56 * s, x0 - 6 * s, cy - 104 * s); g.closePath();
  g.fillStyle = 'rgba(22,16,12,0.95)'; g.fill(); g.strokeStyle = 'rgba(232,200,130,0.9)'; g.lineWidth = 2.5 * s; g.stroke();
  g.beginPath(); g.moveTo(x1 - 60 * s, wl + 8 * s); g.lineTo(x1 + 60 * s, wl + 4 * s); g.lineTo(x1 - 20 * s, wl - 10 * s); g.closePath();   // 包銅的撞角
  g.fillStyle = '#c8913a'; g.fill(); g.strokeStyle = 'rgba(250,226,170,0.9)'; g.lineWidth = 1.5 * s; g.stroke();
  g.fillStyle = '#efe6d0'; g.beginPath(); g.ellipse(x1 - 40 * s, cy - 18 * s, 13 * s, 7 * s, 0, 0, Math.PI * 2); g.fill();   // 船首畫的眼睛
  g.fillStyle = '#1a120c'; g.beginPath(); g.arc(x1 - 37 * s, cy - 18 * s, 4.5 * s, 0, Math.PI * 2); g.fill();
  var tiers = [[31, -40], [27, -22], [27, -4]];                         // [每舷支數, 槳孔高度（相對 cy）]
  var th = 0.38 * Math.cos(ph), lift = trSmooth(-0.3, 0.3, -Math.sin(ph));   // 槳的前後角（+ ＝ 往船首）；回槳那半拍（角度往前走）抬出水面
  tiers.forEach(function (T, k) {
    var n = T[0], y = cy + T[1] * s, off = (k % 2 ? 11 : 0) * s, reach = wl + 44 * s - lift * 52 * s;   // 槳伸出船外、往下插進水裡（划水）／抬出水面（回槳）
    g.strokeStyle = ['rgba(240,214,150,0.95)', 'rgba(222,190,124,0.95)', 'rgba(200,164,100,0.95)'][k]; g.lineWidth = 2.4 * s;
    for (var i = 0; i < n; i++) {
      var px = x0 + 150 * s + (L - 330 * s) * i / (n - 1) + off, dy = reach - y, ex = px + Math.tan(th) * dy;
      g.beginPath(); g.moveTo(px, y); g.lineTo(ex, reach); g.stroke();
      g.save(); g.lineWidth = 6 * s; g.beginPath(); g.moveTo(ex - Math.tan(th) * 14 * s, reach - 14 * s); g.lineTo(ex, reach); g.stroke(); g.restore();   // 槳葉
      g.fillStyle = '#0c0806'; g.beginPath(); g.arc(px, y, 2.6 * s, 0, Math.PI * 2); g.fill();   // 槳孔
    }
  });
  g.fillStyle = 'rgba(40,70,92,0.62)'; g.fillRect(x0 - 90 * s, wl, L + 210 * s, 58 * s);   // 水（半透明，蓋在槳葉上 ⇒ 划水那半拍槳葉在水裡）
  trWaterLine(g, x0 - 90 * s, x1 + 120 * s, wl, u, s);
  g.restore();
  trText(g, '上層 31 支・中層 27 支・下層 27 支（每舷）⇒ 一艘約 170 名槳手', cx, wl + 82 * s, '400 26px ' + TR_SANS, '#e6dcc6', al, 'center', 1);
  trText(g, '撞角', x1 + 40 * s, wl - 44 * s, '600 26px ' + TR_SANS, '#f0c070', al, 'center', 1);
}
/** 烏鴉（corvus）：羅馬船船頭立一根柱子，吊著一座帶尖釘的吊橋；放下來釘進敵船的甲板，步兵從橋上衝過去 —— 把海戰打成陸戰。 */
function trCorvus(g, u, al, cx, cy, s) {
  if (al <= 0.003) return;
  s = s || 1;
  var wl = cy + 70 * s, deckR = cy, deckE = cy + 10 * s;
  g.save(); g.globalAlpha = al; g.lineJoin = 'round'; g.lineCap = 'round';
  trArtPanel(g, cx - 640 * s, cy - 300 * s, 1280 * s, 440 * s);
  trWaterLine(g, cx - 600 * s, cx + 600 * s, wl, u, s);
  function hull(xa, xb, dk, bowRight, col) {                            // 船身：bowRight ⇒ 船首在右
    g.beginPath();
    var xs = bowRight ? xa : xb, xf = bowRight ? xb : xa, d = bowRight ? 1 : -1;
    g.moveTo(xs, dk - 40 * s); g.quadraticCurveTo(xs + d * 10 * s, wl + 4 * s, xs + d * 90 * s, wl + 6 * s);
    g.lineTo(xf - d * 50 * s, wl + 6 * s); g.lineTo(xf, dk); g.lineTo(xs + d * 40 * s, dk); g.closePath();
    g.fillStyle = col; g.fill(); g.strokeStyle = 'rgba(232,200,130,0.85)'; g.lineWidth = 2.5 * s; g.stroke();
  }
  hull(cx - 580 * s, cx - 40 * s, deckR, true, 'rgba(26,18,12,0.95)');   // 羅馬船（左，船首朝右）
  hull(cx + 60 * s, cx + 580 * s, deckE, false, 'rgba(40,22,18,0.95)');  // 迦太基船（右）
  var px = cx - 170 * s, py = deckR - 6 * s, top = deckR - 250 * s, Lb = 300 * s;
  g.strokeStyle = 'rgba(214,180,110,0.95)'; g.lineWidth = 7 * s; g.beginPath(); g.moveTo(px, deckR); g.lineTo(px, top); g.stroke();   // 柱子
  var k = trSmooth(1.4, 1.95, u), fall = k * k, ang = (78 - 82 * fall) * Math.PI / 180;   // 吊著（78°）⇒ 放下（−4°，落在敵船甲板上），越落越快
  if (u > 1.95 && u < 2.3) ang += Math.sin((u - 1.95) / 0.35 * Math.PI) * 0.04;   // 落下那一下彈一點
  var ex = px + Math.cos(ang) * Lb, ey = py - Math.sin(ang) * Lb;
  if (ang > 0.15) { g.strokeStyle = 'rgba(220,206,170,0.7)'; g.lineWidth = 2 * s; g.beginPath(); g.moveTo(px, top); g.lineTo(ex, ey); g.stroke(); }   // 吊索
  g.strokeStyle = '#b07a3c'; g.lineWidth = 14 * s; g.beginPath(); g.moveTo(px, py); g.lineTo(ex, ey); g.stroke();   // 橋面
  var nx = Math.sin(ang), ny = Math.cos(ang);                           // 橋面的法線（朝下那一側）
  g.fillStyle = '#d8d8d8'; g.beginPath(); g.moveTo(ex - 6 * s, ey); g.lineTo(ex + 6 * s, ey); g.lineTo(ex + nx * 30 * s, ey + ny * 30 * s); g.closePath(); g.fill();   // 尖釘（烏鴉的「嘴」）
  for (var i = 0; i < 9; i++) {                                         // 步兵：落橋之後一個接一個衝過去
    var t0 = 2.5 + i * 0.32, w = trClamp01((u - t0) / 1.5); if (u < t0) continue;
    var hx = px - 40 * s + (Lb + 120 * s) * w, hy = (hx < px ? deckR : hx < ex ? py - (hx - px) * Math.tan(ang) : deckE) - 30 * s;
    g.fillStyle = '#e8d6a8'; g.beginPath(); g.arc(hx, hy - 16 * s, 7 * s, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#e8d6a8'; g.lineWidth = 4 * s; g.beginPath(); g.moveTo(hx, hy - 9 * s); g.lineTo(hx, hy + 16 * s); g.stroke();
    g.fillStyle = '#a8322a'; g.fillRect(hx + 3 * s, hy - 8 * s, 9 * s, 18 * s);   // 盾
  }
  g.restore();
  trText(g, '烏鴉　corvus', px - 30 * s, top + 20 * s, '600 30px ' + TR_SANS, '#f0c070', al, 'right', 2);
  trText(g, '羅馬', cx - 330 * s, wl + 44 * s, '400 26px ' + TR_SANS, '#e6dcc6', al, 'center', 1);
  trText(g, '迦太基', cx + 330 * s, wl + 44 * s, '400 26px ' + TR_SANS, '#e6dcc6', al, 'center', 1);
}

/** 古海圖（Tim：「此處有龍 的由來 以及那時代的海圖測繪」「可以放在魔法篇(奇幻又有科普)」）：羊皮紙、羅盤玫瑰與恆向線（波特蘭海圖）、海岸、
 *  會扭動的海蛇、HIC SVNT DRACONES；k2（0→1）之後浮出水深數字與測深錘。全是 u 的純函數。 */
function trChart(g, u, al, x0, y0, W, H, k2) {
  if (al <= 0.003) return;
  g.save(); g.globalAlpha = al;
  var bg = g.createRadialGradient(x0 + W / 2, y0 + H / 2, H * 0.2, x0 + W / 2, y0 + H / 2, H * 0.85);
  bg.addColorStop(0, '#e4d2a6'); bg.addColorStop(1, '#a98a5a'); g.fillStyle = bg; g.fillRect(x0, y0, W, H);
  g.strokeStyle = 'rgba(80,52,24,0.9)'; g.lineWidth = 3; g.strokeRect(x0 + 10, y0 + 10, W - 20, H - 20);
  g.save(); g.beginPath(); g.rect(x0 + 10, y0 + 10, W - 20, H - 20); g.clip();
  var rx = x0 + W * 0.58, ry = y0 + H * 0.52, R = Math.hypot(W, H);
  for (var i = 0; i < 32; i++) {                                         // 恆向線：從羅盤玫瑰放射出去（波特蘭海圖的格網）
    var a = i / 32 * Math.PI * 2; g.strokeStyle = i % 4 === 0 ? 'rgba(60,40,20,0.55)' : i % 2 ? 'rgba(40,110,60,0.35)' : 'rgba(150,40,30,0.45)'; g.lineWidth = i % 4 ? 1 : 1.6;
    g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx + Math.cos(a) * R, ry + Math.sin(a) * R); g.stroke();
  }
  g.fillStyle = 'rgba(120,36,26,0.85)';                                  // 羅盤玫瑰
  for (i = 0; i < 8; i++) { var b = i / 8 * Math.PI * 2, L2 = i % 2 ? 34 : 62; g.beginPath(); g.moveTo(rx + Math.cos(b) * L2, ry + Math.sin(b) * L2); g.lineTo(rx + Math.cos(b + 0.32) * 12, ry + Math.sin(b + 0.32) * 12); g.lineTo(rx + Math.cos(b - 0.32) * 12, ry + Math.sin(b - 0.32) * 12); g.closePath(); g.fill(); }
  g.strokeStyle = 'rgba(70,46,20,0.95)'; g.lineWidth = 2.5; g.fillStyle = 'rgba(176,150,96,0.95)';   // 海岸（照固定的正弦疊起來）
  g.beginPath(); g.moveTo(x0, y0 + H * 0.18);
  for (var s = 0; s <= 60; s++) { var q = s / 60, xx = x0 + q * W * 0.62, yy = y0 + H * 0.18 + Math.sin(q * 17) * 14 + Math.sin(q * 41 + 1) * 6 + q * q * H * 0.10; g.lineTo(xx, yy); }
  for (s = 0; s <= 40; s++) { q = s / 40; g.lineTo(x0 + W * 0.62 - q * W * 0.10 + Math.sin(q * 23) * 10, y0 + H * 0.28 - q * H * 0.28); }
  g.lineTo(x0, y0); g.closePath(); g.fill(); g.stroke();
  // 海蛇：一節一節拱出水面（照 u 往前游、身體起伏）
  var sx = x0 + W * 0.18 + u * 4, sy = y0 + H * 0.70;
  g.strokeStyle = 'rgba(40,60,50,0.95)'; g.fillStyle = 'rgba(70,110,90,0.9)'; g.lineWidth = 3;
  for (var k = 0; k < 5; k++) { var hx = sx + k * 62, hh = 26 + 8 * Math.sin(u * 2.2 + k * 1.3);
    g.beginPath(); g.moveTo(hx - 26, sy); g.bezierCurveTo(hx - 22, sy - hh * 1.6, hx + 22, sy - hh * 1.6, hx + 26, sy); g.lineTo(hx + 14, sy); g.bezierCurveTo(hx + 12, sy - hh * 0.9, hx - 12, sy - hh * 0.9, hx - 14, sy); g.closePath(); g.fill(); g.stroke(); }
  var hx2 = sx - 54, hy = sy - 34 - 6 * Math.sin(u * 2.2);              // 頭：張著嘴
  g.beginPath(); g.moveTo(hx2 + 30, sy); g.quadraticCurveTo(hx2 + 20, hy - 14, hx2 - 10, hy - 6); g.lineTo(hx2 - 44, hy + 2); g.lineTo(hx2 - 14, hy + 8); g.lineTo(hx2 - 40, hy + 20); g.lineTo(hx2 - 6, hy + 16); g.quadraticCurveTo(hx2 + 6, sy - 6, hx2 + 14, sy); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#f2e2a8'; g.beginPath(); g.arc(hx2 - 8, hy + 1, 3.5, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(60,40,20,0.6)'; g.lineWidth = 1.5;               // 水波
  for (k = -1; k < 7; k++) { var wx = sx + k * 62 - 30; g.beginPath(); g.moveTo(wx, sy + 4); g.quadraticCurveTo(wx + 15, sy + 12, wx + 30, sy + 4); g.stroke(); }
  // 小船（三根桅、方帆）
  var px = x0 + W * 0.78, py = y0 + H * 0.30; g.fillStyle = 'rgba(70,46,20,0.9)'; g.beginPath(); g.moveTo(px - 30, py); g.lineTo(px + 30, py); g.lineTo(px + 20, py + 10); g.lineTo(px - 22, py + 10); g.closePath(); g.fill();
  g.fillStyle = 'rgba(245,235,210,0.95)'; [-16, 0, 16].forEach(function (o) { g.fillRect(px + o - 7, py - 30, 14, 12); g.fillRect(px + o - 6, py - 16, 12, 12); });
  // 水深數字（測深）：k2 之後一個一個浮出來
  if (k2 > 0) {
    g.fillStyle = 'rgba(40,28,14,0.9)'; g.font = 'italic 600 22px ' + TR_SERIF; g.textAlign = 'center';
    var SDG = [[0.30, 0.40, '7'], [0.40, 0.46, '9'], [0.50, 0.44, '12'], [0.36, 0.55, '11'], [0.62, 0.38, '15'], [0.72, 0.48, '18'], [0.48, 0.60, '14'], [0.84, 0.62, '23'], [0.26, 0.48, '5'], [0.58, 0.70, '21'], [0.70, 0.80, '27'], [0.86, 0.36, '20']];
    SDG.forEach(function (d, j) { var a2 = trClamp01(k2 * SDG.length - j); if (a2 <= 0) return; g.globalAlpha = al * a2; g.fillText(d[2], x0 + W * d[0], y0 + H * d[1]); });
    g.globalAlpha = al * trClamp01(k2 * 2);                              // 測深錘：繩子＋鉛錘（錘底抹獸脂、帶回海底的泥沙）
    var lx = x0 + W * 0.90, ly0 = y0 + H * 0.10, ly1 = y0 + H * (0.30 + 0.25 * trClamp01(k2 * 1.5));
    g.strokeStyle = 'rgba(60,40,20,0.9)'; g.lineWidth = 2; g.setLineDash([6, 5]); g.beginPath(); g.moveTo(lx, ly0); g.lineTo(lx, ly1); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(70,70,74,0.95)'; g.beginPath(); g.moveTo(lx - 8, ly1); g.lineTo(lx + 8, ly1); g.lineTo(lx + 11, ly1 + 34); g.lineTo(lx - 11, ly1 + 34); g.closePath(); g.fill();
    g.fillStyle = 'rgba(230,220,180,0.95)'; g.fillRect(lx - 11, ly1 + 30, 22, 5);
  }
  g.restore();
  g.globalAlpha = al; g.fillStyle = 'rgba(70,30,20,0.95)'; g.font = 'italic 600 34px ' + TR_SERIF; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('HIC SVNT DRACONES', x0 + W * 0.40, y0 + H * 0.86);
  g.restore();
}

/** 畫面上一格的淡入淡出（整格黑）。 */
function trBlack(g, al) { if (al <= 0.003) return; g.save(); g.globalAlpha = Math.min(1, al); g.fillStyle = '#000'; g.fillRect(0, 0, TR_CW, TR_CH); g.restore(); }
function trVignette(g, k) {
  var r = g.createRadialGradient(TR_CW / 2, TR_CH / 2, TR_CH * 0.35, TR_CW / 2, TR_CH / 2, TR_CH * 0.95);
  r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(0,0,0,' + k + ')'); g.fillStyle = r; g.fillRect(0, 0, TR_CW, TR_CH);
}
/** 固定種子的雜訊（膠片顆粒）：照 t 的第幾格（24 fps）選一組 —— 同一個 t 同一組。 */
var TR_GRAIN = null;
function trGrain(g, t, k) {
  if (!TR_GRAIN) {
    TR_GRAIN = [];
    for (var j = 0; j < 4; j++) {
      var c = document.createElement('canvas'); c.width = 256; c.height = 256; var x = c.getContext('2d'), im = x.createImageData(256, 256);
      for (var i = 0; i < 256 * 256; i++) { var v = Math.sin((i + j * 70001) * 12.9898) * 43758.5453; v = (v - Math.floor(v)) * 255 | 0; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
      x.putImageData(im, 0, 0); TR_GRAIN.push(c);
    }
  }
  var f = Math.floor(t * 24), c2 = TR_GRAIN[f & 3];
  g.save(); g.globalAlpha = k; g.globalCompositeOperation = 'overlay';
  var ox = (f * 97) % 256, oy = (f * 57) % 256;
  for (var yy = -oy; yy < TR_CH; yy += 256) for (var xx = -ox; xx < TR_CW; xx += 256) g.drawImage(c2, xx, yy);
  g.restore();
}
function trOverlay(t, A) {
  if (!trG) return;
  var g = trG, sc = A.sc, u = A.u;
  g.clearRect(0, 0, TR_CW, TR_CH);
  trVignette(g, sc.vig !== undefined ? sc.vig : 0.45);
  var bars = sc.bars !== undefined ? sc.bars : 0.075;
  if (bars > 0) { g.fillStyle = '#000'; g.fillRect(0, 0, TR_CW, TR_CH * bars); g.fillRect(0, TR_CH * (1 - bars), TR_CW, TR_CH * bars); }
  if (sc.year && sc.era !== false) trTimeline(g, sc.year, trFade(u, 0.2, sc.dur - 0.2, 0.5) * 0.9);
  trMarks(g, u);
  if (sc.cap) { try { sc.cap(g, u, A.tau, SHIPS, sc); } catch (e) { if (!TR.capErr) { TR.capErr = 1; console.error('字幕（' + (sc.id || sc.i) + '）：', e); } } }   // 一幕的字幕壞了 ⇒ 那一幕少字，片子照播
  trGrain(g, t, 0.06);
  var fi = sc.fadeIn !== undefined ? sc.fadeIn : 0.25, fo = sc.fadeOut !== undefined ? sc.fadeOut : 0.25;
  var b = 0;
  if (fi > 0) b = Math.max(b, 1 - trSmooth(0, fi, u));
  if (fo > 0) b = Math.max(b, trSmooth(sc.dur - fo, sc.dur, u));
  if (sc.black) b = Math.max(b, sc.black(u));
  trBlack(g, b);
  if (sc.over) { try { sc.over(g, u); } catch (e) { if (!TR.capErr) { TR.capErr = 1; console.error('字卡（' + (sc.id || sc.i) + '）：', e); } } }   // 壓在黑場上面的字（字卡前導 sc.lead）
}

// ── 播放器 ──
function trFmt(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
function trUI() {
  var load = trEl('trLoad'), cover = trEl('trCover'), bar = trEl('trBar'), end = trEl('trEnd'), buf = trEl('trBuf');
  if (!load) return;
  if (TR.err) { load.style.display = 'flex'; trEl('trLoadS').textContent = '載入失敗：' + TR.err; return; }
  if (!TR.ready) {
    load.style.display = 'flex';
    var k = TR.loadAll ? (TR.loadN + 0.5) / TR.loadAll : 0;
    trEl('trLoadI').style.width = Math.round(Math.min(1, k) * 100) + '%';
    trEl('trLoadS').textContent = TR.loadAll ? '載入船隻 ' + Math.min(TR.loadN + 1, TR.loadAll) + '／' + TR.loadAll + '：' + TR.loadName + (TR.loadStep ? '（' + TR.loadStep + '）' : '') : '準備遊戲引擎…';
    return;
  }
  load.style.display = 'none';
  if (!TR.started && !TR.still) cover.style.display = 'flex'; else cover.style.display = 'none';
  buf.style.display = TR.buffering && (TR.playing || TR.waitLoad) ? 'block' : 'none'; buf.textContent = TR.waitLoad ? '載入船隻 ' + TR.loadN + '／' + TR.loadAll + '…' : '準備中…';
  trEl('trTime').textContent = trFmt(TR.t) + ' / ' + trFmt(TR.DUR);
  trEl('trPlay').textContent = TR.playing ? '⏸' : TR.t >= TR.DUR ? '⟲' : '▶';
  end.style.display = TR.t >= TR.DUR - (TR.endShow || 6) ? 'flex' : 'none';
  trEl('trReplay').style.display = TR.t >= TR.DUR && !TR.playing ? '' : 'none';   // 重播：播完才出現（片尾那 10 秒只有試玩、最新版本）
}
function trPlay() {
  if (!TR.ready) return;
  trAudioInit();
  if (TR.t >= TR.DUR) { TR.t = 0; TR.dirty = true; }
  TR.started = true; TR.playing = true; TR.last = 0;
  trMusicAt(TR.t);
  trUI();
}
function trPause(atEnd) { TR.playing = false; trMusicStop(); trUI(); }
/** 跳到 t（只給測試入口 __tr.seek 用；播放器沒有拖曳的時間軸）。 */
function trSeek(t) { TR.t = Math.max(0, Math.min(TR.DUR, t)); TR.dirty = true; TR.started = true; if (TR.playing) trMusicAt(TR.t); trUI(); }
function trWire() {
  var ui = trEl('trUI'); if (!ui || TR.wired) return;
  TR.wired = true; trG = trEl('trCap').getContext('2d');
  if (TR.still) ui.classList.add('still');
  trEl('trCover').addEventListener('click', trPlay);
  trEl('trPlay').addEventListener('click', function () { TR.playing ? trPause() : trPlay(); });
  trEl('trReplay').addEventListener('click', trPlay);                   // 播完 ⇒ trPlay 從 0 開始（只往前播：沒有拖曳的時間軸，Tim 2026-10-19）
  trEl('trMute').addEventListener('click', function () { TR.muted = !TR.muted; trEl('trMute').textContent = TR.muted ? '🔇' : '🔊'; trAudioMute(); });
  // 片尾：試玩（同一份檔、帶 ?play=1 ⇒ 正常的遊戲）、遊戲最新版本（線上）—— 在畫廊的彈窗（sandbox iframe）裡開不了新頁 ⇒ 改成提示
  trEl('trTry').addEventListener('click', function () {
    if (TR.framed) { trHint('請按畫廊下方的「🎬 新分頁全螢幕播放」，在新分頁裡試玩'); return; }
    var q = new URLSearchParams(location.search); q.delete('t'); q.delete('still'); q.set('play', '1');
    location.search = q.toString();
  });
  var lk = trEl('trLatest'); lk.href = TR_LATEST; lk.target = '_blank'; lk.rel = 'noopener';
  lk.addEventListener('click', function (e) { if (TR.framed) { e.preventDefault(); trHint('請按畫廊下方的「🎬 新分頁全螢幕播放」，或直接開 ' + TR_LATEST); } });
  trEl('trURL').textContent = TR_LATEST.replace(/^https:\/\//, '').replace(/\/$/, '');
  // 鍵盤：一律先攔下來（遊戲的按鍵會開砲、轉舵 ⇒ 改到戰局），只處理播放器的
  window.addEventListener('keydown', function (e) {
    if (!TRAILER) return;
    e.stopImmediatePropagation();
    if (e.code === 'Space') { e.preventDefault(); TR.playing ? trPause() : trPlay(); }
    else if (e.key === 'm' || e.key === 'M') trEl('trMute').click();
  }, true);
  window.addEventListener('keyup', function (e) { if (TRAILER) e.stopImmediatePropagation(); }, true);
}
function trHint(s) { var h = trEl('trHint'); h.textContent = s; h.style.opacity = 1; clearTimeout(trHint.tm); trHint.tm = setTimeout(function () { h.style.opacity = 0; }, 4200); }
