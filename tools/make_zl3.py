"""Combate Z: convierte el APK de Z Legends 3 (Construct 2, carpeta assets/www) en los archivos del modo de lucha.

  python3 tools/make_zl3.py CARPETA/assets/www [--no-audio]

Salida en zl3/ (se descarga solo al entrar en el modo):
  zl3/index.js         plantilla, escenarios, efectos y tamaño de cada paquete (para la barra de descarga)
  zl3/c/<id>.js|.webp  un luchador: todas sus animaciones (fotogramas, tiempos, punto de anclaje y de disparo),
                       sus voces por fotograma y sus cinemáticas (paneles grandes) en un atlas aparte
  zl3/fx.js|.webp      efectos comunes (rayos, esferas, explosiones, golpes, auras, polvo)
  zl3/s/<id>.webp      escenarios (montados a partir de sus capas)
  zl3/a/*.m4a          voces y sonidos (AAC: funciona también en iPhone). Sin narrador.

Cómo se lee el juego original: data.js es el proyecto de Construct 2. project[3] son los tipos de objeto (sus
animaciones: [nombre, velocidad, bucle, repeticiones, repetirDesde, pingpong, sid, [fotogramas]] y cada fotograma
[imagen, bytes, x, y, w, h, duración, anclaX, anclaY, puntos, colisión]); project[5] los escenarios; project[6] las
hojas de eventos, de donde salen los sonidos que suenan en cada fotograma de cada animación.
"""
import base64, collections, hashlib, io, json, os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'zl3')
WWW = sys.argv[1]
AUDIO = '--no-audio' not in sys.argv
P = json.load(open(os.path.join(WWW, 'data.js'), encoding='utf-8-sig'))['project']
T = P[3]

