/* Modul Șantier: logica pură (app/ebanist-site.js, D-192).
 *
 *   cd test && node --test site.test.js
 */
const { test, describe } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-site.js"), "utf8");
const S = new Function("globalThis", SRC.replace(/\}\)\(typeof globalThis[^\n]*\n?$/, "})(globalThis);\n") + "\nreturn globalThis.EBSite;")({});

const P = { pieces: [
  { modulo: "A", pz: 2 }, { modulo: "A", pz: 1 }, { modulo: "B", pz: 4 },
  { modulo: "A", pz: 5, role: "accessorio" }, { modulo: "", pz: 3 }, { pz: 1 }
] };
const isAcc = x => x.role === "accessorio";

describe("norm: o formă curată din orice", () => {
  test("lipsă / gunoi → gol", () => {
    for (const bad of [undefined, null, 5, "x", [], {}])
      assert.deepStrictEqual(S.norm(bad), { mounted: {}, check: {}, defects: [], receipt: null });
  });
  test("păstrează ce e valid, aruncă restul", () => {
    const n = S.norm({ mounted: { A: 5, B: 0, C: "x" }, check: { 1: true, 2: false, 9: true }, defects: [{ id: 1, text: "  zgârietură ", at: 7 }, { id: 2, text: "  " }, null],
      receipt: { name: "Mario Rossi", sig: "data:x", at: 9, mounted: 1, total: 2, partial: true } });
    assert.deepStrictEqual(n.mounted, { A: 5 });
    assert.deepStrictEqual(n.check, { 1: true });
    assert.deepStrictEqual(n.defects, [{ id: "1", text: "zgârietură", at: 7 }]);
    assert.deepStrictEqual(n.receipt, { name: "Mario Rossi", sig: "data:x", at: 9, mounted: 1, total: 2, partial: true });
  });
  test("o recepție fără nume sau fără semnătură nu există", () => {
    assert.strictEqual(S.norm({ receipt: { name: "M", sig: "d" } }).receipt, null);
    assert.strictEqual(S.norm({ receipt: { name: "Mario", sig: "" } }).receipt, null);
  });
  test("defectul se taie la TEXT_MAX", () => {
    const n = S.norm({ defects: [{ id: 1, text: "a".repeat(999) }] });
    assert.strictEqual(n.defects[0].text.length, S.TEXT_MAX);
  });
});

describe("units: unități de montat", () => {
  test("grupat pe modul, în ordinea apariției; fără accesorii, fără modul gol", () => {
    assert.deepStrictEqual(S.units(P, isAcc), [{ id: "A", name: "A", pcs: 3 }, { id: "B", name: "B", pcs: 4 }]);
  });
  test("fără funcția de accesorii, se numără tot ce are modul", () => {
    assert.strictEqual(S.units(P)[0].pcs, 8);
  });
  test("proiect gol / lipsă → listă goală", () => {
    assert.deepStrictEqual(S.units(null, isAcc), []);
    assert.deepStrictEqual(S.units({}, isAcc), []);
  });
});

describe("montaj: bifa pe unitate", () => {
  const U = S.units(P, isAcc);
  test("bifează, apoi a doua atingere anulează", () => {
    let s = S.toggleMounted(null, "A", 100);
    assert.deepStrictEqual(s.mounted, { A: 100 });
    s = S.toggleMounted(s, "A", 200);
    assert.deepStrictEqual(s.mounted, {});
  });
  test("nu modifică site-ul primit", () => {
    const s0 = { mounted: { A: 1 } };
    S.toggleMounted(s0, "B", 2);
    assert.deepStrictEqual(s0, { mounted: { A: 1 } });
  });
  test("progres: N din M și procent", () => {
    assert.deepStrictEqual(S.progress(null, U), { done: 0, total: 2, pct: 0 });
    assert.deepStrictEqual(S.progress({ mounted: { A: 1 } }, U), { done: 1, total: 2, pct: 50 });
    assert.deepStrictEqual(S.progress({ mounted: { A: 1, B: 2, Z: 3 } }, U), { done: 2, total: 2, pct: 100 });
  });
  test("fără unități: 0 din 0, nu NaN", () => assert.deepStrictEqual(S.progress(null, []), { done: 0, total: 0, pct: 0 }));
});

