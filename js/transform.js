'use strict';
/* =====================================================================
   transform.js · Cinemática de transformación con "impact frames".
   Cada forma tiene su propia receta (colores, frase, efectos y la
   secuencia de fotogramas de impacto). Se dibuja en un canvas 2D
   superpuesto (#cine) + filtros CSS sobre el canvas del juego.

   Secuencia de impacto (letras de la receta "frames"):
     W = destello blanco con líneas negras    B = negro con estallido blanco
     I = negativo en blanco y negro (filtro)  C = color de la forma con líneas
   ===================================================================== */

/* Recetas por personaje e índice de forma.
   c1/c2: colores · quote: grito · frames: impactos · charge: segundos de carga
   fx: efectos extra (rocks, cracks, bolts, ripple, flame, stars, petals, slash, shatter, pulse, sparks)
   shake: temblor máximo durante la carga · kanji: subtítulo del cartel */
const TRANSFORM_FX = {
  goku: [
    null,
    { c1: '#ff2a2a', c2: '#ff9a9a', quote: '¡¡KAIO-KEN!!', frames: 'CWC', charge: 1.1, fx: ['pulse'], shake: 0.5, kanji: '界王拳' },
    { c1: '#ffd400', c2: '#fff6a0', quote: '¡¡AAAAAAAAHHH!!', frames: 'WIBIWC', charge: 1.9, fx: ['rocks', 'cracks', 'bolts'], bolt: '#fff27a', shake: 1.1, kanji: '超サイヤ人' },
    { c1: '#ffe14a', c2: '#bfe8ff', quote: '¡ESTE ES EL PODER QUE SUPERA AL SUPER SAIYAN!', frames: 'IWIBC', charge: 1.8, fx: ['bolts', 'sparks', 'rocks'], bolt: '#9fe0ff', shake: 1.0, kanji: '超サイヤ人２' },
    { c1: '#ffc400', c2: '#fff0a0', quote: '¡¡HAAAAAAAAAAAAAAAA!!', frames: 'BIWIBIWC', charge: 2.6, fx: ['rocks', 'cracks', 'bolts', 'quake'], bolt: '#ffe14a', shake: 1.4, kanji: '超サイヤ人３' },
    { c1: '#ff2a1a', c2: '#ffb090', quote: '¡¡GRAAAAAAAHHH!!', frames: 'BIWIBC', charge: 2.2, fx: ['rocks', 'cracks', 'bolts', 'quake'], bolt: '#ff8a6a', shake: 1.3, kanji: '超サイヤ人４' },
    { c1: '#ff3a1a', c2: '#ffb070', quote: 'El poder de un dios...', frames: 'CWC', charge: 2.0, fx: ['flame'], shake: 0.15, kanji: '超サイヤ人ゴッド' },
    { c1: '#2ec8ff', c2: '#c8f4ff', quote: 'Ki divino... ¡a otro nivel!', frames: 'WCIC', charge: 1.7, fx: ['ripple', 'sparks'], shake: 0.6, kanji: '超サイヤ人ブルー' },
    { c1: '#ff2a3a', c2: '#6fd8ff', quote: '¡¡KAIO-KEN... POR DIEZ!!', frames: 'CWBIC', charge: 2.0, fx: ['pulse', 'ripple', 'bolts'], bolt: '#ff8a8a', shake: 1.1, kanji: '界王拳ブルー' },
    { c1: '#b8c8ff', c2: '#eef2ff', quote: 'Mi cuerpo... se mueve solo.', frames: 'IWIC', charge: 2.0, fx: ['silence', 'stars'], shake: 0.3, kanji: '身勝手の極意・兆' },
    { c1: '#dfe8ff', c2: '#9fb4ff', quote: '...', frames: 'IBWBI', charge: 2.4, fx: ['silence', 'stars', 'ripple'], shake: 0, kanji: '身勝手の極意' }
  ],
  vegeta: [
    null,
    { c1: '#ffd400', c2: '#fff4a0', quote: '¡¡KAKAROTTO!!', frames: 'IWBIC', charge: 1.9, fx: ['rocks', 'cracks', 'bolts', 'quake'], bolt: '#fff27a', shake: 1.2, kanji: '超サイヤ人' },
    { c1: '#ffe14a', c2: '#bfe8ff', quote: '¡SOY EL PRÍNCIPE DE LOS SAIYAJIN!', frames: 'IWIBIC', charge: 2.0, fx: ['bolts', 'sparks', 'rocks'], bolt: '#9fe0ff', shake: 1.2, kanji: '超サイヤ人２' },
    { c1: '#ff3a2a', c2: '#ffb090', quote: 'Ahora tengo el poder de un dios.', frames: 'CWC', charge: 1.9, fx: ['flame'], shake: 0.2, kanji: '超サイヤ人ゴッド' },
    { c1: '#2ec8ff', c2: '#c8f4ff', quote: 'Ki divino... bajo mi control.', frames: 'WCIC', charge: 1.7, fx: ['ripple', 'sparks'], shake: 0.6, kanji: '超サイヤ人ブルー' },
    { c1: '#2a6aff', c2: '#a8c8ff', quote: '¡He superado mis límites!', frames: 'BIWIBC', charge: 2.2, fx: ['bolts', 'shatter', 'sparks', 'quake'], bolt: '#8ab8ff', shake: 1.3, kanji: '進化' },
    { c1: '#a03aff', c2: '#e0b8ff', quote: '¡NO TENGO LÍMITES!', frames: 'BIBWBIC', charge: 2.4, fx: ['silence', 'shatter', 'bolts'], bolt: '#d08aff', shake: 1.3, kanji: '我儘の極意' }
  ],
  piccolo: [
    null,
    { c1: '#7aff6a', c2: '#e0ffd0', quote: '¡Nail, presta tu fuerza!', frames: 'WIC', charge: 1.6, fx: ['bolts', 'ripple'], bolt: '#c8ff9a', shake: 0.7, kanji: 'ナメック' },
    { c1: '#d8ff7a', c2: '#ffffff', quote: 'Kami y yo volvemos a ser uno.', frames: 'IWBIC', charge: 2.0, fx: ['stars', 'ripple', 'bolts'], bolt: '#ffffff', shake: 0.9, kanji: '神' },
    { c1: '#ff8a2a', c2: '#ffd8a0', quote: '¡¡GRAAAAAAHHH!!', frames: 'BIWIBC', charge: 2.3, fx: ['rocks', 'cracks', 'quake', 'shatter'], shake: 1.4, kanji: 'オレンジ' }
  ],
  gohan: [
    null,
    { c1: '#ffd400', c2: '#fff6a0', quote: '¡No os lo perdonaré!', frames: 'WIBIC', charge: 1.8, fx: ['rocks', 'bolts', 'cracks'], bolt: '#fff27a', shake: 1.0, kanji: '超サイヤ人' },
    { c1: '#ffe14a', c2: '#bfe8ff', quote: '¡¡BASTA YA!!', frames: 'IWIBIC', charge: 2.0, fx: ['bolts', 'sparks', 'rocks', 'quake'], bolt: '#9fe0ff', shake: 1.3, kanji: '超サイヤ人２' },
    { c1: '#ffffff', c2: '#c8d8ff', quote: 'Todo mi potencial... despierta.', frames: 'WCIC', charge: 1.9, fx: ['ripple', 'stars'], shake: 0.5, kanji: '究極' },
    { c1: '#b07aff', c2: '#f0e0ff', quote: '¡¡AAAAAAAHHHHHH!!', frames: 'BIWBIWBC', charge: 2.6, fx: ['bolts', 'cracks', 'rocks', 'quake', 'shatter'], bolt: '#e0b0ff', shake: 1.5, kanji: '獣' }
  ],
  freezer: [
    null,
    { c1: '#c87aff', c2: '#f0d8ff', quote: 'Te enseñaré la desesperación.', frames: 'WIC', charge: 1.5, fx: ['rocks', 'bolts'], bolt: '#e0b0ff', shake: 0.9, kanji: '第二形態' },
    { c1: '#a06aff', c2: '#e8d8ff', quote: 'Mi tercera forma... contemplad el terror.', frames: 'IWBIC', charge: 1.8, fx: ['rocks', 'cracks', 'quake'], shake: 1.1, kanji: '第三形態' },
    { c1: '#ff6ad8', c2: '#ffd0f0', quote: 'Esta es mi forma final.', frames: 'BIWIC', charge: 2.0, fx: ['shatter', 'sparks', 'ripple'], bolt: '#ff9ae0', shake: 1.0, kanji: '最終形態' },
    { c1: '#ff6ad8', c2: '#ffd0f0', quote: 'Ahora verás el 100% de mi poder.', frames: 'IWC', charge: 1.7, fx: ['bolts', 'sparks'], bolt: '#ff9ae0', shake: 0.9, kanji: '百パーセント' },
    { c1: '#ffd400', c2: '#fff6c0', quote: 'Contempla mi forma dorada.', frames: 'WIBIC', charge: 2.0, fx: ['stars', 'ripple', 'bolts'], bolt: '#fff27a', shake: 0.8, kanji: 'ゴールデン' },
    { c1: '#6a4aff', c2: '#c8b8ff', quote: '...Inclinaos ante el emperador.', frames: 'BIBWBIC', charge: 2.4, fx: ['silence', 'shatter', 'bolts'], bolt: '#a080ff', shake: 1.1, kanji: '黒' }
  ],
  krilin: [
    null,
    { c1: '#ffe86a', c2: '#fff8d0', quote: '¡Gracias, Gran Patriarca!', frames: 'WIC', charge: 1.5, fx: ['stars', 'bolts'], bolt: '#fff4a0', shake: 0.6, kanji: '潜在能力' },
    { c1: '#ffb040', c2: '#ffe0a0', quote: '¡Yo también soy un guerrero Z!', frames: 'IWBIC', charge: 1.8, fx: ['rocks', 'bolts', 'cracks'], bolt: '#ffd070', shake: 1.0, kanji: '戦士' },
    { c1: '#ffffff', c2: '#ffe8b0', quote: '¡¡EL HUMANO MÁS FUERTE DE LA TIERRA!!', frames: 'BIWIBC', charge: 2.2, fx: ['rocks', 'cracks', 'quake', 'bolts'], bolt: '#ffffff', shake: 1.3, kanji: '最強の地球人' }
  ],
  trunks: [
    null,
    { c1: '#ffd400', c2: '#fff6a0', quote: '¡Por el futuro!', frames: 'WIBIC', charge: 1.8, fx: ['rocks', 'bolts', 'cracks'], bolt: '#fff27a', shake: 1.0, kanji: '超サイヤ人' },
    { c1: '#ffc400', c2: '#ffe8a0', quote: '¡¡HAAAAAAAA!!', frames: 'IWBIBC', charge: 2.1, fx: ['rocks', 'cracks', 'quake'], shake: 1.4, kanji: '超トランクス' },
    { c1: '#9fe0ff', c2: '#ffffff', quote: '¡No os perdonaré jamás!', frames: 'BIWBIC', charge: 2.2, fx: ['bolts', 'slash', 'sparks', 'shatter'], bolt: '#bfeaff', shake: 1.3, kanji: '怒り' }
  ],
  cell: [
    null,
    { c1: '#6aff8a', c2: '#e0ffe8', quote: 'Ahora verás mi verdadero poder.', frames: 'WIC', charge: 1.6, fx: ['bolts', 'sparks'], bolt: '#b0ffc0', shake: 0.8, kanji: '完全体' },
    { c1: '#6fd8ff', c2: '#e8fbff', quote: 'He vuelto... más perfecto que nunca.', frames: 'IWBIC', charge: 2.0, fx: ['bolts', 'ripple', 'rocks'], bolt: '#bfeeff', shake: 1.1, kanji: '超完全体' },
    { c1: '#ffd84a', c2: '#fff4c0', quote: '¡¡SOY EL GUERRERO PERFECTO!!', frames: 'BIWIBC', charge: 2.3, fx: ['rocks', 'cracks', 'bolts', 'quake'], bolt: '#fff27a', shake: 1.4, kanji: '究極' }
  ],
  black: [
    null,
    { c1: '#ffd84a', c2: '#3a1a4a', quote: 'Contempla la belleza de un dios.', frames: 'IBC', charge: 1.6, fx: ['bolts', 'stars'], bolt: '#ffe890', shake: 0.6, kanji: '超サイヤ人' },
    { c1: '#ff6ac0', c2: '#ffd0ec', quote: 'Super Saiyan Rosé.', frames: 'CWIC', charge: 2.0, fx: ['petals', 'ripple'], shake: 0.4, kanji: 'ロゼ' },
    { c1: '#ff2a9a', c2: '#ffb0dc', quote: '¡YO SOY LA JUSTICIA!', frames: 'BIWBIC', charge: 2.1, fx: ['slash', 'petals', 'bolts'], bolt: '#ff8ad0', shake: 1.2, kanji: '正義' }
  ]
};
const IMPACT_FRAME = 0.07;      // duración de cada fotograma de impacto (s)
const BANNER_TIME = 1.25;       // tiempo del cartel con el nombre tras el impacto

