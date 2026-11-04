'use strict';
/* =====================================================================
   world.js · Mundo 3D grande (440x440): biomas, props instanciados,
   colisiones con rejilla, cristales destructibles y minimapa.
   ===================================================================== */

const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** Ruido de valor suave 0..1 */
function noise2(x, z, s) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const h = (a, b) => { const n = Math.sin((a + s * 17.3) * 127.1 + (b - s * 9.1) * 311.7) * 43758.5453; return n - Math.floor(n); };
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return (h(ix, iz) * (1 - u) + h(ix + 1, iz) * u) * (1 - v) + (h(ix, iz + 1) * (1 - u) + h(ix + 1, iz + 1) * u) * v;
}
/* Colores de bioma: 0 yermo, 1 llanura verde, 2 cañón rojo, 3 tierra ceniza */
let BIOME_COL = [[0.86, 0.7, 0.52], [0.5, 0.72, 0.42], [0.82, 0.45, 0.32], [0.58, 0.55, 0.58]];
let BIOME_NAMES = ['YERMO', 'LLANURA', 'CAÑÓN', 'TIERRA CENIZA'];
let BIOME_SEED = 0;

/* ---------- Temas de mapa (uno por fase de la partida) ---------- */
const THEMES = [
  { seed: 20241103, names: ['YERMO', 'LLANURA', 'CAÑÓN', 'TIERRA CENIZA'], cols: [[0.86, 0.7, 0.52], [0.5, 0.72, 0.42], [0.82, 0.45, 0.32], [0.58, 0.55, 0.58]],
    bg: 0xf2b676, fog: 0xf0b878, fogRange: [90, 330], hemi: [0xfff0d0, 0x8a5a30, 0.45], sun: 0.6, tex: '#e4d8c8',
    mesas: [0xa87a46, 0xa0482a, 0x6d6a70], rim: 0x8f5a34, rock: 0x9a6a44, pebble: 0xa8693a, trunk: 0x7a5232, crown: 0x3f9a4a, dead: 0x4a3b32, pillar: 0x9a9aa2, crater: 0x4a3626, lake: 0x3ea6e8, crystal: 0x9fe0ff },
  { seed: 777123, names: ['LLANURA AZUL', 'BOSQUE DE AJAS', 'MARES VERDES', 'ISLOTES'], cols: [[0.32, 0.72, 0.62], [0.3, 0.68, 0.4], [0.26, 0.55, 0.72], [0.5, 0.74, 0.66]],
    bg: 0x9be8b4, fog: 0x9be8b4, fogRange: [80, 300], hemi: [0xe8fff0, 0x3a7a62, 0.5], sun: 0.62, tex: '#cdeed8',
    mesas: [0x4f9f78, 0x3d8f9a, 0x6aa88f], rim: 0x3f8f70, rock: 0x5f9f88, pebble: 0x58a890, trunk: 0x6b8f5a, crown: 0x8be8b0, dead: 0x4a6b52, pillar: 0xa8c8b8, crater: 0x1f6a58, lake: 0x35e0a8, crystal: 0xffa0e8 },
  { seed: 99087, names: ['VACÍO', 'RUINAS', 'GRIETA', 'ABISMO'], cols: [[0.3, 0.22, 0.44], [0.24, 0.18, 0.38], [0.44, 0.17, 0.38], [0.28, 0.28, 0.42]],
    bg: 0x140a24, fog: 0x1a0e30, fogRange: [40, 150], hemi: [0xc8a0ff, 0x30184a, 0.55], sun: 0.5, tex: '#8a78a8',
    mesas: [0x3a2a58, 0x56306a, 0x2a2440], rim: 0x2a1c46, rock: 0x4a3868, pebble: 0x6a4a88, trunk: 0x3a2a48, crown: 0x8040c0, dead: 0x2a1c38, pillar: 0x7a68b0, crater: 0x0a0414, lake: 0xd040a0, crystal: 0xff90e0 },
  // 3 · Planeta Vegeta: cielo rojo, roca carmesí y lagos de lava
  { seed: 4417, names: ['LLANURA ROJA', 'CAMPO DE CRÁTERES', 'CAÑÓN CARMESÍ', 'RUINAS SAIYAJIN'], cols: [[0.66, 0.34, 0.25], [0.52, 0.27, 0.22], [0.74, 0.42, 0.26], [0.45, 0.32, 0.34]],
    bg: 0xc8503a, fog: 0xc85a40, fogRange: [70, 280], hemi: [0xffd0b0, 0x5a2018, 0.5], sun: 0.6, tex: '#dcae96',
    mesas: [0x8a3a2a, 0x6a2a22, 0x5a4a52], rim: 0x5a2418, rock: 0x7a3a2a, pebble: 0x8a4a32, trunk: 0x5a3a2a, crown: 0xb05a2a, dead: 0x3a2420, pillar: 0xb8a8a0, crater: 0x2a1010, lake: 0xff6a1a, crystal: 0xffa040 },
  // 4 · Cámara del Espíritu y el Tiempo: vacío blanco infinito
  { seed: 1031, names: ['VACÍO BLANCO', 'VACÍO BLANCO', 'VACÍO BLANCO', 'VACÍO BLANCO'], cols: [[0.95, 0.95, 0.97], [0.9, 0.91, 0.96], [0.97, 0.95, 0.92], [0.88, 0.9, 0.96]],
    bg: 0xf8f8ff, fog: 0xffffff, fogRange: [30, 125], hemi: [0xffffff, 0xc8c8d8, 0.7], sun: 0.45, tex: '#f2f2f8',
    mesas: [0xe6e6ee, 0xdcdce6, 0xd2d2de], rim: 0xf4f4fa, rock: 0xd4d4de, pebble: 0xdadae2, trunk: 0xc8c8d0, crown: 0xe8e8f0, dead: 0xc0c0cc, pillar: 0xe0e0ea, crater: 0xc8c8d8, lake: 0xa8ccff, crystal: 0x9fe0ff }
];
/* Semilla extra del mapa (el desafío diario la cambia para que el mapa sea el del día) */
let WORLD_SEED_XOR = 0;
/* Semilla del relieve: aleatoria en cada partida (en el diario la fija Game.start con la del día) */
let RELIEF_SEED = Math.floor(Math.random() * 1000003);

