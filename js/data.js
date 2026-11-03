'use strict';
/* =====================================================================
   data.js · Todo el contenido del juego como DATOS (fácil de ampliar):
   animaciones, personajes y transformaciones, armas, vitaminas,
   enemigos, mejoras del laboratorio y guardado local.
   ===================================================================== */

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
  { id: 'piccolo', name: 'PICCOLO', role: 'Control de masas', soon: true },
  { id: 'krilin', name: 'KRILIN', role: 'Agilidad · Discos', soon: true },
  { id: 'gohan', name: 'GOHAN', role: 'Potencial oculto', soon: true },
  { id: 'trunks', name: 'TRUNKS', role: 'Espadachín', soon: true },
  { id: 'freezer', name: 'FREEZER', role: 'Tirano', soon: true },
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
  darkorbs: { name: 'Esferas de Ki Oscuro', icon: '◍', kind: 'orbit', unique: 'black', minLv: 3, color: 0xb26bff, lv: ['Esferas oscuras orbitan a tu alrededor.', '+1 esfera.', 'Mayor daño.', '+1 esfera y más radio.', 'Giran más rápido y dañan más.'] }
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
  { name: 'Sombra', hp: 1, spd: 1, scale: 1, tint: 0xffffff, dmg: 1, xp: 1, r: 0.7 },
  { name: 'Veloz', hp: 0.55, spd: 1.75, scale: 0.82, tint: 0x7fe0ff, dmg: 0.7, xp: 1.2, r: 0.6 },
  { name: 'Bruto', hp: 3.2, spd: 0.72, scale: 1.5, tint: 0xff9a7a, dmg: 1.6, xp: 3, r: 1.05 },
  { name: 'JEFE', hp: 1, spd: 0.62, scale: 2.7, tint: 0xd070ff, dmg: 2.4, xp: 30, r: 1.8 }
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
  { id: 'aureola', icon: '◯', name: 'Aureola de Kaiō', rarity: 4, text: 'Revives una vez y recibes un 10% menos de daño.', apply: (p) => { p.canRevive = true; p.armor = Math.min(0.6, p.armor + 0.1); } },
  { id: 'armadura', icon: '⛨', name: 'Armadura Saiyajin Reforzada', rarity: 4, text: '+15% de armadura, +80 de vida y +2 de vida/s.', apply: (p) => { p.armor = Math.min(0.6, p.armor + 0.15); hp(p, 80); p.regen += 2; } },

  { id: 'zenkai', icon: '⚔', name: 'Zenkai Infinito', rarity: 5, text: '+60% de daño y +30% de cadencia.', apply: (p) => { p.statDmg += 0.6; p.rateMul += 0.3; } },
  { id: 'arbol', icon: '✿', name: 'Fruto del Árbol del Poder', rarity: 5, text: '+50% de daño, +30% de experiencia, +100 de vida y +3 de vida/s.', apply: (p) => { p.statDmg += 0.5; p.xpMul += 0.3; hp(p, 100); p.regen += 3; } },
  { id: 'shenron', icon: '☯', name: 'Escama de Shenron', rarity: 5, text: '+15% de esquiva, curas 0,8 por enemigo, +25% de daño y velocidad.', apply: (p) => { p.dodge = Math.min(0.5, p.dodge + 0.15); p.killHeal += 0.8; p.statDmg += 0.25; p.speedMul += 0.25; } }
];
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

/* ---------- Guardado local ---------- */
const Save = {
  d: { zeni: 0, unlocked: ['goku'], sel: 'goku', up: {}, best: {}, items: [], techs: [] },
  load() { try { const s = JSON.parse(localStorage.getItem('dbus_save_v1')); if (s) Object.assign(this.d, s); } catch (e) { /* sin guardado */ } },
  write() { try { localStorage.setItem('dbus_save_v1', JSON.stringify(this.d)); } catch (e) { /* almacenamiento no disponible */ } },
  lab(id) { return this.d.up[id] || 0; }
};
