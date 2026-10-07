/* Ebanist — Häfele Matrix Box P come sistema di cassetto (4.42.1).
 *
 *   node --test test/matrix.test.js
 *
 * Le formule vengono dal catalogo Häfele DGH-M 2021, MB 9.8–9.9:
 *   fondo (16 mm)  A = NL − 3, B = luce interna − 62
 *   retro          B = luce interna − 62, C = 53 / 69 / 92 sulle sponde 60 / 92 / 115
 *   profondita minima del vano = NL + 3
 * E la cassa in legno sulla guida «haf_matrix» si stringe di quanto dice la
 * tabella del motore (62), non di una copia scritta a mano (era 25).
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
const arr = x => Array.from(x || []);

function build(cfg, guida) {
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k",
    matOvr: {}, matAdd: [MM("__b", 19), MM("__k", 3), MM("pfl5", 5)], hwProd: { guida: guida || "blum_tandem" } };
  const full = Object.assign({ name: "X", matBody: "__b", matFront: "__b", matBack: "__k" }, cfg);
  const b = S.buildModule(full);
  const pieces = b.pieces.map(x => Object.assign({}, x));
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  return { b, pieces, G, close: () => arr(S.validateCarcassClosure(full, pieces, G)) };
}
const BASE = { type: "standard", L: 600, H: 720, P: 560, plinth: 100, tram: 0, shelves: 0, drawers: 3,
  doors: 0, back: 1, hang: 0, support: "zoccolo", shelfType: "mobile", drawerSys: "matrix", drawerDist: "uguali" };

describe("Matrix Box P: le cote del catalogo Häfele", () => {
  const B = build(BASE);
  const p = B.b.draw;
  const LW = 600 - 2 * 19;
  test("il piano sta in piedi", () => assert.ok(p && p.ok, JSON.stringify(p && p.warn)));
  test("fondo = (NL − 3) × (LW − 62)", () => {
    const f = B.pieces.find(x => x.elemento === "Fondo cassetto");
    assert.equal(f.lung, LW - 62);
    assert.equal(f.larg, p.nl - 3);
    assert.equal(f.pz, 3);
  });
  test("retro largo LW − 62, alto quanto dice la tabella della sponda", () => {
    const r = B.pieces.find(x => x.elemento === "Retro cassetto");
    assert.equal(r.lung, LW - 62);
    assert.equal(r.larg, { "60": 53, "92": 69, "115": 92 }[p.hcode]);
  });
  test("NL: la piu lunga che entra con 3 mm dietro", () => {
    assert.ok(p.nl + 3 <= B.G.P_int, p.nl + " + 3 > " + B.G.P_int);
  });
  test("il gabarito si richiude", () => assert.deepEqual(B.close(), []));
});

describe("La cassa in legno legge la guida dal motore", () => {
  test("Matrix scelta come guida: la cassa si stringe di 62, e la chiusura passa", () => {
    const B = build({ ...BASE, drawerSys: "legno" }, "haf_matrix");
    assert.equal(B.b.draw.ded, 62);
    assert.deepEqual(B.close(), []);
  });
  test("le altre guide restano dove erano", () => {
    for (const [g, d] of [["blum_tandem", 42], ["blum_movento", 42], ["blum_230m", 25], ["haf_ball", 26]])
      assert.equal(build({ ...BASE, drawerSys: "legno" }, g).b.draw.ded, d, g);
  });
});
