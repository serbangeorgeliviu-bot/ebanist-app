#!/usr/bin/env node
/* Registrul de verificare al cotelor de găurire (D-48): scoate din HW_DRILL fiecare valoare
   cu calea, sursa declarată (dacă există) și un loc gol pentru valoarea măsurată pe piesa reală.
   Nu verifică nimic: pregătește foaia pe care o completează cine ține piesa în mână.
   Rulează: node tools/hw-registry.js [md|csv] > fișier */
const vm = require("node:vm"), fs = require("node:fs"), path = require("node:path");
const ctx = vm.createContext({});
ctx.globalThis = ctx;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "app", "ebanist-ops.js"), "utf8"), ctx);
const D = ctx.HW_DRILL;
if (!D) { console.error("HW_DRILL nu s-a găsit"); process.exit(1); }

/* valorile de ramă din modulul lambriului (D-100): date generice, nevalidate, de măsurat pe o ramă reală */
{ const c2 = vm.createContext({}); vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "app", "ebanist-lambriu.js"), "utf8"), c2);
  if (c2.EBLambriu && c2.EBLambriu.INSET) D.panouIncastrat = { gd: c2.EBLambriu.INSET.gd, minLeft: c2.EBLambriu.INSET.minLeft, src: "generic, de măsurat pe o ramă reală (D-100)" }; }
/* piesa cu contur liber v2 (D-102): puntea minimă de material, diametrul până la care se burghiază, lățimea maximă a canalului, restul sub canal */
{ const c3 = vm.createContext({}); vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "app", "ebanist-contour.js"), "utf8"), c3);
  if (c3.EBContour) {
    D.gauriContur = { minWeb: c3.EBContour.HOLE.minWeb, drillMax: c3.EBContour.HOLE.drillMax, src: "generic, de măsurat pe o piesă reală (D-102)" };
    D.canaleContur = { maxW: c3.EBContour.GROOVE.maxW, keep: c3.EBContour.GROOVE.keep, src: "generic, de măsurat pe o piesă reală (D-102)" };
  } }
const UNIT = { minWeb: "mm", drillMax: "mm", maxW: "mm", keep: "mm", gd: "mm", minLeft: "mm", dia: "mm", depth: "mm", dist: "mm", len: "mm", thk: "mm", end: "mm", pitch: "mm", offset: "mm", spacing: "mm", front: "mm", from_edge: "mm", from_top: "mm", w: "mm", d: "mm", ang: "°" };
const GROUPS = {
  sys32: "Sistem 32", hinge: "Balama cu cupă (Blum 45/9,5)", minifix: "Minifix / Rafix", dowel: "Dibluri", joints: "Alte îmbinări",
  pin: "Suport raft", slide: "Glisiere sertar", handle: "Mânere", golaFresata: "Gola frezată", antiwarp: "Profil anti-curbare", fold: "Balama pliantă", panouIncastrat: "Panou încastrat în ramă (canal)", gauriContur: "Piesa cu contur liber — găuri și decupaje", canaleContur: "Piesa cu contur liber — canale"
};
const rows = [];
(function walk(o, p, grp, srcIn) {
  Object.keys(o).forEach(k => {
    const v = o[k], path = p.concat(k), g = grp || k;
    if (k === "verificat" || k === "src") return;
    if (v && typeof v === "object" && !Array.isArray(v)) { walk(v, path, g, v.src || srcIn); return; }
    const val = Array.isArray(v) ? JSON.stringify(v) : v;
    const unit = Object.keys(UNIT).find(u => k === u || k.endsWith("_" + u) || k.startsWith(u + "_")) ? UNIT[Object.keys(UNIT).find(u => k === u || k.endsWith("_" + u) || k.startsWith(u + "_"))] : "";
    rows.push({ grup: GROUPS[g] || g, cale: path.join("."), valoare: val, unit, sursa: srcIn || "" });
  });
})(D, [], "", "");

const mode = process.argv[2] || "md";
if (mode === "csv") {
  console.log("grup;cale;valoare;unitate;sursa;masurat;instrument;data;verificat_de");
  rows.forEach(r => console.log([r.grup, r.cale, r.valoare, r.unit, r.sursa, "", "", "", ""].map(x => '"' + String(x).replace(/"/g, '""') + '"').join(";")));
} else {
  const by = {}; rows.forEach(r => (by[r.grup] = by[r.grup] || []).push(r));
  console.log("# Registrul de verificare a cotelor de găurire (HW_DRILL)\n");
  console.log(`Generat din \`app/ebanist-ops.js\` · ${rows.length} valori · starea globală: \`verificat: ${D.verificat}\`\n`);
  console.log("Nicio valoare de mai jos nu merge într-o mașină până nu e măsurată pe o piesă reală și bifată. Cum: se găurește o piesă de probă după fișa piesei din Ebanist, se măsoară cu șublerul (diametru, adâncime) și cu ruleta/calibrul (distanțe), se trece valoarea măsurată și data. Dacă diferă, se corectează valoarea din `HW_DRILL` și se rulează `node --test ops.test.js`; abia apoi se trece `verificat` pe grupul respectiv.\n");
  Object.keys(by).forEach(g => {
    console.log(`## ${g}\n`);
    console.log("| Cale | Valoare | Unitate | Sursă declarată | Măsurat | Data / semnătură |\n|---|---|---|---|---|---|");
    by[g].forEach(r => console.log(`| \`${r.cale}\` | ${r.valoare} | ${r.unit} | ${r.sursa || "—"} | | |`));
    console.log("");
  });
}
