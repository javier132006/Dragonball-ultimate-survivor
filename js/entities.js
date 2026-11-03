'use strict';
/* =====================================================================
   entities.js · Player, HordeManager, KiPool, XpOrbs, Pickups
   Todo en arrays tipados / pools: sin crear objetos durante el juego.
   ===================================================================== */

/* ---------- JUGADOR ---------- */
class Player {
  constructor(scene, sheets, tex) {
    this.scene = scene; this.sheets = sheets;
    this.spr = {}; this.gho = {};
    this.shield = new SpriteBatch(scene, { max: 1, texture: tex.ring, w: 1, h: 1, anchor: 0.5, additive: true, alpha: 0.5, tint: 0x9be7ff, cut: 0.02, renderOrder: 5 });
    this.ghosts = [];
    for (let i = 0; i < 12; i++) this.ghosts.push({ t: 0, x: 0, z: 0, frame: 0, flip: 0, sheet: '' });
    this.ch = CHARACTERS[0];
    for (const f of this.ch.forms) this.batch(f.sheet);
    this.reset(this.ch);
  }

  /** Un SpriteBatch (1 sprite) por hoja usada; se crean una sola vez y se reutilizan */
  batch(name) {
    if (!this.spr[name]) {
      const s = this.sheets[name], H = 3.6;
      const base = { texture: s.tex, cols: s.cols, rows: s.rows, w: H * (s.w / s.h), h: H, anchor: 0.04 };
      this.spr[name] = new SpriteBatch(this.scene, Object.assign({ max: 1, blend: true, renderOrder: 3 }, base));
      this.gho[name] = new SpriteBatch(this.scene, Object.assign({ max: 12, blend: true, tint: 0x8defff, alpha: 0.5, renderOrder: 2 }, base));
    }
    return this.spr[name];
  }

  /** Prepara al personaje elegido con sus stats base + mejoras permanentes del laboratorio */
  reset(ch) {
    this.ch = ch;
    for (const f of ch.forms) { this.batch(f.sheet); if (f.anim.alt) this.batch(f.anim.alt.sheet); }
    this.stacks = {}; this.items = {}; this.buffs = []; this.reviveUsed = false; this.formReady = -1;
    this.kbx = 0; this.kbz = 0; this.comboMul = 1; this.dashBoost = 1; this.slow = 1;
    this.initStats();
    this.hp = this.maxHp; this.ki = this.maxKi;
    this.canRevive = Save.lab('revive') > 0;
    this.buffT = 0; this.buffDmg = 0;
    this.x = 0; this.z = 0; this.vx = 0; this.vz = 0; this.flip = 0;
    this.level = 1; this.xp = 0; this.xpNext = this.xpFor(1);
    this.dashT = 0; this.dashCd = 0; this.dashX = 1; this.dashZ = 0; this.iframes = 0; this.ghostT = 0;
    this.charging = false; this.shockT = 0; this.prevSpace = false; this.auraAcc = 0;
    this.animT = 0; this.atkT = 0; this.beamT = 0; this.atkFrame = 0; this.hurtT = 0; this.moving = false;
    this.dying = false; this.deathT = 0;
    this.setForm(0);
    for (const g of this.ghosts) g.t = 0;
  }

  /** Estadísticas base del personaje + mejoras permanentes del laboratorio */
  initStats() {
    const ch = this.ch, L = (id) => Save.lab(id);
    this.maxHp = Math.round(ch.hp * (1 + 0.08 * L('hp'))); this.maxKi = ch.ki; this.kiRegen = 4 * (1 + 0.08 * L('ki'));
    this.statDmg = 1 + 0.04 * L('dmg'); this.speedMul = ch.spd * (1 + 0.03 * L('spd')); this.magnet = 5 * (1 + 0.1 * L('mag'));
    this.crit = 0.08 + 0.02 * L('crit'); this.critDmg = 2;
    this.rateMul = 1; this.regen = 0; this.armor = 0; this.xpMul = 1; this.killHeal = 0; this.dodge = 0; this.dashMul = 1; this.luck = 0;
    this.zeniMul = 1 + 0.1 * L('zeni');
    // Pasivas de los personajes nuevos
    if (ch.id === 'piccolo') this.regen += 1.5;
    if (ch.id === 'freezer') this.zeniMul += 0.25;
  }
  /** Recalcula todo desde cero: base + vitaminas + objetos + mejoras temporales. Permite quitar o cambiar objetos */
  recompute() {
    const oh = this.hp, om = this.maxHp, ok = this.maxKi;
    this.initStats();
    for (const s of STATS) for (let k = 0; k < (this.stacks[s.id] || 0); k++) s.apply(this);
    for (const id in this.items) { const it = itemById(id); for (let k = 0; k < this.items[id]; k++) it.apply(this); }
    for (const id of this.buffs) BUFFS[id].apply(this);
    this.maxHp = Math.max(20, this.maxHp);
    this.hp = Math.min(this.maxHp, oh + Math.max(0, this.maxHp - om));
    this.ki = Math.min(this.maxKi, this.ki + Math.max(0, this.maxKi - ok));
  }

  setForm(idx) {
    this.formIdx = idx; this.form = this.ch.forms[idx]; this.anim = this.form.anim;
    this.drawSheet = this.form.sheet; this.frame = this.anim.idle; this.atkFrame = this.anim.atk;
  }

