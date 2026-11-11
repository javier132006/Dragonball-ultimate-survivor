/* =====================================================================
   summon.js · Altar de Shenron: invocaciones
   - Lógica de las tiradas (probabilidades, garantías, duplicados)
   - Pantalla del menú (estandarte con los destacados animados, premios)
   - Animación de invocación al estilo de Dragon Ball Legends:
     las 7 esferas se juntan en una (con el color de la mejor rareza, que
     a veces cambia en el último segundo), cartas boca abajo con el retrato
     del guerrero y, para cada SPARKING / ULTRA (o guerrero nuevo), una
     presentación en tres tiempos: silueta → corte con el retrato grande
     → el guerrero aparece cargando ki con su aura.
   ===================================================================== */

/* ---------- Animador de sprites en <canvas> del menú ----------
   Todos los fotogramas de una animación se dibujan con la MISMA escala y
   encuadre (la caja que los contiene a todos), con los pies abajo: así el
   guerrero no cambia de tamaño entre fotogramas. */
const SANIM = {
  list: [], on: false,
  add(cv, sheet, frames, fps) {
    if (!cv || !frames || !frames.length) return;
    this.list = this.list.filter((e) => e.cv !== cv && e.cv.isConnected);
    const e = { cv, sheet, frames, fps: fps || 6, t: Math.random() * 2 };
    this.list.push(e); drawUnion(cv, sheet, frames, frames[0]);
    if (!this.on) { this.on = true; this.last = performance.now(); requestAnimationFrame((t) => this.loop(t)); }
  },
  loop(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    this.list = this.list.filter((e) => e.cv.isConnected);
    if (!this.list.length) { this.on = false; return; }
    for (const e of this.list) {
      const k = (e.t * e.fps) | 0; e.t += dt;
      const k2 = (e.t * e.fps) | 0;
      if (k2 !== k) drawUnion(e.cv, e.sheet, e.frames, e.frames[k2 % e.frames.length]);
    }
    requestAnimationFrame((t) => this.loop(t));
  }
};
function drawUnion(cv, sheet, frames, f) {
  const ui = window.game && game.ui, s = ui && ui.sheets && ui.sheets[sheet], g = cv.getContext && cv.getContext('2d');
  if (!s || !g) return;
  const img = s.tex.image, key = frames.join(','), cache = (s.ub = s.ub || {});
  let u = cache[key];
  if (!u) {
    u = { x0: 1e9, y0: 1e9, x1: -1, y1: -1 };
    for (const fr of frames) { const b = ui.frameBox(img, s, fr % s.cols, (fr / s.cols) | 0); u.x0 = Math.min(u.x0, b.x); u.y0 = Math.min(u.y0, b.y); u.x1 = Math.max(u.x1, b.x + b.w); u.y1 = Math.max(u.y1, b.y + b.h); }
    cache[key] = u;
  }
  const W = cv.width, H = cv.height, uw = u.x1 - u.x0, uh = u.y1 - u.y0, k = Math.min(W / uw, H / uh) * 0.96;
  const c = f % s.cols, r = (f / s.cols) | 0;
  g.imageSmoothingEnabled = false; g.clearRect(0, 0, W, H);
  g.drawImage(img, c * s.w + u.x0, r * s.h + u.y0, uw, uh, (W - uw * k) / 2, H - uh * k, uw * k, uh * k);
}
/** Fotogramas de quieto y de cargar ki de una invocación */
const unitIdle = (g) => { const m = SPRITE_DATA[g.sheet]; return m && m.anim ? m.anim.idleSeq : [0]; };
const unitChg = (g) => { const m = SPRITE_DATA[g.chg]; return m ? [...Array(m.cols * m.rows).keys()] : [0]; };
/** Lienzos con data-anim: idle (quieto) · chg (cargando) · face (retrato) */
function animIn(el) {
  for (const cv of el.querySelectorAll('canvas[data-unit]')) {
    const g = gformById(cv.dataset.unit); if (!g) continue;
    const a = cv.dataset.anim;
    if (a === 'face') drawUnion(cv, g.face, [0], 0);
    else if (a === 'big') drawUnion(cv, unitBig(g) || g.face, [0], 0);
    else if (a === 'chg') SANIM.add(cv, g.chg, unitChg(g), 9);
    else if (a === 'still') drawUnion(cv, g.sheet, unitIdle(g), unitIdle(g)[0]);
    else SANIM.add(cv, g.sheet, unitIdle(g), 5);
  }
}
const ucv = (g, a, w, h, cls) => '<canvas' + (cls ? ' class="' + cls + '"' : '') + ' width="' + w + '" height="' + (h || w) + '" data-unit="' + g.id + '" data-anim="' + a + '"></canvas>';
const unitSub = (g) => g.kind === 'char' ? 'Guerrero nuevo' : nice(charById(g.ch).name);

