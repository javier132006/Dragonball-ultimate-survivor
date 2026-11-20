'use strict';
/* =====================================================================
   mastery.js · Maestría de cada guerrero: seis medallas propias por
   personaje (Supervivencia y Versus). Cada medalla se cobra una vez en
   el Rastreador y da monedas; con las seis, el guerrero es «Maestro» y
   da cristales.
   Lee las estadísticas que ya se guardan: Save.d.cs[id] (Supervivencia,
   game.trackCh) y Save.d.vs.ch[id] (Versus, VsStats.fight).
   Lo cobrado va en Save.d.mast[id] = { m1: true, ... , all: true }.
   ===================================================================== */

/* s = estadísticas del guerrero en Supervivencia · v = sus combates del Versus */
const MASTERY = [
  { id: 'm1', icon: '①', name: 'Primeros pasos', desc: 'Juega 3 partidas', v: (s) => s.runs, goal: 3, zeni: 150 },
  { id: 'm2', icon: '☠', name: 'Exterminador', desc: 'Derrota 1.000 enemigos', v: (s) => s.kills, goal: 1000, zeni: 300 },
  { id: 'm3', icon: '♛', name: 'Cazajefes', desc: 'Derrota 10 jefes', v: (s) => s.bosses, goal: 10, zeni: 400 },
  { id: 'm4', icon: '✦', name: 'Combo imparable', desc: 'Haz un combo de 150', v: (s) => s.maxCombo, goal: 150, zeni: 300 },
  { id: 'm5', icon: '★', name: 'Superviviente', desc: 'Gana una partida de Supervivencia', v: (s) => s.wins, goal: 1, zeni: 500 },
  { id: 'm6', icon: '⚔', name: 'Rival digno', desc: 'Gana 5 combates del Versus', v: (s, v) => v.wins, goal: 5, zeni: 400 }
];
const MASTERY_CRY = 100;                                   // cristales por completar las seis

const Mastery = {
  /** Lo cobrado de un guerrero */
  got(id) { const M = Save.d.mast || (Save.d.mast = {}); return M[id] || (M[id] = {}); },
  /** Progreso de una medalla (0..goal) */
  val(id, m) {
    const s = (Save.d.cs || {})[id] || {}, v = (Save.d.vs && Save.d.vs.ch && Save.d.vs.ch[id]) || {};
    return Math.min(m.goal, Math.floor(m.v(s, v) || 0));
  },
  done(id, m) { return this.val(id, m) >= m.goal; },
  /** Medallas cobradas (0-6) */
  level(id) { const g = this.got(id); return MASTERY.filter((m) => g[m.id]).length; },
  /** Medallas conseguidas que aún no se han cobrado */
  ready(id) { const g = this.got(id); return MASTERY.filter((m) => !g[m.id] && this.done(id, m)); },
  /** Total de medallas por cobrar (todos los guerreros): aviso en el botón del Rastreador */
  pending() { return CHARACTERS.reduce((n, c) => n + this.ready(c.id).length, 0); },
  /** Medallas que se acaban de conseguir y aún no se han avisado (al terminar una partida o un combate) */
  fresh(id) {
    const g = this.got(id), out = [];
    for (const m of MASTERY) if (!g[m.id] && !g['s_' + m.id] && this.done(id, m)) { g['s_' + m.id] = true; out.push(m); }
    return out;
  },
  /** Cobra las medallas listas de un guerrero. Devuelve { zeni, cry, n } */
  claim(id) {
    const g = this.got(id), list = this.ready(id); let zeni = 0, cry = 0;
    for (const m of list) { g[m.id] = true; zeni += m.zeni; }
    if (!g.all && this.level(id) === MASTERY.length) { g.all = true; cry = MASTERY_CRY; }
    Save.d.zeni += zeni; Save.d.crystals = (Save.d.crystals || 0) + cry; Save.write();
    return { zeni, cry, n: list.length };
  },
  /** Fila de medallas pequeña (ficha de selección) */
  pips(id) {
    const g = this.got(id), L = this.level(id);
    return '<span class="mpips" title="Maestría: ' + L + ' de ' + MASTERY.length + ' medallas">' + MASTERY.map((m) => '<i class="' + (g[m.id] ? 'on' : this.done(id, m) ? 'rd' : '') + '">' + m.icon + '</i>').join('') + '</span>';
  },
  /** Bloque completo para el Rastreador */
  html(id) {
    const c = charById(id); if (!c) return '';
    const g = this.got(id), L = this.level(id), rd = this.ready(id), N = MASTERY.length;
    const rows = MASTERY.map((m) => {
      const v = this.val(id, m), ok = v >= m.goal, own = !!g[m.id];
      return '<div class="mrow' + (own ? ' on' : ok ? ' rd' : '') + '"><i>' + m.icon + '</i><div><b>' + m.name + '</b><small>' + m.desc + '</small>' +
        (own ? '' : '<div class="mb"><i style="width:' + (v / m.goal * 100) + '%"></i><em>' + fmtK(v) + ' / ' + fmtK(m.goal) + '</em></div>') + '</div>' +
        '<span class="rwd"><span class="coin"></span>' + (own ? '✓' : '+' + m.zeni) + '</span></div>';
    }).join('');
    return '<h4 class="sec">Maestría <em>' + L + ' / ' + N + (g.all ? ' · Maestro' : '') + '</em></h4>' +
      '<div class="mast">' + rows + '</div>' +
      (rd.length ? '<button class="c-grn mclaim" data-mclaim="' + id + '">Cobrar ' + rd.length + (rd.length === 1 ? ' medalla' : ' medallas') + ' · +' + rd.reduce((a, m) => a + m.zeni, 0) + ' monedas' + (L + rd.length === N && !g.all ? ' y ' + MASTERY_CRY + ' cristales' : '') + '</button>' :
        '<p class="dim mhint">' + (g.all ? '¡Has dominado a ' + nice(c.name) + '!' : 'Con las ' + N + ' medallas, ' + nice(c.name) + ' se convierte en Maestro: +' + MASTERY_CRY + ' cristales.') + '</p>');
  }
};

