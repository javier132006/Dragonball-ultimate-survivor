'use strict';
/* =====================================================================
   game.js · Clase Game: estados, bucle principal (delta time), cámara
   orbital, oleadas, jefes, subida de nivel, transformaciones, esferas
   del dragón, recompensas y guardado. Arranque al final del archivo.
   Estados: menu | play | pause | levelup | wish | dying | over
   ===================================================================== */

/** Estadísticas de la partida en curso (se muestran en la pausa y al terminar) */
const newRun = () => ({ damage: 0, best: 0, taken: 0, dashes: 0, curses: 0, temples: 0, rooms: 0, shops: 0, swaps: 0, byW: {}, maxCombo: 0, events: 0, allies: 0, rivals: 0, fusions: 0, bosses: 0, tps: 0, gachas: 0, route: [] });
/** Nombre legible del origen del daño (gráfica de daño por técnica) */
const SRC_NAMES = { ult: 'Ultimate', otros: 'Otros (ondas, explosiones)', ally: 'Compañeros', mines: 'Minas de Energía', transform: 'Transformación', aura: 'Aura de transformación', bolt: 'Rayos de la forma', counter: 'Contraataques', tp: 'Transmisión Instantánea', chain: 'Saibaimen en cadena' };
/** Color del brillo de cada grieta según el mapa al que lleva */
const RIFT_COL = { namek: 0x6aff8a, vegeta: 0xff6a3a, room: 0xffffff, rift: 0xc050ff, torneo: 0xffd060, hell: 0xff2a1a, kame: 0x5ad8ff };
/** Calidad gráfica: resolución máxima, sombras y cantidad de partículas */
const QUALITY = {
  high: { pr: 2, shadow: 2048, every: 1, fx: 1 },
  medium: { pr: 1.25, shadow: 1024, every: 2, fx: 0.8 },
  low: { pr: 0.85, shadow: 0, every: 0, fx: 0.5 }
};
const srcName = (id) => (WEAPONS[id] ? WEAPONS[id].icon + ' ' + WEAPONS[id].name : SRC_NAMES[id] || id);
const fmtK = (v) => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e4 ? Math.round(v / 1e3) + 'k' : String(Math.round(v));
/** Precio base (Zeni) de los objetos del vendedor según su rareza */
const SHOP_PRICE = [40, 90, 200, 420, 850, 1700];

/* Recarga (s) de cada técnica de jefe, pausa que deja después y nombre que se anuncia.
   Los nombres que empiezan por «¡» se anuncian siempre; el resto, solo la primera vez del combate */
const BOSS_CD = { fan: 2.6, ring: 6.5, spiral: 9, dash: 5, rain: 7.5, beam: 8, summon: 15, grieta: 6,
  deathbeam: 4.2, saucer: 7, supernova: 13, kame: 7.5, barrier: 8, celljr: 16, selfdestruct: 26, eraser: 5.5, meteor: 8, rush: 9, roar: 10,
  majinkame: 7, candy: 6, planetburst: 10, scream: 7.5, regen: 14, thunder: 6, icewall: 7, nova: 10, minusball: 13,
  punches: 4, glare: 7, powerimpact: 6.5, blink: 9, orbs: 4.5, hakai: 7.5, sphere: 14, wall: 4.5, lightning: 7.5, blades: 8, wrath: 11 };
const BOSS_GAP = { fan: 0.4, orbs: 0.4, punches: 0.9, regen: 0, summon: 0.3, celljr: 0.3, selfdestruct: 3.4, rush: 3, nova: 1.2 };
const BOSS_MOVE_NAMES = { deathbeam: 'RAYO MORTAL', saucer: 'DISCO MORTAL', supernova: '¡SUPERNOVA!', kame: 'KA-ME-HA-ME-HA', barrier: 'BARRERA PERFECTA',
  celljr: '¡CÉLULA JR.!', selfdestruct: '¡AUTODESTRUCCIÓN! ¡ALÉJATE!', eraser: 'CAÑÓN ERASER', meteor: 'METEORO GIGANTE', rush: 'EMBESTIDA GIGANTE',
  roar: 'GRITO LEGENDARIO', majinkame: 'KAMEHAMEHA DE BUU', candy: 'RAYO DE CARAMELO', planetburst: 'BOMBA PLANETARIA', scream: 'GRITO DE BUU',
  regen: '¡SE REGENERA!', thunder: 'TRUENO DEL DRAGÓN', icewall: 'MURO DE HIELO', nova: 'ESTRELLA NOVA', minusball: '¡BOLA DE ENERGÍA NEGATIVA!',
  punches: 'PUÑOS INVISIBLES', glare: 'MIRADA DE JIREN', powerimpact: 'POWER IMPACT', hakai: '¡HAKAI!', sphere: '¡ESFERA DE DESTRUCCIÓN!',
  lightning: 'RAYOS DE LA ABSOLUCIÓN', blades: 'HOJAS DEL JUICIO', wrath: 'IRA DIVINA', wall: 'MURO DE LUZ', blink: 'TELETRANSPORTE', orbs: 'ESFERAS DE ENERGÍA', grieta: 'GRIETA DE BLACK' };

class Game {
  constructor(sheets) {
    this.ui = new UIManager();
    this.state = 'menu';
    this.time = 0; this.kills = 0; this.spawnAcc = 0; this.zeniRun = 0; this.pendingLevels = 0;
    this.bossUid = 0; this.nextBoss = 180; this.leashT = 0; this.hitstop = 0; this.shakeAmt = 0;
    this.ultT = -1; this.ultCut = false; this.ultFx = null;   // Ultimate: secuencia de impacto (el elemento se busca al usarlo)
    this.cash = 0; this.capsOpened = 0; this.diff = DIFFS[0]; this.won = false;
    // Estructura de la partida: mapas (STAGES), enjambre final, maldiciones y desafíos
    this.run = newRun(); this.stageIdx = 0; this.stage = STAGES[0]; this.stageTime = 0; this.swarm = false; this.waveT = 60;
    this.curseHp = 0; this.curseDmg = 0; this.chal = 0; this.coinMul = 1; this.zoneBusy = null; this.bossDead = false; this.bossSpawned = false;
    this.boss = { t1: 3, t2: 6, next: 0 }; this.victoryT = 0; this.transT = 0; this.transDone = false; this.showMap = false; this.tradeO = null;
    // Combos, impact frames, eventos aleatorios, modo práctica y logros
    this.combo = 0; this.comboT = 0; this.impT = 0; this.impCd = 0; this.eventT = 120; this.storm = 0; this.rivalUid = 0;
    this.practice = false; this.achT = 1; this.smashT = 0; this.lakeMsg = false;
    // Ruta, desafío diario, jefes con fases, día/noche y explosiones pendientes de los kamikaze
    this.step = 0; this.daily = false; this.mods = {}; this.modList = []; this.phase = 0; this.bossInv = 0; this.night = 0; this.nightT = 0; this.wasNight = false;
    this.booms = []; this.dodgeMsgT = 0; this.cardT = 0; this.lastResult = null;
    // Rendimiento: resolución dinámica (calidad AUTO) y sombras que no se recalculan en cada fotograma
    this.perf = { acc: 0, n: 0, good: 0, pr: 1, shadowN: 0 };
    this.shadowDirty = true;                                // el mapa de sombras se redibuja solo cuando cambia algo
    // Cámara orbital: yaw (giro), pitch (inclinación) y dist (zoom)
    this.camYaw = 0; this.camPitch = 0.98; this.camDist = 19; this.camDistT = 19; this.camCos = 1; this.camSin = 0;
    this.drag = false;
    try {
      if (typeof THREE === 'undefined') throw new Error('Three.js no se cargó desde el CDN. Revisa tu conexión a internet.');
      if (!sheets || !sheets.goku || !sheets.enemies) throw new Error('No se pudieron cargar los spritesheets (assets/sprites.js). Comprueba que la carpeta "assets" está junto a index.html.');
      this.initGL(sheets);
    } catch (err) {
      console.error(err);
      this.ui.fatal(String(err.message || err));
      return;
    }
    this.ui.sheets = sheets;
    this.cine = new TransformScene(this);                // cinemática de transformación
    this.intro = new FusionIntro(this);                  // intro de la fusión de Vegetto y Gogeta
    this.ultCine = new UltCine(this);                    // animación de la Ultimate de cada personaje
    this.touch = new TouchControls(this);                // controles táctiles (solo en móvil)
    this.pad = new PadInput(this);                       // mando (Gamepad API)
    // Cuenta y ranking mundial (Supabase). Si no está configurado, el juego funciona igual
    this.online = new Online();
    this.online.onChange = () => { if (this.state === 'menu') this.ui.renderMenu(); };
    this.online.init().catch((e) => console.error(e));
    this.bindEvents();
    this.clock = new THREE.Clock();
    this.loop = this.loop.bind(this);
    this.toMenu();
    requestAnimationFrame(this.loop);
  }

  initGL(sheets) {
    const canvas = document.getElementById('game');
    // El suavizado de bordes solo se puede elegir al crear el renderer: en calidad BAJA se desactiva (al recargar)
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: Save.d.opt.quality !== 'low', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_TOUCH ? 1.5 : 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 420);
    this.camLook = new THREE.Vector3(0, 0, 0);
    this.backdrop = new Backdrop(this.scene);               // panorama de fondo de cada mapa (escenarios de Z Legends 3)

