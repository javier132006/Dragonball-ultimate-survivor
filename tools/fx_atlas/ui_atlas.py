"""Iconos de técnicas y del menú (icons.png, casillas de 64 px) y texturas del suelo (tiles.png, 128 px)
a partir de f9.jpg y f10.jpg (carpeta actual). Uso: python3 tools/fx_atlas/ui_atlas.py SALIDA"""
import sys, os, json
from PIL import Image; import numpy as np
from cut import cut
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
f10 = Image.open('f10.jpg').convert('RGB')
# 18 iconos de técnicas: 6 columnas x 3 filas (marco incluido)
XS = [19, 134, 250, 364, 479, 594]; YS = [427, 541, 655]; S = 92
ICONS = ['kame', 'flare', 'genki', 'flash', 'explode', 'senzu', 'kaioken', 'sbc', 'galick', 'tp', 'homing', 'disc',
         'absorb', 'regen', 'power', 'barrier', 'tail', 'pole']
cells = []
for r, y in enumerate(YS):
    for c, x in enumerate(XS):
        cells.append(f10.crop((x + 2, y + 2, x + S - 2, y + S - 4)).resize((64, 64), Image.LANCZOS).convert('RGBA'))
# iconos del menú (sobre ajedrez claro): esfera, cápsula, equipo, mapa, estadísticas y sistema
MENU = [('dball', (1068, 443, 1162, 537)), ('capsule', (1188, 438, 1278, 537)), ('gear', (1293, 438, 1398, 537)),
        ('map', (1063, 643, 1162, 742)), ('stats', (1183, 643, 1282, 742)), ('system', (1298, 648, 1398, 742))]
for n, b in MENU:
    r = Image.fromarray(cut(10, b)[0]); bb = r.getbbox(); r = r.crop(bb)
    k = 60 / max(r.size); r = r.resize((max(1, round(r.width * k)), max(1, round(r.height * k))), Image.LANCZOS)
    c = Image.new('RGBA', (64, 64), (0, 0, 0, 0)); c.alpha_composite(r, ((64 - r.width) // 2, (64 - r.height) // 2)); cells.append(c)
    ICONS.append(n)
A = Image.new('RGBA', (64 * 8, 64 * 3), (0, 0, 0, 0))
for j, c in enumerate(cells): A.paste(c, ((j % 8) * 64, (j // 8) * 64))
A.save(os.path.join(out, 'icons.png'))
# Texturas de suelo (parte central de cada baldosa, sin los bordes): tierra agrietada, arena, hierba, piedra, ladrillo blanco, grieta
f9 = Image.open('f9.jpg').convert('RGB')
TW, TH = 117.3, 128
TILES = [('earth', 0, 0), ('sand', 1, 0), ('grass', 2, 1), ('stone', 0, 1), ('brick', 2, 2), ('crack', 0, 2)]
T = Image.new('RGB', (128 * 3, 128 * 2))
for j, (n, c, r) in enumerate(TILES):
    x0, y0 = c * TW + 8, r * TH + 8
    T.paste(f9.crop((round(x0), round(y0), round(x0 + TW - 16), round(y0 + TH - 16))).resize((128, 128), Image.LANCZOS), ((j % 3) * 128, (j // 3) * 128))
T.save(os.path.join(out, 'tiles.png'))
json.dump({'icons': ICONS, 'tiles': [t[0] for t in TILES]}, open(os.path.join(out, 'ui.json'), 'w'))
print(len(ICONS), 'iconos')
