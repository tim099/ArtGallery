# 《龍骨是直的》圖文版：照 pages.json 把現成的圖排成漫畫頁（白底、黑框、格間留白；圖上不加字）
# 版型＝一列一列：每格的寬高比（裁切後的圖，或 cover 格指定的 aspect）決定這一列多高 ⇒ 格子剛好裝下圖，頁高跟著內容走。
# 用法：python -I -B make_pages.py <pages.json> <輸出資料夾 RawImages> [頁名…]
import sys, os, json
from PIL import Image, ImageDraw
Image.MAX_IMAGE_PIXELS = None
SRC = {'O': 'D:/Unity/Valhalla/Sculpture/works/basecamp-frigate-constitution-01m/overlays',
       'D': 'D:/Unity/Valhalla/Sculpture/works/basecamp-frigate-constitution-01m/design',
       'R': 'D:/Unity/Valhalla/Sculpture/references/uss-constitution-1927',
       'E': 'D:/Unity/Valhalla/Sculpture/works/basecamp-ember-01m/overlays',      # 餘燼號（魔改憲法號，TASK-0519）
       'F': 'D:/Unity/Valhalla/Sculpture/works/basecamp-ember-01m/design'}
PW, M, G, B = 1600, 56, 26, 5          # 頁寬、外框留白、格間、框線粗
_cache = {}


def load(spec):
    key = (spec['src'], tuple(spec.get('crop') or ()))
    if key not in _cache:
        pre, rel = spec['src'].split('/', 1)
        im = Image.open(os.path.join(SRC[pre], rel)).convert('RGB')
        if spec.get('crop'):
            im = im.crop(tuple(spec['crop']))
        _cache[key] = im
    return _cache[key]


def aspect(spec):
    if spec.get('fit') == 'cover':
        return float(spec['aspect'])
    im = load(spec)
    return im.width / im.height


def render(spec, bw, bh):
    im = load(spec)
    s = max(bw / im.width, bh / im.height)      # cover：填滿再置中裁；contain 的格子本來就照圖的比例，等於剛好
    r = im.resize((max(bw, round(im.width * s)), max(bh, round(im.height * s))), Image.LANCZOS)
    ox, oy = (r.width - bw) // 2, (r.height - bh) // 2
    return r.crop((ox, oy, ox + bw, oy + bh))


def main():
    spec = json.load(open(sys.argv[1], encoding='utf-8'))['pages']
    odir = sys.argv[2]
    os.makedirs(odir, exist_ok=True)
    only = set(sys.argv[3:])
    for name, pg in spec.items():
        if only and name not in only:
            continue
        rows = []
        for row in pg['rows']:
            a = [aspect(p) for p in row]
            h = (PW - 2 * M - G * (len(row) - 1)) / sum(a)
            rows.append((row, a, int(round(h))))
        PH = 2 * M + sum(h for _, _, h in rows) + G * (len(rows) - 1)
        page = Image.new('RGB', (PW, PH), (255, 255, 255))
        d = ImageDraw.Draw(page)
        y = M
        for row, a, h in rows:
            x = M
            avail = PW - 2 * M - G * (len(row) - 1)
            ws = [int(round(ai / sum(a) * avail)) for ai in a]
            ws[-1] = avail - sum(ws[:-1])
            for p, w in zip(row, ws):
                page.paste(render(p, w, h), (x, y))
                d.rectangle([x - B // 2, y - B // 2, x + w + B // 2 - 1, y + h + B // 2 - 1], outline=(28, 28, 32), width=B)
                x += w + G
            y += h + G
        page.save(os.path.join(odir, name + '.png'), optimize=True)
        print(name, PW, PH, [len(r) for r, _, _ in rows])


if __name__ == '__main__':
    main()
