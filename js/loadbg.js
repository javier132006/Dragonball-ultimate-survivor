'use strict';
/* =====================================================================
   loadbg.js · Fondo animado de la pantalla de carga (canvas 2D, sin Three.js).
   Se carga antes que el resto del juego y se anima mientras se descarga todo.

   Capas de atrás hacia delante (cada una con su velocidad: paralaje):
   cielo con luna · aurora · estrellas que parpadean · meteoros · rayos lejanos ·
   nave de Freezer · montañas · islas flotantes · pétalos lejanos · acantilados con la
   Kame House · las 7 esferas girando · nubes · luciérnagas · pétalos de
   cerezo cerca · viñeta.

   Las piezas salen de assets/load/atlas.webp (tools/make_loadbg.py) y sus
   coordenadas de window.LOAD_ATLAS (js/loadatlas.js).
   ===================================================================== */
const LoadBg = (() => {
  const A = window.LOAD_ATLAS || {};
  const img = new Image();
  img.src = 'assets/load/atlas.webp?v=' + (window.V || 0);                // misma dirección que el preload de index.html
  let cv = null, ctx = null, W = 0, H = 0, SZ = 0, dpr = 1, raf = 0, last = 0, t = 0, on = false;

  /* ---------- Utilidades de dibujo ---------- */
  const rnd = (a, b) => a + Math.random() * (b - a);
  /** Dibuja la pieza p (o su fotograma k) centrada en (x, y) con alto h */
  function piece(p, k, x, y, h, o) {
    const P = A[p]; if (!P) return;
    o = o || {};
    let sx = P.x, sy = P.y, sw = P.w, sh = P.h;
    if (P.cols) {
      const fw = P.fw || P.w / P.cols, fh = P.fh || P.h / P.rows, n = P.cols * P.rows; k = ((k | 0) % n + n) % n;
      sx = P.x + (k % P.cols) * fw; sy = P.y + ((k / P.cols) | 0) * fh; sw = fw; sh = fh;
    }
    const w = h * sw / sh;
    ctx.save();
    if (o.add) ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    if (o.flip) ctx.scale(-1, 1);
    ctx.drawImage(img, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  /** Banda que se repite en horizontal (una copia normal y otra en espejo: así nunca se ve la costura) */
  function band(p, bottom, h, off, o) {
    const P = A[p]; if (!P) return;
    o = o || {};
    const w = h * P.w / P.h, period = w * 2;
    let x = -(((off % period) + period) % period);
    const src = o.src || img, sx = o.src ? 0 : P.x, sy = o.src ? 0 : P.y;
    ctx.save();
    if (o.add) ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    for (let i = 0; x < W; i++, x += w) {
      if (i % 2) { ctx.save(); ctx.translate(x + w, 0); ctx.scale(-1, 1); ctx.drawImage(src, sx, sy, P.w, P.h, 0, bottom - h, w + 0.5, h); ctx.restore(); }
      else ctx.drawImage(src, sx, sy, P.w, P.h, x, bottom - h, w + 0.5, h);
    }
    ctx.restore();
  }

  /** Aurora con los bordes de arriba y abajo difuminados (si no, se ve el corte de la imagen) */
  let auroraCv = null;
  function softAurora() {
    const P = A.aurora; if (!P || !img.naturalWidth) return null;
    const c = document.createElement('canvas'); c.width = P.w; c.height = P.h;
    const x = c.getContext('2d');
    x.drawImage(img, P.x, P.y, P.w, P.h, 0, 0, P.w, P.h);
    x.globalCompositeOperation = 'destination-in';
    const g = x.createLinearGradient(0, 0, 0, P.h);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.3, 'rgba(0,0,0,1)'); g.addColorStop(0.65, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, P.w, P.h);
    return c;
  }

  /* ---------- Actores (personajes y objetos que cruzan) ---------- */
  const S = { stars: [], isles: [], actors: [], next: {}, petals: [] };
  const PETALS = Object.keys(A).filter((k) => k.startsWith('petal'));
  /** Un pétalo nuevo: far = capa lejana (pequeño y tenue) o cercana; top = nace arriba (si no, en cualquier altura) */
  function petal(far, top) {
    return { k: PETALS[(Math.random() * PETALS.length) | 0], far, x: Math.random() * 1.2, y: top ? rnd(-0.15, -0.03) : Math.random(),
      s: far ? rnd(0.015, 0.025) : rnd(0.03, 0.055), v: far ? rnd(0.03, 0.05) : rnd(0.06, 0.1), sw: rnd(0.6, 1.4), ph: Math.random() * 6, r: Math.random() * 6, vr: rnd(-1.5, 1.5) };
  }
  function setup() {
    S.stars = [];
    for (let i = 0; i < 22; i++) S.stars.push({ x: Math.random(), y: rnd(0.02, 0.5), k: (Math.random() * 16) | 0, s: rnd(0.6, 1.3), ph: Math.random() * 6 });
    // Islas flotantes: las grandes repartidas a lo ancho, las pequeñas entre medias
    const big = ['isle0', 'isle3', 'isle4', 'isle6'].filter((k) => A[k]), small = ['isle1', 'isle2', 'isle5'].filter((k) => A[k]);
    S.isles = big.map((k, i) => ({ k, x: (i + 0.5) / big.length + rnd(-0.05, 0.05), y: rnd(0.4, 0.47), h: rnd(0.12, 0.15), ph: Math.random() * 6 }))
      .concat(small.map((k, i) => ({ k, x: (i + 0.8) / small.length, y: rnd(0.36, 0.42), h: rnd(0.04, 0.055), ph: Math.random() * 6 })));
    S.actors = [];
    S.petals = [];
    if (PETALS.length) for (let i = 0; i < 34; i++) S.petals.push(petal(i < 14, false));
    // Primeras apariciones (s): enseguida pasa algo, después cada uno con su ritmo
    S.next = { meteor: 1, bolt: 4, ship: 3 };
  }
  /** Saca un actor nuevo de tipo k */
  function spawn(k) {
    const u = SZ / 720;                                                           // velocidades a la escala de los personajes
    if (k === 'meteor') { S.actors.push({ k: 'meteor', x: rnd(0.4, 1.1) * W, y: -0.1 * H, vx: -520 * u, vy: 360 * u, h: 0.14 * SZ, t: 0, z: 0 }); return rnd(5, 9); }
    if (k === 'bolt') { S.actors.push({ k: 'bolt', x: rnd(0.1, 0.9) * W, y: rnd(0.12, 0.3) * H, h: 0.17 * SZ, t: 0, z: 0 }); return rnd(10, 16); }
    if (k === 'ship') { S.actors.push({ k: 'ship', x: W + 40 * u, y: rnd(0.47, 0.52) * H, vx: -rnd(35, 50) * u, h: 0.045 * SZ, t: 0, z: 1 }); return rnd(20, 28); }
    return 10;
  }
  /** Mueve y dibuja los actores de la capa z */
  function actors(z, dt) {
    for (const a of S.actors) {
      if (a.z !== z || a.dead) continue;
      if (a.k === 'meteor') {
        a.t += dt; a.x += a.vx * dt; a.y += a.vy * dt;
        piece('meteor', a.t * 12, a.x, a.y, a.h, { add: 1, alpha: 0.9 });
        if (a.y > H * 0.6) a.dead = true;
      } else if (a.k === 'bolt') {
        a.t += dt;
        const k = (a.t * 12) | 0;
        if (k > 5) { a.dead = true; continue; }
        piece('bolt', Math.min(3, k), a.x, a.y, a.h, { add: 1, alpha: k < 4 ? 0.8 : 0.4 });
      } else if (a.k === 'ship') {
        a.t += dt; a.x += a.vx * dt;
        piece('ship', a.t * 8, a.x, a.y + Math.sin(a.t * 2) * H * 0.004, a.h, { alpha: 0.85 });
        if (a.x < -100) a.dead = true;
      }
    }
  }

  /** Pétalos de cerezo de una capa: caen con el viento hacia la izquierda, se mecen y giran */
  function petals(far, dt) {
    for (let i = 0; i < S.petals.length; i++) {
      const p = S.petals[i];
      if (p.far !== far) continue;
      p.y += p.v * dt; p.x -= p.v * 0.55 * dt; p.r += p.vr * dt;
      if (p.y > 1.05 || p.x < -0.1) { S.petals[i] = petal(far, true); continue; }
      const sway = Math.sin(t * p.sw + p.ph);
      piece(p.k, 0, (p.x + sway * 0.012) * W, p.y * H, p.s * SZ, { rot: p.r + sway * 0.4, alpha: far ? 0.55 : 0.95 });
    }
  }

  /* ---------- Fotograma ---------- */
  function frame(now) {
    if (!on) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;      // delta time acotado
    if (!img.complete || !img.naturalWidth) return;
    if (cv.width !== Math.round(innerWidth * Math.min(1.25, window.devicePixelRatio || 1)) || cv.height !== Math.round(innerHeight * dpr)) resize();
    t += dt;
    draw(dt);
  }
  function draw(dt) {
    const u = H / 720;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    // Cielo: cubre la pantalla con un leve vaivén
    const P = A.sky;
    if (P) {
      const sc = Math.max(W / P.w, H / P.h) * 1.06, w = P.w * sc, h = P.h * sc;
      ctx.drawImage(img, P.x, P.y, P.w, P.h, (W - w) / 2 + Math.sin(t * 0.05) * W * 0.02, (H - h) / 2, w, h);
    }
    if (!auroraCv) auroraCv = softAurora();
    if (auroraCv) band('aurora', H * 0.42, H * 0.36, t * 10 * u, { add: 1, src: auroraCv, alpha: 0.35 + Math.sin(t * 0.4) * 0.08 });
    for (const s of S.stars) piece('stars', t * 5 + s.k, s.x * W, s.y * H, SZ * 0.045 * s.s, { add: 1, alpha: 0.45 + 0.45 * Math.sin(t * 2 + s.ph) });
    // Actores: aparecen cuando toca
    for (const k in S.next) { S.next[k] -= dt; if (S.next[k] <= 0) S.next[k] = spawn(k); }
    actors(0, dt);
    actors(1, dt);
    band('mount', H * 0.72, H * 0.3, t * 6 * u);
    for (const s of S.isles) {                                                      // islas flotantes que van a la deriva
      s.x -= dt * 0.006;
      if (s.x < -0.15) s.x += 1.3;
      piece(s.k, 0, s.x * W, (s.y + Math.sin(t * 0.8 + s.ph) * 0.01) * H, s.h * SZ);
    }
    petals(true, dt);
    band('cliff', H * 0.9, H * 0.33, t * 16 * u);
    actors(4, dt);
    // Las 7 esferas girando en una elipse alrededor del logo (las de atrás, más pequeñas y tenues)
    const cx = W / 2, cy = Math.max(H * 0.08, 24) + Math.min(W * 0.1, H * 0.17) * 0.75, rx = Math.min(W * 0.42, H * 0.75), ry = H * 0.11;
    for (let i = 0; i < 7; i++) {
      const a = t * 0.3 + i / 7 * Math.PI * 2, d = (Math.sin(a) + 1) / 2;             // d: 0 detrás, 1 delante
      piece('ball', t * 6 + i * 2, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, SZ * (0.035 + 0.03 * d), { alpha: 0.35 + 0.65 * d });
    }
    actors(5, dt);
    band('cloud', H * 1.05, H * 0.3, t * 34 * u);
    band('flies', H, H * 0.4, t * 12 * u, { add: 1, alpha: 0.35 + Math.sin(t * 1.7) * 0.15 });
    petals(false, dt);
    // Viñeta y oscurecido arriba (el logo se lee mejor)
    const v = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.3, W / 2, H * 0.45, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(4,6,20,0)'); v.addColorStop(1, 'rgba(4,6,20,0.55)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    const top = ctx.createLinearGradient(0, 0, 0, H * 0.4);
    top.addColorStop(0, 'rgba(4,6,20,0.55)'); top.addColorStop(1, 'rgba(4,6,20,0)');
    ctx.fillStyle = top; ctx.fillRect(0, 0, W, H * 0.4);
    S.actors = S.actors.filter((a) => !a.dead);
  }
  function resize() {
    dpr = Math.min(1.25, window.devicePixelRatio || 1);                        // las piezas son pixel art de baja resolución: más no aporta
    W = innerWidth; H = innerHeight; SZ = Math.min(H, W * 0.75);                   // tamaño de los personajes: en vertical, según el ancho
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }

  return {
    /** Empieza a animar en el canvas c. Se anima siempre, también con «reducir animaciones» activado en el sistema
        (muchos móviles lo activan con el ahorro de batería y entonces la pantalla de carga se quedaba quieta) */
    start(c) {
      cv = c; ctx = c.getContext && c.getContext('2d');
      if (!ctx || on) return;
      resize(); setup(); on = true; t = 0;
      last = performance.now(); raf = requestAnimationFrame(frame);
    },
    /** Para la animación (al entrar en el juego) */
    stop() { on = false; cancelAnimationFrame(raf); }
  };
})();
