# -*- coding: utf-8 -*-
"""《Blockside》宣傳片：逐格錄成影片檔（WebM：VP9 ＋ Opus；YouTube 收）—— 不掉格。

用法（python -I）：
  python -I record.py [--page <成品 .html>] [--out <輸出 .webm>] [--fps 60] [--from 秒] [--to 秒]
                      [--vbr 24000000] [--abr 256000] [--port 8870] [--no-launch] [--headless] [--chrome <chrome.exe>]

  預設：錄 ../../kaguya_blockside_trailer.html（畫廊裡那一份）整支、1080p、60 fps，寫到「影片」資料夾的 kaguya_blockside_trailer_60fps.webm。
  先錄一小段試：python -I record.py --from 125 --to 135
  2026-10-19 量（這台機器、無頭 Chrome、1080p）：一秒算約 22 格 ⇒ 整支 60 fps（約 26,000 格）約 20 多分鐘，再加聲音 1 倍速重播約 7 分鐘；
    VP9 平均約 22 Mbps（整支約 1.2 GB）。22 秒試錄：660 格、11 個 Cluster、索引 11 點；音效事件 630、峰值 0.97、削波 0。
  2026-10-28 錄整支（8:38、31,062 格，Chrome 視窗、用顯示卡）：畫面 13.1 分鐘（一秒約 40 格）＋聲音 1 倍速重播 ⇒ 共 22.8 分鐘；VP9 平均 26.5 Mbps、1.73 GB。

怎麼做到不掉格（Tim 2026-10-19：「確保錄製不掉fps的影片(或是掉了之後可後處理讓影片順暢)」）：
  片子是片長 t 的純函數 ⇒ 不即時播放、不用螢幕錄影。record.js 讓頁面一格一格算到 t ＝ from ＋ k／fps、畫好、交給瀏覽器的 WebCodecs 編碼；
  一格算多久都沒關係，每一格都是真的算出來的（不是補出來的）。聲音照同一條時間軸另外錄（record.js 的說明）。

做的事：
  1. 讀成品，把 record.js 注入遊戲閉包（插在導演程式最後、閉包結尾前）—— 只在記憶體裡，畫廊那一份不動、也不帶錄影程式。
  2. 開本機伺服器（127.0.0.1:port）：GET /trailer.html 給注入過的那一份；POST /rec/… 收編好的片段（先寫進暫存檔）。
  3. 開一個 Chrome 視窗（獨立的使用者資料夾、用顯示卡、不會被節流）打開錄影網址；--no-launch ⇒ 只印網址，自己開。
  4. 頁面說做完了 ⇒ 寫成 WebM（EBML 自己寫，不用 ffmpeg）、關掉 Chrome、印讀數。
⛔ 錄影時那個視窗別最小化（顯示卡在最小化的視窗裡可能不畫）。
"""
import argparse
import base64
import http.server
import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

MARK = '// ── trailer/scenes.js ──'
CLOSE = '})();'
CHROMES = [r'C:/Program Files/Google/Chrome/Application/chrome.exe', r'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
           os.path.expandvars(r'%LOCALAPPDATA%/Google/Chrome/Application/chrome.exe')]


def fail(msg):
    print('✗ ' + msg)
    sys.exit(1)


def inject(page):
    """成品 ＋ record.js（插在 scenes.js 那一段之後、遊戲閉包結尾的 })(); 前面）。"""
    with open(page, 'rb') as f:
        html = f.read().decode('utf-8')
    with open(os.path.join(HERE, 'record.js'), 'r', encoding='utf-8') as f:
        rec = f.read()
    if html.count(MARK) != 1:
        fail('成品裡找不到（或不只一個）%s —— 是不是不是 splice.py 拼的宣傳片？' % MARK)
    i = html.index(MARK)
    j = html.find('\n' + CLOSE, i)
    if j < 0:
        fail('成品裡 scenes.js 之後找不到遊戲閉包的結尾')
    if 'var TR_REC' in html:
        fail('成品裡已經有錄影程式（TR_REC）—— 發佈的成品不該帶它')
    return html[:j + 1] + '// ── trailer/record.js（record.py 錄影時才注入）──\n' + rec.rstrip('\n') + '\n' + html[j + 1:]


# ───────────────────────── WebM（Matroska 的子集）─────────────────────────
def vint_size(n):
    """EBML 的長度：k 個位元組，最高位起第 k 個位元是標記（全 1 保留給「不知道多長」⇒ 要 < 2^(7k) − 1）。"""
    for k in range(1, 9):
        if n < (1 << (7 * k)) - 1:
            return (n | (1 << (7 * k))).to_bytes(k, 'big')
    raise ValueError(n)


