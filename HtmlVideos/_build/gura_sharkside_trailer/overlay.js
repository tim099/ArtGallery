// ── 字幕層（2D 畫布 #trCap，內部固定 1920×1080 ⇒ 每台機器的字都一樣大）、內嵌美術、播放器外殼 ──
// 移植自 kaguya 的 Blockside 宣傳片（overlay.js）；配色換成方舷放置（Sharkside src/idle.css：深海 #061220、海 #4fd1ff／#2b8bd6、金 #ffd166、珊瑚 #ff6b6b、字 #e8f4ff）。
// 字幕、片名卡、淡入淡出、美術全是 t 的純函數；控制列、載入進度、片尾按鈕是 DOM（shell.html；錄影錄不到 DOM）。
var TR_CW = 1920, TR_CH = 1080;
var TR_SANS = '"Noto Sans TC","Microsoft JhengHei","PingFang TC",system-ui,sans-serif';
var TR_SERIF = '"Noto Serif TC","Source Han Serif TC","Songti TC","PMingLiU",serif';
var TR_COL = { ink: '#e8f4ff', dim: '#8fb0c8', sea: '#4fd1ff', sea2: '#2b8bd6', gold: '#ffd166', coral: '#ff6b6b', deep: '#061220', panel: 'rgba(6,20,36,0.84)' };
var trG = null;                                                         // 字幕層的 2D context：外殼插在核心的 <script> 後面 ⇒ 閉包跑的時候還沒有它，開機（trBoot）時才接
function trEl(id) { return document.getElementById(id); }

