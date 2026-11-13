"""Guerreros y transformaciones del Altar de Shenron a partir de los «PACK DE SPRITES V3, V4 y V5».

Cada carpeta del pack trae los fotogramas sueltos de un personaje (quieto, andar, golpes, rayos, carga con aura,
caída…) como capturas AMPLIADAS con un factor distinto en cada imagen. Aquí:
  1. Se recupera el pixel art original de cada captura: se mide el tamaño de «píxel» (las fronteras de color caen
     en múltiplos de él) y se toma el color del centro de cada bloque. Así todos los fotogramas quedan a la misma
     escala, la del juego (unos 48 px de alto).
  2. Se monta la hoja del personaje con los fotogramas elegidos en SPEC (quieto, pasos, golpes, rayo, dash,
     golpe recibido y caída) y la animación que el juego tiene que usar (va en la meta: anim).
  3. Hoja de cargar ki (<id>_chg): los fotogramas de la carga con su aura.
  4. Retrato grande (u_<id>_pt) para la invocación, la Ultimate y la ficha del guerrero.

Uso: python3 tools/make_summons.py "CARPETA/PACK DE SPRITES V3" "…/V4" "…/V5" [--ver CARPETA]
     python3 tools/make_summons.py --pack G3="…/V3 ✓" --pack G4="…/V4 ✓" --pack VJ="…/Vianjo" --out assets/summons2.js [--ver CARPETA]   (segunda tanda)
Salida: assets/summons.js (mismo formato que assets/sprites.js)
"""
import base64, glob, io, json, os, re, sys
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'summons.js')
REF = 52.3          # px de la hoja que miden 3,6 unidades del mundo (igual que tools/make_zip.py)

