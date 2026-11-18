'use strict';
/* =====================================================================
   entryfx.js · Animación de entrada de cada guerrero en las pantallas de
   selección («Elige guerrero» y Versus). Hojas 4×4 de 400×225 sobre fondo
   negro en assets/entry/<id>.webp (tools/make_entries.py):
     0-3   llega volando con estela
     4-8   carga el aura
     9-10  destello (impacto)
     11-15 el aura se apaga; el 15 se queda como pose
   Se reproduce una vez al elegir al guerrero. Si la pantalla se vuelve a
   dibujar con el mismo guerrero (cambiar dificultad, pestañas...), sigue
   por donde iba o se queda en la pose: nunca empieza de nuevo.
   ===================================================================== */
const ENTRY_IDS = new Set(['andro16', 'andro18', 'babyv', 'bardock', 'bills', 'black', 'broly', 'caulifla', 'cell', 'cooler', 'dabura', 'freezer', 'ginyu', 'gogeta', 'gohan', 'gohanf', 'gohankid', 'goku', 'gotenks', 'gotenss5', 'hitto', 'janemba', 'jiren', 'kale', 'kamba', 'kefla', 'krilin', 'kyabe', 'majin', 'piccolo', 'raditz', 'saibaman', 'superbuu', 'trunks', 'turles', 'vegeta', 'vegito', 'yamcha', 'zamasuf']);
// Duración de cada fotograma (s): entrada rápida, carga, destello corto y cierre más lento
const ENTRY_FT = [0.06, 0.06, 0.06, 0.08, 0.09, 0.09, 0.09, 0.09, 0.1, 0.07, 0.07, 0.09, 0.09, 0.1, 0.12];
const ENTRY_POSE = 15, ENTRY_W = 400, ENTRY_H = 225;

const EntryFx = {
  img: {}, seen: {}, k: {}, acc: {}, last: {},

  has(id) { return ENTRY_IDS.has(id); },
  load(id) {
    let im = this.img[id];
    if (!im) { im = this.img[id] = new Image(); im.decoding = 'async'; im.src = av('assets/entry/' + id + '.webp'); }
    return im;
  },

  /**
   * Reproduce la entrada de «id» en el canvas.
   * key: hueco de la pantalla ('menu', 'vs0', 'vs1'); cada hueco recuerda qué guerrero muestra y cuándo empezó.
   */
  play(cv, id, key) {
    const im = this.load(id);           // se anima siempre (con «reducir animaciones» del móvil se quedaba en la pose)
    if (this.seen[key] !== id) { this.seen[key] = id; this.k[key] = 0; this.acc[key] = 0; this.last[key] = 0; }   // guerrero nuevo: desde el principio
    const g = cv.getContext('2d');
    const draw = (k) => {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
      const sh = k === 9 || k === 10 ? (Math.random() - 0.5) * cv.width * 0.02 : 0;      // temblor en el destello
      g.drawImage(im, (k % 4) * ENTRY_W, ((k / 4) | 0) * ENTRY_H, ENTRY_W, ENTRY_H, sh, sh * 0.6, cv.width, cv.height);
    };
    // Avanza como mucho un fotograma por pintado: en un móvil lento la animación va algo más despacio,
    // pero se ven los 16 fotogramas (si se saltaran por tiempo, solo se vería la pose final)
    const step = (now) => {
      if (!cv.isConnected || this.seen[key] !== id) return;          // la pantalla ya cambió
      if (!im.complete) { requestAnimationFrame(step); return; }      // aún se está descargando
      if (!im.naturalWidth) return;                                  // no se pudo cargar: se queda el fondo
      let k = this.k[key];
      if (this.last[key]) this.acc[key] += Math.min(0.2, (now - this.last[key]) / 1000);
      this.last[key] = now;
      if (k < ENTRY_POSE && this.acc[key] >= ENTRY_FT[k]) { this.acc[key] -= ENTRY_FT[k]; this.acc[key] = Math.min(this.acc[key], ENTRY_FT[k + 1] || 0); k = ++this.k[key]; }
      draw(k);
      if (k < ENTRY_POSE) requestAnimationFrame(step);
    };
    this.last[key] = 0;
    requestAnimationFrame(step);
  }
};