  xpFor(level) { return Math.floor(6 + level * 3 + level * level * 0.35); }

  /** Multiplicador de daño total: vitaminas x forma x pasiva del personaje */
  damageMul() {
    let m = this.statDmg * this.form.dmg * (this.buffT > 0 ? 1 + this.buffDmg : 1);
    if (this.ch.id === 'goku') m *= 1 + 0.015 * (this.level - 1);                     // Zenkai
    if (this.ch.id === 'vegeta' && this.ki >= this.maxKi * 0.8) m *= 1.25;           // Orgullo Saiyajin
    if (this.ch.id === 'gohan' && this.hp < this.maxHp * 0.5) m *= 1.4;               // Potencial oculto
    return m * this.comboMul;                                                         // bonus de la racha de combos
  }

  /** Devuelve true si el golpe entra (para el empujón de los enemigos grandes) */
  takeDamage(amount, game) {
    if (this.iframes > 0 || game.state !== 'play') return false;
    if (this.dodge > 0 && Math.random() < this.dodge) {            // esquiva (objetos)
      this.iframes = 0.3; game.ui.toast('ESQUIVA', true);
      game.fx.burst(game.fx.trail, this.x, 1, this.z, 8, 4, 0.4, 0.3, 0);
      return false;
    }
    if (game.practice && this.hp - amount * (1 - this.armor) <= 1) { this.hp = this.maxHp; game.ui.toast('ENTRENAMIENTO · VIDA RESTAURADA', true); }
    game.onPlayerHit();
    SFX.play('hurt');
    this.hp -= amount * (1 - this.armor);
    this.iframes = 0.55; this.hurtT = 0.3;
    game.run.taken += amount * (1 - this.armor);
    game.ui.flash = 1;
    game.shake(0.45);
    game.hitstop = 0.04;
    game.fx.burst(game.fx.sparks, this.x, 1.3, this.z, 8, 7, 0.4, 0.35, 8);
    return true;
  }

  /** Lo llaman las armas al disparar: gira al personaje hacia el objetivo y muestra la pose de ataque */
  attack(dx, dz, crit, game) {
    this.flip = dx * game.camCos - dz * game.camSin < 0 ? 1 : 0;
    this.atkT = 0.18; this.atkFrame = crit ? this.anim.crit : this.anim.atk;
  }

  die() { this.dying = true; this.deathT = 0; this.charging = false; this.vx = 0; this.vz = 0; }
  updateDeath(dt) { this.deathT += dt; return this.deathT >= 1.9; }

  update(dt, game) {
    // --- Entrada relativa a la cámara: W siempre avanza "hacia arriba" en pantalla ---
    let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    let iz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
    let il = Math.hypot(ix, iz);
    if (il > 0) { ix /= il; iz /= il; }
    else if (stick.on) { ix = stick.x; iz = stick.z; il = Math.hypot(ix, iz); if (il < 0.15) { ix = iz = il = 0; } }   // joystick táctil (analógico)
    const wx = ix * game.camCos + iz * game.camSin, wz = -ix * game.camSin + iz * game.camCos;

    this.animT += dt;
    this.iframes = Math.max(0, this.iframes - dt); this.dashCd = Math.max(0, this.dashCd - dt);
    this.atkT = Math.max(0, this.atkT - dt); this.hurtT = Math.max(0, this.hurtT - dt); this.beamT = Math.max(0, this.beamT - dt);
    this.charging = !!keys.KeyC && this.dashT <= 0;

    // --- Dash / Shunkan Ido: solo en el flanco de bajada de ESPACIO ---
    const space = !!keys.Space;
    if (space && !this.prevSpace && this.dashT <= 0 && this.dashCd <= 0 && this.ki >= CFG.DASH_COST && !this.charging) {
      this.dashX = il > 0 ? wx : (this.flip ? -game.camCos : game.camCos);
      this.dashZ = il > 0 ? wz : (this.flip ? this.dashZ * 0 + game.camSin : -game.camSin);
      this.dashT = CFG.DASH_TIME; this.dashCd = CFG.DASH_CD * this.dashMul; this.ghostT = 0;
      this.ki -= CFG.DASH_COST; game.run.dashes++; SFX.play('dash');
      this.dashT *= this.dashBoost > 1 ? 1.25 : 1;                 // gravedad baja: dash más largo
      this.iframes = Math.max(this.iframes, CFG.DASH_TIME + 0.1);
      game.fx.burst(game.fx.trail, this.x, 0.8, this.z, 12, 5, 0.5, 0.6, 0);
      game.shake(0.25);
    }
    this.prevSpace = space;

    // --- Movimiento ---
    this.buffT = Math.max(0, this.buffT - dt);
    const speed = 9 * this.speedMul * this.form.spd * (this.buffT > 0 ? 1.2 : 1) * this.slow;
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = this.dashX * CFG.DASH_SPEED * this.dashBoost; this.vz = this.dashZ * CFG.DASH_SPEED * this.dashBoost;
      this.ghostT -= dt;
      if (this.ghostT <= 0) this.spawnGhost();
    } else {
      const k = 1 - Math.exp(-16 * dt);
      this.vx += ((this.charging ? 0 : wx * speed) - this.vx) * k;
      this.vz += ((this.charging ? 0 : wz * speed) - this.vz) * k;
    }
    for (const g of this.ghosts) if (g.t > 0) g.t -= dt;
    // Empujón de los enemigos grandes (se amortigua rápido)
    const kd = Math.exp(-7 * dt);
    this.x = clamp(this.x + (this.vx + this.kbx) * dt, -CFG.ARENA, CFG.ARENA);
    this.z = clamp(this.z + (this.vz + this.kbz) * dt, -CFG.ARENA, CFG.ARENA);
    this.kbx *= kd; this.kbz *= kd;
    game.world.push(this.x, this.z, CFG.PLAYER_R);
    this.x = game.world.px; this.z = game.world.pz;
    const sp = Math.hypot(this.vx, this.vz);
    this.moving = sp > 0.8;
    if (this.moving && this.atkT <= 0 && this.beamT <= 0) this.flip = this.vx * game.camCos - this.vz * game.camSin < 0 ? 1 : 0;

