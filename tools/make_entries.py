"""Crea las hojas de animación de entrada de cada guerrero (assets/entry/<id>.webp).

Uso:  python3 tools/make_entries.py CARPETA
  CARPETA contiene las hojas de ChatGPT (4×4 fotogramas sobre fondo negro, ~1672×941) con el nombre
  del archivo que aparece en MAPA (solo el principio del nombre).

Pasos: se corta cada hoja en 4×4 (con 4 px de margen para no coger el borde del vecino).
Cada fotograma se reduce a 400×225 y todo se guarda como una hoja 4×4 de 1600×900 en WebP (~200 KB)."""
import os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FW, FH = 400, 225

# Principio del nombre del archivo -> id del personaje (js/data.js y js/packdata.js)
MAPA = {
    '9026a83e': 'goku', '7002e9b0': 'vegeta', '4139412d': 'freezer', '67cb7f77': 'cell',
    '1dacfa93': 'janemba', 'b919aa17': 'trunks', '841b87c9': 'zamasuf', 'c69d7b4f': 'broly',
    'b602e4d8': 'gohan', '3ba60416': 'jiren', 'cd2089b6': 'raditz', '3e2c4582': 'krilin',
    '951cdcea': 'piccolo', '1381d3d2': 'kefla', 'a041e2f9': 'bardock', '1299282a': 'turles',
    '2cf59cfc': 'majin', 'bd89b043': 'caulifla', 'd18fde22': 'cooler', 'b5018293': 'saibaman',
    '0504d72d': 'gotenks', 'cee3060a': 'hitto', '4ef0984d': 'andro18',
    '97c75a9c': 'bills', 'e671a50c': 'black', 'aa91a131': 'gogeta', 'e2df1c00': 'vegito',
    'f4cf2b97': 'andro16', '30b95ee0': 'superbuu', 'a39edb35': 'kale', '8a4fb2bc': 'dabura',
    '707bb84d': 'ginyu', '7ccccf48': 'yamcha', '3b1f5f49': 'gohanf', 'c2ed01c4': 'gohankid',
    '6993a0cf': 'kyabe', '1d6ef488': 'babyv', '0fb32673': 'kamba', '14febafa': 'gotenss5',
}

def frame(a, r, c):
    H, W = a.shape[:2]
    y0, y1 = round(r * H / 4) + 4, round((r + 1) * H / 4) - 4
    x0, x1 = round(c * W / 4) + 4, round((c + 1) * W / 4) - 4
    f = a[y0:y1, x0:x1]
    return Image.fromarray(f).resize((FW, FH), Image.LANCZOS)

def main(src):
    out = os.path.join(ROOT, 'assets', 'entry'); os.makedirs(out, exist_ok=True)
    files = os.listdir(src); done = []
    for pre, cid in MAPA.items():
        fn = next((f for f in files if f.startswith(pre)), None)
        if not fn: print('falta', cid); continue
        a = np.asarray(Image.open(os.path.join(src, fn)).convert('RGB'))
        sheet = Image.new('RGB', (FW * 4, FH * 4))
        for k in range(16): sheet.paste(frame(a, k // 4, k % 4), ((k % 4) * FW, (k // 4) * FH))
        p = os.path.join(out, cid + '.webp'); sheet.save(p, 'WEBP', quality=86, method=6)
        done.append(cid)
    tot = sum(os.path.getsize(os.path.join(out, c + '.webp')) for c in done)
    print(len(done), 'hojas ·', tot // 1024, 'KB')
    print("const ENTRY_IDS = ['" + "', '".join(sorted(done)) + "'];")

if __name__ == '__main__':
    main(sys.argv[1])
