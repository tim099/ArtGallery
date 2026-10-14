# 區塊職責：《憲法號對轟》的設定後台（TASK-0542）—— config/game.json（各項設定的初始值、船隻清單）的唯一寫入端：
#           驗設定、照船隻清單改寫 template.html 的船標籤、重建單檔成品、匯入新船、重新匯入舊船；serve 開一頁本機後台（同一組函式）。
# 物理意義：遊戲建置時把 game.json 內嵌進成品（js/00_config.js 讀成 CFG）⇒ 改預設 ＝ 改這份檔再重建，不是改 js。
#           船的 .vxk 由 senate 從雕刻作品匯出到 VoxelKit/_cache/（不入版控），vxk_inline.py 內嵌進成品。
# 失敗處置：設定不合法 ⇒ 列出每一格錯在哪、不寫檔；匯出／建置失敗 ⇒ 原樣印出那支工具的輸出、非零結束；
#           重新匯入失敗 ⇒ 舊的 .vxk 不動（新的先寫到 .new，成功才換上，舊的留成 .prev）。
#
# 用法（在這個資料夾）：
#   python -I admin.py serve [--port 8642] [--open]  開設定後台（只聽 127.0.0.1）⇒ 瀏覽器開 http://127.0.0.1:8642/（--open 自動開；已經開著 ⇒ 只開頁面）
#     一鍵：雙擊 HtmlGames/ame_constitution_broadside/ame_constitution_broadside_admin.cmd（＝ serve --open）
#   python -I admin.py check                      驗 config/game.json
#   python -I admin.py build                      照設定重建 ../../ame_constitution_broadside/ame_constitution_broadside.html
#   python -I admin.py import --work <雕刻作品 ID> --id <船的代號> --name <名字>   匯入新船（匯出 .vxk、登記、重建）
#   python -I admin.py reimport --id <船的代號> [--work <作品 ID>]                 重新匯入（換新的 .vxk、印跟上一版的差別、重建）
#   python -I admin.py cache                      _cache/ 缺的 .vxk 從版控那份成品裡解回來（換機器、只改程式時用）
#   加 --no-build：匯入／重新匯入之後不重建
import argparse, base64, hashlib, json, math, os, re, shutil, socket, struct, subprocess, sys, urllib.request, webbrowser, zlib
from http.server import BaseHTTPRequestHandler, HTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
CFG_P = os.path.join(HERE, 'config', 'game.json')
TPL = os.path.join(HERE, 'template.html')
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'ame_constitution_broadside', 'ame_constitution_broadside.html'))   # 成品、後台頁收在遊戲自己的資料夾（HtmlGames/ 只放展品卡 .md）
PAGE = os.path.normpath(os.path.join(HERE, '..', '..', 'ame_constitution_broadside', 'ame_constitution_broadside_admin.html'))
VKD = os.path.normpath(os.path.join(HERE, '..', '..', '..', 'VoxelKit'))
CACHE = os.path.join(VKD, '_cache')
INLINE = os.path.join(VKD, 'vxk_inline.py')
SHIPS_A, SHIPS_B = '—— ships 開始 -->\n', '<!-- ships 結束 -->'

MENU = {'play': ('fun', 'real'), 'mode': ('pve', 'eve', 'sandbox'), 'sail': ('auto', 'manual', 'off'),
        'gfx': ('low', 'mid', 'high'), 'phx': ('full', 'high', 'mid', 'low')}
SHIP_CFG_KEYS = ('hard', 'flood', 'gunw', 'speed', 'agile', 'upwind')          # 每艘船的船隻設定（壓艙物照船算，不在這裡）
CREW = {'officers': (0, 4, True), 'helm': (0, 2, True), 'marines': (0, 60, True), 'marineGap': (5, 200, True),
        'top': (0, 8, True), 'monkeys': (0, 1, True), 'handsK': (0, 4, False)}
GEO_PAIRS = ('marines', 'aimZ', 'deckAim', 'rigAim')
GEO_NUMS = ('center', 'aim')


