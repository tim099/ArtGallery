// ── 方舷放置的畫面元件（字幕層 #trCap，1920×1080；全是片長 u 的純函數）──
// 遊戲裡這些是 DOM／CSS 動畫（Sharkside src/js/40_fx.js、src/idle.css）：DOM 錄不進影片、CSS 動畫不能停在某一格 ⇒ 這裡照同樣的樣子畫在畫布上。
// 色票照 Sharkside idle.css :root（深海 #061220、海 #4fd1ff／#2b8bd6、金 #ffd166、珊瑚 #ff6b6b、碎片紫 #b58cff、綠 #5be3a1、字 #e8f4ff）。
var TR_SK = { deep: '#061220', sea: '#4fd1ff', sea2: '#2b8bd6', gold: '#ffd166', coral: '#ff6b6b', shd: '#b58cff', good: '#5be3a1', ink: '#e8f4ff', dim: '#8fb0c8' };
var TR_HEAVY = '"Arial Black","Segoe UI Black","Noto Sans TC","Microsoft JhengHei",sans-serif';
var TR_EMOJI = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

function trImgOk(im) { return !!(im && im.complete && im.naturalWidth > 0); }
/** 以 (cx, cy) 為中心、寬 w（高照圖的比例）。回實際的高（讀不到 ⇒ 0）。 */
function trPicC(g, key, cx, cy, w, al, rot) {
  var im = trImg(key); if (!trImgOk(im) || al <= 0.003) return 0;
  var h = w * im.naturalHeight / im.naturalWidth;
  g.save(); g.globalAlpha = Math.min(1, al); g.translate(cx, cy); if (rot) g.rotate(rot); g.drawImage(im, -w / 2, -h / 2, w, h); g.restore();
  return h;
}
/** 整張蓋滿畫面（像 CSS cover）＋慢推：z 放大倍率、(fx, fy) 推向哪裡（0～1）。 */
function trCover(g, key, al, z, fx, fy) {
  var im = trImg(key); if (!trImgOk(im) || al <= 0.003) return false;
  var s = Math.max(TR_CW / im.naturalWidth, TR_CH / im.naturalHeight) * (z || 1), w = im.naturalWidth * s, h = im.naturalHeight * s;
  var x = (TR_CW - w) * (fx === undefined ? 0.5 : fx), y = (TR_CH - h) * (fy === undefined ? 0.5 : fy);
  g.save(); g.globalAlpha = Math.min(1, al); g.imageSmoothingEnabled = false; g.drawImage(im, x, y, w, h); g.restore();   // 像素風 ⇒ 放大不糊
  return true;
}
/** 中文大數字：萬、億、兆、京（遊戲 00_base.js I.fmt 同一套進位）。 */
function trFmtZh(n) {
  n = Math.max(0, n);
  if (n < 1e4) return Math.round(n).toLocaleString('en-US');
  var U = [[1e16, '京'], [1e12, '兆'], [1e8, '億'], [1e4, '萬']];
  for (var i = 0; i < U.length; i++) if (n >= U[i][0]) { var v = n / U[i][0]; return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.round(v).toString()) + U[i][1]; }
  return String(Math.round(n));
}
/** 粗外框字（遊戲咬一口那種 Arial Black＋描邊）。 */
function trBold(g, s, x, y, px, fill, stroke, al, align, sw, glow) {
  if (al <= 0.003) return;
  g.save(); g.globalAlpha = Math.min(1, al); g.font = '900 ' + px + 'px ' + TR_HEAVY; g.textAlign = align || 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = sw || Math.max(4, px * 0.16); g.strokeStyle = stroke || '#0b3a5e';
  if (glow) { g.shadowColor = glow; g.shadowBlur = px * 0.5; }
  g.strokeText(s, x, y); g.shadowBlur = 0; g.fillStyle = fill || '#fff'; g.fillText(s, x, y); g.restore();
}
/** 圓角矩形路徑。 */
function trRound(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
/** 一段字照寬度斷行（中文逐字、英文單字照空白）。 */
function trWrap(g, s, maxW, font) {
  g.save(); g.font = font; var out = [], line = '';
  for (var i = 0; i < s.length; i++) { var t = line + s[i]; if (g.measureText(t).width > maxW && line) { out.push(line); line = s[i]; } else line = t; }
  if (line) out.push(line); g.restore(); return out;
}
/** 0～1 的彈出（超過一點再回來）。 */
function trPop(p) { p = trClamp01(p); return p < 0.6 ? trSmooth(0, 0.6, p) * 1.12 : 1.12 - 0.12 * trSmooth(0.6, 1, p); }

// ── 咬一口（遊戲 40_fx.js I.chomp：上下顎咬合 0.45 秒、字留久一點）──
/** (x, y) 為中心；k ＝ 大小倍率（1 ＝ 遊戲的一般一口）；p ＝ 0～1 跑完一口；word 牙上面的字；crit 暴擊金字。 */
function trJaw(g, x, y, k, p, word, crit) {
  if (p < 0 || p > 1) return;
  var W = 250 * k, s = W / 512, H = 192 * s;                           // 上下顎各 512×192；咬合時上顎在 0、下顎在 48（art/evidence/fx/jaw-alignment.json）
  var close = p < 0.3 ? trSmooth(0, 0.3, p) : 1 - trSmooth(0.48, 0.9, p), gap = (1 - close) * 90 * s * 2.2;
  var al = 1 - trSmooth(0.72, 1, p), top = y - 120 * s - gap, bot = y - 120 * s + 48 * s + gap;
  if (p > 0.26 && p < 0.62) {                                            // 咬合那一下：一圈白光
    var q = trSmooth(0.26, 0.62, p);
    g.save(); g.globalAlpha = 0.85 * (1 - q); g.strokeStyle = crit ? '#ffe08a' : '#ffffff'; g.lineWidth = 8 * k; g.beginPath(); g.arc(x, y, (40 + 120 * q) * k, 0, Math.PI * 2); g.stroke(); g.restore();
  }
  trPic(g, 'fx/jaw-top', x - W / 2, top, W, H, al);
  trPic(g, 'fx/jaw-bottom', x - W / 2, bot, W, H, al);
  if (word) {
    var wp = trSmooth(0.22, 0.4, p), wa = trFade(p, 0.24, 1, 0.12);
    trBold(g, word, x, y - 120 * k - 30 * wp, Math.round((crit ? 50 : 40) * k * trPop((p - 0.22) / 0.3)), crit ? '#ffe08a' : '#ffffff', '#8a1023', wa, 'center', 8 * k);
  }
}
/** 飄字（往上飄、淡掉）：p 0～1。 */
function trFloatG(g, x, y, s, p, col, px) {
  if (p < 0 || p > 1) return;
  var al = Math.min(trSmooth(0, 0.12, p), 1 - trSmooth(0.65, 1, p)), yy = y - 90 * trSmooth(0, 1, p), sz = Math.round(px * trPop(p / 0.3));
  trBold(g, s, x, yy, sz, col || '#ffd166', '#2a1600', al, 'center', Math.max(5, sz * 0.14), 'rgba(0,0,0,.55)');
}
/** 連咬計數（右邊）：n 第幾口、mult 倍率字、p 0～1（彈出、慢慢淡）、crit。 */
function trComboG(g, n, mult, p, crit) {
  if (p < 0 || p > 1 || n < 2) return;
  var al = 1 - trSmooth(0.7, 1, p), x = TR_CW - 210, y = TR_CH * 0.44, k = trPop(p / 0.18);
  trBold(g, String(n), x, y, Math.round(120 * k), crit ? '#ffe08a' : '#ffffff', crit ? '#8a1023' : '#0b3a5e', al, 'center', 14, crit ? 'rgba(255,200,80,.8)' : 'rgba(79,209,255,.8)');
  trBold(g, '連咬 ' + mult + (crit ? '・暴擊 ×2' : ''), x, y + 92, 34, crit ? '#ffe08a' : '#bff0ff', '#06233a', al, 'center', 7);
  g.save(); g.globalAlpha = al * 0.9; g.fillStyle = 'rgba(6,18,32,.6)'; trRound(g, x - 120, y + 128, 240, 12, 6); g.fill();
  g.fillStyle = crit ? '#ffd166' : '#4fd1ff'; trRound(g, x - 120, y + 128, 240 * (1 - p), 12, 6); g.fill(); g.restore();
}
/** 蓄力條（下方中間，跟遊戲同一個樣子）：f 0～1；滿了寫「全力」。 */
function trCharge(g, f, al) {
  if (al <= 0.003) return;
  var w = 460, h = 54, x = TR_CW / 2 - w / 2, y = TR_CH - 120, full = f >= 0.92;
  g.save(); g.globalAlpha = al; g.fillStyle = 'rgba(6,18,32,.82)'; trRound(g, x, y, w, h, 27); g.fill();
  g.strokeStyle = full ? 'rgba(255,209,102,.95)' : 'rgba(127,216,255,.55)'; g.lineWidth = 3; g.stroke();
  var bx = x + 64, bw = w - 64 - 112, by = y + 20;
  g.fillStyle = 'rgba(255,255,255,.12)'; trRound(g, bx, by, bw, 14, 7); g.fill();
  var gr = g.createLinearGradient(bx, 0, bx + bw, 0); gr.addColorStop(0, '#2b8bd6'); gr.addColorStop(1, full ? '#ffd166' : '#4fd1ff');
  g.fillStyle = gr; trRound(g, bx, by, Math.max(14, bw * trClamp01(f)), 14, 7); g.fill(); g.restore();
  trText(g, '🦷', x + 34, y + h / 2 + 1, '30px ' + TR_EMOJI, '#fff', al, 'center');
  trText(g, full ? '全力' : Math.round(f * 100) + '%', x + w - 58, y + h / 2, '700 26px ' + TR_SANS, full ? '#ffd166' : '#bfe9ff', al, 'center');
}
/** 上方的格數（遊戲的資源列）：val 現在幾格、rate 每秒、al。 */
function trTicker(g, val, rate, al) {
  if (al <= 0.003) return;
  var w = 520, h = 76, x = TR_CW / 2 - w / 2, y = 34;
  g.save(); g.globalAlpha = al; g.fillStyle = 'rgba(6,18,32,.84)'; trRound(g, x, y, w, h, 18); g.fill();
  g.strokeStyle = 'rgba(127,216,255,.35)'; g.lineWidth = 2; g.stroke(); g.restore();
  if (!trPic(g, 'ui/blocks', x + 22, y + 12, 52, 52, al)) trText(g, '🧱', x + 48, y + h / 2, '40px ' + TR_EMOJI, '#fff', al, 'center');
  trText(g, trFmtZh(val), x + 96, y + h / 2 + 1, '900 48px ' + TR_SANS, TR_SK.gold, al, 'left');
  trText(g, '格', x + 300, y + h / 2 + 4, '600 26px ' + TR_SANS, TR_SK.dim, al, 'left');
  if (rate) trText(g, '+' + trFmtZh(rate) + '/秒', x + w - 22, y + h / 2 + 2, '700 26px ' + TR_SANS, TR_SK.good, al, 'right');
}
/** 點一下的漣漪（觸控）。 */
function trTap(g, x, y, p) {
  if (p < 0 || p > 1) return;
  g.save(); g.globalAlpha = 0.9 * (1 - p); g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.beginPath(); g.arc(x, y, 18 + 70 * trSmooth(0, 1, p), 0, Math.PI * 2); g.stroke();
  g.globalAlpha = 0.6 * (1 - trSmooth(0, 0.4, p)); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, 16, 0, Math.PI * 2); g.fill(); g.restore();
}
/** 左上的小卡（武器、技能）：圖示、名字、一行說明；fb ＝ 沒有圖時的 emoji。 */
function trCardTL(g, key, fb, name, desc, al, sub) {
  if (al <= 0.003) return;
  var x = 96, y = 96, w = 760, h = sub ? 150 : 128, sl = 60 * (1 - trSmooth(0, 1, al));
  g.save(); g.globalAlpha = al; g.translate(-sl, 0); g.fillStyle = 'rgba(6,18,32,.86)'; trRound(g, x, y, w, h, 20); g.fill();
  g.strokeStyle = 'rgba(255,209,102,.7)'; g.lineWidth = 3; g.stroke(); g.fillStyle = TR_SK.gold; g.fillRect(x, y + 18, 8, h - 36); g.restore();
  if (!trPic(g, key, x + 26 - sl, y + (h - 92) / 2, 92, 92, al)) trText(g, fb, x + 72 - sl, y + h / 2, '64px ' + TR_EMOJI, '#fff', al, 'center');
  trText(g, name, x + 140 - sl, y + 44, '900 46px ' + TR_SANS, '#ffffff', al, 'left', 2);
  trText(g, desc, x + 140 - sl, y + 94, '500 27px ' + TR_SANS, '#cfe6f5', al, 'left', 1);
  if (sub) trText(g, sub, x + 140 - sl, y + 130, '500 23px ' + TR_SANS, TR_SK.dim, al, 'left', 1);
}
/** 看板娘莎夏（站姿，底部錨在 (x, yb)，高 h）＋對話框（bubble：字、框的寬）。mood：normal／smug／angry／flustered。 */
function trSasha(g, mood, x, yb, h, al, say, bw, bob, above) {
  if (al <= 0.003) return;
  var w = h * 1024 / 1536, dy = (bob || 0) + 30 * (1 - trSmooth(0, 1, al));
  trPic(g, 'mascot/' + mood, x, yb - h + dy, w, h, al);
  if (!say) return;
  var font = '600 32px ' + TR_SANS, L = trWrap(g, say, (bw || 560) - 56, font), bh = 40 + L.length * 46, bx = above ? x + w * 0.22 : x + w * 0.72, by = above ? yb - h - bh - 6 + dy : yb - h * 0.86 + dy;   // above：框在頭頂上（不蓋到旁邊的東西）
  g.save(); g.globalAlpha = al; g.fillStyle = 'rgba(248,252,255,.96)'; trRound(g, bx, by, bw || 560, bh, 26); g.fill();
  if (above) { g.beginPath(); g.moveTo(bx + w * 0.3, by + bh - 2); g.lineTo(bx + w * 0.36, by + bh + 34); g.lineTo(bx + w * 0.44, by + bh - 2); g.closePath(); g.fill(); }
  else { g.beginPath(); g.moveTo(bx + 18, by + bh * 0.55); g.lineTo(bx - 26, by + bh * 0.78); g.lineTo(bx + 30, by + bh * 0.72); g.closePath(); g.fill(); }
  g.fillStyle = '#c9952e'; trRound(g, bx + 20, by - 22, 104, 40, 20); g.fill(); g.restore();
  trText(g, '莎夏', bx + 72, by - 2, '800 24px ' + TR_SANS, '#fff8e8', al, 'center', 2);
  L.forEach(function (s, i) { trText(g, s, bx + 28, by + 44 + i * 46, font, '#13263a', al, 'left'); });
}
/** 強化三選一的一張卡（遊戲 50_ui.js perkShow）：rar ＝ common／rare／epic。 */
function trPerkCard(g, cx, cy, w, rar, key, fb, name, desc, al, lift, glow) {
  if (al <= 0.003) return;
  var h = w * 352 / 256, x = cx - w / 2, y = cy - h / 2 - (lift || 0), RC = { common: '#c9a46a', rare: '#5ec8ff', epic: '#c58cff' }[rar], RN = { common: '普通', rare: '稀有', epic: '史詩' }[rar];
  g.save(); g.globalAlpha = al;
  if (glow) { g.shadowColor = RC; g.shadowBlur = 50 * glow; }
  g.fillStyle = 'rgba(10,22,38,.96)'; trRound(g, x + w * 0.1, y + h * 0.1, w * 0.8, h * 0.82, 10); g.fill(); g.restore();
  if (!trPic(g, 'perk/frame-' + rar, x, y, w, h, al)) { g.save(); g.globalAlpha = al; g.strokeStyle = RC; g.lineWidth = 6; trRound(g, x, y, w, h, 16); g.stroke(); g.restore(); }
  trText(g, RN, cx, y + h * 0.17, '700 24px ' + TR_SANS, RC, al, 'center', 4);
  if (!trPic(g, key, cx - w * 0.22, y + h * 0.22, w * 0.44, w * 0.44, al)) trText(g, fb, cx, y + h * 0.22 + w * 0.22, Math.round(w * 0.3) + 'px ' + TR_EMOJI, '#fff', al, 'center');
  trText(g, name, cx, y + h * 0.62, '900 ' + Math.round(w * 0.11) + 'px ' + TR_SANS, '#ffffff', al, 'center', 1);
  var L = trWrap(g, desc, w * 0.68, '500 ' + Math.round(w * 0.075) + 'px ' + TR_SANS);
  L.slice(0, 3).forEach(function (s, i) { trText(g, s, cx, y + h * 0.71 + i * w * 0.1, '500 ' + Math.round(w * 0.075) + 'px ' + TR_SANS, '#cfe2f0', al, 'center'); });
}
/** 海區橫幅（上方一條）：rk ＝ region-N／abyss；名字、一句話。 */
function trRegion(g, rk, name, say, al, y) {
  if (al <= 0.003) return;
  y = y === undefined ? 70 : y;
  var w = 1180, h = w * 300 / 960, x = TR_CW / 2 - w / 2, sl = 40 * (1 - trSmooth(0, 1, al));
  g.save(); g.globalAlpha = al; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 30; g.fillStyle = '#061220'; g.fillRect(x, y - sl, w, h); g.restore();
  trPic(g, 'region/banner-' + rk, x, y - sl, w, h, al);
  g.save(); g.globalAlpha = al; var gr = g.createLinearGradient(0, y - sl + h * 0.35, 0, y - sl + h); gr.addColorStop(0, 'rgba(6,20,36,0)'); gr.addColorStop(1, 'rgba(6,20,36,.9)');
  g.fillStyle = gr; g.fillRect(x, y - sl, w, h); g.restore();
  trPic(g, 'region/' + rk, x + 30, y - sl + h - 128, 104, 104, al);
  trText(g, name, x + 152, y - sl + h - 92, '900 54px ' + TR_SANS, '#ffffff', al, 'left', 3);
  if (say) trText(g, say, x + 152, y - sl + h - 40, '500 28px ' + TR_SANS, '#d6ecfa', al, 'left', 1);
}
/** 巨齒鯊（遊戲 40_fx.js mega：畫面一暗、一條大鯊魚從下面撲上來、大字）：p 0～1 跑完。 */
function trMegaFx(g, p) {
  if (p <= 0 || p >= 1) return;
  var dk = Math.min(trSmooth(0, 0.15, p), 1 - trSmooth(0.75, 1, p));
  g.save(); var gr = g.createRadialGradient(TR_CW / 2, TR_CH * 0.55, 100, TR_CW / 2, TR_CH * 0.55, TR_CW * 0.75);
  gr.addColorStop(0, 'rgba(2,10,20,' + (0.25 * dk) + ')'); gr.addColorStop(1, 'rgba(2,10,20,' + (0.85 * dk) + ')'); g.fillStyle = gr; g.fillRect(0, 0, TR_CW, TR_CH); g.restore();
  var up = trSmooth(0.05, 0.42, p), out = trSmooth(0.62, 0.95, p), y = TR_CH * (1.25 - 0.72 * up) - TR_CH * 0.9 * out, w = TR_CW * (0.62 + 0.12 * up);
  trPicC(g, 'fx/mega', TR_CW * 0.5 + 60 * up, y, w, 1 - trSmooth(0.85, 1, p), -0.12 + 0.1 * up);
  trBold(g, '巨齒鯊！', TR_CW / 2, TR_CH * 0.2, Math.round(130 * trPop((p - 0.18) / 0.3)), '#ffffff', '#0b3a5e', trFade(p, 0.18, 0.92, 0.08), 'center', 18, 'rgba(79,209,255,.9)');
}
/** 鯊鰭（fx/fin）：海面上 (x, y)、大小 s、往左右游（flip）。 */
function trFin(g, x, y, s, al, flip) {
  var im = trImg('fx/fin'); if (!trImgOk(im) || al <= 0.003) return;
  g.save(); g.globalAlpha = al; g.translate(x, y); if (flip) g.scale(-1, 1); g.drawImage(im, -s / 2, -s * 0.85, s, s); g.restore();
}
/** 鏡頭到世界一點的距離（大小照它縮放）。 */
function trDistTo(p) { var e = CAM.eye || [0, 0, 0]; return Math.hypot(p[0] - e[0], p[1] - e[1], p[2] - e[2]); }
/** 海面上一件漂流寶物（木桶、寶箱、軍火箱…）：世界點 w、上下浮、光暈。 */
function trLootAt(g, key, fb, w, u, al, glow) {
  if (al <= 0.003) return;
  var y = seaH(w[0], w[2], SIMT) + 0.35 + 0.25 * Math.sin(u * 3.1 + w[0]), p = trProject([w[0], y, w[2]]); if (!p) return;
  var s = trClamp(5200 / Math.max(8, trDistTo(w)), 34, 140);
  if (glow) { g.save(); g.globalAlpha = al * 0.55 * (0.7 + 0.3 * Math.sin(u * 5)); var gr = g.createRadialGradient(p[0], p[1], 2, p[0], p[1], s * 0.9); gr.addColorStop(0, glow); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(p[0] - s, p[1] - s, s * 2, s * 2); g.restore(); }
  if (!trPicC(g, key, p[0], p[1] - s * 0.3, s, al, 0.12 * Math.sin(u * 2.3 + w[2]))) trText(g, fb, p[0], p[1] - s * 0.3, Math.round(s * 0.7) + 'px ' + TR_EMOJI, '#fff', al, 'center');
  return p;
}
function trClamp(x, a, b) { return x < a ? a : x > b ? b : x; }
/** 鏡頭的震動（咬下去、爆炸那幾格）：hits ＝ [片長秒…]、amp 公尺 ⇒ 加在 eye／look 上的位移。 */
function trShake(hits, u, amp) {
  var o = [0, 0, 0];
  (hits || []).forEach(function (h0, i) { var d = u - h0; if (d < 0 || d > 0.4) return; var a = (amp || 0.6) * (1 - d / 0.4); o[0] += a * Math.sin(d * 83 + i); o[1] += a * Math.sin(d * 67 + 2 * i + 1); o[2] += a * Math.sin(d * 71 + 3 * i + 2); });
  return o;
}
function trAddV(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
/** 整個畫面蓋一層顏色（白閃、壓暗）。 */
function trFill(g, col, al) { if (al <= 0.003) return; g.save(); g.globalAlpha = Math.min(1, al); g.fillStyle = col; g.fillRect(0, 0, TR_CW, TR_CH); g.restore(); }
/** 深海的底（2D 卡片的背景）：上深下更深、照 u 慢慢飄的氣泡（固定軌跡）。 */
function trDeep(g, u, al) {
  if (al <= 0.003) return;
  g.save(); g.globalAlpha = al; var gr = g.createLinearGradient(0, 0, 0, TR_CH); gr.addColorStop(0, '#0b2a48'); gr.addColorStop(0.55, '#061a2e'); gr.addColorStop(1, '#030a14');
  g.fillStyle = gr; g.fillRect(0, 0, TR_CW, TR_CH);
  for (var i = 0; i < 46; i++) {
    var a = i * 2.39996, x = ((Math.sin(a * 7.1) * 0.5 + 0.5) * TR_CW + Math.sin(u * 0.7 + i) * 18), sp = 40 + (i % 7) * 12, y = TR_CH - ((u * sp + i * 97) % (TR_CH + 60)), r = 2 + (i % 5);
    g.globalAlpha = al * (0.10 + (i % 4) * 0.05); g.strokeStyle = '#9fe3ff'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  }
  g.restore();
}
