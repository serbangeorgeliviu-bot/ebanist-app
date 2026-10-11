/* Ebanist — I5 (sertar vs. ghidaj) nu depinde de lățimea corpului.
 *
 *   node --test test/drawerwidth.test.js
 *
 * Bug găsit la înregistrarea clipului: „Base a cassetti" cu cassetti metallici
 * oprea exportul de la ~620 mm lățime. „Retro cassetto" (rolul cassetto_fianco)
 * nu purta `axes`, deci lungimea lui (= lățimea sertarului) era citită ca
 * adâncime (axa P) de regula I5. Retro-ul poartă acum axele lui: L, H, P.
 */
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
  const full = Object.assign({ name: "W", matBody: "__b", matFront: "__b", matBack: "__k" }, cfg);
  const b = S.buildModule(full);
  const pieces = b.pieces.map(x => Object.assign({}, x));
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  const M = S.carcassMaterials(full);
  const ths = [...new Set(Object.values(M.sp).concat(pieces.map(x => x.sp)).filter(x => x > 0))];
  return { pieces, ko: () => arr(S.failedInvariants(full, pieces, G, { materials: M.mats, thicknesses: ths })).map(r => r.id) };
}
const BASE = { type: "standard", L: 600, H: 720, P: 560, plinth: 100, tram: 0, shelves: 0, drawers: 4,
  doors: 0, back: 1, hang: 0, support: "zoccolo", shelfType: "mobile", drawerSys: "tandembox" };

describe("I5 nu depinde de lățime", () => {
  for (const sys of ["tandembox", "legrabox"])
    for (const L of [400, 600, 620, 650, 800, 900, 1200])
      test(`${sys} L=${L}`, () => {
        assert.ok(!build({ ...BASE, drawerSys: sys, L }).ko().includes("I5"));
      });
  test("Retro cassetto are axele L/H/P, nu P pe lungime", () => {
    const r = build({ ...BASE, L: 800 }).pieces.find(p => p.elemento === "Retro cassetto");
    assert.ok(r, "există Retro cassetto");
    const ax = r.axis_mapping || r.axes;
    assert.equal(ax.lung, "L");
    assert.equal(ax.sp, "P");
  });
});
