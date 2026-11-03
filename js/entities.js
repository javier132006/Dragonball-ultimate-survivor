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
    this.ult = 0;                                  // carga de la Ultimate del personaje (0..100), si el personaje tiene una
    this.kbx = 0; this.kbz = 0; this.comboMul = 1; this.dashBoost = 1; this.slow = 1; this.grav = 1; this.slowT = 0; this.confT = 0;
    // Bloqueo con Ki, Transmisión Instantánea y efectos de los rasgos de transformación
    this.blocking = false; this.prevBlock = false; this.perfectT = 0; this.guardT = 0; this.tpCd = 0; this.prevF = false;
    this.egoStk = 0; this.auraT = 0; this.boltT = 0; this.tfCd = 0; this.formSeen = {}; this.trait = null; this.tr = {};
    this.fused = [];                                             // fusiones hechas (cada una tiene una pequeña desventaja)
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
    this.armor = 0.02 * L('armor'); this.xpMul = 1 + 0.05 * L('xp'); this.luck = L('luck');
    this.dashCost = 1; this.blockMul = 1 - 0.1 * L('block'); this.tpMax = 6 * (1 - 0.08 * L('tp'));
    // Pasivas de los personajes
    if (ch.id === 'piccolo') this.regen += 1.5;
    if (ch.id === 'freezer') this.zeniMul += 0.25;
    if (ch.id === 'krilin') { this.dodge += 0.12; this.dashMul *= 0.75; }
    if (ch.id === 'trunks') { this.crit += 0.06; this.critDmg += 0.3; }
    // Modificador del desafío diario «Cañón de cristal»
    if (typeof game !== 'undefined' && game && game.mods && game.mods.glass) { this.maxHp = Math.round(this.maxHp * 0.6); this.statDmg += 0.5; }
  }
  /** Recalcula todo desde cero: base + vitaminas + objetos + mejoras temporales. Permite quitar o cambiar objetos */
  recompute() {
    const oh = this.hp, om = this.maxHp, ok = this.maxKi;
    this.initStats();
    for (const s of STATS) for (let k = 0; k < (this.stacks[s.id] || 0); k++) s.apply(this);
    for (const id in this.items) { const it = itemById(id); for (let k = 0; k < this.items[id]; k++) it.apply(this); }
    for (const id of this.buffs) BUFFS[id].apply(this);
    if (this.trait) applyTraitStats(this, this.trait);                 // rasgo de la transformación actual
    for (const id of this.fused) if (WEAPONS[id].down) applyTraitStats(this, WEAPONS[id].down);   // desventaja de cada fusión
    this.maxHp = Math.max(20, Math.round(this.maxHp));
    this.hp = Math.min(this.maxHp, oh + Math.max(0, this.maxHp - om));
    this.ki = Math.min(this.maxKi, this.ki + Math.max(0, this.maxKi - ok));
  }

  setForm(idx) {
    this.formIdx = idx; this.form = this.ch.forms[idx]; this.anim = this.form.anim;
    this.drawSheet = this.form.sheet; this.frame = this.anim.idle; this.atkFrame = this.anim.atk;
    this.trait = traitOf(this.ch, idx); this.tr = (this.trait && this.trait.t) || {}; this.egoStk = 0;
  }
  /** Formas a las que puedes cambiar ahora (desbloqueadas por nivel y distintas de la actual) */
  formOptions() {
    const out = [];
    for (let i = 1; i < this.ch.forms.length; i++) if (i !== this.formIdx && this.level >= this.ch.forms[i].lvl) out.push(i);
    return out;
  }

  xpFor(level) { return Math.floor(6 + level * 3 + level * level * 0.35); }

  /** Multiplicador de daño total: vitaminas x forma x pasiva del personaje */
  /** Suma carga a la Ultimate (solo si el personaje tiene una) */
  addUlt(n) { if (this.ch.ult) this.ult = Math.min(this.ch.ult.cost, this.ult + n); }
  damageMul() {
    let m = this.statDmg * this.form.dmg * (this.buffT > 0 ? 1 + this.buffDmg : 1);
    if (this.ch.id === 'goku') m *= 1 + 0.015 * (this.level - 1);                     // Zenkai
    if (this.ch.id === 'vegeta' && this.ki >= this.maxKi * 0.8) m *= 1.25;           // Orgullo Saiyajin
    if (this.ch.id === 'gohan' && this.hp < this.maxHp * 0.5) m *= 1.4;               // Potencial oculto
    if (this.tr.lowHp && this.hp < this.maxHp * 0.5) m *= 1 + this.tr.lowHp;          // rasgo: más daño con poca vida
    if (this.egoStk) m *= 1 + this.egoStk;                                            // rasgo: Ego destructor
    return m * this.comboMul;                                                         // bonus de la racha de combos
  }

  /** Devuelve true si el golpe entra (para el empujón de los enemigos grandes) */
  takeDamage(amount, game) {
    if (this.iframes > 0 || game.state !== 'play') return false;
    // Rasgo Ultra Instinto: esquiva todo mientras quede Ki
    if (this.tr.dodgeKi && this.ki >= this.tr.dodgeKi) { this.ki -= this.tr.dodgeKi; this.iframes = 0.35; game.onAutoDodge(); return false; }
    if (this.dodge > 0 && Math.random() < this.dodge) {            // esquiva (objetos y rasgos)
      this.iframes = 0.3; game.ui.toast('ESQUIVA', true);
      game.fx.burst(game.fx.trail, this.x, 1, this.z, 8, 4, 0.4, 0.3, 0);
      return false;
    }
    // Bloqueo con Ki: perfecto (justo al empezar) = sin daño; normal = 70% menos gastando Ki; sin Ki = guardia rota
    let blocked = false;
    if (this.blocking) {
      if (this.perfectT > 0) { this.iframes = 0.45; game.onPerfectBlock(); return false; }
      const cost = 10 * this.blockMul;
      if (this.ki >= cost) { this.ki -= cost; amount *= 0.3; blocked = true; }
      else { this.guardT = 1.4; this.blocking = false; game.onGuardBreak(); }
    }
    const real = amount * (1 - this.armor);
    if (game.practice && this.hp - real <= 1) { this.hp = this.maxHp; game.ui.toast('ENTRENAMIENTO · VIDA RESTAURADA', true); }
    if (!blocked) game.onPlayerHit();                               // un golpe bloqueado no rompe el combo
    SFX.play(blocked ? 'block' : 'hurt');
    this.hp -= real;
    this.iframes = blocked ? 0.3 : 0.55; this.hurtT = blocked ? 0 : 0.3;
    if (this.tr.ego) this.egoStk = Math.min(this.tr.ego, this.egoStk + 0.03);
    game.run.taken += real;
    if (blocked) { game.fx.burst(game.fx.aura, this.x, 1.3, this.z, 10, 6, 0.3, 0.3, 0, 0x9be7ff); game.shake(0.15); return false; }
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
    // Efectos de los enemigos: «Cambio de cuerpo» de Ginyu (controles invertidos) y caramelo/hielo (ralentizado)
    this.slowT = Math.max(0, this.slowT - dt); this.confT = Math.max(0, this.confT - dt);
    if (this.confT > 0) { ix = -ix; iz = -iz; }
    const wx = ix * game.camCos + iz * game.camSin, wz = -ix * game.camSin + iz * game.camCos;

    this.animT += dt;
    this.iframes = Math.max(0, this.iframes - dt); this.dashCd = Math.max(0, this.dashCd - dt);
    this.atkT = Math.max(0, this.atkT - dt); this.hurtT = Math.max(0, this.hurtT - dt); this.beamT = Math.max(0, this.beamT - dt);
    this.charging = !!keys.KeyC && this.dashT <= 0;
    this.tpCd = Math.max(0, this.tpCd - dt); this.guardT = Math.max(0, this.guardT - dt); this.perfectT = Math.max(0, this.perfectT - dt); this.tfCd = Math.max(0, this.tfCd - dt);

    // --- Bloqueo con Ki (SHIFT o botón derecho): ventana de bloqueo perfecto al empezar ---
    const wantBlock = !!(keys.ShiftLeft || keys.ShiftRight || keys.Mouse2);
    this.blocking = wantBlock && !this.charging && this.dashT <= 0 && this.guardT <= 0 && this.ki > 1;
    if (this.blocking && !this.prevBlock) this.perfectT = 0.22;
    this.prevBlock = this.blocking;
    if (this.blocking) this.ki = Math.max(0, this.ki - 6 * this.blockMul * dt);

    // --- Transmisión Instantánea (F): te teletransportas 14 m hacia donde te mueves ---
    const fKey = !!keys.KeyF;
    if (fKey && !this.prevF && this.tpCd <= 0 && this.ki >= 35 && !this.charging && this.dashT <= 0) {
      const dx = il > 0 ? wx : (this.flip ? -game.camCos : game.camCos), dz = il > 0 ? wz : (this.flip ? game.camSin : -game.camSin);
      const ox = this.x, oz = this.z, lim = CFG.ARENA - 1;
      game.world.push(clamp(this.x + dx * 14, -lim, lim), clamp(this.z + dz * 14, -lim, lim), CFG.PLAYER_R);
      this.x = game.world.px; this.z = game.world.pz; this.vx = 0; this.vz = 0;
      this.ki -= 35; this.tpCd = this.tpMax; this.iframes = Math.max(this.iframes, 0.45);
      game.onTeleport(ox, oz, this.x, this.z);
    }
    this.prevF = fKey;

    // --- Dash / Shunkan Ido: solo en el flanco de bajada de ESPACIO ---
    const space = !!keys.Space;
    const dashCost = CFG.DASH_COST * this.dashCost;
    if (space && !this.prevSpace && this.dashT <= 0 && this.dashCd <= 0 && this.ki >= dashCost && !this.charging) {
      this.dashX = il > 0 ? wx : (this.flip ? -game.camCos : game.camCos);
      this.dashZ = il > 0 ? wz : (this.flip ? this.dashZ * 0 + game.camSin : -game.camSin);
      this.dashT = CFG.DASH_TIME; this.dashCd = CFG.DASH_CD * this.dashMul; this.ghostT = 0;
      this.ki -= dashCost; game.run.dashes++; SFX.play('dash');
      this.dashT *= this.dashBoost > 1 ? 1.25 : 1;                 // gravedad baja: dash más largo
      this.iframes = Math.max(this.iframes, CFG.DASH_TIME + 0.1);
      game.fx.burst(game.fx.trail, this.x, 0.8, this.z, 12, 5, 0.5, 0.6, 0);
      game.shake(0.25);
    }
    this.prevSpace = space;

    // --- Movimiento ---
    this.buffT = Math.max(0, this.buffT - dt);
    const speed = 9 * this.speedMul * this.form.spd * (this.buffT > 0 ? 1.2 : 1) * this.slow * (this.slowT > 0 ? 0.55 : 1) * this.grav * (this.blocking ? 0.45 : 1) * (this.guardT > 0 ? 0.6 : 1);
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
    if (!game.mods.noregen) this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);
    this.traitTick(dt, game);
    if (this.charging) {
      this.ki = Math.min(this.maxKi, this.ki + 35 * dt);
      if (!game.mods.noregen) this.hp = Math.min(this.maxHp, this.hp + 6 * dt);
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
    } else { if (!this.blocking && !this.tr.kiDrain) this.ki = Math.min(this.maxKi, this.ki + this.kiRegen * dt); this.shockT = 0; }   // las formas que gastan Ki no lo regeneran solas

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

  /** Efectos continuos del rasgo de la forma: gasto de Ki o vida, aura que quema y rayos */
  traitTick(dt, game) {
    const T = this.tr;
    if (T.kiDrain) {
      this.ki = Math.max(0, this.ki - T.kiDrain * dt);
      if (this.ki <= 0 && this.formIdx > 0) { game.revertForm('¡SIN KI! PIERDES LA TRANSFORMACIÓN'); return; }
    }
    if (T.hpDrain && this.hp > this.maxHp * 0.15) this.hp = Math.max(this.maxHp * 0.15, this.hp - this.maxHp * T.hpDrain * dt);
    if (T.aura) {
      this.auraT -= dt;
      if (this.auraT <= 0) {
        this.auraT = 0.5; DMG_SRC = 'aura';
        game.horde.damageRadius(this.x, this.z, 4.5, T.aura * 0.5 * this.damageMul(), 3, game);
        DMG_SRC = 'otros';
        game.fx.ring(game.fx.aura, this.x, 0.3, this.z, 16, 9, 0.3, 0.3, this.form.aura || 0xffffff);
      }
    }
    if (T.bolt) {
      this.boltT -= dt;
      if (this.boltT <= 0) {
        this.boltT = 1.4;
        const h = game.horde, col = this.form.ki;
        let hits = 0;
        for (let k = 0; k < 24 && hits < 3 && h.n; k++) {
          const j = (Math.random() * h.n) | 0, ex = h.x[j] - this.x, ez = h.z[j] - this.z;
          if (h.hp[j] <= 0 || ex * ex + ez * ez > 196) continue;
          hits++; DMG_SRC = 'bolt';
          h.hurt(j, T.bolt * this.damageMul(), 0, 0, game);
          for (let s = 0; s <= 6; s++) game.fx.sparks.emit(this.x + ex * s / 6 + rand(-0.4, 0.4), 1.4 + rand(-0.3, 0.6), this.z + ez * s / 6 + rand(-0.4, 0.4), 0, 0, 0, 0.18, 0.45, 0, col);
        }
        DMG_SRC = 'otros';
        if (hits) SFX.play('zap');
      }
    }
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
    // Tinte de estado: morado = controles invertidos (Ginyu), rosa = ralentizado (caramelo de Buu, hielo de Omega)
    const stTint = this.confT > 0 ? 0xc89aff : this.slowT > 0 ? 0xffb8e0 : this.form.tint;
    this.spr[sheet].push(this.x, y, this.z, frame, this.flip, flash, scale, alpha, stTint);
    for (const g of this.ghosts) if (g.t > 0) this.gho[g.sheet].push(g.x, 0.5, g.z, g.frame, g.flip, 0, 1, g.t / 0.3, this.form.tint);
    for (const k in this.spr) { this.spr[k].end(); this.gho[k].end(); }
    // Aura de fuego (sprites): forma transformada, carga de ki o Kaio-ken. En las formas altas, rayos sueltos alrededor
    const V = this.vfx, useFx = !!(V && V.ok);
    if (useFx && !this.dying) {
      const ka = this.buffT > 0, au = this.form.aura || 0;
      if (au || this.charging || ka) {
        const big = this.charging ? 1.3 : 1;
        V.aura('auraSS1', this.x, this.z, 5.4 * big * (1 + Math.sin(this.animT * 14) * 0.04), ka ? 0xff3a2a : (au || this.form.ki), this.charging ? 0.85 : 0.5, this.animT);
      }
      if ((this.formIdx >= 2 || (this.charging && this.formIdx >= 1)) && ((this.animT * 7) | 0) % 3 === 0) {
        const k = ((this.animT * 21) | 0) % 10, o = (((this.animT * 13) | 0) % 4) - 1.5;
        V.now(0, fxf('lightA', k), this.x + o * 0.5, 1.6 + (k % 3) * 0.4, this.z, 2.2, 0.95, 0xffffff);
      }
    }
    this.shield.begin();
    if (this.charging && !useFx) this.shield.push(this.x, 1.5, this.z, 0, 0, 0, 5 * (1 + Math.sin(this.animT * 12) * 0.05), 1);
    if (this.blocking && useFx) V.now(0, fxf('shield', this.perfectT > 0 ? 4 : 1), this.x, 1.6, this.z, 4.3 * (1 + Math.sin(this.animT * 20) * 0.04), this.perfectT > 0 ? 1 : 0.55, 0xffffff);
    else if (this.blocking) this.shield.push(this.x, 1.5, this.z, 0, 0, 0, 3.6 * (1 + Math.sin(this.animT * 20) * 0.04), this.perfectT > 0 ? 1.6 : 1, this.perfectT > 0 ? 0xffffff : 0x9be7ff);
    else if (this.guardT > 0 && ((this.animT * 10) | 0) % 2) this.shield.push(this.x, 1.5, this.z, 0, 0, 0, 3, 0.6, 0xff4060);
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
    this.stun = f(); this.aux = f(); this.shield = new Uint8Array(max);       // aturdimiento, temporizador propio y escudo
    this.pose = f(); this.poseC = new Uint8Array(max); this.grow = f();       // pose de técnica (tiempo y columna) y crecimiento (Célula)
    this.abCd = 0;                                                              // pausa global entre técnicas de la horda (que no se amontonen)
    this.half = CFG.ARENA + 8;
    this.cols = Math.ceil((this.half * 2) / CFG.CELL);
    this.heads = new Int32Array(this.cols * this.cols).fill(-1);
    this.next = new Int32Array(max);
    this.tints = ENEMY_TYPES.map((t) => t.tint);
    this.rows = ENEMY_TYPES.map((t) => t.row);                                  // fila de la hoja de enemigos de cada tipo
    const H = 2.9;
    this.scene = scene; this.H = H;
    this.sb = new SpriteBatch(scene, { max, texture: sheet.tex, cols: sheet.cols, rows: sheet.rows, w: H * (sheet.w / sheet.h), h: H, anchor: 0.04, renderOrder: 0 });
    this.bsb = {}; this.bossSb = null; this.bossRow = -1; this.bossAnim = null; this.bossTint = true;   // jefe con hoja propia: lote aparte
    this.bossPose = 0; this.bossPoseC = 0;                                      // pose del jefe al lanzar una técnica
  }
  /** Activa la hoja propia del jefe (o la quita con null). `row` = fila del jefe (o de su forma actual); `anim` = columnas */
  setBossSheet(sheet, row, anim, name) {
    if (!sheet) { this.bossRow = -1; this.bossSb = null; return; }
    const k = name || 'boss';
    if (!this.bsb[k]) this.bsb[k] = new SpriteBatch(this.scene, { max: 2, texture: sheet.tex, cols: sheet.cols, rows: sheet.rows, w: this.H * (sheet.w / sheet.h), h: this.H, anchor: 0.04, renderOrder: 0 });
    for (const n in this.bsb) if (n !== k) this.bsb[n].reset();
    this.bossSb = this.bsb[k]; this.bossCols = sheet.cols; this.bossRow = row | 0; this.bossAnim = anim || BOSS_ANIM.bosses; this.bossPose = 0;
  }
  /** El jefe muestra la pose de ataque ('atk') o de técnica ('cast') durante t segundos */
  posBoss(kind, t) { if (this.bossAnim) { this.bossPoseC = this.bossAnim[kind]; this.bossPose = t; } }

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
    this.stun[i] = 0; this.aux[i] = rand(1.5, 4); this.shield[i] = ENEMY_TYPES[type].shield || 0;
    this.pose[i] = 0; this.grow[i] = 0;
    return i;
  }
  remove(i) {
    const l = --this.n;
    this.x[i] = this.x[l]; this.z[i] = this.z[l]; this.hp[i] = this.hp[l]; this.maxHp[i] = this.maxHp[l]; this.hitT[i] = this.hitT[l];
    this.kx[i] = this.kx[l]; this.kz[i] = this.kz[l]; this.phase[i] = this.phase[l]; this.flip[i] = this.flip[l];
    this.type[i] = this.type[l]; this.uid[i] = this.uid[l];
    this.stun[i] = this.stun[l]; this.aux[i] = this.aux[l]; this.shield[i] = this.shield[l];
    this.pose[i] = this.pose[l]; this.poseC[i] = this.poseC[l]; this.grow[i] = this.grow[l];
  }
  indexOfUid(u) { for (let i = 0; i < this.n; i++) if (this.uid[i] === u) return i; return -1; }

  update(dt, player, game) {
    const n = this.n, x = this.x, z = this.z, kx = this.kx, kz = this.kz, heads = this.heads, next = this.next, cols = this.cols, world = game.world;
    const px = player.x, pz = player.z, lim = CFG.ARENA + 2, kd = Math.exp(-7 * dt), dmg = game.enemyDamage(), cc = game.camCos, cs = game.camSin;
    const shots = game.shots, t = game.time;
    this.abCd -= dt; if (this.bossPose > 0) this.bossPose -= dt;
    for (let i = 0; i < n; i++) {
      const T = ENEMY_TYPES[this.type[i]], xi = x[i], zi = z[i], sepR = T.r * 1.8, sepR2 = sepR * sepR;
      let dx = px - xi, dz = pz - zi;
      const d = Math.sqrt(dx * dx + dz * dz) + 1e-4;
      dx /= d; dz /= d;
      if (this.hitT[i] > 0) this.hitT[i] -= dt;
      if (this.pose[i] > 0) this.pose[i] -= dt;
      // Aturdido (Taiyoken): solo le afecta el empujón
      if (this.stun[i] > 0) {
        this.stun[i] -= dt;
        world.push(clamp(xi + kx[i] * dt, -lim, lim), clamp(zi + kz[i] * dt, -lim, lim), T.r * 0.8);
        x[i] = world.px; z[i] = world.pz; kx[i] *= kd; kz[i] *= kd;
        continue;
      }
      const sp = this.speed * T.spd;
      let vx = dx * sp, vz = dz * sp, sx = 0, sz = 0;
      if (T.fly) {                                              // volador: mantiene la distancia, rodea y dispara
        const side = (this.uid[i] & 1) ? 1 : -1;
        if (d < 8) { vx = -vx; vz = -vz; } else if (d < 12) { vx = -dz * sp * side; vz = dx * sp * side; }
        this.aux[i] -= dt;
        if (this.aux[i] <= 0 && d < 24) { this.aux[i] = rand(2.6, 4); shots.fire(xi, zi, dx, dz, 12, dmg * 0.8, { tint: 0xff4a4a, size: 1.9 }); this.pose[i] = 0.35; this.poseC[i] = 5; }
      } else if (T.boom && d < CFG.PLAYER_R + T.r + 0.5 && this.hp[i] > 0) {   // kamikaze: explota al llegar
        this.aux[i] = -99; this.hp[i] = 0; continue;
      } else if (T.boom && d < 7) { this.pose[i] = 0.1; this.poseC[i] = 6; if (((t * 10) | 0) % 2) this.hitT[i] = 0.06; }   // brazos arriba y parpadeo antes de explotar
      else if (T.ab) {
        this.aux[i] -= dt;
        if (T.ab === 'regen') {                                   // Metal Cooler: la Big Gete Star repara su blindaje
          if (this.shield[i] > 0) this.aux[i] = 7;
          else if (this.aux[i] <= 0) { this.shield[i] = T.shield; this.aux[i] = 7; this.pose[i] = 0.6; this.poseC[i] = 6; game.fx.burst(game.fx.sparks, xi, 1.6, zi, 10, 4, 0.4, 0.35, 0, 0x9ad8ff); }
        } else if (this.aux[i] <= 0 && this.abCd <= 0 && d < (T.ab === 'bomber' ? 13 : 17) && d > 4) {
          this.abCd = 1.1; this.pose[i] = 1; this.poseC[i] = 6;
          if (T.ab === 'bomber') {                                // Nappa: «Bomber DX», el suelo explota bajo tus pies
            this.aux[i] = rand(6, 8.5);
            shots.mark(px, pz, 2.8, 1.15, dmg * 1.5, { tint: 0xffb040 });
          } else if (T.ab === 'bodychange') {                     // Ginyu: rayo del «Cambio de cuerpo»
            this.aux[i] = rand(7, 9);
            shots.line(xi, zi, dx, dz, 24, 1, 0.85, dmg * 0.6, 0xc070ff, 'conf');
          }
          continue;                                               // se planta para lanzar la técnica
        }
        if (this.pose[i] > 0.1 && this.poseC[i] === 6) continue;      // quieto mientras lanza la técnica
      }
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
      if (T.fly) { x[i] = clamp(xi + vx * dt, -lim, lim); z[i] = clamp(zi + vz * dt, -lim, lim); }    // vuela por encima de todo
      else { world.push(clamp(xi + vx * dt, -lim, lim), clamp(zi + vz * dt, -lim, lim), T.r * 0.8); x[i] = world.px; z[i] = world.pz; }   // esquiva rocas, árboles y mesetas
      this.flip[i] = dx * cc - dz * cs < 0 ? 1 : 0;
      this.phase[i] += dt * 8 * (0.6 + T.spd * 0.4);
      const R = T.r * (1 + this.grow[i]);
      if (!T.fly && d < CFG.PLAYER_R + R + 0.15 && this.hp[i] > 0 && player.takeDamage(dmg * T.dmg, game)) {
        if (T.knock) { player.kbx = dx * T.knock; player.kbz = dz * T.knock; game.shake(0.6); }
        if (T.absorb) {                                           // Célula imperfecto: absorbe, se cura y crece
          this.hp[i] = Math.min(this.maxHp[i] * 1.6, this.hp[i] + this.maxHp[i] * 0.3); this.grow[i] = Math.min(0.6, this.grow[i] + 0.15);
          this.pose[i] = 0.5; this.poseC[i] = 5;
          game.fx.burst(game.fx.aura, xi, 1.4, zi, 12, 4, 0.5, 0.45, 1, 0x7dff5a);
        }
      }
    }
  }

  /** Aplica daño a un enemigo (la retirada se hace después, en reap) */
  hurt(i, dmg, kx, kz, game, area) {
    if (this.hp[i] <= 0) return;
    if (this.shield[i] > 0) {                                     // Blindado: el escudo absorbe el golpe (las explosiones lo rompen)
      if (area) this.shield[i] = 0; else { this.shield[i]--; dmg *= 0.1; game.fx.burst(game.fx.sparks, this.x[i], 1.3, this.z[i], 4, 5, 0.25, 0.3, 0, 0x8ab0ff); }
    }
    if (this.type[i] === T_BOSS && game.bossInv > 0) dmg *= 0.1;  // el jefe cambiando de fase apenas recibe daño
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
          if (d2 < rr * rr) { const d = Math.sqrt(d2) || 1; this.hurt(j, dmg, (dx / d) * knock, (dz / d) * knock, game, true); }
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
  /** Aturde a los enemigos en un radio (los jefes, mucho menos) */
  stunRadius(px, pz, r, t) {
    const r2 = r * r;
    for (let i = 0; i < this.n; i++) {
      const dx = this.x[i] - px, dz = this.z[i] - pz;
      if (dx * dx + dz * dz < r2) this.stun[i] = Math.max(this.stun[i], this.type[i] === T_BOSS ? t * 0.25 : t);
    }
  }
  reap(game) {
    for (let i = this.n - 1; i >= 0; i--) {
      if (this.hp[i] > 0) continue;
      const x = this.x[i], z = this.z[i], ty = this.type[i], self = ty === T_BOOM && this.aux[i] === -99, uid = this.uid[i];
      this.remove(i);
      if (self) game.onKamikaze(x, z);                           // explotó contra ti: sin recompensa
      else { game.onEnemyKilled(x, z, ty, uid); if (ty === T_BOOM) game.kamikazeChain(x, z); }
    }
  }

  sync(shadows) {
    const sb = this.sb, bsb = this.bossSb, walk = BOSS_ANIM.bosses.walk, bossOwn = bsb && this.bossRow >= 0, rows = this.rows;
    sb.begin();
    if (bossOwn) bsb.begin();
    for (let i = 0; i < this.n; i++) {
      const ty = this.type[i], T = ENEMY_TYPES[ty], ph = this.phase[i], hit = this.hitT[i] > 0 ? this.hitT[i] : 0, st = this.stun[i] > 0;
      const sc = T.scale * (1 + this.grow[i]);
      let y = st ? 0 : Math.abs(Math.sin(ph * 1.1)) * 0.14 * sc, tint = this.tints[ty];
      if (T.fly) y = 2.2 + Math.sin(ph * 0.5) * 0.3;
      if (T.shield && this.shield[i] <= 0) tint = 0x8a96b0;               // blindaje roto: metal apagado
      if (st) tint = 0x9a9aff;
      if (ty === T_BOSS && bossOwn) {                                  // el jefe usa su hoja: caminar, golpe, técnica o aturdido
        const A = this.bossAnim, base = this.bossRow * this.bossCols;
        const col = hit > 0.05 ? A.hit : st ? A.stun : this.bossPose > 0 ? this.bossPoseC : A.walk[(ph | 0) % A.walk.length];
        bsb.push(this.x[i], y, this.z[i], base + col, this.flip[i], hit * 8, sc * (1 + hit * 1.2), 1, this.bossTint ? tint : 0xffffff);
      } else {
        const col = hit > 0.05 || st ? 4 : this.pose[i] > 0 ? this.poseC[i] : walk[(ph | 0) % 4];
        sb.push(this.x[i], y, this.z[i], rows[ty] * 8 + col, this.flip[i], hit * 8, sc * (1 + hit * 1.2), 1, tint);
      }
      shadows.push(this.x[i], 0.06, this.z[i], 0, 0, 0, (T.fly ? 1.2 : 1.9) * sc, T.fly ? 0.6 : 1);
    }
    sb.end();
    if (bossOwn) bsb.end();
  }
  reset() { this.n = 0; this.heads.fill(-1); this.sb.reset(); for (const k in this.bsb) this.bsb[k].reset(); this.bossRow = -1; this.bossSb = null; this.bossPose = 0; this.abCd = 0; }
}

