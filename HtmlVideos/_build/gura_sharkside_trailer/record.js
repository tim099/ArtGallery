// ───────────────────────── 錄影模式（gura，2026-10-30；Tim：「參考 trailer.sh 也加一個工具可以直接把宣傳片輸出成影片吧」）─────────────────────────
// 移植自 kaguya 的 Blockside 宣傳片 record.js（逐格算畫面、聲音照事件表另外算）；封裝改成 MP4（H.264 ＋ AAC，照 Blocksail trailer.sh 那一種，mp4.js）。
// ⛔ 這一支不進發佈的成品：record.py 錄影當下才把 mp4.js ＋ 這支注入一份複製（只打本機的 record.py，同源 /rec/…）。
// 片子是片長 t 的純函數 ⇒ 不即時播放、不用螢幕錄影：
//   畫面：一格一格算到 t ＝ from ＋ k／fps、畫好、把 3D 畫布與字幕層疊成一張 1920×1080 ⇒ WebCodecs 編 H.264 ⇒ 不管一格算多久，成品都是準確的 fps、一格不掉。
//   聲音：畫面那一遍不出聲，只記事件（模擬裡的音效＋雷聲：片長秒、種類、音量、離鏡頭多遠、第四個參數；環境音、延燒的火：每一格的參數）；
//         畫完把配樂（TR_SCORE）、音效、環境音、火全部照時刻排進一個 OfflineAudioContext（核心的 initAudio 建在它上面：同一個限制器）、離線算完，
//         裁成跟畫面同一段 ⇒ 軟限幅 ⇒ WebCodecs 編 AAC。（kaguya 那一版是即時 1 倍速重播：這支片 98 秒，離線算得完；即時重播會被音訊執行緒的鎖卡住，見 trRecAudio）
//   收尾：mp4.js 封成一個 MP4、整支 POST 給 record.py 寫檔。
// 網址參數：rec=1、fps（預設 60）、from／to（片長秒，預設整支）、vbr（影像位元率，預設 寬×高×fps×0.17）、abr（聲音，預設 192 kbps）、
//           ss（超取樣：3D 照幾倍算再縮成 1920×1080，預設 1）、name（檔名）。
var TR_REC = TRAILER && Q.get('rec') === '1' ? {
  fps: +(Q.get('fps') || 60), from: +(Q.get('from') || 0), to: Q.has('to') ? +Q.get('to') : null, ss: Math.max(1, Math.min(2, +(Q.get('ss') || 1))),
  vbr: Q.has('vbr') ? +Q.get('vbr') : 0, abr: +(Q.get('abr') || 192000), name: Q.get('name') || 'sharkside-trailer.mp4',
  sfx: [], amb: [], burn: [], cap: false, t: 0, inflight: [], err: null
} : null;

if (TR_REC) {
  TR_W = Math.round(1920 * TR_REC.ss); TR_H = Math.round(1080 * TR_REC.ss);
  // 主迴圈（核心的 rAF 每格叫 trFrame）：錄影時不播放；船全部載好、美術解好才開始（⛔ 不靠 rAF：視窗藏著時 rAF 不跑 ⇒ 另外輪詢）
  trFrame = function () { if (!TR_REC.on) trUI(); };
  (function trRecWait() {
    if (TR.err) { trRecPost('err', '載入失敗：' + TR.err); return; }
    if (TR.ready && TR.loadDone) { TR_REC.on = true; trRecRun().catch(function (e) { trRecPost('err', String(e && e.stack || e)); }); }
    else setTimeout(trRecWait, 200);
  })();
  // 音效：錄影的時候只記、不放（director.js 的 trSfx、雷聲都照名字叫 sfxPlay ⇒ 換掉這個名字就接得到）
  var trRecSfx0 = sfxPlay;
  sfxPlay = function (k, at, v, o) {
    if (TR_REC.cap) { TR_REC.sfx.push([TR_REC.t, k, v === undefined ? 1 : v, at && CAM.eye ? len(sub(at, CAM.eye)) : 0, o]); return; }
    return trRecSfx0(k, at, v, o);
  };
}

