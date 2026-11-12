#!/usr/bin/env python3
"""
make_pfx.py · Efectos de pixel art de pixelfx (https://github.com/patch-gg/pixelfx, licencia MIT, Patch y
Hugo Duprez) convertidos en dos atlas pequeños para el juego.

  python3 tools/make_pfx.py <carpeta de pixelfx>

Qué hace:
  1. Renderiza los efectos elegidos (EFFECTS) con la propia librería (tools/pfx_render.mjs, necesita node),
     a 15 fps en vez de 30 y con la paleta que pidamos (gris = se tiñe en el juego con el color del ki).
  2. Recorta cada efecto a la caja que ocupan todos sus fotogramas juntos y lo mete en casillas iguales:
       pfx  · 128 px · el punto de apoyo en el centro de la casilla (impactos, escudos, explosiones)
       pfxg · 192 px · el punto de apoyo abajo en el centro (rayos que caen, portales, círculos en el suelo)
  3. Escribe assets/pfx.js: SPRITE_DATA.pfx / SPRITE_DATA.pfxg (WebP sin pérdida en base64) y PFX_ANIMS
     {nombre: {s, f, e, fps, loop}}. `e` = fracción de la casilla que ocupa el dibujo (para pedir tamaños reales).
"""
import base64, io, json, os, shutil, subprocess, sys, tempfile
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRIS = ['#1a1a1a', '#3a3a3a', '#5e5e5e', '#878787', '#b0b0b0', '#d6d6d6', '#f0f0f0', '#ffffff']

# nombre: (efecto de pixelfx, paleta o None = la suya, casilla 'c' centro / 'g' suelo, máx. fotogramas)
EFFECTS = {
    'strike':  ('lightning/lightning-strike', None, 'g', 12),   # rasgo «rayos» de las transformaciones del altar
    'zap':     ('lightning/zap-hit',          None, 'c', 8),   # impacto de esos rayos en el enemigo
    'crit':    ('impacts/crit-hit',           None, 'c', 8),   # golpes críticos
    'parry':   ('impacts/parry',              None, 'c', 9),   # esquiva automática (Ultra Instinto)
    'shield':  ('holy/divine-shield',         GRIS, 'c', 12),   # Barrera de Ki (se tiñe con su color)
    'implode': ('explosions/implosion',       GRIS, 'c', 12),   # Transmisión Instantánea: desaparece
    'portal':  ('spawn/spawn-portal',         GRIS, 'g', 14),   # llegada de un jefe (con su color)
    'plasma':  ('explosions/plasma-explosion', None, 'c', 12),  # Saibaiman kamikaze
    'collect': ('pickups/collect-burst',      GRIS, 'c', 10),   # recoger semillas, esferas y cápsulas
    'heal':    ('holy/heal-aoe',              None, 'g', 12),   # curación de la semilla
    'firework':('explosions/firework-burst',  None, 'c', 14),   # jefe derrotado
    'sun':     ('holy/sunburst',              None, 'c', 12),   # altar: resplandor de SPARKING / ULTRA
    'runes':   ('arcane/rune-circle',         GRIS, 'g', 12),   # altar: círculo bajo la esfera
}
CELL = {'c': 128, 'g': 192}
NODARK = {'strike', 'implode'}   # su «oscurecimiento» del fondo se vería como una mancha negra: fuera los píxeles casi negros
COLS = {'c': 12, 'g': 8}


def render(pfx, tmp):
    lst = [{'id': v[0], 'fps': 15, 'palette': v[1]} for v in EFFECTS.values()]
    subprocess.run(['node', os.path.join(ROOT, 'tools', 'pfx_render.mjs'), pfx, tmp, json.dumps(lst)], check=True)
    out = {}
    for n, name in enumerate(EFFECTS):
        m = json.load(open(os.path.join(tmp, '%d.json' % n)))
        fr = [Image.frombytes('RGBA', (m['w'], m['h']), open(os.path.join(tmp, '%d_%d.rgba' % (n, k)), 'rb').read()) for k in range(m['frames'])]
        out[name] = (m, fr)
    return out


