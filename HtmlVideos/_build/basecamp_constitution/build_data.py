# 《龍骨是直的》動畫版的資料：從雕刻作品重產「哪一格在第幾個階段出現／消失」＋繩＋帆，壓成一個二進位檔
# 用法：python -I build_data.py <輸出 .bin> <快取資料夾>
#   · 船殼（本作品）照時間標記重播：每個階段結束那一刻的樣子（export mark=<名>:end）
#   · 子作品照關聯（at、mirror y）放回世界座標；多事件的（桅杆＋帆桁、砲具兩輪）另外重播到第一刀
#   · 對拍：最後一個階段的全船 ＝ 組裝件現在的匯出（逐格、逐色）；對不上就停
#   · 降成 2×2×2（0.2 m）一格：顏色取那 8 格裡最多的、群組取第一次出現時最多的
#   · 繩、帆從 export obj 拿（繩取每圈 8 點的中心當中線）
import sys, os, re, json, zlib, struct, subprocess, hashlib
import numpy as np

WORK = 'basecamp-frigate-constitution-01m'
ASM = WORK + '-assembly'
SX, SY, SZ = 1024, 320, 800

# ── 階段表（id 從 1 起；跟 HTML 那邊的 STEPS 同一份順序）──
# hull ＝ 這個階段結束時船殼重播到的標記；links ＝ 這個階段加進來（或換成新狀態）的關聯
STEPS = [
    dict(id=1, hull='龍骨'),
    dict(id=2, hull='艏艉柱'),
    dict(id=3, hull='內艉柱與deadwood'),
    dict(id=4, hull='底肋'),
    dict(id=5, hull='肋骨'),
    dict(id=6, hull='兩頭骨架'),
    dict(id=7, hull='船殼'),
    dict(id=8, hull='補空腔'),
    dict(id=9, hull='船殼內部'),
    dict(id=10, links=['甲板-orlop', '甲板-berth', '甲板-gun', '甲板-spar']),
    dict(id=11, links=['*艙房', '*艙房-鏡像', '*艙壁']),
    dict(id=12, hull='舷牆'),
    dict(id=13, hull='艏斜桅開口', links=['前桅@first', '主桅@first', '後桅@first', '艏斜桅@first']),
    dict(id=14, hull='船尾窗', links=['船尾裝飾']),
    dict(id=15, links=['船頭-knee', '船頭裝飾', '船頭裝飾-鏡像']),
    dict(id=16, links=['前桅', '主桅', '後桅', '艏斜桅']),
    dict(id=17, links=['舵']),
    dict(id=18, links=['channels', 'channels-鏡像']),
    dict(id=19, links=['甲板-spar/fife-rails', '繫繩欄', '繫繩欄-鏡像']),
    dict(id=20, links=['*砲-']),
    dict(id=21, links=['甲板-gun/砲具@first', '甲板-gun/砲具-鏡像@first']),
    dict(id=22, links=['甲板-gun/砲具', '甲板-gun/砲具-鏡像']),
    dict(id=23, links=['甲板-gun/梯子', '甲板-berth/梯子']),
]
# 多事件的子作品：第一個狀態重播到哪一刀（之後那一刀是帆桁／砲具第二輪）
FIRST = {
    WORK + '-mast-main': '174240_602_37d282.json',
    WORK + '-mast-fore': '173919_865_163ec7.json',
    WORK + '-mast-mizzen': '173922_973_a8bc6f.json',
    WORK + '-bowsprit': '173923_999_bc2010.json',
    WORK + '-gun-fittings': '215610_707_07862b.json',
}
# 群組（HTML 的開關）：0 骨架 1 外板 2 船殼內部 3 甲板 4 房間 5 桅杆與帆桁 6 船頭船尾與舵 7 舷側與繫繩點 8 砲 9 梯子
HULL_GROUP = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 1, 8: 1, 9: 2, 12: 1, 13: 1, 14: 1}


def link_group(path):
    if path.startswith('甲板-') and path.count('/') == 0:
        return 3
    if '艙房' in path or '艙壁' in path:
        return 4
    if path in ('前桅', '主桅', '後桅', '艏斜桅'):
        return 5
    if path in ('船尾裝飾', '船頭-knee', '船頭裝飾', '船頭裝飾-鏡像', '舵'):
        return 6
    if path.startswith('channels') or path.startswith('繫繩欄') or path.endswith('fife-rails'):
        return 7
    if '/砲' in path:
        return 8
    if path.endswith('梯子'):
        return 9
    raise ValueError(path)


