'use strict';
/* =====================================================================
   data.js · Todo el contenido del juego como DATOS (fácil de ampliar):
   animaciones, personajes y transformaciones, armas, vitaminas,
   enemigos, mejoras del laboratorio y guardado local.
   ===================================================================== */

/* Hojas que se cargan al arrancar. Personajes del pack «Dragon Ball Sagas» (tools/make_zip.py): pixel art a tamaño original,
   todos con el mismo tamaño de píxel en pantalla (hs/anc de cada hoja) */
const SHEET_NAMES = ['goku', 'goku_kk', 'goku_ss', 'goku_ss2', 'goku_ss3', 'goku_ss4', 'goku_god', 'goku_blue', 'goku_bkk', 'goku_sign', 'goku_ui',
  'vegeta', 'vegeta_ss', 'vegeta_grade', 'vegeta_majin', 'vegeta_ss4', 'vegeta_god', 'vegeta_blue', 'vegeta_bfp',
  'black', 'black_ss', 'black_rose', 'black_boss', 'gohan', 'gohan_ss', 'gohan_ss2', 'gohan_ul',
  'freezer1', 'freezer3', 'freezer', 'freezer_fp', 'freezer_gold', 'trunks', 'trunks_ss', 'cell_imp', 'cell_semi', 'cell', 'piccolo', 'krilin',
  'vegito', 'vegito_ss', 'vegito_ss2', 'vegito_blue', 'broly', 'broly_ss', 'broly_lss', 'broly_ss4', 'bardock', 'bardock_ss', 'bardock_ss4', 'gogeta_base', 'gogeta', 'gogeta_ss2', 'gogeta_blue',
  'goku_chg', 'vegeta_chg', 'black_chg', 'gohan_chg', 'freezer_chg', 'trunks_chg', 'cell_chg', 'piccolo_chg', 'vegito_chg', 'broly_chg', 'bardock_chg', 'gogeta_chg', 'krilin_chg', 'kefla_chg', 'gotenks_chg', 'trunksarm_chg', 'caulifla_chg', 'kale_chg', 'kyabe_chg', 'toppo_chg', 'janemba_chg', 'jiren_chg', 'turles_chg', 'saibaman_chg', 'bills_chg', 'cooler_chg', 'hitto_chg', 'raditz_chg', 'andro16_chg', 'andro17_chg', 'andro18_chg', 'majin_chg', 'superbuu_chg', 'zamasu_chg', 'zamasuf_chg',
  'vegito_intro', 'gogeta_intro',
  'enemies', 'bosses', 'fx', 'fxbig', 'fxzip', 'kefla', 'gotenks', 'trunksarm', 'caulifla', 'kale', 'kyabe', 'toppo', 'janemba', 'jiren', 'turles', 'saibaman', 'bills', 'cooler', 'hitto', 'raditz', 'andro16', 'andro17', 'andro18', 'majin', 'superbuu', 'zamasu', 'zamasuf', 'zamasuf_cor', 'zamasuf_div', 'zamasuf_intro', 'props', 'tall', 'icons', 'tiles'];

/* ---------- Animaciones: índices de fotograma de cada hoja (4 columnas, fila*4+columna) ---------- */
/* 0 quieto · 1-2 caminar · 5 golpe · 8 herido · 9 dash · 10 rayo · 11 técnica · 12-14 muerte */
const A_HD = { idle: 0, walk: [1, 2, 1, 0], atk: 5, atk2: 10, crit: 11, hurt: 8, dash: 9, death: [12, 13, 14] };
const A_TRK = A_HD, A_KRL = A_HD, A_GOH = A_HD;

/* ---------- Personajes y transformaciones ---------- */
const form = (name, lvl, sheet, anim, dmg, spd, ki, aura, tint) => ({ name, lvl, sheet, anim, dmg, spd, ki, aura, tint });

const CHARACTERS = [
  {
    id: 'goku', name: 'SON GOKU', role: 'Versátil · Cuerpo a cuerpo', cost: 0,
    hp: 110, ki: 100, spd: 1.0, dmg: 1.0, start: ['ki'], unique: ['ki', 'kamehameha', 'meteor', 'dragonfist'],
    passive: { name: 'Zenkai', desc: 'Cada nivel que subes aumenta un 1,5% tu daño.' },
    ult: { name: 'SUPER GENKIDAMA', key: 'Q', cost: 100, type: 'bomb', dmg: 150, r: 22, sty: 'genki', col: 0x9fe8ff, fx: ['#000', '#fff', '#5ab8ff', '#ffffff', '#5ab8ff'], debuff: { name: 'AGOTADO', text: '-25% de velocidad durante 8 s', t: 8, spd: 0.25 } },
    portrait: { sheet: 'goku', frame: 0 },
    forms: [
      form('BASE', 1, 'goku', A_HD, 1.0, 1.0, 0xfff0a0, 0, 0xffffff),
      form('KAIOKEN', 5, 'goku_kk', A_HD, 1.25, 1.12, 0xff8a8a, 0xff3030, 0xffffff),
      form('SUPER SAIYAN', 10, 'goku_ss', A_HD, 1.55, 1.15, 0xffe14a, 0xffd84a, 0xffffff),
      form('SUPER SAIYAN 2', 16, 'goku_ss2', A_HD, 1.9, 1.2, 0xfff08a, 0xfff07a, 0xffffff),
      form('SUPER SAIYAN 3', 22, 'goku_ss3', A_HD, 2.3, 1.22, 0xffd24a, 0xffc83a, 0xffffff),
      form('SUPER SAIYAN 4', 26, 'goku_ss4', A_HD, 2.55, 1.25, 0xff6a5a, 0xff3a2a, 0xffffff),
      form('SUPER SAIYAN GOD', 29, 'goku_god', A_HD, 2.9, 1.28, 0xff6a4a, 0xff4a2a, 0xffffff),
      form('SUPER SAIYAN BLUE', 32, 'goku_blue', A_HD, 3.3, 1.32, 0x6fd8ff, 0x4fc8ff, 0xffffff),
      form('BLUE KAIO-KEN', 35, 'goku_bkk', A_HD, 3.65, 1.38, 0x6fd8ff, 0xff3a3a, 0xffffff),
      form('ULTRA INSTINTO SEÑAL', 38, 'goku_sign', A_HD, 3.9, 1.42, 0xdfe8ff, 0xb8c8ff, 0xffffff),
      form('ULTRA INSTINTO', 41, 'goku_ui', A_HD, 4.3, 1.46, 0xdff4ff, 0xcfeaff, 0xffffff)
    ]
  },
  {
    id: 'vegeta', name: 'VEGETA', role: 'Artillería · Daño explosivo', cost: 2500,
    hp: 100, ki: 130, spd: 1.0, dmg: 1.12, start: ['vblast'], unique: ['vblast', 'vtriple', 'galick', 'bigbang', 'kakusan'],
    passive: { name: 'Orgullo Saiyajin', desc: '+25% de daño mientras tu Ki esté por encima del 80%.' },
    ult: { name: 'FINAL FLASH MÁXIMO', key: 'Q', cost: 100, type: 'beam', dmg: 10, len: 66, hw: 3.4, life: 1.8, col: 0xffe14a, end: 'ffBoom', fx: ['#000', '#fff', '#ffe14a', '#6fb8ff', '#ffe14a'], debuff: { name: 'ORGULLO HERIDO', text: 'recibes un 25% más de daño durante 8 s', t: 8, take: 0.25 } },
    portrait: { sheet: 'vegeta', frame: 0 },
    forms: [
      form('BASE', 1, 'vegeta', A_HD, 1.0, 1.0, 0x9ad0ff, 0, 0xffffff),
      form('SUPER SAIYAN', 8, 'vegeta_ss', A_HD, 1.45, 1.1, 0xffe14a, 0xffd24a, 0xffffff),
      form('SUPER VEGETA', 13, 'vegeta_grade', A_HD, 1.7, 1.02, 0xffe14a, 0xffc83a, 0xffffff),
      form('MAJIN VEGETA', 18, 'vegeta_majin', A_HD, 2.0, 1.18, 0xfff08a, 0xfff07a, 0xffffff),
      form('SUPER SAIYAN 4', 23, 'vegeta_ss4', A_HD, 2.35, 1.22, 0xff6a5a, 0xff3a2a, 0xffffff),
      form('SUPER SAIYAN GOD', 28, 'vegeta_god', A_HD, 2.7, 1.26, 0xff6a5a, 0xff4a3a, 0xffffff),
      form('SUPER SAIYAN BLUE', 33, 'vegeta_blue', A_HD, 3.1, 1.3, 0x6fd8ff, 0x4fc8ff, 0xffffff),
      form('BLUE EVOLUCIÓN', 38, 'vegeta_bfp', A_HD, 3.7, 1.36, 0x4a8aff, 0x3a6aff, 0xffffff)
    ]
  },
  {
    id: 'black', name: 'GOKU BLACK', role: 'Asesino · Guadaña de ki', cost: 6000,
    hp: 90, ki: 100, spd: 1.1, dmg: 1.1, start: ['scythe'], unique: ['scythe', 'darkorbs', 'sorrow', 'blackkame'],
    passive: { name: 'Justicia Divina', desc: 'Recuperas 0,6 de vida por cada enemigo derrotado.' },
    // Ultimate: se carga matando enemigos y al derrotar élites o jefes. Abre una grieta en el espacio que corta el mapa.
    ult: { name: 'GRIETA DE BLACK', key: 'Q', cost: 100, type: 'rift', dmg: 9, len: 46, hw: 1.7, debuff: { name: 'CUERPO IMPERFECTO', text: 'pierdes un 2% de vida por segundo durante 6 s', t: 6, bleed: 0.02 } },
    portrait: { sheet: 'black', frame: 0 },
    forms: [
      form('BASE', 1, 'black', A_HD, 1.0, 1.0, 0xb26bff, 0, 0xffffff),
      form('SUPER SAIYAN', 12, 'black_ss', A_HD, 1.6, 1.12, 0xffe36a, 0xfff07a, 0xffffff),
      form('SUPER SAIYAN ROSÉ', 24, 'black_rose', A_HD, 2.3, 1.2, 0xff7ac8, 0xff7ac8, 0xffffff),
      form('ROSÉ · PODER TOTAL', 36, 'black_rose', A_HD, 3.2, 1.3, 0xff4fb0, 0xff3fa0, 0xffd8ec)
    ]
  },
  {
    id: 'piccolo', name: 'PICCOLO', role: 'Control de masas · Regeneración', cost: 3500,
    hp: 120, ki: 110, spd: 0.95, dmg: 1.0, start: ['eyebeam'], unique: ['eyebeam', 'hellzone', 'lightgrenade', 'arms'],
    passive: { name: 'Regeneración namekiana', desc: 'Recuperas 1,5 de vida por segundo.' },
    ult: { name: 'HELLZONE GRENADE DEFINITIVO', key: 'Q', cost: 100, type: 'storm', dmg: 34, n: 22, r: 30, fx: ['#000', '#fff', '#ffd040', '#7aff6a', '#ffd040'], debuff: { name: 'SIN KI', text: 'el Ki no se regenera durante 8 s', t: 8, noki: true } },
    portrait: { sheet: 'piccolo', frame: 0 },
    forms: [
      form('BASE', 1, 'piccolo', A_HD, 1.0, 1.0, 0x9cff8a, 0, 0xffffff),
      form('FUSIÓN CON NAIL', 10, 'piccolo', A_HD, 1.45, 1.1, 0x9cff8a, 0x8aff70, 0xf0fff0),
      form('FUSIÓN CON KAMI', 20, 'piccolo', A_HD, 1.95, 1.18, 0xd8ff9a, 0xc8ff7a, 0xffffff),
      form('PICCOLO NARANJA', 32, 'piccolo', A_HD, 2.7, 1.3, 0xffb060, 0xff9a3a, 0xffb878)
    ]
  },
  {
    id: 'gohan', name: 'GOHAN', role: 'Potencial oculto · Rayos', cost: 5000,
    hp: 100, ki: 120, spd: 1.0, dmg: 1.05, start: ['gblast'], unique: ['gblast', 'gshield', 'fsk', 'rage', 'zsword', 'gthunder'],
    passive: { name: 'Potencial oculto', desc: '+40% de daño mientras tu vida esté por debajo del 50%.' },
    ult: { name: 'KAMEHAMEHA PADRE-HIJO', key: 'Q', cost: 100, type: 'beam', dmg: 9, len: 64, hw: 3.3, life: 1.8, col: 0x8fe0ff, end: 'genkiBoom', fx: ['#000', '#fff', '#5ab8ff', '#ffe14a', '#5ab8ff'], debuff: { name: 'AGOTADO', text: '-25% de daño durante 8 s', t: 8, dmg: 0.25 } },
    portrait: { sheet: 'gohan', frame: 0 },
    forms: [
      form('BASE', 1, 'gohan', A_HD, 1.0, 1.0, 0xbfe4ff, 0, 0xffffff),
      form('SUPER SAIYAN', 10, 'gohan_ss', A_HD, 1.5, 1.12, 0xffe14a, 0xffd84a, 0xffffff),
      form('SUPER SAIYAN 2', 20, 'gohan_ss2', A_HD, 2.1, 1.2, 0xfff08a, 0xfff07a, 0xffffff),
      form('DEFINITIVO', 32, 'gohan_ul', A_HD, 2.9, 1.28, 0xffffff, 0xf0f4ff, 0xffffff)
    ]
  },
  {
    id: 'freezer', name: 'FREEZER', role: 'Tirano · Rayos mortales', cost: 8000,
    hp: 95, ki: 120, spd: 1.05, dmg: 1.15, start: ['deathbeam'], unique: ['deathbeam', 'deathsaucer', 'deathball', 'chaser'],
    passive: { name: 'Emperador del Universo', desc: '+25% de Zeni y monedas en cada partida.' },
    ult: { name: 'DEATH BALL', key: 'Q', cost: 100, type: 'bomb', dmg: 150, r: 22, sty: 'db', col: 0xff5ad0, fx: ['#000', '#fff', '#8a2aff', '#ff3fa0', '#2a0040'], debuff: { name: 'CANSANCIO', text: '-20% de velocidad y daño durante 7 s', t: 7, spd: 0.2, dmg: 0.2 } },
    portrait: { sheet: 'freezer1', frame: 0 },
    forms: [
      form('PRIMERA FORMA', 1, 'freezer1', A_HD, 1.0, 1.0, 0xd88aff, 0, 0xffffff),
      form('TERCERA FORMA', 9, 'freezer3', A_HD, 1.5, 1.08, 0xc89aff, 0xb08aff, 0xffffff),
      form('FORMA FINAL', 17, 'freezer', A_HD, 2.0, 1.16, 0xff8ad8, 0xff7ac8, 0xffffff),
      form('100% DE PODER', 25, 'freezer_fp', A_HD, 2.6, 1.22, 0xff8ad8, 0xff6ab8, 0xffffff),
      form('GOLDEN FREEZER', 33, 'freezer_gold', A_HD, 3.4, 1.3, 0xffd84a, 0xffd23a, 0xffffff)
    ]
  },
  {
    id: 'krilin', name: 'KRILIN', role: 'Agilidad · Discos cortantes', cost: 3000,
    hp: 90, ki: 120, spd: 1.15, dmg: 0.95, start: ['kdisc'], unique: ['kdisc', 'kscatter', 'taiyoken', 'kbarrage'],
    passive: { name: 'Pequeño pero matón', desc: '+12% de esquiva y el dash se recarga un 25% más rápido.' },
    ult: { name: 'KIENZAN MÚLTIPLE', key: 'Q', cost: 100, type: 'discs', dmg: 60, n: 16, fx: ['#000', '#fff', '#ffe86a', '#fff', '#ffb040'], debuff: { name: 'SIN ALIENTO', text: 'sin dash durante 6 s', t: 6, nodash: true } },
    portrait: { sheet: 'krilin', frame: 0 },
    forms: [
      form('BASE', 1, 'krilin', A_KRL, 1.0, 1.0, 0xffe86a, 0, 0xffffff),
      form('POTENCIAL LIBERADO', 10, 'krilin', A_KRL, 1.45, 1.12, 0xfff0a0, 0xffe070, 0xfff8e8),
      form('MODO GUERRERO', 22, 'krilin', A_KRL, 2.0, 1.22, 0xffd070, 0xffb040, 0xffeedd),
      form('PODER MÁXIMO', 34, 'krilin', A_KRL, 2.75, 1.3, 0xffffff, 0xfff4c0, 0xffffff)
    ]
  },
  {
    id: 'trunks', name: 'TRUNKS', role: 'Espadachín del futuro', cost: 4500,
    hp: 105, ki: 110, spd: 1.05, dmg: 1.08, start: ['sword'], unique: ['sword', 'burning', 'shining', 'buster', 'futureblast'],
    passive: { name: 'Guerrero del futuro', desc: '+6% de crítico y +30% de daño crítico.' },
    ult: { name: 'BURNING SLASH', key: 'Q', cost: 100, type: 'slash', dmg: 40, r: 13, fx: ['#000', '#fff', '#9fe0ff', '#ff9a2a', '#ffd040'], debuff: { name: 'BRAZOS CANSADOS', text: '-25% de daño durante 8 s', t: 8, dmg: 0.25 } },
    portrait: { sheet: 'trunks', frame: 0 },
    forms: [
      form('BASE', 1, 'trunks', A_HD, 1.0, 1.0, 0xbfe4ff, 0, 0xffffff),
      form('SUPER SAIYAN', 10, 'trunks_ss', A_HD, 1.6, 1.14, 0xffe14a, 0xffd84a, 0xffffff),
      form('SUPER SAIYAN FURIA', 26, 'trunks_ss', A_HD, 2.6, 1.28, 0xbfe8ff, 0x6fd8ff, 0xf0f8ff)
    ]
  },
  {
    id: 'cell', name: 'CÉLULA', role: 'Absorción · Copia técnicas', cost: 7000,
    hp: 115, ki: 120, spd: 1.0, dmg: 1.08, start: ['cellbeam'], unique: ['cellbeam', 'cellkame', 'celljr', 'cellbarrier', 'cellself', 'perfectstorm'],
    passive: { name: 'Absorción', desc: 'Curas 0,3 de vida por enemigo y cada 100 enemigos ganas +2% de daño (hasta +30%).' },
    ult: { name: 'KAMEHAMEHA SOLAR', key: 'Q', cost: 100, type: 'beam', dmg: 9, len: 64, hw: 3.3, life: 1.8, col: 0x6aff9a, end: 'kameBoomG', fx: ['#000', '#fff', '#3aff7a', '#ffe14a', '#3aff7a'], debuff: { name: 'CUERPO INESTABLE', text: 'recibes un 25% más de daño durante 8 s', t: 8, take: 0.25 } },
    portrait: { sheet: 'cell_imp', frame: 0 },
    forms: [
      form('IMPERFECTO', 1, 'cell_imp', A_HD, 1.0, 1.0, 0x8af0a0, 0, 0xffffff),
      form('SEMIPERFECTO', 12, 'cell_semi', A_HD, 1.6, 1.12, 0xaaffb0, 0x7aff8a, 0xffffff),
      form('PERFECTO', 24, 'cell', A_HD, 2.4, 1.22, 0xffe86a, 0xffd23a, 0xffffff),
      form('SÚPER PERFECTO', 36, 'cell', A_HD, 3.3, 1.32, 0x9fe0ff, 0x6fd8ff, 0xf0f8ff)
    ]
  },
  {
    id: 'bardock', name: 'BARDOCK', role: 'Clase baja · Ataques a distancia', cost: 5500,
    hp: 110, ki: 110, spd: 1.05, dmg: 1.05, start: ['riot'], unique: ['riot', 'spiritcannon', 'rebellion', 'saiyanrage'],
    passive: { name: 'Rebeldía', desc: '+10% de esquiva y +8% de probabilidad de crítico.' },
    ult: { name: 'SPIRIT CANNON FINAL', key: 'Q', cost: 100, type: 'bomb', dmg: 150, r: 22, sty: 'genki', col: 0x8ad0ff, fx: ['#000', '#fff', '#5ab8ff', '#ff3a3a', '#5ab8ff'], debuff: { name: 'HERIDAS DE GUERRA', text: 'pierdes un 10% de vida al lanzarla', t: 0.1, hp: 0.1 } },
    portrait: { sheet: 'bardock', frame: 0 },
    forms: [
      form('BASE', 1, 'bardock', A_HD, 1.0, 1.0, 0xbfe4ff, 0, 0xffffff),
      form('SUPER SAIYAN', 13, 'bardock_ss', A_HD, 1.6, 1.14, 0xffe14a, 0xffd84a, 0xffffff),
      form('SUPER SAIYAN 4', 28, 'bardock_ss4', A_HD, 2.7, 1.26, 0xff6a5a, 0xff3a2a, 0xffffff)
    ]
  },
  {
    id: 'vegito', name: 'VEGETTO', role: 'Fusión Potara · Espada y rayos', cost: 9000,
    hp: 115, ki: 130, spd: 1.05, dmg: 1.15, start: ['vblade'], unique: ['vblade', 'vkame', 'excalibur', 'vhoming'],
    passive: { name: 'Fusión Potara', desc: '+10% de daño y +10% de cadencia de ataque.' },
    ult: { name: 'FINAL KAMEHAMEHA', key: 'Q', cost: 100, type: 'beam', dmg: 10, len: 66, hw: 3.4, life: 1.8, col: 0x8ad8ff, end: 'genkiBoom', fx: ['#000', '#fff', '#5ab8ff', '#ffe14a', '#5ab8ff'], debuff: { name: 'LÍMITE DE LA FUSIÓN', text: '-20% de daño y -15% de velocidad durante 8 s', t: 8, dmg: 0.2, spd: 0.15 } },
    portrait: { sheet: 'vegito', frame: 0 },
    forms: [
      form('BASE', 1, 'vegito', A_HD, 1.0, 1.0, 0xbfe4ff, 0, 0xffffff),
      form('SUPER VEGETTO', 12, 'vegito_ss', A_HD, 1.6, 1.15, 0xffe14a, 0xffd84a, 0xffffff),
      form('SUPER VEGETTO 2', 22, 'vegito_ss2', A_HD, 2.3, 1.22, 0xfff08a, 0xfff07a, 0xffffff),
      form('VEGETTO BLUE', 32, 'vegito_blue', A_HD, 3.3, 1.32, 0x6fd8ff, 0x4fc8ff, 0xffffff)
    ]
  },
  {
    id: 'gogeta', name: 'GOGETA', role: 'Danza de la fusión · Kamehameha', cost: 10000,
    hp: 115, ki: 130, spd: 1.08, dmg: 1.15, start: ['gblast2'], unique: ['gblast2', 'bbkame', 'meteorexp', 'soulpunisher'],
    passive: { name: 'Danza de la fusión', desc: '+12% de daño y la Ultimate se carga un 25% más rápido.' },
    ult: { name: 'BIG BANG KAMEHAMEHA', key: 'Q', cost: 100, type: 'beam', dmg: 11, len: 68, hw: 3.6, life: 1.8, col: 0x9fe0ff, end: 'bbBurst', fx: ['#000', '#fff', '#ffe14a', '#6fd8ff', '#ffe14a'], debuff: { name: 'FUSIÓN INESTABLE', text: 'el Ki no se regenera durante 10 s', t: 10, noki: true } },
    portrait: { sheet: 'gogeta_base', frame: 0 },
    // Base, SSJ2 y Blue son recoloreados del Super Gogeta del pack (pelo y aura con la paleta de Goku base y Vegetto Blue)
    forms: [
      form('BASE', 1, 'gogeta_base', A_HD, 1.0, 1.0, 0xbfe4ff, 0, 0xffffff),
      form('SUPER SAIYAN', 10, 'gogeta', A_HD, 1.6, 1.15, 0xffe14a, 0xffd84a, 0xffffff),
      form('SUPER SAIYAN 2', 20, 'gogeta_ss2', A_HD, 2.3, 1.22, 0xfff08a, 0xfff07a, 0xffffff),
      form('SUPER SAIYAN BLUE', 32, 'gogeta_blue', A_HD, 3.3, 1.32, 0x6fd8ff, 0x4fc8ff, 0xffffff)
    ]
  },
  {
    id: 'zamasuf', name: 'ZAMASU FUSIONADO', role: 'Fusión Potara · Juicio divino', cost: 12000,
    hp: 120, ki: 140, spd: 1.05, dmg: 1.18, start: ['zfblade'], unique: ['zfblade', 'zfspears', 'zfhalo', 'zfjudge'],
    passive: { name: 'Inmortalidad imperfecta', desc: '+15% de daño.', stat: { dmg: 0.15 } },
    ult: { name: 'RELÁMPAGO DE LA ABSOLUCIÓN', key: 'Q', cost: 100, type: 'storm', dmg: 36, n: 24, r: 30, fx: ['#000', '#fff', '#ff6ac8', '#d8ff9a', '#ff6ac8'], debuff: { name: 'CUERPO INESTABLE', text: 'pierdes un 2% de vida por segundo durante 6 s', t: 6, bleed: 0.02 } },
    portrait: { sheet: 'zamasuf', frame: 0 },
    forms: [
      form('FUSIONADO', 1, 'zamasuf', A_HD, 1.0, 1.0, 0xff6ac8, 0, 0xffffff),
      form('MEDIO CORROMPIDO', 14, 'zamasuf_cor', A_HD, 1.8, 1.18, 0xb06bff, 0xb06bff, 0xffffff),
      form('FUSIÓN DIVINA', 28, 'zamasuf_div', A_HD, 2.8, 1.3, 0xe8d8ff, 0xd8c8ff, 0xffffff)
    ]
  },
  {
    id: 'broly', name: 'BROLY', role: 'Berserker · Tanque', cost: 9500,
    hp: 150, ki: 110, spd: 0.92, dmg: 1.2, start: ['eraser'], unique: ['eraser', 'gigameteor', 'gigaroar', 'blaster'],
    passive: { name: 'Saiyajin Legendario', desc: 'Recibes un 12% menos de daño y haces un 30% más con menos de la mitad de vida.' },
    ult: { name: 'GIGANTIC METEOR', key: 'Q', cost: 100, type: 'bomb', dmg: 160, r: 24, sty: 'sun', col: 0x7dff5a, fx: ['#000', '#fff', '#3aff3a', '#ffe14a', '#1a4a1a'], debuff: { name: 'DESCONTROL', text: 'recibes un 30% más de daño durante 8 s', t: 8, take: 0.3 } },
    portrait: { sheet: 'broly', frame: 0 },
    forms: [
      form('BROLY CONTENIDO', 1, 'broly', A_HD, 1.0, 1.0, 0x9fe8c0, 0, 0xffffff),
      form('SUPER SAIYAN', 11, 'broly_ss', A_HD, 1.55, 1.08, 0xffe14a, 0xffd84a, 0xffffff),
      form('SUPER SAIYAN LEGENDARIO', 22, 'broly_lss', A_HD, 2.4, 1.12, 0x9aff6a, 0x7dff5a, 0xffffff),
      form('SUPER SAIYAN 4', 34, 'broly_ss4', A_HD, 3.4, 1.2, 0xff6a5a, 0xff3a2a, 0xffffff)
    ]
  },
  {
    id: 'kefla', name: 'KEFLA', role: 'Furia Saiyajin · Ráfagas', cost: 4000,
    hp: 110, ki: 130, spd: 1.1, dmg: 1.05, start: ['kefla_1'], unique: ['kefla_1', 'kefla_2', 'kefla_3', 'kefla_4'],
    passive: { name: 'Furia Saiyajin', desc: '+10% de daño.', stat: { dmg: 0.1 } },
    ult: { name: 'GOLPE SUPREMO', key: 'Q', cost: 100, type: 'beam', dmg: 10, len: 46, hw: 2.4, life: 1.6, col: 0xff8ad8, fx: ['#000', '#fff', '#ff8ad8', '#b8ff5a', '#ff8ad8'], debuff: { name: 'FURIA AGOTADA', text: '-20% de velocidad durante 6 s', t: 6, spd: 0.2 } },
    portrait: { sheet: 'kefla', frame: 0 },
    forms: [
      form('BASE', 1, 'kefla', A_HD, 1.0, 1.0, 0xb8ff5a, 0, 0xffffff),
      form('DESPERTAR', 10, 'kefla', A_HD, 1.4, 1.1, 0xb8ff5a, 0xb8ff5a, 0xfff8e8),
      form('MODO GUERRERO', 22, 'kefla', A_HD, 1.9, 1.2, 0xb8ff5a, 0xb8ff5a, 0xffeedd),
      form('PODER MÁXIMO', 34, 'kefla', A_HD, 2.5, 1.3, 0xb8ff5a, 0xb8ff5a, 0xffffff)
    ]
  },
  {
    id: 'gotenks', name: 'GOTENKS', role: 'Fusión infantil · Caos', cost: 4500,
    hp: 100, ki: 120, spd: 1.2, dmg: 1.0, start: ['gotenks_1'], unique: ['gotenks_1', 'gotenks_2', 'gotenks_3', 'gotenks_4'],
    passive: { name: 'Fusión infantil', desc: '+8% de velocidad.', stat: { spd: 0.08 } },
    ult: { name: 'SUPER GHOST KAMIKAZE', key: 'Q', cost: 100, type: 'storm', dmg: 30, n: 20, r: 28, fx: ['#000', '#fff', '#c8a0ff', '#ffe14a', '#c8a0ff'], debuff: { name: 'MAREO', text: 'el Ki no se regenera durante 7 s', t: 7, noki: true } },
    portrait: { sheet: 'gotenks', frame: 0 },
    forms: [
      form('BASE', 1, 'gotenks', A_HD, 1.0, 1.0, 0xc8a0ff, 0, 0xffffff),
      form('DESPERTAR', 10, 'gotenks', A_HD, 1.4, 1.1, 0xc8a0ff, 0xc8a0ff, 0xfff8e8),
      form('MODO GUERRERO', 22, 'gotenks', A_HD, 1.9, 1.2, 0xc8a0ff, 0xc8a0ff, 0xffeedd),
      form('PODER MÁXIMO', 34, 'gotenks', A_HD, 2.5, 1.3, 0xc8a0ff, 0xc8a0ff, 0xffffff)
    ]
  },
  {
    id: 'trunksarm', name: 'TRUNKS ARMADURA', role: 'Espadachín blindado', cost: 5000,
    hp: 115, ki: 110, spd: 1.05, dmg: 1.1, start: ['trunksarm_1'], unique: ['trunksarm_1', 'trunksarm_2', 'trunksarm_3', 'trunksarm_4'],
    passive: { name: 'Armadura del futuro', desc: '+8% de esquiva.', stat: { dodge: 0.08 } },
    ult: { name: 'ESPADA DEL FUTURO', key: 'Q', cost: 100, type: 'slash', dmg: 45, r: 14, fx: ['#000', '#fff', '#9fe0ff', '#6fb8ff', '#ffd040'], debuff: { name: 'BRAZOS CANSADOS', text: '-25% de daño durante 8 s', t: 8, dmg: 0.25 } },
    portrait: { sheet: 'trunksarm', frame: 0 },
    forms: [
      form('BASE', 1, 'trunksarm', A_HD, 1.0, 1.0, 0x6fb8ff, 0, 0xffffff),
      form('DESPERTAR', 10, 'trunksarm', A_HD, 1.4, 1.1, 0x6fb8ff, 0x6fb8ff, 0xfff8e8),
      form('MODO GUERRERO', 22, 'trunksarm', A_HD, 1.9, 1.2, 0x6fb8ff, 0x6fb8ff, 0xffeedd),
      form('PODER MÁXIMO', 34, 'trunksarm', A_HD, 2.5, 1.3, 0x6fb8ff, 0x6fb8ff, 0xffffff)
    ]
  },
  {
    id: 'caulifla', name: 'CAULIFLA', role: 'Potencia salvaje · Ki rosa', cost: 3500,
    hp: 100, ki: 120, spd: 1.15, dmg: 1.0, start: ['caulifla_1'], unique: ['caulifla_1', 'caulifla_2', 'caulifla_3', 'caulifla_4'],
    passive: { name: 'Salvaje', desc: '+8% de daño.', stat: { dmg: 0.08 } },
    ult: { name: 'GALICK SALVAJE', key: 'Q', cost: 100, type: 'beam', dmg: 9, len: 44, hw: 2.5, life: 1.5, col: 0xff6aa0, fx: ['#000', '#fff', '#ff6aa0', '#ffd0e0', '#ff6aa0'], debuff: { name: 'AGOTADA', text: '-25% de daño durante 7 s', t: 7, dmg: 0.25 } },
    portrait: { sheet: 'caulifla', frame: 0 },
    forms: [
      form('BASE', 1, 'caulifla', A_HD, 1.0, 1.0, 0xff6aa0, 0, 0xffffff),
      form('DESPERTAR', 10, 'caulifla', A_HD, 1.4, 1.1, 0xff6aa0, 0xff6aa0, 0xfff8e8),
      form('MODO GUERRERO', 22, 'caulifla', A_HD, 1.9, 1.2, 0xff6aa0, 0xff6aa0, 0xffeedd),
      form('PODER MÁXIMO', 34, 'caulifla', A_HD, 2.5, 1.3, 0xff6aa0, 0xff6aa0, 0xffffff)
    ]
  },
  {
    id: 'kale', name: 'KALE SSJ', role: 'Berserker · Golpes pesados', cost: 5000,
    hp: 130, ki: 100, spd: 1.0, dmg: 1.15, start: ['kale_1'], unique: ['kale_1', 'kale_2', 'kale_3', 'kale_4'],
    passive: { name: 'Furia berserker', desc: '+12% de daño y -5% de velocidad.', stat: { dmg: 0.12, spd: -0.05 } },
    ult: { name: 'ALARIDO KALE', key: 'Q', cost: 100, type: 'bomb', dmg: 120, r: 20, sty: 'genki', col: 0xffd040, fx: ['#000', '#fff', '#ffd040', '#ff7a2a', '#ffd040'], debuff: { name: 'RESACA', text: '-15% de velocidad durante 8 s', t: 8, spd: 0.15 } },
    portrait: { sheet: 'kale', frame: 0 },
    forms: [
      form('BASE', 1, 'kale', A_HD, 1.0, 1.0, 0xffd040, 0, 0xffffff),
      form('DESPERTAR', 10, 'kale', A_HD, 1.4, 1.1, 0xffd040, 0xffd040, 0xfff8e8),
      form('MODO GUERRERO', 22, 'kale', A_HD, 1.9, 1.2, 0xffd040, 0xffd040, 0xffeedd),
      form('PODER MÁXIMO', 34, 'kale', A_HD, 2.5, 1.3, 0xffd040, 0xffd040, 0xffffff)
    ]
  },
  {
    id: 'kyabe', name: 'KYABE SSJ', role: 'Ki atómico · Discos', cost: 4000,
    hp: 100, ki: 125, spd: 1.1, dmg: 1.0, start: ['kyabe_1'], unique: ['kyabe_1', 'kyabe_2', 'kyabe_3', 'kyabe_4'],
    passive: { name: 'Ki atómico', desc: '+4% de daño y +4% de velocidad.', stat: { spd: 0.04, dmg: 0.04 } },
    ult: { name: 'LLUVIA DE DISCOS', key: 'Q', cost: 100, type: 'discs', dmg: 55, n: 14, fx: ['#000', '#fff', '#ffe86a', '#fff', '#ffb040'], debuff: { name: 'SIN ALIENTO', text: 'sin dash durante 5 s', t: 5, nodash: true } },
    portrait: { sheet: 'kyabe', frame: 0 },
    forms: [
      form('BASE', 1, 'kyabe', A_HD, 1.0, 1.0, 0xffe86a, 0, 0xffffff),
      form('DESPERTAR', 10, 'kyabe', A_HD, 1.4, 1.1, 0xffe86a, 0xffe86a, 0xfff8e8),
      form('MODO GUERRERO', 22, 'kyabe', A_HD, 1.9, 1.2, 0xffe86a, 0xffe86a, 0xffeedd),
      form('PODER MÁXIMO', 34, 'kyabe', A_HD, 2.5, 1.3, 0xffe86a, 0xffe86a, 0xffffff)
    ]
  },
  {
    id: 'toppo', name: 'TOPPO', role: 'Justicia de Pride · Esferas', cost: 6000,
    hp: 125, ki: 115, spd: 1.0, dmg: 1.1, start: ['toppo_1'], unique: ['toppo_1', 'toppo_2', 'toppo_3', 'toppo_4'],
    passive: { name: 'Orgullo de Pride', desc: '+5% de daño y +4% de esquiva.', stat: { dmg: 0.05, dodge: 0.04 } },
    ult: { name: 'JUSTICIA DE PRIDE', key: 'Q', cost: 100, type: 'storm', dmg: 36, n: 22, r: 32, fx: ['#000', '#fff', '#ff4a4a', '#ffe14a', '#ff4a4a'], debuff: { name: 'TENSIÓN', text: 'recibes un 20% más de daño durante 6 s', t: 6, take: 0.2 } },
    portrait: { sheet: 'toppo', frame: 0 },
    forms: [
      form('BASE', 1, 'toppo', A_HD, 1.0, 1.0, 0xff4a4a, 0, 0xffffff),
      form('DESPERTAR', 10, 'toppo', A_HD, 1.4, 1.1, 0xff4a4a, 0xff4a4a, 0xfff8e8),
      form('MODO GUERRERO', 22, 'toppo', A_HD, 1.9, 1.2, 0xff4a4a, 0xff4a4a, 0xffeedd),
      form('PODER MÁXIMO', 34, 'toppo', A_HD, 2.5, 1.3, 0xff4a4a, 0xff4a4a, 0xffffff)
    ]
  },
  {
    id: 'janemba', name: 'JANEMBA', role: 'Demonio del caos · Rupturas', cost: 6500,
    hp: 115, ki: 120, spd: 1.05, dmg: 1.15, start: ['janemba_1'], unique: ['janemba_1', 'janemba_2', 'janemba_3', 'janemba_4'],
    passive: { name: 'Caos', desc: '+15% de daño.', stat: { dmg: 0.15 } },
    ult: { name: 'RUPTURA DEL CAOS', key: 'Q', cost: 100, type: 'slash', dmg: 50, r: 15, fx: ['#000', '#fff', '#ff3a3a', '#7a4aff', '#ff3a3a'], debuff: { name: 'CUERPO CORRUPTO', text: 'pierdes un 2% de vida por segundo durante 5 s', t: 5, bleed: 0.02 } },
    portrait: { sheet: 'janemba', frame: 0 },
    forms: [
      form('BASE', 1, 'janemba', A_HD, 1.0, 1.0, 0xff3a3a, 0, 0xffffff),
      form('DESPERTAR', 10, 'janemba', A_HD, 1.4, 1.1, 0xff3a3a, 0xff3a3a, 0xfff8e8),
      form('MODO GUERRERO', 22, 'janemba', A_HD, 1.9, 1.2, 0xff3a3a, 0xff3a3a, 0xffeedd),
      form('PODER MÁXIMO', 34, 'janemba', A_HD, 2.5, 1.3, 0xff3a3a, 0xff3a3a, 0xffffff)
    ]
  },
  {
    id: 'jiren', name: 'JIREN', role: 'Guerrero del Torneo · Golpes', cost: 8000,
    hp: 130, ki: 120, spd: 1.0, dmg: 1.2, start: ['jiren_1'], unique: ['jiren_1', 'jiren_2', 'jiren_3', 'jiren_4'],
    passive: { name: 'Poder del Torneo', desc: '+12% de daño y +6% de esquiva.', stat: { dmg: 0.12, dodge: 0.06 } },
    ult: { name: 'GOLPE DEL TORNEO', key: 'Q', cost: 100, type: 'beam', dmg: 12, len: 50, hw: 3.0, life: 1.7, col: 0xd0d0d8, fx: ['#000', '#fff', '#d0d0d8', '#ff3a3a', '#d0d0d8'], debuff: { name: 'ESFUERZO', text: '-15% de velocidad durante 7 s', t: 7, spd: 0.15 } },
    portrait: { sheet: 'jiren', frame: 0 },
    forms: [
      form('BASE', 1, 'jiren', A_HD, 1.0, 1.0, 0xd0d0d8, 0, 0xffffff),
      form('DESPERTAR', 10, 'jiren', A_HD, 1.4, 1.1, 0xd0d0d8, 0xd0d0d8, 0xfff8e8),
      form('MODO GUERRERO', 22, 'jiren', A_HD, 1.9, 1.2, 0xd0d0d8, 0xd0d0d8, 0xffeedd),
      form('PODER MÁXIMO', 34, 'jiren', A_HD, 2.5, 1.3, 0xd0d0d8, 0xd0d0d8, 0xffffff)
    ]
  },
  {
    id: 'turles', name: 'TURLES', role: 'Saiyajin ambicioso · Discos', cost: 5500,
    hp: 110, ki: 120, spd: 1.1, dmg: 1.05, start: ['turles_1'], unique: ['turles_1', 'turles_2', 'turles_3', 'turles_4'],
    passive: { name: 'Ambición', desc: '+10% de velocidad.', stat: { spd: 0.1 } },
    ult: { name: 'DISCO DE TURLES', key: 'Q', cost: 100, type: 'discs', dmg: 60, n: 12, fx: ['#000', '#fff', '#c8c8ff', '#fff', '#ffb040'], debuff: { name: 'ENTRENAMIENTO', text: 'sin dash durante 5 s', t: 5, nodash: true } },
    portrait: { sheet: 'turles', frame: 0 },
    forms: [
      form('BASE', 1, 'turles', A_HD, 1.0, 1.0, 0xc8c8ff, 0, 0xffffff),
      form('DESPERTAR', 10, 'turles', A_HD, 1.4, 1.1, 0xc8c8ff, 0xc8c8ff, 0xfff8e8),
      form('MODO GUERRERO', 22, 'turles', A_HD, 1.9, 1.2, 0xc8c8ff, 0xc8c8ff, 0xffeedd),
      form('PODER MÁXIMO', 34, 'turles', A_HD, 2.5, 1.3, 0xc8c8ff, 0xc8c8ff, 0xffffff)
    ]
  },
  {
    id: 'saibaman', name: 'SAIBAMAN', role: 'Explosivo · Enjambre', cost: 2500,
    hp: 90, ki: 110, spd: 1.15, dmg: 0.95, start: ['saibaman_1'], unique: ['saibaman_1', 'saibaman_2', 'saibaman_3', 'saibaman_4'],
    passive: { name: 'Explosivo', desc: '+10% de velocidad.', stat: { spd: 0.1 } },
    ult: { name: 'ENJAMBRE SAIBAMAN', key: 'Q', cost: 100, type: 'storm', dmg: 28, n: 24, r: 30, fx: ['#000', '#fff', '#9ad040', '#ffe14a', '#9ad040'], debuff: { name: 'AGOTADO', text: '-15% de daño durante 6 s', t: 6, dmg: 0.15 } },
    portrait: { sheet: 'saibaman', frame: 0 },
    forms: [
      form('BASE', 1, 'saibaman', A_HD, 1.0, 1.0, 0x9ad040, 0, 0xffffff),
      form('DESPERTAR', 10, 'saibaman', A_HD, 1.4, 1.1, 0x9ad040, 0x9ad040, 0xfff8e8),
      form('MODO GUERRERO', 22, 'saibaman', A_HD, 1.9, 1.2, 0x9ad040, 0x9ad040, 0xffeedd),
      form('PODER MÁXIMO', 34, 'saibaman', A_HD, 2.5, 1.3, 0x9ad040, 0x9ad040, 0xffffff)
    ]
  },
  {
    id: 'bills', name: 'BILLS', role: 'Dios de la destrucción · Esferas', cost: 8000,
    hp: 120, ki: 130, spd: 1.05, dmg: 1.15, start: ['bills_1'], unique: ['bills_1', 'bills_2', 'bills_3', 'bills_4'],
    passive: { name: 'Dios de la destrucción', desc: '+5% de daño y +5% de esquiva.', stat: { dmg: 0.05, dodge: 0.05 } },
    ult: { name: 'DESTRUCCIÓN DE BILLS', key: 'Q', cost: 100, type: 'bomb', dmg: 150, r: 22, sty: 'db', col: 0xb08aff, fx: ['#000', '#fff', '#8a2aff', '#ff3fa0', '#2a0040'], debuff: { name: 'PEREZA DIVINA', text: '-20% de velocidad durante 7 s', t: 7, spd: 0.2 } },
    portrait: { sheet: 'bills', frame: 0 },
    forms: [
      form('BASE', 1, 'bills', A_HD, 1.0, 1.0, 0xb08aff, 0, 0xffffff),
      form('DESPERTAR', 10, 'bills', A_HD, 1.4, 1.1, 0xb08aff, 0xb08aff, 0xfff8e8),
      form('MODO GUERRERO', 22, 'bills', A_HD, 1.9, 1.2, 0xb08aff, 0xb08aff, 0xffeedd),
      form('PODER MÁXIMO', 34, 'bills', A_HD, 2.5, 1.3, 0xb08aff, 0xb08aff, 0xffffff)
    ]
  },
  {
    id: 'cooler', name: 'COOLER', role: 'Hermano del tirano · Rayos', cost: 7000,
    hp: 115, ki: 125, spd: 1.05, dmg: 1.1, start: ['cooler_1'], unique: ['cooler_1', 'cooler_2', 'cooler_3', 'cooler_4'],
    passive: { name: 'Linaje del tirano', desc: '+10% de daño.', stat: { dmg: 0.1 } },
    ult: { name: 'RAYO DEL TIRANO', key: 'Q', cost: 100, type: 'beam', dmg: 11, len: 52, hw: 3.2, life: 1.7, col: 0xd080ff, fx: ['#000', '#fff', '#d080ff', '#ffe14a', '#d080ff'], debuff: { name: 'SIN KI', text: 'el Ki no se regenera durante 6 s', t: 6, noki: true } },
    portrait: { sheet: 'cooler', frame: 0 },
    forms: [
      form('BASE', 1, 'cooler', A_HD, 1.0, 1.0, 0xd080ff, 0, 0xffffff),
      form('DESPERTAR', 10, 'cooler', A_HD, 1.4, 1.1, 0xd080ff, 0xd080ff, 0xfff8e8),
      form('MODO GUERRERO', 22, 'cooler', A_HD, 1.9, 1.2, 0xd080ff, 0xd080ff, 0xffeedd),
      form('PODER MÁXIMO', 34, 'cooler', A_HD, 2.5, 1.3, 0xd080ff, 0xd080ff, 0xffffff)
    ]
  },
  {
    id: 'hitto', name: 'HIT', role: 'Asesino del tiempo · Prisiones', cost: 7500,
    hp: 110, ki: 120, spd: 1.1, dmg: 1.1, start: ['hitto_1'], unique: ['hitto_1', 'hitto_2', 'hitto_3', 'hitto_4'],
    passive: { name: 'Pausa del tiempo', desc: '+10% de velocidad al atacar.', stat: { spd: 0.1 } },
    ult: { name: 'CORTE TEMPORAL', key: 'Q', cost: 100, type: 'slash', dmg: 48, r: 15, fx: ['#000', '#fff', '#8a6aff', '#c8a0ff', '#8a6aff'], debuff: { name: 'TIEMPO ROTO', text: '-20% de daño durante 6 s', t: 6, dmg: 0.2 } },
    portrait: { sheet: 'hitto', frame: 0 },
    forms: [
      form('BASE', 1, 'hitto', A_HD, 1.0, 1.0, 0x8a6aff, 0, 0xffffff),
      form('DESPERTAR', 10, 'hitto', A_HD, 1.4, 1.1, 0x8a6aff, 0x8a6aff, 0xfff8e8),
      form('MODO GUERRERO', 22, 'hitto', A_HD, 1.9, 1.2, 0x8a6aff, 0x8a6aff, 0xffeedd),
      form('PODER MÁXIMO', 34, 'hitto', A_HD, 2.5, 1.3, 0x8a6aff, 0x8a6aff, 0xffffff)
    ]
  },
  {
    id: 'raditz', name: 'RADITZ', role: 'Saiyajin de la Tierra · Ráfagas', cost: 3000,
    hp: 105, ki: 115, spd: 1.1, dmg: 1.0, start: ['raditz_1'], unique: ['raditz_1', 'raditz_2', 'raditz_3', 'raditz_4'],
    passive: { name: 'Hermano mayor', desc: '+8% de daño.', stat: { dmg: 0.08 } },
    ult: { name: 'DISCO DE RADITZ', key: 'Q', cost: 100, type: 'discs', dmg: 50, n: 12, fx: ['#000', '#fff', '#c8ff8a', '#fff', '#ffb040'], debuff: { name: 'CANSANCIO', text: '-15% de velocidad durante 6 s', t: 6, spd: 0.15 } },
    portrait: { sheet: 'raditz', frame: 0 },
    forms: [
      form('BASE', 1, 'raditz', A_HD, 1.0, 1.0, 0xc8ff8a, 0, 0xffffff),
      form('DESPERTAR', 10, 'raditz', A_HD, 1.4, 1.1, 0xc8ff8a, 0xc8ff8a, 0xfff8e8),
      form('MODO GUERRERO', 22, 'raditz', A_HD, 1.9, 1.2, 0xc8ff8a, 0xc8ff8a, 0xffeedd),
      form('PODER MÁXIMO', 34, 'raditz', A_HD, 2.5, 1.3, 0xc8ff8a, 0xc8ff8a, 0xffffff)
    ]
  },
  {
    id: 'andro16', name: 'ANDROIDE 16', role: 'Androide de combate · Ki', cost: 6000,
    hp: 125, ki: 120, spd: 1.0, dmg: 1.05, start: ['andro16_1'], unique: ['andro16_1', 'andro16_2', 'andro16_3', 'andro16_4'],
    passive: { name: 'Bioandroide', desc: '+5% de daño y +4% de esquiva.', stat: { dmg: 0.05, dodge: 0.04 } },
    ult: { name: 'RAYO DEL ANDROIDE', key: 'Q', cost: 100, type: 'beam', dmg: 10, len: 46, hw: 2.8, life: 1.6, col: 0x7dff5a, fx: ['#000', '#fff', '#7dff5a', '#ffe14a', '#7dff5a'], debuff: { name: 'SOBRECARGA', text: '-20% de velocidad durante 6 s', t: 6, spd: 0.2 } },
    portrait: { sheet: 'andro16', frame: 0 },
    forms: [
      form('BASE', 1, 'andro16', A_HD, 1.0, 1.0, 0x7dff5a, 0, 0xffffff),
      form('DESPERTAR', 10, 'andro16', A_HD, 1.4, 1.1, 0x7dff5a, 0x7dff5a, 0xfff8e8),
      form('MODO GUERRERO', 22, 'andro16', A_HD, 1.9, 1.2, 0x7dff5a, 0x7dff5a, 0xffeedd),
      form('PODER MÁXIMO', 34, 'andro16', A_HD, 2.5, 1.3, 0x7dff5a, 0x7dff5a, 0xffffff)
    ]
  },
  {
    id: 'andro17', name: 'ANDROIDE 17', role: 'Androide infinito · Discos', cost: 6500,
    hp: 115, ki: 125, spd: 1.1, dmg: 1.0, start: ['andro17_1'], unique: ['andro17_1', 'andro17_2', 'andro17_3', 'andro17_4'],
    passive: { name: 'Energía infinita', desc: '+12% de esquiva.', stat: { dodge: 0.12 } },
    ult: { name: 'DISCO INFINITO', key: 'Q', cost: 100, type: 'discs', dmg: 55, n: 12, fx: ['#000', '#fff', '#6ab8ff', '#fff', '#9fe0ff'], debuff: { name: 'REPOSO', text: 'sin dash durante 5 s', t: 5, nodash: true } },
    portrait: { sheet: 'andro17', frame: 0 },
    forms: [
      form('BASE', 1, 'andro17', A_HD, 1.0, 1.0, 0x6ab8ff, 0, 0xffffff),
      form('DESPERTAR', 10, 'andro17', A_HD, 1.4, 1.1, 0x6ab8ff, 0x6ab8ff, 0xfff8e8),
      form('MODO GUERRERO', 22, 'andro17', A_HD, 1.9, 1.2, 0x6ab8ff, 0x6ab8ff, 0xffeedd),
      form('PODER MÁXIMO', 34, 'andro17', A_HD, 2.5, 1.3, 0x6ab8ff, 0x6ab8ff, 0xffffff)
    ]
  },
  {
    id: 'andro18', name: 'ANDROIDE 18', role: 'Androide sigiloso · Esquiva', cost: 6000,
    hp: 105, ki: 120, spd: 1.15, dmg: 1.0, start: ['andro18_1'], unique: ['andro18_1', 'andro18_2', 'andro18_3', 'andro18_4'],
    passive: { name: 'Sigilo', desc: '+12% de esquiva y +5% de velocidad.', stat: { dodge: 0.12, spd: 0.05 } },
    ult: { name: 'TORMENTA DEL 18', key: 'Q', cost: 100, type: 'storm', dmg: 30, n: 20, r: 28, fx: ['#000', '#fff', '#ffe86a', '#fff', '#ffb040'], debuff: { name: 'SIN KI', text: 'el Ki no se regenera durante 6 s', t: 6, noki: true } },
    portrait: { sheet: 'andro18', frame: 0 },
    forms: [
      form('BASE', 1, 'andro18', A_HD, 1.0, 1.0, 0xffe86a, 0, 0xffffff),
      form('DESPERTAR', 10, 'andro18', A_HD, 1.4, 1.1, 0xffe86a, 0xffe86a, 0xfff8e8),
      form('MODO GUERRERO', 22, 'andro18', A_HD, 1.9, 1.2, 0xffe86a, 0xffe86a, 0xffeedd),
      form('PODER MÁXIMO', 34, 'andro18', A_HD, 2.5, 1.3, 0xffe86a, 0xffe86a, 0xffffff)
    ]
  },
  {
    id: 'majin', name: 'MAJIN BUU', role: 'Mago rosa · Ataques de boca', cost: 7000,
    hp: 130, ki: 115, spd: 0.95, dmg: 1.1, start: ['majin_1'], unique: ['majin_1', 'majin_2', 'majin_3', 'majin_4'],
    passive: { name: 'Regeneración de Buu', desc: '+4% de daño y +2% de esquiva.', stat: { dmg: 0.04, dodge: 0.02 } },
    ult: { name: 'CARAMELO DE BUU', key: 'Q', cost: 100, type: 'bomb', dmg: 130, r: 20, sty: 'genki', col: 0xff9ad0, fx: ['#000', '#fff', '#ff9ad0', '#ffd0ec', '#ff9ad0'], debuff: { name: 'PESO', text: '-20% de velocidad durante 7 s', t: 7, spd: 0.2 } },
    portrait: { sheet: 'majin', frame: 0 },
    forms: [
      form('BASE', 1, 'majin', A_HD, 1.0, 1.0, 0xff9ad0, 0, 0xffffff),
      form('DESPERTAR', 10, 'majin', A_HD, 1.4, 1.1, 0xff9ad0, 0xff9ad0, 0xfff8e8),
      form('MODO GUERRERO', 22, 'majin', A_HD, 1.9, 1.2, 0xff9ad0, 0xff9ad0, 0xffeedd),
      form('PODER MÁXIMO', 34, 'majin', A_HD, 2.5, 1.3, 0xff9ad0, 0xff9ad0, 0xffffff)
    ]
  },
  {
    id: 'superbuu', name: 'SUPER BUU', role: 'Buu evolucionado · Rayos', cost: 7500,
    hp: 125, ki: 125, spd: 1.05, dmg: 1.15, start: ['superbuu_1'], unique: ['superbuu_1', 'superbuu_2', 'superbuu_3', 'superbuu_4'],
    passive: { name: 'Evolución', desc: '+15% de daño.', stat: { dmg: 0.15 } },
    ult: { name: 'GALAXIA DE BUU', key: 'Q', cost: 100, type: 'beam', dmg: 11, len: 52, hw: 3.2, life: 1.7, col: 0xff7ac8, fx: ['#000', '#fff', '#ff7ac8', '#ffe14a', '#ff7ac8'], debuff: { name: 'AGOTADO', text: '-20% de daño durante 7 s', t: 7, dmg: 0.2 } },
    portrait: { sheet: 'superbuu', frame: 0 },
    forms: [
      form('BASE', 1, 'superbuu', A_HD, 1.0, 1.0, 0xff7ac8, 0, 0xffffff),
      form('DESPERTAR', 10, 'superbuu', A_HD, 1.4, 1.1, 0xff7ac8, 0xff7ac8, 0xfff8e8),
      form('MODO GUERRERO', 22, 'superbuu', A_HD, 1.9, 1.2, 0xff7ac8, 0xff7ac8, 0xffeedd),
      form('PODER MÁXIMO', 34, 'superbuu', A_HD, 2.5, 1.3, 0xff7ac8, 0xff7ac8, 0xffffff)
    ]
  },
  {
    id: 'zamasu', name: 'ZAMASU', role: 'Dios inmortal · Cuchillas', cost: 7500,
    hp: 110, ki: 125, spd: 1.1, dmg: 1.1, start: ['zamasu_1'], unique: ['zamasu_1', 'zamasu_2', 'zamasu_3', 'zamasu_4'],
    passive: { name: 'Inmortal', desc: '+10% de esquiva.', stat: { dodge: 0.1 } },
    ult: { name: 'CUCHILLA DIVINA', key: 'Q', cost: 100, type: 'slash', dmg: 50, r: 16, fx: ['#000', '#fff', '#a890ff', '#c8b8ff', '#a890ff'], debuff: { name: 'DESPRECIO', text: '-20% de daño durante 6 s', t: 6, dmg: 0.2 } },
    portrait: { sheet: 'zamasu', frame: 0 },
    forms: [
      form('BASE', 1, 'zamasu', A_HD, 1.0, 1.0, 0xa890ff, 0, 0xffffff),
      form('DESPERTAR', 10, 'zamasu', A_HD, 1.4, 1.1, 0xa890ff, 0xa890ff, 0xfff8e8),
      form('MODO GUERRERO', 22, 'zamasu', A_HD, 1.9, 1.2, 0xa890ff, 0xa890ff, 0xffeedd),
      form('PODER MÁXIMO', 34, 'zamasu', A_HD, 2.5, 1.3, 0xa890ff, 0xa890ff, 0xffffff)
    ]
  },
];
const ULT_KI = 0.25;   // la Ultimate cuesta un 25% del Ki máximo, además de tener la barra llena
const charById = (id) => CHARACTERS.find((c) => c.id === id);

