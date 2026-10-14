# 區塊職責：《憲法號對轟》的設定後台（TASK-0542）—— config/game.json（各項設定的初始值、船隻清單）的唯一寫入端：
#           驗設定、照船隻清單改寫 template.html 的船標籤、重建單檔成品、匯入新船、重新匯入舊船；serve 開一頁本機後台（同一組函式）。
# 物理意義：遊戲建置時把 game.json 內嵌進成品（js/00_config.js 讀成 CFG）⇒ 改預設 ＝ 改這份檔再重建，不是改 js。
#           船的 .vxk 由 senate 從雕刻作品匯出到 VoxelKit/_cache/（不入版控），vxk_inline.py 內嵌進成品。
# 失敗處置：設定不合法 ⇒ 列出每一格錯在哪、不寫檔；匯出／建置失敗 ⇒ 原樣印出那支工具的輸出、非零結束；
#           重新匯入失敗 ⇒ 舊的 .vxk 不動（新的先寫到 .new，成功才換上，舊的留成 .prev）。
#           _cache 跟指紋（config/vxk_lock.json）對不上 ⇒ 建置前從版控的成品換回，換不回就擋下（cache_guard）。
#
# 用法（在這個資料夾）：
#   python -I admin.py serve [--port 8642] [--open]  開設定後台（只聽 127.0.0.1）⇒ 瀏覽器開 http://127.0.0.1:8642/（--open 自動開；已經開著 ⇒ 只開頁面）
#     一鍵：雙擊 HtmlGames/ame_constitution_broadside/ame_constitution_broadside_admin.cmd（＝ serve --open）
#   python -I admin.py check                      驗 config/game.json
#   python -I admin.py build                      照設定重建 ../../ame_constitution_broadside/ame_constitution_broadside.html
#   python -I admin.py import --work <雕刻作品 ID> --id <船的代號> --name <名字>   匯入新船（匯出 .vxk、登記、重建）
#   python -I admin.py metasync --id <船的代號>   只同步 meta 與固定點（作品改了 meta、加了固定點，格子不動；TASK-0572）
#   python -I admin.py reimport --id <船的代號> [--work <作品 ID>]                 重新匯入（換新的 .vxk、印跟上一版的差別、重建）
#   python -I admin.py cache                      _cache/ 缺的、跟指紋不同的 .vxk 從版控那份成品裡解回來（換機器、只改程式時用；建置也會自己做）
#   python -I admin.py relock --id <船的代號>     指紋改成 _cache 現在那份（手動換過 .vxk 時；平常匯入／重新匯入／metasync 會自己更新）
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


# ───────────────────────── _cache 的指紋（.vxk 跟版控對得上才建） ─────────────────────────
# _cache 不入版控、建置直接讀它 ⇒ 它落後了（別的工作區 reimport／metasync 過、只拿到版控的成品）建置不會叫，成品默默換成舊船
#   （2026-10-14 bc1dfd9：艙房、甲板 meta 全掉）。⇒ 每艘 .vxk 的 sha1 記在 config/vxk_lock.json（入版控），建置前比：
#   對得上 ⇒ 照建；對不上 ⇒ 版控的成品裡內嵌的那份對得上指紋就自動換回（原檔留成 .stale）；也對不上 ⇒ 擋下不建（⛔ 不猜哪一份才對）。
#   匯入／重新匯入／metasync 寫了 .vxk 就更新指紋；要改用 _cache 現在那份（例如手動換過檔）⇒ relock。
LOCK_P = os.path.join(HERE, 'config', 'vxk_lock.json')


def sha1_bytes(b):
    return hashlib.sha1(b).hexdigest()


def lock_load():
    if not os.path.exists(LOCK_P):
        return {}
    return json.load(open(LOCK_P, encoding='utf-8'))


def lock_save(L):
    with open(LOCK_P, 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(L, ensure_ascii=False, indent=1, sort_keys=True) + '\n')


def lock_put(vxk):
    """_cache 那份 .vxk 寫好之後：指紋換成它。"""
    L = lock_load()
    L[vxk] = sha1_bytes(open(os.path.join(CACHE, vxk), 'rb').read())
    lock_save(L)
    return '  指紋 %s ← %s（config/vxk_lock.json，要跟成品一起提交）' % (vxk, L[vxk][:12])


def built_vxk(html, el):
    m = re.search(r'<script type="application/x-vxk" id="%s">([^<]*)</script>' % re.escape(el), html)
    return base64.b64decode(m.group(1)) if m else None


