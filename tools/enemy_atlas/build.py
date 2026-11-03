"""Construye enemies.png (celdas de 96 px) y bosses.png (128 px) a partir de las 9 hojas originales
(JPG con el ajedrez "falso" de fondo), guardadas como s1.jpg ... s9.jpg en la carpeta actual:
  s1 soldado/Nappa/Ginyu · s2 Célula imperfecto/A17/Broly · s3 Freezer/Célula/Zamasu/Beerus
  s4 Omega Shenron · s5 Kid Buu · s6 Jiren · s7 Saibaiman · s8 Metal Cooler · s9 Appule
Uso:  cd carpeta_con_las_hojas && python3 bg.py && python3 boxes.py && python3 build.py
Después se cuantizan a 256 colores y se copian a assets/ (ver sprites.meta.json).
Columnas de cada fila: 0-3 caminar · 4 herido · 5 ataque · 6 lanzar técnica · 7 pose."""
import json, sys
from PIL import Image, ImageDraw; import numpy as np
from scipy import ndimage as nd
from bg import mask
B = {int(k): v for k, v in json.load(open('boxes.json')).items()}
R = {1: [84, 189], 2: [195, 293], 3: [299, 407], 4: [413, 513], 5: [519, 626], 6: [632, 750]}
C = {1: [258, 478], 2: [482, 628], 3: [628, 772], 4: [772, 926], 5: [931, 1150], 6: [1155, 1395]}
def g(r, c, cx=None): y0, y1 = R[r]; x0, x1 = cx or C[c]; return [x0, y0, x1, y1]
b = lambda s, k: ('b', s, k)
n = lambda s, r, k: ('n', s, (r, k))
m = lambda s, r, c, cx=None: ('m', s, g(r, c, cx))
ENEM = [  # (nombre, [8 fotogramas])
 ('saibai', [b(7, 0), b(7, 2), b(7, 4), b(7, 6), b(7, 20), b(7, 21), b(7, 22), b(7, 1)]),
 ('soldado', [n(1, 1, 0), n(1, 1, 1), n(1, 1, 2), n(1, 1, 1), m(1, 1, 5), n(1, 2, 2), n(1, 2, 0), m(1, 1, 1)]),
 ('appule', [b(9, 0), b(9, 1), b(9, 2), b(9, 4), b(9, 5), b(9, 3), b(9, 7), b(9, 9)]),
 ('nappa', [n(1, 3, 0), n(1, 3, 1), n(1, 3, 2), n(1, 3, 1), m(1, 3, 5), m(1, 4, 1), n(1, 4, 1), m(1, 3, 1)]),
 ('ginyu', [n(1, 5, 0), n(1, 5, 1), n(1, 5, 2), n(1, 5, 1), m(1, 5, 5), m(1, 6, 1, [258, 478]), m(1, 6, 2, [482, 703]), m(1, 5, 1)]),
 ('cellimp', [n(2, 4, 0), n(2, 4, 1), n(2, 4, 2), n(2, 4, 1), n(2, 4, 1), m(2, 4, 1), m(2, 4, 1), n(2, 4, 0)]),
 ('a17', [n(2, 5, 1), n(2, 5, 2), n(2, 5, 1), n(2, 5, 0), n(2, 5, 0), m(2, 5, 1), m(2, 5, 1), n(2, 5, 0)]),
 ('mcooler', [b(8, 2), b(8, 4), b(8, 5), b(8, 6), b(8, 19), b(8, 17), b(8, 18), b(8, 7)]),
]
BOSS = [
 ('freezer', [m(3, 3, 1), n(3, 3, 0), m(3, 3, 1), n(3, 3, 0), n(3, 3, 2), n(3, 3, 1), n(3, 3, 1), m(3, 3, 1)]),
 ('cell', [n(3, 4, 0), n(3, 4, 1), n(3, 4, 0), n(3, 4, 1), m(3, 4, 5), n(3, 4, 2), n(3, 4, 2), m(3, 4, 1)]),
 ('broly', [m(2, 6, 1, [258, 478]), m(2, 6, 2, [482, 703]), m(2, 6, 1, [258, 478]), m(2, 6, 2, [482, 703]), m(2, 6, 2, [482, 703]), m(2, 6, 2, [482, 703]), m(2, 6, 1, [258, 478]), m(2, 6, 1, [258, 478])]),
 ('buu', [b(5, 0), b(5, 2), b(5, 4), b(5, 6), b(5, 11), b(5, 8), b(5, 9), b(5, 1)]),
 ('omega', [b(4, 1), b(4, 3), b(4, 5), b(4, 6), b(4, 10), b(4, 8), b(4, 9), b(4, 0)]),
 ('jiren', [b(6, 0), b(6, 1), b(6, 2), b(6, 3), b(6, 6), b(6, 18), b(6, 15), b(6, 14)]),
 ('beerus', [n(3, 6, 0), n(3, 6, 1), n(3, 6, 0), n(3, 6, 1), m(3, 6, 5), n(3, 6, 2), n(3, 6, 2), m(3, 6, 1)]),
 ('zamasu', [n(3, 5, 0), n(3, 5, 1), n(3, 5, 0), n(3, 5, 1), m(3, 5, 5), n(3, 5, 2), ('m', 3, [1155, 519, 1395, 626]), m(3, 5, 1)]),
]
CACHE = {}
HOLES = False
HOLEROWS = {'cell', 'cellimp'}
def sheet(s):
    if s not in CACHE:
        a, rem = mask(s)
        # líneas de la cuadrícula: píxeles oscuros en filas/columnas largas de la hoja entera
        dark = a.max(2) < 140
        TH = 0.97 if s in (1, 2, 3) else 0.7
        rl = nd.uniform_filter1d(dark.astype(float), 301, axis=1) > TH
        cl = nd.uniform_filter1d(dark.astype(float), 151, axis=0) > TH
        line = nd.binary_dilation((rl | cl) & dark, iterations=4)
        CACHE[s] = (a, rem | line) if s not in (4, 8) else (a, rem)
    return CACHE[s]
