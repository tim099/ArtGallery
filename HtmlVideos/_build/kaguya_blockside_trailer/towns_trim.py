# -*- coding: utf-8 -*-
"""《Blockside》宣傳片：海域的城鎮只留鏡頭看得到的那一帶（TASK-0750 旱地行舟）。

用法（python -I）：
  python -I towns_trim.py <匯出的海域資料夾> <輸出的海域資料夾> --keep <半徑 m> --path <海域座標 JSON：[[往東, 往南], …]> [--used <用到的檔清單 JSON>]

做的事：
  1. 讀 <匯出>/towns.js（Blocksail tools/export_chunks.cjs 寫的 BSMAP.town(...)，一座一行）。
  2. 地塊（lots）只留離路線 --keep 公尺內的（地塊的海域座標 ＝ (ox ＋ kx·at[0], oy ＋ at[1])）；城牆、路、碼頭、棧橋、泊位、巨鏈、引水渠照留（骨架、量小）。
     ⇒ 遊戲照留下的地塊挑模型（63_towns.js townNeed）⇒ 宣傳片只內嵌要用的模型。
  3. 寫 <輸出>/towns.js（一座一行，同格式）；給了 --used（宣傳片 ?debug=1 的 __tr.ev('JSON.stringify(Object.keys(TR_FILE_USED).sort())')：
     遊戲實際讀了哪幾個檔）⇒ 照清單從 <匯出>/townkit/ 複製到 <輸出>/townkit/（⛔ 清單外的不複製；舊的先清掉）。
  4. 印讀數：每座城留了幾塊地、檔案大小。

⛔ 不改 Blocksail 的規劃：只改宣傳片內嵌的那一份。同一份輸入兩次逐位元組相同。
"""
import json
import math
import os
import shutil
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass


def seg_dist(P, x, y):
    best = math.inf
    for (ax, ay), (bx, by) in zip(P, P[1:]):
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy
        u = max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / L2)) if L2 > 0 else 0.0
        best = min(best, math.hypot(x - ax - dx * u, y - ay - dy * u))
    return best


def main(argv):
    a = {'--used': None}
    pos = []
    i = 1
    while i < len(argv):
        if argv[i].startswith('--'):
            a[argv[i]] = argv[i + 1]
            i += 2
        else:
            pos.append(argv[i])
            i += 1
    if len(pos) != 2 or '--keep' not in a or '--path' not in a:
        print(__doc__)
        sys.exit(2)
    src, out = pos
    R, P = float(a['--keep']), json.loads(a['--path'])
    lines = []
    for ln in open(os.path.join(src, 'towns.js'), encoding='utf-8'):
        ln = ln.rstrip('\n')
        if not ln:
            continue
        p = json.loads(ln[ln.index('(') + 1:ln.rindex(')')])
        ox, oy, kx = p.get('ox', 0), p.get('oy', 0), p.get('kx', 1)
        n0 = len(p['lots'])
        p['lots'] = [l for l in p['lots'] if seg_dist(P, ox + kx * l['at'][0], oy + l['at'][1]) <= R]
        print('  %s：地塊 %d → %d（離路線 %g m 內）' % (p['id'], n0, len(p['lots']), R))
        lines.append('BSMAP.town(' + json.dumps(p, ensure_ascii=False, separators=(',', ':')) + ');\n')
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, 'towns.js'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(''.join(lines))
    print('  ✓ towns.js %.2f MB' % (os.path.getsize(os.path.join(out, 'towns.js')) / 1e6))
    if a['--used']:
        kd = os.path.join(out, 'townkit')
        shutil.rmtree(kd, ignore_errors=True)
        os.makedirs(kd)
        n, tot = 0, 0
        for f in json.load(open(a['--used'], encoding='utf-8')):
            name = f.rsplit('/', 1)[-1]
            if '/townkit/' not in f:
                continue
            shutil.copyfile(os.path.join(src, 'townkit', name), os.path.join(kd, name))
            n += 1
            tot += os.path.getsize(os.path.join(kd, name))
        print('  ✓ townkit：%d 個檔、%.2f MB' % (n, tot / 1e6))


if __name__ == '__main__':
    main(sys.argv)