/** Altura del terreno en (x,z) antes de aplicar los lagos. Centro plano para empezar; colinas y montañas suaves */
function reliefAt(x, z) {
  const m = sm(22, 75, Math.hypot(x, z));                        // zona de inicio y alrededores: plana
  const a = noise2(x * 0.011, z * 0.011, 40 + RELIEF_SEED), b = noise2(x * 0.027, z * 0.027, 60 + RELIEF_SEED), c = noise2(x * 0.07, z * 0.07, 80 + RELIEF_SEED);
  const v = 0.5 * a + 0.32 * b + 0.18 * c - 0.44;                 // mayor que 0: montaña; menor que 0: hondonada suave
  const cany = 1 + 0.5 * biomeWeights(x, z)[2];                 // los cañones son más altos
  return clamp((v > 0 ? v * 1.9 : v * 0.3) * 7.5 * m * cany, -1, 7);
}
/** Altura del suelo en (x,z), leída del mapa de alturas (misma que usan los sprites en la GPU) */
function groundH(x, z) {
  const N = HM.N, cell = HM.EXT / N, lim = HM.EXT / 2, D = HM.data;
  const fx = clamp((x + lim) / cell - 0.5, 0, N - 1.001), fz = clamp((z + lim) / cell - 0.5, 0, N - 1.001);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const h = (a, b) => D[(b * N + a) * 4] / 255 * HM.RANGE + HM.MIN;
  return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v;
}
const _bw = [0, 0, 0, 0];
/** Pesos de cada bioma en (x,z). El centro del mapa siempre es yermo. */
function biomeWeights(x, z) {
  const a = noise2(x * 0.011, z * 0.011, 1 + BIOME_SEED), b = noise2(x * 0.017 + 7, z * 0.017 - 3, 2 + BIOME_SEED), far = sm(18, 60, Math.hypot(x, z));
  const g = sm(0.52, 0.62, a) * far, r = sm(0.46, 0.36, a) * sm(0.45, 0.55, b) * far, s = sm(0.46, 0.36, a) * (1 - sm(0.45, 0.55, b)) * far;
  _bw[0] = Math.max(0, 1 - g - r - s); _bw[1] = g; _bw[2] = r; _bw[3] = s;
  return _bw;
}
function biomeAt(x, z) {
  const w = biomeWeights(x, z); let k = 0;
  for (let i = 1; i < 4; i++) if (w[i] > w[k]) k = i;
  return k;
}

class World {
  constructor(scene, themeIdx) {
    const th = this.th = THEMES[themeIdx || 0], before = scene.children.length;
    this.themeIdx = themeIdx || 0;
    this.scene = scene;
    BIOME_COL = th.cols; BIOME_NAMES = th.names; BIOME_SEED = (themeIdx || 0) * 5 + (WORLD_SEED_XOR % 97);
    this.R = CFG.ARENA; this.seedX = WORLD_SEED_XOR;
    this.dens = clamp((this.R / 220) * (this.R / 220), 0.1, 1);       // en mapas pequeños hay menos props
    this.rng = seeded(th.seed ^ WORLD_SEED_XOR);
    scene.background = new THREE.Color(th.bg);
    scene.fog = new THREE.Fog(th.fog, th.fogRange[0], th.fogRange[1]);
    this.hemi = new THREE.HemisphereLight(th.hemi[0], th.hemi[1], th.hemi[2]);
    scene.add(this.hemi);
    this.night = 0; this._c = new THREE.Color();
    // Luz cenital con sombras suaves: sigue al jugador para mantener la sombra nítida
    this.sun = new THREE.DirectionalLight(0xfff4e0, th.sun);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -48; sc.right = 48; sc.top = 48; sc.bottom = -48; sc.near = 1; sc.far = 140;   // margen para el sol a saltos
    this.sunX = NaN; this.sunZ = NaN;
    this.sun.shadow.bias = -0.0006;
    scene.add(this.sun, this.sun.target);

    // Colisiones estáticas (rejilla de celdas de 8 unidades)
    this.cx = []; this.cz = []; this.cr = []; this.cdest = [];
    this.destr = [];                       // cristales destructibles: {x,z,hp,col,idx}
    this.px = 0; this.pz = 0;              // resultado de push()
    this.reliefSeed = RELIEF_SEED;
    this.lakes = this.planLakes();         // primero los lagos: el relieve los aplana
    this.buildHeight();
    this.buildGround(scene);
    this.buildProps(scene);
    this.buildSprites(scene, themeIdx || 0);
    this.buildGrid();
    this.buildMinimap();
    this.objs = scene.children.slice(before);
  }