const hexCss = (n) => '#' + n.toString(16).padStart(6, '0');
const cssRgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; };

class TransformScene {
  constructor(game) {
    this.g = game; this.on = false; this.t = 0;
    this.cv = document.getElementById('cine');
    this.ctx = this.cv.getContext ? this.cv.getContext('2d') : null;
    this.banner = document.getElementById('tfBanner');
    this.v = new THREE.Vector3();
    this.bolts = []; this.cracks = []; this.petals = []; this.stars = [];
  }

  /** Arranca la cinemática hacia la forma idx (la forma cambia en el primer impacto) */
  start(idx) {
    const g = this.g, p = g.player, list = TRANSFORM_FX[p.ch.id] || [];
    const f = p.ch.forms[idx];
    this.cfg = list[idx] || { c1: hexCss(f.aura || 0xffe14a), c2: '#ffffff', quote: '¡¡HAAAA!!', frames: 'WIC', charge: 1.6, fx: ['bolts'], bolt: '#ffffff', shake: 0.8, kanji: '' };
    this.to = idx; this.form = f; this.t = 0; this.swapped = false; this.on = true; this.lastImp = -1; this.ringT = 0;
    this.end = this.cfg.charge + this.cfg.frames.length * IMPACT_FRAME + BANNER_TIME;
    this.cam0 = { dist: g.camDistT, pitch: g.camPitch };
    g.camDistT = 7.5; g.camPitch = 0.28;
    this.bolts.length = 0; this.cracks.length = 0; this.petals.length = 0; this.fiss = false; this.gT = 0;
    this.stars = [];
    for (let i = 0; i < 60; i++) this.stars.push({ x: Math.random(), y: Math.random(), p: Math.random() * 6 });
    for (let i = 0; i < 40; i++) this.petals.push({ a: Math.random() * 6.28, r: 40 + Math.random() * 160, s: 0.6 + Math.random() * 1.6, y: Math.random() });
    p.vx = 0; p.vz = 0; p.charging = false; p.dashT = 0; p.cineChg = true;          // durante la cinemática se ve la pose de cargar ki
    this.resize();
    this.cv.style.display = 'block';
    this.banner.className = ''; this.banner.innerHTML = '';
    g.ui.el.hud.classList.add('cine');
    // Sonido: grito sintetizado + carga, música atenuada
    SFX.setDuck(0.3);
    SFX.scream(this.cfg.charge, { goku: 175, vegeta: 160, black: 150, piccolo: 120, gohan: 200, freezer: 230, krilin: 210, trunks: 185 }[p.ch.id] || 170);
    SFX.play('charge');
  }

