'use strict';
/* =====================================================================
   online.js · Cuenta (correo y contraseña) y ranking mundial con Supabase.
   - Sin configurar (url/key vacías) o sin conexión, el juego funciona igual:
     solo se desactivan la cuenta y el ranking mundial.
   - La base de datos (supabase/ranking.sql) calcula la puntuación y valida
     las estadísticas; aquí solo se envían los datos de la partida.
   ===================================================================== */

/* Configuración: pon aquí los datos de TU proyecto (Supabase > Project Settings > API) */
const ONLINE_CFG = {
  url: 'https://figkiqavpwhpglnhctwm.supabase.co',
  key: 'sb_publishable_OwYQIRmWj5_qmZiQzUE5PQ_FoH7MO_Z'      // clave pública "anon" / "publishable" (se puede publicar: la seguridad la dan las reglas RLS)
};
const PENDING_KEY = 'dbus_pending_v1';   // partidas que no se pudieron enviar (se reintentan al volver a entrar)
const NAME_RE = /^[A-Za-z0-9_ ÁÉÍÓÚÜÑáéíóúüñ-]{3,16}$/;

/** Escapa texto para meterlo en HTML (los nombres los escriben los jugadores) */
const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

class Online {
  constructor() {
    this.sb = null; this.user = null; this.name = ''; this.onChange = null;
    this.recovery = false;       // has entrado desde el enlace de «he olvidado mi contraseña»: toca elegir una nueva
    this.cosmetic = true;        // ¿la base de datos tiene ya las columnas de foto y marco? (supabase/ranking.sql actualizado)
    if (ONLINE_CFG.url && ONLINE_CFG.key && typeof supabase !== 'undefined' && supabase.createClient) {
      try { this.sb = supabase.createClient(ONLINE_CFG.url, ONLINE_CFG.key); } catch (e) { console.error(e); this.sb = null; }
    }
  }
  /** ¿Está configurado el servicio? */
  get ready() { return !!this.sb; }
  /** ¿Hay sesión iniciada? */
  get logged() { return !!this.user; }

  /** Recupera la sesión guardada y escucha los cambios (entrar, salir, confirmar correo) */
  async init() {
    if (!this.sb) return;
    const { data } = await this.sb.auth.getSession();
    await this.setUser(data && data.session ? data.session.user : null);
    // Supabase recomienda no esperar otras llamadas dentro de este aviso: se aplaza un instante
    this.sb.auth.onAuthStateChange((ev, session) => {
      if (ev === 'PASSWORD_RECOVERY') this.recovery = true;
      setTimeout(() => { this.setUser(session ? session.user : null); if (ev === 'PASSWORD_RECOVERY' && this.onChange) this.onChange(); }, 0);
    });
  }
  async setUser(u) {
    const same = (this.user && this.user.id) === (u && u.id);
    this.user = u;
    if (!u) { this.name = ''; if (!same && this.onChange) this.onChange(); return; }
    if (same && this.name) return;
    const { data } = await this.sb.from('profiles').select('name').eq('id', u.id).maybeSingle();
    this.name = data ? data.name : (u.user_metadata && u.user_metadata.name) || '';
    if (this.onChange) this.onChange();
    this.saveProfile();                                               // lo que llevas puesto en este navegador pasa a tu perfil público
    this.flushPending();
  }

