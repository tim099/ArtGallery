# -*- coding: utf-8 -*-
"""《Blockside》宣傳片：把遊戲成品 index.html 複製一份，打上預告片補丁，接上導演程式與播放器外殼 ⇒ 影片檔。

用法（python -I）：
  python -I splice.py <遊戲成品 index.html> <輸出 .html> [--src <來源說明>]

做的事（每一步對不上就停、不寫輸出檔）：
  1. 讀遊戲成品（Blockside 的 index.html，整份照原位元組；換行不動）。
  2. 照 PATCHES 打錨點補丁：每個錨點在成品裡**剛好出現一次**，不是一次 ⇒ 停（遊戲改版、錨點漂了，要人來看）。
  3. director.js 插在遊戲閉包最後的 `})();` 前面（同一個閉包 ⇒ 看得到遊戲的全部變數）。
  4. shell.html（播放器外殼：樣式、字幕層、控制列、片尾按鈕）插在 </body> 前面。
  5. 照 Blockside 的 vxk_inline.py 同一套檢查零外部依賴（外部 script src／fetch／import／http(s) 資源）。
  6. 寫輸出檔；印讀數（大小、補丁數、來源指紋）。

⛔ 不改遊戲本體的原始碼：補丁只打在這份複製上。遊戲照舊在 Blockside repo 裡建置。
"""
import hashlib
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
try:
    sys.stdout.reconfigure(encoding='utf-8')                            # python -I 不讀 PYTHONIOENCODING；Windows 主控台預設 cp950 印不出 ✓
except Exception:
    pass

# (說明, 錨點, 換成) —— 錨點必須在成品裡剛好出現一次
PATCHES = [
    ('TRAILER 旗標（跟 STILL／DEBUG 同一行之後）',
     "var STILL = Q.get('still') === '1', DEBUG = Q.get('debug') === '1';",
     "var STILL = Q.get('still') === '1', DEBUG = Q.get('debug') === '1';\nvar TRAILER = !Q.has('play');"),
    ('不讀玩家存的設定（預告片要每次都一樣；也不寫回玩家的遊戲）',
     "var PREFS = { read: DEMO < 0 && Q.get('prefs') !== '0'",
     "var PREFS = { read: !TRAILER && DEMO < 0 && Q.get('prefs') !== '0'"),
    ('船型快取換一個庫名（跟遊戲同源時不互相蓋掉）',
     "var CACHE_DB = 'ame_constitution_broadside'",
     "var CACHE_DB = 'blockside_trailer'"),
    ('主迴圈：預告片模式整格交給導演',
     "if (LAB_FLEET) { flabFrame(ts); if (!noRaf) requestAnimationFrame(frame); return; }",
     "if (LAB_FLEET) { flabFrame(ts); if (!noRaf) requestAnimationFrame(frame); return; }\nif (TRAILER) { trFrame(ts); if (!noRaf) requestAnimationFrame(frame); return; }"),
    ('開機：預告片模式不擺選單背景，交給導演',
     "} else {\n\nreset();\nif (Q.get('start') === '1') startWhenReady();\n}",
     "} else if (TRAILER) {\ntrBoot();\n} else {\n\nreset();\nif (Q.get('start') === '1') startWhenReady();\n}"),
    ('畫面解析度：預告片固定 TR_W×TR_H（字幕與構圖才每台機器都一樣）',
     "function resize() {",
     "function resize() {\nif (TRAILER && trResize()) return;"),
    ('點狀粒子的大小跟著導演的視角（原本寫死 0.9 rad）',
     "gl.uniform1f(P.pt.u.uPx, CAM.h / (2 * Math.tan(0.45)));",
     "gl.uniform1f(P.pt.u.uPx, CAM.h / (2 * Math.tan((TRAILER ? TR_FOV : 0.9) / 2)));"),
]

# 導演程式：照順序接成一段，插進遊戲閉包（同一個作用域 ⇒ 頂層名字一律 tr／TR_ 開頭，避開遊戲的名字）
DIRECTOR_FILES = ['director.js', 'overlay.js', 'audio.js', 'scenes.js']

CLOSURE_END ="}).catch(function (e) { glFail('載入失敗：' + (e && e.message || e)); console.error(e); });\n})();"

BAD = [(re.compile(r'<script[^>]*\ssrc\s*='), '外部 <script src>'),
       (re.compile(r'\bfetch\s*\('), 'fetch('),
       (re.compile(r'\bimport\s*\('), 'import('),
       (re.compile(r'(?:src|href)\s*=\s*["\']?https?:', re.I), '外部 http(s) 資源')]


def fail(msg):
    print('✗ ' + msg)
    sys.exit(1)


