'use strict';
/* =====================================================================
   weapons.js · Motor de armas. Cada arma de WEAPONS tiene un `kind` y
   un método con ese nombre aquí. Todo el estado vive en pools fijos:
   rayos, minas y impactos se reciclan, no se crean en el bucle.
   ===================================================================== */

const BASE_DMG = 10;
// Ki de las técnicas propias de cada personaje: de media gastan KI_DRAIN por segundo cada una (la regeneración base
// es 4 Ki/s); cada lanzamiento cuesta entre KI_MIN y KI_MAX según lo que tarda en recargar
const KI_DRAIN = 0.8, KI_MIN = 2, KI_MAX = 20;
/** Tipo de la técnica (física o de ki) y su gasto de Ki, para su carta */
function kiNote(id, p) {
  const D = WEAPONS[id]; if (!D || !p) return '';
  if (D.cat === 'fis') return '<br><span class="tcat tf">✊ FÍSICA · no gasta Ki</span>';
  const tag = '<br><span class="tcat tk">✺ DE KI</span>';
  if (D.kind === 'bigbeam' && D.cfg && D.cfg.cost) return tag + ' <span class="kin">⚡ Gasta ' + D.cfg.cost + ' de Ki</span>';
  if (D.kind === 'beam') return tag + ' <span class="kin">⚡ Gasta 10 de Ki</span>';
  if (D.unique !== p.ch.id || p.ch.start.includes(id)) return tag;
  return tag + ' <span class="kin">⚡ ' + (D.kind === 'orbit' ? 'Gasta Ki mientras está activa' : 'Gasta Ki al lanzarse') + '</span>';
}

/* Capas de los rayos: tamaño relativo al ancho y opacidad base (ver updateBeams) */
const BEAM_K = [2.6, 1.5, 0.7], BEAM_A = [0.10, 0.16, 0.22];

class WeaponSystem {
  constructor(scene, tex) {
    this.scene = scene;
    this.list = [];                                   // armas equipadas: {id, kind, lv, cd, ...}
    this._a = { dx: 1, dz: 0, d: 0, i: -1 };          // resultado reutilizable de aim()
    // Rayos (Kamehameha, Galick, Dodonpa): pool de 8
    this.beams = [];
    for (let i = 0; i < 12; i++) this.beams.push({ on: false, x: 0, z: 0, dx: 1, dz: 0, len: 20, hw: 1, dmg: 0, age: 0, life: 1, tick: 0, tickDt: 0.1, color: 0xffffff, follow: false, src: '' });
    this.beamB = new SpriteBatch(scene, { max: 1000, texture: tex.ki, w: 1, h: 1, anchor: 0.5, additive: true, cut: 0.02, renderOrder: 5 });
    this.orbB = new SpriteBatch(scene, { max: 24, texture: tex.ki, w: 1, h: 1, anchor: 0.5, additive: true, cut: 0.02, renderOrder: 5 });
    // Minas y meteoros: pools
    this.minePool = []; for (let i = 0; i < 8; i++) this.minePool.push({ on: false, x: 0, z: 0, arm: 0 });
    this.mineB = new SpriteBatch(scene, { max: 8, texture: tex.gem, w: 1, h: 1, anchor: 0.5, renderOrder: 1 });
    this.strikes = []; for (let i = 0; i < 40; i++) this.strikes.push({ on: false, x: 0, z: 0, t: 0, T: 0.6, big: false, r: 3, dmg: 0, tint: 0xffffff, src: '', sty: '' });
    // Agujeros negros (Guadaña del Dolor) y Célula Jr. (pools fijos)
    this.holes = []; for (let i = 0; i < 4; i++) this.holes.push({ on: false, x: 0, z: 0, t: 0, T: 2, R: 9, dmg: 0, tick: 0, col: 0xc070ff, bolt: false, src: '' });
    this.jrs = []; for (let i = 0; i < 10; i++) this.jrs.push({ on: false, x: 0, z: 0, t: 0, hit: 0, shot: 0, dmg: 0, beam: false, flip: 0, ph: 0, src: '' });
    this.jrB = null;                                  // lote de sprites de Célula Jr. (se crea al primer uso con la hoja de Célula)
  }

  reset(ch) {
    this.list.length = 0;
    for (const b of this.beams) b.on = false;
    for (const m of this.minePool) m.on = false;
    for (const s of this.strikes) s.on = false;
    for (const o of this.holes) o.on = false;
    for (const j of this.jrs) j.on = false;
    if (this.jrB) this.jrB.reset();
    this.beamB.reset(); this.orbB.reset(); this.mineB.reset();
    for (const id of ch.start) this.add(id);
  }

  get(id) { return this.list.find((w) => w.id === id); }
  levelOf(id) { const w = this.get(id); return w ? w.lv : 0; }
  /** Añade el arma (nivel 1) o la sube de nivel */
  add(id) {
    const w = this.get(id);
    if (w) { if (w.lv < MAX_WEAPON_LEVEL) w.lv++; return w; }
    const n = { id, kind: WEAPONS[id].kind, lv: 1, cd: 0.3, ang: Math.random() * 6.28, tick: 0, pend: 0, pdx: 1, pdz: 0 };
    this.list.push(n);
    return n;
  }

  /** Fusión: quita las dos técnicas de origen y añade la fusionada (ya al máximo) */
  fuse(id) {
    const F = WEAPONS[id];
    this.list = this.list.filter((w) => !F.fusion.includes(w.id));
    const n = this.add(id); n.lv = MAX_WEAPON_LEVEL; n.fused = true;
    return n;
  }

  /** Enemigo más cercano en `range`: devuelve el objeto reutilizable _a o null */
  aim(g, p, range) {
    const i = g.horde.nearest(p.x, p.z, range);
    if (i < 0) return null;
    const dx = g.horde.x[i] - p.x, dz = g.horde.z[i] - p.z, d = Math.sqrt(dx * dx + dz * dz) || 1;
    const a = this._a; a.dx = dx / d; a.dz = dz / d; a.d = d; a.i = i;
    return a;
  }
  /** Dirección de respaldo cuando no hay enemigo: hacia donde mira el personaje */
  facing(g, p) { const a = this._a; a.dx = (p.flip ? -1 : 1) * g.camCos; a.dz = (p.flip ? 1 : -1) * g.camSin; a.d = 0; a.i = -1; return a; }
  ready(w, dt, p) { if (w.cd > 0) { w.cd -= dt * p.rateMul; return false; } return true; }
  col(w, p) { return WEAPONS[w.id].color || p.form.ki; }

  /* ===== Técnicas con dibujo propio del pack (hoja fxzip) ===== */
  /** Proyectil configurable: cfg { n, spd, dmg, cd, size, look (animación del pack), spread, ring, pierce, aoe, home, life } */
  zshot(w, dt, g, p) {
    if (!this.ready(w, dt, p)) return;
    const C = WEAPONS[w.id].cfg, lv = w.fused ? 5 : w.lv, a = this.aim(g, p, C.range || 28); if (!a) return;
    const n = (C.n || 1) + (lv >= 3) + (lv >= 5), dm = C.dmg * (1 + 0.3 * (lv >= 2) + 0.3 * (lv >= 5)), col = this.col(w, p);
    w.cd = C.cd * (lv >= 4 ? 0.8 : 1);
    let crit = false;
    for (let i = 0; i < n; i++) {
      const o = C.ring ? (i / n) * 6.2832 : (i - (n - 1) / 2) * (C.spread || 0.18), c = Math.cos(o), s = Math.sin(o);
      crit = Math.random() < p.crit;
      const b = g.ki.fire(p.x, p.z, a.dx * c - a.dz * s, a.dx * s + a.dz * c, C.spd, dm * p.damageMul() * (crit ? p.critDmg : 1), C.r || 0.7, crit, C.life || 1.3, C.pierce || 0, C.aoe || 0, col, C.size * (crit ? 1.2 : 1), C.look);
      if (b && C.home) b.home = C.home;
    }
    if (g.vfx) g.vfx.zhit(col, p.x + a.dx * 1.2, 1.4, p.z + a.dz * 1.2, C.size * 0.7);    // fogonazo en las manos
    p.attack(a.dx, a.dz, crit, g);
  }
  /** Portal dimensional (Janemba): se abre junto a la horda y de él salen tajos durante 1,6 s */
  zportal(w, dt, g, p) {
    const C = WEAPONS[w.id].cfg, lv = w.fused ? 5 : w.lv, V = g.vfx, L = w.ps || (w.ps = []);
    const R = (C.r || 3.6) * (lv >= 3 ? 1.25 : 1), dm = C.dmg * (1 + 0.35 * (lv >= 2) + 0.35 * (lv >= 5));
    for (let k = L.length - 1; k >= 0; k--) {
      const o = L[k]; o.t += dt; o.hit -= dt;
      if (o.t > 1.6) { L.splice(k, 1); continue; }
      const q = (o.t * 10) | 0, open = Math.min(1, o.t * 5) * Math.min(1, (1.6 - o.t) * 5);
      if (V) { V.zip('zportal', q, o.x, 2.2, o.z, 4.4 * open, 0); if (o.t > 0.2) V.zip('zslashP', q, o.x + Math.sin(q * 2.1) * 1.2, 1.6, o.z + Math.cos(q * 1.7) * 1.2, R * 1.4, q * 1.3); }
      if (o.hit <= 0 && o.t > 0.2) { o.hit = 0.2; DMG_SRC = w.id; g.horde.damageRadius(o.x, o.z, R, dm * p.damageMul(), 6, g); g.world.damageArea(o.x, o.z, R, dm); SFX.play('slash'); }
    }
    if (!this.ready(w, dt, p)) return;
    const a = this.aim(g, p, 22); if (!a) return;
    w.cd = C.cd * (lv >= 4 ? 0.75 : 1);
    const n = 1 + (lv >= 5);
    for (let i = 0; i < n; i++) L.push({ x: g.horde.x[a.i] + rand(-2, 2) * i, z: g.horde.z[a.i] + rand(-2, 2) * i, t: 0, hit: 0 });
    SFX.play('rift');
  }
  /** Prisión del tiempo (Hit): encierra a varios enemigos en cubos de energía, los congela y les hace daño */
  zcage(w, dt, g, p) {
    const C = WEAPONS[w.id].cfg, lv = w.fused ? 5 : w.lv, V = g.vfx, h = g.horde, L = w.cs || (w.cs = []);
    const T = (C.t || 2.2) * (lv >= 3 ? 1.3 : 1);
    for (let k = L.length - 1; k >= 0; k--) {
      const o = L[k], i = h.indexOfUid(o.u); o.t += dt;
      if (i < 0 || o.t > T) { L.splice(k, 1); continue; }
      h.stun[i] = Math.max(h.stun[i], 0.1);
      if (V) V.zip('zcage', 2, h.x[i], 1.2, h.z[i], 2.8 * Math.min(1, o.t * 6), 0, 0.9);
    }
    if (!this.ready(w, dt, p)) return;
    if (h.nearest(p.x, p.z, 18) < 0) return;
    w.cd = C.cd * (lv >= 4 ? 0.75 : 1);
    const n = (C.n || 4) + 2 * (lv >= 2) + 2 * (lv >= 5), dm = C.dmg * (1 + 0.35 * (lv >= 5)) * p.damageMul();
    let c = 0;
    for (let i = 0; i < h.n && c < n; i++) {
      const dx = h.x[i] - p.x, dz = h.z[i] - p.z;
      if (dx * dx + dz * dz > 18 * 18 || h.type[i] === T_BOSS) continue;
      DMG_SRC = w.id; h.hurt(i, dm, 0, 0, g); L.push({ u: h.uid[i], t: 0 }); c++;
      if (V) V.zplay('zcage', h.x[i], 1.2, h.z[i], 3, { fps: 14 });
    }
    if (c) { SFX.play('zap'); g.ui.toast('PRISIÓN TEMPORAL', true); }
  }
  /** Mini Supernova (Cooler): un sol que crece sobre la horda y estalla */
  zsun(w, dt, g, p) {
    const C = WEAPONS[w.id].cfg, lv = w.fused ? 5 : w.lv, V = g.vfx, L = w.ss || (w.ss = []);
    const R = (C.r || 9) * (lv >= 3 ? 1.2 : 1), dm = C.dmg * (1 + 0.4 * (lv >= 2) + 0.4 * (lv >= 5));
    for (let k = L.length - 1; k >= 0; k--) {
      const o = L[k]; o.t += dt;
      const u = Math.min(1, o.t / 1.3);
      if (V) V.zip('zsun', 0, o.x, 3.5 + u * 2, o.z, 1.2 + u * R * 0.38, o.t * 0.8);
      if (o.t >= 1.3) {
        L.splice(k, 1); DMG_SRC = w.id;
        g.explode(o.x, o.z, R, dm * p.damageMul(), 0xffb040);
        if (V) V.zplay('znova', o.x, 2.5, o.z, R * 0.9, { dur: 0.55, grow: 1.3, pri: 1 });
        g.shake(0.9);
      }
    }
    if (!this.ready(w, dt, p)) return;
    const a = this.aim(g, p, 26); if (!a) return;
    w.cd = C.cd * (lv >= 4 ? 0.75 : 1);
    L.push({ x: g.horde.x[a.i], z: g.horde.z[a.i], t: 0 });
    SFX.play('charge');
  }

