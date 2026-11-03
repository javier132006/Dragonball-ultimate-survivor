'use strict';
/* =====================================================================
   ui.js · HUD, minimapa, cartas de mejora, menú principal
   (personajes / tienda), pausa y fin de partida. Solo DOM, sin Three.js.
   ===================================================================== */

const $ = (id) => document.getElementById(id);
const fmtTime = (s) => { s = Math.floor(s); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

class UIManager {
  constructor() {
    const ids = ['hpBar', 'hpTxt', 'kiBar', 'kiTxt', 'xpBar', 'xpTxt', 'lvl', 'formName', 'chName', 'kills', 'time', 'horde', 'fps', 'zeniHud', 'balls', 'goal', 'diffName',
      'biome', 'combo', 'comboN', 'comboBar', 'storm', 'power', 'tfBtn', 'tfName', 'goalL', 'stageName', 'zoneBox', 'zoneBar', 'zoneTxt', 'trade', 'bigmap', 'bigmapc', 'fade', 'abDash', 'dashFill', 'abCharge', 'vignette', 'toast', 'feed', 'wstrip', 'bossBox', 'bossBar', 'bossName', 'mm', 'portrait', 'prompt', 'itemPop',
      'screen', 'scrBox', 'scrTitle', 'scrSub', 'scrStats', 'scrA', 'scrB', 'cards', 'cardTitle', 'cardSub', 'cardRow', 'menu', 'menuNav', 'menuBody', 'zeniMenu', 'exit', 'modal', 'fatal', 'hud'];
    this.el = {};
    for (const id of ids) this.el[id] = $(id);
    this.flash = 0; this.fpsAcc = 0; this.fpsN = 0; this.fpsT = 0; this.wKey = ''; this.mmT = 0; this.lastBiome = -1;
    this.tab = 'upgrades'; this.mtab = 'missions'; this.screen = 'home'; this.view = 'goku'; this.sheets = null; this.game = null; this.toastTimer = 0;
    this.cardHandlers = [];
    this.mmCtx = this.el.mm && this.el.mm.getContext ? this.el.mm.getContext('2d') : null;
  }

  /* ---------- Utilidades ---------- */
  /** Dibuja un fotograma de una hoja en un canvas (retrato) */
  drawFrame(canvas, sheetName, frame, tint) {
    const s = this.sheets && this.sheets[sheetName], g = canvas.getContext && canvas.getContext('2d');
    if (!s || !g) return;
    const img = s.tex.image, c = frame % s.cols, r = (frame / s.cols) | 0, W = canvas.width, H = canvas.height;
    g.imageSmoothingEnabled = false;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, W, H);
    g.drawImage(img, c * s.w, r * s.h, s.w, s.h, 0, 0, W, H);
    if (tint && tint !== 0xffffff) {                      // tinte (sprites provisionales recoloreados)
      g.globalCompositeOperation = 'multiply'; g.fillStyle = '#' + tint.toString(16).padStart(6, '0'); g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'destination-in'; g.drawImage(img, c * s.w, r * s.h, s.w, s.h, 0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
    }
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
    e.formName.style.setProperty('--fc', '#' + (p.form.aura || 0xffe14a).toString(16).padStart(6, '0'));
    // Nivel de poder (lectura del scouter): vida, ki, daño y nivel
    e.power.textContent = Math.round((p.maxHp * 2 + p.maxKi) * p.damageMul() * (1 + p.level * 0.25) * 3).toLocaleString('es-ES');
    // Aviso de transformación disponible
    const nf = p.formReady >= 0 ? p.ch.forms[p.formReady] : null;
    if (nf && game.state === 'play') { e.tfBtn.style.display = 'flex'; if (e.tfName.textContent !== nf.name) e.tfName.textContent = nf.name; e.tfBtn.style.setProperty('--fc', '#' + (nf.aura || 0xffe14a).toString(16).padStart(6, '0')); }
    else e.tfBtn.style.display = 'none';
    e.kills.textContent = game.kills; e.time.textContent = fmtTime(game.stageTime); e.horde.textContent = game.horde.n;
    e.zeniHud.textContent = Math.floor(game.cash);
    const S = game.stage;
    e.stageName.textContent = (game.stageIdx + 1) + '/' + STAGES.length + ' · ' + S.name;
    if (game.practice) { e.goalL.textContent = 'MODO'; e.goal.textContent = 'ENTRENAMIENTO'; e.goal.style.color = '#7fe07a'; }
    else if (S.final) { e.goalL.textContent = 'OBJETIVO'; e.goal.textContent = 'DERROTA AL JEFE'; e.goal.style.color = '#ff6a8a'; }
    else if (game.swarm) { e.goalL.textContent = 'ENJAMBRE'; e.goal.textContent = '¡ACTIVO! +' + fmtTime(game.stageTime - SWARM_TIME); e.goal.style.color = '#ff4d5e'; }
    else { e.goalL.textContent = 'ENJAMBRE EN'; e.goal.textContent = fmtTime(Math.max(0, SWARM_TIME - game.stageTime)); e.goal.style.color = ''; }
    e.diffName.textContent = game.diff.name + (game.chal ? ' · DESAFÍO ' + game.chal : ''); e.diffName.style.color = game.diff.color;
    // Racha de combo
    if (game.combo >= 5) {
      e.combo.style.display = 'block';
      if (e.comboN.textContent !== String(game.combo)) { e.comboN.textContent = game.combo; e.combo.classList.remove('bump'); void e.combo.offsetWidth; e.combo.classList.add('bump'); }
      sc(e.comboBar, game.comboT / 3);
      e.combo.style.setProperty('--cc', game.combo >= 100 ? '#ff4a3a' : game.combo >= 50 ? '#ff9a00' : '#ffe14a');
    } else e.combo.style.display = 'none';
    // Barra de la Habitación del Tiempo
    const z = game.zoneBusy;
    if (z && game.state === 'play') { e.zoneBox.style.display = 'block'; sc(e.zoneBar, z.charge); e.zoneTxt.textContent = Math.floor(z.charge * 100) + '%'; } else e.zoneBox.style.display = 'none';
    this.updatePrompt(game); e.balls.textContent = game.pickups.collected + ' / 7';
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
    if (this.mmT <= 0) { this.mmT = 0.1; this.drawMinimap(game, bi); if (game.showMap) this.paintMap(this.el.bigmapc.getContext('2d'), this.el.bigmapc.width, game, bi, true); }
  }

  /** Aviso "[E] abrir cápsula" con su precio cuando estás cerca de una */
  updatePrompt(game) {
    const e = this.el.prompt, info = game.state === 'play' ? game.promptInfo() : null;
    if (!info) { e.style.display = 'none'; return; }
    e.style.display = 'block'; e.className = info.ok ? '' : 'no';
    if (e.textContent !== info.t) e.textContent = info.t;
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

  drawMinimap(game, bossIdx) { this.paintMap(this.mmCtx, this.el.mm.width, game, bossIdx, false); }

  /** Dibuja el mapa (minimapa o mapa grande): cápsulas (normal/dorada/maldita), santuarios, comerciantes, altar, grieta y jefe */
  paintMap(g, N, game, bossIdx, big) {
    if (!g) return;
    const w = game.world, p = game.player, R = CFG.ARENA, X = (v) => ((v / R + 1) / 2) * N, k = big ? 2 : 1, t = game.time;
    g.clearRect(0, 0, N, N);
    if (w.mini) g.drawImage(w.mini, 0, 0, N, N);
    const sq = (x, z, s, c) => { g.fillStyle = c; g.fillRect(X(x) - s / 2, X(z) - s / 2, s, s); };
    for (let i = 0; i < 7; i++) if (!game.pickups.got[i]) sq(game.pickups.bx[i], game.pickups.bz[i], 3 * k, '#ffd84a');
    const CC = ['#ff7ad0', '#ffd24a', '#b050ff'];
    for (let i = 0; i < game.capsules.n; i++) sq(game.capsules.x[i], game.capsules.z[i], (game.capsules.gold[i] ? 3 : 2) * k, CC[game.capsules.gold[i]]);
    const PC = { boss: '#ff3050', time: '#6fd0ff', temple: '#5be07a', merchant: '#ffd24a', swapper: '#ff9a3a' };
    for (const o of game.points.list) {
      const used = o.used && o.type !== 'merchant' && o.type !== 'swapper', s = 5 * k, c = used ? '#667' : PC[o.type];
      g.fillStyle = c; g.strokeStyle = '#000'; g.lineWidth = 1;
      const cx = X(o.x), cy = X(o.z);
      g.beginPath();
      if (o.type === 'boss') { g.moveTo(cx, cy - s); g.lineTo(cx + s, cy); g.lineTo(cx, cy + s); g.lineTo(cx - s, cy); g.closePath(); }
      else if (o.type === 'time') g.arc(cx, cy, s * 0.8, 0, 6.3);
      else if (o.type === 'temple') { g.moveTo(cx, cy - s); g.lineTo(cx + s, cy + s * 0.8); g.lineTo(cx - s, cy + s * 0.8); g.closePath(); }
      else g.rect(cx - s * 0.7, cy - s * 0.7, s * 1.4, s * 1.4);
      g.fill(); g.stroke();
      if (big) { g.fillStyle = '#fff'; g.font = '10px Orbitron,monospace'; g.fillText(o.type === 'merchant' ? 'BULMA' : o.type === 'swapper' ? 'ROSHI' : o.type === 'boss' ? 'ALTAR' : o.type === 'time' ? 'TIEMPO' : 'TEMPLO', cx + s + 3, cy + 3); }
    }
    const r = game.points.rift;
    if (r) {
      const pulse = 5 * k + Math.sin(t * 6) * 2;
      g.fillStyle = '#d070ff'; g.strokeStyle = '#fff'; g.beginPath(); g.arc(X(r.x), X(r.z), pulse, 0, 6.3); g.fill(); g.stroke();
      if (big) { g.fillStyle = '#fff'; g.font = '11px Orbitron,monospace'; g.fillText('GRIETA', X(r.x) + pulse + 3, X(r.z) + 3); }
    }
    if (bossIdx >= 0) sq(game.horde.x[bossIdx], game.horde.z[bossIdx], 7 * k, '#ff3050');
    const ri = game.rivalUid ? game.horde.indexOfUid(game.rivalUid) : -1;
    if (ri >= 0) sq(game.horde.x[ri], game.horde.z[ri], 6 * k, '#ff9a00');
    for (const a of game.allies.list) sq(a.x, a.z, 4 * k, '#7fe07a');
    sq(p.x, p.z, 5 * k, '#fff');
    g.strokeStyle = '#35e0ff'; g.beginPath(); g.moveTo(X(p.x), X(p.z)); g.lineTo(X(p.x) - Math.sin(game.camYaw) * 12 * k, X(p.z) - Math.cos(game.camYaw) * 12 * k); g.stroke();
  }

  /** Aviso al abrir una cápsula: nombre, rareza y efecto del objeto */
  itemPopup(it, rar) {
    const e = this.el.itemPop;
    e.style.borderColor = rar.color; e.style.boxShadow = '0 0 24px ' + rar.color;
    e.innerHTML = '<div class="ip-i" style="color:' + rar.color + '">' + it.icon + '</div><div><small style="color:' + rar.color + '">' + rar.name + '</small><b>' + it.name + '</b><p>' + it.text + '</p></div>';
    e.classList.remove('go'); void e.offsetWidth; e.classList.add('go');
  }

  /* ---------- Comercio (Bulma / Roshi) ---------- */
  showTrade(html) { this.el.trade.innerHTML = '<div class="tb">' + html + '</div>'; this.el.trade.classList.add('show'); }
  hideTrade() { this.el.trade.classList.remove('show'); }

  /* ---------- Pantallas de pausa / derrota ---------- */
  showScreen(title, sub, html, aText, bText, kind) {
    const e = this.el;
    e.scrBox.className = 'box ' + (kind || '');
    e.scrTitle.textContent = title; e.scrSub.textContent = sub; e.scrStats.innerHTML = html;
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

  /* ---------- Menú principal (pantallas: inicio, jugar, tienda, misiones) ---------- */
  showMenu(game) {
    this.game = game;
    this.view = Save.d.sel;
    this.el.menu.classList.add('show');
    this.showHud(false);
    this.renderMenu();
  }
  hideMenu() { this.el.menu.classList.remove('show'); }
  claimable() {
    let n = 0;
    for (const m of MISSIONS) {
      if (m.daily && !Save.d.daily.ids.includes(m.id)) continue;
      if (!Save.isClaimed(m) && Save.progress(m) >= m.goal) n++;
    }
    return n;
  }

  renderMenu() {
    const e = this.el, s = this.screen, TITLES = { play: 'ELIGE A TU GUERRERO', shop: 'TIENDA', missions: 'MISIONES Y LOGROS', stats: 'ESTADÍSTICAS', options: 'OPCIONES' };
    e.zeniMenu.textContent = Save.d.zeni;
    e.menu.classList.toggle('ishome', s === 'home');
    e.menuNav.innerHTML = s === 'home' ? '' : '<button class="back" data-go="home">◂ VOLVER</button><h3>' + TITLES[s] + '</h3>';
    if (s === 'home') this.renderHome(); else if (s === 'play') this.renderPlay(); else if (s === 'shop') this.renderShopScreen(); else if (s === 'stats') this.renderStatsScreen(); else if (s === 'options') this.renderOptions(); else this.renderMissions();
    // Retratos: se dibujan después de generar el HTML
    for (const cv of e.menuBody.querySelectorAll('canvas[data-sheet]')) this.drawFrame(cv, cv.dataset.sheet, +cv.dataset.frame, +(cv.dataset.tint || 0));
  }

  renderHome() {
    const sel = charById(Save.d.sel), d = diffById(Save.d.diff), n = this.claimable();
    const daily = Save.d.daily.ids.map((id) => missionById(id)).map((m) => {
      const pr = Math.min(m.goal, Save.progress(m)), done = Save.isClaimed(m);
      return '<div class="dm' + (done ? ' done' : '') + '"><span>' + m.desc + '</span><div class="mb"><i style="width:' + (pr / m.goal * 100) + '%"></i></div></div>';
    }).join('');
    this.el.menuBody.innerHTML = '<div class="home"><div class="hl">' +
      '<div class="titlebox"><div class="logo-db"><span class="dball"></span><h1>DRAGON <br>BALL</h1></div><div class="ribbon">ULTIMATE SURVIVOR</div><p>SOBREVIVE · TRANSFÓRMATE · REÚNE LAS 7 ESFERAS</p></div>' +
      '<div class="hbtns"><button class="big play" data-go="play">▶ JUGAR<small>' + sel.name + ' · ' + d.name + '</small></button>' +
      '<button class="big" data-go="shop">TIENDA</button>' +
      '<button class="big" data-go="missions">MISIONES' + (n ? '<span class="badge">' + n + '</span>' : '') + '</button>' +
      '<button class="big" data-go="stats">ESTADÍSTICAS</button>' +
      '<button class="big" data-go="options">OPCIONES</button>' +
      '<button class="big ghost" data-exit>SALIR</button></div></div>' +
      '<div class="hr"><div class="hcard"><h4>MISIONES DIARIAS</h4>' + daily + '<h4 style="margin-top:12px">RACHA</h4><p>' + Save.d.login.streak + ' día(s) seguidos</p></div></div></div>';
  }

  renderPlay() {
    this.renderChars();
    const d = Save.d.diff;
    const diffs = DIFFS.map((x) => '<button class="dbtn' + (x.id === d ? ' on' : '') + '" style="--c:' + x.color + '" data-diff="' + x.id + '"><b>' + x.name + '</b><small>' + 'x' + x.coins + ' monedas · +' + x.reward + ' al ganar</small></button>').join('');
    const sel = charById(Save.d.sel);
    this.el.menuBody.innerHTML += '<div class="dim" style="text-align:center">3 MAPAS · 10 MIN POR MAPA ANTES DEL ENJAMBRE FINAL · MATA AL JEFE PARA ABRIR LA GRIETA</div><div class="playbar"><div class="diffs">' + diffs + '</div><button class="start alt" data-start="practice">ENTRENAMIENTO</button><button class="start" data-start>JUGAR CON ' + sel.name + ' [ENTER]</button></div>';
    for (const cv of this.el.menuBody.querySelectorAll('canvas[data-sheet]')) this.drawFrame(cv, cv.dataset.sheet, +cv.dataset.frame, +(cv.dataset.tint || 0));
  }

  renderChars() {
    const v = charById(this.view), owned = Save.d.unlocked.includes(v.id);
    let grid = '';
    for (const c of CHARACTERS) {
      const own = Save.d.unlocked.includes(c.id), sel = Save.d.sel === c.id;
      const cls = 'ch' + (sel ? ' sel' : '') + (own ? '' : ' locked') + (c.soon ? ' soon' : '') + (this.view === c.id ? ' view' : '');
      const tag = c.soon ? 'PRÓXIMAMENTE' : sel ? 'EQUIPADO' : own ? 'DESBLOQUEADO' : '🔒 ' + c.cost + ' ●';
      grid += '<div class="' + cls + '" data-ch="' + c.id + '">' +
        (c.portrait ? '<canvas width="108" height="79" data-sheet="' + c.portrait.sheet + '" data-frame="' + c.portrait.frame + '" data-tint="' + (c.portrait.tint || 0) + '"></canvas>' : '<div class="qm">?</div>') +
        '<b>' + c.name + '</b><small>' + c.role + '</small><span class="tag">' + tag + '</span>' + (c.provisional ? '<span class="prov">SPRITE PROVISIONAL</span>' : '') + '</div>';
    }
    let det = '';
    if (v.soon) det = '<h3>' + v.name + '</h3><p class="dim">' + v.role + '</p><p>Este guerrero llegará en una próxima actualización.</p>';
    else {
      const bar = (n, val, max) => '<div class="sb"><span>' + n + '</span><div><i style="width:' + Math.min(100, (val / max) * 100) + '%"></i></div><b>' + val + '</b></div>';
      const best = Save.d.best[v.id];
      const techs = v.unique.filter((id) => id !== v.start[0]).concat(Object.keys(WEAPONS).filter((id) => WEAPONS[id].shop && !WEAPONS[id].unique)).filter((id) => !WEAPONS[id].unique || WEAPONS[id].unique === v.id);
      det = '<h3>' + v.name + '</h3><p class="dim">' + v.role + '</p>' +
        bar('VIDA', v.hp, 160) + bar('KI', v.ki, 160) + bar('VEL', Math.round(v.spd * 100), 150) + bar('DAÑO', Math.round(v.dmg * 100), 150) +
        '<h4>PASIVA · ' + v.passive.name + '</h4><p>' + v.passive.desc + '</p>' +
        '<h4>ATAQUE BÁSICO</h4><p><i>' + WEAPONS[v.start[0]].icon + '</i> <b>' + WEAPONS[v.start[0]].name + '</b> · ' + WEAPONS[v.start[0]].lv[0] + '</p>' +
        '<h4>TÉCNICAS (al subir de nivel)</h4>' + techs.map((id) => { const W = WEAPONS[id], lock = W.shop && !Save.d.techs.includes(id); return '<p class="' + (lock ? 'lockt' : '') + '"><i>' + W.icon + '</i> <b>' + W.name + '</b> · NV ' + (W.minLv || 2) + (lock ? ' · 🔒 en la tienda' : '') + '</p>'; }).join('') +
        '<h4>TRANSFORMACIONES</h4><div class="forms">' + v.forms.map((f) => '<span>' + f.name + ' <em>NV ' + f.lvl + '</em></span>').join('') + '</div>' +
        (best ? '<h4>MEJOR PARTIDA</h4><p>' + fmtTime(best.time) + ' · ' + best.kills + ' enemigos · NV ' + best.level + '</p>' : '');
      if (!owned) det += '<button class="buy" data-buy="' + v.id + '"' + (Save.d.zeni < v.cost ? ' disabled' : '') + '>DESBLOQUEAR · ' + v.cost + ' ●</button>';
    }
    this.el.menuBody.innerHTML = '<div class="split"><div class="roster">' + grid + '</div><div class="detail">' + det + '</div></div>';
  }

  /* ---------- Tienda: mejoras permanentes, objetos y técnicas ---------- */
  renderShopScreen() {
    const tabs = [['upgrades', 'MEJORAS'], ['items', 'OBJETOS'], ['techs', 'TÉCNICAS']];
    const t = tabs.map((x) => '<button class="tab ' + (this.tab === x[0] ? 'on' : '') + '" data-tab="' + x[0] + '">' + x[1] + '</button>').join('');
    const body = this.tab === 'items' ? this.htmlItems() : this.tab === 'techs' ? this.htmlTechs() : this.htmlUpgrades();
    this.el.menuBody.innerHTML = '<div class="tabs">' + t + '</div>' + body;
  }
  htmlUpgrades() {
    let h = '<div class="shop"><div class="item info" style="grid-column:1/-1"><div><b>MEJORAS PERMANENTES</b><p>Se aplican solas al personaje al empezar cada partida.</p></div></div>';
    for (const l of LAB) {
      const lvl = Save.lab(l.id), maxed = lvl >= l.max, cost = labCost(l, lvl);
      let pips = ''; for (let k = 0; k < l.max; k++) pips += '<u class="' + (k < lvl ? 'on' : '') + '"></u>';
      h += '<div class="item"><div><b>' + l.name + '</b><p>' + l.desc + '</p><div class="pips">' + pips + '</div></div>' +
        '<button data-lab="' + l.id + '"' + (maxed || Save.d.zeni < cost ? ' disabled' : '') + '>' + (maxed ? 'MÁXIMO' : cost + ' ●') + '</button></div>';
    }
    return h + '</div>';
  }
  htmlItems() {
    let h = '<div class="shop"><div class="item info" style="grid-column:1/-1"><div><b>OBJETOS DE LAS CÁPSULAS</b><p>Las cápsulas del mapa dan un objeto aleatorio que dura solo esa partida. Aquí desbloqueas cuáles pueden tocarte: los más raros solo aparecen si los compras.</p></div></div>';
    for (let r = 0; r < 6; r++) {
      for (const it of ITEMS) {
        if (it.rarity !== r) continue;
        const rar = RARITIES[r], own = itemAvailable(it);
        h += '<div class="item" style="border-left:4px solid ' + rar.color + '"><div class="ic" style="color:' + rar.color + '">' + it.icon + '</div><div><small style="color:' + rar.color + '">' + rar.name + '</small><br><b>' + it.name + '</b><p>' + it.text + '</p></div>' +
          (own ? '<button disabled>' + (rar.cost ? 'DESBLOQUEADO' : 'DISPONIBLE') + '</button>' : '<button data-item="' + it.id + '"' + (Save.d.zeni < rar.cost ? ' disabled' : '') + '>' + rar.cost + ' ●</button>') + '</div>';
      }
    }
    return h + '</div>';
  }
  htmlTechs() {
    let h = '<div class="shop"><div class="item info" style="grid-column:1/-1"><div><b>TÉCNICAS DE DRAGON BALL</b><p>Una vez compradas, pueden aparecer como carta al subir de nivel (a partir de su nivel mínimo). Las exclusivas solo salen con su personaje.</p></div></div>';
    for (const id in WEAPONS) {
      const W = WEAPONS[id];
      if (!W.shop) continue;
      const own = Save.d.techs.includes(id), who = W.unique ? charById(W.unique).name : 'TODOS';
      h += '<div class="item"><div class="ic" style="color:#' + W.color.toString(16).padStart(6, '0') + '">' + W.icon + '</div><div><small style="color:var(--xp)">' + who + ' · NV ' + W.minLv + '</small><br><b>' + W.name + '</b><p>' + W.lv[0] + '</p></div>' +
        (own ? '<button disabled>COMPRADA</button>' : '<button data-tech="' + id + '"' + (Save.d.zeni < W.shop ? ' disabled' : '') + '>' + W.shop + ' ●</button>') + '</div>';
    }
    return h + '</div>';
  }

  /* ---------- Opciones: volumen ---------- */
  renderOptions() {
    const v = Save.d.vol || { mus: 0.5, sfx: 0.75 }, sl = (k, name, val) => '<div class="item opt"><div><b>' + name + '</b><input type="range" min="0" max="100" value="' + Math.round(val * 100) + '" data-vol="' + k + '"></div><b>' + Math.round(val * 100) + '%</b></div>';
    this.el.menuBody.innerHTML = '<div class="shop">' + sl('mus', 'MÚSICA', v.mus) + sl('sfx', 'EFECTOS DE SONIDO', v.sfx) +
      '<div class="item info"><div><b>SONIDO SINTETIZADO</b><p>Toda la música y los efectos se generan en el momento con Web Audio (sin archivos). En el móvil, el sonido se activa al tocar la pantalla por primera vez.</p></div></div></div>';
  }

  /* ---------- Estadísticas acumuladas ---------- */
  renderStatsScreen() {
    const st = Save.d.stats, n = (k) => Math.floor(st[k] || 0);
    const rows = [['PARTIDAS', n('runs')], ['VICTORIAS', n('wins')], ['TIEMPO JUGADO', fmtTime(n('time'))], ['MAPA MÁS LEJANO', n('maxStage') + ' / ' + STAGES.length], ['NIVEL MÁXIMO', n('maxLevel')],
      ['ENEMIGOS DERROTADOS', n('kills')], ['ÉLITES', n('elites')], ['JEFES', n('bosses')], ['DAÑO TOTAL', n('damage')], ['DAÑO RECIBIDO', n('taken')], ['DASHES', n('dashes')],
      ['CÁPSULAS ABIERTAS', n('capsules')], ['MALDICIONES', n('curses')], ['DESAFÍOS ACEPTADOS', n('temples')], ['HABITACIONES DEL TIEMPO', n('rooms')], ['DESEOS A SHENRON', n('wishes')], ['COMBO MÁXIMO', n('maxCombo')], ['GOLPE MÁS FUERTE', n('bestHit')], ['TRANSFORMACIONES', n('transforms')], ['FUSIONES', n('fusions')], ['EVENTOS', n('events')], ['RIVALES DERROTADOS', n('rivals')]];
    const best = CHARACTERS.filter((c) => Save.d.best[c.id]).map((c) => { const b = Save.d.best[c.id]; return '<div class="dm"><span>' + c.name + ' · ' + fmtTime(b.time) + ' · ' + b.kills + ' enemigos · NV ' + b.level + '</span></div>'; }).join('') || '<p class="dim">Aún no has jugado ninguna partida.</p>';
    this.el.menuBody.innerHTML = '<div class="msplit"><div><div class="sec">TOTALES</div><div class="sum">' + rows.map((r) => '<div><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('') + '</div></div><div><div class="sec">MEJORES PARTIDAS</div>' + best + '</div></div>';
  }

  /* ---------- Misiones ---------- */
  htmlMission(m) {
    const pr = Math.min(m.goal, Save.progress(m)), done = Save.isClaimed(m), ok = pr >= m.goal;
    return '<div class="item mi' + (done ? ' done' : '') + '"><div><b>' + m.name + '</b><p>' + m.desc + '</p><div class="mb"><i style="width:' + (pr / m.goal * 100) + '%"></i><em>' + Math.floor(pr) + ' / ' + m.goal + '</em></div></div>' +
      (done ? '<button disabled>COBRADA</button>' : '<button data-claim="' + m.id + '"' + (ok ? '' : ' disabled') + '>' + (ok ? 'COBRAR ' : '') + '+' + m.reward + ' ●</button>') + '</div>';
  }
  renderMissions() {
    const tabs = '<div class="tabs"><button class="tab ' + (this.mtab === 'missions' ? 'on' : '') + '" data-mtab="missions">MISIONES</button><button class="tab ' + (this.mtab === 'ach' ? 'on' : '') + '" data-mtab="ach">LOGROS · ' + ACHIEVEMENTS.filter((a) => Save.d.ach[a.id]).length + '/' + ACHIEVEMENTS.length + '</button></div>';
    if (this.mtab === 'ach') {
      const st = Save.d.stats;
      this.el.menuBody.innerHTML = tabs + '<div class="shop">' + ACHIEVEMENTS.map((a) => {
        const done = !!Save.d.ach[a.id], pr = Math.min(a.goal, st[a.stat] || 0);
        return '<div class="item ach' + (done ? ' done' : '') + '"><div class="ic">' + a.icon + '</div><div><b>' + a.name + '</b><p>' + a.desc + '</p><div class="mb"><i style="width:' + (pr / a.goal * 100) + '%"></i><em>' + fmtK(pr) + ' / ' + fmtK(a.goal) + '</em></div></div><span class="arw">' + (done ? '✔' : '+' + a.reward + ' ●') + '</span></div>';
      }).join('') + '</div>';
      return;
    }
    this.renderMissionsList(tabs);
  }
  renderMissionsList(tabs) {
    const l = Save.d.login, next = Save.checkLogin();
    let days = '';
    for (let i = 1; i <= 7; i++) days += '<span class="' + (i <= l.streak ? 'on' : '') + '"><b>' + i + '</b>+' + (100 + 50 * (i - 1)) + '</span>';
    this.el.menuBody.innerHTML = tabs + '<div class="msplit"><div><h4 class="sec">RACHA DE INICIO DE SESIÓN</h4><div class="streak">' + days + '</div>' + (next ? '' : '<p class="dim">Ya cobraste la recompensa de hoy. ¡Vuelve mañana!</p>') +
      '<h4 class="sec">DIARIAS · se renuevan cada día</h4><div class="mlist">' + Save.d.daily.ids.map((id) => this.htmlMission(missionById(id))).join('') + '</div></div>' +
      '<div><h4 class="sec">PERMANENTES</h4><div class="mlist">' + MISSIONS.filter((m) => !m.daily).map((m) => this.htmlMission(m)).join('') + '</div></div></div>';
  }

  /* ---------- Ventana de recompensa diaria y salida ---------- */
  showLogin() {
    const r = Save.checkLogin();
    if (!r) return;
    let days = '';
    for (let i = 1; i <= 7; i++) days += '<span class="' + (i < r.streak ? 'on' : i === r.streak ? 'now' : '') + '"><b>' + i + '</b>+' + (100 + 50 * (i - 1)) + '</span>';
    this.el.modal.innerHTML = '<div class="mbox"><small>RECOMPENSA DIARIA</small><h2>¡DÍA ' + r.streak + ' DE RACHA!</h2><div class="streak">' + days + '</div><div class="reward">+' + r.reward + ' MONEDAS</div><button data-login>COBRAR</button></div>';
    this.el.modal.classList.add('show');
  }
  hideModal() { this.el.modal.classList.remove('show'); }
  showExit(on) { this.el.exit.classList[on ? 'add' : 'remove']('show'); }
}
