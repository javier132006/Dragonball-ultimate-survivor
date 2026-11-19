'use strict';
/* =====================================================================
   versus/versus.js · Controlador del MODO VERSUS.
   Módulo independiente: tiene su escena, su cámara, su HUD y su menú. El
   juego principal solo hace tres cosas: crear `new Versus(game)`, cederle
   el fotograma mientras está activo y ofrecer un botón para abrirlo.
     input.js  quién pulsa (teclado, mando, IA, red)  →  órdenes
     sim.js    reglas del combate a paso fijo          →  eventos
     view.js   sprites, arena, efectos, cámara, post
     versus.js une las tres capas, pinta el HUD y lleva los menús
   Los luchadores salen de los guerreros que ya tiene el juego (CHARACTERS):
   cada ficha es una hoja de sprites + su mapa de animaciones.
   ===================================================================== */
/* La hoja de estilos (VS_CSS) está en versus/estilo.js */
/** Ayuda de teclas en combate y pestaña Controles: salen de las teclas que tenga puestas cada jugador */
const vsK = (p, a) => '<b>' + vsKeyName(VS_KEYS[p][a]) + '</b>';
const vsHint = () => { const k = (a) => vsK(0, a); return ['f', 'l', 'k', 'r'].map((a) => vsKeyName(VS_KEYS[0][a])).join('').replace(/^(.*)$/, '<b>$1</b>') + ' mover · ' + k('UP') + '/' + k('DOWN') + ' subir/bajar · ' + k('ATK') + ' golpe · ' + k('HEAVY') + ' fuerte · ' + k('KI') + ' ki · ' + k('GUARD') + ' guardia · ' + k('DASH') + ' dash · ' + k('TP') + ' teletransporte · ' + k('CHARGE') + ' cargar · ' + k('ULT') + ' Ultimate · ' + k('TRANS') + ' transformarse · <b>Esc</b> pausa'; };
const VS_KEYS_TIPS = '' +
  '<h4>MANDO</h4><b>X</b> golpe · <b>Y</b> fuerte · <b>B</b> ki · <b>A</b> dash · <b>LB</b> guardia · <b>RB</b> teletransporte · <b>LT</b> cargar · <b>RT</b> Ultimate · <b>pulsar un stick</b> transformarse · cruceta ↑↓ subir/bajar<br>El primer mando es del jugador 1; el segundo, del jugador 2.' +
  '<h4>COMBO</h4>Cada pulsación de <b>golpe</b> es un golpe. Si conectas los 4, pulsa una vez más: sale sola una <b>ráfaga</b> de golpes rápidos que manda al rival volando. Tras cualquier golpe puedes cortar con el <b>golpe fuerte</b>.' +
  '<h4>TÉCNICAS</h4><b>Agarre</b>: guardia + golpe. Rompe la guardia; si te agarran, pulsa golpe al instante para soltarte. <b>Gancho</b>: golpe fuerte con «subir» pulsado; levanta al rival para seguir pegándole en el aire, y un golpe fuerte en el aire lo <b>estrella</b> contra el suelo. <b>Esquiva perfecta</b>: haz dash justo cuando llega el golpe y tu siguiente ataque aparece a su espalda y pega más. <b>Ki cargado</b>: mantén el botón de ki. Los disparos de los dos <b>chocan</b> entre sí: gana el más fuerte.' +
  '<h4>TRANSFORMACIÓN</h4>La barra naranja se llena al pegar y al recibir daño. Llena, <b>transfórmate</b>: más fuerza, algo de vida y una <b>Ultimate distinta</b>, la de esa forma. Puedes encadenar todas las formas del guerrero.' +
  '<h4>PASIVA</h4>Cada guerrero tiene una <b>habilidad única</b> siempre activa (la ves al elegirlo): unos se curan, otros pegan más con poca vida, aguantan golpes, absorben ki...' +
  '<h4>TRUCOS</h4>Guardia justo antes del golpe: <b>contraataque</b>. Dash cuando el rival sale volando: <b>persecución</b>. Teletransporte mientras te pegan: <b>escapas</b> (30 de ki).';

/** Ficha de un luchador a partir de un guerrero del juego y una de sus formas. k = transformaciones hechas en el combate hasta llegar a ella */
function vsDef(ch, fi, k) {
  k = k || 0; const f = ch.forms[fi] || ch.forms[0];
  return { id: ch.id, name: nice(ch.name), form: f.name, sheet: f.sheet, anim: f.anim, tint: f.tint === undefined ? 0xffffff : f.tint, col: f.ki || 0x8ad8ff,
    hp: Math.round(1000 * Math.max(0.88, Math.min(1.22, (ch.hp || 110) / 112))), spd: Math.max(0.94, Math.min(1.12, 0.9 + (ch.spd || 1) * 0.1 + fi * 0.01)) * (1 + 0.02 * Math.min(4, k)), pow: (1 + Math.min(4, fi) * 0.015) * (1 + 0.08 * Math.min(4, k) + 0.02 * Math.max(0, k - 4)),
    ult: vsUlt(ch, f, ch.forms.indexOf(f), k), pas: vsPas(ch),            // cada forma tiene su propia Ultimate (versus/ults.js)
    ix: ch.forms.indexOf(f),                                                // número de la forma (para su intro, assets/intros.js)
    trX: typeof FormIntros !== 'undefined' && FormIntros.has(ch.id, ch.forms.indexOf(f)) ? Math.max(0, FORM_INTRO_T + 0.05 - (VS.TR_CINE - VS.TR_SWAP)) : 0 };   // con intro, la transformación dura lo que ella
}
/** Cadena de formas de un combate: de la forma inicial elegida a la última que tenga sprites */
function vsChain(ch, fi) {
  const out = []; for (let i = fi; i < ch.forms.length; i++) if (SPRITE_DATA[ch.forms[i].sheet]) out.push(vsDef(ch, i, out.length));
  return out.length ? out : [vsDef(ch, 0, 0)];
}

