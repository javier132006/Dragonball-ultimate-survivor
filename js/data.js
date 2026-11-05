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
  'goku_chg', 'vegeta_chg', 'black_chg', 'gohan_chg', 'freezer_chg', 'trunks_chg', 'cell_chg', 'piccolo_chg', 'vegito_chg', 'broly_chg', 'bardock_chg', 'gogeta_chg', 'vegito_intro', 'gogeta_intro',
  'enemies', 'bosses', 'fx', 'fxbig', 'fxzip', 'impact', 'props', 'tall', 'icons', 'tiles'];

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
    hp: 100, ki: 130, spd: 1.0, dmg: 1.12, start: ['vblast'], unique: ['vblast', 'galick', 'bigbang', 'kakusan'],
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
    hp: 100, ki: 120, spd: 1.0, dmg: 1.05, start: ['gblast'], unique: ['gblast', 'fsk', 'rage', 'zsword', 'gthunder'],
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
  }
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
  meteorstorm: { down: { text: '-3% de crítico', m: { crit: -0.03 } },  name: 'Tormenta de Meteoros', icon: '☄', kind: 'rain', fusion: ['rain', 'mines'], color: 0xff9a3a, mul: { n: 2, dmg: 1.8, cd: 0.7 }, lv: ['Fusión: el cielo entero cae sobre tus enemigos.'] }
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
  { id: 'armor', name: 'Gi de Entrenamiento', icon: '▣', max: 5, text: 'Recibes un 7% menos de daño.', apply: (p, k = 1) => { p.armor = Math.min(0.5, p.armor + 0.07 * k); } }
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
  { name: 'Caulifla', row: 13, hp: 1, spd: 1.25, scale: 1, tint: 0xffffff, dmg: 0.85, xp: 2.2, r: 0.65, cash: 2.5, fly: true, flyEff: 'nodash', flyTint: 0xff6aa0 }
];
/* Índices de tipo para que el código se lea mejor */
const T_BASIC = 0, T_FAST = 1, T_BRUTE = 2, T_BOSS = 3, T_ELITE = 4, T_BOOM = 5, T_SHIELD = 6, T_FLY = 7, T_ABSORB = 8, T_CELLJR = 9;
const T_FROST = 10, T_MBUU = 11, T_A18 = 12, T_KALE = 13, T_KYABE = 14, T_CAULI = 15;


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
const ITEMS = [
  { id: 'cinta', icon: '⚑', name: 'Cinta de Entrenamiento', rarity: 0, text: '+6% de daño.', apply: (p) => { p.statDmg += 0.06; } },
  { id: 'botas', icon: '»', name: 'Botas Pesadas', rarity: 0, text: '+5% de velocidad.', apply: (p) => { p.speedMul += 0.05; } },
  { id: 'senzu_seca', icon: '♥', name: 'Semilla Seca', rarity: 0, text: '+20 de vida máxima.', apply: (p) => hp(p, 20) },
  { id: 'radar', icon: '⌖', name: 'Radar del Dragón', rarity: 0, text: '+20% de imán de orbes.', apply: (p) => { p.magnet *= 1.2; } },
  { id: 'capsula_ki', icon: '⚡', name: 'Cápsula de Ki', rarity: 0, text: '+15 de Ki máximo y +1 Ki/s.', apply: (p) => { p.maxKi += 15; p.kiRegen += 1; } },
  { id: 'scouter', icon: '◎', name: 'Scouter Roto', rarity: 0, text: '+4% de probabilidad de crítico.', apply: (p) => { p.crit += 0.04; } },

  { id: 'gi_roshi', icon: '▣', name: 'Gi del Maestro Roshi', rarity: 1, text: 'Recibes un 6% menos de daño.', apply: (p) => { p.armor = Math.min(0.6, p.armor + 0.06); } },
  { id: 'nube', icon: '☁', name: 'Nube Voladora', rarity: 1, text: '+10% de velocidad y dash 8% más rápido.', apply: (p) => { p.speedMul += 0.1; p.dashMul *= 0.92; } },
  { id: 'baston', icon: '⎮', name: 'Bastón Sagrado', rarity: 1, text: '+12% de daño.', apply: (p) => { p.statDmg += 0.12; } },
  { id: 'pesas', icon: '◍', name: 'Pesas del Maestro', rarity: 1, text: '+30 de vida máxima y +0,5 de vida/s.', apply: (p) => { hp(p, 30); p.regen += 0.5; } },
  { id: 'amuleto', icon: '♣', name: 'Amuleto de la Fortuna', rarity: 1, text: '+4 de suerte: más rareza en las cápsulas.', apply: (p) => { p.luck += 4; } },
  { id: 'libro', icon: '☰', name: 'Libro del Kame Sennin', rarity: 1, text: '+15% de experiencia.', apply: (p) => { p.xpMul += 0.15; } },

  { id: 'ropa_piccolo', icon: '▼', name: 'Ropa con Pesas de Piccolo', rarity: 2, text: '+15% de daño y 6% menos de daño recibido.', apply: (p) => { p.statDmg += 0.15; p.armor = Math.min(0.6, p.armor + 0.06); } },
  { id: 'agua_karin', icon: '≈', name: 'Agua Sagrada de Karin', rarity: 2, text: '+40 de vida máxima y +1 de vida/s.', apply: (p) => { hp(p, 40); p.regen += 1; } },
  { id: 'radar_bulma', icon: '◉', name: 'Radar de Bulma', rarity: 2, text: '+40% de imán y +20% de experiencia.', apply: (p) => { p.magnet *= 1.4; p.xpMul += 0.2; } },
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
  { id: 'block', name: 'Técnica de Defensa', desc: 'El bloqueo con Ki gasta un 10% menos', max: 5, cost: 300 },
  { id: 'tp', name: 'Shunkan Ido', desc: 'La Transmisión Instantánea se recarga un 8% antes', max: 5, cost: 350 },
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
  { id: 'a_pb25', icon: '⛨', name: 'Defensa perfecta', desc: 'Haz 25 bloqueos perfectos', stat: 'perfects', goal: 25, reward: 500 },
  { id: 'a_tp50', icon: '⇝', name: 'Shunkan Ido', desc: 'Usa 50 veces la Transmisión Instantánea', stat: 'tps', goal: 50, reward: 400 },
  { id: 'a_day1', icon: '☀', name: 'Reto del día', desc: 'Termina un desafío diario', stat: 'dailies', goal: 1, reward: 300 },
  { id: 'a_day7', icon: '☀', name: 'Constancia de guerrero', desc: 'Termina 7 desafíos diarios', stat: 'dailies', goal: 7, reward: 1500 },
  { id: 'a_bp', icon: '♛', name: 'Sin piedad', desc: 'Lleva a 20 jefes a su última fase', stat: 'phase3', goal: 20, reward: 700 }
];
const todayStr = () => { const t = new Date(); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };

