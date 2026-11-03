'use strict';
/* =====================================================================
   game.js · Clase Game: estados, bucle principal (delta time), cámara
   orbital, oleadas, jefes, subida de nivel, transformaciones, esferas
   del dragón, recompensas y guardado. Arranque al final del archivo.
   Estados: menu | play | pause | levelup | wish | dying | over
   ===================================================================== */

class Game {
  constructor(sheets) {
    this.ui = new UIManager();
    this.state = 'menu';
    this.time = 0; this.kills = 0; this.spawnAcc = 0; this.zeniRun = 0; this.pendingLevels = 0;
    this.bossUid = 0; this.nextBoss = 180; this.leashT = 0; this.hitstop = 0; this.shakeAmt = 0;
    this.cash = 0; this.capsOpened = 0; this.diff = DIFFS[0]; this.won = false;
    // Cámara orbital: yaw (giro), pitch (inclinación) y dist (zoom)
    this.camYaw = 0; this.camPitch = 0.98; this.camDist = 19; this.camDistT = 19; this.camCos = 1; this.camSin = 0;
    this.drag = false;
    try {
      if (typeof THREE === 'undefined') throw new Error('Three.js no se cargó desde el CDN. Revisa tu conexión a internet.');
      if (!sheets || !sheets.goku_a || !sheets.shade) throw new Error('No se pudieron cargar los spritesheets (assets/sprites.js). Comprueba que la carpeta "assets" está junto a index.html.');
      this.initGL(sheets);
    } catch (err) {
      console.error(err);
      this.ui.fatal(String(err.message || err));
      return;
    }
    this.ui.sheets = sheets;
    this.bindEvents();
    this.clock = new THREE.Clock();
    this.loop = this.loop.bind(this);
    this.toMenu();
    requestAnimationFrame(this.loop);
  }

  initGL(sheets) {
    const canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 420);
    this.camLook = new THREE.Vector3(0, 0, 0);

