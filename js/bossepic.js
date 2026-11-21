'use strict';
/* =====================================================================
   bossepic.js · Jefes de Supervivencia más épicos y más duros.
   - Entrada: el cielo se oscurece, caen rayos, la cámara va al jefe y sale
     su rótulo con kanji y su frase, con impact frames hechos con su sprite.
   - Ataque definitivo: cada jefe tiene uno propio (rayo, esfera gigante o
     explosión), con un aviso largo para poder esquivarlo.
   - Choque: si te lanza un rayo o una esfera y tienes la Ultimate lista,
     puedes responder con [Ultimate] y empujar machacando (y gastando ki).
   - Barra de vida por capas (una por forma), retrato, rastro de daño y
     cofre del jefe al vencerlo.
   El juego llama a: BossEpic.onSpawn, tick (desde bossAI), tryClash (desde
   ultimate), update (estados 'bossintro' y 'bossclash'), hud y openChest.
   ===================================================================== */

/** Más duros: vida, cadencia de técnicas, daño y velocidad (los usa game.js) */
const BOSS_HARD = { hp: 1.15, cd: 0.85, dmg: 1.12, spd: 0.68 };

/** Kanji, frase de entrada y ataque definitivo de cada jefe. t: 'beam' (rayo), 'ball' (esfera gigante), 'nova' (explosión alrededor) */
const BOSS_EPIC = {
  freezer:  { kj: 'フリーザ', q: 'Os enseñaré por qué me llaman el emperador del universo.', u: { n: 'SUPERNOVA DEFINITIVA', t: 'ball', c: 0xff8a30 } },
  cell:     { kj: 'セル', q: 'Soy perfecto. Vuestra resistencia solo hará más divertido el final.', u: { n: 'KAMEHAMEHA SOLAR', t: 'beam', c: 0x60c8ff } },
  broly:    { kj: 'ブロリー', q: '...¡¡KAKAROTTOOO!!', u: { n: 'METEORO OMEGA', t: 'ball', c: 0x7dff5a } },
  buu:      { kj: '魔人ブウ', q: '¡Jijiji! ¡Buu romper todo!', u: { n: 'BOMBA PLANETARIA', t: 'ball', c: 0xff7ad0 } },
  omega:    { kj: '一星龍', q: 'Las Bolas de Dragón os han traído la ruina.', u: { n: 'BOLA DE ENERGÍA NEGATIVA', t: 'ball', c: 0x7a9cff } },
  jiren:    { kj: 'ジレン', q: 'La fuerza lo es todo.', u: { n: 'IMPACTO DEFINITIVO', t: 'nova', c: 0xff5050 } },
  beerus:   { kj: '破壊神', q: 'Me aburro. Entretenme antes de que destruya este planeta.', u: { n: 'ESFERA DE LA DESTRUCCIÓN', t: 'ball', c: 0xc87aff } },
  zamasu:   { kj: 'ザマス', q: 'Mortales: vuestra existencia es un error que voy a corregir.', u: { n: 'IRA DIVINA', t: 'nova', c: 0xff7ab8 } },
  cooler:   { kj: 'クウラ', q: 'No soy como mi hermano. Yo no dejo cabos sueltos.', u: { n: 'SUPERNOVA DE COOLER', t: 'ball', c: 0xb070ff } },
  janemba:  { kj: 'ジャネンバ', q: '¡¡GRRRAAAH!!', u: { n: 'PORTAL DEL INFIERNO', t: 'nova', c: 0xff3a5a } },
  superbuu: { kj: '魔人ブウ', q: 'Te convertiré en chocolate... y te comeré.', u: { n: 'KAMEHAMEHA DE BUU', t: 'beam', c: 0xff7ad0 } },
  hit:      { kj: 'ヒット', q: 'Ya he medido tu poder. Esto terminará pronto.', u: { n: 'SALTO TEMPORAL MORTAL', t: 'nova', c: 0x8a7aff } },
  toppo:    { kj: 'トッポ', q: 'Por la justicia del Universo 11.', u: { n: 'DESTRUCCIÓN DE LA JUSTICIA', t: 'ball', c: 0xa070ff } },
  a16:      { kj: '人造人間', q: 'Objetivo localizado. Iniciando eliminación.', u: { n: 'HELL FLASH', t: 'beam', c: 0xffd24a } },
  raditz:   { kj: 'ラディッツ', q: 'Un Saiyan débil no merece vivir.', u: { n: 'SATURDAY CRUSH', t: 'ball', c: 0xb070ff } },
  turles:   { kj: 'ターレス', q: 'El fruto del Árbol Sagrado me hace invencible.', u: { n: 'KILL DRIVER', t: 'nova', c: 0xffb030 } },
  black:    { kj: 'ブラック', q: 'Mortales... vuestro final será hermoso.', u: { n: 'KAMEHAMEHA NEGRO', t: 'beam', c: 0xff4aa8 } },
  nappa:    { kj: 'ナッパ', q: '¡Je, je! ¡Vamos a divertirnos un rato!', u: { n: 'BOMBA GIGANTE', t: 'nova', c: 0xffd24a } },
  ginyu:    { kj: 'ギニュー', q: '¡Fuerzas Especiales Ginyu, en posición!', u: { n: 'MILKY CANNON', t: 'beam', c: 0xb070ff } },
  moro:     { kj: 'モロ', q: 'Tu energía será mía.', u: { n: 'ABSORCIÓN PLANETARIA', t: 'nova', c: 0x7affa0 } },
  baby:     { kj: 'ベビー', q: '¡La venganza de los Tsufur empieza contigo!', u: { n: 'REVENGE DEATH BALL', t: 'ball', c: 0xff7a3a } }
};
const BOSS_LAYERS = ['#3ddc6a', '#ffd23a', '#ff8a2a', '#ff2a4a'];     // color de cada capa de vida (la última, roja)
const BE = {
  INTRO: 3.0,                       // duración de la entrada
  CHARGE: 2.6,                      // carga del ataque definitivo
  FIRST: 5, EVERY: 26, EVERY_LAST: 20,   // primer ataque definitivo al entrar en la 2.ª forma y cada cuánto
  CLASH: { intro: 0.8, push: 4.5, out: 0.9, decay: 4, K: 0.5, mult: 1.9, burn: 0.32, win: 0.12, lose: 0.4 }
};
const hexC = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0').slice(-6);

