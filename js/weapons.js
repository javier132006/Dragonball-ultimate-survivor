'use strict';
/* =====================================================================
   weapons.js · Motor de armas. Cada arma de WEAPONS tiene un `kind` y
   un método con ese nombre aquí. Todo el estado vive en pools fijos:
   rayos, minas y impactos se reciclan, no se crean en el bucle.
   ===================================================================== */

const BASE_DMG = 10;

class WeaponSystem {
  constructor(scene, tex) {
    this.list = [];                                   // armas equipadas: {id, kind, lv, cd, ...}
    this._a = { dx: 1, dz: 0, d: 0, i: -1 };          // resultado reutilizable de aim()
    // Rayos (Kamehameha, Galick, Dodonpa): pool de 8
    this.beams = [];
    for (let i = 0; i < 8; i++) this.beams.push({ on: false, x: 0, z: 0, dx: 1, dz: 0, len: 20, hw: 1, dmg: 0, age: 0, life: 1, tick: 0, tickDt: 0.1, color: 0xffffff, follow: false });
    this.beamB = new SpriteBatch(scene, { max: 1000, texture: tex.ki, w: 1, h: 1, anchor: 0.5, additive: true, cut: 0.02, renderOrder: 5 });
    this.orbB = new SpriteBatch(scene, { max: 24, texture: tex.ki, w: 1, h: 1, anchor: 0.5, additive: true, cut: 0.02, renderOrder: 5 });
    // Minas y meteoros: pools
    this.minePool = []; for (let i = 0; i < 8; i++) this.minePool.push({ on: false, x: 0, z: 0, arm: 0 });
    this.mineB = new SpriteBatch(scene, { max: 8, texture: tex.gem, w: 1, h: 1, anchor: 0.5, renderOrder: 1 });
    this.strikes = []; for (let i = 0; i < 14; i++) this.strikes.push({ on: false, x: 0, z: 0, t: 0, T: 0.6, big: false, r: 3, dmg: 0, tint: 0xffffff });
  }

  reset(ch) {
    this.list.length = 0;
    for (const b of this.beams) b.on = false;
    for (const m of this.minePool) m.on = false;
    for (const s of this.strikes) s.on = false;
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

  update(dt, g) {
    const p = g.player;
    this.orbB.begin();
    for (const w of this.list) (w.kind === 'beam' ? this.beamW : this[w.kind]).call(this, w, dt, g, p);
    this.orbB.end();
    this.updateMines(dt, g);
    this.updateStrikes(dt, g);
    this.updateBeams(dt, g);
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
      g.ki.fire(p.x, p.z, a.dx * c - a.dz * s, a.dx * s + a.dz * c, 28, dm * p.damageMul() * (crit ? 2 : 1), 0.5, crit, 1.3, lv >= 4 ? 1 : 0, 0, p.form.ki);
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
      g.ki.fire(p.x, p.z, a.dx * c - a.dz * s, a.dx * s + a.dz * c, 22, dm * p.damageMul() * (crit ? 2 : 1), 0.6, crit, 1.4, 0, aoe, this.col(w, p));
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
      g.ki.fire(p.x, p.z, a.dx * c - a.dz * s, a.dx * s + a.dz * c, 24, dm * p.damageMul() * (crit ? 2 : 1), 0.55, crit, lv >= 4 ? 0.75 : 0.55, 0, 0, 0xffb040);
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
      this.beam(p.x, p.z, a.dx * c - a.dz * s, a.dx * s + a.dz * c, 26, 0.65, dm * p.damageMul() * (crit ? 2 : 1), 0.25, 99, 0xffe040, false);
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
    const lv = w.lv, n = 3 + (lv >= 2) + (lv >= 4) + (lv >= 5) * 2, r = 3 * (lv >= 4 ? 1.3 : 1), dm = 28 * (1 + 0.35 * (lv >= 3));
    w.cd = lv >= 5 ? 1.7 : 2.3;
    let done = 0;
    for (let k = 0; k < 30 && done < n; k++) {
      const i = (Math.random() * g.horde.n) | 0, dx = g.horde.x[i] - p.x, dz = g.horde.z[i] - p.z;
      if (dx * dx + dz * dz > 26 * 26) continue;
      for (const s of this.strikes) if (!s.on) { s.on = true; s.x = g.horde.x[i]; s.z = g.horde.z[i]; s.t = 0.6; s.T = 0.6; s.big = false; s.r = r; s.dmg = dm * p.damageMul(); s.tint = p.form.ki; done++; break; }
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
      }
      // Marca en el suelo + columna de luz que cae
      g.fx.trail.emit(s.x + Math.cos(g.time * 9) * s.r * 0.8, 0.2, s.z + Math.sin(g.time * 9) * s.r * 0.8, 0, 0.5, 0, 0.2, 0.28, 0, s.tint);
      g.fx.sparks.emit(s.x, 3 + s.t * 24, s.z, 0, -14, 0, 0.12, 0.45, 0, s.tint);
      if (s.t <= 0) { s.on = false; g.explode(s.x, s.z, s.r, s.dmg, s.tint); }
    }
  }

