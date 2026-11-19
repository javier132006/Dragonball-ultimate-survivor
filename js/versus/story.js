'use strict';
/* =====================================================================
   versus/story.js · Modo Historia del Versus.
   Sagas de la serie contadas en combates: cada capítulo te pone con el
   personaje que toca, con diálogo antes y después, un objetivo (ganar o
   resistir), un reto extra que da estrella, el rival reforzado y, a veces,
   transformaciones en mitad del combate. Da zeni y cristales la primera
   vez y por cada estrella nueva, y al cerrar una saga desbloquea guerreros.

   Capítulo:
     t      título · p / r: [id, forma] del jugador y del rival · ar: arena
     lvl    dificultad de la CPU (0 fácil · 1 normal · 2 difícil, admite decimales)
     hp/pow multiplicadores de vida y fuerza del rival (opcionales)
     goal   'win' (por defecto) o 'survive' con sec segundos (resistir hasta que acabe el tiempo)
     bonus  reto extra: { k: 'ult' | 'fast' | 'parry' | 'clash' | 'trans' | 'deflect', v }
     pre / post: [[quién, texto], ...]  quién: 0 tú · 1 el rival · 'n' narrador
     mid    sucesos en mitad del combate: { at: vida (0..1), who: 0|1 (de quién se mira la vida), tr: el rival se transforma,
            pt: tú puedes transformarte (te llena la barra), say: [quién, texto] }
   ===================================================================== */
