'use strict';
/* =====================================================================
   cutfx.js · Animaciones a pantalla completa en hojas de 4×4 fotogramas
   (pixel art sobre fondo negro, 1672×941). Se dibujan en un canvas 2D
   con mezcla «screen»: el negro desaparece y solo queda la luz.

   Recoloreado (una vez por color, se guarda en caché):
   - 'gray': hojas en blanco y negro (choque, aura). Mapa de degradado:
     negro → color → blanco según la luminosidad.
   - 'none': se dibuja tal cual (Shenron, con su propio fondo).
   ===================================================================== */
const CUT_SHEETS = {
  clash:   { src: 'assets/fx/cut_clash.webp',   mode: 'gray' },            // dos energías que chocan y estallan
  aura:    { src: 'assets/fx/cut_aura.webp',    mode: 'gray' },            // aura que sube del suelo con rocas
  shenron: { src: 'assets/fx/cut_shenron.webp', mode: 'none' }             // las 7 esferas invocan a Shenron (con cielo)
};
const CUT_COLS = 4, CUT_ROWS = 4, CUT_INSET = 4;     // margen interior de cada fotograma (evita ver el borde del vecino)

const CutFx = {
  img: {}, cache: new Map(), queue: [], busy: false,

  /** Imagen de la hoja (se empieza a descargar la primera vez que se pide) */
  load(name) {
    let im = this.img[name];
    if (!im && CUT_SHEETS[name]) { im = this.img[name] = new Image(); im.decoding = 'async'; im.src = CUT_SHEETS[name].src; }
    return im || null;
  },
  ready(name) { const im = this.load(name); return !!(im && im.complete && im.naturalWidth); },

  /** Hoja lista para dibujar con el color css '#rrggbb' (null si aún no ha cargado) */
  sheet(name, col) {
    const S = CUT_SHEETS[name];
    if (!S || !this.ready(name)) return null;
    const im = this.img[name];
    if (S.mode === 'none' || !col) return im;
    const key = name + col;
    let c = this.cache.get(key);
    if (c) { this.cache.delete(key); this.cache.set(key, c); return c; }      // la más usada pasa al final
    c = this.tint(im, S, col);
    this.cache.set(key, c);
    if (this.cache.size > 8) this.cache.delete(this.cache.keys().next().value);   // máximo 8 hojas en memoria (~6 MB cada una)
    return c;
  },

  /** Prepara la hoja en segundo plano (una por tick) para que no haya tirón al usarla */
  warm(name, col) {
    if (!CUT_SHEETS[name]) return;
    this.load(name);
    this.queue.push([name, col]);
    if (this.busy) return;
    this.busy = true;
    const step = () => {
      const q = this.queue[0];
      if (!q) { this.busy = false; return; }
      const im = this.img[q[0]];
      if (im && !im.complete) { im.addEventListener('load', step, { once: true }); im.addEventListener('error', step, { once: true }); return; }   // espera a que se descargue
      this.queue.shift();
      if (this.ready(q[0])) this.sheet(q[0], q[1]);
      setTimeout(step, 60);
    };
    setTimeout(step, 60);
  },

  /** Recolorea píxel a píxel en un canvas aparte */
  tint(im, S, col) {
    const W = im.naturalWidth, H = im.naturalHeight, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.drawImage(im, 0, 0);
    let d;
    try { d = x.getImageData(0, 0, W, H); } catch (e) { return im; }      // (abierto desde file:// sin permisos: sin recolorear)
    const a = d.data, n = parseInt(col.slice(1), 16), tr = (n >> 16) & 255, tg = (n >> 8) & 255, tb = n & 255;
    // Luminosidad → negro · color (al 60 %) · blanco
    for (let i = 0; i < a.length; i += 4) {
      const L = Math.max(a[i], a[i + 1], a[i + 2]) / 255;
      if (L < 0.6) { const k = L / 0.6; a[i] = tr * k; a[i + 1] = tg * k; a[i + 2] = tb * k; }
      else { const k = (L - 0.6) / 0.4; a[i] = tr + (255 - tr) * k; a[i + 1] = tg + (255 - tg) * k; a[i + 2] = tb + (255 - tb) * k; }
    }
    x.putImageData(d, 0, 0);
    return c;
  },
  /**
   * Dibuja el fotograma k (0..15) en el rectángulo (x, y, w, h).
   * o: { col: color css, alpha, op: modo de mezcla ('screen' por defecto) }
   */
  draw(ctx, name, k, x, y, w, h, o) {
    o = o || {};
    const sh = this.sheet(name, o.col);
    if (!sh) return false;
    k = Math.max(0, Math.min(CUT_COLS * CUT_ROWS - 1, k | 0));
    const fw = (sh.naturalWidth || sh.width) / CUT_COLS, fh = (sh.naturalHeight || sh.height) / CUT_ROWS;
    const sx = (k % CUT_COLS) * fw + CUT_INSET, sy = ((k / CUT_COLS) | 0) * fh + CUT_INSET;
    ctx.save();
    ctx.globalCompositeOperation = o.op || 'screen';
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(sh, sx, sy, fw - CUT_INSET * 2, fh - CUT_INSET * 2, x, y, w, h);
    ctx.restore();
    return true;
  },
  /** Igual que draw, pero cubriendo toda la zona W×H (recorta lo que sobra, sin deformar) */
  cover(ctx, name, k, W, H, o) {
    const r = 16 / 9, w = Math.max(W, H * r), h = w / r;
    return this.draw(ctx, name, k, (W - w) / 2, (H - h) / 2, w, h, o);
  }
};
CutFx.load('shenron');                                // la invocación de Shenron puede salir nada más abrir el juego (premio diario)