def cache_guard():
    """建置前：_cache 的每艘 .vxk 對指紋（見上）。回傳要印的行；對不上又換不回 ⇒ Fail。"""
    cfg, L, log, html, dirty = load(), lock_load(), [], None, False
    os.makedirs(CACHE, exist_ok=True)
    for s in cfg['ships']:
        p, want = os.path.join(CACHE, s['vxk']), L.get(s['vxk'])
        have = sha1_bytes(open(p, 'rb').read()) if os.path.exists(p) else None
        if want is None:                                 # 還沒登記（這個機制之前的船）⇒ 照 _cache 現在那份登記
            if have:
                L[s['vxk']], dirty = have, True
                log.append('  指紋 %s：第一次登記 %s（照 _cache 現在那份）' % (s['vxk'], have[:12]))
            continue
        if have == want:
            continue
        if html is None:
            html = open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
        b = built_vxk(html, s['el'])
        if b is not None and sha1_bytes(b) == want:
            if have:
                shutil.copy2(p, p + '.stale')
            open(p, 'wb').write(b)
            log.append('  ↺ %s：_cache %s 跟指紋 %s 不同 ⇒ 從版控的成品換回%s' % (s['vxk'], (have or '（沒有）')[:12], want[:12], '（原檔留成 %s.stale）' % s['vxk'] if have else ''))
            continue
        raise Fail('%s：_cache %s 跟指紋 %s 不同，成品裡內嵌的也不是指紋那一份 ⇒ 不建（會把船換成別的版本）。\n'
                   '  要用 _cache 現在這份 ⇒ python -I admin.py relock --id %s；要雕刻作品的最新版 ⇒ python -I admin.py reimport --id %s'
                   % (s['vxk'], (have or '（沒有）')[:12], want[:12], s['id'], s['id']))
    if dirty:
        lock_save(L)
    return log


def act_relock(sid):
    cfg = load()
    s = next((x for x in cfg['ships'] if x['id'] == sid), None)
    if not s:
        raise Fail('沒有代號 %s 的船' % sid)
    if not os.path.exists(os.path.join(CACHE, s['vxk'])):
        raise Fail('_cache 沒有 ' + s['vxk'])
    return [lock_put(s['vxk'])]

MENU = {'play': ('fun', 'real'), 'mode': ('pve', 'eve', 'sandbox'), 'sail': ('auto', 'manual', 'off'),
        'gfx': ('low', 'mid', 'high'), 'phx': ('full', 'high', 'mid', 'low')}
SHIP_CFG_KEYS = ('hard', 'flood', 'gunw', 'speed', 'agile', 'upwind', 'base')          # 每艘船的船隻設定（壓艙物照船算，不在這裡）
CREW = {'officers': (0, 8, True), 'helm': (0, 4, True), 'marines': (0, 60, True), 'marineGap': (5, 200, True),
        'top': (0, 8, True), 'monkeys': (0, 2, True), 'handsK': (0, 4, False)}
