'use strict';
/* =====================================================================
   versus/tutorial.js · Tutorial guiado del Modo Versus.
   Lecciones cortas, una técnica cada una: el panel explica qué hacer y
   con qué teclas, el rival hace justo lo necesario para practicarla y la
   lección se supera sola al detectar en la simulación lo que se pide
   (eventos de sim.js: parry, dodge, grab, ultParry, clashWin...).
   ===================================================================== */

/** Botones del mando estándar (para mostrarlos junto a la tecla) */
const VS_PAD_NAMES = { ATK: 'X', HEAVY: 'Y', KI: 'B', DASH: 'A', GUARD: 'LB', TP: 'RB', CHARGE: 'LT', ULT: 'RT', UP: '▲', DOWN: '▼', TRANS: 'R3' };

/*
  Cada lección:
    t     título · x: explicación ({ACCIÓN} = tecla del jugador 1)
    n     veces que hay que conseguirlo · dummy: lo que hace el rival (VsTutorDummy)
    ev(e) devuelve true si el evento cuenta · tick(sim) (opcional) devuelve true si el estado cuenta
    setup(sim, tut) (opcional) al empezar · skip(sim) (opcional) la lección no aplica a este luchador
    kiP / kiR: el jugador / el rival tienen siempre la barra de ki llena · noKi: sin la ayuda de ki (nunca baja de 50)
*/
const VS_TUTO = [
  { t: 'Moverse y volar', n: 1, dummy: 'still',
    x: 'Muévete con {l} {r} {f} {k}. En el aire no hay suelo que valga: sube con {UP} y baja con {DOWN}.<br>Objetivo: <b>vuela alto</b> y recorre la arena.',
    setup: (s, T) => { T.dist = 0; T.px = s.f[0].x; T.pz = s.f[0].z; },
    tick: (s, T) => { const f = s.f[0]; T.dist += Math.hypot(f.x - T.px, f.z - T.pz); T.px = f.x; T.pz = f.z; T.hi = T.hi || f.y > 4; T.bar = Math.min(1, T.dist / 25) * 0.5 + (T.hi ? 0.5 : 0); return T.hi && T.dist > 25; } },
  { t: 'Golpes y ráfaga', n: 2, dummy: 'still',
    x: 'Acércate y pulsa {ATK} varias veces: son cuatro golpes. Si sigues pulsando cuando el cuarto conecta, sale sola una <b>ráfaga</b> que lo manda volando.<br>Objetivo: haz la ráfaga.',
    ev: (e) => e.t === 'flurry' && e.i === 0 },
  { t: 'Golpe fuerte y gancho', n: 2, dummy: 'still',
    x: '{HEAVY} es un golpe lento que lanza al rival. Si lo das con {UP} pulsado es un <b>gancho</b> que lo levanta para seguir el combo en el aire.<br>Objetivo: conecta el gancho.',
    ev: (e) => e.t === 'hit' && e.i === 1 && e.up === 1 && e.heavy },
  { t: 'Disparos de ki', n: 2, dummy: 'still',
    x: '{KI} dispara una bola de ki. Si <b>mantienes</b> {KI}, la carga y sale mucho más grande.<br>Objetivo: lanza un disparo cargado.',
    ev: (e) => e.t === 'shot' && e.i === 0 && e.chg > 0 },
  { t: 'Guardia perfecta', n: 2, dummy: 'punch',
    x: 'Mantén {GUARD} para cubrirte. Si la pulsas <b>justo cuando te va a llegar el golpe</b> (en el último instante), el rival queda vendido y puedes contraatacar.<br>El rival te atacará cada poco. Objetivo: haz la guardia perfecta.',
    ev: (e) => e.t === 'parry' && e.i === 0 },
  { t: 'Esquiva perfecta', n: 2, dummy: 'punch',
    x: 'Pulsa {DASH} <b>justo cuando llega el golpe</b>: lo esquivas y tu siguiente golpe pega más fuerte.<br>Objetivo: esquiva en el último momento.',
    ev: (e) => e.t === 'dodge' && e.i === 0 },
  { t: 'Agarre', n: 2, dummy: 'guard',
    x: 'Si el rival se cubre todo el rato, pulsa {GUARD} y {ATK} a la vez: lo <b>agarras</b> y lo lanzas. El agarre rompe la guardia, pero pierde contra cualquier golpe.<br>Objetivo: agarra al rival.',
    ev: (e) => e.t === 'grab' && e.i === 0 },
  { t: 'Cargar ki y Ultimate', n: 1, dummy: 'still',
    x: 'Mantén {CHARGE} para cargar ki. Con la barra llena, {ULT} lanza tu <b>Ultimate</b>. Cada forma tiene la suya.<br>Objetivo: carga la barra y lanza tu Ultimate.',
    noKi: true, setup: (s) => { s.f[0].ki = 20; },
    ev: (e) => e.t === 'ultStart' && e.i === 0 },
  { t: 'Desviar una Ultimate', n: 1, dummy: 'ult',
    x: 'El rival va a lanzar su Ultimate. Si pulsas {GUARD} <b>justo cuando te llega</b> la desvías: el rayo se tuerce hacia el cielo y no te hace nada. Si te cubres antes de tiempo solo reduces el daño.<br>Vale contra rayos, esferas gigantes, discos y ráfagas. Objetivo: desvía una Ultimate.',
    kiR: true, ev: (e) => e.t === 'ultParry' && e.i === 0 },
  { t: 'Choque de Ultimates', n: 1, dummy: 'clash', kiP: true, kiR: true,
    x: 'Si el rival lanza su Ultimate y tú tienes la barra llena, pulsa {ULT} <b>mientras sale el aviso</b>: las dos chocan. Luego machaca {ATK} para empujar y mantén {CHARGE} para gastar ki y empujar el doble.<br>Objetivo: gana un choque de Ultimates.',
    ev: (e) => e.t === 'clashWin' && e.w === 0 },
  { t: 'Transformarse', n: 1, dummy: 'still',
    x: 'Peleando se llena la barra naranja de transformación. Con ella llena, pulsa {TRANS}: cambias de forma, con más fuerza y otra Ultimate.<br>Te la hemos llenado. Objetivo: transfórmate.',
    skip: (s) => s.f[0].chain.length < 2, setup: (s) => { s.f[0].tm = 100; },
    ev: (e) => e.t === 'trStart' && e.i === 0 }
];

