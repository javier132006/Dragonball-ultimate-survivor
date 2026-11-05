'use strict';
/* =====================================================================
   intro.js · Intro de las fusiones al empezar la partida con Vegetto
   (pendientes Pothala) o Gogeta (danza de la fusión), DENTRO del mapa:
   Goku y Vegeta aparecen junto al jugador (sprites del pack, hojas
   vegito_intro y gogeta_intro), la cámara se acerca, hay impact frames
   en el momento de la fusión y al final aparece el propio jugador.
   Encima va un canvas transparente para los textos y los impactos.
   Cualquier tecla, clic o toque la salta.
   ===================================================================== */

/* Guiones: cada paso dura `d` segundos.
   L / R = fotogramas del personaje de la izquierda y de la derecha (se reparten a lo largo del paso)
   lx / rx = posición en pantalla (0..1) al empezar y al acabar el paso · fR = voltear al de la derecha
   imp = secuencia de impact frames (B negro · I negativo · W blanco · C color) · f = fusión (fotogramas) con luz
   reveal = aparece el jugador · txt = texto grande */
const INTROS = {
  // Vegetto: Vegeta (izquierda) y Goku (derecha); los sprites de vuelo del pack ya van uno hacia el otro
  vegito: { sheet: 'vegito_intro', name: 'VEGETTO', sub: 'Ni Goku ni Vegeta... soy Vegetto.', col: '#6fd8ff', steps: [
    { d: 0.6, L: [1], R: [0], lx: [0.22, 0.24], rx: [0.78, 0.76] },
    { d: 1.2, L: [1], R: [0], lx: [0.24, 0.27], rx: [0.76, 0.73], txt: '¡PONTE EL PENDIENTE, VEGETA!', small: true },
    { d: 0.8, L: [3], R: [2], lx: [0.27, 0.47], rx: [0.73, 0.53], txt: '¡POTHALA!' },
    { d: 0.45, imp: 'BIWIBC' },
    { d: 0.8, f: [4, 5, 6, 7] },
    { d: 1.7, reveal: 1 }
  ] },
  // Zamasu fusionado: Black Rosé (izquierda) y Zamasu (derecha, volteado para mirar a Black) se ponen los pendientes Pothala
  zamasuf: { sheet: 'zamasuf_intro', name: 'ZAMASU FUSIONADO', sub: 'Dos cuerpos, una sola justicia.', col: '#ff6ac8', fR: true, steps: [
    { d: 0.6, L: [0], R: [2], lx: [0.22, 0.24], rx: [0.78, 0.76] },
    { d: 1.2, L: [0], R: [3], lx: [0.24, 0.27], rx: [0.76, 0.73], txt: 'ES LA HORA, ZAMASU.', small: true },
    { d: 0.8, L: [1], R: [3], lx: [0.27, 0.47], rx: [0.73, 0.53], txt: '¡POTHALA!' },
    { d: 0.45, imp: 'BIWIBC' },
    { d: 0.8, f: [4, 5, 6] },
    { d: 1.7, reveal: 1 }
  ] },
  // Gogeta: Goku (izquierda) y Vegeta (derecha, volteado para que mire a Goku) bailan la danza de la fusión
  gogeta: { sheet: 'gogeta_intro', name: 'GOGETA', sub: 'Soy Gogeta. Y voy a acabar contigo.', col: '#ffd84a', fR: true, steps: [
    { d: 0.6, L: [0], R: [11], lx: [0.26, 0.27], rx: [0.74, 0.73] },
    { d: 0.9, L: [1, 2, 3, 4], R: [12, 13, 14, 15], lx: [0.27, 0.33], rx: [0.73, 0.67], txt: '¡FU...!' },
    { d: 0.8, L: [5, 6, 7, 8], R: [16, 17, 18, 19], lx: [0.33, 0.39], rx: [0.67, 0.61], txt: '¡...SIÓN!' },
    { d: 0.6, L: [9, 10], R: [20, 21], lx: [0.39, 0.43], rx: [0.61, 0.57], txt: '¡HA!' },
    { d: 0.45, imp: 'BIWIBC' },
    { d: 0.7, f: [22] },
    { d: 1.7, reveal: 1 }
  ] }
};
const INTRO_SPREAD = 9;
/** Oculta los avisos de la partida durante las escenas (no tapan los textos de la cinemática) */
const cineToasts = (on) => { for (const id of ['toast', 'feed']) { const e = document.getElementById(id); if (e) e.style.visibility = on ? '' : 'hidden'; } };           // unidades del mundo entre la posición 0 y 1 de la pantalla

