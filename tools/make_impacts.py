"""Crea las hojas de impact frames de transformación (assets/impact/<hoja>.webp).

Uso:  python3 tools/make_impacts.py CARPETA
  CARPETA contiene las hojas de ChatGPT: 4 paneles en fila sobre fondo negro (~2172×724), con el nombre
  del archivo que aparece en MAPA (solo el principio del nombre).

Hojas: en el orden de las formas del personaje (MAPA usa el nombre de la hoja de data.js; js/transform.js
IMPACT_FORMS las asigna por posición, porque algunas formas cambian de hoja en el juego).
Pasos: se buscan los 4 paneles por las columnas que tienen dibujo (los separa una franja negra),
se recorta cada uno a su contenido y se centra en un cuadrado del mismo tamaño para toda la hoja
(así los 4 fotogramas mantienen la escala). Cada fotograma queda en 384×384 y la hoja, 4×1, en WebP."""
import os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FS = 384          # lado de cada fotograma
TH = 28           # brillo mínimo para contar como dibujo

# Principio del nombre del archivo -> hoja de la forma (form.sheet en js/data.js)
MAPA = {
    'a95d493e': 'goku', '66e29830': 'goku_kk', '829b555d': 'goku_ss', '57ecec0b': 'goku_ss2',
    '45fedb66': 'goku_ss3', '2155909c': 'goku_ss4', '771c449d': 'goku_god', '9d776a97': 'goku_blue',
    '71b2d5d3': 'goku_bkk', 'ea554c9a': 'goku_sign', '64ca34e3': 'goku_ui',
}

def runs(v, min_len):
    """Tramos seguidos donde v es True (inicio, fin)"""
    out, s = [], None
    for i, on in enumerate(list(v) + [False]):
        if on and s is None: s = i
        elif not on and s is not None:
            if i - s >= min_len: out.append((s, i))
            s = None
    return out

def panels(a):
    m = a.max(axis=2) > TH
    cols = runs(m.sum(axis=0) > 2, 60)
    if len(cols) != 4: raise ValueError('se esperaban 4 paneles y hay %d' % len(cols))
    boxes = []
    for x0, x1 in cols:
        rows = np.where(m[:, x0:x1].sum(axis=1) > 2)[0]
        boxes.append((x0, rows[0], x1, rows[-1] + 1))
    return boxes

def main(src):
    out = os.path.join(ROOT, 'assets', 'impact'); os.makedirs(out, exist_ok=True)
    files = os.listdir(src); done = []
    for pre, sheet in MAPA.items():
        fn = next((f for f in files if f.startswith(pre)), None)
        if not fn: print('falta', sheet); continue
        a = np.asarray(Image.open(os.path.join(src, fn)).convert('RGB'))
        boxes = panels(a)
        side = max(max(x1 - x0, y1 - y0) for x0, y0, x1, y1 in boxes) + 16    # mismo cuadrado para los 4
        res = Image.new('RGB', (FS * 4, FS))
        for k, (x0, y0, x1, y1) in enumerate(boxes):
            sq = Image.new('RGB', (side, side))
            sq.paste(Image.fromarray(a[y0:y1, x0:x1]), ((side - (x1 - x0)) // 2, (side - (y1 - y0)) // 2))
            res.paste(sq.resize((FS, FS), Image.LANCZOS), (k * FS, 0))
        # El negro pasa a transparente: alfa = canal más brillante y el color se recupera dividiendo por él
        # (así se ve igual sobre el juego que sobre negro, sin el cuadrado oscuro alrededor)
        c = np.asarray(res).astype(np.float32); al = c.max(axis=2, keepdims=True)
        al = np.where(al < 18, 0, al)                                  # el ruido casi negro fuera (comprime mucho mejor)
        rgb = np.where(al > 0, c * 255 / np.maximum(al, 1), 0).round(-1)   # color en pasos de 10: se nota poco y pesa menos
        res = Image.fromarray(np.concatenate([rgb, al], axis=2).clip(0, 255).astype(np.uint8), 'RGBA')
        p = os.path.join(out, sheet + '.webp'); res.save(p, 'WEBP', quality=82, alpha_quality=100, method=4)
        done.append(sheet)
    tot = sum(os.path.getsize(os.path.join(out, s + '.webp')) for s in done)
    print(len(done), 'hojas ·', tot // 1024, 'KB')

if __name__ == '__main__':
    main(sys.argv[1])
