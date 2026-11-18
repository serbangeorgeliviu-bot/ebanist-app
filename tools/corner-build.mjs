/* Ebanist U.17 — construiește app/ebanist-corner-data.js din tools/hw-data/corner/units.json (generat de normalize.py din tools/hw-data/raw).
 *
 *   node tools/corner-build.mjs          scrie app/ebanist-corner-data.js
 *   node tools/corner-build.mjs --check  numai verifică (cod de ieșire 1 la prima problemă)
 *
 * Verificări: chei unice, `kind`/`body`/`front` valide, fiecare unitate are sursă, `verificat` e false, numerele sunt numere sau null,
 * intervalele au lo ≤ hi, mărimile au id unic. Un fișier care pică nu se scrie în date.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url)), src = path.join(here, "hw-data", "corner", "units.json"), out = path.join(here, "..", "app", "ebanist-corner-data.js");
const check = process.argv.includes("--check");
const KINDS = ["blind", "carousel", "cdrawer", "pullout", "tall", "pulldown", "spin", "turntable", "tvlift", "wardlift", "bracket"], BODIES = ["base", "tall", "wall", "any"], FRONTS = ["hinged", "frame", "unit", null];
const j = JSON.parse(fs.readFileSync(src, "utf8")), problems = [], keys = new Set();
const num = v => v === null || (typeof v === "number" && isFinite(v));
const rng = (r, P, what) => { if (r == null) return; if (!Array.isArray(r) || r.length !== 2 || !r.every(num) || (r[0] != null && r[1] != null && r[0] > r[1])) P(what + " interval invalid"); };
for (const u of j.units) {
  const P = m => problems.push(`${u.key || "?"}: ${m}`);
  if (!u.key || !u.name || !u.brand) { P("lipsesc key/name/brand"); continue; }
  if (keys.has(u.key)) { P("cheie dublată"); continue; } keys.add(u.key);
  if (!KINDS.includes(u.kind)) P("kind invalid " + u.kind);
  if (!BODIES.includes(u.body)) P("body invalid " + u.body);
  if (!FRONTS.includes(u.front)) P("front invalid " + u.front);
  if (!u.src) P("fără sursă");
  if (u.verificat !== false) P("verificat trebuie să fie false");
  const ids = new Set();
  (u.sizes || []).forEach(s => {
    if (ids.has(s.id)) P("mărime dublată " + s.id); ids.add(s.id);
    ["wi", "hi", "open"].forEach(k => rng(s[k], P, "size " + s.id + "." + k));
    if (Array.isArray(s.cab)) rng(s.cab, P, "size " + s.id + ".cab");
    ["door", "depth"].forEach(k => { if (s[k] !== undefined && !num(s[k])) P("size " + s.id + "." + k + " nu e număr"); });
  });
  (u.bands || []).forEach(b => rng(b.hi, P, "band " + b.id));
  ["hi", "cab", "spinH"].forEach(k => rng(u.limits && u.limits[k], P, "limits." + k));
  if ((u.codes || []).some(c => !c.code)) P("cod gol");
}
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
if (!check) {
  fs.writeFileSync(out, "/* GENERAT de tools/corner-build.mjs din tools/hw-data/corner/units.json (normalize.py, din tools/hw-data/raw) — nu se editează. Surse: documente oficiale Blum, Kesseböhmer, Peka, Hettich, Häfele, Vauth-Sagel, GRASS. Toate cotele: verificat:false; ce nu e citit = null. */\n(function (root) { root.EBCornerData = " + JSON.stringify({ sources: j.sources, units: j.units }) + "; })(typeof window !== \"undefined\" ? window : globalThis);\n");
}
console.log(j.units.length + " unități");
