"""Recorte de sprites sobre el ajedrez falso: modelo local del ajedrez + relleno desde el borde (4-conexo)"""
from PIL import Image; import numpy as np
from scipy import ndimage as nd
IM = {}
def img(i):
    if i not in IM: IM[i] = np.array(Image.open(f'f{i}.jpg').convert('RGB')).astype(float)
    return IM[i]
LV = {9: (178, 250), 10: (179, 250), 11: (76, 127), 12: (65, 104), 13: (68, 110), 14: (57, 89), 15: (58, 91), 16: (61, 97), 17: (73, 120)}
def levels(i):
    """Niveles de gris de las dos casillas del ajedrez (las hojas nuevas se miden solas: dos picos del histograma de grises)"""
    if i not in LV:
        a = img(i); L = a.mean(2); s = a.max(2) - a.min(2)
        h, _ = np.histogram(L[(s < 16) & (L < 130)], bins=130, range=(0, 130)); h = np.convolve(h, np.ones(5) / 5, 'same')
        p1 = int(np.argmax(h)); h2 = h.copy(); h2[max(0, p1 - 25):p1 + 26] = 0; p2 = int(np.argmax(h2))
        LV[i] = tuple(sorted((p1, p2)))
    return LV[i]
def fit(L, cand, lo, hi, sizes=None):
    ys, xs = np.nonzero(cand)
    if len(xs) > 6000:
        sel = np.random.RandomState(1).choice(len(xs), 6000, replace=False); xs, ys = xs[sel], ys[sel]
    isHi = abs(L[ys, xs] - hi) < abs(L[ys, xs] - lo)
    best = (-1, None)
    if sizes is None: sizes = np.arange(11.2, 12.3, 0.05)
    for s in sizes:
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
def cut(i, box, tol=13, minc=40, frac=0.12, ol=0):
    """Devuelve RGBA del recorte box=(x0,y0,x1,y1) con el fondo transparente y la puntuación del ajuste.
    ol>0: hojas con casillas casi negras (el contorno negro del sprite se confunde con ellas): se recupera
    el contorno oscuro en ol píxeles alrededor de la figura"""
    a = img(i); lo, hi = levels(i)
    x0, y0, x1, y1 = box
    A = a[y0:y1, x0:x1]; L = A.mean(2); sat = A.max(2) - A.min(2)
    cand = (sat < 16) & ((abs(L - lo) < tol) | (abs(L - hi) < tol))
    sizes = None
    if lo < 12:
        # hojas nuevas: los recuadros pequeños tienen el ajedrez a otra escala; primero se busca el tamaño de casilla
        c0 = fit(L, cand, lo, hi, np.arange(4.5, 13.5, 0.25))[1][0]
        sizes = np.arange(c0 - 0.3, c0 + 0.31, 0.05)
    sc, (s, ox, oy, pos) = fit(L, cand, lo, hi, sizes)
    H, W = L.shape
    X, Y = np.meshgrid(np.arange(W), np.arange(H))
    par = ((np.floor((X - ox) / s).astype(int) + np.floor((Y - oy) / s).astype(int)) & 1) == 1
    if not pos: par = ~par
    model = np.where(par, hi, lo)
    # en las fronteras entre casillas el JPG mezcla: se acepta cualquiera de los dos niveles cerca del borde de casilla
    fx = ((X - ox) / s) % 1; fy = ((Y - oy) / s) % 1
    ex, ey = np.minimum(fx, 1 - fx) * s < 1.6, np.minimum(fy, 1 - fy) * s < 1.6
    strict = lo < 12        # hojas con casillas casi negras: el gris oscuro del sprite (alas, ropa) se parece a la casilla clara
    if not strict:
        bgp = (sat < 18) & ((abs(L - model) < tol) | ((ex | ey) & (L > lo - tol) & (L < hi + tol)))
    else:
        # solo se acepta la mezcla del borde de casilla si a los dos lados (±2 px) hay ajedrez de verdad:
        # así el fondo no se cuela por una zona gris del sprite que solo coincide con las casillas claras
        m0 = (sat < 16) & (abs(L - model) < tol)
        sh = lambda m, dx, dy: np.roll(np.roll(m, dy, 0), dx, 1)
        okx = sh(m0, 2, 0) & sh(m0, -2, 0); oky = sh(m0, 0, 2) & sh(m0, 0, -2)
        bgp = m0 | ((sat < 18) & (L > lo - tol) & (L < hi + tol) & ((ex & okx) | (ey & oky)))
    # relleno 4-conexo desde el borde del recorte
    lab, n = nd.label(bgp)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    rem = np.isin(lab, list(border))
    if strict and n:
        # huecos cerrados (entre las piernas, bajo el brazo): son fondo si tienen casillas de los DOS colores
        # (una zona gris del sprite solo coincide con las claras)
        # casillas completas: el 85% de sus píxeles calcan el ajedrez (una textura del sprite no encaja así en la rejilla)
        qx = np.floor((X - ox) / s).astype(int); qy = np.floor((Y - oy) / s).astype(int)
        sid = (qy - qy.min()) * (qx.max() - qx.min() + 1) + (qx - qx.min())
        tot = np.bincount(sid.ravel()); hit = np.bincount(sid.ravel(), weights=m0.ravel())
        full = ((hit / np.maximum(tot, 1)) >= 0.85) & (tot >= 0.7 * s * s)
        fp = full[sid]
        on = nd.sum(fp & par, lab, range(1, n + 1)); off = nd.sum(fp & ~par, lab, range(1, n + 1))
        # o hueco pequeño (una o dos casillas entre el brazo y el cuerpo) que calca el ajedrez casi por completo
        cnt = nd.sum(np.ones_like(L), lab, range(1, n + 1)); mt = nd.sum(m0, lab, range(1, n + 1))
        hole = ((on > 0) & (off > 0)) | ((cnt >= 0.35 * s * s) & (mt >= 0.85 * cnt))
        rem |= np.isin(lab, np.nonzero(hole)[0] + 1)
    # halo: píxeles casi neutros del nivel del ajedrez pegados al fondo
    soft = (sat < 22) & (L > lo - tol - 6) & (L < hi + tol + 6) if not strict else (sat < 12) & (abs(L - model) < tol + 8)
    rem |= nd.binary_dilation(rem) & soft
    # casillas claras sueltas pegadas al sprite: se propaga el fondo por los grises del nivel alto (los sprites no los usan)
    if not strict:
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
    if ol:
        fgm |= nd.binary_dilation(fgm, iterations=ol) & (L < lo + 30)
    if strict:
        # agujeritos sueltos dentro de la figura (ruido del JPG): se rellenan
        hl = nd.binary_fill_holes(fgm) & ~fgm
        lh, nh = nd.label(hl)
        if nh:
            sz = nd.sum(hl, lh, range(1, nh + 1))
            fgm |= np.isin(lh, np.nonzero(sz < 0.5 * s * s)[0] + 1)
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
    sizes = None
    if lo < 12:                                                   # hojas nuevas (ajedrez casi negro, casilla de otro tamaño)
        c0 = fit(LE, cand, lo, hi, np.arange(4.5, 13.5, 0.25))[1][0]
        sizes = np.arange(c0 - 0.3, c0 + 0.31, 0.05)
    sc, (s, ox, oy, pos) = fit(LE, cand, lo, hi, sizes)
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
