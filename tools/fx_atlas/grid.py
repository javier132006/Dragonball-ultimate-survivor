from PIL import Image, ImageDraw; import numpy as np
IM = {}
def img(i):
    if i not in IM: IM[i] = np.array(Image.open(f'f{i}.jpg').convert('RGB')).astype(int)
    return IM[i]
def runs(prof, th):
    on = prof > th; out = []; s = None
    for k, v in enumerate(on):
        if v and s is None: s = k
        if not v and s is not None: out.append((s, k)); s = None
    if s is not None: out.append((s, len(on)))
    return out
def row_cells(i, x0, y0, x1, y1, th=0.45):
    """Celdas de una fila: separadores = columnas casi todas oscuras (bordes de la casilla)."""
    a = img(i)[y0:y1, x0:x1]
    dark = (a.max(2) < 20).mean(0)
    lines = runs(dark, th)
    edges = [x0] + [x0 + (s + e) // 2 for s, e in lines] + [x1]
    cells = []
    for l, r in zip(edges[:-1], edges[1:]):
        if r - l < 14: continue
        # recorta en vertical por los bordes oscuros
        sub = img(i)[y0:y1, l:r]
        dv = (sub.max(2) < 20).mean(1)
        hl = runs(dv, 0.45)
        ys = [y0] + [y0 + (s + e) // 2 for s, e in hl] + [y1]
        best = max(zip(ys[:-1], ys[1:]), key=lambda t: t[1] - t[0])
        cells.append([l + 2, best[0] + 2, r - 2, best[1] - 2])
    return cells
def show(i, cells, name):
    o = Image.fromarray(img(i).astype(np.uint8)); d = ImageDraw.Draw(o)
    for j, b in enumerate(cells): d.rectangle(b, outline=(255, 0, 255)); d.text((b[0] + 1, b[1]), str(j), fill=(0, 255, 0))
    o.save(name)
