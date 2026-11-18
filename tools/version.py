"""Pone la versión del juego en index.html (window.V y los ?v= de las etiquetas fijas).

Uso:  python3 tools/version.py        (antes de cada commit que cambie js/ o assets/)

La versión es una huella de 8 caracteres de todos los archivos de js/ y assets/: si no cambia nada, sale
la misma; si cambia cualquier archivo, sale otra. Como va en la dirección de cada script (archivo.js?v=...),
el navegador descarga lo nuevo tras una actualización en lugar de usar el de su caché, sin forzar la recarga."""
import hashlib, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def huella():
    h = hashlib.sha1()
    for d in ('js', 'assets'):
        for base, dirs, files in sorted(os.walk(os.path.join(ROOT, d))):
            dirs.sort()
            for f in sorted(files):
                p = os.path.join(base, f)
                h.update(os.path.relpath(p, ROOT).encode()); h.update(open(p, 'rb').read())
    return h.hexdigest()[:8]

def main():
    v = huella(); p = os.path.join(ROOT, 'index.html')
    s = open(p, encoding='utf-8').read()
    n = s
    n = re.sub(r"window\.V = '[^']*';", "window.V = '%s';" % v, n, count=1)
    n = re.sub(r'((?:src|href)="(?:js/[^"?]+\.js|assets/load/atlas\.webp))(?:\?v=[^"]*)?"', r'\1?v=%s"' % v, n)
    if n != s: open(p, 'w', encoding='utf-8').write(n)
    print('versión', v, '(sin cambios)' if n == s else '(index.html actualizado)')

if __name__ == '__main__':
    main()