    // --- Ki, vida y carga táctica ---
    this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);
    if (this.charging) {
      this.ki = Math.min(this.maxKi, this.ki + 35 * dt);
      this.hp = Math.min(this.maxHp, this.hp + 6 * dt);
      const n = Math.max(1, Math.round(dt * 130)), ac = this.form.aura || 0xfff2b0;
      for (let i = 0; i < n; i++) {
        const a = rand(0, 6.28), r = rand(0.9, 1.6);
        game.fx.aura.emit(this.x + Math.cos(a) * r, rand(0.1, 0.6), this.z + Math.sin(a) * r, 0, rand(4, 7), 0, rand(0.45, 0.8), rand(0.12, 0.28), 0, ac);
      }
      this.shockT -= dt;
      if (this.shockT <= 0) {                    // onda expansiva que repele a los enemigos
        this.shockT = 0.55;
        game.horde.shockwave(this.x, this.z, 8, 17);
        game.fx.ring(game.fx.aura, this.x, 0.5, this.z, 40, 15, 0.45, 0.3, ac);
        game.shake(0.14);
      }
    } else { this.ki = Math.min(this.maxKi, this.ki + this.kiRegen * dt); this.shockT = 0; }

    // --- Aura continua de la transformación (el Kaio-ken la tiñe de rojo) ---
    if (this.form.aura || this.buffT > 0) {
      this.auraAcc += dt * 45;
      while (this.auraAcc >= 1) {
        this.auraAcc -= 1;
        game.fx.aura.emit(this.x + rand(-0.8, 0.8), rand(0, 0.5), this.z + rand(-0.4, 0.4), 0, rand(3, 6), 0, rand(0.35, 0.6), rand(0.16, 0.34), 0, this.buffT > 0 ? 0xff3030 : this.form.aura);
      }
    }
    this.pose();
  }

  /** Elige hoja y fotograma según el estado */
  pose() {
    const a = this.anim;
    this.drawSheet = this.form.sheet;
    let fr = a.idle;
    if (this.hurtT > 0 && a.hurt >= 0) fr = a.hurt;
    else if (this.hurtT > 0 && a.alt && a.alt.hurt >= 0) { fr = a.alt.hurt; this.drawSheet = a.alt.sheet; }
    else if (this.dashT > 0) fr = a.dash;
    else if (this.beamT > 0) fr = a.atk2;
    else if (this.atkT > 0) fr = this.atkFrame;
    else if (this.moving) fr = a.walk[((this.animT * 9) | 0) % a.walk.length];
    this.frame = fr;
  }

  spawnGhost() {
    this.ghostT = 0.025;
    for (const g of this.ghosts) {
      if (g.t <= 0) { g.t = 0.3; g.x = this.x; g.z = this.z; g.frame = this.frame; g.flip = this.flip; g.sheet = this.drawSheet; return; }
    }
  }

  /** Vuelca sprite, imágenes residuales, escudo y sombra a la GPU */
  syncSprite(shadows) {
    let y = 0, alpha = 1, flash = 0, scale = 1, sheet = this.drawSheet, frame = this.frame;
    for (const k in this.spr) { this.spr[k].begin(); this.gho[k].begin(); }
    if (this.dying) {
      const t = this.deathT, a = this.anim;
      const fr = a.death ? { s: this.form.sheet, f: a.death } : a.alt && a.alt.death ? { s: a.alt.sheet, f: a.alt.death } : null;
      if (fr) { sheet = fr.s; frame = t < 0.35 ? fr.f[0] : t < 0.9 ? fr.f[1] : fr.f[2]; alpha = clamp(1 - (t - 1.1) / 0.75, 0, 1); }
      else { sheet = this.form.sheet; frame = a.idle; flash = t < 0.35 ? 1 : 0; alpha = clamp(1 - t / 1.5, 0, 1); y = t * 1.2; scale = 1 + t * 0.12; }
    } else {
      if (this.dashT > 0) y = 0.5;
      else if (this.moving) y = Math.abs(Math.sin(this.animT * 9)) * 0.12;
      flash = this.hurtT > 0.22 ? 1 : 0;
      if (this.iframes > 0 && this.dashT <= 0 && ((this.animT * 18) | 0) % 2) alpha = 0.5;
    }
    this.spr[sheet].push(this.x, y, this.z, frame, this.flip, flash, scale, alpha, this.form.tint);
    for (const g of this.ghosts) if (g.t > 0) this.gho[g.sheet].push(g.x, 0.5, g.z, g.frame, g.flip, 0, 1, g.t / 0.3, this.form.tint);
    for (const k in this.spr) { this.spr[k].end(); this.gho[k].end(); }
    this.shield.begin();
    if (this.charging) this.shield.push(this.x, 1.5, this.z, 0, 0, 0, 5 * (1 + Math.sin(this.animT * 12) * 0.05), 1);
    this.shield.end();
    shadows.push(this.x, 0.06, this.z, 0, 0, 0, 2.5 * (1 - y * 0.3), alpha);
  }
}

