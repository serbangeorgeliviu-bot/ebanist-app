/* Ebanist — lateralul cutiei de sertar (lemn) are gauri: imbinare cu fata/spatele
 * (tasseli) si fixarea glisierei. node --test test/drawerside.test.js */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
const arr = x => Array.from(x || []);

function build(cfg) {
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k",
    matOvr: {}, matAdd: [MM("__b", 19), MM("__k", 3), MM("pfl5", 5)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "R", matBody: "__b", matFront: "__b", matBack: "__k" }, cfg);
  const b = S.buildModule(full);
  const pieces = b.pieces.map(x => Object.assign({}, x));
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  const M = S.carcassMaterials(full);
  const ths = [...new Set(Object.values(M.sp).concat(pieces.map(x => x.sp)).filter(x => x > 0))];
  return { b, full, pieces, G,
    close: () => arr(S.validateCarcassClosure(full, pieces, G)),
    ko: () => arr(S.failedInvariants(full, pieces, G, { materials: M.mats, thicknesses: ths })).map(r => r.id),
    ops: () => S.generateOperations({ boxes: b.boxes, cfg: full, G }) };
}
const sum = (ps, re) => ps.filter(p => re.test(p.elemento)).reduce((a, p) => a + p.pz, 0);
const rows = ps => ps.map(p => [p.elemento, p.lung, p.larg, p.pz, p.role, p.sp].join("|"));
const trays = b => new Set(b.boxes.filter(x => /^p\d+_\d+$/.test(x.grp || "")).map(x => x.grp));


const CFG = { type: "standard", L: 600, H: 900, P: 560, plinth: 100, tram: 0, shelves: 0, drawers: 3,
  doors: 0, back: 1, hang: 0, support: "zoccolo", shelfType: "mobile", drawerSys: "legno" };

describe("Cutia de sertar din lemn: lateralul are gauri", () => {
  const B = build(CFG), O = B.ops();
  const sides = O.pieces.filter(p => p.role === "cassetto_fianco" && p.operations.some(h => h.note === "guida cassetto"));
  test("fiecare lateral are gauri de glisiera, pe fata exterioara", () => {
    assert.equal(sides.length, 6);
    sides.forEach(p => assert.ok(p.operations.filter(h => h.note === "guida cassetto").length >= 2));
  });
  test("fiecare lateral are gauri de tassello pentru fata si spate", () => {
    sides.forEach(p => assert.ok(p.operations.filter(h => h.note === "tassello").length >= 2, p.pk));
  });
  test("fata si spatele au gaura pereche (tassello in cant)", () => {
    const ends = O.pieces.filter(p => p.role === "cassetto_fianco" && !sides.includes(p));
    assert.ok(ends.length >= 6);
    ends.forEach(p => assert.ok(p.operations.filter(h => h.note === "tassello").length >= 4, p.pk));
  });
  test("distinta si invarianti neschimbate", () => {
    assert.deepEqual(B.close(), []);
    assert.deepEqual(B.ko(), []);
  });
});