/** Rival del tutorial: hace lo justo para practicar cada lección */
class VsTutorDummy {
  constructor() { this.mode = 'still'; this.ai = new VsAI('easy'); this.cd = 1.5; this.resp = false; }
  set(mode) { this.mode = mode; this.cd = 1.4; this.resp = false; }
  read(sim, i) {
    const c = { mx: 0, mz: 0, b: 0 }, m = this.mode, me = sim.f[i], foe = sim.f[1 - i], dt = VS_DT;
    if (sim.phase !== 'fight') return c;
    if (sim.clash) return this.ai.clashRead(sim, i, c);
    if (m === 'guard') { c.b = VB.GUARD; return c; }
    if (m === 'punch') {                                               // se acerca y lanza un golpe suelto cada poco (fácil de leer)
      if (sim.ult || me.st === 'hurt' || me.st === 'launched' || me.st === 'stun') { this.cd = Math.max(this.cd, 1); return c; }
      const dx = foe.x - me.x, dy = foe.y - me.y, dz = foe.z - me.z, d = Math.hypot(dx, dy, dz), toward = sim.screenX(dx, dz) >= 0 ? 1 : -1;
      if (dy > 1.2) c.b |= VB.UP; else if (dy < -1.2) c.b |= VB.DOWN;
      this.cd -= dt;
      if (d > 2.7) { if (this.cd < 0.6) c.mx = toward; return c; }    // se acerca cuando le toca atacar
      if (this.cd <= 0) { this.cd = 2.1; c.b |= VB.ATK; }
      return c;
    }
    if (m === 'ult' || m === 'clash') {                                // lanza su Ultimate cada poco; en «clash» además responde a la tuya
      if (sim.ult) {
        if (m === 'clash' && sim.ult.who !== i && sim.ult.ph === 0 && sim.ult.cw && !this.resp && sim.ult.t >= 0.3) { this.resp = true; c.b |= VB.ULT; }
        this.cd = 2.4; return c;
      }
      this.resp = false;
      if ((this.cd -= dt) <= 0 && me.ki >= 100 && (me.st === 'idle' || me.st === 'move')) { this.cd = 2.4; c.b |= VB.ULT; }
    }
    return c;
  }
}