# id: (pack, carpeta, fotogramas). idle/walk: listas (en bucle) · atk/crit: golpes · beam: rayo · chg: cargar ki
# death: 3 fotogramas (cae, en el suelo…) · pt: retrato · big: ilustración grande (opcional)
SPEC = {
    'yamcha': ('V3', 'YAMCHA', dict(idle=[24, 25], walk=[4, 17], atk=30, crit=32, beam=75, hurt=54, dash=12, death=[54, 56, 57], chg=[71, 72, 73, 72], pt=89)),
    'super17': ('V3', 'SUPER ANDROIDE 17', dict(idle=[15, 16, 17, 16], walk=[21, 22, 23, 24], atk=31, crit=41, beam=69, hurt=45, dash=27, death=[53, 54, 55], chg=[51, 52], pt=83)),
    'andro35': ('V3', 'SUPER ANDROIDE 35', dict(idle=[16, 17, 18, 17], walk=[26, 27], atk=32, crit=28, beam=71, hurt=51, dash=23, death=[53, 55, 58], chg=[47, 48], pt=101)),
    'vegito_b3': ('V3', 'VEGETTO SSJB3', dict(idle=[21, 22, 23, 24], walk=[33, 21], atk=49, crit=61, beam=110, hurt=80, dash=35, death=[80, 81, 82], chg=[93, 94], pt=117)),
    'gohankid': ('V4', 'GOHAN (SAGA SAYAGIN - SWL)', dict(idle=[6, 8], walk=[4, 5], atk=9, crit=18, beam=20, hurt=29, dash=5, death=[29, 30, 30], chg=[27, 28], pt=41, big=40)),
    'ginyu': ('V4', 'CAPIT*GINYU', dict(idle=[19, 20], walk=[22, 23], atk=30, crit=36, beam=46, hurt=16, dash=8, death=[15, 16, 17], chg=[38, 39], pt=55)),
    'gohanf': ('V4', 'MIRAI GOHAN SSJ', dict(idle=[11, 12, 13, 12], walk=[18, 16], atk=28, crit=27, beam=75, hurt=52, dash=19, death=[52, 54, 55], chg=[101, 102, 103, 104, 105], pt=112)),
    'buu_zamasu': ('V4', 'SUPER BUU (ZAMASU GATTAI ABSORVIDO)', dict(idle=[13, 14, 15, 14], walk=[36, 13], atk=46, crit=61, beam=87, hurt=121, dash=38, death=[122, 123, 125], chg=[68, 69], pt=128)),
    'goku_mui': ('V5', 'GOKU MUI*', dict(idle=[31, 32, 33, 34], walk=[50, 51], atk=55, crit=79, beam=268, hurt=184, dash=52, death=[184, 185, 186], chg=[27, 28, 29, 30], pt=300)),
    'kamba': ('V5', 'KAMBA SSJ4*', dict(idle=[6, 7, 8, 7], walk=[12, 15], atk=22, crit=27, beam=51, hurt=34, dash=16, death=[35, 36, 37], chg=[40, 41], pt=80)),
    'babyv': ('V5', 'SUPER BABY*', dict(idle=[8, 9, 10, 11], walk=[19, 22], atk=24, crit=33, beam=99, hurt=72, dash=21, death=[73, 74, 75], chg=[79, 80, 81], pt=203)),
    'vegito_ego': ('V5', 'VEGETTO EGO*', dict(idle=[20, 21, 22, 23], walk=[28, 25], atk=36, crit=50, beam=86, hurt=58, dash=29, death=[58, 59, 60], chg=[63, 64], pt=96)),
    'trunks_dbs': ('V4', 'MIRAI TRUNKS (DBS)', dict(idle=[0, 1, 2, 3], walk=[9, 10], atk=5, crit=44, beam=64, hurt=49, dash=11, death=[50, 51, 52], chg=[59, 60], pt=81)),
    'bardock_ssjl': ('V4', 'BARDOCK SSJ', dict(idle=[13, 14, 15, 14], walk=[16, 21], atk=19, crit=23, beam=63, hurt=41, dash=17, death=[42, 43, 44], chg=[48, 49], pt=94)),
    'buu_gordo': ('V3', 'MAJIN BUU (GORDO)', dict(idle=[0, 9], walk=[14, 15], atk=11, crit=10, beam=37, hurt=21, dash=38, death=[21, 30, 30], chg=[34, 35], pt=66)),
    # --- Segunda tanda (assets/summons2.js): packs «V3 ✓» y «V4 ✓» de Andrés Gamen (G3, G4) y pack de SSJ5 de Vianjo (VJ) ---
    'goku_ss4g': ('G3', 'GOKU SSJ 4 DIOS*', dict(idle=[8, 9, 10, 9], walk=[6, 7], atk=31, crit=44, beam=32, hurt=37, dash=80, death=[39, 36, 35], chg=[25, 26], combo=1, pt=0)),
    'goku_ssjgb': ('G3', 'GOKU SSJ DIOS*', dict(idle=[11, 12], walk=[7, 8], atk=21, crit=23, beam=30, hurt=25, dash=14, death=[26, 27, 28], chg=[38, 39], combo=1, pt=45)),
    'goku_lssj': ('G3', 'GOKU SSJ LEGENDARIO*', dict(idle=[16, 17, 18, 17], walk=[20, 21], atk=91, crit=47, beam=34, hurt=80, dash=65, death=[80, 79, 2], chg=[53, 55], combo=1, pt=0)),
    'goku_jacket': ('G3', 'GOKU SSJ 1*', dict(idle=[21, 22], walk=[8, 9], atk=26, crit=11, beam=18, hurt=36, dash=10, death=[35, 49, 33], chg=[39, 40, 41, 40], combo=1, pt=0)),
    'jiren_fp': ('G3', 'JIREN FULL POWER*', dict(idle=[57, 58], walk=[50, 49], atk=36, crit=31, beam=37, hurt=21, dash=34, death=[9, 11, 7], chg=[2, 3], combo=1, pt=0)),
    'bardockb': ('G4', 'BARDOCK BLACK*', dict(idle=[11, 12], walk=[59, 60], atk=57, crit=52, beam=34, hurt=40, dash=77, death=[41, 54, 39], chg=[29, 30], combo=1, pt=1)),
    'broly_fssj': ('G4', 'BROLY SSJ FALSO*', dict(idle=[71, 72], walk=[45, 46], atk=47, crit=52, beam=19, hurt=44, dash=57, death=[55, 65, 43], chg=[36, 37, 38, 37], combo=1, pt=0)),
    'black_rkk': ('G4', 'GOKU BLACK SSJ ROSE KAIOKEN*', dict(idle=[4, 5], walk=[14, 15], atk=78, crit=69, beam=37, hurt=55, dash=24, death=[51, 53, 50], chg=[46, 118], combo=1, pt=0)),
    'black_uir': ('G4', 'GOKU BLACK ULTRA*', dict(idle=[4, 5], walk=[124, 125], atk=102, crit=92, beam=53, hurt=82, dash=104, death=[77, 79, 76], chg=[65, 66], combo=1, pt=0)),
    'vegito_gkk': ('G4', 'VEGETTO SSJ DIOS*', dict(idle=[4, 5], walk=[114, 116], atk=106, crit=86, beam=45, hurt=68, dash=120, death=[65, 66, 66], chg=[143, 144], combo=1, pt=0)),
    'bardock_ss5': ('VJ', 'Bardock SSJ5', dict(idle=[13, 16], walk=[18, 19], atk=20, crit=22, beam=24, hurt=25, dash=17, death=[26, 27, 27], chg=[28, 29, 30, 29], combo=1, pt=1)),
    'gohan_ss5': ('VJ', 'Gohan Ssj5', dict(idle=[6, 29], walk=[7, 8], atk=13, crit=26, beam=15, hurt=21, dash=9, death=[16, 17, 23], chg=[27, 28], combo=1, pt=0)),
    'gotenss5': ('VJ', 'Goten ssj5', dict(idle=[10, 11], walk=[14, 18], atk=16, crit=15, beam=20, hurt=12, dash=17, death=[13, 12, 21], chg=[19, 28], combo=1, pt=0)),
    'trunks_ss5': ('VJ', 'Trunks SSJ5', dict(idle=[6, 13], walk=[14, 17], atk=19, crit=23, beam=26, hurt=16, dash=10, death=[15, 15, 15], chg=[18, 20], combo=1, pt=0)),
    'dabura': ('V5', 'DABURA', dict(idle=[0, 1, 2, 1], walk=[3, 4], atk=18, crit=16, beam=20, hurt=11, dash=56, death=[34, 35, 35], chg=[30, 31, 32, 31], pt=74)),
}