  /** Gasto de Ki de una técnica: 0 = gratis · 1 = gasta al lanzarse · 2 = gasta mientras está activa (orbes).
      Gastan Ki las técnicas de ki propias del personaje (las que tiene en «unique», también sus fusiones), menos el
      ataque básico con el que empieza y las que ya cobran su propio Ki (los rayos). Las físicas nunca gastan Ki */
  kiMode(w, p) {
    if (w.kiMode !== undefined && w.kiCh === p.ch.id) return w.kiMode;
    const D = WEAPONS[w.id];
    w.kiCh = p.ch.id;
    w.kiMode = (D.cat !== 'ki' || D.unique !== p.ch.id || p.ch.start.includes(w.id) || w.kind === 'beam' || w.kind === 'bigbeam') ? 0 : (w.kind === 'orbit' ? 2 : 1);
    return w.kiMode;
  }

  update(dt, g) {
    const p = g.player;
    this.orbB.begin();
    for (const w of this.list) {
      DMG_SRC = w.id;
      const km = this.kiMode(w, p), fn = w.kind === 'beam' ? this.beamW : this[w.kind];
      if (km === 2) {                                           // orbes: KI_DRAIN por segundo; sin Ki se apagan
        if (p.ki < KI_DRAIN * p.kiUse * dt) continue;
        p.spendKi(KI_DRAIN * dt);
      } else if (km === 1 && w.cd <= 0 && p.ki < (w.kiCost || KI_MIN) * p.kiUse) continue;   // lista pero sin Ki: espera
      const cd0 = w.cd;
      fn.call(this, w, dt, g, p);
      // Se ha lanzado (la recarga vuelve a empezar): cobra según lo que tarda en recargar,
      // así todas gastan lo mismo por segundo (KI_DRAIN) sea cual sea su ritmo
      if (km === 1 && cd0 <= 0 && w.cd > 0) {
        w.kiCost = Math.round(Math.min(KI_MAX, Math.max(KI_MIN, KI_DRAIN * w.cd / p.rateMul)));
        p.spendKi(w.kiCost);
      }
    }
    this.orbB.end();
    DMG_SRC = 'mines'; this.updateMines(dt, g);
    this.updateStrikes(dt, g);
    this.updateHoles(dt, g);
    this.updateJrs(dt, g);
    this.updateBeams(dt, g);
    DMG_SRC = 'otros';
  }

  /* ----- Ráfaga de Ki: proyectiles al enemigo más cercano ----- */
  bullet(w, dt, g, p) {
    if (!this.ready(w, dt, p)) return;
    const a = this.aim(g, p, 32); if (!a) return;
    const lv = w.lv, n = 1 + (lv >= 3) + (lv >= 5), dm = BASE_DMG * (lv >= 2 ? 1.18 : 1);
    w.cd = 0.6 / (lv >= 5 ? 1.3 : 1);
    let crit = false;
    for (let i = 0; i < n; i++) {
      const ang = (i - (n - 1) / 2) * 0.17, c = Math.cos(ang), s = Math.sin(ang);
      crit = Math.random() < p.crit;
      g.ki.fire(p.x, p.z, a.dx * c - a.dz * s, a.dx * s + a.dz * c, 28, dm * p.damageMul() * (crit ? p.critDmg : 1), 0.5, crit, 1.3, lv >= 4 ? 1 : 0, 0, WEAPONS[w.id].color && p.formIdx === 0 ? WEAPONS[w.id].color : p.form.ki);
    }
    p.attack(a.dx, a.dz, crit, g);
  }

  /* ----- Ráfaga Triple (Vegeta): cada esfera se divide en dos a mitad de camino ----- */
  splitblast(w, dt, g, p) {
    if (!this.ready(w, dt, p)) return;
    const a = this.aim(g, p, 30); if (!a) return;
    const lv = w.lv, n = 1 + (lv >= 3) + (lv >= 5), dm = 9 * (lv >= 2 ? 1.2 : 1), col = this.col(w, p);
    w.cd = 0.9 / (lv >= 5 ? 1.3 : 1) * (lv >= 4 ? 0.8 : 1);
    let crit = false;
    for (let i = 0; i < n; i++) {
      const ang = (i - (n - 1) / 2) * 0.16, c = Math.cos(ang), s = Math.sin(ang);
      crit = Math.random() < p.crit;
      const b = g.ki.fire(p.x, p.z, a.dx * c - a.dz * s, a.dx * s + a.dz * c, 20, dm * p.damageMul() * (crit ? p.critDmg : 1), 0.55, crit, 1.5, 0, 0, col);
      if (b) b.split = { at: 0.75 };
    }
    p.attack(a.dx, a.dz, crit, g);
  }

  /* ----- Ráfaga Explosiva (ataque básico de Vegeta): esferas que explotan ----- */
  blast(w, dt, g, p) {
    if (!this.ready(w, dt, p)) return;
    const a = this.aim(g, p, 30); if (!a) return;
    const lv = w.lv, n = 1 + (lv >= 3) + (lv >= 5), dm = 11 * (lv >= 2 ? 1.2 : 1), aoe = 1.7 * (lv >= 4 ? 1.4 : 1);
    w.cd = 0.85 / (lv >= 5 ? 1.3 : 1);
    let crit = false;
    for (let i = 0; i < n; i++) {
      const ang = (i - (n - 1) / 2) * 0.2, c = Math.cos(ang), s = Math.sin(ang);
      crit = Math.random() < p.crit;
      g.ki.fire(p.x, p.z, a.dx * c - a.dz * s, a.dx * s + a.dz * c, 22, dm * p.damageMul() * (crit ? p.critDmg : 1), 0.6, crit, 1.4, 0, aoe, this.col(w, p));
    }
    p.attack(a.dx, a.dz, crit, g);
  }

  /* ----- Masenko: abanico de ráfagas cortas ----- */
  fan(w, dt, g, p) {
    if (!this.ready(w, dt, p)) return;
    const a = this.aim(g, p, 22); if (!a) return;
    const lv = w.lv, n = 3 + (lv >= 3) * 2 + (lv >= 5) * 2, dm = 9 * (lv >= 2 ? 1.15 : 1) * (lv >= 4 ? 1.3 : 1);
    w.cd = 1.1 / (lv >= 5 ? 1.3 : 1);
    for (let i = 0; i < n; i++) {
      const ang = (i - (n - 1) / 2) * (0.95 / Math.max(2, n - 1)) * 1.6, c = Math.cos(ang), s = Math.sin(ang), crit = Math.random() < p.crit;
      g.ki.fire(p.x, p.z, a.dx * c - a.dz * s, a.dx * s + a.dz * c, 24, dm * p.damageMul() * (crit ? p.critDmg : 1), 0.55, crit, lv >= 4 ? 0.75 : 0.55, 0, 0, 0xffb040);
    }
    p.attack(a.dx, a.dz, false, g);
  }

  /* ----- Dodonpa: rayo instantáneo que atraviesa ----- */
  ray(w, dt, g, p) {
    if (!this.ready(w, dt, p)) return;
    const a = this.aim(g, p, 30); if (!a) return;
    const lv = w.lv, n = 1 + (lv >= 4), dm = 22 * (1 + 0.3 * ((lv >= 2) + (lv >= 4) + (lv >= 5)));
    w.cd = lv >= 5 ? 1.0 : lv >= 3 ? 1.6 : 2.2;
    for (let i = 0; i < n; i++) {
      const ang = n === 1 ? 0 : (i ? 0.3 : -0.3), c = Math.cos(ang), s = Math.sin(ang), crit = Math.random() < p.crit;
      this.beam(p.x, p.z, a.dx * c - a.dz * s, a.dx * s + a.dz * c, 26, 0.65, dm * p.damageMul() * (crit ? p.critDmg : 1), 0.25, 99, 0xffe040, false);
      if (crit) g.onCrit(dm * p.damageMul() * p.critDmg);
    }
    p.attack(a.dx, a.dz, true, g);
  }

