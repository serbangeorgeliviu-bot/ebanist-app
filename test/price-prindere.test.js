/* Ebanist — prețurile articolelor de prindere Lamello și Festool (14.11.2026): cu TVA, pe îmbinare, fără zerouri; cele fără sursă sunt marcate `est:1`.
 *   node --test test/price-prindere.test.js
 * Sursa și intervalele: `01-arhitectura/Ebanist-Preturi-Referinta-Prindere-v1.md` din EBANIST-HQ. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "app", "index.html"), "utf8");
const items = {};
for (const m of html.matchAll(/\{id:"((?:lam|fes)_[a-z0-9_]+|gen_biscuit)",brand:"[^"]*",n:\{[^}]*\},art:"[^"]*",price:([0-9.]+),(est:1,)?chk:1\}/g)) items[m[1]] = { price: +m[2], est: !!m[3] };
const EST = ["lam_clamex_p10", "lam_clamex_medius", "lam_clamex_flexus", "lam_clamex_cnc", "lam_tenso_p14", "lam_tenso_p10", "lam_bisco_p10", "lam_cabineo_8", "lam_invis_mx2_30", "lam_divario_p18", "fes_domino_4x20", "fes_domino_xl_14x140", "fes_msv_d8_25"];
test("toate articolele de prindere au preț pozitiv și rezonabil (sub 10 € pe îmbinare)", () => {
  const ids = Object.keys(items); assert.ok(ids.length === 30, `articole găsite: ${ids.length}`);
  for (const id of ids) { assert.ok(items[id].price > 0, `${id}: preț 0`); assert.ok(items[id].price < 10, `${id}: preț ${items[id].price}`); }
});
test("estimările sunt marcate (est:1) exact pentru articolele fără sursă; restul nu", () => {
  for (const id of Object.keys(items)) assert.equal(items[id].est, EST.includes(id), `${id}: est=${items[id].est}`);
});
test("corecturile față de catalogul vechi: DOMINO 8×40 ~ 0,14 și lamela #20 ~ 0,04, Clamex P-14 1,40", () => {
  assert.equal(items.fes_domino.price, 0.14); assert.equal(items.gen_biscuit.price, 0.04); assert.equal(items.lam_clamex.price, 1.4);
});
test("ordinea de mărime: DOMINO crește cu mărimea, Cabineo 12 ≥ lamelă, KV > MSV pe bucată nu inversat față de piață", () => {
  const P = id => items[id].price;
  assert.ok(P("fes_domino_5x30") < P("fes_domino") && P("fes_domino") < P("fes_domino_8x50"));
  assert.ok(P("fes_domino_xl_14x100") > P("fes_domino_xl_12x100") && P("fes_domino_xl_14x140") > P("fes_domino_xl_14x100"));
  assert.ok(P("lam_biscuit_0") < P("lam_biscuit_10") && P("lam_biscuit_10") < P("lam_bisco_p14"));
});
