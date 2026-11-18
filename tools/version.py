"""Pone la versión de cada archivo del juego para que el navegador descargue lo nuevo tras una actualización.

Uso:  python3 tools/version.py        (antes de cada commit que cambie js/ o assets/)

- Calcula una huella de 8 caracteres de cada archivo de js/ y assets/ y las guarda en js/assetver.js
  (window.AV = {'assets/entry/goku.webp': 'a1b2c3d4', ...}). El juego pide cada archivo como
  ruta?v=huella con av(ruta): si un archivo no cambia, su dirección tampoco, y sigue saliendo de la caché.
- window.V (index.html) es la huella de js/assetver.js: cambia en cuanto cambia cualquier archivo y sirve
  para la propia lista y como respaldo.
- En index.html actualiza también las direcciones fijas: etiquetas <script>/<link> de js/ y assets/load,
  y los url(assets/...) del CSS."""
import hashlib, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIST = os.path.join('js', 'assetver.js')

def huella(p):
    return hashlib.sha1(open(os.path.join(ROOT, p), 'rb').read()).hexdigest()[:8]

def archivos():
    out = []
    for d in ('js', 'assets'):
        for base, dirs, files in os.walk(os.path.join(ROOT, d)):
            dirs.sort()
            for f in sorted(files):
                p = os.path.relpath(os.path.join(base, f), ROOT).replace(os.sep, '/')
                if p != LIST: out.append(p)
    return sorted(out)

def main():
    av = {p: huella(p) for p in archivos()}
    txt = ('// Generado por tools/version.py: huella de cada archivo (la dirección cambia solo si cambia el archivo)\n'
           'window.AV = ' + json.dumps(av, separators=(',', ':')) + ';\n')
    lp = os.path.join(ROOT, LIST)
    if not os.path.exists(lp) or open(lp, encoding='utf-8').read() != txt: open(lp, 'w', encoding='utf-8').write(txt)
    v = huella(LIST)
    p = os.path.join(ROOT, 'index.html'); s = open(p, encoding='utf-8').read(); n = s
    n = re.sub(r"window\.V = '[^']*';", "window.V = '%s';" % v, n, count=1)
    def tag(m):
        path = m.group(2); h = v if path == LIST else av.get(path)
        return m.group(1) + path + ('?v=' + h if h else '') + '"'
    n = re.sub(r'((?:src|href)=")((?:js|assets)/[^"?]+)(?:\?v=[^"]*)?"', tag, n)
    def css(m):
        path = m.group(1); h = av.get(path)
        return 'url(' + path + ('?v=' + h if h else '') + ')'
    n = re.sub(r'url\((assets/[^)?]+)(?:\?v=[^)]*)?\)', css, n)
    if n != s: open(p, 'w', encoding='utf-8').write(n)
    print('versión', v, '·', len(av), 'archivos ·', '(sin cambios)' if n == s else '(index.html actualizado)')

if __name__ == '__main__':
    main()