# ---------------------------------------------------------------------------------------------------------------
# Pixel art original a partir de la captura ampliada
# ---------------------------------------------------------------------------------------------------------------
def period(a):
    """Tamaño del bloque y fase (x, y): las fronteras de color caen en múltiplos de s"""
    ex = np.abs(np.diff(a.astype(int), axis=1)).sum(2) > 30
    ey = np.abs(np.diff(a.astype(int), axis=0)).sum(2) > 30
    xs = np.nonzero(ex)[1] + 1.0; ys = np.nonzero(ey)[0] + 1.0
    S = np.arange(4.0, 30.0, 0.02)
    def score(s): zx = np.exp(2j * np.pi * xs / s).mean(); zy = np.exp(2j * np.pi * ys / s).mean(); return abs(zx) + abs(zy), zx, zy
    best = max(((score(s)[0], s) for s in S))
    sc, s = best
    for m in (3, 2):                                   # un armónico (s/2, s/3) alinea igual de bien: mejor el bloque mayor
        if s * m < 40 and score(s * m)[0] > 0.85 * sc: s = s * m; break
    _, zx, zy = score(s)
    return s, (np.angle(zx) / (2 * np.pi) * s) % s, (np.angle(zy) / (2 * np.pi) * s) % s

def native(path):
    a = np.asarray(Image.open(path).convert('RGBA'))
    s, px, py = period(a)
    H, W = a.shape[:2]
    cx = np.arange(px + s / 2, W, s).astype(int); cy = np.arange(py + s / 2, H, s).astype(int)
    if px - s / 2 > 0: cx = np.r_[int(px - s / 2), cx]
    if py - s / 2 > 0: cy = np.r_[int(py - s / 2), cy]
    n = a[np.ix_(cy[cy < H], cx[cx < W])].copy()
    n[:, :, 3] = np.where(n[:, :, 3] > 127, 255, 0); n[n[:, :, 3] == 0] = 0
    # Motas sueltas (restos del recorte): fuera las manchas diminutas que quedan lejos del cuerpo; descolocaban el fotograma
    lab, k = ndimage.label(n[:, :, 3] > 0, structure=np.ones((3, 3)))
    if k > 1:
        size = ndimage.sum(n[:, :, 3] > 0, lab, range(1, k + 1)); big = int(np.argmax(size)) + 1
        near = ndimage.binary_dilation(lab == big, iterations=5)
        for j in range(1, k + 1):
            if j != big and size[j - 1] < 9 and not (near & (lab == j)).any(): n[lab == j] = 0
    im = Image.fromarray(n, 'RGBA'); b = im.getbbox()
    return im.crop(b) if b else im

# ---------------------------------------------------------------------------------------------------------------
# Hojas
# ---------------------------------------------------------------------------------------------------------------
def feet_x(im):
    a = np.asarray(im)[:, :, 3] > 0; ys, xs = np.nonzero(a)
    low = ys > im.height * 0.6
    return float(np.median(xs[low])) if low.any() else im.width / 2

