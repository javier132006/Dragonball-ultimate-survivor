'use strict';
/* =====================================================================
   zl3.js · Sprites y animaciones de Z Legends 3 (Geneildo Santos) dentro del juego 3D.
   assets/zl3.js (tools/make_zl3_3d.py) trae las hojas 'z_<id>' con su tabla de animación (SPRITE_DATA[hoja].anim) y
   ZL3_MAP, que dice qué hoja antigua sustituye cada una. Aquí se aplican a las transformaciones de los personajes.
   ===================================================================== */
const ZL3 = {
  ok: () => !!(window.SPRITE_DATA && window.ZL3_MAP),
  /** Hoja nueva que sustituye a `name` (o null si no hay) */
  vc: {},
  /** Luchador de Z Legends 3 de una forma del personaje (o, si esa forma conserva su hoja antigua, de cualquier otra suya) */
  fighterOf(ch, idx) {
    const f = ch && ch.forms[idx | 0], any = ch && ch.forms.find((x) => /^z_/.test(x.sheet));
    const s = f && /^z_/.test(f.sheet) ? f.sheet : any && any.sheet;
    return s ? s.slice(2) : null;
  },
  /** Grito del luchador (ult, tf, intro). Si no tiene ese, prueba `alt`. Archivos pequeños en assets/zl3/a, se descargan al usarse */
  voice(cid, kind, alt) {
    const set = cid && window.ZL3_VOICE && ZL3_VOICE[cid]; if (!set) return;
    const k = set.includes(kind) ? kind : alt && set.includes(alt) ? alt : null; if (!k) return;
    const a = this.get(cid, k); a.volume = Math.min(1, ((Save.d.vol && Save.d.vol.sfx) || 0.75) * 1.1); a.currentTime = 0;
    const p = a.play(); if (p && p.catch) p.catch(() => {});
  },
  get(cid, k) { const id = cid + '_' + k; return this.vc[id] || (this.vc[id] = new Audio('assets/zl3/a/' + id + '.m4a')); },
  /** Descarga los gritos del personaje al empezar la partida (así suenan sin retraso) */
  preload(ch) {
    if (!ch) return;
    if (!window.ZL3_VOICE) return;
    for (const f of ch.forms) if (/^z_/.test(f.sheet)) { this.panel(f.sheet.slice(2)); this.video(f.sheet.slice(2)); }
    for (const f of ch.forms) if (/^z_/.test(f.sheet)) { const s = ZL3_VOICE[f.sheet.slice(2)]; if (s) for (const k of s) if (k !== 'intro') this.get(f.sheet.slice(2), k).load(); }
  },
  uv: {},
  /** Atlas del «vídeo» de la Ultimate (paneles de cinemática seguidos), o null si no hay o aún no ha llegado */
  video(cid) {
    if (!cid || !window.ZL3_ULTV || !ZL3_ULTV[cid]) return null;
    let v = this.uv[cid];
    if (!v) { v = this.uv[cid] = new Image(); v.src = 'assets/zl3/u/' + cid + '.webp'; }
    return v.complete && v.naturalWidth ? v : null;
  },
  pn: {},
  /** Panel de cinemática (imagen lista para dibujar) del luchador, o null si no lo hay o aún no ha llegado */
  panel(cid) {
    if (!cid || !window.ZL3_PANEL || !ZL3_PANEL.includes(cid)) return null;
    let p = this.pn[cid];
    if (!p) { p = this.pn[cid] = new Image(); p.src = 'assets/zl3/p/' + cid + '.webp'; }
    return p.complete && p.naturalWidth ? p : null;
  },
  sheetFor(name) { const id = window.ZL3_MAP && ZL3_MAP[name]; return id && SPRITE_DATA['z_' + id] ? 'z_' + id : null; }
};

/** Cambia las hojas de las transformaciones que tienen versión de Z Legends 3 (misma lógica, mejores animaciones) */
function zl3Install() {
  if (!ZL3.ok()) return;
  const used = new Set();
  for (const c of CHARACTERS) {
    for (const f of c.forms) { const z = ZL3.sheetFor(f.sheet); if (z) { f.sheet = z; f.anim = packAnim(z); used.add(z); } }
    const pz = c.portrait && ZL3.sheetFor(c.portrait.sheet);
    if (pz) { c.portrait.sheet = pz; c.portrait.frame = 0; used.add(pz); }
  }
  zl3Bosses();
  for (const n of Object.keys(SPRITE_DATA)) if (/^(z_|zfx|zaura|pfx)/.test(n) && !SHEET_NAMES.includes(n)) SHEET_NAMES.push(n);
}

