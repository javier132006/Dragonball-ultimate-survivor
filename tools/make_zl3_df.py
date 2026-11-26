#!/usr/bin/env python3
"""
Dramatic Finish de Z Legends 3: los guiones de las cinco escenas finales del original (Goku contra Vegeta, Vegetto contra
Zamasu, Gogeta Blue contra Janemba y las dos de Gogeta Blue contra Gogeta SSJ4), sacados de sus hojas de eventos de
Construct 2 para reproducirlos en el Versus (js/versus/zdf.js). Uso:  python3 tools/make_zl3_df.py <apk>/assets/www

Cada escena es un árbol de eventos del original (las animaciones DramaticFinish_* de los dos luchadores, sus posiciones,
la cámara y su zoom, los paneles de cinemática, las voces con sus subtítulos en español, el fogonazo blanco y el K.O.).
Papeles: W / L = cajas del ganador y del perdedor · WS / LS = sus sprites · WV / LV = las familias de sprites visibles ·
CAM cámara · AU audio · CUT panel de cinemática · TXT subtítulo · Sys, Fn y el resto por su nombre.

Escribe assets/zl3/df/df.js (window.ZDF = {n: {w, l, ev, cut: {anim: {f: [[x, y, w, h, ms, ax, ay]], loop}}, snd: {nombre: s}}}),
assets/zl3/df/df<n>.webp (paneles) y los audios assets/zl3/df/<nombre>.m4a
"""
import json, os, re, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import make_zl3 as Z
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'assets', 'zl3', 'df')
P = Z.P
OPS = {4: '+', 5: '-', 6: '*', 7: '/', 8: '%', 9: '^', 10: '&', 11: 'or', 12: '=', 13: '<>', 14: '<', 15: '<=', 16: '>', 17: '>='}
# Escena -> (ganador, perdedor) con sus nombres del original (la condición es «Jogador = n e Inimigo = m» y el perdedor K.O.)
SCENES = {1: ('gogetassj4', 'gogetassjblue'), 2: ('gogetassjblue', 'gogetassj4'), 3: ('gokubase', 'vegetasagasaiyan'),
          4: ('vegettossjblue', 'zamasufusion'), 5: ('gogetassjblue', 'janemba')}
DROP = re.compile(r'^(SetVisible|MoveToTop|MoveToBottom|SetOpacity|SetBlendMode|SetEffectParam|SetEffectEnabled|SetCollisions|StartTimer|StopTimer)$')


def reftable():
    s = open(os.path.join(Z.WWW, 'c2runtime.js'), encoding='utf-8').read()
    k = 'getObjectRefTable = function () { return ['
    i = s.index(k) + len(k)
    return [x.strip() for x in s[i:s.index('];', i)].split(',')]


RT = reftable()
def fname(i): return RT[i].split('.')[-1] if isinstance(i, int) and 0 <= i < len(RT) else '?'


