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
KEEP = re.compile(r'^(Special|Ultimate|Ultimatel|UltimateAttack|UltimateSsj|Transformation|Sparking|Intro|DramaticIntro|Vitoria|Pose_De_Vitoria)')
SKIP = re.compile(r'(_Ar(_|$)|Aereo|Agachado|agachado|_Cima|_Baixo|_Ar_|_leve$|_Leve)')
# Efectos sueltos compartidos: tipo de objeto -> animaciones (None = todas)
FX = {'esferadekigigante_sprite': None, 'genkidamaefeito_sprite': None, 'explosion_specialball_effect': None,
      'explosaodeki_effect_sprite': None, 'efeitobranconatela_sprite': None,
      'freeza_efeitos_sprite': ['DeathBall_Loop', 'DeathBall_Explosion'], 'bills_effects': ['Beerus_Ball', 'Hakai_Destruction_Effect'],
      'vegetaego_effects': ['Hakai_Loop', 'Hakai_Desaparecer'], 'kidbuu_e_cell_effects': ['Planet_Buster_Ball', 'Planet_Buster_Explosion_Final'],
      'android17_effects': ['SuperElectricStrike_NãoEspelhado_Effect', 'SuperElectricStrike_NãoEspelhado_Destroy_Effect'],
      'lightinggranade_sprite': None, 'explosao_sprite': ['Explosao4', 'Explosao8', 'Explosao10', 'Explosao11', 'Explosao15'],
      'moro73_lavaball_sprite': ['Explodindo']}

