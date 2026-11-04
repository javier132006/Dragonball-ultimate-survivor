#!/usr/bin/env python3
"""Repinta filas de las hojas de jefes y enemigos (ROW_PATCH de make_zip.py) dentro de assets/sprites.js.
Si una fila no existe todavía, la hoja crece hacia abajo (y se actualiza su número de filas).
Uso: python3 tools/install_rows.py "CARPETA/Dragon Ball Sagas" [hoja:fila,fila ...]   (sin lista: todas las filas de ROW_PATCH)
Ejemplo: python3 tools/install_rows.py zip/"Dragon Ball Sagas" bosses:8,9,10"""
import os, sys
from PIL import Image
sys.argv = [sys.argv[0], sys.argv[1]] + sys.argv[2:]
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import make_zip as Z, sprites_io as S
sel = {}
for arg in sys.argv[2:]:
    n, rows = arg.split(':'); sel[n] = [int(r) for r in rows.split(',')]
sheets, anims = S.load()
for name, (cell, target, rows) in Z.ROW_PATCH.items():
    if sel and name not in sel: continue
    rows = {r: v for r, v in rows.items() if not sel or r in sel[name]}
    im = S.image(sheets, name); m = dict(sheets[name]); m.pop('src')
    need = max(rows) + 1
    if need > m['rows']:                                   # la hoja crece: filas nuevas transparentes
        big = Image.new('RGBA', (im.width, cell * need), (0, 0, 0, 0)); big.paste(im, (0, 0)); im = big; m['rows'] = need
    used = Z.patch_rows(im, cell, target, rows)
    q = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).convert('RGBA')
    S.put(sheets, name, q, m)
    print(name, 'filas', sorted(rows), '->', m['rows'], 'filas en total ·', ', '.join(sorted(used)))
print('sprites.js', S.save(sheets, anims))
