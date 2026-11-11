'use strict';
/* =====================================================================
   ui.js · HUD, minimapa, cartas de mejora, menú principal
   (personajes / tienda), pausa y fin de partida. Solo DOM, sin Three.js.
   ===================================================================== */

const $ = (id) => document.getElementById(id);
/** Nombre en mayúsculas → «Tipo Título» para el menú (SON GOKU → Son Goku) */
const NICE_LOW = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'a', 'al']);
const nice = (t) => String(t).toLowerCase().replace(/(^|[\s\-·(«/])(\p{L}[\p{L}']*)/gu, (m, a, w, i) => a + (i > 0 && NICE_LOW.has(w) ? w : w[0].toUpperCase() + w.slice(1)));
const fmtTime = (s) => { s = Math.floor(s); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

class UIManager {
  constructor() {
    const ids = ['hpBar', 'hpTxt', 'kiBar', 'kiTxt', 'xpBar', 'xpTxt', 'lvl', 'formName', 'chName', 'kills', 'time', 'horde', 'fps', 'zeniHud', 'balls', 'goal', 'diffName',
      'biome', 'combo', 'comboN', 'comboBar', 'storm', 'power', 'tfBtn', 'tfName', 'tfSub', 'goalL', 'trait', 'pactTag', 'abTp', 'tpFill', 'abUlt', 'ultFill', 'stageName', 'zoneBox', 'zoneBar', 'zoneTxt', 'trade', 'bigmap', 'bigmapc', 'fade', 'controls', 'abDash', 'dashFill', 'abCharge', 'vignette', 'toast', 'feed', 'wstrip', 'bossBox', 'bossBar', 'bossName', 'mm', 'portrait', 'prompt', 'itemPop',
      'screen', 'scrBox', 'scrTitle', 'scrSub', 'scrStats', 'scrA', 'scrB', 'cards', 'cardTitle', 'cardSub', 'cardRow', 'cardFoot', 'menu', 'menuNav', 'menuBody', 'zeniMenu', 'cryMenu', 'exit', 'modal', 'fatal', 'hud'];
    this.el = {};
    for (const id of ids) this.el[id] = $(id);
    this.map = new WorldMap(this);                    // mapa del mundo del inicio
    this.flash = 0; this.fpsAcc = 0; this.fpsN = 0; this.fpsT = 0; this.wKey = ''; this.mmT = 0; this.lastBiome = -1;
    this.tab = 'upgrades'; this.mtab = 'missions'; this.rtab = 'all'; this.otab = 'global'; this.atab = 'login'; this.screen = 'home'; this.view = 'goku'; this.sheets = null; this.game = null; this.toastTimer = 0;
    this.cardHandlers = []; this.cardFocus = 0; this.cardAt = 0; this.hudT = 0; this.optMsg = ''; this.impArmed = false;
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
    // pixel art: se recorta al sprite (sin el hueco de la celda), se escala sin deformar y los pies van abajo
    const bb = this.frameBox(img, s, c, r), k = Math.min(W / bb.w, H / bb.h) * 0.94;
    const sx = c * s.w + bb.x, sy = r * s.h + bb.y, dw = bb.w * k, dh = bb.h * k, dx = (W - dw) / 2, dy = H - dh;
    g.drawImage(img, sx, sy, bb.w, bb.h, dx, dy, dw, dh);
    if (tint && tint !== 0xffffff) {                      // tinte (sprites provisionales recoloreados)
      g.globalCompositeOperation = 'multiply'; g.fillStyle = '#' + tint.toString(16).padStart(6, '0'); g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'destination-in'; g.drawImage(img, sx, sy, bb.w, bb.h, dx, dy, dw, dh);
      g.globalCompositeOperation = 'source-over';
    }
  }
  /** Caja ocupada por el sprite dentro de su celda (se calcula una vez por fotograma y se guarda) */
  frameBox(img, s, c, r) {
    const key = c + ',' + r, cache = (s.boxes = s.boxes || {});
    if (cache[key]) return cache[key];
    let box = { x: 0, y: 0, w: s.w, h: s.h };
    try {
      const cv = document.createElement('canvas'); cv.width = s.w; cv.height = s.h;
      const x = cv.getContext('2d'); x.drawImage(img, c * s.w, r * s.h, s.w, s.h, 0, 0, s.w, s.h);
      const d = x.getImageData(0, 0, s.w, s.h).data; let x0 = s.w, y0 = s.h, x1 = -1, y1 = -1;
      for (let y = 0; y < s.h; y++) for (let i = 0; i < s.w; i++) if (d[(y * s.w + i) * 4 + 3] > 20) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 >= 0) box = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    } catch (e) { /* lienzo bloqueado: se usa la celda entera */ }
    return (cache[key] = box);
  }
  /** Escribe texto/estilo solo si cambia (tocar el DOM en cada fotograma sin necesidad cuesta rendimiento) */
  setT(el, v) { if (el._t !== v) { el._t = v; el.textContent = v; } }
  setD(el, v) { if (el._d !== v) { el._d = v; el.style.display = v; } }
  setC(el, v) { if (el._c !== v) { el._c = v; el.className = v; } }
  setV(el, k, v) { const key = '_v' + k; if (el[key] !== v) { el[key] = v; el.style.setProperty(k, v); } }
  fatal(msg) { this.el.fatal.textContent = msg; this.el.fatal.style.display = 'flex'; }

  toast(text, small) {
    if (small) {
      // Avisos pequeños: lista discreta a un lado. Si se repite el último aviso, se suma (×2, ×3...) en vez de apilarlo
      const f = this.el.feed, last = f.lastChild;
      if (last && last._t === text) {
        last._n = (last._n || 1) + 1; last.textContent = text + '  ×' + last._n;
        last.style.animation = 'none'; void last.offsetWidth; last.style.animation = '';
        clearTimeout(last._k); last._k = setTimeout(() => { if (last.parentNode) last.parentNode.removeChild(last); }, 2200);
        return;
      }
      if (f.children.length > 3) f.removeChild(f.firstChild);          // como mucho 4 avisos a la vez
      const d = document.createElement('div');
      d._t = text; d.textContent = text; f.appendChild(d);
      d._k = setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 2200);
      return;
    }
    const t = this.el.toast;
    t.textContent = text; t.classList.remove('go'); void t.offsetWidth; t.classList.add('go');
  }

  /* ---------- HUD ---------- */
  showHud(on) { this.el.hud.style.display = on ? 'block' : 'none'; }
  /** Marcador de los modos de cristales (dentro del HUD): cristales ganados y reloj o número de jefe */
  modeHud(g) {
    let el = document.getElementById('modeHud');
    if (!g.mode) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'modeHud'; this.el.hud.appendChild(el); }
    const t = g.mode === 'rush' ? '⏳ ' + fmtTime(Math.max(0, Math.ceil(g.modeT))) : '♛ JEFE ' + (g.gN + (g.bossSpawned ? 1 : 0)) + (g.bossSpawned ? '' : ' · llega en ' + Math.max(0, Math.ceil(g.gNext)) + ' s');
    const h = '<b>' + MODES[g.mode].name + '</b><span class="crys"></span><em>' + g.modeCry + '</em><small>' + t + '</small>';
    if (el._h !== h) { el._h = h; el.innerHTML = h; }
  }

  /** Texto flotante sobre un punto del mundo (avisos de eficacia): un pequeño grupo de etiquetas que se reciclan */
  floatText(x, y, z, text, color, big) {
    if (!this.fl) {
      this.fl = []; this.flV = new THREE.Vector3();
      for (let k = 0; k < 6; k++) { const d = document.createElement('div'); d.className = 'ftxt'; this.el.hud.appendChild(d); this.fl.push({ d, t: 0, x: 0, y: 0, z: 0 }); }
    }
    let o = this.fl[0];
    for (const f of this.fl) if (f.t < o.t) o = f;                          // la más vieja (o una libre)
    o.t = 0.8; o.x = x; o.y = y; o.z = z;
    o.d.textContent = text; o.d.style.color = color; o.d.classList.toggle('fbig', !!big); o.d.style.display = 'block';
  }
  updateFloat(game, dt) {
    if (!this.fl) return;
    const W = window.innerWidth, H = window.innerHeight, v = this.flV;
    for (const f of this.fl) {
      if (f.t <= 0) continue;
      f.t -= dt;
      if (f.t <= 0) { f.d.style.display = 'none'; continue; }
      v.set(f.x, f.y + (0.8 - f.t) * 1.5, f.z).project(game.camera);           // sube poco a poco
      if (v.z > 1) { f.d.style.display = 'none'; continue; }
      f.d.style.transform = 'translate(' + ((v.x + 1) * 0.5 * W).toFixed(0) + 'px,' + ((1 - v.y) * 0.5 * H).toFixed(0) + 'px) translate(-50%,-50%)';
      f.d.style.opacity = Math.min(1, f.t * 3).toFixed(2);
    }
  }

  update(game, dt) {
    const p = game.player, e = this.el, T = this.setT.bind(this), D = this.setD.bind(this);
    this.updateFloat(game, dt);
    const sc = (el, v) => { const k = clamp(v, 0, 1).toFixed(3); if (el._s !== k) { el._s = k; el.style.transform = 'scaleX(' + k + ')'; } };
    sc(e.hpBar, p.hp / p.maxHp); sc(e.kiBar, p.ki / p.maxKi); sc(e.xpBar, p.xp / p.xpNext);
    T(e.hpTxt, Math.max(0, Math.ceil(p.hp)) + ' / ' + Math.ceil(p.maxHp));
    T(e.kiTxt, Math.floor(p.ki) + ' / ' + Math.round(p.maxKi));
    T(e.xpTxt, Math.floor(p.xp) + ' / ' + p.xpNext);
    T(e.lvl, String(p.level));
    // Fusionado: nombre de la fusión y segundos que le quedan
    if (p.fusion) { T(e.formName, 'FUSIÓN · ' + Math.ceil(p.fusion.t) + ' S'); T(e.chName, p.fusion.ch.name); }
    else { T(e.formName, p.form.name); T(e.chName, p.ch.name); }
    this.setV(e.formName, '--fc', '#' + (p.form.aura || 0xffe14a).toString(16).padStart(6, '0'));
    T(e.trait, p.trait ? p.trait.name.toUpperCase() + ' · ✚ ' + p.trait.good + ' · ✖ ' + p.trait.bad : '');
    if (e.trait._t !== e.trait.title) e.trait.title = e.trait._t;
    const PK = p.pact && PACTS.find((x) => x.id === p.pact);                    // pacto de Kami de esta partida
    T(e.pactTag, PK ? PK.icon + ' ' + PK.name.toUpperCase() + ' · ✚ ' + PK.good + ' · ✖ ' + PK.bad : '');
    // El resto del texto del HUD cambia poco: se refresca 10 veces por segundo
    this.hudT -= dt;
    const slow = this.hudT <= 0;
    if (slow) {
      this.hudT = 0.1;
      // Nivel de poder (lectura del scouter): vida, ki, daño y nivel
      T(e.power, Math.round((p.maxHp * 2 + p.maxKi) * p.damageMul() * (1 + p.level * 0.25) * 3).toLocaleString('es-ES'));
      T(e.kills, String(game.kills)); T(e.time, fmtTime(game.stageTime)); T(e.horde, String(game.horde.n));
      T(e.zeniHud, String(Math.floor(game.cash)));
      const S = game.stage;
      T(e.stageName, game.saga ? S.name : (game.step + 1) + '/' + ROUTE_LEN + ' · ' + S.name);
      let gl, gv, gc = '';
      if (game.saga && game.sagaBegun) { gl = 'CAP. ' + (game.saga.idx + 1); gv = game.sagaProg(); gc = '#ffc531'; }
      else if (game.practice) { gl = 'MODO'; gv = 'ENTRENAMIENTO'; gc = '#7fe07a'; }
      else if (S.final) { gl = 'OBJETIVO'; gv = 'DERROTA AL JEFE'; gc = '#ff6a8a'; }
      else if (S.bossAt && !game.bossSpawned) { gl = 'JEFE EN'; gv = fmtTime(Math.max(0, S.bossAt - game.stageTime)); gc = '#ff9ad8'; }
      else if (game.swarm) { gl = 'ENJAMBRE'; gv = '¡ACTIVO! +' + fmtTime(game.stageTime - game.swarmAt()); gc = '#ff4d5e'; }
      else { gl = 'ENJAMBRE EN'; gv = fmtTime(Math.max(0, game.swarmAt() - game.stageTime)); }
      T(e.goalL, gl); T(e.goal, gv); this.setV(e.goal, 'color', gc);
      T(e.diffName, (game.daily ? 'DESAFÍO DIARIO · ' : '') + game.diff.name + (game.chal ? ' · DESAFÍO ' + game.chal : '')); this.setV(e.diffName, 'color', game.diff.color);
      T(e.balls, game.pickups.collected + '/7' + (game.ballDist < 1e8 ? ' · ' + Math.round(game.ballDist) + ' m' : ''));   // Radar del Dragón: distancia a la esfera más cercana
      // Bioma actual (y si es de noche)
      const b = biomeAt(p.x, p.z);
      if (b !== this.lastBiome) { this.lastBiome = b; if (game.state === 'play' && game.time > 1) this.toast(BIOME_NAMES[b], true); }
      T(e.biome, (game.night > 0.5 ? '☾ ' : '') + BIOME_NAMES[b]);
    }
    // Aviso de transformación disponible (o de que puedes cambiar de forma)
    const nf = p.formReady >= 0 ? p.ch.forms[p.formReady] : null, can = game.canTransform();
    const nx = p.formOptions()[0];
    if (game.state === 'play' && nx !== undefined) {
      D(e.tfBtn, 'flex');
      const cost = p.tfCost(nx);
      T(e.tfSub, p.tfCd > 0 ? 'RECUPERANDO EL ALIENTO · ' + Math.ceil(p.tfCd) + ' s' : p.ki < cost ? 'CARGA KI [C] · ' + Math.floor(p.ki) + ' / ' + cost : can ? 'PUEDES TRANSFORMARTE [G]' : 'TRANSFORMACIÓN DISPONIBLE');
      e.tfBtn.classList.toggle('wait', !can);
      const f = p.ch.forms[nx];
      T(e.tfName, f.name); this.setV(e.tfBtn, '--fc', '#' + (f.aura || 0xffe14a).toString(16).padStart(6, '0'));
    } else D(e.tfBtn, 'none');
    // Racha de combo
    if (game.combo >= 5) {
      D(e.combo, 'block');
      if (e.comboN.textContent !== String(game.combo)) { e.comboN.textContent = game.combo; e.combo.classList.remove('bump'); void e.combo.offsetWidth; e.combo.classList.add('bump'); }
      sc(e.comboBar, game.comboT / 3);
      this.setV(e.combo, '--cc', game.combo >= 100 ? '#ff4a3a' : game.combo >= 50 ? '#ff9a00' : '#ffe14a');
    } else D(e.combo, 'none');
    // Barra de la Habitación del Tiempo
    const z = game.zoneBusy;
    if (z && game.state === 'play') { D(e.zoneBox, 'block'); sc(e.zoneBar, z.charge); T(e.zoneTxt, Math.floor(z.charge * 100) + '%'); } else D(e.zoneBox, 'none');
    this.updatePrompt(game);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    const lowHp = p.hp / p.maxHp < 0.3 ? 0.35 + Math.sin(game.time * 8) * 0.15 : 0;
    this.setV(e.vignette, 'opacity', Math.max(this.flash * 0.9, lowHp).toFixed(2));
    sc(e.dashFill, 1 - p.dashCd / (CFG.DASH_CD * p.dashMul || 1));
    this.setC(e.abDash, 'ab' + (p.ki < CFG.DASH_COST * p.dashCost ? ' low' : ''));
    this.setC(e.abCharge, 'ab' + (p.charging ? ' on' : ''));
    sc(e.tpFill, 1 - p.tpCd / p.tpMax);
    this.setC(e.abTp, 'ab' + (p.tpCd > 0 || p.ki < 35 ? ' low' : ''));
    // Ultimate: solo para los personajes que la tienen; se ilumina cuando está cargada
    if (p.ultD) {
      if (e.abUlt.style.display !== '') e.abUlt.style.display = '';
      sc(e.ultFill, p.ult / p.ultD.cost);
      this.setC(e.abUlt, 'ab' + (p.ult >= p.ultD.cost && p.ki >= Math.round(p.maxKi * ULT_KI * p.kiUse) ? ' on' : ''));
    } else if (e.abUlt.style.display !== 'none') e.abUlt.style.display = 'none';
    // FPS suavizado
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc >= 0.5) { T(e.fps, String(Math.round(this.fpsN / this.fpsAcc))); this.fpsAcc = 0; this.fpsN = 0; }
    // Barra del jefe
    const bi = game.bossUid ? game.horde.indexOfUid(game.bossUid) : -1;
    if (bi >= 0) { D(e.bossBox, 'block'); sc(e.bossBar, game.horde.hp[bi] / game.horde.maxHp[bi]); T(e.bossName, game.stage.boss.name + (game.stage.boss.forms ? ' · ' + game.stage.boss.forms[game.phase] : game.phase ? ' · FASE ' + (game.phase + 1) : '')); }
    else D(e.bossBox, 'none');
    this.updateStrip(game);
    this.mmT -= dt;
    if (this.mmT <= 0) { this.mmT = 0.05; this.drawMinimap(game, bi); if (game.showMap) this.paintMap(this.el.bigmapc.getContext('2d'), this.el.bigmapc.width, game, bi, true); }
    // La ayuda de controles se desvanece a los 20 s de partida (deja la pantalla limpia)
    this.setC(e.controls, game.time > 20 ? 'off' : '');
  }

  /** Aviso "[E] abrir cápsula" con su precio cuando estás cerca de una */
  updatePrompt(game) {
    const e = this.el.prompt, info = game.state === 'play' ? game.promptInfo() : null;
    if (!info) { this.setD(e, 'none'); return; }
    this.setD(e, 'block'); this.setC(e, info.ok ? '' : 'no');
    this.setT(e, info.t);
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
    // Técnicas: casillas grandes con su nivel (las fusiones brillan en rojo)
    let h = '<div class="wrow tech">';
    for (const w of game.weapons.list) {
      const W = WEAPONS[w.id];
      let pips = ''; if (!W.fusion) for (let k = 1; k <= MAX_WEAPON_LEVEL; k++) pips += '<s class="' + (k <= w.lv ? 'on' : '') + '"></s>';
      h += '<div class="wt' + (W.fusion ? ' fu' : W.unique ? ' uq' : '') + '" title="' + W.name + (W.fusion ? ' (fusión)' : ' · nv ' + w.lv) + '"><i>' + W.icon + '</i><u>' + (W.fusion ? '<s class="on" style="width:20px"></s>' : pips) + '</u></div>';
    }
    h += '</div>';
    // Pasivas (vitaminas y objetos): pequeñas y como mucho 2 filas; el resto se resume en «+N»
    const pas = [];
    for (const st of STATS) if (p.stacks[st.id]) pas.push('<div class="wp" title="' + st.name + ' x' + p.stacks[st.id] + '">' + st.icon + '<b>' + p.stacks[st.id] + '</b></div>');
    for (const id in p.items) { const it = itemById(id), c = RARITIES[it.rarity].color; pas.push('<div class="wp" style="border-color:' + c + ';color:' + c + '" title="' + it.name + ' x' + p.items[id] + '">' + it.icon + (p.items[id] > 1 ? '<b>' + p.items[id] + '</b>' : '') + '</div>'); }
    const MAXP = 15;
    if (pas.length) h += '<div class="wrow pas">' + pas.slice(0, pas.length > MAXP + 1 ? MAXP : MAXP + 1).join('') + (pas.length > MAXP + 1 ? '<div class="wp more" title="Mira la lista completa en la pausa (TAB)">+' + (pas.length - MAXP) + '</div>' : '') + '</div>';
    this.el.wstrip.innerHTML = h;
  }

  /** Radar local: zona de unos 50 m alrededor del jugador, girado con la cámara (arriba = hacia donde miras).
      Muestra enemigos, cápsulas, semillas, esferas, puntos de interés, disparos y avisos; lo lejano se marca en el borde */
  drawMinimap(game, bossIdx) {
    const g = this.mmCtx;
    if (!g) return;
    const N = this.el.mm.width, C = N / 2, R0 = 42, S = C / R0, p = game.player, w = game.world, R = CFG.ARENA, t = game.time;
    const c = Math.cos(game.camYaw), s = Math.sin(game.camYaw), px = p.x, pz = p.z, lim = R0 * 1.45;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#0a0f1e'; g.fillRect(0, 0, N, N);
    // Terreno: la imagen del mapa entero, girada y ampliada alrededor del jugador
    if (w.mini) {
      const k = (2 * R) / w.mini.width, a = S * k;
      g.imageSmoothingEnabled = true;
      g.setTransform(a * c, a * s, -a * s, a * c, C + S * ((-R - px) * c - (-R - pz) * s), C + S * ((-R - px) * s + (-R - pz) * c));
      g.drawImage(w.mini, 0, 0);
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
    g.fillStyle = 'rgba(4,8,24,.38)'; g.fillRect(0, 0, N, N);       // oscurece el terreno para que resalten los puntos
    // Borde del mapa
    g.strokeStyle = 'rgba(255,60,60,.7)'; g.lineWidth = 2; g.beginPath();
    for (const [ax, az] of [[-R, -R], [R, -R], [R, R], [-R, R], [-R, -R]]) { const dx = ax - px, dz = az - pz; g.lineTo(C + (dx * c - dz * s) * S, C + (dx * s + dz * c) * S); }
    g.stroke();
    if (game.night > 0.05) { g.fillStyle = 'rgba(5,8,40,' + (0.45 * game.night).toFixed(2) + ')'; g.fillRect(0, 0, N, N); }
    // Anillos de distancia (15 y 30 m)
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1;
    for (const r of [15, 30]) { g.beginPath(); g.arc(C, C, r * S, 0, 6.2832); g.stroke(); }
    const pos = (x, z) => { const dx = x - px, dz = z - pz; this._mx = C + (dx * c - dz * s) * S; this._my = C + (dx * s + dz * c) * S; return Math.abs(dx) < lim && Math.abs(dz) < lim; };
    const inBox = () => this._mx > 2 && this._mx < N - 2 && this._my > 2 && this._my < N - 2;
    const dot = (x, z, sz, col) => { if (pos(x, z) && inBox()) { g.fillStyle = col; g.fillRect(this._mx - sz / 2, this._my - sz / 2, sz, sz); } };
    // Lleva al borde del radar lo que está fuera (jefes, grietas, esferas y puntos de interés)
    const edge = (x, z, col, label, size) => {
      const dx = x - px, dz = z - pz, sx = (dx * c - dz * s) * S, sy = (dx * s + dz * c) * S, m = C - 9, f = Math.max(Math.abs(sx), Math.abs(sy)) / m;
      const ex = C + (f > 1 ? sx / f : sx), ey = C + (f > 1 ? sy / f : sy);
      g.fillStyle = col; g.strokeStyle = '#000'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(ex, ey, size || 6, 0, 6.2832); g.fill(); g.stroke();
      if (label) { g.fillStyle = '#000'; g.font = 'bold ' + Math.round((size || 6) * 1.4) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, ex, ey + 0.5); }
    };
    // Recogibles: orbes de experiencia, semillas y cápsulas
    const o = game.orbs;
    for (let i = 0; i < o.n; i++) dot(o.x[i], o.z[i], 4, '#57f0ff');
    const pk = game.pickups;
    for (let i = 0; i < pk.sn; i++) dot(pk.sx[i], pk.sz[i], 5, '#9cff6a');
    const CC = ['#ff7ad0', '#ffd24a', '#b050ff'], cp = game.capsules;
    for (let i = 0; i < cp.n; i++) if (pos(cp.x[i], cp.z[i]) && inBox()) { g.fillStyle = CC[cp.gold[i]]; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.arc(this._mx, this._my, cp.gold[i] ? 6 : 5, 0, 6.2832); g.fill(); g.stroke(); }
    // Enemigos por tipo
    const h = game.horde, EC = ['#ff3a3a', '#7fe0ff', '#ff9a5a', '#ff2050', '#ffc83a', '#6aff3a', '#8ab0ff', '#ff8af0'], ES = [6, 6, 9, 12, 11, 7, 8, 7];
    for (let i = 0; i < h.n; i++) { const ty = h.type[i]; if (ty !== T_BOSS) dot(h.x[i], h.z[i], ES[ty], EC[ty]); }
    // Disparos enemigos y zonas marcadas (peligro)
    for (const sh of game.shots.s) if (sh.on) dot(sh.x, sh.z, 3, '#ff4070');
    for (const m of game.shots.marks) if (m.on && pos(m.x, m.z)) { g.strokeStyle = '#ff3050'; g.lineWidth = 2; g.beginPath(); g.arc(this._mx, this._my, m.r * S, 0, 6.2832); g.stroke(); }
    // Compañeros
    for (const a of game.allies.list) dot(a.x, a.z, 7, '#7fe07a');
    // Puntos de interés (se ven también en el borde si están lejos)
    const PC = { boss: '#ff3050', time: '#6fd0ff', temple: '#5be07a', merchant: '#ffd24a', swapper: '#ff9a3a', gacha: '#ff7a1a' }, PL = { boss: '!', time: '⧗', temple: '▲', merchant: 'B', swapper: 'R', gacha: '★' };
    for (const q of game.points.list) {
      if (q.used && !POI_REUSE.has(q.type)) continue;
      edge(q.x, q.z, PC[q.type], PL[q.type], 7);
    }
    for (let i = 0; i < 7; i++) if (!pk.got[i] && (p.ballSight || Math.hypot(pk.bx[i] - p.x, pk.bz[i] - p.z) < BALL_SEE)) edge(pk.bx[i], pk.bz[i], '#ffb030', '★', 6);   // esferas: solo de cerca
    for (const r of game.points.rifts) edge(r.x, r.z, '#' + r.col.toString(16).padStart(6, '0'), '◎', 8 + Math.sin(t * 6));
    const ri = game.rivalUid ? h.indexOfUid(game.rivalUid) : -1;
    if (ri >= 0) edge(h.x[ri], h.z[ri], '#ff9a00', '⚔', 7);
    if (bossIdx >= 0) edge(h.x[bossIdx], h.z[bossIdx], '#ff2050', '☠', 9 + Math.sin(t * 8) * 1.5);
    // Jugador (flecha hacia arriba = hacia donde mira la cámara) y norte
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(C, C - 9); g.lineTo(C + 7, C + 7); g.lineTo(C, C + 3); g.lineTo(C - 7, C + 7); g.closePath(); g.stroke(); g.fill();
    g.fillStyle = '#ff5a5a'; g.font = 'bold 14px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('N', C + s * (C - 12), C - c * (C - 12));
  }

  /** Dibuja el mapa (minimapa o mapa grande): cápsulas (normal/dorada/maldita), santuarios, comerciantes, altar, grieta y jefe */
  paintMap(g, N, game, bossIdx, big) {
    if (!g) return;
    const w = game.world, p = game.player, R = CFG.ARENA, X = (v) => ((v / R + 1) / 2) * N, k = big ? 2 : 1, t = game.time;
    g.clearRect(0, 0, N, N);
    if (w.mini) g.drawImage(w.mini, 0, 0, N, N);
    const sq = (x, z, s, c) => { g.fillStyle = c; g.fillRect(X(x) - s / 2, X(z) - s / 2, s, s); };
    for (let i = 0; i < 7; i++) if (!game.pickups.got[i] && (p.ballSight || Math.hypot(game.pickups.bx[i] - p.x, game.pickups.bz[i] - p.z) < BALL_SEE)) sq(game.pickups.bx[i], game.pickups.bz[i], 3 * k, '#ffd84a');
    const CC = ['#ff7ad0', '#ffd24a', '#b050ff'];
    for (let i = 0; i < game.capsules.n; i++) sq(game.capsules.x[i], game.capsules.z[i], (game.capsules.gold[i] ? 3 : 2) * k, CC[game.capsules.gold[i]]);
    const PC = { boss: '#ff3050', time: '#6fd0ff', temple: '#5be07a', merchant: '#ffd24a', swapper: '#ff9a3a', gacha: '#ff7a1a' };
    for (const o of game.points.list) {
      const used = o.used && !POI_REUSE.has(o.type), s = 5 * k, c = used ? '#667' : PC[o.type];
      g.fillStyle = c; g.strokeStyle = '#000'; g.lineWidth = 1;
      const cx = X(o.x), cy = X(o.z);
      g.beginPath();
      if (o.type === 'boss') { g.moveTo(cx, cy - s); g.lineTo(cx + s, cy); g.lineTo(cx, cy + s); g.lineTo(cx - s, cy); g.closePath(); }
      else if (o.type === 'time') g.arc(cx, cy, s * 0.8, 0, 6.3);
      else if (o.type === 'temple') { g.moveTo(cx, cy - s); g.lineTo(cx + s, cy + s * 0.8); g.lineTo(cx - s, cy + s * 0.8); g.closePath(); }
      else g.rect(cx - s * 0.7, cy - s * 0.7, s * 1.4, s * 1.4);
      g.fill(); g.stroke();
      if (big) { g.fillStyle = '#fff'; g.font = '800 12px "Baloo 2",sans-serif'; g.fillText(o.type === 'merchant' ? 'BULMA' : o.type === 'swapper' ? 'ROSHI' : o.type === 'gacha' ? 'GACHAPÓN' : o.type === 'boss' ? 'ALTAR' : o.type === 'time' ? 'TIEMPO' : 'TEMPLO', cx + s + 3, cy + 3); }
    }
    for (const r of game.points.rifts) {
      const pulse = 5 * k + Math.sin(t * 6) * 2;
      g.fillStyle = '#' + r.col.toString(16).padStart(6, '0'); g.strokeStyle = '#fff'; g.beginPath(); g.arc(X(r.x), X(r.z), pulse, 0, 6.3); g.fill(); g.stroke();
      if (big) { g.fillStyle = '#fff'; g.font = '800 13px "Baloo 2",sans-serif'; g.fillText('GRIETA · ' + STAGES[r.to].name, X(r.x) + pulse + 3, X(r.z) + 3); }
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
  showCards(title, sub, cards, onPick, foot) {
    const e = this.el;
    e.cardFoot.innerHTML = foot || '';
    e.cardTitle.textContent = title; e.cardSub.textContent = sub;
    let h = '';
    cards.forEach((c, i) => {
      let pips = '';
      if (c.max) for (let k = 1; k <= c.max; k++) pips += '<u class="' + (k <= c.lv ? 'on' : '') + '"></u>';
      h += '<button class="card ' + c.type + (c.tier ? ' r' + c.tier : '') + '" data-i="' + i + '"' + (c.tier ? ' style="--rc:' + CARD_TIERS[c.tier].col + '"' : '') + '><em>' + (i + 1) + '</em><span class="ci">' + c.icon + '</span><small>' + c.tag + '</small><b>' + c.title + '</b><p>' + c.text + '</p><div class="pips">' + pips + '</div></button>';
    });
    e.cardRow.innerHTML = h;
    this.cardHandlers = cards.map((c, i) => () => onPick(c, i));
    e.cards.classList.add('show');
    this.cardAt = performance.now(); this.cardFocus = 0; this.focusCard(0);
  }
  /** Mueve el foco entre las cartas (flechas o mando) */
  focusCard(d) {
    const list = this.el.cardRow.children, n = list.length;
    if (!n) return;
    this.cardFocus = (this.cardFocus + d + n) % n;
    for (let i = 0; i < n; i++) list[i].classList.toggle('focus', i === this.cardFocus);
  }
  pickCard(i) { const f = this.cardHandlers[i]; if (f) f(); }
  hideCards() { this.el.cards.classList.remove('show'); this.cardHandlers = []; }
  cardsOpen() { return this.el.cards.classList.contains('show'); }

  /* ---------- Menú principal (estilo PokéBonk: cabecera de color, paneles azul noche y el mundo 3D detrás) ---------- */
  showMenu(game) {
    this.game = game;
    this.view = Save.d.sel;
    this.el.menu.classList.add('show');
    this.showHud(false);
    this.renderMenu();
  }
  hideMenu() { this.el.menu.classList.remove('show'); if (this.map) this.map.unmount(); }
  /** Destello de la Teletransportación al cambiar de pantalla */
  itFlash() {
    const f = document.getElementById('itfx');
    if (!f) return;
    f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
  }
  claimable() {
    let n = 0;
    for (const m of MISSIONS) {
      if (m.daily && !Save.d.daily.ids.includes(m.id)) continue;
      if (!Save.isClaimed(m) && Save.progress(m) >= m.goal) n++;
    }
    return n;
  }

  /** Cada pantalla rellena this.hdr = { t: título, s: subtítulo, c: color de la cabecera, tabs: pestañas } y su cuerpo */
  renderMenu() {
    const e = this.el, s = this.screen;
    e.zeniMenu.textContent = Save.d.zeni.toLocaleString('es-ES');
    e.cryMenu.textContent = (Save.d.crystals || 0).toLocaleString('es-ES');
    e.menu.classList.toggle('ishome', s === 'home');
    this.hdr = { t: '', s: '', c: '', tabs: '' };
    const R = { home: this.renderHome, legend: this.renderLegend, play: this.renderPlay, shop: this.renderShopScreen, stats: this.renderStatsScreen, options: this.renderOptions,
      records: this.renderRecords, summon: this.renderSummon, account: this.renderAccount, credits: this.renderCredits, missions: this.renderMissions };
    (R[s] || this.renderMissions).call(this);
    const H = this.hdr;
    const KJ = { play: '戦', legend: '龍', shop: '店', missions: '亀', records: '武', summon: '願', stats: '計', options: '設', account: '名', credits: '謝' };
    e.menu.dataset.kj = s === 'home' ? '' : (this.hdr.k || KJ[s] || '気');
    e.menuNav.innerHTML = s === 'home' ? this.homeBar()
      : '<button class="back" ' + (H.back || 'data-go="home"') + '><i>◀</i>' + (H.back ? 'Volver' : 'Mapa') + '</button><div class="bnr ' + H.c + '"' + (H.st ? ' style="' + H.st + '"' : '') + '><i class="kj">' + (H.k || KJ[s] || '気') + '</i><h3>' + H.t + '</h3>' + (H.s ? '<span>' + H.s + '</span>' : '') + '</div>' + (H.tabs ? '<div class="seg nav">' + H.tabs + '</div>' : '');
    // Retratos: se dibujan después de generar el HTML
    for (const cv of e.menu.querySelectorAll('canvas[data-sheet]')) this.drawFrame(cv, cv.dataset.sheet, +cv.dataset.frame, +(cv.dataset.tint || 0));
    // El mapa del inicio tiene su propia animación (solo mientras se ve)
    const wm = s === 'home' && e.menuBody.querySelector('.wm');
    if (wm) this.map.mount(wm); else this.map.unmount();
  }
  /** Botones de pestaña dentro de un selector .seg */
  segTabs(list, cur, attr) { return list.map((x) => '<button class="tab' + (cur === x[0] ? ' on' : '') + '" data-' + attr + '="' + x[0] + '">' + x[1] + '</button>').join(''); }
  /** Canvas con el retrato de un personaje (se dibuja en renderMenu) */
  pic(c, w, h) { return c && c.portrait ? '<canvas width="' + (w || 108) + '" height="' + (h || 79) + '" data-sheet="' + c.portrait.sheet + '" data-frame="' + c.portrait.frame + '" data-tint="' + (c.portrait.tint || 0) + '"></canvas>' : ''; }
  /** Tiempo que falta para que se renueven las misiones diarias (medianoche) */
  untilReset() {
    const now = new Date(), m = new Date(now); m.setHours(24, 0, 0, 0);
    const min = Math.max(0, Math.round((m - now) / 60000));
    return Math.floor(min / 60) + ' h ' + (min % 60) + ' min';
  }
  /** Tipo de combate del personaje según su ataque físico y de ki: 'f' físico, 'k' ki, 'e' equilibrado */
  charType(c) { const f = c.atkF || 1, k = c.atkK || 1; return f > k + 0.04 ? 'f' : k > f + 0.04 ? 'k' : 'e'; }
  /** Barra superior del inicio (sobre el mapa): logo y accesos rápidos */
  homeBar() {
    return '<div class="wlogo"><b>DRAGON BALL</b><span>ULTIMATE SURVIVOR</span></div>' +
      '<div class="wico"><span class="wchip" title="Días seguidos entrando">🔥 ' + Save.d.login.streak + '</span>' +
      '<button class="wib" data-go="stats" title="Rastreador: tus estadísticas"><i class="scout"></i><span>Rastreador</span></button>' +
      '<button class="wib" data-go="account" title="Cuenta"><i>👤</i><span>' + this.accountLabel() + '</span></button>' +
      '<button class="wib" data-go="options" title="Opciones"><i>⚙</i></button><button class="wib" data-go="credits" title="Créditos"><i>★</i></button><button class="wib" data-exit title="Salir"><i>⏻</i></button></div>';
  }
  /** Fila de clasificación: puesto, retrato, nombre (con etiqueta) y puntuación */
  rankRow(i, c, name, sub, score, me, chip) {
    return '<div class="rr' + (i < 3 ? ' top' + i : '') + (me ? ' me' : '') + '"><em>' + (i + 1) + '</em><div class="rav">' + this.pic(c, 72, 72) + '</div>' +
      '<div class="rn"><b>' + (chip || '') + name + '</b><small>' + sub + '</small></div><b>' + score + '</b></div>';
  }

  /* ---------- Inicio: el mapa del mundo ---------- */
  renderHome() {
    const sel = charById(Save.d.sel), d = diffById(Save.d.diff), n = this.claimable(), mods = dailyMods(), rank = Save.d.rank;
    const D = Save.d.day && Save.d.day.date === todayStr() ? Save.d.day : null;
    const own = CHARACTERS.filter((c) => !c.soon && Save.d.unlocked.includes(c.id)).length, tot = CHARACTERS.filter((c) => !c.soon).length;
    const stars = BOOKS.reduce((sum, B) => sum + bookStars(B.idx), 0);
    // Lo que se ve en el cartel de cada lugar (dato útil + aviso)
    const info = {
      lookout: [storyDone() + ' / ' + BOOKS.length + ' libros · ★ ' + stars, 0],
      kaio: ['Prueba técnicas sin presión', 0],
      karin: [mods[0].icon + ' ' + mods[0].name + (D ? ' · Hoy ' + D.best.toLocaleString('es-ES') : ' · +300'), D ? 0 : '!'],
      paoz: [own + ' / ' + tot + ' guerreros', 0],
      kame: [n ? n + ' premio' + (n > 1 ? 's' : '') + ' por cobrar' : 'Encargos del Maestro Roshi', n],
      cc: ['Mejoras, objetos y técnicas', 0],
      tenka: [rank.length ? 'Récord: ' + rank[0].score.toLocaleString('es-ES') : 'Aún sin marcas', 0],
      altar: ['◆ ' + (Save.d.crystals || 0).toLocaleString('es-ES') + ' · cambia en ' + Math.ceil(bannerNow().left / 864e5) + ' d', (Save.d.crystals || 0) >= GACHA_COST10 ? '!' : 0],
      cellring: [(Save.d.zstats && Save.d.zstats.wins ? Save.d.zstats.wins + ' victorias' : 'Lucha 2D con 37 guerreros'), 0]
    };
    const pins = PLACES.map((p) => '<button class="wpin" data-place="' + p.id + '"><span class="wk">' + p.kanji + '</span><span class="wtx"><b>' + p.name + '</b><em>' + p.sub + '</em><small>' + info[p.id][0] + '</small></span>' +
      (info[p.id][1] ? '<span class="badge">' + info[p.id][1] + '</span>' : '') + '</button>').join('');
    this.el.menuBody.innerHTML = '<div class="wm"><canvas class="wmc"></canvas>' + pins +
      '<div class="wav" aria-hidden="true"><i class="aur"></i>' + this.pic(sel, 84, 84) + '</div>' +
      '<div class="wbot"><button class="wme" data-go="play"><span class="wpt">' + this.pic(sel, 84, 84) + '</span><span class="wmt"><small>Tu guerrero</small><b>' + nice(sel.name) + '</b><em>' + nice(d.name) + ' · cambiar</em></span></button>' +
      '<button class="wgo" data-start><span class="dball"></span><b>¡A luchar!</b></button>' +
      '<p class="whint">Toca un lugar y tu guerrero irá con la <b>Teletransportación</b></p></div></div>';
  }

  /* ---------- Modo Leyenda: biblioteca de libros (sagas) y cada libro con sus capítulos ---------- */
  /** Retrato de un personaje para el Modo Leyenda (canvas cuadrado; la forma puede ser otra hoja) */
  storyPic(c, sheet, w) { return c ? '<canvas width="' + (w || 96) + '" height="' + (w || 96) + '" data-sheet="' + (sheet || c.portrait.sheet) + '" data-frame="' + (sheet ? 0 : c.portrait.frame) + '"></canvas>' : ''; }
  /** Retrato de un rival: luchador (hoja de su forma) o jefe (su fila de la hoja de jefes) */
  bossPic(B, w) {
    if (!B) return '';
    if (B.fighter) return this.storyPic(charById(B.fighter), B.sheet, w);
    const s = this.sheets && this.sheets[B.sheet];
    return s ? '<canvas width="' + (w || 96) + '" height="' + (w || 96) + '" data-sheet="' + B.sheet + '" data-frame="' + ((B.rows ? B.rows[0] : B.row) * s.cols) + '"></canvas>' : '';
  }
  drawPics(el) { for (const cv of el.querySelectorAll('canvas[data-sheet]')) this.drawFrame(cv, cv.dataset.sheet, +cv.dataset.frame, +(cv.dataset.tint || 0)); }
  starsHtml(n, max) { let h = ''; for (let i = 0; i < (max || 3); i++) h += '<i class="' + (i < n ? 'on' : '') + '">★</i>'; return h; }
  renderLegend() {
    if (this.book != null && BOOKS[this.book] && bookOpen(this.book)) return this.renderBook(BOOKS[this.book]);
    this.book = null;
    const all = STORY_CHAPTERS.length, st = BOOKS.reduce((s, B) => s + bookStars(B.idx), 0);
    this.hdr = { t: 'Modo Leyenda', s: storyDone() + ' de ' + BOOKS.length + ' libros · ★ ' + st + ' / ' + all * 3, c: 'c-pur' };
    const covers = BOOKS.map((B, i) => {
      const open = bookOpen(i), done = bookDone(i), n = B.chapters.length, nd = B.chapters.filter(chapDone).length, s = bookStars(i);
      return '<button class="bk' + (open ? '' : ' lk') + (done ? ' dn' : '') + '" data-book="' + i + '" style="--b1:' + B.col + ';--b2:' + B.col2 + '"' + (open ? '' : ' disabled') + '>' +
        '<span class="bkn">Libro ' + (i + 1) + '</span>' +
        '<span class="bkart"><span class="bkh">' + this.storyPic(charById(B.cover[0])) + '</span><span class="bkv">' + this.storyPic(charById(B.cover[1])) + '</span></span>' +
        '<span class="bkt"><b>' + nice(B.name) + '</b><small>' + B.sub + '</small></span>' +
        '<span class="bkp"><i style="width:' + (nd / n * 100) + '%"></i></span>' +
        '<span class="bkf"><span>' + nd + '/' + n + ' capítulos</span><span class="bks">★ ' + s + '/' + n * 3 + '</span></span>' +
        (done ? '<span class="bkr">Completado</span>' : '') + (open ? '' : '<span class="bkl">🔒<small>Completa el libro ' + i + '</small></span>') + '</button>';
    }).join('');
    this.el.menuBody.innerHTML = '<div class="lib"><div class="shelf">' + covers + '</div></div>';
  }
  /** Un libro abierto: portada, premio y capítulos a la izquierda; el capítulo elegido a la derecha con su «VS» */
  renderBook(B) {
    const n = B.chapters.length, nd = B.chapters.filter(chapDone).length;
    if (this.lchap == null || !B.chapters[this.lchap] || !chapOpen(B.chapters[this.lchap])) {
      const k = B.chapters.findIndex((C) => chapOpen(C) && !chapDone(C)); this.lchap = k < 0 ? 0 : k;
    }
    const C = B.chapters[this.lchap], hero = charById(C.ch), boss = chapBoss(C), sv = chapSave(C), mask = sv ? sv.mask || 0 : 0, prize = charById(B.prize);
    const dark = (hx) => '#' + hx.slice(1).match(/../g).map((x) => Math.round(parseInt(x, 16) * 0.62).toString(16).padStart(2, '0')).join('');
    this.hdr = { t: nice(B.name), s: B.sub, c: '', st: '--bg:linear-gradient(100deg,' + B.col + ',' + B.col2 + ');--be:' + dark(B.col), back: 'data-book="-1"' };
    const GI = { kills: '☠', survive: '⏱', balls: '<span class="dball"></span>', hunt: '◎', level: '⬆', tourney: '♛', boss: '⚔', hold: '⏱' };
    const rows = B.chapters.map((X, j) => {
      const o = chapOpen(X), d = chapDone(X);
      return '<button class="chr' + (j === this.lchap ? ' on' : '') + (d ? ' dn' : '') + (o ? '' : ' lk') + '" data-lchap="' + j + '"' + (o ? '' : ' disabled') + '><em>' + (d ? '✓' : j + 1) + '</em>' +
        '<span class="chp">' + (o ? this.storyPic(charById(X.ch), null, 72) : '🔒') + '</span><span class="cht"><b>' + (o ? X.name : '???') + '</b><small>' + (o ? GI[X.goal.type] + ' ' + X.goal.text : 'Completa el capítulo anterior') + '</small></span>' +
        '<span class="chs">' + this.starsHtml(chapStars(X)) + '</span></button>';
    }).join('');
    const vsR = boss ? this.bossPic(boss, 160) : '<u class="vsh">' + GI[C.goal.type] + '</u>';
    const vsRn = boss ? nice(boss.name) : { kills: 'La horda', survive: 'Supervivencia', balls: 'Las esferas', hunt: 'Cacería', level: 'Entrenamiento', tourney: 'El torneo' }[C.goal.type];
    const conds = starTexts(C).map((t, i) => '<div class="' + (mask & (1 << i) ? 'ok' : '') + '"><i>★</i>' + t + '</div>').join('');
    this.el.menuBody.innerHTML = '<div class="bv" style="--b1:' + B.col + ';--b2:' + B.col2 + '">' +
      '<div class="pnl bvl"><div class="bvh"><span class="bkart"><span class="bkh">' + this.storyPic(charById(B.cover[0])) + '</span><span class="bkv">' + this.storyPic(charById(B.cover[1])) + '</span></span>' +
        '<div class="bvi"><span class="k2">Libro ' + (B.idx + 1) + ' de ' + BOOKS.length + '</span><b>' + nd + ' / ' + n + ' capítulos</b><span class="bkp"><i style="width:' + (nd / n * 100) + '%"></i></span><span class="bks">★ ' + bookStars(B.idx) + ' / ' + n * 3 + '</span></div></div>' +
        '<p class="bvd">' + B.desc + '</p>' +
        '<div class="bvz"><span class="bzp">' + this.storyPic(prize, null, 72) + '</span><div><span class="k2">Premio del libro</span><b>' + (bookDone(B.idx) ? '✓ Conseguido' : 'Desbloquea a ' + nice(prize.name)) + '</b><small>' + (Save.d.unlocked.includes(prize.id) && !bookDone(B.idx) ? 'Ya lo tienes: te darán 1500 monedas' : 'Completa todos los capítulos') + '</small></div></div>' +
        '<div class="chl">' + rows + '</div></div>' +
      '<div class="pnl bvr"><div class="vs"><div class="vsl">' + this.storyPic(hero, null, 160) + '<b>' + nice(hero.name) + '</b></div><div class="vsx">VS</div><div class="vsr">' + vsR + '<b>' + vsRn + '</b></div></div>' +
        '<div class="cdt"><span class="k2">Capítulo ' + (C.idx + 1) + ' de ' + n + ' · ' + nice(STAGES[C.stage].name) + '</span><h2>' + C.name + '</h2><p>' + C.story + '</p>' +
        '<div class="cch"><span class="chip p">' + GI[C.goal.type] + ' ' + C.goal.text + '</span>' + (C.lvl > 1 ? '<span class="chip b">Empiezas en NV ' + C.lvl + '</span>' : '') + '<span class="chip y"><span class="coin"></span> ' + (sv ? 'Completado' : '+' + C.reward) + '</span>' + (Save.d.unlocked.includes(hero.id) ? '' : '<span class="chip o">Solo en este capítulo</span>') + '</div>' +
        '<div class="cst">' + conds + '</div>' +
        '<div class="cgo"><button class="go" data-start="chap:' + C.id + '"><span class="dball"></span>' + (sv ? 'Volver a jugar' : 'Jugar capítulo') + '</button><span>' + (sv && sv.best ? 'Mejor tiempo ' + fmtTime(sv.best) : '+50 monedas por cada estrella nueva') + '</span></div></div></div></div>';
  }
  /** Tarjeta del desafío diario: modificadores de hoy, tu mejor puntuación y botón para jugar */
  dailyCard() {
    const mods = dailyMods(), D = Save.d.day && Save.d.day.date === todayStr() ? Save.d.day : null, sel = charById(Save.d.sel);
    return '<div class="hcard"><h4>☀ Desafío diario · ' + todayStr().split('-').reverse().join('/') + '</h4>' +
      mods.map((m) => '<div class="mod"><i>' + m.icon + '</i><div><b>' + m.name + '</b><small>' + m.text + '</small></div></div>').join('') +
      '<p class="dim">Mapa del día, dificultad NORMAL. ' + (D ? 'Tu mejor marca hoy: <b>' + D.best.toLocaleString('es-ES') + '</b> (' + D.tries + ' intento' + (D.tries > 1 ? 's' : '') + ')' : 'Termínalo hoy: +300 monedas') + '</p>' +
      '<button class="start c-yel" data-start="daily" style="width:100%;margin-top:10px">Jugar con ' + nice(sel.name) + '</button></div>';
  }

  /** Créditos: autores de los sprites (pack «Dragon Ball Sagas») */
  renderCredits() {
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    this.hdr = { t: 'Créditos', s: 'Gracias a quienes hicieron los sprites', c: 'c-pur' };
    this.el.menuBody.innerHTML = '<div class="pnl cpnl"><h4 class="sec">Sprites de personajes</h4><p class="dim" style="margin-bottom:12px">Sprites del pack «Dragon Ball Sagas», hechos por la comunidad. Gracias a sus autores:</p>' +
      '<div class="mod"><i>★</i><div><b>Z Legends 3 · Geneildo Santos</b><small>Luchadores, cinemáticas, efectos, escenarios y voces del Combate Z (Juegos de Cell) y de las cinemáticas de Ultimate</small></div></div>' +
      '<div class="mod"><i>★</i><div><b>Pack de Sprites V3, V4 y V5</b><small>Guerreros y transformaciones del Altar de Shenron (Yamcha, Gohan niño, Ginyu, Dabura, Gohan del Futuro, Super Androide 35, Super 17, Vegetto SSJB3, Super Buu…). Goku Ultra Instinto, Super Baby y Vegetto Ego hechos por Black Vinas; Kamba SSJ4 editado por Black Vinas</small></div></div>' +
      SPRITE_CREDITS.map((c) => '<div class="mod"><i>★</i><div><b>' + esc(c.author) + '</b><small>' + c.what.map(esc).join(' · ') + '</small></div></div>').join('') +
      '<h4 class="sec" style="margin-top:16px">Dragon Ball</h4><p class="dim">Dragon Ball es una obra de Akira Toriyama. Juego de fans sin ánimo de lucro.</p></div>';
  }

  /* ---------- Elige guerrero (como «La Liga»): ficha a la izquierda y lista a la derecha ---------- */
  renderPlay() {
    const v = charById(this.view), owned = Save.d.unlocked.includes(v.id), d = Save.d.diff;
    const real = CHARACTERS.filter((c) => !c.soon), own = real.filter((c) => Save.d.unlocked.includes(c.id)).length;
    this.hdr = { t: 'Elige guerrero', s: own + ' de ' + real.length + ' desbloqueados', c: '' };
    const COL = { f: '#ff7a2a', k: '#3f7cf5', e: '#22b86f' }, TN = { f: 'Físico', k: 'Ki', e: 'Equilibrado' };
    // Lista de guerreros (con filtro)
    const ct = this.ctab || 'all';
    let grid = '';
    for (const c of CHARACTERS) {
      const has = Save.d.unlocked.includes(c.id);
      if ((ct === 'own' && !has) || (ct === 'lock' && (has || c.soon))) continue;
      const cls = 'ch' + (Save.d.sel === c.id ? ' sel' : '') + (has ? '' : ' locked') + (c.soon ? ' soon' : '') + (this.view === c.id ? ' view' : '');
      grid += '<div class="' + cls + '" data-ch="' + c.id + '" style="--cc:' + COL[this.charType(c)] + '" title="' + nice(c.name) + '">' + (c.portrait ? this.pic(c) : '<div class="qm">?</div>') +
        (c.soon ? '<span class="lk">PRONTO</span>' : has ? '' : '<span class="lk">🔒 ' + (c.summon ? 'Altar' : c.req ? 'Reto' : c.cost) + '</span>') + '<b>' + nice(c.name) + '</b></div>';
    }
    // Ficha
    let det;
    if (v.soon) det = '<div class="lsc"><div class="lin"><span class="k2">' + v.role + '</span><h3>' + nice(v.name) + '</h3><p class="dim">Este guerrero llegará en una próxima actualización.</p></div></div>';
    else {
      const t = this.charType(v), hex = (n) => '#' + (n || 0xffd84a).toString(16).padStart(6, '0'), best = Save.d.best[v.id], idx = real.indexOf(v) + 1;
      const bar = (n, val, max, cls) => '<div class="sb' + (cls ? ' ' + cls : '') + '"><span>' + n + '</span><div><i style="width:' + Math.min(100, (val / max) * 100) + '%"></i></div><b>' + val + '</b></div>';
      const chip = (id) => WEAPONS[id].cat === 'fis' ? '<span class="tcat tf">✊ FÍS</span>' : '<span class="tcat tk">✺ KI</span>';
      const techs = v.unique.filter((id) => id !== v.start[0]).concat(Object.keys(WEAPONS).filter((id) => WEAPONS[id].shop && !WEAPONS[id].unique)).filter((id) => !WEAPONS[id].unique || WEAPONS[id].unique === v.id);
      const evo = v.forms.map((f, i) => (i ? '<div class="ar">NV ' + f.lvl + '<i>›</i></div>' : '') + '<div class="ev" style="--ec:' + hex(f.ki) + '" title="' + nice(f.name) + '"><div class="eci"><canvas width="72" height="72" data-sheet="' + f.sheet + '" data-frame="0"></canvas></div><small>' + nice(f.name) + '</small></div>').join('');
      const fF = Math.round(v.atkF * 100), fK = Math.round(v.atkK * 100);
      const typs = (fF >= fK ? ['f', 'k'] : ['k', 'f']).map((x) => '<span class="typ ' + x + '">' + (x === 'f' ? 'Físico' : 'Ki') + '<small>' + (x === 'f' ? fF : fK) + '</small></span>').join('') + (t === 'e' ? '<span class="typ e">Equilibrado</span>' : '');
      const diffs = DIFFS.map((x) => '<button class="dbtn' + (x.id === d ? ' on' : '') + '" style="--c:' + x.color + '" data-diff="' + x.id + '" title="x' + x.coins + ' monedas · +' + x.reward + ' al ganar">' + nice(x.name) + '</button>').join('');
      const W0 = WEAPONS[v.start[0]];
      det = '<div class="lsc"><div class="lhd"><div class="pbox" style="--c1:' + (t === 'k' ? '#7ab8ff' : t === 'e' ? '#7ae0a8' : '#ffb25a') + ';--c2:' + COL[t] + '">' + this.pic(v, 120, 120) + '<span class="pc2">' + (best ? 'Récord NV ' + best.level : owned ? 'Sin jugar' : '🔒 ' + (v.summon ? 'Altar' : v.req ? 'Reto' : v.cost)) + '</span></div>' +
        '<div class="lin"><div class="lnum"><span class="k2">#' + String(idx).padStart(2, '0') + ' · ' + v.role + '</span><span class="chip ' + (Save.d.sel === v.id ? 'g' : owned ? 'd' : 'y') + '">' + (Save.d.sel === v.id ? 'Equipado' : owned ? 'Desbloqueado' : 'Bloqueado') + '</span></div>' +
          '<h3>' + nice(v.name) + '</h3><div class="typs">' + typs + '</div>' +
          '<span class="k2">Se transforma durante la partida</span><div class="evo">' + evo + '</div>' +
          '<div class="dfs"><span class="k2">Dificultad</span>' + diffs + '</div></div></div>' +
        '<div class="lcl"><div><span class="k2">Estadísticas</span>' + bar('Vida', v.hp, 160) + bar('Ki', v.ki, 160) + bar('Velocidad', Math.round(v.spd * 100), 150) + bar('Atq. físico', fF, 140, 'sf') + bar('Atq. ki', fK, 140, 'sk') + '</div>' +
          '<div><span class="k2">En partida</span><div class="kv"><span>Pasiva</span><b>' + v.passive.name + '</b></div>' + (v.ult ? '<div class="kv"><span>Ultimate [Q]</span><b>' + nice(v.ult.name) + '</b></div>' : '') +
          '<div class="kv"><span>Ataque básico</span><b>' + W0.name + '</b></div><div class="kv"><span>Técnicas</span><b>' + techs.length + '</b></div><div class="kv"><span>Transformaciones</span><b>' + (v.forms.length - 1) + '</b></div>' +
          '<div class="kv"><span>Mejor partida</span><b>' + (best ? fmtTime(best.time) + ' · ' + best.kills + ' bajas' : '—') + '</b></div></div></div>' +
        '<div class="lsec"><span class="k2">Pasiva · ' + v.passive.name + '</span><p>' + v.passive.desc + '</p></div>' +
        (v.ult ? '<div class="lsec"><span class="k2">Ultimate [Q] · ' + v.ult.name + '</span><p>Se carga derrotando enemigos. ' + ULT_DESC[v.ult.type || 'rift'] + ' Cuesta un ' + Math.round(ULT_KI * 100) + '% del Ki máximo.' + (v.ult.debuff ? '<br><span class="trb">✖ Después: ' + v.ult.debuff.name.toLowerCase() + ', ' + v.ult.debuff.text + '.</span>' : '') + '</p></div>' : '') +
        '<div class="lsec"><span class="k2">Ataque básico</span><div class="tli"><p><i>' + W0.icon + '</i><span><b>' + W0.name + '</b> ' + chip(v.start[0]) + '<br>' + W0.lv[0] + '</span></p></div></div>' +
        '<div class="lsec"><span class="k2">Técnicas (al subir de nivel)</span><div class="tli">' + techs.map((id) => { const W = WEAPONS[id], lock = W.shop && !Save.d.techs.includes(id); return '<p class="' + (lock ? 'lockt' : '') + '"><i>' + W.icon + '</i><span><b>' + W.name + '</b> ' + chip(id) + '<br>NV ' + (W.minLv || 2) + (lock ? ' · 🔒 en la tienda' : '') + '</span></p>'; }).join('') + '</div></div>' +
        '<div class="lsec"><span class="k2">Fusiones (las dos técnicas al nivel 5)</span><div class="tli">' + fusionsFor(v.id).map((f) => { const F = WEAPONS[f], lock = F.fusion.some((x) => !techOwned(x)); return '<p class="' + (lock ? 'lockt' : '') + '"><i>⚭</i><span><b>' + F.name + '</b><br>' + F.fusion.map((x) => WEAPONS[x].name).join(' + ') + (lock ? ' · 🔒 requiere técnica de la tienda' : '') + (F.down ? ' · <span class="trb">✖ ' + F.down.text + '</span>' : '') + '</span></p>'; }).join('') + '</div></div>' +
        '<div class="lsec"><span class="k2">Transformaciones</span><div class="forms ftl">' + v.forms.map((f, i) => { const T = traitOf(v, i); return '<span>' + nice(f.name) + ' <em>NV ' + f.lvl + '</em>' + (T ? '<small class="trg">✚ ' + T.good + '</small><small class="trb">✖ ' + T.bad + '</small>' : '') + '</span>'; }).join('') + '</div></div>' +
        '</div>';
    }
    const act = v.soon ? '' : owned ? '<button class="pill" data-start="practice">' + iconHtml('power') + 'Entrenar</button><button class="pill" data-start="daily">☀ Diario</button><button class="go" data-start><span class="dball"></span>¡A luchar!<small>ENTER</small></button>'
      : v.summon ? '<div class="reqb"><span class="k2">Guerrero del Altar de Shenron</span><b>Consíguelo invocando con Cristales del Dragón (' + GRARE[gformById(v.id).r].name + ')</b></div><button class="buy c-grn" data-place="altar">Ir al altar</button>'
      : v.req ? (() => { const P = reqProgress(v), ok = P[0] >= P[1];           // personaje de reto: barra de progreso o botón de reclamar
          return '<div class="reqb"><span class="k2">Reto para desbloquearlo</span><b>' + v.req.text + '</b><div class="mb"><i style="width:' + (P[0] / P[1] * 100) + '%"></i><em>' + fmtK(P[0]) + ' / ' + fmtK(P[1]) + '</em></div></div>' +
            '<button class="buy c-grn" data-claimch="' + v.id + '"' + (ok ? '' : ' disabled') + '>' + (ok ? '¡Reclamar!' : 'Reto pendiente') + '</button>'; })()
      : '<button class="buy c-yel" data-buy="' + v.id + '"' + (Save.d.zeni < v.cost ? ' disabled' : '') + '>Desbloquear · <span class="coin"></span> ' + v.cost.toLocaleString('es-ES') + '</button>';
    this.el.menuBody.innerHTML = '<div class="liga"><div class="pnl lp">' + det + (act ? '<div class="lact">' + act + '</div>' : '') + '</div>' +
      '<div class="pnl lr"><div class="seg dk">' + this.segTabs([['all', 'Todos'], ['own', 'Tuyos'], ['lock', 'Por desbloquear']], ct, 'ctab') + '</div>' +
      '<div class="lcount"><span>Guerreros</span><b>' + own + ' / ' + real.length + '</b></div><div class="roster">' + (grid || '<p class="dim">No hay guerreros en esta lista.</p>') + '</div></div></div>';
  }

  /* ---------- Tienda: mejoras permanentes, objetos y técnicas ---------- */
  renderShopScreen() {
    this.hdr = { t: 'Tienda', s: 'Gasta tus monedas entre partidas', c: 'c-grn', tabs: this.segTabs([['upgrades', 'Mejoras'], ['items', 'Objetos'], ['techs', 'Técnicas']], this.tab, 'tab') };
    this.el.menuBody.innerHTML = this.tab === 'items' ? this.htmlItems() : this.tab === 'techs' ? this.htmlTechs() : this.htmlUpgrades();
  }
  price(n) { return '<span class="coin"></span> ' + n.toLocaleString('es-ES'); }
  htmlUpgrades() {
    let h = '<div class="shop"><div class="item info" style="grid-column:1/-1"><div><b>Mejoras permanentes</b><p>Se aplican solas al personaje al empezar cada partida.</p></div></div>';
    for (const l of LAB) {
      const lvl = Save.lab(l.id), maxed = lvl >= l.max, cost = labCost(l, lvl);
      let pips = ''; for (let k = 0; k < l.max; k++) pips += '<u class="' + (k < lvl ? 'on' : '') + '"></u>';
      h += '<div class="item"><div><b>' + l.name + '</b><p>' + l.desc + '</p><div class="pips" style="justify-content:flex-start">' + pips + '</div></div>' +
        '<button class="c-grn" data-lab="' + l.id + '"' + (maxed || Save.d.zeni < cost ? ' disabled' : '') + '>' + (maxed ? 'Máximo' : this.price(cost)) + '</button></div>';
    }
    return h + '</div>';
  }
  htmlItems() {
    let h = '<div class="shop"><div class="item info" style="grid-column:1/-1"><div><b>Objetos de las cápsulas</b><p>Las cápsulas del mapa dan un objeto aleatorio que dura solo esa partida. Aquí desbloqueas cuáles pueden tocarte: los más raros solo aparecen si los compras.</p></div></div>';
    for (let r = 0; r < 6; r++) {
      for (const it of ITEMS) {
        if (it.rarity !== r) continue;
        const rar = RARITIES[r], own = itemAvailable(it);
        h += '<div class="item" style="box-shadow:inset 5px 0 0 ' + rar.color + ',var(--sh)"><div class="ic" style="color:' + rar.color + ';box-shadow:inset 0 0 0 3px ' + rar.color + '">' + it.icon + '</div><div><span class="chip" style="background:' + rar.color + ';color:#141826">' + nice(rar.name) + '</span><br><b>' + it.name + '</b><p>' + it.text + '</p></div>' +
          (own ? '<button disabled>' + (rar.cost ? 'Tuyo' : 'Disponible') + '</button>' : '<button class="c-grn" data-item="' + it.id + '"' + (Save.d.zeni < rar.cost ? ' disabled' : '') + '>' + this.price(rar.cost) + '</button>') + '</div>';
      }
    }
    return h + '</div>';
  }
  htmlTechs() {
    let h = '<div class="shop"><div class="item info" style="grid-column:1/-1"><div><b>Técnicas de Dragon Ball</b><p>Una vez compradas, pueden aparecer como carta al subir de nivel (a partir de su nivel mínimo). Las exclusivas solo salen con su personaje.</p></div></div>';
    // Técnicas propias de cada personaje: no se compran, vienen incluidas
    for (const c of CHARACTERS) for (const id of c.unique || []) {               // los personajes «próximamente» no tienen técnicas
      const W = WEAPONS[id];
      if (!W || W.shop || W.fusion || id === (c.start || [])[0]) continue;
      h += '<div class="item"><div class="ic" style="color:#' + W.color.toString(16).padStart(6, '0') + '">' + W.icon + '</div><div><span class="chip p">' + nice(c.name) + ' · NV ' + (W.minLv || 2) + '</span><br><b>' + W.name + '</b><p>' + W.lv[0] + ' Sale seguro la primera vez que llegas a su nivel.</p></div><button disabled>Incluida</button></div>';
    }
    for (const id in WEAPONS) {
      const W = WEAPONS[id];
      if (!W.shop) continue;
      const own = Save.d.techs.includes(id), who = W.unique ? nice(charById(W.unique).name) : 'Todos';
      h += '<div class="item"><div class="ic" style="color:#' + W.color.toString(16).padStart(6, '0') + '">' + W.icon + '</div><div><span class="chip b">' + who + ' · NV ' + W.minLv + '</span><br><b>' + W.name + '</b><p>' + W.lv[0] + '</p></div>' +
        (own ? '<button disabled>Comprada</button>' : '<button class="c-grn" data-tech="' + id + '"' + (Save.d.zeni < W.shop ? ' disabled' : '') + '>' + this.price(W.shop) + '</button>') + '</div>';
    }
    return h + '</div>';
  }

  /* ---------- Opciones: volumen ---------- */
  renderOptions() {
    this.hdr = { t: 'Opciones', s: 'Sonido, gráficos y copia de seguridad', c: 'c-blu' };
    const v = Save.d.vol || { mus: 0.5, sfx: 0.75 }, O = Save.d.opt, sl = (k, name, val) => '<div class="item opt"><div><b>' + name + '</b><input type="range" min="0" max="100" value="' + Math.round(val * 100) + '" data-vol="' + k + '"></div><b>' + Math.round(val * 100) + '%</b></div>';
    const qb = [['auto', 'Auto'], ['high', 'Alta'], ['medium', 'Media'], ['low', 'Baja']].map((q) => '<button class="qb' + (O.quality === q[0] ? ' on' : '') + '" data-q="' + q[0] + '">' + q[1] + '</button>').join('');
    const pr = this.game && this.game.perf ? this.game.perf.pr : 1;
    this.el.menuBody.innerHTML = '<div class="shop">' + sl('mus', 'Música', v.mus) + sl('sfx', 'Efectos de sonido', v.sfx) +
      '<div class="item opt wide"><div><b>Calidad gráfica</b><div class="qbs">' + qb + '</div><p>AUTO ajusta la resolución sola para mantener 60 FPS y quita las sombras si hace falta. BAJA: sin sombras, menos partículas y sin suavizado de bordes (este último, al recargar la página). Resolución actual: x' + pr.toFixed(2) + '</p></div></div>' +
      '<div class="item opt"><div><b>Reducir destellos</b><p>Quita los fogonazos blancos/negros y los negativos de los impact frames.</p></div><button class="tgl' + (O.flash ? ' on' : '') + '" data-flash>' + (O.flash ? 'Activado' : 'Desactivado') + '</button></div>' +
      '<div class="item opt"><div><b>Temblor de pantalla</b><input type="range" min="0" max="100" value="' + Math.round(O.shake * 100) + '" data-shake></div><b>' + Math.round(O.shake * 100) + '%</b></div>' +
      '<div class="item opt wide"><div><b>Copia de seguridad</b><p>Exporta tu progreso (se descarga un archivo y se copia el texto) o importa una copia pegando el texto o eligiendo el archivo.</p>' +
      '<textarea id="saveTxt" spellcheck="false" placeholder="Aquí aparecerá el texto de la copia, o pega aquí una copia para importarla"></textarea>' +
      '<div class="qbs"><button class="qb" data-exp>Exportar</button><button class="qb" data-imp>Importar' + (this.impArmed ? ' (confirmar)' : '') + '</button><button class="qb" data-impfile>Elegir archivo…</button><input type="file" id="impFile" accept=".json,.txt,application/json" style="display:none"></div>' +
      (this.optMsg ? '<p class="omsg">' + this.optMsg + '</p>' : '') + '</div></div>' +
      '<div class="item info wide"><div><b>Controles</b><p>TECLADO: WASD mover · ESPACIO dash · C cargar Ki · F Transmisión Instantánea · G transformarse (sube de una en una: cuesta Ki, y mantener la forma también) · H volver a la forma base · F11 o el botón de la esquina: pantalla completa · E interactuar · M mapa · TAB estadísticas · P pausa.<br>' +
      'MANDO: stick izq. mover · stick der. cámara · A dash · B Transmisión Instantánea · X interactuar · Y transformarse · RB/RT cargar Ki · cruceta ↓ forma base · START pausa · SELECT mapa. En las cartas: cruceta o stick para elegir, A para confirmar y X para cambiar las cartas.</p></div></div>' +
      '<div class="item"><div><b>Sonido sintetizado</b><p>Toda la música y los efectos se generan en el momento con Web Audio (sin archivos). En el móvil, el sonido se activa al tocar la pantalla por primera vez.</p></div></div></div>';
    this.optMsg = '';
  }

  /* ---------- Récords: ranking local y desafíos diarios ---------- */
  renderRecords() {
    this.hdr = { t: 'Récords', s: 'Tus mejores partidas y el ranking mundial', c: 'c-yel', tabs: this.segTabs([['all', 'Mejores partidas'], ['daily', 'Desafío diario'], ['online', 'Ranking mundial']], this.rtab, 'rtab') };
    let h = '';
    if (this.rtab === 'daily') {
      const list = Save.d.rank.filter((r) => r.daily);
      h = '<div class="msplit"><div>' + this.dailyCard() + '</div><div class="pnl" style="padding:16px 18px;overflow-y:auto"><h4 class="sec">Historial (mejor marca de cada día)</h4>' +
        (Save.d.dayHist.length ? '<div class="rk">' + Save.d.dayHist.map((d, i) => '<div class="rr"><em>☀</em><div class="rav"></div><div class="rn"><b>' + d.date.split('-').reverse().join('/') + '</b><small>' + (d.mods || []).join(' · ') + '</small></div><b>' + d.best.toLocaleString('es-ES') + '</b></div>').join('') + '</div>' : '<p class="dim">Aún no has jugado ningún desafío diario.</p>') +
        (list.length ? '<h4 class="sec" style="margin-top:14px">Tus mejores desafíos</h4>' + this.rankTable(list) : '') + '</div></div>';
    } else if (this.rtab === 'online') {
      h = '<div class="pnl" style="flex:1;min-height:0;display:flex;flex-direction:column;padding:14px 16px;gap:10px"><div class="seg dk" style="align-self:flex-start">' + this.segTabs([['global', 'General'], ['daily', 'Desafío de hoy']], this.otab, 'otab') + '</div>' +
        '<div id="onRank" style="flex:1;min-height:0;overflow-y:auto"><p class="dim" style="text-align:center">Cargando ranking…</p></div></div>';
    } else h = Save.d.rank.length ? '<div class="pnl" style="min-height:0;overflow-y:auto;padding:14px 16px">' + this.rankTable(Save.d.rank) + '</div>' : '<div class="empty"><b>Aún no hay partidas</b><p>Tu mejor puntuación aparecerá aquí en cuanto termines una partida.</p><button data-go="play">Elegir guerrero</button></div>';
    this.el.menuBody.innerHTML = h;
    if (this.rtab === 'online') this.loadOnlineRank();
  }
  /** Rellena el ranking mundial (general o del desafío de hoy) cuando llegan los datos */
  async loadOnlineRank() {
    const on = this.game && this.game.online, tab = this.otab, box = () => document.getElementById('onRank');
    if (!on || !on.ready) { if (box()) box().innerHTML = '<p class="dim" style="text-align:center">El ranking mundial no está configurado todavía (mira la pantalla CUENTA).</p>'; return; }
    try {
      const list = tab === 'daily' ? await on.topDaily(50) : await on.topGlobal(50);
      if (this.screen !== 'records' || this.rtab !== 'online' || this.otab !== tab || !box()) return;   // el jugador ya cambió de pantalla
      const me = on.user ? on.user.id : '';
      box().innerHTML = (list.length ? '<div class="rk">' + list.map((r, i) => {
        const c = charById(r.ch);
        return this.rankRow(i, c, escHtml(r.name), (c ? nice(c.name) : escHtml(r.ch)) + ' · ' + r.kills + ' bajas · NV ' + r.level + ' · mapa ' + (r.step + 1) + '/' + ROUTE_LEN + ' · ' + fmtTime(r.time) + ' · ' + nice(diffById(r.diff).name), Number(r.score).toLocaleString('es-ES'), r.user_id === me, r.win ? '<span class="chip g">Victoria</span>' : '');
      }).join('') + '</div>' : '<p class="dim" style="text-align:center">Todavía no hay partidas. ¡Sé el primero!</p>') +
        (on.logged ? '' : '<p class="dim" style="text-align:center;margin-top:10px">Inicia sesión en CUENTA para aparecer en el ranking.</p>');
      for (const cv of box().querySelectorAll('canvas[data-sheet]')) this.drawFrame(cv, cv.dataset.sheet, +cv.dataset.frame, +(cv.dataset.tint || 0));
    } catch (e) { if (box()) box().innerHTML = '<p class="dim" style="text-align:center">' + escHtml(on.errText(e)) + '</p>'; }
  }

  /* ---------- Cuenta: iniciar sesión / crear cuenta ---------- */
  accountLabel() {
    const on = this.game && this.game.online;
    if (!on || !on.ready) return 'Sin conectar';
    return on.logged ? escHtml(on.name || 'Conectado') : 'Iniciar sesión';
  }
  renderAccount() {
    const on = this.game && this.game.online;
    this.hdr = { t: 'Cuenta', s: 'Para aparecer en el ranking mundial', c: 'c-blu' };
    let h;
    if (!on || !on.ready) {
      h = '<div class="acct"><h4 class="sec">Ranking mundial no configurado</h4><p class="dim">Falta conectar el juego con Supabase: ejecuta <b>supabase/ranking.sql</b> en el SQL Editor de tu proyecto y pon su URL y su clave pública en <b>js/online.js</b>.</p><p class="dim">Mientras tanto puedes jugar con normalidad y tus récords se guardan en este navegador.</p></div>';
    } else if (on.logged) {
      h = '<div class="acct"><h4 class="sec">Sesión iniciada</h4><p class="who">' + escHtml(on.name) + '</p><p class="dim">' + escHtml(on.user.email || '') + '</p>' +
        '<p>Tus partidas se suben solas al ranking mundial al terminar (el modo entrenamiento no cuenta).</p>' +
        '<div class="arow"><button class="abtn" data-rtab-go="online">Ver ranking mundial</button><button class="abtn alt" data-acct="out">Cerrar sesión</button></div></div>';
    } else {
      const reg = this.atab === 'signup';
      this.hdr.tabs = this.segTabs([['login', 'Iniciar sesión'], ['signup', 'Crear cuenta']], reg ? 'signup' : 'login', 'atab');
      h = '<form class="acct" data-acct-form="' + (reg ? 'signup' : 'login') + '" novalidate>' +
        (reg ? '<label>Nombre de jugador<input id="acName" maxlength="16" autocomplete="nickname" placeholder="De 3 a 16 caracteres"></label>' : '') +
        '<label>Correo<input id="acMail" type="email" autocomplete="email"></label>' +
        '<label>Contraseña<input id="acPass" type="password" autocomplete="' + (reg ? 'new-password' : 'current-password') + '" placeholder="Mínimo 6 caracteres"></label>' +
        '<button class="abtn" type="submit">' + (reg ? 'Crear cuenta' : 'Entrar') + '</button><p class="msg" id="acMsg"></p>' +
        '<p class="dim">Sin cuenta puedes jugar igual; solo no apareces en el ranking mundial.</p></form>';
    }
    this.el.menuBody.innerHTML = h;
  }
  rankTable(list) {
    return '<div class="rk">' + list.slice(0, 15).map((r, i) => {
      const c = charById(r.ch);
      return this.rankRow(i, c, c ? nice(c.name) : r.ch, r.date.split('-').reverse().join('/') + ' · ' + r.kills + ' bajas · NV ' + r.level + ' · mapa ' + r.step + '/' + ROUTE_LEN + ' · ' + fmtTime(r.time), r.score.toLocaleString('es-ES'), false,
        (r.win ? '<span class="chip g">Victoria</span>' : '') + (r.daily ? '<span class="chip y">☀ Diario</span>' : ''));
    }).join('') + '</div>';
  }

  /* ---------- Estadísticas acumuladas ---------- */
  renderStatsScreen() {
    this.hdr = { t: 'Estadísticas', s: 'Todo lo que has hecho hasta ahora', c: 'c-blu' };
    const st = Save.d.stats, n = (k) => Math.floor(st[k] || 0), f = (k) => n(k).toLocaleString('es-ES');
    const rows = [['Partidas', f('runs')], ['Victorias', f('wins')], ['Tiempo jugado', fmtTime(n('time'))], ['Mapa más lejano', n('maxStage') + ' / ' + ROUTE_LEN], ['Nivel máximo', n('maxLevel')],
      ['Enemigos derrotados', f('kills')], ['Élites', f('elites')], ['Jefes', f('bosses')], ['Daño total', f('damage')], ['Daño recibido', f('taken')], ['Dashes', f('dashes')],
      ['Cápsulas abiertas', f('capsules')], ['Maldiciones', f('curses')], ['Desafíos aceptados', f('temples')], ['Habitaciones del Tiempo', f('rooms')], ['Deseos a Shenron', f('wishes')], ['Combo máximo', f('maxCombo')], ['Golpe más fuerte', f('bestHit')], ['Transformaciones', f('transforms')], ['Fusiones', f('fusions')], ['Eventos', f('events')], ['Rivales derrotados', f('rivals')], ['Teletransportes', f('tps')], ['Desafíos diarios', f('dailies')]];
    const best = CHARACTERS.filter((c) => Save.d.best[c.id]).sort((a, b) => Save.d.best[b.id].time - Save.d.best[a.id].time)
      .map((c, i) => { const b = Save.d.best[c.id]; return this.rankRow(i, c, nice(c.name), b.kills + ' bajas · NV ' + b.level, fmtTime(b.time)); }).join('') || '<p class="dim">Aún no has jugado ninguna partida.</p>';
    this.el.menuBody.innerHTML = '<div class="msplit"><div><div class="stt">' + rows.map((r) => '<div><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('') + '</div></div>' +
      '<div class="pnl" style="padding:16px 18px;overflow-y:auto"><h4 class="sec">Mejor partida de cada guerrero</h4><div class="rk">' + best + '</div></div></div>';
  }

  /* ---------- Misiones (como los «Encargos»): las del día y las permanentes ---------- */
  missionRow(m) {
    const pr = Math.min(m.goal, Save.progress(m)), done = Save.isClaimed(m), ok = pr >= m.goal;
    const T = m.weekly ? (m.cry <= 100 ? ['g', 'Fácil', '#22b86f'] : m.cry <= 150 ? ['b', 'Media', '#3f7cf5'] : ['r', 'Difícil', '#f0455d']) : m.daily ? (m.reward <= 100 ? ['g', 'Fácil', '#22b86f'] : m.reward <= 120 ? ['b', 'Media', '#3f7cf5'] : ['r', 'Difícil', '#f0455d'])
      : (m.reward < 400 ? ['t', 'Constancia', '#2a9d8f'] : m.reward < 900 ? ['b', 'Hazaña', '#3f7cf5'] : ['r', 'Reto', '#f0455d']);
    return '<div class="er" style="--ec:' + T[2] + '"><div class="eic">' + (m.daily ? '<span class="dball"></span>' : '★') + (done ? '<span class="ok">✓</span>' : '') + '</div>' +
      '<div class="et"><b><span class="chip ' + T[0] + '">' + T[1] + '</span>' + m.name + '</b><p>' + m.desc + '.</p>' +
      (done ? '<div class="done">Completada y cobrada</div>' : '<div class="mb"><i style="width:' + (pr / m.goal * 100) + '%"></i><em>' + fmtK(Math.floor(pr)) + ' / ' + fmtK(m.goal) + '</em></div>') + '</div>' +
      '<div class="ea">' + (done ? '<span class="hecho">¡Hecho!</span>' : (m.weekly ? '<span class="rwd cry"><span class="crys"></span>+' + m.cry + '</span>' : '<span class="rwd"><span class="coin"></span>+' + m.reward + '</span>') + (ok ? '<button class="c-grn" data-claim="' + m.id + '">Cobrar</button>' : '')) + '</div></div>';
  }
  /** Pestaña ◆ Cristales: misiones semanales y los modos que dan cristales */
  renderWeekly() {
    const wk = MISSIONS.filter((m) => m.weekly), done = wk.filter((m) => Save.isClaimed(m)).length, tot = wk.reduce((a, m) => a + m.cry, 0);
    const d = new Date(); const left = 7 - ((d.getDay() + 6) % 7);
    this.el.menuBody.innerHTML = '<div class="enc">' +
      '<div class="pnl ep"><div class="eh" style="--ehc:var(--blu)"><span class="k2">Misiones semanales</span><h4>Esta semana</h4><small>Se renuevan el lunes (' + (left === 1 ? 'mañana' : 'en ' + left + ' días') + ') · ' + done + ' de ' + wk.length + ' · hasta ' + tot.toLocaleString('es-ES') + ' cristales</small></div>' +
        '<div class="eb">' + wk.map((m) => this.missionRow(m)).join('') + '</div></div>' +
      '<div class="pnl ep"><div class="eh" style="--ehc:var(--grn)"><span class="k2">Modos de cristales</span><h4>Gana cristales jugando</h4><small>Con el guerrero que tengas elegido y tu dificultad</small></div>' +
        '<div class="eb">' + this.modeCards() + '</div></div></div>';
  }
  modeCards() {
    return Object.keys(MODES).map((k) => { const M = MODES[k], b = Save.d.best['mode_' + k];
      return '<div class="mcard"><i>' + M.icon + '</i><div><b>' + M.name + '</b><p>' + M.desc + '</p>' + (b ? '<small>Mejor: ' + b.cry + ' cristales' + (k === 'gauntlet' ? ' · ' + b.bosses + ' jefes' : '') + '</small>' : '') + '</div><button class="c-blu" data-start="' + k + '">Jugar</button></div>'; }).join('');
  }
  renderMissions() {
    const achN = ACHIEVEMENTS.filter((a) => Save.d.ach[a.id]).length;
    this.hdr = { t: 'Misiones', s: 'Vuelve cada día: se renuevan a las 00:00', c: '', tabs: this.segTabs([['missions', 'Misiones'], ['weekly', '◆ Cristales'], ['ach', 'Logros · ' + achN + '/' + ACHIEVEMENTS.length]], this.mtab, 'mtab') };
    Save.checkWeekly();
    if (this.mtab === 'weekly') { this.renderWeekly(); return; }
    if (this.mtab === 'ach') {
      const st = Save.d.stats;
      this.el.menuBody.innerHTML = '<div class="shop">' + ACHIEVEMENTS.map((a) => {
        const done = !!Save.d.ach[a.id], pr = Math.min(a.goal, st[a.stat] || 0);
        return '<div class="item ach' + (done ? ' done' : '') + '"><div class="ic">' + a.icon + '</div><div><b>' + a.name + '</b><p>' + a.desc + '</p><div class="mb"><i style="width:' + (pr / a.goal * 100) + '%"></i><em>' + fmtK(pr) + ' / ' + fmtK(a.goal) + '</em></div></div><span class="arw">' + (done ? '✔' : '+' + a.reward) + '</span></div>';
      }).join('') + '</div>';
      return;
    }
    const l = Save.d.login, next = Save.checkLogin(), daily = Save.d.daily.ids.map((id) => missionById(id)), perm = MISSIONS.filter((m) => !m.daily);
    let trk = '';
    daily.forEach((m, i) => { const c = Save.isClaimed(m); trk += (i ? '<i class="' + (c ? 'on' : '') + '"></i>' : '') + '<u class="' + (c ? 'ok' : '') + '">' + (c ? '✓' : i + 1) + '</u>'; });
    trk += '<i class="' + (daily.every((m) => Save.isClaimed(m)) ? 'on' : '') + '"></i><u class="end"><span class="dball"></span></u>';
    let days = '';
    for (let i = 1; i <= 7; i++) days += '<span class="' + (i <= l.streak ? 'on' : '') + '"><b>' + i + '</b>+' + (100 + 50 * (i - 1)) + '</span>';
    const pDone = perm.filter((m) => Save.isClaimed(m)).length;
    this.el.menuBody.innerHTML = '<div class="enc">' +
      '<div class="pnl ep"><div class="eh" style="--ehc:var(--yel)"><span class="k2">Misiones del día</span><h4>Hoy</h4><small>Nuevas misiones en ' + this.untilReset() + '</small><span class="rch">Racha: ' + l.streak + ' día' + (l.streak === 1 ? '' : 's') + '</span><div class="etr">' + trk + '</div></div>' +
        '<div class="lgn" title="Recompensa diaria por entrar">' + days + '</div>' + (next ? '' : '<p class="dim" style="padding:2px 20px 0">Ya cobraste la recompensa de hoy. ¡Vuelve mañana!</p>') +
        '<div class="eb">' + daily.map((m) => this.missionRow(m)).join('') + '</div></div>' +
      '<div class="pnl ep"><div class="eh" style="--ehc:var(--pur)"><span class="k2">Misiones permanentes</span><h4>Para siempre</h4><small>' + pDone + ' de ' + perm.length + ' completadas</small></div>' +
        '<div class="eb">' + perm.map((m) => this.missionRow(m)).join('') + '</div></div></div>';
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

/* Descripción de cada tipo de Ultimate (ficha del personaje) */
const ULT_DESC = {
  rift: 'Abre dos grietas en el espacio que cruzan el mapa.',
  bomb: 'Una esfera gigante cae sobre la horda y arrasa una zona enorme.',
  beam: 'Un rayo colosal que atraviesa todo lo que tienes delante.',
  storm: 'Rodea de granadas de ki a todos los enemigos cercanos y las hace estallar.',
  discs: 'Lanza una corona de discos gigantes que cortan todo a su paso.',
  slash: 'Tajos en todas direcciones y la explosión del Burning Attack.'
};
