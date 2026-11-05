#!/usr/bin/env python3
"""Hoja de efectos «fxzip»: los efectos sueltos que trae el pack «Dragon Ball Sagas» (bolas de ki, esferas, rayos, explosiones,
el sol de la Supernova de Cooler, los cubos de Hit, el portal de Janemba...), en casillas de 128 px a su tamaño original.
Mete la hoja en assets/sprites.js y añade (o sustituye) sus animaciones en FX_ANIMS con s = 'fxzip'.
Uso: python3 tools/fxzip.py "CARPETA/Dragon Ball Sagas" [CARPETA_DE_VISTA_PREVIA]"""
import json, os, re, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
PREVIEW = sys.argv[2] if len(sys.argv) > 2 else None
sys.argv = [sys.argv[0], sys.argv[1]]                 # make_zip lee la carpeta del pack de sys.argv[1]
import make_zip as Z, sprites_io as S
VG, BR, BD = 'VEGITO fases/', 'BROLY fases/', 'BARDOCK fases/'
# nombre: [(carpeta, fotograma), ...]   (z = prefijo de los efectos del pack)
FX = {
 'zkiY': [(VG + 'Vegito', 111), (VG + 'Vegito', 112)],                    # bola de ki amarilla con estela
 'zblastY': [(VG + 'Vegito Ssj1', 55), (VG + 'Vegito Ssj1', 56)],         # ráfaga amarilla grande
 'zcometY': [(VG + 'Vegito Ssj1', 60), (VG + 'Vegito Ssj1', 61)],         # cometa
 'zsphereB': [(VG + 'Vegito Ssj1', n) for n in (86, 87, 88, 89)],          # esfera azul que crece
 'zbeamB': [(VG + 'Vegito Ssj1', 108), (VG + 'Vegito Ssj1', 109)],        # cabeza de rayo azul con anillos
 'zkiG': [(BR + 'Broly Segunda Forma', n) for n in (66, 67, 68)],         # bolas de ki verdes
 'zwaveG': [(BR + 'Broly Segunda Forma', 74), (BR + 'Broly Segunda Forma', 90)],   # onda verde
 'zstarG': [(BR + 'Broly Segunda Forma', 89)],                            # destello verde
 'zblastG': [(BR + 'Broly Full Power', 55), (BR + 'Broly Full Power', 66)],         # ráfaga verde gigante
 'zburstG': [(BR + 'Broly Full Power', 65)],                              # estallido verde
 'zsun': [('Cooler', 126)],                                               # el sol de la Supernova
 'znova': [('Cooler', 130), ('Cooler', 131)],                             # su explosión
 'zburstP': [('HITTO/Hitto', n) for n in (131, 132, 135)],                # estallido morado
 'zslashP': [('HITTO/Hitto', n) for n in (144, 147, 149, 163)],           # tajos morados
 'zcage': [('HITTO/Hitto', n) for n in (175, 178, 181)],                  # cubos de la prisión del tiempo
 'zfireO': [('Toppo', 67), ('Toppo', 68)],                                # bola de fuego y su estallido
 'zbeamO': [('Toppo', 78)],                                               # rayo naranja
 'zkiR': [('Caulifla', 79)],                                              # bola de ki roja
 'zburstR': [('Caulifla', 80)],                                           # estallido rojo
 'zscatR': [('Caulifla', n) for n in (81, 82, 83, 84)],                   # ráfaga que se dispersa
 'zportal': [('Janemba', n) for n in (39, 40, 41)],                       # portal dimensional
 'zring': [('Turles', 64), ('Turles', 67)],                               # aro del Kill Driver
 'zpink': [('MAJIN BUU formas/Majin Buu', n) for n in (64, 65, 66)],      # esfera de caramelo
 'zpinkB': [('MAJIN BUU formas/Majin Buu', n) for n in (73, 74, 75)],     # explosión de caramelo
 'zfireB': [(BD + 'Bardock SSJ4', 58), (BD + 'Bardock SSJ4', 49)],        # fuego / explosión
 'zhellF': [('ANDROIDES/Androide 16', n) for n in (45, 46, 47)],          # ráfagas de fuego de A-16
 'zsunX': [('Gogeta', n) for n in (33, 37, 38, 39)],                      # explosión de luz
 'zkiP': [('RADITZ fases/Raditz', 53), ('RADITZ fases/Raditz', 54)],      # ráfaga morada
}
CELL, COLS = 128, 16
frames, meta, ext = [], {}, {}   # ext: tamaño del dibujo dentro de la casilla (para dibujarlo al tamaño pedido)
for name, L in FX.items():
    idx = []
    for fo, n in L:
        im = Image.fromarray(Z.clean_lines(Z.load(fo, n)))
        if im.width > CELL - 2 or im.height > CELL - 2:
            f = min((CELL - 2) / im.width, (CELL - 2) / im.height); im = im.resize((max(1, int(im.width * f)), max(1, int(im.height * f))), Image.NEAREST)
        idx.append(len(frames)); frames.append(im); ext.setdefault(name, []).append(max(im.width, im.height) / CELL)
    meta[name] = idx
rows = (len(frames) + COLS - 1) // COLS
sheet = Image.new('RGBA', (CELL * COLS, CELL * rows), (0, 0, 0, 0))
for i, im in enumerate(frames):
    x, y = (i % COLS) * CELL, (i // COLS) * CELL
    sheet.paste(im, (x + (CELL - im.width) // 2, y + (CELL - im.height) // 2), im)       # centrado (los efectos giran sobre su centro)
if PREVIEW:
    os.makedirs(PREVIEW, exist_ok=True)
    bg = Image.new('RGBA', sheet.size, (40, 40, 60, 255)); bg.alpha_composite(sheet); bg.save(os.path.join(PREVIEW, 'fxzip.png'))
sheets, anims = S.load()
q = sheet.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).convert('RGBA')
S.put(sheets, 'fxzip', q, {'cols': COLS, 'rows': rows, 'w': CELL, 'h': CELL})
A = json.loads(re.match(r'window\.FX_ANIMS = (\{.*\});', anims).group(1))
for n, f in meta.items(): A[n] = {'s': 'fxzip', 'f': f, 'e': round(max(ext[n]), 3)}
print(len(frames), 'fotogramas,', len(meta), 'animaciones · sprites.js', S.save(sheets, 'window.FX_ANIMS = %s;' % json.dumps(A, separators=(',', ':'))))