  /** Quita el mapa de la escena y libera memoria (al cambiar de fase) */
  dispose(scene) {
    for (const o of this.objs) {
      scene.remove(o);
      if (o.geometry) o.geometry.dispose();
      if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
    }
  }

  /** Lagos (solo visuales): posiciones fijas en la semilla del mapa; más tarde el relieve se aplana bajo ellos */
  planLakes() {
    const R = this.R, out = [], rng = this.rng;
    if (R < 100) return out;
    for (let k = 0; k < 60 && out.length < 9; k++) {
      const x = (rng() * 2 - 1) * R * 0.9, z = (rng() * 2 - 1) * R * 0.9, r = 10 + rng() * 14;
      if (Math.hypot(x, z) < 45) continue;
      if (out.some((l) => Math.hypot(l.x - x, l.z - z) < r + l.r + 25)) continue;
      out.push({ x, z, r });
    }
    return out;
  }

  /** Rellena el mapa de alturas: relieve + hondonadas planas bajo los lagos */
  buildHeight() {
    const N = HM.N, cell = HM.EXT / N, lim = HM.EXT / 2, D = HM.data;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -lim + (i + 0.5) * cell, z = -lim + (j + 0.5) * cell;
      let h = reliefAt(x, z);
      for (const l of this.lakes) {
        const d = Math.hypot(x - l.x, z - l.z), t = clamp((d - l.r) / 5, 0, 1);
        h = -0.4 + (h + 0.4) * sm(0, 1, t);                        // dentro del lago: nivel -0.4; se suaviza en 5 unidades
      }
      const b = clamp(Math.round((h - HM.MIN) / HM.RANGE * 255), 0, 255), o = (j * N + i) * 4;
      D[o] = D[o + 1] = D[o + 2] = b; D[o + 3] = 255;
    }
    HM.tex.needsUpdate = true;
  }

  buildGround(scene) {
    const S = (this.R + 90) * 2, geo = new THREE.PlaneGeometry(S, S, 150, 150);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), h = groundH(x, z), w = biomeWeights(x, z);
      p.setY(i, h);
      const shade = 0.9 + clamp(h / 7, -0.12, 0.14);               // las zonas altas se ven un poco más claras
      for (let c = 0; c < 3; c++) col[i * 3 + c] = (w[0] * BIOME_COL[0][c] + w[1] * BIOME_COL[1][c] + w[2] * BIOME_COL[2][c] + w[3] * BIOME_COL[3][c]) * shade;
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();                                     // la luz marca las laderas
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const tex = this.makeGroundTexture();
    const ground = new THREE.Mesh(geo, toonMat(0xffffff, Object.assign({ vertexColors: true }, tex ? { map: tex } : {})));
    ground.receiveShadow = true;
    scene.add(ground);
  }

  /** Suelo con la baldosa pixel art del mapa (hoja «tiles»): se pasa a relieve en gris y se tiñe con el color del tema,
      así los biomas siguen marcando el color y la baldosa solo pone el detalle */
  makeTileTexture(theme) {
    const sh = FX_SHEETS && FX_SHEETS.tiles, img = sh && sh.tex && sh.tex.image;
    if (!img || !img.width) return null;
    const k = [0, 2, 3, 0, 4][theme] === undefined ? 0 : [0, 2, 3, 0, 4][theme];      // tierra, hierba, piedra, tierra, ladrillo blanco
    const C = 128, c = document.createElement('canvas'); c.width = c.height = C;
    const g = c.getContext && c.getContext('2d'); if (!g) return null;
    g.drawImage(img, (k % 3) * C, ((k / 3) | 0) * C, C, C, 0, 0, C, C);
    let d; try { d = g.getImageData(0, 0, C, C); } catch (e) { return null; }    // con file:// algunos navegadores lo bloquean
    const D = d.data, tc = new THREE.Color(this.th.tex);
    let mean = 0; for (let i = 0; i < D.length; i += 4) mean += D[i] * 0.3 + D[i + 1] * 0.59 + D[i + 2] * 0.11;
    mean /= D.length / 4;
    for (let i = 0; i < D.length; i += 4) {
      const v = (D[i] * 0.3 + D[i + 1] * 0.59 + D[i + 2] * 0.11) / mean, f = clamp(0.62 + 0.38 * v, 0.35, 1.25);
      D[i] = clamp(tc.r * 255 * f, 0, 255); D[i + 1] = clamp(tc.g * 255 * f, 0, 255); D[i + 2] = clamp(tc.b * 255 * f, 0, 255);
    }
    g.putImageData(d, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
    const S = (this.R + 90) * 2; t.repeat.set(S / 9, S / 9);              // una baldosa cada 9 unidades
    t.magFilter = THREE.NearestFilter; t.anisotropy = 4;
    return t;
  }

  makeGroundTexture() {
    const tt = this.makeTileTexture(this.themeIdx);
    if (tt) return tt;
    const S = 256, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext && c.getContext('2d');
    if (!g) return null;
    g.fillStyle = this.th.tex;
    g.fillRect(0, 0, S, S);
    const wrap = (fn) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) fn(ox, oy); };
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * S, y = Math.random() * S, r = 6 + Math.random() * 26;
      g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '110,85,60' : '255,245,225') + ',' + (0.05 + Math.random() * 0.07) + ')';
      wrap((ox, oy) => { g.beginPath(); g.arc(x + ox, y + oy, r, 0, 7); g.fill(); });
    }
    g.strokeStyle = 'rgba(80,55,35,.45)';
    g.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) {
      const pts = [];
      let x = Math.random() * S, y = Math.random() * S;
      for (let k = 0; k < 6; k++) { pts.push([x, y]); x += (Math.random() - 0.5) * 44; y += (Math.random() - 0.5) * 44; }
      wrap((ox, oy) => { g.beginPath(); g.moveTo(pts[0][0] + ox, pts[0][1] + oy); for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0] + ox, pts[k][1] + oy); g.stroke(); });
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(60, 60);
    t.magFilter = THREE.NearestFilter;
    t.anisotropy = 4;
    return t;
  }

  /** Crea un InstancedMesh a partir de una lista de colocaciones [x,y,z,sx,sy,sz,ry] */
  inst(scene, geo, mat, list, shadow) {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), P = new THREE.Vector3(), Sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    list.forEach((o, i) => { q.setFromAxisAngle(up, o[6] || 0); P.set(o[0], o[1] + groundH(o[0], o[2]), o[2]); Sc.set(o[3], o[4], o[5]); m.setMatrixAt(i, M.compose(P, q, Sc)); });
    m.count = list.length;
    m.castShadow = m.receiveShadow = !!shadow;
    scene.add(m);
    return m;
  }

  collider(x, z, r, dest) { this.cx.push(x); this.cz.push(z); this.cr.push(r); this.cdest.push(dest === undefined ? -1 : dest); }

  buildProps(scene) {
    const rng = this.rng, R = this.R, th = this.th, rr = (a, b) => a + rng() * (b - a), N = (c) => Math.max(3, Math.round(c * this.dens)), sc = R < 100 ? 0.3 : 1;
    const spot = (minD0) => { const minD = minD0 * sc; for (let k = 0; k < 20; k++) { const x = rr(-R, R), z = rr(-R, R); if (Math.hypot(x, z) > minD) return [x, z]; } return [R * 0.9, R * 0.9]; };
    const cyl = new THREE.CylinderGeometry(0.62, 1, 1, 7), ico = new THREE.IcosahedronGeometry(1, 0);
    // Mesetas por bioma (rojas en el cañón, grises en la tierra ceniza, ocres en el resto)
    const mesas = [[], [], []], MC = th.mesas;
    for (let i = 0; i < N(90); i++) {
      const [x, z] = spot(30), b = biomeAt(x, z), k = b === 2 ? 1 : b === 3 ? 2 : 0, w = rr(3, 6.5), h = rr(9, 26);
      mesas[k].push([x, h / 2 - 0.5, z, w, h, w, rr(0, 6.28)]);
      this.collider(x, z, w * 0.82);
    }
    mesas.forEach((l, k) => { if (l.length) this.inst(scene, cyl, toonMat(MC[k]), l, true); });
    // Muralla de mesetas gigantes fuera del mapa (oculta el borde)
    const rim = [];
    for (let i = 0; i < 130; i++) { const a = rr(0, 6.28), d = R + rr(8, 80), w = rr(8, 18), h = rr(24, 70); rim.push([Math.cos(a) * d, h / 2 - 0.5, Math.sin(a) * d, w, h, w, rr(0, 6.28)]); }
    this.inst(scene, cyl, toonMat(th.rim), rim, false);
    // Rocas grandes (con colisión) y guijarros decorativos
    const rocks = [], pebbles = [];
    for (let i = 0; i < N(150); i++) { const [x, z] = spot(14), s = rr(1.1, 2.6); rocks.push([x, s * 0.45, z, s, s * 0.8, s * rr(0.8, 1.2), rr(0, 6.28)]); this.collider(x, z, s * 0.85); }
    for (let i = 0; i < N(400); i++) { const [x, z] = spot(0), w = rr(0.25, 0.8); pebbles.push([x, 0, z, w, w * 0.35, w * rr(0.7, 1.3), rr(0, 6.28)]); }
    this.inst(scene, ico, toonMat(th.rock), rocks, true);
    this.inst(scene, ico, toonMat(th.pebble), pebbles, false);
    // Árboles (llanuras y tierra ceniza) y ruinas
    const trunks = [], crowns = [], dead = [], pillars = [];
    for (let i = 0; i < 700 && trunks.length + dead.length < N(230); i++) {
      const [x, z] = spot(20), b = biomeAt(x, z);
      if (b === 1) { const h = rr(3.5, 6); trunks.push([x, h / 2, z, 0.35, h, 0.35, 0]); crowns.push([x, h + 1.1, z, rr(1.8, 2.8), rr(1.6, 2.4), rr(1.8, 2.8), rr(0, 6)]); this.collider(x, z, 0.5); }
      else if (b === 3 && rng() < 0.6) { const h = rr(3, 5); dead.push([x, h / 2, z, 0.3, h, 0.3, rr(0, 6)]); this.collider(x, z, 0.45); }
      else if (b === 3 && rng() < 0.5) { const h = rr(3, 8); pillars.push([x, h / 2, z, 1.1, h, 1.1, rr(0, 6)]); this.collider(x, z, 1.0); }
    }
    this.inst(scene, new THREE.CylinderGeometry(0.8, 1, 1, 6), toonMat(th.trunk), trunks, true);
    this.inst(scene, new THREE.IcosahedronGeometry(1, 1), toonMat(th.crown), crowns, true);
    this.inst(scene, new THREE.CylinderGeometry(0.6, 1, 1, 5), toonMat(th.dead), dead, true);
    this.inst(scene, new THREE.CylinderGeometry(0.85, 1, 1, 8), toonMat(th.pillar), pillars, true);
    // Cráteres y lagos (solo visuales)
    const flat = new THREE.CircleGeometry(1, 28);
    flat.rotateX(-Math.PI / 2);
    const craters = [], lakes = [];
    for (let i = 0; i < N(28); i++) { const [x, z] = spot(25), r = rr(5, 11); craters.push([x, 0.04, z, r, 1, r, 0]); }
    for (const l of this.lakes) lakes.push([l.x, 0.06, l.z, l.r, 1, l.r, 0]);
    this.inst(scene, flat, new THREE.MeshBasicMaterial({ color: th.crater, transparent: true, opacity: 0.55 }), craters, false);
    this.inst(scene, flat, new THREE.MeshBasicMaterial({ color: th.lake, transparent: true, opacity: 0.8 }), lakes, false);
    // Cristales destructibles: se rompen con el ki y sueltan experiencia y semillas
    const cr = [];
    for (let i = 0; i < N(80); i++) {
      const [x, z] = spot(16), s = rr(1.2, 1.9);
      cr.push([x, s * 1.1, z, s * 0.8, s * 1.4, s * 0.8, rr(0, 6)]);
      this.destr.push({ x, z, hp: 50, max: 50, col: this.cx.length, idx: i, s });
      this.collider(x, z, s * 0.8, i);
    }
    this.crystals = this.inst(scene, new THREE.OctahedronGeometry(1, 0), toonMat(th.crystal), cr, true);
    this.crystalPlace = cr;
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
  }

  /** Decorado con sprites (hojas props y tall): flora de Namek, estatuas y cajas en la Tierra, rocas moradas en la
      dimensión, volcanes en el Planeta Vegeta... Cajas, estatuas y rocas se rompen y sueltan premios (como los cristales) */
  buildSprites(scene, theme) {
    this.sp = []; this.volcs = [];
    const SH = FX_SHEETS;
    if (!SH || !SH.props || !SH.tall || !FXA.grass) return;
    const rng = this.rng, R = this.R, rr = (a, b) => a + rng() * (b - a), N = (c) => Math.max(2, Math.round(c * this.dens)), sc = R < 100 ? 0.3 : 1;
    const spot = (minD) => { for (let k = 0; k < 30; k++) { const x = rr(-R, R), z = rr(-R, R); if (Math.hypot(x, z) > minD * sc && !this.lakes.some((l) => Math.hypot(x - l.x, z - l.z) < l.r + 3)) return [x, z]; } return [R * 0.8, -R * 0.8]; };
    // name: animación · k: fotograma · size: alto en unidades · col: radio de choque · hp: vida si se rompe · brk: fotograma roto
    const add = (name, k, x, z, size, col, hp, brk, tall, rw) => {
      if (!FXA[name]) return { f: 0 };
      const o = { f: fxf(name, k), x, z, size, tall: !!tall, brk: brk === undefined ? -1 : brk, dead: false, flat: false, rw: rw || '' };
      if (col) {
        const di = hp ? this.destr.length : -1;
        if (hp) this.destr.push({ x, z, hp, max: hp, col: this.cx.length, idx: -1, s: col / 0.8, spr: this.sp.length });
        this.collider(x, z, col, di);
      }
      this.sp.push(o); return o;
    };
    const flat = (name, k, x, z, size) => { const o = add(name, k, x, z, size); o.flat = true; return o; };
    if (theme === 0) {                                       // Tierra · yermo: estatuas antiguas, cajas de suministros, matojos secos y grietas
      for (let i = 0; i < N(26); i++) { const [x, z] = spot(26); add('statue', i % 3, x, z, rr(3.4, 4.2), 1.1, 160); }
      for (let i = 0; i < N(60); i++) { const [x, z] = spot(18); add('crate', rng() < 0.5 ? 0 : 1, x, z, rr(2, 2.5), 0.9, 45, 3); }
      for (let i = 0; i < N(500); i++) { const [x, z] = spot(8); add('grass', 6 + (i & 1), x, z, rr(1.2, 1.8)); }
      // Hojas nuevas: cactus, rocas, palmeras, casas cápsula (se rompen y dan Zeni), cofres, puestos y la Capsule Corp.
      for (let i = 0; i < N(70); i++) { const [x, z] = spot(10); add('cactus', i % 3, x, z, rr(2.6, 3.6), 0.4); }
      for (let i = 0; i < N(60); i++) { const [x, z] = spot(12); add('rockS', i % 5, x, z, rr(2.2, 3.2), 0.9, 70); }
      for (let i = 0; i < N(34); i++) { const [x, z] = spot(18); add('palm', i % 4, x, z, rr(8.5, 11), 0.6, 0, -1, true); }
      for (let i = 0; i < N(12); i++) { const [x, z] = spot(30); add('house', i % 5, x, z, rr(6, 7.2), 2.4, 260, -1, false, 'house'); }
      for (let i = 0; i < N(14); i++) { const [x, z] = spot(20); add('chest', i & 1, x, z, 2.3, 0.8, 40, -1, false, 'chest'); }
      for (let i = 0; i < N(10); i++) { const [x, z] = spot(24); add(['stall', 'vending', 'sign', 'bench', 'tomb'][i % 5], i % 2, x, z, rr(3, 4), 0.9, 90, -1, false, 'vase'); }
      for (let i = 0; i < N(3); i++) { const [x, z] = spot(60); add('ccorp', 0, x, z, 14, 3.6, 0, -1, true); }
    } else if (theme === 1) {                                // Namek: árboles de copa azul y morada, arbustos y hierba
      for (let i = 0; i < N(110); i++) { const [x, z] = spot(20); add('treeN', i % 3, x, z, rr(8, 11), 1.2, 0, -1, true); }
      for (let i = 0; i < N(200); i++) { const [x, z] = spot(14); add('treeS', i % 12, x, z, rr(3.2, 4.6), 0.6); }
      for (let i = 0; i < N(900); i++) { const [x, z] = spot(6); add('grass', [1, 2, 3, 4][i % 4], x, z, rr(1.1, 1.7)); }
      for (let i = 0; i < N(12); i++) { const [x, z] = spot(18); add('crate', 0, x, z, 2.2, 0.9, 45, 3); }
      // Casas namekianas, la nave de Freezer, árboles de bola y plantas
      for (let i = 0; i < N(14); i++) { const [x, z] = spot(30); add('house', [1, 4, 3][i % 3], x, z, rr(6, 7), 2.3, 260, -1, false, 'house'); }
      for (let i = 0; i < N(3); i++) { const [x, z] = spot(50); add('ship', 0, x, z, 8, 3.2, 0); }
      for (let i = 0; i < N(50); i++) { const [x, z] = spot(16); add('ballTree', 0, x, z, rr(7, 9.5), 0.5, 0, -1, true); }
      for (let i = 0; i < N(70); i++) { const [x, z] = spot(10); add('nPlant', i & 1, x, z, rr(2.2, 3)); }
    } else if (theme === 2) {                                // Dimensión fracturada: rocas moradas que se rompen
      for (let i = 0; i < N(110); i++) { const [x, z] = spot(10); add('rockP', rng() < 0.6 ? 0 : 5, x, z, rr(2.4, 3.6), 1.1, 90, 7); }
      for (let i = 0; i < N(50); i++) { const [x, z] = spot(6); add('grass', 0, x, z, rr(1, 1.6)); }
      for (let i = 0; i < N(26); i++) { const [x, z] = spot(14); add('pillarS', i % 3, x, z, rr(3.4, 4.6), 0.9, 120, -1, false, 'vase'); }
      for (let i = 0; i < N(14); i++) { const [x, z] = spot(18); add('column', 0, x, z, rr(9, 11), 1.1, 0, -1, true); }
    } else if (theme === 3) {                                // Planeta Vegeta: volcanes en las afueras, cajas y suelo agrietado
      for (let i = 0; i < N(16); i++) {                     // repartidos por el mapa (siempre hay alguno a la vista)
        const [x, z] = spot(34);
        this.collider(x, z, 4.5, -1); this.volcs.push({ x, z, size: rr(11, 15), ph: rng() * 6, f: rng() < 0.5 ? 0 : 1 });
      }
      for (let i = 0; i < N(26); i++) { const [x, z] = spot(18); add('crate', 1, x, z, 2.3, 0.9, 45, 3); }
      for (let i = 0; i < N(22); i++) { const [x, z] = spot(24); add('rockT', i & 1, x, z, rr(8, 12), 2.2, 0, -1, true); }
      for (let i = 0; i < N(60); i++) { const [x, z] = spot(12); add('rockS', i % 5, x, z, rr(2.2, 3.2), 0.9, 70); }
      for (let i = 0; i < N(24); i++) { const [x, z] = spot(14); add('craterR', i % 3, x, z, rr(3, 4.2)); }
    } else {                                                 // Cámara del Tiempo: casi vacía (cajas, bloques y columnas)
      for (let i = 0; i < N(18); i++) { const [x, z] = spot(10); add('crate', 0, x, z, 2.2, 0.9, 45, 3); }
      for (let i = 0; i < N(10); i++) { const [x, z] = spot(12); add('arenaBlk', 0, x, z, rr(2.4, 3), 1.1, 120, -1, false, 'vase'); }
      for (let i = 0; i < N(8); i++) { const [x, z] = spot(16); add('vase', i & 1, x, z, 2.4, 0.7, 30, -1, false, 'vase'); }
    }
    const B = (sh, n, o) => new SpriteBatch(scene, Object.assign({ max: Math.max(1, n), texture: sh.tex, cols: sh.cols, rows: sh.rows, w: 1, h: 1, anchor: 0.04, cut: 0.5, renderOrder: 1 }, o));
    const cnt = (f) => this.sp.filter(f).length;
    this.spB = B(SH.props, cnt((o) => !o.tall && !o.flat));
    this.spT = B(SH.tall, cnt((o) => o.tall));
    this.spD = B(SH.props, cnt((o) => o.flat), { flat: true, anchor: 0.5, blend: true, alpha: 0.75, cut: 0.1, renderOrder: 0.5 });
    this.refreshSprites();
  }
  /** Vuelve a subir el decorado de sprites (al empezar y cada vez que se rompe algo) */
  refreshSprites() {
    if (!this.spB) return;
    this.spB.begin(); this.spT.begin(); this.spD.begin();
    for (const o of this.sp) {
      if (o.dead && o.brk < 0) continue;
      const b = o.flat ? this.spD : o.tall ? this.spT : this.spB;
      b.push(o.x, o.flat ? 0.08 : 0, o.z, o.dead ? fxf(o.brkName || 'crate', o.brk) : o.f, ((o.x * 7) | 0) & 1, 0, o.dead ? o.size * 0.8 : o.size, 1, 0xffffff);
    }
    this.spB.end(); this.spT.end(); this.spD.end();
  }

  buildGrid() {
    this.GC = 8; this.gHalf = this.R + 20; this.gCols = Math.ceil((this.gHalf * 2) / this.GC);
    this.gHead = new Int32Array(this.gCols * this.gCols).fill(-1);
    this.gNext = new Int32Array(this.cx.length);
    for (let i = 0; i < this.cx.length; i++) {
      const c = this.cellOf(this.cx[i], this.cz[i]);
      this.gNext[i] = this.gHead[c]; this.gHead[c] = i;
    }
  }
  cellOf(x, z) {
    const a = clamp(Math.floor((x + this.gHalf) / this.GC), 0, this.gCols - 1), b = clamp(Math.floor((z + this.gHalf) / this.GC), 0, this.gCols - 1);
    return b * this.gCols + a;
  }

  /** Saca (x,z) de los obstáculos cercanos. Resultado en this.px / this.pz (sin crear objetos) */
  push(x, z, rad) {
    const c = this.cellOf(x, z), cc = this.gCols, ca = c % cc, cb = (c / cc) | 0;
    for (let b = cb - 1; b <= cb + 1; b++) {
      if (b < 0 || b >= cc) continue;
      for (let a = ca - 1; a <= ca + 1; a++) {
        if (a < 0 || a >= cc) continue;
        for (let j = this.gHead[b * cc + a]; j !== -1; j = this.gNext[j]) {
          const r = this.cr[j] + rad;
          if (this.cr[j] <= 0) continue;
          const dx = x - this.cx[j], dz = z - this.cz[j], d2 = dx * dx + dz * dz;
          if (d2 < r * r) { const d = Math.sqrt(d2) || 0.001; x = this.cx[j] + (dx / d) * r; z = this.cz[j] + (dz / d) * r; }
        }
      }
    }
    this.px = x; this.pz = z;
  }

  /** Daño en área a los cristales. Devuelve true si rompió alguno (this.onBreak se llama por cada uno) */
  damageArea(x, z, r, dmg) {
    // Solo mira las celdas de la rejilla que toca el área (antes recorría todos los cristales en cada llamada)
    let hit = false;
    const cc = this.gCols, rc = Math.ceil((r + 2) / this.GC), c = this.cellOf(x, z), ca = c % cc, cb = (c / cc) | 0;
    for (let b = cb - rc; b <= cb + rc; b++) {
      if (b < 0 || b >= cc) continue;
      for (let a = ca - rc; a <= ca + rc; a++) {
        if (a < 0 || a >= cc) continue;
        for (let j = this.gHead[b * cc + a]; j !== -1; j = this.gNext[j]) {
          const k = this.cdest[j];
          if (k < 0) continue;
          const d = this.destr[k];
          if (d.hp <= 0) continue;
          const dx = d.x - x, dz = d.z - z, rr = r + d.s;
          if (dx * dx + dz * dz >= rr * rr) continue;
          hit = true;
          d.hp -= dmg;
          if (d.hp <= 0) {
            this.cr[d.col] = 0;
            if (d.spr !== undefined) {                              // decorado de sprites: se rompe (queda el resto) o desaparece
              const o = this.sp[d.spr]; o.dead = true; o.brkName = o.brk >= 0 ? this.brkName(o) : null; this.refreshSprites();
              if (this.onSprBreak) this.onSprBreak(o);
            } else {
              this.crystals.setMatrixAt(d.idx, this.zero);
              this.crystals.instanceMatrix.needsUpdate = true;
            }
            if (this.onBreak) this.onBreak(d.x, d.z);
          }
        }
      }
    }
    return hit;
  }

  /** Día y noche: n = 0 (día) .. 1 (noche cerrada). Oscurece luces, cielo y niebla (menos visibilidad) */
  setNight(n) {
    if (Math.abs(n - this.night) < 0.004) return;
    this.night = n;
    const th = this.th, scene = this.scene, NIGHT = 0x0b1030;
    scene.background.setHex(th.bg).lerp(this._c.setHex(NIGHT), n * 0.85);
    scene.fog.color.setHex(th.fog).lerp(this._c.setHex(NIGHT), n * 0.85);
    scene.fog.near = th.fogRange[0] * (1 - n * 0.6); scene.fog.far = th.fogRange[1] * (1 - n * 0.55);
    this.hemi.intensity = th.hemi[2] * (1 - n * 0.5);
    this.hemi.color.setHex(th.hemi[0]).lerp(this._c.setHex(0x8aa0ff), n * 0.6);
    this.sun.intensity = th.sun * (1 - n * 0.75);
  }

  /** Nombre de la animación de la que sale el fotograma «roto» de cada objeto */
  brkName(o) { for (const n of ['crate', 'rockP', 'statue']) if (FXA[n] && FXA[n].f.indexOf(o.f) >= 0) return n; return 'crate'; }
  /** Restaura los cristales (y cajas, estatuas y rocas) al empezar una partida */
  reset() {
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    if (this.sp && this.sp.length) { for (const o of this.sp) o.dead = false; this.refreshSprites(); }
    for (const d of this.destr) {
      d.hp = d.max; this.cr[d.col] = d.s * 0.8;
      if (d.spr !== undefined) continue;
      const o = this.crystalPlace[d.idx];
      q.setFromAxisAngle(up, o[6]); P.set(o[0], o[1] + groundH(o[0], o[2]), o[2]); S.set(o[3], o[4], o[5]);
      this.crystals.setMatrixAt(d.idx, M.compose(P, q, S));
    }
    this.crystals.instanceMatrix.needsUpdate = true;
  }

  /** El sol sigue al jugador a saltos de 6 unidades. Solo proyectan sombra los objetos fijos del mapa, así que el
      mapa de sombras únicamente hay que redibujarlo cuando el sol cambia de celda. Devuelve true si se movió */
  follow(x, z) {
    const sx = Math.round(x / 6) * 6, sz = Math.round(z / 6) * 6;
    if (sx === this.sunX && sz === this.sunZ) return false;
    this.sunX = sx; this.sunZ = sz;
    this.sun.position.set(sx + 14, 42, sz + 10); this.sun.target.position.set(sx, 0, sz);
    return true;
  }

  /** Imagen del mapa para el minimapa (biomas + lagos) */
  buildMinimap() {
    const N = 128, c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext && c.getContext('2d');
    this.mini = null;
    if (!g) return;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = ((i + 0.5) / N * 2 - 1) * this.R, z = ((j + 0.5) / N * 2 - 1) * this.R, w = biomeWeights(x, z);
      const v = [0, 1, 2].map((k) => Math.round(255 * (w[0] * BIOME_COL[0][k] + w[1] * BIOME_COL[1][k] + w[2] * BIOME_COL[2][k] + w[3] * BIOME_COL[3][k]) * 0.85));
      g.fillStyle = 'rgb(' + v[0] + ',' + v[1] + ',' + v[2] + ')';
      g.fillRect(i, j, 1, 1);
    }
    g.fillStyle = '#' + this.th.lake.toString(16).padStart(6, '0');
    for (const l of this.lakes) { g.beginPath(); g.arc((l.x / this.R + 1) / 2 * N, (l.z / this.R + 1) / 2 * N, l.r / this.R * N / 2, 0, 7); g.fill(); }
    this.mini = c;
  }
}
