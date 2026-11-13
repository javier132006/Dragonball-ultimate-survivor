'use strict';
/* =====================================================================
   versus/modes.js · Lo que rodea al combate del Modo Versus:
   - VsStats: estadísticas guardadas (globales y por guerrero)
   - Torre: ocho rivales seguidos con dificultad creciente y premio
   - VsDummy: el rival del entrenamiento
   - VsTouchPad: controles táctiles (joystick flotante + botones)
   Nada de esto toca la simulación: son entradas, menús y guardado.
   ===================================================================== */

/* ---------------- Estadísticas ---------------- */
const VS_STAT_KEYS = ['fights', 'wins', 'local', 'tr', 'ult', 'sup', 'parry', 'perfect', 'time', 'maxCombo', 'maxDmg', 'towerRuns', 'towerBest'];
const VsStats = {
  /** Bloque de estadísticas del Versus dentro de la partida guardada (se crea si no existe) */
  d() {
    const s = Save.d.vs || (Save.d.vs = {}); for (const k of VS_STAT_KEYS) s[k] = s[k] || 0;
    s.ch = s.ch || {}; s.tower = s.tower || {}; return s;
  },
  ch(id) { const C = this.d().ch; return C[id] || (C[id] = { fights: 0, wins: 0, tr: 0, ult: 0 }); },
  /** Apunta un combate terminado. r = lo que hizo el jugador 1: { tr, ult, sup, parry, maxCombo, maxDmg } */
  fight(id, win, perfect, secs, r, local) {
    const s = this.d(), c = this.ch(id);
    if (local) { s.local++; Save.write(); return; }                    // entre dos jugadores no hay «victoria» que apuntar
    s.fights++; c.fights++; if (win) { s.wins++; c.wins++; if (perfect) s.perfect++; }
    s.tr += r.tr; s.ult += r.ult; s.sup += r.sup; s.parry += r.parry; c.tr += r.tr; c.ult += r.ult; s.time += secs;
    s.maxCombo = Math.max(s.maxCombo, r.maxCombo); s.maxDmg = Math.max(s.maxDmg, Math.round(r.maxDmg)); Save.write();
  },
  /** Resumen para el menú del Versus */
  html(id) {
    const s = this.d(), c = s.ch[id], n = (v) => Math.floor(v || 0).toLocaleString('es-ES'), pct = (w, f) => (f ? Math.round(w / f * 100) + ' %' : '—');
    const T = Object.keys(VS_TOWER.levels).map((k) => (s.tower[k] ? '★' : '☆')).join('');
    return '<h4>TU HISTORIAL</h4><div class="vst">' + [['Combates', n(s.fights)], ['Victorias', n(s.wins) + ' · ' + pct(s.wins, s.fights)], ['Sin perder ronda', n(s.perfect)], ['Transformaciones', n(s.tr)], ['Ultimates', n(s.ult) + ' (' + n(s.sup) + ' sup.)'],
      ['Contraataques', n(s.parry)], ['Mejor combo', n(s.maxCombo) + ' golpes'], ['Combo más dañino', n(s.maxDmg)], ['Torre', T + ' · récord ' + n(s.towerBest) + '/' + VS_TOWER.n]]
      .map((r) => '<div><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('') + '</div>' +
      (c && c.fights ? '<h4>CON ' + nice(charById(id).name).toUpperCase() + '</h4><div class="vst"><div><span>Combates</span><b>' + n(c.fights) + '</b></div><div><span>Victorias</span><b>' + n(c.wins) + ' · ' + pct(c.wins, c.fights) + '</b></div></div>' : '');
  }
};

/* ---------------- Torre ---------------- */
const VS_TOWER = {
  n: 8,
  // base: dificultad del primer rival (0 fácil · 1 normal · 2 difícil); sube un punto hasta el último · premio en cristales al superarla
  levels: { easy: { base: 0, cry: 150 }, normal: { base: 0.5, cry: 250 }, hard: { base: 1, cry: 400 } },
  /** Rivales de una torre: al azar, sin repetir mientras haya plantel. El último es el jefe y empieza ya transformado */
  build(roster, me, level) {
    const pool = roster.filter((c) => c.id !== me), foes = []; let bag = [];
    for (let i = 0; i < this.n; i++) {
      if (!bag.length) bag = (pool.length ? pool : roster).slice().sort(() => Math.random() - 0.5);
      const ch = bag.pop(); let f = 0;
      if (i === this.n - 1) for (let k = 1; k < ch.forms.length; k++) if (SPRITE_DATA[ch.forms[k].sheet]) { f = k; break; }
      foes.push({ id: ch.id, f });
    }
    return { i: 0, foes, level, cont: 1, zeni: 0, cry: 0 };
  },
  /** Dificultad del combate i (0-2) y su IA */
  ai(tw) { return new VsAI(vsAiMix(Math.min(2, VS_TOWER.levels[tw.level].base + tw.i / (VS_TOWER.n - 1)))); }
};

/* ---------------- Entrenamiento ---------------- */
const VS_DUMMY = { still: 'Quieto', guard: 'En guardia', move: 'Se mueve', cpu: 'Pelea (CPU)' };
/** Rival del entrenamiento: quieto, cubriéndose, moviéndose o peleando como la CPU normal */
class VsDummy {
  constructor(mode) { this.mode = mode; this.ai = new VsAI('normal'); }
  read(sim, i) {
    const m = this.mode;
    if (m === 'cpu') return this.ai.read(sim, i);
    if (m === 'guard') return { mx: 0, mz: 0, b: VB.GUARD };
    if (m === 'move') { const t = sim.tick / 60; return { mx: Math.sin(t * 1.3) > 0 ? 1 : -1, mz: Math.sin(t * 0.7) > 0 ? 1 : -1, b: Math.sin(t * 0.9) > 0.3 ? VB.UP : Math.sin(t * 0.9) < -0.5 ? VB.DOWN : 0 }; }
    return { mx: 0, mz: 0, b: 0 };
  }
}

/* ---------------- Controles táctiles ----------------
   Mitad izquierda: joystick flotante (aparece donde pones el dedo).
   Derecha: nueve botones en rejilla y, a su lado, subir y bajar.
   Cada dedo se sigue por separado (Pointer Events), así que se puede
   mover, cubrirse y pegar a la vez. Produce la misma orden que el teclado. */
const VS_TOUCH_BTNS = [['CHARGE', 'CARGA', 0, 2], ['TRANS', 'TRANS', 1, 2], ['ULT', 'ULT', 2, 2], ['TP', 'TELE', 0, 1], ['KI', 'KI', 1, 1], ['DASH', 'DASH', 2, 1], ['GUARD', 'GUARDIA', 0, 0], ['HEAVY', 'FUERTE', 1, 0], ['ATK', 'GOLPE', 2, 0], ['UP', '▲', -1, 1], ['DOWN', '▼', -1, 0]];
const VS_TOUCH_CSS = `
#vs .tc{position:absolute;inset:0;display:none;touch-action:none}#vs.touch .tc{display:block}#vs.touch .hint{display:none!important}#vs.cine .tc{opacity:.25}
#vs .tcz{position:absolute;left:0;bottom:0;width:46%;height:74%;pointer-events:auto;touch-action:none}
#vs .tcj{position:absolute;width:26vh;height:26vh;margin:-13vh 0 0 -13vh;border-radius:50%;border:3px solid rgba(255,255,255,.55);background:rgba(20,24,44,.35);display:none;pointer-events:none}
#vs .tcj i{position:absolute;left:50%;top:50%;width:11vh;height:11vh;margin:-5.5vh 0 0 -5.5vh;border-radius:50%;background:rgba(255,255,255,.75);box-shadow:0 3px 0 rgba(0,0,0,.35)}
#vs .tcb{position:absolute;width:15vh;height:15vh;border-radius:50%;border:3px solid rgba(255,255,255,.7);background:rgba(20,24,44,.5);color:#fff;font:800 2.6vh var(--disp);letter-spacing:.03em;display:flex;align-items:center;justify-content:center;pointer-events:auto;touch-action:none;padding:0}
#vs .tcb.on{background:rgba(255,255,255,.85);color:#141826;transform:scale(.93)}#vs .tcb.ATK{background:rgba(255,197,49,.5)}#vs .tcb.ATK.on{background:#ffc531}
#vs .tcb.rdy{border-color:#ffc531;box-shadow:0 0 0 3px rgba(255,197,49,.5),0 0 18px #ffc531;color:#ffe27a;animation:vsp .4s steps(2) infinite}#vs .tcb.UP,#vs .tcb.DOWN{font-size:4.5vh}
#vs .tcp{position:absolute;left:50%;top:92px;width:46px;height:40px;margin-left:-23px;border-radius:10px;border:2px solid rgba(255,255,255,.6);background:rgba(20,24,44,.6);color:#fff;font-size:18px;pointer-events:auto;padding:0}
`;
class VsTouchPad {
  constructor(root, onPause) {
    this.s = { mx: 0, mz: 0, b: 0 }; this.tap = 0; this.jid = null; this.btn = {};
    const st = document.createElement('style'); st.textContent = VS_TOUCH_CSS; document.head.appendChild(st);
    const el = this.el = document.createElement('div'); el.className = 'tc';
    el.innerHTML = '<div class="tcz"></div><div class="tcj"><i></i></div><button class="tcp" aria-label="Pausa">⏸</button>' +
      VS_TOUCH_BTNS.map(([k, t, cx, cy]) => '<button class="tcb ' + k + '" data-b="' + k + '" style="right:' + (cx < 0 ? 57 : 4 + (2 - cx) * 17) + 'vh;bottom:' + (4 + cy * 17) + 'vh">' + t + '</button>').join('');
    root.insertBefore(el, root.querySelector('.pnl'));                  // por debajo de los paneles de pausa y final: no les roba los toques
    const zone = el.querySelector('.tcz'), base = this.base = el.querySelector('.tcj'), knob = base.firstChild;
    const end = (e) => { if (e.pointerId !== this.jid) return; this.jid = null; this.s.mx = this.s.mz = 0; base.style.display = 'none'; };
    zone.addEventListener('pointerdown', (e) => {
      if (this.jid !== null) return; e.preventDefault(); this.jid = e.pointerId; this.ox = e.clientX; this.oy = e.clientY; try { zone.setPointerCapture(e.pointerId); } catch (x) { /* puntero ya suelto */ }
      base.style.left = e.clientX + 'px'; base.style.top = e.clientY + 'px'; base.style.display = 'block'; knob.style.transform = '';
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.jid) return; const R = window.innerHeight * 0.11; let dx = (e.clientX - this.ox) / R, dy = (e.clientY - this.oy) / R; const d = Math.hypot(dx, dy);
      if (d > 1) { dx /= d; dy /= d; } knob.style.transform = 'translate(' + dx * R + 'px,' + dy * R + 'px)';
      const dz = (v) => (Math.abs(v) < 0.25 ? 0 : v); this.s.mx = VS_Q(dz(dx) * 1.3); this.s.mz = VS_Q(-dz(dy) * 1.3);     // arriba en pantalla = hacia el fondo
    });
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
    for (const b of el.querySelectorAll('.tcb')) {
      const bit = VB[b.dataset.b]; this.btn[b.dataset.b] = b;
      const up = () => { this.s.b &= ~bit; b.classList.remove('on'); };
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.s.b |= bit; this.tap |= bit; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (x) { /* puntero ya suelto */ } });
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    }
    el.querySelector('.tcp').addEventListener('click', (e) => { e.stopPropagation(); onPause(); });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  /** Suelta todo (al pausar o salir del combate) */
  clear() { this.s.mx = this.s.mz = 0; this.s.b = 0; this.tap = 0; this.jid = null; this.base.style.display = 'none'; for (const k in this.btn) this.btn[k].classList.remove('on'); }
  /** Resalta Ultimate y transformación cuando están listas */
  ready(ult, tr) { if (ult !== this.rU) { this.rU = ult; this.btn.ULT.classList.toggle('rdy', ult); } if (tr !== this.rT) { this.rT = tr; this.btn.TRANS.classList.toggle('rdy', tr); } }
  read() { const s = this.s, b = s.b | this.tap; this.tap = 0; return { mx: s.mx, mz: s.mz, b }; }       // un toque rápido cuenta aunque se suelte antes del siguiente fotograma
}