  /* ----- Esferas orbitales (Goku y Black comparten motor) ----- */
  orbit(w, dt, g, p) {
    const lv = w.lv, n = 2 + (lv >= 2) + (lv >= 4), rad = 3.2 * (lv >= 4 ? 1.25 : 1), dm = 7 * (1 + 0.3 * (lv >= 3) + 0.3 * (lv >= 5)), col = this.col(w, p);
    w.ang += dt * 2.6 * (lv >= 5 ? 1.5 : 1);
    w.tick -= dt;
    const hit = w.tick <= 0; if (hit) w.tick = 0.25;
    for (let i = 0; i < n; i++) {
      const a = w.ang + (i * Math.PI * 2) / n, ox = p.x + Math.cos(a) * rad, oz = p.z + Math.sin(a) * rad;
      this.orbB.push(ox, 1.3, oz, 0, 0, 0, 1.7 + Math.sin(g.time * 8 + i) * 0.15, 1, col);
      if (w.id === 'darkorbs' && g.vfx && g.vfx.ok) g.vfx.now(0, fxf('darkRing', 0), ox, 1.3, oz, 2.3 + Math.sin(g.time * 8 + i) * 0.2, 0.95, 0xffffff, g.time * 3 + i);
      if (hit) { g.horde.damageRadius(ox, oz, 1.1, dm * p.damageMul(), 5, g); g.world.damageArea(ox, oz, 1, dm); }
      if (Math.random() < dt * 12) g.fx.sparks.emit(ox, 1.3, oz, rand(-1, 1), rand(0, 1.5), rand(-1, 1), 0.3, 0.2, 0, col);
    }
  }

  /* ----- Minas de energía ----- */
  mines(w, dt, g, p) {
    const lv = w.lv, max = 3 + (lv >= 5) * 2;
    if (this.ready(w, dt, p)) {
      let act = 0; for (const m of this.minePool) if (m.on) act++;
      if (act < max) {
        for (const m of this.minePool) if (!m.on) { m.on = true; m.x = p.x; m.z = p.z; m.arm = 0.6; break; }
        w.cd = lv >= 4 ? 1.5 : 2.4;
      }
    }
    w.mr = 4 * (lv >= 3 ? 1.4 : 1); w.md = 30 * (1 + 0.3 * (lv >= 2) + 0.4 * (lv >= 5));
  }
  updateMines(dt, g) {
    const w = this.get('mines'), p = g.player;
    this.mineB.begin();
    for (const m of this.minePool) {
      if (!m.on) continue;
      m.arm -= dt;
      if (m.arm <= 0 && w && g.horde.nearest(m.x, m.z, 2.2) >= 0) { m.on = false; g.explode(m.x, m.z, w.mr, w.md * p.damageMul(), 0xffa63a); continue; }
      this.mineB.push(m.x, 0.35, m.z, 0, 0, 0, 0.9 + Math.sin(g.time * 10) * 0.12, 1, m.arm > 0 ? 0x888888 : 0xffa63a);
    }
    this.mineB.end();
  }

  /* ----- Lluvia de Ki: impactos marcados en el suelo ----- */
  rain(w, dt, g, p) {
    if (!this.ready(w, dt, p)) return;
    if (g.horde.n === 0) return;
    const M = WEAPONS[w.id].mul || { n: 1, dmg: 1, cd: 1 }, col = WEAPONS[w.id].color || p.form.ki;
    const lv = w.lv, n = (3 + (lv >= 2) + (lv >= 4) + (lv >= 5) * 2) * M.n, r = 3 * (lv >= 4 ? 1.3 : 1), dm = 28 * (1 + 0.35 * (lv >= 3)) * M.dmg;
    w.cd = (lv >= 5 ? 1.7 : 2.3) * M.cd;
    let done = 0;
    for (let k = 0; k < 30 && done < n; k++) {
      const i = (Math.random() * g.horde.n) | 0, dx = g.horde.x[i] - p.x, dz = g.horde.z[i] - p.z;
      if (dx * dx + dz * dz > 26 * 26) continue;
      if (this.strikeAt(g.horde.x[i], g.horde.z[i], 0.6, r, dm * p.damageMul(), col, '', w.id)) done++;
    }
  }
  updateStrikes(dt, g) {
    for (const s of this.strikes) {
      if (!s.on) continue;
      s.t -= dt;
      if (s.big) {                                         // Genkidama: la esfera crece sobre el campo de batalla
        const k = 1 - s.t / s.T, R = 1 + k * 9;
        for (let i = 0; i < 5; i++) { const a = rand(0, 6.28), u = rand(-1, 1), q = Math.sqrt(1 - u * u); g.fx.aura.emit(s.x + Math.cos(a) * q * R, 16 + u * R, s.z + Math.sin(a) * q * R, 0, 0, 0, 0.18, 0.7, 0, s.tint); }
        g.fx.sparks.emit(s.x + rand(-14, 14), rand(2, 14), s.z + rand(-14, 14), 0, 4, 0, 0.5, 0.25, 0, 0xffffff);
        if (s.t <= 0) g.shake(1.2);
        const V = g.vfx, fall = s.t < 0.5 ? s.t / 0.5 : 1;                 // los últimos 0,5 s cae sobre el objetivo
        if (V && V.ok) {
          const blue = orbIndex(s.tint) >= 4 && orbIndex(s.tint) <= 5, y = 1 + (R * 0.6 + 4) * fall, k = (g.time * 10) | 0;
          if (V.z3 && (s.sty === 'db' || (!s.sty && blue))) {           // Z Legends 3: Death Ball de Freezer o Genkidama de Goku
            V.z3f(s.sty === 'db' ? 'ZballDeath' : 'ZballGoku', k, s.x, y, s.z, R * 2.3, s.sty === 'db' ? g.time * 0.6 : 0);
          } else if (s.sty === 'db') {                                          // Death Ball: esfera oscura con remolino morado
            V.now(6, fxf('deathBall', 0), s.x, y, s.z, R * 1.3, 1, 0xffffff, g.time * 0.6);
            V.now(0, fxf('dbSwirl', k % 3), s.x, y, s.z, R * 1.7, 0.4, 0xffffff, -g.time * 1.4);
          } else if (s.sty === 'sun') {                                  // Supernova / Heat Dome / Finish Buster: un sol
            V.now(6, orbFrame(s.tint, 0), s.x, y, s.z, R * 2.1, 0.95, 0xffffff);
            V.now(0, fxf('burnSwirl', k % 2), s.x, y, s.z, R * 2.5, 0.6, 0xffffff, g.time * 2);
          } else {
            V.now(6, blue ? fxf('genki', 2 + (k % 4)) : orbFrame(s.tint, 0), s.x, y, s.z, R * 2.1, 0.95, 0xffffff);
            V.now(0, fxf('kameStar', ((g.time * 14) | 0) % 4), s.x, y, s.z, R * 1.4, 0.4, 0xffffff);
          }
        }
      }
      // Marca en el suelo + columna de luz que cae
      g.fx.trail.emit(s.x + Math.cos(g.time * 9) * s.r * 0.8, 0.2, s.z + Math.sin(g.time * 9) * s.r * 0.8, 0, 0.5, 0, 0.2, 0.28, 0, s.tint);
      g.fx.sparks.emit(s.x, 3 + s.t * 24, s.z, 0, -14, 0, 0.12, 0.45, 0, s.tint);
      if (s.sty === 'hz' && g.vfx && Math.random() < dt * 20) g.vfx.now(0, fxf('hzCluster', 0), s.x + rand(-1, 1), 1.2 + s.t * 3, s.z + rand(-1, 1), 1.3, 0.8, 0xffffff);
      if (s.t <= 0) {
        s.on = false; DMG_SRC = s.src || 'otros'; g.explode(s.x, s.z, s.r, s.dmg, s.tint); if (s.big) SFX.play('bigboom');
        this.strikeFx(g, s);
      }
    }
  }

  /** Detonación con sprites propios según el estilo del impacto */
  strikeFx(g, s) {
    const V = g.vfx; if (!V || !V.ok) return;
    const R = s.r;
    if (s.sty === 'hz') V.play('hzBoom', s.x, 1.4, s.z, { size: R * 2.2, fps: 14 });
    else if (s.sty === 'db') { V.play('dbBoom', s.x, R * 0.25, s.z, { size: R * 0.7, fps: 12, pri: 1 }); V.play('dbSwirl', s.x, 1.5, s.z, { size: R * 0.9, fps: 9, grow: 1.3, alpha: 0.7, pri: 1 }); }
    else if (s.sty === 'genki') V.play('genkiBoom', s.x, R * 0.3, s.z, { size: R * 0.85, dur: 0.9, grow: 1.2, pri: 1 });
    else if (s.sty === 'sun') { V.play('burnBig', s.x, R * 0.3, s.z, { size: R * 0.8, dur: 0.9, pri: 1 }); V.play('fireBoom', s.x, 2, s.z, { size: R * 0.55, fps: 10, pri: 1 }); }
  }
  /** Esfera gigante (Genkidama, Death Ball...) que cae sobre (x,z) tras T segundos */
  bigStrike(x, z, r, dmg, tint, T, sty, src) {
    for (const s of this.strikes) {
      if (s.on) continue;
      s.on = true; s.big = true; s.t = s.T = T; s.x = x; s.z = z; s.r = r; s.dmg = dmg; s.tint = tint; s.sty = sty || ''; s.src = src || DMG_SRC;
      return s;
    }
    return null;
  }
  /** Impacto marcado en el suelo (lluvia, Hellzone) que estalla tras t segundos */
  strikeAt(x, z, t, r, dmg, tint, sty, src) {
    for (const s of this.strikes) {
      if (s.on) continue;
      s.on = true; s.big = false; s.t = s.T = t; s.x = x; s.z = z; s.r = r; s.dmg = dmg; s.tint = tint; s.sty = sty || ''; s.src = src || DMG_SRC;
      return s;
    }
    return null;
  }