class VsTutorial {
  constructor(vs) { this.vs = vs; this.k = -1; this.el = vs.ui.tut; this.done = new Set(); this.wait = 0; this.next(0); }
  /** Tecla del jugador 1 (y botón del mando) para una acción */
  key(a) {
    const vs = this.vs;
    if (vs.touch) return '<kbd>' + ({ ATK: 'GOLPE', HEAVY: 'FUERTE', KI: 'KI', DASH: 'DASH', GUARD: 'GUARDIA', TP: 'TELE', CHARGE: 'CARGA', ULT: 'ULT', UP: '▲', DOWN: '▼', TRANS: 'TRANS', SPEC: 'ESP', DR: 'RUSH', CTR: 'CONTRA', l: '◀', r: '▶', f: '▲', k: '▼' }[a] || a) + '</kbd>';
    return '<kbd>' + vsKeyName(VS_KEYS[0][a]) + '</kbd>' + (VS_PAD_NAMES[a] ? '<small>' + VS_PAD_NAMES[a] + '</small>' : '');
  }
  /** Pasa a la lección k (o a la siguiente que aplique a este luchador) */
  next(k) {
    const vs = this.vs, sim = vs.sim;
    while (k < VS_TUTO.length && VS_TUTO[k].skip && VS_TUTO[k].skip(sim)) k++;
    this.k = k; this.cnt = 0; this.wait = 0; this.bar = 0; this.dist = 0; this.hi = false;
    if (k >= VS_TUTO.length) { this.render(); SFX.play('crit'); vs.say('¡TUTORIAL COMPLETADO!', 2); return; }
    const L = VS_TUTO[k];
    if (sim) { sim.f[0].reset(7); sim.f[1].reset(-7); sim.shots.length = 0; sim.blasts.length = 0; sim.ult = null; sim.clash = null; if (L.setup) L.setup(sim, this); }
    if (vs.inputs && vs.inputs[1] instanceof VsTutorDummy) vs.inputs[1].set(L.dummy);
    this.render();
  }
  cmd(a) {
    if (a === 'next') this.next(Math.min(VS_TUTO.length, this.k + 1));
    else if (a === 'prev') this.next(Math.max(0, this.k - 1));
    else if (a === 'redo') this.next(this.k);
    else if (a === 'train') { this.vs.cfg.mode = 'train'; this.vs.tuto = null; this.vs.start(); return; }
    SFX.play('ki');
  }
  /** Un evento de la simulación: ¿cuenta para la lección? */
  onEvent(e) {
    const L = VS_TUTO[this.k]; if (!L || this.wait > 0 || !L.ev || !L.ev(e)) return;
    this.hit();
  }
  hit() {
    const L = VS_TUTO[this.k]; this.cnt++; this.bar = this.cnt / L.n;
    if (this.cnt >= L.n) { this.done.add(this.k); this.wait = 1.6; this.vs.say('¡CONSEGUIDO!', 1.1); SFX.play('crit'); }
    else { this.vs.tag('¡BIEN! ' + this.cnt + ' / ' + L.n); SFX.play('ki'); }
    this.render();
  }
  /** Cada paso de simulación: ayudas (vida y ki), comprobaciones de estado y paso a la siguiente lección */
  step() {
    const vs = this.vs, sim = vs.sim, L = VS_TUTO[this.k], a = sim.f[0], b = sim.f[1];
    a.hp = a.hpMax; if (b.st !== 'hurt' && b.st !== 'launched' && b.st !== 'held' && b.st !== 'down') b.hp = b.hpMax;   // nadie cae
    if (!L) return;
    if (L.kiP && !sim.ult && !sim.clash) a.ki = 100;
    else if (!L.noKi && a.ki < 50 && !sim.ult && !sim.clash) a.ki = 50;   // en el tutorial no te quedas sin ki para practicar
    if (L.kiR && !sim.ult && !sim.clash) b.ki = 100;
    if (L.dummy !== 'ult' && L.dummy !== 'clash' && b.ki > 60) b.ki = 60;   // el rival no lanza Ultimates fuera de esas lecciones
    if (this.wait > 0) { if ((this.wait -= VS_DT) <= 0) this.next(this.k + 1); return; }
    if (L.tick && L.tick(sim, this)) this.hit();
    else if (L.tick && sim.tick % 6 === 0) this.renderBar();
  }
  renderBar() { const b = this.el.querySelector('.tpb i'); if (b) b.style.width = Math.round(Math.min(1, this.bar) * 100) + '%'; }
  render() {
    const N = VS_TUTO.length, k = this.k, L = VS_TUTO[k], dots = VS_TUTO.map((_, i) => '<i class="' + (this.done.has(i) ? 'ok' : '') + (i === k ? ' on' : '') + '"></i>').join('');
    if (!L) {
      this.el.innerHTML = '<div class="tn">' + dots + '</div><h3>¡Tutorial completado!</h3><p>Ya sabes todo lo que hay que saber. Practica lo que quieras en el Entrenamiento (el rival «Solo Ultimates» va genial para la guardia justa y los choques) o lánzate a la Torre.</p>' +
        '<div class="vseg"><button data-v="tuto" data-a="train">Ir al Entrenamiento</button><button data-v="tuto" data-a="prev">◀ Repetir la última</button><button data-v="reselect">Salir</button></div>';
      return;
    }
    const txt = L.x.replace(/\{(\w+)\}/g, (_, a) => this.key(a));
    this.el.innerHTML = '<div class="tn"><span>Lección ' + (k + 1) + ' de ' + N + '</span>' + dots + '</div><h3>' + L.t + '</h3><p>' + txt + '</p>' +
      '<div class="tpb"><i style="width:' + Math.round(Math.min(1, this.bar) * 100) + '%"></i><span>' + (L.n > 1 ? this.cnt + ' / ' + L.n : this.cnt >= L.n ? '¡Hecho!' : '') + '</span></div>' +
      '<div class="vseg">' + (k > 0 ? '<button data-v="tuto" data-a="prev">◀ Anterior</button>' : '') + '<button data-v="tuto" data-a="redo">Repetir</button><button data-v="tuto" data-a="next">Saltar ▶</button><button data-v="reselect">Salir</button></div>';
  }
}