# Ultimate del Versus de cada luchador (id del juego): técnica (prefijo de sus partes, o lista de partes), tipo y efectos.
#   beam: lo que lanza va dibujado en el sprite; alcanza si el rival está dentro de lo que mide el sprite al soltarla
#   rush: en la parte en bucle se lanza contra el rival; si lo toca, lo atrapa (si tarda demasiado, falla)
#   warp: aparece junto al rival y lo atrapa · area: estalla a su alrededor · proj: lanza el efecto `p`, que explota con `x`
#   (H: parte «acertó», E: parte «falló» si las tiene; las ramas se buscan solas: <técnica>_Acertou… / _Errou…)
ULTS = {
    'goku': (['Special_EveryoneLendMeYourEnergy', 'Ultimate_SuperSpiritBomb'], 'proj', {'p': 'esferadekigigante:Goku', 'x': 'explosao:Explosao15', 'orb': 1, 'hold': 1.3, 'rel': [1, 0.25]}),
    'gokussj': ('Ultimate_MeteorSmash', 'beam', {'d': [0, 0.25], 'f': [0, 1]}), 'gokublue': ('Ultimate_GalickKamehameha', 'rush', {'f': [4, 9]}),
    'gokuui': ('UltimateAttack2', 'rush', {'f': [2, 5]}), 'vegeta': ('UltimateAttack_GalaxyBreaker', 'area', {'x': 'explosao:Explosao15'}),
    'vegetassj': ('Special_FinalFlash', 'beam', None), 'vegetaego': ('Ultimate_HakaiGiganticBall', 'proj', {'p': 'vegetaego:Hakai_Loop', 'x': 'vegetaego:Hakai_Desaparecer'}),
    'gohanssj2': ('UltimateAttack_FatherSonKamehameha', 'beam', None), 'gohanbeast': ('Ultimate_UltraMakankoSappo', 'beam', None),
    'miraigohan': ('UltimateAttack', 'beam', {'d': [0, 0.15], 'f': [0, 1]}), 'miraitrunks': ('Ultimate_SwordOfHope', 'warp', {'d': [1, 0.0], 'f': [1, 4]}),
    'piccolo': ('Ultimate_LightGrenade', 'proj', {'p': 'lightinggranade:Jogador', 'x': 'lightinggranade:Jogador_Acertou'}), 'cell': ('Ultimate_SolarKamehameha', 'beam', None),
    'freezer': ('Ultimate_DeathBall', 'proj', {'p': 'freeza_efeitos:DeathBall_Loop', 'x': 'freeza_efeitos:DeathBall_Explosion'}),
    'bardock': ('UltimateAttack_RevengeAssault', 'rush', {'f': [2, 4]}), 'bardockssj': ('UltimateAttack_RevengeAssault', 'rush', {'f': [2, 4]}),
    'vegettoblue': ('UltimateAttack_FinalKamehameha', 'beam', None), 'gogetassj4': ('Special_x100BigBangKamehameha', 'beam', None),
    'gogetablue': ('Ultimate_UltimateKamehameha', 'beam', None), 'kefla': ('UltimateAttack_GiganticBurst', 'beam', {'f': [4, 6]}),
    'janemba': ('Ultimate_NeedleLightShower', 'beam', None), 'jiren': ('Ultimate_BlazingMagnetron', 'beam', None),
    'beerus': ('Ultimate_BeerusBallOfDestruction', 'proj', {'p': 'bills:Beerus_Ball', 'x': 'bills:Hakai_Destruction_Effect'}),
    'hit': ('Ultimate_IKeepImproving', 'warp', {'d': [1, 0.0], 'f': [1, 4]}), 'raditz': ('UltimateAttack', 'beam', {'d': [0, 0.1], 'f': [0, 1]}),
    'a17': ('Ultimate_SuperElectricStrike', 'proj', {'p': 'android17:SuperElectricStrike_NãoEspelhado_Effect', 'x': 'android17:SuperElectricStrike_NãoEspelhado_Destroy_Effect'}),
    'a18': ('Ultimate_AccelDance', 'warp', {'d': [1, 0.0], 'f': [1, 5]}), 'black': ('Ultimate_TheWorkOfAGod', 'warp', {'d': [0, 0.3], 'f': [0, 2]}),
    'zamasu': ('Ultimate_LightningOfAbsolution', 'beam', None), 'brolyz': ('UltimateAttack', 'proj', {'p': 'esferadekigigante:Broly_Pt2', 'x': 'explosao:Explosao11'}),
    'brolydbs': ('UltimateAttack', 'beam', None), 'ginyu': ('Ultimate_BodyChange', 'beam', None), 'baby': ('Ultimate_GreatApeAssault', 'beam', None),
    'kidbuu': ('Ultimate_PlanetBurst', 'proj', {'p': 'kidbuu_e_cell:Planet_Buster_Ball', 'x': 'kidbuu_e_cell:Planet_Buster_Explosion_Final'}),
    'nappa': ('Ultimate_BreakCannon', 'beam', None), 'moro': ('UltimateAttack', 'proj', {'p': 'esferadekigigante:Moro73_Ulltimate', 'x': 'moro73_lavaball:Explodindo'}),
}


def fxname(key, n):
    return re.sub(r'(_effects?_sprite|_effects?|_sprite)$', '', key) + ':' + n


def adur(a):
    return round(sum(f['d'] or 1 for f in a['f']) / (a['speed'] or 12), 3)


# Paneles de cinemática (cutscenes_sprite, 160x90): entrada (I), Ultimate (U) y victoria (V) de cada luchador
CUT_I = re.compile(r'_Intro|^GokuUi$|^GogetaFusion$|^Bills_(Pt\d|Final)|^BrolyZ_Pt')
CUT_V = re.compile(r'Vitoria|WinPose')
CUT_SKIP = re.compile(r'Vs[A-Z]|_DF|_DI_|Background|Lava|NoHardFeelings|IHaveNoUse|Blindness|Together|Bojack|AtaqueLight|BarrierExplosion|EnergyWave|StardustFall|Transcedence|'
                      r'AcceleratingBattleSpirit|^VegetaGod$|UltimateImpact|UltBBKame|GokuBlue_Ultimate_(Pt1|Final)$|^Vegeta_FinalFlash')
CUT_AT = {'gogetassj4': 0.5, 'gogetablue': 0.22}      # la fusión: los paneles salen en mitad de la entrada (cuando se tocan los dedos)


