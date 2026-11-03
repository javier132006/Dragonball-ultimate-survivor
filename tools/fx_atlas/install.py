#!/usr/bin/env python3
"""Cuantiza los atlas de efectos (fx_*.png de fxbuild.py) a 256 colores, los copia a assets/
y regenera assets/sprites.js con todas las hojas y la lista de animaciones (window.FX_ANIMS).
Uso: python3 tools/fx_atlas/install.py CARPETA_CON_fx_*.png_Y_fxmeta.json"""
import base64, json, os, sys
from PIL import Image
src = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
A = {'fx': ('fx', 16, 64), 'big': ('fxbig', 8, 128), 'props': ('props', 16, 96), 'tall': ('tall', 8, 192)}
meta = json.load(open(os.path.join(root, 'assets', 'sprites.meta.json')))
for k, (name, cols, cell) in A.items():
    im = Image.open(os.path.join(src, 'fx_' + k + '.png'))
    im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(os.path.join(root, 'assets', name + '.png'), optimize=True)
    meta[name] = {'cols': cols, 'rows': im.height // cell, 'w': cell, 'h': cell}
json.dump(meta, open(os.path.join(root, 'assets', 'sprites.meta.json'), 'w'), indent=1)
anims = json.load(open(os.path.join(src, 'fxmeta.json')))
anims = {n: {'s': A[m['a']][0], 'f': m['f']} for n, m in anims.items()}
lines = ['// Generado por tools/make_sprites.py y tools/fx_atlas/install.py — no editar a mano',
         'window.SPRITE_DATA = window.SPRITE_DATA || {};']
for n, m in meta.items():
    b64 = base64.b64encode(open(os.path.join(root, 'assets', n + '.png'), 'rb').read()).decode()
    lines.append('window.SPRITE_DATA[%s] = %s;' % (json.dumps(n), json.dumps(dict(m, src='data:image/png;base64,' + b64))))
lines.append('window.FX_ANIMS = %s;' % json.dumps(anims, separators=(',', ':')))
open(os.path.join(root, 'assets', 'sprites.js'), 'w').write('\n'.join(lines) + '\n')
print('ok', {k: meta[v[0]] for k, v in A.items()})
