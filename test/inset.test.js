/* Boiserie cu panou încastrat în ramă (D-100): panourile, canalele din rame (model de operații), găurile din panou.
   Rulează: node --test inset.test.js */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__p", matBack: "__k", matOvr: {},
  matAdd: [MM("__b", 18), MM("__k", 16), MM("__p", 10), MM("__thick", 17)], hwProd: { guida: "blum_tandem" } };
const arr = x => Array.from(x || []);
const cfg0 = { name: "I", type: "boiserie", L: 2400, L2: 900, H: 2600, P: 34, back: 0, rfW: 60, rfTarget: 600, rfRows: 2, rfInset: 1,
  matBody: "__b", matFront: "__p", matBack: "__k" };
const slotsOf = (o, role) => arr(o.pieces).filter(p => p.role === role).flatMap(p => arr(p.operations).filter(q => q.type === "slot").map(q => ({ p, q })));

test("panourile: câte unul pe câmp, mărite cu gd pe fiecare latură, din grosimea materialului fronturilor", () => {
  const b = S.buildModule(cfg0), P = arr(b.pieces).filter(x => x.role === "rama_camp");
  assert.equal(P.reduce((a, x) => a + x.pz, 0), 8);
  assert.ok(P.every(x => x.lung === 1210 + 16 && x.larg === 525 + 16));
  const bx = arr(b.boxes).filter(x => x.role === "rama_camp");
  assert.equal(bx.length, 8);
  /* panoul subțire stă la mijlocul grosimii ramei */
  bx.forEach(x => { assert.ok(Math.abs((x.z1 - x.z0) - 10) < 1e-9); assert.ok(Math.abs(x.z0 - 4) < 1e-9, String(x.z0)); });
});

test("canalele: 4 pe panou (stânga, dreapta, jos, sus), pe marginea ramei, cu grosimea panoului și adâncimea gd", () => {
  const b = S.buildModule(cfg0), o = S.generateOperations({ boxes: b.boxes, cfg: cfg0, G: undefined });
  const st = slotsOf(o, "rama_montant"), rl = slotsOf(o, "rama_traversa");
  assert.equal(st.length + rl.length, 4 * 8);
  [...st, ...rl].forEach(({ q }) => { assert.ok(q.face >= 1 && q.face <= 4, "pe marginea ramei, fața " + q.face); assert.equal(q.thk, 10); assert.equal(q.depth, 8); assert.equal(q.hw, "canal rama"); });
  assert.ok(st.every(({ q }) => q.len === 1226), "canalul din montant = înălțimea câmpului + 2·gd");
  assert.ok(rl.every(({ q }) => q.len === 525), "canalul din traversă = lățimea câmpului (capetele panoului intră în canalele montanților)");
  assert.equal(o.verificat, false, "valorile rămân nevalidate");
});

test("o gaură de priză lângă marginea panoului nu rupe canalul din ramă", () => {
  const cfg = { ...cfg0, lamCuts: [{ x: 60, y: 60, w: 30, h: 40 }, { x: 300, y: 400, w: 80, h: 80 }] };
  const b = S.buildModule(cfg), o = S.generateOperations({ boxes: b.boxes, cfg, G: undefined });
  assert.equal(slotsOf(o, "rama_montant").length + slotsOf(o, "rama_traversa").length, 32);
  const holed = arr(b.pieces).filter(x => x.role === "rama_camp" && x.scasso);
  assert.ok(holed.length >= 1);
});

test("panou prea gros pentru ramă: eroare, nu distinctă; fără material pentru panou: eroare", () => {
  const thick = { ...cfg0, matFront: "__thick" };    /* 18 − 17 = 1 mm rămas */
  assert.throws(() => S.buildModule(thick), /rfErrInset/);
  assert.throws(() => S.buildModule({ ...cfg0, matFront: "nu_exista" }), /rfErrInsetMat/);
  assert.doesNotThrow(() => S.buildModule({ ...cfg0, rfW: 30 }));
});

test("fără încastrare nimic nu se schimbă: panouri zero, canale zero", () => {
  const cfg = { ...cfg0, rfInset: 0, back: 1 };
  const b = S.buildModule(cfg), o = S.generateOperations({ boxes: b.boxes, cfg, G: undefined });
  assert.equal(arr(b.pieces).filter(x => x.role === "rama_camp").length, 0);
  assert.equal(slotsOf(o, "rama_montant").length + slotsOf(o, "rama_traversa").length, 0);
});
