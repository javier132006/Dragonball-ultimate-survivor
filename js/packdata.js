/* =====================================================================
   packdata.js · Altar de Shenron: invocaciones con Cristales del Dragón
   Guerreros y transformaciones de los «PACK DE SPRITES V3, V4 y V5»
   (assets/summons.js · tools/make_summons.py). Todos traen animaciones
   de verdad: quieto, andar, golpes, rayo, dash, golpe recibido, caída,
   cargar ki con su aura y un retrato grande.
   Se carga ANTES de data.js; data.js llama a packInstall() en cada punto
   (personajes, técnicas, categorías y ataques).
   ===================================================================== */

/** Animación de una hoja del altar: va en su meta (cada personaje tiene sus propios fotogramas) */
const packAnim = (sh) => { const m = window.SPRITE_DATA && SPRITE_DATA[sh]; return m && m.anim ? Object.assign({}, m.anim) : A_HD; };
const chgFrames = (sh) => { const m = window.SPRITE_DATA && SPRITE_DATA[sh]; return m ? m.cols * m.rows : 0; };

/* ---------- Lo que puede salir en el altar ----------
   char: guerrero nuevo (se desbloquea al invocarlo) · form: transformación extra de un guerrero que ya existe
   [id, tipo, guerrero (forma), nombre, rareza 1 EXTREME · 2 SPARKING · 3 ULTRA, color del ki, color del aura] */
const GUNITS = [
  ['goku_mui', 'form', 'goku', 'ULTRA INSTINTO DOMINADO', 3, 0xdff4ff, 0xb8d8ff],
  ['vegito_ego', 'form', 'vegito', 'VEGETTO EGO SUPERIOR', 3, 0xb070ff, 0x8a3aff],
  ['buu_zamasu', 'form', 'superbuu', 'BUU ABSORBE A ZAMASU', 3, 0xff7ad8, 0xff4ab8],
  ['babyv', 'char', null, 'SUPER BABY', 3, 0xff6ad8, 0xd04aff],
  ['vegito_b3', 'form', 'vegito', 'SUPER SAIYAN BLUE 3', 2, 0x6fd8ff, 0x4fc8ff],
  ['super17', 'form', 'andro17', 'SUPER 17', 2, 0xffe14a, 0x3a8aff],
  ['trunks_dbs', 'form', 'trunks', 'ESPADA DE LA ESPERANZA', 2, 0x8ad8ff, 0x6fc8ff],
  ['bardock_ssjl', 'form', 'bardock', 'SSJ DEL ÚLTIMO COMBATE', 1, 0xffe14a, 0xffc83a],
  ['buu_gordo', 'form', 'majin', 'BUU ENFURECIDO', 1, 0xff9ad0, 0xff6ab8],
  ['kamba', 'char', null, 'KAMBA SSJ4', 2, 0xff3a4a, 0xd01a2a],
  ['andro35', 'char', null, 'SUPER ANDROIDE 35', 2, 0xff5a8a, 0xff3a6a],
  ['gohanf', 'char', null, 'GOHAN DEL FUTURO', 2, 0xffe14a, 0xffc83a],
  ['yamcha', 'char', null, 'YAMCHA', 1, 0xffe07a, 0x7ad0ff],
  ['gohankid', 'char', null, 'GOHAN (NIÑO)', 1, 0x8ad8ff, 0x8ad8ff],
  ['ginyu', 'char', null, 'CAPITÁN GINYU', 1, 0xc88aff, 0xe8f0ff],
  ['dabura', 'char', null, 'DABURA', 1, 0xff6a4a, 0x6a8aff]
].map(([id, kind, ch, name, r, ki, aura]) => ({ id, kind, ch: ch || id, name, r, ki, aura, sheet: 'u_' + id, chg: 'u_' + id + '_chg', face: 'u_' + id + '_pt' }));
const GFORMS = GUNITS;                                     // nombre antiguo (lo usan summon.js y ui.js)
const gformById = (id) => GUNITS.find((g) => g.id === id);
const unitBig = (g) => (window.SPRITE_DATA && SPRITE_DATA['u_' + g.id + '_big'] ? 'u_' + g.id + '_big' : null);
const PACK_SHEETS = [].concat(...GUNITS.map((g) => [g.sheet, g.chg, g.face])).concat(GUNITS.map(unitBig).filter(Boolean));

