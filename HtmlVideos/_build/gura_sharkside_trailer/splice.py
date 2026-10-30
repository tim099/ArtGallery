# -*- coding: utf-8 -*-
"""《方舷放置 Sharkside》宣傳片：把 Blockside 核心成品（拆檔的 index.html）複製一份，打上預告片補丁、內嵌要用的船與美術、
接上導演程式與播放器外殼 ⇒ 一份自足的 .html（單檔、零外部依賴）。

框架移植自 kaguya 的 Blockside 宣傳片（ArtGallery/HtmlVideos/_build/kaguya_blockside_trailer/splice.py）。

用法（python -I）：
  python -I splice.py <核心成品 index.html> <ships 資料夾> <art.json> <輸出 .html> [--hulls a,b,…]

  例：python -I splice.py D:/GameDev/Blockside-wt/gura-idle/index.html D:/GameDev/Blockside-wt/gura-idle/ships art.json ../../gura_sharkside_trailer.html

做的事（每一步對不上就停、不寫輸出檔）：
  1. 讀核心成品（整份照原位元組；換行不動）。印大小、sha256、核心指紋（blockside-src 的 fp）。
  2. 照 PATCHES 打錨點補丁：每個錨點在成品裡**剛好出現一次**，不是一次 ⇒ 停。
  3. 拿掉頁首相對路徑的 <link rel="manifest">、<link rel="apple-touch-icon">（單檔：沒有旁邊的檔）。
  4. 船：scenes.js 裡每個 hull: '<id>'（＋ --hulls）⇒ 照成品內嵌的 game-config 換成元素名、讀 ships/<元素>.js（VoxelKit.ship(...)），
     雜湊要跟成品的 vxk-ships 清單一致 ⇒ 以 <script> 原文接在清單後面（VoxelKit 從記憶體拿，不載檔）；清單只留內嵌的那幾艘
     （⇒ 預設船 HULL_DEF 落在內嵌的那幾艘裡；沒內嵌的船連「去載檔」的機會都沒有，只會報「沒有這艘船」）。
  5. 美術：art.json 的每一張（先找 .webp、沒有找 .png）⇒ data URI，寫成導演程式裡的 TR_IMG_SRC。
  6. director.js＋overlay.js＋audio.js＋scenes.js 接成一段，node --check 過，插在核心閉包的結尾前
     （「// ── js/91_shellapi.js ──」之後第一個「\\n})();」前面 ⇒ 同一個閉包，看得到核心的全部名字）。
  7. 頂層名字撞名、tr／TR 開頭的檢查；shell.html 插在 </body> 前；零外部依賴檢查；寫輸出檔（先寫 .tmp 再換名）。

⛔ 不改核心的原始碼、不在核心的 worktree 裡建置：補丁只打在這份複製上。
"""
import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
try:
    sys.stdout.reconfigure(encoding='utf-8')                            # python -I 不讀 PYTHONIOENCODING；Windows 主控台預設 cp950 印不出 ✓
except Exception:
    pass

# (說明, 錨點, 換成) —— 錨點必須在成品裡剛好出現一次
PATCHES = [
    ('TRAILER 旗標（這份檔永遠是宣傳片：核心不是放置遊戲本體 ⇒ 沒有 ?play 模式）',
     "var STILL = Q.get('still') === '1', DEBUG = Q.get('debug') === '1';",
     "var STILL = Q.get('still') === '1', DEBUG = Q.get('debug') === '1';\nvar TRAILER = true;"),
    ('不讀玩家存的設定（預告片要每次都一樣；也不寫回）',
     "var PREFS = { read: DEMO < 0 && Q.get('prefs') !== '0'",
     "var PREFS = { read: !TRAILER && DEMO < 0 && Q.get('prefs') !== '0'"),
    ('船型快取換一個庫名（跟遊戲同源時不互相蓋掉）',
     "var CACHE_DB = 'ame_constitution_broadside'",
     "var CACHE_DB = 'sharkside_trailer'"),
    ('主迴圈：預告片模式整格交給導演',
     "if (LAB_FLEET) { flabFrame(ts); if (!noRaf) requestAnimationFrame(frame); return; }",
     "if (LAB_FLEET) { flabFrame(ts); if (!noRaf) requestAnimationFrame(frame); return; }\nif (TRAILER) { trFrame(ts); if (!noRaf) requestAnimationFrame(frame); return; }"),
    ('開機：預告片模式不擺選單背景，交給導演',
     "} else {\n\nif (START_Q) startWhenReady();\nelse reset();\n}",
     "} else if (TRAILER) {\ntrBoot();\n} else {\n\nif (START_Q) startWhenReady();\nelse reset();\n}"),
    ('畫面解析度：預告片固定 TR_W×TR_H（字幕與構圖才每台機器都一樣）',
     "function resize() {",
     "function resize() {\nif (TRAILER && trResize()) return;"),
    ('點狀粒子的大小跟著導演的視角（原本寫死 0.9 rad）',
     "gl.uniform1f(P.pt.u.uPx, CAM.h / (2 * Math.tan(0.45)));",
     "gl.uniform1f(P.pt.u.uPx, CAM.h / (2 * Math.tan((TRAILER ? TR_FOV : 0.9) / 2)));"),
]

