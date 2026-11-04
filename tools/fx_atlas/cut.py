"""Recorte de sprites sobre el ajedrez falso: modelo local del ajedrez + relleno desde el borde (4-conexo)"""
from PIL import Image; import numpy as np
from scipy import ndimage as nd
IM = {}
def img(i):
    if i not in IM: IM[i] = np.array(Image.open(f'f{i}.jpg').convert('RGB')).astype(float)
    return IM[i]
LV = {9: (178, 250), 10: (179, 250), 11: (76, 127), 12: (65, 104), 13: (68, 110), 14: (57, 89), 15: (58, 91), 16: (61, 97), 17: (73, 120)}
def levels(i): return LV[i]
def fit(L, cand, lo, hi):
    ys, xs = np.nonzero(cand)
    if len(xs) > 6000:
        sel = np.random.RandomState(1).choice(len(xs), 6000, replace=False); xs, ys = xs[sel], ys[sel]
    isHi = abs(L[ys, xs] - hi) < abs(L[ys, xs] - lo)
    best = (-1, None)
    for s in np.arange(11.2, 12.3, 0.05):
        for ox in np.arange(0, s, 1.0):
            px = np.floor((xs - ox) / s).astype(int)
            for oy in np.arange(0, s, 1.0):
                py = np.floor((ys - oy) / s).astype(int)
                m = (((px + py) & 1) == 1) == isHi
                sc = max(m.mean(), 1 - m.mean())
                if sc > best[0]: best = (sc, (s, ox, oy, m.mean() > 0.5))
    # refinamiento fino del desfase
    sc0, (s, ox, oy, pos) = best
    for dox in np.arange(-0.9, 1.0, 0.3):
        for doy in np.arange(-0.9, 1.0, 0.3):
            px = np.floor((xs - ox - dox) / s).astype(int); py = np.floor((ys - oy - doy) / s).astype(int)
            m = (((px + py) & 1) == 1) == isHi; sc = max(m.mean(), 1 - m.mean())
            if sc > best[0]: best = (sc, (s, ox + dox, oy + doy, m.mean() > 0.5))
    return best
def cut(i, box, tol=13, minc=40, frac=0.12):
    """Devuelve RGBA del recorte box=(x0,y0,x1,y1) con el fondo transparente y la puntuación del ajuste"""
    a = img(i); lo, hi = levels(i)
    x0, y0, x1, y1 = box
    A = a[y0:y1, x0:x1]; L = A.mean(2); sat = A.max(2) - A.min(2)
    cand = (sat < 16) & ((abs(L - lo) < tol) | (abs(L - hi) < tol))
    sc, (s, ox, oy, pos) = fit(L, cand, lo, hi)
    H, W = L.shape
    X, Y = np.meshgrid(np.arange(W), np.arange(H))
    par = ((np.floor((X - ox) / s).astype(int) + np.floor((Y - oy) / s).astype(int)) & 1) == 1
    if not pos: par = ~par
    model = np.where(par, hi, lo)
    # en las fronteras entre casillas el JPG mezcla: se acepta cualquiera de los dos niveles cerca del borde de casilla
    fx = ((X - ox) / s) % 1; fy = ((Y - oy) / s) % 1
    edge = (np.minimum(fx, 1 - fx) * s < 1.6) | (np.minimum(fy, 1 - fy) * s < 1.6)
    bgp = (sat < 18) & ((abs(L - model) < tol) | (edge & (L > lo - tol) & (L < hi + tol)))
    # relleno 4-conexo desde el borde del recorte
    lab, n = nd.label(bgp)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    rem = np.isin(lab, list(border))
    # halo: píxeles casi neutros del nivel del ajedrez pegados al fondo
    soft = (sat < 22) & (L > lo - tol - 6) & (L < hi + tol + 6)
    rem |= nd.binary_dilation(rem) & soft
    # casillas claras sueltas pegadas al sprite: se propaga el fondo por los grises del nivel alto (los sprites no los usan)
    hig = (sat < 16) & (abs(L - hi) < tol + 4)
    lab3, n3 = nd.label(hig)
    touch = np.unique(lab3[nd.binary_dilation(rem) & hig]); touch = touch[touch > 0]
    rem |= np.isin(lab3, touch)
    fgm = ~rem
    # solo el cuerpo principal (y trozos grandes cercanos): fuera los restos de casillas y bordes
    lab2, n2 = nd.label(fgm, structure=np.ones((3, 3)))
    if n2:
        sz = nd.sum(fgm, lab2, range(1, n2 + 1))
        big = sz.max()
        keep = np.zeros(n2 + 1, bool); keep[1:] = sz >= max(minc, big * frac)
        fgm = keep[lab2]
    rgba = np.dstack([A, fgm * 255]).astype(np.uint8)
    return rgba, sc

def addcut(i, box, tol=13, pad=18):
    """Efecto luminoso para dibujar en modo aditivo: se resta el ajedrez modelado (solo queda la luz del efecto).
    El ajedrez se ajusta en un margen alrededor de la casilla (por si el efecto la tapa entera)"""
    a = img(i); lo, hi = levels(i)
    x0, y0, x1, y1 = box
    X0, Y0, X1, Y1 = max(0, x0 - pad), max(0, y0 - pad), min(a.shape[1], x1 + pad), min(a.shape[0], y1 + pad)
    E = a[Y0:Y1, X0:X1]; LE = E.mean(2); satE = E.max(2) - E.min(2)
    cand = (satE < 16) & ((abs(LE - lo) < tol) | (abs(LE - hi) < tol))
    sc, (s, ox, oy, pos) = fit(LE, cand, lo, hi)
    H, W = LE.shape
    X, Y = np.meshgrid(np.arange(W), np.arange(H))
    par = ((np.floor((X - ox) / s).astype(int) + np.floor((Y - oy) / s).astype(int)) & 1) == 1
    if not pos: par = ~par
    model = np.where(par, hi, lo)[y0 - Y0:y1 - Y0, x0 - X0:x1 - X0, None]
    A = a[y0:y1, x0:x1]
    d = np.clip((A - model) * 255.0 / (255.0 - model), 0, 255)
    # restos neutros del ajedrez (bordes de casilla mal ajustados): fuera
    dm = d.max(2); dsat = d.max(2) - d.min(2)
    d[(dm < 60) & (dsat < 25)] = 0
    al = np.clip(d.max(2) / 70.0, 0, 1)
    h, w = al.shape; F = 6.0                                     # bordes suaves: sin cortes rectos de la casilla
    yy = np.minimum(np.arange(h), np.arange(h)[::-1])[:, None]; xx = np.minimum(np.arange(w), np.arange(w)[::-1])[None, :]
    al = al * np.clip(np.minimum(yy, xx) / F, 0, 1)
    # además, caída elíptica hacia las esquinas: las explosiones que llenan la casilla no dejan bordes rectos
    Y, X = np.mgrid[0:h, 0:w]; e = np.hypot((X - w / 2) / (w / 2), (Y - h / 2) / (h / 2))
    al = al * np.clip((1.12 - e) / 0.32, 0, 1)
    rgb = d / np.maximum(al[:, :, None], 1e-3)
    return np.dstack([np.clip(rgb, 0, 255), al * 255]).astype(np.uint8)