  /* ----- Genkidama: esfera gigante que cae tras reunir energía ----- */
  genki(w, dt, g, p) {
    if (!this.ready(w, dt, p)) return;
    const lv = w.lv, a = this.aim(g, p, 30); if (!a) return;
    const hit = g.horde.n > 12;                              // solo se lanza cuando merece la pena
    if (!hit) return;
    for (const s of this.strikes) {
      if (s.on) continue;
      const D = WEAPONS[w.id], C = D.cfg || {};
      s.on = true; s.big = true; s.t = s.T = 2.6; s.x = p.x + a.dx * 7; s.z = p.z + a.dz * 7; s.src = w.id; s.sty = WEAPONS[w.id].sty || '';
      s.r = (C.r || 15) * (lv >= 3 ? 1.25 : 1) * (lv >= 5 ? 1.2 : 1); s.dmg = (C.dmg || 110) * (1 + 0.5 * (lv - 1)) * p.damageMul(); s.tint = D.color || 0x9fe8ff;
      w.cd = C.cd || (lv >= 4 ? 22 : 28);
      g.ui.toast('¡' + D.name.toUpperCase() + '!', true); SFX.play('charge');
      return;
    }
  }

  /* ----- Kaio-ken: potenciador temporal ----- */
  kaioken(w, dt, g, p) {
    if (!this.ready(w, dt, p)) return;
    if (g.horde.nearest(p.x, p.z, 18) < 0) return;
    const lv = w.lv;
    p.buffT = 4 + lv * 1.2 + (lv >= 5 ? 3 : 0); p.buffDmg = 0.4 + (lv >= 3) * 0.1 + (lv >= 5) * 0.2;
    w.cd = lv >= 4 ? 16 : 22;
    g.ui.toast('¡KAIO-KEN!', true);
    g.fx.ring(g.fx.aura, p.x, 0.5, p.z, 40, 14, 0.6, 0.4, 0xff3030);
    g.shake(0.4);
  }

  /* ----- Rayos grandes configurables (Final Flash, Makankosappo, Kikoho, Juicio Divino) ----- */
  bigbeam(w, dt, g, p) {
    if (!this.ready(w, dt, p)) return;
    const D = WEAPONS[w.id], c = D.cfg, lv = w.lv, a = this.aim(g, p, 36); if (!a) return;
    if (p.ki < c.cost * p.kiUse) return;
    if (c.hpCost && p.hp <= p.maxHp * (c.hpCost + 0.05)) return;
    p.spendKi(c.cost); if (c.hpCost) p.hp -= p.maxHp * c.hpCost;
    w.cd = c.cd * (lv >= 4 ? 0.8 : 1) * (lv >= 5 ? 0.9 : 1);
    const crit = Math.random() < p.crit, dm = c.dmg * (1 + 0.4 * (lv - 1)) * p.damageMul() * (crit ? p.critDmg : 1);
    this.beam(p.x, p.z, a.dx, a.dz, c.len * (lv >= 3 ? 1.2 : 1), c.hw * (lv >= 2 ? 1.1 : 1) * (lv >= 5 ? 1.2 : 1), dm, c.life, 0.1, D.color, true);
    if (crit) g.onCrit(dm);
    SFX.play('bigbeam');
    p.attack(a.dx, a.dz, true, g); p.beamT = c.life;
    chargeFx(g, p.x + a.dx * 1.2, p.z + a.dz * 1.2, D.color, 3.2);
    g.shake(0.9); g.ui.toast(D.name.toUpperCase() + '!', true);
    if (lv >= 5 || w.fused) g.impact(0.1, 4);
    if (g.vfx) g.vfx.play('gather', p.x, 1.6, p.z, { size: 5, fps: 30, frames: FXA.gather ? FXA.gather.f.slice(12, 18) : null });
    g.fx.burst(g.fx.aura, p.x, 1.4, p.z, 24, 7, 0.6, 0.4, 0, D.color);
    this.beamEnd(g, D, p.x + a.dx * c.len * (lv >= 3 ? 1.2 : 1), p.z + a.dz * c.len * (lv >= 3 ? 1.2 : 1), c.hw);
  }
  /** Detonación al final de un rayo grande (y el sello de cómic del Big Bang) */
  beamEnd(g, D, x, z, hw) {
    const V = g.vfx; if (!V || !V.ok) return;
    if (D.end) g.after(0.15, () => V.play(D.end, x, 2, z, { size: hw * 4.5, dur: 0.7, pri: 1 }));
    if (D.stamp) this.stamp(g, D.stamp, x, z, hw * 3.2);
  }
  /** Sello de cómic («BIG BANG!») sobre una explosión; como mucho uno cada 3 s para no saturar */
  stamp(g, name, x, z, size) {
    if (g.time < (this.stampT || 0)) return;
    this.stampT = g.time + 3;
    g.vfx.play(name, x, 4.5, z, { size, grow: 1.25, dur: 0.75, pri: 1 });
  }

  /* ----- Explosión Final: gran área alrededor, a costa de vida ----- */
  selfblast(w, dt, g, p) {
    if (!this.ready(w, dt, p)) return;
    const lv = w.lv;
    if (g.horde.nearest(p.x, p.z, 6) < 0 || p.hp < p.maxHp * 0.3) return;
    w.cd = lv >= 4 ? 28 : 35;
    p.hp = Math.max(1, p.hp - p.maxHp * 0.12);
    const r = (13 + lv) * (lv >= 3 ? 1.2 : 1), dm = 90 * (1 + 0.5 * (lv - 1));
    g.horde.damageRadius(p.x, p.z, r, dm * p.damageMul(), 20, g);
    g.world.damageArea(p.x, p.z, r, dm);
    g.horde.shockwave(p.x, p.z, r, 22);
    g.fx.ring(g.fx.sparks, p.x, 0.5, p.z, 80, r * 3.2, 0.6, 0.45, 0xff8a3a);
    g.fx.burst(g.fx.sparks, p.x, 1.4, p.z, 70, 16, 0.9, 0.5, 4, 0xffd060);
    g.shake(1.2); g.hitstop = 0.1; g.ui.toast('¡' + WEAPONS[w.id].name.toUpperCase() + '!', true); SFX.play('bigboom');
    const sty = WEAPONS[w.id].sty;
    if (g.vfx && sty === 'self') { g.vfx.play('selfBall', p.x, 2, p.z, { size: r * 0.6, grow: 2.2, dur: 0.55, pri: 1 }); g.vfx.play('cellBoom', p.x, 3, p.z, { size: r * 1.2, dur: 0.8, pri: 1 }); }
    else if (g.vfx) { g.vfx.boom(p.x, p.z, r * 0.55, 0xff8a3a, true); g.vfx.play('dome', p.x, 2, p.z, { size: r, grow: 1.6, dur: 0.6, pri: 1 }); g.vfx.play('fireBoom', p.x, 3, p.z, { size: r * 0.9, fps: 9, pri: 1 }); }
    g.impact(0.14, 2);
  }

  /* ----- Kienzan: discos que atraviesan ----- */
  discs(w, dt, g, p) {
    if (!this.ready(w, dt, p)) return;
    const a = this.aim(g, p, 30); if (!a) return;
    const C = WEAPONS[w.id].cfg || {}, lv = w.lv, n = (C.n || 3) + (lv >= 3) + (lv >= 5) * 2, dm = (C.dmg || 24) * (lv >= 2 ? 1.3 : 1);
    w.cd = (C.cd || 5.2) * (lv >= 4 ? 0.77 : 1);
    // Con pocos discos se lanzan en abanico hacia el enemigo; con muchos, en círculo
    const base = Math.atan2(a.dz, a.dx), col = this.col(w, p), ring = n >= 3;
    for (let i = 0; i < n; i++) {
      const ang = ring ? base + (i / n) * Math.PI * 2 : base + (i - (n - 1) / 2) * 0.22;
      const crit = Math.random() < p.crit;
      g.ki.fire(p.x, p.z, Math.cos(ang), Math.sin(ang), C.spd || 17, dm * p.damageMul() * (crit ? p.critDmg : 1), 0.9, crit, C.life || 1.7, 99, 0, col, 2.8, WEAPONS[w.id].look || 1);
    }
    p.attack(a.dx, a.dz, true, g);
  }

  /* ----- Taiyoken (Krilin): destello que aturde a los enemigos cercanos ----- */
  flare(w, dt, g, p) {
    if (!this.ready(w, dt, p)) return;
    const C = WEAPONS[w.id].cfg || {}, lv = w.lv, r = (C.r || 13) * (lv >= 4 && !C.r ? 1.3 : 1);
    if (g.horde.nearest(p.x, p.z, r * 0.7) < 0) return;
    w.cd = C.cd || (lv >= 5 ? 6 : 9);
    g.horde.stunRadius(p.x, p.z, r, C.stun || (lv >= 3 ? 3.5 : 2.5));
    if (lv >= 2) g.horde.damageRadius(p.x, p.z, r, (C.dmg || 18) * p.damageMul(), 2, g);
    if (C.dmg) { g.fx.ring(g.fx.sparks, p.x, 0.6, p.z, 60, r * 2.6, 0.45, 0.45, 0xffb040); SFX.play('boom'); }
    g.fx.ring(g.fx.sparks, p.x, 1.4, p.z, 70, r * 3, 0.35, 0.5, 0xffffff);
    g.fx.burst(g.fx.aura, p.x, 2, p.z, 40, 12, 0.4, 0.6, 0, 0xfff8d0);
    if (!Save.d.opt.flash) g.ui.flash = Math.max(g.ui.flash, 0.4);
    if (g.vfx) { g.vfx.flash(p.x, 2.2, p.z, 10, 0xffe060, { pri: 1 }); g.vfx.play('kameStar', p.x, 2.2, p.z, { size: 14, fps: 14, pri: 1 }); }
    g.ui.toast('¡' + WEAPONS[w.id].name.toUpperCase() + '!', true); SFX.play('crit');   // cada destello con su nombre (antes todos decían TAIYOKEN)
  }

