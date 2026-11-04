"""Hojas de personaje jugable (celdas de 108x79, 4 columnas, como goku_a/vegeta) a partir de las hojas f11..f17.
Disposición: 0 quieto · 1-4 y 6-7 caminar · 5 golpe · 8 herido · 9 dash · 10 rayo · 11 técnica · 12-14 muerte · 15 extra
(16+ extras: Célula Jr.). Uso (en la carpeta con f11.jpg ... f17.jpg): python3 tools/make_chars.py SALIDA"""
import sys, os, json
from PIL import Image; import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fx_atlas'))
from cut import cut
CW, CH = 108, 79
def B(i, x0, y0, x1, y1, **o): return (i, (x0, y0, x1, y1), o)
CHARS = {
 'trunks': dict(h=76, f={0: B(17, 848, 53, 912, 130), 1: B(17, 496, 53, 560, 130), 2: B(17, 566, 53, 630, 130), 3: B(17, 636, 53, 701, 130),
   4: B(17, 707, 53, 771, 130), 6: B(17, 777, 53, 842, 130), 5: B(17, 566, 304, 630, 370), 8: B(17, 848, 53, 912, 130), 9: B(17, 496, 411, 560, 484),
   10: B(17, 496, 163, 560, 239), 11: B(17, 496, 304, 560, 370), 12: B(13, 1194, 53, 1258, 130), 13: B(13, 1264, 53, 1328, 130), 14: B(13, 1334, 53, 1404, 130)}),
 'freezer': dict(h=72, f={0: B(12, 3, 659, 67, 733), 1: B(17, 496, 553, 560, 629), 2: B(17, 566, 553, 630, 629), 3: B(17, 636, 553, 701, 629),
   5: B(17, 707, 553, 771, 629), 8: B(12, 144, 659, 208, 733), 9: B(17, 566, 659, 630, 724), 10: B(17, 777, 553, 822, 629), 11: B(17, 496, 659, 560, 724),
   12: B(12, 214, 659, 279, 733), 13: B(12, 355, 659, 419, 733), 14: B(12, 496, 659, 560, 733)}),
 'piccolo': dict(h=77, f={0: B(17, 214, 553, 279, 629), 1: B(17, 285, 553, 349, 629), 2: B(11, 1024, 671, 1074, 746), 3: B(11, 1097, 670, 1162, 746),
   4: B(17, 144, 553, 208, 629), 5: B(11, 953, 670, 1018, 746), 8: B(17, 395, 553, 443, 629), 9: B(11, 566, 553, 631, 629), 10: B(11, 707, 553, 771, 629),
   11: B(11, 496, 562, 560, 629), 12: B(17, 12, 671, 67, 733), 13: B(17, 73, 671, 138, 733), 14: B(17, 144, 671, 208, 733)}),
 'gohan': dict(h=74, f={0: B(14, 132, 53, 207, 130), 1: B(14, 213, 53, 294, 130), 2: B(14, 295, 53, 372, 130), 3: B(14, 378, 53, 454, 130),
   4: B(14, 460, 53, 536, 130), 6: B(14, 542, 53, 618, 130), 7: B(14, 624, 53, 701, 130), 5: B(14, 6, 192, 66, 264), 8: B(14, 132, 53, 207, 130),
   9: B(14, 460, 53, 536, 130), 10: B(14, 566, 186, 626, 263), 11: B(14, 3, 305, 64, 382)}),
 'gohan_u': dict(h=76, f={0: B(15, 849, 53, 913, 130), 1: B(15, 919, 53, 982, 130), 2: B(15, 988, 53, 1052, 130), 3: B(15, 1058, 53, 1119, 130),
   4: B(15, 1125, 53, 1189, 130), 6: B(15, 1195, 53, 1259, 130), 7: B(15, 1265, 53, 1329, 130), 5: B(15, 718, 417, 760, 488), 8: B(15, 849, 53, 913, 130),
   9: B(15, 789, 186, 853, 258), 10: B(15, 718, 305, 771, 381), 11: B(15, 718, 186, 783, 258)}),
 'cell': dict(h=78, rows=5, f={0: B(14, 848, 53, 918, 130), 1: B(14, 918, 53, 988, 130), 2: B(14, 988, 53, 1058, 130), 3: B(14, 1058, 53, 1128, 130),
   4: B(14, 1128, 53, 1198, 130), 6: B(14, 1198, 53, 1268, 130), 7: B(14, 1268, 53, 1338, 130), 5: B(16, 718, 305, 771, 381), 8: B(16, 1264, 305, 1328, 381),
   9: B(17, 1124, 304, 1188, 381), 10: B(16, 848, 411, 912, 487), 11: B(16, 1124, 305, 1187, 381),
   16: B(16, 355, 445, 420, 500), 17: B(16, 425, 445, 490, 500), 18: B(16, 495, 445, 560, 500), 19: B(16, 565, 445, 630, 500)}),
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
    pm = np.array(im).astype(float); pm[:, :, :3] *= pm[:, :, 3:] / 255
    big = np.array(Image.fromarray(pm.astype(np.uint8)).resize((w2, h2), Image.LANCZOS)).astype(float)
    al = big[:, :, 3]; rgb = big[:, :, :3] / np.maximum(al[:, :, None], 1) * 255
    out = np.dstack([np.clip(rgb, 0, 255), np.where(al > 110, 255, 0)]).astype(np.uint8); out[out[:, :, 3] == 0] = 0
    cell = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    px = round(CW / 2 - cx * k); py = CH - 1 - h2
    cell.alpha_composite(Image.fromarray(out), (max(-w2, min(CW, px)), max(0, py))) if px >= 0 and px + w2 <= CW else cell.paste(Image.fromarray(out), (px, py), Image.fromarray(out))
    return cell
out = sys.argv[1]; os.makedirs(out, exist_ok=True); meta = {}
for name, C in CHARS.items():
    rows = C.get('rows', 4)
    frames = {k: cut(s[0], s[1])[0] for k, s in C['f'].items()}
    hs = [np.nonzero(frames[k][:, :, 3])[0] for k in (0, 1, 2) if k in frames]
    k = C['h'] / max(h.max() - h.min() + 1 for h in hs)
    sheet = Image.new('RGBA', (CW * 4, CH * rows), (0, 0, 0, 0))
    for idx, fr in frames.items():
        c = place(fr, k); sheet.paste(c, ((idx % 4) * CW, (idx // 4) * CH))
    sheet.save(os.path.join(out, name + '.png')); meta[name] = {'cols': 4, 'rows': rows, 'w': CW, 'h': CH}
    print(name, round(k, 3))
json.dump(meta, open(os.path.join(out, 'chars.json'), 'w'))
