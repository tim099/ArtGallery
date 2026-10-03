"""Seed an offline exhibit shell; pack_viewer owns the generated package."""
import re
from pathlib import Path

section = Path(__file__).resolve().parent.parent
slug = 'sirius_open_orbit'
html = (section / 'meadow_dew_beacon.html').read_text(encoding='utf-8')
html = re.sub(r'<!-- BEGIN MODEL PACKAGE -->.*?<!-- END MODEL PACKAGE -->',
              '<!-- BEGIN MODEL PACKAGE -->\n<!-- END MODEL PACKAGE -->', html, flags=re.S)
html = re.sub(r'(<img id="fallback" src=")[^"]+', r'\1../RawImages/'+slug+'.png', html)
html = html.replace('meadow_dew_beacon', slug).replace('晨露航標', '未閉合的星軌').replace('Dew Beacon', 'Open Orbit').replace('DEW BEACON', 'OPEN ORBIT')
html = html.replace('青銅環架・幼苗・晨露', '銀色星軌・夜讀書頁・暖色星燈')
html = html.replace('MEADOW · OBJECT NO. 001', 'SIRIUS · OBJECT NO. 002').replace('給微小生命一個方向', '留一頁給明天')
(section / (slug+'.html')).write_text(html, encoding='utf-8')
print('Prepared', slug+'.html')
