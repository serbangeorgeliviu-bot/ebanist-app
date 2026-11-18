/* Ebanist U.17 — construiește app/ebanist-sliding-data.js din tools/hw-data/sliding/sliding.json (sisteme glisante / escamotabile / aripă, surse oficiale).
 *
 *   python3 tools/hw-data/sliding/normalize.py    (raw → sliding.json, cu verificarea codurilor în raw)
 *   node tools/sliding-build.mjs                  scrie app/ebanist-sliding-data.js
 *   node tools/sliding-build.mjs --check          numai verifică (cod de ieșire 1 la prima problemă)
 *
 * Verificări: chei unice, kind/run/mount valide, fiecare sistem are sursă, intervalele au lo ≤ hi, `verificat` e false (nimic nu e „verificat”
 * înainte de o piesă reală), numerele sunt numere sau null, fiecare cod din BOM există în coduri, cheile `when` ale regulilor sunt cunoscute.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, "hw-data", "sliding", "sliding.json"), out = path.join(here, "..", "app", "ebanist-sliding-data.js");
const check = process.argv.includes("--check");
const KINDS = ["slide", "pocket", "wing"], RUNS = [null, "top", "bottom"], MOUNTS = [null, "overlay", "inset", "mixed", "flush", "pocket"];
const WHEN = ["n", "th", "thMin", "kgMax", "side", "sth", "wMin", "plinth", "lenUp", "nlUp", "lwaUp", "wUp", "cabWUp", "pohFrom", "doorW", "soft", "mount", "worktop", "guideLen"];
const problems = [];
const J = JSON.parse(fs.readFileSync(src, "utf8"));
const num = v => v === null || (typeof v === "number" && isFinite(v));
const rng = (P, k, r) => { if (r == null) return; if (!Array.isArray(r) || r.length !== 2 || !r.every(num) || (r[0] != null && r[1] != null && r[0] > r[1])) P(k + " invalid " + JSON.stringify(r)); };
const walk = (P, k, o) => { if (typeof o === "number" && !isFinite(o)) P(k + " nu e număr finit"); else if (o && typeof o === "object") for (const kk of Object.keys(o)) walk(P, k + "." + kk, o[kk]); };
const codes = new Map();
for (const c of J.codes) {
  if (!c.code || !c.role || !c.brand) problems.push("cod incomplet " + JSON.stringify(c));
  if (codes.has(c.code)) problems.push("cod dublat " + c.code); codes.set(c.code, c);
  if (!Array.isArray(c.ver) || !c.ver.length) problems.push(c.code + ": fără verificare în raw");
}
const keys = new Set();
for (const s of J.systems) {
  const P = m => problems.push((s.key || "?") + ": " + m);
  if (!s.key || !s.name || !s.brand) { P("lipsesc key/name/brand"); continue; }
  if (keys.has(s.key)) P("cheie dublată"); keys.add(s.key);
  if (!KINDS.includes(s.kind)) P("kind invalid " + s.kind);
  if (!RUNS.includes(s.run)) P("run invalid"); if (!MOUNTS.includes(s.mount)) P("mount invalid " + s.mount);
  if (!s.src) P("fără sursă");
  if (s.verificat !== false) P("verificat trebuie să fie false");
  if (s.leaves != null && (!Array.isArray(s.leaves) || s.leaves.length !== 2 || !(s.leaves[0] >= 1 && s.leaves[0] <= s.leaves[1]))) P("leaves invalid");
  const L = s.lim || {}; ["kg", "h", "w", "th"].forEach(k => rng(P, "lim." + k, L[k]));
  Object.keys(L.wN || {}).forEach(k => rng(P, "lim.wN." + k, L.wN[k]));
  (L.kgTh || []).forEach(r => { rng(P, "kgTh.th", r.th); if (!num(r.kg)) P("kgTh.kg"); });
  walk(P, "node", s);
  for (const ln of s.bom || []) {
    if (!ln.opts || !ln.opts.length) P("linie BOM fără opțiuni");
    for (const o of ln.opts) { if (!codes.has(o.code)) P("cod BOM necunoscut " + o.code); Object.keys(o.when || {}).forEach(w => { if (!WHEN.includes(w)) P("when necunoscut " + w); }); }
  }
  (s.info || []).forEach(i => { if (!i.k || i.t == null) P("info incomplet"); });
}
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
if (!check) {
  fs.writeFileSync(out, "/* GENERAT de tools/sliding-build.mjs din tools/hw-data/sliding/sliding.json — nu se editează. Surse: documente oficiale Hettich, Hawa, Blum, Häfele (vezi tools/hw-data/raw/cat-sliding.json). Toate cotele: verificat:false. */\n(function (root) { root.EBSlidingData = " + JSON.stringify({ sources: J.sources, notes: J.notes, codes: J.codes, systems: J.systems }) + "; })(typeof window !== \"undefined\" ? window : globalThis);\n");
}
console.log(J.systems.length + " sisteme, " + J.codes.length + " coduri");
