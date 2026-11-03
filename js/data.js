'use strict';
/* =====================================================================
   data.js · Todo el contenido del juego como DATOS (fácil de ampliar):
   animaciones, personajes y transformaciones, armas, vitaminas,
   enemigos, mejoras del laboratorio y guardado local.
   ===================================================================== */

/* Personajes con sprite PROVISIONAL (hoja de otro personaje recoloreada) hasta tener sus sprites propios */
const SHEET_NAMES = ['goku_a', 'goku_b', 'vegeta', 'black', 'shade'];

/* ---------- Animaciones: índices de fotograma de cada hoja (4x4, fila*4+columna) ---------- */
/* Hoja "estándar" (Vegeta y enemigos): caminar, golpear, herido, dash y muerte */
const A_STD = { idle: 0, walk: [1, 2, 3, 2], atk: 5, atk2: 10, crit: 11, hurt: 8, dash: 9, death: [12, 13, 14] };
const A_VEG = { idle: 0, walk: [1, 2, 3, 2], atk: 4, atk2: 10, crit: 5, hurt: 8, dash: 9, death: [12, 13, 14] };
/* Hojas por filas (transformaciones): col0 = pose/aura, col1 = movimiento, col2 = golpe, col3 = rayo.
   Las poses con aura traen el ajedrez dentro: se evitan (el aura se genera con partículas). */
const rowAnim = (r, aura, over) => Object.assign({
  idle: r * 4 + (aura ? 1 : 0), walk: [r * 4 + 1], atk: r * 4 + 2, atk2: r * 4 + 3, crit: r * 4 + 3,
  hurt: -1, dash: r * 4 + 1, death: null
}, over || {});

/* ---------- Personajes y transformaciones ---------- */
const form = (name, lvl, sheet, anim, dmg, spd, ki, aura, tint) => ({ name, lvl, sheet, anim, dmg, spd, ki, aura, tint });
const UI_DEFEAT = { sheet: 'goku_b', hurt: -1, death: [12, 13, 14] };
const SHADE_ALT = { sheet: 'shade', hurt: 8, death: [12, 13, 14] };