/* ---------- Guardado local ---------- */
const Save = {
  d: { zeni: 0, unlocked: ['goku'], sel: 'goku', up: {}, best: {}, items: [], techs: [], stats: {}, claimed: {}, clears: {}, diff: 'easy', daily: null, login: { last: '', streak: 0 }, ach: {}, vol: { mus: 0.5, sfx: 0.75 },
    opt: { quality: 'auto', flash: false, shake: 1 }, rank: [], day: null, dayHist: [] },
  load() {
    try { const s = JSON.parse(localStorage.getItem('dbus_save_v1')); if (s) Object.assign(this.d, s); } catch (e) { /* sin guardado */ }
    this.d.opt = Object.assign({ quality: 'auto', flash: false, shake: 1 }, this.d.opt || {});
    if (!Array.isArray(this.d.rank)) this.d.rank = [];
    if (!Array.isArray(this.d.dayHist)) this.d.dayHist = [];
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
  gogeta: [[0, 3], [3, 3], [6, 3], [9, 3]]
};
const formChg = (ch, idx) => (FORM_CHG[ch.id] || [])[idx] || null;

/* ---------- Créditos: autores de los sprites del pack «Dragon Ball Sagas» (archivo «Hecho por …» de cada carpeta) ---------- */
const SPRITE_CREDITS = [
  { author: "qsab101", what: ["Broly Segunda Forma", "Cooler", "Gogeta", "Janemba", "Goku Black", "Goku Black Rose", "Goku Instinto Superior", "Goku Instinto Superior Completo", "Goku SSJ 2", "Goku kaioken", "Golden Freeza", "Kuririn", "Mirai Trunks", "Vegeta SSJ 4", "Vegeta Ssj Grade"] },
  { author: "LukasAhl1", what: ["Bardock", "Bardock Ssj", "Freeza Forma Final", "Goku God", "Goku SSJ 1", "Goku SSJ 3", "Majin Vegeta", "Piccolo", "Super Mirai Trunks", "Teen Gohan SSJ", "Teen Gohan SSJ2", "cell Perfeito"] },
  { author: "MV95", what: ["Hitto", "Raditz", "Vegito", "Vegito SSJ Blue", "Cell Imperfeito", "Freeza Full Power", "Freeza Primeira Forma", "Goku Blue Kaioken Whis Gi", "Vegeta Blue"] },
  { author: "thekrillmaster", what: ["Broly Full Power", "Toppo", "Turles", "Cell Semi Perfeito", "Goku Black SSJ", "Saibaman"] },
  { author: "PeculiarDoc", what: ["Gohan Adulto", "Goku Blue"] },
  { author: "gogeta68", what: ["Vegeta Saga Buu SSJ"] },
  { author: "JuanGomezgg", what: ["Goku SSJ 4"] },
  { author: "LICHT", what: ["Androide 17"] },
  { author: "MajinVegeta95", what: ["Freeza Terceira Forma"] },
  { author: "YoloKing777", what: ["Androide 16"] },
  { author: "whytemonster", what: ["Super Buu"] },
  { author: "Manikdx2000", what: ["Vegeta Sayajin Saga", "Vegito Ssj1"] },
  { author: "Mangal666", what: ["Vegito Ssj2"] },
  { author: "agustin902", what: ["Broly Ssj4"] },
  { author: "SonicGoku2", what: ["Broly Terceira forma (50%)"] },
  { author: "vida_nostalgica", what: ["Bardock SSJ4"] },
  { author: "papurotekikujimo", what: ["Gohan Mistico"] },
  { author: "Vsouza", what: ["Vegeta Ssj God"] },
  { author: "Woothrad", what: ["Vegeta Blue Full Power"] }
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

