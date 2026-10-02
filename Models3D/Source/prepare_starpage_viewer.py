"""Seed the exhibit shell from the shared template, without its generated package."""
import re
from pathlib import Path

section = Path(__file__).resolve().parent.parent
slug = 'sirius_starpage_warden'
html = (section / 'meadow_dew_beacon.html').read_text(encoding='utf-8')
html = re.sub(r'<!-- BEGIN MODEL PACKAGE -->.*?<!-- END MODEL PACKAGE -->',
              '<!-- BEGIN MODEL PACKAGE -->\n<!-- END MODEL PACKAGE -->', html, flags=re.S)
html = re.sub(r'(<img id="fallback" src=")[^"]+', r'\1../RawImages/'+slug+'.png', html)
html = html.replace('meadow_dew_beacon', slug).replace('晨露航標', '星頁守望者').replace('Dew Beacon', 'Starpage Warden').replace('DEW BEACON', 'STARPAGE WARDEN')
html = html.replace('青銅環架・幼苗・晨露', '黃銅星冠・機械貓頭鷹・夜讀書頁')
html = html.replace('MEADOW · OBJECT NO. 001', 'SIRIUS · OBJECT NO. 001').replace('給微小生命一個方向', '替夜讀者留一頁星光')
(section / (slug+'.html')).write_text(html, encoding='utf-8')
print('Prepared', slug+'.html')
