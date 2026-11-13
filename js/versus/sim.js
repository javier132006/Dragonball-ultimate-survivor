'use strict';
/* =====================================================================
   versus/sim.js · Simulación del combate (sin gráficos ni sonido).
   - Paso FIJO de 1/60 s y azar con semilla: con las mismas órdenes da
     siempre el mismo combate (imprescindible para el online).
   - Entra una orden por luchador (input.js) y salen EVENTOS (`ev`) que la
     vista convierte en efectos, sonido y cámara. La lógica nunca dibuja.
   Coordenadas: suelo y = 0, arena circular de radio R centrada en 0,0.
   ===================================================================== */
const VS_DT = 1 / 60;
const VS = {
  R: 27, TOP: 17,                         // límites de la arena
  SPD: 10.5, FLY: 8.5, DASH: 36, DASH_T: 0.2,
  REACH: 2.9,                             // distancia a la que conecta un golpe
  LIGHT: [{ dmg: 22, stun: 0.34, kb: 4 }, { dmg: 24, stun: 0.34, kb: 4 }, { dmg: 34, stun: 0.42, kb: 9 }],
  HEAVY: { dmg: 72, stun: 0.9, kb: 34, up: 7, launch: true, gbreak: 45, heavy: true },
  SHOT: { dmg: 26, stun: 0.24, kb: 5, gbreak: 8, cost: 6, spd: 42 },
  KI_REGEN: 2.5, KI_CHARGE: 32, COST_DASH: 5, COST_TP: 20, COST_ESC: 30,
  PARRY: 0.13,                            // ventana de la guardia perfecta (contraataque)
  ULT_CINE: 1.25                          // segundos de presentación de la Ultimate (el mundo se para)
};

class VsFighter {
  constructor(i, def) {
    this.i = i; this.def = def; this.hpMax = def.hp; this.pow = def.pow; this.spd = def.spd; this.wins = 0;
    this.reset(i ? 7 : -7);
  }
  reset(x) {
    this.x = x; this.y = 0; this.z = 0; this.vx = this.vy = this.vz = 0;
    this.hp = this.hpMax; this.ki = 25; this.gm = 100; this.inv = 0; this.pb = 0; this.stun = 0;
    this.c = 0; this.buf = ''; this.cmb = 0; this.cmbT = 0; this.cmbDmg = 0; this.shots = 0; this.dx = 1; this.dz = 0; this.flash = 0;
    this.set('idle');
  }
  set(st) { this.st = st; this.t = 0; this.done = false; }
  get busy() { return this.st !== 'idle' && this.st !== 'move'; }
}