const CHARACTERS = [
  {
    id: 'goku', name: 'SON GOKU', role: 'Versátil · Cuerpo a cuerpo', cost: 0,
    hp: 110, ki: 100, spd: 1.0, dmg: 1.0, start: ['ki'], unique: ['ki', 'kamehameha'],
    passive: { name: 'Zenkai', desc: 'Cada nivel que subes aumenta un 1,5% tu daño.' },
    portrait: { sheet: 'goku_a', frame: 0 },
    forms: [
      form('BASE', 1, 'goku_a', rowAnim(0), 1.0, 1.0, 0xfff0a0, 0, 0xffffff),
      form('KAIOKEN', 5, 'goku_a', rowAnim(0), 1.25, 1.12, 0xff8a8a, 0xff3030, 0xffa0a0),
      form('SUPER SAIYAN', 10, 'goku_a', rowAnim(1, true), 1.55, 1.15, 0xffe14a, 0xffd84a, 0xffffff),
      form('SUPER SAIYAN 2', 16, 'goku_b', rowAnim(0, true), 1.9, 1.2, 0xfff08a, 0xfff07a, 0xffffff),
      form('SUPER SAIYAN 3', 22, 'goku_b', rowAnim(1, true), 2.3, 1.22, 0xffd24a, 0xffc83a, 0xffffff),
      form('SUPER SAIYAN GOD', 28, 'goku_a', rowAnim(2, true), 2.8, 1.28, 0xff6a4a, 0xff4a2a, 0xffffff),
      form('SUPER SAIYAN BLUE', 34, 'goku_b', rowAnim(2, true), 3.4, 1.34, 0x6fd8ff, 0x4fc8ff, 0xffffff),
      form('ULTRA INSTINTO', 40, 'goku_a', rowAnim(3, true, { alt: UI_DEFEAT }), 4.2, 1.45, 0xdff4ff, 0xcfeaff, 0xffffff)
    ]
  },
  {
    id: 'vegeta', name: 'VEGETA', role: 'Artillería · Daño explosivo', cost: 2500,
    hp: 100, ki: 130, spd: 1.0, dmg: 1.12, start: ['vblast'], unique: ['vblast', 'galick', 'bigbang'],
    passive: { name: 'Orgullo Saiyajin', desc: '+25% de daño mientras tu Ki esté por encima del 80%.' },
    portrait: { sheet: 'vegeta', frame: 0 },
    forms: [
      form('BASE', 1, 'vegeta', A_VEG, 1.0, 1.0, 0x9ad0ff, 0, 0xffffff),
      form('PODER CRECIENTE', 10, 'vegeta', A_VEG, 1.45, 1.1, 0x9ad0ff, 0x8ac4ff, 0xffffff),
      form('ORGULLO DEL PRÍNCIPE', 20, 'vegeta', A_VEG, 1.95, 1.18, 0xffe14a, 0xffd24a, 0xffffff),
      form('LÍMITE ROTO', 32, 'vegeta', A_VEG, 2.6, 1.3, 0xff6a6a, 0xff4a4a, 0xffffff)
    ]
  },
  {
    id: 'black', name: 'GOKU BLACK', role: 'Asesino · Guadaña de ki', cost: 6000,
    hp: 90, ki: 100, spd: 1.1, dmg: 1.1, start: ['scythe'], unique: ['scythe', 'darkorbs'],
    passive: { name: 'Justicia Divina', desc: 'Recuperas 0,6 de vida por cada enemigo derrotado.' },
    portrait: { sheet: 'black', frame: 0 },
    forms: [
      form('BASE', 1, 'black', rowAnim(0, false, { atk: 3, alt: SHADE_ALT }), 1.0, 1.0, 0xb26bff, 0, 0xffffff),
      form('SUPER SAIYAN', 12, 'black', rowAnim(1, true, { alt: SHADE_ALT }), 1.6, 1.12, 0xffe36a, 0xfff07a, 0xffffff),
      form('SUPER SAIYAN ROSÉ', 24, 'black', rowAnim(2, true, { alt: SHADE_ALT }), 2.3, 1.2, 0xff7ac8, 0xff7ac8, 0xffffff),
      form('ROSÉ · PODER TOTAL', 36, 'black', rowAnim(3, true, { alt: SHADE_ALT }), 3.2, 1.3, 0xff4fb0, 0xff3fa0, 0xffffff)
    ]
  },
  {
    id: 'piccolo', name: 'PICCOLO', role: 'Control de masas · Regeneración', cost: 3500, provisional: true,
    hp: 120, ki: 110, spd: 0.95, dmg: 1.0, start: ['eyebeam'], unique: ['eyebeam', 'hellzone', 'lightgrenade'],
    passive: { name: 'Regeneración namekiana', desc: 'Recuperas 1,5 de vida por segundo.' },
    portrait: { sheet: 'vegeta', frame: 0, tint: 0x7fe07a },
    forms: [
      form('BASE', 1, 'vegeta', A_VEG, 1.0, 1.0, 0x9cff8a, 0, 0x7fe07a),
      form('FUSIÓN CON NAIL', 10, 'vegeta', A_VEG, 1.45, 1.1, 0x9cff8a, 0x8aff70, 0x6ad86a),
      form('FUSIÓN CON KAMI', 20, 'vegeta', A_VEG, 1.95, 1.18, 0xd8ff9a, 0xc8ff7a, 0x5ad05a),
      form('PICCOLO NARANJA', 32, 'vegeta', A_VEG, 2.7, 1.3, 0xffb060, 0xff9a3a, 0xffa060)
    ]
  },
  {
    id: 'gohan', name: 'GOHAN', role: 'Potencial oculto · Rayos', cost: 5000, provisional: true,
    hp: 100, ki: 120, spd: 1.0, dmg: 1.05, start: ['gblast'], unique: ['gblast', 'fsk', 'rage'],
    passive: { name: 'Potencial oculto', desc: '+40% de daño mientras tu vida esté por debajo del 50%.' },
    portrait: { sheet: 'goku_a', frame: 0, tint: 0xc8d8ff },
    forms: [
      form('BASE', 1, 'goku_a', rowAnim(0), 1.0, 1.0, 0xbfe4ff, 0, 0xc8d8ff),
      form('SUPER SAIYAN', 10, 'goku_a', rowAnim(1, true), 1.5, 1.12, 0xffe14a, 0xffd84a, 0xe8e8ff),
      form('SUPER SAIYAN 2', 18, 'goku_b', rowAnim(0, true), 2.0, 1.2, 0xfff08a, 0xfff07a, 0xe8e8ff),
      form('DEFINITIVO', 28, 'goku_a', rowAnim(0, true), 2.6, 1.25, 0xffffff, 0xf0f4ff, 0xd0d8ff),
      form('GOHAN BESTIA', 38, 'goku_b', rowAnim(2, true), 3.5, 1.35, 0xd8b8ff, 0xc89aff, 0xe0d0ff)
    ]
  },
  {
    id: 'freezer', name: 'FREEZER', role: 'Tirano · Rayos mortales', cost: 8000, provisional: true,
    hp: 95, ki: 120, spd: 1.05, dmg: 1.15, start: ['deathbeam'], unique: ['deathbeam', 'deathsaucer', 'deathball'],
    passive: { name: 'Emperador del Universo', desc: '+25% de Zeni y monedas en cada partida.' },
    portrait: { sheet: 'shade', frame: 0, tint: 0xf4ecff },
    forms: [
      form('FORMA FINAL', 1, 'shade', A_STD, 1.0, 1.0, 0xd88aff, 0, 0xf4ecff),
      form('100% DE PODER', 12, 'shade', A_STD, 1.55, 1.12, 0xff8ad8, 0xff7ac8, 0xffd8f0),
      form('GOLDEN FREEZER', 24, 'shade', A_STD, 2.3, 1.22, 0xffd84a, 0xffd23a, 0xffe070),
      form('BLACK FREEZER', 36, 'shade', A_STD, 3.3, 1.32, 0xa080ff, 0x8a6aff, 0x9a90b0)
    ]
  },
  { id: 'krilin', name: 'KRILIN', role: 'Agilidad · Discos', soon: true },
  { id: 'trunks', name: 'TRUNKS', role: 'Espadachín', soon: true },
  { id: 'cell', name: 'CÉLULA', role: 'Absorción', soon: true }
];
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
  bigbang: { name: 'Big Bang Attack', icon: '●', kind: 'bigbang', unique: 'vegeta', minLv: 6, color: 0x8ad0ff, lv: ['Esfera lenta que explota con gran área.', '+35% de daño.', 'Explosión mayor.', 'Recarga reducida.', '+35% de daño y doble esfera.'] },
  scythe: { name: 'Guadaña Divina', icon: '☾', kind: 'scythe', unique: 'black', color: 0xb26bff, lv: ['Tajo en arco frente a ti.', '+40% de daño.', 'Doble tajo.', 'Mayor alcance.', 'Tajo circular completo.'] },
  darkorbs: { name: 'Esferas de Ki Oscuro', icon: '◍', kind: 'orbit', unique: 'black', minLv: 3, color: 0xb26bff, lv: ['Esferas oscuras orbitan a tu alrededor.', '+1 esfera.', 'Mayor daño.', '+1 esfera y más radio.', 'Giran más rápido y dañan más.'] },

  /* ----- Técnicas de la TIENDA: se compran con monedas y entonces pueden salir al subir de nivel ----- */
  genkidama: { name: 'Genkidama', icon: '☀', kind: 'genki', unique: 'goku', shop: 4000, minLv: 6, color: 0x9fe8ff, lv: ['Reúne energía del cielo y deja caer una esfera gigante.', '+50% de daño.', 'Área mayor.', 'Recarga reducida.', 'Genkidama definitiva: daño y área máximos.'] },
  kaioken: { name: 'Kaio-ken', icon: '♨', kind: 'kaioken', unique: 'goku', shop: 1500, minLv: 4, color: 0xff3030, lv: ['Durante unos segundos: +40% de daño y +20% de velocidad.', 'Dura más.', '+10% de daño extra.', 'Recarga reducida.', 'Kaio-ken x20: dura mucho más y +20% de daño.'] },
  finalflash: { name: 'Final Flash', icon: '✷', kind: 'bigbeam', unique: 'vegeta', shop: 3500, minLv: 6, color: 0xffe14a, cfg: { cd: 11, dmg: 16, len: 42, hw: 3.2, life: 1.3, cost: 25 }, lv: ['Descarga masiva de ki amarillo en línea recta.', '+40% de daño.', 'Rayo más largo y ancho.', 'Recarga reducida.', 'Final Flash definitivo.'] },
  finalexp: { name: 'Explosión Final', icon: '☢', kind: 'selfblast', unique: 'vegeta', shop: 3000, minLv: 8, color: 0xff8a3a, lv: ['Explotas con enorme área, pero pierdes un 12% de vida.', '+50% de daño.', 'Área mayor.', 'Recarga reducida.', 'Explosión devastadora.'] },
  judgement: { name: 'Juicio Divino', icon: '⚡', kind: 'bigbeam', unique: 'black', shop: 3500, minLv: 6, color: 0xff7ac8, cfg: { cd: 10, dmg: 14, len: 38, hw: 2.6, life: 1.2, cost: 20 }, lv: ['Rayo rosado de justicia divina.', '+40% de daño.', 'Rayo más largo y ancho.', 'Recarga reducida.', 'Juicio definitivo.'] },
  kienzan: { name: 'Kienzan', icon: '◌', kind: 'discs', shop: 2500, minLv: 5, color: 0xffe86a, lv: ['Lanza 3 discos cortantes que atraviesan enemigos.', '+30% de daño.', '+1 disco.', 'Recarga reducida.', '+2 discos y daño máximo.'] },
  makanko: { name: 'Makankosappo', icon: '➶', kind: 'bigbeam', shop: 2800, minLv: 5, color: 0xffa040, cfg: { cd: 6, dmg: 26, len: 36, hw: 0.9, life: 0.35, cost: 15 }, lv: ['Rayo en espiral que perfora todo.', '+40% de daño.', 'Rayo más largo.', 'Recarga reducida.', 'Makankosappo definitivo.'] },
  kikoho: { name: 'Kikoho', icon: '▲', kind: 'bigbeam', shop: 3200, minLv: 7, color: 0xffd060, cfg: { cd: 9, dmg: 18, len: 34, hw: 2.4, life: 0.9, cost: 0, hpCost: 0.08 }, lv: ['Rayo triangular de enorme daño; cuesta un 8% de vida.', '+40% de daño.', 'Rayo más largo y ancho.', 'Recarga reducida.', 'Kikoho definitivo.'] },
  /* --- Piccolo --- */
  eyebeam: { name: 'Rayos Oculares', icon: '⊙', kind: 'pbolt', unique: 'piccolo', color: 0xffe070, cfg: { cd: 0.75, dmg: 10, len: 20, hw: 0.4 }, lv: ['Rayos rápidos desde los ojos al enemigo más cercano.', '+20% de daño.', '+1 rayo.', 'Atraviesan más lejos.', '+1 rayo y +30% de cadencia.'] },
  hellzone: { name: 'Hellzone Grenade', icon: '❂', kind: 'hellzone', unique: 'piccolo', minLv: 4, color: 0xffd040, lv: ['Rodea a los enemigos de esferas que convergen y explotan.', '+40% de daño.', '+2 esferas.', 'Recarga reducida.', 'Hellzone definitivo: área y daño máximos.'] },
  lightgrenade: { name: 'Light Grenade', icon: '✺', kind: 'bigbang', unique: 'piccolo', minLv: 6, color: 0xffe86a, lv: ['Granada de luz que explota en gran área.', '+35% de daño.', 'Explosión mayor.', 'Recarga reducida.', '+35% de daño y doble granada.'] },
  /* --- Gohan --- */
  gblast: { name: 'Ráfaga de Gohan', icon: '✦', kind: 'bullet', unique: 'gohan', color: 0xbfe4ff, lv: ['Gohan lanza ráfagas de ki al enemigo más cercano.', '+18% de daño.', '+1 proyectil.', 'Las ráfagas atraviesan a 1 enemigo.', '+1 proyectil y +30% de cadencia.'] },
  fsk: { name: 'Kamehameha de Gohan', icon: '≋', kind: 'beam', unique: 'gohan', minLv: 3, color: 0x8fe0ff, lv: ['Rayo azul en línea recta.', '+55% de daño.', 'Rayo más largo y ancho.', 'Recarga reducida.', 'Kamehameha Padre-Hijo: daño y tamaño máximos.'] },
  rage: { name: 'Furia Definitiva', icon: '✸', kind: 'nova', unique: 'gohan', minLv: 6, color: 0xffffff, lv: ['Estallido de ira que empuja y daña a tu alrededor.', '+40% de daño.', 'Mayor radio.', 'Estalla dos veces seguidas.', '+40% de daño y recarga menor.'] },
  /* --- Freezer --- */
  deathbeam: { name: 'Death Beam', icon: '➹', kind: 'pbolt', unique: 'freezer', color: 0xff6ad8, cfg: { cd: 0.6, dmg: 11, len: 26, hw: 0.3 }, lv: ['Rayo mortal finísimo que atraviesa a todos.', '+20% de daño.', '+1 rayo.', 'Mayor alcance.', '+1 rayo y +30% de cadencia.'] },
  deathsaucer: { name: 'Death Saucer', icon: '◌', kind: 'discs', unique: 'freezer', minLv: 3, color: 0xff8ad8, lv: ['Discos de energía que cortan todo a su paso.', '+30% de daño.', '+1 disco.', 'Recarga reducida.', '+2 discos y daño máximo.'] },
  deathball: { name: 'Death Ball', icon: '●', kind: 'genki', unique: 'freezer', minLv: 6, color: 0xff7a3a, lv: ['Una esfera de destrucción cae sobre la horda.', '+50% de daño.', 'Área mayor.', 'Recarga reducida.', 'Death Ball definitiva.'] },
  /* --- FUSIONES: aparecen como carta cuando tienes las dos técnicas al nivel máximo --- */
  kaiokame: { name: 'Kamehameha Kaio-ken', icon: '≋', kind: 'bigbeam', unique: 'goku', fusion: ['kamehameha', 'kaioken'], color: 0xff4a4a, cfg: { cd: 3.2, dmg: 42, len: 44, hw: 2.6, life: 1.0, cost: 8 }, lv: ['Fusión: un Kamehameha rojo multiplicado por el Kaio-ken.'] },
  finalshine: { name: 'Final Shine Attack', icon: '✷', kind: 'bigbeam', unique: 'vegeta', fusion: ['galick', 'bigbang'], color: 0x7aff5a, cfg: { cd: 3.4, dmg: 44, len: 44, hw: 2.8, life: 1.0, cost: 8 }, lv: ['Fusión: el cañón verde definitivo del príncipe.'] },
  godslash: { name: 'Guadaña de la Ira Divina', icon: '☾', kind: 'godslash', unique: 'black', fusion: ['scythe', 'darkorbs'], color: 0xff5ac0, lv: ['Fusión: doble tajo circular rosado de gran alcance.'] },
  makankodef: { name: 'Makankosappo Definitivo', icon: '➶', kind: 'bigbeam', unique: 'piccolo', fusion: ['eyebeam', 'makanko'], color: 0xffa040, cfg: { cd: 2.6, dmg: 50, len: 48, hw: 1.3, life: 0.45, cost: 6 }, lv: ['Fusión: un Makankosappo que lo perfora todo, casi sin recarga.'] },
  masenkame: { name: 'Masenko-Kamehameha', icon: '≋', kind: 'bigbeam', unique: 'gohan', fusion: ['fsk', 'masenko'], color: 0xffd860, cfg: { cd: 3.0, dmg: 46, len: 46, hw: 2.7, life: 1.0, cost: 8 }, lv: ['Fusión: lo mejor de Piccolo y de Goku en un solo rayo.'] },
  supernova: { name: 'Supernova', icon: '☀', kind: 'genki', unique: 'freezer', fusion: ['deathbeam', 'deathball'], color: 0xff5a2a, cfg: { r: 20, dmg: 260, cd: 14 }, lv: ['Fusión: un sol en miniatura que arrasa con todo.'] },
  kiplanet: { name: 'Planeta de Ki', icon: '◉', kind: 'kiplanet', fusion: ['orbit', 'nova'], color: 0x9fe8ff, lv: ['Fusión: 6 esferas en órbita que estallan en pulsos de energía.'] },
  meteorstorm: { name: 'Tormenta de Meteoros', icon: '☄', kind: 'rain', fusion: ['rain', 'mines'], color: 0xff9a3a, mul: { n: 2, dmg: 1.8, cd: 0.7 }, lv: ['Fusión: el cielo entero cae sobre tus enemigos.'] }
};
const MAX_WEAPON_LEVEL = 5, MAX_WEAPONS = 6;

