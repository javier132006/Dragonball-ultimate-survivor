'use strict';
/* =====================================================================
   versus/view.js · Todo lo que se VE del Modo Versus (Three.js r128).
   Lee la simulación y sus eventos; nunca la modifica.
   - VsSprite: sprite 2D en billboard con shader propio (luz de la arena,
     luz de borde, emisión, destello de golpe) y sombra real proyectada.
   - VsArena: escenario 3D original (plataforma, pilares, cielo, luces).
   - VsParticles / VsBeam / aura: efectos de energía en una sola llamada
     de dibujo por tipo, con memoria reciclada (sin `new` por fotograma).
   - VsPost: bloom, desenfoque radial, aberración, viñeta.
   - VsCamera: cámara compartida que mantiene a los dos de perfil.
   ===================================================================== */
const VS_U = 0.056;                                  // unidades de mundo por píxel de hoja
const VS_TEX = {};
/** Textura de una hoja con filtro LINEAL y alfa premultiplicado (el shader la muestrea «nítida»: ver VSS_FS) */
function vsTexture(name) {
  if (VS_TEX[name]) return VS_TEX[name];
  return (VS_TEX[name] = new Promise((res) => {
    const d = window.SPRITE_DATA && SPRITE_DATA[name]; if (!d) { res(null); return; }
    const img = new Image();
    img.onload = () => { const t = new THREE.Texture(img); t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.premultiplyAlpha = true; t.needsUpdate = true; res({ tex: t, d, iw: img.width, ih: img.height }); };
    img.onerror = () => res(null); img.src = d.src;
  }));
}

