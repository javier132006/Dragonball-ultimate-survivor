'use strict';
/* =====================================================================
   zmoves.js · Técnicas animadas de Z Legends 3 (assets/zl3/m, tools/make_zl3_moves.py).
   - ZMoves: descarga bajo demanda el paquete de cada luchador (tabla + páginas del atlas)
     y arma «planes»: la secuencia completa de una Ultimate o de una técnica, partida en
     carga (antes de soltar la energía) y lanzamiento.
   - ZMoveSprite: un sprite suelto con recorte libre del atlas (cada fotograma tiene su
     tamaño y su punto de apoyo), para Supervivencia.
   En el Versus se dibuja con el VsSprite del luchador (versus.js, poseRect).
   Los fotogramas están a tamaño de píxel del juego: 52,3 px = 3,6 unidades (como las hojas z_).
   ===================================================================== */
const ZM_U = 3.6 / 52.3;                       // unidades del mundo por píxel (Supervivencia)
/* Ultimate de cada luchador: partes en orden. Si no está aquí, la primera técnica cuyo nombre empieza por «Ultimate».
   orb: esfera gigante (fx) que crece sobre la cabeza mientras dura la parte `on` (nombre del paquete fx y de la animación) */
const ZM_ULT = {
  goku: { parts: ['Special_EveryoneLendMeYourEnergy', 'Ultimate_SuperSpiritBomb'], orb: { a: 'esferadekigigante:Goku', on: 0, hold: 1.1, s: [0.04, 0.62], d: 0.3 } },
  gokussj: { parts: ['Ultimate_MeteorSmash_Pt1', 'Ultimate_MeteorSmash_Pt2', 'Ultimate_MeteorSmash_Pt3', 'Ultimate_MeteorSmash_Final'] },
  freezer: { parts: ['Ultimate_DeathBall'], orb: { a: 'esferadekigigante:DeathBall', on: 0, hold: 0.9, s: [0.1, 1.25], d: 0.2 } },
  beerus: { parts: ['Ultimate_BeerusBallOfDestruction'] },
  gohanssj2: { parts: ['UltimateAttack_FatherSonKamehameha_Pt1', 'UltimateAttack_FatherSonKamehameha_Pt2', 'UltimateAttack_FatherSonKamehameha_Pt3', 'UltimateAttack_FatherSonKamehameha_Final'] },
  gohanbeast: { parts: ['Ultimate_UltraMakankoSappo_Pt1', 'Ultimate_UltraMakankoSappo_Pt2', 'Ultimate_UltraMakankoSappo_Pt3', 'Ultimate_UltraMakankoSappo_Pt4', 'Ultimate_UltraMakankoSappo_Pt5', 'Ultimate_UltraMakankoSappo_Pt6', 'Ultimate_UltraMakankoSappo_Pt7'] },
  gogetablue: { parts: ['Ultimate_UltimateKamehameha_Pt1', 'Ultimate_UltimateKamehameha_Pt2', 'Ultimate_UltimateKamehameha_Pt3', 'Ultimate_UltimateKamehameha_Pt4', 'Ultimate_UltimateKamehameha_Pt5', 'Ultimate_UltimateKamehameha_Final'] },
  gogetassj4: { parts: ['Special_x100BigBangKamehameha_Pt1', 'Special_x100BigBangKamehameha_Pt2', 'Special_x100BigBangKamehameha_Pt3', 'Special_x100BigBangKamehameha_Final'] },
  vegetassj: { parts: ['Special_FinalFlash_Pt1', 'Special_FinalFlash_Pt2', 'Special_FinalFlash_Pt3', 'Special_FinalFlash_Final'] },
  baby: { parts: ['Special_RevengeDeathBall'] }
};
/* Técnica de energía de cada luchador (pose de carga del ki cargado del Versus y de las técnicas de Supervivencia):
   la primera cuyo nombre encaja, en este orden */
const ZM_BEAM = /kamehame|galick|finalflash|masenko|makanko|beamcannon|cannon|energywave|deathbeam|wave|ray|flash|blast|ball|sphere/i;