/* ---------- Guerreros nuevos del altar ---------- */
const sumChar = (o) => {
  const id = o.id, g = gformById(id), sh = g.sheet, k = g.ki, A = packAnim(sh), m = [1, 1, 1.06, 1.12][g.r];
  return {
    id, name: o.name, role: o.role, cost: 0, summon: true, pack: true, chgSheet: g.chg, chgN: chgFrames(g.chg), face: g.face,
    hp: o.hp, ki: o.kiMax || 110, spd: o.spd, dmg: 1.0, start: [id + '_1'], unique: [id + '_1', id + '_2', id + '_3', id + '_4'],
    passive: o.passive, ult: o.ult, portrait: { sheet: sh, frame: A.idle || 0 },
    forms: [
      form(o.f[0], 1, sh, A, 1.0 * m, 1.0, k, 0, 0xffffff),
      form(o.f[1], 10, sh, A, 1.4 * m, 1.1, k, g.aura, 0xffffff),
      form(o.f[2], 22, sh, A, 1.9 * m, 1.2, k, g.aura, 0xffffff),
      form(o.f[3], 34, sh, A, 2.5 * m, 1.3, k, g.aura, 0xffffff)
    ]
  };
};
const DB = (name, text, t, o) => Object.assign({ name, text, t }, o);
const PACK_CHARS = () => [
  sumChar({ id: 'yamcha', name: 'YAMCHA', role: 'Lobo del desierto · Sôkidan', hp: 100, kiMax: 115, spd: 1.12, f: ['BASE', 'COLMILLO DE LOBO', 'NEO COLMILLO', 'LOBO SALVAJE'],
    passive: { name: 'Instinto del lobo', desc: '+10% de probabilidad de crítico y +6% de velocidad.', stat: { crit: 0.1, spd: 0.06 } },
    ult: { name: 'SÔKIDAN', key: 'Q', cost: 100, type: 'bomb', dmg: 135, r: 18, sty: 'genki', col: 0xffe07a, fx: ['#000', '#fff', '#ffe07a', '#fff', '#ff9a2a'], debuff: DB('SIN AIRE', '-20% de velocidad durante 6 s', 6, { spd: 0.2 }) } }),
  sumChar({ id: 'gohankid', name: 'GOHAN (NIÑO)', role: 'Poder oculto · Masenko', hp: 90, kiMax: 135, spd: 1.1, f: ['BASE', 'FURIA', 'PODER OCULTO', 'IRA DESATADA'],
    passive: { name: 'Poder oculto', desc: '+10% de daño y +10% de experiencia.', stat: { dmg: 0.1, xp: 0.1 } },
    ult: { name: 'MASENKO', key: 'Q', cost: 100, type: 'beam', dmg: 10, len: 50, hw: 2.8, life: 1.5, col: 0xfff07a, fx: ['#000', '#fff', '#fff07a', '#8ad8ff', '#fff07a'], debuff: DB('LLANTO', '-20% de daño durante 6 s', 6, { dmg: 0.2 }) } }),
  sumChar({ id: 'ginyu', name: 'CAPITÁN GINYU', role: 'Fuerzas Especiales · Poses', hp: 115, kiMax: 115, spd: 1.0, f: ['BASE', 'POSE ESPECIAL', 'FUERZAS GINYU', 'CAMBIO DE CUERPO'],
    passive: { name: 'Pose de combate', desc: '+10% de cadencia y +8% de armadura.', stat: { rate: 0.1, armor: 0.08 } },
    ult: { name: 'MILKY CANNON', key: 'Q', cost: 100, type: 'beam', dmg: 10, len: 46, hw: 2.8, life: 1.4, col: 0xc88aff, fx: ['#000', '#fff', '#c88aff', '#fff', '#a06aff'], debuff: DB('POSE FALLIDA', '-15% de velocidad durante 6 s', 6, { spd: 0.15 }) } }),
  sumChar({ id: 'dabura', name: 'DABURA', role: 'Rey de los demonios · Espada', hp: 130, kiMax: 120, spd: 0.98, f: ['BASE', 'REY DEMONIO', 'SEÑOR DEL MAKAI', 'EMPERADOR OSCURO'],
    passive: { name: 'Sangre demoníaca', desc: '+10% de armadura y +6% de daño.', stat: { armor: 0.1, dmg: 0.06 } },
    ult: { name: 'LLAMARADA DEL MAKAI', key: 'Q', cost: 100, type: 'beam', dmg: 11, len: 48, hw: 3.2, life: 1.5, col: 0xff7a2a, fx: ['#000', '#fff', '#ff7a2a', '#6a8aff', '#ff4a2a'], debuff: DB('PETRIFICADO', '-25% de velocidad durante 6 s', 6, { spd: 0.25 }) } }),
  sumChar({ id: 'gohanf', name: 'GOHAN DEL FUTURO', role: 'Último guerrero Z · Super Saiyan', hp: 115, kiMax: 130, spd: 1.12, f: ['SUPER SAIYAN', 'ÚLTIMA ESPERANZA', 'GUERRERO SOLITARIO', 'HÉROE DEL FUTURO'],
    passive: { name: 'Superviviente', desc: '+1 de vida por segundo y +8% de daño.', stat: { regen: 1, dmg: 0.08 } },
    ult: { name: 'MASENKO DEFINITIVO', key: 'Q', cost: 100, type: 'beam', dmg: 11, len: 58, hw: 3.2, life: 1.7, col: 0xffe14a, end: 'genkiBoom', fx: ['#000', '#fff', '#ffe14a', '#fff', '#ffc83a'], debuff: DB('HERIDAS', 'recibes un 20% más de daño durante 7 s', 7, { take: 0.2 }) } }),
  sumChar({ id: 'andro35', name: 'SUPER ANDROIDE 35', role: 'Fusión de 17 y 18 · Energía infinita', hp: 120, kiMax: 150, spd: 1.08, f: ['BASE', 'SOBRECARGA', 'NÚCLEO DOBLE', 'ENERGÍA INFINITA'],
    passive: { name: 'Reactor infinito', desc: '+1 de vida por segundo y +8% de cadencia.', stat: { regen: 1, rate: 0.08 } },
    ult: { name: 'RÁFAGA INFINITA', key: 'Q', cost: 100, type: 'storm', dmg: 36, n: 22, r: 30, fx: ['#000', '#fff', '#ff5a8a', '#ffe14a', '#ff3a6a'], debuff: DB('REINICIO', 'el Ki no se regenera durante 7 s', 7, { noki: true }) } }),
  sumChar({ id: 'kamba', name: 'KAMBA', role: 'Saiyajin maligno · SSJ4', hp: 150, kiMax: 120, spd: 0.98, f: ['SUPER SAIYAN 4', 'ENERGÍA MALIGNA', 'FURIA DEMONÍACA', 'SAIYAJIN DEL MAL'],
    passive: { name: 'Energía maligna', desc: '+12% de daño y +8% de armadura.', stat: { dmg: 0.12, armor: 0.08 } },
    ult: { name: 'EXPLOSIÓN MALIGNA', key: 'Q', cost: 100, type: 'bomb', dmg: 160, r: 23, sty: 'db', col: 0xff3a4a, fx: ['#000', '#fff', '#ff3a4a', '#2a0008', '#ff3a4a'], debuff: DB('RESACA MALIGNA', '-20% de velocidad durante 7 s', 7, { spd: 0.2 }) } }),
  sumChar({ id: 'babyv', name: 'SUPER BABY', role: 'Parásito tsufur · Vegeta poseído', hp: 125, kiMax: 145, spd: 1.08, f: ['SUPER BABY 1', 'SUPER BABY 2', 'VENGANZA TSUFUR', 'REY DE LOS TSUFUR'],
    passive: { name: 'Parásito', desc: '+10% de daño y +20% de daño crítico.', stat: { dmg: 0.1, critDmg: 0.2 } },
    ult: { name: 'REVENGE DEATH BALL', key: 'Q', cost: 100, type: 'bomb', dmg: 170, r: 24, sty: 'db', col: 0xd04aff, fx: ['#000', '#fff', '#d04aff', '#ff6ad8', '#2a0040'], debuff: DB('AGOTADO', '-25% de velocidad durante 7 s', 7, { spd: 0.25 }) } })
];
const T4 = (id, n, c1, c2, nm) => ({
  [id + '_1']: { name: nm[0], icon: '✦', kind: 'bullet', unique: id, color: c1, lv: [n + ' lanza ráfagas de ki al enemigo más cercano.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  [id + '_2']: { name: nm[1], icon: '✦', kind: 'homing', unique: id, minLv: 3, color: c2, cfg: { n: 4, dmg: 17, cd: 2.1 }, lv: ['Esferas que persiguen a la horda.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  [id + '_3']: { name: nm[2], icon: '✦', kind: 'bigbeam', unique: id, minLv: 6, color: c1, cfg: { cd: 10, dmg: 14, len: 36, hw: 2.6, life: 1.2, cost: 20 }, lv: ['Un rayo potente en línea recta.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] },
  [id + '_4']: { name: nm[3], icon: '✦', kind: 'barrage', unique: id, minLv: 7, color: c2, cfg: { n: 8, dmg: 12, cd: 2.2 }, lv: ['Ráfaga continua de ki.', '+20% de daño.', '+1 proyectil.', '+25% de daño.', 'Recarga reducida.'] }
});
const PACK_WEAPONS = Object.assign({},
  T4('yamcha', 'Yamcha', 0xffe07a, 0x7ad0ff, ['Ráfaga del Lobo', 'Sôkidan Teledirigido', 'Kamehameha de Yamcha', 'Lluvia del Desierto']),
  T4('gohankid', 'Gohan', 0x8ad8ff, 0xfff07a, ['Ráfagas de Gohan', 'Esferas de Rabia', 'Masenko', 'Lluvia de Masenko']),
  T4('ginyu', 'Ginyu', 0xc88aff, 0xff8ad8, ['Ráfaga Ginyu', 'Bombas de las Fuerzas', 'Milky Cannon', 'Lluvia Especial']),
  T4('dabura', 'Dabura', 0xff6a4a, 0xffb04a, ['Escupitajo de Piedra', 'Bolas de Fuego del Makai', 'Llamarada Demoníaca', 'Lluvia Infernal']),
  T4('gohanf', 'Gohan', 0xffe14a, 0xfff07a, ['Ráfagas del Futuro', 'Esferas de Esperanza', 'Masenko del Futuro', 'Ráfaga Desesperada']),
  T4('andro35', 'El Androide 35', 0xff5a8a, 0xffe14a, ['Láser Doble', 'Minas de Energía', 'Cañón de Fotones', 'Ráfaga Infinita']),
  T4('kamba', 'Kamba', 0xff3a4a, 0xff8a4a, ['Ráfaga Maligna', 'Esferas Rojas', 'Rayo del Mal', 'Tormenta Maligna']),
  T4('babyv', 'Baby', 0xd04aff, 0xff6ad8, ['Ráfaga Tsufur', 'Esferas Parásitas', 'Big Bang Tsufur', 'Lluvia de Venganza'])
);
const PACK_TECH = {
  yamcha_f: ['yamcha', 'Colmillo de Lobo', 'rush', 0xffe07a, { len: 12, n: 4, dmg: 26, cd: 3 }, 'Yamcha se lanza a la horda con una ráfaga de zarpazos.'],
  yamcha_k: ['yamcha', 'Sôkidan', 'zshot', 0xffe07a, { n: 1, spd: 18, dmg: 22, cd: 3.4, size: 2.6, look: 'zblastY', aoe: 4, life: 1.6 }, 'Una bola de ki que Yamcha guía hasta los enemigos.'],
  gohankid_f: ['gohankid', 'Golpe de Furia', 'whirl', 0x8ad8ff, { n: 6, r: 3.6, dmg: 2.8, cd: 2.4 }, 'Gohan estalla de rabia y golpea todo alrededor.'],
  gohankid_k: ['gohankid', 'Masenko', 'pbolt', 0xfff07a, { len: 26, dmg: 22, cd: 2.2, hw: 1.1 }, 'El rayo que le enseñó Piccolo.'],
  ginyu_f: ['ginyu', 'Carga del Capitán', 'rush', 0xc88aff, { len: 12, n: 4, dmg: 26, cd: 3 }, 'Ginyu carga contra la horda tras su pose.'],
  ginyu_k: ['ginyu', 'Strong Bomber', 'zshot', 0xc88aff, { n: 2, spd: 22, dmg: 8.1, cd: 2.6, size: 2.4, look: 'zkiP', aoe: 3, spread: 0.18 }, 'Dos bombas de ki que explotan al impactar.'],
  dabura_f: ['dabura', 'Espada del Makai', 'scythe', 0xff6a4a, { cd: 1.1, r: 5.5, dmg: 15 }, 'Tajos de espada que parten a la horda.'],
  dabura_k: ['dabura', 'Escupitajo Petrificador', 'zshot', 0xd8d0c0, { n: 3, spd: 22, dmg: 4.5, cd: 2.4, size: 2.2, look: 'zblastY', aoe: 2.5, spread: 0.22 }, 'Tres escupitajos que petrifican lo que tocan.'],
  gohanf_f: ['gohanf', 'Combo del Futuro', 'meteor', 0xffe14a, { dmg: 19, cd: 4.6 }, 'Gohan salta de enemigo en enemigo sin descanso.'],
  gohanf_k: ['gohanf', 'Ráfaga Dorada', 'thunder', 0xfff07a, { n: 4, r: 2.4, dmg: 17, cd: 3 }, 'Rayos dorados caen sobre la horda.'],
  andro35_f: ['andro35', 'Barrera Androide', 'nova', 0xff5a8a, { r: 8.5, dmg: 28, cd: 4 }, 'Una barrera de energía que empuja y daña a todos.'],
  andro35_k: ['andro35', 'Láser Infinito', 'pbolt', 0xff5a8a, { len: 30, dmg: 22, cd: 2.2, hw: 1.1 }, 'Un láser que no se agota nunca.'],
  kamba_f: ['kamba', 'Puño Maligno', 'quake', 0xff3a4a, { r: 6.5, dmg: 28, cd: 4.6 }, 'Kamba golpea el suelo con energía maligna.'],
  kamba_k: ['kamba', 'Esfera del Mal', 'zshot', 0xff3a4a, { n: 1, spd: 16, dmg: 22, cd: 4, size: 3.6, look: 'zblastY', aoe: 4.5, life: 1.6 }, 'Una esfera roja que arrasa la zona.'],
  babyv_f: ['babyv', 'Ataque Tsufur', 'whirl', 0xd04aff, { n: 7, r: 3.8, dmg: 3.0, cd: 2.3 }, 'Baby gira golpeando a toda velocidad.'],
  babyv_k: ['babyv', 'Big Bang Tsufur', 'zshot', 0xd04aff, { n: 2, spd: 22, dmg: 8.5, cd: 2.6, size: 2.6, look: 'zkiP', aoe: 3.2, spread: 0.18 }, 'Dos esferas de energía oscura que explotan.']
};
const PACK_ATK = { yamcha: [1.15, 1.0], gohankid: [1.0, 1.15], ginyu: [1.1, 1.05], dabura: [1.2, 1.0], gohanf: [1.1, 1.1], andro35: [1.0, 1.2], kamba: [1.25, 1.0], babyv: [1.05, 1.2] };

/* =====================================================================
   INVOCACIONES (Cristales del Dragón)
   ===================================================================== */
const GRARE = [
  { k: 'HERO', name: 'HERO', col: '#4a8aff', glow: '#7ab8ff' },
  { k: 'EXTREME', name: 'EXTREME', col: '#a34dff', glow: '#c88aff' },
  { k: 'SPARKING', name: 'SPARKING', col: '#ffb81c', glow: '#ffe27a' },
  { k: 'ULTRA', name: 'ULTRA', col: '#ff3d7a', glow: '#ffffff' }
];
const GACHA_RATES = [70, 21.5, 7, 1.5];             // % de HERO, EXTREME, SPARKING, ULTRA
// TEMPORAL para pruebas: cristales al empezar. Para la versión normal: 1000 (una tirada x10)
const CRYSTAL_START = 100000;
const GACHA_COST1 = 100, GACHA_COST10 = 1000, GACHA_PITY = 80, GACHA_STARS = 5;

/* ---------- Estandartes: cambian cada 10 días y medio (siempre el mismo para todos) ---------- */
const BANNER_EPOCH = Date.UTC(2026, 10, 2, 0, 0), BANNER_LEN = 10.5 * 864e5;
const BANNERS = [
  { id: 'ui', name: 'INSTINTO SUPERIOR', sub: 'El cuerpo se mueve solo', feat: ['goku_mui', 'gohanf'], col: ['#5ab8ff', '#2149d0'], units: ['goku_mui', 'gohanf', 'super17', 'yamcha', 'gohankid'] },
  { id: 'fusion', name: 'FUSIÓN DEFINITIVA', sub: 'Dos guerreros, un solo poder', feat: ['vegito_ego', 'vegito_b3'], col: ['#a34dff', '#2149d0'], units: ['vegito_ego', 'vegito_b3', 'andro35', 'ginyu', 'dabura'] },
  { id: 'evil', name: 'AMENAZA TSUFUR', sub: 'El mal vuelve con más fuerza', feat: ['babyv', 'buu_zamasu'], col: ['#ff3d7a', '#5a1a8a'], units: ['babyv', 'buu_zamasu', 'kamba', 'dabura', 'ginyu'] },
  { id: 'ssj4', name: 'FURIA SAIYAJIN', sub: 'La sangre saiyajin hierve', feat: ['kamba', 'goku_mui'], col: ['#d81f3c', '#ff7a12'], units: ['kamba', 'goku_mui', 'gohanf', 'super17', 'yamcha', 'gohankid'] },
  // Nuevos (repiten algunos ULTRA, como cualquier estandarte de gacha)
  { id: 'future', name: 'FUTURO SIN ESPERANZA', sub: 'Los últimos guerreros contra los androides', feat: ['trunks_dbs', 'gohanf'], col: ['#3d9bff', '#2a2f5a'], units: ['trunks_dbs', 'gohanf', 'super17', 'andro35', 'yamcha', 'gohankid', 'goku_mui'] },
  { id: 'buu', name: 'SAGA DE MAJIN BUU', sub: 'El mago Babidi despierta al monstruo', feat: ['buu_zamasu', 'buu_gordo'], col: ['#ff7ac8', '#5a1a8a'], units: ['buu_zamasu', 'buu_gordo', 'dabura', 'gohankid', 'vegito_b3', 'ginyu'] },
  { id: 'pride', name: 'ORGULLO SAIYAJIN', sub: 'Padre e hijo, la misma sangre guerrera', feat: ['bardock_ssjl', 'goku_mui'], col: ['#ffb81c', '#2a8a3a'], units: ['bardock_ssjl', 'goku_mui', 'kamba', 'gohanf', 'trunks_dbs', 'yamcha'] },
  { id: 'gt', name: 'AMENAZA DE GT', sub: 'Baby y Super 17 contra la Tierra', feat: ['babyv', 'super17'], col: ['#c04dff', '#1a3a7a'], units: ['babyv', 'super17', 'kamba', 'andro35', 'ginyu', 'buu_gordo'] },
  { id: 'legends', name: 'LEYENDAS DEL ALTAR', sub: 'Vuelven todos los ULTRA a la vez', feat: ['vegito_ego', 'goku_mui', 'babyv'], col: ['#ff3d7a', '#ffb81c'], units: ['vegito_ego', 'goku_mui', 'babyv', 'buu_zamasu', 'vegito_b3', 'trunks_dbs', 'kamba', 'bardock_ssjl', 'dabura'] }
];
/** Estandarte de ahora: índice, datos y milisegundos hasta que cambie */
function bannerNow(t) {
  t = t || Date.now();
  const n = Math.floor((t - BANNER_EPOCH) / BANNER_LEN), i = ((n % BANNERS.length) + BANNERS.length) % BANNERS.length;
  return { n, b: BANNERS[i], left: BANNER_EPOCH + (n + 1) * BANNER_LEN - t };
}
/** Lo que puede salir en un estandarte (el permanente: todo) */
const bannerPool = (b) => b && b.units ? GUNITS.filter((g) => b.units.includes(g.id)) : GUNITS;
const STANDARD_BANNER = { id: 'std', name: 'ESFERAS ETERNAS', sub: 'Todos los guerreros y transformaciones, siempre', feat: [], col: ['#2fbf4a', '#2149d0'], units: null };

/* ---------- Guardado ---------- */
// Lo que había antes en el altar (sprites de una sola pose) y ya no existe: se devuelve lo gastado
const OLD_BUY = { nappa: 3000, tenshin: 3500, uub: 6000, granola: 5500, ginyu: 4000 }, OLD_REQ = ['roshi', 'satan', 'whis', 'bulma'];
function packSaveDefaults() {
  const d = Save.d;
  if (typeof d.crystals !== 'number') d.crystals = CRYSTAL_START;                // regalo de bienvenida
  if (CRYSTAL_START >= 100000 && !d.gtest) { d.gtest = 1; d.crystals = Math.max(d.crystals, CRYSTAL_START); }   // TEMPORAL (pruebas): todos empiezan con 100.000
  if (!d.gforms || typeof d.gforms !== 'object') d.gforms = {};                  // id → estrellas (1..5)
  if (!d.gpity || typeof d.gpity !== 'object') d.gpity = {};                     // por estandarte: tiradas sin ULTRA
  if (typeof d.gpulls !== 'number') d.gpulls = 0;
  if (!d.gsel || typeof d.gsel !== 'object') d.gsel = {};                        // forma del altar equipada por guerrero (id) o 'none'
  if (!d.gv2) {                                                                  // cambio de altar (v2): fuera lo antiguo, se devuelve lo gastado
    let zeni = 0, cry = 0;
    const un = Array.isArray(d.unlocked) ? d.unlocked : (d.unlocked = []);
    for (const id in OLD_BUY) if (un.includes(id)) zeni += OLD_BUY[id];
    d.unlocked = un.filter((id) => !(id in OLD_BUY) && !OLD_REQ.includes(id));
    for (const id in d.gforms) if (!gformById(id)) { cry += 150 * d.gforms[id]; delete d.gforms[id]; }
    if (d.sel && !d.unlocked.includes(d.sel)) d.sel = 'goku';
    d.gsel = {}; d.gpity = {};
    d.zeni = (d.zeni || 0) + zeni; d.crystals += cry; d.gv2 = 1;
    if (zeni || cry) d.gmig = { zeni, cry };                                      // aviso en el altar
  }
}
/** ¿Se puede desbloquear ya un personaje con reto? Devuelve [progreso, meta] */
function reqProgress(c) {
  const r = c.req; if (!r) return null;
  if (r.story) return [Math.min(r.story, typeof storyDone === 'function' ? storyDone() : 0), r.story];
  return [Math.min(r.goal, Math.floor((Save.d.stats && Save.d.stats[r.stat]) || 0)), r.goal];
}

/* ---------- Las transformaciones conseguidas se añaden al final de la cadena de su guerrero ---------- */
const GF_TRAIT = [null,
  { name: 'Poder del deseo', good: '+12% de daño', bad: '-10% de regeneración de Ki', m: { dmg: 0.12, kiRegen: -0.1 } },
  { name: 'Aura chispeante', good: '+18% de daño y +8% de velocidad', bad: 'Gasta 2 de Ki/s sin regenerarlo (carga con C)', m: { dmg: 0.18, spd: 0.08 }, t: { kiDrain: 2 } },
  { name: 'Más allá de los límites', good: '+25% de daño, +10% de velocidad y tu aura quema', bad: 'Gasta 3 de Ki/s sin regenerarlo (carga con C)', m: { dmg: 0.25, spd: 0.1 }, t: { aura: 30, kiDrain: 3 } }
];
/** Forma del altar equipada ahora mismo en un guerrero (o null) */
const gformEquipped = (chId) => { const c = charById(chId), f = c && c.forms[c.forms.length - 1]; return f && f.gacha ? f.gacha : null; };
function applyGachaForms() {
  for (const c of CHARACTERS) {
    if (!c.baseForms) { c.baseForms = c.forms; c.baseTraits = TRAITS[c.id] ? TRAITS[c.id].slice() : null; }
    // Guerrero del altar: cada estrella (repetido) le da +4% de daño
    const cst = c.summon ? (Save.d.gforms[c.id] || 1) : 1, sm = 1 + 0.04 * (cst - 1);
    const base = sm === 1 ? c.baseForms : c.baseForms.map((f) => Object.assign({}, f, { dmg: f.dmg * sm }));
    // Solo UNA transformación del altar por guerrero: la equipada (o, si no has elegido, la de más rareza). 'none' = ninguna
    const mine = GUNITS.filter((g) => g.kind === 'form' && g.ch === c.id && Save.d.gforms && Save.d.gforms[g.id]).sort((a, b) => b.r - a.r);
    const pick = Save.d.gsel && Save.d.gsel[c.id], eq = pick === 'none' ? null : mine.find((g) => g.id === pick) || mine[0];
    const own = eq ? [eq] : [];
    const last = base[base.length - 1];
    c.forms = base.concat(own.map((g, k) => {
      const st = Save.d.gforms[g.id] || 1, f = form(g.name, Math.min(48, last.lvl + 4 + k * 3), g.sheet, packAnim(g.sheet),
        last.dmg * (1.06 + g.r * 0.06 + k * 0.03) * (1 + 0.04 * (st - 1)), last.spd + 0.02 + g.r * 0.01, g.ki, g.aura, 0xffffff);
      f.gacha = g.id; f.rare = g.r; f.stars = st; f.chgS = g.chg; f.chgN = chgFrames(g.chg); f.face = g.face;
      return f;
    }));
    if (own.length) {
      const bt = c.baseTraits || []; while (bt.length < c.baseForms.length) bt.push(null);
      TRAITS[c.id] = bt.concat(own.map((g) => GF_TRAIT[g.r]));
    } else if (c.baseTraits) TRAITS[c.id] = c.baseTraits.slice();
  }
}

/** Instala todo lo del altar en las tablas de data.js (lo llama data.js) */
function packInstall(stage) {
  if (stage === 'chars') { for (const c of PACK_CHARS()) CHARACTERS.push(c); for (const n of PACK_SHEETS) SHEET_NAMES.push(n); }
  if (stage === 'weapons') Object.assign(WEAPONS, PACK_WEAPONS);
  if (stage === 'tech') Object.assign(NEW_TECH, PACK_TECH);
  if (stage === 'atk') Object.assign(CHAR_ATK, PACK_ATK);
}
