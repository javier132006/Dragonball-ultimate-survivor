'use strict';
/* =====================================================================
   game.js · Clase Game: estados, bucle principal (delta time), cámara
   orbital, oleadas, jefes, subida de nivel, transformaciones, esferas
   del dragón, recompensas y guardado. Arranque al final del archivo.
   Estados: menu | play | pause | levelup | wish | dying | over
   ===================================================================== */

/** Estadísticas de la partida en curso (se muestran en la pausa y al terminar) */
const newRun = () => ({ damage: 0, best: 0, taken: 0, dashes: 0, curses: 0, temples: 0, rooms: 0, shops: 0, swaps: 0, byW: {}, maxCombo: 0, events: 0, allies: 0, rivals: 0, fusions: 0 });
/** Nombre legible del origen del daño (gráfica de daño por técnica) */
const SRC_NAMES = { otros: 'Otros (ondas, explosiones)', ally: 'Compañeros', mines: 'Minas de Energía', transform: 'Transformación' };
const srcName = (id) => (WEAPONS[id] ? WEAPONS[id].icon + ' ' + WEAPONS[id].name : SRC_NAMES[id] || id);
const fmtK = (v) => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e4 ? Math.round(v / 1e3) + 'k' : String(Math.round(v));
/** Precio base (Zeni) de los objetos del vendedor según su rareza */
const SHOP_PRICE = [40, 90, 200, 420, 850, 1700];

class Game {
  constructor(sheets) {
    this.ui = new UIManager();
    this.state = 'menu';
    this.time = 0; this.kills = 0; this.spawnAcc = 0; this.zeniRun = 0; this.pendingLevels = 0;
    this.bossUid = 0; this.nextBoss = 180; this.leashT = 0; this.hitstop = 0; this.shakeAmt = 0;
    this.cash = 0; this.capsOpened = 0; this.diff = DIFFS[0]; this.won = false;
    // Estructura de la partida: mapas (STAGES), enjambre final, maldiciones y desafíos
    this.run = newRun(); this.stageIdx = 0; this.stage = STAGES[0]; this.stageTime = 0; this.swarm = false; this.waveT = 60;
    this.curseHp = 0; this.curseDmg = 0; this.chal = 0; this.coinMul = 1; this.zoneBusy = null; this.bossDead = false; this.bossSpawned = false;
    this.boss = { t1: 3, t2: 6, next: 0 }; this.victoryT = 0; this.transT = 0; this.transDone = false; this.showMap = false; this.tradeO = null;
    // Combos, impact frames, eventos aleatorios, modo práctica y logros
    this.combo = 0; this.comboT = 0; this.impT = 0; this.impCd = 0; this.eventT = 120; this.storm = 0; this.rivalUid = 0;
    this.practice = false; this.achT = 1; this.smashT = 0; this.lakeMsg = false;
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
    this.cine = new TransformScene(this);                // cinemática de transformación
    this.touch = new TouchControls(this);                // controles táctiles (solo en móvil)
    this.bindEvents();
    this.clock = new THREE.Clock();
    this.loop = this.loop.bind(this);
    this.toMenu();
    requestAnimationFrame(this.loop);
  }

  initGL(sheets) {
    const canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_TOUCH ? 1.5 : 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 420);
    this.camLook = new THREE.Vector3(0, 0, 0);

