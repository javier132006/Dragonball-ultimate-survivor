"""Copia tu propia música y voces de narrador a assets/local/ (carpeta fuera de git) y escribe su índice.

Uso:  python3 tools/audio_local.py <carpeta con los audios>
      p. ej. la carpeta media/ de tu copia de Z Legends 3 (assets/www/media)

- Música: busca los archivos por su nombre (tabla MUSICA) y los copia a assets/local/musica/.
  Los temas de personaje (TEMAS) suenan cuando ese luchador está en el combate del Versus y también
  entran en la lista general de combate.
- Narrador: copia narrador_*.ogg a assets/local/narrador/ (sin el prefijo).
- Escribe assets/local/local.json, que es lo que lee el juego (js/localaudio.js).
Lo que no encuentre se queda con el sonido sintetizado del juego. assets/local/ está en .gitignore:
estos archivos no se suben al repositorio."""
import json, os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'local')

# papel en el juego -> patrón del nombre del archivo (sin distinguir mayúsculas)
MUSICA = {
    'menu': r'^main menu theme\.ogg$',
    'seleccion': r'^character-selection-theme\.ogg$',
    'victoria': r'^results-_victory-theme\.ogg$',
    'torre': r'^tournament_theme\.ogg$',
}
# luchadores (ids de Z Legends 3) -> patrón de su tema
TEMAS = {
    ('gogetassj4',): r'gogeta \(ssj4\) theme',
    ('gogetablue',): r'gogeta blues theme',
    ('baby',): r'super baby 2s theme',
    ('gokuui',): r'ultra instinct gokus theme',
    ('brolydbs', 'brolyz'): r'brolys theme',
    ('hit',): r'hits theme',
    ('zamasu',): r'zamasus theme',
    ('vegettoblue',): r'vegito blues theme',
}


def main():
    if len(sys.argv) < 2 or not os.path.isdir(sys.argv[1]):
        print(__doc__); sys.exit(1)
    src = sys.argv[1]; files = sorted(os.listdir(src))
    find = lambda pat: next((f for f in files if re.search(pat, f, re.I)), None)
    os.makedirs(os.path.join(OUT, 'musica'), exist_ok=True); os.makedirs(os.path.join(OUT, 'narrador'), exist_ok=True)

    def copia(f, sub, name):
        shutil.copyfile(os.path.join(src, f), os.path.join(OUT, sub, name)); return name

    mus = {}
    for k, pat in MUSICA.items():
        f = find(pat)
        if f: mus[k] = copia(f, 'musica', k + '.ogg')
    temas, combate = {}, []
    for ids, pat in TEMAS.items():
        f = find(pat)
        if not f: continue
        n = copia(f, 'musica', 'tema_' + ids[0] + '.ogg'); combate.append(n)
        for i in ids: temas[i] = n
    mus['temas'] = temas; mus['combate'] = combate

    narr = []
    for f in files:
        m = re.match(r'^narrador_(.+)\.ogg$', f, re.I)
        if m: narr.append(copia(f, 'narrador', m.group(1).lower() + '.ogg')[:-4])

    json.dump({'musica': mus, 'narrador': narr}, open(os.path.join(OUT, 'local.json'), 'w'), ensure_ascii=False, indent=1)
    print('Música:', ', '.join(k for k in MUSICA if k in mus) or '-', '| temas:', len(combate), '| narrador:', len(narr), 'voces')
    print('Listo en', OUT)


if __name__ == '__main__':
    main()