const VS_STORY = [
  { id: 'saiyan', t: 'Saga Saiyan', unlock: ['raditz', 'saibaman'], ch: [
    { t: 'Un hermano del espacio', p: ['goku', 0], r: ['raditz', 0], ar: 'dia', lvl: 0.3,
      bonus: { k: 'ult' },
      pre: [['n', 'Un guerrero de cola peluda aterriza junto a Kame House. Dice ser de la familia de Goku.'], [1, 'Kakarotto, has vivido demasiado tiempo como un humano blando. Ven conmigo a conquistar planetas.'], [0, 'Me llamo Son Goku, y este es mi planeta. ¡No pienso ir a ninguna parte!']],
      post: [[1, 'Imposible... un Saiyan de clase baja...'], [0, 'La Tierra no está en venta, Raditz.']] },
    { t: 'Los hombres planta', p: ['krilin', 0], r: ['saibaman', 0], ar: 'yermo', lvl: 0.45,
      bonus: { k: 'fast', v: 50 },
      pre: [['n', 'Los Saiyans siembran unas semillas y brotan guerreros verdes, rápidos y explosivos.'], [0, '¡Dejádmelo a mí! Ya he visto lo que hacen esos bichos: no pienso dejar que se acerquen.'], [1, '¡Kikikiki!']],
      post: [[0, 'Uf... hay que tener cuidado: ¡estos explotan si te agarran!']] },
    { t: 'El príncipe de los Saiyans', p: ['goku', 1], r: ['vegeta', 0], ar: 'ocaso', lvl: 0.75, hp: 1.15,
      bonus: { k: 'parry', v: 2 },
      pre: [[1, 'Así que tú eres el insecto que derrotó a Raditz. Te enseñaré la diferencia entre un soldado y un príncipe.'], [0, 'Con el Kaioken puedo multiplicar mi fuerza. ¡Vamos a ver de qué eres capaz, Vegeta!']],
      mid: [{ at: 0.5, who: 1, say: [1, '¡No te lo perdonaré! ¡Un guerrero de clase baja no puede superarme!'] }],
      post: [[1, 'Esto no ha terminado, Kakarotto... Volveré, y seré más fuerte.'], [0, 'Te estaré esperando.']] }
  ] },
  { id: 'freezer', t: 'Saga de Freezer', unlock: ['freezer'], ch: [
    { t: 'El último Saiyan rebelde', p: ['bardock', 0], r: ['freezer', 0], ar: 'volcan', lvl: 0.7, hp: 1.6, pow: 1.15,
      goal: 'survive', sec: 45, bonus: { k: 'deflect' },
      pre: [['n', 'Hace años, en el Planeta Vegeta. Un soldado ha visto el futuro de su pueblo y se lanza solo contra el tirano.'], [0, '¡Freezer! ¡Esto va por todos los Saiyans a los que has traicionado!'], [1, 'Qué conmovedor. Un mono que se cree un héroe.']],
      post: [[0, 'Kakarotto... hijo... tú acabarás lo que yo he empezado.'], ['n', 'Bardock no pudo vencer, pero su resistencia se recordaría para siempre.']] },
    { t: 'La fusión de Namek', p: ['piccolo', 1], r: ['freezer', 1], ar: 'jade', lvl: 0.8, hp: 1.2,
      bonus: { k: 'fast', v: 75 },
      mid: [{ at: 0.45, who: 1, tr: true, say: [1, 'Me has obligado a mostrarte mi forma final. Será lo último que veas.'] }],
      pre: [[0, 'Nail me ha dado su fuerza. Ahora soy un namekiano completo.'], [1, 'Un namekiano con aires de grandeza. Qué gracioso.']],
      post: [[0, 'Vamos, Goku... Te hemos ganado el tiempo que necesitabas.']] },
    { t: 'La leyenda despierta', p: ['goku', 1], r: ['freezer', 2], ar: 'jade', lvl: 1, hp: 1.35, pow: 1.1,
      bonus: { k: 'trans' },
      pre: [[1, 'Ríndete, mono. Nadie en el universo puede plantarme cara.'], [0, 'Ni con el Kaioken al máximo es suficiente... pero has hecho daño a mis amigos, y eso no te lo voy a perdonar.']],
      mid: [{ at: 0.6, who: 0, pt: true, say: [0, '¡¡KRILIIIN!! ¡¡Ya basta, Freezer!!'] }, { at: 0.35, who: 1, tr: true, say: [1, '¡Te enseñaré el cien por cien de mi poder!'] }],
      post: [[0, 'Soy el Super Saiyan que llevas tanto tiempo temiendo.'], [1, 'Esto... no puede estar pasando...']] }
  ] },
  { id: 'cell', t: 'Saga de los Androides y Cell', unlock: ['andro18', 'cell'], ch: [
    { t: 'El chico del futuro', p: ['trunks', 1], r: ['freezer', 2], ar: 'yermo', lvl: 0.8, hp: 1.1,
      bonus: { k: 'fast', v: 45 },
      pre: [['n', 'Freezer vuelve a la Tierra buscando venganza. Pero alguien le espera antes que Goku.'], [0, 'No vas a tocar este planeta.'], [1, '¿Otro Super Saiyan? ¿Cuántos monos hay en esta roca?']],
      post: [[0, 'He venido del futuro para cambiar las cosas. Y esto solo es el principio.']] },
    { t: 'La androide número 18', p: ['vegeta', 1], r: ['andro18', 0], ar: 'dia', lvl: 1, hp: 1.3,
      bonus: { k: 'parry', v: 3 },
      pre: [[0, 'Unas máquinas creadas para matar a Kakarotto. Qué decepción.'], [1, 'Hablas mucho para ser el que va a perder.']],
      post: [[1, 'No está mal... pero no somos tu verdadero problema.'], [0, '¿Qué has querido decir?']] },
    { t: 'El ser perfecto', p: ['vegeta', 2], r: ['cell', 2], ar: 'ocaso', lvl: 1.2, hp: 1.35, pow: 1.1,
      bonus: { k: 'ult' },
      pre: [[0, 'Te he dejado llegar a tu forma perfecta para que mi victoria sea total.'], [1, 'Qué orgullo tan útil. Gracias por el regalo, príncipe.']],
      post: [[1, 'Interesante... pero aún no has visto todo mi potencial.']] },
    { t: 'Los Juegos de Cell', p: ['gohan', 1], r: ['cell', 2], ar: 'ocaso', lvl: 1.4, hp: 1.6, pow: 1.15,
      bonus: { k: 'clash' },
      pre: [['n', 'El torneo de Cell decidirá el destino de la Tierra. Goku cede el turno a su hijo.'], [1, '¿Un niño? Vamos, Gohan, enséñame esa ira que tu padre dice que escondes.'], [0, 'No quiero pelear... pero no te dejaré hacer daño a nadie más.']],
      mid: [{ at: 0.55, who: 0, pt: true, say: [0, '¡¡YA BASTA!! ¡No te lo perdono!'] }, { at: 0.3, who: 1, tr: true, say: [1, '¡He vuelto más fuerte que nunca! ¡Ahora soy súper perfecto!'] }],
      post: [[0, 'Papá... lo hemos conseguido.'], ['n', 'Gohan, con el espíritu de su padre a su lado, salvó la Tierra.']] }
  ] },
  { id: 'buu', t: 'Saga de Majin Buu', unlock: ['majin', 'superbuu', 'gotenks'], ch: [
    { t: 'El regreso del príncipe malvado', p: ['goku', 3], r: ['vegeta', 3], ar: 'volcan', lvl: 1.2, hp: 1.3,
      bonus: { k: 'ult' },
      pre: [[1, 'Por fin, Kakarotto. Sin torneos ni reglas: solo tú y yo.'], [0, 'Has dejado que Babidi te controle solo para pelear conmigo... Está bien, Vegeta.']],
      post: [[1, 'Ve tú a por Buu... Yo me encargaré de esto a mi manera.']] },
    { t: 'El sacrificio del orgullo', p: ['vegeta', 3], r: ['majin', 0], ar: 'yermo', lvl: 1.1, hp: 2, pow: 1.2,
      goal: 'survive', sec: 50, bonus: { k: 'deflect' },
      pre: [['n', 'Majin Buu ha despertado. Vegeta se queda solo frente a él para proteger a su familia.'], [1, '¡Buu jugar contigo! ¡Jejeje!'], [0, 'Trunks, Bulma... Por una vez, lucharé por alguien que no sea yo.']],
      post: [[0, 'Kakarotto... ahora te toca a ti.']] },
    { t: 'La fusión de los niños', p: ['gotenks', 0], r: ['superbuu', 0], ar: 'noche', lvl: 1.2, hp: 1.4,
      bonus: { k: 'fast', v: 70 },
      mid: [{ at: 0.6, who: 0, pt: true, say: [0, '¡Ha llegado el gran Gotenks! ¡Prepárate para mi nueva forma!'] }],
      pre: [[0, '¡El héroe de la justicia ha llegado! ¡Gotenks, para servirte!'], [1, 'Qué niño tan ruidoso. Te convertiré en chocolate.']],
      post: [[0, '¡Ja! ¡Ni el malvado Buu puede con el increíble Gotenks!']] },
    { t: 'El guerrero definitivo', p: ['gohan', 3], r: ['superbuu', 1], ar: 'noche', lvl: 1.4, hp: 1.6, pow: 1.1,
      bonus: { k: 'parry', v: 3 },
      pre: [[0, 'El Anciano Kaioshin ha despertado todo mi poder. Se acabó, Buu.'], [1, 'Muy valiente. Veamos cuánto aguantas.']],
      mid: [{ at: 0.4, who: 1, tr: true, say: [1, '¡Ahora sí que me estoy divirtiendo!'] }],
      post: [[0, 'Esto es por todos los que se han ido.']] },
    { t: 'Vegetto', p: ['vegito', 1], r: ['superbuu', 2], ar: 'vacio', lvl: 1.6, hp: 1.8, pow: 1.2,
      bonus: { k: 'ult' },
      pre: [['n', 'Goku y Vegeta se ponen los pendientes Potara. Ha nacido el guerrero más poderoso.'], [0, 'Soy Vegetto. Y tengo muchas ganas de jugar contigo, Buu.'], [1, '¿Quién... eres tú?']],
      post: [[0, 'Lo siento, Buu. La diversión se ha acabado.']] }
  ] },
  { id: 'dioses', t: 'Saga de los Dioses', unlock: ['bills', 'hitto'], ch: [
    { t: 'El Dios de la Destrucción', p: ['goku', 6], r: ['bills', 0], ar: 'vacio', lvl: 1.5, hp: 2.5, pow: 1.35,
      goal: 'survive', sec: 60, bonus: { k: 'parry', v: 3 },
      pre: [[1, 'He soñado con un Super Saiyan Dios. Me han dicho que eres tú. No me aburras.'], [0, '¡Increíble! ¡Nunca había sentido un poder así! ¡Esto va a ser genial!']],
      post: [[1, 'Has aguantado. Por esta vez, la Tierra se salva.'], [0, 'Algún día te ganaré, Bills.']] },
    { t: 'La resurrección de F', p: ['goku', 7], r: ['freezer', 4], ar: 'jade', lvl: 1.6, hp: 1.7, pow: 1.2,
      bonus: { k: 'clash' },
      pre: [[1, 'He entrenado por primera vez en mi vida. Contempla mi forma dorada, mono.'], [0, 'Vaya, sí que has mejorado. Pero yo tampoco me he quedado quieto.']],
      post: [[1, 'Esto no ha terminado... Jamás terminará.']] },
    { t: 'El asesino del Universo 6', p: ['vegeta', 6], r: ['hitto', 0], ar: 'noche', lvl: 1.6, hp: 1.6,
      bonus: { k: 'deflect' },
      mid: [{ at: 0.5, who: 1, tr: true, say: [1, 'Has visto mi técnica. Ahora la mejoraré.'] }],
      pre: [[0, 'Dicen que eres el mejor asesino de tu universo. Yo soy el príncipe de todos los Saiyans.'], [1, 'Los títulos no detienen el tiempo.']],
      post: [[1, 'Buena pelea, príncipe.']] }
  ] },
  { id: 'black', t: 'Saga de Goku Black', unlock: ['black', 'zamasu', 'zamasuf', 'trunksarm'], ch: [
    { t: 'Un rostro conocido', p: ['trunks', 1], r: ['black', 1], ar: 'volcan', lvl: 1.4, hp: 1.5,
      bonus: { k: 'trans' },
      mid: [{ at: 0.5, who: 1, tr: true, say: [1, 'Admira el rosa de este poder divino. Es hermoso, ¿no crees?'] }],
      pre: [['n', 'En el futuro de Trunks, un ser con la cara de Goku lo ha destruido casi todo.'], [0, '¡Black! ¡No te dejaré seguir con esto!'], [1, 'Mortal testarudo. Tu esperanza es solo otro error que corregir.']],
      post: [[0, 'Tengo que volver al pasado... Necesito a Goku y a Vegeta.']] },
    { t: 'El Kaioshin caído', p: ['vegeta', 6], r: ['zamasu', 0], ar: 'vacio', lvl: 1.5, hp: 1.6,
      bonus: { k: 'parry', v: 3 },
      pre: [[1, 'Los mortales sois el pecado de este universo. Yo traeré la justicia.'], [0, 'Hablas mucho para ser un dios. Veamos si sangras.']],
      post: [[1, 'Este cuerpo es inmortal... pero aún hay algo más.']] },
    { t: 'La fusión divina', p: ['vegito', 3], r: ['zamasuf', 0], ar: 'vacio', lvl: 1.7, hp: 1.9, pow: 1.2,
      bonus: { k: 'ult' },
      mid: [{ at: 0.5, who: 1, tr: true, say: [1, '¡Este cuerpo inmortal se corrompe, pero mi justicia es absoluta!'] }],
      pre: [[1, 'Contempla al dios definitivo: la fusión del cuerpo inmortal y el poder de Goku.'], [0, 'Otra vez juntos. Esta vez no hay vuelta atrás.']],
      post: [[0, 'Se nos acaba el tiempo... ¡Trunks, ahora!']] },
    { t: 'La espada de la esperanza', p: ['trunks', 2], r: ['zamasuf', 1], ar: 'ocaso', lvl: 1.8, hp: 1.8, pow: 1.25,
      bonus: { k: 'fast', v: 80 },
      mid: [{ at: 0.45, who: 1, tr: true, say: [1, '¡Yo soy el universo! ¡Yo soy la justicia!'] }],
      pre: [[0, 'La energía de todos los humanos que quedan está en esta espada. ¡No vas a ganar!'], [1, '¿La esperanza de los mortales? Qué patético.']],
      post: [['n', 'La espada de Trunks, cargada con la esperanza de un mundo, partió en dos al dios fusionado.']] }
  ] },
  { id: 'torneo', t: 'Torneo del Poder', unlock: ['kefla', 'caulifla', 'kale', 'toppo', 'jiren'], ch: [
    { t: 'La fusión del Universo 6', p: ['goku', 7], r: ['kefla', 0], ar: 'vacio', lvl: 1.6, hp: 1.7,
      bonus: { k: 'deflect' },
      mid: [{ at: 0.55, who: 1, tr: true, say: [1, '¡Super Saiyan! ¡Ahora sí te voy a aplastar!'] }],
      pre: [[1, 'Caulifla y Kale juntas en un solo cuerpo. Prepárate para perder, abuelo.'], [0, '¡Qué fuerza! ¡Esto se pone interesante!']],
      post: [[1, 'Tsk... la próxima vez no te lo pondré tan fácil.']] },
    { t: 'El guardián de la justicia', p: ['vegeta', 7], r: ['toppo', 0], ar: 'vacio', lvl: 1.7, hp: 1.8, pow: 1.15,
      bonus: { k: 'parry', v: 3 },
      mid: [{ at: 0.45, who: 1, tr: true, say: [1, 'Abandono la justicia. Ahora soy un Dios de la Destrucción.'] }],
      pre: [[1, 'Por la justicia del Universo 11, saldrás de esta plataforma.'], [0, 'Tu justicia no me importa. Yo lucho por mi orgullo... y por mi familia.']],
      post: [[0, 'Ese es el poder de un Saiyan que no se rinde.']] },
    { t: 'El instinto definitivo', p: ['goku', 9], r: ['jiren', 0], ar: 'vacio', lvl: 2, hp: 2.2, pow: 1.3,
      bonus: { k: 'clash' },
      mid: [{ at: 0.6, who: 0, pt: true, say: [0, '...El cuerpo se mueve solo.'] }, { at: 0.4, who: 1, tr: true, say: [1, 'La fuerza lo es todo. Te lo demostraré.'] }],
      pre: [['n', 'Quedan muy pocos en la plataforma. Frente a Goku, el guerrero más fuerte del Universo 11.'], [1, 'Tu poder no basta. La confianza es una debilidad.'], [0, 'Puede ser... ¡pero no voy a rendirme!']],
      post: [[1, 'Ahora lo entiendo... no estás solo.'], [0, 'Ha sido la mejor pelea de mi vida, Jiren.']] }
  ] },
  { id: 'broly', t: 'Película: Broly', unlock: ['broly', 'gogeta'], ch: [
    { t: 'El Saiyan del planeta helado', p: ['vegeta', 6], r: ['broly', 0], ar: 'hielo', lvl: 1.7, hp: 2, pow: 1.2,
      bonus: { k: 'parry', v: 3 },
      mid: [{ at: 0.6, who: 1, tr: true, say: [1, '¡¡AAAAARGH!!'] }, { at: 0.35, who: 1, tr: true, say: [1, '...¡¡KAKAROTTOOO!!'] }],
      pre: [['n', 'Freezer ha traído a la Tierra a un Saiyan criado en un planeta perdido. Su poder no deja de crecer.'], [0, 'Un Saiyan con ese poder y sin control... Esto será divertido.'], [1, '...']],
      post: [[0, 'No para de crecer... Kakarotto, no podemos ganarle por separado.']] },
    { t: 'Gogeta', p: ['gogeta', 3], r: ['broly', 2], ar: 'hielo', lvl: 2, hp: 2.4, pow: 1.3,
      bonus: { k: 'ult' },
      pre: [['n', 'Goku y Vegeta, por fin, hacen la danza de la fusión a la perfección.'], [0, 'Soy Gogeta. Y voy a calmar a ese grandullón.'], [1, '¡¡GRAAAAH!!']],
      post: [[0, 'Ya está... Descansa, Broly.'], ['n', 'Los amigos de Broly se lo llevaron lejos, a un lugar donde por fin podría vivir en paz.']] }
  ] }
];

