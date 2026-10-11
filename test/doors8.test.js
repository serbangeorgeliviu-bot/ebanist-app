/* Ebanist — U.5: mai mult de 4 uși în formular.
 *
 *   node --test test/doors8.test.js
 *
 * Până la 8 uși și 8 despărțitori. Ce trebuie să rămână adevărat:
 *  - 5–8 uși ies cu aceeași lățime, rostul de 4 mm și luciul vizibil, deci se
 *    închid la 0 mm cu invarianții;
 *  - regula implicită a balamalelor e pe perechi (stânga, dreapta, ...) ca
 *    fiecare pereche să stea între două panouri, iar cu secțiunile aliniate pe
 *    perechi placa de balama are loc peste tot, fără avertisment;
 *  - până la 4 uși, regula veche: proiectele salvate nu se schimbă (D-39);
 *  - ușile foarte înguste se generează, dar cu avertisment.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
const arr = x => Array.from(x || []);
const J = x => JSON.stringify(x);

function build(cfg) {
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__b",
    matOvr: {}, matAdd: [MM("__b", 19), MM("pfl5", 5)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "R", type: "standard", L: 2400, H: 2400, P: 560, plinth: 80, tram: 0, shelves: 2, drawers: 0, doors: 6,
    back: 1, hang: 0, support: "zoccolo", matBody: "__b", matFront: "__b", matBack: "__b" }, cfg);
  const b = S.buildModule(full);
  const pieces = b.pieces.map(x => Object.assign({}, x));
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  const M = S.carcassMaterials(full);
  const ths = [...new Set(Object.values(M.sp).concat(pieces.map(x => x.sp)).filter(x => x > 0))];
  return { b, full, pieces, G,
    close: () => arr(S.validateCarcassClosure(full, pieces, G)),
    ko: () => arr(S.failedInvariants(full, pieces, G, { materials: M.mats, thicknesses: ths })).map(r => r.id),
    ops: () => JSON.parse(J(S.generateOperations({ boxes: b.boxes, cfg: full, G }))) };
}
const doors = r => r.pieces.filter(p => p.role === "frontale");
const doorBoxes = r => r.b.boxes.filter(b => b.sub === "door").sort((a, c) => a.x0 - c.x0);

describe("5–8 uși", () => {
  for (const n of [5, 6, 8]) {
    test(n + " uși: o linie, lățimi egale, se închide la 0 mm", () => {
      const r = build({ doors: n });
      const d = doors(r); assert.equal(d.length, 1); assert.equal(d[0].pz, n);
      assert.equal(J(r.close()), "[]"); assert.equal(J(r.ko()), "[]");
      /* lățime = (L − 2 × luciu − (n−1) × rost) / n */
      const w = (2400 - 2 * r.G.reveal - (n - 1) * r.G.in.gap_ante) / n;
      assert.ok(Math.abs(d[0].larg - Math.round(w)) <= 1);
    }); }
  test("3D: n cutii de ușă, una lângă alta, fără suprapunere", () => {
    const b = doorBoxes(build({ doors: 6 }));
    assert.equal(b.length, 6);
    for (let i = 0; i + 1 < b.length; i++) assert.ok(b[i].x1 <= b[i + 1].x0 + 1e-6);
  });
  test("balamale: pe perechi (stânga, dreapta, ...)", () => {
    const b = doorBoxes(build({ doors: 6 }));
    assert.equal(J(b.map(x => x.hinge)), J(["left", "right", "left", "right", "left", "right"]));
  });
  test("secțiuni aliniate pe perechi: placa de balama are loc peste tot, fără avertisment", () => {
    const r = build({ doors: 6, tram: 2 });
    const o = r.ops();
    assert.equal(o.warnings.filter(w => w.k === "opsNoHingePanel").length, 0);
    assert.ok(o.hw.filter(h => h.type === "cerniera").every(h => h.against != null));
    assert.equal(J(r.close()), "[]");
  });
  test("U.1 peste pereche: o ușă aleasă rămâne cum a ales utilizatorul", () => {
    const b = doorBoxes(build({ doors: 6, doorHinge: [null, "left"] }));
    assert.equal(b[1].hinge, "left"); assert.equal(b[0].hinge, "left");
  });
});

describe("Până la 4 uși nimic nu se schimbă", () => {
  test("regula veche pe 4 uși: primele două stânga, ultimele două dreapta", () => {
    const r = build({ L: 1600, doors: 4 });
    assert.ok(doorBoxes(r).every(b => b.hinge === undefined));
    const m = {}; r.ops().hw.filter(h => h.type === "cerniera").forEach(h => { (m[h.piece] = m[h.piece] || new Set()).add(h.hingeLeft); });
    const order = doorBoxes(r).map(b => [...m[b.pk]][0]);
    assert.equal(J(order), J([true, true, false, false]));
  });
});

describe("Despărțitori", () => {
  test("8 despărțitori: 9 secțiuni, corpul se închide", () => {
    const r = build({ tram: 8, doors: 0, shelves: 1 });
    assert.equal(r.pieces.filter(p => p.role === "divisorio").reduce((s, p) => s + p.pz, 0), 8);
    assert.equal(J(r.close()), "[]"); assert.equal(J(r.ko()), "[]");
  });
});

describe("Uși înguste", () => {
  test("sub 150 mm: se generează, cu avertisment", () => {
    const r = build({ L: 900, doors: 8 });
    assert.ok(r.b.warn.doorNarrow > 0 && r.b.warn.doorNarrow < 150);
    assert.equal(doors(r)[0].pz, 8);
  });
  test("lățime normală: fără avertisment", () => {
    assert.equal(build({ doors: 6 }).b.warn.doorNarrow, 0);
  });
});
