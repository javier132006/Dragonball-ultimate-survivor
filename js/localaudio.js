'use strict';
/* =====================================================================
   localaudio.js · Audio propio opcional (música y narrador)
   El juego no trae música ni voces de narrador con copyright: si el jugador pone sus propios
   archivos en assets/local/ (carpeta fuera de git, ver tools/audio_local.py), suenan:
   - la música, en lugar de la sintetizada de audio.js (SFX.music sigue funcionando igual)
   - el narrador del Versus (js/versus/narrador.js)
   El índice assets/local/local.json dice qué hay:
     { "musica": { "menu": "menu.ogg", "seleccion": "...", "victoria": "...", "torre": "...",
                   "combate": ["...", ...], "temas": { "gogetassj4": "...", ... } },
       "narrador": ["fight", "ko", "battle_great", ...] }
   Si no existe, no pasa nada: todo sigue con el sonido sintetizado.
   ===================================================================== */
const LocalAudio = {
  base: 'assets/local/',
  M: null,                      // índice cargado (null: aún no / no hay)
  el: null, url: '',            // <audio> de la música que suena
  vol: 0.5,                     // volumen de la música (lo pone SFX.applyVol)
  cache: {},                    // pista -> archivo elegido (para que una pista no cambie de canción al repetirse)
  buf: {}, pend: {},            // voces del narrador ya descargadas
  src: null, srcEnd: 0, srcPri: 0,

  /** Lee el índice una vez. Cuando llega, vuelve a poner la pista que tocaba (ahora con su archivo) */
  load() {
    if (this.loading || typeof fetch === 'undefined') return;
    this.loading = fetch(this.base + 'local.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((M) => {
      if (!M) return;
      this.M = M;
      if (typeof SFX !== 'undefined' && SFX.trackName !== undefined) SFX.music(SFX.trackName, SFX.trackOpt, true);
    }).catch(() => {});
  },

  /* ---------- Música ---------- */
  /** Archivo de música para una pista de SFX.music (o null: que suene la sintetizada).
   *  Pistas: menu · select (selección del Versus) · victory · vs (combate del Versus; opt.ids = luchadores, opt.torre) · battle/boss (partida) */
  pick(name, opt) {
    const M = this.M && this.M.musica; if (!M || !name) return null;
    const key = name + '|' + ((opt && opt.key) || '');
    if (key in this.cache) return this.cache[key];
    const any = (L) => (L && L.length ? L[(Math.random() * L.length) | 0] : null);
    let f = null;
    if (name === 'menu') f = M.menu;
    else if (name === 'select') f = M.seleccion || M.menu;
    else if (name === 'victory') f = M.victoria;
    else if (name === 'vs') {
      const T = M.temas || {}, own = ((opt && opt.ids) || []).map((id) => T[id]).filter(Boolean);
      f = (opt && opt.torre && M.torre) || any(own) || any(M.combate);
    } else if (name === 'battle' || name === 'boss') f = any(M.combate);
    f = f || null;
    if (name !== 'vs' && name !== 'battle' && name !== 'boss') return f;   // las fijas no hace falta guardarlas
    for (const k in this.cache) if (k.split('|')[0] === name) delete this.cache[k];   // solo se recuerda la última de cada tipo
    return (this.cache[key] = f);
  },
  /** Pone (o quita, con null) la música de un archivo */
  play(file) {
    const url = file ? this.base + 'musica/' + file : '';
    if (url === this.url) { if (this.el && this.el.paused && url) this.el.play().catch(() => {}); return; }
    this.url = url;
    if (this.el) { this.el.pause(); this.el.removeAttribute('src'); this.el.load(); this.el = null; }
    if (!url || typeof Audio === 'undefined') return;
    const el = this.el = new Audio(url); el.loop = true; el.volume = this.vol;
    el.addEventListener('error', () => { if (this.el === el) { this.el = null; this.url = ''; if (typeof SFX !== 'undefined') SFX.localFailed(file); } });
    el.play().catch(() => {});                // sin un gesto del usuario el navegador no deja: suena al primer clic (SFX.init)
  },
  setVol(v) { this.vol = Math.max(0, Math.min(1, v)); if (this.el) this.el.volume = this.vol; },

  /* ---------- Narrador ---------- */
  has(n) { return !!(this.M && this.M.narrador && this.M.narrador.indexOf(n) >= 0); },
  /** Descarga todas las voces del narrador (al entrar en el Versus) */
  preload() { if (this.M && this.M.narrador) for (const n of this.M.narrador) this.get(n); },
  get(n) {
    if (n in this.buf || this.pend[n] || typeof SFX === 'undefined' || !SFX.ctx || !this.has(n)) return;
    const c = SFX.ctx;
    this.pend[n] = fetch(this.base + 'narrador/' + n + '.ogg').then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
      .then((b) => new Promise((res, rej) => c.decodeAudioData(b, res, rej))).then((B) => { this.buf[n] = B; }).catch(() => { this.buf[n] = null; });
  },
  /** Dice una frase. pri: prioridad (una frase no corta a otra que sigue sonando salvo que sea más importante) */
  say(n, pri) {
    pri = pri || 1;
    if (!this.has(n) || typeof SFX === 'undefined' || !SFX.ctx || !SFX.sfxG) return false;
    const B = this.buf[n]; if (!B) { this.get(n); return false; }
    const c = SFX.ctx, now = c.currentTime;
    if (now < this.srcEnd) { if (pri <= this.srcPri) return false; try { this.src.stop(); } catch (e) { /* ya parada */ } }
    try {
      const s = c.createBufferSource(), g = c.createGain(); s.buffer = B; g.gain.value = 1.25; s.connect(g); g.connect(SFX.sfxG); s.start();
      this.src = s; this.srcEnd = now + B.duration; this.srcPri = pri;
    } catch (e) { return false; }
    return true;
  }
};
LocalAudio.load();
