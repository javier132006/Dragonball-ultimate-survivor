'use strict';
/* =====================================================================
   poi.js · Puntos de interés del mapa (sprites 2D procedurales):
   Altar del Jefe, Habitación del Espíritu y el Tiempo, Templo del
   Desafío, Bulma (tienda), Maestro Roshi (cambia/elimina objetos) y
   la Grieta de Black (portal al siguiente mapa).
   ===================================================================== */

/* Tipos: frame del atlas, nombre, color del brillo, escala del sprite */
const POI_TYPES = {
  boss: { frame: 0, name: 'Altar del Jefe', color: 0xff3050, scale: 1.5 },
  time: { frame: 1, name: 'Habitación del Espíritu y el Tiempo', color: 0x6fd0ff, scale: 1.5 },
  temple: { frame: 2, name: 'Templo del Desafío', color: 0x5be07a, scale: 1.7 },
  merchant: { frame: 3, name: 'Bulma', color: 0xffd24a, scale: 1.05 },
  swapper: { frame: 4, name: 'Maestro Roshi', color: 0x7ad8ff, scale: 1.05 },
  rift: { frame: 5, name: 'Grieta', color: 0xc050ff, scale: 2.4 }
};
const TIME_ZONE_R = 7;       // radio de la Habitación del Tiempo
const TIME_CHARGE = 12;      // segundos dentro para completarla

