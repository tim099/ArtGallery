// ───────────────────────── 錄影模式（kaguya，2026-10-19；Tim：「我打算錄製影片上傳到YT 是否可以寫工具確保錄製不掉fps的影片」）─────────────────────────
// ⛔ 這一支不進發佈的成品：record.py 錄影當下才把它注入一份複製（成品的零外部依賴照舊；這裡的 fetch 只打本機的 record.py，同源 /rec/…）。
// 片子是片長 t 的純函數 ⇒ 不即時播放、不用螢幕錄影：
//   畫面：一格一格算到 t ＝ from ＋ k／fps、畫好、把 3D 畫布與字幕層疊成一張 1920×1080，給 WebCodecs 編 VP9 ⇒ 不管一格算多久，成品都是準確的 fps、一格不掉。
//   聲音：畫面那一遍不出聲，只記事件（模擬裡的音效＋雷聲：片長秒、種類、音量、離鏡頭多遠；環境音：每一格的風、海況、鏡頭高度、雨、聲像）；
//         畫完再用真的 AudioContext 照時間軸 1 倍速重播（配樂照 TR_SCORE、音效與環境音照事件表；不跑模擬 ⇒ 不會頓），
//         在限制器後面用 AudioWorklet 逐樣本錄下來，裁成跟畫面同一段 ⇒ WebCodecs 編 Opus。
//   編好的片段一段段 POST 回 record.py，由它寫成 WebM（VP9 ＋ Opus；YouTube 收）。
// 網址參數：rec=1、fps（預設 60）、from／to（片長秒，預設整支）、vbr（影像位元率，預設 24 Mbps）、abr（聲音，預設 256 kbps）、res=1080（3D 畫布 1920×1080）。
var TR_REC = TRAILER && Q.get('rec') === '1' ? {
  fps: +(Q.get('fps') || 60), from: +(Q.get('from') || 0), to: Q.has('to') ? +Q.get('to') : null,
  vbr: +(Q.get('vbr') || 24e6), abr: +(Q.get('abr') || 256000), sfx: [], amb: [], cap: false, t: 0, seq: { v: 0, a: 0 }, inflight: [], err: null
} : null;

if (TR_REC) {
  // 主迴圈（遊戲的 rAF 每格叫 trFrame）：錄影時不播放；船全部載好才開始（⛔ 不靠 rAF：窗格藏著時 rAF 不跑 ⇒ 另外輪詢）
  trFrame = function () { if (!TR_REC.on) trUI(); };
  (function trRecWait() { if (TR.err) { trRecPost('err', '載入失敗：' + TR.err); return; } if (TR.ready && TR.loadDone) { TR_REC.on = true; trRecRun().catch(function (e) { trRecPost('err', String(e && e.stack || e)); }); } else setTimeout(trRecWait, 200); })();
  // 音效：錄影的時候只記、不放（evOn('sfx') 那一行與 trThunder 都照名字叫 sfxPlay ⇒ 換掉這個名字就接得到）
  var trRecSfx0 = sfxPlay;
  sfxPlay = function (k, at, v) {
    if (TR_REC.cap) { TR_REC.sfx.push([TR_REC.t, k, v === undefined ? 1 : v, at && CAM.eye ? len(sub(at, CAM.eye)) : 0]); return; }
    return trRecSfx0(k, at, v);
  };
}