const VS_STORY_BONUS = {
  ult: () => 'Remátalo con una Ultimate',
  fast: (v) => 'Gana en menos de ' + v + ' s',
  parry: (v) => 'Haz ' + v + ' guardias perfectas',
  clash: () => 'Gana un choque de Ultimates',
  trans: () => 'Gana transformado',
  deflect: () => 'Desvía una Ultimate rival'
};
const VS_STORY_PAY = { first: 150, firstCry: 20, starCry: 12, sagaCry: 120 };   // recompensas: primera vez, por estrella nueva y por saga completa

/** Progreso guardado: estrellas de cada capítulo (Save.d.vsStory) */
const VsStoryData = {
  d() { const s = Save.d; if (!s.vsStory || typeof s.vsStory !== 'object') s.vsStory = { st: {}, sel: 0 }; if (!s.vsStory.st) s.vsStory.st = {}; return s.vsStory; },
  key: (si, ci) => VS_STORY[si].id + '/' + ci,
  stars(si, ci) { return this.d().st[this.key(si, ci)] || 0; },
  list() { const L = []; VS_STORY.forEach((s, si) => s.ch.forEach((c, ci) => L.push([si, ci]))); return L; },
  /** Un capítulo se puede jugar si es el primero o el anterior está superado */
  open(si, ci) { const L = this.list(), n = L.findIndex(([a, b]) => a === si && b === ci); return n <= 0 || this.stars(...L[n - 1]) > 0; },
  sagaDone(si) { return VS_STORY[si].ch.every((c, ci) => this.stars(si, ci) > 0); },
  total() { return this.list().reduce((a, [si, ci]) => a + this.stars(si, ci), 0); }
};

