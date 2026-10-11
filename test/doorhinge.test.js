/* Ebanist — U.1: partea balamalelor aleasă pe fiecare ușă din formular.
 *
 *   node --test test/doorhinge.test.js
 *
 * `cfg.doorHinge` = ["left"|"right"|null, ...] de la stânga. Ajunge pe cutia
 * ușii (`hinge`), de acolo în găurire și în 3D, ca `fronts[].hinge`.
 * Ce trebuie să rămână adevărat:
 *  - fără `doorHinge` (sau cu toate nule) proiectul vechi dă aceleași piese,
 *    aceleași cutii și aceleași găuri (D-39);
 *  - partea aleasă ajunge în găurire pe marginea ușii, iar 3D deschide de acolo;
 *  - alegerea nu schimbă distinta: aceleași piese, cotă cu cotă;
 *  - un singur câmp scris afectează numai ușa lui.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
/* motorul e într-un alt realm (vm): deepEqual strict compară prototipurile, deci se compară JSON */
const J = x => JSON.stringify(x);
const same = (a, b, m) => assert.equal(J(a), J(b), m);
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });

function gen(cfg) {
  S.handleIsProfile = () => false;
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k",
    matOvr: {}, matAdd: [MM("__b", 18), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "M", matBody: "__b", matFront: "__b", matBack: "__k" }, cfg);
  const b = S.buildModule(full);
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  return { b, o: JSON.parse(JSON.stringify(S.generateOperations({ boxes: b.boxes, cfg: full, G }))) };
}
const BASE = { type: "standard", L: 900, H: 720, P: 560, plinth: 100, tram: 0, shelves: 1, drawers: 0,
  doors: 2, back: 1, hang: 0, support: "zoccolo", shelfType: "mobile", drawerSys: "legno" };
const doorsOf = b => b.boxes.filter(x => x.sub === "door").sort((a, c) => a.x0 - c.x0);
const cups = o => o.hw.filter(h => h.type === "cerniera");
const bySide = (b, o) => {
  const m = {};
  cups(o).forEach(h => { (m[h.piece] = m[h.piece] || new Set()).add(h.hingeLeft); });
  return doorsOf(b).map(d => [...(m[d.pk] || [])]);
};
const rows = b => b.pieces.map(p => [p.elemento, p.lung, p.larg, p.pz, p.role, p.sp].join("|"));

describe("Fără doorHinge nimic nu se schimbă", () => {
  test("lipsă, listă goală sau toate nule: aceleași piese, cutii și găuri", () => {
    const a = gen(BASE);
    for (const dh of [undefined, [], [null, null], [null], "left", [1, 2]]) {
      const c = gen({ ...BASE, doorHinge: dh });
      same(rows(c.b), rows(a.b));
      same(c.b.boxes, a.b.boxes);
      same(c.o.hw, a.o.hw);
    }
  });
  test("regula de până acum: pereche stânga/dreapta", () => {
    const { b, o } = gen(BASE);
    same(bySide(b, o), [[true], [false]]);
    assert.ok(doorsOf(b).every(d => d.hinge === undefined));
  });
});

describe("Partea aleasă ajunge în găurire și în 3D", () => {
  test("ușă singură, balamale dreapta: cupa pe marginea dreaptă", () => {
    const { b, o } = gen({ ...BASE, L: 450, doors: 1, doorHinge: ["right"] });
    assert.equal(doorsOf(b)[0].hinge, "right");
    same(bySide(b, o), [[false]]);
    const d = o.pieces.find(p => p.role === "frontale");
    const cup = d.operations.find(x => x.note === "tazza cerniera");
    assert.ok(Math.abs(cup.x - (d.length - 22.5)) < 1e-6 || Math.abs(cup.y - (d.width - 22.5)) < 1e-6);
  });
  test("pereche inversată: stânga se deschide spre dreapta și invers", () => {
    const { b, o } = gen({ ...BASE, doorHinge: ["right", "left"] });
    same(bySide(b, o), [[false], [true]]);
    same(doorsOf(b).map(d => d.hinge), ["right", "left"]);
  });
  test("o singură ușă aleasă: cealaltă păstrează regula", () => {
    const { b, o } = gen({ ...BASE, doorHinge: [null, "left"] });
    same(bySide(b, o), [[true], [true]]);
    assert.equal(doorsOf(b)[0].hinge, undefined);
    assert.equal(doorsOf(b)[1].hinge, "left");
  });
  test("trei uși: cea din mijloc aleasă, celelalte ca înainte", () => {
    const base = gen({ ...BASE, L: 1350, doors: 3 });
    const c = gen({ ...BASE, L: 1350, doors: 3, doorHinge: [null, "right", null] });
    const a = bySide(base.b, base.o), x = bySide(c.b, c.o);
    assert.equal(x[0][0], a[0][0]); assert.equal(x[2][0], a[2][0]);
    same(x[1], [false]);
  });
  test("ușa din sticlă duce și ea partea aleasă", () => {
    const { b, o } = gen({ ...BASE, front: "vetro", doorHinge: ["right", "left"] });
    same(bySide(b, o), [[false], [true]]);
  });
  test("pereche inversată fără despărțitor: avertisment și nicio gaură pe un flanc îndepărtat", () => {
    const { o } = gen({ ...BASE, doorHinge: ["right", "left"] });
    assert.equal(o.warnings.filter(w => w.k === "opsNoHingePanel").length, 2);
    assert.ok(cups(o).every(h => h.against == null), "basetta nu se fixează pe flancul de la capăt");
    assert.equal(o.hw.filter(h => h.type === "cerniera" && h.plate).length, 0);
  });
  test("pereche inversată cu despărțitor la mijloc: placa pe despărțitor, fără avertisment", () => {
    const { o } = gen({ ...BASE, partitions: [{ type: "setto", x: "center" }], doorHinge: ["right", "left"] });
    assert.equal(o.warnings.filter(w => w.k === "opsNoHingePanel").length, 0);
    assert.ok(cups(o).every(h => h.against != null));
  });
});

describe("Alegerea nu schimbă distinta", () => {
  test("aceleași piese, cotă cu cotă, cu sau fără parte aleasă", () => {
    const a = gen(BASE), c = gen({ ...BASE, doorHinge: ["right", "left"] });
    same(rows(c.b), rows(a.b));
    assert.equal(cups(c.o).length, cups(a.o).length);
  });
  test("câmp scris pentru mai multe uși decât există: ignorat", () => {
    const a = gen({ ...BASE, doors: 1 }), c = gen({ ...BASE, doors: 1, doorHinge: [null, "right", "left"] });
    same(c.b.boxes, a.b.boxes);
  });
});