def build(pfx):
    tmp = tempfile.mkdtemp(prefix='pfx_')
    try:
        data = render(pfx, tmp)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    cells = {'c': [], 'g': []}; table = {}
    for name, (m, fr) in data.items():
        _, _, kind, mx = EFFECTS[name]
        # El halo de luz suave (píxeles casi transparentes) se quita: con la paleta reducida se vería como una
        # cúpula gris plana, y el juego ya pone sus propios destellos. Queda el pixel art nítido
        fr = [Image.merge('RGBA', f.split()[:3] + (f.getchannel('A').point(lambda a: 0 if a < 70 else a),)) for f in fr]
        if name in NODARK:
            def clean(f):
                px_ = f.load()
                for y in range(f.height):
                    for x in range(f.width):
                        r, g, b, al = px_[x, y]
                        if al and max(r, g, b) < 48: px_[x, y] = (0, 0, 0, 0)
                return f
            fr = [clean(f.copy()) for f in fr]
        big = lambda f: (lambda b: b and (b[2] - b[0]) * (b[3] - b[1]) > 60)(f.getbbox())
        while len(fr) > 1 and not big(fr[0]): fr.pop(0)                  # fuera los fotogramas del principio casi vacíos
        fr = [f for f in fr if f.getbbox()] or fr[:1]                     # y los vacíos
        if len(fr) > mx:                                                  # menos fotogramas, misma duración
            fr = [fr[round(i * (len(fr) - 1) / (mx - 1))] for i in range(mx)]
        dur = m['frames'] / m['fps']
        px, py = m['pivot']
        # Caja de todos los fotogramas juntos, medida desde el punto de apoyo
        L = T = 10 ** 9; R = B = -10 ** 9
        for f in fr:
            b = f.getbbox()
            if b: L, T, R, B = min(L, b[0]), min(T, b[1]), max(R, b[2]), max(B, b[3])
        C = CELL[kind]
        if kind == 'c':
            ext = max(px - L, R - px, py - T, B - py)
            k = min(1.0, (C / 2 - 1) / max(1, ext)); ax, ay = C // 2, C // 2
        else:
            ext_w = max(px - L, R - px); ext_h = py - T; below = max(0, B - py)
            k = min(1.0, (C / 2 - 1) / max(1, ext_w), (C - 3 - below) / max(1, ext_h)); ax, ay = C // 2, C - 2 - round(below * min(1.0, k))
        idx = []
        for f in fr:
            im = f if k >= 1 else f.resize((max(1, round(f.width * k)), max(1, round(f.height * k))), Image.NEAREST)
            cell = Image.new('RGBA', (C, C), (0, 0, 0, 0))
            cell.alpha_composite(im, (ax - round(px * k), ay - round(py * k)))
            idx.append(len(cells[kind])); cells[kind].append(cell)
        e = round(min(1.0, 2 * max(px - L, R - px, (py - T) / (2 if kind == 'g' else 1)) * k / C), 3)
        table[name] = {'s': 'pfx' if kind == 'c' else 'pfxg', 'f': idx, 'e': e, 'fps': round(len(fr) / dur, 2), 'loop': bool(m['loop'])}
        print('  %-9s %-28s %2d fotogramas · escala %.2f' % (name, m['id'], len(fr), k))
    sheets = {}
    for kind, L in cells.items():
        C, cols = CELL[kind], COLS[kind]; rows = (len(L) + cols - 1) // cols
        im = Image.new('RGBA', (cols * C, rows * C), (0, 0, 0, 0))
        for i, c in enumerate(L): im.paste(c, ((i % cols) * C, (i // cols) * C))
        # Paleta de 64 colores (con su transparencia): el pixel art no la nota y el WebP sin pérdida ocupa mucho menos
        im = im.quantize(64, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).convert('RGBA')
        buf = io.BytesIO(); im.save(buf, 'WEBP', lossless=True, quality=100, method=6)
        sheets['pfx' if kind == 'c' else 'pfxg'] = dict(cols=cols, rows=rows, w=C, h=C, src='data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode())
        print('  hoja %-5s %dx%d · %d KB' % ('pfx' if kind == 'c' else 'pfxg', im.width, im.height, len(buf.getvalue()) // 1024))
    js = ['// Generado por tools/make_pfx.py (pixelfx · Patch y Hugo Duprez · MIT) — no editar a mano',
          'window.SPRITE_DATA = window.SPRITE_DATA || {};']
    for n, d in sheets.items(): js.append('window.SPRITE_DATA[%s] = %s;' % (json.dumps(n), json.dumps(d, separators=(',', ':'))))
    js.append('window.PFX_ANIMS = %s;' % json.dumps(table, separators=(',', ':')))
    path = os.path.join(ROOT, 'assets', 'pfx.js')
    open(path, 'w').write('\n'.join(js) + '\n')
    print('assets/pfx.js · %d KB' % (os.path.getsize(path) // 1024))


if __name__ == '__main__':
    if len(sys.argv) < 2: sys.exit(__doc__)
    build(sys.argv[1])
