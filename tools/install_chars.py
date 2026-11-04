#!/usr/bin/env python3
"""Instala hojas de personaje (de make_chars.py / make_chars2.py): las cuantiza a 256 colores, las copia a assets/,
actualiza assets/sprites.meta.json y regenera assets/sprites.js (conserva la lista de animaciones FX_ANIMS).
Uso: python3 tools/install_chars.py CARPETA_CON_png_Y_chars.json [-quitar hoja1,hoja2]"""
import base64, json, os, sys
from PIL import Image
src = sys.argv[1]
drop = sys.argv[sys.argv.index('-quitar') + 1].split(',') if '-quitar' in sys.argv else []
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(root, 'assets')
meta = json.load(open(os.path.join(A, 'sprites.meta.json')))
new = json.load(open(os.path.join(src, 'chars.json')))
for n, m in new.items():
    im = Image.open(os.path.join(src, n + '.png')).convert('RGBA')
    im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(os.path.join(A, n + '.png'), optimize=True)
    meta[n] = m
for n in drop:
    meta.pop(n, None)
    if os.path.exists(os.path.join(A, n + '.png')): os.remove(os.path.join(A, n + '.png'))
json.dump(meta, open(os.path.join(A, 'sprites.meta.json'), 'w'), indent=1)
old = open(os.path.join(A, 'sprites.js')).read().splitlines()
anims = next(l for l in old if l.startswith('window.FX_ANIMS'))
lines = ['// Generado por tools/make_sprites.py y tools/fx_atlas/install.py — no editar a mano',
         'window.SPRITE_DATA = window.SPRITE_DATA || {};']
for n, m in meta.items():
    b64 = base64.b64encode(open(os.path.join(A, n + '.png'), 'rb').read()).decode()
    lines.append('window.SPRITE_DATA[%s] = %s;' % (json.dumps(n), json.dumps(dict(m, src='data:image/png;base64,' + b64))))
lines.append(anims)
open(os.path.join(A, 'sprites.js'), 'w').write('\n'.join(lines) + '\n')
print('ok', sorted(new), 'quitadas', drop, 'sprites.js', os.path.getsize(os.path.join(A, 'sprites.js')))
