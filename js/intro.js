'use strict';
/* =====================================================================
   intro.js · Intro de las fusiones al empezar la partida con Vegetto
   (pendientes Pothala) o con Gogeta (danza de la fusión). Se dibuja en
   un canvas 2D por encima del juego con los sprites del pack
   (hojas vegito_intro y gogeta_intro); el mundo queda congelado debajo.
   Cualquier tecla, clic o toque la salta.
   ===================================================================== */

/* Guiones: cada paso dura `d` segundos. g/v = fotogramas de Goku y Vegeta (se reparten a lo largo del paso),
   gx/vx = posición horizontal (0..1) al empezar y al acabar el paso · f = fusionado (fotogramas) · txt = texto grande */
const INTROS = {
  vegito: { sheet: 'vegito_intro', name: 'VEGETTO', sub: 'Ni Goku ni Vegeta... soy Vegetto.', col: '#6fd8ff', steps: [
    { d: 0.5, g: [0], v: [1], gx: [0.22, 0.24], vx: [0.78, 0.76] },
    { d: 1.2, g: [0], v: [1], gx: [0.24, 0.27], vx: [0.76, 0.73], txt: '¡PONTE EL PENDIENTE, VEGETA!', small: true },
    { d: 0.8, g: [2], v: [3], gx: [0.27, 0.47], vx: [0.73, 0.53], txt: '¡POTHALA!' },
    { d: 0.25, flash: 1 },
    { d: 0.8, f: [4, 5, 6, 7], light: 1 },
    { d: 1.6, f: [8, 9, 10], loop: 1, name: 1 }
  ] },
  gogeta: { sheet: 'gogeta_intro', name: 'GOGETA', sub: 'Soy Gogeta. Y voy a acabar contigo.', col: '#ffd84a', steps: [
    { d: 0.5, g: [0], v: [11], gx: [0.26, 0.27], vx: [0.74, 0.73] },
    { d: 0.9, g: [1, 2, 3, 4], v: [12, 13, 14, 15], gx: [0.27, 0.33], vx: [0.73, 0.67], txt: '¡FU...!' },
    { d: 0.8, g: [5, 6, 7, 8], v: [16, 17, 18, 19], gx: [0.33, 0.39], vx: [0.67, 0.61], txt: '¡...SIÓN!' },
    { d: 0.6, g: [9, 10], v: [20, 21], gx: [0.39, 0.43], vx: [0.61, 0.57], txt: '¡HA!' },
    { d: 0.25, flash: 1 },
    { d: 0.7, f: [22], light: 1 },
    { d: 1.7, f: [23, 24, 25, 26, 24, 25, 26], name: 1 }
  ] }
};

