"""Broly Super Saiyan 3 (pack de Andrés Gamen, usado con su permiso) -> hoja de sprites para el juego.

  python3 tools/make_broly3.py "CARPETA CON LOS PNG" [--preview DIR]

El pack son 158 PNG sueltos, cada uno ampliado a un tamaño distinto (cada píxel original es un bloque de 5 a 12 px).
Aquí se elige un fotograma por cada papel que usa el juego (quieto, andar, golpes, rayo, golpe fuerte, daño, caída,
dash y carga de ki), se devuelve cada uno a su tamaño de píxel original y se colocan todos con los pies en el mismo
punto de la casilla. Salida: assets/broly3.js con la hoja 'broly_ss3' y su tabla de animación (mismo formato que zl3.js).
Los fotogramas se nombran por su posición al ordenar los archivos por nombre (0-157).
"""
import base64, glob, io, json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
SRC = sys.argv[1]; PREV = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
FILES = sorted(glob.glob(os.path.join(SRC, '*.png')))
PXH = 52.3                                                   # alto de casilla -> escala (hs), como el resto de hojas

def block(a):
    """Tamaño del bloque (px de pantalla por píxel original): el mayor b en el que los cambios de color caen en una rejilla"""
    c = a.astype(np.int32); c[c[..., 3] < 20] = 0
    px = np.where(np.abs(np.diff(c, axis=1)).sum(axis=2) > 40)[1] + 1; py = np.where(np.abs(np.diff(c, axis=0)).sum(axis=2) > 40)[0] + 1
    best = []
    for b in range(2, 15):
        hx = np.bincount(px % b, minlength=b); hy = np.bincount(py % b, minlength=b)
        best.append(((hx.max() / max(1, hx.sum()) + hy.max() / max(1, hy.sum())) / 2, b, int(hx.argmax()), int(hy.argmax())))
    top = max(s for s, *_ in best)
    return max((b, ox, oy) for s, b, ox, oy in best if s > top - 0.03)