class FusionIntro {
  constructor(game) {
    this.g = game; this.on = false; this.t = 0; this.batches = {};
    const c = this.cv = document.createElement('canvas');
    c.id = 'intro';
    c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:22;display:none;cursor:pointer';
    document.body.appendChild(c);
    this.ctx = c.getContext ? c.getContext('2d') : null;
    // Saltar la intro: cualquier tecla, clic o toque (después de medio segundo, para no saltarla sin querer)
    const skip = (e) => { if (this.on && this.t > 0.5) { if (e) e.preventDefault(); this.end(); } };
    window.addEventListener('keydown', skip, true);
    c.addEventListener('pointerdown', skip);
  }
  /** ¿Tiene intro este personaje? */
  has(id) { return !!INTROS[id] && !!(this.g.ui.sheets && this.g.ui.sheets[INTROS[id].sheet]) && !!this.ctx; }
  /** Lote de sprites de la hoja de la intro (mismo tamaño de píxel que los personajes: 52,3 px = 3,6 unidades) */
  batch(name) {
    if (!this.batches[name]) {
      const s = this.g.ui.sheets[name], H = 3.6 * s.h / 52.3;
      this.batches[name] = new SpriteBatch(this.g.scene, { max: 3, texture: s.tex, cols: s.cols, rows: s.rows, w: H * (s.w / s.h), h: H, anchor: 2 / s.h, blend: true, renderOrder: 3 });
    }
    return this.batches[name];
  }
  /** Empieza la intro de `id` y llama a done() al acabar */
  start(id, done) {
    const g = this.g, p = g.player;
    this.S = INTROS[id]; this.done = done; this.t = 0; this.on = true; this.revealed = false; this.lastImp = '';
    this.total = this.S.steps.reduce((a, s) => a + s.d, 0);
    this.b = this.batch(this.S.sheet);
    p.introHide = true; p.cineChg = false;
    this.cam = g.camDistT; g.camDist = 14; g.camDistT = 11;      // la cámara se acerca a la escena
    this.cv.style.display = 'block'; this.resize(); g.ui.showHud(false); cineToasts(false);
    SFX.play('charge');
  }
  end() {
    if (!this.on) return;
    const g = this.g, p = g.player;
    this.on = false; this.cv.style.display = 'none';
    this.b.reset(); p.introHide = false; p.cineChg = false;
    g.camDistT = this.cam || 19; g.renderer.domElement.style.filter = ''; g.ui.showHud(true); cineToasts(true);
    if (!this.revealed) this.reveal();
    if (this.done) this.done();
  }
  resize() {
    const r = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = Math.round(window.innerWidth * r); this.cv.height = Math.round(window.innerHeight * r);
  }
  /** Aparece el jugador: estallido de su aura, onda, cráter y temblor */
  reveal() {
    const g = this.g, p = g.player, V = g.vfx, F = formFx(p.ch, p.formIdx), col = p.form.ki || 0xffffff;
    this.revealed = true; p.introHide = false; p.cineChg = this.on;
    if (V && V.ok) { V.play((F && F.burst) || 'tfGold2', p.x, 2.2, p.z, { size: 10, dur: 0.9, pri: 1 }); V.crater(p.x, p.z, 5, col); }
    g.fx.ring(g.fx.aura, p.x, 0.5, p.z, 70, 26, 0.8, 0.5, col);
    g.fx.burst(g.fx.sparks, p.x, 1.4, p.z, 40, 9, 0.6, 0.6, 6, col);
    g.shake(1.4); SFX.play('bigboom');
  }
  /** Texto grande con contorno negro (estilo cartel) */
  text(t, x, y, size, col) {
    const g = this.ctx;
    g.save(); g.font = '900 ' + Math.round(size) + 'px "Bangers", "Impact", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = size * 0.16; g.strokeStyle = '#000'; g.strokeText(t, x, y);
    g.fillStyle = col || '#fff'; g.fillText(t, x, y); g.restore();
  }
  /** Un impact frame (B negro con estallido blanco · I negativo · W blanco con líneas negras · C color con líneas) */
  impact(k, W, H) {
    const g = this.ctx, el = this.g.renderer.domElement, cx = W / 2, cy = H * 0.55;
    el.style.filter = k === 'I' ? 'grayscale(1) contrast(9) invert(1)' : '';
    const rays = (col, n, w) => {
      g.save(); g.translate(cx, cy); g.fillStyle = col;
      for (let i = 0; i < n; i++) { const a = (i / n) * 6.2832 + Math.random() * 0.2, r = Math.hypot(W, H); g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a - w) * r, Math.sin(a - w) * r); g.lineTo(Math.cos(a + w) * r, Math.sin(a + w) * r); g.fill(); }
      g.restore();
    };
    if (k === 'B') { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); rays('#fff', 18, 0.03); }
    else if (k === 'W') { g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); rays('#000', 26, 0.012); }
    else if (k === 'C') { g.fillStyle = this.S.col; g.globalAlpha = 0.85; g.fillRect(0, 0, W, H); g.globalAlpha = 1; rays('#fff', 22, 0.015); }
  }
  update(dt) {
    if (!this.on) return true;
    this.t += dt;
    if (this.t >= this.total) { this.end(); return true; }
    if (this.cv.width !== Math.round(window.innerWidth * Math.min(2, window.devicePixelRatio || 1))) this.resize();
    const G = this.g, p = G.player, g = this.ctx, W = this.cv.width, H = this.cv.height, S = this.S, T = this.t;
    // Paso actual y avance dentro del paso (0..1)
    let t0 = 0, st = S.steps[0];
    for (const s of S.steps) { if (T < t0 + s.d) { st = s; break; } t0 += s.d; }
    const u = clamp((T - t0) / st.d, 0, 0.999), fr = (L) => L[Math.min(L.length - 1, (u * L.length) | 0)];
    // Sprites en el mundo: a los lados del jugador, en el eje «derecha» de la cámara
    const rx = G.camCos, rz = -G.camSin, at = (a) => (a[0] + (a[1] - a[0]) * u - 0.5) * INTRO_SPREAD;
    const B = this.b; B.begin();
    if (st.L) {
      const l = at(st.lx), r = at(st.rx);
      B.push(p.x + rx * l, 0, p.z + rz * l, fr(st.L), 0, 0, 1, 1, 0xffffff);
      B.push(p.x + rx * r, 0, p.z + rz * r, fr(st.R), S.fR ? 1 : 0, 0, 1, 1, 0xffffff);
    }
    if (st.f) {                                                    // la fusión: silueta blanca que brilla
      B.push(p.x, 0, p.z, fr(st.f), 0, st.f.length === 1 ? 1 : (((T * 12) | 0) % 2), 1, 1, 0xffffff);
      if (((T * 8) | 0) !== this.ringQ) { this.ringQ = (T * 8) | 0; G.fx.ring(G.fx.aura, p.x, 0.5, p.z, 30, 8 + u * 10, 0.5, 0.4, 0xffffff); }
    }
    B.end();
    if (st.reveal && !this.revealed) this.reveal();
    if (st.reveal) p.cineChg = u < 0.7;                            // pose de cargar ki con el aura y luego quieto
    // Capa 2D: impactos, textos y aviso
    g.clearRect(0, 0, W, H);
    if (st.imp) {
      const k = st.imp[Math.min(st.imp.length - 1, (u * st.imp.length) | 0)];
      this.impact(k, W, H);
      if (k !== this.lastImp) { this.lastImp = k; G.shake(0.9); if (k === 'W') SFX.play('stinger'); }
    } else if (this.lastImp) { this.lastImp = ''; G.renderer.domElement.style.filter = ''; }
    if (st.f) { g.fillStyle = 'rgba(255,255,255,' + (0.5 * (1 - u)) + ')'; g.fillRect(0, 0, W, H); }
    if (st.txt) this.text(st.txt, W / 2, H * 0.2, H * (st.small ? 0.06 : 0.13) * (1 + (1 - Math.min(1, u * 5)) * 0.25), '#fff');
    if (st.reveal) {
      g.save(); g.globalAlpha = Math.min(1, u * 4);
      this.text(S.name, W / 2, H * 0.17, H * 0.15, S.col);
      this.text(S.sub, W / 2, H * 0.3, H * 0.045, '#fff');
      g.restore();
    }
    // Barras de cine arriba y abajo (se abren al final)
    const bar = H * 0.09 * Math.min(1, T / 0.4, (this.total - T) / 0.4);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, bar); g.fillRect(0, H - bar, W, bar);
    this.text('PULSA CUALQUIER TECLA PARA SALTAR', W / 2, H - bar / 2, H * 0.022, 'rgba(255,255,255,0.7)');
    return false;
  }
}

