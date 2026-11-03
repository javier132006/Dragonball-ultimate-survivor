'use strict';
/* =====================================================================
   audio.js · Sonido 100% sintetizado con Web Audio (sin archivos y sin
   material con copyright). Efectos con osciladores + ruido filtrado y
   música procedimental con un secuenciador de 16 pasos.
   Uso: SFX.play('hit'), SFX.music('battle'), SFX.setVol(mus, sfx)
   ===================================================================== */

/* Tiempo mínimo entre dos sonidos iguales (evita saturar con cientos de impactos) */
const SFX_GAP = { hit: 0.045, ki: 0.06, xp: 0.05, zap: 0.07, crit: 0.12, boom: 0.08, hurt: 0.15, heal: 0.1, slash: 0.1, pulse: 0.1, coin: 0.06 };
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);         // número MIDI -> Hz

class SoundEngine {
  constructor() {
    this.ctx = null; this.last = {}; this.track = ''; this.step = 0; this.nextT = 0; this.timer = 0; this.duck = 1;
  }

  /** Se crea con el primer gesto del usuario (los navegadores lo exigen) */
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    const c = this.ctx;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 6;
    this.comp.connect(c.destination);
    this.sfxG = c.createGain(); this.sfxG.connect(this.comp);
    this.musG = c.createGain(); this.musG.connect(this.comp);
    // Ruido blanco reutilizable (1 s)
    this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.applyVol();
    if (this.track) { const t = this.track; this.track = ''; this.music(t); }
  }
  applyVol() {
    if (!this.ctx) return;
    const v = (typeof Save !== 'undefined' && Save.d.vol) || { mus: 0.5, sfx: 0.75 };
    this.sfxG.gain.value = v.sfx * 0.9;
    this.musG.gain.value = v.mus * 0.32 * this.duck;
  }
  setVol(mus, sfx) { Save.d.vol = { mus, sfx }; Save.write(); this.applyVol(); }
  /** Baja la música (cinemáticas) */
  setDuck(k) { this.duck = k; this.applyVol(); }
  ok() { return this.ctx && this.ctx.state === 'running'; }

  /* ---------- Bloques básicos ---------- */
  /** Oscilador con envolvente y barrido de frecuencia */
  tone(type, f0, f1, t, dur, vol, out, attack) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const a = attack || 0.005;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out || this.sfxG);
    o.start(t); o.stop(t + dur + 0.02);
    return o;
  }
  /** Ruido filtrado (golpes, explosiones, viento) */
  hiss(type, f0, f1, q, t, dur, vol, out, attack) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.loop = true;
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const a = attack || 0.004;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out || this.sfxG);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  /* ---------- Efectos ---------- */
  play(name, arg) {
    if (!this.ok()) return;
    const t = this.ctx.currentTime, gap = SFX_GAP[name] || 0.02;
    if (t - (this.last[name] || 0) < gap) return;
    this.last[name] = t;
    const fn = this['s_' + name];
    if (fn) fn.call(this, t, arg);
  }
  s_ki(t) { this.tone('triangle', 900, 420, t, 0.09, 0.06); this.hiss('bandpass', 3000, 1200, 2, t, 0.06, 0.03); }
  s_zap(t) { this.tone('sawtooth', 1600, 500, t, 0.08, 0.035); this.tone('square', 2400, 900, t, 0.05, 0.02); }
  s_hit(t) { this.hiss('bandpass', 1400 + Math.random() * 600, 500, 1.4, t, 0.06, 0.09); this.tone('sine', 180, 90, t, 0.06, 0.06); }
  s_crit(t) { this.hiss('highpass', 3000, 1500, 0.8, t, 0.12, 0.12); this.tone('square', 1320, 1760, t, 0.12, 0.05); this.tone('sine', 120, 50, t, 0.18, 0.18); }
  s_boom(t) { this.hiss('lowpass', 1600, 120, 0.8, t, 0.45, 0.22); this.tone('sine', 110, 38, t, 0.4, 0.3); }
  s_bigboom(t) { this.hiss('lowpass', 2400, 60, 0.7, t, 1.4, 0.35, null, 0.01); this.tone('sine', 90, 28, t, 1.2, 0.45); this.tone('sawtooth', 60, 30, t, 0.9, 0.08); }
  s_beam(t) { const o = this.tone('sawtooth', 160, 320, t, 0.75, 0.07, null, 0.04); this.hiss('bandpass', 900, 2600, 3, t, 0.75, 0.09, null, 0.05); this.tone('sine', 640, 960, t, 0.6, 0.04); return o; }
  s_bigbeam(t) { this.tone('sawtooth', 90, 240, t, 1.1, 0.1, null, 0.06); this.tone('square', 180, 480, t, 1.0, 0.04, null, 0.06); this.hiss('bandpass', 600, 3200, 2, t, 1.1, 0.14, null, 0.08); }
  s_charge(t) { this.tone('sawtooth', 110, 660, t, 1.6, 0.05, null, 0.3); this.hiss('bandpass', 400, 4000, 4, t, 1.6, 0.08, null, 0.4); }
  s_slash(t) { this.hiss('bandpass', 5000, 900, 1.5, t, 0.18, 0.12); this.tone('sine', 900, 300, t, 0.14, 0.03); }
  s_pulse(t) { this.tone('sine', 220, 55, t, 0.35, 0.22); this.hiss('lowpass', 1400, 200, 1, t, 0.3, 0.1); }
  s_dash(t) { this.hiss('bandpass', 600, 3200, 1.2, t, 0.2, 0.14, null, 0.02); this.tone('sine', 300, 900, t, 0.12, 0.04); }
  s_hurt(t) { this.tone('square', 220, 90, t, 0.18, 0.08); this.hiss('lowpass', 900, 200, 1, t, 0.15, 0.1); }
  s_xp(t) { this.tone('sine', 1200 + Math.random() * 300, 1900, t, 0.06, 0.035); }
  s_heal(t) { this.tone('sine', 660, 990, t, 0.18, 0.06); this.tone('sine', 990, 1320, t + 0.08, 0.2, 0.05); }
  s_coin(t) { this.tone('square', 988, 988, t, 0.07, 0.04); this.tone('square', 1319, 1319, t + 0.07, 0.16, 0.04); }
  s_click(t) { this.tone('square', 700, 500, t, 0.04, 0.035); }
  s_select(t) { this.tone('triangle', 660, 660, t, 0.08, 0.07); this.tone('triangle', 990, 990, t + 0.07, 0.14, 0.07); }
  /** Arpegio ascendente; arg = rareza (0..5) para las cápsulas */
  arp(t, notes, step, type, vol) { notes.forEach((n, i) => this.tone(type || 'triangle', NOTE(n), NOTE(n), t + i * step, step * 2.2, vol || 0.07)); }
  s_levelup(t) { this.arp(t, [72, 76, 79, 84], 0.07); this.hiss('highpass', 6000, 9000, 1, t + 0.2, 0.3, 0.03); }
  s_capsule(t, r) { const n = [67, 71, 74, 79, 83, 86, 91]; this.arp(t, n.slice(0, 3 + (r || 0)), 0.06, 'square', 0.045); if (r >= 3) this.hiss('highpass', 5000, 9000, 1, t + 0.25, 0.6, 0.05); }
  s_curse(t) { this.arp(t, [64, 63, 60, 55], 0.1, 'sawtooth', 0.05); this.tone('sine', 80, 40, t, 0.8, 0.15); }
  s_combo(t) { this.arp(t, [79, 83, 86], 0.05, 'square', 0.04); }
  s_achieve(t) { this.arp(t, [72, 76, 79, 84, 88], 0.08, 'square', 0.05); this.arp(t + 0.4, [84, 88, 91], 0.06, 'triangle', 0.06); }
  s_event(t) { this.arp(t, [67, 72, 76, 72, 79], 0.09, 'sawtooth', 0.04); }
  s_alarm(t) { for (let i = 0; i < 3; i++) { this.tone('sawtooth', 440, 880, t + i * 0.5, 0.25, 0.07); this.tone('sawtooth', 880, 440, t + i * 0.5 + 0.25, 0.25, 0.07); } }
  s_boss(t) { [45, 52, 57].forEach((n, i) => this.tone('sawtooth', NOTE(n), NOTE(n) * 0.98, t + i * 0.02, 1.8, 0.06, null, 0.3)); this.tone('sine', 55, 40, t, 1.6, 0.25, null, 0.05); }
  s_rift(t) { this.tone('sine', 200, 1600, t, 1.0, 0.08, null, 0.2); this.hiss('bandpass', 300, 5000, 6, t, 1.0, 0.12, null, 0.3); }
  s_win(t) { this.arp(t, [72, 76, 79, 84, 79, 84, 88], 0.12, 'square', 0.06); }
  s_lose(t) { this.arp(t, [69, 65, 62, 57], 0.22, 'triangle', 0.08); }
  s_impact(t) { this.hiss('lowpass', 8000, 80, 0.5, t, 1.2, 0.4, null, 0.002); this.tone('sine', 70, 25, t, 1.0, 0.5); this.tone('square', 2000, 200, t, 0.15, 0.08); }
  s_stinger(t) { [60, 64, 67, 72].forEach((n) => this.tone('sawtooth', NOTE(n), NOTE(n), t, 1.1, 0.035, null, 0.02)); this.tone('square', NOTE(84), NOTE(84), t, 0.6, 0.03); }

  /** Grito de transformación sintetizado: diente de sierra por dos filtros de formante ("A") con vibrato y subida de tono */
  scream(dur, pitch) {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain();
    const f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter(), g = c.createGain(), mix = c.createGain();
    const p0 = pitch || 170;
    o.type = 'sawtooth'; o.frequency.setValueAtTime(p0, t); o.frequency.linearRampToValueAtTime(p0 * 1.6, t + dur);
    lfo.frequency.value = 6.5; lg.gain.value = p0 * 0.04; lfo.connect(lg); lg.connect(o.frequency);
    f1.type = 'bandpass'; f1.frequency.value = 800; f1.Q.value = 6;
    f2.type = 'bandpass'; f2.frequency.value = 1200; f2.Q.value = 7;
    o.connect(f1); o.connect(f2); f1.connect(mix); f2.connect(mix); mix.gain.value = 1.2; mix.connect(g);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.25); g.gain.setValueAtTime(0.16, t + dur - 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
    g.connect(this.sfxG);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.2); lfo.stop(t + dur + 0.2);
    // Rugido de aura creciente por debajo
    this.hiss('bandpass', 200, 2400, 1.5, t, dur, 0.14, null, dur * 0.6);
    this.tone('sawtooth', 55, 110, t, dur, 0.06, null, dur * 0.5);
  }

  /* ---------- Música procedimental ---------- */
  /** Pistas: 'menu' (tranquila), 'battle' (rock heroico), 'boss' (rápida y pesada), '' = silencio */
  music(name) {
    if (name === this.track) return;
    this.track = name;
    if (!this.ctx) return;
    clearInterval(this.timer);
    if (!name) return;
    this.step = 0; this.nextT = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 40);
  }
  schedule() {
    if (!this.ok() || !this.track) return;
    const S = SONGS[this.track], spb = 60 / S.bpm / 4;            // duración de una semicorchea
    while (this.nextT < this.ctx.currentTime + 0.15) {
      this.playStep(S, this.step, this.nextT, spb);
      this.nextT += spb; this.step = (this.step + 1) % (16 * S.chords.length);
    }
  }
  playStep(S, step, t, spb) {
    const out = this.musG, bar = (step / 16) | 0, i = step % 16, ch = S.chords[bar], root = ch[0];
    // Batería
    if (S.kick[i] === 'x') { this.tone('sine', 150, 40, t, 0.18, 0.5, out); }
    if (S.snare[i] === 'x') { this.hiss('bandpass', 1800, 900, 0.8, t, 0.14, 0.22, out); this.tone('triangle', 220, 160, t, 0.08, 0.1, out); }
    if (S.hat[i] === 'x') this.hiss('highpass', 8000, 8000, 0.5, t, 0.035, 0.05, out);
    // Bajo
    if (S.bass[i] !== '.') { const n = root - 24 + (S.bass[i] === 'o' ? 12 : S.bass[i] === '5' ? 7 : 0); this.tone(S.bassWave, NOTE(n), NOTE(n), t, spb * 1.8, 0.16, out); }
    // Acordes (pads) al principio de cada compás
    if (i === 0 && S.pad) for (const n of ch) this.tone(S.padWave, NOTE(n), NOTE(n), t, spb * 15, 0.035, out, spb * 3);
    // Arpegio / melodía
    const m = S.lead[i];
    if (m !== '.') { const n = ch[+m % ch.length] + (+m >= ch.length ? 12 : 0) + 12; this.tone(S.leadWave, NOTE(n), NOTE(n), t, spb * 1.5, 0.05, out); }
  }
}

