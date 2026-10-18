/* Tipuri de imbinare: minifix / confirmat / tasel / lamela / domino — aceeasi
   geometrie de capat, alta legatura. node --test test/joints.test.js */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
const ARM = { type: "standard", L: 1000, H: 2200, P: 600, plinth: 80, tram: 1, shelves: 3, drawers: 0, doors: 2, back: 1, hang: 0, support: "zoccolo", shelfType: "mobile" };
function gen(conn, cfg) {
  S.handleIsProfile = () => false;
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k", matOvr: {},
    matAdd: [MM("__b", 19), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "M", matBody: "__b", matFront: "__b", matBack: "__k" }, ARM, cfg || {}, conn ? { hwSel: { conn } } : {});
  const b = S.buildModule(full), G = S.deriveCarcass(S.carcassParams(full, {}));
  return JSON.parse(JSON.stringify(S.generateOperations({ boxes: b.boxes, cfg: full, G })));
}
const ops = o => o.pieces.flatMap(p => p.operations.map(x => ({ ...x, pc: p })));

test("implicit: minifix, fara canale", () => {
  const o = gen(null);
  assert.equal(o.joint, "minifix");
  assert.ok(ops(o).some(x => x.note === "eccentrico minifix"));
  assert.ok(!ops(o).some(x => x.type === "slot"));
});
test("confirmat: Ø7 prin fata lui F, pilot Ø5×50 in muchia lui E, nimic de minifix", () => {
  const o = gen("gen_confirmat"), a = ops(o);
  assert.equal(o.joint, "confirmat");
  const th = a.filter(x => x.note === "confirmat"), pl = a.filter(x => x.note === "pilot confirmat");
  assert.ok(th.length > 0 && th.length === pl.length);
  th.forEach(x => { assert.equal(x.dia, 7); assert.ok(x.through); });
  pl.forEach(x => { assert.equal(x.dia, 5); assert.equal(x.depth, 50); assert.ok(x.face < 5, "in muchie"); });
  assert.ok(!a.some(x => /minifix/.test(x.note)));
  assert.ok(o.hw.every(h => h.type !== "minifix"));
});
test("tasel: perechi Ø8 8+23 mm, pas maxim 128, fara eccentric", () => {
  const o = gen("gen_dowel"), a = ops(o).filter(x => x.note === "tassello");
  assert.ok(a.length > 0);
  a.forEach(x => assert.equal(x.dia, 8));
  assert.ok(a.every(x => x.depth === 12 || x.depth === 23));
});
test("lamela si domino: canale in muchia lui E si in fata lui F, centrate pe grosime", () => {
  for (const [id, len, thk, dEdge, dFace] of [["gen_biscuit", 56, 4, 12.5, 12.5], ["fes_domino", 21, 8, 25, 15]]) {
    const o = gen(id), s = ops(o).filter(x => x.type === "slot");
    assert.ok(s.length > 0, id);
    assert.ok(s.some(x => x.face < 5) && s.some(x => x.face === 5 || x.face === 6), "muchie + fata");
    s.forEach(x => { assert.equal(x.len, len); assert.equal(x.thk, thk); assert.equal(x.depth, x.face < 5 ? dEdge : dFace);
      if (x.face >= 5) assert.ok(x.depth < x.pc.thickness - 2, "nu strapunge"); });
    s.filter(x => x.face < 5).forEach(x => assert.ok(Math.abs(x.z - x.pc.thickness / 2) < 0.2, "z la jumatatea grosimii"));
    assert.equal(s.length % 2, 0, "cate un canal pe fiecare piesa");
  }
});
test("determinism: acelasi corp, aceleasi operatii", () => {
  for (const id of ["gen_confirmat", "gen_dowel", "gen_biscuit", "fes_domino"])
    assert.deepEqual(JSON.stringify(gen(id)), JSON.stringify(gen(id)));
});
test("id necunoscut → minifix", () => assert.equal(gen("zzz").joint, "minifix"));
