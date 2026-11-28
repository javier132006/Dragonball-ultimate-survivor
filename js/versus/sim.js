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
  // Golpe normal: un golpe por pulsación (4). La quinta pulsación, si el cuarto ha conectado, suelta sola la RÁFAGA:
  // FLURRY.n golpes rápidos y un remate que manda al rival volando
  LIGHT: [{ dmg: 18, stun: 0.36, kb: 4 }, { dmg: 18, stun: 0.36, kb: 4 }, { dmg: 20, stun: 0.38, kb: 4 }, { dmg: 24, stun: 0.46, kb: 5 }],
  FLURRY: { n: 6, every: 0.065, hit: { dmg: 8, stun: 0.3, kb: 0.5, gbreak: 6, fz: 1, rush: 1 }, end: { dmg: 60, stun: 0.95, kb: 32, up: 9, launch: true, gbreak: 40, heavy: true } },
  HEAVY: { dmg: 72, stun: 0.9, kb: 34, up: 7, launch: true, gbreak: 45, heavy: true },
  UPPER: { dmg: 50, stun: 1.15, kb: 3, up: 15, launch: true, gbreak: 45, heavy: true, upper: 1 },   // golpe fuerte + ARRIBA: lo levanta para el combo aéreo
  JUG_MAX: 6,                             // golpes que aguanta un rival en el aire antes de volverse intocable hasta que se recupera
  SPIKE: 30,                              // daño extra al estrellarlo contra el suelo (golpe fuerte a un rival en el aire)
  SHOT: { dmg: 26, stun: 0.24, kb: 5, gbreak: 8, cost: 6, spd: 42 },
  // Ki cargado: mantener el botón de ki. De t0 a max segundos sube de nivel (k = 0..1): más daño, tamaño y coste
  CSHOT: { t0: 0.28, max: 1.0, cost: 14, costK: 14, dmg: 50, dmgK: 55, spd: 48 },
  // Agarre (GUARDIA + GOLPE): rompe la guardia, pierde contra cualquier golpe. El agarrado se suelta si pulsa golpe o guardia a tiempo (tech)
  GRAB: { t0: 0.12, t1: 0.2, miss: 0.5, tech: 0.22, hold: 0.42, dmg: 58, stun: 1.0, kb: 27, up: 9 },
  DODGE: 0.7,                             // segundos que dura la ventaja tras una esquiva perfecta (dash justo cuando llegaba el golpe)
  DODGE_DMG: 1.5,                         // ...y cuánto pega de más el contraataque
  KI_REGEN: 2.5, KI_CHARGE: 32, COST_DASH: 5, COST_TP: 20, COST_ESC: 30,
  PARRY: 0.13,                            // ventana de la guardia perfecta (contraataque)
  PARRY_ULT: 0.22,                        // guardia justo al llegar una Ultimate de energía (rayo, esfera, discos, ráfaga): la desvía
  // Especial (botón ESPECIAL, técnicas de Z Legends 3): cost de ki (buff para los potenciadores), daño de cada tipo, potenciador (x pow durante buffT s)
  SPEC: { cost: 35, buff: 30, beam: 105, rush: 40, rushEnd: 70, shot: 95, buffT: 8, buffK: 1.2 },
  // Contraataque (botón CONTRA): ventana win s esperando un golpe cuerpo a cuerpo; si no llega, queda vendido miss s
  CTR: { cost: 15, win: 0.4, miss: 0.38, dmg: 95 },
  // Dragon Rush (botón RUSH): la embestida de Z Legends 3 con su lógica original; de cerca, rompe la guardia. lunge: velocidad del acercamiento
  DR: { cost: 33, lunge: 22, reach: 6 },
  // Sparking de Z Legends 3: CARGAR KI + hacia atrás, una vez por combate. Dura t s; pega dmg veces más (5→7, 7→9 en el original)
  // y la barra de transformación sube el doble. anim: lo que dura su animación (si su paquete no la trae)
  SPARK: { t: 14, dmg: 1.35, anim: 1.1 },    // (con compañeros en pie dura 21 s, como en el original)
  // Equipos: out = lo que tarda en irse el que cambia (Troca_De_Personagem) · cd = espera entre cambios · ko = segundos en el suelo antes del relevo
  TAG: { out: 0.42, cd: 10, ko: 1.4, in: 1.0 },
  TM_ZL: 2.5,                             // Z Legends 3: la barra de transformación sube sola, 1 % cada 0,4 s
  ULT_CINE: 1.25,                         // segundos de presentación de la Ultimate (el mundo se para)
  TR_CINE: 2.7, TR_SWAP: 1.75,            // transformación: duración total y momento del estallido (cambio de forma)
  TR_DEAL: 0.11, TR_TAKE: 0.16,           // barra de transformación ganada por punto de daño hecho / recibido
  // Choque de Ultimates: si el rival tiene la barra llena, puede responder mientras se presenta la Ultimate (win s).
  // Entrada (intro s), pulso machacando botones (push s) y remate (out s). Cada pulsación empuja; mantener CARGAR KI
  // gasta ki (burn por s) y multiplica el empuje (mult). drv = empuje con memoria (se apaga a decay por s); K = rapidez del punto.
  CLASH: { win: 0.9, intro: 1.15, push: 4.2, out: 0.95, burn: 30, mult: 1.9, decay: 4, K: 0.5, dmg: 320, tie: 0.12, tieDmg: 80 }
};

class VsFighter {
  /** chain: fichas de sus formas, de la inicial a la última. La forma y la barra de transformación duran todo el combate */
  constructor(i, chain) {
    // Equipo (como en Z Legends 3, hasta 3): cada miembro con su cadena de formas, su forma, su barra y su vida. El ki y el Sparking son del equipo
    const T = Array.isArray(chain) && Array.isArray(chain[0]) ? chain : [Array.isArray(chain) ? chain : [chain]];
    this.team = T.map((ch) => ({ chain: ch, fi: 0, tm: 0, hp: ch[0].hp, hpMax: ch[0].hp })); this.ti = 0; this.swCd = 0;
    this.chain = this.team[0].chain; this.fi = 0; this.tm = 0; const def = this.chain[0];
    this.spark = 0; this.spkUsed = 0;                         // Sparking: segundos que le quedan · ya gastado en este combate
    this.i = i; this.def = def; this.hpMax = def.hp; this.pow = def.pow; this.spd = def.spd; this.wins = 0;
    this.pas = def.pas ? def.pas.type : ''; this.zk = 0;      // pasiva del guerrero (versus/extras.js) · zk: veces que el Zenkai le ha subido la fuerza
    this.im = 0;                                              // Inmortalidad: ya la ha gastado en este combate
    if (this.pas === 'potencial') this.tm = 50;               // Poder desbloqueado: empieza con media barra de transformación
    this.reset(i ? -7 : 7);
  }
  reset(x) {
    this.x = x; this.y = 0; this.z = 0; this.vx = this.vy = this.vz = 0;
    if (this.team && this.team.length > 1) { if (this.ti) this.loadMember(0); for (const M of this.team) M.hp = M.hpMax; this.swCd = 0; }   // ronda nueva: el equipo entero, como al empezar
    this.spark = 0; this.hp = this.hpMax; this.ki = 25; this.gm = 100; this.inv = 0; this.pb = 0; this.pend = 0; this.q = 0; this.qt = 0; this.stun = 0;
    this.c = 0; this.n = 0; this.ok = false; this.buf = ''; this.jug = 0; this.spk = 0; this.ctr = 0; this.bo = 0; this.gt = 0; this.ft = 0; this.chg = 0; this.cmb = 0; this.cmbT = 0; this.cmbDmg = 0; this.shots = 0; this.pu = 0; this.lh = 9; this.dx = 1; this.dz = 0; this.flash = 0;
    // Pasivas que se renuevan cada ronda: vis (visión), el (élite), cp (copia), wk (debilitado), slow (congelado), tpb (golpe tras teletransporte)
    this.vis = 0; this.el = 0; this.cp = 0; this.wk = 0; this.slow = 0; this.tpb = 0; this.sb = 0; this.sp = null; this.zh = 0; this.zc = 0;
    if (this.pas === 'potara') this.ki = 60;
    this.set('idle');
  }
  set(st) { this.st = st; this.t = 0; this.done = false; }
  /** Siguiente compañero en pie (-1 si no queda ninguno) */
  nextAlive() { const n = this.team.length; for (let k = 1; k < n; k++) { const j = (this.ti + k) % n; if (this.team[j].hp > 0) return j; } return -1; }
  /** Pasa a controlar al miembro k: se guarda cómo queda el que sale (forma, barra, vida) */
  loadMember(k) {
    const M = this.team[this.ti]; M.fi = this.fi; M.tm = this.tm; M.hp = this.hp; M.hpMax = this.hpMax;
    const N = this.team[k]; this.ti = k; this.chain = N.chain; this.fi = N.fi; this.tm = N.tm; this.def = N.chain[N.fi];
    this.hpMax = N.hpMax; this.hp = N.hp; this.pow = this.def.pow; this.spd = this.def.spd; this.sp = null; this.zh = 0; this.zc = 0; this.sb = 0;
  }
  get canTrans() { return this.tm >= 100 && this.fi < this.chain.length - 1; }
  /** Llena la barra de transformación (cada forma cuesta un poco más que la anterior) */
  gain(v) { if (this.fi < this.chain.length - 1 && !this.def.zl) this.tm = Math.min(100, this.tm + v / (1 + 0.3 * this.fi)); }   // los de Z Legends 3 la llenan con el tiempo (stepFighter)
  get busy() { return this.st !== 'idle' && this.st !== 'move'; }
}

/** Vida de todo el equipo (para decidir quién gana si se acaba el tiempo) */
function vsTeamHp(f) { return f.team.reduce((s, M, k) => s + (k === f.ti ? f.hp : M.hp) / M.hpMax, 0); }
/** Tabla de Z Legends 3 de una forma (window.ZMOVE_T), o null */
function vsZTab(def) { const z = def && /^z_/.test(def.sheet || '') ? def.sheet.slice(2) : null, T = typeof window !== 'undefined' && window.ZMOVE_T; return (T && z && T[z]) || null; }
const VS_ZCUT_MAX = 2.8;                    // segundos como mucho de paneles de cinemática al lanzar una Ultimate de Z Legends 3
/** Ultimate de Z Legends 3 de una forma (tabla fija de assets/zl3/m/list.js), o null si su forma no sale de ese juego */
function vsZUlt(def) {
  const T = typeof window !== 'undefined' && window.ZMOVE_T, z = def && /^z_/.test(def.sheet || '') ? def.sheet.slice(2) : null;
  return T && z && T[z] && T[z].U ? T[z].U : null;
}

