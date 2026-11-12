'use strict';
/* =====================================================================
   vfx.js · Efectos animados con sprites (atlas fx, fxbig, props y tall):
   explosiones, destellos, auras, rayos, escudos, grietas, cráteres...
   y el decorado animado de cada mapa (volcanes, tornados, nieve).
   Todo va en pocos lotes (SpriteBatch): una llamada de dibujo por lote.
   ===================================================================== */

const FXA = window.FX_ANIMS || {};
/* Efectos de Z Legends 3 (assets/zl3.js, hojas zfx de 64 px y zfxb de 192 px): se añaden con el prefijo Z (Zboom1, ZkbY…).
   `k` = escala a la que se metió el dibujo en su casilla; w/h = tamaño del dibujo original en píxeles */
for (const k in (window.ZFX_ANIMS || {})) FXA['Z' + k] = window.ZFX_ANIMS[k];
/* Efectos de pixelfx (assets/pfx.js, github.com/patch-gg/pixelfx, MIT): prefijo P (Pstrike, Pshield…).
   Hojas pfx (128 px, apoyo en el centro) y pfxg (192 px, apoyo abajo: rayos que caen, portales, círculos).
   `e` = fracción de la casilla que ocupa el dibujo: pplay() pide el tamaño real del efecto */
for (const k in (window.PFX_ANIMS || {})) FXA['P' + k] = window.PFX_ANIMS[k];
/* Color de Z Legends 3 para un color de ataque (Y amarillo, O naranja, R rojo, B azul, P morado, G verde, K rosa) */
/* Efectos de siempre que pasan a dibujarse con los de Z Legends 3: nombre -> [efecto Z, escala de tamaño] */
const Z3_ALIAS = { hitRing: ['Zhit', 1.1], meteorHit: ['Zextreme', 1.2], kameImp: ['Zkiboom', 1.2], fireBoom: ['Zboom1', 1.1], cellBoom: ['Zboom3', 1.1] };
const Z3_BEAM = { Y: 'Y', O: 'Y', R: 'K', B: 'B', P: 'P', G: 'G', K: 'K' };
const Z3_AURA = { Y: 'Y', O: 'D', R: 'R', B: 'C', P: 'K', G: 'G', K: 'K' };
/** Color del aura de Z Legends 3 para un color: blanco (Ultra Instinto), amarillo, dorado, rojo, rosa, azul, verde… */
function auraKey(hex) {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255, mx = Math.max(r, g, b);
  if (!mx || (mx - Math.min(r, g, b)) / mx < 0.25) return 'W';
  return Z3_AURA[zipKind(hex)];
}
const Z3_BOOM = { Y: 'Zboom1', O: 'Zboom1', R: 'Zboom1', B: 'Zboom3', P: 'Zboom10', G: 'Zboom1', K: 'Zboom10' };
let FX_SHEETS = null;                       // hojas de efectos y objetos (las usa también world.js para el decorado)

/** Índice en el atlas del fotograma k de la animación `name` (se queda en el último si k se pasa) */
const fxf = (name, k) => { const a = FXA[name]; return a ? a.f[clamp(k | 0, 0, a.f.length - 1)] : 0; };
const fxn = (name) => (FXA[name] ? FXA[name].f.length : 1);

/* Esferas de energía (fila de 8 de la hoja): amarilla, dorada, roja, roja oscura, azul, azul oscura, morada y morada oscura.
   Se elige la más parecida al color pedido para que cada disparo conserve su color. */
const ORB_HUES = [[255, 230, 90], [235, 180, 50], [240, 70, 70], [200, 40, 50], [90, 200, 255], [60, 130, 230], [190, 110, 255], [140, 70, 210]];
function orbIndex(hex) {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  if (r > 225 && g > 225 && b > 225) return 4;                    // blanco: esfera azul clara
  let best = 0, bd = 1e9;
  for (let i = 0; i < 8; i++) { const c = ORB_HUES[i], d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2; if (d < bd) { bd = d; best = i; } }
  return best;
}
/** Fotograma de esfera para un color (fila 0 = grande y brillante, 2 = pequeña) */
const orbFrame = (hex, row) => fxf('orb', (row || 0) * 8 + orbIndex(hex));
/* Efectos del pack (hoja fxzip, pixel art): el color de cada ataque elige su bola, su impacto, su explosión y su rayo.
   Y amarillo · O naranja · R rojo · B azul/blanco · P morado · G verde · K rosa */
