'use strict';
/* =====================================================================
   gacha.js · Gachapón de Shenron (máquina del mapa)
   1) Enseña los 7 premios (uno legendario, uno épico, uno muy raro, uno raro,
      dos normales y uno muy malo), cada uno sobre una esfera del dragón.
   2) Las tapan 7 esferas iguales (las cuatro estrellas: no se distinguen), se mezclan muy deprisa y eliges una.
   3) Te quedas con lo que hay debajo. La primera tirada de cada máquina es
      gratis; volver a tirar cuesta mucho Zeni (y más cada vez).
   ===================================================================== */

const GACHA_COST0 = 400, GACHA_COST_STEP = 300;     // 2ª tirada: 400 Zeni; cada una más, +300
// Las 7 casillas: rareza mostrada, color y qué premio sale
const GACHA_SLOTS = [
  { tier: 'LEGENDARIO', col: '#ffb02e', kind: 'item', rar: 4 },
  { tier: 'ÉPICO', col: '#b866ff', kind: 'item', rar: 3 },
  { tier: 'MUY RARO', col: '#5be07a', kind: 'buff' },
  { tier: 'RARO', col: '#4ab0ff', kind: 'item', rar: 1 },
  { tier: 'NORMAL', col: '#c4cfdb', kind: 'item', rar: 0 },
  { tier: 'NORMAL', col: '#c4cfdb', kind: 'item', rar: 0 },
  { tier: 'MUY MALO', col: '#ff4d5e', kind: 'curse' }
];
const GACHA_SWAPS = 20;      // intercambios al mezclar (cada vez más rápidos)

