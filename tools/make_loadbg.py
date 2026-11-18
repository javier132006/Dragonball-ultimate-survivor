"""Crea el atlas del fondo animado de la pantalla de carga (assets/load/atlas.webp + js/loadatlas.js).

Uso:  python3 tools/make_loadbg.py CAPAS.png EXTRAS.png
  CAPAS.png  = collage de ChatGPT con el cielo, las montañas, los acantilados, las nubes y las hojas 4×4
               (nave de Freezer, estrellas y esfera; Goku, Vegeta y la cápsula ya no se usan), con el
               «transparente» dibujado como un cuadriculado gris.
  EXTRAS.png = collage con fondo negro (aurora, islas flotantes, rayos, meteoros, luciérnagas).

Pasos: se quita el cuadriculado (relleno desde los bordes de cada panel) o el negro, se corta cada hoja
en 4×4, cada fotograma se recentra por su silueta (los dibujos de la IA no están alineados en la
cuadrícula) y todo se empaqueta en un único atlas. Las coordenadas de los paneles son las de esos dos
collages (1536×1024)."""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def key_checker(rgb, trapped=False):
    """Quita el cuadriculado gris claro conectado con el borde (y, si trapped, el que queda encerrado)"""
    a = rgb.astype(int); mx = a.max(2); mn = a.min(2)
    N = (mx - mn <= 16) & (mn >= 222)
    lab, n = nd.label(N)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    if trapped:                         # huecos encerrados (entre las espiras de Shenron): textura de dos tonos
        for i, s in enumerate(nd.find_objects(lab), 1):
            if i in edge or s is None: continue
            m = lab[s] == i
            if m.sum() < 60: continue
            v = mn[s][m]; lo = (v < 246).mean()
            if 0.2 < lo < 0.8: bg[s] |= m
    ring = nd.binary_dilation(bg, iterations=2) & ~bg & (mx - mn <= 24) & (mn >= 190)
    bg |= ring
    # Líneas de la cuadrícula del collage (grises, verticales u horizontales) que han quedado sueltas
    G = (mx - mn <= 14) & (mn >= 120) & (mx <= 225)
    for ax in (0, 1):
        run = nd.binary_opening(G, structure=np.ones((25, 1) if ax == 0 else (1, 25)))
        bg |= nd.binary_dilation(run, iterations=1) & (mx - mn <= 20)
    return np.dstack([rgb, np.where(bg, 0, 255).astype(np.uint8)])

def key_black(rgb, thr=30):
    """Quita el negro conectado con el borde (con borde suave según el brillo)"""
    a = rgb.astype(int); mx = a.max(2)
    lab, n = nd.label(mx < thr)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    al = np.where(bg, 0, 255).astype(float)
    fr = nd.binary_dilation(bg, iterations=1) & ~bg              # transición suave en el contorno
    al[fr] = np.clip((mx[fr] - thr) / 40 * 255, 60, 255)
    return np.dstack([rgb, al.astype(np.uint8)])

def frames(rgba, cols=4, rows=4, pad=2):
    """Corta en cols×rows, recorta cada fotograma por su silueta y los devuelve en celdas iguales, centrados"""
    H, W = rgba.shape[:2]; out = []
    for r in range(rows):
        for c in range(cols):
            y0, y1 = round(r * H / rows), round((r + 1) * H / rows); x0, x1 = round(c * W / cols), round((c + 1) * W / cols)
            f = rgba[y0 + 3:y1 - 3, x0 + 3:x1 - 3]                     # 3 px de margen: fuera las líneas de la cuadrícula
            ys, xs = np.nonzero(f[:, :, 3] > 40)
            out.append(f[ys.min():ys.max() + 1, xs.min():xs.max() + 1] if len(ys) else f[:1, :1] * 0)
    cw = max(f.shape[1] for f in out) + pad * 2; ch = max(f.shape[0] for f in out) + pad * 2
    cells = []
    for f in out:
        cell = np.zeros((ch, cw, 4), np.uint8)
        y = (ch - f.shape[0]) // 2; x = (cw - f.shape[1]) // 2
        cell[y:y + f.shape[0], x:x + f.shape[1]] = f
        cells.append(cell)
    return cells, cw, ch

