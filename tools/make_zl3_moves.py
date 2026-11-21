"""Técnicas de Z Legends 3 (especiales, Ultimates, contraataques y transformaciones) para el juego.

  python3 tools/make_zl3_moves.py CARPETA/assets/www [--preview DIR] [ids...]

Salida (se descarga solo cuando hace falta: al elegir al personaje o al aparecer el jefe):
  assets/zl3/m/<id>.js           tabla de animaciones del luchador: ZMoves.add('<id>', {p: n.º de páginas, a: {...}})
  assets/zl3/m/<id>_<n>.webp     páginas del atlas (2048 px como máximo, WebP sin pérdida)
  assets/zl3/m/fx.js|_<n>.webp   efectos sueltos compartidos (esferas gigantes, Genki Dama, explosiones de las Ultimates)

Cada animación: {fps, l: bucle, f: [[página, x, y, w, h, ax, ay, dur, px, py], ...]}
  ax, ay: punto de apoyo (los pies) en píxeles dentro del fotograma · dur: duración en «ticks» (1 tick = 1/fps s)
  px, py: punto de disparo (Imagepoint 1 del juego original) en píxeles dentro del fotograma, si lo tiene
Los fotogramas repetidos se guardan una sola vez. Mismo tamaño de píxel que las hojas z_<id> (no se reescala nada).
"""
import json, os, re, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import make_zl3 as Z

ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'assets', 'zl3', 'm')
PREV = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
PAGE = 2048

# Luchadores de Z Legends 3 que también están en el juego (personajes o jefes de Supervivencia)
FIGHTERS = ['gokubase', 'gokussj', 'gokublue', 'gokuui', 'vegetasagasaiyan', 'vegetassj', 'vegetaegosuperior', 'gohanssj2', 'gohanbeast',
            'miraigohan', 'miraitrunks', 'piccolo', 'cell', 'freeza', 'bardock', 'bardockssj', 'vegettossjblue', 'gogetassj4', 'gogetassjblue',
            'kefla', 'janemba', 'jiren', 'bills', 'hitto', 'raditz', 'android17', 'android18', 'gokublackrose', 'zamasufusion', 'brolyz',
            'brolyikari', 'ginyu', 'superbaby2', 'kidbuu', 'nappa', 'moro73']
# (se guardan con el id que usa el juego: el segundo campo de make_zl3.FIGHTERS)
# Animaciones que se guardan: las técnicas en el suelo (las variantes en el aire, agachado o hacia arriba/abajo no se usan en 3D)
KEEP = re.compile(r'^(Special|Ultimate|Ultimatel|UltimateAttack|UltimateSsj|Transformation|Sparking)')
SKIP = re.compile(r'(_Ar(_|$)|Aereo|Agachado|agachado|_Cima|_Baixo|Errou|_Ar_|_leve$|_Leve)')
# Efectos sueltos compartidos: tipo de objeto -> animaciones (None = todas)
FX = {'esferadekigigante_sprite': None, 'genkidamaefeito_sprite': None, 'explosion_specialball_effect': None,
      'explosaodeki_effect_sprite': None, 'efeitobranconatela_sprite': None}


def pages_of(frames):
    """Reparte las imágenes (sin repetir) en páginas de PAGE×PAGE. Devuelve ([páginas], [(página, x, y)] por imagen)"""
    import hashlib
    uniq, ref, seen = [], [], {}
    for im in frames:
        h = hashlib.md5(im.tobytes() + bytes(str(im.size), 'ascii')).hexdigest()
        if h not in seen: seen[h] = len(uniq); uniq.append(im)
        ref.append(seen[h])
    order = sorted(range(len(uniq)), key=lambda k: (-uniq[k].height, -uniq[k].width))
    pages, pos = [], [None] * len(uniq)
    cur = None
    def new_page():
        return {'x': 0, 'y': 0, 'row': 0, 'items': [], 'W': 0}
    for k in order:
        w, h = uniq[k].size
        w, h = min(w, PAGE), min(h, PAGE)
        placed = False
        for pi, pg in enumerate(pages):                               # primer hueco que cabe (estantes)
            x, y, row = pg['x'], pg['y'], pg['row']
            if x + w + 1 > PAGE: x, y, row = 0, y + row + 1, 0
            if y + h <= PAGE:
                pos[k] = (pi, x, y); pg['items'].append(k); pg['x'], pg['y'], pg['row'] = x + w + 1, y, max(row, h); pg['W'] = max(pg['W'], x + w)
                placed = True; break
        if not placed:
            pg = new_page(); pages.append(pg)
            pos[k] = (len(pages) - 1, 0, 0); pg['items'].append(k); pg['x'], pg['row'] = w + 1, h; pg['W'] = w
    ims = []
    for pg in pages:
        H = max(pos[k][2] + uniq[k].height for k in pg['items'])
        A = Image.new('RGBA', (pg['W'], min(PAGE, H)), (0, 0, 0, 0))
        for k in pg['items']: A.paste(uniq[k].crop((0, 0, min(PAGE, uniq[k].width), min(PAGE, uniq[k].height))), pos[k][1:])
        ims.append(A)
    return ims, [pos[r] for r in ref]