# ───────────────────────── 讀寫 ─────────────────────────
def load(path=CFG_P):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def dumps(o, ind=0):
    """JSON：純量的陣列、只含純量的短物件寫在一行（diff 好讀）；其餘照縮排。數字照 Python repr（跟 JS 的 JSON.stringify 同一個最短表示）。"""
    pad, pad1 = '  ' * ind, '  ' * (ind + 1)

    def flat(v):
        return not isinstance(v, (dict, list)) or (isinstance(v, list) and all(not isinstance(x, (dict, list)) for x in v))
    if isinstance(o, list):
        if all(flat(x) for x in o):
            return json.dumps(o, ensure_ascii=False, separators=(', ', ': '))
        return '[\n' + ',\n'.join(pad1 + dumps(x, ind + 1) for x in o) + '\n' + pad + ']'
    if isinstance(o, dict):
        one = json.dumps(o, ensure_ascii=False, separators=(', ', ': '))
        if all(flat(v) for v in o.values()) and len(one) + len(pad) < 150:
            return one
        return '{\n' + ',\n'.join(pad1 + json.dumps(k, ensure_ascii=False) + ': ' + dumps(v, ind + 1) for k, v in o.items()) + '\n' + pad + '}'
    return json.dumps(o, ensure_ascii=False)


def save(cfg):
    tmp = CFG_P + '.tmp'
    with open(tmp, 'w', encoding='utf-8', newline='\n') as f:
        f.write(dumps(cfg) + '\n')
    os.replace(tmp, CFG_P)


