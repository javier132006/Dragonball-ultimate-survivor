import sys
from PIL import Image; import numpy as np
from scipy import ndimage as nd
LO = {4: 135, 8: 70}
def mask(i, tol=16):
    a = np.array(Image.open(f's{i}.jpg').convert('RGB')).astype(int)
    mx, mn = a.max(2), a.min(2)
    bg = ((mx - mn) < tol) & (mn > LO.get(i, 150))
    lab, n = nd.label(bg)
    sizes = nd.sum(bg, lab, range(1, n + 1))
    big = np.zeros(n + 1, bool); big[1:] = sizes > 1200
    rem = big[lab]
    # halo: píxeles casi neutros y claros pegados al fondo
    soft = ((mx - mn) < 30) & (mn > LO.get(i, 150) - 30)
    for _ in range(2): rem |= nd.binary_dilation(rem) & soft
    return a, rem
if __name__ == '__main__':
    for i in range(1, 10):
        a, rem = mask(i)
        o = a.copy(); o[rem] = [255, 0, 255]
        Image.fromarray(o.astype(np.uint8)).save(f'm{i}.png')
