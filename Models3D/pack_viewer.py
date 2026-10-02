"""Embed one GLB as a classic script so the viewer also works from file://.

The GLB remains the source of mesh data. Run again after each Blender export.
Only the adjacent .glb.js projection is written; no model geometry is changed.
"""
import argparse
import base64
import json
import struct
from pathlib import Path

def pack(path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from('<III', data)
    if (magic, version, length) != (0x46546C67, 2, len(data)):
        raise ValueError('Expected a complete glTF 2 GLB.')
    output = path.with_suffix('.glb.js')
    output.write_text('window.MODEL_GLB_BASE64 = ' + json.dumps(base64.b64encode(data).decode('ascii')) + ';\n', encoding='utf-8')
    print(f'{output.name}: embedded {len(data):,} GLB bytes')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('glb', type=Path)
    pack(parser.parse_args().glb)
