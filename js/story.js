'use strict';
/* =====================================================================
   story.js · MODO HISTORIA (Modo Leyenda): 10 libros (sagas) con capítulos.
   Cada capítulo: personaje, mapa, objetivo, rival y diálogos. Al acabar todos
   los capítulos de un libro se completa y se abre el siguiente.
   ---------------------------------------------------------------------
   goal.type:
     'kills'   derrota N enemigos            'survive' aguanta N segundos
     'balls'   reúne N esferas del dragón    'hunt'    derrota N enemigos del tipo t (aparecen poco a poco)
     'level'   llega al nivel N              'boss'    el rival aparece nada más empezar
     'hold'    el rival aparece y hay que aguantar N segundos (o vencerlo)
     'tourney' gana el Torneo de las Artes Marciales (3 combates en el ring)
   boss: clave de BOSSES o un luchador creado con fighter() (usa las hojas del personaje).
   Diálogos: [quién, texto]; «quién» es un id de personaje o de TALK_NPC.
   ===================================================================== */

/* Personajes que hablan pero no se juegan (sin retrato: llevan un emblema) */
const TALK_NPC = {
  narr: { name: 'NARRADOR', ico: '✦' }, kaio: { name: 'KAIOSAMA', ico: '☯' }, bulma: { name: 'BULMA', ico: '⚙' }, nappa: { name: 'NAPPA', ico: '✊' },
  ginyu: { name: 'CAPITÁN GINYU', ico: '★' }, satan: { name: 'MR. SATAN', ico: '♛' }, babidi: { name: 'BABIDI', ico: 'M' }, whis: { name: 'WHIS', ico: '✧' },
  shenron: { name: 'SHENRON', ico: '🐉' }, kami: { name: 'KAMI', ico: '☯' }, champa: { name: 'CHAMPA', ico: '✧' }, zeno: { name: 'ZENO', ico: '♔' },
  paragus: { name: 'PARAGUS', ico: '✊' }, buu: { name: 'KID BUU', ico: '☠' }
};

