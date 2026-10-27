/* Piesa cu contur liber în model: rând în distinctă, cutii 3D, operația „contour” cu conturul exact în sistemul feței 5.
   Rulează: node --test contourpiece.test.js */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k", matOvr: {}, matAdd: [MM("__b", 18), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
const C = S.EBContour, arr = x => Array.from(x || []);
const near = (a, b, e, m) => assert.ok(Math.abs(a - b) <= e, (m || "") + " " + a + " vs " + b);
const base = { name: "K", type: "contur", L: 1800, H: 500, P: 18, back: 0, matBody: "__b", matFront: "__b", matBack: "__k", cShape: "scoop", cRise: 120, cPz: 2, cEdge: 1 };

test("rândul din distinctă: gabaritul, numărul, perimetrul exact pentru cant, conturul păstrat", () => {
  const b = S.buildModule({ ...base, cOri: "v" }), r = b.pieces[0];
  assert.equal(r.elemento, "Pezzo contorno"); assert.equal(r.role, "contur"); assert.equal(r.shape, "contur");
  assert.equal(r.lung, 500); assert.equal(r.larg, 1800); assert.equal(r.pz, 2); assert.equal(r.bordo, "CONT");
  const c = 1800, s = 120, rr = (c * c / 4 + s * s) / (2 * s), th = 2 * Math.asin(c / 2 / rr);
  assert.equal(r.perim, Math.round(1800 + 500 * 2 + rr * th));
  assert.equal(b.pieces.length, 1);
  const flat = S.buildModule({ ...base, cOri: "o" }).pieces[0];
  assert.equal(flat.lung, 1800); assert.equal(flat.larg, 500); assert.equal(flat.axis_mapping.sp, "H");
});

test("cutiile 3D: triunghiuri cu aceeași arie ca conturul, același pk pe copie, în planul corect", () => {
  for (const ori of ["v", "o"]) {
    const b = S.buildModule({ ...base, cOri: ori }), N = C.normalize(C.shape("scoop", 1800, 500, { rise: 120 }));
    const bx = arr(b.boxes), pks = [...new Set(bx.map(x => x.pk))];
    assert.deepEqual(pks.sort(), [1, 2]);
    pks.forEach(pk => {
      const tri = bx.filter(x => x.pk === pk);
      const area = tri.reduce((a, t) => { const A = t.prism3.A; return a + Math.abs((A[1][0] - A[0][0]) * ((ori === "v" ? A[2][1] : A[2][2]) - (ori === "v" ? A[0][1] : A[0][2])) - ((ori === "v" ? A[1][1] : A[1][2]) - (ori === "v" ? A[0][1] : A[0][2])) * (A[2][0] - A[0][0])) / 2; }, 0);
      near(area, Math.abs(C.polyArea(C.flatten(N.pts, 0.3))), 1e-6, "aria " + ori);
      tri.forEach(t => { assert.equal(t.role, "contur"); near(ori === "v" ? t.z1 - t.z0 : t.y1 - t.y0, 18, 1e-9); });
      assert.equal(tri.filter(t => t.cont).length, 1, "conturul exact pe o singură cutie");
    });
  }
});

test("operația „contour”: conturul exact în sistemul feței 5, în dreptunghiul piesei, aria păstrată (orientare verticală și culcată)", () => {
  for (const ori of ["v", "o"]) {
    const cfg = { ...base, cOri: ori }, b = S.buildModule(cfg), o = S.generateOperations({ boxes: b.boxes, cfg, G: undefined });
    const pcs = arr(o.pieces); assert.equal(pcs.length, 2);
    pcs.forEach(p => {
      const op = arr(p.operations).find(q => q.type === "contour");
      assert.ok(op, "operația contour");
      assert.equal(op.face, 5);
      const bb = C.bbox(op.pts);
      assert.ok(bb.x0 >= -0.2 && bb.y0 >= -0.2 && bb.x1 <= p.length + 0.2 && bb.y1 <= p.width + 0.2, ori + " în piesă " + JSON.stringify(bb) + " " + p.length + "×" + p.width);
      near(Math.abs(C.area(op.pts)), C.area(C.normalize(C.shape("scoop", 1800, 500, { rise: 120 })).pts), 50, "aria " + ori);
      near(op.perim, C.perimeter(C.shape("scoop", 1800, 500, { rise: 120 })), 1, "perimetrul " + ori);
      assert.deepEqual(arr(p.outline).length, 1, "gabaritul e dreptunghiul de bază");
      assert.ok(p.poly && p.poly.length > 10, "poligonul pentru desen");
    });
    assert.equal(o.verificat, false);
  }
});

test("importul din SVG ajunge pe piesă: un D (semicerc) cu cantul pe contur", () => {
  const r = C.parse("M 0 0 L 300 0 A 150 150 0 0 1 300 -300 L 0 -300 Z"); assert.equal(r.ok, true, r.reason);
  const N = C.build(r.pts, {}); assert.equal(N.ok, true);
  const cfg = { ...base, cShape: "custom", contour: N.pts, cPz: 1, cOri: "v", cEdge: 1 };
  const b = S.buildModule(cfg), p = b.pieces[0];
  near(p.lung, N.h, 1); near(p.larg, N.w, 1); near(p.perim, N.perim, 1);
  assert.equal(b.cont.arcs, 1);
});

test("erori declarate: fără material, fără contur, contur nevalid, piesă mai mare decât placa", () => {
  assert.throws(() => S.buildModule({ ...base, matBody: "nu_exista" }), /contErrMat/);
  assert.throws(() => S.buildModule({ ...base, cShape: "custom", contour: null }), /contErrEmpty/);
  assert.throws(() => S.buildModule({ ...base, cShape: "custom", contour: [[0, 0, 0], [100, 100, 0], [100, 0, 0], [0, 100, 0]] }), /contErr/);
  assert.throws(() => S.buildModule({ ...base, L: 3000, H: 2200 }), /contErrBig/);
  assert.doesNotThrow(() => S.buildModule({ ...base, L: 2700, H: 2000 }));
});