  /* ----- Genkidama: esfera gigante que cae tras reunir energía ----- */
  genki(w, dt, g, p) {
    if (!this.ready(w, dt, p)) return;
    const lv = w.lv, a = this.aim(g, p, 30); if (!a) return;
    const hit = g.horde.n > 12;                              // solo se lanza cuando merece la pena
    if (!hit) return;
    for (const s of this.strikes) {
      if (s.on) continue;
      s.on = true; s.big = true; s.t = s.T = 2.6; s.x = p.x + a.dx * 7; s.z = p.z + a.dz * 7;
      s.r = 15 * (lv >= 3 ? 1.25 : 1) * (lv >= 5 ? 1.2 : 1); s.dmg = 110 * (1 + 0.5 * (lv - 1)) * p.damageMul(); s.tint = 0x9fe8ff;
      w.cd = lv >= 4 ? 22 : 28;
      g.ui.toast('¡GENKIDAMA!');
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
    if (p.ki < c.cost) return;
    if (c.hpCost && p.hp <= p.maxHp * (c.hpCost + 0.05)) return;
    p.ki -= c.cost; if (c.hpCost) p.hp -= p.maxHp * c.hpCost;
    w.cd = c.cd * (lv >= 4 ? 0.8 : 1) * (lv >= 5 ? 0.9 : 1);
    const crit = Math.random() < p.crit, dm = c.dmg * (1 + 0.4 * (lv - 1)) * p.damageMul() * (crit ? 2 : 1);
    this.beam(p.x, p.z, a.dx, a.dz, c.len * (lv >= 3 ? 1.2 : 1), c.hw * (lv >= 2 ? 1.1 : 1) * (lv >= 5 ? 1.2 : 1), dm, c.life, 0.1, D.color, true);
    p.attack(a.dx, a.dz, true, g); p.beamT = c.life;
    g.shake(0.9); g.ui.toast(D.name.toUpperCase() + '!', true);
    g.fx.burst(g.fx.aura, p.x, 1.4, p.z, 24, 7, 0.6, 0.4, 0, D.color);
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
    g.shake(1.2); g.hitstop = 0.1; g.ui.toast('¡EXPLOSIÓN FINAL!', true);
  }

  /* ----- Kienzan: discos que atraviesan ----- */
  discs(w, dt, g, p) {
    if (!this.ready(w, dt, p)) return;
    const a = this.aim(g, p, 30); if (!a) return;
    const lv = w.lv, n = 3 + (lv >= 3) + (lv >= 5) * 2, dm = 24 * (lv >= 2 ? 1.3 : 1);
    w.cd = lv >= 4 ? 4 : 5.2;
    const base = Math.atan2(a.dz, a.dx), col = this.col(w, p);
    for (let i = 0; i < n; i++) {
      const ang = base + (i / n) * Math.PI * 2;
      g.ki.fire(p.x, p.z, Math.cos(ang), Math.sin(ang), 17, dm * p.damageMul(), 0.9, false, 1.7, 99, 0, col, 2.8);
    }
    p.attack(a.dx, a.dz, true, g);
  }

  /* ----- Pulso de Poder: onda circular ----- */
  nova(w, dt, g, p) {
    const lv = w.lv, r = 8 * (lv >= 3 ? 1.3 : 1), dm = 20 * (1 + 0.4 * (lv >= 2) + 0.4 * (lv >= 5));
    if (w.pend > 0) { w.pend -= dt; if (w.pend <= 0) this.pulse(g, p, r, dm); }
    if (!this.ready(w, dt, p)) return;
    if (g.horde.nearest(p.x, p.z, r + 4) < 0) return;
    w.cd = lv >= 5 ? 3 : 4;
    this.pulse(g, p, r, dm);
    if (lv >= 4) w.pend = 0.35;
  }
  pulse(g, p, r, dm) {
    g.horde.damageRadius(p.x, p.z, r, dm * p.damageMul(), 14, g);
    g.world.damageArea(p.x, p.z, r, dm);
    g.horde.shockwave(p.x, p.z, r, 12);
    g.fx.ring(g.fx.sparks, p.x, 0.5, p.z, 56, r * 3, 0.4, 0.3, p.form.ki);
    g.fx.ring(g.fx.aura, p.x, 0.5, p.z, 36, r * 2, 0.5, 0.35, 0xffffff);
    g.shake(0.3);
  }

  /* ----- Rayo único del personaje (Kamehameha / Galick Ho): cargado y largo ----- */
  beamW(w, dt, g, p) {
    if (!this.ready(w, dt, p)) return;
    const a = this.aim(g, p, 40); if (!a) return;
    if (p.ki < 10) return;
    const lv = w.lv, big = lv >= 3 ? 1.4 : 1, dm = 30 * (1 + 0.55 * (lv >= 2)) * (lv >= 5 ? 1.4 : 1), crit = Math.random() < p.crit;
    w.cd = lv >= 5 ? 3.5 : lv >= 4 ? 4 : 5;
    p.ki -= 10;
    this.beam(p.x, p.z, a.dx, a.dz, 26 * big, 1.3 * big * (lv >= 5 ? 1.3 : 1), dm * p.damageMul() * (crit ? 2 : 1) * 0.35, 0.75, 0.1, this.col(w, p), true);
    p.attack(a.dx, a.dz, true, g); p.beamT = 0.75;
    g.shake(0.6);
    g.fx.burst(g.fx.aura, p.x, 1.4, p.z, 18, 6, 0.5, 0.35, 0, this.col(w, p));
  }

  /* ----- Big Bang Attack: esfera lenta con explosión ----- */
  bigbang(w, dt, g, p) {
    if (!this.ready(w, dt, p)) return;
    const a = this.aim(g, p, 34); if (!a) return;
    const lv = w.lv, n = 1 + (lv >= 5), dm = 26 * (1 + 0.35 * (lv >= 2) + 0.35 * (lv >= 5)), rad = 5 * (lv >= 3 ? 1.3 : 1);
    w.cd = lv >= 4 ? 3.6 : 4.5;
    for (let i = 0; i < n; i++) {
      const ang = n === 1 ? 0 : (i ? 0.25 : -0.25), c = Math.cos(ang), s = Math.sin(ang);
      g.ki.fire(p.x, p.z, a.dx * c - a.dz * s, a.dx * s + a.dz * c, 11, dm * p.damageMul(), 1.0, false, 2.6, 0, rad, this.col(w, p), 4);
    }
    p.attack(a.dx, a.dz, true, g);
  }

  /* ----- Guadaña Divina: tajo en arco ----- */
  scythe(w, dt, g, p) {
    const lv = w.lv, r = 6 * (lv >= 4 ? 1.3 : 1), dm = 16 * (1 + 0.4 * (lv >= 2));
    if (w.pend > 0) { w.pend -= dt; if (w.pend <= 0) this.slash(g, p, -w.pdx, -w.pdz, r, dm, lv >= 5, this.col(w, p)); }
    if (!this.ready(w, dt, p)) return;
    const a = this.aim(g, p, r + 3); if (!a) return;
    w.cd = 1.3;
    w.pdx = a.dx; w.pdz = a.dz;
    this.slash(g, p, a.dx, a.dz, r, dm, lv >= 5, this.col(w, p));
    if (lv >= 3) w.pend = 0.2;
    p.attack(a.dx, a.dz, true, g);
  }
  slash(g, p, dx, dz, r, dm, full, color) {
    g.horde.damageCone(p.x, p.z, dx, dz, r, full ? -2 : 0.35, dm * p.damageMul(), 9, g);
    g.world.damageArea(p.x + dx * r * 0.5, p.z + dz * r * 0.5, r * 0.6, dm);
    const base = Math.atan2(dz, dx), arc = full ? Math.PI * 2 : 2.4;
    for (let i = 0; i < 30; i++) {
      const a = base + (i / 29 - 0.5) * arc, c = Math.cos(a), s = Math.sin(a);
      g.fx.sparks.emit(p.x + c * r * 0.9, 1.2, p.z + s * r * 0.9, c * 5, 0.4, s * 5, 0.28, 0.42, 0, color);
      if (i % 3 === 0) g.fx.aura.emit(p.x + c * r * 0.6, 1.2, p.z + s * r * 0.6, c * 3, 0, s * 3, 0.3, 0.3, 0, color);
    }
    g.shake(0.2);
  }

  /* ----- Pool de rayos ----- */
  beam(x, z, dx, dz, len, hw, dmg, life, tickDt, color, follow) {
    for (const b of this.beams) {
      if (b.on) continue;
      b.on = true; b.x = x; b.z = z; b.dx = dx; b.dz = dz; b.len = len; b.hw = hw; b.dmg = dmg; b.age = 0; b.life = life; b.tick = 0; b.tickDt = tickDt; b.color = color; b.follow = follow;
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
        g.horde.damageLine(b.x, b.z, b.dx, b.dz, cur, b.hw, b.dmg, g);
        for (let t = 2; t < cur; t += 4) g.world.damageArea(b.x + b.dx * t, b.z + b.dz * t, b.hw, b.dmg);
        g.fx.sparks.emit(b.x + b.dx * cur, 1.5, b.z + b.dz * cur, rand(-3, 3), rand(0, 4), rand(-3, 3), 0.3, 0.35, 0, b.color);
      }
      const wob = 1 + Math.sin(g.time * 40) * 0.08;
      for (let t = 0.8; t <= cur; t += 0.8) {
        const x = b.x + b.dx * t, z = b.z + b.dz * t;
        B.push(x, 1.5, z, 0, 0, 0, b.hw * 2.6 * wob, 0.10 * fade, b.color);
        B.push(x, 1.5, z, 0, 0, 0, b.hw * 1.5 * wob, 0.16 * fade, b.color);
        B.push(x, 1.5, z, 0, 0, 0, b.hw * 0.7 * wob, 0.22 * fade, 0xffffff);
      }
      B.push(b.x + b.dx * cur, 1.5, b.z + b.dz * cur, 0, 0, 0, b.hw * 3.6, 0.7 * fade, b.color);
    }
    B.end();
  }
}
