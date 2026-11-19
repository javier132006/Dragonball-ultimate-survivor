/* =====================================================================
   Impact frames de cada forma (assets/impacts.js, tools/make_impacts.py):
   una pareja de dibujos por forma, el oscuro (tinta o color) y el blanco.
   - ImpactArt: carga las imágenes y las dibuja grandes con píxel duro.
   - ImpactFlash: destello a pantalla completa (fondo blanco con la silueta
     oscura, fondo negro con la blanca, líneas de velocidad y golpe de zoom).
   Se usan al transformarse (transform.js en Supervivencia, trSwap en Versus)
   y al lanzar la Ultimate (game.js y ultGo en Versus).
   ===================================================================== */
const ImpactArt = {
  img: {},
  name: (cid, fi) => 'ix_' + cid + '_' + (fi | 0),
  has(cid, fi) { return !!(window.SPRITE_DATA && SPRITE_DATA[this.name(cid, fi)]); },
  /** Empieza a cargar la imagen de una forma (si existe) */
  load(cid, fi) {
    const n = this.name(cid, fi);
    if (this.img[n] || !this.has(cid, fi)) return;
    const im = new Image(); im.decoding = 'async'; im.src = SPRITE_DATA[n].src; this.img[n] = im;
  },
  /** Todas las formas de un personaje */
  prep(ch) { if (ch && ch.forms) ch.forms.forEach((f, i) => this.load(ch.id, i)); },
  /** Imagen lista para dibujar (o null) */
  get(cid, fi) {
    const n = this.name(cid, fi); this.load(cid, fi);
    const im = this.img[n];
    return im && im.complete && im.naturalWidth ? { im, d: SPRITE_DATA[n] } : null;
  },
  /** Dibuja el fotograma k (0 oscuro, 1 blanco): alto h en píxeles, pies en (cx, fy) */
  draw(x, A, k, cx, fy, h, flip) {
    const d = A.d, s = h / d.h, w = d.w * s;
    x.save(); x.imageSmoothingEnabled = false;
    if (flip) { x.translate(cx, 0); x.scale(-1, 1); cx = 0; }
    x.drawImage(A.im, k * d.w, 0, d.w, d.h, Math.round(cx - w / 2), Math.round(fy - h), Math.round(w), Math.round(h));
    x.restore();
  }
};

/** Líneas de velocidad: cuñas desde un punto hacia los bordes */
function impactLines(x, cx, cy, W, H, col, n, wid, inner) {
  const R = Math.hypot(W, H);
  x.fillStyle = col; x.beginPath();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.2832, d = wid * (0.4 + Math.random()), r0 = inner * (0.8 + Math.random() * 0.9);
    x.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    x.lineTo(cx + Math.cos(a - d) * R, cy + Math.sin(a - d) * R);
    x.lineTo(cx + Math.cos(a + d) * R, cy + Math.sin(a + d) * R);
  }
  x.fill();
}

/** Un fotograma de impacto completo: tipo W (blanco y silueta oscura), B (negro y silueta blanca), C (color) */
function impactPanel(x, A, type, W, H, step, col, flip) {
  const cx = W / 2 + (Math.random() - 0.5) * W * 0.012, fy = H * 0.88 + (Math.random() - 0.5) * H * 0.01;
  const h = H * (0.62 + step * 0.04), cy = fy - h * 0.55, S = Math.min(W, H);
  if (type === 'B') {
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    impactLines(x, cx, cy, W, H, '#fff', 70, 0.012, S * 0.32);
  } else if (type === 'C') {
    x.fillStyle = col; x.fillRect(0, 0, W, H);
    impactLines(x, cx, cy, W, H, 'rgba(255,255,255,.85)', 60, 0.014, S * 0.3);
    impactLines(x, cx, cy, W, H, 'rgba(0,0,0,.55)', 30, 0.008, S * 0.36);
  } else {
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    impactLines(x, cx, cy, W, H, '#000', 80, 0.011, S * 0.3);
  }
  if (A) ImpactArt.draw(x, A, type === 'B' ? 1 : 0, cx, fy, h, flip);
}

const ImpactFlash = {
  STEP: 0.065,
  cv: null, x: null, on: false,
  init() {
    if (this.cv) return;
    const c = this.cv = document.createElement('canvas');
    c.id = 'impactFlash';
    c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:40;display:none;pointer-events:none';
    document.body.appendChild(c); this.x = c.getContext ? c.getContext('2d') : null;
  },
  /** Destello de impacto de una forma. seq: tipos de fotograma (W, B, C). Sin dibujo de esa forma, no hace nada */
  play(cid, fi, col, seq, flip) {
    this.init(); if (!this.x) return false;
    const A = ImpactArt.get(cid, fi); if (!A) return false;
    const soft = typeof Save !== 'undefined' && Save.d && Save.d.opt && Save.d.opt.flash;   // «reducir destellos»
    this.A = A; this.seq = soft ? 'S' : (seq || 'WBW'); this.col = '#' + new THREE.Color(col || 0xffffff).getHexString(); this.flip = !!flip;
    this.t = 0; this.k = -1; this.last = performance.now();
    if (!this.on) { this.on = true; this.cv.style.display = 'block'; requestAnimationFrame(() => this.frame()); }
    return true;
  },
  frame() {
    if (!this.on) return;
    const now = performance.now(); this.t += Math.min(0.05, (now - this.last) / 1000); this.last = now;
    const c = this.cv, r = Math.min(2, window.devicePixelRatio || 1), W = Math.round(window.innerWidth * r), H = Math.round(window.innerHeight * r);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const x = this.x, n = this.seq.length, soft = this.seq === 'S', dur = soft ? 0.35 : n * this.STEP + 0.12;
    if (this.t >= dur) { this.on = false; c.style.display = 'none'; x.clearRect(0, 0, W, H); return; }
    const k = Math.min(n - 1, Math.floor(this.t / this.STEP));
    x.clearRect(0, 0, W, H);
    if (soft) {                                                       // sin destellos: velo de color y la silueta, suave
      const a = Math.sin(Math.PI * this.t / dur);
      x.globalAlpha = a * 0.35; x.fillStyle = this.col; x.fillRect(0, 0, W, H); x.globalAlpha = a * 0.9;
      ImpactArt.draw(x, this.A, 0, W / 2, H * 0.88, H * 0.62, this.flip); x.globalAlpha = 1;
    } else if (this.t < n * this.STEP) {
      impactPanel(x, this.A, this.seq[k], W, H, k, this.col, this.flip);
    } else {                                                          // salida: la última silueta se desvanece sobre el juego
      const a = 1 - (this.t - n * this.STEP) / 0.12;
      x.globalAlpha = Math.max(0, a); ImpactArt.draw(x, this.A, 1, W / 2, H * 0.88, H * (0.62 + n * 0.04), this.flip); x.globalAlpha = 1;
    }
    requestAnimationFrame(() => this.frame());
  }
};