def table(A, names):
    """Animaciones elegidas -> (lista de recortes, tabla sin las posiciones del atlas)"""
    crops, out = [], {}
    for n in names:
        a = A[n]; fl = []
        for f in a['f']:
            im = Z.crop(f); crops.append(im)
            p = [q for q in (f['pts'] or []) if q and len(q) >= 3]
            e = [round(f['hx'] * f['w'], 1), round(f['hy'] * f['h'], 1), f['d'] or 1]
            if p: e += [round(p[0][1] * f['w'], 1), round(p[0][2] * f['h'], 1)]
            fl.append(e)
        out[n] = {'fps': a['speed'] or 12, 'l': 1 if a['loop'] else 0, 'f': fl}
    return crops, out


def groups(names):
    """Técnica -> partes en orden (Pt1, Pt2… Final), sin las ramas de «fallo» (Errou)"""
    G = {}
    for n in names:
        if re.search(r'Errou|_Fail$|_DMG', n): continue
        b = re.sub(r'(_Pt\d+.*|_Final.*|_Acertou.*|_Start|_Finish|_Charge.*|_Liberar|_Changed|_Impact)$', '', n)
        G.setdefault(b, []).append(n)
    return G


def write(cid, A, names, extra=None):
    crops, T = table(A, names)
    if not crops: return 0
    ims, pos = pages_of(crops)
    k = 0
    for n in names:
        for e in T[n]['f']:
            pg, x, y = pos[k]; w, h = crops[k].size
            e[:0] = [pg, x, y, min(w, PAGE), min(h, PAGE)]; k += 1
    os.makedirs(OUT, exist_ok=True)
    size = 0
    for i, im in enumerate(ims):
        p = os.path.join(OUT, '%s_%d.webp' % (cid, i)); im.save(p, 'WEBP', lossless=True, quality=100, method=6, exact=True); size += os.path.getsize(p)
    D = {'p': len(ims), 'a': T}
    if extra: D.update(extra)
    js = 'ZMoves.add(%s,%s);\n' % (json.dumps(cid), json.dumps(D, separators=(',', ':'), ensure_ascii=False))
    open(os.path.join(OUT, cid + '.js'), 'w', encoding='utf-8').write(js); size += len(js)
    if PREV:
        os.makedirs(PREV, exist_ok=True)
        for i, im in enumerate(ims): im.save(os.path.join(PREV, '%s_%d.png' % (cid, i)))
    return size


def main():
    only = [a for a in sys.argv[2:] if not a.startswith('--') and a != PREV]
    total = 0
    ours = {f[0]: f[1] for f in Z.FIGHTERS}
    for src in FIGHTERS:
        cid = ours.get(src, src)
        if only and cid not in only and src not in only: continue
        A = Z.anims_of(Z.best_type(src)[1])
        names = [n for n in A if KEEP.match(n) and not SKIP.search(n)]
        idle = A['Parado']['f'][0]
        s = write(cid, A, names, {'g': groups(names), 'iw': idle['w'], 'ih': idle['h']}); total += s
        print('%-18s %3d animaciones · %5d KB' % (cid, len(names), s // 1024))
    if not only or 'fx' in only:
        A2, names = {}, []
        for key, want in FX.items():
            bt = Z.best_type(key, None)
            if not bt: continue
            for n, a in Z.anims_of(bt[1]).items():
                if want is None or n in want:
                    nm = key.replace('_sprite', '').replace('_effect', '') + ':' + n; A2[nm] = a; names.append(nm)
        s = write('fx', A2, names); total += s
        print('%-18s %3d animaciones · %5d KB' % ('fx', len(names), s // 1024))
    have = sorted(f[:-3] for f in os.listdir(OUT) if f.endswith('.js') and f not in ('fx.js', 'list.js'))
    open(os.path.join(OUT, 'list.js'), 'w').write('// Generado por tools/make_zl3_moves.py: luchadores con técnicas animadas (js/zmoves.js)\nwindow.ZMOVE_LIST = %s;\n' % json.dumps(have))
    print('total', total // 1024, 'KB en', os.path.relpath(OUT, ROOT))


if __name__ == '__main__':
    main()
