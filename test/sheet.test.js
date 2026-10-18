/* ebanist-sheet.js — lanțul de cote și foaia A3 (pur, fără DOM) */
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "../app/ebanist-sheet.js"), "utf8");
const S = new Function(src + "\nreturn globalThis.EBSheet;")();

test("lanț: pașii egali (≥3) se strâng în n×pas", () => {
  const c = S.chainSegs([100, 132, 164, 196, 228], 600);
  assert.deepStrictEqual(c.segs.map(s => s.label), ["100", "4×32", "372"]);
  assert.ok(c.segs.some(s => s.label === "4×32" && s.run));
  assert.strictEqual(c.segs[0].a, 0); assert.strictEqual(c.segs[c.segs.length - 1].b, 600);
});
test("lanț: cota de la muchie la prima axă e primul segment", () => {
  const c = S.chainSegs([22.5, 100], 495);
  assert.deepStrictEqual(c.segs.map(s => s.label), ["22.5", "77.5", "395"]);
});
test("scara: cea mai mare standard la care încape", () => {
  assert.strictEqual(S.pickScale(290, 200, 2200, 600), 8);
  assert.strictEqual(S.pickScale(290, 200, 200, 100), 1);
});
test("foaia: SVG A3, cote și etichete din piesă, texte prin tr()", () => {
  const pc = { length: 800, width: 400, thickness: 19, outline: [{ x0: 0, x1: 800, y0: 0, y1: 400 }],
    operations: [{ id: "op_001", type: "drill", face: 5, x: 37, y: 32, dia: 5, depth: 13, through: false, note: "x" },
                 { id: "op_002", type: "drill", face: 5, x: 37, y: 64, dia: 5, depth: 13, through: false, note: "x" }] };
  const svg = S.partSheetSVG(pc, { face: 5, tr: k => "«" + k + "»", opName: o => o.note, meta: { project: "<b>", name: "N", date: "d", ver: "v" } });
  assert.match(svg, /viewBox="0 0 420 297"/);
  assert.ok(svg.includes("«shTitle»") && svg.includes("«shMat»"));
  assert.ok(!svg.includes("<b>"), "textul utilizatorului e scăpat");
  assert.ok(svg.includes(">800<") && svg.includes(">400<") && svg.includes(">37<") && svg.includes(">32<"));
});