function zipKind(hex) {
  const r = ((hex >> 16) & 255) / 255, g = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (mx === 0 || d / mx < 0.25) return 'B';
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360;
  return h < 15 || h >= 345 ? 'R' : h < 42 ? 'O' : h < 70 ? 'Y' : h < 165 ? 'G' : h < 250 ? 'B' : h < 290 ? 'P' : 'K';
}
/* Dibujo de los efectos del pack (hoja fxzip). Está APAGADO: los ataques usan sus dibujos de siempre.
   Pon true para volver a verlos (rayos, impactos, explosiones y técnicas del pack). */
const ZIP_FX = false;
const ZIP_BALL ={ Y: ['zkiY', 0], O: ['zfireO', 0], R: ['zkiR', 0], B: ['zsphereB', 0], P: ['zkiP', 0], G: ['zkiG', 0], K: ['zpink', 0] };
const ZIP_HIT = { Y: 'zstarG', O: 'zfireO', R: 'zburstR', B: 'zsphereB', P: 'zburstP', G: 'zburstG', K: 'zpinkB' };
const ZIP_BOOM = { Y: 'zsunX', O: 'zsunX', R: 'zfireB', B: 'zsphereB', P: 'zburstP', G: 'zburstG', K: 'zpinkB' };
/* Destellos de ki (4 filas de 7: amarillo, azul, morado y rojo) */
function flashRow(hex) {
  const i = orbIndex(hex);
  return i <= 1 ? 0 : i <= 3 ? 3 : i <= 5 ? 1 : 2;
}