/* ---------- Vitaminas (mejoras pasivas) ---------- */
const STATS = [
  { id: 'dmg', name: 'Gravedad x10', icon: '⬆', max: 5, text: '+12% de daño.', apply: (p) => { p.statDmg += 0.12; } },
  { id: 'hp', name: 'Corazón Saiyajin', icon: '♥', max: 5, text: '+25 de vida máxima y curas 25.', apply: (p) => { p.maxHp += 25; p.hp += 25; } },
  { id: 'spd', name: 'Vuelo Veloz', icon: '»', max: 5, text: '+8% de velocidad.', apply: (p) => { p.speedMul += 0.08; } },
  { id: 'mag', name: 'Imán de Orbes', icon: '⌖', max: 5, text: '+35% de alcance del imán.', apply: (p) => { p.magnet *= 1.35; } },
  { id: 'rate', name: 'Reflejos de Combate', icon: '⏱', max: 5, text: '+10% de cadencia de ataque.', apply: (p) => { p.rateMul += 0.1; } },
  { id: 'crit', name: 'Instinto Letal', icon: '✚', max: 5, text: '+6% de probabilidad de crítico.', apply: (p) => { p.crit += 0.06; } },
  { id: 'senzu', name: 'Semilla Senzu', icon: '❖', max: 5, text: 'Regeneras 0,6 de vida por segundo.', apply: (p) => { p.regen += 0.6; } },
  { id: 'ki', name: 'Cápsula de Ki', icon: '⚡', max: 5, text: '+25 de Ki máximo y +1,5 Ki/s.', apply: (p) => { p.maxKi += 25; p.kiRegen += 1.5; } },
  { id: 'armor', name: 'Gi de Entrenamiento', icon: '▣', max: 5, text: 'Recibes un 7% menos de daño.', apply: (p) => { p.armor = Math.min(0.5, p.armor + 0.07); } }
];