def cut_panels(cid, src):
    """Atlas c_<cid>.webp con los paneles y su tabla {I|U|V: [[x, y, w, h, ms]...], at}"""
    CUT = Z.anims_of(Z.best_type('cutscenes_sprite', None)[1])
    cuts = next((f[3] for f in Z.FIGHTERS if f[0] == src), [])
    L = [n for n in CUT if any(n == g or n.startswith(g + '_') for g in cuts)]
    G = {'I': [n for n in L if CUT_I.search(n) and not CUT_V.search(n) and not CUT_SKIP.search(n)],
         'V': [n for n in L if CUT_V.search(n) and not CUT_SKIP.search(n)]}
    G['U'] = [n for n in L if n not in G['I'] and n not in G['V'] and not CUT_SKIP.search(n)]
    ims, rows = [], {}
    for k, names in G.items():
        fr = [(f, CUT[n]) for n in names for f in CUT[n]['f'] if f['w'] >= 100]
        if not fr: continue
        rows[k] = []
        for f, a in fr: rows[k].append([len(ims), int(round(1000 * (f['d'] or 1) / (a['speed'] or 12)))]); ims.append(Z.crop(f))
    if not ims: return None
    atlas, co = Z.pack(ims, 2048)
    atlas.save(os.path.join(OUT, 'c_%s.webp' % cid), 'WEBP', lossless=True, quality=100, method=6, exact=True)
    out = {k: [[co[i][0], co[i][1], ims[i].width, ims[i].height, ms] for i, ms in v] for k, v in rows.items()}
    if cid in CUT_AT: out['at'] = CUT_AT[cid]
    return out


