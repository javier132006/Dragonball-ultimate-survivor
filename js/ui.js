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
      'biome', 'combo', 'comboN', 'comboBar', 'storm', 'power', 'tfBtn', 'tfName', 'tfSub', 'goalL', 'trait', 'abBlock', 'blockFill', 'abTp', 'tpFill', 'abUlt', 'ultFill', 'stageName', 'zoneBox', 'zoneBar', 'zoneTxt', 'trade', 'bigmap', 'bigmapc', 'fade', 'controls', 'abDash', 'dashFill', 'abCharge', 'vignette', 'toast', 'feed', 'wstrip', 'bossBox', 'bossBar', 'bossName', 'mm', 'portrait', 'prompt', 'itemPop',
      'screen', 'scrBox', 'scrTitle', 'scrSub', 'scrStats', 'scrA', 'scrB', 'cards', 'cardTitle', 'cardSub', 'cardRow', 'cardFoot', 'menu', 'menuNav', 'menuBody', 'zeniMenu', 'exit', 'modal', 'fatal', 'hud'];
    this.el = {};
    for (const id of ids) this.el[id] = $(id);
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

  update(game, dt) {
    const p = game.player, e = this.el, T = this.setT.bind(this), D = this.setD.bind(this);
    const sc = (el, v) => { const k = clamp(v, 0, 1).toFixed(3); if (el._s !== k) { el._s = k; el.style.transform = 'scaleX(' + k + ')'; } };
    sc(e.hpBar, p.hp / p.maxHp); sc(e.kiBar, p.ki / p.maxKi); sc(e.xpBar, p.xp / p.xpNext);
    T(e.hpTxt, Math.max(0, Math.ceil(p.hp)) + ' / ' + Math.ceil(p.maxHp));
    T(e.kiTxt, Math.floor(p.ki) + ' / ' + Math.round(p.maxKi));
    T(e.xpTxt, Math.floor(p.xp) + ' / ' + p.xpNext);
    T(e.lvl, String(p.level)); T(e.formName, p.form.name); T(e.chName, p.ch.name);
    this.setV(e.formName, '--fc', '#' + (p.form.aura || 0xffe14a).toString(16).padStart(6, '0'));
    T(e.trait, p.trait ? p.trait.name.toUpperCase() + ' · ✚ ' + p.trait.good + ' · ✖ ' + p.trait.bad : '');
    if (e.trait._t !== e.trait.title) e.trait.title = e.trait._t;
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
      T(e.stageName, (game.step + 1) + '/' + ROUTE_LEN + ' · ' + S.name);
      let gl, gv, gc = '';
      if (game.practice) { gl = 'MODO'; gv = 'ENTRENAMIENTO'; gc = '#7fe07a'; }
      else if (S.final) { gl = 'OBJETIVO'; gv = 'DERROTA AL JEFE'; gc = '#ff6a8a'; }
      else if (S.bossAt && !game.bossSpawned) { gl = 'JEFE EN'; gv = fmtTime(Math.max(0, S.bossAt - game.stageTime)); gc = '#ff9ad8'; }
      else if (game.swarm) { gl = 'ENJAMBRE'; gv = '¡ACTIVO! +' + fmtTime(game.stageTime - game.swarmAt()); gc = '#ff4d5e'; }
      else { gl = 'ENJAMBRE EN'; gv = fmtTime(Math.max(0, game.swarmAt() - game.stageTime)); }
      T(e.goalL, gl); T(e.goal, gv); this.setV(e.goal, 'color', gc);
      T(e.diffName, (game.daily ? 'DESAFÍO DIARIO · ' : '') + game.diff.name + (game.chal ? ' · DESAFÍO ' + game.chal : '')); this.setV(e.diffName, 'color', game.diff.color);
      T(e.balls, game.pickups.collected + ' / 7');
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
    sc(e.blockFill, p.guardT > 0 ? 1 - p.guardT / 1.4 : 1);
    this.setC(e.abBlock, 'ab' + (p.blocking ? ' on' : p.guardT > 0 || p.ki < 10 ? ' low' : ''));
    sc(e.tpFill, 1 - p.tpCd / p.tpMax);
    this.setC(e.abTp, 'ab' + (p.tpCd > 0 || p.ki < 35 ? ' low' : ''));
    // Ultimate: solo para los personajes que la tienen; se ilumina cuando está cargada
    if (p.ch.ult) {
      if (e.abUlt.style.display !== '') e.abUlt.style.display = '';
      sc(e.ultFill, p.ult / p.ch.ult.cost);
      this.setC(e.abUlt, 'ab' + (p.ult >= p.ch.ult.cost && p.ki >= p.maxKi * ULT_KI ? ' on' : ''));
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
    const PC = { boss: '#ff3050', time: '#6fd0ff', temple: '#5be07a', merchant: '#ffd24a', swapper: '#ff9a3a' }, PL = { boss: '!', time: '⧗', temple: '▲', merchant: 'B', swapper: 'R' };
    for (const q of game.points.list) {
      if (q.used && q.type !== 'merchant' && q.type !== 'swapper') continue;
      edge(q.x, q.z, PC[q.type], PL[q.type], 7);
    }
    for (let i = 0; i < 7; i++) if (!pk.got[i]) edge(pk.bx[i], pk.bz[i], '#ffb030', '★', 6);
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
      if (big) { g.fillStyle = '#fff'; g.font = '700 11px "M PLUS Rounded 1c",sans-serif'; g.fillText(o.type === 'merchant' ? 'BULMA' : o.type === 'swapper' ? 'ROSHI' : o.type === 'boss' ? 'ALTAR' : o.type === 'time' ? 'TIEMPO' : 'TEMPLO', cx + s + 3, cy + 3); }
    }
    for (const r of game.points.rifts) {
      const pulse = 5 * k + Math.sin(t * 6) * 2;
      g.fillStyle = '#' + r.col.toString(16).padStart(6, '0'); g.strokeStyle = '#fff'; g.beginPath(); g.arc(X(r.x), X(r.z), pulse, 0, 6.3); g.fill(); g.stroke();
      if (big) { g.fillStyle = '#fff'; g.font = '700 12px "M PLUS Rounded 1c",sans-serif'; g.fillText('GRIETA · ' + STAGES[r.to].name, X(r.x) + pulse + 3, X(r.z) + 3); }
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
    const e = this.el, s = this.screen, TITLES = { play: 'ELIGE A TU GUERRERO', shop: 'TIENDA', missions: 'MISIONES Y LOGROS', stats: 'ESTADÍSTICAS', options: 'OPCIONES', records: 'RÉCORDS', account: 'CUENTA', credits: 'CRÉDITOS' };
    e.zeniMenu.textContent = Save.d.zeni;
    e.menu.classList.toggle('ishome', s === 'home');
    e.menuNav.innerHTML = s === 'home' ? '' : '<button class="back" data-go="home">◂ VOLVER</button><h3>' + TITLES[s] + '</h3>';
    if (s === 'home') this.renderHome(); else if (s === 'play') this.renderPlay(); else if (s === 'shop') this.renderShopScreen(); else if (s === 'stats') this.renderStatsScreen(); else if (s === 'options') this.renderOptions(); else if (s === 'records') this.renderRecords(); else if (s === 'account') this.renderAccount(); else if (s === 'credits') this.renderCredits(); else this.renderMissions();
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
      '<button class="big" data-go="records">RÉCORDS</button>' +
      '<button class="big" data-go="account">CUENTA<small>' + this.accountLabel() + '</small></button>' +
      '<button class="big" data-go="stats">ESTADÍSTICAS</button>' +
      '<button class="big" data-go="options">OPCIONES</button>' +
      '<button class="big" data-go="credits">CRÉDITOS</button>' +
      '<button class="big ghost" data-exit>SALIR</button></div></div>' +
      '<div class="hr">' + this.dailyCard() + '<div class="hcard"><h4>MISIONES DIARIAS</h4>' + daily + '<h4 style="margin-top:12px">RACHA</h4><p>' + Save.d.login.streak + ' día(s) seguidos</p></div></div></div>';
  }
  /** Tarjeta del desafío diario: modificadores de hoy, tu mejor puntuación y botón para jugar */
  dailyCard() {
    const mods = dailyMods(), D = Save.d.day && Save.d.day.date === todayStr() ? Save.d.day : null, sel = charById(Save.d.sel);
    return '<div class="hcard daily"><h4>☀ DESAFÍO DIARIO · ' + todayStr().split('-').reverse().join('/') + '</h4>' +
      mods.map((m) => '<div class="mod"><i>' + m.icon + '</i><div><b>' + m.name + '</b><small>' + m.text + '</small></div></div>').join('') +
      '<p class="dim">Mapa del día, dificultad NORMAL. ' + (D ? 'Tu mejor marca hoy: <b>' + D.best.toLocaleString('es-ES') + '</b> (' + D.tries + ' intento' + (D.tries > 1 ? 's' : '') + ')' : 'Termínalo hoy: +300 monedas') + '</p>' +
      '<button class="start" data-start="daily">JUGAR CON ' + sel.name + '</button></div>';
  }

  /** Créditos: autores de los sprites (pack «Dragon Ball Sagas») */
  renderCredits() {
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    this.el.menuBody.innerHTML = '<div class="hcard"><h4>SPRITES DE PERSONAJES</h4><p class="dim">Sprites del pack «Dragon Ball Sagas», hechos por la comunidad. Gracias a sus autores:</p>' +
      SPRITE_CREDITS.map((c) => '<div class="mod"><i>★</i><div><b>' + esc(c.author) + '</b><small>' + c.what.map(esc).join(' · ') + '</small></div></div>').join('') +
      '<h4 style="margin-top:12px">DRAGON BALL</h4><p class="dim">Dragon Ball es una obra de Akira Toriyama. Juego de fans sin ánimo de lucro.</p></div>';
  }

  renderPlay() {
    this.renderChars();
    const d = Save.d.diff;
    const diffs = DIFFS.map((x) => '<button class="dbtn' + (x.id === d ? ' on' : '') + '" style="--c:' + x.color + '" data-diff="' + x.id + '"><b>' + x.name + '</b><small>' + 'x' + x.coins + ' monedas · +' + x.reward + ' al ganar</small></button>').join('');
    const sel = charById(Save.d.sel);
    this.el.menuBody.innerHTML += '<div class="rules">4 mapas por partida. Derrota al jefe para abrir la grieta y elegir camino; a los 10 minutos llega el enjambre final.</div><div class="playbar"><div class="diffs">' + diffs + '</div><button class="start alt" data-start="practice">ENTRENAMIENTO</button><button class="start alt" data-start="daily">☀ DESAFÍO DIARIO</button><button class="start" data-start>¡A LUCHAR!<small>con ' + sel.name + '</small><span class="k">ENTER</span></button></div>';
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
        (v.ult ? '<h4>ULTIMATE [Q] · ' + v.ult.name + '</h4><p>Se carga derrotando enemigos. ' + ULT_DESC[v.ult.type || 'rift'] + ' Cuesta un ' + Math.round(ULT_KI * 100) + '% del Ki máximo.' + (v.ult.debuff ? '<br><span class="trb">✖ Después: ' + v.ult.debuff.name.toLowerCase() + ', ' + v.ult.debuff.text + '.</span>' : '') + '</p>' : '') +
        '<h4>ATAQUE BÁSICO</h4><p><i>' + WEAPONS[v.start[0]].icon + '</i> <b>' + WEAPONS[v.start[0]].name + '</b> · ' + WEAPONS[v.start[0]].lv[0] + '</p>' +
        '<h4>TÉCNICAS (al subir de nivel)</h4>' + techs.map((id) => { const W = WEAPONS[id], lock = W.shop && !Save.d.techs.includes(id); return '<p class="' + (lock ? 'lockt' : '') + '"><i>' + W.icon + '</i> <b>' + W.name + '</b> · NV ' + (W.minLv || 2) + (lock ? ' · 🔒 en la tienda' : '') + '</p>'; }).join('') +
        '<h4>FUSIONES (las dos técnicas al nivel 5)</h4>' + fusionsFor(v.id).map((f) => { const F = WEAPONS[f], lock = F.fusion.some((x) => !techOwned(x)); return '<p class="' + (lock ? 'lockt' : '') + '"><i>⚭</i> <b>' + F.name + '</b> · ' + F.fusion.map((x) => WEAPONS[x].name).join(' + ') + (lock ? ' · 🔒 requiere técnica de la tienda' : '') + (F.down ? ' · <span class="trb">✖ ' + F.down.text + '</span>' : '') + '</p>'; }).join('') +
        '<h4>TRANSFORMACIONES</h4><div class="forms ftl">' + v.forms.map((f, i) => { const T = traitOf(v, i); return '<span>' + f.name + ' <em>NV ' + f.lvl + '</em>' + (T ? '<small class="trg">✚ ' + T.good + '</small><small class="trb">✖ ' + T.bad + '</small>' : '') + '</span>'; }).join('') + '</div>' +
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
    // Técnicas propias de cada personaje: no se compran, vienen incluidas
    for (const c of CHARACTERS) for (const id of c.unique || []) {               // los personajes «próximamente» no tienen técnicas
      const W = WEAPONS[id];
      if (!W || W.shop || W.fusion || id === (c.start || [])[0]) continue;
      h += '<div class="item"><div class="ic" style="color:#' + W.color.toString(16).padStart(6, '0') + '">' + W.icon + '</div><div><small style="color:var(--xp)">' + c.name + ' · NV ' + (W.minLv || 2) + ' · TÉCNICA PROPIA</small><br><b>' + W.name + '</b><p>' + W.lv[0] + ' Sale seguro la primera vez que llegas a su nivel.</p></div><button disabled>INCLUIDA</button></div>';
    }
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
    const v = Save.d.vol || { mus: 0.5, sfx: 0.75 }, O = Save.d.opt, sl = (k, name, val) => '<div class="item opt"><div><b>' + name + '</b><input type="range" min="0" max="100" value="' + Math.round(val * 100) + '" data-vol="' + k + '"></div><b>' + Math.round(val * 100) + '%</b></div>';
    const qb = [['auto', 'AUTO'], ['high', 'ALTA'], ['medium', 'MEDIA'], ['low', 'BAJA']].map((q) => '<button class="qb' + (O.quality === q[0] ? ' on' : '') + '" data-q="' + q[0] + '">' + q[1] + '</button>').join('');
    const pr = this.game && this.game.perf ? this.game.perf.pr : 1;
    this.el.menuBody.innerHTML = '<div class="shop">' + sl('mus', 'MÚSICA', v.mus) + sl('sfx', 'EFECTOS DE SONIDO', v.sfx) +
      '<div class="item opt wide"><div><b>CALIDAD GRÁFICA</b><div class="qbs">' + qb + '</div><p>AUTO ajusta la resolución sola para mantener 60 FPS y quita las sombras si hace falta. BAJA: sin sombras, menos partículas y sin suavizado de bordes (este último, al recargar la página). Resolución actual: x' + pr.toFixed(2) + '</p></div></div>' +
      '<div class="item opt"><div><b>REDUCIR DESTELLOS</b><p>Quita los fogonazos blancos/negros y los negativos de los impact frames.</p></div><button class="tgl' + (O.flash ? ' on' : '') + '" data-flash>' + (O.flash ? 'ACTIVADO' : 'DESACTIVADO') + '</button></div>' +
      '<div class="item opt"><div><b>TEMBLOR DE PANTALLA</b><input type="range" min="0" max="100" value="' + Math.round(O.shake * 100) + '" data-shake></div><b>' + Math.round(O.shake * 100) + '%</b></div>' +
      '<div class="item opt wide"><div><b>COPIA DE SEGURIDAD</b><p>Exporta tu progreso (se descarga un archivo y se copia el texto) o importa una copia pegando el texto o eligiendo el archivo.</p>' +
      '<textarea id="saveTxt" spellcheck="false" placeholder="Aquí aparecerá el texto de la copia, o pega aquí una copia para importarla"></textarea>' +
      '<div class="qbs"><button class="qb" data-exp>EXPORTAR</button><button class="qb" data-imp>IMPORTAR' + (this.impArmed ? ' (CONFIRMAR)' : '') + '</button><button class="qb" data-impfile>ELEGIR ARCHIVO…</button><input type="file" id="impFile" accept=".json,.txt,application/json" style="display:none"></div>' +
      (this.optMsg ? '<p class="omsg">' + this.optMsg + '</p>' : '') + '</div></div>' +
      '<div class="item info wide"><div><b>CONTROLES</b><p>TECLADO: WASD mover · ESPACIO dash · C cargar Ki · SHIFT (o botón derecho) bloquear · F Transmisión Instantánea · G transformarse (sube de una en una: cuesta Ki, y mantener la forma también) · H volver a la forma base · F11 o el botón de la esquina: pantalla completa · E interactuar · M mapa · TAB estadísticas · P pausa.<br>' +
      'MANDO: stick izq. mover · stick der. cámara · A dash · B Transmisión Instantánea · X interactuar · Y transformarse · LB/LT bloquear · RB/RT cargar Ki · cruceta ↓ forma base · START pausa · SELECT mapa. En las cartas: cruceta o stick para elegir, A para confirmar y X para cambiar las cartas.</p></div></div>' +
      '<div class="item info"><div><b>SONIDO SINTETIZADO</b><p>Toda la música y los efectos se generan en el momento con Web Audio (sin archivos). En el móvil, el sonido se activa al tocar la pantalla por primera vez.</p></div></div></div>';
    this.optMsg = '';
  }

  /* ---------- Récords: ranking local y desafíos diarios ---------- */
  renderRecords() {
    const tabs = '<div class="tabs"><button class="tab ' + (this.rtab === 'all' ? 'on' : '') + '" data-rtab="all">MEJORES PARTIDAS</button><button class="tab ' + (this.rtab === 'daily' ? 'on' : '') + '" data-rtab="daily">DESAFÍO DIARIO</button><button class="tab ' + (this.rtab === 'online' ? 'on' : '') + '" data-rtab="online">RANKING MUNDIAL</button></div>';
    let h = '';
    if (this.rtab === 'daily') {
      const list = Save.d.rank.filter((r) => r.daily);
      h = '<div class="msplit"><div>' + this.dailyCard() + '</div><div><h4 class="sec">HISTORIAL (MEJOR MARCA DE CADA DÍA)</h4>' +
        (Save.d.dayHist.length ? '<div class="rank">' + Save.d.dayHist.map((d) => '<div class="rr"><span>' + d.date.split('-').reverse().join('/') + '</span><span class="dim">' + (d.mods || []).join(' · ') + '</span><b>' + d.best.toLocaleString('es-ES') + '</b></div>').join('') + '</div>' : '<p class="dim">Aún no has jugado ningún desafío diario.</p>') +
        (list.length ? '<h4 class="sec">TUS MEJORES DESAFÍOS</h4>' + this.rankTable(list) : '') + '</div></div>';
    } else if (this.rtab === 'online') {
      h = '<div class="tabs sub"><button class="tab ' + (this.otab === 'global' ? 'on' : '') + '" data-otab="global">GENERAL</button><button class="tab ' + (this.otab === 'daily' ? 'on' : '') + '" data-otab="daily">DESAFÍO DE HOY</button></div>' +
        '<div id="onRank"><p class="dim" style="text-align:center">Cargando ranking…</p></div>';
    } else h = Save.d.rank.length ? this.rankTable(Save.d.rank) : '<div class="empty"><b>Aún no hay partidas</b><p>Tu mejor puntuación aparecerá aquí en cuanto termines una partida.</p><button data-go="play">ELEGIR GUERRERO</button></div>';
    this.el.menuBody.innerHTML = tabs + h;
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
      box().innerHTML = (list.length ? '<div class="rank">' + list.map((r, i) => {
        const c = charById(r.ch);
        return '<div class="rr' + (i < 3 ? ' top' + i : '') + (r.user_id === me ? ' me' : '') + '"><em>' + (i + 1) + '</em><span><b>' + escHtml(r.name) + '</b> · ' + (c ? c.name : escHtml(r.ch)) + (r.win ? ' · ★ VICTORIA' : '') + '</span><span class="dim">' + r.kills + ' enemigos · NV ' + r.level + ' · mapa ' + (r.step + 1) + '/' + ROUTE_LEN + ' · ' + fmtTime(r.time) + ' · ' + diffById(r.diff).name + '</span><b>' + Number(r.score).toLocaleString('es-ES') + '</b></div>';
      }).join('') + '</div>' : '<p class="dim" style="text-align:center">Todavía no hay partidas. ¡Sé el primero!</p>') +
        (on.logged ? '' : '<p class="dim" style="text-align:center">Inicia sesión en CUENTA para aparecer en el ranking.</p>');
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
    let h;
    if (!on || !on.ready) {
      h = '<div class="acct"><h4 class="sec">RANKING MUNDIAL NO CONFIGURADO</h4><p class="dim">Falta conectar el juego con Supabase: ejecuta <b>supabase/ranking.sql</b> en el SQL Editor de tu proyecto y pon su URL y su clave pública en <b>js/online.js</b>.</p><p class="dim">Mientras tanto puedes jugar con normalidad y tus récords se guardan en este navegador.</p></div>';
    } else if (on.logged) {
      h = '<div class="acct"><h4 class="sec">SESIÓN INICIADA</h4><p class="who">' + escHtml(on.name) + '</p><p class="dim">' + escHtml(on.user.email || '') + '</p>' +
        '<p>Tus partidas se suben solas al ranking mundial al terminar (el modo entrenamiento no cuenta).</p>' +
        '<div class="arow"><button class="abtn" data-rtab-go="online">VER RANKING MUNDIAL</button><button class="abtn alt" data-acct="out">CERRAR SESIÓN</button></div></div>';
    } else {
      const reg = this.atab === 'signup';
      h = '<div class="tabs"><button class="tab ' + (!reg ? 'on' : '') + '" data-atab="login">INICIAR SESIÓN</button><button class="tab ' + (reg ? 'on' : '') + '" data-atab="signup">CREAR CUENTA</button></div>' +
        '<form class="acct" data-acct-form="' + (reg ? 'signup' : 'login') + '" novalidate>' +
        (reg ? '<label>NOMBRE DE JUGADOR<input id="acName" maxlength="16" autocomplete="nickname" placeholder="De 3 a 16 caracteres"></label>' : '') +
        '<label>CORREO<input id="acMail" type="email" autocomplete="email"></label>' +
        '<label>CONTRASEÑA<input id="acPass" type="password" autocomplete="' + (reg ? 'new-password' : 'current-password') + '" placeholder="Mínimo 6 caracteres"></label>' +
        '<button class="abtn" type="submit">' + (reg ? 'CREAR CUENTA' : 'ENTRAR') + '</button><p class="msg" id="acMsg"></p>' +
        '<p class="dim">Sin cuenta puedes jugar igual; solo no apareces en el ranking mundial.</p></form>';
    }
    this.el.menuBody.innerHTML = h;
  }
  rankTable(list) {
    return '<div class="rank">' + list.slice(0, 15).map((r, i) => {
      const c = charById(r.ch);
      return '<div class="rr' + (i < 3 ? ' top' + i : '') + '"><em>' + (i + 1) + '</em><span><b>' + (c ? c.name : r.ch) + '</b> · ' + r.date.split('-').reverse().join('/') + (r.daily ? ' · ☀' : '') + (r.win ? ' · ★ VICTORIA' : '') + '</span><span class="dim">' + r.kills + ' enemigos · NV ' + r.level + ' · mapa ' + r.step + '/' + ROUTE_LEN + ' · ' + fmtTime(r.time) + '</span><b>' + r.score.toLocaleString('es-ES') + '</b></div>';
    }).join('') + '</div>';
  }

  /* ---------- Estadísticas acumuladas ---------- */
  renderStatsScreen() {
    const st = Save.d.stats, n = (k) => Math.floor(st[k] || 0);
    const rows = [['PARTIDAS', n('runs')], ['VICTORIAS', n('wins')], ['TIEMPO JUGADO', fmtTime(n('time'))], ['MAPA MÁS LEJANO', n('maxStage') + ' / ' + ROUTE_LEN], ['NIVEL MÁXIMO', n('maxLevel')],
      ['ENEMIGOS DERROTADOS', n('kills')], ['ÉLITES', n('elites')], ['JEFES', n('bosses')], ['DAÑO TOTAL', n('damage')], ['DAÑO RECIBIDO', n('taken')], ['DASHES', n('dashes')],
      ['CÁPSULAS ABIERTAS', n('capsules')], ['MALDICIONES', n('curses')], ['DESAFÍOS ACEPTADOS', n('temples')], ['HABITACIONES DEL TIEMPO', n('rooms')], ['DESEOS A SHENRON', n('wishes')], ['COMBO MÁXIMO', n('maxCombo')], ['GOLPE MÁS FUERTE', n('bestHit')], ['TRANSFORMACIONES', n('transforms')], ['FUSIONES', n('fusions')], ['EVENTOS', n('events')], ['RIVALES DERROTADOS', n('rivals')], ['BLOQUEOS PERFECTOS', n('perfects')], ['TELETRANSPORTES', n('tps')], ['DESAFÍOS DIARIOS', n('dailies')]];
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

/* Descripción de cada tipo de Ultimate (ficha del personaje) */
const ULT_DESC = {
  rift: 'Abre dos grietas en el espacio que cruzan el mapa.',
  bomb: 'Una esfera gigante cae sobre la horda y arrasa una zona enorme.',
  beam: 'Un rayo colosal que atraviesa todo lo que tienes delante.',
  storm: 'Rodea de granadas de ki a todos los enemigos cercanos y las hace estallar.',
  discs: 'Lanza una corona de discos gigantes que cortan todo a su paso.',
  slash: 'Tajos en todas direcciones y la explosión del Burning Attack.'
};