CREW_SHIP = {'hands': (0, 120, True)}          # 只在每艘船寫（TASK-0570 船隻配置頁的預設）：預備水手人數；沒寫 ＝ lim.hands × handsK
GUN_CREW_MAX = 8                               # 砲班滿編上限（砲旁的站位；遊戲 05_hull.js GUN_CREW_MAX）
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
        if 'burst' in g and not (isint(g['burst']) and 1 <= g['burst'] <= 20):
            err(p + '.burst', '連發：一份彈藥打幾發，1～20 的整數（沒寫 ＝ 1）')
        if 'burstGap' in g and not (isnum(g['burstGap']) and 0.02 <= g['burstGap'] <= 2):
            err(p + '.burstGap', '連發間隔：0.02～2 秒（沒寫 ＝ 0.15）')
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
            if k == 'guns' and not full:           # 每艘船的砲班滿編 { 砲種: 人 }（TASK-0570）：最少 ＝ 砲種表的 min
                if not isinstance(v, dict):
                    err(p + '.guns', '要是物件')
                    continue
                G = cfg.get('guns') if isinstance(cfg.get('guns'), dict) else {}
                for t, n in v.items():
                    g = G.get(t)
                    if not isinstance(g, dict):
                        err(p + '.guns.' + t, '不認得的砲種')
                    elif not (isint(n) and isint(g.get('min')) and g['min'] <= n <= GUN_CREW_MAX):
                        err(p + '.guns.' + t, '%s～%s 的整數' % (g.get('min'), GUN_CREW_MAX))
                continue
            spec = CREW.get(k) or (None if full else CREW_SHIP.get(k))
            if not spec:
                err(p + '.' + k, '不認得的鍵')
                continue
            lo, hi, it = spec
            if not ((isint(v) if it else isnum(v)) and lo <= v <= hi):
                err(p + '.' + k, '%s～%s 的%s' % (lo, hi, '整數' if it else '數字'))
        if full:
            for k in CREW:
                if k not in cx:
                    err(p + '.' + k, '缺')
    geo(cfg.get('geo0'), 'geo0', True)
    crew(cfg.get('crew0'), 'crew0', True)
    FU, RT = cfg.get('furniture') or {}, cfg.get('rooms') or {}

    def rooms(rm, p):
        # 甲板與艙房的預設（TASK-0568；遊戲 36_rooms.js）：{ 房名: '類型'（艙房自動擺滿）｜{ type, items: [{ it, x, y, r }] }（自訂；甲板 type=deck）}
        #   房名、格子要船型才驗得了 ⇒ 這裡只驗形狀；開戰時遊戲照格子再驗一次（擺不下的不擺）
        if not isinstance(rm, dict):
            return err(p, '要是物件 { 房名: 類型或擺法 }')
        for k, v in rm.items():
            q = p + '.' + k
            if isinstance(v, str):
                if v not in RT or RT[v].get('deck'):
                    err(q, '不認得的艙房類型 %s（rooms 裡的：%s）' % (v, '、'.join(x for x in RT if not RT[x].get('deck'))))
                continue
            if not (isinstance(v, dict) and v.get('type') in RT and isinstance(v.get('items'), list)):
                err(q, "要是類型字串或 { type, items }")
                continue
            for j, it in enumerate(v['items']):
                if not (isinstance(it, dict) and it.get('it') in FU and isint(it.get('x')) and isint(it.get('y')) and 0 <= it['x'] < 400 and 0 <= it['y'] < 400 and it.get('r', 0) in (0, 1)):
                    err('%s.items[%d]' % (q, j), '{ it: 物品, x, y: 0～399 的整數, r: 0 或 1 }')
                elif RT[v['type']].get('items') and it['it'] not in RT[v['type']]['items']:
                    err('%s.items[%d]' % (q, j), '%s 不能擺在 %s' % (it['it'], v['type']))
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
        if 'rooms' in s:
            rooms(s['rooms'], p + '.rooms')
        if 'lamps' in s:   # 船殼上的燈（格子做的；60_render.js vlampSet）：[{at: [x, y, z], r: 半徑幾格, color: 發光的格子 rgb332 代碼, rgb: [r, g, b] 光色 0～1}]，最多 4 盞
            L = s['lamps']
            if not (isinstance(L, list) and len(L) <= 4):
                err(p + '.lamps', '最多 4 盞的清單')
            else:
                for j, q in enumerate(L):
                    qp = '%s.lamps[%d]' % (p, j)
                    if not (isinstance(q, dict) and isinstance(q.get('at'), list) and len(q['at']) == 3 and all(isnum(v) for v in q['at'])):
                        err(qp + '.at', '[x, y, z]（船的格座標）')
                    elif not (isnum(q.get('r')) and 0 < q['r'] <= 30):
                        err(qp + '.r', '半徑 0～30 格')
                    elif not (isint(q.get('color')) and 0 <= q['color'] <= 255):
                        err(qp + '.color', '發光的格子顏色（rgb332 代碼 0～255）')
                    elif not (isinstance(q.get('rgb'), list) and len(q['rgb']) == 3 and all(isnum(v) and 0 <= v <= 2 for v in q['rgb'])):
                        err(qp + '.rgb', '光色 [r, g, b]，0～2')
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