const ZMoves = {
  D: {}, img: {}, pend: {}, tx: {}, cimg: {},
  /** El paquete del luchador llega (lo llama assets/zl3/m/<id>.js) */
  add(cid, d) { this.D[cid] = d; const r = this.pend[cid]; if (r && r.ok) r.ok(); },
  has(cid) { return cid === 'fx' || !!(cid && window.ZMOVE_LIST && ZMOVE_LIST.includes(cid)); },
  /** Descarga tabla y páginas (una vez). Devuelve una promesa que se cumple cuando todo está listo para dibujar */
  load(cid) {
    if (!this.has(cid)) return Promise.resolve(false);
    if (this.pend[cid]) return this.pend[cid].p;
    const r = this.pend[cid] = {};
    r.p = new Promise((ok) => {
      r.ok = () => {
        const d = this.D[cid], L = [];
        for (let i = 0; i < d.p; i++) L.push(new Promise((res) => {
          const im = new Image(); im.decoding = 'async';
          im.onload = () => res(im); im.onerror = () => res(null); im.src = av('assets/zl3/m/' + cid + '_' + i + '.webp');
        }));
        const T = window.ZMOVE_T && ZMOVE_T[cid];
        if (T && T.C) L.push(new Promise((res) => { const im = new Image(); im.onload = () => { this.cimg[cid] = im; res(true); }; im.onerror = () => res(true); im.src = av('assets/zl3/m/c_' + cid + '.webp'); }));   // paneles de cinemática
        Promise.all(L).then((ims) => { ims = ims.filter((x) => x !== true); this.img[cid] = ims; ok(!ims.some((x) => !x)); });
      };
      const s = document.createElement('script'); s.src = av('assets/zl3/m/' + cid + '.js'); s.onerror = () => ok(false); document.head.appendChild(s);
    });
    return r.p;
  },
  ready(cid) { return !!(this.img[cid] && this.img[cid].length && !this.img[cid].some((x) => !x)); },
  /** Textura de una página: 'n' píxel duro (Supervivencia) · 'v' para el VsSprite (lineal, alfa premultiplicado) */
  tex(cid, pg, kind) {
    const k = cid + '_' + pg + kind; if (this.tx[k]) return this.tx[k];
    const im = this.img[cid] && this.img[cid][pg]; if (!im) return null;
    const t = new THREE.Texture(im); t.generateMipmaps = false; t.needsUpdate = true;
    if (kind === 'v') { t.magFilter = t.minFilter = THREE.LinearFilter; t.premultiplyAlpha = true; } else t.magFilter = t.minFilter = THREE.NearestFilter;
    return (this.tx[k] = kind === 'v' ? { tex: t, iw: im.width, ih: im.height, d: { cols: 1, rows: 1, w: im.width, h: im.height } } : t);
  },
  /** Plan: fotogramas seguidos de las partes, con su instante. rel = índice del primer fotograma «de lanzamiento» */
  plan(cid, parts, minLoop) {
    const d = this.D[cid]; if (!d) return null;
    const F = []; let t = 0;
    for (const n of parts) {
      const a = d.a[n]; if (!a) continue;
      const one = () => { for (const f of a.f) { const dt = (f[7] || 1) / (a.fps || 12); F.push({ pg: f[0], x: f[1], y: f[2], w: f[3], h: f[4], ax: f[5], ay: f[6], px: f[8], py: f[9], t0: t, t1: t + dt, part: n }); t += dt; } };
      const t0 = t; one();
      if (a.l) while (t - t0 < (minLoop || 0.5)) one();            // las partes en bucle (el rayo saliendo) duran al menos medio segundo
    }
    if (!F.length) return null;
    let rel = F.findIndex((f) => f.w > d.iw * 1.9 || f.h > d.ih * 1.6);   // la energía sale: el fotograma se ensancha
    if (rel < 0) rel = Math.max(1, Math.round(F.length * 0.6));
    return { cid, F, dur: t, rel, relT: F[rel].t0, parts };
  },
  /** Plan de la Ultimate del luchador (o null) */
  ultPlan(cid) {
    const d = this.D[cid]; if (!d) return null;
    const o = ZM_ULT[cid];
    let parts = o && o.parts;
    if (!parts) { const k = Object.keys(d.g).find((n) => /^Ultimate/.test(n)); parts = k ? d.g[k] : null; }
    if (!parts) return null;
    const P = this.plan(cid, parts, 0.7); if (!P) return null;
    if (o && o.orb) {                                               // la esfera crece: el último fotograma de esa parte se mantiene `hold` s
      P.orb = o.orb; const on = parts[o.orb.on], k = P.F.map((f) => f.part).lastIndexOf(on), H = o.orb.hold || 0;
      if (k >= 0 && H) { P.F[k].t1 += H; for (let i = k + 1; i < P.F.length; i++) { P.F[i].t0 += H; P.F[i].t1 += H; } P.dur += H; if (P.rel > k) P.relT += H; }
    }
    return P;
  },
  /** Plan que encaja con el NOMBRE de una Ultimate del juego («KAMEHAMEHA», «FINAL FLASH»…). Si ninguna técnica se llama así, su Ultimate */
  planFor(cid, name) {
    const d = this.D[cid]; if (!d) return null;
    const N = (x) => String(x || '').normalize('NFD').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const n = N(name).replace('genkidama', 'spiritbomb').replace('kienzan', 'destructodisc').replace('rayodelamuerte', 'deathbeam').replace('bolademuerte', 'deathball').replace('makankosappo', 'makanko').replace('disco', 'disc').replace('barrera', 'barrier').replace('espada', 'sword').replace('esfera', 'sphere');
    const toks = ['spiritbomb', 'kamehameha', 'galick', 'finalflash', 'masenko', 'makanko', 'deathball', 'deathbeam', 'bigbang', 'hakai', 'destructodisc', 'hellzone', 'burning', 'meteor', 'cannon', 'breaker', 'justice', 'lightning', 'excalibur', 'sword', 'saucer', 'nova', 'magnetron', 'revenge', 'disc', 'barrier', 'powerblitz', 'sphere', 'shining', 'galaxybreaker']
      .filter((t) => n.includes(t));
    const o = ZM_ULT[cid];
    if (o && o.parts && toks.some((t) => N(o.parts.join()).includes(t))) return this.ultPlan(cid);
    let best = null, bs = -1;
    for (const g in d.g) {
      const gn = N(g); if (!toks.some((t) => gn.includes(t))) continue;
      const fr = d.g[g].reduce((a, k) => a + ((d.a[k] && d.a[k].f.length) || 0), 0);
      const sc = fr + (/^ultimate/.test(gn) ? 1000 : 0) + (/super|full|ultra|x100|final/.test(gn) ? 200 : 0) - (/kaioken/.test(gn) && !n.includes('kaioken') ? 600 : 0);
      if (sc > bs) { bs = sc; best = g; }
    }
    return best ? this.plan(cid, d.g[best], 0.7) : this.ultPlan(cid);
  },
  /** Plan de su técnica de energía (o null) */
  beamPlan(cid) {
    const d = this.D[cid]; if (!d) return null;
    const k = Object.keys(d.g).find((n) => /^Special_/.test(n) && ZM_BEAM.test(n.replace(/_/g, '')));
    return k ? this.plan(cid, d.g[k], 0.3) : null;
  },
  /** Fotograma del plan a los t segundos (el último se queda) */
  at(P, t) { const F = P.F; let lo = 0, hi = F.length - 1; if (t >= F[hi].t0) return F[hi]; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (F[m].t0 <= t) lo = m; else hi = m - 1; } return F[lo]; },
  /** Fotograma de la parte `name` a los t segundos (en bucle si loop; si no, el último se queda) */
  partFrame(cid, name, t, loop) {
    const d = this.D[cid], A = d && d.a[name]; if (!A) return null;
    const fps = A.fps || 12; let tot = 0; for (const f of A.f) tot += (f[7] || 1) / fps;
    let tt = loop && tot > 0 ? t % tot : Math.min(t, tot - 1e-4), f = A.f[A.f.length - 1];
    for (const g of A.f) { const dt = (g[7] || 1) / fps; if (tt < dt) { f = g; break; } tt -= dt; }
    return { pg: f[0], x: f[1], y: f[2], w: f[3], h: f[4], ax: f[5], ay: f[6] };
  },
  /** Fotograma de una secuencia [[parte, segundos, bucle]…] a los t segundos. loopLast: la última parte se repite */
  seqFrame(cid, seq, t, loopLast) {
    for (let i = 0; i < seq.length; i++) {
      const p = seq[i], last = i === seq.length - 1;
      if (t < p[1] || last) return this.partFrame(cid, p[0], t, last ? loopLast || !!p[2] : false);
      t -= p[1];
    }
    return null;
  },
  /** Efecto del paquete fx que se reproduce una vez · y lo que dura */
  fxAt(a, t) { const d = this.D.fx, A = d && d.a[a]; if (!A) return null; const f = A.f[Math.min(A.f.length - 1, Math.floor(t * (A.fps || 12)))]; return { pg: f[0], x: f[1], y: f[2], w: f[3], h: f[4], ax: f[5], ay: f[6] }; },
  fxDur(a) { const d = this.D.fx, A = d && d.a[a]; return A ? A.f.length / (A.fps || 12) : 0; },
  /** Fotograma de un efecto del paquete fx (anim `a`, en bucle) */
  fx(a, t) { const d = this.D.fx, A = d && d.a[a]; if (!A) return null; const n = A.f.length, f = A.f[Math.floor(t * (A.fps || 12)) % n]; return { pg: f[0], x: f[1], y: f[2], w: f[3], h: f[4], ax: f[5], ay: f[6] }; },
  /** Luchadores de Z Legends 3 de las formas de un personaje (por forma: id o null) */
  fightersOf(ch) { return ch && ch.forms ? ch.forms.map((f) => (/^z_/.test(f.sheet) ? f.sheet.slice(2) : null)) : []; },
  /** Descarga lo que usa un personaje (sus formas de Z Legends 3 y los efectos) */
  prep(ch) { const ids = this.fightersOf(ch).filter((x) => x && this.has(x)); if (!ids.length) return Promise.resolve(); return Promise.all(ids.concat(['fx']).map((c) => this.load(c))); }
};