/** Atlas 8x32 píxeles de 32x32: se dibuja con rectángulos y elipses y se les añade un contorno oscuro */
function makePoiTexture() {
  const W = 256, H = 32, buf = new Uint8Array(W * H * 4);
  const put = (f, x, y, c) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || x > 31 || y < 0 || y > 31) return;
    const o = (y * W + f * 32 + x) * 4;
    buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = 255;
  };
  const rect = (f, x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(f, x + i, y + j, c); };
  const ell = (f, cx, cy, rx, ry, c) => { for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) if ((i * i) / (rx * rx + 0.3) + (j * j) / (ry * ry + 0.3) <= 1) put(f, cx + i, cy + j, c); };
  const SK = [250, 205, 165], BK = [28, 22, 32], WH = [245, 245, 250];

  // 0 · Altar del Jefe: pedestal de piedra con un cristal rojo
  rect(0, 4, 25, 24, 5, [86, 86, 102]); rect(0, 8, 20, 16, 6, [108, 108, 128]); rect(0, 12, 13, 8, 8, [130, 130, 152]);
  ell(0, 16, 8, 5, 7, [232, 40, 64]); rect(0, 14, 4, 2, 5, [255, 160, 170]); rect(0, 17, 10, 2, 5, [160, 20, 40]);
  // 1 · Habitación del Tiempo: puerta blanca con luz azul y un reloj
  rect(1, 6, 8, 20, 22, WH); ell(1, 16, 9, 10, 6, WH); rect(1, 9, 11, 14, 19, [110, 196, 255]); ell(1, 16, 11, 7, 5, [110, 196, 255]);
  rect(1, 9, 16, 14, 2, [190, 232, 255]); rect(1, 9, 24, 14, 2, [160, 220, 255]); ell(1, 16, 19, 4, 4, WH); rect(1, 16, 16, 1, 4, BK); rect(1, 16, 19, 3, 1, BK);
  // 2 · Templo de Kami: cuerpo claro y tejados verdes
  rect(2, 5, 19, 22, 11, [238, 224, 188]); rect(2, 13, 22, 6, 8, [120, 72, 40]); rect(2, 8, 22, 3, 4, [90, 160, 220]); rect(2, 21, 22, 3, 4, [90, 160, 220]);
  rect(2, 2, 14, 28, 5, [38, 148, 90]); rect(2, 6, 9, 20, 5, [52, 172, 104]); rect(2, 10, 5, 12, 4, [68, 194, 120]); rect(2, 14, 1, 4, 4, [255, 200, 60]);
  // 3 · Bulma: pelo turquesa, camiseta rosa y falda blanca
  const T = [64, 196, 196], PK = [255, 122, 176];
  ell(3, 16, 9, 7, 7, T); rect(3, 9, 9, 3, 11, T); rect(3, 20, 9, 3, 11, T);
  rect(3, 11, 8, 10, 8, SK); rect(3, 13, 11, 2, 2, BK); rect(3, 18, 11, 2, 2, BK); rect(3, 15, 14, 3, 1, [200, 80, 80]);
  rect(3, 10, 17, 12, 8, PK); rect(3, 6, 18, 4, 7, SK); rect(3, 22, 18, 4, 7, SK); rect(3, 10, 24, 12, 4, WH);
  rect(3, 11, 27, 4, 4, SK); rect(3, 17, 27, 4, 4, SK); rect(3, 24, 22, 3, 4, WH); rect(3, 24, 22, 3, 1, [230, 60, 60]);
  // 4 · Maestro Roshi: calvo, gafas, barba blanca, camisa naranja y bastón
  ell(4, 16, 9, 5, 5, SK); rect(4, 11, 8, 10, 2, BK); rect(4, 12, 12, 8, 5, WH); ell(4, 16, 14, 4, 3, WH);
  rect(4, 9, 17, 14, 7, [255, 140, 40]); rect(4, 12, 19, 2, 2, [255, 230, 90]); rect(4, 18, 21, 2, 2, [255, 230, 90]);
  rect(4, 6, 18, 4, 6, SK); rect(4, 22, 18, 4, 6, SK); rect(4, 10, 24, 12, 3, [64, 92, 204]); rect(4, 11, 27, 4, 4, SK); rect(4, 17, 27, 4, 4, SK);
  rect(4, 26, 6, 2, 25, [166, 112, 62]); ell(4, 27, 5, 2, 2, [255, 200, 50]); ell(4, 16, 22, 10, 3, [60, 120, 64]);
  // 5 · Grieta: portal violeta con espiral
  ell(5, 16, 16, 13, 14, [60, 16, 100]); ell(5, 16, 16, 10, 11, [128, 36, 190]); ell(5, 16, 16, 6, 7, [18, 0, 36]);
  for (let k = 0; k < 90; k++) { const a = k * 0.3, r = 1.5 + k * 0.14; put(5, 16 + Math.cos(a) * r * 0.85, 16 + Math.sin(a) * r, [255, 150, 255]); put(5, 16 + Math.cos(a + 3.1) * r * 0.85, 16 + Math.sin(a + 3.1) * r, [190, 90, 255]); }

  // Contorno: los píxeles transparentes junto a uno opaco se pintan oscuros
  const o = new Uint8Array(buf);
  for (let f = 0; f < 6; f++) for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const i = (y * W + f * 32 + x) * 4;
    if (buf[i + 3]) continue;
    let near = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < 32 && ny >= 0 && ny < 32 && buf[(ny * W + f * 32 + nx) * 4 + 3]) near = true;
    }
    if (near) { o[i] = 24; o[i + 1] = 16; o[i + 2] = 28; o[i + 3] = 255; }
  }
  return pixelTex(W, H, (x, y) => { const i = (y * W + x) * 4; return o[i + 3] ? [o[i], o[i + 1], o[i + 2], o[i + 3]] : null; });
}

/* ---------- Gestor de puntos de interés ---------- */
class Points {
  constructor(scene, tex) {
    this.list = []; this.near = -1; this.rifts = []; this.t = 0;
    this.spr = new SpriteBatch(scene, { max: 40, texture: tex.poi, cols: 8, rows: 1, w: 3.2, h: 3.2, anchor: 0.04, renderOrder: 2 });
    this.glow = new SpriteBatch(scene, { max: 40, texture: tex.ki, w: 1, h: 1, anchor: 0.5, additive: true, alpha: 0.2, cut: 0.02, renderOrder: 1 });
  }
  reset() { this.list.length = 0; this.rifts.length = 0; this.near = -1; this.spr.reset(); this.glow.reset(); }
  add(type, x, z) { this.list.push({ type, x, z, used: false, charge: 0, stock: null, rerolls: 0 }); }
  /** Abre una grieta hacia el mapa `to` (color del brillo según el destino) */
  openRift(x, z, to, col) { this.rifts.push({ x, z, to, col: col || 0xc050ff, near: false }); }
  /** Grieta junto al jugador (o null) */
  riftNear() { for (const r of this.rifts) if (r.near) return r; return null; }