/* ---------- HORDA (sprites instanciados + rejilla espacial) ---------- */
class HordeManager {
  constructor(scene, max, sheet) {
    this.max = max; this.n = 0; this.speed = 3.4; this.uidNext = 1;
    const f = () => new Float32Array(max);
    this.x = f(); this.z = f(); this.hp = f(); this.maxHp = f(); this.hitT = f(); this.kx = f(); this.kz = f(); this.phase = f(); this.flip = f();
    this.type = new Uint8Array(max); this.uid = new Int32Array(max);
    this.half = CFG.ARENA + 8;
    this.cols = Math.ceil((this.half * 2) / CFG.CELL);
    this.heads = new Int32Array(this.cols * this.cols).fill(-1);
    this.next = new Int32Array(max);
    this.tints = ENEMY_TYPES.map((t) => t.tint);
    const H = 2.9;
    this.sb = new SpriteBatch(scene, { max, texture: sheet.tex, cols: sheet.cols, rows: sheet.rows, w: H * (sheet.w / sheet.h), h: H, anchor: 0.04, renderOrder: 0 });
  }

  cellOf(x, z) {
    return clamp(Math.floor((z + this.half) / CFG.CELL), 0, this.cols - 1) * this.cols + clamp(Math.floor((x + this.half) / CFG.CELL), 0, this.cols - 1);
  }
  /** Reconstruye la rejilla (tras cada reap, para que los índices coincidan) */
  buildGrid() {
    this.heads.fill(-1);
    for (let i = 0; i < this.n; i++) { const c = this.cellOf(this.x[i], this.z[i]); this.next[i] = this.heads[c]; this.heads[c] = i; }
  }

  spawn(x, z, hp, type) {
    if (this.n >= this.max) return -1;
    const i = this.n++;
    this.x[i] = x; this.z[i] = z; this.hp[i] = hp; this.maxHp[i] = hp; this.hitT[i] = 0; this.kx[i] = 0; this.kz[i] = 0;
    this.phase[i] = rand(0, 40); this.flip[i] = 0; this.type[i] = type; this.uid[i] = this.uidNext++;
    return i;
  }
  remove(i) {
    const l = --this.n;
    this.x[i] = this.x[l]; this.z[i] = this.z[l]; this.hp[i] = this.hp[l]; this.maxHp[i] = this.maxHp[l]; this.hitT[i] = this.hitT[l];
    this.kx[i] = this.kx[l]; this.kz[i] = this.kz[l]; this.phase[i] = this.phase[l]; this.flip[i] = this.flip[l];
    this.type[i] = this.type[l]; this.uid[i] = this.uid[l];
  }
  indexOfUid(u) { for (let i = 0; i < this.n; i++) if (this.uid[i] === u) return i; return -1; }

  update(dt, player, game) {
    const n = this.n, x = this.x, z = this.z, kx = this.kx, kz = this.kz, heads = this.heads, next = this.next, cols = this.cols, world = game.world;
    const px = player.x, pz = player.z, lim = CFG.ARENA + 2, kd = Math.exp(-7 * dt), dmg = game.enemyDamage(), cc = game.camCos, cs = game.camSin;
    for (let i = 0; i < n; i++) {
      const T = ENEMY_TYPES[this.type[i]], xi = x[i], zi = z[i], sepR = T.r * 1.8, sepR2 = sepR * sepR;
      let dx = px - xi, dz = pz - zi;
      const d = Math.sqrt(dx * dx + dz * dz) + 1e-4;
      dx /= d; dz /= d;
      const sp = this.speed * T.spd;
      let vx = dx * sp, vz = dz * sp, sx = 0, sz = 0;
      const c = this.cellOf(xi, zi), cx = c % cols, cz = (c / cols) | 0;
      for (let gz = cz - 1; gz <= cz + 1; gz++) {
        if (gz < 0 || gz >= cols) continue;
        for (let gx = cx - 1; gx <= cx + 1; gx++) {
          if (gx < 0 || gx >= cols) continue;
          for (let j = heads[gz * cols + gx]; j !== -1; j = next[j]) {
            if (j === i) continue;
            const ex = xi - x[j], ez = zi - z[j], e2 = ex * ex + ez * ez;
            if (e2 < sepR2 && e2 > 1e-6) { const e = Math.sqrt(e2), f = (sepR - e) / sepR; sx += (ex / e) * f; sz += (ez / e) * f; }
          }
        }
      }
      vx += sx * 5 + kx[i]; vz += sz * 5 + kz[i];
      kx[i] *= kd; kz[i] *= kd;
      world.push(clamp(xi + vx * dt, -lim, lim), clamp(zi + vz * dt, -lim, lim), T.r * 0.8);   // esquiva rocas, árboles y mesetas
      x[i] = world.px; z[i] = world.pz;
      this.flip[i] = dx * cc - dz * cs < 0 ? 1 : 0;
      this.phase[i] += dt * 8 * (0.6 + T.spd * 0.4);
      if (this.hitT[i] > 0) this.hitT[i] -= dt;
      if (d < CFG.PLAYER_R + T.r + 0.15 && this.hp[i] > 0 && player.takeDamage(dmg * T.dmg, game) && T.knock) { player.kbx = dx * T.knock; player.kbz = dz * T.knock; game.shake(0.6); }
    }
  }