/* Canciones: acordes (MIDI) por compás y patrones de 16 pasos */
const SONGS = {
  menu: {
    bpm: 92, pad: true, padWave: 'triangle', bassWave: 'triangle', leadWave: 'sine',
    chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]],      // Am F G Em
    kick: 'x.......x.......', snare: '........x.......', hat: '..x...x...x...x.',
    bass: 'x.......x.......', lead: '0.1.2.1.0.1.2.3.'
  },
  battle: {
    bpm: 140, pad: true, padWave: 'sawtooth', bassWave: 'sawtooth', leadWave: 'square',
    chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]],      // Am F G E (heroico)
    kick: 'x...x...x...x.x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
    bass: 'x.xox.x.x.xox.5.', lead: '0.1.2.3.2.1.0.2.'
  },
  boss: {
    bpm: 164, pad: true, padWave: 'sawtooth', bassWave: 'sawtooth', leadWave: 'sawtooth',
    chords: [[57, 60, 64], [58, 62, 65], [57, 60, 64], [56, 59, 64]],      // Am Bb Am E (tenso)
    kick: 'x.x.x.x.x.x.x.xx', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx',
    bass: 'xxoxxxoxxxoxxx5x', lead: '0.2.1.3.0.2.3.5.'
  }
};

const SFX = new SoundEngine();
// El audio se desbloquea con el primer gesto (clic, tecla o toque)
['pointerdown', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, () => SFX.init(), { passive: true }));
