"""Personajes y transformaciones nuevas a partir de los packs de sprites de Andrés Gamen Animations.
Cada imagen del pack trae UNA pose quieta: aquí se reduce a pixel art del tamaño del juego (paleta del original)
y se hornea una hoja 4x4 con la misma disposición que A_HD (quieto, andar, ataque, rayo, crítico, golpe, dash
y caída) moviendo e inclinando la pose. Resultado: assets/pack.js (mismo formato que assets/sprites.js).

  python3 tools/make_pack.py CARPETA_PACK2 CARPETA_PACK3 [--ver CARPETA]
"""
import base64, glob, io, json, math, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'pack.js')
H0 = 92          # altura del personaje en píxeles (los mega-peinados llevan su propia altura)

# (hoja, pack, índice en el pack ordenado, girar para que mire a la derecha, altura)
LIST = [
    # Personajes nuevos (se desbloquean comprando o con retos)
    ('x_nappa', 'p2', 156, 1, 96), ('x_tenshin', 'p2', 166, 0, 92), ('x_roshi', 'p2', 308, 0, 84), ('x_satan', 'p2', 319, 0, 92),
    ('x_uub', 'p2', 193, 1, 88), ('x_granola', 'p2', 289, 0, 90), ('x_granola2', 'p2', 290, 0, 94), ('x_whis', 'p2', 5, 0, 100),
    ('x_ginyu', 'p2', 334, 0, 94), ('x_bulma', 'p2', 186, 0, 84),
    # Transformaciones del gachapón
    ('g_goku_ssj5', 'p3', 90, 1, 100), ('g_goku_inf', 'p2', 60, 0, 150), ('g_vegeta_ego', 'p2', 288, 0, 92), ('g_gohan_beast', 'p2', 1, 0, 100),
    ('g_gogeta_inf', 'p3', 104, 0, 140), ('g_gogeta_ssj4', 'p3', 81, 1, 94),
    ('g_goku_ssj3b', 'p2', 57, 0, 104), ('g_goku_golden', 'p3', 462, 1, 94), ('g_goku_rose', 'p3', 416, 1, 92), ('g_goku_beast', 'p2', 257, 1, 96),
    ('g_vegeta_ssj5', 'p3', 85, 0, 100), ('g_vegeta_ssj4lb', 'p3', 87, 1, 94), ('g_gogeta_ssj5', 'p3', 328, 0, 98), ('g_gogeta_rainbow', 'p3', 314, 0, 94),
    ('g_broly_god', 'p3', 78, 0, 100), ('g_broly_ssj5', 'p3', 80, 0, 100), ('g_black_rose3', 'p3', 157, 1, 100), ('g_freezer_black', 'p2', 287, 0, 92),
    ('g_jiren_full', 'p2', 202, 0, 96), ('g_gohan_berserk', 'p2', 66, 0, 104), ('g_goku_uispirit', 'p3', 376, 0, 96),
    ('g_goku_berserk', 'p3', 397, 1, 92), ('g_goku_god3', 'p3', 369, 1, 96), ('g_goku_ssj4lb', 'p3', 178, 1, 94), ('g_vegeta_ssj3', 'p3', 172, 0, 98),
    ('g_gogeta_ssj3', 'p3', 100, 1, 104), ('g_cooler_metal', 'p2', 12, 1, 92), ('g_jiren_rage', 'p2', 237, 0, 98), ('g_kefla_ssj2', 'p2', 261, 0, 92),
    ('g_kefla_ssj3', 'p3', 143, 1, 96), ('g_caulifla_ssj4', 'p3', 115, 1, 94), ('g_caulifla_blue', 'p3', 113, 0, 92), ('g_majin_kid', 'p3', 657, 1, 84),
]

def shrink(path, H, flip):
    """Reduce la imagen grande a pixel art: color medio de cada bloque (según su opacidad) y la paleta del original"""
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im).copy(); a[a[:, :, 3] < 40] = 0
    im = Image.fromarray(a); im = im.crop(im.getbbox()); a = np.asarray(im)
    s = H / im.height; W = max(1, round(im.width * s))
    if W > H * 2.2: W = round(H * 2.2); H = max(1, round(im.height * W / im.width))     # peinados enormes: que quepan a lo ancho
    pm = Image.fromarray(np.dstack([a[:, :, :3] * (a[:, :, 3:4] / 255.0), a[:, :, 3]]).astype('uint8'), 'RGBA')
    sm = np.asarray(pm.resize((W, H), Image.BOX)).astype(float)
    al = sm[:, :, 3]; rgb = sm[:, :, :3] / np.maximum(al[:, :, None] / 255.0, 1e-3)
    out = np.dstack([np.clip(rgb, 0, 255), np.where(al > 110, 255, 0)]).astype('uint8')
    pal = im.convert('RGB').quantize(64, method=Image.MEDIANCUT)
    q = Image.fromarray(out[:, :, :3]).quantize(palette=pal, dither=Image.NONE).convert('RGB')
    res = Image.fromarray(np.dstack([np.asarray(q), out[:, :, 3]]), 'RGBA')
    res = res.crop(res.getbbox())
    return res.transpose(Image.FLIP_LEFT_RIGHT) if flip else res

