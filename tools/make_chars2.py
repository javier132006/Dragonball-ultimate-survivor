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

# ---------- Goku y Vegeta (hojas f22..f30). hh = altura final del fotograma en píxeles (poses sacadas de recuadros
# pequeños: golpe, rayo, herido, muerte) ----------
def P(i, box, hh=None):
    return B(i, *box, **({'hh': hh} if hh else {}))
def std(i, st, wk, rn, jp, atk, beam, hurt, d1, d2, h=148, rows=4, hi=None):
    a = 0.86 * h; j = hi or i                             # hi: hoja de la que salen herido/muerte (si la forma no los tiene)
    ha = None if atk == rn else a; hb = None if beam == rn else a      # si el golpe es la pose de correr, misma escala
    return dict(h=h, rows=rows, f={0: P(i, st), 1: P(i, wk), 2: P(i, rn), 3: P(i, jp), 5: P(i, atk, ha), 9: P(i, rn),
        10: P(i, beam, hb), 11: P(i, atk, ha), 8: P(j, hurt, 0.62 * h), 12: P(j, hurt, 0.62 * h), 13: P(j, d1, 0.45 * h), 14: P(j, d2, 0.42 * h)})
CHARS.update({
 'goku': std(29, (40, 58, 135, 196), (241, 59, 308, 192), (420, 76, 527, 187), (604, 42, 691, 194), (1249, 27, 1320, 138), (1249, 27, 1320, 138),
             (745, 68, 839, 152), (819, 123, 905, 201), (819, 123, 905, 201)),
 'goku_ss': std(26, (40, 44, 135, 196), (224, 250, 300, 392), (422, 49, 528, 189), (604, 40, 692, 196), (1249, 9, 1312, 138), (1249, 9, 1312, 138),
             (738, 49, 842, 154), (817, 118, 913, 196), (817, 118, 913, 196)),
 'goku_ss3': std(28, (15, 48, 165, 196), (409, 50, 527, 189), (409, 50, 527, 189), (560, 55, 690, 196), (409, 50, 527, 189), (560, 55, 690, 196),
             (738, 49, 842, 154), (817, 118, 913, 196), (817, 118, 913, 196), hi=26),
 'goku_ss4': std(28, (1099, 55, 1205, 192), (1099, 55, 1205, 192), (1254, 62, 1363, 192), (1254, 62, 1363, 192), (1084, 268, 1170, 392), (1084, 268, 1170, 392),
             (940, 53, 1046, 192), (740, 54, 844, 153), (740, 54, 844, 153)),
 'goku_god': std(30, (41, 502, 134, 714), (211, 504, 309, 715), (379, 515, 507, 685), (580, 500, 686, 704), (379, 515, 507, 685), (379, 515, 507, 685),
             (727, 257, 842, 352), (794, 324, 915, 402), (735, 633, 901, 712), h=152),
 'goku_blue': std(27, (11, 46, 156, 200), (379, 512, 507, 684), (379, 512, 507, 684), (379, 512, 507, 684), (379, 512, 507, 684), (379, 512, 507, 684),
             (737, 50, 843, 157), (767, 119, 923, 200), (767, 119, 923, 200)),
 'goku_ui': std(25, (41, 492, 136, 714), (207, 494, 307, 715), (371, 509, 507, 684), (579, 488, 687, 707), (371, 509, 507, 684), (371, 509, 507, 684),
             (737, 253, 839, 345), (760, 470, 895, 560), (735, 625, 895, 712), h=152),
 'vegeta': std(22, (28, 42, 125, 196), (214, 46, 308, 192), (403, 53, 527, 192), (604, 42, 684, 200), (1249, 15, 1320, 136), (1249, 15, 1320, 136),
             (741, 59, 842, 153), (786, 124, 913, 193), (786, 124, 913, 193), h=142),
 'vegeta_ss': std(22, (54, 244, 122, 400), (232, 236, 307, 396), (407, 246, 511, 390), (594, 236, 687, 397), (1100, 261, 1170, 393), (1242, 257, 1310, 392),
             (733, 257, 841, 349), (794, 317, 909, 395), (794, 317, 909, 395), h=144),
 'vegeta_god': std(24, (50, 40, 125, 196), (241, 41, 307, 191), (423, 47, 527, 190), (604, 34, 690, 196), (1091, 11, 1160, 135), (1091, 11, 1160, 135),
             (739, 55, 841, 136), (818, 125, 912, 196), (818, 125, 912, 196), h=142),
 'vegeta_blue': std(23, (55, 244, 125, 400), (230, 244, 306, 395), (406, 249, 510, 390), (600, 237, 687, 397), (1101, 259, 1170, 393), (1101, 259, 1170, 393),
             (735, 257, 841, 351), (794, 323, 917, 394), (794, 323, 917, 394), h=144),
 'vegeta_ue': std(24, (381, 501, 506, 683), (381, 501, 506, 683), (381, 501, 506, 683), (381, 501, 506, 683), (1116, 420, 1190, 543), (1116, 420, 1190, 543),
             (761, 471, 900, 561), (735, 620, 900, 720), (735, 620, 900, 720), h=148),
})
def unlabel(rgba):
    """Quita los rótulos de texto que se cuelan en el recorte (letras blancas cerca del borde de arriba o de abajo)"""
    from scipy import ndimage as nd
    a = rgba[:, :, 3] > 0; H = a.shape[0]
    lab, n = nd.label(a, structure=np.ones((3, 3)))
    if n < 2: return rgba
    sz = nd.sum(a, lab, range(1, n + 1)); big = int(np.argmax(sz)) + 1
    wh = rgba[:, :, :3].min(2) > 190
    out = rgba.copy()
    for k, sl in enumerate(nd.find_objects(lab), 1):
        if k == big: continue
        h = sl[0].stop - sl[0].start; m = lab[sl] == k
        if h < 34 and (sl[0].start > H * 0.72 or sl[0].stop < H * 0.2) and wh[sl][m].mean() > 0.15: out[sl][m] = 0
    return out