/* ---------------- Sprite iluminado ---------------- */
const VSS_VS = `
uniform vec2 uSize; uniform vec2 uAnchor; uniform vec4 uRect; uniform vec3 uRight; uniform float uFlip; uniform float uRoll;
varying vec2 vUv; varying vec2 vQ;
void main() {
  vQ = uv;
  vec2 l = (uv - uAnchor) * uSize; float c = cos(uRoll), s = sin(uRoll); vec2 pv = vec2(0.0, uSize.y * (0.5 - uAnchor.y));
  l -= pv; l = vec2(l.x * c - l.y * s, l.x * s + l.y * c) + pv;                 // gira alrededor del centro del cuerpo
  vec3 w = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz + uRight * l.x + vec3(0.0, 1.0, 0.0) * l.y;
  vUv = uRect.xy + vec2(uFlip > 0.5 ? 1.0 - uv.x : uv.x, uv.y) * uRect.zw;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;
/* Muestreo «nítido»: dentro de cada píxel del sprite el color es plano y solo se mezcla en la frontera entre dos
   píxeles, y esa frontera mide exactamente un píxel de pantalla. Resultado: pixel art definido, sin dientes de
   sierra ni parpadeo al acercar, alejar o mover la cámara (lo que da el filtro «nearest» a escalas no enteras). */
const VSS_FS = `
uniform sampler2D map; uniform vec2 uTex; uniform vec4 uRect; uniform float uFlip;
uniform vec3 uAmb; uniform vec3 uKey; uniform vec2 uKeyDir; uniform vec3 uRim; uniform vec2 uRimDir;
uniform vec3 uTint; uniform vec3 uFlashCol; uniform float uFlash; uniform float uAlpha; uniform float uGhost;
varying vec2 vUv; varying vec2 vQ;
vec4 smp(vec2 uv) {
  vec2 px = uv * uTex, seam = floor(px + 0.5), fw = max(fwidth(px), vec2(1e-5));
  px = seam + clamp((px - seam) / fw, -0.5, 0.5);
  vec2 lo = uRect.xy * uTex + 0.5, hi = (uRect.xy + uRect.zw) * uTex - 0.5;       // sin sangrar a la celda vecina
  return texture2D(map, clamp(px, lo, hi) / uTex);
}
void main() {
  vec4 c = smp(vUv);
  if (c.a < 0.02) discard;
  // Normal «de silueta»: hacia dónde cae el alfa. Sirve para la luz de borde (el sprite no tiene volumen real)
  vec2 e = 1.6 / uTex;
  vec2 n = vec2(smp(vUv - vec2(e.x, 0.0)).a - smp(vUv + vec2(e.x, 0.0)).a, smp(vUv - vec2(0.0, e.y)).a - smp(vUv + vec2(0.0, e.y)).a);
  if (uFlip > 0.5) n.x = -n.x;
  float edge = clamp(length(n), 0.0, 1.0); vec2 nn = n / max(length(n), 1e-4);
  float ao = mix(0.74, 1.0, smoothstep(0.0, 0.4, vQ.y));                          // algo más oscuro hacia los pies
  vec3 base = c.rgb * uTint;
  vec3 lit = base * (uAmb + uKey * 0.55) * ao;
  lit += c.a * edge * uKey * 0.75 * max(0.0, dot(nn, uKeyDir));                   // borde iluminado por el sol
  lit += c.a * (edge * 1.5 * max(0.0, dot(nn, uRimDir) * 0.5 + 0.5) + 0.22) * uRim; // borde y baño de luz de la energía cercana
  lit = mix(lit, uFlashCol * c.a, uFlash);
  if (uGhost > 0.5) { float l = dot(c.rgb, vec3(0.34)); gl_FragColor = vec4(uTint * (0.35 + l) * c.a * uAlpha, 0.0); return; }
  gl_FragColor = vec4(lit, c.a) * uAlpha;
}`;
const VSS_DEPTH_FS = `
#include <packing>
uniform sampler2D map; varying vec2 vUv;
void main() { if (texture2D(map, vUv).a < 0.5) discard; gl_FragColor = packDepthToRGBA(gl_FragCoord.z); }`;
const VS_QUAD = new THREE.PlaneGeometry(1, 1).translate(0.5, 0.5, 0);    // uv = posición: 0..1

class VsSprite {
  constructor(scene, shadow) {
    const U = () => ({ map: { value: null }, uTex: { value: new THREE.Vector2(1, 1) }, uRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uSize: { value: new THREE.Vector2(1, 1) },
      uAnchor: { value: new THREE.Vector2(0.5, 0) }, uRight: { value: new THREE.Vector3(1, 0, 0) }, uFlip: { value: 0 }, uRoll: { value: 0 } });
    this.u = Object.assign(U(), { uAmb: { value: new THREE.Color(1, 1, 1) }, uKey: { value: new THREE.Color(0, 0, 0) }, uKeyDir: { value: new THREE.Vector2(0, 1) }, uRim: { value: new THREE.Color(0, 0, 0) },
      uRimDir: { value: new THREE.Vector2(1, 0) }, uTint: { value: new THREE.Color(1, 1, 1) }, uFlashCol: { value: new THREE.Color(1, 1, 1) }, uFlash: { value: 0 }, uAlpha: { value: 1 }, uGhost: { value: 0 } });
    this.mat = new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VSS_VS, fragmentShader: VSS_FS, transparent: true, depthWrite: !!shadow, blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, side: THREE.DoubleSide, extensions: { derivatives: true } });
    this.mesh = new THREE.Mesh(VS_QUAD, this.mat); this.mesh.frustumCulled = false; scene.add(this.mesh);
    if (shadow) {                                                    // sombra real: la silueta mirando al sol, no a la cámara
      this.du = U(); this.mesh.castShadow = true;
      this.mesh.customDepthMaterial = new THREE.ShaderMaterial({ uniforms: this.du, vertexShader: VSS_VS, fragmentShader: VSS_DEPTH_FS, side: THREE.DoubleSide });
    } else { this.mat.blendDst = THREE.OneFactor; this.u.uGhost.value = 1; }
  }
  setSheet(s) { this.s = s; for (const u of this.du ? [this.u, this.du] : [this.u]) { u.map.value = s.tex; u.uTex.value.set(s.iw, s.ih); } }
  /** Fotograma, volteo, giro y escala (sx, sy para estirar y aplastar) */
  pose(frame, flip, roll, sx, sy) {
    const d = this.s.d, cx = frame % d.cols, cy = (frame / d.cols) | 0;
    for (const u of this.du ? [this.u, this.du] : [this.u]) {
      u.uRect.value.set(cx / d.cols, 1 - (cy + 1) / d.rows, 1 / d.cols, 1 / d.rows);
      u.uSize.value.set(d.w * VS_U * (sx || 1), d.h * VS_U * (sy || 1)); u.uAnchor.value.set(0.5, d.anc || 0.03); u.uFlip.value = flip ? 1 : 0; u.uRoll.value = roll || 0;
    }
  }
}

/* ---------------- Partículas (una llamada de dibujo para todas) ---------------- */
const VSP_VS = `
attribute vec3 iPos; attribute vec4 iData; attribute vec3 iCol; attribute vec4 iAxis;
varying vec2 vP; varying vec3 vC; varying float vA; varying float vK;
void main() {
  vP = position.xy; vC = iCol; vA = iData.z; vK = iData.w; vec2 p = position.xy;
  if (iAxis.w < 0.0) { gl_Position = projectionMatrix * viewMatrix * vec4(iPos + vec3(p.x, 0.0, p.y) * iData.x, 1.0); return; }   // tumbada en el suelo
  vec4 mv = viewMatrix * vec4(iPos, 1.0);
  if (iAxis.w > 0.0) { vec2 a = normalize((viewMatrix * vec4(iAxis.xyz, 0.0)).xy + vec2(1e-5, 0.0)); p.x *= iAxis.w; p = vec2(a.x * p.x - a.y * p.y, a.y * p.x + a.x * p.y); }
  else { float c = cos(iData.y), s = sin(iData.y); p = vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
  mv.xy += p * iData.x; gl_Position = projectionMatrix * mv;
}`;
/* Formas dibujadas por fórmula (sin texturas): 0 resplandor · 1 anillo · 2 chispa alargada · 3 estrella · 4 humo · 5 disco de sombra */
const VSP_FS = `
varying vec2 vP; varying vec3 vC; varying float vA; varying float vK;
void main() {
  vec2 p = vP * 2.0; float r = length(p), a = 0.0;
  if (vK < 0.5) a = exp(-r * r * 4.5) * (1.0 - smoothstep(0.8, 1.0, r));
  else if (vK < 1.5) a = smoothstep(0.62, 0.84, r) * (1.0 - smoothstep(0.86, 1.0, r));
  else if (vK < 2.5) a = pow(max(0.0, 1.0 - abs(p.y)), 3.0) * pow(max(0.0, 1.0 - abs(p.x)), 0.6);
  else if (vK < 3.5) a = max(exp(-abs(p.x) * 16.0 - abs(p.y) * 2.2), exp(-abs(p.y) * 16.0 - abs(p.x) * 2.2)) + exp(-r * r * 9.0) * 0.8;
  else if (vK < 4.5) a = (1.0 - smoothstep(0.25, 1.0, r)) * 0.8;
  else a = (1.0 - smoothstep(0.1, 1.0, r));
  a *= vA; if (a < 0.004) discard;
  gl_FragColor = vec4(vC * a, a);
}`;
class VsParticles {
  constructor(scene, max, additive, order) {
    this.max = max; this.n = 0; this.list = [];
    const g = new THREE.InstancedBufferGeometry(), q = new THREE.PlaneGeometry(1, 1);
    g.index = q.index; g.setAttribute('position', q.attributes.position);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3); this.aData = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3); this.aAxis = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    for (const a of [this.aPos, this.aData, this.aCol, this.aAxis]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.aPos); g.setAttribute('iData', this.aData); g.setAttribute('iCol', this.aCol); g.setAttribute('iAxis', this.aAxis);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: VSP_VS, fragmentShader: VSP_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor,
      blendDst: additive ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = order; scene.add(this.mesh);
    this.pool = []; for (let i = 0; i < max; i++) this.pool.push({});
  }
  /** Partícula con vida propia. o: {vx,vy,vz,g,drag,s1,life,a,rot,vr,stretch,flat} */
  add(kind, x, y, z, size, col, o) {
    if (this.list.length >= this.max - 40) return null;
    const p = this.pool.pop() || {}; o = o || {};
    p.k = kind; p.x = x; p.y = y; p.z = z; p.s0 = size; p.s1 = o.s1 === undefined ? size : o.s1; p.c = col; p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0; p.g = o.g || 0; p.drag = o.drag || 0;
    p.life = o.life || 0.4; p.t = 0; p.a = o.a === undefined ? 1 : o.a; p.rot = o.rot || 0; p.vr = o.vr || 0; p.st = o.stretch || 0; p.flat = !!o.flat; p.bounce = !!o.bounce;
    this.list.push(p); return p;
  }
  /** Instancia de un solo fotograma (núcleos de esferas, destellos que siguen a algo) */
  now(kind, x, y, z, size, col, a, rot, ax) { this.put(kind, x, y, z, size, col, a, rot || 0, ax); }
  put(kind, x, y, z, size, col, a, rot, ax) {
    const i = this.n; if (i >= this.max) return; this.n++;
    this.aPos.array[i * 3] = x; this.aPos.array[i * 3 + 1] = y; this.aPos.array[i * 3 + 2] = z;
    this.aData.array[i * 4] = size; this.aData.array[i * 4 + 1] = rot; this.aData.array[i * 4 + 2] = a; this.aData.array[i * 4 + 3] = kind;
    this.aCol.array[i * 3] = ((col >> 16) & 255) / 255; this.aCol.array[i * 3 + 1] = ((col >> 8) & 255) / 255; this.aCol.array[i * 3 + 2] = (col & 255) / 255;
    const A = this.aAxis.array; if (ax) { A[i * 4] = ax[0]; A[i * 4 + 1] = ax[1]; A[i * 4 + 2] = ax[2]; A[i * 4 + 3] = ax[3]; } else A[i * 4 + 3] = 0;
  }
  update(dt) {
    const L = this.list, ax = [0, 0, 0, 0];
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i]; p.t += dt;
      if (p.t >= p.life) { L[i] = L[L.length - 1]; L.pop(); this.pool.push(p); continue; }
      const m = Math.max(0, 1 - p.drag * dt); p.vx *= m; p.vy = p.vy * m - p.g * dt; p.vz *= m; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.vr * dt;
      if (p.bounce && p.y < 0.08) { p.y = 0.08; p.vy = -p.vy * 0.4; p.vx *= 0.6; p.vz *= 0.6; }
      const f = p.t / p.life, s = p.s0 + (p.s1 - p.s0) * (1 - (1 - f) * (1 - f)), a = p.a * (1 - f * f);
      if (p.flat) { ax[3] = -1; this.put(p.k, p.x, p.y, p.z, s, p.c, a, 0, ax); }
      else if (p.st) { const v = Math.hypot(p.vx, p.vy, p.vz) || 1; ax[0] = p.vx / v; ax[1] = p.vy / v; ax[2] = p.vz / v; ax[3] = p.st; this.put(p.k, p.x, p.y, p.z, s, p.c, a, 0, ax); }
      else this.put(p.k, p.x, p.y, p.z, s, p.c, a, p.rot, null);
    }
  }
  flush() { this.geo.instanceCount = this.n; for (const a of [this.aPos, this.aData, this.aCol, this.aAxis]) a.needsUpdate = true; this.n = 0; }
}

/* ---------------- Rayo y aura (shaders procedurales) ---------------- */
const VS_NOISE = `
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { return vn(p) * 0.55 + vn(p * 2.1 + 3.7) * 0.3 + vn(p * 4.3 + 9.1) * 0.15; }`;
class VsBeam {
  constructor(scene) {
    this.u = { uA: { value: new THREE.Vector3() }, uDir: { value: new THREE.Vector3(1, 0, 0) }, uLen: { value: 1 }, uW: { value: 3 }, uCol: { value: new THREE.Color() }, uT: { value: 0 }, uPow: { value: 1 } };
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 24, 1).translate(0.5, 0, 0), new THREE.ShaderMaterial({ uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `uniform vec3 uA; uniform vec3 uDir; uniform float uLen; uniform float uW; varying vec2 vP;
        void main() { vP = vec2(position.x, position.y * 2.0); vec3 c = uA + uDir * position.x * uLen; vec3 side = normalize(cross(uDir, cameraPosition - c));
          gl_Position = projectionMatrix * viewMatrix * vec4(c + side * position.y * uW, 1.0); }`,
      fragmentShader: VS_NOISE + `uniform vec3 uCol; uniform float uT; uniform float uLen; uniform float uPow; varying vec2 vP;
        void main() { float x = vP.x * uLen, v = abs(vP.y);
          float wob = 0.86 + 0.14 * fbm(vec2(x * 0.35 - uT * 9.0, uT * 3.0));                      // el grosor «respira»
          float head = smoothstep(0.0, 2.6, (1.0 - vP.x) * uLen), tail = smoothstep(0.0, 1.2, x);   // punta redonda y arranque en las manos
          float w = wob * (0.25 + 0.75 * sqrt(head)) * tail;
          float core = 1.0 - smoothstep(0.12 * w, 0.42 * w, v), glow = exp(-pow(v / max(w, 0.01), 2.0) * 3.2);
          float streak = 0.75 + 0.25 * fbm(vec2(x * 0.9 - uT * 22.0, vP.y * 3.0));
          vec3 col = uCol * glow * streak * 0.9 + vec3(1.0) * core * 0.85;
          gl_FragColor = vec4(col * uPow, 1.0); }` }));
    this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.renderOrder = 8; scene.add(this.mesh);
  }
}
const VSAURA_FS = VS_NOISE + `
uniform vec3 uCol; uniform float uT; uniform float uPow; varying vec2 vQ;
void main() {
  vec2 p = vec2(vQ.x - 0.5, vQ.y);
  float n = fbm(vec2(p.x * 5.0, p.y * 3.4 - uT * 2.6)), n2 = fbm(vec2(p.x * 11.0 + 4.0, p.y * 7.0 - uT * 4.4));
  float w = mix(0.36, 0.05, pow(p.y, 0.75)) * (0.75 + 0.6 * n) * (0.6 + 0.4 * uPow);              // ancha abajo, lenguas arriba
  float body = (1.0 - smoothstep(w * 0.25, w, abs(p.x) + (n2 - 0.5) * 0.07)) * smoothstep(0.0, 0.07, p.y) * (1.0 - smoothstep(0.5 + 0.3 * n, 1.0, p.y));
  float core = (1.0 - smoothstep(0.0, w * 0.55, abs(p.x))) * (1.0 - smoothstep(0.1, 0.75, p.y));
  vec3 col = uCol * body * (0.4 + 0.5 * n2) + vec3(1.0) * core * body * 0.3;
  gl_FragColor = vec4(col * min(uPow, 1.2) * 0.85, 1.0);
}`;

/* ---------------- Arena (escenario original: «Coliseo de las Nubes») ---------------- */
const VS_ARENAS = {
  dia:    { name: 'Mediodía', top: 0x2a78dc, hor: 0xbfe6ff, sun: 0xfff2d6, sunI: 0.62, hemiS: 0xcfe6ff, hemiG: 0x6a5a48, hemiI: 0.42, dir: [-0.55, 0.8, 0.42], stone: 0xb8a98c, stars: 0 },
  ocaso:  { name: 'Atardecer', top: 0x33245e, hor: 0xff9455, sun: 0xffb46a, sunI: 0.7, hemiS: 0xffb89a, hemiG: 0x4a3340, hemiI: 0.34, dir: [-0.8, 0.42, 0.3], stone: 0xb89878, stars: 0.25 },
  noche:  { name: 'Noche', top: 0x04051a, hor: 0x26357a, sun: 0x9ab6ff, sunI: 0.5, hemiS: 0x5a6ec8, hemiG: 0x1a1a30, hemiI: 0.34, dir: [0.5, 0.75, 0.4], stone: 0x8088aa, stars: 1 }
};
class VsArena {
  constructor(scene, key, lowQ) {
    const P = this.P = VS_ARENAS[key] || VS_ARENAS.dia; this.grp = new THREE.Group(); scene.add(this.grp);
    scene.fog = new THREE.Fog(P.hor, 80, 300);
    // Cielo: degradado, halo del sol, bandas de nubes y estrellas (todo en el shader)
    this.skyU = { uTop: { value: new THREE.Color(P.top) }, uHor: { value: new THREE.Color(P.hor) }, uSun: { value: new THREE.Color(P.sun) }, uDir: { value: new THREE.Vector3(...P.dir).normalize() },
      uT: { value: 0 }, uDim: { value: 0 }, uStars: { value: P.stars }, uUlt: { value: new THREE.Color(0, 0, 0) } };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), new THREE.ShaderMaterial({ uniforms: this.skyU, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: VS_NOISE + `uniform vec3 uTop, uHor, uSun, uDir, uUlt; uniform float uT, uDim, uStars; varying vec3 vD;
        void main() { vec3 d = normalize(vD); float h = clamp(d.y, -0.2, 1.0);
          vec3 c = mix(uHor, uTop, pow(smoothstep(-0.05, 0.9, h), 0.6));
          float s = max(0.0, dot(d, uDir)); c += uSun * (pow(s, 220.0) * 1.4 + pow(s, 9.0) * 0.16);
          vec2 q = d.xz / (abs(d.y) + 0.22); float cl = fbm(q * 1.5 + vec2(uT * 0.012, 0.0)); cl = smoothstep(0.52, 0.8, cl) * smoothstep(0.0, 0.28, d.y);
          c = mix(c, mix(uHor, vec3(1.0), 0.55) * (0.8 + 0.35 * s), cl * 0.75);
          vec2 g = floor(d.xz / (abs(d.y) + 0.35) * 70.0); float st = step(0.994, h21(g)) * smoothstep(0.05, 0.4, d.y) * (0.6 + 0.4 * sin(uT * 3.0 + h21(g + 1.0) * 40.0)); c += vec3(st) * uStars * (1.0 - cl);
          c = mix(c, c * 0.16 + uUlt * (0.25 + 0.5 * pow(1.0 - abs(d.y), 3.0)), uDim);
          gl_FragColor = vec4(c, 1.0); }` }));
    this.grp.add(sky);
    this.hemi = new THREE.HemisphereLight(P.hemiS, P.hemiG, P.hemiI); this.grp.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(P.sun, P.sunI); sun.position.set(P.dir[0] * 70, P.dir[1] * 70, P.dir[2] * 70); sun.castShadow = true;
    const sc = sun.shadow.camera; sc.left = sc.bottom = -36; sc.right = sc.top = 36; sc.near = 10; sc.far = 160; sun.shadow.mapSize.set(lowQ ? 1024 : 2048, lowQ ? 1024 : 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    this.grp.add(sun); this.grp.add(sun.target);
    // Luces de energía: SIEMPRE existen (apagadas), así el shader de la arena no se recompila en mitad del combate
    this.glow = []; for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffffff, 0, 34, 2); this.grp.add(l); this.glow.push(l); }
    // Plataforma
    const tex = new THREE.CanvasTexture(this.floorCanvas(P)); tex.anisotropy = 8;
    const stone = (c, r) => new THREE.MeshStandardMaterial({ color: c, roughness: r === undefined ? 0.9 : r, metalness: 0.02, flatShading: true });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 72), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, metalness: 0.04 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.grp.add(floor);
    const col = new THREE.Color(P.stone), dark = col.clone().multiplyScalar(0.62), darker = col.clone().multiplyScalar(0.4);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(30.9, 30.9, 1.1, 72, 1, true), stone(col)); rim.position.y = -0.55; this.grp.add(rim);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(30.5, 0.45, 6, 72), stone(col.clone().multiplyScalar(1.08), 0.7)); lip.rotation.x = Math.PI / 2; lip.position.y = 0.05; lip.receiveShadow = true; this.grp.add(lip);
    const under = new THREE.Mesh(new THREE.ConeGeometry(30.9, 34, 14, 3), stone(dark)); under.rotation.x = Math.PI; under.position.y = -18.1; this.grp.add(under);
    const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    for (let i = 0; i < 12; i++) {                                       // pilares del borde: unos enteros, otros rotos
      const a = i / 12 * Math.PI * 2 + 0.13, h = rnd() < 0.3 ? 5 + rnd() * 5 : 16 + rnd() * 7, r = 47;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, h, 8), stone(col)); p.position.set(Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r); p.castShadow = true; p.rotation.z = (rnd() - 0.5) * 0.06; this.grp.add(p);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.0, 1.4, 8), stone(dark)); b.position.set(p.position.x, -0.6, p.position.z); this.grp.add(b);
      if (h > 12) { const c = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.1, 4.4), stone(col.clone().multiplyScalar(1.05))); c.position.set(p.position.x, h - 0.7, p.position.z); c.rotation.y = a; c.castShadow = true; this.grp.add(c); }
      const isl = new THREE.Mesh(new THREE.ConeGeometry(4.4, 12, 6, 1), stone(darker)); isl.rotation.x = Math.PI; isl.position.set(p.position.x, -7.2, p.position.z); this.grp.add(isl);
    }
    this.rocks = [];                                                      // rocas flotando alrededor
    for (let i = 0; i < 26; i++) {
      const a = rnd() * 6.283, r = 62 + rnd() * 90, s = 1.5 + rnd() * 6;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), stone(rnd() < 0.5 ? dark : darker)); m.position.set(Math.cos(a) * r, -14 + rnd() * 46, Math.sin(a) * r); m.scale.y = 0.6 + rnd() * 0.9;
      m.userData = { y: m.position.y, p: rnd() * 6.28, v: 0.2 + rnd() * 0.4 }; this.grp.add(m); this.rocks.push(m);
    }
    for (let i = 0; i < 16; i++) {                                        // montañas lejanas, medio hundidas en la niebla
      const a = i / 16 * 6.283 + rnd() * 0.3, r = 210 + rnd() * 50, h = 60 + rnd() * 90;
      const m = new THREE.Mesh(new THREE.ConeGeometry(34 + rnd() * 30, h, 5, 1), stone(darker)); m.position.set(Math.cos(a) * r, h / 2 - 62, Math.sin(a) * r); m.rotation.y = rnd() * 3; this.grp.add(m);
    }
    this.dim = 0; this.ultCol = new THREE.Color(0, 0, 0);
  }
  /** Textura del suelo dibujada en un lienzo: losas en anillos, cenefas y un emblema geométrico propio en el centro */
  floorCanvas(P) {
    const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), m = S / 2, col = new THREE.Color(P.stone);
    const css = (k) => '#' + col.clone().multiplyScalar(k).getHexString();
    g.fillStyle = css(0.92); g.fillRect(0, 0, S, S);
    const rings = [0.99, 0.9, 0.74, 0.56, 0.38, 0.2]; let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let r = 0; r < rings.length - 1; r++) {                          // losas: cada anillo con su número de piezas y un tono algo distinto por losa
      const r0 = rings[r] * m, r1 = rings[r + 1] * m, n = [44, 36, 28, 20, 12][r];
      for (let i = 0; i < n; i++) {
        const a0 = i / n * 6.2832 + r * 0.31, a1 = (i + 1) / n * 6.2832 + r * 0.31;
        g.beginPath(); g.arc(m, m, r0, a0, a1); g.arc(m, m, r1, a1, a0, true); g.closePath(); g.fillStyle = css(0.84 + rnd() * 0.2); g.fill(); g.lineWidth = 3; g.strokeStyle = css(0.52); g.stroke();
      }
    }
    for (const [r, w, k] of [[0.9, 12, 0.5], [0.56, 9, 0.5], [0.2, 8, 0.45]]) { g.beginPath(); g.arc(m, m, r * m, 0, 6.2832); g.lineWidth = w; g.strokeStyle = css(k); g.stroke(); }
    g.beginPath(); g.arc(m, m, 0.2 * m, 0, 6.2832); g.fillStyle = css(1.04); g.fill();
    g.save(); g.translate(m, m);                                          // emblema: estrella de ocho puntas dentro de dos aros
    for (const [n, R, r, k] of [[8, 0.17, 0.075, 0.5], [8, 0.12, 0.05, 1.12]]) { g.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * 6.2832, q = (i % 2 ? r : R) * m; g.lineTo(Math.cos(a) * q, Math.sin(a) * q); } g.closePath(); g.fillStyle = css(k); g.fill(); }
    g.beginPath(); g.arc(0, 0, 0.03 * m, 0, 6.2832); g.fillStyle = css(0.45); g.fill(); g.restore();
    for (let i = 0; i < 70; i++) {                                        // grietas y manchas: que no parezca recién pulido
      let x = rnd() * S, y = rnd() * S; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 46; y += (rnd() - 0.5) * 46; g.lineTo(x, y); }
      g.lineWidth = 1 + rnd() * 1.5; g.strokeStyle = 'rgba(40,30,30,' + (0.12 + rnd() * 0.22) + ')'; g.stroke();
    }
    for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(' + (rnd() < 0.5 ? '0,0,0,' : '255,255,255,') + (0.02 + rnd() * 0.05) + ')'; g.beginPath(); g.arc(rnd() * S, rnd() * S, 4 + rnd() * 26, 0, 6.2832); g.fill(); }
    return c;
  }
  /** dim 0-1: en las Ultimates el escenario se oscurece y se tiñe del color del ki */
  update(dt, t, dim, col) {
    this.dim += (dim - this.dim) * Math.min(1, dt * 7); if (col) this.ultCol.setHex(col);
    const P = this.P, k = 1 - 0.82 * this.dim;
    this.sun.intensity = P.sunI * k; this.hemi.intensity = P.hemiI * (1 - 0.7 * this.dim);
    this.skyU.uT.value = t; this.skyU.uDim.value = this.dim; this.skyU.uUlt.value.copy(this.ultCol);
    for (const r of this.rocks) { r.position.y = r.userData.y + Math.sin(t * r.userData.v + r.userData.p) * 1.6; r.rotation.y += dt * 0.05 * r.userData.v; }
  }
}

/* ---------------- Post-procesado propio (sin librerías externas) ---------------- */
const VSPOST_VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
class VsPost {
  constructor(renderer) {
    this.r = renderer; this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); this.scene = new THREE.Scene();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null); this.quad.frustumCulled = false; this.scene.add(this.quad);
    const M = (fs, u) => new THREE.ShaderMaterial({ uniforms: u, vertexShader: VSPOST_VS, fragmentShader: fs, depthTest: false, depthWrite: false });
    this.uB = { t: { value: null }, uThr: { value: 0.86 } };
    this.mBright = M('uniform sampler2D t; uniform float uThr; varying vec2 vUv; void main() { vec3 c = texture2D(t, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(uThr, uThr + 0.3, l), 1.0); }', this.uB);
    this.uL = { t: { value: null }, d: { value: new THREE.Vector2() } };
    this.mBlur = M('uniform sampler2D t; uniform vec2 d; varying vec2 vUv; void main() { vec3 c = texture2D(t, vUv).rgb * 0.227; c += (texture2D(t, vUv + d * 1.385).rgb + texture2D(t, vUv - d * 1.385).rgb) * 0.316;' +
      ' c += (texture2D(t, vUv + d * 3.23).rgb + texture2D(t, vUv - d * 3.23).rgb) * 0.0703; gl_FragColor = vec4(c, 1.0); }', this.uL);
    this.uC = { t: { value: null }, b1: { value: null }, b2: { value: null }, uBloom: { value: 0.9 }, uBlur: { value: 0 }, uChroma: { value: 0 }, uVig: { value: 0.32 }, uFlash: { value: 0 }, uSat: { value: 1 },
      uCenter: { value: new THREE.Vector2(0.5, 0.5) } };
    this.mComp = M(`uniform sampler2D t, b1, b2; uniform float uBloom, uBlur, uChroma, uVig, uFlash, uSat; uniform vec2 uCenter; varying vec2 vUv;
      void main() { vec2 d = vUv - uCenter; vec3 c;
        if (uBlur > 0.001) { c = vec3(0.0); for (int i = 0; i < 8; i++) { float k = 1.0 - uBlur * float(i) / 8.0 * dot(d, d) * 2.2; c += texture2D(t, uCenter + d * k).rgb; } c /= 8.0; }   // desenfoque radial: sensación de velocidad
        else c = texture2D(t, vUv).rgb;
        if (uChroma > 0.001) { c.r = texture2D(t, vUv + d * uChroma).r; c.b = texture2D(t, vUv - d * uChroma).b; }
        c += (texture2D(b1, vUv).rgb * 0.55 + texture2D(b2, vUv).rgb * 0.75) * uBloom;
        float l = dot(c, vec3(0.3, 0.59, 0.11)); c = mix(vec3(l), c, uSat);
        c *= 1.0 - uVig * dot(d, d) * 2.0; c += uFlash;
        gl_FragColor = vec4(c, 1.0); }`, this.uC);
    this.size = new THREE.Vector2(); this.resize();
  }
  resize() {
    const s = this.r.getDrawingBufferSize(this.size), w = Math.max(2, s.x | 0), h = Math.max(2, s.y | 0);
    if (this.w === w && this.h === h) return; this.w = w; this.h = h; this.dispose();
    const o = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: false };
    // Con WebGL2 la escena se dibuja en un destino con multimuestreo: se conserva el antialiasing aunque haya post-procesado
    this.rt = this.r.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget ? new THREE.WebGLMultisampleRenderTarget(w, h, Object.assign({}, o, { depthBuffer: true })) : new THREE.WebGLRenderTarget(w, h, Object.assign({}, o, { depthBuffer: true }));
    if (this.rt.samples !== undefined) this.rt.samples = 4;
    this.h1 = new THREE.WebGLRenderTarget(w >> 1, h >> 1, o); this.h2 = new THREE.WebGLRenderTarget(w >> 1, h >> 1, o);
    this.q1 = new THREE.WebGLRenderTarget(w >> 3, h >> 3, o); this.q2 = new THREE.WebGLRenderTarget(w >> 3, h >> 3, o);
  }
  dispose() { for (const k of ['rt', 'h1', 'h2', 'q1', 'q2']) if (this[k]) { this[k].dispose(); this[k] = null; } }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.scene, this.cam); }
  render(scene, camera) {
    const r = this.r; this.resize();
    r.setRenderTarget(this.rt); r.clear(); r.render(scene, camera);
    this.uB.t.value = this.rt.texture; this.pass(this.mBright, this.h1);
    const blur = (src, tmp, dst, n) => { for (let i = 0; i < n; i++) { this.uL.t.value = (i ? dst : src).texture; this.uL.d.value.set(1 / tmp.width, 0); this.pass(this.mBlur, tmp); this.uL.t.value = tmp.texture; this.uL.d.value.set(0, 1 / tmp.height); this.pass(this.mBlur, dst); } };
    blur(this.h1, this.h2, this.h1, 2);                                  // halo corto
    this.uB.t.value = this.h1.texture; const thr = this.uB.uThr.value; this.uB.uThr.value = 0; this.pass(this.mBright, this.q1); this.uB.uThr.value = thr;
    blur(this.q1, this.q2, this.q1, 2);                                  // halo ancho
    this.uC.t.value = this.rt.texture; this.uC.b1.value = this.h1.texture; this.uC.b2.value = this.q1.texture; this.pass(this.mComp, null);
  }
}

/* ---------------- Cámara compartida ---------------- */
class VsCamera {
  constructor() { this.cam = new THREE.PerspectiveCamera(40, 1, 0.5, 900); this.ang = -Math.PI / 2; this.pos = new THREE.Vector3(0, 6, -24); this.look = new THREE.Vector3(0, 2, 0); this.trauma = 0; this.t = 0; this.fov = 40; this.cine = null; this.kick = 0; }
  shake(a) { this.trauma = Math.min(1.3, Math.max(this.trauma, a)); }
  /** Plano de cine: fn(k 0-1, pos, look) → fov. Mientras dura manda sobre la cámara de combate */
  play(dur, fn) { this.cine = { t: 0, dur, fn }; }
  update(dt, sim, snap) {
    const a = sim.f[0], b = sim.f[1]; this.t += dt;
    let want = Math.atan2(sim.cz, sim.cx), d = want - this.ang; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    this.ang += d * Math.min(1, dt * 4.5);
    const nx = Math.cos(this.ang), nz = Math.sin(this.ang), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + 1.9, mz = (a.z + b.z) / 2;
    const sep = Math.hypot(b.x - a.x, b.z - a.z), dy = Math.abs(b.y - a.y), dist = Math.max(11, Math.min(46, 7.5 + sep * 0.74 + dy * 0.95));
    let fov = 40, k = snap ? 1 : Math.min(1, dt * 5.5); const P = VsCamera.P, L = VsCamera.L;
    P.set(mx + nx * dist, my + 0.6 + dist * 0.1, mz + nz * dist); L.set(mx, my + 0.3, mz);
    const pr = Math.hypot(P.x, P.z); if (pr > 42) { P.x *= 42 / pr; P.z *= 42 / pr; fov = Math.min(56, 40 + (pr - 42) * 0.9); }
    if (this.cine) {
      const c = this.cine; c.t += dt; const f = Math.min(1, c.t / c.dur); fov = c.fn(f, P, L) || 40; k = Math.min(1, dt * 14);
      if (c.t >= c.dur) this.cine = null;
    }
    this.pos.lerp(P, k); this.look.lerp(L, k); this.fov += (fov - this.kick * 5 - this.fov) * Math.min(1, dt * 9); this.kick = Math.max(0, this.kick - dt * 5);
    const c = this.cam; c.position.copy(this.pos);
    if (c.position.y < 0.6) c.position.y = 0.6;
    if (this.trauma > 0) {                                                // temblor por «trauma²»: los golpes flojos casi no mueven, los fuertes sacuden
      const s = this.trauma * this.trauma, t = this.t * 31;
      c.position.x += (Math.sin(t) + Math.sin(t * 2.3 + 1.7)) * 0.3 * s; c.position.y += (Math.sin(t * 1.3 + 4.1) + Math.sin(t * 2.9)) * 0.3 * s; c.position.z += Math.sin(t * 1.7 + 2.2) * 0.3 * s;
      this.trauma = Math.max(0, this.trauma - dt * 2.2);
    }
    c.lookAt(this.look); if (Math.abs(c.fov - this.fov) > 0.01) { c.fov = this.fov; c.updateProjectionMatrix(); }
    c.updateMatrixWorld();
  }
}
VsCamera.P = new THREE.Vector3(); VsCamera.L = new THREE.Vector3();
