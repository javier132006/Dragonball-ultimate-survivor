import json
from PIL import Image, ImageDraw; import numpy as np
from scipy import ndimage as nd
from bg import mask
out = {}
for i in range(1, 10):
    a, rem = mask(i)
    fg = ~rem
    # quitar líneas de la cuadrícula: píxeles muy oscuros en filas/columnas casi completas
    dark = a.max(2) < 90
    rowl = dark.mean(1) > 0.45; coll = dark.mean(0) > 0.35
    fg[rowl, :] &= ~dark[rowl, :]; fg[:, coll] &= ~dark[:, coll]
    d = nd.binary_dilation(fg, iterations=5)
    lab, n = nd.label(d)
    bx = []
    for k, sl in enumerate(nd.find_objects(lab), 1):
        y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
        h, w = y1 - y0, x1 - x0
        cnt = (fg[sl] & (lab[sl] == k)).sum()
        if h < 40 or w < 20 or cnt < 600: continue
        if cnt / (h * w) < 0.06: continue
        bx.append([x0 + 5, y0 + 5, x1 - 5, y1 - 5])
    bx.sort(key=lambda b: (round(b[1] / 60), b[0]))
    out[i] = bx
    o = Image.open(f'm{i}.png'); dr = ImageDraw.Draw(o)
    for j, b in enumerate(bx):
        dr.rectangle(b, outline=(0, 255, 0)); dr.text((b[0] + 2, b[1] + 2), str(j), fill=(255, 255, 0))
    o.save(f'b{i}.png')
json.dump(out, open('boxes.json', 'w'))
for i in out: print(i, len(out[i]))
