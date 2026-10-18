/* ebanist-asm.js — foaia A3 de montaj (pur, fără DOM) */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const rd = f => fs.readFileSync(path.join(__dirname, "../app", f), "utf8");
const S = new Function(rd("ebanist-sheet.js") + "\n" + rd("ebanist-asm.js") + "\nreturn globalThis.EBAsm;")();

test("wrap: rânduri de cel mult max caractere, fără să rupă cuvinte", () => {
  const l = S.wrap("aaa bbb ccc ddd eee", 8);
  assert.deepEqual(l, ["aaa bbb", "ccc ddd", "eee"]);
  assert.deepEqual(S.wrap("", 5), []);
});
test("etichete: nu pe margine, nu cutii de sertar, nu două peste aceeași piesă", () => {
  const k = S.keepLabels([{ n: 1, x: .5, y: .5, role: "fianco" }, { n: 2, x: .501, y: .5, role: "fianco" }, { n: 3, x: .01, y: .5 },
    { n: 4, x: .6, y: .6, role: "cassetto_fianco" }, { n: 5, x: .8, y: .8, role: "ripiano" }]);
  assert.deepEqual(k.map(l => l.n), [1, 5]);
});
const D = { name: "N", dims: "1 × 2 × 3 mm", material: "M", kg: 12.4, image: { img: "data:image/png;base64,AAAA", labels: [{ n: 7, x: .5, y: .5, role: "fianco" }] },
  parts: [[1, "Side", "2200", "600", "19", "2L+2C"], [2, "<img>", "10", "10", "19", "1L"]], hw: [["Hinges", "Blum", "71B3550", 10]],
  steps: ["Unpack the parts", "Fit the hinges"], tools: ["Screwdriver", "Level"] };
test("foaia: A3, poziții, imagine, texte prin tr(), text utilizator scăpat", () => {
  const svg = S.assemblySheetSVG(D, { tr: k => "«" + k + "»", meta: { project: "<b>", date: "d", ver: "v" } });
  assert.match(svg, /viewBox="0 0 420 297"/);
  for (const k of ["asView", "asNote", "mStepsT", "mParts", "hardware", "mTools", "asTitle", "eaUnit", "mWeight"]) assert.ok(svg.includes("«" + k + "»"), k);
  assert.ok(svg.includes("<image href=\"data:image/png;base64,AAAA\""), "imaginea explodată");
  assert.ok(svg.includes(">7<"), "balon de poziție");
  assert.ok(!svg.includes("<img>") && !svg.includes("<b>"));
  assert.ok(svg.includes("≈ 12 kg") && svg.includes(">2200<") && svg.includes("Unpack the parts"));
});
test("foaia: fără imagine WebGL folosește SVG-ul de rezervă", () => {
  const svg = S.assemblySheetSVG({ ...D, image: null, imageSvg: { viewBox: "0 0 10 10", inner: "<rect id=\"fb\" width=\"10\" height=\"10\"/>" } }, { tr: k => k, meta: {} });
  assert.ok(svg.includes('id="fb"') && !svg.includes("<image "));
});
test("mulți pași: corpul scade, nu iese din foaie", () => {
  const steps = Array.from({ length: 40 }, (_, i) => "Pas lung numărul " + i + " cu mult text care se întinde pe mai multe rânduri ca să umple coloana");
  const svg = S.assemblySheetSVG({ ...D, steps }, { tr: k => k, meta: {} });
  const ys = [...svg.matchAll(/<text x="[\d.]+" y="([\d.]+)"[^>]*>Pas lung/g)].map(m => +m[1]);
  assert.ok(ys.length > 20 && Math.max(...ys) < 257, "ultimul pas deasupra cartușului: " + Math.max(...ys));
});
