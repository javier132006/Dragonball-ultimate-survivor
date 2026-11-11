/* =====================================================================
   zfight.js · COMBATE Z: lucha 2D 1 contra 1, 2 contra 2 y 3 contra 3
   Luchadores, efectos, escenarios, cinemáticas y voces de Z Legends 3
   (zl3/, generado por tools/make_zl3.py). Se descarga al entrar en el modo.

   Piezas:
   - ZL3: carga de datos (scripts, imágenes y audio) con barra de progreso
   - ZSnd: voces y sonidos (un <audio> por archivo, clonado si se solapa)
   - ZMoves: el repertorio de cada luchador sale de los nombres de sus animaciones
   - ZFighter: estado, animación, físicas, golpes y especiales
   - ZAI: la CPU (fácil, normal, difícil)
   - ZFight: pantallas (equipo, escenario), combate, HUD, cinemáticas y premios
   Todo se dibuja en un <canvas> 2D propio a píxel entero (nítido) y el
   juego 3D deja de dibujarse mientras tanto (rendimiento).
   ===================================================================== */

/* ---------- Datos ---------- */
const ZL3 = window.ZL3 = window.ZL3 || {};
Object.assign(ZL3, {
  base: 'zl3/', chars: ZL3.chars || {}, img: {}, loaded: {},
  add(m) { this.chars[m.id] = m; },
  script(src) {
    if (this.loaded[src]) return this.loaded[src];
    return (this.loaded[src] = new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => { delete this.loaded[src]; ko(new Error(src)); }; document.head.appendChild(s); }));
  },
  image(src) {
    if (this.img[src]) return Promise.resolve(this.img[src]);
    return new Promise((ok, ko) => { const i = new Image(); i.onload = () => { this.img[src] = i; ok(i); }; i.onerror = () => ko(new Error(src)); i.src = src; });
  },
  /** Carga lo necesario para un combate; onProg(0..1, texto) */
  async need(ids, stage, onProg) {
    const B = this.base, I = this.index, list = [];
    const byId = (id) => I.roster.find((r) => r.id === id) || { bytes: 3e5 };
    if (!this.fx) list.push({ b: I.fxBytes, f: () => Promise.all([this.script(B + 'fx.js'), this.image(B + 'fx.webp')]) });
    for (const id of new Set(ids)) {
      if (this.chars[id] && this.chars[id].ready) continue;
      list.push({ b: byId(id).bytes, f: async () => {
        await this.script(B + 'c/' + id + '.js');
        const m = this.chars[id]; m.atlas = await this.image(B + 'c/' + id + '.webp');
        if (m.cut) m.cutAtlas = await this.image(B + 'c/' + id + '_cut.webp');
        m.moves = ZMoves.build(m); m.ready = true;
        ZSnd.preload(Object.values(m.voice).flat().map((v) => v[1]));
      } });
    }
    const st = I.stages.find((s) => s.id === stage);
    if (st) list.push({ b: st.bytes, f: () => this.image(B + 's/' + stage + '.webp') });
    const tot = list.reduce((a, x) => a + x.b, 0) || 1; let done = 0;
    onProg && onProg(0, list.length ? 'Descargando datos del Combate Z…' : '');
    for (const x of list) { await x.f(); done += x.b; onProg && onProg(done / tot, 'Descargando datos del Combate Z · ' + (done / 1048576).toFixed(1) + ' / ' + (tot / 1048576).toFixed(1) + ' MB'); }
    ZSnd.preload(I.common);
  }
});

/* ---------- Sonido ---------- */
const ZSnd = {
  cache: new Map(), on: true,
  file: (n) => ZL3.base + 'a/' + n.replace(/[^a-z0-9_-]/g, '_') + '.m4a',
  get(n) { let a = this.cache.get(n); if (!a) { a = new Audio(this.file(n)); a.preload = 'auto'; this.cache.set(n, a); } return a; },
  preload(list) { for (const n of list || []) this.get(n); },
  vol() { return (Save.d.vol && Save.d.vol.sfx != null ? Save.d.vol.sfx : 0.75); },
  play(n, v) {
    if (!this.on || !n) return;
    const a = this.get(n), s = a.paused || a.ended ? a : a.cloneNode();
    s.volume = Math.min(1, (v == null ? 1 : v) * this.vol()); s.currentTime = 0;
    const p = s.play(); if (p && p.catch) p.catch(() => {});
  },
  stopAll() { for (const a of this.cache.values()) { try { a.pause(); } catch (e) { /* nada */ } } }
};
/** Fondo de las cinemáticas: degradado de ki con rayos que giran (los paneles traen transparencias) */
function cutBackdrop(g, W, H, t, col) {
  const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
  gr.addColorStop(0, col || '#ffcf4a'); gr.addColorStop(0.45, '#7a2a10'); gr.addColorStop(1, '#0a0410');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.save(); g.translate(W / 2, H / 2); g.rotate(t * 0.6); g.fillStyle = 'rgba(255,255,255,.08)';
  for (let i = 0; i < 24; i++) { g.rotate(Math.PI / 12); g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.max(W, H), -26); g.lineTo(Math.max(W, H), 26); g.closePath(); g.fill(); }
  g.restore();
}
const isVoice = (s) => /^v[a-z]{2,5}\d/.test(s);
const isHitSnd = (s) => /^(hit_|guard_)/.test(s);

/* ---------- Repertorio de cada luchador (a partir de los nombres de sus animaciones) ---------- */
// Color de su ki, rayo y aura; y, si lo tiene, su esfera gigante
const ZCOL = {
  goku: ['Azul', 'Azul', 'BASE', 'Goku'], gokussj: ['Amarelo', 'Azul', 'AMARELO'], gokublue: ['Azul2', 'Azul', 'AZULESCURO'], gokuui: ['Azul3', 'Azul', 'BASE'],
  vegeta: ['Roxo', 'Roxo', 'BASE'], vegetassj: ['Amarelo', 'Roxo', 'AMARELO'], vegetaego: ['Hakai', 'Roxo', 'ROSA'], gohanssj2: ['Gohan_Ssj2', 'Azul', 'AMARELO'],
  gohanbeast: ['GohanBeast_Aereo', 'Azul', 'BASE'], miraigohan: ['Amarelo', 'Amarelo', 'AMARELO'], miraitrunks: ['Trunks', 'Amarelo', 'AMARELO'],
  piccolo: ['Verde', 'Amarelo', 'VERDE'], tien: ['Amarelo_2', 'Amarelo', 'BASE'], gogetassj4: ['Azul4', 'Azul', 'VERMELHO'], gogetablue: ['Azul', 'Azul', 'AZULESCURO'],
  vegettoblue: ['Azul2', 'Azul', 'AZULESCURO'], bardock: ['Azul', 'Azul', 'BASE'], bardockssj: ['Amarelo_3', 'Azul', 'AMARELO'], raditz: ['Roxo', 'Roxo', 'BASE'],
  nappa: ['Amarelo', 'Amarelo', 'BASE'], ginyu: ['Ginyu_JeiceAndBurter_Blast', 'Roxo', 'BASE'], freezer: ['Freeza', 'Rosa', 'ROSA', 'DeathBall'], cell: ['Amarelo', 'Azul', 'AMARELO'],
  a17: ['PowerBlitz', 'Verde', 'VERDE_CLARO'], a18: ['Amarelo', 'Amarelo', 'BASE'], kidbuu: ['Rosa', 'Rosa', 'ROSA'], janemba: ['Janemba', 'Rosa', 'VERMELHO'],
  brolyz: ['BrolyZ', 'Verde', 'VERDE', 'Broly_Pt1'], brolydbs: ['BrolyDbs', 'Verde', 'VERDE', 'BrolyDbs'], kefla: ['Vermelho_Kefla', 'Verde', 'VERDE_CLARO'],
  hit: ['Default', 'Roxo', 'BASE'], jiren: ['Default', 'Rosa', 'VERMELHO'], beerus: ['Hakai', 'Bills', 'ROSA', 'Bills'], black: ['GokuBlack', 'Rosa', 'ROSA'],
  zamasu: ['Zamasu_SP1', 'Rosa', 'ROSA', 'ZamasuFusion'], baby: ['Rosa_2', 'Roxo', 'ROSA', 'RevengeDeathBall'], moro: ['Moro73_GreenBlast', 'Moro73', 'VERDE', 'Moro73']
};
const ZMoves = {
  TYPE: [
    ['beam', /kamehame|gun|cannon|flash|masenko|beam|wave|ray|laser|makank|kikoho|kykouho|kikouho|bigbang|excalibur|javelin|lancer|breaker|hakai|eraser|magnetron|lightning|thunder/i],
    ['bigball', /ball|bomb|spirit|genki|sphere|nova|planet|supernova|meteor shower|meteorshower/i],
    ['ball', /blast|disc|saucer|grenade|shot|shower|storm|bullet|spear|candy|chaser|cannonball|blades|wrath/i]
  ],
  typeOf(name) { for (const [t, re] of this.TYPE) if (re.test(name)) return t; return 'rush'; },
  build(m) {
    const A = m.anims, has = (n) => !!A[n];
    const M = {
      light: ['Attack_Light_1', 'Attack_Light_2', 'Attack_Light_3'].filter(has), lightC: 'Attack_Light_Agachado', lightA: 'Attack_Light_Aereo',
      med: 'Attack_Medium', medC: 'Attack_Medium_Agachado', medA: 'Attack_Medium_Aereo', heavy: has('Attack_Heavy') ? 'Attack_Heavy' : 'Attack_Heavy_Frente',
      heavyC: 'Attack_Heavy_Agachado', heavyA: 'Attack_Heavy_Aereo', heavyAD: has('Attack_Heavy_Aereo_Baixo') ? 'Attack_Heavy_Aereo_Baixo' : 'Attack_Heavy_Aereo',
      blast: has('Special') ? 'Special' : has('Special_Pt1') ? 'Special_Pt1' : null, blastA: has('Special_Aereo') ? 'Special_Aereo' : null
    };
    // Especiales: se agrupan por raíz (Special_Kamehameha_Chao_Pt1 -> Special_Kamehameha)
    const SKIP = /^(Pt\d+|Chao|Ar|Cima|Baixo|Frente|Tras|Acertou|Errou|Final|Start|Finish|Charge|Variation\d|Variacao\d|Leve|Light|Medium|Heavy|Normal|Duple|Exp\d|Agachado|Aereo|agachado|Loop|Fim|Exe|Impact|Explosion|Destroy)$/;
    const groups = new Map();
    for (const n of Object.keys(A)) {
      if (!/^(Special|Ultimate|UltimateAttack|UltimateSsj2|Super)/.test(n) || /^Special(_Agachado|_Aereo|_agachado|_Pt\d)?$/.test(n)) continue;
      const t = n.split('_'), root = t[0] + (t[1] && !SKIP.test(t[1]) ? '_' + t[1] : '') + (t[2] && t[1] && !SKIP.test(t[1]) && !SKIP.test(t[2]) && /Super|Ultimate|Big|Giant|Final/.test(t[2]) ? '_' + t[2] : '');
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(n);
    }
    const sp = [];
    for (const [root, L] of groups) {
      if (root === 'Special' || /Telekinesis|AdeusTien|Kaioken_Parado|Copy|Barrier|Counter|TenmaDefense|AbsorbDamage|WallOfLight|Transformation/.test(root)) continue;
      const ground = L.filter((n) => /_Chao/.test(n));
      let seq = (ground.length ? ground : L.filter((n) => !/_(Ar|Cima|Baixo|Aereo)(_|$)/.test(n))).filter((n) => !/Acertou|Errou/.test(n));
      if (!seq.length) seq = L.filter((n) => !/Acertou|Errou/.test(n));
      if (!seq.length) continue;
      seq = seq.slice(0, 5);
      const nf = seq.reduce((a, n) => a + A[n][3].length, 0);
      sp.push({ root, seq, hit: L.find((n) => /Acertou/.test(n)), miss: L.find((n) => /Errou/.test(n)), type: this.typeOf(root), nf, ult: /^Ultimate/.test(root) });
    }
    const pick = (f, not) => sp.find((s) => f(s) && !not.includes(s));
    const used = [];
    M.ult = pick((s) => s.ult, used) || sp.slice().sort((a, b) => b.nf - a.nf)[0]; if (M.ult) used.push(M.ult);
    M.s1 = pick((s) => s.type === 'rush', used) || pick(() => true, used); if (M.s1) used.push(M.s1);
    M.s2 = pick((s) => s.type === 'ball' || s.type === 'bigball', used) || pick((s) => s.type === 'beam', used) || pick(() => true, used); if (M.s2) used.push(M.s2);
    M.sup = pick((s) => s.type === 'beam', used) || pick(() => true, used) || M.s2;
    M.all = sp;
    const C = ZCOL[m.id] || ['Azul', 'Azul', 'BASE'];
    M.kb = 'kiblast_jogador_sprite/' + C[0]; M.beam = C[1]; M.aura = C[2] === 'BASE' ? 'Charge_BASE' : 'Charge' + (C[2] ? '_' + C[2] : ''); M.big = C[3] ? 'esferadekigigante_sprite/' + C[3] : null;
    if (!ZL3.fx[M.kb]) M.kb = 'kiblast_jogador_sprite/Azul';
    if (!ZL3.fx['aura_sprite/' + M.aura]) M.aura = 'Charge';
    // Cinemáticas: la del súper ataque (todo menos intro y victoria) y la de la intro/victoria
    const cut = m.cut ? Object.keys(m.cut) : [];
    M.cutUlt = cut.filter((n) => !/Intro|Vitoria|WinPose|Win_|Background|_Vs|Vs/.test(n) || /Ult/.test(n)).slice(0, 4);
    M.cutIntro = cut.filter((n) => /Intro/.test(n) && !/Vitoria|Background/.test(n)).slice(0, 4);
    M.cutWin = cut.filter((n) => /Vitoria|WinPose/.test(n) && !/Background/.test(n)).slice(0, 3);
    M.intro = ['Intro_Pt1', 'Intro_Pt2', 'Intro_Pt3', 'Intro_Pt4', 'Intro'].filter(has).slice(0, 3);
    M.win = ['Vitoria', 'Vitoria_Pt1', 'Vitoria_Pt2'].filter(has);
    return M;
  }
};

