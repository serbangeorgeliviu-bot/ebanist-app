/* Ebanist — U.7: gola (profil de aluminiu în loc de mâner), D-75.
 *
 *   node --test test/gola.test.js
 *
 * `cfg.handles = "gola"` (+ `golaH`, `golaC`): frontalele se scurtează cu
 * înălțimea profilului L de sus (`gap_sup` devine golaH), între două sertare
 * suprapuse rămâne rostul C (golaC), profilele ies ca rânduri de accesorii (la
 * metru în deviz), iar laterale primesc o decupare la fiecare C. Ce trebuie
 * să rămână adevărat:
 *  - corpul se închide la 0 mm, invarianții și A5 (joc ≥ 2 mm) trec;
 *  - rostul dintre sertare e exact golaC, iar sus rămâne golaH;
 *  - nu există nicio gaură de mâner, nici push;
 *  - fără gola, distinta de dinainte, rând cu rând (D-39);
 *  - cotele profilului sunt date: o valoare imposibilă oprește generarea.
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
  const full = Object.assign({ name: "B", type: "standard", L: 800, H: 720, P: 560, plinth: 100, tram: 0, shelves: 0, drawers: 0,
    doors: 0, back: 1, hang: 0, support: "zoccolo", matBody: "__b", matFront: "__b", matBack: "__b", drawerSys: "legno" }, cfg);
  const b = S.buildModule(full);
  const pieces = b.pieces.map(x => Object.assign({}, x));
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  const M = S.carcassMaterials(full);
  const ths = [...new Set(Object.values(M.sp).concat(pieces.map(x => x.sp)).filter(x => x > 0))];
  return { b, full, pieces, G,
    close: () => arr(S.validateCarcassClosure(full, pieces, G)),
    ko: () => arr(S.failedInvariants(full, pieces, G, { materials: M.mats, thicknesses: ths })).map(r => r.id),
    A: () => arr(S.checkAssertions(G, {})).map(a => a.id),
    ops: () => JSON.parse(J(S.generateOperations({ boxes: b.boxes, cfg: full, G }))) };
}
const rows = (r, re) => r.pieces.filter(p => re.test(p.elemento));
const err = cfg => { try { build(cfg); return ""; } catch (e) { return e.message; } };

describe("Uși cu gola", () => {
  const r = build({ doors: 2, handles: "gola" });
  test("ușa e mai scurtă cu golaH în loc de jocul de sus (577 = 720 − 100 − 3 − 40)", () => {
    assert.equal(r.G.anta_H, 577); assert.equal(rows(r, /^Anta/)[0].lung, 577);
    assert.equal(r.G.gola.h, 40); assert.equal(r.G.jocuri.joc_frontale_sus, 40);
  });
  test("numele fără mâner: «Anta gola»; un profil L de 800", () => {
    assert.equal(rows(r, /^Anta/)[0].elemento, "Anta gola");
    const l = rows(r, /^Profilo gola L/)[0];
    assert.equal(l.lung, 800); assert.equal(l.larg, 40); assert.equal(l.pz, 1);
    assert.equal(rows(r, /^Profilo gola C/).length, 0);
  });
  test("profilele sunt accesorii: nu intră în panouri", () => {
    assert.match(rows(r, /^Profilo gola L/)[0].mat, /^Accessorio/);
    assert.equal(rows(r, /^Profilo gola L/)[0].role, "accessorio");
  });
  test("se închide la 0 mm, invarianții și regulile de date trec", () => {
    assert.equal(J(r.close()), "[]"); assert.equal(J(r.ko()), "[]");
    assert.ok(!r.A().includes("A5"), "joc sus ≥ 2 mm");
  });
  test("în găurire: nicio maniglă, nicio push; cerniere rămân", () => {
    const o = r.ops();
    assert.equal(o.hw.filter(h => h.type === "maniglia").length, 0);
    assert.ok(o.hw.filter(h => h.type === "cerniera").length > 0);
  });
  test("cotele profilului sunt date: golaH propriu schimbă ușa", () => {
    const q = build({ doors: 2, handles: "gola", golaH: 30 });
    assert.equal(q.G.anta_H, 587); assert.equal(rows(q, /^Profilo gola L/)[0].larg, 30);
  });
});

describe("Sertare cu gola", () => {
  const r = build({ drawers: 3, handles: "gola" });
  test("frontale mai scurte; rost C între ele; un L sus și două C", () => {
    const f = rows(r, /^Frontale cassetto/)[0];
    assert.equal(f.pz, 3); assert.equal(f.elemento, "Frontale cassetto gola");
    assert.equal(rows(r, /^Profilo gola L/).length, 1);
    const c = rows(r, /^Profilo gola C/)[0];
    assert.equal(c.pz, 2); assert.equal(c.lung, f.larg); assert.equal(c.larg, 60);
  });
  test("în 3D: rostul dintre frontale e exact golaC, iar sus rămâne golaH", () => {
    const fr = r.b.boxes.filter(b => b.sub === "drawer").sort((a, c) => a.y0 - c.y0);
    assert.equal(fr.length, 3);
    for (let i = 0; i + 1 < fr.length; i++) assert.ok(Math.abs((fr[i + 1].y0 - fr[i].y1) - 60) < 0.6, "rost 60");
    assert.ok(Math.abs(720 - fr[2].y1 - 40) < 2.1, "sus ≈ golaH (2 mm de joc exterior)");
  });
  test("decupare în laterale la fiecare C: 60 înalt, 20 adânc, pe muchia din față", () => {
    const sc = [].concat(rows(r, /^Fianco$/)[0].scasso || []);
    assert.equal(sc.length, 2);
    sc.forEach(c => { assert.equal(c.l, 60); assert.equal(c.w, 20); assert.equal(c.rif, "fata"); assert.equal(c.y, 540); });
    assert.ok(sc[0].x < sc[1].x);
  });
  test("se închide la 0 mm, invarianții trec", () => { assert.equal(J(r.close()), "[]"); assert.equal(J(r.ko()), "[]"); });
  test("rostul C se alege (golaC) și frontalele se recalculează", () => {
    const q = build({ drawers: 3, handles: "gola", golaC: 40 });
    const f = q.b.boxes.filter(b => b.sub === "drawer").sort((a, c) => a.y0 - c.y0);
    assert.ok(Math.abs((f[1].y0 - f[0].y1) - 40) < 0.6);
  });
});

describe("Gola nu atinge ce nu o cere", () => {
  test("fără gola, aceleași piese și cutii ca înainte", () => {
    const a = build({ doors: 2, drawers: 3, handles: "maniglia", tram: 1, secMode: ["drawers", "empty"] });
    const b = build({ doors: 2, drawers: 3, tram: 1, secMode: ["drawers", "empty"], golaH: 99, golaC: 99 });
    assert.equal(J(a.pieces), J(b.pieces)); assert.equal(J(a.b.boxes), J(b.b.boxes));
    assert.equal(a.G.gola, null);
  });
  test("corp fără fronturi: niciun profil", () => {
    const r = build({ handles: "gola", shelves: 2 });
    assert.equal(rows(r, /^Profilo gola/).length, 0);
  });
  test("deterministă", () => {
    assert.equal(J(build({ drawers: 3, doors: 2, handles: "gola" }).pieces), J(build({ drawers: 3, doors: 2, handles: "gola" }).pieces));
  });
});

describe("Cote imposibile", () => {
  test("golaH sau golaC în afara 5–200 mm opresc generarea", () => {
    assert.match(err({ doors: 2, handles: "gola", golaH: 300 }), /între 5 și 200/);
    assert.match(err({ doors: 2, handles: "gola", golaC: 2 }), /rostul golului C/);
  });
});