def native(i):
    """Fotograma i a su tamaño original (un píxel por bloque), recortado al contenido"""
    a = np.array(Image.open(FILES[i]).convert('RGBA')); al = a[..., 3] > 20
    ys, xs = np.where(al); a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    b, ox, oy = block(a)
    X = np.arange(ox % b - b + b // 2, a.shape[1], b); X = X[X >= 0]; Y = np.arange(oy % b - b + b // 2, a.shape[0], b); Y = Y[Y >= 0]
    s = a[np.ix_(Y, X)].copy(); s[s[..., 3] < 128] = 0; s[s[..., 3] >= 128, 3] = 255
    al = s[..., 3] > 0; ys, xs = np.where(al)
    return Image.fromarray(s[ys.min():ys.max() + 1, xs.min():xs.max() + 1]), b

def feet(im):
    """Ancla: x = centro de lo que toca el suelo (pies), y = borde inferior"""
    a = np.array(im)[..., 3] > 0; h = a.shape[0]; xs = np.where(a[max(0, h - 4):].any(axis=0))[0]
    return int(round((xs.min() + xs.max() + 1) / 2)), h

if __name__ == '__main__' and '--all' in sys.argv:                 # hoja de contactos de todo el pack a tamaño original
    ims = [native(i) for i in range(len(FILES))]; cw = 150; ch = 160; cols = 12
    from PIL import ImageDraw
    M = Image.new('RGBA', (cols * cw, ((len(ims) + cols - 1) // cols) * ch), (40, 44, 70, 255)); d = ImageDraw.Draw(M)
    for i, (im, b) in enumerate(ims):
        if im.width > cw - 4 or im.height > ch - 14: im = im.copy(); im.thumbnail((cw - 4, ch - 14), Image.NEAREST)
        x = (i % cols) * cw; y = (i // cols) * ch; M.alpha_composite(im, (x + (cw - im.width) // 2, y + ch - 2 - im.height)); d.text((x + 2, y + 1), '%d b%d %dx%d' % (i, b, ims[i][0].width, ims[i][0].height), fill=(255, 255, 0, 255))
    M = M.resize((M.width * 2, M.height * 2), Image.NEAREST); M.convert('RGB').save(os.path.join(PREV, 'broly_all.png')); print(M.size); sys.exit()

# Papel -> fotogramas del pack. Elegidos a ojo: el pack no trae nombres ni orden de animación.
ROLES = [
    ('idle',  [14, 123]),               # de pie, respirando
    ('walk',  [120, 111, 109, 111]),    # carrera
    ('atk',   [49, 98, 112]),           # combo: puñetazo, patada, puñetazo largo
    ('crit',  [97]),                    # golpe fuerte: gancho con estela
    ('beam',  [153]),                   # brazo extendido: ki, rayo
    ('hurt',  [122]),                   # recibe un golpe: sale hacia atrás
    ('death', [95, 94, 82]),            # sale despedido, cae, en el suelo
    ('dash',  [92]),                    # vuelo hacia delante
    ('chgIn', [55, 78]),                # empieza a cargar
    ('chg',   [78, 79]),                # carga mantenida
]
CENTER = {95, 94, 82, 92, 122}              # en el aire o tumbado: se centran por su caja, no por los pies
LIFT = {95: 10, 94: 8, 92: 5, 122: 3}          # px por encima del suelo

def build():
    uniq, idx, seq = [], {}, {}
    for r, L in ROLES:
        seq[r] = []
        for i in L:
            if i not in idx: idx[i] = len(uniq); uniq.append(i)
            seq[r].append(idx[i])
    ims = [native(i)[0] for i in uniq]
    ax = [im.width // 2 if i in CENTER else feet(im)[0] for i, im in zip(uniq, ims)]; up = [im.height + LIFT.get(i, 0) for i, im in zip(uniq, ims)]
    half = max(max(ax), max(im.width - a for im, a in zip(ims, ax))); half += half % 2
    pad = 2; cw = half * 2; ch = max(up) + pad + 1; ch += ch % 2
    n = len(uniq); cols = min(n, 6); rows = (n + cols - 1) // cols
    sheet = Image.new('RGBA', (cw * cols, ch * rows), (0, 0, 0, 0))
    for k, (i, im) in enumerate(zip(uniq, ims)):
        sheet.paste(im, ((k % cols) * cw + half - ax[k], (k // cols) * ch + ch - pad - LIFT.get(i, 0) - im.height))
    anim = dict(idle=seq['idle'][0], idleSeq=seq['idle'], walk=seq['walk'], atk=seq['atk'][0], atkSeq=seq['atk'], atk2=seq['beam'][0], crit=seq['crit'][0],
                hurt=seq['hurt'][0], dash=seq['dash'][0], death=seq['death'], chgIn=seq['chgIn'], chgSeq=seq['chg'])
    return sheet, dict(cols=cols, rows=rows, w=cw, h=ch, hs=round(ch / PXH, 4), anc=round(pad / ch, 4), px=1), anim, uniq

if __name__ == '__main__':
    sheet, meta, anim, uniq = build()
    buf = io.BytesIO(); sheet.save(buf, 'WEBP', lossless=True, quality=100, method=6)
    meta['src'] = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode(); meta['anim'] = anim
    out = os.path.join(ROOT, 'assets', 'broly3.js')
    with open(out, 'w') as f:
        f.write('/* Generado por tools/make_broly3.py. Broly Super Saiyan 3: sprites de Andrés Gamen, usados con su permiso. */\n'
                'window.SPRITE_DATA = window.SPRITE_DATA || {};\nwindow.SPRITE_DATA["broly_ss3"] = ' + json.dumps(meta, separators=(',', ':')) + ';\n')
    print('broly_ss3', sheet.size, 'casilla', meta['w'], 'x', meta['h'], 'hs', meta['hs'], len(uniq), 'fotogramas', os.path.getsize(out) // 1024, 'KB'); print(anim)
    if PREV:
        from PIL import ImageDraw
        k = 4; P = Image.new('RGBA', (sheet.width * k, sheet.height * k), (40, 44, 70, 255)); P.alpha_composite(sheet.resize(P.size, Image.NEAREST)); d = ImageDraw.Draw(P)
        for n, i in enumerate(uniq):
            x = (n % meta['cols']) * meta['w'] * k; y = (n // meta['cols']) * meta['h'] * k
            d.rectangle((x, y, x + meta['w'] * k - 1, y + meta['h'] * k - 1), outline=(90, 96, 130, 255)); d.line((x + meta['w'] * k // 2, y + meta['h'] * k - 14, x + meta['w'] * k // 2, y + meta['h'] * k - 1), fill=(255, 60, 60, 255))
            d.text((x + 4, y + 3), '%d (pack %d) %s' % (n, i, ','.join(r for r, L in ROLES if i in L)), fill=(255, 255, 0, 255))
        P.convert('RGB').save(os.path.join(PREV, 'broly_ss3.png'))