/* ---------- Constantes del combate (en píxeles del sprite y segundos) ---------- */
const ZK = {
  ARENA: 488, FLOOR_LY: 906 / 3.5, LAYOUT_K: 3.5, VIEW_H: 196, GRAV: 980, JUMP: 360, WALK: 92, BACK: 72, DASH: 300,
  HP: 1000, KI: 500, BAR: 100, HURT_W: 11, HURT_H: 46,
  DMG: { light: 28, light3: 40, med: 55, heavy: 75, blast: 26, s1: 110, s2: 95, sup: 230, ult: 380, rush: 140 },
  COST: { blast: 15, s1: 50, s2: 50, sup: 100, ult: 300, tp: 60, rush: 100 },
  DIFF: {
    easy: { name: 'Fácil', react: 0.42, block: 0.12, chain: 1, aggr: 0.35, sp: 0.05, dmgIn: 0.8, dmgOut: 0.75, zeni: 300, cry: 15 },
    normal: { name: 'Normal', react: 0.24, block: 0.42, chain: 2, aggr: 0.6, sp: 0.12, dmgIn: 1, dmgOut: 1, zeni: 600, cry: 30 },
    hard: { name: 'Difícil', react: 0.12, block: 0.72, chain: 3, aggr: 0.85, sp: 0.22, dmgIn: 1.15, dmgOut: 1.15, zeni: 1100, cry: 50 }
  }
};
const zclamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* =====================================================================
   LUCHADOR
   ===================================================================== */
class ZFighter {
  constructor(F, id, team, cpu, diff) {
    this.F = F; this.m = ZL3.chars[id]; this.id = id; this.team = team; this.cpu = cpu; this.diff = diff;
    this.mv = this.m.moves; this.A = this.m.anims;
    this.maxHp = ZK.HP; this.hp = ZK.HP; this.ki = ZK.BAR; this.out = false; this.spark = 0; this.sparkUsed = false;
    this.ctl = {}; this.prev = {}; this.ai = cpu ? new ZAI(this, diff) : null;
    this.reset(0, 1);
  }
  reset(x, face) {
    this.x = x; this.y = 0; this.vx = 0; this.vy = 0; this.face = face; this.state = 'idle'; this.st = 0;
    this.hitstun = 0; this.inv = 0; this.combo = 0; this.chain = 0; this.mv2 = null; this.sp = null; this.spark = 0; this.charging = false;
    this.set('Parado');
  }
  /* --- Animación --- */
  set(name, keep) {
    if (!this.A[name]) name = 'Parado';
    if (keep && this.an === name) return;
    this.an = name; this.fi = 0; this.ft = 0; this.done = false; this.fresh = true;
  }
  get cur() { return this.A[this.an]; }
  frameDur(k) { const a = this.cur, sp = a[0] || 0; return sp > 0 ? (a[3][k][6] || 1) / sp : 1e9; }
  stepAnim(dt) {
    const a = this.cur, n = a[3].length;
    if (this.fresh) { this.fresh = false; this.onFrame(); }
    if (this.done) return;
    this.ft += dt;
    while (this.ft >= this.frameDur(this.fi)) {
      this.ft -= this.frameDur(this.fi);
      if (this.fi + 1 < n) { this.fi++; this.onFrame(); }
      else if (a[1]) { this.fi = Math.min(n - 1, a[2] || 0); this.onFrame(); }
      else { this.done = true; this.ft = 0; break; }
    }
  }
  /** Al entrar en un fotograma: voces y sonidos de ese fotograma y, si toca, el golpe o el disparo */
  onFrame() {
    const V = this.m.voice[this.an];
    if (V) {
      const here = V.filter((v) => v[0] === this.fi);
      const voices = here.filter((v) => isVoice(v[1]));
      if (voices.length && !this.F.quiet) {
        const plain = voices.filter((v) => !/_vs_/.test(v[1]));
        const pool = plain.length ? plain : voices;
        if (this.F.voiceOk(this)) ZSnd.play(pool[(Math.random() * pool.length) | 0][1], 0.9);
      }
      const seen = new Set();
      for (const v of here) if (!isVoice(v[1]) && !isHitSnd(v[1]) && !seen.has(v[1])) { seen.add(v[1]); ZSnd.play(v[1], 0.55); }
    }
    if (this.mv2 && this.fi === this.mv2.hitF && this.an === this.mv2.anim) this.F.meleeHit(this, this.mv2);
    if (this.sp) this.F.specialFrame(this);
  }
  /** Fotograma de impacto: el que trae el sonido de golpe; si no, el del centro */
  hitFrame(an) {
    const V = this.m.voice[an], a = this.A[an]; if (!a) return 0;
    const h = V && V.find((v) => /^(hit_|guard_|ataque_superrapido)/.test(v[1]));
    return h ? Math.min(h[0], a[3].length - 1) : Math.max(0, Math.floor(a[3].length * 0.5));
  }
  /** Fotograma de disparo de un especial: el del sonido de disparo; si no, al 60% */
  fireFrame(an) {
    const V = this.m.voice[an], a = this.A[an]; if (!a) return 0;
    const h = V && V.find((v) => !isVoice(v[1]) && /fire|shot|kiblast|blast|expl|beam|kidan|hassya|hassha|throw|shoot|exe/.test(v[1]));
    return h ? Math.min(h[0], a[3].length - 1) : Math.floor(a[3].length * 0.6);
  }
  get air() { return this.y > 0.5; }
  get busy() { return ['attack', 'special', 'hitstun', 'launched', 'down', 'getup', 'tp', 'rush', 'rushed', 'intro', 'win', 'ko', 'tagin', 'tagout', 'cut', 'block', 'spark'].includes(this.state); }
  foe() { return this.F.active(1 - this.team); }

