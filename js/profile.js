'use strict';
/* =====================================================================
   profile.js · Perfil del jugador y Pase de batalla.
   - Perfil: foto, marco y título. Se desbloquean jugando (guerreros, transformaciones,
     victorias por dificultad, logros y el pase) y se guardan en el navegador.
     Con sesión iniciada, lo elegido se copia a Supabase para que lo vean los demás en el ranking.
   - Pase de batalla: 50 niveles permanentes (sin temporadas). Se sube con la experiencia que da jugar.
     El nivel 50 entrega BLACK FREEZER, una forma que no se consigue de ninguna otra manera.
   Aquí van los DATOS, las reglas (objeto Profile) y las pantallas (se añaden a UIManager al final).
   ===================================================================== */

/* ---------- Forma exclusiva del pase ----------
   No tiene hoja propia: es la de Golden Freezer recoloreada al cargar (RECOLOR.black en core.js) */
if (window.SPRITE_DATA && SPRITE_DATA.freezer_gold && !SPRITE_DATA.freezer_black) {
  SPRITE_DATA.freezer_black = Object.assign({}, SPRITE_DATA.freezer_gold, { recolor: 'black' });
  SHEET_NAMES.push('freezer_black');
}
const PASS_FORM = {
  ch: 'freezer', sheet: 'freezer_black', name: 'BLACK FREEZER', lvl: 41, dmg: 4.1, spd: 1.36, ki: 0xb9c8ff, aura: 0x7a6cff,
  trait: { name: 'Diez años de entrenamiento', good: '+25% de daño, +15% de crítico y tu aura quema a los enemigos', bad: 'Gasta 4 de Ki/s sin regenerarlo (carga con C)', m: { dmg: 0.25, crit: 0.15 }, t: { aura: 45, kiDrain: 4 } }
};
/** Formas que añade el pase a un guerrero (lo llama applyGachaForms, js/packdata.js) */
function passForms(c) {
  if (c.id !== PASS_FORM.ch || !Save.d.pass || !Save.d.pass.final) return [];
  const F = PASS_FORM, f = form(F.name, F.lvl, F.sheet, A_HD, F.dmg, F.spd, F.ki, F.aura, 0xffffff);
  f.pass = true; f.trait = F.trait;
  return [f];
}

/* ---------- Marcos ----------
   cls = clase CSS (index.html, bloque «PERFIL»). fx = adorno animado: 'aura', 'bolt' (rayos), 'orbs' (bolas), 'scan' */
const FRAMES = [
  { id: 'base', name: 'Aprendiz', how: 'El marco con el que empiezas', ok: () => true },
  { id: 'bronze', name: 'Bronce', how: 'Gana una partida en Fácil', ok: () => Profile.clears('easy') + Profile.clears('normal') + Profile.clears('hard') + Profile.clears('extreme') > 0 },
  { id: 'silver', name: 'Plata', how: 'Gana una partida en Normal', ok: () => Profile.clears('normal') + Profile.clears('hard') + Profile.clears('extreme') > 0 },
  { id: 'gold', name: 'Oro', how: 'Gana una partida en Difícil', ok: () => Profile.clears('hard') + Profile.clears('extreme') > 0 },
  { id: 'ssj', name: 'Aura Super Saiyan', fx: 'aura', how: 'Transfórmate 25 veces', ok: () => (Save.d.stats.transforms || 0) >= 25 },
  { id: 'bolt', name: 'Tormenta eléctrica', fx: 'bolt', how: 'Gana en Difícil con 3 guerreros distintos', ok: () => Profile.clears('hard') + Profile.clears('extreme') >= 3 },
  { id: 'fire', name: 'Combo ardiente', fx: 'aura', how: 'Encadena un combo de 250', ok: () => (Save.d.stats.maxCombo || 0) >= 250 },
  { id: 'hakai', name: 'Destrucción', fx: 'aura', how: 'Derrota 10 jefes', ok: () => (Save.d.stats.bosses || 0) >= 10 },
  { id: 'shenron', name: 'Bolas de Dragón', fx: 'orbs', how: 'Pide 3 deseos a Shenron', ok: () => (Save.d.stats.wishes || 0) >= 3 },
  { id: 'ui', name: 'Ultra Instinto', fx: 'aura', how: 'Alcanza la última transformación de Son Goku', ok: () => { const c = charById('goku'); return Profile.maxForm('goku') >= (c.baseForms || c.forms).length - 1; } },
  { id: 'legend', name: 'Leyenda', fx: 'aura', how: 'Completa todos los libros del Modo Leyenda', ok: () => typeof storyDone === 'function' && storyDone() >= BOOKS.length },
  { id: 'kinton', name: 'Nube Kinton', fx: 'aura', how: 'Pase de batalla · nivel 10', pass: true, ok: () => Profile.own('fr', 'kinton') },
  { id: 'scouter', name: 'Rastreador', fx: 'scan', how: 'Pase de batalla · nivel 25', pass: true, ok: () => Profile.own('fr', 'scouter') },
  { id: 'black', name: 'Emperador Negro', fx: 'bolt', how: 'Pase de batalla · nivel 50', pass: true, ok: () => Profile.own('fr', 'black') }
];

/* ---------- Títulos del pase (los demás títulos son los logros conseguidos) ---------- */
const PASS_TITLES = [
  { id: 'p_asp', name: 'Aspirante a guerrero' }, { id: 'p_caz', name: 'Cazador de villanos' },
  { id: 'p_elite', name: 'Guerrero de élite' }, { id: 'p_emp', name: 'Emperador del Mal' }
];
/* Fotos de jefes que solo da el pase: clave del jefe en BOSSES (js/data.js) */
const PASS_BOSS_PICS = ['buu', 'beerus', 'hit', 'jiren', 'zamasu', 'omega'];

