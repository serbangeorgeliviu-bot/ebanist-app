/* Il foglio di validazione: tutti i casi, tutte le cote, in Markdown.
 * Serve a UNA cosa — farli guardare a mano prima che diventino golden. */
const fs = require("fs"), path = require("path");
const { CASES, PAIRS } = require("./cases.js");
const DIR = __dirname;
const L = [];
const doc = n => JSON.parse(fs.readFileSync(path.join(DIR, n, "expected-pieces.json"), "utf8"));

L.push("# Casuri golden — foaie de validare\n");
L.push("Generat cu codul curent. **Niciunul nu e golden până nu îl confirmi.**");
L.push("Ce verifici: cotele să fie cele pe care le-ai tăia tu, cu grosimea scrisă pe rând.\n");
L.push("## Sinteză\n");
L.push("| # | caz | L×H×P | grosimi | spate | rânduri | buc | închidere | invarianți |");
L.push("|---|---|---|---|---|---|---|---|---|");
for (const cs of CASES) {
  const d = doc(cs.name), g = d.geometrie;
  const sp = g ? [...new Set(Object.values(g.sp))].sort((a, b) => a - b).join("/") : "—";
  L.push(`| ${cs.name.slice(0, 2)} | \`${cs.name.slice(3)}\` | ${cs.cfg.L}×${cs.cfg.H}×${cs.cfg.P} | ${sp} | ${g ? g.tip_schienale : "—"} | ${d.n_randuri} | ${d.n_piese} | ${d.chiusura_ok ? "✓" : "✗"} | ${d.invarianti_ok ? "✓" : "✗"} |`);
}
L.push("\n## Perechile 18 / 19 — gabaritul nu se mișcă, cotele interne da\n");
for (const [a, b] of PAIRS) {
  const A = doc(a), B = doc(b);
  L.push(`### ${a} → ${b}\n`);
  L.push("| rol | 18 mm | 19 mm | Δ |");
  L.push("|---|---|---|---|");
  const roles = [...new Set(A.pieces.map(p => p.role).filter(Boolean))];
  for (const r of roles) {
    const x = A.pieces.find(p => p.role === r), y = B.pieces.find(p => p.role === r);
    if (!x || !y) continue;
    const dl = y.lung - x.lung, dg = y.larg - x.larg;
    L.push(`| ${r} | ${x.lung}×${x.larg} | ${y.lung}×${y.larg} | ${dl || dg ? `${dl >= 0 ? "+" : ""}${dl} / ${dg >= 0 ? "+" : ""}${dg}` : "— (neschimbat)"} |`);
  }
  L.push("");
}
L.push("\n## Fiecare caz, rând cu rând\n");
for (const cs of CASES) {
  const d = doc(cs.name), g = d.geometrie;
  L.push(`### ${cs.name}\n`);
  L.push(`\`${cs.cfg.type}\` · **${cs.cfg.L}×${cs.cfg.H}×${cs.cfg.P}** · soclu ${cs.cfg.plinth} · ${cs.cfg.support}` +
         (cs.cfg.tram ? ` · ${cs.cfg.tram} tramezzi` : "") +
         (cs.cfg.shelves ? ` · ${cs.cfg.shelves} polițe` : "") +
         (cs.cfg.drawers ? ` · ${cs.cfg.drawers} sertare (${cs.cfg.drawerSys})` : "") +
         (cs.cfg.doors ? ` · ${cs.cfg.doors} uși (${cs.cfg.front})` : "") +
         (cs.cfg.hang ? " · bară" : "") + "\n");
  if (g) L.push(`Interior: **L ${g.L_int} · H ${g.H_int} · P ${g.P_int}** · spate ${g.tip_schienale}` +
                (g.sectiune_W ? ` · secțiune ${g.sectiune_W}` : "") + "\n");
  L.push("| element | rol | axe | lung | lăț | buc | sp | cant |");
  L.push("|---|---|---|---|---|---|---|---|");
  for (const p of d.pieces)
    L.push(`| ${p.elemento}${p.wing ? " (" + p.wing + ")" : ""} | ${p.role || "—"} | ${p.ax || "—"} | **${p.lung}** | **${p.larg}** | ${p.pz} | ${p.sp == null ? "—" : p.sp} | ${p.bordo || "—"} |`);
  L.push("");
}
fs.writeFileSync(path.join(DIR, "VALIDARE.md"), L.join("\n") + "\n");
console.log("scris test/golden/VALIDARE.md — " + CASES.length + " casuri");
