/* Ebanist — un corp valid nu trebuie blocat la export (D-45, D-46).
 *
 *   node --test test/exportgate.test.js
 *
 * Găsit la verificarea cap-coadă (20.10.2026): corpurile cu tavan înclinat cădeau pe A9 (piesele sunt
 * mai înalte decât H_lo, înălțimea interiorului plat) și cele cu uși pliabile pe I4 (rosturile dintre
 * foile unui pachet nu intrau în suma lățimilor) — distinta nu se mai putea exporta deși cotele erau corecte.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
const arr = x => Array.from(x || []);

function verdict(cfg0) {
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k", matOvr: {},
    matAdd: [MM("__b", 18), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
  const cfg = Object.assign({ name: "C", matBody: "__b", matFront: "__b", matBack: "__k" }, cfg0);
  const pieces = S.buildModule(cfg).pieces.map(x => Object.assign({}, x));
  const G = S.deriveCarcass(S.carcassParams(cfg, {}));
  const M = S.carcassMaterials(cfg);
  const ths = [...new Set(Object.values(M.sp).concat(pieces.map(x => x.sp)).filter(x => x > 0))];
  const piesa_max = Math.max(...pieces.map(x => Math.max(x.lung, x.larg)));
  return {
    inv: arr(S.failedInvariants(cfg, pieces, G, { materials: M.mats, thicknesses: ths })).map(r => r.id),
    asr: arr(S.checkAssertions(G, { panelL: 2800, panelW: 2070, piesa_max, piesa_L: 0, piesa_W: 0, aria_per_material: 1 })).map(r => r.id),
  };
}
const BASE = { type: "standard", L: 1000, H: 2200, P: 600, t: 18, plinth: 80, tram: 1, shelves: 2, drawers: 0, doors: 2, back: 1, hang: 0,
  support: "zoccolo", shelfType: "mobile" };

describe("tavan înclinat: exportul nu se blochează", () => {
  for (const [nome, tp] of [["pe lățime", { axis: "x", h0: 2200, h1: 1700 }], ["pe lățime, invers", { axis: "x", h0: 1500, h1: 2200 }],
    ["pe adâncime", { axis: "z", h0: 2200, h1: 1600 }]])
    for (const doors of [0, 1, 2, 3])
      test(`${nome}, ${doors} uși`, () => {
        const v = verdict({ ...BASE, doors, topProfile: tp });
        assert.deepEqual(v, { inv: [], asr: [] });
      });
});

describe("uși pliabile: exportul nu se blochează", () => {
  for (const fold of [2, 3, 4])
    for (const doors of [1, 2, 3])
      test(`${fold} foi, ${doors} uși`, () => {
        const v = verdict({ ...BASE, doors, fold });
        assert.deepEqual(v, { inv: [], asr: [] });
      });
  test("pliabil + pantă", () => {
    assert.deepEqual(verdict({ ...BASE, fold: 2, topProfile: { axis: "x", h0: 2200, h1: 1700 } }), { inv: [], asr: [] });
  });
  test("I4 tot prinde un gol adevărat: o foaie lipsă", () => {
    S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k", matOvr: {}, matAdd: [MM("__b", 18), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
    const cfg = Object.assign({ name: "C", matBody: "__b", matFront: "__b", matBack: "__k" }, BASE, { fold: 3 });
    const pieces = S.buildModule(cfg).pieces.map(x => Object.assign({}, x));
    const G = S.deriveCarcass(S.carcassParams(cfg, {})), M = S.carcassMaterials(cfg);
    const bad = pieces.map(p => p.role === "frontale" ? { ...p, lung: Math.min(p.lung, p.larg) === p.lung ? p.lung - 40 : p.lung, larg: Math.min(p.lung, p.larg) === p.larg ? p.larg - 40 : p.larg } : p);
    const ko = arr(S.failedInvariants(cfg, bad, G, { materials: M.mats, thicknesses: [18, 3] })).map(r => r.id);
    assert.ok(ko.includes("I4"), "rânduri: " + ko);
  });
});

test("FOLD_GAP_LEAF din nucleu = FOLD.gap_leaf din aplicație", () => {
  const vm = require("vm");
  assert.equal(S.FOLD_GAP_LEAF, vm.runInContext("FOLD", S).gap_leaf);
});
