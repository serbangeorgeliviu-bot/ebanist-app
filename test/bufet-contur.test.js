/* ROADMAP 5.0 / D-110: cazul bufetului de design din poza lui Liviu (17.11.2026): lateral cu picioare arcuite și fața curbată, blat plutitor cu colțuri rotunde.
   Aceeași piesă trebuie să iasă la fel în distinctă, în 3D și în operații (aria, perimetrul pentru cant). Înclinarea laterală NU e acoperită (FAZA 5.2). */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k", matOvr: {}, matAdd: [MM("__b", 19), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
const C = S.EBContour, arr = x => Array.from(x || []);
const near = (a, b, e, m) => assert.ok(Math.abs(a - b) <= e, (m || "") + " " + a + " vs " + b);
const base = { type: "contur", P: 19, back: 0, matBody: "__b", matFront: "__b", matBack: "__k", cEdge: 1 };

test("lateral cu picioare arcuite și fața curbată: distinctă, 3D și operații spun același lucru", () => {
  const N = C.build([[0, 0, -0.45], [480, 0, 0], [470, 620, 0.05], [10, 620, 0]], {});
  assert.equal(N.ok, true, N.reason);
  for (const ori of ["v", "o"]) {
    const cfg = { ...base, name: "Lat", L: 480, H: 620, cShape: "custom", contour: N.pts, cPz: 2, cOri: ori };
    const b = S.buildModule(cfg), r = b.pieces[0];
    assert.equal(b.pieces.length, 1); assert.equal(r.pz, 2); assert.equal(r.role, "contur");
    near(r.perim, N.perim, 1, "perimetrul rândului (cant)");
    const area = C.area(N.pts), bx = arr(b.boxes);
    assert.deepEqual([...new Set(bx.map(x => x.pk))].sort(), [1, 2]);
    const o = S.generateOperations({ boxes: b.boxes, cfg, G: undefined });
    arr(o.pieces).forEach(p => {
      const op = arr(p.operations).find(q => q.type === "contour");
      assert.ok(op, "operația contour");
      near(Math.abs(C.area(op.pts)), Math.abs(area), 50, "aria în operații " + ori);
      near(op.perim, N.perim, 1, "perimetrul în operații " + ori);
    });
  }
});

test("blat plutitor cu colțuri rotunde, culcat: gabaritul și perimetrul exact", () => {
  const b = S.buildModule({ ...base, name: "Blat", L: 1900, H: 520, cShape: "round", cR: 200, cPz: 1, cOri: "o" }), r = b.pieces[0];
  assert.equal(r.lung, 1900); assert.equal(r.larg, 520);
  near(r.perim, 2 * (1900 - 400) + 2 * (520 - 400) + 2 * Math.PI * 200, 1, "perimetru");
});
