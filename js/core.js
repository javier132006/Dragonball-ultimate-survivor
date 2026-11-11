'use strict';
/* =====================================================================
   DRAGON BALL: ULTIMATE SURVIVOR  ·  core.js
   Configuración, entrada, utilidades, texturas pixel art, sprites 2D
   instanciados (SpriteBatch) y partículas. Sin dependencias del juego.
   ===================================================================== */

const CFG = {
  ARENA: 220,              // semilado del mapa (±ARENA): 440x440 unidades
  MAX_ENEMIES: 450, MAX_BULLETS: 160, MAX_ORBS: 400,
  CELL: 4,                 // celda de la rejilla espacial de enemigos
  PLAYER_R: 0.6, ENEMY_R: 0.7,
  DASH_COST: 20, DASH_TIME: 0.2, DASH_SPEED: 42, DASH_CD: 0.55,
  CHARGE_TIME_SCALE: 0.55  // el mundo va más lento mientras cargas Ki
};

/* ---------- Entrada: objeto global de estado (evita key-ghosting) ---------- */
const keys = {};
const BLOCKED = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
window.addEventListener('keydown', (e) => { if (BLOCKED.has(e.code)) e.preventDefault(); keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

/** Técnica que está haciendo daño ahora mismo (para la gráfica de daño por técnica) */
let DMG_SRC = 'otros';

/* ---------- Utilidades ---------- */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
/** Generador pseudoaleatorio con semilla: el mapa es siempre el mismo */
function seeded(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hexToRgb = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

/** Gradiente de 4 tonos para el cel-shading del terreno */
const Shared = { toon: null };
function initShared() {
  const tex = new THREE.DataTexture(new Uint8Array([90, 150, 215, 255]), 4, 1, THREE.LuminanceFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  Shared.toon = tex;
}
const toonMat = (color, extra) => new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: Shared.toon }, extra || {}));

/* ---------- Texturas pixel art procedurales ---------- */
/** fn(x,y,w,h) devuelve [r,g,b,a] o null (transparente) */
function pixelTex(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext && c.getContext('2d');
  let tex;
  if (g && g.createImageData) {
    const id = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = fn(x, y, w, h), o = (y * w + x) * 4;
      if (p) { id.data[o] = p[0]; id.data[o + 1] = p[1]; id.data[o + 2] = p[2]; id.data[o + 3] = p[3]; }
    }
    g.putImageData(id, 0, 0);
    tex = new THREE.CanvasTexture(c);
  } else {
    tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
    tex.needsUpdate = true;
  }
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

function makeTextures() {
  const STARS = [[6, 6], [4, 4], [8, 4], [4, 8], [8, 8], [6, 3], [6, 9]];
  return {
    spark: pixelTex(2, 2, () => [255, 255, 255, 255]),
    ki: pixelTex(16, 16, (x, y, w) => {
      const r = Math.hypot(x + 0.5 - w / 2, y + 0.5 - w / 2) / (w / 2);
      return r < 0.3 ? [255, 255, 255, 255] : r < 0.55 ? [235, 235, 235, 255] : r < 0.8 ? [185, 185, 185, 230] : r < 1 ? [110, 110, 110, 160] : null;
    }),
    gem: pixelTex(9, 9, (x, y) => {
      const d = Math.abs(x - 4) + Math.abs(y - 4);
      return d <= 1 ? [255, 255, 255, 255] : d <= 3 ? [190, 190, 190, 255] : d === 4 ? [90, 90, 90, 255] : null;
    }),
    shadow: pixelTex(16, 8, (x, y, w, h) => {
      const dx = (x + 0.5 - w / 2) / (w / 2), dy = (y + 0.5 - h / 2) / (h / 2), d = dx * dx + dy * dy;
      return d < 0.5 ? [0, 0, 0, 255] : d < 1 && ((x + y) & 1) ? [0, 0, 0, 255] : null;
    }),
    ring: pixelTex(48, 48, (x, y, w) => {
      const r = Math.hypot(x + 0.5 - w / 2, y + 0.5 - w / 2) / (w / 2);
      return r >= 0.88 && r < 1 ? [255, 255, 255, 255] : r < 0.88 && r > 0.5 && ((x + y) & 1) ? [255, 255, 255, 90] : null;
    }),
    senzu: pixelTex(8, 8, (x, y) => {
      const dx = x - 3.5, dy = y - 3.5, e = Math.pow(dx + dy * 0.6, 2) / 9 + Math.pow(dy - dx * 0.6, 2) / 4;
      return e < 1 ? (e < 0.4 ? [190, 245, 100, 255] : [80, 165, 45, 255]) : null;
    }),
    /* Cápsula de Capsule Corp: atlas de 3 fotogramas (normal roja/blanca, dorada y maldita) */
    capsule: pixelTex(48, 16, (x, y) => {
      const f = Math.floor(x / 16), lx = x % 16;
      const inl = (a, b) => {
        if (a < 0 || a > 15 || b < 0 || b > 15) return false;
        const dx = a + 0.5 - 8, yy = b + 0.5;
        return yy < 5.5 ? Math.hypot(dx, yy - 5.5) <= 4 : yy > 10.5 ? Math.hypot(dx, yy - 10.5) <= 4 : Math.abs(dx) <= 4;
      };
      if (!inl(lx, y)) return null;
      if (!inl(lx - 1, y) || !inl(lx + 1, y) || !inl(lx, y - 1) || !inl(lx, y + 1)) return [30, 20, 20, 255];
      if (y === 8) return [40, 30, 30, 255];
      const top = y < 8, hi = lx <= 6;
      if (f === 2) return top ? (hi ? [210, 130, 255, 255] : [120, 36, 190, 255]) : (hi ? [150, 110, 190, 255] : [70, 40, 110, 255]);
      if (f) return top ? (hi ? [255, 240, 120, 255] : [255, 190, 30, 255]) : (hi ? [255, 250, 215, 255] : [245, 215, 120, 255]);
      return top ? (hi ? [255, 110, 100, 255] : [215, 40, 40, 255]) : (hi ? [255, 255, 255, 255] : [215, 220, 230, 255]);
    }),
    poi: makePoiTexture(),
    /* Esferas del Dragón: atlas de 7 fotogramas (1 a 7 estrellas) */
    dball: pixelTex(84, 12, (x, y) => {
      const f = (x / 12) | 0, lx = x % 12, r = Math.hypot(lx + 0.5 - 6, y + 0.5 - 6);
      if (r >= 5.6) return null;
      for (let i = 0; i <= f; i++) {
        const s = STARS[i];
        if ((lx === s[0] || lx === s[0] - 1) && (y === s[1] || y === s[1] - 1)) return [190, 30, 30, 255];
      }
      return r < 2.6 && lx < 6 && y < 6 ? [255, 235, 130, 255] : r < 4.4 ? [255, 165, 35, 255] : [205, 95, 10, 255];
    })
  };
}

/** Carga un spritesheet desde window.SPRITE_DATA (assets/sprites.js en base64: funciona con doble clic) */
/** Rectángulo útil (con píxeles visibles) de cada fotograma de una hoja, en una textura de 1 fila (RGBA = x0, y0, x1, y1
    en 1/255 de la casilla; y desde abajo). Los sprites se dibujan solo sobre ese rectángulo: la GPU no pinta el relleno
    transparente de cada casilla (los enemigos usan un 30% de su casilla; con 450 en pantalla era casi todo el trabajo) */
function sheetRects(img, cols, rows) {
  const W = img.width, H = img.height, cw = W / cols, ch = H / rows, n = cols * rows;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
  const px = cx.getImageData(0, 0, W, H).data, out = new Uint8Array(n * 4);
  for (let f = 0; f < n; f++) {
    const c = f % cols, r = (f / cols) | 0, X0 = Math.round(c * cw), Y0 = Math.round(r * ch), X1 = Math.round((c + 1) * cw), Y1 = Math.round((r + 1) * ch);
    let x0 = X1, y0 = Y1, x1 = X0 - 1, y1 = Y0 - 1;
    for (let y = Y0; y < Y1; y++) {
      const row = y * W * 4;
      for (let x = X0; x < X1; x++) if (px[row + x * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; y1 = y; }
    }
    const o = f * 4;
    if (x1 < x0) { out[o] = out[o + 1] = 0; out[o + 2] = out[o + 3] = 255; continue; }   // casilla vacía: se deja entera
    // 1 píxel de margen y redondeo hacia fuera (que nunca se recorte nada visible)
    const fx0 = (x0 - 1 - X0) / (X1 - X0), fx1 = (x1 + 2 - X0) / (X1 - X0), fy0 = (Y1 - (y1 + 2)) / (Y1 - Y0), fy1 = (Y1 - (y0 - 1)) / (Y1 - Y0);
    out[o] = Math.max(0, Math.floor(fx0 * 255)); out[o + 1] = Math.max(0, Math.floor(fy0 * 255));
    out[o + 2] = Math.min(255, Math.ceil(fx1 * 255)); out[o + 3] = Math.min(255, Math.ceil(fy1 * 255));
  }
  const t = new THREE.DataTexture(out, n, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return { tex: t, n };
}
const NO_RECTS = new THREE.DataTexture(new Uint8Array([0, 0, 255, 255]), 1, 1, THREE.RGBAFormat);
NO_RECTS.needsUpdate = true;
function loadSheet(name) {
  return new Promise((resolve) => {
    const d = window.SPRITE_DATA && window.SPRITE_DATA[name];
    if (!d) { resolve(null); return; }
    const img = new Image();
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.magFilter = tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;
      if (d.cols * d.rows > 1) tex.rects = sheetRects(img, d.cols, d.rows);
      resolve({ tex, cols: d.cols, rows: d.rows, w: d.w, h: d.h, hs: d.hs, anc: d.anc });   // hs/anc: hojas de carga (celda más alta)
    };
    img.onerror = () => resolve(null);
    img.src = d.src;
  });
}
/** Carga todas las hojas. `onEach(hechas, total)` avisa del progreso (pantalla de carga) */
function loadSheets(names, onEach) {
  let n = 0;
  return Promise.all(names.map((nm) => loadSheet(nm).then((s) => { n++; if (onEach) onEach(n, names.length); return s; })))
    .then((list) => { const out = {}; names.forEach((nm, i) => { out[nm] = list[i]; }); return out; });
}

/* ---------- Mapa de alturas compartido (relieve del terreno) ----------
   world.js escribe aquí la altura de cada celda; los sprites la leen en el shader
   y se apoyan en el suelo sin recalcular nada en JavaScript. */
const HM = { N: 256, EXT: 640, MIN: -3, RANGE: 12 };      // 256x256 celdas sobre 640 unidades; alturas de -3 a 9
HM.data = new Uint8Array(HM.N * HM.N * 4);
HM.tex = new THREE.DataTexture(HM.data, HM.N, HM.N, THREE.RGBAFormat);
HM.tex.minFilter = HM.tex.magFilter = THREE.LinearFilter;
HM.tex.wrapS = HM.tex.wrapT = THREE.ClampToEdgeWrapping;
HM.tex.needsUpdate = true;
const HM_UNIFORMS = {
  uHMap: { value: HM.tex }, uHO: { value: new THREE.Vector2(-HM.EXT / 2, -HM.EXT / 2) },
  uHS: { value: HM.EXT }, uHR: { value: new THREE.Vector2(HM.MIN, HM.RANGE) }
};

/* ---------- SpriteBatch: billboards instanciados con atlas (1 draw call) ---------- */
const SPRITE_VS = `
attribute vec4 iPos;    // xyz: pies del sprite en el mundo, w: opacidad
attribute vec4 iData;   // x: fotograma, y: volteo (0/1), z: destello blanco, w: escala
attribute vec3 iCol;    // tinte por instancia
attribute float iRot;   // giro en el plano del sprite (radianes): rayos, tajos y grietas orientados
uniform vec2 uGrid; uniform vec2 uSize; uniform float uAnchor; uniform float uFlat;
uniform sampler2D uHMap; uniform vec2 uHO; uniform float uHS; uniform vec2 uHR;
uniform sampler2D uRects; uniform float uRectN;
varying vec2 vUv; varying float vFlash; varying float vAlpha; varying vec3 vCol;
void main() {
  float col = mod(iData.x, uGrid.x);
  float row = floor(iData.x / uGrid.x);
  // Recorte al rectángulo útil del fotograma (u, v: posición dentro de la casilla, v desde abajo)
  vec4 rc = vec4(0.0, 0.0, 1.0, 1.0);
  if (uRectN > 0.5) rc = texture2D(uRects, vec2((clamp(iData.x, 0.0, uRectN - 1.0) + 0.5) / uRectN, 0.5));
  float u = mix(rc.x, rc.z, uv.x), v = mix(rc.y, rc.w, uv.y);
  float su = mix(u, 1.0 - u, iData.y);                  // volteado: el quad se refleja, la textura no
  vUv = vec2((col + u) / uGrid.x, 1.0 - (row + 1.0 - v) / uGrid.y);
  vFlash = iData.z; vAlpha = iPos.w; vCol = iCol;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  if (uFlat > 0.5) { right = vec3(1.0, 0.0, 0.0); up = vec3(0.0, 0.0, -1.0); }
  float s = iData.w;
  // Altura del terreno bajo el sprite (mapa de alturas en la GPU)
  float ground = texture2D(uHMap, clamp((iPos.xz - uHO) / uHS, 0.0, 1.0)).r * uHR.y + uHR.x;
  vec2 o = vec2((su - 0.5) * uSize.x, (v - uAnchor) * uSize.y) * s;
  float cr = cos(iRot), sr = sin(iRot);
  o = vec2(o.x * cr - o.y * sr, o.x * sr + o.y * cr);
  vec3 wp = iPos.xyz + vec3(0.0, ground, 0.0) + right * o.x + up * o.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const SPRITE_FS = `
uniform sampler2D uMap; uniform vec3 uTint; uniform float uAlpha; uniform float uCut;
varying vec2 vUv; varying float vFlash; varying float vAlpha; varying vec3 vCol;
void main() {
  vec4 c = texture2D(uMap, vUv);
  if (c.a < uCut) discard;
  vec3 rgb = mix(c.rgb * uTint * vCol, vec3(1.0), vFlash * 0.85);
  gl_FragColor = vec4(rgb, c.a * uAlpha * vAlpha);
}`;

/** Uso por frame: begin() -> push(...) -> end(). Opciones: texture, cols, rows, w, h, anchor, tint, alpha, cut, additive, blend, flat, renderOrder */
class SpriteBatch {
  constructor(scene, o) {
    this.max = o.max; this.count = 0;
    const base = new THREE.PlaneGeometry(1, 1);
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.setIndex(base.index);
    this.geo.setAttribute('position', base.attributes.position);
    this.geo.setAttribute('uv', base.attributes.uv);
    this.pos = new Float32Array(o.max * 4); this.data = new Float32Array(o.max * 4); this.col = new Float32Array(o.max * 3);
    this.aPos = new THREE.InstancedBufferAttribute(this.pos, 4); this.aData = new THREE.InstancedBufferAttribute(this.data, 4);
    this.aCol = new THREE.InstancedBufferAttribute(this.col, 3);
    this.rot = new Float32Array(o.max); this.aRot = new THREE.InstancedBufferAttribute(this.rot, 1); this.rotUsed = false;
    for (const a of [this.aPos, this.aData, this.aCol, this.aRot]) a.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('iPos', this.aPos); this.geo.setAttribute('iData', this.aData); this.geo.setAttribute('iCol', this.aCol); this.geo.setAttribute('iRot', this.aRot);
    this.geo.instanceCount = 0;
    const soft = !!(o.additive || o.blend);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: SPRITE_VS, fragmentShader: SPRITE_FS,
      uniforms: {
        uMap: { value: o.texture },
        uGrid: { value: new THREE.Vector2(o.cols || 1, o.rows || 1) },
        uSize: { value: new THREE.Vector2(o.w || 1, o.h || 1) },
        uAnchor: { value: o.anchor || 0 }, uFlat: { value: o.flat ? 1 : 0 },
        uTint: { value: new THREE.Color(o.tint !== undefined ? o.tint : 0xffffff) },
        uAlpha: { value: o.alpha !== undefined ? o.alpha : 1 }, uCut: { value: o.cut !== undefined ? o.cut : 0.5 },
        uRects: { value: NO_RECTS }, uRectN: { value: 0 },
        ...HM_UNIFORMS
      },
      transparent: soft, depthWrite: !soft, side: THREE.DoubleSide,
      blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    this.setSheet(o.texture, o.cols || 1, o.rows || 1);
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    if (o.noDepth) this.mat.depthTest = false;                 // efectos grandes: el suelo no los corta por la mitad
    this.mesh.renderOrder = o.renderOrder || 0;
    scene.add(this.mesh);
  }
  /** Cambia la hoja del lote (textura y rejilla); usa sus rectángulos útiles si los tiene */
  setSheet(tex, cols, rows) {
    const u = this.mat.uniforms, R = tex && tex.rects;
    u.uMap.value = tex; u.uGrid.value.set(cols, rows);
    const ok = R && R.n === cols * rows;
    u.uRects.value = ok ? R.tex : NO_RECTS; u.uRectN.value = ok ? R.n : 0;
  }
  setTint(hex) { this.mat.uniforms.uTint.value.setHex(hex); }
  begin() { this.count = 0; }
  push(x, y, z, frame, flip, flash, scale, alpha, tint, rot) {
    if (this.count >= this.max) return;
    const i = this.count++, p = i * 4, c = i * 3;
    if (rot || this.rot[i]) { this.rot[i] = rot || 0; this.rotUsed = true; }       // el giro solo se sube a la GPU si alguien lo usa
    this.pos[p] = x; this.pos[p + 1] = y; this.pos[p + 2] = z; this.pos[p + 3] = alpha === undefined ? 1 : alpha;
    this.data[p] = frame; this.data[p + 1] = flip; this.data[p + 2] = flash; this.data[p + 3] = scale;
    if (tint === undefined) { this.col[c] = this.col[c + 1] = this.col[c + 2] = 1; }
    else { this.col[c] = ((tint >> 16) & 255) / 255; this.col[c + 1] = ((tint >> 8) & 255) / 255; this.col[c + 2] = (tint & 255) / 255; }
  }
  end() {
    const n = this.count;
    this.geo.instanceCount = n;
    // Lote vacío: no se dibuja nada, no hay nada que subir a la GPU
    // (ojo: en WebGL2 un rango de longitud 0 significa «hasta el final», así que ni se intenta)
    if (n === 0) { this.rotUsed = false; return; }
    // Solo se suben a la GPU las instancias usadas (antes se subía el buffer entero, hasta 1200 sprites por lote, cada cuadro)
    this.aPos.updateRange.count = this.aData.updateRange.count = n * 4; this.aCol.updateRange.count = n * 3;
    this.aPos.needsUpdate = this.aData.needsUpdate = this.aCol.needsUpdate = true;
    if (this.rotUsed) { this.aRot.updateRange.count = n; this.aRot.needsUpdate = true; this.rotUsed = false; }
  }
  reset() { this.count = 0; this.geo.instanceCount = 0; }
}

/* ---------- Partículas (pool en anillo, cuadrados de píxel, color por partícula) ---------- */
class ParticleSystem {
  constructor(scene, max, color, alpha, tex) {
    this.max = max; this.cursor = 0; this.def = color;
    const f = () => new Float32Array(max);
    this.px = f(); this.py = f(); this.pz = f(); this.vx = f(); this.vy = f(); this.vz = f();
    this.life = f(); this.maxLife = f(); this.size = f(); this.grav = f(); this.tint = new Int32Array(max);
    this.batch = new SpriteBatch(scene, { max, texture: tex, w: 1, h: 1, anchor: 0.5, additive: true, alpha, cut: 0.02, renderOrder: 6 });
  }
  setColor(hex) { this.def = hex; }
  emit(x, y, z, vx, vy, vz, life, size, grav, tint) {
    const i = this.cursor;
    this.cursor = (i + 1) % this.max;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z; this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.life[i] = life; this.maxLife[i] = life; this.size[i] = size; this.grav[i] = grav || 0;
    this.tint[i] = tint === undefined ? this.def : tint;
  }
  update(dt) {
    const b = this.batch;
    b.begin();
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) continue;
      this.vy[i] -= this.grav[i] * dt;
      this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt; this.pz[i] += this.vz[i] * dt;
      if (this.py[i] < 0.05) { this.py[i] = 0.05; this.vy[i] *= -0.4; this.vx[i] *= 0.8; this.vz[i] *= 0.8; }
      b.push(this.px[i], this.py[i], this.pz[i], 0, 0, 0, this.size[i] * (this.life[i] / this.maxLife[i]), 1, this.tint[i]);
    }
    b.end();
  }
  reset() { this.life.fill(0); this.batch.reset(); }
}

class FX {
  constructor(scene, tex) {
    this.sparks = new ParticleSystem(scene, 600, 0xffe066, 1.0, tex.spark);
    this.aura = new ParticleSystem(scene, 500, 0xfff2b0, 0.85, tex.spark);
    this.trail = new ParticleSystem(scene, 240, 0x7fe8ff, 0.5, tex.spark);
    this.gore = new ParticleSystem(scene, 300, 0xc0392b, 0.95, tex.spark);
    this.all = [this.sparks, this.aura, this.trail, this.gore];
    this.q = 1;                                   // calidad: en BAJA se emiten la mitad de partículas en ráfagas y anillos
    this.load = 1;                                // carga: con la horda muy grande se emiten menos (lo fija Game.update)
  }
  burst(sys, x, y, z, n, speed, life, size, grav, tint) {
    n = Math.max(1, Math.round(n * this.q * this.load));
    for (let i = 0; i < n; i++) {
      const u = rand(-1, 1), phi = rand(0, Math.PI * 2), r = Math.sqrt(1 - u * u), s = speed * rand(0.35, 1);
      sys.emit(x, y, z, r * Math.cos(phi) * s, u * s * 0.8 + speed * 0.25, r * Math.sin(phi) * s, life * rand(0.6, 1), size * rand(0.6, 1.2), grav || 0, tint);
    }
  }
  ring(sys, x, y, z, n, speed, life, size, tint) {
    n = Math.max(3, Math.round(n * this.q * this.load));
    const o = rand(0, 6.28);
    for (let i = 0; i < n; i++) {
      const a = o + (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      sys.emit(x + c, y, z + s, c * speed, 0.3, s * speed, life, size, 0, tint);
    }
  }
  update(dt) { for (let i = 0; i < 4; i++) this.all[i].update(dt); }
  reset() { for (let i = 0; i < 4; i++) this.all[i].reset(); }
}