/** Parte visible de un luchador: sprite, aura y qué fotograma toca según su estado en la simulación */
class VsActor {
  constructor(stage, chain, sheets) {
    const def = chain[0]; this.chain = chain; this.sheets = sheets; this.fi = 0; this.pop = 0; this.intros = [];   // intros: hoja de intro de cada forma de la cadena (o null)
    this.def = def; this.spr = new VsSprite(stage.scene, true); this.spr.setSheet(sheets[0]); this.spr.u.uTint.value.setHex(def.tint);
    const U = { uSize: { value: new THREE.Vector2(7.4, 9.8) }, uAnchor: { value: new THREE.Vector2(0.5, 0.07) }, uRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uRight: this.spr.u.uRight, uFlip: { value: 0 }, uRoll: { value: 0 },
      uCol: { value: new THREE.Color(def.col) }, uT: { value: 0 }, uPow: { value: 0 } };
    this.aura = new THREE.Mesh(VS_QUAD, new THREE.ShaderMaterial({ uniforms: U, vertexShader: VSS_VS, fragmentShader: VSAURA_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.aura.frustumCulled = false; this.aura.renderOrder = -1; stage.scene.add(this.aura); this.au = U;
    this.pow = 0; this.t = 0; this.roll = 0; this.sq = 1; this.px = 0; this.py = 0; this.pz = 0; this.flip = false; this.gt = 0;
  }
  /** Cambia a otra forma de la cadena: hoja de sprites, tinte y color de la energía */
  setForm(fi) { this.fi = fi; this.def = this.chain[fi]; this.spr.setSheet(this.sheets[fi]); this.spr.u.uTint.value.setHex(this.def.tint); this.au.uCol.value.setHex(this.def.col); }
  frame(f, sim) {
    const A = this.def.anim, t = this.t, seq = (s, fps) => (Array.isArray(s) ? s[Math.floor(t * fps) % s.length] : s), last = (s) => (Array.isArray(s) ? s[s.length - 1] : s), first = (s) => (Array.isArray(s) ? s[0] : s);
    const chg = A.chgSeq ? seq(A.chgSeq, 10) : A.idle, u = sim.ult && sim.ult.who === f.i ? sim.ult : null;
    switch (f.st) {
      case 'move': return f.y < 0.15 && Math.hypot(f.vx, f.vz) > 1 ? seq(A.walk, 9) : Math.hypot(f.vx, f.vy, f.vz) > 5 ? A.dash : seq(A.idleSeq || A.idle, 6);
      case 'dash': return A.dash;
      case 'atk': return A.atkSeq ? A.atkSeq[f.c % A.atkSeq.length] : f.c & 1 ? A.atk2 : A.atk;
      case 'flurry': return f.done ? A.crit : A.atkSeq ? A.atkSeq[f.n % 2] : f.n & 1 ? A.atk2 : A.atk;
      case 'heavy': return f.t < 0.17 ? (A.atkSeq ? A.atkSeq[0] : A.atk) : A.crit;
      case 'shot': return !f.done && f.chg ? chg : A.atk2;
      case 'grab': return f.done ? A.atk : A.dash;
      case 'grabd': return A.hurt;
      case 'charge': case 'trans': return chg;
      case 'hurt': case 'stun': case 'held': return A.hurt;
      case 'launched': return first(A.death);
      case 'down': return last(A.death);
      case 'ko': return f.y > 0.05 || f.vy > 0 ? first(A.death) : last(A.death);
      case 'clash': return sim.clash && sim.clash.ph >= 1 ? A.atk2 : chg;   // choque de Ultimates: cargando y luego empujando con las manos
      case 'ult':
        if (!u || u.ph === 0) return chg;
        switch (u.type) {
          case 'beam': return A.atk2;
          case 'bomb': case 'storm': case 'rift': case 'wave': return A.crit;
          case 'spin': case 'drain': case 'cage': return A.atk2;
          case 'clone': return u.k >= 0 && u.cl && u.cl[u.k].s === 1 ? A.dash : u.fin ? A.crit : seq(A.idleSeq || A.idle, 6);
          case 'nova': return u.r > 0 ? A.crit : chg;
          case 'discs': case 'volley': return u.n & 1 ? A.atk2 : A.atk;
          case 'grab': return !u.lock ? (u.thrown ? A.atk2 : A.dash) : u.v === 2 ? A.atk2 : u.v === 0 && u.t > 0.55 ? A.crit : A.atk;
          case 'slash': if (u.lock && u.w2) return seq(A.idleSeq || A.idle, 6);   // de espaldas, esperando a que estallen los cortes
        }
        return u.lock ? (u.n % 3 === 2 ? A.crit : A.atkSeq ? A.atkSeq[u.n % A.atkSeq.length] : u.n % 2 ? A.atk : A.atk2) : A.dash;
      default: return seq(A.idleSeq || A.idle, 6);
    }
  }
}

class Versus {
  constructor(game) {
    this.g = game; this.active = false; this.cfg = { mode: 'cpu', level: 'normal', arena: 'dia', rounds: 2, pick: [null, null], side: 0, dummy: 'still', tki: '1', ttm: '1' }; this.tw = null;
    const st = document.createElement('style'); st.textContent = VS_CSS; document.head.appendChild(st);
    const el = this.el = document.createElement('div'); el.id = 'vs';
    const side = (c) => '<div class="side ' + c + '"><canvas class="pt" width="74" height="74"></canvas><div class="inf"><div class="nm"><span></span><small></small></div><div class="hp"><i class="g"></i><i class="v"></i></div>' +
      '<div class="row"><b class="kj">気</b><div class="ki"><i></i></div><div class="gd"><i></i></div><div class="pips"></div></div><div class="row"><div class="tr"><i></i></div><span class="trl"></span></div></div></div>';
    el.innerHTML = '<div class="bars"><i></i><i></i></div><div class="top">' + side('l') + '<div class="clock"><small>RONDA 1</small><span>99</span></div>' + side('r') + '</div>' +
      '<div class="cmb l"><b></b><small></small></div><div class="cmb r"><b></b><small></small></div><div class="big"></div><div class="tag"></div><div class="vq"><b></b><span></span></div><div class="ult"><b></b></div>' +
      '<div class="clh"><div class="cht">¡CHOQUE DE ULTIMATES!</div><div class="chb"><i class="a"></i><i class="b"></i><b></b></div><div class="chn l"><span></span><em></em></div><div class="chn r"><span></span><em></em></div><div class="chk"></div></div>' +
      '<div class="clw"><b>¡RESPONDE!</b><span></span><i></i></div><div class="hint">' + vsHint() + '</div><div class="trn"></div>' +
      '<div class="pnl pause"><div class="box"><h2>PAUSA</h2><p>Modo Versus</p><button class="go" data-v="resume">Seguir</button><button data-v="reselect">Cambiar luchadores</button><button data-v="exit">Salir al menú</button></div></div>' +
      '<div class="pnl end"><div class="box"></div></div>' +
      '<div class="sel"></div>';
    document.body.appendChild(el);
    if (typeof IS_TOUCH !== 'undefined' && IS_TOUCH) { this.touch = new VsTouchPad(el, () => this.cmd('pause')); el.classList.add('touch'); }   // móvil y tableta: mandos en pantalla
    const q = (s) => el.querySelector(s), qa = (s) => [...el.querySelectorAll(s)];
    this.ui = { sides: qa('.side').map((s) => ({ pt: s.querySelector('.pt'), nm: s.querySelector('.nm span'), fm: s.querySelector('.nm small'), hp: s.querySelector('.hp'), g: s.querySelector('.hp .g'), v: s.querySelector('.hp .v'),
      ki: s.querySelector('.ki'), kiI: s.querySelector('.ki i'), gd: s.querySelector('.gd i'), pips: s.querySelector('.pips'), tr: s.querySelector('.tr'), trI: s.querySelector('.tr i'), trl: s.querySelector('.trl'), ghost: 1 })), cmb: qa('.cmb'), big: q('.big'), tag: q('.tag'), ult: q('.ult b'), ultBox: q('.ult'), clh: q('.clh'), chb: q('.chb'), chm: q('.chb b'), cha: q('.chb .a'), chbb: q('.chb .b'), chn: qa('.chn'), chk: q('.chk'), clw: q('.clw'),
      vq: q('.vq'), clock: q('.clock span'), rnd: q('.clock small'), pause: q('.pause'), end: q('.end'), sel: q('.sel'), trn: q('.trn') };
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { e.stopPropagation(); this.cmd(b.dataset.v, b.dataset.a); } });
    window.addEventListener('keydown', (e) => {
      if (!this.active || e.repeat) return;
      if (e.code === 'Escape') { if (this.sim && this.sim.phase !== 'end') this.cmd(this.paused ? 'resume' : 'pause'); else if (!this.sim) this.cmd('exit'); }
      else if (e.code === 'Enter' && !this.sim) this.cmd('fight');
      else if (this.trn && !this.paused) { const k = { Digit1: 'dummy', Digit2: 'ki', Digit3: 'tm', KeyR: 'pos', Digit4: 'base' }[e.code]; if (k) this.cmd('trn', k); }
    });
  }

  /* ---------------- Menú de selección ---------------- */
  roster() { return CHARACTERS.filter((c) => !c.soon && Save.d.unlocked.includes(c.id) && c.forms && c.forms.length && SPRITE_DATA[c.forms[0].sheet]); }
  open() {
    const g = this.g; if (this.active) return;
    VsBinds.load(); this.refreshHint();
    this.active = true; this.prevState = g.state; g.state = 'versus'; g.releaseMouse && g.releaseMouse();
    g.ui.el.menu.style.display = 'none'; g.ui.el.hud.style.display = 'none';
    this.el.classList.add('on'); const R = this.roster(), c = this.cfg;
    if (!c.pick[0] || !R.some((x) => x.id === c.pick[0].id)) c.pick[0] = { id: (R.find((x) => x.id === Save.d.sel) || R[0]).id, f: 0 };
    if (!c.pick[1] || !R.some((x) => x.id === c.pick[1].id)) c.pick[1] = { id: (R[1] || R[0]).id, f: 0 };
    this.showSelect(); SFX.play('tp');
  }
  showSelect() {
    this.clearFight(); this.sim = null; this.paused = false; this.ui.pause.classList.remove('on'); this.ui.end.classList.remove('on'); this.el.classList.remove('cine');
    for (const k of ['.top', '.hint', '.cmb.l', '.cmb.r', '.tc']) for (const n of this.el.querySelectorAll(k)) n.style.display = 'none';
    this.ui.trn.classList.remove('on'); this.trn = null; if (this.touch) this.touch.clear(); this.ui.vq.classList.remove('on'); this.ui.end.classList.remove('win');
    this.ui.sel.classList.add('on'); EntryFx.seen.vs0 = EntryFx.seen.vs1 = null; this.renderSelect(); SFX.music('menu');   // al entrar, las entradas vuelven a reproducirse
  }
  renderSelect() {
    const c = this.cfg, R = this.roster(), lad = c.mode === 'ladder', trn = c.mode === 'train', L = VS_TOWER.levels[c.level] || VS_TOWER.levels.normal, tab = c.tab || 'grid';
    const seg = (k, list) => '<div class="vseg">' + list.map(([v, t]) => '<button data-v="set" data-a="' + k + ':' + v + '"' + (String(c[k]) === String(v) ? ' class="on"' : '') + '>' + t + '</button>').join('') + '</div>';
    const p2 = c.mode === 'cpu' ? 'CPU' : trn ? 'Rival de práctica' : 'Jugador 2';
    // Ficha de un luchador: retrato, formas (se elige con cuál empieza), pasiva y la Ultimate de cada forma
    const panel = (i) => {
      const ch = charById(c.pick[i].id), fi = c.pick[i].f, f = ch.forms[fi] || ch.forms[0], pas = vsPas(ch);
      return '<section class="fp p' + i + (c.side === i ? ' on' : '') + '" data-v="side" data-a="' + i + '" tabindex="0"><span class="who">' + (i ? p2 : 'Jugador 1') + '</span>' + (fi === 0 && EntryFx.has(ch.id) ? '<canvas class="art ent" width="' + ENTRY_W + '" height="' + ENTRY_H + '" data-entry="' + ch.id + '" data-k="vs' + i + '"></canvas>'   // forma base: animación de entrada (js/entryfx.js)
        : '<canvas class="art" width="168" height="168" data-full="' + f.sheet + '"></canvas>') + '<h3>' + nice(ch.name) + '</h3>' +
        '<h4>Empieza en</h4><div class="forms">' + ch.forms.map((g, n) => (SPRITE_DATA[g.sheet] ? '<button data-v="form" data-a="' + i + ':' + n + '"' + (fi === n ? ' class="on"' : '') + '>' + nice(g.name) + '</button>' : '')).join('') + '</div>' +
        (pas ? '<h4>Habilidad única</h4><div class="psv"><b>' + pas.name + '</b>' + pas.info + '</div>' : '') +
        '<h4 class="uh">Ultimate de cada forma</h4><ol class="ults">' + vsChain(ch, fi).map((d) => '<li><b>' + d.ult.name + '</b>' + nice(d.form) + ' <small>· ' + VS_ULT_INFO[d.ult.type][d.ult.v] + '</small></li>').join('') + '</ol></section>';
    };
    const tower = '<section class="fp tw"><span class="who">La Torre</span><h3 style="margin-top:14px">' + VS_TOWER.n + ' rivales</h3><div class="twi">Rivales al azar, cada uno más duro que el anterior. El último es un <b>jefe</b> que ya llega transformado. Tienes una continuación.<br><br>Ganas zeni y cristales en cada victoria, y <b>' + L.cry + ' cristales</b> al superarla' +
      (VsStats.d().tower[c.level] ? '' : ' (<b>el doble</b> la primera vez)') + '.</div></section>';
    const grid = '<div class="grid">' + R.map((ch) => '<button data-v="char" data-a="' + ch.id + '" class="' + (c.pick[0].id === ch.id ? 'p0 ' : '') + (!lad && c.pick[1].id === ch.id ? 'p1' : '') + '" title="' + nice(ch.name) + '"><canvas width="74" height="74" data-pt="' + ch.forms[0].sheet + '"></canvas><em>' +
      (c.pick[0].id === ch.id ? 'J1' : '') + (!lad && c.pick[1].id === ch.id ? (c.pick[0].id === ch.id ? '+' : '') + (c.mode === 'cpu' ? 'CPU' : trn ? 'Rival' : 'J2') : '') + '</em></button>').join('') + '</div>';
    const opt = (t, h) => '<span>' + t + '</span>' + h;
    this.ui.sel.innerHTML = '<header><button class="back" data-v="exit">◀ Salir</button><h1>¡Modo Versus!</h1><nav class="vseg modes">' + [['cpu', 'Contra la CPU'], ['local', '2 jugadores'], ['ladder', 'Torre'], ['train', 'Entrenamiento']].map(([v, t]) => '<button data-v="set" data-a="mode:' + v + '"' + (c.mode === v ? ' class="on"' : '') + '>' + t + '</button>').join('') + '</nav></header>' +
      panel(0) +
      '<div class="mid"><div class="tabs">' + [['grid', 'Luchadores'], ['keys', 'Controles'], ['stats', 'Historial']].map(([v, t]) => '<button data-v="tab" data-a="' + v + '"' + (tab === v ? ' class="on"' : '') + '>' + t + '</button>').join('') +
        (tab === 'grid' ? '<span>Eliges para ' + (c.side ? (c.mode === 'cpu' ? 'la CPU' : trn ? 'el rival de práctica' : 'el jugador 2') : 'el jugador 1') + '</span>' : '') + '</div>' +
        '<div class="pane">' + (tab === 'keys' ? this.keysPane() : tab === 'stats' ? VsStats.html(c.pick[0].id) : grid) + '</div>' +
        '<div class="opts">' + (c.mode === 'cpu' || lad ? opt('Dificultad', seg('level', [['easy', 'Fácil'], ['normal', 'Normal'], ['hard', 'Difícil']])) : '') +
          (trn ? opt('El rival', seg('dummy', Object.keys(VS_DUMMY).map((k) => [k, VS_DUMMY[k]]))) + opt('Ayudas', '<div class="vseg">' + seg('tki', [['1', 'Ki infinito'], ['0', 'Ki normal']]).slice(18, -6) + seg('ttm', [['1', 'Barra de transformación llena'], ['0', 'Barra normal']]).slice(18, -6) + '</div>') : '') +
          (lad ? '' : opt('Arena', seg('arena', Object.keys(VS_ARENAS).map((k) => [k, VS_ARENAS[k].name]).concat([['azar', 'Al azar']])))) + (trn ? '' : opt('Rondas para ganar', seg('rounds', [[1, '1'], [2, '2'], [3, '3']]))) + '</div>' +
        '<button class="fight" data-v="fight">' + (lad ? '¡Subir a la Torre!' : trn ? '¡A entrenar!' : '¡A luchar!') + '</button></div>' +
      (lad ? tower : panel(1));
    for (const cv of this.ui.sel.querySelectorAll('canvas[data-pt]')) this.portrait(cv, cv.dataset.pt);
    for (const cv of this.ui.sel.querySelectorAll('canvas[data-full]')) this.portrait(cv, cv.dataset.full, true);
    for (const cv of this.ui.sel.querySelectorAll('canvas[data-entry]')) EntryFx.play(cv, cv.dataset.entry, cv.dataset.k);
  }
  /** Retrato: el busto del primer fotograma de la hoja, ampliado sin suavizar */
  portrait(cv, sheet, full) {
    vsTexture(sheet).then((s) => {
      if (!s) return; const g = cv.getContext('2d'), d = s.d, w = full ? Math.min(d.w, d.h) * 0.94 : d.w * 0.62, h = w, x = (d.w - w) / 2, y = full ? Math.max(0, d.h * (1 - (d.anc || 0)) - h) : Math.max(0, d.h * (1 - (d.anc || 0)) - d.h * 0.82);   // full: cuerpo entero (ficha de selección)
      g.imageSmoothingEnabled = false; g.clearRect(0, 0, cv.width, cv.height); g.drawImage(s.tex.image, x, y, w, h, 0, 0, cv.width, cv.height);
    });
  }
  cmd(v, a) {
    const c = this.cfg;
    if (v === 'set') { const [k, val] = a.split(':'); c[k] = k === 'rounds' ? +val : val; if (c.mode === 'ladder') c.side = 0; this.renderSelect(); }
    else if (v === 'side') { c.side = +a; this.renderSelect(); }
    else if (v === 'char') { c.pick[c.side] = { id: a, f: 0 }; SFX.play('ki'); const pane = this.ui.sel.querySelector('.pane'), top = pane ? pane.scrollTop : 0; this.renderSelect(); const p2 = this.ui.sel.querySelector('.pane'); if (p2) p2.scrollTop = top; }   // sin perder el punto de la lista
    else if (v === 'form') { const [i, n] = a.split(':'); c.side = +i; c.pick[c.side].f = +n; this.renderSelect(); }
    else if (v === 'tab') { c.tab = a; this.renderSelect(); }
    else if (v === 'bind') this.startBind(+a[0], a.slice(2));
    else if (v === 'bindreset') { VsBinds.reset(); Save.write(); this.refreshHint(); this.renderSelect(); }
    else if (v === 'fight') { if (c.mode === 'ladder') { this.tw = VS_TOWER.build(this.roster(), c.pick[0].id, VS_TOWER.levels[c.level] ? c.level : 'normal'); VsStats.d().towerRuns++; } this.start(); }
    else if (v === 'rematch') this.start();
    else if (v === 'next' && this.tw) { this.tw.i++; this.start(); }                    // Torre: siguiente rival
    else if (v === 'retry' && this.tw && this.tw.cont > 0) { this.tw.cont--; this.start(); }
    else if (v === 'trn' && this.trn && this.sim) {                                       // ajustes del entrenamiento, en caliente
      const s = this.sim, K = Object.keys(VS_DUMMY);
      if (a === 'dummy') { c.dummy = K[(K.indexOf(c.dummy) + 1) % K.length]; this.inputs[1] = new VsDummy(c.dummy); }
      else if (a === 'ki') c.tki = c.tki === '1' ? '0' : '1';
      else if (a === 'tm') c.ttm = c.ttm === '1' ? '0' : '1';
      else if (a === 'pos' && !s.ult && !s.tr) { s.f[0].reset(7); s.f[1].reset(-7); s.shots.length = 0; s.blasts.length = 0; }
      else if (a === 'base') { this.start(); return; }
      SFX.play('ki'); this.renderTrn();
    }
    else if (v === 'reselect') this.showSelect();
    else if (v === 'pause') { if (!this.sim || this.sim.phase === 'end') return; this.paused = true; this.ui.pause.classList.add('on'); if (this.touch) this.touch.clear(); }
    else if (v === 'resume') { this.paused = false; this.ui.pause.classList.remove('on'); }
    else if (v === 'exit') this.close();
  }
  close() {
    if (this.bindOff) this.bindOff();
    const g = this.g; this.clearFight(); this.sim = null; this.active = false; this.el.classList.remove('on', 'cine'); this.ui.sel.classList.remove('on');
    g.ui.el.menu.style.display = ''; g.ui.el.hud.style.display = ''; g.toMenu();
  }

  /* ---------------- Combate ---------------- */
  async start() {
    if (this.loading) return; this.loading = true;
    const c = this.cfg, tw = c.mode === 'ladder' ? this.tw : null, train = c.mode === 'train', picks = [c.pick[0], tw ? tw.foes[tw.i] : c.pick[1]], AK = Object.keys(VS_ARENAS);
    const chains = picks.map((p) => vsChain(charById(p.id), p.f)), sheets = await Promise.all(chains.map((ch) => Promise.all(ch.map((d) => vsTexture(d.sheet)))));
    const intros = await Promise.all(chains.map((ch) => Promise.all(ch.map((d) => FormIntros.has(d.id, d.ix) ? vsTexture(FormIntros.name(d.id, d.ix)) : null))));   // intro de cada forma (entrada y transformación)
    this.loading = false; if (!this.active || sheets.some((s) => !s[0])) return;
    chains.forEach((ch, i) => { const n = sheets[i].findIndex((s) => !s); if (n > 0) { ch.length = n; sheets[i].length = n; } });   // si una hoja no carga, la cadena acaba antes
    const defs = chains.map((ch) => ch[0]);
    this.clearFight(); const g = this.g, r = g.renderer;
    // Estado del renderizador que tocamos: se guarda y se devuelve al salir
    this.saved = { auto: r.shadowMap.autoUpdate, clear: r.getClearColor(new THREE.Color()).getHex() }; r.shadowMap.autoUpdate = true;
    const scene = this.scene = new THREE.Scene(), low = Save.d.opt.quality === 'low';
    // La Torre cambia de arena en cada combate
    this.arena = new VsArena(scene, tw || c.arena === 'azar' ? AK[(Math.random() * AK.length) | 0] : c.arena, low); this.cam = new VsCamera(); this.post = low ? null : new VsPost(r);
    this.fxA = new VsParticles(scene, 700, false, 3); this.fx = new VsParticles(scene, 1100, true, 9); this.beam = new VsBeam(scene); this.beam2 = new VsBeam(scene);
    this.actors = chains.map((ch, i) => new VsActor(this, ch, sheets[i]));
    this.actors.forEach((a, i) => { a.intros = intros[i].slice(0, a.chain.length); });
    chains.forEach((ch) => ch.forEach((d) => ImpactArt.load(d.id, d.ix)));          // impact frames (transformación y Ultimate)
    this.ghosts = []; for (let i = 0; i < 14; i++) { const s = new VsSprite(scene, false); s.mesh.visible = false; s.life = 0; s.mesh.renderOrder = 2; this.ghosts.push(s); }
    this.sim = new VsSim(chains[0], chains[1], { seed: (Math.random() * 1e9) | 0, rounds: train ? 1 : c.rounds, noKO: train, noTime: train, intro: train ? 0 : VS_INTRO_T });
    this.intro = train ? null : { s: [{}, {}], q: -1 }; this.fin = null; this.vic = null; this.ui.vq.classList.remove('on'); this.ui.end.classList.remove('win'); this.ids = picks.map((p) => p.id);
    if (this.intro) { this.el.classList.add('cine'); this.ui.ultBox.classList.add('off'); }
    const p1 = new VsMulti([new VsKeyboard(VS_KEYS[0]), new VsGamepad(0)].concat(this.touch ? [this.touch] : []));
    this.inputs = [p1, tw ? VS_TOWER.ai(tw) : train ? new VsDummy(c.dummy) : c.mode === 'cpu' ? new VsAI(c.level) : new VsMulti([new VsKeyboard(VS_KEYS[1]), new VsGamepad(1)])];
    this.run = { tr: 0, ult: 0, sup: 0, parry: 0, maxCombo: 0, maxDmg: 0 };       // lo que hace el jugador 1 en este combate (estadísticas)
    this.trn = train ? { cmb: 0, dmg: 0, max: 0 } : null; this.sfx2 = c.mode === 'local' ? '' : train ? ' · PRÁCTICA' : ' · CPU'; this.shownT = null;
    this.acc = 0; this.time = 0; this.scale = 1; this.slow = 0; this.dim = 0; this.dimCol = 0; this.blur = 0; this.chroma = 0; this.flash = 0; this.lines = 0; this.ax = [0, 0, 0, 0]; this.stone = null; this.paused = false; this.chargeSnd = 0; this.trCol = 0xffffff; this.p2cpu = c.mode !== 'local';
    this.prev = this.sim.f.map((f) => ({ x: f.x, y: f.y, z: f.z }));
    // HUD
    this.ui.sel.classList.remove('on'); this.ui.end.classList.remove('on'); this.ui.pause.classList.remove('on');
    for (const k of ['.top', '.hint', '.cmb.l', '.cmb.r', '.tc']) for (const n of this.el.querySelectorAll(k)) n.style.display = '';
    this.ui.trn.classList.toggle('on', train); if (train) this.renderTrn(); if (this.touch) this.touch.clear();
    this.ui.sides.forEach((s, i) => { s.nm.textContent = defs[i].name; s.fm.textContent = nice(defs[i].form) + (i ? this.sfx2 : ''); s.ghost = 1; s.can = null; s.trl.textContent = ''; this.portrait(s.pt, defs[i].sheet);
      s.kiI.style.background = ''; s.pips.innerHTML = train ? '' : '<b></b>'.repeat(c.rounds); s.wins = -1; });
    this.cam.update(0.016, this.sim, true); SFX.music('boss');
  }
  clearFight() {
    if (!this.scene) return; const r = this.g.renderer;
    this.scene.traverse((o) => { if (o.geometry && o.geometry !== VS_QUAD) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } if (o.customDepthMaterial) o.customDepthMaterial.dispose(); });
    if (this.post) this.post.dispose(); r.setRenderTarget(null); r.shadowMap.autoUpdate = this.saved.auto; this.g.shadowDirty = true;
    this.scene = this.arena = this.post = this.fx = this.fxA = this.beam = this.beam2 = this.actors = this.ghosts = null;
  }

  /** Un fotograma: lo llama el bucle del juego mientras el modo está activo */
  frame(rawDt) {
    const g = this.g, r = g.renderer; g.pad.poll(rawDt);
    if (!this.sim || !this.scene) { r.setRenderTarget(null); r.setClearColor(0x0d1022, 1); r.clear(); return; }
    const sim = this.sim;
    if (!this.paused) {
      if (this.slow > 0) { this.slow -= rawDt; this.scale = this.slow > 0 ? 0.22 : 1; }
      const dt = rawDt * this.scale; this.time += dt; this.acc = Math.min(this.acc + dt, VS_DT * 5);
      while (this.acc >= VS_DT) {                                         // paso fijo: la lógica no depende de los FPS
        this.acc -= VS_DT; for (let i = 0; i < 2; i++) { const f = sim.f[i], p = this.prev[i]; p.x = f.x; p.y = f.y; p.z = f.z; }
        const c0 = this.inputs[0].read(sim, 0);
        if (this.intro && sim.phase === 'intro' && sim.pt > 0.4 && sim.pt < VS_INTRO_T - 2.3 && c0 && (c0.b & (VB.ATK | VB.HEAVY | VB.KI | VB.DASH))) sim.pt = VS_INTRO_T - 2.3;   // cualquier botón de ataque salta las entradas
        sim.step(c0, this.inputs[1].read(sim, 1));
        for (const e of sim.ev) this.onEvent(e); sim.ev.length = 0;
        if (this.trn) {                                                    // entrenamiento: nadie muere y las ayudas rellenan las barras
          const a = sim.f[0], b = sim.f[1], c = this.cfg; a.hp = a.hpMax; if (a.cmb === 0 && b.st !== 'hurt' && b.st !== 'launched' && b.st !== 'held' && b.st !== 'down') b.hp = b.hpMax;
          if (c.tki === '1' && !sim.ult && !sim.clash) a.ki = 100; if (c.ttm === '1' && a.fi < a.chain.length - 1) a.tm = 100;
        }
        this.simFx();
      }
      this.draw(dt, rawDt);
    }
    const cam = this.cam.cam, cv = r.domElement, asp = cv.width / Math.max(1, cv.height);
    if (Math.abs(cam.aspect - asp) > 0.001) { cam.aspect = asp; cam.updateProjectionMatrix(); }
    if (this.post) { const u = this.post.uC; u.uBlur.value = this.blur; u.uChroma.value = this.chroma; u.uFlash.value = this.flash; u.uSat.value = this.slow > 0 ? 0.55 : 1; u.uLines.value = this.lines; u.uLT.value = performance.now() / 55; u.uBloom.value = sim.tr ? 0.32 : sim.clash ? 0.26 : 0.5 + this.arena.dim * 0.2; this.post.render(this.scene, cam); }
    else { r.setRenderTarget(null); r.render(this.scene, cam); }
  }