  /** Aplica daño a un enemigo (la retirada se hace después, en reap) */
  hurt(i, dmg, kx, kz, game) {
    if (this.hp[i] <= 0) return;
    const real = Math.min(dmg, this.hp[i]), R = game.run;
    R.damage += real; if (dmg > R.best) R.best = dmg;
    R.byW[DMG_SRC] = (R.byW[DMG_SRC] || 0) + real;
    SFX.play('hit');
    this.hp[i] -= dmg; this.hitT[i] = 0.12;
    const m = this.type[i] === 3 ? 0.15 : 1;
    this.kx[i] += kx * m; this.kz[i] += kz * m;
    game.fx.burst(game.fx.sparks, this.x[i], 1.2, this.z[i], 2, 5, 0.25, 0.25, 6);
  }

  /** Colisión de una ráfaga contra la rejilla. true = la ráfaga se consume */
  hitTest(b, game) {
    const cols = this.cols, c = this.cellOf(b.x, b.z), cx = c % cols, cz = (c / cols) | 0;
    for (let gz = cz - 1; gz <= cz + 1; gz++) {
      if (gz < 0 || gz >= cols) continue;
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        if (gx < 0 || gx >= cols) continue;
        for (let j = this.heads[gz * cols + gx]; j !== -1; j = this.next[j]) {
          if (j >= this.n || this.hp[j] <= 0) continue;
          const rr = (b.r + ENEMY_TYPES[this.type[j]].r) * (b.r + ENEMY_TYPES[this.type[j]].r), dx = this.x[j] - b.x, dz = this.z[j] - b.z;
          if (dx * dx + dz * dz >= rr) continue;
          const u = this.uid[j];
          if (b.ign.indexOf(u) >= 0) continue;
          this.hurt(j, b.dmg, b.vx * 0.22, b.vz * 0.22, game);
          game.fx.burst(game.fx.sparks, b.x, 1.2, b.z, b.crit ? 8 : 3, b.crit ? 9 : 5, 0.3, b.crit ? 0.4 : 0.25, 6, b.tint);
          if (b.crit) { game.hitstop = 0.04; game.shake(0.3); game.onCrit(b.dmg); } else game.shake(0.05);
          if (b.pierce > 0) { b.pierce--; b.ign[b.ni++ % b.ign.length] = u; return false; }
          return true;
        }
      }
    }
    return false;
  }

  nearest(px, pz, range) {
    let best = -1, bd = range * range;
    for (let i = 0; i < this.n; i++) {
      if (this.hp[i] <= 0) continue;
      const dx = this.x[i] - px, dz = this.z[i] - pz, d2 = dx * dx + dz * dz;
      if (d2 < bd) { bd = d2; best = i; }
    }
    return best;
  }

  /** Daño en círculo usando la rejilla */
  damageRadius(px, pz, r, dmg, knock, game) {
    const cols = this.cols, rc = Math.ceil((r + 2) / CFG.CELL), c = this.cellOf(px, pz), cx = c % cols, cz = (c / cols) | 0;
    for (let gz = cz - rc; gz <= cz + rc; gz++) {
      if (gz < 0 || gz >= cols) continue;
      for (let gx = cx - rc; gx <= cx + rc; gx++) {
        if (gx < 0 || gx >= cols) continue;
        for (let j = this.heads[gz * cols + gx]; j !== -1; j = this.next[j]) {
          if (j >= this.n || this.hp[j] <= 0) continue;
          const dx = this.x[j] - px, dz = this.z[j] - pz, rr = r + ENEMY_TYPES[this.type[j]].r, d2 = dx * dx + dz * dz;
          if (d2 < rr * rr) { const d = Math.sqrt(d2) || 1; this.hurt(j, dmg, (dx / d) * knock, (dz / d) * knock, game); }
        }
      }
    }
  }
  /** Daño en línea (rayos): proyecta cada enemigo sobre el eje del rayo */
  damageLine(ox, oz, dx, dz, len, hw, dmg, game) {
    for (let i = 0; i < this.n; i++) {
      if (this.hp[i] <= 0) continue;
      const ex = this.x[i] - ox, ez = this.z[i] - oz, t = ex * dx + ez * dz;
      if (t < -1 || t > len) continue;
      const perp = Math.abs(ex * dz - ez * dx);
      if (perp < hw + ENEMY_TYPES[this.type[i]].r) this.hurt(i, dmg, dx * 3, dz * 3, game);
    }
  }
  /** Daño en abanico (guadaña): radio + ángulo */
  damageCone(ox, oz, dx, dz, radius, cosHalf, dmg, knock, game) {
    for (let i = 0; i < this.n; i++) {
      if (this.hp[i] <= 0) continue;
      const ex = this.x[i] - ox, ez = this.z[i] - oz, d = Math.sqrt(ex * ex + ez * ez);
      if (d > radius + ENEMY_TYPES[this.type[i]].r) continue;
      if (d > 0.5 && (ex * dx + ez * dz) / d < cosHalf) continue;
      this.hurt(i, dmg, (ex / (d || 1)) * knock, (ez / (d || 1)) * knock, game);
    }
  }
  shockwave(px, pz, radius, force) {
    const r2 = radius * radius;
    for (let i = 0; i < this.n; i++) {
      const dx = this.x[i] - px, dz = this.z[i] - pz, d2 = dx * dx + dz * dz;
      if (d2 < r2 && d2 > 1e-6) { const d = Math.sqrt(d2), f = force * (1.2 - d / radius) * (this.type[i] === 3 ? 0.15 : 1); this.kx[i] += (dx / d) * f; this.kz[i] += (dz / d) * f; }
    }
  }
  reap(game) {
    for (let i = this.n - 1; i >= 0; i--) if (this.hp[i] <= 0) { game.onEnemyKilled(this.x[i], this.z[i], this.type[i], this.uid[i]); this.remove(i); }
  }

  sync(shadows) {
    const sb = this.sb, walk = A_STD.walk;
    sb.begin();
    for (let i = 0; i < this.n; i++) {
      const T = ENEMY_TYPES[this.type[i]], ph = this.phase[i], hit = this.hitT[i] > 0 ? this.hitT[i] : 0;
      sb.push(this.x[i], Math.abs(Math.sin(ph * 1.1)) * 0.14 * T.scale, this.z[i], walk[(ph | 0) % walk.length], this.flip[i], hit * 8, T.scale * (1 + hit * 1.2), 1, this.tints[this.type[i]]);
      shadows.push(this.x[i], 0.06, this.z[i], 0, 0, 0, 1.9 * T.scale, 1);
    }
    sb.end();
  }
  reset() { this.n = 0; this.heads.fill(-1); this.sb.reset(); }
}

