'use strict';
/* =====================================================================
   intro.js · Intro de las fusiones al empezar la partida con Vegetto
   (pendientes Pothala) o Gogeta (danza de la fusión), DENTRO del mapa:
   Goku y Vegeta aparecen junto al jugador (sprites del pack, hojas
   vegito_intro y gogeta_intro), la cámara se acerca, hay impact frames
   en el momento de la fusión y al final aparece el propio jugador.
   Encima va un canvas transparente para los textos y los impactos.
   Cualquier tecla, clic o toque la salta.
   ===================================================================== */

/* Guiones: cada paso dura `d` segundos.
   L / R = fotogramas del personaje de la izquierda y de la derecha (se reparten a lo largo del paso)
   lx / rx = posición en pantalla (0..1) al empezar y al acabar el paso · fR = voltear al de la derecha
   imp = secuencia de impact frames (B negro · I negativo · W blanco · C color) · f = fusión (fotogramas) con luz
   reveal = aparece el jugador · txt = texto grande */
const INTROS = {
  // Vegetto: Vegeta (izquierda) y Goku (derecha); los sprites de vuelo del pack ya van uno hacia el otro
  vegito: { sheet: 'vegito_intro', name: 'VEGETTO', sub: 'Ni Goku ni Vegeta... soy Vegetto.', col: '#6fd8ff', steps: [
    { d: 0.6, L: [1], R: [0], lx: [0.22, 0.24], rx: [0.78, 0.76] },
    { d: 1.2, L: [1], R: [0], lx: [0.24, 0.27], rx: [0.76, 0.73], txt: '¡PONTE EL PENDIENTE, VEGETA!', small: true },
    { d: 0.8, L: [3], R: [2], lx: [0.27, 0.47], rx: [0.73, 0.53], txt: '¡POTHALA!' },
    { d: 0.45, imp: 'BIWIBC' },
    { d: 0.8, f: [4, 5, 6, 7] },
    { d: 1.7, reveal: 1 }
  ] },
  // Gogeta: Goku (izquierda) y Vegeta (derecha, volteado para que mire a Goku) bailan la danza de la fusión
  gogeta: { sheet: 'gogeta_intro', name: 'GOGETA', sub: 'Soy Gogeta. Y voy a acabar contigo.', col: '#ffd84a', fR: true, steps: [
    { d: 0.6, L: [0], R: [11], lx: [0.26, 0.27], rx: [0.74, 0.73] },
    { d: 0.9, L: [1, 2, 3, 4], R: [12, 13, 14, 15], lx: [0.27, 0.33], rx: [0.73, 0.67], txt: '¡FU...!' },
    { d: 0.8, L: [5, 6, 7, 8], R: [16, 17, 18, 19], lx: [0.33, 0.39], rx: [0.67, 0.61], txt: '¡...SIÓN!' },
    { d: 0.6, L: [9, 10], R: [20, 21], lx: [0.39, 0.43], rx: [0.61, 0.57], txt: '¡HA!' },
    { d: 0.45, imp: 'BIWIBC' },
    { d: 0.7, f: [22] },
    { d: 1.7, reveal: 1 }
  ] }
};
const INTRO_SPREAD = 9;           // unidades del mundo entre la posición 0 y 1 de la pantalla