/* ---------- Enemigos (todos usan la hoja "shade": se diferencian por tinte, tamaño y stats) ---------- */
const ENEMY_TYPES = [
  { name: 'Sombra', hp: 1, spd: 1, scale: 1, tint: 0xffffff, dmg: 1, xp: 1, r: 0.7, cash: 1 },
  { name: 'Veloz', hp: 0.55, spd: 1.75, scale: 0.82, tint: 0x7fe0ff, dmg: 0.7, xp: 1.2, r: 0.6, cash: 1.5 },
  { name: 'Bruto', hp: 3.2, spd: 0.72, scale: 1.5, tint: 0xff9a7a, dmg: 1.6, xp: 3, r: 1.05, cash: 4, knock: 14, smash: true },
  { name: 'JEFE', hp: 1, spd: 0.62, scale: 2.7, tint: 0xd070ff, dmg: 2.4, xp: 30, r: 1.8, cash: 200, knock: 20, smash: true },
  { name: 'Élite', hp: 8, spd: 0.95, scale: 1.9, tint: 0xffc83a, dmg: 2, xp: 14, r: 1.3, cash: 30, knock: 10, smash: true }
];


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
  { id: 'shenron', icon: '☯', name: 'Escama de Shenron', rarity: 5, text: '+15% de esquiva, curas 0,8 por enemigo, +25% de daño y velocidad.', apply: (p) => { p.dodge = Math.min(0.5, p.dodge + 0.15); p.killHeal += 0.8; p.statDmg += 0.25; p.speedMul += 0.25; } }
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