class Gacha {
  constructor(game) {
    this.g = game; this.o = null; this.timers = [];
    this.el = document.getElementById('gacha');
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-gpick],[data-gact]');
      if (!b) return;
      if (b.dataset.gpick !== undefined) this.pick(+b.dataset.gpick);
      else if (b.dataset.gact === 'roll') this.roll();
      else if (b.dataset.gact === 'mix') this.mix();
      else if (b.dataset.gact === 'close') this.close();
    });
    // Al pasar por encima (o tocar) un premio boca arriba, su descripción completa
    const det = (e) => {
      const b = e.target.closest('.gb'), d = this.el.querySelector('.gdet');
      if (!b || !d || !b.classList.contains('up')) return;
      const P = this.prizes[+b.dataset.i];
      d.innerHTML = '<b style="color:' + P.col + '">' + P.name + '</b> · ' + P.text;
    };
    this.el.addEventListener('mouseover', det);
    this.el.addEventListener('touchstart', det, { passive: true });
  }
  /** Precio de la próxima tirada en esta máquina (la primera, gratis) */
  cost(o) { return o.pulls ? GACHA_COST0 + GACHA_COST_STEP * (o.pulls - 1) : 0; }

  /* ---------- Premios ---------- */
  /** Un objeto de esa rareza (antes los desbloqueados; si no hay, cualquiera: es magia de Shenron) sin repetir */
  itemOf(rar, used) {
    for (const own of [true, false]) {
      const pool = ITEMS.filter((it) => it.rarity === rar && !used.has(it.id) && (!own || itemAvailable(it)));
      if (pool.length) return pick(pool);
    }
    return pick(ITEMS.filter((it) => it.rarity === rar));
  }
  makePrizes() {
    const used = new Set();
    return GACHA_SLOTS.map((S) => {
      if (S.kind === 'item') {
        const it = this.itemOf(S.rar === 4 && Math.random() < 0.15 ? 5 : S.rar, used); used.add(it.id);   // 15%: ultra legendario
        const ultra = it.rarity === 5;                                     // el ultra legendario se anuncia como tal
        return { S, kind: 'item', id: it.id, icon: it.icon, name: it.name, text: it.text, col: ultra ? RARITIES[5].color : S.col, tier: ultra ? RARITIES[5].name : S.tier };
      }
      if (S.kind === 'buff') {
        const id = pick(SHRINE_BUFFS), B = BUFFS[id];
        return { S, kind: 'buff', id, icon: B.icon, name: B.name, text: 'Bendición: ' + B.text, col: S.col, tier: S.tier };
      }
      // Muy malo: dos maldiciones a la vez
      const a = pick(CURSE_BUFFS); let b = pick(CURSE_BUFFS); while (b === a) b = pick(CURSE_BUFFS);
      return { S, kind: 'curse', ids: [a, b], icon: '☠', name: 'Maldición de Shenron', text: BUFFS[a].text + ' y ' + BUFFS[b].text.charAt(0).toLowerCase() + BUFFS[b].text.slice(1), col: S.col, tier: S.tier };
    });
  }

  /* ---------- Flujo ---------- */
  open(o) {
    const g = this.g;
    if (g.cash < this.cost(o)) { g.ui.toast('NECESITAS ' + this.cost(o) + ' ZENI PARA TIRAR', true); SFX.play('warn'); return; }
    this.o = o; g.state = 'gacha'; g.releaseMouse();
    this.el.classList.add('show');
    this.start();
  }
  /** Nueva tirada: cobra, prepara los premios y los enseña boca arriba */
  start() {
    const g = this.g, o = this.o, c = this.cost(o);
    g.cash -= c; o.pulls = (o.pulls || 0) + 1; g.run.gachas = (g.run.gachas || 0) + 1;
    this.prizes = this.makePrizes();
    this.pos = [0, 1, 2, 3, 4, 5, 6];            // pos[i] = casilla (de izquierda a derecha) donde está la esfera i
    this.phase = 'show'; this.chosen = -1;
    this.render();
    SFX.play('capsule', 2);
    this.later(6000, () => { if (this.phase === 'show') this.mix(); });   // si no pulsas MEZCLAR, empieza solo a los 6 s
  }
  /** Tapa los premios con las esferas y las mezcla */
  mix() {
    if (this.phase !== 'show') return;
    this.clearTimers();
    this.phase = 'cover'; this.render();
    SFX.play('click');
    this.later(550, () => { this.phase = 'mix'; this.render(); this.swap(0); });
  }
  swap(k) {
    if (k >= GACHA_SWAPS) {
      // todas a su casilla y quietas antes de poder elegir (que no quede ninguna a medio camino)
      for (let i = 0; i < 7; i++) this.place(i, 0, 180);
      this.later(260, () => { this.phase = 'pick'; this.render(); SFX.play('event'); });
      return;
    }
    // dos esferas al azar intercambian su casilla con un salto (una por arriba y otra por abajo)
    const a = (Math.random() * 7) | 0; let b = (Math.random() * 7) | 0; while (b === a) b = (Math.random() * 7) | 0;
    const ia = this.pos.indexOf(a), ib = this.pos.indexOf(b);
    this.pos[ia] = b; this.pos[ib] = a;
    const dur = Math.max(90, 300 - k * 12);       // cada vez más rápido
    this.place(ia, -1, dur); this.place(ib, 1, dur);
    if (k % 2 === 0) SFX.play('dash');
    this.later(dur * 0.5, () => { this.place(ia, 0, dur * 0.5); this.place(ib, 0, dur * 0.5); });
    this.later(dur + 20, () => this.swap(k + 1));
  }
  /** Mueve la esfera i a su casilla; arc -1/1 = salto arriba/abajo */
  place(i, arc, dur) {
    const b = this.balls && this.balls[i]; if (!b) return;
    b.style.transitionDuration = (dur | 0) + 'ms';
    b.style.setProperty('--x', this.pos[i]);
    b.style.setProperty('--y', arc);
  }
  /** Eliges la esfera de la casilla `slot` (1-7 de izquierda a derecha, o tocándola) */
  pick(slot) {
    if (this.phase !== 'pick' || slot < 0 || slot > 6) return;
    const i = this.pos.indexOf(slot), P = this.prizes[i], g = this.g, p = g.player;
    this.phase = 'done'; this.chosen = i;
    if (P.kind === 'item') { const it = itemById(P.id); it.apply(p); p.items[it.id] = (p.items[it.id] || 0) + 1; }
    else if (P.kind === 'buff') { p.buffs.push(P.id); p.recompute(); }
    else { for (const id of P.ids) p.buffs.push(id); p.recompute(); g.run.curses++; g.track('curses', 1); }
    const bad = P.kind === 'curse', top = P.S.kind === 'item' && P.S.rar >= 3;
    SFX.play(bad ? 'warn' : top ? 'achieve' : 'capsule', top ? 4 : 1);
    if (top) g.shake(0.4);
    g.ui.toast((bad ? '☠ ' : '★ ') + P.tier + ' · ' + P.name, true);
    this.render();
    this.later(900, () => { this.phase = 'end'; this.render(); });    // luego se destapan las demás
  }
  roll() {
    if (this.phase !== 'end') return;
    if (this.g.cash < this.cost(this.o)) return;
    this.start();
  }
  close() {
    if (this.phase === 'mix' || this.phase === 'cover') return;      // no se puede salir a mitad de la mezcla
    if (this.phase === 'show' || this.phase === 'pick') return;      // ni sin elegir (la tirada ya está pagada)
    this.clearTimers();
    this.el.classList.remove('show'); this.el.innerHTML = ''; this.balls = null; this.o = null;
    const g = this.g;
    if (g.pendingLevels > 0) g.openLevelUp(); else g.resume();
  }
  later(ms, f) { this.timers.push(setTimeout(f, ms)); }
  clearTimers() { for (const t of this.timers) clearTimeout(t); this.timers.length = 0; }

  /* ---------- Dibujo ---------- */
  face(P) {
    return '<div class="gf" style="--c:' + P.col + '"><span class="gi">' + P.icon + '</span><small>' + P.tier + '</small><b>' + P.name + '</b></div>';
  }
  render() {
    const ph = this.phase, g = this.g, cost = this.cost(this.o), cash = Math.floor(g.cash);
    const sub = { show: 'Fíjate bien dónde está cada premio…', cover: 'Las esferas tapan los premios…', mix: '¡Se están mezclando!', pick: 'Elige una esfera [1-7]', done: '', end: '' }[ph];
    let h = '<small class="gk">GACHAPÓN DE SHENRON</small><h2>LAS 7 ESFERAS DEL DRAGÓN</h2><p class="gs">' + sub + '</p>';
    // Las esferas se crean una vez por tirada y luego solo cambian de clase (así las transiciones se ven)
    const rebuild = !this.balls || ph === 'show';
    if (rebuild) {
      h += '<div class="grow">';
      for (let i = 0; i < 7; i++) h += '<button class="gb" data-i="' + i + '" style="--x:' + this.pos[i] + ';--y:0"><div class="gin"><div class="gfront">' + this.face(this.prizes[i]) + '</div><div class="gback"><i class="gdb">' + '<u>★</u>'.repeat(4) + '</i></div></div></button>';
      h += '</div><p class="gdet">Pasa por encima de un premio para ver qué hace</p><div class="gfoot"></div>';
      this.el.innerHTML = '<div class="gbox">' + h + '</div>';
      this.balls = [...this.el.querySelectorAll('.gb')];
    } else {
      this.el.querySelector('.gs').textContent = sub;
    }
    const covered = ph === 'cover' || ph === 'mix' || ph === 'pick';
    this.balls.forEach((b, i) => {
      const up = !covered && (ph === 'show' || ph === 'end' || i === this.chosen);
      b.classList.toggle('up', up);
      b.classList.toggle('pickable', ph === 'pick');
      b.classList.toggle('chosen', i === this.chosen);
      b.classList.toggle('dim', ph === 'end' && i !== this.chosen);
      b.dataset.gpick = ph === 'pick' ? this.pos[i] : '';
      if (ph !== 'pick') delete b.dataset.gpick;
    });
    const foot = this.el.querySelector('.gfoot');
    if (ph === 'show') foot.innerHTML = '<button class="gbtn" data-gact="mix">¡MEZCLAR!</button>';
    else if (ph === 'end' || ph === 'done') {
      const P = this.prizes[this.chosen];
      foot.innerHTML = '<p class="gres" style="color:' + P.col + '">' + (P.kind === 'curse' ? '☠ ' : '★ ') + P.tier + ' · <b>' + P.name + '</b><br><span>' + P.text + '</span></p>' +
        (ph === 'end' ? '<div class="gbtns"><button class="gbtn" data-gact="roll"' + (g.cash < cost ? ' disabled' : '') + '>TIRAR OTRA VEZ · ' + cost + ' ZENI</button><button class="gbtn alt" data-gact="close">SALIR [E]</button></div><p class="gz">TIENES ' + cash + ' ZENI</p>' : '');
    } else foot.innerHTML = '';
  }
}
