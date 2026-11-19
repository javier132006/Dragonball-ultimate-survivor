"""Crea las hojas de intro de cada forma (assets/intros.js) a partir de las hojas de ChatGPT.

Uso:  python3 tools/make_intros.py CARPETA MAPA.json [VISTA.png]
  MAPA.json: {"goku/0": "principio-del-nombre-del-archivo", ...}  (id del personaje / número de la forma)
  Cada imagen es una cuadrícula de 4×4 fotogramas sobre magenta, más o menos ampliada (ChatGPT no deja
  una cuadrícula de píxel exacta).

Pasos de cada imagen:
  1. Fondo: el color de los bordes (magenta) y lo que se le parece se vuelve transparente.
  2. Fotogramas: corta la cuadrícula por los huecos de fondo más cercanos a 1/4, 2/4 y 3/4.
  3. Escala: el cuerpo de la pose final (fotogramas 13-16) tiene que medir lo mismo que el sprite de esa forma
     en el juego, así la intro tiene la misma densidad de píxel que la partida (la cuadrícula de ChatGPT no es
     exacta y no se puede deducir). Cada píxel nuevo es el color que más se repite en su bloque (los bordes no
     se emborronan) y la fase de la cuadrícula se busca en cada fotograma.
  4. Alineación: todos los fotogramas en una celda igual, con el suelo de la pose final (fotogramas 13-16)
     como línea de los pies y el centro de la última pose en el centro de la celda.
  5. Tamaño en el mundo (wh, alto de la celda en unidades), medido con el sprite de esa forma en el juego
     (assets/sprites.js o assets/zl3.js).

Resultado: window.SPRITE_DATA['in_<id>_<forma>'] = {cols, rows, w, h, wh, anc, src} en assets/intros.js
(hojas en WebP sin pérdida). js/intro.js las usa al empezar la partida y al transformarse."""
import base64, io, json, os, re, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import sprites_io as S

OUT = os.path.join(ROOT, 'assets', 'intros.js')
H_WORLD = 3.6 / 52.3          # unidades del mundo por píxel de los sprites del juego (52,3 px = 3,6 unidades)


# ---------- hojas del juego (para medir cuánto mide cada forma) ----------
def game_sheets():
    sheets, _ = S.load()
    zl3 = {}
    for line in open(os.path.join(ROOT, 'assets', 'zl3.js'), encoding='utf-8'):
        m = re.match(r'window\.SPRITE_DATA\[("[^"]+")\] = (.*);\s*$', line)
        if m: zl3[json.loads(m.group(1))] = json.loads(m.group(2))
        m = re.match(r'window\.ZL3_MAP = (.*);\s*$', line)
        if m: zl3['__map'] = json.loads(m.group(1))
    return sheets, zl3

def form_sheets():
    """Hoja de cada forma tal y como la usa el juego (data.js con la sustitución de Z Legends 3)"""
    txt = open(os.path.join(ROOT, 'js', 'data.js'), encoding='utf-8').read()
    out = {}
    for m in re.finditer(r"id: '(\w+)', name: '[^']*'.*?forms: \[(.*?)\n    \]", txt, re.S):
        if m.group(1) not in out:                                       # solo la primera vez (luego hay mapas con el mismo id)
            out[m.group(1)] = re.findall(r"form\('[^']*', \d+, '(\w+)'", m.group(2))
    return out

def sheet_image(meta):
    return Image.open(io.BytesIO(base64.b64decode(meta['src'].split(',', 1)[1]))).convert('RGBA')

def body_height(meta, frame=0):
    """Alto en píxeles del personaje en un fotograma de la hoja del juego, y alto en unidades del mundo de su celda"""
    im = np.asarray(sheet_image(meta)); cw, ch = im.shape[1] // meta['cols'], im.shape[0] // meta['rows']
    c, r = frame % meta['cols'], frame // meta['cols']
    a = im[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw, 3]
    ys = np.where(a.max(1) > 40)[0]
    hpx = (ys[-1] - ys[0] + 1) if len(ys) else ch
    cell_world = 3.6 * (meta.get('hs') or 1)           # entities.js: alto de la celda = 3,6 · hs
    return hpx * cell_world / meta['h']                 # unidades del mundo que mide el cuerpo


# ---------- 1-2. fondo y cuadrícula ----------
def background(a):
    b = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(b, axis=0)
    d = np.sqrt(((a - bg) ** 2).sum(2))
    r, g, bl = a[..., 0], a[..., 1], a[..., 2]
    fringe = (r > 170) & (bl > 170) & (g < 95) & (np.abs(r - bl) < 60)      # borde rosado entre el magenta y el contorno
    return (d < 80) | fringe