/* Luchador como rival: usa las hojas de un personaje jugable (una por fase) */
const FIGHTER_ANIM = { walk: [1, 2, 1, 0], hit: 8, atk: 5, cast: 10, stun: 8 };
function fighter(ch, o) {
  const C = charById(ch), fm = o.fm || [0, 0, 0];
  const B = Object.assign({ name: C.name, row: 0, anim: FIGHTER_ANIM, fighter: ch, scale: 1.3, r: 1.5, tintSprite: false,
    forms: fm.map((i) => C.forms[i].name), tints: fm.map((i) => C.forms[i].ki || 0xffe14a) }, o);
  B.sheet = C.forms[fm[0]].sheet; B.sheets = fm.map((i) => C.forms[i].sheet); B.col = B.col || B.tints[0];
  delete B.fm;
  return B;
}
const FIGHTERS = {
  f_vegeta: fighter('vegeta', { fm: [0, 0, 0], forms: ['PRÍNCIPE SAIYAJIN', 'ORGULLO HERIDO', 'FURIA DEL PRÍNCIPE'], tints: [0x6fa8ff, 0x9ab8ff, 0xd070ff],
    moves: 'Ráfaga de ki · Galick Ho · Lluvia de energía · Embestida', names: { fan: 'RÁFAGA DE KI', beam: '¡GALICK HO!', rain: 'LLUVIA DE ENERGÍA', dash: 'EMBESTIDA' },
    pat: [['fan', 'dash'], ['fan', 'dash', 'beam'], ['fan', 'dash', 'beam', 'rain']] }),
  f_saibaman: fighter('saibaman', { fm: [0, 0, 0], name: 'SAIBAMAN ÉLITE', forms: ['SEMILLA', 'ÁCIDO', '¡KAMIKAZE!'], tints: [0x9aff4a, 0xc8ff4a, 0xffe14a], scale: 1.2,
    moves: 'Ácido · Embestida · Autodestrucción', names: { fan: 'ESCUPE ÁCIDO', dash: 'SALTO', selfdestruct: '¡SE LANZA A EXPLOTAR! ¡ALÉJATE!' },
    pat: [['fan'], ['fan', 'dash'], ['fan', 'dash', 'selfdestruct']] }),
  f_andro18: fighter('andro18', { fm: [0, 0, 0], forms: ['ANDROIDE 18', 'SIN LÍMITE', 'ENERGÍA INFINITA'], tints: [0x7ad8ff, 0x9ae8ff, 0xffffff],
    moves: 'Ráfaga · Disco de energía · Lluvia de ki', names: { fan: 'RÁFAGA DEL 18', saucer: 'DISCO DE ENERGÍA', rain: 'LLUVIA DE KI', dash: 'PATADA VOLADORA' },
    pat: [['fan', 'dash'], ['fan', 'dash', 'saucer'], ['fan', 'dash', 'saucer', 'rain']] }),
  f_andro17: fighter('andro17', { fm: [0, 0, 0], forms: ['ANDROIDE 17', 'BARRERA', 'PODER ILIMITADO'], tints: [0x7aff9a, 0x9affc8, 0xffffff],
    moves: 'Ráfaga · Barrera · Rayo · Onda', names: { fan: 'RÁFAGA DEL 17', barrier: 'BARRERA DEL 17', beam: 'RAYO DEL 17', ring: 'ONDA EXPANSIVA', dash: 'EMBESTIDA' },
    pat: [['fan', 'dash'], ['fan', 'barrier', 'dash'], ['fan', 'barrier', 'beam', 'ring']] }),
  f_cell: fighter('cell', { fm: [0, 1, 2], name: 'CÉLULA', tints: [0x9aff4a, 0x7ad8ff, 0xffe14a],
    moves: 'Ráfaga · Embestida · Regeneración · Kamehameha · Barrera perfecta', names: { fan: 'RAYO DE LOS DEDOS', regen: '¡SE REGENERA!', kame: '¡KAMEHAMEHA DE CÉLULA!', barrier: 'BARRERA PERFECTA', dash: 'EMBESTIDA' },
    pat: [['fan', 'dash'], ['fan', 'dash', 'regen'], ['fan', 'kame', 'barrier', 'dash']] }),
  f_goku: fighter('goku', { fm: [2, 2, 3], forms: ['SUPER SAIYAN', 'SUPER SAIYAN', 'SUPER SAIYAN 2'], tints: [0xffe14a, 0xffe14a, 0xfff07a],
    moves: 'Ráfaga · Kamehameha · Lluvia de ki · Embestida', names: { fan: 'RÁFAGA DE KI', kame: 'KA-ME-HA-ME-HA', rain: 'LLUVIA DE KI', dash: 'EMBESTIDA' },
    pat: [['fan', 'dash'], ['fan', 'dash', 'kame'], ['fan', 'kame', 'rain', 'dash']] }),
  f_majin: fighter('majin', { fm: [0, 0, 0], name: 'MAJIN BUU', forms: ['¡BUU, BUU!', 'BUU SE ENFADA', 'BUU FURIOSO'], tints: [0xff7ad0, 0xff9ae0, 0xff4ab0], scale: 1.4,
    moves: 'Ráfaga · Rayo de caramelo · Kamehameha de Buu · Grito', names: { fan: 'RÁFAGA DE BUU' },
    pat: [['fan', 'candy'], ['fan', 'candy', 'majinkame'], ['candy', 'majinkame', 'scream', 'regen']] }),
  f_freezer_n: fighter('freezer', { fm: [0, 1, 2], forms: ['PRIMERA FORMA', 'TERCERA FORMA', 'FORMA FINAL'], tints: [0xff7ad8, 0xc87aff, 0xff9ae0],
    moves: 'Rayo mortal · Disco mortal · Embestida', pat: [['deathbeam', 'dash'], ['deathbeam', 'saucer', 'dash'], ['deathbeam', 'saucer', 'fan', 'dash']] }),
  f_freezer_nk: fighter('freezer', { fm: [2, 3, 3], forms: ['FORMA FINAL', 'PODER AL 100%', '¡FURIA DEL TIRANO!'], tints: [0xff7ad8, 0xff9ae0, 0xff4ab0],
    moves: 'Rayo mortal · Disco mortal · Supernova · Embestida', pat: [['deathbeam', 'dash'], ['deathbeam', 'saucer', 'dash'], ['deathbeam', 'saucer', 'supernova', 'dash']] }),
  f_freezer: fighter('freezer', { fm: [2, 3, 4], forms: ['FORMA FINAL', 'PODER AL 100%', 'GOLDEN FREEZER'], tints: [0xff7ad8, 0xff9ae0, 0xffd84a],
    moves: 'Rayo mortal · Disco mortal · Supernova · Embestida', pat: [['deathbeam', 'dash'], ['deathbeam', 'saucer', 'dash'], ['deathbeam', 'saucer', 'supernova', 'dash']] }),
  f_zamasu: fighter('zamasu', { fm: [0, 0, 0], forms: ['KAIOSHIN APRENDIZ', 'JUSTICIA DIVINA', 'CUERPO INMORTAL'], tints: [0x9aff9a, 0xffe0f0, 0xff6ac8],
    moves: 'Ráfaga · Hojas del juicio · Rayos de la absolución · Ira divina', names: { fan: 'RÁFAGA DIVINA', dash: 'CUCHILLA DE LUZ' },
    pat: [['fan', 'dash'], ['fan', 'blades', 'dash'], ['fan', 'blades', 'lightning', 'wrath']] }),
  f_kale: fighter('kale', { fm: [0, 0, 0], forms: ['SUPER SAIYAN', 'BERSERKER', 'LEGENDARIA'], tints: [0x9aff4a, 0x7dff5a, 0x4aff3a],
    moves: 'Ráfaga · Embestida gigante · Grito · Cañón Eraser', names: { fan: 'RÁFAGA DE KALE', eraser: 'CAÑÓN DE KALE', roar: 'ALARIDO BERSERKER' },
    pat: [['fan', 'rush'], ['fan', 'rush', 'roar'], ['eraser', 'rush', 'roar', 'fan']] }),
  f_kefla: fighter('kefla', { fm: [0, 0, 0], forms: ['KEFLA', 'SUPER SAIYAN', 'SUPER SAIYAN 2'], tints: [0xff8ad8, 0xffe14a, 0xfff07a],
    moves: 'Ráfaga · Teletransporte · Rayo · Lluvia · Onda', names: { fan: 'GIGANTIC RAY', beam: 'RAYO DE KEFLA', blink: 'TELETRANSPORTE', rain: 'LLUVIA DE KI', ring: 'ONDA DE PODER' },
    pat: [['fan', 'dash', 'blink'], ['fan', 'dash', 'blink', 'beam'], ['fan', 'beam', 'blink', 'rain', 'ring']] }),
  f_broly: fighter('broly', { fm: [0, 0, 1], name: 'BROLY', forms: ['SAIYAJIN SALVAJE', 'IRA CONTENIDA', 'SUPER SAIYAN'], tints: [0x9aff6a, 0x7dff5a, 0xffe14a], scale: 1.45,
    moves: 'Embestida gigante · Cañón Eraser · Grito legendario', pat: [['rush', 'fan'], ['rush', 'eraser', 'fan'], ['rush', 'eraser', 'roar', 'meteor']] })
};
/** Jefe de un capítulo (con nombre o color cambiados si el capítulo lo pide) */
function chapBoss(C) {
  const B = typeof C.boss === 'string' ? (FIGHTERS[C.boss] || BOSSES[C.boss]) : C.boss;
  if (!B || (!C.bossName && !C.bossForms)) return B;
  return Object.assign({}, B, C.bossName ? { name: C.bossName } : {}, C.bossForms ? { forms: C.bossForms } : {});
}