def main(capas, extras):
    A = np.asarray(Image.open(capas).convert('RGB')); B = np.asarray(Image.open(extras).convert('RGB'))
    crop = lambda im, x0, y0, x1, y1: im[y0:y1, x0:x1]
    pieces = {}                                   # nombre -> (imagen RGBA, info)
    # Fondos (bandas): cielo opaco; montañas, acantilados y nubes sin el cuadriculado
    sky = crop(A, 4, 4, 613, 350)
    pieces['sky'] = (np.dstack([sky, np.full(sky.shape[:2], 255, np.uint8)]), {})
    for k, box in {'mount': (4, 356, 613, 500), 'cliff': (4, 500, 613, 629), 'cloud': (4, 629, 613, 763)}.items():
        pieces[k] = (key_checker(crop(A, *box)), {})
    # Hojas 4×4 del collage de capas (con cuadriculado) y las estrellas (fondo negro: se dibujan con «screen»)
    for k, box, tr in [('ship', (628, 711, 869, 1017), False), ('ball', (1175, 711, 1530, 1017), False)]:
        cells, cw, ch = frames(key_checker(crop(A, *box), tr))
        pieces[k] = (np.vstack([np.hstack(cells[i * 4:i * 4 + 4]) for i in range(4)]), {'cols': 4, 'rows': 4, 'fw': cw, 'fh': ch})
    st = crop(A, 882, 712, 1161, 1017)
    pieces['stars'] = (np.dstack([st, np.full(st.shape[:2], 255, np.uint8)]), {'cols': 4, 'rows': 4, 'add': 1})
    # Extras con fondo negro: la aurora, los rayos, los meteoros y las luciérnagas se suman con luz («screen»); las islas se recortan
    for k, box, info in [('aurora', (7, 7, 762, 125), {'add': 1}), ('bolt', (8, 298, 481, 416), {'cols': 4, 'rows': 1, 'add': 1}),
                         ('meteor', (495, 298, 1031, 416), {'cols': 4, 'rows': 1, 'add': 1}), ('flies', (8, 882, 450, 995), {'add': 1})]:
        im = crop(B, *box); pieces[k] = (np.dstack([im, np.full(im.shape[:2], 255, np.uint8)]), info)
    isl = key_black(crop(B, 7, 137, 762, 284))
    # Islas: cada isla por separado (componentes grandes)
    lab, n = nd.label(nd.binary_closing(isl[:, :, 3] > 40, iterations=4))
    k = 0
    for s in sorted(nd.find_objects(lab), key=lambda s: s[1].start):
        if s is None or (s[0].stop - s[0].start) * (s[1].stop - s[1].start) < 900: continue
        pieces['isle%d' % k] = (isl[s], {}); k += 1
    # Pétalos de cerezo (fondo negro): cada pétalo por separado, con el borde suave según el brillo
    pt = crop(B, 746, 429, 1528, 515).astype(float)
    mx = pt.max(2); al = np.clip((mx - 22) / 70, 0, 1)
    col = np.clip(pt / np.maximum(al, 0.05)[:, :, None], 0, 255)               # color sin el negro mezclado
    lab, n = nd.label(nd.binary_dilation(mx > 60, iterations=2))
    k = 0
    for s in nd.find_objects(lab):
        if s is None: continue
        m = lab[s] > 0
        if (mx[s] > 60).sum() < 90: continue
        rgba = np.dstack([col[s], al[s] * 255 * m]).astype(np.uint8)
        pieces['petal%d' % k] = (rgba, {}); k += 1
    pack(pieces)

def pack(pieces):
    """Empaqueta las piezas {nombre: (RGBA, info)} en assets/load/atlas.webp y escribe js/loadatlas.js"""
    # Empaquetado en filas (estantería) con 2 px de separación
    W = 1536; x = y = rowh = 0; atlas_parts = []; meta = {}
    for name, (im, info) in sorted(pieces.items(), key=lambda kv: -kv[1][0].shape[0]):
        h, w = im.shape[:2]
        if x + w > W: x = 0; y += rowh + 2; rowh = 0
        atlas_parts.append((x, y, im)); meta[name] = dict(info, x=x, y=y, w=w, h=h)
        x += w + 2; rowh = max(rowh, h)
    H = y + rowh
    at = np.zeros((H, W, 4), np.uint8)
    for x, y, im in atlas_parts: at[y:y + im.shape[0], x:x + im.shape[1]] = im
    os.makedirs(os.path.join(ROOT, 'assets', 'load'), exist_ok=True)
    out = os.path.join(ROOT, 'assets', 'load', 'atlas.webp')
    Image.fromarray(at, 'RGBA').save(out, 'WEBP', quality=90, alpha_quality=100, method=6)
    with open(os.path.join(ROOT, 'js', 'loadatlas.js'), 'w', encoding='utf-8') as f:
        f.write('// Generado por tools/make_loadbg.py — piezas del fondo animado de la pantalla de carga (assets/load/atlas.webp)\n')
        f.write('window.LOAD_ATLAS = ' + json.dumps(meta, separators=(',', ':')) + ';\n')
    print(out, W, H, os.path.getsize(out) // 1024, 'KB ·', len(meta), 'piezas')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