def timing(cid, A):
    """Tabla fija (va en list.js, se carga siempre): la simulación del Versus la usa igual en los dos lados del online"""
    T = {}
    iw = A['Parado']['f'][0]['w']
    if cid in ULTS:
        base, kind, fx = ULTS[cid]
        if isinstance(base, list): main = base; H = E = []
        else:
            esc = re.escape(base)
            main = [n for n in A if re.match(esc + r'(_Pt\d+(_\d+)?|_Final|_Start|_Charge|_Liberar)?$', n)]
            H = [n for n in A if re.match(esc + r'_Acertou', n)]; E = [n for n in A if re.match(esc + r'_Errou', n)]
        main = [n for n in main if n in A]
        # punto de comprobación: el primer fotograma que se ensancha (la energía sale); si tiene rama de acierto, al acabar
        if kind == 'rush' and not any(A[n]['loop'] for n in main): kind = 'warp'   # sin parte en bucle no hay embestida: aparece junto a él
        rel = None
        mw = max(f['w'] for n in main for f in A[n]['f'])
        if kind == 'warp': rel = (fx or {}).get('d') or [0, 0.2]                                         # se lanza contra él en d (el primer golpe decide)
        elif kind != 'rush':                                             # la energía sale: el primer fotograma casi tan ancho como el más ancho
            for pi, n in enumerate(main):
                for k, f in enumerate(A[n]['f']):
                    if rel is None and f['w'] >= max(iw * 1.9, mw * 0.55): rel = [pi, round(sum((g['d'] or 1) for g in A[n]['f'][:k]) / (A[n]['speed'] or 12), 3)]
        if H or rel is None: rel = [len(main) - 1, adur(A[main[-1]])]
        lp = next((i for i, n in enumerate(main) if A[n]['loop'] and i <= rel[0]), -1)
        reach = 0
        for n in main[rel[0]:] + H:
            for f in A[n]['f']: reach = max(reach, f['w'] - f['hx'] * f['w'])
        if fx and fx.get('rel'): rel = fx['rel']
        rel = [rel[0], min(rel[1], max(0, adur(A[main[rel[0]]]) - 0.03))]      # dentro de su parte (si no, la parte acabaría antes)
        PP = [[n, adur(A[n]), 1 if A[n]['loop'] else 0] for n in main]
        if fx and fx.get('hold'): PP[0][1] = round(PP[0][1] + fx['hold'], 3)       # la Genkidama crece: la primera parte se alarga (su último fotograma se queda)
        b = main[-1] if isinstance(base, list) else base
        nm = re.sub(r'^(UltimateAttack|Ultimate|Special)_?', '', b); nm = re.sub(r'_(Pt\d+|Final)$', '', nm)
        nm = re.sub(r'([a-z0-9])([A-Z])', r'\1 \2', re.sub(r'([A-Z])([A-Z][a-z])', r'\1 \2', nm)).replace('_', ' ').strip().upper() or 'ULTIMATE'
        nm = {'SUPER SPIRIT BOMB': 'SUPER GENKIDAMA', '2': 'ULTIMATE', 'ATTACK2': 'ULTIMATE', 'ULTIMATE': 'ULTIMATE', 'X100 BIG BANG KAMEHAMEHA': 'BIG BANG KAMEHAMEHA X100',
              'X10 KAIOKEN KAMEHAMEHA': 'KAMEHAMEHA KAIOKEN X10'}.get(nm, nm)
        if fx and fx.get('n'): nm = fx['n']
        T['U'] = {'n': nm, 'P': PP, 'H': [[n, adur(A[n]), 0] for n in H], 'E': [[n, adur(A[n]), 0] for n in E],
                  'k': kind, 'rel': rel, 'lp': lp, 'R': round(reach), 'fx': fx}
    intro = [n for n in A if re.match(r'^Intro(_Pt\d+|_Final)?$', n)] or [n for n in A if re.match(r'^DramaticIntro(_Pt\d+)?$', n)]
    if intro: T['I'] = [[n, adur(A[n]), 1 if A[n]['loop'] else 0] for n in intro]
    vic = [n for n in A if re.match(r'^Vitoria(_Pt\d+|_Final)?$', n)]
    if vic: T['V'] = [[n, adur(A[n]), 0] for n in vic] + ([['Pose_De_Vitoria', adur(A['Pose_De_Vitoria']), 1]] if 'Pose_De_Vitoria' in A else [])
    return T


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
    TMP = os.path.join(OUT, 'timing.json'); TM = json.load(open(TMP)) if os.path.exists(TMP) and only else {}
    for src in FIGHTERS:
        cid = ours.get(src, src)
        if only and cid not in only and src not in only: continue
        A = Z.anims_of(Z.best_type(src)[1])
        names = [n for n in A if KEEP.match(n) and not SKIP.search(n)]
        TM[cid] = timing(cid, A)
        cp = cut_panels(cid, src)
        if cp: TM[cid]['C'] = cp
        if 'Pose_De_Vitoria' in A and 'Pose_De_Vitoria' not in names: names.append('Pose_De_Vitoria')
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
                    nm = fxname(key, n); A2[nm] = a; names.append(nm)
        s = write('fx', A2, names); total += s
        print('%-18s %3d animaciones · %5d KB' % ('fx', len(names), s // 1024))
    have = sorted(f[:-3] for f in os.listdir(OUT) if f.endswith('.js') and f not in ('fx.js', 'list.js'))
    json.dump(TM, open(TMP, 'w'), ensure_ascii=False)
    open(os.path.join(OUT, 'list.js'), 'w').write('// Generado por tools/make_zl3_moves.py: luchadores con técnicas animadas (js/zmoves.js)\nwindow.ZMOVE_LIST = %s;\n'
        '// Tiempos de la Ultimate (U), la intro (I) y la victoria (V) de cada uno: [parte, segundos, bucle]. La simulación del Versus usa estos números\n'
        'window.ZMOVE_T = %s;\n' % (json.dumps(have), json.dumps(TM, separators=(',', ':'), ensure_ascii=False)))
    print('total', total // 1024, 'KB en', os.path.relpath(OUT, ROOT))


if __name__ == '__main__':
    main()
