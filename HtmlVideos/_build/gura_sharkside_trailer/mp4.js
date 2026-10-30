// ── MP4 封裝（照抄 Blocksail trailer/mp4.js，2026-10-30；錄影時 record.py 才注入，畫廊那一份不帶）──
// 宣傳片錄影的 MP4 封裝（trailer.html；H.264 ＋ AAC，YouTube 最標準的那一種）
//   Tim 2026-10-27：「需要一個可以不掉fps的轉錄成影片功能(用來上架YT宣傳片) 錄製時可以掉fps 但是要能還原回去(包含聲音)」
//   ⇒ 畫面是一格一格算的（trailer/vclock.js 虛擬時鐘），每一格的時間戳是「第幾格 ÷ 幀率」，跟實際算多慢無關；聲音最後離線混好一次編碼。
//   這支只管封裝：WebCodecs 編好的 EncodedVideoChunk、EncodedAudioChunk ⇒ 一般的（非分段）MP4：ftyp ＋ mdat ＋ moov（moov 放最後）。
//   樣本先存成 Blob（Chrome 大的 Blob 會放到磁碟、不吃記憶體），收尾時照時間交錯排（每 0.5 秒一塊）、組 moov；位址一律 64 位元（co64）。
//   沒有 B 幀時 pts ＝ dts；有（時間戳不是遞增）⇒ 照排好的時間戳當 dts、寫 ctts。
(function (G) {
  'use strict';

  var CHUNK_SEC = 0.5;                                                  // 交錯：一塊最多幾秒
  var FLUSH = 4 << 20;                                                  // 存到 4 MB 就併成一個 Blob

  function u8(n) { return new Uint8Array(n); }
  function be32(v) { return [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]; }
  function be16(v) { return [(v >>> 8) & 255, v & 255]; }
  function be64(v) { var hi = Math.floor(v / 4294967296), lo = v >>> 0; return be32(hi).concat(be32(lo)); }
  function str(s) { var a = []; for (var i = 0; i < s.length; i++) a.push(s.charCodeAt(i) & 255); return a; }
  function bytes(x) { return x instanceof Uint8Array ? Array.prototype.slice.call(x) : x; }
  function put(a, b) { for (var i = 0; i < b.length; i++) a.push(b[i]); return a; }    // 大表（stsz、co64…）用 push 累加，不用 concat（O(n²)）
  // 一個 box ＝ 大小 ＋ 類型 ＋ 內容（內容是數字陣列或子 box 的陣列，攤平）
  function box(type) {
    var body = [];
    for (var i = 1; i < arguments.length; i++) { var p = arguments[i]; if (p == null) continue; put(body, bytes(p)); }
    return put(put(be32(body.length + 8), str(type)), body);
  }
  function full(type, ver, flags) { var rest = [].slice.call(arguments, 3); return box.apply(null, [type, [ver].concat(be32(flags).slice(1))].concat(rest)); }
  function rle(arr) { var out = []; arr.forEach(function (v) { var l = out[out.length - 1]; if (l && l[1] === v) l[0]++; else out.push([1, v]); }); return out; }
  var MATRIX = [].concat(be32(0x00010000), be32(0), be32(0), be32(0), be32(0x00010000), be32(0), be32(0), be32(0), be32(0x40000000));

  // 一條軌的樣本：資料存在 Blob 裡（blob、off、size），時間用軌自己的時間單位
  function Track(kind, ts) { this.kind = kind; this.ts = ts; this.s = []; this.pend = []; this.pendN = 0; this.blobs = []; this.cfg = null; }
  Track.prototype.add = function (data, pts, dur, key) {
    this.s.push({ b: this.blobs.length, o: this.pendN, n: data.byteLength, pts: pts, dur: dur, key: key });
    this.pend.push(data); this.pendN += data.byteLength;
    if (this.pendN >= FLUSH) this.flush();
  };
  Track.prototype.flush = function () { if (!this.pend.length) return; this.blobs.push(new Blob(this.pend)); this.pend = []; this.pendN = 0; };

  /** o ＝ { video: { width, height, fps }, audio: { sampleRate, channels } }（沒有聲音 ⇒ audio 省略） */
  function Mp4(o) {
    this.v = new Track('vide', 90000); this.v.w = o.video.width; this.v.h = o.video.height; this.v.fps = o.video.fps;
    this.a = o.audio ? new Track('soun', o.audio.sampleRate) : null;
    if (this.a) { this.a.ch = o.audio.channels; this.a.rate = o.audio.sampleRate; }
  }
  /** VideoEncoder 的 output(chunk, meta)：第一個 meta.decoderConfig.description ＝ avcC（avc.format ＝ 'avc'） */
  Mp4.prototype.video = function (chunk, meta) {
    var t = this.v;
    if (meta && meta.decoderConfig && !t.cfg) t.cfg = meta.decoderConfig;
    var d = u8(chunk.byteLength); chunk.copyTo(d);
    t.add(d, Math.round(chunk.timestamp * t.ts / 1e6), Math.round(t.ts / t.fps), chunk.type === 'key');
  };
  /** AudioEncoder 的 output(chunk, meta)：第一個 meta.decoderConfig.description ＝ AudioSpecificConfig */
  Mp4.prototype.audio = function (chunk, meta) {
    var t = this.a;
    if (meta && meta.decoderConfig && !t.cfg) t.cfg = meta.decoderConfig;
    var d = u8(chunk.byteLength); chunk.copyTo(d);
    t.add(d, Math.round(chunk.timestamp * t.ts / 1e6), 1024, true);    // AAC 一包固定 1024 個取樣
  };

  // 樣本的 dts、ctts：時間戳遞增 ⇒ dts ＝ pts；不然照排好的時間戳當 dts
  function times(t) {
    var p = t.s.map(function (s) { return s.pts; }), sorted = p.slice().sort(function (a, b) { return a - b; }), mono = true;
    for (var i = 1; i < p.length; i++) if (p[i] < p[i - 1]) { mono = false; break; }
    var dts = mono ? p : sorted, ctts = null;
    if (!mono) { var sh = 0; for (i = 0; i < p.length; i++) sh = Math.max(sh, dts[i] - p[i]); ctts = p.map(function (v, k) { return v + sh - dts[k]; }); t.shift = sh; }
    var dur = [];
    for (i = 0; i < dts.length; i++) dur.push(i + 1 < dts.length ? dts[i + 1] - dts[i] : t.s[i].dur);
    return { dts: dts, dur: dur, ctts: ctts };
  }

  function avc1(t) {
    var desc = new Uint8Array(t.cfg.description instanceof ArrayBuffer ? t.cfg.description : t.cfg.description.buffer.slice(t.cfg.description.byteOffset, t.cfg.description.byteOffset + t.cfg.description.byteLength));
    var cs = t.cfg.colorSpace, colr = null;
    if (cs && (cs.primaries || cs.transfer || cs.matrix)) {
      var P = { bt709: 1, bt470bg: 5, smpte170m: 6, bt2020: 9 }, T = { bt709: 1, smpte170m: 6, 'iec61966-2-1': 13, linear: 8 }, M = { rgb: 0, bt709: 1, bt470bg: 5, smpte170m: 6 };
      colr = box('colr', str('nclx'), be16(P[cs.primaries] || 1), be16(T[cs.transfer] || 1), be16(M[cs.matrix] != null ? M[cs.matrix] : 1), [cs.fullRange ? 0x80 : 0]);
    }
    var name = str('Sharkside trailer'), cn = [name.length].concat(name); while (cn.length < 32) cn.push(0);   // compressorname：長度 ＋ 31 位元組
    return box('avc1', [0, 0, 0, 0, 0, 0], be16(1), u8(16), be16(t.w), be16(t.h), be32(0x00480000), be32(0x00480000), be32(0), be16(1),
      cn, be16(0x18), be16(0xffff), box('avcC', desc), colr, box('pasp', be32(1), be32(1)));
  }
  // ES_Descriptor 的長度用四位元組的寫法（0x80 0x80 0x80 n）
  function desc(tag, body) { var n = body.length; return [tag, 0x80 | ((n >> 21) & 127), 0x80 | ((n >> 14) & 127), 0x80 | ((n >> 7) & 127), n & 127].concat(body); }
  function mp4a(t) {
    var asc = bytes(new Uint8Array(t.cfg.description instanceof ArrayBuffer ? t.cfg.description : t.cfg.description.buffer.slice(t.cfg.description.byteOffset, t.cfg.description.byteOffset + t.cfg.description.byteLength)));
    var br = t.br || 192000;
    var dcd = desc(0x04, [0x40, 0x15].concat([0, 0, 0], be32(br), be32(br), desc(0x05, asc)));
    var esd = desc(0x03, be16(1).concat([0], dcd, desc(0x06, [2])));
    return box('mp4a', [0, 0, 0, 0, 0, 0], be16(1), u8(8), be16(t.ch), be16(16), be16(0), be16(0), be32(t.rate * 65536 >>> 0), full('esds', 0, 0, esd));
  }

  function stbl(t, tm, chunks) {
    var stsd = full('stsd', 0, 0, be32(1), t.kind === 'vide' ? avc1(t) : mp4a(t));
    var stts = rle(tm.dur), sttsB = be32(stts.length); stts.forEach(function (e) { put(put(sttsB, be32(e[0])), be32(e[1])); });
    var cttsBox = null;
    if (tm.ctts) { var ct = rle(tm.ctts), b = be32(ct.length); ct.forEach(function (e) { put(put(b, be32(e[0])), be32(e[1])); }); cttsBox = full('ctts', 0, 0, b); }
    var stss = null;
    if (t.kind === 'vide') { var keys = []; t.s.forEach(function (s, i) { if (s.key) keys.push(i + 1); }); if (keys.length < t.s.length) { var kb = be32(keys.length); keys.forEach(function (k) { put(kb, be32(k)); }); stss = full('stss', 0, 0, kb); } }
    var sc = [], prev = -1;                                               // stsc：一塊幾個樣本，一樣的連在一起
    chunks.forEach(function (c, i) { if (c.n !== prev) { sc.push([i + 1, c.n]); prev = c.n; } });
    var scB = be32(sc.length); sc.forEach(function (e) { put(put(put(scB, be32(e[0])), be32(e[1])), be32(1)); });
    var szB = put(be32(0), be32(t.s.length)); t.s.forEach(function (s) { put(szB, be32(s.n)); });
    var coB = be32(chunks.length); chunks.forEach(function (c) { put(coB, be64(c.at)); });
    return box('stbl', stsd, full('stts', 0, 0, sttsB), cttsBox, stss, full('stsc', 0, 0, scB), full('stsz', 0, 0, szB), full('co64', 0, 0, coB));
  }

  function trak(t, id, tm, chunks, movDur) {
    var mediaDur = tm.dts.length ? tm.dts[tm.dts.length - 1] + tm.dur[tm.dur.length - 1] : 0;
    var vid = t.kind === 'vide';
    var tkhd = full('tkhd', 1, 3, be64(0), be64(0), be32(id), be32(0), be64(movDur), be32(0), be32(0), be16(0), be16(0), be16(vid ? 0 : 0x0100), be16(0), MATRIX,
      be32(vid ? t.w * 65536 : 0), be32(vid ? t.h * 65536 : 0));
    var edts = null;                                                        // 有 ctts ⇒ 用編輯清單把第一格對回 0
    if (t.shift) edts = box('edts', full('elst', 1, 0, be32(1), be64(Math.round(mediaDur / t.ts * 1000)), be64(t.shift), be16(1), be16(0)));
    var mdhd = full('mdhd', 1, 0, be64(0), be64(0), be32(t.ts), be64(mediaDur), be16(0x55c4), be16(0));
    var hdlr = full('hdlr', 0, 0, be32(0), str(t.kind), u8(12), str(vid ? 'VideoHandler' : 'SoundHandler'), [0]);
    var mhd = vid ? full('vmhd', 0, 1, u8(8)) : full('smhd', 0, 0, u8(4));
    var dinf = box('dinf', full('dref', 0, 0, be32(1), full('url ', 0, 1)));
    return box('trak', tkhd, edts, box('mdia', mdhd, hdlr, box('minf', mhd, dinf, stbl(t, tm, chunks))));
  }

  /** 收尾 ⇒ Blob（video/mp4） */
  Mp4.prototype.finish = function () {
    var tracks = [this.v].concat(this.a && this.a.s.length ? [this.a] : []);
    tracks.forEach(function (t) { t.flush(); t.tm = times(t); });
    // 分塊：每條軌照 dts 每 CHUNK_SEC 一塊，然後所有塊照開始時間交錯
    var all = [];
    tracks.forEach(function (t) {
      t.chunks = []; var c = null, lim = CHUNK_SEC * t.ts;
      t.s.forEach(function (s, i) {
        var d = t.tm.dts[i];
        if (!c || d - c.t0 >= lim) { c = { t: t, t0: d, sec: d / t.ts, first: i, n: 0 }; t.chunks.push(c); all.push(c); }
        c.n++;
      });
    });
    all.sort(function (a, b) { return a.sec - b.sec || (a.t.kind === 'vide' ? -1 : 1); });
    var ftyp = box('ftyp', str('isom'), be32(0x200), str('isom'), str('iso2'), str('avc1'), str('mp41'));
    var at = ftyp.length + 16, parts = [], blobsOf = function (t, s) { return t.blobs[s.b].slice(s.o, s.o + s.n); };
    all.forEach(function (c) { c.at = at; for (var i = c.first; i < c.first + c.n; i++) { var s = c.t.s[i]; parts.push(blobsOf(c.t, s)); at += s.n; } });
    var mdatSize = at - ftyp.length;
    var movDur = 0;
    tracks.forEach(function (t) { var n = t.tm.dts.length; if (n) movDur = Math.max(movDur, Math.round((t.tm.dts[n - 1] + t.tm.dur[n - 1]) / t.ts * 1000)); });
    var mvhd = full('mvhd', 1, 0, be64(0), be64(0), be32(1000), be64(movDur), be32(0x00010000), be16(0x0100), u8(10), MATRIX, u8(24), be32(tracks.length + 1));
    var traks = tracks.map(function (t, i) { return trak(t, i + 1, t.tm, t.chunks, movDur); });
    var moov = box.apply(null, ['moov', mvhd].concat(traks));
    var mdatH = be32(1).concat(str('mdat'), be64(mdatSize));
    return new Blob([new Uint8Array(ftyp), new Uint8Array(mdatH)].concat(parts, [new Uint8Array(moov)]), { type: 'video/mp4' });
  };

  G.TrailerMp4 = Mp4;
})(window);                                                           // ⛔ 注入在核心閉包裡（strict）⇒ this 是 undefined