def unborder(rgba, n=16):
    """Quita las líneas oscuras del marco del recuadro (y el ajedrez pegado a ellas) en los bordes del recorte"""
    out = rgba.copy(); a = out[:, :, 3] > 0; dark = (out[:, :, :3].max(2) < 60) & a
    H, W = a.shape
    for xs in (range(min(n, W)), range(W - 1, max(W - 1 - n, -1), -1)):
        cut_to = None
        for x in xs:
            if dark[:, x].sum() > 0.45 * H: cut_to = x
        if cut_to is not None:
            sl = slice(0, cut_to + 1) if xs.start == 0 else slice(cut_to, W)
            out[:, sl, 3] = 0
    for ys in (range(min(n, H)), range(H - 1, max(H - 1 - n, -1), -1)):
        cut_to = None
        for y in ys:
            if dark[y].sum() > 0.45 * W: cut_to = y
        if cut_to is not None:
            sl = slice(0, cut_to + 1) if ys.start == 0 else slice(cut_to, H)
            out[sl, :, 3] = 0
    return out
def place(rgba, k):
    rgba = unlabel(unborder(rgba))
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
            kk = o['hh'] / (np.ptp(np.nonzero(fr[:, :, 3])[0]) + 1) if 'hh' in o else o.get('abs', k * o.get('rel', 1))
            c = place(fr, kk); sheet.paste(c, ((idx % 4) * CW, (idx // 4) * CH))
        sheet.save(os.path.join(out, name + '.png')); meta[name] = {'cols': 4, 'rows': rows, 'w': CW, 'h': CH}
        print(name, round(k, 3))
    json.dump(meta, open(os.path.join(out, 'chars.json'), 'w'))
