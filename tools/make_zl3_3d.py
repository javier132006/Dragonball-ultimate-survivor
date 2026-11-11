"""Z Legends 3 -> hojas de sprites para el juego 3D (optimizadas).

  python3 tools/make_zl3_3d.py CARPETA/assets/www [--preview DIR]

Salida:
  assets/zl3.js          hojas 'z_<id>' en SPRITE_DATA (WebP sin pérdida en base64, con su tabla de animación)
  assets/zl3/            (carga bajo demanda) escenarios s/<id>.webp, retratos y voces a/<id>.m4a

Cada hoja lleva solo los fotogramas que el 3D usa (quieto, andar, golpes, rayo, golpe fuerte, daño, caída, carga de ki)
con el pie del personaje en el mismo punto de cada casilla, y el mismo tamaño de píxel que el resto de hojas del juego
(hs = alto de casilla / 52,3).
"""
import base64, io, json, os, re, sys, subprocess
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
WWW = sys.argv[1]
import make_zl3 as Z

ROOT = os.path.dirname(HERE)
PREV = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None

# Hojas que sustituyen a las de siempre: nombre de la hoja antigua -> id del luchador de Z Legends 3
REPLACE = {
    'goku': 'goku', 'goku_ss': 'gokussj', 'goku_blue': 'gokublue', 'goku_ui': 'gokuui',
    'vegeta': 'vegeta', 'vegeta_ss': 'vegetassj', 'vegeta_bfp': 'vegetaego',
    'gohan_ss2': 'gohanssj2', 'gohan_ul': 'gohanbeast',
    'trunks': 'miraitrunks', 'piccolo': 'piccolo', 'cell': 'cell', 'freezer': 'freezer',
    'bardock': 'bardock', 'bardock_ss': 'bardockssj', 'vegito_blue': 'vegettoblue',
    'gogeta_blue': 'gogetablue', 'gogeta_base': 'gogetassj4',
    'kefla': 'kefla', 'janemba': 'janemba', 'jiren': 'jiren', 'bills': 'beerus', 'hitto': 'hit', 'raditz': 'raditz',
    'andro17': 'a17', 'andro18': 'a18', 'black_rose': 'black', 'zamasuf': 'zamasu',
}
EXTRA = ['nappa', 'tien', 'moro', 'kidbuu', 'brolyz', 'brolydbs', 'ginyu', 'baby']       # sin hoja antigua: enemigos / jefes nuevos
USED = sorted(set(REPLACE.values()) | set(EXTRA))
PXH = 52.3                                                             # alto de casilla -> escala (hs)

def frames(A, name):
    return A[name]['f'] if name in A else []

def fext(f):                                  # cuánto sobresale hacia delante respecto al ancla
    return f['w'] - round(f['hx'] * f['w'])

def pick(A, names, idle, first=0, fwd=True, maxw=2.1, maxh=1.35):
    """Mejor fotograma de las animaciones `names`: el que más se estira hacia delante, sin efectos enormes alrededor"""
    best = None
    for n in names:
        fs = frames(A, n)
        for i, f in enumerate(fs):
            if i < first or f['w'] > idle['w'] * maxw or f['h'] > idle['h'] * maxh: continue
            sc = fext(f) if fwd else f['w']
            if best is None or sc > best[0]: best = (sc, f)
    return best[1] if best else None

