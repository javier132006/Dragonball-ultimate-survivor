/* =====================================================================
   worldmap.js · El inicio es un mapa del mundo de Dragon Ball
   Dibujado a mano en canvas 2D: cielo, mar, islas y lugares míticos.
   Cada lugar lleva a una parte del juego y tu guerrero viaja entre
   ellos con la Teletransportación (Shunkan Idō).
   ===================================================================== */
/** Lugares del mapa: posición relativa (fx, fy dentro de la zona útil), nombre, kanji y a qué lleva */
const PLACES = [
  { id: 'lookout', oy: 84, fx: 0.5, fy: 0.07, name: 'Templo de Kami', sub: 'Modo Leyenda', kanji: '神', act: { go: 'legend' } },
  { id: 'kaio', oy: 66, fx: 0.87, fy: 0.1, name: 'Planeta del Kaio', sub: 'Entrenamiento', kanji: '界', act: { start: 'practice' } },
  { id: 'karin', oy: 30, fx: 0.5, fy: 0.44, name: 'Torre de Karin', sub: 'Desafío del día', kanji: '仙', act: { start: 'daily' } },
  { id: 'paoz', oy: 66, fx: 0.16, fy: 0.5, name: 'Montaña Paoz', sub: 'Elige guerrero', kanji: '悟', act: { go: 'play' } },
  { id: 'kame', oy: 40, fx: 0.29, fy: 0.9, name: 'Kame House', sub: 'Misiones y logros', kanji: '亀', act: { go: 'missions' } },
  { id: 'cc', oy: 54, fx: 0.84, fy: 0.44, name: 'Cápsula Corp.', sub: 'Tienda', kanji: '店', act: { go: 'shop' } },
  { id: 'altar', oy: 44, fx: 0.17, fy: 0.1, name: 'Altar de Shenron', sub: 'Invocar transformaciones', kanji: '願', act: { go: 'summon' } },
  { id: 'tenka', oy: 50, fx: 0.72, fy: 0.8, name: 'Torneo', sub: 'Récords', kanji: '武', act: { go: 'records' } },
  { id: 'cellring', oy: 44, fx: 0.08, fy: 0.84, name: 'Juegos de Cell', sub: 'Combate Z · 1 vs 1 a 3 vs 3', kanji: '闘', act: { zfight: true } }
];
const placeById = (id) => PLACES.find((p) => p.id === id);

