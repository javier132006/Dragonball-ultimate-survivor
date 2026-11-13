'use strict';
/* =====================================================================
   versus/versus.js · Controlador del MODO VERSUS.
   Módulo independiente: tiene su escena, su cámara, su HUD y su menú. El
   juego principal solo hace tres cosas: crear `new Versus(game)`, cederle
   el fotograma mientras está activo y ofrecer un botón para abrirlo.
     input.js  quién pulsa (teclado, mando, IA, red)  →  órdenes
     sim.js    reglas del combate a paso fijo          →  eventos
     view.js   sprites, arena, efectos, cámara, post
     versus.js une las tres capas, pinta el HUD y lleva los menús
   Los luchadores salen de los guerreros que ya tiene el juego (CHARACTERS):
   cada ficha es una hoja de sprites + su mapa de animaciones.
   ===================================================================== */
const VS_CSS = `
#vs{position:fixed;inset:0;z-index:60;display:none;font-family:var(--disp);color:#fff;pointer-events:none;user-select:none}
#vs.on{display:block}
#vs .bars i{position:absolute;left:0;right:0;height:0;background:#000;transition:height .35s cubic-bezier(.2,.8,.2,1)}#vs .bars i:first-child{top:0}#vs .bars i:last-child{bottom:0}#vs.cine .bars i{height:11%}
#vs .top{position:absolute;top:14px;left:18px;right:18px;display:flex;align-items:flex-start;gap:14px;transition:opacity .25s}#vs.cine .top,#vs.cine .hint,#vs.cine .cmb{opacity:0!important}
#vs .side{flex:1;display:flex;gap:10px;align-items:flex-start;min-width:0}#vs .side.r{flex-direction:row-reverse}
#vs .pt{width:74px;height:74px;flex:none;border-radius:14px;background:#141826;border:3px solid #fff;box-shadow:0 5px 0 rgba(0,0,0,.35);overflow:hidden;image-rendering:pixelated}
#vs .inf{flex:1;min-width:0}#vs .nm{display:flex;justify-content:space-between;align-items:baseline;font-size:19px;font-weight:800;letter-spacing:.03em;text-shadow:0 2px 0 rgba(0,0,0,.5);margin-bottom:3px}
#vs .side.r .nm{flex-direction:row-reverse}#vs .nm small{font-size:12px;color:var(--t2);font-weight:700}
#vs .hp{position:relative;height:22px;background:#141826;border:3px solid #fff;border-radius:6px;transform:skewX(-14deg);overflow:hidden;box-shadow:0 4px 0 rgba(0,0,0,.35)}#vs .side.r .hp{transform:skewX(14deg)}
#vs .hp i{position:absolute;inset:0;transform-origin:left;will-change:transform}#vs .side.r .hp i{transform-origin:right}
#vs .hp .g{background:#ff4d5e}#vs .hp .v{background:linear-gradient(180deg,#b8ff8a,#33d17a 45%,#0f8a45)}#vs .hp.low .v{background:linear-gradient(180deg,#ffd0a0,#ff8a2a 45%,#c0440a)}
#vs .row{display:flex;gap:8px;align-items:center;margin-top:5px}#vs .side.r .row{flex-direction:row-reverse}
#vs .ki{position:relative;flex:1;max-width:62%;height:11px;background:#141826;border:2px solid #fff;border-radius:4px;overflow:hidden;transform:skewX(-14deg)}#vs .side.r .ki{transform:skewX(14deg)}
#vs .ki i{position:absolute;inset:0;transform-origin:left;background:linear-gradient(180deg,#bfe8ff,#3aa8ff)}#vs .side.r .ki i{transform-origin:right}
#vs .ki::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 calc(20% - 2px),#141826 calc(20% - 2px) 20%)}
#vs .ki.full i{background:linear-gradient(180deg,#fff6c0,#ffc531);animation:vsp .5s steps(2) infinite}@keyframes vsp{50%{filter:brightness(1.5)}}
#vs .gd{width:22%;height:6px;background:#141826;border-radius:3px;overflow:hidden}#vs .gd i{display:block;height:100%;background:#8ad8ff;transform-origin:left}#vs .side.r .gd i{transform-origin:right}
#vs .tr{position:relative;width:44%;height:9px;background:#141826;border:2px solid #fff;border-radius:4px;overflow:hidden;transform:skewX(-14deg)}#vs .side.r .tr{transform:skewX(14deg)}
#vs .tr i{position:absolute;inset:0;transform-origin:left;background:linear-gradient(90deg,#ff5a2a,#ffb02a 60%,#fff2a0)}#vs .side.r .tr i{transform-origin:right}
#vs .tr.full{box-shadow:0 0 14px 2px #ffb02a;animation:vsp .35s steps(2) infinite}#vs .tr.max{opacity:.3}
#vs .trl{font-size:12px;font-weight:800;letter-spacing:.06em;color:#ffd75a;text-shadow:0 2px 0 rgba(0,0,0,.6);white-space:nowrap}#vs .trl kbd{font:inherit;color:#141826;background:#ffd75a;border-radius:4px;padding:0 5px;margin:0 3px}
#vs .pips{display:flex;gap:4px}#vs .pips b{width:11px;height:11px;border-radius:50%;border:2px solid #fff;background:#141826}#vs .pips b.w{background:#ffc531}
#vs .clock{flex:none;width:76px;text-align:center;font-size:40px;font-weight:800;line-height:1;text-shadow:0 4px 0 rgba(0,0,0,.4);padding-top:8px}#vs .clock small{display:block;font-size:11px;letter-spacing:.14em;color:var(--t2)}
#vs .cmb{position:absolute;top:32%;font-size:44px;font-weight:800;line-height:.95;text-shadow:0 4px 0 rgba(0,0,0,.45);opacity:0;transition:opacity .2s}#vs .cmb.on{opacity:1}#vs .cmb.l{left:26px}#vs .cmb.r{right:26px;text-align:right}
#vs .cmb small{display:block;font-size:14px;letter-spacing:.1em;color:#ffc531}#vs .cmb.pop b{display:inline-block;animation:vsc .16s}@keyframes vsc{0%{transform:scale(1.5)}}
#vs .big{position:absolute;left:0;right:0;top:36%;text-align:center;font-size:clamp(46px,10vw,128px);font-weight:800;letter-spacing:.02em;text-shadow:0 8px 0 rgba(0,0,0,.4),0 0 40px rgba(255,200,60,.5);opacity:0;pointer-events:none}
#vs .big.go{animation:vsb var(--d,1.2s) cubic-bezier(.2,.9,.2,1) both}@keyframes vsb{0%{opacity:0;transform:scale(2.4)}16%{opacity:1;transform:scale(1)}80%{opacity:1;transform:scale(1.04)}100%{opacity:0;transform:scale(1.2)}}
#vs .tag{position:absolute;left:0;right:0;top:60%;text-align:center;font-size:26px;font-weight:800;color:#ffc531;text-shadow:0 3px 0 rgba(0,0,0,.5);opacity:0}#vs .tag.go{animation:vsb .8s both}
#vs .ult{position:absolute;left:0;right:0;bottom:14%;text-align:center;opacity:0;transform:translateX(-30px);transition:opacity .2s,transform .3s}#vs.cine .ult{opacity:1;transform:none}#vs .ult.off{opacity:0!important}
#vs .ult b{display:inline-block;padding:8px 46px;font-size:clamp(22px,4.4vw,48px);font-weight:800;letter-spacing:.04em;transform:skewX(-12deg);background:linear-gradient(90deg,transparent,var(--c,#fff) 18%,var(--c,#fff) 82%,transparent);color:#141826;text-shadow:0 2px 0 rgba(255,255,255,.5)}
#vs .hint{position:absolute;left:0;right:0;bottom:10px;text-align:center;font:600 12px/1.5 var(--body);color:#e8ecf8;text-shadow:0 1px 2px #000;transition:opacity .25s}#vs .hint b{color:#ffc531}
#vs .pnl{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(10,12,24,.72);pointer-events:auto}#vs .pnl.on{display:flex}
#vs .box{background:#1b2036;border:3px solid #fff;border-radius:18px;padding:22px 26px;box-shadow:0 10px 0 rgba(0,0,0,.35);text-align:center;min-width:300px}
#vs .box h2{font-size:34px;margin:0 0 4px}#vs .box p{font:600 14px var(--body);color:var(--t2);margin:0 0 14px}#vs .box button{display:block;width:100%;margin-top:9px;padding:11px 18px;border-radius:12px;border:3px solid #fff;background:#2a3152}
#vs .box button.go{background:var(--yel);color:#141826}
#vs .sel{position:absolute;inset:0;display:none;background:radial-gradient(120% 90% at 50% 0%,#2a3160,#0d1022 70%);pointer-events:auto;padding:16px 20px;grid-template-columns:230px 1fr 250px;grid-template-rows:auto 1fr;gap:14px}#vs .sel.on{display:grid}
#vs .sel h1{grid-column:1/-1;margin:0;font-size:34px;letter-spacing:.04em;display:flex;align-items:center;gap:14px}#vs .sel h1 small{font:600 14px var(--body);color:var(--t2)}#vs .sel h1 button{margin-left:auto}
#vs .col{background:rgba(20,24,44,.82);border:2px solid rgba(255,255,255,.18);border-radius:16px;padding:12px 14px;overflow:auto;min-height:0}
#vs .col h4{margin:10px 0 6px;font-size:12px;letter-spacing:.14em;color:var(--t3)}#vs .col h4:first-child{margin-top:0}
#vs .vseg{display:flex;gap:6px;flex-wrap:wrap}#vs .vseg button,#vs .sel h1 button{padding:7px 11px;font-size:14px;border-radius:10px;border:2px solid rgba(255,255,255,.35);background:#2a3152}#vs .vseg button.on{background:var(--yel);color:#141826;border-color:#fff}
#vs .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:8px}
#vs .grid button{position:relative;padding:0;aspect-ratio:1;border-radius:12px;border:3px solid rgba(255,255,255,.3);background:#141826;overflow:hidden}#vs .grid canvas{width:100%;height:100%;image-rendering:pixelated;display:block}
#vs .grid button.p0{border-color:#5ab8ff;box-shadow:0 0 0 3px rgba(90,184,255,.45)}#vs .grid button.p1{border-color:#ff5a6a;box-shadow:0 0 0 3px rgba(255,90,106,.45)}#vs .grid button.p0.p1{border-color:#ffc531}
#vs .grid em{position:absolute;left:3px;top:2px;font:800 11px var(--disp);font-style:normal;text-shadow:0 1px 2px #000}
#vs .pick{display:flex;gap:10px;align-items:center;padding:8px;border-radius:12px;border:3px solid transparent;cursor:pointer;margin-bottom:8px;background:rgba(0,0,0,.25)}#vs .pick.on{border-color:#fff;background:rgba(255,255,255,.08)}
#vs .pick canvas{width:62px;height:62px;border-radius:10px;background:#141826;image-rendering:pixelated;flex:none}#vs .pick b{display:block;font-size:17px;line-height:1.1}#vs .pick small{font:600 12px var(--body);color:var(--t2)}
#vs .vst{display:grid;grid-template-columns:1fr;gap:3px;font:600 12px var(--body)}#vs .vst div{display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.08)}#vs .vst span{color:var(--t2)}
#vs .twi{font:600 13px/1.5 var(--body);color:var(--t2);padding:10px;border-radius:12px;background:rgba(0,0,0,.25);margin-bottom:8px}#vs .twi b{color:#ffc531}
#vs .trn{position:absolute;left:18px;bottom:38px;display:none;pointer-events:auto;background:rgba(20,24,44,.78);border:2px solid rgba(255,255,255,.25);border-radius:12px;padding:8px 10px;font:600 12px/1.5 var(--body);max-width:330px}#vs .trn.on{display:block}#vs.cine .trn{opacity:0}#vs.touch .trn{bottom:auto;top:96px}
#vs .trn b{color:#ffc531}#vs .trn .vseg{margin-top:5px}#vs .trn .vseg button{padding:4px 8px;font-size:12px}#vs .trn kbd{font:inherit;color:#141826;background:#fff;border-radius:3px;padding:0 4px;margin-right:4px}
#vs .keys{font:600 12px/1.55 var(--body);color:var(--t2)}#vs .keys b{color:#fff}#vs .fight{width:100%;margin-top:10px;padding:13px;font-size:22px;border-radius:14px;border:3px solid #fff;background:var(--yel);color:#141826}
#vs .clock small{white-space:nowrap}#vs.touch .trl kbd,#vs.touch .keys,#vs.touch .trn kbd{display:none}
@media (max-width:900px),(max-height:520px){#vs .sel.on{display:block;overflow:auto}#vs .sel h1{font-size:24px;margin-bottom:10px}#vs .col{overflow:visible;margin-bottom:10px}#vs .grid{grid-template-columns:repeat(auto-fill,minmax(58px,1fr))}#vs .pt{width:52px;height:52px}#vs .nm{font-size:14px}#vs .clock{font-size:28px;width:52px}}
`;
const VS_HINT = '<b>WASD</b> mover · <b>Espacio/Mayús</b> subir/bajar · <b>J</b> golpe · <b>K</b> fuerte · <b>L</b> ki · <b>U</b> guardia · <b>I</b> dash · <b>O</b> teletransporte · <b>H</b> cargar · <b>Y</b> Ultimate · <b>T</b> transformarse · <b>Esc</b> pausa';
const VS_KEYS_HTML = '<h4>JUGADOR 1 · TECLADO</h4><b>WASD</b> mover · <b>Espacio</b>/<b>Mayús izq.</b> subir y bajar<br><b>J</b> golpe (4 seguidos + otra vez = <b>ráfaga</b>) · <b>K</b> golpe fuerte · <b>L</b> ki<br><b>U</b> guardia · <b>I</b> dash · <b>O</b> teletransporte<br><b>H</b> cargar ki · <b>Y</b> Ultimate · <b>T</b> transformarse' +
  '<h4>JUGADOR 2 · TECLADO</h4><b>Flechas</b> mover · <b>Mayús der.</b>/<b>Ctrl der.</b> subir y bajar<br>Numérico: <b>1</b> golpe · <b>2</b> fuerte · <b>3</b> ki · <b>4</b> guardia · <b>5</b> dash · <b>6</b> teletransporte · <b>0</b> cargar · <b>Intro</b> Ultimate · <b>+</b> transformarse' +
  '<h4>MANDO</h4><b>X</b> golpe · <b>Y</b> fuerte · <b>B</b> ki · <b>A</b> dash · <b>LB</b> guardia · <b>RB</b> teletransporte · <b>LT</b> cargar · <b>RT</b> Ultimate · <b>pulsar un stick</b> transformarse · cruceta ↑↓ subir/bajar<br>El primer mando es del jugador 1; el segundo, del jugador 2.' +
  '<h4>COMBO</h4>Cada pulsación de <b>golpe</b> es un golpe. Si conectas los 4, pulsa una vez más: sale sola una <b>ráfaga</b> de golpes rápidos que manda al rival volando. Tras cualquier golpe puedes cortar con el <b>golpe fuerte</b>.' +
  '<h4>TRANSFORMACIÓN</h4>La barra naranja se llena al pegar y al recibir daño. Llena, <b>transfórmate</b>: más fuerza, algo de vida y una <b>Ultimate distinta</b>, la de esa forma. Puedes encadenar todas las formas del guerrero.' +
  '<h4>TRUCOS</h4>Guardia justo antes del golpe: <b>contraataque</b>. Dash cuando el rival sale volando: <b>persecución</b>. Teletransporte mientras te pegan: <b>escapas</b> (30 de ki).';

