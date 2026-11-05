'use strict';
/* =====================================================================
   pad.js · Mando (Gamepad API, distribución estándar tipo Xbox).
   Los botones se traducen a teclas: se envían eventos keydown/keyup,
   así el resto del juego no necesita saber si usas teclado o mando.
   El stick izquierdo escribe en `stick` (igual que el joystick táctil)
   y el derecho mueve la cámara.
   ===================================================================== */

/* Botón -> tecla según el estado del juego (índices de la distribución estándar) */
const PAD_MAP = {
  play: { 0: 'Space', 1: 'KeyF', 2: 'KeyE', 3: 'KeyG', 5: 'KeyC', 7: 'KeyC', 8: 'KeyM', 9: 'Escape', 10: 'KeyQ', 12: 'KeyT', 13: 'KeyH' },
  cards: { 0: 'Enter', 2: 'KeyR', 14: 'ArrowLeft', 15: 'ArrowRight' },
  pause: { 9: 'Escape', 8: 'Tab' },
  trade: { 1: 'Escape', 2: 'KeyE' },
  menu: { 0: 'Enter', 9: 'Enter' },
  over: { 0: 'Enter', 9: 'Enter', 1: 'KeyM' }
};

class PadInput {
  constructor(game) {
    this.g = game; this.held = {}; this.stickOwn = false; this.axisT = 0;
    window.addEventListener('gamepadconnected', () => game.ui.toast('MANDO CONECTADO', true));
    window.addEventListener('gamepaddisconnected', () => { this.releaseAll(); game.ui.toast('MANDO DESCONECTADO', true); });
  }
  send(type, code) { window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true })); }
  releaseAll() {
    for (const i in this.held) this.send('keyup', this.held[i]);
    this.held = {};
    if (this.stickOwn) { stick.on = false; stick.x = stick.z = 0; this.stickOwn = false; }
  }
  /** Mapa de botones para el estado actual */
  mapFor(s) {
    if (s === 'play') return PAD_MAP.play;
    if (s === 'levelup' || s === 'wish') return PAD_MAP.cards;
    return PAD_MAP[s] || {};
  }
  poll(dt) {
    const list = navigator.getGamepads ? navigator.getGamepads() : null;
    let gp = null;
    if (list) for (const p of list) if (p && p.connected) { gp = p; break; }
    if (!gp) { if (Object.keys(this.held).length || this.stickOwn) this.releaseAll(); return; }
    const g = this.g, map = this.mapFor(g.state);
    // Botones: flanco de bajada -> keydown, de subida -> keyup (con la tecla que se pulsó)
    for (let i = 0; i < gp.buttons.length; i++) {
      const b = gp.buttons[i], down = b.pressed || b.value > 0.4;
      if (down && !this.held[i] && map[i]) { this.held[i] = map[i]; this.send('keydown', map[i]); }
      else if (!down && this.held[i]) { this.send('keyup', this.held[i]); delete this.held[i]; }
    }
    const ax = gp.axes, dz = 0.18;
    // Stick izquierdo: movimiento (analógico) o elegir carta
    const lx = ax[0] || 0, ly = ax[1] || 0, lm = Math.hypot(lx, ly);
    if (g.state === 'play' && lm > dz) { stick.on = true; stick.x = lx; stick.z = ly; this.stickOwn = true; }
    else if (this.stickOwn) { stick.on = false; stick.x = stick.z = 0; this.stickOwn = false; }
    if ((g.state === 'levelup' || g.state === 'wish') && Math.abs(lx) > 0.6) {
      this.axisT -= dt;
      if (this.axisT <= 0) { this.axisT = 0.28; g.ui.focusCard(lx < 0 ? -1 : 1); }
    } else this.axisT = 0;
    // Stick derecho: cámara
    const rx = ax[2] || 0, ry = ax[3] || 0;
    if ((g.state === 'play' || g.state === 'dying') && Math.hypot(rx, ry) > dz) {
      g.camYaw -= rx * 2.6 * dt;
      g.camPitch = clamp(g.camPitch + ry * 1.8 * dt, 0.12, 1.35);
    }
  }
}
