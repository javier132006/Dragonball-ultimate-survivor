"""Hojas de personaje en ALTA RESOLUCIÓN (celdas de 216x158, el doble que las de make_chars.py) a partir de las
hojas nuevas f20..f37 (fondo de ajedrez casi negro). Se ven nítidas a 720p/1080p (el sprite ocupa ~130-195 px en pantalla).
Disposición (4 columnas):
  0 quieto · 1 caminar · 2 correr · 3 salto · 5 golpe · 8 herido · 9 dash · 10 rayo · 11 técnica · 12-14 muerte
  16+ extras. Las poses con aura de las hojas no se usan: el brillo translúcido deja ver el ajedrez (el aura la dibuja el juego)
Uso (en la carpeta con f20.jpg ... f37.jpg y f16.jpg): python3 tools/make_chars2.py SALIDA"""
import sys, os, json
from PIL import Image; import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fx_atlas'))
from cut import cut
CW, CH = 216, 158
def B(i, x0, y0, x1, y1, **o): return (i, (x0, y0, x1, y1), o)
# h: altura del personaje en píxeles (el quieto/caminar/correr se escalan a esa altura; el resto con la misma escala)
CHARS = {
 'krilin': dict(h=128, f={0: B(36, 36, 20, 171, 301), 1: B(36, 266, 24, 404, 296), 2: B(36, 499, 36, 694, 285), 3: B(36, 776, 14, 938, 301),
   5: B(36, 54, 428, 281, 690), 8: B(36, 1125, 71, 1353, 282), 9: B(36, 499, 36, 694, 285), 10: B(36, 54, 428, 281, 690), 11: B(36, 776, 14, 938, 301),
   12: B(36, 348, 429, 462, 690), 13: B(36, 462, 488, 670, 690), 14: B(36, 1112, 605, 1394, 708)}),
 'trunks': dict(h=146, f={0: B(20, 23, 39, 166, 305), 1: B(20, 255, 39, 405, 298), 2: B(20, 502, 50, 692, 288), 3: B(20, 778, 18, 937, 303),
   5: B(20, 1101, 176, 1221, 295, rel=2.2), 8: B(20, 55, 435, 243, 696), 9: B(20, 502, 50, 692, 288), 10: B(20, 1101, 176, 1221, 295, rel=2.2), 11: B(20, 1114, 412, 1250, 540, rel=2.2),
   12: B(20, 343, 422, 549, 618), 13: B(20, 466, 588, 688, 718), 14: B(20, 1115, 640, 1241, 708, rel=2.2)}),
 'trunks_ss': dict(h=146, f={0: B(21, 40, 246, 125, 398), 1: B(21, 225, 246, 310, 398), 2: B(21, 405, 253, 522, 390), 3: B(21, 594, 236, 690, 400),
   5: B(21, 1080, 255, 1224, 392), 8: B(21, 736, 251, 838, 350), 9: B(21, 405, 253, 522, 390), 10: B(21, 1080, 255, 1224, 392), 11: B(21, 1080, 255, 1224, 392),
   12: B(21, 736, 251, 838, 350), 13: B(21, 796, 317, 910, 398), 14: B(21, 796, 317, 910, 398)}),
 'gohan': dict(h=144, f={0: B(31, 8, 58, 120, 192), 1: B(31, 125, 58, 197, 192), 2: B(31, 220, 75, 315, 190), 3: B(31, 317, 55, 400, 192),
   5: B(31, 220, 75, 315, 190), 8: B(31, 425, 140, 553, 197), 9: B(31, 220, 75, 315, 190), 10: B(31, 317, 55, 400, 192), 11: B(31, 317, 55, 400, 192),
   12: B(31, 425, 140, 553, 197), 13: B(31, 425, 140, 553, 197), 14: B(31, 425, 140, 553, 197)}),
 'gohan_ss': dict(h=146, f={0: B(31, 52, 250, 121, 405), 1: B(31, 139, 253, 222, 405), 2: B(31, 233, 256, 302, 400), 3: B(31, 328, 248, 415, 395),
   5: B(31, 958, 280, 1040, 402, rel=1.3), 8: B(31, 429, 328, 541, 405), 9: B(31, 233, 256, 302, 400), 10: B(31, 1104, 286, 1180, 400, rel=1.3), 11: B(31, 958, 280, 1040, 402, rel=1.3),
   12: B(31, 429, 328, 541, 405), 13: B(31, 429, 328, 541, 405), 14: B(31, 429, 328, 541, 405)}),
 'gohan_ul': dict(h=150, f={0: B(31, 42, 520, 136, 712), 1: B(31, 211, 520, 310, 712), 2: B(31, 377, 527, 508, 690), 3: B(31, 377, 527, 508, 690),
   5: B(31, 958, 105, 1040, 208, rel=1.9), 8: B(31, 760, 489, 901, 560), 9: B(31, 377, 527, 508, 690), 10: B(31, 1100, 105, 1180, 208, rel=1.9), 11: B(31, 958, 105, 1040, 208, rel=1.9),
   12: B(31, 760, 489, 901, 560), 13: B(31, 735, 635, 884, 722), 14: B(31, 735, 635, 884, 722)}),
 'gohan_b': dict(h=150, f={0: B(37, 35, 7, 173, 306), 1: B(37, 264, 8, 407, 303), 2: B(37, 498, 15, 696, 289), 3: B(37, 770, 0, 943, 306),
   5: B(37, 1117, 435, 1190, 538, rel=2.9), 8: B(37, 38, 423, 244, 695), 9: B(37, 498, 15, 696, 289), 10: B(37, 1270, 431, 1345, 538, rel=2.9), 11: B(37, 1117, 435, 1190, 538, rel=2.9),
   12: B(37, 1098, 65, 1359, 296), 13: B(37, 500, 515, 674, 690), 14: B(37, 500, 515, 674, 690)}),
 'cell': dict(h=152, rows=5, f={0: B(34, 28, 508, 142, 715), 1: B(34, 197, 509, 308, 716), 2: B(34, 365, 518, 504, 687), 3: B(34, 560, 499, 686, 706),
   5: B(34, 955, 105, 1050, 212, rel=1.9), 8: B(34, 435, 126, 552, 190, rel=1.45), 9: B(34, 365, 518, 504, 687), 10: B(34, 1105, 105, 1180, 212, rel=1.9), 11: B(34, 955, 280, 1045, 400, rel=1.9),
   12: B(34, 435, 126, 552, 190, rel=1.45), 13: B(34, 428, 325, 548, 400, rel=1.45), 14: B(34, 428, 325, 548, 400, rel=1.45),
   # Célula Jr. (hoja antigua f16): escala propia
   16: B(16, 355, 445, 420, 500, abs=2.0), 17: B(16, 425, 445, 490, 500, abs=2.0), 18: B(16, 495, 445, 560, 500, abs=2.0), 19: B(16, 565, 445, 630, 500, abs=2.0)}),
}
def place(rgba, k):
    a = rgba[:, :, 3] > 0
    ys, xs = np.nonzero(a)
    h = ys.max() - ys.min() + 1
    low = ys > ys.min() + h * 0.6                         # centrado por las piernas (no se mueve al estirar el brazo)
    cx = np.median(xs[low]) if low.any() else (xs.min() + xs.max()) / 2
    im = Image.fromarray(rgba).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    cx -= xs.min()
    w2, h2 = max(1, round(im.width * k)), max(1, round(im.height * k))
    if h2 > CH - 1:                                       # poses con aura más altas que la celda: se encogen para caber
        f = (CH - 1) / h2; w2, h2 = max(1, round(w2 * f)), CH - 1; k *= f
    pm = np.array(im).astype(float); pm[:, :, :3] *= pm[:, :, 3:] / 255
    big = np.array(Image.fromarray(pm.astype(np.uint8)).resize((w2, h2), Image.LANCZOS)).astype(float)
    al = big[:, :, 3]; rgb = big[:, :, :3] / np.maximum(al[:, :, None], 1) * 255
    out = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), np.where(al > 110, 255, 0)]).astype(np.uint8))
    cell = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    px = round(CW / 2 - cx * k); py = CH - 1 - h2
    cell.paste(out, (px, py), out)
    return cell
if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True); meta = {}
    only = sys.argv[2:]
    for name, C in CHARS.items():
        if only and name not in only: continue
        rows = C.get('rows', 4)
        frames = {k: (cut(s[0], s[1], ol=2)[0], s[2]) for k, s in C['f'].items()}
        hs = [np.nonzero(frames[k][0][:, :, 3])[0] for k in (0, 1, 2) if k in frames]
        k = C['h'] / max(h.max() - h.min() + 1 for h in hs)
        sheet = Image.new('RGBA', (CW * 4, CH * rows), (0, 0, 0, 0))
        for idx, (fr, o) in frames.items():
            c = place(fr, o.get('abs', k * o.get('rel', 1))); sheet.paste(c, ((idx % 4) * CW, (idx // 4) * CH))
        sheet.save(os.path.join(out, name + '.png')); meta[name] = {'cols': 4, 'rows': rows, 'w': CW, 'h': CH}
        print(name, round(k, 3))
    json.dump(meta, open(os.path.join(out, 'chars.json'), 'w'))
