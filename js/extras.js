'use strict';
/* =====================================================================
   extras.js · Compañeros temporales (Krilin, Piccolo, Vegeta...) que
   aparecen durante un evento, siguen al jugador y pelean 60 segundos.
   Krilin sigue con sprite PROVISIONAL (hoja recoloreada); el resto, con su hoja.
   ===================================================================== */

const ALLIES = [
  { id: 'krilin', name: 'KRILIN', sheet: 'krilin', anim: A_KRL, tint: 0xffffff, ki: 0xffe86a, atk: 'disc', cd: 1.6 },
  { id: 'piccolo', name: 'PICCOLO', sheet: 'piccolo', anim: A_PIC, tint: 0xffffff, ki: 0xffa040, atk: 'beam', cd: 2.4 },
  { id: 'trunks', name: 'TRUNKS', sheet: 'trunks', anim: A_TRK, tint: 0xffffff, ki: 0x8ae8ff, atk: 'beam', cd: 2.2 },
  { id: 'gohan', name: 'GOHAN', sheet: 'gohan', anim: A_GOH, tint: 0xffffff, ki: 0x8fe0ff, atk: 'blast', cd: 0.9 },
  { id: 'vegeta', name: 'VEGETA', sheet: 'vegeta', anim: A_HD, tint: 0xffffff, ki: 0xb06bff, atk: 'blast', cd: 0.9 },
  { id: 'goku', name: 'SON GOKU', sheet: 'goku', anim: A_HD, tint: 0xffffff, ki: 0x6fd0ff, atk: 'beam', cd: 2.2 }
];
const ALLY_TIME = 60;

class Allies {
  constructor(scene, sheets) {
    this.list = [];                                         // aliados activos: {d, x, z, t, cd, flip, animT, atkT}
    this.spr = {};
    const H = 2.9;
    for (const name of new Set(ALLIES.map((a) => a.sheet))) {
      const sh = sheets[name]; if (!sh) continue;
      this.spr[name] = new SpriteBatch(scene, { max: 4, texture: sh.tex, cols: sh.cols, rows: sh.rows, w: H * (sh.w / sh.h), h: H, anchor: 0.04, renderOrder: 3 });
    }
  }
  reset() { this.list.length = 0; for (const k in this.spr) this.spr[k].reset(); }

  /** Llama a un compañero distinto al personaje que llevas */
  summon(g) {
    const pool = ALLIES.filter((a) => a.id !== g.player.ch.id && !this.list.some((l) => l.d === a));
    if (!pool.length) return null;
    const d = pick(pool), p = g.player, a = rand(0, 6.28);
    const al = { d, x: p.x + Math.cos(a) * 4, z: p.z + Math.sin(a) * 4, t: ALLY_TIME, cd: 1, flip: 0, animT: 0, atkT: 0, off: rand(0, 6.28) };
    this.list.push(al);
    g.fx.ring(g.fx.aura, al.x, 0.5, al.z, 40, 14, 0.6, 0.4, d.ki);
    g.fx.burst(g.fx.sparks, al.x, 1.4, al.z, 30, 10, 0.6, 0.4, 0, d.ki);
    return al;
  }

  update(dt, g) {
    const p = g.player;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const a = this.list[i], d = a.d;
      a.t -= dt; a.animT += dt; a.atkT = Math.max(0, a.atkT - dt);
      if (a.t <= 0) {                                       // se despide
        g.fx.ring(g.fx.aura, a.x, 0.5, a.z, 30, 12, 0.5, 0.35, d.ki);
        g.ui.toast(d.name + ' SE MARCHA', true);
        this.list.splice(i, 1); continue;
      }
      // Sigue al jugador a su lado (posición que gira despacio)
      const ang = a.off + g.time * 0.4, tx = p.x + Math.cos(ang) * 3.5, tz = p.z + Math.sin(ang) * 3.5;
      const dx = tx - a.x, dz = tz - a.z, dist = Math.hypot(dx, dz);
      if (dist > 0.3) { const sp = Math.min(dist * 4, 14) * dt / dist; a.x += dx * sp; a.z += dz * sp; }
      if (dist > 40) { a.x = tx; a.z = tz; }
      // Ataque al enemigo más cercano
      a.cd -= dt;
      if (a.cd <= 0) {
        const j = g.horde.nearest(a.x, a.z, 24);
        if (j >= 0) {
          a.cd = d.cd;
          const ex = g.horde.x[j] - a.x, ez = g.horde.z[j] - a.z, l = Math.hypot(ex, ez) || 1, ux = ex / l, uz = ez / l;
          const dm = 14 * p.damageMul();
          DMG_SRC = 'ally';
          if (d.atk === 'disc') g.ki.fire(a.x, a.z, ux, uz, 18, dm * 1.6, 0.9, false, 1.6, 99, 0, d.ki, 2.6);
          else if (d.atk === 'blast') g.ki.fire(a.x, a.z, ux, uz, 22, dm, 0.6, false, 1.4, 0, 1.8, d.ki);
          else { g.weapons.beam(a.x, a.z, ux, uz, 26, 1.0, dm * 0.6, 0.6, 0.1, d.ki, false); SFX.play('beam'); }
          DMG_SRC = 'otros';
          a.flip = ux * g.camCos - uz * g.camSin < 0 ? 1 : 0;
          a.atkT = 0.25;
        }
      }
      if (Math.random() < dt * 20) g.fx.aura.emit(a.x + rand(-0.6, 0.6), rand(0, 0.4), a.z + rand(-0.3, 0.3), 0, rand(3, 5), 0, 0.4, 0.2, 0, d.ki);
    }
    // Dibujo
    for (const k in this.spr) this.spr[k].begin();
    for (const a of this.list) {
      const d = a.d, an = d.anim, moving = true, fr = a.atkT > 0 ? an.atk : an.walk[((a.animT * 9) | 0) % an.walk.length];
      const alpha = a.t < 2 ? (((a.animT * 12) | 0) % 2 ? 0.4 : 1) : 1;
      this.spr[d.sheet].push(a.x, moving ? Math.abs(Math.sin(a.animT * 9)) * 0.1 : 0, a.z, fr, a.flip, 0, 1, alpha, d.tint);
    }
    for (const k in this.spr) this.spr[k].end();
  }
}
