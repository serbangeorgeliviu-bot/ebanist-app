/* Ebanist — cote de lumină pe 3D: dimensionSpec (ebanist-ops.js).
 *
 *   node --test test/dims.test.js
 *
 * Cotele vin din min/max ale pieselor fizice, deci trebuie să coincidă cu
 * ce taie distinta: gabaritul exterior, înălțimea interioară a corpului
 * (G.H_int) și, cu rafturi, luminile sumate + grosimile.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
const arr = x => Array.from(x || []);

S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k",
  matOvr: {}, matAdd: [MM("__b", 19), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
const BASE = { name: "R", type: "standard", L: 900, H: 720, P: 560, plinth: 100, tram: 0, shelves: 0, drawers: 0, doors: 0,
  back: 1, matBody: "__b", matFront: "__b", matBack: "__k" };
function spec(cfg) {
  const full = Object.assign({}, BASE, cfg), b = S.buildModule(full);
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  const o = S.generateOperations({ boxes: b.boxes, cfg: full, G });
  return { G, d: S.dimensionSpec(arr(o.pieces)), pieces: arr(o.pieces) };
}

describe("dimensionSpec", () => {
  test("gabaritul exterior = cotele corpului", () => {
    const { d } = spec({});
    assert.equal(d.L, 900); assert.equal(d.H, 720);
  });
  test("un corp fără rafturi: o lumină, egală cu H_int", () => {
    const { d, G } = spec({});
    assert.equal(d.gaps.length, 1);
    assert.ok(Math.abs(d.gaps[0].h - G.H_int) < 0.6, d.gaps[0].h + " vs " + G.H_int);
  });
  test("cu rafturi: luminile + grosimile rafturilor = H_int", () => {
    const { d, G } = spec({ shelves: 3 });
    assert.equal(d.gaps.length, 4);
    const sp = G.sp_ripiano || 19;
    const sum = d.gaps.reduce((s, g) => s + g.h, 0) + 3 * sp;
    assert.ok(Math.abs(sum - G.H_int) < 1.5, sum + " vs " + G.H_int);
  });
  test("cu un tramezzo: două coloane", () => {
    const { d } = spec({ tram: 1 });
    assert.ok(new Set(d.gaps.map(g => g.col)).size >= 2);
  });
  test("fără piese: null", () => assert.equal(S.dimensionSpec([]), null));
});
