'use strict';
/* =====================================================================
   tuto.js · Tutorial contextual: un consejo corto la PRIMERA vez que
   pasa algo (tu primer jefe, la Ultimate cargada, un enemigo nuevo...).
   No pausa el juego: sale abajo, dura unos segundos y se quita tocándolo.
   Lo ya visto se guarda en Save.d.tuto. Se apaga en Opciones.
   ===================================================================== */

/* id: [icono, título, texto] */
const TUTO = {
  inicio: ['✊', 'Tus ataques son automáticos', 'Muévete con WASD (o el joystick) y esquiva. Tus técnicas disparan solas a los enemigos cercanos.'],
  cartas: ['⬆', '¡Subes de nivel!', 'Elige una carta: técnicas nuevas o mejoras. Si subes al máximo dos técnicas compatibles, puede salir una carta para fusionarlas.'],
  ki: ['⚡', 'Te queda poco Ki', 'Mantén [C] para cargar Ki. El dash, la Transmisión Instantánea y la Ultimate lo gastan.'],
  vida: ['♥', 'Vida baja', 'El dash [ESPACIO] te hace invencible un instante. Busca semillas senzu o aléjate para recuperarte.'],
  ult: ['✷', '¡Ultimate lista!', 'Pulsa [Q] para lanzarla. Necesita la barra de Ultimate llena y algo de Ki.'],
  tf: ['⚡', 'Puedes transformarte', 'Pulsa [G]. Cada forma tiene ventajas y desventajas; con [H] vuelves a la base.'],
  jefe: ['♛', 'Ha llegado un jefe', 'Al aparecer te avisa de qué tipo de daño resiste (físico o ki). Aprende sus ataques: avisan antes de golpear.'],
  capsula: ['⬮', 'Cápsulas', 'Dan objetos con mejoras. Las doradas son mejores; las malditas, arriesgadas.'],
  esferas: ['🐉', 'Esferas del Dragón', 'Reúne las 7 del mapa y Shenron te concederá un deseo.'],
  combo: ['✖', 'Combo', 'Cada enemigo seguido sube el combo y tu daño (hasta +25%). Si te golpean, se rompe.'],
  /* enemigos con habilidades: la primera vez que aparecen */
  e5: ['💥', 'Saibaiman kamikaze', 'Corre hacia ti y explota. Si lo derribas antes, su explosión daña a los demás enemigos.'],
  e6: ['🛡', 'Metal Cooler', 'Sus primeros golpes apenas le hacen daño: insiste hasta romper su coraza.'],
  e4: ['↯', 'Capitán Ginyu', 'Si su rayo te alcanza, tus controles se invierten unos segundos.'],
  e8: ['🩸', 'Célula imperfecto', 'Te roba vida al tocarte y se hace más grande. Mantenlo lejos.'],
  e12: ['⚡', 'Androide 18', 'Cada golpe suyo te roba Ki.'],
  e15: ['✈', 'Caulifla', 'Sus ráfagas te dejan sin dash unos segundos.'],
  e18: ['🌱', 'Saibaiman emboscado', 'Brota del suelo justo a tu lado. Si ves la tierra moverse, ¡apártate!'],
  e19: ['🔰', 'Androide 17 · Barrera', 'Protege a los enemigos cercanos con una barrera. Derríbalo primero.']
};
/* Tipos de enemigo con consejo (índice de ENEMY_TYPES) */
const TUTO_ENEMY = [5, 6, 4, 8, 12, 15, 18, 19];

class Tutor {
  constructor(game) {
    this.g = game; this.q = []; this.t = 0; this.gap = 0; this.scan = 0; this.el = null;
  }
  on() { return Save.d.opt.tips !== false; }
  seen(id) { return !!(Save.d.tuto && Save.d.tuto[id]); }
  /** Pide un consejo (si ya se vio o está en cola, no hace nada) */
  say(id) {
    if (!this.on() || !TUTO[id] || this.seen(id) || this.q.includes(id)) return;
    this.q.push(id);
  }
  /** Vuelve a mostrar todos los consejos desde el principio */
  reset() { Save.d.tuto = {}; Save.write(); this.q = []; }
  show(id) {
    if (!this.el) {
      this.el = document.createElement('div'); this.el.id = 'tuto';
      this.el.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.hide(); });
      document.body.appendChild(this.el);
    }
    const [ic, ti, tx] = TUTO[id];
    this.el.innerHTML = '<i>' + ic + '</i><div><small>CONSEJO</small><b>' + ti + '</b><p>' + tx + '</p></div><span>✕</span>';
    this.el.classList.remove('go'); void this.el.offsetWidth; this.el.classList.add('go');
    Save.d.tuto = Save.d.tuto || {}; Save.d.tuto[id] = 1; Save.write();
    this.t = 7; this.gap = 9;
  }
  hide() { if (this.el) this.el.classList.remove('go'); this.t = 0; }
  /** Cada cuadro de juego: mira el estado (dos veces por segundo) y saca el siguiente consejo de la cola */
  update(dt) {
    const g = this.g, p = g.player;
    if (this.t > 0 && (this.t -= dt) <= 0) this.hide();
    if (!this.on() || g.state !== 'play') return;
    this.gap = Math.max(0, this.gap - dt);
    if ((this.scan -= dt) <= 0) {
      this.scan = 0.5;
      if (g.time > 2) this.say('inicio');
      if (g.time > 20 && p.ki < p.maxKi * 0.2) this.say('ki');
      if (p.hp < p.maxHp * 0.3) this.say('vida');
      if (p.ultD && p.ult >= p.ultD.cost) this.say('ult');
      if (p.formReady >= 0) this.say('tf');
      if (g.combo >= 10) this.say('combo');
      const h = g.horde;
      for (let i = 0; i < h.n; i++) { const ty = h.type[i]; if (TUTO_ENEMY.includes(ty)) this.say('e' + ty); }
    }
    if (this.q.length && this.t <= 0 && this.gap <= 0) this.show(this.q.shift());
  }
}
