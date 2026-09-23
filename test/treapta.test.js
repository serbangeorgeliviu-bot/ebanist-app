/* Ebanist — il gradino del muro in basso.
 *
 *   node --test test/treapta.test.js
 *
 * Il caso vero: un bagno dove il muro, in basso, sporge come un gradino.
 * Il corpo non si arretra: i fianchi si intagliano a L, lo schienale esce in
 * DUE pezzi — sopra sul piano di sempre, sotto davanti al gradino — e la
 * base, se sta sotto il gradino, si accorcia di quanto il gradino sporge.
 * La chiusura del gabarito deve tornare a ZERO anche cosi.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;

function build(cfg) {
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k",
    matOvr: {}, matAdd: [MM("__b", 18), MM("__k", 8), MM("__k3", 3), MM("__k18", 18)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "Bagno", matBody: "__b", matFront: "__b", matBack: "__k" }, cfg);
  const out = S.buildModule(full);
  const pieces = out.pieces.map(x => Object.assign({}, x));
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  return { full, out, pieces, G,
    close: () => Array.from(S.validateCarcassClosure(full, pieces, G)),
    inv: () => Array.from(S.failedInvariants(full, pieces, G, {})) };
}
const BAGNO = { type: "standard", L: 800, H: 850, P: 460, plinth: 100, tram: 0, shelves: 1, drawers: 0,
  doors: 2, back: 1, hang: 0, support: "zoccolo", shelfType: "mobile", backMode: "incassato",
  stepH: 300, stepP: 80 };
const row = (b, re) => b.pieces.filter(p => re.test(p.elemento));

describe("Senza gradino non cambia niente", () => {
  test("stepH/stepP a zero = una riga di schienale, nessun intaglio", () => {
    const b = build({ ...BAGNO, stepH: 0, stepP: 0 });
    assert.equal(row(b, /^Schienale/).length, 1);
    assert.ok(!b.pieces.some(p => p.scasso));
    assert.equal(b.G.treapta.activa, false);
  });
});

for (const mode of ["incassato", "applicato", "in_cava"]) {
  describe("Gradino 300×80, schienale " + mode, () => {
    const b = build({ ...BAGNO, backMode: mode, matBack: mode === "in_cava" ? "__k3" : "__k" });
    const up = row(b, /^Schienale sopra/)[0], lo = row(b, /^Schienale sotto/)[0];
    test("lo schienale esce in due pezzi", () => { assert.ok(up && lo); });
    test("larghi uguale, alti in somma quanto lo schienale intero", () => {
      assert.equal(up.lung === up.larg ? 0 : 1, 1);
      const w = p => p.axis_mapping.lung === "L" ? p.lung : p.larg;
      const h = p => p.axis_mapping.lung === "H" ? p.lung : p.larg;
      assert.equal(w(up), w(lo));
      assert.equal(h(up) + h(lo), b.G.back_H);
      assert.equal(lo.part, "jos");
    });
    test("i fianchi hanno l'intaglio a L, profondo quanto il gradino", () => {
      const f = row(b, /^Fianco/)[0], sc = Array.isArray(f.scasso) ? f.scasso[0] : f.scasso;
      assert.equal(sc.w, 80); assert.equal(sc.l, 300); assert.equal(sc.x, 0); assert.equal(sc.y, 0);
    });
    test("la base sta sotto il gradino: si accorcia di 80", () => {
      const base = row(b, /^Base$/)[0], cielo = row(b, /^Cielo$/)[0];
      assert.ok(base && cielo, "base e cielo in due righe");
      assert.equal(cielo.larg - base.larg, 80);
    });
    test("il gabarito chiude a ZERO", () => { assert.deepEqual(b.close().map(e => e.chain + " " + e.delta), []); });
    test("nessun invariante cade", () => { assert.deepEqual(b.inv().map(r => r.id), []); });
  });
}

describe("Gradino piu basso della base", () => {
  const b = build({ ...BAGNO, stepH: 60, stepP: 80 });
  test("la base resta intera e base/cielo restano in una riga", () => {
    assert.equal(row(b, /^Base \/ Cielo/).length, 1);
  });
  test("lo schienale incassato arriva a terra, quindi si divide lo stesso", () => {
    assert.equal(row(b, /^Schienale/).length, 2);
  });
  test("chiude a zero", () => { assert.deepEqual(b.close(), []); });
});

describe("Con tramezzo e ripiano sotto il gradino", () => {
  const b = build({ ...BAGNO, tram: 1, shelves: 1, H: 600, stepH: 360 });
  test("il tramezzo si intaglia per la parte sotto il gradino", () => {
    const d = row(b, /^Tramezzo/)[0], sc = Array.isArray(d.scasso) ? d.scasso[0] : d.scasso;
    assert.equal(sc.l, 360 - 100 - 18); assert.equal(sc.w, 80);
  });
  test("il ripiano che cade nel gradino si segnala", () => { assert.ok(b.out.warn.stepHit > 0); });
  test("chiude a zero", () => { assert.deepEqual(b.close(), []); });
});

describe("Deterministico", () => {
  test("due generazioni, stessa distinta", () => {
    assert.deepEqual(JSON.stringify(build(BAGNO).pieces), JSON.stringify(build(BAGNO).pieces));
  });
});