def build(frames, cols, center='feet'):
    cx = [feet_x(f) if center == 'feet' else f.width / 2 for f in frames]
    CW = int(max(2 * max(c, f.width - c) for f, c in zip(frames, cx))) + 4
    CH = max(f.height for f in frames) + 3
    rows = (len(frames) + cols - 1) // cols
    S = Image.new('RGBA', (CW * cols, CH * rows), (0, 0, 0, 0))
    for i, (f, c) in enumerate(zip(frames, cx)):
        S.paste(f, ((i % cols) * CW + round(CW / 2 - c), (i // cols) * CH + CH - 2 - f.height), f)
    return S, CW, CH, rows

def encode(im):
    o = io.BytesIO(); im.save(o, 'WEBP', lossless=True, quality=100, method=6, exact=True)
    return 'data:image/webp;base64,' + base64.b64encode(o.getvalue()).decode()

def meta(S, CW, CH, cols, rows, extra=None):
    m = {'cols': cols, 'rows': rows, 'w': CW, 'h': CH, 'hs': round(CH / REF, 4), 'anc': round(2 / CH, 4), 'px': 1, 'src': encode(S)}
    if extra: m.update(extra)
    return m

def char_sheet(F, sp):
    """Celdas en orden: quieto…, pasos…, golpe, crítico, rayo, golpe recibido, dash, caída×3. La anim va en la meta"""
    cells, anim = [], {}
    def add(i): cells.append(F(i)); return len(cells) - 1
    anim['idleSeq'] = [add(i) for i in sp['idle']]; anim['idle'] = anim['idleSeq'][0]
    anim['walk'] = [add(i) for i in sp['walk']]
    anim['atk'] = add(sp['atk']); anim['crit'] = add(sp['crit']); anim['atk2'] = add(sp['beam'])
    anim['hurt'] = add(sp['hurt']); anim['dash'] = add(sp['dash']); anim['death'] = [add(i) for i in sp['death']]
    if sp.get('combo'): anim['atkSeq'] = [anim['atk'], anim['atk2'], anim['crit']]      # combo de tres golpes: puñetazo, palmada y golpe fuerte
    S, CW, CH, rows = build(cells, 4)
    return S, meta(S, CW, CH, 4, rows, {'anim': anim})

if __name__ == '__main__':
    pos = []
    for a in sys.argv[1:]:
        if a.startswith('--'): break
        pos.append(a)
    packs = dict(zip(('V3', 'V4', 'V5'), pos))
    # Otros packs: --pack CLAVE=CARPETA (varias veces) · --solo id1,id2 (solo esos) · --out ARCHIVO (otra salida, p. ej. assets/summons2.js)
    for i, a in enumerate(sys.argv):
        if a == '--pack': k, v = sys.argv[i + 1].split('=', 1); packs[k] = v
    solo = set(sys.argv[sys.argv.index('--solo') + 1].split(',')) if '--solo' in sys.argv else None
    if '--out' in sys.argv: OUT = sys.argv[sys.argv.index('--out') + 1]
    ver = sys.argv[sys.argv.index('--ver') + 1] if '--ver' in sys.argv else None
    lines = ['// Generado por tools/make_summons.py — guerreros del Altar de Shenron (PACK DE SPRITES V3-V5, no editar a mano)',
             'window.SPRITE_DATA = window.SPRITE_DATA || {};']
    for uid, (pk, folder, sp) in SPEC.items():
        if (solo and uid not in solo) or pk not in packs: continue
        d = [p for p in glob.glob(os.path.join(packs[pk], '*')) if re.fullmatch(folder.replace('(', r'\(').replace(')', r'\)').replace('*', '.*'), os.path.basename(p))][0]
        files = sorted(glob.glob(os.path.join(d, '*.png')), key=lambda p: int(re.sub(r'\D', '', os.path.basename(p)) or 0))
        cache = {}
        F = lambda i: cache.setdefault(i, native(files[i]))
        S, m = char_sheet(F, sp)
        out = {'u_' + uid: m}
        C, CW, CH, rows = build([F(i) for i in sp['chg']], len(sp['chg']))
        out['u_' + uid + '_chg'] = meta(C, CW, CH, len(sp['chg']), 1)
        P = F(sp['pt']); out['u_' + uid + '_pt'] = meta(P, P.width, P.height, 1, 1)
        if sp.get('big') is not None: B = F(sp['big']); out['u_' + uid + '_big'] = meta(B, B.width, B.height, 1, 1)
        for k, v in out.items():
            lines.append('window.SPRITE_DATA[%s] = %s;' % (json.dumps(k), json.dumps(v)))
            if ver:
                os.makedirs(ver, exist_ok=True)
                Image.open(io.BytesIO(base64.b64decode(v['src'].split(',')[1]))).save(os.path.join(ver, k + '.png'))
        print(uid, 'celdas', len(m['anim']['idleSeq']) + len(m['anim']['walk']) + 8, 'hoja', S.size, flush=True)
    open(OUT, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    print(len(lines) - 2, 'hojas ·', os.path.getsize(OUT) // 1024, 'KB ->', OUT)