def link_level(path):
    """這條關聯屬於哪一層甲板（關掉一層 ＝ 那一層的甲板、房間、砲、梯子一起藏；跟作品裡藏 甲板-gun 連底下一起藏同一個道理）。"""
    for i, d in enumerate(('甲板-orlop', '甲板-berth', '甲板-gun', '甲板-spar')):
        if path == d or path.startswith(d + '/'):
            return i + 1
    return 0


def run(args):
    r = subprocess.run(['senate', 'cmd', 'sculpture'] + args, capture_output=True, text=True, encoding='utf-8', errors='replace')
    return r


def export_list(cache, work, mark=None, links=None):
    key = hashlib.sha1(('%s|%s|%s' % (work, mark, links)).encode()).hexdigest()[:16]
    p = os.path.join(cache, key + '.npy')
    if os.path.exists(p):
        return np.load(p)
    out = os.path.join(cache, key + '.txt').replace('\\', '/')
    a = ['--arg', 'op=export', '--arg', 'format=list', '--arg', 'work=' + work, '--arg', 'out=' + out]
    if mark:
        a += ['--arg', 'mark=' + mark]
    if links:
        a += ['--arg', 'links=' + links]
    r = run(a)
    if r.returncode != 0 or not os.path.exists(out):
        raise SystemExit('匯出失敗 %s %s：%s' % (work, mark, (r.stdout + r.stderr)[-500:]))
    arr = np.loadtxt(out, delimiter=',', comments='#', dtype=np.int32, ndmin=2, encoding='utf-8')
    os.remove(out)
    np.save(p, arr)
    print('  匯出', work, mark or '', len(arr))
    return arr


def read_links():
    r = run(['--arg', 'op=work', '--arg', 'sub=links', '--arg', 'work=' + ASM])
    out = []
    for line in r.stdout.splitlines():
        m = re.match(r'^\s*- `([^`]+)` → (\S+)《.*?@(-?\d+),(-?\d+),(-?\d+) turn (\d+)( mirror y)?', line)
        if m:
            out.append(dict(path=m.group(1), src=m.group(2), at=(int(m.group(3)), int(m.group(4)), int(m.group(5))),
                            turn=int(m.group(6)), mirror=bool(m.group(7))))
    assert all(l['turn'] == 0 for l in out), '有 turn ≠ 0 的關聯（這支程式只做平移＋鏡像）'
    return out


def keyof(a):
    return (a[:, 0].astype(np.int64) * SY + a[:, 1]) * SZ + a[:, 2]


def place(local, lk, sizes):
    w = local[:, :4].copy()
    if lk['mirror']:
        w[:, 1] = sizes[lk['src']][1] - 1 - w[:, 1]
    w[:, 0] += lk['at'][0]
    w[:, 1] += lk['at'][1]
    w[:, 2] += lk['at'][2]
    return w


def work_size(src):
    root = 'D:/Unity/Valhalla/Sculpture/works/' + src + '/work.json'
    j = json.load(open(root, encoding='utf-8'))
    return (j['size_x'], j['size_y'], j['size_z'])


def match_links(pattern, links):
    if pattern.startswith('*'):
        return [l for l in links if pattern[1:] in l['path'].split('/')[-1] and ('/' in l['path'])]
    return [l for l in links if l['path'] == pattern]