/* ---------- Pase de batalla: 50 niveles ---------- */
const PASS_MAX = 50;
/** Experiencia para pasar del nivel lv al siguiente (lv = 0..49): de 200 a 788 */
const passNeed = (lv) => 200 + 12 * lv;
/* Premios especiales por nivel. El resto alterna monedas (impares) y cristales (pares).
   Tipos: z monedas · c cristales · fr marco · av foto · ti título · form transformación */
const PASS_SPECIAL = {
  3: [{ t: 'ti', id: 'p_asp' }], 5: [{ t: 'av', id: 'b.buu' }], 10: [{ t: 'fr', id: 'kinton' }], 15: [{ t: 'av', id: 'b.beerus' }],
  18: [{ t: 'ti', id: 'p_caz' }], 20: [{ t: 'av', id: 'b.hit' }], 25: [{ t: 'fr', id: 'scouter' }], 30: [{ t: 'c', n: 400 }],
  33: [{ t: 'ti', id: 'p_elite' }], 35: [{ t: 'av', id: 'b.jiren' }], 40: [{ t: 'av', id: 'b.zamasu' }], 45: [{ t: 'av', id: 'b.omega' }],
  50: [{ t: 'form' }, { t: 'fr', id: 'black' }, { t: 'av', id: 'x.black' }, { t: 'ti', id: 'p_emp' }]
};
/** Premios del nivel lv (1..50) */
const passRewards = (lv) => PASS_SPECIAL[lv] || [lv % 2 ? { t: 'z', n: 200 + lv * 30 } : { t: 'c', n: 30 + lv * 2 }];