# ---------------------------------------------------------------------------------------------------------------
# Luchadores: id del juego original -> (id nuestro, nombre, grupos de cinemáticas, retrato en la tienda)
# ---------------------------------------------------------------------------------------------------------------
FIGHTERS = [
    ('gokubase', 'goku', 'Goku', ['GokuBase', 'Goku'], 'GokuBase'),
    ('gokussj', 'gokussj', 'Goku SSJ', ['GokuSsj3'], 'GokuSsj'),
    ('gokublue', 'gokublue', 'Goku SSJ Blue', ['GokuBlue'], 'GokuBlue'),
    ('gokuui', 'gokuui', 'Goku Ultra Instinto', ['GokuUi', 'GokuUI'], 'GokuUi'),
    ('vegetasagasaiyan', 'vegeta', 'Vegeta', ['VegetaSagaSaiyan', 'Vegeta'], 'VegetaSagaSaiyan'),
    ('vegetassj', 'vegetassj', 'Vegeta SSJ', ['VegetaGod', 'VegetaBlue'], 'VegetaSsj'),
    ('vegetaegosuperior', 'vegetaego', 'Vegeta Ultra Ego', ['VegetaEgo'], 'VegetaUltraEgo'),
    ('gohanssj2', 'gohanssj2', 'Gohan SSJ2', ['TeenGohanSsj2', 'GohanVsCell'], 'GohanSsj2'),
    ('gohanbeast', 'gohanbeast', 'Gohan Bestia', ['GohanBeast'], 'GohanBeast'),
    ('miraigohan', 'miraigohan', 'Gohan del Futuro', [], 'MiraiGohan'),
    ('miraitrunks', 'miraitrunks', 'Trunks del Futuro', ['MiraiTrunks'], 'MiraiTrunks'),
    ('piccolo', 'piccolo', 'Piccolo', ['Piccolo'], 'Piccolo'),
    ('tienshihan', 'tien', 'Ten Shin Han', ['Tienshihan', 'Tienshinhan'], 'Tienshinhan'),
    ('gogetassj4', 'gogetassj4', 'Gogeta SSJ4', ['GogetaSsj4', 'GoegetaSsj4'], 'GogetaSsj4'),
    ('gogetassjblue', 'gogetablue', 'Gogeta Blue', ['GogetaBlue', 'Gogeta', 'GogetaFusion'], 'GogetaBlue'),
    ('vegettossjblue', 'vegettoblue', 'Vegetto Blue', ['VegettoBlue', 'VegettoVsZamasu'], 'VegettoBlue'),
    ('bardock', 'bardock', 'Bardock', ['Bardock'], 'Bardock'),
    ('bardockssj', 'bardockssj', 'Bardock SSJ', [], 'BardockSsj'),
    ('raditz', 'raditz', 'Raditz', ['Raditz'], 'Raditz'),
    ('nappa', 'nappa', 'Nappa', ['Nappa'], 'Nappa'),
    ('ginyu', 'ginyu', 'Capitán Ginyu', ['Ginyu'], 'Ginyu'),
    ('freeza', 'freezer', 'Freezer', ['Freeza'], 'Freeza'),
    ('cell', 'cell', 'Cell', ['Cell'], 'Cell'),
    ('android17', 'a17', 'Androide 17', ['Android17'], 'Android17'),
    ('android18', 'a18', 'Androide 18', ['Android18'], 'Android18'),
    ('kidbuu', 'kidbuu', 'Kid Buu', ['KidBuu', 'KidBull'], 'KidBuu'),
    ('janemba', 'janemba', 'Janemba', ['Janemba'], 'Janemba'),
    ('brolyz', 'brolyz', 'Broly Z', ['BrolyZ'], 'BrolyZ'),
    ('brolyikari', 'brolydbs', 'Broly (Super)', ['BrolyDbs'], 'BrolyDBS'),
    ('kefla', 'kefla', 'Kefla', ['Kefla'], 'Kefla'),
    ('hitto', 'hit', 'Hit', ['Hitto'], 'Hitto'),
    ('jiren', 'jiren', 'Jiren', ['Jiren'], 'Jiren'),
    ('bills', 'beerus', 'Bills', ['Bills'], 'Bills'),
    ('gokublackrose', 'black', 'Goku Black Rosé', ['GokuBlack'], 'GokuBlackRose'),
    ('zamasufusion', 'zamasu', 'Zamasu Fusionado', ['Zamasu'], 'Zamasu'),
    ('superbaby2', 'baby', 'Super Baby 2', ['SuperBaby2'], 'SuperBaby2'),
    ('moro73', 'moro', 'Moro', ['Moro73'], 'Moro73'),
]
# Efectos comunes (tipo de objeto por su imagen principal)
FX = ['kamehameha_pt1', 'kamehameha_pt2', 'kamehameha_pt3', 'kiblast_jogador_sprite', 'explosao_sprite', 'hit_sprite', 'efeitodeimpacto_sprite',
      'aura_sprite', 'esferadekigigante_sprite', 'poeira1', 'poeira2', 'poeira4', 'poeira5', 'makankosappo_sprite', 'efeito_de_kiblast_sprite',
      'rajadarapida_sprite', 'defesa_effect_sprite', 'genkidamaefeito_sprite', 'hit_forte_sprite', 'hit_extremamente_forte_sprite',
      'starteffectdust_sprite', 'poeiradesaltoequeda_sprite', 'efeito_quebravento_sprite', 'explosaodeki_effect_sprite', 'ko_txt_sprite',
      'impactoderochas_sprite', 'thunder_effect_sprite', 'explosion_specialball_effect', 'poeira_de_colisao_com_o_solo_sprite', 'poeira_especial_sprite',
      'sparking_ativo_effect_jogador_sprite', 'chaodestruido_sprite']
# Escenario: (capa de CENARIOS, id, nombre, (cielo: animación, fotograma), (suelo: animación, fotograma) o None)
STAGES = [('Namek', 'namek', 'Namek', ('Default', 0), ('Default', 0)), ('Templo de Kamisama', 'kami', 'Templo de Kami-sama', ('Default', 2), ('Default', 20)),
          ('Desert', 'desert', 'Desierto', ('Default', 11), ('Default', 23)), ('Goku House', 'paoz', 'Casa de Goku', ('Default', 20), ('Default', 5)),
          ('TimeChunber', 'time', 'Sala del Tiempo', ('Default', 6), ('Default', 20)), ('Kame House', 'kame', 'Kame House', ('Default', 7), None),
          ('MoonBattleField', 'moon', 'Campo lunar', ('Default', 8), ('Default', 7)), ('Satan City', 'satan', 'Ciudad Satán', ('Default', 22), ('Default', 22)),
          ('TenkaishiBudokai', 'tenka', 'Torneo de Artes Marciales', ('Default', 20), ('Default', 2)), ('TorneioDoPoder', 'tdp', 'Torneo del Poder', ('TorneioDoPoder', 0), None),
          ('Sea Coast', 'coast', 'Costa', ('Default', 16), None), ('Artico', 'artic', 'Ártico', ('Default', 14), ('Default', 16)),
          ('Zoon Planet', 'zoon', 'Planeta Zoon', ('PlanetZoon', 0), None), ('Space', 'space', 'Espacio', ('Default', 4), ('Default', 4)),
          ('Hell', 'hell', 'Otro Mundo', ('Default', 23), None), ('Inside Buu', 'buu', 'Dentro de Buu', ('InsideBuu', 0), None)]