def obj_ropes_sails(cache):
    p = os.path.join(cache, 'rig.json')
    if os.path.exists(p):
        return json.load(open(p, encoding='utf-8'))
    d = os.path.join(cache, 'obj')
    os.makedirs(d, exist_ok=True)
    for f in os.listdir(d):
        os.remove(os.path.join(d, f))
    r = run(['--arg', 'op=export', '--arg', 'format=obj', '--arg', 'work=' + ASM, '--arg', 'region=400..401,155..165,0..12',
             '--arg', 'out_dir=' + d.replace('\\', '/'), '--arg', 'persona=basecamp'])
    objf = [f for f in os.listdir(d) if f.endswith('.obj')][0]
    mtl = {}
    cur = None
    for line in open(os.path.join(d, objf[:-4] + '.mtl'), encoding='utf-8'):
        if line.startswith('newmtl '):
            cur = line.split()[1]
        elif line.startswith('Kd ') and cur:
            mtl[cur] = [float(v) for v in line.split()[1:4]]
    objs, cur = [], None
    V = []
    for line in open(os.path.join(d, objf), encoding='utf-8'):
        if line.startswith('o '):
            nm = line.split('#', 1)[1].strip() if '#' in line else line.split()[1]
            cur = dict(kind=line.split()[1].split('_')[0], name=nm, v0=len(V), faces=[], mtl=None)
            objs.append(cur)
        elif line.startswith('v '):
            X, Y, Z = (float(v) for v in line.split()[1:4])
            V.append([X, Z, Y])          # obj 是 Y 朝上（x, 高, y）⇒ 換回作品的 (x, y, z)
        elif line.startswith('usemtl ') and cur is not None:
            cur['mtl'] = line.split()[1]
        elif line.startswith('f ') and cur is not None and cur['kind'] in ('rope', 'sail'):
            cur['faces'].append([int(t.split('/')[0]) - 1 for t in line.split()[1:]])
    V = np.array(V)
    ropes, sails = [], []
    for i, o in enumerate(objs):
        if o['kind'] not in ('rope', 'sail'):
            continue
        v1 = objs[i + 1]['v0'] if i + 1 < len(objs) else len(V)
        pts = V[o['v0']:v1]
        if o['kind'] == 'rope':
            assert len(pts) % 8 == 0, (o['name'], len(pts))
            rings = pts.reshape(-1, 8, 3)
            c = rings.mean(axis=1)
            rad = float(np.linalg.norm(rings[0] - c[0], axis=1).mean())
            ropes.append(dict(name=o['name'], color=mtl.get(o['mtl'], [0.2, 0.2, 0.2]), radius=rad, pts=np.round(c, 3).tolist()))
        else:
            tri = []
            for f in o['faces']:
                for k in range(1, len(f) - 1):
                    tri.append([f[0] - o['v0'], f[k] - o['v0'], f[k + 1] - o['v0']])
            sails.append(dict(name=o['name'], color=mtl.get(o['mtl'], [0.95, 0.92, 0.85]), verts=np.round(pts, 3).tolist(), tris=tri))
    rig = dict(ropes=ropes, sails=sails)
    json.dump(rig, open(p, 'w', encoding='utf-8'))
    return rig


SLACK = 0.12


def face_masks(K, G, ON, FON, OFF, FOFF, dx, dy, dz, keep_py, keep_pz):
    """每一段方塊的 6 個面（+x −x +y −y +z −z ＝ bit 0..5）：鄰格同群組、在它出現時已經在（同一階段容許晚 0.03）、
    它消失時還在 ⇒ 那一面看不到，片段著色器丟掉（同一階段裡的先後容許 SLACK：同一層有固定種子的抖動，相鄰兩格常差 0.03 以上；
    放寬的代價是建造前緣的格子側面晚一點才補上）（不然相鄰兩格的側面會在接縫打架，遠看是一層格紋）。
    剖面切得到的那幾層（keep_py／keep_pz）的 +y／+z 面照留。六面全蓋住的整段不送。"""
    n = len(K)
    comp = K.astype(np.float64) * 4096 + ON * 64.0 + FON * 63.0
    o = np.argsort(comp, kind='stable')
    cs = comp[o]
    mask = np.zeros(n, np.uint8)
    for bit, d in enumerate((dx, -dx, dy, -dy, dz, -dz)):
        q = (K + d).astype(np.float64) * 4096 + ON * 64.0 + np.minimum(FON + SLACK, 1.0) * 63.0
        j = np.searchsorted(cs, q, 'right') - 1
        jj = o[np.clip(j, 0, n - 1)]
        ok = (j >= 0) & (K[jj] == K + d) & (G[jj] == G)
        ok &= (OFF[jj] == 255) | ((OFF != 255) & ((OFF[jj] > OFF) | ((OFF[jj] == OFF) & (FOFF[jj] >= FOFF - SLACK))))
        if bit == 2:
            ok &= ~keep_py
        if bit == 4:
            ok &= ~keep_pz
        mask |= ok.astype(np.uint8) << bit
    return mask