/* =====================================================================
   Animación de la Ultimate de cada personaje, dentro del mapa: la cámara
   se acerca, el personaje carga con su pose de Ki mientras crece su
   técnica (Genkidama sobre la cabeza, Death Ball, Kamehameha en las
   manos...), sale el nombre con la frase, cambia a la pose de ataque,
   impact frames y, al acabar, se dispara la Ultimate de siempre.
   ===================================================================== */
/* orb: animación que crece (name), dónde (head = encima de la cabeza · hands = delante, a la altura de las manos · ring = corona de esferas),
   tamaño inicial y final, tinte · gather: color de las partículas que convergen · imp: impact frames del final */
const ULT_CINE = {
  goku: { quote: '¡Amigos, prestadme vuestra energía!', kanji: '元気玉', col: '#6fc8ff', orb: { name: 'genki', at: 'head', s: [1, 7.5], tint: 0x9fd8ff }, gather: 0x9fe8ff, imp: 'BIWC' },
  vegeta: { quote: '¡FINAL... FLASH!', kanji: 'ファイナルフラッシュ', col: '#ffe14a', orb: { name: 'bbOrb', at: 'hands', s: [0.6, 3.4], tint: 0xfff08a }, gather: 0xffe14a, imp: 'WIBC' },
  black: { quote: 'Contempla la justicia de un dios.', kanji: '神の裁き', col: '#ff6ac8', orb: { name: 'darkRing', at: 'ring1', s: [2, 7], tint: 0xff7ac8 }, gather: 0xff6ac8, imp: 'BICB' },
  piccolo: { quote: '¡Hellzone... Grenade!', kanji: '魔空包囲弾', col: '#ffd040', orb: { name: 'hzCluster', at: 'ring', s: [0.5, 1.8], tint: 0xffe070 }, gather: 0x9cff8a, imp: 'WIBC' },
  gohan: { quote: 'Papá... préstame tu fuerza.', kanji: '親子かめはめ波', col: '#8fe0ff', orb: { name: 'orbKame', at: 'hands', s: [0.6, 3.2], tint: 0xffffff }, gather: 0x8fe0ff, imp: 'BIWC' },
  freezer: { quote: 'Desaparece junto a este planeta.', kanji: 'デスボール', col: '#ff5ad0', orb: { name: 'dbBall', at: 'head', s: [0.6, 7], tint: 0xff8a4a }, gather: 0xff7ad8, imp: 'BICB' },
  krilin: { quote: '¡KIENZAN!', kanji: '気円斬', col: '#ffe86a', orb: { name: 'disc', at: 'head', s: [1, 4.5], tint: 0xfff4a0, spin: 1 }, gather: 0xffe86a, imp: 'WIC' },
  trunks: { quote: '¡Burning... Slash!', kanji: 'バーニングスラッシュ', col: '#ffb040', orb: { name: 'burnSwirl', at: 'hands', s: [0.8, 4], tint: 0xffffff }, gather: 0xffb040, imp: 'BIWC' },
  cell: { quote: 'El Kamehameha perfecto.', kanji: 'かめはめ波', col: '#6aff9a', orb: { name: 'orbKame', at: 'hands', s: [0.6, 3.4], tint: 0x9affb0 }, gather: 0x6aff9a, imp: 'BIWC' },
  bardock: { quote: '¡Este es mi último ataque, Freezer!', kanji: '最後の攻撃', col: '#8ad0ff', orb: { name: 'bbOrb', at: 'head', s: [0.8, 5.5], tint: 0x9fd8ff }, gather: 0x8ad0ff, imp: 'WIBC' },
  vegito: { quote: '¡Final... Kamehameha!', kanji: 'ファイナルかめはめ波', col: '#6fd8ff', orb: { name: 'orbKame', at: 'hands', s: [0.6, 3.8], tint: 0xffffff }, gather: 0x9fe0ff, imp: 'BIWIC' },
  broly: { quote: '¡¡KAKAROTTOOOO!!', kanji: 'ギガンティックミーティア', col: '#7dff5a', orb: { name: 'beastBall', at: 'hands', s: [0.8, 6], tint: 0x9aff6a }, gather: 0x7dff5a, imp: 'BIBIC' },
  gogeta: { quote: '¡Big Bang... Kamehameha!', kanji: 'ビッグバンかめはめ波', col: '#ffd84a', orb: { name: 'bbOrb', at: 'hands', s: [0.6, 4], tint: 0xffffff }, gather: 0xffe14a, imp: 'WIBIC' },
  kefla: { quote: '¡Esto es la furia saiyajin!', kanji: '超サイヤ人', col: '#ff8ad8', orb: { name: 'bbOrb', at: 'hands', s: [0.6, 3.4], tint: 0xffb8f0 }, gather: 0xff8ad8, imp: 'WIBC' },
  gotenks: { quote: '¡Fusión... Gotenks!', kanji: 'ゴテンクス', col: '#c8a0ff', orb: { name: 'genki', at: 'head', s: [1, 6], tint: 0xe0c8ff }, gather: 0xc8a0ff, imp: 'BIWC' },
  trunksarm: { quote: '¡Te cortaré en mil pedazos!', kanji: '未来剣', col: '#6fb8ff', orb: { name: 'disc', at: 'head', s: [1, 4], tint: 0xa8e0ff, spin: 1 }, gather: 0x6fb8ff, imp: 'WBIC' },
  caulifla: { quote: '¡Rompo todo!', kanji: 'カリフラ', col: '#ff6aa0', orb: { name: 'genki', at: 'hands', s: [0.8, 4], tint: 0xffc0dc }, gather: 0xff6aa0, imp: 'WIBC' },
  kale: { quote: '¡Aaaaah!', kanji: 'ケール', col: '#ffd040', orb: { name: 'dbBall', at: 'head', s: [0.6, 6], tint: 0xffd040 }, gather: 0xffd040, imp: 'BWIC' },
  kyabe: { quote: '¡Discos... ahora!', kanji: 'キャベ', col: '#ffe86a', orb: { name: 'disc', at: 'head', s: [1, 4.5], tint: 0xfff4a0, spin: 1 }, gather: 0xffe86a, imp: 'WIC' },
  toppo: { quote: '¡Justicia de Pride!', kanji: 'トッポ', col: '#ff4a4a', orb: { name: 'hzCluster', at: 'ring', s: [0.5, 2], tint: 0xff8a6a }, gather: 0xff4a4a, imp: 'WIBC' },
  janemba: { quote: 'Vuestra nada es mi energía.', kanji: 'ジャネンバ', col: '#ff3a3a', orb: { name: 'darkRing', at: 'ring1', s: [2, 7], tint: 0xff5a5a }, gather: 0xff3a3a, imp: 'BICB' },
  jiren: { quote: 'Os mostraré lo que es el poder.', kanji: 'ジレン', col: '#d0d0d8', orb: { name: 'bbOrb', at: 'hands', s: [0.6, 3.6], tint: 0xf0f0ff }, gather: 0xd0d0d8, imp: 'WIBC' },
  turles: { quote: '¡Esta vez no fallaré!', kanji: 'ターレス', col: '#c8c8ff', orb: { name: 'disc', at: 'head', s: [1, 4.5], tint: 0xe0e0ff, spin: 1 }, gather: 0xc8c8ff, imp: 'WIC' },
  saibaman: { quote: '¡Saibaman... al ataque!', kanji: 'サイバイマン', col: '#9ad040', orb: { name: 'hzCluster', at: 'ring', s: [0.5, 1.8], tint: 0xc8ff6a }, gather: 0x9ad040, imp: 'WIBC' },
  bills: { quote: 'Aquí se acaba todo.', kanji: '破壊神', col: '#b08aff', orb: { name: 'dbBall', at: 'head', s: [0.6, 7], tint: 0xb08aff }, gather: 0xb08aff, imp: 'BICB' },
  cooler: { quote: 'Esto es lo que vale el poder.', kanji: 'クウラ', col: '#d080ff', orb: { name: 'orbKame', at: 'hands', s: [0.6, 3.2], tint: 0xf0c0ff }, gather: 0xd080ff, imp: 'BIWC' },
  hitto: { quote: '¡Ahora!', kanji: 'ヒット', col: '#8a6aff', orb: { name: 'darkRing', at: 'ring1', s: [2, 6], tint: 0xb8a0ff }, gather: 0x8a6aff, imp: 'BICB' },
  raditz: { quote: '¡Hermano... ayúdame!', kanji: 'ラディッツ', col: '#c8ff8a', orb: { name: 'genki', at: 'head', s: [1, 6], tint: 0xe0ffc8 }, gather: 0xc8ff8a, imp: 'BIWC' },
  andro16: { quote: 'Mi energía es infinita.', kanji: '人造人間16号', col: '#7dff5a', orb: { name: 'bbOrb', at: 'hands', s: [0.6, 3.4], tint: 0xc8ff9a }, gather: 0x7dff5a, imp: 'WIBC' },
  andro17: { quote: 'Nunca me cansaré.', kanji: '人造人間17号', col: '#6ab8ff', orb: { name: 'disc', at: 'head', s: [1, 4.5], tint: 0xa8e0ff, spin: 1 }, gather: 0x6ab8ff, imp: 'WIC' },
  andro18: { quote: 'No necesito más que esto.', kanji: '人造人間18号', col: '#ffe86a', orb: { name: 'hzCluster', at: 'ring', s: [0.5, 1.8], tint: 0xfff0a0 }, gather: 0xffe86a, imp: 'WIC' },
  majin: { quote: '¡Buu... kiyaaa!', kanji: '魔人ブウ', col: '#ff9ad0', orb: { name: 'genki', at: 'head', s: [1, 7], tint: 0xffc8e8 }, gather: 0xff9ad0, imp: 'BIWC' },
  superbuu: { quote: '¡Ahora sí, ahora!', kanji: 'スーパーブウ', col: '#ff7ac8', orb: { name: 'genki', at: 'hands', s: [0.8, 4], tint: 0xffc0e8 }, gather: 0xff7ac8, imp: 'BICB' },
  zamasuf: { quote: 'Arrodillaos ante la justicia absoluta.', kanji: '絶対正義', col: '#ff6ac8', orb: { name: 'darkRing', at: 'ring1', s: [2, 7.5], tint: 0xff8ad8 }, gather: 0xff6ac8, imp: 'BIWIBC' },
  zamasu: { quote: 'Vuestra existencia no tiene sentido.', kanji: 'ザマス', col: '#a890ff', orb: { name: 'darkRing', at: 'ring1', s: [2, 6], tint: 0xc8b8ff }, gather: 0xa890ff, imp: 'BICB' },
};
const ULT_CINE_T = { zoom: 0.25, charge: 1.25, strike: 0.35, hold: 0.2 };   // duración de cada parte (s)