# ---------------------------------------------------------------------------------------------------------------
def key_of(t):
    """Imagen principal de un tipo de objeto (su nombre real; los tipos están ofuscados como t0, t1…)"""
    c = collections.Counter()
    for a in t[7] if isinstance(t[7], list) else []:
        if isinstance(a, list) and len(a) > 7:
            for f in a[7]: c[re.sub(r'-sheet\d+\.png|\.png', '', f[0].split('/')[-1])] += 1
    return c.most_common(1)[0][0] if c else None

def anims_of(t):
    A = collections.OrderedDict()
    for a in t[7] if isinstance(t[7], list) else []:
        if not isinstance(a, list) or len(a) < 8 or not a[7]: continue
        A[a[0]] = dict(speed=a[1], loop=a[2], repto=a[4], f=[dict(img=f[0], x=f[2], y=f[3], w=f[4], h=f[5], d=f[6], hx=f[7], hy=f[8], pts=f[9]) for f in a[7]])
    return A

TYPES = [(i, t, key_of(t)) for i, t in enumerate(T)]
def best_type(key, need='Parado'):
    best = None
    for i, t, k in TYPES:
        if k and re.sub(r'_(jogador|inimigo)$', '', k) == key and (need is None or need in anims_of(t)):
            if best is None or len(anims_of(t)) > len(anims_of(best[1])): best = (i, t)
    return best

_IMG = {}
def img(path):
    if path not in _IMG: _IMG[path] = Image.open(os.path.join(WWW, path)).convert('RGBA')
    return _IMG[path]
def crop(f):
    return img(f['img']).crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']))

def pack(frames, maxw=2048):
    """Atlas con estantes. frames: lista de imágenes; devuelve (atlas, [[x,y]] por imagen). Repetidas: una vez"""
    uniq, ref = [], []
    seen = {}
    for im in frames:
        h = hashlib.md5(im.tobytes() + bytes(str(im.size), 'ascii')).hexdigest()
        if h not in seen: seen[h] = len(uniq); uniq.append(im)
        ref.append(seen[h])
    order = sorted(range(len(uniq)), key=lambda k: -uniq[k].height)
    pos = [None] * len(uniq); x = y = rowh = 0; W = 0
    for k in order:
        w, h = uniq[k].size
        if x + w + 1 > maxw: x = 0; y += rowh + 1; rowh = 0
        pos[k] = (x, y); x += w + 1; rowh = max(rowh, h); W = max(W, x)
    H = y + rowh
    A = Image.new('RGBA', (max(1, W), max(1, H)), (0, 0, 0, 0))
    for k, im in enumerate(uniq): A.paste(im, pos[k])
    return A, [pos[r] for r in ref]

def save_webp(im, path, lossless=True):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if lossless: im.save(path, 'WEBP', lossless=True, quality=100, method=6, exact=True)
    else: im.save(path, 'WEBP', quality=88, method=6)
    return os.path.getsize(path)