/** Controla un capítulo en marcha: diálogos, sucesos a mitad, retos y resultado */
class VsStory {
  constructor(vs, si, ci) {
    this.vs = vs; this.si = si; this.ci = ci; this.C = VS_STORY[si].ch[ci]; this.saga = VS_STORY[si];
    this.midDone = []; this.ults = 0; this.clashes = 0; this.defl = 0; this.lastUlt = -99; this.dlg = null; this.qT = 0;
  }
  /* ---------- Diálogo con retratos ---------- */
  /** lines: [[quién, texto]] · done: al acabar */
  talk(lines, done) {
    const vs = this.vs, el = vs.ui.sty;
    if (!lines || !lines.length) { if (done) done(); return; }
    this.dlg = { lines, k: -1, done, t: 0 }; vs.paused = true; el.classList.add('on'); this.nextLine();
  }
  nextLine() {
    const D = this.dlg; if (!D) return;
    if (D.k >= 0 && D.shown < D.full.length) { D.shown = D.full.length; this.paint(); return; }     // primero termina de escribir la frase
    D.k++;
    if (D.k >= D.lines.length) { this.endTalk(); return; }
    const [who, txt] = D.lines[D.k]; D.who = who; D.full = txt; D.shown = 0; this.paint(true); SFX.play('ki');
  }
  endTalk() { const D = this.dlg; this.dlg = null; this.vs.ui.sty.classList.remove('on'); this.vs.paused = false; if (D && D.done) D.done(); }
  skipTalk() { if (this.dlg) this.endTalk(); }
  /** Escribe la frase letra a letra (lo llama Versus.frame cada fotograma, aunque el combate esté parado) */
  tickTalk(dt) { const D = this.dlg; if (!D || D.shown >= D.full.length) return; D.shown = Math.min(D.full.length, D.shown + dt * 55); this.paint(); }
  paint(fresh) {
    const D = this.dlg, vs = this.vs, el = vs.ui.sty, A = vs.actors, n = D.who === 'n';
    if (fresh) {
      el.className = 'sty on ' + (n ? 'n' : D.who ? 'r' : 'l');
      const nm = el.querySelector('.sdn'); nm.textContent = n ? '' : A[D.who].def.name;
      if (!n) { const c = new THREE.Color(A[D.who].def.col).lerp(new THREE.Color(0xffffff), 0.3); el.style.setProperty('--c', '#' + c.getHexString()); vs.portrait(el.querySelector('.sdp'), A[D.who].def.sheet); }
    }
    el.querySelector('.sdt').textContent = D.full.slice(0, Math.floor(D.shown));
    el.querySelector('.sdk').textContent = (D.k + 1) + ' / ' + D.lines.length;
  }
  /* ---------- Combate ---------- */
  begin() { this.vs.draw(0, 0.016); this.talk(this.C.pre); }
  /** Cada paso de la simulación: sucesos a mitad del combate */
  step() {
    const vs = this.vs, sim = vs.sim, C = this.C;
    if (this.qT > 0 && (this.qT -= VS_DT) <= 0) vs.quote(null);
    if (sim.phase !== 'fight' || !C.mid) return;
    C.mid.forEach((m, k) => {
      if (this.midDone[k]) return;
      const f = sim.f[m.who], rival = sim.f[1];
      if (f.hp / f.hpMax > m.at) return;
      if (m.tr && (sim.ult || sim.tr || sim.clash || rival.fi >= rival.chain.length - 1 || rival.st === 'ko' || rival.busy && rival.st !== 'hurt')) { if (rival.fi >= rival.chain.length - 1) this.midDone[k] = true; return; }
      this.midDone[k] = true;
      if (m.say) { vs.quote(m.say[0] === 'n' ? 1 : m.say[0], m.say[1]); this.qT = 2.8; }
      if (m.tr) { rival.tm = 100; rival.st = 'idle'; sim.startTrans(rival); }
      if (m.pt) { const p = sim.f[0]; if (p.fi < p.chain.length - 1) { p.tm = 100; vs.tag('¡TRANSFÓRMATE! PULSA ' + vsKeyName(VS_KEYS[0].TRANS)); vs.flash = Math.max(vs.flash, 0.25); SFX.play('stinger'); } }
    });
  }
  onEvent(e) {
    const sim = this.vs.sim;
    if (e.t === 'ultStart' && e.i === 0) this.ults++;
    if (e.t === 'clashWin' && e.w === 0) { this.clashes++; this.lastUlt = sim.tick; }
    if (e.t === 'ultParry' && e.i === 0) this.defl++;
    if (e.t === 'ko' && e.w === 0) this.koUlt = !!(sim.ult && sim.ult.who === 0) || sim.tick - this.lastUlt < 40;
    if (e.t === 'ko') this.koT = sim.tick / 60 - (this.t0 || 0);
    if (e.t === 'fight') this.t0 = sim.tick / 60;
  }
  /** ¿Se ha cumplido el reto extra? */
  bonusOk() {
    const B = this.C.bonus, sim = this.vs.sim, run = this.vs.run; if (!B) return false;
    switch (B.k) {
      case 'ult': return !!this.koUlt;
      case 'fast': return this.koT !== undefined && this.koT <= B.v;
      case 'parry': return run.parry >= B.v;
      case 'clash': return this.clashes > 0;
      case 'trans': return run.tr > 0 || sim.f[0].fi > 0;
      case 'deflect': return this.defl > 0;
    }
    return false;
  }
  /** Fin del combate: estrellas, premios y desbloqueos. Devuelve el texto para la pantalla final */
  result(w) {
    const vs = this.vs, sim = vs.sim, C = this.C, D = VsStoryData, key = D.key(this.si, this.ci), was = D.stars(this.si, this.ci), P = VS_STORY_PAY;
    if (w !== 0) return { win: false, h2: 'DERROTA', p: C.goal === 'survive' ? 'No has resistido hasta el final. ¡Inténtalo otra vez!' : 'Has caído ante ' + vs.actors[1].def.name + '. ¡Inténtalo otra vez!' };
    const b = this.bonusOk(), hp = sim.f[0].hp / sim.f[0].hpMax >= 0.5, stars = [true, b, hp], n = stars.filter(Boolean).length;
    // Estrellas guardadas: se suman las nuevas (si ya tenías la del reto, no se pierde)
    const old = D.d().st[key + ':b'] || 0, oh = D.d().st[key + ':h'] || 0, nb = old || b, nh = oh || hp, best = 1 + (nb ? 1 : 0) + (nh ? 1 : 0);
    D.d().st[key] = best; D.d().st[key + ':b'] = nb ? 1 : 0; D.d().st[key + ':h'] = nh ? 1 : 0;
    let zeni = 0, cry = 0; const got = [];
    if (!was) { zeni += P.first; cry += P.firstCry; got.push('primera vez: +' + P.first + ' zeni, +' + P.firstCry + ' cristales'); }
    const newStars = best - was - (was ? 0 : 1); if (newStars > 0) { cry += P.starCry * newStars; got.push(newStars + (newStars > 1 ? ' estrellas nuevas' : ' estrella nueva') + ': +' + P.starCry * newStars + ' cristales'); }
    let unl = [];
    if (!was && D.sagaDone(this.si)) {                                   // saga completa: premio y guerreros nuevos
      cry += P.sagaCry; got.push('¡' + this.saga.t + ' completada! +' + P.sagaCry + ' cristales');
      for (const id of this.saga.unlock || []) { const ch = charById(id); if (ch && !Save.d.unlocked.includes(id)) { Save.d.unlocked.push(id); unl.push(nice(ch.name)); } }
    }
    Save.d.zeni += zeni; Save.d.crystals = (Save.d.crystals || 0) + cry; Save.write();
    const B = C.bonus, st = (on, t) => '<span class="' + (on ? 'on' : '') + '">★ ' + t + '</span>';
    return { win: true, h2: n === 3 ? '¡CAPÍTULO PERFECTO!' : '¡CAPÍTULO SUPERADO!',
      p: '<span class="sst">' + st(true, C.goal === 'survive' ? 'Resistir' : 'Ganar') + st(b, B ? VS_STORY_BONUS[B.k](B.v) : 'Reto') + st(hp, 'Acabar con más de media vida') + '</span>' +
        (got.length ? got.join(' · ') : 'Sin premios nuevos (ya los tenías)') + (unl.length ? '<br><b>¡Nuevos guerreros desbloqueados: ' + unl.join(', ') + '!</b>' : '') };
  }
  /** Siguiente capítulo (o null si era el último) */
  next() { const L = VsStoryData.list(), n = L.findIndex(([a, b]) => a === this.si && b === this.ci); return L[n + 1] || null; }
}

