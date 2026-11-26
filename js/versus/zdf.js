/* ============================================================================
   DRAMATIC FINISH de Z Legends 3: las escenas finales del original (Goku contra Vegeta, Vegetto contra Zamasu, Gogeta Blue
   contra Janemba y Gogeta Blue contra Gogeta SSJ4), reproducidas con su propio guion (tools/make_zl3_df.py ->
   assets/zl3/df/df.js): las animaciones DramaticFinish_* de los dos, sus posiciones, la cámara y su zoom, los paneles de
   cinemática, las voces con sus subtítulos en español, el fogonazo blanco y el K.O.
   Es solo imagen y sonido (el combate ya ha terminado): la simulación espera a que acabe (sim.dfT). Se puede saltar.

   Coordenadas: las del escenario del original (x a la derecha, y hacia abajo, suelo en 906). Se proyectan sobre la recta
   que une a los dos luchadores (n: del ganador al perdedor) y la cámara se pone de lado mirando a esa recta.
   ============================================================================ */
const ZDFL = {
  p: null,
  /** Descarga los guiones (una vez) */
  load() {
    if (window.ZDF) return Promise.resolve(true);
    if (this.p) return this.p;
    return (this.p = new Promise((ok) => { const s = document.createElement('script'); s.src = av('assets/zl3/df/df.js'); s.onload = () => ok(!!window.ZDF); s.onerror = () => ok(false); document.head.appendChild(s); }));
  },
  /** Escena para este ganador y este perdedor (ids de Z Legends 3), o 0 */
  scene(w, l) {
    const D = window.ZDF; if (!D) return 0;
    for (const n in D) if (ZDF_OK.includes(+n) && D[n].w === w && D[n].l === l) return +n;
    return 0;
  },
  /** ¿Hay escena entre estos dos (en algún sentido)? Para descargarla al empezar el combate */
  pair(a, b) { return [['gogetassj4', 'gogetablue'], ['goku', 'vegeta'], ['vegettoblue', 'zamasu'], ['gogetablue', 'janemba']].some(([w, l]) => (w === a && l === b) || (w === b && l === a)); },
  buf: {},
  /** Audios de la escena, decodificados (por el bus de efectos) */
  sounds(n) {
    const D = window.ZDF && ZDF[n]; if (!D || typeof SFX === 'undefined') return;
    if (!SFX.ctx && SFX.init) SFX.init();
    const c = SFX.ctx; if (!c) return;
    const js = JSON.stringify(D.ev);
    for (const k in D.snd) if (js.includes('"' + k + '"') || js.toLowerCase().includes('"' + k + '"')) {
      const f = D.snd[k][0]; if (this.buf[f] !== undefined) continue; this.buf[f] = null;
      fetch(av('assets/zl3/df/' + f + '.m4a')).then((r) => r.arrayBuffer()).then((b) => new Promise((res, rej) => c.decodeAudioData(b, res, rej))).then((B) => { this.buf[f] = B; }).catch(() => {});
    }
  }
};

// Escenas: 1 Gogeta SSJ4 gana a Gogeta Blue, 2 al revés, 3 Goku-Vegeta, 4 Vegetto-Zamasu, 5 Gogeta Blue-Janemba. En las de Gogeta
// contra Gogeta cada uno usa la hoja de su papel (en el paquete: «W:…» la del que gana, «L:…» la del que pierde)
const ZDF_OK = [1, 2, 3, 4, 5];
const ZDF_CMP = (a, op, b) => op === 0 ? a == b : op === 1 ? a != b : op === 2 ? a < b : op === 3 ? a <= b : op === 4 ? a > b : a >= b;
const ZDF_PX = 0.056 / 3.85;              // unidades de mundo por píxel del escenario original