def anim_table(A, imgs, coords):
    """{nombre: [fps, bucle, repetirDesde, [[x, y, w, h, anclaX, anclaY, duración, disparoX, disparoY], …]]}"""
    out = {}; k = 0
    for name, a in A.items():
        fr = []
        for f in a['f']:
            x, y = coords[k]; k += 1
            ax, ay = round(f['hx'] * f['w']), round(f['hy'] * f['h'])
            p = f['pts'][0] if f['pts'] else None
            px, py = (round(p[1] * (f['w'] if p[1] <= 1.01 else 1)), round(p[2] * (f['h'] if p[2] <= 1.01 else 1))) if p else (-1, -1)
            fr.append([x, y, f['w'], f['h'], ax, ay, round(f['d'], 3), px, py])
        out[name] = [a['speed'], 1 if a['loop'] else 0, a['repto'], fr]
    return out

# ---------------------------------------------------------------------------------------------------------------
# Sonidos: qué suena en cada fotograma de cada animación (hojas de eventos)
# ---------------------------------------------------------------------------------------------------------------
MEDIA = {os.path.splitext(f)[0].lower(): f for f in os.listdir(os.path.join(WWW, 'media'))}
NARR = re.compile(r'narrad|narrator|^nr_|_narr')
def strs(x, out):
    if isinstance(x, str): out.append(x)
    elif isinstance(x, list):
        for y in x: strs(y, out)
def ints(x, out):
    if isinstance(x, list):
        if len(x) == 2 and x[0] == 0 and isinstance(x[1], int): out.append(x[1])
        for y in x: ints(y, out)
def sound_map(char_types):
    res = collections.defaultdict(lambda: collections.defaultdict(set))
    def walk(ev, ctx):
        if not isinstance(ev, list): return
        if len(ev) < 7 or ev[0] != 0 or not isinstance(ev[5], list):
            for e in ev: walk(e, ctx)
            return
        c = dict(ctx)
        for cd in ev[5]:
            ti = cd[0] if isinstance(cd, list) else None
            if ti in char_types:
                cid, A = char_types[ti]; c['ch'] = cid
                ss = []; strs(cd[-1] if isinstance(cd[-1], list) else [], ss)
                an = [s for s in ss if s in A]
                if an: c['anim'] = an[0]
                if cd[1] == 71:
                    n = []; ints(cd[-1], n)
                    if n: c['frame'] = n[-1]
        for a in ev[6] if isinstance(ev[6], list) else []:
            if not (c.get('ch') and c.get('anim')): continue
            ss = []; strs(a, ss)
            snd = [s.lower() for s in ss if s.lower() in MEDIA]
            for s in ss:                                   # voz al azar: "vgks" & choose(200, 201)
                if re.fullmatch(r'v[a-z]{2,5}', s):
                    n = []; ints(a, n)
                    snd += [s + '%03d' % v for v in n if s + '%03d' % v in MEDIA]
            for s in snd:
                if not NARR.search(s): res[c['ch']][c['anim']].add((c.get('frame', 0), s))
        if len(ev) > 7 and isinstance(ev[7], list):
            for e in ev[7]: walk(e, c)
    for sh in P[6]:
        for ev in sh[1]: walk(ev, {})
    return res