/** Ficha de un capítulo para el menú del Versus */
function vsStoryPane(sel) {
  const D = VsStoryData, [si, ci] = sel, S = VS_STORY[si], C = S.ch[ci], open = D.open(si, ci);
  const sagas = VS_STORY.map((s, k) => {
    const got = s.ch.reduce((a, c, j) => a + D.stars(k, j), 0), lock = !D.open(k, 0);
    return '<div class="ssg' + (k === si ? ' on' : '') + (lock ? ' lock' : '') + '"><h4>' + (lock ? '🔒 ' : '') + s.t + '<small>' + got + ' / ' + s.ch.length * 3 + ' ★</small></h4><div class="sch">' +
      s.ch.map((c, j) => { const ok = D.open(k, j), st = D.stars(k, j); return '<button data-v="story" data-a="' + k + ':' + j + '"' + (k === si && j === ci ? ' class="on"' : '') + (ok ? '' : ' disabled') + '><b>' + (ok ? c.t : '???') + '</b><i>' + '★'.repeat(st) + '<u>' + '★'.repeat(3 - st) + '</u></i></button>'; }).join('') + '</div></div>';
  }).join('');
  return '<div class="story">' + sagas + '</div>';
}
function vsStoryCard(sel) {
  const D = VsStoryData, [si, ci] = sel, S = VS_STORY[si], C = S.ch[ci], open = D.open(si, ci), st = D.stars(si, ci), B = C.bonus, pc = charById(C.p[0]), rc = charById(C.r[0]);
  const fm = (ch, f) => nice((ch.forms[f] || ch.forms[0]).name);
  const rows = [['Juegas con', nice(pc.name) + ' · ' + fm(pc, C.p[1])], ['Rival', nice(rc.name) + ' · ' + fm(rc, C.r[1]) + (C.hp > 1.05 ? ' · vida ×' + C.hp : '')],
    ['Objetivo', C.goal === 'survive' ? 'Resiste ' + C.sec + ' segundos' : 'Gana el combate'], ['Reto extra', B ? VS_STORY_BONUS[B.k](B.v) : '—'],
    ['Dificultad', C.lvl < 0.7 ? 'Fácil' : C.lvl < 1.3 ? 'Normal' : C.lvl < 1.8 ? 'Difícil' : 'Muy difícil']];
  if (C.mid && C.mid.some((m) => m.tr)) rows.push(['Ojo', 'El rival se transformará en mitad del combate']);
  if (C.mid && C.mid.some((m) => m.pt)) rows.push(['Giro', 'Podrás transformarte cuando llegue el momento']);
  const unl = (S.unlock || []).filter((id) => !Save.d.unlocked.includes(id)).map((id) => nice(charById(id).name));
  return '<section class="fp tw scard"><span class="who">' + S.t + ' · Capítulo ' + (ci + 1) + '</span><h3 style="margin-top:14px">' + (open ? C.t : 'Bloqueado') + '</h3><div class="twi">' +
    (open ? '<div class="sstars">' + '★'.repeat(st) + '<u>' + '★'.repeat(3 - st) + '</u></div>' + rows.map(([a, b]) => '<p><span>' + a + '</span><b>' + b + '</b></p>').join('') +
      '<p class="pay">' + (st ? 'Ya superado: ganas cristales por cada estrella nueva.' : 'Primera vez: <b>+' + VS_STORY_PAY.first + ' zeni</b> y <b>+' + VS_STORY_PAY.firstCry + ' cristales</b>.') + (unl.length ? ' Al completar la saga desbloqueas: <b>' + unl.join(', ') + '</b>.' : '') + '</p>'
      : 'Supera el capítulo anterior para jugar este.') + '</div></section>';
}

