/* Ebanist — U.9: uși pliante, «a pacchetto» (D-87).
 *
 *   node --test test/fold.test.js
 *
 * `cfg.fold` = 2, 3 sau 4 foi pe pachet. Un pachet ia locul unei uși: aceeași lățime,
 * împărțită în foi cu rost între ele, suspendate pe o șină sus; între foi stau balamale.
 * Ce trebuie să rămână adevărat:
 *  - implicit nimic nu se schimbă (distinta de dinainte, rând cu rând, D-39);
 *  - lățimea unui pachet = suma foilor + rosturile; înălțimea scade cu spațiul șinei;
 *  - un rând de foi (pz = pachete × foi) și un rând de accesoriu (un set pe pachet);
 *  - 3D: o cutie pe foaie, cu sub:"fold" și cu datele pachetului; deschis, foile se strâng
 *    pe partea aleasă (aceeași alegere ca la balamale, U.1);
 *  - ops: (foi − 1) balamale pe înălțime între foi, mâner numai pe foaia liberă, nicio
 *    balama pe lateral; cotele sunt date nevalidate (HW_DRILL.fold, verificat:false);
 *  - foi prea înguste, sticlă, cote absolute: ușa obișnuită rămâne, cu avertisment.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
const J = x => JSON.stringify(x);
const FOLD = vm.runInContext("FOLD", S);

function build(cfg) {
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__b",
    matOvr: {}, matAdd: [MM("__b", 19), MM("pfl5", 5)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "B", type: "standard", L: 1200, H: 2200, P: 560, plinth: 100, tram: 0, shelves: 0, drawers: 0,
    doors: 2, back: 1, hang: 0, support: "zoccolo", matBody: "__b", matFront: "__b", matBack: "__b", drawerSys: "legno" }, cfg);
  const b = S.buildModule(full);
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  return { b, full, G, pieces: b.pieces.map(x => Object.assign({}, x)),
    ops: () => JSON.parse(J(S.generateOperations({ boxes: b.boxes, cfg: full, G }))) };
}
const rows = (r, re) => r.pieces.filter(p => re.test(p.elemento));
const leaves = r => r.b.boxes.filter(x => x.sub === "fold");

describe("Implicit: nimic nu se schimbă", () => {
  const a = build({}), b = build({ fold: null });
  test("fără opțiune: nicio foaie pliantă, nicio cutie «fold»", () => {
    assert.equal(rows(a, /pieghevole/).length, 0);
    assert.equal(leaves(a).length, 0);
  });
  test("distinta e aceeași cu sau fără cheia fold", () => {
    assert.equal(J(a.pieces.map(x => [x.elemento, x.lung, x.larg, x.pz])), J(b.pieces.map(x => [x.elemento, x.lung, x.larg, x.pz])));
  });
  test("o valoare necunoscută (5, «x») nu face nimic", () => {
    [5, 1, "x", 0].forEach(v => assert.equal(rows(build({ fold: v }), /pieghevole/).length, 0, String(v)));
  });
});

describe("Distinta: foi și set de șină", () => {
  const r = build({ fold: 2 }), plain = build({});
  const f = rows(r, /^Anta pieghevole/)[0], sys = rows(r, /^Sistema anta pieghevole/)[0], d = rows(plain, /^Anta/)[0];
  test("2 uși × 2 foi = 4 foi; un set de șină pe pachet (2)", () => {
    assert.equal(f.pz, 4); assert.equal(sys.pz, 2);
    assert.equal(rows(r, /^Anta$/).length, 0, "nu mai există ușa simplă");
  });
  test("lățimea: 2 foi + 1 rost = lățimea ușii obișnuite; înălțimea scade cu spațiul șinei", () => {
    assert.ok(Math.abs(2 * f.larg + FOLD.gap_leaf - d.larg) <= 1, `${f.larg}×2+${FOLD.gap_leaf} vs ${d.larg}`);
    assert.equal(f.lung, d.lung - FOLD.top_extra);
  });
  test("foile sunt panouri frontale; setul de șină e accesoriu, nu se taie din placă", () => {
    assert.equal(f.role, "frontale"); assert.equal(sys.role, "accessorio"); assert.match(sys.mat, /^Accessorio/);
    assert.equal(f.bordo, "2L+2C");
  });
  test("3 și 4 foi: pz = pachete × foi, rosturile se scad din lățime", () => {
    [3, 4].forEach(n => {
      const q = build({ fold: n, doors: 1 }), g = rows(q, /^Anta pieghevole/)[0], dd = rows(build({ doors: 1 }), /^Anta/)[0];
      assert.equal(g.pz, n);
      assert.ok(Math.abs(n * g.larg + (n - 1) * FOLD.gap_leaf - dd.larg) <= 1.5);
    });
  });
});

describe("3D: o cutie pe foaie, cu datele pachetului", () => {
  const r = build({ fold: 3, doors: 2 }), L = leaves(r);
  test("2 pachete × 3 foi = 6 cutii, fiecare cu sub:\"fold\" și rol frontale", () => {
    assert.equal(L.length, 6);
    L.forEach(b => { assert.equal(b.role, "frontale"); assert.equal(b.kind, "f"); assert.ok(b.fold && b.fold.n === 3); });
  });
  test("indicele foii, pachetul și marginile pachetului sunt coerente", () => {
    const pk = i => L.filter(b => b.fold.i === i).sort((a, b) => a.fold.k - b.fold.k);
    [0, 1].forEach(i => {
      const p = pk(i); assert.equal(p.length, 3);
      assert.equal(J(p.map(b => b.fold.k)), J([0, 1, 2]));
      assert.ok(Math.abs(p[0].x0 - p[0].fold.x0) < 0.01);
      assert.ok(Math.abs(p[2].x1 - p[2].fold.x1) < 0.01);
      for (let k = 0; k < 2; k++) assert.ok(Math.abs(p[k + 1].x0 - p[k].x1 - FOLD.gap_leaf) < 0.01, "rost");
    });
  });
  test("partea pachetului: ca la balamale — implicit prima ușă la stânga, a doua la dreapta; alegerea o înlocuiește", () => {
    const sides = q => [0, 1].map(i => q.filter(b => b.fold.i === i)[0].hinge);
    assert.equal(J(sides(L)), J(["left", "right"]));
    assert.equal(J(sides(leaves(build({ fold: 3, doors: 2, doorHinge: ["right", "right"] })))), J(["right", "right"]));
  });
  test("o ușă singură: pachetul se strânge la stânga", () => {
    assert.equal(leaves(build({ fold: 2, doors: 1 }))[0].hinge, "left");
  });
  test("cutiile au pk diferite (câte o piesă fizică pe foaie)", () => {
    assert.equal(new Set(L.map(b => b.pk)).size, 6);
  });
});

describe("Ops: balamale între foi, nu pe lateral", () => {
  const r = build({ fold: 2, doors: 2 }), o = r.ops(), A = S.HW_DRILL.fold;
  const hinges = o.hw.filter(h => h.type === "cerniera_pliante");
  const nH = S.hingeCount ? S.hingeCount(r.pieces.find(p => /^Anta pieghevole/.test(p.elemento)).lung) : null;
  test("(foi − 1) × balamale pe înălțime, per pachet; nicio balama pe lateral", () => {
    assert.equal(o.hw.filter(h => h.type === "cerniera").length, 0);
    if (nH) assert.equal(hinges.length, 2 * (2 - 1) * nH);
    assert.ok(hinges.length >= 4);
  });
  test("cupa e în foaia din stânga, placa în cea vecină, ambele pe fața dinapoi", () => {
    hinges.forEach(h => {
      const a = o.pieces.find(p => p.id === h.piece || p.pk === h.piece), b = o.pieces.find(p => p.id === h.against || p.pk === h.against);
      assert.ok(a && b, "piesele balamalei");
    });
    const holes = o.pieces.filter(p => p.role === "frontale").flatMap(p => p.operations.filter(op => /cerniera pliante/.test(op.note || "")));
    assert.ok(holes.length >= hinges.length * 3, "o cupă și două găuri de placă la fiecare balama");
  });
  test("cota cupei: diametrul și adâncimea din date", () => {
    const cups = o.pieces.flatMap(p => p.operations.filter(op => /tazza cerniera pliante/.test(op.note || "")));
    assert.ok(cups.length > 0);
    cups.forEach(c => { assert.equal(c.dia, A.cup_dia); assert.equal(c.depth, A.cup_depth); });
  });
  test("mânerul: unul pe pachet, pe foaia de la capătul liber", () => {
    const man = o.hw.filter(h => h.type === "maniglia");
    assert.equal(man.length, 2);
  });
  test("cotele sunt nevalidate: verificat:false", () => {
    assert.equal(o.verificat, false); assert.equal(S.HW_DRILL.verificat, false);
  });
  test("cu push sau gola: nicio gaură de mâner", () => {
    assert.equal(build({ fold: 2, handles: "push" }).ops().hw.filter(h => h.type === "maniglia").length, 0);
  });
});

describe("Cazuri care păstrează ușa obișnuită, cu avertisment", () => {
  test("foi sub lățimea minimă: ușă obișnuită + foldNarrow", () => {
    const r = build({ fold: 4, doors: 4, L: 800 });
    assert.equal(rows(r, /pieghevole/).length, 0);
    assert.ok(rows(r, /^Anta/).length > 0);
    assert.ok(r.b.warn.foldNarrow > 0 && r.b.warn.foldNarrow < FOLD.min_leaf, "foldNarrow=" + r.b.warn.foldNarrow);
  });
  test("front cu sticlă: nu se generează foi (ușa cu ramă rămâne)", () => {
    const r = build({ fold: 2, front: "vetro" });
    assert.equal(rows(r, /pieghevole/).length, 0);
    assert.equal(r.b.warn.foldFront, 1);
    assert.ok(!build({ fold: 2 }).b.warn.foldFront);
  });
  test("pe o ușă cu lățime bună, fără avertisment de foi", () => {
    const r = build({ fold: 2 });
    assert.ok(!r.b.warn.foldNarrow);
  });
  test("lățimea de ieșire în față (foldReach) = lățimea foii", () => {
    const r = build({ fold: 2 }), f = rows(r, /^Anta pieghevole/)[0];
    assert.equal(r.b.warn.foldReach, f.larg);
  });
});
