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

test("foaia: canale pe față și în cant apar în tabel și în desen", () => {
  const pc = { length: 800, width: 400, thickness: 19, outline: [{ x0: 0, x1: 800, y0: 0, y1: 400 }],
    operations: [{ id: "op_001", type: "slot", face: 5, x: 100, y: 9.5, len: 21, thk: 8, depth: 15, ori: "X", note: "canal domino" },
                 { id: "op_002", type: "slot", face: 4, u: 200, z: 9.5, x: 0, y: 200, len: 21, thk: 8, depth: 25, note: "canal domino" }] };
  const svg = S.partSheetSVG(pc, { face: 5, tr: k => k, opName: o => o.note, meta: {} });
  assert.ok(svg.includes(">21×8<"), "dimensiunea canalului în tabel");
  assert.ok(svg.includes("#cdb48a"), "canalul de pe față e desenat");
  assert.equal(S.groupOps(pc.operations, o => o.note).length, 2, "față și cant = două grupuri");
});

test("foaia: cod QR opțional în cartuș — fără `qr` foaia e neschimbată, cu `qr` apare pozitionat și cu codul alături", () => {
  const pc = { length: 800, width: 400, thickness: 19, outline: [{ x0: 0, x1: 800, y0: 0, y1: 400 }],
    operations: [{ id: "op_001", type: "drill", face: 5, x: 37, y: 32, dia: 5, depth: 13, through: false, note: "x" }] };
  const base = { face: 5, tr: k => k, opName: o => o.note, meta: { project: "P", name: "N", date: "d", ver: "v" } };
  const plain = S.partSheetSVG(pc, base);
  assert.ok(!plain.includes("<svg x="), "fără qr nu se adaugă nimic");
  const withQr = S.partSheetSVG(pc, Object.assign({}, base, { qr: { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h1v1z"/></svg>', code: "r12" } }));
  assert.match(withQr, /<svg x="\d+(\.\d+)?" y="\d+(\.\d+)?" width="26" height="26" xmlns/);
  assert.ok(withQr.includes(">r12<"), "codul scris alături");
  assert.equal(withQr.replace(/<svg x=[^>]*>.*?<\/svg>/s, "").replace(/<text[^>]*>r12<\/text>/, ""), plain, "în rest foaia e identică");
  const withoutCode = S.partSheetSVG(pc, Object.assign({}, base, { qr: { svg: '<svg viewBox="0 0 1 1"></svg>' } }));
  assert.ok(withoutCode.includes("<svg x="));
});