const VS_STORY_CSS = `
#vs .story{display:flex;flex-direction:column;gap:10px;padding:2px 2px 8px}
#vs .ssg h4{display:flex;justify-content:space-between;align-items:baseline;margin:0 0 5px;font:400 19px/1.1 var(--mg);letter-spacing:.04em;color:var(--gold)}#vs .ssg h4 small{font:800 11px/1 var(--body);color:#cfd6ee}
#vs .ssg.lock h4{color:#7b8199}
#vs .sch{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
#vs .sch button{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:7px 9px;text-align:left;font:700 12px/1.25 var(--body)}
#vs .sch button b{font-weight:800}#vs .sch button i{font-style:normal;color:var(--gold);letter-spacing:1px}#vs .sch button i u{text-decoration:none;color:rgba(255,255,255,.22)}
#vs .sch button:disabled{opacity:.45;cursor:not-allowed}
#vs .scard .twi p{display:flex;justify-content:space-between;gap:10px;margin:0 0 5px;font-size:12.5px}#vs .scard .twi p span{color:#9fb0d8;flex:none}#vs .scard .twi p b{text-align:right}
#vs .scard .twi p.pay{display:block;margin-top:10px;color:#cfd6ee}#vs .sstars{font-size:26px;color:var(--gold);letter-spacing:3px;margin:-4px 0 8px}#vs .sstars u{text-decoration:none;color:rgba(255,255,255,.2)}
#vs .sty{position:absolute;left:50%;bottom:6%;transform:translateX(-50%);width:min(860px,92%);display:none;align-items:center;gap:16px;padding:16px 20px 14px;background:rgba(17,18,28,.94);border:4px solid var(--ink);box-shadow:0 0 0 3px var(--c,var(--gold)),8px 8px 0 rgba(0,0,0,.45);z-index:5;pointer-events:auto;cursor:pointer}
#vs .sty.on{display:flex}#vs .sty.r{flex-direction:row-reverse}#vs .sty.n{box-shadow:0 0 0 3px #cfd6ee,8px 8px 0 rgba(0,0,0,.45)}#vs .sty.n .sdp{display:none}
#vs .sty .sdp{flex:none;width:110px;height:110px;image-rendering:pixelated;background:linear-gradient(165deg,var(--c,#888) 0,var(--ink) 90%);border:3px solid var(--ink)}
#vs .sty .sdb{flex:1;min-width:0}#vs .sty .sdn{font:400 24px/1 var(--mg);letter-spacing:.05em;color:var(--c,var(--gold));-webkit-text-stroke:4px var(--ink);paint-order:stroke fill;margin-bottom:6px}#vs .sty.r .sdn{text-align:right}
#vs .sty .sdt{font:600 16px/1.45 var(--body);color:#fff;min-height:3em}#vs .sty.n .sdt{font-style:italic;color:#dfe6ff;text-align:center}
#vs .sty .sdf{display:flex;justify-content:space-between;align-items:center;margin-top:8px;font:700 11px/1 var(--body);color:#8f9bc0}
#vs .sty .sdf button{font:800 12px/1 var(--body);padding:6px 12px}
#vs.story .tc{opacity:.3}
#vs .pnl .sst{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 16px;margin:16px 0 8px;font:800 14px/1.3 var(--body);color:rgba(255,255,255,.35)}#vs .pnl .sst span.on{color:var(--gold);text-shadow:0 0 8px rgba(255,197,49,.6)}
#vs .pnl.win .box p:has(.sst){display:block;font-size:13px}
@media (max-width:700px){#vs .sty .sdp{width:70px;height:70px}#vs .sty .sdt{font-size:14px}}
`;
