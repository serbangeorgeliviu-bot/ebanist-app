/* Ebanist — il runner dei casi golden.
 *
 *   npm run test:golden
 *
 * Confronta pezzo per pezzo, cota per cota. Alla prima differenza stampa il
 * pezzo, il campo, quello che c'era e quello che c'e adesso: chi guarda deve
 * capire cosa si e mosso senza aprire due file.
 *
 * UN CASO NON VALIDATO NON PASSA. Se `validat` e false, il caso si conta
 * fra quelli «da validare», non fra quelli superati: un golden che nessuno
 * ha guardato certifica quello che il codice fa, non quello che deve fare.
 */
const fs = require("fs");
const path = require("path");
const { CASES, PAIRS } = require("./golden/cases.js");
const { runCase } = require("./golden/engine.js");

const DIR = path.join(__dirname, "golden");
const G = "\x1b[32m", R = "\x1b[31m", Y = "\x1b[33m", D = "\x1b[2m", Z = "\x1b[0m", B = "\x1b[1m";
let ok = 0, ko = 0, daValidare = 0, mancanti = 0;
const rotti = [];

function diffPieces(att, got) {
  const out = [];
  const n = Math.max(att.length, got.length);
  for (let i = 0; i < n; i++) {
    const a = att[i], b = got[i];
    if (!a) { out.push(`  + riga in piu: ${b.elemento} ${b.lung}×${b.larg} ×${b.pz}`); continue; }
    if (!b) { out.push(`  − riga sparita: ${a.elemento} ${a.lung}×${a.larg} ×${a.pz}`); continue; }
    for (const k of ["elemento", "role", "ax", "lung", "larg", "pz", "sp", "bordo", "wing", "shape", "seg", "mat"]) {
      const va = a[k] === undefined ? null : a[k], vb = b[k] === undefined ? null : b[k];
      if (JSON.stringify(va) !== JSON.stringify(vb))
        out.push(`  ${a.elemento}: ${k}  ${R}${JSON.stringify(va)}${Z} → ${R}${JSON.stringify(vb)}${Z}`);
    }
    if (JSON.stringify(a.ys || null) !== JSON.stringify(b.ys || null))
      out.push(`  ${a.elemento}: quote ripiani  ${JSON.stringify(a.ys || null)} → ${JSON.stringify(b.ys || null)}`);
    if (JSON.stringify(a.curve || null) !== JSON.stringify(b.curve || null))
      out.push(`  ${a.elemento}: curva  ${JSON.stringify(a.curve || null)} → ${JSON.stringify(b.curve || null)}`);
  }
  return out;
}

console.log(`\n${B}Casi golden${Z}\n`);
for (const cs of CASES) {
  const fEx = path.join(DIR, cs.name, "expected-pieces.json");
  if (!fs.existsSync(fEx)) {
    mancanti++; console.log(`  ${R}?${Z} ${cs.name}  ${D}nessun file atteso — gira: node test/golden/gen.js${Z}`);
    continue;
  }
  const att = JSON.parse(fs.readFileSync(fEx, "utf8"));
  let got;
  try { got = runCase(cs); }
  catch (e) { ko++; rotti.push(cs.name); console.log(`  ${R}✗${Z} ${cs.name}  ${R}errore: ${e.message}${Z}`); continue; }

  const d = diffPieces(att.pieces, got.pieces);
  /* anche la geometria derivata e i due controlli fanno parte del golden:
     una distinta identica calcolata da cote interne diverse e un caso che
     si e mosso e si e rimesso a posto per caso. */
  if (JSON.stringify(att.geometrie) !== JSON.stringify(got.geom))
    d.push(`  cote derivate: ${JSON.stringify(att.geometrie)} → ${JSON.stringify(got.geom)}`);
  if (att.chiusura_ok !== ((got.chiusura || []).length === 0))
    d.push(`  chiusura del gabarito: ${att.chiusura_ok} → ${(got.chiusura || []).length === 0} ${JSON.stringify(got.chiusura)}`);
  if (att.invarianti_ok !== ((got.invarianti || []).length === 0))
    d.push(`  invarianti: ${att.invarianti_ok} → ${(got.invarianti || []).length === 0} ${JSON.stringify(got.invarianti)}`);

  if (d.length) {
    ko++; rotti.push(cs.name);
    console.log(`  ${R}✗${Z} ${cs.name}  ${D}${d.length} differenze${Z}`);
    for (const l of d.slice(0, 12)) console.log(l);
    if (d.length > 12) console.log(`  ${D}… e altre ${d.length - 12}${Z}`);
  } else if (!att.validat) {
    daValidare++;
    console.log(`  ${Y}?${Z} ${cs.name}  ${D}${att.n_randuri} righe · ${att.n_piese} pz · da validare a mano${Z}`);
  } else {
    ok++;
    console.log(`  ${G}✓${Z} ${cs.name}  ${D}${att.n_randuri} righe · ${att.n_piese} pz${Z}`);
  }
}

/* --- le coppie 18/19 ---------------------------------------------------
   Non basta che i due casi siano stabili: devono essere DIVERSI nel modo
   giusto. Il gabarito esterno non si muove, le cote interne si. */
console.log(`\n${B}Coppie 18 / 19${Z}\n`);
let pOk = 0, pKo = 0;
for (const [a, b] of PAIRS) {
  const ca = CASES.find(x => x.name === a), cb = CASES.find(x => x.name === b);
  const ra = runCase(ca), rb = runCase(cb);
  const by = (r, role) => r.pieces.find(p => p.role === role);
  const f1 = by(ra, "fianco"), f2 = by(rb, "fianco");
  const b1 = by(ra, "base_cielo") || by(ra, "base"), b2 = by(rb, "base_cielo") || by(rb, "base");
  const gabarit = f1.lung === f2.lung && f1.larg === f2.larg &&
                  (b1.lung + 2 * 18) === (b2.lung + 2 * 19);
  const mossi = ["base_cielo", "base", "ripiano", "divisorio", "schienale", "zoccolo"]
    .filter(role => by(ra, role) && by(rb, role) &&
      (by(ra, role).lung !== by(rb, role).lung || by(ra, role).larg !== by(rb, role).larg));
  const bene = gabarit && mossi.length >= 2;
  if (bene) pOk++; else pKo++;
  console.log(`  ${bene ? G + "✓" : R + "✗"}${Z} ${a} / ${b}  ${D}gabarit ${gabarit ? "fermo" : "MOSSO"} · ` +
              `cote interne mosse: ${mossi.join(", ") || "NESSUNA"}${Z}`);
}

console.log("");
if (mancanti) console.log(`${R}${mancanti} casi senza file atteso${Z}`);
if (daValidare) console.log(`${Y}${daValidare} casi generati ma NON ANCORA VALIDATI a mano — non contano come superati${Z}`);
console.log(`${B}${ok + pOk}/${CASES.length + PAIRS.length} superati${Z}` +
            (ko + pKo ? `  ${R}${ko + pKo} caduti: ${rotti.join(", ")}${Z}` : "") + "\n");
process.exit((ko + pKo + mancanti) ? 1 : 0);
