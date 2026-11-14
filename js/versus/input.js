'use strict';
/* =====================================================================
   versus/input.js · Entrada UNIFICADA del Modo Versus.
   Todo lo que maneja a un luchador (teclado, mando, IA o, más adelante,
   la red) produce lo mismo cada paso de simulación: una ORDEN
       { mx, mz, b }
   mx: -1..1 izquierda/derecha EN PANTALLA · mz: -1..1 hacia el fondo
   b:  botones mantenidos, como máscara de bits (VB)
   La simulación (sim.js) solo ve órdenes: no sabe quién las genera. Por
   eso el mismo luchador sirve para jugador, bot y online sin tocar nada.
   ===================================================================== */
const VB = { ATK: 1, HEAVY: 2, KI: 4, GUARD: 8, DASH: 16, TP: 32, CHARGE: 64, ULT: 128, UP: 256, DOWN: 512, TRANS: 1024 };
const VS_Q = (v) => Math.round(Math.max(-1, Math.min(1, v)) * 4) / 4;      // ejes en pasos de 1/4: una orden cabe en 2 bytes

/* Teclas por defecto. Jugador 1: mano izquierda mueve, mano derecha pega. Jugador 2: flechas + teclado numérico */
const VS_KEYS = [
  { l: 'KeyA', r: 'KeyD', f: 'KeyW', k: 'KeyS', UP: 'Space', DOWN: 'ShiftLeft', ATK: 'KeyJ', HEAVY: 'KeyK', KI: 'KeyL', GUARD: 'KeyU', DASH: 'KeyI', TP: 'KeyO', CHARGE: 'KeyH', ULT: 'KeyY', TRANS: 'KeyT' },
  { l: 'ArrowLeft', r: 'ArrowRight', f: 'ArrowUp', k: 'ArrowDown', UP: 'ShiftRight', DOWN: 'ControlRight', ATK: 'Numpad1', HEAVY: 'Numpad2', KI: 'Numpad3', GUARD: 'Numpad4', DASH: 'Numpad5', TP: 'Numpad6',
    CHARGE: 'Numpad0', ULT: 'NumpadEnter', TRANS: 'NumpadAdd' }
];
/* Mando estándar: X golpe · Y fuerte · B ki · A dash · LB guardia · RB teletransporte · LT cargar · RT Ultimate · cruceta ↑↓ subir/bajar · pulsar un stick transformarse */
const VS_PAD = { ATK: 2, HEAVY: 3, KI: 1, DASH: 0, GUARD: 4, TP: 5, CHARGE: 6, ULT: 7, UP: 12, DOWN: 13, TRANS: 11 };
const VS_BTNS = ['ATK', 'HEAVY', 'KI', 'GUARD', 'DASH', 'TP', 'CHARGE', 'ULT', 'UP', 'DOWN', 'TRANS'];

/** Teclado (lee el estado global `keys` de core.js) */
/* Toques de tecla: se apunta cuándo se pulsó cada una. Así una pulsación rápida (bajar y soltar entre dos fotogramas,
   algo normal si el juego va a pocos FPS) cuenta igual, sin tener que dejar la tecla apretada */
