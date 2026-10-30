# -*- coding: utf-8 -*-
"""《方舷放置 Sharkside》宣傳片：逐格錄成 MP4（H.264 ＋ AAC；YouTube、手機、噗浪都收）—— 不掉格。

  Tim 2026-10-30：「參考 D:\\Unity\\Blocksail\\trailer.sh 也加一個工具可以直接把宣傳片輸出成影片吧」
  做法移植自 kaguya 的 Blockside 宣傳片 record.py／record.js（逐格算畫面；聲音改成照事件表離線算）；封裝照 Blocksail 的 trailer.sh 改成 MP4（mp4.js 照抄 Blocksail）。

用法（python -I；一般用 record.sh）：
  python -I record.py [--page <成品 .html>] [--out <資料夾>] [--name <檔名>] [--fps 60] [--from 秒] [--to 秒] [--ss 1.5] [--gfx ultra]
                      [--vbr <bps>] [--abr 192000] [--port 8871] [--chrome <chrome.exe>] [--headless] [--no-launch]

  預設：錄 ../../gura_sharkside_trailer.html（畫廊裡那一份）整支、1080p60，存到 ~/Videos/Sharkside/sharkside-trailer-1080p60-<日期>-<時間>.mp4。
  先錄一小段試：python -I record.py --from 14 --to 20

做的事：
  1. 讀成品，把 mp4.js ＋ record.js 注入遊戲閉包（插在 scenes.js 那一段之後、閉包結尾前）—— 只在記憶體裡，畫廊那一份不動、也不帶錄影程式。
  2. 開本機伺服器（127.0.0.1:port）：GET /trailer.html 給注入過的那一份；POST /rec/log、/rec/err 印在這個視窗；POST /rec/video 收 MP4（一段一段寫成 .part、寫完改名）。
  3. 開一個 Chrome 視窗（暫時的使用者資料夾、用顯示卡、被蓋住或在背景都不降速）打開錄影網址；--no-launch ⇒ 只印網址，自己開。
  4. 收到 MP4 或頁面報錯 ⇒ 關掉 Chrome、收掉暫存、印讀數；結束碼 0 ＝ 存好了。
⛔ 錄影時那個視窗別最小化（顯示卡在最小化的視窗裡可能不畫），也別關掉；Ctrl+C ⇒ 全部收掉。
"""
import argparse
import http.server
import os
import re
import shutil
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
CLOSE = '\n})();'
CHROMES = [r'C:/Program Files/Google/Chrome/Application/chrome.exe', r'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
           os.path.expandvars(r'%LOCALAPPDATA%/Google/Chrome/Application/chrome.exe'),
           r'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', r'C:/Program Files/Microsoft/Edge/Application/msedge.exe']


def fail(msg):
    print('✗ ' + msg, flush=True)
    sys.exit(1)


def say(s):
    print(s, flush=True)


def inject(page):
    """成品 ＋ mp4.js ＋ record.js（插在 scenes.js 那一段之後、核心閉包結尾的 })(); 前面）。"""
    with open(page, 'rb') as f:
        html = f.read().decode('utf-8')
    if html.count(MARK) != 1:
        fail('成品裡找不到（或不只一個）%s —— 是不是不是 splice.py 拼的宣傳片？' % MARK)
    j = html.find(CLOSE, html.index(MARK))
    if j < 0:
        fail('scenes.js 後面找不到閉包的結尾 })();')
    add = []
    for name in ('mp4.js', 'record.js'):
        with open(os.path.join(HERE, name), 'r', encoding='utf-8') as f:
            add.append('// ── trailer/%s（record.py 錄影時才注入）──\n' % name + f.read().rstrip('\n') + '\n')
    return (html[:j] + '\n' + ''.join(add) + html[j:]).encode('utf-8')


class Rec:
    def __init__(self, html, out, name):
        self.html, self.out, self.name = html, out, name
        self.code = None
        self.path = None
        self.done = threading.Event()

    def finish(self, code):
        if self.code is None:
            self.code = code
        self.done.set()