  /* --- Cada cuadro --- */
  update(dt) {
    const c = this.ctl, p = this.prev, F = this.F, o = this.foe();
    const press = (k) => c[k] && !p[k];
    this.inv = Math.max(0, this.inv - dt); this.st += dt;
    if (this.spark > 0) { this.spark -= dt; this.ki = Math.min(ZK.KI, this.ki + 25 * dt); }
    if (o && !this.busy && !this.air) this.face = o.x >= this.x ? 1 : -1;
    const back = this.face > 0 ? c.l : c.r, fwd = this.face > 0 ? c.r : c.l;
    switch (this.state) {
      case 'idle': case 'walk': case 'crouch': case 'jump': case 'charge': {
        const air = this.air;
        this.charging = false;
        if (!air && c.chg && !fwd && !back) {                           // cargar ki (C)
          this.state = 'charge'; this.charging = true; this.vx = 0;
          this.ki = Math.min(ZK.KI, this.ki + 140 * dt);
          const stage = this.st < 0.25 ? 'CarregandoKi_Stage1' : 'CarregandoKi_Stage2';
          this.set(this.an === 'CarregandoKi_Stage2' ? this.an : stage, true);
          if (this.st > 0.35 && Math.random() < dt * 0.5) F.fxAt('poeira4/Efeito1', this.x, 0, this.face, 0.8);
          break;
        } else if (this.state === 'charge') { this.state = 'idle'; this.st = 0; }
        if (press('spark') && !this.sparkUsed && this.ki >= 200) return this.doSpark();
        if (press('ult') && this.ki >= ZK.COST.ult && this.mv.ult) return this.doSpecial(this.mv.ult, 'ult');
        if (press('sup') && this.ki >= ZK.COST.sup && this.mv.sup) return this.doSpecial(this.mv.sup, 'sup');
        if (press('s1') && this.ki >= ZK.COST.s1 && this.mv.s1) return this.doSpecial(this.mv.s1, 's1');
        if (press('s2') && this.ki >= ZK.COST.s2 && this.mv.s2) return this.doSpecial(this.mv.s2, 's2');
        if (press('tp') && this.ki >= ZK.COST.tp && o) return this.doTeleport(o);
        if (press('rush') && this.ki >= ZK.COST.rush && o && !air) return this.doRush(o);
        if (press('tag') && !air && F.canTag(this)) return F.tag(this);
        if (press('blast') && this.ki >= ZK.COST.blast) return this.doBlast();
        if (press('a1')) return this.doAttack(air ? this.mv.lightA : c.d ? this.mv.lightC : this.mv.light[0], 'light');
        if (press('a2')) return this.doAttack(air ? this.mv.medA : c.d ? this.mv.medC : this.mv.med, 'med');
        if (press('a3')) return this.doAttack(air ? (c.d ? this.mv.heavyAD : this.mv.heavyA) : c.d ? this.mv.heavyC : this.mv.heavy, 'heavy');
        if (press('dash') && !air) { this.state = 'dash'; this.st = 0; this.dashDir = back ? -this.face : this.face; this.set('Dash_Start'); ZSnd.play('ataque_superrapido', 0.4); F.fxAt('poeira_de_colisao_com_o_solo_sprite/Tras', this.x, 0, this.dashDir, 1); break; }
        if (air) {
          this.state = 'jump'; this.vx = zclamp(this.vx + ((c.r ? 1 : 0) - (c.l ? 1 : 0)) * 300 * dt, -ZK.WALK * 1.2, ZK.WALK * 1.2);
          if (this.vy < 0 && this.A.CaidoAposPulo && this.an !== 'CaidoAposPulo') this.set('Pulando', true);
          break;
        }
        if (c.u) { this.vy = ZK.JUMP; this.y = 1; this.vx = (fwd ? 1 : back ? -1 : 0) * this.face * ZK.WALK * 1.1; this.set('Pulando'); this.state = 'jump'; F.fxAt('poeiradesaltoequeda_sprite/Pulo', this.x, 0, 1, 1); break; }
        if (c.d) { this.state = 'crouch'; this.vx = 0; this.set(back ? 'Defesa_Agachado' : 'Agachado', true); this.guard = back ? 'low' : null; break; }
        this.guard = back ? 'high' : null;
        if (fwd) { this.state = 'walk'; this.vx = this.face * ZK.WALK; this.set('MovimentoParaFrente', true); }
        else if (back) { this.state = 'walk'; this.vx = -this.face * ZK.BACK; this.set('MovimentoParaTras', true); }
        else { this.state = 'idle'; this.vx = 0; this.set('Parado', true); }
        break;
      }
      case 'dash': {
        this.vx = this.dashDir * ZK.DASH * (this.spark > 0 ? 1.2 : 1);
        if (this.an === 'Dash_Start' && this.done) this.set('Dash');
        if (this.st > 0.32 || (o && Math.abs(o.x - this.x) < 22 && this.dashDir === this.face)) { this.state = 'idle'; this.vx *= 0.3; }
        if (press('a1') || press('a2') || press('a3')) { this.state = 'idle'; return this.update(0); }
        break;
      }
      case 'attack': {
        this.vx *= Math.pow(0.02, dt);
        // Cancelar en cadena: leve 1 -> 2 -> 3, leve -> medio -> fuerte, cualquier golpe que acierta -> especial
        if (this.mv2 && this.mv2.landed) {
          if (press('a1') && this.mv2.kind === 'light' && this.chain + 1 < this.mv.light.length && !this.air) { this.chain++; return this.doAttack(this.mv.light[this.chain], 'light', true); }
          if (press('a2') && (this.mv2.kind === 'light') ) return this.doAttack(this.air ? this.mv.medA : this.mv.med, 'med', true);
          if (press('a3') && (this.mv2.kind === 'light' || this.mv2.kind === 'med')) return this.doAttack(this.air ? this.mv.heavyA : c.d ? this.mv.heavyC : this.mv.heavy, 'heavy', true);
          if ((press('s1') || press('s2') || press('sup') || press('ult') || press('blast')) && this.fi >= this.mv2.hitF) { this.state = 'idle'; this.mv2 = null; return this.update(0); }
        }
        if (this.done) { this.mv2 = null; this.chain = 0; this.state = this.air ? 'jump' : 'idle'; this.st = 0; }
        break;
      }
      case 'special': F.specialUpdate(this, dt); break;
      case 'block': this.vx *= Math.pow(0.01, dt); if (this.st > this.blockT) { this.state = 'idle'; } break;
      case 'hitstun': this.vx *= Math.pow(0.05, dt); if (this.st > this.hitstun && !this.air) { this.state = 'idle'; this.combo = 0; } break;
      case 'launched': {
        if (this.wallT == null && (this.x <= 6 || this.x >= ZK.ARENA - 6) && Math.abs(this.vx) > 120) {   // contra la pared: rebota
          this.wallT = 0; this.vx = -this.vx * 0.35; this.vy = Math.max(this.vy, 120); this.set('SendoLancado_BATENDO_NA_PAREDE'); F.shake(0.4); F.fxAt('impactoderochas_sprite/Impacto', this.x, this.y + 20, -Math.sign(this.vx), 1);
          ZSnd.play('hit_large-a', 0.6);
        }
        break;
      }
      case 'down': if (this.st > 0.7 && this.hp > 0) { this.state = 'idle'; this.inv = 0.4; this.combo = 0; this.set('Parado'); } break;
      case 'tp': if (this.done) { this.state = this.air ? 'jump' : 'idle'; } break;
      case 'spark': if (this.done) this.state = 'idle'; break;
      case 'rush': F.rushUpdate(this, dt); break;
      case 'tagin': this.vx = this.face * 120; if (this.done || this.st > 0.6) { this.state = 'idle'; this.vx = 0; } break;
    }
    this.prev = Object.assign({}, c);
  }
  /* --- Acciones --- */
  doAttack(an, kind, chained) {
    if (!this.A[an]) an = this.mv.light[0];
    if (!chained) this.chain = 0;
    this.state = 'attack'; this.st = 0; this.set(an);
    this.mv2 = { anim: an, kind: an === 'Attack_Light_3' ? 'light3' : kind, hitF: this.hitFrame(an), landed: false,
      launch: kind === 'heavy' ? (an === this.mv.heavyC ? 'up' : an === this.mv.heavyAD ? 'down' : 'side') : null };
    this.vx = (kind === 'heavy' ? 70 : 30) * this.face;
    if (this.air && kind !== 'heavy') this.vy = Math.max(this.vy, 40);
    if (this.fi === this.mv2.hitF) this.F.meleeHit(this, this.mv2);
  }
  doBlast() {
    this.ki -= ZK.COST.blast;
    this.state = 'special'; this.st = 0; this.mv2 = null;
    const an = this.air && this.mv.blastA ? this.mv.blastA : this.mv.blast || this.mv.med;
    this.sp = { kind: 'blast', type: 'kb', seq: [an], step: 0, fireF: this.fireFrame(an), fired: false };
    this.set(an);
  }
  doSpecial(S, kind) {
    this.ki -= ZK.COST[kind]; this.state = 'special'; this.st = 0; this.mv2 = null; this.vx = 0;
    this.sp = { kind, S, type: S.type, seq: S.seq, step: 0, fired: false, fireF: this.fireFrame(S.seq[0]), t: 0 };
    if (kind === 'ult' || kind === 'sup') this.F.superFlash(this, kind);
    this.set(S.seq[0]);
    if (kind === 'ult' && this.mv.cutUlt.length) this.F.playCut(this, this.mv.cutUlt, 3.2);
  }
  doTeleport(o) {
    this.ki -= ZK.COST.tp; this.state = 'tp'; this.st = 0; this.inv = 0.35;
    this.set(this.air ? 'Teletransporte_Ar' : 'Teletransporte_Chao'); ZSnd.play('teletransporte', 0.6);
    this.F.fxAt('efeito_quebravento_sprite/Default', this.x, this.y + 24, this.face, 0.8);
    this.x = zclamp(o.x - o.face * 26, 8, ZK.ARENA - 8); this.y = o.y; this.vx = 0; this.vy = o.air ? 60 : 0; this.face = o.x >= this.x ? 1 : -1;
  }
  doRush(o) {
    this.ki -= ZK.COST.rush; this.state = 'rush'; this.st = 0; this.rushStep = 0; this.rushHit = false; this.set('Dragon_Rush_Pt1');
    ZSnd.play('ataque_superrapido', 0.6);
  }
  doSpark() {
    this.sparkUsed = true; this.spark = 12; this.ki = ZK.KI; this.state = 'spark'; this.st = 0; this.set('Sparking');
    ZSnd.play('sparking', 0.8); this.F.superFlash(this, 'spark');
  }
  /* --- Recibir --- */
  canBlock(from) {
    if (this.state === 'block') return true;
    if (!this.guard || this.air || this.busy) return false;
    return (from.x - this.x) * this.face > 0;
  }
}

/* =====================================================================
   CPU
   ===================================================================== */
class ZAI {
  constructor(f, D) { this.f = f; this.D = D; this.t = Math.random() * 0.3; this.plan = null; this.hold = 0; }
  think(dt) {
    const f = this.f, o = f.foe(), c = f.ctl, D = this.D;
    for (const k in c) if (k !== 'l' && k !== 'r' && k !== 'd' && k !== 'chg') c[k] = false;
    if (!o || f.state === 'intro' || f.state === 'win') return;
    const dx = o.x - f.x, d = Math.abs(dx), toward = dx > 0 ? 'r' : 'l', away = dx > 0 ? 'l' : 'r';
    // Bloquear: si el rival ataca de cerca, con la probabilidad de la dificultad
    const threat = (o.state === 'attack' && d < 60) || (o.state === 'special' && o.sp && (o.sp.type === 'rush' ? d < 120 : d < 260));
    if (threat && !f.busy && this.blockRoll == null) this.blockRoll = Math.random() < D.block;
    if (!threat) this.blockRoll = null;
    if (threat && this.blockRoll) { c[away] = true; c[toward] = false; c.d = o.sp && o.mv2 && o.mv2.anim && /Agachado/.test(o.mv2.anim); c.chg = false; return; }
    // Combo en curso: seguir pulsando según la dificultad
    if (f.state === 'attack' && f.mv2 && f.mv2.landed) {
      if (f.mv2.kind === 'light' && f.chain + 1 < D.chain) { c.a1 = true; return; }
      if (f.mv2.kind === 'light' && D.chain >= 2) { c.a2 = Math.random() < 0.5; c.a3 = !c.a2; return; }
      if (f.mv2.kind === 'med' && D.chain >= 3) { c.a3 = true; return; }
      if (D.chain >= 3 && f.ki >= ZK.COST.s1 && Math.random() < 0.4) { c.s1 = true; return; }
    }
    this.t -= dt; if (this.t > 0) return;
    this.t = D.react * (0.6 + Math.random() * 0.8);
    c.l = c.r = c.d = c.chg = false;
    if (f.busy) return;
    const r = Math.random();
    if (f.ki >= ZK.COST.ult && r < D.sp * 1.5 && d < 200) { c.ult = true; return; }
    if (!f.sparkUsed && f.ki >= 200 && f.hp < f.maxHp * 0.5 && r < 0.3) { c.spark = true; return; }
    if (d > 70) {
      if (f.ki < 120 && r < 0.25 && d > 140) { c.chg = true; this.t = 0.6 + Math.random() * 0.6; return; }
      if (f.ki >= ZK.COST.sup && r < D.sp) { c.sup = true; return; }
      if (f.ki >= ZK.COST.s2 && r < D.sp * 1.6) { c.s2 = true; return; }
      if (r < 0.18) { c.blast = true; return; }
      if (r < 0.28 && f.ki >= ZK.COST.tp && D.chain >= 2) { c.tp = true; return; }
      if (r < 0.45) { c.dash = true; c[toward] = true; return; }
      c[toward] = true; if (r > 0.92) c.u = true; return;
    }
    if (d < 40) {
      if (r < D.aggr) {
        const k = Math.random();
        if (f.ki >= ZK.COST.s1 && k < D.sp * 2) c.s1 = true;
        else if (f.ki >= ZK.COST.rush && k < 0.08) c.rush = true;
        else if (k < 0.55) c.a1 = true; else if (k < 0.8) c.a2 = true; else c.a3 = true;
        if (Math.random() < 0.15) c.d = true;
      } else if (r < D.aggr + 0.15) { c[away] = true; this.t = 0.3; }
      else if (r < 0.95) { c.u = true; c[toward] = true; }
      return;
    }
    c[toward] = true; if (r < 0.2) c.u = true;
  }
}

/* =====================================================================
   COMBATE
   ===================================================================== */