  /** Coloca los puntos del mapa: separados entre sí y fuera de obstáculos */
  populate(world, stage) {
    const R = CFG.ARENA - 18, spots = [];
    const spot = () => {
      for (let k = 0; k < 60; k++) {
        const x = rand(-R, R), z = rand(-R, R);
        if (Math.hypot(x, z) < 30) continue;
        if (spots.some((s) => Math.hypot(s[0] - x, s[1] - z) < 36)) continue;
        world.push(x, z, 3); const px = world.px, pz = world.pz;
        spots.push([px, pz]);
        return [px, pz];
      }
      const x = rand(-R, R), z = rand(-R, R); spots.push([x, z]); return [x, z];
    };
    const plan = [['boss', 1], ['time', 2], ['temple', 2], ['merchant', 2], ['swapper', 1]];
    for (const [type, n] of plan) for (let i = 0; i < n; i++) { const [x, z] = spot(); this.add(type, x, z); }
  }

  /** Devuelve el índice del punto interactuable más cercano (o -1) */
  update(dt, p, g) {
    this.t += dt;
    let best = -1, bd = 30;
    this.spr.begin(); this.glow.begin();
    for (let i = 0; i < this.list.length; i++) {
      const o = this.list[i], T = POI_TYPES[o.type], dx = p.x - o.x, dz = p.z - o.z, d2 = dx * dx + dz * dz, bob = Math.sin(this.t * 2 + i) * 0.06;
      if (d2 < bd && (!o.used || o.type === 'merchant' || o.type === 'swapper')) { bd = d2; best = i; }
      if (o.type === 'time' && !o.used) {                           // Habitación del Tiempo: carga mientras estás dentro
        const r = TIME_ZONE_R, inside = d2 < r * r;
        if (inside) { o.charge = Math.min(1, o.charge + dt / TIME_CHARGE); g.zoneBusy = o; }
        for (let k = 0; k < 2; k++) { const a = rand(0, 6.28); g.fx.trail.emit(o.x + Math.cos(a) * r, 0.2, o.z + Math.sin(a) * r, 0, rand(1, 3), 0, 0.5, 0.25, 0, inside ? 0x9fe8ff : 0x4a90c0); }
        if (o.charge >= 1) { o.used = true; g.onTimeRoomDone(o); }
      }
      this.spr.push(o.x, 0.1 + bob, o.z, T.frame, 0, 0, T.scale, 1, o.used && !(o.type === 'merchant' || o.type === 'swapper') ? 0x666666 : undefined);
      if (!o.used || o.type === 'merchant' || o.type === 'swapper') this.glow.push(o.x, 1, o.z, 0, 0, 0, 5 + Math.sin(this.t * 3 + i) * 0.5, 1, T.color);
    }
    this.near = best;
    for (const r of this.rifts) {                                   // Grietas de Black (una por destino)
      const T = POI_TYPES.rift, dx = p.x - r.x, dz = p.z - r.z;
      this.spr.push(r.x, 0.2, r.z, T.frame, 0, 0, T.scale * (1 + Math.sin(this.t * 3) * 0.05), 1, r.col === 0xc050ff ? undefined : r.col | 0x404040);
      this.glow.push(r.x, 2, r.z, 0, 0, 0, 9 + Math.sin(this.t * 4), 1, r.col);
      const a = rand(0, 6.28);
      g.fx.aura.emit(r.x + Math.cos(a) * 3, rand(0.5, 5), r.z + Math.sin(a) * 3, -Math.cos(a) * 2, rand(0, 2), -Math.sin(a) * 2, 0.8, 0.3, 0, r.col);
      r.near = dx * dx + dz * dz < 20;
    }
    this.spr.end(); this.glow.end();
  }
}