/** Ficha de un luchador a partir de un guerrero del juego y una de sus formas. k = transformaciones hechas en el combate hasta llegar a ella */
function vsDef(ch, fi, k) {
  k = k || 0; const f = ch.forms[fi] || ch.forms[0];
  return { id: ch.id, name: nice(ch.name), form: f.name, sheet: f.sheet, anim: f.anim, tint: f.tint === undefined ? 0xffffff : f.tint, col: f.ki || 0x8ad8ff,
    hp: Math.round(1000 * Math.max(0.88, Math.min(1.22, (ch.hp || 110) / 112))), spd: Math.max(0.94, Math.min(1.12, 0.9 + (ch.spd || 1) * 0.1 + fi * 0.01)) * (1 + 0.02 * Math.min(4, k)), pow: (1 + Math.min(4, fi) * 0.015) * (1 + 0.08 * Math.min(4, k) + 0.02 * Math.max(0, k - 4)),
    ult: vsUlt(ch, f, ch.forms.indexOf(f), k) };            // cada forma tiene su propia Ultimate (versus/ults.js)
}
/** Cadena de formas de un combate: de la forma inicial elegida a la última que tenga sprites */
function vsChain(ch, fi) {
  const out = []; for (let i = fi; i < ch.forms.length; i++) if (SPRITE_DATA[ch.forms[i].sheet]) out.push(vsDef(ch, i, out.length));
  return out.length ? out : [vsDef(ch, 0, 0)];
}

