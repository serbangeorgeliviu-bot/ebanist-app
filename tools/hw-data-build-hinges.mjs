/* Ebanist — balamale de la alte mărci (Hettich, Salice, Grass, Häfele, Blum 105°): construiește app/ebanist-hinges-more-data.js
 * din tools/hw-data/hinges/*.json (normalizate de tools/hw-data/hinges/normalize.py din tools/hw-data/raw/cat-hinges.json).
 *
 *   node tools/hw-data-build-hinges.mjs          scrie app/ebanist-hinges-more-data.js
 *   node tools/hw-data-build-hinges.mjs --check  numai verifică (cod de ieșire 1 la prima problemă)
 *
 * Verificări:
 *   - chei de familie și id-uri de articol unice, fiecare familie are sursă, nume, unghi sau tip;
 *   - FIECARE număr din cupă, fixări, placuțe, tabelul de numărare și intervalul grosimii ușii apare în raw (nimic scris din memorie);
 *   - plăcuțele și fixările la care trimit articolele există; `pattern` și `hole` au spacing + offset / dia numerice (adâncimea poate fi null);
 *   - `verificat` rămâne false: nimic nu e „verificat” înainte de o piesă reală (D-48).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url)), dir = path.join(here, "hw-data", "hinges"), rawFile = path.join(here, "hw-data", "raw", "cat-hinges.json"),
  out = path.join(here, "..", "app", "ebanist-hinges-more-data.js");
const check = process.argv.includes("--check");
const problems = [];
const rawText = fs.readFileSync(rawFile, "utf8");
/* toate numerele din raw (din valori și din șiruri), ca mulțime de reprezentări canonice */
const rawNums = new Set();
for (const m of rawText.matchAll(/-?\d+(?:\.\d+)?/g)) rawNums.add(String(+m[0]));
const inRaw = v => rawNums.has(String(v)) || rawNums.has(String(Math.abs(v)));
const num = v => v === null || (typeof v === "number" && isFinite(v));

