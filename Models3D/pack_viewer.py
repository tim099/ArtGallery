"""Package GLB, renderer and fallback into a self-contained exhibit HTML.

The GLB remains the source of mesh data. Run again after each Blender export.
Refresh the adjacent .glb.js projection and the matching HTML script block.
Sandboxed file:// frames cannot load sibling scripts; inline assets avoid that
dependency while retaining allow-scripts isolation. Model geometry is unchanged.
"""
import argparse
import base64
import json
import re
import struct
from pathlib import Path

def pack(path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from('<III', data)
    if (magic, version, length) != (0x46546C67, 2, len(data)):
        raise ValueError('Expected a complete glTF 2 GLB.')
    output = path.with_suffix('.glb.js')
    assignment = 'window.MODEL_GLB_BASE64 = ' + json.dumps(base64.b64encode(data).decode('ascii')) + ';\n'
    section = path.parent.parent
    html_path = section / (path.stem + '.html')
    html = html_path.read_text(encoding='utf-8')
    renderer = (section / 'viewer.js').read_text(encoding='utf-8')
    fallback = (section.parent / 'RawImages' / (path.stem + '.png')).read_bytes()
    # 職責：內嵌所有模型顯示所需資產；樣式與作品資訊仍由 HTML 作者維護。
    # 物理意義：file:// 沙盒具有獨立來源，不能依賴同目錄腳本與縮圖的載入。
    # 數值影響：只替換指定封裝區塊與 fallback 圖片，重複打包不會累加內容。
    block = '<!-- BEGIN MODEL PACKAGE -->\n<script>\n' + assignment + renderer.replace('</script', '<\\/script') + '\n</script>\n<!-- END MODEL PACKAGE -->'
    pattern = r'<!-- BEGIN MODEL PACKAGE -->.*?<!-- END MODEL PACKAGE -->|<script src="Assets/[^"\n]+\.glb\.js"></script>\s*<script src="viewer\.js"></script>'
    html, count = re.subn(pattern, lambda _: block, html, flags=re.S)
    if count != 1:
        raise ValueError('Expected exactly one model package block in the exhibit HTML.')
    image = 'data:image/png;base64,' + base64.b64encode(fallback).decode('ascii')
    html, count = re.subn(r'(<img id="fallback" src=")[^"]+("[^>]*>)', lambda m: m[1] + image + m[2], html)
    if count != 1:
        raise ValueError('Expected exactly one fallback image in the exhibit HTML.')
    output.write_text(assignment, encoding='utf-8')
    html_path.write_text(html, encoding='utf-8')
    print(f'{html_path.name}: packed {len(data):,} GLB bytes, renderer and fallback image')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('glb', type=Path)
    pack(parser.parse_args().glb)
