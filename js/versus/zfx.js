/* ============================================================================
   Motor de efectos de Z Legends 3: un trozo de Construct 2 para los objetos que crean las técnicas.
   En el original casi ningún poder es «una bola que va hacia el rival»: es un objeto con su animación, su
   comportamiento (Bullet, Fade, Sine...), sus variables y sus propios eventos («si esta bola toca al rival y su
   variable 0 vale 2: quítale 10 de vida, cámbiale la animación a Dano_Aereo3 y crea una explosión»).
   Esos eventos salen tal cual de su hoja (tools/make_zl3_choreo.py -> assets/zl3/m/fxl.js, window.ZFXL) y aquí se
   ejecutan como en Construct 2: instancias, selección de instancias por condición (SOL), disparadores
   (al acabar la animación, al crearse, al destruirse...), «Wait» con su selección guardada y comportamientos.

   Mundo de un efecto: el plano del atacante de su técnica (zchoreo.js: x hacia el rival, y hacia abajo, en
   píxeles del escenario del original). Los eventos del original hablan del jugador (A, AV, F0:<luchador>) y del
   rival (T, TV, F1:<luchador>): cada efecto vive en el lado del original del que salió su técnica (os 0 / 1) y
   aquí se traduce a «quien lanzó la técnica» y «su víctima», con sus números de personaje (Jogador / Inimigo).
   Es determinista: el online sigue igual en los dos lados.
   ============================================================================ */