# 導演程式：照順序接成一段，插進核心閉包（同一個作用域 ⇒ 頂層名字一律 tr／TR 開頭，避開核心的名字）
DIRECTOR_FILES = ['director.js', 'overlay.js', 'audio.js', 'sharkfx.js', 'scenes.js']   # sharkfx.js：方舷放置的畫面元件（嘴、飄字、連咬、莎夏…；gura）
CLOSURE_MARK = '// ── js/91_shellapi.js ──'                             # 核心閉包的最後一支檔；它後面第一個 "\n})();" ＝ 閉包的結尾
VXK_INDEX = re.compile(r'<script type="application/json" id="vxk-ships">(.*?)</script>', re.S)
GAME_CFG = re.compile(r'<script type="application/x-asset" id="game-config" data-mime="application/json">([A-Za-z0-9+/=\s]*)</script>')
SHIP_FILE = re.compile(r'^VoxelKit\.ship\("([^"]+)",\s*\[((?:\s*"[A-Za-z0-9+/=]*"\s*,?)*)\s*\],\s*"([0-9a-f]+)"\);?\s*$', re.S)
HULL_RX = re.compile(r'''["']?\bhull["']?\s*:\s*["']([A-Za-z0-9_@.-]+)["']''')
LINK_RX = [(re.compile(r'<link rel="manifest"[^>]*>\n?'), 'manifest'),
           (re.compile(r'<link rel="apple-touch-icon"[^>]*>\n?'), 'apple-touch-icon')]
MIME = {'.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg'}

BAD = [(re.compile(r'<script[^>]*\ssrc\s*='), '外部 <script src>'),
       (re.compile(r'\bfetch\s*\('), 'fetch('),
       (re.compile(r'\bimport\s*\('), 'import('),
       (re.compile(r'(?:src|href)\s*=\s*["\']?https?:', re.I), '外部 http(s) 資源'),
       (re.compile(r'<link\b[^>]*\bhref\s*=\s*["\']?(?!data:|#)', re.I), '<link href>（相對路徑的檔）')]


def fail(msg):
    print('✗ ' + msg)
    sys.exit(1)


def mb(n):
    return '%.2f MB' % (n / 1e6)


def scene_hulls(text):
    """scenes.js 裡出現的船型（照出現順序、不重複）：hull: 'x' 或 "hull": "x"。「船型@換裝表」只取船型。"""
    out = []
    for h in HULL_RX.findall(text):
        h = h.split('@')[0]
        if h not in out:
            out.append(h)
    return out


def inline_ships(html, ships_dir, hulls):
    """船型清單 ⇒ 每艘一個 <script>VoxelKit.ship(...)</script>（原文），接在 vxk-ships 清單後面；清單只留這幾艘。"""
    m = GAME_CFG.search(html)
    if not m:
        fail('成品裡找不到 game-config（id="game-config" 的 x-asset）')
    cfg = json.loads(base64.b64decode(re.sub(r'\s', '', m.group(1))).decode('utf-8'))
    el_of = {s['id']: s['el'] for s in cfg['ships']}
    author = {s['id']: s.get('author', '') for s in cfg['ships']}
    mi = VXK_INDEX.search(html)
    if not mi or len(VXK_INDEX.findall(html)) != 1:
        fail('成品裡的 vxk-ships 清單不是剛好一份（這份核心是不是拆檔的成品？）')
    idx = json.loads(mi.group(1))
    tags, kept, total = [], {}, 0
    for h in hulls:
        if h not in el_of:
            fail('scenes.js 用到的船型 %r 不在核心的 game-config 裡（打錯字？）' % h)
        el = el_of[h]
        if el not in idx:
            fail('船型 %s（%s）不在 vxk-ships 清單裡' % (h, el))
        path = os.path.join(ships_dir, el + '.js')
        if not os.path.isfile(path):
            fail('找不到船檔 %s' % path)
        with open(path, 'r', encoding='utf-8') as f:
            t = f.read()
        s = SHIP_FILE.match(t)
        if not s:
            fail('船檔 %s 不是 VoxelKit.ship("<元素>",[…],"<雜湊>"); 的格式' % path)
        if s.group(1) != el:
            fail('船檔 %s 裡的元素是 %s（要 %s）' % (path, s.group(1), el))
        if s.group(3) != idx[el]:
            fail('船檔 %s 的雜湊 %s 跟成品清單的 %s 對不上 ⇒ 核心成品跟 ships/ 不是同一次建置' % (path, s.group(3), idx[el]))
        if re.search(r'</script', t, re.I):
            fail('船檔 %s 裡有 </script' % path)
        tags.append('<script>' + t.strip() + '</script>')
        kept[el] = idx[el]
        n = len(t.encode('utf-8'))
        total += n
        print('  ✓ 船 %-12s %-18s %8.1f KB（雕刻：%s）' % (h, el, n / 1e3, author.get(h) or '?'))
    new_index = '<script type="application/json" id="vxk-ships">' + json.dumps(kept, separators=(',', ':')) + '</script>'
    block = new_index + '\n<!-- 宣傳片：要用的船內嵌在這裡（splice.py；原文 ＝ ships/<元素>.js）-->\n' + '\n'.join(tags)
    html = html[:mi.start()] + block + html[mi.end():]
    # 預設船（05_hull.js HULL_DEF ＝ 清單上第一艘有資料、不是堡壘的）：核心開機會先載它 ⇒ 一定要在內嵌的那幾艘裡
    known = [s for s in cfg['ships'] if s['el'] in kept]
    ships_only = [s for s in known if not s.get('fixed')]
    hdef = (ships_only or known)[0]['id'] if known else None
    print('  ✓ 船 %d 艘內嵌（%s），清單 %d → %d 艘；開機的預設船 ＝ %s' % (len(hulls), mb(total), len(idx), len(kept), hdef))
    return html, total, hdef


