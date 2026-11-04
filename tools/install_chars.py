#!/usr/bin/env python3
"""Instala hojas de personaje (de make_chars.py / make_chars2.py) en assets/sprites.js: las cuantiza a 256 colores
y las mete (o sustituye) sin tocar las demás hojas ni la lista de animaciones FX_ANIMS.
Uso: python3 tools/install_chars.py CARPETA_CON_png_Y_chars.json [-quitar hoja1,hoja2]"""
import json, os, sys
from PIL import Image
import sprites_io as S
src = sys.argv[1]
drop = sys.argv[sys.argv.index('-quitar') + 1].split(',') if '-quitar' in sys.argv else []
sheets, anims = S.load()
new = json.load(open(os.path.join(src, 'chars.json')))
for n, m in new.items():
    im = Image.open(os.path.join(src, n + '.png')).convert('RGBA')
    q = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).convert('RGBA')
    S.put(sheets, n, q, m)
for n in drop: sheets.pop(n, None)
print('ok', sorted(new), 'quitadas', drop, 'sprites.js', S.save(sheets, anims))