class ZFight {
  constructor(game) {
    this.g = game; this.on = false; this.root = null; this.keys = {}; this.setup = { size: 1, diff: Save.d.zdiff || 'normal', stage: 'random', p: [], c: [] };
    this.raf = 0;
  }
  /* ---------- Entrar / salir ---------- */
  async open() {
    if (this.on) return;
    this.on = true; this.prevState = this.g.state; this.g.state = 'zfight'; this.g.releaseMouse && this.g.releaseMouse();
    SFX.music && SFX.music('');
    const r = this.root = document.createElement('div'); r.id = 'zf';
    r.innerHTML = '<canvas class="zfc"></canvas><div class="zfui"></div><div class="zftouch"></div>';
    document.body.appendChild(r);
    this.cv = r.querySelector('.zfc'); this.ctx = this.cv.getContext('2d'); this.ui = r.querySelector('.zfui');
    this.onKey = (e) => this.key(e); addEventListener('keydown', this.onKey, true); addEventListener('keyup', this.onKey, true);
    this.onResize = () => this.resize(); addEventListener('resize', this.onResize); this.resize();
    r.addEventListener('click', (e) => this.click(e));
    this.ui.innerHTML = '<div class="zfload"><b>COMBATE Z</b><p>Preparando…</p></div>';
    try { await ZL3.script(ZL3.base + 'index.js'); }
    catch (e) { this.ui.innerHTML = '<div class="zfload"><b>COMBATE Z</b><p>No se encontraron los datos del modo (carpeta zl3).</p><button data-zf="exit">Volver</button></div>'; return; }
    await ZL3.image(ZL3.base + 'faces.webp').catch(() => null);
    this.showSetup();
  }
  close() {
    this.stopLoop(); ZSnd.stopAll();
    removeEventListener('keydown', this.onKey, true); removeEventListener('keyup', this.onKey, true); removeEventListener('resize', this.onResize);
    if (this.root) this.root.remove(); this.root = null; this.on = false; this.match = null;
    this.g.state = 'menu'; this.g.clock && this.g.clock.getDelta(); SFX.music && SFX.music('menu');
    this.g.ui.renderMenu && this.g.ui.renderMenu();
  }
  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.W = innerWidth; this.H = innerHeight; this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr); this.dpr = dpr;
    // Escala a píxel entero (nítido): la altura de la vista mide unos ZK.VIEW_H píxeles del sprite
    this.S = Math.max(2, Math.round(this.cv.height / ZK.VIEW_H));
  }
  /* ---------- Teclado (solo mientras el modo está abierto) ---------- */
  key(e) {
    if (!this.on) return;
    const down = e.type === 'keydown';
    if (e.code === 'Escape' && down) { if (this.match && !this.match.over) this.togglePause(); e.stopPropagation(); e.preventDefault(); return; }
    this.keys[e.code] = down;
    if (this.match) { e.stopPropagation(); if (!/F\d+/.test(e.code)) e.preventDefault(); }
    if (down && (e.code === 'Enter' || e.code === 'Space') && this.cutT > 0 && this.cutSkip) this.cutT = Math.min(this.cutT, 0.01);
  }
  readHuman(f) {
    const k = this.keys, t = this.touch || {}, pad = this.pad();
    const b = (codes, tk, pb) => codes.some((c) => k[c]) || !!t[tk] || !!(pad && pad[pb]);
    Object.assign(f.ctl, {
      l: b(['KeyA', 'ArrowLeft'], 'l', 'l'), r: b(['KeyD', 'ArrowRight'], 'r', 'r'), u: b(['KeyW', 'ArrowUp'], 'u', 'u'), d: b(['KeyS', 'ArrowDown'], 'd', 'd'),
      a1: b(['KeyJ'], 'a1', 'a1'), a2: b(['KeyK'], 'a2', 'a2'), a3: b(['KeyL'], 'a3', 'a3'), blast: b(['KeyU'], 'blast', 'blast'),
      s1: b(['KeyI'], 's1', 's1'), s2: b(['KeyO'], 's2', 's2'), sup: b(['KeyP'], 'sup', 'sup'), ult: b(['Semicolon', 'KeyM'], 'ult', 'ult'),
      dash: b(['ShiftLeft', 'ShiftRight', 'Space'], 'dash', 'dash'), tp: b(['KeyH'], 'tp', 'tp'), chg: b(['KeyC'], 'chg', 'chg'), rush: b(['KeyE'], 'rush', 'rush'),
      tag: b(['KeyQ'], 'tag', 'tag'), spark: b(['KeyV'], 'spark', 'spark')
    });
  }
  pad() {
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find((g) => g && g.connected) : null; if (!gp) return null;
    const B = (i) => gp.buttons[i] && gp.buttons[i].pressed, ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    return { l: ax < -0.4 || B(14), r: ax > 0.4 || B(15), u: ay < -0.6 || B(12), d: ay > 0.5 || B(13), a1: B(2), a2: B(3), a3: B(1), blast: B(0) && !B(5), s1: B(4) && B(2), s2: B(4) && B(3),
      sup: B(4) && B(1), ult: B(4) && B(0), dash: B(5) && !B(0), tp: B(5) && B(0), chg: B(6), rush: B(7), tag: B(8), spark: B(9) && B(4) };
  }

  /* ---------- Pantalla de preparación: tamaño del equipo, dificultad, escenario y luchadores ---------- */
  face(id, kind, w, h) { return '<canvas class="zface" width="' + w + '" height="' + h + '" data-zface="' + id + '" data-k="' + (kind || 'b') + '"></canvas>'; }
  drawFaces(el) {
    const I = ZL3.index, img = ZL3.img[ZL3.base + 'faces.webp']; if (!img) return;
    for (const cv of el.querySelectorAll('canvas[data-zface]')) {
      const F = I.faces[cv.dataset.zface]; const r = F && (F[cv.dataset.k] || F.b || F.f); if (!r) continue;
      const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, cv.width, cv.height);
      const k = Math.min(cv.width / r[2], cv.height / r[3]); g.drawImage(img, r[0], r[1], r[2], r[3], (cv.width - r[2] * k) / 2, cv.height - r[3] * k, r[2] * k, r[3] * k);
    }
  }
  showSetup() {
    const S = this.setup, I = ZL3.index, R = I.roster;
    S.p = S.p.filter((id) => R.some((r) => r.id === id)).slice(0, S.size); S.c = S.c.slice(0, S.size);
    const team = (L, who) => [...Array(S.size).keys()].map((k) => { const id = L[k]; const r = id && R.find((x) => x.id === id);
      return '<div class="zslot' + (who === S.pick && k === L.length ? ' on' : '') + '">' + (r ? this.face(id, 'b', 60, 90) + '<b>' + r.name + '</b>' : '<i>?</i><b>' + (who === 'c' ? 'Al azar' : 'Elige') + '</b>') + '</div>'; }).join('');
    S.pick = S.p.length < S.size ? 'p' : S.c.length < S.size && S.cpick ? 'c' : 'p';
    const grid = R.map((r) => '<div class="zch' + (S.p.includes(r.id) ? ' pl' : '') + (S.c.includes(r.id) ? ' cp' : '') + '" data-zfch="' + r.id + '" title="' + r.name + '">' + this.face(r.id, 'f', 40, 56) + '<span>' + r.name + '</span></div>').join('');
    const ok = S.p.length === S.size;
    const btn = (k, v, t) => '<button class="zseg' + (S[k] === v ? ' on' : '') + '" data-zfset="' + k + ':' + v + '">' + t + '</button>';
    const best = Save.d.zstats || {};
    this.ui.innerHTML = '<div class="zset">' +
      '<div class="zhead"><button class="zback" data-zf="exit">◀ Salir</button><h1>COMBATE Z</h1><span class="zsub">Lucha 2D · ' + R.length + ' guerreros · Victorias: ' + (best.wins || 0) + '</span></div>' +
      '<div class="zrow"><div class="zopt"><span>Equipos</span>' + btn('size', 1, '1 vs 1') + btn('size', 2, '2 vs 2') + btn('size', 3, '3 vs 3') + '</div>' +
        '<div class="zopt"><span>Dificultad</span>' + btn('diff', 'easy', 'Fácil') + btn('diff', 'normal', 'Normal') + btn('diff', 'hard', 'Difícil') + '</div>' +
        '<div class="zopt"><span>Escenario</span><select data-zfstage><option value="random">Al azar</option>' + I.stages.map((s) => '<option value="' + s.id + '"' + (S.stage === s.id ? ' selected' : '') + '>' + s.name + '</option>').join('') + '</select></div></div>' +
      '<div class="zteams"><div class="zteam me"><span>TU EQUIPO</span>' + team(S.p, 'p') + '</div><div class="zvs">VS</div><div class="zteam cpu"><span>CPU · ' + ZK.DIFF[S.diff].name + '</span>' + team(S.c, 'c') + '</div></div>' +
      '<div class="zgrid">' + grid + '</div>' +
      '<div class="zfoot"><button class="zclr" data-zf="clear">Borrar</button><button class="zcpu" data-zf="cpu">' + (S.cpick ? 'Elegir para mí' : 'Elegir rivales') + '</button><button class="zgo" data-zf="go"' + (ok ? '' : ' disabled') + '>¡A LUCHAR!</button></div>' +
      '<p class="zhelp">Teclado: A/D moverse · W saltar · S agacharse · atrás = cubrirse · J/K/L golpe leve/medio/fuerte · U ráfaga de ki · I/O especiales · P súper · M ultimate (3 barras de ki) · Mayús dash · H teletransporte · C cargar ki · E Dragon Rush · Q cambiar de guerrero · V Sparking · Esc pausa</p>' +
      '</div>';
    this.drawFaces(this.ui);
  }
  click(e) {
    const t = e.target.closest('[data-zf],[data-zfch],[data-zfset],[data-ztouch]'); if (!t) return;
    const S = this.setup, D = t.dataset;
    if (D.zfch) {
      const L = S.cpick ? S.c : S.p;
      const i = L.indexOf(D.zfch);
      if (i >= 0) L.splice(i, 1); else if (L.length < S.size) L.push(D.zfch);
      SFX.play && SFX.play('select'); this.showSetup(); return;
    }
    if (D.zfset) { const [k, v] = D.zfset.split(':'); S[k] = k === 'size' ? +v : v; if (k === 'diff') { Save.d.zdiff = v; Save.write(); } this.showSetup(); return; }
    if (D.zf === 'exit') { this.close(); return; }
    if (D.zf === 'clear') { if (S.cpick) S.c = []; else S.p = []; this.showSetup(); return; }
    if (D.zf === 'cpu') { S.cpick = !S.cpick; this.showSetup(); return; }
    if (D.zf === 'go') { this.startMatch(); return; }
    if (D.zf === 'resume') { this.togglePause(); return; }
    if (D.zf === 'quit') { this.stopLoop(); ZSnd.stopAll(); this.match = null; this.showSetup(); return; }
    if (D.zf === 'again') { this.startMatch(); return; }
    if (D.zf === 'setup') { this.match = null; this.showSetup(); return; }
  }
  /* ---------- Empezar combate ---------- */
  async startMatch() {
    const S = this.setup, R = ZL3.index.roster.map((r) => r.id);
    const rnd = (excl) => { const L = R.filter((id) => !excl.includes(id)); return L[(Math.random() * L.length) | 0]; };
    const p = S.p.slice(), c = S.c.slice(); while (c.length < S.size) c.push(rnd(p.concat(c)));
    const stage = S.stage === 'random' ? ZL3.index.stages[(Math.random() * ZL3.index.stages.length) | 0].id : S.stage;
    this.ui.innerHTML = '<div class="zfload"><b>COMBATE Z</b><p class="zlt">Preparando el combate…</p><div class="zbar"><i></i></div><small>La primera vez se descargan los datos de cada guerrero (luego van más rápido)</small></div>';
    const bar = this.ui.querySelector('.zbar i'), lt = this.ui.querySelector('.zlt');
    try { await ZL3.need(p.concat(c), stage, (k, txt) => { bar.style.width = (k * 100).toFixed(0) + '%'; if (txt) lt.textContent = txt; }); }
    catch (e) { console.error(e); this.ui.innerHTML = '<div class="zfload"><b>COMBATE Z</b><p>No se pudieron descargar los datos (' + e.message + '). Revisa tu conexión.</p><button data-zf="setup">Volver</button></div>'; return; }
    this.ui.innerHTML = '<div class="zhud"></div>';
    this.buildTouch();
    const D = ZK.DIFF[S.diff];
    const st = ZL3.index.stages.find((s) => s.id === stage);
    this.match = {
      diff: S.diff, D, stage: st, bg: ZL3.img[ZL3.base + 's/' + stage + '.webp'], t: 0, timer: 99 + 60 * (S.size - 1), over: false, paused: false,
      teams: [p.map((id) => new ZFighter(this, id, 0, false, D)), c.map((id) => new ZFighter(this, id, 1, true, D))],
      act: [0, 0], proj: [], beams: [], fx: [], hitstop: 0, shakeT: 0, cam: ZK.ARENA / 2, flash: 0, banner: null, phase: 'intro', phaseT: 0, introStep: 0, stats: { maxCombo: 0, dmg: 0 }
    };
    const M = this.match, a = M.teams[0][0], b = M.teams[1][0];
    a.reset(ZK.ARENA / 2 - 70, 1); b.reset(ZK.ARENA / 2 + 70, -1);
    this.cutT = 0; this.cut = null; this.voiceT = 0;
    this.introNext();
    this.startLoop();
  }
  active(team) { const M = this.match; if (!M) return null; return M.teams[team][M.act[team]]; }
  fighters() { const M = this.match; return [this.active(0), this.active(1)].filter(Boolean); }
  voiceOk(f) { const now = performance.now(); if (now - (this['vt' + f.team] || 0) < 450) return false; this['vt' + f.team] = now; return true; }
  /* Intro: cada guerrero hace su entrada (su cinemática si la tiene) */
  introNext() {
    const M = this.match, step = M.introStep++;
    if (step >= 2) { M.phase = 'fight'; this.banner('¡A LUCHAR!', 1.1); ZSnd.play('explosaodeenergia', 0.5); for (const f of this.fighters()) { f.state = 'idle'; f.set('Parado'); } return; }
    const f = this.active(step); M.phase = 'intro'; M.phaseT = 0; f.state = 'intro'; f.introI = 0;
    if (f.mv.cutIntro.length && step === 0) this.playCut(f, f.mv.cutIntro, 2.6);
    f.set(f.mv.intro[0] || 'Parado');
  }
  /* ---------- Bucle ---------- */
  startLoop() {
    this.stopLoop(); this.last = performance.now();
    const loop = (now) => { if (!this.on || !this.match) return; this.raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.frame(dt); };
    this.raf = requestAnimationFrame(loop);
  }
  stopLoop() { cancelAnimationFrame(this.raf); this.raf = 0; }
  togglePause() {
    const M = this.match; if (!M || M.over) return;
    M.paused = !M.paused;
    let p = this.root.querySelector('.zpause'); if (p) p.remove();
    if (M.paused) { p = document.createElement('div'); p.className = 'zpause'; p.innerHTML = '<b>PAUSA</b><button data-zf="resume">Continuar</button><button data-zf="quit">Abandonar</button>'; this.ui.appendChild(p); }
    this.last = performance.now();
  }
  frame(dt) {
    const M = this.match;
    if (!M.paused) {
      if (this.cutT > 0) { this.cutT -= dt; this.cutTime += dt; }
      else this.step(dt);
    }
    this.draw();
  }
  step(dt) {
    const M = this.match; M.t += dt; M.phaseT += dt;
    if (M.timers && M.timers.length) { for (const x of M.timers) { x.t -= dt; if (x.t <= 0 && !x.done) { x.done = true; x.f(); } } M.timers = M.timers.filter((x) => !x.done); }
    if (M.hitstop > 0) { M.hitstop -= dt; this.stepFx(dt * 0.2); return; }
    const F = this.fighters();
    for (const f of F) {
      if (M.phase === 'fight' && !M.over) { if (f.cpu) f.ai.think(dt); else this.readHuman(f); }
      else for (const k in f.ctl) f.ctl[k] = false;
      if (M.phase === 'intro' && f.state === 'intro') {
        if (f.done) { f.introI++; const n = f.mv.intro[f.introI]; if (n) f.set(n); else { f.state = 'ready'; f.set('Parado'); this.introNext(); } }
        if (M.phaseT > 4) { f.state = 'ready'; f.set('Parado'); this.introNext(); }
      }
      f.update(dt);
      this.physics(f, dt);
      f.stepAnim(dt * (f.spark > 0 ? 1.15 : 1));
    }
    // Empujarse: no se atraviesan
    if (F.length === 2) {
      const [a, b] = F, dx = b.x - a.x;
      if (Math.abs(dx) < 18 && Math.abs(a.y - b.y) < 40 && a.state !== 'tp' && b.state !== 'tp') { const push = (18 - Math.abs(dx)) / 2 * (dx >= 0 ? 1 : -1); a.x -= push; b.x += push; }
    }
    this.stepProj(dt); this.stepBeams(dt); this.stepFx(dt);
    if (M.phase === 'fight' && !M.over) {
      M.timer -= dt; if (M.timer <= 0) this.timeUp();
    }
    // Cámara: entre los dos, dentro del escenario
    const mid = F.length === 2 ? (F[0].x + F[1].x) / 2 : ZK.ARENA / 2, vw = this.cv.width / this.S;
    M.cam += (mid - M.cam) * Math.min(1, dt * 6); M.cam = zclamp(M.cam, Math.min(vw / 2, ZK.ARENA / 2), Math.max(ZK.ARENA - vw / 2, ZK.ARENA / 2));
    M.camY = (M.camY || 0) + ((Math.max(0, Math.max(...F.map((f) => f.y)) - 70) * 0.7) - (M.camY || 0)) * Math.min(1, dt * 4);
    if (M.shakeT > 0) M.shakeT -= dt; if (M.flash > 0) M.flash -= dt * 2.5;
    if (M.banner) { M.banner.t -= dt; if (M.banner.t <= 0) M.banner = null; }
    if (M.over) { M.overT += dt; if (M.overT > 3.2 && !M.shown) this.showResult(); }
  }
  physics(f, dt) {
    if (f.state === 'tp' && f.fi < 2) return;
    if (f.state === 'rushed' || (f.state === 'special' && f.sp && f.sp.hold)) { f.vy = 0; return; }
    f.x += f.vx * dt; f.y += f.vy * dt;
    if (f.y > 0 || f.vy > 0) {
      const g = f.state === 'launched' ? ZK.GRAV * 0.75 : f.state === 'hitstun' && f.air ? ZK.GRAV * 0.45 : f.state === 'attack' || f.state === 'special' ? ZK.GRAV * 0.5 : ZK.GRAV;
      f.vy -= g * dt;
    }
    if (f.y <= 0 && f.vy <= 0) {
      const wasAir = f.y < 0 || f.vy < -60; f.y = 0;
      if (f.state === 'launched' || (f.state === 'hitstun' && f.vy < -30 && f.airHit)) {
        f.state = f.hp <= 0 ? 'ko' : 'down'; f.st = 0; f.vx *= 0.3; f.set('Caido'); f.airHit = false; this.shake(0.25); this.fxAt('poeira5/Default', f.x, 0, 1, 1); ZSnd.play('caindo', 0.6);
        if (f.hp <= 0) this.onKO(f);
      } else if (wasAir && (f.state === 'jump')) { f.state = 'idle'; f.set('CaidoAposPulo'); this.fxAt('poeiradesaltoequeda_sprite/Queda', f.x, 0, 1, 1); }
      f.vy = 0;
    }
    if (f.y > 150) { f.y = 150; f.vy = Math.min(f.vy, 0); }
    f.x = zclamp(f.x, 6, ZK.ARENA - 6);
  }

  /* ---------- Golpes ---------- */
  /** Punto de impacto de un golpe cuerpo a cuerpo: el «Imagepoint 1» del fotograma (el puño) o el borde del sprite */
  hitPoint(f) {
    const fr = f.cur[3][f.fi], ax = fr[4], ay = fr[5];
    if (fr[7] >= 0) return [f.x + f.face * (fr[7] - ax), f.y + (ay - fr[8])];
    return [f.x + f.face * (fr[2] - ax) * 0.9, f.y + fr[3] * 0.55];
  }
  meleeHit(f, mv) {
    const o = f.foe(); if (!o || o.out || o.inv > 0 || o.state === 'tp' || o.state === 'ko' || o.state === 'down') return;
    const [hx, hy] = this.hitPoint(f);
    const reach = mv.kind === 'heavy' ? 16 : 13;
    if (Math.abs(hx - o.x) > ZK.HURT_W + reach || hy < o.y - 6 || hy > o.y + ZK.HURT_H + 10 || (o.x - f.x) * f.face < -6) return;
    mv.landed = true;
    this.damage(f, o, ZK.DMG[mv.kind] || ZK.DMG.light, { kind: mv.kind, launch: mv.launch, x: hx, y: hy });
  }
  /** Daño, defensa, aturdimiento y lanzamientos */
  damage(f, o, base, h) {
    const M = this.match, mul = (f.cpu ? M.D.dmgIn : M.D.dmgOut) * (f.spark > 0 ? 1.25 : 1);
    if (o.canBlock(f) && h.kind !== 'ult' && h.kind !== 'rush') {
      const chip = Math.round(base * (h.kind === 'sup' ? 0.25 : 0.12) * mul); o.hp = Math.max(1, o.hp - chip);
      o.state = 'block'; o.st = 0; o.blockT = h.kind === 'heavy' ? 0.32 : 0.22; o.set(o.an === 'Defesa_Agachado' ? 'Defesa_Agachado' : 'Defesa_Chao'); o.vx = -o.face * (h.kind === 'heavy' ? 120 : 60);
      o.ki = Math.min(ZK.KI, o.ki + 6); this.fxAt('defesa_effect_sprite/Default', o.x + o.face * 8, o.y + 24, o.face, 1); ZSnd.play('guard_breaker', 0.45); M.hitstop = 0.04; return false;
    }
    const scale = Math.max(0.35, 1 - f.combo * 0.06), dmg = Math.round(base * mul * scale);
    o.hp = Math.max(0, o.hp - dmg); f.combo++; o.combo++; M.stats[f.team === 0 ? 'dmg' : 'dmgIn'] = (M.stats[f.team === 0 ? 'dmg' : 'dmgIn'] || 0) + dmg;
    if (f.team === 0) M.stats.maxCombo = Math.max(M.stats.maxCombo, f.combo);
    f.ki = Math.min(ZK.KI, f.ki + 8 + dmg * 0.05); o.ki = Math.min(ZK.KI, o.ki + 4);
    f.comboT = 1.2; o.sp = null; o.mv2 = null; o.charging = false;
    const big = h.kind === 'heavy' || h.kind === 'sup' || h.kind === 'ult' || h.kind === 's1' || h.kind === 's2' || h.kind === 'rush';
    ZSnd.play(h.kind === 'light' ? 'hit_small-a' : h.kind === 'med' || h.kind === 'blast' ? 'hit_midle-a' : h.kind === 'ult' || h.kind === 'sup' ? 'hit_xlarge' : 'hit_large-a', 0.6);
    this.fxAt(big ? 'efeitodeimpacto_sprite/Extreme' : (Math.random() < 0.5 ? 'hit_sprite/Default' : 'hit_sprite/Hit2'), h.x != null ? h.x : o.x, h.y != null ? h.y : o.y + 26, f.face, big ? 1.2 : 1);
    M.hitstop = big ? 0.11 : 0.055; if (big) this.shake(h.kind === 'ult' ? 0.7 : 0.35);
    o.face = f.x >= o.x ? 1 : -1;
    const dir = f.x <= o.x ? 1 : -1;
    if (o.hp <= 0 || h.launch || h.kind === 'sup' || h.kind === 'ult' || h.kind === 's1' || h.kind === 's2' || h.kind === 'rush') {
      o.state = 'launched'; o.st = 0; o.wallT = null; o.airHit = true;
      if (h.launch === 'up') { o.vx = dir * 40; o.vy = 400; o.set('SendoLancado_CIMA'); }
      else if (h.launch === 'down' && o.air) { o.vx = dir * 60; o.vy = -420; o.set('Dano_Aereo3'); }
      else { o.vx = dir * (h.kind === 'ult' ? 330 : 250); o.vy = 170; o.set('SendoLancado_LADO'); }
      o.y = Math.max(o.y, 1);
    } else {
      o.state = 'hitstun'; o.st = 0; o.hitstun = h.kind === 'light' ? 0.32 : h.kind === 'light3' || h.kind === 'med' ? 0.42 : 0.36;
      o.vx = dir * (h.kind === 'blast' ? 60 : 45);
      if (o.air) { o.airHit = true; o.vy = 140; o.set(['Dano_Aereo1', 'Dano_Aereo2'][o.combo % 2]); } else o.set(o.combo % 2 ? 'Dano_Chao2' : 'Dano_Chao1');
    }
    if (o.hp <= 0 && !o.air && o.state !== 'launched') this.onKO(o);
    return true;
  }
  onKO(o) {
    const M = this.match; if (o.out) return;
    o.out = true; o.state = 'ko'; o.inv = 99; M.hitstop = 0.35; M.flash = 0.8; this.shake(0.8);
    this.fxAt('ko_txt_sprite/Default', o.x, o.y + 60, 1, 1.2);
    const team = M.teams[o.team], next = team.findIndex((f, i) => i > M.act[o.team] && !f.out);
    this.after(1.4, () => {
      if (next >= 0) {
        M.act[o.team] = next; const n = team[next], foe = this.active(1 - o.team);
        n.reset(o.team === 0 ? Math.max(20, foe.x - 110) : Math.min(ZK.ARENA - 20, foe.x + 110), o.team === 0 ? 1 : -1);
        n.state = 'tagin'; n.st = 0; n.set('Troca_De_Personagem'); n.inv = 0.8; this.banner(n.m.name.toUpperCase() + ' ENTRA', 1.2);
        if (n.m.voice.Troca_De_Personagem == null && n.mv.intro[0]) { /* sin voz propia */ }
      } else this.endMatch(1 - o.team);
    });
  }
  /* ---------- Cambiar de guerrero (Q) ---------- */
  canTag(f) { const M = this.match, T = M.teams[f.team]; return T.length > 1 && T.some((x, i) => i !== M.act[f.team] && !x.out) && (f.tagCd || 0) < M.t; }
  tag(f) {
    const M = this.match, T = M.teams[f.team]; let i = M.act[f.team];
    for (let k = 1; k <= T.length; k++) { const j = (i + k) % T.length; if (!T[j].out) { i = j; break; } }
    if (i === M.act[f.team]) return;
    const n = T[i]; f.state = 'idle'; f.sp = null;
    M.act[f.team] = i; n.reset(f.x, f.face); n.hp = n.hp; n.state = 'tagin'; n.st = 0; n.set('Change_Pt1'); n.inv = 0.5; n.tagCd = M.t + 3;
    this.fxAt('efeito_quebravento_sprite/QuebraVento2', f.x, 24, f.face, 1); ZSnd.play('teletransporte', 0.6);
    // El que sale recupera un poco de vida en el banquillo
    f.hp = Math.min(f.maxHp, f.hp + 40);
  }
  /* ---------- Especiales ---------- */
  specialUpdate(f, dt) {
    const sp = f.sp; if (!sp) { f.state = 'idle'; return; }
    sp.t = (sp.t || 0) + dt;
    if (sp.type === 'rush' && sp.step === 0 && sp.kind !== 'blast') {
      // Embestida: avanza hasta el rival
      const o = f.foe(); f.vx = f.face * (sp.kind === 'ult' ? 360 : 300);
      if (o && Math.abs(o.x - f.x) < 26 && !sp.fired) { sp.fired = true; f.vx = 0; this.specialHit(f, sp, o); }
    }
    if (sp.beam && sp.beam.t > sp.beam.life && !sp.ended) { sp.ended = true; this.nextStep(f, true); }
    if (f.sp === sp && f.done) this.nextStep(f);
    if (f.sp === sp && sp.t > 6) { f.state = 'idle'; f.sp = null; }
  }
  nextStep(f, force) {
    const sp = f.sp; if (!sp) return;
    if (sp.beam && !force && sp.beam.t < sp.beam.life) { return; }       // el rayo sigue: la pose del medio se queda
    if (sp.type === 'rush' && sp.step === 0 && !sp.fired) {                 // falló la embestida
      if (f.mv && sp.S && sp.S.miss && f.A[sp.S.miss]) { sp.step = 99; f.set(sp.S.miss); return; }
    }
    sp.step++;
    if (sp.step < sp.seq.length) { f.set(sp.seq[sp.step]); sp.fireF = f.fireFrame(sp.seq[sp.step]); return; }
    f.state = f.air ? 'jump' : 'idle'; f.st = 0; f.sp = null; f.vx = 0;
  }
  specialFrame(f) {
    const sp = f.sp; if (!sp || sp.fired || sp.type === 'rush' && sp.kind !== 'blast') return;
    const last = sp.seq.length === 1 || sp.step === Math.min(sp.seq.length - 1, sp.type === 'beam' ? 0 : sp.seq.length - 1);
    if (!(last && f.fi === sp.fireF) && !(sp.seq.length > 1 && sp.step === 1 && f.fi === 0 && sp.type === 'beam')) return;
    if (sp.type === 'beam' && sp.seq.length > 1 && sp.step === 0) return;   // el rayo sale al empezar la segunda parte
    sp.fired = true;
    const fr = f.cur[3][f.fi], [hx, hy] = fr[7] >= 0 ? [f.x + f.face * (fr[7] - fr[4]), f.y + (fr[5] - fr[8])] : [f.x + f.face * 18, f.y + 26];
    const kind = sp.kind, dmg = ZK.DMG[kind] || ZK.DMG.s2, M = this.match;
    if (sp.type === 'kb') {
      M.proj.push({ f, x: hx, y: hy, vx: f.face * 300, vy: 0, anim: f.mv.kb, t: 0, r: 7, dmg: ZK.DMG.blast, kind: 'blast', life: 1.6 });
    } else if (sp.type === 'beam') {
      sp.beam = { f, x: hx, y: hy, dir: f.face, len: 0, life: kind === 'ult' ? 1.6 : kind === 'sup' ? 1.2 : 0.9, t: 0, col: f.mv.beam, dmg, kind, tick: 0, hits: 0, w: kind === 'ult' ? 1.8 : kind === 'sup' ? 1.4 : 1 };
      M.beams.push(sp.beam); this.shake(0.3);
      if (f.A[sp.seq[sp.step]] && sp.seq.length > 1) { /* la pose del rayo se queda mientras dure */ }
    } else if (sp.type === 'bigball') {
      const an = f.mv.big && ZL3.fx[f.mv.big] ? f.mv.big : 'esferadekigigante_sprite/Goku';
      // Esfera gigante: se escala para medir ~60 px (ultimate ~84) aunque el sprite original sea enorme
      const fw = ZL3.fx[an][3][0][2], want = kind === 'ult' ? 84 : 58;
      M.proj.push({ f, x: hx + f.face * 10, y: Math.max(hy, 40), vx: f.face * 150, vy: -20, anim: an, t: 0, r: want * 0.42, dmg, kind, life: 3, big: true, sc: want / fw });
    } else {
      const n = kind === 's2' ? 3 : 5;
      for (let k = 0; k < n; k++) M.proj.push({ f, x: hx, y: hy, vx: f.face * (260 + k * 40), vy: (k - (n - 1) / 2) * 30, anim: f.mv.kb, t: -k * 0.06, r: 8, dmg: dmg / n * 1.3, kind, life: 1.8 });
    }
  }
  specialHit(f, sp, o) {
    const ok = this.damage(f, o, ZK.DMG[sp.kind] || ZK.DMG.s1, { kind: sp.kind, x: o.x, y: o.y + 26 });
    if (ok && sp.S && sp.S.hit && f.A[sp.S.hit]) { sp.step = 99; f.set(sp.S.hit); }
  }
  superFlash(f, kind) {
    const M = this.match; M.hitstop = Math.max(M.hitstop, kind === 'ult' ? 0.25 : 0.18); M.flash = 0.5;
    this.fxAt('aura_sprite/' + f.mv.aura, f.x, f.y, 1, 1.1);
    this.banner(kind === 'spark' ? '¡SPARKING!' : (kind === 'ult' ? '★ ' : '') + f.m.name.toUpperCase(), 0.9, f.team);
  }
  /* ---------- Dragon Rush (E): si conecta, ráfaga de golpes y lanzamiento ---------- */
  rushUpdate(f, dt) {
    const o = f.foe();
    if (f.rushStep === 0) {
      f.vx = f.face * 280;
      if (o && Math.abs(o.x - f.x) < 24 && !o.out && o.inv <= 0 && o.state !== 'tp') {
        if (o.canBlock(f) && Math.random() < 0.3) { f.state = 'idle'; f.vx = -f.face * 80; this.damage(f, o, 10, { kind: 'light' }); return; }
        f.rushStep = 1; f.vx = 0; o.state = 'rushed'; o.vx = 0; o.set('Dano_Chao1'); f.set('Dragon_Rush_Pt2'); this.shake(0.4); ZSnd.play('hit_large-a', 0.6);
        this.fxAt('explosaodeki_effect_sprite/DragonRush', (f.x + o.x) / 2, f.y + 26, 1, 1.2);
      } else if (f.done || f.st > 0.6) { f.state = 'idle'; f.vx = 0; }
      return;
    }
    if (f.done) {
      f.rushStep++;
      const nx = ['Dragon_Rush_Pt3', 'Dragon_Rush_Pt4'][f.rushStep - 2];
      if (o && f.rushStep <= 3) { o.set(f.rushStep % 2 ? 'Dano_Chao2' : 'Dano_Chao1'); this.fxAt('hit_sprite/Hit3', o.x, o.y + 28, f.face, 1); ZSnd.play('hit_midle-a', 0.5); }
      if (nx) f.set(nx);
      else { f.state = 'idle'; if (o) { o.state = 'idle'; this.damage(f, o, ZK.DMG.rush, { kind: 'rush', launch: 'side', x: o.x, y: o.y + 26 }); } }
    }
  }
  /* ---------- Proyectiles y rayos ---------- */
  stepProj(dt) {
    const M = this.match;
    for (const p of M.proj) {
      p.t += dt; if (p.t < 0) continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const o = p.f.foe();
      if (o && !o.out && o.inv <= 0 && o.state !== 'tp' && Math.abs(o.x - p.x) < p.r + ZK.HURT_W && p.y > o.y - p.r && p.y < o.y + ZK.HURT_H + p.r) {
        p.dead = true; this.damage(p.f, o, p.dmg, { kind: p.kind, x: p.x, y: p.y });
        this.fxAt(p.big ? 'explosao_sprite/Explosao3' : 'efeito_de_kiblast_sprite/Default', p.x, p.y, 1, p.big ? 1.6 : 1); if (p.big) ZSnd.play('explosaodeenergia', 0.7);
      }
      // Choque de proyectiles
      for (const q of M.proj) if (q !== p && !q.dead && q.f.team !== p.f.team && Math.abs(q.x - p.x) < q.r + p.r && Math.abs(q.y - p.y) < q.r + p.r) { if (!p.big) p.dead = true; if (!q.big) q.dead = true; this.fxAt('efeito_de_kiblast_sprite/Default', p.x, p.y, 1, 1); }
      if (p.t > p.life || p.x < -40 || p.x > ZK.ARENA + 40) p.dead = true;
    }
    M.proj = M.proj.filter((p) => !p.dead);
  }
  stepBeams(dt) {
    const M = this.match;
    for (const b of M.beams) {
      b.t += dt; b.len = Math.min(560, b.len + 900 * dt); b.tick -= dt;
      const o = b.f.foe(); if (!o) continue;
      const tipX = b.x + b.dir * b.len, inX = (o.x - b.x) * b.dir > 0 && (o.x - b.x) * b.dir < b.len + 10;
      if (inX && Math.abs(o.y + 24 - b.y) < 20 * b.w && b.tick <= 0 && !o.out && o.inv <= 0 && o.state !== 'tp') {
        b.tick = 0.09; b.hits++;
        const per = b.dmg / 7;
        if (o.canBlock(b.f)) { o.hp = Math.max(1, o.hp - Math.round(per * 0.2)); o.state = 'block'; o.st = 0; o.blockT = 0.15; o.set('Defesa_Chao'); o.vx = b.dir * 50; }
        else {
          o.hp = Math.max(0, o.hp - Math.round(per * (b.f.cpu ? M.D.dmgIn : M.D.dmgOut)));
          o.state = 'hitstun'; o.st = 0; o.hitstun = 0.25; o.set('Dano_Chao1'); o.vx = b.dir * 70; o.sp = null;
          if (b.hits % 3 === 1) { ZSnd.play('hit_midle-a', 0.4); this.fxAt('hit_sprite/Default', o.x, o.y + 26, b.dir, 1); }
          if (b.hits >= 7 || o.hp <= 0) { b.t = b.life; this.damage(b.f, o, 1, { kind: b.kind === 's2' ? 's2' : 'sup', x: o.x, y: o.y + 26 }); this.fxAt('explosao_sprite/Explosao1', o.x, o.y + 24, 1, 1.4); }
        }
      }
      if (b.f.state !== 'special' || b.f.out) b.t = b.life;
      b.tipX = tipX;
    }
    M.beams = M.beams.filter((b) => b.t < b.life);
  }
  /* ---------- Efectos ---------- */
  fxAt(name, x, y, face, sc) { const a = ZL3.fx && ZL3.fx[name]; if (!a) return; this.match.fx.push({ a, x, y, face: face || 1, sc: sc || 1, fi: 0, ft: 0 }); }
  stepFx(dt) {
    const M = this.match;
    for (const e of M.fx) {
      const a = e.a, sp = a[0] || 15; e.ft += dt;
      while (e.ft >= (a[3][e.fi][6] || 1) / sp) { e.ft -= (a[3][e.fi][6] || 1) / sp; e.fi++; if (e.fi >= a[3].length) { e.dead = true; break; } }
    }
    M.fx = M.fx.filter((e) => !e.dead);
  }
  /** Algo dentro de t segundos del combate (se para con la pausa y las cinemáticas) */
  after(t, f) { (this.match.timers || (this.match.timers = [])).push({ t, f }); }
  shake(t) { this.match.shakeT = Math.max(this.match.shakeT, t); }
  banner(txt, t, team) { this.match.banner = { txt, t, T: t, team }; }
  /* ---------- Cinemáticas (paneles grandes de Z Legends 3) ---------- */
  playCut(f, names, max) {
    const C = f.m.cut; if (!C || !f.m.cutAtlas) return;
    const frames = [];
    for (const n of names) { const a = C[n]; if (!a) continue; const sp = a[0] || 12; for (const fr of a[3]) frames.push([fr, (fr[6] || 1) / sp]); }
    if (!frames.length) return;
    let tot = frames.reduce((s, x) => s + x[1], 0);
    const k = tot > max ? max / tot : 1; frames.forEach((x) => { x[1] *= k; }); tot = Math.min(tot, max);
    this.cut = { f, frames, img: f.m.cutAtlas }; this.cutT = tot; this.cutTime = 0; this.cutSkip = true;
  }
  /* ---------- Final ---------- */
  timeUp() {
    const M = this.match, hpOf = (t) => M.teams[t].reduce((s, f) => s + (f.out ? 0 : f.hp), 0);
    this.endMatch(hpOf(0) >= hpOf(1) ? 0 : 1);
  }
  endMatch(winner) {
    const M = this.match; if (M.over) return;
    M.over = true; M.overT = 0; M.win = winner; M.timer = Math.max(0, M.timer);
    const w = this.active(winner);
    if (w) { w.state = 'win'; w.vx = 0; w.set(w.mv.win[0] || 'Pose_De_Vitoria'); }
    this.banner(winner === 0 ? '¡VICTORIA!' : 'DERROTA', 3);
    if (w && w.mv.cutWin.length && winner === 0) this.after(1.3, () => this.playCut(w, w.mv.cutWin, 2.4));
    // Premios
    if (winner === 0) {
      const D = M.D, n = M.teams[0].length, zeni = D.zeni * n, cry = D.cry * n;
      Save.d.zeni += zeni; Save.d.crystals = (Save.d.crystals || 0) + cry;
      const S = Save.d.zstats || (Save.d.zstats = {}); S.wins = (S.wins || 0) + 1; S['w_' + M.diff] = (S['w_' + M.diff] || 0) + 1;
      M.prize = { zeni, cry };
      if (this.g.track) { this.g.track('zwins', 1); }
    } else { const S = Save.d.zstats || (Save.d.zstats = {}); S.losses = (S.losses || 0) + 1; M.prize = { zeni: 100, cry: 0 }; Save.d.zeni += 100; }
    Save.write();
  }
  showResult() {
    const M = this.match; M.shown = true;
    const won = M.win === 0;
    const el = document.createElement('div'); el.className = 'zres ' + (won ? 'win' : 'lose');
    el.innerHTML = '<b>' + (won ? '¡VICTORIA!' : 'DERROTA') + '</b><p>' + ZK.DIFF[M.diff].name + ' · ' + M.teams[0].length + ' vs ' + M.teams[1].length + ' · ' + M.stage.name + '</p>' +
      '<div class="zrs"><span>Combo máximo<b>' + M.stats.maxCombo + '</b></span><span>Daño hecho<b>' + Math.round(M.stats.dmg || 0) + '</b></span><span>Tiempo<b>' + Math.round(M.t) + ' s</b></span></div>' +
      '<div class="zpr">+' + M.prize.zeni + ' monedas' + (M.prize.cry ? ' · +' + M.prize.cry + ' cristales' : '') + '</div>' +
      '<div class="zrb"><button data-zf="again">Revancha</button><button data-zf="setup">Cambiar equipo</button><button data-zf="exit">Salir</button></div>';
    this.ui.appendChild(el);
  }

  /* =================================================================
     DIBUJO
     ================================================================= */
  draw() {
    const M = this.match, g = this.ctx, S = this.S, W = this.cv.width, H = this.cv.height;
    g.imageSmoothingEnabled = false;
    if (this.cutT > 0 && this.cut) return this.drawCut();
    // móvil: la pelea, por encima de los botones
    const floorY = this.touchOn ? Math.round(H * 0.6) : Math.round(H - S * 14), sh = M.shakeT > 0 ? (Math.random() - 0.5) * S * 4 * Math.min(1, M.shakeT * 3) : 0;
    const camX = M.cam - W / S / 2, camY = M.camY || 0;
    const sx = (x) => Math.round((x - camX) * S + sh), sy = (y) => Math.round(floorY - (y - camY) * S);
    // Fondo: el escenario entero en coordenadas del juego original (3,5 px del original = 1 px del sprite)
    const st = M.stage, bg = M.bg;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    if (bg) {
      const k = ZK.LAYOUT_K / st.k, top = sy(ZK.FLOOR_LY);   // borde de arriba del escenario en pantalla
      const bh = Math.round(bg.height / k * S);
      g.drawImage(bg, sx(0), top, Math.round(ZK.ARENA * S), bh);
      if (top + bh < H) g.drawImage(bg, 0, bg.height - 2, bg.width, 2, sx(0), top + bh - 1, Math.round(ZK.ARENA * S), H - top - bh + 1);   // suelo hasta abajo
      if (top > 0) { g.drawImage(bg, 0, 0, bg.width, 1, sx(0), 0, Math.round(ZK.ARENA * S), top); }
    }
    // Auras de carga y de Sparking (detrás)
    for (const f of this.fighters()) {
      if (f.charging || f.spark > 0 || (f.sp && (f.sp.kind === 'ult' || f.sp.kind === 'sup') && f.sp.step === 0)) {
        const a = ZL3.fx['aura_sprite/' + f.mv.aura] || ZL3.fx['aura_sprite/Charge'];
        if (a) { const fr = a[3][((M.t * 14) | 0) % a[3].length]; this.blit(ZL3.img[ZL3.base + 'fx.webp'], fr, sx(f.x), sy(f.y), 1, S * 1.1, 0.85); }
      }
    }
    // Rayos
    const fxImg = ZL3.img[ZL3.base + 'fx.webp'];
    for (const b of M.beams) this.drawBeam(b, sx, sy, fxImg);
    // Luchadores (el que ataca, delante)
    const F = this.fighters().sort((a, b) => (a.state === 'attack' || a.state === 'special' ? 1 : 0) - (b.state === 'attack' || b.state === 'special' ? 1 : 0));
    for (const f of F) {
      const fr = f.cur[3][Math.min(f.fi, f.cur[3].length - 1)];
      // sombra
      g.fillStyle = 'rgba(0,0,0,.3)'; const sw = 14 * S * Math.max(0.4, 1 - f.y / 160); g.beginPath(); g.ellipse(sx(f.x), sy(0), sw, sw * 0.22, 0, 0, Math.PI * 2); g.fill();
      const blink = f.inv > 0 && f.state === 'idle' && ((M.t * 20) | 0) % 2;
      this.blit(f.m.atlas, fr, sx(f.x), sy(f.y), f.face, S, blink ? 0.5 : 1);
      if (f.spark > 0 && ((M.t * 10) | 0) % 2) { g.globalCompositeOperation = 'lighter'; this.blit(f.m.atlas, fr, sx(f.x), sy(f.y), f.face, S, 0.18); g.globalCompositeOperation = 'source-over'; }
    }
    // Proyectiles y efectos
    for (const p of M.proj) { if (p.t < 0) continue; const a = ZL3.fx[p.anim]; if (!a) continue; const fr = a[3][((p.t * (a[0] || 12)) | 0) % a[3].length]; this.blit(fxImg, fr, sx(p.x), sy(p.y - fr[3] / 2 * (p.sc || 1)), p.vx >= 0 ? 1 : -1, S * (p.sc || 1)); }
    for (const e of M.fx) { const fr = e.a[3][e.fi]; this.blit(fxImg, fr, sx(e.x), sy(e.y), e.face, S * e.sc); }
    if (M.flash > 0) { g.fillStyle = 'rgba(255,255,255,' + Math.min(0.7, M.flash) + ')'; g.fillRect(0, 0, W, H); }
    this.drawHud();
  }
  /** Dibuja un fotograma [x, y, w, h, anclaX, anclaY] con el ancla en (px, py), mirando a dir */
  blit(img, fr, px, py, dir, S, alpha) {
    if (!img || !fr) return;
    const g = this.ctx, w = fr[2] * S, h = fr[3] * S;
    if (alpha != null) g.globalAlpha = alpha;
    if (dir < 0) { g.save(); g.translate(px, 0); g.scale(-1, 1); g.drawImage(img, fr[0], fr[1], fr[2], fr[3], -fr[4] * S, py - fr[5] * S, w, h); g.restore(); }
    else g.drawImage(img, fr[0], fr[1], fr[2], fr[3], px - fr[4] * S, py - fr[5] * S, w, h);
    if (alpha != null) g.globalAlpha = 1;
  }
  drawBeam(b, sx, sy, img) {
    const g = this.ctx, S = this.S * b.w, F = ZL3.fx, col = b.col;
    const A = F['kamehameha_pt1/' + col] || F['kamehameha_pt1/Azul'], B = F['kamehameha_pt2/' + col] || F['kamehameha_pt2/Azul'], C = F['kamehameha_pt3/' + col] || F['kamehameha_pt3/Azul'];
    if (!A || !B || !C) return;
    const k = ((b.t * 16) | 0), fa = A[3][k % A[3].length], fb = B[3][k % B[3].length], fc = C[3][k % C[3].length];
    const x0 = sx(b.x), y = sy(b.y), len = b.len * this.S, d = b.dir;
    const fade = Math.min(1, (b.life - b.t) * 4);
    g.globalAlpha = fade; g.save(); g.translate(x0, y); g.scale(d, 1);
    const aw = fa[2] * S, cw = fc[2] * S;
    g.drawImage(img, fa[0], fa[1], fa[2], fa[3], 0, -fa[3] * S / 2, aw, fa[3] * S);
    const bodyW = Math.max(0, len - aw - cw * 0.5);
    if (bodyW > 0) g.drawImage(img, fb[0], fb[1], fb[2], fb[3], aw - 1, -fb[3] * S / 2, bodyW + 2, fb[3] * S);
    g.drawImage(img, fc[0], fc[1], fc[2], fc[3], aw + bodyW, -fc[3] * S / 2, cw, fc[3] * S);
    g.restore(); g.globalAlpha = 1;
  }
  drawCut() {
    const g = this.ctx, W = this.cv.width, H = this.cv.height, c = this.cut;
    let t = this.cutTime, i = 0; while (i < c.frames.length - 1 && t > c.frames[i][1]) { t -= c.frames[i][1]; i++; }
    const fr = c.frames[i][0];
    cutBackdrop(g, W, H, this.cutTime);
    const k = Math.min(W / fr[2], H / fr[3]); const s = Math.max(1, Math.floor(k)) < k * 0.8 ? k : Math.max(1, Math.floor(k));
    const w = fr[2] * s, h = fr[3] * s;
    g.drawImage(c.img, fr[0], fr[1], fr[2], fr[3], Math.round((W - w) / 2), Math.round((H - h) / 2), Math.round(w), Math.round(h));
    // Bandas de cine
    g.fillStyle = '#000'; const band = Math.round(H * 0.06); g.fillRect(0, 0, W, band); g.fillRect(0, H - band, W, band);
  }
  drawHud() {
    const M = this.match, g = this.ctx, W = this.cv.width, H = this.cv.height, u = Math.max(1, Math.round(H / 360)), d = this.dpr;
    const bw = Math.min(W * 0.36, 360 * u), bh = 11 * u, top = 12 * u;
    const face = ZL3.img[ZL3.base + 'faces.webp'];
    for (let t = 0; t < 2; t++) {
      const f = this.active(t); if (!f) continue;
      const left = t === 0, x0 = left ? 70 * u : W - 70 * u - bw;
      // retrato
      const fz = ZL3.index.faces[f.id]; const r = fz && (fz.f || fz.b);
      if (face && r) { const k = (44 * u) / r[3]; const px = left ? 12 * u : W - 12 * u - r[2] * k; g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(px - 2 * u, top - 2 * u, r[2] * k + 4 * u, 44 * u + 4 * u); g.drawImage(face, r[0], r[1], r[2], r[3], px, top, r[2] * k, 44 * u); }
      // vida
      g.fillStyle = '#111a3a'; g.fillRect(x0 - 2 * u, top - 2 * u, bw + 4 * u, bh + 4 * u);
      const k = f.hp / f.maxHp, kw = Math.round(bw * k);
      f.hpShow = f.hpShow == null ? k : Math.max(k, f.hpShow - 0.25 * (1 / 60));
      g.fillStyle = '#ff5a3a'; g.fillRect(left ? x0 : x0 + bw - bw * f.hpShow, top, bw * f.hpShow, bh);
      g.fillStyle = k > 0.5 ? '#ffd23a' : k > 0.25 ? '#ffa020' : '#ff3a3a'; g.fillRect(left ? x0 : x0 + bw - kw, top, kw, bh);
      // ki: barras
      const n = ZK.KI / ZK.BAR, kb = bw * 0.75, kx = left ? x0 : x0 + bw - kb, ky = top + bh + 5 * u, seg = kb / n;
      for (let j = 0; j < n; j++) {
        const fill = zclamp((f.ki - j * ZK.BAR) / ZK.BAR, 0, 1);
        g.fillStyle = '#0b1236'; g.fillRect(kx + j * seg, ky, seg - 2 * u, 6 * u);
        g.fillStyle = fill >= 1 ? (f.spark > 0 ? '#ff7ad8' : '#3fd2ff') : '#2a6aa8'; g.fillRect(kx + j * seg, ky, (seg - 2 * u) * fill, 6 * u);
      }
      g.font = '700 ' + 11 * u + 'px Bangers, sans-serif'; g.fillStyle = '#fff'; g.textAlign = left ? 'left' : 'right';
      g.fillText(f.m.name.toUpperCase() + (f.spark > 0 ? ' · SPARKING' : ''), left ? x0 : x0 + bw, ky + 18 * u);
      // banquillo
      const T = M.teams[t];
      T.forEach((m, j) => { if (j === M.act[t]) return; const bx = left ? x0 + bw - (j + 1) * 22 * u : x0 + (j) * 22 * u; g.fillStyle = m.out ? '#552' : '#2c7'; g.fillRect(bx, ky + 9 * u, 18 * u, 4 * u); });
      // combo
      if (f.combo > 1 && f.comboT > 0) { f.comboT -= 1 / 60; g.font = '700 ' + 22 * u + 'px Bangers, sans-serif'; g.fillStyle = '#ffe14a'; g.fillText(f.combo + ' HITS', left ? 20 * u : W - 20 * u, H * 0.42); }
    }
    // reloj
    g.textAlign = 'center'; g.font = '700 ' + 26 * u + 'px Bangers, sans-serif'; g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 4 * u;
    const tt = String(Math.max(0, Math.ceil(M.timer))); g.strokeText(tt, W / 2, top + 22 * u); g.fillText(tt, W / 2, top + 22 * u);
    if (M.banner) {
      const b = M.banner, a = Math.min(1, b.t * 3, (b.T - b.t) * 6 + 0.2);
      g.globalAlpha = a; g.font = '700 ' + 48 * u + 'px Bangers, sans-serif'; g.lineWidth = 8 * u;
      g.strokeText(b.txt, W / 2, H * 0.38); g.fillStyle = b.team === 1 ? '#ff8a8a' : '#ffe14a'; g.fillText(b.txt, W / 2, H * 0.38); g.globalAlpha = 1;
    }
  }
  /* ---------- Controles táctiles ---------- */
  buildTouch() {
    const el = this.root.querySelector('.zftouch'); this.touchOn = ('ontouchstart' in window) || navigator.maxTouchPoints > 0; if (!this.touchOn) { el.innerHTML = ''; return; }
    const B = (k, t, c) => '<button data-ztouch="' + k + '" class="' + (c || '') + '">' + t + '</button>';
    el.innerHTML = '<div class="zpadl">' + B('u', '▲', 'u') + B('l', '◀', 'l') + B('r', '▶', 'r') + B('d', '▼', 'd') + '</div>' +
      '<div class="zpadr">' + B('a1', 'L') + B('a2', 'M') + B('a3', 'F') + B('blast', 'Ki') + B('s1', 'E1', 'sp') + B('s2', 'E2', 'sp') + B('sup', 'Súper', 'sp2') + B('ult', 'Ultimate', 'sp3') +
      B('dash', 'Dash') + B('tp', 'TP') + B('chg', 'Cargar') + B('rush', 'Rush') + B('tag', 'Cambio') + B('spark', 'Spark') + '</div>' + B('pause', 'II', 'zpz');
    this.touch = {};
    const set = (e, v) => { for (const t of e.changedTouches) { const b = document.elementFromPoint(t.clientX, t.clientY); const k = b && b.dataset && b.dataset.ztouch; if (k === 'pause') { if (v) this.togglePause(); continue; } if (k) this.touch[k] = v; } e.preventDefault(); };
    el.ontouchstart = (e) => set(e, true); el.ontouchend = el.ontouchcancel = (e) => { set(e, false); if (!e.touches.length) this.touch = {}; };
  }
}