class VFX {
  constructor(scene, sheets) {
    FX_SHEETS = sheets;
    this.ok = !!(sheets && sheets.fx && sheets.fxbig && sheets.props && FXA.flash);
    this.on = false; this.n = 0; this.load = 1;
    if (!this.ok) return;
    for (const k of ['fx', 'fxbig']) { const t = sheets[k].tex; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
    const B = (sh, o) => new SpriteBatch(scene, Object.assign({ texture: sh.tex, cols: sh.cols, rows: sh.rows, w: 1, h: 1, anchor: 0.5, cut: 0.02 }, o));
    // Lotes: 0 efectos de pie · 1 efectos tumbados en el suelo · 2 efectos grandes · 3 auras (detrás del personaje)
    //        4 calcomanías del suelo · 5 objetos animados (cápsulas, volcanes, escombros) · 6 esferas sólidas
    this.b = [
      B(sheets.fx, { max: 600, additive: true, renderOrder: 6 }),
      B(sheets.fx, { max: 200, additive: true, flat: true, renderOrder: 4 }),
      B(sheets.fxbig, { max: 60, additive: true, renderOrder: 6 }),
      B(sheets.fxbig, { max: 12, additive: true, anchor: 0.04, renderOrder: 2.5 }),
      B(sheets.props, { max: 90, blend: true, flat: true, renderOrder: 1 }),
      B(sheets.props, { max: 80, blend: true, anchor: 0.04, renderOrder: 2 }),
      B(sheets.fx, { max: 16, blend: true, renderOrder: 6 }),       // 6: esferas sólidas (Genkidama): con su color real, sin quemarse a blanco
      B(sheets.fxzip || sheets.fx, { max: 500, blend: true, renderOrder: 6.5 }),  // 7: efectos del pack (pixel art nítido)
      B(sheets.zfx || sheets.fx, { max: 600, blend: true, renderOrder: 6.6 }),     // 8: efectos de Z Legends 3 pequeños (ráfagas, impactos)
      B(sheets.zfxb || sheets.fx, { max: 260, blend: true, renderOrder: 6.4, noDepth: true }),    // 9: efectos de Z Legends 3 grandes (rayos, explosiones, auras)
      B(sheets.pfx || sheets.fx, { max: 160, blend: true, renderOrder: 6.7 }),                    // 10: pixelfx centrados (impactos, escudo, explosiones)
      B(sheets.pfxg || sheets.fx, { max: 60, blend: true, anchor: 0.01, renderOrder: 6.3 })       // 11: pixelfx apoyados en el suelo (rayos, portal, curación)
    ];
    this.pfx = !!(sheets.pfx && sheets.pfxg && FXA.Pstrike);
    this.z3 = !!(sheets.zfx && sheets.zfxb && FXA.ZkbY) && (typeof Save === 'undefined' || Save.d.opt.z3fx !== false);
    this.zipOk = ZIP_FX && !!sheets.fxzip && !!FXA.zkiY;
    this.rx = 1; this.rz = 0;                                             // eje «derecha» de la cámara (para girar los efectos)
    // Pool de animaciones (estructura de arrays: sin crear objetos durante la partida)
    const N = this.N = 520, f = () => new Float32Array(N);
    this.act = new Uint8Array(N); this.bi = new Uint8Array(N); this.fr = new Array(N).fill(null);
    this.x = f(); this.y = f(); this.z = f(); this.vx = f(); this.vy = f(); this.vz = f();
    this.t = f(); this.dur = f(); this.loop = f(); this.s0 = f(); this.s1 = f(); this.al = f(); this.rot = f(); this.spin = f();
    this.tint = new Int32Array(N); this.flags = new Uint8Array(N);      // 1 = se desvanece al final · 2 = sigue al jugador · 4 = volteado
    this.free = []; for (let i = N - 1; i >= 0; i--) this.free.push(i);
    this.list = new Int32Array(N); this.cnt = 0;                         // índices activos
    this.bk = { x: 0, z: 0 };                                            // "hacia atrás" de la cámara (para dibujar auras detrás)
    this.flashRows = [0, 1, 2, 3].map((r) => FXA.flash.f.slice(r * 7, r * 7 + 7));
  }

  /** Lanza una animación. Opciones: size, grow (tamaño final relativo), dur o fps, loop (segundos: repite los fotogramas),
      tint, alpha, rot, spin, flat (tumbada en el suelo), vx/vy/vz, fade (true), follow (sigue al jugador), flip, pri (1 = no se descarta) */
  play(name, x, y, z, o) {
    if (!this.ok) return -1;
    if (this.z3 && Z3_ALIAS[name] && !(o && o.frames)) { const al = Z3_ALIAS[name]; return this.z3play(al[0], x, y, z, ((o && o.size) || 2) * al[1], Object.assign({}, o, { tint: 0xffffff })); }
    const a = FXA[name]; if (!a) return -1;
    o = o || {};
    if (!o.pri && this.cnt > this.N * 0.8 * this.load) return -1;        // con mucha carga se descartan los efectos menores
    const i = this.free.pop(); if (i === undefined) return -1;
    const flat = !!o.flat, sh = a.s;
    this.bi[i] = sh === 'pfx' ? 10 : sh === 'pfxg' ? 11 : sh === 'zfx' ? 8 : sh === 'zfxb' ? 9 : sh === 'fxzip' ? 7 : sh === 'fxbig' ? 2 : sh === 'props' ? (flat ? 4 : 5) : flat ? 1 : 0;
    this.fr[i] = o.frames || a.f; this.act[i] = 1; this.list[this.cnt++] = i;
    this.x[i] = x; this.y[i] = y; this.z[i] = z; this.vx[i] = o.vx || 0; this.vy[i] = o.vy || 0; this.vz[i] = o.vz || 0;
    this.t[i] = 0; this.loop[i] = o.loop || 0;
    this.dur[i] = o.dur || (o.frames || a.f).length / (o.fps || 20);
    this.s0[i] = o.size || 2; this.s1[i] = (o.size || 2) * (o.grow || 1); this.al[i] = o.alpha === undefined ? 1 : o.alpha;
    this.rot[i] = o.rot || 0; this.spin[i] = o.spin || 0; this.tint[i] = o.tint === undefined ? 0xffffff : o.tint;
    this.flags[i] = (o.fade === false ? 0 : 1) | (o.follow ? 2 : 0) | (o.flip ? 4 : 0);
    return i;
  }
  /** Efecto de pixelfx con su tamaño real en el mundo (size = ancho del dibujo, no de la casilla) y a su velocidad.
      Devuelve -1 si no están las hojas (el que llama pone entonces su efecto de siempre) */
  pplay(name, x, y, z, size, o) {
    const a = FXA[name]; if (!this.pfx || !a) return -1;
    return this.play(name, x, y, z, Object.assign({ fps: a.fps, fade: false }, o, { size: size / (a.e || 1) }));
  }
  /** Fotograma k (en bucle) de un efecto de pixelfx, dibujado solo este cuadro (escudos, círculos que siguen a alguien) */
  pnow(name, t, x, y, z, size, alpha, tint) {
    const a = FXA[name]; if (!this.pfx || !a || !this.on) return false;
    const k = ((t * a.fps) | 0) % a.f.length;
    this.b[a.s === 'pfxg' ? 11 : 10].push(x, y, z, a.f[k], 0, 0, size / (a.e || 1), alpha === undefined ? 1 : alpha, tint === undefined ? 0xffffff : tint);
    return true;
  }
  /** Un fotograma suelto solo para este cuadro (auras, brillos que siguen a algo). batch: 0..5 como en this.b */
  now(batch, frame, x, y, z, size, alpha, tint, rot, flip) {
    if (this.on) this.b[batch].push(x, y, z, frame, flip ? 1 : 0, 0, size, alpha, tint, rot);
  }
  /** Aura de fuego detrás de un personaje (fotogramas de `name` en bucle), un poco desplazada hacia el fondo */
  aura(name, x, z, size, tint, alpha, t) {
    if (!this.on) return;
    const n = fxn(name), k = ((t * 12) | 0) % n;
    this.b[3].push(x + this.bk.x * 0.35, 0, z + this.bk.z * 0.35, fxf(name, k), ((t * 3) | 0) & 1, 0, size, alpha, tint);
  }
  stop(i) { if (i >= 0 && this.act[i]) this.dur[i] = 0, this.loop[i] = 0; }
  /** Al principio de cada cuadro: vacía los lotes (luego cada sistema añade lo suyo) */
  begin(camera) {
    if (!this.ok) return;
    this.on = true;
    for (const b of this.b) b.begin();
    if (camera) { const e = camera.matrixWorld.elements, l = Math.hypot(e[8], e[10]) || 1, m = Math.hypot(e[0], e[2]) || 1; this.bk.x = -e[8] / l; this.bk.z = -e[10] / l; this.rx = e[0] / m; this.rz = e[2] / m; }
  }
  /** Al final del cuadro: avanza las animaciones, las dibuja y sube los lotes a la GPU */
  flush(dt, player) {
    if (!this.ok || !this.on) return;
    this.on = false;
    for (let k = this.cnt - 1; k >= 0; k--) {
      const i = this.list[k];
      this.t[i] += dt;
      const life = this.loop[i] || this.dur[i];
      if (this.t[i] >= life) {                                      // termina: vuelve al pool
        this.act[i] = 0; this.fr[i] = null; this.free.push(i); this.list[k] = this.list[--this.cnt];
        continue;
      }
      this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt; this.z[i] += this.vz[i] * dt; this.rot[i] += this.spin[i] * dt;
      const fr = this.fr[i], u = this.t[i] / life, fl = this.flags[i];
      const k2 = this.loop[i] ? ((this.t[i] / this.dur[i]) * fr.length | 0) % fr.length : Math.min(fr.length - 1, (this.t[i] / this.dur[i]) * fr.length | 0);
      const a = this.al[i] * ((fl & 1) && u > 0.65 ? (1 - u) / 0.35 : 1), s = this.s0[i] + (this.s1[i] - this.s0[i]) * u;
      let x = this.x[i], z = this.z[i];
      if ((fl & 2) && player) { x += player.x; z += player.z; }
      this.b[this.bi[i]].push(x, this.y[i], z, fr[k2], fl & 4 ? 1 : 0, 0, s, a, this.tint[i], this.rot[i]);
    }
    this.n = this.cnt;
    for (const b of this.b) b.end();
  }
  reset() {
    if (!this.ok) return;
    for (let k = 0; k < this.cnt; k++) { const i = this.list[k]; this.act[i] = 0; this.fr[i] = null; this.free.push(i); }
    this.cnt = 0;
    for (const b of this.b) b.reset();
  }

  /* ---------- Efectos del pack (fxzip) ---------- */
  /** Ángulo en pantalla de una dirección del suelo (para que los efectos miren hacia donde van) */
  ang(dx, dz) { return Math.atan2(dx * this.bk.x + dz * this.bk.z, dx * this.rx + dz * this.rz); }
  /** Un fotograma del pack para este cuadro, con el dibujo de `size` unidades (no la casilla) */
  zip(name, k, x, y, z, size, rot, alpha) {
    const a = FXA[name]; if (!this.zipOk || !a) return;
    this.now(7, fxf(name, k), x, y, z, size / (a.e || 1), alpha === undefined ? 1 : alpha, 0xffffff, rot || 0);
  }
  /** Animación del pack (dibujo de `size` unidades) */
  zplay(name, x, y, z, size, o) {
    const a = FXA[name]; if (!this.zipOk || !a) return -1;
    return this.play(name, x, y, z, Object.assign({}, o, { size: size / (a.e || 1) }));
  }
  /* ---------- Efectos de Z Legends 3 ---------- */
  /** Tamaño de casilla (unidades del mundo) para que el dibujo mida `size` en su lado mayor */
  z3cell(a, size) { return size * (a.s === 'zfx' ? 64 : 192) / (Math.max(a.w, a.h) * a.k); }
  /** Un fotograma de un efecto Z para este cuadro */
  z3f(name, k, x, y, z, size, rot, alpha, tint) {
    const a = FXA[name]; if (!this.z3 || !a || !this.on) return;
    this.b[a.s === 'zfx' ? 8 : 9].push(x, y, z, a.f[(k | 0) % a.f.length], 0, 0, this.z3cell(a, size), alpha === undefined ? 1 : alpha, tint === undefined ? 0xffffff : tint, rot || 0);
  }
  /** Animación de un efecto Z (size = lado mayor del dibujo) */
  z3play(name, x, y, z, size, o) {
    const a = FXA[name]; if (!this.z3 || !a) return -1;
    return this.play(name, x, y, z, Object.assign({ fps: Math.max(10, a.fps) }, o, { size: this.z3cell(a, size) }));
  }
  /** Impacto del color del ataque */
  zhit(hex, x, y, z, size) {
    if (this.z3) return this.z3play('Zkh' + zipKind(hex), x, y, z, size * 0.9, { rot: Math.random() * 6.28, fade: false });
    const n = ZIP_HIT[zipKind(hex)]; return this.zplay(n, x, y, z, size, { fps: 18, rot: Math.random() * 6.28, frames: n === 'zfireO' ? [fxf('zfireO', 1)] : null, dur: 0.22 }); }
  /** Explosión del color del ataque */
  zboom(hex, x, z, r, big) {
    if (this.z3) return -1;                                      // con Z Legends 3 la explosión ya la dibuja boom()
    const n = ZIP_BOOM[zipKind(hex)]; return this.zplay(n, x, r * 0.5, z, r * 2.1, { dur: big ? 0.6 : 0.4, grow: 1.35, pri: big ? 1 : 0, alpha: 0.95 }); }

  /* ---------- Recetas: combinaciones listas para usar ---------- */
  /** Destello de ki del color pedido (amarillo, azul, morado o rojo) */
  flash(x, y, z, size, hex, o) {
    const i = this.play('flash', x, y, z, o ? Object.assign({ size, fps: 26 }, o) : { size, fps: 26 });
    if (i >= 0) this.fr[i] = this.flashRows[flashRow(hex)];
    return i;
  }
  /** Explosión: bola de fuego animada + destello + (si es grande) cráter en el suelo */
  boom(x, z, r, hex, big) {
    if (this.z3) this.z3play(big ? 'Zboom15' : Z3_BOOM[zipKind(hex === undefined ? 0xffa030 : hex)], x, r * 0.45, z, r * (big ? 1.7 : 1.5), { pri: big ? 1 : 0, fade: false });   // explosión de Z Legends 3
    else this.play('boom', x, r * 0.45, z, { size: r * 2.4, fps: 22, pri: big ? 1 : 0 });
    if (hex !== undefined) this.flash(x, r * 0.5, z, r * 1.6, hex);
    if (big) this.crater(x, z, r * 1.1, hex);
    if (big) {
      this.play('burstY', x, r * 0.3, z, { size: r * 1.5, grow: 1.25, dur: 0.45, alpha: 0.6, pri: 1 });
    }
  }
  /** Grietas de energía brillantes en el suelo, que se apagan poco a poco */
  crater(x, z, r, hex) {
    const f = FXA.pinkCrack; if (!f) return;
    this.play('pinkCrack', x, 0.1, z, { flat: true, size: r * 1.8, dur: 2.2, alpha: 0.7, pri: 1, tint: hex === undefined ? 0xffb050 : hex, frames: [f.f[3]], rot: Math.random() * 6.28 });
    this.play('pinkCrack', x, 0.1, z, { flat: true, size: r * 1.4, dur: 1.8, alpha: 0.6, pri: 1, tint: 0xffffff, frames: [f.f[6]], rot: Math.random() * 6.28 });
  }
  /** Polvo y piedras que se levantan (transformaciones, golpes al suelo) */
  dust(x, z, s) { const f = FXA.fissure; if (f) this.play('fissure', x, 0, z, { size: s, fps: 9, frames: f.f.slice(4), pri: 1 }); }
  /** Rayo que cae del cielo */
  bolt(x, z, h, hex) {
    this.play('boltCol', x, h * 0.5, z, { size: h, dur: 0.3, tint: hex, pri: 1 });
    this.play('bolt', x, 1.2, z, { size: 3.5, fps: 30, tint: hex });
  }
}
