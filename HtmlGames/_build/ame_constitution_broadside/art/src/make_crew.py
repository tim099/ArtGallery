# 區塊職責：art/src/sailor.png（Tim 2026-10-12 給的水手圖，一個站姿）⇒ art/crew.png（8 欄 × 12 列，每格 96×192）。
# 物理意義：遊戲的船員格子：欄 ＝ 動作（待命、推彈、拉砲索、動作、跑 A、跑 B、受傷、陣亡），列 ＝ 角色 × 2 ＋ 隊伍
#           （角色 0 砲手、1 送藥手、2 軍官、3 陸戰隊、4 桅頂水手、5 舵手；隊伍 0 藍、1 紅）。人一律朝右、腳底在格子底邊正中。
# 設計取捨：只有一個站姿 ⇒ 其他動作用傾斜、位移、躺倒做簡易版；角色差異只加道具（火槍、劍）與身高（送藥手 0.75）。
#           正式的各動作、各角色由美術交（TASK-0516），交了就換掉這張。
#           紅隊：把深藍的衣服換成深紅（只動「藍色明顯多於紅綠、而且偏暗」的像素，皮膚、頭髮、靴子不動）。
# 用法：python -I make_crew.py   （在 art/src/ 底下跑，寫到 ../crew.png）
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
CW, CH, NFR, NROLE = 96, 192, 8, 6
H_PX = 164                       # 站著的人在格子裡的高度（格高 192 的 85%）


def load():
    im = Image.open(os.path.join(HERE, 'sailor.png')).convert('RGBA')
    im = im.crop(im.getbbox())
    s = H_PX / im.height
    im = im.resize((max(1, round(im.width * s)), H_PX), Image.NEAREST)   # 原圖是放大過的像素畫 ⇒ 最近點縮回去，像素格才銳利
    a = im.getchannel('A').point(lambda v: 255 if v >= 128 else 0)      # 遊戲用 alpha 去背：只留 0／255
    im.putalpha(a)
    return im


def red_team(im):
    px = im.load()
    out = im.copy(); po = out.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a and b > r + 18 and b >= g and max(r, g, b) < 150:      # 深藍的布 ⇒ 深紅
                po[x, y] = (min(255, int(b * 1.25)), int(g * 0.55), int(r * 0.6), a)
    return out


def prop(d, role, f, w, h):
    """道具：陸戰隊的火槍、軍官的劍（畫在人的座標裡，原點左上）。"""
    if role == 3:
        if f == 3:
            d.line([(w * 0.45, h * 0.30), (w + 18, h * 0.28)], fill=(75, 54, 33, 255), width=4)   # 舉槍
        else:
            d.line([(w * 0.80, h * 0.92), (w * 0.86, h * 0.20)], fill=(75, 54, 33, 255), width=4)
    if role == 2:
        if f == 3:
            d.line([(w * 0.70, h * 0.32), (w + 14, h * 0.02)], fill=(207, 214, 220, 255), width=3)  # 舉劍
        else:
            d.line([(w * 0.78, h * 0.55), (w * 0.95, h * 0.85)], fill=(207, 214, 220, 255), width=3)


def frame(base, role, f):
    w, h = base.size
    fig = Image.new('RGBA', (w + 40, h + 20), (0, 0, 0, 0))
    fig.alpha_composite(base, (10, 10))
    prop(ImageDraw.Draw(fig), role, f, w + 10, h + 10)
    scale = 0.75 if role == 1 else 1.0
    if scale != 1:
        fig = fig.resize((round(fig.width * scale), round(fig.height * scale)), Image.LANCZOS)
    cell = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    # 腳底的錨點：fig 底邊往上 10*scale 是腳底
    foot = round(10 * scale)
    if f == 7:                                                          # 陣亡：躺下（縮到放得進格寬）
        lie = fig.rotate(90, expand=True, resample=Image.NEAREST)
        k = min(1.0, (CW - 4) / lie.width)
        lie = lie.resize((max(1, round(lie.width * k)), max(1, round(lie.height * k))), Image.NEAREST)
        cell.alpha_composite(lie, ((CW - lie.width) // 2, CH - 2 - lie.height + round(foot * k)))
        return cell
    ang = {1: -14, 2: 9, 3: 5, 4: -9, 5: -9, 6: 16}.get(f, 0)            # 正 ＝ 往後仰（逆時針），負 ＝ 往前傾（朝右）
    dy = {4: -5, 5: 0}.get(f, 0)
    dx = {3: -3, 4: 2, 5: -2, 6: 8}.get(f, 0)
    pad = Image.new('RGBA', (fig.width * 2, fig.height * 2), (0, 0, 0, 0))
    fx, fy = round((10 + w / 2) * scale), fig.height - foot              # 腳底在 fig 裡的位置（人畫在 fig 的 (10,10) 起）
    pad.alpha_composite(fig, (pad.width // 2 - fx, pad.height // 2 - fy))  # 腳底放在 pad 正中 ⇒ 轉的時候繞腳底
    rot = pad.rotate(ang, center=(pad.width // 2, pad.height // 2), resample=Image.NEAREST)
    if f == 6:                                                          # 受傷：矮一截（坐著），色調暗一點
        rot = rot.resize((rot.width, round(rot.height * 0.8)), Image.NEAREST)
        px = rot.load()
        for y in range(rot.height):
            for x in range(rot.width):
                r, g, b, a = px[x, y]
                if a: px[x, y] = (int(r * 0.8), int(g * 0.75), int(b * 0.75), a)
    cx, cy = rot.width // 2, (rot.height // 2) if f != 6 else round(pad.height // 2 * 0.8)
    cell.alpha_composite(rot, (CW // 2 - cx + dx, CH - 2 - cy + dy))
    return cell


def main():
    import sys; sys.stdout.reconfigure(encoding="utf-8")
    base = load()
    teams = [base, red_team(base)]
    out = Image.new('RGBA', (CW * NFR, CH * NROLE * 2), (0, 0, 0, 0))
    for role in range(NROLE):
        for t in range(2):
            for f in range(NFR):
                out.alpha_composite(frame(teams[t], role, f), (f * CW, (role * 2 + t) * CH))
    dst = os.path.normpath(os.path.join(HERE, '..', 'crew.png'))
    out = out.quantize(colors=255, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)   # PNG-8（含透明）：省一大半
    out.save(dst, optimize=True)
    print('✓ %s（%d×%d，%.1f KB）' % (dst, out.width, out.height, os.path.getsize(dst) / 1e3))


if __name__ == '__main__':
    main()
