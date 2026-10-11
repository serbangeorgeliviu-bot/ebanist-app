/* Ebanist — U.6: profil anti-curbare pe ușile înalte (D-76).
 *
 *   node --test test/antiwarp.test.js
 *
 * `cfg.antiWarp`: null (fără), "auto" (ușile de la ANTIWARP.minH în sus) sau
 * "all". Profilul iese ca rând de accesorii (câte unul pe ușă), iar în ușă se
 * face un canal pe fața dinapoi — operație cu cote nevalidate. Ce trebuie să
 * rămână adevărat:
 *  - implicit nimic nu se schimbă (distinta de dinainte, rând cu rând, D-39);
 *  - „auto” pune profil numai de la prag în sus; „all” pe toate ușile;
 *  - canalul e pe fața interioară, paralel cu marginea liberă, în interiorul ușii;
 *  - cotele canalului sunt date (HW_DRILL.antiwarp), iar `verificat` rămâne false.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
const J = x => JSON.stringify(x);
const AW = vm.runInContext("ANTIWARP", S);

function build(cfg) {
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__b",
    matOvr: {}, matAdd: [MM("__b", 19), MM("pfl5", 5)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "B", type: "standard", L: 800, H: 2200, P: 560, plinth: 100, tram: 0, shelves: 0, drawers: 0,
    doors: 2, back: 1, hang: 0, support: "zoccolo", matBody: "__b", matFront: "__b", matBack: "__b", drawerSys: "legno" }, cfg);
  const b = S.buildModule(full);
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  return { b, full, G, pieces: b.pieces.map(x => Object.assign({}, x)),
    ops: () => JSON.parse(J(S.generateOperations({ boxes: b.boxes, cfg: full, G }))) };
}
const rows = (r, re) => r.pieces.filter(p => re.test(p.elemento));
const doorGrooves = o => o.pieces.filter(p => p.role === "frontale")
  .flatMap(p => p.operations.filter(op => op.type === "groove").map(op => ({ p, op })));

describe("Implicit: nimic nu se schimbă", () => {
  const a = build({}), b = build({ antiWarp: null });
  test("fără opțiune: niciun profil, niciun canal", () => {
    assert.equal(rows(a, /anticurvatura/).length, 0);
    assert.equal(doorGrooves(a.ops()).length, 0);
  });
  test("distinta e aceeași cu sau fără cheia antiWarp", () => {
    assert.equal(J(a.pieces.map(x => [x.elemento, x.lung, x.larg, x.pz])), J(b.pieces.map(x => [x.elemento, x.lung, x.larg, x.pz])));
  });
});

describe("Auto: de la prag în sus", () => {
  test("ușă înaltă (≥ prag): un profil pe ușă, accesoriu, nu panou", () => {
    const r = build({ antiWarp: "auto" });
    const p = rows(r, /^Profilo anticurvatura/);
    assert.equal(p.length, 1); assert.equal(p[0].pz, 2);
    assert.equal(p[0].role, "accessorio"); assert.match(p[0].mat, /^Accessorio/);
    assert.ok(rows(r, /^Anta/)[0].lung >= AW.minH);
    assert.equal(p[0].lung, rows(r, /^Anta/)[0].lung - AW.len_margin);
  });
  test("ușă joasă (sub prag): nimic", () => {
    const r = build({ antiWarp: "auto", H: 900 });
    assert.equal(rows(r, /anticurvatura/).length, 0);
    assert.equal(doorGrooves(r.ops()).length, 0);
  });
  test("«all» pune profil și pe o ușă joasă", () => {
    const r = build({ antiWarp: "all", H: 900 });
    assert.equal(rows(r, /^Profilo anticurvatura/)[0].pz, 2);
  });
  test("o valoare necunoscută nu face nimic", () => {
    assert.equal(rows(build({ antiWarp: "xx" }), /anticurvatura/).length, 0);
  });
});

describe("Canalul din ușă", () => {
  const r = build({ antiWarp: "auto" }), o = r.ops(), A = S.HW_DRILL.antiwarp;
  const gs = doorGrooves(o);
  test("un canal pe ușă, pe fața 5 (cea cu balamalele), lățime și adâncime din date", () => {
    assert.equal(gs.length, 2);
    gs.forEach(({ op }) => {
      assert.equal(op.face, 5);
      assert.equal(op.width, A.groove_w); assert.equal(op.depth, A.groove_d);
    });
  });
  test("canalul stă în ușă, la distanța din date de marginea liberă, cu retragere la capete", () => {
    gs.forEach(({ p, op }) => {
      const len = Math.max(p.length, p.width), w = Math.min(p.length, p.width);
      const lo = Math.min(op.from.x, op.to.x), hi = Math.max(op.from.x, op.to.x);
      const ylo = Math.min(op.from.y, op.to.y), yhi = Math.max(op.from.y, op.to.y);
      assert.ok(Math.abs((hi - lo) - (len - 2 * A.end_margin)) < 0.2 || Math.abs((yhi - ylo) - (len - 2 * A.end_margin)) < 0.2, "lungime");
      const across = Math.abs(op.to.x - op.from.x) < 0.1 ? op.from.x : op.from.y;
      const d = Math.min(across, w - across);
      assert.ok(Math.abs(d - A.from_free_edge) < 0.2, "distanța de la margine: " + d);
    });
  });
  test("cotele sunt nevalidate: verificat:false", () => {
    assert.equal(o.verificat, false); assert.equal(S.HW_DRILL.verificat, false);
  });
  test("canalul stă lângă marginea LIBERĂ: balamale stânga → canal spre dreapta, și invers", () => {
    const pos = h => { const q = build({ antiWarp: "auto", doors: 1, doorHinge: [h] }).ops();
      const g = doorGrooves(q)[0]; return { w: g.p.width, c: g.op.from.x === g.op.to.x ? g.op.from.x : g.op.from.y }; };
    const l = pos("left"), rr = pos("right");
    /* oglinda în fața 5: cele două canale sunt la capete opuse ale lățimii */
    assert.ok(Math.abs(l.c + rr.c - l.w) < 0.3, J([l, rr]));
    assert.ok(Math.abs(Math.min(l.c, l.w - l.c) - A.from_free_edge) < 0.2);
  });
  test("o ușă de 6: 6 canale și 6 profile", () => {
    const q = build({ antiWarp: "auto", doors: 6, L: 1800 });
    assert.equal(rows(q, /^Profilo anticurvatura/)[0].pz, 6);
    assert.equal(doorGrooves(q.ops()).length, 6);
  });
});