class Summon {
  constructor(game) { this.g = game; this.fx = null; }

  /** Estandarte que se está viendo en el menú: el de la temporada o el permanente */
  banner() { const ui = this.g.ui; return ui.gtab === 'std' ? { b: STANDARD_BANNER, key: 'std' } : (() => { const B = bannerNow(); return { b: B.b, key: 'b' + B.n, left: B.left }; })(); }

  /* ---------- Una tirada ---------- */
  roll(pool, feat, forceMin, pity) {
    let r;
    if (pity) r = 3;
    else {
      const x = Math.random() * 100, R = GACHA_RATES;               // ULTRA · SPARKING · EXTREME · el resto HERO
      r = x < R[3] ? 3 : x < R[3] + R[2] ? 2 : x < R[3] + R[2] + R[1] ? 1 : 0;
    }
    if (r < forceMin) r = forceMin;
    if (r === 0) return { r: 0, zeni: [300, 500, 500, 800][(Math.random() * 4) | 0] };
    let list = pool.filter((g) => g.r === r);
    if (!list.length) list = GUNITS.filter((g) => g.r === r);
    const fl = list.filter((g) => feat.includes(g.id));
    const pick = fl.length && (pity || Math.random() < 0.6) ? fl[(Math.random() * fl.length) | 0] : list[(Math.random() * list.length) | 0];
    return { r, g: pick };
  }
  /** n tiradas (1 o 10) en el estandarte que se ve. Gasta cristales, guarda y lanza la animación */
  pull(n) {
    if (this.fx) return;
    const cost = n === 10 ? GACHA_COST10 : GACHA_COST1, d = Save.d;
    if ((d.crystals || 0) < cost) { this.g.ui.toast('Te faltan cristales'); return; }
    const { b, key } = this.banner(), pool = bannerPool(b.units ? b : null), out = [];
    d.crystals -= cost;
    for (let i = 0; i < n; i++) {
      d.gpity[key] = (d.gpity[key] || 0) + 1;
      const pity = d.gpity[key] >= GACHA_PITY;
      const force = n === 10 && i === 9 && !out.some((o) => o.r >= 1) ? 1 : 0;      // la décima de una x10: EXTREME o mejor
      const res = this.roll(pool, b.feat, force, pity);
      if (res.r === 3) d.gpity[key] = 0;
      out.push(res);
    }
    // Premios: guerreros y transformaciones nuevas, estrellas en las repetidas y monedas
    for (const o of out) {
      d.gpulls++;
      if (!o.g) { d.zeni += o.zeni; continue; }
      const st = d.gforms[o.g.id] || 0;
      if (!st) { d.gforms[o.g.id] = 1; o.isNew = true; if (o.g.kind === 'char' && !d.unlocked.includes(o.g.id)) d.unlocked.push(o.g.id); }
      else if (st < GACHA_STARS) { d.gforms[o.g.id] = st + 1; o.star = st + 1; }
      else { o.refund = 40 * o.r; d.crystals += o.refund; }
    }
    applyGachaForms(); Save.write();
    this.play(out, n);
  }
  /** Toca una invocación tuya: las transformaciones se equipan (una por guerrero); los guerreros abren su ficha */
  toggleForm(id) {
    const g = gformById(id); if (!g || !Save.d.gforms[id]) return;
    if (g.kind === 'char') { this.g.ui.view = id; this.g.go('play'); return; }
    Save.d.gsel[g.ch] = gformEquipped(g.ch) === id ? 'none' : id;
    applyGachaForms(); Save.write(); SFX.play('select'); this.g.ui.renderMenu();
  }
  showRates() {
    const pct = (r) => GACHA_RATES[r].toString().replace('.', ',') + ' %';
    const { b } = this.banner(), pool = bannerPool(b.units ? b : null);
    const rows = [3, 2, 1].map((r) => { const L = pool.filter((g) => g.r === r); return '<div class="grt"><b style="--rc:' + GRARE[r].col + '">' + GRARE[r].name + ' · ' + pct(r) + '</b><p>' + L.map((g) => (b.feat.includes(g.id) ? '<i>★ </i>' : '') + nice(g.name) + (g.kind === 'form' ? ' (' + nice(charById(g.ch).name) + ')' : '')).join(' · ') + '</p></div>'; }).join('');
    const m = this.g.ui.el.modal; m.classList.add('show');
    m.innerHTML = '<div class="mbox grates"><small>Altar de Shenron</small><h2>Probabilidades</h2>' + rows +
      '<div class="grt"><b style="--rc:' + GRARE[0].col + '">HERO · ' + pct(0) + '</b><p>Monedas (300, 500 u 800).</p></div>' +
      '<p class="dim" style="text-align:left">★ Destacados: se llevan el 60% de su rareza. Cada x10 trae al menos un EXTREME. Tras ' + GACHA_PITY + ' tiradas sin ULTRA en un estandarte, la siguiente es ULTRA destacada. Los guerreros nuevos se desbloquean al salir; las transformaciones se añaden al final de la cadena de su guerrero. Repetidas: +1 estrella (+4% de daño, hasta 5); con 5 estrellas te devuelven cristales.</p>' +
      '<div class="sbtns"><button data-close>Entendido</button></div></div>';
  }

