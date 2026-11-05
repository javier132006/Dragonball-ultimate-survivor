"""Hojas de personaje, jefe y enemigo a partir de los sprites sueltos del pack «Dragon Ball Sagas» (un PNG/GIF por
fotograma, fondo de un solo color). Los sprites se guardan a su tamaño original (pixel art, sin reescalar) y el juego
los dibuja con el mismo tamaño de píxel para todos: 52,3 píxeles de la hoja = 3,6 unidades del mundo (hs/anc en la meta).

Uso: python3 tools/make_zip.py "CARPETA/Dragon Ball Sagas" SALIDA
Salida: SALIDA/<hoja>.png + SALIDA/chars.json (meta) + SALIDA/credits.json (autores de cada carpeta usada).
Instalar: python3 tools/install_chars.py SALIDA  (y las de jefes/enemigos se pegan en sus hojas con -bosses)"""
import sys, os, re, glob, json
from PIL import Image; import numpy as np
from scipy import ndimage as nd

REF = 52.3                 # píxeles de la hoja que ocupan la altura base del sprite del jugador (3,6 unidades)
ROOT = sys.argv[1] if len(sys.argv) > 1 else '.'

# Disposición de las hojas de personaje (igual que A_HD en data.js):
# 0 quieto · 1-2 caminar · 5 golpe · 8 herido · 9 dash · 10 rayo · 11 técnica · 12-14 muerte
def F(folder, idle, walk, atk, beam, crit, hurt, dash, death):
    return dict(folder=folder, f={0: idle, 1: walk[0], 2: walk[1], 3: idle, 5: atk, 8: hurt, 9: dash, 10: beam, 11: crit,
                                   12: death[0], 13: death[1], 14: death[2]})
G = 'GOKU fases/'; V = 'VEGETA fases/'; GB = 'GOKU BLACK formas/'; GH = 'GOHAN fases/'; FZ = 'FREEZA formas/'
TR = 'MIRAI TRUNKS fases/'; CE = 'CELL formas/'
VG = 'VEGITO fases/'; BR = 'BROLY fases/'; BD = 'BARDOCK fases/'
# Recoloreados (formas que el pack no trae): tono exacto del pelo/aura -> tono nuevo, tomados de otros sprites del pack
_HL = [(249, 245, 199), (255, 255, 204), (242, 242, 200)]; _HM = [(242, 190, 48), (255, 200, 62), (234, 168, 68)]; _HD = [(178, 110, 21), (185, 114, 49), (191, 119, 19)]
_AURA = [(250, 175, 37), (255, 226, 66), (255, 252, 210)]
def _pal(light, mid, dark, eyes=None, aura=None):
    m = {c: light for c in _HL}; m.update({c: mid for c in _HM}); m.update({c: dark for c in _HD})
    if eyes: m[(1, 191, 150)] = eyes
    if aura: m.update(dict(zip(_AURA, aura)))
    return m
RECOLOR = {
 'base': _pal((70, 62, 86), (38, 32, 48), (16, 12, 22), (40, 40, 48), [(190, 205, 240), (228, 236, 255), (255, 255, 255)]),   # pelo negro (Goku/Vegetto base) y aura blanca
 'ss2': _pal((255, 255, 232), (255, 228, 96), (222, 160, 44)),                                                                  # dorado más brillante
 'blue': _pal((170, 244, 250), (64, 205, 218), (0, 120, 146), (0, 160, 200), [(30, 140, 225), (80, 200, 250), (205, 245, 255)]),  # paleta de Vegetto Blue
}
def recolor(r, name):
    if not name: return r
    r = r.copy(); m = RECOLOR[name]
    for src, dst in m.items(): r[(r[:, :, :3] == src).all(2), :3] = dst
    return r