/* ---------- Sprite con recorte libre del atlas (Supervivencia) ---------- */
const ZMS_VS = `
uniform vec4 uRect; uniform vec2 uAnc; uniform vec2 uTex; uniform float uScale; uniform float uFlip; uniform float uLift;
uniform sampler2D uHMap; uniform vec2 uHO; uniform float uHS; uniform vec2 uHR;
varying vec2 vUv;
void main() {
  vec2 q = uv;
  float lx = q.x * uRect.z - uAnc.x, ly = uAnc.y - (1.0 - q.y) * uRect.w;
  if (uFlip > 0.5) lx = -lx;
  vUv = vec2((uRect.x + q.x * uRect.z) / uTex.x, 1.0 - (uRect.y + (1.0 - q.y) * uRect.w) / uTex.y);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 o = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float ground = texture2D(uHMap, clamp((o.xz - uHO) / uHS, 0.0, 1.0)).r * uHR.y + uHR.x;
  vec3 w = o + vec3(0.0, ground + uLift, 0.0) + right * lx * uScale + up * ly * uScale;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;
const ZMS_FS = `
uniform sampler2D uMap; uniform float uAlpha; uniform vec3 uTint; varying vec2 vUv;
void main() { vec4 c = texture2D(uMap, vUv); if (c.a < 0.02) discard; gl_FragColor = vec4(c.rgb * uTint, c.a * uAlpha); }`;
class ZMoveSprite {
  constructor(scene, order) {
    this.u = Object.assign({ uMap: { value: null }, uRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uAnc: { value: new THREE.Vector2(0, 0) }, uTex: { value: new THREE.Vector2(1, 1) },
      uScale: { value: ZM_U }, uFlip: { value: 0 }, uLift: { value: 0 }, uAlpha: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) } }, HM_UNIFORMS);
    this.mat = new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: ZMS_VS, fragmentShader: ZMS_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0.5, 0.5, 0), this.mat);
    this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.renderOrder = order || 3.5; scene.add(this.mesh);
  }
  /** Dibuja el fotograma f (del paquete cid) con los pies en (x, z), elevado `lift`; s = escala sobre el tamaño de píxel */
  show(cid, f, x, z, flip, lift, s, alpha) {
    const t = f && ZMoves.tex(cid, f.pg, 'n'); if (!t) { this.mesh.visible = false; return; }
    const u = this.u; u.uMap.value = t; u.uTex.value.set(t.image.width, t.image.height); u.uRect.value.set(f.x, f.y, f.w, f.h); u.uAnc.value.set(f.ax, f.ay);
    u.uFlip.value = flip ? 1 : 0; u.uLift.value = lift || 0; u.uScale.value = ZM_U * (s || 1); u.uAlpha.value = alpha === undefined ? 1 : alpha;
    this.mesh.position.set(x, 0, z); this.mesh.visible = true;
  }
  hide() { this.mesh.visible = false; }
}
