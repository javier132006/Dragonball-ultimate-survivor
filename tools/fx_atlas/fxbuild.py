"""Recorta los efectos y objetos de las 8 hojas (f1.jpg ... f8.jpg en la carpeta actual) según spec.py
y genera fx_fx.png, fx_big.png, fx_props.png, fx_tall.png y fxmeta.json. Después: python3 tools/fx_atlas/install.py CARPETA"""
import json
from PIL import Image, ImageDraw; import numpy as np
from scipy import ndimage as nd
from grid import img, row_cells
from spec import S
from cut import cut, addcut
CELL = {'fx': 64, 'big': 128, 'props': 96, 'tall': 192}
COLS = {'fx': 16, 'big': 8, 'props': 16, 'tall': 8}
def cells_of(sheet, reg, nc, nr, keep):
    if keep and isinstance(keep[0], tuple) and len(keep[0]) == 4: return [list(b) for b in keep]   # casillas dadas a mano (hojas 9..17)
    x0, y0, x1, y1 = reg
    if nc == 0: return [[a, y0, b, y1] for a, b in keep]
    out = []
    for r in range(nr):
        ry0 = y0 + (y1 - y0) * r // nr; ry1 = y0 + (y1 - y0) * (r + 1) // nr
        c = row_cells(sheet, x0, ry0, x1, ry1)
        if len(c) != nc:                                   # no cuadra: reparto en partes iguales
            w = (x1 - x0) / nc
            c = [[int(x0 + k * w) + 3, ry0 + 3, int(x0 + (k + 1) * w) - 3, ry1 - 3] for k in range(nc)]
        out += c
    if keep: out = [out[k] for k in keep]
    return out
def clean(sheet, b, mode):
    if mode == 'A2': return addcut(sheet, tuple(b))              # luz sobre el ajedrez gris: se resta el ajedrez
    if mode == 'B2': return cut(sheet, tuple(b))[0]
    if mode == 'C2':                                             # esfera oscura centrada (mezcla normal): recorte circular suave
        r = cut(sheet, tuple(b))[0].copy(); h, w = r.shape[:2]
        yy, xx = np.mgrid[0:h, 0:w]; d = np.hypot(xx - w / 2, yy - h / 2) / (min(w, h) * 0.46)
        r[:, :, 3] = (r[:, :, 3] * np.clip((1 - d) / 0.12, 0, 1)).astype(np.uint8)
        return r              # objeto sobre el ajedrez: se recorta
    a = img(sheet)[b[1]:b[3], b[0]:b[2]].astype(float)
    mx, mn = a.max(2), a.min(2); sat = mx - mn
    if mode in ('A', 'G'):
        k = np.clip((mx - 66) / 70, 0, 1)
        k = np.maximum(k, np.where(sat > 38, np.clip((mx - 40) / 45, 0, 1), 0))
        if mode == 'G':                                          # en blanco: el juego lo tiñe del color de la forma
            l = a.mean(2, keepdims=True); a = np.repeat(np.clip(l * 1.15, 0, 255), 3, 2)
        h, w = k.shape; F = 5.0                                  # bordes suaves: sin cortes rectos de la casilla
        yy = np.minimum(np.arange(h), np.arange(h)[::-1])[:, None]; xx = np.minimum(np.arange(w), np.arange(w)[::-1])[None, :]
        k = k * np.clip(np.minimum(yy, xx) / F, 0, 1)
        rgba = np.dstack([a, k * 255])
    else:
        bg = (sat < 22) & (mx < 78)
        lab, n = nd.label(bg)
        h, w = bg.shape
        border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        rem = np.isin(lab, list(border))
        soft = (sat < 30) & (mx < 95)
        for _ in range(2): rem |= nd.binary_dilation(rem) & soft
        rgba = np.dstack([a, np.where(rem, 0, 255)])
    return rgba.astype(np.uint8)
atl = {k: [] for k in CELL}; meta = {}
for name, sheet, reg, nc, nr, mode, at, keep in S:
    bs = cells_of(sheet, reg, nc, nr, keep)
    fr = [clean(sheet, b, mode) for b in bs]
    mode = mode[0]
    # recorte común (misma escala en toda la animación): caja del contenido de todos los fotogramas, centrada
    boxes = []
    for f in fr:
        ys, xs = np.nonzero(f[:, :, 3] > 30)
        boxes.append((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1) if len(xs) else (0, 0, 1, 1))
    mw = max(max(b[2] - b[0] for b in boxes), 1); mh = max(max(b[3] - b[1] for b in boxes), 1)
    C = CELL[at]; k = (C - 2) / max(mw, mh)
    idx = []
    for f, bb in zip(fr, boxes):
        cx, cy = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2
        if mode != 'B': cx, cy = f.shape[1] / 2, f.shape[0] / 2     # efectos: centro de la casilla (no baila)
        im = Image.fromarray(f, 'RGBA')
        im = im.resize((max(1, round(f.shape[1] * k)), max(1, round(f.shape[0] * k))), Image.LANCZOS if mode != 'B' else Image.BOX)
        cell = Image.new('RGBA', (C, C), (0, 0, 0, 0))
        if mode == 'B':                                          # objetos: apoyados abajo y centrados
            px = round(C / 2 - cx * k); py = round(C - 1 - bb[3] * k)
        else:
            px = round(C / 2 - cx * k); py = round(C / 2 - cy * k)
        cell.paste(im, (px, py), im)
        if mode == 'B':
            al = np.array(cell); al[:, :, 3] = np.where(al[:, :, 3] > 120, 255, 0); al[al[:, :, 3] == 0] = 0; cell = Image.fromarray(al)
        idx.append(len(atl[at])); atl[at].append(cell)
    meta[name] = {'a': at, 'f': idx}
for at, cells in atl.items():
    C, cols = CELL[at], COLS[at]
    rows = (len(cells) + cols - 1) // cols
    A = Image.new('RGBA', (C * cols, C * rows), (0, 0, 0, 0))
    for j, c in enumerate(cells): A.paste(c, ((j % cols) * C, (j // cols) * C))
    A.save('fx_' + at + '.png'); print(at, len(cells), A.size)
    bg = Image.new('RGBA', A.size, (30, 70, 50, 255)); bg.alpha_composite(A)
    d = ImageDraw.Draw(bg)
    for n, m in meta.items():
        if m['a'] == at:
            j = m['f'][0]; d.text(((j % cols) * C + 2, (j // cols) * C + 1), n, fill=(255, 255, 0))
    bg.save('prev_' + at + '.png')
json.dump(meta, open('fxmeta.json', 'w'))
