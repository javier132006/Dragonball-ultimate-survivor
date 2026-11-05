#!/usr/bin/env python3
"""Cuantiza los atlas de efectos (fx_*.png de fxbuild.py) a 256 colores, los mete en assets/sprites.js
y actualiza la lista de animaciones (window.FX_ANIMS).
Uso: python3 tools/fx_atlas/install.py CARPETA_CON_fx_*.png_Y_fxmeta.json"""
import json, os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import sprites_io as S
src = sys.argv[1]
A = {'fx': ('fx', 16, 64), 'big': ('fxbig', 8, 128), 'props': ('props', 16, 96), 'tall': ('tall', 8, 192)}
sheets, _ = S.load()
for k, (name, cols, cell) in A.items():
    im = Image.open(os.path.join(src, 'fx_' + k + '.png')).convert('RGBA')
    q = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).convert('RGBA')
    S.put(sheets, name, q, {'cols': cols, 'rows': im.height // cell, 'w': cell, 'h': cell})
anims = json.load(open(os.path.join(src, 'fxmeta.json')))
anims = {n: {'s': A[m['a']][0], 'f': m['f']} for n, m in anims.items()}
import re as _re                                                    # conserva las animaciones de la hoja fxzip (tools/fxzip.py)
_old = _re.match(r'window\.FX_ANIMS = (\{.*\});', S.load()[1])
if _old: anims.update({n: v for n, v in json.loads(_old.group(1)).items() if v.get('s') == 'fxzip'})
print('ok sprites.js', S.save(sheets, 'window.FX_ANIMS = %s;' % json.dumps(anims, separators=(',', ':'))))
