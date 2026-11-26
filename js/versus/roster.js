/* =====================================================================
   versus/roster.js · Plantel del Versus: los 37 luchadores de Z Legends 3
   Igual que en la selección del original: cada luchador es una entrada (Goku base, Goku SSJ, Goku Blue y Goku UI son
   cuatro). Solo se transforman en combate los que lo hacen en el original (grupo «Sistema de Transformacao»):
     Goku base → Goku SSJ → Goku Blue · Goku SSJ → Goku Blue · Bardock → Bardock SSJ
   Los demás modos del juego siguen usando CHARACTERS (js/data.js).
   ===================================================================== */
/** [id del paquete (assets/zl3/m), nombre, nombre de la forma, transformaciones en combate (ids), guerrero del juego de donde salen voces y entradas] */
const VS_ZL3 = [
  ['goku', 'Son Goku', 'Base', ['gokussj', 'gokublue'], 'goku'],
  ['gokussj', 'Son Goku', 'Super Saiyan', ['gokublue'], 'goku'],
  ['gokublue', 'Son Goku', 'Super Saiyan Blue', [], 'goku'],
  ['gokuui', 'Son Goku', 'Ultra Instinto', [], 'goku'],
  ['vegeta', 'Vegeta', 'Saga Saiyan', [], 'vegeta'],
  ['vegetassj', 'Vegeta', 'Super Saiyan', [], 'vegeta'],
  ['vegetaego', 'Vegeta', 'Ultra Ego', [], 'vegeta'],
  ['gohanssj2', 'Gohan', 'Super Saiyan 2', [], 'gohan'],
  ['gohanbeast', 'Gohan', 'Bestia', [], 'gohan'],
  ['miraigohan', 'Gohan del Futuro', 'Super Saiyan', [], 'gohanf'],
  ['miraitrunks', 'Trunks del Futuro', 'Super Saiyan', [], 'trunks'],
  ['piccolo', 'Piccolo', 'Base', [], 'piccolo'],
  ['tien', 'Ten Shin Han', 'Base', [], null],
  ['gogetassj4', 'Gogeta', 'Super Saiyan 4', [], 'gogeta'],
  ['gogetablue', 'Gogeta', 'Super Saiyan Blue', [], 'gogeta'],
  ['vegettoblue', 'Vegetto', 'Super Saiyan Blue', [], 'vegito'],
  ['bardock', 'Bardock', 'Base', ['bardockssj'], 'bardock'],
  ['bardockssj', 'Bardock', 'Super Saiyan', [], 'bardock'],
  ['raditz', 'Raditz', 'Base', [], 'raditz'],
  ['nappa', 'Nappa', 'Base', [], null],
  ['ginyu', 'Capitán Ginyu', 'Base', [], 'ginyu'],
  ['freezer', 'Freezer', 'Forma final', [], 'freezer'],
  ['cell', 'Cell', 'Forma perfecta', [], 'cell'],
  ['a17', 'Androide 17', 'Base', [], 'andro17'],
  ['a18', 'Androide 18', 'Base', [], 'andro18'],
  ['kidbuu', 'Kid Buu', 'Base', [], null],
  ['janemba', 'Janemba', 'Super Janemba', [], 'janemba'],
  ['brolyz', 'Broly', 'Super Saiyan Legendario', [], 'broly'],
  ['brolydbs', 'Broly (Super)', 'Furia', [], 'broly'],
  ['kefla', 'Kefla', 'Super Saiyan', [], 'kefla'],
  ['hit', 'Hit', 'Base', [], 'hitto'],
  ['jiren', 'Jiren', 'Base', [], 'jiren'],
  ['beerus', 'Bills', 'Base', [], 'bills'],
  ['black', 'Goku Black', 'Super Saiyan Rosé', [], 'black'],
  ['zamasu', 'Zamasu', 'Fusionado', [], 'zamasuf'],
  ['baby', 'Super Baby 2', 'Base', [], 'babyv'],
  ['moro', 'Moro', 'Base', [], null]
];
/** Color del ki de los que no tienen forma en el juego principal */
const VS_ZL3_KI = { tien: 0xfff2a0, nappa: 0xffd84a, kidbuu: 0xff7ad0, brolydbs: 0x7dff6a, miraigohan: 0xffe14a, moro: 0x9aff8a, baby: 0xc28aff, ginyu: 0xb08aff, brolyz: 0x7dff6a };
let VS_ROSTER = null;
/** Forma de una entrada: la del juego principal que ya usa esa hoja (con su tinte y ki) o una nueva */
function vsZForm(cid, name) {
  const sh = 'z_' + cid;
  for (const c of CHARACTERS) { const f = c.forms && c.forms.find((g) => g.sheet === sh); if (f) return { f: Object.assign({}, f, { name, on: f.name }), base: c, ix: c.forms.indexOf(f) }; }   // on: su nombre en el juego (claves de ZMOVE_X)
  return { f: { name, sheet: sh, anim: packAnim(sh), tint: 0xffffff, ki: VS_ZL3_KI[cid] || 0x8ad8ff }, base: null, ix: -1 };
}
/** Los 37 luchadores (se montan la primera vez: CHARACTERS ya tiene las hojas de Z Legends 3) */
function vsRoster() {
  if (VS_ROSTER) return VS_ROSTER;
  const name = {}; for (const [cid, , fn] of VS_ZL3) name[cid] = fn;
  VS_ROSTER = VS_ZL3.filter(([cid]) => window.SPRITE_DATA && SPRITE_DATA['z_' + cid]).map(([cid, n, fn, tr, bid]) => {
    const F = [cid].concat(tr).map((c) => vsZForm(c, name[c] || fn)), B = (bid && charById(bid)) || F[0].base;
    return { id: 'zl_' + cid, zl: cid, name: n, base: B || null, bid: (B && B.id) || cid, forms: F.map((x) => x.f), ix: F.map((x) => x.ix),
      hp: B ? B.hp : 110, spd: B ? B.spd : 1, ult: B ? B.ult : null, portrait: B ? B.portrait : null };
  });
  return VS_ROSTER;
}
/** Luchador del Versus por id ('zl_<id>'); si no, un guerrero del juego (la Historia del Versus usa los suyos) */
function vsCharById(id) { return (/^zl_/.test(id || '') && vsRoster().find((c) => c.id === id)) || charById(id); }