/** Parte visible de un luchador: sprite, aura y qué fotograma toca según su estado en la simulación */
class VsActor {
  constructor(stage, chain, sheets) {
    const def = chain[0]; this.chain = chain; this.sheets = sheets; this.fi = 0; this.pop = 0;
    this.def = def; this.spr = new VsSprite(stage.scene, true); this.spr.setSheet(sheets[0]); this.spr.u.uTint.value.setHex(def.tint);
    const U = { uSize: { value: new THREE.Vector2(7.4, 9.8) }, uAnchor: { value: new THREE.Vector2(0.5, 0.07) }, uRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uRight: this.spr.u.uRight, uFlip: { value: 0 }, uRoll: { value: 0 },
      uCol: { value: new THREE.Color(def.col) }, uT: { value: 0 }, uPow: { value: 0 } };
    this.aura = new THREE.Mesh(VS_QUAD, new THREE.ShaderMaterial({ uniforms: U, vertexShader: VSS_VS, fragmentShader: VSAURA_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.aura.frustumCulled = false; this.aura.renderOrder = -1; stage.scene.add(this.aura); this.au = U;
    this.pow = 0; this.t = 0; this.roll = 0; this.sq = 1; this.px = 0; this.py = 0; this.pz = 0; this.flip = false; this.gt = 0;
  }
  /** Cambia a otra forma de la cadena: hoja de sprites, tinte y color de la energía */
  setForm(fi) { this.fi = fi; this.def = this.chain[fi]; this.spr.setSheet(this.sheets[fi]); this.spr.u.uTint.value.setHex(this.def.tint); this.au.uCol.value.setHex(this.def.col); }
  frame(f, sim) {
    const A = this.def.anim, t = this.t, seq = (s, fps) => (Array.isArray(s) ? s[Math.floor(t * fps) % s.length] : s), last = (s) => (Array.isArray(s) ? s[s.length - 1] : s), first = (s) => (Array.isArray(s) ? s[0] : s);
    const chg = A.chgSeq ? seq(A.chgSeq, 10) : A.idle, u = sim.ult && sim.ult.who === f.i ? sim.ult : null;
    switch (f.st) {
      case 'move': return f.y < 0.15 && Math.hypot(f.vx, f.vz) > 1 ? seq(A.walk, 9) : Math.hypot(f.vx, f.vy, f.vz) > 5 ? A.dash : seq(A.idleSeq || A.idle, 6);
      case 'dash': return A.dash;
      case 'atk': return A.atkSeq ? A.atkSeq[f.c % A.atkSeq.length] : f.c & 1 ? A.atk2 : A.atk;
      case 'flurry': return f.done ? A.crit : A.atkSeq ? A.atkSeq[f.n % 2] : f.n & 1 ? A.atk2 : A.atk;
      case 'heavy': return f.t < 0.17 ? (A.atkSeq ? A.atkSeq[0] : A.atk) : A.crit;
      case 'shot': return A.atk2;
      case 'charge': case 'trans': return chg;
      case 'hurt': case 'stun': case 'held': return A.hurt;
      case 'launched': return first(A.death);
      case 'down': return last(A.death);
      case 'ko': return f.y > 0.05 || f.vy > 0 ? first(A.death) : last(A.death);
      case 'ult':
        if (!u || u.ph === 0) return chg;
        switch (u.type) {
          case 'beam': return A.atk2;
          case 'bomb': case 'storm': case 'rift': return A.crit;
          case 'nova': return u.r > 0 ? A.crit : chg;
          case 'discs': case 'volley': return u.n & 1 ? A.atk2 : A.atk;
          case 'grab': return !u.lock ? (u.thrown ? A.atk2 : A.dash) : u.v === 2 ? A.atk2 : u.v === 0 && u.t > 0.55 ? A.crit : A.atk;
          case 'slash': if (u.lock && u.w2) return seq(A.idleSeq || A.idle, 6);   // de espaldas, esperando a que estallen los cortes
        }
        return u.lock ? (u.n % 3 === 2 ? A.crit : A.atkSeq ? A.atkSeq[u.n % A.atkSeq.length] : u.n % 2 ? A.atk : A.atk2) : A.dash;
      default: return seq(A.idleSeq || A.idle, 6);
    }
  }
}

class Versus {
  constructor(game) {
    this.g = game; this.active = false; this.cfg = { mode: 'cpu', level: 'normal', arena: 'dia', rounds: 2, pick: [null, null], side: 0, dummy: 'still', tki: '1', ttm: '1' }; this.tw = null;
    const st = document.createElement('style'); st.textContent = VS_CSS; document.head.appendChild(st);
    const el = this.el = document.createElement('div'); el.id = 'vs';
    const side = (c) => '<div class="side ' + c + '"><canvas class="pt" width="74" height="74"></canvas><div class="inf"><div class="nm"><span></span><small></small></div><div class="hp"><i class="g"></i><i class="v"></i></div>' +
      '<div class="row"><div class="ki"><i></i></div><div class="gd"><i></i></div><div class="pips"></div></div><div class="row"><div class="tr"><i></i></div><span class="trl"></span></div></div></div>';
    el.innerHTML = '<div class="bars"><i></i><i></i></div><div class="top">' + side('l') + '<div class="clock"><small>RONDA 1</small><span>99</span></div>' + side('r') + '</div>' +
      '<div class="cmb l"><b></b><small></small></div><div class="cmb r"><b></b><small></small></div><div class="big"></div><div class="tag"></div><div class="ult"><b></b></div><div class="hint">' + VS_HINT + '</div><div class="trn"></div>' +
      '<div class="pnl pause"><div class="box"><h2>PAUSA</h2><p>Modo Versus</p><button class="go" data-v="resume">Seguir</button><button data-v="reselect">Cambiar luchadores</button><button data-v="exit">Salir al menú</button></div></div>' +
      '<div class="pnl end"><div class="box"></div></div>' +
      '<div class="sel"></div>';
    document.body.appendChild(el);
    if (typeof IS_TOUCH !== 'undefined' && IS_TOUCH) { this.touch = new VsTouchPad(el, () => this.cmd('pause')); el.classList.add('touch'); }   // móvil y tableta: mandos en pantalla
    const q = (s) => el.querySelector(s), qa = (s) => [...el.querySelectorAll(s)];
    this.ui = { sides: qa('.side').map((s) => ({ pt: s.querySelector('.pt'), nm: s.querySelector('.nm span'), fm: s.querySelector('.nm small'), hp: s.querySelector('.hp'), g: s.querySelector('.hp .g'), v: s.querySelector('.hp .v'),
      ki: s.querySelector('.ki'), kiI: s.querySelector('.ki i'), gd: s.querySelector('.gd i'), pips: s.querySelector('.pips'), tr: s.querySelector('.tr'), trI: s.querySelector('.tr i'), trl: s.querySelector('.trl'), ghost: 1 })), cmb: qa('.cmb'), big: q('.big'), tag: q('.tag'), ult: q('.ult b'), ultBox: q('.ult'),
      clock: q('.clock span'), rnd: q('.clock small'), pause: q('.pause'), end: q('.end'), sel: q('.sel'), trn: q('.trn') };
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { e.stopPropagation(); this.cmd(b.dataset.v, b.dataset.a); } });
    window.addEventListener('keydown', (e) => {
      if (!this.active || e.repeat) return;
      if (e.code === 'Escape') { if (this.sim && this.sim.phase !== 'end') this.cmd(this.paused ? 'resume' : 'pause'); else if (!this.sim) this.cmd('exit'); }
      else if (e.code === 'Enter' && !this.sim) this.cmd('fight');
      else if (this.trn && !this.paused) { const k = { Digit1: 'dummy', Digit2: 'ki', Digit3: 'tm', KeyR: 'pos', Digit4: 'base' }[e.code]; if (k) this.cmd('trn', k); }
    });
  }

  /* ---------------- Menú de selección ---------------- */
  roster() { return CHARACTERS.filter((c) => !c.soon && Save.d.unlocked.includes(c.id) && c.forms && c.forms.length && SPRITE_DATA[c.forms[0].sheet]); }
  open() {
    const g = this.g; if (this.active) return;
    this.active = true; this.prevState = g.state; g.state = 'versus'; g.releaseMouse && g.releaseMouse();
    g.ui.el.menu.style.display = 'none'; g.ui.el.hud.style.display = 'none';
    this.el.classList.add('on'); const R = this.roster(), c = this.cfg;
    if (!c.pick[0] || !R.some((x) => x.id === c.pick[0].id)) c.pick[0] = { id: (R.find((x) => x.id === Save.d.sel) || R[0]).id, f: 0 };
    if (!c.pick[1] || !R.some((x) => x.id === c.pick[1].id)) c.pick[1] = { id: (R[1] || R[0]).id, f: 0 };
    this.showSelect(); SFX.play('tp');
  }
  showSelect() {
    this.clearFight(); this.sim = null; this.paused = false; this.ui.pause.classList.remove('on'); this.ui.end.classList.remove('on'); this.el.classList.remove('cine');
    for (const k of ['.top', '.hint', '.cmb.l', '.cmb.r', '.tc']) for (const n of this.el.querySelectorAll(k)) n.style.display = 'none';
    this.ui.trn.classList.remove('on'); this.trn = null; if (this.touch) this.touch.clear();
    this.ui.sel.classList.add('on'); this.renderSelect(); SFX.music('menu');
  }
  renderSelect() {
    const c = this.cfg, R = this.roster(), seg = (k, list) => '<div class="vseg">' + list.map(([v, t]) => '<button data-v="set" data-a="' + k + ':' + v + '"' + (String(c[k]) === String(v) ? ' class="on"' : '') + '>' + t + '</button>').join('') + '</div>';
    const p2 = c.mode === 'cpu' ? 'CPU' : c.mode === 'train' ? 'RIVAL DE PRÁCTICA' : 'JUGADOR 2';
    const who = (i) => { const ch = charById(c.pick[i].id), f = ch.forms[c.pick[i].f] || ch.forms[0]; return '<div class="pick' + (c.side === i ? ' on' : '') + '" data-v="side" data-a="' + i + '"><canvas width="62" height="62" data-pt="' + f.sheet + '"></canvas><div><small>' +
      (i ? p2 : 'JUGADOR 1') + '</small><b>' + nice(ch.name) + '</b><small>' + nice(f.name) + '</small><small style="display:block;color:#ffc531">★ ' + vsUlt(ch, f, ch.forms.indexOf(f), 0).name + '</small></div></div>'; };
    const cur = charById(c.pick[c.side].id), lad = c.mode === 'ladder', trn = c.mode === 'train', L = VS_TOWER.levels[c.level] || VS_TOWER.levels.normal;
    this.ui.sel.innerHTML = '<h1>MODO VERSUS <small>Combate 1 contra 1 en arena 3D</small><button data-v="exit">◀ Volver</button></h1>' +
      '<div class="col"><h4>MODO</h4>' + seg('mode', [['cpu', 'Contra la CPU'], ['local', '2 jugadores'], ['ladder', 'Torre'], ['train', 'Entrenamiento']]) + (c.mode === 'cpu' || lad ? '<h4>DIFICULTAD</h4>' + seg('level', [['easy', 'Fácil'], ['normal', 'Normal'], ['hard', 'Difícil']]) : '') +
      (trn ? '<h4>RIVAL DE PRÁCTICA</h4>' + seg('dummy', Object.keys(VS_DUMMY).map((k) => [k, VS_DUMMY[k]])) + '<h4>AYUDAS</h4>' + seg('tki', [['1', 'Ki infinito'], ['0', 'Ki normal']]) + '<div style="height:6px"></div>' + seg('ttm', [['1', 'Barra de transformación llena'], ['0', 'Barra normal']]) : '') +
      (lad ? '' : '<h4>ARENA</h4>' + seg('arena', Object.keys(VS_ARENAS).map((k) => [k, VS_ARENAS[k].name]).concat([['azar', '🎲 Al azar']]))) + (trn ? '' : '<h4>RONDAS PARA GANAR</h4>' + seg('rounds', [[1, '1'], [2, '2'], [3, '3']])) + '<div class="keys">' + VS_KEYS_HTML + '</div></div>' +
      '<div class="col"><h4>ELIGE LUCHADOR PARA ' + (c.side ? (c.mode === 'cpu' ? 'LA CPU' : trn ? 'EL RIVAL DE PRÁCTICA' : 'EL JUGADOR 2') : 'EL JUGADOR 1') + '</h4><div class="grid">' + R.map((ch) => '<button data-v="char" data-a="' + ch.id + '" class="' + (c.pick[0].id === ch.id ? 'p0 ' : '') + (!lad && c.pick[1].id === ch.id ? 'p1' : '') +
        '" title="' + nice(ch.name) + '"><canvas width="74" height="74" data-pt="' + ch.forms[0].sheet + '"></canvas><em>' + (c.pick[0].id === ch.id ? 'J1 ' : '') + (!lad && c.pick[1].id === ch.id ? (c.mode === 'cpu' ? 'CPU' : trn ? 'RIVAL' : 'J2') : '') + '</em></button>').join('') + '</div>' +
      '<h4>FORMA INICIAL · en combate se transforma hasta la última</h4>' + '<div class="vseg">' + cur.forms.map((f, i) => (SPRITE_DATA[f.sheet] ? '<button data-v="form" data-a="' + i + '"' + (c.pick[c.side].f === i ? ' class="on"' : '') + '>' + nice(f.name) + '</button>' : '')).join('') + '</div>' +
      '<h4>ULTIMATES · una distinta en cada forma</h4><div class="vst">' + vsChain(cur, c.pick[c.side].f).map((d) => '<div><span>' + nice(d.form) + '</span><b>' + d.ult.name + ' <small style="font-weight:600;color:var(--t2)">· ' + VS_ULT_INFO[d.ult.type][d.ult.v] + '</small></b></div>').join('') + '</div></div>' +
      '<div class="col">' + who(0) + (lad ? '<div class="twi"><b>TORRE</b> · ' + VS_TOWER.n + ' rivales al azar, cada uno más duro que el anterior; el último es un <b>jefe</b> ya transformado. Tienes una continuación.<br>Premio: zeni y cristales en cada victoria y <b>' + L.cry + ' cristales</b> al superarla' +
        (VsStats.d().tower[c.level] ? '' : ' (<b>el doble</b> la primera vez)') + '.</div>' : who(1)) + '<button class="fight" data-v="fight">' + (lad ? '¡SUBIR A LA TORRE!' : trn ? '¡ENTRENAR!' : '¡LUCHAR!') + '</button>' + VsStats.html(c.pick[0].id) + '</div>';
    for (const cv of this.ui.sel.querySelectorAll('canvas[data-pt]')) this.portrait(cv, cv.dataset.pt);
  }
  /** Retrato: el busto del primer fotograma de la hoja, ampliado sin suavizar */
  portrait(cv, sheet) {
    vsTexture(sheet).then((s) => {
      if (!s) return; const g = cv.getContext('2d'), d = s.d, w = d.w * 0.62, h = w, x = (d.w - w) / 2, y = Math.max(0, d.h * (1 - (d.anc || 0)) - d.h * 0.82);
      g.imageSmoothingEnabled = false; g.clearRect(0, 0, cv.width, cv.height); g.drawImage(s.tex.image, x, y, w, h, 0, 0, cv.width, cv.height);
    });
  }
  cmd(v, a) {
    const c = this.cfg;
    if (v === 'set') { const [k, val] = a.split(':'); c[k] = k === 'rounds' ? +val : val; if (c.mode === 'ladder') c.side = 0; this.renderSelect(); }
    else if (v === 'side') { c.side = +a; this.renderSelect(); }
    else if (v === 'char') { c.pick[c.side] = { id: a, f: 0 }; SFX.play('ki'); this.renderSelect(); }
    else if (v === 'form') { c.pick[c.side].f = +a; this.renderSelect(); }
    else if (v === 'fight') { if (c.mode === 'ladder') { this.tw = VS_TOWER.build(this.roster(), c.pick[0].id, VS_TOWER.levels[c.level] ? c.level : 'normal'); VsStats.d().towerRuns++; } this.start(); }
    else if (v === 'rematch') this.start();
    else if (v === 'next' && this.tw) { this.tw.i++; this.start(); }                    // Torre: siguiente rival
    else if (v === 'retry' && this.tw && this.tw.cont > 0) { this.tw.cont--; this.start(); }
    else if (v === 'trn' && this.trn && this.sim) {                                       // ajustes del entrenamiento, en caliente
      const s = this.sim, K = Object.keys(VS_DUMMY);
      if (a === 'dummy') { c.dummy = K[(K.indexOf(c.dummy) + 1) % K.length]; this.inputs[1] = new VsDummy(c.dummy); }
      else if (a === 'ki') c.tki = c.tki === '1' ? '0' : '1';
      else if (a === 'tm') c.ttm = c.ttm === '1' ? '0' : '1';
      else if (a === 'pos' && !s.ult && !s.tr) { s.f[0].reset(7); s.f[1].reset(-7); s.shots.length = 0; s.blasts.length = 0; }
      else if (a === 'base') { this.start(); return; }
      SFX.play('ki'); this.renderTrn();
    }
    else if (v === 'reselect') this.showSelect();
    else if (v === 'pause') { if (!this.sim || this.sim.phase === 'end') return; this.paused = true; this.ui.pause.classList.add('on'); if (this.touch) this.touch.clear(); }
    else if (v === 'resume') { this.paused = false; this.ui.pause.classList.remove('on'); }
    else if (v === 'exit') this.close();
  }
  close() {
    const g = this.g; this.clearFight(); this.sim = null; this.active = false; this.el.classList.remove('on', 'cine'); this.ui.sel.classList.remove('on');
    g.ui.el.menu.style.display = ''; g.ui.el.hud.style.display = ''; g.toMenu();
  }

  /* ---------------- Combate ---------------- */
  async start() {
    if (this.loading) return; this.loading = true;
    const c = this.cfg, tw = c.mode === 'ladder' ? this.tw : null, train = c.mode === 'train', picks = [c.pick[0], tw ? tw.foes[tw.i] : c.pick[1]], AK = Object.keys(VS_ARENAS);
    const chains = picks.map((p) => vsChain(charById(p.id), p.f)), sheets = await Promise.all(chains.map((ch) => Promise.all(ch.map((d) => vsTexture(d.sheet)))));
    this.loading = false; if (!this.active || sheets.some((s) => !s[0])) return;
    chains.forEach((ch, i) => { const n = sheets[i].findIndex((s) => !s); if (n > 0) { ch.length = n; sheets[i].length = n; } });   // si una hoja no carga, la cadena acaba antes
    const defs = chains.map((ch) => ch[0]);
    this.clearFight(); const g = this.g, r = g.renderer;
    // Estado del renderizador que tocamos: se guarda y se devuelve al salir
    this.saved = { auto: r.shadowMap.autoUpdate, clear: r.getClearColor(new THREE.Color()).getHex() }; r.shadowMap.autoUpdate = true;
    const scene = this.scene = new THREE.Scene(), low = Save.d.opt.quality === 'low';
    // La Torre cambia de arena en cada combate
    this.arena = new VsArena(scene, tw || c.arena === 'azar' ? AK[(Math.random() * AK.length) | 0] : c.arena, low); this.cam = new VsCamera(); this.post = low ? null : new VsPost(r);
    this.fxA = new VsParticles(scene, 700, false, 3); this.fx = new VsParticles(scene, 1100, true, 9); this.beam = new VsBeam(scene);
    this.actors = chains.map((ch, i) => new VsActor(this, ch, sheets[i]));
    this.ghosts = []; for (let i = 0; i < 14; i++) { const s = new VsSprite(scene, false); s.mesh.visible = false; s.life = 0; s.mesh.renderOrder = 2; this.ghosts.push(s); }
    this.sim = new VsSim(chains[0], chains[1], { seed: (Math.random() * 1e9) | 0, rounds: train ? 1 : c.rounds, noKO: train, noTime: train });
    const p1 = new VsMulti([new VsKeyboard(VS_KEYS[0]), new VsGamepad(0)].concat(this.touch ? [this.touch] : []));
    this.inputs = [p1, tw ? VS_TOWER.ai(tw) : train ? new VsDummy(c.dummy) : c.mode === 'cpu' ? new VsAI(c.level) : new VsMulti([new VsKeyboard(VS_KEYS[1]), new VsGamepad(1)])];
    this.run = { tr: 0, ult: 0, sup: 0, parry: 0, maxCombo: 0, maxDmg: 0 };       // lo que hace el jugador 1 en este combate (estadísticas)
    this.trn = train ? { cmb: 0, dmg: 0, max: 0 } : null; this.sfx2 = c.mode === 'local' ? '' : train ? ' · PRÁCTICA' : ' · CPU'; this.shownT = null;
    this.acc = 0; this.time = 0; this.scale = 1; this.slow = 0; this.dim = 0; this.dimCol = 0; this.blur = 0; this.chroma = 0; this.flash = 0; this.paused = false; this.chargeSnd = 0; this.trCol = 0xffffff; this.p2cpu = c.mode !== 'local';
    this.prev = this.sim.f.map((f) => ({ x: f.x, y: f.y, z: f.z }));
    // HUD
    this.ui.sel.classList.remove('on'); this.ui.end.classList.remove('on'); this.ui.pause.classList.remove('on');
    for (const k of ['.top', '.hint', '.cmb.l', '.cmb.r', '.tc']) for (const n of this.el.querySelectorAll(k)) n.style.display = '';
    this.ui.trn.classList.toggle('on', train); if (train) this.renderTrn(); if (this.touch) this.touch.clear();
    this.ui.sides.forEach((s, i) => { s.nm.textContent = defs[i].name; s.fm.textContent = nice(defs[i].form) + (i ? this.sfx2 : ''); s.ghost = 1; s.can = null; s.trl.textContent = ''; this.portrait(s.pt, defs[i].sheet);
      s.kiI.style.background = ''; s.pips.innerHTML = train ? '' : '<b></b>'.repeat(c.rounds); s.wins = -1; });
    this.cam.update(0.016, this.sim, true); SFX.music('boss');
  }
  clearFight() {
    if (!this.scene) return; const r = this.g.renderer;
    this.scene.traverse((o) => { if (o.geometry && o.geometry !== VS_QUAD) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } if (o.customDepthMaterial) o.customDepthMaterial.dispose(); });
    if (this.post) this.post.dispose(); r.setRenderTarget(null); r.shadowMap.autoUpdate = this.saved.auto; this.g.shadowDirty = true;
    this.scene = this.arena = this.post = this.fx = this.fxA = this.beam = this.actors = this.ghosts = null;
  }

