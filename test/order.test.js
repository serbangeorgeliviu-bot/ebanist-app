/* ebanist-order.js — lista de feronerie pe mărci, pentru furnizor (pur) */
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const O = new Function(fs.readFileSync(path.join(__dirname, "../app/ebanist-order.js"), "utf8") + "\nreturn globalThis.EBOrder;")();
const rows = [
  { qty: 8, prod: { brand: "Blum", art: "71B3550", name: "Balama CLIP top" } },
  { qty: 4, prod: { brand: "Häfele", art: "262.60.710", name: "Minifix 15" } },
  { qty: 6, prod: { brand: "Blum", art: "71B3550", name: "Balama CLIP top" } },
  { qty: 2, prod: { brand: "Blum", art: "", name: "Mâner" } },
  { qty: 3, prod: { name: "Picior" } },
  { qty: 0, prod: { brand: "Blum", art: "X", name: "zero" } },
  { qty: 1.256, prod: { brand: "Emuca", art: "5220", name: "Gola" } }
];
test("grupe pe marcă: A–Z, fără marcă la urmă, articole identice însumate, cantitățile zero ies", () => {
  const g = O.group(rows);
  assert.deepStrictEqual(g.map(x => x.brand), ["Blum", "Emuca", "Häfele", "—"]);
  assert.deepStrictEqual(g[0].items, [{ art: "71B3550", name: "Balama CLIP top", qty: 14 }, { art: "", name: "Mâner", qty: 2 }]);
  assert.strictEqual(g[1].items[0].qty, 1.26);
});
test("textul nu inventează coduri și nu scrie prețuri", () => {
  const t = O.text(O.group(rows), { header: "Comandă", project: "Bucătărie", company: "Domus", date: "2026-11-17", note: "Verificați codurile" });
  assert.match(t, /^Comandă — Bucătărie\nDomus\n2026-11-17\n\nBlum\n14 × 71B3550 — Balama CLIP top\n2 × Mâner\n/);
  assert.ok(!/€|EUR|price/i.test(t)); assert.match(t, /Verificați codurile\n$/);
});
test("CSV cu ; și ghilimele duble corecte", () => {
  const c = O.csv(O.group([{ qty: 2, prod: { brand: "Blum", art: "A;1", name: 'Șină "XL"' } }]));
  assert.strictEqual(c, 'brand;code;name;qty\r\nBlum;"A;1";"Șină ""XL""";2\r\n');
});
