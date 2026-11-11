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
# Jefes del modo supervivencia que pasan a usar su hoja de Z Legends 3 (id del jefe -> luchador)
BOSS = {'freezer': 'freezer', 'cell': 'cell', 'broly': 'brolyz', 'buu': 'kidbuu', 'jiren': 'jiren', 'beerus': 'beerus', 'zamasu': 'zamasu',
        'janemba': 'janemba', 'hit': 'hit', 'raditz': 'raditz', 'nappa': 'nappa', 'ginyu': 'ginyu', 'moro': 'moro', 'baby': 'baby'}
EXTRA = ['nappa', 'tien', 'moro', 'kidbuu', 'brolyz', 'brolydbs', 'ginyu', 'baby']       # sin hoja antigua: enemigos / jefes nuevos
USED = sorted(set(REPLACE.values()) | set(EXTRA) | set(BOSS.values()))
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

STAGES_USED = ['desert', 'namek', 'zoon', 'time', 'space', 'tdp', 'hell', 'kame']     # mapas del 3D -> escenario (ver Backdrop en js/zl3.js)

def stages():
    out = os.path.join(ROOT, 'assets', 'zl3', 's'); os.makedirs(out, exist_ok=True)
    Z.OUT = os.path.join(ROOT, 'assets', 'zl3')
    tot = 0
    for st in Z.build_stages():
        if st['id'] in STAGES_USED: tot += st['bytes']
        else: os.remove(os.path.join(out, st['id'] + '.webp'))
    print('escenarios', tot // 1024, 'KB')

VOICE = re.compile(r'^v[a-z]{2,5}\d{3}$')       # voz del personaje (vgkn209...), sin las de «versus» (vgkn400_vs_...) ni efectos

def voices():
    """Un grito por luchador y momento: ult (su ultimate), tf (transformación) e intro (al aparecer). Devuelve {id: [tipos]}"""
    char_types = {}
    for src, cid, name, cuts, shop in Z.FIGHTERS:
        if cid not in USED: continue
        for i, t, k in Z.TYPES:
            if k and re.sub(r'_(jogador|inimigo)$', '', k) == src and 'Parado' in Z.anims_of(t): char_types[i] = (cid, Z.anims_of(t))
    snd = Z.sound_map(char_types)
    out, files = {}, {}
    for cid in USED:
        M = snd.get(cid, {})
        def first(pred):
            for an in sorted(M):
                if pred(an):
                    for fr, sn in sorted(M[an]):
                        if VOICE.match(sn): return sn
            return None
        beam = lambda a: re.search(r'(Special|Ultimate).*(Kame|Beam|Flash|Gun|Cannon|Galick|Blast|Ball)', a)
        ult = first(lambda a: a.startswith('Ultimate')) or first(beam) or first(lambda a: a.startswith('Special'))
        tf = first(lambda a: a.startswith('Transformation')) or first(lambda a: a.startswith('Change'))
        intro = first(lambda a: a.startswith('Intro'))
        got = {k: v for k, v in (('ult', ult), ('tf', tf), ('intro', intro)) if v}
        if got: out[cid] = sorted(got); files[cid] = got
    dst = os.path.join(ROOT, 'assets', 'zl3', 'a'); os.makedirs(dst, exist_ok=True)
    tot = 0
    for cid, got in files.items():
        for k, sn in got.items():
            f = os.path.join(dst, '%s_%s.m4a' % (cid, k))
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(WWW, 'media', Z.MEDIA[sn]), '-ac', '1', '-ar', '32000', '-c:a', 'aac', '-b:a', '40k', f], check=True)
            tot += os.path.getsize(f)
    print('voces', sum(len(v) for v in out.values()), 'ficheros', tot // 1024, 'KB')
    return out

PANEL = re.compile(r'Ultimate|Final|Kame|Flash|Galick|Breaker|Bomb|Burst|Assault|Genkidama|Cannon|Beam|Pt3', re.I)

def panels(prev=None):
    """Un panel de cinemática (160x90, pixel art) por luchador para el corte de la Ultimate: assets/zl3/p/<id>.webp"""
    CUT = Z.anims_of(Z.best_type('cutscenes_sprite', None)[1])
    dst = os.path.join(ROOT, 'assets', 'zl3', 'p'); os.makedirs(dst, exist_ok=True)
    ok, tot, ims = [], 0, []
    for src, cid, name, cuts, shop in Z.FIGHTERS:
        if cid not in USED: continue
        C = {n: a for n, a in CUT.items() if any(n == g or n.startswith(g + '_') for g in cuts) and not re.search(r'Background|WinPose|Vitoria', n)}
        cand = [n for n in C if PANEL.search(n) and C[n]['f'][0]['w'] >= 150] or [n for n in C if C[n]['f'][0]['w'] >= 150]
        if not cand: continue
        best = None
        for n in cand:                                         # el fotograma con más detalle y sin fondo liso (no vale uno blanco, negro o de piel)
            fs = C[n]['f']
            for i in range(len(fs) // 3, len(fs)):
                im0 = Z.crop(fs[i]).convert('RGB').quantize(32).convert('RGB'); cnt = im0.getcolors(5000) or []
                tot_px = sum(c for c, _ in cnt) or 1; dom = max((c for c, _ in cnt), default=0) / tot_px
                sc = len(cnt) * (1 - dom) * (1.4 if PANEL.search(n) else 1)
                if dom < 0.4 and (best is None or sc > best[0]): best = (sc, fs[i])
        if not best: continue
        f = best[1]
        im = Z.crop(f).convert('RGBA'); path = os.path.join(dst, cid + '.webp')
        im.save(path, 'WEBP', lossless=True, quality=100, method=6, exact=True)
        tot += os.path.getsize(path); ok.append(cid); ims.append((cid, im))
    print('paneles', len(ok), tot // 1024, 'KB')
    if prev:
        W = 8; Cn = Image.new('RGB', (W * 330, ((len(ims) + W - 1) // W) * 190), (30, 30, 30))
        for k, (cid, im) in enumerate(ims): Cn.paste(im.resize((320, 180), Image.NEAREST), ((k % W) * 330, (k // W) * 190))
        Cn.save(os.path.join(prev, 'paneles.png'))
    return ok

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
    out.append('window.ZL3_MAP = %s;\nwindow.ZL3_BOSS = %s;\n' % (json.dumps(REPLACE, separators=(',', ':')), json.dumps(BOSS, separators=(',', ':'))))
    out.append('window.ZL3_PANEL = %s;\n' % json.dumps(panels(PREV), separators=(',', ':')))
    out.append('window.ZL3_VOICE = %s;\n' % json.dumps(voices(), separators=(',', ':')))
    open(os.path.join(ROOT, 'assets', 'zl3.js'), 'w').write(''.join(out))
    print('TOTAL hojas', tot // 1024, 'KB')
    stages()