  /** Un fotograma: lo llama el bucle del juego mientras el modo está activo */
  frame(rawDt) {
    const g = this.g, r = g.renderer; g.pad.poll(rawDt);
    if (!this.sim || !this.scene) { r.setRenderTarget(null); r.setClearColor(0x0d1022, 1); r.clear(); return; }
    const sim = this.sim;
    if (!this.paused) {
      if (this.slow > 0) { this.slow -= rawDt; this.scale = this.slow > 0 ? 0.22 : 1; }
      const dt = rawDt * this.scale; this.time += dt; this.acc = Math.min(this.acc + dt, VS_DT * 5);
      while (this.acc >= VS_DT) {                                         // paso fijo: la lógica no depende de los FPS
        this.acc -= VS_DT; for (let i = 0; i < 2; i++) { const f = sim.f[i], p = this.prev[i]; p.x = f.x; p.y = f.y; p.z = f.z; }
        sim.step(this.inputs[0].read(sim, 0), this.inputs[1].read(sim, 1));
        for (const e of sim.ev) this.onEvent(e); sim.ev.length = 0;
        if (this.trn) {                                                    // entrenamiento: nadie muere y las ayudas rellenan las barras
          const a = sim.f[0], b = sim.f[1], c = this.cfg; a.hp = a.hpMax; if (a.cmb === 0 && b.st !== 'hurt' && b.st !== 'launched' && b.st !== 'held' && b.st !== 'down') b.hp = b.hpMax;
          if (c.tki === '1' && !sim.ult) a.ki = 100; if (c.ttm === '1' && a.fi < a.chain.length - 1) a.tm = 100;
        }
        this.simFx();
      }
      this.draw(dt, rawDt);
    }
    const cam = this.cam.cam, cv = r.domElement, asp = cv.width / Math.max(1, cv.height);
    if (Math.abs(cam.aspect - asp) > 0.001) { cam.aspect = asp; cam.updateProjectionMatrix(); }
    if (this.post) { const u = this.post.uC; u.uBlur.value = this.blur; u.uChroma.value = this.chroma; u.uFlash.value = this.flash; u.uSat.value = this.slow > 0 ? 0.55 : 1; u.uBloom.value = sim.tr ? 0.32 : 0.5 + this.arena.dim * 0.2; this.post.render(this.scene, cam); }
    else { r.setRenderTarget(null); r.render(this.scene, cam); }
  }

