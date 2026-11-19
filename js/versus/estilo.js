'use strict';
/* =====================================================================
   versus/estilo.js · Hoja de estilos del MODO VERSUS.
   Idea: una página de manga en mitad de un torneo de artes marciales.
     - Tinta y papel: contornos negros gruesos, paneles inclinados, bocadillos.
     - Bangers (rotulación de cómic) para nombres, rótulos y contadores;
       Baloo 2 para el texto que hay que leer.
     - Azul = jugador 1 · rojo = jugador 2 · oro = ki y premios · verde = datos.
     - Las rondas ganadas son bolas de dragón; el ki lleva su kanji (気).
   ===================================================================== */
const VS_CSS = `
#vs{position:fixed;inset:0;z-index:60;display:none;font-family:var(--body);color:#fff;pointer-events:none;user-select:none;
  --ink:#11121c;--paper:#fff8ea;--p1:#2aa8ff;--p2:#ff3b4e;--gold:#ffc531;--gi:#ff7a1a;--scan:#6dff9c;--mg:'Bangers','Baloo 2','Arial Rounded MT Bold',sans-serif;--kj:var(--kanji,'Noto Sans JP',sans-serif)}
#vs.on{display:block}
#vs .bars i{position:absolute;left:0;right:0;height:0;background:#000;transition:height .35s cubic-bezier(.2,.8,.2,1)}#vs .bars i:first-child{top:0}#vs .bars i:last-child{bottom:0}#vs.cine .bars i{height:11%}

/* ---------- HUD de combate ---------- */
#vs .top{position:absolute;top:12px;left:16px;right:16px;display:flex;align-items:flex-start;gap:6px;transition:opacity .25s}#vs.cine .top,#vs.cine .hint,#vs.cine .cmb{opacity:0!important}
#vs .side{flex:1;display:flex;align-items:flex-start;min-width:0;--pc:var(--p1)}#vs .side.r{flex-direction:row-reverse;--pc:var(--p2)}
#vs .pt{width:86px;height:86px;flex:none;background:linear-gradient(165deg,var(--pc) 0,var(--ink) 88%);clip-path:polygon(16% 0,100% 0,84% 100%,0 100%);image-rendering:pixelated;
  filter:drop-shadow(2px 0 0 #fff) drop-shadow(-2px 0 0 #fff) drop-shadow(0 2px 0 #fff) drop-shadow(0 -2px 0 #fff) drop-shadow(0 5px 0 rgba(0,0,0,.4))}
#vs .side.r .pt{clip-path:polygon(0 0,84% 0,100% 100%,16% 100%)}
#vs .inf{flex:1;min-width:0;margin:2px 0 0 -8px}#vs .side.r .inf{margin:2px -8px 0 0}
#vs .nm{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:0 14px 0 12px;margin-bottom:2px;font:400 28px/1.05 var(--mg);letter-spacing:.045em;-webkit-text-stroke:5px var(--ink);paint-order:stroke fill;white-space:nowrap}
#vs .side.r .nm{flex-direction:row-reverse;padding:0 12px 0 14px}#vs .nm span{color:#fff}
#vs .nm small{font:800 13px/1 var(--body);letter-spacing:.02em;color:var(--gold);-webkit-text-stroke:3px var(--ink);overflow:hidden;text-overflow:ellipsis}
#vs .hp{position:relative;height:26px;background:#2b1217;border:3px solid var(--ink);box-shadow:0 0 0 2px #fff,0 7px 0 rgba(0,0,0,.35);transform:skewX(-18deg);overflow:hidden}#vs .side.r .hp{transform:skewX(18deg)}
#vs .hp i{position:absolute;inset:0;transform-origin:left;will-change:transform}#vs .side.r .hp i{transform-origin:right}
#vs .hp .g{background:var(--p2)}#vs .hp .v{background:linear-gradient(180deg,#f0ff9a 0,#86e24c 34%,#1f9d4a 100%)}
#vs .hp.low .v{background:linear-gradient(180deg,#ffe9a0 0,#ff9a2a 40%,#d8341c 100%);animation:vsp .45s steps(2) infinite}
#vs .hp::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.38) 0,rgba(255,255,255,0) 42%),repeating-linear-gradient(90deg,transparent 0 calc(25% - 2px),rgba(17,18,28,.5) calc(25% - 2px) 25%)}
#vs .row{display:flex;gap:8px;align-items:center;margin-top:7px;padding:0 8px}#vs .side.r .row{flex-direction:row-reverse}
#vs .kj{flex:none;width:24px;height:24px;border-radius:50%;background:var(--ink);border:2px solid #7fd6ff;color:#7fd6ff;font:900 13px/20px var(--kj);text-align:center;margin:-4px 0}
#vs .row:has(.ki.full) .kj{border-color:var(--gold);color:var(--gold);box-shadow:0 0 12px var(--gold)}
#vs .ki{position:relative;flex:1;max-width:58%;height:13px;background:#0d1830;border:2px solid var(--ink);box-shadow:0 0 0 2px #fff;overflow:hidden;transform:skewX(-18deg)}#vs .side.r .ki{transform:skewX(18deg)}
#vs .ki i{position:absolute;inset:0;transform-origin:left;background:linear-gradient(180deg,#e2f7ff,#35c8ff 55%,#1668d8)}#vs .side.r .ki i{transform-origin:right}
#vs .ki::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 calc(20% - 2px),var(--ink) calc(20% - 2px) 20%)}
#vs .ki.full i{background:linear-gradient(180deg,#fff6c0,#ffc531 55%,#ff8a1a);animation:vsp .5s steps(2) infinite}@keyframes vsp{50%{filter:brightness(1.5)}}
#vs .gd{width:16%;height:7px;background:var(--ink);box-shadow:0 0 0 1.5px rgba(255,255,255,.75);overflow:hidden;transform:skewX(-18deg)}#vs .side.r .gd{transform:skewX(18deg)}
#vs .gd i{display:block;height:100%;background:#bfe8ff;transform-origin:left}#vs .side.r .gd i{transform-origin:right}
#vs .pips{display:flex;gap:6px;margin-left:auto}#vs .side.r .pips{margin:0 auto 0 0}
#vs .pips b{position:relative;width:19px;height:19px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#444a6a,#171a2b 70%);border:2px solid var(--ink);box-shadow:0 0 0 1.5px rgba(255,255,255,.7)}
#vs .pips b.w{background:radial-gradient(circle at 35% 28%,#fff6c0 0,#ffb21a 40%,#e8740a 100%);box-shadow:0 0 0 1.5px #fff,0 0 12px #ffb21a;animation:vsball .5s cubic-bezier(.2,1.6,.4,1)}
#vs .pips b.w::after{content:"★";position:absolute;inset:0;font:10px/15px sans-serif;color:#d81e2c;text-align:center}@keyframes vsball{0%{transform:scale(2.4)}}
#vs .tr{position:relative;width:44%;height:10px;background:#2a1508;border:2px solid var(--ink);box-shadow:0 0 0 1.5px rgba(255,255,255,.8);overflow:hidden;transform:skewX(-18deg)}#vs .side.r .tr{transform:skewX(18deg)}
#vs .tr i{position:absolute;inset:0;transform-origin:left;background:linear-gradient(90deg,#ff3b1a,#ff9a1a 55%,#fff2a0)}#vs .side.r .tr i{transform-origin:right}
#vs .tr.full{box-shadow:0 0 0 1.5px #fff,0 0 16px 3px var(--gi);animation:vsp .35s steps(2) infinite}#vs .tr.max{opacity:.3}
#vs .trl{font:400 19px/1 var(--mg);letter-spacing:.05em;color:var(--gold);-webkit-text-stroke:4px var(--ink);paint-order:stroke fill;white-space:nowrap}
#vs .trl kbd{font:800 12px var(--body);-webkit-text-stroke:0;color:var(--ink);background:#fff;border-radius:4px;padding:1px 6px;margin:0 4px;box-shadow:0 2px 0 rgba(0,0,0,.5);vertical-align:2px}
#vs .clock{flex:none;width:98px;display:flex;flex-direction:column-reverse;align-items:center;filter:drop-shadow(0 0 0 var(--gold)) drop-shadow(2px 0 0 var(--gold)) drop-shadow(-2px 0 0 var(--gold)) drop-shadow(0 2px 0 var(--gold)) drop-shadow(0 -2px 0 var(--gold)) drop-shadow(0 6px 0 rgba(0,0,0,.4))}
#vs .clock span{display:block;width:82px;height:72px;font:400 46px/74px var(--mg);letter-spacing:.03em;text-align:center;color:#fff;background:var(--ink);clip-path:polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)}
#vs .clock small{display:block;margin-top:-9px;padding:1px 9px 0;font:800 11px/15px var(--body);letter-spacing:.06em;color:var(--ink);background:var(--gold);white-space:nowrap;position:relative;z-index:1;transform:skewX(-12deg)}

/* ---------- Combo, rótulos y avisos ---------- */
#vs .cmb{position:absolute;top:30%;opacity:0;transition:opacity .2s;transform:rotate(-7deg);--pc:var(--p1)}#vs .cmb.on{opacity:1}#vs .cmb.l{left:30px}#vs .cmb.r{right:30px;text-align:right;transform:rotate(7deg);--pc:var(--p2)}
#vs .cmb b{display:block;font:400 clamp(44px,7vw,84px)/.9 var(--mg);letter-spacing:.03em;color:#fff;-webkit-text-stroke:.14em var(--ink);paint-order:stroke fill;text-shadow:.05em .07em 0 var(--pc)}
#vs .cmb small{display:inline-block;margin-top:8px;padding:1px 12px;font:800 14px/1.4 var(--body);color:var(--ink);background:var(--gold);transform:skewX(-12deg);box-shadow:3px 3px 0 var(--ink)}
#vs .cmb.pop b{animation:vsc .16s}@keyframes vsc{0%{transform:scale(1.45)}}
#vs .big{position:absolute;left:0;right:0;top:32%;text-align:center;font:400 clamp(58px,12.5vw,160px)/.92 var(--mg);letter-spacing:.03em;color:#fff6c8;-webkit-text-stroke:.085em var(--ink);paint-order:stroke fill;text-shadow:.045em .06em 0 var(--gi),0 0 .5em rgba(255,150,30,.55);opacity:0;pointer-events:none}
#vs .big.go{animation:vsb var(--d,1.2s) cubic-bezier(.2,.9,.2,1) both}
@keyframes vsb{0%{opacity:0;transform:scale(2.6) rotate(-9deg)}14%{opacity:1;transform:scale(.96) rotate(-4deg)}22%{transform:scale(1.03) rotate(-4deg)}80%{opacity:1;transform:scale(1.06) rotate(-4deg)}100%{opacity:0;transform:scale(1.25) rotate(-4deg)}}
#vs .tag{position:absolute;left:50%;top:61%;padding:1px 30px 0;font:400 clamp(20px,3.2vw,32px)/1.3 var(--mg);letter-spacing:.06em;color:var(--gold);background:var(--ink);border:3px solid var(--gold);box-shadow:5px 5px 0 rgba(0,0,0,.45);white-space:nowrap;opacity:0;transform:translateX(-50%) skewX(-14deg)}
#vs .tag.go{animation:vst .85s cubic-bezier(.2,.9,.2,1) both}@keyframes vst{0%{opacity:0;transform:translateX(-90%) skewX(-14deg)}14%{opacity:1;transform:translateX(-50%) skewX(-14deg)}78%{opacity:1;transform:translateX(-50%) skewX(-14deg)}100%{opacity:0;transform:translateX(-30%) skewX(-14deg)}}
#vs .ult{position:absolute;left:0;right:0;bottom:14%;text-align:center;opacity:0;transform:translateX(-30px);transition:opacity .2s,transform .3s}#vs.cine .ult{opacity:1;transform:none}#vs .ult.off{opacity:0!important}
#vs .ult b{display:inline-block;padding:4px 60px 0;font:400 clamp(26px,5vw,58px)/1.15 var(--mg);letter-spacing:.05em;transform:skewX(-14deg);background:linear-gradient(90deg,transparent,var(--c,#fff) 16%,var(--c,#fff) 84%,transparent);color:var(--ink);border-top:4px solid var(--ink);border-bottom:4px solid var(--ink)}
#vs .hint{position:absolute;left:0;right:0;bottom:10px;margin:0 auto;width:fit-content;max-width:96%;padding:5px 16px;border-radius:999px;background:rgba(17,18,28,.66);font:600 12px/1.9 var(--body);color:#e8ecf8;text-align:center;transition:opacity .25s;animation:vshint 1.2s 18s forwards}
#vs .hint b{color:var(--ink);background:#fff;border-radius:4px;padding:1px 5px;font-weight:800;box-shadow:0 2px 0 rgba(0,0,0,.5)}@keyframes vshint{to{opacity:0;visibility:hidden}}

/* ---------- Bocadillos (frases de entrada y de victoria) ---------- */
#vs .vq{position:absolute;bottom:3.5%;max-width:min(600px,78%);padding:16px 24px 12px;background:var(--paper);color:var(--ink);border:4px solid var(--ink);border-radius:26px;box-shadow:6px 7px 0 rgba(0,0,0,.5);opacity:0;transform:scale(.6);transition:opacity .15s,transform .22s cubic-bezier(.2,1.5,.4,1);font:700 clamp(15px,2.2vw,21px)/1.3 var(--body)}
#vs .vq.on{opacity:1;transform:none}#vs .vq.l{left:6%;transform-origin:70% 0}#vs .vq.r{right:6%;transform-origin:30% 0}
#vs .vq::before,#vs .vq::after{content:"";position:absolute;bottom:100%;border:solid transparent}
#vs .vq::before{border-width:0 15px 30px 15px;border-bottom-color:var(--ink);margin-bottom:0}#vs .vq::after{border-width:0 10px 21px 10px;border-bottom-color:var(--paper);margin-bottom:-2px}
#vs .vq.l::before{right:15%}#vs .vq.l::after{right:calc(15% + 5px)}#vs .vq.r::before{left:15%}#vs .vq.r::after{left:calc(15% + 5px)}
#vs .vq b{position:absolute;top:-17px;padding:1px 16px 0;font:400 19px/1.35 var(--mg);letter-spacing:.06em;color:var(--ink);background:var(--c,var(--gold));border:3px solid var(--ink);transform:skewX(-12deg);white-space:nowrap}
#vs .vq.l b{left:18px}#vs .vq.r b{right:18px}

/* ---------- Paneles (pausa, fin de combate) ---------- */
#vs .pnl{position:absolute;inset:0;display:none;align-items:center;justify-content:center;pointer-events:auto;background:radial-gradient(rgba(17,18,28,.55) 1.4px,transparent 1.6px) 0 0/9px 9px,rgba(12,13,24,.78)}#vs .pnl.on{display:flex}
#vs .box{position:relative;overflow:visible;border-radius:0;min-width:320px;padding:30px 28px 24px;text-align:center;background:var(--ink);border:4px solid #fff;box-shadow:9px 9px 0 var(--gi)}
#vs .box h2{margin:-52px auto 12px;width:fit-content;padding:2px 30px 0;font:400 44px/1.2 var(--mg);letter-spacing:.05em;color:var(--ink);background:var(--gold);border:4px solid var(--ink);box-shadow:0 0 0 3px #fff;transform:skewX(-10deg) rotate(-2deg)}
#vs .box p{font:600 14px/1.45 var(--body);color:var(--t2);margin:0 0 14px}#vs .box p b{color:var(--gold)}
#vs .box button,#vs .fight{display:block;width:100%;margin-top:10px;padding:9px 18px 7px;font:400 22px/1.2 var(--mg);letter-spacing:.06em;color:#fff;background:#262a44;border:3px solid #fff;border-radius:0;box-shadow:4px 4px 0 rgba(0,0,0,.55);text-shadow:none;transform:skewX(-10deg);transition:transform .08s,box-shadow .08s}
#vs .box button:hover,#vs .fight:hover{transform:skewX(-10deg) translate(-2px,-2px);box-shadow:6px 6px 0 rgba(0,0,0,.55)}#vs .box button:active,#vs .fight:active{transform:skewX(-10deg) translate(3px,3px);box-shadow:1px 1px 0 rgba(0,0,0,.55)}
#vs .box button.go,#vs .fight{background:linear-gradient(180deg,#ffe27a,#ffc531 50%,#ff9a1a);color:var(--ink);border-color:var(--ink);box-shadow:0 0 0 3px #fff,6px 7px 0 rgba(0,0,0,.55)}
#vs .box button:focus-visible,#vs .sel button:focus-visible,#vs .fp:focus-visible{outline:3px solid var(--scan);outline-offset:3px}
#vs .pnl.win{align-items:flex-end;background:linear-gradient(180deg,transparent 42%,rgba(12,13,24,.92))}
#vs .pnl.win .box{margin-bottom:3vh;max-width:min(720px,92%);padding:26px 24px 18px}#vs .pnl.win .box h2{font-size:38px;margin-top:-50px}#vs .pnl.win .box p{margin-bottom:10px}
#vs .pnl.win .box q{display:block;margin:0 auto 14px;width:fit-content;max-width:100%;padding:8px 20px;background:var(--paper);color:var(--ink);border-radius:20px;font:700 clamp(15px,2.1vw,19px)/1.3 var(--body);quotes:"«" "»"}
#vs .pnl.win .box .bt{display:flex;gap:14px;flex-wrap:wrap;padding:0 6px}#vs .pnl.win .box .bt button{flex:1;min-width:150px;margin-top:0;font-size:19px}

/* ---------- Selección de luchadores ---------- */
#vs .sel{position:absolute;inset:0;display:none;pointer-events:auto;padding:14px 18px 16px;grid-template-columns:minmax(230px,300px) minmax(0,1fr) minmax(230px,300px);grid-template-rows:auto minmax(0,1fr);gap:14px 16px;overflow:hidden;
  background:radial-gradient(rgba(255,255,255,.06) 1.5px,transparent 1.7px) 0 0/11px 11px,linear-gradient(105deg,rgba(42,168,255,.2) 0,transparent 34%,transparent 66%,rgba(255,59,78,.2) 100%),radial-gradient(120% 80% at 50% 110%,#ff7a1a 0,#7a2a1c 22%,#1a1630 55%,#0c0d1a 100%)}
#vs .sel.on{display:grid}
#vs .sel::before{content:"戦";position:absolute;left:50%;top:50%;transform:translate(-50%,-48%);font:900 min(78vh,56vw)/1 var(--kj);color:rgba(255,255,255,.045);pointer-events:none}
#vs .sel>*{position:relative}
#vs .sel header{grid-column:1/-1;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
#vs .sel h1{margin:0;font:400 clamp(30px,4.6vw,50px)/1 var(--mg);letter-spacing:.05em;color:#fff6c8;-webkit-text-stroke:.14em var(--ink);paint-order:stroke fill;text-shadow:.05em .07em 0 var(--gi);transform:rotate(-3deg)}
#vs .sel .back{padding:6px 14px 4px;font:400 18px var(--mg);letter-spacing:.05em;color:#fff;background:var(--ink);border:3px solid #fff;border-radius:0;box-shadow:3px 3px 0 rgba(0,0,0,.5);transform:skewX(-10deg);text-shadow:none}
#vs .vseg{display:flex;gap:7px;flex-wrap:wrap}
#vs .vseg button,#vs .forms button{padding:5px 13px 4px;font:800 14px/1.25 var(--body);letter-spacing:0;color:#dfe4f6;background:rgba(17,18,28,.82);border:2px solid rgba(255,255,255,.3);border-radius:0;box-shadow:none;text-shadow:none;transform:skewX(-10deg)}
#vs .vseg button:hover,#vs .forms button:hover{border-color:#fff;color:#fff}
#vs .vseg button.on,#vs .forms button.on{color:var(--ink);background:var(--gold);border-color:var(--ink);box-shadow:0 0 0 2px #fff}
#vs .sel .modes{margin-left:auto}#vs .sel .modes button{padding:6px 18px 3px;font:400 20px/1.2 var(--mg);letter-spacing:.05em}
/* Ficha de cada luchador: panel inclinado de su color */
#vs .fp{--pc:var(--p1);display:flex;flex-direction:column;min-height:0;padding:0 14px 12px;background:linear-gradient(180deg,color-mix(in srgb,var(--pc) 34%,var(--ink)) 0,var(--ink) 46%);border:4px solid var(--ink);box-shadow:0 0 0 2px rgba(255,255,255,.35);overflow:auto;cursor:pointer;scrollbar-width:thin;opacity:.82;transition:opacity .15s}
#vs .fp.p1{--pc:var(--p2)}#vs .fp.on{opacity:1;box-shadow:0 0 0 3px var(--pc),0 0 26px color-mix(in srgb,var(--pc) 60%,transparent)}#vs .fp.tw{cursor:default;opacity:1;--pc:var(--gold)}
#vs .fp .who{align-self:flex-start;margin:10px 0 0 -18px;padding:1px 16px 0 22px;font:400 17px/1.4 var(--mg);letter-spacing:.07em;color:var(--ink);background:var(--pc);transform:skewX(-12deg);box-shadow:3px 3px 0 rgba(0,0,0,.45)}
#vs .fp.p1 .who{align-self:flex-end;margin:10px -18px 0 0;padding:1px 22px 0 16px}
#vs .fp .art{align-self:center;flex:none;width:min(100%,168px);aspect-ratio:1;margin:-4px 0 -10px;image-rendering:pixelated;filter:drop-shadow(0 8px 0 rgba(0,0,0,.35))}#vs .fp.p1 .art{transform:scaleX(-1)}
#vs .fp .art.ent{width:100%;aspect-ratio:16/9;margin:8px 0 6px;image-rendering:auto;filter:none;border:3px solid var(--ink);box-shadow:0 0 0 2px rgba(255,255,255,.35)}
#vs .fp h3{margin:0;font:400 clamp(26px,3vw,36px)/1 var(--mg);letter-spacing:.045em;color:#fff;-webkit-text-stroke:5px var(--ink);paint-order:stroke fill;text-shadow:3px 4px 0 var(--pc)}#vs .fp.p1 h3{text-align:right}
#vs .fp h4,#vs .mid h4{margin:12px 0 6px;font:700 13px/1.2 var(--body);color:var(--t3)}
#vs .forms{display:flex;gap:6px;flex-wrap:wrap}#vs .forms button{padding:3px 10px 2px;font-size:12.5px}
#vs .psv{padding:7px 10px 8px;font:600 12.5px/1.4 var(--body);color:#d6f7e2;background:rgba(109,255,156,.09);border-left:4px solid var(--scan)}
#vs .psv b{display:block;font:400 17px/1.2 var(--mg);letter-spacing:.05em;color:var(--scan)}
#vs .ults{margin:0;padding:0;list-style:none;counter-reset:u}
#vs .ults li{counter-increment:u;position:relative;padding:4px 0 5px 28px;border-bottom:1px dashed rgba(255,255,255,.14);font:600 12px/1.3 var(--body);color:var(--t2)}
#vs .ults li::before{content:counter(u);position:absolute;left:0;top:6px;width:19px;height:19px;border-radius:50%;background:radial-gradient(circle at 35% 28%,#fff6c0 0,#ffb21a 40%,#e8740a 100%);color:#b01420;font:800 11px/19px var(--body);text-align:center}
#vs .ults b{display:block;font:400 16px/1.15 var(--mg);letter-spacing:.04em;color:var(--gold)}#vs .ults small{color:var(--t3);font-size:11.5px}
#vs .twi{font:600 13.5px/1.55 var(--body);color:var(--t2);margin-top:10px}#vs .twi b{color:var(--gold)}
/* Centro: plantel, ajustes y botón de combate */
#vs .mid{display:flex;flex-direction:column;min-height:0;min-width:0;gap:10px}
#vs .tabs{display:flex;gap:4px;align-items:flex-end}#vs .tabs button{padding:5px 16px 3px;font:400 18px/1.2 var(--mg);letter-spacing:.05em;color:var(--t2);background:rgba(17,18,28,.7);border:3px solid transparent;border-bottom:0;border-radius:0;box-shadow:none;text-shadow:none}
#vs .tabs button.on{color:var(--ink);background:var(--paper)}#vs .tabs span{margin-left:auto;font:600 13px var(--body);color:var(--t2);padding-bottom:4px}
#vs .pane{flex:1;min-height:0;overflow:auto;padding:12px;background:rgba(17,18,28,.78);border:4px solid var(--ink);border-top-color:var(--paper);box-shadow:0 0 0 2px rgba(255,255,255,.25);scrollbar-width:thin;margin-top:-10px}
#vs .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:9px 5px;padding:0 6px}
#vs .grid button{position:relative;padding:0;aspect-ratio:1;border-radius:0;border:3px solid var(--ink);background:linear-gradient(170deg,#3a4066,#191b2e 80%);box-shadow:0 0 0 1.5px rgba(255,255,255,.28);overflow:hidden;transform:skewX(-8deg);transition:transform .08s}
#vs .grid button:hover{transform:skewX(-8deg) scale(1.1);z-index:2;box-shadow:0 0 0 2px #fff}
#vs .grid canvas{width:118%;height:100%;margin-left:-9%;image-rendering:pixelated;display:block;transform:skewX(8deg)}
#vs .grid button.p0{box-shadow:0 0 0 3px var(--p1),0 0 16px var(--p1);background:linear-gradient(170deg,var(--p1),#191b2e 85%)}#vs .grid button.p1{box-shadow:0 0 0 3px var(--p2),0 0 16px var(--p2);background:linear-gradient(170deg,var(--p2),#191b2e 85%)}
#vs .grid button.p0.p1{box-shadow:0 0 0 3px var(--gold),0 0 16px var(--gold);background:linear-gradient(170deg,var(--p1),var(--p2))}
#vs .grid em{position:absolute;left:0;top:0;padding:0 7px 0 5px;font:400 14px/1.3 var(--mg);font-style:normal;letter-spacing:.05em;color:var(--ink);background:#fff}#vs .grid em:empty{display:none}
#vs .grid button.p0 em{background:var(--p1)}#vs .grid button.p1 em{background:var(--p2)}#vs .grid button.p0.p1 em{background:var(--gold)}
#vs .opts{display:grid;grid-template-columns:auto 1fr;gap:7px 12px;align-items:center;padding:0 4px}#vs .opts>span{font:700 13px var(--body);color:var(--t2);white-space:nowrap}
#vs .fight{margin:2px auto 4px;width:min(100%,460px);padding:8px 18px 4px;font-size:clamp(28px,3.6vw,40px)}
#vs .vst{display:grid;grid-template-columns:1fr;gap:2px;font:600 13px var(--body)}#vs .vst div{display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px dashed rgba(255,255,255,.14)}#vs .vst span{color:var(--t2)}#vs .vst b{color:var(--gold)}
#vs .keys{font:600 13px/1.65 var(--body);color:var(--t2);max-width:76ch}
#vs .keys .kmsg{margin:0 0 8px;color:#fff}#vs .keys .kmsg b{color:var(--gold)}
#vs .kcols{display:grid;grid-template-columns:1fr 1fr;gap:14px}
#vs .kcol h4{margin-top:0}#vs .kcol.p1 h4{color:var(--p1)}#vs .kcol.p2 h4{color:var(--p2)}
#vs .kg{display:grid;gap:4px}
#vs .kb{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:3px 5px 3px 10px;font:700 13px var(--body);color:#fff;text-align:left;background:rgba(8,12,30,.85);border:2px solid var(--ink);border-radius:5px;cursor:pointer}
#vs .kb:hover{background:#1a2350}
#vs .kb kbd{min-width:34px;padding:3px 7px 1px;font:400 14px/1.1 var(--mg);letter-spacing:.03em;text-align:center;color:var(--ink);background:#fff;border-radius:4px;border-bottom:2px solid #9aa3bd}
#vs .kb.on{background:var(--gold);color:var(--ink)}
#vs .kb:focus-visible{outline:2px solid var(--gold);outline-offset:1px}
#vs .keys .vseg{margin:10px 0 4px}#vs .keys .vseg button:disabled{opacity:.45;cursor:default}
@media (max-width:900px){#vs .kcols{grid-template-columns:1fr}}
/* ---------- Contraste alto (Opciones): fondos opacos, bordes blancos y letra más grande en el combate ---------- */
html.hc #vs .hp,html.hc #vs .ki,html.hc #vs .gd,html.hc #vs .tr{outline:2px solid #fff;background-color:#000}
html.hc #vs .nm{background:#000;outline:2px solid #fff;padding:1px 8px;font-size:1.18em}
html.hc #vs .hint{background:#000;color:#fff;font-size:14px;opacity:1;padding:6px 12px;outline:2px solid #fff}
html.hc #vs .clock{background:#000;outline:2px solid #fff}
html.hc #vs .psv,html.hc #vs .trl,html.hc #vs .trn{background:#000;color:#fff}
html.hc #vs .tag,html.hc #vs .cmb small{text-shadow:0 0 0 #000,2px 2px 0 #000,-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000}
html.hc #vs .keys,html.hc #vs .box p{color:#fff;font-size:14px}
#vs .keys b{color:#fff}#vs .keys h4{margin:14px 0 2px;font:400 18px var(--mg);letter-spacing:.05em;color:var(--gold)}#vs .keys h4:first-child{margin-top:0}
/* Entrenamiento */
#vs .trn{position:absolute;left:18px;bottom:44px;display:none;pointer-events:auto;background:rgba(17,18,28,.86);border:3px solid var(--ink);box-shadow:0 0 0 2px rgba(255,255,255,.35);padding:8px 12px;font:600 12.5px/1.5 var(--body);max-width:350px}#vs .trn.on{display:block}#vs.cine .trn{opacity:0}#vs.touch .trn{bottom:auto;top:112px}
#vs .trn b{color:var(--gold)}#vs .trn .vseg{margin-top:6px}#vs .trn .vseg button{padding:3px 9px 2px;font-size:12px}#vs .trn kbd{font:inherit;color:var(--ink);background:#fff;border-radius:3px;padding:0 4px;margin-right:4px}
#vs.touch .trl kbd,#vs.touch .keys,#vs.touch .trn kbd{display:none}
@media (max-width:900px),(max-height:520px){
  #vs .sel.on{display:block;overflow:auto}#vs .sel header{margin-bottom:10px}#vs .sel .modes{margin-left:0}
  #vs .fp{margin-bottom:10px;overflow:visible}#vs .fp .art{width:96px;margin:-30px 0 -6px;align-self:flex-end}#vs .fp .art.ent{width:170px;margin:-30px 0 6px}#vs .fp.p1 .art{align-self:flex-start}#vs .fp .ults,#vs .fp .uh{display:none}
  #vs .mid{margin-bottom:10px}#vs .pane{overflow:visible}#vs .grid{grid-template-columns:repeat(auto-fill,minmax(56px,1fr))}#vs .opts{grid-template-columns:1fr}
  #vs .pt{width:56px;height:56px}#vs .nm{font-size:19px;-webkit-text-stroke-width:4px}#vs .nm small{display:none}#vs .hp{height:19px}#vs .clock{width:66px}#vs .clock span{width:58px;height:52px;font-size:31px;line-height:54px}
  #vs .kj{width:19px;height:19px;font-size:10px;line-height:15px}#vs .trl{font-size:14px}#vs .box{min-width:0;width:min(88%,400px)}#vs .box button{font-size:18px;padding:6px 14px 4px}
  #vs .pnl.win .box{width:auto;padding:22px 16px 12px}#vs .pnl.win .box h2{font-size:26px;margin-top:-42px}#vs .pnl.win .box p{display:none}#vs .pnl.win .box q{margin-bottom:10px;padding:5px 16px}#vs .pnl.win .box .bt button{font-size:16px;min-width:110px}
}
@media (prefers-reduced-motion:reduce){#vs .big.go,#vs .tag.go{animation-timing-function:linear}#vs .pips b.w,#vs .cmb.pop b,#vs .hp.low .v,#vs .ki.full i,#vs .tr.full{animation:none}#vs .vq{transition:opacity .15s}}
/* Choque de Ultimates: aviso para responder y marcador del pulso */
#vs .clw{position:absolute;left:50%;top:22%;transform:translateX(-50%) skewX(-12deg);padding:6px 26px 8px;background:var(--ink);border:3px solid var(--gold);box-shadow:6px 6px 0 rgba(0,0,0,.45);text-align:center;opacity:0;pointer-events:none;z-index:3}
#vs .clw.on{animation:vsclw var(--d,.75s) linear forwards}
#vs .clw b{display:block;font:400 clamp(26px,4.4vw,48px)/1 var(--mg);letter-spacing:.05em;color:var(--gold);animation:vsclwp .18s steps(2) infinite}
#vs .clw span{display:block;font:700 13px/1.6 var(--body);color:#fff}#vs .clw span b{display:inline;font:800 13px/1 var(--body);color:var(--ink);background:#fff;border-radius:4px;padding:1px 6px;animation:none;letter-spacing:0}
#vs .clw i{display:block;height:5px;margin-top:4px;background:var(--gold);transform-origin:left;animation:vsclwt var(--d,.75s) linear forwards}
@keyframes vsclw{0%{opacity:0;transform:translateX(-50%) skewX(-12deg) scale(1.4)}8%,92%{opacity:1;transform:translateX(-50%) skewX(-12deg) scale(1)}100%{opacity:0}}
@keyframes vsclwt{to{transform:scaleX(0)}}@keyframes vsclwp{50%{color:#fff}}
#vs .clh{position:absolute;left:50%;top:auto;bottom:calc(9% + 54px);width:min(620px,86%);transform:translateX(-50%);opacity:0;pointer-events:none;transition:opacity .2s;z-index:2}#vs .clh.on{opacity:1}
#vs .cht{text-align:center;font:400 clamp(20px,3vw,34px)/1 var(--mg);letter-spacing:.06em;color:#fff6c8;-webkit-text-stroke:5px var(--ink);paint-order:stroke fill;margin-bottom:6px}
#vs .clh.push .cht{animation:vschp .3s ease-in-out infinite alternate}@keyframes vschp{to{transform:scale(1.06)}}
#vs .chb{position:relative;height:22px;border:3px solid var(--ink);box-shadow:0 0 0 2px #fff,0 6px 0 rgba(0,0,0,.4);transform:skewX(-16deg);background:#222}
#vs .chb i{position:absolute;top:0;bottom:0;width:50%}#vs .chb .a{left:0}#vs .chb .b{right:0}
#vs .chb i::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.45),transparent 55%)}
#vs .chb b{position:absolute;top:-9px;bottom:-9px;left:50%;width:12px;margin-left:-6px;background:#fff;border:3px solid var(--ink);box-shadow:0 0 16px #fff,0 0 34px #fff}
#vs .clh.push .chb b{animation:vschm .1s steps(2) infinite}@keyframes vschm{50%{box-shadow:0 0 22px #fff,0 0 50px #fff}}
#vs .chn{position:absolute;top:calc(100% + 8px);max-width:48%;font:400 clamp(14px,1.9vw,20px)/1.1 var(--mg);letter-spacing:.04em;color:var(--c,#fff);-webkit-text-stroke:4px var(--ink);paint-order:stroke fill}
#vs .chn.l{left:0}#vs .chn.r{right:0;text-align:right}
#vs .chn em{display:block;font:800 11px/1.5 var(--body);font-style:normal;color:#cfe6ff;-webkit-text-stroke:3px var(--ink);letter-spacing:.02em}
#vs .chn.burn em{color:var(--gold);animation:vschb .2s steps(2) infinite}@keyframes vschb{50%{color:#fff}}
#vs .chk{position:absolute;left:50%;top:calc(100% + 44px);transform:translateX(-50%);white-space:nowrap;padding:4px 14px;border-radius:999px;background:rgba(17,18,28,.78);font:600 12px/1.8 var(--body);color:#e8ecf8;opacity:0;transition:opacity .2s}
#vs .chk:empty{display:none}#vs .clh.push .chk{opacity:1}#vs .chk b{color:var(--ink);background:#fff;border-radius:4px;padding:1px 6px;font-weight:800}
#vs.clash .hint,#vs.clash .cmb{opacity:0!important}
@media (max-width:700px){#vs .clh{bottom:calc(9% + 70px)}#vs .chk{white-space:normal;width:94%;text-align:center}}
@media (prefers-reduced-motion:reduce){#vs .clw b,#vs .clh.push .cht,#vs .clh.push .chb b,#vs .chn.burn em{animation:none}}
`;