function trRecPost(kind, body, q) {
  var url = '/rec/' + kind + (q ? '?' + Object.keys(q).map(function (k) { return k + '=' + encodeURIComponent(q[k]); }).join('&') : '');
  // 連線一時被打回來（Failed to fetch）⇒ 退避重送最多 6 次（kaguya 2026-10-28：一次失敗就整支作廢）
  function send(k) {
    return fetch(url, { method: 'POST', body: body })
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
async function trRecDrain(max) { while (TR_REC.inflight.length > max) await TR_REC.inflight.shift(); }
function trRecLog(s) { trRecPost('log', s); }

async function trRecRun() {
  var R = TR_REC, fps = R.fps, t0 = Math.max(0, R.from), t1 = R.to === null ? TR.DUR : Math.min(R.to, TR.DUR), n = Math.round((t1 - t0) * fps);
  ['trCover', 'trBar', 'trBuf', 'trEnd', 'trLoad', 'trHint'].forEach(function (id) { var e = trEl(id); if (e) e.style.display = 'none'; });
  TR.started = true; TR.playing = false; TR.still = false;
  var W = TR_CW, H = TR_CH, comp = document.createElement('canvas'); comp.width = W; comp.height = H;
  var cg = comp.getContext('2d', { alpha: false }); cg.imageSmoothingEnabled = true; cg.imageSmoothingQuality = 'high';
  var mux = new TrailerMp4({ video: { width: W, height: H, fps: fps }, audio: { sampleRate: 48000, channels: 2 } });
  // 影像編碼器：H.264 High（1080p60 要 4.2；不收 ⇒ 4.0、Main）
  var vbr = R.vbr || Math.round(W * H * fps * 0.17), cfg = null, tries = fps > 30 ? ['avc1.64002A', 'avc1.640028', 'avc1.4D402A'] : ['avc1.640028', 'avc1.4D4028'];
  for (var i = 0; i < tries.length && !cfg; i++) {
    var c = { codec: tries[i], width: W, height: H, bitrate: vbr, framerate: fps, bitrateMode: 'variable', latencyMode: 'quality', avc: { format: 'avc' } };
    var s = await VideoEncoder.isConfigSupported(c).catch(function () { return { supported: false }; });
    if (s.supported) cfg = c;
  }
  if (!cfg) throw new Error('這個瀏覽器的 WebCodecs 不支援 H.264 編碼（換 Chrome／Edge：record.sh --browser）');
  var enc = new VideoEncoder({ output: function (chunk, meta) { mux.video(chunk, meta); }, error: function (e) { R.err = R.err || '影像編碼：' + e; } });
  enc.configure(cfg);
  trRecLog('畫面：' + n + ' 格（片長 ' + t0.toFixed(2) + ' → ' + t1.toFixed(2) + ' 秒，' + fps + ' fps，' + cfg.codec + ' ' + (vbr / 1e6).toFixed(1) + ' Mbps，3D ' + TR_W + '×' + TR_H + '）');
  var tStart = performance.now(), prevT = t0, waitImg = 0;   // waitImg：等過美術解碼的格數（讀數）
  for (var k = 0; k < n; k++) {
    if (R.err) throw new Error(R.err);
    var t = t0 + k / fps, A = trAt(t);
    var cut = TR.cur !== A.i || A.n < TR.k, lead = A.u < A.sc.lead;
    // 換幕：重開＋預跑不出聲（跟播放同一條：director.js trFrame）
    if (cut) { R.cap = false; TR.live = false; trStepTo(A.i, lead ? 0 : Math.min(A.n, trPreSteps(A.sc)), 0); }
    R.t = t; R.cap = true; TR.live = !lead;
    trStepTo(A.i, A.n, 0);
    if (!cut) trThunder(prevT, t);
    TR.live = false; R.cap = false;
    if (!lead) trDraw(A);
    trOverlay(t, A);
    if (TR.imgPend > 0) {                                               // 美術第一次用到才解碼 ⇒ 等解好、字幕層重畫（不然那一格少一張圖）；
      while (TR.imgPend > 0) await trRecSleep(5);                       //   等過 ⇒ 3D 那一格已經交出去了，同一個 t 再畫一次
      waitImg++; trOverlay(t, A); if (!lead) trDraw(A);
    }
    var ap = ambParams(), bl = burnSndLevel();
    R.amb.push([t, ap.w, ap.pan, ap.sea, ap.hgt, WX.rain > 0 ? 1 : 0]); R.burn.push([t, bl.lv, bl.d]);
    cg.fillStyle = '#000'; cg.fillRect(0, 0, W, H);
    if (!lead) cg.drawImage(cv, 0, 0, W, H);                             // ⛔ 跟畫的那一下在同一段程式裡讀 ⇒ WebGL 的畫布還沒交出去、讀得到
    cg.drawImage(trEl('trCap'), 0, 0, W, H);
    var vf = new VideoFrame(comp, { timestamp: Math.round(k * 1e6 / fps), duration: Math.round(1e6 / fps) });
    enc.encode(vf, { keyFrame: k % (fps * 2) === 0 });
    vf.close();
    prevT = t;
    while (enc.encodeQueueSize > 6) await trRecYield();
    if (typeof sndGc === 'function') sndGc();
    if (k % fps === 0) {
      await trRecYield();
      var el = (performance.now() - tStart) / 1000, rate = (k + 1) / Math.max(el, 1e-3);
      if (k % (fps * 5) === 0) trRecLog('畫面 ' + (k + 1) + '／' + n + '（片長 ' + t.toFixed(1) + ' 秒，' + (A.sc.id || A.i) + '）　' + rate.toFixed(1) + ' 格／秒　還要約 ' + Math.ceil((n - k) / Math.max(rate, 1e-3) / 60) + ' 分');
    }
  }
  await enc.flush(); enc.close();
  trRecLog('畫面完成：' + n + ' 格、' + ((performance.now() - tStart) / 60000).toFixed(1) + ' 分；音效事件 ' + R.sfx.length + '、環境音 ' + R.amb.length + ' 筆、等美術解碼重畫 ' + waitImg + ' 格');
  await trRecAudio(t0, t1, mux);
  var blob = mux.finish();
  trRecLog('MP4 封好了：' + (blob.size / 1048576).toFixed(1) + ' MB，送出去寫檔');
  await trRecDrain(0);
  await trRecPost('video', blob, { name: R.name });
  await trRecDrain(0);
  if (R.err) throw new Error(R.err);
}

/** 聲音：照事件表一次排進 OfflineAudioContext、離線算完（限制器後面就是 destination）⇒ AAC（進 mux）。
 *  ⛔ 不用即時重播：每格對環境音參數 setTargetAtTime 會跟音訊執行緒搶鎖（核心 02_ambient.js TASK-0905 那一段），主執行緒整個停 1～3.9 秒
 *     （2026-10-30 量：往前排 0.6／1.5／3 秒都有音效晚排，配樂被跳過的音符連數都數不到）⇒ 離線算：沒有「現在」，每一聲都照它的時刻排。 */
async function trRecAudio(t0, t1, mux) {
  var R = TR_REC, sr = 48000, A0 = 0.25, N = Math.round((t1 - t0) * sr), ACX = window.AudioContext || window.webkitAudioContext, OAC = window.OfflineAudioContext;
  var LEN = Math.round((A0 + (t1 - t0) + 1.0) * sr);
  window.AudioContext = function () { return new OAC(2, LEN, sr); };    // 核心的 initAudio 照這個建 ⇒ master、限制器、三條音量線、noiseBuf 都在離線的那一個上
  try { trAudioInit(); } finally { window.AudioContext = ACX; }
  if (!AC || !(AC instanceof OAC)) throw new Error('離線的 AudioContext 建不起來（AC 已經有了？）');
  var real = AC, now = 0, PX = new Proxy(real, { get: function (o, k) { if (k === 'currentTime') return now; var v = o[k]; return typeof v === 'function' ? v.bind(o) : v; }, set: function (o, k, v) { o[k] = v; return true; } });
  // ⛔ 排程的時候不拆「放完的」聲音：核心的 sfxPlay 每一聲都先叫 sndGc（照 AC.currentTime 拆 sndFree 登記的出口）⇒ 代理成後面音效的時刻 ⇒
  //    還沒開始算就把前面的配樂音、音效拆掉（2026-10-30 第一版離線：開場的 drone 整段不見，60–120 Hz 少 30 dB）
  var gc0 = sndGc; sndGc = function () { };
  var tw = performance.now(), S = R.sfx.slice().sort(function (a, b) { return a[0] - b[0]; }), M = R.amb, B = R.burn, dt = 1 / R.fps, amb = null, fire = null, nAmb = 0, nCk = 0;
  // 配樂：整支一次排完（TR_LOOK_S 拉到整支）
  var look0 = TR_LOOK_S; TR_LOOK_S = (t1 - t0) + 2;
  try { trMusicAt(t0, A0); } finally { TR_LOOK_S = look0; }
  // 音效：sfxPlay 用 AC.currentTime 當起點 ⇒ 換成代理、讓它以為現在就是那一刻；聲音的亂數用真的 Math.random（同 director.js trSfx）
  S.forEach(function (e) {
    now = A0 + (e[0] - t0); AC = PX; var eye = CAM.eye, r0 = Math.random; CAM.eye = [0, 0, 0]; Math.random = TR_RAND0;
    try { trRecSfx0(e[1], e[3] > 0 ? [e[3], 0, 0] : null, e[2], e[4]); } finally { Math.random = r0; AC = real; CAM.eye = eye; }
  });
  // 環境音：每一格的參數照那一刻設（跟核心 ambFrame 同一套；雨有沒有變 ⇒ 換一組：舊的淡掉、新的從那一刻才出聲）
  function ambP(p) { return { w: p[1], pan: p[2], sea: p[3], hgt: p[4], rain: p[5], hold: 0, vol: 1 }; }
  M.forEach(function (p) {
    var at = A0 + (p[0] - t0), rain = p[5] > 0;
    if (!amb || amb.rain !== rain) {
      if (amb) { amb.bus.gain.setTargetAtTime(0, at, 0.05); amb.osc.concat(amb.src).forEach(function (q) { q.stop(at + 0.6); }); }
      amb = ambBuild(real, real.ambBus || master, rain); amb.bus.gain.setValueAtTime(0, 0); ambSet(amb, ambP(p), at, 0); amb.dropT = at; nAmb++;
    } else { ambSet(amb, ambP(p), at, AMB_TC); ambDrops(amb, at, at + dt); }
  });
  // 延燒的火（核心 burnSndFrame 同一套；離線 ⇒ 建一次、沒火時音量是 0）
  B.forEach(function (b) {
    var at = A0 + (b[0] - t0);
    if (!fire) { if (b[1] <= 0) return; fire = burnSndBuild(real, real.sfxBus); fire.t = at; }
    burnSndSet(fire, b[1], b[2], at, 0.3); if (b[1] > 0.01) { nCk++; burnSndCrackle(fire, at, at + dt, b[1], TR_RAND0); }
  });
  trRecLog('聲音：排好了（音效 ' + S.length + '、環境音 ' + nAmb + ' 組、有火的格 ' + nCk + '，' + Math.round(performance.now() - tw) + ' ms）⇒ 離線算 ' + (LEN / sr).toFixed(1) + ' 秒');
  tw = performance.now();
  var buf;
  try { buf = await real.startRendering(); } finally { sndGc = gc0; SND_FREE.length = 0; }
  trRecLog('聲音：離線算完 ' + ((performance.now() - tw) / 1000).toFixed(1) + ' 秒');
  // 裁成 [A0, A0 ＋ 片長)
  var F0 = Math.round(A0 * sr), L = buf.getChannelData(0).slice(F0, F0 + N), Rr = buf.getChannelData(1).slice(F0, F0 + N);
  var pk = 0, clip = 0, ss = 0; for (var q2 = 0; q2 < N; q2++) { var v = Math.max(Math.abs(L[q2]), Math.abs(Rr[q2])); if (v > pk) pk = v; if (v >= 0.999) clip++; ss += L[q2] * L[q2] + Rr[q2] * Rr[q2]; }
  trRecLog('聲音錄好：' + N + ' 樣本，峰值 ' + pk.toFixed(3) + '、RMS ' + (10 * Math.log10(ss / (2 * N) || 1e-12)).toFixed(1) + ' dB、削波 ' + clip + ' 樣本');
  // 軟限幅（−0.45 dBFS）：核心的限制器是壓縮器（起 2 ms），重拍的頭會衝過 1（2026-10-30 整支量到峰值 1.058）⇒ 只壓超過膝點的樣本，不動整體音量
  var LIM = 0.95, KNEE = 0.85 * LIM, soft = 0, pk2 = 0;
  function sl(x) { var a = Math.abs(x); if (a <= KNEE) return x; soft++; var y = KNEE + (LIM - KNEE) * Math.tanh((a - KNEE) / (LIM - KNEE)); return x < 0 ? -y : y; }
  for (var q3 = 0; q3 < N; q3++) { L[q3] = sl(L[q3]); Rr[q3] = sl(Rr[q3]); pk2 = Math.max(pk2, Math.abs(L[q3]), Math.abs(Rr[q3])); }
  trRecLog('軟限幅：' + soft + ' 樣本過了膝點 ' + KNEE.toFixed(3) + '（' + (soft / (2 * N) * 100).toFixed(3) + '%）⇒ 峰值 ' + pk2.toFixed(3));
  var aenc = new AudioEncoder({ output: function (chunk, meta) { mux.audio(chunk, meta); }, error: function (e) { R.err = R.err || '聲音編碼：' + e; } });
  aenc.configure({ codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: 2, bitrate: R.abr });
  mux.a.br = R.abr;
  for (var i0 = 0; i0 < N; i0 += 4800) {
    var m2 = Math.min(4800, N - i0), d = new Float32Array(m2 * 2); d.set(L.subarray(i0, i0 + m2), 0); d.set(Rr.subarray(i0, i0 + m2), m2);
    aenc.encode(new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: m2, numberOfChannels: 2, timestamp: Math.round(i0 * 1e6 / sr), data: d }));
    if (aenc.encodeQueueSize > 8) await trRecYield();
  }
  await aenc.flush(); aenc.close();
  if (R.err) throw new Error(R.err);
}