/* ---------- Mapas de la partida: Tierra -> Namekusei -> Dimensión fracturada (jefe final) ---------- */
const STAGES = [
  { name: 'TIERRA · YERMO', theme: 0, R: 220, hp: 1, dmg: 1, spawn: 1, pois: true, boss: { name: 'FREEZER', tint: 0xd8b8ff, scale: 3.1, hp: 3500, r: 1.9 } },
  { name: 'NAMEKUSEI', theme: 1, R: 220, hp: 1.8, dmg: 1.35, spawn: 1.2, pois: true, boss: { name: 'CÉLULA PERFECTO', tint: 0x8aff70, scale: 3.5, hp: 9000, r: 2.1 } },
  { name: 'DIMENSIÓN FRACTURADA', theme: 2, R: 62, hp: 2.6, dmg: 1.7, spawn: 0, pois: false, final: true, boss: { name: 'ZAMASU FUSIONADO', tint: 0xff6fbd, scale: 4.4, hp: 24000, r: 2.6 } }
];
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
  { id: 'revive', name: 'Esfera de Reserva', desc: 'Revives una vez por partida con el 50% de vida', max: 1, cost: 3000 }
];
const labCost = (l, lvl) => Math.round(l.cost * (1 + lvl * 0.8));


/* ---------- Dificultades: sobrevive hasta el objetivo para ganar ---------- */
const DIFFS = [
  { id: 'easy', name: 'FÁCIL', hp: 0.75, dmg: 0.7, spawn: 0.8, coins: 1, reward: 250, color: '#5be07a' },
  { id: 'normal', name: 'NORMAL', hp: 1, dmg: 1, spawn: 1, coins: 1.5, reward: 600, color: '#ffd84a' },
  { id: 'hard', name: 'DIFÍCIL', hp: 1.6, dmg: 1.4, spawn: 1.3, coins: 2.5, reward: 1500, color: '#ff4d5e' }
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
  { id: 'a_s3', icon: '◆', name: 'Dimensión fracturada', desc: 'Llega al mapa final', stat: 'maxStage', goal: 3, reward: 800, max: true },
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
  { id: 'a_wish3', icon: '🐉', name: 'Amigo de Shenron', desc: 'Pide 3 deseos', stat: 'wishes', goal: 3, reward: 900 }
];
const todayStr = () => { const t = new Date(); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };

/* ---------- Guardado local ---------- */
const Save = {
  d: { zeni: 0, unlocked: ['goku'], sel: 'goku', up: {}, best: {}, items: [], techs: [], stats: {}, claimed: {}, clears: {}, diff: 'easy', daily: null, login: { last: '', streak: 0 }, ach: {}, vol: { mus: 0.5, sfx: 0.75 } },
  load() { try { const s = JSON.parse(localStorage.getItem('dbus_save_v1')); if (s) Object.assign(this.d, s); } catch (e) { /* sin guardado */ } },
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