/* ---------- LOS 10 LIBROS ---------- */
const BOOKS = [
  { id: 'saiyan', name: 'SAGA SAIYAJIN', sub: 'El origen de los guerreros del espacio', col: '#ff8a2a', col2: '#ffcf4a', cover: ['goku', 'vegeta'], prize: 'raditz',
    desc: 'Goku descubre que es un saiyajin enviado para conquistar la Tierra. Su hermano Raditz es solo el principio: el príncipe Vegeta viene en camino.',
    chapters: [
      { name: 'La llegada de Raditz', ch: 'goku', stage: 7, lvl: 1, boss: 'raditz', hp: 0.55,
        goal: { type: 'kills', n: 90, text: 'Derrota a 90 enemigos para que Raditz aparezca' },
        story: 'Una nave cae cerca de la Isla Kame. Un guerrero con cola dice ser el hermano de Goku.',
        intro: [['narr', 'Cinco años después del Torneo de las Artes Marciales, la paz reina en la Tierra…'], ['goku', '¡Hola a todos! ¿Habéis visto qué grande está Gohan?'], ['raditz', 'Así que aquí te escondías, Kakarotto. Soy Raditz, tu hermano mayor.'], ['goku', '¿Mi hermano? ¡Yo me llamo Goku! Y no voy a dejar que hagas daño a nadie.']],
        bossTalk: [['raditz', 'Mis soldados no han podido contigo… Lo haré yo mismo.'], ['goku', '¡Prepárate, Raditz!']],
        win: [['goku', 'Uf… era muy fuerte. Dijo que vendrían otros dos saiyajin todavía más poderosos.'], ['narr', 'La Tierra tiene un año para prepararse.']] },
      { name: 'Un año en el más allá', ch: 'goku', stage: 6, lvl: 3,
        goal: { type: 'survive', n: 100, text: 'Recorre el Camino de la Serpiente: aguanta 1:40' },
        story: 'Goku entrena en el otro mundo con Kaiosama. Antes debe recorrer el larguísimo Camino de la Serpiente.',
        intro: [['kaio', '¡Eh, tú! Si quieres que te entrene, primero cruza el Camino de la Serpiente.'], ['goku', '¡Allá voy! Aunque… esto está lleno de demonios.']],
        win: [['kaio', 'No está mal. Te enseñaré el Kaioken y la Genkidama.'], ['goku', '¡Bien! ¡Vegeta, ya puedes venir!']] },
      { name: 'Los Saibaimen', ch: 'krilin', stage: 0, lvl: 2, boss: 'f_saibaman', hp: 0.45,
        goal: { type: 'kills', n: 130, text: 'Derrota a 130 Saibaimen' },
        story: 'Nappa planta semillas en el yermo y de ellas brotan los Saibaimen. Krilin y sus amigos resisten mientras llega Goku.',
        intro: [['nappa', '¡Ja, ja! Plantemos unos Saibaimen para divertirnos.'], ['krilin', 'Son pequeños pero muy peligrosos… ¡Cuidado con sus explosiones!']],
        bossTalk: [['krilin', 'Ese es más grande que los demás… ¡No dejaré que explote cerca de mí!']],
        win: [['krilin', '¡Lo hemos conseguido! Goku, date prisa…']] },
      { name: 'La furia de Nappa', ch: 'piccolo', stage: 0, lvl: 5,
        goal: { type: 'hunt', t: 2, n: 5, every: 7, hp: 2.5, text: 'Derrota a 5 guerreros de Nappa' },
        story: 'Nappa destroza todo a su paso. Piccolo debe proteger a Gohan hasta que llegue Goku.',
        intro: [['nappa', '¿Os escondéis? ¡Os encontraré a todos!'], ['piccolo', 'Gohan, quédate detrás de mí. Yo me encargo.']],
        win: [['goku', '¡Siento llegar tarde! Descansa, Piccolo. Ahora me toca a mí.'], ['piccolo', 'Hmph… ya era hora.']] },
      { name: 'Goku contra Vegeta', ch: 'goku', stage: 0, lvl: 6, boss: 'f_vegeta', hp: 0.75,
        goal: { type: 'boss', text: 'Derrota al príncipe Vegeta' },
        story: 'El príncipe de los saiyajin y el guerrero criado en la Tierra se enfrentan en un duelo legendario.',
        intro: [['vegeta', 'Así que tú eres Kakarotto. Un saiyajin de clase baja que se atreve a desafiarme.'], ['goku', 'Puede que sea de clase baja… ¡pero gracias al esfuerzo un guerrero puede superar a la élite!'], ['vegeta', '¡Te borraré de este planeta junto con tus amigos!']],
        win: [['vegeta', 'Imposible… ¿Un guerrero de clase baja?… Esto no ha terminado, Kakarotto.'], ['goku', 'Déjalo marchar, Krilin. Algún día volveremos a luchar.']] }
    ] },
  { id: 'freezer', name: 'SAGA DE FREEZER', sub: 'El tirano del universo', col: '#9a5cff', col2: '#ff7ad8', cover: ['goku', 'freezer'], prize: 'freezer',
    desc: 'En el planeta Namek esperan unas esferas del dragón capaces de devolver la vida a los amigos de Goku. Pero el emperador Freezer también las quiere.',
    chapters: [
      { name: 'Rumbo a Namek', ch: 'krilin', stage: 1, lvl: 4,
        goal: { type: 'balls', n: 3, text: 'Encuentra 3 esferas del dragón de Namek' },
        story: 'Krilin y Gohan aterrizan en Namek y buscan las esferas antes que los soldados de Freezer.',
        intro: [['bulma', 'El radar dice que hay esferas cerca. ¡Id a por ellas, que yo me quedo en la nave!'], ['krilin', 'Este planeta está lleno de soldados de Freezer… Habrá que ir con cuidado.']],
        win: [['krilin', '¡Tres esferas! Si Goku estuviera aquí…']] },
      { name: 'La rebelión de Vegeta', ch: 'vegeta', stage: 1, lvl: 7,
        goal: { type: 'kills', n: 220, text: 'Derrota a 220 soldados de Freezer' },
        story: 'Vegeta traiciona a Freezer y arrasa con su ejército para quedarse con las esferas y la inmortalidad.',
        intro: [['vegeta', 'Freezer quiere la inmortalidad… Antes la tendré yo.'], ['vegeta', 'Soldados de pacotilla. ¡Apartaos de mi camino!']],
        win: [['vegeta', 'Je, je. Ni siquiera me he despeinado.']] },
      { name: 'Las Fuerzas Especiales Ginyu', ch: 'goku', stage: 1, lvl: 8,
        goal: { type: 'hunt', t: 4, n: 5, every: 6, hp: 2.2, text: 'Derrota a las 5 Fuerzas Especiales Ginyu' },
        story: 'Goku llega por fin a Namek, más fuerte que nunca tras entrenar con una gravedad cien veces mayor.',
        intro: [['ginyu', '¡Fuerzas Especiales Ginyu, en posición!'], ['goku', 'Chicos, descansad. Yo me encargo de estos señores tan raros.']],
        win: [['ginyu', '¡No puede ser! ¡Nuestras poses eran perfectas!'], ['goku', 'Ahora solo queda Freezer.']] },
      { name: 'Piccolo contra Freezer', ch: 'piccolo', stage: 1, lvl: 11, boss: 'f_freezer_n', hp: 0.9,
        goal: { type: 'hold', n: 100, text: 'Aguanta 1:40 contra Freezer hasta que llegue Goku' },
        story: 'Fusionado con Nail, Piccolo planta cara al tirano para ganar tiempo.',
        intro: [['freezer', '¿Un namekiano? Qué entretenido. Veamos cuánto aguantas.'], ['piccolo', 'Me he fusionado con Nail. Ya no soy el de antes, Freezer.']],
        win: [['piccolo', 'Aguanta un poco más, Goku… ya casi estás aquí.']] },
      { name: 'El Super Saiyajin legendario', ch: 'goku', stage: 1, lvl: 10, boss: 'f_freezer_nk', hp: 1.1,
        goal: { type: 'boss', text: 'Derrota a Freezer en el planeta Namek' },
        story: 'Freezer acaba con Krilin delante de Goku. La rabia despierta el poder de la leyenda: el Super Saiyajin.',
        intro: [['freezer', 'Ese amigo tuyo explotó tan bonito… ¿Quieres ser el siguiente?'], ['goku', '¡KRILIN!… Freezer… ¡NO TE LO PERDONARÉ!'], ['narr', 'Los cabellos de Goku se vuelven dorados. Ha nacido el Super Saiyajin.'], ['goku', 'Pulsa [G] cuando esté listo… ¡Soy el guerrero que tanto temías!']],
        win: [['goku', 'Se acabó, Freezer. Ya no harás daño a nadie más.'], ['narr', 'Namek explota, pero Goku consigue escapar a tiempo.']] }
    ] },
  { id: 'android', name: 'SAGA DE LOS ANDROIDES', sub: 'Un aviso desde el futuro', col: '#22b8a8', col2: '#7ad8ff', cover: ['trunks', 'andro17'], prize: 'andro18',
    desc: 'Un joven del futuro avisa: dentro de tres años, dos androides creados por el Dr. Gero destruirán el mundo.',
    chapters: [
      { name: 'El chico del futuro', ch: 'trunks', stage: 0, lvl: 10, boss: 'freezer', bossName: 'MECHA FREEZER', bossForms: ['CÍBORG', 'REPARADO', 'SOBRECARGA'], hp: 0.6,
        goal: { type: 'kills', n: 140, text: 'Derrota a 140 soldados del Rey Cold' },
        story: 'Freezer vuelve reconstruido como un cíborg. Un misterioso chico de pelo lila lo espera con su espada.',
        intro: [['freezer', 'He vuelto, monos. Esta vez acabaré con la Tierra entera.'], ['trunks', 'No lo creo. Tu viaje termina aquí.']],
        bossTalk: [['freezer', '¿Quién eres tú? ¿Otro Super Saiyajin?'], ['trunks', 'Alguien que viene a cambiar el futuro.']],
        win: [['trunks', 'Goku… dentro de tres años aparecerán dos androides. Tenéis que estar preparados.']] },
      { name: 'La amenaza del Androide 16', ch: 'piccolo', stage: 7, lvl: 12, boss: 'a16', hp: 0.6,
        goal: { type: 'kills', n: 180, text: 'Derrota a 180 enemigos en la isla' },
        story: 'Un androide gigante y silencioso aparece en la costa. Su poder es un misterio.',
        intro: [['piccolo', 'Ese androide no estaba en las predicciones de Trunks…'], ['andro16', '…Mi objetivo es Son Goku. Apártate.']],
        win: [['andro16', 'Interesante… Los pájaros siguen cantando.'], ['piccolo', 'Qué tipo más raro.']] },
      { name: 'Los androides 17 y 18', ch: 'vegeta', stage: 0, lvl: 14, boss: 'f_andro18', hp: 0.7,
        goal: { type: 'boss', text: 'Derrota a la Androide 18' },
        story: 'Vegeta, ya Super Saiyajin, se enfrenta a la Androide 18 convencido de su victoria.',
        intro: [['vegeta', 'Yo también soy un Super Saiyajin. Ahora veréis lo que es el poder.'], ['andro18', 'Qué hombre tan presumido. Te romperé ese orgullo.']],
        win: [['andro18', 'Vaya, no lo haces nada mal… para ser un mono.'], ['vegeta', '¡Grr! ¡Esto no ha acabado!']] },
      { name: 'Piccolo y Kami', ch: 'piccolo', stage: 7, lvl: 20, boss: 'f_andro17', hp: 0.75,
        goal: { type: 'survive', n: 60, text: 'Aguanta 1 minuto y luego enfréntate al Androide 17' },
        story: 'Piccolo se fusiona con Kami y alcanza un poder nunca visto para detener al Androide 17.',
        intro: [['kami', 'Piccolo, ha llegado el momento. Volvamos a ser uno.'], ['piccolo', 'Con este poder… ningún androide podrá conmigo.']],
        bossTalk: [['andro17', 'Por fin alguien que me divierte. Vamos a jugar.']],
        win: [['piccolo', 'Es tan fuerte como yo… ¿Qué es esa sombra en el cielo?']] },
      { name: 'El monstruo Cell', ch: 'krilin', stage: 0, lvl: 16, boss: 'f_cell', hp: 0.75,
        goal: { type: 'kills', n: 220, text: 'Derrota a 220 enemigos mientras Cell crece' },
        story: 'Un ser creado con las células de los mejores guerreros quiere absorber a los androides para ser perfecto.',
        intro: [['cell', 'Necesito al Androide 18 para ser perfecto… ¿Me la entregas, enano?'], ['krilin', '¡Ni hablar! ¡No dejaré que te acerques a ella!']],
        bossTalk: [['cell', 'Demasiado tarde… ¡He alcanzado la forma perfecta!']],
        win: [['krilin', 'Lo he retrasado todo lo que he podido… Ahora todo depende de Goku y de Gohan.']] }
    ] },
  { id: 'cell', name: 'SAGA DE CELL', sub: 'Los Juegos de Cell', col: '#22b86f', col2: '#9aff4a', cover: ['gohan', 'cell'], prize: 'cell',
    desc: 'Cell es perfecto y organiza un torneo para decidir el destino de la Tierra. Solo el poder oculto de Gohan puede detenerlo.',
    chapters: [
      { name: 'La Habitación del Tiempo', ch: 'vegeta', stage: 3, lvl: 8,
        goal: { type: 'level', n: 14, text: 'Entrena hasta el nivel 14' },
        story: 'Un año de entrenamiento en un solo día. Vegeta quiere superar al Super Saiyajin.',
        intro: [['vegeta', 'Un año aquí dentro es un día fuera. Saldré siendo el guerrero más fuerte.']],
        win: [['vegeta', 'He superado al Super Saiyajin. ¡Cell, prepárate!']] },
      { name: 'El torneo de Mr. Satan', ch: 'krilin', stage: 0, lvl: 12,
        goal: { type: 'tourney', n: 1, text: 'Gana el Torneo de las Artes Marciales (3 combates)' },
        story: 'Antes de los Juegos de Cell, Krilin calienta en un torneo de exhibición. ¡No salgas del ring!',
        intro: [['satan', '¡Ja, ja, ja! ¡El gran campeón Mr. Satan os da la bienvenida a este torneo!'], ['krilin', 'Unos combates para calentar no me vendrán mal.']],
        win: [['satan', '¡Ha ganado ese calvo bajito!… Bueno, yo le he dejado ganar, claro.']] },
      { name: 'Goku contra Cell', ch: 'goku', stage: 0, lvl: 14, boss: 'cell', hp: 1.2,
        goal: { type: 'hold', n: 120, text: 'Aguanta 2 minutos contra Cell (o derrótalo)' },
        story: 'Goku inaugura los Juegos de Cell. El combate es tan igualado que nadie puede creérselo.',
        intro: [['cell', 'Bienvenido a los Juegos de Cell, Goku. Que empiece el espectáculo.'], ['goku', 'Llevo un año entrenando para esto. ¡Vamos allá!']],
        win: [['goku', 'Me rindo. Pero hay alguien que puede derrotarte… ¡Gohan, te toca!'], ['gohan', '¿Yo, papá?']] },
      { name: 'Los Cell Jr.', ch: 'gohan', stage: 0, lvl: 14,
        goal: { type: 'hunt', t: 9, n: 7, every: 5, hp: 2, text: 'Derrota a los 7 Cell Jr.' },
        story: 'Cell crea siete pequeñas copias que atacan a los amigos de Gohan. La ira de Gohan empieza a despertar.',
        intro: [['cell', 'Mis hijos jugarán con tus amigos. ¿Les dejarás sufrir, Gohan?'], ['gohan', 'Para… por favor… ¡PARA!']],
        win: [['gohan', 'Ya no tengo miedo. Cell… vas a pagar por todo.']] },
      { name: 'Kamehameha padre e hijo', ch: 'gohan', stage: 0, lvl: 20, boss: 'cell', hp: 1.4,
        goal: { type: 'boss', text: 'Derrota a Cell con el poder del Super Saiyajin 2' },
        story: 'Convertido en Super Saiyajin 2, Gohan se enfrenta a Cell en el combate que decidirá el destino de la Tierra.',
        intro: [['narr', 'Una descarga de energía recorre el cuerpo de Gohan: ha despertado el Super Saiyajin 2.'], ['gohan', 'Se acabó, Cell. Tu juego termina hoy.'], ['cell', '¡Ja! ¡Te arrastraré conmigo aunque tenga que hacer explotar la Tierra!']],
        win: [['goku', 'Lo has hecho, Gohan. Estoy muy orgulloso de ti.'], ['gohan', 'Papá… lo he conseguido.']] }
    ] },
  { id: 'buu', name: 'SAGA DE BUU', sub: 'El demonio rosa despierta', col: '#ff5aa8', col2: '#ffb0e0', cover: ['gotenks', 'superbuu'], prize: 'majin',
    desc: 'El mago Babidi quiere despertar a Majin Buu, un monstruo que destruyó galaxias enteras. Ni los Super Saiyajin están a salvo.',
    chapters: [
      { name: 'El príncipe vendido', ch: 'vegeta', stage: 0, lvl: 18, boss: 'f_goku', hp: 0.8,
        goal: { type: 'boss', text: 'Derrota a Goku Super Saiyajin 2' },
        story: 'Vegeta deja que Babidi lo controle para recuperar su orgullo de saiyajin y luchar contra Goku.',
        intro: [['babidi', 'Majin Vegeta, ¡destruye a ese Kakarotto!'], ['vegeta', 'No me controla nadie, Babidi. Solo quiero esto… luchar contra ti, Kakarotto.'], ['goku', 'Vegeta… si es lo que quieres, lo haremos.']],
        win: [['vegeta', 'Kakarotto… siempre has sido el número uno. Ahora lo sé.'], ['narr', 'Pero el combate ha liberado energía suficiente para despertar a Majin Buu.']] },
      { name: 'El despertar de Majin Buu', ch: 'gohan', stage: 0, lvl: 16, boss: 'f_majin', hp: 0.8,
        goal: { type: 'kills', n: 200, text: 'Derrota a 200 secuaces de Babidi' },
        story: 'Majin Buu ha despertado. Gohan se abre paso entre los secuaces de Babidi para detenerlo.',
        intro: [['babidi', '¡Buu, despierta! ¡Destruye a todo el que se acerque!'], ['gohan', 'Ese es Majin Buu… parece inofensivo, pero noto un poder enorme.']],
        bossTalk: [['majin', '¡Buu tiene hambre! ¡Buu te va a convertir en chocolate!']],
        win: [['gohan', 'No se cansa nunca… Hay que buscar otra forma de vencerlo.']] },
      { name: 'La fusión de los niños', ch: 'gotenks', stage: 3, lvl: 10,
        goal: { type: 'kills', n: 260, text: 'Entrena: derrota a 260 enemigos en la Cámara del Tiempo' },
        story: 'Goten y Trunks practican la danza de la fusión. ¡Ha nacido Gotenks, el guerrero más presumido del universo!',
        intro: [['gotenks', '¡Fu-sión! ¡Ja! ¡El gran Gotenks ha llegado! ¿Dónde está ese Buu?'], ['piccolo', 'Primero entrena, mocoso. No subestimes a tu enemigo.']],
        win: [['gotenks', '¡Estoy listo! ¡Super Buu no sabe lo que le espera!']] },
      { name: 'Gotenks contra Super Buu', ch: 'gotenks', stage: 3, lvl: 16, boss: 'superbuu', hp: 1,
        goal: { type: 'hold', n: 110, text: 'Aguanta 1:50 contra Super Buu' },
        story: 'Super Buu entra en la Cámara del Tiempo. Gotenks tiene un plan: los fantasmas kamikaze.',
        intro: [['superbuu', 'Je, je… Buu se aburre. ¿Jugamos?'], ['gotenks', '¡Ataque de los fantasmas kamikaze!']],
        win: [['gotenks', '¡Le he dado una paliza!… ¿Eh? ¿Por qué se está riendo?']] },
      { name: 'El guerrero definitivo', ch: 'vegito', stage: 0, lvl: 24, boss: 'superbuu', hp: 1.4,
        goal: { type: 'boss', text: 'Derrota a Super Buu con Vegetto' },
        story: 'Goku y Vegeta usan los pendientes Pothala. El resultado es Vegetto, el guerrero más poderoso.',
        intro: [['vegito', 'Ni Goku ni Vegeta. Soy el que va a derrotarte: Vegetto.'], ['superbuu', '¿Otro más? ¡Buu se lo comerá también!']],
        win: [['vegito', 'Ha sido demasiado fácil. Volvamos a ser dos.'], ['narr', 'Pero del cuerpo de Super Buu escapa su forma original: Kid Buu.']] },
      { name: 'La Genkidama final', ch: 'goku', stage: 4, lvl: 26, boss: 'buu', hp: 1.5,
        goal: { type: 'boss', text: 'Derrota a Kid Buu en el planeta de los Kaioshin' },
        story: 'Kid Buu destruye la Tierra. Goku se enfrenta a él en el planeta sagrado con la energía de todos.',
        intro: [['vegeta', 'Kakarotto, prepara la Genkidama. Yo lo entretendré.'], ['goku', '¡Gente de la Tierra, prestadme vuestra energía!'], ['buu', '¡Aaaah! ¡Buu destruye! ¡Buu destruye!']],
        win: [['goku', 'Espero que vuelvas a nacer como una buena persona… Te esperaré para luchar otra vez.']] }
    ] },
  { id: 'gods', name: 'LA BATALLA DE LOS DIOSES', sub: 'El dios de la destrucción', col: '#7a5cf0', col2: '#c8a8ff', cover: ['goku', 'bills'], prize: 'bills',
    desc: 'Bills, el dios de la destrucción, despierta de su largo sueño buscando al legendario Super Saiyajin Dios.',
    chapters: [
      { name: 'El dios despierta', ch: 'goku', stage: 7, lvl: 22, boss: 'beerus', bossName: 'BILLS', hp: 1.3,
        goal: { type: 'hold', n: 70, text: 'Aguanta 1:10 contra Bills' },
        story: 'Goku, en Super Saiyajin 3, desafía a Bills en el planeta de Kaiosama. Bills ni siquiera se esfuerza.',
        intro: [['bills', '¿Así que tú eres el que derrotó a Freezer? Enséñame lo que sabes.'], ['goku', '¡Super Saiyajin 3! ¡Vamos con todo!']],
        win: [['bills', 'Ha sido divertido. Dormiré un rato… o mejor, iré a la Tierra.'], ['goku', 'Ni siquiera le he tocado…']] },
      { name: 'La fiesta de Bulma', ch: 'vegeta', stage: 7, lvl: 24,
        goal: { type: 'kills', n: 240, text: 'Protege la fiesta: derrota a 240 enemigos' },
        story: 'Bills llega al cumpleaños de Bulma. Vegeta hará lo que sea para que el dios no se enfade.',
        intro: [['bulma', '¡Bienvenidos a mi fiesta! Hay comida para todos.'], ['vegeta', 'Bills está aquí… Si se enfada, destruirá la Tierra. ¡Que nadie estropee esta fiesta!']],
        win: [['vegeta', '¡¿Cómo te atreves a pegar a MI Bulma?!'], ['bills', 'Vaya, vaya… el príncipe tiene genio.']] },
      { name: 'El ritual de los seis saiyajin', ch: 'goku', stage: 0, lvl: 26,
        goal: { type: 'balls', n: 7, text: 'Reúne las 7 esferas para invocar a Shenron' },
        story: 'Para crear un Super Saiyajin Dios hacen falta seis saiyajin de corazón puro… y Shenron sabe cómo.',
        intro: [['goku', 'Si reunimos las siete esferas, Shenron nos dirá cómo ser un dios.']],
        win: [['shenron', 'Seis saiyajin de corazón puro deben unir sus manos y su energía.'], ['goku', 'Puedo sentirlo… ¡Este es el poder de un dios!']] },
      { name: 'Super Saiyajin Dios', ch: 'goku', stage: 7, lvl: 29, boss: 'beerus', bossName: 'BILLS', hp: 1.6,
        goal: { type: 'boss', text: 'Derrota a Bills con el poder del dios' },
        story: 'Con el cabello rojo del Super Saiyajin Dios, Goku lucha contra Bills en un combate que sacude el universo.',
        intro: [['bills', 'Así que este es el Super Saiyajin Dios. Por fin un combate de verdad.'], ['goku', '¡Pulsa [G] cuando esté listo! ¡Voy con todo, Bills!']],
        win: [['bills', 'Me has hecho sudar. No destruiré la Tierra… la comida está demasiado buena.'], ['whis', 'Jo, jo, jo. Qué combate tan bonito.']] },
      { name: 'El asesino del Universo 6', ch: 'goku', stage: 5, lvl: 32, boss: 'hit', hp: 1.5,
        goal: { type: 'boss', text: 'Derrota a Hit en el torneo de Champa' },
        story: 'Champa, el hermano de Bills, desafía al Universo 7. Su mejor luchador es Hit, el asesino que detiene el tiempo.',
        intro: [['champa', '¡Hit, enséñales cómo lucha el Universo 6!'], ['hitto', 'Mi trabajo es terminar rápido.'], ['goku', '¡Super Saiyajin Blue! A ver si puedes parar esto.']],
        win: [['hitto', 'Buen combate. Me has hecho mejorar.'], ['goku', '¡Volveremos a luchar, Hit!']] }
    ] },
  { id: 'fukkatsu', name: 'LA RESURRECCIÓN DE FREEZER', sub: 'El regreso del emperador', col: '#ffb81c', col2: '#fff07a', cover: ['vegeta', 'freezer'], prize: 'cooler',
    desc: 'Los restos del ejército de Freezer reúnen las esferas y lo devuelven a la vida. Cuatro meses de entrenamiento lo han convertido en Golden Freezer.',
    chapters: [
      { name: 'Mil soldados', ch: 'piccolo', stage: 7, lvl: 20,
        goal: { type: 'kills', n: 300, text: 'Derrota a 300 soldados de Freezer' },
        story: 'Mil soldados de Freezer invaden la Tierra. Piccolo, Krilin y Gohan los contienen.',
        intro: [['freezer', 'Que mis soldados se diviertan un poco. Yo esperaré a Goku.'], ['piccolo', 'Hay que aguantar hasta que lleguen Goku y Vegeta.']],
        win: [['piccolo', 'Ya están aquí.']] },
      { name: 'La élite de Freezer', ch: 'gohan', stage: 0, lvl: 22,
        goal: { type: 'hunt', t: 4, n: 6, every: 6, hp: 3, text: 'Derrota a 6 guerreros de élite del ejército' },
        story: 'Tagoma y la élite del ejército ponen en apuros a Gohan, que hace tiempo que no entrena.',
        intro: [['gohan', 'Llevo mucho tiempo sin entrenar… Espero estar a la altura.']],
        win: [['gohan', 'Tengo que volver a entrenar. No puedo depender siempre de papá.']] },
      { name: 'Golden Freezer', ch: 'goku', stage: 0, lvl: 32, boss: 'f_freezer', hp: 1.4,
        goal: { type: 'boss', text: 'Derrota a Freezer en su forma dorada' },
        story: 'Freezer muestra su nueva forma dorada. Goku responde con el Super Saiyajin Blue.',
        intro: [['freezer', 'He entrenado cuatro meses solo para esto. ¡Mira mi nueva forma!'], ['goku', 'Dorado, ¿eh? Pues mira este color: ¡Super Saiyajin Blue!']],
        win: [['freezer', 'No puede ser… otra vez…'], ['vegeta', 'Kakarotto, apártate. Este es mío.']] },
      { name: 'El orgullo del príncipe', ch: 'vegeta', stage: 0, lvl: 34, boss: 'freezer', bossForms: ['GOLDEN FREEZER', 'GOLDEN FREEZER', '¡FURIA DORADA!'], hp: 1.5,
        goal: { type: 'hold', n: 90, text: 'Aguanta 1:30 contra Golden Freezer' },
        story: 'Vegeta exige su revancha contra el tirano que destruyó su planeta.',
        intro: [['vegeta', 'Durante años fui tu esclavo, Freezer. Hoy pagarás por todo.'], ['freezer', '¡Monos! ¡Cuántas veces tendré que acabar con vosotros!']],
        win: [['vegeta', 'Este es el final que merecías.']] },
      { name: 'Cooler, el hermano mayor', ch: 'goku', stage: 1, lvl: 34, boss: 'cooler', hp: 1.5,
        goal: { type: 'kills', n: 200, text: 'Derrota a 200 soldados de Cooler' },
        story: 'Cooler, el hermano mayor de Freezer, quiere vengar el honor de su familia.',
        intro: [['cooler', 'Mi hermano siempre fue un descuidado. Yo no cometeré sus errores.'], ['goku', 'Otro de la familia… ¿Es que nunca se acaban?']],
        bossTalk: [['cooler', 'Te mostraré la forma que Freezer nunca alcanzó.']],
        win: [['goku', 'Por fin se acabó. Esta familia da mucho trabajo.']] }
    ] },
  { id: 'black', name: 'SAGA DE GOKU BLACK', sub: 'El futuro sin esperanza', col: '#ff4a9a', col2: '#ffb0d8', cover: ['trunks', 'black'], prize: 'black',
    desc: 'En el futuro de Trunks, un ser con la cara de Goku extermina a la humanidad. Detrás está Zamasu, un dios que odia a los mortales.',
    chapters: [
      { name: 'Un futuro en ruinas', ch: 'trunks', stage: 0, lvl: 24,
        goal: { type: 'survive', n: 110, text: 'Sobrevive 1:50 entre las ruinas' },
        story: 'Trunks huye de Goku Black por un mundo destruido. Necesita aguantar hasta poder viajar al pasado.',
        intro: [['trunks', 'Ese hombre tiene la cara del señor Goku… pero su corazón es pura maldad.']],
        win: [['trunks', 'La máquina del tiempo está lista. Tengo que pedir ayuda.']] },
      { name: 'Goku Black', ch: 'goku', stage: 0, lvl: 32, boss: 'black', hp: 1.3,
        goal: { type: 'boss', text: 'Derrota a Goku Black' },
        story: 'Goku viaja al futuro y se enfrenta a su doble malvado.',
        intro: [['black', 'Son Goku… Este cuerpo es magnífico. Gracias por prestármelo.'], ['goku', 'No sé quién eres, pero no vas a usar mi cara para hacer daño.']],
        win: [['black', 'Esto no ha terminado… Zamasu y yo somos uno.']] },
      { name: 'La justicia de Zamasu', ch: 'vegeta', stage: 4, lvl: 33, boss: 'f_zamasu', hp: 1.1,
        goal: { type: 'kills', n: 160, text: 'Derrota a 160 enemigos y enfréntate a Zamasu' },
        story: 'Zamasu revela su plan: un mundo sin mortales. Vegeta no piensa tolerarlo.',
        intro: [['zamasu', 'Los mortales solo traen guerra. Los dioses limpiaremos el universo.'], ['vegeta', 'Mucho hablar para alguien que se esconde detrás de la cara de otro.']],
        bossTalk: [['zamasu', 'Mi cuerpo es inmortal. Tus golpes no significan nada.']],
        win: [['vegeta', 'Puede que sea inmortal, pero no invencible.']] },
      { name: 'La fusión divina', ch: 'vegito', stage: 4, lvl: 34, boss: 'zamasu', hp: 1.4,
        goal: { type: 'hold', n: 100, text: 'Aguanta 1:40 contra Zamasu fusionado' },
        story: 'Black y Zamasu se fusionan. Goku y Vegeta responden con los pendientes Pothala: ¡Vegetto Blue!',
        intro: [['zamasuf', 'Contemplad la belleza de un dios perfecto.'], ['vegito', 'Bonito discurso. Ahora te toca escuchar a mis puños.']],
        win: [['vegito', 'Se acaba el tiempo de la fusión… Trunks, ¡ahora!']] },
      { name: 'La espada de la esperanza', ch: 'trunksarm', stage: 4, lvl: 36, boss: 'zamasu', hp: 1.15,
        goal: { type: 'boss', text: 'Derrota a Zamasu fusionado' },
        story: 'Trunks reúne la energía de toda la humanidad en su espada para el golpe final.',
        intro: [['trunks', '¡Toda la gente de este mundo me ha dado su energía! ¡Esta es la espada de la esperanza!'], ['zamasuf', '¿Un mortal… desafiando a un dios?']],
        win: [['trunks', 'Se acabó, Zamasu. Este futuro vuelve a ser nuestro.']] }
    ] },
  { id: 'poder', name: 'TORNEO DEL PODER', sub: 'La supervivencia de los universos', col: '#2a7ae8', col2: '#7ab8ff', cover: ['goku', 'jiren'], prize: 'jiren',
    desc: 'Zeno organiza un torneo entre ocho universos. Los que pierdan serán borrados. El Universo 7 lucha por sobrevivir.',
    chapters: [
      { name: 'Comienza el torneo', ch: 'goku', stage: 5, lvl: 32,
        goal: { type: 'survive', n: 100, text: 'Aguanta 1:40 sin caer del ring' },
        story: 'Ochenta guerreros en un ring gigante. Quien caiga queda eliminado.',
        intro: [['zeno', '¡Que empiece el torneo!'], ['goku', '¡Esto es increíble! ¡Los guerreros más fuertes de todos los universos!']],
        win: [['goku', 'Hay mucha gente fuerte… ¡Me encanta!']] },
      { name: 'La berserker', ch: 'goku', stage: 5, lvl: 33, boss: 'f_kale', hp: 1.2,
        goal: { type: 'boss', text: 'Derrota a Kale, la Super Saiyajin legendaria' },
        story: 'La tímida Kale del Universo 6 pierde el control y desata un poder legendario.',
        intro: [['caulifla', '¡Kale, tú puedes! ¡Demuéstrale de qué estás hecha!'], ['kale', 'Yo… ¡yo también quiero ser fuerte!']],
        win: [['kale', 'Lo siento… no podía controlarlo.'], ['goku', '¡Tienes un poder increíble, Kale!']] },
      { name: 'Kefla', ch: 'goku', stage: 5, lvl: 38, boss: 'f_kefla', hp: 1.4,
        goal: { type: 'boss', text: 'Derrota a Kefla' },
        story: 'Caulifla y Kale usan los pendientes Pothala. Goku despierta la Señal del Ultra Instinto.',
        intro: [['kefla', 'Caulifla y Kale ya no existen. ¡Soy Kefla, y te voy a sacar del ring!'], ['goku', 'Mi cuerpo… se mueve solo.']],
        win: [['kefla', 'No puede ser… ¡Volveré a ganarte!'], ['goku', '¡Te estaré esperando!']] },
      { name: 'El orgullo de Toppo', ch: 'vegeta', stage: 5, lvl: 34, boss: 'toppo', hp: 1.05,
        goal: { type: 'boss', text: 'Derrota a Toppo, el dios de la destrucción en prácticas' },
        story: 'Toppo abandona la justicia y abraza el poder de la destrucción. Vegeta lo desafía con su nueva forma.',
        intro: [['toppo', 'He renunciado a la justicia. Ahora soy un dios de la destrucción.'], ['vegeta', 'Yo tengo algo más importante: el orgullo de un saiyajin.']],
        win: [['vegeta', 'Kakarotto, te toca. Termina con Jiren.']] },
      { name: 'Jiren el Gris', ch: 'goku', stage: 5, lvl: 41, boss: 'jiren', hp: 1.7,
        goal: { type: 'boss', text: 'Derrota a Jiren con el Ultra Instinto' },
        story: 'El último combate del torneo. Goku domina por fin el Ultra Instinto.',
        intro: [['jiren', 'La fuerza lo es todo. La confianza en los demás es una debilidad.'], ['goku', 'Te equivocas, Jiren. Yo he llegado hasta aquí gracias a todos.'], ['narr', 'Su cabello se vuelve plateado. Es el Ultra Instinto.']],
        win: [['jiren', 'Confianza… quizá estaba equivocado.'], ['zeno', '¡Gana el Universo 7!']] }
    ] },
  { id: 'broly', name: 'BROLY', sub: 'El Super Saiyajin legendario', col: '#3fd06a', col2: '#c8ff7a', cover: ['gogeta', 'broly'], prize: 'broly',
    desc: 'Hace cuarenta años, el rey Vegeta desterró a un bebé por tener demasiado poder. Ese bebé ha vuelto.',
    chapters: [
      { name: 'El planeta Vegeta', ch: 'bardock', stage: 2, lvl: 12,
        goal: { type: 'kills', n: 220, text: 'Derrota a 220 soldados de Freezer' },
        story: 'Bardock descubre que Freezer va a destruir el planeta Vegeta y se rebela solo contra su ejército.',
        intro: [['bardock', 'Freezer quiere acabar con todos los saiyajin. ¡No pienso quedarme quieto!']],
        win: [['bardock', 'Ahí está… Freezer.']] },
      { name: 'La rebelión de Bardock', ch: 'bardock', stage: 2, lvl: 14, boss: 'f_freezer_n', hp: 1,
        goal: { type: 'hold', n: 80, text: 'Aguanta 1:20 contra Freezer' },
        story: 'Un saiyajin de clase baja contra el emperador. Bardock lanza todo lo que tiene.',
        intro: [['freezer', '¿Un mono rebelde? Qué divertido.'], ['bardock', '¡Este golpe es por todos los saiyajin! ¡Kakarotto, vive!']],
        win: [['narr', 'El planeta Vegeta desaparece. Pero en una cápsula, el pequeño Kakarotto viaja hacia la Tierra.']] },
      { name: 'El saiyajin del exilio', ch: 'vegeta', stage: 2, lvl: 30, boss: 'f_broly', hp: 1.1,
        goal: { type: 'boss', text: 'Derrota a Broly' },
        story: 'Paragus trae a Broly para vengarse del linaje del rey Vegeta. Vegeta acepta el desafío.',
        intro: [['paragus', 'Broly, ese es el hijo del rey que nos desterró. ¡Acaba con él!'], ['broly', '…Grr…'], ['vegeta', 'Un saiyajin salvaje. Veamos de qué eres capaz.']],
        win: [['vegeta', 'Cada vez que le golpeo… se hace más fuerte.']] },
      { name: 'La furia legendaria', ch: 'goku', stage: 2, lvl: 33, boss: 'broly', hp: 1.5,
        goal: { type: 'hold', n: 100, text: 'Aguanta 1:40 contra Broly' },
        story: 'Broly se transforma en el Super Saiyajin Legendario. Ni Goku en Blue puede detenerlo solo.',
        intro: [['broly', '¡KAKAROTTO!'], ['goku', 'Su poder no para de crecer… Vegeta, tengo una idea.']],
        win: [['goku', 'Vegeta, la danza de la fusión. ¡Es la única manera!'], ['vegeta', '…Está bien. Pero solo esta vez.']] },
      { name: 'Gogeta', ch: 'gogeta', stage: 2, lvl: 34, boss: 'broly', hp: 1.5,
        goal: { type: 'boss', text: 'Derrota a Broly con Gogeta' },
        story: 'Fu-sión… ¡ha! Nace Gogeta, y su poder supera al del Super Saiyajin legendario.',
        intro: [['gogeta', 'Soy Gogeta. Y voy a calmar esa rabia, Broly.'], ['broly', '¡GRAAAAH!']],
        win: [['gogeta', 'Ya está. Descansa, Broly. Ya no estás solo.'], ['narr', 'Y así termina la leyenda… por ahora.']] }
    ] }
];

