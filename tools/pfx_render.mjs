#!/usr/bin/env node
// Renderiza efectos de pixelfx (https://github.com/patch-gg/pixelfx, MIT) a fotogramas RGBA sueltos.
// Lo llama tools/make_pfx.py; no hace falta usarlo a mano.
//
//   node tools/pfx_render.mjs <carpeta de pixelfx> <salida> '<json con la lista>'
//   lista: [{ "id": "lightning/zap-hit", "fps": 15, "palette": ["#..."] | null }, ...]
//
// Escribe <salida>/<n>.json ({ w, h, pivot, fps, loop, frames: N }) y <salida>/<n>_<k>.rgba (bytes RGBA crudos).

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [root, out, listJson] = process.argv.slice(2);
const lib = await import(pathToFileURL(join(root, "tools", "lib", "fxlib.mjs")).href);
mkdirSync(out, { recursive: true });
const list = JSON.parse(listJson);
for (let n = 0; n < list.length; n++) {
  const it = list[n], fx = await lib.loadEffect(it.id);
  const r = lib.renderFrames(fx, { bg: "none", fps: it.fps, options: it.palette ? { palette: it.palette } : {} });
  writeFileSync(join(out, n + ".json"), JSON.stringify({ id: it.id, w: r.w, h: r.h, pivot: fx.meta.origin, fps: r.fps, loop: !!fx.meta.loop, frames: r.frames.length }));
  r.frames.forEach((f, k) => writeFileSync(join(out, n + "_" + k + ".rgba"), Buffer.from(f.clear.buffer, f.clear.byteOffset, f.clear.byteLength)));
  process.stdout.write(".");
}
console.log(" " + list.length + " efectos");