/* Estilos de la maestría (Rastreador y ficha de selección) */
const MASTERY_CSS = `
.mast{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}
.mrow{display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:8px;background:rgba(255,255,255,.05);border:1.5px solid rgba(255,255,255,.08)}
.mrow>i{flex:none;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:15px;background:#20263f;color:var(--t3);border:2px solid #000}
.mrow.rd{border-color:#3dd68c}.mrow.rd>i{background:#3dd68c;color:#04170d}
.mrow.on>i{background:radial-gradient(circle at 35% 30%,#fff2a0,#ffb81c);color:#5a2a00}
.mrow>div{flex:1;min-width:0}.mrow b{display:block;font-size:13px}.mrow small{display:block;font-size:11px;color:var(--t2)}
.mrow .mb{margin-top:4px}.mrow .rwd{flex:none;font-weight:800;font-size:12px;display:flex;align-items:center;gap:4px}
.mrow.on .rwd{color:#ffd84a}
.mclaim{width:100%;margin:2px 0 12px;padding:9px 12px;font-weight:800}
.mhint{margin:0 0 12px;font-size:12px}
.mpips{display:inline-flex;gap:3px;vertical-align:middle}
.mpips i{width:17px;height:17px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-style:normal;font-size:10px;background:#20263f;color:#59607a;border:1.5px solid #000}
.mpips i.rd{background:#3dd68c;color:#04170d}.mpips i.on{background:radial-gradient(circle at 35% 30%,#fff2a0,#ffb81c);color:#5a2a00}
.wnav .wmast{position:relative}.wmast>u{position:absolute;top:-.45em;right:-.35em;min-width:1.5em;padding:0 .35em;border-radius:999px;background:#3dd68c;color:#04170d;font:800 calc(var(--u)*.8)/1.5 var(--body);text-decoration:none;text-align:center}
`;
(() => { const st = document.createElement('style'); st.textContent = MASTERY_CSS; document.head.appendChild(st); })();
