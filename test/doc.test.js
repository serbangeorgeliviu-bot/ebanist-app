/* ebanist-doc.js — copertă, prezentare client, raport tehnic (pur, fără DOM) */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const rd = f => fs.readFileSync(path.join(__dirname, "../app", f), "utf8");
const S = new Function(rd("ebanist-sheet.js") + "\n" + rd("ebanist-doc.js") + "\nreturn globalThis.EBDoc;")();
const tr = k => "«" + k + "»";
const meta = { project: "<b>P</b>", client: "C", date: "d", ver: "v" };

test("coperta: A3, cuprins, cum se citește, text utilizator scăpat, imagine", () => {
  const svg = S.coverSheetSVG({ projectName: "<img>X", clientName: "Mme <i>", units: [["U1", "1 × 2 × 3 mm"]], index: [[1, "Cover", "all"], ["2–31", "Fișe ×30", "shop"]],
    read: ["r1", "r2"], about: ["a1"], heroImg: "data:image/jpeg;base64,AAAA", unit: "P", material: "", thick: "" }, { tr, meta });
  assert.match(svg, /viewBox="0 0 420 297"/);
  for (const k of ["dcCover", "dcFor", "dcUnits", "dcContents", "dcRead", "dcAbout", "dcAudience"]) assert.ok(svg.includes("«" + k + "»"), k);
  assert.ok(svg.includes("<image href=\"data:image/jpeg;base64,AAAA\"") && svg.includes("2–31"));
  assert.ok(!svg.includes("<img>") && !svg.includes("<b>P</b>") && !svg.includes("<i>"));
});
test("coperta: logo-ul utilizatorului intră în foaie", () => {
  const svg = S.coverSheetSVG({ projectName: "P", logo: "data:image/png;base64,BBBB", unit: "P" }, { tr, meta });
  assert.ok(svg.includes("data:image/png;base64,BBBB"));
});
test("prezentare client: imagini, materiale cu culoare, semnătură", () => {
  const svg = S.clientSheetSVG({ unit: "Dulap", clientName: "Mme X", heroImg: "data:image/jpeg;base64,H", img2: "data:image/jpeg;base64,I", img3: null,
    facts: [["Dim", "1 × 2 × 3 mm"]], materials: [["Body", "Alb · 19 mm", "#f4f4f0"]], highlights: ["10 × Blum", "2 × maner"], unit2: "", material: "M", thick: "19 mm" }, { tr, meta });
  assert.match(svg, /viewBox="0 0 420 297"/);
  for (const k of ["dcClientKicker", "dcMaterials", "dcIncluded", "dcApprove", "dcSign", "dcColorNote", "dcClientTitle"]) assert.ok(svg.includes("«" + k + "»"), k);
  assert.ok(svg.includes('fill="#f4f4f0"') && svg.includes("10 × Blum") && svg.includes(">Dulap<"));
  assert.ok(svg.includes("data:image/jpeg;base64,H") && svg.includes("data:image/jpeg;base64,I"));
});
test("raport: capitolele pe coloane, fără ieșire din foaie, font care scade", () => {
  const big = Array.from({ length: 12 }, (_, i) => ({ h: "Cap " + i, lines: Array.from({ length: 10 }, (_, k) => "Rând lung de text numărul " + k + " care trebuie împărțit pe mai multe rânduri în coloană") }));
  const svg = S.reportSheetSVG({ unit: "U", chapters: big }, { tr, meta });
  const ys = [...svg.matchAll(/<text x="[\d.]+" y="([\d.]+)"[^>]*>Rând lung/g)].map(m => +m[1]);
  assert.ok(ys.length > 50, "rânduri: " + ys.length);
  assert.ok(Math.max(...ys) < 257, "deasupra cartușului: " + Math.max(...ys));
  const xs = new Set([...svg.matchAll(/<text x="([\d.]+)" y="[\d.]+"[^>]*>Cap \d/g)].map(m => m[1]));
  assert.ok(xs.size >= 2 && xs.size <= 3, "coloane: " + xs.size);
});
test("raport: textul din capitole e scăpat", () => {
  const svg = S.reportSheetSVG({ unit: "U", chapters: [{ h: "<b>H</b>", lines: ["<script>x</script>"] }] }, { tr, meta });
  assert.ok(!svg.includes("<script>") && !svg.includes("<b>H</b>"));
});