describe("verificări și defecte", () => {
  test("cele 7 verificări se bifează și se debifează; în afara 1–7 nu se întâmplă nimic", () => {
    let s = S.toggleCheck(null, 3);
    assert.deepStrictEqual(s.check, { 3: true });
    assert.deepStrictEqual(S.toggleCheck(s, 0).check, { 3: true });
    assert.deepStrictEqual(S.toggleCheck(s, 8).check, { 3: true });
    s = S.toggleCheck(s, 3);
    assert.deepStrictEqual(s.check, {});
    let t = null; for (let i = 1; i <= 7; i++) t = S.toggleCheck(t, i);
    assert.strictEqual(S.checksDone(t), 7);
  });
  test("defect: adaugă cu text curat, refuză textul gol, șterge după id", () => {
    let s = S.addDefect(null, "  ușă care freacă ", "d1", 5);
    assert.deepStrictEqual(s.defects, [{ id: "d1", text: "ușă care freacă", at: 5 }]);
    assert.strictEqual(S.addDefect(s, "   ", "d2").defects.length, 1);
    assert.strictEqual(S.addDefect(s, null, "d2").defects.length, 1);
    assert.deepStrictEqual(S.removeDefect(s, "d1").defects, []);
  });
});

describe("recepția", () => {
  const U = S.units(P, isAcc);
  test("canSign: numele (≥ 2 caractere) și semnătura sunt singurele condiții", () => {
    assert.deepStrictEqual(S.canSign("", "d"), { ok: false, why: "name" });
    assert.deepStrictEqual(S.canSign(" M ", "d"), { ok: false, why: "name" });
    assert.deepStrictEqual(S.canSign("Mario", ""), { ok: false, why: "sig" });
    assert.deepStrictEqual(S.canSign("Mario", "d"), { ok: true, why: "" });
  });
  test("semnare completă: toate montate → partial false", () => {
    const base = { mounted: { A: 1, B: 2 } };
    const r = S.sign(base, U, " Mario Rossi ", "data:sig", 1000);
    assert.strictEqual(r.ok, true);
    assert.deepStrictEqual(r.site.receipt, { name: "Mario Rossi", sig: "data:sig", at: 1000, mounted: 2, total: 2, partial: false });
  });
  test("semnare cu unități nemontate → recepție parțială, scrisă în ea; nu se blochează", () => {
    const r = S.sign({ mounted: { A: 1 } }, U, "Mario", "d", 1);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.site.receipt.partial, true);
    assert.strictEqual(r.site.receipt.mounted, 1);
    assert.strictEqual(r.site.receipt.total, 2);
  });
  test("semnare refuzată: nimic nu se scrie, motivul se întoarce", () => {
    const r = S.sign({ mounted: { A: 1 } }, U, "M", "d", 1);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.why, "name");
    assert.strictEqual(r.site.receipt, null);
    assert.strictEqual(S.sign(null, U, "Mario", "", 1).why, "sig");
  });
  test("montajul bifat după semnare nu șterge recepția; anularea e explicită și păstrează restul", () => {
    let s = S.sign({ mounted: { A: 1, B: 2 }, check: { 1: true }, defects: [{ id: 1, text: "x" }] }, U, "Mario", "d", 5).site;
    s = S.toggleMounted(s, "B", 9);
    assert.ok(s.receipt, "recepția rămâne");
    s = S.unsign(s);
    assert.strictEqual(s.receipt, null);
    assert.deepStrictEqual(s.check, { 1: true });
    assert.strictEqual(s.defects.length, 1);
  });
});