/* Datos derivados: id, índice, libro, recompensa y marca para las 3 estrellas */
BOOKS.forEach((B, bi) => {
  B.idx = bi; B.tier = bi < 3 ? 0 : bi < 6 ? 1 : bi < 8 ? 2 : 3;          // dificultad base del libro (como el mapa de la ruta)
  B.chapters.forEach((C, ci) => {
    C.id = B.id + '_' + (ci + 1); C.book = B; C.idx = ci; C.intro = C.intro || []; C.bossTalk = C.bossTalk || []; C.win = C.win || [];
    C.reward = C.reward || 120 + bi * 30 + ci * 15;
    const G = C.goal, n = G.n || 0;
    // ★3: con objetivos de tiempo fijo cuenta cuántos derribas; en el resto, terminar antes de la marca
    if (G.type === 'survive' || G.type === 'hold') C.star3 = C.star3 || { kills: Math.round(n * 1.2 / 10) * 10 };
    else C.star3 = C.star3 || { time: Math.round(({ kills: n * 0.75 + 40, balls: n * 45 + 60, hunt: n * 18 + 50, level: n * 9 + 60, boss: 120, tourney: 150 }[G.type] || 180) + (C.boss && G.type !== 'boss' ? 90 : 0)) };
  });
});
const STORY_CHAPTERS = BOOKS.reduce((a, B) => a.concat(B.chapters), []);
const chapById = (id) => STORY_CHAPTERS.find((c) => c.id === id) || null;
const chapSave = (C) => (Save.d.story || {})[C.id] || null;
const chapDone = (C) => !!(chapSave(C) && chapSave(C).stars > 0);
const chapStars = (C) => (chapSave(C) ? chapSave(C).stars : 0);
const chapOpen = (C) => bookOpen(C.book.idx) && (C.idx === 0 || chapDone(C.book.chapters[C.idx - 1]));
const bookDone = (bi) => BOOKS[bi].chapters.every(chapDone);
const bookOpen = (bi) => bi === 0 || bookDone(bi - 1);
const bookStars = (bi) => BOOKS[bi].chapters.reduce((s, C) => s + chapStars(C), 0);
const storyDone = () => BOOKS.filter((B) => bookDone(B.idx)).length;
/** Textos de las 3 estrellas de un capítulo */
const starTexts = (C) => ['Completa el capítulo', 'Termina con al menos la mitad de la vida',
  C.star3.kills ? 'Derrota a ' + C.star3.kills + ' enemigos' : 'Termina en menos de ' + fmtClock(C.star3.time)];
const fmtClock = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
