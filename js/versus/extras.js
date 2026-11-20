'use strict';
/* =====================================================================
   versus/extras.js · Lo que hace distinto a cada guerrero en el Versus:
     VS_PAS    pasiva (habilidad única, siempre activa)      'tipo|NOMBRE'
     VS_INTRO  cómo entra al combate
     VS_VOZ    qué dice al entrar y al ganar (frases propias del juego)
   La lógica de cada tipo de pasiva está en sim.js (busca `pas ===`).
   Cada guerrero tiene una pasiva propia: ningún tipo se repite en el plantel.
   ===================================================================== */

/* Qué hace cada tipo de pasiva (texto del menú de selección) */
const VS_PAS_INFO = {
  tp: 'El teletransporte cuesta la mitad de ki.',
  orgullo: 'Por debajo del 35 % de vida pega un 18 % más.',
  rose: 'Cuanta menos vida le queda, más pega (hasta +20 %).',
  ira: 'Su barra de transformación se llena un 50 % más rápido al recibir daño.',
  regen: 'Si pasa 3 s sin recibir golpes, recupera vida poco a poco.',
  tirano: 'Sus disparos de ki cuestan menos y hacen un 35 % más de daño.',
  senzu: 'Una vez por ronda, al bajar del 25 % de vida recupera un 22 %.',
  espada: 'Más alcance cuerpo a cuerpo y rompe la guardia casi el doble de rápido.',
  armadura: 'Mientras prepara el golpe fuerte, los golpes flojos no le interrumpen.',
  tiempo: 'El doble de margen para la guardia perfecta y la esquiva perfecta.',
  hakai: 'Sus disparos de ki ganan cualquier choque de ki.',
  infinito: 'Regenera ki el triple de rápido sin necesidad de cargar.',
  absorbe: 'En guardia absorbe los disparos de ki: no le dañan y le dan ki.',
  kamikaze: 'Al ser noqueado estalla y daña al rival si está cerca.',
  lobo: 'El dash no gasta ki y se mueve un 8 % más rápido.',
  zenkai: 'Cada vez que se levanta del suelo pega un 4 % más (hasta +20 %).',
  fusion: 'Gana un 40 % más de ki al pegar y al recibir golpes.',
  cambio: 'Una vez por ronda, si agarra al rival teniendo menos vida, intercambian la vida.',
  parasito: 'Recupera como vida el 12 % del daño que hace.',
  maligno: 'El rival pierde ki mientras esté cerca de él.',
  piedra: 'Cuando rompe una guardia, el rival queda aturdido mucho más tiempo.',
  muralla: 'Su guardia aguanta el doble y bloqueando no recibe daño.',
  portal: 'Tras teletransportarse, su siguiente golpe pega un 35 % más.',
  copia: 'Aprende de cada golpe que recibe: +1 % de daño por golpe en la ronda (hasta +15 %).',
  inmortal: 'Una vez por combate, el golpe que le noquearía le deja con 1 de vida.',
  divino: 'Los disparos de ki y las Ultimates le hacen un 18 % menos de daño.',
  goma: 'Los golpes fuertes le hacen un 30 % menos de daño y apenas lo empujan.',
  caramelo: 'Sus disparos cargados debilitan al rival: pega un 20 % menos durante 4 s.',
  potencial: 'Empieza el combate con la barra de transformación a la mitad.',
  esperanza: 'Por debajo del 30 % de vida regenera ki el doble y sus disparos cuestan la mitad.',
  frio: 'Sus golpes fuertes congelan: el rival se mueve un 30 % más lento durante 2 s.',
  acero: 'Su barra de guardia se recupera el doble de rápido.',
  vision: 'Ve venir el primer golpe de cada ronda y lo esquiva solo.',
  elite: 'Su primer golpe que conecta en cada ronda hace el doble de daño.',
  fruto: 'Mientras carga ki también recupera vida.',
  salvaje: 'Su barra de transformación se llena un 35 % más rápido al pegar.',
  aprendiz: 'Cada guardia perfecta o esquiva perfecta le da 25 de barra de transformación.',
  infantil: 'Sus combos no pierden fuerza: los golpes seguidos pegan siempre igual.',
  metamor: 'Su ráfaga (quinta pulsación) suelta tres golpes más.',
  potara: 'Empieza cada ronda con 60 de ki en lugar de 25.',
  fantasma: 'Sus disparos de ki persiguen al rival mucho más tiempo.',
  furia: 'Con el ki al máximo pega un 20 % más.',
  justicia: 'Los disparos de ki rápidos no le interrumpen: recibe el daño pero sigue a lo suyo.',
  blindaje: 'Recibe un 12 % menos de daño de todo.',
  certero: 'Sus disparos de ki rápidos van un 40 % más deprisa y aturden más.'
};
const VS_PAS = {
  goku: 'tp|TRANSMISIÓN INSTANTÁNEA', vegeta: 'orgullo|ORGULLO SAIYAN', black: 'rose|EL DOLOR ME FORTALECE', piccolo: 'regen|REGENERACIÓN NAMEKIANA',
  gohan: 'potencial|PODER DESBLOQUEADO', gohankid: 'ira|FURIA DORMIDA', gohanf: 'esperanza|ÚLTIMA ESPERANZA', freezer: 'tirano|CRUELDAD DEL EMPERADOR', cooler: 'frio|FRIALDAD ABSOLUTA',
  krilin: 'senzu|JUDÍA SENZU', trunks: 'espada|FILO DEL FUTURO', trunksarm: 'acero|ACERO TEMPLADO', cell: 'copia|CÉLULAS PERFECTAS',
  bardock: 'zenkai|ZENKAI', bardockb: 'vision|VISIÓN DEL FUTURO', raditz: 'elite|GUERRERO DE ÉLITE', turles: 'fruto|FRUTO DEL ÁRBOL SAGRADO', caulifla: 'salvaje|TALENTO SALVAJE', kyabe: 'aprendiz|DISCÍPULO APLICADO', gotenss5: 'infantil|ENERGÍA INAGOTABLE',
  vegito: 'fusion|FUSIÓN POTARA', gogeta: 'metamor|FUSIÓN METAMOR', kefla: 'potara|POTARA DEL UNIVERSO 6', gotenks: 'fantasma|ATAQUE KAMIKAZE FANTASMA',
  zamasuf: 'divino|JUSTICIA DIVINA', zamasu: 'inmortal|INMORTALIDAD', majin: 'goma|CUERPO DE GOMA', superbuu: 'caramelo|RAYO CARAMELO',
  broly: 'armadura|FURIA IMPARABLE', kale: 'furia|BERSERKER', toppo: 'justicia|CUERPO DE LA JUSTICIA', andro16: 'blindaje|BLINDAJE PESADO',
  jiren: 'muralla|FUERZA ABSOLUTA', janemba: 'portal|BRECHA DIMENSIONAL', hitto: 'tiempo|SALTO TEMPORAL', bills: 'hakai|ENERGÍA DE LA DESTRUCCIÓN',
  andro17: 'infinito|ENERGÍA INFINITA', andro18: 'certero|DISPARO CERTERO', andro35: 'absorbe|ABSORCIÓN DE ENERGÍA', saibaman: 'kamikaze|AUTODESTRUCCIÓN',
  yamcha: 'lobo|LOBO DEL DESIERTO', ginyu: 'cambio|CAMBIO DE CUERPO', babyv: 'parasito|PARÁSITO TSUFUR', kamba: 'maligno|AURA MALIGNA', dabura: 'piedra|SALIVA DE PIEDRA'
};
function vsPas(ch) { const m = /^([a-z]+)\|(.+)$/.exec(VS_PAS[ch.id] || ''); return m && VS_PAS_INFO[m[1]] ? { type: m[1], name: m[2], info: VS_PAS_INFO[m[1]] } : null; }