  /* ----- Pulso de Poder: onda circular ----- */
  nova(w, dt, g, p) {
    // cfg opcional { r, dmg, cd } y color propio (las técnicas sin color usan el ki de la forma)
    const C = WEAPONS[w.id].cfg || {}, lv = w.lv, r = (C.r || 8) * (lv >= 3 ? 1.3 : 1), dm = (C.dmg || 20) * (1 + 0.4 * (lv >= 2) + 0.4 * (lv >= 5));
    const col = WEAPONS[w.id].color || p.form.ki;
    if (w.pend > 0) { w.pend -= dt; if (w.pend <= 0) this.pulse(g, p, r, dm, col); }
    if (!this.ready(w, dt, p)) return;
    if (g.horde.nearest(p.x, p.z, r + 4) < 0) return;
    w.cd = (C.cd || 4) * (lv >= 5 ? 0.75 : 1);
    this.pulse(g, p, r, dm, col);
    if (lv >= 4) w.pend = 0.35;
  }
  pulse(g, p, r, dm, col) {
    g.horde.damageRadius(p.x, p.z, r, dm * p.damageMul(), 14, g);
    g.world.damageArea(p.x, p.z, r, dm);
    g.horde.shockwave(p.x, p.z, r, 12);
    SFX.play('pulse');
    if (g.vfx && FXA.auraGen) g.vfx.play('auraGen', p.x, 0.3, p.z, { flat: true, size: r * 0.7, grow: 3, dur: 0.4, frames: FXA.auraGen.f.slice(0, 4) });
    g.fx.ring(g.fx.sparks, p.x, 0.5, p.z, 56, r * 3, 0.4, 0.3, col || p.form.ki);
    g.fx.ring(g.fx.aura, p.x, 0.5, p.z, 36, r * 2, 0.5, 0.35, 0xffffff);
    g.shake(0.3);
  }

  /* ----- Rayo único del personaje (Kamehameha / Galick Ho): cargado y largo ----- */
  beamW(w, dt, g, p) {
    if (!this.ready(w, dt, p)) return;
    const a = this.aim(g, p, 40); if (!a) return;
    if (p.ki < 10 * p.kiUse) return;
    const lv = w.lv, big = lv >= 3 ? 1.4 : 1, dm = 30 * (1 + 0.55 * (lv >= 2)) * (lv >= 5 ? 1.4 : 1), crit = Math.random() < p.crit;
    w.cd = lv >= 5 ? 3.5 : lv >= 4 ? 4 : 5;
    p.spendKi(10);
    this.beam(p.x, p.z, a.dx, a.dz, 26 * big, 1.3 * big * (lv >= 5 ? 1.3 : 1), dm * p.damageMul() * (crit ? p.critDmg : 1) * 0.35, 0.75, 0.1, this.col(w, p), true);
    if (crit) g.onCrit(dm * p.damageMul() * p.critDmg);
    SFX.play('beam');
    p.attack(a.dx, a.dz, true, g); p.beamT = 0.75;
    g.shake(0.6);
    g.fx.burst(g.fx.aura, p.x, 1.4, p.z, 18, 6, 0.5, 0.35, 0, this.col(w, p));
    chargeFx(g, p.x + a.dx * 1.1, p.z + a.dz * 1.1, this.col(w, p), 2.4);
  }

  /* ----- Big Bang Attack: esfera lenta con explosión ----- */
  bigbang(w, dt, g, p) {
    if (!this.ready(w, dt, p)) return;
    const a = this.aim(g, p, 34); if (!a) return;
    const lv = w.lv, n = 1 + (lv >= 5), dm = 26 * (1 + 0.35 * (lv >= 2) + 0.35 * (lv >= 5)), rad = 5 * (lv >= 3 ? 1.3 : 1);
    w.cd = lv >= 4 ? 3.6 : 4.5;
    for (let i = 0; i < n; i++) {
      const ang = n === 1 ? 0 : (i ? 0.25 : -0.25), c = Math.cos(ang), s = Math.sin(ang);
      g.ki.fire(p.x, p.z, a.dx * c - a.dz * s, a.dx * s + a.dz * c, 11, dm * p.damageMul(), 1.0, false, 2.6, 0, rad, this.col(w, p), 4, WEAPONS[w.id].look || 0);
    }
    p.attack(a.dx, a.dz, true, g);
  }

  /* ----- Guadaña Divina: tajo en arco ----- */
  scythe(w, dt, g, p) {
    const C = WEAPONS[w.id].cfg || {}, lv = w.lv, r = (C.r || 6) * (lv >= 4 ? 1.3 : 1), dm = (C.dmg || 16) * (1 + 0.4 * (lv >= 2));
    if (w.pend > 0) { w.pend -= dt; if (w.pend <= 0) this.slash(g, p, -w.pdx, -w.pdz, r, dm, lv >= 5, this.col(w, p)); }
    if (!this.ready(w, dt, p)) return;
    const a = this.aim(g, p, r + 3); if (!a) return;
    w.cd = C.cd || 1.3;
    w.pdx = a.dx; w.pdz = a.dz;
    this.slash(g, p, a.dx, a.dz, r, dm, lv >= 5, this.col(w, p));
    if (lv >= 3) w.pend = 0.2;
    p.attack(a.dx, a.dz, true, g);
  }
  slash(g, p, dx, dz, r, dm, full, color) {
    g.horde.damageCone(p.x, p.z, dx, dz, r, full ? -2 : 0.35, dm * p.damageMul(), 9, g);
    g.world.damageArea(p.x + dx * r * 0.5, p.z + dz * r * 0.5, r * 0.6, dm);
    const base = Math.atan2(dz, dx), arc = full ? Math.PI * 2 : 2.4;
    const SD = WEAPONS[DMG_SRC];
    if (g.vfx && SD && SD.unique === 'black') {                  // guadaña rosa de la hoja de Black sobre el tajo
      g.vfx.play('scytheArc', p.x + dx * r * 0.55, 1.6, p.z + dz * r * 0.55, { size: r * 1.15, grow: 1.15, rot: Math.atan2(-dz, dx), dur: 0.26, pri: 1 });
    }
    if (g.vfx) for (let k = 0; k < (full ? 4 : 1); k++) {
      const a = base + k * Math.PI / 2, cx = Math.cos(a), cz = Math.sin(a);
      g.vfx.play('cresc', p.x + cx * r * 0.55, 0.4, p.z + cz * r * 0.55, { flat: true, size: r * 1.5, rot: Math.atan2(-cz, cx), fps: 28, tint: color });
    }
    for (let i = 0; i < 30; i++) {
      const a = base + (i / 29 - 0.5) * arc, c = Math.cos(a), s = Math.sin(a);
      g.fx.sparks.emit(p.x + c * r * 0.9, 1.2, p.z + s * r * 0.9, c * 5, 0.4, s * 5, 0.28, 0.42, 0, color);
      if (i % 3 === 0) g.fx.aura.emit(p.x + c * r * 0.6, 1.2, p.z + s * r * 0.6, c * 3, 0, s * 3, 0.3, 0.3, 0, color);
    }
    g.shake(0.2);
    SFX.play('slash');
  }

  /* ===== Técnicas físicas nuevas: embestida, impacto contra el suelo y torbellino de patadas ===== */
  /** Imagen residual del personaje golpeando en (x, z) */
  ghost(p, x, z, frame, flip) {
    for (const gh of p.ghosts) if (gh.t <= 0) { gh.t = 0.28; gh.x = x; gh.z = z; gh.frame = frame; gh.flip = flip; gh.sheet = p.drawSheet; return; }
  }
  /** Embestida: cruza en línea recta hacia la horda dejando imágenes residuales que golpean a su paso y remata
      con un golpe final que empuja y aturde. cfg { len, r, n (golpes), dmg, cd } */
  rush(w, dt, g, p) {
    const C = WEAPONS[w.id].cfg || {}, lv = w.fused ? 5 : w.lv, col = this.col(w, p);
    if (w.pend > 0) {
      w.tick -= dt;
      if (w.tick > 0) return;
      w.tick = 0.055; w.pend--;
      const seg = w.len / w.n0, t = (w.n0 - w.pend) / w.n0, x = w.ox + w.dx * w.len * t, z = w.oz + w.dz * w.len * t, last = w.pend === 0;
      const flip = w.dx * g.camCos - w.dz * g.camSin < 0 ? 1 : 0;
      DMG_SRC = w.id;
      // golpea todo el tramo recorrido desde el golpe anterior (sin huecos entre golpes)
      g.horde.damageLine(x - w.dx * seg, z - w.dz * seg, w.dx, w.dz, seg, w.rr, w.dm * p.damageMul(), g);
      if (last) g.horde.damageRadius(x, z, w.rr * 1.5, w.dm * 2 * p.damageMul(), 16, g);
      g.world.damageArea(x, z, w.rr, w.dm);
      if (last) g.horde.stunRadius(x, z, w.rr * 1.5, 0.6);
      DMG_SRC = 'otros';
      this.ghost(p, x - w.dx * 0.6, z - w.dz * 0.6, (w.n0 - w.pend) % 2 ? p.curAnim().atk : p.curAnim().crit, flip);
      for (let i = 0; i < 8; i++) g.fx.sparks.emit(x, 1.3, z, rand(-5, 5), rand(0, 3), rand(-5, 5), 0.25, 0.35, 0, col);
      if (g.vfx) g.vfx.play('hitRing', x, 1.4, z, { size: last ? 4.5 : 2.6, fps: 26, tint: col });
      SFX.play('hit');
      if (last) { if (g.vfx) g.vfx.play('meteorHit', x, 1.4, z, { size: 4, dur: 0.3 }); g.shake(0.35); SFX.play('boom'); }
      return;
    }
    if (!this.ready(w, dt, p)) return;
    const len = (C.len || 12) * (lv >= 3 ? 1.25 : 1), a = this.aim(g, p, len + 2); if (!a) return;
    w.cd = (C.cd || 3.2) * (lv >= 4 ? 0.8 : 1);
    w.ox = p.x; w.oz = p.z; w.dx = a.dx; w.dz = a.dz; w.len = len; w.rr = C.r || 2.2;
    w.dm = (C.dmg || 20) * (1 + 0.3 * (lv >= 2) + 0.35 * (lv >= 5));
    w.n0 = w.pend = (C.n || 4) + (lv >= 5 ? 2 : 0); w.tick = 0;
    p.attack(a.dx, a.dz, true, g); SFX.play('dash');
  }
  /** Impacto: puñetazo contra el suelo que daña, empuja y aturde todo alrededor y deja el suelo agrietado;
      desde el nivel 3 hay una réplica más amplia. cfg { r, dmg, cd, stun } */
  quake(w, dt, g, p) {
    const C = WEAPONS[w.id].cfg || {}, lv = w.fused ? 5 : w.lv, col = this.col(w, p);
    const R = (C.r || 6) * (lv >= 4 ? 1.2 : 1), dm = (C.dmg || 40) * (1 + 0.3 * (lv >= 2) + 0.35 * (lv >= 5));
    const hit = (r, d, k) => {
      DMG_SRC = w.id;
      g.horde.damageRadius(p.x, p.z, r, d * p.damageMul(), k, g); g.horde.stunRadius(p.x, p.z, r, C.stun || 0.8);
      g.world.damageArea(p.x, p.z, r, d);
      DMG_SRC = 'otros';
      g.fx.ring(g.fx.aura, p.x, 0.4, p.z, 40, r * 2.2, 0.5, 0.35, col);
      for (let i = 0; i < 24; i++) { const a = (i / 24) * 6.2832; g.fx.sparks.emit(p.x + Math.cos(a) * r * 0.5, 0.4, p.z + Math.sin(a) * r * 0.5, Math.cos(a) * 9, rand(2, 5), Math.sin(a) * 9, 0.35, 0.4, 0, col); }
      if (g.vfx) { g.vfx.crater(p.x, p.z, r * 0.7, col); g.vfx.dust(p.x, p.z, r * 1.3); g.vfx.play('hitRing', p.x, 0.8, p.z, { size: r * 1.6, fps: 22, tint: col }); }
      g.shake(0.5); SFX.play('boom');
    };
    if (w.pend > 0) { w.pend -= dt; if (w.pend <= 0) hit(R * 1.35, dm * 0.6, 12); }
    if (!this.ready(w, dt, p)) return;
    if (g.horde.nearest(p.x, p.z, R) < 0) return;
    w.cd = (C.cd || 4.5) * (lv >= 4 ? 0.85 : 1);
    hit(R, dm, 18);
    if (lv >= 3) w.pend = 0.35;
    p.attack(1, 0, true, g);
  }
  /** Torbellino: ráfaga de patadas girando sobre ti; cada golpe daña todo alrededor. cfg { n, r, dmg, cd } */
  whirl(w, dt, g, p) {
    const C = WEAPONS[w.id].cfg || {}, lv = w.fused ? 5 : w.lv, col = this.col(w, p);
    if (w.pend > 0) {
      w.tick -= dt;
      if (w.tick > 0) return;
      w.tick = 0.08; w.pend--; w.ang += 1.9;
      const r = (C.r || 3.6) * (lv >= 3 ? 1.25 : 1), c = Math.cos(w.ang), s = Math.sin(w.ang);
      DMG_SRC = w.id;
      g.horde.damageRadius(p.x, p.z, r, w.dm * p.damageMul(), 6, g);
      g.world.damageArea(p.x, p.z, r, w.dm);
      DMG_SRC = 'otros';
      if (g.vfx) g.vfx.play('cresc', p.x + c * r * 0.5, 0.5, p.z + s * r * 0.5, { flat: true, size: r * 1.6, rot: Math.atan2(-s, c), fps: 30, tint: col });
      for (let i = 0; i < 6; i++) g.fx.sparks.emit(p.x + c * r * 0.8, 1.2, p.z + s * r * 0.8, -s * 6, 0.5, c * 6, 0.22, 0.32, 0, col);
      p.attack(c, s, w.pend % 2 === 0, g);
      if (w.pend % 2 === 0) SFX.play('slash');
      return;
    }
    if (!this.ready(w, dt, p)) return;
    if (g.horde.nearest(p.x, p.z, (C.r || 3.6) * 1.6) < 0) return;
    w.cd = (C.cd || 2.6) * (lv >= 4 ? 0.8 : 1);
    w.dm = (C.dmg || 10) * (1 + 0.3 * (lv >= 2) + 0.3 * (lv >= 5));
    w.pend = (C.n || 6) + (lv >= 5 ? 3 : 0); w.tick = 0; w.ang = Math.random() * 6.28;
    SFX.play('dash');
  }

