/* =====================================================================
   packdata.js · Personajes nuevos y transformaciones del gachapón
   (sprites del pack de Andrés Gamen Animations, assets/pack.js · tools/make_pack.py)
   Se carga ANTES de data.js; data.js llama a packInstall() en cada punto
   (personajes, técnicas, categorías y ataques) para que todo lo nuevo pase
   por los mismos pasos que lo original.
   ===================================================================== */

/* ---------- Hojas del pack ---------- */
const PACK_SHEETS = ['x_nappa', 'x_tenshin', 'x_roshi', 'x_satan', 'x_uub', 'x_granola', 'x_granola2', 'x_whis', 'x_ginyu', 'x_bulma',
  'g_goku_ssj5', 'g_goku_inf', 'g_vegeta_ego', 'g_gohan_beast', 'g_gogeta_inf', 'g_gogeta_ssj4', 'g_goku_ssj3b', 'g_goku_golden', 'g_goku_rose', 'g_goku_beast',
  'g_vegeta_ssj5', 'g_vegeta_ssj4lb', 'g_gogeta_ssj5', 'g_gogeta_rainbow', 'g_broly_god', 'g_broly_ssj5', 'g_black_rose3', 'g_freezer_black', 'g_jiren_full',
  'g_gohan_berserk', 'g_goku_uispirit', 'g_goku_berserk', 'g_goku_god3', 'g_goku_ssj4lb', 'g_vegeta_ssj3', 'g_gogeta_ssj3', 'g_cooler_metal', 'g_jiren_rage',
  'g_kefla_ssj2', 'g_kefla_ssj3', 'g_caulifla_ssj4', 'g_caulifla_blue', 'g_majin_kid'];

/* ---------- Personajes nuevos ----------
   cost: se compran con monedas · req: se desbloquean al cumplir un reto (gratis) */
