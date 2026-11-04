/* Ebanist — construiește app/ebanist-slides-data.js din tools/blum-slides-data/*.json (catalogul Blum KA-150 2022/2023: glisiere și casete,
 * transcrise pe pagini). Aceeași regulă ca la balamale (D-114): numai cote cu etichetă sau din tabel; ce nu s-a putut citi e în `unreadable`.
 *
 *   node tools/blum-slides-build.mjs          scrie app/ebanist-slides-data.js
 *   node tools/blum-slides-build.mjs --check  numai verifică (ieșire 1 la prima problemă)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url)), dir = path.join(here, "blum-slides-data"), outFile = path.join(here, "..", "app", "ebanist-slides-data.js");
const check = process.argv.includes("--check");
const systems = [], problems = [], seen = new Set();
for (const f of fs.readdirSync(dir).filter(x => x.endsWith(".json")).sort()) {
  for (const s of JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))) {
    const P = m => problems.push(`${s.key || f}: ${m}`);
    if (!s.key || !s.name && !s.key) { P("lipsește key"); continue; }
    if (seen.has(s.key)) { P("cheie dublată"); continue; } seen.add(s.key);
    if (!Array.isArray(s.pages) || !s.pages.length || s.pages.some(p => !(p >= 180 && p <= 520))) P(`pagini în afara catalogului: ${JSON.stringify(s.pages)}`);
    if (!["runner", "box", "accessory", "drill"].includes(s.kind)) P(`kind necunoscut: ${s.kind}`);
    const L = s.lengths || []; for (let i = 1; i < L.length; i++) if (!(L[i] > L[i - 1])) P(`lengths nu cresc la ${i}`);
    /* parts: lista normalizată — rândurile fără cod (descrieri) se scot, codurile repetate pe mai multe pagini ale aceluiași sistem se păstrează o dată */
    if (s.parts != null && !Array.isArray(s.parts)) s.parts = Object.values(s.parts).flat();
    const arts = new Set(); s.parts = (s.parts || []).filter(p => p && p.art && !arts.has(p.art) && arts.add(p.art));
    for (const fm of (s.cutting && s.cutting.formulas) || []) if (!fm.piece) P("formulă de tăiere fără piece");
    s.name = s.name || s.key; systems.push(s);
  }
}
if (problems.length) { console.error(problems.join("\n")); if (check) process.exit(1); }
const nParts = systems.reduce((n, s) => n + (s.parts || []).length, 0);
if (check) { console.log(`ok: ${systems.length} sisteme, ${nParts} coduri`); process.exit(0); }
const out = `/* GENERAT de tools/blum-slides-build.mjs din tools/blum-slides-data/*.json — nu se editează. Sursa: Blum, Catalogue and technical manual 2022/2023 (KA-150). */
(function (root) { root.EBSlidesData = ${JSON.stringify({ systems: Object.fromEntries(systems.map(s => [s.key, s])) })}; })(typeof globalThis !== "undefined" ? globalThis : this);
`;
fs.writeFileSync(outFile, out);
console.log(`scris ${path.relative(process.cwd(), outFile)}: ${systems.length} sisteme, ${nParts} coduri${problems.length ? `, ${problems.length} probleme` : ""}`);