const BossEpic = {
  el: null, u: null, c: null, art: {}, taps: 0,
  init() {
    if (this.el) return;
    const st = document.createElement('style'); st.textContent = BOSS_EPIC_CSS; document.head.appendChild(st);
    const d = this.el = document.createElement('div'); d.id = 'bossEpic';
    d.innerHTML = '<div class="beSky"></div><i class="beBar t"></i><i class="beBar b"></i><div class="beCard"><span class="beKj"></span><small>¡HA APARECIDO UN JEFE!</small><b class="beName"></b><em class="beForm"></em><q class="beQ"></q></div>' +
      '<div class="beUlt"><small>ATAQUE DEFINITIVO</small><b></b><span class="beTip"></span><i class="beCd"><i></i></i></div>' +
      '<div class="beClash"><h3>¡CHOQUE CON EL JEFE!</h3><div class="beCb"><i class="a"></i><i class="b"></i><s></s></div><div class="beCn"><span class="l"></span><span class="r"></span></div><p class="beCh"></p></div>';
    document.body.appendChild(d);
    window.addEventListener('pointerdown', () => { if (this.c && this.c.ph === 1) this.taps++; });   // en el móvil: tocar la pantalla empuja
  },
  reset() { this.init(); this.u = null; this.c = null; this.el.classList.remove('intro', 'ult', 'clash'); if (this.bm) for (const m of this.bm) m.mesh.visible = false; },
  look(B) { return BOSS_EPIC[B.id] || { kj: '強敵', q: '', u: { n: 'ATAQUE DEFINITIVO', t: 'ball', c: B.col || 0xff5050 } }; },
  key(a) { return typeof Binds !== 'undefined' ? Binds.label(a) : a; },

  /* ---------- Impact frames con el sprite del jefe: silueta negra y blanca ---------- */
  bossArt(game, B, ph) {
    const sheet = B.sheets ? B.sheets[ph] : B.sheet, row = B.rows ? B.rows[ph] : B.row | 0, k = sheet + ':' + row;
    if (this.art[k] !== undefined) return this.art[k];
    const sh = game.ui.sheets && game.ui.sheets[sheet], img = sh && sh.tex && sh.tex.image;
    if (!img || !img.width) return null;
    try {
      const cw = Math.floor(img.width / sh.cols), ch = Math.floor(img.height / sh.rows), t = document.createElement('canvas'); t.width = cw; t.height = ch;
      const g = t.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, Math.min(row, sh.rows - 1) * ch, cw, ch, 0, 0, cw, ch);
      const D = g.getImageData(0, 0, cw, ch).data; let x0 = cw, y0 = ch, x1 = 0, y1 = 0;
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (D[(y * cw + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < x0) return (this.art[k] = null);
      const w = x1 - x0 + 3, h = y1 - y0 + 3, sil = (col) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const q = c.getContext('2d'); q.drawImage(t, x0, y0, w - 2, h - 2, 1, 1, w - 2, h - 2); q.globalCompositeOperation = 'source-in'; q.fillStyle = col; q.fillRect(0, 0, w, h); return c; };
      const black = sil('#000'), white = sil('#fff'), A = document.createElement('canvas'); A.width = w * 2; A.height = h; const a = A.getContext('2d'); a.imageSmoothingEnabled = false;
      a.drawImage(black, 0, 0);
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) a.drawImage(black, w + ox, oy);   // contorno negro de la silueta blanca
      a.drawImage(white, w, 0);
      const col = document.createElement('canvas'); col.width = w; col.height = h; col.getContext('2d').drawImage(t, x0, y0, w - 2, h - 2, 1, 1, w - 2, h - 2);   // en color (retrato de la barra)
      return (this.art[k] = { im: A, d: { w, h }, c: col });
    } catch (e) { return (this.art[k] = null); }
  },

  /* ---------- Entrada ---------- */
  onSpawn(game, x, z) {
    this.init(); this.u = null; this.c = null; this.hudUid = 0;
    { const B0 = game.stage.boss; if (typeof ZMoves !== 'undefined' && B0) for (const n of [].concat(B0.sheets || [], B0.sheet || [])) if (/^z_/.test(n)) { ZMoves.load(n.slice(2)); ZMoves.load('fx'); } }   // técnicas de Z Legends 3 del jefe
    const b = game.boss; b.ultT = undefined;
    if (Save.d.opt.noCine || game.state !== 'play') return;
    const B = game.stage.boss, L = this.look(B), e = this.el;
    e.style.setProperty('--bc', hexC(L.u.c || B.col || 0xff5050));
    e.querySelector('.beKj').textContent = L.kj; e.querySelector('.beName').textContent = B.name;
    e.querySelector('.beForm').textContent = B.forms ? B.forms[0] : ''; e.querySelector('.beQ').textContent = L.q || ''; e.querySelector('.beQ').style.display = L.q ? '' : 'none';
    e.classList.remove('intro'); void e.offsetWidth; e.classList.add('intro');
    this.it = { t: 0, x, z, bolt: 0, imp: false }; game.camFocus = { x, z }; game.state = 'bossintro'; game.ui.el.hud.classList.add('cine');
    SFX.play('alarm'); game.shake(0.6);
  },
  updIntro(game, dt) {
    const I = this.it, B = game.stage.boss, L = this.look(B), col = L.u.c || B.col || 0xff5050; I.t += dt;
    if ((I.bolt -= dt) <= 0) { I.bolt = 0.13 + Math.random() * 0.12; const a = Math.random() * 6.283, r = 3 + Math.random() * 9; game.vfx.bolt(I.x + Math.cos(a) * r, I.z + Math.sin(a) * r, 16, Math.random() < 0.5 ? 0xffffff : col); if (Math.random() < 0.4) SFX.play('zap'); game.shake(0.25); }
    if (I.t > 0.3 && I.t < 2.2 && Math.random() < dt * 30) game.fx.burst(game.fx.aura, I.x + (Math.random() - 0.5) * 3, 0.5, I.z + (Math.random() - 0.5) * 3, 3, 9, 0.8, 0.5, 0, col);
    if (!I.imp && I.t >= 0.95) {                                        // impact frame con su silueta y estallido
      I.imp = true; const A = this.bossArt(game, B, 0);
      if (A && typeof ImpactFlash !== 'undefined') ImpactFlash.playArt(A, col, 'WBWB', false);
      game.vfx.boom(I.x, I.z, 6, col, true); game.fx.shock(I.x, I.z, 14, col, 0.5); game.fx.shock(I.x, I.z, 8, 0xffffff, 0.3); game.vfx.crater(I.x, I.z, 6);
      game.horde.posBoss('cast', 1.4); game.shake(1.2, 2); SFX.play('bigboom'); SFX.scream(1.1, 130); if (typeof rumble === 'function') rumble(500, 1, 0.8);
    }
    if (I.t >= BE.INTRO) this.endIntro(game);
  },
  endIntro(game) { this.el.classList.remove('intro'); game.ui.el.hud.classList.remove('cine'); game.camFocus = null; game.state = 'play'; game.clock.getDelta(); },

  /* ---------- Ataque definitivo ---------- */
  /** Lo llama bossAI cada fotograma. Devuelve true mientras carga su ataque (no lanza otras técnicas) */
  tick(game, dt, ctx) {
    this.init();
    const b = game.boss, ph = game.phase, B = game.stage.boss, NP = B.pat.length;
    if (this.u) { this.stepUlt(game, dt, ctx); return true; }
    if (ph < 1) return false;                                           // en la primera forma no lo usa
    if (b.ultT === undefined) b.ultT = BE.FIRST;
    if ((b.ultT -= dt) > 0 || b.gap > 0.3 || game.state !== 'play') return false;
    b.ultT = ph >= NP - 1 ? BE.EVERY_LAST : BE.EVERY;
    this.startUlt(game, ctx); return true;
  },
  startUlt(game, ctx) {
    const B = game.stage.boss, L = this.look(B), U = L.u, p = game.player, h = game.horde;
    this.u = { t: 0, T: BE.CHARGE, n: U.n, type: U.t, col: U.c || B.col || 0xff5050, aimed: false, fired: false, i: ctx.i };
    ENEMY_TYPES[T_BOSS].spd = 0; h.posBoss('cast', BE.CHARGE); game.boss.gap = BE.CHARGE + 1.2;
    const e = this.el.querySelector('.beUlt'); e.querySelector('b').textContent = U.n;
    const ready = this.canClashP(p);
    e.querySelector('.beTip').innerHTML = U.t === 'nova' ? '¡ALÉJATE DE ÉL!' : U.t === 'beam' ? '¡ESQUIVA A UN LADO!' + (ready ? ' · O RESPONDE CON <b>[' + this.key('ult') + ']</b>' : '') : '¡HUYE DE LA ZONA!' + (ready ? ' · O RESPONDE CON <b>[' + this.key('ult') + ']</b>' : '');
    this.el.style.setProperty('--bc', hexC(this.u.col)); this.el.classList.remove('ult'); void this.el.offsetWidth; this.el.classList.add('ult');
    if (U.t === 'nova') game.shots.mark(ctx.bx, ctx.bz, 17, BE.CHARGE, ctx.dmg * 5, { tint: this.u.col, big: true, ring: 30 });
    game.vfx.play('gather', ctx.bx, 2.5, ctx.bz, { size: 11, grow: 1.5, loop: BE.CHARGE, dur: 1.2, pri: 1, frames: FXA.gather ? FXA.gather.f.slice(12) : undefined });
    SFX.play('charge'); SFX.play('alarm'); SFX.scream(BE.CHARGE * 0.8, 140); game.shake(0.5);
  },
  /** Animación de Z Legends 3 del ataque definitivo (js/zmoves.js): la carga encajada en BE.CHARGE y, al soltarlo, el resto */
  zDraw(game, ctx) {
    const h = game.horde, u = this.u, z = /^z_/.test(h.bossName || '') ? h.bossName.slice(2) : null;
    if (!u || !z || !ZMoves.ready(z) || ctx.i === undefined || ctx.i < 0) { this.zHide(game); return; }
    if (!u.zp) u.zp = ZMoves.planFor(z, u.n) || 0;
    const P = u.zp; if (!P) { this.zHide(game); return; }
    const t0 = Math.max(0, P.relT - 2.2), tt = u.t < u.T ? t0 + (u.t / u.T) * (P.relT - t0) : P.relT + (u.t - u.T);
    if (tt >= P.dur) { this.zHide(game); return; }
    if (!this.zs) this.zs = new ZMoveSprite(game.scene, 3.3);
    const T = ENEMY_TYPES[T_BOSS], sc = T.scale * (1 + h.grow[ctx.i]);
    this.zs.show(z, ZMoves.at(P, tt), h.x[ctx.i], h.z[ctx.i], h.flip[ctx.i], 0, (h.bossPx || ZM_U) / ZM_U * sc, 1); h.bossHide = true;
  },
  zHide(game) { if (this.zs) this.zs.hide(); game.horde.bossHide = false; },
  canClashP(p) { return !!(p.ultD && p.ult >= p.ultD.cost && !p.dying); },
  stepUlt(game, dt, ctx) {
    const u = this.u, p = game.player, S = game.shots, bx = ctx.bx, bz = ctx.bz; u.t += dt;
    if (u.t < u.T && Math.random() < dt * 40) game.fx.burst(game.fx.aura, bx + (Math.random() - 0.5) * 4, 0.6, bz + (Math.random() - 0.5) * 4, 2, 10 + u.t * 5, 0.7, 0.5, 0, u.col);
    if (u.t < u.T) game.shake(0.12 + u.t * 0.08);
    this.el.querySelector('.beCd i').style.width = Math.max(0, 100 - u.t / u.T * 100) + '%';
    if (u.type === 'beam' && !u.aimed && u.t >= u.T * 0.55) {         // fija la puntería: el aviso del rayo dura lo que queda de carga
      u.aimed = true; const dx = p.x - bx, dz = p.z - bz, d = Math.hypot(dx, dz) || 1;
      S.line(bx, bz, dx / d, dz / d, 80, 4.2, u.T - u.t, ctx.dmg * 5.5, u.col);
    }
    if (!u.fired && u.t >= u.T) {
      u.fired = true; game.horde.posBoss('atk', 1);
      if (u.type === 'ball') S.ball(bx, bz, p.x, p.z, 1.5, 8.5, ctx.dmg * 5.5, { tint: u.col, size: 20, ring: 26 });
      game.vfx.flash(bx, 2.5, bz, 9, u.col); game.shake(1); SFX.play(u.type === 'beam' ? 'bigbeam' : 'bigboom');
    }
    if (typeof ZMoves !== 'undefined') this.zDraw(game, ctx);
    if (u.t >= u.T + 0.5) this.endUlt(game);
  },
  endUlt(game) {
    if (typeof ZMoves !== 'undefined') this.zHide(game);
    this.u = null; this.el.classList.remove('ult');
    if (game.horde.indexOfUid(game.bossUid) >= 0) ENEMY_TYPES[T_BOSS].spd = BOSS_HARD.spd + game.phase * 0.12;
  },

  /* ---------- Choque con el jefe ---------- */
  /** Lo llama ultimate(): si el jefe está cargando un rayo o una esfera, tu Ultimate choca con la suya */
  tryClash(game) {
    const u = this.u, p = game.player;
    if (!u || u.fired || u.type === 'nova' || u.t > u.T - 0.12 || game.state !== 'play' || !this.canClashP(p)) return false;
    const i = game.horde.indexOfUid(game.bossUid); if (i < 0) return false;
    p.ult = 0; p.iframes = Math.max(p.iframes, 1); game.shots.reset();
    this.u = null; this.el.classList.remove('ult');
    const h = game.horde, bx = h.x[i], bz = h.z[i];
    this.c = { t: 0, ph: 0, p: 0, dp: 0, db: 0, w: 0, bx, bz, i, col: hexC(game.stage.boss.col || 0xff5050), pc: (p.form && p.form.ki) || 0x8ad8ff, bossT: 0, rush: 0, burn: false, prev: false };
    this.taps = 0; game.camFocus = { x: (p.x + bx) / 2, z: (p.z + bz) / 2 }; game.state = 'bossclash'; game.ui.el.hud.classList.add('cine');
    const e = this.el, B = game.stage.boss;
    this.pname = nice(p.ch.name); e.querySelector('.beClash .l').textContent = this.pname; e.querySelector('.beClash .r').textContent = B.name;
    e.querySelector('.beCb .a').style.background = hexC(this.c.pc); e.querySelector('.beCb .b').style.background = hexC(B.col || 0xff5050);
    e.querySelector('.beCh').innerHTML = 'Machaca <b>' + this.key('ult') + '</b> o <b>' + this.key('dash') + '</b> · mantén <b>' + this.key('charge') + '</b> para gastar ki y empujar el doble';
    e.classList.add('clash');
    const pa = typeof ImpactArt !== 'undefined' ? ImpactArt.get(p.ch.id, p.fusion ? 0 : p.formIdx) : null, ba = this.bossArt(game, B, game.phase);
    if (pa && ba) ImpactFlash.playArtDuo(pa, ba, this.c.pc, B.col || 0xff5050);
    game.shake(1.2, 2); SFX.play('bigboom'); SFX.play('bigbeam'); if (typeof rumble === 'function') rumble(400, 1, 0.8);
    game.ui.toast('¡CHOQUE CON ' + B.name + '!');
    return true;
  },
  beams(game) {
    if (!this.bm && typeof VsBeam !== 'undefined') { this.bm = [new VsBeam(game.scene), new VsBeam(game.scene)]; }
    return this.bm;
  },
  updClash(game, dt) {
    const c = this.c, C = BE.CLASH, p = game.player, h = game.horde, B = game.stage.boss; c.t += dt;
    const i = h.indexOfUid(game.bossUid); if (i < 0) { this.endClash(game, 1); return; }
    const bx = h.x[i], bz = h.z[i];
    if (c.ph === 0 && c.t >= C.intro) { c.ph = 1; c.t = 0; this.taps = 0; game.ui.toast('¡EMPUJA!'); SFX.play('bigbeam'); }
    else if (c.ph === 1) {
      const down = !!(keys.KeyQ || keys.Space || keys._ult || keys._dash), tap = (down && !c.prev ? 1 : 0) + this.taps; c.prev = down; this.taps = 0;
      c.burn = !!(keys.KeyC || keys._charge) && p.ki > 1; if (c.burn) p.ki = Math.max(0, p.ki - p.maxKi * C.burn * dt);
      // El jefe empuja a su ritmo (más fuerte en las últimas formas) y a veces da un arreón
      const rate = 6 + game.phase * 1.2 + (game.diff && game.diff.boss ? (game.diff.boss - 1) * 3 : 0);
      if ((c.rush -= dt) <= 0 && Math.random() < dt * 0.45) c.rush = 0.7;
      c.bossT -= dt; let bt = 0; if (c.bossT <= 0) { c.bossT = 1 / (rate * (c.rush > 0 ? 1.7 : 1) * (0.8 + Math.random() * 0.4)); bt = 1; }
      c.dp = c.dp * Math.exp(-C.decay * dt) + tap * (c.burn ? C.mult : 1);
      c.db = c.db * Math.exp(-C.decay * dt) + bt;
      c.p = clamp(c.p + (c.dp - c.db) * C.K * dt, -1, 1);
      if (tap) game.fx.burst(game.fx.sparks, p.x, 1.6, p.z, 4, 8, 0.3, 0.3, 0, c.pc);
      if (Math.abs(c.p) >= 1 || c.t >= C.push) { c.w = Math.abs(c.p) < 0.12 ? 0 : c.p > 0 ? 1 : -1; c.ph = 2; c.t = 0; c.p0 = c.p; game.shake(1.3, 2); SFX.play('bigboom'); }
    } else if (c.ph === 2) {
      if (c.w) c.p = c.p0 + ((c.w > 0 ? 1.3 : -1.3) - c.p0) * Math.min(1, c.t / (C.out * 0.55));
      if (c.t >= C.out) { this.endClash(game, c.w); return; }
    }
    // Rayos: del jugador y del jefe hasta el punto del choque
    const k = 0.5 + c.p * 0.42, px = p.x + (bx - p.x) * k, pz = p.z + (bz - p.z) * k, py = 2, BM = this.beams(game), T = performance.now() / 1000;
    if (BM) {
      const seg = (m, x0, y0, z0, x1, y1, z1, col, w) => { const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, L = Math.hypot(dx, dy, dz); m.mesh.visible = L > 0.3; if (!m.mesh.visible) return; m.u.uA.value.set(x0, y0, z0); m.u.uDir.value.set(dx / L, dy / L, dz / L); m.u.uLen.value = L + 0.6; m.u.uW.value = w; m.u.uCol.value.setHex(col); m.u.uT.value = T; m.u.uPow.value = 1; };
      const grow = c.ph === 0 ? Math.min(1, c.t / 0.4) : 1;
      seg(BM[0], p.x, 1.4, p.z, p.x + (px - p.x) * grow, py, p.z + (pz - p.z) * grow, c.pc, 2.6 * (c.burn ? 1.35 : 1));
      seg(BM[1], bx, 2.6, bz, bx + (px - bx) * grow, py, bz + (pz - bz) * grow, B.col || 0xff5050, 3.6); BM[1].u.uPow.value = 1.25;
    }
    if (c.ph >= 1 || c.t > 0.4) {
      game.vfx.flash(px, py, pz, 3 + Math.random() * 1.5, 0xffffff);
      if (Math.random() < dt * 30) game.fx.burst(game.fx.sparks, px, py, pz, 4, 16, 0.4, 0.35, 0, Math.random() < 0.5 ? c.pc : (B.col || 0xff5050));
      if (Math.random() < dt * 6) game.vfx.bolt(px + (Math.random() - 0.5) * 6, pz + (Math.random() - 0.5) * 6, 8, 0xffffff);
      game.shake(0.18 + Math.abs(c.dp - c.db) * 0.08);
    }
    game.camFocus = { x: (p.x + bx) / 2, z: (p.z + bz) / 2 };
    const e = this.el, pc = 50 + c.p * 50;
    e.querySelector('.beCb s').style.left = pc.toFixed(1) + '%'; e.querySelector('.beCb .a').style.width = pc.toFixed(1) + '%'; e.querySelector('.beCb .b').style.width = (100 - pc).toFixed(1) + '%';
    e.querySelector('.beClash .l').textContent = this.pname + ' · KI ' + Math.round(p.ki);
    e.querySelector('.beClash').classList.toggle('push', c.ph === 1); e.querySelector('.beClash').classList.toggle('burn', !!c.burn);
  },
  endClash(game, w) {
    const C = BE.CLASH, p = game.player, h = game.horde, B = game.stage.boss, i = h.indexOfUid(game.bossUid);
    this.c = null; this.el.classList.remove('clash'); game.ui.el.hud.classList.remove('cine'); if (this.bm) for (const m of this.bm) m.mesh.visible = false;
    game.camFocus = null; game.state = 'play'; game.clock.getDelta();
    ENEMY_TYPES[T_BOSS].spd = BOSS_HARD.spd + game.phase * 0.12;
    if (i >= 0) {
      const bx = h.x[i], bz = h.z[i];
      if (w >= 0) {                                                     // gana el jugador (o empate): el jefe recibe su golpe
        const dmg = h.maxHp[i] * (w > 0 ? C.win : C.win * 0.35);
        h.stun[i] = Math.max(h.stun[i] || 0, w > 0 ? 2.5 : 0.8); DMG_SRC = 'ult'; h.hurt(i, dmg, 0, 0, game); DMG_SRC = 'otros';
        game.vfx.boom(bx, bz, w > 0 ? 7 : 4, game.stage.boss.col || 0xffffff, true); game.fx.shock(bx, bz, 12, 0xffffff, 0.4);
        if (w > 0) { game.ui.toast('¡CHOQUE GANADO! ' + B.name + ' QUEDA ATURDIDO'); const pa = typeof ImpactArt !== 'undefined' ? ImpactArt.get(p.ch.id, p.fusion ? 0 : p.formIdx) : null; if (pa) ImpactFlash.playArt(pa, (p.form && p.form.ki) || 0xffd24a, 'WBWB', p.flip); }
      }
      if (w <= 0) {                                                     // pierde (o empate): te llega su ataque
        p.iframes = 0; p.takeDamage(p.maxHp * (w < 0 ? C.lose : C.lose * 0.35), game);
        game.vfx.boom(p.x, p.z, w < 0 ? 6 : 3.5, B.col || 0xff5050, true);
        game.ui.toast(w < 0 ? '¡HAS PERDIDO EL CHOQUE!' : '¡EMPATE! ¡ESTALLAN LAS DOS!', true);
      }
    }
    SFX.play('bigboom'); game.shake(1.4, 2); game.hitstop = 0.12;
  },

  /** Estados en los que el mundo espera (los llama el bucle del juego) */
  update(game, dt) {
    if (game.state === 'bossintro') this.updIntro(game, dt); else if (game.state === 'bossclash') this.updClash(game, dt);
    const p = game.player; p.animT += dt; p.updSquash(dt); p.pose();
    game.fx.update(dt); game.syncSprites(); game.updateCamera(dt, dt, false); game.ui.update(game, dt);
  },

  /* ---------- Barra del jefe por capas ---------- */
  hud(game, bi, ui) {
    this.init();
    const e = ui.el, B = game.stage.boss, NP = B.pat.length, ph = game.phase, frac = game.horde.hp[bi] / game.horde.maxHp[bi], box = e.bossBox, bar = e.bossBar.parentNode;
    if (!box.classList.contains('v2')) {
      box.classList.add('v2');
      box.insertAdjacentHTML('afterbegin', '<canvas class="bePt" width="64" height="64"></canvas>');
      bar.insertAdjacentHTML('afterbegin', '<i class="beTr"></i>');
      box.insertAdjacentHTML('beforeend', '<div class="beRow"><span class="beFm"></span><span class="beLy"></span><span class="beNx"></span></div>');
    }
    if (this.hudUid !== game.bossUid || this.hudPh !== ph) {             // jefe o forma nueva: retrato y colores
      this.hudUid = game.bossUid; this.hudPh = ph; this.trail = 1;
      const A = this.bossArt(game, B, ph), cv = box.querySelector('.bePt'), g = cv.getContext('2d'); g.clearRect(0, 0, 64, 64);
      if (A && A.c) { const w = A.d.w, q = Math.min(w, A.d.h) * 0.72; g.imageSmoothingEnabled = false; g.drawImage(A.c, (w - q) / 2, 0, q, q, 2, 4, 60, 60); }   // la parte de arriba del sprite: la cabeza
      box.classList.toggle('nopt', !(A && A.c)); if (!(A && A.c)) this.hudPh = -1;   // sin sprite aún: se reintenta
      const L = NP - ph, cur = BOSS_LAYERS[Math.max(0, BOSS_LAYERS.length - L)], nxt = L > 1 ? BOSS_LAYERS[Math.max(0, BOSS_LAYERS.length - L + 1)] : '#1a0a10';
      bar.style.setProperty('--cur', cur); bar.style.setProperty('--nxt', nxt);
      box.querySelector('.beFm').textContent = B.forms ? B.forms[ph] : 'FASE ' + (ph + 1);
      box.querySelector('.beLy').textContent = L > 1 ? '×' + L : 'ÚLTIMA FORMA';
      box.querySelector('.beNx').textContent = B.forms && ph < NP - 1 ? 'Siguiente: ' + B.forms[ph + 1] : '';
    }
    // Vida dentro de la capa actual (cada forma es una barra llena) y rastro del daño que baja despacio
    const lo = ph >= NP - 1 ? 0 : 1 - (ph + 1) / NP, hi = 1 - ph / NP, f = clamp((frac - lo) / (hi - lo), 0, 1);
    e.bossBar.style.transform = 'none'; e.bossBar.style.width = (f * 100).toFixed(2) + '%';
    this.trail = f > this.trail ? f : this.trail + (f - this.trail) * Math.min(1, 1 / 60 * 2.2);
    bar.querySelector('.beTr').style.width = (this.trail * 100).toFixed(2) + '%';
  },

  /* ---------- Cofre del jefe ---------- */
  openChest(game, x, z) {
    const p = game.player, B = game.stage.boss || { name: 'JEFE' }, got = [];
    for (let k = 0; k < 2; k++) {                                       // dos objetos épicos o mejores
      const w = [0, 0, 0, 52, 36, 12]; let tot = 0; for (const v of w) tot += v; let r = Math.random() * tot, tier = 3;
      for (let t = 0; t < 6; t++) { r -= w[t]; if (r <= 0) { tier = t; break; } }
      let it = null; for (let t = tier; t >= 0 && !it; t--) { const pool = ITEMS.filter((q) => q.rarity === t && itemAvailable(q)); if (pool.length) it = pick(pool); }
      if (!it) continue; it.apply(p); p.items[it.id] = (p.items[it.id] || 0) + 1; got.push(it);
    }
    const zeni = Math.round(220 + 60 * (game.step || 0)), cry = 15;
    game.gainCash(zeni); Save.d.crystals = (Save.d.crystals || 0) + cry; Save.write();
    const best = got.reduce((a, it) => (!a || it.rarity > a.rarity ? it : a), null), rar = best && RARITIES[best.rarity], col = rar ? parseInt(rar.color.slice(1), 16) : 0xffd24a;
    game.vfx.boom(x, z, 5, col, true); game.vfx.play('flare', x, 6, z, { size: 14, dur: 0.9, pri: 1 }); game.fx.ring(game.fx.aura, x, 0.5, z, 70, 24, 0.9, 0.5, col);
    game.fx.burst(game.fx.sparks, x, 1.2, z, 60, 14, 0.8, 0.5, 4, 0xffd24a); for (let k = 0; k < 10; k++) game.orbs.spawn(x, z, 5);
    game.shake(0.8); game.hitstop = 0.12; SFX.play('capsule', 5);
    got.forEach((it, k) => game.after(k * 1.3, () => game.ui.itemPopup(it, RARITIES[it.rarity])));
    game.ui.toast('COFRE DE ' + B.name + ' · +' + zeni + ' ZENI · +' + cry + ' CRISTALES');
  }
};