/** 一段文字的透明度：[a, b] 之間顯示，前後各 f 秒淡入淡出。 */
function trFade(u, a, b, f) { f = f || 0.5; return Math.min(trSmooth(a, a + f, u), 1 - trSmooth(b - f, b, u)); }
function trText(g, s, x, y, font, col, al, align, track) {
  if (al <= 0.003) return;
  g.save(); g.globalAlpha = Math.min(1, al); g.font = font; g.fillStyle = col; g.textAlign = align || 'center'; g.textBaseline = 'middle';
  if (track) { try { g.letterSpacing = track + 'px'; } catch (e) {} }
  g.shadowColor = 'rgba(0,8,18,.75)'; g.shadowBlur = 18; g.fillText(s, x, y); g.restore();
}
/** 片名卡：大字＋小字（置中；y 預設 0.46H）。 */
function trTitle(g, big, small, al, y) {
  y = y || TR_CH * 0.46;
  trText(g, big, TR_CW / 2, y, '800 96px ' + TR_SANS, TR_COL.ink, al, 'center', 6);
  if (small) trText(g, small, TR_CW / 2, y + 92, '500 36px ' + TR_SANS, '#bfe6ff', al * 0.92, 'center', 4);
}
/** 一句話（置中、下方三分之一；y 預設 0.80H）。 */
function trLine(g, s, al, y) { trText(g, s, TR_CW / 2, y || TR_CH * 0.80, '700 48px ' + TR_SANS, TR_COL.ink, al, 'center', 3); }
/** 船名下三分之一：o ＝ { year, name, line, by, col }（by ＝ 右下的署名）。 */
function trLower(g, o, al) {
  if (al <= 0.003) return;
  var x = 120, y = TR_CH - 210, w = 8;
  g.save(); g.globalAlpha = al * 0.9; g.fillStyle = o.col || TR_COL.sea; g.fillRect(x - 28, y - 44, w, 150); g.restore();
  if (o.year) trText(g, o.year, x, y - 14, '500 30px ' + TR_SANS, '#8fd8ff', al, 'left', 6);
  trText(g, o.name, x, y + 34, '800 58px ' + TR_SANS, '#ffffff', al, 'left', 4);
  if (o.line) trText(g, o.line, x, y + 86, '400 30px ' + TR_SANS, '#d6ecff', al * 0.95, 'left', 2);
  if (o.by) trText(g, o.by, TR_CW - 120, TR_CH - 92, '400 24px ' + TR_SANS, '#9dbbd0', al * 0.85, 'right', 2);
}
/** 特色小標（左上；例：「點哪裡，咬哪裡」）。 */
function trTag(g, s, sub, al) {
  if (al <= 0.003) return;
  trText(g, s, 120, 132, '800 46px ' + TR_SANS, TR_COL.gold, al, 'left', 6);
  if (sub) trText(g, sub, 120, 186, '400 28px ' + TR_SANS, '#d6ecff', al * 0.9, 'left', 2);
}
/** 幾行字疊在船名上方，一行接一行淡入（u0 起、每行晚 gap 秒）。 */
function trStory(g, lines, u, u0, u1, gap) {
  var y0 = TR_CH - 268 - (lines.length - 1) * 50;
  lines.forEach(function (s, i) { trText(g, s, 120, y0 + i * 50, '500 34px ' + TR_SANS, TR_COL.ink, trFade(u, u0 + i * (gap || 0.45), u1, 0.6), 'left', 2); });
}
/** 名詞卡（右上）：o ＝ { zh, en, def:[行…], head }。 */
function trTerm(g, o, al) {
  if (al <= 0.003) return;
  var w = 600, x = TR_CW - 120 - w, y = TR_CH * 0.075 + 40, h = 96 + o.def.length * 40;
  g.save(); g.globalAlpha = al * 0.85; g.fillStyle = TR_COL.panel; g.fillRect(x, y, w, h);
  g.globalAlpha = al; g.strokeStyle = 'rgba(79,209,255,0.75)'; g.lineWidth = 2; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  g.fillStyle = TR_COL.sea; g.fillRect(x, y, 6, h); g.restore();
  trText(g, o.head || '小辭典', x + 28, y + 26, '500 20px ' + TR_SANS, '#8fd8ff', al, 'left', 4);
  trText(g, o.zh, x + 28, y + 64, '800 40px ' + TR_SANS, '#ffffff', al, 'left', 3);
  g.save(); g.font = '800 40px ' + TR_SANS; var zw = g.measureText(o.zh).width + 6 * o.zh.length; g.restore();
  if (o.en) trText(g, o.en, x + 40 + zw, y + 68, 'italic 400 26px ' + TR_SANS, '#bfe6ff', al, 'left', 1);
  o.def.forEach(function (s, i) { trText(g, s, x + 28, y + 112 + i * 40, '400 27px ' + TR_SANS, '#d6ecff', al, 'left', 1); });
}
/** 船的資料卡（右下）：核心自己量的船卡（SHIP_CARDS[船型]：排水量、水線長、砲、船員、動力）。 */
function trSpec(g, id, al) {
  var c = SHIP_CARDS[id]; if (!c || al <= 0.003) return;
  var w = 470, x = TR_CW - 120 - w, y = TR_CH - 120 - 290;
  g.save(); g.globalAlpha = al * 0.85; g.fillStyle = TR_COL.panel; g.fillRect(x, y, w, 290);
  g.globalAlpha = al; g.strokeStyle = 'rgba(79,209,255,0.6)'; g.lineWidth = 2; g.strokeRect(x + 0.5, y + 0.5, w - 1, 289); g.restore();
  var dv = { sail: '帆', steam: '蒸汽', oar: '槳', magic: '魔法' }[c.drive] || c.drive;
  var rows = [['排水量', c.tons.toLocaleString() + ' 噸'], ['水線長', c.len + ' 公尺'], ['砲', c.guns + ' 門'], ['船員', c.crew + ' 人'], ['動力', dv + (c.sails ? ' · 帆 ' + c.sails + ' 面' : '')]];
  trText(g, '遊戲數值', x + 26, y + 30, '500 19px ' + TR_SANS, '#8fd8ff', al, 'left', 4);
  rows.forEach(function (r, i) { trText(g, r[0], x + 26, y + 92 + i * 40, '400 25px ' + TR_SANS, '#a9c8dc', al, 'left', 2); trText(g, r[1], x + w - 26, y + 92 + i * 40, '700 28px ' + TR_SANS, '#ffffff', al, 'right', 1); });
}
/** 右下一行小字（代演、導演動手之類的說明；⚠ 跟 trLower 的 by 同一個角落，同一幕別兩個一起出）。 */
function trNote(g, s, al) { trText(g, s, TR_CW - 120, TR_CH * 0.925 - 26, '400 22px ' + TR_SANS, '#9dbbd0', al * 0.85, 'right', 1); }
/** 世界座標 ⇒ 字幕層的像素（導演的鏡頭 CAM.vp；在畫面之外或背後 ⇒ null）。 */
function trProject(p) {
  var m = CAM.vp; if (!m) return null;
  var x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  if (w <= 0.1) return null;
  return [(x / w + 1) / 2 * TR_CW, (1 - y / w) / 2 * TR_CH];
}
/** 指示線（sc.marks：[{ at(S) ⇒ 世界座標, zh, en, a, b, dx, dy | lx, ly }]；trDraw 在畫的那一刻投影好）。 */
function trMarks(g, u) {
  (TR.marks || []).forEach(function (mk) {
    var al = trFade(u, mk.a, mk.b, 0.5); if (al <= 0.003 || !mk.s) return;
    var p = mk.s, lx = mk.lx !== undefined ? mk.lx : p[0] + (mk.dx || 160), ly = mk.ly !== undefined ? mk.ly : p[1] + (mk.dy || -140);
    g.save(); g.globalAlpha = al; g.strokeStyle = 'rgba(232,244,255,0.92)'; g.lineWidth = 2;
    g.beginPath(); g.arc(p[0], p[1], 7, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(lx, ly); g.lineTo(lx + (lx >= p[0] ? 28 : -28), ly); g.stroke(); g.restore();
    trText(g, mk.zh, lx + (lx >= p[0] ? 38 : -38), ly - 4, '700 32px ' + TR_SANS, '#ffffff', al, lx >= p[0] ? 'left' : 'right', 2);
    if (mk.en) trText(g, mk.en, lx + (lx >= p[0] ? 38 : -38), ly + 30, 'italic 400 22px ' + TR_SANS, '#bfe6ff', al, lx >= p[0] ? 'left' : 'right', 1);
  });
}

// ── 內嵌美術（splice.py 照 art.json 寫進 TR_IMG_SRC：鍵 ⇒ data URI）──
//   trImg(鍵)：第一次叫才建 Image（解碼要一點時間）；解好了才回 Image、還沒 ⇒ null（這一格先不畫）。解好的那一刻 TR.dirty ⇒ ?t= 停著的那一格重畫；
//   還有沒解好的（TR.imgPend）⇒ 不發 READY（截圖等它）。
var TR_IMGS = {};
function trImg(key) {
  var im = TR_IMGS[key];
  if (!im) {
    var src = TR_IMG_SRC[key];
    if (!src) { if (!(TR.imgMiss = TR.imgMiss || {})[key]) { TR.imgMiss[key] = 1; console.warn('宣傳片：沒有內嵌這張美術 ' + key + '（加進 art.json 再建一次）'); } return null; }
    im = TR_IMGS[key] = new Image(); TR.imgPend++;
    im.onload = function () { TR.imgPend--; TR.dirty = true; };
    im.onerror = function () { TR.imgPend--; console.error('宣傳片：美術解不開 ' + key); };
    im.src = src;
  }
  return im.complete && im.naturalWidth > 0 ? im : null;
}
/** 先把幾張解起來（例：下一幕要用的大圖；不然第一次出場那一格是空的）。 */
function trImgPreload(keys) { (keys || Object.keys(TR_IMG_SRC)).forEach(function (k) { trImg(k); }); }
/** 畫一張美術到 (x, y, w, h)：fit 'cover'（填滿、裁邊；預設）／'contain'（整張放進去、置中）／'fill'（拉伸）；ax、ay ＝ 裁切或置中的錨點（0–1，預設 0.5）。回有沒有畫。 */
function trPic(g, key, x, y, w, h, al, fit, ax, ay) {
  if (al !== undefined && al <= 0.003) return false;
  var im = trImg(key); if (!im) return false;
  var iw = im.naturalWidth, ih = im.naturalHeight; ax = ax === undefined ? 0.5 : ax; ay = ay === undefined ? 0.5 : ay;
  g.save(); g.globalAlpha = al === undefined ? 1 : Math.min(1, al);
  if (fit === 'fill') g.drawImage(im, x, y, w, h);
  else if (fit === 'contain') { var k = Math.min(w / iw, h / ih), dw = iw * k, dh = ih * k; g.drawImage(im, x + (w - dw) * ax, y + (h - dh) * ay, dw, dh); }
  else { var c = Math.max(w / iw, h / ih), sw = w / c, sh = h / c; g.drawImage(im, (iw - sw) * ax, (ih - sh) * ay, sw, sh, x, y, w, h); }
  g.restore();
  return true;
}

// ── 整格的效果 ──
function trBlack(g, al) { if (al <= 0.003) return; g.save(); g.globalAlpha = Math.min(1, al); g.fillStyle = '#000'; g.fillRect(0, 0, TR_CW, TR_CH); g.restore(); }
function trVignette(g, k) {
  if (!(k > 0)) return;
  var r = g.createRadialGradient(TR_CW / 2, TR_CH / 2, TR_CH * 0.35, TR_CW / 2, TR_CH / 2, TR_CH * 0.95);
  r.addColorStop(0, 'rgba(2,8,16,0)'); r.addColorStop(1, 'rgba(2,8,16,' + k + ')'); g.fillStyle = r; g.fillRect(0, 0, TR_CW, TR_CH);
}
/** 固定種子的雜訊（膠片顆粒）：照 t 的第幾格（24 fps）選一組 —— 同一個 t 同一組。 */
var TR_GRAIN = null;
function trGrain(g, t, k) {
  if (!(k > 0)) return;
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
/** 每一格的字幕層：暗角 → 上下黑邊（sc.bars，預設 0.075）→ 指示線 → sc.cap → 顆粒（sc.grain，預設 0.05）→ 黑場（fadeIn／fadeOut／black(u)）→ sc.over（壓在黑場上面）。 */
function trOverlay(t, A) {
  if (!trG) return;
  var g = trG, sc = A.sc, u = A.u;
  g.clearRect(0, 0, TR_CW, TR_CH);
  trVignette(g, sc.vig !== undefined ? sc.vig : 0.45);
  var bars = sc.bars !== undefined ? sc.bars : 0.075;
  if (bars > 0) { g.fillStyle = '#000'; g.fillRect(0, 0, TR_CW, TR_CH * bars); g.fillRect(0, TR_CH * (1 - bars), TR_CW, TR_CH * bars); }
  trMarks(g, u);
  if (sc.cap) { try { sc.cap(g, u, A.tau, SHIPS, sc); } catch (e) { if (!TR.capErr) { TR.capErr = 1; console.error('字幕（' + (sc.id || sc.i) + '）：', e); } } }   // 一幕的字幕壞了 ⇒ 那一幕少字，片子照播
  trGrain(g, t, sc.grain !== undefined ? sc.grain : 0.05);
  var fi = sc.fadeIn !== undefined ? sc.fadeIn : 0.25, fo = sc.fadeOut !== undefined ? sc.fadeOut : 0.25;
  var b = 0;
  if (fi > 0) b = Math.max(b, 1 - trSmooth(0, fi, u));
  if (fo > 0) b = Math.max(b, trSmooth(sc.dur - fo, sc.dur, u));
  if (sc.black) b = Math.max(b, sc.black(u));
  trBlack(g, b);
  if (sc.over) { try { sc.over(g, u); } catch (e) { if (!TR.capErr) { TR.capErr = 1; console.error('字卡（' + (sc.id || sc.i) + '）：', e); } } }
}

// ── 播放器 ──
function trFmt(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
function trUI() {
  var load = trEl('trLoad'), cover = trEl('trCover'), end = trEl('trEnd'), buf = trEl('trBuf');
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
  cover.style.display = !TR.started && !TR.still ? 'flex' : 'none';
  buf.style.display = TR.buffering && (TR.playing || TR.waitLoad) ? 'block' : 'none'; buf.textContent = TR.waitLoad ? '載入船隻 ' + TR.loadN + '／' + TR.loadAll + '…' : '準備中…';
  trEl('trTime').textContent = trFmt(TR.t) + ' / ' + trFmt(TR.DUR);
  trEl('trPlay').textContent = TR.playing ? '⏸' : TR.t >= TR.DUR ? '⟲' : '▶';
  end.style.display = TR.t >= TR.DUR - (TR.endShow || 6) && !TR.still ? 'flex' : 'none';
  trEl('trReplay').style.display = TR.t >= TR.DUR && !TR.playing ? '' : 'none';   // 重播：播完才出現
}
function trPlay() {
  if (!TR.ready || TR.err) return;
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
  var lg = trEl('trLogo'); if (lg) { if (TR_IMG_SRC['app/logo']) lg.src = TR_IMG_SRC['app/logo']; else lg.style.display = 'none'; }
  trEl('trCover').addEventListener('click', trPlay);
  trEl('trPlay').addEventListener('click', function () { TR.playing ? trPause() : trPlay(); });
  trEl('trReplay').addEventListener('click', trPlay);
  trEl('trMute').addEventListener('click', function () { TR.muted = !TR.muted; trEl('trMute').textContent = TR.muted ? '🔇' : '🔊'; trAudioMute(); });
  // 片尾：立即遊玩（線上的方舷放置，新分頁）—— 在畫廊的彈窗（sandbox iframe）裡開不了新頁 ⇒ 改成提示
  var lk = trEl('trTry'); lk.href = TR_LATEST; lk.target = '_blank'; lk.rel = 'noopener';
  lk.addEventListener('click', function (e) { if (TR.framed) { e.preventDefault(); trHint('請按畫廊下方的「🎬 新分頁全螢幕播放」，或直接開 ' + TR_LATEST); } });
  trEl('trURL').textContent = TR_LATEST.replace(/^https:\/\//, '').replace(/\/$/, '');
  // 鍵盤：一律先攔下來（核心的按鍵會開砲、轉舵 ⇒ 改到戰局），只處理播放器的
  window.addEventListener('keydown', function (e) {
    if (!TRAILER) return;
    e.stopImmediatePropagation();
    if (e.code === 'Space') { e.preventDefault(); TR.playing ? trPause() : trPlay(); }
    else if (e.key === 'm' || e.key === 'M') trEl('trMute').click();
  }, true);
  window.addEventListener('keyup', function (e) { if (TRAILER) e.stopImmediatePropagation(); }, true);
}
function trHint(s) { var h = trEl('trHint'); h.textContent = s; h.style.opacity = 1; clearTimeout(trHint.tm); trHint.tm = setTimeout(function () { h.style.opacity = 0; }, 4200); }
