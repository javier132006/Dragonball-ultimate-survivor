'use strict';
/* =====================================================================
   versus/ults.js · Qué Ultimate tiene cada guerrero en cada forma.

   Cada entrada es 'tipoV|NOMBRE':
     tipo = coreografía (beam, rush, bomb, storm, discs, slash, rift, nova, grab, volley,
            clone, cage, drain, wave, spin)
     V    = variante 0, 1 o 2 de esa coreografía (ver sim.js → Ultimates)
   Regla: dentro de un guerrero ninguna forma repite tipo+variante, y ningún
   nombre se repite en todo el plantel. Se usan los nombres del anime y de
   los videojuegos cuando la técnica existe; el resto son inventados.

   VS_ULTS[id]      → una entrada por forma BASE del guerrero, en su orden.
   VS_ULT_ALTAR[id] → formas del Altar de Shenron (se añaden al final de la
                      lista de formas, así que van por su id y no por posición).
   ===================================================================== */
const VS_ULTS = {
  goku: ['beam0|KAMEHAMEHA', 'rush0|ATAQUE KAIOKEN', 'beam1|KAMEHAMEHA INSTANTÁNEO', 'rush1|COMBINACIÓN METEORO', 'rush2|PUÑO DEL DRAGÓN', 'beam2|KAMEHAMEHA x10',
    'volley2|JUICIO DEL DIOS SAIYAN', 'storm1|TORMENTA AZUL DIVINA', 'grab2|KAIOKEN x20: ESTALLIDO', 'bomb1|GENKIDAMA UNIVERSAL', 'slash2|DANZA DEL ULTRA INSTINTO'],
  vegeta: ['beam0|GALICK GUN', 'bomb0|BIG BANG ATTACK', 'beam2|FINAL FLASH', 'nova2|EXPLOSIÓN FINAL', 'beam1|FINAL SHINE ATTACK', 'volley1|RÁFAGA DEL PRÍNCIPE DIVINO',
    'rush2|GOLPE DEL ORGULLO SAIYAN', 'storm2|LLUVIA GAMMA FINAL'],
  black: ['beam0|KAMEHAMEHA NEGRO', 'rift0|GRIETA DE BLACK', 'slash0|GUADAÑA DEL DOLOR', 'storm1|LAZO DIVINO'],
  piccolo: ['beam0|MAKANKOSAPPO', 'storm0|HELLZONE GRENADE', 'volley1|GEKIRETSU KODAN', 'grab0|DEMOLICIÓN DEL GIGANTE NARANJA'],
  gohan: ['beam0|SUPER MASENKO', 'volley1|CAÑÓN DE KI DESBOCADO', 'beam2|KAMEHAMEHA PADRE-HIJO', 'beam1|MAKANKOSAPPO BESTIAL'],
  freezer: ['beam0|RAYO MORTAL', 'cage1|PRISIÓN DE LA MUERTE', 'bomb0|DEATH BALL', 'discs0|DISCOS DE LA MUERTE', 'bomb1|GOLDEN DEATH BALL'],
  krilin: ['discs0|KIENZAN', 'storm0|KAKUSANDAN', 'discs1|KIENZAN MÚLTIPLE', 'discs2|GRAN KIENZAN TELEDIRIGIDO'],
  trunks: ['slash0|SHINING SWORD ATTACK', 'bomb0|BURNING ATTACK', 'beam2|GALICK GUN DE LA FURIA'],
  cell: ['drain0|AGUIJÓN ABSORBENTE', 'volley0|RÁFAGA SEMIPERFECTA', 'beam2|KAMEHAMEHA SOLAR', 'nova1|BARRERA PERFECTA'],
  bardock: ['bomb0|CAÑÓN ESPIRITUAL FINAL', 'rush0|LANZA DE LA REBELIÓN', 'wave1|RUGIDO DEL SIMIO DORADO'],
  vegito: ['volley0|BANSHEE BLAST', 'slash0|ESPADA ESPIRITUAL', 'slash1|EXCALIBUR ESPIRITUAL', 'beam2|FINAL KAMEHAMEHA'],
  gogeta: ['rush0|PUNISHER DRIVE', 'bomb0|SOUL PUNISHER', 'volley1|METEOR EXPLOSION', 'storm1|STARDUST FALL', 'beam2|BIG BANG KAMEHAMEHA x100'],
  zamasuf: ['storm0|CUCHILLAS DEL JUICIO', 'storm2|RELÁMPAGO DE LA ABSOLUCIÓN', 'bomb1|IRA SAGRADA'],
  broly: ['grab0|LARIAT GIGANTE', 'volley0|BLASTER SHELL', 'bomb0|OMEGA BLASTER', 'grab2|ESTALLIDO GIGANTE', 'bomb1|GIGANTIC METEOR'],
  kefla: ['volley0|FAST CANNON BALL', 'beam1|GIGANTIC BLAST', 'spin1|GIGANTIC RAY', 'beam2|GIGANTIC BURST'],
  gotenks: ['cage1|DONUTS GALÁCTICOS', 'clone1|SUPER GHOST KAMIKAZE', 'grab0|VOLEIBOL BUU BUU', 'volley1|MISILES MUERE-MUERE'],
  trunksarm: ['slash0|ESPADA DEL FUTURO', 'bomb0|FINISH BUSTER', 'slash1|TAJO RELÁMPAGO', 'rift0|HEAT DOME ATTACK'],
  caulifla: ['volley0|CRUSH CANNON', 'beam1|GALICK SALVAJE', 'rush0|FURIA DEL UNIVERSO 6', 'bomb0|ESFERA DE LA REBELDE'],
  kale: ['wave0|ALARIDO DE KALE', 'grab0|AGARRE BERSERKER', 'volley1|BLASTER METEOR', 'bomb1|ERASER CANNON LEGENDARIO'],
  kyabe: ['beam0|GALICK CANNON', 'discs0|LLUVIA DE DISCOS', 'rush0|ASALTO DEL DISCÍPULO', 'beam2|GALICK CANNON MÁXIMO'],
  toppo: ['volley0|JUSTICE FLASH', 'grab0|JUSTICE CRUSHER', 'wave1|JUSTICIA DE PRIDE', 'nova1|ENERGÍA DE LA DESTRUCCIÓN'],
  janemba: ['slash0|ESPADA DIMENSIONAL', 'cage2|PRISIÓN DIMENSIONAL', 'slash2|RUPTURA DEL CAOS', 'rift2|PUERTA DEL INFIERNO'],
  jiren: ['bomb0|POWER IMPACT', 'rush0|PUÑOS INVISIBLES', 'wave1|MIRADA ABRUMADORA', 'beam2|MAGNETRÓN ABRASADOR'],
  turles: ['discs0|KILL DRIVER', 'beam1|CALAMITY BLASTER', 'drain0|RAÍCES DEL ÁRBOL SAGRADO', 'bomb1|METEORO DEL FRUTO SAGRADO'],
  saibaman: ['grab2|AUTODESTRUCCIÓN', 'volley0|ÁCIDO CORROSIVO', 'clone0|ENJAMBRE SAIBAMAN', 'nova2|SACRIFICIO SAIBAMAN'],
  bills: ['bomb0|ESFERA DE LA DESTRUCCIÓN', 'volley1|DEDO DEL DESTRUCTOR', 'cage2|JUICIO DE BILLS', 'nova1|HAKAI'],
  cooler: ['spin0|RAYO OCULAR DEL TIRANO', 'volley0|DEATH FLASH', 'grab1|CASTIGO DEL HERMANO MAYOR', 'bomb1|SUPERNOVA'],
  hitto: ['clone0|GOLPE DEL ASESINO', 'slash2|SALTO TEMPORAL', 'cage0|JAULA DEL TIEMPO', 'grab2|TIEMPO ACUMULADO'],
  raditz: ['spin2|DOUBLE SUNDAY', 'bomb0|SATURDAY CRUSH', 'volley0|SHINING FRIDAY', 'rush1|WEEKEND'],
  andro16: ['rush0|PUÑO COHETE', 'grab2|HELL\'S FLASH', 'grab0|MARTILLO DEL ANDROIDE', 'nova2|AUTODESTRUCCIÓN DEL 16'],
  andro17: ['volley0|POWER BLITZ', 'nova0|BARRERA ANDROIDE', 'discs1|DISCO INFINITO', 'clone0|ASALTO DEL GUARDABOSQUES'],
  andro18: ['volley0|BALAS INFINITAS', 'discs0|DISCO DESTRUCTOR DOBLE', 'spin2|TORMENTA DEL 18', 'rush2|COMBINACIÓN IMPLACABLE'],
  majin: ['spin0|RAYO DE CARAMELO', 'grab0|PLANCHA DE BUU', 'nova0|EXPLOSIÓN DE IRA', 'bomb0|BOLA INOCENTE'],
  superbuu: ['storm0|EXTERMINIO HUMANO', 'beam1|KAMEHAMEHA DE BUU', 'drain1|ABSORCIÓN ELÁSTICA', 'bomb1|GALAXIA DE BUU'],
  zamasu: ['slash0|CUCHILLA DIVINA', 'spin1|BARRIDO DE LUZ', 'clone1|JUSTICIA INMORTAL', 'rift0|PILAR DEL JUICIO'],
  yamcha: ['discs2|SÔKIDAN', 'rush0|COLMILLO DEL LOBO', 'clone1|NEO COLMILLO DEL LOBO', 'beam1|KAMEHAMEHA DEL LOBO'],
  gohankid: ['beam0|MASENKO', 'rush0|CABEZAZO FURIOSO', 'wave0|ESTALLIDO DE IRA', 'beam2|MASENKO DESATADO'],
  ginyu: ['beam0|MILKY CANNON', 'volley0|DYNAMITE STRIKE', 'clone2|ASALTO DE LAS FUERZAS GINYU', 'drain2|CAMBIO DE CUERPO'],
  dabura: ['wave2|LLAMARADA DEL MAKAI', 'slash0|ESPADA DEL REY DEMONIO', 'storm0|LANZAS DEL MAL', 'cage0|PRISIÓN DEL MAKAI'],
  gohanf: ['beam0|MASENKO DEFINITIVO', 'rush0|ASALTO CON UN SOLO BRAZO', 'volley1|RÁFAGA DE LA ESPERANZA', 'beam1|KAMEHAMEHA DEL FUTURO'],
  andro35: ['drain2|ABSORCIÓN DE ENERGÍA', 'spin0|CAÑÓN DE NÚCLEO', 'discs1|ANILLOS DE ENERGÍA', 'nova1|COLAPSO DEL REACTOR'],
  kamba: ['bomb0|EXPLOSIÓN MALIGNA', 'rift0|GRIETA MALIGNA', 'cage2|TORMENTO DEMONÍACO', 'beam2|RAYO DEL SAIYAJIN DEL MAL'],
  babyv: ['bomb0|REVENGE DEATH BALL', 'beam2|FINAL FLASH DE LA VENGANZA', 'drain1|PARÁSITO TSUFUR', 'bomb2|TRIPLE BOLA DE LA VENGANZA'],
  bardockb: ['spin1|LANZA DEL DESTINO NEGRO', 'rush0|REBELIÓN OSCURA', 'volley2|OJOS DEL DESTINO', 'bomb1|CAÑÓN DEL DESTINO NEGRO'],
  gotenss5: ['beam0|KAMEHAMEHA PLATEADO', 'rush1|METEORO PLATEADO', 'bomb0|GENKIDAMA DEL HEREDERO', 'beam1|KAMEHAMEHA DE LA FAMILIA SON']
};
const VS_ULT_ALTAR = {
  goku_mui: 'nova1|AURA DEL DIOS PLATEADO', goku_ss4g: 'wave2|RUGIDO DEL DRAGÓN CARMESÍ', goku_ssjgb: 'grab1|FURIA DEL DIOS BERSERKER', goku_lssj: 'nova2|ESTALLIDO LEGENDARIO',
  goku_jacket: 'clone2|TELETRANSPORTE MÚLTIPLE',
  black_uir: 'slash2|JUICIO DEL INSTINTO ROSÉ', black_rkk: 'rush1|KAIOKEN ROSÉ: CAÍDA DIVINA',
  gohan_ss5: 'rush2|PUÑO DEL LOBO PLATEADO', trunks_dbs: 'slash2|CORTE DE LA ESPERANZA', trunks_ss5: 'slash1|COLMILLO PLATEADO',
  bardock_ssjl: 'beam1|GATILLO DE LA REBELIÓN', bardock_ss5: 'rift1|COLMILLOS DEL DESTINO',
  vegito_ego: 'nova1|EGO DEL DIOS FUSIONADO', vegito_b3: 'beam1|FINAL KAMEHAMEHA DESCENDENTE', vegito_gkk: 'rush2|IMPACTO KAIOKEN DIVINO',
  broly_fssj: 'wave0|RUGIDO DE LA IRA', jiren_fp: 'rush2|GOLPE DEL PODER TOTAL', super17: 'volley1|FLASH BOMBER',
  buu_gordo: 'nova1|VAPOR DE FURIA', buu_zamasu: 'rift1|ABSOLUCIÓN ROSA'
};
/* Textos de ayuda: qué hace cada coreografía (se enseña al elegir luchador) */
const VS_ULT_INFO = {
  beam: ['Rayo', 'Rayo desde el cielo', 'Rayo gigante'], rush: ['Lluvia de golpes', 'Golpes y meteoro', 'Golpes y puño final'], bomb: ['Esfera gigante', 'Esfera con anillo de explosiones', 'Triple esfera'],
  storm: ['Lluvia de ki', 'Lluvia de ki con impacto final', 'Anillos de ki que se cierran'], discs: ['Discos teledirigidos', 'Discos que rodean', 'Disco gigante que vuelve'],
  slash: ['Cortes en cruz', 'Cortes y tajo desde el cielo', 'Cortes que estallan a la vez'], rift: ['Grieta y pilar', 'Tres grietas', 'Cuatro grietas que convergen'],
  nova: ['Explosión corporal', 'Doble explosión', 'Explosión total (cuesta vida)'], grab: ['Agarre y caída', 'Agarre, lanzamiento y esfera', 'Agarre y explosiones'],
  volley: ['Ráfaga de ki', 'Ráfaga con disparo final', 'Ráfaga desde todas direcciones'],
  clone: ['Imágenes múltiples', 'Imágenes y caída final', 'Imágenes que disparan a la vez'], cage: ['Prisión de ki', 'Prisión que estrella', 'Prisión con lanzas'],
  drain: ['Absorbe vida', 'Absorbe y estalla', 'Absorbe vida y ki'], wave: ['Onda por el suelo', 'Tres ondas', 'Onda de ida y vuelta'], spin: ['Rayo giratorio', 'Rayo de ida y vuelta', 'Doble rayo giratorio']
};
/** Ultimate de la forma f (índice fi) del guerrero ch. k = transformaciones hechas en el combate para llegar a ella */
function vsUlt(ch, f, fi, k) {
  const T = VS_ULTS[ch.id], s = (f.gacha && VS_ULT_ALTAR[f.gacha]) || (T && T[Math.min(fi, T.length - 1)]), m = s && /^([a-z]+)([0-2])\|(.+)$/.exec(s);
  if (m) return { type: m[1], v: +m[2], name: m[3], sup: k > 0 };
  const t = ch.ult && ch.ult.type, ty = t === 'beam' ? 'beam' : t === 'rift' ? 'rift' : t === 'bomb' ? 'bomb' : t === 'storm' ? 'storm' : t === 'discs' ? 'discs' : t === 'slash' ? 'slash' : 'rush';   // guerrero sin tabla: según su Ultimate del juego principal
  return { type: ty, v: Math.min(2, k), name: (ch.ult && ch.ult.name) || 'ULTIMATE', sup: k > 0 };
}
