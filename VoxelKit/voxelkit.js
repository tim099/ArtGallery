/* VoxelKit —— 雕刻作品的瀏覽器端：.vxk 解碼、稀疏網格、網格化、WebGL2 算繪、射線、連通。
 * 區塊職責：把 voxel_export.py 產的 .vxk（deflate-raw）變成可以畫、可以改的格子。零外部依賴。
 * 物理意義：座標一律是作品的格座標（x 船長、y 船寬、z 高），1 格 ＝ header.meters_per_voxel 公尺；
 *           世界座標怎麼擺由呼叫端給模型矩陣（格 → 世界）。
 * 設計取捨：
 *   · 網格是「16³ 區塊表」：只存非空區塊；兩份 Grid 可以共用同一份資料，誰先改哪一塊誰才複製（copy-on-write）。
 *   · 網格化以區塊為單位做同色面合併（greedy），GPU 緩衝以 64³ 為一區（少 draw call、改一格只重組一區）。
 *   · 頂點 8 bytes：uvec4(x, y, z, 法線 | 色值<<3)；色值在著色器裡照 RGB332 解。
 * 失敗處置：解碼對不上（magic、長度）⇒ 丟例外，⛔ 不畫半艘船；checksum 由呼叫端比（VoxelKit.verify）。
 */
