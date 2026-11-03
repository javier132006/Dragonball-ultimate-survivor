'use strict';
/* =====================================================================
   touch.js · Controles táctiles para móvil (en horizontal):
   - Mitad izquierda: joystick flotante (aparece donde pones el dedo).
   - Mitad derecha: arrastrar para girar la cámara.
   - Botones: DASH, KI (mantener), E (interactuar), transformación,
     pausa y mapa. El joystick escribe en el objeto global `stick`.
   ===================================================================== */

const IS_TOUCH = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
const stick = { x: 0, z: 0, on: false };
if (IS_TOUCH) document.documentElement.classList.add('touch');

/** Pantalla completa + bloqueo en horizontal (Android; en iOS se ignora sin error) */
function goFullscreen() {
  try {
    const d = document.documentElement, r = d.requestFullscreen ? d.requestFullscreen() : d.webkitRequestFullscreen ? d.webkitRequestFullscreen() : null;
    const lock = () => { try { const o = screen.orientation; if (o && o.lock) o.lock('landscape').catch(() => {}); } catch (e) { /* no soportado */ } };
    if (r && r.then) r.then(lock).catch(() => {}); else lock();
  } catch (e) { /* sin pantalla completa */ }
}

class TouchControls {
  constructor(game) {
    this.g = game;
    this.root = document.getElementById('touch');
    this.base = document.getElementById('tjBase'); this.knob = document.getElementById('tjKnob');
    this.stickId = null; this.camId = null; this.sx = 0; this.sy = 0; this.cx = 0; this.cy = 0;
    this.R = 56;                                          // radio del joystick (px)
    if (!IS_TOUCH || !this.root) return;
    const opt = { passive: false };
    document.getElementById('tzL').addEventListener('touchstart', (e) => this.stickStart(e), opt);
    document.getElementById('tzR').addEventListener('touchstart', (e) => this.camStart(e), opt);
    window.addEventListener('touchmove', (e) => this.move(e), opt);
    window.addEventListener('touchend', (e) => this.end(e), opt);
    window.addEventListener('touchcancel', (e) => this.end(e), opt);
    // Botones: mientras se mantienen pulsados escriben en `keys` (como el teclado)
    this.hold('tbDash', 'Space'); this.hold('tbKi', 'KeyC');
    this.hold('tbBlk', 'ShiftLeft'); this.hold('tbTp', 'KeyF');                     // bloqueo con Ki y Transmisión Instantánea
    this.tap('tbBase', () => { if (game.state === 'play') game.revertForm(); });
    this.tap('tbE', () => { if (game.state === 'play') game.interact(); else if (game.state === 'trade') game.closeTrade(); });
    this.tap('tbTf', () => { if (game.state === 'play') game.transform(); });
    this.tap('tbPause', () => { if (game.state === 'play' || game.state === 'pause') game.togglePause(); });
    this.tap('tbLv', () => { if (game.state === 'play' && game.practice) game.practiceLevel(); });
    this.tap('tbMap', () => { if (game.state === 'play') { game.showMap = !game.showMap; game.ui.el.bigmap.style.display = game.showMap ? 'block' : 'none'; } });
  }
  hold(id, code) {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); keys[code] = true; el.classList.add('on'); }, { passive: false });
    const up = (e) => { e.preventDefault(); keys[code] = false; el.classList.remove('on'); };
    el.addEventListener('touchend', up, { passive: false }); el.addEventListener('touchcancel', up, { passive: false });
  }
  tap(id, fn) {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); el.classList.add('on'); fn(); }, { passive: false });
    el.addEventListener('touchend', (e) => { e.preventDefault(); el.classList.remove('on'); }, { passive: false });
  }

  stickStart(e) {
    e.preventDefault();
    if (this.stickId !== null) return;
    const t = e.changedTouches[0];
    this.stickId = t.identifier; this.sx = t.clientX; this.sy = t.clientY;
    this.base.style.display = 'block';
    this.base.style.left = this.sx + 'px'; this.base.style.top = this.sy + 'px';
    this.knob.style.transform = 'translate(-50%,-50%)';
    stick.on = true; stick.x = 0; stick.z = 0;
  }
  camStart(e) {
    e.preventDefault();
    if (this.camId !== null) return;
    const t = e.changedTouches[0];
    this.camId = t.identifier; this.cx = t.clientX; this.cy = t.clientY;
  }
  move(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === this.stickId) {
        e.preventDefault();
        let dx = t.clientX - this.sx, dy = t.clientY - this.sy;
        const d = Math.hypot(dx, dy), m = Math.min(d, this.R);
        if (d > 0) { dx = dx / d * m; dy = dy / d * m; }
        stick.x = dx / this.R; stick.z = dy / this.R;
        this.knob.style.transform = 'translate(calc(-50% + ' + dx + 'px),calc(-50% + ' + dy + 'px))';
      } else if (t.identifier === this.camId) {
        e.preventDefault();
        const g = this.g;
        if (g.state === 'play' || g.state === 'dying') {
          g.camYaw -= (t.clientX - this.cx) * 0.0065;
          g.camPitch = clamp(g.camPitch + (t.clientY - this.cy) * 0.0045, 0.12, 1.35);
        }
        this.cx = t.clientX; this.cy = t.clientY;
      }
    }
  }
  end(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === this.stickId) { this.stickId = null; stick.on = false; stick.x = 0; stick.z = 0; this.base.style.display = 'none'; }
      if (t.identifier === this.camId) this.camId = null;
    }
  }
  /** Muestra los controles solo durante la partida; resalta E cuando hay algo con lo que interactuar */
  update(game) {
    if (!IS_TOUCH || !this.root) return;
    const show = game.state === 'play';
    this.root.style.display = show ? 'block' : 'none';
    if (!show) { if (stick.on && this.stickId !== null) { this.stickId = null; stick.on = false; stick.x = stick.z = 0; this.base.style.display = 'none'; } if (this.wasShown) { keys.Space = false; keys.KeyC = false; keys.ShiftLeft = false; keys.KeyF = false; } this.wasShown = false; return; }
    this.wasShown = true;
    const info = game.promptInfo();
    document.getElementById('tbE').classList.toggle('ready', !!info);
    document.getElementById('tbTf').style.display = game.canTransform() ? 'flex' : 'none';
    document.getElementById('tbTf').classList.toggle('ready', game.player.formReady >= 0);
    document.getElementById('tbBase').style.display = game.player.formIdx > 0 ? 'flex' : 'none';
    document.getElementById('tbTp').classList.toggle('cd', game.player.tpCd > 0);
    document.getElementById('tbLv').style.display = game.practice ? 'flex' : 'none';
  }
}