class WorldMap {
  constructor(ui) {
    this.ui = ui; this.root = null; this.raf = 0; this.t = 0; this.flyer = new Shenron.Flyer(); this.busy = false;
    this.bg = document.createElement('canvas');                       // capa fija (se redibuja solo al cambiar el tamaño)
    this.onResize = () => { if (this.root) this.layout(); };
  }
  /** Coloca el mapa dentro de .wm (lo crea renderHome) y arranca la animación */
  mount(root) {
    this.unmount();
    this.root = root; this.cv = root.querySelector('.wmc'); this.ctx = this.cv.getContext('2d');
    this.layout();
    window.addEventListener('resize', this.onResize);
    let last = performance.now();
    const loop = (now) => {
      if (!this.root || !this.root.isConnected) { this.unmount(); return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (document.visibilityState !== 'hidden') this.frame(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  unmount() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0; this.root = null; this.busy = false;
    window.removeEventListener('resize', this.onResize);
  }
  /** Zona útil (sin la barra de arriba ni la de abajo) y posición en píxeles de cada lugar */
  layout() {
    const W = this.root.clientWidth || innerWidth, H = this.root.clientHeight || innerHeight, small = H < 520;
    this.W = W; this.H = H; this.dpr = Math.min(2, window.devicePixelRatio || 1) * (small ? 1 : 1);
    this.top = small ? 50 : 76; this.bot = small ? 70 : 104;
    this.k = Math.min(W / 1500, H / 820);                              // escala de los dibujos
    const uh = H - this.top - this.bot;
    this.pos = {};
    for (const p of PLACES) this.pos[p.id] = { x: Math.round(W * (0.04 + p.fx * 0.92)), y: Math.round(this.top + p.fy * uh) };
    this.horizon = this.top + uh * 0.3;
    for (const c of [this.cv, this.bg]) { c.width = Math.round(W * this.dpr); c.height = Math.round(H * this.dpr); }
    this.cv.style.width = W + 'px'; this.cv.style.height = H + 'px';
    this.drawStatic();
    // Carteles de los lugares y el guerrero
    for (const el of this.root.querySelectorAll('[data-place]')) { const P = this.pos[el.dataset.place]; el.style.left = P.x + 'px'; el.style.top = Math.round(P.y + placeById(el.dataset.place).oy * this.k) + 'px'; }
    this.placeAvatar(Save.d.mapAt || 'paoz');
  }
  placeAvatar(id) {
    const av = this.root && this.root.querySelector('.wav');
    if (!av) return;
    const P = this.pos[id] || this.pos.paoz;
    av.style.left = P.x + 'px'; av.style.top = P.y + 'px';
    for (const el of this.root.querySelectorAll('[data-place]')) el.classList.toggle('here', el.dataset.place === id);
  }
  /**
   * Teletransportación: el guerrero se lleva los dedos a la frente, desaparece y aparece en el destino.
   * cb se llama al llegar (unos 0,45 s).
   */
  travel(id, cb) {
    if (this.busy || !this.root) return;
    const av = this.root.querySelector('.wav'), from = Save.d.mapAt || 'paoz';
    if (!av) { if (cb) cb(); return; }
    this.busy = true;
    if (typeof SFX !== 'undefined') SFX.play('tp');
    const done = () => { this.busy = false; Save.d.mapAt = id; Save.write(); if (cb) cb(); };
    if (from === id) { av.classList.add('it-pulse'); setTimeout(() => { av.classList.remove('it-pulse'); done(); }, 260); return; }
    av.classList.add('it-out');
    this.streak(this.pos[from]);
    setTimeout(() => {
      this.placeAvatar(id); this.streak(this.pos[id]);
      av.classList.remove('it-out'); av.classList.add('it-in');
      setTimeout(() => { av.classList.remove('it-in'); done(); }, 230);
    }, 190);
  }
  /** Rayo vertical de luz donde se va o se llega */
  streak(P) {
    const s = document.createElement('i'); s.className = 'itln'; s.style.left = P.x + 'px'; s.style.top = P.y + 'px';
    this.root.appendChild(s); setTimeout(() => s.remove(), 420);
  }

  /* ---------- Dibujo fijo: cielo, mar, islas y lugares ---------- */
  drawStatic() {
    const c = this.bg.getContext('2d'), W = this.W, H = this.H, k = this.k, hz = this.horizon;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // Cielo de anime
    const sky = c.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#2f7fe0'); sky.addColorStop(0.55, '#62b4ff'); sky.addColorStop(1, '#c4ecff');
    c.fillStyle = sky; c.fillRect(0, 0, W, hz + 2);
    // Sol con rayos suaves
    const sx = W * 0.36, sy = hz * 0.3, sr = 60 * k + 20;
    const sg = c.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr * 5); sg.addColorStop(0, 'rgba(255,250,210,.95)'); sg.addColorStop(0.15, 'rgba(255,240,170,.45)'); sg.addColorStop(1, 'rgba(255,240,170,0)');
    c.fillStyle = sg; c.fillRect(0, 0, W, hz);
    c.fillStyle = '#fffbe6'; c.beginPath(); c.arc(sx, sy, sr * 0.55, 0, Math.PI * 2); c.fill();
    // Montañas lejanas en el horizonte
    const mtn = (col, h, seed, amp) => {
      c.fillStyle = col; c.beginPath(); c.moveTo(0, hz + 2);
      for (let x = 0; x <= W + 40; x += 40) c.lineTo(x, hz - h * (0.45 + 0.55 * Math.abs(Math.sin(x * 0.006 + seed) * Math.cos(x * 0.0023 + seed * 2))) * amp);
      c.lineTo(W, hz + 2); c.closePath(); c.fill();
    };
    mtn('#9fcbe8', 70 * k + 20, 1.3, 1); mtn('#86b9dc', 46 * k + 12, 4.1, 1);
    // Mar con degradado y reflejo del sol
    const sea = c.createLinearGradient(0, hz, 0, H);
    sea.addColorStop(0, '#5fc3f0'); sea.addColorStop(0.25, '#2a9be0'); sea.addColorStop(1, '#0b5aa8');
    c.fillStyle = sea; c.fillRect(0, hz, W, H - hz);
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(0, hz, W, 3);
    const P = this.pos;
    // Islas y lugares (de atrás adelante)
    this.drawKaio(c, P.kaio.x, P.kaio.y, k);
    this.drawAltar(c, P.altar.x, P.altar.y, k);
    this.island(c, P.cc.x, P.cc.y + 46 * k, 260 * k, 92 * k, 7);
    this.drawCC(c, P.cc.x, P.cc.y + 20 * k, k);
    this.island(c, P.paoz.x, P.paoz.y + 50 * k, 250 * k, 90 * k, 3);
    this.drawPaoz(c, P.paoz.x, P.paoz.y + 26 * k, k);
    // Torre de Karin: sale de una isla abajo y llega hasta casi el templo
    const tb = Math.min(H + 20, P.karin.y + (H - P.karin.y) * 0.95);
    this.island(c, P.karin.x, tb - 10 * k, 120 * k, 40 * k, 11);
    this.drawKarin(c, P.karin.x, P.karin.y, tb, P.lookout.y, k);
    this.drawLookout(c, P.lookout.x, P.lookout.y, k);
    this.island(c, P.kame.x, P.kame.y + 24 * k, 120 * k, 40 * k, 5);
    this.drawKame(c, P.kame.x, P.kame.y + 4 * k, k);
    this.island(c, P.cellring.x, P.cellring.y + 24 * k, 150 * k, 46 * k, 13);
    this.drawRing(c, P.cellring.x, P.cellring.y + 6 * k, k);
    this.island(c, P.tenka.x, P.tenka.y + 26 * k, 170 * k, 52 * k, 9);
    this.drawTenka(c, P.tenka.x, P.tenka.y + 6 * k, k);
    // Viñeta suave para que se lean los carteles
    const v = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,30,0)'); v.addColorStop(1, 'rgba(0,10,40,.35)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
  }
  /** Isla vista de lado: agua clara alrededor, arena, hierba y un acantilado */
  island(c, x, y, rx, ry, seed) {
    const blob = (r1, r2, dy) => {
      c.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * Math.PI * 2, n = 1 + Math.sin(a * 3 + seed) * 0.07 + Math.sin(a * 5 + seed * 2) * 0.05;
        c.lineTo(x + Math.cos(a) * r1 * n, y + dy + Math.sin(a) * r2 * n);
      }
      c.closePath();
    };
    c.fillStyle = 'rgba(160,240,255,.45)'; blob(rx * 1.18, ry * 1.25, 4); c.fill();      // agua poco profunda
    c.fillStyle = '#5a4630'; blob(rx * 0.98, ry, 10); c.fill();                          // acantilado
    c.fillStyle = '#f2dc9a'; blob(rx, ry, 0); c.fill();                                   // arena
    const g = c.createLinearGradient(0, y - ry, 0, y + ry); g.addColorStop(0, '#7ad35a'); g.addColorStop(1, '#3f9a3a');
    c.fillStyle = g; blob(rx * 0.86, ry * 0.78, -3); c.fill();                           // hierba
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 2; blob(rx * 1.08, ry * 1.12, 6); c.stroke();   // espuma
  }
  tree(c, x, y, s, col) {
    c.fillStyle = '#6b4a2a'; c.fillRect(x - s * 0.12, y - s * 0.9, s * 0.24, s * 0.9);
    c.fillStyle = col || '#2f8a34';
    for (const [dx, dy, r] of [[0, -1.25, 0.62], [-0.4, -0.95, 0.48], [0.42, -0.95, 0.48]]) { c.beginPath(); c.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(x - s * 0.15, y - s * 1.45, s * 0.25, 0, Math.PI * 2); c.fill();
  }
  palm(c, x, y, s) {
    c.strokeStyle = '#7a5530'; c.lineWidth = s * 0.16; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + s * 0.3, y - s * 0.8, x + s * 0.15, y - s * 1.5); c.stroke();
    c.strokeStyle = '#2f9a3c'; c.lineWidth = s * 0.14;
    const tx = x + s * 0.15, ty = y - s * 1.5;
    for (const a of [-2.6, -1.9, -1.2, -0.5, 0.2]) { c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo(tx + Math.cos(a) * s * 0.6, ty + Math.sin(a) * s * 0.6 - s * 0.1, tx + Math.cos(a) * s * 0.85, ty + Math.sin(a) * s * 0.4 + s * 0.35); c.stroke(); }
  }
  /** Montaña Paoz: picos kársticos verdes y la casita redonda de Goku */
  drawPaoz(c, x, y, k) {
    const peak = (px, w, h, col) => {
      const g = c.createLinearGradient(px - w, 0, px + w, 0); g.addColorStop(0, '#2d7a3a'); g.addColorStop(0.5, col); g.addColorStop(1, '#215e2c');
      c.fillStyle = g; c.beginPath(); c.moveTo(px - w, y); c.bezierCurveTo(px - w, y - h * 0.7, px - w * 0.6, y - h, px, y - h); c.bezierCurveTo(px + w * 0.6, y - h, px + w, y - h * 0.7, px + w, y); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(0,40,10,.35)'; c.lineWidth = 2; c.stroke();
    };
    peak(x - 120 * k, 44 * k, 150 * k, '#4fa858'); peak(x + 105 * k, 40 * k, 130 * k, '#4aa252'); peak(x - 60 * k, 52 * k, 210 * k, '#5bb862'); peak(x + 45 * k, 48 * k, 180 * k, '#56b05d');
    this.tree(c, x - 160 * k, y + 6 * k, 30 * k); this.tree(c, x + 150 * k, y + 8 * k, 26 * k, '#3a9a3e');
    // Casa de Goku (cúpula pequeña)
    const hx = x + 6 * k, hy = y + 14 * k, r = 26 * k;
    c.fillStyle = '#f5efe0'; c.beginPath(); c.arc(hx, hy, r, Math.PI, 0); c.fill(); c.strokeStyle = '#6a5a40'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#e8402a'; c.beginPath(); c.arc(hx, hy - r * 0.15, r * 0.95, Math.PI * 1.08, Math.PI * 1.92); c.lineTo(hx, hy - r * 0.15); c.fill();
    c.fillStyle = '#4a3420'; c.fillRect(hx - r * 0.18, hy - r * 0.5, r * 0.36, r * 0.5);
    c.fillStyle = '#9fd4ff'; c.beginPath(); c.arc(hx + r * 0.55, hy - r * 0.45, r * 0.13, 0, Math.PI * 2); c.fill();
  }
  /** Cápsula Corporation en la Capital del Oeste */
  drawCC(c, x, y, k) {
    // Edificios de la ciudad
    const cols = ['#f6c7a0', '#cfe2f7', '#f7e0a0', '#d9c8f0', '#bfe6cf'];
    for (let i = 0; i < 9; i++) {
      const bx = x - 190 * k + i * 44 * k, bh = (60 + ((i * 37) % 70)) * k, bw = 34 * k;
      c.fillStyle = cols[i % cols.length]; c.beginPath(); c.roundRect ? c.roundRect(bx, y - bh, bw, bh, [bw * 0.5, bw * 0.5, 0, 0]) : c.rect(bx, y - bh, bw, bh); c.fill();
      c.strokeStyle = 'rgba(40,40,80,.35)'; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = 'rgba(60,110,180,.55)';
      for (let wy = y - bh + 14 * k; wy < y - 8 * k; wy += 14 * k) c.fillRect(bx + 8 * k, wy, bw - 16 * k, 5 * k);
    }
    // La gran cúpula
    const r = 78 * k, dy = y - 4 * k;
    const g = c.createRadialGradient(x - r * 0.35, dy - r * 0.6, r * 0.1, x, dy, r * 1.1); g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#fff1c8'); g.addColorStop(1, '#e8c070');
    c.fillStyle = g; c.beginPath(); c.arc(x, dy, r, Math.PI, 0); c.closePath(); c.fill(); c.strokeStyle = '#8a6a2a'; c.lineWidth = 2.5; c.stroke();
    c.fillStyle = '#2b7fd8'; c.beginPath(); c.arc(x, dy, r, Math.PI * 1.12, Math.PI * 1.88); c.arc(x, dy, r * 0.84, Math.PI * 1.88, Math.PI * 1.12, true); c.closePath(); c.fill();
    c.fillStyle = '#1f5fc0'; c.font = '800 ' + Math.round(13 * k + 4) + 'px "Baloo 2",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('CAPSULE', x, dy - r * 0.52); c.fillText('CORP.', x, dy - r * 0.34);
    // Ventanas redondas
    c.fillStyle = '#7fc4ff'; for (const ox of [-0.45, 0, 0.45]) { c.beginPath(); c.arc(x + ox * r, dy - r * 0.16, r * 0.1, 0, Math.PI * 2); c.fill(); }
  }
  /** Kame House: casa rosa con tejado rojo y una palmera */
  drawKame(c, x, y, k) {
    this.palm(c, x + 58 * k, y + 10 * k, 42 * k);
    const w = 66 * k, h = 40 * k;
    c.fillStyle = '#ff9fc0'; c.fillRect(x - w / 2, y - h, w, h); c.strokeStyle = '#7a3050'; c.lineWidth = 2; c.strokeRect(x - w / 2, y - h, w, h);
    c.fillStyle = '#e83a2a'; c.beginPath(); c.moveTo(x - w * 0.62, y - h); c.lineTo(x, y - h - 30 * k); c.lineTo(x + w * 0.62, y - h); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#5a3a20'; c.fillRect(x - 8 * k, y - 20 * k, 16 * k, 20 * k);
    c.fillStyle = '#9fd4ff'; c.fillRect(x - w * 0.38, y - h * 0.7, 12 * k, 10 * k); c.fillRect(x + w * 0.2, y - h * 0.7, 12 * k, 10 * k);
    c.fillStyle = '#fff'; c.font = '800 ' + Math.round(9 * k + 4) + 'px "Baloo 2",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('KAME HOUSE', x, y - h - 9 * k);
  }
  /** Torneo de Artes Marciales: tatami de piedra y pagodas */
  drawTenka(c, x, y, k) {
    for (const ox of [-70, 70]) {
      const px = x + ox * k, py = y - 24 * k;
      c.fillStyle = '#c03a28'; c.fillRect(px - 16 * k, py - 30 * k, 32 * k, 34 * k);
      c.fillStyle = '#ffb02a'; c.beginPath(); c.moveTo(px - 30 * k, py - 28 * k); c.quadraticCurveTo(px, py - 52 * k, px + 30 * k, py - 28 * k); c.lineTo(px + 22 * k, py - 22 * k); c.lineTo(px - 22 * k, py - 22 * k); c.closePath(); c.fill();
      c.strokeStyle = '#6a2010'; c.lineWidth = 1.5; c.stroke();
    }
    // Tatami (rombo en perspectiva) con losas
    const w = 90 * k, h = 30 * k;
    c.fillStyle = '#d9d2c2'; c.beginPath(); c.moveTo(x, y - h); c.lineTo(x + w, y); c.lineTo(x, y + h); c.lineTo(x - w, y); c.closePath(); c.fill();
    c.fillStyle = '#a89f8a'; c.beginPath(); c.moveTo(x - w, y); c.lineTo(x, y + h); c.lineTo(x + w, y); c.lineTo(x + w, y + 8 * k); c.lineTo(x, y + h + 8 * k); c.lineTo(x - w, y + 8 * k); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(90,80,60,.5)'; c.lineWidth = 1;
    for (let i = 1; i < 4; i++) { const f = i / 4; c.beginPath(); c.moveTo(x - w + w * f, y - h * f); c.lineTo(x + w * f, y + h - h * f); c.stroke(); c.beginPath(); c.moveTo(x - w + w * f, y + h * f); c.lineTo(x + w * f, y - h + h * f); c.stroke(); }
  }
  /** Ring de los Juegos de Cell: plataforma de losas blancas con cuatro postes */
  drawRing(c, x, y, k) {
    const w = 70 * k, h = 24 * k;
    c.fillStyle = '#9aa0a8'; c.beginPath(); c.moveTo(x - w, y); c.lineTo(x, y + h); c.lineTo(x + w, y); c.lineTo(x + w, y + 10 * k); c.lineTo(x, y + h + 10 * k); c.lineTo(x - w, y + 10 * k); c.closePath(); c.fill();
    c.fillStyle = '#eef0f2'; c.beginPath(); c.moveTo(x, y - h); c.lineTo(x + w, y); c.lineTo(x, y + h); c.lineTo(x - w, y); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(80,90,110,.45)'; c.lineWidth = 1;
    for (let i = 1; i < 5; i++) { const f = i / 5; c.beginPath(); c.moveTo(x - w + w * f, y - h * f); c.lineTo(x + w * f, y + h - h * f); c.stroke(); c.beginPath(); c.moveTo(x - w + w * f, y + h * f); c.lineTo(x + w * f, y - h + h * f); c.stroke(); }
    for (const [px, py] of [[x - w, y], [x + w, y], [x, y - h], [x, y + h]]) { c.fillStyle = '#cfd4da'; c.fillRect(px - 3 * k, py - 26 * k, 6 * k, 26 * k); c.fillStyle = '#7a828c'; c.fillRect(px - 4 * k, py - 28 * k, 8 * k, 4 * k); }
    // Un rayo cruzando el ring: aquí se lucha
    c.strokeStyle = 'rgba(255,230,90,.9)'; c.lineWidth = 3 * k; c.beginPath(); c.moveTo(x - w * 0.6, y - 34 * k); c.lineTo(x - w * 0.1, y - 26 * k); c.lineTo(x - w * 0.2, y - 20 * k); c.lineTo(x + w * 0.6, y - 12 * k); c.stroke();
  }
  /** Torre de Karin: columna alta con el santuario de Karin arriba */
  drawKarin(c, x, top, base, lookY, k) {
    const w = 15 * k + 4, colTop = lookY + 40 * k;
    const g = c.createLinearGradient(x - w, 0, x + w, 0); g.addColorStop(0, '#b9a37a'); g.addColorStop(0.45, '#f4ead0'); g.addColorStop(1, '#a08a60');
    c.fillStyle = g; c.fillRect(x - w, colTop, w * 2, base - colTop);
    c.fillStyle = 'rgba(140,40,20,.55)';
    for (let yy = colTop + 30 * k; yy < base; yy += 70 * k) c.fillRect(x - w, yy, w * 2, 5 * k);
    // Santuario de Karin (bulbo)
    const r = 34 * k + 8;
    c.fillStyle = '#efe3c2'; c.beginPath(); c.ellipse(x, top, r, r * 0.55, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#7a6440'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#d0472c'; c.beginPath(); c.ellipse(x, top - r * 0.25, r * 0.8, r * 0.4, 0, Math.PI, 0); c.fill();
    c.fillStyle = '#ffcf3a'; c.beginPath(); c.moveTo(x - 5, top - r * 0.6); c.lineTo(x, top - r * 1.05); c.lineTo(x + 5, top - r * 0.6); c.fill();
    c.fillStyle = '#3a2a1a'; for (const ox of [-0.5, 0, 0.5]) c.fillRect(x + ox * r - 3, top - 2, 6, 8);
  }
  /** Templo de Kami: plataforma flotante con jardín, palmeras y palacio */
  drawLookout(c, x, y, k) {
    const rx = 120 * k + 20, ry = 26 * k + 6;
    // Parte de abajo (cono dorado)
    const g = c.createLinearGradient(x - rx, 0, x + rx, 0); g.addColorStop(0, '#8a6a2a'); g.addColorStop(0.5, '#e8c56a'); g.addColorStop(1, '#7a5a20');
    c.fillStyle = g; c.beginPath(); c.moveTo(x - rx, y); c.quadraticCurveTo(x - rx * 0.3, y + ry * 2.2, x, y + ry * 3.4); c.quadraticCurveTo(x + rx * 0.3, y + ry * 2.2, x + rx, y); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(80,50,10,.6)'; c.lineWidth = 2; c.stroke();
    c.strokeStyle = 'rgba(255,240,180,.5)'; for (let i = 1; i < 4; i++) { c.beginPath(); c.ellipse(x, y + ry * i * 0.75, rx * (1 - i * 0.24), ry * 0.5, 0, 0, Math.PI); c.stroke(); }
    // Plataforma blanca
    c.fillStyle = '#f6f3ea'; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#8a8070'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#7acb5a'; c.beginPath(); c.ellipse(x - rx * 0.45, y, rx * 0.28, ry * 0.5, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.ellipse(x + rx * 0.5, y + 2, rx * 0.25, ry * 0.45, 0, 0, Math.PI * 2); c.fill();
    this.palm(c, x - rx * 0.62, y + 2, 26 * k + 6); this.palm(c, x + rx * 0.66, y + 2, 24 * k + 6);
    // Palacio con cúpulas
    const pw = 52 * k + 10, ph = 22 * k + 6;
    c.fillStyle = '#fbf8ef'; c.fillRect(x - pw / 2, y - ph, pw, ph); c.strokeStyle = '#8a8070'; c.lineWidth = 1.5; c.strokeRect(x - pw / 2, y - ph, pw, ph);
    c.fillStyle = '#fbf8ef'; c.beginPath(); c.arc(x, y - ph, pw * 0.3, Math.PI, 0); c.fill(); c.stroke();
    for (const ox of [-0.5, 0.5]) { c.beginPath(); c.arc(x + ox * pw, y - ph, pw * 0.14, Math.PI, 0); c.fill(); c.stroke(); }
    c.fillStyle = '#3a6ac0'; c.fillRect(x - 4, y - ph * 0.7, 8, ph * 0.7);
  }
  /** Planeta del Kaio: planeta pequeñito con su casa y su árbol */
  /** Altar de Shenron: roca flotante con un pedestal y las 7 esferas brillando */
  drawAltar(c, x, y, k) {
    const rx = 70 * k + 16, ry = 14 * k + 4;
    const halo = c.createRadialGradient(x, y - ry, 4, x, y - ry, rx * 1.5); halo.addColorStop(0, 'rgba(255,220,110,.75)'); halo.addColorStop(1, 'rgba(255,200,60,0)');
    c.fillStyle = halo; c.beginPath(); c.arc(x, y - ry, rx * 1.5, 0, Math.PI * 2); c.fill();
    const g = c.createLinearGradient(0, y, 0, y + ry * 5); g.addColorStop(0, '#8a7a66'); g.addColorStop(1, '#3e3428');
    c.fillStyle = g; c.beginPath(); c.moveTo(x - rx, y); c.lineTo(x - rx * 0.55, y + ry * 2.4); c.lineTo(x - rx * 0.15, y + ry * 4.6); c.lineTo(x + rx * 0.3, y + ry * 2.8); c.lineTo(x + rx, y); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(30,20,10,.6)'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#7fcf5a'; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#2a6a2a'; c.stroke();
    c.fillStyle = '#d9d2c2'; c.beginPath(); c.ellipse(x, y - 2, rx * 0.5, ry * 0.55, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#8a8070'; c.lineWidth = 1.5; c.stroke();
    const br = 6 * k + 3;
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; Shenron.ball(c, x + Math.cos(a) * rx * 0.3, y - 3 - br * 0.6 + Math.sin(a) * ry * 0.3, br, i + 1, 0); }
  }
  drawKaio(c, x, y, k) {
    const r = 40 * k + 10;
    const halo = c.createRadialGradient(x, y, r, x, y, r * 2.2); halo.addColorStop(0, 'rgba(255,250,200,.55)'); halo.addColorStop(1, 'rgba(255,250,200,0)');
    c.fillStyle = halo; c.beginPath(); c.arc(x, y, r * 2.2, 0, Math.PI * 2); c.fill();
    const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r); g.addColorStop(0, '#b8f08a'); g.addColorStop(0.7, '#4fb84a'); g.addColorStop(1, '#2a7a30');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#1f5a24'; c.lineWidth = 2; c.stroke();
    c.strokeStyle = '#d9c08a'; c.lineWidth = 4 * k + 1; c.beginPath(); c.arc(x, y, r * 0.75, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
    // Casa redonda y árbol encima
    c.fillStyle = '#f6efe0'; c.beginPath(); c.arc(x + r * 0.25, y - r * 0.92, r * 0.28, Math.PI, 0); c.fill(); c.strokeStyle = '#6a5a40'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = '#e8402a'; c.beginPath(); c.arc(x + r * 0.25, y - r * 0.95, r * 0.24, Math.PI * 1.15, Math.PI * 1.85); c.lineTo(x + r * 0.25, y - r * 0.95); c.fill();
    this.tree(c, x - r * 0.35, y - r * 0.9, r * 0.32);
  }

  /* ---------- Animación de cada fotograma ---------- */
  frame(dt) {
    this.t += dt;
    const c = this.ctx, W = this.W, H = this.H, k = this.k, t = this.t, hz = this.horizon;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.bg, 0, 0);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // Shenron cruza el cielo de vez en cuando (por detrás de las nubes)
    this.flyer.update(c, dt, { x0: 0, x1: W, y: this.top * 0.6, h: Math.max(60, hz - this.top) });
    // Nubes que se mueven despacio
    for (let i = 0; i < 6; i++) {
      const sp = 8 + i * 3, w = (120 + (i * 53) % 90) * k + 40, x = ((i * 397 + t * sp) % (W + w * 2)) - w, y = this.top * 0.5 + ((i * 71) % Math.max(40, hz - this.top * 0.5 - 30));
      this.cloud(c, x, y, w, i % 2 ? 0.92 : 0.8);
    }
    // Olas: pequeños trazos blancos que suben y bajan
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2; c.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      const fx = ((i * 0.6180339) % 1), fy = ((i * 0.381966 + 0.13) % 1), x = fx * W + Math.sin(t * 0.6 + i) * 12, y = hz + 20 + fy * (H - hz - 20), s = (8 + fy * 16) * (0.6 + k * 0.5);
      const a = 0.25 + 0.75 * Math.max(0, Math.sin(t * 1.4 + i * 1.7));
      c.globalAlpha = a; c.beginPath(); c.moveTo(x - s, y); c.quadraticCurveTo(x - s * 0.5, y - s * 0.35, x, y); c.quadraticCurveTo(x + s * 0.5, y - s * 0.35, x + s, y); c.stroke();
    }
    c.globalAlpha = 1;
    // Destellos del sol sobre el mar
    for (let i = 0; i < 6; i++) {
      const x = W * 0.2 + Math.sin(i * 2.1) * 60 * k, y = hz + 14 + i * 16 * k, a = Math.max(0, Math.sin(t * 3 + i * 1.3));
      c.fillStyle = 'rgba(255,255,230,' + a * 0.7 + ')'; c.fillRect(x - 12 * k, y, 24 * k, 2);
    }
  }
  cloud(c, x, y, w, a) {
    c.globalAlpha = a;
    c.fillStyle = '#ffffff';
    for (const [dx, dy, r] of [[0, 0, 0.26], [0.22, -0.08, 0.22], [-0.22, 0.02, 0.2], [0.4, 0.04, 0.16], [-0.38, 0.06, 0.14]]) { c.beginPath(); c.arc(x + dx * w, y + dy * w, r * w, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = 'rgba(170,200,235,.55)'; c.beginPath(); c.ellipse(x, y + w * 0.12, w * 0.5, w * 0.07, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
  }
}