/* ---------- PROYECTILES DE KI (pool; perforación y explosión opcionales) ---------- */
class KiPool {
  constructor(scene, max, tex) {
    this.max = max; this.b = [];
    for (let i = 0; i < max; i++) this.b.push({ active: false, x: 0, y: 1.4, z: 0, vx: 0, vz: 0, life: 0, dmg: 0, r: 0.5, trail: 0, crit: false, pierce: 0, aoe: 0, tint: 0xffffff, ign: [0, 0, 0, 0, 0, 0], ni: 0, size: 1, src: '' });
    this.sb = new SpriteBatch(scene, { max, texture: tex.ki, w: 1, h: 1, anchor: 0.5, additive: true, cut: 0.05, renderOrder: 5 });
  }
  /** Con el atlas de efectos, cada ráfaga es una esfera de su color (y los Kienzan, discos que giran) */
  useFx(sh) { const u = this.sb.mat.uniforms; u.uMap.value = sh.tex; u.uGrid.value.set(sh.cols, sh.rows); this.fx = true; }
  fire(x, z, dx, dz, speed, dmg, r, crit, life, pierce, aoe, tint, size, look) {
    for (let i = 0; i < this.max; i++) {
      const b = this.b[i];
      if (b.active) continue;
      b.active = true; b.x = x; b.z = z; b.y = 1.4; b.vx = dx * speed; b.vz = dz * speed; b.life = life; b.dmg = dmg; b.r = r;
      b.crit = crit; b.pierce = pierce; b.aoe = aoe; b.tint = tint; b.trail = 0; b.ni = 0; b.size = size || (crit ? 3.6 : 2.6) * r * 1.3; b.look = look || 0;
      b.fr = this.fx ? (b.look === 1 ? -1 : orbFrame(tint, crit || b.size > 3.5 ? 0 : 1)) : 0;
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
      if (!this.fx) sb.push(b.x, b.y, b.z, 0, 0, 0, b.size, 1, b.tint);
      else if (b.fr < 0) sb.push(b.x, b.y, b.z, fxf('disc', 3 + (((b.life * 18) | 0) & 1)), 0, 0, b.size * 1.15, 1, 0xffffff, b.life * 9);
      else sb.push(b.x, b.y, b.z, b.fr, 0, 0, b.size * 0.75, 1, 0xffffff);
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
  }  /** Esferas del dragón y semillas senzu con los sprites del atlas de objetos */
  useFx(sh) {
    for (const b of [this.senzu, this.balls]) { const u = b.mat.uniforms; u.uMap.value = sh.tex; u.uGrid.value.set(sh.cols, sh.rows); }
    this.fx = true;
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
    for (let i = 0; i < this.sn; i++) this.senzu.push(this.sx[i], 0.55 + Math.sin(this.t * 3 + i) * 0.12, this.sz[i], this.fx ? fxf('senzu', 1) : 0, 0, 0, this.fx ? 1.15 : 0.9, 1);
    this.senzu.end();
    this.balls.begin();
    for (let i = 0; i < 7; i++) if (!this.got[i]) this.balls.push(this.bx[i], 1.1 + Math.sin(this.t * 2 + i) * 0.2, this.bz[i], this.fx ? fxf('dball', i) : i, 0, 0, 1, 1);
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
    this.max = 220; this.s = [];
    for (let i = 0; i < this.max; i++) this.s.push({ on: false, x: 0, z: 0, vx: 0, vz: 0, life: 0, dmg: 0, tint: 0, size: 1.5, r2: 1.1, home: 0, spd: 0, eff: '', ghost: false });
    this.sb = new SpriteBatch(scene, { max: this.max, texture: tex.ki, w: 1, h: 1, anchor: 0.5, additive: true, cut: 0.02, renderOrder: 5 });
    // Zonas marcadas en el suelo (explotan tras el aviso) y rayos con aviso de los jefes
    this.marks = []; for (let i = 0; i < 40; i++) this.marks.push({ on: false, x: 0, z: 0, r: 3, t: 0, T: 1, dmg: 0, tint: 0, ring: 0, bolt: false, eff: '', big: false });
    this.lines = []; for (let i = 0; i < 10; i++) this.lines.push({ on: false, x: 0, z: 0, dx: 1, dz: 0, len: 30, hw: 1.4, t: 0, fire: 0, dmg: 0, hit: false, eff: '' });
    this.mb = new SpriteBatch(scene, { max: 80, texture: tex.ring, w: 2, h: 2, anchor: 0.5, flat: true, additive: true, cut: 0.02, renderOrder: 4 });
    this.lb = new SpriteBatch(scene, { max: 1200, texture: tex.ki, w: 1, h: 1, anchor: 0.5, additive: true, cut: 0.02, renderOrder: 5 });
  }
  /** Zona marcada que explota tras `delay`. Opciones: tint, ring (n disparos al estallar), bolt (rayo que cae del cielo),
      eff ('slow' = te ralentiza, 'conf' = controles invertidos), big (explosión enorme) */
  mark(x, z, r, delay, dmg, o) {
    for (const m of this.marks) if (!m.on) {
      m.on = true; m.x = x; m.z = z; m.r = r; m.t = m.T = delay; m.dmg = dmg;
      m.tint = (o && o.tint) || 0xff3050; m.ring = (o && o.ring) || 0; m.bolt = !!(o && o.bolt); m.eff = (o && o.eff) || ''; m.big = !!(o && o.big);
      return m;
    }
    return null;
  }
  /** Rayo con aviso. Devuelve el rayo (para engancharle `onFire`, un aviso al dispararse) o null si no hay hueco */
  line(x, z, dx, dz, len, hw, warn, dmg, tint, eff) {
    for (const l of this.lines) if (!l.on) { l.on = true; l.x = x; l.z = z; l.dx = dx; l.dz = dz; l.len = len; l.hw = hw; l.t = warn; l.fire = 0.45; l.dmg = dmg; l.hit = false; l.tint = tint || 0xff4070; l.onFire = null; l.eff = eff || ''; return l; }
    return null;
  }
  /** Disparo. Opciones: tint, size (tamaño visual), r (radio de impacto), home (giro hacia ti, rad/s),
      life, eff ('slow' | 'conf'), ghost (solo se ve: la bola grande que anuncia una zona marcada) */
  fire(x, z, dx, dz, speed, dmg, o) {
    for (const s of this.s) if (!s.on) {
      s.on = true; s.x = x; s.z = z; s.vx = dx * speed; s.vz = dz * speed; s.spd = speed; s.dmg = dmg;
      s.life = (o && o.life) || 5; s.tint = (o && o.tint) || 0xff5070; s.size = (o && o.size) || 1.5;
      const r = (o && o.r) || 1.05; s.r2 = r * r; s.home = (o && o.home) || 0; s.eff = (o && o.eff) || ''; s.ghost = !!(o && o.ghost);
      return s;
    }
    return null;
  }
  useFx(sh) { const u = this.sb.mat.uniforms; u.uMap.value = sh.tex; u.uGrid.value.set(sh.cols, sh.rows); this.fx = true; }
  /** Anillo de n disparos (con un ángulo inicial) */
  ring(x, z, n, speed, dmg, off, o) { for (let i = 0; i < n; i++) { const a = off + (i / n) * 6.2832; this.fire(x, z, Math.cos(a), Math.sin(a), speed, dmg, o); } }
  /** Bola gigante (Supernova, Cañón Eraser...): viaja visible hasta el punto y allí estalla como zona marcada */
  ball(x, z, tx, tz, t, r, dmg, o) {
    const dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz) || 1;
    this.fire(x, z, dx / d, dz / d, d / t, 0, { ghost: true, life: t, size: ((o && o.size) || r * 1.6) * 0.8, tint: o && o.tint });
    return this.mark(tx, tz, r, t, dmg, Object.assign({ big: true }, o));
  }
  /** Efectos al recibir el golpe: ralentizado (caramelo, hielo) o controles invertidos (cambio de cuerpo) */
  effect(eff, p, game) {
    if (eff === 'slow') { p.slowT = 2.6; game.ui.toast('¡RALENTIZADO!', true); }
    else if (eff === 'conf') { p.confT = 2.6; game.ui.toast('¡CAMBIO DE CUERPO! · CONTROLES INVERTIDOS', true); }
  }
  update(dt, game) {
    const p = game.player;
    this.sb.begin();
    for (const s of this.s) {
      if (!s.on) continue;
      s.life -= dt;
      if (s.home > 0 && !s.ghost) {                                // giro hacia el jugador (discos teledirigidos)
        const a = Math.atan2(s.vz, s.vx), want = Math.atan2(p.z - s.z, p.x - s.x);
        let d = want - a; d = Math.atan2(Math.sin(d), Math.cos(d));
        const na = a + clamp(d, -s.home * dt, s.home * dt);
        s.vx = Math.cos(na) * s.spd; s.vz = Math.sin(na) * s.spd;
      }
      s.x += s.vx * dt; s.z += s.vz * dt;
      if (s.life <= 0) { s.on = false; continue; }
      if (!s.ghost) {
        const dx = p.x - s.x, dz = p.z - s.z;
        if (dx * dx + dz * dz < s.r2) {
          if (p.takeDamage(s.dmg, game) && s.eff) this.effect(s.eff, p, game);
          s.on = false; game.fx.burst(game.fx.sparks, s.x, 1.2, s.z, 5, 5, 0.3, 0.3, 6, s.tint); continue;
        }
      }
      const sy = s.ghost ? 1.5 + s.size * 0.35 : 1.3;                // las bolas gigantes van por encima de la cabeza del jefe
      if (this.fx) {                                                // esfera de energía de su color; las grandes, con destellos
        this.sb.push(s.x, sy, s.z, orbFrame(s.tint, s.size > 3 ? 0 : 1), 0, 0, s.size * 0.8, 1, 0xffffff);
        if (s.size > 3) this.sb.push(s.x, sy, s.z, fxf('kameStar', ((game.time * 16) | 0) % 4), 0, 0, s.size * 0.9, 0.8, 0xffffff);
      } else {
        this.sb.push(s.x, sy, s.z, 0, 0, 0, s.size, 1, s.tint);
        if (s.size > 3) this.sb.push(s.x, sy, s.z, 0, 0, 0, s.size * 0.45, 0.8, 0xffffff);   // núcleo blanco de las bolas grandes
      }
    }
    this.sb.end();
    // Zonas marcadas: el círculo se cierra y explota
    this.mb.begin();
    for (const m of this.marks) {
      if (!m.on) continue;
      m.t -= dt;
      if (m.t <= 0) {
        m.on = false;
        const dx = p.x - m.x, dz = p.z - m.z;
        if (dx * dx + dz * dz < m.r * m.r && p.takeDamage(m.dmg, game) && m.eff) this.effect(m.eff, p, game);
        const fx = game.fx, V = game.vfx;
        if (V && V.ok) {                                             // explosión animada (y rayo del cielo); las enormes, con impact frame
          if (m.bolt) V.bolt(m.x, m.z, 16, m.tint);
          if (m.big) { V.boom(m.x, m.z, m.r, m.tint, true); game.impact(0.12, 1.4); } else V.boom(m.x, m.z, m.r * 0.8, m.tint, false);
        }
        if (m.bolt) for (let y = 0; y < 14; y += 1.4) fx.burst(fx.sparks, m.x, y, m.z, 2, 2, 0.3, 0.45, 0, m.tint);   // rayo del cielo
        fx.burst(fx.sparks, m.x, 0.8, m.z, m.big ? 40 : 18, m.r * 2.5, 0.45, m.big ? 0.6 : 0.4, 6, m.tint);
        fx.ring(fx.aura, m.x, 0.3, m.z, m.big ? 40 : 22, m.r * 3, 0.35, m.big ? 0.6 : 0.35, m.tint);
        if (m.big) { fx.burst(fx.aura, m.x, 1.5, m.z, 30, m.r * 1.5, 0.7, 0.8, 1, 0xffffff); game.shake(0.9); SFX.play('bigboom'); }
        else SFX.play('boom');
        if (m.ring) this.ring(m.x, m.z, m.ring, 9, m.dmg * 0.35, Math.random() * 6.28, { tint: m.tint });
        continue;
      }
      const k = 1 - m.t / m.T;
      this.mb.push(m.x, 0.12, m.z, 0, 0, 0, m.r, 0.5 + k * 0.5, m.tint);
      this.mb.push(m.x, 0.13, m.z, 0, 0, 0, m.r * k, 0.9, 0xffb040);
    }
    this.mb.end();
    // Rayos: línea fina de aviso y luego el disparo
    this.lb.begin();
    for (const l of this.lines) {
      if (!l.on) continue;
      if (l.t > 0) l.t -= dt; else l.fire -= dt;
      if (l.fire <= 0) { l.on = false; continue; }
      const firing = l.t <= 0;
      if (firing && !l.hit) {
        l.hit = true; game.shake(0.5); SFX.play('bigbeam');
        if (l.onFire) l.onFire(l);
        if (game.vfx && game.vfx.ok) { game.vfx.flash(l.x, 1.4, l.z, l.hw * 4, l.tint); game.vfx.flash(l.x + l.dx * l.len, 1.4, l.z + l.dz * l.len, l.hw * 3, l.tint); }
        const ex = p.x - l.x, ez = p.z - l.z, tt = ex * l.dx + ez * l.dz;
        if (tt > -1 && tt < l.len && Math.abs(ex * l.dz - ez * l.dx) < l.hw + CFG.PLAYER_R && p.takeDamage(l.dmg, game) && l.eff) this.effect(l.eff, p, game);
      }
      for (let s = 0.8; s < l.len; s += firing ? Math.max(0.9, l.hw * 0.5) : 1.6) {
        const bx = l.x + l.dx * s, bz = l.z + l.dz * s;
        if (firing) { this.lb.push(bx, 1.4, bz, 0, 0, 0, l.hw * 2.4, 0.35, l.tint); this.lb.push(bx, 1.4, bz, 0, 0, 0, l.hw, 0.6, 0xffffff); }
        else this.lb.push(bx, 0.3, bz, 0, 0, 0, 0.5, 0.5 + 0.5 * Math.sin(game.time * 30), l.tint);
      }
    }
    this.lb.end();
  }
  reset() { for (const s of this.s) s.on = false; for (const m of this.marks) m.on = false; for (const l of this.lines) l.on = false; this.sb.reset(); this.mb.reset(); this.lb.reset(); }
}

