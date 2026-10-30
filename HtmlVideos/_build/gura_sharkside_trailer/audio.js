// ── 聲音（移植自 kaguya 的 Blockside 宣傳片 audio.js）：配樂照時間軸即時排程（跟核心的 bgmSched 同一種做法）：播放時往前排 TR_LOOK_S 秒內的音；
//   暫停、換幕跳時間、重播 ⇒ 整條播放匯流排丟掉、從新的 t 重排。
//   ⛔ 不整段離線算（kaguya 2026-10-19 量：OfflineAudioContext 用過的節點在算完前不回收 ⇒ 成本 ∝ 音數 × 長度；即時的 AudioContext 會回收 ⇒ 線性）。
// 樂器與曲子用核心自己的（02_music.js 的 INSTR、TUNES、THEMES：tuneEvents ＋ bgmNote）；鼓、上揚、鐘是這裡合成的。
// 模擬裡的砲聲、碎裂聲照核心的 sfxPlay（只在播放中、這一格走的那幾步發；director.js 那一行 evOn('sfx')）。
// 配樂表 TR_SCORE（scenes.js）：{ at, tune, from, to, loops, fin, fout, gain, inst?: {聲部: 樂器}, tr?: 半音 } ／ { at, pad:[midi…], len, v, inst } ／ { at, hit:1, v, f0, f1, len } ／ { at, rise: 秒, v } ／ { at, bell: Hz, v }。
var TR_AU = { ev: null, p: null, bus: null };   // ev：整支片的音與一次性的聲音（照時間排好）；p：這一次播放（匯流排、對時、排到第幾個）
var TR_LOOK_S = 1.5;
var TR_MASTER = 1.0, TR_MUS_GAIN = 2.4;          // 核心的總音量 0.8、配樂那條 0.25 ⇒ 宣傳片總音量 1.0、配樂 ×2.4；master 後面有核心的限制器（−14 dB、比 20）
/** 使用者手勢裡叫（trPlay）：建 AudioContext（核心的 initAudio）；配樂匯流排缺了就建（⛔ 只在 !AC 時建 ⇒ 別人先建了 AC，配樂匯流排就一直是 null）。 */
function trAudioInit() {
  if (!AC) initAudio();
  if (!AC) return;
  if (!TR_AU.bus) {
    SND.sfx = 1; SND.amb = 0.7; SND.mode = 'off'; sndApply();          // 核心自己的背景音樂不放（配樂是這裡排的）
    TR_AU.bus = AC.createGain(); TR_AU.bus.gain.value = TR_MUS_GAIN; TR_AU.bus.connect(master);
    trAudioMute();
  }
  if (AC.state === 'suspended') AC.resume();
}
function trAudioMute() { if (master && AC) master.gain.setTargetAtTime(TR.muted ? 0 : TR_MASTER, AC.currentTime, 0.02); }
function trMusicKill() { var P = TR_AU.p; TR_AU.p = null; if (P) { try { P.pb.gain.setTargetAtTime(0, AC.currentTime, 0.01); } catch (e) { } setTimeout(function () { P.pb.disconnect(); }, 80); } }
function trMusicStop() { trMusicKill(); if (AC && AC.state === 'running') AC.suspend(); }
/** 從片長 t 開始放：新的播放匯流排（共用一個殘響）、對時 a0（沒給 ＝ AC.currentTime ＋ 0.05）↔ t；還在響的長音照剩下的長度補上。 */
function trMusicAt(t, a0) {
  if (!AC || !TR_AU.bus) return;
  trMusicKill();
  if (AC.state === 'suspended') AC.resume();
  if (!TR_AU.ev) return;
  var pb = AC.createGain(); pb.connect(TR_AU.bus);
  bgmOut(AC, pb, 'organ');                                               // 建 pb.__rev（一個卷積器 → pb）：每一段的樂器出口都送進這一個
  var P = TR_AU.p = { pb: pb, rev: pb.__rev.cv, hit: trRev(AC, pb, 3.2, 0.45), nb: trNoiseBuf(AC, 4), t0: t, a0: a0 !== undefined ? a0 : AC.currentTime + 0.05, g: {}, k: 0 };
  var E = TR_AU.ev, i;
  for (i = 0; i < E.length && E[i].at < t; i++) {
    var e = E[i]; if (e.n && e.at + e.d > t + 0.05) trMusicNote(P, e, t, e.at + e.d - t);
  }
  P.k = i;
  trMusicPump(t);
}
function trMusicA(P, tau) { return P.a0 + (tau - P.t0); }
/** 一段（曲子或墊底）的音量包絡：用到才建（片長的分段折線 ⇒ 換算成 AC 時間）。 */
function trMusicSeg(P, c) {
  if (P.g[c.i]) return P.g[c.i];
  var g = AC.createGain(); g.__rev = { cv: P.rev, ins: {} }; g.connect(P.pb);
  var a = c.at, B = [[a, 0], [a + c.fin, c.gv], [a + c.len - c.fout, c.gv], [a + c.len, 0]];
  function env(x) { for (var j = 1; j < B.length; j++) if (x <= B[j][0]) { var u = (x - B[j - 1][0]) / Math.max(1e-6, B[j][0] - B[j - 1][0]); return B[j - 1][1] + (B[j][1] - B[j - 1][1]) * Math.max(0, Math.min(1, u)); } return 0; }
  var x0 = Math.max(P.t0, a);
  g.gain.setValueAtTime(Math.max(1e-4, env(x0)), trMusicA(P, x0));
  B.forEach(function (b) { if (b[0] > x0) g.gain.linearRampToValueAtTime(Math.max(1e-4, b[1]), trMusicA(P, b[0])); });
  return (P.g[c.i] = g);
}
function trMusicNote(P, e, at, d) { bgmNote(AC, trMusicSeg(P, e.c), e.inst, e.f, Math.max(AC.currentTime + 0.005, trMusicA(P, at)), Math.max(0.05, d), e.vel); }
/** 每一格（播放中）：把片長 t 之後 TR_LOOK_S 秒內的音排進去；已經過了的（卡住、背景）不補。 */
function trMusicPump(t) {
  var P = TR_AU.p; if (!P || !AC) return;
  var E = TR_AU.ev, lim = t + TR_LOOK_S, now = AC.currentTime;
  while (P.k < E.length && E[P.k].at < lim) {
    var e = E[P.k++], A = trMusicA(P, e.at);
    if (A < now - 0.02) continue;
    if (e.n) trMusicNote(P, e, e.at, e.d);
    else if (e.c.hit) trDrum(AC, P.hit, P.nb, A, e.c.v || 1, e.c.f0, e.c.f1, e.c.len);
    else if (e.c.rise) trRise(AC, P.pb, P.nb, A, e.c.rise, e.c.v || 1);
    else if (e.c.bell) trBell(AC, P.hit, A, e.c.bell, e.c.v || 1);
  }
}
/** 每一格（播放中）：配樂往前排；環境音照鏡頭與天氣（核心的 ambFrame）；雷聲照閃電的雜湊。 */
function trAudioTick(t0, t1) {
  trMusicPump(t1);
  if (!AC || TR.muted) return;
  ambFrame();
  trThunder(t0, t1);
}
/** 雷聲：片長 t0 → t1 之間照閃電的雜湊該響的那幾聲（同核心 08_weather.js wxBolt：同一個模擬時間同一道）。 */
function trThunder(t0, t1) {
  if (!WX.bolt) return;
  var A0 = trAt(t0), A1 = trAt(t1);
  if (A0.i !== A1.i) return;
  var s0 = A0.tau, s1 = A1.tau;
  for (var n = Math.floor((s0 - 7.1) * 10); n <= Math.floor(s1 * 10); n++) {
    var h = Math.sin(n * 91.7 + 13.1) * 43758.5453; h -= Math.floor(h); if (h >= 0.014) continue;
    var d = 600 + 1800 * ((h * 31337) - Math.floor(h * 31337)), tt = n / 10 + d / 340;
    if (tt > s0 && tt <= s1) trSfx('thunder', null, 1 / (1 + d / 1500));
  }
}
// ── 合成：鼓（低頻下滑＋一點噪音）、上揚（帶通掃頻的噪音）、鐘（不和諧泛音）──
function trNoiseBuf(oc, sec) {
  var n = Math.round(oc.sampleRate * sec), b = oc.createBuffer(1, n, oc.sampleRate), d = b.getChannelData(0), s = 4242;
  for (var i = 0; i < n; i++) { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; d[i] = s / 0x3fffffff - 1; }
  return b;
}
function trRev(oc, dest, sec, wet) {
  var sr = oc.sampleRate, n = Math.round(sr * sec), b = oc.createBuffer(2, n, sr), s = 777;
  for (var c = 0; c < 2; c++) { var x = b.getChannelData(c); for (var i = 0; i < n; i++) { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; x[i] = (s / 0x40000000 - 1) * Math.exp(-i / sr / (sec / 6.9)); } }
  var cv = oc.createConvolver(); cv.normalize = true; cv.buffer = b;
  var dry = oc.createGain(), w = oc.createGain(); w.gain.value = wet; dry.connect(dest); dry.connect(w); w.connect(cv); cv.connect(dest);
  return dry;
}
function trDrum(oc, dest, nb, t, v, f0, f1, len) {
  var o = oc.createOscillator(), g = oc.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(f0 || 72, t); o.frequency.exponentialRampToValueAtTime(f1 || 36, t + (len || 1) * 0.8);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.95 * v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + (len || 1.4));
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + (len || 1.4) + 0.05);
  var ns = oc.createBufferSource(), lp = oc.createBiquadFilter(), ng = oc.createGain(); ns.buffer = nb; lp.type = 'lowpass'; lp.frequency.value = 900;
  ng.gain.setValueAtTime(0.5 * v, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  ns.connect(lp); lp.connect(ng); ng.connect(dest); ns.start(t, 0.3); ns.stop(t + 0.3);
}
function trRise(oc, dest, nb, t, len, v) {
  var ns = oc.createBufferSource(), bp = oc.createBiquadFilter(), g = oc.createGain(); ns.buffer = nb; ns.loop = true;
  bp.type = 'bandpass'; bp.Q.value = 2.5; bp.frequency.setValueAtTime(250, t); bp.frequency.exponentialRampToValueAtTime(4200, t + len);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35 * v, t + len * 0.95); g.gain.linearRampToValueAtTime(0.0001, t + len + 0.03);
  ns.connect(bp); bp.connect(g); g.connect(dest); ns.start(t); ns.stop(t + len + 0.05);
}
function trBell(oc, dest, t, f, v) {
  [[1, 1, 5], [2.0, 0.5, 3.5], [2.76, 0.4, 2.6], [5.4, 0.22, 1.4], [0.5, 0.35, 6]].forEach(function (p) {
    var o = oc.createOscillator(), g = oc.createGain(); o.type = 'sine'; o.frequency.value = f * p[0];
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16 * v * p[1], t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + p[2]);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + p[2] + 0.05);
  });
}
/** 配樂表（scenes.js 的 TR_SCORE）⇒ 整支片的音（片長秒、樂器、Hz、長、力度）照時間排好；曲子找不到 ⇒ 那一段跳過（印一行）。trReady 叫一次。 */
function trMusicPrep() {
  if (TR_AU.ev || !TR_SCORE) return;
  var E = [];
  TR_SCORE.forEach(function (c, i) {
    c.i = i;
    if (c.tune) {
      var tn = tuneById(c.tune); if (!tn) { console.warn('宣傳片配樂：核心裡沒有曲子 ' + c.tune + '（那一段沒聲音）'); return; }
      var T = tuneEvents(tn), spb = 60 / tn.Q, from = c.from || 0, to = c.to || T.len * spb;
      c.len = to - from; c.fin = c.fin || 0.05; c.fout = c.fout || 0.5; c.gv = c.gain || 1;
      for (var pass = 0; pass < (c.loops || 1); pass++) T.ev.forEach(function (e) {
        var s = e[0] * spb + pass * T.len * spb; if (s < from || s >= to) return;
        E.push({ at: c.at + s - from, n: 1, c: c, inst: c.inst && c.inst[e[3]] || e[4], f: 440 * Math.pow(2, (e[2] + (c.tr || 0) - 69) / 12), d: Math.max(0.05, e[1] * spb - 0.02), vel: e[5] * (tn.vol || 1) });
      });
    } else if (c.pad) {
      c.fin = c.fin || 2; c.fout = c.fout || 2; c.gv = c.v || 0.6;
      c.pad.forEach(function (m) { E.push({ at: c.at, n: 1, c: c, inst: c.inst || 'organ', f: 440 * Math.pow(2, (m - 69) / 12), d: c.len, vel: 1 }); });
    } else E.push({ at: c.at, c: c });
  });
  E.sort(function (a, b) { return a.at - b.at; });
  TR_AU.ev = E;
}
/** 一首曲子從片長 a 放到 b（頭尾各交疊 x 秒；遍數照長度算）⇒ 一筆 TR_SCORE。o ＝ { from, x, fin, fout, gain, inst, tr }。 */
function trSeg(tune, a, b, o) {
  o = o || {}; var tn = tuneById(tune), pl = tn ? tuneEvents(tn).len * 60 / tn.Q : 30, from = o.from || 0, x = o.x === undefined ? 0.4 : o.x, at = a - x, L = b - a + 2 * x;
  return { at: at, tune: tune, from: from, to: from + L, loops: Math.ceil((from + L) / pl) + 1, fin: o.fin || 0.8, fout: o.fout || 0.8, gain: o.gain || 1, inst: o.inst, tr: o.tr };
}