  resize() { this.cv.width = window.innerWidth; this.cv.height = window.innerHeight; }

  /** Avanza la escena. Devuelve true cuando termina */
  update(dt) {
    const g = this.g, p = g.player, c = this.cfg, fx = c.fx, t0 = this.t;
    this.t += dt;
    const t = this.t, ch = c.charge, impEnd = ch + c.frames.length * IMPACT_FRAME;
    const k = clamp(t / ch, 0, 1);                       // progreso de la carga (0..1)

    // ---- Carga: aura creciente, rocas, chispas, anillos y temblor ----
    if (t < ch) {
      const col1 = parseInt(c.c1.slice(1), 16), col2 = parseInt(c.c2.slice(1), 16);
      const n = Math.round(dt * (60 + 260 * k));
      for (let i = 0; i < n; i++) {
        const a = rand(0, 6.28), r = rand(0.6, 1.4 + k);
        g.fx.aura.emit(p.x + Math.cos(a) * r, rand(0, 0.6), p.z + Math.sin(a) * r, 0, rand(4, 9 + k * 6), 0, rand(0.4, 0.8), rand(0.15, 0.4 + k * 0.2), 0, Math.random() < 0.7 ? col1 : col2);
      }
      if (fx.includes('rocks') && Math.random() < dt * (10 + k * 30)) {
        const a = rand(0, 6.28), r = rand(2, 7);
        g.fx.gore.emit(p.x + Math.cos(a) * r, 0.2, p.z + Math.sin(a) * r, 0, rand(2, 5), 0, rand(1, 1.8), rand(0.25, 0.5), -1, 0x8a6a4a);
      }
      if (fx.includes('flame')) for (let i = 0; i < 3; i++) g.fx.sparks.emit(p.x + rand(-0.7, 0.7), rand(0, 1), p.z + rand(-0.7, 0.7), rand(-0.5, 0.5), rand(6, 12), rand(-0.5, 0.5), rand(0.4, 0.8), rand(0.2, 0.45), 0, Math.random() < 0.5 ? 0xff4a1a : 0xffb040);
      if (fx.includes('sparks') && Math.random() < dt * 25) g.fx.burst(g.fx.sparks, p.x + rand(-1, 1), rand(0.5, 2.5), p.z + rand(-1, 1), 4, 9, 0.2, 0.25, 0, parseInt((c.bolt || c.c2).slice(1), 16));
      const V = g.vfx;
      if (V && V.ok) {
        this.gT = (this.gT || 0) - dt;
        if (this.gT <= 0) {                                           // anillos de ki en el suelo y energía que se concentra
          this.gT = 0.32 - k * 0.15;
          V.play('auraGen', p.x, 0.25, p.z, { flat: true, size: 3 + k * 4, grow: 2.2, dur: 0.45, frames: FXA.auraGen.f.slice(0, 6), pri: 1 });
          if (k > 0.4) V.play('lightA', p.x + rand(-1.5, 1.5), rand(0.8, 2.6), p.z + rand(-1.5, 1.5), { size: 2.6, fps: 30, pri: 1 });
        }
        if (k > 0.25 && !this.fiss) { this.fiss = true; V.crater(p.x, p.z, 4, parseInt(c.c1.slice(1), 16)); }
        // El aura de la forma nueva va apareciendo durante la carga, con sus rayitos
        const F = formFx(p.ch, this.to);
        if (F && k > 0.3) {
          const nm = F.a || 'auraSS1', own = nm === 'auraSS2' || nm === 'auraSS3';
          V.aura(nm, p.x, p.z, 4 + k * 3.5, own ? 0xffffff : (this.form.aura || col1), 0.25 + k * 0.6, t);
          if (F.bolt && Math.random() < dt * 14) V.now(0, fxf('bolt', (t * 30) | 0), p.x + rand(-0.8, 0.8), rand(0.8, 2.6), p.z, 2, 1, F.bolt, rand(0, 6.28));
        }
        if (Math.random() < dt * (1.5 + k * 3)) { const a = rand(0, 6.28), r = rand(3.5, 6); V.dust(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, rand(1.4, 2.4)); }
      }
      this.ringT -= dt;
      if (this.ringT <= 0) { this.ringT = fx.includes('pulse') ? 0.22 : 0.45 - k * 0.2; g.fx.ring(g.fx.aura, p.x, 0.3, p.z, 30, 8 + k * 10, 0.4, 0.3, col1); }
      g.shake(c.shake * (0.15 + k * 0.85));
      if (fx.includes('quake') && Math.random() < dt * 4) g.shake(c.shake * 1.3);
      g.horde.shockwave(p.x, p.z, 10, 6 * dt * 60);    // la presión del ki aparta a los enemigos
    }

    // ---- Impactos: el primer fotograma cambia la forma ----
    if (t >= ch && t < impEnd) {
      const i = Math.floor((t - ch) / IMPACT_FRAME);
      if (i !== this.lastImp) {
        this.lastImp = i;
        if (!this.swapped) this.swap();
        g.shake(1.4);
      }
    }
    if (t >= impEnd && !this.bannerOn) this.showBanner();
    this.animBanner(t, impEnd);

    this.draw(k, t, ch, impEnd);
    if (t >= this.end) { this.finish(); return true; }
    return false;
  }

