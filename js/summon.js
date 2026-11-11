/* =====================================================================
   summon.js · Altar de Shenron: gachapón de transformaciones
   - Lógica de las tiradas (probabilidades, garantías, duplicados)
   - Pantalla del menú (estandarte, botones, lista de premios)
   - Animación de invocación al estilo de Dragon Ball Legends:
     esfera que cae con el color de la mejor rareza (a veces cambia
     de color en el último segundo), cartas boca abajo que se giran
     y presentación a pantalla completa de cada SPARKING / ULTRA.
   ===================================================================== */
class Summon {
  constructor(game) { this.g = game; this.fx = null; }

  /** Estandarte que se está viendo en el menú: el de la semana o el permanente */
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
    if (!list.length) list = GFORMS.filter((g) => g.r === r);
    const fl = list.filter((g) => feat.includes(g.id));
    const pick = fl.length && (pity || Math.random() < 0.6) ? fl[(Math.random() * fl.length) | 0] : list[(Math.random() * list.length) | 0];
    return { r, g: pick };
  }
  /** n tiradas (1 o 10) en el estandarte que se ve. Gasta cristales, guarda y lanza la animación */
  pull(n) {
    if (this.fx) return;
    const cost = n === 10 ? GACHA_COST10 : GACHA_COST1, d = Save.d;
    if ((d.crystals || 0) < cost) { this.g.ui.toast('Te faltan cristales'); return; }
    const { b, key } = this.banner(), pool = bannerPool(b.chars ? b : null), out = [];
    d.crystals -= cost;
    for (let i = 0; i < n; i++) {
      d.gpity[key] = (d.gpity[key] || 0) + 1;
      const pity = d.gpity[key] >= GACHA_PITY;
      const force = n === 10 && i === 9 && !out.some((o) => o.r >= 1) ? 1 : 0;      // la décima de una x10: EXTREME o mejor
      const res = this.roll(pool, b.feat, force, pity);
      if (res.r === 3) d.gpity[key] = 0;
      out.push(res);
    }
    // Premios: formas nuevas, estrellas en las repetidas y monedas
    for (const o of out) {
      d.gpulls++;
      if (!o.g) { d.zeni += o.zeni; continue; }
      const st = d.gforms[o.g.id] || 0;
      if (!st) { d.gforms[o.g.id] = 1; o.isNew = true; }
      else if (st < GACHA_STARS) { d.gforms[o.g.id] = st + 1; o.star = st + 1; }
      else { o.refund = 40 * o.r; d.crystals += o.refund; }
    }
    applyGachaForms(); Save.write();
    this.play(out, n);
  }
  /** Equipa una forma conseguida en su guerrero (solo una a la vez); tocar la equipada la quita */
  toggleForm(id) {
    const g = gformById(id); if (!g || !Save.d.gforms[id]) return;
    Save.d.gsel[g.ch] = gformEquipped(g.ch) === id ? 'none' : id;
    applyGachaForms(); Save.write(); SFX.play('select'); this.g.ui.renderMenu();
  }
  showRates() {
    const pct = (r) => GACHA_RATES[r].toString().replace('.', ',') + ' %';
    const { b } = this.banner(), pool = bannerPool(b.chars ? b : null);
    const rows = [3, 2, 1].map((r) => { const L = pool.filter((g) => g.r === r); return '<div class="grt"><b style="--rc:' + GRARE[r].col + '">' + GRARE[r].name + ' · ' + pct(r) + '</b><p>' + L.map((g) => (b.feat.includes(g.id) ? '<i>★ </i>' : '') + nice(charById(g.ch).name) + ' ' + nice(g.name)).join(' · ') + '</p></div>'; }).join('');
    const m = this.g.ui.el.modal; m.classList.add('show');
    m.innerHTML = '<div class="mbox grates"><small>Altar de Shenron</small><h2>Probabilidades</h2>' + rows +
      '<div class="grt"><b style="--rc:' + GRARE[0].col + '">HERO · ' + pct(0) + '</b><p>Monedas (300, 500 u 800).</p></div>' +
      '<p class="dim" style="text-align:left">★ Destacados: se llevan el 60% de su rareza. Cada x10 trae al menos un EXTREME. Tras ' + GACHA_PITY + ' tiradas sin ULTRA en un estandarte, la siguiente es ULTRA destacada. Repetidas: +1 estrella (+4% de daño, hasta 5); con 5 estrellas te devuelven cristales.</p>' +
      '<div class="sbtns"><button data-close>Entendido</button></div></div>';
  }

  /* =================================================================
     ANIMACIÓN DE INVOCACIÓN
     ================================================================= */
  play(res, n) {
    const ui = this.g.ui, top = Math.max(...res.map((o) => o.r));
    const root = document.createElement('div'); root.id = 'summon';
    root.innerHTML = '<canvas class="smc"></canvas><div class="scall"></div><div class="sgrid' + (n === 1 ? ' one' : '') + '"></div><div class="srev"></div>' +
      '<div class="sbar"><button class="sskip">Saltar ▸▸</button></div>';
    document.body.appendChild(root);
    const cv = root.querySelector('.smc'), ctx = cv.getContext('2d'), grid = root.querySelector('.sgrid'), rev = root.querySelector('.srev'), call = root.querySelector('.scall');
    const S = { t: 0, last: performance.now(), done: false, phase: 'ball', top, shown: top, fake: top >= 2 && Math.random() < 0.55, i: 0, wait: 0, parts: [], flash: 0, hue: 0 };
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
    const draw = () => { for (const c of root.querySelectorAll('canvas[data-sheet]')) ui.drawFrame(c, c.dataset.sheet, 0); };
    draw();
    const cards = [...grid.children];
    const hue = (r) => r === 3 ? 'hsl(' + ((S.t * 240) % 360) + ',100%,62%)' : GRARE[r].glow;
    const finish = () => {
      S.phase = 'end'; grid.classList.add('show'); cards.forEach((c) => c.classList.add('up'));
      root.querySelector('.sbar').innerHTML = '<button class="salt" data-again="' + n + '"' + ((Save.d.crystals || 0) < (n === 10 ? GACHA_COST10 : GACHA_COST1) ? ' disabled' : '') + '>Otra vez ×' + n + '</button><button class="sok">Aceptar</button>';
    };
    const close = () => {
      S.done = true; removeEventListener('resize', fit); root.remove(); this.fx = null;
      this.g.ui.renderMenu();
    };
    const revealCard = (k) => {                       // gira la carta k; si es SPARKING/ULTRA, primero la presentación grande
      const o = res[k], c = cards[k];
      if (o.r >= 2 && !S.skip) { S.phase = 'big'; this.bigReveal(rev, o, () => { c.classList.add('up'); S.phase = 'flip'; S.wait = 0.25; }); SFX.play(o.r === 3 ? 'shenron' : 'achieve'); }
      else { c.classList.add('up'); S.wait = o.r === 1 ? 0.32 : 0.16; if (o.r === 1) SFX.play('select'); }
    };
    const frame = (now) => {
      if (S.done) return;
      const dt = Math.min(0.1, (now - S.last) / 1000); S.last = now; S.t += dt;
      const W = S.W, H = S.H, t = S.t;
      ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
      // Fondo: noche con líneas de velocidad que giran (más rápidas cuanto mejor es la rareza que se ve)
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, S.shown >= 2 ? '#3a2a08' : S.shown === 1 ? '#24123c' : '#0d1a3c'); g.addColorStop(1, '#03050c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(t * (0.25 + S.shown * 0.2));
      ctx.fillStyle = S.shown === 3 ? 'hsla(' + ((t * 240) % 360) + ',100%,70%,.12)' : S.shown === 2 ? 'rgba(255,220,110,.10)' : S.shown === 1 ? 'rgba(200,140,255,.09)' : 'rgba(120,180,255,.08)';
      for (let i = 0; i < 28; i++) { ctx.rotate(Math.PI * 2 / 28); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.max(W, H), -18); ctx.lineTo(Math.max(W, H), 18); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      if (S.phase === 'ball') {
        // La esfera llega girando desde lejos; a los 1,5 s puede «cambiar» a una rareza mejor
        const p = Math.min(1, t / 1.4), e = 1 - Math.pow(1 - p, 3), r = 16 + e * Math.min(W, H) * 0.14;
        const y = H * 0.5 + Math.sin(t * 3) * 6 * e;
        if (S.fake && t > 1.6 && S.shown !== S.top) { S.shown = S.top; S.flash = 1; this.callout(call, S.top); SFX.play('shenron'); for (let k = 0; k < 40; k++) S.parts.push({ x: W / 2, y, vx: (Math.random() - 0.5) * 900, vy: (Math.random() - 0.5) * 900, l: 0.8 }); }
        if (!S.fake && t > 1.3 && !S.called && S.top >= 2) { S.called = true; this.callout(call, S.top); }
        const col = hue(S.shown), glow = ctx.createRadialGradient(W / 2, y, r * 0.5, W / 2, y, r * 3.2);
        glow.addColorStop(0, col); glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.55 + Math.sin(t * 12) * 0.15; ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(W / 2, y, r * 3.2, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        ctx.save(); ctx.translate(W / 2, y); ctx.rotate(t * 5 * (1 - e * 0.7)); Shenron.ball(ctx, 0, 0, r, 4, 0); ctx.restore();
        // Grietas de luz antes de romperse
        if (t > 2.2) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; for (let k = 0; k < 6; k++) { const a = k * 1.05 + 0.3; ctx.beginPath(); ctx.moveTo(W / 2, y); ctx.lineTo(W / 2 + Math.cos(a) * r * (t - 2.2) * 4, y + Math.sin(a) * r * (t - 2.2) * 4); ctx.stroke(); } }
        if (t > 2.55) {                                             // ¡se rompe! salen las cartas
          S.flash = 1; S.phase = 'deal'; S.dealT = t; grid.classList.add('show'); SFX.play('boom');
          for (let k = 0; k < 60; k++) S.parts.push({ x: W / 2, y, vx: (Math.random() - 0.5) * 1200, vy: (Math.random() - 0.5) * 1200, l: 1 });
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
      if (ev.target.closest('.sskip')) { S.skip = true; rev.innerHTML = ''; rev.className = 'srev'; call.className = 'scall'; finish(); return; }
      if (S.phase === 'ball' && S.t < 2.4) { S.t = Math.max(S.t, S.fake ? 1.62 : 2.3); }
    });
  }
  /** Rótulo grande: ¡SPARKING! o ¡¡ULTRA!! */
  callout(el, r) {
    el.className = 'scall on r' + r;
    el.innerHTML = '<b>' + (r === 3 ? '¡¡ULTRA!!' : r === 2 ? '¡SPARKING!' : 'EXTREME') + '</b>';
  }
  /** Cara de la carta: forma conseguida o premio menor */
  cardFace(o) {
    if (!o.g) return '<div class="sfz"><span class="coin"></span><b>+' + o.zeni + '</b><small>monedas</small></div><em>HERO</em>';
    const C = charById(o.g.ch);
    return '<canvas width="120" height="120" data-sheet="' + o.g.sheet + '"></canvas><em>' + GRARE[o.r].name + '</em><b>' + nice(o.g.name) + '</b><small>' + nice(C.name) + '</small>' +
      (o.isNew ? '<span class="snew">¡NUEVA!</span>' : o.star ? '<span class="sst">' + '★'.repeat(o.star) + '</span>' : o.refund ? '<span class="sst">+' + o.refund + ' ◆</span>' : '');
  }
  /** Presentación a pantalla completa de un SPARKING o un ULTRA (tocar para seguir) */
  bigReveal(el, o, done) {
    const C = charById(o.g.ch);
    el.className = 'srev on r' + o.r;
    el.innerHTML = '<div class="srays"></div><div class="schar"><canvas width="360" height="360" data-sheet="' + o.g.sheet + '"></canvas></div>' +
      '<div class="sinfo"><em>' + GRARE[o.r].name + '</em><small>' + nice(C.name) + '</small><b>' + nice(o.g.name) + '</b>' +
      '<span>' + (o.isNew ? '¡NUEVA TRANSFORMACIÓN!' : o.star ? '+1 ★ · ' + o.star + ' / ' + GACHA_STARS + ' estrellas' : '+' + o.refund + ' cristales (5 ★)') + '</span></div><p class="stap">Toca para continuar</p>';
    this.g.ui.drawFrame(el.querySelector('canvas'), o.g.sheet, 0);
    let ok = false;
    const go = () => { if (ok) return; ok = true; el.removeEventListener('click', go); el.className = 'srev'; el.innerHTML = ''; done(); };
    setTimeout(() => el.addEventListener('click', go), 450);
    setTimeout(go, 4200);
  }
}