    initShared();
    const tex = makeTextures();
    this.tex = tex;
    CFG.ARENA = STAGES[0].R;
    this.vfx = new VFX(this.scene, sheets);                // efectos animados con sprites (antes del mundo: el decorado usa sus hojas)
    this.world = new World(this.scene, STAGES[0].theme);
    this.shadows = new SpriteBatch(this.scene, { max: CFG.MAX_ENEMIES + 2, texture: tex.shadow, w: 1, h: 0.5, anchor: 0.5, flat: true, blend: true, tint: 0x000000, alpha: 0.38, cut: 0.02, renderOrder: 1 });
    this.fx = new FX(this.scene, tex);
    this.player = new Player(this.scene, sheets, tex);
    this.horde = new HordeManager(this.scene, CFG.MAX_ENEMIES, sheets.enemies);
    this.ki = new KiPool(this.scene, CFG.MAX_BULLETS, tex);
    this.orbs = new XpOrbs(this.scene, CFG.MAX_ORBS, tex);
    this.pickups = new Pickups(this.scene, tex);
    this.capsules = new Capsules(this.scene, tex);
    this.weapons = new WeaponSystem(this.scene, tex);
    this.points = new Points(this.scene, tex);          // santuarios, comerciantes, altar y grieta
    this.summon = new Summon(this);                     // Altar de Shenron: gachapón de transformaciones
    this.gacha = new Gacha(this);                       // Gachapón de Shenron (ventana de las 7 esferas)
    this.shots = new EnemyShots(this.scene, tex);       // disparos de los jefes
    this.allies = new Allies(this.scene, sheets);       // compañeros temporales
    // Al romper un cristal: orbes de experiencia, chispas y a veces una semilla
    this.onCrystalBreak = (x, z) => {
      this.shadowDirty = true;                                // un cristal menos: su sombra desaparece
      this.orbs.spawn(x, z, 4); this.gainZeni(2); this.gainCash(8);
      this.fx.burst(this.fx.sparks, x, 1.2, z, 16, 7, 0.5, 0.35, 8, 0x9fe0ff);
      if (Math.random() < 0.3) this.pickups.drop(x, z);
    };
    this.world.onBreak = this.onCrystalBreak;
    // Al romper una caja, estatua o roca: escombros, destello y premio extra (las estatuas, más)
    this.onSprBreak = (o) => {
      this.vfx.play('debris', o.x, 0, o.z, { size: o.size * 1.1, fps: 14, frames: FXA.debris ? FXA.debris.f.slice(0, 6) : null });
      this.vfx.flash(o.x, 1.4, o.z, 3.5, 0xffd060);
      if (o.rw === 'chest') { this.gainZeni(40); for (let i = 0; i < 3; i++) this.orbs.spawn(o.x, o.z, 6); if (Math.random() < 0.25) this.pickups.drop(o.x, o.z); this.ui.toast('+ZENI · COFRE', true); }
      else if (o.rw === 'house') { this.gainZeni(30); this.orbs.spawn(o.x, o.z, 14); this.ui.toast('+ZENI · CASA CÁPSULA', true); }
      else if (o.rw === 'vase') this.orbs.spawn(o.x, o.z, 6);
      else if (o.size > 3.3 && !o.tall) { this.gainZeni(25); this.orbs.spawn(o.x, o.z, 10); this.ui.toast('+ZENI · ESTATUA ROTA', true); }
      SFX.play('boom');
    };
    this.world.onSprBreak = this.onSprBreak;
    this.player.vfx = this.vfx;
    if (this.vfx.ok) { this.ki.useFx(sheets.fx); this.shots.useFx(sheets.fx); this.pickups.useFx(sheets.props); }
    this.impCd2 = 0; this.env = null;
    this.applyQuality();
  }

  /* ---------- Calidad gráfica ---------- */
  /** Nivel efectivo: en AUTO se parte de MEDIA y se ajusta la resolución sobre la marcha */
  qualityCfg() { const q = Save.d.opt.quality; return QUALITY[q] || QUALITY.medium; }
  applyQuality() {
    const Q = this.qualityCfg(), dpr = window.devicePixelRatio || 1, auto = Save.d.opt.quality === 'auto';
    this.perf.max = Math.min(dpr, IS_TOUCH ? Math.min(1.5, Q.pr) : (auto ? 1.5 : Q.pr));
    this.perf.pr = auto ? Math.min(this.perf.max, Math.max(this.perf.pr || 1, 0.7)) : this.perf.max;
    this.perf.good = 0; this.perf.acc = 0; this.perf.n = 0; this.perf.noShadow = false; this.perf.lowFx = false;
    this.renderer.setPixelRatio(this.perf.pr);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.fx.q = Q.fx;
    this.applyShadow();
  }
  applyShadow() {
    const Q = this.qualityCfg(), sun = this.world.sun, on = Q.shadow > 0 && !this.perf.noShadow;
    this.renderer.shadowMap.autoUpdate = false; this.renderer.shadowMap.needsUpdate = true;
    // Sombra suave (más muestras por píxel) solo en ALTA; en el resto, filtrado normal, bastante más barato
    const type = Save.d.opt.quality === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    if (this.renderer.shadowMap.type !== type) {
      this.renderer.shadowMap.type = type;
      this.scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
    }
    sun.castShadow = on;
    if (on && sun.shadow.mapSize.x !== Q.shadow) {
      sun.shadow.mapSize.set(Q.shadow, Q.shadow);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
  }
  /** Calidad AUTO: cada 2 s mira el tiempo medio por fotograma; baja o sube la resolución (y quita sombras si hace falta) */
  autoQuality(rawDt) {
    const P = this.perf;
    if (Save.d.opt.quality !== 'auto') return;
    P.acc += rawDt; P.n++; P.capT = Math.max(0, (P.capT || 0) - rawDt);
    if (P.acc < 1) return;                                          // se mide cada segundo (antes cada 2: tardaba ~12 s en reaccionar)
    const ft = P.acc / P.n; P.acc = 0; P.n = 0;
    const setPr = (v) => { P.pr = v; this.renderer.setPixelRatio(v); this.renderer.setSize(window.innerWidth, window.innerHeight, false); };
    if (ft > 1 / 48) {
      P.good = 0; P.cap = P.pr; P.capT = 40;                      // no vuelve a subir hasta aquí en 40 s (así no va y viene)
      // Lo que más alivia a la GPU es la resolución (la horda y los efectos llenan la pantalla de sprites):
      // 1) resolución hasta 1 y menos partículas · 2) sin sombras del sol · 3) resolución hasta 0,6
      if (P.pr > 1.05 || !P.lowFx) { P.lowFx = true; this.fx.q = this.qualityCfg().fx * 0.6; if (P.pr > 1.05) setPr(Math.max(1, P.pr - 0.25)); }
      else if (!P.noShadow) { P.noShadow = true; this.applyShadow(); }
      else if (P.pr > 0.62) setPr(Math.max(0.6, P.pr - 0.15));
    } else if (ft < 1 / 57 && ++P.good >= 4) {
      P.good = 0;
      const top = P.capT > 0 ? Math.min(P.max, P.cap - 0.1) : P.max;
      if (P.pr < top - 0.01) setPr(Math.min(top, P.pr + 0.1));
    }
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
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;   // escribiendo en un formulario
      if (this.ui.el.modal.classList.contains('show') || this.ui.el.exit.classList.contains('show')) return;
      const s = this.state;
      if (s === 'menu' && e.code === 'Enter') this.startLoad(false);
      else if (s === 'over' && (e.code === 'Enter' || e.code === 'KeyR')) this.again();
      else if (s === 'chapcard') this.endChapCard();
      else if (s === 'play' && this.practice && e.code === 'KeyL') this.practiceLevel();
      else if (s === 'play' && this.practice && e.code === 'KeyK') this.practiceClear();
      else if (s === 'play' && this.practice && e.code === 'KeyJ') { this.cash += 500; SFX.play('coin'); }
      else if (s === 'over' && (e.code === 'KeyM' || e.code === 'Escape')) this.toMenu();
      else if ((s === 'play' || s === 'pause') && (e.code === 'KeyP' || e.code === 'Escape')) this.togglePause();
      else if (s === 'play' && e.code === 'KeyE') this.interact();
      else if (s === 'play' && e.code === 'KeyG') this.transform();
      else if (s === 'play' && e.code === 'KeyQ') this.ultimate();
      else if (s === 'play' && e.code === 'KeyH') this.revertForm();
      else if (s === 'trade' && (e.code === 'KeyE' || e.code === 'Escape')) this.closeTrade();
      else if (s === 'gacha' && (e.code === 'KeyE' || e.code === 'Escape')) this.gacha.close();
      else if (s === 'gacha' && /^Digit[1-7]$/.test(e.code)) this.gacha.pick(+e.code[5] - 1);
      else if (s === 'gacha' && (e.code === 'Enter' || e.code === 'Space')) { if (this.gacha.phase === 'show') this.gacha.mix(); }
      else if (s === 'play' && e.code === 'KeyM') { this.showMap = !this.showMap; ui.el.bigmap.style.display = this.showMap ? 'block' : 'none'; }
      else if ((s === 'play' || s === 'pause') && e.code === 'Tab') { e.preventDefault(); this.togglePause(); }
      else if ((s === 'levelup' || s === 'wish') && /^Digit[1-4]$/.test(e.code)) { if (this.cardsReady()) ui.pickCard(+e.code[5] - 1); }
      else if ((s === 'levelup' || s === 'wish') && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) ui.focusCard(e.code === 'ArrowLeft' ? -1 : 1);
      else if ((s === 'levelup' || s === 'wish') && (e.code === 'Enter' || e.code === 'Space')) { if (this.cardsReady()) ui.pickCard(ui.cardFocus); }
      else if (s === 'levelup' && e.code === 'KeyR') this.reroll();
    });
    // Cámara con el ratón: arrastra con el botón derecho (o central), rueda para el zoom
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    // Cámara libre estilo Megabonk: el ratón queda capturado (pointer lock) y mueve la cámara siempre
    cv.addEventListener('mousedown', (e) => {
      if (this.state === 'play' && !this.locked()) this.grabMouse();
      else if (e.button !== 0) this.drag = true;
    });
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
      const t = e.target.closest('[data-go],[data-tab],[data-mtab],[data-rtab],[data-ch],[data-buy],[data-equip],[data-lab],[data-item],[data-tech],[data-claim],[data-diff],[data-start],[data-exit],[data-q],[data-flash],[data-exp],[data-imp],[data-impfile],[data-reset],[data-acct],[data-atab],[data-otab],[data-rtab-go],[data-ctab],[data-lsel],[data-book],[data-lchap],[data-place],[data-claimch],[data-pull],[data-gtab],[data-rates],[data-gform]');
      if (!t) return;
      SFX.play('click');
      const D = t.dataset;
      if (D.place) {                                                  // mapa: viaja con la Teletransportación y luego entra
        const P = placeById(D.place);
        ui.map.travel(D.place, () => { if (P.act.go) this.go(P.act.go); else { this.saga = null; this.startLoad(P.act.start === 'practice', P.act.start === 'daily'); } });
      }
      else if (D.go) { this.go(D.go); if (D.wk !== undefined) { ui.mtab = 'weekly'; ui.renderMenu(); } }
      else if (D.tab) { ui.tab = D.tab; ui.renderMenu(); }
      else if (D.mtab) { ui.mtab = D.mtab; ui.renderMenu(); }
      else if (D.ch) this.viewChar(D.ch);
      else if (D.buy) this.buyChar(D.buy);
      else if (D.claimch) this.claimChar(D.claimch);
      else if (D.pull) this.summon.pull(+D.pull);
      else if (D.gtab) { ui.gtab = D.gtab; ui.renderMenu(); }
      else if (D.rates !== undefined) this.summon.showRates();
      else if (D.gform) this.summon.toggleForm(D.gform);
      else if (D.equip) this.viewChar(D.equip, true);
      else if (D.lab) this.buyLab(D.lab);
      else if (D.item) this.buyItem(D.item);
      else if (D.tech) this.buyTech(D.tech);
      else if (D.claim) this.claimMission(D.claim);
      else if (D.diff) { Save.d.diff = D.diff; Save.write(); ui.renderMenu(); }
      else if (D.start !== undefined) { this.saga = D.start.startsWith('chap:') ? chapById(D.start.slice(5)) : null; this.startLoad(D.start === 'practice', D.start === 'daily', MODES[D.start] ? D.start : null); }
      else if (D.exit !== undefined) ui.showExit(true);
      else if (D.rtab) { ui.rtab = D.rtab; ui.renderMenu(); }
      else if (D.otab) { ui.otab = D.otab; ui.renderMenu(); }
      else if (D.ctab) { ui.ctab = D.ctab; ui.renderMenu(); }
      else if (D.lsel !== undefined) { ui.lsel = +D.lsel; ui.renderMenu(); }
      else if (D.book !== undefined) { ui.book = +D.book < 0 ? null : +D.book; ui.lchap = null; ui.renderMenu(); }
      else if (D.lchap !== undefined) { ui.lchap = +D.lchap; ui.renderMenu(); }
      else if (D.atab) { ui.atab = D.atab; ui.renderMenu(); }
      else if (D.rtabGo) { ui.rtab = D.rtabGo; this.go('records'); }
      else if (D.acct === 'out') this.online.signOut().then(() => { ui.atab = 'login'; ui.renderMenu(); });
      else if (D.q) { Save.d.opt.quality = D.q; Save.write(); this.perf.pr = 1; this.applyQuality(); ui.renderMenu(); }
      else if (D.flash !== undefined) { Save.d.opt.flash = !Save.d.opt.flash; Save.write(); ui.renderMenu(); }
      else if (D.exp !== undefined) this.exportSave();
      else if (D.imp !== undefined) this.importSave();
      else if (D.impfile !== undefined) { const f = document.getElementById('impFile'); if (f) f.click(); }
    });
    // Formulario de cuenta: entrar o crear cuenta
    ui.el.menu.addEventListener('submit', (e) => {
      const f = e.target.closest('[data-acct-form]');
      if (!f) return;
      e.preventDefault();
      const msg = document.getElementById('acMsg'), btn = f.querySelector('button[type=submit]'), val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
      if (btn.disabled) return;
      btn.disabled = true; msg.className = 'msg'; msg.textContent = 'Conectando…';
      const job = f.dataset.acctForm === 'signup' ? this.online.signUp(val('acMail'), val('acPass'), val('acName')) : this.online.signIn(val('acMail'), val('acPass'));
      job.then((r) => {
        btn.disabled = false; msg.className = 'msg' + (r.ok ? ' ok' : ' bad'); msg.textContent = r.msg;
        if (r.ok) SFX.play('coin');
      });
    });
    // Importar desde archivo .json
    ui.el.menu.addEventListener('change', (e) => {
      if (e.target.id !== 'impFile' || !e.target.files[0]) return;
      const r = new FileReader();
      r.onload = () => { const ta = document.getElementById('saveTxt'); if (ta) ta.value = String(r.result); this.importSave(); };
      r.readAsText(e.target.files[0]);
    });
    ui.el.exit.addEventListener('click', () => ui.showExit(false));
    // Volumen (pantalla de opciones)
    ui.el.menu.addEventListener('input', (e) => {
      if (e.target.dataset && e.target.dataset.shake !== undefined) {
        Save.d.opt.shake = +e.target.value / 100; Save.write();
        const lab = e.target.parentNode.querySelector('b'); if (lab) lab.textContent = e.target.value + '%';
        return;
      }
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
    ui.el.cardFoot.addEventListener('click', (e) => { if (e.target.closest('[data-reroll]')) this.reroll(); });
    ui.el.scrA.onclick = () => { ui.el.scrA.blur(); if (this.state === 'pause') this.togglePause(); else this.again(); };
    ui.el.scrB.onclick = () => { ui.el.scrB.blur(); if (this.state === 'pause') this.abandon(); else this.toMenu(); };
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play') this.togglePause(); });
  }

  /** Volver a jugar: en el Modo Historia, tras ganar, pasa al siguiente capítulo (o al primero del libro siguiente) */
  again() {
    if (this.saga && this.won && this.nextChap) this.saga = this.nextChap;
    this.startLoad(this.practice, this.daily, this.mode);
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
  go(screen) {
    if (screen === 'ach' || screen === 'missions') { this.ui.mtab = screen === 'ach' ? 'ach' : 'missions'; screen = 'missions'; }
    if (screen === 'legend') { this.ui.book = null; this.ui.lchap = null; }
    if (screen !== this.ui.screen && this.ui.el.menu.classList.contains('show')) { this.ui.itFlash(); if (screen === 'home') SFX.play('tp'); }
    this.ui.screen = screen; this.ui.renderMenu(); this.applyView();
  }
  /** En la pantalla de inicio el personaje se desplaza a la derecha para dejar sitio a los botones */
  applyView() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.clearViewOffset();                                   // (el inicio es el mapa del mundo: ya no se ve el 3D detrás)
  }
  /** Fondo vivo del menú: unos cuantos enemigos que pasean por el mapa (no atacan) */
  menuCrowd() {
    const h = this.horde, types = [T_BASIC, T_BASIC, T_BASIC, T_FAST, T_FAST, T_BRUTE, T_ELITE, T_FLY, T_SHIELD];
    for (let k = 0; k < 26; k++) {
      const a = rand(0, 6.283), r = rand(7, 26);
      this.world.push(Math.cos(a) * r, Math.sin(a) * r, 0.8);
      const i = h.spawn(this.world.px, this.world.pz, 1, types[k % types.length]);
      if (i >= 0) { h.aux[i] = rand(0, 2); h.kx[i] = 0; h.kz[i] = 0; }
    }
  }
  menuLife(dt) {
    const h = this.horde, w = this.world, cc = this.camCos, cs = this.camSin;
    for (let i = 0; i < h.n; i++) {
      const T = ENEMY_TYPES[h.type[i]];
      h.aux[i] -= dt;
      if (h.aux[i] <= 0) {                                         // nuevo rumbo (o un descanso); vuelven si se alejan o se acercan demasiado
        h.aux[i] = rand(1.8, 4.5);
        const x = h.x[i], z = h.z[i], r = Math.hypot(x, z);
        if (Math.random() < 0.3 && r > 7 && r < 26) { h.kx[i] = 0; h.kz[i] = 0; }
        else {
          const a = r > 26 ? Math.atan2(-z, -x) + rand(-0.6, 0.6) : r < 7 ? Math.atan2(z, x) + rand(-0.6, 0.6) : rand(0, 6.283), sp = 1.7 * T.spd;
          h.kx[i] = Math.cos(a) * sp; h.kz[i] = Math.sin(a) * sp;
        }
      }
      const vx = h.kx[i], vz = h.kz[i];
      if (vx * vx + vz * vz > 0.01) {
        w.push(h.x[i] + vx * dt, h.z[i] + vz * dt, T.r * 0.8); h.x[i] = w.px; h.z[i] = w.pz;
        h.phase[i] += dt * 7 * (0.6 + T.spd * 0.4); h.flip[i] = vx * cc - vz * cs < 0 ? 1 : 0;
      } else h.phase[i] = 0;
    }
  }
  /** Personaje con reto cumplido: se desbloquea gratis */
  claimChar(id) {
    const c = charById(id), P = c && reqProgress(c);
    if (!P || Save.d.unlocked.includes(id) || P[0] < P[1]) return;
    Save.d.unlocked.push(id); Save.d.sel = id; Save.write();
    this.previewPlayer(); this.ui.view = id; this.ui.renderMenu();
    Shenron.summon({ kicker: '¡Reto cumplido!', title: nice(c.name), sub: 'Se une a tu equipo', html: '<span class="big">¡Desbloqueado!</span>', btn: '¡Vamos!' });
  }
  buyChar(id) {
    const c = charById(id);
    if (!c || c.soon || c.req || c.summon || Save.d.unlocked.includes(id) || Save.d.zeni < c.cost) return;
    Save.d.zeni -= c.cost; Save.d.unlocked.push(id); Save.d.sel = id; Save.write();
    this.previewPlayer(); this.ui.view = id; this.ui.renderMenu();
  }
  buyLab(id) {
    const l = LAB.find((x) => x.id === id), lvl = Save.lab(id), cost = labCost(l, lvl);
    if (lvl >= l.max || Save.d.zeni < cost) return;
    Save.d.zeni -= cost; Save.d.up[id] = lvl + 1; Save.write();
    this.previewPlayer(); this.ui.renderMenu();
  }
  /** Copia de seguridad: texto en la caja, al portapapeles y como archivo .json */
  exportSave() {
    const str = Save.exportStr(), ta = document.getElementById('saveTxt');
    if (ta) { ta.value = str; ta.select(); }
    try { if (navigator.clipboard) navigator.clipboard.writeText(str).catch(() => {}); } catch (e) { /* sin portapapeles */ }
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(Save.d)], { type: 'application/json' }));
      a.download = 'dragonball-survivor-' + todayStr() + '.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) { /* sin descargas */ }
    this.ui.optMsg = 'COPIA EXPORTADA: se ha descargado el archivo y copiado el texto.'; this.ui.renderMenu();
    const t2 = document.getElementById('saveTxt'); if (t2) t2.value = str;
  }
  /** Restaura una copia (pide pulsar dos veces para no borrar el progreso por error) */
  importSave() {
    const ta = document.getElementById('saveTxt'), str = ta ? ta.value : '';
    if (!str.trim()) { this.ui.optMsg = 'Pega primero el texto de la copia o elige un archivo .json.'; this.ui.renderMenu(); return; }
    if (!this.ui.impArmed) { this.ui.impArmed = true; this.ui.optMsg = '¿Seguro? Se sustituirá tu progreso actual. Pulsa IMPORTAR otra vez para confirmar.'; this.ui.renderMenu(); const t2 = document.getElementById('saveTxt'); if (t2) t2.value = str; return; }
    this.ui.impArmed = false;
    const ok = Save.importStr(str);
    this.ui.optMsg = ok ? '¡PARTIDA IMPORTADA!' : 'Ese texto no es una copia válida.';
    if (ok) { SFX.applyVol(); this.applyQuality(); this.previewPlayer(); }
    this.ui.renderMenu();
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
    if (this.stageIdx !== 0 || WORLD_SEED_XOR) { WORLD_SEED_XOR = 0; this.daily = false; this.mods = {}; this.loadStage(0); }   // el menú siempre muestra el primer mapa
    this.world.setNight(0); this.night = 0;
    this.points.reset(); this.shots.reset(); this.showMap = false; this.ui.el.bigmap.style.display = 'none'; this.ui.el.fade.style.opacity = 0; this.ui.hideTrade();
    this.horde.reset(); this.ki.reset(); this.orbs.reset(); this.fx.reset(); this.weapons.reset(charById(Save.d.sel));
    this.menuCrowd();
    this.pickups.senzu.reset(); this.pickups.balls.reset(); this.capsules.n = 0; this.capsules.spr.reset(); this.capsules.glow.reset();
    this.ui.hideScreen(); this.ui.hideCards();
    this.previewPlayer();
    this.camYaw = 0.5; this.camPitch = 0.75; this.camDistT = 20; this.camDist = 20;
    this.camLook.set(0, 0, 0);
    if (this.saga) { this.ui.screen = 'legend'; this.ui.book = this.saga.book.idx; this.ui.lchap = this.won && this.nextChap && this.nextChap.book === this.saga.book ? this.nextChap.idx : this.saga.idx; }
    else this.ui.screen = 'home';
    this.saga = null; this.won = false; this.mode = null; this.ui.modeHud(this);
    this.allies.reset(); this.setStorm(0);
    SFX.music('menu');
    this.ui.showMenu(this);
    this.applyView();
    this.ui.showHud(false);
  }

  /* ---------- Partida ---------- */
  /** Empieza la partida mostrando la pantalla de carga mientras se genera el mapa (relieve nuevo en cada partida) */
  startLoad(practice, daily, mode) {
    const l = document.getElementById('loading'), tx = document.getElementById('ldTxt');
    if (this.loadingRun) return;
    if (!l) { this.start(practice, daily, mode); return; }
    this.loadingRun = true;
    l.classList.add('quick'); l.style.display = 'flex';
    const tip = document.getElementById('tip'); if (tip) tip.textContent = '¡PREPARANDO EL COMBATE!';
    if (tx) tx.textContent = '';
    // Dos cuadros para que se pinte la pantalla antes del trabajo pesado
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try { this.start(practice, daily, mode); if (this.renderer) this.renderer.compile(this.scene, this.camera); }
      finally {
        this.loadingRun = false; this.clock.getDelta();
        l.classList.add('out');
        setTimeout(() => { l.style.display = 'none'; l.classList.remove('out', 'quick'); }, 300);
      }
    }));
  }
  start(practice, daily, mode) {
    if (practice || daily || mode) this.saga = null;                 // el Modo Leyenda solo en partidas normales
    // Modos de cristales: 'rush' (Lluvia de Cristales, 5 min) · 'gauntlet' (Asalto de Jefes, jefes sin parar)
    this.mode = !practice && !daily && MODES[mode] ? mode : null; this.modeCry = 0; this.modeT = this.mode === 'rush' ? RUSH_TIME : 0; this.modeDone = false;
    this.gN = 0; this.gNext = 4; this.ui.modeHud(this);
    const ch = this.saga ? charById(this.saga.ch) : charById(Save.d.sel);
    if (!ch || ch.soon || (!this.saga && !Save.d.unlocked.includes(ch.id))) return;   // en una saga juegas con su personaje
    // Desafío diario: mapa con la semilla del día, 2 modificadores y dificultad NORMAL para todos
    this.daily = !!daily && !practice;
    this.modList = this.daily ? dailyMods() : [];
    this.mods = {}; for (const m of this.modList) this.mods[m.id] = true;
    WORLD_SEED_XOR = this.daily ? dailySeed() % 100000 : 0;
    // Relieve: cada partida tiene colinas distintas; el desafío diario usa siempre el relieve del día
    RELIEF_SEED = this.daily ? (dailySeed() % 1000003) + 17 : Math.floor(Math.random() * 1000003);
    this.timers = []; this.ultT = -1; this.faceT = 0; this.faceGo = null; const uf = this.ultFx || (this.ultFx = document.getElementById('ultFx')); if (uf) uf.style.opacity = 0;
    this.player.reset(ch); this.weapons.reset(ch); this.player.menuHide = false;
    this.diff = this.daily ? DIFFS[1] : diffById(Save.d.diff); this.cash = 0; this.capsOpened = 0; this.won = false; this.camera.clearViewOffset();
    this.time = 0; this.kills = 0; this.spawnAcc = 0; this.zeniRun = 0; this.pendingLevels = 0; this.leashT = 0;
    this.hitstop = 0; this.hsCd = 0; this.shakeAmt = 0; this.ui.flash = 0;
    this.bossWeak = false; this.ballDist = 1e9; this.radarT = 0; this.roomT = 0; this.tourney = null; const tkEl = document.getElementById('talk'); if (tkEl) tkEl.classList.remove('show'); const rmEl = document.getElementById('roomFx'); if (rmEl) rmEl.classList.remove('show');
    this.camFocus = null; const bcEl = document.getElementById('bossCine'); if (bcEl) bcEl.classList.remove('show');   // por si acabó en mitad de una cinemática
    this.practice = !!practice; this.combo = 0; this.comboT = 0; this.impT = 0; this.impCd = 0; this.eventT = rand(90, 130); this.rivalUid = 0; this.achT = 1;
    this.allies.reset(); this.setStorm(0);
    this.run = newRun(); this.curseHp = 0; this.curseDmg = 0; this.chal = 0; this.coinMul = 1; this.showMap = false; this.ui.el.bigmap.style.display = 'none';
    this.ui.el.fade.style.opacity = 0; this.ui.hideTrade();
    if (IS_TOUCH) { goFullscreen(); this.camDistT = 22; }
    this.step = 0; this.booms.length = 0; this.rerolls = 2; this.sigOffered = {}; this.wMul = {};
    this.loadStage(this.saga ? this.saga.stage : (this.daily ? dailySeed() % 2 === 1 : Math.random() < 0.5) ? 7 : 0);
    if (this.saga) this.storySetup();   // se empieza en la Tierra o en la Isla Kame
    this.applyForm();
    for (let i = 0; i < (this.saga && this.saga.goal.type === 'tourney' ? 0 : 14); i++) this.spawnEnemy();
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
    if (!this.saga) this.ui.toast(this.practice ? 'ENTRENAMIENTO' : this.daily ? 'DESAFÍO DIARIO' : this.mode ? MODES[this.mode].name.toUpperCase() : ch.name);
    if (this.mode) this.ui.toast(MODES[this.mode].hint, true);
    if (this.practice) this.ui.toast('L: subir de nivel · K: limpiar la horda · J: +500 Zeni', true);
    for (const m of this.modList) this.ui.toast(m.icon + ' ' + m.name + ': ' + m.text, true);
    SFX.music('battle');
    // Vegetto y Gogeta empiezan con la intro de su fusión (el mundo espera congelado)
    if (this.intro.has(ch.id)) {
      this.state = 'intro'; this.releaseMouse();
      this.intro.start(ch.id, () => { if (this.state !== 'intro') return; this.state = 'play'; this.grabMouse(); this.clock.getDelta(); this.openOracle(); });
    } else this.openOracle();
  }

  /** Oráculo de Kami: 3 pactos al azar (ventaja + debilidad) o jugar sin pacto. No sale en el entrenamiento */
  openOracle() {
    if (this.practice || this.state !== 'play') return;
    if (this.saga) { this.showChapCard(); return; }             // Modo Historia: portada del capítulo y diálogo en vez del Oráculo
    this.state = 'wish'; this.releaseMouse(); this.cardT = 0;
    const pool = PACTS.slice(), list = [];
    while (list.length < 3) list.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
    const cards = list.map((P) => ({ type: 'form', id: P.id, icon: P.icon, tag: 'PACTO', title: P.name, text: '<span class="trg">✚ ' + P.good + '</span><br><span class="trb">✖ ' + P.bad + '</span>', max: 0, lv: 0 }));
    cards.push({ type: 'form', id: '', icon: '✖', tag: 'RECHAZAR', title: 'Sin pacto', text: 'Juegas sin ventajas ni debilidades.', max: 0, lv: 0 });
    SFX.play('event');
    this.ui.showCards('EL ORÁCULO DE KAMI', 'ELIGE UN PACTO PARA ESTA PARTIDA [1 · 2 · 3 · 4]', cards, (c) => {
      const p = this.player, P = PACTS.find((x) => x.id === c.id);
      if (P) {
        p.pact = P.id; p.recompute(); if (P.game) P.game(this);
        this.ui.toast(P.icon + ' ' + P.name.toUpperCase()); this.ui.toast('✚ ' + P.good + ' · ✖ ' + P.bad, true);
      } else this.ui.toast('SIN PACTO', true);
      this.ui.hideCards();
      if (this.pendingLevels > 0) this.openLevelUp(); else this.resume();
    });
  }

  /** Carga un mapa de la partida: mundo (tema y tamaño), puntos de interés, cápsulas y enemigos limpios */
  loadStage(idx) {
    const S = STAGES[idx];
    S.boss = pickBoss(S);                                         // jefe de este mapa en esta partida (al azar entre los posibles)
    this.stageIdx = idx; this.stage = S; this.stageTime = 0; this.waveT = 60; this.swarm = false;
    this.bossUid = 0; this.bossDead = false; this.bossSpawned = false; this.victoryT = 0; this.zoneBusy = null;
    this.boss = { t: {}, next: 0 }; this.phase = 0; this.bossInv = 0; this.night = 0; this.wasNight = false; this.nightT = 0;
    CFG.ARENA = S.R; this.backdrop.set(S.id);
    if (this.world.th !== THEMES[S.theme] || this.world.R !== S.R || this.world.seedX !== WORLD_SEED_XOR || this.world.reliefSeed !== RELIEF_SEED) {
      this.world.dispose(this.scene);
      this.world = new World(this.scene, S.theme);
      this.world.onBreak = this.onCrystalBreak; this.world.onSprBreak = this.onSprBreak;
      this.applyShadow();
    } else { this.world.reset(); this.world.setNight(0); this.shadowDirty = true; }
    this.horde.reset(); this.ki.reset(); this.orbs.reset(); this.fx.reset(); this.shots.reset(); this.booms.length = 0;
    this.vfx.reset(); this.env = null;
    this.pickups.reset(this.world); this.capsules.reset(this.world, S.final ? 0 : S.caps || 28); this.points.reset();
    if (this.run.route[this.run.route.length - 1] !== S.name) this.run.route.push(S.name);
    if (S.pois) this.points.populate(this.world, S);
    if (S.final) { this.pickups.got.fill(1); this.pickups.sn = 0; }
    // Aspecto de la horda y del jefe de este mapa
    this.horde.tints = ENEMY_TYPES.map((t) => t.tint);
    this.horde.rows = ENEMY_TYPES.map((t) => t.row);
    this.horde.rows[T_BASIC] = ENEMY_ROWS[S.basic] || 0;           // tropa básica: Saibaimans o soldados de Freezer
    const B = S.boss, T = ENEMY_TYPES[T_BOSS];
    T.name = B.name; T.tint = B.tints[0]; T.scale = B.scale; T.r = B.r; T.spd = 0.62; this.horde.tints[T_BOSS] = B.tints[0];
    this.ui.el.bossName.textContent = B.name;
    const p = this.player;
    p.x = 0; p.z = 0; p.vx = 0; p.vz = 0; p.kbx = 0; p.kbz = 0; this.camLook.set(0, 1.4, 0);
    // Efecto de cada mapa: agua que cura (Namek), gravedad x10 (Planeta Vegeta), gravedad baja (dimensión), tiempo (Cámara)
    p.dashBoost = S.fx === 'lowgrav' ? 1.4 : 1;
    p.grav = S.fx === 'gravity' ? 0.88 : 1; p.wade = 1; this.edgeMsg = false;
    this.lakeMsg = false;
    if (S.desc && this.state !== 'menu') this.ui.toast(S.desc, true);
    this.horde.buildGrid();
  }
  /** Ambiente de cada mapa: volcanes y erupciones (Planeta Vegeta), tornados (Tierra y Namek), rayos (dimensión) y nieve (Cámara) */
  updateEnv(dt) {
    const V = this.vfx, S = this.stage, p = this.player, w = this.world, t = this.time, h = this.horde;
    if (!V.ok) return;
    const E = this.env || (this.env = { t: rand(30, 50), torn: null, bolt: 2, erupt: 0 });
    E.t -= dt;
    if (w.volcs && w.volcs.length) {                                // volcanes: brillan y, en la erupción, echan humo
      E.erupt -= dt;
      for (const v of w.volcs) {
        V.now(5, fxf('volcano', v.f), v.x, 0, v.z, v.size, 1, 0xffffff);
        const top = v.size * 0.62;                                 // cráter: brillo de lava (y fumarola si está en erupción)
        V.now(0, fxf('fire3', ((t * 8 + v.ph) | 0) % 3), v.x, top, v.z, v.size * (E.erupt > 0 ? 0.35 : 0.18), 0.9, 0xffffff);
        if (E.erupt > 0 && Math.random() < dt * 20) this.fx.sparks.emit(v.x + rand(-1, 1), top, v.z + rand(-1, 1), rand(-3, 3), rand(8, 14), rand(-3, 3), 1.4, 0.8, 9, 0xff7a20);
      }
      if (E.t <= 0 && !this.bossUid) {                              // erupción: bombas de lava que caen cerca de ti
        E.t = rand(35, 55); E.erupt = 7;
        this.ui.toast('¡ERUPCIÓN VOLCÁNICA!'); this.shake(0.8); SFX.play('alarm');
        for (let q = 0; q < 9; q++) {
          const v = w.volcs[(Math.random() * w.volcs.length) | 0], o = rand(0, 6.28), r = q ? rand(2, 12) : 0;
          this.shots.ball(v.x, v.z, p.x + Math.cos(o) * r, p.z + Math.sin(o) * r, rand(1.8, 3), 2.6, this.enemyDamage() * 1.4, { tint: 0xff6a1a, size: 3.5, big: false });
        }
      }
    }
    if (S.theme === 0 || S.theme === 1) {                           // tornados: arrastran a los enemigos y te empujan
      if (!E.torn && E.t <= 0 && !this.bossUid) {
        E.t = rand(45, 70);
        const a = rand(0, 6.28), sx = p.x - Math.cos(a) * 34, sz = p.z - Math.sin(a) * 34;
        E.torn = { x: sx, z: sz, vx: Math.cos(a) * 6.5, vz: Math.sin(a) * 6.5, life: 11 };
        this.ui.toast(S.theme === 1 ? '¡VIENTO DE NAMEK!' : '¡TORNADO DE ARENA!', true);
      }
      const T = E.torn;
      if (T) {
        T.life -= dt; T.x += (T.vx + Math.sin(t * 1.3) * 3) * dt; T.z += (T.vz + Math.cos(t * 1.1) * 3) * dt;
        const nm = S.theme === 1 ? 'tornadoN' : 'tornado', col = S.theme === 1 ? 0xb8ffd8 : 0xf0d8a8;
        V.now(0, fxf(nm, ((t * 14) | 0) % fxn(nm)), T.x, 4.6, T.z, 10, Math.min(1, T.life) * 0.9, col);
        h.shockwave(T.x, T.z, 5, 30 * dt);
        const dx = p.x - T.x, dz = p.z - T.z, d = Math.hypot(dx, dz);
        if (d < 4.5 && d > 0.01) { p.kbx += (-dz / d * 9 + dx / d * 4) * dt * 6; p.kbz += (dx / d * 9 + dz / d * 4) * dt * 6; }
        if (T.life <= 0) E.torn = null;
      }
    }
    if (S.theme === 2) {                                            // dimensión fracturada: rayos morados de ambiente
      E.bolt -= dt;
      if (E.bolt <= 0) { E.bolt = rand(1.2, 3.5); const o = rand(0, 6.28), r = rand(14, 32); V.bolt(p.x + Math.cos(o) * r, p.z + Math.sin(o) * r, 18, 0xd070ff); }
    }
    if (S.theme === 4) {                                            // Cámara del Tiempo: nieve (cuerpo a temperaturas extremas)
      for (let i = 0; i < 60; i++) {
        const sx = ((i * 53.3 + t * 1.3) % 50) - 25, sz = ((i * 31.7 + t * 0.8) % 50) - 25, y = 16 - ((t * (1.6 + (i % 5) * 0.3) + i * 2.1) % 16);
        V.now(0, fxf('snow', i % 6), p.x + sx, y, p.z + sz, 0.75, 0.8, 0xffffff);
      }
    }
  }
  /** Pasa a la siguiente fase por la grieta: se conservan nivel, armas y objetos */
  nextStage(to) {
    const p = this.player;
    this.zeniRun += 150 * (this.step + 1);
    this.track('stages', 1);
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.35); p.ki = p.maxKi;
    this.step++;
    this.loadStage(to);
    this.syncSprites();
    this.ui.toast(this.stage.name);
    if (this.stage.final) this.ui.toast('EL ÚLTIMO COMBATE', true);
  }
  enterRift(r) {
    if (this.state !== 'play' || !r) return;
    this.state = 'transition'; this.transT = 0; this.transDone = false; this.riftTo = r.to; SFX.play('rift');
    this.ui.el.fade.style.opacity = 1;
    this.fx.ring(this.fx.aura, r.x, 0.5, r.z, 50, 20, 0.7, 0.4, r.col);
  }
  /** Al morir el jefe se abren las grietas hacia los mapas siguientes (dos = eliges camino) */
  openRifts(x, z) {
    const nx = this.stage.next, ui = this.ui;
    nx.forEach((to, k) => {
      const off = (k - (nx.length - 1) / 2) * 14 / Math.max(1, nx.length - 1) * (nx.length > 1 ? 1 : 0), a = this.camYaw;
      this.points.openRift(clamp(x + Math.cos(a) * off, -CFG.ARENA + 4, CFG.ARENA - 4), clamp(z - Math.sin(a) * off, -CFG.ARENA + 4, CFG.ARENA - 4), to, RIFT_COL[STAGES[to].id]);
    });
    if (nx.length > 1) { ui.toast('ELIGE TU CAMINO'); ui.toast(nx.map((i) => STAGES[i].name).join(' · O · '), true); }
    else ui.toast('LA GRIETA SE ABRE · [E] PARA ENTRAR', true);
  }

  /* ---------- Interacciones con E ---------- */
  interact() {
    const fa = this.fusionAlly();
    if (fa) { this.startFusion(fa); return; }
    const pts = this.points, c = this.capsules;
    const rn = pts.riftNear();
    if (rn) { this.enterRift(rn); return; }
    if (c.near >= 0) { this.tryOpenCapsule(); return; }
    if (pts.near >= 0) this.usePoi(pts.list[pts.near]);
  }
  /** Texto del aviso inferior según lo que tengas cerca (null = nada) */
  promptInfo() {
    const fa = this.fusionAlly();
    if (fa) return { t: '[E] FUSIONARSE CON ' + fa.d.name, ok: true };
    const pts = this.points, c = this.capsules;
    const rn = pts.riftNear();
    if (rn) return { t: '[E] GRIETA HACIA ' + STAGES[rn.to].name, ok: true };
    if (c.near >= 0) {
      const k = c.gold[c.near], cost = this.capsuleCost(k);
      return { t: '[E] ABRIR CÁPSULA' + (k === 1 ? ' DORADA' : k === 2 ? ' MALDITA ☠' : '') + ' · ' + cost + ' ZENI', ok: this.cash >= cost };
    }
    if (pts.near >= 0) {
      const o = pts.list[pts.near];
      if (o.type === 'boss') { if (this.saga) return { t: 'MODO HISTORIA · EL RIVAL LLEGA AL CUMPLIR EL OBJETIVO', ok: false };
        return { t: this.bossUid ? 'EL JEFE YA ESTÁ AQUÍ' : '[E] INVOCAR A ' + this.stage.boss.name, ok: !this.bossUid }; }
      if (o.type === 'temple') return { t: '[E] ACEPTAR EL DESAFÍO · ENEMIGOS MÁS FUERTES, MÁS RECOMPENSA', ok: true };
      if (o.type === 'merchant') return { t: '[E] HABLAR CON BULMA', ok: true };
      if (o.type === 'swapper') return { t: '[E] HABLAR CON EL MAESTRO ROSHI', ok: true };
      if (o.type === 'gacha') { const c = this.gacha.cost(o); return { t: '[E] GACHAPÓN DE SHENRON · ' + (c ? c + ' ZENI' : 'PRIMERA TIRADA GRATIS'), ok: this.cash >= c }; }
    }
    return null;
  }
  usePoi(o) {
    const ui = this.ui;
    if (o.type === 'boss') {
      if (this.bossUid || o.used) return;
      if (this.saga) { ui.toast('Cumple el objetivo: ' + this.saga.goal.text, true); return; }
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
    else if (o.type === 'gacha') this.gacha.open(o);
  }
  /** Habitación del Espíritu y el Tiempo completada: eliges 1 de 3 bendiciones */
  /** Al cargar la Habitación del Tiempo entras en la sala: 40 s de oleadas intensas mientras fuera solo pasan ~7 s */
  onTimeRoomDone(o) {
    this.roomT = ROOM_TIME; this.roomO = o; this.roomOut = 0;
    document.getElementById('roomFx').classList.add('show');
    this.fx.ring(this.fx.aura, o.x, 0.5, o.z, 60, 22, 0.8, 0.5, 0xffffff); this.shake(0.6); SFX.play('rift');
    this.ui.toast('⧗ SALA DEL ESPÍRITU Y EL TIEMPO');
    this.ui.toast(ROOM_TIME + ' s de oleadas intensas · experiencia doble · fuera solo pasan ' + Math.round(ROOM_TIME / 6) + ' s', true);
  }
  updateTimeRoom(dt) {
    if (!(this.roomT > 0)) return;
    this.roomT -= dt; this.roomOut += dt / 6;
    const L = this.ui.el.roomLbl || (this.ui.el.roomLbl = document.getElementById('roomLbl'));
    if (L) L.textContent = '⧗ DENTRO: ' + Math.max(0, Math.ceil(this.roomT)) + ' S · FUERA HAN PASADO ' + this.roomOut.toFixed(1) + ' S';
    if (this.roomT <= 0) {
      document.getElementById('roomFx').classList.remove('show');
      this.ui.toast('Dentro han pasado ' + ROOM_TIME + ' s… fuera solo ' + this.roomOut.toFixed(0) + ' s', true);
      this.timeRoomBlessing(this.roomO);
    }
  }
  timeRoomBlessing(o) {
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
      ['ESQUIVA', pc(p.dodge)], ['VIDA POR BAJA', p.killHeal.toFixed(1)], ['DAÑO', 'x' + p.damageMul().toFixed(2)], ['ATQ FÍSICO', 'x' + p.catMul('fis').toFixed(2)], ['ATQ KI', 'x' + p.catMul('ki').toFixed(2)], ['CADENCIA', 'x' + p.rateMul.toFixed(2)],
      ['CRÍTICO', pc(p.crit)], ['DAÑO CRÍTICO', 'x' + p.critDmg.toFixed(2)], ['VELOCIDAD', pc(p.speedMul)], ['DASH', 'x' + p.dashMul.toFixed(2)],
      ['KI MÁXIMO', Math.round(p.maxKi)], ['REGEN. KI', p.kiRegen.toFixed(1) + '/s'], ['IMÁN', p.magnet.toFixed(1)], ['SUERTE', p.luck],
      ['EXPERIENCIA', 'x' + p.xpMul.toFixed(2)], ['ZENI', 'x' + (p.zeniMul * this.coinMul).toFixed(2)]].map((x) => row(x[0], x[1])).join('') + '</div>';
    h += '<h4 class="sh">PARTIDA</h4><div class="sum">' + [
      ['MAPA', (this.step + 1) + ' / ' + ROUTE_LEN + ' · ' + this.stage.name], ['TIEMPO EN EL MAPA', fmtTime(this.stageTime)], ['ENEMIGOS', this.kills], ['DAÑO TOTAL', Math.floor(r.damage)],
      ['GOLPE MÁS FUERTE', Math.floor(r.best)], ['DAÑO RECIBIDO', Math.floor(r.taken)], ['DASHES', r.dashes], ['CÁPSULAS', this.capsOpened],
      ['MALDICIONES', r.curses], ['DESAFÍOS', r.temples + ' (nv ' + this.chal + ')'], ['HABITACIONES DEL TIEMPO', r.rooms], ['ZENI', Math.floor(this.cash)], ['COMBO MÁXIMO', r.maxCombo], ['EVENTOS', r.events], ['TELETRANSPORTES', r.tps], ['TIRADAS DEL GACHAPÓN', r.gachas]].map((x) => row(x[0], x[1])).join('') + '</div>' + this.dmgChart();
    if (p.trait) h += '<h4 class="sh">FORMA · ' + p.form.name + '</h4><div class="trait"><b>' + p.trait.name + '</b><span class="trg">✚ ' + p.trait.good + '</span><span class="trb">✖ ' + p.trait.bad + '</span></div>';
    const fl = fusionsFor(p.ch.id).filter((f) => WEAPONS[f].fusion.every((x) => techOwned(x, this.practice)));
    if (fl.length) h += '<h4 class="sh">FUSIONES (LAS DOS TÉCNICAS AL NV 5)</h4><div class="chips">' + fl.map((f) => {
      const F = WEAPONS[f], done = this.weapons.get(f);
      return '<span class="' + (done ? 'bf' : '') + '" title="' + (F.down ? 'Desventaja: ' + F.down.text : '') + '">' + (done ? '✔ ' : '') + F.fusion.map((x) => WEAPONS[x].name + (done ? '' : ' ' + this.weapons.levelOf(x) + '/5')).join(' + ') + ' → ' + F.name + '</span>';
    }).join('') + '</div>';
    if (this.modList.length) h += '<h4 class="sh">DESAFÍO DIARIO</h4><div class="chips">' + this.modList.map((m) => '<span class="bf">' + m.icon + ' ' + m.name + '</span>').join('') + '</div>';
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
    }).join('') + '</div>' + this.catLine(by, tot);
  }
  /** Reparto del daño de la partida entre técnicas físicas y de ki */
  catLine(by, tot) {
    let f = 0, k = 0;
    for (const id in by) { const c = srcCat(id); if (c === 'fis') f += by[id]; else if (c === 'ki') k += by[id]; }
    if (!f && !k) return '';
    return '<p class="dcat"><span class="tcat tf">✊ FÍSICO ' + fmtK(f) + ' · ' + Math.round(f / tot * 100) + '%</span> <span class="tcat tk">✺ KI ' + fmtK(k) + ' · ' + Math.round(k / tot * 100) + '%</span></p>';
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
  /** Impact frame de los momentos grandes. `cd`: segundos sin otro impacto de este tipo (para no saturar); 0 = siempre */
  impact(t, cd) {
    if (this.state !== 'play' && this.state !== 'transform') return;
    if (cd && this.impCd2 > 0) return;
    if (cd) this.impCd2 = cd;
    this.impT = Math.max(this.impT, t); this.hitstop = Math.max(this.hitstop, t * 0.5);
  }
  /** Impact frame en los críticos grandes (con enfriamiento para no saturar) */
  /** Micro-parón de impacto (críticos de las ráfagas, golpes que recibes): como mucho uno cada 1,2 s.
      Antes cada crítico congelaba el juego 0,04 s: al final de la partida eran ~2 parones por segundo y se notaba como lag */
  microStop(t) {
    if (this.hsCd > 0) return;
    this.hsCd = 1.2; this.hitstop = Math.max(this.hitstop, t);
  }
  /** Aviso flotante de eficacia («¡EFICAZ!» / «RESISTE») sobre el enemigo golpeado: como mucho uno cada 0,5 s */
  effHint(x, z, sc, weak, cat) {
    if (this.effCd > 0 || !this.ui.floatText) return;
    this.effCd = 0.5;
    this.ui.floatText(x, 2.4 * sc + 0.6, z, weak ? '¡EFICAZ!' : 'RESISTE', weak ? (cat === 'fis' ? '#ffb040' : '#5ad8ff') : '#aab2c0', weak);
  }
  onCrit(dmg) {
    if (this.impCd > 0 || this.state !== 'play' || dmg < 30 * this.player.damageMul()) return;
    this.impCd = 2.5; this.impT = 0.14;
    this.hitstop = Math.max(this.hitstop, 0.07); this.shake(0.5);
    SFX.play('crit');
    this.ui.toast('¡CRÍTICO! ' + fmtK(dmg), true);
  }

  /* ---------- Modo Historia: capítulo con objetivo, rival, portada, diálogos y estrellas ---------- */
  /** Prepara el capítulo tras cargar el mapa: rival, dificultad del libro, nivel inicial y contadores */
  storySetup() {
    const SG = this.saga, p = this.player, B = chapBoss(SG);
    this.step = Math.min(1, SG.book.tier);                            // los libros avanzados empiezan con enemigos algo más duros
    // El mapa se usa como escenario: su daño se limita según el libro y siempre hay horda (la Dimensión Fracturada normalmente no tiene)
    const S0 = this.stage;
    this.stage = Object.assign({}, S0, { dmg: Math.min(S0.dmg, 1.1 + SG.book.tier * 0.1), hp: Math.min(S0.hp, 1.2 + SG.book.tier * 0.25), spawn: S0.spawn || 1.1 });
    if (B) {
      const sh = B.fighter && this.ui.sheets ? this.ui.sheets[B.sheet] : null;
      const scaleW = B.fighter ? B.scale * (3.6 / 2.9) * ((sh && sh.hs) || 1) : B.scale;   // luchador: tamaño relativo al jugador
      this.stage.boss = Object.assign({}, B, { hp: 4000 * (1 + SG.book.idx * 0.5 + SG.idx * 0.08) * (SG.hp || 1),   // vida según el punto de la historia, no según el mapa
        id: typeof SG.boss === 'string' ? SG.boss : 'chap', scaleW });
      const T = ENEMY_TYPES[T_BOSS];
      T.name = B.name; T.tint = B.tints[0]; T.scale = scaleW; T.r = B.r; this.horde.tints[T_BOSS] = B.tints[0];
      this.ui.el.bossName.textContent = B.name;
    }
    if (SG.lvl > 1) {                                                 // el capítulo empieza a cierto nivel (y algunas mejoras para elegir)
      p.level = SG.lvl; p.xp = 0; p.xpNext = p.xpFor(SG.lvl);
      // Vida acorde al nivel (en una partida normal ya habrías cogido mejoras de vida por el camino)
      p.maxHp = Math.round(p.maxHp * (1 + (SG.lvl - 1) * 0.025)); p.hp = p.maxHp;
      this.pendingLevels = Math.min(4, Math.floor((SG.lvl - 1) / 3));
      // Equipo inicial acorde al nivel (como si vinieras de una partida): sus técnicas propias ya aprendidas
      const C = p.ch, lv = SG.lvl;
      for (let k = 0; k < Math.min(3, Math.floor(lv / 10)); k++) this.weapons.add(C.start[0]);
      for (const id of C.unique || []) {
        const W = WEAPONS[id], m = (W && W.minLv) || 2;
        if (!W || id === C.start[0] || W.fusion || W.shop || m > lv) continue;
        for (let k = 0, n = clamp(1 + Math.floor((lv - m) / 8), 1, 3); k < n; k++) this.weapons.add(id);
      }
      this.checkTransformation();
    }
    this.sagaGoal = false; this.sagaBegun = false; this.sagaT = 0; this.sagaTalked = false; this.sagaHunt = 0; this.sagaHuntT = 3;
    this.sagaTour = false; this.sagaTourT = 0; this.nextChap = null;
  }
  /** Portada del capítulo (libro, número, título y el «VS»); se salta con cualquier tecla o clic */
  showChapCard() {
    const SG = this.saga, el = document.getElementById('chapCard'), B = chapBoss(SG), ui = this.ui;
    if (!el) { this.talk(SG.intro, () => this.sagaBegin()); return; }
    el.style.setProperty('--b1', SG.book.col); el.style.setProperty('--b2', SG.book.col2);
    el.innerHTML = '<div class="cc"><small>Libro ' + (SG.book.idx + 1) + ' · ' + nice(SG.book.name) + '</small><em>Capítulo ' + (SG.idx + 1) + '</em><b>' + SG.name + '</b>' +
      '<div class="ccvs"><span class="cvl">' + ui.storyPic(charById(SG.ch)) + '</span><i>VS</i><span class="cvr">' + (B ? ui.bossPic(B) : '<u>☠</u>') + '</span></div>' +
      '<p>◎ ' + SG.goal.text + '</p><span class="ccs">' + STAGES[SG.stage].name + '</span></div><span class="cck">' + (document.documentElement.classList.contains('touch') ? 'Toca la pantalla para continuar' : 'Pulsa cualquier tecla para continuar') + '</span>';
    ui.drawPics(el);
    el.classList.remove('out'); el.classList.add('show');
    this.state = 'chapcard'; this.releaseMouse(); SFX.play('event');
    this.chapCardT = setTimeout(() => this.endChapCard(), 3600);
    el.onclick = () => this.endChapCard();
  }
  endChapCard() {
    if (this.state !== 'chapcard') return;
    clearTimeout(this.chapCardT);
    const el = document.getElementById('chapCard');
    el.classList.add('out'); setTimeout(() => el.classList.remove('show', 'out'), 350);
    this.state = 'play';
    this.talk(this.saga.intro, () => this.sagaBegin());
  }
  /** Empieza el objetivo: el rival aparece ya en los capítulos de combate; luego las mejoras del nivel inicial */
  sagaBegin() {
    const SG = this.saga, G = SG.goal;
    this.sagaBegun = true; this.clock.getDelta();
    this.ui.toast(SG.name.toUpperCase()); this.ui.toast('◎ ' + G.text, true);
    if (G.type === 'boss' || G.type === 'hold') { if (G.type === 'boss') this.sagaGoal = true; this.spawnBoss(); }
    if (this.pendingLevels > 0) this.openLevelUp(); else this.resume();
  }
  /** Valor actual del objetivo (para el marcador y para saber si se cumplió) */
  sagaValue() {
    const G = this.saga.goal;
    return G.type === 'kills' ? this.kills : G.type === 'balls' ? this.pickups.collected : G.type === 'survive' || G.type === 'hold' ? this.sagaT
      : G.type === 'hunt' ? this.sagaHunt : G.type === 'level' ? this.player.level : G.type === 'tourney' ? (this.sagaTour ? 1 : 0) : 0;
  }
  /** Progreso del objetivo en texto corto (marcador de arriba y fila del HUD) */
  sagaProg() {
    const G = this.saga.goal, v = this.sagaValue(), n = G.n || 1;
    if (this.sagaGoal && G.type !== 'hold') return this.bossUid ? '¡DERROTA A ' + this.stage.boss.name + '!' : '¡CUMPLIDO!';
    return G.type === 'survive' || G.type === 'hold' ? fmtTime(Math.max(0, n - v)) : G.type === 'tourney' ? 'COMBATE ' + Math.min((this.tourney ? this.tourney.wins : 0) + 1, 3) + '/3' : Math.min(v, n) + ' / ' + n;
  }
  updateSaga(dt) {
    const SG = this.saga, L = this.ui.el.sagaLbl || (this.ui.el.sagaLbl = document.getElementById('sagaLbl'));
    if (!SG) { if (L && L.classList.contains('show')) L.classList.remove('show'); return; }
    if (!this.sagaBegun) return;
    this.sagaT += dt;
    const G = SG.goal, v = this.sagaValue(), n = G.n || 1;
    if (L) {                                                          // el objetivo arriba (con el jefe en pantalla, su barra ya lo dice)
      const show = !this.bossUid || this.horde.indexOfUid(this.bossUid) < 0;
      L.classList.toggle('show', show);
      const txt = '☆ ' + G.text.toUpperCase() + ' · ' + this.sagaProg();
      if (show && L._t !== txt) { L._t = txt; L.textContent = txt; }
    }
    if (this.sagaGoal) return;
    if (G.type === 'hunt') {                                          // los objetivos de caza aparecen poco a poco (hasta 2 a la vez)
      this.sagaHuntT -= dt;
      if (this.sagaHuntT <= 0) {
        this.sagaHuntT = G.every || 7;
        let alive = 0; for (let i = 0; i < this.horde.n; i++) if (this.horde.type[i] === G.t) alive++;
        if (alive < 2) {
          this.spawnPos(16, 24);
          const i = this.horde.spawn(this._sx, this._sz, (14 + this.pressure() * 0.25) * ENEMY_TYPES[G.t].hp * this.diff.hp * this.stage.hp * this.timeMul() * (G.hp || 2), G.t);
          if (i >= 0) { this.fx.ring(this.fx.aura, this._sx, 0.4, this._sz, 30, 8, 0.5, 0.4, 0xff5a3a); this.ui.toast('¡OBJETIVO A LA VISTA!', true); }
        }
      }
    }
    if (G.type === 'tourney' && !this.tourney && !this.sagaTour) {     // el torneo empieza solo (y se repite si te sacan del ring)
      this.sagaTourT -= dt;
      if (this.sagaTourT <= 0) { this.sagaTourT = 4; if (this.sagaT > 1) this.ui.toast('¡OTRA VEZ AL RING!', true); this.startEvent('torneo'); }
    }
    if (v >= n && G.type !== 'boss') {
      this.sagaGoal = true; this.ui.toast('¡OBJETIVO CUMPLIDO!'); SFX.play('achieve');
      if (G.type === 'hold' || !SG.boss) { this.victory(); return; }
      const go = () => { if (!this.bossSpawned) this.spawnBoss(); };
      if (SG.bossTalk.length) this.talk(SG.bossTalk, go); else go();
    }
  }
  /** Estrellas conseguidas: completar, acabar con la mitad de la vida y la marca del capítulo */
  storyStars() {
    const SG = this.saga, p = this.player;
    const s = [true, p.hp >= p.maxHp * 0.5, SG.star3.kills ? this.kills >= SG.star3.kills : this.time <= SG.star3.time];
    return s;
  }
  storyStarsHtml(st, newOnes) {
    return '<div class="sstars">' + st.map((ok, i) => '<span class="' + (ok ? 'on' : '') + (newOnes && newOnes[i] ? ' nw' : '') + '" style="--d:' + (0.25 + i * 0.3) + 's">★</span>').join('') + '</div>' +
      '<div class="sconds">' + starTexts(this.saga).map((t, i) => '<div class="' + (st[i] ? 'ok' : '') + '"><i>' + (st[i] ? '✓' : '✗') + '</i>' + t + '</div>').join('') + '</div>';
  }
  /** Capítulo ganado: guarda estrellas, da los premios y abre el siguiente (o el libro siguiente) */
  storyWin() {
    const SG = this.saga, B = SG.book, st = this.storyStars(), n = st.filter(Boolean).length;
    const S = Save.d.story || (Save.d.story = {}), prev = S[SG.id] || { stars: 0, best: 0, mask: 0 };
    const wasBook = bookDone(B.idx), first = !prev.stars;
    let mask = prev.mask || 0; const newOnes = st.map((ok, i) => ok && !(mask & (1 << i)));
    st.forEach((ok, i) => { if (ok) mask |= 1 << i; });
    const nStars = [0, 1, 2].filter((i) => mask & (1 << i)).length, gained = nStars - (prev.stars || 0);
    let coins = (first ? SG.reward : 0) + Math.max(0, gained) * 50, prize = '';
    let crys = (first ? 30 : 0) + Math.max(0, gained) * 10;
    this.track('chapters', 1);
    S[SG.id] = { stars: nStars, mask, best: prev.best ? Math.min(prev.best, Math.floor(this.time)) : Math.floor(this.time) };
    if (!wasBook && bookDone(B.idx)) {                                // ¡libro completado!: premio grande
      (Save.d.sagas || (Save.d.sagas = {}))[B.id] = true;
      const C = charById(B.prize);
      if (C && !Save.d.unlocked.includes(C.id)) { Save.d.unlocked.push(C.id); prize = '¡Desbloqueas a ' + nice(C.name) + '!'; }
      else { coins += 1500; prize = '+1500 monedas extra'; }
      crys += 200; prize += ' · +200 cristales';
    }
    Save.d.crystals = (Save.d.crystals || 0) + crys;
    Save.d.zeni += coins;
    const r = this.finishRun(true);
    this.nextChap = SG.idx + 1 < B.chapters.length ? B.chapters[SG.idx + 1] : B.idx + 1 < BOOKS.length && bookDone(B.idx) ? BOOKS[B.idx + 1].chapters[0] : null;
    let h = this.storyStarsHtml(st, newOnes);
    if (prize) h += '<div class="sbook" style="--b1:' + B.col + ';--b2:' + B.col2 + '"><small>¡Libro completado!</small><b>' + nice(B.name) + '</b><span>' + prize + '</span></div>';
    h += '<div class="reward">+' + (coins + r.coins) + ' MONEDAS<small>' + (first ? SG.reward + ' por completar el capítulo · ' : '') + (gained > 0 ? gained * 50 + ' por estrellas nuevas · ' : '') + r.coins + ' de la partida</small></div>' + (crys + (r.crys || 0) ? '<div class="crew">+' + (crys + (r.crys || 0)) + ' CRISTALES DEL DRAGÓN</div>' : '');
    h += '<div class="sum">' + [['ENEMIGOS', this.kills], ['TIEMPO', fmtTime(this.time)], ['NIVEL', this.player.level], ['DAÑO TOTAL', Math.floor(this.run.damage)]].map((x) => '<div><span>' + x[0] + '</span><b>' + x[1] + '</b></div>').join('') + '</div>';
    const nx = this.nextChap, aT = nx ? (nx.book === B ? 'SIGUIENTE CAPÍTULO [R]' : 'SIGUIENTE LIBRO [R]') : 'REPETIR [R]';
    this.ui.showScreen(prize ? '¡LIBRO COMPLETADO!' : '¡CAPÍTULO COMPLETADO!', nice(B.name) + ' · Capítulo ' + (SG.idx + 1) + ': ' + SG.name, h, aT, 'VOLVER AL LIBRO [M]', 'win story');
    if (prize) setTimeout(() => Shenron.summon({ kicker: '¡Libro completado!', title: nice(B.name), sub: 'Has terminado la saga. Shenron te concede:', html: '<span class="big">' + prize + '</span>', btn: '¡Siguiente libro!' }), 400);
  }
  storyLoseHtml(r) {
    const SG = this.saga, G = SG.goal, v = this.sagaValue(), n = G.n || 1;
    const prog = G.type === 'boss' || (this.sagaGoal && SG.boss) ? '¡Casi! El rival seguía en pie' : G.text + ' · ' + (G.type === 'survive' || G.type === 'hold' ? fmtTime(Math.min(v, n)) + ' de ' + fmtTime(n) : Math.min(v, n) + ' de ' + n);
    return '<div class="sbook lose"><small>Objetivo</small><b>' + prog + '</b><span>Consejo: sube de nivel con las cartas y usa [G] para transformarte</span></div>' +
      '<div class="reward">+' + r.coins + ' MONEDAS<small>las monedas de la partida se quedan</small></div>' + (r.crys ? '<div class="crew">+' + r.crys + ' CRISTALES DEL DRAGÓN</div>' : '') +
      '<div class="sum">' + [['ENEMIGOS', this.kills], ['TIEMPO', fmtTime(this.time)], ['NIVEL', this.player.level], ['DAÑO TOTAL', Math.floor(this.run.damage)]].map((x) => '<div><span>' + x[0] + '</span><b>' + x[1] + '</b></div>').join('') + '</div>';
  }
  /** Diálogo: líneas [quién, texto]. El mundo se congela; E, Espacio, Intro, clic o el mando para avanzar */
  talk(lines, cb) {
    if (!lines || !lines.length) { if (cb) cb(); return; }
    this.talkQ = lines.slice(); this.talkCb = cb || null; this.talkHeld = true;
    const el = document.getElementById('talk');
    if (!el.onclick) el.onclick = () => this.talkNext();
    el.classList.add('show'); this.state = 'talk'; this.releaseMouse();
    this.talkLine();
  }
  talkLine() {
    const [who, text] = this.talkQ[0], c = charById(who), N = !c && typeof TALK_NPC !== 'undefined' ? TALK_NPC[who] : null;
    // Tu personaje habla a la izquierda; los demás, a la derecha. Sin retrato (Kaiosama, Bulma, el narrador…) va un emblema
    const el = document.getElementById('talk'), me = this.saga ? this.saga.ch : this.player.ch.id;
    el.classList.toggle('r', who !== me); el.classList.toggle('np', !c); el.classList.toggle('nr', who === 'narr');
    document.getElementById('talkName').textContent = c ? c.name : N ? N.name : who.toUpperCase();
    document.getElementById('talkIco').textContent = N ? N.ico : '?';
    const cv = document.getElementById('talkPic'), g2 = cv.getContext && cv.getContext('2d');
    if (c && c.portrait) this.ui.drawFrame(cv, c.portrait.sheet, c.portrait.frame, c.portrait.tint); else if (g2) g2.clearRect(0, 0, cv.width, cv.height);
    this.talkText = text; this.talkT = 0; document.getElementById('talkText').textContent = '';
  }
  talkNext() {
    if (this.state !== 'talk') return;
    if (this.talkT * 45 < this.talkText.length) { this.talkT = 99; return; }   // primer toque: termina de escribir la frase
    this.talkQ.shift();
    if (this.talkQ.length) { this.talkLine(); return; }
    document.getElementById('talk').classList.remove('show');
    this.state = 'play'; this.grabMouse(); this.clock.getDelta();
    const cb = this.talkCb; this.talkCb = null; if (cb) cb();
  }
  updateTalk(dt) {
    this.talkT += dt;
    const n = Math.min(this.talkText.length, Math.floor(this.talkT * 45));      // efecto de máquina de escribir
    const el = document.getElementById('talkText'); if (el.textContent.length !== n) el.textContent = this.talkText.slice(0, n);
    const k = !!(keys.KeyE || keys.Space || keys.Enter || keys.NumpadEnter);
    if (k && !this.talkHeld) this.talkNext();
    this.talkHeld = k;
    this.player.animT += dt; this.player.pose(); this.fx.update(dt); this.syncSprites(); this.updateCamera(dt, dt, false); this.ui.update(this, dt);
  }
  /* ---------- Torneo de las Artes Marciales: ring, tres rivales seguidos, salir del ring decide ---------- */
  updateTourney(dt) {
    const T = this.tourney, L = this.ui.el.tourLbl || (this.ui.el.tourLbl = document.getElementById('tourLbl'));
    if (!T) { if (L && L.classList.contains('show')) L.classList.remove('show'); return; }
    const p = this.player, h = this.horde;
    T.fxT -= dt;
    if (T.fxT <= 0) {                                                // el borde del ring: un círculo de luz dorada
      T.fxT = 0.07; T.rot = (T.rot || 0) + 0.05;
      for (let k = 0; k < 40; k++) { const a = T.rot + k * 0.15708; this.fx.trail.emit(T.x + Math.cos(a) * T.r, 0.12, T.z + Math.sin(a) * T.r, 0, 0.9, 0, 0.6, 0.42, 0, 0xffd060); }   // 40 puntos repartidos que giran
    }
    const F = TOUR_FIGHTERS[Math.min(T.wins, 2)];
    if (L) { L.classList.add('show'); L.textContent = '♛ TORNEO · COMBATE ' + Math.min(T.wins + 1, 3) + '/3 · ' + F.name + ' · ¡NO SALGAS DEL RING!'; }
    if (Math.hypot(p.x - T.x, p.z - T.z) > T.r + 0.6) { this.endTourney(false); return; }
    if (!T.uid) { T.next -= dt; if (T.next <= 0) this.tourneyFight(); return; }
    const i = h.indexOfUid(T.uid);
    if (i < 0 || h.hp[i] <= 0) { T.uid = 0; this.tourneyWin(false); return; }
    if (Math.hypot(h.x[i] - T.x, h.z[i] - T.z) > T.r + 0.6) {        // ¡fuera del ring!
      DMG_SRC = 'otros'; h.hurt(i, h.hp[i] + 1, 0, 0, this, true); T.uid = 0; this.tourneyWin(true);
    }
  }
  tourneyFight() {
    const T = this.tourney, F = TOUR_FIGHTERS[T.wins], p = this.player;
    const dx = T.x - p.x, dz = T.z - p.z, d = Math.hypot(dx, dz) || 1;   // aparece al otro lado del ring
    const x = T.x + (dx / d) * 6, z = T.z + (dz / d) * 6;
    const hp = (14 + this.pressure() * 0.25) * ENEMY_TYPES[F.type].hp * this.diff.hp * this.stage.hp * this.timeMul() * F.mul;
    const i = this.horde.spawn(x, z, hp, F.type);
    if (i >= 0) T.uid = this.horde.uid[i];
    this.fx.ring(this.fx.aura, x, 0.5, z, 40, 14, 0.6, 0.4, 0xffd060); SFX.play('stinger');
    this.ui.toast('COMBATE ' + (T.wins + 1) + ' / 3: ' + F.name);
  }
  tourneyWin(out) {
    const T = this.tourney; T.wins++;
    this.ui.toast(out ? '¡FUERA DEL RING! · COMBATE GANADO' : '¡COMBATE GANADO!', true); SFX.play('combo');
    if (T.wins >= 3) this.endTourney(true); else T.next = 2.2;
  }
  endTourney(win) {
    const T = this.tourney, p = this.player; if (!T) return;
    this.tourney = null;
    if (win) {
      this.capsules.add(T.x + 1.5, T.z, 1, this.world); this.capsules.add(T.x - 1.5, T.z, 1, this.world);
      this.gainCash(400); p.hp = p.maxHp; this.track('torneos', 1); if (this.saga) this.sagaTour = true;
      this.ui.toast('♛ ¡CAMPEÓN DEL TORNEO!'); this.ui.toast('Premio: 2 cápsulas doradas, 400 Zeni y vida al máximo', true); SFX.play('win');
      this.fx.ring(this.fx.aura, T.x, 0.5, T.z, 90, 26, 0.9, 0.5, 0xffd060); this.shake(0.6);
    } else { this.ui.toast('¡HAS SALIDO DEL RING!'); this.ui.toast('Pierdes el torneo · la horda vuelve', true); SFX.play('lose'); }
  }
  /* ---------- Radar del Dragón: distancia a la esfera más cercana y pitidos más rápidos al acercarte ---------- */
  updateRadar(dt) {
    const pk = this.pickups, p = this.player; let d = 1e9;
    for (let i = 0; i < 7; i++) if (!pk.got[i]) d = Math.min(d, Math.hypot(pk.bx[i] - p.x, pk.bz[i] - p.z));
    this.ballDist = d;
    if (d > 150) return;
    this.radarT = (this.radarT || 0) - dt;
    if (this.radarT <= 0) {
      this.radarT = clamp(0.1 + d / 55, 0.12, 2.6);            // de un pitido cada 2,6 s (lejos) a casi continuo (encima)
      SFX.play(d < 15 ? 'radar2' : 'radar');
      const el = this.ui.el.balls; if (el) { el.classList.remove('ping'); void el.offsetWidth; el.classList.add('ping'); }
    }
  }
  /* ---------- Rival con memoria: recuerda con qué tipo de técnica lo venciste y se prepara contra ella ---------- */
  rivalCat(src) {
    if (src === 'ult') return 'ult';
    const k = WEAPONS[src] && WEAPONS[src].kind;
    if (!k) return 'explosiones';
    if (['beam', 'bigbeam', 'ray', 'pbolt'].includes(k)) return 'rayos';
    if (['scythe', 'godslash', 'rush', 'quake', 'whirl', 'meteor', 'orbit', 'kiplanet', 'barrier', 'minions'].includes(k)) return 'cuerpo';
    if (['bullet', 'blast', 'homing', 'barrage', 'discs', 'zshot', 'fan', 'splitblast', 'rain', 'hellzone'].includes(k)) return 'rafagas';
    return 'explosiones';
  }
  /** «tu técnica Kamehameha» / «tu Ultimate» (vale también para nombres en plural, como Bolas de Ki) */
  rivalWName(w) { return w === 'ult' || !w || !WEAPONS[w] ? 'tu Ultimate' : 'tu técnica ' + WEAPONS[w].name; }
  rivalTaunt(M) {
    if (M.beatMe) return '«¿Vuelves a por más? La última vez te derroté.»';
    const n = this.rivalWName(M.topW);
    if (M.counter === 'rayos') return '«¡Esta vez ' + n + ' no me servirá!» · Resiste los rayos';
    if (M.counter === 'cuerpo') return '«¡No volverás a acercarte a mí!» · Ataca a distancia';
    if (M.counter === 'rafagas') return '«¡Mi escudo parará ' + n + '!» · Escudo contra ráfagas';
    if (M.counter === 'ult') return '«¡Tu Ultimate ya no me hará nada!» · Resiste la Ultimate';
    if (M.counter === 'explosiones') return '«¡Tus explosiones ya no me asustan!» · Resiste las explosiones';
    return 'Derrótalo: suelta una cápsula dorada';
  }
  /** Golpe al rival: apunta el daño por tipo de técnica y aplica su resistencia (rayos, explosiones o Ultimate) */
  rivalHit(dmg) {
    const c = this.rivalCat(DMG_SRC), M = this.rivalMem;
    if (M && M.counter === c && c !== 'cuerpo' && c !== 'rafagas') dmg *= 0.6;
    this.rivalDmg[c] = (this.rivalDmg[c] || 0) + dmg; this.rivalByW[DMG_SRC] = (this.rivalByW[DMG_SRC] || 0) + dmg;
    return dmg;
  }
  /** Contra el cuerpo a cuerpo: se aparta si te acercas y dispara abanicos de ki */
  updateRival(dt) {
    const M = this.rivalMem; if (!this.rivalUid || !M || M.counter !== 'cuerpo') return;
    const h = this.horde, p = this.player; let i = -1;
    for (let j = 0; j < h.n; j++) if (h.uid[j] === this.rivalUid) { i = j; break; }
    if (i < 0) return;
    const dx = h.x[i] - p.x, dz = h.z[i] - p.z, d = Math.hypot(dx, dz) || 1;
    if (d < 8) { h.kx[i] += (dx / d) * 60 * dt; h.kz[i] += (dz / d) * 60 * dt; }
    this.rivalShotT -= dt;
    if (this.rivalShotT <= 0 && d < 24) {
      this.rivalShotT = Math.max(1.2, 2.4 - M.lvl * 0.15);
      for (const o of [-0.25, 0, 0.25]) { const c = Math.cos(o), s = Math.sin(o), ux = -dx / d, uz = -dz / d;
        this.shots.fire(h.x[i], h.z[i], ux * c - uz * s, ux * s + uz * c, 15, this.enemyDamage() * 0.9, { tint: 0xc070ff, size: 1.7 }); }
    }
  }
  /* ---------- Fusión en tiempo real: con tu pareja de fusión cerca, [E] os fusiona durante FUSION_TIME s ---------- */
  fusionAlly() {
    const p = this.player, P = FUSION_PAIRS[p.ch.id];
    if (!P || p.fusion || p.dying || this.state !== 'play') return null;
    for (const a of this.allies.list) if (P[a.d.id] && Math.hypot(a.x - p.x, a.z - p.z) < 4.5) return a;
    return null;
  }
  startFusion(a) {
    const p = this.player, id = pick(FUSION_PAIRS[p.ch.id][a.d.id]), F = CHARACTERS.find((c) => c.id === id);
    if (!F) return;
    const i = this.allies.list.indexOf(a); if (i >= 0) this.allies.list.splice(i, 1);   // el aliado se funde contigo
    // Forma de la fusión equivalente a la tuya (base con base, la más alta con la más alta)
    const n = F.forms.length, k = Math.min(n - 1, Math.round(p.formIdx * (n - 1) / Math.max(1, p.ch.forms.length - 1)));
    p.fusion = { id, ch: F, sheet: F.forms[k].sheet, anim: F.forms[k].anim, t: FUSION_TIME, warned: false }; p.batch(p.fusion.sheet);
    const go = () => { this.ui.toast('¡' + F.name + '!'); this.ui.toast('Fusión: +40% de daño, +20% de velocidad y su Ultimate durante ' + FUSION_TIME + ' s', true); };
    if (this.intro.has(id) && !Save.d.opt.noCine) {                 // cinemática de la fusión (Vegetto, Gogeta, Zamasu fusionado)
      this.state = 'intro'; this.releaseMouse();
      this.intro.start(id, () => { if (this.state !== 'intro') return; this.state = 'play'; this.grabMouse(); this.clock.getDelta(); go(); });
    } else {                                                        // sin cinemática (Kefla): destello y onda
      const c = F.forms[k].aura || F.forms[k].ki || 0xffffff;
      if (this.vfx && this.vfx.ok) this.vfx.flash(p.x, 1.6, p.z, 8, c);
      this.fx.ring(this.fx.aura, p.x, 0.5, p.z, 70, 24, 0.8, 0.5, c); this.horde.shockwave(p.x, p.z, 9, 22);
      this.shake(1.2); SFX.play('bigboom'); go();
    }
  }
  updateFusion(dt) {
    const p = this.player, f = p.fusion; if (!f) return;
    f.t -= dt;
    if (f.t <= 5 && !f.warned) { f.warned = true; this.ui.toast('LA FUSIÓN SE AGOTA · 5 S', true); }
    if (f.t <= 0) {
      p.fusion = null;
      this.fx.ring(this.fx.aura, p.x, 0.5, p.z, 50, 16, 0.6, 0.4, 0xffffff); this.shake(0.5); SFX.play('pulse');
      this.ui.toast('LA FUSIÓN SE DESHACE', true);
      if (p.ultD && p.ult > p.ultD.cost) p.ult = p.ultD.cost;
    }
  }
  /* ---------- Transmisión Instantánea y esquiva del Ultra Instinto ---------- */
  onTeleport(ox, oz, x, z) {
    const p = this.player, col = p.form.ki;
    this.run.tps++; this.track('tps', 1);
    this.fx.burst(this.fx.trail, ox, 1.2, oz, 18, 6, 0.4, 0.4, 0, col);
    this.fx.ring(this.fx.aura, x, 0.5, z, 30, 12, 0.35, 0.35, col);
    DMG_SRC = 'tp'; this.horde.damageRadius(x, z, 3.2, 14 * p.damageMul(), 12, this); DMG_SRC = 'otros';
    this.vfx.flash(ox, 1.6, oz, 4, col); this.vfx.flash(x, 1.6, z, 5, col); this.vfx.play('kameStar', x, 1.6, z, { size: 6, fps: 16 });
    this.shake(0.3); SFX.play('tp');
  }
  onAutoDodge() {
    const p = this.player;
    p.spawnGhost(); p.ghostT = 0;
    DMG_SRC = 'counter'; this.horde.damageRadius(p.x, p.z, 4, 25 * p.damageMul(), 14, this); DMG_SRC = 'otros';
    this.fx.burst(this.fx.trail, p.x, 1.2, p.z, 10, 6, 0.3, 0.35, 0, 0xdff4ff);
    SFX.play('dash');
    if (this.dodgeMsgT <= 0) { this.dodgeMsgT = 1.5; this.ui.toast('ESQUIVA · CONTRAATAQUE', true); }
  }
  /** El kamikaze explota contra ti (se resuelve después de recoger las bajas, con la rejilla al día) */
  onKamikaze(x, z) { this.booms.push({ x, z, self: true }); }
  kamikazeChain(x, z) { this.booms.push({ x, z, self: false }); }
  resolveBooms() {
    const p = this.player;
    for (const b of this.booms) {
      if (b.self) {
        const dx = p.x - b.x, dz = p.z - b.z;
        if (dx * dx + dz * dz < 3.4 * 3.4) p.takeDamage(this.enemyDamage() * ENEMY_TYPES[T_BOOM].dmg, this);
        DMG_SRC = 'otros'; this.horde.damageRadius(b.x, b.z, 3.2, 20, 8, this);
      } else { DMG_SRC = 'chain'; this.horde.damageRadius(b.x, b.z, 3.6, 30 * p.damageMul(), 10, this); }
      this.fx.burst(this.fx.sparks, b.x, 1, b.z, 18, 9, 0.45, 0.4, 6, 0x9aff4a);
      this.fx.ring(this.fx.aura, b.x, 0.4, b.z, 20, 10, 0.35, 0.35, 0x6aff3a);
      this.vfx.boom(b.x, b.z, 2.4, 0x9aff4a, false);
      SFX.play('boom');
    }
    DMG_SRC = 'otros';
    this.booms.length = 0;
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
    } else if (k === 'torneo') {                                         // Torneo de las Artes Marciales
      if ((this.bossUid && this.horde.indexOfUid(this.bossUid) >= 0) || this.roomT > 0 || this.tourney) { this.startEvent('ally'); return; }
      this.horde.reset(); this.rivalUid = 0;                          // la horda se retira: solo tú y tus rivales
      this.tourney = { x: p.x, z: p.z, r: TOUR_R, uid: 0, next: 2, wins: 0, fxT: 0 };
      this.fx.ring(this.fx.aura, p.x, 0.3, p.z, 90, TOUR_R * 1.6, 0.9, 0.5, 0xffd060); this.shake(0.5);
      ui.toast('♛ TORNEO DE LAS ARTES MARCIALES');
      ui.toast('3 combates · saca al rival del ring y ganas · si sales tú, pierdes', true);
      return;
    } else if (k === 'rival') {
      const M = Save.d.rival || (Save.d.rival = { lvl: 0, counter: '', topW: '', beatMe: false });   // memoria entre partidas
      this.rivalMem = Object.assign({}, M); this.rivalDmg = {}; this.rivalByW = {}; this.rivalShotT = 2;
      this.spawnPos(20, 26);
      const i = this.horde.spawn(this._sx, this._sz, (14 + this.pressure() * 0.25) * ENEMY_TYPES[4].hp * this.diff.hp * this.stage.hp * this.timeMul() * 6 * (1 + 0.3 * M.lvl), 4);
      if (i >= 0) {
        this.rivalUid = this.horde.uid[i];
        if (M.counter === 'rafagas') this.horde.shield[i] = 6 + M.lvl * 2;        // contra tus ráfagas: escudo
      }
      ui.toast(M.lvl ? '¡TU RIVAL VUELVE! · NV ' + (M.lvl + 1) : '¡UN RIVAL TE RETA!');
      ui.toast(this.rivalTaunt(M), true);
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
    const st = Save.d.stats, r = this.run, live = { maxCombo: r.maxCombo, bestHit: r.best, maxStage: this.step + 1 };
    for (const a of ACHIEVEMENTS) {
      if (Save.d.ach[a.id]) continue;
      const v = Math.max(st[a.stat] || 0, live[a.stat] || 0);
      if (v < a.goal) continue;
      Save.d.ach[a.id] = true; Save.d.zeni += a.reward; Save.d.crystals = (Save.d.crystals || 0) + 30; Save.write();
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
    if (this.practice) return { coins: 0, bonus: 0, score: 0, crys: 0 };    // el entrenamiento no da recompensas
    let coins = Math.floor(this.zeniRun * d.coins), bonus = 0;
    // Cristales del Dragón (gachapón): por aguantar, por jefes y por ganar
    const crys = Math.min(60, Math.floor(this.time / 60) * 3) + this.run.bosses * 5 + (win ? 20 : 0) + (this.modeCry || 0);
    Save.d.crystals = (Save.d.crystals || 0) + crys;
    if (p.ch.summon || (p.ch.forms || []).some((f) => f.gacha)) this.track('sumRuns', 1);   // misión semanal: jugar con el altar
    if (this.mode) {                              // modos de cristales: monedas y misiones, sin ranking ni premio de dificultad
      Save.d.zeni += coins; this.track('runs', 1); this.track('time', Math.floor(this.time)); this.trackMax('maxLevel', p.level);
      if (this.mode === 'rush' && this.modeDone) this.track('rushes', 1);
      const k = 'mode_' + this.mode, b = Save.d.best[k];
      if (!b || this.modeCry > b.cry) Save.d.best[k] = { cry: this.modeCry, time: Math.floor(this.time), bosses: this.gN };
      this.checkAch(); Save.write();
      return { coins, bonus: 0, score: 0, crys, mode: this.mode, modeCry: this.modeCry };
    }
    if (this.saga) {                              // Modo Historia: monedas de la partida (los premios del capítulo van aparte); sin ranking
      Save.d.zeni += coins; this.track('runs', 1); this.track('time', Math.floor(this.time)); this.trackMax('maxLevel', p.level);
      if (win) this.track('wins', 1);
      this.track('damage', Math.floor(this.run.damage)); this.track('taken', Math.floor(this.run.taken)); this.track('dashes', this.run.dashes); this.trackMax('maxCombo', this.run.maxCombo); this.trackMax('bestHit', Math.floor(this.run.best));
      this.checkAch(); Save.write();
      return { coins, bonus: 0, score: 0, crys };
    }
    if (win) {                                    // primera victoria con ese personaje y dificultad = premio completo; después, un 20%
      const key = id + ':' + d.id, first = !Save.d.clears[key];
      bonus = first ? d.reward : Math.round(d.reward * 0.2);
      Save.d.clears[key] = (Save.d.clears[key] || 0) + 1;
      this.track('wins', 1);
    }
    coins += bonus;
    Save.d.zeni += coins;
    this.track('runs', 1); this.track('time', Math.floor(this.time)); this.trackMax('maxLevel', p.level); this.trackMax('maxStage', this.step + 1);
    // Puntuación y ranking local (los 15 mejores)
    const score = runScore({ kills: this.kills, level: p.level, bosses: this.run.bosses, step: this.step, time: Math.floor(this.time), win });
    const prevTop = Save.d.rank.length ? Save.d.rank[0].score : 0;
    Save.d.rank.push({ score, ch: id, kills: this.kills, level: p.level, time: Math.floor(this.time), step: this.step + 1, win: !!win, daily: this.daily, date: todayStr(), diff: d.id });
    Save.d.rank.sort((a, b) => b.score - a.score); Save.d.rank.length = Math.min(Save.d.rank.length, 15);
    let dayBonus = 0;
    if (this.daily) {
      const t = todayStr(), D = Save.d.day && Save.d.day.date === t ? Save.d.day : { date: t, best: 0, tries: 0, done: false };
      D.tries++; D.best = Math.max(D.best, score);
      if (!D.done) { D.done = true; dayBonus = 300; coins += dayBonus; Save.d.zeni += dayBonus; this.track('dailies', 1); }
      Save.d.day = D;
      const h = Save.d.dayHist.find((x) => x.date === t);
      if (h) h.best = Math.max(h.best, score); else Save.d.dayHist.unshift({ date: t, best: score, mods: this.modList.map((m) => m.icon + ' ' + m.name) });
      Save.d.dayHist.length = Math.min(Save.d.dayHist.length, 14);
    }
    this.track('damage', Math.floor(this.run.damage)); this.track('taken', Math.floor(this.run.taken)); this.track('dashes', this.run.dashes); this.trackMax('maxCombo', this.run.maxCombo); this.trackMax('bestHit', Math.floor(this.run.best));
    this.checkAch();
    const b = Save.d.best[id];
    if (!b || this.time > b.time) Save.d.best[id] = { time: Math.floor(this.time), kills: this.kills, level: p.level };
    Save.write();
    this.sendOnline({ ch: id, kills: this.kills, level: p.level, bosses: this.run.bosses, step: this.step, time: Math.floor(this.time), win: !!win, diff: d.id, daily: !!this.daily });
    return { coins, bonus, score, record: score > prevTop, dayBonus, crys };
  }
  abandon() { this.finishRun(false); this.toMenu(); }
  /** Sube la partida al ranking mundial (si hay sesión) y escribe el resultado en el resumen */
  sendOnline(run) {
    const on = this.online;
    if (!on.ready || !on.logged) return;
    on.submit(run).then((r) => {
      const el = document.getElementById('onlRes');
      if (!el) return;
      el.className = 'onl ' + (r.ok ? 'ok' : 'off');
      el.textContent = r.ok ? 'RANKING MUNDIAL · tu mejor marca está en el puesto #' + r.rank : r.msg;
    });
  }

  runSummary(r) {
    const rows = [['ENEMIGOS DERROTADOS', this.kills], ['NIVEL ALCANZADO', this.player.level], ['TIEMPO', fmtTime(this.time)],
      ['CÁPSULAS ABIERTAS', this.capsOpened], ['MAPA ALCANZADO', (this.step + 1) + ' / ' + ROUTE_LEN], ['DAÑO TOTAL', Math.floor(this.run.damage)],
      ['GOLPE MÁS FUERTE', Math.floor(this.run.best)], ['DAÑO RECIBIDO', Math.floor(this.run.taken)], ['DASHES', this.run.dashes], ['DIFICULTAD', this.diff.name]];
    let h = '';
    if (!this.practice && !r.mode) h += '<div class="score' + (r.record ? ' rec' : '') + '"><small>' + (r.record ? '¡NUEVO RÉCORD!' : this.daily ? 'PUNTUACIÓN · DESAFÍO DIARIO' : 'PUNTUACIÓN') + '</small><b>' + (r.score || 0).toLocaleString('es-ES') + '</b><span>' + this.run.route.join(' ▸ ') + '</span></div>';
    if (!this.practice && !r.mode && this.online.ready) h += '<div class="onl' + (this.online.logged ? '' : ' off') + '" id="onlRes">' + (this.online.logged ? 'Enviando al ranking mundial…' : 'Inicia sesión en CUENTA para entrar en el ranking mundial.') + '</div>';
    h += '<div class="sum">' + rows.map((x) => '<div><span>' + x[0] + '</span><b>' + x[1] + '</b></div>').join('') + '</div>';
    h += this.dmgChart();
    if (this.practice) return h + '<div class="reward">ENTRENAMIENTO<small>El modo práctica no da monedas ni cuenta para misiones y logros</small></div>';
    h += '<div class="reward">+' + r.coins + ' MONEDAS' + (r.bonus ? '<small>incluye ' + r.bonus + ' de bonificación por completar el nivel</small>' : '') + (r.dayBonus ? '<small>incluye ' + r.dayBonus + ' por terminar el desafío de hoy</small>' : '') + '</div>';
    if (r.crys) h += '<div class="crew">+' + r.crys + ' CRISTALES DEL DRAGÓN' + (r.mode ? '<small>' + r.modeCry + ' de ' + MODES[r.mode].name + '</small>' : '') + '</div>';
    return h;
  }
  /* ---------- Modos de cristales ---------- */
  /** Cada cuadro: reloj de la Lluvia de Cristales y llegada de jefes en el Asalto. true = la partida ha terminado */
  updateMode(dt) {
    if (this.mode === 'rush') {
      const before = Math.ceil(this.modeT); this.modeT -= dt;
      const now = Math.ceil(this.modeT);
      if (now !== before && (now === 60 || now === 30 || now <= 5) && now > 0) { this.ui.toast(now + ' SEGUNDOS', true); SFX.play('warn'); }
      if (this.modeT <= 0) { this.modeDone = true; this.modeCry += RUSH_BONUS; this.rushEnd(); return true; }
    } else if (this.mode === 'gauntlet' && !this.bossSpawned && !this.player.dying) {
      this.gNext -= dt;
      if (this.gNext <= 0) {
        const keys = Object.keys(BOSSES), key = keys[(Math.random() * keys.length) | 0];
        this.stage.boss = Object.assign({ id: '' }, BOSSES[key], { hp: this.stage.bossHp * Math.pow(1.18, this.gN) });
        this.bossDead = false; this.spawnBoss();
        this.ui.toast('JEFE ' + (this.gN + 1) + ' · +' + gauntletCry(this.gN) + ' ◆', true);
      }
    }
    this.ui.modeHud(this);
    return false;
  }
  rushKill(x, z, type) {
    let n = type === T_BOSS ? 25 : type === 4 ? 4 : Math.random() < 0.05 ? 1 : 0;
    n = Math.min(n, RUSH_CAP - this.modeCry);
    if (n <= 0) return;
    this.modeCry += n; this.fx.burst(this.fx.sparks, x, 1.2, z, 6 + n * 2, 6, 0.4, 0.3, 8);
    if (n >= 4) { this.ui.toast('+' + n + ' ◆ CRISTALES', true); SFX.play('coin'); }
  }
  gauntletKill(x, z) {
    const n = gauntletCry(this.gN); this.gN++; this.modeCry += n; this.track('gbosses', 1);
    this.ui.toast('+' + n + ' ◆ · SIGUIENTE JEFE EN 6 S', true);
    this.bossSpawned = false; this.gNext = 6;
  }
  rushEnd() {
    this.won = true; this.state = 'over'; this.releaseMouse(); SFX.music(''); SFX.play('win');
    this.ui.showScreen('¡TIEMPO!', 'LLUVIA DE CRISTALES · HAS AGUANTADO ' + fmtTime(RUSH_TIME), this.runSummary(this.finishRun(false)), 'JUGAR OTRA VEZ [R]', 'MENÚ [M]', 'win');
  }
  gameOver() {
    this.state = 'over'; this.releaseMouse(); SFX.music(''); SFX.play('lose');
    if (this.saga) { const r = this.finishRun(false); this.ui.showScreen('DERROTA', nice(this.saga.book.name) + ' · Capítulo ' + (this.saga.idx + 1) + ': ' + this.saga.name, this.storyLoseHtml(r), 'REINTENTAR [R]', 'VOLVER AL LIBRO [M]', 'lose'); return; }
    this.ui.showScreen('DERROTA', 'HAS CAÍDO EN COMBATE', this.runSummary(this.finishRun(false)), 'REINTENTAR [R]', 'MENÚ [M]', 'lose');
  }
  victory() {
    if (this.saga && !this.sagaTalked) { this.sagaTalked = true; this.talk(this.saga.win, () => this.victory()); return; }
    this.won = true; this.state = 'over'; this.releaseMouse(); SFX.music(''); SFX.play('win');
    this.fx.ring(this.fx.aura, this.player.x, 0.5, this.player.z, 70, 24, 0.9, 0.5, 0xffd24a);
    if (this.saga) { this.storyWin(); return; }
    const sub = 'HAS DERROTADO A ' + this.stage.boss.name + ' · ' + this.diff.name;
    this.ui.showScreen('¡VICTORIA!', sub, this.runSummary(this.finishRun(true)), 'JUGAR OTRA VEZ [R]', 'MENÚ [M]', 'win');
  }

  /* ---------- Formas y efectos ---------- */
  applyForm() {
    const p = this.player;
    this.fx.aura.setColor(p.form.aura || 0xfff2b0);
    this.fx.sparks.setColor(p.form.ki);
  }
  /** Al subir de nivel: si desbloqueas una forma nueva queda DISPONIBLE (tú decides cuándo y cuál) */
  checkTransformation() {
    const p = this.player, opts = p.formOptions().filter((i) => i > p.formIdx && !p.formSeen[i]);
    const ready = opts.length ? opts[opts.length - 1] : -1;
    if (ready >= 0 && p.formReady !== ready) this.ui.toast('¡' + p.ch.forms[ready].name + ' DISPONIBLE!  [G]', true);
    p.formReady = ready;
  }
  /** Se puede usar G: hay alguna forma a la que cambiar y no estás recuperando el aliento */
  canTransform() { const p = this.player, o = p.formOptions(); return this.state === 'play' && !this.cine.on && p.tfCd <= 0 && o.length > 0 && p.ki >= p.tfCost(o[0]); }
  /** G / botón: si solo hay una forma, cinemática directa; si hay varias, eliges con cartas (con sus rasgos) */
  transform() {
    const p = this.player;
    if (this.state !== 'play' || this.cine.on) return;
    if (p.tfCd > 0) { this.ui.toast('RECUPERANDO EL ALIENTO · ' + Math.ceil(p.tfCd) + ' s', true); return; }
    const opts = p.formOptions();
    if (!opts.length) return;
    const cost = p.tfCost(opts[0]);
    if (p.ki < cost) { this.ui.toast('NECESITAS ' + cost + ' DE KI · CARGA CON [C]', true); SFX.play('warn'); return; }
    p.ki -= cost;                                                      // transformarse gasta Ki
    if (opts.length === 1) { this.startCine(opts[0]); return; }
    const list = opts.slice(-4);                                       // las 4 más poderosas
    this.state = 'wish'; this.releaseMouse(); this.cardT = 0;
    this.ui.showCards('TRANSFORMACIÓN', 'ELIGE TU FORMA [1 · 2 · 3 · 4]', list.map((i) => {
      const f = p.ch.forms[i], T = traitOf(p.ch, i);
      return { type: 'form', id: i, icon: '⚡', tag: 'NV ' + f.lvl + ' · DAÑO x' + f.dmg.toFixed(2), title: f.name, text: T ? '<b>' + T.name + '</b><br><span class="trg">✚ ' + T.good + '</span><br><span class="trb">✖ ' + T.bad + '</span>' : '', max: 0, lv: 0 };
    }), (c) => { this.ui.hideCards(); this.state = 'play'; this.startCine(c.id); });
  }
  startCine(idx) {
    this.player.formReady = -1;
    this.state = 'transform';
    this.cine.start(idx);
  }
  /** H: vuelves a la forma base (sin rasgos). Tras destransformarte hay 20 s antes de volver a transformarte */
  revertForm(msg) {
    const p = this.player;
    if (p.formIdx === 0 || (this.state !== 'play' && this.state !== 'transform')) return;
    p.setForm(0); p.recompute(); this.applyForm();
    p.tfCd = 25;
    this.fx.ring(this.fx.aura, p.x, 0.5, p.z, 30, 10, 0.4, 0.35, 0xffffff);
    this.ui.toast(msg || 'VUELVES A TU FORMA BASE', true); SFX.play('revert');
    this.checkTransformation();
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
    if (FXA.capsule) this.vfx.play('capsule', x, 0, z, { size: 3.2, fps: 9, frames: [FXA.capsule.f[1], FXA.capsule.f[2], FXA.capsule.f[4]], fade: true });
    this.vfx.flash(x, 1.4, z, 4 + it.rarity, col);
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
    if (m.weekly) Save.d.weekly.claimed[id] = true; else if (m.daily) Save.d.daily.claimed[id] = true; else Save.d.claimed[id] = true;
    const cr = m.weekly ? m.cry : m.daily ? 20 : 50, zn = m.reward || 0;
    Save.d.zeni += zn; Save.d.crystals = (Save.d.crystals || 0) + cr; Save.write();
    this.ui.renderMenu();
    // Shenron concede el premio
    Shenron.summon({ kicker: m.weekly ? 'Misión semanal cumplida' : m.daily ? 'Misión del día cumplida' : 'Misión cumplida', title: '¡Deseo concedido!', sub: m.name, html: (zn ? '<span class="big">+' + zn + ' monedas</span>' : '') + '<span class="bigc">+' + cr + ' cristales</span>' });
  }
  claimLogin() {
    const l = Save.checkLogin();
    if (l) { Save.d.login = { last: todayStr(), streak: l.streak }; Save.d.zeni += l.reward; Save.d.crystals = (Save.d.crystals || 0) + 50; Save.write(); }
    this.ui.hideModal(); this.ui.renderMenu();
    if (l) Shenron.summon({ kicker: 'Recompensa diaria', title: '¡Di tu deseo!', sub: 'Día ' + l.streak + ' de racha: vuelve mañana y el premio será mayor', html: '<span class="big">+' + l.reward + ' monedas</span><span class="bigc">+50 cristales</span>' });
  }
  /** Seguimiento de misiones: suma al total y al progreso diario */
  track(stat, n) {
    if (this.practice) return;
    const s = Save.d.stats; s[stat] = (s[stat] || 0) + n;
    const p = Save.d.daily.prog; p[stat] = (p[stat] || 0) + n;
    Save.checkWeekly(); const w = Save.d.weekly.prog; w[stat] = (w[stat] || 0) + n;
  }
  trackMax(stat, v) {
    if (this.practice) return;
    const s = Save.d.stats, p = Save.d.daily.prog;
    if (v > (s[stat] || 0)) s[stat] = v;
    if (v > (p[stat] || 0)) p[stat] = v;
  }
  gainCash(v) { this.cash += v * this.player.zeniMul * this.coinMul * (1 + Math.min(this.combo, 100) * 0.005); }   // la racha de combo da hasta +50% de Zeni
  capsuleCost(gold) { return Math.round(20 * Math.pow(1.22, this.capsOpened) * (gold === 2 ? 0.4 : gold ? 1.6 : 1) * (this.mods.rich ? 0.5 : 1)); }
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

  shake(a) { a *= Save.d.opt.shake; this.shakeAmt = Math.min(1.4, Math.max(this.shakeAmt, a)); }
  pressure() { return this.stageTime + this.step * 240; }
  swarmAt() { return this.stage.swarmAt || SWARM_TIME; }
  swarmLvl() { return this.swarm ? 1 + (this.stageTime - this.swarmAt()) / 60 : 0; }          // minutos de enjambre (0 = aún no)
  /** Los enemigos se hacen fuertes con el tiempo: +5% de vida y daño cada 2 minutos en el mapa y, con el enjambre, +2% más por cada minuto que dure */
  timeMul() {
    const t = this.stageTime;
    return 1 + 0.05 * Math.floor(t / 120) + (this.swarm ? 0.02 * Math.floor(Math.max(0, t - this.swarmAt()) / 60) : 0);
  }
  enemyDamage() { return (7 + this.pressure() * 0.03) * this.diff.dmg * this.stage.dmg * (1 + this.curseDmg + this.chal * 0.15) * (1 + Math.max(0, this.swarmLvl() - 1) * 0.15) * this.timeMul(); }

  /** Explosión de área reutilizable (minas, meteoros, Big Bang) */
  explode(x, z, r, dmg, tint) {
    SFX.play('boom');
    if (r >= 9) { this.vfx.boom(x, z, Math.min(r * 0.6, 7), tint, true); this.impact(0.14, 2.5); }   // Genkidama, Death Ball...: impact frame (tamaño acotado: no tapa la pantalla)
    else if (r >= 1.6) this.vfx.boom(x, z, r * 0.75, tint, false);
    if (r >= 1.6) this.vfx.zboom(tint, x, z, Math.min(r * 0.8, 6), r >= 9);   // explosión del pack de su color (acotada: no tapa la pantalla)
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
    if (this.tourney) return;                                         // torneo: sin horda
    const r = Math.random(), t0 = this.pressure(), sw = this.swarmLvl();
    let t;
    if (sw > 0) t = r < 0.04 + sw * 0.015 ? 4 : r < 0.25 + sw * 0.04 ? 2 : r < 0.55 ? 1 : 0;          // el enjambre trae más élites y brutos
    else t = t0 > 45 && r < (0.02 + t0 / 14000) * (this.mods.elite ? 3 : 1) ? 4 : t0 > 90 && r < 0.14 ? 2 : t0 > 35 && r < 0.37 ? 1 : 0;
    // Tipos nuevos: kamikaze (desde el minuto 1), blindados (2) y voladores (2,5). De noche hay más veloces
    if (t === 0) {
      const q = Math.random();
      if (t0 > 60 && q < 0.1 + (this.mods.boom ? 0.25 : 0)) t = T_BOOM;
      else if (t0 > 120 && q < 0.22) t = T_SHIELD;
      else if (t0 > 150 && q < 0.3) t = T_FLY;
      else if (t0 > 180 && q < 0.36) t = T_ABSORB;
      else if (this.night > 0.5 && q < 0.5) t = T_FAST;
      // Tropa nueva: entra poco a poco a partir del minuto y medio (y más a menudo cuanto más avanzas)
      if (t === 0 && t0 > 90 && Math.random() < Math.min(0.6, 0.22 + t0 / 1800)) {
        const L = [T_A18, T_KYABE, T_FROST];
        if (t0 > 150) L.push(T_CAULI, T_KALE);
        if (t0 > 240) L.push(T_MBUU);
        t = pick(L);
      }
    }
    // Variantes nuevas: el soldado élite sale entre los rápidos y el saibaiman de hielo entre la tropa básica
    if (t === T_FAST && t0 > 80 && Math.random() < 0.25) t = T_SOLDIER_E;
    else if (t === 0 && t0 > 100 && Math.random() < 0.12) t = T_ICESAI;
    this.spawnPos(32, 40);
    const hpMul = this.diff.hp * this.stage.hp * (1 + this.curseHp + this.chal * 0.25) * (1 + sw * 0.3) * (this.mods.rich ? 1.3 : 1) * this.timeMul();
    this.horde.spawn(this._sx, this._sz, (14 + t0 * 0.25) * ENEMY_TYPES[t].hp * hpMul, t);
  }
  /** Invoca al jefe del mapa (en el altar, o en un punto fijo en el mapa final) */
  spawnBoss(x, z) {
    const B = this.stage.boss;
    if (x === undefined) { this.spawnPos(26, 30); x = this._sx; z = this._sz; }
    x = clamp(x, -CFG.ARENA, CFG.ARENA); z = clamp(z, -CFG.ARENA, CFG.ARENA);
    // La vida del jefe escala con tu nivel (+2,5% por nivel) para que el combate dure aunque llegues muy fuerte
    const lvMul = 1 + 0.025 * (this.player.level - 1);
    const i = this.horde.spawn(x, z, B.hp * lvMul * this.diff.hp * (1 + this.curseHp * 0.5 + this.chal * 0.15) * (this.mods.bigboss ? 1.5 : 1), T_BOSS);
    if (i >= 0) {
      if (this.bossWeak) { this.bossWeak = false; this.horde.hp[i] *= 0.5; this.ui.toast('¡El castigo de Shenron lo ha debilitado!', true); }
      this.bossUid = this.horde.uid[i]; this.bossSpawned = true;
      this.boss = { t: {}, q: [], gap: 1.2, seen: {}, spiral: 0, spA: 0, spT: 0, spTint: 0, dashW: 0, sd: false };
      this.phase = 0; this.bossInv = 0; ENEMY_TYPES[T_BOSS].spd = 0.62; this.horde.tints[T_BOSS] = B.tints[0];
      // Cada jefe se dibuja con sus sprites: fila propia en la hoja "bosses" (o una fila por forma en la de Goku Black)
      const sh = this.ui.sheets && this.ui.sheets[B.sheet];
      this.horde.setBossSheet(sh || null, B.rows ? B.rows[0] : B.row, bossAnimOf(B.sheet, B.anim || BOSS_ANIM[B.sheet]), B.sheet);
      this.horde.bossTint = B.tintSprite !== false;
      this.ui.toast('¡' + B.name + '!'); this.shake(0.8); SFX.play('boss'); SFX.music('boss');
      if (B.moves) this.ui.toast(B.moves, true);                       // sus técnicas, para saber qué esperar
      if (B.res) this.ui.toast((B.res === 'fis' ? '🛡 ' : '✦ ') + RES_TXT[B.res], true);   // qué tipo de ataque resiste
      this.fx.ring(this.fx.aura, x, 0.5, z, 60, 24, 0.8, 0.5, B.col || B.tints[0]);
      this.vfx.play('flare', x, 7, z, { size: 15, dur: 0.8, pri: 1 }); this.vfx.crater(x, z, 5); this.impact(0.12, 0);
    }
  }
  /** IA del jefe: una fase por cada lista de ataques (3, o 4 en Goku Black) y en cada una sus técnicas (BOSSES[].pat).
      Entre técnica y técnica hay una pausa corta (`gap`) para que cada aviso se lea bien */
  bossAI(dt) {
    const h = this.horde, i = h.indexOfUid(this.bossUid);
    if (i < 0) return;
    const b = this.boss, st = Math.min(this.step, 3), p = this.player, B = this.stage.boss, frac = h.hp[i] / h.maxHp[i];
    const bx = h.x[i], bz = h.z[i], dmg = this.enemyDamage() * 0.8;
    const NP = B.pat.length, target = Math.min(NP - 1, Math.floor((1 - frac) * NP));
    if (target > this.phase) { this.phase = target; this.onBossPhase(bx, bz); }
    const ph = this.phase, pat = B.pat[ph], sp = 1 - ph * (0.45 / NP) - st * 0.05;
    const a = Math.atan2(p.z - bz, p.x - bx);
    // Acciones programadas (ráfagas, rayos en cadena, teletransportes...)
    for (let k = b.q.length - 1; k >= 0; k--) { const q = b.q[k]; q.t -= dt; if (q.t <= 0) { b.q.splice(k, 1); q.f(); } }
    b.gap -= dt;
    for (const k of pat) {
      if (b.t[k] === undefined) b.t[k] = BOSS_CD[k] * 0.4 + rand(0, 1.5);
      b.t[k] -= dt;
      if (b.t[k] > 0 || b.gap > 0) continue;
      b.t[k] = BOSS_CD[k] * sp * rand(0.85, 1.15);
      b.gap = BOSS_GAP[k] !== undefined ? BOSS_GAP[k] : 0.8;
      this.bossMove(k, { i, bx, bz, a, dmg, ph, st, B, NP });
      const nm = (B.names && B.names[k]) || BOSS_MOVE_NAMES[k];                                 // nombre de la técnica (la primera vez, o siempre si es la grande)
      if (nm && (!b.seen[k] || nm[0] === '¡')) { b.seen[k] = true; this.ui.toast(nm, true); }
    }
    // Espiral: dos chorros de disparos que giran
    if (b.spiral > 0) {
      b.spiral -= dt; b.spT -= dt;
      if (b.spT <= 0) { b.spT = 0.09; b.spA += 0.33; for (const o of [0, Math.PI]) this.shots.fire(bx, bz, Math.cos(b.spA + o), Math.sin(b.spA + o), 10, dmg * 0.8, b.spTint ? { tint: b.spTint, size: 2 } : null); }
    }
    // Embestida: tras el aviso sale disparado hacia el jugador
    if (b.dashW > 0) {
      b.dashW -= dt;
      if (b.dashW <= 0) { h.kx[i] = Math.cos(a) * 75; h.kz[i] = Math.sin(a) * 75; this.shake(0.5); SFX.play('dash'); h.posBoss('atk', 0.5); }
    }
  }
  /** Posición actual del jefe (para las acciones programadas: el jefe se mueve entre medias) */
  bossAt() { const i = this.horde.indexOfUid(this.bossUid); return i < 0 ? null : { i, x: this.horde.x[i], z: this.horde.z[i] }; }
  /** Programa una acción del jefe dentro de `t` segundos (solo si sigue vivo) */
  /** Acción diferida de la partida (no depende del jefe): la ejecuta updateTimers */
  after(t, f) { (this.timers || (this.timers = [])).push({ t, f, src: DMG_SRC }); }   // recuerda qué técnica lo lanzó
  updateTimers(dt) {
    const L = this.timers; if (!L || !L.length) return;
    for (let i = L.length - 1; i >= 0; i--) { L[i].t -= dt; if (L[i].t <= 0) { const T = L[i]; L.splice(i, 1); const o = DMG_SRC; DMG_SRC = T.src; T.f(); DMG_SRC = o; } }
  }
  later(t, f) { this.boss.q.push({ t, f: () => { const o = this.bossAt(); if (o) f(o); } }); }
  /** Dirección del jefe hacia el jugador, con un desvío opcional */
  aim(o, off) { const a = Math.atan2(this.player.z - o.z, this.player.x - o.x) + (off || 0); return [Math.cos(a), Math.sin(a)]; }

  /** Todas las técnicas de los jefes. Las genéricas (fan, ring...) y las de cada villano, sacadas de la serie */
  bossMove(k, c) {
    const S = this.shots, p = this.player, h = this.horde, { bx, bz, a, dmg, ph, st, B } = c, col = B.col || 0xff5070, me = { x: bx, z: bz };
    const ca = Math.cos(a), sa = Math.sin(a);
    switch (k) {
      /* ---- genéricas ---- */
      case 'fan': {                                                  // abanico dirigido al jugador
        const n = Math.min(9, 3 + st * 2);
        for (let q = 0; q < n; q++) { const o = a + (q - (n - 1) / 2) * 0.2; S.fire(bx, bz, Math.cos(o), Math.sin(o), 11 + st, dmg, B.sheet === 'black_boss' ? null : { tint: col, size: 1.8 }); }
        h.posBoss('atk', 0.4); break;
      }
      case 'ring':                                                   // anillo de energía
        S.ring(bx, bz, 14 + st * 5, 8 + st, dmg, rand(0, 6.28));
        this.fx.ring(this.fx.aura, bx, 0.5, bz, 40, 14, 0.5, 0.4, B.tints[ph]); h.posBoss('cast', 0.5); break;
      case 'spiral': this.boss.spiral = 2.4; this.boss.spA = rand(0, 6.28); this.boss.spTint = 0; break;
      case 'dash':                                                   // embestida con aviso
        this.boss.dashW = 0.6; this.fx.ring(this.fx.aura, bx, 0.4, bz, 30, 6, 0.6, 0.45, 0xff3050); break;
      case 'rain': {                                                 // zonas marcadas alrededor del jugador
        const n = 5 + ph * 2;
        for (let q = 0; q < n; q++) { const r = q === 0 ? 0 : rand(3, 10), o = rand(0, 6.28); S.mark(p.x + Math.cos(o) * r, p.z + Math.sin(o) * r, 3, 1.15 + q * 0.05, dmg * 1.6); }
        SFX.play('warn'); h.posBoss('cast', 0.8); break;
      }
      case 'beam': S.line(bx, bz, ca, sa, 46, 1.6, 0.9, dmg * 2.4); SFX.play('warn'); h.posBoss('atk', 1.2); break;
      case 'grieta': this.bossRift(bx, bz, a, dmg); h.posBoss('atk', 1.4); break;
      case 'summon': this.bossSummon(bx, bz, 6 + st * 2); break;

      /* ---- FREEZER ---- */
      case 'deathbeam': {                                            // Rayo mortal: rayos finos y rapidísimos, uno tras otro
        const n = ph >= 2 ? 5 : 3;
        for (let j = 0; j < n; j++) this.later(j * 0.22, (o) => { const [dx, dz] = this.aim(o, rand(-0.06, 0.06)); S.line(o.x, o.z, dx, dz, 40, 0.55, 0.42, dmg * 1.5, 0xff5ad0); });
        SFX.play('warn'); h.posBoss('atk', 0.25 * n + 0.4); break;
      }
      case 'saucer':                                                 // Disco mortal (Kienzan de Freezer): discos que te persiguen
        for (let j = 0; j < (ph >= 2 ? 3 : 2); j++) { const o = a + (j - 0.5) * 0.9; S.fire(bx, bz, Math.cos(o), Math.sin(o), 9 + st, dmg * 1.4, { tint: 0xffa0f0, size: 2.6, r: 1.2, home: 1.5, life: 6 }); }
        SFX.play('zap'); h.posBoss('cast', 0.6); break;
      case 'supernova':                                              // Supernova: la bola gigante que destruye planetas
        S.ball(bx, bz, p.x, p.z, 2.3, 6.5, dmg * 3, { tint: 0xffa040, size: 13, ring: 18 });
        SFX.play('charge'); this.shake(0.4); h.posBoss('cast', 1.4); break;

      /* ---- CÉLULA PERFECTO ---- */
      case 'kame':                                                   // Kamehameha: aviso largo y rayo enorme
        S.line(bx, bz, ca, sa, 52, 2.3, 1.15, dmg * 2.8, 0x60c8ff);
        this.fx.ring(this.fx.aura, bx, 1.2, bz, 30, 5, 1, 0.5, 0x60c8ff); SFX.play('charge'); h.posBoss('atk', 1.6); break;
      case 'barrier':                                                // Barrera perfecta: cúpula que te aparta de golpe
        S.mark(bx, bz, 7.5, 0.6, dmg * 1.3, { tint: 0x8aff70, ring: 16 }); h.posBoss('cast', 0.8);
        this.vfx.play('barrier', bx, 2.5, bz, { size: 9, grow: 1.9, dur: 0.75, pri: 1 }); break;
      case 'celljr': this.bossSummon(bx, bz, 5 + st, T_CELLJR); break;
      case 'selfdestruct':                                           // Autodestrucción: se hincha y explota (una vez por combate)
        if (this.boss.sd) { this.boss.t[k] = 999; break; }
        this.boss.sd = true; ENEMY_TYPES[T_BOSS].spd = 0;
        S.mark(bx, bz, 15, 3.2, dmg * 4, { tint: 0xffe060, big: true, ring: 24 });
        this.vfx.play('gather', bx, 2.5, bz, { size: 10, grow: 1.6, loop: 3.2, dur: 1.2, pri: 1, frames: FXA.gather.f.slice(12) });
        h.posBoss('cast', 3.2); SFX.play('alarm');
        this.later(3.2, () => { ENEMY_TYPES[T_BOSS].spd = 0.62 + this.phase * 0.12; this.ui.toast('¡HA SOBREVIVIDO A SU PROPIA EXPLOSIÓN!', true); });
        break;

      /* ---- BROLY ---- */
      case 'eraser':                                                 // Cañón Eraser: bola verde que estalla
        S.ball(bx, bz, p.x, p.z, 1.3, 4.5, dmg * 2.2, { tint: 0x7dff5a, size: 7, ring: 10 }); h.posBoss('atk', 0.8); break;
      case 'meteor': {                                               // Meteoro Gigante: lluvia de esferas verdes
        const n = 7 + ph * 2;
        for (let q = 0; q < n; q++) { const r = q === 0 ? 0 : rand(3, 12), o = rand(0, 6.28); S.mark(p.x + Math.cos(o) * r, p.z + Math.sin(o) * r, 2.6, rand(1, 1.8), dmg * 1.5, { tint: 0x7dff5a }); }
        SFX.play('warn'); h.posBoss('cast', 1); break;
      }
      case 'rush':                                                   // Embestida gigante: tres cargas seguidas
        for (let j = 0; j < 3; j++) this.later(j * 0.95, (o) => { this.boss.dashW = 0.5; this.fx.ring(this.fx.aura, o.x, 0.4, o.z, 30, 6, 0.5, 0.45, 0x7dff5a); });
        break;
      case 'roar':                                                   // Grito legendario: onda que te lanza lejos
        S.mark(bx, bz, 10, 0.7, dmg * 1.4, { tint: 0x7dff5a, ring: 20 }); SFX.scream(0.8, 120); h.posBoss('cast', 0.9); break;

      /* ---- KID BUU ---- */
      case 'majinkame': S.line(bx, bz, ca, sa, 48, 2, 1, dmg * 2.6, 0xff7ad0); SFX.play('charge'); h.posBoss('atk', 1.4); break;
      case 'candy':                                                  // Rayo de caramelo: si te da, te ralentiza
        S.line(bx, bz, ca, sa, 34, 0.8, 0.55, dmg * 0.8, 0xff9ad8, 'slow'); h.posBoss('cast', 0.9); break;
      case 'planetburst': {                                          // Bomba planetaria: explosiones por todo el mapa
        const n = 12 + ph * 2;
        for (let q = 0; q < n; q++) { const r = q === 0 ? 0 : rand(3, 17), o = rand(0, 6.28); S.mark(p.x + Math.cos(o) * r, p.z + Math.sin(o) * r, 2.8, 0.9 + q * 0.09, dmg * 1.5, { tint: 0xff7ad0 }); }
        SFX.play('warn'); h.posBoss('cast', 1.2); break;
      }
      case 'scream':                                                 // Grito de Buu: dos ondas de energía
        S.ring(bx, bz, 18, 9, dmg, rand(0, 6.28), { tint: 0xff7ad0, size: 1.8 });
        this.later(0.3, (o) => S.ring(o.x, o.z, 18, 9, dmg, rand(0, 6.28), { tint: 0xff9ae0, size: 1.8 }));
        SFX.scream(0.7, 260); this.shake(0.5); h.posBoss('cast', 0.7); break;
      case 'regen': {                                                // Regeneración: recupera vida (sin volver a una fase anterior)
        const cap = h.maxHp[c.i] * (1 - ph / c.NP) - 1;
        if (h.hp[c.i] < cap) {
          h.hp[c.i] = Math.min(cap, h.hp[c.i] + h.maxHp[c.i] * 0.05);
          this.fx.burst(this.fx.aura, bx, 2, bz, 30, 6, 0.8, 0.6, 1.2, 0xff9ad8); SFX.play('heal');
        } else this.boss.seen[k] = true;
        break;
      }

      /* ---- OMEGA SHENRON ---- */
      case 'thunder': {                                              // Trueno del dragón: rayos que caen en línea hacia ti
        const d = Math.hypot(p.x - bx, p.z - bz);
        for (let j = 0; j < 7; j++) { const r = Math.min(d + 6, 4 + j * 4); S.mark(bx + ca * r, bz + sa * r, 2.4, 0.5 + j * 0.12, dmg * 1.4, { tint: 0xfff07a, bolt: true }); }
        SFX.play('zap'); h.posBoss('cast', 1.1); break;
      }
      case 'icewall':                                                // Muro de hielo (poder de Eis Shenron): te congela
        S.ring(bx, bz, 18, 7, dmg * 0.8, rand(0, 6.28), { tint: 0xa0e8ff, size: 2.2, eff: 'slow' }); h.posBoss('cast', 0.7); break;
      case 'nova':                                                   // Estrella Nova (poder de Nuova Shenron): espiral de fuego
        this.boss.spiral = 2.6; this.boss.spA = rand(0, 6.28); this.boss.spTint = 0xff8a3a; h.posBoss('cast', 2.6); break;
      case 'minusball':                                              // Bola de energía negativa
        S.ball(bx, bz, p.x, p.z, 2.6, 8, dmg * 3.4, { tint: 0x6a5aff, size: 15, ring: 24 });
        SFX.play('charge'); this.shake(0.5); h.posBoss('cast', 1.6); break;

      /* ---- JIREN ---- */
      case 'punches':                                                // Puños invisibles: ráfaga de golpes de presión
        for (let j = 0; j < 10; j++) this.later(j * 0.07, (o) => { const [dx, dz] = this.aim(o, rand(-0.12, 0.12)); S.fire(o.x, o.z, dx, dz, 18, dmg * 0.7, { tint: 0xff4a4a, size: 1.4 }); });
        h.posBoss('atk', 0.9); break;
      case 'glare':                                                  // Mirada: onda de choque solo con mirarte
        S.mark(bx, bz, 9, 0.75, dmg * 1.5, { tint: 0xff3030, ring: 12 }); h.posBoss('cast', 0.9);
        this.vfx.play('pulse', bx, 2, bz, { size: 6, grow: 3, dur: 0.75, tint: 0xff6060, pri: 1 }); break;
      case 'powerimpact':                                            // Power Impact: bola de energía rápida
        S.ball(bx, bz, p.x, p.z, 0.9, 4, dmg * 2.4, { tint: 0xff5040, size: 6 }); h.posBoss('atk', 0.7); break;

      /* ---- BEERUS ---- */
      case 'orbs':                                                   // Esferas de energía de Beerus
        S.ring(bx, bz, 10, 7, dmg * 0.9, rand(0, 6.28), { tint: 0xb070ff, size: 2 });
        for (let q = 0; q < 5; q++) { const o = a + (q - 2) * 0.16; S.fire(bx, bz, Math.cos(o), Math.sin(o), 12, dmg, { tint: 0xd090ff, size: 2 }); }
        h.posBoss('atk', 0.6); break;
      case 'hakai': {                                                // Hakai: la zona marcada desaparece (y tú con ella)
        const n = 1 + (ph >= 1 ? 1 : 0) + (ph >= 2 ? 1 : 0);
        for (let q = 0; q < n; q++) {
          const r = q ? rand(4, 7) : 0, o = rand(0, 6.28), hx = p.x + Math.cos(o) * r, hz = p.z + Math.sin(o) * r;
          S.mark(hx, hz, 3.4, 1.25, dmg * 3.2, { tint: 0x9040ff, big: true });
          if (FXA.swirl) this.vfx.play('swirl', hx, 0.3, hz, { flat: true, size: 8, dur: 1.25, spin: 5, pri: 1, frames: [FXA.swirl.f[4]] });
        }
        SFX.play('warn'); h.posBoss('cast', 1.3); break;
      }
      case 'sphere':                                                 // Esfera de destrucción: un sol en miniatura
        S.ball(bx, bz, p.x, p.z, 2.8, 9, dmg * 3.6, { tint: 0xffb040, size: 16, ring: 28 });
        SFX.play('charge'); this.shake(0.5); h.posBoss('cast', 1.6); break;
      case 'blink': {                                                // Teletransporte: reaparece a tu lado y golpea
        const o = rand(0, 6.28), tx = clamp(p.x + Math.cos(o) * 5, -CFG.ARENA, CFG.ARENA), tz = clamp(p.z + Math.sin(o) * 5, -CFG.ARENA, CFG.ARENA);
        S.mark(tx, tz, 4.2, 0.75, dmg * 1.6, { tint: col });
        this.fx.burst(this.fx.aura, bx, 1.5, bz, 20, 5, 0.4, 0.5, 0, col); this.vfx.flash(bx, 2, bz, 6, col);
        this.later(0.7, (q) => { h.x[q.i] = tx; h.z[q.i] = tz; h.kx[q.i] = h.kz[q.i] = 0; h.posBoss('atk', 0.5); SFX.play('tp'); this.fx.burst(this.fx.aura, tx, 1.5, tz, 24, 6, 0.4, 0.5, 0, col); });
        break;
      }

      /* ---- ZAMASU FUSIONADO ---- */
      case 'wall':                                                   // Muro de luz: oleadas de orbes
        for (let j = 0; j < 3; j++) this.later(j * 0.28, (o) => { const aa = Math.atan2(p.z - o.z, p.x - o.x); for (let q = 0; q < 7; q++) { const t = aa + (q - 3) * 0.17; S.fire(o.x, o.z, Math.cos(t), Math.sin(t), 11, dmg * 0.8, { tint: 0xffd0f8, size: 1.8 }); } });
        h.posBoss('atk', 1); break;
      case 'lightning':                                              // Rayos de la absolución: caen siguiéndote
        for (let j = 0; j < 6; j++) this.later(j * 0.28, () => S.mark(p.x, p.z, 2.3, 0.6, dmg * 1.4, { tint: 0xd0a0ff, bolt: true }));
        SFX.play('zap'); h.posBoss('cast', 1.8); break;
      case 'blades': {                                               // Hojas del juicio: cuchillas de luz que cruzan la zona
        const n = 3 + ph;
        for (let q = 0; q < n; q++) {
          const o = rand(0, 6.28), dx = Math.cos(o), dz = Math.sin(o), off = rand(-4, 4);
          S.line(p.x - dx * 20 - dz * off, p.z - dz * 20 + dx * off, dx, dz, 40, 1.1, 0.95 + q * 0.12, dmg * 1.8, 0xff6ac8);
        }
        SFX.play('warn'); h.posBoss('cast', 1.2); break;
      }
      case 'wrath':                                                  // Ira divina: bola sagrada que cae sobre ti
        S.ball(bx, bz, p.x, p.z, 1.8, 6, dmg * 3, { tint: 0xff9af0, size: 10, ring: 16 }); SFX.play('charge'); h.posBoss('cast', 1.2); break;
    }
  }
  /** Tajo de Black: tres cortes morados con aviso que se abren hacia el jugador. Al abrirse, destello e impacto */
  bossRift(bx, bz, a, dmg) {
    for (const o of [-0.24, 0, 0.24]) {
      const L = this.shots.line(bx, bz, Math.cos(a + o), Math.sin(a + o), 46, 1.5, 1.1, dmg * 2.2, 0xb050ff);
      if (L) L.onFire = (l) => this.riftCut(l);
    }
    this.fx.ring(this.fx.aura, bx, 0.4, bz, 40, 14, 0.7, 0.5, 0xb26bff);
    SFX.play('warn');
  }
  /** Al abrirse el tajo: sacudida, destello y chispas moradas a lo largo de la grieta */
  riftCut(l) {
    this.shake(0.9); this.hitstop = Math.max(this.hitstop, 0.06);
    if (!Save.d.opt.flash) this.impT = Math.max(this.impT, 0.12);
    for (let s = 0; s < l.len; s += 3) this.fx.burst(this.fx.sparks, l.x + l.dx * s, 1.2, l.z + l.dz * s, 3, 6, 0.5, 0.4, 6, 0xc070ff);
  }
  /** Refuerzos en círculo alrededor del jefe */
  bossSummon(bx, bz, n, only) {
    if (!only) this.ui.toast('¡REFUERZOS!', true);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * 6.28, t = only !== undefined ? only : k % 4 === 0 ? T_BRUTE : k % 3 === 0 ? T_BOOM : T_BASIC;
      this.horde.spawn(clamp(bx + Math.cos(a) * 7, -CFG.ARENA, CFG.ARENA), clamp(bz + Math.sin(a) * 7, -CFG.ARENA, CFG.ARENA), (14 + this.pressure() * 0.25) * this.diff.hp * this.stage.hp * this.timeMul() * ENEMY_TYPES[t].hp, t);
    }
  }
  /** Nueva fase del jefe: grito, onda que te aparta, breve invulnerabilidad, más velocidad y refuerzos */
  onBossPhase(bx, bz) {
    const p = this.player, ph = this.phase, B = this.stage.boss, last = ph === B.pat.length - 1;
    const col = B.tintSprite === false ? B.tints[ph] : (B.col || B.tints[ph]);   // color del aura de la nueva forma
    this.bossInv = 1.2; ENEMY_TYPES[T_BOSS].spd = 0.62 + ph * 0.12;
    this.horde.tints[T_BOSS] = B.tints[ph];
    ENEMY_TYPES[T_BOSS].scale = (B.scaleW || B.scale) * (1 + ph * 0.04);   // el jefe crece con cada transformación
    if (B.rows) this.horde.bossRow = B.rows[ph];                       // cambia a la fila de su nueva forma
    if (B.sheets && this.ui.sheets && this.ui.sheets[B.sheets[ph]]) this.horde.setBossSheet(this.ui.sheets[B.sheets[ph]], 0, bossAnimOf(B.sheets[ph], B.anim), B.sheets[ph]);   // luchador: hoja de su nueva forma
    this.horde.posBoss('cast', 1.2);
    const dx = p.x - bx, dz = p.z - bz, d = Math.hypot(dx, dz) || 1;
    if (d < 14) { p.kbx = dx / d * 22; p.kbz = dz / d * 22; }
    this.horde.shockwave(bx, bz, 16, 30);
    // Transformación: grito, aura de la nueva forma, destello e impacto
    this.fx.ring(this.fx.aura, bx, 0.5, bz, 70, 26, 0.8, 0.5, col);
    this.fx.ring(this.fx.aura, bx, 0.5, bz, 40, 12, 0.5, 0.4, 0xffffff);
    this.fx.burst(this.fx.aura, bx, 2, bz, 80, 20, 1, 0.7, 1.5, col);
    this.fx.burst(this.fx.sparks, bx, 2, bz, 50, 14, 0.8, 0.5, 2, 0xffffff);
    this.vfx.play('flare', bx, 8, bz, { size: 17, dur: 1, pri: 1 }); this.vfx.play('dome', bx, 3, bz, { size: 12, grow: 1.8, dur: 0.7, pri: 1 });
    this.vfx.crater(bx, bz, 7); for (let k = 0; k < 6; k++) this.vfx.bolt(bx + Math.cos(k) * 6, bz + Math.sin(k) * 6, 14, col);
    this.shake(1.3); this.hitstop = 0.16;
    if (!Save.d.opt.flash) this.impT = 0.2;
    SFX.scream(1.2, 150 + ph * 25);
    this.ui.toast('¡' + B.name + (B.forms ? ' · ' + B.forms[ph] : ' · FASE ' + (ph + 1)) + '!'); SFX.play('phase');
    this.ui.toast(last ? 'ÚLTIMA FASE: ataca con todo' : 'Aprende sus nuevos ataques', true);
    this.bossSummon(bx, bz, 8 + this.step * 3);
    if (ph === 2) this.track('phase3', 1);
    // Recupera un 15% de su vida al transformarse
    const h = this.horde; for (let i = 0; i < h.n; i++) if (h.type[i] === T_BOSS) { h.hp[i] = Math.min(h.maxHp[i], h.hp[i] + h.maxHp[i] * 0.15); break; }
    this.ui.toast('¡Recupera un 15% de su vida!', true);
    if (!Save.d.opt.noCine && this.state === 'play') this.startBossCine(bx, bz, B.name, B.forms ? B.forms[ph] : 'FASE ' + (ph + 1), last, col);
  }
  /** Cinemática corta de la transformación del jefe: el mundo se congela, la cámara se acerca y aparece su nueva forma */
  startBossCine(x, z, name, form, last, col) {
    const el = document.getElementById('bossCine');
    document.getElementById('bcName').textContent = name;
    document.getElementById('bcForm').textContent = form;
    document.getElementById('bcSub').textContent = last ? 'ÚLTIMA FORMA · ¡ATACA CON TODO!' : 'SE TRANSFORMA Y RECUPERA VIDA';
    el.style.setProperty('--bc', '#' + (col >>> 0).toString(16).padStart(6, '0').slice(-6));
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');   // reinicia las animaciones
    this.bossCineT = 0; this.camFocus = { x, z }; this.state = 'bosscine';
  }
  updateBossCine(dt) {
    this.bossCineT += dt;
    this.player.animT += dt; this.player.pose();
    this.fx.update(dt); this.syncSprites(); this.updateCamera(dt, dt, false); this.ui.update(this, dt);
    if (this.bossCineT >= 2) {
      document.getElementById('bossCine').classList.remove('show');
      this.camFocus = null; this.state = 'play'; this.clock.getDelta();
    }
  }

  /** Barrera de Ki: un golpe parado. Destello, empujón y, con la fusión, estallido */
  onBarrierHit(p) {
    const c = p.barCol;
    this.horde.shockwave(p.x, p.z, 7, 14);
    if (p.barBoom) { DMG_SRC = 'boombarrier'; this.horde.damageRadius(p.x, p.z, 6, p.barBoom * p.damageMul(), 12, this); DMG_SRC = 'otros'; this.vfx.boom(p.x, p.z, 3.2, c, false); }
    this.vfx.play('shBreak', p.x, 1.6, p.z, { size: 5, fps: 30, tint: c, pri: 1 });
    this.vfx.flash(p.x, 1.6, p.z, 4, c);
    this.fx.ring(this.fx.aura, p.x, 0.6, p.z, 26, 10, 0.35, 0.35, c);
    SFX.play('block');
    if (p.barHits <= 0) this.ui.toast('BARRERA ROTA', true);
  }

  /** Ultimate del personaje. Solo con la carga completa y jugando */
  ultimate() {
    const p = this.player, U = p.ultD;
    if (!U || this.state !== 'play' || this.ultT >= 0 || p.ult < U.cost || p.dying) return;
    const kc = Math.round(p.maxKi * ULT_KI * p.kiUse);
    if (p.ki < kc) { this.ui.toast('NECESITAS ' + kc + ' DE KI PARA LA ULTIMATE · CARGA CON [C]', true); SFX.play('warn'); return; }
    p.ki -= kc; p.ult = 0; p.iframes = Math.max(p.iframes, 1.2);
    // Ataque combinado: el aliado más cercano (a menos de COMBO_R) ataca contigo y la Ultimate hace +50% de daño
    let ca = null, cd = COMBO_R;
    for (const a of this.allies.list) { const d = Math.hypot(a.x - p.x, a.z - p.z); if (d < cd) { cd = d; ca = a; } }
    this.ultCombo = ca ? { ally: ca, name: comboName(p.ch.id, ca) } : null;
    const UN = this.ultCombo ? this.ultCombo.name : U.name;
    // Desventaja de la Ultimate: empieza al lanzarla (después del destello)
    const D = U.debuff;
    if (D) this.after(0.6, () => { p.ud = D; p.udT = D.t; if (D.hp) p.hp = Math.max(1, p.hp - p.maxHp * D.hp); if (D.nodash) p.noDashT = Math.max(p.noDashT, D.t); this.ui.toast('✖ ' + D.name + ': ' + D.text, true); });
    const fire = () => {
      this.ultT = 0; this.ultCut = false;
      this.hitstop = Math.max(this.hitstop, 0.5);                // el mundo se congela mientras dura el destello
      this.shake(0.6); SFX.play('boom');
    };
    // Animación propia de cada personaje (el mundo espera congelado) y después la Ultimate
    const go = () => {
      if (this.ultCine.has(p.ultId) && !Save.d.opt.noCine) {
        this.state = 'ultcine';
        this.ultCine.start(p.ultId, UN, () => { if (this.state !== 'ultcine') return; this.state = 'play'; this.clock.getDelta(); fire(); });
      } else { this.state = 'play'; this.clock.getDelta(); fire(); }
    };
    // Guerreros y formas del Altar de Shenron: antes, corte en diagonal con su retrato grande
    const face = (p.form && p.form.face) || p.ch.face;
    if (face && this.ui.sheets && this.ui.sheets[face] && !Save.d.opt.noCine) {
      this.state = 'ultcine'; this.ui.faceCut(face, UN, U.col || p.form.ki);
      this.faceT = 0.9; this.faceGo = go;                     // sigue en tiempo de juego (ver loop: estado 'ultcine')
    } else go();
  }
  /** Secuencia de la Ultimate en tiempo real: destellos de impacto de colores y, al final, el tajo */
  updateUlt(dt) {
    if (this.ultT < 0) return;
    this.ultT += dt;
    const t = this.ultT, el = this.ultFx || (this.ultFx = document.getElementById('ultFx'));
    // Fotogramas [tiempo, color, opacidad]: negro, blanco, los colores de cada personaje y una caída suave
    const C = (this.player.ultD && this.player.ultD.fx) || ['#000', '#fff', '#b050ff', '#ff3fa0', '#b050ff'];
    const F = [[0, C[0], 1], [0.09, C[1], 0.9], [0.18, C[2], 0.75], [0.27, C[3], 0.5], [0.4, C[4], 0.25]];
    if (t >= 0.5) { this.ultT = -1; if (el) el.style.opacity = 0; return; }
    if (t >= 0.27 && !this.ultCut) { this.ultCut = true; this.ultFire(); }
    let f = F[0]; for (const k of F) if (t >= k[0]) f = k;
    if (el) { el.style.background = f[1]; el.style.opacity = f[2]; }
  }
  /** Lanza la Ultimate según su tipo (rift, bomb, beam, storm, discs, slash) */
  ultFire() {
    const p = this.player, U = p.ultD, W = this.weapons, V = this.vfx, C = this.ultCombo, dm = p.damageMul() * (C ? COMBO_DMG : 1);
    if (C) this.comboAttack(C);
    if (U.type === 'rift' || !U.type) return this.ultSlash(dm);
    const a = W.aim(this, p, 40) || W.facing(this, p), ax = a.dx, az = a.dz;
    DMG_SRC = 'ult';
    this.ui.toast('¡' + (C ? C.name : U.name) + '!');
    if (U.type === 'bomb') {                                 // Super Genkidama / Death Ball: esfera gigante sobre la horda
      const d = a.d ? Math.min(a.d, 14) : 10;
      W.bigStrike(p.x + ax * d, p.z + az * d, U.r, U.dmg * dm, U.col, 2.2, U.sty, 'ult');
      this.bossChunk(p.x + ax * d, p.z + az * d, U.r, 0.06);
      SFX.play('charge');
    } else if (U.type === 'beam') {                          // Final Flash, Kamehameha Padre-Hijo, Kamehameha Solar
      W.beam(p.x, p.z, ax, az, U.len, U.hw, U.dmg * dm, U.life, 0.1, U.col, true);
      p.beamT = U.life; p.attack(ax, az, true, this); chargeFx(this, p.x + ax * 1.3, p.z + az * 1.3, U.col, 4.5);
      if (U.end) this.after(0.3, () => V.play(U.end, p.x + ax * U.len * 0.55, 2.4, p.z + az * U.len * 0.55, { size: 12, dur: 0.8, pri: 1 }));
      V.play('gather', p.x, 1.6, p.z, { size: 7, fps: 30, frames: FXA.gather ? FXA.gather.f.slice(12, 18) : null, pri: 1 });
      this.bossChunkLine(p.x, p.z, ax, az, U.len, U.hw, 0.06);
      this.shake(1.4); SFX.play('bigbeam');
    } else if (U.type === 'storm') {                         // Hellzone Grenade definitivo: esferas sobre cada enemigo cercano
      let n = 0;
      for (let i = 0; i < this.horde.n && n < U.n; i++) {
        const ex = this.horde.x[i] - p.x, ez = this.horde.z[i] - p.z;
        if (ex * ex + ez * ez > U.r * U.r || Math.random() < 0.3) continue;
        W.strikeAt(this.horde.x[i], this.horde.z[i], 0.8 + n * 0.035, 3.2, U.dmg * dm, 0xffd040, 'hz', 'ult'); n++;
      }
      for (let k = 0; k < 18; k++) { const r = rand(4, 12), t = rand(0, 6.28); V.play('hzCluster', p.x + Math.cos(t) * r, 2 + rand(0, 3), p.z + Math.sin(t) * r, { size: 2.6, dur: 0.9, alpha: 0.85 }); }
      this.bossChunk(p.x, p.z, U.r, 0.05);
      SFX.play('charge');
    } else if (U.type === 'discs') {                         // Kienzan múltiple: corona de discos gigantes
      for (let k = 0; k < U.n; k++) { const t = (k / U.n) * 6.2832; this.ki.fire(p.x, p.z, Math.cos(t), Math.sin(t), 20, U.dmg * dm, 1.4, false, 2.2, 99, 0, 0xffe86a, 3.3, 1); }
      this.bossChunk(p.x, p.z, 30, 0.04);
      SFX.play('slash');
    } else if (U.type === 'slash') {                         // Burning Slash: tajos en todas direcciones y la explosión del Burning Attack
      for (let k = 0; k < 3; k++) this.after(k * 0.12, () => { W.slash(this, p, Math.cos(k * 2.1), Math.sin(k * 2.1), U.r, U.dmg * dm, true, 0x9fe0ff); });
      const bx = p.x + ax * 8, bz = p.z + az * 8;
      this.after(0.45, () => {
        DMG_SRC = 'ult'; this.horde.damageRadius(bx, bz, 9, U.dmg * 2 * dm, 18, this); this.world.damageArea(bx, bz, 9, U.dmg * 2);
        V.play('burnBig', bx, 3, bz, { size: 12, dur: 0.8, pri: 1 }); V.play('burnSwirl', bx, 2, bz, { size: 8, fps: 12, pri: 1 });
        V.crater(bx, bz, 6, 0xff9a2a); this.shake(1.2); SFX.play('bigboom'); this.impact(0.12, 2); DMG_SRC = 'otros';
      });
      this.bossChunk(bx, bz, 10, 0.05);
    }
    this.fx.ring(this.fx.aura, p.x, 0.5, p.z, 70, 26, 0.8, 0.5, U.col || 0xffffff);
    p.iframes = Math.max(p.iframes, 1);
    DMG_SRC = 'otros';
  }
  /** La Ultimate hiere también al jefe si lo alcanza: un trozo de su vida máxima */
  bossChunk(x, z, r, frac) {
    const bi = this.horde.indexOfUid(this.bossUid);
    if (bi < 0) return;
    const ex = this.horde.x[bi] - x, ez = this.horde.z[bi] - z;
    if (ex * ex + ez * ez < (r + 2) * (r + 2)) this.horde.hurt(bi, this.horde.maxHp[bi] * frac, 0, 0, this);
  }
  bossChunkLine(x, z, dx, dz, len, hw, frac) {
    const bi = this.horde.indexOfUid(this.bossUid);
    if (bi < 0) return;
    const ex = this.horde.x[bi] - x, ez = this.horde.z[bi] - z, t = ex * dx + ez * dz;
    if (t > -1 && t < len && Math.abs(ex * dz - ez * dx) < hw + ENEMY_TYPES[T_BOSS].r) this.horde.hurt(bi, this.horde.maxHp[bi] * frac, 0, 0, this);
  }
  /** Ataque combinado: el aliado lanza su propio rayo contra el mismo objetivo, con su color de Ki */
  comboAttack(C) {
    const p = this.player, A = C.ally, W = this.weapons, U = p.ultD;
    const t = W.aim(this, p, 40) || W.facing(this, p), tx = p.x + t.dx * (t.d || 12), tz = p.z + t.dz * (t.d || 12);
    const dx = tx - A.x, dz = tz - A.z, d = Math.hypot(dx, dz) || 1;
    A.atkT = 1.2; A.flip = dx < 0 ? 1 : 0;
    DMG_SRC = 'ult';
    W.beam(A.x, A.z, dx / d, dz / d, 42, 2.2, (U.dmg || 20) * 0.06 * p.damageMul(), 1.3, 0.1, A.d.ki, false);   // daño por golpe (13 golpes)
    DMG_SRC = 'otros';
    this.fx.ring(this.fx.aura, A.x, 0.5, A.z, 40, 14, 0.6, 0.4, A.d.ki);
    this.ui.toast('¡' + A.d.name + ' SE UNE A TU ATAQUE! · +50% de daño y su propio rayo', true);
  }
  /** El tajo: dos cortes que cruzan el mapa a través del jugador. Daña a todo lo que toca */
  ultSlash(dm) {
    const p = this.player, U = p.ultD, a = this.camYaw, L = U.len, dmg = U.dmg * (dm || p.damageMul());
    for (const [dx, dz] of [[Math.cos(a), Math.sin(a)], [-Math.sin(a), Math.cos(a)]]) {
      this.horde.damageLine(p.x - dx * L, p.z - dz * L, dx, dz, 2 * L, U.hw, dmg, this);
      for (let s = -L; s < L; s += 2.5) this.fx.burst(this.fx.sparks, p.x + dx * s, 1.2, p.z + dz * s, 2, 7, 0.55, 0.45, 8, 0xd080ff);
      for (let s = -L; s < L; s += 5) this.vfx.play('pinkCrack', p.x + dx * s, 0.2, p.z + dz * s, { flat: true, size: 6, dur: 1.2, rot: Math.atan2(-dz, dx), pri: 1 });
    }
    // El tajo también hiere al jefe si cruza alguna de las dos líneas: un 5% de su vida máxima
    const bi = this.horde.indexOfUid(this.bossUid);
    if (bi >= 0) {
      const ex = this.horde.x[bi] - p.x, ez = this.horde.z[bi] - p.z, r = U.hw + ENEMY_TYPES[T_BOSS].r;
      const d1 = Math.abs(ex * Math.sin(a) - ez * Math.cos(a)), d2 = Math.abs(ex * Math.cos(a) + ez * Math.sin(a));
      if (Math.min(d1, d2) < r) this.horde.hurt(bi, this.horde.maxHp[bi] * 0.05, 0, 0, this);
    }
    this.fx.ring(this.fx.aura, p.x, 0.5, p.z, 90, 34, 0.9, 0.6, 0xb050ff);
    this.fx.ring(this.fx.aura, p.x, 0.5, p.z, 60, 20, 0.7, 0.5, 0xffffff);
    this.shake(1.6); SFX.play('bigbeam'); SFX.play('bigboom');
    p.iframes = Math.max(p.iframes, 0.8);
  }
  onEnemyKilled(x, z, type, uid) {
    this.kills++; this.track('kills', 1);
    if (this.saga && this.saga.goal.type === 'hunt' && type === this.saga.goal.t) this.sagaHunt++;
    if (this.player.kiOnKill && !this.player.dying) { const q = this.player; q.ki = Math.min(q.maxKi, q.ki + q.kiOnKill); }   // Absorción de Energía
    if (this.player.pluma && this.kills % 20 === 0 && !this.player.dying) {       // Pluma Sagrada
      const q = this.player; q.hp = Math.min(q.maxHp, q.hp + q.maxHp * 0.05); this.ui.toast('✿ PLUMA SAGRADA · +5% DE VIDA', true);
    }
    this.addCombo();
    if (uid && uid === this.rivalUid) {                              // rival del evento
      this.rivalUid = 0; this.run.rivals++; this.track('rivals', 1);
      const M = Save.d.rival || (Save.d.rival = { lvl: 0 }), lv = M.lvl || 0;
      this.capsules.add(x, z, 1, this.world); if (lv >= 3) this.capsules.add(x + 2, z, 1, this.world);   // desde el nivel 4, dos cápsulas
      this.gainCash(80 + 40 * lv);
      // Memoria: el tipo de técnica que más daño le hizo (y cuál) es lo que preparará para la próxima vez
      let top = '', best = 0; for (const c in this.rivalDmg) if (this.rivalDmg[c] > best) { best = this.rivalDmg[c]; top = c; }
      let topW = '', bw = 0; for (const w in this.rivalByW) if (this.rivalCat(w) === top && this.rivalByW[w] > bw) { bw = this.rivalByW[w]; topW = w; }
      Save.d.rival = { lvl: lv + 1, counter: top, topW, beatMe: false }; Save.write();
      this.ui.toast('¡RIVAL DERROTADO!'); this.ui.toast('Recordará ' + this.rivalWName(topW) + '... y volverá más fuerte', true); SFX.play('achieve');
    }
    if (this.mode === 'rush') this.rushKill(x, z, type);
    this.gainCash(ENEMY_TYPES[type].cash);
    this.orbs.spawn(x, z, ENEMY_TYPES[type].xp);
    this.gainZeni(type === 3 ? 60 : 0.5 * ENEMY_TYPES[type].xp);
    this.fx.burst(this.fx.gore, x, 1, z, 7, 6, 0.55, 0.3, 12);
    this.fx.burst(this.fx.sparks, x, 1, z, 4, 5, 0.35, 0.25, 6);
    const p = this.player;
    if (p.killHeal) p.hp = Math.min(p.maxHp, p.hp + p.killHeal);
    if (p.ch.id === 'black') p.hp = Math.min(p.maxHp, p.hp + 0.6);          // pasiva: Justicia Divina
    if (p.ch.id === 'cell') { p.hp = Math.min(p.maxHp, p.hp + 0.3); p.absorbed++; }   // pasiva: Absorción
    p.addUlt(type === T_BOSS ? 25 : type === 4 ? 4 : 0.8);                   // la Ultimate se carga con cada enemigo
    if (type === 4) {
      this.track('elites', 1);
      this.fx.ring(this.fx.aura, x, 0.4, z, 36, 12, 0.6, 0.4, 0xffc83a);
      this.vfx.boom(x, z, 2.8, 0xffc83a, false); this.impact(0.07, 3);
      for (let i = 0; i < 4; i++) this.orbs.spawn(x, z, 4);
      this.ui.toast('+' + Math.round(ENEMY_TYPES[4].cash * p.zeniMul) + ' ZENI · ÉLITE', true); SFX.play('coin');
      if (Math.random() < 0.3) this.capsules.add(x, z, false, this.world);
    } else if (type === T_BOSS) {
      this.track('bosses', 1); this.run.bosses++; this.rerolls++;
      this.bossUid = 0; this.pendingLevels++; this.bossDead = true; this.shots.reset(); this.bossInv = 0;
      this.capsules.add(x, z, true, this.world);
      if (this.mods.bigboss) { this.capsules.add(x + 3, z, true, this.world); this.gainCash(200); }
      for (let i = 0; i < 4; i++) this.pickups.drop(x + rand(-3, 3), z + rand(-3, 3));
      for (let i = 0; i < 12; i++) this.orbs.spawn(x, z, 5);
      this.fx.ring(this.fx.aura, x, 0.4, z, 50, 18, 0.7, 0.45, 0xffd24a);
      this.vfx.boom(x, z, 8, 0xffd24a, true); this.vfx.play('flare', x, 7, z, { size: 16, dur: 0.9, pri: 1 });
      this.vfx.play('dome', x, 3, z, { size: 14, grow: 1.6, dur: 0.8, pri: 1 });
      this.impact(0.26, 0);
      this.ui.toast('¡' + this.stage.boss.name + ' DERROTADO!'); this.shake(1); SFX.play('bigboom'); SFX.music('battle');
      if (this.mode === 'gauntlet') this.gauntletKill(x, z);                // Asalto de Jefes: cristales y el siguiente jefe
      else if (this.mode === 'rush') { /* Lluvia de Cristales: se sigue en el mismo mapa hasta que acabe el tiempo */ }
      else if (this.stage.final || this.saga) this.victoryT = 2.2;
      else this.openRifts(x, z);
    } else {
      if (Math.random() < 0.012) this.pickups.drop(x, z);
      if (type === 2 && Math.random() < 0.04) this.capsules.add(x, z, false, this.world);
    }
  }

  /* ---------- Experiencia y mejoras ---------- */
  /** Multiplicador de experiencia del mapa: Cámara del Tiempo x2, gravedad x10 +30%, noche +20% */
  stageXp() { const f = this.stage.fx; return (f === 'time' ? 2 : f === 'gravity' ? 1.3 : f === 'hell' ? 1.2 : 1) * (this.night > 0.5 ? 1.2 : 1); }
  addXp(v) {
    const p = this.player;
    p.xp += v * p.xpMul * this.stageXp() * (this.roomT > 0 ? 2 : 1);   // Sala del Tiempo: experiencia doble
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext; p.level++; p.xpNext = p.xpFor(p.level);
      if (p.level > 300) { p.xp = 0; break; }
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.1);
      this.pendingLevels++;
      this.fx.ring(this.fx.aura, p.x, 0.5, p.z, 36, 12, 0.5, 0.3);
      this.checkTransformation();
    }
  }

  /** 3 cartas distintas: mejoras de armas equipadas, armas nuevas (propias del personaje) y vitaminas */
  rollCards() {
    const p = this.player, W = this.weapons, pool = [];
    const fus = fusionsFor(p.ch.id).filter((f) => !W.get(f) && WEAPONS[f].fusion.every((x) => techOwned(x, this.practice)));
    for (const w of W.list) if (w.lv < MAX_WEAPON_LEVEL) {
      pool.push({ t: 'weapon', id: w.id }); if (WEAPONS[w.id].unique) pool.push({ t: 'weapon', id: w.id });
      // Si esta técnica completa una fusión cuya pareja ya tienes, sale más a menudo
      if (fus.some((f) => WEAPONS[f].fusion.includes(w.id) && WEAPONS[f].fusion.every((x) => W.get(x)))) { pool.push({ t: 'weapon', id: w.id }); pool.push({ t: 'weapon', id: w.id }); }
    }
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
    // Técnicas propias del personaje (p. ej. el Kamehameha de Goku): la primera vez que llegas a su nivel salen seguro;
    // después, si no la cogiste, sale bastante más a menudo que el resto
    if (W.list.length < MAX_WEAPONS) for (const id of this.signatures()) {
      if (!this.sigOffered[id] && out.length < 1) { out.push({ t: 'weapon', id }); seen['weapon' + id] = 1; this.sigOffered[id] = true; }
      else for (let k = 0; k < 3; k++) pool.push({ t: 'weapon', id });
    }
    for (let k = 0; k < 80 && out.length < 3 && pool.length; k++) {
      const c = pick(pool), key = c.t + c.id;
      if (seen[key]) continue;
      seen[key] = 1; out.push(c);
    }
    const cards = out.map((c) => {
      const card = this.cardOf(c, W, p);
      if (c.t === 'weapon' || c.t === 'stat') {                   // rareza de la carta (la suerte sube las altas)
        const r = rollTier(p.luck), T = CARD_TIERS[r];
        card.tier = r;
        if (r) {
          card.tag = T.name + ' · ' + card.tag;
          if (c.t === 'stat') card.text = scaleText(card.text, T.mul) + '<br><span class="rar">Efecto x' + String(T.mul).replace('.', ',') + '</span>';
          else card.text += '<br><span class="rar">+' + Math.round(T.dmg * 100) + '% de daño de esta técnica</span>';
        }
      }
      return card;
    });
    while (cards.length < 3) cards.push({ type: 'heal', id: 'heal', icon: '❖', tag: 'RECOMPENSA', title: 'Semilla Senzu', text: 'Recuperas toda la vida.', max: 0, lv: 0 });
    return cards;
  }
  /** Carta de una opción del sorteo (sin rareza) */
  cardOf(c, W, p) {
    if (c.t === 'fusion') {
      const F = WEAPONS[c.id];
      return { type: 'fusion', id: c.id, icon: F.icon, tag: '⚭ FUSIÓN', title: F.name, text: F.lv[0] + ' (' + F.fusion.map((f) => WEAPONS[f].name).join(' + ') + ')' + kiNote(c.id, p) + (F.down ? '<br><span class="trb">✖ ' + F.down.text + '</span>' : ''), max: 0, lv: 0 };
    }
    if (c.t === 'weapon') {
      const d = WEAPONS[c.id], cur = W.levelOf(c.id), nl = cur + 1;
      const hint = this.fusionHint(c.id);
      return { type: 'weapon', id: c.id, icon: d.icon, tag: cur ? 'MEJORA · NV ' + nl : d.unique ? 'TÉCNICA' : 'NUEVA ARMA', title: d.name, text: d.lv[nl - 1] + kiNote(c.id, p) + (hint ? '<br><span class="fh">' + hint + '</span>' : ''), max: MAX_WEAPON_LEVEL, lv: nl };
    }
    const s = STATS.find((x) => x.id === c.id), n = (p.stacks[c.id] || 0) + 1;
    return { type: 'stat', id: c.id, icon: s.icon, tag: 'VITAMINA · ' + n + '/' + s.max, title: s.name, text: s.text, max: s.max, lv: n };
  }

  /** Técnicas propias disponibles ahora: exclusivas del personaje, gratuitas, no aprendidas y con nivel suficiente */
  signatures() {
    const p = this.player, W = this.weapons;
    return (p.ch.unique || []).filter((id) => { const D = WEAPONS[id]; return D && !D.shop && !D.fusion && id !== p.ch.start[0] && !W.get(id) && !p.fused.some((f) => (WEAPONS[f].fusion || []).includes(id)) && (D.minLv || 0) <= p.level; });
  }
  /** Pista en la carta: con qué se fusiona esta técnica */
  fusionHint(id) {
    const W = this.weapons;
    for (const f of fusionsFor(this.player.ch.id)) {
      const F = WEAPONS[f];
      if (!F.fusion.includes(id) || W.get(f)) continue;
      const other = F.fusion.find((x) => x !== id), lock = !techOwned(other, this.practice);
      return '⚭ + ' + WEAPONS[other].name + (lock ? ' (🔒 tienda)' : W.get(other) ? ' (nv ' + W.levelOf(other) + '/5)' : '') + ' → ' + F.name;
    }
    return '';
  }
  /** Cambiar las cartas de subida de nivel (2 por partida, +1 por cada jefe) */
  reroll() {
    if (this.state !== 'levelup' || this.rerolls <= 0) return;
    this.rerolls--; SFX.play('click');
    this.openLevelUp(true);
  }
  openLevelUp(again) {
    this.state = 'levelup'; this.releaseMouse(); if (!again) SFX.play('levelup');
    const foot = this.rerolls > 0 ? '<button data-reroll>🎲 CAMBIAR CARTAS [R] · ' + this.rerolls + '</button>' : '';
    this.ui.showCards('¡NIVEL ' + this.player.level + '!', 'ELIGE UNA MEJORA [1 · 2 · 3]', this.rollCards(), (c) => {
      const p = this.player;
      SFX.play('select');
      if (c.type === 'weapon') {
        const w = this.weapons.add(c.id), T = CARD_TIERS[c.tier || 0];
        if (T.dmg) { this.wMul[c.id] = (this.wMul[c.id] || 1) * (1 + T.dmg); this.ui.toast(T.name + ': +' + Math.round(T.dmg * 100) + '% DE DAÑO · ' + WEAPONS[c.id].name.toUpperCase(), true); }
        if (w.lv >= MAX_WEAPON_LEVEL) { const h = this.fusionHint(c.id); if (h) this.ui.toast(WEAPONS[c.id].name.toUpperCase() + ' AL MÁXIMO · ' + h, true); }
      } else if (c.type === 'fusion') {
        this.wMul[c.id] = Math.max(1, ...WEAPONS[c.id].fusion.map((f) => this.wMul[f] || 1));   // la fusión hereda el mejor extra
        this.weapons.fuse(c.id); this.run.fusions++; this.track('fusions', 1);
        p.fused.push(c.id); p.recompute();
        this.ui.toast('¡FUSIÓN! ' + WEAPONS[c.id].name.toUpperCase(), true); SFX.play('stinger');
        this.fx.ring(this.fx.aura, p.x, 0.5, p.z, 70, 24, 0.8, 0.5, WEAPONS[c.id].color); this.impT = 0.14;
      }
      else if (c.type === 'stat') { const k = CARD_TIERS[c.tier || 0].mul; p.stacks[c.id] = c.lv; (p.stackMul[c.id] || (p.stackMul[c.id] = []))[c.lv - 1] = k; STATS.find((s) => s.id === c.id).apply(p, k); }
      else p.hp = p.maxHp;
      this.pendingLevels--;
      this.ui.hideCards();
      if (this.pendingLevels > 0) this.openLevelUp(); else this.resume();
    }, foot);
  }
  resume() { this.state = 'play'; this.grabMouse(); this.clock.getDelta(); }
  /** Evita elegir carta sin querer (por ejemplo, con el dash pulsado justo cuando se abren) */
  cardsReady() { return performance.now() - this.ui.cardAt > 350; }

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
      { id: 'lv', icon: '★', title: 'Entrenamiento divino', text: 'Subes 2 niveles al instante.' },
      { id: 'ally', icon: '☯', title: 'Compañero eterno', text: 'Un aliado lucha a tu lado el resto de la partida.' },
      { id: 'boss', icon: '☠', title: 'Castigo divino', text: 'El jefe pierde la mitad de su vida (si aún no ha llegado, llegará debilitado).' },
      { id: 'god', icon: '✧', title: 'Poder de los dioses', text: '45 segundos invencible y con el doble de daño.' }
    ];
    const cards = [];
    while (cards.length < 3) { const c = pick(all); if (!cards.includes(c)) cards.push(c); }
    this.ui.showCards('SHENRON TE ESCUCHA', 'PIDE TU DESEO [1 · 2 · 3]', cards.map((c) => ({ type: 'wish', id: c.id, icon: c.icon, tag: 'DESEO', title: c.title, text: c.text, max: 0, lv: 0 })), (c) => {
      const p = this.player;
      if (c.id === 'hp') { p.buffs.push('w_hp'); p.recompute(); p.hp = p.maxHp; }
      else if (c.id === 'dmg') { p.buffs.push('w_dmg'); p.recompute(); }
      else if (c.id === 'zeni') { this.zeniRun += 500; this.gainCash(400); }
      else if (c.id === 'revive') p.canRevive = true;
      else if (c.id === 'ally') { const al = this.allies.summon(this); if (al) { al.t = 1e9; this.ui.toast('¡' + al.d.name + ' SE UNE A TI PARA SIEMPRE!', true); } else this.ui.toast('Ya tienes a todos tus aliados', true); }
      else if (c.id === 'boss') {
        const h = this.horde; let hit = false;
        for (let i = 0; i < h.n; i++) if (h.type[i] === T_BOSS) { h.hp[i] *= 0.5; hit = true; }
        if (hit) this.ui.toast('¡SHENRON CASTIGA AL JEFE: PIERDE LA MITAD DE SU VIDA!', true); else { this.bossWeak = true; this.ui.toast('El próximo jefe llegará debilitado', true); }
      }
      else if (c.id === 'god') { p.godT = 45; this.ui.toast('✧ PODER DE LOS DIOSES · 45 S', true); }
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
    const F = this.camFocus, fx = F ? F.x : p.x, fz = F ? F.z : p.z;          // cinemática del jefe: la cámara va hacia él
    this.camLook.x += (fx - this.camLook.x) * k;
    this.camLook.z += (fz - this.camLook.z) * k;
    // La cámara sigue el suelo bajo el jugador (con suavidad, para que las colinas no den saltos)
    this.camLook.y += ((menu ? 0 : 1.4 + groundH(p.x, p.z)) - this.camLook.y) * k;
    this.camDist += ((F ? this.camDistT * 0.55 : this.camDistT) - this.camDist) * (1 - Math.exp(-(F ? 4 : 8) * rawDt));
    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch), s = this.shakeAmt, d = this.camDist;
    this.camera.position.set(
      this.camLook.x + this.camSin * d * cp + (Math.random() - 0.5) * s * 1.2,
      this.camLook.y + d * sp + (Math.random() - 0.5) * s * 1.2,
      this.camLook.z + this.camCos * d * cp);
    this.camera.lookAt(this.camLook);
    this.backdrop.follow(this.camera, this.night);
    this.shakeAmt = Math.max(0, s - rawDt * 2.6);
  }

  /** Ciclo día/noche: 4 minutos (día, atardecer, noche, amanecer). De noche se ve menos, hay más veloces y +20% EXP */
  updateNight(dt) {
    const ph = (this.stageTime % 240) / 240;
    let n = ph < 0.45 ? 0 : ph < 0.55 ? (ph - 0.45) / 0.1 : ph < 0.9 ? 1 : 1 - (ph - 0.9) / 0.1;
    if (this.mods.night) n = 1;
    this.night = n;
    this.nightT -= dt;
    if (this.nightT <= 0) { this.nightT = 0.2; this.world.setNight(n); }
    const isNight = n > 0.5;
    if (isNight !== this.wasNight) {
      this.wasNight = isNight;
      if (isNight) { this.ui.toast('☾ CAE LA NOCHE'); this.ui.toast('Menos visibilidad · más enemigos veloces · +20% EXP', true); }
      else this.ui.toast('☀ AMANECE', true);
    }
  }

  /* ---------- Un paso de simulación (dt ya incluye el hitstop) ---------- */
  update(dt) {
    const p = this.player, h = this.horde;
    const clk = this.tourney ? 0 : this.roomT > 0 ? 1 / 6 : 1;      // torneo: el reloj se para · Sala del Tiempo: fuera pasa 6 veces más lento
    this.time += dt * clk; this.stageTime += dt * clk;
    this.updateTimeRoom(dt);
    p.update(dt, this);
    this.weapons.update(dt, this);
    this.updateTimers(dt);

    const S = this.stage, t0 = this.pressure();
    if (S.final && !this.saga) {                                    // mapa final: solo el jefe (y sus refuerzos)
      if (!this.bossSpawned && this.stageTime > 2) this.spawnBoss(0, -22);
    } else {
      if (S.bossAt && !this.bossSpawned && !this.saga && this.stageTime >= S.bossAt) this.spawnBoss();   // Cámara del Tiempo: el jefe llega solo
      if (!this.swarm && !this.practice && this.stageTime >= this.swarmAt()) {            // a los 10 minutos llega el enjambre final
        this.swarm = true; this.ui.toast('¡ENJAMBRE FINAL!'); this.shake(1); SFX.play('alarm'); SFX.music('boss');
      }
      const sw = this.swarmLvl();
      this.spawnAcc += Math.min(4 + t0 * 0.09, 22) * S.spawn * (1 + sw * 0.7) * this.diff.spawn * (1 + this.chal * 0.2) * (this.roomT > 0 ? 3 : 1) * (this.mode === 'rush' ? 1.6 : this.mode === 'gauntlet' ? 0.5 : 1) * dt;   // en la sala, el triple · Lluvia de Cristales: más horda · Asalto: menos
      while (this.spawnAcc >= 1) { this.spawnAcc -= 1; this.spawnEnemy(); }
      this.waveT -= dt;
      if (this.waveT <= 0 && !this.swarm) {                         // oleada normal cada minuto
        this.waveT = 60;
        this.ui.toast('¡OLEADA!', true);
        for (let k = 0, n = 12 + this.step * 6; k < n; k++) this.spawnEnemy();
      }
    }
    if (this.victoryT > 0) { this.victoryT -= dt; if (this.victoryT <= 0) { this.victory(); return; } }
    if (this.mode && this.updateMode(dt)) return;
    const P = this.player;
    if (P.reloj) {                                                              // Reloj de Arena: al bajar del 30% de vida, la horda va más lenta 5 s (cada 30 s)
      P.relojCd = Math.max(0, (P.relojCd || 0) - dt); P.relojT = Math.max(0, (P.relojT || 0) - dt);
      if (P.relojT <= 0 && P.relojCd <= 0 && P.hp < P.maxHp * 0.3 && !P.dying) { P.relojT = 5; P.relojCd = 30; this.ui.toast('⌛ RELOJ DE ARENA · ENEMIGOS MÁS LENTOS', true); }
    }
    h.speed = (3.4 + Math.min(t0 * 0.01, 2.2) + Math.min(this.swarmLvl() * 0.12, 1)) * (this.storm > 0 ? 0.6 : 1) * (this.mods.fast ? 1.25 : 1) * (P.relojT > 0 ? 0.85 : 1);
    this.bossInv = Math.max(0, this.bossInv - dt); this.dodgeMsgT -= dt;
    // Combo: se pierde si pasan 3 s sin derribar a nadie
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) { this.combo = 0; p.comboMul = 1; } }
    this.impCd -= dt; this.impCd2 -= dt;
    // Eventos aleatorios (no en el mapa final)
    if (!S.final && S.fx !== 'time' && !this.saga) { this.eventT -= dt; if (this.eventT <= 0 && !this.tourney) { this.eventT = rand(110, 160); this.startEvent(pick(['senzu', 'rival', 'storm', 'ally'].concat(S.fx !== 'ring' ? ['torneo'] : []))); } }
    // Día y noche (Tierra y Planeta Vegeta): ciclo de 4 minutos
    if (S.night) this.updateNight(dt);
    if (this.storm > 0) {
      this.storm -= dt; if (this.storm <= 0) { this.setStorm(0); this.ui.toast('LA TORMENTA AMAINA', true); }
      // Tormenta de ki: caen rayos sobre los enemigos cercanos
      this.stormT = (this.stormT || 0) - dt;
      if (this.stormT <= 0 && h.n) {
        this.stormT = rand(0.5, 0.9);
        const i = (Math.random() * h.n) | 0, x = h.x[i], z = h.z[i];
        if (Math.hypot(x - p.x, z - p.z) < 30 && h.type[i] !== T_BOSS) {
          this.vfx.bolt(x, z, 16, 0x9fe8ff); DMG_SRC = 'otros'; h.damageRadius(x, z, 2.6, 22 * p.damageMul(), 8, this); SFX.play('zap');
        }
      }
    }
    // Namek: el agua de los lagos cura · Planeta Vegeta: los lagos son de lava y queman
    // Torneo del Poder: fuera del ring pierdes vida · Isla Kame: en el mar te mueves más lento
    if (S.fx === 'ring' || S.fx === 'sea') {
      const out = Math.hypot(p.x, p.z) > this.world.edge;
      if (S.fx === 'ring' && out) {
        if (!this.practice || p.hp > p.maxHp * 0.2) p.hp -= p.maxHp * 0.07 * dt;
        if (Math.random() < dt * 16) this.fx.sparks.emit(p.x + rand(-1, 1), 0.3, p.z + rand(-1, 1), 0, rand(3, 6), 0, 0.5, 0.3, 0, 0xb08aff);
        if (!this.edgeMsg) { this.edgeMsg = true; this.ui.toast('¡FUERA DEL RING! VUELVE DENTRO', true); SFX.play('warn'); }
      }
      if (S.fx === 'sea') {
        p.wade = out ? 0.6 : 1;
        if (out && Math.random() < dt * 10) this.fx.aura.emit(p.x + rand(-1, 1), 0.1, p.z + rand(-1, 1), 0, rand(1, 3), 0, 0.5, 0.2, 0, 0xcff0ff);
        if (out && !this.edgeMsg) { this.edgeMsg = true; this.ui.toast('EL MAR TE FRENA', true); }
      }
      if (!out) this.edgeMsg = false;
    }
    if (S.fx === 'lake' || S.lava) {
      let wet = false;
      for (const l of this.world.lakes) { const dx = p.x - l.x, dz = p.z - l.z; if (dx * dx + dz * dz < (l.r + (S.fx === 'lake' ? 2.5 : -1)) ** 2) { wet = true; break; } }
      if (wet && S.fx === 'lake') {
        p.hp = Math.min(p.maxHp, p.hp + 6 * dt);
        if (Math.random() < dt * 14) this.fx.aura.emit(p.x + rand(-1, 1), 0.2, p.z + rand(-1, 1), 0, rand(2, 4), 0, 0.5, 0.2, 0, 0x7fe8ff);
        if (!this.lakeMsg) { this.lakeMsg = true; this.ui.toast('EL AGUA DE NAMEK TE CURA', true); SFX.play('heal'); }
      } else if (wet) {
        if (!this.practice || p.hp > p.maxHp * 0.2) p.hp -= p.maxHp * 0.06 * dt;
        if (Math.random() < dt * 20) this.fx.sparks.emit(p.x + rand(-1, 1), 0.2, p.z + rand(-1, 1), 0, rand(3, 6), 0, 0.5, 0.3, 0, 0xff6a1a);
        if (!this.lakeMsg) { this.lakeMsg = true; this.ui.toast('¡LAVA! SAL DE AHÍ', true); SFX.play('hurt'); }
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
    if (this.bossUid) {
      this.bossAI(dt);
      const bi = h.indexOfUid(this.bossUid);                         // aura del jefe (más intensa en la última fase)
      if (bi >= 0) { const B = this.stage.boss, last = this.phase === B.pat.length - 1; this.vfx.aura('auraSS1', h.x[bi], h.z[bi], ENEMY_TYPES[T_BOSS].scale * 2.0, B.tintSprite === false ? B.tints[this.phase] : (B.col || B.tints[this.phase]), last ? 0.5 : 0.3, this.time); }
    }
    this.updateEnv(dt);

    const edt = dt * (p.charging ? CFG.CHARGE_TIME_SCALE : 1);      // cargar Ki ralentiza el mundo
    this.fx.load = h.n > 320 ? 0.55 : h.n > 200 ? 0.75 : 1;
    this.vfx.load = this.fx.q * this.fx.load;   // horda enorme o calidad baja: menos efectos menores
    h.update(edt, p, this);
    this.ki.update(dt, this);
    h.reap(this);                                                   // se retiran DESPUÉS de las colisiones
    h.buildGrid();
    if (this.booms.length) this.resolveBooms();                     // explosiones de los kamikaze
    this.orbs.update(dt, p, this);
    this.pickups.update(dt, p, this);
    this.capsules.update(dt, p, this);
    this.zoneBusy = null;
    this.points.update(dt, p, this);
    this.shots.update(dt, this);
    this.allies.update(dt, this);
    this.updateFusion(dt);
    this.updateRadar(dt);
    this.updateTourney(dt);
    this.updateSaga(dt);
    this.updateRival(dt);
    if (this.world.follow(p.x, p.z)) this.shadowDirty = true;

    // Enemigos que se quedan muy lejos reaparecen cerca (el mapa es grande)
    this.leashT -= dt;
    if (this.leashT <= 0) {
      this.leashT = 0.5;
      for (let i = 0; i < h.n; i++) {
        const dx = h.x[i] - p.x, dz = h.z[i] - p.z;
        if (dx * dx + dz * dz > 6400 && h.type[i] !== T_BOSS && !S.final) { this.spawnPos(32, 40); h.x[i] = this._sx; h.z[i] = this._sz; }
      }
    }

    if (p.hp <= 0) {
      if (p.canRevive) {                                           // Esfera de Reserva / deseo
        p.canRevive = false; p.reviveUsed = true; p.hp = p.maxHp * 0.5; p.iframes = 3;
        h.shockwave(p.x, p.z, 20, 30);
        this.fx.ring(this.fx.aura, p.x, 0.5, p.z, 60, 20, 0.8, 0.45, 0xffffff);
        this.ui.toast('¡RENACES!'); this.shake(1);
      } else {
        if (this.rivalUid && Save.d.rival && this.horde.uid.subarray(0, this.horde.n).includes(this.rivalUid)) { Save.d.rival.beatMe = true; Save.write(); }   // el rival te ha visto caer
        p.die(); this.state = 'dying'; this.releaseMouse();
      }
    }
    if (this.state === 'play' && this.pendingLevels > 0) this.openLevelUp();
    this.syncSprites();
  }

  loop() {
    requestAnimationFrame(this.loop);
    const rawDt = Math.min(this.clock.getDelta(), 0.05);              // delta time acotado
    const s = this.state;
    const vf = s === 'play' || s === 'dying' || s === 'transform' || s === 'transition' || s === 'menu' || s === 'intro' || s === 'ultcine' || s === 'bosscine' || s === 'talk';
    if (vf) this.vfx.begin(this.camera);
    if (s !== 'play' && s !== 'transform' && this.impT > 0) { this.impT = 0; this.renderer.domElement.style.filter = ''; }
    if (s === 'play' && IS_TOUCH && window.innerHeight > window.innerWidth) this.togglePause();   // móvil en vertical: pausa
    if (s === 'play') {
      this.updateUlt(rawDt);                                   // la secuencia de la Ultimate va en tiempo real (no se para con el hitstop)
      let dt = 0;
      if (this.hsCd > 0) this.hsCd -= rawDt;
      if (this.effCd > 0) this.effCd -= rawDt;
      if (this.hitstop > 0) this.hitstop -= rawDt; else dt = rawDt;
      if (dt > 0) this.update(dt);
      // Impact frame de crítico: negativo en B/N y luego destello de contraste
      if (this.impT > 0) {
        this.impT -= rawDt;
        // Con «reducir destellos» no hay negativo ni fogonazo: solo un leve aumento de contraste
        const soft = Save.d.opt.flash;
        this.renderer.domElement.style.filter = this.impT <= 0 ? '' : soft ? 'contrast(1.25) saturate(1.3)' : this.impT > 0.07 ? 'grayscale(1) contrast(9) invert(1)' : 'contrast(2.2) brightness(1.5) saturate(2)';
      }
      this.autoQuality(rawDt);
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
      if (this.transT > 0.7 && !this.transDone) { this.transDone = true; this.nextStage(this.riftTo); this.ui.el.fade.style.opacity = 0; }
      if (this.transT > 1.4) { this.state = 'play'; this.clock.getDelta(); }
    } else if (s === 'bosscine') {                                     // transformación del jefe
      this.updateBossCine(rawDt);
    } else if (s === 'talk') {                                         // diálogo del Modo Leyenda
      this.updateTalk(rawDt);
    } else if (s === 'intro' || s === 'ultcine') {                    // intro de la fusión / animación de la Ultimate, dentro del mapa
      (s === 'intro' ? this.intro : this.ultCine).update(rawDt);
      if (this.faceT > 0 && (this.faceT -= rawDt) <= 0 && this.faceGo) { const f = this.faceGo; this.faceGo = null; f(); }   // corte del retrato terminado
      const p = this.player;
      p.animT += rawDt; p.pose();
      this.fx.update(rawDt);
      this.syncSprites();
      this.updateCamera(rawDt, rawDt, false);
      this.ui.update(this, rawDt);
    } else if (s === 'menu') {
      this.menuLife(rawDt);
      this.player.menuHide = this.ui.screen !== 'home';
      this.player.animT += rawDt;
      this.player.pose();
      this.syncSprites();
      this.fx.update(rawDt);
      this.updateCamera(rawDt, rawDt, true);
    } else {                                                          // pausa, cartas, deseo, fin: mundo congelado
      this.updateCamera(0.0001, 0, false);
    }
    this.touch.update(this);
    this.pad.poll(rawDt);
    // Sombras del sol: solo se redibujan si el sol cambió de celda o se rompió un cristal (antes: cada 1-2 fotogramas)
    if (this.shadowDirty) { this.renderer.shadowMap.needsUpdate = true; this.shadowDirty = false; }
    if (vf) this.vfx.flush(s === 'play' ? (this.hitstop > 0 ? 0 : rawDt) : rawDt, this.player);
    // En el mapa del inicio no se ve el mundo 3D: no se dibuja (ahorra batería en el móvil)
    if (!(s === 'menu' && this.ui.screen === 'home' && this.ui.el.menu.classList.contains('show'))) this.renderer.render(this.scene, this.camera);
  }
}