const brands = [], fams = [], keys = new Set(), ids = new Map(), plateIds = new Set();
for (const f of fs.readdirSync(dir).filter(x => x.endsWith(".json")).sort()) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  for (const p of j.plates || []) { if (plateIds.has(p.id)) problems.push(`placuță dublată ${p.id}`); plateIds.add(p.id); }
}
function numbersOf(o, acc = []) {
  if (o == null) return acc;
  if (typeof o === "number") acc.push(o);
  else if (Array.isArray(o)) o.forEach(x => numbersOf(x, acc));
  else if (typeof o === "object") for (const k of Object.keys(o)) { if (k === "src") continue; numbersOf(o[k], acc); }
  return acc;
}
for (const f of fs.readdirSync(dir).filter(x => x.endsWith(".json")).sort()) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  brands.push({ brand: j.brand, file: f, sources: j.sources, notes: j.notes });
  for (const p of j.plates || []) {
    const P = m => problems.push(`${p.id}: ${m}`);
    ["line", "pitch"].forEach(k => { if (!num(p[k] === undefined ? null : p[k])) P(k + " nu e număr"); });
    if (p.hole && !(p.hole.dia > 0)) P("hole fără dia");
    numbersOf({ l: p.line, p: p.pitch, h: p.hole, d: p.D }).forEach(n => { if (!inRaw(n)) P(`numărul ${n} nu e în raw`); });
    if (p.line != null && !["table", "text", "drawing"].includes(p.lineSrc)) P("lineSrc invalid");
  }
  for (const fam of j.families) {
    const P = m => problems.push(`${fam.key || "?"}: ${m}`);
    if (!fam.key || !fam.name || !fam.brand) { P("lipsesc key/name/brand"); continue; }
    if (keys.has(fam.key)) { P("cheie dublată"); continue; } keys.add(fam.key);
    if (!fam.src) P("fără sursă");
    if (fam.verificat !== undefined && fam.verificat !== false) P("verificat trebuie să fie false");
    fam.verificat = false;
    if (!fam.parts || !fam.parts.length) P("fără articole");
    /* numerele: tot ce e cotă trebuie să existe în raw */
    const c = fam.cup || {};
    numbersOf({ a: fam.angle, d: fam.doorTh, c: [c.dia, c.depth, c.depthMin, c.tb] }).forEach(n => { if (!inRaw(n)) P(`cupă/unghi/grosime: ${n} nu e în raw`); });
    for (const k of ["dia", "depth", "depthMin"]) if (!num(c[k] === undefined ? null : c[k])) P("cup." + k + " nu e număr");
    if (c.tb && (c.tb.length !== 2 || !(c.tb[0] <= c.tb[1]))) P("cup.tb invalid");
    if (fam.doorTh && fam.doorTh[0] != null && fam.doorTh[1] != null && fam.doorTh[0] > fam.doorTh[1]) P("doorTh invalid");
    for (const [fid, fx] of Object.entries(fam.fix || {})) {
      numbersOf({ h: fx.hole, p: fx.pattern, cd: fx.cupDepth }).forEach(n => { if (!inRaw(n)) P(`fix ${fid}: ${n} nu e în raw`); });
      if (fx.pattern && !(fx.pattern.spacing > 0 && fx.pattern.offset >= 0)) P(`fix ${fid}: pattern incomplet`);
      if (fx.hole && !(fx.hole.dia > 0)) P(`fix ${fid}: hole fără dia`);
    }
    if (fam.count) {
      let pn = 0, ph = 0;
      for (const r of fam.count.rows) {
        if (!(r.n > pn) || (r.h != null && r.h < ph)) P("count: rânduri neordonate");
        pn = r.n; ph = r.h == null ? ph : r.h;
        numbersOf([r.n, r.h, r.kg]).forEach(n => { if (!inRaw(n)) P(`count: ${n} nu e în raw`); });
      }
      numbersOf([fam.count.widthMax, fam.count.minSpacing, fam.count.endEdge]).forEach(n => { if (!inRaw(n)) P(`count: ${n} nu e în raw`); });
    }
    if (fam.plates !== "blum-clip") for (const id of fam.plates || []) if (!plateIds.has(id)) P("placuță necunoscută " + id);
    for (const p of fam.parts) {
      const Q = m => P(`${p.id}: ${m}`);
      if (!p.id) { Q("fără id"); continue; }
      if (ids.has(p.id)) Q("id dublat cu " + ids.get(p.id)); ids.set(p.id, fam.key);
      if (p.fix && fam.fix && Object.keys(fam.fix).length && !(p.fix in fam.fix) && !["glued", "screw"].includes(p.fix)) Q("fixare necunoscută " + p.fix);
      if (p.pattern) {
        if (!(p.pattern.spacing > 0 && p.pattern.offset >= 0)) Q("pattern incomplet");
        numbersOf([p.pattern.spacing, p.pattern.offset, p.pattern.dia]).forEach(n => { if (!inRaw(n)) Q(`pattern ${n} nu e în raw`); });
        if (!["text", "drawing"].includes(p.pattern.src)) Q("pattern.src invalid");
      }
      if (p.art !== null && typeof p.art !== "string") Q("art trebuie să fie șir sau null");
    }
    fams.push(fam);
  }
}
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
const plates = [];
for (const f of fs.readdirSync(dir).filter(x => x.endsWith(".json")).sort()) plates.push(...(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).plates || []));
if (!check) {
  fs.writeFileSync(out, "/* GENERAT de tools/hw-data-build-hinges.mjs din tools/hw-data/hinges/*.json — nu se editează. Surse: documente oficiale Hettich, Salice, Grass, Häfele, Blum (vezi tools/hw-data/raw/cat-hinges.json). Toate cotele: verificat:false. */\n(function (root) { root.EBHingesMoreData = " +
    JSON.stringify({ brands, plates, families: fams }) + "; })(typeof window !== \"undefined\" ? window : globalThis);\n");
}
console.log(fams.length + " familii, " + fams.reduce((n, f) => n + f.parts.length, 0) + " articole, " + plates.length + " placuțe");
