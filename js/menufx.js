'use strict';
/* =====================================================================
   menufx.js · Viaje entre lugares del mapa
   Al tocar un lugar se reproduce una transición (hojas de fotogramas en
   assets/menu/tr_*.webp, sacadas de los GIF del proyecto) y, al llegar,
   se enseña la ilustración del lugar (assets/menu/loc_<id>.jpg) antes de
   abrir su pantalla. Un toque o una tecla lo salta.
   ===================================================================== */
/* w,h: tamaño de un fotograma · cols: columnas de la hoja · n: fotogramas · ms: duración de cada uno ·
   peak: fotograma en el que la pantalla queda tapada (ahí se cambia de pantalla) · flash: color del destello de ese momento */
const MENU_TR = {
  azul1: { w: 382, h: 338, cols: 4, n: 12, ext: 'webp', ms: 80, peak: 6, flash: '#eaf7ff' },
  azul2: { w: 293, h: 251, cols: 5, n: 20, ext: 'webp', ms: 60, peak: 9, flash: '#eaf7ff' },
  grieta: { w: 299, h: 250, cols: 5, n: 20, ext: 'webp', ms: 62, peak: 11, flash: '#12041f' },
  lineas: { w: 299, h: 247, cols: 5, n: 20, ext: 'webp', ms: 60, peak: 12, flash: '#f3e6ff' },
  portal: { w: 302, h: 251, cols: 5, n: 20, ext: 'webp', ms: 60, peak: 12, flash: '#f3e6ff' },
  nimbus: { w: 298, h: 250, cols: 5, n: 20, ext: 'jpg', ms: 75, peak: 14, flash: '', full: true }   // escena completa: Goku se va en la Nube Kinton
};
/* Qué transición lleva a cada lugar: cielo y nubes para la Tierra, energía morada para lo sobrenatural */
const PLACE_TR = { paoz: 'nimbus', kame: 'azul2', lookout: 'azul1', karin: 'azul2', cc: 'azul1', tenka: 'lineas', altar: 'portal', kaio: 'grieta' };
/* Lugar al que pertenece cada pantalla del menú (su ilustración se usa de fondo) */
const SCREEN_LOC = { play: 'paoz', summon: 'altar', legend: 'lookout', shop: 'cc', missions: 'kame' };