/* ---------- PROYECTILES DE KI (pool; perforación y explosión opcionales) ---------- */
class KiPool {
  constructor(scene, max, tex) {
    this.max = max; this.b = [];
    for (let i = 0; i < max; i++) this.b.push({ active: false, x: 0, y: 1.4, z: 0, vx: 0, vz: 0, life: 0, dmg: 0, r: 0.5, trail: 0, crit: false, pierce: 0, aoe: 0, tint: 0xffffff, ign: [0, 0, 0, 0, 0, 0], ni: 0, size: 1, src: '' });
    this.sb = new SpriteBatch(scene, { max, texture: tex.ki, w: 1, h: 1, anchor: 0.5, additive: true, cut: 0.05, renderOrder: 5 });
  }
  fire(x, z, dx, dz, speed, dmg, r, crit, life, pierce, aoe, tint, size) {
    for (let i = 0; i < this.max; i++) {
      const b = this.b[i];
      if (b.active) continue;
      b.active = true; b.x = x; b.z = z; b.y = 1.4; b.vx = dx * speed; b.vz = dz * speed; b.life = life; b.dmg = dmg; b.r = r;
      b.crit = crit; b.pierce = pierce; b.aoe = aoe; b.tint = tint; b.trail = 0; b.ni = 0; b.size = size || (crit ? 3.6 : 2.6) * r * 1.3;
      for (let k = 0; k < 6; k++) b.ign[k] = 0;
      b.src = DMG_SRC; SFX.play('ki');
      return true;
    }
    return false;
  }
  update(dt, game) {
    const sb = this.sb;
    sb.begin();
    for (let i = 0; i < this.max; i++) {
      const b = this.b[i];
      if (!b.active) continue;
      b.life -= dt; b.x += b.vx * dt; b.z += b.vz * dt;
      const out = b.life <= 0 || Math.abs(b.x) > CFG.ARENA + 10 || Math.abs(b.z) > CFG.ARENA + 10;
      let done = out;
      DMG_SRC = b.src;
      if (!done && game.horde.hitTest(b, game)) done = true;
      if (!done && game.world.damageArea(b.x, b.z, b.r * 0.4, b.dmg)) done = b.pierce <= 0;
      if (done) { b.active = false; if (b.aoe > 0 && !(out && b.life > 0)) game.explode(b.x, b.z, b.aoe, b.dmg * 1.2, b.tint); continue; }
      b.trail -= dt;
      if (b.trail <= 0) { b.trail = 0.03; game.fx.sparks.emit(b.x, b.y, b.z, rand(-1, 1), rand(0, 1.5), rand(-1, 1), 0.25, b.r * 0.5, 0, b.tint); }
      sb.push(b.x, b.y, b.z, 0, 0, 0, b.size, 1, b.tint);
    }
    DMG_SRC = 'otros';
    sb.end();
  }
  reset() { for (const b of this.b) b.active = false; this.sb.reset(); }
}