  /* ----- Rayos rápidos (Rayos Oculares de Piccolo, Death Beam de Freezer) ----- */
  pbolt(w, dt, g, p) {
    if (!this.ready(w, dt, p)) return;
    const C = WEAPONS[w.id].cfg, lv = w.lv, a = this.aim(g, p, C.len + 4); if (!a) return;
    const n = 1 + (lv >= 3) + (lv >= 5), dm = C.dmg * (lv >= 2 ? 1.2 : 1), len = C.len * (lv >= 4 ? 1.3 : 1);
    w.cd = C.cd / (lv >= 5 ? 1.3 : 1);
    let crit = false;
    for (let i = 0; i < n; i++) {
      const ang = (i - (n - 1) / 2) * 0.14, c = Math.cos(ang), s = Math.sin(ang);
      crit = Math.random() < p.crit;
      const d = dm * p.damageMul() * (crit ? p.critDmg : 1);
      this.beam(p.x, p.z, a.dx * c - a.dz * s, a.dx * s + a.dz * c, len, C.hw, d, 0.16, 99, this.col(w, p), false);
      if (crit) g.onCrit(d);
    }
    p.attack(a.dx, a.dz, crit, g);
    SFX.play('zap');
  }

  /* ----- Hellzone Grenade: anillo de esferas que convergen y explotan ----- */
  hellzone(w, dt, g, p) {
    if (!this.ready(w, dt, p)) return;
    const a = this.aim(g, p, 26); if (!a) return;
    const C = WEAPONS[w.id].cfg || {}, lv = w.lv, n = (C.n || 6) + (lv >= 3) * 2 + (lv >= 5) * 2, dm = (C.dmg || 26) * (1 + 0.4 * (lv >= 2) + 0.4 * (lv >= 5)), R = (C.R || 6) * (lv >= 5 ? 1.3 : 1);
    w.cd = C.cd || (lv >= 4 ? 4 : 5.5);
    const cx = g.horde.x[a.i], cz = g.horde.z[a.i], col = this.col(w, p);
    for (let k = 0; k < n; k++) {
      const ang = (k / n) * 6.2832;
      this.strikeAt(cx + Math.cos(ang) * R * 0.35, cz + Math.sin(ang) * R * 0.35, 0.9 + k * 0.04, R * 0.55, dm * p.damageMul(), col, WEAPONS[w.id].sty || '', w.id);
      g.fx.burst(g.fx.aura, cx + Math.cos(ang) * R, 1.4, cz + Math.sin(ang) * R, 6, 3, 0.6, 0.4, 0, col);
    }
    p.attack(a.dx, a.dz, true, g);
    if (g.vfx) g.vfx.play('hzCluster', cx, 2.2, cz, { size: R * 1.2, dur: 0.9, alpha: 0.9 });
    g.ui.toast('¡HELLZONE GRENADE!', true);
  }

  /* ----- Fusión de Black: doble tajo circular ----- */
  godslash(w, dt, g, p) {
    const C = WEAPONS[w.id].cfg || {}, lv = w.fused ? 5 : w.lv;
    const r = (C.r || 9) * (lv >= 3 ? 1.2 : 1), dm = (C.dmg || 46) * (1 + 0.3 * (lv >= 2) + 0.3 * (lv >= 5)), col = this.col(w, p);
    if (w.pend > 0) { w.pend -= dt; if (w.pend <= 0) this.slash(g, p, -w.pdx, -w.pdz, r, dm, true, col); }
    if (!this.ready(w, dt, p)) return;
    const a = this.aim(g, p, r + 3); if (!a) return;
    w.cd = (C.cd || 1.0) * (lv >= 4 && C.cd ? 0.75 : 1); w.pdx = a.dx; w.pdz = a.dz; w.pend = 0.18;
    this.slash(g, p, a.dx, a.dz, r, dm, true, col);
    p.attack(a.dx, a.dz, true, g);
  }

  /* ----- Ráfaga continua (fusiones Renzoku, Lluvia de Muerte, Galick explosivo): muchas bolas seguidas ----- */
  barrage(w, dt, g, p) {
    const C = WEAPONS[w.id].cfg || {}, col = this.col(w, p);
    if (w.pend > 0) {                                          // ráfaga en curso: un disparo cada 0,05 s al enemigo más cercano
      w.tick -= dt;
      while (w.tick <= 0 && w.pend > 0) {
        w.tick += 0.05; w.pend--;
        const a = this.aim(g, p, 30) || this.facing(g, p), sp = rand(-0.18, 0.18), c = Math.cos(sp), s = Math.sin(sp), crit = Math.random() < p.crit;
        g.ki.fire(p.x, p.z, a.dx * c - a.dz * s, a.dx * s + a.dz * c, 30, (C.dmg || 14) * p.damageMul() * (crit ? p.critDmg : 1), 0.55, crit, 1.2, 0, C.aoe || 0, col);
        p.attack(a.dx, a.dz, crit, g);
      }
      return;
    }
    if (!this.ready(w, dt, p)) return;
    if (!this.aim(g, p, 30)) return;
    w.cd = C.cd || 2.2; w.pend = C.n || 14; w.tick = 0;
  }

  /* ----- Fusión Planeta de Ki: 6 esferas + pulsos ----- */
  kiplanet(w, dt, g, p) {
    const n = 6, rad = 5, dm = 16, col = this.col(w, p);
    w.ang += dt * 3.2;
    w.tick -= dt;
    const hit = w.tick <= 0; if (hit) w.tick = 0.2;
    for (let i = 0; i < n; i++) {
      const a = w.ang + (i * Math.PI * 2) / n, ox = p.x + Math.cos(a) * rad, oz = p.z + Math.sin(a) * rad;
      this.orbB.push(ox, 1.3, oz, 0, 0, 0, 2.1, 1, col);
      if (hit) { g.horde.damageRadius(ox, oz, 1.4, dm * p.damageMul(), 6, g); g.world.damageArea(ox, oz, 1.2, dm); }
    }
    if (this.ready(w, dt, p) && g.horde.nearest(p.x, p.z, 14) >= 0) { w.cd = 2.2; this.pulse(g, p, 12, 40); }
  }

  /* ----- Ráfagas Teledirigidas: esferas que persiguen al enemigo más cercano ----- */
  homing(w, dt, g, p) {
    if (!this.ready(w, dt, p)) return;
    const a = this.aim(g, p, 26); if (!a) return;
    const C = WEAPONS[w.id].cfg || {}, lv = w.fused ? 5 : w.lv, col = this.col(w, p);
    // (antes «C.n || 3 + ...»: con cfg.n o cfg.cd propios no subían los proyectiles ni bajaba la recarga al subir de nivel)
    const n = (C.n || 3) + (lv >= 2) + (lv >= 4) + (lv >= 5) * 2, dm = (C.dmg || 12) * (lv >= 3 ? 1.3 : 1);
    w.cd = C.cd ? C.cd * (lv >= 5 ? 0.75 : 1) : (lv >= 5 ? 1.6 : 2.2);
    const base = Math.atan2(a.dz, a.dx);
    for (let i = 0; i < n; i++) {
      const ang = base + Math.PI + (i - (n - 1) / 2) * (2.6 / Math.max(1, n - 1)), crit = Math.random() < p.crit;   // salen hacia atrás y giran
      const b = g.ki.fire(p.x, p.z, Math.cos(ang), Math.sin(ang), 16, dm * p.damageMul() * (crit ? p.critDmg : 1), 0.55, crit, 2.4, 0, 0, col, 1.9);
      if (b) b.home = lv >= 4 ? 9 : 6;
    }
    p.attack(a.dx, a.dz, false, g);
  }

