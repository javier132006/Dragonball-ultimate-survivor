"""Iconos de las técnicas (assets/icons/tecnicas.webp + js/techicons.js).

Uso:  python3 tools/make_techicons.py CARPETA_IMAGENES tools/tecnicas.json
  CARPETA_IMAGENES: las hojas 4×4 de ChatGPT (fondo negro). Las que vienen dos en una imagen (1774×887) se parten
                    por la mitad. Orden de las hojas: HOJAS (principio del nombre del archivo).
  TECNICAS.json:    {"W": [{id, name, desc, cat, unique, fusion, color}], "U": [{cid, name, type, color}]}
                    (técnicas y Ultimates sacadas del juego) + tools/iconos_orden.json (la lista pedida a ChatGPT).

ChatGPT siguió el orden pedido solo en algunas hojas (EXACT). En las demás, cada icono lleva a mano su forma y su
color (TAGS) y a cada técnica se le da el que mejor encaja con su nombre y su descripción (rayo, esfera, disco,
puño…) y con su color, repartiendo para que no se repitan; FIX y POST son los ajustes hechos mirando el resultado."""
import json, math, os, re, sys, unicodedata
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOJAS = '92f10a91 a689abf2 5934eb74 d7f233d3 34876116 7750597b ade33244 91cd4297 c28c91c2 65dc8d34 6fc1ce94 67407b98 e489bafc 2c81dd72 7f001553 404a4cca e4324215 40a79280 21c27a04 a2b2753a 43c05a4b 99803464 d2887531 0a0621bc 6a1b6836 3899d68d'.split()
CELL = 72
TAGS = """0: ring V|sphere B|fire O|portal V|cubes B|nova O|comet B|beam B|genki B|kaioken R|fist O|dragon Y|fists O|beam B|homing V|explo V
1: pillar Y|tornado B|slash V|sphere G|comet B|fan Y|dash Y|dome Y|explo B|flash P|rain O|rings B|sphere V|wave B|rain G|ball4 Y
2: genki B|rings B|rain Y|explo Y|crystal B|sphere V|rain G|pillar Y|dash Y|dragon Y|orbit V|dome B|heal G|fan R|tornado B|aura B
3: fan Y|beam Y|orbit Y|mines Y|rain Y|pulse Y|disc Y|drill P|kikoho Y|homing Y|dome B|bolt B|comet Y|sphere G|fan R|candy P
4: beam B|ball4 Y|vortex V|radar G|kaioken R|comet B|aura Y|portal V|genki B|aura B|dash Y|explo O|tornado G|comet Y|dome B|fist R
5: beam B|fire O|sphere V|ball4 Y|pillar Y|heal G|genki B|slash P|comet B|aura Y|vortex R|dome B|pillar V|dragon Y|explo O|multi P
6: beam B|explo Y|vortex V|ball4 Y|kaioken R|heal G|dome B|comet B|dragon Y|genki B|disc Y|multi V|pillar Y|tornado B|slash P|explo O
7: homing V|beam R|orbit V|slash R|rain P|multi W|comet W|beam W|sphere W|fist W|aura W|multi W|orbit W|beam W|disc W|fist O
8: comet B|nova Y|slash V|tornado G|kaioken R|dome B|rain O|genki B|dragon Y|sphere V|heal G|explo O|tornado B|fan Y|fan P|aura B
9: beam B|explo O|vortex V|dome B|pillar Y|kaioken O|heal G|comet B|fist Y|dragon Y|multi B|scythe P|comet V|explo B|aura Y|orbit R
10: beam V|sphere V|beam Y|explo Y|fan V|dash V|explo B|scythe P|orbit V|pillar P|vortex P|aura P|rain V|sphere P|beam P|infinity P
11: sphere V|crystal V|cooler V|beam V|hit V|dash V|clock V|target V|comet O|raditz O|scouter G|vortex O|redribbon R|a16 G|explo G|sphere G
12: vortex V|comet V|rain V|sphere V|beam V|multi V|orbit V|vortex V|slash R|comet O|beam R|explo R|rain Y|vortex Y|explo Y|rain Y
13: disc Y|candy P|candy P|beam P|explo P|buubelly P|steam P|comet P|comet P|beam P|explo P|stretch P|rain P|multi V|homing V|beam V
14: crystal V|comet G|saibamen G|explo G|rain G|slash G|rain G|homing V|orbit V|beam V|sphere V|finger V|hakai V|comet V|vortex V|beam V
15: orbit G|beam G|explo G|rocketfist G|cannons G|multi B|homing B|beam B|disc B|kick O|bolt B|comet Y|rain Y|beam Y|flash Y|fists W
16: sphere V|explo G|orbit V|beam B|fruit R|saibamen G|aura V|slash V|comet V|multi G|finger V|disc V|aura V|saibamen G|pillar V|cooler V
17: rain Y|beam C|homing C|beam C|comet C|dome C|beam C|comet R|homing R|beam R|comet R|fist R|sphere R|comet V|homing V|beam V
18: sphere B|comet B|vortex B|beam B|comet V|explo V|sphere V|beam V|comet O|vortex O|explo O|beam O|orbit Y|nova Y|pillar Y|flash Y
19: homing Y|beam Y|explo V|slash V|comet V|vortex V|comet O|explo R|slash R|sphere R|comet B|beam B|vortex B|multi B|explo B|crystal B
20: comet B|orbit B|pillar Y|vortex Y|aura B|comet R|sphere R|beam R|comet V|orbit V|pillar V|vortex V|comet G|sphere G|wave G|beam G
21: comet B|orbit B|pillar B|beam B|comet Y|nova Y|wave Y|explo Y|homing V|vortex V|explo V|beam V|comet R|sphere R|homing R|beam R
22: vortex Y|comet Y|rain Y|explo Y|beam B|sphere B|tornado B|aura B|vortex V|beam V|multi V|dome V|aura R|comet P|sphere R|beam R
23: tornado G|hand G|comet G|explo G|bolt Y|sphere Y|pillar Y|dragon Y|tornado P|flash P|slash P|lotus P|comet B|comet B|flash B|explo B
24: rain Y|beam V|vortex V|explo V|comet G|dome G|slash G|aura G|sphere C|beam C|vortex C|rain C|multi P|beam P|homing P|explo P
25: rain O|nova Y|slash O|pillar Y|crystal B|crystal B|vortex B|explo B|sphere R|homing R|vortex R|aura R|slash V|flash V|vortex V|pillar V
26: disc Y|dome O|dragon B|beam C|grenade G|flash Y|orbit Y|rain P|multi V|scythe P|sword B|comet Y|sphere B|rain B|beam B|sword Y
27: homing Y|beam Y|explo Y|fist Y|comet Y|sphere V|vortex V|beam V|multi V|pillar V|explo V|hand P|homing B|beam B|sphere B|explo B
28: comet V|sphere V|vortex V|beam V|comet Y|explo Y|slash Y|fist Y|multi B|beam B|explo B|vortex B|sphere P|pillar P|homing P|slash P"""