/** Jefes nuevos (los que no estaban en el juego). Usan los ataques de siempre de los jefes; solo cambia su aspecto y su combinación */
const ZL3_NEW_BOSSES = {
  nappa: { name: 'NAPPA', r: 1.9, col: 0xd0a070, forms: ['SOLDADO SAIYAJIN', 'FURIA DE NAPPA', 'BREAK CANNON'], tints: [0xffffff, 0xffe0c0, 0xffc090],
    moves: 'Ráfaga · Embestida · Lluvia de ki · Break Cannon', names: { fan: 'RÁFAGA SAIYAJIN', beam: '¡BREAK CANNON!', rain: 'LLUVIA DE KI', dash: 'EMBESTIDA' },
    pat: [['fan', 'dash'], ['fan', 'dash', 'rain'], ['fan', 'dash', 'rain', 'beam']], res: 'fis', stages: [0, 7] },
  ginyu: { name: 'CAPITÁN GINYU', r: 1.8, col: 0xb04aff, forms: ['FUERZA ESPECIAL', 'POSE DE COMBATE', 'CAMBIO DE CUERPOS'], tints: [0xffffff, 0xf0d0ff, 0xd8a0ff],
    moves: 'Ráfaga · Teletransporte · Esferas · Invocación', names: { fan: 'RÁFAGA GINYU', blink: 'TELETRANSPORTE', orbs: 'MILK CANNON', summon: 'FUERZAS GINYU' },
    pat: [['fan', 'blink'], ['fan', 'blink', 'orbs'], ['fan', 'blink', 'orbs', 'summon']], res: 'ki', stages: [0, 3] },
  moro: { name: 'MORO', r: 1.9, col: 0x9aff70, forms: ['EL DEVORADOR', 'MAGIA ABSORBIDA', 'PLANETA DEVORADO'], tints: [0xffffff, 0xd8ffc0, 0xb0ff90],
    moves: 'Esferas · Regeneración · Lluvia de magia · Rayo', names: { orbs: 'MAGIA DE MORO', regen: 'ABSORBE ENERGÍA', rain: 'LLUVIA DE MAGIA', beam: 'RAYO DEVORADOR' },
    pat: [['orbs', 'fan'], ['orbs', 'rain', 'regen'], ['orbs', 'rain', 'beam', 'regen']], res: 'ki', stages: [6, 7] },
  baby: { name: 'SUPER BABY 2', r: 1.9, col: 0xff5a5a, forms: ['PARÁSITO TUFFLE', 'SUPER BABY', 'GRAN MONO ARTIFICIAL'], tints: [0xffffff, 0xffd0c8, 0xffa090],
    moves: 'Ráfaga · Embestida · Invocación · Anillo', names: { fan: 'RÁFAGA DE BABY', dash: 'EMBESTIDA', summon: 'ESCLAVOS DE BABY', ring: 'ONDA TUFFLE' },
    pat: [['fan', 'dash'], ['fan', 'dash', 'ring'], ['fan', 'dash', 'ring', 'summon']], res: 'fis', stages: [2, 4] }
};

/** Jefes: los que ya existen cambian de hoja (ZL3_BOSS) y los nuevos se añaden a los mapas. `scale` ≈ alto de la casilla / 20:
    mantiene el mismo tamaño de píxel que los jefes de siempre (casillas de 128 px a escala 3,2) */
function zl3Bosses() {
  if (!window.ZL3_BOSS) return;
  for (const k in ZL3_BOSS) {
    const sh = 'z_' + ZL3_BOSS[k], m = SPRITE_DATA[sh]; if (!m) continue;
    let B = BOSSES[k];
    if (!B) {
      const N = ZL3_NEW_BOSSES[k]; if (!N) continue;
      B = BOSSES[k] = Object.assign({ id: k }, N); B.res = N.res;
      for (const i of N.stages) if (STAGES[i] && !STAGES[i].bosses.includes(k)) STAGES[i].bosses.push(k);
    }
    B.sheet = sh; B.row = 0; B.scale = Math.round(m.h * 0.05 * 100) / 100; delete B.rows;
  }
  for (const S of STAGES) S.boss = Object.assign({}, BOSSES[S.bosses[0]], { hp: S.bossHp });   // jefe por defecto de cada mapa, con la hoja nueva
}

/** Tabla de columnas que usan los jefes-luchador (andar, golpe, técnica…) a partir de la tabla de la hoja, si la trae */
function bossAnimOf(sheet, def) {
  const m = window.SPRITE_DATA && SPRITE_DATA[sheet], a = m && m.anim;
  return a ? { walk: a.walk, hit: a.hurt, atk: a.atk, cast: a.atk2, stun: a.hurt } : def;
}

/* ---------- Panorama de fondo ----------
   Escenarios de Z Legends 3 (assets/zl3/s/<id>.webp, 30-70 KB cada uno, se descargan solo al usarlos) en un cilindro que sigue
   a la cámara. Se ve sobre el horizonte (al inclinar la cámara) y se apaga de noche. Solo con http(s): con doble clic el navegador
   no deja usar imágenes de archivo como textura. */
const ZL3_STAGE = { earth: 'desert', namek: 'namek', vegeta: 'zoon', room: 'time', rift: 'space', torneo: 'tdp', hell: 'hell', kame: 'kame' };
class Backdrop {
  constructor(scene) {
    this.on = /^https?:/.test(location.protocol);
    this.cache = {}; this.cur = null; this.id = null;
    this.mat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false });
    this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(385, 385, 150, 48, 1, true), this.mat);
    this.mesh.renderOrder = -10; this.mesh.frustumCulled = false; this.mesh.visible = false;
    scene.add(this.mesh);
  }
  /** Elige el escenario del mapa `stageId` (descarga la imagen la primera vez) */
  set(stageId) {
    const z = ZL3_STAGE[stageId]; this.id = z || null;
    if (!this.on || !z) { this.mesh.visible = false; return; }
    const c = this.cache[z];
    if (c && c.tex) return this.show(z);
    if (c) return;                                              // ya se está descargando
    this.cache[z] = {};
    const img = new Image();
    img.onload = () => {
      const t = new THREE.Texture(img);
      t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
      t.wrapS = THREE.MirroredRepeatWrapping; t.repeat.set(8, 1); t.needsUpdate = true;
      this.cache[z].tex = t; if (this.id === z) this.show(z);
    };
    img.onerror = () => { this.cache[z].err = true; };
    img.src = 'assets/zl3/s/' + z + '.webp';
  }
  show(z) { this.mat.map = this.cache[z].tex; this.mat.needsUpdate = true; this.mesh.visible = true; }
  /** Sigue a la cámara; de noche se oscurece como el resto del mapa */
  follow(cam, night) {
    if (!this.mesh.visible) return;
    this.mesh.position.set(cam.position.x, 40, cam.position.z);
    this.mat.color.setScalar(1 - (night || 0) * 0.75);
  }
}