  /** Traduce los errores de Supabase a mensajes claros */
  errText(e) {
    const m = (e && (e.message || e.error_description || String(e))) || '';
    if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
    if (/Email not confirmed/i.test(m)) return 'Confirma tu correo antes de entrar (revisa la bandeja de entrada y el spam).';
    if (/already registered|already been registered/i.test(m)) return 'Ya existe una cuenta con ese correo.';
    if (/Database error saving new user|profiles_name_lower/i.test(m)) return 'Ese nombre de jugador ya está en uso.';
    if (/Password should be|password.*characters/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres.';
    if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Espera un poco y vuelve a probar.';
    if (/invalid.*email|email.*invalid/i.test(m)) return 'El correo no es válido.';
    if (/Demasiadas partidas/i.test(m)) return 'Espera unos segundos entre partidas.';
    if (/same password|different from the old/i.test(m)) return 'La contraseña nueva tiene que ser distinta de la anterior.';
    if (/duplicate key|profiles_name_lower/i.test(m)) return 'Ese nombre de jugador ya está en uso.';
    if (/security purposes|only request this after/i.test(m)) return 'Acabas de pedirlo. Espera un minuto y vuelve a probar.';
    if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Sin conexión con el servidor.';
    return 'Error: ' + m;
  }

  /** Registro con correo, contraseña y nombre de jugador. Devuelve {ok, msg} */
  async signUp(email, pass, name) {
    if (!this.sb) return { ok: false, msg: 'El ranking online no está configurado.' };
    name = String(name || '').trim();
    if (!NAME_RE.test(name)) return { ok: false, msg: 'El nombre debe tener de 3 a 16 caracteres (letras, números, espacios, _ o -).' };
    if (String(pass || '').length < 6) return { ok: false, msg: 'La contraseña debe tener al menos 6 caracteres.' };
    try {
      // Comprobación rápida del nombre (la definitiva la hace la base de datos)
      const { data: taken } = await this.sb.from('profiles').select('id').ilike('name', name.replace(/[\\%_]/g, (c) => '\\' + c)).limit(1);
      if (taken && taken.length) return { ok: false, msg: 'Ese nombre de jugador ya está en uso.' };
      const { data, error } = await this.sb.auth.signUp({ email: String(email).trim(), password: pass, options: { data: { name }, emailRedirectTo: this.backUrl() } });
      if (error) return { ok: false, msg: this.errText(error) };
      if (!data.session) return { ok: true, msg: 'Cuenta creada. Te hemos enviado un correo: confírmalo y luego inicia sesión.' };
      return { ok: true, msg: '¡Cuenta creada! Ya estás dentro.' };
    } catch (e) { return { ok: false, msg: this.errText(e) }; }
  }
  /** Inicio de sesión. Devuelve {ok, msg} */
  async signIn(email, pass) {
    if (!this.sb) return { ok: false, msg: 'El ranking online no está configurado.' };
    try {
      const { error } = await this.sb.auth.signInWithPassword({ email: String(email).trim(), password: pass });
      if (error) return { ok: false, msg: this.errText(error) };
      return { ok: true, msg: 'Sesión iniciada.' };
    } catch (e) { return { ok: false, msg: this.errText(e) }; }
  }
  async signOut() { if (this.sb) { try { await this.sb.auth.signOut(); } catch (e) { console.error(e); } } }
  /** Dirección de vuelta de los correos (confirmar cuenta, recuperar contraseña): esta misma página */
  backUrl() { return location.href.split('#')[0].split('?')[0]; }
  /** Envía el correo para elegir una contraseña nueva. Devuelve {ok, msg} */
  async resetPass(email) {
    if (!this.sb) return { ok: false, msg: 'El servidor de cuentas no está disponible.' };
    try {
      const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: this.backUrl() });
      if (error) return { ok: false, msg: this.errText(error) };
      return { ok: true, msg: 'Si hay una cuenta con ese correo, te hemos enviado un enlace. Revisa también el spam.' };
    } catch (e) { return { ok: false, msg: this.errText(e) }; }
  }
  /** Reenvía el correo de confirmación de una cuenta recién creada */
  async resend(email) {
    if (!this.sb) return { ok: false, msg: 'El servidor de cuentas no está disponible.' };
    try {
      const { error } = await this.sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: this.backUrl() } });
      if (error) return { ok: false, msg: this.errText(error) };
      return { ok: true, msg: 'Correo de confirmación enviado. Revisa también el spam.' };
    } catch (e) { return { ok: false, msg: this.errText(e) }; }
  }
  /** Cambia la contraseña (con sesión iniciada o tras el enlace de recuperación) */
  async changePass(pass) {
    if (!this.sb || !this.user) return { ok: false, msg: 'Inicia sesión primero.' };
    if (String(pass || '').length < 6) return { ok: false, msg: 'La contraseña debe tener al menos 6 caracteres.' };
    try {
      const { error } = await this.sb.auth.updateUser({ password: pass });
      if (error) return { ok: false, msg: this.errText(error) };
      const rec = this.recovery; this.recovery = false;
      if (rec && this.onChange) setTimeout(() => this.onChange(), 1200);   // deja leer el mensaje y vuelve al perfil
      return { ok: true, msg: 'Contraseña cambiada.' };
    } catch (e) { return { ok: false, msg: this.errText(e) }; }
  }
  /** Cambia el nombre de jugador (el que se ve en el ranking) */
  async rename(name) {
    if (!this.sb || !this.user) return { ok: false, msg: 'Inicia sesión primero.' };
    name = String(name || '').trim();
    if (!NAME_RE.test(name)) return { ok: false, msg: 'El nombre debe tener de 3 a 16 caracteres (letras, números, espacios, _ o -).' };
    if (name === this.name) return { ok: false, msg: 'Ese ya es tu nombre.' };
    try {
      const { error } = await this.sb.from('profiles').update({ name }).eq('id', this.user.id);
      if (error) return { ok: false, msg: this.errText(error) };
      this.name = name;
      return { ok: true, msg: 'Nombre cambiado: ahora eres ' + name + '.' };
    } catch (e) { return { ok: false, msg: this.errText(e) }; }
  }
  /** Copia la foto, el marco y el título elegidos al perfil público. Si la base de datos aún no tiene esas columnas, no hace nada */
  async saveProfile() {
    if (!this.sb || !this.user || !this.cosmetic || typeof Profile === 'undefined') return;
    const C = Profile.cur();
    try {
      const { error } = await this.sb.from('profiles').update({ avatar: C.av.id, frame: C.fr.id, title: C.ti.id }).eq('id', this.user.id);
      if (error && this.oldDb(error)) this.cosmetic = false; else if (error) console.error(error);
    } catch (e) { console.error(e); }
  }
  /** ¿El error es porque falta ejecutar el supabase/ranking.sql nuevo (columnas de foto y marco)? */
  oldDb(e) { return /avatar|frame|title|column|schema cache/i.test((e && (e.message || '')) + ' ' + (e && e.code || '')) && !/Failed to fetch|NetworkError/i.test(e.message || ''); }

  /** Envía una partida. run = {ch, kills, level, bosses, step, time, win, diff, daily}. Devuelve {ok, msg, score, rank} */
  async submit(run) {
    if (!this.sb) return { ok: false, msg: '' };
    if (!this.user) return { ok: false, msg: 'Inicia sesión en CUENTA para aparecer en el ranking mundial.' };
    try {
      const { data, error } = await this.sb.from('scores').insert(run).select('score').single();
      if (error) {
        if (/Failed to fetch|NetworkError|network/i.test(error.message || '')) this.queue(run);
        return { ok: false, msg: this.errText(error) };
      }
      const rank = await this.myRank();
      return { ok: true, score: data.score, rank, msg: '' };
    } catch (e) { this.queue(run); return { ok: false, msg: 'Sin conexión: la partida se enviará la próxima vez que entres.' }; }
  }
  /** Posición de tu mejor partida en el ranking mundial (o 0 si no tienes) */
  async myRank() {
    if (!this.sb || !this.user) return 0;
    const { data: me } = await this.sb.from('leaderboard').select('score').eq('user_id', this.user.id).maybeSingle();
    if (!me) return 0;
    const { count } = await this.sb.from('leaderboard').select('user_id', { count: 'exact', head: true }).gt('score', me.score);
    return (count || 0) + 1;
  }

  /* ----- Cola de partidas pendientes (por si se cae la conexión) ----- */
  queue(run) {
    try { const l = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); l.push(run); localStorage.setItem(PENDING_KEY, JSON.stringify(l.slice(-5))); } catch (e) { console.error(e); }
  }
  async flushPending() {
    let l = [];
    try { l = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch (e) { l = []; }
    if (!l.length || !this.user) return;
    // Se envía solo la mejor pendiente (el servidor admite una partida cada 20 s)
    l.sort((a, b) => runScore(b) - runScore(a));
    const { error } = await this.sb.from('scores').insert(l[0]);
    if (!error || !/Failed to fetch|NetworkError|network/i.test(error.message || '')) { try { localStorage.removeItem(PENDING_KEY); } catch (e) { console.error(e); } }
  }

  /** Top mundial: la mejor partida de cada jugador */
  async topGlobal(limit) {
    const cols = 'user_id,name,score,ch,kills,level,step,time,win,diff,created_at', q = (c) => this.sb.from('leaderboard').select(c).order('score', { ascending: false }).limit(limit || 50);
    let { data, error } = await q(cols + (this.cosmetic ? ',avatar,frame' : ''));
    if (error && this.cosmetic && this.oldDb(error)) { this.cosmetic = false; ({ data, error } = await q(cols)); }   // base de datos sin actualizar: ranking sin fotos
    if (error) throw error;
    return data || [];
  }
  /** Top del desafío diario de hoy: la mejor de cada jugador */
  async topDaily(limit) {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const q = (p) => this.sb.from('scores').select('user_id,score,ch,kills,level,step,time,win,diff,created_at,profiles(' + p + ')')
      .eq('daily', true).gte('created_at', d.toISOString()).order('score', { ascending: false }).limit(300);
    let { data, error } = await q(this.cosmetic ? 'name,avatar,frame' : 'name');
    if (error && this.cosmetic && this.oldDb(error)) { this.cosmetic = false; ({ data, error } = await q('name')); }
    if (error) throw error;
    const seen = new Set(), out = [];
    for (const r of data || []) { if (seen.has(r.user_id)) continue; seen.add(r.user_id); out.push(Object.assign({ name: r.profiles ? r.profiles.name : '?', avatar: r.profiles && r.profiles.avatar, frame: r.profiles && r.profiles.frame }, r)); if (out.length >= (limit || 50)) break; }
    return out;
  }
}
