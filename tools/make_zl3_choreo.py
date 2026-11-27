#!/usr/bin/env python3
"""
Lógica de los especiales y contraataques de Z Legends 3, sacada tal cual de las hojas de eventos de Construct 2 del juego
original (data.js), para ejecutarla en nuestro Versus (js/versus/zchoreo.js).
Uso:  python3 tools/make_zl3_choreo.py <apk>/assets/www [--dump cid parte]

En el original cada técnica es un árbol de eventos: «si el sprite del luchador está en la animación X, en el fotograma N,
y su sprite toca al del rival: ponle la animación Dano_Aereo1, quítale 20 de vida, espera 0,5 s y lánzalo hacia arriba…».
Aquí se copian esos árboles (solo los del lado del jugador; el del rival es el mismo cambiando quién es quién) con los
objetos traducidos a papeles:
  A  la caja del atacante (hitbox, con la física)     T  la del rival
  AV el sprite visible del atacante                  TV el del rival
  S  el sprite de la técnica (el del luchador)       Sys, Fn (funciones), y efectos por su nombre (hit_sprite…)
Condición: [quién, función, comportamiento, invertida, parámetros] · acción: [quién, función, comportamiento, parámetros]
Expresiones: ['n', 5] · ['s', 'texto'] · ['op', '+', a, b] · ['x', quién, 'X', args] · ['f', 'choose', args] · ['v', quién, i] · ['g', nombre]

Escribe assets/zl3/m/ch_<cid>.js: window.ZMOVE_CH[cid] = {parte: {f: [inicio de cada fotograma en s], sp: fps, ip: [[x,y]|null],
ev: [árboles que empiezan con «la técnica está en esta parte»], fin: [árboles de «al acabar esta parte»]}}}
"""
import collections, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import make_zl3 as Z
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'assets', 'zl3', 'm')
P = Z.P
RT = []
OPS = {4: '+', 5: '-', 6: '*', 7: '/', 8: '%', 9: '^', 10: '&', 11: 'or', 12: '=', 13: '<>', 14: '<', 15: '<=', 16: '>', 17: '>='}
# Acciones que no cambian nada del combate (o que ya hacemos de otra forma: sonidos, cámara, capas, temporizadores…)
DROP_ACT = re.compile(r'^(Play|PlayByName|Stop|SetVisible|SetLayerScale|StopTimer|StartTimer|MoveToTop|MoveToBottom|SetOpacity|SetScale|Destroy|'
                      r'SetEffectParam|SetLayerVisible|SetLayerOpacity|SetEffectEnabled|ScrollToObject|SetBlendMode|SetTimescale|SetLayerAngle|SetAngle|'
                      r'SetWidth|SetHeight|SetSize|SetMirrored|SetFlipped|SetCollisions|SetColor|SetTowardPosition|RotateClockwise|RotateCounterclockwise|'
                      r'SetLayerBackground|SetLayerParallax|Pin|Unpin|PinAt|SetDefaultColor|StopMusic|SetVolume|SetPlaybackRate|SetSilent)$')


EFX_OWN = {'defesa_effect_sprite'}                                      # efectos cuya lógica sigue en las técnicas (postura de contraataque)
EFX = set()                                                            # objetos de efecto (nombres): sus acciones se conservan (motor de efectos, zchoreo.js)
EFX_DROP = re.compile(r'^(Play|PlayByName|Stop|MoveToTop|MoveToBottom|MoveToLayer|SetLayerScale|SetLayerVisible|SetLayerOpacity|SetLayerAngle|SetEffectParam|'
                      r'SetEffectEnabled|SetBlendMode|SetObjectTimescale|SetCollisions|SetColor|SetText|SetFlipped|StopTimer|Shake)$')


def reftable():
    s = open(os.path.join(Z.WWW, 'c2runtime.js'), encoding='utf-8').read()
    k = 'getObjectRefTable = function () { return ['
    i = s.index(k) + len(k)
    return [x.strip() for x in s[i:s.index('];', i)].split(',')]


def fname(i):
    return RT[i].split('.')[-1] if isinstance(i, int) and 0 <= i < len(RT) else '?'