  /* =================================================================
     ANIMACIÓN DE INVOCACIÓN
     ================================================================= */
  play(res, n) {
    const top = Math.max(...res.map((o) => o.r));
    const root = document.createElement('div'); root.id = 'summon';
    root.innerHTML = '<canvas class="smc"></canvas><div class="scall"></div><div class="sgrid' + (n === 1 ? ' one' : '') + '"></div><div class="srev"></div>' +
      '<div class="sbar"><button class="sskip">Saltar ▸▸</button></div>';
    document.body.appendChild(root);
    const cv = root.querySelector('.smc'), ctx = cv.getContext('2d'), grid = root.querySelector('.sgrid'), rev = root.querySelector('.srev'), call = root.querySelector('.scall');
    const S = { t: 0, last: performance.now(), done: false, phase: 'ball', top, shown: top, fake: top >= 2 && Math.random() < 0.55, i: 0, wait: 0, parts: [], flash: 0, bolts: [] };
    if (S.fake) S.shown = Math.max(0, top - 1 - (Math.random() < 0.4 ? 1 : 0));
    this.fx = { root, S };
    const fit = () => { S.dpr = Math.min(2, devicePixelRatio || 1); S.W = innerWidth; S.H = innerHeight; cv.width = S.W * S.dpr; cv.height = S.H * S.dpr; };
    fit(); addEventListener('resize', fit);
    SFX.play('tp');
    // Cartas boca abajo (el reverso ya dice la rareza, como en Legends)
    res.forEach((o, i) => {
      const c = document.createElement('div');
      c.className = 'scard r' + o.r; c.style.setProperty('--i', i);
      c.innerHTML = '<div class="scin"><div class="sback"><i class="dball"></i></div><div class="sface">' + this.cardFace(o) + '</div></div>';
      grid.appendChild(c);
    });
    const cards = [...grid.children];
    const hue = (r) => r === 3 ? 'hsl(' + ((S.t * 240) % 360) + ',100%,62%)' : GRARE[r].glow;
    const finish = () => {
      S.phase = 'end'; grid.classList.add('show'); cards.forEach((c) => c.classList.add('up'));
      root.querySelector('.sbar').innerHTML = '<button class="salt" data-again="' + n + '"' + ((Save.d.crystals || 0) < (n === 10 ? GACHA_COST10 : GACHA_COST1) ? ' disabled' : '') + '>Otra vez ×' + n + '</button><button class="sok">Aceptar</button>';
      animIn(grid);
    };
    const close = () => {
      S.done = true; removeEventListener('resize', fit); root.remove(); this.fx = null;
      this.g.ui.renderMenu();
    };
    const revealCard = (k) => {                       // gira la carta k; SPARKING/ULTRA (o guerrero nuevo): primero la presentación grande
      const o = res[k], c = cards[k];
      const big = o.g && (o.r >= 2 || (o.isNew && o.g.kind === 'char'));
      if (big && !S.skip) { S.phase = 'big'; this.bigReveal(rev, o, () => { c.classList.add('up'); animIn(c); S.phase = 'flip'; S.wait = 0.25; }); }
      else { c.classList.add('up'); animIn(c); S.wait = o.r === 1 ? 0.32 : 0.16; if (o.r === 1) SFX.play('select'); }
    };
    // Las 7 esferas: giran en círculo y se juntan en la esfera de 4 estrellas
    const orbs = [...Array(7).keys()].map((k) => ({ a: (k / 7) * Math.PI * 2, n: k + 1 }));
    const frame = (now) => {
      if (S.done) return;
      const dt = Math.min(0.1, (now - S.last) / 1000); S.last = now; S.t += dt;
      const W = S.W, H = S.H, t = S.t, cx = W / 2, cy = H / 2;
      ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
      // Fondo: noche con líneas de velocidad que giran (más rápidas cuanto mejor es la rareza que se ve)
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.75);
      g.addColorStop(0, S.shown >= 2 ? '#3a2a08' : S.shown === 1 ? '#24123c' : '#0d1a3c'); g.addColorStop(1, '#03050c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * (0.25 + S.shown * 0.2));
      ctx.fillStyle = S.shown === 3 ? 'hsla(' + ((t * 240) % 360) + ',100%,70%,.12)' : S.shown === 2 ? 'rgba(255,220,110,.10)' : S.shown === 1 ? 'rgba(200,140,255,.09)' : 'rgba(120,180,255,.08)';
      for (let i = 0; i < 28; i++) { ctx.rotate(Math.PI * 2 / 28); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.max(W, H), -18); ctx.lineTo(Math.max(W, H), 18); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      if (S.phase === 'ball') {
        const R0 = Math.min(W, H) * 0.32;
        if (t < 1.0) {                                               // las esferas orbitan y se acercan al centro
          const p = t / 1.0, e = p * p, rad = R0 * (1 - e) + 4, br = Math.min(W, H) * (0.045 - 0.02 * e);
          for (const o of orbs) {
            const a = o.a + t * (2 + e * 9), x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad * 0.62;
            ctx.globalAlpha = 0.35; ctx.strokeStyle = '#ffb81c'; ctx.lineWidth = br * 0.6;
            ctx.beginPath(); ctx.arc(cx, cy, rad, a - 0.5, a); ctx.stroke(); ctx.globalAlpha = 1;
            Shenron.ball(ctx, x, y, br, o.n, 1);
          }
          if (t + dt >= 1.0) { S.flash = 0.8; SFX.play('charge'); }
        } else {
          // La esfera grande gira; a los 1,9 s puede «cambiar» a una rareza mejor
          const tb = t - 1.0, p = Math.min(1, tb / 0.9), e = 1 - Math.pow(1 - p, 3), r = 16 + e * Math.min(W, H) * 0.14;
          const y = cy + Math.sin(t * 3) * 6 * e;
          if (S.fake && tb > 1.0 && S.shown !== S.top) { S.shown = S.top; S.flash = 1; this.callout(call, S.top); SFX.play('shenron'); for (let k = 0; k < 40; k++) S.parts.push({ x: cx, y, vx: (Math.random() - 0.5) * 900, vy: (Math.random() - 0.5) * 900, l: 0.8 }); }
          if (!S.fake && tb > 0.7 && !S.called && S.top >= 2) { S.called = true; this.callout(call, S.top); SFX.play('achieve'); }
          // Rayos de ki alrededor (más cuanto mejor la rareza)
          if (Math.random() < 0.15 + S.shown * 0.12) S.bolts.push({ a: Math.random() * 6.28, l: 0.18, r });
          ctx.strokeStyle = hue(S.shown); ctx.lineWidth = 3;
          for (const b of S.bolts) {
            b.l -= dt; if (b.l <= 0) continue;
            ctx.globalAlpha = b.l / 0.18; ctx.beginPath(); let x = cx + Math.cos(b.a) * b.r * 1.1, yy = y + Math.sin(b.a) * b.r * 1.1; ctx.moveTo(x, yy);
            for (let s = 1; s <= 5; s++) { const d = b.r * (1.1 + s * 0.45); x = cx + Math.cos(b.a + (Math.random() - 0.5) * 0.3) * d; yy = y + Math.sin(b.a + (Math.random() - 0.5) * 0.3) * d; ctx.lineTo(x, yy); }
            ctx.stroke();
          }
          ctx.globalAlpha = 1; S.bolts = S.bolts.filter((b) => b.l > 0);
          const col = hue(S.shown), glow = ctx.createRadialGradient(cx, y, r * 0.5, cx, y, r * 3.2);
          glow.addColorStop(0, col); glow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = 0.55 + Math.sin(t * 12) * 0.15; ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, y, r * 3.2, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
          ctx.save(); ctx.translate(cx, y); ctx.rotate(t * 5 * (1 - e * 0.7)); Shenron.ball(ctx, 0, 0, r, 4, 0); ctx.restore();
          // Grietas de luz antes de romperse
          if (tb > 1.5) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; for (let k = 0; k < 6; k++) { const a = k * 1.05 + 0.3; ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx + Math.cos(a) * r * (tb - 1.5) * 4, y + Math.sin(a) * r * (tb - 1.5) * 4); ctx.stroke(); } }
          if (tb > 1.85) {                                           // ¡se rompe! salen las cartas
            S.flash = 1; S.phase = 'deal'; S.dealT = t; grid.classList.add('show'); SFX.play('boom');
            for (let k = 0; k < 60; k++) S.parts.push({ x: cx, y, vx: (Math.random() - 0.5) * 1200, vy: (Math.random() - 0.5) * 1200, l: 1 });
          }
        }
      } else if (S.phase === 'deal') {
        if (t - S.dealT > 0.55 + res.length * 0.05) { S.phase = 'flip'; S.wait = 0.2; call.className = 'scall'; }
      } else if (S.phase === 'flip') {
        S.wait -= dt;
        if (S.wait <= 0) { if (S.i < res.length) revealCard(S.i++); else finish(); }
      }
      // Chispas
      for (const q of S.parts) { q.l -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.96; q.vy *= 0.96; if (q.l > 0) { ctx.fillStyle = S.shown === 3 ? 'hsl(' + ((q.x + t * 300) % 360) + ',100%,70%)' : GRARE[S.shown].glow; ctx.globalAlpha = Math.min(1, q.l * 1.5); ctx.fillRect(q.x - 3, q.y - 3, 6, 6); } }
      ctx.globalAlpha = 1; S.parts = S.parts.filter((q) => q.l > 0);
      if (S.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + S.flash + ')'; ctx.fillRect(0, 0, W, H); S.flash = Math.max(0, S.flash - dt * 2.5); }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame((n0) => { S.last = n0; frame(n0); });
    root.addEventListener('click', (ev) => {
      if (ev.target.closest('.sok')) { close(); return; }
      const ag = ev.target.closest('[data-again]'); if (ag) { close(); this.pull(+ag.dataset.again); return; }
      if (ev.target.closest('.sskip')) { S.skip = true; if (this.revEnd) this.revEnd(); rev.innerHTML = ''; rev.className = 'srev'; call.className = 'scall'; finish(); return; }
      if (S.phase === 'ball' && S.t < 2.7) { S.t = Math.max(S.t, S.fake ? 2.02 : 2.6); }
    });
  }
  /** Rótulo grande: ¡SPARKING! o ¡¡ULTRA!! */
  callout(el, r) {
    el.className = 'scall on r' + r;
    el.innerHTML = '<b>' + (r === 3 ? '¡¡ULTRA!!' : r === 2 ? '¡SPARKING!' : 'EXTREME') + '</b>';
  }
  /** Cara de la carta: retrato del guerrero + su sprite, o premio menor */
  cardFace(o) {
    if (!o.g) return '<div class="sfz"><span class="coin"></span><b>+' + o.zeni + '</b><small>monedas</small></div><em>HERO</em>';
    return '<div class="sfp">' + ucv(o.g, 'face', 96, 120) + ucv(o.g, 'idle', 96, 96, 'sfs') + '</div><em>' + GRARE[o.r].name + '</em><b>' + nice(o.g.name) + '</b><small>' + unitSub(o.g) + '</small>' +
      (o.isNew ? '<span class="snew">¡NUEVO!</span>' : o.star ? '<span class="sst">' + '★'.repeat(o.star) + '</span>' : o.refund ? '<span class="sst">+' + o.refund + ' ◆</span>' : '');
  }
  /** Presentación grande en tres tiempos (tocar para seguir):
      1) silueta negra entre rayos del color de la rareza · 2) corte en diagonal con el retrato grande ·
      3) el guerrero aparece cargando ki con su aura, después se queda en guardia, y sale su nombre */
  bigReveal(el, o, done) {
    const g = o.g, r = o.r, art = unitBig(g) ? 'big' : 'face';
    const what = g.kind === 'char' ? (o.isNew ? '¡NUEVO GUERRERO!' : null) : (o.isNew ? '¡NUEVA TRANSFORMACIÓN!' : null);
    el.className = 'srev on r' + r + ' st1';
    el.innerHTML = '<div class="srays"></div><div class="ssil">' + ucv(g, 'still', 360, 360) + '</div>' +
      '<div class="scut"><div class="scs s1"></div><div class="scs s2">' + ucv(g, art, 300, 375, 'scface') + '</div><div class="scs s3"></div><b class="sckj">' + (r === 3 ? '極' : r === 2 ? '超' : '新') + '</b></div>' +
      '<div class="schar">' + ucv(g, 'chg', 400, 400, 'schg') + ucv(g, 'idle', 360, 360, 'sidl') + '</div>' +
      '<div class="sinfo"><em>' + GRARE[r].name + '</em><small>' + unitSub(g) + '</small><b>' + nice(g.name) + '</b>' +
      '<span>' + (what || (o.star ? '+1 ★ · ' + o.star + ' / ' + GACHA_STARS + ' estrellas' : '+' + o.refund + ' cristales (5 ★)')) + '</span></div><p class="stap">Toca para continuar</p>';
    animIn(el);
    const T = [], at = (ms, f) => T.push(setTimeout(f, ms));
    SFX.play('charge');
    at(650, () => { el.className = 'srev on r' + r + ' st2'; SFX.play('tp'); });
    at(1550, () => { el.className = 'srev on r' + r + ' st3'; SFX.play(r === 3 ? 'shenron' : 'achieve'); });
    at(2700, () => { el.classList.add('st4'); });                     // termina de cargar: se queda en guardia
    let ok = false;
    const go = () => { if (ok) return; ok = true; T.forEach(clearTimeout); el.removeEventListener('click', go); this.revEnd = null; el.className = 'srev'; el.innerHTML = ''; done(); };
    this.revEnd = () => { ok = true; T.forEach(clearTimeout); this.revEnd = null; };
    at(1700, () => el.addEventListener('click', go));
    at(6500, go);
  }
}

