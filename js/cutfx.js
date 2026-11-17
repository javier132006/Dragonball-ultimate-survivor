'use strict';
/* =====================================================================
   cutfx.js · Animaciones a pantalla completa en hojas de 4×4 fotogramas
   (pixel art sobre fondo negro, 1672×941). Se dibujan en un canvas 2D
   con mezcla «screen»: el negro desaparece y solo queda la luz.

   Recoloreado (una vez por color, se guarda en caché):
   - 'hue': hojas de color (rayo, esfera, explosión). Se gira el tono
     hacia el color del personaje y se ajusta la saturación (Jiren sale
     casi blanco, Vegeta amarillo...). El brillo no cambia.
   - 'gray': hojas en blanco y negro (choque, aura). Mapa de degradado:
     negro → color → blanco según la luminosidad.
   - 'none': se dibuja tal cual (Shenron, con su propio fondo).
   ===================================================================== */
const CUT_SHEETS = {
  beam:    { src: 'assets/fx/cut_beam.webp',    mode: 'hue', hue: 207 },   // Kamehameha: carga, rayo, destello, humo
  bolt:    { src: 'assets/fx/cut_bolt.webp',    mode: 'hue', hue: 216 },   // rayo eléctrico
  sphere:  { src: 'assets/fx/cut_sphere.webp',  mode: 'hue', hue: 215 },   // esfera gigante que estalla
  blast:   { src: 'assets/fx/cut_blast.webp',   mode: 'hue', hue: 300 },   // explosión morada y roja con rocas
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
    if (S.mode === 'gray') {
      // Luminosidad → negro · color (al 60 %) · blanco
      for (let i = 0; i < a.length; i += 4) {
        const L = Math.max(a[i], a[i + 1], a[i + 2]) / 255;
        if (L < 0.6) { const k = L / 0.6; a[i] = tr * k; a[i + 1] = tg * k; a[i + 2] = tb * k; }
        else { const k = (L - 0.6) / 0.4; a[i] = tr + (255 - tr) * k; a[i + 1] = tg + (255 - tg) * k; a[i + 2] = tb + (255 - tb) * k; }
      }
    } else {
      // Tono destino y cuánta saturación conservar (colores casi grises → efecto casi blanco)
      const mx = Math.max(tr, tg, tb), mn = Math.min(tr, tg, tb), sT = mx ? (mx - mn) / mx : 0;
      const hT = this.hue(tr, tg, tb), shift = (hT - S.hue + 360) % 360, sk = Math.min(1, sT / 0.55);
      for (let i = 0; i < a.length; i += 4) {
        const r = a[i], g = a[i + 1], b = a[i + 2], M = Math.max(r, g, b);
        if (M < 6) continue;
        const m = Math.min(r, g, b), s = ((M - m) / M) * sk;
        const h = ((this.hue(r, g, b) + shift) % 360) / 60, f = h - Math.floor(h), p = M * (1 - s), q = M * (1 - s * f), t = M * (1 - s * (1 - f));
        switch (Math.floor(h) % 6) {
          case 0: a[i] = M; a[i + 1] = t; a[i + 2] = p; break;
          case 1: a[i] = q; a[i + 1] = M; a[i + 2] = p; break;
          case 2: a[i] = p; a[i + 1] = M; a[i + 2] = t; break;
          case 3: a[i] = p; a[i + 1] = q; a[i + 2] = M; break;
          case 4: a[i] = t; a[i + 1] = p; a[i + 2] = M; break;
          default: a[i] = M; a[i + 1] = p; a[i + 2] = q;
        }
      }
    }
    x.putImageData(d, 0, 0);
    return c;
  },
  /** Tono (0..360) de un color RGB */
  hue(r, g, b) {
    const M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m;
    if (!d) return 0;
    let h = M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60; return h < 0 ? h + 360 : h;
  },

  /**
   * Dibuja el fotograma k (0..15) en el rectángulo (x, y, w, h).
   * o: { col: color css, flip: espejo horizontal, alpha, op: modo de mezcla ('screen' por defecto) }
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
    if (o.flip) { ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(sh, sx, sy, fw - CUT_INSET * 2, fh - CUT_INSET * 2, 0, 0, w, h); }
    else ctx.drawImage(sh, sx, sy, fw - CUT_INSET * 2, fh - CUT_INSET * 2, x, y, w, h);
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