def pose(p, ang=0.0, dx=0, dy=0, sx=1.0, sy=1.0):
    """La pose girada (grados, + = se inclina hacia delante) sobre los pies, estirada y movida. Devuelve (imagen, x_pies, y_pies)"""
    w, h = p.size
    if sx != 1 or sy != 1: p = p.resize((max(1, round(w * sx)), max(1, round(h * sy))), Image.NEAREST); w, h = p.size
    big = Image.new('RGBA', (w * 3, h * 3), (0, 0, 0, 0)); big.paste(p, (w, h))
    fx, fy = w + w // 2, h + h                                                    # pies: abajo en el centro
    if ang: big = big.rotate(-ang, resample=Image.NEAREST, center=(fx, fy))
    return big, fx - dx, fy - dy

def sheet(p):
    w, h = p.size
    CW, CH = int(math.ceil(max(w * 1.45, h * 1.12))) + 4, int(math.ceil(h * 1.14)) + 2
    S = Image.new('RGBA', (CW * 4, CH * 4), (0, 0, 0, 0))
    frames = {0: {}, 1: dict(ang=3, dy=2, sy=0.98), 2: dict(ang=-2, dy=1), 3: {}, 4: {}, 5: dict(ang=9, dx=5, sx=1.05),
              6: {}, 7: {}, 8: dict(ang=-11, dx=-4), 9: dict(ang=20, dx=6, sy=0.94), 10: dict(ang=-4, dx=-2, sx=1.03), 11: dict(ang=14, dx=7, sx=1.07, sy=1.02),
              12: dict(ang=-35, dy=-2), 13: dict(ang=-65, dy=-4), 14: dict(ang=-88, dy=-6), 15: {}}
    for f, k in frames.items():
        im, fx, fy = pose(p, **k)
        col, row = f % 4, f // 4
        if abs(k.get('ang', 0)) > 15:                     # dash y caída: la figura girada, centrada y apoyada en el suelo
            bb = im.getbbox(); fx = (bb[0] + bb[2]) // 2 - k.get('dx', 0); fy = bb[3] - max(0, -k.get('dy', 0)) * 0
        ox, oy = col * CW + CW // 2 - fx, row * CH + CH - 2 - fy
        # recorta a la celda (nada se sale a la vecina)
        cell = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); cell.paste(im, (ox - col * CW, oy - row * CH), im)
        S.paste(cell, (col * CW, row * CH))
    return S, CW, CH

def encode(im):
    o = io.BytesIO(); im.save(o, 'WEBP', lossless=True, quality=100, method=6, exact=True)
    return 'data:image/webp;base64,' + base64.b64encode(o.getvalue()).decode()

if __name__ == '__main__':
    P = {'p2': sorted(glob.glob(os.path.join(sys.argv[1], '*.png'))), 'p3': sorted(glob.glob(os.path.join(sys.argv[2], '*.png')))}
    ver = sys.argv[sys.argv.index('--ver') + 1] if '--ver' in sys.argv else None
    lines = ['// Generado por tools/make_pack.py — personajes y formas del pack de Andrés Gamen Animations (no editar a mano)',
             'window.SPRITE_DATA = window.SPRITE_DATA || {};']
    for name, pk, idx, flip, H in LIST:
        p = shrink(P[pk][idx], H, flip)
        S, CW, CH = sheet(p)
        # Tamaño: el cuerpo mide lo mismo que los personajes del juego (3,3 unidades con 92 px); los peinados enormes, más
        hs = round(3.3 * CH / (3.6 * min(p.size[1], 104)) * (min(p.size[1], 104) / 92) ** 0.5, 4)
        m = {'cols': 4, 'rows': 4, 'w': CW, 'h': CH, 'hs': hs, 'anc': round(2 / CH, 4), 'px': 1, 'pack': 1, 'src': encode(S)}
        lines.append('window.SPRITE_DATA[%s] = %s;' % (json.dumps(name), json.dumps(m)))
        if ver: os.makedirs(ver, exist_ok=True); S.save(os.path.join(ver, name + '.png'))
    open(OUT, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    print(len(LIST), 'hojas ·', os.path.getsize(OUT) // 1024, 'KB ->', OUT)
