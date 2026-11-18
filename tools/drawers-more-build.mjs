/* Ebanist — construiește app/ebanist-drawers-more-data.js din tools/hw-data/drawers/drawers.json (sisteme de sertar Hettich, GRASS, Häfele,
 * Accuride; surse oficiale citite în tools/hw-data/raw/cat-drawers.json, aduse în schemă de normalize.py).
 *
 *   node tools/drawers-more-build.mjs          scrie app/ebanist-drawers-more-data.js
 *   node tools/drawers-more-build.mjs --check  numai verifică (cod de ieșire 1 la prima problemă)
 *
 * Verificări: chei unice, fiecare casă are glisiera și setul ei de laterale, înălțimile au NL-uri, numerele sunt numere sau null,
 * `verificat` e false (D-48), fiecare sistem are sursă. Un fișier care pică nu se scrie în date.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, "hw-data", "drawers", "drawers.json"), out = path.join(here, "..", "app", "ebanist-drawers-more-data.js");
const check = process.argv.includes("--check");
const J = JSON.parse(fs.readFileSync(src, "utf8"));
const problems = [], P = m => problems.push(m);
const isNum = v => typeof v === "number" && isFinite(v), numOrNull = v => v === null || isNum(v);
const keys = new Set();
for (const r of J.runners) {
  if (keys.has(r.key)) P("cheie dublată " + r.key); keys.add(r.key);
  if (!r.src) P(r.key + ": fără sursă");
  if (r.verificat !== false) P(r.key + ": verificat trebuie să fie false");
  if (!["side", "concealed"].includes(r.kind)) P(r.key + ": kind invalid");
  if (!Array.isArray(r.nl) || !r.nl.length || r.nl.some((v, i) => !isNum(v) || (i && v <= r.nl[i - 1]))) P(r.key + ": nl invalid");
  if (!numOrNull(r.rear)) P(r.key + ": rear nu e număr");
  const w = r.wood || {}; ["ded_lat", "skl", "minBoxW"].forEach(k => { if (!numOrNull(w[k])) P(r.key + ": wood." + k + " nu e număr"); });
  if (r.holes && r.holes.usable !== false) P(r.key + ": holes.usable trebuie să fie false (referința găurilor nu e în text/tabel)");
  if (!r.name || !r.brand) P(r.key + ": fără nume/marcă");
}
const sideKeys = new Set(J.sides.map(s => s.key)), runKeys = new Set(J.runners.map(r => r.key));
for (const b of J.boxes) {
  if (keys.has(b.key)) P("cheie dublată " + b.key); keys.add(b.key);
  if (!b.src) P(b.key + ": fără sursă");
  if (b.verificat !== false) P(b.key + ": verificat trebuie să fie false");
  if (!runKeys.has(b.runner)) P(b.key + ": glisiera " + b.runner + " nu există");
  if (!sideKeys.has(b.side)) P(b.key + ": setul de laterale " + b.side + " nu există");
  const hs = Object.keys(b.hs || {});
  hs.forEach(h => { if (!isNum(b.hs[h])) P(b.key + ": hs." + h); });
  if (b.selectable) {
    if (!hs.length) P(b.key + ": fără înălțimi");
    hs.forEach(h => {
      if (!isNum(b.backHs[h])) P(b.key + ": lipsește înălțimea spatelui la " + h + " (înălțimea fără spate se exclude în hsExcl)");
      const L = b.nlBy[h]; if (!Array.isArray(L) || !L.length || L.some((v, i) => !isNum(v) || (i && v <= L[i - 1]))) P(b.key + ": nlBy." + h + " invalid");
    });
    ["baseW", "backW", "baseL"].forEach(k => {
      const v = b[k]; if (!v) { P(b.key + ": lipsește " + k); return; }
      if (v.const !== undefined ? !isNum(v.const) : (!v.byT || !Object.values(v.byT).length || Object.values(v.byT).some(x => !isNum(x)))) P(b.key + ": " + k + " invalid");
    });
    if (!isNum(b.rear)) P(b.key + ": rear");
  } else if (!(b.why && b.why.length)) P(b.key + ": o casă neselectabilă își spune motivul în `why`");
  if (!numOrNull(b.minBackW)) P(b.key + ": minBackW");
  if (Object.keys(b.hsExcl || {}).some(h => (b.hs || {})[h] != null)) P(b.key + ": hsExcl se suprapune cu hs");
}
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
const slim = o => JSON.parse(JSON.stringify(o));
const data = {
  sources: J.sources.map(s => ({ id: s.id, title: s.title, url: s.url })),
  runners: slim(J.runners).map(r => (r.codes = (r.codes || []).map(c => ({ code: c.code, desc: c.desc })), r)),
  boxes: slim(J.boxes).map(b => (b.codes = (b.codes || []).map(c => ({ code: c.code, desc: c.desc })), b)),
  sides: J.sides.map(s => ({ key: s.key, brand: s.brand, box: s.box, name: s.name, art: s.art })),
  notes: J.notes, conflicts: J.conflicts
};
if (!check) {
  fs.writeFileSync(out, "/* GENERAT de tools/drawers-more-build.mjs din tools/hw-data/drawers/drawers.json (normalize.py, din tools/hw-data/raw/cat-drawers.json) — nu se editează. Surse: documente oficiale Hettich, GRASS, Häfele, Accuride (vezi `sources`). Toate cotele: verificat:false. */\n(function (root) { root.EBDrawersMoreData = " + JSON.stringify(data) + "; })(typeof globalThis !== \"undefined\" ? globalThis : this);\n");
}
console.log(`${J.boxes.length} case (${J.boxes.filter(b => b.selectable).length} selectabile), ${J.runners.length} glisiere, ${J.sides.length} seturi de laterale${check ? " (verificat)" : ""}`);