def handler_for(R):
    class H(http.server.BaseHTTPRequestHandler):
        protocol_version = 'HTTP/1.1'

        def log_message(self, *a):
            pass

        def reply(self, code=200, body=b'ok', ctype='text/plain; charset=utf-8'):
            self.send_response(code)
            self.send_header('Content-Type', ctype)
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body)

        def text(self):
            n = int(self.headers.get('Content-Length') or 0)
            return self.rfile.read(n).decode('utf-8', 'replace') if n else ''

        def do_GET(self):
            u = urllib.parse.urlparse(self.path)
            if u.path == '/trailer.html':
                self.reply(200, R.html, 'text/html; charset=utf-8')
            elif u.path == '/favicon.ico':
                self.reply(204, b'')
            else:
                self.reply(200, b'ok')

        def do_POST(self):
            u = urllib.parse.urlparse(self.path)
            if u.path == '/rec/log':
                say('  ' + self.text().strip()); self.reply(); return
            if u.path == '/rec/err':
                say('✗ 頁面報錯：' + self.text().strip()); self.reply(); R.finish(1); return
            if u.path == '/rec/video':
                os.makedirs(R.out, exist_ok=True)
                path = os.path.join(R.out, R.name)
                part = path + '.part'
                left = int(self.headers.get('Content-Length') or 0)
                with open(part, 'wb') as f:                              # 一段一段寫（兩三百 MB，不整個讀進記憶體）
                    while left > 0:
                        b = self.rfile.read(min(left, 1 << 20))
                        if not b:
                            break
                        f.write(b)
                        left -= len(b)
                if left > 0:
                    self.reply(400, b'short'); say('✗ 影片沒收完整（少 %d bytes）' % left); R.finish(1); return
                os.replace(part, path)
                R.path = path
                self.reply()
                R.finish(0)
                return
            self.reply(404, b'?')

    return H


class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request, client_address):
        if isinstance(sys.exc_info()[1], (ConnectionResetError, BrokenPipeError, ConnectionAbortedError)):
            return                                                       # 收掉 Chrome 時還開著的連線（keep-alive）被切斷 ⇒ 不算錯
        super().handle_error(request, client_address)


def mp4_probe(path):
    """讀回存好的檔：最上層的 box、moov 裡兩條軌的類型與時長（不靠 ffprobe）。"""
    import struct
    out = {'boxes': [], 'tracks': []}
    with open(path, 'rb') as f:
        data_len = os.path.getsize(path)
        pos = 0
        moov = None
        while pos < data_len:
            f.seek(pos)
            h = f.read(16)
            if len(h) < 8:
                break
            size, typ = struct.unpack('>I4s', h[:8])
            if size == 1:
                size = struct.unpack('>Q', h[8:16])[0]
            out['boxes'].append(typ.decode('latin-1'))
            if typ == b'moov':
                f.seek(pos)
                moov = f.read(size)
            if size < 8:
                break
            pos += size
    if moov:
        i = 0
        while True:
            i = moov.find(b'mdhd', i)
            if i < 0:
                break
            ver = moov[i + 4]
            if ver == 1:
                ts, dur = struct.unpack('>IQ', moov[i + 24:i + 36])
            else:
                ts, dur = struct.unpack('>II', moov[i + 16:i + 24])
            hd = moov.find(b'hdlr', i)
            kind = moov[hd + 12:hd + 16].decode('latin-1') if hd > 0 else '?'
            out['tracks'].append((kind, dur / ts if ts else 0))
            i += 4
    return out


