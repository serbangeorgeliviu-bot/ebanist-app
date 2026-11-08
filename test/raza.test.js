/* Ebanist — U.15: front cu decupaj în rază în loc de mâner (D-117).
 *
 *   node --test test/raza.test.js
 *
 * `cfg.handles = "raza"` (+ `razaR`, `razaCorner`): colțul ușii, de partea
 * muchiei de deschidere, se rotunjește. Rotunjirea e o operație de contur pe
 * piesa fizică; distinta rămâne la cota finită. Ce trebuie să rămână adevărat:
 *  - gabaritul piesei și toate celelalte operații sunt ca la „push” (fără
 *    mâner, fără gaură de mâner): singura diferență e conturul;
 *  - conturul are aria dreptunghiului minus (4−π)·R²/4 la fiecare colț rotunjit,
 *    deci arcul e convex și are raza cerută;
 *  - colțul e de partea opusă balamalelor; „auto” trece pe jos când muchia de
 *    sus e prea sus ca să ajungi cu mâna;
 *  - o rază care nu încape sau e sub freză nu mută nimic: front drept + avertisment;
 *  - fără „raza”, distinta și operațiile de dinainte (D-39); același input, același rezultat.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
const J = x => JSON.stringify(x);

function gen(cfg) {
  S.handleIsProfile = () => false;
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k",
    matOvr: {}, matAdd: [MM("__b", 18), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "M", matBody: "__b", matFront: "__b", matBack: "__k" }, BASE, cfg);
  const b = S.buildModule(full);
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  return { b, full, o: JSON.parse(J(S.generateOperations({ boxes: b.boxes, cfg: full, G }))) };
}
const BASE = { type: "standard", L: 900, H: 720, P: 560, plinth: 100, tram: 0, shelves: 1, drawers: 0,
  doors: 2, back: 1, hang: 0, support: "zoccolo", shelfType: "mobile", drawerSys: "legno", handles: "raza", razaR: 60 };
const fronts = o => o.pieces.filter(p => p.role === "frontale");
const cont = p => p.operations.filter(x => x.type === "contour");
const area = (p) => { const op = cont(p)[0]; return Math.abs(S.EBContour.polyArea(S.EBContour.flatten(op.pts, 0.01))); };
/* colțul rotunjit, în sistemul feței 5: capătul în lungime (sus) sau 0 (jos); capătul în lățime (stânga/dreapta) */
const corners = p => cont(p).length ? cont(p)[0].pts.filter(q => q[2]).length : 0;

describe("front cu rază", () => {
  test("conturul are aria corectă: un colț rotunjit pe ușă, raza cerută", () => {
    const { o } = gen({});
    const fs_ = fronts(o);
    assert.equal(fs_.length, 2);
    fs_.forEach(p => {
      assert.equal(cont(p).length, 1);
      assert.equal(cont(p)[0].note, "colț în rază");
      const want = p.length * p.width - (4 - Math.PI) * 60 * 60 / 4;
      assert.ok(Math.abs(area(p) - want) < 2, "aria " + area(p) + " ≠ " + want);
      assert.ok(p.poly && p.poly.length > 4, "poligonul aplatizat ajunge la desen și la DXF");
    });
  });

  test("distinta nu se schimbă: aceleași piese, cotă cu cotă, ca la push", () => {
    const a = gen({ handles: "raza" }), b = gen({ handles: "push" });
    const dims = x => x.o.pieces.map(p => [p.pk, p.role, p.length, p.width, p.thickness]);
    assert.equal(J(dims(a)), J(dims(b)));
    /* același lucru pe operații, în afară de contur */
    const ops = x => x.o.pieces.map(p => p.operations.filter(op => op.type !== "contour"));
    assert.equal(J(ops(a)), J(ops(b)));
    assert.equal(J(a.o.hw), J(b.o.hw), "nicio gaură de mâner, nicio feronerie în plus");
  });

  test("fără raza, operațiile de dinainte (D-39)", () => {
    const a = gen({ handles: "maniglia", razaR: undefined, razaCorner: "both" });
    assert.ok(!a.o.pieces.some(p => cont(p).length), "nici un contur");
  });

  test("colțul e de partea opusă balamalelor", () => {
    /* stânga: balamale la stânga → colț la dreapta; dreapta: invers */
    const { o, b } = gen({ doorHinge: ["left", "right"] });
    const doors = b.boxes.filter(x => x.sub === "door").sort((u, v) => u.x0 - v.x0);
    const pieceOf = bx => o.pieces.find(p => p.pk === bx.pk);
    /* în fața 5, lățimea e axa y a modelului pentru uși (x al lumii = lățimea): colțul rotunjit are x_mondial la capătul opus balamalei */
    const world = (p) => {
      const op = cont(p)[0], arc = op.pts.find(q => q[2]);
      return arc;
    };
    assert.ok(world(pieceOf(doors[0])) && world(pieceOf(doors[1])));
    /* simetrie: cele două uși au rotunjirea la capete opuse ale lățimii */
    const w0 = world(pieceOf(doors[0]))[1] > pieceOf(doors[0]).width / 2, w1 = world(pieceOf(doors[1]))[1] > pieceOf(doors[1]).width / 2;
    assert.notEqual(w0, w1);
  });

  test("auto: sus la corp de jos, jos la corp înalt; la alegere sus / jos / ambele", () => {
    assert.equal(corners(fronts(gen({ razaCorner: "top" }).o)[0]), 1);
    const both = gen({ razaCorner: "both" }).o;
    assert.equal(corners(fronts(both)[0]), 2);
    /* auto la corp de 720 (muchie sus < 1400) vs 2400 */
    const lowTop = gen({}).o, tall = gen({ H: 2400, plinth: 100 }).o;
    const endOf = p => { const arc = cont(p)[0].pts.find(q => q[2]); return arc[0] > p.length / 2 ? "sus" : "jos"; };
    assert.equal(endOf(fronts(lowTop)[0]), "sus");
    assert.equal(endOf(fronts(tall)[0]), "jos");
  });

  test("sertarele au colțul rotunjit pe ambele părți", () => {
    const { o } = gen({ doors: 0, drawers: 3 });
    const dr = o.pieces.filter(p => p.role === "cassetto_frontale");
    assert.ok(dr.length >= 3);
    dr.forEach(p => assert.equal(corners(p), 2));
  });

  test("o rază care nu încape sau e sub freză nu mută nimic", () => {
    const big = gen({ razaR: 400 }), small = gen({ razaR: 5 });
    assert.ok(!big.o.pieces.some(p => cont(p).length));
    assert.ok(big.o.warnings.some(w => w.k === "opsRazaBig"));
    assert.ok(!small.o.pieces.some(p => cont(p).length));
    assert.ok(small.o.warnings.some(w => w.k === "opsRazaSmall"));
  });

  test("raza prea mică pentru priză avertizează, dar se aplică", () => {
    const r = gen({ razaR: 20 });
    assert.ok(r.o.warnings.some(w => w.k === "opsRazaGrip"));
    assert.ok(fronts(r.o).every(p => cont(p).length === 1));
    assert.ok(!gen({ razaR: 60 }).o.warnings.some(w => w.k === "opsRazaGrip"));
  });

  test("determinism: același input, aceleași operații", () => {
    assert.equal(J(gen({}).o), J(gen({}).o));
  });

  test("nu atinge pesemne: nu se combină cu gola (gola are altă ramură)", () => {
    const g = gen({ handles: "gola" });
    assert.ok(!g.o.pieces.some(p => cont(p).length));
  });
});