/* ---------- ARRANQUE: decodifica las hojas, crea el juego y compila los shaders (con progreso en la pantalla de carga) ---------- */
(async function boot() {
  const L = window.LOAD || { step() {}, done() { const l = document.getElementById('loading'); if (l) l.style.display = 'none'; }, fail() {} };
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));   // deja pintar la barra entre fases
  let sheets = null;
  try {
    Save.load(); Save.checkDaily(); Save.checkWeekly(); Save.write();
    // Iconos de técnicas y objetos (sprites): una variable CSS con la hoja «icons»
    const ic = window.SPRITE_DATA && window.SPRITE_DATA.icons;
    if (ic) document.documentElement.style.setProperty('--icons', 'url(' + ic.src + ')');
    L.step('sheets', 0, 'Preparando sprites…');
    if (typeof THREE !== 'undefined') sheets = await loadSheets(SHEET_NAMES, (n, t) => L.step('sheets', n / t, 'Preparando sprites · ' + n + ' / ' + t));
  } catch (e) { console.error(e); }
  // Tipografías (si no llegan en 2,5 s se sigue sin esperar)
  if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
  L.step('world', 0.2, 'Generando el mundo…'); await frame();
  window.game = new Game(sheets);
  L.step('world', 1, 'Compilando efectos…'); await frame();
  const g = window.game;
  // Compila de antemano todos los shaders de la escena: así el primer efecto no da tirones
  try { if (g.renderer && g.scene) { g.renderer.compile(g.scene, g.camera); g.renderer.render(g.scene, g.camera); } } catch (e) { console.warn(e); }
  L.step('shaders', 1); await frame();
  L.done();
  if (g.ui && Save.checkLogin()) g.ui.showLogin();
})();