  /** Cambio real de forma: onda expansiva, daño y curación */
  swap() {
    const g = this.g, p = g.player, col = parseInt(this.cfg.c1.slice(1), 16);
    this.swapped = true;
    SFX.play('impact');
    const first = !p.formSeen[this.to];
    p.setForm(this.to); p.recompute(); g.applyForm();
    p.formSeen[this.to] = true; p.tfCd = 0;
    if (first) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.3);     // la curación solo la primera vez que alcanzas esa forma
    g.fx.ring(g.fx.aura, p.x, 0.4, p.z, 80, 30, 0.9, 0.5, col);
    const V = g.vfx;
    if (V && V.ok) {                                                 // estallido: columna de energía, cúpula de ki, rayos y cráter
      V.play('flare', p.x, 5.5, p.z, { size: 11, dur: 1.4, fps: 8, alpha: 0.85, pri: 1 });
      const F = formFx(p.ch, this.to);
      if (F && F.burst) {                                              // estallido propio de la forma (sprites de las hojas nuevas)
        V.play(F.burst, p.x, 2.6, p.z, { size: 9, grow: 1.9, dur: 0.75, alpha: 0.95, pri: 1 });
        V.play(F.burst, p.x, 2.2, p.z, { size: 5, grow: 3, dur: 0.9, alpha: 0.6, rot: 0.6, spin: 1.5, pri: 1 });
      }
      V.play('dome', p.x, 2.4, p.z, { size: 5, grow: 2.4, dur: 0.7, alpha: 0.75, pri: 1 });
      V.flash(p.x, 2, p.z, 7, col, { pri: 1 });
      for (let i = 0; i < 6; i++) { const a = i * 1.047; V.bolt(p.x + Math.cos(a) * 7, p.z + Math.sin(a) * 7, 14, 0xffffff); }
      V.crater(p.x, p.z, 4, col); V.dust(p.x - 4, p.z, 3); V.dust(p.x + 4, p.z, 3);
    }
    g.fx.burst(g.fx.sparks, p.x, 1.4, p.z, 70, 18, 0.9, 0.5, 2, col);
    g.horde.shockwave(p.x, p.z, 22, 40);
    DMG_SRC = 'transform';
    g.horde.damageRadius(p.x, p.z, 14, 60 * p.damageMul(), 20, g);
    DMG_SRC = 'otros';
    g.world.damageArea(p.x, p.z, 10, 999);
    g.track('transforms', 1);
  }

  showBanner() {
    this.bannerOn = true;
    SFX.play('stinger');
    const f = this.form, c = this.cfg;
    this.banner.style.setProperty('--c1', c.c1); this.banner.style.setProperty('--c2', c.c2);
    const T = traitOf(this.g.player.ch, this.to);
    this.banner.innerHTML = '<small>' + (c.kanji || '') + '</small><b>' + f.name + '</b><i>' + c.quote + '</i>' +
      (T ? '<em class="trt"><u>' + T.name + '</u><span class="trg">✚ ' + T.good + '</span><span class="trb">✖ ' + T.bad + '</span></em>' : '');
  }
  /** Animación del cartel ligada al tiempo de la escena (va bien aunque el ordenador sea lento) */
  animBanner(t, impEnd) {
    if (!this.bannerOn) return;
    const f = clamp((t - impEnd) / BANNER_TIME, 0, 1);
    let sc = 1, op = 1, y = 0;
    if (f < 0.12) { const q = f / 0.12; sc = 2.6 - 1.66 * q; op = q; }
    else if (f < 0.2) sc = 0.94 + 0.06 * (f - 0.12) / 0.08;
    else if (f > 0.8) { const q = (f - 0.8) / 0.2; sc = 1 + 0.06 * q; op = 1 - q; y = -20 * q; }
    this.banner.style.opacity = op.toFixed(3);
    this.banner.style.transform = 'translateY(' + y.toFixed(1) + 'px) scale(' + sc.toFixed(3) + ') skewX(-10deg)';
  }

  finish() {
    const g = this.g, p = g.player;
    this.on = false; this.bannerOn = false;
    this.cv.style.display = 'none';
    g.renderer.domElement.style.filter = '';
    this.banner.style.opacity = 0;
    g.ui.el.hud.classList.remove('cine');
    g.camDistT = this.cam0.dist; g.camPitch = this.cam0.pitch;
    p.charging = false; p.iframes = 1.2; p.cineChg = false;
    SFX.setDuck(1);
  }

  /** Posición del jugador en pantalla */
  screenPos() {
    const g = this.g, p = g.player, v = this.v;
    v.set(p.x, 1.3, p.z).project(g.camera);
    return [(v.x + 1) / 2 * this.cv.width, (1 - v.y) / 2 * this.cv.height];
  }

  /* ---------- Dibujo de la capa cinemática ---------- */
  draw(k, t, ch, impEnd) {
    const x = this.ctx, c = this.cfg, fx = c.fx, W = this.cv.width, H = this.cv.height, S = Math.min(W, H);
    if (!x) return;
    const [px, py] = this.screenPos();
    const canvas = this.g.renderer.domElement;
    x.clearRect(0, 0, W, H);
    canvas.style.filter = '';

    const imp = t >= ch && t < impEnd ? c.frames[Math.floor((t - ch) / IMPACT_FRAME)] : null;
    if (imp) { this.drawImpact(imp, px, py, W, H, S, canvas); this.letterbox(W, H, 1); return; }

    const intro = clamp(t / 0.35, 0, 1), after = t >= impEnd ? clamp((t - impEnd) / BANNER_TIME, 0, 1) : 0;
    const out = t >= impEnd ? clamp((this.end - t) / 0.35, 0, 1) : 1;
    // Oscurecido del mundo (en Ultra Instinto, además, el mundo se queda sin color)
    if (fx.includes('silence') && t < impEnd) canvas.style.filter = 'grayscale(' + (0.3 + k * 0.7).toFixed(2) + ') brightness(' + (1 - k * 0.35).toFixed(2) + ')';
    x.fillStyle = 'rgba(0,0,0,' + (0.42 * intro * (1 - after * 0.8)) + ')';
    x.fillRect(0, 0, W, H);
    // Resplandor alrededor del personaje
    const glow = x.createRadialGradient(px, py, 0, px, py, S * (0.18 + k * 0.25));
    glow.addColorStop(0, cssRgba(c.c2, 0.55 * k * out)); glow.addColorStop(0.4, cssRgba(c.c1, 0.35 * k * out)); glow.addColorStop(1, cssRgba(c.c1, 0));
    x.fillStyle = glow; x.fillRect(0, 0, W, H);

    if (t < impEnd) {
      this.speedLines(px, py, W, H, S, 'rgba(255,255,255,' + (0.08 + k * 0.3) + ')', 40 + k * 60, 0.55 - k * 0.2);
      if (fx.includes('cracks')) this.drawCracks(px, py, S, k);
      if (fx.includes('bolts')) this.drawBolts(px, py, S, k, c.bolt || '#ffffff');
      if (fx.includes('ripple')) this.drawRipple(px, py, S, t, c.c1);
      if (fx.includes('stars')) this.drawStars(W, H, t, k);
      if (fx.includes('petals')) this.drawPetals(px, py, S, t, k);
      if (fx.includes('slash') && k > 0.4) this.drawSlash(W, H, t, c.c1);
      if (fx.includes('shatter') && k > 0.55) this.drawShatter(px, py, S, k);
      if (fx.includes('pulse') && Math.sin(t * 28) > 0.6) { x.fillStyle = cssRgba(c.c1, 0.18); x.fillRect(0, 0, W, H); }
      this.subtitle(c.quote, W, H, S, k);
    } else {
      // Tras el impacto: estallido de líneas de velocidad de color que se desvanece
      this.speedLines(px, py, W, H, S, cssRgba(c.c1, 0.5 * (1 - after)), 90, 0.25);
    }
    this.letterbox(W, H, Math.min(intro, out));
  }

  /** Bandas negras de cine arriba y abajo */
  letterbox(W, H, a) {
    const x = this.ctx, h = H * 0.11 * a;
    x.fillStyle = '#000'; x.fillRect(0, 0, W, h); x.fillRect(0, H - h, W, h);
  }

  /** Líneas de velocidad radiales (estilo manga) hacia el personaje */
  speedLines(px, py, W, H, S, color, n, inner) {
    const x = this.ctx, R = Math.hypot(W, H);
    x.fillStyle = color;
    x.beginPath();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.2832, w = 0.004 + Math.random() * 0.012, r0 = S * (inner + Math.random() * 0.25);
      x.moveTo(px + Math.cos(a) * r0, py + Math.sin(a) * r0);
      x.lineTo(px + Math.cos(a - w) * R, py + Math.sin(a - w) * R);
      x.lineTo(px + Math.cos(a + w) * R, py + Math.sin(a + w) * R);
      x.closePath();
    }
    x.fill();
  }

  /** Rayos en zigzag alrededor del aura (se regeneran a saltos) */
  drawBolts(px, py, S, k, color) {
    const x = this.ctx;
    if (Math.random() < 0.35 || !this.bolts.length) {
      this.bolts.length = 0;
      const n = 2 + Math.round(k * 5);
      for (let b = 0; b < n; b++) {
        const pts = [], a = rand(0, 6.28), r0 = S * rand(0.04, 0.09), len = S * rand(0.1, 0.22) * (0.5 + k);
        let cx = px + Math.cos(a) * r0, cy = py + Math.sin(a) * r0 - S * 0.05;
        pts.push([cx, cy]);
        for (let s = 0; s < 6; s++) { cx += Math.cos(a) * len / 6 + rand(-1, 1) * S * 0.025; cy += Math.sin(a) * len / 6 + rand(-1, 1) * S * 0.025; pts.push([cx, cy]); }
        this.bolts.push(pts);
      }
    }
    x.lineJoin = 'miter';
    for (const w of [[6, cssRgba(color, 0.35)], [2.5, color], [1, '#fff']]) {
      x.lineWidth = w[0]; x.strokeStyle = w[1];
      for (const pts of this.bolts) { x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (const q of pts) x.lineTo(q[0], q[1]); x.stroke(); }
    }
  }

  /** Grietas en el suelo que crecen desde los pies */
  drawCracks(px, py, S, k) {
    const x = this.ctx;
    if (!this.cracks.length) for (let i = 0; i < 9; i++) {
      const a = Math.PI * (0.05 + 0.9 * (i / 8)) + rand(-0.1, 0.1), pts = [[0, 0]];
      let cx = 0, cy = 0;
      for (let s = 0; s < 7; s++) { cx += Math.cos(a) * 0.06 + rand(-0.02, 0.02); cy += Math.sin(a) * 0.025 + rand(-0.01, 0.01); pts.push([cx, cy]); }
      this.cracks.push(pts);
    }
    const n = Math.max(1, Math.floor(k * 7)), oy = py + S * 0.07;
    x.strokeStyle = 'rgba(20,10,5,.85)'; x.lineWidth = 3;
    for (const pts of this.cracks) {
      x.beginPath(); x.moveTo(px, oy);
      for (let s = 1; s <= n; s++) x.lineTo(px + pts[s][0] * S, oy + pts[s][1] * S);
      x.stroke();
    }
    x.strokeStyle = cssRgba(this.cfg.c1, 0.8); x.lineWidth = 1;
    for (const pts of this.cracks) { x.beginPath(); x.moveTo(px, oy); for (let s = 1; s <= n; s++) x.lineTo(px + pts[s][0] * S, oy + pts[s][1] * S); x.stroke(); }
  }

  /** Ondas concéntricas (ki divino) */
  drawRipple(px, py, S, t, col) {
    const x = this.ctx;
    for (let i = 0; i < 4; i++) {
      const f = ((t * 0.9 + i / 4) % 1), r = S * (0.05 + f * 0.6);
      x.strokeStyle = cssRgba(col, 0.6 * (1 - f)); x.lineWidth = 3 * (1 - f) + 1;
      x.beginPath(); x.ellipse(px, py + S * 0.07, r, r * 0.35, 0, 0, 6.2832); x.stroke();
    }
  }

  /** Destellos tipo estrella (Ultra Instinto, Goku Black) */
  drawStars(W, H, t, k) {
    const x = this.ctx;
    for (const s of this.stars) {
      const a = Math.max(0, Math.sin(t * 3 + s.p)) * k;
      if (a < 0.05) continue;
      const sx = s.x * W, sy = s.y * H, r = 2 + a * 6;
      x.fillStyle = 'rgba(255,255,255,' + a + ')';
      x.beginPath(); x.moveTo(sx, sy - r * 2); x.lineTo(sx + r * 0.4, sy); x.lineTo(sx, sy + r * 2); x.lineTo(sx - r * 0.4, sy); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(sx - r * 2, sy); x.lineTo(sx, sy + r * 0.4); x.lineTo(sx + r * 2, sy); x.lineTo(sx, sy - r * 0.4); x.closePath(); x.fill();
    }
  }

  /** Destellos rosas girando en espiral (Rosé) */
  drawPetals(px, py, S, t, k) {
    const x = this.ctx;
    for (const p of this.petals) {
      const a = p.a + t * p.s * 2, r = (p.r / 400) * S * (1.2 - k * 0.6);
      const sx = px + Math.cos(a) * r, sy = py + Math.sin(a) * r * 0.5 - p.y * S * 0.2 * k;
      x.fillStyle = cssRgba(this.cfg.c2, 0.85);
      x.beginPath(); x.ellipse(sx, sy, 5, 2.5, a, 0, 6.2832); x.fill();
      x.fillStyle = cssRgba(this.cfg.c1, 0.9);
      x.beginPath(); x.ellipse(sx, sy, 2.5, 1.2, a, 0, 6.2832); x.fill();
    }
  }

  /** Cortes diagonales de guadaña */
  drawSlash(W, H, t, col) {
    const x = this.ctx;
    if (Math.sin(t * 9) < 0.3) return;
    const y = (Math.sin(t * 5.3) * 0.5 + 0.5) * H;
    x.strokeStyle = '#fff'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(0, y + H * 0.3); x.lineTo(W, y - H * 0.3); x.stroke();
    x.strokeStyle = cssRgba(col, 0.6); x.lineWidth = 12;
    x.beginPath(); x.moveTo(0, y + H * 0.3); x.lineTo(W, y - H * 0.3); x.stroke();
  }

  /** La pantalla se resquebraja (Límite Roto) */
  drawShatter(px, py, S, k) {
    const x = this.ctx, n = Math.floor((k - 0.55) * 30);
    x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 1.5;
    const r = seeded(7);
    for (let i = 0; i < n; i++) {
      const a = r() * 6.28, l = S * (0.2 + r() * 0.6);
      x.beginPath(); x.moveTo(px, py);
      x.lineTo(px + Math.cos(a) * l * 0.5 + (r() - 0.5) * 30, py + Math.sin(a) * l * 0.5 + (r() - 0.5) * 30);
      x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
      x.stroke();
    }
  }

  /** Grito tipo subtítulo de anime, con letras que aparecen poco a poco */
  subtitle(text, W, H, S, k) {
    const x = this.ctx, n = Math.ceil(text.length * clamp(k * 1.6, 0, 1));
    if (!n) return;
    const s = text.slice(0, n), size = Math.round(Math.max(18, S * 0.045));
    x.font = size + 'px "Dela Gothic One", Impact, sans-serif';
    x.textAlign = 'center'; x.lineJoin = 'round';
    const jx = (Math.random() - 0.5) * 4 * k, jy = (Math.random() - 0.5) * 4 * k, y = H * 0.84;
    x.lineWidth = size * 0.22; x.strokeStyle = '#000'; x.strokeText(s, W / 2 + jx, y + jy);
    x.fillStyle = '#fff'; x.fillText(s, W / 2 + jx, y + jy);
  }

  /** Fotogramas de impacto: alto contraste, negativo, silueta y color */
  drawImpact(type, px, py, W, H, S, canvas) {
    const x = this.ctx, c = this.cfg;
    if (Save.d.opt.flash) {                               // modo «reducir destellos»: velo suave de color y líneas
      x.fillStyle = cssRgba(c.c1, 0.22); x.fillRect(0, 0, W, H);
      this.speedLines(px, py, W, H, S, cssRgba(c.c2, 0.5), 50, 0.12);
      return;
    }
    if (type === 'I') {                                   // negativo en blanco y negro
      canvas.style.filter = 'grayscale(1) contrast(9) invert(1)';
      this.speedLines(px, py, W, H, S, 'rgba(0,0,0,.85)', 70, 0.12);
    } else if (type === 'W') {                            // blanco con líneas negras
      x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
      this.speedLines(px, py, W, H, S, '#000', 90, 0.1);
      x.fillStyle = '#000'; x.beginPath(); x.arc(px, py, S * 0.06, 0, 6.2832); x.fill();
    } else if (type === 'B') {                            // negro con estallido blanco
      x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
      this.speedLines(px, py, W, H, S, '#fff', 80, 0.06);
      x.strokeStyle = '#fff'; x.lineWidth = 6; x.beginPath(); x.arc(px, py, S * 0.12, 0, 6.2832); x.stroke();
    } else {                                              // color de la forma
      canvas.style.filter = 'contrast(2.5) saturate(2.5) brightness(1.3)';
      x.fillStyle = cssRgba(c.c1, 0.6); x.fillRect(0, 0, W, H);
      this.speedLines(px, py, W, H, S, cssRgba(c.c2, 0.95), 80, 0.08);
    }
  }
}
