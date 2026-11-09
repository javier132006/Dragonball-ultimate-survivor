/* =====================================================================
   shenron.js · Shenron dibujado a mano en canvas 2D (sin imágenes)
   - Shenron.draw(ctx, pts, w, t): dibuja el dragón siguiendo una «columna»
     de puntos (de la cabeza a la cola) con grosor w.
   - Shenron.summon(opts): invocación a pantalla completa (cielo oscuro,
     7 esferas, rayos, el dragón sube en espiral y concede el premio).
   - Shenron.Flyer: el dragón cruzando el cielo del mapa del inicio.
   ===================================================================== */
const Shenron = (() => {
  const C = { body: '#2f9a3c', light: '#55c25a', dark: '#0e3a15', belly: '#efdc8c', bellyD: '#b9a256', scale: '#1d6b29', spike: '#46b84f', horn: '#e6d08a', hornD: '#8a7438', eye: '#ff2a1a' };

  /* ---------- Curvas: Catmull-Rom remuestreada por longitud ---------- */
  /** Convierte unos puntos de control en una polilínea densa con distancias acumuladas */
  function spline(ctrl, steps) {
    const out = [];
    for (let i = 0; i < ctrl.length - 1; i++) {
      const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
      for (let k = 0; k < steps; k++) {
        const t = k / steps, t2 = t * t, t3 = t2 * t;
        out.push({
          x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
        });
      }
    }
    out.push({ x: ctrl[ctrl.length - 1].x, y: ctrl[ctrl.length - 1].y });
    let d = 0; out[0].d = 0;
    for (let i = 1; i < out.length; i++) { d += Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y); out[i].d = d; }
    return out;
  }
  /** Punto de la polilínea a una distancia s (con interpolación) */
  function at(path, s) {
    const L = path[path.length - 1].d;
    if (s <= 0) return { x: path[0].x, y: path[0].y };
    if (s >= L) return { x: path[path.length - 1].x, y: path[path.length - 1].y };
    let lo = 0, hi = path.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (path[m].d < s) lo = m; else hi = m; }
    const a = path[lo], b = path[hi], k = (s - a.d) / (b.d - a.d || 1);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  }
  /** Columna del dragón: n puntos desde la cabeza (distancia head) hacia atrás, con una ondulación viva */
  function spine(path, head, len, n, t, w, wave) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const s = head - (i / (n - 1)) * len, p = at(path, s), q = at(path, s - 4);
      const dx = p.x - q.x, dy = p.y - q.y, l = Math.hypot(dx, dy) || 1, o = Math.sin(t * 2.4 - i * 0.32) * w * (wave == null ? 0.18 : wave) * Math.min(1, i / 6);
      pts.push({ x: p.x - (dy / l) * o, y: p.y + (dx / l) * o });
    }
    return pts;
  }

  /* ---------- Dibujo ---------- */
  /** Grosor del cuerpo en cada punto (s: 0 cabeza → 1 cola) */
  const thick = (s) => s < 0.08 ? 0.78 + s * 2.5 : s < 0.55 ? 0.98 + Math.sin(s * 6) * 0.03 : Math.max(0.12, 1 - (s - 0.55) / 0.45 * 0.9);

  function draw(ctx, pts, w, t, opt) {
    opt = opt || {};
    const n = pts.length;
    if (n < 4) return;
    // Normales y bordes del cuerpo
    const L = [], R = [], N = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let dx = a.x - b.x, dy = a.y - b.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const h = w * thick(i / (n - 1)) * 0.5;
      N.push({ x: -dy, y: dx, tx: dx, ty: dy, h });
      L.push({ x: pts[i].x - dy * h, y: pts[i].y + dx * h });
      R.push({ x: pts[i].x + dy * h, y: pts[i].y - dx * h });
    }
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // Halo dorado (barato: trazo ancho semitransparente)
    if (opt.glow !== false) {
      const ga = opt.glowA || 0.16;
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < n; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.strokeStyle = 'rgba(255,226,110,' + ga * 0.5 + ')'; ctx.lineWidth = w * 1.9; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,170,' + ga + ')'; ctx.lineWidth = w * 1.35; ctx.stroke();
    }
    // Patas (por debajo del cuerpo)
    for (const k of [0.16, 0.42]) limb(ctx, pts, N, Math.round(k * (n - 1)), w, t, k);
    // Cuerpo: de la cola a la cabeza, segmento a segmento (así las vueltas se tapan unas a otras)
    for (let i = n - 2; i >= 0; i--) {
      const a = i, b = i + 1, s = i / (n - 1);
      // Púas del lomo (lado R)
      if (i % 3 === 0 && s > 0.06 && s < 0.9) {
        const h = N[a].h, len = h * 0.9 * (1 - s * 0.6);
        ctx.beginPath();
        ctx.moveTo(R[b].x, R[b].y);
        ctx.lineTo(R[a].x + N[a].x * -len + N[a].tx * len * 0.8, R[a].y + N[a].y * -len + N[a].ty * len * 0.8);
        ctx.lineTo(R[a].x - N[a].tx * h * 0.3, R[a].y - N[a].ty * h * 0.3);
        ctx.closePath(); ctx.fillStyle = C.spike; ctx.fill(); ctx.strokeStyle = C.dark; ctx.lineWidth = Math.max(1.5, w * 0.05); ctx.stroke();
      }
      // Tramo del cuerpo
      const g = ctx.createLinearGradient(R[a].x, R[a].y, L[a].x, L[a].y);
      g.addColorStop(0, C.dark); g.addColorStop(0.18, C.body); g.addColorStop(0.42, C.light); g.addColorStop(0.62, C.body); g.addColorStop(1, '#1f7a2c');
      ctx.beginPath(); ctx.moveTo(L[a].x, L[a].y); ctx.lineTo(L[b].x, L[b].y); ctx.lineTo(R[b].x, R[b].y); ctx.lineTo(R[a].x, R[a].y); ctx.closePath();
      ctx.fillStyle = g; ctx.fill();
      // Vientre (franja crema con pliegues) en el lado L
      const ba = 0.62, bb = 0.95;
      const p1x = pts[a].x + (L[a].x - pts[a].x) * ba, p1y = pts[a].y + (L[a].y - pts[a].y) * ba, p2x = pts[b].x + (L[b].x - pts[b].x) * ba, p2y = pts[b].y + (L[b].y - pts[b].y) * ba;
      const q1x = pts[a].x + (L[a].x - pts[a].x) * bb, q1y = pts[a].y + (L[a].y - pts[a].y) * bb, q2x = pts[b].x + (L[b].x - pts[b].x) * bb, q2y = pts[b].y + (L[b].y - pts[b].y) * bb;
      if (s < 0.95) {
        ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.lineTo(p2x, p2y); ctx.lineTo(q2x, q2y); ctx.lineTo(q1x, q1y); ctx.closePath(); ctx.fillStyle = C.belly; ctx.fill();
        if (i % 2 === 0) { ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.lineTo(q1x, q1y); ctx.strokeStyle = C.bellyD; ctx.lineWidth = Math.max(1, w * 0.035); ctx.stroke(); }
      }
      // Escamas (pequeñas «V» en el lomo)
      if (i % 2 === 1 && s < 0.92) {
        const m = 0.25, cx = pts[a].x + (R[a].x - pts[a].x) * m, cy = pts[a].y + (R[a].y - pts[a].y) * m, hh = N[a].h * 0.32;
        ctx.beginPath(); ctx.moveTo(cx + N[a].x * hh - N[a].tx * hh, cy + N[a].y * hh - N[a].ty * hh); ctx.lineTo(cx - N[a].tx * hh * -0.2, cy - N[a].ty * hh * -0.2); ctx.lineTo(cx - N[a].x * hh - N[a].tx * hh, cy - N[a].y * hh - N[a].ty * hh);
        ctx.strokeStyle = C.scale; ctx.lineWidth = Math.max(1, w * 0.045); ctx.stroke();
      }
      // Contorno lateral (solo los lados, sin costuras entre tramos)
      ctx.strokeStyle = C.dark; ctx.lineWidth = Math.max(1.6, w * 0.07);
      ctx.beginPath(); ctx.moveTo(L[a].x, L[a].y); ctx.lineTo(L[b].x, L[b].y); ctx.moveTo(R[a].x, R[a].y); ctx.lineTo(R[b].x, R[b].y); ctx.stroke();
    }
    // Punta de la cola: penacho
    const e = pts[n - 1], e2 = pts[n - 4], ang = Math.atan2(e.y - e2.y, e.x - e2.x);
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(ang);
    ctx.fillStyle = C.spike; ctx.strokeStyle = C.dark; ctx.lineWidth = Math.max(1.5, w * 0.05);
    ctx.beginPath(); ctx.moveTo(-w * 0.1, 0); ctx.quadraticCurveTo(w * 0.5, -w * 0.5, w * 0.9, -w * 0.15); ctx.quadraticCurveTo(w * 0.45, 0, w * 0.9, w * 0.2); ctx.quadraticCurveTo(w * 0.45, w * 0.45, -w * 0.1, 0); ctx.fill(); ctx.stroke();
    ctx.restore();
    // Cabeza
    head(ctx, pts, w, t, opt);
    ctx.restore();
  }

  /** Pata con tres garras, saliendo del lado del vientre */
  function limb(ctx, pts, N, i, w, t, k) {
    if (i < 1 || i >= pts.length - 1) return;
    const p = pts[i], nn = N[i], sw = Math.sin(t * 3 + k * 9) * 0.25;
    const ox = p.x + nn.x * nn.h * 0.7, oy = p.y + nn.y * nn.h * 0.7;
    const kx = ox + (nn.x * 0.55 - nn.tx * 0.15) * w, ky = oy + (nn.y * 0.55 - nn.ty * 0.15) * w;          // codo
    const ex = kx + (nn.x * 0.2 + nn.tx * (0.45 + sw)) * w, ey = ky + (nn.y * 0.2 + nn.ty * (0.45 + sw)) * w;
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(kx, ky); ctx.lineTo(ex, ey);
    ctx.strokeStyle = C.dark; ctx.lineWidth = w * 0.34; ctx.stroke();
    ctx.strokeStyle = C.body; ctx.lineWidth = w * 0.22; ctx.stroke();
    for (let c = -1; c <= 1; c++) {
      const a = Math.atan2(ey - oy, ex - ox) + c * 0.55;
      ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(a) * w * 0.3, ey + Math.sin(a) * w * 0.3);
      ctx.strokeStyle = '#f4ecd0'; ctx.lineWidth = Math.max(1.5, w * 0.07); ctx.stroke();
    }
  }

  /** Cabeza de perfil: hocico largo, cuernos, bigotes, crin y ojos rojos */
  function head(ctx, pts, w, t, opt) {
    const p = pts[0], q = pts[2];
    let ang = Math.atan2(p.y - q.y, p.x - q.x);
    if (opt.headAng != null) ang = opt.headAng;
    const flip = Math.cos(ang) < 0 ? -1 : 1;
    const s = w * 0.95, lw = Math.max(1.6, w * 0.06);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang); ctx.scale(s, s * flip);
    const L = lw / s;
    ctx.lineWidth = L; ctx.strokeStyle = C.dark; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // Crin de púas detrás de la cabeza
    ctx.fillStyle = '#237d30';
    ctx.beginPath(); ctx.moveTo(0.4, -0.6);
    ctx.lineTo(-0.5, -1.25); ctx.lineTo(-0.2, -0.7); ctx.lineTo(-1.05, -1.05); ctx.lineTo(-0.45, -0.35); ctx.lineTo(-1.25, -0.45); ctx.lineTo(-0.5, 0.05); ctx.lineTo(-1.1, 0.35); ctx.lineTo(-0.3, 0.45);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Cuernos (astas ramificadas)
    ctx.strokeStyle = C.hornD; ctx.lineWidth = 0.36;
    const horn = (x0, y0, x1, y1, bx, by) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + 0.2, y1 + 0.35, x1, y1); ctx.stroke(); ctx.beginPath(); ctx.moveTo((x0 + x1) / 2 + 0.05, (y0 + y1) / 2 - 0.05); ctx.lineTo(bx, by); ctx.stroke(); };
    horn(0.25, -0.55, -1.25, -1.75, -0.35, -1.95); horn(0.55, -0.6, -0.75, -2.05, 0.05, -2.2);
    ctx.strokeStyle = C.horn; ctx.lineWidth = 0.2;
    horn(0.25, -0.55, -1.25, -1.75, -0.35, -1.95); horn(0.55, -0.6, -0.75, -2.05, 0.05, -2.2);
    // Mandíbula inferior (se abre un poco al rugir)
    const open = opt.roar ? 0.25 + Math.abs(Math.sin(t * 9)) * 0.15 : 0.05 + Math.sin(t * 1.3) * 0.03;
    ctx.save(); ctx.translate(0.55, 0.25); ctx.rotate(open);
    ctx.beginPath(); ctx.moveTo(-0.6, 0.1); ctx.quadraticCurveTo(0.4, 0.05, 1.45, 0.02); ctx.quadraticCurveTo(1.55, 0.2, 1.35, 0.32); ctx.quadraticCurveTo(0.4, 0.5, -0.6, 0.45); ctx.closePath();
    ctx.fillStyle = C.body; ctx.fill(); ctx.lineWidth = L; ctx.strokeStyle = C.dark; ctx.stroke();
    ctx.fillStyle = '#fff';                                                      // dientes de abajo
    for (let k = 0; k < 4; k++) { const x = 0.25 + k * 0.3; ctx.beginPath(); ctx.moveTo(x, 0.04); ctx.lineTo(x + 0.08, -0.14); ctx.lineTo(x + 0.16, 0.04); ctx.fill(); }
    // Barba
    ctx.strokeStyle = '#1c6a27'; ctx.lineWidth = 0.09;
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-0.2 + k * 0.25, 0.42); ctx.quadraticCurveTo(-0.3 + k * 0.2, 0.9, -0.6 + k * 0.15 + Math.sin(t * 2 + k) * 0.08, 1.15); ctx.stroke(); }
    ctx.restore();
    // Cráneo y hocico
    const g = ctx.createLinearGradient(0, -0.7, 0, 0.4); g.addColorStop(0, C.light); g.addColorStop(0.55, C.body); g.addColorStop(1, '#22802f');
    ctx.beginPath();
    ctx.moveTo(-0.45, -0.45);
    ctx.quadraticCurveTo(0.2, -0.85, 0.85, -0.68);            // frente
    ctx.quadraticCurveTo(1.05, -0.5, 1.3, -0.42);             // entrecejo
    ctx.quadraticCurveTo(1.85, -0.38, 2.15, -0.2);            // hocico
    ctx.quadraticCurveTo(2.35, -0.05, 2.18, 0.12);            // nariz
    ctx.quadraticCurveTo(1.4, 0.3, 0.55, 0.32);               // labio superior
    ctx.quadraticCurveTo(-0.2, 0.42, -0.5, 0.3);
    ctx.closePath(); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = L; ctx.strokeStyle = C.dark; ctx.stroke();
    // Dientes de arriba y colmillo
    ctx.fillStyle = '#fff';
    for (let k = 0; k < 5; k++) { const x = 0.75 + k * 0.27; ctx.beginPath(); ctx.moveTo(x, 0.27 - k * 0.02); ctx.lineTo(x + 0.07, 0.45 - k * 0.02); ctx.lineTo(x + 0.14, 0.26 - k * 0.02); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(1.85, 0.16); ctx.lineTo(1.93, 0.5); ctx.lineTo(2.02, 0.15); ctx.fill();
    // Escamas de la frente y del hocico
    ctx.strokeStyle = C.scale; ctx.lineWidth = 0.05;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(1.35 + k * 0.22, -0.25, 0.09, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    // Fosa nasal
    ctx.fillStyle = C.dark; ctx.beginPath(); ctx.ellipse(2.05, -0.12, 0.07, 0.04, -0.4, 0, Math.PI * 2); ctx.fill();
    // Ceja (cresta oscura) y ojo rojo que brilla
    ctx.fillStyle = '#16521f'; ctx.beginPath(); ctx.moveTo(0.35, -0.6); ctx.quadraticCurveTo(0.85, -0.78, 1.25, -0.48); ctx.quadraticCurveTo(0.85, -0.55, 0.45, -0.42); ctx.closePath(); ctx.fill();
    const gl = 0.75 + Math.sin(t * 4) * 0.25;
    ctx.fillStyle = 'rgba(255,60,30,' + 0.35 * gl + ')'; ctx.beginPath(); ctx.ellipse(0.82, -0.36, 0.34, 0.2, -0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.eye; ctx.beginPath(); ctx.ellipse(0.82, -0.36, 0.2, 0.1, -0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.ellipse(0.86, -0.38, 0.06, 0.035, -0.15, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 0.045; ctx.strokeStyle = '#5a0a05'; ctx.beginPath(); ctx.ellipse(0.82, -0.36, 0.2, 0.1, -0.15, 0, Math.PI * 2); ctx.stroke();
    // Bigotes largos que ondean
    ctx.strokeStyle = '#1b5e25'; ctx.lineWidth = 0.08;
    for (const [y0, k] of [[-0.05, 0], [0.08, 1]]) {
      const wv = Math.sin(t * 2.2 + k * 1.7);
      ctx.beginPath(); ctx.moveTo(2.0, y0);
      ctx.bezierCurveTo(1.3, -0.9 - k * 0.3 + wv * 0.3, 0.2, -1.4 + wv * 0.4, -1.4 - k * 0.4, -0.9 + wv * 0.6 + k * 0.5);
      ctx.bezierCurveTo(-2.2, -0.6 + wv * 0.5, -2.8, -1.1, -3.2 - k * 0.3, -0.6 + wv * 0.4);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Bola de dragón (para la invocación): n estrellas */
  function ball(ctx, x, y, r, n, glow) {
    if (glow) { const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 3); g.addColorStop(0, 'rgba(255,190,60,' + 0.5 * glow + ')'); g.addColorStop(1, 'rgba(255,150,30,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI * 2); ctx.fill(); }
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, '#fffbe0'); g.addColorStop(0.18, '#ffe27a'); g.addColorStop(0.6, '#ffa21a'); g.addColorStop(1, '#b84a00');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d8141c';
    const pos = [[[0, 0]], [[-.3, -.15], [.3, .15]], [[0, -.32], [-.3, .2], [.3, .2]], [[-.28, -.28], [.28, -.28], [-.28, .28], [.28, .28]], [[0, 0], [-.32, -.32], [.32, -.32], [-.32, .32], [.32, .32]], [[-.3, -.32], [.3, -.32], [-.3, 0], [.3, 0], [-.3, .32], [.3, .32]], [[0, 0], [0, -.38], [0, .38], [-.33, -.19], [.33, -.19], [-.33, .19], [.33, .19]]][n - 1];
    for (const [sx, sy] of pos) star(ctx, x + sx * r, y + sy * r, r * 0.17);
  }
  function star(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  }

  /* ---------- Invocación a pantalla completa ---------- */
  let active = null;
  /**
   * opts: { title, sub, html (contenido del premio), btn (texto del botón), short (sin premio, se cierra sola), onDone }
   */
  function summon(opts) {
    opts = opts || {};
    if (active) active.close(true);
    const root = document.createElement('div');
    root.id = 'shenron';
    root.innerHTML = '<canvas></canvas><div class="shx"><div class="shk">' + (opts.kicker || '¡Las 7 Bolas de Dragón!') + '</div><h2>' + (opts.title || '¡Sal, Shenron!') + '</h2>' + (opts.sub ? '<p class="shs">' + opts.sub + '</p>' : '') +
      (opts.html ? '<div class="shr">' + opts.html + '</div>' : '') + (opts.short ? '' : '<button class="shb">' + (opts.btn || '¡Gracias, Shenron!') + '</button>') + '</div><span class="shskip">' + (opts.short ? '' : 'Toca para saltar') + '</span>';
    document.body.appendChild(root);
    const cv = root.querySelector('canvas'), ctx = cv.getContext('2d'), txt = root.querySelector('.shx');
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const S = { t: reduce ? 3 : 0, last: performance.now(), done: false, out: 0, path: null, W: 0, H: 0, dpr: 1, bolts: [] };
    const DUR = opts.short ? 1.6 : 2.3;                                             // segundos hasta que aparece el texto
    function fit() {
      S.dpr = Math.min(2, window.devicePixelRatio || 1);
      S.W = innerWidth; S.H = innerHeight; cv.width = S.W * S.dpr; cv.height = S.H * S.dpr;
      const W = S.W, H = S.H, side = W > H * 1.3 ? 1 : 0;
      // Recorrido: sale de las esferas, sube en eses y termina con la cabeza mirando a un lado
      const cx = side ? W * 0.3 : W * 0.5;              // en horizontal: dragón a la izquierda y texto a la derecha
      S.cx = cx;
      // Eses suaves (seno) de abajo arriba y, al final, la cabeza gira hacia un lado
      const A = Math.min(side ? W * 0.13 : W * 0.22, H * 0.36), ctrl = [];
      for (let i = 0; i <= 40; i++) { const u = i / 40; ctrl.push({ x: cx + A * Math.sin(u * Math.PI * 2.6) * (0.55 + 0.45 * Math.min(1, u * 3)) * (1 - u * 0.25), y: H * (1.04 - 0.8 * u) }); }
      const last = ctrl[ctrl.length - 1];
      ctrl.push({ x: last.x - A * 0.18, y: last.y - H * 0.03 }, { x: last.x - A * 0.42, y: last.y - H * 0.02 });
      S.path = spline(ctrl, 6);
      S.w = Math.max(26, Math.min(W, H * 1.8) * 0.055);
    }
    fit();
    const onResize = () => fit();
    window.addEventListener('resize', onResize);
    if (typeof SFX !== 'undefined') SFX.play('shenron');
    function frame(now) {
      if (S.done) return;
      const dt = Math.min(0.12, (now - S.last) / 1000); S.last = now; S.t += dt;              // (tope alto: en móviles lentos no se alarga)
      const W = S.W, H = S.H, t = S.t;
      ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
      // Cielo oscurecido (verde noche) con destellos de rayos
      const dark = Math.min(1, t / 0.5) * (1 - S.out);
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, 'rgba(6,20,14,' + 0.94 * dark + ')'); sky.addColorStop(0.6, 'rgba(10,34,22,' + 0.92 * dark + ')'); sky.addColorStop(1, 'rgba(30,24,6,' + 0.9 * dark + ')');
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      if (Math.random() < (t < DUR ? 0.06 : 0.012) && S.out === 0) S.bolts.push({ x: Math.random() * W, life: 0.18 });
      for (const b of S.bolts) {
        b.life -= dt; if (b.life <= 0) continue;
        ctx.fillStyle = 'rgba(220,255,200,' + b.life * 0.5 + ')'; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(230,255,190,' + b.life * 5 + ')'; ctx.lineWidth = 3; ctx.beginPath(); let x = b.x, y = 0; ctx.moveTo(x, y);
        while (y < H * 0.5) { x += (Math.random() - 0.5) * 60; y += 20 + Math.random() * 30; ctx.lineTo(x, y); } ctx.stroke();
      }
      S.bolts = S.bolts.filter((b) => b.life > 0);
      // Las 7 esferas en el suelo, brillando
      const by = H * 0.9, br = Math.max(11, Math.min(W, H) * 0.028), glow = 0.6 + Math.sin(t * 6) * 0.4;
      ctx.globalAlpha = 1 - S.out;
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 - Math.PI / 2, rx = br * 4.2, ry = br * 1.4; ball(ctx, S.cx + Math.cos(a) * rx, by + Math.sin(a) * ry, br, i + 1, glow * (t < DUR ? 1 : 0.4)); }
      // Columna de luz al empezar
      if (t > 0.3 && t < DUR + 0.4) { const a = Math.min(1, (t - 0.3) * 3) * Math.max(0, 1 - (t - DUR) / 0.4); const g = ctx.createLinearGradient(S.cx - 60, 0, S.cx + 60, 0); g.addColorStop(0, 'rgba(255,230,120,0)'); g.addColorStop(0.5, 'rgba(255,240,170,' + 0.55 * a + ')'); g.addColorStop(1, 'rgba(255,230,120,0)'); ctx.fillStyle = g; ctx.fillRect(S.cx - 60, 0, 120, by); }
      // El dragón
      const L = S.path[S.path.length - 1].d, p = Math.min(1, Math.max(0, (t - 0.45) / (DUR - 0.45))), e = 1 - Math.pow(1 - p, 3);
      if (p > 0) {
        const headS = L * e, len = L * 0.96, n = 72;
        const pts = spine(S.path, headS, len, n, t, S.w, p < 1 ? 0.12 : 0.22);
        // La parte del cuerpo que aún no ha salido queda escondida en el haz de las esferas
        const vis = pts.filter((q, i) => headS - (i / (n - 1)) * len > -8);
        if (vis.length > 4) draw(ctx, vis, S.w, t, { roar: p > 0.85 && t < DUR + 0.8, headAng: p >= 1 ? Math.PI - 0.12 + Math.sin(t * 1.2) * 0.05 : null });
      }
      ctx.globalAlpha = 1;
      if (t > DUR && !txt.classList.contains('on')) { txt.classList.add('on'); if (opts.short) setTimeout(() => api.close(), 1100); }
      if (S.out > 0) { S.out = Math.min(1, S.out + dt * 2.5); root.style.opacity = String(1 - S.out); if (S.out >= 1) { api.close(true); return; } }
      requestAnimationFrame(frame);
    }
    const api = {
      close(now) {
        if (S.done) return;
        if (!now) { if (S.out === 0) S.out = 0.001; return; }
        S.done = true; window.removeEventListener('resize', onResize); root.remove(); active = null;
        if (opts.onDone) opts.onDone();
      },
      skip() { if (S.t < DUR) S.t = DUR; }
    };
    root.addEventListener('click', (ev) => {
      if (ev.target.closest('.shb')) { api.close(); return; }
      if (S.t < DUR) api.skip(); else if (opts.short) api.close();
    });
    // Teclado / mando: Intro, Espacio o Escape saltan la animación y luego cierran (sin que el juego reciba la tecla)
    const onKey = (ev) => {
      if (!['Enter', 'Space', 'Escape', 'KeyE'].includes(ev.code)) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      if (ev.type !== 'keydown' || ev.repeat) return;
      if (S.t < DUR) api.skip(); else api.close();
    };
    window.addEventListener('keydown', onKey, true); window.addEventListener('keyup', onKey, true);
    const close0 = api.close;
    api.close = (now) => { if (now) { window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKey, true); } close0(now); };
    active = api;
    requestAnimationFrame((n) => { S.last = n; frame(n); });
    return api;
  }

  /* ---------- Shenron cruzando el cielo (fondo del inicio) ---------- */
  class Flyer {
    constructor() { this.t = 0; this.wait = 6; this.on = false; }
    /** Avanza y dibuja; sky = { x0, x1, y, h } zona del cielo en píxeles */
    update(ctx, dt, sky) {
      this.t += dt;
      if (!this.on) { this.wait -= dt; if (this.wait > 0) return; this.start(sky); }
      this.head += this.speed * dt;
      const pts = spine(this.path, this.head, this.len, 46, this.t, this.w, 0.25);
      ctx.save(); ctx.globalAlpha = 0.92; draw(ctx, pts, this.w, this.t, { glowA: 0.16 }); ctx.restore();
      if (this.head - this.len > this.path[this.path.length - 1].d) { this.on = false; this.wait = 22 + Math.random() * 14; }
    }
    start(sky) {
      const dir = Math.random() < 0.5 ? 1 : -1, W = sky.x1 - sky.x0, ctrl = [];
      for (let i = 0; i <= 8; i++) { const k = i / 8; ctrl.push({ x: dir > 0 ? sky.x0 - W * 0.12 + k * W * 1.7 : sky.x1 + W * 0.12 - k * W * 1.7, y: sky.y + sky.h * (0.5 + Math.sin(k * 7 + Math.random()) * 0.35) }); }
      this.path = spline(ctrl, 16); this.w = Math.max(12, sky.h * 0.11); this.len = W * 0.42; this.head = 0; this.speed = W * 0.16; this.on = true; this.t = 0;
    }
  }

  return { draw, spine, spline, at, summon, Flyer, ball, isOpen: () => !!active };
})();
