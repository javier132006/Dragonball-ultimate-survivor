"""Hojas de CARGA DE KI (pose de cargar con el aura de cada forma, sacada de las hojas nuevas f20..f37).
Celdas de 320x250 (más grandes que las del personaje porque el aura sobresale). El cuerpo se escala a la misma altura
que en su hoja normal y los pies quedan a FOOT píxeles del borde de abajo (el aura baja un poco por debajo de los pies).
En el juego: data.js -> FORM_CHG (qué fotograma usa cada forma). Uso: python3 tools/make_charge.py SALIDA"""
import sys, os, json
from PIL import Image; import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fx_atlas'))
from cut import glowcut
CW, CH, FOOT = 320, 250, 24
# nombre: (altura del cuerpo en px (la de su hoja normal), [(hoja, recuadro), ...])
# Cada fotograma: (hoja, recuadro, altura del cuerpo en el recuadro (pelo -> pies), fila de los pies en el recuadro).
# Medidas a mano: el aura tapa el contorno del cuerpo y no se puede medir de forma automática fiable
CHG = {
 'goku_chg': (148, [(29, (900, 470, 1100, 720), 173, 228), (26, (895, 450, 1105, 722), 175, 250),
                    (28, (0, 485, 180, 722), 205, 222), (28, (895, 460, 1105, 722), 162, 232), (30, (932, 512, 1095, 722), 140, 185),
                    (27, (0, 230, 165, 405), 150, 160), (25, (895, 460, 1110, 722), 160, 250),
                    (25, (925, 10, 1085, 198), 135, 165), (27, (900, 460, 1100, 722), 175, 245)]),
 'vegeta_chg': (144, [(22, (915, 215, 1070, 400), 130, 160), (22, (900, 450, 1105, 725), 180, 250), (24, (920, 30, 1085, 200), 125, 165),
                      (23, (912, 215, 1078, 395), 120, 165), (23, (895, 455, 1110, 725), 175, 255), (24, (900, 455, 1110, 725), 185, 255)]),
 'krilin_chg': (128, [(36, (770, 396, 1055, 718), 215, 300)]),
 'trunks_chg': (146, [(20, (737, 393, 1061, 718), 230, 300), (21, (915, 232, 1070, 398), 125, 150)]),
 'gohan_chg': (146, [(31, (561, 40, 738, 215), 115, 160), (31, (540, 465, 720, 705), 180, 230), (37, (744, 393, 1055, 722), 225, 305)]),
 'cell_chg': (152, [(34, (762, 82, 915, 213), 115, 125)]),
 'black_chg': (148, [(33, (750, 288, 905, 400), 85, 100), (32, (737, 92, 931, 215), 95, 115), (33, (525, 470, 734, 730), 170, 225)]),
 'freezer_chg': (140, [(35, (575, 70, 728, 215), 95, 125), (35, (560, 250, 730, 400), 105, 135), (35, (555, 520, 740, 720), 145, 178)]),
}
def place(rgba, h, bh, fy):
    a = rgba[:, :, 3] > 60; ys, xs = np.nonzero(a)                 # caja del aura visible (sin restos casi transparentes)
    k = h / bh
    im = Image.fromarray(rgba).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    b1 = fy - ys.min(); cx = (xs.min() + xs.max()) / 2 - xs.min()
    k = min(k, (CW - 2) / im.width, (CH - FOOT - 1) / max(1, b1 + 1))   # si no cabe en la celda, se encoge todo
    w2, h2 = max(1, round(im.width * k)), max(1, round(im.height * k))
    pm = np.array(im).astype(float); pm[:, :, :3] *= pm[:, :, 3:] / 255
    big = np.array(Image.fromarray(pm.astype(np.uint8)).resize((w2, h2), Image.LANCZOS)).astype(float)
    al = big[:, :, 3]; rgb = big[:, :, :3] / np.maximum(al[:, :, None], 1) * 255
    out = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), al]).astype(np.uint8))     # aura con transparencia suave
    cell = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    cell.paste(out, (round(CW / 2 - cx * k), round(CH - 1 - FOOT - b1 * k)), out)
    return cell, k
if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True); meta = {}
    for name, (h, frames) in CHG.items():
        cols = min(4, len(frames)); rows = (len(frames) + cols - 1) // cols
        sheet = Image.new('RGBA', (CW * cols, CH * rows), (0, 0, 0, 0))
        for k, (i, box, bh, fy) in enumerate(frames):
            c, sc = place(glowcut(i, box), h, bh, fy)
            if sc < h / bh - 1e-6: print('   ', name, k, 'no cabe: cuerpo a', round(bh * sc), 'px en vez de', h)
            sheet.paste(c, ((k % cols) * CW, (k // cols) * CH))
        sheet.save(os.path.join(out, name + '.png'))
        # hs: la celda es más alta que la normal (158 px) · anc: los pies van FOOT px por encima del borde
        meta[name] = {'cols': cols, 'rows': rows, 'w': CW, 'h': CH, 'hs': round(CH / 158, 4), 'anc': round((FOOT + 6) / CH, 4)}
        print(name, len(frames))
    json.dump(meta, open(os.path.join(out, 'chars.json'), 'w'))
