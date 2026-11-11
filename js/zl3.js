'use strict';
/* =====================================================================
   zl3.js · Sprites y animaciones de Z Legends 3 (Geneildo Santos) dentro del juego 3D.
   assets/zl3.js (tools/make_zl3_3d.py) trae las hojas 'z_<id>' con su tabla de animación (SPRITE_DATA[hoja].anim) y
   ZL3_MAP, que dice qué hoja antigua sustituye cada una. Aquí se aplican a las transformaciones de los personajes.
   ===================================================================== */
const ZL3 = {
  ok: () => !!(window.SPRITE_DATA && window.ZL3_MAP),
  /** Hoja nueva que sustituye a `name` (o null si no hay) */
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
  for (const n of Object.keys(SPRITE_DATA)) if (/^z_/.test(n) && !SHEET_NAMES.includes(n)) SHEET_NAMES.push(n);
}

/** Tabla de columnas que usan los jefes-luchador (andar, golpe, técnica…) a partir de la tabla de la hoja, si la trae */
function bossAnimOf(sheet, def) {
  const m = window.SPRITE_DATA && SPRITE_DATA[sheet], a = m && m.anim;
  return a ? { walk: a.walk, hit: a.hurt, atk: a.atk, cast: a.atk2, stun: a.hurt } : def;
}