/* ---------- Armas (hasta nivel 5). `unique`: solo aparecen para ese personaje ---------- */
const WEAPONS = {
  ki: { name: 'Bolas de Ki', icon: '✦', kind: 'bullet', unique: 'goku', lv: ['Goku lanza bolas de ki al enemigo más cercano.', '+18% de daño.', '+1 proyectil.', 'Las ráfagas atraviesan a 1 enemigo.', '+1 proyectil y +30% de cadencia.'] },
  masenko: { name: 'Masenko', icon: '✺', kind: 'fan', lv: ['Abanico de 3 ráfagas de corto alcance.', '+15% de daño.', '+2 ráfagas.', 'Mayor alcance y daño.', '+2 ráfagas y +30% de cadencia.'] },
  dodonpa: { name: 'Dodonpa', icon: '➤', kind: 'ray', lv: ['Rayo veloz que atraviesa a todos.', '+30% de daño.', 'Menor tiempo de recarga.', '+30% de daño y +1 rayo.', '+30% de daño y recarga mínima.'] },
  orbit: { name: 'Esferas Orbitales', icon: '◉', kind: 'orbit', lv: ['2 esferas giran a tu alrededor dañando a quien toquen.', '+1 esfera.', 'Mayor daño.', '+1 esfera y más radio.', 'Giran más rápido y dañan más.'] },
  mines: { name: 'Minas de Energía', icon: '✹', kind: 'mines', lv: ['Dejas minas que explotan al acercarse un enemigo.', '+30% de daño.', 'Explosión más grande.', 'Colocas minas más rápido.', '+40% de daño y +2 minas máx.'] },
  rain: { name: 'Lluvia de Ki', icon: '☄', kind: 'rain', lv: ['Proyectiles caen del cielo sobre tus enemigos.', '+1 impacto.', '+35% de daño.', '+1 impacto y área mayor.', '+2 impactos y recarga menor.'] },
  nova: { name: 'Pulso de Poder', icon: '✸', kind: 'nova', lv: ['Onda expansiva periódica que empuja y daña.', '+40% de daño.', 'Mayor radio.', 'Se lanza dos veces seguidas.', '+40% de daño y recarga menor.'] },
  vtriple: { name: 'Ráfaga Triple', icon: '✦', kind: 'splitblast', unique: 'vegeta', minLv: 3, shop: 2600, color: 0xb06bff, lv: ['Esferas de ki violeta que se dividen en dos a mitad de camino.', '+20% de daño.', '+1 esfera.', 'Recarga reducida.', '+1 esfera y +30% de cadencia.'] },
  vblast: { name: 'Ráfaga Explosiva', icon: '✦', kind: 'blast', unique: 'vegeta', color: 0xb06bff, lv: ['Esferas de ki violeta que explotan al impactar.', '+20% de daño.', '+1 esfera.', 'Explosión más grande.', '+1 esfera y +30% de cadencia.'] },
  kamehameha: { name: 'Kamehameha', icon: '≋', kind: 'beam', unique: 'goku', minLv: 3, color: 0x6fd0ff, lv: ['Rayo devastador en línea recta.', '+55% de daño.', 'Rayo más largo y ancho.', 'Recarga reducida.', '¡Kamehameha definitivo! Daño y tamaño máximos.'] },
  galick: { name: 'Galick Ho', icon: '≋', kind: 'beam', unique: 'vegeta', minLv: 4, color: 0xb06bff, lv: ['Cañón de energía violeta en línea recta.', '+55% de daño.', 'Rayo más largo y ancho.', 'Recarga reducida.', 'Galick definitivo. Daño y tamaño máximos.'] },
  bigbang: { name: 'Big Bang Attack', icon: '●', kind: 'bigbang', unique: 'vegeta', minLv: 6, color: 0x8ad0ff, look: 'bbOrb', boomFx: 'bbBoom', stamp: 'bbTxt', lv: ['Esfera lenta que explota con gran área.', '+35% de daño.', 'Explosión mayor.', 'Recarga reducida.', '+35% de daño y doble esfera.'] },
  scythe: { name: 'Guadaña Divina', icon: '☾', kind: 'scythe', unique: 'black', color: 0xb26bff, lv: ['Tajo en arco frente a ti.', '+40% de daño.', 'Doble tajo.', 'Mayor alcance.', 'Tajo circular completo.'] },
  darkorbs: { name: 'Esferas de Ki Oscuro', icon: '◍', kind: 'orbit', unique: 'black', minLv: 3, color: 0xb26bff, lv: ['Esferas oscuras orbitan a tu alrededor.', '+1 esfera.', 'Mayor daño.', '+1 esfera y más radio.', 'Giran más rápido y dañan más.'] },

  /* ----- Técnicas de la TIENDA: se compran con monedas y entonces pueden salir al subir de nivel ----- */
  genkidama: { name: 'Genkidama', icon: '☀', kind: 'genki', unique: 'goku', shop: 4000, minLv: 6, color: 0x9fe8ff, sty: 'genki', lv: ['Reúne energía del cielo y deja caer una esfera gigante.', '+50% de daño.', 'Área mayor.', 'Recarga reducida.', 'Genkidama definitiva: daño y área máximos.'] },
  kaioken: { name: 'Kaio-ken', icon: '♨', kind: 'kaioken', unique: 'goku', shop: 1500, minLv: 4, color: 0xff3030, lv: ['Durante unos segundos: +40% de daño y +20% de velocidad.', 'Dura más.', '+10% de daño extra.', 'Recarga reducida.', 'Kaio-ken x20: dura mucho más y +20% de daño.'] },
  finalflash: { name: 'Final Flash', icon: '✷', kind: 'bigbeam', unique: 'vegeta', shop: 3500, minLv: 6, color: 0xffe14a, end: 'ffBoom', cfg: { cd: 11, dmg: 16, len: 42, hw: 3.2, life: 1.3, cost: 25 }, lv: ['Descarga masiva de ki amarillo en línea recta.', '+40% de daño.', 'Rayo más largo y ancho.', 'Recarga reducida.', 'Final Flash definitivo.'] },
  finalexp: { name: 'Explosión Final', icon: '☢', kind: 'selfblast', unique: 'vegeta', shop: 3000, minLv: 8, color: 0xff8a3a, sty: 'fire', lv: ['Explotas con enorme área, pero pierdes un 12% de vida.', '+50% de daño.', 'Área mayor.', 'Recarga reducida.', 'Explosión devastadora.'] },
  judgement: { name: 'Juicio Divino', icon: '⚡', kind: 'bigbeam', unique: 'black', shop: 3500, minLv: 6, color: 0xff7ac8, cfg: { cd: 10, dmg: 14, len: 38, hw: 2.6, life: 1.2, cost: 20 }, lv: ['Rayo rosado de justicia divina.', '+40% de daño.', 'Rayo más largo y ancho.', 'Recarga reducida.', 'Juicio definitivo.'] },
  kienzan: { name: 'Kienzan', icon: '◌', kind: 'discs', shop: 2500, minLv: 5, color: 0xffe86a, lv: ['Lanza 3 discos cortantes que atraviesan enemigos.', '+30% de daño.', '+1 disco.', 'Recarga reducida.', '+2 discos y daño máximo.'] },
  makanko: { name: 'Makankosappo', icon: '➶', kind: 'bigbeam', shop: 2800, minLv: 5, color: 0xffa040, sty: 'sbc', end: 'sbcBoom', cfg: { cd: 6, dmg: 26, len: 36, hw: 0.9, life: 0.35, cost: 15 }, lv: ['Rayo en espiral que perfora todo.', '+40% de daño.', 'Rayo más largo.', 'Recarga reducida.', 'Makankosappo definitivo.'] },
  kikoho: { name: 'Kikoho', icon: '▲', kind: 'bigbeam', shop: 3200, minLv: 7, color: 0xffd060, cfg: { cd: 9, dmg: 18, len: 34, hw: 2.4, life: 0.9, cost: 0, hpCost: 0.08 }, lv: ['Rayo triangular de enorme daño; cuesta un 8% de vida.', '+40% de daño.', 'Rayo más largo y ancho.', 'Recarga reducida.', 'Kikoho definitivo.'] },
  /* --- Piccolo --- */
  eyebeam: { name: 'Rayos Oculares', icon: '⊙', kind: 'pbolt', unique: 'piccolo', color: 0xffe070, cfg: { cd: 0.75, dmg: 10, len: 20, hw: 0.4 }, lv: ['Rayos rápidos desde los ojos al enemigo más cercano.', '+20% de daño.', '+1 rayo.', 'Atraviesan más lejos.', '+1 rayo y +30% de cadencia.'] },
  hellzone: { name: 'Hellzone Grenade', icon: '❂', kind: 'hellzone', unique: 'piccolo', minLv: 4, color: 0xffd040, sty: 'hz', lv: ['Rodea a los enemigos de esferas que convergen y explotan.', '+40% de daño.', '+2 esferas.', 'Recarga reducida.', 'Hellzone definitivo: área y daño máximos.'] },
  lightgrenade: { name: 'Light Grenade', icon: '✺', kind: 'bigbang', unique: 'piccolo', minLv: 6, color: 0xffe86a, boomFx: 'sbcBoom', lv: ['Granada de luz que explota en gran área.', '+35% de daño.', 'Explosión mayor.', 'Recarga reducida.', '+35% de daño y doble granada.'] },
  /* --- Gohan --- */
  gshield: { name: 'Escudo de Gohan', icon: '◎', ico: 'barrier', kind: 'barrier', unique: 'gohan', minLv: 3, shop: 2400, color: 0x8ae0ff, cfg: { hits: 1, boom: 0 }, lv: ['Barrera que para el siguiente golpe y empuja a la horda.', 'La onda también daña a los enemigos cercanos.', 'La onda es más grande.', 'Recarga reducida.', 'Onda más grande y más daño.'] },
  gblast: { name: 'Ráfaga de Gohan', icon: '✦', kind: 'bullet', unique: 'gohan', color: 0xbfe4ff, lv: ['Gohan lanza ráfagas de ki al enemigo más cercano.', '+18% de daño.', '+1 proyectil.', 'Las ráfagas atraviesan a 1 enemigo.', '+1 proyectil y +30% de cadencia.'] },
  fsk: { name: 'Kamehameha de Gohan', icon: '≋', kind: 'beam', unique: 'gohan', minLv: 3, color: 0x8fe0ff, lv: ['Rayo azul en línea recta.', '+55% de daño.', 'Rayo más largo y ancho.', 'Recarga reducida.', 'Kamehameha Padre-Hijo: daño y tamaño máximos.'] },
  rage: { name: 'Furia Definitiva', icon: '✸', kind: 'nova', unique: 'gohan', minLv: 6, color: 0xffffff, lv: ['Estallido de ira que empuja y daña a tu alrededor.', '+40% de daño.', 'Mayor radio.', 'Estalla dos veces seguidas.', '+40% de daño y recarga menor.'] },
  /* --- Freezer --- */
  deathbeam: { name: 'Death Beam', icon: '➹', kind: 'pbolt', unique: 'freezer', color: 0xff6ad8, cfg: { cd: 0.6, dmg: 11, len: 26, hw: 0.3 }, lv: ['Rayo mortal finísimo que atraviesa a todos.', '+20% de daño.', '+1 rayo.', 'Mayor alcance.', '+1 rayo y +30% de cadencia.'] },
  deathsaucer: { name: 'Death Saucer', icon: '◌', kind: 'discs', unique: 'freezer', minLv: 3, color: 0xff8ad8, look: 'saucerP', lv: ['Discos de energía que cortan todo a su paso.', '+30% de daño.', '+1 disco.', 'Recarga reducida.', '+2 discos y daño máximo.'] },
  deathball: { name: 'Death Ball', icon: '●', kind: 'genki', unique: 'freezer', minLv: 6, color: 0xff7a3a, sty: 'db', lv: ['Una esfera de destrucción cae sobre la horda.', '+50% de daño.', 'Área mayor.', 'Recarga reducida.', 'Death Ball definitiva.'] },
  /* --- Krilin --- */
  kdisc: { name: 'Disco de Krilin', icon: '◌', kind: 'discs', unique: 'krilin', color: 0xffe86a, cfg: { cd: 1.5, n: 1, dmg: 15, spd: 20, life: 1.3 }, lv: ['Krilin lanza un disco cortante que atraviesa a todos.', '+30% de daño.', '+1 disco.', 'Recarga reducida.', '+2 discos y daño máximo.'] },
  kscatter: { name: 'Ráfaga Dispersa', icon: '☄', kind: 'rain', unique: 'krilin', minLv: 3, color: 0xffd060, mul: { n: 1.4, dmg: 0.85, cd: 0.85 }, lv: ['Una esfera de ki estalla en el cielo y llueve sobre la horda.', '+1 impacto.', '+35% de daño.', '+1 impacto y área mayor.', '+2 impactos y recarga menor.'] },
  taiyoken: { name: 'Taiyoken', icon: '☼', kind: 'flare', unique: 'krilin', minLv: 5, color: 0xffffff, lv: ['Destello cegador: aturde a los enemigos cercanos 2,5 s.', 'Además hace daño.', 'Aturde más tiempo.', 'Mayor radio.', 'Recarga mínima y aturdimiento máximo.'] },
  /* --- Trunks --- */
  sword: { name: 'Espada de Trunks', icon: '⚔', kind: 'scythe', unique: 'trunks', color: 0xcfe8ff, cfg: { cd: 0.85, r: 5, dmg: 13 }, lv: ['Tajos rápidos con la espada frente a ti.', '+40% de daño.', 'Doble tajo.', 'Mayor alcance.', 'Tajo circular completo.'] },
  burning: { name: 'Burning Attack', icon: '✺', kind: 'bigbang', unique: 'trunks', minLv: 3, color: 0xffb040, look: 'burnSwirl', boomFx: 'burnBoom', lv: ['Esfera de fuego que explota en gran área.', '+35% de daño.', 'Explosión mayor.', 'Recarga reducida.', '+35% de daño y doble esfera.'] },
  shining: { name: 'Shining Sword Attack', icon: '✧', kind: 'godslash', unique: 'trunks', minLv: 6, color: 0x9fe0ff, cfg: { cd: 2.6, r: 8, dmg: 30 }, lv: ['Remolino de tajos de luz alrededor de Trunks.', '+30% de daño.', 'Mayor alcance.', 'Recarga reducida.', 'Shining Sword definitivo.'] },
  /* --- Técnicas nuevas para todos (se compran en la Tienda) --- */
  homing: { name: 'Ráfagas Teledirigidas', icon: '✦', ico: 'homing', kind: 'homing', shop: 1800, minLv: 3, color: 0x8ad8ff, lv: ['Esferas de ki que persiguen al enemigo más cercano.', '+1 esfera.', '+30% de daño.', '+1 esfera y giran más rápido.', '+2 esferas y recarga menor.'] },
  barrier: { name: 'Barrera de Ki', icon: '◎', ico: 'barrier', kind: 'barrier', shop: 2200, minLv: 4, color: 0x8ae0ff, lv: ['Cuando te rodean, una barrera para 2 golpes y empuja a la horda.', 'La onda de la barrera hace daño.', 'Para 1 golpe más.', 'Recarga reducida.', 'Para 1 golpe más y onda mayor.'] },
  thunder: { name: 'Rayos del Juicio', icon: '⚡', kind: 'thunder', shop: 2600, minLv: 5, color: 0xbfe8ff, lv: ['Caen rayos sobre 3 enemigos cercanos.', '+1 rayo.', '+35% de daño.', '+2 rayos y área mayor.', 'Recarga reducida y +2 rayos.'] },
  /* --- Técnicas nuevas de cada personaje --- */
  meteor: { name: 'Combinación Meteoro', icon: '✸', ico: 'tp', kind: 'meteor', unique: 'goku', minLv: 5, color: 0xff8ad8, lv: ['Goku golpea en un instante a varios enemigos cercanos y los aturde.', '+1 golpe.', '+35% de daño.', 'Recarga reducida.', '+2 golpes: combinación definitiva.'] },
  sorrow: { name: 'Guadaña del Dolor', icon: '◍', ico: 'absorb', kind: 'vortex', unique: 'black', minLv: 5, color: 0xc070ff, lv: ['Abre un agujero negro que atrae a la horda y estalla.', '+35% de daño.', 'Atrae desde más lejos.', 'Recarga reducida.', 'Agujero definitivo: dura más y estalla más fuerte.'] },
  zsword: { name: 'Espada Z', icon: '⚔', ico: 'pole', kind: 'scythe', unique: 'gohan', minLv: 4, color: 0xdfe8ff, cfg: { cd: 1.1, r: 6.5, dmg: 22 }, lv: ['Gohan corta con la Espada Z frente a él.', '+40% de daño.', 'Doble tajo.', 'Mayor alcance.', 'Tajo circular completo.'] },
  buster: { name: 'Buster Cannon', icon: '≋', ico: 'kame', kind: 'beam', unique: 'trunks', minLv: 4, color: 0x8ae8ff, lv: ['Trunks dispara un cañón de energía azul.', '+55% de daño.', 'Rayo más largo y ancho.', 'Recarga reducida.', 'Buster Cannon definitivo.'] },
  /* --- Célula --- */
  cellbeam: { name: 'Rayo Mortal de Célula', icon: '➹', ico: 'sbc', kind: 'pbolt', unique: 'cell', color: 0x8aff9a, cfg: { cd: 0.65, dmg: 11, len: 24, hw: 0.35 }, lv: ['Rayos finos que atraviesan a todos (copiado de Freezer).', '+20% de daño.', '+1 rayo.', 'Mayor alcance.', '+1 rayo y +30% de cadencia.'] },
  cellkame: { name: 'Kamehameha de Célula', icon: '≋', ico: 'kame', kind: 'beam', unique: 'cell', minLv: 3, color: 0x7ad8ff, lv: ['El Kamehameha copiado de Goku.', '+55% de daño.', 'Rayo más largo y ancho.', 'Recarga reducida.', 'Kamehameha definitivo.'] },
  celljr: { name: 'Célula Jr.', icon: '☻', ico: 'absorb', kind: 'minions', unique: 'cell', minLv: 4, color: 0x8ab8ff, lv: ['Engendras 2 Célula Jr. que pelean por ti unos segundos.', '+35% de daño.', '+1 Célula Jr.', 'Duran más y salen antes.', '+1 Célula Jr. y más fuertes.'] },
  cellbarrier: { name: 'Barrera Perfecta', icon: '◎', ico: 'barrier', kind: 'barrier', unique: 'cell', minLv: 5, color: 0x7aff9a, lv: ['Barrera verde que para 2 golpes y empuja a la horda.', 'La onda de la barrera hace daño.', 'Para 1 golpe más.', 'Recarga reducida.', 'Para 1 golpe más y onda mayor.'] },
  cellself: { name: 'Autodestrucción', icon: '☢', ico: 'explode', kind: 'selfblast', unique: 'cell', minLv: 8, color: 0xffffff, sty: 'self', lv: ['Célula se hincha y explota con enorme área (pierde un 12% de vida).', '+50% de daño.', 'Área mayor.', 'Recarga reducida.', 'Explosión devastadora.'] },
  /* --- Bardock --- */
  riot: { name: 'Riot Javelin', icon: '✦', kind: 'bullet', unique: 'bardock', color: 0x8ad0ff, lv: ['Bardock lanza ráfagas de ki azul al enemigo más cercano.', '+18% de daño.', '+1 proyectil.', 'Las ráfagas atraviesan a 1 enemigo.', '+1 proyectil y +30% de cadencia.'] },
  spiritcannon: { name: 'Final Spirit Cannon', icon: '●', ico: 'genki', kind: 'bigbang', unique: 'bardock', minLv: 3, color: 0x8ad0ff, look: 'bbOrb', boomFx: 'bbBoom', lv: ['Esfera azul que explota en gran área.', '+35% de daño.', 'Explosión mayor.', 'Recarga reducida.', '+35% de daño y doble esfera.'] },
  rebellion: { name: 'Rebellion Spear', icon: '➹', ico: 'sbc', kind: 'pbolt', unique: 'bardock', minLv: 5, color: 0xbfe8ff, cfg: { cd: 0.9, dmg: 16, len: 24, hw: 0.45 }, lv: ['Lanzas de ki que atraviesan a todos.', '+20% de daño.', '+1 lanza.', 'Mayor alcance.', '+1 lanza y +30% de cadencia.'] },
  /* --- Vegetto --- */
  zfblade: { name: 'Hoja del Juicio', icon: '⚔', ico: 'pole', kind: 'scythe', unique: 'zamasuf', color: 0xff6ac8, cfg: { cd: 0.8, r: 5.5, dmg: 15 }, lv: ['Zamasu corta con una hoja de ki rosa frente a él.', '+40% de daño.', 'Doble tajo.', 'Mayor alcance.', 'Tajo circular completo.'] },
  zfspears: { name: 'Lanzas Divinas', icon: '✦', ico: 'homing', kind: 'homing', unique: 'zamasuf', minLv: 3, color: 0xff8ad8, cfg: { n: 6, dmg: 24, cd: 2.2 }, lv: ['Lanzas de luz que persiguen a la horda.', '+1 lanza.', '+30% de daño.', '+1 lanza y giran más rápido.', '+2 lanzas y recarga menor.'] },
  zfhalo: { name: 'Halo Divino', icon: '◍', kind: 'orbit', unique: 'zamasuf', minLv: 5, color: 0xd8ff9a, lv: ['Esferas de luz orbitan a tu alrededor.', '+1 esfera.', 'Mayor daño.', '+1 esfera y más radio.', 'Giran más rápido y dañan más.'] },
  zfjudge: { name: 'Espada de la Justicia', icon: '✧', kind: 'godslash', unique: 'zamasuf', minLv: 8, color: 0xff6ac8, cfg: { cd: 2.4, r: 8.5, dmg: 32 }, lv: ['Una espada de luz gigante gira alrededor de Zamasu.', '+30% de daño.', 'Mayor alcance.', 'Recarga reducida.', 'Espada de la Justicia definitiva.'] },
  vblade: { name: 'Espada de Ki', icon: '⚔', ico: 'pole', kind: 'scythe', unique: 'vegito', color: 0x8ad8ff, cfg: { cd: 0.8, r: 5.5, dmg: 15 }, lv: ['Vegetto corta con una espada de ki frente a él.', '+40% de daño.', 'Doble tajo.', 'Mayor alcance.', 'Tajo circular completo.'] },
  vkame: { name: 'Final Kamehameha', icon: '≋', ico: 'kame', kind: 'beam', unique: 'vegito', minLv: 3, color: 0x8ad8ff, lv: ['El Galick Ho y el Kamehameha en un solo rayo.', '+55% de daño.', 'Rayo más largo y ancho.', 'Recarga reducida.', 'Final Kamehameha definitivo.'] },
  excalibur: { name: 'Spirit Excalibur', icon: '✧', kind: 'godslash', unique: 'vegito', minLv: 6, color: 0xbfe8ff, cfg: { cd: 2.4, r: 8.5, dmg: 32 }, lv: ['Una espada de luz gigante gira alrededor de Vegetto.', '+30% de daño.', 'Mayor alcance.', 'Recarga reducida.', 'Spirit Excalibur definitiva.'] },
  /* --- Broly --- */
  eraser: { name: 'Eraser Blow', icon: '✦', kind: 'blast', unique: 'broly', color: 0x7dff5a, lv: ['Broly lanza esferas de ki verde que explotan al impactar.', '+20% de daño.', '+1 esfera.', 'Explosión más grande.', '+1 esfera y +30% de cadencia.'] },
  gigameteor: { name: 'Gigantic Meteor', icon: '●', ico: 'genki', kind: 'bigbang', unique: 'broly', minLv: 3, color: 0x9aff6a, boomFx: 'kameBoomG', lv: ['Una esfera verde enorme que arrasa una gran zona.', '+35% de daño.', 'Explosión mayor.', 'Recarga reducida.', '+35% de daño y doble esfera.'] },
  gigaroar: { name: 'Rugido Legendario', icon: '✸', ico: 'explode', kind: 'nova', unique: 'broly', minLv: 5, color: 0x7dff5a, lv: ['Broly ruge y una onda de ki verde empuja y daña a la horda.', '+40% de daño.', 'Mayor radio.', 'Estalla dos veces seguidas.', '+40% de daño y recarga menor.'] },
  /* --- Técnicas para todos con dibujo propio del pack (salen al subir de nivel) --- */
  zcomet: { name: 'Cometa de Ki', icon: '☄', kind: 'zshot', minLv: 3, color: 0xffd040, cfg: { n: 1, spd: 26, dmg: 30, cd: 1.6, size: 3.2, look: 'zblastY', pierce: 99, life: 1.4 }, lv: ['Una ráfaga amarilla enorme que atraviesa a toda la horda.', '+30% de daño.', '+1 cometa.', 'Recarga reducida.', '+1 cometa y +30% de daño.'] },
  zemerald: { name: 'Meteoro Esmeralda', icon: '●', kind: 'zshot', minLv: 4, color: 0x7dff5a, cfg: { n: 1, spd: 14, dmg: 46, cd: 2.4, size: 4, look: 'zblastG', aoe: 4, life: 1.8 }, lv: ['Una esfera verde lenta que explota en gran área.', '+30% de daño.', '+1 esfera.', 'Recarga reducida.', '+1 esfera y +30% de daño.'] },
  zcrimson: { name: 'Lluvia Carmesí', icon: '✺', kind: 'zshot', minLv: 3, color: 0xff3a3a, cfg: { n: 6, spd: 25, dmg: 9, cd: 1.3, size: 1.9, look: 'zkiR', spread: 0.16, life: 0.9 }, lv: ['Un abanico de ráfagas rojas a quemarropa.', '+30% de daño.', '+1 ráfaga.', 'Recarga reducida.', '+1 ráfaga y +30% de daño.'] },
  zcandy: { name: 'Bombas de Caramelo', icon: '◍', kind: 'zshot', minLv: 4, color: 0xff8ad8, cfg: { n: 3, spd: 12, dmg: 16, cd: 2, size: 2.4, look: 'zpink', aoe: 2.4, home: 3, spread: 0.5, life: 2.4 }, lv: ['Esferas rosas que persiguen a la horda y explotan.', '+30% de daño.', '+1 esfera.', 'Recarga reducida.', '+1 esfera y +30% de daño.'] },
  zkilldriver: { name: 'Kill Driver', icon: '◯', kind: 'zshot', minLv: 5, color: 0xffb040, cfg: { n: 1, spd: 17, dmg: 26, cd: 2.2, size: 4.4, look: 'zring', pierce: 99, life: 1.6, r: 1.6 }, lv: ['Un aro de energía que corta todo a su paso.', '+30% de daño.', '+1 aro.', 'Recarga reducida.', '+1 aro y +30% de daño.'] },
  zbluesphere: { name: 'Esfera Azul', icon: '◉', kind: 'zshot', minLv: 6, color: 0x8ad0ff, cfg: { n: 1, spd: 10, dmg: 70, cd: 4, size: 4.6, look: 'zsphereB', aoe: 5.5, life: 2.2 }, lv: ['Una esfera de energía azul que arrasa una zona enorme.', '+30% de daño.', '+1 esfera.', 'Recarga reducida.', '+1 esfera y +30% de daño.'] },
  zhellfire: { name: 'Llamarada Infernal', icon: '♨', kind: 'zshot', minLv: 4, color: 0xff7a2a, cfg: { n: 3, spd: 20, dmg: 15, cd: 1.7, size: 2.6, look: 'zhellF', spread: 0.25, aoe: 1.8, life: 1.2 }, lv: ['Ráfagas de fuego que estallan al tocar.', '+30% de daño.', '+1 ráfaga.', 'Recarga reducida.', '+1 ráfaga y +30% de daño.'] },
  zportal: { name: 'Portal Dimensional', icon: '◈', kind: 'zportal', minLv: 6, color: 0xc070ff, cfg: { cd: 5, dmg: 22, r: 3.6 }, lv: ['Abre un portal junto a la horda del que salen tajos durante 1,6 s.', '+35% de daño.', 'Mayor alcance.', 'Recarga reducida.', 'Dos portales y +35% de daño.'] },
  zcage: { name: 'Prisión Temporal', icon: '▦', kind: 'zcage', minLv: 6, color: 0x8a9aff, cfg: { cd: 7, dmg: 30, n: 4, t: 2.2 }, lv: ['Encierra a 4 enemigos en cubos de tiempo: quedan congelados.', '+2 enemigos.', 'Dura más.', 'Recarga reducida.', '+2 enemigos y +35% de daño.'] },
  zsupernova: { name: 'Mini Supernova', icon: '☀', kind: 'zsun', minLv: 7, color: 0xffb040, cfg: { cd: 6, dmg: 110, r: 9 }, lv: ['Un sol crece sobre la horda y estalla.', '+40% de daño.', 'Explosión mayor.', 'Recarga reducida.', '+40% de daño.'] },
  /* --- Gogeta --- */
  gblast2: { name: 'Ráfagas de Gogeta', icon: '✦', kind: 'bullet', unique: 'gogeta', color: 0x9fe0ff, lv: ['Gogeta lanza ráfagas de ki al enemigo más cercano.', '+18% de daño.', '+1 proyectil.', 'Las ráfagas atraviesan a 1 enemigo.', '+1 proyectil y +30% de cadencia.'] },
  bbkame: { name: 'Big Bang Kamehameha', icon: '≋', ico: 'kame', kind: 'beam', unique: 'gogeta', minLv: 3, color: 0x9fe0ff, lv: ['El Big Bang y el Kamehameha en un solo rayo.', '+55% de daño.', 'Rayo más largo y ancho.', 'Recarga reducida.', 'Big Bang Kamehameha definitivo.'] },
  meteorexp: { name: 'Explosión Meteoro', icon: '✸', ico: 'tp', kind: 'meteor', unique: 'gogeta', minLv: 5, color: 0xffd040, cfg: { n: 5, dmg: 40, cd: 3.5 }, lv: ['Gogeta golpea a varios enemigos en un instante y remata con una explosión.', '+1 golpe.', '+35% de daño.', 'Recarga reducida.', '+2 golpes.'] },
  soulpunisher: { name: 'Soul Punisher', icon: '☀', ico: 'genki', kind: 'genki', unique: 'gogeta', minLv: 7, color: 0xbfe8ff, sty: 'genki', cfg: { r: 14, dmg: 170, cd: 8 }, lv: ['Una esfera de luz que purifica a la horda.', '+50% de daño.', 'Área mayor.', 'Recarga reducida.', 'Soul Punisher definitivo.'] },
  /* --- Técnicas nuevas de cada personaje (desde el nivel 7) --- */
  dragonfist: { name: 'Puño del Dragón', icon: '✊', kind: 'bigbeam', unique: 'goku', minLv: 7, color: 0xffd040, cfg: { cd: 5, dmg: 40, len: 20, hw: 4, life: 0.45, cost: 12 }, lv: ['Goku concentra el ki en el puño y atraviesa a la horda.', '+30% de daño.', 'Puño más largo y ancho.', 'Recarga reducida.', 'Puño del Dragón definitivo.'] },
  kakusan: { name: 'Kakusan Ha', icon: '✦', ico: 'homing', kind: 'homing', unique: 'vegeta', minLv: 7, color: 0xb06bff, cfg: { n: 5, dmg: 22, cd: 2.2 }, lv: ['Una esfera que se divide en rayos que persiguen a la horda.', '+1 rayo.', '+30% de daño.', '+1 rayo y giran más rápido.', '+2 rayos y recarga menor.'] },
  blackkame: { name: 'Kamehameha Negro', icon: '≋', ico: 'kame', kind: 'beam', unique: 'black', minLv: 7, color: 0x7a3aff, lv: ['El Kamehameha robado de Goku, teñido de ki oscuro.', '+55% de daño.', 'Rayo más largo y ancho.', 'Recarga reducida.', 'Kamehameha Negro definitivo.'] },
  arms: { name: 'Brazos Elásticos', icon: '〜', kind: 'scythe', unique: 'piccolo', minLv: 7, color: 0x9cff8a, cfg: { cd: 1.0, r: 7.5, dmg: 20 }, lv: ['Piccolo estira los brazos y barre a los enemigos lejanos.', '+40% de daño.', 'Doble barrido.', 'Mayor alcance.', 'Barrido circular completo.'] },
  gthunder: { name: 'Ira Eléctrica', icon: '⚡', kind: 'thunder', unique: 'gohan', minLv: 7, color: 0xbfe8ff, cfg: { n: 4, dmg: 34, cd: 2.6, r: 2.6 }, lv: ['La furia de Gohan descarga rayos sobre 4 enemigos.', '+1 rayo.', '+35% de daño.', '+2 rayos y área mayor.', 'Recarga reducida y +2 rayos.'] },
  chaser: { name: 'Esferas Perseguidoras', icon: '◉', ico: 'homing', kind: 'homing', unique: 'freezer', minLv: 7, color: 0xff6ad8, cfg: { n: 4, dmg: 26, cd: 2.4 }, lv: ['Esferas de ki rosa que persiguen al enemigo más cercano.', '+1 esfera.', '+30% de daño.', '+1 esfera y giran más rápido.', '+2 esferas y recarga menor.'] },
  kbarrage: { name: 'Ráfaga de Krilin', icon: '✺', kind: 'barrage', unique: 'krilin', minLv: 7, color: 0xffe86a, cfg: { n: 8, dmg: 12, cd: 2.4 }, lv: ['Krilin dispara una ráfaga continua de bolas de ki.', '+1 disparo.', '+30% de daño.', '+2 disparos.', 'Recarga reducida.'] },
  futureblast: { name: 'Ráfaga del Futuro', icon: '✦', kind: 'barrage', unique: 'trunks', minLv: 7, color: 0xffd060, cfg: { n: 10, dmg: 16, cd: 2.4, aoe: 1.6 }, lv: ['Una ráfaga de esferas que explotan al impactar.', '+1 esfera.', '+30% de daño.', '+2 esferas.', 'Recarga reducida.'] },
  perfectstorm: { name: 'Rayos Perfectos', icon: '⚡', kind: 'thunder', unique: 'cell', minLv: 7, color: 0x8aff9a, cfg: { n: 4, dmg: 32, cd: 2.6, r: 2.6 }, lv: ['Célula descarga rayos verdes sobre la horda.', '+1 rayo.', '+35% de daño.', '+2 rayos y área mayor.', 'Recarga reducida y +2 rayos.'] },
  saiyanrage: { name: 'Combo de Clase Baja', icon: '✸', ico: 'tp', kind: 'meteor', unique: 'bardock', minLv: 7, color: 0xff8a5a, cfg: { n: 4, dmg: 34, cd: 4 }, lv: ['Bardock golpea en un instante a varios enemigos cercanos.', '+1 golpe.', '+35% de daño.', 'Recarga reducida.', '+2 golpes.'] },
  vhoming: { name: 'Ráfaga Fusionada', icon: '✦', ico: 'homing', kind: 'homing', unique: 'vegito', minLv: 7, color: 0x9fe0ff, cfg: { n: 6, dmg: 26, cd: 2 }, lv: ['Esferas fusionadas que persiguen a la horda.', '+1 esfera.', '+30% de daño.', '+1 esfera y giran más rápido.', '+2 esferas y recarga menor.'] },
  blaster: { name: 'Blaster Shell', icon: '◉', kind: 'kiplanet', unique: 'broly', minLv: 7, color: 0x7dff5a, lv: ['6 esferas verdes giran alrededor de Broly y estallan en ondas.', '+30% de daño.', 'Mayor radio.', 'Estallan más a menudo.', 'Blaster Shell definitivo.'] },
  /* --- FUSIONES: aparecen como carta cuando tienes las dos técnicas al nivel máximo --- */
  bbflash: { name: 'Destello Big Bang', icon: '✷', ico: 'flash', kind: 'bigbeam', unique: 'vegeta', fusion: ['finalflash', 'bigbang'], color: 0x9fe0ff, end: 'bbBurst', stamp: 'bbTxt', cfg: { cd: 3.6, dmg: 52, len: 50, hw: 3.4, life: 1.2, cost: 10 }, down: { text: '-8% de vida máxima', m: { maxHp: -0.08 } }, lv: ['Fusión: un Final Flash que estalla al final como un Big Bang.'] },
  meteorkai: { name: 'Meteoro Kaio-ken', icon: '✸', ico: 'kaioken', kind: 'meteor', unique: 'goku', fusion: ['meteor', 'kaioken'], color: 0xff4a4a, cfg: { n: 9, dmg: 60, cd: 3.2 }, down: { text: 'Pierdes 2 de vida por combinación', m: {} }, lv: ['Fusión: una lluvia de golpes al rojo vivo sobre toda la horda.'] },
  absolution: { name: 'Absolución Divina', icon: '⚡', ico: 'absorb', kind: 'vortex', unique: 'black', fusion: ['sorrow', 'judgement'], color: 0xff6ac8, cfg: { R: 13, dmg: 70, cd: 4.5, bolt: true }, down: { text: '-5% de armadura', m: { armor: -0.05 } }, lv: ['Fusión: un agujero divino que atrae a la horda mientras caen rayos.'] },
  zkame: { name: 'Kamehameha Definitivo', icon: '≋', ico: 'kame', kind: 'bigbeam', unique: 'gohan', fusion: ['zsword', 'fsk'], color: 0x9fe8ff, end: 'genkiBoom', cfg: { cd: 3.2, dmg: 48, len: 48, hw: 3.0, life: 1.0, cost: 8 }, down: { text: '-5% de velocidad', m: { spd: -0.05 } }, lv: ['Fusión: el poder definitivo de Gohan en un Kamehameha colosal.'] },
  finishbuster: { name: 'Finish Buster', icon: '●', ico: 'genki', kind: 'genki', unique: 'trunks', fusion: ['buster', 'burning'], color: 0xffd060, sty: 'sun', cfg: { r: 15, dmg: 200, cd: 8 }, down: { text: '-5% de armadura', m: { armor: -0.05 } }, lv: ['Fusión: una esfera de energía amarilla que arrasa la zona.'] },
  perfectkame: { name: 'Kamehameha Perfecto', icon: '≋', ico: 'kame', kind: 'bigbeam', unique: 'cell', fusion: ['cellkame', 'cellbarrier'], color: 0x6aff9a, end: 'kameBoomG', cfg: { cd: 3.2, dmg: 50, len: 50, hw: 3.2, life: 1.1, cost: 8 }, down: { text: '-5% de velocidad', m: { spd: -0.05 } }, lv: ['Fusión: dentro de su barrera, Célula carga un Kamehameha verde colosal.'] },
  celljrs: { name: 'Juegos de Célula', icon: '☻', ico: 'absorb', kind: 'minions', unique: 'cell', fusion: ['celljr', 'cellbeam'], color: 0x8ab8ff, cfg: { n: 6, dmg: 26, cd: 7, life: 12, beam: true }, down: { text: '-10% de experiencia', m: { xp: -0.1 } }, lv: ['Fusión: 6 Célula Jr. que además disparan rayos mortales.'] },
  hunters: { name: 'Ráfaga Cazadora', icon: '✦', ico: 'homing', kind: 'homing', fusion: ['homing', 'orbit'], color: 0xbfe8ff, cfg: { n: 12, dmg: 26, cd: 1.3 }, down: { text: '-5% de crítico', m: { crit: -0.05 } }, lv: ['Fusión: una nube de esferas cazadoras que no falla nunca.'] },
  boombarrier: { name: 'Barrera Explosiva', icon: '◎', ico: 'barrier', kind: 'barrier', fusion: ['barrier', 'nova'], color: 0xffd060, cfg: { hits: 4, cd: 5, boom: 26 }, down: { text: '-5% de velocidad', m: { spd: -0.05 } }, lv: ['Fusión: la barrera para 4 golpes y estalla cada vez que la tocan.'] },
  thunderstorm: { name: 'Tormenta Eléctrica', icon: '⚡', kind: 'thunder', fusion: ['thunder', 'rain'], color: 0x9fd8ff, cfg: { n: 12, dmg: 60, cd: 1.8, r: 3.2 }, down: { text: '-10% de alcance del imán', m: { magnet: -0.1 } }, lv: ['Fusión: el cielo descarga rayos sin parar sobre la horda.'] },
  kaiokame: { down: { text: '-5% de armadura (el cuerpo sufre)', m: { armor: -0.05 } },  name: 'Kamehameha Kaio-ken', icon: '≋', kind: 'bigbeam', unique: 'goku', fusion: ['kamehameha', 'kaioken'], color: 0xff4a4a, cfg: { cd: 3.2, dmg: 42, len: 44, hw: 2.6, life: 1.0, cost: 8 }, lv: ['Fusión: un Kamehameha rojo multiplicado por el Kaio-ken.'] },
  finalshine: { down: { text: '-5% de velocidad (rayo muy pesado)', m: { spd: -0.05 } },  name: 'Final Shine Attack', icon: '✷', kind: 'bigbeam', unique: 'vegeta', fusion: ['galick', 'bigbang'], color: 0x7aff5a, cfg: { cd: 3.4, dmg: 44, len: 44, hw: 2.8, life: 1.0, cost: 8 }, lv: ['Fusión: el cañón verde definitivo del príncipe.'] },
  godslash: { down: { text: '-5% de vida máxima', m: { maxHp: -0.05 } },  name: 'Guadaña de la Ira Divina', icon: '☾', kind: 'godslash', unique: 'black', fusion: ['scythe', 'darkorbs'], color: 0xff5ac0, lv: ['Fusión: doble tajo circular rosado de gran alcance.'] },
  makankodef: { sty: 'sbc', end: 'sbcBoom', down: { text: '-10% de regeneración de Ki', m: { kiRegen: -0.1 } },  name: 'Makankosappo Definitivo', icon: '➶', kind: 'bigbeam', unique: 'piccolo', fusion: ['eyebeam', 'makanko'], color: 0xffa040, cfg: { cd: 2.6, dmg: 50, len: 48, hw: 1.3, life: 0.45, cost: 6 }, lv: ['Fusión: un Makankosappo que lo perfora todo, casi sin recarga.'] },
  masenkame: { down: { text: '-5% de cadencia del resto de técnicas', m: { rate: -0.05 } },  name: 'Masenko-Kamehameha', icon: '≋', kind: 'bigbeam', unique: 'gohan', fusion: ['fsk', 'masenko'], color: 0xffd860, cfg: { cd: 3.0, dmg: 46, len: 46, hw: 2.7, life: 1.0, cost: 8 }, lv: ['Fusión: lo mejor de Piccolo y de Goku en un solo rayo.'] },
  supernova: { sty: 'sun', down: { text: '-5% de armadura', m: { armor: -0.05 } },  name: 'Supernova', icon: '☀', kind: 'genki', unique: 'freezer', fusion: ['deathbeam', 'deathball'], color: 0xff5a2a, cfg: { r: 20, dmg: 260, cd: 14 }, lv: ['Fusión: un sol en miniatura que arrasa con todo.'] },
  kiplanet: { down: { text: '-15% de alcance del imán', m: { magnet: -0.15 } },  name: 'Planeta de Ki', icon: '◉', kind: 'kiplanet', fusion: ['orbit', 'nova'], color: 0x9fe8ff, lv: ['Fusión: 6 esferas en órbita que estallan en pulsos de energía.'] },
  kienzanx: { down: { text: '-4% de esquiva', m: { dodge: -0.04 } },  name: 'Kienzan Múltiple', icon: '◎', kind: 'discs', unique: 'krilin', fusion: ['kdisc', 'kienzan'], color: 0xfff08a, cfg: { cd: 1.6, n: 8, dmg: 40, spd: 22, life: 1.8 }, lv: ['Fusión: una tormenta de discos que lo corta todo.'] },
  heatdome: { sty: 'sun', down: { text: '-5% de velocidad', m: { spd: -0.05 } },  name: 'Heat Dome Attack', icon: '☀', kind: 'genki', unique: 'trunks', fusion: ['burning', 'shining'], color: 0xffd040, cfg: { r: 14, dmg: 190, cd: 8 }, lv: ['Fusión: una cúpula de energía que arrasa la zona.'] },
  godkame: { end: 'genkiBoom', name: 'Kamehameha Divino', icon: '≋', kind: 'bigbeam', unique: 'goku', fusion: ['kamehameha', 'genkidama'], color: 0x5ad8ff, cfg: { cd: 4.2, dmg: 58, len: 50, hw: 3.4, life: 1.2, cost: 12 }, down: { text: '-8% de velocidad (cargarlo cuesta)', m: { spd: -0.08 } }, lv: ['Fusión: la energía de la Genkidama concentrada en un Kamehameha azul colosal.'] },
  instkame: { name: 'Kamehameha Instantáneo', icon: '≋', kind: 'bigbeam', unique: 'goku', fusion: ['ki', 'kamehameha'], color: 0x7ad8ff, cfg: { cd: 2.4, dmg: 34, len: 40, hw: 2.0, life: 0.7, cost: 6 }, down: { text: '-10% de regeneración de Ki', m: { kiRegen: -0.1 } }, lv: ['Fusión: Goku aparece junto al enemigo y dispara un Kamehameha a quemarropa.'] },
  hellstorm: { sty: 'hz', name: 'Hellzone Definitivo', icon: '❂', kind: 'hellzone', unique: 'piccolo', fusion: ['hellzone', 'lightgrenade'], color: 0xffe070, cfg: { n: 14, dmg: 44, R: 8, cd: 3.2 }, down: { text: '-0,5 de vida/s de regeneración', m: { regen: -0.5 } }, lv: ['Fusión: un enjambre de granadas de luz encierra a la horda.'] },
  taiyobomb: { name: 'Taiyoken Explosivo', icon: '☼', kind: 'flare', unique: 'krilin', fusion: ['kscatter', 'taiyoken'], color: 0xfff0a0, cfg: { r: 17, stun: 3.5, dmg: 70, cd: 5 }, down: { text: '-5% de experiencia', m: { xp: -0.05 } }, lv: ['Fusión: el destello ciega y estalla a la vez.'] },
  rageblast: { name: 'Ira de Gohan', icon: '✸', kind: 'kiplanet', unique: 'gohan', fusion: ['gblast', 'rage'], color: 0xfff4c0, down: { text: '-5% de armadura', m: { armor: -0.05 } }, lv: ['Fusión: esferas de ira giran a tu alrededor y estallan en ondas.'] },
  deathstorm: { name: 'Lluvia de Muerte', icon: '➹', kind: 'barrage', unique: 'freezer', fusion: ['deathsaucer', 'deathbeam'], color: 0xff6ad8, cfg: { n: 16, dmg: 16, cd: 2 }, down: { text: '-10% de experiencia (el emperador no aprende)', m: { xp: -0.1 } }, lv: ['Fusión: una ráfaga incesante de rayos mortales.'] },
  galickburst: { name: 'Galick Cañón Explosivo', icon: '✦', kind: 'barrage', unique: 'vegeta', fusion: ['vblast', 'galick'], color: 0xb06bff, cfg: { n: 12, dmg: 22, cd: 2.2, aoe: 2.2 }, down: { text: '-5% de velocidad', m: { spd: -0.05 } }, lv: ['Fusión: una lluvia de esferas violetas que explotan en cadena.'] },
  rosescythe: { name: 'Guadaña Rosa', icon: '☾', kind: 'godslash', unique: 'black', fusion: ['scythe', 'judgement'], color: 0xff7ac8, cfg: { cd: 0.8, r: 10, dmg: 40 }, down: { text: '-5% de vida máxima', m: { maxHp: -0.05 } }, lv: ['Fusión: tajos rosas de justicia en todas direcciones.'] },
  swordrain: { name: 'Espada Celestial', icon: '⚔', kind: 'godslash', unique: 'trunks', fusion: ['sword', 'shining'], color: 0xcfe8ff, cfg: { cd: 0.9, r: 9, dmg: 36 }, down: { text: '-5% de velocidad', m: { spd: -0.05 } }, lv: ['Fusión: la espada de Trunks corta en círculos sin descanso.'] },
  renzoku: { name: 'Renzoku Energy Dan', icon: '✺', kind: 'barrage', fusion: ['masenko', 'dodonpa'], color: 0xffd060, cfg: { n: 14, dmg: 14, cd: 2.2 }, down: { text: '-10% de daño crítico', m: { critDmg: -0.1 } }, lv: ['Fusión: una ráfaga continua de bolas de ki (cualquier personaje).'] },
  saiyanspirit: { name: 'Último Ataque', icon: '☀', ico: 'genki', kind: 'genki', unique: 'bardock', fusion: ['riot', 'spiritcannon'], color: 0x8ad0ff, sty: 'genki', cfg: { r: 16, dmg: 210, cd: 9 }, down: { text: '-5% de vida máxima', m: { maxHp: -0.05 } }, lv: ['Fusión: la esfera con la que Bardock desafió a Freezer cae sobre la horda.'] },
  rebelstorm: { name: 'Lluvia Rebelde', icon: '➹', kind: 'barrage', unique: 'bardock', fusion: ['rebellion', 'riot'], color: 0xbfe8ff, cfg: { n: 14, dmg: 18, cd: 2 }, down: { text: '-5% de armadura', m: { armor: -0.05 } }, lv: ['Fusión: una ráfaga sin fin de lanzas de ki azul.'] },
  vfinal: { name: 'Final Kamehameha Definitivo', icon: '≋', ico: 'kame', kind: 'bigbeam', unique: 'vegito', fusion: ['vkame', 'excalibur'], color: 0x6fd8ff, end: 'genkiBoom', cfg: { cd: 3.2, dmg: 52, len: 50, hw: 3.2, life: 1.1, cost: 8 }, down: { text: '-5% de armadura', m: { armor: -0.05 } }, lv: ['Fusión: el rayo definitivo de la fusión más poderosa.'] },
  vspirit: { name: 'Espada Espiritual Infinita', icon: '⚔', kind: 'godslash', unique: 'vegito', fusion: ['vblade', 'excalibur'], color: 0x9fe0ff, cfg: { cd: 0.8, r: 10, dmg: 40 }, down: { text: '-5% de velocidad', m: { spd: -0.05 } }, lv: ['Fusión: la espada de Vegetto corta en círculos sin descanso.'] },
  omegablaster: { name: 'Omega Blaster', icon: '☀', ico: 'genki', kind: 'genki', unique: 'broly', fusion: ['eraser', 'gigameteor'], color: 0x7dff5a, sty: 'sun', cfg: { r: 18, dmg: 230, cd: 10 }, down: { text: '-5% de velocidad', m: { spd: -0.05 } }, lv: ['Fusión: un sol verde que lo destruye todo.'] },
  eraserstorm: { name: 'Lluvia de Eraser', icon: '✦', kind: 'barrage', unique: 'broly', fusion: ['eraser', 'gigaroar'], color: 0x7dff5a, cfg: { n: 14, dmg: 24, cd: 2.2, aoe: 2.4 }, down: { text: '-10% de experiencia', m: { xp: -0.1 } }, lv: ['Fusión: una lluvia de esferas verdes que explotan en cadena.'] },
  /* Fusiones de las técnicas del pack (cualquier personaje) */
  zcometstorm: { name: 'Lluvia de Cometas', icon: '☄', kind: 'zshot', fusion: ['zcomet', 'zcrimson'], color: 0xffd040, cfg: { n: 9, spd: 26, dmg: 30, cd: 1.4, size: 3, look: 'zblastY', pierce: 99, spread: 0.2, life: 1.4 }, down: { text: '-5% de velocidad', m: { spd: -0.05 } }, lv: ['Fusión: un abanico de cometas que lo atraviesa todo.'] },
  ztimenova: { name: 'Supernova Temporal', icon: '☀', kind: 'zsun', fusion: ['zsupernova', 'zcage'], color: 0xffd060, cfg: { cd: 3.2, dmg: 190, r: 12 }, down: { text: '-5% de armadura', m: { armor: -0.05 } }, lv: ['Fusión: soles que estallan sin parar sobre la horda.'] },
  zhellportal: { name: 'Portal del Infierno', icon: '◈', kind: 'zportal', fusion: ['zportal', 'zhellfire'], color: 0xff5a3a, cfg: { cd: 2.4, dmg: 40, r: 4.6 }, down: { text: '-10% de experiencia', m: { xp: -0.1 } }, lv: ['Fusión: portales que no dejan de abrirse junto a la horda.'] },
  /* Fusiones nuevas: la técnica nueva de cada personaje con otra suya */
  stardust: { name: 'Stardust Breaker', icon: '≋', ico: 'kame', kind: 'bigbeam', unique: 'gogeta', fusion: ['bbkame', 'soulpunisher'], color: 0xbfe8ff, end: 'bbBurst', cfg: { cd: 3.4, dmg: 56, len: 52, hw: 3.4, life: 1.2, cost: 10 }, down: { text: '-5% de armadura', m: { armor: -0.05 } }, lv: ['Fusión: la energía de la fusión en un rayo que lo destruye todo.'] },
  meteorstorm2: { name: 'Explosión Meteoro Total', icon: '✸', kind: 'barrage', unique: 'gogeta', fusion: ['meteorexp', 'gblast2'], color: 0xffd040, cfg: { n: 16, dmg: 26, cd: 2, aoe: 2.4 }, down: { text: '-5% de velocidad', m: { spd: -0.05 } }, lv: ['Fusión: una lluvia de esferas que explotan en cadena sobre la horda.'] },
  dragonmeteor: { name: 'Puño del Dragón Meteoro', icon: '✊', ico: 'tp', kind: 'meteor', unique: 'goku', fusion: ['dragonfist', 'meteor'], color: 0xffd040, cfg: { n: 10, dmg: 75, cd: 3 }, down: { text: '-5% de armadura', m: { armor: -0.05 } }, lv: ['Fusión: un dragón dorado golpea a toda la horda en un instante.'] },
  kakusanstorm: { name: 'Tormenta Kakusan', icon: '✦', kind: 'barrage', unique: 'vegeta', fusion: ['kakusan', 'galick'], color: 0xc08aff, cfg: { n: 14, dmg: 24, cd: 2, aoe: 2 }, down: { text: '-5% de velocidad', m: { spd: -0.05 } }, lv: ['Fusión: el Galick se divide en una lluvia de rayos que explotan.'] },
  rosekame: { name: 'Kamehameha Rosé', icon: '≋', ico: 'kame', kind: 'bigbeam', unique: 'black', fusion: ['blackkame', 'darkorbs'], color: 0xff5ac0, cfg: { cd: 3.2, dmg: 50, len: 48, hw: 3, life: 1, cost: 8 }, down: { text: '-5% de vida máxima', m: { maxHp: -0.05 } }, lv: ['Fusión: un Kamehameha rosa colosal con todo el ki divino de Black.'] },
  namekfury: { name: 'Furia de Namek', icon: '〜', kind: 'godslash', unique: 'piccolo', fusion: ['arms', 'hellzone'], color: 0x7aff6a, cfg: { cd: 1.2, r: 11, dmg: 44 }, down: { text: '-0,5 de vida/s de regeneración', m: { regen: -0.5 } }, lv: ['Fusión: los brazos de Piccolo barren todo a su alrededor sin descanso.'] },
  gstorm: { name: 'Tormenta de Gohan', icon: '⚡', kind: 'thunder', unique: 'gohan', fusion: ['gthunder', 'rage'], color: 0xbfe8ff, cfg: { n: 14, dmg: 62, cd: 1.6, r: 3.4 }, down: { text: '-5% de armadura', m: { armor: -0.05 } }, lv: ['Fusión: la ira del Super Saiyan 2 hecha tormenta.'] },
  saucerstorm: { name: 'Tormenta de Discos Mortales', icon: '◌', kind: 'discs', unique: 'freezer', fusion: ['chaser', 'deathsaucer'], color: 0xff8ad8, cfg: { cd: 1.6, n: 8, dmg: 44, spd: 22, life: 1.8 }, down: { text: '-10% de experiencia', m: { xp: -0.1 } }, lv: ['Fusión: una corona de discos rosas que lo corta todo.'] },
  kfinal: { name: 'Destello Final de Krilin', icon: '☼', kind: 'flare', unique: 'krilin', fusion: ['kbarrage', 'taiyoken'], color: 0xfff0a0, cfg: { r: 20, stun: 3, dmg: 90, cd: 5 }, down: { text: '-4% de esquiva', m: { dodge: -0.04 } }, lv: ['Fusión: un destello enorme que ciega y quema a la horda.'] },
  finalbuster: { name: 'Final Buster Definitivo', icon: '≋', ico: 'kame', kind: 'bigbeam', unique: 'trunks', fusion: ['futureblast', 'buster'], color: 0x8ae8ff, cfg: { cd: 3, dmg: 48, len: 48, hw: 3, life: 1, cost: 8 }, down: { text: '-5% de velocidad', m: { spd: -0.05 } }, lv: ['Fusión: un cañón azul que arrasa una línea entera.'] },
  stormbarrier: { name: 'Barrera de Rayos', icon: '◎', ico: 'barrier', kind: 'barrier', unique: 'cell', fusion: ['perfectstorm', 'cellbarrier'], color: 0x8aff9a, cfg: { hits: 4, cd: 5, boom: 30 }, down: { text: '-5% de velocidad', m: { spd: -0.05 } }, lv: ['Fusión: la barrera para 4 golpes y estalla en rayos cada vez que la tocan.'] },
  rebelfinal: { name: 'Rebelión Final', icon: '✸', ico: 'tp', kind: 'meteor', unique: 'bardock', fusion: ['saiyanrage', 'rebellion'], color: 0xff6a3a, cfg: { n: 10, dmg: 70, cd: 3 }, down: { text: '-5% de vida máxima', m: { maxHp: -0.05 } }, lv: ['Fusión: el último ataque de Bardock contra todo el ejército de Freezer.'] },
  vrain: { name: 'Lluvia Final', icon: '✦', kind: 'barrage', unique: 'vegito', fusion: ['vhoming', 'vkame'], color: 0x9fe0ff, cfg: { n: 16, dmg: 26, cd: 2, aoe: 2.2 }, down: { text: '-5% de armadura', m: { armor: -0.05 } }, lv: ['Fusión: una lluvia de esferas fusionadas que explotan en cadena.'] },
  legendwrath: { name: 'Cólera Legendaria', icon: '⚡', kind: 'thunder', unique: 'broly', fusion: ['blaster', 'gigaroar'], color: 0x7dff5a, cfg: { n: 12, dmg: 66, cd: 1.8, r: 3.4 }, down: { text: '-10% de experiencia', m: { xp: -0.1 } }, lv: ['Fusión: el rugido de Broly hace caer rayos verdes sobre la horda.'] },
  meteorstorm: { down: { text: '-3% de crítico', m: { crit: -0.03 } },  name: 'Tormenta de Meteoros', icon: '☄', kind: 'rain', fusion: ['rain', 'mines'], color: 0xff9a3a, mul: { n: 2, dmg: 1.8, cd: 0.7 }, lv: ['Fusión: el cielo entero cae sobre tus enemigos.'] },
  kefla_1: { name: 'Esferas de Kefla', icon: '✦', kind: 'blast', unique: 'kefla', color: 0xb8ff5a, lv: ['Kefla lanza esferas de ki verde que explotan al impactar.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  kefla_2: { name: 'Ráfagas Teledirigidas de Kefla', icon: '✦', kind: 'homing', unique: 'kefla', minLv: 3, color: 0xff8ad8, cfg: { n: 4, dmg: 18, cd: 2.0 }, lv: ['Esferas rosas que persiguen a la horda.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  kefla_3: { name: 'Kamehameha de Kefla', icon: '✦', kind: 'bigbeam', unique: 'kefla', minLv: 6, shop: 0x000bb8, color: 0xff8ad8, cfg: { cd: 9, dmg: 14, len: 36, hw: 2.6, life: 1.2, cost: 20 }, lv: ['Rayo rosa potente en línea recta.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  kefla_4: { name: 'Ráfaga de Kefla', icon: '✦', kind: 'barrage', unique: 'kefla', minLv: 7, color: 0xb8ff5a, cfg: { n: 9, dmg: 12, cd: 2.2 }, lv: ['Ráfaga continua de esferas verdes.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  gotenks_1: { name: 'Ráfagas de Gotenks', icon: '✦', kind: 'bullet', unique: 'gotenks', color: 0xc8a0ff, lv: ['Gotenks lanza ráfagas de ki al enemigo más cercano.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  gotenks_2: { name: 'Esferas Fantasma', icon: '✦', kind: 'homing', unique: 'gotenks', minLv: 3, color: 0xffe14a, cfg: { n: 5, dmg: 16, cd: 2.2 }, lv: ['Esferas que persiguen a la horda.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  gotenks_3: { name: 'Kamehameha Infantil', icon: '✦', kind: 'bigbeam', unique: 'gotenks', minLv: 6, shop: 0x000bb8, color: 0xc8a0ff, cfg: { cd: 10, dmg: 13, len: 34, hw: 2.4, life: 1.1, cost: 18 }, lv: ['Rayo ligero y rápido.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  gotenks_4: { name: 'Discos Gemelos', icon: '✦', kind: 'discs', unique: 'gotenks', minLv: 7, color: 0xffe14a, cfg: { cd: 1.8, n: 3, dmg: 16, spd: 20, life: 1.4 }, lv: ['Discos de ki que cortan a su paso.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  trunksarm_1: { name: 'Esferas de la Armadura', icon: '✦', kind: 'blast', unique: 'trunksarm', color: 0x6fb8ff, lv: ['Trunks lanza esferas de ki que explotan al impactar.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  trunksarm_2: { name: 'Rayos Guiados', icon: '✦', kind: 'homing', unique: 'trunksarm', minLv: 3, color: 0x9fe0ff, cfg: { n: 4, dmg: 20, cd: 2.1 }, lv: ['Rayos que persiguen a la horda.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  trunksarm_3: { name: 'Rayo de la Espada', icon: '✦', kind: 'bigbeam', unique: 'trunksarm', minLv: 6, shop: 0x000dac, color: 0x6fb8ff, cfg: { cd: 10, dmg: 15, len: 38, hw: 2.8, life: 1.2, cost: 22 }, lv: ['Rayo azul concentrado en la espada.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  trunksarm_4: { name: 'Destello Futuro', icon: '✦', kind: 'flare', unique: 'trunksarm', minLv: 7, color: 0x9fe0ff, cfg: { r: 12, stun: 2, dmg: 40, cd: 5 }, lv: ['Destello que aturde a los enemigos cercanos.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  caulifla_1: { name: 'Ráfagas de Caulifla', icon: '✦', kind: 'bullet', unique: 'caulifla', color: 0xff6aa0, lv: ['Caulifla lanza bolas de ki rosas al enemigo más cercano.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  caulifla_2: { name: 'Bombardeo de Caulifla', icon: '✦', kind: 'barrage', unique: 'caulifla', minLv: 3, color: 0xffd0e0, cfg: { n: 8, dmg: 13, cd: 2.3 }, lv: ['Una lluvia de ki continua sobre la horda.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  caulifla_3: { name: 'Galick Salvaje', icon: '✦', kind: 'bigbeam', unique: 'caulifla', minLv: 6, shop: 0x000c80, color: 0xff6aa0, cfg: { cd: 10, dmg: 14, len: 36, hw: 2.6, life: 1.2, cost: 20 }, lv: ['Rayo rosa directo.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  caulifla_4: { name: 'Explosión de Caulifla', icon: '✦', kind: 'bigbang', unique: 'caulifla', minLv: 7, color: 0xffd0e0, lv: ['Esfera lenta que explota con gran área.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  kale_1: { name: 'Golpe Berserker', icon: '✦', kind: 'blast', unique: 'kale', color: 0xffd040, lv: ['Kale lanza esferas amarillas que explotan.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  kale_2: { name: 'Esferas de Kale', icon: '✦', kind: 'orbit', unique: 'kale', minLv: 3, color: 0xff7a2a, lv: ['Dos esferas que giran a su alrededor.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  kale_3: { name: 'Rayo de Kale', icon: '✦', kind: 'bigbeam', unique: 'kale', minLv: 6, shop: 0x000e10, color: 0xffd040, cfg: { cd: 11, dmg: 16, len: 34, hw: 3.0, life: 1.1, cost: 24 }, lv: ['Un rayo amarillo ancho y lento.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  kale_4: { name: 'Discos de Kale', icon: '✦', kind: 'discs', unique: 'kale', minLv: 7, color: 0xff7a2a, cfg: { cd: 1.8, n: 4, dmg: 20, spd: 18, life: 1.4 }, lv: ['Discos que cortan a todo lo que tocan.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  kyabe_1: { name: 'Discos de Kyabe', icon: '✦', kind: 'discs', unique: 'kyabe', color: 0xffe86a, cfg: { cd: 1.5, n: 1, dmg: 15, spd: 20, life: 1.3 }, lv: ['Kyabe lanza un disco que atraviesa a todos.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  kyabe_2: { name: 'Esferas de Kyabe', icon: '✦', kind: 'homing', unique: 'kyabe', minLv: 3, color: 0xffb040, cfg: { n: 4, dmg: 18, cd: 2.1 }, lv: ['Esferas que persiguen a la horda.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  kyabe_3: { name: 'Rayo de Kyabe', icon: '✦', kind: 'bigbeam', unique: 'kyabe', minLv: 6, shop: 0x000c80, color: 0xffe86a, cfg: { cd: 10, dmg: 14, len: 36, hw: 2.6, life: 1.2, cost: 20 }, lv: ['Rayo amarillo directo.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  kyabe_4: { name: 'Destello de Kyabe', icon: '✦', kind: 'flare', unique: 'kyabe', minLv: 7, color: 0xfff0a0, cfg: { r: 13, stun: 2.5, dmg: 50, cd: 5 }, lv: ['Destello que aturde a los cercanos.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  toppo_1: { name: 'Ráfagas de Toppo', icon: '✦', kind: 'bullet', unique: 'toppo', color: 0xff4a4a, lv: ['Toppo lanza esferas rojas al enemigo más cercano.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  toppo_2: { name: 'Bombardeo de Pride', icon: '✦', kind: 'barrage', unique: 'toppo', minLv: 3, color: 0xffe14a, cfg: { n: 8, dmg: 14, cd: 2.4 }, lv: ['Ráfaga de esferas que caen sobre la horda.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  toppo_3: { name: 'Esfera de Toppo', icon: '✦', kind: 'bigbang', unique: 'toppo', minLv: 6, shop: 0x000e10, color: 0xff4a4a, lv: ['Esfera lenta que explota con gran área.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  toppo_4: { name: 'Persecución de Toppo', icon: '✦', kind: 'homing', unique: 'toppo', minLv: 7, color: 0xff9a4a, cfg: { n: 5, dmg: 20, cd: 2.2 }, lv: ['Esferas que persiguen al enemigo más cercano.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  janemba_1: { name: 'Llamas de Janemba', icon: '✦', kind: 'bullet', unique: 'janemba', color: 0xff3a3a, lv: ['Janemba lanza bolas de fuego al enemigo más cercano.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  janemba_2: { name: 'Almas Errantes', icon: '✦', kind: 'homing', unique: 'janemba', minLv: 3, color: 0xb07aff, cfg: { n: 5, dmg: 20, cd: 2.2 }, lv: ['Esferas que persiguen a la horda.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  janemba_3: { name: 'Rayo del Caos', icon: '✦', kind: 'bigbeam', unique: 'janemba', minLv: 6, shop: 0x000ed8, color: 0xff3a3a, cfg: { cd: 10, dmg: 16, len: 38, hw: 2.8, life: 1.2, cost: 22 }, lv: ['Un rayo rojo que atraviesa la horda.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  janemba_4: { name: 'Esferas del Caos', icon: '✦', kind: 'orbit', unique: 'janemba', minLv: 7, color: 0xb07aff, lv: ['Esferas oscuras que giran a su alrededor.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  jiren_1: { name: 'Esferas de Jiren', icon: '✦', kind: 'blast', unique: 'jiren', color: 0xd0d0d8, lv: ['Jiren lanza esferas de ki gris que explotan.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  jiren_2: { name: 'Ráfaga del Torneo', icon: '✦', kind: 'barrage', unique: 'jiren', minLv: 3, color: 0xff3a3a, cfg: { n: 9, dmg: 14, cd: 2.2 }, lv: ['Una ráfaga continua de golpes de ki.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  jiren_3: { name: 'Rayo de Jiren', icon: '✦', kind: 'bigbeam', unique: 'jiren', minLv: 6, shop: 0x000fa0, color: 0xd0d0d8, cfg: { cd: 11, dmg: 18, len: 40, hw: 3.0, life: 1.3, cost: 24 }, lv: ['Rayo gris de gran alcance.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  jiren_4: { name: 'Esfera del Torneo', icon: '✦', kind: 'bigbang', unique: 'jiren', minLv: 7, color: 0xff3a3a, lv: ['Esfera que explota con gran área.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  turles_1: { name: 'Esferas de Turles', icon: '✦', kind: 'blast', unique: 'turles', color: 0xc8c8ff, lv: ['Turles lanza esferas que explotan al impactar.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  turles_2: { name: 'Esferas del Árbol Sagrado', icon: '✦', kind: 'orbit', unique: 'turles', minLv: 3, color: 0xffb040, lv: ['Dos esferas giran a su alrededor.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  turles_3: { name: 'Rayo de Turles', icon: '✦', kind: 'bigbeam', unique: 'turles', minLv: 6, shop: 0x000d48, color: 0xc8c8ff, cfg: { cd: 10, dmg: 15, len: 36, hw: 2.6, life: 1.2, cost: 20 }, lv: ['Rayo blanco concentrado.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  turles_4: { name: 'Discos de Turles', icon: '✦', kind: 'discs', unique: 'turles', minLv: 7, color: 0xffb040, cfg: { cd: 1.7, n: 3, dmg: 18, spd: 20, life: 1.4 }, lv: ['Discos que cortan la horda.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  saibaman_1: { name: 'Ráfagas de Saibaman', icon: '✦', kind: 'bullet', unique: 'saibaman', color: 0x9ad040, lv: ['Saibaman lanza bolas de ki verdes al enemigo más cercano.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  saibaman_2: { name: 'Enjambre Verde', icon: '✦', kind: 'homing', unique: 'saibaman', minLv: 3, color: 0xc8ff6a, cfg: { n: 4, dmg: 16, cd: 2.0 }, lv: ['Esferas que persiguen al enemigo.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  saibaman_3: { name: 'Explosión Saibaman', icon: '✦', kind: 'bigbang', unique: 'saibaman', minLv: 6, shop: 0x000960, color: 0x9ad040, lv: ['Esfera que explota con gran área.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  saibaman_4: { name: 'Lluvia Saibaman', icon: '✦', kind: 'barrage', unique: 'saibaman', minLv: 7, color: 0xc8ff6a, cfg: { n: 8, dmg: 11, cd: 2.2 }, lv: ['Ráfaga continua de esferas.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  bills_1: { name: 'Ráfagas de Bills', icon: '✦', kind: 'bullet', unique: 'bills', color: 0xb08aff, lv: ['Bills lanza esferas de ki moradas al enemigo más cercano.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  bills_2: { name: 'Esferas de Bills', icon: '✦', kind: 'homing', unique: 'bills', minLv: 3, color: 0xffe14a, cfg: { n: 5, dmg: 20, cd: 2.2 }, lv: ['Esferas que persiguen a la horda.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  bills_3: { name: 'Rayo de la Destrucción', icon: '✦', kind: 'bigbeam', unique: 'bills', minLv: 6, shop: 0x001068, color: 0xb08aff, cfg: { cd: 10, dmg: 16, len: 40, hw: 2.8, life: 1.2, cost: 24 }, lv: ['Rayo morado de gran alcance.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  bills_4: { name: 'Esfera de Bills', icon: '✦', kind: 'bigbang', unique: 'bills', minLv: 7, color: 0xffe14a, lv: ['Esfera que explota con gran área.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  cooler_1: { name: 'Ráfagas de Cooler', icon: '✦', kind: 'bullet', unique: 'cooler', color: 0xd080ff, lv: ['Cooler lanza ráfagas de ki morado al enemigo más cercano.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  cooler_2: { name: 'Ráfaga del Tirano', icon: '✦', kind: 'barrage', unique: 'cooler', minLv: 3, color: 0xffe14a, cfg: { n: 8, dmg: 14, cd: 2.3 }, lv: ['Ráfaga continua de esferas.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  cooler_3: { name: 'Rayo de Cooler', icon: '✦', kind: 'bigbeam', unique: 'cooler', minLv: 6, shop: 0x000ed8, color: 0xd080ff, cfg: { cd: 10, dmg: 16, len: 40, hw: 2.8, life: 1.2, cost: 22 }, lv: ['Rayo morado concentrado.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  cooler_4: { name: 'Destello de Cooler', icon: '✦', kind: 'flare', unique: 'cooler', minLv: 7, color: 0xffe14a, cfg: { r: 14, stun: 2.5, dmg: 55, cd: 5 }, lv: ['Destello que aturde a los enemigos.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  hitto_1: { name: 'Esferas de Hit', icon: '✦', kind: 'blast', unique: 'hitto', color: 0x8a6aff, lv: ['Hit lanza esferas moradas que explotan.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  hitto_2: { name: 'Persecución Temporal', icon: '✦', kind: 'homing', unique: 'hitto', minLv: 3, color: 0xc8a0ff, cfg: { n: 4, dmg: 20, cd: 2.1 }, lv: ['Esferas que persiguen a la horda.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  hitto_3: { name: 'Rayo de Hit', icon: '✦', kind: 'bigbeam', unique: 'hitto', minLv: 6, shop: 0x000ed8, color: 0x8a6aff, cfg: { cd: 10, dmg: 15, len: 38, hw: 2.6, life: 1.2, cost: 22 }, lv: ['Rayo morado rápido.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  hitto_4: { name: 'Discos Temporales', icon: '✦', kind: 'discs', unique: 'hitto', minLv: 7, color: 0xc8a0ff, cfg: { cd: 1.8, n: 3, dmg: 18, spd: 20, life: 1.4 }, lv: ['Discos que cortan a su paso.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  raditz_1: { name: 'Ráfagas de Raditz', icon: '✦', kind: 'bullet', unique: 'raditz', color: 0xc8ff8a, lv: ['Raditz lanza ráfagas de ki al enemigo más cercano.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  raditz_2: { name: 'Ráfagas Guiadas', icon: '✦', kind: 'homing', unique: 'raditz', minLv: 3, color: 0xffe14a, cfg: { n: 4, dmg: 17, cd: 2.1 }, lv: ['Esferas que persiguen a la horda.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  raditz_3: { name: 'Rayo de Raditz', icon: '✦', kind: 'bigbeam', unique: 'raditz', minLv: 6, shop: 0x000bb8, color: 0xc8ff8a, cfg: { cd: 10, dmg: 14, len: 36, hw: 2.6, life: 1.2, cost: 20 }, lv: ['Rayo verde directo.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  raditz_4: { name: 'Ráfaga de Raditz', icon: '✦', kind: 'barrage', unique: 'raditz', minLv: 7, color: 0xffe14a, cfg: { n: 8, dmg: 12, cd: 2.2 }, lv: ['Ráfaga continua de ki.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  andro16_1: { name: 'Esferas del 16', icon: '✦', kind: 'blast', unique: 'andro16', color: 0x7dff5a, lv: ['El Androide 16 lanza esferas verdes que explotan.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  andro16_2: { name: 'Esferas del Androide', icon: '✦', kind: 'orbit', unique: 'andro16', minLv: 3, color: 0xffe14a, lv: ['Dos esferas giran a su alrededor.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  andro16_3: { name: 'Rayo Androide', icon: '✦', kind: 'bigbeam', unique: 'andro16', minLv: 6, shop: 0x000fa0, color: 0x7dff5a, cfg: { cd: 10, dmg: 15, len: 38, hw: 2.8, life: 1.2, cost: 22 }, lv: ['Rayo verde directo.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  andro16_4: { name: 'Esfera Androide', icon: '✦', kind: 'bigbang', unique: 'andro16', minLv: 7, color: 0xffe14a, lv: ['Esfera que explota con gran área.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  andro17_1: { name: 'Esferas del 17', icon: '✦', kind: 'blast', unique: 'andro17', color: 0x6ab8ff, lv: ['El Androide 17 lanza esferas azules que explotan.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  andro17_2: { name: 'Persecución Infinita', icon: '✦', kind: 'homing', unique: 'andro17', minLv: 3, color: 0x9fe0ff, cfg: { n: 4, dmg: 18, cd: 2.1 }, lv: ['Esferas que persiguen a la horda.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  andro17_3: { name: 'Rayo del 17', icon: '✦', kind: 'bigbeam', unique: 'andro17', minLv: 6, shop: 0x000fa0, color: 0x6ab8ff, cfg: { cd: 10, dmg: 15, len: 38, hw: 2.6, life: 1.2, cost: 20 }, lv: ['Rayo azul concentrado.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  andro17_4: { name: 'Discos del 17', icon: '✦', kind: 'discs', unique: 'andro17', minLv: 7, color: 0x9fe0ff, cfg: { cd: 1.6, n: 3, dmg: 19, spd: 20, life: 1.4 }, lv: ['Discos que cortan la horda.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  andro18_1: { name: 'Balas de Ki del 18', icon: '✦', kind: 'bullet', unique: 'andro18', color: 0xffe86a, lv: ['La Androide 18 lanza ráfagas al enemigo más cercano.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  andro18_2: { name: 'Ráfaga del 18', icon: '✦', kind: 'barrage', unique: 'andro18', minLv: 3, color: 0xffb040, cfg: { n: 8, dmg: 13, cd: 2.2 }, lv: ['Ráfaga continua de ki.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  andro18_3: { name: 'Rayo del 18', icon: '✦', kind: 'bigbeam', unique: 'andro18', minLv: 6, shop: 0x000ed8, color: 0xffe86a, cfg: { cd: 10, dmg: 15, len: 36, hw: 2.6, life: 1.2, cost: 20 }, lv: ['Rayo amarillo directo.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  andro18_4: { name: 'Destello del 18', icon: '✦', kind: 'flare', unique: 'andro18', minLv: 7, color: 0xfff0a0, cfg: { r: 12, stun: 2, dmg: 45, cd: 5 }, lv: ['Destello que aturde a los cercanos.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  majin_1: { name: 'Caramelos de Buu', icon: '✦', kind: 'blast', unique: 'majin', color: 0xff9ad0, lv: ['Buu lanza caramelos rosas que explotan.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  majin_2: { name: 'Caramelos Teledirigidos', icon: '✦', kind: 'homing', unique: 'majin', minLv: 3, color: 0xffd0ec, cfg: { n: 5, dmg: 18, cd: 2.2 }, lv: ['Caramelos que persiguen a la horda.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  majin_3: { name: 'Rayo Rosa de Buu', icon: '✦', kind: 'bigbeam', unique: 'majin', minLv: 6, shop: 0x000fa0, color: 0xff9ad0, cfg: { cd: 11, dmg: 15, len: 36, hw: 2.8, life: 1.2, cost: 22 }, lv: ['Rayo rosa directo.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  majin_4: { name: 'Explosión de Buu', icon: '✦', kind: 'bigbang', unique: 'majin', minLv: 7, color: 0xffd0ec, lv: ['Esfera que explota con gran área.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  superbuu_1: { name: 'Ráfagas de Super Buu', icon: '✦', kind: 'bullet', unique: 'superbuu', color: 0xff7ac8, lv: ['Super Buu lanza esferas rosas al enemigo más cercano.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  superbuu_2: { name: 'Ráfaga Evolucionada', icon: '✦', kind: 'barrage', unique: 'superbuu', minLv: 3, color: 0xffe14a, cfg: { n: 8, dmg: 14, cd: 2.3 }, lv: ['Ráfaga continua de esferas.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  superbuu_3: { name: 'Rayo de Super Buu', icon: '✦', kind: 'bigbeam', unique: 'superbuu', minLv: 6, shop: 0x001068, color: 0xff7ac8, cfg: { cd: 10, dmg: 16, len: 40, hw: 2.8, life: 1.2, cost: 22 }, lv: ['Rayo rosa concentrado.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  superbuu_4: { name: 'Esfera de Super Buu', icon: '✦', kind: 'bigbang', unique: 'superbuu', minLv: 7, color: 0xffe14a, lv: ['Esfera que explota con gran área.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  zamasu_1: { name: 'Esferas de Zamasu', icon: '✦', kind: 'blast', unique: 'zamasu', color: 0xa890ff, lv: ['Zamasu lanza esferas moradas que explotan.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  zamasu_2: { name: 'Almas de Zamasu', icon: '✦', kind: 'homing', unique: 'zamasu', minLv: 3, color: 0xc8b8ff, cfg: { n: 5, dmg: 19, cd: 2.2 }, lv: ['Esferas que persiguen a la horda.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  zamasu_3: { name: 'Rayo Inmortal', icon: '✦', kind: 'bigbeam', unique: 'zamasu', minLv: 6, shop: 0x000fa0, color: 0xa890ff, cfg: { cd: 10, dmg: 16, len: 38, hw: 2.6, life: 1.2, cost: 22 }, lv: ['Rayo morado concentrado.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  zamasu_4: { name: 'Cuchillas de Zamasu', icon: '✦', kind: 'discs', unique: 'zamasu', minLv: 7, color: 0xc8b8ff, cfg: { cd: 1.7, n: 3, dmg: 18, spd: 20, life: 1.4 }, lv: ['Cuchillas que cortan la horda.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
};
const MAX_WEAPON_LEVEL = 5, MAX_WEAPONS = 6;

/* ---------- Vitaminas (mejoras pasivas) ---------- */
const STATS = [
  { id: 'dmg', name: 'Gravedad x10', icon: '⬆', max: 5, text: '+12% de daño.', apply: (p, k = 1) => { p.statDmg += 0.12 * k; } },
  { id: 'hp', name: 'Corazón Saiyajin', icon: '♥', max: 5, text: '+25 de vida máxima y curas 25.', apply: (p, k = 1) => { p.maxHp += 25 * k; p.hp += 25 * k; } },
  { id: 'spd', name: 'Vuelo Veloz', icon: '»', max: 5, text: '+8% de velocidad.', apply: (p, k = 1) => { p.speedMul += 0.08 * k; } },
  { id: 'mag', name: 'Imán de Orbes', icon: '⌖', max: 5, text: '+35% de alcance del imán.', apply: (p, k = 1) => { p.magnet *= 1 + 0.35 * k; } },
  { id: 'rate', name: 'Reflejos de Combate', icon: '⏱', max: 5, text: '+10% de cadencia de ataque.', apply: (p, k = 1) => { p.rateMul += 0.1 * k; } },
  { id: 'crit', name: 'Instinto Letal', icon: '✚', max: 5, text: '+6% de probabilidad de crítico.', apply: (p, k = 1) => { p.crit += 0.06 * k; } },
  { id: 'senzu', name: 'Semilla Senzu', icon: '❖', max: 5, text: 'Regeneras 0,6 de vida por segundo.', apply: (p, k = 1) => { p.regen += 0.6 * k; } },
  { id: 'ki', name: 'Cápsula de Ki', icon: '⚡', max: 5, text: '+25 de Ki máximo y +1,5 Ki/s.', apply: (p, k = 1) => { p.maxKi += 25 * k; p.kiRegen += 1.5 * k; } },
  { id: 'armor', name: 'Gi de Entrenamiento', icon: '▣', max: 5, text: 'Recibes un 7% menos de daño.', apply: (p, k = 1) => { p.armor = Math.min(0.5, p.armor + 0.07 * k); } },
  // Ataque físico y ataque de ki por separado
  { id: 'fuerza', name: 'Fuerza Bruta', icon: '✊', max: 5, text: '+12% de ataque físico (golpes, espadas, combos).', apply: (p, k = 1) => { p.atkF += 0.12 * k; } },
  { id: 'energia', name: 'Energía Concentrada', icon: '✺', max: 5, text: '+12% de ataque de ki (ráfagas, rayos, esferas).', apply: (p, k = 1) => { p.atkK += 0.12 * k; } },
  // Control del Ki: cargar más rápido, gastar menos y aguantar transformado
  { id: 'carga', name: 'Concentración Total', icon: '✺', max: 5, text: 'Cargas Ki con [C] un 30% más rápido.', apply: (p, k = 1) => { p.chargeMul += 0.3 * k; } },
  { id: 'ahorro', name: 'Control del Ki', icon: '◐', max: 5, text: 'Técnicas, rayos, Ultimate y transformaciones gastan un 7% menos de Ki.', apply: (p, k = 1) => { kiSave(p, 1 - 0.07 * k); } },
  { id: 'sereno', name: 'Ki Sereno', icon: '☯', max: 5, text: 'Transformado sigues regenerando un 20% de tu Ki por segundo.', apply: (p, k = 1) => { kiForm(p, 0.2 * k); } },
  { id: 'absorber', name: 'Absorción de Energía', icon: '⇲', max: 5, text: '+0,4 de Ki por cada enemigo derrotado.', apply: (p, k = 1) => { p.kiOnKill += 0.4 * k; } }
];
/* ---------- Rarezas de las cartas al subir de nivel ----------
   Vitaminas: multiplican su efecto (mul). Técnicas: además de subir de nivel, ganan daño propio (dmg, se acumula).
   La suerte del jugador sube las rarezas altas (más cuanto más alta es la rareza) */
const CARD_TIERS = [
  { name: 'COMÚN', mul: 1, dmg: 0, w: 62, col: '#c8d0d8' },
  { name: 'RARO', mul: 1.5, dmg: 0.1, w: 24, col: '#4ab0ff' },
  { name: 'SÚPER RARO', mul: 2, dmg: 0.2, w: 9, col: '#3ee08a' },
  { name: 'ÉPICO', mul: 2.5, dmg: 0.35, w: 4, col: '#c06aff' },
  { name: 'LEGENDARIO', mul: 3, dmg: 0.5, w: 1, col: '#ffc83a' }
];
/** Rareza al azar según la suerte (0 = común) */
function rollTier(luck) {
  const w = CARD_TIERS.map((t, i) => t.w * (i ? Math.pow(1 + Math.max(0, luck) * 0.1, 0.6 + i * 0.25) : 1));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; }
  return 0;
}
/** Texto de una vitamina con su efecto multiplicado (los números del texto) */
const scaleText = (s, k) => k === 1 ? s : s.replace(/\d+(?:,\d+)?/g, (n) => { const v = parseFloat(n.replace(',', '.')) * k; return String(v < 3 ? Math.round(v * 10) / 10 : Math.round(v)).replace('.', ','); });

/* ---------- Enemigos: hoja "enemies" (8 columnas por fila) ----------
   Columnas de cada fila: 0-3 caminar · 4 herido · 5 ataque · 6 técnica · 7 pose.
   `row` = fila del personaje. Cada tipo tiene su habilidad (`ab`), sacada de la serie. */
const ENEMY_ROWS = { saibai: 0, soldado: 1, appule: 2, nappa: 3, ginyu: 4, cellimp: 5, a17: 6, mcooler: 7, frost: 8, buu: 9, a18: 10, kale: 11, kyabe: 12, caulifla: 13 };
const ENEMY_TYPES = [
  // Soldado de Freezer (en la Tierra y la Cámara del Tiempo la tropa básica son Saibaimans)
  { name: 'Soldado de Freezer', row: 1, hp: 1, spd: 1, scale: 1, tint: 0xffffff, dmg: 1, xp: 1, r: 0.7, cash: 1 },
  // Appule: rápido y frágil
  { name: 'Appule', row: 2, hp: 0.55, spd: 1.75, scale: 0.95, tint: 0xffffff, dmg: 0.7, xp: 1.2, r: 0.6, cash: 1.5 },
  // Nappa: bruto. «Bomber DX»: levanta dos dedos y el suelo bajo tus pies explota
  { name: 'Nappa', row: 3, hp: 3.2, spd: 0.72, scale: 1.4, tint: 0xffffff, dmg: 1.6, xp: 3, r: 1.05, cash: 4, knock: 14, smash: true, ab: 'bomber' },
  { name: 'JEFE', row: 0, hp: 1, spd: 0.62, scale: 2.7, tint: 0xffffff, dmg: 2.4, xp: 30, r: 1.8, cash: 200, knock: 20, smash: true },
  // Capitán Ginyu: élite. «Cambio de cuerpo»: si su rayo te alcanza, tus controles se invierten unos segundos
  { name: 'Capitán Ginyu', row: 4, hp: 8, spd: 0.95, scale: 1.7, tint: 0xffffff, dmg: 2, xp: 14, r: 1.3, cash: 30, knock: 10, smash: true, ab: 'bodychange' },
  // Saibaiman: corre hacia ti y se autodestruye (si lo matas antes, su explosión daña a la horda)
  { name: 'Saibaiman', row: 0, hp: 0.7, spd: 1.45, scale: 0.9, tint: 0xffffff, dmg: 2.4, xp: 1.4, r: 0.65, cash: 2, boom: true },
  // Metal Cooler: cuerpo de metal (sus 4 primeros golpes apenas le hacen daño) que la Big Gete Star vuelve a reparar
  { name: 'Metal Cooler', row: 7, hp: 2.2, spd: 0.85, scale: 1.2, tint: 0xffffff, dmg: 1.3, xp: 2.2, r: 0.85, cash: 3, shield: 4, ab: 'regen' },
  // Androide 17: vuela, mantiene la distancia y dispara ráfagas de energía
  { name: 'Androide 17', row: 6, hp: 0.8, spd: 1.2, scale: 1, tint: 0xffffff, dmg: 0.8, xp: 1.8, r: 0.65, cash: 2.5, fly: true },
  // Célula imperfecto: «Absorción». Cada vez que te toca te roba vida, se cura y crece
  { name: 'Célula imperfecto', row: 5, hp: 2.6, spd: 0.9, scale: 1.2, tint: 0xffffff, dmg: 1.2, xp: 2.6, r: 0.9, cash: 3, absorb: true },
  // Célula Jr.: los hijos de Célula Perfecto. Pequeños, rápidos y azulados
  { name: 'Célula Jr.', row: 5, hp: 0.9, spd: 1.6, scale: 0.7, tint: 0x9ac0ff, dmg: 1, xp: 1.5, r: 0.55, cash: 2 },
  /* ---- Tropa nueva del pack (filas 8-13): cada uno con su efecto sobre el jugador ---- */
  // Frost: «Aguja venenosa». Te envenena: pierdes vida unos segundos
  { name: 'Frost', row: 8, hp: 1.1, spd: 1, scale: 1.05, tint: 0xffffff, dmg: 0.9, xp: 1.8, r: 0.65, cash: 2.5, ab: 'needle' },
  // Majin Buu: «Rayo de caramelo». Te ralentiza. Es grande y aguanta mucho
  { name: 'Majin Buu', row: 9, hp: 3.6, spd: 0.7, scale: 1.35, tint: 0xffffff, dmg: 1.4, xp: 3, r: 1.05, cash: 4, knock: 10, smash: true, ab: 'candy' },
  // Androide 18: rápida; cada golpe que te da te roba Ki
  { name: 'Androide 18', row: 10, hp: 0.9, spd: 1.55, scale: 0.95, tint: 0xffffff, dmg: 0.8, xp: 1.8, r: 0.6, cash: 2.5, drain: 22 },
  // Kale: «Furia berserker». Embiste de golpe contra ti
  { name: 'Kale', row: 11, hp: 2.4, spd: 0.95, scale: 1.15, tint: 0xffffff, dmg: 1.5, xp: 2.6, r: 0.8, cash: 3, knock: 12, ab: 'rush' },
  // Kyabe: «Ki de Sadala». Te debilita: haces menos daño unos segundos
  { name: 'Kyabe', row: 12, hp: 1.2, spd: 1.05, scale: 1, tint: 0xffffff, dmg: 0.9, xp: 2, r: 0.65, cash: 2.5, ab: 'weakshot' },
  // Caulifla: vuela y dispara; sus ráfagas te dejan sin dash
  { name: 'Caulifla', row: 13, hp: 1, spd: 1.25, scale: 1, tint: 0xffffff, dmg: 0.85, xp: 2.2, r: 0.65, cash: 2.5, fly: true, flyEff: 'nodash', flyTint: 0xff6aa0 },
  // Soldado de Freezer élite (dibujo rojo): más vida y tres disparos en abanico
  { name: 'Soldado élite', row: 1, hp: 2.6, spd: 0.9, scale: 1.15, tint: 0xff7a7a, dmg: 1.3, xp: 4, r: 0.85, cash: 5, ab: 'volley' },
  // Saibaiman de hielo: rápido y frágil; su ráfaga helada te ralentiza
  { name: 'Saibaiman de hielo', row: 0, hp: 0.7, spd: 1.6, scale: 0.9, tint: 0xa8e8ff, dmg: 0.8, xp: 1.6, r: 0.65, cash: 2, ab: 'icebolt' }
];
/* Índices de tipo para que el código se lea mejor */
const T_BASIC = 0, T_FAST = 1, T_BRUTE = 2, T_BOSS = 3, T_ELITE = 4, T_BOOM = 5, T_SHIELD = 6, T_FLY = 7, T_ABSORB = 8, T_CELLJR = 9;
const T_FROST = 10, T_MBUU = 11, T_A18 = 12, T_KALE = 13, T_KYABE = 14, T_CAULI = 15, T_SOLDIER_E = 16, T_ICESAI = 17;


/* ---------- Rarezas y objetos (se encuentran en Cápsulas del mapa) ----------
   Rareza 0-1 disponibles desde el principio; 2+ hay que desbloquearlas en la Tienda. */
const RARITIES = [
  { name: 'COMÚN', color: '#c4cfdb', cost: 0 },
  { name: 'RARO', color: '#4ab0ff', cost: 0 },
  { name: 'MUY RARO', color: '#5be07a', cost: 800 },
  { name: 'ÉPICO', color: '#b866ff', cost: 2200 },
  { name: 'LEGENDARIO', color: '#ffb02e', cost: 5500 },
  { name: 'ULTRA LEGENDARIO', color: '#ff4d78', cost: 13000 }
];
const hp = (p, n) => { p.maxHp += n; p.hp += n; };
// Ahorro de Ki (como mucho se gasta un 60% menos) y regeneración transformado (como mucho el 100%)
const kiSave = (p, f) => { p.kiUse = Math.max(0.4, p.kiUse * f); };
const kiForm = (p, n) => { p.formRegen = Math.min(1, p.formRegen + n); };
const ITEMS = [
  { id: 'cinta', icon: '⚑', name: 'Cinta de Entrenamiento', rarity: 0, text: '+6% de daño.', apply: (p) => { p.statDmg += 0.06; } },
  { id: 'botas', icon: '»', name: 'Botas Pesadas', rarity: 0, text: '+5% de velocidad.', apply: (p) => { p.speedMul += 0.05; } },
  { id: 'senzu_seca', icon: '♥', name: 'Semilla Seca', rarity: 0, text: '+20 de vida máxima.', apply: (p) => hp(p, 20) },
  { id: 'radar', icon: '⌖', name: 'Radar del Dragón', rarity: 0, text: '+20% de imán de orbes.', apply: (p) => { p.magnet *= 1.2; } },
  { id: 'capsula_ki', icon: '⚡', name: 'Cápsula de Ki', rarity: 0, text: '+15 de Ki máximo y +1 Ki/s.', apply: (p) => { p.maxKi += 15; p.kiRegen += 1; } },
  { id: 'scouter', icon: '◎', name: 'Scouter Roto', rarity: 0, text: '+4% de probabilidad de crítico.', apply: (p) => { p.crit += 0.04; } },
  { id: 'guante_hielo', icon: '✊', name: 'Guante de Hielo', rarity: 1, text: '+10% de daño contra enemigos con menos del 30% de vida.', apply: (p) => { p.guanteMul = 1.1; } },
  { id: 'pluma_sagrada', icon: '✿', name: 'Pluma Sagrada', rarity: 1, text: 'Cada 20 enemigos derrotados recuperas un 5% de vida.', apply: (p) => { p.pluma = true; } },
  { id: 'reloj_arena', icon: '⌛', name: 'Reloj de Arena', rarity: 1, text: 'Al bajar del 30% de vida, los enemigos van un 15% más lentos durante 5 s (cada 30 s).', apply: (p) => { p.reloj = true; } },

  { id: 'gi_roshi', icon: '▣', name: 'Gi del Maestro Roshi', rarity: 1, text: 'Recibes un 6% menos de daño.', apply: (p) => { p.armor = Math.min(0.6, p.armor + 0.06); } },
  { id: 'nube', icon: '☁', name: 'Nube Voladora', rarity: 1, text: '+10% de velocidad y dash 8% más rápido.', apply: (p) => { p.speedMul += 0.1; p.dashMul *= 0.92; } },
  { id: 'baston', icon: '⎮', name: 'Bastón Sagrado', rarity: 1, text: '+12% de daño.', apply: (p) => { p.statDmg += 0.12; } },
  { id: 'pesas', icon: '◍', name: 'Pesas del Maestro', rarity: 1, text: '+30 de vida máxima y +0,5 de vida/s.', apply: (p) => { hp(p, 30); p.regen += 0.5; } },
  { id: 'amuleto', icon: '♣', name: 'Amuleto de la Fortuna', rarity: 1, text: '+4 de suerte: más rareza en las cápsulas.', apply: (p) => { p.luck += 4; } },
  { id: 'libro', icon: '☰', name: 'Libro del Kame Sennin', rarity: 1, text: '+15% de experiencia.', apply: (p) => { p.xpMul += 0.15; } },

  { id: 'ropa_piccolo', icon: '▼', name: 'Ropa con Pesas de Piccolo', rarity: 2, text: '+15% de daño y 6% menos de daño recibido.', apply: (p) => { p.statDmg += 0.15; p.armor = Math.min(0.6, p.armor + 0.06); } },
  { id: 'agua_karin', icon: '≈', name: 'Agua Sagrada de Karin', rarity: 2, text: '+40 de vida máxima y +1 de vida/s.', apply: (p) => { hp(p, 40); p.regen += 1; } },
  { id: 'radar_bulma', icon: '◉', name: 'Radar de Bulma', rarity: 2, text: '+40% de imán, +20% de experiencia y ves las esferas en el radar.', apply: (p) => { p.magnet *= 1.4; p.xpMul += 0.2; p.ballSight = true; } },
  { id: 'gravedad', icon: '⟳', name: 'Cámara de Gravedad', rarity: 2, text: '+20% de cadencia de ataque.', apply: (p) => { p.rateMul += 0.2; } },
  { id: 'bolsa_zeni', icon: '$', name: 'Bolsa de Zeni', rarity: 2, text: '+30% de Zeni ganados.', apply: (p) => { p.zeniMul += 0.3; } },

  { id: 'saco_senzu', icon: '❖', name: 'Saco de Semillas Senzu', rarity: 3, text: '+60 de vida máxima y curas 0,4 por cada enemigo.', apply: (p) => { hp(p, 60); p.killHeal += 0.4; } },
  { id: 'aura_saiyan', icon: '✹', name: 'Aura Saiyajin', rarity: 3, text: '+25% de daño y +10% de cadencia.', apply: (p) => { p.statDmg += 0.25; p.rateMul += 0.1; } },
  { id: 'ozaru', icon: '☾', name: 'Cola de Mono', rarity: 3, text: '+35% de daño y +40 de vida máxima.', apply: (p) => { p.statDmg += 0.35; hp(p, 40); } },
  { id: 'reloj_trunks', icon: '⌚', name: 'Máquina del Tiempo', rarity: 3, text: '+15% de velocidad, dash 20% más rápido y +2 Ki/s.', apply: (p) => { p.speedMul += 0.15; p.dashMul *= 0.8; p.kiRegen += 2; } },

  { id: 'esfera4', icon: '★', name: 'Esfera de 4 Estrellas', rarity: 4, text: '+20% de daño, cadencia y velocidad, y +10% de crítico.', apply: (p) => { p.statDmg += 0.2; p.rateMul += 0.2; p.speedMul += 0.2; p.crit += 0.1; } },
  { id: 'aureola', icon: '◯', name: 'Aureola de Kaiō', rarity: 4, text: 'Revives una vez y recibes un 10% menos de daño.', apply: (p) => { if (!p.reviveUsed) p.canRevive = true; p.armor = Math.min(0.6, p.armor + 0.1); } },
  { id: 'armadura', icon: '⛨', name: 'Armadura Saiyajin Reforzada', rarity: 4, text: '+15% de armadura, +80 de vida y +2 de vida/s.', apply: (p) => { p.armor = Math.min(0.6, p.armor + 0.15); hp(p, 80); p.regen += 2; } },

  { id: 'zenkai', icon: '⚔', name: 'Zenkai Infinito', rarity: 5, text: '+60% de daño y +30% de cadencia.', apply: (p) => { p.statDmg += 0.6; p.rateMul += 0.3; } },
  { id: 'arbol', icon: '✿', name: 'Fruto del Árbol del Poder', rarity: 5, text: '+50% de daño, +30% de experiencia, +100 de vida y +3 de vida/s.', apply: (p) => { p.statDmg += 0.5; p.xpMul += 0.3; hp(p, 100); p.regen += 3; } },
  { id: 'shenron', icon: '☯', name: 'Escama de Shenron', rarity: 5, text: '+15% de esquiva, curas 0,8 por enemigo, +25% de daño y velocidad.', apply: (p) => { p.dodge = Math.min(0.5, p.dodge + 0.15); p.killHeal += 0.8; p.statDmg += 0.25; p.speedMul += 0.25; } },
  /* ---- Objetos nuevos ---- */
  { id: 'muñequeras', icon: '⚑', name: 'Muñequeras de Peso', rarity: 0, text: '+4% de daño y +3% de velocidad.', apply: (p) => { p.statDmg += 0.04; p.speedMul += 0.03; } },
  { id: 'bollo', icon: '♥', name: 'Bollo de Capsule Corp.', rarity: 0, text: '+15 de vida máxima y +0,3 de vida/s.', apply: (p) => { hp(p, 15); p.regen += 0.3; } },
  { id: 'gafas', icon: '◎', name: 'Gafas de Bulma', rarity: 1, text: '+6% de probabilidad de crítico.', apply: (p) => { p.crit += 0.06; } },
  { id: 'caparazon', icon: '▣', name: 'Caparazón de Tortuga', rarity: 1, text: 'Recibes un 5% menos de daño y +20 de vida máxima.', apply: (p) => { p.armor = Math.min(0.6, p.armor + 0.05); hp(p, 20); } },
  { id: 'espada_z', icon: '⚔', name: 'Espada Z', rarity: 2, text: '+5% de crítico y +25% de daño crítico.', apply: (p) => { p.crit += 0.05; p.critDmg += 0.25; } },
  { id: 'bola_baba', icon: '◉', name: 'Bola de Cristal de Uranai Baba', rarity: 2, text: '+3 de suerte y +15% de experiencia.', apply: (p) => { p.luck += 3; p.xpMul += 0.15; } },
  { id: 'potara', icon: '◈', name: 'Pendientes Pothala', rarity: 3, text: '+15% de daño, +10% de cadencia y +5% de velocidad.', apply: (p) => { p.statDmg += 0.15; p.rateMul += 0.1; p.speedMul += 0.05; } },
  { id: 'traje_bardock', icon: '▼', name: 'Armadura de Bardock', rarity: 3, text: 'Recibes un 10% menos de daño y +1,5 de vida/s.', apply: (p) => { p.armor = Math.min(0.6, p.armor + 0.1); p.regen += 1.5; } },
  { id: 'reloj_whis', icon: '⌚', name: 'Báculo de Whis', rarity: 4, text: '+25% de cadencia, +3 Ki/s y dash un 15% más rápido.', apply: (p) => { p.rateMul += 0.25; p.kiRegen += 3; p.dashMul *= 0.85; } },
  /* ---- Objetos de ataque físico y de ataque de ki ---- */
  { id: 'guantes_lucha', icon: '✊', name: 'Guantes de Lucha', rarity: 0, text: '+8% de ataque físico.', apply: (p) => { p.atkF += 0.08; } },
  { id: 'amuleto_ki', icon: '✺', name: 'Amuleto de Ki', rarity: 0, text: '+8% de ataque de ki.', apply: (p) => { p.atkK += 0.08; } },
  { id: 'cinta_roja', icon: '✊', name: 'Cinta Roja de Combate', rarity: 1, text: '+12% de ataque físico.', apply: (p) => { p.atkF += 0.12; } },
  { id: 'pergamino_kame', icon: '✺', name: 'Pergamino del Kamehameha', rarity: 1, text: '+12% de ataque de ki.', apply: (p) => { p.atkK += 0.12; } },
  { id: 'gi_pesado', icon: '▣', name: 'Gi Pesado de la Tortuga', rarity: 2, text: '+18% de ataque físico y recibes un 5% menos de daño.', apply: (p) => { p.atkF += 0.18; p.armor = Math.min(0.6, p.armor + 0.05); } },
  { id: 'orbe_kami', icon: '◉', name: 'Orbe de Ki de Kami', rarity: 2, text: '+18% de ataque de ki y +15 de Ki máximo.', apply: (p) => { p.atkK += 0.18; p.maxKi += 15; } },
  { id: 'brazaletes_z', icon: '✊', name: 'Brazaletes del Guerrero Z', rarity: 3, text: '+28% de ataque físico y +8% de crítico.', apply: (p) => { p.atkF += 0.28; p.crit += 0.08; } },
  { id: 'sabiduria_kaioshin', icon: '✺', name: 'Sabiduría del Kaioshin', rarity: 3, text: '+28% de ataque de ki y gastas un 8% menos de Ki.', apply: (p) => { p.atkK += 0.28; kiSave(p, 0.92); } },
  { id: 'cinturon_campeon', icon: '✪', name: 'Cinturón del Campeón', rarity: 4, text: '+40% de ataque físico y +10% de velocidad.', apply: (p) => { p.atkF += 0.4; p.speedMul += 0.1; } },
  { id: 'corona_kaio', icon: '♛', name: 'Corona del Gran Kaio', rarity: 4, text: '+40% de ataque de ki y +2 Ki/s.', apply: (p) => { p.atkK += 0.4; p.kiRegen += 2; } },
  { id: 'ultra_instinto', icon: '☯', name: 'Ultra Instinto', rarity: 5, text: '+50% de ataque físico y de ki, y +10% de esquiva.', apply: (p) => { p.atkF += 0.5; p.atkK += 0.5; p.dodge = Math.min(0.5, p.dodge + 0.1); } },
  /* ---- Objetos de Ki: cargar, ahorrar y aguantar las transformaciones ---- */
  { id: 'pergamino_med', icon: '✺', name: 'Pergamino de Meditación', rarity: 0, text: 'Cargas Ki con [C] un 20% más rápido.', apply: (p) => { p.chargeMul += 0.2; } },
  { id: 'cinturon_kaio', icon: '◐', name: 'Cinturón del Rey Kaio', rarity: 1, text: 'Técnicas, rayos y transformaciones gastan un 8% menos de Ki.', apply: (p) => { kiSave(p, 0.92); } },
  { id: 'bebida_cc', icon: '⚡', name: 'Bebida Energética Capsule Corp.', rarity: 1, text: '+20 de Ki máximo y +0,3 de Ki por enemigo derrotado.', apply: (p) => { p.maxKi += 20; p.kiOnKill += 0.3; } },
  { id: 'cristal_namek', icon: '◆', name: 'Cristal de Namek', rarity: 2, text: '+30 de Ki máximo y cargas Ki un 40% más rápido.', apply: (p) => { p.maxKi += 30; p.chargeMul += 0.4; } },
  { id: 'brazal_ki', icon: '☯', name: 'Brazalete de Ki Contenido', rarity: 2, text: 'Transformado sigues regenerando un 35% de tu Ki por segundo.', apply: (p) => { kiForm(p, 0.35); } },
  { id: 'yardrat', icon: '✧', name: 'Técnica de Yardrat', rarity: 3, text: 'Cargas Ki un 60% más rápido y te curas el doble mientras cargas.', apply: (p) => { p.chargeMul += 0.6; p.chargeHeal += 1; } },
  { id: 'mente_serena', icon: '◑', name: 'Mente Serena', rarity: 3, text: 'Gastas un 15% menos de Ki y +2 Ki/s.', apply: (p) => { kiSave(p, 0.85); p.kiRegen += 2; } },
  { id: 'pendiente_kaioshin', icon: '◈', name: 'Pendiente del Kaioshin', rarity: 4, text: 'Gastas un 25% menos de Ki, +50 de Ki máximo y transformado regeneras la mitad de tu Ki.', apply: (p) => { kiSave(p, 0.75); p.maxKi += 50; kiForm(p, 0.5); } },
  { id: 'ki_divino', icon: '✹', name: 'Ki Divino', rarity: 5, text: 'Gastas un 35% menos de Ki, cargas el doble de rápido, +1 Ki por enemigo y transformado regeneras todo tu Ki.', apply: (p) => { kiSave(p, 0.65); p.chargeMul += 1; p.kiOnKill += 1; kiForm(p, 1); } },
  { id: 'agua_ultra', icon: '≈', name: 'Agua Ultra Divina', rarity: 5, text: '+40% de daño, +60 de vida máxima, +15% de velocidad y +3 de suerte.', apply: (p) => { p.statDmg += 0.4; hp(p, 60); p.speedMul += 0.15; p.luck += 3; } }
];
/* ---------- Mejoras temporales de la partida: santuarios, deseos y maldiciones ---------- */
const BUFFS = {
  b_dmg: { name: 'Entrenamiento de fuerza', icon: '⬆', text: '+20% de daño.', apply: (p) => { p.statDmg += 0.2; } },
  b_rate: { name: 'Reflejos acelerados', icon: '⏱', text: '+20% de cadencia de ataque.', apply: (p) => { p.rateMul += 0.2; } },
  b_hp: { name: 'Cuerpo de acero', icon: '♥', text: '+40 de vida máxima.', apply: (p) => hp(p, 40) },
  b_spd: { name: 'Pasos de viento', icon: '»', text: '+15% de velocidad.', apply: (p) => { p.speedMul += 0.15; } },
  b_crit: { name: 'Ojo del guerrero', icon: '✚', text: '+10% de crítico y +25% de daño crítico.', apply: (p) => { p.crit += 0.1; p.critDmg += 0.25; } },
  b_armor: { name: 'Piel de dragón', icon: '▣', text: 'Recibes un 8% menos de daño.', apply: (p) => { p.armor = Math.min(0.6, p.armor + 0.08); } },
  b_regen: { name: 'Meditación', icon: '❖', text: '+1,5 de vida por segundo.', apply: (p) => { p.regen += 1.5; } },
  b_ki: { name: 'Pozo de ki', icon: '⚡', text: '+30 de Ki máximo y +2 Ki/s.', apply: (p) => { p.maxKi += 30; p.kiRegen += 2; } },
  b_xp: { name: 'Mente despierta', icon: '☰', text: '+25% de experiencia.', apply: (p) => { p.xpMul += 0.25; } },
  b_luck: { name: 'Buena estrella', icon: '♣', text: '+6 de suerte.', apply: (p) => { p.luck += 6; } },
  w_hp: { name: 'Vitalidad eterna', icon: '♥', text: '+100 de vida máxima.', apply: (p) => hp(p, 100) },
  w_dmg: { name: 'Poder ilimitado', icon: '⬆', text: '+35% de daño.', apply: (p) => { p.statDmg += 0.35; } },
  c_dmg: { name: 'Maldición de debilidad', icon: '☠', text: '-10% de daño.', apply: (p) => { p.statDmg = Math.max(0.3, p.statDmg - 0.1); } },
  c_hp: { name: 'Maldición de fragilidad', icon: '☠', text: '-20 de vida máxima.', apply: (p) => { p.maxHp -= 20; } },
  c_spd: { name: 'Maldición de lentitud', icon: '☠', text: '-8% de velocidad.', apply: (p) => { p.speedMul = Math.max(0.4, p.speedMul - 0.08); } },
  c_rate: { name: 'Maldición de torpeza', icon: '☠', text: '-10% de cadencia.', apply: (p) => { p.rateMul = Math.max(0.4, p.rateMul - 0.1); } }
};
const SHRINE_BUFFS = ['b_dmg', 'b_rate', 'b_hp', 'b_spd', 'b_crit', 'b_armor', 'b_regen', 'b_ki', 'b_xp', 'b_luck'];
const CURSE_BUFFS = ['c_dmg', 'c_hp', 'c_spd', 'c_rate'];

/* ---------- Jefes: hoja "bosses" (misma disposición de columnas que los enemigos) ----------
   Cada jefe tiene 3 fases (100-66%, 66-33%, 33-0%); en cada una, su lista de técnicas (`pat`).
   Las técnicas son las de la serie; las genéricas (fan, ring, dash...) siguen disponibles.
   La vida no va aquí: la pone el mapa (`bossHp`), así cualquier jefe sirve en cualquier mapa. */
const BOSS_ANIM = {
  bosses: { walk: [0, 1, 2, 3], hit: 4, atk: 5, cast: 6, stun: 7 },
  black_boss: { walk: [1, 0], hit: 2, atk: 3, cast: 3, stun: 0 }          // hoja de 4 columnas: una fila por forma
};
const BOSSES = {
  freezer: { name: 'FREEZER', sheet: 'bosses', row: 0, scale: 3.2, r: 1.9, col: 0xff5ad0,
    forms: ['FORMA FINAL', 'PODER AL 100%', 'GOLDEN FREEZER'], tints: [0xffffff, 0xffd0f0, 0xffd84a],
    moves: 'Rayo mortal · Disco mortal · Supernova',
    pat: [['deathbeam', 'fan'], ['deathbeam', 'saucer', 'dash'], ['deathbeam', 'saucer', 'supernova', 'dash']] },
  cell: { name: 'CÉLULA PERFECTO', sheet: 'bosses', row: 1, scale: 3.3, r: 2.0, col: 0x60c8ff,
    forms: ['PERFECTO', 'SÚPER PERFECTO', 'AUTODESTRUCCIÓN'], tints: [0xffffff, 0xfff2a0, 0xffa890],
    moves: 'Kamehameha · Barrera perfecta · Célula Jr. · Autodestrucción',
    pat: [['kame', 'fan'], ['kame', 'barrier', 'celljr'], ['kame', 'barrier', 'celljr', 'selfdestruct']] },
  broly: { name: 'BROLY', sheet: 'bosses', row: 2, scale: 3.5, r: 2.2, col: 0x7dff5a,
    forms: ['RESTRINGIDO', 'FURIA SAIYAN', 'SUPER SAIYAN LEGENDARIO'], tints: [0xffffff, 0xffe9a0, 0xb8ff8a],
    moves: 'Cañón Eraser · Meteoro Gigante · Embestida · Grito legendario',
    pat: [['dash', 'eraser'], ['rush', 'eraser', 'meteor'], ['rush', 'eraser', 'meteor', 'roar']] },
  buu: { name: 'KID BUU', sheet: 'bosses', row: 3, scale: 3.0, r: 1.8, col: 0xff7ad0,
    forms: ['MAJIN', 'REGENERACIÓN', 'CAOS PURO'], tints: [0xffffff, 0xffd8ee, 0xff9ac8],
    moves: 'Kamehameha de Buu · Rayo de caramelo · Bomba planetaria · Grito · Regeneración',
    pat: [['majinkame', 'scream'], ['majinkame', 'candy', 'planetburst', 'regen'], ['majinkame', 'candy', 'planetburst', 'scream', 'regen']] },
  omega: { name: 'OMEGA SHENRON', sheet: 'bosses', row: 4, scale: 3.6, r: 2.2, col: 0x7a9cff,
    forms: ['DRAGÓN OSCURO', 'ESFERAS NEGATIVAS', 'ENERGÍA NEGATIVA'], tints: [0xffffff, 0xd0dcff, 0xa8b4ff],
    moves: 'Trueno del dragón · Muro de hielo · Estrella Nova · Bola de energía negativa',
    pat: [['thunder', 'icewall'], ['thunder', 'icewall', 'nova'], ['thunder', 'minusball', 'nova', 'icewall']] },
  jiren: { name: 'JIREN', sheet: 'bosses', row: 5, scale: 3.4, r: 2.0, col: 0xff4a4a,
    forms: ['CONTENIDO', 'PODER LIBERADO', 'MÁS ALLÁ DEL LÍMITE'], tints: [0xffffff, 0xffc8b8, 0xff8a7a],
    moves: 'Puños invisibles · Mirada · Power Impact · Teletransporte',
    pat: [['punches', 'glare'], ['punches', 'powerimpact', 'blink'], ['punches', 'powerimpact', 'blink', 'glare']] },
  beerus: { name: 'BEERUS', sheet: 'bosses', row: 6, scale: 3.2, r: 1.9, col: 0xb070ff,
    forms: ['DIOS DE LA DESTRUCCIÓN', 'DESPIERTO', 'SIN PIEDAD'], tints: [0xffffff, 0xe8d0ff, 0xd0a0ff],
    moves: 'Hakai · Esferas de energía · Esfera de destrucción · Teletransporte',
    pat: [['orbs', 'hakai'], ['orbs', 'hakai', 'blink'], ['orbs', 'hakai', 'sphere', 'blink']] },
  zamasu: { name: 'ZAMASU FUSIONADO', sheet: 'bosses', row: 7, scale: 3.3, r: 1.9, col: 0xff6ac8,
    forms: ['FUSIÓN', 'DIOS INMORTAL', 'CORRUPCIÓN'], tints: [0xffffff, 0xf0d8ff, 0xd8a0ff],
    moves: 'Muro de luz · Rayos de la absolución · Hojas del juicio · Ira divina',
    pat: [['wall', 'lightning'], ['wall', 'lightning', 'blades'], ['wall', 'lightning', 'blades', 'wrath', 'summon']] },
  /* Jefes nuevos (filas 8-15 de la hoja). `names`: nombre propio de una técnica compartida al anunciarla */
  cooler: { name: 'COOLER', sheet: 'bosses', row: 8, scale: 3.3, r: 1.9, col: 0xb07aff,
    forms: ['CUARTA FORMA', 'FURIA DEL HERMANO', 'PODER TOTAL'], tints: [0xffffff, 0xe8d0ff, 0xc8b0ff],
    moves: 'Rayo mortal · Esferas de energía · Embestida · Supernova',
    names: { orbs: 'ESFERAS DE COOLER', dash: 'EMBESTIDA' },
    pat: [['deathbeam', 'fan'], ['deathbeam', 'orbs', 'dash'], ['deathbeam', 'orbs', 'dash', 'supernova']] },
  janemba: { name: 'SUPER JANEMBA', sheet: 'bosses', row: 9, scale: 3.5, r: 2.0, col: 0xff4a5a,
    forms: ['DEMONIO', 'DIMENSIÓN ROTA', 'INFIERNO'], tints: [0xffffff, 0xffc8d0, 0xff9aa8],
    moves: 'Espada del infierno · Portales · Teletransporte · Lluvia del infierno',
    names: { blades: 'ESPADA DEL INFIERNO', blink: 'SALTO DIMENSIONAL', rain: 'LLUVIA DEL INFIERNO', spiral: 'PORTALES' },
    pat: [['blink', 'fan'], ['blink', 'blades', 'spiral'], ['blink', 'blades', 'spiral', 'rain', 'summon']] },
  superbuu: { name: 'SUPER BUU', sheet: 'bosses', row: 10, scale: 3.3, r: 1.9, col: 0xff7ad0,
    forms: ['SUPER BUU', 'ABSORCIÓN', 'BUU DEFINITIVO'], tints: [0xffffff, 0xffd8ee, 0xff9ac8],
    moves: 'Kamehameha de Buu · Rayo de caramelo · Grito · Regeneración · Bomba planetaria',
    pat: [['majinkame', 'candy'], ['majinkame', 'candy', 'regen', 'scream'], ['majinkame', 'candy', 'planetburst', 'regen', 'scream']] },
  hit: { name: 'HIT', sheet: 'bosses', row: 11, scale: 3.3, r: 1.9, col: 0x9a7aff,
    forms: ['ASESINO', 'SALTO TEMPORAL', 'PRISIÓN DEL TIEMPO'], tints: [0xffffff, 0xd8c8ff, 0xb8a0ff],
    moves: 'Puño invisible · Salto temporal · Prisión del tiempo · Golpe mortal',
    names: { punches: 'PUÑO INVISIBLE', blink: '¡SALTO TEMPORAL!', glare: 'PRISIÓN DEL TIEMPO', powerimpact: 'GOLPE MORTAL' },
    pat: [['punches', 'blink'], ['punches', 'blink', 'glare'], ['punches', 'blink', 'glare', 'powerimpact']] },
  toppo: { name: 'TOPPO', sheet: 'bosses', row: 12, scale: 3.7, r: 2.2, col: 0xff5a3a,
    forms: ['GUERRERO DE LA JUSTICIA', 'PODER DE DIOS', 'DIOS DE LA DESTRUCCIÓN'], tints: [0xffffff, 0xffd0c0, 0xd8a0ff],
    moves: 'Justice Flash · Embestida · Hakai · Esfera de destrucción',
    names: { fan: 'JUSTICE FLASH', orbs: 'JUSTICE FLASH', dash: 'EMBESTIDA DE LA JUSTICIA' },
    pat: [['fan', 'dash'], ['fan', 'dash', 'orbs', 'ring'], ['orbs', 'dash', 'hakai', 'sphere']] },
  a16: { name: 'ANDROIDE 16', sheet: 'bosses', row: 13, scale: 3.4, r: 2.0, col: 0x9aff4a,
    forms: ['ANDROIDE', 'MODO COMBATE', 'ÚLTIMO RECURSO'], tints: [0xffffff, 0xe0ffc0, 0xffb090],
    moves: 'Ráfagas · Puños cohete · Hell\'s Flash · Autodestrucción',
    names: { rain: 'PUÑOS COHETE', beam: '¡HELL\'S FLASH!', dash: 'EMBESTIDA' },
    pat: [['fan', 'dash'], ['fan', 'dash', 'rain'], ['fan', 'rain', 'beam', 'selfdestruct']] },
  raditz: { name: 'RADITZ', sheet: 'bosses', row: 14, scale: 3.1, r: 1.8, col: 0xd070ff,
    forms: ['GUERRERO SAIYAJIN', 'FURIA', 'ORGULLO SAIYAJIN'], tints: [0xffffff, 0xffe0d0, 0xffb0a0],
    moves: 'Saturday Crush · Double Sunday · Embestida',
    names: { fan: 'SATURDAY CRUSH', beam: '¡DOUBLE SUNDAY!', dash: 'EMBESTIDA' },
    pat: [['fan'], ['fan', 'dash', 'beam'], ['fan', 'dash', 'beam', 'ring']] },
  turles: { name: 'TURLES', sheet: 'bosses', row: 15, scale: 3.1, r: 1.8, col: 0xb06bff,
    forms: ['SAIYAJIN', 'FRUTO DEL ÁRBOL', 'PODER DEL ÁRBOL SAGRADO'], tints: [0xffffff, 0xffd8c0, 0xffa890],
    moves: 'Ráfaga oscura · Kill Driver · Come el fruto · Embestida',
    names: { fan: 'RÁFAGA OSCURA', meteor: 'KILL DRIVER', regen: '¡COME EL FRUTO DEL ÁRBOL!', dash: 'EMBESTIDA' },
    pat: [['fan', 'dash'], ['fan', 'dash', 'meteor'], ['fan', 'dash', 'meteor', 'regen', 'summon']] },
  // Goku Black: 4 fases = sus 4 formas (filas de la hoja "black"). Cada fase cambia de forma, de aura y de ataques.
  black: { name: 'GOKU BLACK', sheet: 'black_boss', rows: [0, 1, 2, 3], scale: 3.9, r: 2.2, col: 0xb26bff,
    forms: ['BASE', 'SUPER SAIYAN', 'SUPER SAIYAN ROSÉ', 'ROSÉ · PODER TOTAL'], tints: [0xb26bff, 0xffe36a, 0xff7ac8, 0xff4fb0], tintSprite: false,
    moves: 'Grieta de Black · Rayos · Embestida',
    pat: [['fan', 'ring', 'grieta'], ['fan', 'dash', 'grieta', 'ring'], ['fan', 'ring', 'grieta', 'rain', 'beam'], ['fan', 'dash', 'grieta', 'rain', 'beam', 'summon']] }
};

/* ---------- Mapas de la partida: Tierra -> Namekusei / Planeta Vegeta -> Cámara -> Dimensión fracturada ----------
   `bosses`: jefes posibles del mapa (sale uno al azar en cada partida). `bossHp`: su vida en este mapa.
   `basic`: personaje de la tropa básica del mapa (fila de la hoja de enemigos). */
const STAGES = [
  { id: 'earth', name: 'TIERRA · YERMO', theme: 0, R: 220, hp: 1, dmg: 1, spawn: 1, pois: true, night: true, basic: 'saibai', next: [1, 2, 6],
    desc: 'El yermo de siempre. Cae la noche cada pocos minutos.', bosses: ['cell', 'omega', 'raditz', 'turles', 'a16'], bossHp: 4500 },
  { id: 'namek', name: 'NAMEKUSEI', theme: 1, R: 220, hp: 1.8, dmg: 1.35, spawn: 1.2, pois: true, fx: 'lake', basic: 'soldado', next: [3, 5],
    desc: 'Tres soles: nunca anochece. El agua de los lagos te cura.', bosses: ['freezer', 'cooler'], bossHp: 20000 },
  { id: 'vegeta', name: 'PLANETA VEGETA', theme: 3, R: 200, hp: 1.9, dmg: 1.4, spawn: 1.25, pois: true, fx: 'gravity', lava: true, night: true, basic: 'soldado', next: [3, 5],
    desc: 'Gravedad x10: te mueves un 12% más lento, pero ganas un 30% más de experiencia.', bosses: ['broly', 'turles'], bossHp: 22000 },
  { id: 'room', name: 'CÁMARA DEL TIEMPO', theme: 4, R: 80, hp: 2.2, dmg: 1.5, spawn: 1.7, pois: false, fx: 'time', basic: 'saibai', next: [4], bossAt: 75, caps: 10, swarmAt: 300,
    desc: 'Un año en un día: experiencia x2 y la horda no da tregua. El jefe llega al minuto y cuarto.', bosses: ['buu', 'superbuu'], bossHp: 30000 },
  { id: 'rift', name: 'DIMENSIÓN FRACTURADA', theme: 2, R: 62, hp: 2.6, dmg: 1.7, spawn: 0, pois: false, final: true, fx: 'lowgrav', basic: 'soldado', next: [],
    desc: 'Gravedad baja: el dash llega más lejos. Solo queda el jefe final.', bosses: ['black', 'zamasu', 'jiren', 'beerus', 'hit', 'toppo', 'janemba'], bossHp: 70000 },
  // Mapas nuevos (5-7): el Torneo es la alternativa a la Cámara, el Infierno a Namek / Planeta Vegeta y la Isla Kame a la Tierra
  { id: 'torneo', name: 'TORNEO DEL PODER', theme: 5, R: 90, hp: 2.3, dmg: 1.55, spawn: 1.5, pois: false, fx: 'ring', basic: 'soldado', next: [4], bossAt: 90, caps: 12, swarmAt: 330,
    desc: 'Ring flotante en el vacío: fuera del borde pierdes vida. El jefe llega al minuto y medio.', bosses: ['toppo', 'jiren', 'hit'], bossHp: 32000 },
  { id: 'hell', name: 'INFIERNO', theme: 6, R: 200, hp: 1.9, dmg: 1.4, spawn: 1.25, pois: true, fx: 'hell', lava: true, basic: 'soldado', next: [3, 5],
    desc: 'Ríos de lava que queman y volcanes en erupción: +20% de experiencia.', bosses: ['janemba', 'cooler', 'turles'], bossHp: 22000 },
  { id: 'kame', name: 'ISLA KAME', theme: 7, R: 180, hp: 1, dmg: 1, spawn: 1, pois: true, night: true, fx: 'sea', basic: 'saibai', next: [1, 2, 6],
    desc: 'La isla del Maestro Roshi. En el mar te mueves mucho más lento.', bosses: ['raditz', 'turles', 'a16', 'cell'], bossHp: 4500 }
];
/** Elige el jefe de un mapa para esta partida y le pone la vida del mapa */
const pickBoss = (S) => Object.assign({ id: '' }, BOSSES[S.bosses[(Math.random() * S.bosses.length) | 0]], { hp: S.bossHp });
/* Defensas: qué tipo de ataque resiste cada enemigo y cada jefe (como la defensa y la defensa especial de Pokémon).
   Lo que resiste le hace RES_MUL; el otro tipo, WEAK_MUL. Sin `res`, los dos tipos le hacen lo normal */
const RES_MUL = 0.7, WEAK_MUL = 1.25;
const ENEMY_RES = { 2: 'fis', 4: 'ki', 6: 'fis', 7: 'ki', 8: 'ki', 9: 'fis', 10: 'ki', 11: 'fis', 12: 'ki', 13: 'fis', 16: 'fis', 17: 'ki' };
for (const t in ENEMY_RES) ENEMY_TYPES[t].res = ENEMY_RES[t];
const BOSS_RES = { freezer: 'ki', cell: 'ki', broly: 'fis', buu: 'fis', omega: 'ki', jiren: 'fis', beerus: 'ki', zamasu: 'fis', cooler: 'ki',
  janemba: 'fis', superbuu: 'fis', hit: 'fis', toppo: 'ki', a16: 'fis', raditz: '', turles: 'ki', black: 'ki' };
for (const k in BOSSES) BOSSES[k].res = BOSS_RES[k] || '';
const RES_TXT = { fis: 'RESISTE LOS GOLPES · DÉBIL AL KI', ki: 'RESISTE EL KI · DÉBIL A LOS GOLPES' };
for (const S of STAGES) S.boss = Object.assign({}, BOSSES[S.bosses[0]], { hp: S.bossHp });   // valor por defecto (menú, pruebas)
for (const k in BOSSES) BOSSES[k].id = k;
const ROUTE_LEN = 4;      // mapas por partida: Tierra o Isla Kame -> Namek, Planeta Vegeta o Infierno -> Cámara del Tiempo o Torneo -> Dimensión
const SWARM_TIME = 600;   // a los 10 minutos de cada mapa llega el enjambre final

const itemById = (id) => ITEMS.find((i) => i.id === id);
/** Un objeto está disponible en las cápsulas si es común/raro o si lo has desbloqueado en la Tienda */
const itemAvailable = (it) => it.rarity <= 1 || Save.d.items.includes(it.id);

/* ---------- Laboratorio: mejoras permanentes que se compran con Zeni ---------- */
const LAB = [
  { id: 'hp', name: 'Cámara de Gravedad', desc: '+8% de vida máxima', max: 10, cost: 300 },
  { id: 'dmg', name: 'Sala del Espíritu y el Tiempo', desc: '+4% de daño', max: 10, cost: 400 },
  { id: 'spd', name: 'Botas Pesadas', desc: '+3% de velocidad', max: 8, cost: 300 },
  { id: 'ki', name: 'Cápsula de Ki', desc: '+8% de regeneración de Ki', max: 8, cost: 250 },
  { id: 'mag', name: 'Radar del Dragón', desc: '+10% de alcance del imán', max: 8, cost: 250 },
  { id: 'crit', name: 'Instinto de Combate', desc: '+2% de probabilidad de crítico', max: 8, cost: 400 },
  { id: 'zeni', name: 'Contrato Capsule Corp.', desc: '+10% de Zeni ganados', max: 8, cost: 350 },
  { id: 'armor', name: 'Armadura de Capsule Corp.', desc: '+2% de armadura', max: 5, cost: 450 },
  { id: 'xp', name: 'Pergaminos de Kami', desc: '+5% de experiencia', max: 6, cost: 350 },
  { id: 'luck', name: 'Bendición de Shenron', desc: '+1 de suerte (más rareza en las cápsulas)', max: 6, cost: 400 },
  { id: 'tp', name: 'Shunkan Ido', desc: 'La Transmisión Instantánea se recarga un 8% antes', max: 5, cost: 350 },
  { id: 'kidmg', name: 'Entrenamiento de Ki', desc: '+5% de ataque de ki', max: 6, cost: 350 },
  { id: 'fdmg', name: 'Entrenamiento de Combate', desc: '+5% de ataque físico', max: 6, cost: 350 },
  { id: 'chg', name: 'Meditación en la Cascada', desc: 'Cargas Ki un 10% más rápido', max: 5, cost: 300 },
  { id: 'kisave', name: 'Respiración del Kaioshin', desc: 'Gastas un 4% menos de Ki', max: 5, cost: 450 },
  { id: 'gravx', name: 'Gravedad Extra', desc: '+10% de vida máxima', max: 1, cost: 1200 },
  { id: 'revive', name: 'Esfera de Reserva', desc: 'Revives una vez por partida con el 50% de vida', max: 1, cost: 3000 }
];
const labCost = (l, lvl) => Math.round(l.cost * (1 + lvl * 0.8));


/* ---------- Dificultades: sobrevive hasta el objetivo para ganar ---------- */
const DIFFS = [
  { id: 'easy', name: 'FÁCIL', hp: 0.75, dmg: 0.7, spawn: 0.8, coins: 1, reward: 250, color: '#5be07a' },
  { id: 'normal', name: 'NORMAL', hp: 1.15, dmg: 1.15, spawn: 1, coins: 1.5, reward: 600, color: '#ffd84a' },        // +15% de vida y de daño
  { id: 'hard', name: 'DIFÍCIL', hp: 1.6 * 1.25, dmg: 1.4 * 1.3, spawn: 1.3, coins: 2.5, reward: 1500, color: '#ff4d5e' }   // +25% de vida y +30% de daño sobre lo que ya tenía
];
const diffById = (id) => DIFFS.find((x) => x.id === id) || DIFFS[0];

/* ---------- Misiones: permanentes (progreso acumulado) y diarias (se renuevan cada día) ---------- */
const MISSIONS = [
  { id: 'k200', name: 'Cazador', desc: 'Derrota 200 enemigos', stat: 'kills', goal: 200, reward: 150 },
  { id: 'k2000', name: 'Exterminador', desc: 'Derrota 2.000 enemigos', stat: 'kills', goal: 2000, reward: 600 },
  { id: 'e10', name: 'Rompe-élites', desc: 'Derrota 10 enemigos élite', stat: 'elites', goal: 10, reward: 300 },
  { id: 'b3', name: 'Matajefes', desc: 'Derrota 3 jefes', stat: 'bosses', goal: 3, reward: 400 },
  { id: 'c20', name: 'Coleccionista', desc: 'Abre 20 cápsulas', stat: 'capsules', goal: 20, reward: 250 },
  { id: 'w1', name: 'Deseo concedido', desc: 'Reúne las 7 Esferas del Dragón', stat: 'wishes', goal: 1, reward: 500 },
  { id: 'v1', name: 'Primera victoria', desc: 'Completa un nivel', stat: 'wins', goal: 1, reward: 400 },
  { id: 'v5', name: 'Veterano', desc: 'Completa 5 niveles', stat: 'wins', goal: 5, reward: 1200 },
  { id: 'l20', name: 'Más allá de 9000', desc: 'Alcanza el nivel 20', stat: 'maxLevel', goal: 20, reward: 300, max: true },
  { id: 'l40', name: 'Ultra Instinto', desc: 'Alcanza el nivel 40', stat: 'maxLevel', goal: 40, reward: 900, max: true },
  { id: 'r10', name: 'Entrenamiento', desc: 'Juega 10 partidas', stat: 'runs', goal: 10, reward: 200 },
  { id: 'dk300', name: 'Calentamiento', desc: 'Derrota 300 enemigos hoy', stat: 'kills', goal: 300, reward: 120, daily: true },
  { id: 'de3', name: 'Cacería de élites', desc: 'Derrota 3 élites hoy', stat: 'elites', goal: 3, reward: 150, daily: true },
  { id: 'dc5', name: 'Día de compras', desc: 'Abre 5 cápsulas hoy', stat: 'capsules', goal: 5, reward: 100, daily: true },
  { id: 'dr3', name: 'Constancia', desc: 'Juega 3 partidas hoy', stat: 'runs', goal: 3, reward: 80, daily: true },
  { id: 'db1', name: 'Jefe del día', desc: 'Derrota 1 jefe hoy', stat: 'bosses', goal: 1, reward: 150, daily: true },
  { id: 'dt600', name: 'Resistencia', desc: 'Sobrevive 10 minutos en total hoy', stat: 'time', goal: 600, reward: 120, daily: true }
];
const missionById = (id) => MISSIONS.find((m) => m.id === id);

/* ---------- Logros: se desbloquean solos al cumplirse y pagan monedas al momento ---------- */
const ACHIEVEMENTS = [
  { id: 'a_k500', icon: '☠', name: 'Primera sangre', desc: 'Derrota 500 enemigos', stat: 'kills', goal: 500, reward: 200 },
  { id: 'a_k5k', icon: '☠', name: 'Azote de la horda', desc: 'Derrota 5.000 enemigos', stat: 'kills', goal: 5000, reward: 800 },
  { id: 'a_k25k', icon: '☠', name: 'Leyenda viviente', desc: 'Derrota 25.000 enemigos', stat: 'kills', goal: 25000, reward: 2500 },
  { id: 'a_b1', icon: '♛', name: 'Cazador de tiranos', desc: 'Derrota a un jefe', stat: 'bosses', goal: 1, reward: 250 },
  { id: 'a_b10', icon: '♛', name: 'Terror de los villanos', desc: 'Derrota 10 jefes', stat: 'bosses', goal: 10, reward: 1200 },
  { id: 'a_s2', icon: '◆', name: 'Más allá de la grieta', desc: 'Llega al segundo mapa', stat: 'maxStage', goal: 2, reward: 300, max: true },
  { id: 'a_s3', icon: '◆', name: 'Dimensión fracturada', desc: 'Llega al mapa final', stat: 'maxStage', goal: 4, reward: 800, max: true },
  { id: 'a_w1', icon: '★', name: 'Salvador del universo', desc: 'Gana una partida', stat: 'wins', goal: 1, reward: 600 },
  { id: 'a_w5', icon: '★', name: 'Guerrero Z', desc: 'Gana 5 partidas', stat: 'wins', goal: 5, reward: 2000 },
  { id: 'a_t1', icon: '⚡', name: '¡Transformación!', desc: 'Transfórmate por primera vez', stat: 'transforms', goal: 1, reward: 150 },
  { id: 'a_t25', icon: '⚡', name: 'Rompiendo límites', desc: 'Transfórmate 25 veces', stat: 'transforms', goal: 25, reward: 700 },
  { id: 'a_c50', icon: '✖', name: 'Combo x50', desc: 'Encadena un combo de 50', stat: 'maxCombo', goal: 50, reward: 200, max: true },
  { id: 'a_c250', icon: '✖', name: 'Combo infinito', desc: 'Encadena un combo de 250', stat: 'maxCombo', goal: 250, reward: 900, max: true },
  { id: 'a_h1k', icon: '✷', name: 'Golpe crítico', desc: 'Haz 1.000 de daño de un solo golpe', stat: 'bestHit', goal: 1000, reward: 300, max: true },
  { id: 'a_h10k', icon: '✷', name: 'Poder de un dios', desc: 'Haz 10.000 de daño de un solo golpe', stat: 'bestHit', goal: 10000, reward: 1200, max: true },
  { id: 'a_f1', icon: '⚭', name: 'Fusión', desc: 'Fusiona dos técnicas', stat: 'fusions', goal: 1, reward: 400 },
  { id: 'a_f10', icon: '⚭', name: 'Maestro de las fusiones', desc: 'Fusiona 10 técnicas', stat: 'fusions', goal: 10, reward: 1500 },
  { id: 'a_cap50', icon: '⬮', name: 'Capsule Corp', desc: 'Abre 50 cápsulas', stat: 'capsules', goal: 50, reward: 500 },
  { id: 'a_cur10', icon: '☠', name: 'Gafe', desc: 'Abre 10 cápsulas malditas', stat: 'curses', goal: 10, reward: 400 },
  { id: 'a_room10', icon: '⧗', name: 'Un año en un día', desc: 'Completa 10 Habitaciones del Tiempo', stat: 'rooms', goal: 10, reward: 500 },
  { id: 'a_tem10', icon: '▲', name: 'Sin miedo', desc: 'Acepta 10 desafíos del templo', stat: 'temples', goal: 10, reward: 500 },
  { id: 'a_ev10', icon: '!', name: 'Imprevistos', desc: 'Vive 10 eventos aleatorios', stat: 'events', goal: 10, reward: 400 },
  { id: 'a_al5', icon: '✚', name: 'Amigos para siempre', desc: 'Lucha junto a 5 compañeros', stat: 'allies', goal: 5, reward: 400 },
  { id: 'a_riv5', icon: '⚔', name: 'Rivalidad', desc: 'Derrota a 5 rivales', stat: 'rivals', goal: 5, reward: 600 },
  { id: 'a_wish3', icon: '🐉', name: 'Amigo de Shenron', desc: 'Pide 3 deseos', stat: 'wishes', goal: 3, reward: 900 },
  { id: 'a_tp50', icon: '⇝', name: 'Shunkan Ido', desc: 'Usa 50 veces la Transmisión Instantánea', stat: 'tps', goal: 50, reward: 400 },
  { id: 'a_day1', icon: '☀', name: 'Reto del día', desc: 'Termina un desafío diario', stat: 'dailies', goal: 1, reward: 300 },
  { id: 'a_day7', icon: '☀', name: 'Constancia de guerrero', desc: 'Termina 7 desafíos diarios', stat: 'dailies', goal: 7, reward: 1500 },
  { id: 'a_bp', icon: '♛', name: 'Sin piedad', desc: 'Lleva a 20 jefes a su última fase', stat: 'phase3', goal: 20, reward: 700 }
];
const todayStr = () => { const t = new Date(); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };

/* ---------- Guardado local ---------- */
const Save = {
  d: { zeni: 0, unlocked: ['goku'], sel: 'goku', up: {}, best: {}, items: [], techs: [], stats: {}, claimed: {}, clears: {}, diff: 'easy', daily: null, login: { last: '', streak: 0 }, ach: {}, vol: { mus: 0.5, sfx: 0.75 },
    opt: { quality: 'auto', flash: false, shake: 1 }, rank: [], day: null, dayHist: [], story: {} },
  load() {
    try { const s = JSON.parse(localStorage.getItem('dbus_save_v1')); if (s) Object.assign(this.d, s); } catch (e) { /* sin guardado */ }
    this.d.opt = Object.assign({ quality: 'auto', flash: false, shake: 1 }, this.d.opt || {});
    if (!Array.isArray(this.d.rank)) this.d.rank = [];
    if (!Array.isArray(this.d.dayHist)) this.d.dayHist = [];
    if (!this.d.story || typeof this.d.story !== 'object') this.d.story = {};
    for (const c of ['krilin', 'trunks']) if (this.d.sel === c && !this.d.unlocked.includes(c)) this.d.sel = 'goku';
  },
  /** Copia de seguridad: el guardado completo en texto (base64) para llevarlo a otro navegador */
  exportStr() { return btoa(unescape(encodeURIComponent(JSON.stringify(this.d)))); },
  /** Restaura una copia. Devuelve true si el texto era un guardado válido */
  importStr(str) {
    try {
      const raw = str.trim(), json = raw[0] === '{' ? raw : decodeURIComponent(escape(atob(raw))), o = JSON.parse(json);
      if (!o || typeof o.zeni !== 'number' || !Array.isArray(o.unlocked)) return false;
      this.d = Object.assign(JSON.parse(JSON.stringify(SAVE_DEFAULT)), o);
      this.write(); this.load(); this.checkDaily();
      return true;
    } catch (e) { return false; }
  },
  write() { try { localStorage.setItem('dbus_save_v1', JSON.stringify(this.d)); } catch (e) { /* almacenamiento no disponible */ } },
  lab(id) { return this.d.up[id] || 0; },
  /** Renueva las misiones diarias si cambió el día (3 al azar, fijadas por la fecha) */
  checkDaily() {
    const t = todayStr();
    if (this.d.daily && this.d.daily.date === t) return;
    const pool = MISSIONS.filter((m) => m.daily), rng = seeded(+t.replace(/-/g, '')), ids = [];
    while (ids.length < 3) { const m = pool[(rng() * pool.length) | 0]; if (!ids.includes(m.id)) ids.push(m.id); }
    this.d.daily = { date: t, ids, prog: {}, claimed: {} };
  },
  /** Racha de inicio de sesión: devuelve la recompensa pendiente o null si ya se cobró hoy */
  checkLogin() {
    const t = todayStr(), l = this.d.login;
    if (l.last === t) return null;
    const y = new Date(); y.setDate(y.getDate() - 1);
    const ys = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
    const streak = l.last === ys ? l.streak + 1 : 1;
    return { streak, reward: 100 + 50 * Math.min(streak - 1, 6) };
  },
  progress(m) { return m.daily ? (this.d.daily.prog[m.stat] || 0) : (this.d.stats[m.stat] || 0); },
  isClaimed(m) { return m.daily ? !!this.d.daily.claimed[m.id] : !!this.d.claimed[m.id]; }
};

const SAVE_DEFAULT = JSON.parse(JSON.stringify(Save.d));

/* ---------- Rasgos de las transformaciones: cada forma tiene su ventaja (✚) y, casi siempre, su precio (✖) ----------
   m = cambios de estadísticas mientras dure la forma · t = efectos especiales:
   kiDrain (Ki/s; mientras dure la forma el Ki no se regenera solo y si llega a 0 pierdes la forma) · hpDrain (% de vida/s, no baja del 15%) · lowHp (daño extra con menos del 50% de vida)
   aura (daño/s a tu alrededor) · bolt (rayos a enemigos cercanos) · dodgeKi (esquivas todo a cambio de Ki)
   ego (cada golpe recibido sube el daño hasta este máximo) */
const TRAITS = {
  goku: [null,
    { name: 'Cuerpo al límite', good: '+25% de cadencia', bad: 'Pierdes un 1% de vida por segundo', m: { rate: 0.25 }, t: { hpDrain: 0.01 } },
    { name: 'Ira Saiyajin', good: '+10% de crítico y +30% de daño con poca vida', bad: '-15% de regeneración de Ki', m: { crit: 0.1, kiRegen: -0.15 }, t: { lowHp: 0.3 } },
    { name: 'Electricidad', good: 'Rayos golpean a los enemigos cercanos', bad: 'Recibes un 10% más de daño', m: { armor: -0.1 }, t: { bolt: 30 } },
    { name: 'Poder descomunal', good: '+20% de daño y tu aura quema a los enemigos', bad: 'Gasta 4 de Ki/s sin regenerarlo (carga con C) y -10% de velocidad', m: { dmg: 0.2, spd: -0.1 }, t: { aura: 30, kiDrain: 4 } },
    { name: 'Instinto primitivo', good: '+15% de daño y +10% de velocidad', bad: '-20% de regeneración de Ki', m: { dmg: 0.15, spd: 0.1, kiRegen: -0.2 } },
    { name: 'Ki divino', good: '+2,5 de vida/s y +8% de armadura', bad: '-30% de alcance del imán', m: { regen: 2.5, armor: 0.08, magnet: -0.3 } },
    { name: 'Control perfecto', good: '+30% de daño crítico y el dash cuesta la mitad', bad: 'Gasta 3 de Ki/s sin regenerarlo (carga con C)', m: { critDmg: 0.3, dashCost: -0.5 }, t: { kiDrain: 3 } },
    { name: 'Kaio-ken al límite', good: '+25% de daño y +15% de cadencia', bad: 'Pierdes un 1,5% de vida por segundo', m: { dmg: 0.25, rate: 0.15 }, t: { hpDrain: 0.015 } },
    { name: 'Instinto despertando', good: '+20% de esquiva y +15% de velocidad', bad: '-20% de regeneración de Ki', m: { dodge: 0.2, spd: 0.15, kiRegen: -0.2 } },
    { name: 'Esquiva automática', good: 'Esquivas TODOS los ataques y contraatacas', bad: 'Cada esquiva cuesta 12 de Ki · -30% de regeneración de Ki', m: { kiRegen: -0.3 }, t: { dodgeKi: 12 } }
  ],
  vegeta: [null,
    { name: 'Orgullo herido', good: '+8% de armadura y +10% de crítico', bad: '-10% de experiencia', m: { armor: 0.08, crit: 0.1, xp: -0.1 } },
    { name: 'Super Vegeta', good: '+30% de daño', bad: '-15% de velocidad', m: { dmg: 0.3, spd: -0.15 } },
    { name: 'Explosión de orgullo', good: '+20% de cadencia y +20% de daño crítico', bad: 'Recibes un 15% más de daño', m: { rate: 0.2, critDmg: 0.2, armor: -0.15 } },
    { name: 'Bestia dorada', good: '+18% de daño y +12% de crítico', bad: '-15% de regeneración de Ki', m: { dmg: 0.18, crit: 0.12, kiRegen: -0.15 } },
    { name: 'Ki divino del príncipe', good: '+2 de vida/s y +8% de armadura', bad: '-25% de alcance del imán', m: { regen: 2, armor: 0.08, magnet: -0.25 } },
    { name: 'Ki controlado', good: '+25% de daño crítico y +10% de cadencia', bad: 'Gasta 2 de Ki/s sin regenerarlo (carga con C)', m: { critDmg: 0.25, rate: 0.1 }, t: { kiDrain: 2 } },
    { name: 'Evolución', good: '+15% de daño y +10% de crítico', bad: '-10% de vida máxima', m: { dmg: 0.15, crit: 0.1, maxHp: -0.1 } }
  ],
  black: [null,
    { name: 'Justicia oscura', good: 'Curas 1 de vida por cada enemigo', bad: '-10% de vida máxima', m: { killHeal: 1, maxHp: -0.1 } },
    { name: 'Belleza divina', good: '+20% de esquiva', bad: 'Gasta 2 de Ki/s sin regenerarlo (carga con C)', m: { dodge: 0.2 }, t: { kiDrain: 2 } },
    { name: 'Inmortalidad imperfecta', good: '+40% de daño crítico y tu aura quema', bad: 'Pierdes un 0,5% de vida por segundo', m: { critDmg: 0.4 }, t: { aura: 40, hpDrain: 0.005 } }
  ],
  piccolo: [null,
    { name: 'Guerrero de Namek', good: '+2 de vida/s', bad: '-10% de velocidad', m: { regen: 2, spd: -0.1 } },
    { name: 'Sabiduría de Kami', good: '+50% de imán y +15% de experiencia', bad: '-20% de regeneración de Ki', m: { magnet: 0.5, xp: 0.15, kiRegen: -0.2 } },
    { name: 'Gigante naranja', good: '+40% de vida máxima y +15% de armadura', bad: '-15% de velocidad y dash más lento', m: { maxHp: 0.4, armor: 0.15, spd: -0.15, dashCd: 0.3 } }
  ],
  gohan: [null,
    { name: 'Despertar', good: '+8% de crítico y +25% de daño con poca vida', bad: '-15% de regeneración de Ki', m: { crit: 0.08, kiRegen: -0.15 }, t: { lowHp: 0.25 } },
    { name: 'Furia contenida', good: '+25% de cadencia y rayos a tu alrededor', bad: 'Recibes un 10% más de daño', m: { rate: 0.25, armor: -0.1 }, t: { bolt: 26 } },
    { name: 'Potencial liberado', good: '+10% de crítico y +30% de experiencia', bad: 'Sin desventajas: es su poder definitivo', m: { crit: 0.1, xp: 0.3 } }
  ],
  freezer: [null,
    { name: 'Forma monstruosa', good: '+15% de crítico', bad: '-15% de regeneración de Ki', m: { crit: 0.15, kiRegen: -0.15 } },
    { name: 'Cuerpo perfecto', good: '+20% de velocidad y +10% de esquiva', bad: '-10% de vida máxima', m: { spd: 0.2, dodge: 0.1, maxHp: -0.1 } },
    { name: 'Poder forzado', good: '+20% de daño', bad: 'Se agota: -40% de regeneración de Ki', m: { dmg: 0.2, kiRegen: -0.4 } },
    { name: 'Oro puro', good: '+30% de Zeni y +15% de velocidad', bad: 'Gasta 5 de Ki/s sin regenerarlo: aguanta poco', m: { zeni: 0.3, spd: 0.15 }, t: { kiDrain: 5 } }
  ],
  krilin: [null,
    { name: 'Potencial de Guru', good: '+10% de esquiva y +10% de crítico', bad: '-10% de vida máxima', m: { dodge: 0.1, crit: 0.1, maxHp: -0.1 } },
    { name: 'Guerrero valiente', good: '+20% de cadencia y dash un 30% más rápido', bad: 'Recibes un 10% más de daño', m: { rate: 0.2, dashCd: -0.3, armor: -0.1 } },
    { name: 'El humano más fuerte', good: '+25% de daño y curas 0,5 por enemigo', bad: 'Gasta 2 de Ki/s sin regenerarlo (carga con C)', m: { dmg: 0.25, killHeal: 0.5 }, t: { kiDrain: 2 } }
  ],
  trunks: [null,
    { name: 'Sangre Saiyajin', good: '+8% de crítico', bad: '-10% de regeneración de Ki', m: { crit: 0.08, kiRegen: -0.1 } },
    { name: 'Furia del futuro', good: '+20% de cadencia y rayos a tu alrededor', bad: 'Pierdes un 0,6% de vida por segundo', m: { rate: 0.2 }, t: { bolt: 34, hpDrain: 0.006 } }
  ],
  cell: [null,
    { name: 'Células de Saiyajin', good: '+10% de daño y +1 de vida/s', bad: '-10% de regeneración de Ki', m: { dmg: 0.1, regen: 1, kiRegen: -0.1 } },
    { name: 'Perfección absoluta', good: '+15% de crítico, +30% de daño crítico y rayos a tu alrededor', bad: 'Pierdes un 0,5% de vida por segundo', m: { crit: 0.15, critDmg: 0.3 }, t: { bolt: 36, hpDrain: 0.005 } },
    { name: 'Regeneración Zenkai', good: '+20% de cadencia y +2 de vida/s', bad: 'Recibes un 10% más de daño', m: { rate: 0.2, regen: 2, armor: -0.1 } }
  ],
  bardock: [null,
    { name: 'Ira de clase baja', good: '+12% de crítico y +25% de daño con poca vida', bad: '-15% de regeneración de Ki', m: { crit: 0.12, kiRegen: -0.15 }, t: { lowHp: 0.25 } },
    { name: 'Visión del futuro', good: '+20% de esquiva y rayos a tu alrededor', bad: 'Pierdes un 0,6% de vida por segundo', m: { dodge: 0.2 }, t: { bolt: 30, hpDrain: 0.006 } }
  ],
  vegito: [null,
    { name: 'Super Vegetto', good: '+15% de daño y +10% de velocidad', bad: '-15% de regeneración de Ki', m: { dmg: 0.15, spd: 0.1, kiRegen: -0.15 } },
    { name: 'Electricidad fusionada', good: '+15% de cadencia y rayos a tu alrededor', bad: 'Recibes un 10% más de daño', m: { rate: 0.15, armor: -0.1 }, t: { bolt: 32 } },
    { name: 'Fusión divina', good: '+30% de daño crítico y +2 de vida/s', bad: 'Gasta 3 de Ki/s sin regenerarlo (carga con C)', m: { critDmg: 0.3, regen: 2 }, t: { kiDrain: 3 } }
  ],
  gogeta: [null,
    { name: 'Fusión perfecta', good: '+20% de daño y +10% de velocidad', bad: '-15% de regeneración de Ki', m: { dmg: 0.2, spd: 0.1, kiRegen: -0.15 } },
    { name: 'Al límite', good: '+30% de daño crítico y rayos a tu alrededor', bad: 'Pierdes un 0,6% de vida por segundo', m: { critDmg: 0.3 }, t: { bolt: 34, hpDrain: 0.006 } },
    { name: 'Ki divino fusionado', good: '+20% de cadencia y +2 de vida/s', bad: 'Gasta 3 de Ki/s sin regenerarlo (carga con C)', m: { rate: 0.2, regen: 2 }, t: { kiDrain: 3 } }
  ],
  broly: [null,
    { name: 'Furia creciente', good: 'Cada golpe recibido sube tu daño (hasta +30%)', bad: '-10% de velocidad', m: { spd: -0.1 }, t: { ego: 0.3 } },
    { name: 'Poder sin control', good: '+30% de daño y tu aura quema a los enemigos', bad: 'Gasta 4 de Ki/s sin regenerarlo y recibes un 10% más de daño', m: { dmg: 0.3, armor: -0.1 }, t: { aura: 36, kiDrain: 4 } },
    { name: 'Bestia primigenia', good: '+40% de vida máxima y +15% de armadura', bad: '-15% de velocidad', m: { maxHp: 0.4, armor: 0.15, spd: -0.15 } }
  ]
};
/* Las desventajas de las transformaciones pesan un 50% más (las mejoras de la partida las tapaban): se endurecen
   los valores negativos de cada rasgo y los números del texto «✖», con el mismo redondeo, para que siempre coincidan */
const TRAIT_HARD = 1.5;
(function hardenTraits() {
  const r = (v) => { const x = v * TRAIT_HARD; return x < 3 ? Math.round(x * 10) / 10 : Math.round(x); };
  const BAD_IF_UP = { dashCd: 1, dashCost: 1 };                // en estos, subir es lo malo
  for (const id in TRAITS) for (const T of TRAITS[id]) {
    if (!T) continue;
    const m = T.m || {}, t = T.t || {};
    for (const k in m) { if (BAD_IF_UP[k] ? m[k] > 0 : m[k] < 0) m[k] = Math.sign(m[k]) * r(Math.abs(m[k]) * 100) / 100; }
    if (t.kiDrain) t.kiDrain = r(t.kiDrain);
    if (t.dodgeKi) t.dodgeKi = r(t.dodgeKi);
    if (t.hpDrain) t.hpDrain = r(t.hpDrain * 100) / 100;
    T.bad = T.bad.replace(/\d+(?:,\d+)?/g, (s) => String(r(parseFloat(s.replace(',', '.')))).replace('.', ','));
  }
})();
/** Fusiones que puede hacer un personaje (las suyas y las de cualquiera) */
const fusionsFor = (chId) => Object.keys(WEAPONS).filter((id) => WEAPONS[id].fusion && (!WEAPONS[id].unique || WEAPONS[id].unique === chId));
/** Una técnica de la tienda solo vale si la has comprado (en el entrenamiento, todas) */
const techOwned = (id, practice) => !WEAPONS[id].shop || practice || (Save.d.techs || []).includes(id);
const traitOf = (ch, idx) => (TRAITS[ch.id] || [])[idx] || null;

/* ---------- Efectos visuales de cada forma (mismo índice que forms) ----------
   a: aura (auraSS1/auraGold se tiñen del color de la forma; auraSS2/auraSS3 son doradas y llevan sus propios rayos)
   bolt: color de los rayitos de electricidad alrededor del personaje · spark: chispas que suben (sparkY dorada,
   sparkG verde, lightB azul/blanca) · burst: estallido al transformarse (sprites de las hojas nuevas) */
const FORM_FX = {
  goku: [null, { spark: 'sparkY', burst: 'tfRose' }, { a: 'auraGold', spark: 'sparkY', burst: 'tfGold2' },
    { a: 'auraSS2', bolt: 0xbfe8ff, spark: 'sparkY', burst: 'tfGold' }, { a: 'auraSS3', bolt: 0xfff27a, spark: 'sparkY', burst: 'tfGold' },
    { bolt: 0xff6a4a, burst: 'tfRose' }, { spark: 'sparkY', burst: 'tfRose' }, { spark: 'lightB' }, { bolt: 0xff6a6a, spark: 'lightB', burst: 'tfRose' }, { spark: 'lightB' }, { spark: 'lightB', bolt: 0xdff4ff }],
  vegeta: [null, { a: 'auraGold', spark: 'sparkY', burst: 'tfGold2' }, { a: 'auraGold', bolt: 0xfff27a, spark: 'sparkY', burst: 'tfGold' },
    { a: 'auraSS2', bolt: 0xbfe8ff, spark: 'sparkY', burst: 'tfGold' }, { bolt: 0xff6a4a, burst: 'tfRose' }, { spark: 'sparkY', burst: 'tfRose' },
    { spark: 'lightB' }, { bolt: 0x6a9aff, spark: 'lightB' }],
  black: [null, { a: 'auraGold', spark: 'sparkY', burst: 'tfGold2' }, { burst: 'tfPink' }, { bolt: 0xff8ad0, burst: 'tfBlades' }],
  piccolo: [null, { spark: 'sparkG' }, { spark: 'sparkG', bolt: 0xc8ff9a }, { bolt: 0xffb060, burst: 'tfGold2' }],
  gohan: [null, { a: 'auraGold', spark: 'sparkY', burst: 'tfGold2' }, { a: 'auraSS2', bolt: 0xbfe8ff, burst: 'tfGold' }, { spark: 'lightB', burst: 'tfStar' }],
  freezer: [null, { bolt: 0xc89aff, burst: 'tfDark' }, { burst: 'tfPink' }, { bolt: 0xff9ae0, burst: 'tfPink' }, { a: 'auraGold', spark: 'sparkY', burst: 'tfGold2' }],
  krilin: [null, { spark: 'sparkY' }, { spark: 'sparkY', burst: 'tfGold2' }, { bolt: 0xffffff, burst: 'tfGold' }],
  trunks: [null, { a: 'auraGold', spark: 'sparkY', burst: 'tfGold2' }, { bolt: 0xbfeaff, spark: 'lightB', burst: 'tfStar' }],
  cell: [null, { spark: 'sparkG', burst: 'tfGold2' }, { a: 'auraGold', spark: 'sparkY', burst: 'tfGold' }, { bolt: 0xbfeeff, spark: 'lightB' }],
  bardock: [null, { a: 'auraGold', spark: 'sparkY', burst: 'tfGold2' }, { bolt: 0xff6a4a, burst: 'tfRose' }],
  vegito: [null, { a: 'auraGold', spark: 'sparkY', burst: 'tfGold2' }, { a: 'auraSS2', bolt: 0xbfe8ff, spark: 'sparkY', burst: 'tfGold' }, { spark: 'lightB', bolt: 0x8ad8ff, burst: 'tfStar' }],
  gogeta: [null, { a: 'auraGold', spark: 'sparkY', burst: 'tfGold2' }, { a: 'auraSS2', bolt: 0xbfe8ff, spark: 'sparkY', burst: 'tfGold' }, { spark: 'lightB', bolt: 0x8ad8ff, burst: 'tfStar' }],
  broly: [null, { a: 'auraGold', spark: 'sparkY', burst: 'tfGold2' }, { a: 'auraGold', bolt: 0x9aff6a, spark: 'sparkG', burst: 'tfGold' }, { bolt: 0xff6a4a, burst: 'tfRose' }]
};
const formFx = (ch, idx) => (FORM_FX[ch.id] || [])[idx] || null;

/* ---------- Pose de CARGAR KI de cada forma (hojas <personaje>_chg, tools/make_zip.py) ----------
   [primer fotograma, nº de fotogramas] de la hoja de carga (mismo índice que forms; la animación va en bucle);
   null = sin pose propia (se usa la de quieto con el aura del juego). La pose ya trae el aura de la forma */
const SAME4 = n => [[0, n], [0, n], [0, n], [0, n]];
const FORM_CHG = {
  goku: [[0, 3], [3, 3], [6, 3], [9, 3], [12, 3], [15, 3], [18, 2], [20, 3], [23, 2], [25, 2], [27, 2]],
  vegeta: [[0, 3], [3, 3], [6, 3], [9, 3], [12, 3], [15, 2], [17, 3], [20, 2]],
  black: [[0, 2], [2, 3], [5, 2], [7, 1]],
  gohan: [[0, 3], [3, 3], [6, 3], [9, 2]],
  freezer: [[0, 3], [3, 2], [5, 3], [8, 3], [11, 2]],
  trunks: [[0, 2], [2, 2], [4, 1]],
  cell: [[0, 3], [3, 3], [6, 3], [6, 3]],
  piccolo: [[0, 2], [0, 2], [0, 2], [0, 2]],
  vegito: [[0, 3], [3, 3], [6, 3], [9, 3]],
  broly: [[0, 3], [3, 2], [5, 3], [8, 3]],
  bardock: [[0, 3], [3, 2], [5, 3]],
  gogeta: [[0, 3], [3, 3], [6, 3], [9, 3]],
  // Zamasu fusionado: una tira de 3 fotogramas por forma
  zamasuf: [[0, 3], [3, 3], [6, 3]],
  // Personajes con una sola hoja: sus 4 formas usan la misma pose de cargar
  krilin: SAME4(3),
  kefla: SAME4(3),
  gotenks: SAME4(3),
  trunksarm: SAME4(3),
  caulifla: SAME4(3),
  kale: SAME4(3),
  kyabe: SAME4(2),
  toppo: SAME4(3),
  janemba: SAME4(3),
  jiren: SAME4(3),
  turles: SAME4(3),
  saibaman: SAME4(3),
  bills: SAME4(3),
  cooler: SAME4(3),
  hitto: SAME4(3),
  raditz: SAME4(3),
  andro16: SAME4(3),
  andro17: SAME4(3),
  andro18: SAME4(3),
  majin: SAME4(3),
  superbuu: SAME4(3),
  zamasu: SAME4(2)
};
const formChg = (ch, idx) => (FORM_CHG[ch.id] || [])[idx] || null;

/* ---------- Créditos: autores de los sprites del pack «Dragon Ball Sagas» (archivo «Hecho por …» de cada carpeta) ---------- */
const SPRITE_CREDITS = [
  { author: "qsab101", what: ["Broly Segunda Forma", "Cooler", "Gogeta", "Janemba", "Goku Black", "Goku Black Rose", "Goku Instinto Superior", "Goku Instinto Superior Completo", "Goku SSJ 2", "Goku kaioken", "Golden Freeza", "Kuririn", "Mirai Trunks", "Vegeta SSJ 4", "Vegeta Ssj Grade", "Gotenks", "Kefla"] },
  { author: "LukasAhl1", what: ["Bardock", "Bardock Ssj", "Freeza Forma Final", "Goku God", "Goku SSJ 1", "Goku SSJ 3", "Majin Vegeta", "Piccolo", "Super Mirai Trunks", "Teen Gohan SSJ", "Teen Gohan SSJ2", "cell Perfeito", "Androide 18"] },
  { author: "MV95", what: ["Zamasu fusionado", "Zamasu fusión divina", "Hitto", "Raditz", "Vegito", "Vegito SSJ Blue", "Cell Imperfeito", "Freeza Full Power", "Freeza Primeira Forma", "Goku Blue Kaioken Whis Gi", "Vegeta Blue", "Bills", "Kyabe SSJ"] },
  { author: "thekrillmaster", what: ["Broly Full Power", "Toppo", "Turles", "Cell Semi Perfeito", "Goku Black SSJ", "Saibaman", "Majin Buu", "Zamasu", "Zamasu medio corrompido"] },
  { author: "PeculiarDoc", what: ["Gohan Adulto", "Goku Blue"] },
  { author: "gogeta68", what: ["Vegeta Saga Buu SSJ"] },
  { author: "JuanGomezgg", what: ["Goku SSJ 4"] },
  { author: "LICHT", what: ["Androide 17"] },
  { author: "MajinVegeta95", what: ["Freeza Terceira Forma"] },
  { author: "YoloKing777", what: ["Androide 16"] },
  { author: "whytemonster", what: ["Super Buu"] },
  { author: "Manikdx2000", what: ["Vegeta Sayajin Saga", "Vegito Ssj1"] },
  { author: "Mangal666", what: ["Vegito Ssj2", "Trunks Armadura"] },
  { author: "agustin902", what: ["Broly Ssj4"] },
  { author: "SonicGoku2", what: ["Broly Terceira forma (50%)"] },
  { author: "vida_nostalgica", what: ["Bardock SSJ4"] },
  { author: "papurotekikujimo", what: ["Gohan Mistico"] },
  { author: "Vsouza", what: ["Vegeta Ssj God"] },
  { author: "Woothrad", what: ["Vegeta Blue Full Power"] },
  { author: "reeck495", what: ["Caulifla"] },
  { author: "KEEGIXE", what: ["Jiren"] },
  { author: "Bite035", what: ["Kale SSJ"] },
];
/** Aplica los cambios de estadísticas de un rasgo (lo llama Player.recompute) */
function applyTraitStats(p, T) {
  const m = T.m || {};
  if (m.dmg) p.statDmg += m.dmg;
  if (m.rate) p.rateMul += m.rate;
  if (m.spd) p.speedMul = Math.max(0.4, p.speedMul + m.spd);
  if (m.crit) p.crit += m.crit;
  if (m.critDmg) p.critDmg += m.critDmg;
  if (m.armor) p.armor = clamp(p.armor + m.armor, -0.5, 0.6);
  if (m.regen) p.regen += m.regen;
  if (m.killHeal) p.killHeal += m.killHeal;
  if (m.magnet) p.magnet *= 1 + m.magnet;
  if (m.xp) p.xpMul = Math.max(0.3, p.xpMul + m.xp);
  if (m.zeni) p.zeniMul += m.zeni;
  if (m.kiRegen) p.kiRegen *= 1 + m.kiRegen;
  if (m.maxHp) p.maxHp *= 1 + m.maxHp;
  if (m.dodge) p.dodge = Math.min(0.6, p.dodge + m.dodge);
  if (m.dashCd) p.dashMul *= 1 + m.dashCd;
  if (m.dashCost) p.dashCost *= 1 + m.dashCost;
}

/* ---------- Desafío diario: mismo mapa (semilla del día) y mismos modificadores para todos ---------- */
const DAILY_MODS = [
  { id: 'fast', icon: '»', name: 'Horda veloz', text: 'Los enemigos son un 25% más rápidos.' },
  { id: 'glass', icon: '✷', name: 'Cañón de cristal', text: 'Haces +50% de daño, pero tienes -40% de vida.' },
  { id: 'rich', icon: '$', name: 'Rebajas de Capsule Corp.', text: 'Cápsulas a mitad de precio, pero los enemigos tienen +30% de vida.' },
  { id: 'elite', icon: '★', name: 'Noche de élites', text: 'Aparecen el triple de élites.' },
  { id: 'night', icon: '☾', name: 'Noche eterna', text: 'En la Tierra y en el Planeta Vegeta nunca amanece.' },
  { id: 'boom', icon: '✹', name: 'Invasión Saibaiman', text: 'Saibaimen kamikaze por todas partes.' },
  { id: 'noregen', icon: '♥', name: 'Sin descanso', text: 'Sin regeneración de vida (las semillas sí curan).' },
  { id: 'bigboss', icon: '♛', name: 'Jefes colosales', text: 'Los jefes tienen +50% de vida, pero dan el doble de recompensa.' }
];
/* ---------- Oráculo de Kami: al empezar cada partida eliges un pacto (ventaja fuerte + debilidad clara) o ninguno ---------- */
const PACTS = [
  { id: 'cristal', icon: '✷', name: 'Pacto de Cristal', good: '+40% de daño', bad: 'Recibes el doble de daño', apply: (p) => { p.statDmg *= 1.4; p.takeMul = 2; } },
  { id: 'ermitano', icon: '☯', name: 'Pacto del Ermitaño', good: '+50% de experiencia', bad: 'Las semillas senzu no curan', apply: (p) => { p.xpMul *= 1.5; p.noSenzu = true; } },
  { id: 'avaricia', icon: '$', name: 'Pacto de la Avaricia', good: '+60% de Zeni', bad: '-25% de vida máxima', apply: (p) => { p.zeniMul *= 1.6; p.maxHp *= 0.75; } },
  { id: 'viento', icon: '»', name: 'Pacto del Viento', good: '+25% de velocidad', bad: '-20% de daño', apply: (p) => { p.speedMul *= 1.25; p.statDmg *= 0.8; } },
  { id: 'kiinf', icon: '⚡', name: 'Pacto del Ki Infinito', good: 'El Ki se regenera el doble de rápido', bad: '-30% de vida máxima', apply: (p) => { p.kiRegen *= 2; p.maxHp *= 0.7; } },
  { id: 'sangre', icon: '♥', name: 'Pacto de Sangre', good: 'Curas 1 de vida por cada enemigo', bad: 'Sin regeneración de vida', apply: (p) => { p.killHeal += 1; p.noRegen = true; } },
  { id: 'horda', icon: '☠', name: 'Pacto de la Horda', good: '+40% de experiencia y de Zeni', bad: 'Los enemigos van un 25% más rápido', apply: (p) => { p.xpMul *= 1.4; p.zeniMul *= 1.4; }, game: (g) => { g.mods.fast = true; } },
  { id: 'instinto', icon: '◎', name: 'Pacto del Instinto', good: '+15% de crítico y +50% de daño crítico', bad: '-15% de velocidad', apply: (p) => { p.crit += 0.15; p.critDmg += 0.5; p.speedMul *= 0.85; } }
];
/* Modo Historia (libros y capítulos): js/story.js */
/* Torneo de las Artes Marciales: radio del ring y los tres rivales (tipo de enemigo y multiplicador de vida) */
const TOUR_R = 13;
const TOUR_FIGHTERS = [{ type: T_FAST, name: 'APPULE', mul: 3 }, { type: T_BRUTE, name: 'NAPPA', mul: 4 }, { type: T_ELITE, name: 'CAPITÁN GINYU', mul: 6 }];
const ROOM_TIME = 40;   // Sala del Tiempo: segundos dentro (fuera pasan ROOM_TIME / 6)
const BALL_SEE = 22;   // Radar del Dragón: a menos de esta distancia las esferas aparecen en el radar
const dailySeed = () => +todayStr().replace(/-/g, '');
/** 2 modificadores del día (iguales para todos ese día) */
function dailyMods() {
  const r = seeded(dailySeed() * 7 + 3), pool = DAILY_MODS.slice(), out = [];
  while (out.length < 2) out.push(pool.splice((r() * pool.length) | 0, 1)[0]);
  return out;
}
/** Puntuación de una partida (para el ranking local) */
const runScore = (o) => Math.round(o.kills + o.level * 25 + o.bosses * 600 + o.step * 900 + o.time * 0.5 + (o.win ? 2500 : 0));

/* ---------- Iconos con sprite (hoja «icons», 8x3 casillas). `ico` en técnicas, vitaminas y objetos ----------
   El icono de texto se guarda en `glyph` (por si hace falta en texto plano) y `icon` pasa a ser el HTML del sprite */
const ICON_NAMES = ['kame', 'flare', 'genki', 'flash', 'explode', 'senzu', 'kaioken', 'sbc', 'galick', 'tp', 'homing', 'disc',
  'absorb', 'regen', 'power', 'barrier', 'tail', 'pole', 'dball', 'capsule', 'gear', 'map', 'stats', 'system'];
const iconHtml = (name) => {
  const k = ICON_NAMES.indexOf(name);
  return k < 0 ? '' : '<i class="ico" style="background-position:' + ((k % 8) / 7 * 100).toFixed(2) + '% ' + ((k / 8 | 0) / 2 * 100) + '%"></i>';
};
(() => {
  const W = { kamehameha: 'kame', fsk: 'kame', godkame: 'kame', instkame: 'kame', masenkame: 'kame', kaiokame: 'kaioken', taiyoken: 'flare', taiyobomb: 'flare',
    genkidama: 'genki', supernova: 'genki', heatdome: 'genki', finalflash: 'flash', finalexp: 'explode', kaioken: 'kaioken', makanko: 'sbc', makankodef: 'sbc',
    eyebeam: 'sbc', deathbeam: 'sbc', galick: 'galick', finalshine: 'galick', galickburst: 'galick', ki: 'homing', gblast: 'homing', hellzone: 'homing',
    hellstorm: 'homing', renzoku: 'homing', kienzan: 'disc', kdisc: 'disc', kienzanx: 'disc', deathsaucer: 'disc', deathball: 'absorb', rage: 'power',
    rageblast: 'power', sword: 'pole', swordrain: 'pole', shining: 'pole', nova: 'power', kiplanet: 'genki', judgement: 'flash', deathstorm: 'sbc' };
  for (const id in W) if (WEAPONS[id] && !WEAPONS[id].ico) WEAPONS[id].ico = W[id];
  const S = { dmg: 'power', hp: 'regen', senzu: 'senzu', ki: 'capsule', armor: 'gear', mag: 'map' };
  const I = { baston: 'pole', ozaru: 'tail', esfera4: 'dball', capsula_ki: 'capsule', gi_roshi: 'gear', armadura: 'gear', radar: 'map', radar_bulma: 'map', senzu_seca: 'senzu', saco_senzu: 'senzu', aura_saiyan: 'power', agua_karin: 'regen' };
  const conv = (o, ico) => { if (ico && !o.glyph) { o.glyph = o.icon; o.icon = iconHtml(ico); } };
  for (const id in WEAPONS) conv(WEAPONS[id], WEAPONS[id].ico);
  for (const st of STATS) conv(st, S[st.id]);
  for (const it of ITEMS) conv(it, I[it.id]);
})();


/* ---------- Ataque físico y ataque de ki (como el ataque y el ataque especial de Pokémon) ----------
   Cada técnica es física (golpes, espadas, guadañas, combos) o de ki (ráfagas, rayos, esferas, discos...).
   Las físicas usan el ATQ FÍSICO del personaje y no gastan Ki; las de ki usan el ATQ KI y gastan Ki */
const PHYS_KINDS = new Set(['scythe', 'godslash', 'meteor', 'rush', 'quake', 'whirl']);
/* ---------- Técnicas nuevas: una física y una de ki para cada personaje ----------
   [personaje, nombre, tipo, color, cfg, descripción]. La física sale a partir del nivel 4 y la de ki del 8 */
const LV_TXT = {
  rush: ['+30% de daño.', 'Embestida más larga.', 'Recarga reducida.', '+2 golpes y +35% de daño.'],
  quake: ['+30% de daño.', 'Réplica: una segunda onda más amplia.', 'Más alcance y recarga reducida.', '+35% de daño.'],
  whirl: ['+30% de daño.', 'Más alcance.', 'Recarga reducida.', '+3 patadas y +30% de daño.'],
  meteor: ['+1 golpe.', '+35% de daño.', 'Recarga reducida.', '+2 golpes.'],
  scythe: ['+40% de daño.', 'Doble tajo.', 'Mayor alcance.', 'Tajo circular completo.'],
  godslash: ['+30% de daño.', 'Tajo más grande.', 'Recarga reducida.', '+30% de daño: tajo definitivo.'],
  zshot: ['+30% de daño.', '+1 proyectil.', 'Recarga reducida.', '+1 proyectil y +30% de daño.'],
  bigbeam: ['+40% de daño y rayo más ancho.', '+40% de daño y rayo más largo.', '+40% de daño y recarga reducida.', '+40% de daño: rayo definitivo.'],
  nova: ['+40% de daño.', 'Más alcance.', 'Segunda onda.', '+40% de daño y recarga reducida.'],
  discs: ['+30% de daño.', '+1 disco.', 'Recarga reducida.', '+2 discos.'],
  thunder: ['+1 rayo.', '+35% de daño.', '+2 rayos y más área.', '+2 rayos y recarga reducida.'],
  pbolt: ['+20% de daño.', '+1 rayo.', 'Rayo más largo.', '+1 rayo y recarga reducida.']
};
const KIND_ICO = { rush: 'tp', quake: 'power', whirl: 'kaioken', meteor: 'tp', scythe: 'pole', godslash: 'pole', zshot: 'homing', bigbeam: 'kame', nova: 'explode', discs: 'disc', thunder: 'flash', pbolt: 'sbc' };
const NEW_TECH = {
  goku_f: ['goku', 'Dragon Rush', 'rush', 0xffb040, { len: 13, n: 5, dmg: 33, cd: 3.2 }, 'Goku cruza la horda con una lluvia de golpes y remata con un puñetazo que la aturde.'],
  goku_k: ['goku', 'Super Kamehameha', 'bigbeam', 0x5ac8ff, { cd: 10, dmg: 14, len: 40, hw: 3, life: 1.3, cost: 24 }, 'Un Kamehameha enorme cargado a tope.'],
  vegeta_f: ['vegeta', 'Combo del Príncipe', 'meteor', 0x7ab0ff, { dmg: 21, cd: 5 }, 'Vegeta aparece junto a varios enemigos y los golpea uno tras otro.'],
  vegeta_k: ['vegeta', 'Final Impact', 'zshot', 0x9ad8ff, { n: 1, spd: 24, dmg: 14, cd: 3.2, size: 3.4, look: 'zsphereB', aoe: 3.5, life: 1.4 }, 'Una esfera de ki gigante que estalla al impactar.'],
  black_f: ['black', 'Embestida Divina', 'rush', 0xff6ac8, { len: 12, n: 4, dmg: 25, cd: 3 }, 'Black atraviesa la horda a toda velocidad golpeando todo a su paso.'],
  black_k: ['black', 'Lluvia de Ki Rosa', 'zshot', 0xff7ad8, { n: 6, spd: 22, dmg: 50, cd: 2.4, size: 1.6, look: 'zpink', ring: true }, 'Esferas de ki rosa en todas direcciones.'],
  piccolo_f: ['piccolo', 'Patada Namekiana', 'whirl', 0x7aff7a, { n: 6, r: 3.8, dmg: 4.0, cd: 2.6 }, 'Piccolo gira dando patadas a todo lo que le rodea.'],
  piccolo_k: ['piccolo', 'Bakuriki Maha', 'nova', 0xb8ff8a, { r: 8.5, dmg: 35, cd: 4 }, 'Piccolo libera una onda de ki que arrasa todo alrededor.'],
  gohan_f: ['gohan', 'Puño de la Ira', 'quake', 0xffd84a, { r: 6.5, dmg: 27, cd: 4.5 }, 'Gohan golpea el suelo con toda su rabia: daña, empuja y aturde alrededor.'],
  gohan_k: ['gohan', 'Masenko Dorado', 'bigbeam', 0xffe45a, { cd: 8, dmg: 6.1, len: 34, hw: 2.4, life: 1.1, cost: 18 }, 'Un Masenko dorado que atraviesa a la horda.'],
  freezer_f: ['freezer', 'Nova Strike', 'rush', 0xd070ff, { len: 14, n: 4, dmg: 32, cd: 3.4 }, 'Freezer se lanza envuelto en ki y arrolla todo lo que encuentra.'],
  freezer_k: ['freezer', 'Supernova de Freezer', 'zshot', 0xffa040, { n: 1, spd: 14, dmg: 21, cd: 4.5, size: 4.2, look: 'zsunX', aoe: 5, life: 1.8 }, 'Un sol en miniatura que estalla sobre la horda.'],
  krilin_f: ['krilin', 'Patada de la Grulla', 'whirl', 0xffa040, { n: 7, r: 3.4, dmg: 2.7, cd: 2.2 }, 'Krilin encadena patadas rapidísimas girando sobre sí mismo.'],
  krilin_k: ['krilin', 'Kamehameha de Krilin', 'bigbeam', 0x7ad0ff, { cd: 8, dmg: 6.6, len: 32, hw: 2.2, life: 1, cost: 16 }, 'El Kamehameha que aprendió del Maestro Roshi.'],
  trunks_f: ['trunks', 'Burning Slash', 'godslash', 0xffc84a, { r: 8, dmg: 7.2, cd: 2.2 }, 'Un tajo enorme con la espada cargada de ki ardiente.'],
  trunks_k: ['trunks', 'Masenko del Futuro', 'zshot', 0xffe06a, { n: 1, spd: 20, dmg: 17, cd: 3.6, size: 3.6, look: 'zblastY', aoe: 4, life: 1.5 }, 'Trunks lanza una esfera de ki que revienta en el impacto.'],
  cell_f: ['cell', 'Combo Perfecto', 'meteor', 0x8aff7a, { dmg: 24, cd: 5 }, 'Cell golpea en un instante a varios enemigos y los deja aturdidos.'],
  cell_k: ['cell', 'Kamehameha Solar', 'bigbeam', 0x66d8ff, { cd: 11, dmg: 12, len: 44, hw: 3.2, life: 1.4, cost: 26 }, 'El Kamehameha capaz de destruir el sistema solar.'],
  bardock_f: ['bardock', 'Asalto de Clase Baja', 'rush', 0xff7a4a, { len: 12, n: 5, dmg: 25, cd: 3 }, 'Bardock carga contra la horda a puñetazos.'],
  bardock_k: ['bardock', 'Espíritu Saiyajin', 'bigbeam', 0x7ab8ff, { cd: 9, dmg: 6.0, len: 36, hw: 2.6, life: 1.2, cost: 20 }, 'Un rayo con todo el orgullo de la clase baja.'],
  vegito_f: ['vegito', 'Combo Potara', 'whirl', 0x9ae0ff, { n: 8, r: 4, dmg: 2.5, cd: 2.4 }, 'Vegito gira repartiendo golpes y patadas a toda la horda.'],
  vegito_k: ['vegito', 'Ráfaga Espiritual', 'zshot', 0x9ae0ff, { n: 3, spd: 26, dmg: 64, cd: 1.8, size: 2, look: 'zkiY', spread: 0.2, home: 6 }, 'Tres esferas de ki que persiguen a los enemigos.'],
  gogeta_f: ['gogeta', 'Danza Final', 'whirl', 0xffd060, { n: 8, r: 4, dmg: 2.7, cd: 2.4 }, 'Gogeta gira en una danza de golpes imparable.'],
  gogeta_k: ['gogeta', 'Ráfaga Arcoíris', 'zshot', 0xc8a8ff, { n: 1, spd: 16, dmg: 16, cd: 4.2, size: 3.8, look: 'zsphereB', aoe: 5, life: 1.8 }, 'Una esfera de ki arcoíris que lo desintegra todo.'],
  zamasuf_f: ['zamasuf', 'Juicio Inmortal', 'quake', 0xc8a0ff, { r: 7, dmg: 26, cd: 4.2 }, 'Zamasu golpea el suelo con la fuerza de un dios.'],
  zamasuf_k: ['zamasuf', 'Ira Santa', 'bigbeam', 0xd8b0ff, { cd: 10, dmg: 12, len: 42, hw: 3, life: 1.3, cost: 24 }, 'Un rayo de luz divina que purifica a los mortales.'],
  broly_f: ['broly', 'Martillo Gigante', 'quake', 0x7dff5a, { r: 7.5, dmg: 43, cd: 5 }, 'Broly aplasta el suelo con los dos puños.'],
  broly_k: ['broly', 'Eraser Cannon', 'zshot', 0x9aff6a, { n: 1, spd: 15, dmg: 39, cd: 5, size: 4.4, look: 'zblastG', aoe: 5.5, life: 1.8 }, 'Una esfera verde descomunal que arrasa la zona.'],
  kefla_f: ['kefla', 'Patada Salvaje', 'whirl', 0xb8ff5a, { n: 7, r: 3.8, dmg: 3.0, cd: 2.4 }, 'Kefla gira repartiendo patadas salvajes.'],
  kefla_k: ['kefla', 'Gigantic Ray', 'pbolt', 0x9aff6a, { len: 26, dmg: 20, cd: 2.2, hw: 1 }, 'Rayos verdes que atraviesan a la horda.'],
  gotenks_f: ['gotenks', 'Combo Ultra Gotenks', 'meteor', 0xffb0d0, { dmg: 23, cd: 4.8 }, 'Gotenks golpea a varios enemigos sin que lo vean venir.'],
  gotenks_k: ['gotenks', 'Donut Galáctico', 'discs', 0xffe08a, { n: 3, dmg: 22, cd: 3.4, spd: 18, life: 1.6 }, 'Anillos de ki que cortan a la horda.'],
  trunksarm_f: ['trunksarm', 'Tajo del Futuro', 'scythe', 0xa8e0ff, { cd: 1.1, r: 5.5, dmg: 13 }, 'Tajos rapidísimos con la espada.'],
  trunksarm_k: ['trunksarm', 'Lluvia Armada', 'zshot', 0xa8e0ff, { n: 5, spd: 24, dmg: 45, cd: 2.2, size: 1.6, look: 'zkiY', spread: 0.25 }, 'Un abanico de ráfagas de ki.'],
  caulifla_f: ['caulifla', 'Embestida Rosa', 'rush', 0xff7ab0, { len: 12, n: 4, dmg: 21, cd: 3 }, 'Caulifla se lanza a puñetazos contra la horda.'],
  caulifla_k: ['caulifla', 'Crush Cannon', 'zshot', 0xff7ab0, { n: 2, spd: 22, dmg: 7.7, cd: 2.6, size: 2.6, look: 'zpinkB', aoe: 3, spread: 0.15 }, 'Dos cañonazos de ki rosa que explotan.'],
  kale_f: ['kale', 'Puño Berserker', 'quake', 0x7dff5a, { r: 6.5, dmg: 27, cd: 4.6 }, 'Kale descarga su furia contra el suelo.'],
  kale_k: ['kale', 'Ola Berserker', 'nova', 0x9aff6a, { r: 8.5, dmg: 28, cd: 4 }, 'Una onda de ki verde que lo arrasa todo alrededor.'],
  kyabe_f: ['kyabe', 'Patada de Sadala', 'whirl', 0x7ac0ff, { n: 6, r: 3.6, dmg: 3.4, cd: 2.4 }, 'Kyabe gira dando patadas al estilo de Sadala.'],
  kyabe_k: ['kyabe', 'Lluvia Atómica', 'thunder', 0x8ad8ff, { n: 4, r: 2.2, dmg: 10, cd: 3 }, 'Rayos de ki que caen sobre la horda.'],
  toppo_f: ['toppo', 'Puño de la Justicia', 'quake', 0xffd84a, { r: 6.5, dmg: 23, cd: 4.6 }, 'Toppo golpea el suelo en nombre de la justicia.'],
  toppo_k: ['toppo', 'Destrucción de Toppo', 'nova', 0xc070ff, { r: 9, dmg: 24, cd: 4.2 }, 'El poder de un dios de la destrucción, liberado a su alrededor.'],
  janemba_f: ['janemba', 'Garra Demoníaca', 'scythe', 0xff4a5a, { cd: 1, r: 6, dmg: 15 }, 'Zarpazos con las garras del demonio.'],
  janemba_k: ['janemba', 'Lluvia Demoníaca', 'zshot', 0xff6a3a, { n: 6, spd: 20, dmg: 54, cd: 2.6, size: 1.8, look: 'zhellF', ring: true }, 'Llamas del infierno en todas direcciones.'],
  jiren_f: ['jiren', 'Power Impact', 'quake', 0xff4a4a, { r: 7, dmg: 21, cd: 4.8 }, 'Jiren golpea el suelo con una fuerza abrumadora.'],
  jiren_k: ['jiren', 'Zona de Poder', 'nova', 0xff6a4a, { r: 9, dmg: 23, cd: 4 }, 'Jiren libera su ki y aparta a toda la horda.'],
  turles_f: ['turles', 'Embestida de Turles', 'rush', 0xb07aff, { len: 12, n: 4, dmg: 38, cd: 3.2 }, 'Turles carga contra la horda a golpes.'],
  turles_k: ['turles', 'Meteor Burst', 'zshot', 0xd07aff, { n: 3, spd: 22, dmg: 4.5, cd: 2.4, size: 2.2, look: 'zburstP', aoe: 2.5, spread: 0.22 }, 'Tres ráfagas de ki que estallan al impactar.'],
  saibaman_f: ['saibaman', 'Garras de Saibaman', 'scythe', 0x7aff5a, { cd: 0.9, r: 4.5, dmg: 15 }, 'Zarpazos rápidos con las garras.'],
  saibaman_k: ['saibaman', 'Lluvia Ácida', 'thunder', 0x9aff4a, { n: 4, r: 2, dmg: 10, cd: 2.8 }, 'Gotas de ácido que caen sobre la horda.'],
  bills_f: ['bills', 'Toque de Destrucción', 'quake', 0xb070ff, { r: 7, dmg: 36, cd: 5 }, 'Bills toca el suelo con un dedo y lo hace temblar todo.'],
  bills_k: ['bills', 'Hakai', 'nova', 0xc080ff, { r: 9.5, dmg: 26, cd: 4.4 }, 'La técnica del dios de la destrucción: borra lo que tiene alrededor.'],
  cooler_f: ['cooler', 'Látigo del Tirano', 'whirl', 0xb07aff, { n: 6, r: 4, dmg: 3.1, cd: 2.6 }, 'Cooler gira golpeando con la cola.'],
  cooler_k: ['cooler', 'Supernova de Cooler', 'zshot', 0xffc04a, { n: 1, spd: 14, dmg: 22, cd: 4.5, size: 4.2, look: 'zsun', aoe: 5, life: 1.8 }, 'Una supernova dorada que estalla sobre la horda.'],
  hitto_f: ['hitto', 'Salto Temporal', 'meteor', 0x9a7aff, { dmg: 15, cd: 4.6 }, 'Hit detiene el tiempo y golpea a varios enemigos.'],
  hitto_k: ['hitto', 'Disparo del Asesino', 'zshot', 0xb08aff, { n: 1, spd: 34, dmg: 56, cd: 1.8, size: 1.6, look: 'zkiP', pierce: 6, life: 1.2 }, 'Un disparo de ki rapidísimo que atraviesa enemigos.'],
  raditz_f: ['raditz', 'Doble Embestida', 'rush', 0xb070ff, { len: 12, n: 5, dmg: 23, cd: 3 }, 'Raditz arrolla a la horda a golpes.'],
  raditz_k: ['raditz', 'Saturday Crush', 'zshot', 0xc07aff, { n: 2, spd: 22, dmg: 8.1, cd: 2.6, size: 2.4, look: 'zkiP', aoe: 3, spread: 0.18 }, 'Dos esferas de ki que explotan al impactar.'],
  andro16_f: ['andro16', 'Puño Cohete', 'rush', 0xff9a4a, { len: 15, n: 3, dmg: 30, cd: 3.6 }, 'El 16 dispara su puño y arrasa todo a su paso.'],
  andro16_k: ['andro16', "Hell's Flash", 'bigbeam', 0xffb04a, { cd: 10, dmg: 8.3, len: 40, hw: 3, life: 1.3, cost: 24 }, 'El cañón de los brazos del 16 a máxima potencia.'],
  andro17_f: ['andro17', 'Patada Infinita', 'whirl', 0x7ac8ff, { n: 7, r: 3.6, dmg: 3.1, cd: 2.3 }, 'El 17 gira dando patadas sin cansarse nunca.'],
  andro17_k: ['andro17', 'Power Blitz', 'zshot', 0x8aff8a, { n: 4, spd: 24, dmg: 72, cd: 2, size: 1.8, look: 'zkiG', spread: 0.2, home: 5 }, 'Esferas de ki que persiguen a los enemigos.'],
  andro18_f: ['andro18', 'Combo Gemelo', 'meteor', 0x7ad0ff, { dmg: 14, cd: 4.4 }, 'La 18 golpea a varios enemigos en un instante.'],
  andro18_k: ['andro18', 'Disco del 18', 'discs', 0xffd84a, { n: 2, dmg: 23, cd: 3.2, spd: 20, life: 1.5 }, 'Discos de ki que cortan a la horda.'],
  majin_f: ['majin', 'Panzazo de Buu', 'quake', 0xff8ad8, { r: 6, dmg: 30, cd: 4.4 }, 'Buu se deja caer con la barriga y aplasta a todos alrededor.'],
  majin_k: ['majin', 'Ira Majin', 'nova', 0xff7ad0, { r: 8.5, dmg: 30, cd: 4 }, 'Buu se enfada y suelta vapor de ki por todo el cuerpo.'],
  superbuu_f: ['superbuu', 'Torbellino de Buu', 'whirl', 0xff8ad8, { n: 7, r: 4, dmg: 2.6, cd: 2.5 }, 'Super Buu gira golpeando con sus brazos elásticos.'],
  superbuu_k: ['superbuu', 'Exterminio Humano', 'zshot', 0xff7ad8, { n: 8, spd: 20, dmg: 38, cd: 3, size: 1.6, look: 'zpink', ring: true }, 'Una lluvia de ki rosa en todas direcciones.'],
  zamasu_f: ['zamasu', 'Embestida Inmortal', 'rush', 0xc8b8ff, { len: 12, n: 4, dmg: 33, cd: 3.2 }, 'Zamasu se lanza contra la horda golpeando a su paso.'],
  zamasu_k: ['zamasu', 'Rayo Sagrado', 'thunder', 0xd8c8ff, { n: 4, r: 2.4, dmg: 17, cd: 3 }, 'Rayos de luz divina caen sobre los mortales.']
};
for (const id in NEW_TECH) {
  const [ch, name, kind, color, cfg, desc] = NEW_TECH[id], phys = PHYS_KINDS.has(kind);
  WEAPONS[id] = { name, icon: phys ? '✊' : '✺', kind, unique: ch, minLv: phys ? 4 : 8, color, cfg, lv: [desc].concat(LV_TXT[kind]) };
  WEAPONS[id].glyph = WEAPONS[id].icon; WEAPONS[id].icon = iconHtml(KIND_ICO[kind]);
  const C = CHARACTERS.find((c) => c.id === ch); if (C && !C.unique.includes(id)) C.unique.push(id);
}
for (const id in WEAPONS) { const W = WEAPONS[id]; if (!W.cat) W.cat = PHYS_KINDS.has(W.kind) ? 'fis' : 'ki'; }
// Fuentes de daño que no son técnicas: teletransporte y contraataque son golpes; aura, rayos y explosiones, ki
const SRC_CAT = { tp: 'fis', counter: 'fis', aura: 'ki', bolt: 'ki', chain: 'ki', transform: 'ki', boombarrier: 'ki', ult: 'mix' };
const srcCat = (src) => (WEAPONS[src] && WEAPONS[src].cat) || SRC_CAT[src] || null;
// [ATQ FÍSICO, ATQ KI] de cada personaje: 1 = normal
const CHAR_ATK = {
  goku: [1.1, 1.1], vegeta: [1.0, 1.2], black: [1.15, 1.05], piccolo: [0.95, 1.1], gohan: [1.0, 1.2], freezer: [0.9, 1.25],
  krilin: [1.05, 1.0], trunks: [1.2, 1.0], cell: [1.05, 1.2], bardock: [1.15, 1.0], vegito: [1.2, 1.15], gogeta: [1.2, 1.15],
  zamasuf: [1.2, 1.2], broly: [1.3, 1.0], kefla: [1.1, 1.15], gotenks: [1.05, 1.05], trunksarm: [1.2, 0.95], caulifla: [1.0, 1.15],
  kale: [1.3, 0.9], kyabe: [1.0, 1.05], toppo: [1.15, 1.1], janemba: [1.15, 1.1], jiren: [1.3, 1.05], turles: [1.05, 1.1],
  saibaman: [0.95, 0.95], bills: [1.15, 1.25], cooler: [1.0, 1.2], hitto: [1.3, 0.95], raditz: [1.1, 0.95], andro16: [1.2, 1.0],
  andro17: [1.05, 1.1], andro18: [1.1, 1.0], majin: [1.05, 1.15], superbuu: [1.15, 1.15], zamasu: [1.05, 1.15]
};
for (const c of CHARACTERS) { const a = CHAR_ATK[c.id] || [1, 1]; c.atkF = a[0]; c.atkK = a[1]; }
