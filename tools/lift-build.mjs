/* Ebanist U.16 — construiește app/ebanist-lift-data.js din tools/lift-data/<marca>.json (mecanisme de ridicare, surse oficiale).
 *
 *   node tools/lift-build.mjs          scrie app/ebanist-lift-data.js
 *   node tools/lift-build.mjs --check  numai verifică (cod de ieșire 1 la prima problemă)
 *
 * Verificări: chei unice, motion/flaps valide, fiecare sistem are sursă, intervalele au lo ≤ hi, `verificat` e false (nimic
 * nu e „verificat” înainte de o piesă reală), numerele sunt numere sau null. Un fișier care pică nu se scrie în date.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url)), dir = path.join(here, "lift-data"), out = path.join(here, "..", "app", "ebanist-lift-data.js");
const check = process.argv.includes("--check");
const MOTION = ["stay", "swingup", "parallel", "liftup", "bifold"], TYPES = ["LF", "KHKG", "springs", "GRID"];
const problems = [], keys = new Set(), systems = [], sources = [];
const num = v => v === null || (typeof v === "number" && isFinite(v));
for (const f of fs.readdirSync(dir).filter(x => x.endsWith(".json")).sort()) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  sources.push({ brand: j.brand, file: f, sources: j.sources });
  for (const s of j.systems) {
    const P = m => problems.push(`${s.key || "?"}: ${m}`);
    if (!s.key || !s.name || !s.brand) { P("lipsesc key/name/brand"); continue; }
    if (keys.has(s.key)) { P("cheie dublată"); continue; } keys.add(s.key);
    if (!MOTION.includes(s.motion)) P("motion invalid " + s.motion);
    if (![1, 2].includes(s.flaps)) P("flaps invalid");
    if (!s.src) P("fără sursă");
    if (s.verificat !== false) P("verificat trebuie să fie false");
    if (!s.select || !TYPES.includes(s.select.type)) { P("select.type invalid"); continue; }
    const L = s.limits || {};
    ["cabH", "cabW", "kg"].forEach(k => { const r = L[k]; if (r && (r.length !== 2 || !r.every(num) || (r[0] != null && r[1] != null && r[0] > r[1]))) P("limits." + k + " invalid"); });
    ["hiMin", "wiMin", "depthMin"].forEach(k => { if (!num(L[k] === undefined ? null : L[k])) P("limits." + k + " nu e număr"); });
    const S = s.select;
    if (s.servo) { const v = s.servo; if (!(v.depthMin > 0) || !(v.bodyW > 0) || !v.drv || !v.cableHole || !(v.cableHole.dia > 0)) P("servo incomplet"); }
    if (S.type === "LF") S.rows.forEach(r => { if (!(r.lo <= r.hi) || !r.code) P("LF rând invalid " + r.code); });
    if (S.type === "KHKG") S.rows.forEach(r => { if (!(r.khLo <= r.khHi && r.kgLo <= r.kgHi) || !r.code) P("KHKG rând invalid " + r.code); });
    if (S.type === "GRID") {
      if (!S.models.length) P("fără modele");
      S.models.forEach(m => { let prev = -Infinity; m.points.forEach(([h, lo, hi]) => { if (!(lo <= hi) || !(h > prev)) P("GRID " + m.id + " punct invalid " + h); prev = h; }); });
    }
    if (S.type === "springs") {
      if (!S.sets.length) P("fără seturi");
      S.sets.forEach(r => { if (!(r.hLo <= r.hHi)) P("set invalid " + r.code); });
      S.springs.forEach(sp => sp.ranges.forEach(r => { if (!(r.hLo <= r.hHi && r.kgLo <= r.kgHi)) P("arc invalid " + sp.code); }));
    }
    systems.push(s);
  }
}
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
if (!check) {
  fs.writeFileSync(out, "/* GENERAT de tools/lift-build.mjs din tools/lift-data/*.json — nu se editează. Surse: documente oficiale Blum, Hettich, Häfele (vezi tools/lift-data/raw). Toate cotele: verificat:false. */\n(function (root) { root.EBLiftData = " + JSON.stringify({ sources, systems }) + "; })(typeof window !== \"undefined\" ? window : globalThis);\n");
}
console.log(systems.length + " sisteme: " + systems.map(s => s.key).join(", "));