const VS_TUTO_CSS = `
#vs .tut{position:absolute;left:16px;top:118px;width:min(380px,calc(100% - 32px));display:none;pointer-events:auto;background:rgba(17,18,28,.9);border:3px solid var(--ink);box-shadow:0 0 0 2px var(--gold),6px 6px 0 rgba(0,0,0,.4);padding:10px 14px 12px;color:#e8ecf8;font:600 13px/1.5 var(--body);z-index:2}
#vs .tut.on{display:block}#vs.cine .tut,#vs.clash .tut{opacity:.35}
#vs .tut .tn{display:flex;align-items:center;gap:4px;margin-bottom:4px}#vs .tut .tn span{font:800 11px/1 var(--body);color:var(--gold);margin-right:6px;white-space:nowrap}
#vs .tut .tn i{flex:1;height:5px;border-radius:3px;background:rgba(255,255,255,.18)}#vs .tut .tn i.ok{background:#6dff9c}#vs .tut .tn i.on{background:var(--gold);box-shadow:0 0 6px var(--gold)}
#vs .tut h3{margin:2px 0 4px;font:400 24px/1.1 var(--mg);letter-spacing:.04em;color:#fff6c8;-webkit-text-stroke:4px var(--ink);paint-order:stroke fill}
#vs .tut p{margin:0 0 8px}#vs .tut p b{color:#fff}
#vs .tut kbd{display:inline-block;min-width:16px;padding:1px 5px;border-radius:4px;background:#fff;color:var(--ink);font:800 12px/1.3 var(--body);text-align:center;box-shadow:0 2px 0 rgba(0,0,0,.5)}
#vs .tut kbd + small{font:800 10px/1 var(--body);color:#9fb0d8;margin:0 2px 0 3px}#vs .tut kbd + small::before{content:"/ "}
#vs .tut .tpb{position:relative;width:auto;max-width:100%;box-sizing:border-box;height:14px;background:#0d1830;border:2px solid var(--ink);box-shadow:0 0 0 1.5px rgba(255,255,255,.6);margin-bottom:8px;overflow:hidden}
#vs .tut .tpb i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#6dff9c,#c8ff6d);transition:width .2s}#vs .tut .tpb span{position:relative;display:block;text-align:center;font:800 10px/10px var(--body);color:#fff;text-shadow:0 1px 0 #000}
#vs .tut .vseg{display:flex;flex-wrap:wrap;gap:6px;width:auto}#vs .tut button{flex:1 1 auto;min-width:0;white-space:nowrap;font:800 12px/1 var(--body);padding:7px 10px}
@media (max-width:700px){#vs .tut{top:auto;bottom:10px;font-size:12px}#vs .tut h3{font-size:19px}}
`;