const Profile = {
  /* ----- Guardado ----- */
  defaults() {
    const d = Save.d;
    d.prof = Object.assign({ av: 'goku.0', fr: 'base', ti: '', seen: {} }, d.prof || {});
    if (!d.prof.seen || typeof d.prof.seen !== 'object') d.prof.seen = {};
    d.pass = Object.assign({ xp: 0, got: {}, own: {}, final: false }, d.pass || {});
  },
  /** Partidas antiguas: no se apuntaba la forma más alta de cada guerrero. Se deduce del nivel máximo que alcanzó */
  backfill() {
    const cs = Save.d.cs || {};
    if (!(Save.d.stats.transforms > 0)) return;
    for (const c of CHARACTERS) {
      const s = cs[c.id]; if (!s || s.maxForm !== undefined) continue;
      const F = c.baseForms || c.forms || []; let m = 0;
      for (let i = 1; i < F.length; i++) if ((s.maxLevel || 0) >= F[i].lvl) m = i;
      s.maxForm = m;
    }
  },
  /* ----- Progreso que desbloquea cosas ----- */
  /** Guerreros distintos con los que has ganado en una dificultad */
  clears(diff) { return Object.keys(Save.d.clears || {}).filter((k) => k.endsWith(':' + diff)).length; },
  /** Forma más alta alcanzada en partida con un guerrero (0 = base) */
  maxForm(id) { const s = (Save.d.cs || {})[id]; return (s && s.maxForm) || 0; },
  /** Apunta una transformación (js/transform.js) */
  trackForm(id, idx) { const C = Save.d.cs || (Save.d.cs = {}), s = C[id] || (C[id] = {}); if (idx > (s.maxForm || 0)) s.maxForm = idx; },
  /** ¿Tienes este premio del pase? kind = 'fr' | 'av' | 'ti' */
  own(kind, id) { return !!(Save.d.pass.own || {})[kind + ':' + id]; },

  /* ----- Fotos: se generan de los datos del juego (cada guerrero y cada una de sus formas) ----- */
  avatars() {
    if (this._av) return this._av;
    const out = [];
    for (const c of CHARACTERS) {
      if (c.soon || !c.portrait) continue;
      const F = c.baseForms || c.forms || [], nm = nice(c.name);
      out.push({ id: c.id + '.0', grp: nm, name: nm, sheet: c.portrait.sheet, frame: c.portrait.frame, how: c.id === 'goku' ? 'La foto con la que empiezas' : 'Desbloquea a ' + nm, ok: () => Save.d.unlocked.includes(c.id) });
      F.forEach((f, i) => {
        if (!i || f.gacha || f.pass) return;
        out.push({ id: c.id + '.' + i, grp: nm, name: nice(f.name), sheet: f.sheet, frame: 0, how: 'Transfórmate en ' + nice(f.name) + ' con ' + nm + ' en una partida', ok: () => Profile.maxForm(c.id) >= i });
      });
      for (const g of GUNITS) {
        if (g.kind !== 'form' || g.ch !== c.id) continue;
        out.push({ id: 'g.' + g.id, grp: nm, name: nice(g.name), sheet: g.sheet, frame: 0, how: 'Consigue esta forma en el Altar de Shenron', ok: () => !!(Save.d.gforms || {})[g.id] });
      }
    }
    for (const k of PASS_BOSS_PICS) {
      const B = BOSSES[k]; if (!B) continue;
      const lv = +Object.keys(PASS_SPECIAL).find((n) => PASS_SPECIAL[n].some((r) => r.id === 'b.' + k));
      out.push({ id: 'b.' + k, grp: 'Pase de batalla', name: nice(B.name), sheet: B.sheet, row: B.row, how: 'Pase de batalla · nivel ' + lv, pass: true, ok: () => Profile.own('av', 'b.' + k) });
    }
    out.push({ id: 'x.black', grp: 'Pase de batalla', name: nice(PASS_FORM.name), sheet: PASS_FORM.sheet, frame: 0, how: 'Pase de batalla · nivel 50', pass: true, ok: () => Profile.own('av', 'x.black') });
    return (this._av = out);
  },
  avatar(id) { const L = this.avatars(); return L.find((a) => a.id === id) || L[0]; },
  frame(id) { return FRAMES.find((f) => f.id === id) || FRAMES[0]; },
  /** Títulos: «Novato», los logros conseguidos y los del pase */
  titles() {
    return [{ id: '', name: 'Novato', how: 'El título con el que empiezas', ok: () => true }]
      .concat(ACHIEVEMENTS.map((a) => ({ id: a.id, name: a.name, how: 'Logro: ' + a.desc, ok: () => !!Save.d.ach[a.id] })))
      .concat(PASS_TITLES.map((t) => ({ id: t.id, name: t.name, pass: true, how: 'Pase de batalla · nivel ' + Object.keys(PASS_SPECIAL).find((n) => PASS_SPECIAL[n].some((r) => r.id === t.id)), ok: () => Profile.own('ti', t.id) })));
  },
  title(id) { const L = this.titles(); return L.find((t) => t.id === id) || L[0]; },
  /** Lo que llevas puesto ahora (si algo ya no vale, vuelve al de serie) */
  cur() {
    const p = Save.d.prof, av = this.avatar(p.av), fr = this.frame(p.fr), ti = this.title(p.ti);
    return { av: av.ok() ? av : this.avatars()[0], fr: fr.ok() ? fr : FRAMES[0], ti: ti.ok() ? ti : this.titles()[0] };
  },
  /** Fotos, marcos y títulos desbloqueados que aún no has visto (aviso «nuevo») */
  fresh(kind) {
    const seen = Save.d.prof.seen, L = kind === 'av' ? this.avatars() : kind === 'fr' ? FRAMES : this.titles();
    return L.filter((x) => x.ok() && !seen[kind + ':' + x.id] && !(kind === 'av' && x.id === 'goku.0') && !(kind === 'fr' && x.id === 'base') && !(kind === 'ti' && x.id === ''));
  },
  freshAll() { return this.fresh('av').length + this.fresh('fr').length + this.fresh('ti').length; },
  markSeen(kind) { for (const x of this.fresh(kind)) Save.d.prof.seen[kind + ':' + x.id] = 1; Save.write(); },

  /* ----- Pase de batalla ----- */
  /** Nivel actual y experiencia dentro del nivel */
  pass() {
    let xp = Save.d.pass.xp || 0, lv = 0;
    while (lv < PASS_MAX && xp >= passNeed(lv)) { xp -= passNeed(lv); lv++; }
    return { lv, xp: lv >= PASS_MAX ? 0 : xp, need: lv >= PASS_MAX ? 0 : passNeed(lv) };
  },
  /** Suma experiencia. Devuelve { xp, lv, up } (up = niveles subidos) */
  addXp(n) {
    n = Math.max(0, Math.round(n)); const a = this.pass().lv;
    Save.d.pass.xp = (Save.d.pass.xp || 0) + n;
    const b = this.pass().lv;
    return { xp: n, lv: b, up: b - a };
  },
  /** Experiencia de una partida: aguantar, jefes, nivel y victoria; más en Normal (+20%), Difícil (+50%) y Extremo (+80%) */
  runXp(o) {
    const mul = o.diff === 'extreme' ? 1.8 : o.diff === 'hard' ? 1.5 : o.diff === 'normal' ? 1.2 : 1;
    return Math.round((20 + Math.min(o.time, 1800) / 6 + o.bosses * 40 + o.level * 2 + (o.win ? 150 : 0)) * mul);
  },
  /** Niveles con premio sin recoger */
  pending() { const lv = this.pass().lv, out = []; for (let i = 1; i <= lv; i++) if (!Save.d.pass.got[i]) out.push(i); return out; },
  /** Recoge el premio de un nivel. Devuelve la lista de premios o null */
  claim(lv) {
    const P = Save.d.pass;
    if (lv < 1 || lv > this.pass().lv || P.got[lv]) return null;
    const R = passRewards(lv);
    for (const r of R) {
      if (r.t === 'z') Save.d.zeni += r.n;
      else if (r.t === 'c') Save.d.crystals = (Save.d.crystals || 0) + r.n;
      else if (r.t === 'form') { P.final = true; applyGachaForms(); }
      else P.own[r.t + ':' + r.id] = 1;
    }
    P.got[lv] = 1; Save.write();
    return R;
  },
  /** Texto de un premio */
  rewardName(r) {
    if (r.t === 'z') return r.n.toLocaleString('es-ES') + ' monedas';
    if (r.t === 'c') return r.n + ' cristales';
    if (r.t === 'fr') return 'Marco «' + this.frame(r.id).name + '»';
    if (r.t === 'av') return 'Foto de ' + this.avatar(r.id).name;
    if (r.t === 'ti') return 'Título «' + this.title(r.id).name + '»';
    return 'Transformación ' + nice(PASS_FORM.name);
  }
};

/* =====================================================================
   Pantallas: se añaden a UIManager (js/ui.js ya está cargado)
   ===================================================================== */
/** Rayos de un marco: trazos quebrados alrededor del círculo, cada uno parpadea a su ritmo (CSS .pfz) */
function boltSvg(n) {
  const rnd = seeded(77 + n); let h = '<svg class="pfz" viewBox="-60 -60 120 120" aria-hidden="true">';
  for (let i = 0; i < n; i++) {
    let a = (i / n) * 6.283 + rnd() * 0.4, d = '';                // cada rayo recorre un tramo del aro dando saltos hacia dentro y hacia fuera
    for (let k = 0; k < 10; k++) { const r = 42 + (k % 2 ? 1 : -1) * (0.8 + rnd() * 3.6); d += (k ? 'L' : 'M') + (Math.cos(a) * r).toFixed(1) + ' ' + (Math.sin(a) * r).toFixed(1); a += 0.05 + rnd() * 0.1; }
    h += '<path d="' + d + '" style="animation-delay:' + (-rnd() * 1.6).toFixed(2) + 's;animation-duration:' + (1.1 + rnd() * 0.9).toFixed(2) + 's"/>';
  }
  return h + '</svg>';
}