  /* ----- Barrera de Ki (y Barrera Perfecta de Célula): para golpes y empuja a la horda ----- */
  barrier(w, dt, g, p) {
    const C = WEAPONS[w.id].cfg || {}, lv = w.fused ? 5 : w.lv, col = this.col(w, p);
    const rad = w.id === 'gshield' && lv >= 3 ? 7.8 : lv >= 5 ? 9 : 7;   // Escudo de Gohan: onda un poco más grande desde el nivel 3
    if (p.barT > 0) {                                           // activa: burbuja alrededor del jugador
      p.barT -= dt;
      if (g.vfx && g.vfx.ok) {
        const k = ((g.time * 12) | 0) % 6, green = w.id === 'cellbarrier';
        g.vfx.now(0, green ? fxf('cellRing', 0) : fxf('barrier', k), p.x, 1.6, p.z, 4.6 * (1 + Math.sin(g.time * 9) * 0.04), 0.75, green ? 0xffffff : col, green ? g.time * 2 : 0);
      }
      if (p.barT <= 0) p.barHits = 0;
      return;
    }
    if (!this.ready(w, dt, p)) return;
    if (g.horde.nearest(p.x, p.z, 5.5) < 0) return;            // solo cuando te rodean
    w.cd = C.cd || (lv >= 4 ? 7 : 10);
    p.barT = 6; p.barHits = C.hits || 2 + (lv >= 3) + (lv >= 5); p.barBoom = C.boom || 0; p.barCol = col;
    g.horde.shockwave(p.x, p.z, rad, 18);
    if (lv >= 2) g.horde.damageRadius(p.x, p.z, lv >= 5 ? 7 : 5.5, 16 * (1 + 0.3 * (lv >= 5)) * p.damageMul(), 14, g);
    if (g.vfx) { g.vfx.play('pulse', p.x, 1.4, p.z, { size: 8, fps: 18, tint: col }); g.vfx.flash(p.x, 1.6, p.z, 5, col); }
    g.fx.ring(g.fx.aura, p.x, 0.6, p.z, 40, 14, 0.5, 0.4, col);
    SFX.play('pulse');
  }

  /* ----- Rayos del Juicio: rayos que caen sobre enemigos cercanos ----- */
  thunder(w, dt, g, p) {
    if (!this.ready(w, dt, p)) return;
    if (g.horde.n === 0) return;
    const C = WEAPONS[w.id].cfg || {}, lv = w.fused ? 5 : w.lv, col = this.col(w, p);
    const n = (C.n || 3) + (lv >= 2) + (lv >= 4) * 2 + (lv >= 5) * 2, r = (C.r || 2) * (lv >= 4 ? 1.3 : 1), dm = (C.dmg || 30) * (lv >= 3 ? 1.35 : 1);
    w.cd = C.cd ? C.cd * (lv >= 5 ? 0.7 : 1) : (lv >= 5 ? 2.2 : 3.2);
    let hits = 0;
    for (let k = 0; k < 40 && hits < n; k++) {
      const i = (Math.random() * g.horde.n) | 0, ex = g.horde.x[i], ez = g.horde.z[i], dx = ex - p.x, dz = ez - p.z;
      if (g.horde.hp[i] <= 0 || dx * dx + dz * dz > 24 * 24) continue;
      hits++;
      g.after(hits * 0.05, () => {
        DMG_SRC = w.id; g.horde.damageRadius(ex, ez, r, dm * p.damageMul(), 4, g); g.world.damageArea(ex, ez, r, dm); DMG_SRC = 'otros';
        if (g.vfx) { g.vfx.play('lightning', ex, 3.2, ez, { size: 7, fps: 20, tint: 0xffffff }); g.vfx.flash(ex, 0.8, ez, 3, col); }
        g.fx.burst(g.fx.sparks, ex, 0.6, ez, 6, 5, 0.3, 0.3, 4, col);
      });
    }
    if (hits) SFX.play('zap');
  }

  /* ----- Combinación Meteoro (Goku): golpes instantáneos en cadena con imágenes residuales ----- */
  meteor(w, dt, g, p) {
    const C = WEAPONS[w.id].cfg || {}, lv = w.fused ? 5 : w.lv, col = this.col(w, p);
    if (w.pend > 0) {
      w.tick -= dt;
      if (w.tick > 0) return;
      w.tick = 0.07; w.pend--;
      const i = g.horde.nearest(p.x + rand(-6, 6), p.z + rand(-6, 6), 16);
      if (i < 0) { w.pend = 0; return; }
      const ex = g.horde.x[i], ez = g.horde.z[i], dm = (C.dmg || 34) * (lv >= 3 ? 1.35 : 1);
      DMG_SRC = w.id; g.horde.damageRadius(ex, ez, 2.6, dm * p.damageMul(), 10, g); g.horde.stunRadius(ex, ez, 2.6, 0.7); DMG_SRC = 'otros';
      for (const gh of p.ghosts) if (gh.t <= 0) { gh.t = 0.3; gh.x = ex - 0.8; gh.z = ez; gh.frame = p.curAnim().atk; gh.flip = ex < p.x ? 1 : 0; gh.sheet = p.drawSheet; break; }
      if (g.vfx) { g.vfx.play('meteorHit', ex, 1.4, ez, { size: 4.2, dur: 0.3, tint: col === 0xff4a4a ? 0xff8a8a : 0xffffff }); g.vfx.play('hitRing', ex, 1.4, ez, { size: 3.5, fps: 24, tint: col }); }
      SFX.play('hit');
      if (w.pend === 0) { g.shake(0.4); if (lv >= 5 || w.fused) g.impact(0.07, 3); }
      return;
    }
    if (!this.ready(w, dt, p)) return;
    if (g.horde.nearest(p.x, p.z, 14) < 0) return;
    w.cd = C.cd ? C.cd * (lv >= 4 ? 0.75 : 1) : (lv >= 4 ? 4.5 : 6);
    w.pend = (C.n || 3) + (lv >= 2) + (lv >= 5) * 2; w.tick = 0;
    if (w.id === 'meteorkai') p.hp = Math.max(1, p.hp - 2);
    p.attack(1, 0, true, g); SFX.play('dash');
  }

  /* ----- Guadaña del Dolor (Black): agujero negro que atrae a la horda y estalla ----- */
  vortex(w, dt, g, p) {
    if (!this.ready(w, dt, p)) return;
    const a = this.aim(g, p, 24); if (!a) return;
    const C = WEAPONS[w.id].cfg || {}, lv = w.fused ? 5 : w.lv;
    w.cd = C.cd || (lv >= 4 ? 6 : 8);
    for (const o of this.holes) {
      if (o.on) continue;
      o.on = true; o.x = g.horde.x[a.i]; o.z = g.horde.z[a.i]; o.t = 0; o.T = lv >= 5 ? 2.4 : 1.9; o.tick = 0;
      o.R = C.R || (lv >= 3 ? 10 : 8); o.dmg = (C.dmg || 34) * (lv >= 2 ? 1.35 : 1) * p.damageMul(); o.col = this.col(w, p); o.bolt = !!C.bolt; o.src = w.id;
      break;
    }
    p.attack(a.dx, a.dz, true, g);
    if (g.vfx) g.vfx.play('godSlicer', p.x + a.dx * 2, 1.6, p.z + a.dz * 2, { size: 5, dur: 0.35, rot: Math.atan2(-a.dz, a.dx) });
    SFX.play('slash');
  }
  updateHoles(dt, g) {
    const V = g.vfx;
    for (const o of this.holes) {
      if (!o.on) continue;
      o.t += dt; o.tick -= dt;
      if (o.tick <= 0) {
        o.tick = 0.2; DMG_SRC = o.src;
        g.horde.shockwave(o.x, o.z, o.R, -9);                       // fuerza negativa: atrae
        g.horde.damageRadius(o.x, o.z, o.R * 0.4, o.dmg * 0.12, 0, g);
        if (o.bolt) {                                               // Absolución: rayos dentro del agujero
          const i = g.horde.nearest(o.x + rand(-o.R, o.R) * 0.5, o.z + rand(-o.R, o.R) * 0.5, o.R);
          if (i >= 0) { g.horde.hurt(i, o.dmg * 0.4, 0, 0, g); if (V) V.play('lightning', g.horde.x[i], 3, g.horde.z[i], { size: 6, fps: 22, tint: 0xffd0f0 }); }
        }
        DMG_SRC = 'otros';
      }
      const u = Math.min(1, o.t / 0.3), sz = o.R * 1.1 * u;
      if (V && V.ok) {
        V.now(1, fxf('blackHole', ((g.time * 6) | 0) & 1), o.x, 0.2, o.z, sz * 1.6, 0.9, 0xffffff, g.time * 3);
        V.now(6, fxf('deathBall', 0), o.x, 1.6, o.z, sz * 0.55, 0.95, 0xffffff, -g.time * 4);
        V.now(0, fxf('dbSwirl', ((g.time * 9) | 0) % 3), o.x, 1.6, o.z, sz * 1.2, 0.5, o.col === 0xff6ac8 ? 0xffb0e0 : 0xffffff, g.time * 2);
      }
      if (o.t >= o.T) {                                             // estalla
        o.on = false; DMG_SRC = o.src;
        g.horde.damageRadius(o.x, o.z, o.R * 0.8, o.dmg, 16, g); g.world.damageArea(o.x, o.z, o.R * 0.8, o.dmg);
        DMG_SRC = 'otros';
        if (V) { V.play('dbSwirl', o.x, 2, o.z, { size: o.R * 1.8, fps: 10, grow: 1.3, pri: 1 }); V.play('divineBoom', o.x, 2, o.z, { size: o.R * 1.3, fps: 8, tint: 0xffb0ff }); V.crater(o.x, o.z, o.R * 0.6, o.col); }
        g.fx.ring(g.fx.aura, o.x, 0.5, o.z, 40, o.R * 2.4, 0.5, 0.4, o.col);
        g.shake(0.5); SFX.play('boom');
      }
    }
  }