/* ---------- ORBES DE EXPERIENCIA ---------- */
class XpOrbs {
  constructor(scene, max, tex) {
    this.max = max; this.n = 0; this.t = 0;
    this.x = new Float32Array(max); this.z = new Float32Array(max); this.v = new Float32Array(max);
    this.sb = new SpriteBatch(scene, { max, texture: tex.gem, w: 1, h: 1, anchor: 0.5, tint: 0x57f0ff, renderOrder: 1 });
  }
  spawn(x, z, val) {
    if (this.n >= this.max) { this.v[this.max - 1] += val; return; }
    const i = this.n++;
    this.x[i] = x + rand(-0.6, 0.6); this.z[i] = z + rand(-0.6, 0.6); this.v[i] = val;
  }
  update(dt, player, game) {
    this.t += dt;
    const mr2 = player.magnet * player.magnet;
    for (let i = this.n - 1; i >= 0; i--) {
      const dx = player.x - this.x[i], dz = player.z - this.z[i], d2 = dx * dx + dz * dz;
      if (d2 < 1.7) { game.addXp(this.v[i]); SFX.play('xp'); const l = --this.n; this.x[i] = this.x[l]; this.z[i] = this.z[l]; this.v[i] = this.v[l]; }
      else if (d2 < mr2) { const d = Math.sqrt(d2), s = (26 * dt) / d; this.x[i] += dx * s; this.z[i] += dz * s; }
    }
    this.sb.begin();
    for (let i = 0; i < this.n; i++) this.sb.push(this.x[i], 0.7 + Math.sin(this.t * 4 + this.x[i]) * 0.15, this.z[i], 0, 0, 0, 0.7 + Math.min(0.9, this.v[i] * 0.06), 1);
    this.sb.end();
  }
  reset() { this.n = 0; this.sb.reset(); }
}

/* ---------- RECOGIBLES: semillas Senzu y Esferas del Dragón ---------- */
class Pickups {
  constructor(scene, tex) {
    this.sMax = 140; this.sx = new Float32Array(this.sMax); this.sz = new Float32Array(this.sMax); this.sn = 0;
    this.senzu = new SpriteBatch(scene, { max: this.sMax, texture: tex.senzu, w: 1, h: 1, anchor: 0.5, renderOrder: 1 });
    this.bx = new Float32Array(7); this.bz = new Float32Array(7); this.got = new Uint8Array(7); this.collected = 0; this.t = 0;
    this.balls = new SpriteBatch(scene, { max: 7, texture: tex.dball, cols: 7, rows: 1, w: 1.8, h: 1.8, anchor: 0.5, renderOrder: 1 });
  }
  /** Reparte semillas por el mapa y coloca las 7 esferas bien separadas */
  reset(world) {
    const R = CFG.ARENA - 12;
    this.sn = 0; this.collected = 0; this.got.fill(0);
    for (let i = 0; i < 70; i++) this.drop(rand(-R, R), rand(-R, R));
    this.scatterBalls();
  }
  scatterBalls() {
    const R = CFG.ARENA - 15;
    for (let i = 0; i < 7; i++) {
      for (let k = 0; k < 40; k++) {
        const x = rand(-R, R), z = rand(-R, R);
        let ok = Math.hypot(x, z) > 50;
        for (let j = 0; j < i && ok; j++) if (Math.hypot(x - this.bx[j], z - this.bz[j]) < 70) ok = false;
        if (ok || k === 39) { this.bx[i] = x; this.bz[i] = z; break; }
      }
      this.got[i] = 0;
    }
    this.collected = 0;
  }
  drop(x, z) {
    if (this.sn >= this.sMax) return;
    this.sx[this.sn] = x; this.sz[this.sn] = z; this.sn++;
  }
  update(dt, player, game) {
    this.t += dt;
    for (let i = this.sn - 1; i >= 0; i--) {
      const dx = player.x - this.sx[i], dz = player.z - this.sz[i];
      if (dx * dx + dz * dz < 2.6) {
        player.hp = Math.min(player.maxHp, player.hp + 30); SFX.play('heal');
        game.fx.burst(game.fx.aura, this.sx[i], 0.8, this.sz[i], 10, 4, 0.5, 0.25, 0, 0x9cff6a);
        game.ui.toast('+30 VIDA', true);
        const l = --this.sn; this.sx[i] = this.sx[l]; this.sz[i] = this.sz[l];
      }
    }
    for (let i = 0; i < 7; i++) {
      if (this.got[i]) continue;
      const dx = player.x - this.bx[i], dz = player.z - this.bz[i];
      if (dx * dx + dz * dz < 3.2) { this.got[i] = 1; this.collected++; game.onBall(this.collected, this.bx[i], this.bz[i]); }
    }
    this.senzu.begin();
    for (let i = 0; i < this.sn; i++) this.senzu.push(this.sx[i], 0.55 + Math.sin(this.t * 3 + i) * 0.12, this.sz[i], 0, 0, 0, 0.9, 1);
    this.senzu.end();
    this.balls.begin();
    for (let i = 0; i < 7; i++) if (!this.got[i]) this.balls.push(this.bx[i], 1.1 + Math.sin(this.t * 2 + i) * 0.2, this.bz[i], i, 0, 0, 1, 1);
    this.balls.end();
  }
}