def build(cid):
    src = [x for x in Z.FIGHTERS if x[1] == cid][0][0]
    A = Z.anims_of(Z.best_type(src)[1])
    P = frames(A, 'Parado'); idle = P[0]
    R = {}                                                     # papel -> lista de fotogramas (dict)
    R['idle'] = P
    mpf = frames(A, 'MovimentoParaFrente')[:1] or P[:1]
    pul = frames(A, 'Pulando')
    R['walk'] = mpf + (pul[1:2] or P[1:2]) + mpf + (pul[2:3] or P[2:3])
    light = [pick(A, ['Attack_Light_1'], idle, 1), pick(A, ['Attack_Light_2'], idle, 1), pick(A, ['Attack_Medium'], idle, 1)]
    R['atk'] = [f for f in light if f] or P[:1]
    R['crit'] = [pick(A, ['Attack_Heavy', 'Attack_Heavy_Frente'], idle, 1) or R['atk'][-1]]
    sp = [n for n in A if re.match(r'(Special|Ultimate)', n) and re.search(r'_Chao$|^Special$|^Special_Pt1$', n) and not re.search(r'Agachado|Aereo|Kaioken|Transformation|Telekinesis|Barrier|Copy|Counter', n)]
    sp.sort(key=lambda n: (0 if re.search(r'kamehame|flash|gun|cannon|masenko|beam|blast|galick|ray', n, re.I) else 1, n))
    beam = None
    for n in sp:
        fs = frames(A, n)
        for i, f in enumerate(fs):
            if i < max(2, len(fs) * 0.3) or f['w'] > idle['w'] * 1.9 or f['h'] > idle['h'] * 1.3: continue
            if beam is None or fext(f) > fext(beam): beam = f
        if beam: break
    R['beam'] = [beam or R['crit'][0]]
    R['hurt'] = (frames(A, 'Dano_Chao1') or frames(A, 'Dano_Aereo1') or P)[:1]
    R['death'] = [(frames(A, n) or P)[0] for n in ('Dano_Aereo1', 'SendoLancado_LADO', 'Caido')]
    ds = frames(A, 'Dash_Start')
    R['dash'] = [ds[-1] if ds else mpf[0]]
    chg = frames(A, 'CarregandoKi_Stage1') + frames(A, 'CarregandoKi_Stage2') + frames(A, 'CarregandoKi_Stage3')
    R['chg'] = [f for f in chg if f['w'] < idle['w'] * 1.5 and f['h'] < idle['h'] * 1.3] or P
    # recorte + posición de cada fotograma en la casilla
    order = ['idle', 'walk', 'atk', 'crit', 'beam', 'hurt', 'death', 'dash', 'chg']
    uniq, idx, seq = [], {}, {}
    for r in order:
        seq[r] = []
        for f in R[r]:
            k = (f['img'], f['x'], f['y'], f['w'], f['h'])
            if k not in idx: idx[k] = len(uniq); uniq.append(f)
            seq[r].append(idx[k])
    ax = [round(f['hx'] * f['w']) for f in uniq]; ay = [round(f['hy'] * f['h']) for f in uniq]
    L = max(max(ax), 1); Rr = max(max(f['w'] - a for f, a in zip(uniq, ax)), 1)
    half = max(L, Rr); half += half % 2
    U = max(ay); D = max(f['h'] - a for f, a in zip(uniq, ay)); D = max(D, 0)
    pad = 2
    cw, ch = half * 2, U + D + pad + 1
    ch += ch % 2
    n = len(uniq); cols = min(n, 6); rows = (n + cols - 1) // cols
    sheet = Image.new('RGBA', (cw * cols, ch * rows), (0, 0, 0, 0))
    for i, f in enumerate(uniq):
        c, r = i % cols, i // cols
        sheet.paste(Z.crop(f), (c * cw + half - ax[i], r * ch + ch - pad - D - ay[i]))
    anc = round((pad + D) / ch, 4)
    anim = dict(idle=seq['idle'][0], idleSeq=seq['idle'], walk=seq['walk'], atk=seq['atk'][0], atkSeq=seq['atk'], atk2=seq['beam'][0],
                crit=seq['crit'][0], hurt=seq['hurt'][0], dash=seq['dash'][0], death=seq['death'], chgSeq=seq['chg'])
    return sheet, dict(cols=cols, rows=rows, w=cw, h=ch, hs=round(ch / PXH, 4), anc=anc, px=1), anim, A

def webp_b64(im):
    b = io.BytesIO(); im.save(b, 'WEBP', lossless=True, quality=100, method=6, exact=True)
    return base64.b64encode(b.getvalue()).decode(), len(b.getvalue())

if __name__ == '__main__':
    out, tot = ['// Generado por tools/make_zl3_3d.py (Z Legends 3 · Geneildo Santos) — no editar a mano\nwindow.SPRITE_DATA = window.SPRITE_DATA || {};\n'], 0
    if PREV: os.makedirs(PREV, exist_ok=True)
    for cid in USED:
        sheet, meta, anim, A = build(cid)
        b64, n = webp_b64(sheet); tot += n
        meta = dict(meta, src='data:image/webp;base64,' + b64, anim=anim)
        out.append('window.SPRITE_DATA["z_%s"] = %s;\n' % (cid, json.dumps(meta, separators=(',', ':'))))
        print(cid.ljust(12), '%dx%d' % (meta['w'], meta['h']), '%d fotogramas' % (meta['cols'] * meta['rows']), n // 1024, 'KB', flush=True)
        if PREV:
            im = sheet.copy(); bg = Image.new('RGBA', im.size, (70, 100, 70, 255)); bg.alpha_composite(im)
            bg.resize((im.width * 2, im.height * 2), Image.NEAREST).save(os.path.join(PREV, cid + '.png'))
    out.append('window.ZL3_MAP = %s;\n' % json.dumps(REPLACE, separators=(',', ':')))
    open(os.path.join(ROOT, 'assets', 'zl3.js'), 'w').write(''.join(out))
    print('TOTAL hojas', tot // 1024, 'KB')