class FusionIntro {
  constructor(game) {
    this.g = game; this.on = false; this.t = 0; this.batches = {};
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
  /** Lote de sprites de la hoja de la intro (mismo tamaño de píxel que los personajes: 52,3 px = 3,6 unidades) */
  batch(name) {
    if (!this.batches[name]) {
      const s = this.g.ui.sheets[name], H = 3.6 * s.h / 52.3;
      this.batches[name] = new SpriteBatch(this.g.scene, { max: 3, texture: s.tex, cols: s.cols, rows: s.rows, w: H * (s.w / s.h), h: H, anchor: 2 / s.h, blend: true, renderOrder: 3 });
    }
    return this.batches[name];
  }
  /** Empieza la intro de `id` y llama a done() al acabar */
  start(id, done) {
    const g = this.g, p = g.player;
    this.S = INTROS[id]; this.done = done; this.t = 0; this.on = true; this.revealed = false; this.lastImp = '';
    this.total = this.S.steps.reduce((a, s) => a + s.d, 0);
    this.b = this.batch(this.S.sheet);
    p.introHide = true; p.cineChg = false;
    this.cam = g.camDistT; g.camDist = 14; g.camDistT = 11;      // la cámara se acerca a la escena
    this.cv.style.display = 'block'; this.resize(); g.ui.showHud(false);
    SFX.play('charge');
  }
  end() {
    if (!this.on) return;
    const g = this.g, p = g.player;
    this.on = false; this.cv.style.display = 'none';
    this.b.reset(); p.introHide = false; p.cineChg = false;
    g.camDistT = this.cam || 19; g.renderer.domElement.style.filter = ''; g.ui.showHud(true);
    if (!this.revealed) this.reveal();
    if (this.done) this.done();
  }
  resize() {
    const r = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = Math.round(window.innerWidth * r); this.cv.height = Math.round(window.innerHeight * r);
  }
  /** Aparece el jugador: estallido de su aura, onda, cráter y temblor */
  reveal() {
    const g = this.g, p = g.player, V = g.vfx, F = formFx(p.ch, p.formIdx), col = p.form.ki || 0xffffff;
    this.revealed = true; p.introHide = false; p.cineChg = this.on;
    if (V && V.ok) { V.play((F && F.burst) || 'tfGold2', p.x, 2.2, p.z, { size: 10, dur: 0.9, pri: 1 }); V.crater(p.x, p.z, 5, col); }
    g.fx.ring(g.fx.aura, p.x, 0.5, p.z, 70, 26, 0.8, 0.5, col);
    g.fx.burst(g.fx.sparks, p.x, 1.4, p.z, 40, 9, 0.6, 0.6, 6, col);
    g.shake(1.4); SFX.play('bigboom');
  }
  /** Texto grande con contorno negro (estilo cartel) */
  text(t, x, y, size, col) {
    const g = this.ctx;
    g.save(); g.font = '900 ' + Math.round(size) + 'px "Bangers", "Impact", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = size * 0.16; g.strokeStyle = '#000'; g.strokeText(t, x, y);
    g.fillStyle = col || '#fff'; g.fillText(t, x, y); g.restore();
  }
  /** Un impact frame (B negro con estallido blanco · I negativo · W blanco con líneas negras · C color con líneas) */
  impact(k, W, H) {
    const g = this.ctx, el = this.g.renderer.domElement, cx = W / 2, cy = H * 0.55;
    el.style.filter = k === 'I' ? 'grayscale(1) contrast(9) invert(1)' : '';
    const rays = (col, n, w) => {
      g.save(); g.translate(cx, cy); g.fillStyle = col;
      for (let i = 0; i < n; i++) { const a = (i / n) * 6.2832 + Math.random() * 0.2, r = Math.hypot(W, H); g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a - w) * r, Math.sin(a - w) * r); g.lineTo(Math.cos(a + w) * r, Math.sin(a + w) * r); g.fill(); }
      g.restore();
    };
    if (k === 'B') { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); rays('#fff', 18, 0.03); }
    else if (k === 'W') { g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); rays('#000', 26, 0.012); }
    else if (k === 'C') { g.fillStyle = this.S.col; g.globalAlpha = 0.85; g.fillRect(0, 0, W, H); g.globalAlpha = 1; rays('#fff', 22, 0.015); }
  }
  update(dt) {
    if (!this.on) return true;
    this.t += dt;
    if (this.t >= this.total) { this.end(); return true; }
    if (this.cv.width !== Math.round(window.innerWidth * Math.min(2, window.devicePixelRatio || 1))) this.resize();
    const G = this.g, p = G.player, g = this.ctx, W = this.cv.width, H = this.cv.height, S = this.S, T = this.t;
    // Paso actual y avance dentro del paso (0..1)
    let t0 = 0, st = S.steps[0];
    for (const s of S.steps) { if (T < t0 + s.d) { st = s; break; } t0 += s.d; }
    const u = clamp((T - t0) / st.d, 0, 0.999), fr = (L) => L[Math.min(L.length - 1, (u * L.length) | 0)];
    // Sprites en el mundo: a los lados del jugador, en el eje «derecha» de la cámara
    const rx = G.camCos, rz = -G.camSin, at = (a) => (a[0] + (a[1] - a[0]) * u - 0.5) * INTRO_SPREAD;
    const B = this.b; B.begin();
    if (st.L) {
      const l = at(st.lx), r = at(st.rx);
      B.push(p.x + rx * l, 0, p.z + rz * l, fr(st.L), 0, 0, 1, 1, 0xffffff);
      B.push(p.x + rx * r, 0, p.z + rz * r, fr(st.R), S.fR ? 1 : 0, 0, 1, 1, 0xffffff);
    }
    if (st.f) {                                                    // la fusión: silueta blanca que brilla
      B.push(p.x, 0, p.z, fr(st.f), 0, st.f.length === 1 ? 1 : (((T * 12) | 0) % 2), 1, 1, 0xffffff);
      if (((T * 8) | 0) !== this.ringQ) { this.ringQ = (T * 8) | 0; G.fx.ring(G.fx.aura, p.x, 0.5, p.z, 30, 8 + u * 10, 0.5, 0.4, 0xffffff); }
    }
    B.end();
    if (st.reveal && !this.revealed) this.reveal();
    if (st.reveal) p.cineChg = u < 0.7;                            // pose de cargar ki con el aura y luego quieto
    // Capa 2D: impactos, textos y aviso
    g.clearRect(0, 0, W, H);
    if (st.imp) {
      const k = st.imp[Math.min(st.imp.length - 1, (u * st.imp.length) | 0)];
      this.impact(k, W, H);
      if (k !== this.lastImp) { this.lastImp = k; G.shake(0.9); if (k === 'W') SFX.play('stinger'); }
    } else if (this.lastImp) { this.lastImp = ''; G.renderer.domElement.style.filter = ''; }
    if (st.f) { g.fillStyle = 'rgba(255,255,255,' + (0.5 * (1 - u)) + ')'; g.fillRect(0, 0, W, H); }
    if (st.txt) this.text(st.txt, W / 2, H * 0.2, H * (st.small ? 0.06 : 0.13) * (1 + (1 - Math.min(1, u * 5)) * 0.25), '#fff');
    if (st.reveal) {
      g.save(); g.globalAlpha = Math.min(1, u * 4);
      this.text(S.name, W / 2, H * 0.17, H * 0.15, S.col);
      this.text(S.sub, W / 2, H * 0.3, H * 0.045, '#fff');
      g.restore();
    }
    // Barras de cine arriba y abajo (se abren al final)
    const bar = H * 0.09 * Math.min(1, T / 0.4, (this.total - T) / 0.4);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, bar); g.fillRect(0, H - bar, W, bar);
    this.text('PULSA CUALQUIER TECLA PARA SALTAR', W / 2, H - bar / 2, H * 0.022, 'rgba(255,255,255,0.7)');
    return false;
  }
}
