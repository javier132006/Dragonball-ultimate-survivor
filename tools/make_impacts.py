"""Impact frames de cada forma (assets/impacts.js) a partir de las hojas de ChatGPT.

Uso:  python3 tools/make_impacts.py CARPETA MAPA.json [VISTA.png]
  MAPA.json: {"principio-del-nombre": ["goku/0", "goku/1", ...], ...}: una imagen por fila de formas;
  cada columna es una forma, la fila de arriba el fotograma oscuro (tinta o color) y la de abajo el blanco.

Cada pareja se recorta sobre transparente, se reduce a píxel de verdad (el cuerpo más alto de la imagen
mide unos 64 px: todas las siluetas tienen la misma densidad en pantalla) y se guarda como una hoja de
2 fotogramas alineados por los pies: window.SPRITE_DATA['ix_<id>_<forma>'] = {cols: 2, rows: 1, w, h, src}.
Las dibuja js/impactfx.js a pantalla completa (transformación y Ultimate, en Supervivencia y Versus)."""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_intros import background, cuts, reduce, strip_band, ROOT, S

OUT = os.path.join(ROOT, 'assets', 'impacts.js')
TARGET = 64

def bbox(m):
    ys, xs = np.where(m)
    return (ys.min(), ys.max() + 1, xs.min(), xs.max() + 1) if len(ys) else None

def sheet(path, n):
    a = strip_band(np.asarray(Image.open(path).convert('RGB')).astype(float))
    bg = background(a)
    xs = cuts((~bg).sum(0), n); ys = cuts((~bg).sum(1), 2)
    cells = [[None] * 2 for _ in range(n)]
    hmax = 0
    for c in range(n):
        for r in range(2):
            y0, y1, x0, x1 = ys[r], ys[r + 1], xs[c], xs[c + 1]
            m = ~bg[y0:y1, x0:x1]
            rows = np.where(m.sum(1) >= 3)[0]; cols = np.where(m.sum(0) >= 3)[0]
            if not len(rows): continue
            b = (y0 + rows[0], y0 + rows[-1] + 1, x0 + cols[0], x0 + cols[-1] + 1)
            cells[c][r] = b; hmax = max(hmax, b[1] - b[0])
    s = max(2.5, hmax / TARGET)
    out = []
    for c in range(n):
        fr = []
        for r in range(2):
            b = cells[c][r]
            if not b: fr.append(None); continue
            p = int(s)                                                   # margen para la fase de la cuadrícula
            y0, y1, x0, x1 = max(0, b[0] - p), min(a.shape[0], b[1] + p), max(0, b[2] - p), min(a.shape[1], b[3] + p)
            o = reduce(a[y0:y1, x0:x1], bg[y0:y1, x0:x1], s)
            al = o[..., 3] > 0; pp = np.pad(al, 1); H, W = al.shape
            nb = sum(pp[1 + dy:1 + dy + H, 1 + dx:1 + dx + W] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx)
            o[al & (nb <= 1), 3] = 0                                     # motas sueltas
            bb = bbox(o[..., 3] > 0)
            fr.append(o[bb[0]:bb[1], bb[2]:bb[3]] if bb else None)
        ok = [f for f in fr if f is not None]
        if not ok: out.append(None); continue
        fr = [f if f is not None else ok[0] for f in fr]
        h = max(f.shape[0] for f in fr) + 2; w = max(f.shape[1] for f in fr) + 2
        im = Image.new('RGBA', (w * 2, h), (0, 0, 0, 0))
        for k, f in enumerate(fr):                                       # alineados por los pies y centrados
            im.paste(Image.fromarray(f), (k * w + (w - f.shape[1]) // 2, h - 1 - f.shape[0]))
        out.append((im, w, h, s))
    return out

def main(src, mapa, vista=None):
    M = json.load(open(mapa)); files = os.listdir(src); data = {}; prev = []
    for pre, keys in M.items():
        fn = next((f for f in files if f.startswith(pre)), None)
        if not fn: print('falta', pre); continue
        for key, res in zip(keys, sheet(os.path.join(src, fn), len(keys))):
            if not key or not res: continue
            im, w, h, s = res; cid, fi = key.split('/'); name = 'ix_%s_%s' % (cid, fi)
            data[name] = dict(cols=2, rows=1, w=w, h=h, src=S.encode(im)); prev.append((name, im))
            print('%-10s %s píxel %.1f · %dx%d' % (key, fn[:8], s, w, h))
    lines = ['// Generado por tools/make_impacts.py — impact frames de cada forma (oscuro y blanco). Los dibuja js/impactfx.js',
             'window.SPRITE_DATA = window.SPRITE_DATA || {};']
    for n in sorted(data): lines.append('window.SPRITE_DATA[%s] = %s;' % (json.dumps(n), json.dumps(data[n])))
    open(OUT, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    print(len(data), 'impactos ·', os.path.getsize(OUT) // 1024, 'KB')
    if vista:
        Z = 2; cw = max(i.width for _, i in prev) * Z + 8; chh = max(i.height for _, i in prev) * Z + 16; per = 8
        v = Image.new('RGB', (cw * per, chh * ((len(prev) + per - 1) // per)), (255, 0, 255)); d = ImageDraw.Draw(v)
        for k, (n, i) in enumerate(prev):
            x, y = (k % per) * cw, (k // per) * chh
            v.paste(i.resize((i.width * Z, i.height * Z), Image.NEAREST), (x, y + 12), i.resize((i.width * Z, i.height * Z), Image.NEAREST)); d.text((x + 2, y), n, fill=(0, 0, 0))
        v.save(vista)

if __name__ == '__main__':
    main(*sys.argv[1:4])
