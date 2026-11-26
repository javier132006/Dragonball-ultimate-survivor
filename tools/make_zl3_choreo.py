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
    for i, t, k in Z.TYPES:
        if k: KEY[i] = k
        if not k: continue
        src = re.sub(r'_(jogador|inimigo)$', '', k)
        if src in ours: TY[i] = (ours[src], Z.anims_of(t))
    TL = json.load(open(os.path.join(OUT, 'timing.json')))
    WANT = collections.defaultdict(set)                              # partes que usamos: especiales y contraataque
    for cid, tm in TL.items():
        for mv in list(tm.get('S') or []) + [tm.get('K')]:
            if mv:
                for k in 'PHE': WANT[cid].update(q[0] for q in mv.get(k) or [])

    def who_map(side, cid):
        A, T, AV, TV = (416, 417, 435, 436) if side == 0 else (417, 416, 436, 435)
        def w(i):
            if i == A: return 'A'
            if i == T: return 'T'
            if i == AV: return 'AV'
            if i == TV: return 'TV'
            if i == -1: return 'Sys'
            if i in TY and TY[i][0] == cid: return 'S'
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
        if DROP_ACT.match(f) and not (f == 'Destroy' and who in ('A', 'T')): return None
        if who in ('Cam', 'camera') and f != 'Shake': return None
        if a[2] == 'Timer': return None
        if f == 'Spawn':                                               # efectos y poderes que nacen en alguien (se siguen: a veces son el «golpe»)
            if not prm: return None
        if f == 'SetAnim' and who not in ('S', 'TV', 'AV'): return [who, f, '', [nprm(prm[0], w)] if prm else []]   # la animación de un efecto (a veces se pregunta por ella)
        if who == 'Sys':
            if f == 'CreateObject': return ['Sys', 'CreateObject', '', [nprm(p, w) for p in prm]]   # un poder aparte (ki, rayo…) en (x, y)
            if f != 'Wait': return None
        elif who not in ('A', 'T', 'AV', 'TV', 'S', 'Fn', 'camera') and f not in ('Spawn', 'SetAnim'): return None   # otros objetos (asistentes, efectos…)
        if who == 'Fn':
            n = prm[0][1][1] if prm and isinstance(prm[0][1], list) and prm[0][1] and prm[0][1][0] == 2 else ''
            if not re.search(r'PAUSAR|Hit_Stop|Dano', n): return None
            return ['Fn', 'CallFunction', '', [['s', n]]]
        return [who, f, a[2] or '', [nprm(p, w) for p in prm]]

    def keepc(c, w):
        f = fname(c[1])
        if f == 'IsGroupActive': return False
        if f == 'CompareVar' and c[9] and c[9][0][1] in ('Jogador', 'Inimigo'): return False   # qué personaje es: ya lo sabemos
        return True

    def ntree(ev, w, anc=()):
        if not isinstance(ev, list) or len(ev) < 7 or ev[0] != 0: return None
        if anc and ev[2]:                                              # bloque O con padres: los padres van aparte (Y), el O dentro
            t = ntree(ev, w)
            return {'c': [ncond(x, w) for x in anc if isinstance(x, list) and keepc(x, w)], 's': [t]} if t else None
        c = [ncond(x, w) for x in list(anc) + list(ev[5] or []) if isinstance(x, list) and keepc(x, w)]
        a = [x for x in (nact(y, w) for y in ev[6] or [] if isinstance(y, list)) if x]
        s = [x for x in (ntree(e, w) for e in (ev[7] if len(ev) > 7 and isinstance(ev[7], list) else [])) if x]
        if not a and not s: return None
        o = {'c': c}
        if ev[2]: o['or'] = 1                                         # bloque O: basta con una condición
        if a: o['a'] = a
        if s: o['s'] = s
        return o

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
    def walk(ev, anc=()):
        if not isinstance(ev, list): return
        if len(ev) >= 7 and ev[0] == 0 and isinstance(ev[5], list):
            for cd in ev[5]:
                if not isinstance(cd, list) or cd[0] not in TY or cd[5]: continue
                f = fname(cd[1])
                if f not in ('IsAnimPlaying', 'OnAnimFinished'): continue
                prm = cd[9] if len(cd) > 9 and cd[9] else []
                n = prm[0][1][1] if prm and isinstance(prm[0][1], list) and prm[0][1] and prm[0][1][0] == 2 else None
                cid = TY[cd[0]][0]
                if n and n in WANT.get(cid, ()):
                    roots.append((cid, n, f == 'OnAnimFinished', cd[0], ev, side_of(ev), anc))
                    return
            sub = tuple(anc) + tuple(x for x in ev[5] if isinstance(x, list)) if not ev[2] else tuple(anc)
            for e in (ev[7] if len(ev) > 7 and isinstance(ev[7], list) else []): walk(e, sub)
            return
        for e in ev: walk(e, anc)
    for sh in P[6]: walk(sh)
    # lado de cada tipo de sprite (uno es el del jugador y otro el del rival), por mayoría
    vote = collections.defaultdict(collections.Counter)
    for cid, n, fin, ti, ev, sd, anc in roots:
        if sd is not None: vote[ti][sd] += 1
    TSIDE = {ti: c.most_common(1)[0][0] for ti, c in vote.items()}
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
        if any(fname(c[1]) in ('IsOverlapping', 'OnCollision') and w(c[0]) not in ('A', 'T', 'AV', 'TV', 'S') and json.dumps(c[9] if len(c) > 9 else []) in ('[[4, %d]]' % (417 if side == 0 else 416), '[[4, %d]]' % (436 if side == 0 else 435)) for c in anc if isinstance(c, list)):
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
            pts = f['pts'] or []
            ip.append([round((pts[0][1] - f['hx']) * f['w'], 1), round((pts[0][2] - f['hy']) * f['h'], 1)] if pts and len(pts[0]) >= 3 else None)
        e = {'f': fs, 'sp': sp, 'd': round(t, 4), 'ip': ip}
        if ev: e['ev'] = ev
        if fin: e['fin'] = fin
        out[cid][n] = e
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
    open(os.path.join(OUT, 'ch_list.js'), 'w').write('window.ZMOVE_CHL = %s;\nwindow.ZMOVE_CHG = %s;\n' % (json.dumps(sorted(out)), json.dumps(G, separators=(',', ':'))))
    print('tipos de lanzamiento', len(G))
    print('lógica de', sum(len(v) for v in out.values()), 'partes ·', len(out), 'luchadores ·', tot // 1024, 'KB')


if __name__ == '__main__':
    main()