class VsSim {
  constructor(defA, defB, opt) {
    opt = opt || {}; this.o = opt;       // opt.noKO: la vida no baja de 1 · opt.noTime: sin reloj (entrenamiento)
    this.f = [new VsFighter(0, defA), new VsFighter(1, defB)];
    this.seed = (opt.seed || 12345) >>> 0; this.rounds = opt.rounds || 2; this.roundTime = opt.time || 99;
    this.ev = []; this.shots = []; this.tick = 0; this.round = 0; this.winner = -1; this.clash = null;
    this.cx = 0; this.cz = -1;            // lado en el que está la cámara (normal horizontal, unitaria)
    this.newRound();
  }
  /** Azar con semilla (mulberry32) */
  rand() { let t = (this.seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  emit(t, o) { o = o || {}; o.t = t; this.ev.push(o); }
  newRound() {
    this.round++; this.f[0].reset(7); this.f[1].reset(-7);                // con la cámara en -z, la derecha de la pantalla es -x: el jugador 1 empieza a la izquierda
     this.shots.length = 0; this.zef = []; this.zW = []; this.blasts = []; this.ult = null; this.tr = null; this.clash = null; this.freeze = 0; this.tag = null;
    this.time = this.roundTime; this.phase = 'intro'; this.pt = 0; this.cx = 0; this.cz = -1; this.df = 0;
    this.introT = this.round === 1 && this.o.intro ? this.o.intro : 2.3;   // la primera ronda puede llevar las entradas de los luchadores
    this.emit('round', { n: this.round });
  }
  /** Coordenada X en pantalla de un vector horizontal (la cámara mira desde c hacia -c; su derecha es (cz, -cx)) */
  screenX(dx, dz) { return dx * this.cz - dz * this.cx; }

  step(c0, c1) {
    if (this.freeze > 0) {                                              // hitstop: unos pasos congelados al impactar
      this.freeze--; for (let i = 0; i < 2; i++) { const f = this.f[i], b = (i ? c1 : c0) ? (i ? c1 : c0).b : 0; f.pend |= b & ~f.pb; f.pb = b; }   // ...pero lo que se pulse mientras tanto no se pierde
      return;
    }
    this.tick++;
    const a = this.f[0], b = this.f[1], cmd = [c0, c1];
    // La cámara se queda en el lado en el que ya estaba (los luchadores pueden cruzarse sin que gire 180°)
    const dx = b.x - a.x, dz = b.z - a.z, h = Math.hypot(dx, dz);
    if (h > 0.8) { let nx = -dz / h, nz = dx / h; if (nx * this.cx + nz * this.cz < 0) { nx = -nx; nz = -nz; } this.cx = nx; this.cz = nz; }
    if (this.tr) { this.stepTrans(); return; }                          // transformación: el mundo espera
    if (this.clash) { this.stepClash(cmd); return; }                    // choque de Ultimates: el reloj y el resto esperan
    this.pt += VS_DT;
    if (this.phase === 'intro' && this.pt > this.introT) { this.phase = 'fight'; this.pt = 0; this.emit('fight'); }
    else if (this.phase === 'ko' && this.pt > (this.dfT || (this.df ? 4.7 : 3.0))) { this.dfT = 0; this.endRound(); }   // el final destructivo dura más
    else if (this.phase === 'fight' && !this.ult && !this.o.noTime && !this.tag) {
      this.time -= VS_DT;
      if (this.time <= 0) { this.time = 0; const w = this.o.survive ? (a.hp > 0 ? 0 : 1) : vsTeamHp(a) >= vsTeamHp(b) ? 0 : 1; /* historia «resiste»: si sigues en pie, ganas */ this.phase = 'ko'; this.pt = 0; this.ko = w; this.emit('timeup', { w }); }
    }
    if (this.ult && this.ult.ph === 0) { if (this.ult.cw && this.tryClash(cmd)) return; this.stepUlt(); return; }   // presentación de la Ultimate: el mundo está parado (el rival aún puede responder)
    if (this.tag) { this.stepTag(); if (this.tag) { cmd[0] = cmd[1] = null; } }   // relevo tras caer un miembro del equipo: nadie se mueve hasta que entra el siguiente
    for (let i = 0; i < 2; i++) this.stepFighter(this.f[i], this.f[1 - i], cmd[i] || { mx: 0, mz: 0, b: 0 });
    if (this.ult) this.stepUlt();
    this.stepShots();
    this.zeStep();                                                      // efectos de las técnicas de Z Legends 3 (versus/zfx.js)
    // Los cuerpos no se atraviesan
    const ex = b.x - a.x, ez = b.z - a.z, eh = Math.hypot(ex, ez);
    if (eh < 1.5 && Math.abs(b.y - a.y) < 2.4 && a.st !== 'ko' && b.st !== 'ko' && !(this.ult && this.ult.lock) && !(a.zh > 0 || b.zh > 0 || a.sp && a.sp.z || b.sp && b.sp.z)) {
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
    const dt = VS_DT, held = cmd.b, AQ = VB.ATK | VB.HEAVY; let press = (cmd.b & ~f.pb) | f.pend; f.pb = cmd.b; f.pend = 0;
    // Cola de golpes: cada pulsación de golpe cuenta aunque llegue un instante antes de poder pegar (saliendo de un dash, de un golpe recibido, del hitstop...)
    if (press & AQ) { f.q = press & AQ; f.qt = 0.25; } else if (f.qt > 0 && (f.qt -= dt) <= 0) f.q = 0;
    const fresh = press; press |= f.q;
    if (f.ctr > 0) f.ctr -= dt; if (f.swCd > 0 && this.phase === 'fight') f.swCd -= dt;
    const ctl = this.phase === 'fight' && !(this.ult && (this.ult.who === f.i || this.ult.lock));
    f.t += dt; f.inv = Math.max(0, f.inv - dt); f.flash = Math.max(0, f.flash - dt);
    const pas = f.pas, tpk = pas === 'tp' ? 0.5 : 1, RE = VS.REACH + (pas === 'espada' ? 0.5 : 0);
    if (f.wk > 0) f.wk -= dt; if (f.slow > 0) f.slow -= dt; if (f.sb > 0) f.sb -= dt;   // sb: potenciador de un especial (Kaioken...)
    const low = pas === 'esperanza' && f.hp < f.hpMax * 0.3;           // Última esperanza: con poca vida, más ki y disparos más baratos
    if (f.st !== 'ko' && this.phase === 'fight') {
      if (f.spark > 0 && f.st !== 'sparking') f.spark = Math.max(0, f.spark - dt);
      if (f.def.zl && f.fi < f.chain.length - 1) f.tm = Math.min(100, f.tm + VS.TM_ZL * (f.spark > 0 ? 2 : 1) * dt);   // como en el original: sube sola (el doble con Sparking)
      f.ki = Math.min(100, f.ki + VS.KI_REGEN * (pas === 'infinito' ? 3 : low ? 2 : 1) * dt); f.lh += dt;
      if (pas === 'regen' && f.lh > 3 && f.hp < f.hpMax) f.hp = Math.min(f.hpMax, f.hp + f.hpMax * 0.008 * dt);     // Regeneración: se cura si lleva 3 s sin recibir
      if (foe.pas === 'maligno' && foe.st !== 'ko' && Math.hypot(foe.x - f.x, foe.y - f.y, foe.z - f.z) < 6) f.ki = Math.max(0, f.ki - 6 * dt);   // Aura maligna del rival: cerca de él se pierde ki
    }
    if (f.st !== 'guard') f.gm = Math.min(100, f.gm + 14 * (pas === 'acero' ? 2 : 1) * dt);
    if (f.cmbT > 0 && (f.cmbT -= dt) <= 0) { f.cmb = 0; f.cmbDmg = 0; }
    // Dirección hacia el rival (horizontal y en 3D)
    const tx = foe.x - f.x, ty = foe.y - f.y, tz = foe.z - f.z, th = Math.hypot(tx, tz) || 0.001, td = Math.hypot(th, ty) || 0.001;
    const nx = tx / th, nz = tz / th;
    // Movimiento pedido, de pantalla a mundo: derecha de pantalla = (cz, -cx), fondo = (-cx, -cz)
    const wx = this.cz * cmd.mx - this.cx * cmd.mz, wz = -this.cx * cmd.mx - this.cz * cmd.mz, my = (held & VB.UP ? 1 : 0) - (held & VB.DOWN ? 1 : 0);
    const brake = (k) => { const m = Math.max(0, 1 - k * dt); f.vx *= m; f.vy *= m; f.vz *= m; };
    if (f.zh > 0 && f.st !== 'ko') { f.zh -= dt; f.vx = f.vy = f.vz = 0; return; }   // sujeto por un especial del original (lo mueve su lógica)
    switch (f.st) {
      case 'idle': case 'move': {
        const k = Math.min(1, 14 * dt), sp = VS.SPD * f.spd * (pas === 'lobo' ? 1.08 : 1) * (f.slow > 0 ? 0.7 : 1);   // congelado por el rival: más lento
        f.vx += ((ctl ? wx * sp : 0) - f.vx) * k; f.vz += ((ctl ? wz * sp : 0) - f.vz) * k; f.vy += ((ctl ? my * VS.FLY : 0) - f.vy) * k;
        if (ctl) {
          if ((press & VB.TRANS) && f.canTrans && !this.ult && foe.st !== 'ko') { this.startTrans(f); break; }
          if ((press & VB.SWAP) && f.team.length > 1 && f.swCd <= 0 && f.nextAlive() >= 0 && !this.ult && foe.st !== 'ko') { f.swTo = f.nextAlive(); f.vx = f.vy = f.vz = 0; f.inv = 99; f.set('tagout'); this.emit('tagOut', { i: f.i, x: f.x, y: f.y + 1.6, z: f.z }); break; }   // cambio de luchador (Troca de personagem)
          if ((press & VB.ULT) && f.ki >= 100 && foe.st !== 'ko' && !this.ult && !this.clash) { this.startUlt(f, foe); break; }   // con otra Ultimate en marcha no se puede lanzar la tuya (solo responder a tiempo: choque)
          if ((press & VB.SPEC) && foe.st !== 'ko' && this.startSpec(f, foe, held, cmd)) break;
          if ((press & VB.DR) && foe.st !== 'ko' && this.startDR(f, foe)) break;
          if ((press & VB.CTR) && f.ki >= VS.CTR.cost) { f.ki -= VS.CTR.cost; f.vx = f.vy = f.vz = 0; f.set('ctrw'); this.emit('ctrw', { i: f.i }); break; }
          if ((press & VB.TP) && f.ki >= VS.COST_TP * tpk) { this.vanish(f, foe, VS.COST_TP * tpk); break; }
          if ((press & VB.DASH) && (pas === 'lobo' || f.ki >= VS.COST_DASH)) { this.dash(f, foe, wx, wz, my, nx, nz, ty / td); break; }
          if ((held & VB.GUARD) && (press & VB.ATK) && foe.st !== 'ko') { f.q = 0; f.set('grab'); this.emit('grabTry', { i: f.i }); break; }
          if (press & VB.HEAVY) { f.q = 0; f.set('heavy'); this.emit('swing', { i: f.i, heavy: 1 }); break; }
          if (press & VB.ATK) { f.q = 0; f.c = 0; f.buf = ''; f.set('atk'); this.emit('swing', { i: f.i }); break; }
          if ((press & VB.KI) && f.ki >= VS.SHOT.cost) { f.shots = 0; f.chg = 0; f.buf = ''; f.set('shot'); break; }
          if (held & VB.GUARD) { f.set('guard'); break; }
          if (held & VB.CHARGE) { f.set('charge'); this.emit('charge', { i: f.i }); break; }
        }
        f.jug = 0; f.spk = 0; f.bo = 0;
        f.st = Math.hypot(f.vx, f.vz) + Math.abs(f.vy) > 1.5 ? 'move' : 'idle';
        break;
      }
      case 'guard': brake(12);
        if ((press & VB.ATK) && ctl && foe.st !== 'ko') { f.q = 0; f.set('grab'); this.emit('grabTry', { i: f.i }); break; }   // guardia + golpe = agarre
        if (!(held & VB.GUARD) && f.t > 0.12) f.set('idle'); if ((press & VB.TP) && f.ki >= VS.COST_TP * tpk && ctl) this.vanish(f, foe, VS.COST_TP * tpk); break;
      case 'charge': brake(12); f.ki = Math.min(100, f.ki + VS.KI_CHARGE * dt);
        if (ctl && !f.spkUsed && !this.ult && foe.st !== 'ko' && wx * nx + wz * nz < -0.5) { this.startSpark(f); break; }   // Sparking: cargando, hacia atrás
        if (pas === 'fruto') f.hp = Math.min(f.hpMax, f.hp + f.hpMax * 0.025 * dt);     // Fruto del árbol sagrado: cargar ki también cura
        if ((press & VB.TRANS) && ctl && f.canTrans && !this.ult && foe.st !== 'ko') { this.startTrans(f); break; }
        if (!(held & VB.CHARGE) || !ctl) f.set('idle'); break;
      case 'tagout':                                                     // se va (Troca_De_Personagem) y entra el compañero con un dash hacia el rival
        brake(10); if (f.t >= VS.TAG.out) {
          f.loadMember(f.swTo); f.swCd = VS.TAG.cd; f.inv = 0.4; f.set('dash'); f.dx = nx; f.dz = nz; f.dy = 0;
          this.emit('tagIn', { i: f.i, x: f.x, y: f.y + 1.6, z: f.z, col: f.def.col });
        } break;
      case 'tagin': brake(10); if (f.t >= f.tinT) { f.inv = 0.3; f.set('idle'); } break;   // entrando tras caer el compañero (Change_Pt1..3)
      case 'sparking': brake(14); if (f.t >= f.spkT) { f.spark = VS.SPARK.t * (f.nextAlive() >= 0 ? 1.5 : 1); f.inv = 0; f.set('idle'); this.emit('sparkOn', { i: f.i, x: f.x, y: f.y + 1.6, z: f.z, col: f.def.col }); } break;
      case 'dash':
        f.vx = f.dx * VS.DASH; f.vz = f.dz * VS.DASH; f.vy = f.dy * VS.DASH;
        if (f.t >= VS.DASH_T) { f.vx *= 0.3; f.vy *= 0.3; f.vz *= 0.3; f.set('idle'); }
        else if (press & VB.ATK) { f.buf = 'atk'; f.q = 0; } else if (press & VB.HEAVY) { f.buf = 'heavy'; f.q = 0; }
        if (f.st === 'idle' && f.buf) { if (f.buf === 'atk') { f.c = 0; f.set('atk'); } else f.set('heavy'); f.buf = ''; this.emit('swing', { i: f.i }); }
        break;
      case 'atk': {
        const last = f.c >= VS.LIGHT.length - 1, a0 = 0.07, a1 = 0.16, end = last ? 0.42 : 0.33;
        if (f.c === 0 && f.t < dt * 1.5 && f.ctr > 0) { this.counter(f, foe); break; }
        if (f.t < a1 && td < 8 && td > 1.7) { const s = 26; f.vx = nx * s * (th / td); f.vz = nz * s * (th / td); f.vy = (ty / td) * s; } else brake(18);   // se pega al rival
        if (f.t >= a0 && f.t < a1 && !f.done && td < RE) { f.done = true; f.ok = this.hit(f, foe, this.boost(f, VS.LIGHT[f.c]), nx, nz) === 1; }
        if (f.t > 0.08) { if (press & VB.ATK) { f.buf = 'atk'; f.q = 0; } else if (press & VB.HEAVY) { f.buf = 'heavy'; f.q = 0; } }
        if (f.t >= end || (f.buf && f.t >= a1 + 0.06 && f.done)) {
          if (f.buf === 'atk' && !last) { f.c++; f.buf = ''; f.ok = false; f.set('atk'); this.emit('swing', { i: f.i }); }
          else if (f.buf === 'atk' && f.ok && td < VS.REACH + 1 && foe.st === 'hurt') { f.buf = ''; f.n = 0; f.set('flurry'); this.emit('flurry', { i: f.i }); }   // quinta pulsación: ráfaga automática
          else if (f.buf === 'heavy') { f.buf = ''; f.set('heavy'); this.emit('swing', { i: f.i, heavy: 1 }); }
          else if (f.t >= end) f.set('idle');
        }
        break;
      }
      case 'flurry': {                                                   // ráfaga: golpes rápidos pegado al rival y remate que lo lanza
        const F = VS.FLURRY, FN = F.n + (pas === 'metamor' ? 3 : 0), T = FN * F.every;   // Metamor: tres golpes más
        if (!f.done && (foe.st !== 'hurt' || foe.inv > 0 || td > VS.REACH + 1.6)) { f.set('idle'); break; }     // se ha escapado
        if (!f.done) { f.vx = foe.vx + nx * (th - 1.9) * 12; f.vz = foe.vz + nz * (th - 1.9) * 12; f.vy = ty * 12; } else brake(14);
        if (f.n < FN && f.t >= f.n * F.every) { f.n++; foe.stun = 0.3; this.emit('swing', { i: f.i }); if (this.hit(f, foe, F.hit, nx, nz) !== 1) { f.set('idle'); break; } }
        if (!f.done && f.t >= T + 0.1) { f.done = true; this.emit('swing', { i: f.i, heavy: 1 }); this.hit(f, foe, F.end, nx, nz); }
        if (f.t >= T + 0.42) f.set('idle');
        break;
      }
      case 'heavy':
        if (f.t < dt * 1.5 && f.ctr > 0) { this.counter(f, foe); break; }
        if (f.t < 0.2 && td < 7 && td > 1.7) { f.vx = nx * 20 * (th / td); f.vz = nz * 20 * (th / td); f.vy = (ty / td) * 20; } else brake(16);
        if (f.t >= 0.2 && f.t < 0.3 && !f.done && td < RE + 0.3) {  // con ARRIBA pulsado es un gancho que lo levanta; a un rival en el aire lo estrella contra el suelo
          f.done = true; const up = (held & VB.UP) && foe.st !== 'launched'; f.ok = this.hit(f, foe, this.boost(f, up ? VS.UPPER : VS.HEAVY), nx, nz) === 1 && up;
        }
        if (f.t >= (f.ok && f.done ? 0.4 : 0.62)) f.set('idle');             // tras el gancho se recupera antes: da tiempo a seguirlo
        break;
      case 'grab': {                                                    // agarre: paso corto hacia delante; si lo engancha, lo sujeta y lo lanza
        const G = VS.GRAB;
        if (this.phase !== 'fight') { if (foe.st === 'grabd') foe.set('idle'); f.set('idle'); break; }
        if (!f.done) {
          if (f.t < G.t1 && td > 1.8 && td < 5) { f.vx = nx * 18 * (th / td); f.vz = nz * 18 * (th / td); f.vy = (ty / td) * 18; } else brake(16);
          if (f.t >= G.t0 && f.t < G.t1 + 0.04 && td < VS.REACH - 0.2) {
            if (foe.st === 'grab' && !foe.done) { this.tech(f, foe); break; }                                   // los dos agarran a la vez: se anulan
            if (foe.inv <= 0 && (foe.st === 'idle' || foe.st === 'move' || foe.st === 'guard' || foe.st === 'charge' || foe.st === 'shot' || foe.st === 'stun')) {
              f.done = true; f.gt = 0; f.gx = nx; f.gz = nz; f.vx = f.vy = f.vz = 0; foe.set('grabd'); foe.vx = foe.vy = foe.vz = 0; this.emit('grab', { i: f.i, x: foe.x, y: foe.y + 1.6, z: foe.z });
            }
          }
          if (!f.done && f.t >= G.miss) f.set('idle');
        } else {
          if (foe.st !== 'grabd') { f.set('idle'); break; }
          foe.x = f.x + f.gx * 1.7; foe.z = f.z + f.gz * 1.7; foe.y = f.y + 0.35; f.gt += dt;
          if (f.gt >= G.hold) {                                           // lo lanza hacia donde apunte el jugador (por defecto, hacia delante)
            const m = Math.hypot(wx, wz), dx = m > 0.3 ? wx / m : f.gx, dz = m > 0.3 ? wz / m : f.gz;
            foe.set('idle');
            if (pas === 'cambio' && !f.pu && f.hp / f.hpMax < foe.hp / foe.hpMax) {                             // Cambio de cuerpo: una vez por ronda, el agarre intercambia la vida de los dos
              const a = f.hp / f.hpMax, b = foe.hp / foe.hpMax; f.pu = 1; f.hp = f.hpMax * b; foe.hp = foe.hpMax * a; this.emit('pas', { i: f.i, k: 'cambio', x: foe.x, y: foe.y + 1.6, z: foe.z });
            }
            this.hit(f, foe, { dmg: G.dmg, stun: G.stun, kb: G.kb, up: G.up, launch: true, heavy: true }, dx, dz); this.emit('throw', { i: f.i });
            f.set('stun'); f.stun = 0.22;
          }
        }
        break;
      }
      case 'grabd':                                                     // agarrado: una pulsación de golpe o guardia a tiempo y se suelta
        f.vx = f.vy = f.vz = 0;
        if (foe.st !== 'grab') { f.set('idle'); break; }
        if (f.t < VS.GRAB.tech && (fresh & (VB.ATK | VB.GUARD)) && this.phase === 'fight') this.tech(foe, f);
        break;
      case 'shot': {
        brake(10); const C = VS.CSHOT;
        if (fresh & VB.KI) f.buf = 'ki';                                  // otro toque = otro disparo (hasta 5 seguidos)
        if (!f.done) {
          const can = f.ki >= C.cost;
          if ((held & VB.KI) && ctl && can && f.t < C.max) { if (f.t >= C.t0 && !f.chg) { f.chg = 1; this.emit('kiCharge', { i: f.i }); } }   // sigue cargando
          else if (f.t >= 0.1) {
            f.done = true; f.ft = f.t; f.shots++;
            let k = f.chg && can ? Math.min(1, (f.t - C.t0) / (C.max - C.t0)) : -1; if (k >= 0) k = Math.min(k, Math.max(0, (f.ki - C.cost) / C.costK));
            const big = k >= 0, sp = big ? C.spd : VS.SHOT.spd, oy = 1.7, ay = (foe.y + 1.5) - (f.y + oy), ad = Math.hypot(th, ay) || 1;
            const sh = { o: f.i, x: f.x + nx * 1.2, y: f.y + oy, z: f.z + nz * 1.2, vx: tx / ad * sp, vy: ay / ad * sp, vz: tz / ad * sp, life: 1.5, r: 1.5, t: 0, col: f.def.col };
            if (pas === 'hakai') sh.pw = 5;                                 // Destrucción: sus disparos ganan cualquier choque de ki
            if (pas === 'fantasma') { sh.hm = 1.3; sh.tr = 5; sh.life = 2.2; }   // Kamikaze fantasma: persiguen al rival mucho más
            if (big) {
              f.ki -= C.cost + C.costK * k; sh.chg = 1; sh.r = 1.9 + 1.3 * k; sh.pw = 2 + Math.round(k * 2); sh.life = 1.7;
              sh.hs = { dmg: C.dmg + C.dmgK * k, stun: 0.55 + 0.3 * k, kb: 14 + 10 * k, up: 6, launch: k >= 0.5, heavy: true, gbreak: 25 + 35 * k, fz: 5, shot: 1 };
              if (pas === 'caramelo') sh.hs.weak = 1;                       // Rayo caramelo: debilita al rival
            } else if (pas === 'tirano') { f.ki -= VS.SHOT.cost * 0.6; sh.hs = Object.assign({ shot: 1 }, VS.SHOT, { dmg: VS.SHOT.dmg * 1.35 }); }   // Tirano: ki más barato y más dañino
            else if (pas === 'certero') { f.ki -= VS.SHOT.cost; sh.vx *= 1.4; sh.vy *= 1.4; sh.vz *= 1.4; sh.hs = Object.assign({ shot: 1 }, VS.SHOT, { stun: 0.42 }); }   // Disparo certero: más rápido y aturde más
            else f.ki -= VS.SHOT.cost * (low ? 0.5 : 1);
            this.shots.push(sh); this.emit('shot', { i: f.i, x: sh.x, y: sh.y, z: sh.z, chg: big ? 1 + k : 0 }); f.chg = 0;
          }
        } else {
          if (f.t >= f.ft + 0.14) { if (f.buf === 'ki' && f.shots < 5 && f.ki >= VS.SHOT.cost && ctl) { f.buf = ''; f.chg = 0; f.set('shot'); } else if (f.t >= f.ft + 0.22) { f.buf = ''; f.set('idle'); } }
        }
        break;
      }
      case 'hurt':
        brake(7); f.stun -= dt;
        if ((press & VB.TP) && f.ki >= VS.COST_ESC * tpk && this.phase === 'fight' && !this.ult) { this.vanish(f, foe, VS.COST_ESC * tpk); break; }
        if (f.stun <= 0) f.set('idle');
        break;
      case 'launched':
        f.stun -= dt; { const m = Math.max(0, 1 - 1.4 * dt); f.vx *= m; f.vz *= m; } if (f.t > 0.22) f.vy -= 22 * dt;
        if ((press & VB.TP) && f.ki >= VS.COST_ESC * tpk && this.phase === 'fight' && !this.ult) { this.vanish(f, foe, VS.COST_ESC * tpk); break; }
        if (f.y <= 0 && f.vy < 0) {
          this.emit('land', { x: f.x, z: f.z, hard: f.vy < -16 }); if (f.vy < -16) this.freeze = 4; f.vx *= 0.2; f.vz *= 0.2; f.vy = 0;
          if (f.spk) { const a = this.f[f.spk - 1]; f.spk = 0; this.emit('crater', { x: f.x, z: f.z, col: a.def.col }); this.freeze = 7; if (this.damage(a, f, VS.SPIKE * a.pow, true)) break; }   // estrellado contra el suelo
          f.set('down');
        }
        else if (f.stun <= 0 && f.y > 0.5) { f.vy *= 0.3; f.inv = 0.15; f.set('idle'); }
        break;
      case 'down': brake(10); if (f.t >= 0.65) { f.inv = 0.5; f.set('idle'); if (pas === 'zenkai' && f.zk < 5 && this.phase === 'fight') { f.zk++; this.emit('pas', { i: f.i, k: 'zenkai', x: f.x, y: f.y + 1.6, z: f.z }); } } break;   // Zenkai: cada vez que se levanta pega más
      case 'stun': brake(10); f.stun -= dt; if (f.stun <= 0) f.set('idle'); break;
      case 'ctrw': brake(14); if (f.t >= VS.CTR.win) { f.set('stun'); f.stun = VS.CTR.miss; this.emit('ctrMiss', { i: f.i }); } break;   // nadie le ha pegado: queda vendido
      case 'spec': this.stepSpec(f, foe); break;
      case 'ko': { const m = Math.max(0, 1 - 1.2 * dt); f.vx *= m; f.vz *= m; if (f.y > 0 || f.vy > 0) f.vy -= 22 * dt; else { if (f.vy < -4 && !f.done) { f.done = true; this.emit('land', { x: f.x, z: f.z, hard: true }); } f.vy = 0; f.vx *= 0.8; f.vz *= 0.8; } break; }
      case 'ult': case 'held': case 'trans':                                            // los mueve stepUlt() / stepTrans()
        if (f.st === 'ult' && (!this.ult || this.ult.who !== f.i)) { f.inv = 0; f.set('idle'); }      // red de seguridad: nunca se queda congelado sin una Ultimate que lo mueva
        else if (f.st === 'held' && !this.ult) f.set('idle');
        else if (f.st === 'trans' && !this.tr) f.set('idle');
        break;
    }
    f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
  }

  dash(f, foe, wx, wz, my, nx, nz, ny) {
    if (f.pas !== 'lobo') f.ki -= VS.COST_DASH;
    // Persecución: si el rival sale volando, el dash te planta a su lado para seguir el combo
    if (foe.st === 'launched' && Math.hypot(foe.x - f.x, foe.y - f.y, foe.z - f.z) > 5) {
      this.emit('vanish', { i: f.i, x: f.x, y: f.y, z: f.z });
      f.x = foe.x - nx * 2.2; f.y = Math.max(0, foe.y); f.z = foe.z - nz * 2.2; f.vx = foe.vx * 0.6; f.vy = 0; f.vz = foe.vz * 0.6;
      foe.vx *= 0.35; foe.vz *= 0.35; foe.vy = Math.max(foe.vy, 2); foe.stun = Math.max(foe.stun, 0.45);
      this.emit('pursue', { i: f.i, x: f.x, y: f.y, z: f.z }); f.inv = 0.1; f.set('idle'); return;
    }
    let dx = wx, dy = my, dz = wz; const m = Math.hypot(dx, dy, dz);
    if (m < 0.2) { dx = nx; dz = nz; dy = ny * 0.6; } else { dx /= m; dy /= m; dz /= m; }
    const n = Math.hypot(dx, dy, dz) || 1; f.dx = dx / n; f.dy = dy / n; f.dz = dz / n; f.inv = f.pas === 'tiempo' ? 0.2 : 0.12; f.buf = '';
    f.set('dash'); this.emit('dash', { i: f.i, x: f.x, y: f.y, z: f.z });
  }
  /* ---------------- Especiales y contraataques de Z Legends 3 ----------------
     Especial: sin dirección, moviéndose, con ARRIBA o con ABAJO (hasta cuatro por forma: window.ZMOVE_T[z].S).
       beam: lo dibujado en el sprite; acierta si al soltarlo el rival está en su línea (dirección fijada al empezar)
       shot: lanza un proyectil grande · rush: se lanza contra él; si lo toca lo aturde hasta el remate · buff: pega más un rato
     Sin técnicas de Z Legends 3 en esa forma, el especial es un ki cargado al máximo. La animación manda: f.sp.seq / si / pt */
  startSpec(f, foe, held, cmd) {
    const slot = held & VB.UP ? 2 : held & VB.DOWN ? 3 : cmd.mx || cmd.mz ? 1 : 0, T = vsZTab(f.def), L = T && T.S, S = L && (L[slot] || L[0] || L.find(Boolean));
    if (!S) {
      if (f.ki < VS.CSHOT.cost + VS.CSHOT.costK) return false;
      f.shots = 0; f.chg = 1; f.buf = ''; f.set('shot'); f.t = VS.CSHOT.max; this.emit('kiCharge', { i: f.i }); return true;
    }
    const cost = S.k === 'buff' ? VS.SPEC.buff : VS.SPEC.cost;
    if (f.ki < cost || (S.k === 'buff' && f.sb > 0)) return false;
    f.ki -= cost; f.vx = f.vy = f.vz = 0; f.set('spec');
    const dx = foe.x - f.x, dy = foe.y - f.y, dz = foe.z - f.z, d = Math.hypot(dx, dy, dz) || 1;
    f.sp = { S, seq: S.P, si: 0, pt: 0, tt: 0, res: 0, dx: dx / d, dy: dy / d, dz: dz / d };
    this.zcStart(f, foe, f.sp);                                          // su lógica del juego original, si la tiene (js/versus/zchoreo.js)
    this.emit('spec', { i: f.i, name: S.n, col: f.def.col, k: S.k });
    return true;
  }
  /** Dragon Rush: sus cuatro partes de Z Legends 3 (embestida, ráfaga de puñetazos, lanzamiento y persecución), con los eventos
   *  del original (ZMOVE_DR). Si los dos lo hacen a la vez y chocan: duelo de puñetazos y salen despedidos hacia arriba */
  startDR(f, foe) {
    if (f.ki < VS.DR.cost) return false;
    const cid = /^z_/.test(f.def.sheet || '') ? f.def.sheet.slice(2) : null, CH = cid && typeof window !== 'undefined' && window.ZMOVE_CH && ZMOVE_CH[cid];
    const part = (n) => (CH && CH[n] ? [n, CH[n].d, 0] : null), P1 = part('Dragon_Rush_Pt1');
    f.ki -= VS.DR.cost; f.vx = f.vy = f.vz = 0;
    if (!P1 || !window.ZMOVE_DR) { const dx = foe.x - f.x, dz = foe.z - f.z, h = Math.hypot(dx, dz) || 1; f.dx = dx / h; f.dz = dz / h; f.dy = 0; f.buf = 'heavy'; f.set('dash'); this.emit('dash', { i: f.i }); return true; }   // sin animaciones del original: dash y golpe fuerte
    const S = { n: 'DRAGON RUSH', k: 'dr', P: [P1], H: ['Dragon_Rush_Pt2', 'Dragon_Rush_Pt3', 'Dragon_Rush_Pt4'].map(part).filter(Boolean), E: [], rel: [0, 0], R: 0 };
    const dx = foe.x - f.x, dy = foe.y - f.y, dz = foe.z - f.z, d = Math.hypot(dx, dy, dz) || 1;
    f.set('spec'); f.sp = { S, seq: S.P, si: 0, pt: 0, tt: 0, res: 0, dx: dx / d, dy: dy / d, dz: dz / d };
    this.zcStart(f, foe, f.sp);
    this.emit('spec', { i: f.i, name: S.n, col: f.def.col, k: 'dr' });
    return true;
  }
  /**
   * Dragon Rush tras la serie de golpes: la patada sube al rival (hacia arriba y un poco hacia atrás, sin saltos) y en el
   * golpe final el atacante vuela hasta él (al acabar, zcEnd lo estrella contra el suelo)
   */
  drMove(f, foe, p, part) {
    const P = p.seq[p.si], T = Math.max(0.15, P[1]), k = Math.min(1, p.pt / T), e = 1 - (1 - k) * (1 - k);
    if (!p.dr || p.dr.part !== part) {
      const dx = foe.x - f.x, dz = foe.z - f.z, h = Math.hypot(dx, dz) || 1;
      p.dr = { part, nx: dx / h, nz: dz / h, fx: foe.x, fy: foe.y, fz: foe.z, ax: f.x, ay: f.y, az: f.z };
    }
    const d = p.dr; foe.zh = Math.max(foe.zh || 0, 0.2); foe.vx = foe.vy = foe.vz = 0;
    if (part === 'Dragon_Rush_Pt3') {                                    // la patada: sube y se aleja un poco
      foe.x = d.fx + d.nx * 1.2 * e; foe.z = d.fz + d.nz * 1.2 * e; foe.y = Math.min(VS.TOP || 99, d.fy + 3.2 * e);
    } else {                                                             // el golpe final: vuela hasta él
      const g = Math.min(1, k / 0.7), q = 1 - (1 - g) * (1 - g);
      f.x = d.ax + (foe.x - d.nx * 1.1 - d.ax) * q; f.z = d.az + (foe.z - d.nz * 1.1 - d.az) * q; f.y = d.ay + (foe.y - d.ay) * q;
    }
  }
  /** Los dos en la embestida del Dragon Rush y se tocan: duelo de puñetazos (su parte 2 a la vez) y salen despedidos */
  drClash(f, foe) {
    const a = f.sp, b = foe.sp;
    for (const [x, p] of [[f, a], [foe, b]]) { const i = p.S.H.findIndex((q) => q[0] === 'Dragon_Rush_Pt2'); if (i < 0) return; p.seq = p.S.H; p.si = i; p.pt = 0; p.clash = 1; if (p.z) { p.z.g.DISPUTA_DE_SOCOS = 1; p.z.rate = 1; } }
    const dx = foe.x - f.x, dz = foe.z - f.z, h = Math.hypot(dx, dz) || 1, mx = (f.x + foe.x) / 2, mz = (f.z + foe.z) / 2, my = Math.max(f.y, foe.y);
    f.x = mx - dx / h * 1.1; f.z = mz - dz / h * 1.1; foe.x = mx + dx / h * 1.1; foe.z = mz + dz / h * 1.1; f.y = foe.y = my;
    this.emit('clashDR', { x: mx, y: my + 1.6, z: mz });
  }
  stepSpec(f, foe) {
    const p = f.sp, dt = VS_DT; if (!p || this.phase !== 'fight') { f.set('idle'); return; }
    p.pt += dt * (p.z ? p.z.rate : 1); p.tt += dt;
    if (p.S.k === 'dr') {
      if (p.clash) {                                                     // duelo de puñetazos: chispas y, al acabar, los dos salen despedidos hacia arriba
        if (p.tt % 0.2 < VS_DT) this.emit('zHit', { i: f.i, x: (f.x + foe.x) / 2, y: f.y + 1.6, z: (f.z + foe.z) / 2, col: f.def.col, sp: 1 });
        if (p.pt >= p.seq[p.si][1]) { f.sp = null; f.set('launched'); f.stun = 0.45; f.vy = 14.5; f.y = Math.max(f.y, 0.05); const h = Math.hypot(foe.x - f.x, foe.z - f.z) || 1; f.vx = -(foe.x - f.x) / h * 4; f.vz = -(foe.z - f.z) / h * 4; }
        return;
      }
      if (p.seq === p.S.P && foe.st === 'spec' && foe.sp && foe.sp.S.k === 'dr' && foe.sp.seq === foe.sp.S.P && Math.hypot(foe.x - f.x, foe.z - f.z) < VS.REACH + 0.6 && Math.abs(foe.y - f.y) < 2.4) { this.drClash(f, foe); return; }
      if (p.seq === p.S.P) {                                             // la embestida: se acerca (en el original solo conecta de cerca)
        const tx = foe.x - f.x, ty = foe.y - f.y, tz = foe.z - f.z, td = Math.hypot(tx, ty, tz) || 1;
        if (td > 1.8 && td < VS.DR.reach) { const k = VS.DR.lunge * VS_DT / td; f.x += tx * k; f.y += ty * k; f.z += tz * k; }
      }
    }
    const drp = p.S.k === 'dr' && p.seq !== p.S.P ? p.seq[p.si][0] : '';
    if (p.z) p.z.drm = drp === 'Dragon_Rush_Pt3' || drp === 'Dragon_Rush_Pt4';
    if (p.z) { if (this.zcTick(f, foe, p) || !f.sp) return; }           // la lógica del original manda (puede cambiar de parte o acabar)
    if (p.z && p.z.drm && foe.st !== 'ko') this.drMove(f, foe, p, drp);
    const S = p.S, P = p.seq[p.si], ZG = !(p.z && (p.z.info.melee || p.z.info.guard));   // ZG: golpe genérico de su tipo (si el original no pega él mismo)
    const tx = foe.x - f.x, ty = foe.y - f.y, tz = foe.z - f.z, th = Math.hypot(tx, tz) || 0.001, td = Math.hypot(th, ty) || 0.001, nx = tx / th, nz = tz / th;
    const atRel = p.seq === S.P && (p.si > S.rel[0] || (p.si === S.rel[0] && p.pt >= S.rel[1]));
    f.vx = f.vy = f.vz = 0;
    if (ZG && S.k === 'rush' && p.seq === S.P && !p.res) {                     // embestida: vuela hacia él hasta tocarlo
      if (td > 2.2) { const v = 40; f.vx = tx / td * v; f.vy = ty / td * v; f.vz = tz / td * v; }
      if (td < VS.REACH + 0.4) {
        const left = p.seq.slice(p.si).reduce((a, q) => a + q[1], 0) - p.pt;
        const r = this.hit(f, foe, { dmg: VS.SPEC.rush, stun: Math.max(0.5, left + 0.25), kb: 1, gbreak: 45, heavy: true, fz: 6 }, nx, nz);
        if (r === 1) { p.res = 1; this.emit('zHit', { i: f.i, x: foe.x, y: foe.y + 1.5, z: foe.z, col: f.def.col, sp: 1 }); } else if (r) { p.res = 2; }
      } else if (p.tt > 0.75) { p.res = 2; this.emit('zMiss', { i: f.i }); }
      if (p.res === 2) { f.set('stun'); f.stun = 0.3; return; }
    } else if (ZG && S.k === 'rush' && p.res === 1 && foe.st === 'hurt' && td > 2.4) {   // lo va siguiendo mientras le pega
      const k = Math.min(1, dt * 10); f.x += (foe.x - nx * 2 - f.x) * k; f.z += (foe.z - nz * 2 - f.z) * k; f.y += (foe.y - f.y) * k;
    }
    if (ZG && atRel && !p.res && !(p.z && (p.z.kb || p.z.efd))) {   // (si lanza bolas de ki que viajan, aciertan ellas)
      if (S.k === 'beam') {
        const ax = foe.x - f.x, ay = foe.y - f.y, az = foe.z - f.z, along = ax * p.dx + ay * p.dy + az * p.dz;
        const lat = Math.hypot(ax - p.dx * along, ay - p.dy * along, az - p.dz * along), reach = Math.max(6, S.R * 0.056 + 1.4);
        if (along > 0 && along < reach && lat < 2.6 && foe.inv <= 0 && foe.st !== 'ko' && p.z && p.z.info.proj) { p.res = 1; p.z.ph = 1; }   // acierta: el daño y el lanzamiento los hacen sus eventos del original
        else if (along > 0 && along < reach && lat < 2.6 && foe.inv <= 0 && foe.st !== 'ko') {
          p.res = 1; const r = this.hit(f, foe, { dmg: VS.SPEC.beam, stun: 0.9, kb: 26, up: 7, launch: true, heavy: true, gbreak: 60, fz: 6, shot: 1 }, nx, nz);
          if (r === 1) this.emit('zHit', { i: f.i, x: foe.x, y: foe.y + 1.5, z: foe.z, col: f.def.col, sp: 1 });
        } else { p.res = 2; this.emit('zMiss', { i: f.i }); }
      } else if (S.k === 'shot') {
        p.res = 3; const C = VS.CSHOT, oy = 1.7, ay = (foe.y + 1.5) - (f.y + oy), ad = Math.hypot(th, ay) || 1, sp = C.spd;
        const sh = { o: f.i, x: f.x + nx * 1.2, y: f.y + oy, z: f.z + nz * 1.2, vx: tx / ad * sp, vy: ay / ad * sp, vz: tz / ad * sp, life: 1.9, r: 3.2, t: 0, col: f.def.col, chg: 1, pw: 4,
          hs: { dmg: VS.SPEC.shot, stun: 0.85, kb: 24, up: 6, launch: true, heavy: true, gbreak: 60, fz: 5, shot: 1 } };
        this.shots.push(sh); this.emit('shot', { i: f.i, x: sh.x, y: sh.y, z: sh.z, chg: 2 });
      } else if (S.k === 'ctr' && p.si >= p.seq.length - 1 && p.pt >= P[1] * 0.4) {            // contraataque: el golpe sale en su última parte
        p.res = 1; if (td > 3.2) { f.x = foe.x - nx * 2.2; f.z = foe.z - nz * 2.2; f.y = foe.y; }
        if (foe.st === 'stun') foe.set('idle');
        this.hit(f, foe, { dmg: VS.CTR.dmg, stun: 1, kb: 30, up: 9, launch: true, heavy: true, raw: 1, gbreak: 100, fz: 8 }, nx, nz);
        this.emit('zHit', { i: f.i, x: foe.x, y: foe.y + 1.5, z: foe.z, col: f.def.col });
      }
    }
    // avanza la animación
    if (P && p.pt >= Math.max(P[1], P[2] ? 0.5 : 0)) {
      // Como en Construct 2: una animación sin bucle que acaba se queda en su último fotograma hasta que su lógica la cambia
      // (Head Impact: sigue avanzando hasta tocar al rival). Tope de 0,8 s por si esa lógica depende de algo que aquí no existe
      p.fr = /^(hurt|launched|down|stun|guard|held|grabd)$/.test(foe.st) ? 0 : (p.fr || 0) + VS_DT;   // el rival ya está libre: no se espera más
      const zA = p.z && ZE.on() && p.fr < 0.6 && (this.zeAir(p.z) || this.zeBusy(p.z));   // sus efectos siguen en marcha (la lluvia de Energy Combination...)
      if (!P[2] && p.z && this.zcDecides(p.z, P[0]) && p.pt < P[1] + (zA ? 6 : 0.8)) {
        const mv = Math.hypot(f.x - (p.lx === undefined ? f.x : p.lx), f.z - (p.lz === undefined ? f.z : p.lz)) > 1e-3, air = this.shots.some((q) => q.zk && q.zk.z === p.z) || zA;
        p.lx = f.x; p.lz = f.z; if (mv || air || p.pt < P[1] + (p.z.W ? 0.3 : 0.05)) return;   // (con efectos: un momento por si su lógica sigue)   // solo mientras avanza o su proyectil sigue en el aire
      }
      if (p.si < p.seq.length - 1) { p.si++; p.pt = 0; return; }
      if (p.seq === S.P && p.res === 1 && S.H.length) { p.seq = S.H; p.si = 0; p.pt = 0; return; }
      if (p.seq === S.P && p.res === 2 && S.E.length) { p.seq = S.E; p.si = 0; p.pt = 0; return; }
      this.endSpec(f, foe, nx, nz);
    }
    if (p.tt > 7) this.endSpec(f, foe, nx, nz);                         // red de seguridad
  }
  endSpec(f, foe, nx, nz) {
    const p = f.sp, S = p.S; f.sp = null; this.zcEnd(f, foe, p);
    if (nx === undefined) { const h = Math.hypot(foe.x - f.x, foe.z - f.z) || 1; nx = (foe.x - f.x) / h; nz = (foe.z - f.z) / h; }
    const zm = p.z && (p.z.info.melee || p.z.info.guard);               // con la lógica del original, ni remate ni potenciador genéricos
    if (!zm && S.k === 'rush' && p.res === 1 && foe.st === 'hurt' && Math.hypot(foe.x - f.x, foe.y - f.y, foe.z - f.z) < 5) {   // remate
      foe.stun = 0; this.hit(f, foe, { dmg: VS.SPEC.rushEnd, stun: 0.9, kb: 28, up: 8, launch: true, heavy: true, gbreak: 60, fz: 7 }, nx, nz);
    }
    if (S.k === 'buff' && !zm) { f.sb = VS.SPEC.buffT; this.emit('sBuff', { i: f.i, x: f.x, y: f.y + 1.6, z: f.z, col: f.def.col }); }
    f.set('idle');
  }
  /** Contraataque: con animación de Z Legends 3 la hace entera y pega al final; sin ella aparece a su espalda con un golpe fuerte */
  ctrHit(f, foe) {
    const T = vsZTab(f.def), K = T && T.K;
    this.freeze = Math.max(this.freeze, 8); f.inv = 0.2;
    this.emit('ctr', { i: f.i, x: f.x, y: f.y + 1.6, z: f.z, col: f.def.col, name: K ? K.n : 'CONTRAATAQUE' });
    if (K) {
      const dur = K.P.reduce((a, q) => a + q[1], 0); foe.set('stun'); foe.stun = dur + 0.5; foe.vx = foe.vy = foe.vz = 0; f.inv = dur + 0.2;
      f.set('spec'); f.sp = { S: Object.assign({}, K, { k: 'ctr', rel: [0, 0] }), seq: K.P, si: 0, pt: 0, tt: 0, res: 0, dx: 0, dy: 0, dz: 0 };
    } else { foe.set('stun'); foe.stun = 0.5; this.counter(f, foe); f.set('heavy'); f.bo = 1; }
  }
  /** Contraataque tras una esquiva perfecta: aparece a la espalda del rival y su golpe pega más */
  counter(f, foe) {
    const dx = foe.x - f.x, dz = foe.z - f.z, h = Math.hypot(dx, dz) || 1; f.ctr = 0; f.bo = 1; f.t = 0;
    this.emit('vanish', { i: f.i, x: f.x, y: f.y, z: f.z });
    let x = foe.x + dx / h * 2.2, z = foe.z + dz / h * 2.2; if (Math.hypot(x, z) > VS.R - 0.5) { x = foe.x - dx / h * 2.2; z = foe.z - dz / h * 2.2; }
    f.x = x; f.z = z; f.y = foe.y; f.vx = f.vy = f.vz = 0; f.inv = 0.12; this.emit('counter', { i: f.i, x, y: f.y, z });
  }
  boost(f, s) {
    if (f.tpb) { f.tpb = 0; s = Object.assign({}, s, { dmg: s.dmg * 1.35 }); this.emit('pas', { i: f.i, k: 'portal', x: f.x, y: f.y + 1.6, z: f.z }); }
    if (!f.bo) return s; f.bo = 0; return Object.assign({}, s, { dmg: s.dmg * VS.DODGE_DMG, stun: s.stun + 0.2, ctr: 1 });
  }
  /** El agarrado se suelta (o los dos agarraban a la vez): se separan sin daño */
  tech(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, h = Math.hypot(dx, dz) || 1;
    for (const [f, k] of [[a, -1], [b, 1]]) { f.set('stun'); f.stun = 0.28; f.vx = dx / h * 11 * k; f.vz = dz / h * 11 * k; f.vy = 0; }
    this.emit('tech', { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 1.6, z: (a.z + b.z) / 2 });
  }
  /** Teletransporte: aparece al otro lado del rival. En mitad de un combo que recibes cuesta más (es la escapatoria) */
  vanish(f, foe, cost) {
    f.ki -= cost; const dx = foe.x - f.x, dz = foe.z - f.z, h = Math.hypot(dx, dz) || 1;
    this.emit('vanish', { i: f.i, x: f.x, y: f.y, z: f.z });
    f.x = foe.x + dx / h * 2.4; f.z = foe.z + dz / h * 2.4; f.y = foe.y; f.vx = f.vy = f.vz = 0; f.inv = 0.22; f.stun = 0;
    const r = Math.hypot(f.x, f.z); if (r > VS.R - 0.5) { f.x = foe.x - dx / h * 2.4; f.z = foe.z - dz / h * 2.4; }
    if (f.pas === 'portal') f.tpb = 1;                                   // Brecha dimensional: el siguiente golpe pega más
    f.set('idle'); this.emit('appear', { i: f.i, x: f.x, y: f.y, z: f.z });
  }

  /* ---------------- Daño ---------------- */
  /** big: golpe de los que mandan volando (decide si el K.O. que cierra el combate es un FINAL DESTRUCTIVO) */
  damage(att, def, dmg, big) {
    const ap = att.pas, dp = def.pas;
    if (att.spark > 0) dmg *= VS.SPARK.dmg;                              // Sparking: pega más
    if (ap === 'orgullo' && att.hp < att.hpMax * 0.35) dmg *= 1.18;      // Orgullo: con poca vida pega más
    else if (ap === 'rose') dmg *= 1 + 0.2 * (1 - att.hp / att.hpMax);   // cuanto más daño lleva encima, más pega
    else if (ap === 'zenkai') dmg *= 1 + 0.04 * att.zk;
    else if (ap === 'copia') dmg *= 1 + 0.01 * att.cp;                   // Células perfectas: aprende de lo que recibe
    else if (ap === 'furia' && att.ki >= 100) dmg *= 1.2;                // Berserker: con el ki lleno pega más
    if (att.wk > 0) dmg *= 0.8;                                         // debilitado por el Rayo caramelo
    if (att.sb > 0) dmg *= VS.SPEC.buffK;                               // potenciado por un especial
    if (dp === 'blindaje') dmg *= 0.88;
    else if (dp === 'divino' && (this.ult || this.clash || this._shot)) dmg *= 0.82;   // Justicia divina: el ki le hace menos
    else if (dp === 'copia') def.cp = Math.min(15, def.cp + 1);
    def.hp = Math.max(this.o.noKO ? 1 : 0, def.hp - dmg); def.flash = 0.1; def.lh = 0;
    if (def.hp <= 0 && dp === 'inmortal' && !def.im) { def.im = 1; def.hp = 1; this.emit('pas', { i: def.i, k: 'inmortal', x: def.x, y: def.y + 1.6, z: def.z }); }   // una vez por combate no cae
    if (ap === 'parasito') att.hp = Math.min(att.hpMax, att.hp + dmg * 0.12);          // roba vida con cada golpe
    if (dp === 'senzu' && !def.pu && def.hp > 0 && def.hp < def.hpMax * 0.25) { def.pu = 1; def.hp += def.hpMax * 0.22; this.emit('pas', { i: def.i, k: 'senzu', x: def.x, y: def.y + 1.6, z: def.z }); }   // una judía por ronda
    att.ki = Math.min(100, att.ki + dmg * 0.07 * (ap === 'fusion' ? 1.4 : 1)); def.ki = Math.min(100, def.ki + dmg * 0.035 * (dp === 'fusion' ? 1.4 : 1)); att.gain(dmg * VS.TR_DEAL * (ap === 'salvaje' ? 1.35 : 1)); def.gain(dmg * VS.TR_TAKE * (dp === 'ira' ? 1.5 : 1));
    att.cmb++; att.cmbT = 1.3; att.cmbDmg += dmg; this.emit('dmg', { i: def.i, dmg, cmb: att.cmb, tot: att.cmbDmg });
    if (def.hp <= 0 && def.st !== 'ko' && def.nextAlive() >= 0) {        // equipos: cae uno, pero le quedan compañeros
      def.team[def.ti].hp = 0; def.set('ko'); this.tag = { who: def.i, t: 0, to: def.nextAlive() }; this.freeze = 16; this.shots.length = 0; this.ult = null; this.clash = null;
      this.emit('memberKo', { w: att.i, i: def.i, x: def.x, y: def.y + 1.5, z: def.z });
      return true;
    }
    if (def.hp <= 0 && def.st !== 'ko') {
      def.set('ko'); this.phase = 'ko'; this.pt = 0; this.ko = att.i; this.freeze = 16; this.shots.length = 0;
      this.emit('ko', { w: att.i, x: def.x, y: def.y + 1.5, z: def.z });
      if (dp === 'kamikaze' && att.hp > 1 && Math.hypot(att.x - def.x, att.y - def.y, att.z - def.z) < 8) { att.hp = Math.max(1, att.hp - 140); att.flash = 0.2; this.emit('pas', { i: def.i, k: 'kamikaze', x: def.x, y: def.y + 1.5, z: def.z }); }   // estalla al caer (no puede noquear)
      if (att.wins + 1 >= this.rounds && (big || this.ult)) {             // el K.O. que cierra el combate, con un golpe fuerte o una Ultimate: sale despedido contra las montañas
        const dx = def.x - att.x, dz = def.z - att.z, h = Math.hypot(dx, dz) || 1; this.df = 1; this.emit('final', { w: att.i, x: def.x, y: def.y + 1.5, z: def.z, dx: dx / h, dz: dz / h });
      }
      return true;
    }
    return false;
  }
  /** Golpe cuerpo a cuerpo o proyectil. Devuelve: 0 nada · 1 conecta · 2 bloqueado · 3 contraataque (guardia perfecta) */
  hit(att, def, s, nx, nz) {
    if (def.st === 'dash' && def.inv > 0 && !(def.ctr > 0)) { def.ctr = VS.DODGE; def.ki = Math.min(100, def.ki + 8); this.emit('dodge', { i: def.i, x: def.x, y: def.y + 1.6, z: def.z }); this.learn(def); }   // esquiva perfecta: tiene un contraataque
    if (def.st === 'spec' && def.sp && def.sp.z && def.sp.z.v.A[24] && def.inv <= 0) {   // postura de contraataque del original (se está defendiendo): el golpe la dispara
      const z = def.sp.z; z.gh = z.n; this.freeze = Math.max(this.freeze, 4); this.emit('guard', { i: def.i, x: def.x, y: def.y + 1.6, z: def.z }); return 2;
    }
    if (def.inv > 0 || def.st === 'ko' || def.st === 'held' || def.st === 'grabd') return 0;
    if (def.st === 'ctrw' && !s.shot && !s.raw && this.phase === 'fight') { this.ctrHit(def, att); return 3; }   // esperaba el golpe: contraataca
    const px = def.x - nx * 0.6, py = def.y + 1.6, pz = def.z - nz * 0.6;
    if (def.pas === 'armadura' && def.st === 'heavy' && def.t < 0.3 && !s.heavy && !s.raw) {     // Superarmadura: preparando el golpe fuerte, los golpes flojos no le cortan
      this.emit('pas', { i: def.i, k: 'armadura', x: px, y: py, z: pz }); this.freeze = Math.max(this.freeze, 3); this.damage(att, def, s.dmg * att.pow * 0.7); return 1;
    }
    if (def.st === 'guard') {
      if (s.shot && !s.raw && def.pas === 'absorbe') { def.ki = Math.min(100, def.ki + 12); this.emit('pas', { i: def.i, k: 'absorbe', x: px, y: py, z: pz }); return 2; }   // Absorción: el ki bloqueado se lo queda
      if (def.t < VS.PARRY * (def.pas === 'tiempo' ? 2 : 1) && !s.shot && !s.raw) {                                // guardia perfecta: el atacante queda vendido
        att.set('stun'); att.stun = 0.75; att.vx = -nx * 6; att.vz = -nz * 6; def.ki = Math.min(100, def.ki + 12); this.freeze = 8; this.learn(def);
        this.emit('parry', { i: def.i, x: px, y: py, z: pz }); return 3;
      }
      def.gm -= (s.gbreak || 12) * (att.pas === 'espada' ? 1.8 : 1) * (def.pas === 'muralla' ? 0.5 : 1); def.vx = nx * (s.kb || 3) * 0.4; def.vz = nz * (s.kb || 3) * 0.4;
      if (def.pas !== 'muralla') this.damage(att, def, s.dmg * att.pow * 0.12); att.cmb = 0;   // Muralla: en guardia no recibe daño
      if (def.gm <= 0) { def.gm = 60; def.set('stun'); def.stun = att.pas === 'piedra' ? 1.8 : 1.15; this.freeze = 8; this.emit('break', { i: def.i, x: px, y: py, z: pz }); }
      else this.emit('guard', { i: def.i, x: px, y: py, z: pz });
      return 2;
    }
    if (def.pas === 'vision' && !def.vis && !s.raw && this.phase === 'fight') {   // Visión del futuro: el primer golpe de la ronda lo esquiva solo
      def.vis = 1; def.inv = 0.35; def.ctr = VS.DODGE; this.emit('dodge', { i: def.i, x: def.x, y: def.y + 1.6, z: def.z }); this.emit('pas', { i: def.i, k: 'vision', x: def.x, y: def.y + 1.6, z: def.z }); return 0;
    }
    const scale = s.raw || att.pas === 'infantil' ? 1 : Math.max(0.4, 1 - 0.07 * att.cmb);   // los combos largos pegan cada vez menos (las Ultimates no: raw; Energía inagotable tampoco)
    let mul = 1;
    if (att.pas === 'elite' && !att.el && !s.raw) { att.el = 1; mul = 2; this.emit('pas', { i: att.i, k: 'elite', x: px, y: py, z: pz }); }   // Guerrero de élite: el primer golpe de la ronda
    const gom = def.pas === 'goma' && s.heavy && !s.shot && !s.raw; if (gom) mul *= 0.7;   // Cuerpo de goma: los golpes fuertes rebotan
    this.emit('hit', { i: def.i, x: px, y: py, z: pz, heavy: !!s.heavy, rush: s.rush, col: att.def.col, nx, nz, up: s.up > 10 ? 1 : s.up < 0 ? -1 : 0 });
    this.freeze = Math.max(this.freeze, s.fz !== undefined ? s.fz : s.heavy ? 10 : 3);   // pausa de impacto: los golpes fuertes «pesan» más
    const air = def.st === 'launched' && !s.raw;                        // ya estaba en el aire: combo aéreo
    this._shot = !!s.shot; const ko = this.damage(att, def, s.dmg * att.pow * scale * mul, !!(s.heavy && s.launch)); this._shot = false;
    if (ko) { def.vx = nx * 20; def.vz = nz * 20; def.vy = 11; return 1; }
    if (s.weak && def.st !== 'ko') { if (!(def.wk > 0)) this.emit('pas', { i: att.i, k: 'caramelo', x: px, y: py, z: pz }); def.wk = 4; }
    if (att.pas === 'frio' && s.heavy && !s.shot && !s.raw) { if (!(def.slow > 0)) this.emit('pas', { i: att.i, k: 'frio', x: px, y: py, z: pz }); def.slow = 2; }
    if (def.pas === 'justicia' && s.shot && !s.heavy && !s.raw) return 1;   // Cuerpo de la justicia: el ki rápido no le interrumpe
    if (gom) { const r = this.react(def, s, nx, nz, air); def.vx *= 0.35; def.vz *= 0.35; def.vy *= 0.6; return r; }
    return this.react(def, s, nx, nz, air);
  }
  /** Aprendiz: cada guardia o esquiva perfecta llena la barra de transformación */
  learn(f) { if (f.pas === 'aprendiz' && f.fi < f.chain.length - 1) { f.tm = Math.min(100, f.tm + 25); this.emit('pas', { i: f.i, k: 'aprendiz', x: f.x, y: f.y + 1.6, z: f.z }); } }
  /** Cómo reacciona el que recibe un golpe que conecta (en el aire o en el suelo) */
  react(def, s, nx, nz, air) {
    const px = def.x - nx * 0.6, py = def.y + 1.6, pz = def.z - nz * 0.6, att = this.f[1 - def.i];
    if (air) {
      def.jug++; def.spk = 0;
      if (s === VS.HEAVY || (s.heavy && s.ctr && !s.upper && !s.shot)) {   // golpe fuerte: lo estrella contra el suelo
        if (def.y > 1.2) { def.set('launched'); def.stun = 1.2; def.vx = nx * 5; def.vz = nz * 5; def.vy = -44; def.spk = att.i + 1; this.emit('spike', { i: def.i, x: px, y: py, z: pz }); }
        else { def.set('launched'); def.stun = s.stun; def.vx = nx * s.kb; def.vz = nz * s.kb; def.vy = s.up || 0; }
      } else if (s.launch) { def.set('launched'); def.stun = s.stun; def.vx = nx * s.kb; def.vz = nz * s.kb; def.vy = s.up || 0; }
      else { def.set('launched'); def.stun = 0.62; def.vx = nx * 1.5; def.vz = nz * 1.5; def.vy = 7; }   // cada golpe lo mantiene flotando
      if (def.jug === 3) this.emit('juggle', { i: att.i });
      if (def.jug >= VS.JUG_MAX) def.inv = 0.9;                         // límite del combo aéreo
      return 1;
    }
    if (s.launch) { def.set('launched'); def.stun = s.stun; def.vx = nx * s.kb; def.vz = nz * s.kb; def.vy = s.up || 0; }
    else { def.set('hurt'); def.stun = s.stun; def.vx = nx * s.kb; def.vz = nz * s.kb; def.vy *= 0.3; }
    return 1;
  }
  stepShots() {
    const dt = VS_DT;
    for (let k = this.shots.length - 1; k >= 0; k--) {
      const s = this.shots[k]; if (!s) continue;                        // un K.O. vacía la lista a mitad de recorrido
      const def = this.f[1 - s.o], att = this.f[s.o]; s.t += dt; s.life -= dt;
      if (s.big) { if (this.stepBomb(s, att, def)) this.shots.splice(k, 1); continue; }
      if (s.cd > 0) s.cd -= dt;
      if (s.t < (s.hm || 0.5) && s.t >= (s.hold || 0)) {                // persigue un poco al principio (los discos, mucho más: hm, tr)
        const dx = def.x - s.x, dy = def.y + 1.5 - s.y, dz = def.z - s.z, d = Math.hypot(dx, dy, dz) || 1, sp = s.sp || Math.hypot(s.vx, s.vy, s.vz), k2 = (s.tr || 3) * dt;
        s.vx += (dx / d * sp - s.vx) * k2; s.vy += (dy / d * sp - s.vy) * k2; s.vz += (dz / d * sp - s.vz) * k2;
      }
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      if (s.disc && s.y < 0.5) { s.y = 0.5; s.vy = Math.abs(s.vy); }      // los discos rozan el suelo, no se clavan
      const d = Math.hypot(def.x - s.x, def.y + 1.5 - s.y, def.z - s.z);
      if (s.defl) { s.vy -= 8 * dt; if (s.life <= 0 || s.y < 0.3) { this.emit('pop', { x: s.x, y: Math.max(0.2, s.y), z: s.z, col: s.col }); this.shots.splice(k, 1); } continue; }   // desviado: sale volando y ya no hace daño
      if (d < s.r + 0.6 && !(s.cd > 0) && s.hs && s.hs.raw && def.st === 'guard' && def.t < VS.PARRY_ULT && def.inv <= 0) {
        this.deflectShot(s, def); this.parryUlt(att, def, s.x, s.y, s.z); continue;                                    // proyectil de Ultimate con la guardia justa: desviado
      }
      if (d < s.r + 0.6 && !(s.cd > 0)) {
        const h = Math.hypot(s.vx, s.vz) || 1;
        if (s.zk) {                                                     // objeto de una técnica del original: avisa de que ha tocado
          const z = s.zk.z, live = att.sp && att.sp.z === z; (z.shotHit || (z.shotHit = {}))[s.zk.k] = 1;
          if (z.dd || (s.zk.own && live)) { this.emit('pop', { x: s.x, y: s.y, z: s.z, col: s.col }); this.shots.splice(k, 1); continue; }   // el daño lo ponen sus eventos (o ya lo han puesto)
        }
        if (this.hit(att, def, s.hs || Object.assign({ shot: 1 }, VS.SHOT), s.vx / h, s.vz / h)) {
          this.emit('pop', { x: s.x, y: s.y, z: s.z, col: s.col });
          if (s.pierce > 1) { s.pierce--; s.cd = 0.4; } else { this.shots.splice(k, 1); continue; }                // el disco gigante atraviesa y vuelve
        }
      }
      if (s.life <= 0 || s.y < 0 || Math.hypot(s.x, s.z) > VS.R + 6) { this.emit('pop', { x: s.x, y: Math.max(0.2, s.y), z: s.z, col: s.col }); this.shots.splice(k, 1); }
    }
    // Choque de ki: los proyectiles de un bando y del otro se anulan; gana el más fuerte (pw) y sigue, debilitado
    const S = this.shots;
    for (let a = S.length - 1; a > 0; a--) {
      const A = S[a]; if (A.dead) continue;
      for (let b = a - 1; b >= 0; b--) {
        const B = S[b]; if (B.dead || B.o === A.o || (A.big && B.big)) continue;
        if (Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z) > A.r + B.r) continue;
        const pa = A.big ? 99 : A.pw || 1, pb = B.big ? 99 : B.pw || 1, w = pa >= pb ? A : B, l = w === A ? B : A;
        this.emit('clash', { x: l.x, y: l.y, z: l.z, col: A.col, col2: B.col, big: !w.big && Math.max(pa, pb) > 1 ? 1 : 0 });
        l.dead = true; if (pa === pb) w.dead = true; else if (!w.big) w.pw = Math.max(pa, pb) - Math.min(pa, pb);
        if (A.dead) break;
      }
    }
    for (let k = S.length - 1; k >= 0; k--) if (S[k].dead) S.splice(k, 1);
    for (let k = this.blasts.length - 1; k >= 0; k--) {                 // explosiones retardadas de las Ultimates superiores
      const b = this.blasts[k]; if ((b.t -= dt) > 0) continue;
      this.blasts.splice(k, 1); this.emit('boom', { x: b.x, y: 1.5, z: b.z, col: b.col, big: b.big, lite: b.sky === 1, pil: b.pil });
      const def = this.f[1 - b.o], dx = def.x - b.x, dz = def.z - b.z, h = Math.hypot(dx, dz) || 1;
      if (b.r && Math.hypot(h, b.tall ? 0 : def.y) < b.r && def.st !== 'ko' && def.inv <= 0) {
        if (b.raw) this.hit(this.f[b.o], def, { dmg: b.dmg, raw: 1, stun: b.stun || 0.8, kb: b.kb === undefined ? 14 : b.kb, up: b.up === undefined ? 13 : b.up, launch: !!b.launch, heavy: !!b.heavy, gbreak: b.gbreak || 40, fz: b.fz, shot: 1 }, dx / h, dz / h);
        else this.hit(this.f[b.o], def, { dmg: b.dmg, stun: 0.8, kb: 14, up: 13, launch: true, heavy: true, gbreak: 40, shot: 1 }, dx / h, dz / h);
      }
    }
  }

  /* ---------------- Transformación ----------------
     Con la barra llena el luchador sube a su siguiente forma. Mientras dura (TR_CINE) el mundo está parado y él es
     intocable; en TR_SWAP cambia de forma y la onda expansiva aparta al rival. Cada forma pega más, corre más y
     cambia su Ultimate por la versión superior de su familia. */
  /** Relevo tras caer un miembro: cuando ha caído, entra el siguiente (Change_Pt1..3 del original) a distancia del rival */
  stepTag() {
    const g = this.tag, f = this.f[g.who], foe = this.f[1 - g.who]; g.t += VS_DT;
    if (!g.in && g.t >= VS.TAG.ko) {
      g.in = 1; f.loadMember(g.to); const dx = f.x - foe.x, dz = f.z - foe.z, h = Math.hypot(dx, dz) || 1;
      let x = foe.x + dx / h * 11, z = foe.z + dz / h * 11; const r = Math.hypot(x, z); if (r > VS.R - 2) { x *= (VS.R - 2) / r; z *= (VS.R - 2) / r; }
      f.x = x; f.z = z; f.y = 0; f.vx = f.vy = f.vz = 0; f.inv = 99; f.set('tagin');
      const zid = /^z_/.test(f.def.sheet || '') ? f.def.sheet.slice(2) : null, D = zid && typeof ZMoves !== 'undefined' && ZMoves.D[zid];
      f.tinT = D && D.a.Change_Pt1 ? ['Change_Pt1', 'Change_Pt2', 'Change_Pt3'].reduce((s, n) => s + (D.a[n] ? D.a[n].f.reduce((q, k) => q + (k[7] || 1), 0) / (D.a[n].fps || 12) : 0), 0) + 0.25 : VS.TAG.in;
      if (foe.st === 'ko' || foe.st === 'launched' || foe.st === 'down') { foe.set('idle'); } foe.vx = foe.vy = foe.vz = 0;
      this.emit('tagIn', { i: f.i, x: f.x, y: f.y + 1.6, z: f.z, col: f.def.col, ko: 1 });
    }
    if (g.in && f.st !== 'tagin') this.tag = null;
  }
  /** Sparking (Z Legends 3): su animación y, al acabar, 14 s de golpes más fuertes. Mientras se activa no le pueden tocar */
  startSpark(f) {
    f.spkUsed = 1; f.vx = f.vy = f.vz = 0; f.inv = 99; f.set('sparking');
    const zid = /^z_/.test(f.def.sheet || '') ? f.def.sheet.slice(2) : null, D = zid && typeof ZMoves !== 'undefined' && ZMoves.D[zid], A = D && D.a.Sparking;
    f.spkT = A ? A.f.reduce((s, g) => s + (g[7] || 1), 0) / (A.fps || 12) : VS.SPARK.anim;
    this.emit('spark', { i: f.i, x: f.x, y: f.y + 1.6, z: f.z, col: f.def.col });
  }
  startTrans(f) {
    const nd = f.chain[f.fi + 1]; f.vx = f.vy = f.vz = 0; f.inv = 99; f.tm = 0; f.set('trans');
    this.tr = { who: f.i, t: 0, sw: false, y1: Math.max(f.y, 1.3), end: VS.TR_CINE + (nd.trX || 0), swapAt: VS.TR_SWAP };   // trX: la forma nueva tiene intro y la escena dura un poco más
    const X = typeof window !== 'undefined' && window.ZMOVE_X && ZMOVE_X[nd.id + '/' + (nd.form0 || nd.form)];   // transformación animada de Z Legends 3: dura lo que ella y cambia de forma al acabar
    if (X) { const d = X[1].reduce((a, q) => a + q[1], 0); Object.assign(this.tr, { zx: X, swapAt: d, end: d + 0.75 }); }
    this.emit('trStart', { i: f.i, col: nd.col, name: nd.form, dur: this.tr.end, sw: this.tr.swapAt });
  }
  stepTrans() {
    const r = this.tr, f = this.f[r.who], foe = this.f[1 - r.who]; r.t += VS_DT; f.t += VS_DT;
    f.y += (r.y1 - f.y) * 0.04;                                         // se eleva un poco mientras concentra la energía
    if (!r.sw && r.t >= r.swapAt) {
      r.sw = true; f.fi++; f.def = f.chain[f.fi]; f.pow = f.def.pow; f.spd = f.def.spd;
      f.hp = Math.min(f.hpMax, f.hp + f.hpMax * 0.1); f.ki = Math.max(f.ki, 50);
      this.emit('trSwap', { i: f.i, x: f.x, y: f.y, z: f.z });
      const dx = foe.x - f.x, dz = foe.z - f.z, h = Math.hypot(dx, dz) || 1;
      if (Math.hypot(h, foe.y - f.y) < 16 && foe.st !== 'ko') { foe.set('launched'); foe.stun = 0.6; foe.vx = dx / h * 24; foe.vz = dz / h * 24; foe.vy = 6; foe.cmbT = 0.01; }
    }
    if (r.t >= r.end) { f.inv = 0.5; f.set('idle'); this.tr = null; this.emit('trEnd', { i: f.i }); }
  }

  /* ---------------- Ultimates ----------------
     Quince coreografías (type), cada una con tres variantes (v = 0, 1, 2). Qué Ultimate tiene cada forma de cada
     guerrero está en versus/ults.js. ph 0 = presentación (mundo parado, cámara de cine) · ph 1 = ejecución.
       beam   rayo: recto · desde lo alto barriendo hacia abajo · gigante con cadena de explosiones
       rush   lluvia de golpes: estampa contra el suelo · meteoro desde el cielo · puño que atraviesa
       bomb   esfera: grande · enorme con anillo de explosiones · tres seguidas
       storm  lluvia de ki del cielo: dispersa · con gran impacto final · anillos que se cierran
       discs  discos teledirigidos: en abanico · rodean y convergen · uno gigante que vuelve
       slash  cortes atravesando al rival: con cruz final · con tajo desde el cielo · todos estallan a la vez
       rift   grieta por el suelo que acaba en pilar: una · tres en abanico · cuatro que convergen
       nova   explosión del propio cuerpo (atrae primero): una · doble · enorme a costa de su vida
       grab   agarre (rompe la guardia): sube y estrella · gira y lanza + esfera · explosiones a quemarropa
       volley ráfaga de ki: recta · con disparo final · desde todas direcciones
     u.sup (transformado durante el combate) = +30 % de daño */
  startUlt(f, foe) {
    f.ki = 0; f.vx = f.vy = f.vz = 0; f.inv = 99; f.set('ult');
    const U = f.def.ult, Z = vsZUlt(f.def);
    this.ult = { who: f.i, type: Z ? 'zl3' : U.type, v: U.v || 0, sup: !!U.sup, t: 0, ph: 0, hitT: 0, n: 0, lock: false, y0: f.y, D: 300 * (U.sup ? 1.3 : 1) };
    if (Z) {                                                             // Ultimate de Z Legends 3 (u_zl3)
      const T = window.ZMOVE_T[f.def.sheet.slice(2)], C = T && T.C && T.C.U, ms = C ? C.reduce((a, q) => a + q[4], 0) : 0;
      Object.assign(this.ult, { Z, seq: Z.P, si: 0, pi: 0, pt: 0, zt: 0, res: 0, zid: f.def.sheet.slice(2), kt: 0, cut: ms ? Math.min(VS_ZCUT_MAX, ms / 1000) : 0 });
      this.ult.cut0 = this.ult.cut;                                     // paneles de cinemática: el mundo espera mientras salen
    }
    this.emit('ultStart', { i: f.i, type: U.type, v: this.ult.v, sup: this.ult.sup, name: Z && Z.n && Z.n !== 'ULTIMATE' ? Z.n : U.name, col: f.def.col });
    if (this.canClash(foe)) { this.ult.cw = 1; this.emit('counterWin', { i: foe.i, dur: VS.CLASH.win }); }   // el rival tiene la barra llena: puede responder
  }

  /* ---------------- Choque de Ultimates ---------------- */
  /** Ultimate desviada con la guardia justa: el que la desvía gana ki y un instante de invulnerabilidad */
  parryUlt(att, def, x, y, z) {
    def.ki = Math.min(100, def.ki + 20); def.inv = Math.max(def.inv, 0.35); def.gm = 100; this.freeze = Math.max(this.freeze, 10);
    this.emit('ultParry', { i: def.i, by: att.i, x, y, z, col: att.def.col });
  }
  /** ¿Puede este luchador responder a una Ultimate con la suya? */
  canClash(d) { return this.phase === 'fight' && !this.o.noClash && d.ki >= 100 && !['ko', 'held', 'grabd', 'launched', 'down'].includes(d.st); }
  /** Durante la presentación de la Ultimate: si el rival pulsa la suya a tiempo, empieza el choque */
  tryClash(cmd) {
    const u = this.ult, d = this.f[1 - u.who], c = cmd[d.i], b = c ? c.b : 0, pr = (b & ~d.pb) | d.pend; d.pb = b; d.pend = 0;
    if (u.t > VS.CLASH.win) { u.cw = 0; this.emit('counterOff', { i: d.i }); return false; }
    if (!(pr & VB.ULT) || !this.canClash(d)) return false;
    this.startClash(this.f[u.who], d); return true;
  }
  /** Los dos frente a frente, a media altura, y las dos Ultimates se encuentran en el centro */
  startClash(A, B) {
    const C = VS.CLASH, a = this.f[0], b = this.f[1], dx = b.x - a.x, dz = b.z - a.z, h = Math.hypot(dx, dz) || 1, L = Math.max(11, Math.min(18, h));
    const nx = dx / h, nz = dz / h, y = Math.max(1.6, Math.min(VS.TOP - 4, (a.y + b.y) / 2));
    let mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2; const r = Math.hypot(mx, mz), lim = VS.R - 1.5 - L / 2; if (r > lim) { mx *= lim / r; mz *= lim / r; }
    a.x = mx - nx * L / 2; a.z = mz - nz * L / 2; b.x = mx + nx * L / 2; b.z = mz + nz * L / 2;
    for (const f of this.f) { f.y = y; f.vx = f.vy = f.vz = 0; f.inv = 99; f.stun = 0; f.set('clash'); }
    A.ki = 100; B.ki = Math.min(100, B.ki);                             // las dos salen con la barra llena: lo que se gaste en el pulso sale de ahí
    const U = this.f.map((f) => f.def.ult);
    this.clash = { by: A.i, t: 0, ph: 0, p: 0, w: -1, drv: [0, 0], burn: [0, 0], taps: [0, 0], nx, nz, L, y, mx, mz, sup: U.map((u) => !!u.sup), type: U.map((u) => u.type) };
    this.ult = null; this.shots.length = 0; this.blasts.length = 0;
    this.emit('clashStart', { by: A.i, x: mx, y, z: mz, names: U.map((u) => u.name), types: U.map((u) => u.type) });
  }
  /** Punto donde chocan las dos energías (p > 0: gana el luchador 0 y el punto se acerca al 1) */
  clashPoint() { const k = this.clash, d = k.p * (k.L / 2 - 1.2); return [k.mx + k.nx * d, k.y + 1.7, k.mz + k.nz * d]; }
  stepClash(cmd) {
    const C = VS.CLASH, k = this.clash, dt = VS_DT, pr = [0, 0], held = [0, 0];
    k.t += dt;
    for (let i = 0; i < 2; i++) { const f = this.f[i], b = cmd[i] ? cmd[i].b : 0; pr[i] = (b & ~f.pb) | f.pend; f.pb = b; f.pend = 0; held[i] = b; f.t += dt; }
    if (k.ph === 0) { if (k.t >= C.intro) { k.ph = 1; k.t = 0; this.emit('clashPush'); } return; }
    if (k.ph === 1) {                                                    // el pulso: cada pulsación empuja; con CARGAR KI pulsado, gasta ki y empuja casi el doble
      for (let i = 0; i < 2; i++) {
        const f = this.f[i], tap = pr[i] & (VB.ATK | VB.HEAVY | VB.KI) ? 1 : 0, burn = (held[i] & VB.CHARGE) && f.ki > 0;
        if (burn) f.ki = Math.max(0, f.ki - C.burn * dt); k.burn[i] = burn ? 1 : 0;
        k.drv[i] = k.drv[i] * Math.exp(-C.decay * dt) + tap * (burn ? C.mult : 1) * Math.sqrt(f.pow) * (k.sup[i] ? 1.1 : 1);   // la fuerza del personaje cuenta, pero poco: decide quien machaca
        if (tap) k.taps[i]++;
      }
      k.p = Math.max(-1, Math.min(1, k.p + (k.drv[0] - k.drv[1]) * C.K * dt));
      if (Math.abs(k.p) >= 1 || k.t >= C.push) {
        k.w = Math.abs(k.p) < C.tie ? -1 : k.p > 0 ? 0 : 1; k.ph = 2; k.t = 0; k.p0 = k.p;
        const [x, y, z] = this.clashPoint(); this.emit('clashWin', { w: k.w, x, y, z });
      }
      return;
    }
    if (k.w >= 0) k.p = k.p0 + ((k.w === 0 ? 1.35 : -1.35) - k.p0) * Math.min(1, k.t / (C.out * 0.55));   // la energía ganadora arrolla al otro
    if (k.t >= C.out) this.endClash();
  }
  endClash() {
    const C = VS.CLASH, k = this.clash, [x, y, z] = this.clashPoint(); this.clash = null;
    for (const f of this.f) { f.inv = 0; f.vx = f.vy = f.vz = 0; f.set('idle'); }
    if (k.w < 0) {                                                       // empate: estallan las dos y salen despedidos
      this.emit('boom', { x, y, z, col: this.f[0].def.col, big: 2 });
      for (const f of this.f) { const dx = f.x - x, dz = f.z - z, h = Math.hypot(dx, dz) || 1; this.hit(this.f[1 - f.i], f, { dmg: C.tieDmg, raw: 1, stun: 0.8, kb: 24, up: 10, launch: true, heavy: true, gbreak: 100 }, dx / h, dz / h); }
    } else {
      const W = this.f[k.w], L = this.f[1 - k.w], dx = L.x - W.x, dz = L.z - W.z, h = Math.hypot(dx, dz) || 1;
      this.emit('boom', { x: L.x, y: L.y + 1.5, z: L.z, col: W.def.col, big: 2 });
      this.hit(W, L, { dmg: C.dmg * (k.sup[k.w] ? 1.3 : 1), raw: 1, stun: 1.3, kb: 32, up: 12, launch: true, heavy: true, gbreak: 100 }, dx / h, dz / h);
    }
    this.emit('clashEnd', { w: k.w });
  }
  endUlt(rec) { const f = this.f[this.ult.who], foe = this.f[1 - f.i]; if (foe.st === 'held') foe.set('idle'); f.inv = 0; f.set('stun'); f.stun = rec; this.ult = null; this.emit('ultEnd'); }
  /** Daño directo de una Ultimate (rival agarrado). Si lo noquea, la Ultimate se acaba: devuelve true */
  ultDmg(f, foe, dmg) { if (!this.damage(f, foe, dmg)) return false; this.ult = null; f.inv = 0; f.set('idle'); this.emit('ultEnd'); return true; }
  /** Explosión retardada en el suelo, con aviso. o: {t, r, dmg, big, up, kb, stun, launch, tall, sky, pil} */
  blast(f, x, z, o) {
    const r = Math.hypot(x, z); if (r > VS.R) { x *= VS.R / r; z *= VS.R / r; }
    const b = Object.assign({ o: f.i, x, z, col: f.def.col, big: 1, raw: 1 }, o); this.blasts.push(b);
    this.emit('mark', { x, z, t: b.t, r: b.r, col: b.col, sky: b.sky, pil: b.pil });
  }
  stepUlt() {
    const u = this.ult, dt = VS_DT, f = this.f[u.who], foe = this.f[1 - u.who];
    if (u.type === 'zl3') { u.t += dt; this.u_zl3(u, f, foe); return; }
    u.t += dt;
    let dx = foe.x - f.x, dy = foe.y - f.y, dz = foe.z - f.z, dh = Math.hypot(dx, dz) || 0.001, d = Math.hypot(dh, dy) || 0.001;
    if (u.ph === 0) {
      const k = Math.min(1, u.t / VS.ULT_CINE);
      if (u.type === 'bomb' || u.type === 'storm') f.y = u.y0 + k * Math.max(0, Math.min(u.type === 'bomb' ? 9 : 6, VS.TOP - u.y0 - 4));     // sube mientras se presenta
      else if (u.type === 'rift' || u.type === 'wave') f.y = u.y0 * (1 - k);   // baja al suelo: la grieta y la onda nacen de un golpe en tierra
      else if (u.type === 'spin') f.y = u.y0 + (foe.y - u.y0) * k;        // se pone a la altura del rival
      if (u.t >= VS.ULT_CINE) {
        if (u.type === 'beam' && u.v === 1) {                           // desaparece y reaparece en lo alto, al otro lado del rival
          this.emit('vanish', { i: f.i, x: f.x, y: f.y, z: f.z });
          let px = foe.x + dx / dh * 9, pz = foe.z + dz / dh * 9; if (Math.hypot(px, pz) > VS.R - 1) { px = foe.x - dx / dh * 9; pz = foe.z - dz / dh * 9; }
          f.x = px; f.z = pz; f.y = Math.min(VS.TOP - 0.5, foe.y + 8.5); u.w = 0.42;
          this.emit('appear', { i: f.i, x: f.x, y: f.y, z: f.z });
          dx = foe.x - f.x; dy = foe.y - f.y; dz = foe.z - f.z; dh = Math.hypot(dx, dz) || 0.001; d = Math.hypot(dh, dy) || 0.001;
        }
        if (u.type === 'beam' && u.v === 2) u.w = 0.3;
        u.ph = 1; u.t = 0; u.dx = dx / d; u.dy = dy / d; u.dz = dz / d; u.hx = dx / dh; u.hz = dz / dh;
        if (u.type === 'bomb') {
          const m = u.sup ? 1.15 : 1, col = f.def.col, S = (o) => this.shots.push(Object.assign({ o: f.i, big: 1, x: f.x, y: f.y + 5.5, z: f.z, vx: 0, vy: 0, vz: 0, life: 7, r: 0.5, t: 0, col, wait: 0, off: 0 }, o));
          if (u.v === 0) S({ R: 3.4, sp: 27, dm: 340 * m, AR: 10 });
          else if (u.v === 1) S({ R: 4.9, sp: 33, dm: 350 * m, AR: 13, ring: 1 });
          else for (let i = 0; i < 3; i++) S({ R: 2.3, sp: 37, dm: 135 * m, AR: 7.5, wait: i * 0.42, off: (i - 1) * 5.2 });
        }
        this.emit('ultGo', { i: f.i, type: u.type, v: u.v, sup: u.sup, col: f.def.col });
      }
      return;
    }
    const melee = u.type === 'rush' || u.type === 'slash' || u.type === 'grab' || u.type === 'cage';
    if (foe.st === 'ko' && !melee) { this.endUlt(0.4); return; }
    this['u_' + u.type](u, f, foe, { dx, dy, dz, dh, d });
  }
  /* ---------------- Ultimate de Z Legends 3 ----------------
     La animación manda: u.seq son sus partes [nombre, segundos, bucle] (window.ZMOVE_T, igual en los dos lados del online);
     u.si, u.pt: parte y tiempo dentro de ella (la vista dibuja ese fotograma). Al llegar al momento en que suelta la energía
     (Z.rel) se decide si acierta: rayo (cabe en lo que mide el sprite), zona, aparición junto al rival, proyectil que viaja,
     o embestida (en la parte en bucle se lanza contra él). Si acierta lo atrapa hasta el final y recibe el daño de golpe;
     si falla, sigue la parte de fallo (si la hay) o se corta. Mientras carga, el mundo está parado VS.ULT_CINE como mucho. */
  u_zl3(u, f, foe) {
    const dt = VS_DT, Z = u.Z, relT = Z.P.slice(0, Z.rel[0]).reduce((a, p) => a + p[1], 0) + Z.rel[1];
    if (u.cut > 0) { u.cut -= dt; u.t = 0; return; }                    // paneles de cinemática (la vista los dibuja)
    const SUM = (n) => Z.P.slice(0, n).reduce((a, p) => a + p[1], 0), D0 = Z.fx && Z.fx.d, dashT = D0 ? SUM(D0[0]) + D0[1] : Z.k === 'rush' && Z.lp >= 0 ? SUM(Z.lp) : 99;
    if (u.ph === 0 && (u.t >= Math.min(VS.ULT_CINE, Math.max(0.2, relT - 0.15), dashT))) {   // el mundo vuelve a moverse antes de que salga la energía o se lance: se puede esquivar
      u.ph = 1; u.t = 0; this.emit('ultGo', { i: f.i, type: 'zl3', v: 0, sup: u.sup, col: f.def.col }); }
    const dx = foe.x - f.x, dz = foe.z - f.z, dh = Math.hypot(dx, dz) || 0.001; u.hx = dx / dh; u.hz = dz / dh;
    // avanza la animación
    const P = u.seq[u.si]; u.pt += dt; u.zt += dt;
    const D = Z.fx && Z.fx.d, past = (q) => q && (u.si > q[0] || (u.si === q[0] && u.pt >= q[1]));
    if (D && !u.res && u.seq === Z.P && past(D) && u.dash === undefined) u.dash = 0;   // se lanza contra él (el primer golpe decide)
    if (u.dash !== undefined && !u.res) u.dash += dt;
    const rushing = !u.res && u.seq === Z.P && ((Z.k === 'rush' && u.si === Z.lp) || u.dash !== undefined);
    if (rushing) {                                                         // embestida: vuela hacia él; si lo toca, lo atrapa
      const dy = foe.y + 0.3 - f.y, d = Math.hypot(dh, dy) || 0.001; f.x += dx / d * 55 * dt; f.y = Math.max(0, f.y + dy / d * 55 * dt); f.z += dz / d * 55 * dt;
      if (d < 2.6 && foe.inv <= 0 && foe.st !== 'ko') this.zl3Hit(u, f, foe); else if ((u.dash !== undefined ? u.dash : u.pt) > (u.dash !== undefined ? 0.7 : 1.2)) this.zl3Miss(u, f, foe);
      if (!u.res && u.dash === undefined) return;                        // la embestida en bucle espera a tocarlo; desde d, la animación sigue
    }
    if (!(rushing && u.dash === undefined) && P && u.pt >= Math.max(P[1], P[2] ? 0.6 : 0)) {
      if (u.si < u.seq.length - 1) { u.si++; u.pt = 0; }
      else if (u.seq === Z.P && u.res === 1 && Z.H.length) { u.seq = Z.H; u.si = 0; u.pt = 0; }   // acertó: su remate
      else if (!u.pj) { this.zl3End(u, f, foe); return; }
    }
    // Combo: lo atrapó y lo va persiguiendo por el escenario, golpe a golpe; antes del remate de energía lo despide lejos
    const F = Z.fx && Z.fx.f;
    if (u.res === 1 && u.lock && u.seq === Z.P && F) {
      if (u.si >= F[0] && u.si < F[1]) {
        u.kt -= dt;
        if (u.kt <= 0) {
          u.kt = 0.34; const L = 2.6 + this.rand() * 1.6; let a = Math.atan2(u.hz, u.hx) + (this.rand() - 0.5) * 2.4;
          if (Math.hypot(foe.x + Math.cos(a) * L, foe.z + Math.sin(a) * L) > VS.R * 0.55) a = Math.atan2(-foe.z, -foe.x) + (this.rand() - 0.5) * 1.4;   // cerca del borde: lo manda hacia el centro
          let tx = foe.x + Math.cos(a) * L, tz = foe.z + Math.sin(a) * L; const r = Math.hypot(tx, tz), lim = VS.R - 2; if (r > lim) { tx *= lim / r; tz *= lim / r; }
          u.fx = tx; u.fz = tz; u.fy = Math.max(0, Math.min(VS.TOP - 4, foe.y + (this.rand() - 0.35) * 2.4));
          this.emit('hit', { i: foe.i, x: foe.x, y: foe.y + 1.5, z: foe.z, col: f.def.col, rush: 1 }); this.emit('rushHit', { i: f.i, n: ++u.n }); this.freeze = Math.max(this.freeze, 2);
        }
      } else if (u.si >= F[1] && !u.away && u.si < u.seq.length) {      // el remate: lo aparta para que la energía le llegue
        // en la línea del rayo del sprite: ang grados hacia arriba (Goku UI, Bardock) o hacia abajo (Kefla, que se eleva)
        const g = ((Z.fx.ang || 0) * Math.PI) / 180, L = 9, hl = Math.cos(g) * L, vl = Math.sin(g) * L;
        u.away = 1; let a = Math.atan2(u.hz, u.hx); if (Math.hypot(f.x + u.hx * hl, f.z + u.hz * hl) > VS.R - 1.5) a = Math.atan2(-f.z, -f.x);   // hacia donde hay sitio
        let tx = f.x + Math.cos(a) * hl, tz = f.z + Math.sin(a) * hl; const r = Math.hypot(tx, tz), lim = VS.R - 1.5; if (r > lim) { tx *= lim / r; tz *= lim / r; }
        let fy = f.y + vl; u.ay = f.y;
        if (fy > VS.TOP - 3) { u.ay = f.y - (fy - (VS.TOP - 3)); fy = VS.TOP - 3; }  // sin sitio arriba: baja el atacante
        if (fy < 0) { u.ay = f.y - fy; fy = 0; }                                       // rayo hacia abajo: el atacante sube y el rival queda en el suelo
        u.ay = Math.max(0, u.ay); u.fx = tx; u.fz = tz; u.fy = fy; this.emit('hit', { i: foe.i, x: foe.x, y: foe.y + 1.5, z: foe.z, col: f.def.col }); this.freeze = Math.max(this.freeze, 4);
      }
      if (u.fx !== undefined) {                                          // el rival vuela al sitio del golpe y el atacante lo sigue
        const k = Math.min(1, dt * 16); foe.x += (u.fx - foe.x) * k; foe.z += (u.fz - foe.z) * k; foe.y += (u.fy - foe.y) * k;
        if (!u.away) { const k2 = Math.min(1, dt * 11), bx = foe.x - u.hx * 1.8, bz = foe.z - u.hz * 1.8; f.x += (bx - f.x) * k2; f.z += (bz - f.z) * k2; f.y += (foe.y - f.y) * k2; }
        else if (u.ay !== undefined) f.y += (u.ay - f.y) * Math.min(1, dt * 12);
      }
    }
    // momento de soltarla
    if (!u.res && Z.k !== 'rush' && u.dash === undefined && u.seq === Z.P && (u.si > Z.rel[0] || (u.si === Z.rel[0] && u.pt >= Z.rel[1]))) {
      const dy = foe.y - f.y, d = Math.hypot(dh, dy);
      if (foe.st === 'ko' || foe.inv > 0) this.zl3Miss(u, f, foe);
      else if (Z.k === 'proj') {                                          // el proyectil viaja hasta donde estaba el rival
        const orb = Z.fx && Z.fx.orb, ox = f.x + u.hx * (orb ? 0 : 1.2), oz = f.z + u.hz * (orb ? 0 : 1.2); let oy = f.y + (orb ? 5 : 2.2);
        if (Z.fx && /^vegetaego:/.test(Z.fx.p || '')) oy = f.y + 500 * ZC.PX;   // Hakai Gigantic Ball: nace 500 px sobre Vegeta (CreateObject JUG.Y() - 500) y cae sobre el rival
        const pre = Z.fx && Z.fx.p ? Z.fx.p.split(':')[0] : '', bk = typeof ZC_BULLETS !== 'undefined' && Object.keys(ZC_BULLETS).find((k) => k.startsWith(pre) && pre), v = bk ? ZC_BULLETS[bk] * ZC.PX : 16, T = Math.max(0.45, d / v);   // a la velocidad de su objeto en el original
        u.pj = { t: 0, T, ox, oy, oz, tx: foe.x, ty: foe.y + 1.2, tz: foe.z }; u.res = 3;
        this.emit('zProj', { i: f.i, ox, oy, oz, tx: foe.x, ty: foe.y + 1.2, tz: foe.z, T, fx: Z.fx && Z.fx.p });
      } else if (Z.k === 'warp' && false) {                                // (antes aparecía a su lado: ahora se lanza contra él desde fx.d)
        this.emit('vanish', { i: f.i, x: f.x, y: f.y, z: f.z });
        let px = foe.x - u.hx * 2.3, pz = foe.z - u.hz * 2.3; if (Math.hypot(px, pz) > VS.R - 0.5) { px = foe.x + u.hx * 2.3; pz = foe.z + u.hz * 2.3; }
        f.x = px; f.z = pz; f.y = foe.y; this.emit('appear', { i: f.i, x: f.x, y: f.y, z: f.z }); this.zl3Hit(u, f, foe);
      } else {
        const reach = Z.fx && Z.fx.reach ? Z.fx.reach : Z.k === 'area' ? 9 : Math.max(4, Z.R * 0.056 + 1.4);   // reach: rayos que en Z Legends 3 son un objeto aparte (más largos que el sprite)
        if (d <= reach && Math.abs(dy) < (Z.k === 'area' ? 7 : 4.2)) this.zl3Hit(u, f, foe); else this.zl3Miss(u, f, foe);
      }
    }
    if (u.pj) {                                                          // proyectil en vuelo
      const j = u.pj; j.t += dt;
      if (j.t >= j.T) {
        const r = Math.hypot(foe.x - j.tx, foe.y + 1.2 - j.ty, foe.z - j.tz); u.pj = null;
        this.emit('zBoom', { i: f.i, x: j.tx, y: j.ty, z: j.tz, fx: Z.fx && Z.fx.x, col: f.def.col });
        if (r < 4.5 && foe.inv <= 0 && foe.st !== 'ko' && !(foe.st === 'guard' && foe.t < VS.PARRY_ULT)) { u.res = 1; this.zl3Dmg(u, f, foe, foe.st === 'guard' ? 0.35 : 1); }
        else { if (foe.st === 'guard' && foe.t < VS.PARRY_ULT) this.parryUlt(f, foe, j.tx, j.ty, j.tz); u.res = 2; }
      }
    }
    // falló sin parte de fallo: los rayos y las zonas siguen hasta el final (la energía pasa de largo); las embestidas se cortan
    if (u.res === 2 && !u.pj && u.seq === Z.P && !Z.E.length && (Z.k !== 'beam' && Z.k !== 'area') && u.zt > (u.missT || 0) + 0.5) this.zl3End(u, f, foe);
  }
  /** Acierta: lo atrapa (se queda quieto hasta el final). Con la guardia justa la desvía; con guardia normal, menos daño */
  zl3Hit(u, f, foe) {
    if (foe.st === 'guard' && foe.t < VS.PARRY_ULT && u.Z.k !== 'warp') { this.parryUlt(f, foe, foe.x, foe.y + 1.5, foe.z); this.zl3Miss(u, f, foe); return; }
    u.res = 1; u.g = foe.st === 'guard' ? 0.35 : 1; u.lock = true; foe.set('held'); foe.vx = foe.vy = foe.vz = 0;
    if (u.Z.k === 'rush') { u.si++; u.pt = 0; }
    this.emit('zHit', { i: f.i, x: foe.x, y: foe.y + 1.5, z: foe.z, col: f.def.col }); this.freeze = Math.max(this.freeze, 4);
  }
  zl3Miss(u, f, foe) {
    u.res = 2; u.missT = u.zt; this.emit('zMiss', { i: f.i });
    if (u.Z.E.length) { u.seq = u.Z.E; u.si = 0; u.pt = 0; }
    else if (u.Z.fx && u.Z.fx.miss !== undefined && u.si < u.Z.fx.miss) { u.si = u.Z.fx.miss; u.pt = 0; }   // salta las partes del impacto (fogonazos)
  }
  zl3Dmg(u, f, foe, g) {
    this.emit('boom', { x: foe.x, y: foe.y + 1.5, z: foe.z, col: f.def.col, big: 2 });
    foe.set('idle'); u.lock = false;
    this.hit(f, foe, { dmg: u.D * f.pow * 0.95 * g + (u.sup ? 60 : 40) * g, raw: 1, stun: 1.1, kb: 28, up: 11, launch: true, heavy: true, gbreak: 100 }, u.hx, u.hz);
  }
  zl3End(u, f, foe) {
    if (u.res === 1 && u.lock) this.zl3Dmg(u, f, foe, u.g || 1);
    if (this.ult === u) this.endUlt(0.35);
  }
  /** Embestida inicial de las Ultimates cuerpo a cuerpo: vuela hacia el rival y lo engancha. Devuelve true mientras no lo tenga */
  ultReach(u, f, foe, c, grab) {
    if (u.lock) return false;
    const dt = VS_DT; f.vx = c.dx / c.d * 60; f.vy = c.dy / c.d * 60; f.vz = c.dz / c.d * 60; f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
    if (c.d < 2.8 && foe.inv <= 0 && foe.st !== 'ko') { u.lock = true; u.t = 0; u.n = 0; u.g = foe.st === 'guard' && !grab ? 0.35 : 1; foe.set('held'); foe.vx = foe.vy = foe.vz = 0; f.vx = f.vy = f.vz = 0; this.emit('rushLock', { i: f.i, type: u.type }); }
    else if (u.t > 0.6) { f.vx *= 0.2; f.vy *= 0.2; f.vz *= 0.2; this.endUlt(0.75); }
    return true;
  }
  /** Suelta al rival agarrado y le da el golpe final */
  ultRelease(u, f, foe, s, nx, nz) { foe.set('idle'); u.lock = false; return this.hit(f, foe, Object.assign({ raw: 1, launch: true, heavy: true, gbreak: 100 }, s), nx === undefined ? u.hx : nx, nz === undefined ? u.hz : nz); }

  u_beam(u, f, foe, c) {
    const dt = VS_DT, D = u.D, P = f.pow, { dx, dy, dz, dh, d } = c;
    // El rayo sale de las manos y avanza a 95 u/s: de lejos da tiempo a esquivarlo de lado o a teletransportarse
    if (u.w > 0) { u.w -= dt; u.t = 0; u.dx = dx / d; u.dy = dy / d; u.dz = dz / d; u.hx = dx / dh; u.hz = dz / dh; return; }   // apunta un instante antes de disparar: es la ventana para esquivar
    const ox = f.x + u.dx * 1.4, oy = f.y + 1.7 + u.dy * 1.4, oz = f.z + u.dz * 1.4;
    let len = Math.min(80, u.t * 95);
    if (u.dy < -0.05 && len >= (oy - 0.1) / -u.dy) {                   // el rayo muere en el suelo
      len = (oy - 0.1) / -u.dy; if (u.t < 1.35 && (u.g = (u.g || 0) + 1) % 5 === 1) this.emit('beamGnd', { x: ox + u.dx * len, z: oz + u.dz * len, col: f.def.col });
    }
    u.len = len; u.ox = ox; u.oy = oy; u.oz = oz; u.blen = u.defl ? Math.min(len, u.defl.at) : len;
    const rx = foe.x - ox, ry = foe.y + 1.5 - oy, rz = foe.z - oz, along = rx * u.dx + ry * u.dy + rz * u.dz;
    const perp = Math.hypot(rx - u.dx * along, ry - u.dy * along, rz - u.dz * along);
    if (!u.defl && !u.hitT && u.t < 1.35 && along > -1 && along < len + 1.5 && perp < [3.1, 4.3, 5.2][u.v] && foe.inv <= 0 && foe.st === 'guard' && foe.t < VS.PARRY_ULT) {
      // Guardia justo cuando llega el rayo: lo desvía hacia el cielo, de lado; desde ahí ya no hace daño
      const at = Math.max(1, along - 1.2), sg = this.rand() < 0.5 ? 1 : -1, sx = -u.hz * sg, sz = u.hx * sg;
      let ex = sx * 0.7 + u.dx * 0.25, ey = 0.85 + u.dy * 0.25, ez = sz * 0.7 + u.dz * 0.25; const el = Math.hypot(ex, ey, ez); ex /= el; ey /= el; ez /= el;
      u.defl = { at, x: ox + u.dx * at, y: oy + u.dy * at, z: oz + u.dz * at, dx: ex, dy: ey, dz: ez }; u.blen = Math.min(len, at);
      this.parryUlt(f, foe, u.defl.x, u.defl.y, u.defl.z);
    }
    if (!u.defl && u.t < 1.35 && along > -1 && along < len + 1.5 && perp < [3.1, 4.3, 5.2][u.v] && foe.inv <= 0 && foe.st !== 'ko') {
      const g = foe.st === 'guard'; u.hitT += dt;
      if (g) { foe.gm -= 40 * dt; if (foe.gm <= 0) { foe.gm = 50; foe.set('hurt'); } } else if (foe.st !== 'hurt') foe.set('hurt');
      foe.stun = 0.25; if (u.v === 1) { foe.vx = foe.vz = 0; foe.vy = -17; } else { foe.vx = u.dx * 17; foe.vy = u.dy * 17; foe.vz = u.dz * 17; }   // desde lo alto lo clava contra el suelo
      if ((u.n++ & 3) === 0) { this.emit('beamHit', { x: foe.x, y: foe.y + 1.5, z: foe.z, col: f.def.col }); this.damage(f, foe, (g ? 0.3 : 1) * D * P * (u.v === 2 ? 0.85 : 1) * (4 * dt / 1.35)); }
    }
    if (u.t >= 1.35 && !u.fin) {
      u.fin = true;
      if (u.v === 2 && !u.defl) for (let i = 0; i < 5; i++) this.blast(f, foe.x + u.hx * (i - 1) * 5, foe.z + u.hz * (i - 1) * 5, { t: 0.12 + i * 0.1, r: 5.5, dmg: D * 0.05, up: 11, kb: 10, stun: 0.7, launch: true, tall: true });   // el suelo revienta a lo largo del rayo
      if (u.hitT > 0.45 && foe.st !== 'ko') { this.emit('boom', { x: foe.x, y: foe.y + 1.5, z: foe.z, col: f.def.col, big: u.v ? 2 : 1 }); this.hit(f, foe, { dmg: u.sup ? 60 : 40, stun: 0.9, kb: 26, up: 8, launch: true, heavy: true, gbreak: 60 }, u.hx, u.hz); }
    }
    if (u.t >= (u.v === 2 ? 2.1 : 1.7)) this.endUlt(0.35);
  }
  u_rush(u, f, foe, c) {
    if (this.ultReach(u, f, foe, c)) return;
    const D = u.D, P = f.pow, N = [14, 22, 18][u.v], every = [0.085, 0.06, 0.07][u.v], k = Math.floor(u.t / every);
    if (k > u.n && u.n < N) {
      u.n++; const a = this.rand() * 6.283, e = (this.rand() - 0.5) * 1.6;                                   // cada golpe llega desde un lado distinto
      f.x = foe.x + Math.cos(a) * 2.0; f.z = foe.z + Math.sin(a) * 2.0; f.y = Math.max(0, foe.y + e);
      this.emit('hit', { i: foe.i, x: foe.x + Math.cos(a) * 0.5, y: foe.y + 1.6 + e * 0.5, z: foe.z + Math.sin(a) * 0.5, col: f.def.col, rush: 1 }); this.freeze = 1;
      this.emit('rushHit', { i: f.i, n: u.n });
      if (this.ultDmg(f, foe, D * P * (u.v ? 0.5 : 0.6) / N * u.g)) return;
    }
    if (u.n < N) return;
    if (u.v === 1 && u.t > N * every + 0.2) {                          // lo manda al cielo, aparece encima y lo estrella como un meteoro
      if (!u.up) {
        u.up = u.t; f.x = foe.x - u.hx * 1.6; f.z = foe.z - u.hz * 1.6; f.y = Math.max(0, foe.y - 0.6); foe.set('idle');
        this.hit(f, foe, { dmg: D * 0.15 * u.g, stun: 1.6, kb: 1, up: 31, launch: true, heavy: true, gbreak: 100 }, u.hx, u.hz);
        if (foe.st === 'ko') this.endUlt(0.3); else this.emit('rushUp', { i: f.i });
      } else if (u.t > u.up + 0.5) {
        this.emit('vanish', { i: f.i, x: f.x, y: f.y, z: f.z }); f.x = foe.x; f.z = foe.z; f.y = Math.min(VS.TOP, foe.y + 1.9); this.emit('appear', { i: f.i, x: f.x, y: f.y, z: f.z });
        foe.stun = 0; foe.inv = 0; this.blasts.push({ o: f.i, x: foe.x, z: foe.z, t: Math.max(0.05, foe.y / 50), col: f.def.col, big: 2, r: 0 });
        this.hit(f, foe, { dmg: D * 0.35 * u.g, stun: 1.1, kb: 1, up: -50, launch: true, heavy: true, gbreak: 100 }, u.hx, u.hz);
        u.lock = false; this.endUlt(0.45);
      }
    } else if (u.v === 2 && u.t > N * every + 0.34) {                  // toma impulso y lo atraviesa con el puño por delante
      f.x = foe.x - u.hx * 2; f.z = foe.z - u.hz * 2; f.y = foe.y;
      this.ultRelease(u, f, foe, { dmg: D * 0.5 * u.g, stun: 1.2, kb: 44, up: 9 });
      this.emit('cut', { i: f.i, x0: f.x - u.hx * 4, y0: f.y + 1.6, z0: f.z - u.hz * 4, x1: f.x + u.hx * 9, y1: f.y + 1.6, z1: f.z + u.hz * 9, col: f.def.col, w: 2.6 });
      this.emit('boom', { x: f.x + u.hx * 2, y: f.y + 1.5, z: f.z + u.hz * 2, col: f.def.col, big: 2 });
      f.x += u.hx * 7; f.z += u.hz * 7; this.endUlt(0.45);
    } else if (u.v === 0 && u.t > N * every + 0.28) {                  // lo estampa contra el suelo
      f.x = foe.x - u.hx * 1.8; f.z = foe.z - u.hz * 1.8; f.y = foe.y + 1.2; foe.set('idle'); u.lock = false;
      this.hit(f, foe, { dmg: 300 * 0.4 * u.g, stun: 1.0, kb: 14, up: -34, launch: true, heavy: true, gbreak: 100 }, u.hx, u.hz);
      this.emit('boom', { x: foe.x, y: foe.y + 1.5, z: foe.z, col: f.def.col }); this.endUlt(0.3);
    }
  }
  u_bomb(u, f) { if (u.t > 7 || !this.shots.some((s) => s.big && s.o === f.i)) this.endUlt(0.3); }     // las esferas las mueve stepBomb()
  u_storm(u, f, foe) {
    const D = u.D, N = [12, 16, 18][u.v], every = [0.13, 0.1, 0.085][u.v];
    while (u.n < N && u.t >= u.n * every) {
      let x, z;
      if (u.v === 2) {                                                  // tres anillos que se cierran sobre donde estaba el rival
        const ring = (u.n / 6) | 0, a = u.n * 1.0472 + ring * 0.52, r = [10.5, 6.2, 2.4][ring];
        if (u.n % 6 === 0) { u.cx = foe.x + foe.vx * 0.25; u.cz = foe.z + foe.vz * 0.25; }
        x = u.cx + Math.cos(a) * r; z = u.cz + Math.sin(a) * r;
      } else { const a = this.rand() * 6.283, r = this.rand() * 3.4; x = foe.x + foe.vx * 0.3 + Math.cos(a) * r; z = foe.z + foe.vz * 0.3 + Math.sin(a) * r; }
      const w = u.v === 2 ? [0.06, 0.06, 0.16][(u.n / 6) | 0] : [1.05, 0.7][u.v] / N;   // en los anillos, el que pega de verdad es el último (el que se cierra)
      this.blast(f, x, z, { t: 0.55, r: 4.1, dmg: D * w, stun: 0.45, kb: 3, up: 0, gbreak: 9, fz: 2, tall: true, sky: 1 });
      this.emit('stormShot', { i: f.i, x: f.x, y: f.y + 2.4, z: f.z });
      u.n++;
    }
    if (u.v === 1 && !u.fin && u.t >= N * every + 0.2) { u.fin = true; this.blast(f, foe.x, foe.z, { t: 0.75, r: 8.5, dmg: D * 0.4, big: 2, stun: 1, kb: 20, up: 13, launch: true, heavy: true, gbreak: 60, tall: true, sky: 2 }); }
    if (u.t >= N * every + (u.v === 1 ? 1.25 : 0.85)) this.endUlt(0.3);
  }
  u_discs(u, f, foe, c) {
    const D = u.D, N = [5, 8, 1][u.v], every = [0.16, 0.06, 0][u.v], col = f.def.col;
    while (u.n < N && u.t >= 0.1 + u.n * every) {
      const px = -u.hz, pz = u.hx, s = { o: f.i, disc: 1, pw: u.v === 2 ? 8 : 4, x: f.x + u.hx * 1.2, y: f.y + 2.2, z: f.z + u.hz * 1.2, t: 0, col, life: 2.6, r: 1.3, sp: 34 };
      if (u.v === 0) {                                                  // abanico: cada disco sale por un lado y se cierra sobre el rival
        const a = (u.n - 2) * 0.55; s.vx = (u.hx * Math.cos(a) + px * Math.sin(a)) * s.sp; s.vz = (u.hz * Math.cos(a) + pz * Math.sin(a)) * s.sp; s.vy = 7; s.hm = 1.8; s.tr = 4.5;
        s.hs = { dmg: D * 1.05 / N, stun: 0.42, kb: 7, gbreak: 30, raw: 1, fz: 3, shot: 1 };
      } else if (u.v === 1) {                                           // salen en círculo, rodean al rival y caen todos a la vez
        const a = u.n * 0.7854; s.vx = (px * Math.cos(a) + u.hx * 0.45) * 20; s.vz = (pz * Math.cos(a) + u.hz * 0.45) * 20; s.vy = Math.sin(a) * 17 + 4; s.hold = 0.5 - u.n * every; s.hm = 2.4; s.tr = 9; s.life = 2.8;
        s.hs = { dmg: D * 1.1 / N, stun: 0.42, kb: 5, gbreak: 22, raw: 1, fz: 2, shot: 1 };
      } else {                                                          // un disco gigante que atraviesa y vuelve
        s.r = 3.1; s.sp = 31; s.vx = u.hx * s.sp; s.vz = u.hz * s.sp; s.vy = c.dy / c.d * s.sp; s.hm = 3.4; s.tr = 3.2; s.life = 3.5; s.pierce = 4;
        s.hs = { dmg: D * 0.29, stun: 0.5, kb: 4, gbreak: 45, raw: 1, heavy: true, fz: 4, shot: 1 };
      }
      this.shots.push(s); this.emit('shot', { i: f.i, x: s.x, y: s.y, z: s.z, disc: 1 }); u.n++;
    }
    if (u.n >= N && (u.t > 4.6 || !this.shots.some((s) => s.disc && s.o === f.i))) this.endUlt(0.3);
  }
  u_slash(u, f, foe, c) {
    if (this.ultReach(u, f, foe, c)) return;
    const D = u.D, P = f.pow, N = [5, 8, 10][u.v], every = [0.13, 0.1, 0.06][u.v], k = Math.floor(u.t / every), col = f.def.col;
    const cut = (a, e, L, w) => { const ox = Math.cos(a) * L, oz = Math.sin(a) * L, y = foe.y + 1.6; this.emit('cut', { i: f.i, x0: foe.x + ox, y0: Math.max(0.2, y + e), z0: foe.z + oz, x1: foe.x - ox, y1: Math.max(0.2, y - e), z1: foe.z - oz, col, w }); };
    if (k > u.n && u.n < N) {                                           // cada corte lo atraviesa de lado a lado
      u.n++; const a = (u.a0 = (u.a0 === undefined ? this.rand() * 6.283 : u.a0 + 2.4)), e = (this.rand() - 0.5) * 2.4;
      f.x = foe.x - Math.cos(a) * 3.1; f.z = foe.z - Math.sin(a) * 3.1; f.y = Math.max(0, foe.y - e * 0.5);
      cut(a, e, 4.6, 1); this.emit('rushHit', { i: f.i, n: u.n }); this.freeze = 1;
      if (u.v !== 2) { this.emit('hit', { i: foe.i, x: foe.x, y: foe.y + 1.6, z: foe.z, col, rush: 1 }); if (this.ultDmg(f, foe, D * P * 0.55 / N * u.g)) return; }
    }
    if (u.n < N) return;
    const T = N * every;
    if (u.v === 0 && u.t > T + 0.25) {                                  // cruz final
      cut(u.a0 + 0.8, 3, 6, 2); cut(u.a0 - 0.8, -3, 6, 2); this.emit('boom', { x: foe.x, y: foe.y + 1.5, z: foe.z, col, big: 1 });
      this.ultRelease(u, f, foe, { dmg: D * 0.5 * u.g, stun: 1, kb: 22, up: 10 }); this.endUlt(0.35);
    } else if (u.v === 1 && u.t > T + 0.2) {                            // lo eleva y cae sobre él con un tajo vertical
      if (!u.up) {
        u.up = u.t; f.x = foe.x - u.hx * 1.6; f.z = foe.z - u.hz * 1.6; f.y = Math.max(0, foe.y - 0.6);
        this.ultRelease(u, f, foe, { dmg: D * 0.12 * u.g, stun: 1.6, kb: 1, up: 30 }); u.lock = true;
        if (foe.st === 'ko') { u.lock = false; this.endUlt(0.3); } else this.emit('rushUp', { i: f.i });
      } else if (u.t > u.up + 0.5) {
        this.emit('vanish', { i: f.i, x: f.x, y: f.y, z: f.z }); f.x = foe.x; f.z = foe.z; f.y = Math.min(VS.TOP, foe.y + 2.2); this.emit('appear', { i: f.i, x: f.x, y: f.y, z: f.z });
        this.emit('cut', { i: f.i, x0: foe.x, y0: foe.y + 7, z0: foe.z, x1: foe.x, y1: 0.2, z1: foe.z, col, w: 2.4 });
        foe.stun = 0; foe.inv = 0; this.blasts.push({ o: f.i, x: foe.x, z: foe.z, t: Math.max(0.05, foe.y / 50), col, big: 2, r: 0 });
        this.hit(f, foe, { dmg: D * 0.38 * u.g, raw: 1, stun: 1.1, kb: 1, up: -50, launch: true, heavy: true, gbreak: 100 }, u.hx, u.hz);
        u.lock = false; this.endUlt(0.45);
      }
    } else if (u.v === 2) {                                             // se aleja de espaldas... y todos los cortes estallan a la vez
      if (!u.w2 && u.t > T + 0.12) { u.w2 = u.t; f.x = foe.x + u.hx * 5.5; f.z = foe.z + u.hz * 5.5; f.y = foe.y; this.emit('sheath', { i: f.i }); }
      else if (u.w2 && u.t > u.w2 + 0.6) {
        for (let i = 0; i < 6; i++) cut(i * 1.05 + 0.3, (i % 3 - 1) * 3, 5.5, 1.6);
        this.emit('boom', { x: foe.x, y: foe.y + 1.5, z: foe.z, col, big: 2 });
        this.ultRelease(u, f, foe, { dmg: D * 1.05 * u.g, stun: 1.1, kb: 18, up: 12 }, -u.hx, -u.hz); this.endUlt(0.35);
      }
    }
  }
  u_rift(u, f, foe) {
    const dt = VS_DT, D = u.D, col = f.def.col;
    if (!u.heads) {                                                     // golpe en el suelo: nacen las grietas
      f.y = 0; u.heads = []; const a = Math.atan2(foe.z - f.z, foe.x - f.x);
      if (u.v === 2) for (let i = 0; i < 4; i++) { const b = a + 0.785 + i * 1.5708; let x = foe.x + Math.cos(b) * 15, z = foe.z + Math.sin(b) * 15; const r = Math.hypot(x, z); if (r > VS.R - 1) { x *= (VS.R - 1) / r; z *= (VS.R - 1) / r; } u.heads.push({ x, z, a: b + Math.PI, s: 0, t: 0 }); }
      else for (const o of (u.v === 1 ? [-0.6, 0, 0.6] : [0])) u.heads.push({ x: f.x + Math.cos(a) * 1.5, z: f.z + Math.sin(a) * 1.5, a: a + o, s: 0, t: 0 });
      this.emit('slam', { x: f.x, z: f.z, col });
    }
    let live = 0;
    for (const h of u.heads) {
      if (h.done) continue; live++; h.t += dt;
      let da = Math.atan2(foe.z - h.z, foe.x - h.x) - h.a; while (da > Math.PI) da -= 6.2832; while (da < -Math.PI) da += 6.2832;
      const tr = (u.v === 2 ? 5 : 2.4) * dt, sp = 27 * dt; h.a += Math.max(-tr, Math.min(tr, da));
      h.x += Math.cos(h.a) * sp; h.z += Math.sin(h.a) * sp; h.s += sp;
      if (h.s >= 2.3) { h.s = 0; this.emit('crack', { x: h.x, z: h.z, col }); }
      if (Math.hypot(foe.x - h.x, foe.z - h.z) < 2.3 || h.t > 1.7 || Math.hypot(h.x, h.z) > VS.R) {   // llega bajo el rival: pilar de energía
        h.done = true; u.last = u.t;
        this.blast(f, h.x, h.z, { t: 0.28, r: [6.2, 5, 5.2][u.v], dmg: D * [1, 0.36, 0.28][u.v], big: 2, stun: 1, kb: 8, up: 21, launch: true, heavy: true, gbreak: 70, tall: true, pil: 1 });
      }
    }
    if (!live && u.t > u.last + 0.9) this.endUlt(0.3);
  }
  u_nova(u, f, foe, c) {
    const dt = VS_DT, D = u.D, pull = 0.42, T = 0.5, gap = 0.2, n = u.v === 1 ? 2 : 1, t = u.t - pull;
    if (t < 0) {                                                        // primero atrae al rival hacia sí
      if (c.d < 26 && c.d > 3 && foe.inv <= 0 && foe.st !== 'ko') { const s = 15 * dt / c.d; foe.x -= c.dx * s; foe.y = Math.max(0, foe.y - c.dy * s); foe.z -= c.dz * s; }
      u.r = 0; return;
    }
    const k = Math.floor(t / (T + gap)), q = (t - k * (T + gap)) / T;
    if (k >= n) { u.r = 0; if (t > n * (T + gap) + 0.15) this.endUlt(0.5); return; }
    if (k !== u.k) {
      u.k = k; u.hitP = false; this.emit('novaGo', { i: f.i, x: f.x, y: f.y + 1.6, z: f.z, col: f.def.col, big: k || u.v === 2 ? 2 : 1 });
      if (u.v === 2) f.hp = Math.max(1, f.hp - f.hpMax * 0.08);         // lo da todo: le cuesta parte de su vida
    }
    u.r = [13, 13, 19][u.v] * (k ? 1.3 : 1) * Math.min(1, q * 1.15); u.a = q < 0.8 ? 1 : Math.max(0, (1 - q) / 0.2);
    if (!u.hitP && q <= 1 && c.d < u.r + 1 && foe.inv <= 0 && foe.st !== 'ko') {
      u.hitP = true; const g = foe.st === 'guard' ? 0.35 : 1; if (g < 1) foe.set('idle');
      if (u.v === 1 && k === 0) this.hit(f, foe, { dmg: D * 0.42 * g, raw: 1, stun: 0.95, kb: 5, heavy: true, gbreak: 100 }, c.dx / c.dh, c.dz / c.dh);   // la primera onda lo deja clavado para la segunda
      else this.hit(f, foe, { dmg: D * [1.05, 0.62, 1.3][u.v] * g, raw: 1, stun: 1, kb: 30, up: 12, launch: true, heavy: true, gbreak: 100 }, c.dx / c.dh, c.dz / c.dh);
    }
  }
  u_grab(u, f, foe, c) {
    if (!u.thrown && this.ultReach(u, f, foe, c, true)) return;
    const D = u.D, P = f.pow, col = f.def.col, t = u.t;
    if (u.gy === undefined) { u.gy = foe.y; u.gx = foe.x; u.gz = foe.z; }
    if (u.v === 0) {                                                    // lo sube a lo más alto entre rodillazos y lo estrella
      const top = VS.TOP - 2.5, up = 0.55, dn = 0.24;
      foe.y = t < up ? u.gy + (top - u.gy) * (t / up) : Math.max(0, top * (1 - (t - up) / dn)); foe.x = u.gx; foe.z = u.gz;
      f.x = foe.x - u.hx * 1.5; f.z = foe.z - u.hz * 1.5; f.y = t < up ? Math.max(0, foe.y - 0.5) : foe.y + 1.3;
      if (u.n < 3 && t >= 0.14 * (u.n + 1)) { u.n++; this.emit('hit', { i: foe.i, x: foe.x, y: foe.y + 1.4, z: foe.z, col, rush: 1 }); this.emit('rushHit', { i: f.i, n: u.n }); if (this.ultDmg(f, foe, D * P * 0.08)) return; }
      if (t >= up + dn) {
        foe.y = 0; f.y = 0.6; this.emit('boom', { x: foe.x, y: 1.2, z: foe.z, col, big: 2 }); this.emit('land', { x: foe.x, z: foe.z, hard: true });
        this.ultRelease(u, f, foe, { dmg: D * 0.62, stun: 1.1, kb: 7, up: 15 }); this.endUlt(0.4);
      }
    } else if (u.v === 1) {                                             // lo hace girar, lo lanza contra el borde y lo remata con una esfera
      if (!u.thrown) {
        const T = 0.95, a = (u.a0 === undefined ? (u.a0 = Math.atan2(foe.z - f.z, foe.x - f.x)) : u.a0) + t * t * 14;
        f.y = Math.max(f.y, 0.6); foe.x = f.x + Math.cos(a) * 2.7; foe.z = f.z + Math.sin(a) * 2.7; foe.y = f.y + 0.3;
        if ((u.n = (u.n || 0) + 1) % 4 === 0) this.emit('rushHit', { i: 1 - f.i, n: 1 });
        if (t >= T) {
          u.thrown = t; const ox = foe.x, oz = foe.z, r = Math.hypot(ox, oz) || 1, tx = r > 4 ? ox / r : Math.cos(a), tz = r > 4 ? oz / r : Math.sin(a);   // hacia el borde más cercano
          this.ultRelease(u, f, foe, { dmg: D * 0.35, stun: 1.5, kb: 46, up: 7 }, tx, tz); u.hx = tx; u.hz = tz;
          if (foe.st !== 'ko') this.shots.push({ o: f.i, big: 1, x: f.x, y: f.y + 3, z: f.z, vx: 0, vy: 0, vz: 0, life: 5, r: 0.5, t: 0, col, wait: 0, off: 0, R: 2.3, sp: 48, dm: D * 0.62, AR: 7.5, grow: 0.32 });
        }
      } else if (t > u.thrown + 0.4 && (t > u.thrown + 5 || !this.shots.some((s) => s.big && s.o === f.i))) this.endUlt(0.3);
    } else {                                                            // lo sujeta en alto y le revienta la energía a quemarropa
      f.y = Math.max(f.y, 0.4); foe.x = f.x + u.hx * 1.9; foe.z = f.z + u.hz * 1.9; foe.y = f.y + 1.1;
      if (u.n < 3 && t >= 0.36 * (u.n + 1)) { u.n++; this.emit('boom', { x: foe.x, y: foe.y + 1.4, z: foe.z, col, big: u.n - 1 }); if (this.ultDmg(f, foe, D * P * 0.18)) return; }
      if (t >= 1.36) { this.ultRelease(u, f, foe, { dmg: D * 0.32, stun: 1.1, kb: 32, up: 10 }); this.endUlt(0.4); }
    }
  }
  u_volley(u, f, foe, c) {
    const D = u.D, N = [18, 22, 24][u.v], every = 0.055, col = f.def.col, sp = 46;
    while (u.n < N && u.t >= u.n * every) {
      const s = { o: f.i, vol: 1, pw: 2, t: 0, col, life: 1.5, r: 1.4, hs: { dmg: D * [1.1, 0.8, 1.15][u.v] / N, stun: 0.3, kb: 2.5, gbreak: 5, raw: 1, fz: 1, shot: 1, rush: 1 } };
      if (u.v === 2) {                                                  // aparecen alrededor del rival y caen sobre él desde todas partes
        const a = this.rand() * 6.283, e = 0.15 + this.rand() * 1.1, R = 13; s.x = foe.x + Math.cos(a) * Math.cos(e) * R; s.z = foe.z + Math.sin(a) * Math.cos(e) * R; s.y = foe.y + 1.5 + Math.sin(e) * R;
        const ax = foe.x + foe.vx * 0.2 - s.x, ay = foe.y + 1.5 - s.y, az = foe.z + foe.vz * 0.2 - s.z, ad = Math.hypot(ax, ay, az) || 1; s.vx = ax / ad * sp; s.vy = ay / ad * sp; s.vz = az / ad * sp;
      } else {
        const side = (u.n & 1 ? 1 : -1) * 0.9, oy = 1.4 + this.rand() * 1.2; s.x = f.x + u.hx * 1.2 - u.hz * side; s.z = f.z + u.hz * 1.2 + u.hx * side; s.y = f.y + oy;
        const ax = foe.x + (this.rand() - 0.5) * 2.4 - s.x, ay = foe.y + 1.5 + (this.rand() - 0.5) * 2 - s.y, az = foe.z + (this.rand() - 0.5) * 2.4 - s.z, ad = Math.hypot(ax, ay, az) || 1; s.vx = ax / ad * sp; s.vy = ay / ad * sp; s.vz = az / ad * sp;
      }
      this.shots.push(s); this.emit('shot', { i: f.i, x: s.x, y: s.y, z: s.z, vol: 1 }); u.n++;
    }
    const T = N * every;
    if (u.v === 1 && !u.fin && u.t >= T + 0.15) { u.fin = true; this.shots.push({ o: f.i, big: 1, x: f.x, y: f.y + 3, z: f.z, vx: 0, vy: 0, vz: 0, life: 5, r: 0.5, t: 0, col, wait: 0, off: 0, R: 2.5, sp: 46, dm: D * 0.42, AR: 7.5, grow: 0.4 }); }
    if (u.t > T + 0.5 && (u.t > T + 5 || !this.shots.some((s) => (s.vol || s.big) && s.o === f.i))) this.endUlt(0.3);
  }
  /* ----- Cinco coreografías más -----
       clone  imágenes múltiples que rodean al rival: lo atraviesan una a una · más imágenes y caída final · disparan todas al centro
       cage   prisión de ki que se cierra sobre el rival: lo aplasta y estalla · lo eleva y lo estrella · lo atraviesan lanzas de ki
       drain  lazo de energía que le roba la vida (y cura a quien lo lanza): absorbe · absorbe y estalla · absorbe también el ki
       wave   onda por el suelo que recorre toda la arena (se esquiva volando): una · tres seguidas · va y vuelve
       spin   rayo giratorio a la altura del rival (se esquiva subiendo o bajando): una vuelta · ida y vuelta · dos rayos opuestos */
  u_clone(u, f, foe) {
    const D = u.D, col = f.def.col, N = [4, 6, 5][u.v], t0 = 0.5, every = [0.24, 0.17, 0][u.v], R = 9, dash = 0.14;
    if (!u.cl) {
      u.cl = []; const a0 = Math.atan2(f.z - foe.z, f.x - foe.x);
      for (let i = 0; i < N; i++) u.cl.push({ a: a0 + i * 6.2832 / N, s: 0, x: 0, y: 0, z: 0 });      // s: 0 espera · 1 ataca · 2 ya ha atacado
      u.k = -1; this.emit('clones', { i: f.i, x: f.x, y: f.y, z: f.z });
    }
    if (!u.fix) { u.cx = foe.x; u.cy = foe.y; u.cz = foe.z; }             // el corro sigue al rival
    for (const q of u.cl) if (q.s === 0) { let x = u.cx + Math.cos(q.a) * R, z = u.cz + Math.sin(q.a) * R; const r = Math.hypot(x, z); if (r > VS.R) { x *= VS.R / r; z *= VS.R / r; } q.x = x; q.z = z; q.y = u.cy; }
    if (u.v === 2) {                                                    // todas disparan a la vez al centro
      const w = u.cl[0]; f.x = w.x; f.y = w.y; f.z = w.z;
      if (!u.fix && u.t >= t0) { u.fix = true; this.emit('mark', { x: u.cx, z: u.cz, t: 0.42, r: 3.4, col }); }
      if (u.fix && !u.fin && u.t >= t0 + 0.42) {
        u.fin = u.t; for (const q of u.cl) { q.s = 2; this.emit('cut', { i: f.i, x0: q.x, y0: q.y + 1.7, z0: q.z, x1: u.cx, y1: u.cy + 1.5, z1: u.cz, col, w: 1.8 }); }
        this.emit('boom', { x: u.cx, y: u.cy + 1.5, z: u.cz, col, big: 2 });
        if (Math.hypot(foe.x - u.cx, foe.y - u.cy, foe.z - u.cz) < 3.6 && foe.inv <= 0 && foe.st !== 'ko') { const h = Math.hypot(foe.x - f.x, foe.z - f.z) || 1; this.hit(f, foe, { dmg: D * 1.05, raw: 1, stun: 1, kb: 22, up: 12, launch: true, heavy: true, gbreak: 100, shot: 1 }, (foe.x - f.x) / h, (foe.z - f.z) / h); }
      }
      if (u.fin && u.t >= u.fin + 0.5) this.endUlt(0.3);
      return;
    }
    const k = Math.floor((u.t - t0) / every);
    if (u.t >= t0 && k > u.k && u.k < N - 1) {                           // sale la siguiente imagen: cruza por donde está el rival
      u.k++; const q = u.cl[u.k]; q.s = 1; q.t = u.t;
      const dx = foe.x - q.x, dy = foe.y - q.y, dz = foe.z - q.z, d = Math.hypot(dx, dy, dz) || 1; q.dx = dx / d; q.dy = dy / d; q.dz = dz / d; q.len = d + 5; q.x0 = q.x; q.y0 = q.y; q.z0 = q.z;
      this.emit('cloneGo', { i: f.i });
    }
    const q = u.k >= 0 ? u.cl[u.k] : u.cl[0];
    if (q.s === 1) {
      const p = Math.min(1, (u.t - q.t) / dash); f.x = q.x0 + q.dx * q.len * p; f.y = Math.max(0, q.y0 + q.dy * q.len * p); f.z = q.z0 + q.dz * q.len * p;
      if (!q.h) {
        const rx = foe.x - q.x0, ry = foe.y - q.y0, rz = foe.z - q.z0, al = rx * q.dx + ry * q.dy + rz * q.dz, per = Math.hypot(rx - q.dx * al, ry - q.dy * al, rz - q.dz * al);
        if (al <= q.len * p + 1 && per < 2.4) {
          q.h = true; const h = Math.hypot(q.dx, q.dz) || 1, last = u.v === 0 && u.k === N - 1;
          this.emit('cut', { i: f.i, x0: q.x0, y0: q.y0 + 1.6, z0: q.z0, x1: q.x0 + q.dx * q.len, y1: q.y0 + q.dy * q.len + 1.6, z1: q.z0 + q.dz * q.len, col, w: 1.1 });
          this.hit(f, foe, { dmg: D * [1.0, 0.8][u.v] / N, raw: 1, stun: 0.5, kb: last ? 24 : 1.5, up: last ? 11 : 0, launch: last, heavy: true, gbreak: 22, fz: 3, shot: 1 }, q.dx / h, q.dz / h);
        }
      }
      if (p >= 1) { q.s = 2; q.x = f.x; q.y = f.y; q.z = f.z; }
    } else if (u.k < 0) { f.x = q.x; f.y = q.y; f.z = q.z; }
    if (u.k >= N - 1 && u.cl[N - 1].s === 2) {
      if (u.v === 1 && !u.fin) {                                        // cae desde lo alto sobre el rival
        u.fin = u.t; this.emit('vanish', { i: f.i, x: f.x, y: f.y, z: f.z }); f.x = foe.x; f.z = foe.z; f.y = Math.min(VS.TOP, foe.y + 9); this.emit('appear', { i: f.i, x: f.x, y: f.y, z: f.z }); u.fy = f.y;
        this.blast(f, foe.x, foe.z, { t: 0.3, r: 4.4, dmg: D * 0.32, big: 2, stun: 1, kb: 16, up: 13, launch: true, heavy: true, gbreak: 80, tall: true });
      } else if (u.v === 1) { const p = Math.min(1, (u.t - u.fin) / 0.3); f.y = u.fy * (1 - p * p); if (u.t >= u.fin + 0.75) this.endUlt(0.3); }
      else if (u.t >= u.cl[N - 1].t + dash + 0.3) this.endUlt(0.3);
    }
  }
  u_cage(u, f, foe, c) {
    const D = u.D, P = f.pow, col = f.def.col, close = 0.55;
    if (!u.lock) {
      if (u.t < 0.3 || u.cx === undefined) { u.cx = foe.x; u.cy = foe.y + 1.5; u.cz = foe.z; }   // sigue al rival un instante y luego se fija: ahí hay que salir
      if (!u.mk) { u.mk = 1; this.emit('cageOpen', { i: f.i, col }); }
      u.cr = 3.4 + 8 * Math.max(0, 1 - u.t / close);
      if (u.t >= close) {
        if (Math.hypot(foe.x - u.cx, foe.y + 1.5 - u.cy, foe.z - u.cz) < 3.7 && foe.inv <= 0 && foe.st !== 'ko') {
          u.lock = true; u.t = 0; u.n = 0; u.g = foe.st === 'guard' ? 0.5 : 1; foe.set('held'); foe.vx = foe.vy = foe.vz = 0; u.cr = 3.4; u.y0c = u.cy;
          this.emit('cageShut', { x: u.cx, y: u.cy, z: u.cz, col });
        } else { u.cr = 0; this.emit('pop', { x: u.cx, y: u.cy, z: u.cz, col }); this.endUlt(0.6); }
      }
      return;
    }
    const t = u.t, h = c.dh || 1, bang = (dmg, kb, up) => { this.emit('boom', { x: u.cx, y: u.cy, z: u.cz, col, big: 2 }); u.cr = 0; this.ultRelease(u, f, foe, { dmg: dmg * u.g, stun: 1, kb, up }, c.dx / h, c.dz / h); this.endUlt(0.35); };
    if (u.v === 0) {                                                    // la jaula se encoge y revienta
      u.cr = 3.4 - 1.7 * Math.min(1, t / 0.9);
      if (u.n < 4 && t >= 0.2 * (u.n + 1)) { u.n++; this.emit('hit', { i: foe.i, x: u.cx, y: u.cy, z: u.cz, col, rush: 1 }); if (this.ultDmg(f, foe, D * P * 0.1 * u.g)) return; }
      if (t >= 1.0) { bang(D * 0.62, 24, 12); return; }
    } else if (u.v === 1) {                                             // la eleva hasta lo más alto y la estrella contra el suelo
      const top = VS.TOP - 0.5; u.cy = t < 0.6 ? u.y0c + (top - u.y0c) * (t / 0.6) : Math.max(1.6, top - (top - 1.6) * ((t - 0.6) / 0.22));
      if (t >= 0.82) { this.emit('land', { x: u.cx, z: u.cz, hard: true }); foe.y = 0; bang(D * 0.98, 9, 15); return; }
    } else {                                                            // lanzas de ki la atraviesan una tras otra
      if (u.n < 6 && t >= 0.15 + 0.13 * u.n) {
        u.n++; const a = u.n * 2.4, e = ((u.n % 3) - 1) * 2.2, ox = Math.cos(a) * 6, oz = Math.sin(a) * 6;
        this.emit('cut', { i: f.i, x0: u.cx + ox, y0: Math.max(0.2, u.cy + e + 2), z0: u.cz + oz, x1: u.cx - ox, y1: Math.max(0.2, u.cy - e), z1: u.cz - oz, col, w: 1 });
        this.emit('hit', { i: foe.i, x: u.cx, y: u.cy, z: u.cz, col, rush: 1 }); if (this.ultDmg(f, foe, D * P * 0.09 * u.g)) return;
      }
      if (t >= 0.15 + 0.13 * 6 + 0.25) { bang(D * 0.5, 22, 12); return; }
    }
    foe.x = u.cx; foe.z = u.cz; foe.y = Math.max(0, u.cy - 1.5);
  }
  u_drain(u, f, foe, c) {
    const D = u.D, P = f.pow, col = f.def.col, T = [1.5, 1.3, 1.7][u.v], every = 0.1, N = Math.round(T / every);
    if (!u.link) {
      if (u.t < 0.28) return;
      if (c.d < 17 && foe.inv <= 0) { u.link = 1; u.t = 0; u.n = 0; this.emit('drainOn', { i: f.i }); } else { this.emit('drainMiss', { i: f.i }); this.endUlt(0.6); }
      return;
    }
    if (foe.inv > 0 || c.d > 26) { u.link = 0; this.endUlt(0.4); return; }                                     // se ha soltado
    const g = foe.st === 'guard' ? 0.5 : 1;
    if (g === 1) { if (foe.st !== 'hurt') foe.set('hurt'); foe.stun = 0.2; foe.vx = foe.vy = foe.vz = 0; }   // lo deja clavado mientras le roba la energía
    if (c.d > 6) { const s = 5 * VS_DT / c.d; foe.x -= c.dx * s; foe.z -= c.dz * s; }
    while (u.n < N && u.t >= u.n * every) {
      u.n++; const dmg = D * P * [0.8, 0.6, 0.72][u.v] / N * g;
      f.hp = Math.min(f.hpMax, f.hp + dmg * [0.5, 0.4, 0.7][u.v]);
      if (u.v === 2) { const k = Math.min(foe.ki, 5); foe.ki -= k; f.ki = Math.min(100, f.ki + k); }
      this.emit('drainTick', { i: f.i, x: foe.x, y: foe.y + 1.6, z: foe.z, col });
      if (this.ultDmg(f, foe, dmg)) return;
    }
    if (u.t >= T) {
      u.link = 0;
      if (u.v === 1) { const h = c.dh || 1; this.emit('boom', { x: foe.x, y: foe.y + 1.5, z: foe.z, col, big: 2 }); if (g < 1) foe.set('idle'); this.hit(f, foe, { dmg: D * 0.42 * g, raw: 1, stun: 1, kb: 26, up: 11, launch: true, heavy: true, gbreak: 100, shot: 1 }, c.dx / h, c.dz / h); }
      this.endUlt(0.35);
    }
  }
  u_wave(u, f, foe) {
    const D = u.D, col = f.def.col, dt = VS_DT, sp = 30, n = u.v === 1 ? 3 : 1;
    if (!u.rings) { f.y = 0; u.rings = []; u.sp = 0; u.wx = f.x; u.wz = f.z; u.RM = Math.min(50, VS.R + Math.hypot(f.x, f.z) + 3); this.emit('slam', { x: f.x, z: f.z, col }); }
    while (u.sp < n && u.t >= u.sp * 0.5) { u.rings.push({ r: 1, dir: 1, hit: false }); u.sp++; this.emit('waveGo', { x: u.wx, z: u.wz, col }); }
    let live = 0; const rx = foe.x - u.wx, rz = foe.z - u.wz, dh = Math.hypot(rx, rz) || 0.001;
    for (const g of u.rings) {
      if (g.done) continue; live++; const r0 = g.r; g.r += sp * g.dir * dt;
      if (g.dir > 0 && g.r >= u.RM) { if (u.v === 2) { g.dir = -1; g.hit = false; this.emit('waveGo', { x: u.wx, z: u.wz, col, back: 1 }); } else g.done = true; }
      else if (g.dir < 0 && g.r <= 1.5) { g.done = true; this.emit('boom', { x: u.wx, y: 1.5, z: u.wz, col, big: 1 }); }
      if (!g.hit && !g.done && dh >= Math.min(r0, g.r) - 1.4 && dh <= Math.max(r0, g.r) + 1.4 && foe.y < 3.8 && foe.inv <= 0 && foe.st !== 'ko') {   // la onda pasa por donde está el rival, y está a ras de suelo
        g.hit = true; const soft = u.v === 1 ? g !== u.rings[2] : u.v === 2 && g.dir > 0;   // las ondas intermedias lo levantan poco: la siguiente también le alcanza
        this.hit(f, foe, { dmg: D * [1.0, 0.36, 0.52][u.v], raw: 1, stun: 0.9, kb: soft ? 3 : 16, up: soft ? 4 : 14, launch: !(u.v === 2 && soft), heavy: true, gbreak: 55, shot: 1 }, rx / dh * g.dir, rz / dh * g.dir);   // en la de ida y vuelta, la ida solo lo aturde: no se libra de la vuelta por estar en el suelo
      }
    }
    if (u.sp >= n && !live) this.endUlt(0.3);
  }
  u_spin(u, f, foe, c) {
    const D = u.D, dt = VS_DT, w = [5.4, 6.6, 5.0][u.v], T = [1.15, 2, 1.3][u.v] * 6.2832 / w, nb = u.v === 2 ? 2 : 1;
    if (u.a0 === undefined) { u.a0 = Math.atan2(c.dz, c.dx) - 1.6; u.cdH = [0, 0]; u.py = f.y + 1.7; this.emit('spinGo', { i: f.i }); }   // empieza fuera del rival: hay un instante para subir o bajar
    const a = u.v === 1 && u.t > T / 2 ? u.a0 + w * T / 2 - w * (u.t - T / 2) : u.a0 + w * u.t, dir = u.v === 1 && u.t > T / 2 ? -1 : 1;
    u.ang = a; u.len = Math.min(70, 6 + u.t * 140); u.px = f.x; u.pz = f.z;
    for (let k = 0; k < nb; k++) {
      if (u.cdH[k] > 0) { u.cdH[k] -= dt; continue; }
      const bx = Math.cos(a + k * Math.PI), bz = Math.sin(a + k * Math.PI), rx = foe.x - f.x, rz = foe.z - f.z, al = rx * bx + rz * bz, per = Math.abs(rx * bz - rz * bx);
      if (al > 0.5 && al < u.len && per < 2.4 && Math.abs(foe.y + 1.5 - u.py) < 2.8 && foe.inv <= 0 && foe.st !== 'ko') {
        u.cdH[k] = 0.45; this.emit('beamHit', { x: foe.x, y: foe.y + 1.5, z: foe.z, col: f.def.col });
        const end = u.v === 0 || u.t > T - 0.7;                           // solo la última pasada lo manda volando; las demás lo dejan en el sitio
        this.hit(f, foe, { dmg: D * [1.0, 0.52, 0.36][u.v], raw: 1, stun: 0.75, kb: end ? 22 : 2, up: 9, launch: end, heavy: true, gbreak: 60, shot: 1 }, -bz * dir, bx * dir);
      }
    }
    if (u.t >= T) { u.len = 0; this.endUlt(0.35); }
  }
  /** Esfera gigante: crece sobre quien la lanza, cae hacia el rival y revienta en un área grande */
  /** Manda un proyectil hacia arriba y de lado, lejos del que lo ha desviado */
  deflectShot(s, def) {
    const sp = Math.max(24, Math.hypot(s.vx, s.vy, s.vz)), h = Math.hypot(s.vx, s.vz) || 1, sg = this.rand() < 0.5 ? 1 : -1;
    const hx = s.vx / h, hz = s.vz / h; s.vx = (-hz * sg * 0.75 + hx * 0.2) * sp; s.vz = (hx * sg * 0.75 + hz * 0.2) * sp; s.vy = sp * 0.8;
    s.defl = 1; s.life = Math.min(s.life, 1.4); s.hm = 0; s.pierce = 0;
  }
  stepBomb(s, att, def) {
    const dt = VS_DT, grow = s.grow || 0.95, t = s.t - s.wait, px = -(def.z - att.z), pz = def.x - att.x, pl = Math.hypot(px, pz) || 1;
    if (s.defl) {                                                       // esfera desviada: sale despedida y revienta lejos, sin hacer daño
      s.vy -= 6 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      if (s.life <= 0 || s.y < s.r * 0.5 || Math.hypot(s.x, s.z) > VS.R + 10 || s.y > VS.TOP + 14) { this.emit('boom', { x: s.x, y: Math.max(1.5, s.y), z: s.z, col: s.col, big: s.R > 3 ? 2 : 1 }); return true; }
      return false;
    }
    if (t < grow) { s.r = 0.4 + (s.R - 0.4) * Math.max(0, t / grow); s.x = att.x + px / pl * s.off; s.z = att.z + pz / pl * s.off; s.y = att.y + 3.2 + s.r; return false; }
    if (!s.go) { s.go = true; this.emit('bombGo', { x: s.x, y: s.y, z: s.z }); }
    const dx = def.x - s.x, dy = def.y + 1 - s.y, dz = def.z - s.z, d = Math.hypot(dx, dy, dz) || 1, sp = s.sp, k = Math.min(1, 2.2 * dt);
    s.vx += (dx / d * sp - s.vx) * k * 3; s.vy += (dy / d * sp - s.vy) * k * 3; s.vz += (dz / d * sp - s.vz) * k * 3;
    s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    if (d < s.r + 0.8 && def.st === 'guard' && def.t < VS.PARRY_ULT && def.inv <= 0) { this.deflectShot(s, def); this.parryUlt(att, def, s.x, s.y, s.z); return false; }   // guardia justa: la esfera sale desviada
    if (d < s.r + 0.8 || s.y - s.r * 0.5 <= 0 || s.life <= 0) {
      const R = s.AR, dd = Math.hypot(def.x - s.x, def.y + 1.5 - Math.max(s.y, 1), def.z - s.z);
      this.emit('boom', { x: s.x, y: Math.max(1.5, s.y), z: s.z, col: s.col, big: s.R > 3 ? 2 : 1 });
      if (s.ring) for (let i = 0; i < 6; i++) { const a = i * 1.0472 + 0.5; this.blasts.push({ o: s.o, x: s.x + Math.cos(a) * 8.5, z: s.z + Math.sin(a) * 8.5, t: 0.2 + i * 0.09, col: s.col, big: 1, r: 5.5, dmg: 42 }); }
      if (dd < R && def.st !== 'ko' && def.inv <= 0) {
        const fall = 1 - 0.55 * (dd / R), g = def.st === 'guard' ? 0.35 : 1, h = Math.hypot(def.x - s.x, def.z - s.z) || 1;
        if (g < 1) def.set('idle');
        this.hit(att, def, { dmg: s.dm * fall * g, stun: 1.0, kb: 24, up: 12, launch: true, heavy: true, gbreak: 100 }, (def.x - s.x) / h, (def.z - s.z) / h);
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
