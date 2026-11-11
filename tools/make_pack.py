"""Personajes y transformaciones nuevas a partir de los packs de sprites de Andrés Gamen Animations.
Cada imagen del pack trae UNA pose quieta: aquí se reduce a pixel art del tamaño del juego (paleta del original)
y se hornea una hoja 4x4: con el rig por partes (A_PK: respirar, 4 pasos, golpe, rayo, crítico, golpe recibido,
dash, de rodillas y caída) o, para las melenas gigantes, moviendo e inclinando la pose entera (A_HD). Resultado: assets/pack.js (mismo formato que assets/sprites.js).

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

# ---------------------------------------------------------------------------------------------------------------
# Rig 2D automático: cada pose se parte en cuerpo (de la cadera para arriba) y dos piernas (izquierda/derecha de la
# entrepierna). Así los pasos mueven de verdad las piernas, el cuerpo respira, se inclina y estira el brazo al golpear.
# Las formas con melena gigante (el pelo tapa las piernas) siguen con la hoja simple de arriba.
# ---------------------------------------------------------------------------------------------------------------

def analyze(p):
    a = np.asarray(p)[:, :, 3] > 0
    h, w = a.shape
    cols = np.where(a.any(0))[0]
    # busca la entrepierna: subiendo desde los pies, última fila con hueco entre dos tramos grandes
    hip = None; split = None
    for y in range(h - 2, int(h * 0.45), -1):
        row = a[y]; xs = np.where(row)[0]
        if len(xs) == 0: continue
        segs = np.split(xs, np.where(np.diff(xs) > 1)[0] + 1)
        big = [s for s in segs if len(s) >= max(2, w * 0.05)]
        if len(big) >= 2:
            # hueco más ancho entre tramos grandes, cerca del centro
            best = None
            for s1, s2 in zip(big, big[1:]):
                g = (s1[-1] + s2[0]) / 2
                if best is None or abs(g - w / 2) < abs(best - w / 2): best = g
            if split is None or abs(best - split) < w * 0.2:
                hip = y; split = best if split is None else split * 0.7 + best * 0.3
        elif hip is not None and y < hip - 3:
            break
    legs = hip is not None and (h - hip) > h * 0.12
    if not legs: hip = int(h * 0.66); split = (cols[0] + cols[-1]) / 2
    hip = max(int(h * 0.5), hip - max(2, int(h * 0.04)))   # la cadera un poco por encima de la entrepierna
    return dict(h=h, w=w, hip=int(hip), split=float(split), legs=legs)

def parts(p, R):
    a = np.asarray(p).copy(); h, w = R['h'], R['w']; hip = R['hip']; sp = int(round(R['split']))
    body = a.copy(); body[hip:] = 0
    lower = a.copy(); lower[:hip - 2] = 0               # solapa 2 filas bajo el cuerpo
    L = lower.copy(); L[:, sp:] = 0
    Rr = lower.copy(); Rr[:, :sp] = 0
    I = lambda x: Image.fromarray(x, 'RGBA')
    return I(body), I(L), I(Rr), I(lower)

def rot(im, ang, cx, cy):
    """gira (grados, + = horario en pantalla) alrededor de (cx,cy) sobre un lienzo grande"""
    if not ang: return im
    return im.rotate(-ang, resample=Image.NEAREST, center=(cx, cy))

def shift(im, dx=0, up=0):
    if not dx and not up: return im
    return im.transform(im.size, Image.AFFINE, (1, 0, -dx, 0, 1, up), Image.NEAREST)

def reach(b, R, pad, amt):
    """estira hacia delante la parte delantera del torso (el brazo que golpea)"""
    if amt <= 0: return b
    h, w = R['h'], R['w']; a = np.asarray(b).copy()
    y0, y1 = pad + int(h * 0.22), pad + int(R['hip'] * 0.92)
    xs = np.where(a[y0:y1, :, 3].any(0))[0]
    if len(xs) < 4: return b
    xc = int(xs[0] + (xs[-1] - xs[0]) * 0.58)
    reg = Image.fromarray(a[y0:y1, xc:xs[-1] + 1])
    reg = reg.resize((reg.width + amt, reg.height), Image.NEAREST)
    a[y0:y1, xc:] = 0
    o = Image.fromarray(a, 'RGBA'); o.alpha_composite(reg, (xc, y0)); return o

def compose(p, R, P, k):
    h, w = R['h'], R['w']; hip = R['hip']; sp = R['split']
    pad = max(w, h); W, H = w + pad * 2, h + pad * 2
    def place(im):
        c = Image.new('RGBA', (W, H)); c.paste(im, (pad, pad)); return c
    body, L, Rr, lower = P
    hx, hy, foot = pad + sp, pad + hip, pad + h
    lx, rx = pad + sp - w * 0.1, pad + sp + w * 0.1
    out = Image.new('RGBA', (W, H))
    if R['legs']:
        back = rot(place(L), k.get('lb', 0), lx, hy); front = rot(place(Rr), k.get('lf', 0), rx, hy)
        out.alpha_composite(shift(back, up=k.get('lbu', 0))); out.alpha_composite(shift(front, up=k.get('lfu', 0)))
    else:
        s = k.get('skirt', 0) * 0.012
        lo = place(lower).transform((W, H), Image.AFFINE, (1, s, -s * foot, 0, 1, 0), Image.NEAREST)
        out.alpha_composite(lo)
    drop = 0
    q = k.get('ksq')
    if q:                                          # de rodillas: piernas aplastadas hacia los pies y el cuerpo baja
        seg = out.crop((0, hy - 2, W, foot)); nh = max(1, int(seg.height * q))
        out = Image.new('RGBA', (W, H)); out.alpha_composite(seg.resize((W, nh), Image.NEAREST), (0, foot - nh))
        drop = (foot - hy + 2) - nh
    b = place(body)
    sy = k.get('bsy', 1.0)
    if sy != 1.0: b = b.transform(b.size, Image.AFFINE, (1, 0, 0, 0, 1 / sy, hy - hy / sy), Image.NEAREST)
    b = reach(b, R, pad, k.get('reach', 0))
    b = rot(b, k.get('lean', 0), hx, hy)
    out.alpha_composite(shift(b, k.get('bx', 0), k.get('up', 0) - drop))
    if k.get('all'):
        bb = out.getbbox(); out = rot(out, k['all'], (bb[0] + bb[2]) / 2, bb[3])
    return out

POSES = {
    0: {},
    1: dict(lf=-22, lb=18, lbu=1, skirt=4),            # paso: pierna delantera adelante
    2: dict(lf=-4, lb=3, lfu=3, up=1, skirt=1),        # cruzando (cuerpo arriba)
    3: dict(lf=18, lb=-22, lfu=1, skirt=-4),           # la otra adelante
    4: dict(lf=3, lb=-4, lbu=3, up=1, skirt=-1),
    5: dict(lean=9, bx=3, lf=-22, lb=20, reach=7, skirt=4),     # golpe
    6: dict(bsy=1.02),                                  # respirar
    7: dict(bsy=1.04),
    8: dict(lean=-14, bx=-3, lf=8, lb=-4, skirt=-3),    # recibe golpe
    9: dict(lean=6, lf=28, lb=36, lfu=3, lbu=3, skirt=-6, all=18),   # dash
    10: dict(lean=5, bx=2, lf=-14, lb=18, reach=10, skirt=3),   # onda de ki
    11: dict(lean=14, bx=6, lf=-28, lb=28, reach=12, skirt=6),  # crítico
    12: dict(lean=16, ksq=0.55, lf=-10, lb=12),         # de rodillas
    13: dict(lean=10, ksq=0.55, all=-50),
    14: dict(all=-86),
    15: {},
}

RIG_OFF = {'g_goku_inf', 'g_gogeta_inf'}

def sheet_rig(p):
    R = analyze(p); Pt = parts(p, R); pad = max(R['w'], R['h']); ax = pad + R['w'] / 2
    fr = [compose(p, R, Pt, POSES[f]) for f in range(16)]
    bbs = [f.getbbox() for f in fr]
    CW = int(max(2 * max(ax - b[0], b[2] - ax) for b in bbs)) + 4
    CH = max(b[3] - b[1] for b in bbs) + 4
    S = Image.new('RGBA', (CW * 4, CH * 4), (0, 0, 0, 0))
    for f, (im, b) in enumerate(zip(fr, bbs)):
        col, row = f % 4, f // 4
        S.paste(im, (int(col * CW + CW / 2 - ax), row * CH + CH - 2 - b[3]), im)
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
        rigged = name not in RIG_OFF
        S, CW, CH = sheet_rig(p) if rigged else sheet(p)
        # Tamaño: el cuerpo mide lo mismo que los personajes del juego (3,3 unidades con 92 px); los peinados enormes, más
        hs = round(3.3 * CH / (3.6 * min(p.size[1], 104)) * (min(p.size[1], 104) / 92) ** 0.5, 4)
        m = {'cols': 4, 'rows': 4, 'w': CW, 'h': CH, 'hs': hs, 'anc': round(2 / CH, 4), 'px': 1, 'pack': 1, 'rig': int(rigged), 'src': encode(S)}
        lines.append('window.SPRITE_DATA[%s] = %s;' % (json.dumps(name), json.dumps(m)))
        if ver: os.makedirs(ver, exist_ok=True); S.save(os.path.join(ver, name + '.png'))
    open(OUT, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    print(len(LIST), 'hojas ·', os.path.getsize(OUT) // 1024, 'KB ->', OUT)