def ebml_id(i):
    return i.to_bytes((i.bit_length() + 7) // 8, 'big')


def el(i, payload):
    return ebml_id(i) + vint_size(len(payload)) + payload


def u(i, v):
    n = max(1, (v.bit_length() + 7) // 8)
    return el(i, v.to_bytes(n, 'big'))


def f64(i, v):
    return el(i, struct.pack('>d', v))


def s(i, v):
    return el(i, v.encode('utf-8'))


def opus_head(channels, sr, preskip=312):
    return b'OpusHead' + struct.pack('<BBHIhB', 1, channels, preskip, sr, 0, 0)


def write_webm(out, meta, vids, auds, vdata, adata):
    """vids／auds：[(ts 微秒, key, offset, size)]（已照 seq 排好）；vdata／adata：暫存檔路徑。"""
    fps, w, h = meta['fps'], meta['w'], meta['h']
    au = meta.get('audio') or {}
    head = base64.b64decode(au['description']) if au.get('description') else opus_head(au.get('channels', 2), au.get('sampleRate', 48000))
    if head[:8] != b'OpusHead':
        head = opus_head(au.get('channels', 2), au.get('sampleRate', 48000))
    preskip = struct.unpack('<H', head[10:12])[0]
    dur_ms = (meta['t1'] - meta['t0']) * 1000.0
    ebml = el(0x1A45DFA3, u(0x4286, 1) + u(0x42F7, 1) + u(0x42F2, 4) + u(0x42F3, 8) + s(0x4282, 'webm') + u(0x4287, 4) + u(0x4285, 2))
    info = el(0x1549A966, u(0x2AD7B1, 1000000) + s(0x4D80, 'kaguya record.py') + s(0x5741, 'kaguya record.py (WebCodecs)') + f64(0x4489, dur_ms))
    vtrack = el(0xAE, u(0xD7, 1) + u(0x73C5, 1) + u(0x83, 1) + u(0x9C, 0) + s(0x86, 'V_VP9') + u(0x23E383, int(round(1e9 / fps))) + el(0xE0, u(0xB0, w) + u(0xBA, h)))
    atrack = el(0xAE, u(0xD7, 2) + u(0x73C5, 2) + u(0x83, 2) + u(0x9C, 0) + s(0x86, 'A_OPUS') + el(0x63A2, head) + u(0x56AA, int(round(preskip * 1e9 / 48000))) + u(0x56BB, 80000000)
                 + el(0xE1, f64(0xB5, float(au.get('sampleRate', 48000))) + u(0x9F, au.get('channels', 2))))
    tracks = el(0x1654AE6B, vtrack + atrack)
    # 區塊照時間排；遇到影像關鍵格開新的 Cluster（區塊的相對時間是 int16 毫秒 ⇒ 一個 Cluster 不超過 32 秒；兩秒一個關鍵格）
    ev = [(ts, 0, key, off, n) for ts, key, off, n in vids] + [(ts, 1, 1, off, n) for ts, key, off, n in auds]
    ev.sort(key=lambda e: (e[0], e[1]))
    def seekhead(pos):                                                  # SeekPosition 固定 8 位元組 ⇒ 先寫、最後回填
        return el(0x114D9B74, b''.join(el(0x4DBB, el(0x53AB, ebml_id(i)) + el(0x53AC, p.to_bytes(8, 'big'))) for i, p in pos))
    with open(out + '.tmp', 'wb') as fo, open(vdata, 'rb') as fv, open(adata, 'rb') as fa:
        fo.write(ebml)
        fo.write(ebml_id(0x18538067) + b'\x01' + b'\x00' * 7)            # Segment：大小先佔 8 位元組，寫完回填
        seg0 = fo.tell()
        fo.write(seekhead([(0x1549A966, 0), (0x1654AE6B, 0), (0x1C53BB6B, 0)]))
        p_info = fo.tell() - seg0
        fo.write(info)
        p_tracks = fo.tell() - seg0
        fo.write(tracks)
        cluster, ctc, nclu, cues = [], None, 0, []

        def flush():
            nonlocal cluster, nclu
            if cluster:
                cues.append((ctc, fo.tell() - seg0))                    # 索引（Cues）：每個 Cluster 都從影像關鍵格開始 ⇒ 播放器跳秒跳得準（⛔ 沒有它，Chrome 跳秒停在第一個關鍵格）
                fo.write(el(0x1F43B675, u(0xE7, ctc) + b''.join(cluster)))
                nclu += 1
            cluster = []
        for ts, tr, key, off, n in ev:
            ms = int(round(ts / 1000.0))
            if ctc is None or (tr == 0 and key) or ms - ctc > 30000:
                flush()
                ctc = ms
            (fv if tr == 0 else fa).seek(off)
            data = (fv if tr == 0 else fa).read(n)
            rel = ms - ctc
            blk = bytes([0x81 + tr]) + struct.pack('>hB', rel, 0x80 if key else 0) + data
            cluster.append(el(0xA3, blk))
        flush()
        p_cues = fo.tell() - seg0
        fo.write(el(0x1C53BB6B, b''.join(el(0xBB, u(0xB3, t) + el(0xB7, u(0xF7, 1) + u(0xF1, p))) for t, p in cues)))
        end = fo.tell()
        fo.seek(seg0 - 8)
        fo.write(b'\x01' + (end - seg0).to_bytes(7, 'big'))
        fo.seek(seg0)
        fo.write(seekhead([(0x1549A966, p_info), (0x1654AE6B, p_tracks), (0x1C53BB6B, p_cues)]))
    os.replace(out + '.tmp', out)
    return nclu


# ───────────────────────── 伺服器 ─────────────────────────
class Rec:
    def __init__(self, html, tmp):
        self.html = html.encode('utf-8')
        self.lock = threading.Lock()
        self.vf = open(os.path.join(tmp, 'v.bin'), 'wb')
        self.af = open(os.path.join(tmp, 'a.bin'), 'wb')
        self.vi, self.ai = [], []
        self.seen = {'v': set(), 'a': set()}                            # 頁面重送的片段（回應掉了、其實收到了）照序號只收一次
        self.meta, self.done, self.err = None, threading.Event(), None
        self.vbytes = 0


def handler_for(R):
    class H(http.server.BaseHTTPRequestHandler):
        # HTTP/1.1 ⇒ 瀏覽器重用連線（⛔ 預設 1.0：每格一條新連線、回完就關 ⇒ 整支三萬多條，佇列一擠爆 Windows 就把連線打回去，
        #   頁面只看到 Failed to fetch —— 2026-10-28 第一次錄整支，城建好之後斷在半路）；每個回應都要帶 Content-Length
        protocol_version = 'HTTP/1.1'

        def log_message(self, *a):
            pass

        def do_GET(self):
            p = urllib.parse.urlparse(self.path).path
            if p in ('/', '/trailer.html'):
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Cache-Control', 'no-store')
                self.send_header('Content-Length', str(len(R.html)))
                self.end_headers()
                self.wfile.write(R.html)
            else:
                self.send_response(404)
                self.send_header('Content-Length', '0')
                self.end_headers()

        def do_POST(self):
            url = urllib.parse.urlparse(self.path)
            q = dict(urllib.parse.parse_qsl(url.query))
            n = int(self.headers.get('Content-Length') or 0)
            body = self.rfile.read(n) if n else b''
            kind = url.path.rsplit('/', 1)[-1]
            with R.lock:
                if kind in ('v', 'a') and int(q['seq']) in R.seen[kind]:
                    pass
                elif kind in ('v', 'a'):
                    f, idx = (R.vf, R.vi) if kind == 'v' else (R.af, R.ai)
                    off = f.tell()
                    f.write(body)
                    idx.append((int(q['seq']), int(q['ts']), int(q.get('key', '1')), off, len(body)))
                    R.seen[kind].add(int(q['seq']))
                    if kind == 'v':
                        R.vbytes += len(body)
                elif kind == 'log':
                    print('  · ' + body.decode('utf-8', 'replace'), flush=True)
                elif kind == 'begin':
                    R.meta = json.loads(body)
                elif kind == 'done':
                    d = json.loads(body)
                    R.meta.update(d)
                    R.done.set()
                elif kind == 'err':
                    R.err = body.decode('utf-8', 'replace')
                    print('✗ 頁面回報錯誤：' + R.err, flush=True)
                    R.done.set()
            self.send_response(204)
            self.send_header('Content-Length', '0')
            self.end_headers()
    return H


class RecServer(http.server.ThreadingHTTPServer):
    request_queue_size = 64                                             # 頁面同時最多 24 個 POST 在路上（⛔ 預設 5）
    daemon_threads = True

    def handle_error(self, request, client_address):
        if isinstance(sys.exc_info()[1], (ConnectionResetError, ConnectionAbortedError, BrokenPipeError)):
            return                                                      # 錄完關掉 Chrome 時，保持著的連線被切斷：不是錯
        super().handle_error(request, client_address)


def main():
    ap = argparse.ArgumentParser(description='宣傳片逐格錄成 WebM（不掉格）')
    ap.add_argument('--page', default=os.path.normpath(os.path.join(HERE, '..', '..', 'kaguya_blockside_trailer.html')))
    ap.add_argument('--out', default=None)
    ap.add_argument('--fps', type=int, default=60)
    ap.add_argument('--from', dest='t0', type=float, default=None)
    ap.add_argument('--to', dest='t1', type=float, default=None)
    ap.add_argument('--vbr', type=int, default=24000000)
    ap.add_argument('--abr', type=int, default=256000)
    ap.add_argument('--port', type=int, default=8870)
    ap.add_argument('--no-launch', action='store_true')
    ap.add_argument('--headless', action='store_true', help='無頭 Chrome（只拿來試流程：沒有顯示卡，很慢）')
    ap.add_argument('--chrome', default=None)
    a = ap.parse_args()
    # 預設寫到使用者的「影片」資料夾（整支 60 fps 約 1.3 GB ⇒ ⛔ 不要寫進 repo）
    out = a.out or os.path.join(os.path.expanduser('~'), 'Videos', 'kaguya_blockside_trailer_%dfps%s.webm' % (a.fps, '' if a.t0 is None and a.t1 is None else '_%s-%s' % (a.t0 or 0, a.t1 if a.t1 is not None else 'end')))
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    html = inject(a.page)
    tmp = tempfile.mkdtemp(prefix='trrec_')
    R = Rec(html, tmp)
    srv = RecServer(('127.0.0.1', a.port), handler_for(R))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    qs = {'rec': '1', 'res': '1080', 'fps': str(a.fps), 'vbr': str(a.vbr), 'abr': str(a.abr)}
    if a.t0 is not None:
        qs['from'] = str(a.t0)
    if a.t1 is not None:
        qs['to'] = str(a.t1)
    url = 'http://127.0.0.1:%d/trailer.html?%s' % (a.port, urllib.parse.urlencode(qs))
    print('· 成品：%s' % a.page)
    print('· 錄影網址：%s' % url)
    proc, prof = None, None
    if not a.no_launch:
        chrome = a.chrome or next((c for c in CHROMES if os.path.exists(c)), None)
        if not chrome:
            fail('找不到 Chrome（--chrome 指定，或 --no-launch 自己開網址）')
        prof = tempfile.mkdtemp(prefix='trrec_chrome_')
        args = [chrome, '--user-data-dir=' + prof, '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required',
                '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']
        args += ['--headless=new', '--window-size=1280,720'] if a.headless else ['--window-size=1280,760', '--app=' + url]
        if a.headless:
            args.append(url)
        proc = subprocess.Popen(args)
        print('· 開了 Chrome（%s）；錄影時這個視窗別最小化' % ('無頭' if a.headless else '視窗'))
    t_start = time.time()
    try:
        while not R.done.wait(1.0):
            pass
    except KeyboardInterrupt:
        print('✗ 中斷')
        R.err = R.err or '中斷'
    finally:
        if proc:
            proc.terminate()
        srv.shutdown()
        R.vf.close()
        R.af.close()
    if R.err or not R.meta:
        fail('沒錄完：%s' % (R.err or '頁面沒有說開始'))
    m = R.meta
    vids = [(ts, key, off, n) for seq, ts, key, off, n in sorted(R.vi)]
    auds = [(ts, key, off, n) for seq, ts, key, off, n in sorted(R.ai)]
    if len(vids) != m['frames']:
        print('⚠ 影像片段 %d 個，畫面 %d 格（對不上）' % (len(vids), m['frames']))
    nclu = write_webm(out, m, vids, auds, os.path.join(tmp, 'v.bin'), os.path.join(tmp, 'a.bin'))
    size = os.path.getsize(out)
    au = m.get('audio') or {}
    print('✓ 寫出 %s（%.1f MB）' % (out, size / 1e6))
    print('  · 畫面 %d 格 @ %d fps（%.2f → %.2f 秒，%dx%d，%s，平均 %.1f Mbps），%d 個 Cluster' % (
        m['frames'], m['fps'], m['t0'], m['t1'], m['w'], m['h'], m['vcodec'], R.vbytes * 8 / max(1e-6, m['t1'] - m['t0']) / 1e6, nclu))
    print('  · 聲音 Opus %d 段（峰值 %s、削波 %s 樣本、晚排的事件 %s）；音效事件 %s、環境音 %s 筆' % (
        len(auds), au.get('peak'), au.get('clip'), au.get('late'), m.get('sfx'), m.get('amb')))
    print('  · 花了 %.1f 分' % ((time.time() - t_start) / 60))
    shutil.rmtree(tmp, ignore_errors=True)
    if prof:
        shutil.rmtree(prof, ignore_errors=True)


if __name__ == '__main__':
    main()