/* =====================================================================
   PANTALLA DEL ALTAR EN EL MENÚ
   ===================================================================== */
Object.assign(UIManager.prototype, {
  renderSummon() {
    const S = this.game.summon, { b, key, left } = S.banner(), pool = bannerPool(b.chars ? b : null), d = Save.d;
    const tl = left != null ? Math.floor(left / 864e5) + ' d ' + Math.floor((left % 864e5) / 36e5) + ' h' : '';
    this.hdr = { t: 'Altar de Shenron', s: 'Transformaciones especiales con Cristales del Dragón', c: 'c-grn', k: '願',
      tabs: this.segTabs([['week', 'Estandarte'], ['std', 'Esferas eternas']], this.gtab === 'std' ? 'std' : 'week', 'gtab') };
    const feat = b.feat.map((id) => gformById(id)).filter(Boolean);
    const fc = (g, i) => '<div class="bfeat" style="--i:' + i + '"><canvas width="220" height="220" data-sheet="' + g.sheet + '" data-frame="0"></canvas><span class="brr r' + g.r + '">' + GRARE[g.r].name + '</span><b>' + nice(g.name) + '</b><small>' + nice(charById(g.ch).name) + '</small></div>';
    const heroes = feat.length ? feat.map(fc).join('') : pool.filter((g) => g.r === 3).slice(0, 3).map(fc).join('');
    const pity = d.gpity[key] || 0;
    const items = pool.slice().sort((a, b2) => b2.r - a.r).map((g) => {
      const st = d.gforms[g.id] || 0, eq = st && gformEquipped(g.ch) === g.id;
      return '<div class="gcard r' + g.r + (st ? '' : ' lk') + (eq ? ' eq' : '') + (b.feat.includes(g.id) ? ' ft' : '') + '"' + (st ? ' data-gform="' + g.id + '" title="Toca para ' + (eq ? 'quitarla' : 'equiparla') + '"' : '') + '>' +
        '<canvas width="96" height="96" data-sheet="' + g.sheet + '" data-frame="0"></canvas><em>' + GRARE[g.r].name + '</em><b>' + nice(g.name) + '</b><small>' + nice(charById(g.ch).name) + '</small>' +
        (st ? '<span class="gst">' + '★'.repeat(st) + '<i>' + '★'.repeat(GACHA_STARS - st) + '</i></span>' + (eq ? '<span class="geq">Equipada</span>' : '') : '<span class="gst">Sin conseguir</span>') + '</div>';
    }).join('');
    const own = GFORMS.filter((g) => d.gforms[g.id]).length;
    this.el.menuBody.innerHTML = '<div class="altar">' +
      '<div class="pnl ban" style="--b1:' + b.col[0] + ';--b2:' + b.col[1] + '"><div class="bray"></div>' +
        '<div class="btop"><span class="k2">' + (b.chars ? 'Estandarte de la temporada' : 'Siempre disponible') + '</span><h2>' + b.name + '</h2><p>' + b.sub + '</p>' + (tl ? '<span class="btime">⏳ Cambia en ' + tl + '</span>' : '') + '</div>' +
        '<div class="bheroes">' + heroes + '</div>' +
        '<div class="bact"><div class="bcry"><span class="crys"></span><b>' + (d.crystals || 0).toLocaleString('es-ES') + '</b><small>Cristales del Dragón</small></div>' +
          '<button class="bpull c-blu" data-pull="1"' + (d.crystals < GACHA_COST1 ? ' disabled' : '') + '>Invocar ×1<small><span class="crys"></span> ' + GACHA_COST1 + '</small></button>' +
          '<button class="bpull" data-pull="10"' + (d.crystals < GACHA_COST10 ? ' disabled' : '') + '>Invocar ×10<small><span class="crys"></span> ' + GACHA_COST10.toLocaleString('es-ES') + ' · EXTREME+ seguro</small></button></div>' +
        '<div class="bfoot"><div class="bpity"><span>Garantía ULTRA</span><div class="mb"><i style="width:' + (pity / GACHA_PITY * 100) + '%"></i><em>' + pity + ' / ' + GACHA_PITY + '</em></div></div><button class="pill" data-rates>Probabilidades</button></div>' +
      '</div>' +
      '<div class="pnl gside"><div class="gsh"><b>Premios</b><span>' + own + ' / ' + GFORMS.length + ' formas conseguidas</span></div><div class="glist">' + items + '</div>' +
        '<p class="dim gnote">La forma equipada es la última transformación de su guerrero en la partida (pulsa [G]). Cada guerrero lleva una: toca otra tuya para cambiarla.</p></div>' +
      '</div>';
  }
});