    initShared();
    const tex = makeTextures();
    this.world = new World(this.scene);
    this.shadows = new SpriteBatch(this.scene, { max: CFG.MAX_ENEMIES + 2, texture: tex.shadow, w: 1, h: 0.5, anchor: 0.5, flat: true, blend: true, tint: 0x000000, alpha: 0.38, cut: 0.02, renderOrder: 1 });
    this.fx = new FX(this.scene, tex);
    this.player = new Player(this.scene, sheets, tex);
    this.horde = new HordeManager(this.scene, CFG.MAX_ENEMIES, sheets.shade);
    this.ki = new KiPool(this.scene, CFG.MAX_BULLETS, tex);
    this.orbs = new XpOrbs(this.scene, CFG.MAX_ORBS, tex);
    this.pickups = new Pickups(this.scene, tex);
    this.capsules = new Capsules(this.scene, tex);
    this.weapons = new WeaponSystem(this.scene, tex);
    // Al romper un cristal: orbes de experiencia, chispas y a veces una semilla
    this.world.onBreak = (x, z) => {
      this.orbs.spawn(x, z, 4); this.gainZeni(2); this.gainCash(8);
      this.fx.burst(this.fx.sparks, x, 1.2, z, 16, 7, 0.5, 0.35, 8, 0x9fe0ff);
      if (Math.random() < 0.3) this.pickups.drop(x, z);
    };
  }

  /* ---------- Entradas, ratón y botones ---------- */
  bindEvents() {
    const ui = this.ui, cv = this.renderer.domElement;
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight, false);
      this.applyView();
    });
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.state = 'pause'; ui.fatal('Se perdió el contexto WebGL (la GPU se reinició). Recarga la página.'); });
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (this.ui.el.modal.classList.contains('show') || this.ui.el.exit.classList.contains('show')) return;
      const s = this.state;
      if (s === 'menu' && e.code === 'Enter') this.start();
      else if (s === 'over' && (e.code === 'Enter' || e.code === 'KeyR')) this.start();
      else if (s === 'over' && (e.code === 'KeyM' || e.code === 'Escape')) this.toMenu();
      else if ((s === 'play' || s === 'pause') && (e.code === 'KeyP' || e.code === 'Escape')) this.togglePause();
      else if (s === 'play' && e.code === 'KeyE') this.tryOpenCapsule();
      else if ((s === 'levelup' || s === 'wish') && /^Digit[1-3]$/.test(e.code)) ui.pickCard(+e.code[5] - 1);
    });
    // Cámara con el ratón: arrastra con el botón derecho (o central), rueda para el zoom
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    // Cámara libre estilo Megabonk: el ratón queda capturado (pointer lock) y mueve la cámara siempre
    cv.addEventListener('mousedown', (e) => { if (this.state === 'play' && !this.locked()) this.grabMouse(); else if (e.button !== 0) this.drag = true; });
    window.addEventListener('mouseup', () => { this.drag = false; });
    window.addEventListener('mousemove', (e) => {
      if (this.state !== 'play' && this.state !== 'dying') return;
      if (!this.locked() && !this.drag) return;                       // sin captura: botón derecho + arrastrar
      this.camYaw -= e.movementX * 0.0025;
      this.camPitch = clamp(this.camPitch + e.movementY * 0.0025, 0.12, 1.35);
    });
    // Si el navegador libera el ratón (Esc) durante la partida, se pausa
    document.addEventListener('pointerlockchange', () => { if (!this.locked() && this.state === 'play') this.togglePause(); });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); this.camDistT = clamp(this.camDistT + e.deltaY * 0.015, 9, 40); }, { passive: false });

    // Menú (delegación de eventos): cada botón lleva un data-* con su acción
    ui.el.menu.addEventListener('click', (e) => {
      const t = e.target.closest('[data-go],[data-tab],[data-ch],[data-buy],[data-equip],[data-lab],[data-item],[data-tech],[data-claim],[data-diff],[data-start],[data-exit]');
      if (!t) return;
      const D = t.dataset;
      if (D.go) this.go(D.go);
      else if (D.tab) { ui.tab = D.tab; ui.renderMenu(); }
      else if (D.ch) this.viewChar(D.ch);
      else if (D.buy) this.buyChar(D.buy);
      else if (D.equip) this.viewChar(D.equip, true);
      else if (D.lab) this.buyLab(D.lab);
      else if (D.item) this.buyItem(D.item);
      else if (D.tech) this.buyTech(D.tech);
      else if (D.claim) this.claimMission(D.claim);
      else if (D.diff) { Save.d.diff = D.diff; Save.write(); ui.renderMenu(); }
      else if (D.start !== undefined) this.start();
      else if (D.exit !== undefined) ui.showExit(true);
    });
    ui.el.exit.addEventListener('click', () => ui.showExit(false));
    ui.el.modal.addEventListener('click', (e) => { if (e.target.closest('[data-login]')) this.claimLogin(); else if (e.target.closest('[data-close]')) ui.hideModal(); });
    ui.el.cardRow.addEventListener('click', (e) => { const c = e.target.closest('.card'); if (c) ui.pickCard(+c.dataset.i); });
    ui.el.scrA.onclick = () => { ui.el.scrA.blur(); if (this.state === 'pause') this.togglePause(); else this.start(); };
    ui.el.scrB.onclick = () => { ui.el.scrB.blur(); if (this.state === 'pause') this.abandon(); else this.toMenu(); };
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play') this.togglePause(); });
  }

  locked() { return document.pointerLockElement === this.renderer.domElement; }
  grabMouse() { try { const r = this.renderer.domElement.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* sin pointer lock */ } }
  releaseMouse() { try { if (this.locked()) document.exitPointerLock(); } catch (e) { /* nada */ } }

  /* ---------- Menú: selección, compras y vista previa ---------- */
  viewChar(id) {
    const c = charById(id), ui = this.ui;
    ui.view = id;
    if (Save.d.unlocked.includes(id) && !c.soon) { Save.d.sel = id; Save.write(); this.previewPlayer(); }
    ui.renderMenu();
  }
  /** Cambia de pantalla del menú (inicio, jugar, tienda, misiones) */
  go(screen) { this.ui.screen = screen; this.ui.renderMenu(); this.applyView(); }
  /** En la pantalla de inicio el personaje se desplaza a la derecha para dejar sitio a los botones */
  applyView() {
    const w = window.innerWidth, h = window.innerHeight;
    if (this.state === 'menu' && this.ui.screen === 'home' && w > 900) this.camera.setViewOffset(w, h, -w * 0.2, 0, w, h);
    else this.camera.clearViewOffset();
  }
  buyChar(id) {
    const c = charById(id);
    if (!c || c.soon || Save.d.unlocked.includes(id) || Save.d.zeni < c.cost) return;
    Save.d.zeni -= c.cost; Save.d.unlocked.push(id); Save.d.sel = id; Save.write();
    this.previewPlayer(); this.ui.view = id; this.ui.renderMenu();
  }
  buyLab(id) {
    const l = LAB.find((x) => x.id === id), lvl = Save.lab(id), cost = labCost(l, lvl);
    if (lvl >= l.max || Save.d.zeni < cost) return;
    Save.d.zeni -= cost; Save.d.up[id] = lvl + 1; Save.write();
    this.previewPlayer(); this.ui.renderMenu();
  }
  /** El personaje elegido se ve en el mundo 3D detrás del menú */
  previewPlayer() {
    this.player.reset(charById(Save.d.sel));
    this.syncSprites();
  }

  syncSprites() {
    this.shadows.begin();
    this.player.syncSprite(this.shadows);
    this.horde.sync(this.shadows);
    this.shadows.end();
  }

  toMenu() {
    this.state = 'menu'; this.releaseMouse();
    this.horde.reset(); this.ki.reset(); this.orbs.reset(); this.fx.reset(); this.weapons.reset(charById(Save.d.sel));
    this.pickups.senzu.reset(); this.pickups.balls.reset(); this.capsules.n = 0; this.capsules.spr.reset(); this.capsules.glow.reset();
    this.ui.hideScreen(); this.ui.hideCards();
    this.previewPlayer();
    this.camYaw = 0.5; this.camPitch = 0.75; this.camDistT = 20; this.camDist = 20;
    this.camLook.set(0, 0, 0);
    this.ui.screen = 'home';
    this.ui.showMenu(this);
    this.applyView();
    this.ui.showHud(false);
  }

  /* ---------- Partida ---------- */
  start() {
    const ch = charById(Save.d.sel);
    if (!ch || ch.soon || !Save.d.unlocked.includes(ch.id)) return;
    this.player.reset(ch); this.weapons.reset(ch);
    this.horde.reset(); this.ki.reset(); this.orbs.reset(); this.fx.reset(); this.world.reset(); this.pickups.reset(this.world); this.capsules.reset(this.world);
    this.diff = diffById(Save.d.diff); this.cash = 0; this.capsOpened = 0; this.won = false; this.camera.clearViewOffset();
    this.time = 0; this.kills = 0; this.spawnAcc = 0; this.zeniRun = 0; this.pendingLevels = 0; this.bossUid = 0; this.nextBoss = 180; this.leashT = 0;
    this.hitstop = 0; this.shakeAmt = 0; this.ui.flash = 0;
    this.applyForm();
    for (let i = 0; i < 14; i++) this.spawnEnemy();
    this.horde.buildGrid();
    this.camYaw = 0; this.camPitch = 0.6; this.camDist = this.camDistT = 19;
    this.camLook.set(0, 1.4, 0);
    this.grabMouse();
    this.syncSprites();
    this.ui.hideMenu(); this.ui.hideScreen(); this.ui.hideCards(); this.ui.showHud(true);
    this.ui.wKey = ''; this.ui.lastBiome = -1;
    if (ch.portrait) this.ui.drawFrame(this.ui.el.portrait, ch.portrait.sheet, ch.portrait.frame);
    this.state = 'play';
    this.clock.getDelta();
    this.ui.toast(ch.name);
  }

  togglePause() {
    if (this.state === 'play') {
      this.releaseMouse();
      this.state = 'pause';
      this.ui.showScreen('PAUSA', 'JUEGO DETENIDO', '<div class="sum"><div><span>NIVEL</span><b>' + this.player.level + '</b></div><div><span>ENEMIGOS</span><b>' + this.kills + '</b></div><div><span>TIEMPO</span><b>' + fmtTime(this.time) + ' / ' + fmtTime(this.diff.goal) + '</b></div><div><span>ZENI</span><b>' + Math.floor(this.cash) + '</b></div></div>', 'CONTINUAR [P]', 'ABANDONAR PARTIDA', 'pause');
    } else if (this.state === 'pause') { this.state = 'play'; this.ui.hideScreen(); this.grabMouse(); this.clock.getDelta(); }
  }

  /** Cierra la partida: monedas, récord, estadísticas y misiones. Devuelve {coins, bonus} */
  finishRun(win) {
    const p = this.player, id = p.ch.id, d = this.diff;
    let coins = Math.floor(this.zeniRun * d.coins), bonus = 0;
    if (win) {                                    // primera victoria con ese personaje y dificultad = premio completo; después, un 20%
      const key = id + ':' + d.id, first = !Save.d.clears[key];
      bonus = first ? d.reward : Math.round(d.reward * 0.2);
      Save.d.clears[key] = (Save.d.clears[key] || 0) + 1;
      this.track('wins', 1);
    }
    coins += bonus;
    Save.d.zeni += coins;
    this.track('runs', 1); this.track('time', Math.floor(this.time)); this.trackMax('maxLevel', p.level);
    const b = Save.d.best[id];
    if (!b || this.time > b.time) Save.d.best[id] = { time: Math.floor(this.time), kills: this.kills, level: p.level };
    Save.write();
    return { coins, bonus };
  }
  abandon() { this.finishRun(false); this.toMenu(); }

  runSummary(r) {
    const rows = [['ENEMIGOS DERROTADOS', this.kills], ['NIVEL ALCANZADO', this.player.level], ['TIEMPO', fmtTime(this.time)],
      ['CÁPSULAS ABIERTAS', this.capsOpened], ['ESFERAS DEL DRAGÓN', this.pickups.collected + ' / 7'], ['DIFICULTAD', this.diff.name]];
    let h = '<div class="sum">' + rows.map((x) => '<div><span>' + x[0] + '</span><b>' + x[1] + '</b></div>').join('') + '</div>';
    h += '<div class="reward">+' + r.coins + ' MONEDAS' + (r.bonus ? '<small>incluye ' + r.bonus + ' de bonificación por completar el nivel</small>' : '') + '</div>';
    return h;
  }
  gameOver() {
    this.state = 'over'; this.releaseMouse();
    this.ui.showScreen('DERROTA', 'HAS CAÍDO EN COMBATE', this.runSummary(this.finishRun(false)), 'REINTENTAR [R]', 'MENÚ [M]', 'lose');
  }
  victory() {
    this.won = true; this.state = 'over'; this.releaseMouse();
    this.fx.ring(this.fx.aura, this.player.x, 0.5, this.player.z, 70, 24, 0.9, 0.5, 0xffd24a);
    this.ui.showScreen('¡VICTORIA!', 'HAS SOBREVIVIDO · ' + this.diff.name, this.runSummary(this.finishRun(true)), 'JUGAR OTRA VEZ [R]', 'MENÚ [M]', 'win');
  }

  /* ---------- Formas y efectos ---------- */
  applyForm() {
    const p = this.player;
    this.fx.aura.setColor(p.form.aura || 0xfff2b0);
    this.fx.sparks.setColor(p.form.ki);
  }
  /** Cambia de forma según el nivel (cada personaje tiene su tabla de transformaciones) */
  checkTransformation() {
    const p = this.player;
    let best = 0;
    p.ch.forms.forEach((f, i) => { if (p.level >= f.lvl) best = i; });
    if (best === p.formIdx) return;
    p.setForm(best); this.applyForm();
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.3);
    this.ui.toast(p.form.name + '!');
    const c = p.form.aura || 0xffffff;
    this.fx.ring(this.fx.aura, p.x, 0.4, p.z, 60, 22, 0.8, 0.45, c);
    this.fx.burst(this.fx.sparks, p.x, 1.4, p.z, 50, 14, 0.9, 0.5, 2, c);
    this.horde.shockwave(p.x, p.z, 16, 26);
    this.shake(1.2); this.hitstop = 0.18;
  }

  gainZeni(v) { this.zeniRun += v * this.player.zeniMul; }

  /* ---------- Cápsulas y objetos ---------- */
  /** Sortea rareza (la suerte y el tiempo suben las altas; la cápsula dorada mejora las probabilidades) y un objeto disponible */
  rollItem(gold) {
    const p = this.player, w = gold ? [0, 30, 35, 22, 10, 3] : [60, 26, 9, 3.5, 1.2, 0.3], boost = (1 + p.luck * 0.1) * Math.min(2, 1 + this.time / 900);
    let tot = 0;
    for (let i = 1; i < 6; i++) w[i] *= boost;
    for (let i = 0; i < 6; i++) tot += w[i];
    let r = Math.random() * tot, tier = 0;
    for (let i = 0; i < 6; i++) { r -= w[i]; if (r <= 0) { tier = i; break; } }
    for (let t = tier; t >= 0; t--) {                    // si no hay objetos desbloqueados de esa rareza, baja un escalón
      const pool = ITEMS.filter((it) => it.rarity === t && itemAvailable(it));
      if (pool.length) return pick(pool);
    }
    return ITEMS[0];
  }
  openCapsule(gold, x, z) {
    const it = this.rollItem(gold), p = this.player, rar = RARITIES[it.rarity], col = parseInt(rar.color.slice(1), 16);
    it.apply(p);
    p.items[it.id] = (p.items[it.id] || 0) + 1;
    this.fx.burst(this.fx.sparks, x, 1, z, 20 + it.rarity * 8, 8, 0.6, 0.4, 5, col);
    this.fx.ring(this.fx.aura, x, 0.5, z, 30 + it.rarity * 8, 10 + it.rarity * 2, 0.6, 0.4, col);
    this.shake(0.2 + it.rarity * 0.12);
    if (it.rarity >= 4) { this.hitstop = 0.12; this.fx.ring(this.fx.aura, p.x, 0.5, p.z, 60, 22, 0.8, 0.45, col); }
    this.ui.itemPopup(it, rar);
  }
  /** Desbloquea un objeto en la Tienda: a partir de ahí puede salir en las cápsulas */
  buyItem(id) {
    const it = itemById(id), cost = RARITIES[it.rarity].cost;
    if (!it || itemAvailable(it) || Save.d.zeni < cost) return;
    Save.d.zeni -= cost; Save.d.items.push(id); Save.write();
    this.ui.renderMenu();
  }
  /** Compra una técnica: desde ese momento puede aparecer al subir de nivel */
  buyTech(id) {
    const t = WEAPONS[id];
    if (!t || !t.shop || Save.d.techs.includes(id) || Save.d.zeni < t.shop) return;
    Save.d.zeni -= t.shop; Save.d.techs.push(id); Save.write();
    this.ui.renderMenu();
  }
  claimMission(id) {
    const m = missionById(id);
    if (!m || Save.isClaimed(m) || Save.progress(m) < m.goal) return;
    if (m.daily) Save.d.daily.claimed[id] = true; else Save.d.claimed[id] = true;
    Save.d.zeni += m.reward; Save.write();
    this.ui.renderMenu();
  }
  claimLogin() {
    const l = Save.checkLogin();
    if (l) { Save.d.login = { last: todayStr(), streak: l.streak }; Save.d.zeni += l.reward; Save.write(); }
    this.ui.hideModal(); this.ui.renderMenu();
  }
  /** Seguimiento de misiones: suma al total y al progreso diario */
  track(stat, n) {
    const s = Save.d.stats; s[stat] = (s[stat] || 0) + n;
    const p = Save.d.daily.prog; p[stat] = (p[stat] || 0) + n;
  }
  trackMax(stat, v) {
    const s = Save.d.stats, p = Save.d.daily.prog;
    if (v > (s[stat] || 0)) s[stat] = v;
    if (v > (p[stat] || 0)) p[stat] = v;
  }
  gainCash(v) { this.cash += v * this.player.zeniMul; }
  capsuleCost(gold) { return Math.round(20 * Math.pow(1.22, this.capsOpened) * (gold ? 1.6 : 1)); }
  /** E: abre la cápsula cercana si hay dinero suficiente. Cada apertura encarece las siguientes */
  tryOpenCapsule() {
    const c = this.capsules, i = c.near;
    if (i < 0) return;
    const cost = this.capsuleCost(c.gold[i]);
    if (this.cash < cost) { this.ui.toast('NECESITAS ' + cost + ' ZENI', true); return; }
    this.cash -= cost; this.capsOpened++; this.track('capsules', 1);
    const gold = c.gold[i], x = c.x[i], z = c.z[i];
    c.removeAt(i); c.near = -1;
    this.openCapsule(gold, x, z);
  }

  shake(a) { this.shakeAmt = Math.min(1.4, Math.max(this.shakeAmt, a)); }
  enemyDamage() { return (7 + this.time * 0.03) * this.diff.dmg; }

  /** Explosión de área reutilizable (minas, meteoros, Big Bang) */
  explode(x, z, r, dmg, tint) {
    this.horde.damageRadius(x, z, r, dmg, 10, this);
    this.world.damageArea(x, z, r, dmg);
    this.fx.burst(this.fx.sparks, x, 1, z, 16, r * 2.4, 0.5, 0.4, 6, tint);
    this.fx.ring(this.fx.aura, x, 0.4, z, 28, r * 3, 0.4, 0.35, tint);
    this.shake(0.3);
  }

  /* ---------- Enemigos y jefes ---------- */
  spawnPos(minR, maxR) {
    const p = this.player, lim = CFG.ARENA + 1, r = rand(minR, maxR);
    let a = rand(0, Math.PI * 2);
    let x = clamp(p.x + Math.cos(a) * r, -lim, lim), z = clamp(p.z + Math.sin(a) * r, -lim, lim);
    if (Math.hypot(x - p.x, z - p.z) < minR * 0.6) {      // el borde del mapa la acercó demasiado: lado opuesto
      a += Math.PI;
      x = clamp(p.x + Math.cos(a) * r, -lim, lim); z = clamp(p.z + Math.sin(a) * r, -lim, lim);
    }
    this._sx = x; this._sz = z;
  }
  spawnEnemy() {
    const r = Math.random(), t = this.time > 45 && r < 0.02 + this.time / 14000 ? 4 : this.time > 90 && r < 0.14 ? 2 : this.time > 35 && r < 0.37 ? 1 : 0;
    this.spawnPos(32, 40);
    this.horde.spawn(this._sx, this._sz, (14 + this.time * 0.25) * ENEMY_TYPES[t].hp * this.diff.hp, t);
  }
  spawnBoss() {
    this.spawnPos(30, 34);
    const i = this.horde.spawn(this._sx, this._sz, (700 + this.time * 6) * this.diff.hp, 3);
    if (i >= 0) { this.bossUid = this.horde.uid[i]; this.ui.toast('¡JEFE!'); this.shake(0.8); }
  }

  onEnemyKilled(x, z, type) {
    this.kills++; this.track('kills', 1);
    this.gainCash(ENEMY_TYPES[type].cash);
    this.orbs.spawn(x, z, ENEMY_TYPES[type].xp);
    this.gainZeni(type === 3 ? 60 : 0.5 * ENEMY_TYPES[type].xp);
    this.fx.burst(this.fx.gore, x, 1, z, 7, 6, 0.55, 0.3, 12);
    this.fx.burst(this.fx.sparks, x, 1, z, 4, 5, 0.35, 0.25, 6);
    const p = this.player;
    if (p.killHeal) p.hp = Math.min(p.maxHp, p.hp + p.killHeal);
    if (p.ch.id === 'black') p.hp = Math.min(p.maxHp, p.hp + 0.6);          // pasiva: Justicia Divina
    if (type === 4) {
      this.track('elites', 1);
      this.fx.ring(this.fx.aura, x, 0.4, z, 36, 12, 0.6, 0.4, 0xffc83a);
      for (let i = 0; i < 4; i++) this.orbs.spawn(x, z, 4);
      this.ui.toast('+' + Math.round(ENEMY_TYPES[4].cash * p.zeniMul) + ' ZENI · ÉLITE', true);
      if (Math.random() < 0.3) this.capsules.add(x, z, false, this.world);
    } else if (type === 3) {
      this.track('bosses', 1);
      this.bossUid = 0; this.pendingLevels++;
      this.capsules.add(x, z, true, this.world);
      for (let i = 0; i < 4; i++) this.pickups.drop(x + rand(-3, 3), z + rand(-3, 3));
      for (let i = 0; i < 12; i++) this.orbs.spawn(x, z, 5);
      this.fx.ring(this.fx.aura, x, 0.4, z, 50, 18, 0.7, 0.45, 0xffd24a);
      this.ui.toast('¡JEFE DERROTADO!'); this.shake(1);
    } else {
      if (Math.random() < 0.012) this.pickups.drop(x, z);
      if (type === 2 && Math.random() < 0.04) this.capsules.add(x, z, false, this.world);
    }
  }

  /* ---------- Experiencia y mejoras ---------- */
  addXp(v) {
    const p = this.player;
    p.xp += v * p.xpMul;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext; p.level++; p.xpNext = p.xpFor(p.level);
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.1);
      this.pendingLevels++;
      this.fx.ring(this.fx.aura, p.x, 0.5, p.z, 36, 12, 0.5, 0.3);
      this.checkTransformation();
    }
  }

  /** 3 cartas distintas: mejoras de armas equipadas, armas nuevas (propias del personaje) y vitaminas */
  rollCards() {
    const p = this.player, W = this.weapons, pool = [];
    for (const w of W.list) if (w.lv < MAX_WEAPON_LEVEL) { pool.push({ t: 'weapon', id: w.id }); if (WEAPONS[w.id].unique) pool.push({ t: 'weapon', id: w.id }); }
    if (W.list.length < MAX_WEAPONS) {
      for (const id in WEAPONS) {
        const u = WEAPONS[id].unique;
        const D = WEAPONS[id];
        if (!W.get(id) && (!u || u === p.ch.id) && (D.minLv || 0) <= p.level && (!D.shop || (Save.d.techs || []).includes(id))) { pool.push({ t: 'weapon', id }); if (u) pool.push({ t: 'weapon', id }); }
      }
    }
    for (const s of STATS) if ((p.stacks[s.id] || 0) < s.max) pool.push({ t: 'stat', id: s.id });
    const out = [], seen = {};
    for (let k = 0; k < 80 && out.length < 3 && pool.length; k++) {
      const c = pick(pool), key = c.t + c.id;
      if (seen[key]) continue;
      seen[key] = 1; out.push(c);
    }
    const cards = out.map((c) => {
      if (c.t === 'weapon') {
        const d = WEAPONS[c.id], cur = W.levelOf(c.id), nl = cur + 1;
        return { type: 'weapon', id: c.id, icon: d.icon, tag: cur ? 'MEJORA · NV ' + nl : d.unique ? 'TÉCNICA' : 'NUEVA ARMA', title: d.name, text: d.lv[nl - 1], max: MAX_WEAPON_LEVEL, lv: nl };
      }
      const s = STATS.find((x) => x.id === c.id), n = (p.stacks[c.id] || 0) + 1;
      return { type: 'stat', id: c.id, icon: s.icon, tag: 'VITAMINA · ' + n + '/' + s.max, title: s.name, text: s.text, max: s.max, lv: n };
    });
    while (cards.length < 3) cards.push({ type: 'heal', id: 'heal', icon: '❖', tag: 'RECOMPENSA', title: 'Semilla Senzu', text: 'Recuperas toda la vida.', max: 0, lv: 0 });
    return cards;
  }

  openLevelUp() {
    this.state = 'levelup'; this.releaseMouse();
    this.ui.showCards('¡NIVEL ' + this.player.level + '!', 'ELIGE UNA MEJORA [1 · 2 · 3]', this.rollCards(), (c) => {
      const p = this.player;
      if (c.type === 'weapon') this.weapons.add(c.id);
      else if (c.type === 'stat') { p.stacks[c.id] = c.lv; STATS.find((s) => s.id === c.id).apply(p); }
      else p.hp = p.maxHp;
      this.pendingLevels--;
      this.ui.hideCards();
      if (this.pendingLevels > 0) this.openLevelUp(); else this.resume();
    });
  }
  resume() { this.state = 'play'; this.grabMouse(); this.clock.getDelta(); }

  /* ---------- Esferas del Dragón y deseo de Shenron ---------- */
  onBall(n, x, z) {
    this.gainZeni(50);
    this.fx.ring(this.fx.aura, x, 0.5, z, 40, 14, 0.7, 0.4, 0xffb030);
    this.ui.toast('ESFERA ' + n + ' / 7', true);
    this.shake(0.4);
    if (n >= 7) { this.track('wishes', 1); this.openWish(); }
  }
  openWish() {
    this.state = 'wish'; this.releaseMouse();
    this.ui.toast('¡SHENRON!');
    const all = [
      { id: 'hp', icon: '♥', title: 'Vitalidad eterna', text: '+100 de vida máxima y curación total.' },
      { id: 'dmg', icon: '⬆', title: 'Poder ilimitado', text: '+35% de daño durante toda la partida.' },
      { id: 'zeni', icon: '$', title: 'Fortuna', text: '+400 Zeni ahora y +500 monedas al terminar la partida.' },
      { id: 'revive', icon: '✚', title: 'Segunda oportunidad', text: 'Revives una vez con el 50% de vida.' },
      { id: 'lv', icon: '★', title: 'Entrenamiento divino', text: 'Subes 2 niveles al instante.' }
    ];
    const cards = [];
    while (cards.length < 3) { const c = pick(all); if (!cards.includes(c)) cards.push(c); }
    this.ui.showCards('SHENRON TE ESCUCHA', 'PIDE TU DESEO [1 · 2 · 3]', cards.map((c) => ({ type: 'wish', id: c.id, icon: c.icon, tag: 'DESEO', title: c.title, text: c.text, max: 0, lv: 0 })), (c) => {
      const p = this.player;
      if (c.id === 'hp') { p.maxHp += 100; p.hp = p.maxHp; }
      else if (c.id === 'dmg') p.statDmg += 0.35;
      else if (c.id === 'zeni') { this.zeniRun += 500; this.gainCash(400); }
      else if (c.id === 'revive') p.canRevive = true;
      else { this.addXp(p.xpNext - p.xp); this.addXp(p.xpNext); }
      this.pickups.scatterBalls();
      this.ui.hideCards();
      if (this.pendingLevels > 0) this.openLevelUp(); else this.resume();
    });
  }

  /* ---------- Cámara orbital con interpolación suave ---------- */
  updateCamera(dt, rawDt, menu) {
    const p = this.player;
    if (menu) this.camYaw += rawDt * 0.15;
    else {
      if (keys.KeyT) { this.camPitch = 0.6; this.camDistT = 19; }
    }
    this.camCos = Math.cos(this.camYaw); this.camSin = Math.sin(this.camYaw);
    const k = 1 - Math.exp(-6 * dt);
    this.camLook.x += (p.x - this.camLook.x) * k;
    this.camLook.z += (p.z - this.camLook.z) * k;
    this.camLook.y = menu ? 0 : 1.4;
    this.camDist += (this.camDistT - this.camDist) * (1 - Math.exp(-8 * rawDt));
    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch), s = this.shakeAmt, d = this.camDist;
    this.camera.position.set(
      this.camLook.x + this.camSin * d * cp + (Math.random() - 0.5) * s * 1.2,
      this.camLook.y + d * sp + (Math.random() - 0.5) * s * 1.2,
      this.camLook.z + this.camCos * d * cp);
    this.camera.lookAt(this.camLook);
    this.shakeAmt = Math.max(0, s - rawDt * 2.6);
  }

  /* ---------- Un paso de simulación (dt ya incluye el hitstop) ---------- */
  update(dt) {
    const p = this.player, h = this.horde;
    this.time += dt;
    p.update(dt, this);
    this.weapons.update(dt, this);

    this.spawnAcc += Math.min(4 + this.time * 0.09, 22) * this.diff.spawn * dt;
    while (this.spawnAcc >= 1) { this.spawnAcc -= 1; this.spawnEnemy(); }
    if (!this.won && this.time >= this.diff.goal) { this.victory(); return; }
    if (this.time >= this.nextBoss) { this.nextBoss += 180; this.spawnBoss(); }
    h.speed = 3.4 + Math.min(this.time * 0.01, 2.2);

    const edt = dt * (p.charging ? CFG.CHARGE_TIME_SCALE : 1);      // cargar Ki ralentiza el mundo
    h.update(edt, p, this);
    this.ki.update(dt, this);
    h.reap(this);                                                   // se retiran DESPUÉS de las colisiones
    h.buildGrid();
    this.orbs.update(dt, p, this);
    this.pickups.update(dt, p, this);
    this.capsules.update(dt, p, this);
    this.world.follow(p.x, p.z);

    // Enemigos que se quedan muy lejos reaparecen cerca (el mapa es grande)
    this.leashT -= dt;
    if (this.leashT <= 0) {
      this.leashT = 0.5;
      for (let i = 0; i < h.n; i++) {
        const dx = h.x[i] - p.x, dz = h.z[i] - p.z;
        if (dx * dx + dz * dz > 6400 && h.type[i] !== 3) { this.spawnPos(32, 40); h.x[i] = this._sx; h.z[i] = this._sz; }
      }
    }

    if (p.hp <= 0) {
      if (p.canRevive) {                                           // Esfera de Reserva / deseo
        p.canRevive = false; p.hp = p.maxHp * 0.5; p.iframes = 3;
        h.shockwave(p.x, p.z, 20, 30);
        this.fx.ring(this.fx.aura, p.x, 0.5, p.z, 60, 20, 0.8, 0.45, 0xffffff);
        this.ui.toast('¡RENACES!'); this.shake(1);
      } else { p.die(); this.state = 'dying'; this.releaseMouse(); }
    }
    if (this.state === 'play' && this.pendingLevels > 0) this.openLevelUp();
    this.syncSprites();
  }

  loop() {
    requestAnimationFrame(this.loop);
    const rawDt = Math.min(this.clock.getDelta(), 0.05);              // delta time acotado
    const s = this.state;
    if (s === 'play') {
      let dt = 0;
      if (this.hitstop > 0) this.hitstop -= rawDt; else dt = rawDt;
      if (dt > 0) this.update(dt);
      this.fx.update(dt);
      this.updateCamera(Math.max(dt, rawDt * 0.25), rawDt, false);
      this.ui.update(this, rawDt);
    } else if (s === 'dying') {
      const done = this.player.updateDeath(rawDt);
      this.fx.update(rawDt * 0.4);
      this.syncSprites();
      this.updateCamera(rawDt, rawDt, false);
      this.ui.update(this, rawDt);
      if (done) this.gameOver();
    } else if (s === 'menu') {
      this.player.animT += rawDt;
      this.player.pose();
      this.syncSprites();
      this.fx.update(rawDt);
      this.updateCamera(rawDt, rawDt, true);
    } else {                                                          // pausa, cartas, deseo, fin: mundo congelado
      this.updateCamera(0.0001, 0, false);
    }
    this.renderer.render(this.scene, this.camera);
  }
}

/* ---------- ARRANQUE: carga las hojas de sprites y crea el juego ---------- */
(async function boot() {
  let sheets = null;
  try { Save.load(); Save.checkDaily(); Save.write(); if (typeof THREE !== 'undefined') sheets = await loadSheets(SHEET_NAMES); } catch (e) { console.error(e); }
  window.game = new Game(sheets);
  if (window.game.ui && Save.checkLogin()) window.game.ui.showLogin();
  const l = document.getElementById('loading');
  if (l) l.style.display = 'none';
})();