def main():
    global RT
    RT = reftable()
    ours = {f[0]: f[1] for f in Z.FIGHTERS}
    TY, KEY = {}, {}
    used = set()
    for i, t, k in Z.TYPES:
        if not k: continue
        KEY[i] = k if k not in used else '%s~%d' % (k, i)              # tipos distintos con la misma imagen (la bola de ki del jugador y la del rival...)
        used.add(k)
        src = re.sub(r'_(jogador|inimigo)$', '', k)
        if src in ours: TY[i] = (ours[src], Z.anims_of(t))
    TL = json.load(open(os.path.join(OUT, 'timing.json')))
    FIGHT = set(TY) | {416, 417, 435, 436, 420, 422, -1}
    HUDRE = re.compile(r'(hud|botao|button|barra|icon|texto|text|legenda|cutscene|background|tela|controle|selecao|menu|assist|retrato|face|numero|placar|timer)', re.I)
    def spawned_in(ev, acc):
        if isinstance(ev, list):
            if len(ev) > 6 and ev[0] == 0 and isinstance(ev[6], list):
                for a in ev[6]:
                    if isinstance(a, list) and fname(a[1]) in ('Spawn', 'CreateObject') and len(a) > 5 and a[5] and a[5][0] and a[5][0][0] == 4: acc.add(a[5][0][1])
            for e in ev: spawned_in(e, acc)
    EFXI = set()
    def efx_ok(i): return i not in FIGHT and i in KEY and not HUDRE.search(KEY[i]) and KEY[i] not in ('bordas_da_tela_sprite',)
    # primero los que crean los luchadores; luego, en cadena, los que crean los bloques de esos efectos
    def fighter_blocks(ev, acc):
        if isinstance(ev, list):
            if len(ev) >= 7 and ev[0] == 0 and isinstance(ev[5], list) and any(isinstance(c, list) and c[0] in TY for c in ev[5]): spawned_in(ev, acc); return
            for e in ev: fighter_blocks(e, acc)
    acc = set(); fighter_blocks(P[6], acc); EFXI |= {i for i in acc if efx_ok(i)}
    def efx_blocks(ev, out):
        if isinstance(ev, list):
            if len(ev) >= 7 and ev[0] == 0 and isinstance(ev[5], list) and any(isinstance(c, list) and c[0] in EFXI for c in ev[5]): out.append(ev); return
            if len(ev) >= 7 and ev[0] == 0 and isinstance(ev[7] if len(ev) > 7 else None, list):
                for e in ev[7]: efx_blocks(e, out)
                return
            for e in ev: efx_blocks(e, out)
    for _ in range(4):
        bl = []; efx_blocks(P[6], bl); acc = set(); spawned_in(bl, acc); n0 = len(EFXI); EFXI |= {i for i in acc if efx_ok(i)}
        if len(EFXI) == n0: break
    EFX.update(KEY[i] for i in EFXI)
    WANT = collections.defaultdict(set)                              # partes que usamos: especiales y contraataque
    for cid, tm in TL.items():
        for mv in list(tm.get('S') or []) + [tm.get('K')]:
            if mv:
                for k in 'PHE': WANT[cid].update(q[0] for q in mv.get(k) or [])

    TSIDE = {}
    def who_map(side, cid):
        A, T, AV, TV = (416, 417, 435, 436) if side == 0 else (417, 416, 436, 435)
        def w(i):
            if i == A: return 'A'
            if i == T: return 'T'
            if i == AV: return 'AV'
            if i == TV: return 'TV'
            if i == -1: return 'Sys'
            if i in TY and TY[i][0] == cid: return 'S'
            if i in TY and cid is None: return 'F%d:%s' % (TSIDE.get(i, 1 if i < 38 else 0), TY[i][0])   # el sprite de un luchador concreto y de qué lado (lógica de efectos)
            if i == 420: return 'Fn'
            return KEY.get(i) or ('t%d' % i if isinstance(i, int) else str(i))
        return w

    def nexp(e, w):
        if not isinstance(e, list) or not e: return None
        k = e[0]
        if k in (0, 1): return ['n', e[1]]
        if k == 2: return ['s', e[1]]
        if k == 3: return ['op', '-', ['n', 0], nexp(e[1], w)]
        if k in OPS and len(e) == 3: return ['op', OPS[k], nexp(e[1], w), nexp(e[2], w)]
        if k == 19: return ['f', fname(e[1]), [nexp(a, w) for a in ((e[2] if len(e) > 2 else None) or [])]]
        if k == 20: return ['x', w(e[1]), fname(e[2]), [nexp(a, w) for a in ((e[4] if len(e) > 4 else None) or [])]]
        if k == 21: return ['v', w(e[1]), e[4] if len(e) > 4 else 0]
        if k == 23: return ['g', e[1]]
        return ['?', k]

    def nprm(p, w):
        if not isinstance(p, list) or not p: return None
        k, v = p[0], p[1] if len(p) > 1 else None
        if k in (0, 7, 1): return nexp(v, w)
        if k == 2: return ['s', v[0] if isinstance(v, list) else v]
        if k == 3: return ['n', v]
        if k == 4: return ['o', w(v)]
        if k == 8: return ['n', v]
        if k == 10: return ['n', v]
        if k == 11: return ['g', v]
        if k == 5: return ['s', v[1] if isinstance(v, list) and len(v) > 1 else v]
        return None

    def ncond(c, w):
        prm = c[9] if len(c) > 9 and c[9] else []
        return [w(c[0]), fname(c[1]), c[2] or '', 1 if c[5] else 0, [nprm(p, w) for p in prm]]

    def nact(a, w):
        f = fname(a[1]); prm = a[5] if len(a) > 5 and a[5] else []
        who = w(a[0])
        if who in EFX:                                                 # un efecto: casi todo cuenta (se mueve, cambia, se destruye, crea otros...)
            if EFX_DROP.match(f) or (a[2] == 'Timer' and f != 'StartTimer'): return None
            return [who, f, a[2] or '', [nprm(p, w) for p in prm]]
        if DROP_ACT.match(f) and not (f == 'Destroy' and who in ('A', 'T')): return None
        if who in ('Cam', 'camera') and f != 'Shake': return None
        if a[2] == 'Timer': return None
        if f == 'Spawn':                                               # efectos y poderes que nacen en alguien (se siguen: a veces son el «golpe»)
            if not prm: return None
        if f == 'SetAnim' and who not in ('S', 'TV', 'AV'): return [who, f, '', [nprm(prm[0], w)] if prm else []]   # la animación de un efecto (a veces se pregunta por ella)
        if who == 'Sys':
            if f == 'CreateObject': return ['Sys', 'CreateObject', '', [nprm(p, w) for p in prm]]   # un poder aparte (ki, rayo…) en (x, y)
            if f != 'Wait': return None
        elif who not in ('A', 'T', 'AV', 'TV', 'S', 'Fn', 'camera') and not re.match(r'F[01]:', who) and f not in ('Spawn', 'SetAnim'): return None   # otros objetos (asistentes, efectos…)
        if who == 'Fn':
            n = prm[0][1][1] if prm and isinstance(prm[0][1], list) and prm[0][1] and prm[0][1][0] == 2 else ''
            if not n or re.search(r'Vozes|Narrador|NARRADOR|Som |Musica|Música|HUD|Contador', n): return None   # voces, sonidos, HUD
            return ['Fn', 'CallFunction', '', [['s', n]]]                # (las funciones del original con bloques «OnFunction» se ejecutan)
        return [who, f, a[2] or '', [nprm(p, w) for p in prm]]

    def keepc(c, w):
        f = fname(c[1])
        if f == 'IsGroupActive': return False
        if f == 'CompareVar' and c[9] and c[9][0][1] in ('Jogador', 'Inimigo'): return KEEPJ[0]   # qué personaje es: ya lo sabemos (salvo en la lógica de efectos)
        return True

    KEEPJ = [False]
    def isx(c, w): return not KEEPJ[0] and any(w(x[0]) in EFX and w(x[0]) not in EFX_OWN for x in c if isinstance(x, list))
    def ntree0(ev, w):
        c = [ncond(x, w) for x in list(ev[5] or []) if isinstance(x, list) and keepc(x, w)]
        a = [x for x in (nact(y, w) for y in ev[6] or [] if isinstance(y, list)) if x]
        s = [x for x in (ntree(e, w) for e in (ev[7] if len(ev) > 7 and isinstance(ev[7], list) else [])) if x]
        if not a and not s: return None
        o = {'c': c}
        if isx(ev[5] or [], w): o['x'] = 1                             # pregunta por un efecto: lo ejecuta el motor de efectos (fxl.js)
        if ev[2]: o['or'] = 1                                         # bloque O: basta con una condición
        if a: o['a'] = a
        if s: o['s'] = s
        return o
    def ntree(ev, w, anc=()):
        """Árbol de un bloque con sus padres (anc: niveles (condiciones, es_O) de fuera a dentro)"""
        if not isinstance(ev, list) or len(ev) < 7 or ev[0] != 0: return None
        t = ntree0(ev, w)
        if not t: return None
        for conds, isor in reversed(anc):
            raw = [x for x in conds if isinstance(x, list)]
            cs = [ncond(x, w) for x in raw if keepc(x, w)]
            if not cs: continue
            if isor: t = {'c': cs, 'or': 1, 's': [t]}
            elif not t.get('or'): t = dict(t, c=cs + t['c'])            # padre Y: sus condiciones van delante
            else: t = {'c': cs, 's': [t]}
            if isx(raw, w): t['x'] = 1
        return t

    def side_of(ev):
        s = json.dumps(ev)
        a, b = '"BLOQUEAR_CONTROLES"' in s, '"BLOQUEAR_CONTROLES_INIMIGO"' in s
        if a != b: return 0 if a else 1
        for x in ev[6] or []:
            if isinstance(x, list) and x[0] in (416, 417) and x[2] == 'Platform' and fname(x[1]) == 'SetEnabled':
                return 0 if x[0] == 416 else 1
        return None

    # 1) bloques raíz «la técnica está en la parte X» (o «al acabar la parte X»), de cualquier nivel
    roots = []                                                         # (cid, parte, fin, tipo de sprite, bloque, lado, condiciones de los padres)
    DR = []                                                            # Dragon Rush: lo programa la familia de sprites (igual para todos)
    def walk(ev, anc=()):
        if not isinstance(ev, list): return
        if len(ev) >= 7 and ev[0] == 0 and isinstance(ev[5], list):
            for cd in ev[5]:
                if isinstance(cd, list) and cd[0] == 435 and not cd[5] and fname(cd[1]) in ('IsAnimPlaying', 'OnAnimFinished'):
                    prm = cd[9] if len(cd) > 9 and cd[9] else []
                    n = prm[0][1][1] if prm and isinstance(prm[0][1], list) and prm[0][1] and prm[0][1][0] == 2 else None
                    if n and n.startswith('Dragon_Rush'):
                        DR.append((n, fname(cd[1]) == 'OnAnimFinished', ev, anc)); return
                if not isinstance(cd, list) or cd[0] not in TY or cd[5]: continue
                f = fname(cd[1])
                if f not in ('IsAnimPlaying', 'OnAnimFinished'): continue
                prm = cd[9] if len(cd) > 9 and cd[9] else []
                n = prm[0][1][1] if prm and isinstance(prm[0][1], list) and prm[0][1] and prm[0][1][0] == 2 else None
                cid = TY[cd[0]][0]
                if n and n in WANT.get(cid, ()):
                    roots.append((cid, n, f == 'OnAnimFinished', cd[0], ev, side_of(ev), anc))
                    return
            sub = tuple(anc) + ((tuple(x for x in ev[5] if isinstance(x, list)), bool(ev[2])),)   # con los padres O también
            for e in (ev[7] if len(ev) > 7 and isinstance(ev[7], list) else []): walk(e, sub)
            return
        for e in ev: walk(e, anc)
    for sh in P[6]: walk(sh)
    # lado de cada tipo de sprite (uno es el del jugador y otro el del rival), por mayoría
    vote = collections.defaultdict(collections.Counter)
    for cid, n, fin, ti, ev, sd, anc in roots:
        if sd is not None: vote[ti][sd] += 1
    TSIDE.update({ti: c.most_common(1)[0][0] for ti, c in vote.items()})
    out = collections.defaultdict(dict)
    TYc = {}
    for i, (cid, A) in TY.items():
        if 'Parado' in A and (cid not in TYc or len(A) > len(TYc[cid])): TYc[cid] = A
    have = collections.defaultdict(lambda: collections.defaultdict(lambda: [[], []]))
    for cid, n, fin, ti, ev, sd, anc in roots:
        side = sd if sd is not None else TSIDE.get(ti)
        if side is None:                                                # por las condiciones de los padres (¿a quién toca el poder?)
            sa = json.dumps(anc)
            side = 0 if ', [[4, 417]]' in sa else 1 if ', [[4, 416]]' in sa else None
        if side is None: continue
        w = who_map(side, cid)
        t = ntree(ev, w, anc)
        if not t: continue
        # «proj»: lo dispara un poder aparte (un rayo, una esfera…) al tocar al rival: en nuestro Versus, cuando acierta su golpe genérico
        if any(fname(c[1]) in ('IsOverlapping', 'OnCollision') and w(c[0]) not in ('A', 'T', 'AV', 'TV', 'S') and json.dumps(c[9] if len(c) > 9 else []) in ('[[4, %d]]' % (417 if side == 0 else 416), '[[4, %d]]' % (436 if side == 0 else 435)) for lv in anc for c in lv[0] if isinstance(c, list)):
            t['p'] = 1
        have[(cid, n)][side][1 if fin else 0].append(t)
    for (cid, n), sides in have.items():
        ev, fin = sides[0] if (sides[0][0] or sides[0][1]) else sides[1]
        A = TYc.get(cid) or {}; a = A.get(n)
        if not a: continue
        sp = a['speed'] or 12; t = 0; fs = []
        for f in a['f']: fs.append(round(t, 4)); t += (f['d'] or 1) / sp
        ip = []
        for f in a['f']:
            pts = [q for q in (f['pts'] or []) if isinstance(q, list) and len(q) >= 3]
            ip.append([[round((q[1] - f['hx']) * f['w'], 1), round((q[2] - f['hy']) * f['h'], 1)] for q in pts] or None)
        e = {'f': fs, 'sp': sp, 'd': round(t * a.get('rep', 1), 4), 'ip': ip, 'sd': 0 if (sides[0][0] or sides[0][1]) else 1}   # sd: lado del original del que sale (0 jugador, 1 rival)
        if a.get('rep', 1) > 1: e['rp'] = a['rep']; e['cy'] = round(t, 4)   # se repite rp veces: los fotogramas, cada cy segundos
        if ev: e['ev'] = ev
        if fin: e['fin'] = fin
        out[cid][n] = e
    for cid, A in TYc.items():
        for n in ('Dragon_Rush_Pt1', 'Dragon_Rush_Pt2', 'Dragon_Rush_Pt3', 'Dragon_Rush_Pt4'):
            a = A.get(n)
            if not a: continue
            sp = a['speed'] or 12; t = 0; fs = []
            for f in a['f']: fs.append(round(t, 4)); t += (f['d'] or 1) / sp
            ip = [[[round((q[1] - f['hx']) * f['w'], 1), round((q[2] - f['hy']) * f['h'], 1)] for q in (f['pts'] or []) if isinstance(q, list) and len(q) >= 3] or None for f in a['f']]
            out[cid][n] = {'f': fs, 'sp': sp, 'd': round(t, 4), 'ip': ip}
    DRT, seenD = {}, set()
    w0 = who_map(0, None)
    for n, fin, ev, anc in DR:
        t = ntree(ev, w0, anc)
        k = json.dumps(t)
        if not t or k in seenD: continue
        seenD.add(k); DRT.setdefault(n, {'ev': [], 'fin': []})['fin' if fin else 'ev'].append(t)
    if '--dump' in sys.argv:
        k = sys.argv[sys.argv.index('--dump') + 1:]
        e = out.get(k[0], {}).get(k[1]) if len(k) > 1 else None
        if e: print(json.dumps(e, indent=1)[:20000])
        else: print(sorted(out.get(k[0], {})))
        names = collections.Counter()
        def cnt(t):
            for c in t['c']: names['C ' + c[0] + '.' + c[1]] += 1
            for x in t.get('a', []): names['A ' + x[0] + '.' + x[1]] += 1
            for s in t.get('s', []): cnt(s)
        for cid in out:
            for e in out[cid].values():
                for t in e.get('ev', []) + e.get('fin', []): cnt(t)
        print('\n'.join('%5d %s' % (v, k) for k, v in names.most_common(120)))
        return
    tot = 0
    for cid, e in out.items():                                         # un fichero por luchador: se carga con su paquete (ZMoves.load)
        s = '(window.ZMOVE_CH = window.ZMOVE_CH || {})[%s] = %s;\n' % (json.dumps(cid), json.dumps(e, separators=(',', ':')))
        open(os.path.join(OUT, 'ch_%s.js' % cid), 'w').write(s); tot += len(s)
    # Tipos de lanzamiento: el rival tiene variables (47..51) que, al ponerlas a n, disparan un bloque que lo lanza de una
    # forma concreta (salto de 800, vector -1000 hacia arriba, hacia un lado contra la pared…). Se copian también.
    G, seenG = [], set()
    w0 = who_map(0, None)
    def walkg(ev):
        if not isinstance(ev, list): return
        if len(ev) >= 7 and ev[0] == 0 and isinstance(ev[5], list):
            for cd in ev[5]:
                if isinstance(cd, list) and cd[0] == 417 and fname(cd[1]) == 'CompareInstanceVar' and not cd[5]:
                    prm = cd[9] if len(cd) > 9 and cd[9] else []
                    if prm and prm[0][0] == 10 and 47 <= prm[0][1] <= 51 and len(prm) > 2 and prm[1][1] == 0:
                        t = ntree(ev, w0)
                        if t and any(c[0] not in ('A', 'T', 'AV', 'TV', 'Sys', 'S') for c in t['c']): return   # dependen del HUD, asistentes…
                        k = json.dumps(t)
                        if t and k not in seenG: seenG.add(k); G.append(t)
                        return
            for e in (ev[7] if len(ev) > 7 and isinstance(ev[7], list) else []): walkg(e)
            return
        for e in ev: walkg(e)
    for sh in P[6]: walkg(sh)
    open(os.path.join(OUT, 'ch_list.js'), 'w').write('window.ZMOVE_CHL = %s;\nwindow.ZMOVE_CHG = %s;\nwindow.ZMOVE_DR = %s;\n' % (json.dumps(sorted(out)), json.dumps(G, separators=(',', ':')), json.dumps(DRT, separators=(',', ':'))))
    fx_logic(EFXI, KEY, TY, ntree, who_map, KEEPJ)
    print('dragon rush', {k: (len(v['ev']), len(v['fin'])) for k, v in DRT.items()})
    print('tipos de lanzamiento', len(G))
    print('lógica de', sum(len(v) for v in out.values()), 'partes ·', len(out), 'luchadores ·', tot // 1024, 'KB')


def fx_logic(EFXI, KEY, TY, ntree, who_map, KEEPJ):
    """
    Lógica general de los efectos (assets/zl3/m/fxl.js, window.ZFXL): los bloques de las hojas de eventos que preguntan por un
    objeto de efecto (con las condiciones de sus padres), y de cada objeto lo que hace falta para simularlo sin dibujarlo:
    animaciones (fps, bucle, duración, caja y puntos de imagen de cada fotograma), comportamientos con sus propiedades,
    variables y escala con las que nace. Y el número de personaje de cada luchador (gvar Jogador / Inimigo)
    """
    w0 = who_map(0, None)
    KEEPJ[0] = True
    ev_out, seen = [], set()
    def walk(ev, anc=()):
        if not isinstance(ev, list): return
        if len(ev) >= 7 and ev[0] == 0 and isinstance(ev[5], list):
            if any(isinstance(c, list) and c[0] in EFXI and not c[5] for c in ev[5]) or any(isinstance(c, list) and c[0] in EFXI for c in ev[5]):
                t = ntree(ev, w0, anc)
                if t:
                    k = json.dumps(t, separators=(',', ':'))
                    if k not in seen: seen.add(k); ev_out.append(t)
                return
            # Bloques de un luchador fuera de sus técnicas que crean efectos («si Kid Buu ya no está en Pt4 y su variable 33 > 0:
            # crea los disparos que caen»): también van (las partes de las técnicas, «está en la animación X», ya van en ch_*.js)
            allc = [x for lv in anc for x in lv[0]] + [x for x in ev[5] if isinstance(x, list)]
            if any(isinstance(c, list) and c[0] in TY for c in ev[5]) and not any(isinstance(x, list) and x[0] in TY and not x[5] and fname(x[1]) in ('IsAnimPlaying', 'OnAnimFinished', 'OnAnyAnimFinished', 'OnFrameChanged') for x in allc):
                def mk(e):
                    if not isinstance(e, list): return False
                    if len(e) > 6 and e[0] == 0 and isinstance(e[6], list) and any(isinstance(y, list) and fname(y[1]) in ('Spawn', 'CreateObject') and len(y) > 5 and y[5] and y[5][0] and y[5][0][0] == 4 and y[5][0][1] in EFXI for y in e[6]): return True
                    return any(mk(y) for y in (e[7] if len(e) > 7 and isinstance(e[7], list) else []))
                if mk(ev):
                    t = ntree(ev, w0, anc)
                    if t:
                        k = json.dumps(t, separators=(',', ':'))
                        if k not in seen: seen.add(k); ev_out.append(t); EXTRA[0] += 1
                    return
            sub = tuple(anc) + ((tuple(x for x in ev[5] if isinstance(x, list)), bool(ev[2])),)   # con los padres O también
            for e in (ev[7] if len(ev) > 7 and isinstance(ev[7], list) else []): walk(e, sub)
            return
        for e in ev: walk(e, anc)
    EXTRA = [0]
    for sh in P[6]: walk(sh)
    print('bloques de luchador que crean efectos:', EXTRA[0])
    # Funciones del original que se llaman desde lo exportado («Broly DBS Meteor Shower 2»...): sus bloques «OnFunction» van también
    # (se ejecutan al llamarlas). Las que ya hace el Versus a su manera (pausar, parar el golpe, reiniciar variables...) no
    import glob
    FSKIP = re.compile(r'PAUSAR|Hit_Stop|RESETAR|Parar Todas|CARREGAR|SALVAR|TIMERS|Vozes|NARRADOR|Ocultar|Mostar|Mostrar|ASSISTENCIA|ASSITENCIA|Assistencia')
    def called():
        txt = ''.join(open(f, encoding='utf-8').read() for f in glob.glob(os.path.join(OUT, 'ch_*.js'))) + json.dumps(ev_out)
        return {n for n in re.findall(r'"CallFunction","",\[\["s","([^"]+)"', txt) if not FSKIP.search(n)}
    def fwalk(ev, names, anc=()):
        if not isinstance(ev, list): return
        if len(ev) >= 7 and ev[0] == 0 and isinstance(ev[5], list):
            for c in ev[5]:
                if isinstance(c, list) and fname(c[1]) == 'OnFunction' and len(c) > 9 and c[9] and isinstance(c[9][0][1], list) and c[9][0][1][1] in names:
                    allc = [x for lv in anc for x in lv[0]] + list(ev[5])
                    def fz(e):                                         # ¿algún subevento pregunta por la animación de un luchador? ya va en su técnica (ch_*.js)
                        if not (isinstance(e, list) and len(e) >= 7 and e[0] == 0): return False
                        if any(isinstance(x, list) and x[0] in TY and not x[5] and fname(x[1]) in ('IsAnimPlaying', 'OnAnimFinished') for x in (e[5] or [])): return True
                        return any(fz(y) for y in (e[7] if len(e) > 7 and isinstance(e[7], list) else []))
                    if any(isinstance(x, list) and x[0] in TY and not x[5] and fname(x[1]) in ('IsAnimPlaying', 'OnAnimFinished') for x in allc) or fz(ev): return
                    t = ntree(ev, w0, anc)
                    if t:
                        k = json.dumps(t, separators=(',', ':'))
                        if k not in seen: seen.add(k); ev_out.append(t)
                    return
            sub = tuple(anc) + ((tuple(x for x in ev[5] if isinstance(x, list)), bool(ev[2])),)
            for e in (ev[7] if len(ev) > 7 and isinstance(ev[7], list) else []): fwalk(e, names, sub)
            return
        for e in ev: fwalk(e, names, anc)
    done = set()
    for _ in range(4):
        names = called() - done
        if not names: break
        done |= names
        for sh in P[6]: fwalk(sh, names)
    KEEPJ[0] = False
    # primera instancia de cada efecto en los niveles: variables, comportamientos, animación y tamaño con que nace
    first = {}
    def inst(x):
        if isinstance(x, list):
            if len(x) >= 6 and isinstance(x[0], list) and len(x[0]) >= 10 and isinstance(x[1], int):
                if x[1] in EFXI and x[1] not in first: first[x[1]] = x
                return
            for e in x: inst(e)
    for L in P[5]: inst(L)
    ty = {}
    for i in sorted(EFXI):
        t = Z.T[i]; A = Z.anims_of(t); nm = KEY[i]
        if not A or nm in ty: continue
        x = first.get(i)
        beh = [b[0] for b in (t[8] if len(t) > 8 and t[8] else [])]
        props = (x[4] if x and len(x) > 4 and isinstance(x[4], list) else [])
        a0 = x[5][1] if x and len(x) > 5 and isinstance(x[5], list) and len(x[5]) > 1 and x[5][1] in A else next(iter(A))
        f0 = A[a0]['f'][0] if A[a0]['f'] else None
        sc = round(x[0][3] / f0['w'], 3) if x and f0 and f0['w'] else 1
        an = {}
        for n, a in A.items():
            fr = []
            for f in a['f']:
                pts = [q for q in (f['pts'] or []) if isinstance(q, list) and len(q) >= 3]
                F = [f['d'] or 1, f['w'], f['h'], round(f['hx'] * f['w'], 1), round(f['hy'] * f['h'], 1), [[round((q[1] - f['hx']) * f['w'], 1), round((q[2] - f['hy']) * f['h'], 1)] for q in pts] if pts else 0]
                pl = f.get('poly')
                if isinstance(pl, list) and len(pl) >= 6:              # caja de su polígono de colisión (desde el punto de apoyo, en px)
                    xs, ys = [v * f['w'] for v in pl[0::2]], [v * f['h'] for v in pl[1::2]]
                    F.append([round(min(xs), 1), round(min(ys), 1), round(max(xs), 1), round(max(ys), 1)])
                elif not pts: F.pop()
                fr.append(F)
            an[n] = [a['speed'] or 0, 1 if a['loop'] else 0, a['repto'] or 0, fr] + ([a['rep']] if a.get('rep', 1) > 1 else [])
        ty[nm] = {'b': {b: (props[k] if k < len(props) else []) for k, b in enumerate(beh)}, 'v': [v[0] if isinstance(v, list) and v else 0 for v in (x[3] if x and len(x) > 3 and isinstance(x[3], list) else [])],
                  'a0': a0, 'sc': sc, 'vis': 1 if not x or not isinstance(x[5], list) or x[5][0] in (0, None) else 0, 'an': an}
    # número de personaje: «si Jogador = n, crea el sprite de tal luchador» (los empates se resuelven por descarte)
    cand = collections.defaultdict(set)
    def jug(ev):
        if isinstance(ev, list):
            if len(ev) >= 7 and ev[0] == 0 and isinstance(ev[5], list):
                for c in ev[5]:
                    if isinstance(c, list) and fname(c[1]) == 'CompareVar' and len(c) > 9 and c[9] and c[9][0][1] == 'Jogador' and c[9][1][1] == 0:
                        v = c[9][2][1]; num = v[1] if isinstance(v, list) and len(v) > 1 else None
                        for a in ev[6] or []:
                            if isinstance(a, list) and fname(a[1]) in ('Spawn', 'CreateObject') and len(a) > 5 and a[5] and a[5][0][0] == 4 and a[5][0][1] in TY and isinstance(num, (int, float)):
                                cand[int(num)].add(TY[a[5][0][1]][0]); break
            for e in ev: jug(e)
    jug(P[6])
    ix = {}
    for _ in range(5):
        for n, cs in cand.items():
            left = [c for c in cs if c not in ix]
            if len(left) == 1 and n not in ix.values(): ix[left[0]] = n
    s = 'window.ZFXL = %s;\n' % json.dumps({'ev': ev_out, 'ty': ty, 'ix': ix}, separators=(',', ':'))
    open(os.path.join(OUT, 'fxl.js'), 'w').write(s)
    print('lógica de efectos:', len(ev_out), 'bloques ·', len(ty), 'objetos ·', len(ix), 'personajes ·', len(s) // 1024, 'KB')


if __name__ == '__main__':
    main()