def main():
    os.makedirs(OUT, exist_ok=True)
    ours = {f[0]: f[1] for f in Z.FIGHTERS}
    KEY = {i: k for i, t, k in Z.TYPES if k}
    def types_of(src): return {i for i, t, k in Z.TYPES if k and re.sub(r'_(jogador|inimigo)$', '', k) == src}
    GOG_B, GOG_A = {40, 44}, {25, 32}   # Gogetas: la variante B solo gana, la A solo pierde
    CUTT = Z.best_type('cutscenes_sprite', None)
    CUT = Z.anims_of(CUTT[1]); cut_id = CUTT[0]
    snd_all = set()
    res = {}
    for n, (ws, ls) in SCENES.items():
        WT, LT = types_of(ws), types_of(ls)
        def w(i):
            if i == 416: return 'W'
            if i == 417: return 'L'
            if i == 435: return 'WV'
            if i == 436: return 'LV'
            if i == -1: return 'Sys'
            if i == 420: return 'Fn'
            if i == 422: return 'AU'
            if i in GOG_B and i in LT or i in GOG_A and i in WT: return 'off%d' % i   # esa variante de Gogeta no está en esta escena
            if i in WT: return 'WS'
            if i in LT: return 'LS'
            k = KEY.get(i, '')
            if k == 'cutscenes_sprite' or i == cut_id: return 'CUT'
            if k == 'camera': return 'CAM'
            return k or ('t%d' % i)
        def nexp(e):
            if not isinstance(e, list) or not e: return None
            k = e[0]
            if k in (0, 1): return ['n', e[1]]
            if k == 2: return ['s', e[1]]
            if k == 3: return ['op', '-', ['n', 0], nexp(e[1])]
            if k in OPS and len(e) == 3: return ['op', OPS[k], nexp(e[1]), nexp(e[2])]
            if k == 19: return ['f', fname(e[1]), [nexp(a) for a in ((e[2] if len(e) > 2 else None) or [])]]
            if k == 20: return ['x', w(e[1]), fname(e[2]), [nexp(a) for a in ((e[4] if len(e) > 4 else None) or [])]]
            if k == 21: return ['v', w(e[1]), e[4] if len(e) > 4 else 0]
            if k == 23: return ['g', e[1]]
            return ['?', k]
        def nprm(p):
            if not isinstance(p, list) or not p: return None
            k, v = p[0], p[1] if len(p) > 1 else None
            if k in (0, 7, 1): return nexp(v)
            if k == 2:
                s = v[0] if isinstance(v, list) else v
                if isinstance(s, str): snd_all.add(s.lower())
                return ['s', s]
            if k in (3, 8, 10): return ['n', v]
            if k == 4: return ['o', w(v)]
            if k == 11: return ['g', v]
            if k == 5: return ['s', v[1] if isinstance(v, list) and len(v) > 1 else v]
            return None
        def tree(ev, anc=()):
            if not isinstance(ev, list) or len(ev) < 7 or ev[0] != 0: return None
            if anc and ev[2]:                                          # bloque O con padres: los padres aparte (Y)
                t = tree(ev); a0 = tree([0, None, False, None, 0, list(anc), [], [ev]])
                return a0
            c = []
            for x in list(anc) + list(ev[5] or []):
                if not isinstance(x, list): continue
                f = fname(x[1])
                if f == 'IsGroupActive': continue
                prm = x[9] if len(x) > 9 and x[9] else []
                c.append([w(x[0]), f, x[2] or '', 1 if x[5] else 0, [nprm(p) for p in prm]])
            a = []
            for y in ev[6] or []:
                if not isinstance(y, list) or len(y) < 2: continue
                f = fname(y[1])
                if DROP.match(f): continue
                prm = y[5] if len(y) > 5 and y[5] else []
                a.append([w(y[0]), f, y[2] or '', [nprm(p) for p in prm]])
            s = [t for t in (tree(e) for e in (ev[7] if len(ev) > 7 and isinstance(ev[7], list) else [])) if t]
            if not a and not s: return None
            o = {'c': c}
            if ev[2]: o['or'] = 1
            if a: o['a'] = a
            if s: o['s'] = s
            return o
        trees = []
        key = re.compile(r'"INICIAR_DRAMATIC_FINISH"\], \[8, 0\], \[7, \[0, %d\]\]' % n)
        def walk(ev, anc=()):
            if not isinstance(ev, list): return
            if len(ev) >= 7 and ev[0] == 0 and isinstance(ev[5], list):
                if any(isinstance(c, list) and key.search(json.dumps(c)) for c in ev[5]):
                    t = tree(ev, anc)                                   # con las condiciones de sus padres (que también cuentan)
                    if t: trees.append(t)
                    return
                sub = tuple(anc) + tuple(x for x in ev[5] if isinstance(x, list)) if not ev[2] else tuple(anc)
                for e in (ev[7] if len(ev) > 7 and isinstance(ev[7], list) else []): walk(e, sub)
                return
            for e in ev: walk(e, anc)
        for sh in P[6]: walk(sh)
        js = json.dumps(trees)
        cuts = sorted(set(re.findall(r'\["CUT", "SetAnim", "", \[\["s", "([^"]+)"', js)) | set(re.findall(r'\["CUT", "(?:IsAnimPlaying|OnAnimFinished)", "", 0, \[\["s", "([^"]+)"', js)))
        # Paneles de esta escena: atlas propio
        ims, meta = [], {}
        for cn in cuts:
            a = CUT.get(cn)
            if not a: continue
            sp = a['speed'] or 12
            meta[cn] = {'f': [], 'loop': 1 if a['loop'] else 0, 'sp': sp}
            for f in a['f']:
                meta[cn]['f'].append([len(ims), int(round(1000 * (f['d'] or 1) / sp)), round(f['hx'], 3), round(f['hy'], 3)])
                ims.append(Z.crop(f))
        if ims:
            atlas, co = Z.pack(ims, 2048)
            atlas.save(os.path.join(OUT, 'df%d.webp' % n), 'WEBP', lossless=True, quality=100, method=6, exact=True)
            for cn in meta: meta[cn]['f'] = [[co[i][0], co[i][1], ims[i].width, ims[i].height, ms, ax, ay] for i, ms, ax, ay in meta[cn]['f']]
        res[n] = {'w': ours[ws], 'l': ours[ls], 'ev': trees, 'cut': meta}
        print('escena', n, ours[ws], 'contra', ours[ls], '·', len(trees), 'árboles ·', len(meta), 'paneles', '·', len(js) // 1024, 'KB')
    # Audios (voces y efectos de las escenas) y lo que dura cada uno: las escenas avanzan cuando acaba una voz
    durs = {}
    for s in sorted(snd_all):
        if s not in Z.MEDIA: continue
        safe = re.sub(r'[^a-z0-9_-]', '_', s)
        f = os.path.join(OUT, safe + '.m4a')
        if not os.path.exists(f):
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(Z.WWW, 'media', Z.MEDIA[s]), '-ac', '1', '-ar', '32000', '-c:a', 'aac', '-b:a', '48k', f], check=True)
        d = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout.strip()
        durs[s] = [safe, round(float(d or 0), 3)]
    for n in res: res[n]['snd'] = durs
    open(os.path.join(OUT, 'df.js'), 'w').write('// Generado por tools/make_zl3_df.py: Dramatic Finish de Z Legends 3 (js/versus/zdf.js)\nwindow.ZDF = ' + json.dumps(res, separators=(',', ':')) + ';\n')
    print('audios', len(durs), '·', sum(os.path.getsize(os.path.join(OUT, v[0] + '.m4a')) for v in durs.values()) // 1024, 'KB')


if __name__ == '__main__':
    main()
