/* Genera (o rigenera) i file attesi dei casi golden.
 *
 *   node test/golden/gen.js            solo i casi che non esistono ancora
 *   node test/golden/gen.js --force    riscrive TUTTO, anche i validati
 *
 * Le cote attese NON si scrivono a mano e non si inventano: escono dal
 * codice corrente. Ma uscire dal codice non le rende giuste — le rende
 * COERENTI col codice, che e un'altra cosa. Per questo nascono con
 * `validat: false` e restano fuori dal conto finche qualcuno non le guarda
 * una per una e mette `true`. Un golden sbagliato certifica il guasto.
 */
const fs = require("fs");
const path = require("path");
const { CASES } = require("./cases.js");
const { runCase } = require("./engine.js");

const DIR = __dirname;
const force = process.argv.includes("--force");
let nuovi = 0, riscritti = 0, saltati = 0;

for (const cs of CASES) {
  const dir = path.join(DIR, cs.name);
  fs.mkdirSync(dir, { recursive: true });
  const fIn = path.join(dir, "input.json");
  const fEx = path.join(dir, "expected-pieces.json");

  fs.writeFileSync(fIn, JSON.stringify({ nume: cs.name, cfg: cs.cfg, settings: cs.settings }, null, 1) + "\n");

  let vecchio = null;
  if (fs.existsSync(fEx)) { try { vecchio = JSON.parse(fs.readFileSync(fEx, "utf8")); } catch (e) {} }
  if (vecchio && vecchio.validat && !force) { saltati++; continue; }

  const r = runCase(cs);
  const doc = {
    /* IL SEMAFORO. Finche e false, il runner non conta questo caso come
       superato: lo segnala come «da validare». */
    validat: (vecchio && vecchio.validat) || false,
    nume: cs.name,
    generat: new Date().toISOString().slice(0, 10),
    nota: "Cote generate cu codul curent. NU sunt golden până nu sunt verificate manual și `validat` nu devine true.",
    geometrie: r.geom,
    chiusura_ok: (r.chiusura || []).length === 0,
    invarianti_ok: (r.invarianti || []).length === 0,
    n_randuri: r.pieces.length,
    n_piese: r.pieces.reduce((a, p) => a + p.pz, 0),
    pieces: r.pieces
  };
  fs.writeFileSync(fEx, JSON.stringify(doc, null, 1) + "\n");
  if (vecchio) riscritti++; else nuovi++;
}
console.log(`golden: ${nuovi} nuovi, ${riscritti} riscritti, ${saltati} gia validati (lasciati com'erano)`);