class VsDramatic {
  /** V: el Versus · n: escena · wi: quién gana (0/1) */
  constructor(V, n, wi) {
    const D = this.D = ZDF[n], sim = V.sim, A = sim.f[wi], B = sim.f[1 - wi];
    this.V = V; this.n = n; this.wi = wi; this.t = 0; this.tick = 0; this.done = false; this.endAt = 0;
    let nx = B.x - A.x, nz = B.z - A.z; const h = Math.hypot(nx, nz) || 1; nx /= h; nz /= h;
    this.nx = nx; this.nz = nz; this.ox = (A.x + B.x) / 2; this.oz = (A.z + B.z) / 2;
    this.zw = V.actors[wi].zid[V.actors[wi].fi]; this.zl = V.actors[1 - wi].zid[V.actors[1 - wi].fi];
    // Objetos del guion
    this.o = { W: { X: 700, Y: 906 }, L: { X: 1000, Y: 906 } };
    // Sprites: su animación y hacia dónde miran (en el original no se giran solos durante la escena: solo con SetMirrored)
    this.s = { WS: { anim: 'Parado', t: 0, rate: 0, fin: '', mir: false }, LS: { anim: 'SendoLancado_LADO', t: 0, rate: 0, fin: '', mir: true } };
    this.cam = { X: 850, Y: 750 }; this.zoom = 1;
    this.v = { WS: {}, LS: {}, W: {}, L: {}, CUT: {} }; this.g = { INICIAR_DRAMATIC_FINISH: n, DRAMATIC_FINISH_JOGADORouINIMIGO: 1, SelecionarIdioma: 2, MODO_DE_JOGO: 1 };
    this.au = {}; this.ended = new Set(); this.src = [];
    this.cut = null; this.txt = ''; this.white = null; this.ko = 0;
    this.tk = new Map(); this.ev = new Map(); this.ov = new Map(); this.wait = []; this.acc = 0; this.ob = {};
    this.ui();
    SFX.setDuck && SFX.setDuck(0.25);
    V.cam.play(600, (k, P, L) => this.camera(P, L));
    this.skip = (e) => { if (this.t > 1 && (!e.code || /Enter|Space|Escape|KeyJ|Numpad1/.test(e.code))) this.finish(); };
    addEventListener('keydown', this.skip); addEventListener('pointerdown', this.skip);
  }
  /* ---------- capas de pantalla: panel, subtítulo, fogonazo, aviso para saltar ---------- */
  ui() {
    const el = this.el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:62;pointer-events:none;font-family:inherit';
    el.innerHTML = '<canvas width="1088" height="584" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;image-rendering:pixelated;image-rendering:crisp-edges"></canvas>' +
      '<div class="dfw" style="position:absolute;inset:0;background:#fff;opacity:0"></div>' +
      '<div class="dft" style="position:absolute;left:8%;right:8%;bottom:7%;text-align:center;color:#fff;font-size:clamp(15px,2.4vw,26px);font-weight:700;text-shadow:0 2px 0 #000,0 0 8px #000;opacity:0;transition:opacity .2s"></div>' +
      '<div class="dfk" style="position:absolute;top:38%;left:0;right:0;text-align:center;color:#ffd84a;font-size:clamp(40px,9vw,110px);font-weight:900;letter-spacing:.04em;text-shadow:0 5px 0 #7a2a00,0 0 24px #ff8a00;opacity:0;transform:scale(1.6);transition:all .35s cubic-bezier(.2,1.6,.4,1)">DRAMATIC FINISH</div>' +
      '<div style="position:absolute;right:14px;bottom:10px;color:#fff;opacity:.55;font-size:12px">Pulsa para saltar</div>';
    document.body.appendChild(el);
    this.hud = [...this.V.el.children].filter((n) => n.offsetParent !== null && !n.contains(this.V.r && this.V.r.domElement)); this.hud.forEach((n) => { n.dataset.dfv = n.style.visibility; n.style.visibility = 'hidden'; });   // sin marcador: solo la escena
    this.cv = el.firstChild.getContext('2d'); this.cv.imageSmoothingEnabled = false;
    this.wEl = el.querySelector('.dfw'); this.tEl = el.querySelector('.dft'); this.kEl = el.querySelector('.dfk');
    const im = this.im = new Image(); im.src = av('assets/zl3/df/df' + this.n + '.webp');
  }
  /* ---------- coordenadas ---------- */
  world(X, Y) { const a = (X - 850) * ZDF_PX; return [this.ox + this.nx * a, Math.max(0, (906 - Y) * ZDF_PX), this.oz + this.nz * a]; }
  camera(P, L) {
    const [x, y, z] = this.world(this.cam.X, this.cam.Y), d = (584 / Math.max(0.3, this.zoom) * ZDF_PX / 2) / Math.tan(20 * Math.PI / 180);
    L.set(x, y, z); P.set(x - this.nz * d, y + d * 0.05, z + this.nx * d);
    return 40;
  }
  /** Posición y orientación de un luchador (para el dibujo) */
  pose(i) {
    const k = i === this.wi ? 'W' : 'L', o = this.o[k], q = this.world(o.X, o.Y), other = this.o[k === 'W' ? 'L' : 'W'];
    return { x: q[0], y: q[1], z: q[2], flip: this.s[k + 'S'].mir };
  }
  /** Fotograma de su animación del original */
  frame(i) {
    const k = i === this.wi ? 'WS' : 'LS', s = this.s[k], zid = k === 'WS' ? this.zw : this.zl, n = this.key(k), A = ZMoves.D[zid] && ZMoves.D[zid].a[n];
    if (!A) return null;
    return ZMoves.partFrame(zid, n, s.t, !!A.l);
  }
  /* ---------- animaciones ---------- */
  /** Nombre en el paquete: la versión de su papel si la hay (W: / L:) */
  key(k) { const s = this.s[k], zid = k === 'WS' ? this.zw : this.zl, A = ZMoves.D[zid] && ZMoves.D[zid].a, p = (k === 'WS' ? 'W:' : 'L:') + s.anim; return A && A[p] ? p : s.anim; }
  anim(k, name) { const s = this.s[k]; if (s.anim === name) return; s.anim = name; s.t = 0; s.rate = 0; s.fin = ''; const zid = k === 'WS' ? this.zw : this.zl, A = ZMoves.D[zid] && ZMoves.D[zid].a[this.key(k)]; s.hold = !!(A && A.p0); }   // hold: parada hasta un SetAnimSpeed
  aLen(k) { const zid = k === 'WS' ? this.zw : this.zl, A = ZMoves.D[zid] && ZMoves.D[zid].a[this.key(k)]; if (!A) return [0, 12, 0, 1]; let n = 0; for (const f of A.f) n += f[7] || 1; return [n / (A.fps || 12), A.fps || 12, A.f.length, A.l]; }
  aFrame(k) {
    const s = this.s[k], zid = k === 'WS' ? this.zw : this.zl, A = ZMoves.D[zid] && ZMoves.D[zid].a[this.key(k)]; if (!A) return 0;
    const fps = A.fps || 12, [tot] = this.aLen(k); let t = A.l && tot > 0 ? s.t % tot : Math.min(s.t, tot - 1e-4);
    for (let i = 0; i < A.f.length; i++) { const d = (A.f[i][7] || 1) / fps; if (t < d) return i; t -= d; }
    return A.f.length - 1;
  }
  cFrame() { const c = this.cut; if (!c) return 0; const M = this.D.cut[c.anim]; if (!M) return 0; let ms = c.t * 1000 * (c.rate || 1); const tot = M.f.reduce((a, f) => a + f[4], 0); if (M.loop && tot) ms %= tot; for (let i = 0; i < M.f.length; i++) { if (ms < M.f[i][4]) return i; ms -= M.f[i][4]; } return M.f.length - 1; }
  /* ---------- guion ---------- */
  E(e) {
    if (!e) return 0;
    switch (e[0]) {
      case 'n': case 's': return e[1];
      case 'g': return this.g[e[1]] || 0;
      case 'v': return (this.v[e[1]] || {})[e[2]] || 0;
      case 'op': {
        const a = this.E(e[2]), b = this.E(e[3]);
        switch (e[1]) { case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return b ? a / b : 0; case '%': return b ? a % b : 0; case '&': return String(a) + String(b); case '=': return a == b ? 1 : 0; case '<>': return a != b ? 1 : 0; case '<': return a < b ? 1 : 0; case '>': return a > b ? 1 : 0; case '<=': return a <= b ? 1 : 0; case '>=': return a >= b ? 1 : 0; }
        return 0;
      }
      case 'f': {
        const A = (e[2] || []).map((x) => this.E(x));
        switch (e[1]) { case 'dt': return this.dt; case 'choose': return A[Math.floor(Math.random() * A.length)] || 0; case 'random': return A.length > 1 ? A[0] + Math.random() * (A[1] - A[0]) : Math.random() * (A[0] || 1); case 'distance': return Math.hypot(A[2] - A[0], A[3] - A[1]); case 'abs': return Math.abs(A[0]); case 'min': return Math.min(...A); case 'max': return Math.max(...A); case 'floor': case 'int': return Math.floor(A[0]); case 'round': return Math.round(A[0]); }
        return 0;
      }
      case 'x': {
        const w = e[1], fn = e[2], o = this.obj(w);
        if (fn === 'X') return o ? o.X : w === 'CUT' && this.cut ? this.cut.X : w === 'CAM' ? this.cam.X : 850;
        if (fn === 'Y') return o ? o.Y : w === 'CUT' && this.cut ? this.cut.Y : w === 'CAM' ? this.cam.Y : 906;
        if (fn === 'ImagePointX' || fn === 'ImagePointY') { const q = o || this.o.W; return fn === 'ImagePointX' ? q.X : q.Y - 100; }
        if (fn === 'AnimationFrame') return w === 'CUT' ? this.cFrame() : this.s[this.spr(w)] ? this.aFrame(this.spr(w)) : 0;
        return 0;
      }
    }
    return 0;
  }
  /** Caja (W / L) de un papel: también sus sprites, que van pegados a ella */
  obj(w) { return w === 'W' || w === 'WS' || w === 'WV' ? this.o.W : w === 'L' || w === 'LS' || w === 'LV' ? this.o.L : null; }
  spr(w) { return w === 'WS' || w === 'WV' ? 'WS' : w === 'LS' || w === 'LV' ? 'LS' : null; }
  cond(c, node, ctx) {
    const [w, fn, beh, inv, P] = c, E = (i) => this.E(P[i]); let r;
    const sk = this.spr(w);
    switch (fn) {
      case 'IsAnimPlaying': r = sk ? this.s[sk].anim === E(0) : w === 'CUT' ? !!this.cut && this.cut.anim === E(0) : this.ob[w] === E(0); break;
      case 'OnAnimFinished': r = sk ? this.s[sk].fin === E(0) : w === 'CUT' ? !!this.cut && this.cut.fin === E(0) : false; break;
      case 'CompareFrame': r = ZDF_CMP(sk ? this.aFrame(sk) : w === 'CUT' && this.cut ? this.cFrame() : -1, E(0), E(1)); break;
      case 'OnFrameChanged': r = sk ? this.s[sk].fch : false; break;
      case 'IsMirrored': r = sk ? this.s[sk].mir : w === 'CUT' && this.cut ? !!this.cut.mir : false; break;
      case 'CompareInstanceVar': r = ZDF_CMP((this.v[w] || {})[E(0)] || 0, E(1), E(2)); break;
      case 'IsBoolInstanceVarSet': r = !!(this.v[w] || {})[E(0)]; break;
      case 'CompareX': { const o = this.obj(w); r = !!o && ZDF_CMP(o.X, E(0), E(1)); break; }
      case 'CompareY': { const o = this.obj(w); r = !!o && ZDF_CMP(o.Y, E(0), E(1)); break; }
      case 'IsOverlapping': {                                           // se tocan (o se han cruzado desde el paso anterior: van muy rápido)
        const a = this.obj(w), b = this.obj(P[0] && P[0][1]); if (!a || !b || a === b) { r = false; break; }
        const dx = b.X - a.X, dy = b.Y - a.Y, k = node, last = this.ov.get(k); this.ov.set(k, dx);
        r = (Math.abs(dx) < 130 && Math.abs(dy) < 170) || (last !== undefined && Math.sign(last) !== Math.sign(dx) && Math.abs(dy) < 320);
        break;
      }
      case 'IsTagPlaying': { const q = this.au[E(0)]; r = !!q && this.t >= q[0] && this.t < q[0] + q[1]; break; }
      case 'OnEnded': r = this.ended.has(E(0)); break;
      case 'CompareVar': r = ZDF_CMP(this.g[P[0] && P[0][1]] || 0, E(1), E(2)); break;
      case 'TriggerOnce': { const last = this.tk.get(node); this.tk.set(node, this.tick); r = last !== this.tick - 1; break; }
      case 'Every': { const last = this.ev.get(node); r = last === undefined || this.t - last >= E(0) - 1e-6; if (r) this.ev.set(node, this.t); break; }
      case 'Else': r = !ctx.prev; break;
      case 'IsVisible': case 'PickByUID': case 'LayerVisible': r = true; break;
      case 'CompareWidth': case 'CompareHeight': r = !!this.ko && this.t - this.ko > 0.8; break;   // el letrero del K.O. ya ha crecido
      case 'Compare': r = ZDF_CMP(E(0), E(1), E(2)); break;
      default: r = false;
    }
    return inv ? !r : r;
  }
  act(a, rest) {
    const [w, fn, beh, P] = a, E = (i) => this.E(P[i]), o = this.obj(w), sk = this.spr(w);
    switch (fn) {
      case 'Wait': { const q = { t: this.t + E(0), acts: rest, cut: this.wcut !== undefined ? this.wcut : this.cut }; this.wait.push(q); return q; }   // recuerda qué cinemática era «la suya»
      case 'SetPos': if (o && (w === 'W' || w === 'L')) { o.X = E(0); o.Y = E(1); } else if (w === 'CAM') { this.cam.X = E(0); this.cam.Y = E(1); } else if (w === 'CUT' && this.cut) { this.cut.X = E(0); this.cut.Y = E(1); } break;
      case 'SetX': if (o && (w === 'W' || w === 'L')) o.X = E(0); else if (w === 'CAM') this.cam.X = E(0); break;
      case 'SetY': if (o && (w === 'W' || w === 'L')) o.Y = E(0); else if (w === 'CAM') this.cam.Y = E(0); break;
      case 'MoveAtAngle': if (o) { const an = E(0) * Math.PI / 180, d = E(1); o.X += Math.cos(an) * d; o.Y += Math.sin(an) * d; } break;
      case 'SetPosToObject': { const b = this.obj(P[0] && P[0][1]); if (o && b) { o.X = b.X; o.Y = b.Y; } break; }
      case 'SetAnim':
        if (sk) this.anim(sk, E(0));
        else if (w !== 'CUT') this.ob[w] = E(0);                       // un fondo o un efecto: se apunta qué animación lleva
        if (w === 'CUT') { if (!this.cut) this.cut = { X: 544, Y: 292, layer: 'TEXTOS' }; if (this.cut.anim !== E(0)) { this.cut.anim = E(0); this.cut.t = 0; this.cut.fin = ''; this.cut.rate = 1; this.cut.out = 0; } }
        break;
      case 'SetAnimSpeed': if (sk) { const L = this.aLen(sk); this.s[sk].rate = E(0) / L[1]; if (E(0) > 0) this.s[sk].hold = false; } else if (w === 'CUT' && this.cut) { const M = this.D.cut[this.cut.anim]; this.cut.rate = M && M.sp ? E(0) / M.sp : 1; } break;
      case 'SetAnimFrame': if (sk) { const zid = sk === 'WS' ? this.zw : this.zl, A = ZMoves.D[zid] && ZMoves.D[zid].a[this.key(sk)]; if (A) { let t = 0; for (let i = 0; i < Math.min(E(0), A.f.length); i++) t += (A.f[i][7] || 1) / (A.fps || 12); this.s[sk].t = t; } } break;
      case 'SetMirrored': if (sk) this.s[sk].mir = E(0) === 0; else if (w === 'CUT' && this.cut) this.cut.mir = E(0) === 0; break;   // en Construct 2: 0 = espejado, 1 = normal
      case 'SetSize': if (w === 'CUT' && this.cut) { this.cut.w = E(0); this.cut.h = E(1); } break;
      case 'MoveToLayer': if (w === 'CUT' && this.cut) this.cut.layer = E(0); break;
      case 'Destroy': if (/efeitobranconatela/.test(w)) this.white = null; else if (w === 'CUT') { if (this.wcut === undefined || this.wcut === this.cut) this.cut = null; }   // un Destroy aplazado solo borra la cinemática que había al esperar else if (w === 't299' || w === 'legendas_background') this.say(''); break;
      case 'SetInstanceVar': (this.v[w] || (this.v[w] = {}))[E(0)] = E(1); break;
      case 'AddInstanceVar': { const V = this.v[w] || (this.v[w] = {}); V[E(0)] = (V[E(0)] || 0) + E(1); break; }
      case 'SubInstanceVar': { const V = this.v[w] || (this.v[w] = {}); V[E(0)] = (V[E(0)] || 0) - E(1); break; }
      case 'SetBoolInstanceVar': (this.v[w] || (this.v[w] = {}))[E(0)] = E(1) ? 1 : 0; break;
      case 'SetVar': if (P[0] && P[0][0] === 'g') this.g[P[0][1]] = E(1); break;
      case 'CallFunction': if (/DESPAUSAR/.test(E(0))) { this.s.WS.hold = false; this.s.LS.hold = false; } break;   // «despausar» vuelve a mover a los luchadores
      case 'SetLayerScale': if (/Personagens/.test(E(0))) this.zoom = Math.max(0.3, E(1)); break;
      case 'Shake': this.V.cam.shake(Math.min(1.2, E(0) / 7), 0); break;
      case 'SetText': this.say(E(0)); break;
      case 'Play': this.play(E(0), E(3)); break;
      case 'PlayByName': this.play(E(1), E(4)); break;
      case 'Stop': { const q = this.au[E(0)]; if (q && q[2]) { try { q[2].stop(); } catch (e) { /* ya parado */ } q[1] = this.t - q[0]; } break; }
      case 'CreateObject': {
        const k = P[0] && P[0][1];
        if (k === 'CUT') this.cut = { X: E(2), Y: E(3), layer: E(1), anim: '', t: 0, rate: 1 };
        else if (/efeitobranconatela/.test(k)) this.white = { t0: this.t, fin: 3, wt: 0, fout: 0, on: 0 };
        else if (/ko_txt/.test(k)) this.koShow();
        break;
      }
      case 'SetFadeInTime': if (/efeitobranconatela/.test(w) && this.white) this.white.fin = E(0); break;
      case 'SetWaitTime': if (/efeitobranconatela/.test(w) && this.white) this.white.wt = E(0); break;
      case 'SetFadeOutTime': if (/efeitobranconatela/.test(w) && this.white) this.white.fout = E(0); break;
      case 'StartFade': if (/efeitobranconatela/.test(w)) { if (!this.white) this.white = { fin: 3, wt: 0, fout: 0 }; this.white.t0 = this.t; this.white.on = 1; } break;
    }
    return null;
  }
  acts(L) { for (let i = 0; i < L.length; i++) { const q = this.act(L[i], L.slice(i + 1)); if (q) return q; } return null; }   // devuelve la espera, si la hay
  subs(S) { const sub = { prev: true }; for (const s of S) sub.prev = this.run(s, sub); }
  run(t, ctx) {
    let ok;
    if (t.or) { ok = false; for (const c of t.c) if (this.cond(c, t, ctx)) ok = true; }
    else { ok = true; for (const c of t.c) if (!this.cond(c, t, ctx)) { ok = false; break; } }
    if (!ok) return false;
    const q = t.a ? this.acts(t.a) : null;
    if (t.s) { if (q) q.subs = t.s; else this.subs(t.s); }                // como en Construct 2: tras un Wait, los sub-eventos también esperan
    return true;
  }
  /* ---------- sonido, subtítulos, K.O. ---------- */
  play(name, tag) {
    const k = String(name).toLowerCase(), m = this.D.snd[k]; if (!m) return;
    const B = ZDFL.buf[m[0]], c = SFX.ctx; let src = null;
    if (B && c && SFX.sfxG) { try { src = c.createBufferSource(); const g = c.createGain(); src.buffer = B; g.gain.value = /^df|^v/.test(k) ? 1.5 : 1; src.connect(g); g.connect(SFX.sfxG); src.start(); this.src.push(src); } catch (e) { src = null; } }
    if (tag) this.au[tag] = [this.t, m[1] || 1, src];
  }
  say(s) { this.txt = s; this.tEl.textContent = s; this.tEl.style.opacity = s ? 1 : 0; }
  koShow() { if (this.ko) return; this.ko = this.t; this.kEl.style.opacity = 1; this.kEl.style.transform = 'scale(1)'; SFX.play('stinger'); setTimeout(() => { if (this.kEl) { this.kEl.style.opacity = 0; } }, 2200); }
  /* ---------- un paso ---------- */
  /** Avanza a pasos fijos de 1/60 s (como el original: las velocidades van por dt) */
  update(dt) {
    if (this.done) return;
    this.acc = Math.min(this.acc + dt, 0.25);
    while (this.acc >= 1 / 60 && !this.done) { this.acc -= 1 / 60; this.step(1 / 60); }
    if (!this.done) this.draw();
  }
  step(dt) {
    this.dt = dt; this.t += dt; this.tick++;
    for (const k of ['WS', 'LS']) {                                     // animaciones: avanzan y avisan al acabar
      const s = this.s[k], L = this.aLen(k), f0 = this.aFrame(k);
      s.t += dt * (s.hold ? 0 : s.rate ? s.rate : 1); s.fin = '';
      if (!L[3] && s.t >= L[0] && !s.out) { s.fin = s.anim; s.out = s.anim; } else if (s.out && s.out !== s.anim) s.out = '';
      s.fch = this.aFrame(k) !== f0;
    }
    if (this.cut) { const c = this.cut, M = this.D.cut[c.anim]; c.t += dt; c.fin = ''; if (M && !M.loop) { const tot = M.f.reduce((a, f) => a + f[4], 0) / 1000 / (c.rate || 1); if (c.t >= tot && !c.out) { c.fin = c.anim; c.out = 1; } } }
    this.ended.clear();
    for (const tag in this.au) { const q = this.au[tag]; if (!q[3] && this.t >= q[0] + q[1]) { q[3] = 1; this.ended.add(tag); } }
    for (let i = 0; i < this.wait.length; i++) { const w = this.wait[i]; if (this.t >= w.t) { this.wait.splice(i--, 1); this.wcut = w.cut; const q = this.acts(w.acts); if (w.subs) { if (q) q.subs = w.subs; else this.subs(w.subs); } this.wcut = undefined; } }
    for (const t of this.D.ev) this.run(t, {});
    // Fogonazo blanco (Fade del original: entra, espera y sale; sin salida se queda en blanco)
    const W = this.white; let wa = 0;
    if (W && W.on) { const t = this.t - W.t0; wa = t < W.fin ? t / Math.max(0.01, W.fin) : t < W.fin + W.wt || !W.fout ? 1 : Math.max(0, 1 - (t - W.fin - W.wt) / W.fout); }
    this.wEl.style.opacity = wa;
    const sig = [this.s.WS.anim, this.s.LS.anim, this.cut && this.cut.anim, this.cut && !this.cut.out && this.D.cut[this.cut.anim] && !this.D.cut[this.cut.anim].loop && this.cFrame(), this.txt, Object.keys(this.au).length].join('|');   // la cinemática corriendo también cuenta
    if (sig !== this.sig) { this.sig = sig; this.still = 0; } else if ((this.still += dt) > 8 && !this.ko) { this.white = { t0: this.t, fin: 0.6, wt: 0.4, fout: 0.6, on: 1 }; this.koShow(); }   // atascada: se cierra con el K.O.
    // Fin: tras el K.O., cuando el ganador ha dicho su última frase y la escena se ha quedado quieta (como mucho 25 s después)
    if (this.ko && ((this.t > this.ko + 3 && this.still > 1.2 && !this.wait.length && Object.values(this.au).every((q) => q[3] || this.t >= q[0] + q[1])) || this.t > this.ko + 25)) this.finish();   // y sin esperas pendientes (las Gogeta siguen tras el K.O.)
    if (this.t > 70) this.finish();
  }
  draw() {
    const c = this.cv; c.clearRect(0, 0, 1088, 584);
    const C = this.cut, M = C && this.D.cut[C.anim]; if (!M || !this.im.complete) return;
    const f = M.f[this.cFrame()]; if (!f) return;
    const [x, y, w, h] = f, W = C.w || 1088, H = C.h || (C.w ? C.w * h / w : 584), full = true;   // siempre a pantalla completa (en el original, con el zoom de la escena, también la llenan)
    let dx, dy, dw, dh;
    if (full) { const s = Math.max(1088 / w, 584 / h); dw = w * s; dh = h * s; dx = (1088 - dw) / 2; dy = (584 - dh) / 2; }   // a pantalla completa
    else { dw = W; dh = H; dx = 544 - dw / 2; dy = 292 - dh / 2; }
    c.save(); if (C.mir) { c.translate(1088, 0); c.scale(-1, 1); }
    c.drawImage(this.im, x, y, w, h, dx, dy, dw, dh); c.restore();
  }
  finish() {
    if (this.done) return; this.done = true;
    for (const s of this.src) { try { s.stop(); } catch (e) { /* ya parado */ } }
    removeEventListener('keydown', this.skip); removeEventListener('pointerdown', this.skip);
    this.el.remove(); SFX.setDuck && SFX.setDuck(1);
    (this.hud || []).forEach((n) => { n.style.visibility = n.dataset.dfv || ''; });
    this.V.cam.cine = null;
    const sim = this.V.sim; if (sim) sim.dfT = sim.pt + 0.4;
  }
}
