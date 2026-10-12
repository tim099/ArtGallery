# 區塊職責：Sirius 的水手立繪（ArtGallery/RawImages/sirius_sailor_*_sprite_v1.png，白底）⇒ art/crew.png（單圖：1 欄 × 14 列，每格 96×192）。
# 物理意義：遊戲的船員格子：列 ＝ 角色 × 2 ＋ 隊伍（隊伍 0 藍、1 紅）；角色 0 砲手、1 送藥手、2 軍官、3 陸戰隊、4 桅頂水手、5 舵手、6 船長
#           （每艘船第一個軍官畫成船長）。人一律朝右、腳底在格子底邊正中。動作（晃、上下、縮放、傾斜、躺倒、閃紅）由遊戲的程式做
#           （js/41_crew_art.js 的 crewPose），所以每個角色只要一張站姿（Tim 2026-10-12）。
# 設計取捨：
#   · 去背：碰到邊的「亮而中性」區塊 ＝ 背景（白底 ≈ (253,253,253)，奶油色襯衫 (253,242,222) 不中性 ⇒ 保留）；
#     被身體圍住的空隙要很白、很平、夠大才算背景（白帽子有明暗）；最後清掉貼著背景的淺色毛邊。
#   · 縮小：原圖是放大過的像素畫（948×1659）⇒ 用面積平均縮到格高的 85%，alpha 再切成 0／255（遊戲用 alpha 去背）。
#   · 紅隊：把深藍的布換成深紅（只動「藍色明顯多於紅綠、而且偏暗」的像素，皮膚、頭髮、靴子不動）。
#   · 道具：陸戰隊的火槍、軍官與船長的劍（拿在身上，不伸出格子）。送藥手是小孩 ⇒ 身高 0.75。
# 用法：python -I make_crew.py   （在 art/src/ 底下跑，寫到 ../crew.png）
import os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', '..', 'RawImages'))
CW, CH = 96, 192
H_PX = 164                       # 站著的人在格子裡的高度（格高 192 的 85%）
# 列：（立繪, 身高倍率, 道具）
ROWS = [
    ('braid', 1.0, None),          # 0 砲手
    ('chestnut', 0.75, None),      # 1 送藥手（小孩）
    ('first_mate', 1.0, 'sword'),  # 2 軍官
    ('chestnut', 1.0, 'musket'),   # 3 陸戰隊
    ('boatswain', 1.0, None),      # 4 桅頂水手（繩圈）
    ('chestnut', 1.0, None),       # 5 舵手
    ('captain', 1.0, 'sword'),     # 6 船長
]


def cutout(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.int16)
    mn, mx = a.min(axis=2), a.max(axis=2)
    spread = mx - mn
    cand = (mn >= 236) & (spread <= 12)
    lab, n = ndimage.label(cand)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    idx = np.arange(1, n + 1)
    sizes = ndimage.sum(np.ones_like(lab), lab, index=idx)
    mean_mn = ndimage.mean(mn, lab, index=idx)
    mean_sp = ndimage.mean(spread, lab, index=idx)
    inner = [i + 1 for i in range(n) if (i + 1) not in edge and sizes[i] >= 300 and mean_mn[i] >= 249 and mean_sp[i] <= 3]
    bg |= np.isin(lab, inner)
    lum = a.mean(axis=2)
    for _ in range(3):
        near = ndimage.binary_dilation(bg, structure=np.ones((3, 3), bool)) & ~bg
        fringe = near & (lum >= 200) & (spread <= 30)
        if not fringe.any():
            break
        bg |= fringe
    return Image.fromarray(np.dstack([a.astype(np.uint8), np.where(bg, 0, 255).astype(np.uint8)]), 'RGBA')


def load(name, scale):
    im = cutout(os.path.join(RAW, 'sirius_sailor_%s_sprite_v1.png' % name))
    im = im.crop(im.getbbox())
    h = round(H_PX * scale)
    w = max(1, round(im.width * h / im.height))
    # 面積平均（先乘 alpha，免得背景的白滲進邊緣），再把 alpha 切成 0／255
    p = np.asarray(im).astype(np.float32)
    p[..., :3] *= p[..., 3:4] / 255
    small = np.asarray(Image.fromarray(p.astype(np.uint8), 'RGBA').resize((w, h), Image.BOX)).astype(np.float32)
    al = small[..., 3:4]
    rgb = np.where(al > 0, small[..., :3] * 255 / np.maximum(al, 1), 0)
    out = np.dstack([np.clip(rgb, 0, 255), np.where(al[..., 0] >= 128, 255, 0)]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def red_team(im):
    px = im.load()
    out = im.copy(); po = out.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a and b > r + 18 and b >= g and max(r, g, b) < 150:      # 深藍的布 ⇒ 深紅
                po[x, y] = (min(255, int(b * 1.25)), int(g * 0.55), int(r * 0.6), a)
    return out


def cell(fig, prop):
    c = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    x0, y0 = (CW - fig.width) // 2, CH - 2 - fig.height
    c.alpha_composite(fig, (max(0, x0), y0))
    d = ImageDraw.Draw(c)
    w, h = fig.width, fig.height
    if prop == 'musket':                                                # 火槍：直立靠在右手邊
        d.line([(x0 + w * 0.80, y0 + h * 0.97), (x0 + w * 0.86, y0 + h * 0.22)], fill=(75, 54, 33, 255), width=3)
    if prop == 'sword':                                                 # 劍：掛在腰間
        d.line([(x0 + w * 0.70, y0 + h * 0.50), (x0 + w * 0.88, y0 + h * 0.78)], fill=(207, 214, 220, 255), width=2)
    return c


def main():
    import sys; sys.stdout.reconfigure(encoding='utf-8')
    cache = {}
    out = Image.new('RGBA', (CW, CH * len(ROWS) * 2), (0, 0, 0, 0))
    for r, (name, scale, prop) in enumerate(ROWS):
        key = (name, scale)
        if key not in cache:
            base = load(name, scale)
            cache[key] = (base, red_team(base))
        for t in range(2):
            out.alpha_composite(cell(cache[key][t], prop), (0, (r * 2 + t) * CH))
    dst = os.path.normpath(os.path.join(HERE, '..', 'crew.png'))
    out = out.quantize(colors=255, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)   # PNG-8（含透明）：省一大半
    out.save(dst, optimize=True)
    print('✓ %s（%d×%d，%d 列角色，%.1f KB）' % (dst, out.width, out.height, len(ROWS), os.path.getsize(dst) / 1e3))


if __name__ == '__main__':
    main()