const BOSS_EPIC_CSS = `
#bossEpic{position:fixed;inset:0;pointer-events:none;z-index:43;--bc:#ff5a3a}
#bossEpic .beSky{position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at 50% 45%,transparent 18%,rgba(4,2,12,.78) 75%)}
#bossEpic .beBar{position:absolute;left:0;right:0;height:0;background:#000}#bossEpic .beBar.t{top:0}#bossEpic .beBar.b{bottom:0}
#bossEpic .beCard{position:absolute;left:0;right:0;bottom:14vh;text-align:center;opacity:0}
#bossEpic .beKj{position:absolute;right:6vw;bottom:-2vh;font:900 clamp(60px,12vw,170px)/1 var(--kanji,'Noto Sans JP',sans-serif);color:var(--bc);opacity:.3;writing-mode:vertical-rl;text-shadow:0 0 30px var(--bc)}
#bossEpic .beCard small{display:block;font:800 clamp(12px,1.7vw,18px)/1 var(--body);letter-spacing:.35em;color:#fff}
#bossEpic .beName{display:block;font-family:var(--hero);font-weight:400;font-size:clamp(46px,9vw,120px);line-height:1;letter-spacing:.04em;color:var(--bc);-webkit-text-stroke:3px #000;paint-order:stroke fill;text-shadow:0 0 30px var(--bc),6px 6px 0 #000}
#bossEpic .beForm{display:block;font:800 clamp(13px,1.8vw,20px)/1.4 var(--body);font-style:normal;color:#ffe2a8;letter-spacing:.12em}
#bossEpic .beQ{display:inline-block;margin-top:10px;padding:8px 20px;max-width:min(680px,86vw);background:rgba(10,8,20,.85);border:3px solid var(--bc);font:700 clamp(13px,1.7vw,18px)/1.35 var(--body);color:#fff;quotes:"«" "»"}
#bossEpic.intro .beSky{animation:beSky 3s ease-out both}#bossEpic.intro .beBar{animation:beBar 3s ease-out both}#bossEpic.intro .beCard{animation:beCard 3s ease-out both}
#bossEpic.intro .beName{animation:beName 3s ease-out both}
@keyframes beSky{0%{opacity:0}12%,85%{opacity:1}100%{opacity:0}}
@keyframes beBar{0%{height:0}10%,88%{height:12vh}100%{height:0}}
@keyframes beCard{0%,30%{opacity:0;transform:translateY(20px)}38%,88%{opacity:1;transform:none}100%{opacity:0}}
@keyframes beName{0%,30%{transform:scale(2.4) skewX(-10deg)}40%{transform:scale(.95) skewX(-10deg)}46%,100%{transform:scale(1) skewX(-10deg)}}
/* Ataque definitivo: rótulo arriba y cuenta atrás */
#bossEpic .beUlt{position:absolute;left:50%;top:22%;transform:translateX(-50%);min-width:min(560px,86vw);padding:8px 22px 10px;text-align:center;background:rgba(10,4,12,.88);border:3px solid var(--bc);box-shadow:0 0 30px var(--bc);opacity:0}
#bossEpic .beUlt small{display:block;font:800 12px var(--body);letter-spacing:.3em;color:#ffb0b0}
#bossEpic .beUlt b{display:block;font-family:var(--hero);font-weight:400;font-size:clamp(28px,4.6vw,54px);line-height:1.05;color:var(--bc);-webkit-text-stroke:2px #000;paint-order:stroke fill;text-shadow:0 0 18px var(--bc),3px 3px 0 #000}
#bossEpic .beTip{display:block;margin:2px 0 6px;font:800 13px/1.3 var(--body);color:#fff}#bossEpic .beTip b{color:#ffe27a}
#bossEpic .beCd{display:block;height:6px;background:rgba(255,255,255,.15)}#bossEpic .beCd i{display:block;height:100%;width:100%;background:var(--bc)}
#bossEpic.ult .beUlt{animation:beUlt .3s ease-out both}#bossEpic.ult .beSky{opacity:.55;transition:opacity .4s}#bossEpic.ult .beUlt b{animation:beUb .25s steps(2) infinite}
@keyframes beUlt{from{opacity:0;transform:translateX(-50%) scale(1.4)}to{opacity:1;transform:translateX(-50%) scale(1)}}@keyframes beUb{50%{filter:brightness(1.6)}}
/* Choque con el jefe */
#bossEpic .beClash{position:absolute;left:50%;bottom:9vh;transform:translateX(-50%);width:min(640px,90vw);text-align:center;opacity:0;transition:opacity .2s}
#bossEpic.clash .beClash{opacity:1}#bossEpic.clash .beSky{opacity:.6}
#bossEpic .beClash h3{margin:0 0 6px;font-family:var(--hero);font-weight:400;font-size:clamp(24px,3.6vw,40px);letter-spacing:.05em;color:#fff6c8;-webkit-text-stroke:2px #000;paint-order:stroke fill;text-shadow:3px 3px 0 #000,0 0 16px #ff8a2a}
#bossEpic .beClash.push h3{animation:beCp .3s ease-in-out infinite alternate}@keyframes beCp{to{transform:scale(1.07)}}
#bossEpic .beCb{position:relative;height:22px;border:3px solid #000;box-shadow:0 0 0 2px #fff;transform:skewX(-16deg);background:#222}
#bossEpic .beCb i{position:absolute;top:0;bottom:0;width:50%}#bossEpic .beCb .a{left:0}#bossEpic .beCb .b{right:0}
#bossEpic .beCb s{position:absolute;top:-9px;bottom:-9px;left:50%;width:12px;margin-left:-6px;background:#fff;border:3px solid #000;box-shadow:0 0 16px #fff,0 0 34px #fff}
#bossEpic .beCn{display:flex;justify-content:space-between;margin-top:6px;font-family:var(--hero);font-size:clamp(16px,2vw,22px);color:#fff;-webkit-text-stroke:1px #000;paint-order:stroke fill;text-shadow:2px 2px 0 #000}
#bossEpic .beCh{margin:6px auto 0;width:fit-content;padding:4px 14px;border-radius:999px;background:rgba(17,18,28,.8);font:600 12px/1.8 var(--body);color:#e8ecf8}#bossEpic .beCh b{color:#141826;background:#fff;border-radius:4px;padding:1px 6px;font-weight:800}
#bossEpic .beClash.burn .beCn .l{color:#ffe27a}
/* Barra del jefe por capas */
#bossBox.v2{display:none;left:56%;width:min(460px,38vw);padding-left:58px;text-align:center}#bossBox.v2.nopt{padding-left:0}#bossBox.v2.nopt .bePt{display:none}#bossBox.v2 #bossName{font-size:24px;line-height:1.1}
#bossBox.v2 .bePt{position:absolute;left:0;top:2px;width:52px;height:52px;image-rendering:pixelated;background:radial-gradient(circle at 50% 40%,rgba(255,80,80,.35),rgba(10,10,20,.9) 70%);border:3px solid var(--ink,#141826);box-shadow:0 0 0 2px #ff5a4a;border-radius:50%}
#bossBox.v2 .bar{position:relative;background:var(--nxt,#1a0a10)!important;overflow:hidden}
#bossBox.v2 .bar i#bossBar{position:relative;z-index:2;display:block;height:100%;background:var(--stripe,none),var(--cur,#ff2a4a)!important;transition:width .08s linear}
#bossBox.v2 .bar .beTr{position:absolute;left:0;top:0;bottom:0;z-index:1;background:#fff;opacity:.85}
#bossBox.v2 .bar .btk{display:none}
#bossBox.v2 .beRow{display:flex;align-items:center;gap:10px;margin-top:4px;font:800 12px/1.2 var(--body);color:#fff;text-shadow:0 1px 0 #000,0 0 4px #000}
#bossBox.v2 .beFm{padding:1px 10px;background:#141826;border:2px solid #ff5a4a;border-radius:999px;color:#ffb0a8}
#bossBox.v2 .beLy{font-family:var(--hero);font-size:20px;color:#ffd23a;-webkit-text-stroke:1px #000;paint-order:stroke fill}#bossBox.v2 .beNx{margin-left:auto;color:#cfd6ee;font-weight:700}
@media (max-width:700px){#bossBox.v2{left:50%;width:62vw;padding-left:44px}#bossBox.v2 .bePt{width:38px;height:38px}#bossBox.v2 .beNx{display:none}}
@media (prefers-reduced-motion:reduce){#bossEpic.ult .beUlt b,#bossEpic .beClash.push h3{animation:none}}
`;