(function (root) {
  'use strict';
  var CH = 16, CH3 = 4096, PAD = 18, PAD2 = 324;

  // ───────────────────────── 調色盤與 checksum ─────────────────────────
  function rgb332(i) { return [((i >> 5) & 7) * 255 / 7 | 0, ((i >> 2) & 7) * 255 / 7 | 0, (i & 3) * 255 / 3 | 0]; }
  function hashVoxel(x, y, z, c) {   // voxel_export.py 的 checksum 是同一式（mod 2^32）
    return (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791) ^ Math.imul(c, 2654435761 | 0)) >>> 0;
  }

  // ───────────────────────── 解碼 ─────────────────────────
  function b64ToBytes(s) {
    var bin = atob(s.replace(/\s+/g, '')), n = bin.length, u = new Uint8Array(n);
    for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function inflateRaw(u8) {
    if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('這個瀏覽器沒有 DecompressionStream（deflate-raw）'));
    var s = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(s).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  function parse(raw) {
    if (raw[0] !== 86 || raw[1] !== 88 || raw[2] !== 75 || raw[3] !== 49) throw new Error('不是 VXK1 封裝');
    var dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    var hn = dv.getUint32(4, true);
    var header = JSON.parse(new TextDecoder().decode(raw.subarray(8, 8 + hn)));
    var n = header.nchunks, p = 8 + hn;
    if (raw.length !== p + n * 6 + n * CH3) throw new Error('VXK1 長度不對：' + raw.length + ' ≠ ' + (p + n * 6 + n * CH3));
    var keys = new Uint16Array(n * 3);
    for (var i = 0; i < n * 3; i++) keys[i] = dv.getUint16(p + i * 2, true);
    p += n * 6;
    var chunks = [];
    for (i = 0; i < n; i++) chunks.push({ cx: keys[i * 3], cy: keys[i * 3 + 1], cz: keys[i * 3 + 2], data: raw.subarray(p + i * CH3, p + (i + 1) * CH3) });
    return { header: header, chunks: chunks };
  }
  function decode(u8) { return inflateRaw(u8).then(parse); }
  /** <script type="application/x-asset" id="…" data-mime="…">base64</script>（vxk_inline.py 填的）；空的（optional 素材沒交）⇒ null。 */
  function embedded(id) {
    var el = document.getElementById(id); if (!el) return null;
    var t = el.textContent.replace(/\s+/g, '');
    return t ? { mime: el.getAttribute('data-mime') || 'application/octet-stream', b64: t } : null;
  }
  /** 內嵌的圖 ⇒ Promise<Image|null>（沒有或解不開 ⇒ null，呼叫端用替代品）。 */
  function embeddedImage(id) {
    var e = embedded(id); if (!e) return Promise.resolve(null);
    return new Promise(function (res) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = 'data:' + e.mime + ';base64,' + e.b64; });
  }
  /** 內嵌的 JSON ⇒ 物件（沒有或解不開 ⇒ null）。 */
  function embeddedJSON(id) {
    var e = embedded(id); if (!e) return null;
    try { return JSON.parse(new TextDecoder().decode(b64ToBytes(e.b64))); } catch (x) { return null; }
  }
  /** <script type="application/x-vxk" id="…">base64</script>（vxk_inline.py 填進去的）⇒ 模型。 */
  function loadEmbedded(id) {
    var el = document.getElementById(id);
    if (!el) return Promise.reject(new Error('找不到內嵌的 .vxk：#' + id));
    return decode(b64ToBytes(el.textContent));
  }

  // ───────────────────────── 稀疏網格 ─────────────────────────
  function Grid(size) {
    this.sx = size[0]; this.sy = size[1]; this.sz = size[2];
    this.nx = Math.ceil(this.sx / CH); this.ny = Math.ceil(this.sy / CH); this.nz = Math.ceil(this.sz / CH);
    this.tab = new Array(this.nx * this.ny * this.nz).fill(null);
    this.own = new Uint8Array(this.tab.length);    // 1 ＝ 這份 Grid 自己的（可以直接寫）
    this.count = 0;
  }
  Grid.fromModel = function (model) {
    var g = new Grid(model.header.size);
    model.chunks.forEach(function (c) { g.tab[g.ci(c.cx, c.cy, c.cz)] = c.data; });
    g.count = model.header.voxels;
    return g;
  };
  /** 共用同一份資料的另一份網格（之後各改各的）。 */
  Grid.prototype.share = function () {
    var g = new Grid([this.sx, this.sy, this.sz]);
    g.tab = this.tab.slice(); g.count = this.count;
    return g;
  };
  Grid.prototype.ci = function (cx, cy, cz) { return cx + this.nx * (cy + this.ny * cz); };
  Grid.prototype.get = function (x, y, z) {
    if (x < 0 || y < 0 || z < 0 || x >= this.sx || y >= this.sy || z >= this.sz) return 0;
    var c = this.tab[(x >> 4) + this.nx * ((y >> 4) + this.ny * (z >> 4))];
    return c === null ? 0 : c[(x & 15) | ((y & 15) << 4) | ((z & 15) << 8)];
  };
  /** 寫一格，回舊值。界外 ⇒ 不寫、回 -1。 */
  Grid.prototype.set = function (x, y, z, v) {
    if (x < 0 || y < 0 || z < 0 || x >= this.sx || y >= this.sy || z >= this.sz) return -1;
    var i = (x >> 4) + this.nx * ((y >> 4) + this.ny * (z >> 4)), c = this.tab[i];
    var li = (x & 15) | ((y & 15) << 4) | ((z & 15) << 8);
    if (c === null) { if (!v) return 0; c = this.tab[i] = new Uint8Array(CH3); this.own[i] = 1; }
    else if (!this.own[i]) { if (c[li] === v) return v; c = this.tab[i] = new Uint8Array(c); this.own[i] = 1; }
    var old = c[li];
    if (old !== v) { c[li] = v; this.count += (v ? 1 : 0) - (old ? 1 : 0); }
    return old;
  };
  /** 每格走一次（cb(x, y, z, c)）。 */
  Grid.prototype.each = function (cb) {
    for (var cz = 0; cz < this.nz; cz++) for (var cy = 0; cy < this.ny; cy++) for (var cx = 0; cx < this.nx; cx++) {
      var c = this.tab[this.ci(cx, cy, cz)];
      if (c === null) continue;
      for (var li = 0; li < CH3; li++) if (c[li]) cb(cx * CH + (li & 15), cy * CH + ((li >> 4) & 15), cz * CH + (li >> 8), c[li]);
    }
  };
  /** 逐格 checksum 與格數 ⇒ 跟 header 比（還沒動過的網格才該相等）。 */
  function verify(grid, header) {
    var sum = 0, n = 0;
    grid.each(function (x, y, z, c) { sum = (sum + hashVoxel(x, y, z, c)) >>> 0; n++; });
    return { voxels: n, checksum: sum, ok: n === header.voxels && sum === header.checksum };
  }

  // ───────────────────────── 網格化（區塊內同色面合併） ─────────────────────────
  var pad = new Uint8Array(PAD * PAD * PAD), mask = new Int16Array(CH * CH);
  // 軸 a 的面：u、v 取讓 (u, v, a) 成右手系的兩軸
  var UAX = [1, 2, 0], VAX = [2, 0, 1], P = [0, 0, 0];
  /** 一個區塊的四邊形 ⇒ Uint16Array（每頂點 x,y,z,packed；每四邊形 4 頂點）。空 ⇒ null。 */
  function meshChunk(grid, cx, cy, cz) {
    var c = grid.tab[grid.ci(cx, cy, cz)];
    if (c === null) return null;
    var x0 = cx * CH, y0 = cy * CH, z0 = cz * CH, x, y, z;
    // 填 18³（含鄰居一層）：內部直接抄，外框一格一格問網格
    pad.fill(0);
    for (z = 0; z < CH; z++) for (y = 0; y < CH; y++) {
      var src = (y << 4) | (z << 8), dst = 1 + (y + 1) * PAD + (z + 1) * PAD2;
      for (x = 0; x < CH; x++) pad[dst + x] = c[src + x];
    }
    for (var a = 0; a < 3; a++) for (var s = -1; s <= CH; s += CH + 1) for (var p = -1; p <= CH; p++) for (var q = -1; q <= CH; q++) {
      var lx, ly, lz;
      if (a === 0) { lx = s; ly = p; lz = q; } else if (a === 1) { lx = p; ly = s; lz = q; } else { lx = p; ly = q; lz = s; }
      pad[(lx + 1) + (ly + 1) * PAD + (lz + 1) * PAD2] = grid.get(x0 + lx, y0 + ly, z0 + lz);
    }
    var out = [], st = [1, PAD, PAD2];
    for (a = 0; a < 3; a++) {
      var ua = UAX[a], va = VAX[a], sa = st[a], su = st[ua], sv = st[va], B = 1 + PAD + PAD2;
      for (var sgn = 1; sgn >= -1; sgn -= 2) {
        var nrm = a * 2 + (sgn > 0 ? 0 : 1), off = sgn * st[a];
        for (var d = 0; d < CH; d++) {
          var any = false, row0 = B + d * sa;
          for (var v = 0; v < CH; v++) for (var u = 0, pi = row0 + v * sv; u < CH; u++, pi += su) {
            var col = pad[pi], m = (col && !pad[pi + off]) ? col : 0;
            mask[u + v * CH] = m; if (m) any = true;
          }
          if (!any) continue;
          var plane = (a === 0 ? x0 : a === 1 ? y0 : z0) + d + (sgn > 0 ? 1 : 0);
          var bu = (ua === 0 ? x0 : ua === 1 ? y0 : z0), bv = (va === 0 ? x0 : va === 1 ? y0 : z0);
          for (v = 0; v < CH; v++) for (u = 0; u < CH;) {
            var k = mask[u + v * CH];
            if (!k) { u++; continue; }
            var w = 1; while (u + w < CH && mask[u + w + v * CH] === k) w++;
            var h = 1, ok = true;
            while (v + h < CH && ok) { for (var t = 0; t < w; t++) if (mask[u + t + (v + h) * CH] !== k) { ok = false; break; } if (ok) h++; }
            for (var hh = 0; hh < h; hh++) for (t = 0; t < w; t++) mask[u + t + (v + hh) * CH] = 0;
            var U0 = bu + u, V0 = bv + v, U1 = U0 + w, V1 = V0 + h, pk = nrm | (k << 3);
            var cs = sgn > 0 ? [U0, V0, U1, V0, U1, V1, U0, V1] : [U0, V0, U0, V1, U1, V1, U1, V0];
            for (var e = 0; e < 4; e++) {
              P[a] = plane; P[ua] = cs[e * 2]; P[va] = cs[e * 2 + 1];
              out.push(P[0], P[1], P[2], pk);
            }
            u += w;
          }
        }
      }
    }
    return out.length ? new Uint16Array(out) : null;
  }

  // ───────────────────────── 矩陣（column-major，WebGL 慣例） ─────────────────────────
  var M4 = {
    ident: function () { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); },
    mul: function (a, b) {
      var o = new Float32Array(16);
      for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++)
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      return o;
    },
    persp: function (fovy, asp, n, f) {
      var t = 1 / Math.tan(fovy / 2), o = new Float32Array(16);
      o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o;
    },
    lookAt: function (e, c, up) {
      var zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
      var xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx; l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
      var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
        -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
    },
    inv: function (m) {
      var o = new Float32Array(16), a = m;
      var b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4], b03 = a[1] * a[6] - a[2] * a[5];
      var b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6], b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12];
      var b08 = a[8] * a[15] - a[11] * a[12], b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
      var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; det = 1 / det;
      o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * det; o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * det;
      o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * det; o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * det;
      o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * det; o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * det;
      o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * det; o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * det;
      o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * det; o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * det;
      o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * det; o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * det;
      o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * det; o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * det;
      o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * det; o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * det;
      return o;
    },
    pt: function (m, x, y, z) { return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; },
    dir: function (m, x, y, z) { return [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z]; }
  };

  // ───────────────────────── 射線（格座標；Amanatides–Woo） ─────────────────────────
  /** 從 o 沿 d（不必單位化）走到 tMax（以 d 的長度為單位），第一個非空格 ⇒ {x,y,z,t,c,face}；沒碰到 ⇒ null。 */
  function raycast(grid, o, d, tMax) {
    var t0 = 0, t1 = tMax, lo = [0, 0, 0], hi = [grid.sx, grid.sy, grid.sz];
    for (var a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-12) { if (o[a] < lo[a] || o[a] >= hi[a]) return null; continue; }
      var ta = (lo[a] - o[a]) / d[a], tb = (hi[a] - o[a]) / d[a];
      if (ta > tb) { var s = ta; ta = tb; tb = s; }
      if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) return null;
    }
    var t = t0 + 1e-6, p = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
    var c = [Math.floor(p[0]), Math.floor(p[1]), Math.floor(p[2])], step = [0, 0, 0], tN = [0, 0, 0], tD = [0, 0, 0], face = -1;
    for (a = 0; a < 3; a++) {
      c[a] = Math.min(hi[a] - 1, Math.max(0, c[a]));
      step[a] = d[a] > 0 ? 1 : -1;
      tD[a] = Math.abs(d[a]) < 1e-12 ? Infinity : Math.abs(1 / d[a]);
      tN[a] = Math.abs(d[a]) < 1e-12 ? Infinity : ((d[a] > 0 ? c[a] + 1 : c[a]) - o[a]) / d[a];
    }
    for (var it = 0; it < 8192; it++) {
      var v = grid.get(c[0], c[1], c[2]);
      if (v) return { x: c[0], y: c[1], z: c[2], t: t, c: v, face: face };
      var m = tN[0] < tN[1] ? (tN[0] < tN[2] ? 0 : 2) : (tN[1] < tN[2] ? 1 : 2);
      t = tN[m]; if (t > t1) return null;
      c[m] += step[m]; tN[m] += tD[m]; face = m * 2 + (step[m] > 0 ? 1 : 0);
      if (c[m] < 0 || c[m] >= hi[m]) return null;
    }
    return null;
  }

  // ───────────────────────── 連通：哪些格跟錨點斷開了 ─────────────────────────
  /**
   * seeds：被打掉那些格的鄰格（打包 x | y<<10 | z<<20）。從每顆種子往外找，先往下（z 小）走：
   * 碰到錨點、或碰到已知連著的格 ⇒ 連著；找完都沒碰到 ⇒ 這一團斷開了。
   * budget：一團超過這麼多格就當連著（⛔ 不讓一次判定卡住畫面 —— 代價是極大的一塊不會掉）。
   * 回：斷開的每一團（Int32Array，打包座標）。
   */
  function detached(grid, seeds, isAnchor, budget) {
    var vis = new Map(), pieces = [];
    function mk(x, y, z) {
      var i = (x >> 4) + grid.nx * ((y >> 4) + grid.ny * (z >> 4)), m = vis.get(i);
      if (!m) { m = new Uint8Array(CH3); vis.set(i, m); }
      return m;
    }
    function getv(x, y, z) { var m = vis.get((x >> 4) + grid.nx * ((y >> 4) + grid.ny * (z >> 4))); return m ? m[(x & 15) | ((y & 15) << 4) | ((z & 15) << 8)] : 0; }
    function setv(x, y, z, v) { mk(x, y, z)[(x & 15) | ((y & 15) << 4) | ((z & 15) << 8)] = v; }
    var NB = [[0, 0, 1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, -1]];   // 往下最後推 ⇒ 最先彈出
    var stack = new Int32Array(1 << 16), list = [];
    for (var si = 0; si < seeds.length; si++) {
      var s = seeds[si], sx = s & 1023, sy = (s >> 10) & 1023, sz = s >> 20;
      if (!grid.get(sx, sy, sz) || getv(sx, sy, sz)) continue;
      var sp = 0, conn = false; list.length = 0;
      stack[sp++] = s; setv(sx, sy, sz, 2); list.push(s);
      outer: while (sp) {
        var p = stack[--sp], x = p & 1023, y = (p >> 10) & 1023, z = p >> 20;
        if (isAnchor(x, y, z)) { conn = true; break; }
        for (var k = 0; k < 6; k++) {
          var nx = x + NB[k][0], ny = y + NB[k][1], nz = z + NB[k][2];
          if (!grid.get(nx, ny, nz)) continue;
          var mv = getv(nx, ny, nz);
          if (mv === 1) { conn = true; break outer; }
          if (mv) continue;
          setv(nx, ny, nz, 2);
          var q = nx | (ny << 10) | (nz << 20);
          if (sp >= stack.length) { var ns = new Int32Array(stack.length * 2); ns.set(stack); stack = ns; }
          stack[sp++] = q; list.push(q);
        }
        if (list.length > budget) { conn = true; break; }
      }
      for (var j = 0; j < list.length; j++) { var r = list[j]; setv(r & 1023, (r >> 10) & 1023, r >> 20, conn ? 1 : 3); }
      if (!conn) pieces.push(Int32Array.from(list));
    }
    return pieces;
  }

  // ───────────────────────── WebGL2 ─────────────────────────
  function compile(gl, vs, fs) {
    function sh(t, src) {
      var s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('著色器編譯失敗：' + gl.getShaderInfoLog(s) + '\n' + src.split('\n').slice(0, 3).join('\n'));
      return s;
    }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('著色器連結失敗：' + gl.getProgramInfoLog(p));
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(p, i), nm = info.name.replace(/\[0\]$/, ''); u[nm] = gl.getUniformLocation(p, info.name); }
    return { prog: p, u: u };
  }

  // 體素著色器：格座標進、世界座標出；邊線與每格明暗是在片段裡從格座標算的（合併過的大面也看得到一格一格）
  var VOXEL_VS = '#version 300 es\n' +
    'layout(location=0) in uvec4 aV;\n' +
    'uniform mat4 uModel, uVP;\n' +
    'out vec3 vL; out vec3 vW; flat out uint vN; flat out uint vC;\n' +
    'void main(){ vec3 p=vec3(aV.xyz); vL=p; vec4 w=uModel*vec4(p,1.0); vW=w.xyz; vN=aV.w&7u; vC=(aV.w>>3u)&255u; gl_Position=uVP*w; }\n';
  var VOXEL_FS = '#version 300 es\nprecision highp float;\n' +
    'in vec3 vL; in vec3 vW; flat in uint vN; flat in uint vC;\n' +
    'uniform mat4 uModel; uniform vec3 uSun, uEye, uFog, uSky, uGround; uniform float uFogD, uWater, uTint;\n' +
    'out vec4 o;\n' +
    'const vec3 NT[6]=vec3[6](vec3(1,0,0),vec3(-1,0,0),vec3(0,1,0),vec3(0,-1,0),vec3(0,0,1),vec3(0,0,-1));\n' +
    'float h3(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453); }\n' +
    'void main(){\n' +
    '  vec3 nl=NT[int(vN)]; vec3 n=normalize(mat3(uModel)*nl);\n' +
    '  vec3 base=vec3(float((vC>>5u)&7u)/7.0, float((vC>>2u)&7u)/7.0, float(vC&3u)/3.0);\n' +
    '  vec3 cell=floor(vL-nl*0.5); base*=0.92+0.16*h3(cell);\n' +
    '  vec3 f=fract(vL); vec3 e=min(f,1.0-f); float ed=min(e.x,e.y);\n' +
    '  if(vN<2u){ ed=min(e.y,e.z); } else if(vN<4u){ ed=min(e.x,e.z); }\n' +
    '  base*=mix(0.82,1.0,smoothstep(0.0,0.09,ed));\n' +
    '  float di=max(dot(n,uSun),0.0); vec3 amb=mix(uGround,uSky,n.y*0.5+0.5);\n' +
    '  vec3 c=base*(amb*0.62+vec3(1.0,0.96,0.88)*di*0.78);\n' +
    '  if(vW.y<uWater){ float dd=clamp((uWater-vW.y)*0.12,0.0,1.0); c=mix(c,vec3(0.04,0.18,0.22),0.35+0.55*dd); }\n' +
    '  c=mix(c,vec3(1.0,0.45,0.2),uTint);\n' +
    '  float fd=length(vW-uEye); c=mix(c,uFog,1.0-exp(-fd*uFogD));\n' +
    '  o=vec4(c,1.0);\n' +
    '}\n';

  /**
   * RegionSet：一份 Grid 的 GPU 端。區塊網格快取在 meshes（區塊索引 → Uint16Array|null），
   * 64³ 一區上傳成一個 VAO。share(other) 讓第二份網格先借用第一份的區（被改到的區才自己建）。
   */
  function RegionSet(gl, grid, quadIbo) {
    this.gl = gl; this.grid = grid; this.ibo = quadIbo;
    this.meshes = new Map(); this.regions = new Map(); this.dirty = new Set(); this.dirtyRegions = new Set();
    this.rx = Math.ceil(grid.nx / 4); this.ry = Math.ceil(grid.ny / 4);
  }
  RegionSet.prototype.rkey = function (cx, cy, cz) { return (cx >> 2) + this.rx * ((cy >> 2) + this.ry * (cz >> 2)); };
  RegionSet.prototype.buildAll = function () {
    var g = this.grid;
    for (var cz = 0; cz < g.nz; cz++) for (var cy = 0; cy < g.ny; cy++) for (var cx = 0; cx < g.nx; cx++) {
      var i = g.ci(cx, cy, cz); if (g.tab[i] === null) continue;
      this.meshes.set(i, meshChunk(g, cx, cy, cz)); this.dirtyRegions.add(this.rkey(cx, cy, cz));
    }
    this.flush();
  };
  /** 跟另一份（同一份資料長出來的）共用網格與區；之後被改到的才各自重建。 */
  RegionSet.prototype.shareFrom = function (o) {
    var self = this;
    o.meshes.forEach(function (m, k) { self.meshes.set(k, m); });
    o.regions.forEach(function (r, k) { self.regions.set(k, { vao: r.vao, vbo: r.vbo, n: r.n, own: false }); });
  };
  /** 一格改了 ⇒ 它的區塊（貼邊的話連鄰區塊）要重網格化。 */
  RegionSet.prototype.touch = function (x, y, z) {
    var g = this.grid, cx = x >> 4, cy = y >> 4, cz = z >> 4, lx = x & 15, ly = y & 15, lz = z & 15;
    this.dirty.add(g.ci(cx, cy, cz));
    if (lx === 0 && cx > 0) this.dirty.add(g.ci(cx - 1, cy, cz)); if (lx === 15 && cx < g.nx - 1) this.dirty.add(g.ci(cx + 1, cy, cz));
    if (ly === 0 && cy > 0) this.dirty.add(g.ci(cx, cy - 1, cz)); if (ly === 15 && cy < g.ny - 1) this.dirty.add(g.ci(cx, cy + 1, cz));
    if (lz === 0 && cz > 0) this.dirty.add(g.ci(cx, cy, cz - 1)); if (lz === 15 && cz < g.nz - 1) this.dirty.add(g.ci(cx, cy, cz + 1));
  };
  RegionSet.prototype.flush = function () {
    var g = this.grid, self = this;
    this.dirty.forEach(function (i) {
      var cx = i % g.nx, cy = Math.floor(i / g.nx) % g.ny, cz = Math.floor(i / (g.nx * g.ny));
      self.meshes.set(i, meshChunk(g, cx, cy, cz)); self.dirtyRegions.add(self.rkey(cx, cy, cz));
    });
    this.dirty.clear();
    var gl = this.gl;
    this.dirtyRegions.forEach(function (rk) {
      var rx = rk % self.rx, ry = Math.floor(rk / self.rx) % self.ry, rz = Math.floor(rk / (self.rx * self.ry));
      var parts = [], len = 0;
      for (var cz = rz * 4; cz < Math.min(g.nz, rz * 4 + 4); cz++) for (var cy = ry * 4; cy < Math.min(g.ny, ry * 4 + 4); cy++)
        for (var cx = rx * 4; cx < Math.min(g.nx, rx * 4 + 4); cx++) { var m = self.meshes.get(g.ci(cx, cy, cz)); if (m) { parts.push(m); len += m.length; } }
      var r = self.regions.get(rk);
      if (!len) { if (r && r.own) { gl.deleteBuffer(r.vbo); gl.deleteVertexArray(r.vao); } self.regions.delete(rk); return; }
      var all = new Uint16Array(len), o = 0;
      parts.forEach(function (m) { all.set(m, o); o += m.length; });
      if (!r || !r.own) {
        r = { vao: gl.createVertexArray(), vbo: gl.createBuffer(), n: 0, own: true };
        gl.bindVertexArray(r.vao); gl.bindBuffer(gl.ARRAY_BUFFER, r.vbo);
        gl.enableVertexAttribArray(0); gl.vertexAttribIPointer(0, 4, gl.UNSIGNED_SHORT, 8, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, self.ibo.buf); gl.bindVertexArray(null);
        self.regions.set(rk, r);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, r.vbo); gl.bufferData(gl.ARRAY_BUFFER, all, gl.DYNAMIC_DRAW);
      r.n = len / 16; self.ibo.ensure(r.n);
    });
    this.dirtyRegions.clear();
  };
  RegionSet.prototype.quads = function () { var n = 0; this.regions.forEach(function (r) { n += r.n; }); return n; };
  RegionSet.prototype.draw = function () {
    var gl = this.gl;
    this.regions.forEach(function (r) { gl.bindVertexArray(r.vao); gl.drawElements(gl.TRIANGLES, r.n * 6, gl.UNSIGNED_INT, 0); });
    gl.bindVertexArray(null);
  };
  RegionSet.prototype.dispose = function () {
    var gl = this.gl;
    this.regions.forEach(function (r) { if (r.own) { gl.deleteBuffer(r.vbo); gl.deleteVertexArray(r.vao); } });
    this.regions.clear();
  };

  /** 共用的四邊形索引（0,1,2,0,2,3, 4,5,6,…）；不夠長就就地加長（同一個 buffer 物件 ⇒ 各 VAO 的綁定不用重設）。 */
  function QuadIndex(gl) { this.gl = gl; this.buf = gl.createBuffer(); this.cap = 0; this.ensure(1 << 16); }
  QuadIndex.prototype.ensure = function (n) {
    if (n <= this.cap) return;
    var cap = Math.max(n, this.cap * 2), a = new Uint32Array(cap * 6);
    for (var i = 0; i < cap; i++) { var b = i * 4, o = i * 6; a[o] = b; a[o + 1] = b + 1; a[o + 2] = b + 2; a[o + 3] = b; a[o + 4] = b + 2; a[o + 5] = b + 3; }
    var gl = this.gl; gl.bindVertexArray(null); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, a, gl.STATIC_DRAW);
    this.cap = cap;
  };

  root.VoxelKit = {
    CHUNK: CH, rgb332: rgb332, hashVoxel: hashVoxel,
    b64ToBytes: b64ToBytes, inflateRaw: inflateRaw, parse: parse, decode: decode, loadEmbedded: loadEmbedded,
    embeddedImage: embeddedImage, embeddedJSON: embeddedJSON,
    Grid: Grid, verify: verify, meshChunk: meshChunk, M4: M4, raycast: raycast, detached: detached,
    compile: compile, VOXEL_VS: VOXEL_VS, VOXEL_FS: VOXEL_FS, RegionSet: RegionSet, QuadIndex: QuadIndex,
    pack: function (x, y, z) { return x | (y << 10) | (z << 20); }
  };
})(typeof window !== 'undefined' ? window : this);