def frame(spec):
    k, s, v = spec
    a, rem = sheet(s)
    if k == 'n':
        r, kk = v; y0, y1 = R[r]
        a0, rem0 = sheet(s)
        fgr = ~rem0[y0 + 3:y1 - 3, 485:923]
        lb, nn = nd.label(nd.binary_dilation(fgr, iterations=3))
        objs = [(o[1].start, o[1].stop, (lb[o] > 0).sum()) for o in nd.find_objects(lb)]
        big = max(o[2] for o in objs)
        objs = sorted([o for o in objs if o[2] > big * 0.3])
        assert kk < len(objs), (s, r, kk, objs)
        v = [485 + objs[kk][0] - 3, y0 - 9, 485 + objs[kk][1] + 3, y1 + 9]; k = 'n2'
    x0, y0, x1, y1 = B[s][v] if k == 'b' else v
    if k == 'b' and s == 7: y1 -= 24
    if k == 'b' and s == 6 and v == 14: y0 += 26
    p = 4 if k == 'b' else 0 if k == 'n2' else -3
    x0 -= p; y0 -= p; x1 += p; y1 += p
    x0, y0 = max(0, x0), max(0, y0)
    fg = ~rem[y0:y1, x0:x1]
    sub = a[y0:y1, x0:x1]
    # fuera líneas de cuadrícula: oscuras y en filas/columnas casi completas del recorte
    if HOLES:
        mx, mn = sub.max(2), sub.min(2)
        nb = ((mx - mn) < 12) & (mn > 160) & fg
        hl, hn = nd.label(nb)
        if hn:
            hs = nd.sum(nb, hl, range(1, hn + 1)); big = np.zeros(hn + 1, bool); big[1:] = hs > 25
            fg &= ~big[hl]
    lab, n = nd.label(nd.binary_dilation(fg, iterations=3))
    if n == 0: raise SystemExit('vacío %s' % (spec,))
    sz = nd.sum(fg, lab, range(1, n + 1))
    keep = np.zeros(n + 1, bool); keep[1:] = sz >= sz.max() * 0.25
    fg &= keep[lab]
    ys, xs = np.nonzero(fg)
    yy0, yy1, xx0, xx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.dstack([sub, np.where(fg, 255, 0)]).astype(np.uint8)[yy0:yy1, xx0:xx1]
    return Image.fromarray(rgba, 'RGBA')
def build(rows, cell, fill, name):
    atlas = Image.new('RGBA', (cell * 8, cell * len(rows)), (0, 0, 0, 0))
    for r, (nm, specs) in enumerate(rows):
        global HOLES
        HOLES = nm in HOLEROWS
        fr = [frame(s) for s in specs]
        ref = max(f.height for f in fr[:4])                    # altura de referencia: caminar
        k = fill * cell / ref
        for c, f in enumerate(fr):
            kk = min(k, (cell - 2) / f.width, (cell - 1) / f.height)
            w, h = max(1, round(f.width * kk)), max(1, round(f.height * kk))
            im = f.resize((w, h), Image.BOX)
            al = np.array(im); al[:, :, 3] = np.where(al[:, :, 3] > 110, 255, 0); al[al[:, :, 3] == 0] = 0
            im = Image.fromarray(al, 'RGBA')
            # centro horizontal: centro de masa de la mitad inferior (pies), así no baila al atacar
            A = al[h // 2:, :, 3] > 0
            cx = np.nonzero(A)[1].mean() if A.any() else w / 2
            px = int(round(c * cell + cell / 2 - cx)); px = min(max(px, c * cell), c * cell + cell - w)
            atlas.paste(im, (px, r * cell + cell - h - 1), im)
    atlas.save(name)
    print(name, atlas.size)
build(ENEM, 96, 0.9, 'enemies.png')
build(BOSS, 128, 0.92, 'bosses.png')
