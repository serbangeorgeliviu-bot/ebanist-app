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
test("foaia: SVG A4 landscape (implicit), cote și etichete din piesă, texte prin tr()", () => {
  const pc = { length: 800, width: 400, thickness: 19, outline: [{ x0: 0, x1: 800, y0: 0, y1: 400 }],
    operations: [{ id: "op_001", type: "drill", face: 5, x: 37, y: 32, dia: 5, depth: 13, through: false, note: "x" },
                 { id: "op_002", type: "drill", face: 5, x: 37, y: 64, dia: 5, depth: 13, through: false, note: "x" }] };
  const svg = S.partSheetSVG(pc, { face: 5, tr: k => "«" + k + "»", opName: o => o.note, meta: { project: "<b>", name: "N", date: "d", ver: "v" } });
  assert.match(svg, /viewBox="0 0 297 210"/);
  assert.match(svg, /width="297mm" height="210mm"/);
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
  assert.match(withQr, /<svg x="\d+(\.\d+)?" y="\d+(\.\d+)?" width="18" height="18" xmlns/);
  assert.ok(withQr.includes(">r12<"), "codul scris alături");
  assert.equal(withQr.replace(/<svg x=[^>]*>.*?<\/svg>/s, "").replace(/<text[^>]*>r12<\/text>/, ""), plain, "în rest foaia e identică");
  const withoutCode = S.partSheetSVG(pc, Object.assign({}, base, { qr: { svg: '<svg viewBox="0 0 1 1"></svg>' } }));
  assert.ok(withoutCode.includes("<svg x="));
});

test("foaia: piesă tăiată în bucăți — tăieturile punctate, mărimile bucăților și nota (A3 audit 14.11)", () => {
  const pc = { length: 2098, width: 1778, thickness: 3, outline: [{ x0: 0, x1: 2098, y0: 0, y1: 1778 }], operations: [] };
  const o = { face: 5, tr: k => k === "shSegNote" ? "Cut {n}: {sizes} mm" : k, opName: x => x.note, meta: {} };
  const plain = S.partSheetSVG(pc, o), cut = S.partSheetSVG(pc, Object.assign({}, o, { segs: { axis: "L", sizes: [702, 694, 702] } }));
  assert.ok(!plain.includes("Cut 3"), "fără segs nimic nu se adaugă");
  assert.ok(cut.includes("Cut 3: 702 + 694 + 702 mm"), "nota cu bucățile");
  assert.equal((cut.match(/stroke-dasharray="3 1.5"/g) || []).length, 2, "două tăieturi pentru trei bucăți");
  assert.ok(cut.includes(">694<") && cut.includes(">702<"), "mărimile bucăților");
  const one = S.partSheetSVG(pc, Object.assign({}, o, { segs: { axis: "L", sizes: [2098] } }));
  assert.equal(one, plain, "o singură bucată = foaia obișnuită");
});

test("foaia: A4 încape — nimic din text nu iese din foaie, nici cu nume lungi și 2 fețe", () => {
  const ops = [];
  for (let i = 0; i < 14; i++) ops.push({ id: "op_a" + i, type: "drill", face: 5, x: 37 + i * 32, y: 32, dia: 5, depth: 13, through: false, note: "perno minifix cu un nume foarte lung" });
  ops.push({ id: "op_b", type: "drill", face: 6, x: 100, y: 100, dia: 8, depth: 12, through: false, note: "tassello" });
  const pc = { length: 2200, width: 600, thickness: 18, outline: [{ x0: 0, x1: 2200, y0: 0, y1: 600 }], operations: ops };
  const svg = S.partSheetSVG(pc, { face: 5, tr: k => k, opName: o => o.note, meta: { project: "Proiect cu un nume extrem de lung ca să încerce să iasă din celulă", name: "Fianco stânga cu un nume la fel de lung", material: "Egger W1000 ST9 Alb Premium extra lung", client: "Client Foarte Lung SRL", date: "2026-11-14", ver: "5.63.0" }, qr: { svg: '<svg viewBox="0 0 1 1"></svg>', code: "r1" } });
  const top = svg.replace(/<g [^>]*>.*?<\/g>/gs, ""); /* grupurile rotite au coordonate locale */
  const xs = [...top.matchAll(/<text x="([\d.]+)"/g)].map(m => +m[1]);
  assert.ok(xs.every(x => x >= 0 && x <= 297), "text în afara foii");
  const ys = [...top.matchAll(/<text x="[\d.-]+" y="([\d.-]+)"/g)].map(m => +m[1]);
  assert.ok(ys.every(y => y >= 0 && y <= 210), "text sub foaie");
  assert.ok(!svg.includes("extrem de lung ca să încerce să iasă din celulă"), "valorile lungi se taie în celulă");
});

test("foaia: cu size A3 rămâne foaia de 420 × 297 (dosarul tehnic A3)", () => {
  const pc = { length: 800, width: 400, thickness: 19, outline: [{ x0: 0, x1: 800, y0: 0, y1: 400 }], operations: [] };
  const a3 = S.partSheetSVG(pc, { face: 5, tr: k => k, opName: o => o.note, meta: {}, size: "A3" });
  assert.match(a3, /viewBox="0 0 420 297"/);
  assert.match(S.partSheetSVG(pc, { face: 5, tr: k => k, opName: o => o.note, meta: {}, size: "A4" }), /viewBox="0 0 297 210"/);
});

test("sigla firmei: în celula Firmă când există, absentă când nu (5.80.0)", () => {
  const pc = { length: 800, width: 400, thickness: 19, outline: [{ x0: 0, x1: 800, y0: 0, y1: 400 }], operations: [] };
  const mk = logo => S.partSheetSVG(pc, { face: 5, tr: k => k, opName: o => "", meta: { company: "Domus", logo, project: "P", name: "N", date: "d", ver: "v" } });
  const a = mk("data:image/png;base64,AAAA"), b = mk("");
  assert.match(a, /<image href="data:image\/png;base64,AAAA"/);
  assert.ok(!/<image href="data:image\/png/.test(b));
  assert.ok(!/<image /.test(S.partSheetSVG(pc, { face: 5, tr: k => k, opName: o => "", meta: { company: "Domus", project: "P", name: "N", date: "d", ver: "v" } })));
});