function trRecPost(kind, body, q) {
  var url = '/rec/' + kind + (q ? '?' + Object.keys(q).map(function (k) { return k + '=' + encodeURIComponent(q[k]); }).join('&') : '');
  var data = typeof body === 'string' ? body : body instanceof Uint8Array ? body : JSON.stringify(body);
  //   連線一時被打回來（Failed to fetch）⇒ 退避重送最多 6 次（record.py 照片段序號去重 ⇒ 回應掉了、其實收到了也不會重複寫）
  //   ⛔ 一次失敗就整支作廢：2026-10-28 第一次錄整支斷在城建好之後的半路
  function send(k) {
    return fetch(url, { method: 'POST', body: data })
      .then(function (r) { if (!r.ok) throw new Error('record.py 回 ' + r.status + '（' + url + '）'); })
      .catch(function (e) { if (k >= 6 || !(e instanceof TypeError)) throw e; TR_REC.retry = (TR_REC.retry || 0) + 1; return trRecSleep(200 * Math.pow(2, k)).then(function () { return send(k + 1); }); });
  }
  var p = send(0).catch(function (e) { TR_REC.err = TR_REC.err || String(e); });
  TR_REC.inflight.push(p);
  return p;
}
/** 讓出主執行緒一下（編碼器的輸出、POST 才跑得動）；⛔ setTimeout 在背景會被節流 ⇒ MessageChannel。 */
function trRecYield() { return new Promise(function (r) { var mc = new MessageChannel(); mc.port1.onmessage = function () { r(); }; mc.port2.postMessage(0); }); }
function trRecSleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
/** 送出去還沒回的太多 ⇒ 等（記憶體不會一直漲）。 */
async function trRecDrain(max) {
  while (TR_REC.inflight.length > max) { await TR_REC.inflight.shift(); }
}
function trRecLog(s) { trRecPost('log', s); }