def main():
    ap = argparse.ArgumentParser(description='方舷放置宣傳片：逐格錄成 MP4')
    ap.add_argument('--page', default=os.path.normpath(os.path.join(HERE, '..', '..', 'gura_sharkside_trailer.html')))
    ap.add_argument('--out', default=os.path.join(os.path.expanduser('~'), 'Videos', 'Sharkside'))
    ap.add_argument('--name', default=None, help='檔名（預設 sharkside-trailer-1080p<fps>-<日期>-<時間>.mp4）')
    ap.add_argument('--fps', type=int, default=60, choices=[30, 60])
    ap.add_argument('--from', dest='t0', type=float, default=None)
    ap.add_argument('--to', dest='t1', type=float, default=None)
    ap.add_argument('--ss', type=float, default=1.5, help='超取樣：3D 照幾倍算再縮成 1920×1080（1～2；1 ＝ 不超取樣，試錄快）')
    ap.add_argument('--gfx', default='ultra', choices=['low', 'mid', 'high', 'ultra'], help='畫質（預設全開；畫廊播放是 high）')
    ap.add_argument('--vbr', type=int, default=0, help='影像位元率（bps；預設 寬×高×fps×0.17 ≈ 21 Mbps＠1080p60）')
    ap.add_argument('--abr', type=int, default=192000)
    ap.add_argument('--port', type=int, default=8871)
    ap.add_argument('--chrome', default=None)
    ap.add_argument('--headless', action='store_true', help='無頭 Chrome（只拿來試流程）')
    ap.add_argument('--no-launch', action='store_true')
    a = ap.parse_args()

    if not os.path.exists(a.page):
        fail('找不到成品：%s' % a.page)
    name = a.name or 'sharkside-trailer-1080p%d-%s.mp4' % (a.fps, time.strftime('%Y%m%d-%H%M'))
    name = re.sub(r'[\\/:*?"<>|\x00-\x1f]', '_', os.path.basename(name))
    if not name.lower().endswith('.mp4'):
        name += '.mp4'
    out = os.path.abspath(a.out)
    R = Rec(inject(a.page), out, name)
    try:
        srv = Server(('127.0.0.1', a.port), handler_for(R))
    except OSError:
        fail('埠 %d 被佔了（換一個：--port 8872）' % a.port)
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    q = {'rec': 1, 'res': 1080, 'fps': a.fps, 'ss': a.ss, 'gfx': a.gfx, 'abr': a.abr, 'name': name}
    if a.t0 is not None:
        q['from'] = a.t0
    if a.t1 is not None:
        q['to'] = a.t1
    if a.vbr:
        q['vbr'] = a.vbr
    url = 'http://127.0.0.1:%d/trailer.html?%s' % (a.port, urllib.parse.urlencode(q))
    say('· 成品：%s（%.1f MB，注入 mp4.js ＋ record.js）' % (a.page, len(R.html) / 1048576))
    say('· 存到：%s' % os.path.join(out, name))

    proc, prof = None, None
    if a.no_launch:
        say('· 自己用 Chrome／Edge 打開：' + url)
    else:
        chrome = a.chrome or next((c for c in CHROMES if os.path.exists(c)), None)
        if not chrome:
            fail('找不到 Chrome 或 Edge（--chrome 指定，或 --no-launch 自己開網址）')
        prof = tempfile.mkdtemp(prefix='shk_rec_chrome_')
        args = [chrome, '--user-data-dir=' + prof, '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required',
                '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
                '--disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling']
        args += ['--headless=new', '--window-size=1280,720', url] if a.headless else ['--window-size=1280,760', '--app=' + url]
        say('· 開 %s（錄的時候那個視窗可以蓋住，別最小化、別關；Ctrl+C ⇒ 全部收掉）' % os.path.basename(chrome))
        proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    T0 = time.time()
    try:
        while not R.done.wait(1.0):
            if proc and proc.poll() is not None:
                say('✗ 瀏覽器自己關掉了（結束碼 %s）' % proc.returncode)
                R.finish(1)
    except KeyboardInterrupt:
        say('✗ 中斷')
        R.finish(130)
    finally:
        if proc and proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(10)
            except Exception:
                proc.kill()
        srv.shutdown()
        if prof:
            time.sleep(1.0)
            shutil.rmtree(prof, ignore_errors=True)

    el = time.time() - T0
    if R.code == 0 and R.path:
        p = mp4_probe(R.path)
        tr = '、'.join('%s %.2f 秒' % (k, d) for k, d in p['tracks'])
        say('✓ 存好了：%s（%.1f MB；box %s；軌 %s）' % (R.path, os.path.getsize(R.path) / 1048576, ' '.join(p['boxes']), tr))
        say('· 全部花了 %d 分 %d 秒' % (el // 60, el % 60))
    else:
        for f in os.listdir(out) if os.path.isdir(out) else []:
            if f == name + '.part':
                os.remove(os.path.join(out, f))
    sys.exit(R.code if R.code is not None else 1)


if __name__ == '__main__':
    main()