/* =====================================================================
   PANTALLA DEL ALTAR EN EL MENÚ
   ===================================================================== */
Object.assign(UIManager.prototype, {
  /** Corte en diagonal con el retrato grande (Ultimate de los guerreros y formas del altar) */
  faceCut(face, name, col) {
    const old = document.getElementById('fcut'); if (old) old.remove();
    const el = document.createElement('div'); el.id = 'fcut';
    el.style.setProperty('--fc', '#' + (col || 0xffd84a).toString(16).padStart(6, '0'));
    el.innerHTML = '<div class="fcs"><canvas width="240" height="300"></canvas><b>' + name + '</b></div>';
    document.body.appendChild(el); drawUnion(el.querySelector('canvas'), face, [0], 0);
    SFX.play('tp'); setTimeout(() => el.remove(), 1000);
  },
  renderSummon() {
    const S = this.game.summon, { b, key, left } = S.banner(), pool = bannerPool(b.units ? b : null), d = Save.d;
    const tl = left != null ? Math.floor(left / 864e5) + ' d ' + Math.floor((left % 864e5) / 36e5) + ' h' : '';
    this.hdr = { t: 'Altar de Shenron', s: 'Guerreros y transformaciones con Cristales del Dragón', c: 'c-grn', k: '願',
      tabs: this.segTabs([['week', 'Estandarte'], ['std', 'Esferas eternas']], this.gtab === 'std' ? 'std' : 'week', 'gtab') };
    const feat = b.feat.map((id) => gformById(id)).filter(Boolean);
    // Destacados: retrato grande detrás y el guerrero animado delante
    const fc = (g, i) => '<div class="bfeat r' + g.r + '" style="--i:' + i + '"><div class="bfp">' + ucv(g, 'face', 160, 200) + '</div>' + ucv(g, 'idle', 220, 220, 'bfs') +
      '<span class="brr r' + g.r + '">' + GRARE[g.r].name + '</span><b>' + nice(g.name) + '</b><small>' + unitSub(g) + '</small></div>';
    const heroes = (feat.length ? feat : pool.filter((g) => g.r === 3).slice(0, 2)).map(fc).join('');
    const pity = d.gpity[key] || 0;
    const items = pool.slice().sort((a, b2) => b2.r - a.r || (a.kind > b2.kind ? 1 : -1)).map((g) => {
      const st = d.gforms[g.id] || 0, eq = st && g.kind === 'form' && gformEquipped(g.ch) === g.id;
      return '<div class="gcard r' + g.r + (st ? '' : ' lk') + (eq ? ' eq' : '') + (b.feat.includes(g.id) ? ' ft' : '') + '"' + (st ? ' data-gform="' + g.id + '" title="' + (g.kind === 'char' ? 'Ver su ficha' : 'Toca para ' + (eq ? 'quitarla' : 'equiparla')) + '"' : '') + '>' +
        '<div class="gfp">' + ucv(g, 'face', 80, 100) + ucv(g, st ? 'idle' : 'still', 72, 72, 'gfs') + '</div><em>' + GRARE[g.r].name + '</em><b>' + nice(g.name) + '</b><small>' + unitSub(g) + '</small>' +
        (st ? '<span class="gst">' + '★'.repeat(st) + '<i>' + '★'.repeat(GACHA_STARS - st) + '</i></span>' + (eq ? '<span class="geq">Equipada</span>' : '') : '<span class="gst">Sin conseguir</span>') + '</div>';
    }).join('');
    const own = GUNITS.filter((g) => d.gforms[g.id]).length;
    const mig = d.gmig ? '<p class="gmig">El altar se ha renovado con guerreros totalmente animados. Te hemos devuelto ' + (d.gmig.zeni ? d.gmig.zeni.toLocaleString('es-ES') + ' monedas' : '') + (d.gmig.zeni && d.gmig.cry ? ' y ' : '') + (d.gmig.cry ? d.gmig.cry.toLocaleString('es-ES') + ' cristales' : '') + ' por lo que tenías del altar anterior.</p>' : '';
    this.el.menuBody.innerHTML = '<div class="altar">' +
      '<div class="pnl ban" style="--b1:' + b.col[0] + ';--b2:' + b.col[1] + '"><div class="bray"></div>' +
        '<div class="btop"><span class="k2">' + (b.units ? 'Estandarte de la temporada' : 'Siempre disponible') + '</span><h2>' + b.name + '</h2><p>' + b.sub + '</p>' + (tl ? '<span class="btime">⏳ Cambia en ' + tl + '</span>' : '') + '</div>' +
        '<div class="bheroes">' + heroes + '</div>' +
        '<div class="bact"><div class="bcry"><span class="crys"></span><b>' + (d.crystals || 0).toLocaleString('es-ES') + '</b><small>Cristales del Dragón</small></div>' +
          '<button class="bpull c-blu" data-pull="1"' + (d.crystals < GACHA_COST1 ? ' disabled' : '') + '>Invocar ×1<small><span class="crys"></span> ' + GACHA_COST1 + '</small></button>' +
          '<button class="bpull" data-pull="10"' + (d.crystals < GACHA_COST10 ? ' disabled' : '') + '>Invocar ×10<small><span class="crys"></span> ' + GACHA_COST10.toLocaleString('es-ES') + ' · EXTREME+ seguro</small></button></div>' +
        '<div class="bfoot"><div class="bpity"><span>Garantía ULTRA</span><div class="mb"><i style="width:' + (pity / GACHA_PITY * 100) + '%"></i><em>' + pity + ' / ' + GACHA_PITY + '</em></div></div><button class="pill" data-rates>Probabilidades</button></div>' +
      '</div>' +
      '<div class="pnl gside"><div class="gmodes"><span class="k2">Gana cristales</span>' + Object.keys(MODES).map((k) => '<button class="c-blu" data-start="' + k + '">' + MODES[k].icon + ' ' + MODES[k].name + '</button>').join('') + '<button class="c-yel" data-go="missions" data-wk>◆ Misiones semanales</button></div><div class="gsh"><b>Premios</b><span>' + own + ' / ' + GUNITS.length + ' conseguidos</span></div>' + mig + '<div class="glist">' + items + '</div>' +
        '<p class="dim gnote">Guerreros nuevos: se desbloquean al salir (toca para ver su ficha). Transformaciones: van al final de la cadena de su guerrero (pulsa [G] en partida); lleva una por guerrero, toca otra tuya para cambiarla.</p></div>' +
      '</div>';
    animIn(this.el.menuBody);
  }
});