def art_table(art_path):
    """art.json ⇒ { 鍵: data URI }。{ "root": 資料夾, "img": { 鍵: 相對路徑（沒副檔名 ⇒ 先 .webp 後 .png） } }。"""
    with open(art_path, 'r', encoding='utf-8') as f:
        A = json.load(f)
    root = A.get('root') or '.'
    if not os.path.isabs(root):
        root = os.path.join(os.path.dirname(os.path.abspath(art_path)), root)
    out, total, rows = {}, 0, []
    for key, rel in A['img'].items():
        cands = [rel] if os.path.splitext(rel)[1].lower() in MIME else [rel + '.webp', rel + '.png']
        path = next((os.path.join(root, c) for c in cands if os.path.isfile(os.path.join(root, c))), None)
        if not path:
            fail('美術 %s：找不到 %s' % (key, ' 或 '.join(os.path.join(root, c) for c in cands)))
        with open(path, 'rb') as f:
            b = f.read()
        uri = 'data:%s;base64,%s' % (MIME[os.path.splitext(path)[1].lower()], base64.b64encode(b).decode('ascii'))
        out[key] = uri
        total += len(uri)
        rows.append((len(b), key, os.path.basename(path)))
    rows.sort(reverse=True)
    print('  ✓ 美術 %d 張（data URI %s；最大：%s）' % (len(out), mb(total), '、'.join('%s %s %.0f KB' % (k, n, s / 1e3) for s, k, n in rows[:4])))
    return out, total