/* Entradas: tp aparece de golpe · sky cae del cielo · fly llega volando · float baja flotando despacio · rise surge del suelo · aura ya está ahí y estalla su energía */
const VS_INTRO = {
  goku: 'tp', vegeta: 'sky', black: 'float', piccolo: 'float', gohan: 'fly', gohankid: 'fly', gohanf: 'fly', freezer: 'float', cooler: 'float', krilin: 'fly', trunks: 'fly', trunksarm: 'sky',
  cell: 'rise', bardock: 'sky', bardockb: 'aura', raditz: 'sky', turles: 'sky', caulifla: 'fly', kyabe: 'fly', gotenss5: 'fly', vegito: 'tp', gogeta: 'aura', kefla: 'aura', gotenks: 'fly',
  zamasuf: 'float', zamasu: 'float', majin: 'rise', superbuu: 'rise', broly: 'sky', kale: 'aura', toppo: 'sky', andro16: 'sky', jiren: 'aura', janemba: 'tp', hitto: 'tp', bills: 'float',
  andro17: 'fly', andro18: 'fly', andro35: 'sky', saibaman: 'rise', yamcha: 'fly', ginyu: 'sky', babyv: 'rise', kamba: 'aura', dabura: 'tp'
};

/* Frases: i = al entrar · w = al ganar (varias) · vi / vw = al entrar o ganar contra un rival concreto */
const VS_VOZ = {
  goku: { i: '¡Qué ganas tenía de esto! No te guardes nada.', w: ['¡Ha sido una pasada! ¿Repetimos cuando te recuperes?', 'Eres fuerte de verdad. Entrena y volvemos a pelear.'],
    vi: { vegeta: 'Vegeta, hoy tampoco pienso quedarme atrás.', freezer: 'Otra vez tú... Esta vez no habrá segunda oportunidad.', jiren: 'Llevo soñando con la revancha desde el torneo.', bills: 'Señor Bills, ¿me deja probar cuánto he mejorado?', broly: 'Tranquilo, Broly. Solo quiero pelear contigo.' },
    vw: { vegeta: '¡Casi me ganas, Vegeta! La próxima no sé qué pasará.', freezer: 'Vuelve por donde has venido, Freezer.', gohan: 'Estoy orgulloso de ti, hijo. Pero aún te queda.' } },
  vegeta: { i: 'Arrodíllate ante el príncipe de los saiyans.', w: ['Era de esperar. Soy el príncipe de una raza guerrera.', 'Ni siquiera me has hecho sudar. Qué decepción.'],
    vi: { goku: 'Kakarotto, hoy te bajo yo de las nubes.', freezer: 'Tengo una deuda pendiente contigo, Freezer.', trunks: 'Demuéstrame de qué está hecho mi hijo.', bills: 'No pienso arrodillarme, por muy dios que seas.' },
    vw: { goku: '¿Lo has visto, Kakarotto? ¡El número uno soy yo!', freezer: 'Por mi pueblo. Por mi padre. Y por mí.', trunks: 'No está mal... pero sigues siendo un crío.' } },
  black: { i: 'Admira la belleza de un dios en el cuerpo de un mortal.', w: ['Vuestro dolor solo me hace más hermoso.', 'Así se limpia un mundo de pecadores.'],
    vi: { goku: 'Qué curioso es mirarse en un espejo tan vulgar.', trunks: 'Sigues corriendo, humano. Me resulta entrañable.' }, vw: { goku: 'Este cuerpo ya solo tiene un dueño: yo.' } },
  piccolo: { i: 'No esperes que tenga compasión.', w: ['Vuelve cuando hayas meditado sobre tus errores.', 'Te faltaba concentración. Y unos cuantos años.'],
    vi: { gohan: 'Enséñame lo que has aprendido, Gohan.', gohankid: 'Nada de lloros, chaval. Ataca.', goku: 'Aún te debo una desde aquel torneo, Goku.' }, vw: { gohan: 'Bien hecho. Pero no bajes nunca la guardia.' } },
  gohan: { i: 'No me gusta pelear... pero no voy a contenerme.', w: ['Se acabó. Espero que no haya que repetirlo.', 'Protejo a los míos. Eso es todo.'],
    vi: { cell: 'No voy a cometer el mismo error dos veces, Célula.', piccolo: 'Señor Piccolo, míreme bien: esto es gracias a usted.' }, vw: { cell: 'Esta vez no he esperado a nadie.', goku: '¡Lo he conseguido, papá!' } },
  gohankid: { i: 'S-señor Piccolo... ¡estoy listo!', w: ['¡Lo he hecho! ¿Lo habéis visto?', 'Perdona... creo que me he pasado.'], vi: { raditz: '¡Deja en paz a mi papá!' }, vw: { raditz: '¡No vuelvas a hacer daño a mi papá!' } },
  gohanf: { i: 'Mientras me quede un brazo, seguiré luchando.', w: ['Uno menos. Este mundo todavía tiene futuro.', 'Trunks... algún día esto será cosa tuya.'],
    vi: { andro17: 'Hoy pagáis por todo lo que habéis destruido.', andro18: 'No pienso dejar que arraséis otra ciudad.' }, vw: { trunks: 'Has crecido mucho. Ya casi me alcanzas.' } },
  freezer: { i: 'Qué amable por tu parte venir a morir en persona.', w: ['¡Jo, jo, jo! Ha sido un espectáculo de lo más patético.', 'Recuérdalo bien: nadie desafía al emperador.'],
    vi: { goku: 'Saiyan... llevo mucho tiempo esperando este momento.', vegeta: 'El principito de los monos ha aprendido a ladrar.', bardock: 'Otro mono testarudo. Sois una plaga.', cooler: 'Hermano, siempre tan pendiente de lo mío.' },
    vw: { goku: 'Por fin. ¡Por fin te veo a mis pies, saiyan!', vegeta: 'Igual que tu padre: mucho orgullo y poca cosa más.' } },
  cooler: { i: 'Yo no cometo los errores de mi hermano.', w: ['Limpio y rápido. Así se hace.', 'El universo solo tiene sitio para el más fuerte.'], vi: { freezer: 'Padre te mimó demasiado, Freezer.', goku: 'Tú eres el mono que humilló a mi familia.' }, vw: { freezer: 'Siempre fuiste el blando de la familia.' } },
  krilin: { i: 'Vale, vale... Me toca a mí. ¡Allá voy!', w: ['¡He ganado! ¡Que alguien se lo cuente a todos!', 'Uf... Menos mal que llevaba una judía.'], vi: { andro18: 'Cariño, luego no te enfades, ¿eh?', goku: '¡Como en los viejos tiempos, Goku!' }, vw: { andro18: 'Esto... ¿sigue en pie lo de cenar fuera?' } },
  trunks: { i: 'He venido a cambiar el futuro.', w: ['Por un futuro en paz.', 'No pienso perder a nadie más.'],
    vi: { freezer: 'Tú eres Freezer. Seré rápido.', black: '¡Devuélveme mi mundo, impostor!', zamasu: 'Tu justicia ha destruido mi hogar.', vegeta: 'Padre, quiero que veas hasta dónde he llegado.' },
    vw: { freezer: 'Un tajo. No hacía falta más.', black: 'Mi futuro no te pertenece.' } },
  trunksarm: { i: 'Con esta espada he sobrevivido al fin del mundo.', w: ['El acero no miente.', 'He visto cosas peores que tú.'], vi: { black: 'Esta vez no voy a huir.' }, vw: { black: 'Por todos los que no pudieron verlo.' } },
  cell: { i: 'Bienvenido. Seré tu rival... y tu final.', w: ['Otra prueba de que soy perfecto.', 'Gracias. Tu energía me ha sentado de maravilla.'],
    vi: { gohan: 'Vamos, enfádate. Enséñame ese poder.', gohankid: 'Así que este niño es el arma secreta...', andro17: 'Diecisiete, sé buen hermano y déjate absorber.', andro18: 'Me faltas tú para estar completo.' }, vw: { gohan: 'Esta vez la perfección ha ganado.', goku: 'Llevo tus células, Goku. No podías sorprenderme.' } },
  bardock: { i: 'Yo decido mi destino. Y el tuyo.', w: ['Esto va por toda mi gente.', 'Un guerrero de clase baja también sabe ganar.'], vi: { freezer: '¡Freezer! ¡Esto se acaba aquí!', goku: 'Así que tú eres Kakarotto... Has crecido.' }, vw: { freezer: 'Lo vi en mis visiones. Y se ha cumplido.', goku: 'Aún le puedo enseñar algo a mi hijo.' } },
  bardockb: { i: 'He visto el final. Tú no sales en él.', w: ['El destino ya estaba escrito.', 'Ni las visiones me avisaron de alguien tan flojo.'] },
  raditz: { i: 'Un guerrero de élite no pierde el tiempo. Acabemos.', w: ['¡Ja! Tu nivel de combate era ridículo.', 'Eso te pasa por plantar cara a un saiyan.'], vi: { goku: 'Hermanito, qué vergüenza de saiyan estás hecho.' }, vw: { goku: 'Deberías haberte unido a mí, Kakarotto.' } },
  turles: { i: 'El fruto del árbol sagrado me ha hecho invencible.', w: ['Los débiles solo sirven de abono.', 'Qué desperdicio de planeta. Y de rival.'], vi: { goku: 'Somos iguales, Kakarotto. Solo que yo sí tengo ambición.' } },
  caulifla: { i: '¡Venga, que me aburro! ¡Dame guerra!', w: ['¡Ja! ¿Eso era todo? ¡Otro!', 'Apunta mi nombre: Caulifla, la más fuerte del Universo 6.'], vi: { kale: 'Kale, sin miedo. ¡Pégame con todo!', goku: '¡Enséñame ese truco tuyo, viejo!' }, vw: { kale: 'Bien peleado, hermanita. Cada día pegas más fuerte.' } },
  kale: { i: 'Y-yo... lo siento de antemano.', w: ['¿He... he ganado? ¡Hermana, mira!', 'Perdona. No sé controlar mi fuerza.'], vi: { caulifla: 'Hermana... no quiero hacerte daño.' }, vw: { caulifla: '¡Lo siento, hermana! ¿Estás bien?' } },
  kyabe: { i: 'Será un honor combatir contigo.', w: ['Gracias por el combate. He aprendido mucho.', '¡Maestro Vegeta, lo he conseguido!'], vi: { vegeta: 'Maestro, le ruego que no se contenga.' }, vw: { vegeta: '¡Todo lo que sé me lo enseñó usted!' } },
  gotenss5: { i: '¡Me toca! ¡Mira qué pelo tengo ahora!', w: ['¡Toma ya! ¿Se lo puedo contar a Trunks?', '¡Ha sido divertidísimo! ¿Otra?'], vi: { goku: '¡Papá, mira lo que sé hacer!' } },
  vegito: { i: 'Somos dos en uno. No te va a hacer gracia.', w: ['¿Ya? Si estaba calentando.', 'Ni con el doble de fuerza me habrías tocado.'], vi: { zamasuf: 'Un dios fusionado. Mira qué casualidad.', superbuu: 'Venga, globo rosa, hazme reír.', gogeta: 'A ver cuál de las dos fusiones sale mejor.' }, vw: { zamasuf: 'Tu fusión tenía un defecto: tú.' } },
  gogeta: { i: 'No soy Goku ni Vegeta. Soy quien va a derrotarte.', w: ['Fin del combate.', 'Tu maldad se disuelve aquí.'], vi: { janemba: 'Voy a purificar toda esa maldad.', broly: 'Basta de destrozos, Broly.', vegito: 'Los pendientes hacen trampa. Lo nuestro es baile.' }, vw: { janemba: 'Ya puedes descansar.' } },
  kefla: { i: '¡Esta fuerza es una locura! ¡Voy a probarla contigo!', w: ['¡Ja, ja! ¡No hay quien me pare!', 'Dos saiyans en una. No tenías nada que hacer.'], vi: { goku: '¡Ahora sí que te voy a borrar esa sonrisa!' } },
  gotenks: { i: '¡Tachán! ¡Ha llegado el héroe de la justicia, Gotenks!', w: ['¡Soy genial! ¡Que alguien me haga una foto!', '¡Victoria para el guapísimo Gotenks!'], vi: { superbuu: '¡Te voy a dejar hecho un chicle, Buu!', piccolo: 'Tú mira y aprende, Piccolo.' }, vw: { superbuu: '¡Chúpate esa, chicle con patas!' } },
  zamasuf: { i: 'Contempla la forma suprema de un dios.', w: ['La justicia se ha cumplido.', 'Los mortales nunca debisteis existir.'], vi: { vegito: 'Imitáis a los dioses con baratijas.', trunks: 'Tú eres el pecado que queda por borrar.' } },
  zamasu: { i: 'Los mortales sois el único error de la creación.', w: ['Un pecador menos.', 'No te resistas a la voluntad de un dios.'], vi: { goku: 'Un mortal que desafía a los dioses. Intolerable.' } },
  majin: { i: '¡Buu quiere jugar! ¡Y luego merendar!', w: ['¡Buu gana! ¡Ahora tú eres una galleta!', '¡Je, je! Buu es el más fuerte.'], vi: { gotenks: '¡Buu te convierte en caramelo!' } },
  superbuu: { i: 'Me aburro. A ver cuánto me duras.', w: ['Qué poca cosa. Ni para chocolate vales.', 'El siguiente. Tengo hambre.'], vi: { gotenks: 'Tú. El niño ruidoso. Te quiero para mí.', gohan: 'Contigo sería el más fuerte de todos.', vegito: 'No pienso picar otra vez con ese truco.' }, vw: { gohan: 'Ahora tu poder también es mío.' } },
  broly: { i: '¡¡GRRRAAAAH!!', w: ['¡¡KAKAROTTOOO!!', '...Más. Quiero más.'], vi: { goku: '¡¡Kakarotto...!! ¡¡KAKAROTTOOO!!' }, vw: { goku: '¡¡KAKAROTTO!! ¡¡POR FIN!!' } },
  toppo: { i: '¡En nombre de la justicia, te detendré!', w: ['¡La justicia siempre prevalece!', 'Aprende esta lección: el mal nunca gana.'], vi: { freezer: 'Tú eres el mal en persona. No habrá piedad.', jiren: 'Jiren, permíteme medirme contigo, camarada.' } },
  jiren: { i: '...', w: ['La fuerza lo es todo. El resto no importa.', 'No estabas a la altura.'], vi: { goku: 'Tú otra vez. Enséñame si ese poder era real.' }, vw: { goku: 'Confías demasiado en los demás.' } },
  janemba: { i: 'Grrr... ¡Janemba!', w: ['¡Je, je, je... Janemba!', '¡JANEMBAAA!'] },
  hitto: { i: 'Es un encargo. Nada personal.', w: ['Trabajo terminado.', 'No has llegado a ver el golpe. Como todos.'], vi: { goku: 'Tú eres el único que mejora más rápido que yo.', jiren: 'Veamos si el tiempo también puede contigo.' }, vw: { goku: 'La próxima vez no tendré ventaja. Lo sé.' } },
  bills: { i: 'Me has despertado de la siesta. Más vale que valga la pena.', w: ['Qué aburrimiento. Me vuelvo a dormir.', 'Da gracias a que no he destruido también el planeta.'], vi: { goku: 'A ver si ya no me haces bostezar, Goku.', vegeta: 'Si pierdes, tu mujer me debe una comida.', freezer: 'Compórtate, Freezer. O te destruyo.' }, vw: { goku: 'Has mejorado. Sigue así y quizá me divierta.' } },
  andro16: { i: 'No deseo luchar contigo. Apártate.', w: ['Combate finalizado. Los pájaros pueden volver.', 'No era necesario llegar a esto.'], vi: { goku: 'Objetivo localizado: Son Goku.', cell: 'No dejaré que hagas más daño a este mundo.' } },
  andro17: { i: 'Tranquilo, esto es solo un juego.', w: ['Y sin despeinarme.', 'Vuelvo al trabajo. Los furtivos no descansan.'], vi: { andro18: 'Hermana, el que pierda paga la ropa nueva.', cell: 'No pienso acabar otra vez en tu estómago.' }, vw: { andro18: 'Esta vez gano yo, hermanita.' } },
  andro18: { i: 'Date prisa, que no tengo todo el día.', w: ['¿Ya está? Pues me debes un vestido.', 'Qué pérdida de tiempo.'], vi: { krilin: 'No te voy a dejar ganar solo por ser tú.', andro17: 'Sigues igual de creído, Diecisiete.' }, vw: { krilin: 'No pongas esa cara. Hoy invito yo.' } },
  andro35: { i: 'Iniciando protocolo de eliminación.', w: ['Objetivo eliminado. Energía al 100 %.', 'Tu energía ha sido asimilada.'] },
  saibaman: { i: '¡Kiii! ¡Kiii!', w: ['¡Gi, gi, gi, gi!', '¡Kiiiii!'], vi: { yamcha: '¡Ki, ki, ki...!' }, vw: { yamcha: '¡¡GI, GI, GI!!' } },
  yamcha: { i: '¡Ha llegado el lobo del desierto!', w: ['¿Lo has visto? ¡Aún estoy en forma!', '¡Ja! Y decían que yo no pintaba nada.'], vi: { saibaman: 'Otra vez tú... Esta vez no me vas a pillar.', krilin: 'Tranquilo, Krilin, seré suave.' }, vw: { saibaman: '¡Por fin! ¡Ya no me lo podrán recordar!' } },
  ginyu: { i: '¡El capitán de las Fuerzas Especiales... Ginyu!', w: ['¡Pose de la victoria! ¡Fuerzas Especiales!', 'Buen cuerpo el tuyo. Me lo apunto.'], vi: { goku: 'Ese cuerpo tuyo me interesa mucho.', freezer: 'Señor Freezer, ¡es solo una demostración!' } },
  babyv: { i: 'Los tsufur vamos a recuperar lo que es nuestro.', w: ['Este cuerpo saiyan es una maravilla.', 'La venganza de mi pueblo acaba de empezar.'], vi: { vegeta: 'Qué raro verme desde fuera.', goku: 'Tú serás el último saiyan en caer.' } },
  kamba: { i: 'Tu energía... huele deliciosa.', w: ['Más. Necesito más energía.', 'Has servido de aperitivo.'] },
  dabura: { i: 'El rey del mundo demoníaco te concede una audiencia.', w: ['Otra estatua para mi colección.', 'En el infierno ya te guardan sitio.'], vi: { gohan: 'Percibo mucha rabia escondida en ti.', majin: 'Buu, te recuerdo quién te despertó.' } }
};
const VS_VOZ_DEF = { i: '¡Vamos allá!', w: ['¡Victoria!', 'Buen combate.'] };
/** Frase de un guerrero. kind: 'i' entrada · 'w' victoria. rival: id del rival (si tiene una frase para él, se usa esa) */
function vsVoz(id, kind, rival) {
  const v = VS_VOZ[id] || VS_VOZ_DEF, sp = v[kind === 'i' ? 'vi' : 'vw'];
  if (sp && sp[rival]) return sp[rival];
  const s = v[kind] || VS_VOZ_DEF[kind]; return Array.isArray(s) ? s[(Math.random() * s.length) | 0] : s;
}