/* Lugar del menú: abre el modo (lo llama game.js) */
window.ZFight = ZFight;

/* =====================================================================
   ULTIMATES DEL JUEGO 3D CON LAS CINEMÁTICAS DE Z LEGENDS 3
   Al empezar una partida se descarga (en segundo plano) el luchador de
   Z Legends 3 que corresponde a tu guerrero y forma. Si ya está listo
   cuando lanzas la Ultimate [Q], antes sale su cinemática con su voz.
   ===================================================================== */
// guerrero del juego 3D -> [[desde la forma nº, luchador de Z Legends 3], …]
const ZL3_3D = {
  goku: [[0, 'goku'], [2, 'gokussj'], [7, 'gokublue'], [9, 'gokuui']], vegeta: [[0, 'vegeta'], [1, 'vegetassj']], black: [[0, 'black']], piccolo: [[0, 'piccolo']],
  gohan: [[0, 'gohanssj2'], [3, 'gohanbeast']], freezer: [[0, 'freezer']], trunks: [[0, 'miraitrunks']], cell: [[0, 'cell']], bardock: [[0, 'bardock'], [1, 'bardockssj']],
  vegito: [[0, 'vegettoblue']], gogeta: [[0, 'gogetassj4'], [3, 'gogetablue']], zamasuf: [[0, 'zamasu']], broly: [[0, 'brolyz'], [3, 'brolydbs']], kefla: [[0, 'kefla']],
  janemba: [[0, 'janemba']], jiren: [[0, 'jiren']], bills: [[0, 'beerus']], hitto: [[0, 'hit']], raditz: [[0, 'raditz']], andro17: [[0, 'a17']], andro18: [[0, 'a18']],
  gohankid: [[0, 'gohanssj2']], gohanf: [[0, 'miraigohan']], ginyu: [[0, 'ginyu']], babyv: [[0, 'baby']], buu_gordo: [[0, 'kidbuu']]
};
const ZL3Ult = {
  idsFor(chId) { return (ZL3_3D[chId] || []).map((x) => x[1]); },
  idFor(chId, formIdx) { const L = ZL3_3D[chId]; if (!L) return null; let id = null; for (const [k, z] of L) if (formIdx >= k) id = z; return id; },
  /** Descarga en segundo plano los luchadores de ese guerrero (sin bloquear la partida) */
  prefetch(chId) {
    const ids = this.idsFor(chId); if (!ids.length) return;
    (async () => {
      try {
        await ZL3.script(ZL3.base + 'index.js');
        for (const id of ids) {
          if (ZL3.chars[id] && ZL3.chars[id].cutAtlas) continue;
          await ZL3.script(ZL3.base + 'c/' + id + '.js');
          const m = ZL3.chars[id]; if (m.cut) m.cutAtlas = await ZL3.image(ZL3.base + 'c/' + id + '_cut.webp');
          ZSnd.preload(this.voices(m));
        }
      } catch (e) { /* sin datos del Combate Z: la Ultimate sale como siempre */ }
    })();
  },
  cutNames(m) {
    const c = m.cut ? Object.keys(m.cut) : [], u = c.filter((n) => !/Intro|Vitoria|WinPose|Background|_Vs|Vs/.test(n) || /Ult/.test(n));
    return (u.length ? u : c.filter((n) => /Intro/.test(n) && !/Background/.test(n))).slice(0, 4);   // sin cinemática de ataque: la de su entrada
  },
  voices(m) {
    const an = Object.keys(m.anims).find((n) => /^Ultimate/.test(n)) || Object.keys(m.voice).sort((a, b) => (m.voice[b] || []).length - (m.voice[a] || []).length)[0];
    return (m.voice[an] || []).filter((v) => isVoice(v[1]) && !/_vs_/.test(v[1])).map((v) => v[1]).slice(0, 2);
  },
  ready(chId, formIdx) { const id = this.idFor(chId, formIdx), m = id && ZL3.chars[id]; return !!(m && m.cutAtlas && this.cutNames(m).length); },
  /** Cinemática a pantalla completa (2,6 s como mucho; se salta tocando) y después done() */
  play(chId, formIdx, name, done) {
    const m = ZL3.chars[this.idFor(chId, formIdx)], names = this.cutNames(m), frames = [];
    for (const n of names) { const a = m.cut[n], sp = a[0] || 12; for (const fr of a[3]) frames.push([fr, (fr[6] || 1) / sp]); }
    let tot = frames.reduce((s, x) => s + x[1], 0); const k = tot > 2.6 ? 2.6 / tot : 1; frames.forEach((x) => { x[1] *= k; }); tot *= k;
    const cv = document.createElement('canvas'); cv.id = 'zult'; cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:24;image-rendering:pixelated;background:#000';
    document.body.appendChild(cv);
    const dpr = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    const V = this.voices(m); if (V[0]) ZSnd.play(V[0], 1);
    let t = 0, last = performance.now(), end = false;
    const fin = () => { if (end) return; end = true; cv.remove(); done(); };
    cv.addEventListener('pointerdown', fin);
    const loop = (now) => {
      if (end) return;
      t += Math.min(0.05, (now - last) / 1000); last = now;
      if (t >= tot) return fin();
      let r = t, i = 0; while (i < frames.length - 1 && r > frames[i][1]) { r -= frames[i][1]; i++; }
      const fr = frames[i][0], W = cv.width, H = cv.height, s = Math.min(W / fr[2], H / fr[3]);
      cutBackdrop(g, W, H, t); g.fillStyle = '#000';
      g.drawImage(m.cutAtlas, fr[0], fr[1], fr[2], fr[3], Math.round((W - fr[2] * s) / 2), Math.round((H - fr[3] * s) / 2), Math.round(fr[2] * s), Math.round(fr[3] * s));
      const band = Math.round(H * 0.07); g.fillRect(0, 0, W, band); g.fillRect(0, H - band, W, band);
      g.font = '700 ' + Math.round(H * 0.06) + 'px Bangers, sans-serif'; g.textAlign = 'right'; g.fillStyle = '#ffe14a'; g.strokeStyle = '#000'; g.lineWidth = Math.round(H * 0.008);
      g.strokeText(name, W - band * 0.6, H - band * 0.25); g.fillText(name, W - band * 0.6, H - band * 0.25);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
};
window.ZL3Ult = ZL3Ult;