    initShared();
    const tex = makeTextures();
    this.tex = tex;
    CFG.ARENA = STAGES[0].R;
    this.world = new World(this.scene, STAGES[0].theme);
    this.shadows = new SpriteBatch(this.scene, { max: CFG.MAX_ENEMIES + 2, texture: tex.shadow, w: 1, h: 0.5, anchor: 0.5, flat: true, blend: true, tint: 0x000000, alpha: 0.38, cut: 0.02, renderOrder: 1 });
    this.fx = new FX(this.scene, tex);
    this.player = new Player(this.scene, sheets, tex);
    this.horde = new HordeManager(this.scene, CFG.MAX_ENEMIES, sheets.shade);
    this.ki = new KiPool(this.scene, CFG.MAX_BULLETS, tex);
    this.orbs = new XpOrbs(this.scene, CFG.MAX_ORBS, tex);
    this.pickups = new Pickups(this.scene, tex);
    this.capsules = new Capsules(this.scene, tex);
    this.weapons = new WeaponSystem(this.scene, tex);
    this.points = new Points(this.scene, tex);          // santuarios, comerciantes, altar y grieta
    this.shots = new EnemyShots(this.scene, tex);       // disparos de los jefes
    this.allies = new Allies(this.scene, sheets);       // compañeros temporales
    // Al romper un cristal: orbes de experiencia, chispas y a veces una semilla
    this.onCrystalBreak = (x, z) => {
      this.orbs.spawn(x, z, 4); this.gainZeni(2); this.gainCash(8);
      this.fx.burst(this.fx.sparks, x, 1.2, z, 16, 7, 0.5, 0.35, 8, 0x9fe0ff);
      if (Math.random() < 0.3) this.pickups.drop(x, z);
    };
    this.world.onBreak = this.onCrystalBreak;
  }

  /* ---------- Entradas, ratón y botones ---------- */
  bindEvents() {
    const ui = this.ui, cv = this.renderer.domElement;
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight, false);
      this.applyView();
      if (this.cine.on) this.cine.resize();
      // En el móvil, si lo pones en vertical se pausa la partida
      if (IS_TOUCH && window.innerHeight > window.innerWidth && this.state === 'play') this.togglePause();
    });
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.state = 'pause'; ui.fatal('Se perdió el contexto WebGL (la GPU se reinició). Recarga la página.'); });
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (this.ui.el.modal.classList.contains('show') || this.ui.el.exit.classList.contains('show')) return;
      const s = this.state;
      if (s === 'menu' && e.code === 'Enter') this.start(false);
      else if (s === 'over' && (e.code === 'Enter' || e.code === 'KeyR')) this.start(this.practice);
      else if (s === 'play' && this.practice && e.code === 'KeyL') this.practiceLevel();
      else if (s === 'play' && this.practice && e.code === 'KeyK') this.practiceClear();
      else if (s === 'play' && this.practice && e.code === 'KeyJ') { this.cash += 500; SFX.play('coin'); }
      else if (s === 'over' && (e.code === 'KeyM' || e.code === 'Escape')) this.toMenu();
      else if ((s === 'play' || s === 'pause') && (e.code === 'KeyP' || e.code === 'Escape')) this.togglePause();
      else if (s === 'play' && e.code === 'KeyE') this.interact();
      else if (s === 'play' && e.code === 'KeyG') this.transform();
      else if (s === 'trade' && (e.code === 'KeyE' || e.code === 'Escape')) this.closeTrade();
      else if (s === 'play' && e.code === 'KeyM') { this.showMap = !this.showMap; ui.el.bigmap.style.display = this.showMap ? 'block' : 'none'; }
      else if ((s === 'play' || s === 'pause') && e.code === 'Tab') { e.preventDefault(); this.togglePause(); }
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
      const t = e.target.closest('[data-go],[data-tab],[data-mtab],[data-ch],[data-buy],[data-equip],[data-lab],[data-item],[data-tech],[data-claim],[data-diff],[data-start],[data-exit]');
      if (!t) return;
      SFX.play('click');
      const D = t.dataset;
      if (D.go) this.go(D.go);
      else if (D.tab) { ui.tab = D.tab; ui.renderMenu(); }
      else if (D.mtab) { ui.mtab = D.mtab; ui.renderMenu(); }
      else if (D.ch) this.viewChar(D.ch);
      else if (D.buy) this.buyChar(D.buy);
      else if (D.equip) this.viewChar(D.equip, true);
      else if (D.lab) this.buyLab(D.lab);
      else if (D.item) this.buyItem(D.item);
      else if (D.tech) this.buyTech(D.tech);
      else if (D.claim) this.claimMission(D.claim);
      else if (D.diff) { Save.d.diff = D.diff; Save.write(); ui.renderMenu(); }
      else if (D.start !== undefined) this.start(D.start === 'practice');
      else if (D.exit !== undefined) ui.showExit(true);
    });
    ui.el.exit.addEventListener('click', () => ui.showExit(false));
    // Volumen (pantalla de opciones)
    ui.el.menu.addEventListener('input', (e) => {
      const v = e.target.dataset && e.target.dataset.vol;
      if (!v) return;
      const cur = Save.d.vol || { mus: 0.5, sfx: 0.75 }, val = +e.target.value / 100;
      SFX.setVol(v === 'mus' ? val : cur.mus, v === 'sfx' ? val : cur.sfx);
      if (v === 'sfx') SFX.play('coin');
      const lab = e.target.parentNode.querySelector('b'); if (lab) lab.textContent = e.target.value + '%';
    });
    // Overlay de comercio (Bulma / Maestro Roshi)
    ui.el.trade.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tbuy],[data-tswap],[data-tdel],[data-tclose]');
      if (!t) return;
      const D = t.dataset;
      if (D.tclose !== undefined) this.closeTrade();
      else if (D.tbuy !== undefined) this.tradeBuy(D.tbuy);
      else if (D.tswap) this.tradeSwap(D.tswap);
      else if (D.tdel) this.tradeDelete(D.tdel);
    });
    ui.el.modal.addEventListener('click', (e) => { if (e.target.closest('[data-login]')) this.claimLogin(); else if (e.target.closest('[data-close]')) ui.hideModal(); });
    ui.el.cardRow.addEventListener('click', (e) => { const c = e.target.closest('.card'); if (c) ui.pickCard(+c.dataset.i); });
    ui.el.scrA.onclick = () => { ui.el.scrA.blur(); if (this.state === 'pause') this.togglePause(); else this.start(this.practice); };
    ui.el.scrB.onclick = () => { ui.el.scrB.blur(); if (this.state === 'pause') this.abandon(); else this.toMenu(); };
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play') this.togglePause(); });
  }

  locked() { return document.pointerLockElement === this.renderer.domElement; }
  grabMouse() { if (IS_TOUCH) return; try { const r = this.renderer.domElement.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* sin pointer lock */ } }
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
    if (this.stageIdx !== 0) this.loadStage(0);                 // el menú siempre muestra el primer mapa
    this.points.reset(); this.shots.reset(); this.showMap = false; this.ui.el.bigmap.style.display = 'none'; this.ui.el.fade.style.opacity = 0; this.ui.hideTrade();
    this.horde.reset(); this.ki.reset(); this.orbs.reset(); this.fx.reset(); this.weapons.reset(charById(Save.d.sel));
    this.pickups.senzu.reset(); this.pickups.balls.reset(); this.capsules.n = 0; this.capsules.spr.reset(); this.capsules.glow.reset();
    this.ui.hideScreen(); this.ui.hideCards();
    this.previewPlayer();
    this.camYaw = 0.5; this.camPitch = 0.75; this.camDistT = 20; this.camDist = 20;
    this.camLook.set(0, 0, 0);
    this.ui.screen = 'home';
    this.allies.reset(); this.setStorm(0);
    SFX.music('menu');
    this.ui.showMenu(this);
    this.applyView();
    this.ui.showHud(false);
  }

  /* ---------- Partida ---------- */
  start(practice) {
    const ch = charById(Save.d.sel);
    if (!ch || ch.soon || !Save.d.unlocked.includes(ch.id)) return;
    this.player.reset(ch); this.weapons.reset(ch);
    this.diff = diffById(Save.d.diff); this.cash = 0; this.capsOpened = 0; this.won = false; this.camera.clearViewOffset();
    this.time = 0; this.kills = 0; this.spawnAcc = 0; this.zeniRun = 0; this.pendingLevels = 0; this.leashT = 0;
    this.hitstop = 0; this.shakeAmt = 0; this.ui.flash = 0;
    this.practice = !!practice; this.combo = 0; this.comboT = 0; this.impT = 0; this.impCd = 0; this.eventT = rand(90, 130); this.rivalUid = 0; this.achT = 1;
    this.allies.reset(); this.setStorm(0);
    this.run = newRun(); this.curseHp = 0; this.curseDmg = 0; this.chal = 0; this.coinMul = 1; this.showMap = false; this.ui.el.bigmap.style.display = 'none';
    this.ui.el.fade.style.opacity = 0; this.ui.hideTrade();
    if (IS_TOUCH) { goFullscreen(); this.camDistT = 22; }
    this.loadStage(0);
    this.applyForm();
    for (let i = 0; i < 14; i++) this.spawnEnemy();
    this.horde.buildGrid();
    this.camYaw = 0; this.camPitch = 0.6; this.camDist = this.camDistT = 19;
    this.camLook.set(0, 1.4, 0);
    this.grabMouse();
    this.syncSprites();
    this.ui.hideMenu(); this.ui.hideScreen(); this.ui.hideCards(); this.ui.showHud(true);
    this.ui.wKey = ''; this.ui.lastBiome = -1;
    if (ch.portrait) this.ui.drawFrame(this.ui.el.portrait, ch.portrait.sheet, ch.portrait.frame, ch.portrait.tint);
    this.state = 'play';
    this.clock.getDelta();
    this.ui.toast(this.practice ? 'ENTRENAMIENTO' : ch.name);
    if (this.practice) this.ui.toast('L: subir de nivel · K: limpiar la horda · J: +500 Zeni', true);
    SFX.music('battle');
  }

  /** Carga un mapa de la partida: mundo (tema y tamaño), puntos de interés, cápsulas y enemigos limpios */
  loadStage(idx) {
    const S = STAGES[idx];
    this.stageIdx = idx; this.stage = S; this.stageTime = 0; this.waveT = 60; this.swarm = false;
    this.bossUid = 0; this.bossDead = false; this.bossSpawned = false; this.victoryT = 0; this.zoneBusy = null;
    this.boss = { t1: 3, t2: 6, next: 0 };
    CFG.ARENA = S.R;
    if (this.world.th !== THEMES[S.theme] || this.world.R !== S.R) {
      this.world.dispose(this.scene);
      this.world = new World(this.scene, S.theme);
      this.world.onBreak = this.onCrystalBreak;
    } else this.world.reset();
    this.horde.reset(); this.ki.reset(); this.orbs.reset(); this.fx.reset(); this.shots.reset();
    this.pickups.reset(this.world); this.capsules.reset(this.world, S.final ? 0 : 28); this.points.reset();
    if (S.pois) this.points.populate(this.world, S);
    if (S.final) { this.pickups.got.fill(1); this.pickups.sn = 0; }
    // Aspecto de la horda y del jefe de este mapa
    this.horde.tints = ENEMY_TYPES.map((t) => t.tint);
    this.horde.tints[0] = [0xffffff, 0xb8ffa0, 0xffa8d8][idx];
    const B = S.boss, T = ENEMY_TYPES[3];
    T.name = B.name; T.tint = B.tint; T.scale = B.scale; T.r = B.r; this.horde.tints[3] = B.tint;
    this.ui.el.bossName.textContent = B.name;
    const p = this.player;
    p.x = 0; p.z = 0; p.vx = 0; p.vz = 0; p.kbx = 0; p.kbz = 0; this.camLook.set(0, 1.4, 0);
    // Efecto de cada mapa: el agua de Namek cura; en la dimensión fracturada la gravedad es baja (dash más largo)
    p.dashBoost = idx === 2 ? 1.4 : 1;
    this.lakeMsg = false;
    if (idx === 1) this.ui.toast('EL AGUA DE NAMEK CURA', true);
    if (idx === 2) this.ui.toast('GRAVEDAD BAJA: DASH MÁS LARGO', true);
    this.horde.buildGrid();
  }
  /** Pasa a la siguiente fase por la grieta: se conservan nivel, armas y objetos */
  nextStage() {
    const p = this.player;
    this.zeniRun += 150 * (this.stageIdx + 1);
    this.track('stages', 1);
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.35); p.ki = p.maxKi;
    this.loadStage(this.stageIdx + 1);
    this.syncSprites();
    this.ui.toast(this.stage.name);
    if (this.stage.final) this.ui.toast('EL ÚLTIMO COMBATE', true);
  }
  enterRift() {
    if (this.state !== 'play') return;
    this.state = 'transition'; this.transT = 0; this.transDone = false; SFX.play('rift');
    this.ui.el.fade.style.opacity = 1;
    const r = this.points.rift;
    this.fx.ring(this.fx.aura, r.x, 0.5, r.z, 50, 20, 0.7, 0.4, 0xd070ff);
  }

  /* ---------- Interacciones con E ---------- */
  interact() {
    const pts = this.points, c = this.capsules;
    if (pts.rift && pts.rift.near) { this.enterRift(); return; }
    if (c.near >= 0) { this.tryOpenCapsule(); return; }
    if (pts.near >= 0) this.usePoi(pts.list[pts.near]);
  }
  /** Texto del aviso inferior según lo que tengas cerca (null = nada) */
  promptInfo() {
    const pts = this.points, c = this.capsules;
    if (pts.rift && pts.rift.near) return { t: '[E] ENTRAR EN LA GRIETA', ok: true };
    if (c.near >= 0) {
      const k = c.gold[c.near], cost = this.capsuleCost(k);
      return { t: '[E] ABRIR CÁPSULA' + (k === 1 ? ' DORADA' : k === 2 ? ' MALDITA ☠' : '') + ' · ' + cost + ' ZENI', ok: this.cash >= cost };
    }
    if (pts.near >= 0) {
      const o = pts.list[pts.near];
      if (o.type === 'boss') return { t: this.bossUid ? 'EL JEFE YA ESTÁ AQUÍ' : '[E] INVOCAR A ' + this.stage.boss.name, ok: !this.bossUid };
      if (o.type === 'temple') return { t: '[E] ACEPTAR EL DESAFÍO · ENEMIGOS MÁS FUERTES, MÁS RECOMPENSA', ok: true };
      if (o.type === 'merchant') return { t: '[E] HABLAR CON BULMA', ok: true };
      if (o.type === 'swapper') return { t: '[E] HABLAR CON EL MAESTRO ROSHI', ok: true };
    }
    return null;
  }
  usePoi(o) {
    const ui = this.ui;
    if (o.type === 'boss') {
      if (this.bossUid || o.used) return;
      o.used = true;
      const a = rand(0, 6.28);
      this.spawnBoss(o.x + Math.cos(a) * 12, o.z + Math.sin(a) * 12);
    } else if (o.type === 'temple') {
      if (o.used) return;
      o.used = true; this.chal++; this.run.temples++; this.track('temples', 1);
      this.coinMul = 1 + 0.2 * this.chal;
      for (let i = 0; i < 2; i++) this.capsules.add(o.x + rand(-6, 6), o.z + rand(-6, 6), 1, this.world);
      this.fx.ring(this.fx.aura, o.x, 0.5, o.z, 60, 22, 0.8, 0.5, 0x5be07a);
      this.horde.shockwave(o.x, o.z, 16, 20);
      ui.toast('DESAFÍO ' + this.chal); ui.toast('Enemigos +25% vida · +15% daño · +20% Zeni', true);
      this.shake(0.7);
    } else if (o.type === 'merchant' || o.type === 'swapper') this.openTrade(o);
  }
  /** Habitación del Espíritu y el Tiempo completada: eliges 1 de 3 bendiciones */
  onTimeRoomDone(o) {
    this.run.rooms++; this.track('rooms', 1);
    this.fx.ring(this.fx.aura, o.x, 0.5, o.z, 60, 22, 0.8, 0.5, 0x6fd0ff);
    this.state = 'wish'; this.releaseMouse();
    const pool = SHRINE_BUFFS.slice(), ids = [];
    while (ids.length < 3) ids.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
    this.ui.showCards('ESPÍRITU Y TIEMPO', 'ELIGE UNA BENDICIÓN [1 · 2 · 3]', ids.map((id) => ({ type: 'stat', id, icon: BUFFS[id].icon, tag: 'BENDICIÓN', title: BUFFS[id].name, text: BUFFS[id].text, max: 0, lv: 0 })), (c) => {
      this.player.buffs.push(c.id); this.player.recompute();
      this.ui.hideCards();
      if (this.pendingLevels > 0) this.openLevelUp(); else this.resume();
    });
  }

  /* ---------- Bulma (vende) y Maestro Roshi (cambia / elimina objetos) ---------- */
  shopPrice(it) { return Math.round(SHOP_PRICE[it.rarity] * (1 + 0.06 * this.run.shops)); }
  openTrade(o) {
    if (o.type === 'merchant' && !o.stock) { o.stock = []; for (let i = 0; i < 3; i++) o.stock.push({ it: this.rollItem(false), sold: false }); o.heal = false; }
    this.tradeO = o; this.state = 'trade'; this.releaseMouse();
    this.renderTrade();
  }
  closeTrade() { this.ui.hideTrade(); this.tradeO = null; this.state = 'play'; this.grabMouse(); this.clock.getDelta(); }
  renderTrade() {
    const o = this.tradeO, p = this.player;
    if (!o) return;
    const cash = Math.floor(this.cash);
    let h = '';
    if (o.type === 'merchant') {
      h = '<small>BULMA · CAPSULE CORP</small><h2>TIENDA AMBULANTE</h2><p class="tz">ZENI <b>' + cash + '</b></p><div class="tl">';
      o.stock.forEach((s, i) => {
        const rar = RARITIES[s.it.rarity], price = this.shopPrice(s.it);
        h += '<div class="ti" style="border-color:' + rar.color + '"><span class="tic" style="color:' + rar.color + '">' + s.it.icon + '</span><div><small style="color:' + rar.color + '">' + rar.name + '</small><b>' + s.it.name + '</b><p>' + s.it.text + '</p></div><button data-tbuy="' + i + '"' + (s.sold || this.cash < price ? ' disabled' : '') + '>' + (s.sold ? 'VENDIDO' : price + ' ZENI') + '</button></div>';
      });
      const hp = Math.round(30 * (1 + 0.06 * this.run.shops));
      h += '<div class="ti"><span class="tic" style="color:#9cff6a">❖</span><div><small style="color:#9cff6a">CONSUMIBLE</small><b>Semilla Senzu</b><p>Recupera toda la vida.</p></div><button data-tbuy="h"' + (this.cash < hp ? ' disabled' : '') + '>' + hp + ' ZENI</button></div>';
    } else {
      h = '<small>MAESTRO ROSHI</small><h2>«CAMBIO O ME LIBRO DE ELLO»</h2><p class="tz">ZENI <b>' + cash + '</b></p><div class="tl">';
      const ids = Object.keys(p.items);
      if (!ids.length) h += '<p class="tz">Aún no tienes ningún objeto que cambiar.</p>';
      for (const id of ids) {
        const it = itemById(id), rar = RARITIES[it.rarity], cost = Math.round(30 * (it.rarity + 1) * (1 + 0.5 * o.rerolls));
        h += '<div class="ti" style="border-color:' + rar.color + '"><span class="tic" style="color:' + rar.color + '">' + it.icon + '</span><div><small style="color:' + rar.color + '">' + rar.name + ' · x' + p.items[id] + '</small><b>' + it.name + '</b><p>' + it.text + '</p></div>' +
          '<div class="tbtn"><button data-tswap="' + id + '"' + (this.cash < cost ? ' disabled' : '') + '>CAMBIAR · ' + cost + '</button><button class="alt" data-tdel="' + id + '">ELIMINAR</button></div></div>';
      }
    }
    h += '</div><button class="tclose" data-tclose>CERRAR [E]</button>';
    this.ui.showTrade(h);
  }
  tradeBuy(k) {
    const o = this.tradeO, p = this.player;
    if (!o || o.type !== 'merchant') return;
    if (k === 'h') {
      const hp = Math.round(30 * (1 + 0.06 * this.run.shops));
      if (this.cash < hp) return;
      this.cash -= hp; this.run.shops++; p.hp = p.maxHp; this.ui.toast('VIDA RESTAURADA', true);
    } else {
      const s = o.stock[+k];
      if (!s || s.sold) return;
      const price = this.shopPrice(s.it);
      if (this.cash < price) return;
      this.cash -= price; this.run.shops++; s.sold = true;
      s.it.apply(p); p.items[s.it.id] = (p.items[s.it.id] || 0) + 1;
      this.ui.itemPopup(s.it, RARITIES[s.it.rarity]);
    }
    this.renderTrade();
  }
  tradeSwap(id) {
    const o = this.tradeO, p = this.player, it = itemById(id);
    if (!o || !it || !p.items[id]) return;
    const cost = Math.round(30 * (it.rarity + 1) * (1 + 0.5 * o.rerolls));
    if (this.cash < cost) return;
    const pool = ITEMS.filter((x) => x.rarity === it.rarity && x.id !== id && itemAvailable(x));
    if (!pool.length) { this.ui.toast('NO HAY OTRO OBJETO DE ESA RAREZA', true); return; }
    this.cash -= cost; o.rerolls++; this.run.swaps++;
    const n = pick(pool);
    p.items[id]--; if (!p.items[id]) delete p.items[id];
    p.items[n.id] = (p.items[n.id] || 0) + 1;
    p.recompute();
    this.ui.itemPopup(n, RARITIES[n.rarity]);
    this.renderTrade();
  }
  tradeDelete(id) {
    const p = this.player, it = itemById(id);
    if (!it || !p.items[id]) return;
    p.items[id]--; if (!p.items[id]) delete p.items[id];
    p.recompute();
    this.cash += 10 * (it.rarity + 1);
    this.ui.toast('OBJETO ELIMINADO · +' + 10 * (it.rarity + 1) + ' ZENI', true);
    this.renderTrade();
  }

  /* ---------- Estadísticas del personaje y de la partida (pausa / TAB) ---------- */
  statsHtml() {
    const p = this.player, r = this.run, pc = (v) => Math.round(v * 100) + '%', row = (a, b) => '<div><span>' + a + '</span><b>' + b + '</b></div>';
    let h = '<h4 class="sh">PERSONAJE</h4><div class="sum">' + [
      ['NIVEL', p.level], ['VIDA', Math.max(0, Math.ceil(p.hp)) + ' / ' + Math.ceil(p.maxHp)], ['REGENERACIÓN', p.regen.toFixed(1) + '/s'], ['ARMADURA', pc(p.armor)],
      ['ESQUIVA', pc(p.dodge)], ['VIDA POR BAJA', p.killHeal.toFixed(1)], ['DAÑO', 'x' + p.damageMul().toFixed(2)], ['CADENCIA', 'x' + p.rateMul.toFixed(2)],
      ['CRÍTICO', pc(p.crit)], ['DAÑO CRÍTICO', 'x' + p.critDmg.toFixed(2)], ['VELOCIDAD', pc(p.speedMul)], ['DASH', 'x' + p.dashMul.toFixed(2)],
      ['KI MÁXIMO', Math.round(p.maxKi)], ['REGEN. KI', p.kiRegen.toFixed(1) + '/s'], ['IMÁN', p.magnet.toFixed(1)], ['SUERTE', p.luck],
      ['EXPERIENCIA', 'x' + p.xpMul.toFixed(2)], ['ZENI', 'x' + (p.zeniMul * this.coinMul).toFixed(2)]].map((x) => row(x[0], x[1])).join('') + '</div>';
    h += '<h4 class="sh">PARTIDA</h4><div class="sum">' + [
      ['MAPA', (this.stageIdx + 1) + ' / ' + STAGES.length], ['TIEMPO EN EL MAPA', fmtTime(this.stageTime)], ['ENEMIGOS', this.kills], ['DAÑO TOTAL', Math.floor(r.damage)],
      ['GOLPE MÁS FUERTE', Math.floor(r.best)], ['DAÑO RECIBIDO', Math.floor(r.taken)], ['DASHES', r.dashes], ['CÁPSULAS', this.capsOpened],
      ['MALDICIONES', r.curses], ['DESAFÍOS', r.temples + ' (nv ' + this.chal + ')'], ['HABITACIONES DEL TIEMPO', r.rooms], ['ZENI', Math.floor(this.cash)], ['COMBO MÁXIMO', r.maxCombo], ['EVENTOS', r.events]].map((x) => row(x[0], x[1])).join('') + '</div>' + this.dmgChart();
    const items = Object.keys(p.items).map((id) => { const it = itemById(id), c = RARITIES[it.rarity].color; return '<span style="border-color:' + c + ';color:' + c + '" title="' + it.text + '">' + it.icon + ' ' + it.name + (p.items[id] > 1 ? ' x' + p.items[id] : '') + '</span>'; });
    const bf = p.buffs.map((id) => '<span class="bf' + (id[0] === 'c' ? ' cu' : '') + '" title="' + BUFFS[id].text + '">' + BUFFS[id].icon + ' ' + BUFFS[id].name + '</span>');
    if (items.length || bf.length) h += '<h4 class="sh">OBJETOS Y BENDICIONES</h4><div class="chips">' + items.concat(bf).join('') + '</div>';
    return h;
  }

  /** Gráfica de barras: daño por técnica (las 6 que más daño han hecho) */
  dmgChart() {
    const by = this.run.byW, ids = Object.keys(by).filter((k) => by[k] > 0).sort((a, b) => by[b] - by[a]).slice(0, 6);
    if (!ids.length) return '';
    const tot = Object.keys(by).reduce((a, k) => a + by[k], 0) || 1, top = by[ids[0]];
    return '<h4 class="sh">DAÑO POR TÉCNICA</h4><div class="dchart">' + ids.map((id) => {
      const W = WEAPONS[id], col = W && W.color ? '#' + W.color.toString(16).padStart(6, '0') : id === 'ally' ? '#7fe07a' : '#ffb020';
      return '<div class="dr"><span>' + srcName(id) + '</span><div class="dbar"><i style="width:' + (by[id] / top * 100).toFixed(1) + '%;background:' + col + '"></i></div><b>' + fmtK(by[id]) + ' · ' + Math.round(by[id] / tot * 100) + '%</b></div>';
    }).join('') + '</div>';
  }

  /* ---------- Combos ---------- */
  addCombo() {
    this.combo++; this.comboT = 3;
    if (this.combo > this.run.maxCombo) this.run.maxCombo = this.combo;
    this.player.comboMul = 1 + Math.min(this.combo, 100) * 0.0025;          // hasta +25% de daño
    if (this.combo % 50 === 0) {
      const bonus = Math.round(this.combo / 2);
      this.cash += bonus; SFX.play('combo');
      this.ui.toast('¡COMBO x' + this.combo + '! +' + bonus + ' ZENI', true);
    }
  }
  onPlayerHit() {
    if (this.combo >= 10) this.ui.toast('COMBO ROTO', true);
    this.combo = 0; this.comboT = 0; this.player.comboMul = 1;
  }
  /** Impact frame en los críticos grandes (con enfriamiento para no saturar) */
  onCrit(dmg) {
    if (this.impCd > 0 || this.state !== 'play' || dmg < 30 * this.player.damageMul()) return;
    this.impCd = 2.5; this.impT = 0.14;
    this.hitstop = Math.max(this.hitstop, 0.07); this.shake(0.5);
    SFX.play('crit');
    this.ui.toast('¡CRÍTICO! ' + fmtK(dmg), true);
  }

  /* ---------- Eventos aleatorios ---------- */
  setStorm(t) {
    this.storm = t;
    this.player.slow = t > 0 ? 0.8 : 1;
    if (this.ui.el.storm) this.ui.el.storm.classList.toggle('on', t > 0);
  }
  startEvent(k) {
    const p = this.player, ui = this.ui;
    this.run.events++; this.track('events', 1); SFX.play('event');
    if (k === 'senzu') {
      for (let i = 0; i < 12; i++) { const a = rand(0, 6.28), r = rand(6, 18); this.pickups.drop(clamp(p.x + Math.cos(a) * r, -CFG.ARENA, CFG.ARENA), clamp(p.z + Math.sin(a) * r, -CFG.ARENA, CFG.ARENA)); }
      ui.toast('¡LLUVIA DE SENZUS!'); ui.toast('Recoge las semillas para curarte', true);
    } else if (k === 'rival') {
      this.spawnPos(20, 26);
      const i = this.horde.spawn(this._sx, this._sz, (14 + this.pressure() * 0.25) * ENEMY_TYPES[4].hp * this.diff.hp * this.stage.hp * 6, 4);
      if (i >= 0) this.rivalUid = this.horde.uid[i];
      ui.toast('¡UN RIVAL TE RETA!'); ui.toast('Derrótalo: suelta una cápsula dorada', true);
    } else if (k === 'storm') {
      this.setStorm(25);
      ui.toast('¡TORMENTA DE KI!'); ui.toast('Todo se ralentiza durante 25 segundos', true);
    } else {
      const a = this.allies.summon(this);
      if (!a) { this.startEvent('senzu'); return; }
      this.run.allies++; this.track('allies', 1);
      ui.toast('¡' + a.d.name + ' AL RESCATE!'); ui.toast('Lucha a tu lado durante 60 segundos', true);
    }
  }

  /* ---------- Logros: se comprueban cada segundo ---------- */
  checkAch() {
    if (this.practice) return;
    const st = Save.d.stats, r = this.run, live = { maxCombo: r.maxCombo, bestHit: r.best, maxStage: this.stageIdx + 1 };
    for (const a of ACHIEVEMENTS) {
      if (Save.d.ach[a.id]) continue;
      const v = Math.max(st[a.stat] || 0, live[a.stat] || 0);
      if (v < a.goal) continue;
      Save.d.ach[a.id] = true; Save.d.zeni += a.reward; Save.write();
      SFX.play('achieve');
      this.ui.itemPopup({ icon: a.icon, name: a.name, text: a.desc + ' · +' + a.reward + ' monedas' }, { name: 'LOGRO DESBLOQUEADO', color: '#ffd84a' });
    }
  }

  /* ---------- Modo práctica ---------- */
  practiceLevel() { const p = this.player; this.addXp(p.xpNext - p.xp + 0.01); }
  practiceClear() { const h = this.horde; for (let i = 0; i < h.n; i++) if (h.type[i] !== 3) h.hp[i] = 0; this.shake(0.6); }

  togglePause() {
    if (this.state === 'play') {
      this.releaseMouse();
      this.state = 'pause';
      this.ui.showScreen('PAUSA', this.stage.name, this.statsHtml(), 'CONTINUAR [P]', 'ABANDONAR PARTIDA', 'pause wide');
    } else if (this.state === 'pause') { this.state = 'play'; this.ui.hideScreen(); this.grabMouse(); this.clock.getDelta(); }
  }

  /** Cierra la partida: monedas, récord, estadísticas y misiones. Devuelve {coins, bonus} */
  finishRun(win) {
    const p = this.player, id = p.ch.id, d = this.diff;
    if (this.practice) return { coins: 0, bonus: 0 };              // el entrenamiento no da recompensas
    let coins = Math.floor(this.zeniRun * d.coins), bonus = 0;
    if (win) {                                    // primera victoria con ese personaje y dificultad = premio completo; después, un 20%
      const key = id + ':' + d.id, first = !Save.d.clears[key];
      bonus = first ? d.reward : Math.round(d.reward * 0.2);
      Save.d.clears[key] = (Save.d.clears[key] || 0) + 1;
      this.track('wins', 1);
    }
    coins += bonus;
    Save.d.zeni += coins;
    this.track('runs', 1); this.track('time', Math.floor(this.time)); this.trackMax('maxLevel', p.level); this.trackMax('maxStage', this.stageIdx + 1);
    this.track('damage', Math.floor(this.run.damage)); this.track('taken', Math.floor(this.run.taken)); this.track('dashes', this.run.dashes); this.trackMax('maxCombo', this.run.maxCombo); this.trackMax('bestHit', Math.floor(this.run.best));
    this.checkAch();
    const b = Save.d.best[id];
    if (!b || this.time > b.time) Save.d.best[id] = { time: Math.floor(this.time), kills: this.kills, level: p.level };
    Save.write();
    return { coins, bonus };
  }
  abandon() { this.finishRun(false); this.toMenu(); }

  runSummary(r) {
    const rows = [['ENEMIGOS DERROTADOS', this.kills], ['NIVEL ALCANZADO', this.player.level], ['TIEMPO', fmtTime(this.time)],
      ['CÁPSULAS ABIERTAS', this.capsOpened], ['MAPA ALCANZADO', (this.stageIdx + 1) + ' / ' + STAGES.length], ['DAÑO TOTAL', Math.floor(this.run.damage)],
      ['GOLPE MÁS FUERTE', Math.floor(this.run.best)], ['DAÑO RECIBIDO', Math.floor(this.run.taken)], ['DASHES', this.run.dashes], ['DIFICULTAD', this.diff.name]];
    let h = '<div class="sum">' + rows.map((x) => '<div><span>' + x[0] + '</span><b>' + x[1] + '</b></div>').join('') + '</div>';
    h += this.dmgChart();
    if (this.practice) return h + '<div class="reward">ENTRENAMIENTO<small>El modo práctica no da monedas ni cuenta para misiones y logros</small></div>';
    h += '<div class="reward">+' + r.coins + ' MONEDAS' + (r.bonus ? '<small>incluye ' + r.bonus + ' de bonificación por completar el nivel</small>' : '') + '</div>';
    return h;
  }
  gameOver() {
    this.state = 'over'; this.releaseMouse(); SFX.music(''); SFX.play('lose');
    this.ui.showScreen('DERROTA', 'HAS CAÍDO EN COMBATE', this.runSummary(this.finishRun(false)), 'REINTENTAR [R]', 'MENÚ [M]', 'lose');
  }
  victory() {
    this.won = true; this.state = 'over'; this.releaseMouse(); SFX.music(''); SFX.play('win');
    this.fx.ring(this.fx.aura, this.player.x, 0.5, this.player.z, 70, 24, 0.9, 0.5, 0xffd24a);
    this.ui.showScreen('¡VICTORIA!', 'HAS DERROTADO A ' + this.stage.boss.name + ' · ' + this.diff.name, this.runSummary(this.finishRun(true)), 'JUGAR OTRA VEZ [R]', 'MENÚ [M]', 'win');
  }

  /* ---------- Formas y efectos ---------- */
  applyForm() {
    const p = this.player;
    this.fx.aura.setColor(p.form.aura || 0xfff2b0);
    this.fx.sparks.setColor(p.form.ki);
  }
  /** Al subir de nivel: si llegas al nivel de la siguiente forma, la transformación queda DISPONIBLE (tú decides cuándo) */
  checkTransformation() {
    const p = this.player, next = p.ch.forms[p.formIdx + 1];
    const ready = next && p.level >= next.lvl ? p.formIdx + 1 : -1;
    if (ready >= 0 && p.formReady !== ready) { this.ui.toast('¡' + next.name + ' DISPONIBLE!  [G]', true); }
    p.formReady = ready;
  }
  /** G / botón: lanza la cinemática de la siguiente forma */
  transform() {
    const p = this.player;
    if (this.state !== 'play' || p.formReady < 0 || this.cine.on) return;
    const idx = p.formReady;
    p.formReady = -1;
    this.state = 'transform';
    this.cine.start(idx);
  }

  gainZeni(v) { this.zeniRun += v * this.player.zeniMul * this.coinMul; }

  /* ---------- Cápsulas y objetos ---------- */
  /** Sortea rareza (la suerte y el tiempo suben las altas; la cápsula dorada mejora las probabilidades) y un objeto disponible */
  rollItem(gold) {
    const p = this.player, w = gold === 2 ? [0, 14, 30, 30, 19, 7] : gold ? [0, 30, 35, 22, 10, 3] : [60, 26, 9, 3.5, 1.2, 0.3], boost = (1 + p.luck * 0.1) * Math.min(2, 1 + this.time / 900);
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
  /** Maldición de una cápsula maldita: enemigos más fuertes, pérdida de stats o de un objeto */
  applyCurse() {
    const p = this.player, opts = ['enemies', 'stats'];
    if (Object.keys(p.items).length) opts.push('item');
    this.run.curses++; this.track('curses', 1);
    const k = pick(opts);
    let msg;
    if (k === 'enemies') { this.curseHp += 0.2; this.curseDmg += 0.12; msg = 'Los enemigos son más fuertes (+20% vida, +12% daño)'; }
    else if (k === 'stats') { const id = pick(CURSE_BUFFS); p.buffs.push(id); p.recompute(); msg = BUFFS[id].name + ': ' + BUFFS[id].text; }
    else {
      const id = pick(Object.keys(p.items)), it = itemById(id);
      p.items[id]--; if (!p.items[id]) delete p.items[id];
      p.recompute(); msg = 'Pierdes: ' + it.name;
    }
    this.ui.toast('☠ MALDICIÓN'); this.ui.toast(msg, true); SFX.play('curse');
    this.fx.ring(this.fx.aura, p.x, 0.5, p.z, 40, 14, 0.7, 0.4, 0xb040ff);
  }
  openCapsule(gold, x, z) {
    if (gold === 2) this.applyCurse();
    const it = this.rollItem(gold), p = this.player, rar = RARITIES[it.rarity], col = parseInt(rar.color.slice(1), 16);
    it.apply(p);
    p.items[it.id] = (p.items[it.id] || 0) + 1;
    this.fx.burst(this.fx.sparks, x, 1, z, 20 + it.rarity * 8, 8, 0.6, 0.4, 5, col);
    this.fx.ring(this.fx.aura, x, 0.5, z, 30 + it.rarity * 8, 10 + it.rarity * 2, 0.6, 0.4, col);
    this.shake(0.2 + it.rarity * 0.12);
    if (it.rarity >= 4) { this.hitstop = 0.12; this.fx.ring(this.fx.aura, p.x, 0.5, p.z, 60, 22, 0.8, 0.45, col); }
    this.ui.itemPopup(it, rar); SFX.play('capsule', it.rarity);
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
    if (this.practice) return;
    const s = Save.d.stats; s[stat] = (s[stat] || 0) + n;
    const p = Save.d.daily.prog; p[stat] = (p[stat] || 0) + n;
  }
  trackMax(stat, v) {
    if (this.practice) return;
    const s = Save.d.stats, p = Save.d.daily.prog;
    if (v > (s[stat] || 0)) s[stat] = v;
    if (v > (p[stat] || 0)) p[stat] = v;
  }
  gainCash(v) { this.cash += v * this.player.zeniMul * this.coinMul * (1 + Math.min(this.combo, 100) * 0.005); }   // la racha de combo da hasta +50% de Zeni
  capsuleCost(gold) { return Math.round(20 * Math.pow(1.22, this.capsOpened) * (gold === 2 ? 0.4 : gold ? 1.6 : 1)); }
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
  pressure() { return this.stageTime + this.stageIdx * 240; }
  swarmLvl() { return this.swarm ? 1 + (this.stageTime - SWARM_TIME) / 60 : 0; }          // minutos de enjambre (0 = aún no)
  enemyDamage() { return (7 + this.pressure() * 0.03) * this.diff.dmg * this.stage.dmg * (1 + this.curseDmg + this.chal * 0.15) * (1 + Math.max(0, this.swarmLvl() - 1) * 0.15); }

  /** Explosión de área reutilizable (minas, meteoros, Big Bang) */
  explode(x, z, r, dmg, tint) {
    SFX.play('boom');
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
    const r = Math.random(), t0 = this.pressure(), sw = this.swarmLvl();
    let t;
    if (sw > 0) t = r < 0.04 + sw * 0.015 ? 4 : r < 0.25 + sw * 0.04 ? 2 : r < 0.55 ? 1 : 0;          // el enjambre trae más élites y brutos
    else t = t0 > 45 && r < 0.02 + t0 / 14000 ? 4 : t0 > 90 && r < 0.14 ? 2 : t0 > 35 && r < 0.37 ? 1 : 0;
    this.spawnPos(32, 40);
    const hpMul = this.diff.hp * this.stage.hp * (1 + this.curseHp + this.chal * 0.25) * (1 + sw * 0.3);
    this.horde.spawn(this._sx, this._sz, (14 + t0 * 0.25) * ENEMY_TYPES[t].hp * hpMul, t);
  }
  /** Invoca al jefe del mapa (en el altar, o en un punto fijo en el mapa final) */
  spawnBoss(x, z) {
    const B = this.stage.boss;
    if (x === undefined) { this.spawnPos(26, 30); x = this._sx; z = this._sz; }
    x = clamp(x, -CFG.ARENA, CFG.ARENA); z = clamp(z, -CFG.ARENA, CFG.ARENA);
    const i = this.horde.spawn(x, z, B.hp * this.diff.hp * (1 + this.curseHp * 0.5 + this.chal * 0.15), 3);
    if (i >= 0) {
      this.bossUid = this.horde.uid[i]; this.bossSpawned = true; this.boss = { t1: 3, t2: 6, next: 0 };
      this.ui.toast('¡' + B.name + '!'); this.shake(0.8); SFX.play('boss'); SFX.music('boss');
      this.fx.ring(this.fx.aura, x, 0.5, z, 60, 24, 0.8, 0.5, B.tint);
    }
  }
  /** Ataques del jefe: abanico dirigido, anillo de disparos y refuerzos al perder vida */
  bossAI(dt) {
    const h = this.horde, i = h.indexOfUid(this.bossUid);
    if (i < 0) return;
    const b = this.boss, st = this.stageIdx, p = this.player, frac = h.hp[i] / h.maxHp[i], rage = frac < 0.5 ? 1 : 0;
    const bx = h.x[i], bz = h.z[i], dmg = this.enemyDamage() * 0.8;
    b.t1 -= dt; b.t2 -= dt;
    if (b.t1 <= 0) {                                              // abanico dirigido al jugador
      b.t1 = 2.6 - rage * 0.7 - st * 0.3;
      const a = Math.atan2(p.z - bz, p.x - bx), n = 3 + st * 2;
      for (let k = 0; k < n; k++) { const o = a + (k - (n - 1) / 2) * 0.2; this.shots.fire(bx, bz, Math.cos(o), Math.sin(o), 11 + st, dmg); }
    }
    if (b.t2 <= 0) {                                              // anillo de energía
      b.t2 = 7 - rage * 2 - st;
      this.shots.ring(bx, bz, 14 + st * 5, 8 + st, dmg, rand(0, 6.28));
      this.fx.ring(this.fx.aura, bx, 0.5, bz, 40, 14, 0.5, 0.4, this.stage.boss.tint);
    }
    const TH = [0.75, 0.5, 0.25];
    while (b.next < 3 && frac < TH[b.next]) {                      // refuerzos
      b.next++;
      this.ui.toast('¡REFUERZOS!', true);
      const n = 10 + st * 5;
      for (let k = 0; k < n; k++) { const a = (k / n) * 6.28; this.horde.spawn(clamp(bx + Math.cos(a) * 7, -CFG.ARENA, CFG.ARENA), clamp(bz + Math.sin(a) * 7, -CFG.ARENA, CFG.ARENA), (14 + this.pressure() * 0.25) * this.diff.hp * this.stage.hp, k % 4 === 0 ? 2 : 0); }
    }
  }

  onEnemyKilled(x, z, type, uid) {
    this.kills++; this.track('kills', 1);
    this.addCombo();
    if (uid && uid === this.rivalUid) {                              // rival del evento
      this.rivalUid = 0; this.run.rivals++; this.track('rivals', 1);
      this.capsules.add(x, z, 1, this.world); this.gainCash(80);
      this.ui.toast('¡RIVAL DERROTADO!'); SFX.play('achieve');
    }
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
      this.ui.toast('+' + Math.round(ENEMY_TYPES[4].cash * p.zeniMul) + ' ZENI · ÉLITE', true); SFX.play('coin');
      if (Math.random() < 0.3) this.capsules.add(x, z, false, this.world);
    } else if (type === 3) {
      this.track('bosses', 1);
      this.bossUid = 0; this.pendingLevels++; this.bossDead = true; this.shots.reset();
      this.capsules.add(x, z, true, this.world);
      for (let i = 0; i < 4; i++) this.pickups.drop(x + rand(-3, 3), z + rand(-3, 3));
      for (let i = 0; i < 12; i++) this.orbs.spawn(x, z, 5);
      this.fx.ring(this.fx.aura, x, 0.4, z, 50, 18, 0.7, 0.45, 0xffd24a);
      this.ui.toast('¡' + this.stage.boss.name + ' DERROTADO!'); this.shake(1); SFX.play('bigboom'); SFX.music('battle');
      if (this.stage.final) this.victoryT = 2.2;
      else { this.points.openRift(x, z); this.ui.toast('LA GRIETA SE ABRE · [E] PARA ENTRAR', true); }
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
        if (!W.get(id) && !D.fusion && (!u || u === p.ch.id) && (D.minLv || 0) <= p.level && (!D.shop || this.practice || (Save.d.techs || []).includes(id))) { pool.push({ t: 'weapon', id }); if (u) pool.push({ t: 'weapon', id }); }
      }
    }
    for (const s of STATS) if ((p.stacks[s.id] || 0) < s.max) pool.push({ t: 'stat', id: s.id });
    const out = [], seen = {};
    // Fusiones disponibles: las dos técnicas de origen al nivel máximo -> siempre sale como primera carta
    for (const id in WEAPONS) {
      const F = WEAPONS[id];
      if (!F.fusion || W.get(id) || (F.unique && F.unique !== p.ch.id)) continue;
      if (F.fusion.every((f) => W.levelOf(f) >= MAX_WEAPON_LEVEL) && out.length < 1) { out.push({ t: 'fusion', id }); seen['fusion' + id] = 1; }
    }
    for (let k = 0; k < 80 && out.length < 3 && pool.length; k++) {
      const c = pick(pool), key = c.t + c.id;
      if (seen[key]) continue;
      seen[key] = 1; out.push(c);
    }
    const cards = out.map((c) => {
      if (c.t === 'fusion') {
        const F = WEAPONS[c.id];
        return { type: 'fusion', id: c.id, icon: F.icon, tag: '⚭ FUSIÓN', title: F.name, text: F.lv[0] + ' (' + F.fusion.map((f) => WEAPONS[f].name).join(' + ') + ')', max: 0, lv: 0 };
      }
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
    this.state = 'levelup'; this.releaseMouse(); SFX.play('levelup');
    this.ui.showCards('¡NIVEL ' + this.player.level + '!', 'ELIGE UNA MEJORA [1 · 2 · 3]', this.rollCards(), (c) => {
      const p = this.player;
      SFX.play('select');
      if (c.type === 'weapon') this.weapons.add(c.id);
      else if (c.type === 'fusion') {
        this.weapons.fuse(c.id); this.run.fusions++; this.track('fusions', 1);
        this.ui.toast('¡FUSIÓN! ' + WEAPONS[c.id].name.toUpperCase()); SFX.play('stinger');
        this.fx.ring(this.fx.aura, p.x, 0.5, p.z, 70, 24, 0.8, 0.5, WEAPONS[c.id].color); this.impT = 0.14;
      }
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
      if (c.id === 'hp') { p.buffs.push('w_hp'); p.recompute(); p.hp = p.maxHp; }
      else if (c.id === 'dmg') { p.buffs.push('w_dmg'); p.recompute(); }
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
    this.time += dt; this.stageTime += dt;
    p.update(dt, this);
    this.weapons.update(dt, this);

    const S = this.stage, t0 = this.pressure();
    if (S.final) {                                                  // mapa final: solo el jefe (y sus refuerzos)
      if (!this.bossSpawned && this.stageTime > 2) this.spawnBoss(0, -22);
    } else {
      if (!this.swarm && !this.practice && this.stageTime >= SWARM_TIME) {            // a los 10 minutos llega el enjambre final
        this.swarm = true; this.ui.toast('¡ENJAMBRE FINAL!'); this.shake(1); SFX.play('alarm'); SFX.music('boss');
      }
      const sw = this.swarmLvl();
      this.spawnAcc += Math.min(4 + t0 * 0.09, 22) * S.spawn * (1 + sw * 0.7) * this.diff.spawn * (1 + this.chal * 0.2) * dt;
      while (this.spawnAcc >= 1) { this.spawnAcc -= 1; this.spawnEnemy(); }
      this.waveT -= dt;
      if (this.waveT <= 0 && !this.swarm) {                         // oleada normal cada minuto
        this.waveT = 60;
        this.ui.toast('¡OLEADA!', true);
        for (let k = 0, n = 12 + this.stageIdx * 6; k < n; k++) this.spawnEnemy();
      }
    }
    if (this.victoryT > 0) { this.victoryT -= dt; if (this.victoryT <= 0) { this.victory(); return; } }
    h.speed = (3.4 + Math.min(t0 * 0.01, 2.2) + Math.min(this.swarmLvl() * 0.12, 1)) * (this.storm > 0 ? 0.6 : 1);
    // Combo: se pierde si pasan 3 s sin derribar a nadie
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) { this.combo = 0; p.comboMul = 1; } }
    this.impCd -= dt;
    // Eventos aleatorios (no en el mapa final)
    if (!S.final) { this.eventT -= dt; if (this.eventT <= 0) { this.eventT = rand(100, 150); this.startEvent(pick(['senzu', 'rival', 'storm', 'ally'])); } }
    if (this.storm > 0) { this.storm -= dt; if (this.storm <= 0) { this.setStorm(0); this.ui.toast('LA TORMENTA AMAINA', true); } }
    // Namek: el agua de los lagos cura
    if (this.stageIdx === 1) {
      let wet = false;
      for (const l of this.world.lakes) { const dx = p.x - l.x, dz = p.z - l.z; if (dx * dx + dz * dz < (l.r + 2.5) * (l.r + 2.5)) { wet = true; break; } }
      if (wet) {
        p.hp = Math.min(p.maxHp, p.hp + 6 * dt);
        if (Math.random() < dt * 14) this.fx.aura.emit(p.x + rand(-1, 1), 0.2, p.z + rand(-1, 1), 0, rand(2, 4), 0, 0.5, 0.2, 0, 0x7fe8ff);
        if (!this.lakeMsg) { this.lakeMsg = true; this.ui.toast('EL AGUA DE NAMEK TE CURA', true); SFX.play('heal'); }
      }
    }
    // Brutos, élites y jefes rompen los cristales al pasar
    this.smashT -= dt;
    if (this.smashT <= 0) {
      this.smashT = 0.25;
      for (let i = 0; i < h.n; i++) if (ENEMY_TYPES[h.type[i]].smash) this.world.damageArea(h.x[i], h.z[i], ENEMY_TYPES[h.type[i]].r * 1.3, 80);
    }
    // Logros
    this.achT -= dt; if (this.achT <= 0) { this.achT = 1; this.checkAch(); }
    if (this.bossUid) this.bossAI(dt);

    const edt = dt * (p.charging ? CFG.CHARGE_TIME_SCALE : 1);      // cargar Ki ralentiza el mundo
    h.update(edt, p, this);
    this.ki.update(dt, this);
    h.reap(this);                                                   // se retiran DESPUÉS de las colisiones
    h.buildGrid();
    this.orbs.update(dt, p, this);
    this.pickups.update(dt, p, this);
    this.capsules.update(dt, p, this);
    this.zoneBusy = null;
    this.points.update(dt, p, this);
    this.shots.update(dt, this);
    this.allies.update(dt, this);
    this.world.follow(p.x, p.z);

    // Enemigos que se quedan muy lejos reaparecen cerca (el mapa es grande)
    this.leashT -= dt;
    if (this.leashT <= 0) {
      this.leashT = 0.5;
      for (let i = 0; i < h.n; i++) {
        const dx = h.x[i] - p.x, dz = h.z[i] - p.z;
        if (dx * dx + dz * dz > 6400 && h.type[i] !== 3 && !S.final) { this.spawnPos(32, 40); h.x[i] = this._sx; h.z[i] = this._sz; }
      }
    }

    if (p.hp <= 0) {
      if (p.canRevive) {                                           // Esfera de Reserva / deseo
        p.canRevive = false; p.reviveUsed = true; p.hp = p.maxHp * 0.5; p.iframes = 3;
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
    if (s !== 'play' && s !== 'transform' && this.impT > 0) { this.impT = 0; this.renderer.domElement.style.filter = ''; }
    if (s === 'play' && IS_TOUCH && window.innerHeight > window.innerWidth) this.togglePause();   // móvil en vertical: pausa
    if (s === 'play') {
      let dt = 0;
      if (this.hitstop > 0) this.hitstop -= rawDt; else dt = rawDt;
      if (dt > 0) this.update(dt);
      // Impact frame de crítico: negativo en B/N y luego destello de contraste
      if (this.impT > 0) {
        this.impT -= rawDt;
        this.renderer.domElement.style.filter = this.impT > 0.07 ? 'grayscale(1) contrast(9) invert(1)' : this.impT > 0 ? 'contrast(2.2) brightness(1.5) saturate(2)' : '';
      }
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
    } else if (s === 'transform') {                                   // cinemática: el mundo se congela, el personaje carga
      const done = this.cine.update(rawDt);
      const p = this.player;
      p.animT += rawDt; p.pose();
      this.fx.update(rawDt);
      this.syncSprites();
      this.updateCamera(rawDt, rawDt, false);
      this.ui.update(this, rawDt);
      if (done) { this.state = 'play'; this.checkTransformation(); this.clock.getDelta(); }
    } else if (s === 'transition') {                                  // viaje por la grieta con fundido a negro
      this.transT += rawDt;
      this.fx.update(rawDt); this.updateCamera(rawDt, rawDt, false);
      if (this.transT > 0.7 && !this.transDone) { this.transDone = true; this.nextStage(); this.ui.el.fade.style.opacity = 0; }
      if (this.transT > 1.4) { this.state = 'play'; this.clock.getDelta(); }
    } else if (s === 'menu') {
      this.player.animT += rawDt;
      this.player.pose();
      this.syncSprites();
      this.fx.update(rawDt);
      this.updateCamera(rawDt, rawDt, true);
    } else {                                                          // pausa, cartas, deseo, fin: mundo congelado
      this.updateCamera(0.0001, 0, false);
    }
    this.touch.update(this);
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