/** 片尾字卡（播放器的片尾按鈕是網頁元素、錄不進去 ⇒ 錄影時畫在字幕層上）。 */
function trRecEndCard(g, t) {
  var al = trSmooth(TR.DUR - (TR.endShow || 6), TR.DUR - (TR.endShow || 6) + 0.8, t);
  if (al <= 0.003) return;
  var w = 640, h = 112, x = (TR_CW - w) / 2, y = TR_CH * 0.84 - h;
  g.save(); g.globalAlpha = al;
  g.fillStyle = 'rgba(12,10,6,0.72)'; g.strokeStyle = '#c9a45c'; g.lineWidth = 2;
  g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, 16); else g.rect(x, y, w, h); g.fill(); g.stroke();
  g.restore();
  trText(g, '🌐 在瀏覽器裡直接玩', TR_CW / 2, y + 40, '500 34px ' + TR_SANS, '#f6eedb', al, 'center', 4);
  trText(g, TR_LATEST.replace(/^https:\/\//, '').replace(/\/$/, ''), TR_CW / 2, y + 82, '400 28px ' + TR_SANS, '#d8ccb0', al, 'center', 2);
}

async function trRecRun() {
  var R = TR_REC, fps = R.fps, t0 = Math.max(0, R.from), t1 = R.to === null ? TR.DUR : Math.min(R.to, TR.DUR), n = Math.round((t1 - t0) * fps);
  ['trCover', 'trBar', 'trBuf', 'trEnd', 'trLoad', 'trHint'].forEach(function (id) { var e = trEl(id); if (e) e.style.display = 'none'; });
  var bar = trEl('trBar'); if (bar && bar.parentNode) bar.parentNode.style.cursor = 'default';
  TR.started = true; TR.playing = false; TR.still = false;
  var W = TR_CW, H = TR_CH, comp = document.createElement('canvas'); comp.width = W; comp.height = H;
  var cg = comp.getContext('2d', { alpha: false });
  // 影像編碼器：VP9（WebM 收；有硬體就用硬體）
  var cfg = null, tries = ['vp09.00.41.08', 'vp09.00.40.08', 'vp09.00.51.08'];
  for (var i = 0; i < tries.length && !cfg; i++) {
    var c = { codec: tries[i], width: W, height: H, bitrate: R.vbr, framerate: fps, bitrateMode: 'variable', latencyMode: 'quality' };
    var s = await VideoEncoder.isConfigSupported(c).catch(function () { return { supported: false }; });
    if (s.supported) cfg = c;
  }
  if (!cfg) throw new Error('這個瀏覽器的 WebCodecs 不支援 VP9 編碼');
  var vk = 0;
  var enc = new VideoEncoder({
    output: function (chunk) { var b = new Uint8Array(chunk.byteLength); chunk.copyTo(b); trRecPost('v', b, { seq: R.seq.v++, ts: chunk.timestamp, key: chunk.type === 'key' ? 1 : 0 }); },
    error: function (e) { R.err = R.err || '影像編碼：' + e; }
  });
  enc.configure(cfg);
  await trRecPost('begin', { fps: fps, w: W, h: H, t0: t0, t1: t1, frames: n, vcodec: cfg.codec, vbr: R.vbr, res: TR_W + 'x' + TR_H, dur: TR.DUR });
  trRecLog('畫面：' + n + ' 格（片長 ' + t0.toFixed(2) + ' → ' + t1.toFixed(2) + ' 秒，' + fps + ' fps，' + cfg.codec + '，3D ' + TR_W + '×' + TR_H + '）');
  var tStart = performance.now(), prevT = t0;
  for (var k = 0; k < n; k++) {
    if (R.err) throw new Error(R.err);
    var t = t0 + k / fps, A = trAt(t);
    var cut = TR.cur !== A.i || A.n < TR.k;
    // 城（TASK-0750 旱地行舟）：換進有城的那一幕 ⇒ 跟播放同一條（director.js trFrame）：先開這一幕（第 0 步）、照遊戲那一套往前建到城建完，才預跑、開錄
    //   ⛔ 不等 ⇒ 錄影不經過 trFrame、沒人推城 ⇒ 錄到城一塊塊冒出來、樹與地形缺塊（2026-10-28 讀程式看到的）
    if (cut && trTownScene(A.sc)) {
      trStepTo(A.i, 0, 0);
      var tw = performance.now(), nw = 0;
      while (!trTownSettled()) { trTownPump(); trDraw(trAt(A.sc.t0)); nw++; await trRecYield(); if (R.err) throw new Error(R.err); }
      trRecLog('城建好了：' + nw + ' 格、' + ((performance.now() - tw) / 1000).toFixed(1) + ' 秒');
    }
    // 換幕：重開＋預跑不出聲（跟播放同一條：director.js trFrame）
    if (cut) { R.cap = false; TR.live = false; trStepTo(A.i, Math.min(A.n, A.sc.warp ? trPreSteps(A.sc) : Math.floor(A.sc.pre / DT + 1e-6)), 0); }
    R.t = t; R.cap = true; TR.live = true;
    trStepTo(A.i, A.n, 0);
    if (!cut) trThunder(prevT, t);
    TR.live = false; R.cap = false;
    var lead = A.u < A.sc.lead;
    if (!lead) trDraw(A);
    trOverlay(t, A);
    var ap = ambParams(); R.amb.push([t, ap.w, ap.pan, ap.sea, ap.hgt, WX.rain > 0 ? 1 : 0]);
    cg.fillStyle = '#000'; cg.fillRect(0, 0, W, H);
    if (!lead) cg.drawImage(cv, 0, 0, W, H);                             // ⛔ 跟畫的那一下在同一段程式裡讀 ⇒ WebGL 的畫布還沒交出去、讀得到
    cg.drawImage(trEl('trCap'), 0, 0, W, H);
    trRecEndCard(cg, t);
    var vf = new VideoFrame(comp, { timestamp: Math.round(k * 1e6 / fps), duration: Math.round(1e6 / fps) });
    enc.encode(vf, { keyFrame: k % (fps * 2) === 0 });
    vf.close();
    prevT = t;
    while (enc.encodeQueueSize > 6) await trRecYield();
    await trRecDrain(24);
    if (k % fps === 0) {
      await trRecYield();
      var el = (performance.now() - tStart) / 1000, rate = (k + 1) / Math.max(el, 1e-3);
      trRecLog('畫面 ' + (k + 1) + '／' + n + '（片長 ' + t.toFixed(1) + ' 秒）　' + rate.toFixed(1) + ' 格／秒　還要約 ' + Math.round((n - k) / Math.max(rate, 1e-3) / 60) + ' 分');
    }
  }
  await enc.flush(); enc.close();
  await trRecDrain(0);
  trRecLog('畫面完成：' + n + ' 格、' + ((performance.now() - tStart) / 60000).toFixed(1) + ' 分；音效事件 ' + R.sfx.length + '、環境音 ' + R.amb.length + ' 筆；POST 重送 ' + (R.retry || 0) + ' 次');
  var au = await trRecAudio(t0, t1);
  await trRecDrain(0);
  await trRecPost('done', { frames: n, fps: fps, w: W, h: H, t0: t0, t1: t1, vcodec: cfg.codec, audio: au, sfx: R.sfx.length, amb: R.amb.length, err: R.err });
}

/** 聲音：照事件表 1 倍速重播一遍、在限制器後面逐樣本錄下來 ⇒ Opus。回 { sampleRate, channels, preskip, description（base64）, late }。 */
async function trRecAudio(t0, t1) {
  var R = TR_REC, sr = 48000, ACX = window.AudioContext || window.webkitAudioContext;
  window.AudioContext = function () { return new ACX({ sampleRate: sr, latencyHint: 'playback' }); };   // 遊戲的 initAudio 用預設取樣率 ⇒ 錄影固定 48 kHz（Opus 要）
  try { trAudioInit(); } finally { window.AudioContext = ACX; }
  if (!AC) throw new Error('AudioContext 建不起來');
  await AC.resume();
  if (AC.sampleRate !== sr) throw new Error('取樣率是 ' + AC.sampleRate + '，要 48000');
  var code = 'class TrRec extends AudioWorkletProcessor{constructor(){super();this.b=[];this.n=0;this.f0=-1;this.on=true;this.port.onmessage=e=>{if(e.data==="stop"){this.flush();this.on=false;}};}' +
    'flush(){if(this.n){this.port.postMessage({f0:this.f0,b:this.b});this.b=[];this.n=0;this.f0=-1;}}' +
    'process(inp,out){var x=inp[0];if(this.on&&x&&x.length){if(this.f0<0)this.f0=currentFrame;this.b.push(x[0].slice(),(x[1]||x[0]).slice());this.n+=x[0].length;if(this.n>=8192)this.flush();}return true;}}' +
    'registerProcessor("tr-rec",TrRec);';
  await AC.audioWorklet.addModule(URL.createObjectURL(new Blob([code], { type: 'application/javascript' })));
  var node = new AudioWorkletNode(AC, 'tr-rec', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: 'explicit' });
  var quiet = AC.createGain(); quiet.gain.value = 0;                    // 錄的時候不從喇叭出來（AudioWorklet 要接到 destination 才會被拉著跑）
  AC.lim.disconnect(); AC.lim.connect(node); node.connect(quiet); quiet.connect(AC.destination);
  var got = []; node.port.onmessage = function (e) { got.push(e.data); };
  var A0 = AC.currentTime + 1.0, S = R.sfx.slice().sort(function (a, b) { return a[0] - b[0]; }), M = R.amb, si = 0, ai = 0, amb = null, late = 0, AHEAD = 0.6;
  trMusicAt(t0, A0);
  var real = AC, now = 0, PX = new Proxy(real, { get: function (o, k) { if (k === 'currentTime') return now; var v = o[k]; return typeof v === 'function' ? v.bind(o) : v; }, set: function (o, k, v) { o[k] = v; return true; } });
  function ambP(p) { return { w: p[1], pan: p[2], sea: p[3], hgt: p[4], rain: p[5], hold: 0, vol: 1 }; }
  trRecLog('聲音：照時間軸重播 ' + (t1 - t0).toFixed(1) + ' 秒（1 倍速）');
  var lastLog = 0;
  while (true) {
    var ft = t0 + (real.currentTime - A0);
    trMusicPump(Math.max(t0, ft));
    while (si < S.length && S[si][0] < ft + AHEAD) {                    // 音效：照事件的時刻排（sfxPlay 用 AC.currentTime 當起點 ⇒ 換成代理、讓它以為現在就是那一刻）
      var e = S[si++], at = A0 + (e[0] - t0); if (at < real.currentTime) late++;
      now = Math.max(at, real.currentTime); AC = PX; var eye = CAM.eye; CAM.eye = [0, 0, 0];
      try { trRecSfx0(e[1], e[3] > 0 ? [e[3], 0, 0] : null, e[2]); } finally { AC = real; CAM.eye = eye; }
    }
    while (ai < M.length && M[ai][0] < ft + AHEAD) {                    // 環境音：每一格的參數照那一刻設（跟 ambFrame 同一套：雨有沒有變 ⇒ 重建）
      var p = M[ai++], at2 = Math.max(A0 + (p[0] - t0), real.currentTime), rain = p[5] > 0;
      if (!amb || amb.rain !== rain) {
        if (amb) { var old = amb; old.bus.gain.setTargetAtTime(0, at2, 0.05); setTimeout(function () { try { old.bus.disconnect(); old.osc.concat(old.src).forEach(function (q) { q.stop(); }); } catch (x) { } }, 2000); }
        amb = ambBuild(real, real.ambBus || master, rain); ambSet(amb, ambP(p), at2, 0); amb.dropT = at2;
      } else { ambSet(amb, ambP(p), at2, AMB_TC); ambDrops(amb, at2, at2 + 1 / R.fps); }
    }
    if (ft > t1 + 1.0) break;
    if (ft - lastLog > 30) { lastLog = ft; trRecLog('聲音 ' + ft.toFixed(0) + '／' + t1.toFixed(0) + ' 秒'); }
    await trRecSleep(40);
  }
  node.port.postMessage('stop'); await trRecSleep(400);
  // 拼回連續的樣本，裁成 [A0, A0 ＋ 片長)
  var N = Math.round((t1 - t0) * sr), F0 = Math.round(A0 * sr), L = new Float32Array(N), Rr = new Float32Array(N);
  got.forEach(function (m) { var f = m.f0; for (var j = 0; j < m.b.length; j += 2) { var a = m.b[j], b = m.b[j + 1]; for (var q = 0; q < a.length; q++) { var ix = f + q - F0; if (ix >= 0 && ix < N) { L[ix] = a[q]; Rr[ix] = b[q]; } } f += a.length; } });
  var pk = 0, clip = 0; for (var q2 = 0; q2 < N; q2++) { var v = Math.max(Math.abs(L[q2]), Math.abs(Rr[q2])); if (v > pk) pk = v; if (v >= 0.999) clip++; }
  trRecLog('聲音錄好：' + N + ' 樣本，峰值 ' + pk.toFixed(3) + '、削波 ' + clip + ' 樣本、晚排的事件 ' + late);
  // Opus
  var desc = null;
  var aenc = new AudioEncoder({
    output: function (chunk, meta) { if (meta && meta.decoderConfig && meta.decoderConfig.description && !desc) desc = new Uint8Array(meta.decoderConfig.description.buffer || meta.decoderConfig.description);
      var b = new Uint8Array(chunk.byteLength); chunk.copyTo(b); trRecPost('a', b, { seq: R.seq.a++, ts: chunk.timestamp }); },
    error: function (e) { R.err = R.err || '聲音編碼：' + e; }
  });
  aenc.configure({ codec: 'opus', sampleRate: sr, numberOfChannels: 2, bitrate: R.abr });
  for (var i0 = 0; i0 < N; i0 += 9600) {
    var m2 = Math.min(9600, N - i0), d = new Float32Array(m2 * 2); d.set(L.subarray(i0, i0 + m2), 0); d.set(Rr.subarray(i0, i0 + m2), m2);
    aenc.encode(new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: m2, numberOfChannels: 2, timestamp: Math.round(i0 * 1e6 / sr), data: d }));
    if (aenc.encodeQueueSize > 8) await trRecYield();
    await trRecDrain(24);
  }
  await aenc.flush(); aenc.close();
  var b64 = null; if (desc) { var s = ''; for (var z = 0; z < desc.length; z++) s += String.fromCharCode(desc[z]); b64 = btoa(s); }
  return { sampleRate: sr, channels: 2, description: b64, late: late, peak: +pk.toFixed(4), clip: clip, samples: N };
}