def act_metasync(sid, build=True):
    """只同步 meta 與固定點（TASK-0572）：從雕刻作品匯出部件清單，把每條關聯的 meta、points 換進 _cache 那份 .vxk 的 header（路徑對得上的才換）；
    格子、繩、帆、模型一位元都不動 ⇒ 作品的船體改過也不會被帶進來（要換船體走 reimport）。對不上的路徑列出來（⛔ 不默默略過）。"""
    cfg = load()
    s = next((x for x in cfg['ships'] if x['id'] == sid), None)
    if not s:
        raise Fail('設定檔沒有這艘：' + sid)
    path = os.path.join(CACHE, s['vxk'])
    if not os.path.exists(path):
        raise Fail('_cache 沒有 ' + s['vxk'] + '（先 python -I admin.py cache）')
    senate = shutil.which('senate')
    if not senate:
        raise Fail('找不到 senate')
    tmp = os.path.join(CACHE, '_parts_' + sid + '.json')
    code, out = run([senate, 'cmd', 'sculpture', '--arg', 'op=export', '--arg', 'format=parts', '--arg', 'work=' + s['work'], '--arg', 'out=' + os.path.abspath(tmp)])
    if code != 0 or not os.path.exists(tmp):
        raise Fail('部件清單匯出失敗（exit %d）：' + chr(10) + '%s' % (code, out.strip()))
    P = {q['path']: q for q in json.load(open(tmp, encoding='utf-8')).get('links', [])}
    os.remove(tmp)
    raw = zlib.decompress(open(path, 'rb').read(), -15)
    n = struct.unpack('<I', raw[4:8])[0]
    h = json.loads(raw[8:8 + n].decode('utf-8'))
    ch, miss = [], []
    for q in h.get('parts', []):
        src = P.get(q.get('path'))
        if not src:
            miss.append(q.get('path'))
            continue
        m, pt = src.get('meta') or {}, src.get('points') or {}
        if (q.get('meta') or {}) != m or (q.get('points') or {}) != pt:
            ch.append(q['path'])
            q['meta'], q['points'] = m, pt
    new = sorted(set(P) - {q.get('path') for q in h.get('parts', [])})
    log = ['metasync %s：%d 條關聯換了 meta／固定點%s' % (sid, len(ch), ('：' + '、'.join(ch)) if ch else '')]
    if miss:
        log.append('⚠ .vxk 有、作品裡沒有的關聯 %d 條（照舊）：%s' % (len(miss), '、'.join(miss)))
    if new:
        log.append('⚠ 作品裡新加、.vxk 還沒有的關聯 %d 條（要 reimport 才帶得進來）：%s' % (len(new), '、'.join(new)))
    if ch:
        hb = json.dumps(h, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        body = b'VXK1' + struct.pack('<I', len(hb)) + hb + raw[8 + n:]
        co = zlib.compressobj(9, zlib.DEFLATED, -15)
        open(path + '.tmp', 'wb').write(co.compress(body) + co.flush())
        os.replace(path + '.tmp', path)
        log.append(lock_put(s['vxk']))
        if build:
            log += act_build()
    return log


def act_check():
    E = validate(load())
    if E:
        raise Fail('設定不合法：\n' + '\n'.join('  ✗ ' + e for e in E))
    return ['✓ config/game.json 合法（%d 艘船、%d 個滑桿、%d 種砲）' % (len(load()['ships']), len(load()['lim']), len(load()['guns']))]


def act_build(pack=True):   # pack：壓縮版（預設，TASK-0583）；False ＝ 原格式（build --raw）
    cfg = load()
    E = validate(cfg)
    if E:
        raise Fail('設定不合法，不建置：\n' + '\n'.join('  ✗ ' + e for e in E))
    log = cache_guard() + ['template.html 的船標籤' + ('照設定改寫了' if sync_template(cfg) else '跟設定一致')]
    miss = [s['vxk'] for s in cfg['ships'] if not os.path.exists(os.path.join(CACHE, s['vxk']))]
    if miss:
        raise Fail('VoxelKit/_cache/ 少了 %s ⇒ 先 python -I admin.py cache（從成品解回）或 reimport' % '、'.join(miss))
    code, out = run([sys.executable, '-I', INLINE, TPL, OUT])
    log.append(out.strip())
    if code != 0:
        raise Fail('\n'.join(log) + '\n✗ 建置失敗（exit %d）' % code)
    if pack:
        log += pack_html(OUT)
    return log

# ───────────────────────── 壓縮版成品（預設；build --raw ＝ 原格式。Tim 2026-10-14，TASK-0583：雕刻作品與匯出的 .vxk 格式不變，匯進遊戲才壓縮） ─────────────────────────
# 量過（六艘、壓縮後）：格子合計約 0.87 MB，模型網格（砲、燈、舵輪…的三角形，header 的 rig.meshes）約 3.50 MB ⇒ 大頭是網格：
#   ① 同一份網格（同一門砲的模型）在幾艘船上各存一份 —— 161 種裡 55 種出現在兩艘以上 ⇒ 成品裡收成一個池子（<script id="vxk-meshes">），每艘只記編號；
#   ② 頂點逐角存（三角形的每一角一個頂點）⇒ 同一點只存一次、照順序存差值（整數 ×100：座標全是 0.01 的倍數，量過誤差 ≤ 4e-12）、三角形的索引也存差值。
#   兩招一起：網格 3.50 → 0.85 MB。格子、繩、帆照原樣。
# 只動成品裡內嵌的那一份：_cache 的 .vxk、指紋（vxk_lock.json）不動；遊戲讀的時候還原（05_hull.js meshPool），三角形一個一個比過、對不上的那一份照原樣留在船裡。
# ⛔ 壓縮過的成品解不回原檔（cache 會擋）：_cache 掉了要 reimport。
POOL_EL = 'vxk-meshes'
POOL_Q = 100


def _deflate(b):
    c = zlib.compressobj(9, zlib.DEFLATED, -15)
    return c.compress(b) + c.flush()


def mesh_pack(m):
    """一份網格 ⇒ 池子裡那一格（同一點只存一次、差值）；還原不回原樣（不是 0.01 的倍數）⇒ None。"""
    V, idx, U, remap = m['verts'], {}, [], []
    for i in range(0, len(V), 3):
        k = (round(V[i] * POOL_Q), round(V[i + 1] * POOL_Q), round(V[i + 2] * POOL_Q))
        if k[0] / POOL_Q != V[i] or k[1] / POOL_Q != V[i + 1] or k[2] / POOL_Q != V[i + 2]:
            return None
        if k not in idx:
            idx[k] = len(U)
            U.append(k)
        remap.append(idx[k])
    v, p = [], (0, 0, 0)
    for q in U:
        v += [q[0] - p[0], q[1] - p[1], q[2] - p[2]]
        p = q
    t, pt = [], 0
    for i in m['tris']:
        x = remap[i]
        t.append(x - pt)
        pt = x
    return {'v': v, 't': t, 'tmat': m['tmat'], 'mats': m['mats']}


def mesh_unpack(e):
    """池子裡那一格 ⇒ 網格（跟 05_hull.js meshPoolMesh 同一個算法；驗算用）。"""
    V, p = [], [0, 0, 0]
    for i in range(0, len(e['v']), 3):
        p = [p[0] + e['v'][i], p[1] + e['v'][i + 1], p[2] + e['v'][i + 2]]
        V += [p[0] / POOL_Q, p[1] / POOL_Q, p[2] / POOL_Q]
    T, x = [], 0
    for d in e['t']:
        x += d
        T.append(x)
    return {'verts': V, 'tris': T, 'tmat': e['tmat'], 'mats': e['mats']}


def same_tris(a, b):
    """兩份網格的三角形一個一個比：每一角的座標、材質都一樣（頂點的編號可以不同）。"""
    if len(a['tris']) != len(b['tris']) or a['tmat'] != b['tmat'] or a['mats'] != b['mats']:
        return False
    va, vb = a['verts'], b['verts']
    for ia, ib in zip(a['tris'], b['tris']):
        if va[ia * 3:ia * 3 + 3] != vb[ib * 3:ib * 3 + 3]:
            return False
    return True


def pack_html(path):
    """成品（vxk_inline.py 嵌好的）⇒ 壓縮模式：每艘的網格換成池子編號、加一個池子。回傳讀數。"""
    html = open(path, encoding='utf-8').read()
    if 'id="%s"' % POOL_EL in html:
        raise Fail('成品已經是壓縮模式（有 #%s）' % POOL_EL)
    pool, where, log, keep = [], {}, [], 0
    size0 = len(html.encode('utf-8'))

    def one(mt):
        nonlocal keep
        if len(mt.group(2)) < 64:   # 程式註解裡的「<script type="application/x-vxk" id="…">base64</script>」不是船
            return mt.group(0)
        raw = zlib.decompress(base64.b64decode(mt.group(2)), -15)
        n = struct.unpack('<I', raw[4:8])[0]
        h = json.loads(raw[8:8 + n].decode('utf-8'))
        ms = (h.get('rig') or {}).get('meshes')
        if not ms:
            return mt.group(0)
        out = []
        for m in ms:
            key = hashlib.sha1(json.dumps(m, separators=(',', ':')).encode()).hexdigest()
            if key not in where:
                e = mesh_pack(m)
                if e is None or not same_tris(m, mesh_unpack(e)):
                    where[key] = -1
                else:
                    where[key] = len(pool)
                    pool.append(e)
            if where[key] < 0:
                out.append(m)
                keep += 1
            else:
                out.append({'pool': where[key]})
        h['rig']['meshes'] = out
        h['mesh_pool'] = POOL_EL
        hb = json.dumps(h, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        b = base64.b64encode(_deflate(b'VXK1' + struct.pack('<I', len(hb)) + hb + raw[8 + n:])).decode('ascii')
        return mt.group(1) + b + mt.group(3)

    RX = r'(<script type="application/x-vxk" id="[^"]+">)([^<]*)(</script>)'
    first = next(mt for mt in re.finditer(RX, html) if len(mt.group(2)) >= 64).start()   # 池子放在第一艘船前面（⛔ 照字串找第一個：voxelkit.js 的註解裡就有一模一樣的標籤 ⇒ 池子插進程式中間）
    html2 = html[:first] + '\x00POOL\x00' + html[first:]
    html2, k = re.subn(RX, one, html2)
    k = sum(1 for mt in re.finditer(RX, html) if len(mt.group(2)) >= 64)
    pb = base64.b64encode(_deflate(json.dumps({'v': 1, 'q': POOL_Q, 'meshes': pool}, separators=(',', ':')).encode('utf-8'))).decode('ascii')
    tag = '<script type="application/x-vxk-meshes" id="%s">%s</script>\n' % (POOL_EL, pb)
    html2 = html2.replace('\x00POOL\x00', tag, 1)
    nv, E = pack_verify(html2)                                  # 寫出去之前：照遊戲的讀法還原、跟 _cache 原檔逐個比（對不上 ⇒ 不寫，舊成品留著）
    if E:
        raise Fail('壓縮版還原出來跟原檔對不上（成品沒寫）：\n' + '\n'.join('  ✗ ' + e for e in E[:12]))
    log.append('✓ 還原驗算：%d 艘、%d 份網格的三角形跟 _cache 原檔逐個相同，格子、繩、帆一位元組不差' % (k, nv))
    open(path, 'w', encoding='utf-8', newline='').write(html2)
    size1 = len(html2.encode('utf-8'))
    log.append('✓ 壓縮模式：%d 艘、網格池 %d 份（%d KB）%s；成品 %.2f MB → %.2f MB（−%.0f%%）' % (
        k, len(pool), len(pb) // 1024, '、照原樣留在船裡 %d 份' % keep if keep else '', size0 / 1048576, size1 / 1048576, (1 - size1 / size0) * 100))
    return log


def pack_verify(html):
    """壓縮版成品 ⇒ 每艘照遊戲的讀法還原（池子編號 ⇒ 池子那一格 ⇒ mesh_unpack），跟 _cache 原檔比：
    網格的三角形逐個相同；header 其他欄位相同；格子那一段一位元組不差。回傳 (比了幾份網格, 錯誤清單)。原格式的成品 ⇒ 只比格子與 header。"""
    m = re.search(r'<script type="application/x-vxk-meshes" id="%s">([^<]*)</script>' % POOL_EL, html)
    P = json.loads(zlib.decompress(base64.b64decode(m.group(1)), -15)) if m else None
    n, E = 0, []
    for s in load()['ships']:
        mt = re.search(r'<script type="application/x-vxk" id="%s">([^<]*)</script>' % re.escape(s['el']), html)
        if not mt:
            E.append('%s：成品裡沒有 #%s' % (s['id'], s['el']))
            continue
        a = zlib.decompress(base64.b64decode(mt.group(1)), -15)
        b = zlib.decompress(open(os.path.join(CACHE, s['vxk']), 'rb').read(), -15)
        na, nb = struct.unpack('<I', a[4:8])[0], struct.unpack('<I', b[4:8])[0]
        ha, hb = json.loads(a[8:8 + na].decode('utf-8')), json.loads(b[8:8 + nb].decode('utf-8'))
        if a[8 + na:] != b[8 + nb:]:
            E.append('%s：格子那一段跟原檔不一樣' % s['id'])
        ma, mb = (ha.get('rig') or {}).get('meshes') or [], (hb.get('rig') or {}).get('meshes') or []
        if ha.pop('mesh_pool', None):
            if P is None:
                E.append('%s：header 說有網格池，成品裡沒有 #%s' % (s['id'], POOL_EL))
                continue
            ma = [mesh_unpack(P['meshes'][x['pool']]) if isinstance(x, dict) and 'pool' in x else x for x in ma]
        if len(ma) != len(mb):
            E.append('%s：網格 %d 份，原檔 %d 份' % (s['id'], len(ma), len(mb)))
            continue
        for i, (x, y) in enumerate(zip(ma, mb)):
            n += 1
            if not same_tris(x, y):
                E.append('%s：第 %d 份網格的三角形跟原檔不一樣' % (s['id'], i))
        if ha.get('rig'):
            ha['rig'] = dict(ha['rig'], meshes=None)
        if hb.get('rig'):
            hb['rig'] = dict(hb['rig'], meshes=None)
        if ha != hb:
            E.append('%s：header（網格以外）跟原檔不一樣' % s['id'])
    return n, E


def act_verify():
    """成品 ⇒ 跟 _cache 原檔比（壓縮版照遊戲的讀法還原）。"""
    if not os.path.exists(OUT):
        raise Fail('還沒有成品（先 build）')
    html = open(OUT, encoding='utf-8').read()
    n, E = pack_verify(html)
    if E:
        raise Fail('成品跟 _cache 原檔對不上：\n' + '\n'.join('  ✗ ' + e for e in E[:20]))
    return ['✓ 成品（%s）跟 _cache 原檔相同：%d 份網格的三角形逐個比過，格子、header 一致' % ('壓縮版' if 'id="%s"' % POOL_EL in html else '原格式', n)]



def act_cache():
    """_cache/ 缺的 .vxk 從版控那份成品（內嵌的 base64）解回來。"""
    log = cache_guard()
    cfg = load()
    html = open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
    packed = 'id="%s"' % POOL_EL in html
    os.makedirs(CACHE, exist_ok=True)
    for s in cfg['ships']:
        p = os.path.join(CACHE, s['vxk'])
        if os.path.exists(p):
            log.append('  %s：已有（%d bytes）' % (s['vxk'], os.path.getsize(p)))
            continue
        if packed:   # 壓縮版（預設的 build；TASK-0583）：網格換成了池子編號，解出來的不是原檔（指紋對不上）
            log.append('  %s：成品是壓縮模式，解不回原本的 .vxk ⇒ 要 reimport' % s['vxk'])
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
    log = ['✓ 匯出 %s ← %s' % (ship['vxk'], work)] + ['  %s：%s' % (n, info.get(k)) for k, n in DIFF_KEYS] + [lock_put(ship['vxk'])]
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
    log.append(lock_put(s['vxk']))
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
            path = self.path.split('?')[0]
            if path in ('/', '/index.html'):
                return self.send(200, open(PAGE, 'rb').read(), 'text/html; charset=utf-8')
            if path == '/game':                      # 後台嵌的甲板與艙房編輯器（成品 ?admin=rooms；要船型的格子 ⇒ 用建好的成品）
                if not os.path.exists(OUT):
                    return self.send(404, {'ok': False, 'log': ['還沒建置成品']})
                return self.send(200, open(OUT, 'rb').read(), 'text/html; charset=utf-8')
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
    s = sp.add_parser('build')
    s.add_argument('--raw', action='store_true', help='原格式（不壓縮）；預設是壓縮版：模型網格收成一個池子（同一份只存一次、頂點去重＋差值），_cache 不動')
    sp.add_parser('verify', help='成品跟 _cache 原檔比（壓縮版照遊戲的讀法還原）')
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
    s = sp.add_parser('metasync', help='只同步 meta 與固定點（格子不動）')
    s.add_argument('--id', required=True)
    s.add_argument('--no-build', action='store_true')
    s = sp.add_parser('relock', help='指紋改成 _cache 現在那份')
    s.add_argument('--id', required=True)
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
            log = act_build(not o.raw)
        elif o.op == 'verify':
            log = act_verify()
        elif o.op == 'cache':
            log = act_cache()
        elif o.op == 'fmt':
            cfg = load()
            E = validate(cfg)
            if E:
                raise Fail('設定不合法：\n' + '\n'.join('  ✗ ' + e for e in E))
            save(cfg)
            log = ['✓ 重新排版 config/game.json']
        elif o.op == 'relock':
            log = act_relock(o.id)
        elif o.op == 'metasync':
            log = act_metasync(o.id, not o.no_build)
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