const VS_TAPS = {};
window.addEventListener('keydown', (e) => { if (!e.repeat) VS_TAPS[e.code] = performance.now(); });
class VsKeyboard {
  constructor(map) { this.map = map; }
  read() {
    const m = this.map, now = performance.now(); let b = 0;
    for (const k of VS_BTNS) { const c = m[k]; if (keys[c] || now - VS_TAPS[c] < 200) b |= VB[k]; if (VS_TAPS[c]) VS_TAPS[c] = 0; }
    return { mx: (keys[m.r] ? 1 : 0) - (keys[m.l] ? 1 : 0), mz: (keys[m.f] ? 1 : 0) - (keys[m.k] ? 1 : 0), b };
  }
}
/** Mando número `idx` (0 = el primero conectado). Sin mando devuelve una orden vacía */
class VsGamepad {
  constructor(idx) { this.idx = idx; }
  pad() {
    const l = navigator.getGamepads ? navigator.getGamepads() : []; let n = 0;
    for (const p of l) if (p && p.connected) { if (n === this.idx) return p; n++; }
    return null;
  }
  read() {
    const p = this.pad(); if (!p) return { mx: 0, mz: 0, b: 0 };
    let b = 0; const dz = (v) => (Math.abs(v) < 0.22 ? 0 : v);
    for (const k of VS_BTNS) { const q = p.buttons[VS_PAD[k]]; if (q && (q.pressed || q.value > 0.4)) b |= VB[k]; }
    if (p.buttons[10] && p.buttons[10].pressed) b |= VB.TRANS;       // vale cualquiera de los dos sticks
    const ry = dz(p.axes[3] || 0);                                   // el stick derecho también sube y baja
    if (ry < -0.5) b |= VB.UP; else if (ry > 0.5) b |= VB.DOWN;
    return { mx: VS_Q(dz(p.axes[0] || 0)), mz: VS_Q(-dz(p.axes[1] || 0)), b };
  }
}
/** Varias fuentes a la vez (p. ej. teclado + mando para el mismo jugador) */
class VsMulti {
  constructor(list) { this.list = list; }
  read(sim, i) {
    let mx = 0, mz = 0, b = 0;
    for (const s of this.list) { const c = s.read(sim, i); b |= c.b; if (Math.abs(c.mx) > Math.abs(mx)) mx = c.mx; if (Math.abs(c.mz) > Math.abs(mz)) mz = c.mz; }
    return { mx, mz, b };
  }
}
/** Órdenes que llegan de fuera (red, repetición): se encolan por número de paso. Lo usará el online (etapa 3) */
class VsRemote {
  constructor() { this.q = new Map(); this.last = { mx: 0, mz: 0, b: 0 }; }
  push(tick, cmd) { this.q.set(tick, cmd); }
  read(sim) { const c = this.q.get(sim.tick); if (c) { this.last = c; this.q.delete(sim.tick); } return this.last; }
}

/* ---------------------------------------------------------------------
   IA: mira la simulación igual que un jugador mira la pantalla y pulsa
   los mismos botones. No hace trampas: tiene tiempo de reacción y falla.
   --------------------------------------------------------------------- */