SHEETS = {
 'goku': F(G + 'Goku', 11, (12, 13), 25, 70, 31, 41, 16, (42, 43, 47)),
 'goku_kk': F(G + 'Goku kaioken', 7, (8, 9), 33, 53, 24, 39, 11, (46, 48, 51)),
 'goku_ss': F(G + 'Goku SSJ 1', 1, (2, 3), 10, 41, 16, 29, 5, (29, 30, 33)),
 'goku_ss2': F(G + 'Goku SSJ 2', 8, (9, 10), 16, 55, 22, 38, 14, (38, 39, 42)),
 'goku_ss3': F(G + 'Goku SSJ 3', 1, (2, 3), 10, 47, 17, 29, 5, (29, 30, 33)),
 'goku_ss4': F(G + 'Goku SSJ 4', 3, (4, 5), 24, 69, 20, 51, 8, (51, 52, 57)),
 'goku_god': F(G + 'Goku God', 3, (4, 5), 33, 87, 39, 69, 32, (69, 70, 76)),
 'goku_blue': F(G + 'Goku Blue', 15, (16, 17), 44, 112, 75, 84, 47, (84, 85, 88)),
 'goku_bkk': F(G + 'Goku Blue Kaioken Whis Gi', 3, (4, 5), 18, 104, 44, 53, 8, (58, 62, 63)),
 'goku_sign': F(G + 'Goku Instinto Superior', 10, (11, 12), 48, 80, 62, 72, 19, (73, 74, 75)),
 'goku_ui': F(G + 'Goku Instinto Superior Completo', 10, (11, 12), 20, 45, 25, 36, 14, (37, 38, 47)),
 'vegeta': F(V + 'Vegeta Sayajin Saga', 1, (2, 3), 10, 40, 17, 28, 6, (28, 29, 31)),
 'vegeta_ss': F(V + 'Vegeta Saga Buu SSJ', 1, (2, 3), 10, 48, 17, 28, 6, (28, 29, 33)),
 'vegeta_grade': F(V + 'Vegeta Ssj Grade', 8, (9, 10), 12, 74, 21, 45, 15, (45, 46, 54)),
 'vegeta_majin': F(V + 'Majin Vegeta', 1, (2, 3), 10, 38, 18, 24, 6, (24, 25, 29)),
 'vegeta_ss4': F(V + 'Vegeta SSJ 4', 1, (2, 3), 11, 38, 17, 29, 6, (29, 30, 34)),
 'vegeta_god': F(V + 'Vegeta Ssj God', 1, (2, 3), 10, 41, 18, 28, 6, (28, 29, 33)),
 'vegeta_blue': F(V + 'Vegeta Blue', 29, (30, 31), 45, 118, 57, 74, 33, (74, 99, 101)),
 'vegeta_bfp': F(V + 'Vegeta Blue Full Power', 10, (11, 12), 25, 62, 41, 55, 20, (55, 56, 58)),
 'black': F(GB + 'Goku Black', 3, (4, 5), 31, 101, 36, 54, 21, (55, 57, 59)),
 'black_ss': F(GB + 'Goku Black SSJ', 10, (11, 12), 34, 72, 45, 55, 19, (56, 57, 59)),
 'black_rose': F(GB + 'Goku Black Rose', 3, (4, 5), 35, 49, 69, 56, 20, (60, 61, 63)),
 'gohan': F(GH + 'Gohan Adulto', 3, (4, 5), 50, 90, 57, 73, 32, (74, 76, 81)),
 'gohan_ss': F(GH + 'Teen Gohan SSJ', 1, (2, 3), 10, 49, 13, 26, 7, (27, 28, 31)),
 'gohan_ss2': F(GH + 'Teen Gohan SSJ2', 3, (4, 5), 18, 56, 22, 34, 9, (35, 36, 41)),
 'gohan_ul': F(GH + 'Gohan Mistico', 13, (14, 15), 42, 78, 51, 59, 23, (60, 61, 62)),
 'freezer1': F(FZ + 'Freeza Primeira Forma', 1, (2, 3), 9, 44, 16, 28, 5, (29, 31, 34)),
 'freezer3': F(FZ + 'Freeza Terceira Forma', 1, (3, 6), 8, 25, 12, 17, 2, (16, 17, 16)),
 'freezer': F(FZ + 'Freeza Forma Final', 1, (2, 3), 11, 40, 29, 22, 7, (21, 22, 33)),
 'freezer_fp': F(FZ + 'Freeza Full Power', 7, (8, 9), 11, 46, 35, 55, 15, (56, 57, 61)),
 'freezer_gold': F(FZ + 'Golden Freeza', 1, (2, 3), 26, 42, 14, 45, 17, (48, 49, 50)),
 'trunks': F(TR + 'Mirai Trunks', 3, (4, 5), 9, 107, 69, 52, 27, (52, 54, 56)),
 'trunks_ss': F(TR + 'Super Mirai Trunks', 22, (23, 24), 19, 121, 89, 72, 40, (72, 77, 81)),
 'cell_imp': F(CE + 'Cell Imperfeito', 1, (2, 3), 9, 31, 12, 15, 6, (15, 16, 15)),
 'cell_semi': F(CE + 'Cell Semi Perfeito', 1, (2, 3), 9, 39, 13, 31, 4, (31, 32, 34)),
 'cell': F(CE + 'cell Perfeito', 1, (2, 3), 10, 34, 16, 27, 7, (27, 29, 31)),
 'piccolo': F('Piccolo', 3, (4, 5), 21, 117, 30, 44, 15, (44, 45, 51)),
 'krilin': F('Kuririn', 15, (16, 17), 29, 69, 31, 47, 19, (48, 49, 50)),
 'kefla': F('Kefla Super Sayajin', 42, (63, 64), 77, 54, 48, 58, 78, (62, 62, 62)),
 'gotenks': F('Gotenks Base', 12, (12, 20), 14, 22, 21, 19, 17, (19, 19, 19)),
 'trunksarm': F('Trunks Armadura', 0, (1, 2), 5, 13, 9, 8, 17, (30, 30, 30)),
 'caulifla': F('Caulifla', 1, (2, 4), 9, 8, 96, 35, 19, (36, 36, 36)),
 'kale': F('KALE fases/Kale Ssj', 1, (2, 3), 28, 51, 33, 25, 3, (25, 25, 25)),
 'kyabe': F('KYABE fases/Kyabe ssj', 3, (4, 5), 17, 24, 59, 55, 18, (55, 55, 55)),
 'toppo': F('Toppo', 1, (3, 4), 9, 62, 76, 42, 11, (42, 42, 42)),
 'janemba': F('Janemba', 1, (2, 3), 9, 35, 33, 14, 20, (24, 24, 24)),
 'jiren': F('Jiren', 26, (27, 28), 5, 37, 75, 20, 22, (21, 21, 21)),
 'turles': F('Turles', 1, (2, 3), 5, 14, 51, 39, 40, (39, 39, 39)),
 'saibaman': F('Saibaman', 1, (3, 4), 10, 35, 30, 25, 16, (25, 25, 25)),
 'bills': F('Bills', 3, (4, 8), 37, 47, 73, 67, 40, (67, 67, 67)),
 'cooler': F('Cooler', 15, (16, 17), 29, 84, 79, 74, 30, (74, 74, 74)),
 'hitto': F('HITTO/Hitto', 3, (4, 5), 8, 116, 71, 65, 39, (65, 65, 65)),
 'raditz': F('RADITZ fases/Raditz', 3, (4, 5), 6, 24, 60, 44, 23, (44, 44, 44)),
 'andro16': F('ANDROIDES/Androide 16', 1, (2, 3), 8, 43, 61, 37, 8, (37, 37, 37)),
 'andro17': F('ANDROIDES/Androide 17', 1, (2, 3), 8, 20, 37, 25, 12, (25, 25, 25)),
 'andro18': F('ANDROIDES/Androide 18', 1, (2, 3), 10, 39, 31, 36, 26, (36, 36, 36)),
 'majin': F('MAJIN BUU formas/Majin Buu', 1, (2, 3), 9, 45, 42, 34, 38, (34, 34, 34)),
 'superbuu': F('MAJIN BUU formas/Super Buu', 1, (2, 3), 12, 50, 41, 4, 20, (4, 4, 4)),
 'zamasu': F('ZAMASU formas/Zamasu', 2, (3, 4), 9, 43, 46, 65, 32, (65, 65, 65)),   # Kefla SSJ (el pack mezcla Kale en la misma carpeta: se omiten sus fotogramas)
 'vegito': F(VG + 'Vegito', 20, (21, 35), 66, 137, 78, 96, 40, (97, 99, 100)),
 'vegito_ss': F(VG + 'Vegito Ssj1', 1, (2, 3), 24, 72, 34, 38, 17, (43, 45, 47)),
 'vegito_ss2': F(VG + 'Vegito Ssj2', 21, (22, 25), 41, 120, 70, 82, 26, (83, 84, 85)),
 'vegito_blue': F(VG + 'Vegito SSJ Blue', 37, (38, 42), 68, 175, 102, 117, 44, (117, 118, 119)),
 'broly': F(BR + 'Broly Segunda Forma', 25, (42, 43), 29, 88, 35, 49, 7, (46, 52, 53)),
 'broly_ss': F(BR + 'Broly Terceira forma', 14, (16, 19), 21, 90, 29, 33, 6, (64, 65, 67)),
 'broly_lss': F(BR + 'Broly Full Power', 10, (11, 12), 22, 64, 29, 39, 14, (40, 41, 42)),
 'broly_ss4': F(BR + 'Broly Ssj4', 1, (2, 3), 11, 44, 16, 29, 8, (29, 30, 31)),
 'bardock': F(BD + 'Bardock', 5, (6, 7), 17, 52, 28, 42, 8, (44, 46, 48)),
 'bardock_ss': F(BD + 'Bardock Ssj', 15, (16, 17), 43, 73, 38, 64, 18, (64, 65, 67)),
 'bardock_ss4': F(BD + 'Bardock SSJ4', 3, (4, 5), 12, 41, 23, 35, 6, (36, 38, 39)),
 'gogeta': F('Gogeta', 41, (49, 50), 64, 98, 77, 85, 68, (86, 87, 88)),
 'gogeta_base': dict(F('Gogeta', 41, (49, 50), 64, 98, 77, 85, 68, (86, 87, 88)), rc='base'),
 'gogeta_ss2': dict(F('Gogeta', 41, (49, 50), 64, 98, 77, 85, 68, (86, 87, 88)), rc='ss2'),
 'gogeta_blue': dict(F('Gogeta', 41, (49, 50), 64, 98, 77, 85, 68, (86, 87, 88)), rc='blue'),
}
# Poses de CARGAR KI con el aura (hoja <personaje>_chg, una tira por personaje): nombre -> [(carpeta, nº), ...]
CHG = {
 'goku_chg': [(G + 'Goku', 56), (G + 'Goku', 57), (G + 'Goku', 58), (G + 'Goku kaioken', 13), (G + 'Goku kaioken', 14), (G + 'Goku kaioken', 15),
              (G + 'Goku SSJ 1', 7), (G + 'Goku SSJ 1', 8), (G + 'Goku SSJ 1', 9), (G + 'Goku SSJ 2', 3), (G + 'Goku SSJ 2', 4), (G + 'Goku SSJ 2', 5),
              (G + 'Goku SSJ 3', 7), (G + 'Goku SSJ 3', 8), (G + 'Goku SSJ 3', 9), (G + 'Goku SSJ 4', 34), (G + 'Goku SSJ 4', 35), (G + 'Goku SSJ 4', 36),
              (G + 'Goku God', 50), (G + 'Goku God', 51), (G + 'Goku Blue', 91), (G + 'Goku Blue', 92), (G + 'Goku Blue', 93),
              (G + 'Goku Blue Kaioken Whis Gi', 67), (G + 'Goku Blue Kaioken Whis Gi', 68), (G + 'Goku Instinto Superior', 8), (G + 'Goku Instinto Superior', 9),
              (G + 'Goku Instinto Superior Completo', 8), (G + 'Goku Instinto Superior Completo', 9)],
 'vegeta_chg': [(V + 'Vegeta Sayajin Saga', 7), (V + 'Vegeta Sayajin Saga', 8), (V + 'Vegeta Sayajin Saga', 9), (V + 'Vegeta Saga Buu SSJ', 7),
                (V + 'Vegeta Saga Buu SSJ', 8), (V + 'Vegeta Saga Buu SSJ', 9), (V + 'Vegeta Ssj Grade', 3), (V + 'Vegeta Ssj Grade', 4),
                (V + 'Vegeta Ssj Grade', 5), (V + 'Majin Vegeta', 7), (V + 'Majin Vegeta', 8), (V + 'Majin Vegeta', 9), (V + 'Vegeta SSJ 4', 8),
                (V + 'Vegeta SSJ 4', 9), (V + 'Vegeta SSJ 4', 10), (V + 'Vegeta Ssj God', 7), (V + 'Vegeta Ssj God', 9), (V + 'Vegeta Blue', 108),
                (V + 'Vegeta Blue', 110), (V + 'Vegeta Blue', 114), (V + 'Vegeta Blue Full Power', 60), (V + 'Vegeta Blue Full Power', 61)],
 'black_chg': [(GB + 'Goku Black', 63), (GB + 'Goku Black', 64), (GB + 'Goku Black SSJ', 61), (GB + 'Goku Black SSJ', 62), (GB + 'Goku Black SSJ', 63),
               (GB + 'Goku Black Rose', 31), (GB + 'Goku Black Rose', 32), (GB + 'Goku Black Rose', 82)],
 'gohan_chg': [(GH + 'Gohan Adulto', 84), (GH + 'Gohan Adulto', 85), (GH + 'Gohan Adulto', 86), (GH + 'Teen Gohan SSJ', 36), (GH + 'Teen Gohan SSJ', 37),
               (GH + 'Teen Gohan SSJ', 38), (GH + 'Teen Gohan SSJ2', 50), (GH + 'Teen Gohan SSJ2', 51), (GH + 'Teen Gohan SSJ2', 52),
               (GH + 'Gohan Mistico', 73), (GH + 'Gohan Mistico', 74)],
 'freezer_chg': [(FZ + 'Freeza Primeira Forma', 35), (FZ + 'Freeza Primeira Forma', 36), (FZ + 'Freeza Primeira Forma', 37),
                 (FZ + 'Freeza Terceira Forma', 22), (FZ + 'Freeza Terceira Forma', 24), (FZ + 'Freeza Forma Final', 45), (FZ + 'Freeza Forma Final', 46),
                 (FZ + 'Freeza Forma Final', 47), (FZ + 'Freeza Full Power', 62), (FZ + 'Freeza Full Power', 63), (FZ + 'Freeza Full Power', 64),
                 (FZ + 'Golden Freeza', 38), (FZ + 'Golden Freeza', 39)],
 'trunks_chg': [(TR + 'Mirai Trunks', 17), (TR + 'Mirai Trunks', 18), (TR + 'Super Mirai Trunks', 115), (TR + 'Super Mirai Trunks', 116),
                (TR + 'Super Mirai Trunks', 148)],
 'cell_chg': [(CE + 'Cell Imperfeito', 28), (CE + 'Cell Imperfeito', 29), (CE + 'Cell Imperfeito', 30), (CE + 'Cell Semi Perfeito', 36),
              (CE + 'Cell Semi Perfeito', 37), (CE + 'Cell Semi Perfeito', 38), (CE + 'cell Perfeito', 37), (CE + 'cell Perfeito', 38), (CE + 'cell Perfeito', 39)],
 'piccolo_chg': [('Piccolo', 90), ('Piccolo', 91)],
 'vegito_chg': [(VG + 'Vegito', 105), (VG + 'Vegito', 106), (VG + 'Vegito', 107), (VG + 'Vegito Ssj1', 49), (VG + 'Vegito Ssj1', 50),
                (VG + 'Vegito Ssj1', 51), (VG + 'Vegito Ssj2', 91), (VG + 'Vegito Ssj2', 92), (VG + 'Vegito Ssj2', 93),
                (VG + 'Vegito SSJ Blue', 132), (VG + 'Vegito SSJ Blue', 134), (VG + 'Vegito SSJ Blue', 135)],
 'broly_chg': [(BR + 'Broly Segunda Forma', 57), (BR + 'Broly Segunda Forma', 60), (BR + 'Broly Segunda Forma', 61), (BR + 'Broly Terceira forma', 3),
               (BR + 'Broly Terceira forma', 60), (BR + 'Broly Full Power', 44), (BR + 'Broly Full Power', 45), (BR + 'Broly Full Power', 46),
               (BR + 'Broly Ssj4', 38), (BR + 'Broly Ssj4', 39), (BR + 'Broly Ssj4', 40)],
 'gogeta_chg': [('Gogeta', n, rc) for rc in ('base', None, 'ss2', 'blue') for n in (91, 92, 93)],
 'bardock_chg': [(BD + 'Bardock', 60), (BD + 'Bardock', 61), (BD + 'Bardock', 62), (BD + 'Bardock Ssj', 3), (BD + 'Bardock Ssj', 6),
                 (BD + 'Bardock SSJ4', 44), (BD + 'Bardock SSJ4', 45), (BD + 'Bardock SSJ4', 46)],
}
# Intros de las fusiones (hoja <personaje>_intro, pies abajo): Goku y Vegeta se fusionan antes de empezar la partida
# vegito_intro: 0 Goku · 1 Vegeta · 2-3 vuelan · 4-7 Vegetto aparece · 8-10 aura
# gogeta_intro: 0-10 baile de Goku · 11-21 baile de Vegeta · 22 silueta · 23 Gogeta · 24-26 aura · 27 los dedos se tocan
INTRO = {
 'vegito_intro': [(VG + 'Vegito Ssj2', n) for n in range(1, 9)] + [(VG + 'Vegito', n) for n in (105, 106, 107)],
 'gogeta_intro': [('Gogeta', n, 'base') for n in (3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 16, 17, 19, 20, 21, 22, 23, 24, 25, 26, 27, 40, 41, 91, 92, 93, 44)],
}
# Jefes (hoja 'bosses', 8 columnas de 128 px: 0-3 caminar · 4 golpe recibido · 5 ataque · 6 técnica · 7 pose/aturdido)
BOSS_ROWS = {
 0: ('FREEZA formas/Freeza Forma Final', (1, 2, 3, 2), 22, 11, 50, 1),
 1: ('CELL formas/cell Perfeito', (1, 2, 3, 2), 27, 10, 34, 1),
 2: ('BROLY fases/Broly Full Power', None, None, None, None, None),
 3: ('MAJIN BUU formas/Kid Buu', None, None, None, None, None),
 5: ('Jiren', None, None, None, None, None),
 6: ('Bills', None, None, None, None, None),
 7: ('ZAMASU formas/Zamasu e Black Fusion', None, None, None, None, None),
}
# Enemigos (hoja 'enemies', 8 columnas de 96 px, mismas columnas que los jefes)
ENEMY_ROWS = {0: 'Saibaman', 5: 'CELL formas/Cell Imperfeito', 6: 'ANDROIDES/Androide 17'}

