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
const BIOME_COL = [[0.86, 0.7, 0.52], [0.5, 0.72, 0.42], [0.82, 0.45, 0.32], [0.58, 0.55, 0.58]];
const BIOME_NAMES = ['YERMO', 'LLANURA', 'CAÑÓN', 'TIERRA CENIZA'];
const _bw = [0, 0, 0, 0];
/** Pesos de cada bioma en (x,z). El centro del mapa siempre es yermo. */
function biomeWeights(x, z) {
  const a = noise2(x * 0.011, z * 0.011, 1), b = noise2(x * 0.017 + 7, z * 0.017 - 3, 2), far = sm(18, 60, Math.hypot(x, z));
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
  constructor(scene) {
    this.R = CFG.ARENA;
    this.rng = seeded(20241103);
    scene.background = new THREE.Color(0xf2b676);
    scene.fog = new THREE.Fog(0xf0b878, 90, 330);
    scene.add(new THREE.HemisphereLight(0xfff0d0, 0x8a5a30, 0.45));
    // Luz cenital con sombras suaves: sigue al jugador para mantener la sombra nítida
    this.sun = new THREE.DirectionalLight(0xfff4e0, 0.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 140;
    this.sun.shadow.bias = -0.0006;
    scene.add(this.sun, this.sun.target);

    // Colisiones estáticas (rejilla de celdas de 8 unidades)
    this.cx = []; this.cz = []; this.cr = []; this.cdest = [];
    this.destr = [];                       // cristales destructibles: {x,z,hp,col,idx}
    this.lakes = [];
    this.px = 0; this.pz = 0;              // resultado de push()
    this.buildGround(scene);
    this.buildProps(scene);
    this.buildGrid();
    this.buildMinimap();
  }

  buildGround(scene) {
    const S = (this.R + 90) * 2, geo = new THREE.PlaneGeometry(S, S, 150, 150);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const w = biomeWeights(p.getX(i), p.getZ(i));
      for (let c = 0; c < 3; c++) col[i * 3 + c] = w[0] * BIOME_COL[0][c] + w[1] * BIOME_COL[1][c] + w[2] * BIOME_COL[2][c] + w[3] * BIOME_COL[3][c];
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const tex = this.makeGroundTexture();
    const ground = new THREE.Mesh(geo, toonMat(0xffffff, Object.assign({ vertexColors: true }, tex ? { map: tex } : {})));
    ground.receiveShadow = true;
    scene.add(ground);
  }

  makeGroundTexture() {
    const S = 256, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext && c.getContext('2d');
    if (!g) return null;
    g.fillStyle = '#e4d8c8';
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
    list.forEach((o, i) => { q.setFromAxisAngle(up, o[6] || 0); P.set(o[0], o[1], o[2]); Sc.set(o[3], o[4], o[5]); m.setMatrixAt(i, M.compose(P, q, Sc)); });
    m.count = list.length;
    m.castShadow = m.receiveShadow = !!shadow;
    scene.add(m);
    return m;
  }

  collider(x, z, r, dest) { this.cx.push(x); this.cz.push(z); this.cr.push(r); this.cdest.push(dest === undefined ? -1 : dest); }

  buildProps(scene) {
    const rng = this.rng, R = this.R, rr = (a, b) => a + rng() * (b - a);
    const spot = (minD) => { for (let k = 0; k < 20; k++) { const x = rr(-R, R), z = rr(-R, R); if (Math.hypot(x, z) > minD) return [x, z]; } return [R * 0.9, R * 0.9]; };
    const cyl = new THREE.CylinderGeometry(0.62, 1, 1, 7), ico = new THREE.IcosahedronGeometry(1, 0);
    // Mesetas por bioma (rojas en el cañón, grises en la tierra ceniza, ocres en el resto)
    const mesas = [[], [], []], MC = [0xa87a46, 0xa0482a, 0x6d6a70];
    for (let i = 0; i < 90; i++) {
      const [x, z] = spot(30), b = biomeAt(x, z), k = b === 2 ? 1 : b === 3 ? 2 : 0, w = rr(3, 6.5), h = rr(9, 26);
      mesas[k].push([x, h / 2 - 0.5, z, w, h, w, rr(0, 6.28)]);
      this.collider(x, z, w * 0.82);
    }
    mesas.forEach((l, k) => { if (l.length) this.inst(scene, cyl, toonMat(MC[k]), l, true); });
    // Muralla de mesetas gigantes fuera del mapa (oculta el borde)
    const rim = [];
    for (let i = 0; i < 130; i++) { const a = rr(0, 6.28), d = R + rr(8, 80), w = rr(8, 18), h = rr(24, 70); rim.push([Math.cos(a) * d, h / 2 - 0.5, Math.sin(a) * d, w, h, w, rr(0, 6.28)]); }
    this.inst(scene, cyl, toonMat(0x8f5a34), rim, false);
    // Rocas grandes (con colisión) y guijarros decorativos
    const rocks = [], pebbles = [];
    for (let i = 0; i < 150; i++) { const [x, z] = spot(14), s = rr(1.1, 2.6); rocks.push([x, s * 0.45, z, s, s * 0.8, s * rr(0.8, 1.2), rr(0, 6.28)]); this.collider(x, z, s * 0.85); }
    for (let i = 0; i < 400; i++) { const [x, z] = spot(0), w = rr(0.25, 0.8); pebbles.push([x, 0, z, w, w * 0.35, w * rr(0.7, 1.3), rr(0, 6.28)]); }
    this.inst(scene, ico, toonMat(0x9a6a44), rocks, true);
    this.inst(scene, ico, toonMat(0xa8693a), pebbles, false);
    // Árboles (llanuras y tierra ceniza) y ruinas
    const trunks = [], crowns = [], dead = [], pillars = [];
    for (let i = 0; i < 700 && trunks.length + dead.length < 230; i++) {
      const [x, z] = spot(20), b = biomeAt(x, z);
      if (b === 1) { const h = rr(3.5, 6); trunks.push([x, h / 2, z, 0.35, h, 0.35, 0]); crowns.push([x, h + 1.1, z, rr(1.8, 2.8), rr(1.6, 2.4), rr(1.8, 2.8), rr(0, 6)]); this.collider(x, z, 0.5); }
      else if (b === 3 && rng() < 0.6) { const h = rr(3, 5); dead.push([x, h / 2, z, 0.3, h, 0.3, rr(0, 6)]); this.collider(x, z, 0.45); }
      else if (b === 3 && rng() < 0.5) { const h = rr(3, 8); pillars.push([x, h / 2, z, 1.1, h, 1.1, rr(0, 6)]); this.collider(x, z, 1.0); }
    }
    this.inst(scene, new THREE.CylinderGeometry(0.8, 1, 1, 6), toonMat(0x7a5232), trunks, true);
    this.inst(scene, new THREE.IcosahedronGeometry(1, 1), toonMat(0x3f9a4a), crowns, true);
    this.inst(scene, new THREE.CylinderGeometry(0.6, 1, 1, 5), toonMat(0x4a3b32), dead, true);
    this.inst(scene, new THREE.CylinderGeometry(0.85, 1, 1, 8), toonMat(0x9a9aa2), pillars, true);
    // Cráteres y lagos (solo visuales)
    const flat = new THREE.CircleGeometry(1, 28);
    flat.rotateX(-Math.PI / 2);
    const craters = [], lakes = [];
    for (let i = 0; i < 28; i++) { const [x, z] = spot(25), r = rr(5, 11); craters.push([x, 0.04, z, r, 1, r, 0]); }
    for (let i = 0; i < 9; i++) { const [x, z] = spot(45), r = rr(10, 24); lakes.push([x, 0.06, z, r, 1, r, 0]); this.lakes.push({ x, z, r }); }
    this.inst(scene, flat, new THREE.MeshBasicMaterial({ color: 0x4a3626, transparent: true, opacity: 0.55 }), craters, false);
    this.inst(scene, flat, new THREE.MeshBasicMaterial({ color: 0x3ea6e8, transparent: true, opacity: 0.8 }), lakes, false);
    // Cristales destructibles: se rompen con el ki y sueltan experiencia y semillas
    const cr = [];
    for (let i = 0; i < 80; i++) {
      const [x, z] = spot(16), s = rr(1.2, 1.9);
      cr.push([x, s * 1.1, z, s * 0.8, s * 1.4, s * 0.8, rr(0, 6)]);
      this.destr.push({ x, z, hp: 50, max: 50, col: this.cx.length, idx: i, s });
      this.collider(x, z, s * 0.8, i);
    }
    this.crystals = this.inst(scene, new THREE.OctahedronGeometry(1, 0), toonMat(0x9fe0ff), cr, true);
    this.crystalPlace = cr;
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
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
    let hit = false;
    for (let i = 0; i < this.destr.length; i++) {
      const d = this.destr[i];
      if (d.hp <= 0) continue;
      const dx = d.x - x, dz = d.z - z, rr = r + d.s;
      if (dx * dx + dz * dz < rr * rr) {
        hit = true;
        d.hp -= dmg;
        if (d.hp <= 0) {
          this.cr[d.col] = 0;
          this.crystals.setMatrixAt(d.idx, this.zero);
          this.crystals.instanceMatrix.needsUpdate = true;
          if (this.onBreak) this.onBreak(d.x, d.z);
        }
      }
    }
    return hit;
  }

  /** Restaura los cristales al empezar una partida */
  reset() {
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (const d of this.destr) {
      d.hp = d.max; this.cr[d.col] = d.s * 0.8;
      const o = this.crystalPlace[d.idx];
      q.setFromAxisAngle(up, o[6]); P.set(o[0], o[1], o[2]); S.set(o[3], o[4], o[5]);
      this.crystals.setMatrixAt(d.idx, M.compose(P, q, S));
    }
    this.crystals.instanceMatrix.needsUpdate = true;
  }

  follow(x, z) { this.sun.position.set(x + 14, 42, z + 10); this.sun.target.position.set(x, 0, z); }

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
    g.fillStyle = '#3ea6e8';
    for (const l of this.lakes) { g.beginPath(); g.arc((l.x / this.R + 1) / 2 * N, (l.z / this.R + 1) / 2 * N, l.r / this.R * N / 2, 0, 7); g.fill(); }
    this.mini = c;
  }
}