class FusionIntro {
  constructor(game) {
    this.g = game; this.on = false; this.t = 0;
    const c = this.cv = document.createElement('canvas');
    c.id = 'intro';
    c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:22;display:none;cursor:pointer';
    document.body.appendChild(c);
    this.ctx = c.getContext ? c.getContext('2d') : null;
    // Saltar la intro: cualquier tecla, clic o toque (después de medio segundo, para no saltarla sin querer)
    const skip = (e) => { if (this.on && this.t > 0.5) { if (e) e.preventDefault(); this.end(); } };
    window.addEventListener('keydown', skip, true);
    c.addEventListener('pointerdown', skip);
  }
  /** ¿Tiene intro este personaje? */
  has(id) { return !!INTROS[id] && !!(this.g.ui.sheets && this.g.ui.sheets[INTROS[id].sheet]) && !!this.ctx; }
  /** Empieza la intro de `id` y llama a done() al acabar */
  start(id, done) {
    this.S = INTROS[id]; this.done = done; this.t = 0; this.on = true; this.flashed = false;
    this.total = this.S.steps.reduce((a, s) => a + s.d, 0);
    this.cv.style.display = 'block'; this.resize();
    SFX.play('charge');
  }
  end() {
    if (!this.on) return;
    this.on = false; this.cv.style.display = 'none';
    if (this.done) this.done();
  }
  resize() {
    const r = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = Math.round(window.innerWidth * r); this.cv.height = Math.round(window.innerHeight * r);
  }
  /** Dibuja el fotograma k de la hoja con los pies en (cx, by); `h` = alto en píxeles de la celda en pantalla */
  sprite(sh, k, cx, by, h, flip, filter, alpha) {
    const g = this.ctx, img = sh.tex.image, c = k % sh.cols, r = (k / sh.cols) | 0, s = Math.max(1, Math.round(h / sh.h)), w = sh.w * s, hh = sh.h * s;
    g.save(); g.imageSmoothingEnabled = false; g.globalAlpha = alpha === undefined ? 1 : alpha;
    if (filter) g.filter = filter;
    g.translate(Math.round(cx), Math.round(by));
    if (flip) g.scale(-1, 1);
    g.drawImage(img, c * sh.w, r * sh.h, sh.w, sh.h, -w / 2, -hh, w, hh);
    g.restore();
  }
  /** Texto grande con contorno negro (estilo cartel) */
  text(t, x, y, size, col) {
    const g = this.ctx;
    g.save(); g.font = '900 ' + Math.round(size) + 'px "Bangers", "Impact", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = size * 0.16; g.strokeStyle = '#000'; g.strokeText(t, x, y);
    g.fillStyle = col || '#fff'; g.fillText(t, x, y); g.restore();
  }
  update(dt) {
    if (!this.on) return true;
    this.t += dt;
    if (this.t >= this.total) { this.end(); return true; }
    if (this.cv.width !== Math.round(window.innerWidth * Math.min(2, window.devicePixelRatio || 1))) this.resize();
    const g = this.ctx, W = this.cv.width, H = this.cv.height, S = this.S, sh = this.g.ui.sheets[S.sheet], T = this.t;
    // Paso actual y avance dentro del paso (0..1)
    let t0 = 0, st = S.steps[0];
    for (const s of S.steps) { if (T < t0 + s.d) { st = s; break; } t0 += s.d; }
    const u = clamp((T - t0) / st.d, 0, 0.999), fr = (L) => L[Math.min(L.length - 1, (u * L.length) | 0)];
    // Fondo: azul noche con líneas de velocidad que giran
    const bg = g.createRadialGradient(W / 2, H * 0.55, H * 0.05, W / 2, H * 0.55, H * 0.9);
    bg.addColorStop(0, '#2a3a9a'); bg.addColorStop(1, '#05081e');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.save(); g.translate(W / 2, H * 0.55); g.rotate(T * 0.15); g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = Math.max(2, H * 0.006);
    for (let i = 0; i < 36; i++) { const a = (i / 36) * 6.2832; g.beginPath(); g.moveTo(Math.cos(a) * H * 0.18, Math.sin(a) * H * 0.18); g.lineTo(Math.cos(a) * H * 1.2, Math.sin(a) * H * 1.2); g.stroke(); }
    g.restore();
    // Suelo
    const fy = H * 0.78;
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(W / 2, fy + H * 0.01, W * 0.42, H * 0.03, 0, 0, 6.2832); g.fill();
    const SH = H * 0.55;                                           // alto de una celda en pantalla
    if (st.g) {                                                    // Goku y Vegeta
      const lx = (a) => (a[0] + (a[1] - a[0]) * u) * W;
      this.sprite(sh, fr(st.g), lx(st.gx), fy, SH, false);
      this.sprite(sh, fr(st.v), lx(st.vx), fy, SH, false);
    }
    if (st.f) {                                                    // la fusión
      if (st.light) {                                              // luz que crece detrás de la silueta
        const L = g.createRadialGradient(W / 2, fy - SH * 0.45, 0, W / 2, fy - SH * 0.45, H * (0.25 + u * 0.5));
        L.addColorStop(0, 'rgba(255,255,255,0.95)'); L.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = L; g.fillRect(0, 0, W, H);
      }
      const k = st.loop ? st.f[((T * 8) | 0) % st.f.length] : fr(st.f);
      this.sprite(sh, k, W / 2, fy, SH * (st.name ? 1.15 : 1), false, st.light ? 'brightness(1.6)' : '');
    }
    if (st.flash) { g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); if (!this.flashed) { this.flashed = true; SFX.play('stinger'); this.g.shake(1); } }
    // Textos
    if (st.txt) this.text(st.txt, W / 2, H * 0.2, H * (st.small ? 0.06 : 0.13) * (1 + (1 - Math.min(1, u * 5)) * 0.25), '#fff');
    if (st.name) {
      const a = Math.min(1, u * 4);
      g.save(); g.globalAlpha = a;
      this.text(S.name, W / 2, H * 0.16, H * 0.15, S.col);
      this.text(S.sub, W / 2, H * 0.29, H * 0.045, '#fff');
      g.restore();
    }
    // Fundidos de entrada y salida
    const fade = Math.max(1 - T / 0.35, (T - (this.total - 0.4)) / 0.4);
    if (fade > 0) { g.fillStyle = 'rgba(0,0,0,' + Math.min(1, fade) + ')'; g.fillRect(0, 0, W, H); }
    this.text('PULSA CUALQUIER TECLA PARA SALTAR', W / 2, H * 0.95, H * 0.025, 'rgba(255,255,255,0.6)');
    return false;
  }
}