const packChar = (o) => {
  const id = o.id, sh = 'x_' + (o.sheet || id), c2 = o.sheet2 ? 'x_' + o.sheet2 : sh, k = o.ki;
  return {
    id, name: o.name, role: o.role, cost: o.cost || 0, req: o.req || null, pack: true,
    hp: o.hp, ki: o.kiMax || 110, spd: o.spd, dmg: 1.0, start: [id + '_1'], unique: [id + '_1', id + '_2', id + '_3', id + '_4'],
    passive: o.passive, ult: o.ult, portrait: { sheet: sh, frame: 0 },
    forms: [
      form('BASE', 1, sh, A_HD, 1.0, 1.0, k, 0, 0xffffff),
      form(o.f2 || 'DESPERTAR', 10, sh, A_HD, 1.4, 1.1, k, k, 0xfff8e8),
      form(o.f3 || 'MODO GUERRERO', 22, c2, A_HD, 1.9, 1.2, k, k, 0xffeedd),
      form(o.f4 || 'PODER MÁXIMO', 34, c2, A_HD, 2.5, 1.3, k, k, 0xffffff)
    ]
  };
};
const PACK_CHARS = () => [
  packChar({ id: 'nappa', name: 'NAPPA', role: 'Saiyajin de élite · Fuerza bruta', cost: 3000, hp: 140, kiMax: 100, spd: 0.92, ki: 0xffd84a,
    passive: { name: 'Coraza Saiyajin', desc: '+12% de armadura.', stat: { armor: 0.12 } },
    ult: { name: 'BREAK CANNON', key: 'Q', cost: 100, type: 'bomb', dmg: 140, r: 20, sty: 'genki', col: 0xffd84a, fx: ['#000', '#fff', '#ffd84a', '#fff', '#ff8a2a'], debuff: { name: 'CANSANCIO', text: '-15% de velocidad durante 6 s', t: 6, spd: 0.15 } } }),
  packChar({ id: 'tenshin', name: 'TENSHINHAN', role: 'Tres ojos · Kikoho', cost: 3500, hp: 105, kiMax: 120, spd: 1.05, ki: 0xfff07a,
    passive: { name: 'Tercer ojo', desc: '+10% de probabilidad de crítico.', stat: { crit: 0.1 } },
    ult: { name: 'KIKOHO', key: 'Q', cost: 100, type: 'storm', dmg: 34, n: 18, fx: ['#000', '#fff', '#fff07a', '#fff', '#ffd84a'], debuff: { name: 'VIDA GASTADA', text: '-20% de velocidad durante 6 s', t: 6, spd: 0.2 } } }),
  packChar({ id: 'roshi', name: 'MAESTRO ROSHI', role: 'Maestro tortuga · Kamehameha', req: { stat: 'runs', goal: 25, text: 'Juega 25 partidas: el maestro quiere ver constancia' }, hp: 95, kiMax: 140, spd: 0.95, ki: 0x7ad0ff, f4: 'MAX POWER',
    passive: { name: 'Sabiduría', desc: '+15% de experiencia.', stat: { xp: 0.15 } },
    ult: { name: 'KAMEHAMEHA MAX', key: 'Q', cost: 100, type: 'beam', dmg: 11, len: 50, hw: 3, life: 1.8, col: 0x7ad0ff, fx: ['#000', '#fff', '#7ad0ff', '#fff', '#5ab8ff'], debuff: { name: 'ESPALDA ROTA', text: '-25% de velocidad durante 8 s', t: 8, spd: 0.25 } } }),
  packChar({ id: 'satan', name: 'MR. SATÁN', role: 'Campeón del mundo · Pura fe', req: { stat: 'bosses', goal: 30, text: 'Derrota a 30 jefes (él se llevará el mérito)' }, hp: 120, kiMax: 90, spd: 1.0, ki: 0xffb04a, f2: 'DINAMITA', f3: 'CAMPEÓN', f4: 'HÉROE DEL MUNDO',
    passive: { name: 'Fama mundial', desc: '+25% de monedas.', stat: { gold: 0.25 } },
    ult: { name: 'DYNAMITE KICK', key: 'Q', cost: 100, type: 'slash', dmg: 60, r: 14, fx: ['#000', '#fff', '#ffb04a', '#fff', '#ff6a2a'], debuff: { name: 'TIRÓN', text: '-20% de velocidad durante 6 s', t: 6, spd: 0.2 } } }),
  packChar({ id: 'uub', name: 'UUB', role: 'Reencarnación de Buu · Velocidad', cost: 6000, hp: 110, kiMax: 120, spd: 1.15, ki: 0xffe06a,
    passive: { name: 'Poder de Majin', desc: '+8% de daño y +8% de velocidad.', stat: { dmg: 0.08, spd: 0.08 } },
    ult: { name: 'BOMBA DE UUB', key: 'Q', cost: 100, type: 'bomb', dmg: 150, r: 22, sty: 'genki', col: 0xffe06a, fx: ['#000', '#fff', '#ffe06a', '#fff', '#ff9a2a'], debuff: { name: 'AGOTADO', text: '-20% de velocidad durante 6 s', t: 6, spd: 0.2 } } }),
  packChar({ id: 'granola', name: 'GRANOLA', role: 'Último cereliano · Francotirador', cost: 5500, sheet2: 'granola2', hp: 105, kiMax: 125, spd: 1.05, ki: 0x7affc8, f2: 'OJO CERELIANO', f3: 'DESEO CUMPLIDO', f4: 'GUERRERO MÁS FUERTE',
    passive: { name: 'Ojo derecho', desc: '+20% de daño crítico.', stat: { critDmg: 0.2 } },
    ult: { name: 'DISPARO CERELIANO', key: 'Q', cost: 100, type: 'beam', dmg: 12, len: 56, hw: 2.2, life: 1.4, col: 0x7affc8, fx: ['#000', '#fff', '#7affc8', '#fff', '#4ad8a0'], debuff: { name: 'SOBRECARGA', text: '-20% de velocidad durante 6 s', t: 6, spd: 0.2 } } }),
  packChar({ id: 'whis', name: 'WHIS', role: 'Ángel · Contraataque perfecto', req: { story: 6, text: 'Completa 6 libros del Modo Leyenda' }, hp: 120, kiMax: 160, spd: 1.1, ki: 0xb8e0ff, f2: 'CALMA', f3: 'BÁCULO', f4: 'ÁNGEL',
    passive: { name: 'Instinto angelical', desc: '+12% de esquiva y +1 de vida por segundo.', stat: { dodge: 0.12, regen: 1 } },
    ult: { name: 'REBOBINAR', key: 'Q', cost: 100, type: 'rift', dmg: 70, r: 18, col: 0xb8e0ff, fx: ['#000', '#fff', '#b8e0ff', '#fff', '#8ac8ff'], debuff: { name: 'DESCANSO', text: '-10% de velocidad durante 4 s', t: 4, spd: 0.1 } } }),
  packChar({ id: 'ginyu', name: 'CAPITÁN GINYU', role: 'Fuerzas Especiales · Poses', cost: 4000, hp: 115, kiMax: 110, spd: 1.0, ki: 0xc88aff, f2: 'POSE ESPECIAL', f3: 'FUERZAS GINYU', f4: 'CAMBIO DE CUERPO',
    passive: { name: 'Pose de combate', desc: '+10% de cadencia.', stat: { rate: 0.1 } },
    ult: { name: 'MILKY CANNON', key: 'Q', cost: 100, type: 'beam', dmg: 10, len: 44, hw: 2.8, life: 1.4, col: 0xc88aff, fx: ['#000', '#fff', '#c88aff', '#fff', '#a06aff'], debuff: { name: 'POSE FALLIDA', text: '-15% de velocidad durante 6 s', t: 6, spd: 0.15 } } }),
  packChar({ id: 'bulma', name: 'BULMA', role: 'Genio de Cápsula Corp. · Inventos', req: { stat: 'capsules', goal: 100, text: 'Abre 100 cápsulas en tus partidas' }, hp: 85, kiMax: 120, spd: 1.1, ki: 0x8ad8ff, f2: 'DRAGON RADAR', f3: 'CÁPSULA 1.0', f4: 'GENIO',
    passive: { name: 'Inventora', desc: '+40% de alcance del imán y +10% de experiencia.', stat: { magnet: 0.4, xp: 0.1 } },
    ult: { name: 'CÁPSULA BOMBA', key: 'Q', cost: 100, type: 'bomb', dmg: 130, r: 20, sty: 'genki', col: 0x8ad8ff, fx: ['#000', '#fff', '#8ad8ff', '#fff', '#5ab8ff'], debuff: { name: 'SIN BATERÍA', text: '-20% de velocidad durante 6 s', t: 6, spd: 0.2 } } })
];
const T4 = (id, n, c1, c2, nm) => ({
  [id + '_1']: { name: nm[0], icon: '✦', kind: 'bullet', unique: id, color: c1, lv: [n + ' lanza ráfagas de ki al enemigo más cercano.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  [id + '_2']: { name: nm[1], icon: '✦', kind: 'homing', unique: id, minLv: 3, color: c2, cfg: { n: 4, dmg: 17, cd: 2.1 }, lv: ['Esferas que persiguen a la horda.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  [id + '_3']: { name: nm[2], icon: '✦', kind: 'bigbeam', unique: id, minLv: 6, color: c1, cfg: { cd: 10, dmg: 14, len: 36, hw: 2.6, life: 1.2, cost: 20 }, lv: ['Un rayo potente en línea recta.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  [id + '_4']: { name: nm[3], icon: '✦', kind: 'barrage', unique: id, minLv: 7, color: c2, cfg: { n: 8, dmg: 12, cd: 2.2 }, lv: ['Ráfaga continua de ki.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] }
});
const PACK_WEAPONS = Object.assign({},
  T4('nappa', 'Nappa', 0xffd84a, 0xff9a4a, ['Ráfagas de Nappa', 'Bombas Teledirigidas', 'Break Cannon', 'Lluvia de Élite']),
  T4('tenshin', 'Tenshinhan', 0xfff07a, 0xffd84a, ['Dodonpa', 'Ráfagas de los Tres Ojos', 'Kikoho', 'Ráfaga de las Cuatro Caras']),
  T4('roshi', 'Roshi', 0x7ad0ff, 0xb8e8ff, ['Ráfaga Tortuga', 'Esferas del Maestro', 'Kamehameha Original', 'Lluvia de Ermitaño']),
  T4('satan', 'Mr. Satán', 0xffb04a, 0xffe06a, ['Megatón Punch', 'Bombas Satán', 'Rayo del Campeón', 'Lluvia de Autógrafos']),
  T4('uub', 'Uub', 0xffe06a, 0xff9a4a, ['Ráfagas de Uub', 'Esferas de Majin', 'Kamehameha de Uub', 'Ráfaga de la Isla']),
  T4('granola', 'Granola', 0x7affc8, 0x4ad8a0, ['Disparo Cereliano', 'Balas Rastreadoras', 'Cañón Cereliano', 'Ráfaga de Precisión']),
  T4('whis', 'Whis', 0xb8e0ff, 0xd8c8ff, ['Toque del Báculo', 'Esferas Celestiales', 'Rayo Angelical', 'Lluvia de Estrellas']),
  T4('ginyu', 'Ginyu', 0xc88aff, 0xff8ad8, ['Ráfaga Ginyu', 'Bombas de las Fuerzas', 'Milky Cannon', 'Lluvia Especial']),
  T4('bulma', 'Bulma', 0x8ad8ff, 0xffd84a, ['Pistola de Bulma', 'Drones de Cápsula Corp.', 'Cañón de Cápsula', 'Lluvia de Cápsulas'])
);
const PACK_TECH = {
  nappa_f: ['nappa', 'Embestida de Élite', 'rush', 0xffd84a, { len: 12, n: 4, dmg: 30, cd: 3.2 }, 'Nappa arrolla la horda con la cabeza por delante.'],
  nappa_k: ['nappa', 'Bomb Blast', 'nova', 0xffd84a, { r: 8.5, dmg: 30, cd: 4 }, 'Nappa levanta dos dedos y hace estallar todo alrededor.'],
  tenshin_f: ['tenshin', 'Cuatro Caras', 'whirl', 0xfff07a, { n: 7, r: 3.8, dmg: 3.0, cd: 2.4 }, 'Tenshinhan se divide en cuatro y reparte golpes alrededor.'],
  tenshin_k: ['tenshin', 'Neo Kikoho', 'zshot', 0xfff07a, { n: 1, spd: 16, dmg: 20, cd: 4.2, size: 3.6, look: 'zblastY', aoe: 4.5, life: 1.6 }, 'Un Kikoho que aplasta a la horda contra el suelo.'],
  roshi_f: ['roshi', 'Puño del Ermitaño', 'meteor', 0x7ad0ff, { dmg: 20, cd: 5 }, 'El maestro aparece junto a varios enemigos y los golpea uno tras otro.'],
  roshi_k: ['roshi', 'Mafuba', 'nova', 0x9ae0ff, { r: 8.5, dmg: 28, cd: 4.2 }, 'Una onda que sella a los enemigos de alrededor.'],
  satan_f: ['satan', 'Dynamite Kick', 'rush', 0xffb04a, { len: 12, n: 4, dmg: 26, cd: 3 }, 'Mr. Satán se lanza contra la horda gritando su nombre.'],
  satan_k: ['satan', 'Satan Punch', 'quake', 0xffb04a, { r: 6.5, dmg: 26, cd: 4.6 }, 'Un puñetazo al suelo… que de verdad funciona.'],
  uub_f: ['uub', 'Combo de Uub', 'whirl', 0xffe06a, { n: 7, r: 3.8, dmg: 3.0, cd: 2.3 }, 'Uub gira golpeando a toda velocidad.'],
  uub_k: ['uub', 'Bola de Fuego', 'zshot', 0xffa04a, { n: 3, spd: 22, dmg: 4.5, cd: 2.4, size: 2.2, look: 'zblastY', aoe: 2.5, spread: 0.22 }, 'Tres bolas de ki ardiente que explotan.'],
  granola_f: ['granola', 'Patada Cereliana', 'meteor', 0x7affc8, { dmg: 18, cd: 4.6 }, 'Granola fija varios objetivos y los golpea en un instante.'],
  granola_k: ['granola', 'Disparo Perfecto', 'zshot', 0x7affc8, { n: 1, spd: 34, dmg: 56, cd: 1.8, size: 1.6, look: 'zkiG', pierce: 6, life: 1.2 }, 'Un disparo que atraviesa a todos los enemigos en línea.'],
  whis_f: ['whis', 'Golpe del Báculo', 'scythe', 0xb8e0ff, { cd: 1, r: 5.5, dmg: 14 }, 'Golpes elegantes y rapidísimos con el báculo.'],
  whis_k: ['whis', 'Juicio Angelical', 'thunder', 0xd8e8ff, { n: 4, r: 2.4, dmg: 17, cd: 3 }, 'Rayos de luz caen sobre la horda.'],
  ginyu_f: ['ginyu', 'Carga del Capitán', 'rush', 0xc88aff, { len: 12, n: 4, dmg: 26, cd: 3 }, 'Ginyu carga contra la horda tras su pose.'],
  ginyu_k: ['ginyu', 'Strong Bomber', 'zshot', 0xc88aff, { n: 2, spd: 22, dmg: 8.1, cd: 2.6, size: 2.4, look: 'zkiP', aoe: 3, spread: 0.18 }, 'Dos bombas de ki que explotan al impactar.'],
  bulma_f: ['bulma', 'Escoba Voladora', 'whirl', 0x8ad8ff, { n: 6, r: 3.6, dmg: 2.8, cd: 2.4 }, 'Bulma da vueltas con lo primero que encuentra.'],
  bulma_k: ['bulma', 'Láser de Cápsula', 'pbolt', 0x8ad8ff, { len: 26, dmg: 20, cd: 2.2, hw: 1 }, 'Rayos láser de su último invento.']
};
const PACK_ATK = { nappa: [1.25, 0.95], tenshin: [1.05, 1.15], roshi: [1.0, 1.15], satan: [1.15, 0.9], uub: [1.15, 1.05], granola: [1.0, 1.2], whis: [1.15, 1.2], ginyu: [1.1, 1.05], bulma: [0.9, 1.1] };

/* =====================================================================
   GACHAPÓN DE TRANSFORMACIONES (Cristales del Dragón)
   rare: 3 ULTRA · 2 SPARKING · 1 EXTREME (HERO = premio menor, sin forma)
   ===================================================================== */
const GRARE = [
  { k: 'HERO', name: 'HERO', col: '#4a8aff', glow: '#7ab8ff' },
  { k: 'EXTREME', name: 'EXTREME', col: '#a34dff', glow: '#c88aff' },
  { k: 'SPARKING', name: 'SPARKING', col: '#ffb81c', glow: '#ffe27a' },
  { k: 'ULTRA', name: 'ULTRA', col: '#ff3d7a', glow: '#ffffff' }
];
const GACHA_RATES = [70, 21.5, 7, 1.5];             // % de HERO, EXTREME, SPARKING, ULTRA
const GACHA_COST1 = 100, GACHA_COST10 = 1000, GACHA_PITY = 80, GACHA_STARS = 5;
// [id (hoja g_<id>), personaje, nombre, rareza, color del ki, color del aura]
const GFORMS = [
  ['goku_ssj5', 'goku', 'SUPER SAIYAN 5', 3, 0xf0f4ff, 0xd8e4ff], ['goku_inf', 'goku', 'SUPER SAIYAN INFINITO', 3, 0xffffff, 0xf0f0ff],
  ['vegeta_ego', 'vegeta', 'ULTRA EGO', 3, 0xb070ff, 0x8a3aff], ['gohan_beast', 'gohan', 'GOHAN BESTIA', 3, 0xff4a8a, 0xd8d0ff],
  ['gogeta_inf', 'gogeta', 'SUPER SAIYAN INFINITO', 3, 0xffd84a, 0xffc83a], ['gogeta_ssj4', 'gogeta', 'SUPER SAIYAN 4', 3, 0xff4a4a, 0xff3a2a],
  ['goku_ssj3b', 'goku', 'SUPER SAIYAN 3 BLUE', 2, 0x6fd8ff, 0x4fc8ff], ['goku_golden', 'goku', 'GOLDEN GOKU', 2, 0xffc040, 0xffa020],
  ['goku_rose', 'goku', 'SUPER SAIYAN ROSÉ', 2, 0xff8ad8, 0xff6ac8], ['goku_beast', 'goku', 'GOKU BESTIA', 2, 0xe0e0ff, 0xc8c8ff],
  ['goku_uispirit', 'goku', 'ESPÍRITU DEL INSTINTO', 2, 0x9ac8ff, 0x7ab0ff], ['vegeta_ssj5', 'vegeta', 'SUPER SAIYAN 5', 2, 0xf0f4ff, 0xd8e4ff],
  ['vegeta_ssj4lb', 'vegeta', 'SSJ4 LIMIT BREAKER', 2, 0xff4a4a, 0xff3a2a], ['gogeta_ssj5', 'gogeta', 'SUPER SAIYAN 5', 2, 0xf0f4ff, 0xd8e4ff],
  ['gogeta_rainbow', 'gogeta', 'GOGETA ARCOÍRIS', 2, 0xff8ad8, 0x7ad8ff], ['broly_god', 'broly', 'SUPER SAIYAN DIOS', 2, 0xff4a6a, 0xff2a4a],
  ['broly_ssj5', 'broly', 'SUPER SAIYAN 5', 2, 0xf0f4ff, 0xd8e4ff], ['black_rose3', 'black', 'ROSÉ 3', 2, 0xff7ad8, 0xff5ac8],
  ['freezer_black', 'freezer', 'BLACK FREEZER', 2, 0xb07aff, 0x6a3aff], ['jiren_full', 'jiren', 'PODER TOTAL', 2, 0xff4a4a, 0xff2a2a],
  ['gohan_berserk', 'gohan', 'SSJ BERSERKER', 2, 0x9aff4a, 0x7dff3a],
  ['goku_berserk', 'goku', 'SSJ BERSERKER', 1, 0x9aff4a, 0x7dff3a], ['goku_god3', 'goku', 'SSJ GOD 3', 1, 0xc84aa0, 0xa82a80],
  ['goku_ssj4lb', 'goku', 'SSJ4 LIMIT BREAKER', 1, 0xff4a4a, 0xff3a2a], ['vegeta_ssj3', 'vegeta', 'SUPER SAIYAN 3', 1, 0xffd84a, 0xffc83a],
  ['gogeta_ssj3', 'gogeta', 'SUPER SAIYAN 3', 1, 0xffd84a, 0xffc83a], ['cooler_metal', 'cooler', 'METAL COOLER', 1, 0xd8e8ff, 0xb8c8e8],
  ['jiren_rage', 'jiren', 'FURIA DE JIREN', 1, 0xff4ad8, 0xd02ab8], ['kefla_ssj2', 'kefla', 'SUPER SAIYAN 2', 1, 0x9aff6a, 0x7dff3a],
  ['kefla_ssj3', 'kefla', 'SUPER SAIYAN 3', 1, 0x7affa0, 0x4adf8a], ['caulifla_ssj4', 'caulifla', 'SUPER SAIYAN 4', 1, 0xff4a4a, 0xff2a3a],
  ['caulifla_blue', 'caulifla', 'SUPER SAIYAN BLUE', 1, 0x6fd8ff, 0x4fc8ff], ['majin_kid', 'majin', 'KID BUU', 1, 0xff8ad8, 0xff6ac8]
].map(([id, ch, name, r, ki, aura]) => ({ id, ch, name, r, ki, aura, sheet: 'g_' + id }));
const gformById = (id) => GFORMS.find((g) => g.id === id);

/* ---------- Estandartes: cambian cada 10 días y medio (siempre el mismo para todos) ---------- */
const BANNER_EPOCH = Date.UTC(2026, 10, 2, 0, 0), BANNER_LEN = 10.5 * 864e5;
const BANNERS = [
  { id: 'legend', name: 'LEYENDAS SAIYAJIN', sub: 'El poder más allá de los dioses', feat: ['goku_ssj5', 'vegeta_ego'], col: ['#ff7a12', '#2149d0'], chars: ['goku', 'vegeta'] },
  { id: 'fusion', name: 'FUSIÓN DEFINITIVA', sub: 'Dos guerreros, un solo poder', feat: ['gogeta_inf', 'gogeta_ssj4'], col: ['#ffb81c', '#d81f3c'], chars: ['gogeta', 'broly', 'kefla', 'caulifla'] },
  { id: 'beast', name: 'LA BESTIA DESPIERTA', sub: 'La furia oculta sale a la luz', feat: ['gohan_beast', 'goku_beast'], col: ['#a34dff', '#ff3d7a'], chars: ['gohan', 'goku', 'black', 'freezer', 'majin'] },
  { id: 'infinite', name: 'PODER INFINITO', sub: 'Un cabello sin límites', feat: ['goku_inf', 'broly_ssj5'], col: ['#ffe27a', '#ff7a12'], chars: ['goku', 'broly', 'vegeta', 'jiren', 'cooler'] }
];
/** Estandarte de ahora: índice, datos y milisegundos hasta que cambie */
function bannerNow(t) {
  t = t || Date.now();
  const n = Math.floor((t - BANNER_EPOCH) / BANNER_LEN), i = ((n % BANNERS.length) + BANNERS.length) % BANNERS.length;
  return { n, b: BANNERS[i], left: BANNER_EPOCH + (n + 1) * BANNER_LEN - t };
}
/** Formas que pueden salir en un estandarte (el permanente: todas) */
const bannerPool = (b) => b ? GFORMS.filter((g) => b.chars.includes(g.ch) || b.feat.includes(g.id)) : GFORMS;
const STANDARD_BANNER = { id: 'std', name: 'ESFERAS ETERNAS', sub: 'Todas las transformaciones, siempre disponible', feat: [], col: ['#2fbf4a', '#2149d0'], chars: null };

/* ---------- Guardado del gachapón ---------- */
function packSaveDefaults() {
  const d = Save.d;
  if (typeof d.crystals !== 'number') d.crystals = 1000;                         // regalo de bienvenida: una tirada x10
  if (!d.gforms || typeof d.gforms !== 'object') d.gforms = {};                  // id → estrellas (1..5)
  if (!d.gpity || typeof d.gpity !== 'object') d.gpity = {};                     // por estandarte: tiradas sin ULTRA
  if (typeof d.gpulls !== 'number') d.gpulls = 0;
  if (!d.gsel || typeof d.gsel !== 'object') d.gsel = {};                        // forma del gachapón equipada por personaje (id) o 'none'
}
/** ¿Se puede desbloquear ya un personaje con reto? Devuelve [progreso, meta] */
function reqProgress(c) {
  const r = c.req; if (!r) return null;
  if (r.story) return [Math.min(r.story, typeof storyDone === 'function' ? storyDone() : 0), r.story];
  return [Math.min(r.goal, Math.floor((Save.d.stats && Save.d.stats[r.stat]) || 0)), r.goal];
}

/* ---------- Las formas conseguidas se añaden al final de la cadena de su guerrero ---------- */
const GF_TRAIT = [null,
  { name: 'Poder del deseo', good: '+12% de daño', bad: '-10% de regeneración de Ki', m: { dmg: 0.12, kiRegen: -0.1 } },
  { name: 'Aura chispeante', good: '+18% de daño y +8% de velocidad', bad: 'Gasta 2 de Ki/s sin regenerarlo (carga con C)', m: { dmg: 0.18, spd: 0.08 }, t: { kiDrain: 2 } },
  { name: 'Más allá de los límites', good: '+25% de daño, +10% de velocidad y tu aura quema', bad: 'Gasta 3 de Ki/s sin regenerarlo (carga con C)', m: { dmg: 0.25, spd: 0.1 }, t: { aura: 30, kiDrain: 3 } }
];
/** Forma del gachapón equipada ahora mismo en un guerrero (o null) */
const gformEquipped = (chId) => { const c = charById(chId), f = c && c.forms[c.forms.length - 1]; return f && f.gacha ? f.gacha : null; };
function applyGachaForms() {
  for (const c of CHARACTERS) {
    if (!c.baseForms) { c.baseForms = c.forms; c.baseTraits = TRAITS[c.id] ? TRAITS[c.id].slice() : null; }
    // Solo UNA forma del gachapón por guerrero: la equipada (o, si no has elegido, la de más rareza). 'none' = ninguna
    const mine = GFORMS.filter((g) => g.ch === c.id && Save.d.gforms && Save.d.gforms[g.id]).sort((a, b) => b.r - a.r);
    const pick = Save.d.gsel && Save.d.gsel[c.id], eq = pick === 'none' ? null : mine.find((g) => g.id === pick) || mine[0];
    const own = eq ? [eq] : [];
    const last = c.baseForms[c.baseForms.length - 1];
    c.forms = c.baseForms.concat(own.map((g, k) => {
      const st = Save.d.gforms[g.id] || 1, f = form(g.name, Math.min(48, last.lvl + 4 + k * 3), g.sheet, A_HD,
        last.dmg * (1.06 + g.r * 0.06 + k * 0.03) * (1 + 0.04 * (st - 1)), last.spd + 0.02 + g.r * 0.01, g.ki, g.aura, 0xffffff);
      f.gacha = g.id; f.rare = g.r; f.stars = st;
      return f;
    }));
    if (own.length) {
      const base = c.baseTraits || []; while (base.length < c.baseForms.length) base.push(null);
      TRAITS[c.id] = base.concat(own.map((g) => GF_TRAIT[g.r]));
    } else if (c.baseTraits) TRAITS[c.id] = c.baseTraits.slice();
  }
}

/** Instala todo lo del pack en las tablas de data.js (lo llama data.js) */
function packInstall(stage) {
  if (stage === 'chars') { for (const c of PACK_CHARS()) CHARACTERS.push(c); for (const n of PACK_SHEETS) SHEET_NAMES.push(n); }
  if (stage === 'weapons') Object.assign(WEAPONS, PACK_WEAPONS);
  if (stage === 'tech') Object.assign(NEW_TECH, PACK_TECH);
  if (stage === 'atk') Object.assign(CHAR_ATK, PACK_ATK);
}