def main(argv):
    args, extra = [], []
    i = 1
    while i < len(argv):
        if argv[i] == '--hulls' and i + 1 < len(argv):
            extra = [h for h in argv[i + 1].split(',') if h]
            i += 2
            continue
        args.append(argv[i])
        i += 1
    if len(args) != 4:
        fail('用法：python -I splice.py <核心成品 index.html> <ships 資料夾> <art.json> <輸出 .html> [--hulls a,b]')
    src, ships_dir, art_path, out = args
    with open(src, 'rb') as f:
        raw = f.read()
    game = raw.decode('utf-8')
    fp = re.search(r'"fp":"([0-9a-f]+)"', game)
    print('· 核心成品：%s（%s，sha256 %s，核心指紋 %s）' % (src, mb(len(raw)), hashlib.sha256(raw).hexdigest()[:16], fp.group(1) if fp else '？'))
    if '\r' in game:
        print('⚠ 成品裡有 \\r（CRLF）：錨點是照 LF 寫的')

    html = game
    for name, a, b in PATCHES:
        n = html.count(a)
        if n != 1:
            fail('補丁「%s」的錨點出現 %d 次（要剛好 1 次）：%r' % (name, n, a[:80]))
        html = html.replace(a, b, 1)
        print('  ✓ 補丁：' + name)
    for rx, name in LINK_RX:
        n = len(rx.findall(html))
        if n > 1:
            fail('<link rel="%s"> 出現 %d 次' % (name, n))
        html = rx.sub('', html)
        print('  ✓ 拿掉 <link rel="%s">（%d 個）' % (name, n))

    with open(os.path.join(HERE, 'scenes.js'), 'r', encoding='utf-8') as f:
        hulls = scene_hulls(f.read())
    for h in extra:
        if h not in hulls:
            hulls.append(h)
    if not hulls:
        fail('scenes.js 裡一個 hull: 都沒有（至少要一艘：核心開機要載預設船）')
    print('· 船型（scenes.js 的 hull:%s）：%s' % ('＋--hulls' if extra else '', '、'.join(hulls)))
    core_bytes = len(html.encode('utf-8'))
    html, ship_bytes, hdef = inline_ships(html, ships_dir, hulls)

    img, art_bytes = art_table(art_path)
    head = ('// ── trailer/（splice.py 產生）──\n'
            'var TR_HULLS_IN = ' + json.dumps(hulls) + ';\n'
            'var TR_HULL_DEF = ' + json.dumps(hdef) + ';\n'
            'var TR_IMG_SRC = ' + json.dumps(img, separators=(',', ':')) + ';\n')
    parts = []
    for name in DIRECTOR_FILES:
        with open(os.path.join(HERE, name), 'r', encoding='utf-8') as f:
            parts.append('// ── trailer/%s ──\n' % name + f.read().rstrip('\n') + '\n')
    director = head + ''.join(parts)
    # 語法先擋（node --check）：導演程式一行壞掉，整個核心閉包都不跑 —— 畫面只剩「準備遊戲引擎…」，主控台才看得到
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
    if re.search(r'^\}\)\(\);', director, re.M):
        fail('導演程式裡有一行開頭就是 })(); —— 會提早關掉核心閉包')
    if re.search(r'</script', director, re.I):
        fail('導演程式裡有 </script（會提早關掉 <script>）')
    n = html.count(CLOSURE_MARK)
    if n != 1:
        fail('核心閉包的最後一支檔標記「%s」出現 %d 次（要剛好 1 次）' % (CLOSURE_MARK, n))
    at = html.find('\n})();', html.index(CLOSURE_MARK))
    if at < 0:
        fail('標記之後找不到核心閉包的結尾 \\n})();')
    if not html.startswith('\n})();\n</script>', at):
        print('  ⚠ 閉包結尾後面不是 </script>：%r' % html[at:at + 40])
    html = html[:at] + '\n' + director.rstrip('\n') + html[at:]
    print('  ✓ 導演程式：%s，%d 行，插在核心閉包結尾前（%s 之後）' % ('＋'.join(DIRECTOR_FILES), director.count('\n'), CLOSURE_MARK))
    # 頂層名字撞到核心的（同一個閉包：後面的會靜悄悄蓋掉前面的 —— 10-15 的 rndF）
    names = set(re.findall(r'^(?:function|var)\s+([A-Za-z_$][\w$]*)', director, re.M))
    gamenames = set(re.findall(r'^(?:function|var)\s+([A-Za-z_$][\w$]*)', game, re.M))
    clash = sorted(names & gamenames)
    if clash:
        fail('導演程式的頂層名字跟核心撞名：' + '、'.join(clash))
    odd = sorted(x for x in names if not (x.startswith('tr') or x.startswith('TR')))
    if odd:
        fail('導演程式的頂層名字要 tr／TR 開頭：' + '、'.join(odd))
    print('  ✓ 頂層名字 %d 個：都是 tr／TR 開頭、不跟核心撞名' % len(names))

    with open(os.path.join(HERE, 'shell.html'), 'r', encoding='utf-8') as f:
        shell = f.read()
    n = html.count('</body>')
    if n != 1:
        fail('</body> 出現 %d 次（要剛好 1 次）' % n)
    html = html.replace('</body>', shell.rstrip('\n') + '\n</body>', 1)
    print('  ✓ 播放器外殼：%d 行' % (shell.count('\n') + 1))

    probe = re.sub(r'<script type="application/(?:x-vxk|json|x-asset)"[^>]*>.*?</script>', '', html, flags=re.S)
    bad = [name for rx, name in BAD if rx.search(probe)]
    if bad:
        fail('成品裡有外部依賴：' + '、'.join(bad))
    print('  ✓ 零外部依賴：沒有外部 src／fetch／import／http(s)／相對路徑的 <link>（只驗靜態的寫法；動態載船由清單只留內嵌的那幾艘擋住）')

    data = html.encode('utf-8')
    tmp = out + '.tmp'
    with open(tmp, 'wb') as f:
        f.write(data)
    os.replace(tmp, out)
    dir_bytes = len(director.encode('utf-8')) - art_bytes
    print('· 大小：核心（補丁後）%s ＋ 船 %s ＋ 美術 %s ＋ 導演程式 %.0f KB ＋ 外殼 %.0f KB' % (mb(core_bytes), mb(ship_bytes), mb(art_bytes), dir_bytes / 1e3, len(shell.encode('utf-8')) / 1e3))
    print('✓ 寫出 %s（%s，sha256 %s）' % (out, mb(len(data)), hashlib.sha256(data).hexdigest()[:16]))


if __name__ == '__main__':
    main(sys.argv)