def crop_cells(src):
    """Celdas de 128 px de cada hoja: lista de hojas, cada una con 16 imágenes"""
    files = os.listdir(src); sheets = []
    for pre in HOJAS:
        fn = next(f for f in files if f.startswith(pre))
        im = np.asarray(Image.open(os.path.join(src, fn)).convert('RGB')); H, W = im.shape[:2]
        for x0, x1 in ([(0, W)] if W == H else [(0, W // 2), (W // 2, W)]):
            sub = im[:, x0:x1]; lum = sub.max(2) > 40
            cx = np.nonzero(lum.mean(0) > 0.02)[0]; cy = np.nonzero(lum.mean(1) > 0.02)[0]
            X0, X1, Y0, Y1 = cx[0], cx[-1] + 1, cy[0], cy[-1] + 1
            if pre == '99803464': Y1 = 798                     # esta trae el rótulo «Hoja 21 / 22» debajo
            cw, ch = (X1 - X0) / 4, (Y1 - Y0) / 4; cells = []
            for k in range(16):
                r, c = divmod(k, 4)
                cell = sub[int(Y0 + r * ch + 4):int(Y0 + (r + 1) * ch - 4), int(X0 + c * cw + 4):int(X0 + (c + 1) * cw - 4)]
                h, w = cell.shape[:2]; s = max(h, w); out = np.zeros((s, s, 3), np.uint8)
                out[(s - h) // 2:(s - h) // 2 + h, (s - w) // 2:(s - w) // 2 + w] = cell
                cells.append(Image.fromarray(out).resize((128, 128), Image.LANCZOS))
            sheets.append(cells)
    return sheets

def assign(R):
    W=R['W']; U=R['U']
    order=json.load(open(os.path.join(ROOT, 'tools', 'iconos_orden.json')))
    T=[l.split(': ')[1].split('|') for l in TAGS.split('\n')]
    ICON={f'{s}.{i}':tuple(T[s][i].split()) for s in range(len(T)) for i in range(16)}
    COL={'Y':(255,210,40),'O':(255,130,30),'R':(230,40,40),'P':(255,60,190),'V':(160,60,255),'B':(40,120,255),'C':(40,220,240),'G':(60,220,60),'W':(225,225,235)}
    def hexrgb(n): return ((n>>16)&255,(n>>8)&255,n&255)
    def nearest(rgb):
        r,g,b=rgb; mx=max(rgb); mn=min(rgb)
        if mx-mn<40: return 'W'
        return min(COL,key=lambda k: sum((a-c)**2 for a,c in zip(COL[k],rgb)))
    def low(s): return unicodedata.normalize('NFD',s.lower()).encode('ascii','ignore').decode()
    WORDCOL=[('violeta|morad|oscur','V'),('rosa','P'),('verde|acido','G'),('azul','B'),('amarill|dorad|sol','Y'),('fuego|llama|infiern|naranja','O'),('roj|carmes','R'),('gris|blanc|plat|luz','W')]
    techs=[]  # (key, name, desc, colorletter, kind)
    for w in W:
        d=low(w['name']+' '+w['desc']); c=None
        for pat,k in WORDCOL:
            if re.search(pat,d): c=k; break
        if not c and w['color']: c=nearest(hexrgb(w['color']))
        techs.append(dict(key=w['id'],name=w['name'],t=d,col=c or 'Y',cat=w['cat'],fus=bool(w['fusion'])))
    for u in U:
        d=low(u['name']); c=nearest(hexrgb(u['color'])) if u['color'] else 'Y'
        techs.append(dict(key='ult_'+u['cid'],name=u['name'],t=d+' '+u['type'],col=c,cat='ult',fus=False))
    # Forma -> iconos válidos
    def shapes(t):
        s=t['t']; n=low(t['name'])
        R_=[('genkidama','genki'),('kaio-ken|kaioken','kaioken'),('dragon rush','fists dash'),('dragon','dragon'),('caramel','candy'),('panzazo','buubelly'),('ira majin','steam'),
            ('guadana','scythe slash'),('espada|excalibur|sword|tajo|slash|hoja del','sword slash'),('garra|zarpazo|colmillo|latigo','slash'),('patada','kick fist'),
            ('barrera|escudo','dome'),('disco|kienzan|saucer|donut|cuchilla|discs','disc rings'),('destello|taiyoken','flash nova'),
            ('pared|cupula|dome','dome'),('portal|agujero|grieta|rift','portal vortex'),('torbellino|tormenta|storm','vortex tornado'),
            ('lluvia|caen|cielo|meteoro','rain pillar comet'),('supernova|sol ','nova sphere'),
            ('puno|golpe|combo|embestida|asalto|carga |rush|martillo|impact|arrolla|aplasta|salto','fist dash fists'),
            ('persigu|teledirig|guiad|cazador','homing multi comet'),('giran|orbit|alrededor','orbit multi'),
            ('rayo|kamehameha|canon|cannon|flash|beam|galick|masenko|laser|makanko|dodonpa|ho ','beam wave'),
            ('onda|empuja|pulso|libera|zona|furia|ira|rugido|estallido','aura nova flash'),
            ('explot|explosion|estall|bomb','explo sphere'),('esfera|ball|bola','sphere orbit multi'),('rafaga|balas|bolas','comet fan homing')]
        for p,v in R_:
            if re.search(p,n): return v.split()
        for p,v in R_:
            if re.search(p,s): return v.split()
        return ['comet','sphere','beam']
    FIX={  # ajustes a mano: técnica -> icono concreto
     'ult_goku':'2.0','ult_black':'4.7','ult_hitto':'11.4','ult_cooler':'16.15','ult_andro16':'11.12','ult_bills':'16.6','ult_saibaman':'16.13',
     'ult_majin':'13.2','ult_superbuu':'28.12','ult_andro17':'10.15','ult_turles':'16.12','ult_broly':'24.7','ult_jiren':'7.10','ult_raditz':'11.9','ult_kale':'25.11','ult_kefla':'22.12','ult_zamasuf':'23.11','ult_gogeta':'23.7','ult_vegito':'4.9','ult_piccolo':'26.4','ult_gohan':'9.14','ult_cell':'20.13','ult_yamcha':'27.0',
    }
    def byname(name, ic): FIX[next(t['key'] for t in techs if t['name']==name)] = ic
    for name,ic in [('Guadaña Divina','10.7'),('Esferas de Ki Oscuro','10.8'),('Juicio Divino','10.9'),('Guadaña del Dolor','10.10'),('Kamehameha Negro','10.0'),('Embestida Divina','10.5'),('Lluvia de Ki Rosa','10.4'),
      ('Kamehameha Rosé','10.14'),('Absolución Divina','10.1'),('Guadaña de la Ira Divina','9.11'),('Kamehameha Kaio-ken','4.4'),('Meteoro Kaio-ken','9.5'),('Puño del Dragón Meteoro','8.8'),
      ('Final Flash','10.2'),('Explosión Final','10.3'),('Célula Jr.','16.13'),('Juegos de Célula','16.5'),('Barrera Perfecta','24.5'),('Autodestrucción','16.1'),('Brazos Elásticos','23.1'),('Hellzone Grenade','26.4'),
      ('Ira Eléctrica','23.4'),('Rugido Legendario','24.7'),('Donut Galáctico','2.1'),('Halo Divino','23.11'),('Salto Temporal','11.6'),('Disparo del Asesino','11.7'),('Persecución Temporal','11.5'),
      ('Látigo del Tirano','11.2'),('Destello de Cooler','11.0'),('Doble Embestida','11.9'),('Ráfagas de Raditz','11.8'),('Saturday Crush','11.11'),('Esferas del 16','11.13'),('Esferas del Árbol Sagrado','16.4'),
      ('Supernova de Freezer','8.1'),('Supernova de Cooler','18.13'),('Supernova','25.1'),('Mini Supernova','0.5'),('Espíritu Saiyajin','4.6'),('Furia Definitiva','8.15'),('Combo Potara','4.10'),('Zona de Poder','7.10'),
      ('Patada de la Grulla','15.9'),('Torbellino de Buu','13.11'),('Tormenta Eléctrica','3.11'),('Rayos del Juicio','3.11'),('Bakuriki Maha','2.15'),('Hakai','14.12'),('Toque de Destrucción','14.11')]:
        byname(name,ic)
    # Hojas que ChatGPT hizo en el orden pedido: hoja de la imagen -> hoja de la lista
    EXACT={0:2,3:1,7:11,13:15,14:12,15:14,17:18,26:21}
    pos={(h,p):k for h,p,k in order}
    okey={}  # clave de orden -> clave técnica
    ids=[t['key'] for t in techs]
    def tkey(k):  # claves del orden: id de arma o 'ult_<NOMBRE>'
        return k
    ex={}
    for s,h in EXACT.items():
        for i in range(16):
            k=pos.get((h,i))
            if k and k in ids: ex[k]=f'{s}.{i}'
    use={}; out={}
    for k,v in list(ex.items())+list(FIX.items()):
        out[k]=v; use[v]=use.get(v,0)+1
    def dist(a,b): return sum((x-y)**2 for x,y in zip(COL[a],COL[b]))**0.5
    for t in techs:
        if t['key'] in out: continue
        sh=shapes(t); best=None
        for ic,(s,c) in ICON.items():
            if s not in sh: continue
            sc=sh.index(s)*90 + dist(c,t['col']) + use.get(ic,0)*140 + (0 if t['cat']!='ult' or s in ('aura','genki','dragon','nova','portal') else 15)
            if best is None or sc<best[0]: best=(sc,ic)
        if not best: print('SIN', t['name'], sh); continue
        out[t['key']]=best[1]; use[best[1]]=use.get(best[1],0)+1
    POST={'Gigantic Meteor':'1.3','Eraser Blow':'24.4','Final Impact':'21.5','Kamehameha Solar':'15.1','Eraser Cannon':'20.15','Gigantic Ray':'1.14','Masenko':'27.1',
     'KAMEHAMEHA PLATEADO':'7.13','LANZA DEL DESTINO NEGRO':'10.12','CUCHILLA DIVINA':'19.3','SPIRIT CANNON FINAL':'18.3','BURNING SLASH':'25.2'}
    for t in techs:
        if t['name'] in POST and t['key'] not in ex: out[t['key']]=POST[t['name']]
    return out



def main(src, tech_json):
    sheets = crop_cells(src); out = assign(json.load(open(tech_json, encoding='utf-8')))
    used = sorted(set(out.values()), key=lambda v: tuple(map(int, v.split('.'))))
    C = 20; Rr = math.ceil(len(used) / C); at = Image.new('RGB', (C * CELL, Rr * CELL)); idx = {}
    for k, v in enumerate(used):
        s, i = map(int, v.split('.'))
        at.paste(sheets[s][i].resize((CELL, CELL), Image.LANCZOS), ((k % C) * CELL, (k // C) * CELL)); idx[v] = k
    os.makedirs(os.path.join(ROOT, 'assets', 'icons'), exist_ok=True)
    at.save(os.path.join(ROOT, 'assets', 'icons', 'tecnicas.webp'), 'WEBP', quality=80, method=6)
    m = {k: idx[v] for k, v in out.items()}
    js = open(os.path.join(ROOT, 'js', 'techicons.js'), encoding='utf-8').read()
    js = re.sub(r'const TECH_ICON_COLS = \d+, TECH_ICON_ROWS = \d+;', 'const TECH_ICON_COLS = %d, TECH_ICON_ROWS = %d;' % (C, Rr), js)
    js = re.sub(r'const TECH_ICON = \{.*?\};', lambda _: 'const TECH_ICON = ' + json.dumps(m, separators=(',', ':')) + ';', js)
    open(os.path.join(ROOT, 'js', 'techicons.js'), 'w', encoding='utf-8').write(js)
    print(len(m), 'técnicas ·', len(used), 'iconos ·', os.path.getsize(os.path.join(ROOT, 'assets', 'icons', 'tecnicas.webp')) // 1024, 'KB')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