# ---------------------------------------------------------------------------------------------------------------
def build_fighters():
    os.makedirs(os.path.join(OUT, 'c'), exist_ok=True)
    cut_t = best_type('cutscenes_sprite', None); CUT = anims_of(cut_t[1])
    shop = anims_of(best_type('personagemloja_sprite', None)[1])
    char_types, roster = {}, []
    for src, cid, name, cuts, shopk in FIGHTERS:
        for i, t, k in TYPES:
            if k and re.sub(r'_(jogador|inimigo)$', '', k) == src and 'Parado' in anims_of(t): char_types[i] = (cid, anims_of(t))
    snd = sound_map(char_types)
    used_audio = set()
    for src, cid, name, cuts, shopk in FIGHTERS:
        i, t = best_type(src); A = anims_of(t)
        # Animaciones del luchador + retrato animado de la tienda
        frames = [crop(f) for a in A.values() for f in a['f']]
        S = shop.get(shopk); sfr = [crop(f) for f in S['f']] if S else []
        atlas, co = pack(frames + sfr)
        size = save_webp(atlas, os.path.join(OUT, 'c', cid + '.webp'))
        table = anim_table(A, frames, co[:len(frames)])
        shopA = anim_table({'Face': S}, sfr, co[len(frames):])['Face'] if S else None
        # Cinemáticas (paneles grandes) en su propio atlas
        C = {n: a for n, a in CUT.items() if any(n == g or n.startswith(g + '_') for g in cuts)}
        cfr = [crop(f) for a in C.values() for f in a['f']]
        cut = None
        if cfr:
            ca, cco = pack(cfr, 4096)
            size += save_webp(ca, os.path.join(OUT, 'c', cid + '_cut.webp'), lossless=ca.width * ca.height < 3e6)
            cut = anim_table(C, cfr, cco)
        # Sonidos por fotograma
        voice = {}
        for an, L in snd.get(cid, {}).items():
            if an in table:
                voice[an] = sorted([[fr, s] for fr, s in L])
                used_audio.update(s for fr, s in L)
        meta = dict(id=cid, name=name, anims=table, voice=voice, face=shopA, cut=cut)
        js = 'ZL3.add(' + json.dumps(meta, separators=(',', ':'), ensure_ascii=False) + ');\n'
        open(os.path.join(OUT, 'c', cid + '.js'), 'w', encoding='utf-8').write(js)
        roster.append(dict(id=cid, name=name, n=len(A), cut=bool(cut), bytes=size + len(js)))
        print(cid, len(A), 'anims', atlas.size, 'cut', len(C), 'voces', len(voice), (size + len(js)) // 1024, 'KB', flush=True)
    return roster, used_audio

def build_fx():
    frames, A2 = [], collections.OrderedDict()
    for k in FX:
        for i, t, kk in TYPES:
            if kk != k: continue
            for n, a in anims_of(t).items():
                nm = k + '/' + n
                if nm not in A2: A2[nm] = a
    frames = [crop(f) for a in A2.values() for f in a['f']]
    atlas, co = pack(frames, 4096)
    size = save_webp(atlas, os.path.join(OUT, 'fx.webp'))
    js = 'ZL3.fx=' + json.dumps(anim_table(A2, frames, co), separators=(',', ':')) + ';\n'
    open(os.path.join(OUT, 'fx.js'), 'w').write(js)
    print('fx', len(A2), atlas.size, size // 1024, 'KB')
    return size + len(js)

def build_stages():
    L = [l for l in P[5] if l[0] == 'CENARIOS'][0]
    out = []
    for layer in L[6]:
        st = [s for s in STAGES if s[0] == layer[0]]
        if not st: continue
        _, sid, name, sky, floor = st[0]
        ins = layer[14]
        # Escala del pixel art: la de la instancia más grande (las capas se dibujan con píxeles de ese tamaño)
        sc = []
        for inst in ins:
            a = anims_of(T[inst[1]]); f = list(a.values())[0]['f'][0] if a else None
            if f: sc.append(inst[0][3] / f['w'])
        k = max(1.0, round(sorted(sc)[len(sc) // 2])) if sc else 1
        W, H = round(1708 / k), round(960 / k)
        C = Image.new('RGBA', (W, H), (0, 0, 0, 255))
        SKY = anims_of(best_type('cenarios_fundo_sprite', None)[1]); FL = anims_of(best_type('cenarios_chao_sprite', None)[1])
        sk = crop(SKY[sky[0]]['f'][sky[1]]).resize((W, H), Image.NEAREST); C.alpha_composite(sk)
        for inst in ins:
            a = anims_of(T[inst[1]])
            if not a: continue
            an = inst[5][1] if len(inst) > 5 and isinstance(inst[5], list) and len(inst[5]) > 1 and inst[5][1] in a else list(a)[0]
            f = a[an]['f'][0]; x, y, _, w, h = inst[0][:5]; op = inst[0][7] if len(inst[0]) > 7 else 1
            if w < 1 or h < 1 or op <= 0: continue
            im = crop(f).resize((max(1, round(w / k)), max(1, round(h / k))), Image.NEAREST)
            if op < 1: im.putalpha(im.getchannel('A').point(lambda v: int(v * op)))
            hx, hy = inst[0][8], inst[0][9]
            C.alpha_composite(im, (round(x / k - hx * im.width), round(y / k - hy * im.height))) if 0 <= round(x / k - hx * im.width) and 0 <= round(y / k - hy * im.height) else C.paste(im, (round(x / k - hx * im.width), round(y / k - hy * im.height)), im)
        if floor:                                          # suelo: a lo ancho, apoyado abajo
            fl = crop(FL[floor[0]]['f'][floor[1]]); fh = max(1, round(fl.height * W / fl.width)); fl = fl.resize((W, fh), Image.NEAREST)
            C.alpha_composite(fl, (0, H - fh))
        size = save_webp(C.convert('RGB'), os.path.join(OUT, 's', sid + '.webp'), lossless=False)
        out.append(dict(id=sid, name=name, w=W, h=H, k=k, bytes=size))
        print('escenario', sid, (W, H), 'x', k, size // 1024, 'KB')
    return out

def convert_audio(names):
    os.makedirs(os.path.join(OUT, 'a'), exist_ok=True)
    def one(n):
        src = os.path.join(WWW, 'media', MEDIA[n]); dst = os.path.join(OUT, 'a', re.sub(r'[^a-z0-9_-]', '_', n) + '.m4a')
        if not os.path.exists(dst):
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-ac', '1', '-c:a', 'aac', '-b:a', '64k', dst], check=True)
        return os.path.getsize(dst)
    with ThreadPoolExecutor(8) as ex: sizes = list(ex.map(one, sorted(names)))
    return sum(sizes)

# Sonidos generales del combate (golpes, defensa, dash, teletransporte…)
COMMON = ['hit_small-a', 'hit_midle-a', 'hit_large-a', 'hit_xlarge', 'guard_breaker', 'kiblast', 'ataque_superrapido', 'som de movimento',
          'explosaodeenergia', 'teletransporte', 'dash', 'defesa', 'caindo', 'queda', 'pulo', 'carregandoki', 'sparking', 'explosao']

def build_faces():
    """Miniaturas para elegir equipo (cuerpo entero de la tienda + la cara de la selección), en un atlas pequeño"""
    shop = anims_of(best_type('personagemloja_sprite', None)[1])
    sel_t = best_type('personagem_select_sprite', None); sel = anims_of(sel_t[1])['Default']['f']
    order = list(shop)                                     # el orden de la tienda es el mismo que el de la selección
    ims, keys = [], []
    for src, cid, name, cuts, shopk in FIGHTERS:
        if shopk in shop: ims.append(crop(shop[shopk]['f'][0])); keys.append((cid, 'b'))
        k = order.index(shopk) if shopk in order else -1
        if 0 <= k < len(sel): ims.append(crop(sel[k])); keys.append((cid, 'f'))
    atlas, co = pack(ims, 1024)
    save_webp(atlas, os.path.join(OUT, 'faces.webp'))
    F = {}
    for (cid, kind), (x, y), im in zip(keys, co, ims): F.setdefault(cid, {})[kind] = [x, y, im.width, im.height]
    return F

if __name__ == '__main__':
    if '--stages' in sys.argv: build_stages(); sys.exit()
    if '--faces' in sys.argv:
        F = build_faces(); p = os.path.join(OUT, 'index.js'); s = open(p, encoding='utf-8').read()
        idx = json.loads(s[len('ZL3.index='):].rstrip().rstrip(';')); idx['faces'] = F
        open(p, 'w', encoding='utf-8').write('ZL3.index=' + json.dumps(idx, ensure_ascii=False, separators=(',', ':')) + ';\n'); sys.exit()
    roster, used = build_fighters()
    fxb = build_fx()
    stages = build_stages()
    common = set()
    for c in COMMON:
        common.update(n for n in MEDIA if n == c or n.startswith(c) and not NARR.search(n))
    ab = convert_audio(used | common) if AUDIO else 0
    idx = dict(roster=roster, stages=stages, faces=build_faces(), fxBytes=fxb, audioBytes=ab, common=sorted(re.sub(r'[^a-z0-9_-]', '_', n) for n in common))
    open(os.path.join(OUT, 'index.js'), 'w', encoding='utf-8').write('ZL3.index=' + json.dumps(idx, ensure_ascii=False, separators=(',', ':')) + ';\n')
    tot = sum(r['bytes'] for r in roster) + fxb + sum(s['bytes'] for s in stages) + ab
    print('TOTAL', tot // 1024 // 1024, 'MB · luchadores', len(roster), '· audio', ab // 1024 // 1024, 'MB')