const ZE = {
  /** ¿Está cargada la lógica de efectos? (si no, zchoreo.js usa sus aproximaciones) */
  on() { return typeof window !== 'undefined' && !!window.ZFXL && !!window.ZFXL.ev; },
  ix: null,
  SKIP: new Set(['defesa_effect_sprite']),          // su lógica sigue en la técnica (postura de contraataque)
  LW: 1708, LH: 960,                                // tamaño del escenario del original
  /** Índice: qué bloques mirar según los tipos de efecto que hay vivos; y qué efectos hacen daño (o crean otros que lo hacen) */
  build() {
    if (this.ix) return this.ix;
    const X = window.ZFXL, T = X.ty, by = new Map(), always = [], harm = new Set(), spawns = new Map(), fn = new Map();
    const isE = (w) => !!T[w];
    X.ev.forEach((t, i) => {
      t.i = i;
      // tipos de efecto que tiene que haber para que se cumpla: los del primer nivel que pregunta por alguno (bajando por los que solo tienen un hijo)
      let n = t, g = [], any = false;
      for (let d = 0; d < 8 && n; d++) {
        g = [...new Set(n.c.filter((c) => isE(c[0])).map((c) => c[0]))]; any = any || !!n.or;
        if (g.length || n.a || !n.s || n.s.length !== 1) break;
        n = n.s[0];
      }
      t.g = g; t.ga = any;
      const F = t.c.find((c) => c[0] === 'Fn' && c[1] === 'OnFunction' && c[4][0]);
      if (F) { const k = F[4][0][1]; if (!fn.has(k)) fn.set(k, []); fn.get(k).push(t); }   // bloques de una función: solo se ejecutan al llamarla
      else if (!g.length) always.push(t); else for (const k of any ? g : [g[0]]) { if (!by.has(k)) by.set(k, []); by.get(k).push(t); }
      const s = JSON.stringify(t);
      if (/\["[AT]","SubInstanceVar","",\[\["n",0\]/.test(s)) { const all = new Set(); const walk = (q) => { for (const c of q.c) if (isE(c[0])) all.add(c[0]); (q.s || []).forEach(walk); }; walk(t); for (const k of all) harm.add(k); }
      for (const m of s.match(/"(?:Spawn|CreateObject)","",\[\["o","[^"]+"/g) || []) { const k = m.split('"o","')[1].slice(0, -1); for (const p of g) { if (!spawns.has(p)) spawns.set(p, new Set()); spawns.get(p).add(k); } }
    });
    for (let n = 0; n < 6; n++) for (const [p, S] of spawns) if (!harm.has(p) && [...S].some((k) => harm.has(k))) harm.add(p);   // crea algo que hace daño
    return (this.ix = { by, always, harm, fn });
  },
  cmp: (a, op, b) => ZC_CMP(a, op, b),
  /** Fotograma actual de una instancia: [duración, ancho, alto, x del punto de apoyo, y, [puntos de imagen]] */
  frame(i) { const A = window.ZFXL.ty[i.k].an[i.an]; return A && A[3][Math.min(i.fi, A[3].length - 1)] || null; },
  /** Rectángulo de choque del fotograma desde el punto de apoyo, ya escalado y reflejado: el de su polígono de colisión (o el dibujo entero) */
  rect(i, F) {
    const sx = Math.abs(i.sx), sy = Math.abs(i.sy), C = F[6];
    let l, r, t, b;
    if (C) { l = C[0] * sx; t = C[1] * sy; r = C[2] * sx; b = C[3] * sy; } else { l = -F[3] * sx; t = -F[4] * sy; r = l + F[1] * sx; b = t + F[2] * sy; }
    return i.mir ? [-r, t, -l, b] : [l, t, r, b];
  },
  /** Caja (si está girada, la envolvente) */
  box(i) {
    const F = this.frame(i); if (!F) return [i.x - 8, i.y - 8, i.x + 8, i.y + 8];
    let [l, t, r, b] = this.rect(i, F);
    if (i.ang) {
      const a = i.ang * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), P = [[l, t], [r, t], [l, b], [r, b]].map(([x, y]) => [x * c - y * s, x * s + y * c]);
      l = Math.min(...P.map((p) => p[0])); r = Math.max(...P.map((p) => p[0])); t = Math.min(...P.map((p) => p[1])); b = Math.max(...P.map((p) => p[1]));
    }
    return [i.x + l, i.y + t, i.x + r, i.y + b];
  },
  /** Punto de imagen n (1 = el primero; 0 = el origen) de una instancia, girado con ella */
  ip(i, n) {
    const F = this.frame(i), L = F && F[5]; if (!L || !(n >= 1)) return [i.x, i.y];
    const q = L[Math.min(L.length, n) - 1]; let ox = q[0] * Math.abs(i.sx) * (i.mir ? -1 : 1), oy = q[1] * Math.abs(i.sy);
    if (i.ang) { const a = i.ang * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); [ox, oy] = [ox * c - oy * s, ox * s + oy * c]; }
    return [i.x + ox, i.y + oy];
  },
  /** Rectángulo girado de una instancia: sus 4 esquinas */
  quad(i) {
    const F = this.frame(i); if (!F) return [[i.x - 8, i.y - 8], [i.x + 8, i.y - 8], [i.x + 8, i.y + 8], [i.x - 8, i.y + 8]];
    const [l, t, r, b] = this.rect(i, F), P = [[l, t], [r, t], [r, b], [l, b]];
    if (!i.ang) return P.map(([x, y]) => [i.x + x, i.y + y]);
    const a = i.ang * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return P.map(([x, y]) => [i.x + x * c - y * s, i.y + x * s + y * c]);
  },
  q4: (b) => [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]],
  /** ¿Se tocan dos rectángulos (girados)? Separación por ejes */
  sat(P, Q) {
    for (const R of [P, Q]) for (let k = 0; k < 4; k++) {
      const a = R[k], b = R[(k + 1) % 4], nx = a[1] - b[1], ny = b[0] - a[0];
      let p0 = Infinity, p1 = -Infinity, q0 = Infinity, q1 = -Infinity;
      for (const v of P) { const d = v[0] * nx + v[1] * ny; if (d < p0) p0 = d; if (d > p1) p1 = d; }
      for (const v of Q) { const d = v[0] * nx + v[1] * ny; if (d < q0) q0 = d; if (d > q1) q1 = d; }
      if (p1 <= q0 || q1 <= p0) return false;
    }
    return true;
  },
  /** Instancia contra instancia o contra la caja [l, t, r, b] de un luchador */
  hit(i, o) { return Array.isArray(o) ? (i.ang ? this.sat(this.quad(i), this.q4(o)) : this.ovl(this.box(i), o)) : (i.ang || o.ang ? this.sat(this.quad(i), this.quad(o)) : this.ovl(this.box(i), this.box(o))); },
  ovl: (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1],
  /** ¿Fuera del escenario? El del original (1708 × 960) con margen: el atacante está siempre en el centro y la arena es más grande */
  out(i) { const b = this.box(i); return b[2] < ZC.X0 - 1150 || b[0] > ZC.X0 + 1150 || b[3] < -350 || b[1] > this.LH + 250; }
};

Object.assign(VsSim.prototype, {
  /* ---------- mundos e instancias ---------- */
  zeWorld(z, os) {
    if (!z.W) z.W = [null, null];
    if (!z.W[os]) { const w = z.W[os] = { z, os: os ? 1 : 0, I: [], n: 0, tt: 0, tk: new Map(), ev: new Map(), wt: [], ot: 0 }; (this.zW || (this.zW = [])).push(w); }
    return z.W[os];
  },
  /** Crea una instancia de un efecto en (X, Y) del escenario del original */
  zeNew(w, k, X, Y, ang) {
    const T = window.ZFXL.ty[k]; if (!T || ZE.SKIP.has(k)) return null;
    if (w.I.length > 70) { const o = w.I.find((q) => !q.dead); if (o) this.zeKill(w, o); }
    const i = { k, uid: (this.zeU = (this.zeU || 0) + 1), x: X, y: Y, ang: ang || 0, an: T.a0, fi: 0, ft: 0, fps: null, play: 1, sx: T.sc, sy: T.sc, mir: 0, vis: T.vis, op: 1,
      v: T.v.slice(), cp: w.n, dead: 0, age: 0, fin: -9, fch: -9, fwe: -9, used: new Map(), w };
    const B = T.b;
    if (B.Bullet) { const b = B.Bullet; i.bu = { sp: b[0] || 0, acc: b[1] || 0, g: b[2] || 0, sa: b[4] !== 0, en: b[5] !== 0, a: 0, la: 0, vg: 0 }; }   // la dirección: la de la plantilla (0°)
    if (B.Fade) { const b = B.Fade; i.fd = { on: b[0] !== 0, fin: b[1] || 0, wait: b[2] || 0, fout: b[3] || 0, des: b[4] !== 0, t: 0 }; if (i.fd.on && i.fd.fin > 0) i.op = 0; }
    if (B.Sine) { const b = B.Sine; i.sn = { on: !!b[0], mv: b[1] || 0, per: b[3] || 1, mag: b[7] || 0, t: (b[5] || 0), last: 0 }; }
    if (B.DestroyOutsideLayout) i.dol = 1;
    w.I.push(i); w.z.zeN = (w.z.zeN || 0) + 1;
    if (ZE.build().harm.has(k)) w.z.kb = 1;                             // su daño va en el efecto: sin golpe genérico
    return i;
  },
  zeKill(w, i) { if (i.dead) return; i.dead = w.n || 1; if (window.ZEDBG) ZEDBG.push(w.n + ' kill ' + i.uid + ' ' + i.k + ' blk ' + this.zeB + (ZEDBG.st && this.zeT ? ' ' + JSON.stringify(this.zeT.c).slice(0, 300) : '')); },
  zeSetAnim(i, name, from) {
    const A = window.ZFXL.ty[i.k].an[name]; if (!A) return;
    if (i.an === name && i.play) return;                                // como en Construct 2: si ya la está reproduciendo, nada
    i.an = name; i.play = 1; i.ft = 0; i.rc = 0; if (from !== 0 || i.fi >= A[3].length) i.fi = 0;
  },
  /** Un paso de una instancia: comportamientos y animación (los disparadores quedan apuntados para los eventos) */
  zeTickInst(w, i, dt) {
    i.age += dt;
    if (i.bu && i.bu.sa && i.ang !== i.bu.la) { i.bu.a = i.ang; i.bu.la = i.ang; }   // «Set angle»: si giran el objeto, la bala sigue su ángulo (como en Construct 2)
    if (i.bu && i.bu.en) {
      const b = i.bu; b.sp = Math.max(0, b.sp + b.acc * dt); const a = b.a * Math.PI / 180;
      let vx = Math.cos(a) * b.sp, vy = Math.sin(a) * b.sp; if (b.g) { b.vg += b.g * dt; vy += b.vg; }
      i.x += vx * dt; i.y += vy * dt; if (b.sa && (vx || vy)) i.ang = b.la = Math.atan2(vy, vx) * 180 / Math.PI;
    }
    if (i.sn && i.sn.on) {
      const s = i.sn; s.t += dt; const v = Math.sin(s.t / s.per * Math.PI * 2) * s.mag, d = v - s.last; s.last = v;
      if (s.mv === 0) i.x += d; else if (s.mv === 1) i.y += d; else if (s.mv === 2) { i.sx += d / 100; i.sy += d / 100; } else if (s.mv === 5) i.ang += d; else if (s.mv === 6) i.op = Math.max(0, Math.min(1, i.op + d / 100));
    }
    if (i.fd && i.fd.on) {
      const f = i.fd, t0 = f.t; f.t += dt; const t = f.t;
      if (t < f.fin) i.op = t / f.fin;
      else if (t < f.fin + f.wait) { i.op = 1; }
      else if (t < f.fin + f.wait + f.fout) { if (t0 < f.fin + f.wait) i.fwe = w.n; i.op = 1 - (t - f.fin - f.wait) / f.fout; }
      else { if (t0 < f.fin + f.wait) i.fwe = w.n; i.op = 0; f.on = false; if (f.des) this.zeKill(w, i); }
    }
    const A = window.ZFXL.ty[i.k].an[i.an];
    if (A && i.play) {
      const fps = i.fps === null ? A[0] : i.fps, F = A[3];
      if (fps > 0 && F.length) {
        i.ft += dt * fps; let g = 0;
        while (g++ < 30) {
          const d = (F[i.fi] && F[i.fi][0]) || 1; if (i.ft < d) break; i.ft -= d;
          if (i.fi < F.length - 1) { i.fi++; i.fch = w.n; }
          else if (A[1]) { i.fi = Math.min(A[2] || 0, F.length - 1); i.fch = w.n; }
          else if ((i.rc = (i.rc || 0) + 1) < (A[4] || 1)) { i.fi = 0; i.fch = w.n; }   // «Repeat count»: vuelve a empezar
          else { i.play = 0; i.fin = w.n; i.finA = i.an; break; }   // sin bucle: se queda en el último fotograma
        }
      } else if (!A[1] && F.length <= 1 && i.age > 0 && i.fin < 0 && fps === 0) { /* animación quieta */ }
    }
    if ((i.dol && ZE.out(i)) || i.age > 14) this.zeKill(w, i);
  },
  /** Un paso del motor: instancias, «Wait» pendientes y eventos de todos los mundos vivos */
  zeStep() {
    if (!this.zW || !this.zW.length || !ZE.on()) return;
    ZE.build();
    for (let n = this.zW.length - 1; n >= 0; n--) {
      const w = this.zW[n], z = w.z;
      w.n++; w.tt += VS_DT;
      const live = z.f && z.f.sp && z.f.sp.z === z; if (!live) { z.over = 1; w.ot += VS_DT; }
      if (w.ot > 6) for (const i of w.I) this.zeKill(w, i);             // la técnica acabó hace rato: lo que quede se va
      this.zeB = 'tick'; for (const i of w.I) if (!i.dead) this.zeTickInst(w, i, VS_DT);
      const g0 = z.go, gf0 = z.gof; z.go = null; z.gof = null;
      for (let k = 0; k < w.wt.length; k++) { const q = w.wt[k]; if (w.tt >= q.t - 1e-9) { w.wt.splice(k--, 1); this.zeResume(w, q); } }
      // bloques que pueden cumplirse con los efectos que hay
      const X = ZE.ix, have = new Set(); for (const i of w.I) if (!i.dead || i.dead >= w.n - 1) have.add(i.k);
      const L = new Set(X.always);
      for (const k of have) { const B = X.by.get(k); if (B) for (const t of B) if (t.ga || t.g.every((q) => have.has(q))) L.add(t); }
      if (have.size || w.wt.length || live) for (const t of [...L].sort((a, b) => a.i - b.i)) this.zeRun(t, w, new Map(), {});   // (con la técnica en marcha, también los que crean efectos)
      if (live && (z.go || z.gof !== null)) { z.ego = z.go || z.ego; if (z.gof !== null) z.egof = z.gof; }   // la técnica cambia de parte: lo aplica zcTick
      z.go = g0; z.gof = gf0;
      w.I = w.I.filter((i) => !i.dead || i.dead >= w.n - 1);            // los destruidos duran un paso más (para «al destruirse»)
      if (!live && !w.I.length && !w.wt.length) { this.zW.splice(n, 1); if (z.W) z.W[w.os] = null; }
    }
  },
  /* ---------- quién es quién ---------- */
  /** Papel del original (lado del jugador / del rival) -> papel en la técnica (A atacante, T víctima, S su sprite...) o null si no existe */
  zeR(w, r) {
    if (!r) return null;
    if (r[0] === 'F' && r[2] === ':') {
      const side = (+r[1]) ^ w.os, cid = r.slice(3), o = side ? w.z.foe : w.z.f, oc = o && o.def && /^z_/.test(o.def.sheet) ? o.def.sheet.slice(2) : null;
      return oc === cid ? (side ? 'TV' : 'S') : null;
    }
    if (!w.os) return r;
    return r === 'A' ? 'T' : r === 'T' ? 'A' : r === 'AV' ? 'TV' : r === 'TV' ? 'AV' : r;
  },
  zeRole: (r) => r === 'A' || r === 'T' || r === 'AV' || r === 'TV' || r === 'S',
  zeG(w, name) {
    const z = w.z, cid = (o) => (o && o.def && /^z_/.test(o.def.sheet) ? window.ZFXL.ix[o.def.sheet.slice(2)] || 0 : 0);
    if (name === 'Jogador') return cid(w.os ? z.foe : z.f);
    if (name === 'Inimigo') return cid(w.os ? z.f : z.foe);
    return z.g[name] || 0;
  },
  /** Caja de un luchador en el plano (null si está fuera del plano, KO o esquivando) */
  zeBox(w, nr) {
    const z = w.z, o = nr === 'T' || nr === 'TV' ? z.foe : z.f; if (!o) return null;
    if (o === z.foe && (o.st === 'ko' || (o.inv > 0 && !o.zc))) return null;
    const lat = (o.x - z.ox) * -z.nz + (o.z - z.oz) * z.nx; if (Math.abs(lat) > 2.6) return null;
    const X = this.zcX(z, o), Y = this.zcY(z, o);
    if (o === z.f && nr !== 'A' && z.part && z.f.sp && z.f.sp.z === z) {   // su sprite visible: el dibujo del fotograma (los rayos dibujados en él)
      const p = z.f.sp, P = p.seq && p.seq[p.si], F = P && ZMoves.partFrame(z.cid, P[0], p.pt || 0, !!P[2]);
      if (F) { const k = ZC.SPR; return [X - F.ax * k, Y - F.ay * k, X + (F.w - F.ax) * k, Y + (F.h - F.ay) * k]; }
    }
    return [X - 46, Y - 167, X + 46, Y];
  },
  zePoint(w, nr, ip) {
    const z = w.z;
    if (nr === 'T' || nr === 'TV') { const o = z.foe; return [this.zcX(z, o), this.zcY(z, o) - (ip >= 1 ? 83 : 0)]; }
    const live = z.f && z.f.sp && z.f.sp.z === z;
    return live ? this.zcIP(z, z.f, ip || 0) : [this.zcX(z, z.f), this.zcY(z, z.f) - (ip >= 1 ? 83 : 0)];
  },
  /** [animación, fotograma] de Z Legends 3 de un luchador fuera de una técnica (como la dibuja versus.js en zBasic) */
  zeFAnim(o) {
    if (!o || !o.def || !/^z_/.test(o.def.sheet)) return null;
    const D = ZMoves.D[o.def.sheet.slice(2)], air = o.y > 0.6, t = o.t; if (!D) return null;
    let n = null, T = 0, loop = false;
    switch (o.st) {
      case 'idle': n = 'Parado'; loop = true; break;
      case 'move': n = 'MovimentoParaFrente'; loop = true; break;
      case 'atk': n = air ? (o.c >= 3 ? 'Attack_Medium_Aereo' : 'Attack_Light_Aereo') : ['Attack_Light_1', 'Attack_Light_2', 'Attack_Light_3', 'Attack_Medium'][o.c] || 'Attack_Medium'; T = o.c >= VS.LIGHT.length - 1 ? 0.42 : 0.33; break;
      case 'flurry': n = 'Attack_Light_1'; T = 0.13; break;
      case 'heavy': n = air ? 'Attack_Heavy_Aereo' : 'Attack_Heavy'; T = 0.62; break;
      case 'grab': n = 'Attack_Medium'; T = 0.5; break;
      case 'guard': n = air ? 'Defesa_Ar' : 'Defesa_Chao'; break;
      case 'dash': n = 'Dash'; loop = true; break;
      case 'hurt': case 'stun': n = air ? 'Dano_Aereo1' : 'Dano_Chao1'; break;
      case 'launched': n = o.vy > 2 ? 'SendoLancado_CIMA' : 'SendoLancado_LADO'; loop = true; break;
      case 'down': case 'ko': n = 'Caido'; break;
      case 'charge': n = 'CarregandoKi_Stage2'; loop = true; break;
      default: return [o.st, 0];
    }
    const A = D.a[n]; if (!A || !A.f.length) return [n, 0];
    const k = A.f.length, fi = T ? Math.min(k - 1, Math.floor(Math.min(t, T - 1e-3) / T * k)) : loop ? Math.floor(t * (A.fps || 12)) % k : Math.min(k - 1, Math.floor(t * (A.fps || 12)));
    return [n, fi];
  },
  /* ---------- selección de instancias ---------- */
  zePick(w, sol, k) { const s = sol.get(k); return s ? s.filter((i) => !i.dead) : w.I.filter((i) => i.k === k && !i.dead); },
  zeCur(w, sol, cur, k) { const c = cur && cur.get(k); if (c) return c; const L = sol.get(k) || w.I.filter((i) => i.k === k && !i.dead); return L[0] || null; },
  zeTrig(i, c, pass, w) { if (!(pass >= w.n - 1) || i.used.get(c) === pass) return false; i.used.set(c, pass); return true; },
  /* ---------- expresiones ---------- */
  zeE(e, w, sol, cur) {
    if (!e) return 0;
    switch (e[0]) {
      case 'n': case 's': return e[1];
      case 'g': return this.zeG(w, e[1]);
      case 'o': return e[1];
      case 'op': {
        const a = this.zeE(e[2], w, sol, cur), b = this.zeE(e[3], w, sol, cur);
        switch (e[1]) {
          case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return b ? a / b : 0; case '%': return b ? a % b : 0;
          case '^': return Math.pow(a, b); case '&': return String(a) + String(b); case 'or': return a || b ? 1 : 0;
          case '=': return a === b ? 1 : 0; case '<>': return a !== b ? 1 : 0; case '<': return a < b ? 1 : 0; case '<=': return a <= b ? 1 : 0; case '>': return a > b ? 1 : 0; case '>=': return a >= b ? 1 : 0;
        }
        return 0;
      }
      case 'f': { const A = (e[2] || []).map((x) => ['n', this.zeE(x, w, sol, cur)]); return this.zcE(['f', e[1], A], w.z, w.z.f, w.z.foe); }
      case 'v': {
        if (window.ZFXL.ty[e[1]]) { const i = this.zeCur(w, sol, cur, e[1]); return i ? i.v[e[2]] || 0 : 0; }
        const nr = this.zeR(w, e[1]); return nr ? this.zcVar(w.z, nr, e[2], w.z.f, w.z.foe) : 0;
      }
      case 'x': {
        const k = e[1], fn = e[2], A = (e[3] || []).map((x) => this.zeE(x, w, sol, cur));
        if (window.ZFXL.ty[k]) {
          if (fn === 'Count') return this.zePick(w, sol, k).length;
          const i = this.zeCur(w, sol, cur, k); if (!i) return 0;
          switch (fn) {
            case 'X': return i.x; case 'Y': return i.y; case 'Angle': return i.ang; case 'UID': return i.uid; case 'Opacity': return i.op * 100;
            case 'Width': { const F = ZE.frame(i); return F ? F[1] * Math.abs(i.sx) : 0; }
            case 'Height': { const F = ZE.frame(i); return F ? F[2] * Math.abs(i.sy) : 0; }
            case 'ImagePointX': return ZE.ip(i, typeof A[0] === 'number' ? A[0] : 1)[0];
            case 'ImagePointY': return ZE.ip(i, typeof A[0] === 'number' ? A[0] : 1)[1];
            case 'AnimationFrame': return i.fi; case 'AnimationName': return i.an;
            case 'Speed': return i.bu ? i.bu.sp : 0;
            case 'BBoxLeft': return ZE.box(i)[0]; case 'BBoxTop': return ZE.box(i)[1]; case 'BBoxRight': return ZE.box(i)[2]; case 'BBoxBottom': return ZE.box(i)[3];
          }
          return 0;
        }
        if (k === 'solidos') return fn === 'Y' || fn === 'BBoxTop' ? ZC.Y0 : fn === 'X' ? ZC.X0 : 0;   // el suelo del escenario
        const nr = this.zeR(w, k); if (!nr || !this.zeRole(nr)) return 0;
        return this.zcE(['x', nr, fn, A.map((v) => [typeof v === 'string' ? 's' : 'n', v])], w.z, w.z.f, w.z.foe);
      }
    }
    return 0;
  },
  /* ---------- condiciones ---------- */
  zeCond(c, w, sol, ctx, node) {
    const [k, fn, beh, inv, P] = c, z = w.z, E = (n, cur) => this.zeE(P[n], w, sol, cur);
    const T = window.ZFXL.ty[k];
    if (T) {                                                            // condición de un efecto: elige las instancias que la cumplen
      const L = fn === 'OnDestroyed' ? (sol.get(k) || w.I.filter((i) => i.k === k)) : this.zePick(w, sol, k);
      if (!L.length) return false;
      let out;
      if (fn === 'IsOverlapping' || fn === 'OnCollision') {
        const o = P[0] && P[0][1];
        if (window.ZFXL.ty[o]) {
          const O = this.zePick(w, sol, o), hit = new Set(), keep = [];
          for (const i of L) { let h = false; for (const j of O) if (j !== i && ZE.hit(i, j)) { h = true; hit.add(j); } if (h !== !!inv) keep.push(i); }
          if (!inv) { if (!keep.length) return false; sol.set(o, [...hit]); }
          out = keep;
        } else if (o === 'solidos') out = L.filter((i) => ZE.hit(i, [-1e5, ZC.Y0 - 1, 1e5, ZC.Y0 + 400]) !== !!inv);   // el suelo
        else if (o === 'bordas_da_tela_sprite') out = L.filter((i) => { const b = ZE.box(i); return (b[0] < ZC.X0 - 1100 || b[2] > ZC.X0 + 1100) !== !!inv; });
        else { const nr = this.zeR(w, o), B = nr && this.zeRole(nr) ? this.zeBox(w, nr) : null; out = L.filter((i) => !!(B && ZE.hit(i, B)) !== !!inv); }   // otro objeto que aquí no existe: no toca
      } else {
        const test = (i) => {
          const cur = new Map([[k, i]]);
          switch (fn) {
            case 'IsAnimPlaying': return i.an === E(0, cur);
            case 'CompareFrame': return ZE.cmp(i.fi, E(0, cur), E(1, cur));
            case 'CompareInstanceVar': return ZE.cmp(i.v[E(0, cur)] || 0, E(1, cur), E(2, cur));
            case 'IsBoolInstanceVarSet': return !!i.v[E(0, cur)];
            case 'IsVisible': return !!i.vis;
            case 'IsMirrored': return !!i.mir;
            case 'CompareX': return ZE.cmp(i.x, E(0, cur), E(1, cur));
            case 'CompareY': return ZE.cmp(i.y, E(0, cur), E(1, cur));
            case 'CompareWidth': { const F = ZE.frame(i); return ZE.cmp(F ? F[1] * Math.abs(i.sx) : 0, E(0, cur), E(1, cur)); }
            case 'CompareHeight': { const F = ZE.frame(i); return ZE.cmp(F ? F[2] * Math.abs(i.sy) : 0, E(0, cur), E(1, cur)); }
            case 'CompareOpacity': return ZE.cmp(i.op * 100, E(0, cur), E(1, cur));
            case 'IsOutsideLayout': return ZE.out(i);
            case 'IsOnScreen': return true;
            case 'OnAnimFinished': return i.finA === E(0, cur) && this.zeTrig(i, c, i.fin, w);
            case 'OnAnyAnimFinished': return this.zeTrig(i, c, i.fin, w);
            case 'OnFrameChanged': return this.zeTrig(i, c, i.fch, w);
            case 'OnCreated': return this.zeTrig(i, c, i.cp, w);
            case 'OnDestroyed': return !!i.dead && this.zeTrig(i, c, i.dead, w);
            case 'OnWaitEnd': return this.zeTrig(i, c, i.fwe, w);
            case 'IsMoving': return !!(i.bu && i.bu.en && i.bu.sp > 0);
          }
          return false;
        };
        const trig = /^On/.test(fn);
        out = L.filter((i) => trig ? test(i) : test(i) !== !!inv);
      }
      if (!out.length) return false;
      sol.set(k, out); return true;
    }
    if (k === 'Sys') {
      switch (fn) {
        case 'CompareVar': return ZE.cmp(this.zeG(w, P[0] && P[0][1]), E(1), E(2)) !== !!inv;
        case 'TriggerOnce': { const last = w.tk.get(node); w.tk.set(node, w.n); return last !== w.n - 1; }
        case 'Every': { const t = E(0), last = w.ev.get(node), r = last === undefined || w.tt - last >= t - 1e-6; if (r) w.ev.set(node, w.tt); return r; }
        case 'EveryTick': return true;
        case 'Compare': return ZE.cmp(E(0), E(1), E(2)) !== !!inv;
        case 'Else': return !ctx.prev;
        case 'PickByComparison': {
          const o = P[0] && P[0][1]; if (!window.ZFXL.ty[o]) return ZE.cmp(E(1), E(2), E(3)) !== !!inv;
          const L = this.zePick(w, sol, o).filter((i) => { const cur = new Map([[o, i]]); return ZE.cmp(this.zeE(P[1], w, sol, cur), this.zeE(P[2], w, sol, cur), this.zeE(P[3], w, sol, cur)) !== !!inv; });
          if (!L.length) return false; sol.set(o, L); return true;
        }
        case 'CompareTime': return true;
      }
      return false;
    }
    if (k === 'cutscenes_sprite') return this.zcCond(c, z, z.f, z.foe, { fin: z.fin1, prev: ctx.prev }, node);
    if (k === 'Fn') return fn === 'OnFunction' && !!ctx.fn && ctx.fn === E(0);   // dentro de una llamada a esa función
    if (k === 'solidos' || k === 'bordas_da_tela_sprite') return fn === 'PickByUID' || fn === 'PickAll';   // el suelo y los bordes de la pantalla
    const nr = this.zeR(w, k); if (!nr || !this.zeRole(nr)) return false;   // asistentes, cinemáticas, HUD...: aquí no existen
    if (fn === 'IsOverlapping' || fn === 'OnCollision') {                // un luchador toca efectos: elige esos efectos
      const o = P[0] && P[0][1], B = this.zeBox(w, nr);
      if (window.ZFXL.ty[o]) { const L = this.zePick(w, sol, o).filter((i) => !!(B && ZE.hit(i, B))); if (inv) return !L.length; if (!L.length) return false; sol.set(o, L); return true; }
      const or = this.zeR(w, o); if (!or || !this.zeRole(or)) return !!inv;
      const B2 = this.zeBox(w, or); return !!(B && B2 && ZE.ovl(B, B2)) !== !!inv;
    }
    if (fn === 'OnAnimFinished' && (nr === 'S' || nr === 'AV')) return !!z.fin1 && z.fin1 === E(0) && (z.f && z.f.sp && z.f.sp.z === z);   // el paso en que acaba su parte
    if (/^(IsAnimPlaying|CompareFrame)$/.test(fn) && ((nr === 'S' || nr === 'AV') ? !(z.f && z.f.sp && z.f.sp.z === z) : (nr === 'TV' && !z.tva))) {   // fuera de su técnica: la animación de lo que está haciendo
      const q = this.zeFAnim(nr === 'TV' ? z.foe : z.f); if (!q) return !!inv;
      const r = fn === 'IsAnimPlaying' ? q[0] === E(0) : ZE.cmp(q[1], E(0), E(1)); return r !== !!inv;
    }
    if ((nr === 'S' || nr === 'AV') && !(z.f && z.f.sp && z.f.sp.z === z) && fn === 'OnFrameChanged') return !!inv;
    const Q = (P || []).map((p) => !p ? p : p[0] === 'o' ? ['o', this.zeR(w, p[1]) || p[1]] : (() => { const v = this.zeE(p, w, sol, null); return [typeof v === 'string' ? 's' : 'n', v]; })());
    return this.zcCond([nr, fn, beh, inv, Q], z, z.f, z.foe, { fin: z.fin1, prev: ctx.prev }, node);
  },
  /* ---------- acciones ---------- */
  zeAct(a, w, sol) {
    const [k, fn, beh, P] = a, z = w.z, f = z.f, foe = z.foe;
    const T = window.ZFXL.ty[k];
    if (T) {
      const L = this.zePick(w, sol, k), nw = new Map();
      for (const i of L) {
        const cur = new Map([[k, i]]), E = (n) => this.zeE(P[n], w, sol, cur);
        switch (beh ? beh + '.' + fn : fn) {
          case 'Destroy': this.zeKill(w, i); break;
          case 'SetAnim': this.zeSetAnim(i, E(0), P.length > 1 ? E(1) : 1); break;
          case 'SetAnimFrame': { const A = window.ZFXL.ty[k].an[i.an], n = Math.max(0, Math.floor(E(0))); if (A && n < A[3].length) { i.fi = n; i.ft = 0; i.fch = w.n; } break; }
          case 'SetAnimSpeed': i.fps = Math.max(0, E(0)); break;
          case 'StopAnim': i.play = 0; break;
          case 'StartAnim': i.play = 1; if (E(0) === 1) { i.fi = 0; i.ft = 0; } break;
          case 'SetScale': i.sx = i.sy = E(0); break;
          case 'SetWidth': { const F = ZE.frame(i); if (F && F[1]) i.sx = E(0) / F[1]; break; }
          case 'SetHeight': { const F = ZE.frame(i); if (F && F[2]) i.sy = E(0) / F[2]; break; }
          case 'SetSize': { const F = ZE.frame(i); if (F && F[1]) { i.sx = E(0) / F[1]; i.sy = E(1) / F[2]; } break; }
          case 'SetInstanceVar': i.v[E(0)] = E(1); break;
          case 'AddInstanceVar': i.v[E(0)] = (i.v[E(0)] || 0) + E(1); break;
          case 'SubInstanceVar': i.v[E(0)] = (i.v[E(0)] || 0) - E(1); break;
          case 'SetBoolInstanceVar': i.v[E(0)] = E(1) ? 1 : 0; break;
          case 'ToggleBoolInstanceVar': i.v[E(0)] = i.v[E(0)] ? 0 : 1; break;
          case 'SetMirrored': i.mir = E(0) === 0 ? 1 : 0; break;           // en Construct 2, 0 = «reflejado»
          case 'SetVisible': i.vis = E(0) ? 1 : 0; break;
          case 'SetOpacity': i.op = Math.max(0, Math.min(1, E(0) / 100)); break;
          case 'SetAngle': i.ang = E(0); break;
          case 'RotateClockwise': i.ang += E(0); break;
          case 'RotateCounterclockwise': i.ang -= E(0); break;
          case 'SetX': i.x = E(0); break;
          case 'SetY': i.y = E(0); break;
          case 'SetPos': i.x = E(0); i.y = E(1); break;
          case 'MoveAtAngle': { const an = E(0) * Math.PI / 180, d = E(1); i.x += Math.cos(an) * d; i.y += Math.sin(an) * d; break; }
          case 'SetTowardPosition': i.ang = Math.atan2(E(1) - i.y, E(0) - i.x) * 180 / Math.PI; break;
          case 'SetPosToObject': {
            const o = P[0] && P[0][1], n = P.length > 1 ? E(1) : 0;
            if (window.ZFXL.ty[o]) { const j = this.zeCur(w, sol, null, o); if (j) [i.x, i.y] = ZE.ip(j, n); }
            else { const nr = this.zeR(w, o); if (nr && this.zeRole(nr)) [i.x, i.y] = this.zePoint(w, nr, n); }
            break;
          }
          case 'Spawn': {
            const o = P[0] && P[0][1], n = P.length > 2 ? E(2) : 0, q = ZE.ip(i, typeof n === 'number' ? n : 1), j = this.zeNew(w, o, q[0], q[1], i.ang);
            if (j) { if (!nw.has(o)) nw.set(o, []); nw.get(o).push(j); }   // las nuevas quedan elegidas
            break;
          }
          case 'Bullet.SetAngleOfMotion': if (i.bu) { i.bu.a = E(0); if (i.bu.sa) i.ang = i.bu.la = i.bu.a; } break;
          case 'Bullet.SetSpeed': if (i.bu) i.bu.sp = E(0); break;
          case 'Bullet.SetEnabled': if (i.bu) i.bu.en = !!E(0); break;
          case 'Bullet.SetGravity': if (i.bu) i.bu.g = E(0); break;
          case 'Bullet.SetAcceleration': if (i.bu) i.bu.acc = E(0); break;
          case 'Bullet.Bounce': if (i.bu) { i.bu.a = 180 - i.bu.a; i.bu.vg = -i.bu.vg; } break;
          case 'Fade.StartFade': if (i.fd) { i.fd.on = true; i.fd.t = 0; if (i.fd.fin > 0) i.op = 0; } break;
          case 'Fade.RestartFade': if (i.fd) { i.fd.on = true; i.fd.t = 0; } break;
          case 'Sine.SetActive': if (i.sn) i.sn.on = !!E(0); break;
        }
      }
      for (const [o, J] of nw) sol.set(o, J);
      return;
    }
    if (k === 'Sys') {
      if (fn === 'CreateObject' && P[0] && P[0][1] === 'cutscenes_sprite') { z.cut = { a: null, t0: z.tt }; return; }   // panel de cinemática (zchoreo.js)
      if (fn === 'CreateObject') { const o = P[0] && P[0][1], j = this.zeNew(w, o, this.zeE(P[2], w, sol, null), this.zeE(P[3], w, sol, null), 0); if (j) sol.set(o, [j]); return; }
      if (fn === 'SetVar') { const n = P[0] && P[0][1]; if (n && n !== 'Jogador' && n !== 'Inimigo') z.g[n] = this.zeE(P[1], w, sol, null); return; }
      return;
    }
    let nr = k === 'camera' || k === 'Cam' || k === 'Fn' ? k : this.zeR(w, k); if (!nr) return;
    if (fn === 'Spawn') {                                                // un luchador crea un efecto en su punto de imagen
      const o = P[0] && P[0][1], n = P.length > 2 ? this.zeE(P[2], w, sol, null) : 0;
      if (/hit_/.test(o) && (nr === 'T' || nr === 'TV')) this.emit('zHit', { i: f.i, x: foe.x, y: foe.y + 1.5, z: foe.z, col: f.def.col, sp: 1 });
      else if (/defesa/.test(o)) { const g = nr === 'T' || nr === 'TV' ? foe : f; this.emit('guard', { i: g.i, x: g.x, y: g.y + 1.6, z: g.z }); }
      const q = this.zePoint(w, nr, typeof n === 'number' ? n : 1), j = this.zeNew(w, o, q[0], q[1], 0); if (j) sol.set(o, [j]);
      return;
    }
    if (fn === 'SetPosToObject' && window.ZFXL.ty[P[0] && P[0][1]]) {  // un luchador va a donde está un efecto
      const j = this.zeCur(w, sol, null, P[0][1]); if (!j) return; const q = ZE.ip(j, P.length > 1 ? this.zeE(P[1], w, sol, null) : 0), o = nr === 'T' || nr === 'TV' ? foe : f;
      this.zcSet(z, o, q[0], q[1], o === foe ? f : null); if (o === foe) this.zcHold(z, foe); return;
    }
    if (nr === 'Fn' && w.os && P[0]) { const s = String(this.zeE(P[0], w, sol, null)), t = s.replace(/JOGADOR/g, '\u0001').replace(/INIMIGO/g, 'JOGADOR').replace(/\u0001/g, 'INIMIGO').replace(/Jogador/g, '\u0002').replace(/Inimigo/g, 'Jogador').replace(/\u0002/g, 'Inimigo'); this.zcAct(['Fn', fn, beh, [['s', t]]], z, f, foe, []); return; }
    const live = f && f.sp && f.sp.z === z;
    if ((nr === 'S' || nr === 'AV') && !live && /^SetAnim/.test(fn)) return;   // la técnica ya acabó: no se cambia de animación
    const Q = (P || []).map((p) => !p ? p : p[0] === 'o' ? ['o', this.zeR(w, p[1]) || p[1]] : (() => { const v = this.zeE(p, w, sol, null); return [typeof v === 'string' ? 's' : 'n', v]; })());
    this.zcAct([nr, fn, beh, Q], z, f, foe, []);
  },
  /* ---------- eventos ---------- */
  zeRun(t, w, sol0, ctx) { if (t.i !== undefined) this.zeB = t.i; return this.zeFrom(t, 0, w, new Map(sol0), ctx); },
  zeFrom(t, c0, w, sol, ctx) {
    if (window.ZEDBG) this.zeT = t;
    if (t.or) {                                                         // bloque O: basta una condición (se juntan sus selecciones)
      let ok = false; const U = new Map();
      for (const c of t.c) { const s = new Map(sol); if (this.zeCond(c, w, s, ctx, t)) { ok = true; for (const [k, L] of s) if (L !== sol.get(k)) U.set(k, [...new Set([...(U.get(k) || []), ...L])]); } }
      if (!ok) return false; for (const [k, L] of U) sol.set(k, L);
    } else for (let n = c0; n < t.c.length; n++) {
      const c = t.c[n];
      if (c[0] === 'Sys' && c[1] === 'ForEach') {                       // por cada instancia: el resto del bloque, con ella sola elegida
        const k = c[4][0] && c[4][0][1], L = window.ZFXL.ty[k] ? this.zePick(w, sol, k) : []; let any = false;
        for (const i of L) { const s = new Map(sol); s.set(k, [i]); if (this.zeFrom(t, n + 1, w, s, ctx)) any = true; }
        return any;
      }
      if (!this.zeCond(c, w, sol, ctx, t)) return false;
    }
    if (window.ZEDBG) this.zeT = t;
    if (t.a && !this.zeActs(t.a, 0, w, sol, t)) return true;           // un «Wait»: lo que queda (y los subeventos) espera
    this.zeSubs(t, w, sol, ctx);
    return true;
  },
  zeSubs(t, w, sol, ctx) { if (!t.s) return; const sub = { prev: true, fn: ctx && ctx.fn }; for (const s of t.s) sub.prev = this.zeRun(s, w, sol, sub); },
  zeActs(L, k0, w, sol, t) {
    for (let k = k0; k < L.length; k++) {
      const a = L[k];
      if (a[0] === 'Sys' && a[1] === 'Wait') { w.wt.push({ t: w.tt + Math.max(0, +this.zeE(a[3][0], w, sol, null) || 0), L, k: k + 1, sol: new Map(sol), node: t }); return false; }
      this.zeAct(a, w, sol);
    }
    return true;
  },
  zeResume(w, q) { this.zeB = 'wait' + (q.node && q.node.i); if (this.zeActs(q.L, q.k, w, q.sol, q.node)) this.zeSubs(q.node, w, q.sol, {}); },
  /* ---------- desde la lógica de las técnicas (zchoreo.js: los papeles ya van como atacante / víctima) ---------- */
  /** Papel de la técnica -> papel del original en el mundo os (la traducción es su propia inversa) */
  zeLit(e, os) {
    if (!os || !Array.isArray(e)) return e;
    const sw = (r) => r === 'A' ? 'T' : r === 'T' ? 'A' : r === 'AV' ? 'TV' : r === 'TV' ? 'AV' : r;
    if ((e[0] === 'o' || e[0] === 'v' || e[0] === 'x') && typeof e[1] === 'string') return [e[0], sw(e[1])].concat(e.slice(2).map((x) => this.zeLit(x, os)));
    return e.map((x) => this.zeLit(x, os));
  },
  /** Una acción de la técnica sobre un efecto (o que crea uno) */
  zeFromCh(a, z, f, foe) {
    const os = (z.CH[z.part] && z.CH[z.part].sd) || 0, w = this.zeWorld(z, os), sol = z.sol || (z.sol = new Map());
    const [k, fn, beh, P] = a;
    if (k === 'Sys' && fn === 'CreateObject') { this.zeAct(['Sys', fn, beh, P.map((p) => this.zeLit(p, os))], w, sol); return; }
    if (fn === 'Spawn' && !window.ZFXL.ty[k]) {                         // el atacante (o la víctima) crea el efecto
      const o = P[0] && P[0][1], ip = P.length > 2 ? this.zcE(P[2], z, f, foe) : 0, nr = k === 'T' || k === 'TV' ? 'T' : 'A', q = this.zePoint(w, nr, typeof ip === 'number' ? ip : 1), j = this.zeNew(w, o, q[0], q[1], 0);
      if (j) sol.set(o, [j]); return;
    }
    this.zeAct([this.zeLit(['o', k], os)[1], fn, beh, P.map((p) => this.zeLit(p, os))], w, sol);
  },
  /** ¿Sigue en el aire algo de esta técnica que hace daño? (la animación espera a que llegue) */
  /** ¿Tiene esta técnica efectos esperando un «Wait»? */
  zeBusy(z) { return !!(z.W && z.W.some((w) => w && w.wt.length)) || !!(z.wait && z.wait.length); },
  zeAir(z) {
    const H = ZE.ix && ZE.ix.harm; if (!H || !z.W) return false;
    if (z.W.some((w) => w && w.I.some((i) => !i.dead && H.has(i.k)))) { z.zeA = z.tt; return true; }
    return z.zeA !== undefined && z.tt - z.zeA < 0.45;                  // entre una ráfaga y la siguiente
  }
});
/** Descarga la lógica de efectos (una vez; el combate la espera junto con los paquetes de los luchadores) */
function zeLoad() {
  if (window.ZFXL) return Promise.resolve(true);
  return ZE.pl || (ZE.pl = new Promise((ok) => { const s = document.createElement('script'); s.src = av('assets/zl3/m/fxl.js'); s.onload = () => ok(true); s.onerror = () => ok(false); document.head.appendChild(s); }));
}