Object.assign(UIManager.prototype, {
  /** Foto con su marco. size en px (el CSS escala todo con --s). av y fr son objetos de Profile */
  pfa(av, fr, size, extra) {
    const fx = fr.fx === 'bolt' ? boltSvg(fr.id === 'black' ? 11 : 9) : fr.fx ? '<i class="pfx"></i>' : '';
    const fa = av.row !== undefined ? ' data-frow="' + av.row + '"' : ' data-fframe="' + (av.frame || 0) + '"';
    return '<span class="pfa fr-' + fr.id + (extra ? ' ' + extra : '') + '" style="--s:' + size + 'px">' + fx + '<canvas width="96" height="96" data-face="' + av.sheet + '"' + fa + '></canvas></span>';
  },
  /** Foto con marco a partir de los identificadores (ranking mundial: lo que eligió otro jugador) */
  pfaIds(avId, frId, size) { return this.pfa(Profile.avatar(avId), Profile.frame(frId), size); },
  /** Dibuja las fotos: recorte cuadrado de cabeza, hombros y pecho (64% de arriba del sprite),
      centrado en la cabeza para que el pelo alto o los brazos abiertos no la saquen del encuadre */
  drawFaces(root) {
    for (const cv of root.querySelectorAll('canvas[data-face]')) {
      const s = this.sheets && this.sheets[cv.dataset.face], g = cv.getContext && cv.getContext('2d');
      if (!s || !g) continue;
      const frame = cv.dataset.frow !== undefined ? +cv.dataset.frow * s.cols : +cv.dataset.fframe;
      const img = s.tex.image, c = frame % s.cols, r = (frame / s.cols) | 0, f = this.faceBox(img, s, c, r), W = cv.width;
      g.imageSmoothingEnabled = false; g.clearRect(0, 0, W, W);
      g.drawImage(img, c * s.w + f.x, r * s.h + f.y, f.side, f.side, 0, 0, W, W);
    }
  },
  /** Encuadre de la cara dentro de la celda (se calcula una vez por fotograma y se guarda) */
  faceBox(img, s, c, r) {
    const key = c + ',' + r, cache = (s.faces = s.faces || {});
    if (cache[key]) return cache[key];
    const bb = this.frameBox(img, s, c, r), side = Math.max(8, Math.round(Math.max(bb.h * 0.64, Math.min(bb.w, bb.h) * 0.9)));
    let cx = bb.x + bb.w / 2;
    try {                                                             // centro horizontal de la cabeza: media de los píxeles opacos del 40% de arriba
      const cvs = document.createElement('canvas'); cvs.width = s.w; cvs.height = s.h;
      const x = cvs.getContext('2d'); x.drawImage(img, c * s.w, r * s.h, s.w, s.h, 0, 0, s.w, s.h);
      const d = x.getImageData(0, 0, s.w, s.h).data, y1 = bb.y + Math.round(bb.h * 0.4); let sum = 0, n = 0;
      for (let y = bb.y; y < y1; y++) for (let i = bb.x; i < bb.x + bb.w; i++) if (d[(y * s.w + i) * 4 + 3] > 20) { sum += i; n++; }
      if (n) cx = sum / n;
    } catch (e) { /* lienzo bloqueado: se centra en la caja */ }
    const pad = Math.round(side * 0.02);                              // un poco de aire por encima del pelo
    return (cache[key] = { x: Math.round(cx - side / 2), y: bb.y - pad, side });
  },
  /* ---------- Cuenta y perfil ---------- */
  renderAccount() {
    const on = this.game && this.game.online, logged = !!(on && on.logged), C = Profile.cur();
    if (on && on.recovery) this.ptab = 'cuenta';
    const tab = this.ptab || (logged || !on || !on.ready ? 'perfil' : 'cuenta');
    const nAv = Profile.fresh('av').length, nFr = Profile.fresh('fr').length, nTi = Profile.fresh('ti').length, dot = (n) => (n ? ' <u class="pnew">' + n + '</u>' : '');
    this.hdr = { t: 'Perfil', s: logged ? 'Tu foto y tu marco se ven en el ranking mundial' : 'Tu foto, tu marco y tu cuenta', c: 'c-blu' };
    this.hdr.tabs = this.segTabs([['perfil', 'Perfil'], ['fotos', 'Fotos' + dot(nAv)], ['marcos', 'Marcos' + dot(nFr)], ['titulos', 'Títulos' + dot(nTi)], ['cuenta', 'Cuenta']], tab, 'ptab');
    const name = logged ? escHtml(on.name || 'Guerrero') : 'Invitado';
    const card = (big) => '<div class="pcard">' + this.pfa(C.av, C.fr, big || 150) + '<b class="pnm">' + name + '</b><span class="ptl">' + escHtml(C.ti.name) + '</span></div>';
    let h;
    if (tab === 'fotos') h = this.pickGrid('av', card);
    else if (tab === 'marcos') h = this.pickGrid('fr', card);
    else if (tab === 'titulos') h = this.pickGrid('ti', card);
    else if (tab === 'cuenta') h = this.accountForms(on, logged);
    else h = this.profileHome(on, logged, C, name);
    this.el.menuBody.innerHTML = h;
    if (tab === 'fotos') Profile.markSeen('av'); else if (tab === 'marcos') Profile.markSeen('fr'); else if (tab === 'titulos') Profile.markSeen('ti');
  },
  /** Pestaña Perfil: el carné del jugador con sus cifras, su colección y el pase */
  profileHome(on, logged, C, name) {
    const st = Save.d.stats, n = (k) => Math.floor(st[k] || 0).toLocaleString('es-ES'), P = Profile.pass(), pend = Profile.pending().length;
    const cs = Save.d.cs || {}, fav = CHARACTERS.filter((c) => cs[c.id] && cs[c.id].runs).sort((a, b) => cs[b.id].runs - cs[a.id].runs)[0];
    const best = Save.d.rank.length ? Save.d.rank[0].score.toLocaleString('es-ES') : '—';
    const cnt = (L) => L.filter((x) => x.ok()).length + ' / ' + L.length, pct = (L) => Math.round(L.filter((x) => x.ok()).length / L.length * 100);
    const AV = Profile.avatars(), TI = Profile.titles(), ach = ACHIEVEMENTS.filter((a) => Save.d.ach[a.id]);
    // Lo siguiente que puedes conseguir: los tres primeros marcos que te faltan y cómo se ganan
    const todo = FRAMES.filter((f) => !f.ok()).slice(0, 3);
    const next = todo.length ? '<div class="pnext"><h4 class="sec">Próximos marcos</h4>' + todo.map((f) => '<button class="pnx" data-ptab="marcos">' + this.pfa(C.av, f, 58) + '<span><b>' + f.name + '</b><small>' + f.how + '</small></span></button>').join('') + '</div>' : '';
    const wall = '<div class="pwall"><h4 class="sec">Logros <em>' + ach.length + ' / ' + ACHIEVEMENTS.length + '</em></h4><div>' + ACHIEVEMENTS.map((a) => '<i class="' + (Save.d.ach[a.id] ? 'on' : '') + '" title="' + escHtml(a.name + ': ' + a.desc) + '">' + a.icon + '</i>').join('') + '</div></div>';
    const used = CHARACTERS.filter((c) => cs[c.id] && cs[c.id].runs).sort((a, b) => cs[b.id].runs - cs[a.id].runs).slice(0, 3);
    const tops = used.length ? '<div class="pnext"><h4 class="sec">Tus guerreros más usados</h4>' + used.map((c) => '<div class="pnx">' + this.pfa(Profile.avatar(c.id + '.0'), FRAMES[0], 58, 'flat') + '<span><b>' + nice(c.name) + '</b><small>' + cs[c.id].runs + (cs[c.id].runs === 1 ? ' partida' : ' partidas') + ' · ' + (cs[c.id].wins || 0) + ' victorias · nivel máx. ' + (cs[c.id].maxLevel || 1) + '</small></span></div>').join('') + '</div>' : '';
    const bar = (lbl, txt, p, tab) => '<button class="pcol"' + (tab ? ' data-ptab="' + tab + '"' : ' data-go="missions"') + '><span><b>' + lbl + '</b><em>' + txt + '</em></span><i><s style="width:' + p + '%"></s></i></button>';
    return '<div class="pf"><section class="pid pnl">' + this.pfa(C.av, C.fr, 196) +
      '<b class="pnm">' + name + '</b><span class="ptl">' + escHtml(C.ti.name) + '</span>' +
      (logged ? '<small class="dim" id="pfRank">Ranking mundial: consultando…</small>' : '<small class="dim">' + (on && on.ready ? 'Inicia sesión para que tu perfil salga en el ranking mundial' : 'Perfil guardado en este navegador') + '</small>') +
      '<div class="pbtns"><button class="abtn" data-ptab="fotos">Cambiar foto</button><button class="abtn alt" data-ptab="marcos">Cambiar marco</button>' +
      (logged ? '' : (on && on.ready ? '<button class="abtn alt" data-ptab="cuenta">Iniciar sesión</button>' : '')) + '</div></section>' +
      '<section class="pside"><div class="pstats">' + [['Victorias', n('wins')], ['Enemigos derrotados', n('kills')], ['Jefes vencidos', n('bosses')], ['Mejor puntuación', best], ['Tiempo jugado', fmtTime(Math.floor(st.time || 0))], ['Guerrero favorito', fav ? nice(fav.name) : '—']]
        .map((r) => '<div><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('') + '</div>' +
      '<div class="pcols"><h4 class="sec">Colección</h4>' + bar('Fotos', cnt(AV), pct(AV), 'fotos') + bar('Marcos', cnt(FRAMES), pct(FRAMES), 'marcos') + bar('Títulos', cnt(TI), pct(TI), 'titulos') +
      bar('Logros', ach.length + ' / ' + ACHIEVEMENTS.length, Math.round(ach.length / ACHIEVEMENTS.length * 100), '') + '</div>' +
      next + wall + tops +
      '<button class="ppass" data-go="pass"><span class="ppl"><small>Pase de batalla</small><b>Nivel ' + P.lv + '</b></span><span class="ppb"><i><s style="width:' + (P.need ? P.xp / P.need * 100 : 100) + '%"></s></i><em>' + (P.need ? P.xp + ' / ' + P.need + ' de experiencia' : 'Pase completado') + '</em></span>' +
      (pend ? '<u class="pnew">' + pend + '</u>' : '') + '</button></section></div>';
  },
  /** Selector de foto, marco o título: a la izquierda cómo queda; a la derecha todo lo que hay (lo bloqueado dice cómo se consigue) */
  pickGrid(kind, card) {
    const P = Save.d.prof, C = Profile.cur(), seen = P.seen, L = kind === 'av' ? Profile.avatars() : kind === 'fr' ? FRAMES : Profile.titles();
    const curId = kind === 'av' ? C.av.id : kind === 'fr' ? C.fr.id : C.ti.id, got = L.filter((x) => x.ok()).length;
    const isNew = (x) => x.ok() && !seen[kind + ':' + x.id] && x.id !== 'goku.0' && x.id !== 'base' && x.id !== '';
    const cell = (x) => {
      const ok = x.ok(), cls = 'pit ' + kind + (ok ? '' : ' lock') + (x.id === curId ? ' on' : '') + (x.pass ? ' ps' : ''), tag = isNew(x) ? '<u class="pnew">Nuevo</u>' : '';
      const at = ' data-pset="' + kind + '" data-pid="' + x.id + '" title="' + escHtml(ok ? x.name : x.how) + '"' + (ok ? '' : ' aria-disabled="true"');
      if (kind === 'av') return '<button class="' + cls + '"' + at + '>' + this.pfa(x, FRAMES[0], 64, 'flat') + '<b>' + x.name + '</b>' + tag + '</button>';
      if (kind === 'fr') return '<button class="' + cls + '"' + at + '>' + this.pfa(C.av, x, 92) + '<b>' + x.name + '</b><small>' + (ok ? (x.fx ? 'Con efecto animado' : 'Sin efecto') : x.how) + '</small>' + tag + '</button>';
      return '<button class="' + cls + '"' + at + '><b>' + x.name + '</b><small>' + x.how + '</small>' + tag + '</button>';
    };
    let grid = '';
    if (kind === 'av') {                                              // las fotos van agrupadas por guerrero
      const groups = []; for (const x of L) { let G = groups.find((q) => q.n === x.grp); if (!G) groups.push(G = { n: x.grp, l: [] }); G.l.push(x); }
      grid = groups.map((G) => '<h4 class="sec">' + G.n + ' <em>' + G.l.filter((x) => x.ok()).length + ' / ' + G.l.length + '</em></h4><div class="pgrid av">' + G.l.map(cell).join('') + '</div>').join('');
    } else grid = '<div class="pgrid ' + kind + '">' + L.map(cell).join('') + '</div>';
    const what = kind === 'av' ? 'fotos' : kind === 'fr' ? 'marcos' : 'títulos';
    return '<div class="pf pick"><section class="pid pnl">' + card(150).replace('<div class="pcard">', '').replace(/<\/div>$/, '') +
      '<small class="dim">' + got + ' de ' + L.length + ' ' + what + '</small><p class="phow" id="pfHow" role="status">' + (kind === 'av' ? 'Toca una foto para ponértela. Si está bloqueada, aquí verás cómo conseguirla.' : 'Toca uno para ponértelo. Los bloqueados dicen cómo conseguirlos.') + '</p></section>' +
      '<section class="plist pnl">' + grid + '</section></div>';
  },
  /** Pestaña Cuenta: entrar, crear cuenta, recuperar la contraseña o gestionar la cuenta */
  accountForms(on, logged) {
    const eye = '<button type="button" class="peye" data-pweye aria-label="Mostrar u ocultar la contraseña" title="Mostrar u ocultar la contraseña">' + WI.eye + '</button>';
    const pass = (id, ph, ac) => '<span class="pwrap"><input id="' + id + '" type="password" autocomplete="' + ac + '" placeholder="' + ph + '">' + eye + '</span>';
    let mail = ''; try { mail = localStorage.getItem('dbus_mail') || ''; } catch (e) { mail = ''; }
    if (!on || !on.ready) return '<div class="acct"><h4 class="sec">Sin conexión con el servidor</h4><p class="dim">No se ha podido conectar con el servidor de cuentas. Tu perfil y tus récords se guardan en este navegador y puedes jugar con normalidad.</p></div>';
    if (on.recovery) return '<form class="acct" data-acct-form="newpass" novalidate><h4 class="sec">Elige una contraseña nueva</h4>' +
      '<label>Contraseña nueva' + pass('acPass', 'Mínimo 6 caracteres', 'new-password') + '</label><label>Repítela' + pass('acPass2', '', 'new-password') + '</label>' +
      '<button class="abtn" type="submit">Guardar contraseña</button><p class="msg" id="acMsg" role="status"></p></form>';
    if (logged) return '<div class="pacct"><form class="acct" data-acct-form="rename" novalidate><h4 class="sec">Tu cuenta</h4><p class="dim">' + escHtml(on.user.email || '') + '</p>' +
      '<label>Nombre de jugador<input id="acName" maxlength="16" autocomplete="nickname" value="' + escHtml(on.name) + '"></label>' +
      '<button class="abtn" type="submit">Cambiar nombre</button><p class="msg" id="acMsg" role="status"></p>' +
      '<div class="arow"><button type="button" class="abtn alt" data-rtab-go="online">Ver ranking mundial</button><button type="button" class="abtn alt" data-acct="out">Cerrar sesión</button></div></form>' +
      '<form class="acct" data-acct-form="chpass" novalidate><h4 class="sec">Cambiar contraseña</h4>' +
      '<label>Contraseña nueva' + pass('acPass', 'Mínimo 6 caracteres', 'new-password') + '</label><label>Repítela' + pass('acPass2', '', 'new-password') + '</label>' +
      '<button class="abtn" type="submit">Cambiar contraseña</button><p class="msg" id="acMsg2" role="status"></p></form></div>';
    const m = this.atab === 'signup' ? 'signup' : this.atab === 'forgot' ? 'forgot' : 'login';
    const sw = '<div class="seg dk psw">' + this.segTabs([['login', 'Ya tengo cuenta'], ['signup', 'Crear cuenta']], m === 'signup' ? 'signup' : 'login', 'atab') + '</div>';
    if (m === 'forgot') return '<form class="acct" data-acct-form="forgot" novalidate><h4 class="sec">Recuperar la contraseña</h4><p class="dim">Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva.</p>' +
      '<label>Correo<input id="acMail" type="email" autocomplete="email" value="' + escHtml(mail) + '"></label>' +
      '<button class="abtn" type="submit">Enviar enlace</button><p class="msg" id="acMsg" role="status"></p><button type="button" class="plink" data-atab="login">Volver a iniciar sesión</button></form>';
    return '<form class="acct" data-acct-form="' + m + '" novalidate>' + sw +
      (m === 'signup' ? '<label>Nombre de jugador<input id="acName" maxlength="16" autocomplete="nickname" placeholder="De 3 a 16 caracteres"><small class="dim">Es el nombre que verán los demás en el ranking</small></label>' : '') +
      '<label>Correo<input id="acMail" type="email" autocomplete="email" value="' + escHtml(mail) + '"></label>' +
      '<label>Contraseña' + pass('acPass', 'Mínimo 6 caracteres', m === 'signup' ? 'new-password' : 'current-password') + (m === 'signup' ? '<span class="pstr" id="acStr"><i></i><em>Escribe una contraseña</em></span>' : '') + '</label>' +
      (m === 'signup' ? '<label>Repite la contraseña' + pass('acPass2', '', 'new-password') + '</label>' : '') +
      '<button class="abtn" type="submit">' + (m === 'signup' ? 'Crear cuenta' : 'Entrar') + '</button><p class="msg" id="acMsg" role="status"></p>' +
      (m === 'login' ? '<div class="plinks"><button type="button" class="plink" data-atab="forgot">He olvidado mi contraseña</button><button type="button" class="plink" data-acct="resend">Reenviar correo de confirmación</button></div>' : '') +
      '<p class="dim">Sin cuenta puedes jugar igual y usar tu perfil; solo no apareces en el ranking mundial.</p></form>';
  },
  /** Lanza la acción de un formulario de cuenta. Devuelve una promesa {ok, msg} */
  acctJob(kind, val) {
    const on = this.game.online, mail = val('acMail').trim(), p1 = val('acPass'), p2 = val('acPass2');
    const bad = (msg) => Promise.resolve({ ok: false, msg });
    if (mail) { try { localStorage.setItem('dbus_mail', mail); } catch (e) { /* sin almacenamiento */ } }
    if ((kind === 'login' || kind === 'signup' || kind === 'forgot') && !/^\S+@\S+\.\S+$/.test(mail)) return bad('Escribe un correo válido.');
    if ((kind === 'signup' || kind === 'newpass' || kind === 'chpass') && p1 !== p2) return bad('Las dos contraseñas no coinciden.');
    if (kind === 'signup') return on.signUp(mail, p1, val('acName'));
    if (kind === 'forgot') return on.resetPass(mail);
    if (kind === 'newpass' || kind === 'chpass') return on.changePass(p1);
    if (kind === 'rename') return on.rename(val('acName'));
    return on.signIn(mail, p1).then((r) => { if (r.ok) this.ptab = 'perfil'; return r; });
  },

  /* ---------- Pase de batalla ---------- */
  renderPass() {
    const P = Profile.pass(), pend = Profile.pending(), got = Save.d.pass.got, F = Profile.frame('black'), A = Profile.avatar('x.black');
    this.hdr = { t: 'Pase de batalla', s: 'Sube de nivel jugando · no caduca', c: 'c-pur', k: '道' };
    const icon = (r) => (r.t === 'z' ? '<i class="pri z">Ƶ</i>' : r.t === 'c' ? '<i class="pri c">◆</i>' : r.t === 'fr' ? this.pfa(Profile.cur().av, Profile.frame(r.id), 46)
      : r.t === 'av' ? this.pfa(Profile.avatar(r.id), FRAMES[0], 48, 'flat') : r.t === 'ti' ? '<i class="pri t">★</i>' : this.pfa(A, F, 46));
    let tiers = '';
    for (let lv = 1; lv <= PASS_MAX; lv++) {
      const R = passRewards(lv), st = got[lv] ? 'got' : lv <= P.lv ? 'rdy' : 'lock', big = !!PASS_SPECIAL[lv];
      tiers += '<div class="ptier ' + st + (big ? ' big' : '') + (lv === PASS_MAX ? ' fin' : '') + (lv === P.lv + 1 ? ' nxt' : '') + '" data-lv="' + lv + '"><em>' + lv + '</em>' + icon(R[0]) +
        '<b>' + (lv === PASS_MAX ? nice(PASS_FORM.name) + '<br>+ marco, foto y título' : R.map((r) => Profile.rewardName(r)).join('<br>')) + '</b>' +
        (st === 'rdy' ? '<button class="abtn" data-passclaim="' + lv + '">Recoger</button>' : '<small>' + (st === 'got' ? '✓ Recogido' : 'Nivel ' + lv) + '</small>') + '</div>';
    }
    this.el.menuBody.innerHTML = '<div class="pass"><section class="phead pnl"><div class="plv"><small>Nivel</small><b>' + P.lv + '</b><span>de ' + PASS_MAX + '</span></div>' +
      '<div class="pxp"><div class="pxb"><s style="width:' + (P.need ? P.xp / P.need * 100 : 100) + '%"></s></div><p>' + (P.need ? '<b>' + P.xp + ' / ' + P.need + '</b> de experiencia para el nivel ' + (P.lv + 1) : '<b>Pase completado.</b> Ya tienes todas las recompensas a tu alcance.') + '</p>' +
      '<p class="dim">Ganas experiencia en cada partida (más cuanto más aguantes, con jefes y victorias; +20% en Normal y +50% en Difícil), en el Torneo y al cobrar misiones.</p></div>' +
      '<div class="pfin">' + this.pfa(A, F, 96) + '<span><small>Recompensa final · nivel 50</small><b>' + nice(PASS_FORM.name) + '</b><em>Transformación de Freezer que solo se consigue aquí</em></span></div>' +
      (pend.length ? '<button class="abtn pall" data-passall>Recoger todo (' + pend.length + ')</button>' : '') + '</section>' +
      '<section class="ptrack" id="passTrack" tabindex="0" aria-label="Recompensas del pase, del nivel 1 al 50">' + tiers + '</section></div>';
    // La lista se coloca en tu nivel
    const tr = document.getElementById('passTrack'), at = tr.querySelector('.rdy') || tr.querySelector('.nxt') || tr.lastElementChild;
    if (this.passKeep !== undefined) { tr.scrollTop = this.passKeep; this.passKeep = undefined; } else if (at) tr.scrollTop = Math.max(0, at.offsetTop - tr.offsetTop - tr.clientHeight / 2 + at.offsetHeight / 2);
  },
  /** Recoge niveles del pase y enseña lo conseguido */
  passClaim(list) {
    const out = []; for (const lv of list) { const R = Profile.claim(lv); if (R) out.push(...R); }
    if (!out.length) return;
    const tr = document.getElementById('passTrack'); if (tr) this.passKeep = tr.scrollTop;
    SFX.play(out.some((r) => r.t === 'form') ? 'achieve' : 'coin');
    const z = out.filter((r) => r.t === 'z').reduce((s, r) => s + r.n, 0), c = out.filter((r) => r.t === 'c').reduce((s, r) => s + r.n, 0), rest = out.filter((r) => r.t !== 'z' && r.t !== 'c');
    const txt = [z ? '+' + z.toLocaleString('es-ES') + ' monedas' : '', c ? '+' + c + ' cristales' : ''].concat(rest.map((r) => Profile.rewardName(r))).filter(Boolean).join(' · ');
    const top = rest.find((r) => r.t === 'form') || rest[0];
    this.renderMenu();
    if (top) this.itemPopup({ icon: top.t === 'form' ? '♛' : top.t === 'fr' ? '◎' : top.t === 'av' ? '☺' : '★', name: Profile.rewardName(top), text: txt }, { name: top.t === 'form' ? 'RECOMPENSA FINAL DEL PASE' : 'PASE DE BATALLA', color: top.t === 'form' ? '#b9c8ff' : '#a487ff' });
    else this.toast(txt, true);
  },
  /** Aviso al subir de nivel en el pase (menú) */

  /** Clics propios del perfil y del pase (los llama Game desde su gestor de clics del menú) */
  profileClick(D, el) {
    const on = this.game.online;
    if (D.ptab) { this.ptab = D.ptab; this.renderMenu(); return true; }
    if (D.pset) {
      const kind = D.pset, x = kind === 'av' ? Profile.avatar(D.pid) : kind === 'fr' ? Profile.frame(D.pid) : Profile.title(D.pid), how = document.getElementById('pfHow');
      if (!x.ok()) { if (how) { how.textContent = 'Bloqueado: ' + x.how + '.'; how.classList.add('bad'); } SFX.play('click'); return true; }
      Save.d.prof[kind] = x.id; Save.write(); SFX.play('coin');
      if (on && on.logged) on.saveProfile();
      this.keepScroll(() => this.renderMenu(), '.plist');
      return true;
    }
    if (D.passclaim) { this.passClaim([+D.passclaim]); return true; }
    if (D.passall !== undefined) { this.passClaim(Profile.pending()); return true; }
    if (D.pweye !== undefined) { const i = el.parentNode.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; el.classList.toggle('on', i.type === 'text'); i.focus(); return true; }
    if (D.acct === 'resend') {
      const m = document.getElementById('acMsg'), mail = (document.getElementById('acMail') || {}).value || '';
      if (!/^\S+@\S+\.\S+$/.test(mail.trim())) { m.className = 'msg bad'; m.textContent = 'Escribe primero tu correo.'; return true; }
      m.className = 'msg'; m.textContent = 'Enviando…';
      on.resend(mail.trim()).then((r) => { m.className = 'msg' + (r.ok ? ' ok' : ' bad'); m.textContent = r.msg; });
      return true;
    }
    return false;
  },
  /** Medidor de la contraseña al crear la cuenta */
  passStrength(v) {
    const el = document.getElementById('acStr'); if (!el) return;
    let s = 0; if (v.length >= 6) s++; if (v.length >= 10) s++; if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++; if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) s++;
    if (v.length < 6) s = 0;
    el.dataset.s = s; el.querySelector('em').textContent = !v ? 'Escribe una contraseña' : v.length < 6 ? 'Demasiado corta: mínimo 6 caracteres' : ['', 'Débil: añade más caracteres', 'Aceptable', 'Buena', 'Muy buena'][s];
  },
  /** Puesto en el ranking mundial dentro del perfil */
  profileRank() {
    const on = this.game.online, el = () => document.getElementById('pfRank');
    if (!el() || !on.logged) return;
    on.myRank().then((r) => { if (el()) el().textContent = r ? 'Ranking mundial: puesto #' + r : 'Aún no tienes partidas en el ranking mundial'; }).catch(() => { if (el()) el().textContent = 'Ranking mundial: sin conexión'; });
  }
});
WI.eye = WI.eye || '<svg class="wsv" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/></svg>';
WI.pass = WI.pass || '<svg class="wsv" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v4a2 2 0 0 0 0 4v2H4v-2a2 2 0 0 0 0-4V7ZM10 7v10M14 10.5l1 2 2 .3-1.5 1.4.4 2-1.9-1-1.9 1 .4-2-1.5-1.4 2-.3 1-2Z"/></svg>';
