/* ============================================================================
   Lógica de los especiales de Z Legends 3, ejecutada tal cual la programó el juego original.
   Los árboles de eventos salen de sus hojas de Construct 2 (tools/make_zl3_choreo.py -> assets/zl3/m/ch_<luchador>.js):
   «si la técnica está en la parte X, fotograma N, y su sprite toca al rival: ponle Dano_Aereo1, quítale 20 de vida,
   espera 0,5 s y lánzalo hacia arriba». Aquí se interpretan cada paso de la simulación con nuestro mundo.

   Coordenadas: el original es 2D (x a la derecha, y hacia abajo, en píxeles del escenario). Se trabaja en el plano del
   atacante: origen O = donde empezó la técnica, eje X = hacia el rival (mirando a la derecha), Y = altura.
   1 px del escenario = ZC.PX unidades nuestras (el sprite del original está escalado x3.85 y 1 px de hoja = VS_U).
   Quién es quién: A / T = cajas del atacante y del rival · AV / TV = sus sprites visibles · S = el sprite de la técnica.
   Es determinista (azar con la semilla del combate): el online sigue igual en los dos lados.
   ============================================================================ */
/**
 * Objetos del original que viajan con «Bullet» (velocidad en px/s de sus instancias en los niveles). Lanzados en una técnica,
 * van hacia el rival como proyectiles de verdad (zcShot). Moro y Kefla mueven los suyos con eventos: velocidad aproximada
 */
const ZC_BULLETS = { kiblast_jogador_sprite: 1100, godslicerdance_spikes: 1300, gogetablue_godpunisher_kiblast_sprite: 1300, janemba_objetos: 1100, jiren_efeitos_sprite: 1500,
  kidbuu_e_cell_effects: 1500, kiensan_sprite: 1500, superbaby2_objetos: 1500, trunksobjetos_sprite: 1100, piccolo_e_android18_effect_sprite: 400, vegetaego_effects: 1500,
  bills_effects: 200, freeza_efeitos_sprite: 1400, gogetablue_effects_sprite: 1800, lightinggranade_sprite: 1500, moro73_lavaball_sprite: 700, kefla_giganticchaser_effect_sprite: 900 };
const ZC_BULLET = (k) => ZC_BULLETS[k] || 0;
const ZC = {
  PX: 0.056 / 3.85,          // unidades de mundo por píxel del escenario original
  SPR: 3.85,                 // escala del sprite del luchador en el original (punto de imagen -> píxeles del escenario)
  X0: 850, Y0: 906,          // dónde se pone al atacante en ese escenario imaginario (en el centro, en el suelo)
  HP: 250,                   // vida de un luchador en el original: el daño se escala a la nuestra
  DMG: 0.7,                  // ...y se suaviza un poco (los especiales del original quitan mucho)
  VARS: [250, 250, 250, 250, 250, 250, 0, 700]   // valores iniciales de las variables de la caja de un luchador
};
const ZC_CMP = (a, op, b) => op === 0 ? a === b : op === 1 ? a !== b : op === 2 ? a < b : op === 3 ? a <= b : op === 4 ? a > b : a >= b;

/** ¿Tiene lógica del original esta técnica? Devuelve {melee, guard} o null. melee: la técnica pega ella misma (no hace
 *  falta el golpe genérico de su tipo) · guard: es una postura de contraataque (espera a que le peguen) */
