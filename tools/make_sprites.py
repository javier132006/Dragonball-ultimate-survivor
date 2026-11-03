#!/usr/bin/env python3
"""
Convierte una hoja de sprites (JPG/PNG con fondo de ajedrez "falso") en:
  - assets/<nombre>.png   spritesheet limpio, fondo transparente, celdas del mismo tamaño
  - assets/sprites.js     datos en base64 (así funciona al abrir index.html con doble clic)

Uso:
  python3 tools/make_sprites.py ENTRADA.jpg NOMBRE --xs 255,479,704,928,1152 --ys 80,248,416,585,752 [--scale 2]

--xs / --ys son las coordenadas (centro) de las líneas de la cuadrícula en la imagen original.
"""
import argparse, base64, json, os, re, sys
from collections import deque
from PIL import Image
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('name')
ap.add_argument('--xs', required=True); ap.add_argument('--ys', required=True)
ap.add_argument('--inset', type=int, default=4)      # píxeles a recortar junto a cada línea de la cuadrícula
ap.add_argument('--scale', type=int, default=2)      # reducción (2 = mitad de resolución)
a = ap.parse_args()
xs = [int(v) for v in a.xs.split(',')]; ys = [int(v) for v in a.ys.split(',')]
cols, rows = len(xs) - 1, len(ys) - 1

img = Image.open(a.src).convert('RGB')
W = min(xs[i + 1] - xs[i] for i in range(cols)) - 2 * a.inset
H = min(ys[j + 1] - ys[j] for j in range(rows)) - 2 * a.inset
W -= W % a.scale; H -= H % a.scale


def clean(cell):
    """Quita el fondo (gris/blanco neutro) conectado con el borde de la celda y limpia el halo."""
    arr = np.array(cell).astype(int)
    h, w, _ = arr.shape
    mx, mn = arr.max(axis=2), arr.min(axis=2)
    bg = ((mx - mn) < 30) & (mn > 150)               # candidato a fondo: neutro y claro
    seen = np.zeros((h, w), bool)
    dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            if bg[y, x] and not seen[y, x]: seen[y, x] = True; dq.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if bg[y, x] and not seen[y, x]: seen[y, x] = True; dq.append((y, x))
    while dq:
        y, x = dq.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and bg[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; dq.append((ny, nx))
    # Halo: píxeles claros y casi neutros pegados al fondo eliminado
    soft = ((mx - mn) < 45) & (mn > 120)
    for _ in range(2):
        pad = np.pad(seen, 1)
        near = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
        seen = seen | (near & soft)
    out = np.dstack([arr.astype(np.uint8), np.where(seen, 0, 255).astype(np.uint8)])
    return Image.fromarray(out, 'RGBA')


sheet = Image.new('RGBA', (cols * W // a.scale, rows * H // a.scale), (0, 0, 0, 0))
for r in range(rows):
    for c in range(cols):
        x0, y0 = xs[c] + a.inset, ys[r] + a.inset
        cell = clean(img.crop((x0, y0, x0 + W, y0 + H)))
        if a.scale > 1:
            cell = cell.resize((W // a.scale, H // a.scale), Image.BOX)
            al = np.array(cell)
            al[:, :, 3] = np.where(al[:, :, 3] > 127, 255, 0)   # alfa binario: bordes nítidos de pixel art
            al[al[:, :, 3] == 0] = 0
            cell = Image.fromarray(al, 'RGBA')
        sheet.paste(cell, (c * W // a.scale, r * H // a.scale))

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(os.path.join(root, 'assets'), exist_ok=True)
png = os.path.join(root, 'assets', a.name + '.png')
sheet.save(png, optimize=True)

# sprites.js: acumula todas las hojas existentes en assets/*.meta.json
meta_path = os.path.join(root, 'assets', 'sprites.meta.json')
meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
meta[a.name] = {'cols': cols, 'rows': rows, 'w': W // a.scale, 'h': H // a.scale}
json.dump(meta, open(meta_path, 'w'), indent=1)
lines = ['// Generado por tools/make_sprites.py — no editar a mano',
         'window.SPRITE_DATA = window.SPRITE_DATA || {};']
for n, m in meta.items():
    b64 = base64.b64encode(open(os.path.join(root, 'assets', n + '.png'), 'rb').read()).decode()
    lines.append('window.SPRITE_DATA[%s] = %s;' % (json.dumps(n), json.dumps(dict(m, src='data:image/png;base64,' + b64))))
open(os.path.join(root, 'assets', 'sprites.js'), 'w').write('\n'.join(lines) + '\n')
print('OK', png, sheet.size, 'celda', W // a.scale, 'x', H // a.scale)
