/* Ebanist — corecții din auditul 4.54.0 (fuzz.js + coliziuni 3D).
 *   node --test auditfixes.test.js
 * Fiecare test ține un caz găsit de fuzz: fără corecție, pică. */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
const arr = x => Array.from(x || []), J = x => JSON.parse(JSON.stringify(x));
const BASE = { type: "standard", L: 800, H: 720, P: 560, plinth: 100, tram: 0, shelves: 0, drawers: 0, doors: 2, back: 1, hang: 0, support: "zoccolo", shelfType: "mobile" };
function build(cfg) {
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k", matOvr: {},
    matAdd: [MM("__b", 19), MM("__k", 3), MM("pfl5", 5)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "A", matBody: "__b", matFront: "__b", matBack: "__k" }, BASE, cfg);
  const b = S.buildModule(full), pieces = b.pieces.map(x => Object.assign({}, x));
  const G = S.deriveCarcass(S.carcassParams(full, {})), M = S.carcassMaterials(full);
  const ths = [...new Set(Object.values(M.sp).concat(pieces.map(x => x.sp)).filter(x => x > 0))];
  return { b, pieces, G, full,
    close: () => arr(S.validateCarcassClosure(full, pieces, G)),
    ko: () => arr(S.failedInvariants(full, pieces, G, { materials: M.mats, thicknesses: ths })).map(r => r.id),
    ops: () => J(S.generateOperations({ boxes: b.boxes, cfg: full, G })) };
}
const errs = o => o.pieces.flatMap(p => arr(p.warnings || p.preflight).filter(w => w.level === "error"));

describe("Traversă de 100 mm: o singură fixare, nu două una peste alta", () => {
  test("fără suprapuneri V5 la top=traverse", () => assert.equal(errs(build({ top: "traverse" }).ops()).length, 0));
});
describe("Ușă scurtă: cupele de balama nu se suprapun", () => {
  test("positionsHinges pe 209 mm: ≥ 80 mm între cupe", () => {
    const p = S.positionsHinges(209, 2, 100); assert.equal(p.length, 2); assert.ok(p[1] - p[0] >= 80, J(p));
  });
  test("pe o ușă normală nimic nu se schimbă", () => assert.deepEqual(J(S.positionsHinges(720, 2, 100)), [100, 620]));
  test("pe 120 mm: cupele (Ø35) nu se ating", () => { const p = S.positionsHinges(120, 2, 100); assert.ok(p[1] - p[0] >= 40, J(p)); });
  test("baza cu 2 sertare și 2 uși: fără V5", () => assert.equal(errs(build({ drawers: 2 }).ops()).length, 0));
});
describe("Sertar interior: stă pe fața bazei, nu în ea", () => {
  const r = build({ H: 2200, doors: 2, drawers: 3, tram: 1, shelves: 2, hang: 1, secMode: ["hang", "drawerShelf"], drawerInset: 35 });
  test("frontalul interior începe peste baza", () => {
    const base = r.b.boxes.filter(x => x.role === "base"), top = Math.max(...base.map(x => x.y1));
    const fr = r.b.boxes.filter(x => x.sub === "drawerIn");
    assert.ok(fr.length > 0); fr.forEach(x => assert.ok(x.y0 >= top - 0.01, x.y0 + " < " + top));
  });
});
describe("Rafturi + sertare fără secțiuni marcate: rafturile pornesc deasupra", () => {
  test("niciun raft nu taie un sertar", () => {
    const r = build({ shelves: 1, drawers: 3 });
    const sh = r.b.boxes.filter(x => x.role === "ripiano"), dr = r.b.boxes.filter(x => x.sub === "dbox");
    sh.forEach(a => dr.forEach(c => assert.ok(!(Math.min(a.x1, c.x1) - Math.max(a.x0, c.x0) > .6 && Math.min(a.y1, c.y1) - Math.max(a.y0, c.y0) > .6 && Math.min(a.z1, c.z1) - Math.max(a.z0, c.z0) > .6))));
  });
});
describe("Spate în două bucăți: suma bucăților = totalul rotunjit", () => {
  for (const L of [2221, 2224]) test("închidere la 0 mm cu tram=1/2 la L=" + L, () => {
    assert.equal(JSON.stringify(build({ L, H: 2200, tram: 1, doors: 0 }).close()), "[]");
    assert.equal(JSON.stringify(build({ L, H: 2200, tram: 2, doors: 0 }).close()), "[]");
  });
});
describe("I5 pe sertar metalic lat: nu mai citește spatele ca adâncime", () => {
  test("legrabox pe 1500 cu un despărțitor", () => assert.ok(!build({ L: 1500, drawers: 2, tram: 1, doors: 0, drawerSys: "legrabox" }).ko().includes("I5")));
});