def main():
    out_bin, cache = sys.argv[1], sys.argv[2]
    sys.stdout.reconfigure(encoding='utf-8')
    os.makedirs(cache, exist_ok=True)
    links = read_links()
    sizes = {l['src']: work_size(l['src']) for l in links}
    print('關聯', len(links))

    # ── 全船現況（對拍用）──
    asm = export_list(cache, ASM, links='all')
    # ── 子作品：每條關聯的世界格（現況、第一刀）──
    wcells = {}
    for l in links:
        if l['src'] == WORK:
            continue
        loc = export_list(cache, l['src'], links='none')
        wcells[(l['path'], 'now')] = place(loc, l, sizes)
        if l['src'] in FIRST:
            loc1 = export_list(cache, l['src'], mark=FIRST[l['src']], links='none')
            wcells[(l['path'], 'first')] = place(loc1, l, sizes)
    hull_now = export_list(cache, WORK, links='none')
    hull_at = {}
    for s in STEPS:
        if s.get('hull'):
            hull_at[s['id']] = export_list(cache, WORK, mark=s['hull'] + ':end', links='none')

    # 對拍：船殼現況 ＋ 每條關聯現況 ＝ 組裝件
    parts = [hull_now] + [v for (p, k), v in wcells.items() if k == 'now']
    allc = np.concatenate(parts)
    ka, kb = keyof(allc), keyof(asm)
    assert len(np.unique(ka)) == len(ka), ('子作品之間有重疊', len(ka) - len(np.unique(ka)))
    oa, ob = np.argsort(ka), np.argsort(kb)
    assert len(ka) == len(kb) and (ka[oa] == kb[ob]).all() and (allc[oa, 3] == asm[ob, 3]).all(), ('跟組裝件對不上', len(ka), len(kb))
    last_hull = max(hull_at)
    kh = keyof(hull_at[last_hull])
    same = len(kh) == len(hull_now) and (np.sort(kh) == np.sort(keyof(hull_now))).all()
    print('對拍：組裝件 %d 格逐格相等；船殼最後一個標記 = 現況：%s' % (len(kb), same))
    if not same:
        hull_at[23] = hull_now      # 船殼在最後一個標記之後還有改 ⇒ 最後一個階段補成現況

    # ── 每個階段結束時的全船（fine）──
    link_state = {}         # path → (step, cells, group)
    states = []
    hull_cur, hull_step = None, None
    for s in STEPS:
        sid = s['id']
        if sid in hull_at:
            hull_cur, hull_step = hull_at[sid], sid
        for pat in s.get('links', []):
            mode = 'now'
            if pat.endswith('@first'):
                pat, mode = pat[:-6], 'first'
            ms = match_links(pat, links)
            assert ms, pat
            for l in ms:
                link_state[l['path']] = (sid, wcells[(l['path'], mode)], link_group(l['path']) + 16 * link_level(l['path']))
        states.append((sid, hull_cur, dict(link_state)))
    # 對拍（二）：最後一個階段的全船本身（船殼最後一個標記＋各關聯的狀態）跟組裝件逐格、逐色相等 —— 上面那一條只對拍「現況的部件」
    _, h_last, ls_last = states[-1]
    fin = np.concatenate([h_last[:, :4]] + [v[1][:, :4] for v in ls_last.values()])
    kf = keyof(fin)
    of = np.argsort(kf)
    assert len(kf) == len(kb) and (kf[of] == kb[ob]).all() and (fin[of, 3] == asm[ob, 3]).all(), ('最後一個階段跟組裝件對不上', len(kf), len(kb))
    print('對拍：最後一個階段 %d 格跟組裝件逐格、逐色相等' % len(kf))
    # 船殼每一格第一次出現的階段 ⇒ 群組
    hull_origin = {}
    seen = np.zeros(0, np.int64)
    for sid in sorted(hull_at):
        k = keyof(hull_at[sid])
        new = np.setdiff1d(k, seen)
        hull_origin[sid] = new
        seen = np.union1d(seen, k)
    hk_all = np.concatenate([hull_origin[s] for s in sorted(hull_origin)])
    hk_grp = np.concatenate([np.full(len(hull_origin[s]), HULL_GROUP.get(s, 1), np.int8) for s in sorted(hull_origin)])
    o = np.argsort(hk_all)
    hk_all, hk_grp = hk_all[o], hk_grp[o]

    def coarse_state(hull, lstate):
        arrs, grps = [hull[:, :4]], []
        kh_ = keyof(hull)
        grps.append(hk_grp[np.searchsorted(hk_all, kh_)])
        for p, (sid, cells, g) in lstate.items():
            arrs.append(cells[:, :4])
            grps.append(np.full(len(cells), g, np.int8))
        a = np.concatenate(arrs)
        g = np.concatenate(grps)
        ck = ((a[:, 0] // 2).astype(np.int64) * 160 + a[:, 1] // 2) * 400 + a[:, 2] // 2
        # 顏色：每個粗格裡票數最多的顏色（同票取小的色號）；露在空氣裡的格（6 鄰居有空）一格算 9 票
        # —— 外板的漆只有 1～2 格厚，後面是肋骨與內板的木色；只數格數的話，白帶裡會冒出褐色、銅底冒出灰色（Tim 2026-10-11：「船殼好像都有點斑駁」）
        fk = keyof(a)
        sk = np.sort(fk)
        def has(q):
            i = np.searchsorted(sk, q)
            i[i >= len(sk)] = 0
            return sk[i] == q
        inner = np.ones(len(fk), bool)
        for d in (SY * SZ, -SY * SZ, SZ, -SZ, 1, -1):
            inner &= has(fk + d)
        wgt = np.where(inner, 1, 9)
        cc = ck * 256 + a[:, 3]
        u, inv = np.unique(cc, return_inverse=True)
        n = np.bincount(inv.ravel(), weights=wgt)
        uk = u // 256
        order = np.lexsort((-(u % 256), n, uk))     # 依粗格、票數、色號
        last = np.r_[uk[order][1:] != uk[order][:-1], True]
        sel = order[last]
        keys, cols = uk[sel], (u[sel] % 256).astype(np.uint8)
        gg = ck * 128 + g
        ug, ng = np.unique(gg, return_counts=True)
        ugk = ug // 128
        og = np.lexsort((ng, ugk))
        lg = np.r_[ugk[og][1:] != ugk[og][:-1], True]
        gsel = og[lg]
        assert (ugk[gsel] == keys).all()
        grp = (ug[gsel] % 128).astype(np.uint8)
        # 骨架群組：粗格的兩個 x 切片都要有木料才算 —— 肋骨之間一格的 room and space 降到 0.2 m 時才不會黏成一片牆
        par = ck * 2 + (a[:, 0] % 2)
        up = np.unique(par)
        both = np.unique(up // 2, return_counts=True)
        full = both[0][both[1] == 2]
        ok = (grp != 0) | np.isin(keys, full)
        return keys[ok], cols[ok], grp[ok]

    coarse = []
    fine_counts = {}
    for sid, hull, ls in states:
        k, c, g = coarse_state(hull, ls)
        coarse.append((sid, k, c, g))
        fine_counts[str(sid)] = int(len(hull) + sum(len(v[1]) for v in ls.values()))
        print('  階段 %2d：粗格 %d、原格 %d' % (sid, len(k), fine_counts[str(sid)]))

    # ── 粗格的一生：每一段（同色、連續存在）＝ 一個 instance ──
    inst = []           # (key, color, group, on_step, off_step, nopop)
    prev = {}
    grp_of = {}
    for sid, k, c, g in coarse:
        cur = dict(zip(k.tolist(), c.tolist()))
        for i, kk in enumerate(k.tolist()):
            if kk not in grp_of:
                grp_of[kk] = int(g[i])
        for kk, (col, on, idx) in list(prev.items()):
            if kk not in cur or cur[kk] != col:
                inst[idx][4] = sid
                del prev[kk]
        for kk, col in cur.items():
            if kk not in prev:
                inst.append([kk, col, grp_of[kk], sid, 255, 0])
                prev[kk] = (col, sid, len(inst) - 1)
    # 換色（同一格前一段在這個階段結束）⇒ 新的那段不做彈出動畫
    ends = {}
    for r in inst:
        if r[4] != 255:
            ends[(r[0], r[4])] = True
    starts = set((r[0], r[3]) for r in inst)
    for r in inst:
        if (r[0], r[3]) in ends:
            r[5] = 1
        r.append(1 if r[4] != 255 and (r[0], r[4]) in starts else 0)     # 這段的結束是換色（不做縮小）
    print('instances', len(inst))

    # ── 每個階段內的先後（0..1）：依方向排名，加一點固定種子的抖動 ──
    def rnd(k):
        x = np.sin(k * 127.1 + 311.7) * 43758.5453
        return x - np.floor(x)
    ORDER = {1: 'x', 2: 'z', 3: 'z', 4: 'x', 5: 'x', 6: 'mid', 7: 'z', 8: 'x', 9: 'z', 10: 'z', 11: 'x', 12: 'x', 13: 'z', 14: 'x',
             15: '-x', 16: 'z', 17: '-z', 18: 'x', 19: 'x', 20: 'x', 21: 'x', 22: 'x', 23: 'x'}
    WIN = {19: (0.0, 0.3), 21: (0.0, 0.45), 22: (0.55, 0.95), 23: (0.0, 0.6)}   # 這些階段的格子只佔前／後一段（其餘給繩與帆）
    ev = {}             # (step) → list of (inst idx, which 'on'|'off', key)
    for i, r in enumerate(inst):
        ev.setdefault(r[3], []).append((i, 0, r[0]))
        if r[4] != 255:
            ev.setdefault(r[4], []).append((i, 1, r[0]))
    fon = np.zeros(len(inst))
    foff = np.zeros(len(inst))
    for sid, lst in ev.items():
        ks = np.array([e[2] for e in lst], np.int64)
        cx, cy, cz = ks // (160 * 400), (ks // 400) % 160, ks % 400
        mode = ORDER[sid]
        jit = rnd(ks.astype(np.float64) * 0.001) * 1.6
        if mode == 'x':
            v = cx + jit
        elif mode == '-x':
            v = -cx + jit
        elif mode == 'z':
            v = cz * 4 + cx * 0.01 + jit
        elif mode == '-z':
            v = -cz + jit
        else:
            v = np.abs(cx - 225) + jit          # 兩頭骨架：從船中那一側往兩端長
        rk = np.argsort(np.argsort(v, kind='stable'), kind='stable')
        f = rk / max(1, len(rk) - 1)
        a, b = WIN.get(sid, (0.0, 1.0))
        f = a + (b - a) * f
        # 換色那一對要同一刻（舊的消失、新的出現）
        fk = {}
        for (i, which, k), ff in zip(lst, f):
            fk.setdefault(k, ff)
        for (i, which, k) in lst:
            if which == 0:
                fon[i] = fk[k]
            else:
                foff[i] = fk[k]

    # ── 每一面看不看得到；六面全蓋住的整段不送 ──
    IK = np.array([r[0] for r in inst], np.int64)
    IC = np.array([r[1] for r in inst], np.uint8)
    IG = np.array([r[2] for r in inst], np.uint8)
    ION = np.array([r[3] for r in inst], np.uint8)
    IOFF = np.array([r[4] for r in inst], np.uint8)
    INOP = np.array([r[5] for r in inst], np.uint8)
    ISWP = np.array([r[6] for r in inst], np.uint8)
    ccy, ccz = (IK // 400) % 160, IK % 400
    FM = face_masks(IK, IG, ION, fon, IOFF, foff, 160 * 400, 400, 1, np.isin(ccy, (80, 82)), ccz == 49)
    keep = np.nonzero(FM != 63)[0]
    print('送出 instances', len(keep), '／', len(inst))

    # ── 繩與帆 ──
    rig = obj_ropes_sails(cache)
    rat = set(r['name'] for r in json.load(open('D:/Unity/Valhalla/Sculpture/works/%s/design/ratlines.json' % WORK, encoding='utf-8'))['ropes'])
    sheets = set(r['name'] for r in json.load(open('D:/Unity/Valhalla/Sculpture/works/%s/design/sails_test.json' % WORK, encoding='utf-8'))['ropes'])
    lad_deck = {L['id']: {'gun': 3, 'berth': 2, 'orlop': 1}[L['deck']] for L in json.load(open('D:/Unity/Valhalla/Sculpture/works/%s/design/plan.json' % WORK, encoding='utf-8'))['ladders']['list']}
    ropes = []
    for r in rig['ropes']:
        n = r['name']
        if n.startswith('砲-'):
            st, kind = 21, 'gun'
        elif n.startswith('梯-'):
            st, kind = 23, 'man'
        elif n in rat:
            st, kind = 22, 'rat'
        elif n in sheets:
            st, kind = 19, 'sheet'
        else:
            st, kind = 19, 'standing'
        lv = 3 if kind == 'gun' else (lad_deck[n.split('.')[0][2:]] if kind == 'man' else 0)
        ropes.append(dict(r, step=st, kind=kind, level=lv))
    def put_f(lst, a, b, key):
        lst.sort(key=key)
        for i, r in enumerate(lst):
            r['f'] = a + (b - a) * (i / max(1, len(lst) - 1))
    put_f([r for r in ropes if r['kind'] == 'standing'], 0.28, 0.62, lambda r: (r['pts'][0][0], r['name']))
    put_f([r for r in ropes if r['kind'] == 'sheet'], 0.86, 0.95, lambda r: r['name'])
    put_f([r for r in ropes if r['kind'] == 'gun'], 0.45, 0.95, lambda r: (np.mean([p[0] for p in r['pts']]), r['name']))
    put_f([r for r in ropes if r['kind'] == 'rat'], 0.0, 0.55, lambda r: (np.mean([p[2] for p in r['pts']]), r['name']))
    put_f([r for r in ropes if r['kind'] == 'man'], 0.62, 0.95, lambda r: r['name'])
    sails = rig['sails']
    for i, s in enumerate(sorted(sails, key=lambda s: -np.mean([v[2] for v in s['verts']]))):
        s['f'] = 0.62 + 0.24 * i / max(1, len(sails) - 1)
        s['step'] = 19

    # ── 寫二進位：header JSON（長度＋內容）＋ 各陣列 ──
    K = IK[keep]
    cx, cy, cz = (K // (160 * 400)).astype(np.uint32), ((K // 400) % 160).astype(np.uint32), (K % 400).astype(np.uint32)
    grp, nop, swp = (IG[keep] & 15).astype(np.uint32), INOP[keep].astype(np.uint32), ISWP[keep].astype(np.uint32)
    lvl = (IG[keep] >> 4).astype(np.uint8)
    packed = cx | (cy << 9) | (cz << 17) | (grp << 26) | (nop << 30) | (swp << 31)
    col, son, soff, fm = IC[keep], ION[keep], IOFF[keep], FM[keep]
    fo = np.round(fon[keep] * 65535).astype(np.uint16)
    ff = np.round(foff[keep] * 65535).astype(np.uint16)
    srt = np.lexsort((fo, son))
    packed, col, son, soff, fo, ff, fm, lvl = packed[srt], col[srt], son[srt], soff[srt], fo[srt], ff[srt], fm[srt], lvl[srt]
    # 繩：每條 [step, f, r,g,b, radius, n] ＋ 點
    rope_meta, rope_pts = [], []
    for r in ropes:
        rope_meta.append([r['step'], round(r['f'], 4), *[round(v, 3) for v in r['color']], round(r['radius'], 3), len(r['pts']), r['level']])
        rope_pts += r['pts']
    sail_meta, sail_v, sail_i = [], [], []
    for s in sails:
        sail_meta.append([s['step'], round(s['f'], 4), *[round(v, 3) for v in s['color']], len(s['verts']), len(s['tris'])])
        sail_v += s['verts']
        sail_i += [i for t in s['tris'] for i in t]
    # 設計水線（z 63）那一層：每個 x 船身的半寬（格）；片尾下水以後船身一圈白浪貼著它
    wl = asm[(asm[:, 2] >= 62) & (asm[:, 2] <= 64)]
    hb = np.zeros(SX, np.int32)
    np.maximum.at(hb, wl[:, 0], np.abs(wl[:, 1] - 160) + 1)
    head = dict(n=int(len(packed)), wl=[int(v) for v in hb], ropes=rope_meta, rope_names=[r['name'] for r in ropes], sails=sail_meta, sail_names=[s['name'] for s in sails],
                nrp=len(rope_pts), nsv=len(sail_v), nsi=len(sail_i), coarse=2,
                counts={str(sid): int(len(k)) for sid, k, c, g in coarse}, fine=fine_counts, fine_total=int(len(kb)))
    hb = json.dumps(head, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    body = b''.join([struct.pack('<I', len(hb)), hb, b'\0' * ((4 - (4 + len(hb)) % 4) % 4),
                     packed.astype('<u4').tobytes(), np.array(rope_pts, '<f4').tobytes(), np.array(sail_v, '<f4').tobytes(),
                     fo.astype('<u2').tobytes(), ff.astype('<u2').tobytes(), np.array(sail_i, '<u2').tobytes(),
                     col.tobytes(), son.tobytes(), soff.tobytes(), fm.tobytes(), lvl.tobytes()])
    comp = zlib.compressobj(9, zlib.DEFLATED, -15)
    z = comp.compress(body) + comp.flush()
    open(out_bin, 'wb').write(z)
    print('寫出', out_bin, 'raw', len(body), 'deflate', len(z), 'sha256', hashlib.sha256(z).hexdigest()[:16])
    print(json.dumps({k: head[k] for k in ('n', 'nrp', 'nsv', 'nsi', 'fine', 'fine_total')}, ensure_ascii=False))

    # ══ 原始解析度（0.1 m，一格一格）══════════════════════════════════════
    # 同一套規則，直接在原格上做（不用挑顏色、不用骨架規則）；寫到 <輸出>_fine.bin，HTML 只有選「原始」時才解開
    cap = 4_000_000
    I_k = np.zeros(cap, np.int64); I_c = np.zeros(cap, np.uint8); I_g = np.zeros(cap, np.uint8)
    I_on = np.zeros(cap, np.uint8); I_off = np.full(cap, 255, np.uint8); I_nop = np.zeros(cap, np.uint8); I_swp = np.zeros(cap, np.uint8)
    n = 0
    pk = np.zeros(0, np.int64); pc = np.zeros(0, np.uint8); pi = np.zeros(0, np.int64)
    for sid, hull, ls in states:
        arrs, grps = [hull[:, :4]], [hk_grp[np.searchsorted(hk_all, keyof(hull))]]
        for _, (s_, cells, g) in ls.items():
            arrs.append(cells[:, :4]); grps.append(np.full(len(cells), g, np.int8))
        a_ = np.concatenate(arrs); g_ = np.concatenate(grps).astype(np.uint8); k_ = keyof(a_)
        o = np.argsort(k_, kind='stable'); k_, c_, g_ = k_[o], a_[o, 3].astype(np.uint8), g_[o]
        assert (np.diff(k_) > 0).all(), ('階段 %d 有重疊的格' % sid)
        if len(pk):
            pos = np.minimum(np.searchsorted(pk, k_), len(pk) - 1)
            match = pk[pos] == k_
            same = match & (pc[pos] == c_)
        else:
            pos = np.zeros(len(k_), np.int64); match = np.zeros(len(k_), bool); same = match.copy()
        ci = np.empty(len(k_), np.int64)
        ci[same] = pi[pos[same]]
        new = ~same
        m = int(new.sum())
        idx = np.arange(n, n + m)
        ci[new] = idx
        I_k[idx] = k_[new]; I_c[idx] = c_[new]; I_on[idx] = sid
        I_nop[idx] = match[new]
        I_g[idx] = np.where(match[new], I_g[pi[pos[new]]] if len(pk) else 0, g_[new])
        if len(pk):
            cont = np.zeros(len(pk), bool); cont[pos[same]] = True
            ended = pi[~cont]
            I_off[ended] = sid
            ek = pk[~cont]
            p2 = np.minimum(np.searchsorted(k_, ek), len(k_) - 1)
            I_swp[ended] = (k_[p2] == ek)
        n += m
        pk, pc, pi = k_, c_, ci
    I_k, I_c, I_g, I_on, I_off, I_nop, I_swp = (x[:n] for x in (I_k, I_c, I_g, I_on, I_off, I_nop, I_swp))
    print('原始解析度 instances', n)
    X, Y, Z = I_k // (SY * SZ), (I_k // SZ) % SY, I_k % SZ
    jit = None
    fon = np.zeros(n); foff = np.zeros(n)
    for sid in range(1, len(STEPS) + 1):
        ion = np.nonzero(I_on == sid)[0]; ioff = np.nonzero(I_off == sid)[0]
        ks = np.unique(np.concatenate([I_k[ion], I_k[ioff]]))
        if not len(ks):
            continue
        x2, z2 = (ks // (SY * SZ)) / 2.0, (ks % SZ) / 2.0
        jt = rnd((ks // 2).astype(np.float64) * 0.001) * 1.6
        mode = ORDER[sid]
        v = {'x': x2 + jt, '-x': -x2 + jt, 'z': z2 * 4 + x2 * 0.01 + jt, '-z': -z2 + jt}.get(mode, np.abs(x2 - 225) + jt)
        rk = np.argsort(np.argsort(v, kind='stable'), kind='stable')
        f = rk / max(1, len(rk) - 1)
        a0, b0 = WIN.get(sid, (0.0, 1.0))
        f = a0 + (b0 - a0) * f
        fon[ion] = f[np.searchsorted(ks, I_k[ion])]
        foff[ioff] = f[np.searchsorted(ks, I_k[ioff])]
    FMf = face_masks(I_k, I_g, I_on, fon, I_off, foff, SY * SZ, SZ, 1, np.isin(Y, (161, 165)), Z == 99)
    sel = np.nonzero(FMf != 63)[0]
    sel = sel[np.argsort(I_k[sel], kind='stable')]
    print('原始解析度送出', len(sel), '／', n)
    dk = np.diff(np.concatenate([[0], I_k[sel]])).astype(np.uint32)           # 同一格兩段（換色）⇒ 差 0
    gfl = ((I_g[sel] & 15) | (I_nop[sel] << 4) | (I_swp[sel] << 5)).astype(np.uint8)
    fhead = json.dumps(dict(n=int(len(sel)), sy=SY, sz=SZ), separators=(',', ':')).encode()
    fbody = b''.join([struct.pack('<I', len(fhead)), fhead, b'\0' * ((4 - (4 + len(fhead)) % 4) % 4),
                      dk.astype('<u4').tobytes(), gfl.tobytes(), I_c[sel].tobytes(), I_on[sel].tobytes(), I_off[sel].tobytes(),
                      np.round(fon[sel] * 255).astype(np.uint8).tobytes(), np.round(foff[sel] * 255).astype(np.uint8).tobytes(), FMf[sel].tobytes(), (I_g[sel] >> 4).astype(np.uint8).tobytes()])
    comp = zlib.compressobj(9, zlib.DEFLATED, -15)
    zf = comp.compress(fbody) + comp.flush()
    fout = out_bin[:-4] + '_fine.bin'
    open(fout, 'wb').write(zf)
    print('寫出', fout, 'raw', len(fbody), 'deflate', len(zf), 'sha256', hashlib.sha256(zf).hexdigest()[:16])


if __name__ == '__main__':
    main()