def main(argv):
    if len(argv) < 3:
        fail('用法：python -I splice.py <遊戲成品 index.html> <輸出 .html>')
    src, out = argv[1], argv[2]
    with open(src, 'rb') as f:
        raw = f.read()
    game = raw.decode('utf-8')
    print('· 遊戲成品：%s（%.2f MB，sha256 %s）' % (src, len(raw) / 1e6, hashlib.sha256(raw).hexdigest()[:16]))
    m = re.search(r'<script type="application/json" id="blockside-src">(.*?)</script>', game)
    if m:
        print('· 成品記的來源（blockside-src）：%d 字元' % len(m.group(1)))
    else:
        print('⚠ 成品裡沒有 blockside-src（不知道是哪一版建的）')

    html = game
    for name, a, b in PATCHES:
        n = html.count(a)
        if n != 1:
            fail('補丁「%s」的錨點出現 %d 次（要剛好 1 次）：%r' % (name, n, a[:80]))
        html = html.replace(a, b, 1)
        print('  ✓ 補丁：' + name)

    parts = []
    for name in DIRECTOR_FILES:
        with open(os.path.join(HERE, name), 'r', encoding='utf-8') as f:
            parts.append('// ── trailer/%s ──\n' % name + f.read().rstrip('\n') + '\n')
    director = ''.join(parts)
    # 語法先擋（node --check）：導演程式一行壞掉，整個遊戲閉包都不跑 —— 畫面只剩「準備遊戲引擎…」，主控台才看得到
    import shutil, subprocess, tempfile
    if shutil.which('node'):
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as tf:
            tf.write('(function(){\n' + director + '\n})();\n')
        r = subprocess.run(['node', '--check', tf.name], capture_output=True, text=True, encoding='utf-8')
        os.unlink(tf.name)
        if r.returncode:
            fail('導演程式語法錯誤：\n' + (r.stderr or r.stdout)[:1500])
        print('  ✓ 導演程式語法（node --check）')
    else:
        print('  ⚠ 沒有 node ⇒ 導演程式語法沒驗')
    with open(os.path.join(HERE, 'shell.html'), 'r', encoding='utf-8') as f:
        shell = f.read()
    if director.count('})();') and re.search(r'^\}\)\(\);', director, re.M):
        fail('director.js 裡有一行開頭就是 })(); —— 會提早關掉遊戲閉包')
    n = html.count(CLOSURE_END)
    if n != 1:
        fail('遊戲閉包的結尾出現 %d 次（要剛好 1 次）' % n)
    head, tail = CLOSURE_END[:-len('})();')], '})();'
    html = html.replace(CLOSURE_END, head + director + tail, 1)
    print('  ✓ 導演程式：%s，%d 行，插在遊戲閉包結尾前' % ('＋'.join(DIRECTOR_FILES), director.count('\n')))
    # 頂層名字撞到遊戲的（同一個閉包：後面的會靜悄悄蓋掉前面的 —— 10-15 的 rndF）
    names = set(re.findall(r'^(?:function|var)\s+([A-Za-z_$][\w$]*)', director, re.M))
    gamenames = set(re.findall(r'^(?:function|var)\s+([A-Za-z_$][\w$]*)', game, re.M))
    clash = sorted(n for n in names & gamenames)
    if clash:
        fail('導演程式的頂層名字跟遊戲撞名：' + '、'.join(clash))
    odd = sorted(n for n in names if not (n.startswith('tr') or n.startswith('TR')))
    if odd:
        fail('導演程式的頂層名字要 tr／TR 開頭：' + '、'.join(odd))
    n = html.count('</body>')
    if n != 1:
        fail('</body> 出現 %d 次（要剛好 1 次）' % n)
    html = html.replace('</body>', shell.rstrip('\n') + '\n</body>', 1)
    print('  ✓ 播放器外殼：%d 行' % (shell.count('\n') + 1))

    probe = re.sub(r'<script type="application/(?:x-vxk|json)"[^>]*>.*?</script>', '', html, flags=re.S)
    bad = [name for rx, name in BAD if rx.search(probe)]
    if bad:
        fail('成品裡有外部依賴：' + '、'.join(bad))
    print('  ✓ 零外部依賴：沒有外部 src／fetch／import／http(s) 資源')

    data = html.encode('utf-8')
    tmp = out + '.tmp'
    with open(tmp, 'wb') as f:
        f.write(data)
    os.replace(tmp, out)
    print('✓ 寫出 %s（%.2f MB，sha256 %s）' % (out, len(data) / 1e6, hashlib.sha256(data).hexdigest()[:16]))


if __name__ == '__main__':
    main(sys.argv)
