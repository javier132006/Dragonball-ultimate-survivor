'use strict';
/* =====================================================================
   versus/narrador.js · Narrador del Versus
   Comenta el combate con las voces que el jugador haya puesto en assets/local/narrador/ (localaudio.js).
   Sin esos archivos no suena nada. Lo llama versus.js: VsNarr.ev(evento) con los eventos de sim.js,
   VsNarr.intro(i) al presentar a cada luchador y VsNarr.win(...) en la pantalla de victoria.
   ===================================================================== */
/** Nombre corto de cada luchador para «nameshort_x» y «victoryname_x» */
const VS_NARR_NAME = {
  a17: 'android17', a18: 'android18', bardock: 'bardock', bardockssj: 'bardock', beerus: 'bills', brolydbs: 'broly', brolyz: 'broly',
  cell: 'cell', freezer: 'freeza', ginyu: 'ginyu', gogetablue: 'gogeta', gogetassj4: 'gogeta', gohanbeast: 'gohan', gohanssj2: 'gohan',
  miraigohan: 'gohan', goku: 'goku', gokussj: 'goku', gokublue: 'goku', gokuui: 'goku', black: 'gokublack', hit: 'hitto', janemba: 'janemba',
  jiren: 'jiren', kefla: 'kefla', kidbuu: 'kidbuu', nappa: 'nappa', piccolo: 'piccolo', baby: 'superbaby2', tien: 'tienshinhan',
  miraitrunks: 'trunks', vegeta: 'vegeta', vegetaego: 'vegeta', vegetassj: 'vegetassj', vegettoblue: 'vegetto', zamasu: 'zamasu'
};
/** Frases según los golpes del combo (se dice la del mayor umbral alcanzado, una vez por combo) */
const VS_NARR_COMBO = [[30, ['battle_meteoric', 'battle_wonderfulpower']], [20, ['battle_amazing', 'battle_fantastic']], [14, ['battle_excellent', 'battle_wonderful']],
  [9, ['battle_great', 'battle_impressive']], [5, ['battle_good', 'battle_nice']]];

const VsNarr = {
  vs: null, last: 0, said: [0, 0],
  /** Empieza un combate */
  begin(vs) { this.vs = vs; this.last = 0; this.said = [0, 0]; if (typeof LocalAudio !== 'undefined') LocalAudio.preload(); },
  on() { return typeof LocalAudio !== 'undefined' && LocalAudio.M && LocalAudio.M.narrador && LocalAudio.M.narrador.length; },
  /** Dice una de las frases (la primera que exista, o una al azar si rnd) */
  say(list, pri, rnd) {
    const L = [].concat(list).filter((n) => LocalAudio.has(n)); if (!L.length) return false;
    return LocalAudio.say(rnd ? L[(Math.random() * L.length) | 0] : L[0], pri);
  },
  /** Luchador de Z Legends 3 de un lado (por su hoja z_<cid>) */
  cid(i) { const a = this.vs && this.vs.actors && this.vs.actors[i], s = a && a.def.sheet; return /^z_/.test(s || '') ? s.slice(2) : ''; },
  name(i) { return VS_NARR_NAME[this.cid(i)] || ''; },
  /** Presentación del luchador i (su nombre corto) */
  intro(i) { if (this.on()) { const n = this.name(i); if (n) this.say('nameshort_' + n, 2); } },
  /** Un evento de sim.js */
  ev(e) {
    if (!this.on()) return;
    const vs = this.vs, now = performance.now() / 1000, free = now - this.last > 2.2;   // los comentarios del combate, como mucho uno cada 2 s
    const nota = (list, pri, rnd) => { if (this.say(list, pri, rnd)) this.last = now; };
    switch (e.t) {
      case 'round': if (!(vs && vs.intro)) nota('ready', 3); break;
      case 'fight': nota(['fight', 'go'], 3); break;
      case 'dmg': {
        const s = this.said, a = 1 - e.i;                                    // e.i: el que recibe; a: el que pega
        if (e.cmb < 3) { s[a] = 0; break; }
        for (const [n, L] of VS_NARR_COMBO) if (e.cmb >= n) { if (s[a] < n && free) { s[a] = n; nota(L, 1, true); } break; }
        break;
      }
      case 'sparkOn': nota('battle_sparking', 2); break;
      case 'tagIn': if (!e.ko) nota('battle_change', 2); break;
      case 'ultStart': if (free) nota(['battle_superpower', 'battle_maximumpower'], 1, true); break;
      case 'spike': if (free) nota('battle_smash', 1); break;
      case 'clashWin': nota('battle_impressive', 2); break;
      case 'final': nota('battleend_dramaticfinish', 4); break;
      case 'ko': nota('ko', 4); break;
      case 'timeup': nota('ko', 4); break;
    }
  },
  /** Pantalla de victoria: «perfect» o «you win / you lose» y después el nombre del ganador */
  win(w, perfect, vsCpu) {
    if (!this.on()) return;
    const first = perfect ? 'battleend_perfect' : vsCpu ? (w === 0 ? 'battleend_youwin' : 'battleend_youlose') : 'battleend_win';
    this.say([first, 'battleend_win', 'vitoria'], 5);
    const n = this.name(w), nm = n === 'vegetto' ? ['victoryname_vegettoblue', 'victoryname_vegetto'] : ['victoryname_' + n];
    if (n) setTimeout(() => this.say(nm, 5), 1500);
  }
};