def cuts(occ, n=4):
    """Posiciones de corte: el hueco con menos dibujo cerca de cada k/n"""
    L = len(occ); out = [0]
    for k in range(1, n):
        c = round(k * L / n); w = round(L * 0.07)
        seg = occ[c - w:c + w]; m = seg.min()
        idx = np.where(seg <= m)[0]
        # el centro del tramo mínimo más cercano a c
        best = idx[np.argmin(np.abs(idx - w))]
        run = [best]
        while run[-1] + 1 < len(seg) and seg[run[-1] + 1] <= m: run.append(run[-1] + 1)
        while run[0] - 1 >= 0 and seg[run[0] - 1] <= m: run.insert(0, run[0] - 1)
        out.append(c - w + (run[0] + run[-1]) // 2)
    out.append(L)
    return out


# ---------- 3. tamaño de píxel y reducción ----------
def reduce(cell, cbg, s):
    """Reduce un fotograma por s: cada píxel = color más repetido de su bloque (o transparente si casi todo es fondo)"""
    Hc, Wc = cell.shape[:2]
    h, w = int(Hc // s), int(Wc // s)
    off = np.array([0.2, 0.4, 0.6, 0.8])
    best = None
    for py in np.linspace(0, s, 5, endpoint=False):
        for px in np.linspace(0, s, 5, endpoint=False):
            ys = (py + (np.arange(h)[:, None] + off[None, :]) * s).clip(0, Hc - 1).astype(int)   # (h,4)
            xs = (px + (np.arange(w)[:, None] + off[None, :]) * s).clip(0, Wc - 1).astype(int)   # (w,4)
            Y = ys[:, None, :, None]; X = xs[None, :, None, :]
            smp = cell[Y, X].reshape(h, w, 16, 3)
            v = smp.std(2).mean()
            if best is None or v < best[0]: best = (v, py, px, smp, cbg[Y, X].reshape(h, w, 16))
    _, py, px, smp, sb = best
    bgf = sb.mean(2)
    # medoide de las muestras que no son fondo: la que menos se aleja de las demás
    d = np.sqrt(((smp[:, :, :, None, :] - smp[:, :, None, :, :]) ** 2).sum(-1))       # (h,w,16,16)
    valid = ~sb
    d = np.where(valid[:, :, None, :], d, 1e4).sum(3)
    d = np.where(valid, d, 1e9)
    k = d.argmin(2)
    col = np.take_along_axis(smp, k[:, :, None, None], 2)[:, :, 0]
    out = np.zeros((h, w, 4), np.uint8)
    out[..., :3] = col.clip(0, 255); out[..., 3] = np.where(bgf < 0.5, 255, 0)
    return out


# ---------- 4. una hoja ----------
def src_body(bgm, ys, xs):
    """Alto del cuerpo en la imagen original: la pose final (fotogramas 13-16) con menos efectos alrededor"""
    hs = []
    for k in range(12, 16):
        r, c = k // 4, k % 4
        m = ~bgm[ys[r]:ys[r + 1], xs[c]:xs[c + 1]]
        rows = np.where(m.sum(1) >= 3)[0]                                 # filas con dibujo (no motas sueltas)
        if len(rows): hs.append(rows[-1] - rows[0] + 1)
    return min(hs)

def make(path, target):
    """target: alto del cuerpo en píxeles del juego. La escala sale de ahí (misma densidad de píxel que la partida)"""
    a = np.asarray(Image.open(path).convert('RGB')).astype(float)
    bgm = background(a)
    xs = cuts((~bgm).sum(0)); ys = cuts((~bgm).sum(1))
    s = src_body(bgm, ys, xs) / target
    frames = []
    for r in range(4):
        for c in range(4):
            y0, y1, x0, x1 = ys[r], ys[r + 1], xs[c], xs[c + 1]
            frames.append(reduce(a[y0:y1, x0:x1], bgm[y0:y1, x0:x1], s))
    # alinear: abajo en el centro de cada celda
    H = max(f.shape[0] for f in frames); W = max(f.shape[1] for f in frames)
    big = []
    for f in frames:
        o = np.zeros((H, W, 4), np.uint8); h, w = f.shape[:2]
        o[H - h:, (W - w) // 2:(W - w) // 2 + w] = f; big.append(o)
    # quita píxeles sueltos (sin vecinos opacos)
    for o in big:
        al = o[..., 3] > 0; p = np.pad(al, 1)
        nb = sum(p[1 + dy:1 + dy + H, 1 + dx:1 + dx + W] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx)
        o[al & (nb == 0), 3] = 0
    def bbox(o):
        yy, xx = np.where(o[..., 3] > 0)
        return (yy.min(), yy.max(), xx.min(), xx.max()) if len(yy) else None
    fin = [bbox(o) for o in big[12:16]]; fin = [b for b in fin if b]
    foot = int(np.median([b[1] for b in fin]))                            # línea de los pies (pose final)
    body = min(b[1] - b[0] + 1 for b in fin)                              # alto del cuerpo (la pose final con menos efectos)
    lb = bbox(big[15]) or fin[-1]; cx = (lb[2] + lb[3]) / 2                # centro de la última pose
    allb = [bbox(o) for o in big]; allb = [b for b in allb if b]
    top = min(b[0] for b in allb); bot = max(max(b[1] for b in allb), foot + 1)
    half = max(max(cx - b[2], b[3] - cx) for b in allb) + 1
    x0 = int(np.floor(cx - half)); x1 = int(np.ceil(cx + half)) + 1
    y0, y1 = max(0, top - 1), min(H, bot + 2)
    fw, fh = int(x1 - x0), int(y1 - y0)
    sheet = Image.new('RGBA', (fw * 4, fh * 4), (0, 0, 0, 0))
    for k, o in enumerate(big):
        pad = np.zeros((fh, fw, 4), np.uint8)
        sx0, sx1 = max(0, x0), min(W, x1)
        pad[:, sx0 - x0:sx1 - x0] = o[y0:y1, sx0:sx1]
        sheet.paste(Image.fromarray(pad), ((k % 4) * fw, (k // 4) * fh))
    anc = (y1 - 1 - foot) / fh                                            # parte de la celda que queda bajo los pies
    return sheet, dict(cols=4, rows=4, w=fw, h=fh), dict(s=round(float(s), 2), body=int(body), foot=int(foot - y0), anc=float(anc))


def main(src, mapa, vista=None):
    M = json.load(open(mapa)); files = os.listdir(src)
    sheets, zl3 = game_sheets(); forms = form_sheets(); zmap = zl3.get('__map', {})
    out = {}
    if os.path.exists(OUT):
        for line in open(OUT, encoding='utf-8'):
            m = re.match(r'window\.SPRITE_DATA\[("[^"]+")\] = (.*);\s*$', line)
            if m: out[json.loads(m.group(1))] = json.loads(m.group(2))
    prev = []
    for key, pre in M.items():
        cid, fi = key.split('/'); fi = int(fi)
        fn = next((f for f in files if f.startswith(pre)), None)
        if not fn: print('falta', key); continue
        old = forms[cid][fi]; zs = ('z_' + zmap[old]) if old in zmap else None
        gm = zl3[zs] if zs and zs in zl3 else sheets[old]
        idle = (gm.get('anim') or {}).get('idle', 0) or 0
        body_w = body_height(gm, idle)                                    # lo que mide el cuerpo en el juego (unidades)
        sheet, meta, info = make(os.path.join(src, fn), body_w / H_WORLD)
        meta['wh'] = round(body_w / info['body'] * meta['h'], 4)          # alto de la celda en el mundo: el cuerpo mide lo mismo
        meta['anc'] = round(info['anc'], 4)
        q = sheet.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).convert('RGBA')
        q.putalpha(sheet.getchannel('A'))
        name = 'in_%s_%d' % (cid, fi)
        out[name] = dict(meta, src=S.encode(q))
        print('%-10s %-14s píxel %.2f · celda %dx%d · cuerpo %d px · %s (%.2f u) · wh %.2f · %d KB' % (
            key, fn[:8], info['s'], meta['w'], meta['h'], info['body'], zs or old, body_w, meta['wh'], len(out[name]['src']) * 3 // 4 // 1024))
        prev.append((name, q))
    lines = ['// Generado por tools/make_intros.py — intros de cada forma (hojas 4×4 en WebP sin pérdida). Las usa js/intro.js',
             'window.SPRITE_DATA = window.SPRITE_DATA || {};']
    for n in sorted(out): lines.append('window.SPRITE_DATA[%s] = %s;' % (json.dumps(n), json.dumps(out[n])))
    lines.append('window.INTRO_SHEETS = %s;' % json.dumps(sorted(out)))
    open(OUT, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    print(len(out), 'hojas ·', os.path.getsize(OUT) // 1024, 'KB en', os.path.relpath(OUT, ROOT))
    if vista:                                                             # vista de control: cada hoja ×3 sobre gris
        Z = 3; ims = [(n, q.resize((q.width * Z, q.height * Z), Image.NEAREST)) for n, q in prev]
        Wv = max(i.width for _, i in ims); Hv = sum(i.height + 18 for _, i in ims)
        v = Image.new('RGB', (Wv, Hv), (70, 70, 80)); dr = ImageDraw.Draw(v); y = 0
        for n, i in ims:
            dr.text((4, y + 3), n, fill=(255, 255, 255)); v.paste(i, (0, y + 18), i); y += i.height + 18
        v.save(vista)

if __name__ == '__main__':
    main(*sys.argv[1:4])