function zcInfo(cid, S) {
  const CH = typeof window !== 'undefined' && window.ZMOVE_CH && ZMOVE_CH[cid]; if (!CH || !S) return null;
  if (S._zc !== undefined) return S._zc;
  if (S.k === 'dr') return (S._zc = { melee: true, proj: false, guard: false });
  const parts = [].concat(S.P || [], S.H || [], S.E || []).map((q) => q[0]).filter((n) => CH[n]);
  if (!parts.length) return (S._zc = null);
  const trees = []; for (const n of parts) trees.push(...(CH[n].ev || []), ...(CH[n].fin || []));
  const own = trees.filter((t) => !t.p).map((t) => JSON.stringify(t)).join(''), js = trees.map((t) => JSON.stringify(t)).join('');
  const r = { melee: /"T","SubInstanceVar","",\[\["n",0\]|"TV","SetAnim"/.test(own), proj: trees.some((t) => t.p), guard: /"A","SetBoolInstanceVar","",\[\["n",24\],\["n",1\]/.test(js) && /defesa_effect_sprite","IsOverlapping"/.test(js) };
  return (S._zc = r);
}

Object.assign(VsSim.prototype, {
  /** Prepara la lógica del original al empezar un especial */
  zcStart(f, foe, p) {
    const cid = vsZTab(f.def) && /^z_/.test(f.def.sheet) ? f.def.sheet.slice(2) : null, CH = cid && window.ZMOVE_CH && ZMOVE_CH[cid];
    const info = cid && zcInfo(cid, p.S); if (!info) return;
    let nx = foe.x - f.x, nz = foe.z - f.z; const h = Math.hypot(nx, nz);
    if (h > 0.01) { nx /= h; nz /= h; } else { nx = this.cz; nz = -this.cx; }
    const kb = p.S && p.S.P && p.S.P.some((q) => CH && CH[q[0]] && (JSON.stringify(CH[q[0]]).match(/"(?:Spawn|CreateObject)","",\[\["o","[a-z_0-9]+"/g) || []).some((m) => ZC_BULLET(m.split('"o","')[1].slice(0, -1)))) ? 1 : 0;   // lanza objetos que viajan (zcShot)
    p.z = { kb, S: p.S, CH, cid, info, ox: f.x, oz: f.z, nx, nz, rate: 1, fi: -1, part: null, tk: new Map(), ev: new Map(), v: { A: ZC.VARS.slice(), T: ZC.VARS.slice(), S: [] }, g: { MODO_DE_JOGO: 1 }, wait: [], hold: false, tva: '', gh: -9, n: 0, po: new Set(), r0: 0, fx: {}, av: [0, 0], aen: 1 };
  },
  /* ---------- coordenadas del plano del atacante ---------- */
  zcObj(z, w, f, foe) { return w === 'A' || w === 'AV' || w === 'S' ? f : w === 'T' || w === 'TV' ? foe : null; },
  /**
   * Bola de ki del original (objeto con «Bullet», ~1100 px/s): sigue viajando aunque la técnica acabe.
   * Si sus propios eventos miran cuándo choca, el daño lo ponen ellos (aquí solo avisa de que ha tocado)
   */
  zcShot(z, f, foe, k) {
    if (z.S && z.S.k === 'buff') return;                                 // los potenciadores solo crean efectos alrededor del luchador
    if (z.shotN && z.shotN[k] > 6) return; (z.shotN || (z.shotN = {}))[k] = (z.shotN[k] || 0) + 1;   // ráfagas: como mucho 7 de cada objeto
    const first = !z.shotT; z.shotT = (z.shotT || 0) + 1;                // en una ráfaga, la primera pega entera y las demás un 40 %
    z.kb = 1;   // su daño va en la bola: sin golpe genérico al acabar
    const tx = foe.x - f.x, tz = foe.z - f.z, ty = foe.y + 1.5 - (f.y + 1.7), h = Math.hypot(tx, tz) || 1, d = Math.hypot(h, ty) || 1, sp = ZC_BULLET(k) * ZC.PX;
    const own = (z.ownHit || (z.ownHit = {}))[k] !== undefined ? z.ownHit[k] : (z.ownHit[k] = JSON.stringify(z.CH).includes('"' + k + '","IsOverlapping"') || JSON.stringify(z.CH).includes('"' + k + '","OnCollision"'));
    this.shots.push({ o: f.i, x: f.x + tx / h * 1.2, y: f.y + 1.7, z: f.z + tz / h * 1.2, vx: tx / d * sp, vy: ty / d * sp, vz: tz / d * sp, life: 2.2, r: 1.6, t: 0, hm: 0.001, col: f.def.col, pw: 2,
      zk: { z, k, own }, hs: first ? { dmg: VS.SPEC.shot, stun: 0.85, kb: 24, up: 6, launch: true, heavy: true, gbreak: 60, fz: 5, shot: 1 } : { dmg: VS.SPEC.shot * 0.4, stun: 0.5, kb: 6, gbreak: 20, fz: 2, shot: 1 } });
  },
  /**
   * ¿El rival está dentro del dibujo actual del atacante? En el original muchos poderes (el Kamehameha) van dibujados
   * en el propio sprite y el choque es contra ese sprite: el rayo largo toca en todo su largo
   */
  zcInFrame(z, f, foe) {
    const p = f.sp, P = p && p.seq && p.seq[p.si], F = P && ZMoves.partFrame(z.cid, P[0], p.pt || 0, !!P[2]);
    if (!F) return false;
    const k = 0.056, ax = foe.x - f.x, az = foe.z - f.z, along = ax * z.nx + az * z.nz, lat = Math.abs(ax * z.nz - az * z.nx);
    const a0 = -F.ax * k - 0.7, a1 = (F.w - F.ax) * k + 0.7, top = F.ay * k, low = -(F.h - F.ay) * k, fy = foe.y - f.y;   // el rival: medio cuerpo de ancho y 3 de alto
    return along > a0 && along < a1 && lat < 2.6 && fy < top && fy + 3 > low;
  },
  zcX(z, o) { return ZC.X0 + ((o.x - z.ox) * z.nx + (o.z - z.oz) * z.nz) / ZC.PX; },
  zcY(z, o) { return ZC.Y0 - o.y / ZC.PX; },
  zcSet(z, o, X, Y, ref) {
    const lat = ref ? (ref.x - z.ox) * -z.nz + (ref.z - z.oz) * z.nx : (o.x - z.ox) * -z.nz + (o.z - z.oz) * z.nx;
    if (X !== null) { const a = (X - ZC.X0) * ZC.PX; o.x = z.ox + z.nx * a - z.nz * lat; o.z = z.oz + z.nz * a + z.nx * lat; }
    if (Y !== null) o.y = Math.max(0, Math.min(VS.TOP, (ZC.Y0 - Y) * ZC.PX));
    o.vx = o.vy = o.vz = 0;
  },
  /** Punto de imagen ip del fotograma actual del atacante, en píxeles del escenario */
  zcIP(z, f, ip) {
    const e = z.CH[z.part], L = e && e.ip && e.ip[Math.max(0, z.fi)], q = L && ip ? L[Math.min(L.length, ip) - 1] : null;   // el punto ip (1 = el primero; 0 = el origen)
    const X = this.zcX(z, f), Y = this.zcY(z, f);
    return q ? [X + q[0] * ZC.SPR, Y + q[1] * ZC.SPR] : [X, Y];
  },
  /* ---------- variables ---------- */
  zcVar(z, w, i, f, foe) {
    const o = this.zcObj(z, w, f, foe);
    if (w === 'S' || w === 'AV' || w === 'TV') return z.v.S[(w === 'TV' ? 1000 : 0) + i] || 0;
    if (!o) return 0;
    if (i === 0) return o.hp / o.hpMax * ZC.HP;
    if (i === 6) return o.ki * 3;                                       // su barra de ki (en el original va hasta 300)
    if (i === 11) return o.y > 0.3 ? 1 : 0;                             // en el aire
    if (i === 17 && w === 'T') return o.st === 'guard' ? 1 : 0;         // defendiéndose
    const V = z.v[w === 'A' ? 'A' : 'T']; return V[i] || 0;
  },
  zcSetVar(z, w, i, val, f, foe) {
    if (w === 'S' || w === 'AV' || w === 'TV') { z.v.S[(w === 'TV' ? 1000 : 0) + i] = val; return; }
    const o = this.zcObj(z, w, f, foe); if (!o) return;
    if (w === 'T' && i === 0) { this.zcDmg(z, f, foe, this.zcVar(z, 'T', 0, f, foe) - val); return; }
    if (w === 'T' && i >= 47 && i <= 51 && val) { z.v.T[i] = val; z.lt = 1; return; }   // tipo de lanzamiento: lo resuelven sus bloques (ZMOVE_CHG)
    if (w === 'T' && i === 6) { foe.ki = Math.max(0, Math.min(100, val / 3)); return; }   // la defensa le gasta ki
    if (w === 'T' && i === 17 && !val && foe.st === 'guard') { foe.set('hurt'); foe.stun = 0.5; this.emit('break', { i: foe.i, x: foe.x, y: foe.y + 1.6, z: foe.z }); return; }   // le rompe la guardia
    if (i === 6) return;                                                // el ki del atacante lo cobra el botón
    z.v[w === 'A' ? 'A' : 'T'][i] = val;
  },
  /* ---------- efectos sobre el rival ---------- */
  zcDmg(z, f, foe, n) {
    if (!(n > 0) || foe.st === 'ko') return;
    const dmg = n * foe.hpMax / ZC.HP * ZC.DMG * f.pow; z.dd = (z.dd || 0) + dmg;
    if (this.damage(f, foe, dmg, true)) { z.ko = 1; return; }
    foe.flash = 0.12; this.emit('zcDmg', { i: foe.i, x: foe.x, y: foe.y + 1.5, z: foe.z, col: f.def.col });
  },
  zcPose(z, foe, name) {
    z.tva = name || '';
    if (foe.st === 'ko') return;
    const st = /^SendoLancado/.test(name) ? 'launched' : /^Caido|^Chao/.test(name) ? 'down' : /^Defesa/.test(name) ? 'guard' : /^Dano|^Atordoado/.test(name) ? 'hurt' : null;
    if (st && foe.st !== st) { const t = foe.t; foe.set(st); if (st === 'hurt') foe.t = t; }
    foe.stun = Math.max(foe.stun, 0.6); foe.zc = 1;
  },
  /** Lanzado: la dirección la da su pose (SendoLancado_CIMA, _FRENTE, _BAIXO…), la fuerza el número */
  zcLaunch(z, f, foe, n) {
    if (foe.st === 'ko') return;
    const a = z.tva || '', k = Math.max(0, n || 0), sx = this.zcX(z, foe) >= this.zcX(z, f) ? 1 : -1;
    let h = 4 + k * 1.8, v = 5 + k * 0.6;
    if (/CIMA/.test(a)) { h = 1.5 + k * 0.2; v = 9 + k * 1.3; } else if (/BAIXO/.test(a)) { h = 2 + k * 0.4; v = -(12 + k * 2.2); } else if (/TRAS/.test(a)) h = -h;
    z.hold = false; foe.zh = 0; foe.set('launched'); foe.stun = 0.7 + k * 0.04; foe.inv = 0;
    foe.vx = z.nx * h * sx; foe.vz = z.nz * h * sx; foe.vy = v; foe.y = Math.max(foe.y, 0.05);
    if (v < 0 && foe.y > 1) { foe.spk = f.i + 1; this.emit('spike', { i: foe.i, x: foe.x, y: foe.y + 1.5, z: foe.z }); }
  },
  /* ---------- expresiones y condiciones ---------- */
  zcE(e, z, f, foe) {
    if (!e) return 0;
    switch (e[0]) {
      case 'n': return e[1];
      case 's': return e[1];
      case 'g': return z.g[e[1]] || 0;
      case 'v': return this.zcVar(z, e[1], e[2], f, foe);
      case 'op': {
        const a = this.zcE(e[2], z, f, foe), b = this.zcE(e[3], z, f, foe);
        switch (e[1]) {
          case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return b ? a / b : 0; case '%': return b ? a % b : 0;
          case '^': return Math.pow(a, b); case '&': return String(a) + String(b); case 'or': return a || b ? 1 : 0;
          case '=': return a === b ? 1 : 0; case '<>': return a !== b ? 1 : 0; case '<': return a < b ? 1 : 0; case '<=': return a <= b ? 1 : 0; case '>': return a > b ? 1 : 0; case '>=': return a >= b ? 1 : 0;
        }
        return 0;
      }
      case 'f': {
        const A = (e[2] || []).map((x) => this.zcE(x, z, f, foe));
        switch (e[1]) {
          case 'dt': return VS_DT;
          case 'choose': return A.length ? A[Math.floor(this.rand() * A.length) % A.length] : 0;
          case 'random': return A.length > 1 ? A[0] + this.rand() * (A[1] - A[0]) : this.rand() * (A[0] || 1);
          case 'distance': return Math.hypot(A[2] - A[0], A[3] - A[1]);
          case 'abs': return Math.abs(A[0]); case 'min': return Math.min(...A); case 'max': return Math.max(...A);
          case 'floor': case 'int': return Math.floor(A[0]); case 'round': return Math.round(A[0]); case 'ceil': return Math.ceil(A[0]);
          case 'angle': return Math.atan2(A[3] - A[1], A[2] - A[0]) * 180 / Math.PI;
          case 'lerp': return A[0] + (A[1] - A[0]) * A[2];
        }
        return 0;
      }
      case 'x': {
        const o = this.zcObj(z, e[1], f, foe), fn = e[2], A = e[3] || [];
        if (!o) return 0;
        if (fn === 'X') return this.zcX(z, o);
        if (fn === 'Y') return this.zcY(z, o);
        if (fn === 'ImagePointX' || fn === 'ImagePointY') { const ip = A.length ? this.zcE(A[0], z, f, foe) : 0, P = o === f ? this.zcIP(z, f, ip) : [this.zcX(z, o), this.zcY(z, o)]; return fn === 'ImagePointX' ? P[0] : P[1]; }
        if (fn === 'AnimationFrame') return o === f ? Math.max(0, z.fi) : 0;
        if (fn === 'Width') return 93; if (fn === 'Height') return 167;
        if (fn === 'Count') return 1;
        return 0;
      }
    }
    return 0;
  },
  zcCond(c, z, f, foe, ctx, node) {
    const [w, fn, beh, inv, P] = c; let r;
    const E = (i) => this.zcE(P[i], z, f, foe);
    switch (fn) {
      case 'IsAnimPlaying': { const X = z.fx[w]; r = w === 'S' || w === 'AV' ? z.part === E(0) : w === 'TV' ? z.tva === E(0) : !!X && (!X[3] || X[3] === E(0)); break; }
      case 'OnAnimFinished': r = !!ctx.fin && ctx.fin === E(0); break;
      case 'CompareFrame': {
        if (w === 'S' || w === 'AV') { r = ZC_CMP(z.fi, E(0), E(1)); break; }
        const X = z.fx[w]; r = !!X && ZC_CMP(Math.floor((z.tt - X[2]) * 15), E(0), E(1));   // un efecto: su fotograma, por el tiempo que lleva (≈15 fps)
        break;
      }
      case 'OnFrameChanged': r = (w === 'S' || w === 'AV') && z.fch; break;
      case 'TriggerOnce': { const last = z.tk.get(node); z.tk.set(node, z.n); r = last !== z.n - 1; break; }
      case 'Every': { const t = E(0), last = z.ev.get(node); r = last === undefined || z.tt - last >= t - 1e-6; if (r) z.ev.set(node, z.tt); break; }
      case 'IsMirrored': {
        const o = this.zcObj(z, w, f, foe);
        r = o === foe ? this.zcX(z, foe) > this.zcX(z, f) : false;   // el atacante mira a la derecha; el rival, hacia él
        break;
      }
      case 'OnCollision': case 'IsOverlapping': {
        const P0 = P[0] && P[0][1];
        if (/defesa_effect_sprite/.test(w)) { r = (P0 === 'A' || P0 === 'AV') && z.n - z.gh <= 1; break; }   // le han pegado mientras se defendía (postura de contraataque)
        const o1 = this.zcObj(z, w, f, foe), o2 = this.zcObj(z, P0, f, foe);
        if (!o1 && o2 === foe) {                                         // un efecto o poder aparte toca al rival
          const X = z.fx[w];
          if (X && foe.st !== 'ko' && Math.abs(X[0] - this.zcX(z, foe)) < 230 && Math.abs(X[1] - (this.zcY(z, foe) - 80)) < 230) { r = true; break; }   // nació donde está el rival (o a su lado)
          if (X && ZC_BULLET(w)) { r = !!(z.shotHit && z.shotHit[w]) && foe.st !== 'ko'; break; }   // objeto que viaja (zcShot): toca cuando llega
          if (X && foe.st !== 'ko' && z.S && z.S.k === 'beam' && !(foe.inv > 0 && !foe.zc)) {   // un rayo: toca en todo su largo, no solo donde nace
            const ax = foe.x - f.x, az = foe.z - f.z, along = ax * z.nx + az * z.nz, lat = Math.abs(ax * z.nz - az * z.nx), reach = Math.max(6, z.S.R * 0.056 + 1.4);
            if (along > 0 && along < reach && lat < 2.6 && Math.abs(foe.y - f.y) < 3) { r = true; break; }
          }
          r = foe.st !== 'ko' && (!!z.ph || (z.info.melee && !!z.contact)) && !z.po.has(node);   // un rayo o una esfera que viaja: si su golpe ha acertado (una vez: se gasta al tocar)
          if (r) z.po.add(node);
          break;
        }
        if (o1 && o2 && o1 !== o2) {
          const dh = Math.hypot(o1.x - o2.x, o1.z - o2.z), dy = Math.abs(o1.y - o2.y), vis = w === 'AV' || w === 'S' || P0 === 'TV';
          r = (dh < (vis ? VS.REACH + 0.5 : 1.9) || (vis && this.zcInFrame(z, f, foe))) && dy < 2.6 && foe.st !== 'ko' && !(foe.inv > 0 && !foe.zc);
          if (r && (o1 === f || o2 === f)) z.contact = 1;
        } else r = false;
        break;
      }
      case 'CompareInstanceVar': r = ZC_CMP(this.zcObj(z, w, f, foe) || w === 'S' || w === 'AV' || w === 'TV' ? this.zcVar(z, w, E(0), f, foe) : 0, E(1), E(2)); break;
      case 'IsBoolInstanceVarSet': r = !!this.zcVar(z, w, E(0), f, foe); break;
      case 'CompareVar': r = ZC_CMP(z.g[P[0] && P[0][1]] || 0, E(1), E(2)); break;
      case 'PickByComparison': r = ZC_CMP(E(1), E(2), E(3)); break;
      case 'CompareX': { const o = this.zcObj(z, w, f, foe); r = !!o && ZC_CMP(this.zcX(z, o), E(0), E(1)); break; }
      case 'CompareY': { const o = this.zcObj(z, w, f, foe); r = !!o && ZC_CMP(this.zcY(z, o), E(0), E(1)); break; }
      case 'IsFalling': { const o = this.zcObj(z, w, f, foe); r = !!o && o.vy < 0 && o.y > 0; break; }
      case 'IsOnFloor': { const o = this.zcObj(z, w, f, foe); r = !!o && o.y <= 0.05; break; }
      case 'Else': r = !ctx.prev; break;
      case 'IsVisible': case 'PickByUID': r = true; break;               // objetos del escenario o efectos: se dan por buenos
      case 'Compare': case 'CompareTime': r = true; break;
      default: r = false;
    }
    return inv ? !r : r;
  },
  /* ---------- acciones ---------- */
  zcAct(a, z, f, foe, rest) {
    const [w, fn, beh, P] = a, E = (i) => this.zcE(P[i], z, f, foe), o = this.zcObj(z, w, f, foe);
    switch (fn) {
      case 'Wait': z.wait.push({ t: z.tt + E(0), acts: rest }); return 'wait';
      case 'SetPos': if (o === f || o === foe) { this.zcSet(z, o, E(0), E(1), o === foe ? f : null); if (o === foe) this.zcHold(z, foe); } break;
      case 'SetX': if (o === f || o === foe) { this.zcSet(z, o, E(0), null, o === foe ? f : null); if (o === foe) this.zcHold(z, foe); } break;
      case 'SetY': if (o === f || o === foe) { this.zcSet(z, o, null, E(0)); if (o === foe) this.zcHold(z, foe); } break;
      case 'SetPosToObject': {
        const tgt = P[0] && P[0][1], ip = P.length > 1 ? E(1) : 0;
        if (o === foe && (tgt === 'S' || tgt === 'AV' || tgt === 'A')) { const q = this.zcIP(z, f, ip); this.zcSet(z, foe, q[0], q[1], f); this.zcHold(z, foe); }
        else if (o === f && (tgt === 'T' || tgt === 'TV')) this.zcSet(z, f, this.zcX(z, foe), this.zcY(z, foe), foe);
        break;
      }
      case 'MoveAtAngle': if (o === f || o === foe) { const an = E(0) * Math.PI / 180, d = E(1); this.zcSet(z, o, this.zcX(z, o) + Math.cos(an) * d, this.zcY(z, o) + Math.sin(an) * d); } break;
      case 'SetVectorX': if (o === f) { z.av[0] = E(0); break; } if (o === foe) { this.zcFree(z, foe); const v = E(0) * ZC.PX; foe.vx = z.nx * v; foe.vz = z.nz * v; } break;
      case 'SetVectorY': if (o === f) { z.av[1] = E(0); break; } if (o === foe) { this.zcFree(z, foe); foe.vy = -E(0) * ZC.PX; if (foe.vy > 0) foe.y = Math.max(foe.y, 0.05); } break;
      case 'SetJumpStrength': if (o === foe) z.js = E(0); break;
      case 'SimulateControl': if (o === foe && E(0) === 2) { this.zcFree(z, foe); foe.vy = (z.js || 650) * ZC.PX; foe.y = Math.max(foe.y, 0.05); } break;   // salta (lo lanza hacia arriba)
      case 'SetEnabled': if (beh === 'Platform' && o === f) { z.aen = E(0) ? 1 : 0; if (!z.aen) z.av = [0, 0]; break; } if (beh === 'Platform' && o === foe) { if (E(0)) { z.hold = false; foe.zh = 0; } else this.zcHold(z, foe); } break;
      case 'SetInstanceVar': this.zcSetVar(z, w, E(0), E(1), f, foe); break;
      case 'AddInstanceVar': this.zcSetVar(z, w, E(0), this.zcVar(z, w, E(0), f, foe) + E(1), f, foe); break;
      case 'SubInstanceVar': this.zcSetVar(z, w, E(0), this.zcVar(z, w, E(0), f, foe) - E(1), f, foe); break;
      case 'SetBoolInstanceVar': this.zcSetVar(z, w, E(0), E(1) ? 1 : 0, f, foe); break;
      case 'ToggleBoolInstanceVar': this.zcSetVar(z, w, E(0), this.zcVar(z, w, E(0), f, foe) ? 0 : 1, f, foe); break;
      case 'SetAnim':
        if (z.fx[w]) { z.fx[w][3] = E(0); z.fx[w][2] = z.tt; }           // un efecto cambia de animación
        if (w === 'TV') this.zcPose(z, foe, E(0));
        else if (w === 'S' || w === 'AV') z.go = E(0);
        break;
      case 'SetAnimFrame': if (w === 'S' || w === 'AV') z.gof = E(0); break;
      case 'SetAnimSpeed': if (w === 'S' || w === 'AV') { const e = z.CH[z.part], v = Math.max(0, E(0)); if (v === 0 && z.s0 === z.part + ':' + z.fi) break; z.rate = e && e.sp ? v / e.sp : 1; } break;
      case 'Spawn': {
        const k = P[0] && P[0][1];
        if (o === foe && /hit_/.test(k)) this.emit('zHit', { i: f.i, x: foe.x, y: foe.y + 1.5, z: foe.z, col: f.def.col, sp: 1 });
        else if (/defesa/.test(k)) this.emit('guard', { i: o === f ? f.i : foe.i, x: (o || f).x, y: (o || f).y + 1.6, z: (o || f).z });
        if (o === f || o === foe) { const q = o === f ? this.zcIP(z, f, P.length > 2 ? E(2) : 0) : [this.zcX(z, foe), this.zcY(z, foe) - 80]; z.fx[k] = [q[0], q[1], z.tt]; }
        if (o === f && ZC_BULLET(k)) this.zcShot(z, f, foe, k);
        break;
      }
      case 'CallFunction': {
        const n = E(0);
        if (n === 'PAUSAR INIMIGO') { z.frz = 1; foe.zh = 0.2; foe.vx = foe.vy = foe.vz = 0; if (/^(atk|heavy|flurry|grab|dash|shot)$/.test(foe.st)) { foe.set('stun'); foe.stun = 0.5; } foe.zc = 1; }   // el rival se queda parado (y su golpe, cortado)
        else if (n === 'DESPAUSAR INIMIGO') z.frz = 0;
        else if (/^Hit_Stop/.test(n)) this.freeze = Math.max(this.freeze, /Leve/.test(n) ? 4 : 8);
        else if (/Dano_Forte/.test(n)) this.emit('zHit', { i: f.i, x: foe.x, y: foe.y + 1.5, z: foe.z, col: f.def.col, sp: 1 });
        break;
      }
      case 'Shake': this.emit('shake', { k: Math.min(1, E(0) / 6) }); break;
      case 'CreateObject': { const k = P[0] && P[0][1]; if (k && P.length > 3) z.fx[k] = [E(2), E(3), z.tt]; z.proj = 1; if (k && ZC_BULLET(k)) this.zcShot(z, f, foe, k); break; }
      case 'SetVar': if (P[0] && P[0][0] === 'g') z.g[P[0][1]] = E(1); break;
    }
    return null;
  },
  /** El rival sale despedido con su física (lanzado) */
  zcFree(z, foe) {
    if (foe.st === 'ko') return; z.hold = false; z.frz = 0; foe.zh = 0;
    if (foe.st !== 'launched') { foe.set('launched'); foe.inv = 0; } foe.stun = Math.max(foe.stun, 0.8);
  },
  zcHold(z, foe) { if (foe.st === 'ko') return; z.hold = true; foe.zh = 0.2; foe.vx = foe.vy = foe.vz = 0; foe.zc = 1; if (foe.st !== 'hurt' && foe.st !== 'launched' && foe.st !== 'down') { foe.set('hurt'); } foe.stun = Math.max(foe.stun, 0.5); },
  zcActs(L, z, f, foe) { for (let i = 0; i < L.length; i++) if (this.zcAct(L[i], z, f, foe, L.slice(i + 1)) === 'wait') return; },
  /** Un árbol de eventos (con sus subeventos y sus «Else») */
  zcRun(t, z, f, foe, ctx) {
    let ok;
    if (t.or) { ok = false; for (const c of t.c) if (this.zcCond(c, z, f, foe, ctx, t)) { ok = true; } }
    else { ok = true; for (const c of t.c) if (!this.zcCond(c, z, f, foe, ctx, t)) { ok = false; break; } }
    if (!ok) { if (t.c.some((c) => c[1] === 'TriggerOnce')) { /* deja de cumplirse: el TriggerOnce se rearma */ } return false; }
    if (t.a) this.zcActs(t.a, z, f, foe);
    if (t.s) { const sub = { fin: ctx.fin, prev: true }; for (const s of t.s) { const r = this.zcRun(s, z, f, foe, sub); sub.prev = r; } }
    return true;
  },
  /** Un paso de la técnica. Devuelve true si la lógica del original ha decidido cómo sigue (cambio de parte o fin) */
  zcTick(f, foe, p) {
    const z = p.z, P = p.seq[p.si], part = P && P[0], e = z.CH[part];
    z.n++; z.tt = p.tt; z.part = part;
    if (e) {                                                           // fotograma actual (a la velocidad base del original)
      let k = 0; while (k < e.f.length - 1 && p.pt >= e.f[k + 1] - 1e-6) k++;
      z.fch = k !== z.fi; z.fi = k;
    } else { z.fch = false; z.fi = 0; }
    z.go = null; z.gof = null;
    if (z.aen && (z.av[0] || z.av[1])) {                               // el atacante con su física (vectores de su plataforma: px/s, frena y cae como en el original)
      this.zcSet(z, f, this.zcX(z, f) + z.av[0] * VS_DT, this.zcY(z, f) + z.av[1] * VS_DT);
      const dec = 1500 * VS_DT; z.av[0] = Math.abs(z.av[0]) <= dec ? 0 : z.av[0] - Math.sign(z.av[0]) * dec;
      if (f.y > 0.02 || z.av[1] < 0) z.av[1] += 1500 * VS_DT; if (f.y <= 0.02 && z.av[1] > 0) z.av[1] = 0;
    }
    for (let i = 0; i < z.wait.length; i++) { const w = z.wait[i]; if (z.tt >= w.t) { z.wait.splice(i--, 1); this.zcActs(w.acts, z, f, foe); } }   // lo que esperaba un «Wait»
    const G = !e || e.ev ? null : window.ZMOVE_DR && ZMOVE_DR[part];   // el Dragon Rush es igual para todos (cambian sus fotogramas)
    if (e && e.ev) for (const t of e.ev) this.zcRun(t, z, f, foe, {});
    else if (G) for (const t of G.ev) this.zcRun(t, z, f, foe, {});
    this.zcLaunchRun(z, f, foe);
    if (z.hold && foe.st !== 'ko') { foe.zh = 0.2; foe.vx = foe.vy = foe.vz = 0; foe.stun = Math.max(foe.stun, 0.5); }
    // Animación parada (SetAnimSpeed 0) esperando a que su poder aparte (el rayo, la esfera) termine: aquí no existe, sigue sola
    if (z.rate === 0 && !z.wait.length) {
      if ((z.r0 += VS_DT) > 0.9) { z.rate = 1; z.r0 = 0; z.s0 = z.part + ':' + z.fi; if (e && e.f[z.fi + 1] !== undefined) p.pt = e.f[z.fi + 1]; }   // y no se vuelve a parar en ese fotograma
    } else z.r0 = 0;
    if (z.frz && foe.st !== 'ko') { foe.zh = 0.2; foe.stun = Math.max(foe.stun, 0.5); }
    return this.zcFlow(f, foe, p);
  },
  /** Cambios de parte que pide la lógica (SetAnim / SetAnimFrame) y lo que hace al acabar cada parte (OnAnimFinished) */
  zcFlow(f, foe, p) {
    const z = p.z;
    if (z.ko) { this.endSpec(f, foe); return true; }
    if (z.gof !== null && (z.gofN = (z.gofN || 0) + 1) < 12) { const e = z.CH[z.part]; if (e && e.f[z.gof] !== undefined) { p.pt = e.f[z.gof] + 1e-4; z.fi = z.gof; } }   // saltos de fotograma (con tope: los bucles de «mantén pulsado» acaban)
    if (z.go) return this.zcGo(f, foe, p, z.go);
    const P = p.seq[p.si];
    if (P && p.pt >= P[1]) {                                           // acaba la parte: sus eventos «al acabar»
      const e = z.CH[P[0]], fin = (e && e.fin) || (window.ZMOVE_DR && ZMOVE_DR[P[0]] && ZMOVE_DR[P[0]].fin);
      if (fin) { z.go = null; for (const t of fin) this.zcRun(t, z, f, foe, { fin: P[0] }); if (z.go) return this.zcGo(f, foe, p, z.go); }
      if (z.info.guard && !z.trig && p.si === 0) { this.endSpec(f, foe); return true; }   // la postura terminó sin que le pegaran
    }
    return false;
  },
  zcGo(f, foe, p, name) {
    const z = p.z, S = p.S; z.go = null;
    if (!/^(Special|Ultimate|Transformation|Attack|Dragon)/.test(name)) { this.endSpec(f, foe); return true; }   // vuelve a Parado / Pulando: se acabó
    for (const seq of [p.seq, S.P, S.H, S.E]) {
      const i = seq ? seq.findIndex((q) => q[0] === name) : -1;
      if (i >= 0) {
        if (seq === p.seq && i === p.si) { p.pt = 0; } else { p.seq = seq; p.si = i; p.pt = 0; }
        z.rate = 1; z.fi = -1; if (z.info.guard) z.trig = 1;
        return true;
      }
    }
    return false;
  },
  /** Tipos de lanzamiento del original (variables 47..51 del rival): sus bloques lo lanzan y las ponen a 0 */
  zcLaunchRun(z, f, foe) {
    if (!z.lt) return;
    const G = window.ZMOVE_CHG || [];
    for (const t of G) this.zcRun(t, z, f, foe, {});
    for (let i = 47; i <= 51; i++) if (z.v.T[i]) { if (i === 47) this.zcLaunch(z, f, foe, z.v.T[i]); z.v.T[i] = 0; }   // sin bloque para ese número: lanzamiento aproximado
    z.lt = 0;
  },
  /** Al acabar la técnica: el rival vuelve a su física (si estaba sujeto, cae) */
  zcEnd(f, foe, p) {
    const z = p && p.z; if (!z) return;
    for (const w of z.wait.splice(0)) this.zcActs(w.acts, z, f, foe);   // lo que quedaba pendiente (un «Wait» corto antes del empujón)
    this.zcLaunchRun(z, f, foe);
    // Técnicas de disparo o rayo cuyo proyectil lanza otro objeto desde la lógica general del original (Candy Beam, Meteor Shower...):
    // si han acabado sin pegar ni lanzar nada, sale su disparo hacia el rival
    if (!z.dd && !z.shotT && !z.ph && !p.res && !(z.info.melee && z.contact) && foe.st !== 'ko' && z.S && (z.S.k === 'shot' || z.S.k === 'beam') && !z.info.guard && !(z.S.R < 60 && z.S.k === 'beam')) this.zcShot(z, f, foe, 'kiblast_jogador_sprite');
    if (!z.dd && foe.st !== 'ko' && z.info.melee && z.contact && !z.info.guard) {   // tocó al rival pero sus eventos no llegaron a pegarle: un golpe fuerte
      const h = Math.hypot(foe.x - f.x, foe.z - f.z) || 1; foe.zh = 0;
      this.hit(f, foe, { dmg: VS.SPEC.rushEnd, stun: 0.9, kb: 26, up: 8, launch: true, heavy: true, gbreak: 60, fz: 6 }, (foe.x - f.x) / h, (foe.z - f.z) / h);
    } else if (z.ph && !z.dd && !z.kb && foe.st !== 'ko') {                            // su poder acertó pero sus eventos no llegaron a pegar: golpe de su tipo
      const h = Math.hypot(foe.x - f.x, foe.z - f.z) || 1;
      this.hit(f, foe, { dmg: VS.SPEC.beam, stun: 0.9, kb: 26, up: 7, launch: true, heavy: true, gbreak: 60, fz: 6, shot: 1 }, (foe.x - f.x) / h, (foe.z - f.z) / h);
    }
    foe.zh = 0; foe.zc = 0;
    if (foe.st === 'ko') return;
    if (z.hold || z.frz) { if (foe.y > 0.4) { foe.set('launched'); foe.stun = 0.5; foe.vy = 0; } else { foe.set('hurt'); foe.stun = 0.35; } }
    else if (foe.y > 0.4 && /^(hurt|stun|down)$/.test(foe.st)) { foe.set('launched'); foe.stun = 0.5; }   // suelto en el aire: cae
  }
});