def num(f):
    m = re.findall(r'(\d+)\.(?:png|gif)$', f, re.I); return int(m[0]) if m else None
_IDX = {}
def path(folder, n):
    if folder not in _IDX:
        _IDX[folder] = {num(f): f for f in glob.glob(os.path.join(ROOT, folder, '*.png')) + glob.glob(os.path.join(ROOT, folder, '*.gif')) if num(f) is not None}
    return _IDX[folder][n]
def load(folder, n):
    """Fotograma con el fondo transparente: el color de fondo es el que más se repite en el borde; se quita
    solo lo que está conectado al borde con ese color exacto (los blancos de dentro del sprite se conservan)"""
    im = Image.open(path(folder, n))
    a = np.array(im.convert('RGB'))
    e = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    v, c = np.unique(e.reshape(-1, 3), axis=0, return_counts=True); bg = v[c.argmax()]
    m = (a == bg).all(2)
    lab, k = nd.label(m)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    rem = np.isin(lab, list(border))
    return trim(np.dstack([a, np.where(rem, 0, 255)]).astype(np.uint8))
def clean_lines(r):
    """Quita rayas sueltas (1-3 píxeles de alto, separadas del cuerpo) que traen algunos fotogramas del pack"""
    lab, k = nd.label(r[:, :, 3] > 0)
    if k < 2: return r
    sizes = nd.sum(np.ones(lab.shape), lab, range(1, k + 1)); big = sizes.max()
    for c, sl in enumerate(nd.find_objects(lab), 1):
        if sl[0].stop - sl[0].start <= 3 and sizes[c - 1] < big * 0.15: r[lab == c, 3] = 0
    return trim(r)