class MenuFx {
  constructor() { this.img = {}; this.el = null; this.run = null; }
  /** Descarga las hojas sin bloquear nada (se llama al ver el mapa por primera vez) */
  preload() {
    if (this.pre) return; this.pre = true;
    for (const k in MENU_TR) { const im = new Image(); im.src = av('assets/menu/tr_' + k + '.' + MENU_TR[k].ext); this.img[k] = im; }
    for (const id in PLACE_TR) { const im = new Image(); im.src = av('assets/menu/loc_' + id + '.jpg'); }
  }
  /** ¿Sin animaciones? (ajuste del sistema o «Reducir destellos» de Opciones) */
  calm() { return (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || !!(Save.d.opt && Save.d.opt.flash); }
  build() {
    const el = this.el = document.createElement('div'); el.id = 'mfx';
    el.innerHTML = '<div class="mfc"><i class="mfb"></i><img class="mfi" alt=""></div><canvas class="mfv"></canvas><i class="mff"></i>';
    document.body.appendChild(el);
    this.cv = el.querySelector('.mfv'); this.card = el.querySelector('.mfc'); this.flash = el.querySelector('.mff');
    const skip = (e) => { if (this.run) { e.preventDefault(); e.stopPropagation(); this.skip(); } };
    el.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', (e) => { if (this.run && !e.repeat) { e.preventDefault(); e.stopImmediatePropagation(); this.skip(); } }, true);
  }
  /**
   * Viaja a un lugar. onSwap se llama UNA vez, cuando la pantalla está tapada (ahí se abre el destino).
   * quick acorta la parada en la ilustración (para los lugares que empiezan una partida).
   */
  play(place, onSwap, quick) {
    if (!this.el) this.build();
    if (this.run) this.end();
    this.preload();
    const key = PLACE_TR[place] || 'azul2', T = MENU_TR[key], im = this.img[key], calm = this.calm();
    const ok = !calm && im && im.complete && im.naturalWidth > 0;
    const R = this.run = { T, im, ok, f: -1, t0: performance.now(), swapped: false, onSwap, hold: quick ? 180 : calm ? 520 : 700, tEnd: 0 };   // quick: el destino es una partida, no se la tapa más de lo justo
    const el = this.el;
    el.className = 'on' + (T.full && ok ? ' full' : ''); this.card.className = 'mfc'; this.flash.style.opacity = 0; this.flash.style.background = T.flash || '#000';
    this.card.querySelector('.mfi').src = av('assets/menu/loc_' + place + '.jpg');
    this.card.querySelector('.mfb').style.backgroundImage = 'url(' + av('assets/menu/loc_' + place + '.jpg') + ')';
    const g = this.cv.getContext('2d'); this.fit(); g.clearRect(0, 0, this.cv.width, this.cv.height);
    this.cv.style.opacity = 1;
    const step = (now) => {
      if (this.run !== R) return;
      if (!R.ok) {                                                   // sin hoja (o sin animaciones): fundido corto y la ilustración
        const u = (now - R.t0) / 220; this.flash.style.background = '#050818'; this.flash.style.opacity = R.swapped ? Math.max(0, 1 - (now - R.tSwap) / 260) : Math.min(1, u);
        if (u >= 1 && !R.swapped) this.swap(now);
      } else {
        const f = Math.min(T.n - 1, Math.floor((now - R.t0) / T.ms));
        if (f !== R.f) { R.f = f; this.draw(g, T, im, f); }
        const d = (now - R.t0) / T.ms - T.peak;                      // distancia (en fotogramas) al momento de cambio
        if (T.flash) this.flash.style.opacity = Math.max(0, 1 - Math.abs(d) / 1.6) * 0.92;
        if (d >= 0 && !R.swapped) this.swap(now);
        if (T.full && R.swapped) this.cv.style.opacity = Math.max(0, 1 - (now - R.tSwap) / (T.ms * (T.n - T.peak)));
        if (f >= T.n - 1 && !R.tEnd) { R.tEnd = now; g.clearRect(0, 0, this.cv.width, this.cv.height); }
      }
      // Tras el cambio: se enseña el lugar un momento y se funde hacia su pantalla
      const tail = R.ok ? R.tEnd : R.tSwap;
      if (R.swapped && tail && now - tail > R.hold) { this.card.classList.add('out'); if (now - tail > R.hold + 300) { this.end(); return; } }
      R.raf = requestAnimationFrame(step);
    };
    R.raf = requestAnimationFrame(step);
  }
  swap(now) {
    const R = this.run; if (!R || R.swapped) return;
    R.swapped = true; R.tSwap = now; this.card.classList.add('on');
    try { if (R.onSwap) R.onSwap(); } catch (e) { console.error(e); }
  }
  /** Saltar: abre el destino ya y quita la transición */
  skip() { const R = this.run; if (!R) return; if (!R.swapped) this.swap(performance.now()); this.end(); }
  end() { const R = this.run; if (R && R.raf) cancelAnimationFrame(R.raf); this.run = null; if (this.el) this.el.className = ''; }
  fit() {
    const d = Math.min(1.5, window.devicePixelRatio || 1); this.cv.width = Math.round(innerWidth * d); this.cv.height = Math.round(innerHeight * d);
  }
  /** Fotograma a pantalla completa, recortando lo que sobre (como «cover») y sin suavizar: es pixel art */
  draw(g, T, im, f) {
    const W = this.cv.width, H = this.cv.height, k = Math.max(W / T.w, H / T.h) * (T.full ? 1 : 1.06), dw = T.w * k, dh = T.h * k;
    g.imageSmoothingEnabled = false; g.clearRect(0, 0, W, H);
    g.drawImage(im, (f % T.cols) * T.w, ((f / T.cols) | 0) * T.h, T.w, T.h, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }
}
