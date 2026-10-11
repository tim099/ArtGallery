# 把 build_data.py 產的 .bin（deflate-raw）用 base64 塞進 template.html，並把 sheets.json 列的新圖紙裁切、縮成 JPEG 嵌進去
#   ⇒ HtmlVideos/<名>.html（自帶播放器、零外部依賴）
# 用法：python -I make_html.py <ship.bin> <輸出 .html>
import sys, os, io, json, base64, hashlib
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
data = open(sys.argv[1], 'rb').read()
b64 = base64.b64encode(data).decode('ascii')
lines = '\n'.join(b64[i:i + 4096] for i in range(0, len(b64), 4096))
J = json.load(open(os.path.join(here, 'sheets.json'), encoding='utf-8'))
sheets = []
for s in J['sheets']:
    im = Image.open(os.path.join(J['design'], s['file'])).convert('RGB')
    w, h = im.size
    x0, y0, x1, y1 = s['crop']
    im = im.crop((round(x0 * w), round(y0 * h), round(x1 * w), round(y1 * h)))
    im.thumbnail((900, 600), Image.LANCZOS)
    bio = io.BytesIO()
    im.save(bio, 'JPEG', quality=80, optimize=True)
    sheets.append({'step': s['step'], 'label': s['label'], 'w': im.size[0], 'h': im.size[1],
                   'src': 'data:image/jpeg;base64,' + base64.b64encode(bio.getvalue()).decode('ascii')})
fine = open(sys.argv[1][:-4] + '_fine.bin', 'rb').read()
fb64 = base64.b64encode(fine).decode('ascii')
flines = '\n'.join(fb64[i:i + 4096] for i in range(0, len(fb64), 4096))
tpl = open(os.path.join(here, 'template.html'), encoding='utf-8').read()
assert tpl.count('__SHIP_DATA__') == 1 and tpl.count('__SHEETS__') == 1 and tpl.count('__SHIP_FINE__') == 1
out = tpl.replace('__SHIP_DATA__', lines).replace('__SHIP_FINE__', flines).replace('__SHEETS__', json.dumps(sheets, ensure_ascii=False))
open(sys.argv[2], 'w', encoding='utf-8', newline='\n').write(out)
print('寫出', sys.argv[2], len(out.encode('utf-8')), 'bytes；資料 sha256', hashlib.sha256(data).hexdigest()[:16], '；圖紙', len(sheets), '張',
      sum(len(s['src']) for s in sheets), 'bytes')