def trim(r):
    ys, xs = np.nonzero(r[:, :, 3])
    return r[ys.min():ys.max() + 1, xs.min():xs.max() + 1] if len(xs) else r
def feet_x(r):
    a = r[:, :, 3] > 0; ys, xs = np.nonzero(a); h = r.shape[0]
    low = ys > h * 0.6
    return float(np.median(xs[low])) if low.any() else r.shape[1] / 2
def build(frames, cols=4, center='feet', cell=None, k=1):
    """frames: {índice: rgba}. Todas las celdas iguales (las del mayor fotograma); pies abajo, centrados"""
    if k != 1:
        frames = {i: np.array(Image.fromarray(r).resize((max(1, round(r.shape[1] * k)), max(1, round(r.shape[0] * k))), Image.NEAREST)) for i, r in frames.items()}
    cx = {i: (feet_x(r) if center == 'feet' else r.shape[1] / 2) for i, r in frames.items()}
    if cell: CW, CH = cell
    else:
        CW = int(max(2 * max(cx[i], r.shape[1] - cx[i]) for i, r in frames.items())) + 4
        CH = max(r.shape[0] for r in frames.values()) + 3
    rows = max(frames) // cols + 1
    sh = Image.new('RGBA', (CW * cols, CH * rows), (0, 0, 0, 0))
    for i, r in frames.items():
        im = Image.fromarray(r)
        if im.height > CH - 2 or im.width > CW:                  # no cabe en una celda fija: se encoge (solo jefes/enemigos)
            f = min((CH - 2) / im.height, CW / im.width); im = im.resize((max(1, int(im.width * f)), max(1, int(im.height * f))), Image.NEAREST)
            c = im.width / 2
        else: c = cx[i]
        x = (i % cols) * CW + round(CW / 2 - c); y = (i // cols) * CH + CH - 2 - im.height
        sh.paste(im, (x, y), im)
    return sh, CW, CH, rows
def credits_of(folders):
    out = {}
    for fo in folders:
        for t in glob.glob(os.path.join(ROOT, fo, '*.txt')):
            m = re.search(r'Hecho por (.+)\.txt$', os.path.basename(t), re.I)
            if m: out[fo] = m.group(1).strip()
    return out

if __name__ == '__main__':
    out = sys.argv[2]; os.makedirs(out, exist_ok=True); meta = {}; used = set()
    solo = sys.argv[sys.argv.index('-solo') + 1].split(',') if '-solo' in sys.argv else None   # solo las hojas de estos personajes
    keep = lambda n: solo is None or n.split('_')[0] in solo
    SHEETS = {n: v for n, v in SHEETS.items() if keep(n)}; CHG = {n: v for n, v in CHG.items() if keep(n)}; INTRO = {n: v for n, v in INTRO.items() if keep(n)}
    for name, S in SHEETS.items():
        fr = {i: recolor(load(S['folder'], n), S.get('rc')) for i, n in S['f'].items()}; used.add(S['folder'])
        sh, CW, CH, rows = build(fr)
        sh.save(os.path.join(out, name + '.png'))
        meta[name] = {'cols': 4, 'rows': rows, 'w': CW, 'h': CH, 'hs': round(CH / REF, 4), 'anc': round(2 / CH, 4), 'px': 1}
        print(name, CW, 'x', CH)
    for name, L in CHG.items():
        fr = {i: recolor(load(e[0], e[1]), e[2] if len(e) > 2 else None) for i, e in enumerate(L)}; used |= {e[0] for e in L}
        cols = min(8, len(L)); sh, CW, CH, rows = build(fr, cols=cols, center='box')
        sh.save(os.path.join(out, name + '.png'))
        meta[name] = {'cols': cols, 'rows': rows, 'w': CW, 'h': CH, 'hs': round(CH / REF, 4), 'anc': round(2 / CH, 4), 'px': 1}
        print(name, len(L), CW, 'x', CH)
    for name, L in INTRO.items():
        fr = {i: recolor(load(e[0], e[1]), e[2] if len(e) > 2 else None) for i, e in enumerate(L)}; used |= {e[0] for e in L}
        sh, CW, CH, rows = build(fr, cols=8)
        sh.save(os.path.join(out, name + '.png'))
        meta[name] = {'cols': 8, 'rows': rows, 'w': CW, 'h': CH}
        print(name, len(L), CW, 'x', CH)
    json.dump(meta, open(os.path.join(out, 'chars.json'), 'w'))
    json.dump(credits_of(sorted(used)), open(os.path.join(out, 'credits.json'), 'w'), ensure_ascii=False, indent=1)

# ---------- Jefes y enemigos: se repintan filas de las hojas 'bosses' (128 px) y 'enemies' (96 px) ----------
# fila: (carpeta, [caminar x4, herido, ataque, técnica, pose]). Se amplían con un factor entero (píxel nítido)
ROW_PATCH = {
 'enemies': (96, 86, {0: ('Saibaman', [1, 35, 1, 35, 18, 10, 21, 1]), 5: (CE + 'Cell Imperfeito', [1, 2, 1, 3, 15, 9, 31, 1]),
                      6: ('ANDROIDES/Androide 17', [1, 2, 1, 2, 21, 7, 27, 1]),
                      8: ('Frost/Frost Primeira Forma', [1, 2, 1, 3, 33, 13, 44, 1]), 9: ('MAJIN BUU formas/Majin Buu', [1, 2, 1, 3, 70, 13, 57, 1]),
                      10: ('ANDROIDES/Androide 18', [3, 4, 3, 4, 33, 11, 39, 2]), 11: ('KALE fases/Kale Ssj', [19, 20, 19, 20, 23, 11, 43, 1]),
                      12: ('KYABE fases/Kyabe', [3, 4, 3, 5, 42, 21, 60, 3]), 13: ('Caulifla', [9, 10, 9, 11, 30, 41, 65, 1])}),
 'bosses': (128, 116, {0: (FZ + 'Freeza Forma Final', [1, 2, 3, 2, 22, 11, 40, 1]), 1: (CE + 'cell Perfeito', [1, 2, 3, 2, 27, 10, 34, 1]),
                       8: ('Cooler', [15, 16, 15, 17, 65, 32, 84, 3]), 9: ('Janemba', [1, 2, 3, 2, 22, 10, 58, 1]),
                       10: ('MAJIN BUU formas/Super Buu', [1, 2, 1, 2, 33, 13, 48, 60]), 11: ('HITTO/Hitto', [3, 4, 3, 6, 60, 21, 125, 13]),
                       12: ('Toppo', [1, 4, 1, 4, 6, 13, 62, 64]), 13: ('ANDROIDES/Androide 16', [1, 2, 1, 3, 35, 15, 43, 1]),
                       14: ('RADITZ fases/Raditz', [3, 4, 3, 4, 41, 21, 49, 5]), 15: ('Turles', [3, 4, 3, 4, 34, 13, 65, 47])}),
}
# Jefe Goku Black (hoja propia, una fila por fase: 0 aturdido · 1 caminar · 2 golpe recibido · 3 ataque)
BLACK_BOSS = [(GB + 'Goku Black', [3, 4, 54, 31]), (GB + 'Goku Black SSJ', [10, 11, 55, 34]), (GB + 'Goku Black Rose', [3, 4, 56, 35]),
              (GB + 'Goku Black Rose', [3, 5, 58, 49])]
def patch_rows(sheet, cell, target, rows):
    """sheet: imagen PIL de la hoja (se modifica). Devuelve las carpetas usadas"""
    used = set()
    for r, (fo, idx) in rows.items():
        used.add(fo); fr = [clean_lines(load(fo, n)) for n in idx]
        k = max(1, round(target / fr[0].shape[0]))
        for c, a in enumerate(fr):
            im = Image.fromarray(a); im = im.resize((im.width * k, im.height * k), Image.NEAREST)
            if im.height > cell - 1 or im.width > cell:
                f = min((cell - 1) / im.height, cell / im.width); im = im.resize((max(1, int(im.width * f)), max(1, int(im.height * f))), Image.NEAREST)
            sheet.paste(Image.new('RGBA', (cell, cell), (0, 0, 0, 0)), (c * cell, r * cell))
            sheet.paste(im, (c * cell + (cell - im.width) // 2, r * cell + cell - 1 - im.height), im)
    return used
def black_boss():
    fr = {}
    for r, (fo, idx) in enumerate(BLACK_BOSS):
        for c, n in enumerate(idx): fr[r * 4 + c] = load(fo, n)
    return build(fr)