/* ---------- CÁPSULAS (cofres 2D de Capsule Corp repartidos por el mapa) ---------- */
class Capsules {
  constructor(scene, tex) {
    this.max = 40; this.n = 0; this.t = 0; this.respT = 30; this.near = -1;
    this.x = new Float32Array(this.max); this.z = new Float32Array(this.max); this.gold = new Uint8Array(this.max);
    this.spr = new SpriteBatch(scene, { max: this.max, texture: tex.capsule, cols: 3, rows: 1, w: 1.5, h: 1.5, anchor: 0.04, renderOrder: 2 });
    this.glow = new SpriteBatch(scene, { max: this.max, texture: tex.ki, w: 1, h: 1, anchor: 0.5, additive: true, alpha: 0.22, cut: 0.02, renderOrder: 1 });
  }
  /** Coloca una cápsula; el borde del mapa y los obstáculos se respetan con world.push */
  add(x, z, gold, world) {
    if (this.n >= this.max) return;
    const R = CFG.ARENA - 6;
    x = clamp(x, -R, R); z = clamp(z, -R, R);
    if (world) { world.push(x, z, 1.4); x = world.px; z = world.pz; }
    const i = this.n++;
    this.x[i] = x; this.z[i] = z; this.gold[i] = gold === 2 ? 2 : gold ? 1 : 0;       // 0 normal · 1 dorada · 2 maldita
  }
  removeAt(i) { const l = --this.n; this.x[i] = this.x[l]; this.z[i] = this.z[l]; this.gold[i] = this.gold[l]; }
  reset(world, count) {
    this.n = 0; this.respT = 30; this.near = -1;
    if (count === undefined) count = 28;
    for (let i = 0; i < count; i++) {
      let x, z;
      do { x = rand(-CFG.ARENA + 12, CFG.ARENA - 12); z = rand(-CFG.ARENA + 12, CFG.ARENA - 12); } while (Math.hypot(x, z) < 14);
      this.add(x, z, i % 6 === 0 ? 1 : i % 7 === 3 ? 2 : 0, world);
    }
  }
  update(dt, player, game) {
    this.t += dt;
    this.respT -= dt;
    if (this.respT <= 0) {
      if (game.stage.final) this.respT = 40; else {                                   // reaparece una cápsula nueva cada 40 s a distancia media
      this.respT = 40;
      const a = rand(0, 6.28), r = rand(35, 70);
      this.add(player.x + Math.cos(a) * r, player.z + Math.sin(a) * r, Math.random() < 0.12 ? 1 : Math.random() < 0.2 ? 2 : 0, game.world);
      }
    }
    // Cápsula abrible más cercana (se abre con E si tienes dinero)
    let best = -1, bd = 12;
    for (let i = 0; i < this.n; i++) {
      const dx = player.x - this.x[i], dz = player.z - this.z[i], d2 = dx * dx + dz * dz;
      if (d2 < bd) { bd = d2; best = i; }
    }
    this.near = best;
    this.spr.begin(); this.glow.begin();
    for (let i = 0; i < this.n; i++) {
      const b = Math.sin(this.t * 3 + i) * 0.12, g = this.gold[i];
      this.spr.push(this.x[i], 0.15 + b, this.z[i], g, 0, 0, g === 1 ? 1.25 : g === 2 ? 1.1 : 1, 1);
      this.glow.push(this.x[i], 0.8 + b, this.z[i], 0, 0, 0, 1.9 + (g === 1 ? 0.9 : g === 2 ? 0.5 : 0) + Math.sin(this.t * 4 + i) * 0.2, 1, g === 1 ? 0xffd24a : g === 2 ? 0xb040ff : 0xffffff);
    }
    this.spr.end(); this.glow.end();
  }
}

/* ---------- Disparos enemigos (los jefes): pool de 100 ---------- */
class EnemyShots {
  constructor(scene, tex) {
    this.max = 100; this.s = [];
    for (let i = 0; i < this.max; i++) this.s.push({ on: false, x: 0, z: 0, vx: 0, vz: 0, life: 0, dmg: 0 });
    this.sb = new SpriteBatch(scene, { max: this.max, texture: tex.ki, w: 1, h: 1, anchor: 0.5, additive: true, cut: 0.02, renderOrder: 5 });
  }
  fire(x, z, dx, dz, speed, dmg) {
    for (const s of this.s) if (!s.on) { s.on = true; s.x = x; s.z = z; s.vx = dx * speed; s.vz = dz * speed; s.life = 5; s.dmg = dmg; return; }
  }
  /** Anillo de n disparos (con un ángulo inicial) */
  ring(x, z, n, speed, dmg, off) { for (let i = 0; i < n; i++) { const a = off + (i / n) * 6.2832; this.fire(x, z, Math.cos(a), Math.sin(a), speed, dmg); } }
  update(dt, game) {
    const p = game.player;
    this.sb.begin();
    for (const s of this.s) {
      if (!s.on) continue;
      s.life -= dt; s.x += s.vx * dt; s.z += s.vz * dt;
      if (s.life <= 0) { s.on = false; continue; }
      const dx = p.x - s.x, dz = p.z - s.z;
      if (dx * dx + dz * dz < 1.1) { p.takeDamage(s.dmg, game); s.on = false; game.fx.burst(game.fx.sparks, s.x, 1.2, s.z, 5, 5, 0.3, 0.3, 6, 0xff4060); continue; }
      this.sb.push(s.x, 1.3, s.z, 0, 0, 0, 1.5, 1, 0xff5070);
    }
    this.sb.end();
  }
  reset() { for (const s of this.s) s.on = false; this.sb.reset(); }
}