  /* ---------------- Eventos de la simulación → efectos, sonido y cámara ---------------- */
  say(txt, dur) { const b = this.ui.big; b.textContent = txt; b.style.setProperty('--d', (dur || 1.2) + 's'); b.classList.remove('go'); void b.offsetWidth; b.classList.add('go'); }
  tag(txt) { const b = this.ui.tag; b.textContent = txt; b.classList.remove('go'); void b.offsetWidth; b.classList.add('go'); }
  /** Presupuesto: n partículas de relleno, recortadas si el sistema va cargado (a partir de la mitad del tope) */
  few(n, P) { P = P || this.fx; const L = P.list.length / P.max; return L < 0.5 ? n : Math.max(1, Math.round(n * Math.max(0.2, 1 - (L - 0.5) * 2))); }
  burst(x, y, z, col, n, sp, size) {
    n = this.few(n);
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, e = (Math.random() - 0.5) * 2, v = sp * (0.4 + Math.random() * 0.8), c = Math.cos(e);
      this.fx.add(2, x, y, z, size * (0.6 + Math.random() * 0.8), i % 3 ? col : 0xffffff, { vx: Math.cos(a) * c * v, vy: Math.sin(e) * v, vz: Math.sin(a) * c * v, drag: 3, life: 0.18 + Math.random() * 0.22, stretch: 3.2, s1: size * 0.2 }); }
  }
  /* ----- Efectos duros: borde nítido y sin difuminar; desaparecen encogiéndose ----- */
  /** Esquirlas afiladas en abanico hacia (dx, dy, dz) (0,0,0 = en todas direcciones) */
  sparks(x, y, z, col, n, sp, dx, dy, dz, size) {
    n = this.few(n); size = size || 1; const any = !dx && !dz && !dy;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, e = (Math.random() - 0.5) * 2, c = Math.cos(e), v = sp * (0.45 + Math.random() * 0.75); let vx = Math.cos(a) * c, vy = Math.sin(e), vz = Math.sin(a) * c;
      if (!any) { vx = vx * 0.75 + dx; vy = vy * 0.75 + dy; vz = vz * 0.75 + dz; const m = Math.hypot(vx, vy, vz) || 1; vx /= m; vy /= m; vz /= m; }
      this.fx.add(6, x, y, z, (0.34 + Math.random() * 0.3) * size, i % 3 ? col : 0xffffff, { vx: vx * v, vy: vy * v, vz: vz * v, g: 26, drag: 2.2, life: 0.2 + Math.random() * 0.2, stretch: 5.5, s1: 0.03, hard: true });
    }
  }
  /** Anillo de impacto: crece de r0 a r1 y se corta en seco. flat = tumbado en el suelo */
  ring(x, y, z, col, r0, r1, life, flat) { this.fx.add(7, x, y, z, r0, col, { s1: r1, life, flat: !!flat, hard: true, a: 0.8 }); }
  /** Escombros: trozos de piedra del color de la arena, con peso, que giran y rebotan */
  shards(x, y, z, n, sp) {
    n = this.few(n, this.fxA); const st = this.stone || (this.stone = [0.5, 0.36, 0.24].map((k) => new THREE.Color(this.arena.P.stone).multiplyScalar(k).getHex()));
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = sp * (0.35 + Math.random() * 0.8);
      this.fxA.add(8, x, y, z, 0.5 + Math.random() * 0.75, st[i % 3], { vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: sp * (0.5 + Math.random() * 0.8), g: 34, life: 0.9 + Math.random() * 0.5, bounce: true, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 22, s1: 0.12, hard: true }); }
  }
  /** Cristales de ki: lo que salta de una guardia golpeada o rota */
  crystals(x, y, z, col, n, sp) {
    n = this.few(n);
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, e = (Math.random() - 0.3) * 1.8, c = Math.cos(e), v = sp * (0.4 + Math.random() * 0.8);
      this.fx.add(9, x, y, z, 0.45 + Math.random() * 0.55, col, { vx: Math.cos(a) * c * v, vy: Math.sin(e) * v + 3, vz: Math.sin(a) * c * v, g: 30, drag: 1.2, life: 0.4 + Math.random() * 0.3, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 26, s1: 0.05, hard: true, a: 0.9 }); }
  }
  /** Onda de choque por el suelo: anillo fino que se abre y grietas radiales que brillan un instante */
  shock(x, z, col, r, n) {
    this.ring(x, 0.11, z, 0xffffff, r * 0.12, r * 2, 0.24, true); this.ring(x, 0.1, z, col, r * 0.1, r * 1.5, 0.34, true); n = this.few(n);
    for (let i = 0; i < n; i++) { const a = i / n * 6.283 + Math.random() * 0.5, L = r * (0.28 + Math.random() * 0.3), d = r * 0.1 + L / 2, cx = Math.cos(a), cz = Math.sin(a);
      this.fx.add(6, x + cx * d, 0.14, z + cz * d, 0.42, i & 1 ? col : 0xffffff, { vx: cx * 0.01, vz: cz * 0.01, life: 0.34 + Math.random() * 0.2, stretch: L / 0.42, s1: 0.04, hard: true, a: 0.9 }); }
  }
  dust(x, z, n, sp) {
    for (let i = 0; i < n; i++) { const a = i / n * 6.283 + Math.random() * 0.4, v = sp * (0.6 + Math.random() * 0.7);
      this.fxA.add(4, x + Math.cos(a) * 0.6, 0.35, z + Math.sin(a) * 0.6, 1.4, 0xd8cdb8, { vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: 1 + Math.random() * 1.5, drag: 2.6, life: 0.55 + Math.random() * 0.4, s1: 3.6, a: 0.5 }); }
  }
  boom(x, y, z, col, big) {
    const k = big === 2 ? 2.3 : big ? 1.5 : 1;
    this.fx.add(0, x, y, z, 3 * k, 0xffffff, { s1: 9 * k, life: 0.28, a: 0.8 }); this.fx.add(0, x, y, z, 4 * k, col, { s1: 14 * k, life: 0.5, a: 0.55 });
    this.fx.add(1, x, y, z, 2 * k, col, { s1: 14 * k, life: 0.4 }); this.fx.add(1, x, 0.08, z, 3 * k, 0xffffff, { s1: 24 * k, life: 0.5, flat: true, a: 0.8 });
    this.burst(x, y, z, col, 16, 30 * k, 2.2 * k); this.dust(x, z, 10, 13 * k); this.sparks(x, y, z, col, 12, 40 * k, 0, 0.5, 0, 1.5 * k); this.ring(x, y, z, 0xffffff, 3 * k, 15 * k, 0.2);
    if (y < 6) { this.shock(x, z, col, 15 * k, big ? 8 : 5); this.shards(x, Math.max(0.3, y), z, big === 2 ? 14 : 9, 12 * k); }   // cerca del suelo: onda de choque, grietas y escombros
    this.cam.shake(1.1); this.flash = Math.max(this.flash, 0.26 * Math.min(1.6, k)); this.chroma = 0.02; SFX.play('bigboom');
  }
  ghost(i, col, life) {
    const a = this.actors[i], g = this.ghosts.find((s) => s.life <= 0); if (!g) return;
    g.setSheet(a.spr.s); g.pose(a.fr, a.flip, a.roll, 1, 1); g.u.uRight.value.copy(a.spr.u.uRight.value); g.mesh.position.set(a.px, a.py, a.pz); g.u.uTint.value.setHex(col); g.life = g.max = life || 0.24; g.mesh.visible = true;
  }
  /** Imagen del luchador i en otro punto (las copias de la Ultimate de imágenes múltiples) */
  ghostAt(i, x, y, z, col, life) { const a = this.actors[i], px = a.px, py = a.py, pz = a.pz; a.px = x; a.py = y; a.pz = z; this.ghost(i, col, life); a.px = px; a.py = py; a.pz = pz; }
  onEvent(e) {
    const sim = this.sim, cam = this.cam, fx = this.fx;
    switch (e.t) {
      case 'round': { const tw = this.cfg.mode === 'ladder' && this.tw;
        this.rndTxt = this.trn ? 'ENTRENAMIENTO' : tw && e.n === 1 ? (tw.i === VS_TOWER.n - 1 ? 'JEFE FINAL' : 'RIVAL ' + (tw.i + 1) + ' DE ' + VS_TOWER.n) : 'RONDA ' + e.n; if (!(this.intro && e.n === 1)) this.say(this.rndTxt, 1.5);   // con entradas, el rótulo sale cuando acaban (draw)
        this.ui.rnd.textContent = this.trn ? 'PRÁCTICA' : tw ? 'TORRE ' + (tw.i + 1) + '/' + VS_TOWER.n + ' · R' + e.n : 'RONDA ' + e.n; } cam.update(0.016, sim, true); break;
      case 'fight': this.say('¡LUCHA!', 0.9); SFX.play('crit'); break;
      case 'swing': this.ghost(e.i, e.heavy ? 0xffffff : this.actors[e.i].def.col, e.heavy ? 0.2 : 0.14); if (e.heavy) SFX.play('slash'); break;
      case 'dodge': this.tag('¡ESQUIVA PERFECTA!'); this.slow = Math.max(this.slow, 0.22); this.ghost(e.i, 0xffffff, 0.4); fx.add(1, e.x, e.y, e.z, 1.5, 0xffffff, { s1: 8, life: 0.3 }); this.blur = Math.max(this.blur, 0.6); SFX.play('tp'); break;
      case 'counter': this.lines = Math.max(this.lines, 0.6); this.tag('¡CONTRAGOLPE!'); fx.add(3, e.x, e.y + 1.6, e.z, 2, 0xffffff, { s1: 6, life: 0.16 }); this.burst(e.x, e.y + 1.6, e.z, this.actors[e.i].def.col, 12, 18, 1.2); this.flash = Math.max(this.flash, 0.15); break;
      case 'juggle': this.tag('¡COMBO AÉREO!'); break;
      case 'spike': this.tag('¡REMATE!'); this.ring(e.x, e.y, e.z, 0xffffff, 2, 11, 0.2); this.lines = 1; fx.add(2, e.x, e.y, e.z, 2.2, 0xffffff, { vy: -60, life: 0.25, stretch: 8 }); this.blur = 1; cam.shake(0.7); SFX.play('slash'); break;
      case 'crater': this.fxA.add(1, e.x, 0.08, e.z, 3, 0x2a2430, { s1: 15, life: 1.2, flat: true, a: 0.8 }); fx.add(1, e.x, 0.1, e.z, 2, e.col, { s1: 20, life: 0.4, flat: true, a: 0.9 }); this.burst(e.x, 0.8, e.z, e.col, 8, 26, 1.6); this.dust(e.x, e.z, 14, 16);
        this.shock(e.x, e.z, e.col, 17, 8); this.shards(e.x, 0.4, e.z, 16, 19); this.sparks(e.x, 0.6, e.z, e.col, 10, 30, 0, 1, 0, 1.3); this.flash = Math.max(this.flash, 0.2); this.lines = Math.max(this.lines, 0.8); cam.shake(1.1, 2); cam.kick = 1; SFX.play('bigboom'); g_rumble(260, 1); break;
      case 'grabTry': SFX.play('dash'); break;
      case 'grab': this.tag('¡AGARRE!'); fx.add(1, e.x, e.y, e.z, 5, 0xffffff, { s1: 1, life: 0.18 }); cam.shake(0.3); SFX.play('hit'); break;
      case 'throw': this.blur = Math.max(this.blur, 0.7); SFX.play('slash'); break;
      case 'tech': this.tag('¡SE SUELTA!'); fx.add(3, e.x, e.y, e.z, 2, 0xffffff, { s1: 5, life: 0.18 }); fx.add(1, e.x, e.y, e.z, 1, 0xffe27a, { s1: 6, life: 0.25 }); this.burst(e.x, e.y, e.z, 0xffe27a, 10, 16, 1); cam.shake(0.4); SFX.play('guard'); break;
      case 'clash': { const k = e.big ? 1.8 : 1; fx.add(3, e.x, e.y, e.z, 2 * k, 0xffffff, { s1: 6 * k, life: 0.18, a: 0.9 }); fx.add(1, e.x, e.y, e.z, 1, e.col, { s1: 7 * k, life: 0.28 }); fx.add(1, e.x, e.y, e.z, 1, e.col2, { s1: 5 * k, life: 0.22 });
        this.burst(e.x, e.y, e.z, e.col, 8 * k, 20, 1.1); this.burst(e.x, e.y, e.z, e.col2, 8 * k, 20, 1.1); if (e.big) { this.flash = Math.max(this.flash, 0.18); cam.shake(0.5); this.tag('¡CHOQUE DE KI!'); } SFX.play(e.big ? 'boom' : 'guard'); break; }
      case 'kiCharge': SFX.play('pulse'); break;
      case 'clones': this.tag('¡IMÁGENES MÚLTIPLES!'); for (let k = 0; k < 14; k++) fx.add(2, e.x + (Math.random() - 0.5) * 2, e.y + Math.random() * 3, e.z + (Math.random() - 0.5) * 2, 1.3, 0xffffff, { vx: (Math.random() - 0.5) * 50, vz: (Math.random() - 0.5) * 50, life: 0.25, stretch: 5 }); SFX.play('tp'); break;
      case 'cloneGo': this.blur = Math.max(this.blur, 0.6); SFX.play('dash'); break;
      case 'cageOpen': SFX.play('pulse'); break;
      case 'cageShut': this.tag('¡ATRAPADO!'); fx.add(3, e.x, e.y, e.z, 4, 0xffffff, { s1: 9, life: 0.2 }); fx.add(1, e.x, e.y, e.z, 12, e.col, { s1: 6, life: 0.25 }); this.burst(e.x, e.y, e.z, e.col, 20, 16, 1.3); this.flash = Math.max(this.flash, 0.2); cam.shake(0.6); SFX.play('guard'); break;
      case 'drainOn': this.tag('¡ABSORCIÓN!'); SFX.play('pulse'); break;
      case 'drainMiss': this.tag('FALLO'); break;
      case 'drainTick': { const me = sim.f[e.i], dx = me.x - e.x, dy = me.y + 1.6 - e.y, dz = me.z - e.z; for (let k = 0; k < 3; k++) fx.add(0, e.x + (Math.random() - 0.5), e.y + (Math.random() - 0.5) * 2, e.z + (Math.random() - 0.5), 1.1, k ? e.col : 0xffffff, { vx: dx / 0.3, vy: dy / 0.3, vz: dz / 0.3, life: 0.3, s1: 0.4, a: 0.9 });
        fx.add(2, me.x + (Math.random() - 0.5) * 1.6, me.y + Math.random() * 2, me.z + (Math.random() - 0.5) * 1.6, 0.9, 0x7dffb0, { vy: 9, life: 0.4, stretch: 3 }); if (((this.dtk = (this.dtk || 0) + 1) & 1) === 0) SFX.play('ki'); break; }
      case 'waveGo': fx.add(1, e.x, 0.1, e.z, 2, 0xffffff, { s1: 16, life: 0.3, flat: true, a: 0.9 }); cam.shake(0.8); this.flash = Math.max(this.flash, 0.15); SFX.play(e.back ? 'pulse' : 'bigboom'); break;
      case 'spinGo': this.tag('¡BARRIDO!'); SFX.play('bigbeam'); break;
      case 'flurry': this.tag('¡RÁFAGA!'); this.blur = Math.max(this.blur, 0.5); SFX.play('dash'); break;
      case 'mark': {                                                    // aviso en el suelo de una explosión que está al caer
        this.fxA.add(1, e.x, 0.09, e.z, e.r * 2.3, e.col, { s1: e.r * 0.5, life: e.t, flat: true, a: 0.85 }); fx.add(1, e.x, 0.1, e.z, e.r * 0.4, 0xffffff, { s1: e.r * 2.1, life: e.t, flat: true, a: 0.5 });
        if (e.sky) { const h = 26, k = e.sky === 2 ? 2.6 : 1; fx.add(2, e.x, h, e.z, 2.2 * k, e.col, { vy: -h / e.t, life: e.t, stretch: 7, a: 0.9 }); fx.add(0, e.x, h, e.z, 2.4 * k, 0xffffff, { vy: -h / e.t, life: e.t, s1: 1.6 * k, a: 0.9 }); }
        if (e.pil) for (let k = 0; k < 6; k++) { const an = Math.random() * 6.283; this.fxA.add(5, e.x + Math.cos(an) * e.r * 0.6, 0.2, e.z + Math.sin(an) * e.r * 0.6, 0.3, 0x3a3038, { vy: 6 + Math.random() * 6, life: e.t + 0.3, s1: 0.1 }); }
        break; }
      case 'cut': {                                                     // tajo: línea de luz de lado a lado
        const w = e.w || 1; this.line(e.x0, e.y0, e.z0, e.x1, e.y1, e.z1, e.col, w, 0.2 + w * 0.05, true); this.flash = Math.max(this.flash, 0.05 * w); cam.shake(0.25 * w); SFX.play('slash'); break; }
      case 'crack': fx.add(1, e.x, 0.09, e.z, 1, e.col, { s1: 6.5, life: 0.4, flat: true, a: 0.9 }); fx.add(2, e.x, 0.3, e.z, 1.3, e.col, { vy: 15 + Math.random() * 9, life: 0.3, stretch: 4 }); this.dust(e.x, e.z, 3, 7);
        this.fxA.add(5, e.x, 0.3, e.z, 0.35, 0x2a2430, { vx: (Math.random() - 0.5) * 9, vz: (Math.random() - 0.5) * 9, vy: 8 + Math.random() * 7, g: 28, life: 1, bounce: true, s1: 0.2 }); cam.shake(0.22); break;
      case 'slam': this.dust(e.x, e.z, 12, 14); fx.add(1, e.x, 0.09, e.z, 2, e.col, { s1: 22, life: 0.45, flat: true, a: 0.9 }); this.shock(e.x, e.z, e.col, 20, 9); this.shards(e.x, 0.4, e.z, 10, 15); this.burst(e.x, 0.8, e.z, e.col, 8, 22, 1.4); cam.shake(0.9, 2); cam.kick = 1; SFX.play('boom'); break;
      case 'novaGo': { const k = e.big === 2 ? 1.5 : 1; fx.add(3, e.x, e.y, e.z, 6 * k, 0xffffff, { s1: 16 * k, life: 0.3, a: 0.9 }); for (let n = 0; n < 3; n++) fx.add(1, e.x, 0.1, e.z, 3, n ? e.col : 0xffffff, { s1: (34 + n * 16) * k, life: 0.5 + n * 0.15, flat: true, a: 0.6 });
        this.burst(e.x, e.y, e.z, e.col, 48, 46 * k, 1.8); this.dust(e.x, e.z, 22, 22 * k); this.flash = Math.max(this.flash, 0.55); this.chroma = 0.02; cam.shake(1.3); cam.kick = 1; SFX.play('bigboom'); g_rumble(400, 1); break; }
      case 'sheath': this.tag('...'); this.slow = 0.35; SFX.play('tp'); break;
      case 'stormShot': fx.add(2, e.x, e.y, e.z, 1.5, this.actors[e.i].def.col, { vy: 60, life: 0.22, stretch: 6 }); fx.add(3, e.x, e.y, e.z, 1.6, 0xffffff, { s1: 2.6, life: 0.1, a: 0.8 }); SFX.play('ki'); break;
      case 'hit': {
        const k = e.heavy ? 1.7 : e.rush ? 0.55 : 1;
        fx.add(3, e.x, e.y, e.z, 1.7 * k, 0xffffff, { s1: 3.4 * k, life: 0.12, rot: Math.random() * 3, a: 0.9 }); if (!e.rush) fx.add(0, e.x, e.y, e.z, 1.5 * k, e.col, { s1: 2.6 * k, life: 0.14, a: 0.4 });
        this.ring(e.x, e.y, e.z, 0xffffff, 0.6, 3.6 * k, 0.1); if (e.heavy) this.ring(e.x, e.y, e.z, e.col, 1, 8, 0.2);          // anillo de impacto: crece y se corta en seco
        this.sparks(e.x, e.y, e.z, e.col, e.heavy ? 14 : e.rush ? 3 : 6, e.heavy ? 34 : 22, e.nx || 0, e.up ? e.up * 0.9 : 0.25, e.nz || 0, k);
        this.burst(e.x, e.y, e.z, e.col, e.heavy ? 6 : 3, e.heavy ? 24 : 14, 0.95 * k);
        this.actors[e.i].hitW = e.heavy ? 0.075 : 0.035;                                                                             // fogonazo blanco del que recibe
        cam.shake(e.heavy ? 0.78 : e.rush ? 0.34 : 0.3, e.up ? 2 : e.heavy ? 0 : 1); if (e.heavy) { this.chroma = 0.018; cam.kick = 1; this.flash = Math.max(this.flash, 0.1); this.lines = Math.max(this.lines, 0.55); }
        SFX.play(e.heavy ? 'crit' : 'hit'); g_rumble(e.heavy ? 160 : 60, e.heavy ? 0.8 : 0.35); break;
      }
      case 'guard': this.ring(e.x, e.y, e.z, 0x9adcff, 1.2, 4.2, 0.12); this.crystals(e.x, e.y, e.z, 0x9adcff, 4, 9); cam.shake(0.16, 1); SFX.play('block'); break;
      case 'parry': if (e.i === 0) this.run.parry++; fx.add(3, e.x, e.y, e.z, 3, 0xffffff, { s1: 6, life: 0.22 }); this.ring(e.x, e.y, e.z, 0xffe27a, 1, 8, 0.2); this.ring(e.x, e.y, e.z, 0xffffff, 0.5, 5, 0.12); this.crystals(e.x, e.y, e.z, 0xffe27a, 9, 16); this.sparks(e.x, e.y, e.z, 0xffe27a, 8, 28, 0, 0.3, 0, 1.2); this.flash = 0.3; this.lines = Math.max(this.lines, 0.6); cam.shake(0.5); this.tag('¡CONTRAATAQUE!'); SFX.play('crit'); break;
      case 'break': this.crystals(e.x, e.y, e.z, 0x9adcff, 18, 20); this.burst(e.x, e.y, e.z, 0x9adcff, 6, 22, 1.2); this.ring(e.x, e.y, e.z, 0x9adcff, 1.5, 9, 0.22); this.ring(e.x, e.y, e.z, 0xffffff, 1, 6, 0.14); this.actors[e.i].hitW = 0.08; this.lines = Math.max(this.lines, 0.5); cam.shake(0.6); this.tag('¡GUARDIA ROTA!'); SFX.play('boom'); break;
      case 'shot': if (e.chg) { fx.add(3, e.x, e.y, e.z, 2.6 * e.chg, 0xffffff, { s1: 6 * e.chg, life: 0.16, a: 0.9 }); fx.add(1, e.x, e.y, e.z, 1, this.actors[e.i].def.col, { s1: 7 * e.chg, life: 0.25 }); cam.shake(0.3 * e.chg); SFX.play('boom'); break; }
        fx.add(3, e.x, e.y, e.z, e.disc ? 2.4 : 1.2, 0xffffff, { s1: e.disc ? 4 : 2.2, life: 0.1, a: 0.8 }); if (e.vol) fx.add(1, e.x, e.y, e.z, 0.6, this.actors[e.i].def.col, { s1: 3, life: 0.16, a: 0.7 }); SFX.play(e.disc ? 'slash' : 'ki'); break;
      case 'pop': fx.add(0, e.x, e.y, e.z, 1.6, e.col, { s1: 3.2, life: 0.18, a: 0.6 }); fx.add(1, e.x, e.y, e.z, 0.8, e.col, { s1: 3.4, life: 0.2 }); this.burst(e.x, e.y, e.z, e.col, 6, 12, 1); break;
      case 'dash': fx.add(1, e.x, e.y + 1.5, e.z, 1.2, 0xffffff, { s1: 6.5, life: 0.22 }); if (e.y < 0.4) this.dust(e.x, e.z, 7, 8); this.blur = Math.max(this.blur, 0.55); SFX.play('dash'); break;
      case 'vanish': this.ghost(e.i, 0xffffff, 0.3); for (let i = 0; i < 9; i++) fx.add(2, e.x + (Math.random() - 0.5) * 1.6, e.y + Math.random() * 3.2, e.z + (Math.random() - 0.5) * 1.6, 1.3, 0xffffff, { vy: 16 + Math.random() * 14, life: 0.2, stretch: 4 }); SFX.play('tp'); break;
      case 'appear': fx.add(3, e.x, e.y + 1.6, e.z, 3, 0xffffff, { s1: 7, life: 0.16 }); fx.add(1, e.x, e.y + 1.6, e.z, 6, 0xffffff, { s1: 1, life: 0.16 }); break;
      case 'pursue': this.blur = 0.8; fx.add(1, e.x, e.y + 1.6, e.z, 7, this.actors[e.i].def.col, { s1: 1, life: 0.2 }); this.tag('¡PERSECUCIÓN!'); SFX.play('dash'); break;
      case 'land': this.dust(e.x, e.z, e.hard ? 12 : 8, e.hard ? 11 : 6); if (e.hard) { this.fxA.add(1, e.x, 0.07, e.z, 2, 0x4a4038, { s1: 11, life: 0.5, flat: true, a: 0.7 }); this.ring(e.x, 0.1, e.z, 0xffffff, 2, 12, 0.16, true); this.shards(e.x, 0.3, e.z, 7, 11); cam.shake(0.62, 2); SFX.play('boom'); } break;
      case 'wall': this.burst(e.x, e.y, e.z, 0xffffff, 6, 20, 1.6); this.ring(e.x, e.y, e.z, 0xffffff, 2, 13, 0.2); this.sparks(e.x, e.y, e.z, 0xffffff, 12, 30, -e.x / VS.R, 0.2, -e.z / VS.R, 1.3); this.shards(e.x, Math.max(0.4, e.y - 1), e.z, 8, 14); cam.shake(0.8, 1); SFX.play('boom'); break;
      case 'dmg': { if (e.i === 1) { const r = this.run; r.maxCombo = Math.max(r.maxCombo, e.cmb); r.maxDmg = Math.max(r.maxDmg, e.tot); if (this.trn) { const t = this.trn; t.cmb = e.cmb; t.dmg = e.tot; t.max = Math.max(t.max, e.tot); this.renderTrn(true); } }
        const c = this.ui.cmb[1 - e.i]; if (e.cmb >= 2) { c.firstChild.textContent = e.cmb + ' GOLPES'; c.lastChild.textContent = Math.round(e.tot) + ' DE DAÑO'; c.classList.add('on'); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); c.t = 1.4; } break; }
      case 'ko': this.say('K.O.', 2.4); this.slow = 1.5; this.flash = 0.28; cam.shake(1.2); this.boomLite(e); SFX.play('bigboom'); g_rumble(400, 1);
        { const l = sim.f[1 - e.w]; cam.play(1.4, (k, P, L) => { const dx = P.x - l.x, dy = P.y - l.y - 1.6, dz = P.z - l.z, d = Math.hypot(dx, dy, dz) || 1, r = Math.max(10, d * 0.62);   // se acerca al derrotado sin atravesarlo
          L.set(l.x, l.y + 1.6, l.z); P.set(l.x + dx / d * r, l.y + 2.4 + dy / d * r, l.z + dz / d * r); return 34; }); } break;
      case 'timeup': this.say('¡TIEMPO!', 2); break;
      case 'final': this.startFinal(e); break;
      case 'pas': this.onPas(e); break;
      case 'match': this.finish(e.w); break;
      case 'trStart': {                                                 // transformación: plano contrapicado que se cierra sobre el luchador
        this.el.classList.add('cine'); this.ui.ultBox.classList.add('off'); this.dim = 1; this.dimCol = e.col; this.trCol = e.col;
        const f = sim.f[e.i], a0 = cam.ang, s = e.i ? -1 : 1, D = e.dur || VS.TR_CINE, K = VS.TR_SWAP / D;   // D: con intro de la forma nueva dura más
        cam.play(D, (k, P, L) => {
          if (k < K) { const q = k / K, a = a0 + s * (0.95 - q * 1.5), r = 12 - 4.5 * q * q; L.set(f.x, f.y + 1.8 + q * 0.3, f.z); P.set(f.x + Math.cos(a) * r, f.y + 3.2 - q * 2.5, f.z + Math.sin(a) * r); return 40 - 11 * q; }
          const q = (k - K) / (1 - K), a = a0 - s * (0.55 + q * 0.25), r = 8 + 9 * Math.min(1, q * 3.2);                       // tras el estallido: salto atrás
          L.set(f.x, f.y + 2.3, f.z); P.set(f.x + Math.cos(a) * r, f.y + 1.1 + q * 1.4, f.z + Math.sin(a) * r); return 52 - 9 * q;
        });
        this.flash = 0.3; SFX.play('charge'); if (SFX.scream) SFX.scream(VS.TR_SWAP + 0.3, 165); break;
      }
      case 'trSwap': {                                                  // estallido: nueva forma, onda expansiva y nombre
        if (e.i === 0) this.run.tr++; const a = this.actors[e.i], f = sim.f[e.i], h = this.ui.sides[e.i]; a.setForm(f.fi); a.pop = 1; const col = a.def.col, x = e.x, y = e.y + 1.7, z = e.z;
        h.fm.textContent = nice(a.def.form) + (e.i ? this.sfx2 : ''); this.portrait(h.pt, a.def.sheet); ImpactFlash.play(a.def.id, a.def.ix, col, 'WBWB', a.flip);
        this.ui.ult.textContent = nice(a.def.form); this.ui.ult.style.setProperty('--c', '#' + col.toString(16).padStart(6, '0')); this.ui.ultBox.classList.remove('off'); this.dimCol = col;
        fx.add(0, x, y, z, 4, 0xffffff, { s1: 11, life: 0.4, a: 0.6 }); fx.add(0, x, y, z, 6, col, { s1: 20, life: 0.8, a: 0.3 }); fx.add(3, x, y, z, 6, 0xffffff, { s1: 13, life: 0.3, a: 0.8 });
        for (let k = 0; k < 3; k++) { fx.add(1, x, 0.1, z, 2, k ? col : 0xffffff, { s1: 44 + k * 24, life: 0.55 + k * 0.22, flat: true, a: 0.5 }); fx.add(1, x, y, z, 2, k ? col : 0xffffff, { s1: 20 + k * 14, life: 0.4 + k * 0.15, a: 0.5 }); }
        this.burst(x, y, z, col, 56, 44, 1.7); this.dust(x, z, 28, 24);
        for (let k = 0; k < 26; k++) { const an = Math.random() * 6.283, v = 10 + Math.random() * 22; this.fxA.add(5, x + Math.cos(an) * 2, 0.3, z + Math.sin(an) * 2, 0.3 + Math.random() * 0.5, 0x2a2430, { vx: Math.cos(an) * v, vz: Math.sin(an) * v, vy: 9 + Math.random() * 14, g: 28, life: 1.5, bounce: true, s1: 0.2 }); }
        for (let k = 0; k < 9; k++) { const an = k * 0.698 + Math.random() * 0.4, r = 9 + Math.random() * 7; this.bolt(x, y, z, x + Math.cos(an) * r, Math.max(0.2, y + (Math.random() - 0.35) * 9), z + Math.sin(an) * r, k % 3 ? col : 0xffffff, 1.1, 0.22); }
        this.flash = 0.95; this.chroma = 0.02; this.blur = 0.8; cam.shake(1.3); cam.kick = 1; SFX.play('bigboom'); SFX.play('stinger'); g_rumble(600, 1); break;
      }
      case 'trEnd': this.el.classList.remove('cine'); this.dim = 0; break;
      case 'beamGnd': this.dust(e.x, e.z, 7, 12); fx.add(1, e.x, 0.1, e.z, 2, e.col, { s1: 13, life: 0.3, flat: true, a: 0.8 }); this.burst(e.x, 0.6, e.z, e.col, 8, 20, 1.5);
        for (let k = 0; k < 3; k++) { const an = Math.random() * 6.283, v = 6 + Math.random() * 10; this.fxA.add(5, e.x, 0.3, e.z, 0.3 + Math.random() * 0.3, 0x2a2430, { vx: Math.cos(an) * v, vz: Math.sin(an) * v, vy: 8 + Math.random() * 9, g: 28, life: 1.1, bounce: true, s1: 0.2 }); } break;
      case 'counterWin': {                                              // el rival tiene la barra llena: puede responder con su Ultimate
        if (!this.human(e.i)) break;
        const w = this.ui.clw; w.querySelector('span').innerHTML = 'Pulsa ' + this.keyOf(e.i, 'ULT') + ' para chocar tu Ultimate';
        w.style.setProperty('--d', e.dur + 's'); w.classList.remove('on'); void w.offsetWidth; w.classList.add('on'); SFX.play('ki'); break;
      }
      case 'counterOff': this.ui.clw.classList.remove('on'); break;
      case 'clashStart': this.clashStart(e); break;
      case 'clashPush': this.say('¡EMPUJA!', 0.8); this.ui.clh.classList.add('push'); this.flash = Math.max(this.flash, 0.25); cam.shake(0.8); SFX.play('bigbeam'); g_rumble(300, 0.8); break;
      case 'clashWin': {
        const w = e.w, sx = this.ui.clh; sx.classList.remove('push');
        if (w < 0) { this.tag('¡EMPATE! ¡ESTALLAN LAS DOS!'); this.flash = 0.6; cam.shake(1.3, 2); SFX.play('bigboom'); this.boom(e.x, e.y, e.z, 0xffffff, 2); }
        else {
          const a = this.actors[w]; this.tag('¡' + a.def.name.toUpperCase() + ' SE IMPONE!'); this.flash = 0.45; this.lines = 1; this.blur = 1; cam.shake(1.1, 2); SFX.play('bigbeam'); g_rumble(500, 1);
          ImpactFlash.play(a.def.id, a.def.ix, a.def.col, 'WBWB', a.flip);
        }
        this.burst(e.x, e.y, e.z, 0xffffff, 30, 34, 2); this.ring(e.x, e.y, e.z, 0xffffff, 3, 22, 0.35); break;
      }
      case 'clashEnd': this.el.classList.remove('clash'); this.ui.clh.classList.remove('on', 'push'); this.dim = 0; this.cam.cine = null; this.clashV = null; break;
      case 'ultStart': {
        if (e.i === 0) { this.run.ult++; if (e.sup) this.run.sup++; } this.ui.ultBox.classList.remove('off'); if (e.sup) { this.tag('¡ULTIMATE SUPERIOR!'); const f0 = sim.f[e.i]; for (let k = 0; k < 6; k++) { const an = k * 1.05; this.bolt(f0.x + Math.cos(an) * 7, f0.y + 13, f0.z + Math.sin(an) * 7, f0.x, f0.y + 1.5, f0.z, k & 1 ? e.col : 0xffffff, 1, 0.2); } }
        this.el.classList.add('cine'); this.ui.ult.textContent = e.name; this.ui.ult.style.setProperty('--c', '#' + e.col.toString(16).padStart(6, '0')); this.dim = 1; this.dimCol = e.col;
        const f = sim.f[e.i], a0 = cam.ang, s = e.i ? -1 : 1;
        cam.play(VS.ULT_CINE, (k, P, L) => { const a = a0 + s * (0.5 - k * 1.0), r = 8.4 - 3 * k; L.set(f.x, f.y + 1.9, f.z); P.set(f.x + Math.cos(a) * r, f.y + 2.6 - k * 1.1, f.z + Math.sin(a) * r); return 36 - 8 * k; });
        this.flash = 0.35; SFX.play('charge'); break;
      }
      case 'ultGo': { const ua = this.actors[e.i]; ImpactFlash.play(ua.def.id, ua.def.ix, e.col, 'WBW', ua.flip); } this.el.classList.remove('cine'); cam.shake(0.9); this.blur = 1; this.flash = 0.3; this.lines = 1; SFX.play(e.type === 'beam' ? 'bigbeam' : e.type === 'rush' || e.type === 'slash' || e.type === 'grab' || e.type === 'clone' ? 'dash' : 'pulse'); break;
      case 'beamHit': this.burst(e.x, e.y, e.z, e.col, 7, 22, 1.5); fx.add(0, e.x, e.y, e.z, 3, e.col, { s1: 5, life: 0.14, a: 0.5 }); cam.shake(0.42); SFX.play('hit'); break;
      case 'rushLock': { const f = sim.f[1 - e.i], a0 = cam.ang; cam.play(1.5, (k, P, L) => { const a = a0 + k * 2.6; L.set(f.x, f.y + 1.6, f.z); P.set(f.x + Math.cos(a) * 9, f.y + 2.2 + Math.sin(k * 3.1) * 1.4, f.z + Math.sin(a) * 9); return 34; }); break; }
      case 'rushUp': { const f = sim.f[e.i], foe = sim.f[1 - e.i], a0 = cam.ang;                       // remate superior: contrapicado que sigue al rival hasta el cielo y de vuelta al suelo
        cam.play(1.0, (k, P, L) => { const h = Math.max(0, foe.y - f.y), r = 13 + h * 0.55; L.set(foe.x, (f.y + foe.y) / 2 + 1.8, foe.z); P.set(foe.x + Math.cos(a0) * r, 1.1 + h * 0.12, foe.z + Math.sin(a0) * r); return 46; }); SFX.play('dash'); break; }
      case 'rushHit': if (e.n & 1) this.ghost(e.i, this.actors[e.i].def.col, 0.16); break;
      case 'bombGo': cam.shake(0.5); SFX.play('beam'); break;
      case 'boom':
        if (e.lite) { fx.add(0, e.x, e.y, e.z, 3, 0xffffff, { s1: 7, life: 0.22, a: 0.7 }); fx.add(0, e.x, e.y, e.z, 4, e.col, { s1: 10, life: 0.4, a: 0.5 }); fx.add(1, e.x, 0.08, e.z, 2, e.col, { s1: 13, life: 0.4, flat: true, a: 0.8 });   // impacto de la lluvia de ki: más ligero
          this.burst(e.x, e.y, e.z, e.col, 12, 22, 1.5); this.dust(e.x, e.z, 6, 9); cam.shake(0.45); SFX.play('boom'); break; }
        this.boom(e.x, e.y, e.z, e.col, e.big); g_rumble(300, 1);
        if (e.pil) { for (let k = 0; k < 22; k++) { const an = Math.random() * 6.283, r = Math.random() * 3.2; fx.add(2, e.x + Math.cos(an) * r, Math.random() * 3, e.z + Math.sin(an) * r, 2.4, k % 3 ? e.col : 0xffffff, { vy: 45 + Math.random() * 40, life: 0.5 + Math.random() * 0.3, stretch: 7, a: 0.85 }); }
          for (let k = 0; k < 5; k++) fx.add(0, e.x, 2 + k * 3.6, e.z, 8, e.col, { s1: 4, life: 0.6, a: 0.5 }); }                                       // pilar de energía
        break;
      case 'ultEnd': this.el.classList.remove('cine'); this.dim = 0; break;
    }
  }
  /** Relámpago: línea quebrada de chispas alargadas entre dos puntos */
  bolt(x0, y0, z0, x1, y1, z1, col, w, life) {
    const n = 7, d = Math.hypot(x1 - x0, y1 - y0, z1 - z0), j = d * 0.11; let px = x0, py = y0, pz = z0; w = w || 0.8;
    for (let i = 1; i <= n; i++) {
      const k = i / n, e = i < n ? 1 : 0, qx = x0 + (x1 - x0) * k + (Math.random() - 0.5) * j * e, qy = y0 + (y1 - y0) * k + (Math.random() - 0.5) * j * e, qz = z0 + (z1 - z0) * k + (Math.random() - 0.5) * j * e;
      const sx = qx - px, sy = qy - py, sz = qz - pz, L = Math.hypot(sx, sy, sz) || 1, o = { vx: sx / L * 0.01, vy: sy / L * 0.01, vz: sz / L * 0.01, life: life || 0.12, stretch: L * 1.25 / w };
      this.fx.add(2, (px + qx) / 2, (py + qy) / 2, (pz + qz) / 2, w, 0xffffff, o); o.stretch = L * 1.25 / (w * 2.6); this.fx.add(2, (px + qx) / 2, (py + qy) / 2, (pz + qz) / 2, w * 2.6, col, o);
      px = qx; py = qy; pz = qz;
    }
    this.fx.add(0, x1, y1, z1, 2.2 * w, col, { s1: 0.6, life: 0.14, a: 0.4 });
  }
  /** Línea recta de luz entre dos puntos (tajos, puños que atraviesan) */
  line(x0, y0, z0, x1, y1, z1, col, w, life, ink) {
    const sx = x1 - x0, sy = y1 - y0, sz = z1 - z0, L = Math.hypot(sx, sy, sz) || 1, o = { vx: sx / L * 0.01, vy: sy / L * 0.01, vz: sz / L * 0.01, life, stretch: L / (w * 0.5), a: 1 }, mx = (x0 + x1) / 2, my = (y0 + y1) / 2, mz = (z0 + z1) / 2;
    if (ink) {                                                          // tajo de manga: hoja blanca afilada sobre un trazo de tinta, y esquirlas a lo largo del corte
      const d = { vx: o.vx, vy: o.vy, vz: o.vz, life: life * 1.15, hard: true, a: 0.92 }; this.fxA.add(6, mx, my, mz, w * 1.5, 0x000000, Object.assign({ stretch: L * 1.04 / (w * 1.5), s1: w * 0.5 }, d)); this.fx.add(6, mx, my, mz, w * 0.62, 0xffffff, Object.assign({}, d, { stretch: L / (w * 0.62), s1: 0.02, a: 1 }));
      for (let i = this.few(5); i > 0; i--) { const k = Math.random(); this.sparks(x0 + sx * k, y0 + sy * k, z0 + sz * k, col, 1, 16, sx / L, 0.4, sz / L, 0.9); }
    }
    this.fx.add(2, mx, my, mz, w * 0.5, 0xffffff, o); const o2 = Object.assign({}, o, { stretch: L / (w * 1.5), a: 0.7 }); this.fx.add(2, mx, my, mz, w * 1.5, col, o2);
    for (let i = 0; i < 6; i++) { const k = Math.random(); this.fx.add(2, x0 + sx * k, y0 + sy * k, z0 + sz * k, 0.8, i & 1 ? col : 0xffffff, { vx: (Math.random() - 0.5) * 14, vy: (Math.random() - 0.5) * 14, vz: (Math.random() - 0.5) * 14, life: 0.22, stretch: 3 }); }
  }
  /* ---------------- Entradas, final destructivo y pasivas ---------------- */
  quote(i, txt) {
    const q = this.ui.vq; if (txt == null) { q.classList.remove('on'); return; }
    q.className = 'vq on ' + (i ? 'r' : 'l'); q.style.setProperty('--c', '#' + new THREE.Color(this.actors[i].def.col).lerp(new THREE.Color(0xffffff), 0.35).getHexString());
    q.firstChild.textContent = this.actors[i].def.name; q.lastChild.textContent = txt;
  }
  /** Reparto de la presentación: cada luchador tiene VS_INTRO_SLOT segundos; después sale el rótulo de la ronda */
  stepIntro() {
    const sim = this.sim, I = this.intro, t = sim.pt, end = VS_INTRO_T - 2.3;
    if (sim.phase !== 'intro' || sim.round !== 1 || t >= end) {            // se acabó (o la han saltado)
      this.intro = null; this.quote(); this.el.classList.remove('cine'); this.ui.ultBox.classList.remove('off'); this.cam.cine = null;
      if (sim.round === 1 && sim.phase === 'intro') this.say(this.rndTxt, 1.5); return;
    }
    const q = Math.min(1, Math.floor(t / VS_INTRO_SLOT));
    if (q !== I.q) {                                                      // plano corto del que entra
      I.q = q; this.quote(); const f = sim.f[q], sd = q ? -1 : 1, cam = this.cam;
      cam.play(VS_INTRO_SLOT, (k, P, L) => { L.set(f.x, 2.5, f.z); P.set(f.x + sd * (3.5 - 2.5 * k), 2.1 + 0.5 * k, f.z - 11.5 + 1.8 * k); return 34; });
      cam.pos.set(f.x + sd * 3.5, 2.1, f.z - 11.5); cam.look.set(f.x, 2.5, f.z);
    }
    if (!I.s[q].said && t - q * VS_INTRO_SLOT > 1.0) { I.s[q].said = 1; this.quote(q, vsVoz(this.ids[q], 'i', this.ids[1 - q])); }
  }
  /** Dónde y cómo se dibuja el luchador i mientras duran las entradas. Devuelve {x, y, z (desplazamiento), hide, fr, pow, roll, sq} */
  introPose(i, a, x, z, T) {
    const sim = this.sim, I = this.intro, st = I.s[i], t = sim.pt - i * VS_INTRO_SLOT, kind = VS_INTRO[this.ids[i]] || 'fly', col = a.def.col, A = a.def.anim, fx = this.fx, o = { x: 0, y: 0, z: 0, hide: false };
    if (t < 0) { o.hide = true; return o; }
    const once = (k, at, fn) => { if (!st[k] && t >= at) { st[k] = 1; fn(); } };
    if (a.intros[0]) {                                                    // intro dibujada de su forma (assets/intros.js): aparece, se enciende, su gesto y la pose
      o.isp = FormIntros.frame(t);
      once('s', 0.01, () => { SFX.play('charge'); fx.add(1, x, 0.1, z, 2, col, { s1: 10, life: 0.45, flat: true, a: 0.7 }); });
      once('a', FormIntros.at(7), () => { fx.add(1, x, 1.7, z, 2, col, { s1: 14, life: 0.4 }); fx.add(1, x, 0.1, z, 2, 0xffffff, { s1: 18, life: 0.45, flat: true, a: 0.7 }); this.burst(x, 1.6, z, col, 18, 16, 1.2); this.dust(x, z, 12, 10); this.cam.shake(0.6); SFX.play('impact'); });
      once('b', FormIntros.at(11), () => { this.burst(x, 1.8, z, 0xffffff, 10, 12, 0.9); this.cam.shake(0.35); });
      return o;
    }
    if (kind === 'tp') {                                                  // aparece de golpe
      o.hide = t < 0.45; once('a', 0.45, () => { fx.add(1, x, 1.7, z, 7, 0xffffff, { s1: 0.5, life: 0.2 }); fx.add(0, x, 1.7, z, 3, col, { s1: 8, life: 0.3, a: 0.7 }); this.burst(x, 1.7, z, col, 14, 14, 1.1); a.pop = 0.6; SFX.play('tp'); });
    } else if (kind === 'sky') {                                          // cae del cielo y agrieta el suelo
      const k = Math.min(1, t / 0.5); o.y = 46 * (1 - k) * (1 - k * 0.4); if (k < 1) { o.fr = A.dash; o.roll = -1.2; if ((sim.tick & 1) === 0) this.ghost(i, col, 0.2); }
      once('a', 0.5, () => { this.dust(x, z, 22, 14); this.fxA.add(1, x, 0.07, z, 2, 0x4a4038, { s1: 13, life: 0.9, flat: true, a: 0.75 }); fx.add(1, x, 0.1, z, 2, 0xffffff, { s1: 16, life: 0.35, flat: true, a: 0.8 }); this.cam.shake(0.9); SFX.play('boom'); g_rumble(160, 0.7); });
      if (t >= 0.5 && t < 0.72) o.sq = 0.22 * (1 - (t - 0.5) / 0.22);
    } else if (kind === 'fly') {                                          // llega volando desde fuera y frena en seco
      const k = Math.min(1, t / 0.65), e = (1 - k) * (1 - k), sd = i ? -1 : 1; o.x = sd * 42 * e; o.y = 9 * e; if (k < 1) { o.fr = A.dash; if ((sim.tick & 1) === 0) this.ghost(i, col, 0.2); }
      once('s', 0.01, () => SFX.play('dash')); once('a', 0.65, () => { this.dust(x, z, 12, 9); fx.add(1, x, 1.6, z, 1, col, { s1: 7, life: 0.3 }); });
    } else if (kind === 'float') {                                        // baja despacio, levitando
      const k = Math.min(1, t / 1.5), e = 1 - k * k * (3 - 2 * k); o.y = 8.5 * e; o.pow = k < 1 ? 0.3 : 0;
      if (k < 1 && (sim.tick % 5) === 0) fx.add(0, x + (Math.random() - 0.5) * 2, o.y + 0.2, z + (Math.random() - 0.5) * 2, 0.5, col, { vy: -3, life: 0.5, a: 0.7 });
      once('a', 1.5, () => { fx.add(1, x, 0.1, z, 1, col, { s1: 9, life: 0.5, flat: true, a: 0.7 }); });
    } else if (kind === 'rise') {                                         // surge del suelo
      const k = Math.min(1, t / 0.9); o.y = -7.5 * (1 - k) * (1 - k);
      if (k < 1 && (sim.tick % 3) === 0) { this.dust(x, z, 3, 5); fx.add(0, x + (Math.random() - 0.5) * 2.5, 0.3, z + (Math.random() - 0.5) * 2.5, 0.7, col, { vy: 9, life: 0.45, a: 0.8 }); }
      once('s', 0.01, () => { this.fxA.add(1, x, 0.07, z, 1, 0x2a2430, { s1: 8, life: 1.6, flat: true, a: 0.8 }); SFX.play('boom'); }); once('a', 0.9, () => { this.burst(x, 1.4, z, col, 16, 16, 1.2); a.pop = 0.5; });
    } else {                                                              // aura: ya está ahí, concentrado, y su energía estalla
      if (t < 0.7) { o.fr = A.chgSeq ? A.chgSeq[Math.floor(T * 10) % A.chgSeq.length] : A.idle; o.pow = 0.25 + t; }
      else o.pow = t < 1.6 ? 0.6 : 0;
      once('a', 0.7, () => { fx.add(1, x, 1.7, z, 2, col, { s1: 20, life: 0.45 }); fx.add(1, x, 0.1, z, 2, 0xffffff, { s1: 24, life: 0.5, flat: true, a: 0.8 }); this.burst(x, 1.7, z, col, 26, 24, 1.6); this.dust(x, z, 16, 12); this.cam.shake(0.8); a.pop = 0.8; this.flash = Math.max(this.flash, 0.14); SFX.play('bigboom'); });
    }
    return o;
  }
  /** FINAL DESTRUCTIVO: el K.O. que cierra el combate, con un golpe fuerte o una Ultimate, manda al perdedor contra una montaña */
  startFinal(e) {
    const sim = this.sim, l = sim.f[1 - e.w], M = this.arena.mts, cam = this.cam; let best = null, bd = 9;
    for (const m of M) {                                                  // la montaña alta que quede más en la dirección del golpe
      if (m.userData.h < 95 || m.userData.dead) continue; const a = Math.atan2(m.position.z - l.z, m.position.x - l.x); let d = Math.abs(a - Math.atan2(e.dz, e.dx)); if (d > Math.PI) d = 6.2832 - d;
      if (d < bd) { bd = d; best = m; }
    }
    if (!best) return;
    const U = best.userData, iy = 16, rr = U.R * (1 - (iy + 62) / U.h) * 0.85, mx = best.position.x, mz = best.position.z, mh = Math.hypot(mx - l.x, mz - l.z) || 1, ux = (mx - l.x) / mh, uz = (mz - l.z) / mh;
    const F = this.fin = { t: 0, l: l.i, w: e.w, mt: best, x0: l.x, y0: l.y, z0: l.z, x1: mx - ux * rr, y1: iy, z1: mz - uz * rr, ux, uz, px: l.x, py: l.y, pz: l.z, gone: false, hit: false, cut: false, n: 0, col: this.actors[e.w].def.col };
    this.ui.big.classList.remove('go'); this.slow = 0.25; this.el.classList.add('cine'); this.ui.ultBox.classList.add('off'); SFX.play('stinger');
    cam.play(VS_FIN.end, (k, P, L) => {
      if (F.t < VS_FIN.cut) { L.set(F.px, F.py + 1.6, F.pz); P.set(F.x0 - ux * 15 - uz * 5, F.y0 + 5.5, F.z0 - uz * 15 + ux * 5); return 42; }           // desde detrás del que pega: lo ve alejarse
      P.set(F.x1 - ux * 62 - uz * 34, F.y1 + 14, F.z1 - uz * 62 + ux * 34); L.set(F.x1, F.y1 + 6, F.z1);                                                // corte: junto a la montaña
      if (!F.cut) { F.cut = true; cam.pos.copy(P); cam.look.copy(L); } return 46;
    });
  }
  stepFinal(dt) {
    const F = this.fin, fx = this.fx, fxA = this.fxA, V = VS_FIN, cam = this.cam, col = F.col; F.t += dt;
    if (!F.hit) {
      const k = Math.max(0, Math.min(1, (F.t - V.go) / (V.hit - V.go))), e = k * k * (3 - 2 * k) * 0.35 + k * 0.65;
      F.px = F.x0 + (F.x1 - F.x0) * e; F.pz = F.z0 + (F.z1 - F.z0) * e; F.py = F.y0 + (F.y1 - F.y0) * e + Math.sin(k * Math.PI) * 9;
      if (k > 0 && k < 1) { this.ghost(F.l, 0xffffff, 0.3); fx.add(0, F.px, F.py + 1.6, F.pz, 3.5, col, { s1: 0.5, life: 0.35, a: 0.6 }); fx.add(2, F.px, F.py + 1.6, F.pz, 2.4, 0xffffff, { vx: -F.ux * 60, vz: -F.uz * 60, life: 0.22, stretch: 9 }); }
      if (k >= 1) {                                                       // impacto
        F.hit = true; F.gone = true; const x = F.x1, y = F.y1, z = F.z1; this.say('¡FINAL DESTRUCTIVO!', 2.4);
        fx.add(0, x, y, z, 20, 0xffffff, { s1: 90, life: 0.5, a: 0.9 }); fx.add(0, x, y, z, 30, col, { s1: 150, life: 1.1, a: 0.6 }); fx.add(1, x, y, z, 10, 0xffffff, { s1: 170, life: 0.8 }); fx.add(1, x, y, z, 10, col, { s1: 110, life: 1.1 });
        this.burst(x, y, z, col, 24, 190, 12); this.sparks(x, y, z, col, 22, 240, -F.ux, 0.5, -F.uz, 9); this.ring(x, y, z, 0xffffff, 12, 150, 0.4); this.lines = 1; this.flash = 0.75; this.chroma = 0.03; cam.shake(1.3); SFX.play('bigboom'); g_rumble(500, 1);
        for (let i = 0; i < 26; i++) { const a = Math.random() * 6.283, v = 30 + Math.random() * 70; fxA.add(5, x, y, z, 2.5 + Math.random() * 4, 0x2a2430, { vx: Math.cos(a) * v - F.ux * 25, vz: Math.sin(a) * v - F.uz * 25, vy: 25 + Math.random() * 60, g: 50, life: 2.6, s1: 1.5 }); }
      }
      return;
    }
    const m = F.mt, U = m.userData, k = Math.min(1, (F.t - V.hit) / 2.0);                  // la montaña se parte y se hunde
    if (!U.dead) { U.dead = 1; }
    m.scale.y = 1 - 0.55 * k * k; m.scale.x = m.scale.z = 1 + 0.18 * k; m.position.y = U.y - U.h * 0.3 * k * k; m.rotation.z = 0.1 * k;
    if (k < 1) {
      cam.shake(0.5 * (1 - k)); F.n++;
      if (F.n % 6 === 0) { const a = Math.random() * 6.283, r = Math.random() * U.R * 0.7; fxA.add(4, F.x1 + Math.cos(a) * r, F.y1 - 14 + Math.random() * 16 * (1 - k), F.z1 + Math.sin(a) * r, 12, 0xb8a898, { vx: Math.cos(a) * 9, vz: Math.sin(a) * 9, vy: 4 + Math.random() * 6, drag: 0.8, life: 1.8, s1: 30, a: 0.28 }); }
      if (F.n % 14 === 5 && k < 0.6) { const a = Math.random() * 6.283, r = 10 + Math.random() * 22, x = F.x1 + Math.cos(a) * r, y = F.y1 + (Math.random() - 0.3) * 26, z = F.z1 + Math.sin(a) * r; fx.add(0, x, y, z, 8, 0xffffff, { s1: 40, life: 0.35, a: 0.8 }); fx.add(0, x, y, z, 12, col, { s1: 60, life: 0.6, a: 0.55 }); fx.add(1, x, y, z, 6, col, { s1: 70, life: 0.5 }); this.flash = Math.max(this.flash, 0.2); SFX.play('boom'); }
    }
    if (F.t > V.end && !F.out) { F.out = true; this.el.classList.remove('cine'); this.ui.ultBox.classList.remove('off'); }
  }
  /** Avisos y efectos de las pasivas */
  onPas(e) {
    const fx = this.fx, col = this.actors[e.i].def.col;
    switch (e.k) {
      case 'senzu': this.tag('¡JUDÍA SENZU!'); fx.add(1, e.x, e.y, e.z, 1, 0x7dffb0, { s1: 10, life: 0.5 }); this.burst(e.x, e.y, e.z, 0x7dffb0, 18, 12, 1.2); SFX.play('heal'); break;
      case 'zenkai': this.tag('¡ZENKAI! +' + this.sim.f[e.i].zk * 4 + ' % DE FUERZA'); fx.add(1, e.x, e.y, e.z, 1, col, { s1: 9, life: 0.4 }); this.burst(e.x, e.y, e.z, col, 12, 14, 1.1); this.actors[e.i].pop = 0.4; SFX.play('ki'); break;
      case 'armadura': fx.add(3, e.x, e.y, e.z, 1.5, 0xffe27a, { s1: 4.5, life: 0.16 }); fx.add(1, e.x, e.y, e.z, 3.6, 0xffe27a, { s1: 4.4, life: 0.2, a: 0.7 }); SFX.play('guard'); break;
      case 'absorbe': fx.add(1, e.x, e.y, e.z, 7, col, { s1: 0.5, life: 0.25 }); fx.add(0, e.x, e.y, e.z, 2.5, 0xffffff, { s1: 0.4, life: 0.25, a: 0.8 }); SFX.play('ki'); break;
      case 'kamikaze': this.tag('¡AUTODESTRUCCIÓN!'); this.boom(e.x, e.y, e.z, 0xb8ff5a, 2); break;
      case 'cambio': this.tag('¡CAMBIO DE CUERPO!'); this.flash = Math.max(this.flash, 0.4); for (const f of this.sim.f) { fx.add(1, f.x, f.y + 1.6, f.z, 1, 0xc88aff, { s1: 12, life: 0.45 }); this.burst(f.x, f.y + 1.6, f.z, 0xc88aff, 16, 16, 1.2); } this.cam.shake(0.6); SFX.play('tp'); break;
    }
  }
  boomLite(e) { this.fx.add(0, e.x, e.y, e.z, 2, 0xffffff, { s1: 4.5, life: 0.3, a: 0.5 }); this.fx.add(1, e.x, e.y, e.z, 1.5, 0xffffff, { s1: 9, life: 0.4, a: 0.8 }); this.burst(e.x, e.y, e.z, 0xffffff, 22, 26, 1.1); }
  finish(w) {
    const d = this.actors[w].def, c = this.cfg, sim = this.sim, tw = c.mode === 'ladder' ? this.tw : null, win = w === 0, S = VsStats.d(), N = VS_TOWER.n;
    VsStats.fight(c.pick[0].id, win, win && sim.f[1].wins === 0, Math.round(sim.tick / 60), this.run, c.mode === 'local');
    let h2 = '¡GANA ' + d.name + '!', p = (win ? 'Jugador 1' : c.mode === 'local' ? 'Jugador 2' : 'CPU') + ' · ' + sim.f[0].wins + ' - ' + sim.f[1].wins, btn = [['rematch', 'Revancha'], ['reselect', 'Cambiar luchadores'], ['exit', 'Salir al menú']];
    if (tw) {                                                           // Torre: premio por victoria, siguiente rival o fin
      if (win) {
        const z = 100 * (tw.i + 1), cr = 15; tw.zeni += z; tw.cry += cr; Save.d.zeni += z; Save.d.crystals = (Save.d.crystals || 0) + cr; S.towerBest = Math.max(S.towerBest, tw.i + 1);
        if (tw.i >= N - 1) {
          const first = !S.tower[tw.level], bonus = VS_TOWER.levels[tw.level].cry * (first ? 2 : 1); S.tower[tw.level] = (S.tower[tw.level] || 0) + 1; Save.d.crystals += bonus; tw.cry += bonus;
          h2 = '¡TORRE SUPERADA!'; p = N + ' rivales derrotados · +' + tw.zeni + ' zeni · +' + tw.cry + ' cristales' + (first ? ' (primera vez: premio doble)' : ''); btn = [['reselect', 'Volver al Versus'], ['exit', 'Salir al menú']]; SFX.play('stinger');
        } else { h2 = '¡VICTORIA!'; p = 'Rival ' + (tw.i + 1) + ' de ' + N + ' superado · +' + z + ' zeni · +' + cr + ' cristales<br>Siguiente: <b>' + nice(charById(tw.foes[tw.i + 1].id).name) + '</b>' + (tw.i + 1 === N - 1 ? ' · jefe final' : ''); btn = [['next', 'Siguiente combate'], ['reselect', 'Abandonar la torre']]; }
      } else { h2 = 'DERROTA'; p = 'Has caído ante ' + d.name + ' en el combate ' + (tw.i + 1) + ' de ' + N + '.'; btn = tw.cont > 0 ? [['retry', 'Reintentar (queda 1 continuación)'], ['reselect', 'Abandonar la torre']] : [['reselect', 'Volver al Versus'], ['exit', 'Salir al menú']]; }
      Save.write();
    }
    // Pantalla de victoria: la cámara rodea al ganador, que suelta su frase (distinta según a quién haya vencido)
    const quote = vsVoz(this.ids[w], 'w', this.ids[1 - w]), wf = sim.f[w], a0 = this.cam.ang;
    this.vic = { w, t: 0 }; this.el.classList.add('cine'); this.ui.ultBox.classList.add('off'); this.ui.end.classList.add('win');
    this.cam.play(1e6, (k, P, L) => { const t = this.vic ? this.vic.t : 0, a = a0 + 0.5 - Math.min(1, t / 2.2) * 0.5 + t * 0.07, r = 17 - 4 * Math.min(1, t / 1.6); L.set(wf.x, wf.y + 0.7, wf.z); P.set(wf.x + Math.cos(a) * r, wf.y + 0.9 + 0.8 * Math.min(1, t / 2), wf.z + Math.sin(a) * r); return 31; });   // el ganador queda en la mitad de arriba, sobre el panel
    this.ui.end.firstChild.innerHTML = '<h2>' + h2 + '</h2><p>' + p + '</p><q>' + quote + '</q><div class="bt">' + btn.map((b, i) => '<button' + (i ? '' : ' class="go"') + ' data-v="' + b[0] + '">' + b[1] + '</button>').join('') + '</div>'; if (this.touch) this.touch.clear();
    setTimeout(() => { if (this.sim && this.sim.phase === 'end') this.ui.end.classList.add('on'); }, 1500); SFX.music('menu'); SFX.play('stinger');
  }

  /** Pestaña Controles: teclas de los dos jugadores (se pueden cambiar) y la guía de mecánicas */
  keysPane() {
    const w = this.bindWait, col = (p) => '<div class="kcol p' + (p + 1) + '"><h4>JUGADOR ' + (p + 1) + ' · TECLADO</h4><div class="kg">' +
      VS_ACTS.map(([a, t]) => { const on = w && w.p === p && w.a === a; return '<button class="kb' + (on ? ' on' : '') + '" data-v="bind" data-a="' + p + ':' + a + '"><span>' + t + '</span><kbd>' + (on ? '…' : vsKeyName(VS_KEYS[p][a])) + '</kbd></button>'; }).join('') + '</div></div>';
    return '<div class="keys"><p class="kmsg">' + (w ? 'Pulsa la tecla nueva. <b>Esc</b> para cancelar.' : 'Toca una acción y pulsa la tecla que quieras. Si ya la usaba otra acción, se intercambian.') + (this.bindMsg ? ' <b>' + this.bindMsg + '</b>' : '') + '</p>' +
      '<div class="kcols">' + col(0) + col(1) + '</div><div class="vseg"><button data-v="bindreset"' + (VsBinds.changed() ? '' : ' disabled') + '>Restablecer teclas</button></div>' + VS_KEYS_TIPS + '</div>';
  }
  /** Espera la siguiente tecla y la asigna (Esc cancela). La pulsación no llega al resto del juego */
  startBind(p, a) {
    if (this.bindOff) this.bindOff();
    this.bindWait = { p, a }; this.bindMsg = '';
    const paint = () => { const q = () => this.ui.sel.querySelector('.pane'), y = q() ? q().scrollTop : 0; this.renderSelect(); if (q()) q().scrollTop = y; };
    const on = (e) => {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.code !== 'Escape') {
        if (!VsBinds.ok(e.code)) { this.bindMsg = 'Esa tecla no se puede usar.'; paint(); return; }
        VsBinds.set(p, a, e.code); Save.write(); this.refreshHint();
      }
      this.bindOff();
    };
    this.bindOff = () => { window.removeEventListener('keydown', on, true); this.bindOff = null; this.bindWait = null; this.bindMsg = ''; if (this.active && !this.sim) paint(); };
    window.addEventListener('keydown', on, true);
    paint();
  }
  /** Actualiza la línea de teclas que se ve durante el combate */
  refreshHint() { const h = this.el.querySelector('.hint'); if (h) h.innerHTML = vsHint(); }
  /** Panel del entrenamiento: último combo, récord de la sesión y ajustes (también con las teclas 1-4 y R) */
  renderTrn(onlyNums) {
    const t = this.trn, c = this.cfg, el = this.ui.trn; if (!t) return;
    if (onlyNums && el.firstChild) { el.firstChild.innerHTML = this.trnNums(); return; }
    const b = (k, key, txt) => '<button data-v="trn" data-a="' + k + '"><kbd>' + key + '</kbd>' + txt + '</button>';
    el.innerHTML = '<div>' + this.trnNums() + '</div><div class="vseg">' + b('dummy', '1', 'Rival: ' + VS_DUMMY[c.dummy]) + b('ki', '2', 'Ki ' + (c.tki === '1' ? 'infinito' : 'normal')) + b('tm', '3', 'Barra ' + (c.ttm === '1' ? 'llena' : 'normal')) + b('pos', 'R', 'Recolocar') + b('base', '4', 'Volver a base') + '</div>';
  }
  trnNums() { const t = this.trn; return 'Último combo: <b>' + t.cmb + ' golpes</b> · <b>' + Math.round(t.dmg) + '</b> de daño · Récord: <b>' + Math.round(t.max) + '</b>'; }

  /** Efectos que dependen del estado de cada paso (estelas, carga, chispas del rayo) */
  /** ¿Lo maneja una persona (teclado, mando o pantalla táctil)? */
  human(i) { const p = this.inputs && this.inputs[i]; return !!p && !(p instanceof VsAI) && !(typeof VsDummy !== 'undefined' && p instanceof VsDummy); }
  /** Tecla (o botón) de una acción para el jugador i, lista para el HUD */
  keyOf(i, act) {
    if (this.touch && i === 0) return '<b>' + ({ ULT: 'ULTI', ATK: 'GOLPE', CHARGE: 'CARGAR' }[act] || act) + '</b>';
    return '<b>' + vsKeyName(VS_KEYS[i][act]) + '</b>';
  }
  /** Empieza el choque: plano lateral, impact frame doble y el marcador del pulso */
  clashStart(e) {
    const sim = this.sim, ui = this.ui, A = this.actors;
    ui.clw.classList.remove('on'); this.el.classList.remove('cine'); this.el.classList.add('clash'); ui.ultBox.classList.add('off');
    const f0 = sim.f[0], f1 = sim.f[1], left = sim.screenX(f1.x - f0.x, f1.z - f0.z) >= 0 ? 0 : 1;      // quién sale a la izquierda de la pantalla
    this.clashV = { left, taps: [0, 0], hit: 0 };
    const css = (c) => '#' + c.toString(16).padStart(6, '0');
    ui.cha.style.background = css(A[left].def.col); ui.chbb.style.background = css(A[1 - left].def.col);
    [left, 1 - left].forEach((i, k) => { const n = ui.chn[k]; n.querySelector('span').textContent = e.names[i]; n.style.setProperty('--c', css(A[i].def.col)); });
    const hs = [0, 1].filter((i) => this.human(i));
    ui.chk.innerHTML = !hs.length ? '' : hs.length === 2 ? 'J1: machaca ' + this.keyOf(0, 'ATK') + ' · mantén ' + this.keyOf(0, 'CHARGE') + ' &nbsp;|&nbsp; J2: machaca ' + this.keyOf(1, 'ATK') + ' · mantén ' + this.keyOf(1, 'CHARGE')
      : 'Machaca ' + this.keyOf(hs[0], 'ATK') + ' para empujar · mantén ' + this.keyOf(hs[0], 'CHARGE') + ' para gastar ki y empujar el doble';
    ui.clh.classList.add('on'); this.say('¡CHOQUE!', 1.0); this.dim = 1; this.dimCol = A[e.by].def.col;
    this.flash = 0.5; this.cam.shake(1, 2); SFX.play('bigboom'); g_rumble(400, 1);
    ImpactFlash.playDuo({ cid: A[left].def.id, fi: A[left].def.ix, col: A[left].def.col }, { cid: A[1 - left].def.id, fi: A[1 - left].def.ix, col: A[1 - left].def.col }, 'CWBC');
    const C = VS.CLASH, cx = sim.cx, cz = sim.cz, k0 = sim.clash;
    this.cam.play(C.intro + C.push + C.out, (k, P, L) => {             // de lado, a media distancia, y se va cerrando sobre el punto del choque
      const q = sim.clash || k0, [px, py, pz] = sim.clash ? sim.clashPoint() : [q.mx, q.y + 1.7, q.mz], t = Math.min(1, k * 1.6), r = 24 - 5 * t, sw = Math.sin(k * 5) * 0.1;
      L.set(q.mx + (px - q.mx) * 0.3, py, q.mz + (pz - q.mz) * 0.3); P.set(q.mx + (cx * Math.cos(sw) - q.nx * Math.sin(sw)) * r, q.y + 3.4 - t * 1.2, q.mz + (cz * Math.cos(sw) - q.nz * Math.sin(sw)) * r); return 44 - 4 * t;
    });
  }
  /** Rayos, esferas, chispas y marcador del choque (cada fotograma) */
  drawClash(T, light) {
    const sim = this.sim, k = sim.clash, fx = this.fx, A = this.actors, R = Math.random, V = this.clashV; if (!k || !V) return;
    const [px, py, pz] = sim.clashPoint(), C = VS.CLASH;
    const grow = k.ph === 0 ? Math.min(1, k.t / 0.5) : 1, fade = k.ph === 2 && k.w < 0 ? Math.max(0, 1 - k.t / (C.out * 0.5)) : 1;
    const beams = [this.beam, this.beam2];
    for (let i = 0; i < 2; i++) {
      const f = sim.f[i], o = sim.f[1 - i], dx = o.x - f.x, dz = o.z - f.z, h = Math.hypot(dx, dz) || 1, ux = dx / h, uz = dz / h, col = A[i].def.col;
      const ox = f.x + ux * 1.3, oy = f.y + 1.7, oz = f.z + uz * 1.3, along = ((px - ox) * ux + (pz - oz) * uz) * grow;
      const sph = k.type[i] === 'bomb' || k.type[i] === 'nova', burn = k.burn[i], pulse = 1 + Math.sin(T * 34 + i * 2) * 0.06, bm = beams[i];
      const len = sph ? along - 2.6 : along + 0.6;
      bm.mesh.visible = len > 0.2 && fade > 0;
      if (bm.mesh.visible) { bm.u.uA.value.set(ox, oy, oz); bm.u.uDir.value.set(ux, 0, uz); bm.u.uLen.value = len; bm.u.uW.value = (sph ? 1.4 : 3.4) * (1 + 0.3 * burn) * pulse; bm.u.uCol.value.setHex(col); bm.u.uT.value = T; bm.u.uPow.value = (0.85 + 0.25 * burn) * fade; }
      if (sph && along > 0.5 && fade > 0) {                              // la bola gigante, empujada contra el punto del choque
        const r = 2.4 * pulse * (1 + 0.15 * burn), x = px - ux * r * 0.8, z = pz - uz * r * 0.8;
        fx.now(0, x, py, z, r * 2.6, col, 0.6 * fade); fx.now(0, x, py, z, r * 1.3, 0xffffff, 0.6 * fade); fx.now(3, x, py, z, r * 2.1, 0xffffff, 0.35 * fade, T * 2); light(x, py, z, col, 1.1);
      }
      fx.now(0, ox, oy, oz, 2.4 * pulse * fade, col, 0.55); fx.now(0, ox, oy, oz, 1.1 * fade, 0xffffff, 0.8);   // brillo en las manos
      if (burn && (sim.tick & 1)) for (let n = 0; n < 2; n++) { const a = R() * 6.283; fx.add(2, f.x + Math.cos(a) * 1.1, f.y + 0.2 + R() * 2.4, f.z + Math.sin(a) * 1.1, 1, n ? col : 0xffffff, { vy: 14 + R() * 8, life: 0.3, stretch: 4, a: 0.7 }); }   // gastando ki: llamas de aura
      if (k.taps[i] > V.taps[i]) { V.taps[i] = k.taps[i]; fx.add(1, ox, oy, oz, 1, col, { s1: 3.6 + burn * 2, life: 0.14, a: 0.8 }); if (R() < 0.5) fx.add(2, px, py, pz, 1.3, col, { vx: -ux * 30, vy: (R() - 0.5) * 20, vz: -uz * 30, life: 0.2, stretch: 4 }); }
    }
    if (grow >= 1 && fade > 0) {                                         // el punto del choque: dos colores peleando, núcleo blanco, chispas y rayos
      const c0 = A[0].def.col, c1 = A[1].def.col, p = 1 + Math.sin(T * 42) * 0.09, tug = Math.min(1, Math.abs(k.drv[0] - k.drv[1]) * 0.35);
      fx.now(0, px, py, pz, 4.4 * p * fade, c0, 0.4); fx.now(0, px, py, pz, 4 * (2 - p) * fade, c1, 0.4); fx.now(0, px, py, pz, 1.9 * p * fade, 0xffffff, 0.75);
      fx.now(3, px, py, pz, 4.6 * fade, 0xffffff, 0.35, T * 4); fx.now(3, px, py, pz, 3.6 * fade, k.p > 0 ? c0 : c1, 0.4, -T * 3); light(px, py, pz, k.p > 0 ? c0 : c1, 1.1 * fade);
      for (let n = 0; n < 2; n++) { const a = R() * 6.283, e = (R() - 0.5) * 2, v = 22 + R() * 26; fx.add(2, px, py, pz, 0.9, n & 1 ? c0 : c1, { vx: -k.nz * Math.cos(a) * v, vy: Math.sin(a) * v + e * 6, vz: k.nx * Math.cos(a) * v, life: 0.2, stretch: 5, a: 0.75 }); }
      if (sim.tick % 4 === 0) { const a = R() * 6.283; this.bolt(px, py, pz, px + Math.cos(a) * 5, py + (R() - 0.3) * 5, pz + Math.sin(a) * 5, R() < 0.5 ? c0 : c1, 0.45, 0.1); }
      if (sim.tick % 12 === 0) { fx.add(1, px, 0.1, pz, 1, sim.tick % 24 ? c0 : c1, { s1: 9 + tug * 5, life: 0.4, flat: true, a: 0.55 }); if (py < 9) this.dust(px, pz, 4, 12); }
      this.cam.shake(0.22 + tug * 0.4);
    }
    // Marcador: el punto blanco va hacia quien va perdiendo
    const lw = V.left === 0 ? k.p : -k.p, pc = 50 + lw * 50, ui = this.ui;
    ui.chm.style.left = pc.toFixed(1) + '%'; ui.cha.style.width = pc.toFixed(1) + '%'; ui.chbb.style.width = (100 - pc).toFixed(1) + '%';
    [V.left, 1 - V.left].forEach((i, n) => { const el = ui.chn[n]; el.classList.toggle('burn', !!k.burn[i]); el.querySelector('em').textContent = k.burn[i] ? '¡GASTANDO KI! ' + Math.round(sim.f[i].ki) : 'KI ' + Math.round(sim.f[i].ki); });
  }
  simFx() {
    const sim = this.sim, fx = this.fx, T = sim.tick;
    for (const f of sim.f) {
      const col = this.actors[f.i].def.col;
      if (f.st === 'dash' && (T & 1) === 0) this.ghost(f.i, col, 0.22);
      if (f.st === 'launched' && (T & 3) === 0) this.ghost(f.i, 0xffffff, 0.16);
      if (f.st === 'flurry' && (T & 1) === 0) this.ghost(f.i, col, 0.13);
      if (f.st === 'atk' && f.t < 0.14 && (T & 1) === 0) this.ghost(f.i, col, 0.1);                       // estela de los golpes rápidos
      if (f.st === 'heavy' && f.t > 0.08 && f.t < 0.3 && (T & 1) === 0) this.ghost(f.i, 0xffffff, 0.15);
      if (f.st === 'shot' && !f.done && f.chg && T % 2 === 0) { const a = Math.random() * 6.283, r = 3 + Math.random() * 2; fx.add(2, f.x + Math.cos(a) * r, f.y + 1.7 + (Math.random() - 0.5) * 3, f.z + Math.sin(a) * r, 0.8, T % 4 ? col : 0xffffff, { vx: -Math.cos(a) * r / 0.2, vz: -Math.sin(a) * r / 0.2, life: 0.18, stretch: 4 }); }   // ki cargándose
      if (f.ctr > 0 && T % 3 === 0) fx.add(0, f.x, f.y + 1.6, f.z, 3.2, 0xffffff, { s1: 1.5, life: 0.15, a: 0.35 });                        // ventana de contraataque
      if (f.st === 'charge' || (f.st === 'ult' && sim.ult && sim.ult.ph === 0)) {
        if ((T & 1) === 0) { const a = Math.random() * 6.283, r = 1 + Math.random() * 1.8; fx.add(2, f.x + Math.cos(a) * r, f.y + Math.random() * 1.5, f.z + Math.sin(a) * r, 0.9, T % 6 ? col : 0xffffff, { vy: 9 + Math.random() * 9, life: 0.4, stretch: 3 }); }
        if (T % 14 === 0 && f.y < 0.5) { fx.add(1, f.x, 0.09, f.z, 2, col, { s1: 10, life: 0.45, flat: true, a: 0.8 }); this.fxA.add(5, f.x + (Math.random() - 0.5) * 4, 0.2, f.z + (Math.random() - 0.5) * 4, 0.3, 0x3a3038, { vy: 5 + Math.random() * 4, life: 0.8, s1: 0.1 }); }
        if (f.st === 'charge' && (this.chargeSnd -= VS_DT) <= 0) { this.chargeSnd = 1.5; SFX.play('charge'); }
      }
      if (f.fi >= 2 && f.st !== 'ko' && (T + f.i * 7) % (f.fi >= 3 ? 9 : 16) === 0) {     // formas altas: chispas eléctricas alrededor del cuerpo
        const a = Math.random() * 6.283, r = 0.9 + Math.random() * 0.7, y0 = f.y + 0.4 + Math.random() * 2.6; this.bolt(f.x + Math.cos(a) * r, y0, f.z + Math.sin(a) * r, f.x + Math.cos(a + 1.3) * r, y0 + (Math.random() - 0.5) * 1.8, f.z + Math.sin(a + 1.3) * r, T % 2 ? col : 0xffffff, 0.28, 0.1);
      }
      if (f.st === 'stun' && T % 5 === 0) { const a = T * 0.2; fx.add(3, f.x + Math.cos(a) * 1.1, f.y + 3.5, f.z + Math.sin(a) * 1.1, 1.1, 0xffe27a, { life: 0.25 }); }
    }
    for (const s of sim.shots) if (!s.big && (T & 1) === 0) { if (s.disc) fx.add(1, s.x, s.y, s.z, s.r * 2.2, s.col, { s1: s.r * 0.6, life: 0.24, a: 0.6, flat: true }); else fx.add(0, s.x, s.y, s.z, 1.7, s.col, { s1: 0.3, life: 0.2, a: 0.7 }); }
    const am = this.arena.P.amb;                                        // ambiente de la arena: nieve, ascuas, polvo, motas...
    if (am && Math.random() < am.n / 60) {
      const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * 38, up = am.vy > 0;
      (am.add ? fx : this.fxA).add(am.kind, Math.cos(a) * r, up ? Math.random() * 3 : 16 + Math.random() * 10, Math.sin(a) * r, am.s * (0.6 + Math.random() * 0.8), am.col, { vx: (am.vx || 0) + (Math.random() - 0.5) * 2, vy: am.vy * (0.7 + Math.random() * 0.6), vz: (Math.random() - 0.5) * 2, life: am.life || 4, a: am.a || 0.7, s1: am.s * 0.5 });
    }
    const tr = sim.tr;
    if (tr) {                                                           // transformación en marcha
      const f = sim.f[tr.who], col = this.trCol, x = f.x, y = f.y, z = f.z, R = Math.random;
      if (!tr.sw) {
        const q = Math.min(1, tr.t / VS.TR_SWAP);
        for (let n = 0; n < 1 + ((q * 2) | 0); n++) {                     // la energía converge hacia el cuerpo
          const a = R() * 6.283, e = (R() - 0.3) * 1.6, r = 7 + R() * 5, ox = Math.cos(a) * Math.cos(e) * r, oy = Math.abs(Math.sin(e)) * r * 0.8, oz = Math.sin(a) * Math.cos(e) * r;
          fx.add(2, x + ox, y + 1.6 + oy, z + oz, 0.8, n & 1 ? 0xffffff : col, { vx: -ox / 0.3, vy: -oy / 0.3, vz: -oz / 0.3, life: 0.24, stretch: 4.5, a: 0.55 });
        }
        if (T % 3 === 0) this.fxA.add(5, x + (R() - 0.5) * 9, 0.15, z + (R() - 0.5) * 9, 0.22 + R() * 0.4, 0x3a3038, { vy: 3 + q * 11 + R() * 4, life: 0.9, s1: 0.12 });   // piedras que se elevan
        if (T % Math.max(4, 17 - ((q * 13) | 0)) === 0) { fx.add(1, x, 0.09, z, 1.5, col, { s1: 12 + q * 12, life: 0.4, flat: true, a: 0.85 }); this.dust(x, z, 6, 6 + q * 9); }
        if (T % Math.max(3, 13 - ((q * 10) | 0)) === 0) this.bolt(x + (R() - 0.5) * 11, y + 13 + R() * 6, z + (R() - 0.5) * 11, x + (R() - 0.5) * 1.6, y + R() * 3, z + (R() - 0.5) * 1.6, R() < 0.5 ? col : 0xffffff, 0.8 + q * 0.5, 0.13);
        if (T % 5 === 0) { const a = R() * 6.283; this.bolt(x, y + 1.6, z, x + Math.cos(a) * (3 + q * 5), Math.max(0.1, y + R() * 4), z + Math.sin(a) * (3 + q * 5), col, 0.4, 0.1); }
        this.cam.shake(0.22 + q * 0.6); this.chroma = Math.max(this.chroma, q * 0.008); if (q > 0.9) this.flash = Math.max(this.flash, (q - 0.9) / 0.1 * 0.8);
        if ((this.chargeSnd -= VS_DT) <= 0) { this.chargeSnd = 0.7; SFX.play('charge'); }
      } else {                                                          // recién transformado: columna de energía y rayos
        const c2 = this.actors[tr.who].def.col;
        for (let n = 0; n < 2; n++) { const a = R() * 6.283, r = 0.6 + R() * 1.8; fx.add(2, x + Math.cos(a) * r, y + R() * 2, z + Math.sin(a) * r, 1.0, n ? c2 : 0xffffff, { vy: 16 + R() * 16, life: 0.38, stretch: 4, a: 0.55 }); }
        if (T % 4 === 0) { const a = R() * 6.283, r = 2 + R() * 4; this.bolt(x, y + 1.5 + R() * 2, z, x + Math.cos(a) * r, Math.max(0.1, y + R() * 5), z + Math.sin(a) * r, T % 8 ? c2 : 0xffffff, 0.5, 0.1); }
        if (T % 10 === 0) fx.add(1, x, 0.09, z, 2, c2, { s1: 18, life: 0.5, flat: true, a: 0.7 });
        this.cam.shake(0.3);
      }
    }
    const u = sim.ult;
    if (u && u.ph === 1) {                                              // efectos propios de cada Ultimate mientras dura
      const uf = sim.f[u.who], uo = sim.f[1 - u.who], c = this.actors[u.who].def.col, R = Math.random;
      if (u.type === 'nova' && !u.r && u.t < 0.42) { for (let n = 0; n < 3; n++) { const a = R() * 6.283, e = (R() - 0.3) * 1.6, r = 9 + R() * 8, ox = Math.cos(a) * Math.cos(e) * r, oy = Math.abs(Math.sin(e)) * r, oz = Math.sin(a) * Math.cos(e) * r;   // aspira la energía
        fx.add(2, uf.x + ox, uf.y + 1.6 + oy, uf.z + oz, 0.9, n ? c : 0xffffff, { vx: -ox / 0.25, vy: -oy / 0.25, vz: -oz / 0.25, life: 0.2, stretch: 5, a: 0.7 }); } this.cam.shake(0.3); }
      if (u.type === 'nova' && u.r > 0) this.cam.shake(0.5);
      if (u.type === 'grab' && u.lock && u.v === 2 && T % 3 === 0) this.bolt(uf.x, uf.y + 2, uf.z, uo.x + (R() - 0.5) * 2, uo.y + 1 + R() * 2, uo.z + (R() - 0.5) * 2, T % 2 ? c : 0xffffff, 0.5, 0.1);
      if (u.type === 'grab' && u.lock && u.v === 0 && (T & 1) === 0) { this.ghost(u.who, c, 0.2); this.ghost(1 - u.who, 0xffffff, 0.2); }
      if (u.type === 'slash' && u.w2 && T % 4 === 0) { const a = R() * 6.283; this.bolt(uo.x, uo.y + 1.6, uo.z, uo.x + Math.cos(a) * 3, uo.y + 0.5 + R() * 2.5, uo.z + Math.sin(a) * 3, c, 0.35, 0.1); }
      if (u.type === 'clone' && u.cl && T % 3 === 0) for (const q of u.cl) if (q.s === 0 && (q !== u.cl[0] || u.k >= 0)) this.ghostAt(u.who, q.x, q.y, q.z, T % 6 ? c : 0xffffff, 0.12);   // las copias que esperan su turno
      if (u.type === 'clone' && u.k >= 0 && u.cl[u.k].s === 1) this.ghost(u.who, c, 0.2);
      if (u.type === 'cage' && u.cr > 0 && T % 2 === 0) { const a = R() * 6.283, e = (R() - 0.5) * 3, r = u.cr; this.bolt(u.cx + Math.cos(a) * r, u.cy + e, u.cz + Math.sin(a) * r, u.cx + Math.cos(a + 1.2) * r, u.cy - e, u.cz + Math.sin(a + 1.2) * r, T % 4 ? c : 0xffffff, 0.3, 0.1); }
      if (u.type === 'drain' && u.link && T % 2 === 0) this.bolt(uf.x, uf.y + 1.9, uf.z, uo.x, uo.y + 1.6, uo.z, T % 4 ? c : 0xffffff, 0.55, 0.09);
      if (u.type === 'wave' && u.rings) for (const g of u.rings) if (!g.done) for (let n = 0; n < 5; n++) { const a = R() * 6.283; fx.add(2, u.wx + Math.cos(a) * g.r, 0.2, u.wz + Math.sin(a) * g.r, 1.3, n % 3 ? c : 0xffffff, { vy: 14 + R() * 10, life: 0.18, stretch: 4, a: 0.45 }); }
      if (u.type === 'spin' && u.len) { const nb = u.v === 2 ? 2 : 1; for (let k = 0; k < nb; k++) { const a = u.ang + k * Math.PI, d = 4 + R() * Math.min(u.len, 30); fx.add(2, u.px + Math.cos(a) * d, u.py, u.pz + Math.sin(a) * d, 1.2, R() < 0.5 ? c : 0xffffff, { vx: (R() - 0.5) * 16, vy: (R() - 0.5) * 16, vz: (R() - 0.5) * 16, life: 0.2, stretch: 3 }); } this.cam.shake(0.25); }
      if (u.type === 'rift' && u.heads) for (const h of u.heads) if (!h.done && (T & 1) === 0) fx.add(0, h.x, 0.5, h.z, 3.4, c, { s1: 1, life: 0.2, a: 0.8 });
    }
    if (u && u.type === 'beam' && u.ph === 1 && u.t < 1.35 && u.len) {
      for (let i = 0; i < 3; i++) { const k = Math.random() * u.len, a = Math.random() * 6.283, c = this.actors[u.who].def.col;
        fx.add(2, u.ox + u.dx * k, u.oy + u.dy * k + Math.sin(a) * 2, u.oz + u.dz * k + Math.cos(a) * 2, 1.2, i ? c : 0xffffff, { vx: u.dx * 30, vy: u.dy * 30 + Math.sin(a) * 6, vz: u.dz * 30 + Math.cos(a) * 6, life: 0.25, stretch: 4 }); }
      this.cam.shake(0.3);
    }
  }

  /** Coloca sprites, luces y efectos de este fotograma y actualiza el HUD */
  draw(dt, rawDt) {
    const sim = this.sim, cam = this.cam, fx = this.fx, k = this.acc / VS_DT, T = this.time;
    this.lines = Math.max(0, this.lines - rawDt * 2.8);
    this.blur = Math.max(0, this.blur - rawDt * 2.6); this.chroma = Math.max(0, this.chroma - rawDt * 0.07); this.flash = Math.max(0, this.flash - rawDt * (this.flash > 0.45 ? 6 : 2.2));   // los fundidos a blanco se abren rápido
    if (this.intro) this.stepIntro(); if (this.fin) this.stepFinal(rawDt); if (this.vic) this.vic.t += rawDt;
    this.arena.update(dt, T, this.dim, this.dimCol); cam.update(rawDt, sim, false);
    const m = cam.cam.matrixWorld.elements, rx = m[0], rz = m[2], rl = Math.hypot(rx, rz) || 1, RX = rx / rl, RZ = rz / rl;       // derecha de la cámara, en horizontal
    const P = this.arena.P, sd = this.arena.sun.position, sl = Math.hypot(sd.x, sd.z) || 1, dim = this.arena.dim;
    const kx = sd.x * m[0] + sd.y * m[1] + sd.z * m[2], ky = sd.x * m[4] + sd.y * m[5] + sd.z * m[6], kl = Math.hypot(kx, ky) || 1;  // sol visto en pantalla
    const lights = this.arena.glow; let li = 0; for (const l of lights) l.intensity = 0;
    const light = (x, y, z, col, I) => { if (li < lights.length) { const l = lights[li++]; l.position.set(x, y, z); l.color.setHex(col); l.intensity = I; } };
    const u = sim.ult;
    // --- Proyectiles ---
    for (const s of sim.shots) {
      const x = s.x + s.vx * VS_DT * k, y = s.y + s.vy * VS_DT * k, z = s.z + s.vz * VS_DT * k;
      if (s.big) { const r = s.r, p = 1 + Math.sin(T * 30) * 0.05; fx.now(0, x, y, z, r * 3.1 * p, s.col, 0.7); fx.now(0, x, y, z, r * 1.7, 0xffffff, 0.8); fx.now(3, x, y, z, r * 2.3, 0xffffff, 0.4, T * 2);
        for (let i = 0; i < 4; i++) { const a = T * 5 + i * 1.57; fx.now(0, x + Math.cos(a) * r * 1.3, y + Math.sin(a * 1.3) * r * 0.7, z + Math.sin(a) * r * 1.3, r * 0.5, 0xffffff, 0.7); } light(x, y, z, s.col, 1.3 + r * 0.25); }
      else if (s.chg) { const r = s.r, p = 1 + Math.sin(T * 40) * 0.08; fx.now(0, x, y, z, r * 2.4 * p, s.col, 0.8); fx.now(0, x, y, z, r * 1.2, 0xffffff, 1); fx.now(3, x, y, z, r * 2, 0xffffff, 0.5, T * 9); fx.now(1, x, y, z, r * 1.7, s.col, 0.8); light(x, y, z, s.col, 1.2); }   // ki cargado
      else if (s.disc) { const r = s.r; fx.now(1, x, y, z, r * 2.5, s.col, 1, 0, VS_FLAT); fx.now(1, x, y, z, r * 1.6, 0xffffff, 0.9, 0, VS_FLAT); fx.now(0, x, y, z, r * 1.7, s.col, 0.55); fx.now(3, x, y, z, r * 1.9, 0xffffff, 0.55, T * 22); light(x, y, z, s.col, 0.9); }   // disco cortante
      else { const v = Math.hypot(s.vx, s.vy, s.vz) || 1, ax = this.ax; ax[0] = s.vx / v; ax[1] = s.vy / v; ax[2] = s.vz / v;                              // chorro de energía: cabeza brillante y cola afilada
        ax[3] = 5; fx.now(2, x - ax[0] * 2.6, y - ax[1] * 2.6, z - ax[2] * 2.6, 1.5, s.col, 0.8, 0, ax); ax[3] = 7; fx.now(6, x - ax[0] * 1.5, y - ax[1] * 1.5, z - ax[2] * 1.5, 0.5, 0xffffff, 0.95, 0, ax);
        fx.now(0, x, y, z, 1.9, s.col, 0.75); fx.now(0, x, y, z, 0.85, 0xffffff, 1); light(x, y, z, s.col, 0.8); }
    }
    // --- Rayo ---
    const bm = this.beam;
    if (u && u.type === 'beam' && u.ph === 1 && u.len) {
      const c = this.actors[u.who].def.col, pw = u.t < 1.35 ? 1 : Math.max(0, 1 - (u.t - 1.35) / 0.3);
      bm.mesh.visible = pw > 0; bm.u.uA.value.set(u.ox, u.oy, u.oz); bm.u.uDir.value.set(u.dx, u.dy, u.dz); bm.u.uLen.value = u.len; bm.u.uW.value = [4.0, 6.4, 8.2][u.v]; bm.u.uCol.value.setHex(c); bm.u.uT.value = T; bm.u.uPow.value = pw;
      const hx = u.ox + u.dx * u.len, hy = u.oy + u.dy * u.len, hz = u.oz + u.dz * u.len;
      fx.now(0, u.ox, u.oy, u.oz, 4.6 * pw, c, 0.6); fx.now(0, u.ox, u.oy, u.oz, 2.3 * pw, 0xffffff, 0.9); fx.now(3, u.ox, u.oy, u.oz, 4.6 * pw, 0xffffff, 0.45, T * 3); fx.now(0, hx, hy, hz, 5 * pw, c, 0.55);
      light(u.ox + u.dx * 6, u.oy, u.oz + u.dz * 6, c, 1.5 * pw); light(u.ox + u.dx * Math.min(u.len, 24), u.oy, u.oz + u.dz * Math.min(u.len, 24), c, 1.2 * pw);
    } else if (u && u.type === 'spin' && u.ph === 1 && u.len) {          // rayo giratorio (dos, opuestos, en la variante 2)
      const c = this.actors[u.who].def.col, b2 = this.beam2, bx = Math.cos(u.ang), bz = Math.sin(u.ang);
      for (const [m, k] of [[bm, 1], [b2, -1]]) {
        m.mesh.visible = k > 0 || u.v === 2; if (!m.mesh.visible) continue;
        m.u.uA.value.set(u.px + bx * k * 1.2, u.py, u.pz + bz * k * 1.2); m.u.uDir.value.set(bx * k, 0, bz * k); m.u.uLen.value = u.len; m.u.uW.value = 3.6; m.u.uCol.value.setHex(c); m.u.uT.value = T; m.u.uPow.value = 1;
        light(u.px + bx * k * 8, u.py, u.pz + bz * k * 8, c, 1.3);
      }
      fx.now(0, u.px, u.py, u.pz, 5, c, 0.6); fx.now(0, u.px, u.py, u.pz, 2.4, 0xffffff, 0.9); fx.now(3, u.px, u.py, u.pz, 5, 0xffffff, 0.5, T * 6);
    } else bm.mesh.visible = false;
    if (!(u && u.type === 'spin' && u.ph === 1 && u.len && u.v === 2)) this.beam2.mesh.visible = false;
    if (sim.clash) this.drawClash(T, light);                            // choque de Ultimates
    if (u && u.ph === 1 && u.type === 'cage' && u.cr > 0) {              // prisión de ki
      const c = this.actors[u.who].def.col, r = u.cr, p = 1 + Math.sin(T * 30) * 0.04, a = u.lock ? 1 : 0.55;
      fx.now(1, u.cx, u.cy, u.cz, r * 2.1 * p, c, a); fx.now(1, u.cx, u.cy, u.cz, r * 1.95, 0xffffff, a * 0.8); fx.now(0, u.cx, u.cy, u.cz, r * 2.5, c, 0.35 * a); fx.now(1, u.cx, Math.max(0.1, u.cy - r * 0.2), u.cz, r * 2.1, c, a * 0.8, 0, VS_FLAT); fx.now(1, u.cx, u.cy + r * 0.5, u.cz, r * 1.7, c, a * 0.6, 0, VS_FLAT);
      fx.now(1, u.cx, 0.1, u.cz, r * 2, c, 0.5 * a, 0, VS_FLAT); light(u.cx, u.cy, u.cz, c, 1.4 * a);
    }
    if (u && u.ph === 1 && u.type === 'wave' && u.rings) {               // onda por el suelo
      const c = this.actors[u.who].def.col;
      for (const g of u.rings) if (!g.done) { fx.now(1, u.wx, 0.12, u.wz, g.r * 2, c, 1, 0, VS_FLAT); fx.now(1, u.wx, 0.14, u.wz, g.r * 2 - 1.2, 0xffffff, 0.8, 0, VS_FLAT); fx.now(1, u.wx, 1.6, u.wz, g.r * 2 - 0.4, c, 0.55, 0, VS_FLAT); fx.now(1, u.wx, 3, u.wz, g.r * 2 - 1, c, 0.3, 0, VS_FLAT); }
    }
    if (u && u.ph === 1 && u.type === 'drain' && u.link) { const f = sim.f[u.who], o = sim.f[1 - u.who], c = this.actors[u.who].def.col; fx.now(0, o.x, o.y + 1.6, o.z, 3.4 + Math.sin(T * 30) * 0.5, c, 0.6); fx.now(0, f.x, f.y + 1.9, f.z, 2.2, 0x7dffb0, 0.7); light(o.x, o.y + 1.6, o.z, c, 1.2); }
    for (const f of sim.f) if (f.st === 'shot' && !f.done && f.chg) {     // esfera de ki creciendo en las manos
      const k = Math.min(1, (f.t - VS.CSHOT.t0) / (VS.CSHOT.max - VS.CSHOT.t0)), c = this.actors[f.i].def.col, o = sim.f[1 - f.i], dx = o.x - f.x, dz = o.z - f.z, h = Math.hypot(dx, dz) || 1, x = f.x + dx / h * 1.3, y = f.y + 1.7, z = f.z + dz / h * 1.3, r = 1 + 1.6 * k;
      fx.now(0, x, y, z, r * 2.2, c, 0.8); fx.now(0, x, y, z, r, 0xffffff, 1); fx.now(3, x, y, z, r * 2, 0xffffff, 0.5, T * 8); light(x, y, z, c, 0.8 + k);
    }
    if (u && u.type === 'nova' && u.ph === 1 && u.r > 0) {               // explosión corporal: cúpula de energía que crece
      const f = sim.f[u.who], c = this.actors[u.who].def.col, a = u.a === undefined ? 1 : u.a, y = f.y + 1.6, p = 1 + Math.sin(T * 40) * 0.03;
      fx.now(0, f.x, y, f.z, u.r * 2.9 * p, c, 0.6 * a); fx.now(0, f.x, y, f.z, u.r * 1.9, 0xffffff, 0.55 * a); fx.now(1, f.x, y, f.z, u.r * 2.15, 0xffffff, 0.9 * a); fx.now(1, f.x, 0.1, f.z, u.r * 2.3, c, 0.9 * a, 0, VS_FLAT);
      fx.now(3, f.x, y, f.z, u.r * 2.2, 0xffffff, 0.35 * a, T * 2); light(f.x, y, f.z, c, 2.2 * a);
    }
    // --- Luchadores ---
    for (let i = 0; i < 2; i++) {
      const f = sim.f[i], foe = sim.f[1 - i], a = this.actors[i], p = this.prev[i], S = a.spr, U = S.u;
      const x = p.x + (f.x - p.x) * k, y = p.y + (f.y - p.y) * k, z = p.z + (f.z - p.z) * k; a.t += dt; a.px = x; a.py = y; a.pz = z;
      // Mira al rival (en pantalla); en el dash mira hacia donde va
      let sxd = (foe.x - f.x) * RX + (foe.z - f.z) * RZ; if (f.st === 'dash') { const d = f.dx * RX + f.dz * RZ; if (Math.abs(d) > 0.35) sxd = d; }
      if (Math.abs(sxd) > 0.05) a.flip = sxd < 0;
      const dir = a.flip ? -1 : 1;
      let roll = 0, sx = 1, sy = 1;
      if (f.st === 'launched') roll = -dir * f.t * 11; else if (f.st === 'dash') { roll = -dir * 0.3; sx = 1.14; sy = 0.9; } else if (f.st === 'ko' && (f.y > 0.05 || f.vy > 0)) roll = -dir * f.t * 7;
      else if (f.st === 'move' && f.y > 0.2) roll = -dir * Math.min(0.26, Math.hypot(f.vx, f.vz) * 0.026) * Math.sign((f.vx * RX + f.vz * RZ) * dir || 1);
      else if (f.st === 'grabd') roll = dir * 0.35;
      else if (f.st === 'held' && u && u.type === 'grab') roll = u.v === 1 ? T * 22 : u.v === 0 && u.t > 0.55 ? Math.PI : dir * 0.3;     // agarrado: gira o cae de cabeza
      else if (f.st === 'hurt') roll = dir * 0.12; else if (f.st === 'charge') { sx = 1 + Math.sin(T * 40) * 0.015; }
      if (f.st === 'down' && f.t < 0.12) { sy = 0.8; sx = 1.15; }
      const tq = f.st === 'trans' && sim.tr && !sim.tr.sw ? Math.min(1, sim.tr.t / VS.TR_SWAP) : 0;       // 0-1: cuánto lleva concentrando la transformación
      if (tq > 0) sx = sy = 1 + tq * 0.035 * Math.sin(T * 70);
      if (a.pop > 0) { a.pop = Math.max(0, a.pop - rawDt * 2.6); sx *= 1 + a.pop * 0.22; sy *= 1 + a.pop * 0.22; }   // al cambiar de forma «revienta» un instante
      a.roll = roll; a.fr = a.frame(f, sim);
      let ox = 0, oy = 0, oz = 0, hide = false, powMin = 0, isp = -1;
      if (this.intro) { const o = this.introPose(i, a, x, z, T); if (o) { ox = o.x; oy = o.y; oz = o.z; hide = o.hide; powMin = o.pow || 0; if (o.fr !== undefined) a.fr = o.fr; if (o.roll) roll = a.roll = o.roll * dir; if (o.sq) { sy *= 1 - o.sq; sx *= 1 + o.sq; } if (o.isp !== undefined) isp = o.isp; } }
      if (f.st === 'trans' && sim.tr && sim.tr.sw && a.intros[a.fi]) isp = FormIntros.frame(sim.tr.t - VS.TR_SWAP);   // transformado: la forma nueva hace su intro
      // Con intro: su hoja en vez de la normal (mismo tamaño de píxel: wh es el alto de la celda en Supervivencia, 52,3 px = 3,6 u)
      const itx = isp >= 0 ? a.intros[a.fi] : null;
      if (itx) { if (S.s !== itx) { S.setSheet(itx); S.u.uTint.value.setHex(0xffffff); } a.fr = isp; roll = a.roll = 0; const r = itx.d.wh / itx.d.h / (3.6 / 52.3); sx *= r; sy *= r; }   // sin el tinte de la forma: la intro ya trae sus colores
      else if (S.s !== a.sheets[a.fi]) { S.setSheet(a.sheets[a.fi]); S.u.uTint.value.setHex(a.def.tint); }
      if (this.fin && this.fin.l === i) { const F = this.fin; ox = F.px - x; oy = F.py - y; oz = F.pz - z; hide = F.gone; roll = a.roll = -dir * F.t * 16; a.fr = Array.isArray(a.def.anim.death) ? a.def.anim.death[0] : a.def.anim.death; }
      if (this.vic && this.vic.w === i) powMin = 0.28;
      a.px = x + ox; a.py = y + oy; a.pz = z + oz;
      S.pose(a.fr, a.flip, roll, sx, sy);
      const jit = f.st === 'held' || (f.st === 'hurt' && f.t < 0.1) ? (Math.random() - 0.5) * 0.22 : tq > 0 ? (Math.random() - 0.5) * 0.3 * tq : 0;
      S.mesh.position.set(x + ox + RX * jit, y + oy, z + oz + RZ * jit); S.mesh.visible = !hide; U.uRight.value.set(RX, 0, RZ); S.du.uRight.value.set(-sd.z / sl, 0, sd.x / sl);
      // Luz: ambiente y sol de la arena + la energía más cercana como luz de borde
      const amb = 0.78 * (1 - 0.5 * dim); U.uAmb.value.setRGB(amb, amb, amb * (1 + 0.06 * P.stars)); U.uKey.value.setHex(P.sun).multiplyScalar(0.5 * (1 - 0.7 * dim)); U.uKeyDir.value.set(kx / kl, ky / kl);
      let rI = 0, rc = a.def.col, rdx = 0, rdy = 1;
      const src = (lx, ly, lz, col, I) => { const d = Math.hypot(lx - x, ly - y - 1.6, lz - z), w = I / (1 + d * d * 0.03); if (w > rI) { rI = w; rc = col; rdx = (lx - x) * m[0] + (ly - y - 1.6) * m[1] + (lz - z) * m[2]; rdy = (lx - x) * m[4] + (ly - y - 1.6) * m[5] + (lz - z) * m[6]; } };
      for (const s of sim.shots) src(s.x, s.y, s.z, s.col, s.big ? 2.2 : 0.9);
      if (bm.mesh.visible && u && u.type === 'beam') { const al = Math.max(0, Math.min(u.len, (x - u.ox) * u.dx + (y + 1.6 - u.oy) * u.dy + (z - u.oz) * u.dz)); src(u.ox + u.dx * al, u.oy + u.dy * al, u.oz + u.dz * al, bm.u.uCol.value.getHex(), 1.8); }
      // Aura: al cargar, con el ki lleno y en la Ultimate
      const want = f.st === 'trans' ? 0.7 : f.st === 'charge' ? 1 : f.fi > 0 && f.st !== 'ko' && f.st !== 'ult' && f.ki < 100 && f.st !== 'dash' ? 0.3 : f.st === 'ult' ? (u && u.lock ? 0.3 : 0.95) : f.st === 'clash' ? 0.6 + 0.4 * ((sim.clash && sim.clash.burn[f.i]) || 0) : f.st === 'ko' ? 0 : f.ki >= 100 ? 0.5 : f.st === 'dash' ? 0.35 : 0;
      a.pow += (Math.max(want, powMin) - a.pow) * Math.min(1, dt * 9); if (hide || itx) a.pow = 0;   // la intro ya trae su aura dibujada
      if (a.pow > 0.02 && a.pow * 0.9 > rI) { rI = a.pow * 0.9; rc = a.def.col; rdx = 0; rdy = -1; }
      if (dim > 0.1 && rI < 0.35) { rI = 0.35 * dim; rc = this.dimCol; }
      const rl2 = Math.hypot(rdx, rdy) || 1; U.uRim.value.setHex(rc).multiplyScalar(Math.min(1.5, rI)); U.uRimDir.value.set(rdx / rl2, rdy / rl2);
      U.uFlash.value = f.flash > 0 ? Math.min(0.8, f.flash * 8) * (f.st === 'held' ? 0.45 : 1) : f.st === 'guard' ? 0.18 : 0; U.uFlashCol.value.setHex(f.st === 'guard' && f.flash <= 0 ? 0x9adcff : 0xffffff);
      if (a.hitW > 0) { a.hitW -= rawDt; U.uFlash.value = 1; U.uFlashCol.value.setHex(0xffffff); }
      if (tq > 0) { U.uFlash.value = tq > 0.72 ? (tq - 0.72) / 0.28 : Math.sin(T * 46) > 0.55 ? 0.3 * tq + 0.1 : 0; U.uFlashCol.value.setHex(tq > 0.72 ? 0xffffff : this.trCol); }
      else if (a.pop > 0) { U.uFlash.value = Math.max(U.uFlash.value, a.pop * a.pop); U.uFlashCol.value.setHex(0xffffff); }
      { const as = f.st === 'trans' ? 1 + 0.25 * (tq || 1) : f.fi > 0 ? 1.1 : 1; a.au.uSize.value.set(7.4 * as, 9.8 * as); }
      if (f.st === 'trans') light(x, y + 2, z, tq > 0 ? this.trCol : a.def.col, 0.7 + 0.9 * (tq || 1));
      U.uAlpha.value = f.inv > 0 && f.st !== 'ult' && f.st !== 'trans' && sim.phase === 'fight' && (sim.tick & 2) ? 0.55 : 1;
      a.aura.visible = a.pow > 0.02; a.au.uPow.value = a.pow; a.au.uT.value = T + i * 3.7; a.aura.position.set(x + ox - m[8] * -0.25, y + oy, z + oz - m[10] * -0.25);
      if (a.pow > 0.3) light(x, y + 1.6, z, a.def.col, 0.7 * a.pow);
      if (f.st === 'guard') fx.now(1, x + RX * dir * 1.0, y + 1.7, z + RZ * dir * 1.0, 4.2, 0x9adcff, 0.5 * (f.gm / 100) + 0.2);
      if (!hide && Math.abs(ox) + Math.abs(oz) < 30) this.fxA.now(5, x + ox, 0.05, z + oz, Math.max(1.4, 3.6 - (y + oy) * 0.1), 0x000000, 0.42 * Math.max(0.15, 1 - Math.max(0, y + oy) / 16), 0, VS_FLAT);   // sombra de contacto: «pega» el sprite al suelo
      // HUD de este lado
      const h = this.ui.sides[i], hp = f.hp / f.hpMax; h.ghost += (hp - h.ghost) * Math.min(1, rawDt * (hp < h.ghost ? 2.2 : 12));
      h.v.style.transform = 'scaleX(' + hp.toFixed(4) + ')'; h.g.style.transform = 'scaleX(' + Math.max(hp, h.ghost).toFixed(4) + ')'; h.hp.classList.toggle('low', hp < 0.3);
      h.kiI.style.transform = 'scaleX(' + (f.ki / 100).toFixed(3) + ')'; h.ki.classList.toggle('full', f.ki >= 100); h.gd.style.transform = 'scaleX(' + (f.gm / 100).toFixed(3) + ')';
      h.trI.style.transform = 'scaleX(' + (f.fi >= f.chain.length - 1 ? 1 : f.tm / 100).toFixed(3) + ')';
      { const can = f.fi >= f.chain.length - 1 ? 2 : f.canTrans ? 1 : 0;
        if (can !== h.can) { h.can = can; h.tr.classList.toggle('full', can === 1); h.tr.classList.toggle('max', can === 2);
          h.trl.innerHTML = can === 2 ? (f.chain.length > 1 ? 'FORMA MÁXIMA' : '') : can === 1 ? (i && this.p2cpu ? '¡LISTA!' : '¡TRANSFÓRMATE!<kbd>' + vsKeyName(VS_KEYS[i].TRANS) + '</kbd>') : '';
          if (can === 1) { SFX.play('ki'); fx.add(1, x, y + 1.6, z, 1, 0xffd75a, { s1: 9, life: 0.4, a: 0.9 }); } } }
      if (h.wins !== f.wins) { h.wins = f.wins; [...h.pips.children].forEach((b, n) => b.classList.toggle('w', n < f.wins)); }
      const c = this.ui.cmb[i]; if (c.t > 0 && (c.t -= rawDt) <= 0) c.classList.remove('on');
    }
    const tt = Math.ceil(sim.time); if (tt !== this.shownT) { this.shownT = tt; this.ui.clock.textContent = this.trn ? '∞' : tt; }
    if (this.touch) this.touch.ready(sim.f[0].ki >= 100 && sim.phase === 'fight', sim.f[0].canTrans && sim.phase === 'fight');
    for (const g of this.ghosts) if (g.life > 0) { g.life -= dt; g.u.uAlpha.value = Math.max(0, g.life / g.max) * 0.42; if (g.life <= 0) g.mesh.visible = false; }
    this.fx.update(dt); this.fxA.update(dt); this.fx.flush(); this.fxA.flush();
  }
}
const VS_FLAT = [0, 0, 0, -1];
const VS_INTRO_SLOT = 2.6, VS_INTRO_T = VS_INTRO_SLOT * 2 + 2.3;   // entradas: segundos por luchador + el rótulo de la ronda
const VS_FIN = { go: 0.3, cut: 0.95, hit: 1.5, end: 4.3 };            // final destructivo: sale despedido · corte de cámara · impacto · vuelta
/** Vibración del mando (si el juego la tiene) */
function g_rumble(ms, s) { try { if (window.game && game.pad && game.pad.rumble) game.pad.rumble(ms, s, s * 0.5); } catch (e) { /* sin mando */ } }
