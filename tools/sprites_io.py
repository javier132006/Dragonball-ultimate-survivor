"""Lectura y escritura de assets/sprites.js, el ÚNICO archivo de imágenes del juego.
Cada hoja va dentro en base64 como WebP sin pérdida (un 25% menos que PNG, los mismos píxeles exactos), así no hace
falta guardar los .png aparte. Las herramientas (make_sprites.py, make_zip.py + install_chars.py, fx_atlas/install.py)
usan este módulo para añadir o sustituir hojas sin tocar las demás.

  load()                 -> (sheets, anims): sheets = {nombre: {'cols','rows','w','h','src'}}, anims = texto de FX_ANIMS
  put(sheets, n, im, m)  -> mete/sustituye la hoja n (imagen PIL RGBA, m = {'cols','rows','w','h'})
  save(sheets, anims)    -> escribe assets/sprites.js
  image(sheets, n)       -> la hoja n como imagen PIL (para revisarla o reutilizarla)
  python3 tools/sprites_io.py extraer CARPETA   -> guarda todas las hojas como .png en CARPETA (para verlas)"""
import base64, io, json, os, re, sys
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS = os.path.join(ROOT, 'assets', 'sprites.js')

def load():
    sheets, anims = {}, 'window.FX_ANIMS = {};'
    if not os.path.exists(JS): return sheets, anims
    for line in open(JS, encoding='utf-8'):
        m = re.match(r'window\.SPRITE_DATA\[("[^"]+")\] = (.*);\s*$', line)
        if m: sheets[json.loads(m.group(1))] = json.loads(m.group(2))
        elif line.startswith('window.FX_ANIMS'): anims = line.rstrip('\n')
    return sheets, anims

def encode(im):
    """Imagen -> data URL WebP sin pérdida (exact: conserva el color de los píxeles transparentes, no cambia nada)"""
    o = io.BytesIO(); im.convert('RGBA').save(o, 'WEBP', lossless=True, quality=100, method=6, exact=True)
    return 'data:image/webp;base64,' + base64.b64encode(o.getvalue()).decode()

def put(sheets, name, im, m):
    sheets[name] = dict(m, src=encode(im))

def image(sheets, name):
    src = sheets[name]['src']
    return Image.open(io.BytesIO(base64.b64decode(src.split(',', 1)[1]))).convert('RGBA')

def save(sheets, anims):
    lines = ['// Generado por tools/sprites_io.py — no editar a mano (hojas en WebP sin pérdida, base64)',
             'window.SPRITE_DATA = window.SPRITE_DATA || {};']
    for n, m in sheets.items():
        lines.append('window.SPRITE_DATA[%s] = %s;' % (json.dumps(n), json.dumps(m)))
    lines.append(anims)
    open(JS, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    return os.path.getsize(JS)

if __name__ == '__main__' and len(sys.argv) > 2 and sys.argv[1] == 'extraer':
    S, _ = load(); os.makedirs(sys.argv[2], exist_ok=True)
    for n in S: image(S, n).save(os.path.join(sys.argv[2], n + '.png'))
    print(len(S), 'hojas en', sys.argv[2])