  /* ----- Célula Jr.: pequeños aliados que corren hacia la horda y golpean ----- */
  minions(w, dt, g, p) {
    if (!this.ready(w, dt, p)) return;
    if (g.horde.nearest(p.x, p.z, 26) < 0) return;
    const C = WEAPONS[w.id].cfg || {}, lv = w.fused ? 5 : w.lv;
    const n = C.n || 2 + (lv >= 3) + (lv >= 5), dm = (C.dmg || 16) * (lv >= 2 ? 1.35 : 1) * (lv >= 5 ? 1.25 : 1);
    w.cd = C.cd || (lv >= 4 ? 9 : 12);
    let made = 0;
    for (const j of this.jrs) {
      if (j.on || made >= n) continue;
      const a = (made / n) * 6.2832;
      j.on = true; j.x = p.x + Math.cos(a) * 2; j.z = p.z + Math.sin(a) * 2; j.t = C.life || (lv >= 4 ? 10 : 8); j.hit = 0.3; j.shot = rand(0.5, 1.5);
      j.dmg = dm * p.damageMul(); j.beam = !!C.beam; j.ph = rand(0, 6); j.src = w.id; made++;
      g.fx.burst(g.fx.aura, j.x, 1, j.z, 10, 4, 0.4, 0.35, 0, 0x8ab8ff);
    }
    if (made) { g.ui.toast('¡CÉLULA JR.!', true); SFX.play('pulse'); }
  }
  updateJrs(dt, g) {
    const sh = g.player.sheets && g.player.sheets.cell;     // Célula Jr.: el sprite de Célula Perfecto en pequeño y azul
    if (!this.jrB) { if (!sh || !this.jrs.some((j) => j.on)) return; const H = 3.6 * (sh.hs || 1); this.jrB = new SpriteBatch(this.scene, { max: this.jrs.length, texture: sh.tex, cols: sh.cols, rows: sh.rows, w: H * (sh.w / sh.h), h: H, anchor: sh.anc || 0.04, renderOrder: 3 }); }
    const B = this.jrB, h = g.horde;
    B.begin();
    for (const j of this.jrs) {
      if (!j.on) continue;
      j.t -= dt; j.hit -= dt; j.shot -= dt; j.ph += dt;
      if (j.t <= 0) { j.on = false; g.fx.burst(g.fx.aura, j.x, 1, j.z, 8, 3, 0.3, 0.3, 0, 0x8ab8ff); continue; }
      const i = h.nearest(j.x, j.z, 30);
      let moving = false;
      if (i >= 0) {
        const dx = h.x[i] - j.x, dz = h.z[i] - j.z, d = Math.hypot(dx, dz) || 1;
        j.flip = dx < 0 ? 1 : 0;
        if (d > 1.4) { j.x += dx / d * 10 * dt; j.z += dz / d * 10 * dt; moving = true; }
        if (d < 2 && j.hit <= 0) { j.hit = 0.45; DMG_SRC = j.src; h.damageRadius(j.x, j.z, 1.8, j.dmg, 8, g); DMG_SRC = 'otros'; if (g.vfx) g.vfx.play('hitRing', h.x[i], 1.2, h.z[i], { size: 2.4, fps: 26, tint: 0x8ab8ff }); }
        if (j.beam && j.shot <= 0 && d < 16) { j.shot = 1.2; DMG_SRC = j.src; this.beam(j.x, j.z, dx / d, dz / d, 16, 0.35, j.dmg * 0.6, 0.16, 99, 0x8aff9a, false); DMG_SRC = 'otros'; }
      } else { const p = g.player, dx = p.x - j.x, dz = p.z - j.z, d = Math.hypot(dx, dz) || 1; if (d > 3) { j.x += dx / d * 9 * dt; j.z += dz / d * 9 * dt; moving = true; } }
      const fr = moving ? [1, 2, 1, 0][((j.ph * 8) | 0) % 4] : j.hit > 0.35 ? 5 : 0;
      B.push(j.x, moving ? Math.abs(Math.sin(j.ph * 10)) * 0.1 : 0, j.z, fr, j.flip, j.hit > 0.35 ? 0.6 : 0, 0.62, 1, 0x8ab8ff);
    }
    B.end();
  }

  /* ----- Pool de rayos ----- */
  beam(x, z, dx, dz, len, hw, dmg, life, tickDt, color, follow) {
    for (const b of this.beams) {
      if (b.on) continue;
      b.on = true; b.x = x; b.z = z; b.dx = dx; b.dz = dz; b.len = len; b.hw = hw; b.dmg = dmg; b.age = 0; b.life = life; b.tick = 0; b.tickDt = tickDt; b.color = color; b.follow = follow; b.src = DMG_SRC;
      return;
    }
  }
  updateBeams(dt, g) {
    const B = this.beamB, p = g.player;
    B.begin();
    for (const b of this.beams) {
      if (!b.on) continue;
      b.age += dt;
      if (b.age >= b.life) { b.on = false; continue; }
      if (b.follow) { b.x = p.x; b.z = p.z; }
      const cur = b.len * Math.min(1, b.age / 0.12), fade = Math.min(1, (b.life - b.age) / 0.2);
      b.tick -= dt;
      if (b.tick <= 0) {
        b.tick = b.tickDt;
        DMG_SRC = b.src;
        g.horde.damageLine(b.x, b.z, b.dx, b.dz, cur, b.hw, b.dmg, g);
        for (let t = 2; t < cur; t += 4) g.world.damageArea(b.x + b.dx * t, b.z + b.dz * t, b.hw, b.dmg);
        g.fx.sparks.emit(b.x + b.dx * cur, 1.5, b.z + b.dz * cur, rand(-3, 3), rand(0, 4), rand(-3, 3), 0.3, 0.35, 0, b.color);
      }
      // Tres capas (halo, cuerpo y núcleo blanco). Cada capa separa sus sprites según su tamaño y sube su opacidad
      // en la misma proporción: se ve igual, pero se pintan aproximadamente la mitad de píxeles (menos trabajo de GPU)
      const wob = 1 + Math.sin(g.time * 40) * 0.08;   // rayos: los de siempre (los de Z Legends 3 no encajaban con la cámara 3D)
      for (let k = 0; k < 3; k++) {
        const size = b.hw * BEAM_K[k] * wob, step = Math.max(0.8, size * 0.3), al = Math.min(1, BEAM_A[k] * step / 0.8) * fade, col = k === 2 ? 0xffffff : b.color;
        for (let t = 0.8; t <= cur; t += step) B.push(b.x + b.dx * t, 1.5, b.z + b.dz * t, 0, 0, 0, size, al, col);
      }
      B.push(b.x + b.dx * cur, 1.5, b.z + b.dz * cur, 0, 0, 0, b.hw * 3.6, 0.7 * fade, b.color);
      const V = g.vfx, D = WEAPONS[b.src];
      if (V && V.ok && D && D.sty === 'sbc') {                     // Makankosappo: espiral alrededor del rayo
        const k = ((g.time * 16) | 0) & 1, rot = Math.atan2(-b.dz, b.dx), st = b.hw * 3;
        for (let t = st * 0.5; t < cur; t += st) V.now(1, fxf('sbcSpiral', k), b.x + b.dx * t, 1.5, b.z + b.dz * t, st * 1.15, 0.9 * fade, 0xffffff, rot);
      }
      if (V && V.ok && (b.src === 'finalflash' || b.src === 'bbflash' || (b.src === 'ult' && p.ch.id === 'vegeta'))) {
        // Final Flash: media luna de la hoja de Vegeta en la punta (azul en las formas Blue)
        V.now(2, fxf(bigOrb(b.color) === 'orbKame' ? 'ffMoonB' : 'ffMoonY', 0), b.x + b.dx * cur, 1.5, b.z + b.dz * cur, b.hw * 3.4, 0.9 * fade, 0xffffff, Math.atan2(-b.dz, b.dx));
      } else if (V && V.ok && (b.src === 'deathbeam' || b.src === 'cellbeam')) {
        V.now(0, fxf('dbBall', 0), b.x + b.dx * cur, 1.5, b.z + b.dz * cur, 1.7, fade, 0xffffff, Math.atan2(-b.dz, b.dx));
      }
      if (V && V.ok && b.hw > 0.9) {
        const k = (g.time * 20) | 0;
        const pl = g.player, oc = pl.ch.id === 'gohan' && pl.formIdx === 4 && b.follow ? 'beastBall' : bigOrb(b.color);   // esfera de las hojas nuevas en el origen
        if (oc) V.now(FXA[oc].s === 'fxbig' ? 2 : 0, fxf(oc, 0), b.x + b.dx * 0.9, 1.5, b.z + b.dz * 0.9, b.hw * 2.1, 0.75 * fade, 0xffffff, g.time * 2);
        else V.now(0, orbFrame(b.color, 0), b.x + b.dx * 0.9, 1.5, b.z + b.dz * 0.9, b.hw * 2.6, fade, 0xffffff);
        V.now(0, fxf('kameStar', k % 4), b.x + b.dx * 0.9, 1.5, b.z + b.dz * 0.9, b.hw * 3.4, 0.8 * fade, 0xffffff);
        V.now(0, fxf('kameImp', k & 1), b.x + b.dx * cur, 1.5, b.z + b.dz * cur, b.hw * 4.2, 0.85 * fade, 0xffffff);
      }
    }
    B.end();
  }
}

/* ---------- Sprites de ataque de las hojas nuevas ----------
   Bola de carga en la mano al disparar un rayo (dorada, blanca o roja según el color) y esfera grande en el origen */
const hexRGB = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
function chargeFx(g, x, z, col, size) {
  const V = g.vfx; if (!V || !V.ok) return;
  const [r, gg, b] = hexRGB(col);
  const nm = r > 170 && gg < r * 0.7 && b < r * 0.8 ? 'chgR' : r > 170 && gg > 140 && b < 150 ? 'chgY' : 'chgW';
  V.play(nm, x, 1.5, z, { size, grow: 1.5, dur: 0.32, pri: 1 });
}
function bigOrb(col) {
  const [r, gg, b] = hexRGB(col);
  if (b > 170 && b > r + 30) return 'orbKame';
  if (r > 200 && gg > 200 && b > 200) return 'orbUI';
  return null;
}