# ───────────────────────── 驗設定 ─────────────────────────
def isnum(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def isint(v):
    return isnum(v) and float(v).is_integer()


def validate(cfg, prev=None):
    """回傳錯誤清單（空 ＝ 合法）。prev：磁碟上原本那份 ⇒ 原本有的鍵不能少（遊戲每一個都會讀）。"""
    E = []

    def err(p, m):
        E.append('%s：%s' % (p, m))
    if not isinstance(cfg, dict):
        return ['整份：不是物件']
    if cfg.get('v') != 1:
        err('v', '要是 1')
    L = cfg.get('limits') or {}
    ms = L.get('maxShips')
    if not (isint(ms) and 2 <= ms <= 16):
        err('limits.maxShips', '2～16 的整數（同時在場最多幾艘；著色器的陣列照它配）')
        ms = 16
    if not (isint(L.get('maskNear')) and 1 <= L.get('maskNear') <= ms):
        err('limits.maskNear', '1～同時在場上限 的整數')
    if not (isint(L.get('fleetMax')) and 2 <= L.get('fleetMax') <= 99):
        err('limits.fleetMax', '2～99 的整數（編成最多幾艘）')
    M = cfg.get('menu') or {}
    for k, opts in MENU.items():
        if M.get(k) not in opts:
            err('menu.' + k, '要是 ' + '／'.join(opts) + ' 其中一個')
    lim = cfg.get('lim')
    if not isinstance(lim, dict) or not lim:
        err('lim', '要是非空物件')
        lim = {}
    for k, r in lim.items():
        if not (isinstance(r, list) and len(r) == 3 and all(isnum(x) for x in r)):
            err('lim.' + k, '要是 [下限, 上限, 預設] 三個數字')
        elif not (r[0] <= r[2] <= r[1]):
            err('lim.' + k, '要 下限 ≤ 預設 ≤ 上限（%s）' % r)
    d = cfg.get('dist')
    if not (isinstance(d, list) and len(d) == 3 and all(isint(x) for x in d) and 1 <= d[0] <= d[2] <= d[1]):
        err('dist', '要是 [下限, 上限, 預設] 三個整數、下限 ≤ 預設 ≤ 上限')
    A = cfg.get('ammo') or {}
    al = A.get('lim')
    if not (isinstance(al, list) and len(al) == 2 and all(isint(x) for x in al) and 0 <= al[0] <= al[1]):
        err('ammo.lim', '要是 [下限, 上限] 兩個整數')
        al = [0, 1e9]
    ak = A.get('k')
    if not (isinstance(ak, list) and len(ak) == 3 and all(isinstance(r, list) and len(r) == 3 and all(isint(x) and al[0] <= x <= al[1] for x in r) for r in ak)):
        err('ammo.k', '要是 3×3 的整數（列 ＝ 實心／爆裂／鏈彈，欄 ＝ 對砲／對帆／對人），每格在 ammo.lim 裡')
    G = cfg.get('guns')
    if not isinstance(G, dict) or not G:
        err('guns', '要是非空物件')
        G = {}
    codes = set()
    for k, g in G.items():
        p = 'guns.' + k
        if not isinstance(g, dict):
            err(p, '要是物件')
            continue
        for f in ('code', 'name', 'short'):
            if not (isinstance(g.get(f), str) and g.get(f)):
                err(p + '.' + f, '要是非空字串')
        if g.get('code') in codes:
            err(p + '.code', '跟別的砲種重複（雕刻作品的 meta gun 照它認）')
        codes.add(g.get('code'))
        for f in ('V', 'reload'):
            if not (isnum(g.get(f)) and g.get(f) > 0):
                err(p + '.' + f, '要是正數')
        if not (isnum(g.get('mass')) and g.get('mass') >= 0):
            err(p + '.mass', '要是 ≥ 0 的數字（噸）')
        if not isinstance(g.get('big'), bool):
            err(p + '.big', '要是 true／false')
        if 'hole' in g and not (isnum(g['hole']) and g['hole'] > 0):
            err(p + '.hole', '要是正數（沒寫 ＝ 1）')
        if not (isint(g.get('crew')) and 1 <= g.get('crew') <= 8):
            err(p + '.crew', '1～8 的整數（砲旁的站位只有 8 個）')
        elif not (isint(g.get('min')) and 1 <= g.get('min') <= g.get('crew')):
            err(p + '.min', '1～滿編 的整數')

    def geo(gx, p, full):
        if not isinstance(gx, dict):
            err(p, '要是物件')
            return
        for k, v in gx.items():
            if k == 'spar':
                if v is not None and not (isinstance(v, list) and len(v) == 2 and all(isint(x) for x in v) and v[0] <= v[1]):
                    err(p + '.spar', 'null 或 [z0, z1] 兩個整數')
            elif k in GEO_PAIRS:
                if not (isinstance(v, list) and len(v) == 2 and all(isnum(x) for x in v) and (k == 'marines' or v[0] <= v[1])):
                    err(p + '.' + k, '要是兩個數字' + ('' if k == 'marines' else '、前 ≤ 後'))
            elif k in GEO_NUMS:
                if not isnum(v):
                    err(p + '.' + k, '要是數字')
            else:
                err(p + '.' + k, '不認得的鍵')
        if full:
            for k in ('spar',) + GEO_PAIRS + GEO_NUMS:
                if k not in gx:
                    err(p + '.' + k, '缺')

    def crew(cx, p, full):
        if not isinstance(cx, dict):
            err(p, '要是物件')
            return
        for k, v in cx.items():
            if k not in CREW:
                err(p + '.' + k, '不認得的鍵')
                continue
            lo, hi, it = CREW[k]
            if not ((isint(v) if it else isnum(v)) and lo <= v <= hi):
                err(p + '.' + k, '%s～%s 的%s' % (lo, hi, '整數' if it else '數字'))
        if full:
            for k in CREW:
                if k not in cx:
                    err(p + '.' + k, '缺')
    geo(cfg.get('geo0'), 'geo0', True)
    crew(cfg.get('crew0'), 'crew0', True)
    S = cfg.get('ships')
    if not (isinstance(S, list) and S):
        err('ships', '至少要有一艘')
        S = []
    ids, els = set(), set()
    for i, s in enumerate(S):
        p = 'ships[%d]' % i
        if not isinstance(s, dict):
            err(p, '要是物件')
            continue
        p = 'ships[%s]' % s.get('id', i)
        if not (isinstance(s.get('id'), str) and re.fullmatch(r'[a-z][a-z0-9_]{0,31}', s['id'])):
            err(p + '.id', '小寫英文開頭、只有小寫英文數字底線（網址 ?blue= 與存檔用它）')
        elif s['id'] in ids:
            err(p + '.id', '重複')
        ids.add(s.get('id'))
        if not (isinstance(s.get('el'), str) and re.fullmatch(r'[a-z][a-z0-9-]{0,47}', s['el'])):
            err(p + '.el', '內嵌標籤的 id：小寫英文開頭、只有小寫英文數字與 -')
        elif s['el'] in els or s['el'] in ('game-config',):
            err(p + '.el', '重複')
        els.add(s.get('el'))
        if not (isinstance(s.get('name'), str) and s['name'].strip()):
            err(p + '.name', '要有名字')
        if not (isinstance(s.get('vxk'), str) and re.fullmatch(r'[A-Za-z0-9_.-]+\.vxk', s['vxk'])):
            err(p + '.vxk', '_cache 裡的檔名（xxx.vxk）')
        if not isinstance(s.get('work', ''), str):
            err(p + '.work', '雕刻作品 ID（字串）')
        if 'zw0' in s and not (isint(s['zw0']) and s['zw0'] > 0):
            err(p + '.zw0', '正整數（作品沒有水線 meta 時的設計水線）')
        for k, v in (s.get('cfg') or {}).items():
            if k not in SHIP_CFG_KEYS:
                err(p + '.cfg.' + k, '不認得的鍵（%s）' % '、'.join(SHIP_CFG_KEYS))
            elif k in lim and isinstance(lim[k], list) and len(lim[k]) == 3 and not (isnum(v) and lim[k][0] <= v <= lim[k][1]):
                err(p + '.cfg.' + k, '要在滑桿範圍 %s～%s 裡' % (lim[k][0], lim[k][1]))
        if 'geo' in s:
            geo(s['geo'], p + '.geo', False)
        if 'crew' in s:
            crew(s['crew'], p + '.crew', False)
    if prev:
        for sec in ('limits', 'menu', 'lim', 'guns', 'geo0', 'crew0'):
            for k in (prev.get(sec) or {}):
                if k not in (cfg.get(sec) or {}):
                    err(sec + '.' + k, '原本有、這份少了（遊戲會讀它）')
    return E


# ───────────────────────── 船：template 標籤、.vxk ─────────────────────────
def ship_tags(cfg):
    return ''.join('<script type="application/x-vxk" id="%s" src="../../../VoxelKit/_cache/%s"></script>\n' % (s['el'], s['vxk']) for s in cfg['ships'])


def sync_template(cfg):
    """template.html 的船標籤照 ships 改寫（兩個註解記號中間那一段）。回傳有沒有改。"""
    t = open(TPL, encoding='utf-8').read()
    a, b = t.find(SHIPS_A), t.find(SHIPS_B)
    if a < 0 or b < a:
        raise RuntimeError('template.html 找不到船標籤的記號（%s … %s）' % (SHIPS_A.strip(), SHIPS_B))
    a += len(SHIPS_A)
    nt = t[:a] + ship_tags(cfg) + t[b:]
    if nt == t:
        return False
    with open(TPL, 'w', encoding='utf-8', newline='\n') as f:
        f.write(nt)
    return True


def vxk_header(raw):
    """.vxk（raw deflate：'VXK1'、header 長度、header JSON、格子…）只解到 header 為止（格子不解 ⇒ 不用整份解壓）。格式見 VoxelKit/voxel_export.py pack／unpack。"""
    d, buf, tail = zlib.decompressobj(-15), b'', raw

    def need(n):
        nonlocal buf, tail
        while len(buf) < n:
            chunk = d.decompress(tail, n - len(buf))
            tail = d.unconsumed_tail
            if not chunk:
                raise ValueError('.vxk 太短')
            buf += chunk
    need(8)
    if buf[:4] != b'VXK1':
        raise ValueError('不是 VXK1')
    n = struct.unpack('<I', buf[4:8])[0]
    need(8 + n)
    return json.loads(buf[8:8 + n].decode('utf-8'))


def vxk_info(path):
    """.vxk 的 header 讀數：格數、checksum、尺寸、繩帆模型數、作品 ID、匯出時間、檔案雜湊。"""
    if not os.path.exists(path):
        return None
    raw = open(path, 'rb').read()
    h = vxk_header(raw)
    rig = h.get('rig') or {}
    return {'voxels': h.get('voxels'), 'checksum': h.get('checksum'), 'size': h.get('size'), 'meters_per_voxel': h.get('meters_per_voxel'),
            'ropes': len(rig.get('ropes') or []), 'sails': len(rig.get('sails') or []), 'models': len(rig.get('models') or []),
            'parts': len(h.get('parts') or []), 'work': h.get('work'), 'exported_at': h.get('exported_at'),
            'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()[:12]}


DIFF_KEYS = (('voxels', '格數'), ('checksum', 'checksum'), ('size', '尺寸'), ('ropes', '繩'), ('sails', '帆'), ('models', '模型'),
             ('parts', '零件'), ('meters_per_voxel', '公尺／格'), ('work', '作品'), ('exported_at', '匯出時間'), ('bytes', '檔案大小'), ('sha256', '檔案雜湊'))


def vxk_diff(a, b):
    out = []
    for k, name in DIFF_KEYS:
        va, vb = (a or {}).get(k), (b or {}).get(k)
        if va == vb:
            out.append('  %s：%s（沒變）' % (name, va))
        elif isnum(va) and isnum(vb) and k not in ('checksum',):
            out.append('  %s：%s → %s（%+d）' % (name, va, vb, vb - va))
        else:
            out.append('  %s：%s → %s' % (name, va, vb))
    return out


def run(cmd, cwd=HERE):
    p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    return p.returncode, (p.stdout or '') + (p.stderr or '')


def export(work, dest):
    """senate 從雕刻作品匯出 .vxk（連繩、帆、模型、零件外框、meta）。"""
    senate = shutil.which('senate')
    if not senate:
        raise RuntimeError('找不到 senate（匯出 .vxk 要它）')
    code, out = run([senate, 'cmd', 'sculpture', '--arg', 'op=export', '--arg', 'format=vxk', '--arg', 'work=' + work,
                     '--arg', 'include=rig,models,parts,meta', '--arg', 'out=' + os.path.abspath(dest)])
    if code != 0 or not os.path.exists(dest):
        raise RuntimeError('匯出失敗（exit %d）：\n%s' % (code, out.strip()))
    return out


# ───────────────────────── 動作（CLI 與後台頁共用） ─────────────────────────
class Fail(Exception):
    pass


def act_check():
    E = validate(load())
    if E:
        raise Fail('設定不合法：\n' + '\n'.join('  ✗ ' + e for e in E))
    return ['✓ config/game.json 合法（%d 艘船、%d 個滑桿、%d 種砲）' % (len(load()['ships']), len(load()['lim']), len(load()['guns']))]


def act_build():
    cfg = load()
    E = validate(cfg)
    if E:
        raise Fail('設定不合法，不建置：\n' + '\n'.join('  ✗ ' + e for e in E))
    log = ['template.html 的船標籤' + ('照設定改寫了' if sync_template(cfg) else '跟設定一致')]
    miss = [s['vxk'] for s in cfg['ships'] if not os.path.exists(os.path.join(CACHE, s['vxk']))]
    if miss:
        raise Fail('VoxelKit/_cache/ 少了 %s ⇒ 先 python -I admin.py cache（從成品解回）或 reimport' % '、'.join(miss))
    code, out = run([sys.executable, '-I', INLINE, TPL, OUT])
    log.append(out.strip())
    if code != 0:
        raise Fail('\n'.join(log) + '\n✗ 建置失敗（exit %d）' % code)
    return log


def act_cache():
    """_cache/ 缺的 .vxk 從版控那份成品（內嵌的 base64）解回來。"""
    cfg, log = load(), []
    html = open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
    os.makedirs(CACHE, exist_ok=True)
    for s in cfg['ships']:
        p = os.path.join(CACHE, s['vxk'])
        if os.path.exists(p):
            log.append('  %s：已有（%d bytes）' % (s['vxk'], os.path.getsize(p)))
            continue
        m = re.search(r'<script type="application/x-vxk" id="%s">([^<]*)</script>' % re.escape(s['el']), html)
        if not m:
            log.append('  %s：成品裡沒有 #%s ⇒ 要 reimport' % (s['vxk'], s['el']))
            continue
        b = base64.b64decode(m.group(1))
        open(p, 'wb').write(b)
        log.append('  %s：從成品的 #%s 解回（%d bytes）' % (s['vxk'], s['el'], len(b)))
    return log


def act_import(work, sid, name, build=True):
    cfg = load()
    work, sid, name = (work or '').strip(), (sid or '').strip(), (name or '').strip()
    if not work:
        raise Fail('要給雕刻作品 ID')
    if any(s['id'] == sid for s in cfg['ships']):
        raise Fail('已經有代號 %s 的船 ⇒ 要換新版本用「重新匯入」' % sid)
    ship = {'id': sid, 'el': 'ship-' + sid.replace('_', '-'), 'name': name, 'vxk': sid + '.vxk', 'work': work}
    E = validate(dict(cfg, ships=cfg['ships'] + [ship]))
    if E:
        raise Fail('\n'.join('✗ ' + e for e in E))
    dest = os.path.join(CACHE, ship['vxk'])
    if os.path.exists(dest):
        raise Fail('_cache 已經有 %s（不是這份清單裡的船）⇒ 先搬走或換代號' % ship['vxk'])
    os.makedirs(CACHE, exist_ok=True)
    try:
        export(work, dest)
    except RuntimeError as e:
        raise Fail(str(e))
    info = vxk_info(dest)
    log = ['✓ 匯出 %s ← %s' % (ship['vxk'], work)] + ['  %s：%s' % (n, info.get(k)) for k, n in DIFF_KEYS]
    ref = vxk_info(os.path.join(CACHE, cfg['ships'][0]['vxk']))
    if ref and ref.get('meters_per_voxel') != info.get('meters_per_voxel'):
        log.append('⚠ 比例 %s 公尺／格，跟 %s 的 %s 不一樣 ⇒ 遊戲不會同時載這兩艘（模擬只吃同一個比例）' % (info.get('meters_per_voxel'), cfg['ships'][0]['name'], ref.get('meters_per_voxel')))
    cfg['ships'].append(ship)
    save(cfg)
    log.append('✓ 登記進船隻清單：%s（%s）—— 航速、靈活、船員照預設，要調到後台的船隻設定' % (name, sid))
    if build:
        log += act_build()
    return log


def act_reimport(sid, work=None, build=True):
    cfg = load()
    s = next((x for x in cfg['ships'] if x['id'] == sid), None)
    if not s:
        raise Fail('沒有代號 %s 的船' % sid)
    dest = os.path.join(CACHE, s['vxk'])
    old = vxk_info(dest)
    work = (work or '').strip() or s.get('work') or (old or {}).get('work')
    if not work:
        raise Fail('不知道 %s 是哪件雕刻作品 ⇒ 帶 --work' % s['name'])
    os.makedirs(CACHE, exist_ok=True)
    tmp = dest + '.new'
    try:
        export(work, tmp)
    except RuntimeError as e:
        raise Fail(str(e))
    new = vxk_info(tmp)
    log = ['%s（%s）← %s　上一版 → 這一版：' % (s['name'], s['vxk'], work)] + vxk_diff(old, new)
    if old and old['sha256'] == new['sha256']:
        os.remove(tmp)
        log.append('＝ 檔案逐位元組相同 ⇒ 不換、不重建')
        return log
    if old:                                              # 差在哪：VoxelKit 的對拍（格子逐格逐色、header 逐欄；exported_at 不比）
        code, out = run([sys.executable, '-I', os.path.join(VKD, 'vxk_compare.py'), dest, tmp, '--max', '12'], cwd=VKD)
        log += ['  內容對拍（vxk_compare.py）：'] + ['    ' + l for l in out.strip().splitlines()[2:]] if code in (0, 1) else ['  ⚠ vxk_compare.py 跑不起來（exit %d）：%s' % (code, out.strip()[-300:])]
        if code == 0:                                    # 只差匯出時間 ⇒ 換了只會讓成品多一份 diff、戰局一位元都不變
            os.remove(tmp)
            log.append('＝ 內容相同（只差匯出時間）⇒ 不換、不重建')
            return log
        os.replace(dest, dest + '.prev')
    os.replace(tmp, dest)
    log.append('✓ 換上新的 .vxk（上一版留成 %s.prev）' % s['vxk'])
    if s.get('work') != work:
        s['work'] = work
        save(cfg)
    if build:
        log += act_build()
    return log


def act_state():
    cfg = load()
    code, committed = run(['git', 'show', 'HEAD:./config/game.json'])
    return {'config': cfg, 'committed': json.loads(committed) if code == 0 else None,
            'ships': {s['id']: vxk_info(os.path.join(CACHE, s['vxk'])) for s in cfg['ships']},
            'built': os.path.getmtime(OUT) if os.path.exists(OUT) else None, 'saved': os.path.getmtime(CFG_P),
            'paths': {'config': CFG_P, 'out': OUT, 'cache': CACHE}}


def act_save(new):
    prev = load()
    E = validate(new, prev)
    if E:
        raise Fail('設定不合法，沒有存：\n' + '\n'.join('  ✗ ' + e for e in E))
    save(new)
    return ['✓ 存了 config/game.json（重建之後遊戲才吃得到）']


# ───────────────────────── 本機後台 ─────────────────────────
class Exclusive(HTTPServer):
    """埠被佔就綁不上。⛔ HTTPServer 預設開 SO_REUSEADDR：Windows 上那是「可以搶別人正在聽的埠」⇒ 第二次雙擊捷徑會再開一個、兩個一起聽（量過）。"""
    allow_reuse_address = False

    def server_bind(self):
        if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def serve(port, do_open=False):
    hosts = {'127.0.0.1:%d' % port, 'localhost:%d' % port}

    class H(BaseHTTPRequestHandler):
        def log_message(self, fmt, *a):
            sys.stderr.write('  %s %s\n' % (self.command, self.path))

        def send(self, code, body, ctype='application/json; charset=utf-8'):
            b = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode('utf-8')
            self.send_response(code)
            self.send_header('Content-Type', ctype)
            self.send_header('Content-Length', str(len(b)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(b)

        def guard(self, write):
            # 只認本機、寫入要帶自訂標頭（別的網頁的表單送不出它；跨來源的 fetch 會先問 OPTIONS，這裡不答）
            if self.headers.get('Host') not in hosts:
                self.send(403, {'ok': False, 'log': ['只接受 127.0.0.1／localhost']})
                return False
            if write and self.headers.get('X-Admin') != '1':
                self.send(403, {'ok': False, 'log': ['缺 X-Admin 標頭']})
                return False
            return True

        def body(self):
            n = int(self.headers.get('Content-Length') or 0)
            return json.loads(self.rfile.read(n).decode('utf-8') or '{}')

        def do_GET(self):
            if not self.guard(False):
                return
            if self.path == '/favicon.ico':
                return self.send(204, b'', 'image/x-icon')
            if self.path in ('/', '/index.html'):
                return self.send(200, open(PAGE, 'rb').read(), 'text/html; charset=utf-8')
            if self.path == '/api/state':
                return self.send(200, dict(act_state(), ok=True))
            self.send(404, {'ok': False, 'log': ['沒有這一頁']})

        def do_PUT(self):
            self.do_POST()

        def do_POST(self):
            if not self.guard(True):
                return
            try:
                b = self.body()
                if self.path == '/api/config':
                    log = act_save(b.get('config'))
                elif self.path == '/api/build':
                    log = act_build()
                elif self.path == '/api/import':
                    log = act_import(b.get('work'), b.get('id'), b.get('name'))
                elif self.path == '/api/reimport':
                    log = act_reimport(b.get('id'), b.get('work'))
                elif self.path == '/api/cache':
                    log = act_cache()
                else:
                    return self.send(404, {'ok': False, 'log': ['沒有這個動作']})
                self.send(200, {'ok': True, 'log': log})
            except Fail as e:
                self.send(400, {'ok': False, 'log': [str(e)]})
            except Exception as e:                       # 工具本身的錯：原樣回報，伺服器不停
                self.send(500, {'ok': False, 'log': ['%s: %s' % (type(e).__name__, e)]})

    url = 'http://127.0.0.1:%d/' % port
    try:
        srv = Exclusive(('127.0.0.1', port), H)         # 一次一個請求 ⇒ 存檔、建置、匯入不會同時寫
    except OSError:
        # 埠被佔：是已經開著的設定後台 ⇒ 只開頁面（雙擊捷徑兩次不會報錯）；是別的程式 ⇒ 說清楚、換埠
        try:
            with urllib.request.urlopen(url + 'api/state', timeout=5) as r:
                mine = json.loads(r.read().decode('utf-8')).get('ok') is True
        except Exception:
            mine = False
        if not mine:
            raise Fail('埠 %d 被別的程式佔了 ⇒ 帶 --port <別的埠>' % port)
        print('設定後台已經開著：%s' % url, flush=True)
        if do_open:
            webbrowser.open(url)
        return
    print('設定後台：%s　（Ctrl+C 或關掉這個視窗就結束；只聽本機）' % url, flush=True)
    if do_open:
        webbrowser.open(url)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser(description='《憲法號對轟》設定後台（TASK-0542）')
    sp = ap.add_subparsers(dest='op', required=True)
    sp.add_parser('check')
    sp.add_parser('build')
    sp.add_parser('cache')
    sp.add_parser('fmt')
    s = sp.add_parser('serve')
    s.add_argument('--port', type=int, default=8642)
    s.add_argument('--open', action='store_true', help='開好之後用預設瀏覽器打開後台頁')
    s = sp.add_parser('import')
    s.add_argument('--work', required=True)
    s.add_argument('--id', required=True)
    s.add_argument('--name', required=True)
    s.add_argument('--no-build', action='store_true')
    s = sp.add_parser('reimport')
    s.add_argument('--id', required=True)
    s.add_argument('--work')
    s.add_argument('--no-build', action='store_true')
    o = ap.parse_args()
    try:
        if o.op == 'serve':
            return serve(o.port, o.open)
        if o.op == 'check':
            log = act_check()
        elif o.op == 'build':
            log = act_build()
        elif o.op == 'cache':
            log = act_cache()
        elif o.op == 'fmt':
            cfg = load()
            E = validate(cfg)
            if E:
                raise Fail('設定不合法：\n' + '\n'.join('  ✗ ' + e for e in E))
            save(cfg)
            log = ['✓ 重新排版 config/game.json']
        elif o.op == 'import':
            log = act_import(o.work, o.id, o.name, not o.no_build)
        else:
            log = act_reimport(o.id, o.work, not o.no_build)
    except Fail as e:
        print(str(e))
        sys.exit(1)
    print('\n'.join(log))


if __name__ == '__main__':
    main()
