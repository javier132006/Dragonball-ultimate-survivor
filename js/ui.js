'use strict';
/* =====================================================================
   ui.js · HUD, minimapa, cartas de mejora, menú principal
   (personajes / tienda), pausa y fin de partida. Solo DOM, sin Three.js.
   ===================================================================== */

const $ = (id) => document.getElementById(id);
const fmtTime = (s) => { s = Math.floor(s); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

class UIManager {
  constructor() {
    const ids = ['hpBar', 'hpTxt', 'kiBar', 'kiTxt', 'xpBar', 'xpTxt', 'lvl', 'formName', 'chName', 'kills', 'time', 'horde', 'fps', 'zeniHud', 'balls',
      'biome', 'abDash', 'dashFill', 'abCharge', 'vignette', 'toast', 'feed', 'wstrip', 'bossBox', 'bossBar', 'bossName', 'mm', 'portrait',
      'itemPop', 'screen', 'scrTitle', 'scrSub', 'scrStats', 'scrA', 'scrB', 'cards', 'cardTitle', 'cardSub', 'cardRow', 'menu', 'menuTabs', 'menuBody', 'btnPlay', 'zeniMenu', 'fatal', 'hud'];
    this.el = {};
    for (const id of ids) this.el[id] = $(id);
    this.flash = 0; this.fpsAcc = 0; this.fpsN = 0; this.fpsT = 0; this.wKey = ''; this.mmT = 0; this.lastBiome = -1;
    this.tab = 'chars'; this.view = 'goku'; this.sheets = null; this.game = null; this.toastTimer = 0;
    this.cardHandlers = [];
    this.mmCtx = this.el.mm && this.el.mm.getContext ? this.el.mm.getContext('2d') : null;
  }

  /* ---------- Utilidades ---------- */
  /** Dibuja un fotograma de una hoja en un canvas (retrato) */
  drawFrame(canvas, sheetName, frame) {
    const s = this.sheets && this.sheets[sheetName], g = canvas.getContext && canvas.getContext('2d');
    if (!s || !g) return;
    const img = s.tex.image, c = frame % s.cols, r = (frame / s.cols) | 0;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.drawImage(img, c * s.w, r * s.h, s.w, s.h, 0, 0, canvas.width, canvas.height);
  }
  fatal(msg) { this.el.fatal.textContent = msg; this.el.fatal.style.display = 'flex'; }

  toast(text, small) {
    if (small) {
      const f = this.el.feed;
      if (f.children.length > 4) f.removeChild(f.firstChild);
      const d = document.createElement('div');
      d.textContent = text; f.appendChild(d);
      setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 1300);
      return;
    }
    const t = this.el.toast;
    t.textContent = text; t.classList.remove('go'); void t.offsetWidth; t.classList.add('go');
  }

  /* ---------- HUD ---------- */
  showHud(on) { this.el.hud.style.display = on ? 'block' : 'none'; }

  update(game, dt) {
    const p = game.player, e = this.el;
    const sc = (el, v) => { el.style.transform = 'scaleX(' + clamp(v, 0, 1).toFixed(3) + ')'; };
    sc(e.hpBar, p.hp / p.maxHp); sc(e.kiBar, p.ki / p.maxKi); sc(e.xpBar, p.xp / p.xpNext);
    e.hpTxt.textContent = Math.max(0, Math.ceil(p.hp)) + ' / ' + Math.ceil(p.maxHp);
    e.kiTxt.textContent = Math.floor(p.ki) + ' / ' + p.maxKi;
    e.xpTxt.textContent = Math.floor(p.xp) + ' / ' + p.xpNext;
    e.lvl.textContent = p.level; e.formName.textContent = p.form.name; e.chName.textContent = p.ch.name;
    e.kills.textContent = game.kills; e.time.textContent = fmtTime(game.time); e.horde.textContent = game.horde.n;
    e.zeniHud.textContent = Math.floor(game.zeniRun); e.balls.textContent = game.pickups.collected + ' / 7';
    this.flash = Math.max(0, this.flash - dt * 2.2);
    const lowHp = p.hp / p.maxHp < 0.3 ? 0.35 + Math.sin(game.time * 8) * 0.15 : 0;
    e.vignette.style.opacity = Math.max(this.flash * 0.9, lowHp).toFixed(2);
    e.dashFill.style.transform = 'scaleX(' + (1 - p.dashCd / CFG.DASH_CD).toFixed(2) + ')';
    e.abDash.className = 'ab' + (p.ki < CFG.DASH_COST ? ' low' : '');
    e.abCharge.className = 'ab' + (p.charging ? ' on' : '');
    // FPS suavizado
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc >= 0.5) { e.fps.textContent = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }
    // Bioma actual
    const b = biomeAt(p.x, p.z);
    if (b !== this.lastBiome) { this.lastBiome = b; e.biome.textContent = BIOME_NAMES[b]; if (game.state === 'play' && game.time > 1) this.toast(BIOME_NAMES[b], true); }
    // Barra del jefe
    const bi = game.bossUid ? game.horde.indexOfUid(game.bossUid) : -1;
    if (bi >= 0) { e.bossBox.style.display = 'block'; sc(e.bossBar, game.horde.hp[bi] / game.horde.maxHp[bi]); }
    else e.bossBox.style.display = 'none';
    this.updateStrip(game);
    this.mmT -= dt;
    if (this.mmT <= 0) { this.mmT = 0.1; this.drawMinimap(game, bi); }
  }

  /** Iconos de armas y vitaminas equipadas (solo se reconstruye si cambian) */
  updateStrip(game) {
    const p = game.player;
    let key = '';
    for (const w of game.weapons.list) key += w.id + w.lv + ',';
    for (const id in p.stacks) key += id + p.stacks[id] + ',';
    for (const id in p.items) key += id + p.items[id] + ',';
    if (key === this.wKey) return;
    this.wKey = key;
    let h = '';
    for (const w of game.weapons.list) h += '<div class="wi" title="' + WEAPONS[w.id].name + '"><i>' + WEAPONS[w.id].icon + '</i><b>' + w.lv + '</b></div>';
    for (const s of STATS) if (p.stacks[s.id]) h += '<div class="wi st" title="' + s.name + '"><i>' + s.icon + '</i><b>' + p.stacks[s.id] + '</b></div>';
    for (const id in p.items) { const it = itemById(id), c = RARITIES[it.rarity].color; h += '<div class="wi it" style="border-color:' + c + ';color:' + c + '" title="' + it.name + '"><i>' + it.icon + '</i><b>' + p.items[id] + '</b></div>'; }
    this.el.wstrip.innerHTML = h;
  }

  drawMinimap(game, bossIdx) {
    const g = this.mmCtx, w = game.world, p = game.player;
    if (!g) return;
    const N = this.el.mm.width, R = CFG.ARENA, X = (v) => ((v / R + 1) / 2) * N;
    g.clearRect(0, 0, N, N);
    if (w.mini) g.drawImage(w.mini, 0, 0, N, N);
    g.fillStyle = '#ffd84a';
    for (let i = 0; i < 7; i++) if (!game.pickups.got[i]) g.fillRect(X(game.pickups.bx[i]) - 2, X(game.pickups.bz[i]) - 2, 4, 4);
    if (bossIdx >= 0) { g.fillStyle = '#ff3050'; g.fillRect(X(game.horde.x[bossIdx]) - 3, X(game.horde.z[bossIdx]) - 3, 6, 6); }
    g.fillStyle = '#ff7ad0';
    for (let i = 0; i < game.capsules.n; i++) g.fillRect(X(game.capsules.x[i]) - 1, X(game.capsules.z[i]) - 1, 3, 3);
    g.fillStyle = '#fff'; g.fillRect(X(p.x) - 2, X(p.z) - 2, 5, 5);
    // Indicador de la orientación de la cámara
    g.strokeStyle = '#35e0ff'; g.beginPath(); g.moveTo(X(p.x), X(p.z)); g.lineTo(X(p.x) - Math.sin(game.camYaw) * 12, X(p.z) - Math.cos(game.camYaw) * 12); g.stroke();
  }

  /** Aviso al abrir una cápsula: nombre, rareza y efecto del objeto */
  itemPopup(it, rar) {
    const e = this.el.itemPop;
    e.style.borderColor = rar.color; e.style.boxShadow = '0 0 24px ' + rar.color;
    e.innerHTML = '<div class="ip-i" style="color:' + rar.color + '">' + it.icon + '</div><div><small style="color:' + rar.color + '">' + rar.name + '</small><b>' + it.name + '</b><p>' + it.text + '</p></div>';
    e.classList.remove('go'); void e.offsetWidth; e.classList.add('go');
  }

  /* ---------- Pantallas de pausa / derrota ---------- */
  showScreen(title, sub, stats, aText, bText) {
    const e = this.el;
    e.scrTitle.textContent = title; e.scrSub.textContent = sub; e.scrStats.textContent = stats;
    e.scrA.textContent = aText; e.scrB.textContent = bText || ''; e.scrB.style.display = bText ? 'inline-block' : 'none';
    e.screen.classList.add('show');
  }
  hideScreen() { this.el.screen.classList.remove('show'); }

  /* ---------- Cartas (subida de nivel y deseo de Shenron) ---------- */
  showCards(title, sub, cards, onPick) {
    const e = this.el;
    e.cardTitle.textContent = title; e.cardSub.textContent = sub;
    let h = '';
    cards.forEach((c, i) => {
      let pips = '';
      if (c.max) for (let k = 1; k <= c.max; k++) pips += '<u class="' + (k <= c.lv ? 'on' : '') + '"></u>';
      h += '<button class="card ' + c.type + '" data-i="' + i + '"><em>' + (i + 1) + '</em><span class="ci">' + c.icon + '</span><small>' + c.tag + '</small><b>' + c.title + '</b><p>' + c.text + '</p><div class="pips">' + pips + '</div></button>';
    });
    e.cardRow.innerHTML = h;
    this.cardHandlers = cards.map((c, i) => () => onPick(c, i));
    e.cards.classList.add('show');
  }
  pickCard(i) { const f = this.cardHandlers[i]; if (f) f(); }
  hideCards() { this.el.cards.classList.remove('show'); this.cardHandlers = []; }
  cardsOpen() { return this.el.cards.classList.contains('show'); }

  /* ---------- Menú principal ---------- */
  showMenu(game) {
    this.game = game;
    this.view = Save.d.sel;
    this.el.menu.classList.add('show');
    this.showHud(false);
    this.renderMenu();
  }
  hideMenu() { this.el.menu.classList.remove('show'); }

  renderMenu() {
    const e = this.el, g = this.game;
    e.zeniMenu.textContent = Save.d.zeni;
    e.menuTabs.innerHTML = ['chars:PERSONAJES', 'shop:MEJORAS', 'items:OBJETOS'].map((t) => { const [k, n] = t.split(':'); return '<button class="tab ' + (this.tab === k ? 'on' : '') + '" data-tab="' + k + '">' + n + '</button>'; }).join('');
    if (this.tab === 'chars') this.renderChars(); else if (this.tab === 'items') this.renderItems(); else this.renderShop();
    const sel = charById(Save.d.sel);
    e.btnPlay.textContent = 'JUGAR CON ' + sel.name + ' [ENTER]';
    // Retratos: se dibujan después de generar el HTML
    for (const cv of e.menuBody.querySelectorAll('canvas[data-sheet]')) this.drawFrame(cv, cv.dataset.sheet, +cv.dataset.frame);
  }

  renderChars() {
    const v = charById(this.view), owned = Save.d.unlocked.includes(v.id);
    let grid = '';
    for (const c of CHARACTERS) {
      const own = Save.d.unlocked.includes(c.id), sel = Save.d.sel === c.id;
      const cls = 'ch' + (sel ? ' sel' : '') + (own ? '' : ' locked') + (c.soon ? ' soon' : '') + (this.view === c.id ? ' view' : '');
      const tag = c.soon ? 'PRÓXIMAMENTE' : sel ? 'EQUIPADO' : own ? 'DESBLOQUEADO' : '🔒 ' + c.cost + ' ZENI';
      grid += '<div class="' + cls + '" data-ch="' + c.id + '">' +
        (c.portrait ? '<canvas width="108" height="79" data-sheet="' + c.portrait.sheet + '" data-frame="' + c.portrait.frame + '"></canvas>' : '<div class="qm">?</div>') +
        '<b>' + c.name + '</b><small>' + c.role + '</small><span class="tag">' + tag + '</span></div>';
    }
    let det = '';
    if (v.soon) det = '<h3>' + v.name + '</h3><p class="dim">' + v.role + '</p><p>Este guerrero llegará en una próxima actualización. Necesita sus sprites para unirse a la batalla.</p>';
    else {
      const bar = (n, val, max) => '<div class="sb"><span>' + n + '</span><div><i style="width:' + Math.min(100, (val / max) * 100) + '%"></i></div><b>' + val + '</b></div>';
      const best = Save.d.best[v.id];
      det = '<h3>' + v.name + '</h3><p class="dim">' + v.role + '</p>' +
        bar('VIDA', v.hp, 160) + bar('KI', v.ki, 160) + bar('VEL', Math.round(v.spd * 100), 150) + bar('DAÑO', Math.round(v.dmg * 100), 150) +
        '<h4>PASIVA · ' + v.passive.name + '</h4><p>' + v.passive.desc + '</p>' +
        '<h4>ATAQUE BÁSICO</h4><p><i>' + WEAPONS[v.start[0]].icon + '</i> <b>' + WEAPONS[v.start[0]].name + '</b> · ' + WEAPONS[v.start[0]].lv[0] + '</p>' +
        '<h4>TÉCNICAS (al subir de nivel)</h4>' + v.unique.filter((id) => id !== v.start[0]).map((id) => '<p><i>' + WEAPONS[id].icon + '</i> <b>' + WEAPONS[id].name + '</b> · desde NV ' + (WEAPONS[id].minLv || 2) + '</p>').join('') +
        '<h4>TRANSFORMACIONES</h4><div class="forms">' + v.forms.map((f) => '<span>' + f.name + ' <em>NV ' + f.lvl + '</em></span>').join('') + '</div>' +
        (best ? '<h4>MEJOR PARTIDA</h4><p>' + fmtTime(best.time) + ' · ' + best.kills + ' enemigos · NV ' + best.level + '</p>' : '');
      if (!owned) det += '<button class="buy" data-buy="' + v.id + '"' + (Save.d.zeni < v.cost ? ' disabled' : '') + '>DESBLOQUEAR · ' + v.cost + ' ZENI</button>';
      else if (Save.d.sel !== v.id) det += '<button class="buy" data-equip="' + v.id + '">EQUIPAR</button>';
    }
    this.el.menuBody.innerHTML = '<div class="roster">' + grid + '</div><div class="detail">' + det + '</div>';
  }

  renderShop() {
    let h = '<div class="shop">';
    for (const l of LAB) {
      const lvl = Save.lab(l.id), maxed = lvl >= l.max, cost = labCost(l, lvl);
      let pips = ''; for (let k = 0; k < l.max; k++) pips += '<u class="' + (k < lvl ? 'on' : '') + '"></u>';
      h += '<div class="item"><div><b>' + l.name + '</b><p>' + l.desc + '</p><div class="pips">' + pips + '</div></div>' +
        '<button data-lab="' + l.id + '"' + (maxed || Save.d.zeni < cost ? ' disabled' : '') + '>' + (maxed ? 'MÁXIMO' : cost + ' Z') + '</button></div>';
    }
    this.el.menuBody.innerHTML = h + '</div>';
  }

  /** Colección de objetos: comunes y raros ya vienen desbloqueados; el resto se compra con Zeni */
  renderItems() {
    let h = '<div class="shop">';
    const info = '<div class="item" style="grid-column:1/-1"><div><b>CÁPSULAS DE CAPSULE CORP</b><p>Las cápsulas del mapa dan un objeto aleatorio. Aquí desbloqueas qué objetos pueden tocarte: los más raros solo aparecerán si los compras.</p></div></div>';
    h += info;
    for (let r = 0; r < 6; r++) {
      for (const it of ITEMS) {
        if (it.rarity !== r) continue;
        const rar = RARITIES[r], own = itemAvailable(it);
        h += '<div class="item" style="border-left:4px solid ' + rar.color + '"><div class="ic" style="color:' + rar.color + '">' + it.icon + '</div><div><small style="color:' + rar.color + '">' + rar.name + '</small><br><b>' + it.name + '</b><p>' + it.text + '</p></div>' +
          (own ? '<button disabled>' + (rar.cost ? 'DESBLOQUEADO' : 'DISPONIBLE') + '</button>' : '<button data-item="' + it.id + '"' + (Save.d.zeni < rar.cost ? ' disabled' : '') + '>' + rar.cost + ' Z</button>') + '</div>';
      }
    }
    this.el.menuBody.innerHTML = h + '</div>';
  }
}