const VS_AI = {
  easy:   { react: 0.42, guard: 0.25, aggro: 0.45, combo: 0.5, escape: 0.1, ult: 0.35, dodge: 0.15 },
  normal: { react: 0.24, guard: 0.5, aggro: 0.65, combo: 0.75, escape: 0.3, ult: 0.7, dodge: 0.4 },
  hard:   { react: 0.12, guard: 0.78, aggro: 0.85, combo: 0.95, escape: 0.6, ult: 1, dodge: 0.7 }
};
/** Dificultad intermedia: t = 0 fácil · 1 normal · 2 difícil (la Torre sube poco a poco) */
function vsAiMix(t) {
  const a = t < 1 ? VS_AI.easy : VS_AI.normal, b = t < 1 ? VS_AI.normal : VS_AI.hard, k = Math.max(0, Math.min(1, t < 1 ? t : t - 1)), o = {};
  for (const p in a) o[p] = a[p] + (b[p] - a[p]) * k; return o;
}
class VsAI {
  /** level: 'easy' | 'normal' | 'hard' o una tabla de parámetros (vsAiMix) */
  constructor(level) { this.L = typeof level === 'object' ? level : VS_AI[level] || VS_AI.normal; this.plan = 'wait'; this.pt = 0; this.cool = 0; this.tap = 0; this.gHold = 0; this.side = 1; this.seen = ''; this.seenT = 0; this.gWait = 0; }
  read(sim, i) {
    const L = this.L, me = sim.f[i], foe = sim.f[1 - i], dt = VS_DT, rnd = () => sim.rand();
    const c = { mx: 0, mz: 0, b: 0 };
    if (sim.phase !== 'fight') return c;
    const dx = foe.x - me.x, dy = foe.y - me.y, dz = foe.z - me.z, dh = Math.hypot(dx, dz), d = Math.hypot(dh, dy);
    const toward = sim.screenX(dx, dz) >= 0 ? 1 : -1;                // hacia qué lado de la pantalla está el rival
    // Lo que «ve» del rival llega con retraso (tiempo de reacción)
    if (foe.st !== this.seen) { this.seenT += dt; if (this.seenT >= L.react) { this.seen = foe.st; this.seenT = 0; this.fresh = true; } } else this.seenT = 0;
    const foeAtk = this.seen === 'atk' || this.seen === 'heavy';
    this.pt -= dt; this.cool -= dt; this.tap -= dt; this.gHold -= dt;
    if (this.upT > 0) { this.upT -= dt; c.b |= VB.UP; }                 // gancho: ARRIBA pulsado mientras sale
    // --- Defensa ---
    if (this.fresh && foeAtk && d < 4.5) { this.fresh = false; if (rnd() < L.guard) { this.gHold = 0.35 + rnd() * 0.25; this.gWait = rnd() < 0.3 ? 0 : 0.05 + rnd() * 0.12; } else if (rnd() < L.dodge && me.ki >= 5) { c.b |= VB.DASH; c.mz = rnd() < 0.5 ? 1 : -1; return c; } }
    if (me.st === 'grabd') { if (me.t < 0.03 && rnd() < 0.25 + L.escape * 0.7) this.techAt = 0.05 + rnd() * 0.22 * (1.3 - L.escape); if (this.techAt !== undefined && me.t >= this.techAt) { c.b |= VB.ATK; this.techAt = undefined; } return c; }   // agarrado: a veces se suelta a tiempo
    this.techAt = undefined;
    if (me.ctr > 0 && d < 14 && rnd() < L.combo) { c.b |= rnd() < 0.6 ? VB.ATK : VB.HEAVY; return c; }           // esquiva perfecta: contraataca
    if ((me.st === 'hurt' || me.st === 'launched') && me.ki >= 30 && me.t > 0.1 && rnd() < L.escape * dt * 6) c.b |= VB.TP;
    let shotNear = false;
    for (const s of sim.shots) if (s.o !== i && Math.hypot(s.x - me.x, s.y - me.y - 1.5, s.z - me.z) < (s.big ? 16 : 7)) shotNear = s;
    if (shotNear && this.gHold <= 0 && rnd() < L.guard * dt * 14) { if (shotNear.big && me.ki >= 5) { c.b |= VB.DASH; c.mz = this.side; } else this.gHold = 0.3; }
    if (sim.ult && sim.ult.who !== i && sim.ult.ph > 0) {              // Ultimate rival en marcha: esquivar de lado o cubrirse
      const ty = sim.ult.type;
      if (ty === 'wave' && rnd() < 0.35 + L.dodge * 0.65) { c.b |= VB.UP; return c; }                            // la onda va por el suelo: arriba
      if (ty === 'spin' && rnd() < 0.2 + L.dodge * 0.7) { c.b |= me.y > 4 ? VB.UP : dy < 0 ? VB.UP : me.y > 3.2 ? VB.DOWN : VB.UP; return c; }   // el rayo giratorio pasa a una altura: salir de ella
      if (rnd() < L.dodge) { c.mz = this.side; if (me.ki >= 5 && rnd() < 0.2) c.b |= VB.DASH; } else c.b |= VB.GUARD;
      return c;
    }
    if (this.gHold > 0) { if ((this.gWait -= dt) <= 0) c.b |= VB.GUARD; return c; }
    // --- Transformación: en cuanto tiene la barra llena y un respiro ---
    if (me.tm >= 100 && me.fi < me.chain.length - 1 && !sim.ult && d > 3.5 && rnd() < (0.4 + L.ult) * dt * 2) { c.b |= VB.TRANS; return c; }
    // --- Ataque ---
    const ut = me.def.ult.type, uR = ut === 'nova' ? 9 : ut === 'drain' ? 14 : ut === 'rift' || ut === 'storm' || ut === 'discs' || ut === 'clone' || ut === 'spin' ? 30 : ut === 'wave' ? 45 : 22;     // cada Ultimate tiene su distancia
    if (me.ki >= 100 && d < uR && foe.st !== 'down' && this.cool <= 0 && rnd() < L.ult * dt * 3) { c.b |= VB.ULT; return c; }
    if (this.pt <= 0) {                                               // elegir qué hacer el próximo rato
      const r = rnd(); this.side = rnd() < 0.5 ? 1 : -1;
      if (d > 13) this.plan = me.ki < 55 && r < 0.4 ? 'charge' : r < 0.4 + 0.3 * (1 - L.aggro) && me.ki > 20 ? 'shoot' : 'close';
      else this.plan = r < L.aggro ? 'close' : r < L.aggro + 0.12 ? 'circle' : me.ki > 20 ? 'shoot' : 'close';
      if (me.ki >= 55 && me.ki < 100 && d > 8 && rnd() < 0.35 * L.ult) this.plan = 'charge';   // le falta poco para la Ultimate: la carga
      this.pt = 0.5 + rnd() * 0.9;
    }
    if (foe.st === 'launched' && me.ki >= 5 && rnd() < L.combo * dt * 8) { c.b |= VB.DASH; c.mx = toward; return c; }   // persecución
    if (d < 3.1 && Math.abs(dy) < 2.2 && this.plan !== 'charge') {    // a distancia de golpe: combo
      if (me.st === 'flurry') { this.cool = 0.45 + (1 - L.aggro) * 0.8; return c; }                    // la ráfaga sale sola
      if (me.st === 'grab') return c;
      if (this.seen === 'guard' && foe.st === 'guard' && this.cool <= 0 && (me.st === 'idle' || me.st === 'move') && rnd() < L.combo * dt * 5) { c.b |= VB.GUARD | VB.ATK; this.cool = 0.6; return c; }   // se cubre: agarre
      if (foe.st === 'launched' && foe.jug >= 2 && foe.y > 1.5 && this.tap <= 0 && rnd() < L.combo * 0.5) { this.tap = 0.2; c.b |= VB.HEAVY; return c; }   // combo aéreo: lo remata contra el suelo
      if (this.tap <= 0 && this.cool <= 0) {
        this.tap = 0.11;
        if (me.st === 'atk' && me.c >= VS.LIGHT.length - 1) {            // cuarto golpe dado: ráfaga, golpe fuerte o lo deja ahí
          if (me.done) { if (rnd() < L.combo) { const r = rnd(); c.b |= r < 0.55 ? VB.ATK : r < 0.8 ? VB.HEAVY : VB.HEAVY | VB.UP; if (r >= 0.8) this.upT = 0.5; } this.cool = 0.5 + (1 - L.aggro) * 0.8; if (this.upT > 0) this.cool = 0.25; }
        } else if (rnd() < 0.8 + L.combo * 0.2) c.b |= VB.ATK; else this.cool = 0.4;
      }
      return c;
    }
    if (this.plan === 'charge') { if (d < 8 || me.ki >= 100) this.pt = 0; else c.b |= VB.CHARGE; return c; }
    if (this.plan === 'shoot') {                                      // de lejos, a veces carga el disparo
      if (me.st === 'shot' && this.kHold > 0) { this.kHold -= dt; c.b |= VB.KI; return c; }
      if (me.ki < 8) this.pt = 0; else if (this.tap <= 0) { this.tap = 0.3; c.b |= VB.KI; this.kHold = d > 11 && me.ki > 40 && rnd() < 0.3 ? 0.45 + rnd() * 0.5 : 0; if (this.kHold) this.tap = this.kHold + 0.4; }
      c.mz = this.side * 0.5; return c;
    }
    if (this.plan === 'circle') { c.mz = this.side; c.mx = d > 6 ? toward : 0; }
    else { c.mx = toward; if (d > 9 && me.ki >= 25 && rnd() < L.aggro * dt * 2.5) c.b |= VB.DASH; }
    if (dy > 1.2) c.b |= VB.UP; else if (dy < -1.2) c.b |= VB.DOWN;
    return c;
  }
}
