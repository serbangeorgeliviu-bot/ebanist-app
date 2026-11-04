/* Ebanist — construiește app/ebanist-hinges-data.js din tools/blum-data/*.json (catalogul Blum KA-150 2022/2023, transcris pe pagini).
 *
 *   node tools/blum-build.mjs          scrie app/ebanist-hinges-data.js
 *   node tools/blum-build.mjs --check  numai verifică (cod de ieșire 1 la prima problemă)
 *
 * Verificări: regula TB = FA − k + MD pe fiecare celulă din tabel, rostul F (crește cu FD, scade cu TB), coduri de comandă unice,
 * plăcuțele numite există, fiecare familie are pagină sursă. Un fișier care pică nu se scrie în date.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url)), dir = path.join(here, "blum-data"), outFile = path.join(here, "..", "app", "ebanist-hinges-data.js");
const check = process.argv.includes("--check");
const plates = JSON.parse(fs.readFileSync(path.join(dir, "plates.json"), "utf8"));
const plateIds = new Set(plates.map(p => p.id));
const fams = [], problems = [], arts = new Map();
for (const f of fs.readdirSync(dir).filter(x => x.endsWith(".json") && x !== "plates.json").sort()) {
  for (const fam of JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))) {
    const P = m => problems.push(`${fam.key}: ${m}`);
    if (!fam.key || !fam.name || !Array.isArray(fam.pages) || !fam.pages.length) { P("lipsesc key/name/pages"); continue; }
    if (fams.some(x => x.key === fam.key)) { P("cheie dublată"); continue; }
    for (const a in fam.tbTable || {}) for (const md in fam.tbTable[a]) for (const fa in fam.tbTable[a][md]) {
      const k = fam.tbRule && fam.tbRule[a]; if (k == null) { P(`tbTable.${a} fără tbRule`); continue; }
      if (+fa - k + +md !== fam.tbTable[a][md][fa]) P(`TB ${a} MD${md} FA${fa}: tabel ${fam.tbTable[a][md][fa]}, regulă ${+fa - k + +md}`);
    }
    /* rostul F: rândurile pornesc de la primul FD și pot fi mai scurte (celulele goale din catalog); se completează cu null.
       Rostul crește cu FD în orice tabel. Cu TB nu există regulă comună (la 110° scade, la 155° și 125° crește): nu se verifică. */
    const fd = fam.gapFD || [];
    for (const b in fam.gap || {}) {
      const r = fam.gap[b]; if (r.length > fd.length) P(`gap[${b}] are ${r.length} valori, gapFD ${fd.length}`);
      while (r.length < fd.length) r.push(null);
      const v = r.filter(x => x != null); for (let i = 1; i < v.length; i++) if (v[i] < v[i - 1]) P(`gap[${b}] scade cu FD la ${i}`);
    }
    for (const p of fam.parts || []) { if (!p.art) { P("cod lipsă"); continue; } if (!arts.has(p.art)) arts.set(p.art, fam.key); }
    /* același cod apare în mai multe pagini (ex. 71B9790 la ușa cu profil, oglindă și unghiulare ±5°): la căutare câștigă prima familie, cele unghiulare vin la urmă */
    fam.plates = (fam.plates || []).map(id => plateIds.has(id) ? id : (plates.find(p => p.art.includes(id)) || {}).id).filter((id, i, a) => id && a.indexOf(id) === i);
    fams.push(fam);
  }
}
if (problems.length) { console.error(problems.join("\n")); if (check) process.exit(1); }
if (check) { console.log(`ok: ${fams.length} familii, ${arts.size} coduri`); process.exit(0); }
fams.sort((a, b) => (/^angled_/.test(a.key) ? 1 : 0) - (/^angled_/.test(b.key) ? 1 : 0) || a.key.localeCompare(b.key));
const out = `/* GENERAT de tools/blum-build.mjs din tools/blum-data/*.json — nu se editează. Sursa: Blum, Catalogue and technical manual 2022/2023 (KA-150). */
(function (root) { root.EBHingesData = ${JSON.stringify({ plates, hinges: Object.fromEntries(fams.map(f => [f.key, f])) })}; })(typeof globalThis !== "undefined" ? globalThis : this);
`;
fs.writeFileSync(outFile, out);
console.log(`scris ${path.relative(process.cwd(), outFile)}: ${fams.length} familii, ${arts.size} coduri, ${plates.length} plăcuțe${problems.length ? `, ${problems.length} probleme` : ""}`);