class UltCine {
  constructor(game) {
    this.g = game; this.on = false; this.t = 0;
    const c = this.cv = document.createElement('canvas');
    c.id = 'ultCine';
    c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:22;display:none;pointer-events:none';
    document.body.appendChild(c);
    this.ctx = c.getContext ? c.getContext('2d') : null;
  }
  has(id) { return !!ULT_CINE[id] && !!this.ctx; }
  start(id, name, done) {
    const g = this.g;
    this.R = ULT_CINE[id]; this.S = { col: this.R.col }; this.name = name; this.done = done; this.t = 0; this.on = true; this.lastImp = ''; this.gq = -1;
    const T = ULT_CINE_T; this.total = T.zoom + T.charge + T.strike + T.hold;
    this.cam = g.camDistT; g.camDistT = this.R.orb.at === 'head' ? 15 : 10;      // con la esfera sobre la cabeza, la cámara se aleja un poco
    this.cv.style.display = 'block'; this.resize(); g.ui.showHud(false); cineToasts(false);
    SFX.play('charge'); SFX.scream(1.4, 160);
  }
  end() {
    if (!this.on) return;
    const g = this.g, p = g.player;
    this.on = false; this.cv.style.display = 'none';
    p.cineChg = false; g.camDistT = this.cam || 19; g.renderer.domElement.style.filter = ''; g.ui.showHud(true); cineToasts(true);
    if (this.done) this.done();
  }
  resize() { const r = Math.min(2, window.devicePixelRatio || 1); this.cv.width = Math.round(window.innerWidth * r); this.cv.height = Math.round(window.innerHeight * r); }
  /** Dibuja un fotograma de una animación de efectos (en su lote) para este cuadro */
  fx(name, k, x, y, z, size, tint, rot) {
    const V = this.g.vfx, a = FXA[name]; if (!V || !V.ok || !a) return;
    V.now(a.s === 'fxbig' ? 2 : 0, fxf(name, k % a.f.length), x, y, z, size, 1, tint, rot || 0);
  }
  update(dt) {
    if (!this.on) return true;
    this.t += dt;
    if (this.t >= this.total) { this.end(); return true; }
    const G = this.g, p = G.player, R = this.R, O = R.orb, T = ULT_CINE_T, t = this.t;
    const tc = t - T.zoom, ts = tc - T.charge, charging = tc >= 0 && ts < 0, striking = ts >= 0;
    const u = clamp(tc / T.charge, 0, 1);                                    // avance de la carga
    // Hacia dónde mira el personaje (en el eje «derecha» de la cámara)
    const sx = (p.flip ? -1 : 1) * G.camCos, sz = (p.flip ? -1 : 1) * -G.camSin;
    // Pose: cargando Ki (con su aura) y después la pose de ataque
    p.cineChg = charging;
    if (striking) { p.beamT = Math.max(p.beamT, 0.2); p.atkT = Math.max(p.atkT, 0.2); }
    // La técnica que crece: encima de la cabeza, en las manos o en corona alrededor
    if (tc >= 0) {
      const s = O.s[0] + (O.s[1] - O.s[0]) * Math.min(1, striking ? 1 : u), k = (t * 14) | 0, rot = O.spin ? t * 14 : 0;
      if (O.at === 'head') this.fx(O.name, k, p.x, 2.9 + s * 0.36, p.z, s, O.tint, rot);
      else if (O.at === 'hands') this.fx(O.name, k, p.x + sx * (0.9 + s * 0.25), 1.5, p.z + sz * (0.9 + s * 0.25), s, O.tint, rot);
      else if (O.at === 'ring1') this.fx(O.name, k, p.x, 1.3, p.z, s, O.tint, t * 3);
      else for (let i = 0; i < 8; i++) {                                     // corona de esferas (Hellzone)
        const a = (i / 8) * 6.2832 + t * 1.5, r = 5 - u * 1.5;
        this.fx(O.name, k + i, p.x + Math.cos(a) * r, 1.2 + (i % 3) * 0.8, p.z + Math.sin(a) * r, s, O.tint);
      }
    }
    // Energía que converge hacia el personaje mientras carga
    if (charging && ((t * 30) | 0) !== this.gq) {
      this.gq = (t * 30) | 0;
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * 6.2832, r = rand(6, 10), y = rand(0.5, 4);
        G.fx.sparks.emit(p.x + Math.cos(a) * r, y, p.z + Math.sin(a) * r, -Math.cos(a) * r * 2.2, (2 - y) * 0.8, -Math.sin(a) * r * 2.2, 0.45, 0.35, 0, R.gather);
      }
      if (this.gq % 9 === 0) G.fx.ring(G.fx.aura, p.x, 0.4, p.z, 30, 6 + u * 4, 0.45, 0.35, R.gather);
      G.shake(0.15 + u * 0.35);
    }
    // Capa 2D: barras de cine, nombre y frase, impact frames
    const g = this.ctx, W = this.cv.width, H = this.cv.height;
    if (W !== Math.round(window.innerWidth * Math.min(2, window.devicePixelRatio || 1))) this.resize();
    g.clearRect(0, 0, W, H);
    if (striking && ts < T.strike) {
      const k = R.imp[Math.min(R.imp.length - 1, (ts / T.strike * R.imp.length) | 0)];
      this.impact(k, W, H);
      if (k !== this.lastImp) { this.lastImp = k; G.shake(1.1); if (k === 'W') SFX.play('stinger'); }
    } else if (this.lastImp) { this.lastImp = ''; G.renderer.domElement.style.filter = ''; }
    const bar = H * 0.1 * Math.min(1, t / 0.2, (this.total - t) / 0.15);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, bar); g.fillRect(0, H - bar, W, bar);
    if (tc > 0.1 && !(striking && ts < T.strike)) {
      const a = Math.min(1, (tc - 0.1) * 5), sc = 1 + Math.max(0, 0.2 - (tc - 0.1)) * 1.5;
      g.save(); g.globalAlpha = a;
      this.text(R.kanji, W * 0.5, H * 0.66, H * 0.045, 'rgba(255,255,255,0.85)');      // abajo: la técnica crece arriba
      this.text(this.name, W * 0.5, H * 0.75, H * 0.09 * sc, R.col);
      this.text(R.quote, W * 0.5, H - bar - H * 0.05, H * 0.038, '#fff');
      g.restore();
    }
    return false;
  }
}
UltCine.prototype.text = FusionIntro.prototype.text;
UltCine.prototype.impact = FusionIntro.prototype.impact;
