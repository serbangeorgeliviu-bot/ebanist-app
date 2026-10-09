/* Ebanist — D-69: la cota di taglio meno il bordo, SOLO in uscita.
 *
 *   node --test test/edgecomp.test.js
 *
 * Quello che deve restare vero:
 *  - con l'opzione spenta (default) la cota di taglio E la cota finita;
 *  - accesa: finita meno lo spessore del bordo per ogni lato bordato,
 *    "L" dalla larghezza, "C" dalla lunghezza, arrotondata a 0,1 mm una volta;
 *  - pezzi sagomati e accessori restano sulla cota finita;
 *  - il MOTORE non cambia: la distinta generata e identica, opzione o no
 *    (la Rev. C e caduta proprio su un bordo sottratto nel motore).
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;

const set = o => { S.state.settings = Object.assign({ panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b",
  matFront: "__b", matBack: "__k", matOvr: {}, matAdd: [MM("__b", 19), MM("__k", 3)] }, o); };
const piece = o => Object.assign({ elemento: "fianco", lung: 700, larg: 300, pz: 1, bordo: "2L+2C", materiale: "__b" }, o);
const LW = x => { const c = S.cutLW(x); return [c.L, c.W, c.d]; };

test("spenta (default): la cota di taglio e la finita", () => {
  set({ edgeTh: 2 });
  assert.deepEqual(LW(piece()), [700, 300, false]);
});

test("accesa: 2L+2C da 2 mm -> 696 x 296", () => {
  set({ edgeTh: 2, edgeComp: true });
  assert.deepEqual(LW(piece()), [696, 296, true]);
});

test("un lato lungo da 0,4 toglie solo dalla larghezza", () => {
  set({ edgeTh: 0.4, edgeComp: true });
  assert.deepEqual(LW(piece({ bordo: "1L" })), [700, 299.6, true]);
});

test("i lati corti tolgono dalla lunghezza, arrotondata a 0,1 una volta", () => {
  set({ edgeTh: 0.45, edgeComp: true });
  assert.deepEqual(LW(piece({ bordo: "2C" })), [699.1, 300, true]);
});

test("senza bordo, sagomato o accessorio: resta la finita", () => {
  set({ edgeTh: 2, edgeComp: true });
  assert.deepEqual(LW(piece({ bordo: "" })), [700, 300, false]);
  assert.deepEqual(LW(piece({ angL: 30 })), [700, 300, false]);
  assert.deepEqual(LW(piece({ role: "accessorio" })), [700, 300, false]);
});

test("il motore non cambia: stessa distinta con l'opzione accesa", () => {
  const cfg = { name: "N", type: "standard", L: 1000, H: 2000, P: 580, plinth: 100, tram: 0, shelves: 3, drawers: 0,
    doors: 2, back: 1, hang: 0, support: "zoccolo", shelfType: "mobile", matBody: "__b", matFront: "__b", matBack: "__k" };
  const rows = () => S.buildModule(cfg).pieces.map(p => [p.elemento, p.lung, p.larg, p.pz, p.bordo].join("|"));
  set({ edgeTh: 2 }); const off = rows();
  set({ edgeTh: 2, edgeComp: true }); const on = rows();
  assert.deepEqual(on, off);
  assert.ok(off.length > 5);
});