class VsSim {
  constructor(defA, defB, opt) {
    opt = opt || {};
    this.f = [new VsFighter(0, defA), new VsFighter(1, defB)];
    this.seed = (opt.seed || 12345) >>> 0; this.rounds = opt.rounds || 2; this.roundTime = opt.time || 99;
    this.ev = []; this.shots = []; this.tick = 0; this.round = 0; this.winner = -1;
    this.cx = 0; this.cz = -1;            // lado en el que está la cámara (normal horizontal, unitaria)
    this.newRound();
  }
  /** Azar con semilla (mulberry32) */
  rand() { let t = (this.seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  emit(t, o) { o = o || {}; o.t = t; this.ev.push(o); }
  newRound() {
    this.round++; this.f[0].reset(-7); this.f[1].reset(7); this.shots.length = 0; this.ult = null; this.freeze = 0;
    this.time = this.roundTime; this.phase = 'intro'; this.pt = 0; this.cx = 0; this.cz = -1;
    this.emit('round', { n: this.round });
  }
  /** Coordenada X en pantalla de un vector horizontal (la cámara mira desde c hacia -c) */
  screenX(dx, dz) { return dx * -this.cz + dz * this.cx; }

  step(c0, c1) {
    if (this.freeze > 0) { this.freeze--; return; }                    // hitstop: unos pasos congelados al impactar
    this.tick++;
    const a = this.f[0], b = this.f[1], cmd = [c0, c1];
    // La cámara se queda en el lado en el que ya estaba (los luchadores pueden cruzarse sin que gire 180°)
    const dx = b.x - a.x, dz = b.z - a.z, h = Math.hypot(dx, dz);
    if (h > 0.8) { let nx = -dz / h, nz = dx / h; if (nx * this.cx + nz * this.cz < 0) { nx = -nx; nz = -nz; } this.cx = nx; this.cz = nz; }
    this.pt += VS_DT;
    if (this.phase === 'intro' && this.pt > 2.3) { this.phase = 'fight'; this.pt = 0; this.emit('fight'); }
    else if (this.phase === 'ko' && this.pt > 3.0) this.endRound();
    else if (this.phase === 'fight' && !this.ult) {
      this.time -= VS_DT;
      if (this.time <= 0) { this.time = 0; const w = a.hp / a.hpMax >= b.hp / b.hpMax ? 0 : 1; this.phase = 'ko'; this.pt = 0; this.ko = w; this.emit('timeup', { w }); }
    }
    if (this.ult && this.ult.ph === 0) { this.stepUlt(); return; }      // presentación de la Ultimate: el mundo está parado
    for (let i = 0; i < 2; i++) this.stepFighter(this.f[i], this.f[1 - i], cmd[i] || { mx: 0, mz: 0, b: 0 });
    if (this.ult) this.stepUlt();
    this.stepShots();
    // Los cuerpos no se atraviesan
    const ex = b.x - a.x, ez = b.z - a.z, eh = Math.hypot(ex, ez);
    if (eh < 1.5 && Math.abs(b.y - a.y) < 2.4 && a.st !== 'ko' && b.st !== 'ko' && !(this.ult && this.ult.lock)) {
      const p = (1.5 - eh) / 2, nx = eh > 0.01 ? ex / eh : 1, nz = eh > 0.01 ? ez / eh : 0;
      a.x -= nx * p; a.z -= nz * p; b.x += nx * p; b.z += nz * p;
    }
    for (const f of this.f) {                                          // límites de la arena
      const r = Math.hypot(f.x, f.z);
      if (r > VS.R) {
        f.x *= VS.R / r; f.z *= VS.R / r;
        if (f.st === 'launched' && Math.hypot(f.vx, f.vz) > 14) { this.emit('wall', { x: f.x, y: f.y + 1.5, z: f.z }); this.damage(this.f[1 - f.i], f, 28); f.vx *= -0.25; f.vz *= -0.25; f.vy = 4; this.freeze = 5; }
      }
      if (f.y < 0) f.y = 0; if (f.y > VS.TOP) { f.y = VS.TOP; if (f.vy > 0) f.vy = 0; }
    }
  }

  /* ---------------- Un luchador ---------------- */
  stepFighter(f, foe, cmd) {
    const dt = VS_DT, press = cmd.b & ~f.pb, held = cmd.b; f.pb = cmd.b;
    const ctl = this.phase === 'fight' && !(this.ult && (this.ult.who === f.i || this.ult.lock));
    f.t += dt; f.inv = Math.max(0, f.inv - dt); f.flash = Math.max(0, f.flash - dt);
    if (f.st !== 'ko' && this.phase === 'fight') f.ki = Math.min(100, f.ki + VS.KI_REGEN * dt);
    if (f.st !== 'guard') f.gm = Math.min(100, f.gm + 14 * dt);
    if (f.cmbT > 0 && (f.cmbT -= dt) <= 0) { f.cmb = 0; f.cmbDmg = 0; }
    // Dirección hacia el rival (horizontal y en 3D)
    const tx = foe.x - f.x, ty = foe.y - f.y, tz = foe.z - f.z, th = Math.hypot(tx, tz) || 0.001, td = Math.hypot(th, ty) || 0.001;
    const nx = tx / th, nz = tz / th;
    // Movimiento pedido, de pantalla a mundo: derecha de pantalla = (-cz, cx), fondo = (-cx, -cz)
    const wx = -this.cz * cmd.mx - this.cx * cmd.mz, wz = this.cx * cmd.mx - this.cz * cmd.mz, my = (held & VB.UP ? 1 : 0) - (held & VB.DOWN ? 1 : 0);
    const brake = (k) => { const m = Math.max(0, 1 - k * dt); f.vx *= m; f.vy *= m; f.vz *= m; };
    switch (f.st) {
      case 'idle': case 'move': {
        const k = Math.min(1, 14 * dt), sp = VS.SPD * f.spd;
        f.vx += ((ctl ? wx * sp : 0) - f.vx) * k; f.vz += ((ctl ? wz * sp : 0) - f.vz) * k; f.vy += ((ctl ? my * VS.FLY : 0) - f.vy) * k;
        if (ctl) {
          if ((press & VB.ULT) && f.ki >= 100 && foe.st !== 'ko') { this.startUlt(f, foe); break; }
          if ((press & VB.TP) && f.ki >= VS.COST_TP) { this.vanish(f, foe, VS.COST_TP); break; }
          if ((press & VB.DASH) && f.ki >= VS.COST_DASH) { this.dash(f, foe, wx, wz, my, nx, nz, ty / td); break; }
          if (press & VB.HEAVY) { f.set('heavy'); this.emit('swing', { i: f.i, heavy: 1 }); break; }
          if (press & VB.ATK) { f.c = 0; f.buf = ''; f.set('atk'); this.emit('swing', { i: f.i }); break; }
          if ((press & VB.KI) && f.ki >= VS.SHOT.cost) { f.shots = 0; f.set('shot'); break; }
          if (held & VB.GUARD) { f.set('guard'); break; }
          if (held & VB.CHARGE) { f.set('charge'); this.emit('charge', { i: f.i }); break; }
        }
        f.st = Math.hypot(f.vx, f.vz) + Math.abs(f.vy) > 1.5 ? 'move' : 'idle';
        break;
      }
      case 'guard': brake(12); if (!(held & VB.GUARD) && f.t > 0.12) f.set('idle'); if ((press & VB.TP) && f.ki >= VS.COST_TP && ctl) this.vanish(f, foe, VS.COST_TP); break;
      case 'charge': brake(12); f.ki = Math.min(100, f.ki + VS.KI_CHARGE * dt); if (!(held & VB.CHARGE) || !ctl) f.set('idle'); break;
      case 'dash':
        f.vx = f.dx * VS.DASH; f.vz = f.dz * VS.DASH; f.vy = f.dy * VS.DASH;
        if (f.t >= VS.DASH_T) { f.vx *= 0.3; f.vy *= 0.3; f.vz *= 0.3; f.set('idle'); }
        else if (press & VB.ATK) f.buf = 'atk'; else if (press & VB.HEAVY) f.buf = 'heavy';
        if (f.st === 'idle' && f.buf) { if (f.buf === 'atk') { f.c = 0; f.set('atk'); } else f.set('heavy'); f.buf = ''; this.emit('swing', { i: f.i }); }
        break;
      case 'atk': {
        const last = f.c >= 2, a0 = 0.07, a1 = 0.16, end = last ? 0.42 : 0.33;
        if (f.t < a1 && td < 8 && td > 1.7) { const s = 26; f.vx = nx * s * (th / td); f.vz = nz * s * (th / td); f.vy = (ty / td) * s; } else brake(18);   // se pega al rival
        if (f.t >= a0 && f.t < a1 && !f.done && td < VS.REACH) { f.done = true; this.hit(f, foe, VS.LIGHT[f.c], nx, nz); }
        if (f.t > 0.08) { if (press & VB.ATK) f.buf = 'atk'; else if (press & VB.HEAVY) f.buf = 'heavy'; }
        if (f.t >= end || (f.buf && f.t >= a1 + 0.06 && f.done)) {
          if (f.buf === 'atk' && !last) { f.c++; f.buf = ''; f.set('atk'); this.emit('swing', { i: f.i }); }
          else if (f.buf === 'heavy') { f.buf = ''; f.set('heavy'); this.emit('swing', { i: f.i, heavy: 1 }); }
          else if (f.t >= end) f.set('idle');
        }
        break;
      }
      case 'heavy':
        if (f.t < 0.2 && td < 7 && td > 1.7) { f.vx = nx * 20 * (th / td); f.vz = nz * 20 * (th / td); f.vy = (ty / td) * 20; } else brake(16);
        if (f.t >= 0.2 && f.t < 0.3 && !f.done && td < VS.REACH + 0.3) { f.done = true; this.hit(f, foe, VS.HEAVY, nx, nz); }
        if (f.t >= 0.62) f.set('idle');
        break;
      case 'shot':
        brake(10);
        if (f.t >= 0.1 && !f.done) {
          f.done = true; f.ki -= VS.SHOT.cost; f.shots++;
          const s = VS.SHOT.spd, oy = 1.7, ay = (foe.y + 1.5) - (f.y + oy), ad = Math.hypot(th, ay) || 1;
          this.shots.push({ o: f.i, x: f.x + nx * 1.2, y: f.y + oy, z: f.z + nz * 1.2, vx: tx / ad * s, vy: ay / ad * s, vz: tz / ad * s, life: 1.5, r: 1.5, t: 0, col: f.def.col });
          this.emit('shot', { i: f.i, x: f.x + nx * 1.2, y: f.y + oy, z: f.z + nz * 1.2 });
        }
        if (f.t >= 0.24) { if ((held & VB.KI) && f.shots < 5 && f.ki >= VS.SHOT.cost && ctl) f.set('shot'); else if (f.t >= 0.32) f.set('idle'); }
        break;
      case 'hurt':
        brake(7); f.stun -= dt;
        if ((press & VB.TP) && f.ki >= VS.COST_ESC && this.phase === 'fight' && !this.ult) { this.vanish(f, foe, VS.COST_ESC); break; }
        if (f.stun <= 0) f.set('idle');
        break;
      case 'launched':
        f.stun -= dt; { const m = Math.max(0, 1 - 1.4 * dt); f.vx *= m; f.vz *= m; } if (f.t > 0.22) f.vy -= 22 * dt;
        if ((press & VB.TP) && f.ki >= VS.COST_ESC && this.phase === 'fight' && !this.ult) { this.vanish(f, foe, VS.COST_ESC); break; }
        if (f.y <= 0 && f.vy < 0) { this.emit('land', { x: f.x, z: f.z, hard: f.vy < -16 }); if (f.vy < -16) this.freeze = 4; f.vx *= 0.2; f.vz *= 0.2; f.vy = 0; f.set('down'); }
        else if (f.stun <= 0 && f.y > 0.5) { f.vy *= 0.3; f.inv = 0.15; f.set('idle'); }
        break;
      case 'down': brake(10); if (f.t >= 0.65) { f.inv = 0.5; f.set('idle'); } break;
      case 'stun': brake(10); f.stun -= dt; if (f.stun <= 0) f.set('idle'); break;
      case 'ko': { const m = Math.max(0, 1 - 1.2 * dt); f.vx *= m; f.vz *= m; if (f.y > 0 || f.vy > 0) f.vy -= 22 * dt; else { if (f.vy < -4 && !f.done) { f.done = true; this.emit('land', { x: f.x, z: f.z, hard: true }); } f.vy = 0; f.vx *= 0.8; f.vz *= 0.8; } break; }
      case 'ult': case 'held': break;                                     // los mueve stepUlt()
    }
    f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
  }

  dash(f, foe, wx, wz, my, nx, nz, ny) {
    f.ki -= VS.COST_DASH;
    // Persecución: si el rival sale volando, el dash te planta a su lado para seguir el combo
    if (foe.st === 'launched' && Math.hypot(foe.x - f.x, foe.y - f.y, foe.z - f.z) > 5) {
      this.emit('vanish', { i: f.i, x: f.x, y: f.y, z: f.z });
      f.x = foe.x - nx * 2.2; f.y = Math.max(0, foe.y); f.z = foe.z - nz * 2.2; f.vx = foe.vx * 0.6; f.vy = 0; f.vz = foe.vz * 0.6;
      foe.vx *= 0.35; foe.vz *= 0.35; foe.vy = Math.max(foe.vy, 2); foe.stun = Math.max(foe.stun, 0.45);
      this.emit('pursue', { i: f.i, x: f.x, y: f.y, z: f.z }); f.inv = 0.1; f.set('idle'); return;
    }
    let dx = wx, dy = my, dz = wz; const m = Math.hypot(dx, dy, dz);
    if (m < 0.2) { dx = nx; dz = nz; dy = ny * 0.6; } else { dx /= m; dy /= m; dz /= m; }
    const n = Math.hypot(dx, dy, dz) || 1; f.dx = dx / n; f.dy = dy / n; f.dz = dz / n; f.inv = 0.12; f.buf = '';
    f.set('dash'); this.emit('dash', { i: f.i, x: f.x, y: f.y, z: f.z });
  }
  /** Teletransporte: aparece al otro lado del rival. En mitad de un combo que recibes cuesta más (es la escapatoria) */
  vanish(f, foe, cost) {
    f.ki -= cost; const dx = foe.x - f.x, dz = foe.z - f.z, h = Math.hypot(dx, dz) || 1;
    this.emit('vanish', { i: f.i, x: f.x, y: f.y, z: f.z });
    f.x = foe.x + dx / h * 2.4; f.z = foe.z + dz / h * 2.4; f.y = foe.y; f.vx = f.vy = f.vz = 0; f.inv = 0.22; f.stun = 0;
    const r = Math.hypot(f.x, f.z); if (r > VS.R - 0.5) { f.x = foe.x - dx / h * 2.4; f.z = foe.z - dz / h * 2.4; }
    f.set('idle'); this.emit('appear', { i: f.i, x: f.x, y: f.y, z: f.z });
  }

  /* ---------------- Daño ---------------- */
  damage(att, def, dmg) {
    def.hp = Math.max(0, def.hp - dmg); def.flash = 0.1;
    att.ki = Math.min(100, att.ki + dmg * 0.07); def.ki = Math.min(100, def.ki + dmg * 0.035);
    att.cmb++; att.cmbT = 1.3; att.cmbDmg += dmg; this.emit('dmg', { i: def.i, dmg, cmb: att.cmb, tot: att.cmbDmg });
    if (def.hp <= 0 && def.st !== 'ko') {
      def.set('ko'); this.phase = 'ko'; this.pt = 0; this.ko = att.i; this.freeze = 16; this.shots.length = 0;
      this.emit('ko', { w: att.i, x: def.x, y: def.y + 1.5, z: def.z }); return true;
    }
    return false;
  }
  /** Golpe cuerpo a cuerpo o proyectil. Devuelve: 0 nada · 1 conecta · 2 bloqueado · 3 contraataque (guardia perfecta) */
  hit(att, def, s, nx, nz) {
    if (def.inv > 0 || def.st === 'ko' || def.st === 'held') return 0;
    const px = def.x - nx * 0.6, py = def.y + 1.6, pz = def.z - nz * 0.6;
    if (def.st === 'guard') {
      if (def.t < VS.PARRY && !s.shot) {                                // guardia perfecta: el atacante queda vendido
        att.set('stun'); att.stun = 0.75; att.vx = -nx * 6; att.vz = -nz * 6; def.ki = Math.min(100, def.ki + 12); this.freeze = 8;
        this.emit('parry', { i: def.i, x: px, y: py, z: pz }); return 3;
      }
      def.gm -= s.gbreak || 12; def.vx = nx * (s.kb || 3) * 0.4; def.vz = nz * (s.kb || 3) * 0.4;
      this.damage(att, def, s.dmg * att.pow * 0.12); att.cmb = 0;
      if (def.gm <= 0) { def.gm = 60; def.set('stun'); def.stun = 1.15; this.freeze = 8; this.emit('break', { i: def.i, x: px, y: py, z: pz }); }
      else this.emit('guard', { i: def.i, x: px, y: py, z: pz });
      return 2;
    }
    const scale = Math.max(0.4, 1 - 0.07 * att.cmb);                    // los combos largos pegan cada vez menos
    this.emit('hit', { i: def.i, x: px, y: py, z: pz, heavy: !!s.heavy, col: att.def.col, nx, nz });
    this.freeze = Math.max(this.freeze, s.heavy ? 8 : 3);
    if (this.damage(att, def, s.dmg * att.pow * scale)) { def.vx = nx * 20; def.vz = nz * 20; def.vy = 11; return 1; }
    if (s.launch) { def.set('launched'); def.stun = s.stun; def.vx = nx * s.kb; def.vz = nz * s.kb; def.vy = s.up || 0; }
    else { def.set('hurt'); def.stun = s.stun; def.vx = nx * s.kb; def.vz = nz * s.kb; def.vy *= 0.3; }
    return 1;
  }
  stepShots() {
    const dt = VS_DT;
    for (let k = this.shots.length - 1; k >= 0; k--) {
      const s = this.shots[k], def = this.f[1 - s.o], att = this.f[s.o]; s.t += dt; s.life -= dt;
      if (s.big) { if (this.stepBomb(s, att, def)) this.shots.splice(k, 1); continue; }
      if (s.t < 0.5) {                                                  // persigue un poco al principio
        const dx = def.x - s.x, dy = def.y + 1.5 - s.y, dz = def.z - s.z, d = Math.hypot(dx, dy, dz) || 1, sp = Math.hypot(s.vx, s.vy, s.vz), k2 = 3 * dt;
        s.vx += (dx / d * sp - s.vx) * k2; s.vy += (dy / d * sp - s.vy) * k2; s.vz += (dz / d * sp - s.vz) * k2;
      }
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      const d = Math.hypot(def.x - s.x, def.y + 1.5 - s.y, def.z - s.z);
      if (d < s.r + 0.6) {
        const h = Math.hypot(s.vx, s.vz) || 1;
        if (this.hit(att, def, Object.assign({ shot: 1 }, VS.SHOT), s.vx / h, s.vz / h)) { this.emit('pop', { x: s.x, y: s.y, z: s.z, col: s.col }); this.shots.splice(k, 1); continue; }
      }
      if (s.life <= 0 || s.y < 0 || Math.hypot(s.x, s.z) > VS.R + 6) { this.emit('pop', { x: s.x, y: Math.max(0.2, s.y), z: s.z, col: s.col }); this.shots.splice(k, 1); }
    }
  }

  /* ---------------- Ultimates (coreografías propias, tres familias) ----------------
     beam: rayo gigante que avanza · rush: embestida y lluvia de golpes · bomb: esfera enorme que cae.
     ph 0 = presentación (mundo parado, cámara de cine) · ph 1 = ejecución · ph 2 = final */
  startUlt(f, foe) {
    f.ki = 0; f.vx = f.vy = f.vz = 0; f.inv = 99; f.set('ult');
    const type = f.def.ult.type;
    this.ult = { who: f.i, type, t: 0, ph: 0, hitT: 0, n: 0, lock: false, y0: f.y };
    this.emit('ultStart', { i: f.i, type, name: f.def.ult.name, col: f.def.col });
  }
  endUlt(rec) { const f = this.f[this.ult.who]; f.inv = 0; f.set('stun'); f.stun = rec; this.ult = null; this.emit('ultEnd'); }
  stepUlt() {
    const u = this.ult, dt = VS_DT, f = this.f[u.who], foe = this.f[1 - u.who], P = f.pow;
    u.t += dt;
    const dx = foe.x - f.x, dy = foe.y - f.y, dz = foe.z - f.z, dh = Math.hypot(dx, dz) || 0.001, d = Math.hypot(dh, dy) || 0.001;
    if (u.ph === 0) {
      if (u.type === 'bomb') f.y = u.y0 + Math.min(1, u.t / VS.ULT_CINE) * Math.min(9, VS.TOP - u.y0 - 4);     // sube mientras se presenta
      if (u.t >= VS.ULT_CINE) {
        u.ph = 1; u.t = 0; u.dx = dx / d; u.dy = dy / d; u.dz = dz / d; u.hx = dx / dh; u.hz = dz / dh;
        if (u.type === 'bomb') { this.shots.push({ o: f.i, big: 1, x: f.x, y: f.y + 5.5, z: f.z, vx: 0, vy: 0, vz: 0, life: 6, r: 0.5, t: 0, col: f.def.col }); }
        this.emit('ultGo', { i: f.i, type: u.type, col: f.def.col });
      }
      return;
    }
    if (foe.st === 'ko' && u.type !== 'rush') { this.endUlt(0.4); return; }
    if (u.type === 'beam') {
      // El rayo sale de las manos y avanza a 95 u/s: de lejos da tiempo a esquivarlo de lado o a teletransportarse
      const len = Math.min(80, u.t * 95), ox = f.x + u.dx * 1.4, oy = f.y + 1.7 + u.dy * 1.4, oz = f.z + u.dz * 1.4;
      u.len = len; u.ox = ox; u.oy = oy; u.oz = oz;
      const rx = foe.x - ox, ry = foe.y + 1.5 - oy, rz = foe.z - oz, along = rx * u.dx + ry * u.dy + rz * u.dz;
      const perp = Math.hypot(rx - u.dx * along, ry - u.dy * along, rz - u.dz * along);
      if (u.t < 1.35 && along > -1 && along < len && perp < 3.1 && foe.inv <= 0 && foe.st !== 'ko') {
        const g = foe.st === 'guard'; u.hitT += dt;
        if (g) { foe.gm -= 40 * dt; if (foe.gm <= 0) { foe.gm = 50; foe.set('hurt'); } } else if (foe.st !== 'hurt') foe.set('hurt');
        foe.stun = 0.25; foe.vx = u.dx * 17; foe.vy = u.dy * 17; foe.vz = u.dz * 17;
        if ((u.n++ & 3) === 0) { this.emit('beamHit', { x: foe.x, y: foe.y + 1.5, z: foe.z, col: f.def.col }); this.damage(f, foe, (g ? 0.3 : 1) * 300 * P * (4 * dt / 1.35)); }
      }
      if (u.t >= 1.35 && !u.fin) { u.fin = true; if (u.hitT > 0.45 && foe.st !== 'ko') { this.emit('boom', { x: foe.x, y: foe.y + 1.5, z: foe.z, col: f.def.col, big: 1 }); this.hit(f, foe, { dmg: 40, stun: 0.9, kb: 26, up: 8, launch: true, heavy: true, gbreak: 60 }, u.hx, u.hz); } }
      if (u.t >= 1.7) this.endUlt(0.35);
    } else if (u.type === 'rush') {
      if (!u.lock) {
        f.vx = dx / d * 60; f.vy = dy / d * 60; f.vz = dz / d * 60; f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
        if (d < 2.8 && foe.inv <= 0 && foe.st !== 'ko') { u.lock = true; u.t = 0; u.n = 0; u.g = foe.st === 'guard' ? 0.35 : 1; foe.set('held'); foe.vx = foe.vy = foe.vz = 0; f.vx = f.vy = f.vz = 0; this.emit('rushLock', { i: f.i }); }
        else if (u.t > 0.6) { f.vx *= 0.2; f.vy *= 0.2; f.vz *= 0.2; this.endUlt(0.75); }
        return;
      }
      const N = 14, every = 0.085, k = Math.floor(u.t / every);
      if (k > u.n && u.n < N) {
        u.n++; const a = this.rand() * 6.283, e = (this.rand() - 0.5) * 1.6;                                   // cada golpe llega desde un lado distinto
        f.x = foe.x + Math.cos(a) * 2.0; f.z = foe.z + Math.sin(a) * 2.0; f.y = Math.max(0, foe.y + e);
        this.emit('hit', { i: foe.i, x: foe.x + Math.cos(a) * 0.5, y: foe.y + 1.6 + e * 0.5, z: foe.z + Math.sin(a) * 0.5, col: f.def.col, rush: 1 }); this.freeze = 1;
        this.emit('rushHit', { i: f.i, n: u.n });
        if (this.damage(f, foe, 300 * P * 0.6 / N * u.g)) { this.ult = null; f.inv = 0; f.set('idle'); this.emit('ultEnd'); return; }
      }
      if (u.n >= N && u.t > N * every + 0.28) {                          // remate: lo estampa contra el suelo
        f.x = foe.x - u.hx * 1.8; f.z = foe.z - u.hz * 1.8; f.y = foe.y + 1.2; foe.set('idle'); u.lock = false;
        this.hit(f, foe, { dmg: 300 * 0.4 * u.g, stun: 1.0, kb: 14, up: -34, launch: true, heavy: true, gbreak: 100 }, u.hx, u.hz);
        this.emit('boom', { x: foe.x, y: foe.y + 1.5, z: foe.z, col: f.def.col }); this.endUlt(0.3);
      }
    } else {                                                            // bomb: la esfera la mueve stepBomb()
      if (u.t > 6 || !this.shots.some((s) => s.big && s.o === f.i)) this.endUlt(0.3);
    }
  }
  /** Esfera gigante: crece sobre quien la lanza, cae hacia el rival y revienta en un área grande */
  stepBomb(s, att, def) {
    const dt = VS_DT, grow = 0.95;
    if (s.t < grow) { s.r = 0.5 + 3.4 * (s.t / grow); s.x = att.x; s.z = att.z; s.y = att.y + 3.2 + s.r; return false; }
    if (!s.go) { s.go = true; this.emit('bombGo', { x: s.x, y: s.y, z: s.z }); }
    const dx = def.x - s.x, dy = def.y + 1 - s.y, dz = def.z - s.z, d = Math.hypot(dx, dy, dz) || 1, sp = 27, k = Math.min(1, 2.2 * dt);
    s.vx += (dx / d * sp - s.vx) * k * 3; s.vy += (dy / d * sp - s.vy) * k * 3; s.vz += (dz / d * sp - s.vz) * k * 3;
    s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    if (d < s.r + 0.8 || s.y - s.r * 0.5 <= 0 || s.life <= 0) {
      const R = 10, dd = Math.hypot(def.x - s.x, def.y + 1.5 - Math.max(s.y, 1), def.z - s.z);
      this.emit('boom', { x: s.x, y: Math.max(1.5, s.y), z: s.z, col: s.col, big: 2 });
      if (dd < R && def.st !== 'ko' && def.inv <= 0) {
        const fall = 1 - 0.55 * (dd / R), g = def.st === 'guard' ? 0.35 : 1, h = Math.hypot(def.x - s.x, def.z - s.z) || 1;
        if (g < 1) def.set('idle');
        this.hit(att, def, { dmg: 340 * fall * g, stun: 1.0, kb: 24, up: 12, launch: true, heavy: true, gbreak: 100 }, (def.x - s.x) / h, (def.z - s.z) / h);
      }
      return true;
    }
    return false;
  }
  endRound() {
    const w = this.f[this.ko]; w.wins++;
    if (w.wins >= this.rounds) { this.phase = 'end'; this.winner = this.ko; this.emit('match', { w: this.ko }); }
    else this.newRound();
  }
}