  /* ---------------- Eventos de la simulación → efectos, sonido y cámara ---------------- */
  say(txt, dur) { const b = this.ui.big; b.textContent = txt; b.style.setProperty('--d', (dur || 1.2) + 's'); b.classList.remove('go'); void b.offsetWidth; b.classList.add('go'); }
  tag(txt) { const b = this.ui.tag; b.textContent = txt; b.classList.remove('go'); void b.offsetWidth; b.classList.add('go'); }
  burst(x, y, z, col, n, sp, size) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, e = (Math.random() - 0.5) * 2, v = sp * (0.4 + Math.random() * 0.8), c = Math.cos(e);
      this.fx.add(2, x, y, z, size * (0.6 + Math.random() * 0.8), i % 3 ? col : 0xffffff, { vx: Math.cos(a) * c * v, vy: Math.sin(e) * v, vz: Math.sin(a) * c * v, drag: 3, life: 0.18 + Math.random() * 0.22, stretch: 3.2, s1: size * 0.2 }); }
  }
  dust(x, z, n, sp) {
    for (let i = 0; i < n; i++) { const a = i / n * 6.283 + Math.random() * 0.4, v = sp * (0.6 + Math.random() * 0.7);
      this.fxA.add(4, x + Math.cos(a) * 0.6, 0.35, z + Math.sin(a) * 0.6, 1.4, 0xd8cdb8, { vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: 1 + Math.random() * 1.5, drag: 2.6, life: 0.55 + Math.random() * 0.4, s1: 3.6, a: 0.5 }); }
  }
  boom(x, y, z, col, big) {
    const k = big === 2 ? 2.3 : big ? 1.5 : 1;
    this.fx.add(0, x, y, z, 3 * k, 0xffffff, { s1: 9 * k, life: 0.28, a: 0.8 }); this.fx.add(0, x, y, z, 4 * k, col, { s1: 14 * k, life: 0.5, a: 0.55 });
    this.fx.add(1, x, y, z, 2 * k, col, { s1: 14 * k, life: 0.4 }); this.fx.add(1, x, 0.08, z, 3 * k, 0xffffff, { s1: 24 * k, life: 0.5, flat: true, a: 0.8 });
    this.burst(x, y, z, col, 34, 30 * k, 2.2 * k); this.dust(x, z, 16, 13 * k);
    for (let i = 0; i < 16; i++) { const a = Math.random() * 6.283, v = 6 + Math.random() * 12 * k; this.fxA.add(5, x, Math.max(0.3, y), z, 0.3 + Math.random() * 0.45, 0x2a2430, { vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: 8 + Math.random() * 12, g: 28, life: 1.3, bounce: true, s1: 0.2 }); }
    this.cam.shake(1.1); this.flash = Math.max(this.flash, 0.26 * Math.min(1.6, k)); this.chroma = 0.02; SFX.play('bigboom');
  }
  ghost(i, col, life) {
    const a = this.actors[i], g = this.ghosts.find((s) => s.life <= 0); if (!g) return;
    g.setSheet(a.spr.s); g.pose(a.fr, a.flip, a.roll, 1, 1); g.u.uRight.value.copy(a.spr.u.uRight.value); g.mesh.position.set(a.px, a.py, a.pz); g.u.uTint.value.setHex(col); g.life = g.max = life || 0.24; g.mesh.visible = true;
  }
  onEvent(e) {
    const sim = this.sim, cam = this.cam, fx = this.fx;
    switch (e.t) {
      case 'round': { const tw = this.cfg.mode === 'ladder' && this.tw;
        this.say(this.trn ? 'ENTRENAMIENTO' : tw && e.n === 1 ? (tw.i === VS_TOWER.n - 1 ? 'JEFE FINAL' : 'RIVAL ' + (tw.i + 1) + ' DE ' + VS_TOWER.n) : 'RONDA ' + e.n, 1.5);
        this.ui.rnd.textContent = this.trn ? 'PRÁCTICA' : tw ? 'TORRE ' + (tw.i + 1) + '/' + VS_TOWER.n + ' · R' + e.n : 'RONDA ' + e.n; } cam.update(0.016, sim, true); break;
      case 'fight': this.say('¡LUCHA!', 0.9); SFX.play('crit'); break;
      case 'swing': if (e.heavy) SFX.play('slash'); break;
      case 'flurry': this.tag('¡RÁFAGA!'); this.blur = Math.max(this.blur, 0.5); SFX.play('dash'); break;
      case 'mark': {                                                    // aviso en el suelo de una explosión que está al caer
        this.fxA.add(1, e.x, 0.09, e.z, e.r * 2.3, e.col, { s1: e.r * 0.5, life: e.t, flat: true, a: 0.85 }); fx.add(1, e.x, 0.1, e.z, e.r * 0.4, 0xffffff, { s1: e.r * 2.1, life: e.t, flat: true, a: 0.5 });
        if (e.sky) { const h = 26, k = e.sky === 2 ? 2.6 : 1; fx.add(2, e.x, h, e.z, 2.2 * k, e.col, { vy: -h / e.t, life: e.t, stretch: 7, a: 0.9 }); fx.add(0, e.x, h, e.z, 2.4 * k, 0xffffff, { vy: -h / e.t, life: e.t, s1: 1.6 * k, a: 0.9 }); }
        if (e.pil) for (let k = 0; k < 6; k++) { const an = Math.random() * 6.283; this.fxA.add(5, e.x + Math.cos(an) * e.r * 0.6, 0.2, e.z + Math.sin(an) * e.r * 0.6, 0.3, 0x3a3038, { vy: 6 + Math.random() * 6, life: e.t + 0.3, s1: 0.1 }); }
        break; }
      case 'cut': {                                                     // tajo: línea de luz de lado a lado
        const w = e.w || 1; this.line(e.x0, e.y0, e.z0, e.x1, e.y1, e.z1, e.col, w, 0.2 + w * 0.05); this.flash = Math.max(this.flash, 0.05 * w); cam.shake(0.25 * w); SFX.play('slash'); break; }
      case 'crack': fx.add(1, e.x, 0.09, e.z, 1, e.col, { s1: 6.5, life: 0.4, flat: true, a: 0.9 }); fx.add(2, e.x, 0.3, e.z, 1.3, e.col, { vy: 15 + Math.random() * 9, life: 0.3, stretch: 4 }); this.dust(e.x, e.z, 3, 7);
        this.fxA.add(5, e.x, 0.3, e.z, 0.35, 0x2a2430, { vx: (Math.random() - 0.5) * 9, vz: (Math.random() - 0.5) * 9, vy: 8 + Math.random() * 7, g: 28, life: 1, bounce: true, s1: 0.2 }); cam.shake(0.22); break;
      case 'slam': this.dust(e.x, e.z, 18, 14); fx.add(1, e.x, 0.09, e.z, 2, e.col, { s1: 22, life: 0.45, flat: true, a: 0.9 }); this.burst(e.x, 0.8, e.z, e.col, 18, 22, 1.4); cam.shake(0.9); cam.kick = 1; SFX.play('boom'); break;
      case 'novaGo': { const k = e.big === 2 ? 1.5 : 1; fx.add(3, e.x, e.y, e.z, 6 * k, 0xffffff, { s1: 16 * k, life: 0.3, a: 0.9 }); for (let n = 0; n < 3; n++) fx.add(1, e.x, 0.1, e.z, 3, n ? e.col : 0xffffff, { s1: (34 + n * 16) * k, life: 0.5 + n * 0.15, flat: true, a: 0.6 });
        this.burst(e.x, e.y, e.z, e.col, 48, 46 * k, 1.8); this.dust(e.x, e.z, 22, 22 * k); this.flash = Math.max(this.flash, 0.55); this.chroma = 0.02; cam.shake(1.3); cam.kick = 1; SFX.play('bigboom'); g_rumble(400, 1); break; }
      case 'sheath': this.tag('...'); this.slow = 0.35; SFX.play('tp'); break;
      case 'stormShot': fx.add(2, e.x, e.y, e.z, 1.5, this.actors[e.i].def.col, { vy: 60, life: 0.22, stretch: 6 }); fx.add(3, e.x, e.y, e.z, 1.6, 0xffffff, { s1: 2.6, life: 0.1, a: 0.8 }); SFX.play('ki'); break;
      case 'hit': {
        const k = e.heavy ? 1.7 : e.rush ? 0.55 : 1;
        fx.add(3, e.x, e.y, e.z, 1.7 * k, 0xffffff, { s1: 3.4 * k, life: 0.12, rot: Math.random() * 3, a: 0.9 }); fx.add(1, e.x, e.y, e.z, 0.8, e.col, { s1: 3.8 * k, life: 0.2, a: 0.8 }); if (!e.rush) fx.add(0, e.x, e.y, e.z, 1.5 * k, e.col, { s1: 2.6 * k, life: 0.14, a: 0.4 });
        this.burst(e.x, e.y, e.z, e.col, e.heavy ? 18 : 8, e.heavy ? 24 : 14, 0.95 * k);
        cam.shake(e.heavy ? 0.78 : e.rush ? 0.34 : 0.3); if (e.heavy) { this.chroma = 0.018; cam.kick = 1; this.flash = Math.max(this.flash, 0.14); }
        SFX.play(e.heavy ? 'crit' : 'hit'); g_rumble(e.heavy ? 160 : 60, e.heavy ? 0.8 : 0.35); break;
      }
      case 'guard': fx.add(1, e.x, e.y, e.z, 1.5, 0x9adcff, { s1: 4.6, life: 0.2 }); this.burst(e.x, e.y, e.z, 0x9adcff, 5, 9, 1); cam.shake(0.16); SFX.play('block'); break;
      case 'parry': if (e.i === 0) this.run.parry++; fx.add(3, e.x, e.y, e.z, 3, 0xffffff, { s1: 6, life: 0.22 }); fx.add(1, e.x, e.y, e.z, 1.5, 0xffe27a, { s1: 6.5, life: 0.28 }); this.burst(e.x, e.y, e.z, 0xffe27a, 14, 20, 1.1); this.flash = 0.3; cam.shake(0.5); this.tag('¡CONTRAATAQUE!'); SFX.play('crit'); break;
      case 'break': this.burst(e.x, e.y, e.z, 0x9adcff, 22, 22, 1.2); fx.add(1, e.x, e.y, e.z, 1.5, 0x9adcff, { s1: 7.5, life: 0.32 }); cam.shake(0.6); this.tag('¡GUARDIA ROTA!'); SFX.play('boom'); break;
      case 'shot': fx.add(3, e.x, e.y, e.z, e.disc ? 2.4 : 1.2, 0xffffff, { s1: e.disc ? 4 : 2.2, life: 0.1, a: 0.8 }); if (e.vol) fx.add(1, e.x, e.y, e.z, 0.6, this.actors[e.i].def.col, { s1: 3, life: 0.16, a: 0.7 }); SFX.play(e.disc ? 'slash' : 'ki'); break;
      case 'pop': fx.add(0, e.x, e.y, e.z, 1.6, e.col, { s1: 3.2, life: 0.18, a: 0.6 }); fx.add(1, e.x, e.y, e.z, 0.8, e.col, { s1: 3.4, life: 0.2 }); this.burst(e.x, e.y, e.z, e.col, 6, 12, 1); break;
      case 'dash': fx.add(1, e.x, e.y + 1.5, e.z, 1.2, 0xffffff, { s1: 6.5, life: 0.22 }); if (e.y < 0.4) this.dust(e.x, e.z, 7, 8); this.blur = Math.max(this.blur, 0.55); SFX.play('dash'); break;
      case 'vanish': this.ghost(e.i, 0xffffff, 0.3); for (let i = 0; i < 9; i++) fx.add(2, e.x + (Math.random() - 0.5) * 1.6, e.y + Math.random() * 3.2, e.z + (Math.random() - 0.5) * 1.6, 1.3, 0xffffff, { vy: 16 + Math.random() * 14, life: 0.2, stretch: 4 }); SFX.play('tp'); break;
      case 'appear': fx.add(3, e.x, e.y + 1.6, e.z, 3, 0xffffff, { s1: 7, life: 0.16 }); fx.add(1, e.x, e.y + 1.6, e.z, 6, 0xffffff, { s1: 1, life: 0.16 }); break;
      case 'pursue': this.blur = 0.8; fx.add(1, e.x, e.y + 1.6, e.z, 7, this.actors[e.i].def.col, { s1: 1, life: 0.2 }); this.tag('¡PERSECUCIÓN!'); SFX.play('dash'); break;
      case 'land': this.dust(e.x, e.z, e.hard ? 16 : 8, e.hard ? 11 : 6); if (e.hard) { this.fxA.add(1, e.x, 0.07, e.z, 2, 0x4a4038, { s1: 11, life: 0.5, flat: true, a: 0.7 }); cam.shake(0.62); SFX.play('boom'); } break;
      case 'wall': this.burst(e.x, e.y, e.z, 0xffffff, 16, 20, 1.6); fx.add(1, e.x, e.y, e.z, 2, 0xffffff, { s1: 13, life: 0.3 }); cam.shake(0.8); SFX.play('boom'); break;
      case 'dmg': { if (e.i === 1) { const r = this.run; r.maxCombo = Math.max(r.maxCombo, e.cmb); r.maxDmg = Math.max(r.maxDmg, e.tot); if (this.trn) { const t = this.trn; t.cmb = e.cmb; t.dmg = e.tot; t.max = Math.max(t.max, e.tot); this.renderTrn(true); } }
        const c = this.ui.cmb[1 - e.i]; if (e.cmb >= 2) { c.firstChild.textContent = e.cmb + ' GOLPES'; c.lastChild.textContent = Math.round(e.tot) + ' DE DAÑO'; c.classList.add('on'); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); c.t = 1.4; } break; }
      case 'ko': this.say('K.O.', 2.4); this.slow = 1.5; this.flash = 0.28; cam.shake(1.2); this.boomLite(e); SFX.play('bigboom'); g_rumble(400, 1);
        { const l = sim.f[1 - e.w]; cam.play(1.4, (k, P, L) => { const dx = P.x - l.x, dy = P.y - l.y - 1.6, dz = P.z - l.z, d = Math.hypot(dx, dy, dz) || 1, r = Math.max(10, d * 0.62);   // se acerca al derrotado sin atravesarlo
          L.set(l.x, l.y + 1.6, l.z); P.set(l.x + dx / d * r, l.y + 2.4 + dy / d * r, l.z + dz / d * r); return 34; }); } break;
      case 'timeup': this.say('¡TIEMPO!', 2); break;
      case 'match': this.finish(e.w); break;
      case 'trStart': {                                                 // transformación: plano contrapicado que se cierra sobre el luchador
        this.el.classList.add('cine'); this.ui.ultBox.classList.add('off'); this.dim = 1; this.dimCol = e.col; this.trCol = e.col;
        const f = sim.f[e.i], a0 = cam.ang, s = e.i ? -1 : 1, K = VS.TR_SWAP / VS.TR_CINE;
        cam.play(VS.TR_CINE, (k, P, L) => {
          if (k < K) { const q = k / K, a = a0 + s * (0.95 - q * 1.5), r = 12 - 4.5 * q * q; L.set(f.x, f.y + 1.8 + q * 0.3, f.z); P.set(f.x + Math.cos(a) * r, f.y + 3.2 - q * 2.5, f.z + Math.sin(a) * r); return 40 - 11 * q; }
          const q = (k - K) / (1 - K), a = a0 - s * (0.55 + q * 0.25), r = 8 + 9 * Math.min(1, q * 3.2);                       // tras el estallido: salto atrás
          L.set(f.x, f.y + 2.3, f.z); P.set(f.x + Math.cos(a) * r, f.y + 1.1 + q * 1.4, f.z + Math.sin(a) * r); return 52 - 9 * q;
        });
        this.flash = 0.3; SFX.play('charge'); if (SFX.scream) SFX.scream(VS.TR_SWAP + 0.3, 165); break;
      }
      case 'trSwap': {                                                  // estallido: nueva forma, onda expansiva y nombre
        if (e.i === 0) this.run.tr++; const a = this.actors[e.i], f = sim.f[e.i], h = this.ui.sides[e.i]; a.setForm(f.fi); a.pop = 1; const col = a.def.col, x = e.x, y = e.y + 1.7, z = e.z;
        h.fm.textContent = nice(a.def.form) + (e.i ? this.sfx2 : ''); this.portrait(h.pt, a.def.sheet);
        this.ui.ult.textContent = nice(a.def.form); this.ui.ult.style.setProperty('--c', '#' + col.toString(16).padStart(6, '0')); this.ui.ultBox.classList.remove('off'); this.dimCol = col;
        fx.add(0, x, y, z, 4, 0xffffff, { s1: 11, life: 0.4, a: 0.6 }); fx.add(0, x, y, z, 6, col, { s1: 20, life: 0.8, a: 0.3 }); fx.add(3, x, y, z, 6, 0xffffff, { s1: 13, life: 0.3, a: 0.8 });
        for (let k = 0; k < 3; k++) { fx.add(1, x, 0.1, z, 2, k ? col : 0xffffff, { s1: 44 + k * 24, life: 0.55 + k * 0.22, flat: true, a: 0.5 }); fx.add(1, x, y, z, 2, k ? col : 0xffffff, { s1: 20 + k * 14, life: 0.4 + k * 0.15, a: 0.5 }); }
        this.burst(x, y, z, col, 56, 44, 1.7); this.dust(x, z, 28, 24);
        for (let k = 0; k < 26; k++) { const an = Math.random() * 6.283, v = 10 + Math.random() * 22; this.fxA.add(5, x + Math.cos(an) * 2, 0.3, z + Math.sin(an) * 2, 0.3 + Math.random() * 0.5, 0x2a2430, { vx: Math.cos(an) * v, vz: Math.sin(an) * v, vy: 9 + Math.random() * 14, g: 28, life: 1.5, bounce: true, s1: 0.2 }); }
        for (let k = 0; k < 9; k++) { const an = k * 0.698 + Math.random() * 0.4, r = 9 + Math.random() * 7; this.bolt(x, y, z, x + Math.cos(an) * r, Math.max(0.2, y + (Math.random() - 0.35) * 9), z + Math.sin(an) * r, k % 3 ? col : 0xffffff, 1.1, 0.22); }
        this.flash = 0.95; this.chroma = 0.02; this.blur = 0.8; cam.shake(1.3); cam.kick = 1; SFX.play('bigboom'); SFX.play('stinger'); g_rumble(600, 1); break;
      }
      case 'trEnd': this.el.classList.remove('cine'); this.dim = 0; break;
      case 'beamGnd': this.dust(e.x, e.z, 7, 12); fx.add(1, e.x, 0.1, e.z, 2, e.col, { s1: 13, life: 0.3, flat: true, a: 0.8 }); this.burst(e.x, 0.6, e.z, e.col, 8, 20, 1.5);
        for (let k = 0; k < 3; k++) { const an = Math.random() * 6.283, v = 6 + Math.random() * 10; this.fxA.add(5, e.x, 0.3, e.z, 0.3 + Math.random() * 0.3, 0x2a2430, { vx: Math.cos(an) * v, vz: Math.sin(an) * v, vy: 8 + Math.random() * 9, g: 28, life: 1.1, bounce: true, s1: 0.2 }); } break;
      case 'ultStart': {
        if (e.i === 0) { this.run.ult++; if (e.sup) this.run.sup++; } this.ui.ultBox.classList.remove('off'); if (e.sup) { this.tag('¡ULTIMATE SUPERIOR!'); const f0 = sim.f[e.i]; for (let k = 0; k < 6; k++) { const an = k * 1.05; this.bolt(f0.x + Math.cos(an) * 7, f0.y + 13, f0.z + Math.sin(an) * 7, f0.x, f0.y + 1.5, f0.z, k & 1 ? e.col : 0xffffff, 1, 0.2); } }
        this.el.classList.add('cine'); this.ui.ult.textContent = e.name; this.ui.ult.style.setProperty('--c', '#' + e.col.toString(16).padStart(6, '0')); this.dim = 1; this.dimCol = e.col;
        const f = sim.f[e.i], a0 = cam.ang, s = e.i ? -1 : 1;
        cam.play(VS.ULT_CINE, (k, P, L) => { const a = a0 + s * (0.5 - k * 1.0), r = 8.4 - 3 * k; L.set(f.x, f.y + 1.9, f.z); P.set(f.x + Math.cos(a) * r, f.y + 2.6 - k * 1.1, f.z + Math.sin(a) * r); return 36 - 8 * k; });
        this.flash = 0.35; SFX.play('charge'); break;
      }
      case 'ultGo': this.el.classList.remove('cine'); cam.shake(0.9); this.blur = 1; this.flash = 0.3; SFX.play(e.type === 'beam' ? 'bigbeam' : e.type === 'rush' || e.type === 'slash' || e.type === 'grab' ? 'dash' : 'pulse'); break;
      case 'beamHit': this.burst(e.x, e.y, e.z, e.col, 7, 22, 1.5); fx.add(0, e.x, e.y, e.z, 3, e.col, { s1: 5, life: 0.14, a: 0.5 }); cam.shake(0.42); SFX.play('hit'); break;
      case 'rushLock': { const f = sim.f[1 - e.i], a0 = cam.ang; cam.play(1.5, (k, P, L) => { const a = a0 + k * 2.6; L.set(f.x, f.y + 1.6, f.z); P.set(f.x + Math.cos(a) * 9, f.y + 2.2 + Math.sin(k * 3.1) * 1.4, f.z + Math.sin(a) * 9); return 34; }); break; }
      case 'rushUp': { const f = sim.f[e.i], foe = sim.f[1 - e.i], a0 = cam.ang;                       // remate superior: contrapicado que sigue al rival hasta el cielo y de vuelta al suelo
        cam.play(1.0, (k, P, L) => { const h = Math.max(0, foe.y - f.y), r = 13 + h * 0.55; L.set(foe.x, (f.y + foe.y) / 2 + 1.8, foe.z); P.set(foe.x + Math.cos(a0) * r, 1.1 + h * 0.12, foe.z + Math.sin(a0) * r); return 46; }); SFX.play('dash'); break; }
      case 'rushHit': if (e.n & 1) this.ghost(e.i, this.actors[e.i].def.col, 0.16); break;
      case 'bombGo': cam.shake(0.5); SFX.play('beam'); break;
      case 'boom':
        if (e.lite) { fx.add(0, e.x, e.y, e.z, 3, 0xffffff, { s1: 7, life: 0.22, a: 0.7 }); fx.add(0, e.x, e.y, e.z, 4, e.col, { s1: 10, life: 0.4, a: 0.5 }); fx.add(1, e.x, 0.08, e.z, 2, e.col, { s1: 13, life: 0.4, flat: true, a: 0.8 });   // impacto de la lluvia de ki: más ligero
          this.burst(e.x, e.y, e.z, e.col, 12, 22, 1.5); this.dust(e.x, e.z, 6, 9); cam.shake(0.45); SFX.play('boom'); break; }
        this.boom(e.x, e.y, e.z, e.col, e.big); g_rumble(300, 1);
        if (e.pil) { for (let k = 0; k < 22; k++) { const an = Math.random() * 6.283, r = Math.random() * 3.2; fx.add(2, e.x + Math.cos(an) * r, Math.random() * 3, e.z + Math.sin(an) * r, 2.4, k % 3 ? e.col : 0xffffff, { vy: 45 + Math.random() * 40, life: 0.5 + Math.random() * 0.3, stretch: 7, a: 0.85 }); }
          for (let k = 0; k < 5; k++) fx.add(0, e.x, 2 + k * 3.6, e.z, 8, e.col, { s1: 4, life: 0.6, a: 0.5 }); }                                       // pilar de energía
        break;
      case 'ultEnd': this.el.classList.remove('cine'); this.dim = 0; break;
    }
  }
  /** Relámpago: línea quebrada de chispas alargadas entre dos puntos */
  bolt(x0, y0, z0, x1, y1, z1, col, w, life) {
    const n = 7, d = Math.hypot(x1 - x0, y1 - y0, z1 - z0), j = d * 0.11; let px = x0, py = y0, pz = z0; w = w || 0.8;
    for (let i = 1; i <= n; i++) {
      const k = i / n, e = i < n ? 1 : 0, qx = x0 + (x1 - x0) * k + (Math.random() - 0.5) * j * e, qy = y0 + (y1 - y0) * k + (Math.random() - 0.5) * j * e, qz = z0 + (z1 - z0) * k + (Math.random() - 0.5) * j * e;
      const sx = qx - px, sy = qy - py, sz = qz - pz, L = Math.hypot(sx, sy, sz) || 1, o = { vx: sx / L * 0.01, vy: sy / L * 0.01, vz: sz / L * 0.01, life: life || 0.12, stretch: L * 1.25 / w };
      this.fx.add(2, (px + qx) / 2, (py + qy) / 2, (pz + qz) / 2, w, 0xffffff, o); o.stretch = L * 1.25 / (w * 2.6); this.fx.add(2, (px + qx) / 2, (py + qy) / 2, (pz + qz) / 2, w * 2.6, col, o);
      px = qx; py = qy; pz = qz;
    }
    this.fx.add(0, x1, y1, z1, 2.2 * w, col, { s1: 0.6, life: 0.14, a: 0.4 });
  }
  /** Línea recta de luz entre dos puntos (tajos, puños que atraviesan) */
  line(x0, y0, z0, x1, y1, z1, col, w, life) {
    const sx = x1 - x0, sy = y1 - y0, sz = z1 - z0, L = Math.hypot(sx, sy, sz) || 1, o = { vx: sx / L * 0.01, vy: sy / L * 0.01, vz: sz / L * 0.01, life, stretch: L / (w * 0.5), a: 1 }, mx = (x0 + x1) / 2, my = (y0 + y1) / 2, mz = (z0 + z1) / 2;
    this.fx.add(2, mx, my, mz, w * 0.5, 0xffffff, o); const o2 = Object.assign({}, o, { stretch: L / (w * 1.5), a: 0.7 }); this.fx.add(2, mx, my, mz, w * 1.5, col, o2);
    for (let i = 0; i < 6; i++) { const k = Math.random(); this.fx.add(2, x0 + sx * k, y0 + sy * k, z0 + sz * k, 0.8, i & 1 ? col : 0xffffff, { vx: (Math.random() - 0.5) * 14, vy: (Math.random() - 0.5) * 14, vz: (Math.random() - 0.5) * 14, life: 0.22, stretch: 3 }); }
  }
  boomLite(e) { this.fx.add(0, e.x, e.y, e.z, 2, 0xffffff, { s1: 4.5, life: 0.3, a: 0.5 }); this.fx.add(1, e.x, e.y, e.z, 1.5, 0xffffff, { s1: 9, life: 0.4, a: 0.8 }); this.burst(e.x, e.y, e.z, 0xffffff, 22, 26, 1.1); }
  finish(w) {
    const d = this.actors[w].def, c = this.cfg, sim = this.sim, tw = c.mode === 'ladder' ? this.tw : null, win = w === 0, S = VsStats.d(), N = VS_TOWER.n;
    VsStats.fight(c.pick[0].id, win, win && sim.f[1].wins === 0, Math.round(sim.tick / 60), this.run, c.mode === 'local');
    let h2 = '¡GANA ' + d.name + '!', p = (win ? 'Jugador 1' : c.mode === 'local' ? 'Jugador 2' : 'CPU') + ' · ' + sim.f[0].wins + ' - ' + sim.f[1].wins, btn = [['rematch', 'Revancha'], ['reselect', 'Cambiar luchadores'], ['exit', 'Salir al menú']];
    if (tw) {                                                           // Torre: premio por victoria, siguiente rival o fin
      if (win) {
        const z = 100 * (tw.i + 1), cr = 15; tw.zeni += z; tw.cry += cr; Save.d.zeni += z; Save.d.crystals = (Save.d.crystals || 0) + cr; S.towerBest = Math.max(S.towerBest, tw.i + 1);
        if (tw.i >= N - 1) {
          const first = !S.tower[tw.level], bonus = VS_TOWER.levels[tw.level].cry * (first ? 2 : 1); S.tower[tw.level] = (S.tower[tw.level] || 0) + 1; Save.d.crystals += bonus; tw.cry += bonus;
          h2 = '¡TORRE SUPERADA!'; p = N + ' rivales derrotados · +' + tw.zeni + ' zeni · +' + tw.cry + ' cristales' + (first ? ' (primera vez: premio doble)' : ''); btn = [['reselect', 'Volver al Versus'], ['exit', 'Salir al menú']]; SFX.play('stinger');
        } else { h2 = '¡VICTORIA!'; p = 'Rival ' + (tw.i + 1) + ' de ' + N + ' superado · +' + z + ' zeni · +' + cr + ' cristales<br>Siguiente: <b>' + nice(charById(tw.foes[tw.i + 1].id).name) + '</b>' + (tw.i + 1 === N - 1 ? ' · jefe final' : ''); btn = [['next', 'Siguiente combate'], ['reselect', 'Abandonar la torre']]; }
      } else { h2 = 'DERROTA'; p = 'Has caído ante ' + d.name + ' en el combate ' + (tw.i + 1) + ' de ' + N + '.'; btn = tw.cont > 0 ? [['retry', 'Reintentar (queda 1 continuación)'], ['reselect', 'Abandonar la torre']] : [['reselect', 'Volver al Versus'], ['exit', 'Salir al menú']]; }
      Save.write();
    }
    this.ui.end.firstChild.innerHTML = '<h2>' + h2 + '</h2><p>' + p + '</p>' + btn.map((b, i) => '<button' + (i ? '' : ' class="go"') + ' data-v="' + b[0] + '">' + b[1] + '</button>').join(''); if (this.touch) this.touch.clear();
    setTimeout(() => { if (this.sim && this.sim.phase === 'end') this.ui.end.classList.add('on'); }, 900); SFX.music('menu');
  }

  /** Panel del entrenamiento: último combo, récord de la sesión y ajustes (también con las teclas 1-4 y R) */
  renderTrn(onlyNums) {
    const t = this.trn, c = this.cfg, el = this.ui.trn; if (!t) return;
    if (onlyNums && el.firstChild) { el.firstChild.innerHTML = this.trnNums(); return; }
    const b = (k, key, txt) => '<button data-v="trn" data-a="' + k + '"><kbd>' + key + '</kbd>' + txt + '</button>';
    el.innerHTML = '<div>' + this.trnNums() + '</div><div class="vseg">' + b('dummy', '1', 'Rival: ' + VS_DUMMY[c.dummy]) + b('ki', '2', 'Ki ' + (c.tki === '1' ? 'infinito' : 'normal')) + b('tm', '3', 'Barra ' + (c.ttm === '1' ? 'llena' : 'normal')) + b('pos', 'R', 'Recolocar') + b('base', '4', 'Volver a base') + '</div>';
  }
  trnNums() { const t = this.trn; return 'Último combo: <b>' + t.cmb + ' golpes</b> · <b>' + Math.round(t.dmg) + '</b> de daño · Récord: <b>' + Math.round(t.max) + '</b>'; }

  /** Efectos que dependen del estado de cada paso (estelas, carga, chispas del rayo) */
  simFx() {
    const sim = this.sim, fx = this.fx, T = sim.tick;
    for (const f of sim.f) {
      const col = this.actors[f.i].def.col;
      if (f.st === 'dash' && (T & 1) === 0) this.ghost(f.i, col, 0.22);
      if (f.st === 'launched' && (T & 3) === 0) this.ghost(f.i, 0xffffff, 0.16);
      if (f.st === 'flurry' && (T & 1) === 0) this.ghost(f.i, col, 0.13);
      if (f.st === 'charge' || (f.st === 'ult' && sim.ult && sim.ult.ph === 0)) {
        if ((T & 1) === 0) { const a = Math.random() * 6.283, r = 1 + Math.random() * 1.8; fx.add(2, f.x + Math.cos(a) * r, f.y + Math.random() * 1.5, f.z + Math.sin(a) * r, 0.9, T % 6 ? col : 0xffffff, { vy: 9 + Math.random() * 9, life: 0.4, stretch: 3 }); }
        if (T % 14 === 0 && f.y < 0.5) { fx.add(1, f.x, 0.09, f.z, 2, col, { s1: 10, life: 0.45, flat: true, a: 0.8 }); this.fxA.add(5, f.x + (Math.random() - 0.5) * 4, 0.2, f.z + (Math.random() - 0.5) * 4, 0.3, 0x3a3038, { vy: 5 + Math.random() * 4, life: 0.8, s1: 0.1 }); }
        if (f.st === 'charge' && (this.chargeSnd -= VS_DT) <= 0) { this.chargeSnd = 1.5; SFX.play('charge'); }
      }
      if (f.fi >= 2 && f.st !== 'ko' && (T + f.i * 7) % (f.fi >= 3 ? 9 : 16) === 0) {     // formas altas: chispas eléctricas alrededor del cuerpo
        const a = Math.random() * 6.283, r = 0.9 + Math.random() * 0.7, y0 = f.y + 0.4 + Math.random() * 2.6; this.bolt(f.x + Math.cos(a) * r, y0, f.z + Math.sin(a) * r, f.x + Math.cos(a + 1.3) * r, y0 + (Math.random() - 0.5) * 1.8, f.z + Math.sin(a + 1.3) * r, T % 2 ? col : 0xffffff, 0.28, 0.1);
      }
      if (f.st === 'stun' && T % 5 === 0) { const a = T * 0.2; fx.add(3, f.x + Math.cos(a) * 1.1, f.y + 3.5, f.z + Math.sin(a) * 1.1, 1.1, 0xffe27a, { life: 0.25 }); }
    }
    for (const s of sim.shots) if (!s.big && (T & 1) === 0) { if (s.disc) fx.add(1, s.x, s.y, s.z, s.r * 2.2, s.col, { s1: s.r * 0.6, life: 0.24, a: 0.6, flat: true }); else fx.add(0, s.x, s.y, s.z, 1.7, s.col, { s1: 0.3, life: 0.2, a: 0.7 }); }
    const am = this.arena.P.amb;                                        // ambiente de la arena: nieve, ascuas, polvo, motas...
    if (am && Math.random() < am.n / 60) {
      const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * 38, up = am.vy > 0;
      (am.add ? fx : this.fxA).add(am.kind, Math.cos(a) * r, up ? Math.random() * 3 : 16 + Math.random() * 10, Math.sin(a) * r, am.s * (0.6 + Math.random() * 0.8), am.col, { vx: (am.vx || 0) + (Math.random() - 0.5) * 2, vy: am.vy * (0.7 + Math.random() * 0.6), vz: (Math.random() - 0.5) * 2, life: am.life || 4, a: am.a || 0.7, s1: am.s * 0.5 });
    }
    const tr = sim.tr;
    if (tr) {                                                           // transformación en marcha
      const f = sim.f[tr.who], col = this.trCol, x = f.x, y = f.y, z = f.z, R = Math.random;
      if (!tr.sw) {
        const q = Math.min(1, tr.t / VS.TR_SWAP);
        for (let n = 0; n < 1 + ((q * 2) | 0); n++) {                     // la energía converge hacia el cuerpo
          const a = R() * 6.283, e = (R() - 0.3) * 1.6, r = 7 + R() * 5, ox = Math.cos(a) * Math.cos(e) * r, oy = Math.abs(Math.sin(e)) * r * 0.8, oz = Math.sin(a) * Math.cos(e) * r;
          fx.add(2, x + ox, y + 1.6 + oy, z + oz, 0.8, n & 1 ? 0xffffff : col, { vx: -ox / 0.3, vy: -oy / 0.3, vz: -oz / 0.3, life: 0.24, stretch: 4.5, a: 0.55 });
        }
        if (T % 3 === 0) this.fxA.add(5, x + (R() - 0.5) * 9, 0.15, z + (R() - 0.5) * 9, 0.22 + R() * 0.4, 0x3a3038, { vy: 3 + q * 11 + R() * 4, life: 0.9, s1: 0.12 });   // piedras que se elevan
        if (T % Math.max(4, 17 - ((q * 13) | 0)) === 0) { fx.add(1, x, 0.09, z, 1.5, col, { s1: 12 + q * 12, life: 0.4, flat: true, a: 0.85 }); this.dust(x, z, 6, 6 + q * 9); }
        if (T % Math.max(3, 13 - ((q * 10) | 0)) === 0) this.bolt(x + (R() - 0.5) * 11, y + 13 + R() * 6, z + (R() - 0.5) * 11, x + (R() - 0.5) * 1.6, y + R() * 3, z + (R() - 0.5) * 1.6, R() < 0.5 ? col : 0xffffff, 0.8 + q * 0.5, 0.13);
        if (T % 5 === 0) { const a = R() * 6.283; this.bolt(x, y + 1.6, z, x + Math.cos(a) * (3 + q * 5), Math.max(0.1, y + R() * 4), z + Math.sin(a) * (3 + q * 5), col, 0.4, 0.1); }
        this.cam.shake(0.22 + q * 0.6); this.chroma = Math.max(this.chroma, q * 0.008); if (q > 0.9) this.flash = Math.max(this.flash, (q - 0.9) / 0.1 * 0.8);
        if ((this.chargeSnd -= VS_DT) <= 0) { this.chargeSnd = 0.7; SFX.play('charge'); }
      } else {                                                          // recién transformado: columna de energía y rayos
        const c2 = this.actors[tr.who].def.col;
        for (let n = 0; n < 2; n++) { const a = R() * 6.283, r = 0.6 + R() * 1.8; fx.add(2, x + Math.cos(a) * r, y + R() * 2, z + Math.sin(a) * r, 1.0, n ? c2 : 0xffffff, { vy: 16 + R() * 16, life: 0.38, stretch: 4, a: 0.55 }); }
        if (T % 4 === 0) { const a = R() * 6.283, r = 2 + R() * 4; this.bolt(x, y + 1.5 + R() * 2, z, x + Math.cos(a) * r, Math.max(0.1, y + R() * 5), z + Math.sin(a) * r, T % 8 ? c2 : 0xffffff, 0.5, 0.1); }
        if (T % 10 === 0) fx.add(1, x, 0.09, z, 2, c2, { s1: 18, life: 0.5, flat: true, a: 0.7 });
        this.cam.shake(0.3);
      }
    }
    const u = sim.ult;
    if (u && u.ph === 1) {                                              // efectos propios de cada Ultimate mientras dura
      const uf = sim.f[u.who], uo = sim.f[1 - u.who], c = this.actors[u.who].def.col, R = Math.random;
      if (u.type === 'nova' && !u.r && u.t < 0.42) { for (let n = 0; n < 3; n++) { const a = R() * 6.283, e = (R() - 0.3) * 1.6, r = 9 + R() * 8, ox = Math.cos(a) * Math.cos(e) * r, oy = Math.abs(Math.sin(e)) * r, oz = Math.sin(a) * Math.cos(e) * r;   // aspira la energía
        fx.add(2, uf.x + ox, uf.y + 1.6 + oy, uf.z + oz, 0.9, n ? c : 0xffffff, { vx: -ox / 0.25, vy: -oy / 0.25, vz: -oz / 0.25, life: 0.2, stretch: 5, a: 0.7 }); } this.cam.shake(0.3); }
      if (u.type === 'nova' && u.r > 0) this.cam.shake(0.5);
      if (u.type === 'grab' && u.lock && u.v === 2 && T % 3 === 0) this.bolt(uf.x, uf.y + 2, uf.z, uo.x + (R() - 0.5) * 2, uo.y + 1 + R() * 2, uo.z + (R() - 0.5) * 2, T % 2 ? c : 0xffffff, 0.5, 0.1);
      if (u.type === 'grab' && u.lock && u.v === 0 && (T & 1) === 0) { this.ghost(u.who, c, 0.2); this.ghost(1 - u.who, 0xffffff, 0.2); }
      if (u.type === 'slash' && u.w2 && T % 4 === 0) { const a = R() * 6.283; this.bolt(uo.x, uo.y + 1.6, uo.z, uo.x + Math.cos(a) * 3, uo.y + 0.5 + R() * 2.5, uo.z + Math.sin(a) * 3, c, 0.35, 0.1); }
      if (u.type === 'rift' && u.heads) for (const h of u.heads) if (!h.done && (T & 1) === 0) fx.add(0, h.x, 0.5, h.z, 3.4, c, { s1: 1, life: 0.2, a: 0.8 });
    }
    if (u && u.type === 'beam' && u.ph === 1 && u.t < 1.35 && u.len) {
      for (let i = 0; i < 3; i++) { const k = Math.random() * u.len, a = Math.random() * 6.283, c = this.actors[u.who].def.col;
        fx.add(2, u.ox + u.dx * k, u.oy + u.dy * k + Math.sin(a) * 2, u.oz + u.dz * k + Math.cos(a) * 2, 1.2, i ? c : 0xffffff, { vx: u.dx * 30, vy: u.dy * 30 + Math.sin(a) * 6, vz: u.dz * 30 + Math.cos(a) * 6, life: 0.25, stretch: 4 }); }
      this.cam.shake(0.3);
    }
  }

  /** Coloca sprites, luces y efectos de este fotograma y actualiza el HUD */
  draw(dt, rawDt) {
    const sim = this.sim, cam = this.cam, fx = this.fx, k = this.acc / VS_DT, T = this.time;
    this.blur = Math.max(0, this.blur - rawDt * 2.6); this.chroma = Math.max(0, this.chroma - rawDt * 0.07); this.flash = Math.max(0, this.flash - rawDt * (this.flash > 0.45 ? 6 : 2.2));   // los fundidos a blanco se abren rápido
    this.arena.update(dt, T, this.dim, this.dimCol); cam.update(rawDt, sim, false);
    const m = cam.cam.matrixWorld.elements, rx = m[0], rz = m[2], rl = Math.hypot(rx, rz) || 1, RX = rx / rl, RZ = rz / rl;       // derecha de la cámara, en horizontal
    const P = this.arena.P, sd = this.arena.sun.position, sl = Math.hypot(sd.x, sd.z) || 1, dim = this.arena.dim;
    const kx = sd.x * m[0] + sd.y * m[1] + sd.z * m[2], ky = sd.x * m[4] + sd.y * m[5] + sd.z * m[6], kl = Math.hypot(kx, ky) || 1;  // sol visto en pantalla
    const lights = this.arena.glow; let li = 0; for (const l of lights) l.intensity = 0;
    const light = (x, y, z, col, I) => { if (li < lights.length) { const l = lights[li++]; l.position.set(x, y, z); l.color.setHex(col); l.intensity = I; } };
    const u = sim.ult;
    // --- Proyectiles ---
    for (const s of sim.shots) {
      const x = s.x + s.vx * VS_DT * k, y = s.y + s.vy * VS_DT * k, z = s.z + s.vz * VS_DT * k;
      if (s.big) { const r = s.r, p = 1 + Math.sin(T * 30) * 0.05; fx.now(0, x, y, z, r * 3.1 * p, s.col, 0.7); fx.now(0, x, y, z, r * 1.7, 0xffffff, 0.8); fx.now(3, x, y, z, r * 2.3, 0xffffff, 0.4, T * 2);
        for (let i = 0; i < 4; i++) { const a = T * 5 + i * 1.57; fx.now(0, x + Math.cos(a) * r * 1.3, y + Math.sin(a * 1.3) * r * 0.7, z + Math.sin(a) * r * 1.3, r * 0.5, 0xffffff, 0.7); } light(x, y, z, s.col, 1.3 + r * 0.25); }
      else if (s.disc) { const r = s.r; fx.now(1, x, y, z, r * 2.5, s.col, 1, 0, VS_FLAT); fx.now(1, x, y, z, r * 1.6, 0xffffff, 0.9, 0, VS_FLAT); fx.now(0, x, y, z, r * 1.7, s.col, 0.55); fx.now(3, x, y, z, r * 1.9, 0xffffff, 0.55, T * 22); light(x, y, z, s.col, 0.9); }   // disco cortante
      else { fx.now(0, x, y, z, 2.0, s.col, 0.75); fx.now(0, x, y, z, 0.85, 0xffffff, 1); light(x, y, z, s.col, 0.8); }
    }
    // --- Rayo ---
    const bm = this.beam;
    if (u && u.type === 'beam' && u.ph === 1 && u.len) {
      const c = this.actors[u.who].def.col, pw = u.t < 1.35 ? 1 : Math.max(0, 1 - (u.t - 1.35) / 0.3);
      bm.mesh.visible = pw > 0; bm.u.uA.value.set(u.ox, u.oy, u.oz); bm.u.uDir.value.set(u.dx, u.dy, u.dz); bm.u.uLen.value = u.len; bm.u.uW.value = [4.0, 6.4, 8.2][u.v]; bm.u.uCol.value.setHex(c); bm.u.uT.value = T; bm.u.uPow.value = pw;
      const hx = u.ox + u.dx * u.len, hy = u.oy + u.dy * u.len, hz = u.oz + u.dz * u.len;
      fx.now(0, u.ox, u.oy, u.oz, 4.6 * pw, c, 0.6); fx.now(0, u.ox, u.oy, u.oz, 2.3 * pw, 0xffffff, 0.9); fx.now(3, u.ox, u.oy, u.oz, 4.6 * pw, 0xffffff, 0.45, T * 3); fx.now(0, hx, hy, hz, 5 * pw, c, 0.55);
      light(u.ox + u.dx * 6, u.oy, u.oz + u.dz * 6, c, 1.5 * pw); light(u.ox + u.dx * Math.min(u.len, 24), u.oy, u.oz + u.dz * Math.min(u.len, 24), c, 1.2 * pw);
    } else bm.mesh.visible = false;
    if (u && u.type === 'nova' && u.ph === 1 && u.r > 0) {               // explosión corporal: cúpula de energía que crece
      const f = sim.f[u.who], c = this.actors[u.who].def.col, a = u.a === undefined ? 1 : u.a, y = f.y + 1.6, p = 1 + Math.sin(T * 40) * 0.03;
      fx.now(0, f.x, y, f.z, u.r * 2.9 * p, c, 0.6 * a); fx.now(0, f.x, y, f.z, u.r * 1.9, 0xffffff, 0.55 * a); fx.now(1, f.x, y, f.z, u.r * 2.15, 0xffffff, 0.9 * a); fx.now(1, f.x, 0.1, f.z, u.r * 2.3, c, 0.9 * a, 0, VS_FLAT);
      fx.now(3, f.x, y, f.z, u.r * 2.2, 0xffffff, 0.35 * a, T * 2); light(f.x, y, f.z, c, 2.2 * a);
    }
    // --- Luchadores ---
    for (let i = 0; i < 2; i++) {
      const f = sim.f[i], foe = sim.f[1 - i], a = this.actors[i], p = this.prev[i], S = a.spr, U = S.u;
      const x = p.x + (f.x - p.x) * k, y = p.y + (f.y - p.y) * k, z = p.z + (f.z - p.z) * k; a.t += dt; a.px = x; a.py = y; a.pz = z;
      // Mira al rival (en pantalla); en el dash mira hacia donde va
      let sxd = (foe.x - f.x) * RX + (foe.z - f.z) * RZ; if (f.st === 'dash') { const d = f.dx * RX + f.dz * RZ; if (Math.abs(d) > 0.35) sxd = d; }
      if (Math.abs(sxd) > 0.05) a.flip = sxd < 0;
      const dir = a.flip ? -1 : 1;
      let roll = 0, sx = 1, sy = 1;
      if (f.st === 'launched') roll = -dir * f.t * 11; else if (f.st === 'dash') { roll = -dir * 0.3; sx = 1.14; sy = 0.9; } else if (f.st === 'ko' && (f.y > 0.05 || f.vy > 0)) roll = -dir * f.t * 7;
      else if (f.st === 'move' && f.y > 0.2) roll = -dir * Math.min(0.26, Math.hypot(f.vx, f.vz) * 0.026) * Math.sign((f.vx * RX + f.vz * RZ) * dir || 1);
      else if (f.st === 'held' && u && u.type === 'grab') roll = u.v === 1 ? T * 22 : u.v === 0 && u.t > 0.55 ? Math.PI : dir * 0.3;     // agarrado: gira o cae de cabeza
      else if (f.st === 'hurt') roll = dir * 0.12; else if (f.st === 'charge') { sx = 1 + Math.sin(T * 40) * 0.015; }
      if (f.st === 'down' && f.t < 0.12) { sy = 0.8; sx = 1.15; }
      const tq = f.st === 'trans' && sim.tr && !sim.tr.sw ? Math.min(1, sim.tr.t / VS.TR_SWAP) : 0;       // 0-1: cuánto lleva concentrando la transformación
      if (tq > 0) sx = sy = 1 + tq * 0.035 * Math.sin(T * 70);
      if (a.pop > 0) { a.pop = Math.max(0, a.pop - rawDt * 2.6); sx *= 1 + a.pop * 0.22; sy *= 1 + a.pop * 0.22; }   // al cambiar de forma «revienta» un instante
      a.roll = roll; a.fr = a.frame(f, sim); S.pose(a.fr, a.flip, roll, sx, sy);
      const jit = f.st === 'held' || (f.st === 'hurt' && f.t < 0.1) ? (Math.random() - 0.5) * 0.22 : tq > 0 ? (Math.random() - 0.5) * 0.3 * tq : 0;
      S.mesh.position.set(x + RX * jit, y, z + RZ * jit); U.uRight.value.set(RX, 0, RZ); S.du.uRight.value.set(-sd.z / sl, 0, sd.x / sl);
      // Luz: ambiente y sol de la arena + la energía más cercana como luz de borde
      const amb = 0.78 * (1 - 0.5 * dim); U.uAmb.value.setRGB(amb, amb, amb * (1 + 0.06 * P.stars)); U.uKey.value.setHex(P.sun).multiplyScalar(0.5 * (1 - 0.7 * dim)); U.uKeyDir.value.set(kx / kl, ky / kl);
      let rI = 0, rc = a.def.col, rdx = 0, rdy = 1;
      const src = (lx, ly, lz, col, I) => { const d = Math.hypot(lx - x, ly - y - 1.6, lz - z), w = I / (1 + d * d * 0.03); if (w > rI) { rI = w; rc = col; rdx = (lx - x) * m[0] + (ly - y - 1.6) * m[1] + (lz - z) * m[2]; rdy = (lx - x) * m[4] + (ly - y - 1.6) * m[5] + (lz - z) * m[6]; } };
      for (const s of sim.shots) src(s.x, s.y, s.z, s.col, s.big ? 2.2 : 0.9);
      if (bm.mesh.visible) { const al = Math.max(0, Math.min(u.len, (x - u.ox) * u.dx + (y + 1.6 - u.oy) * u.dy + (z - u.oz) * u.dz)); src(u.ox + u.dx * al, u.oy + u.dy * al, u.oz + u.dz * al, bm.u.uCol.value.getHex(), 1.8); }
      // Aura: al cargar, con el ki lleno y en la Ultimate
      const want = f.st === 'trans' ? 0.7 : f.st === 'charge' ? 1 : f.fi > 0 && f.st !== 'ko' && f.st !== 'ult' && f.ki < 100 && f.st !== 'dash' ? 0.3 : f.st === 'ult' ? (u && u.lock ? 0.3 : 0.95) : f.st === 'ko' ? 0 : f.ki >= 100 ? 0.5 : f.st === 'dash' ? 0.35 : 0;
      a.pow += (want - a.pow) * Math.min(1, dt * 9);
      if (a.pow > 0.02 && a.pow * 0.9 > rI) { rI = a.pow * 0.9; rc = a.def.col; rdx = 0; rdy = -1; }
      if (dim > 0.1 && rI < 0.35) { rI = 0.35 * dim; rc = this.dimCol; }
      const rl2 = Math.hypot(rdx, rdy) || 1; U.uRim.value.setHex(rc).multiplyScalar(Math.min(1.5, rI)); U.uRimDir.value.set(rdx / rl2, rdy / rl2);
      U.uFlash.value = f.flash > 0 ? Math.min(0.8, f.flash * 8) * (f.st === 'held' ? 0.45 : 1) : f.st === 'guard' ? 0.18 : 0; U.uFlashCol.value.setHex(f.st === 'guard' && f.flash <= 0 ? 0x9adcff : 0xffffff);
      if (tq > 0) { U.uFlash.value = tq > 0.72 ? (tq - 0.72) / 0.28 : Math.sin(T * 46) > 0.55 ? 0.3 * tq + 0.1 : 0; U.uFlashCol.value.setHex(tq > 0.72 ? 0xffffff : this.trCol); }
      else if (a.pop > 0) { U.uFlash.value = Math.max(U.uFlash.value, a.pop * a.pop); U.uFlashCol.value.setHex(0xffffff); }
      { const as = f.st === 'trans' ? 1 + 0.25 * (tq || 1) : f.fi > 0 ? 1.1 : 1; a.au.uSize.value.set(7.4 * as, 9.8 * as); }
      if (f.st === 'trans') light(x, y + 2, z, tq > 0 ? this.trCol : a.def.col, 0.7 + 0.9 * (tq || 1));
      U.uAlpha.value = f.inv > 0 && f.st !== 'ult' && f.st !== 'trans' && sim.phase === 'fight' && (sim.tick & 2) ? 0.55 : 1;
      a.aura.visible = a.pow > 0.02; a.au.uPow.value = a.pow; a.au.uT.value = T + i * 3.7; a.aura.position.set(x - m[8] * -0.25, y, z - m[10] * -0.25);
      if (a.pow > 0.3) light(x, y + 1.6, z, a.def.col, 0.7 * a.pow);
      if (f.st === 'guard') fx.now(1, x + RX * dir * 1.0, y + 1.7, z + RZ * dir * 1.0, 4.2, 0x9adcff, 0.5 * (f.gm / 100) + 0.2);
      this.fxA.now(5, x, 0.05, z, Math.max(1.4, 3.6 - y * 0.1), 0x000000, 0.42 * Math.max(0.15, 1 - y / 16), 0, VS_FLAT);   // sombra de contacto: «pega» el sprite al suelo
      // HUD de este lado
      const h = this.ui.sides[i], hp = f.hp / f.hpMax; h.ghost += (hp - h.ghost) * Math.min(1, rawDt * (hp < h.ghost ? 2.2 : 12));
      h.v.style.transform = 'scaleX(' + hp.toFixed(4) + ')'; h.g.style.transform = 'scaleX(' + Math.max(hp, h.ghost).toFixed(4) + ')'; h.hp.classList.toggle('low', hp < 0.3);
      h.kiI.style.transform = 'scaleX(' + (f.ki / 100).toFixed(3) + ')'; h.ki.classList.toggle('full', f.ki >= 100); h.gd.style.transform = 'scaleX(' + (f.gm / 100).toFixed(3) + ')';
      h.trI.style.transform = 'scaleX(' + (f.fi >= f.chain.length - 1 ? 1 : f.tm / 100).toFixed(3) + ')';
      { const can = f.fi >= f.chain.length - 1 ? 2 : f.canTrans ? 1 : 0;
        if (can !== h.can) { h.can = can; h.tr.classList.toggle('full', can === 1); h.tr.classList.toggle('max', can === 2);
          h.trl.innerHTML = can === 2 ? (f.chain.length > 1 ? 'FORMA MÁXIMA' : '') : can === 1 ? (i && this.p2cpu ? '¡LISTA!' : '¡TRANSFÓRMATE!<kbd>' + (i ? '+' : 'T') + '</kbd>') : '';
          if (can === 1) { SFX.play('ki'); fx.add(1, x, y + 1.6, z, 1, 0xffd75a, { s1: 9, life: 0.4, a: 0.9 }); } } }
      if (h.wins !== f.wins) { h.wins = f.wins; [...h.pips.children].forEach((b, n) => b.classList.toggle('w', n < f.wins)); }
      const c = this.ui.cmb[i]; if (c.t > 0 && (c.t -= rawDt) <= 0) c.classList.remove('on');
    }
    const tt = Math.ceil(sim.time); if (tt !== this.shownT) { this.shownT = tt; this.ui.clock.textContent = this.trn ? '∞' : tt; }
    if (this.touch) this.touch.ready(sim.f[0].ki >= 100 && sim.phase === 'fight', sim.f[0].canTrans && sim.phase === 'fight');
    for (const g of this.ghosts) if (g.life > 0) { g.life -= dt; g.u.uAlpha.value = Math.max(0, g.life / g.max) * 0.42; if (g.life <= 0) g.mesh.visible = false; }
    this.fx.update(dt); this.fxA.update(dt); this.fx.flush(); this.fxA.flush();
  }
}
const VS_FLAT = [0, 0, 0, -1];
/** Vibración del mando (si el juego la tiene) */
function g_rumble(ms, s) { try { if (window.game && game.pad && game.pad.rumble) game.pad.rumble(ms, s, s * 0.5); } catch (e) { /* sin mando */ } }
