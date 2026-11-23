/* Ebanist — benzi LED verticale și ușă fără mâner (D-182).
 *
 *   node --test test/ledruns.test.js
 *
 * Ce trebuie să rămână adevărat:
 *  - fără `ledRuns` și fără `fronts[].handle`, distinta și operațiile sunt cele de dinainte (D-39);
 *  - fiecare bandă verticală e un rând „Striscia LED” (accesoriu, rol accessorio), cu lungimea laterală − 80 sau cea cerută;
 *  - canalul 6×6 stă în lateralul ales, pe fața exterioară, în interiorul piesei, iar instanța `ledv` poartă y0, y1, len;
 *  - o ușă cu `handle:"none"` nu primește mâner, celelalte da (aceeași cotă de ușă, alt rezultat).
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
    matOvr: {}, matAdd: [MM("__b", 19), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "M", type: "standard", L: 1000, H: 2200, P: 500, plinth: 60, tram: 0, shelves: 0, drawers: 0, doors: 0,
    back: 1, hang: 0, support: "zoccolo", matBody: "__b", matFront: "__b", matBack: "__k" }, cfg);
  const b = S.buildModule(full);
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  return { b, o: JSON.parse(J(S.generateOperations({ boxes: b.boxes, cfg: full, G }))) };
}
const leds = r => r.b.pieces.filter(p => p.elemento === "Striscia LED");

describe("Implicit: fără ledRuns nimic nu se schimbă", () => {
  test("ledRuns lipsă, gol sau necunoscut: aceeași distinta și aceleași operații", () => {
    const a = gen({}), b = gen({ ledRuns: [] }), c = gen({ ledRuns: [{ on: "front" }, null] });
    assert.equal(leds(a).length, 0); assert.equal(J(a.b.pieces), J(b.b.pieces)); assert.equal(J(a.b.pieces), J(c.b.pieces));
    assert.equal(J(a.o), J(b.o)); assert.equal(J(a.o), J(c.o));
  });
});

describe("Benzi verticale", () => {
  const r = gen({ ledRuns: [{ on: "left" }, { on: "right", len: 1500 }] });
  test("un rând pe bandă: H − 80 și cota cerută; accesoriu, nu panou", () => {
    const L = leds(r); assert.equal(L.length, 2);
    assert.equal(J(L.map(x => x.lung).sort((p, q) => p - q)), J([1500, 2120]));
    L.forEach(x => { assert.equal(x.larg, 6); assert.equal(x.role, "accessorio"); });
  });
  test("instanțele ledv: două, în interiorul lateralului, cu len = y1 − y0", () => {
    const v = r.o.hw.filter(h => h.type === "ledv"); assert.equal(v.length, 2);
    v.forEach(h => { assert.ok(Math.abs(h.len - (h.y1 - h.y0)) < 1e-6); assert.ok(h.y0 >= 0 && h.y1 <= 2200); });
    assert.equal(J(v.map(h => h.side).sort()), J([-1, 1]));
  });
  test("canalul 6×6 e în piesa lateralului, în gabaritul ei, pe lungimea benzii", () => {
    const g = [];
    r.o.pieces.filter(p => p.role === "fianco").forEach(p => (p.operations || []).filter(o => o.type === "groove" && /vertical/.test(o.note || "")).forEach(o => g.push([p, o])));
    assert.equal(g.length, 2);
    g.forEach(([p, o]) => {
      assert.equal(o.width, 6); assert.equal(o.depth, 6);
      for (let k = 0; k < 3; k++) { assert.ok(o._lo[k] >= p.min[k] - 1e-6 && o._hi[k] <= p.max[k] + 1e-6, "canal în afara piesei"); assert.ok(o._hi[k] > o._lo[k]); }
    });
    assert.equal(J(g.map(([p, o]) => Math.round(o._hi[1] - o._lo[1])).sort((p, q) => p - q)), J([1500, 2120]));
  });
  test("o bandă mai lungă decât lateralul nu se emite", () => {
    const x = gen({ ledRuns: [{ on: "left", len: 5000 }] });
    assert.equal(x.o.hw.filter(h => h.type === "ledv").length, 0);
  });
});

describe("Ușă fără mâner (fronts[].handle = none)", () => {
  const F = (hn) => [{ x: 0, y: 60, w: 498, h: 1700, hinge: "left" }, { x: 502, y: 60, w: 498, h: 1700, hinge: "right" },
                     { x: 0, y: 1764, w: 498, h: 436, hinge: "left", ...(hn ? { handle: "none" } : {}) }, { x: 502, y: 1764, w: 498, h: 436, hinge: "right", ...(hn ? { handle: "none" } : {}) }];
  const man = r => r.o.hw.filter(h => h.type === "maniglia");
  test("fără handle: 4 mânere; cu none pe ușile de sus: 2, iar ușile rămân aceleași", () => {
    const a = gen({ fronts: F(false), doors: 4 }), b = gen({ fronts: F(true), doors: 4 });
    assert.equal(man(a).length, 4); assert.equal(man(b).length, 2);
    assert.equal(J(a.b.pieces), J(b.b.pieces));
    assert.equal(a.o.hw.filter(h => h.type === "cerniera").length, b.o.hw.filter(h => h.type === "cerniera").length);
  });
});

describe("Catalog: mânere aurii și oglindă (D-182)", () => {
  const IDX = fs.readFileSync(path.join(__dirname, "..", "app", "index.html"), "utf8");
  const GL = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "app", "data", "materials-glass.json"), "utf8"));
  test("mânerele aurii sunt în catalog, în 7 limbi, finisaj alamă, marcate estimare (chk, est)", () => {
    for (const id of ["gen_bar_oro_192", "gen_bar_oro_384"]) {
      const m = IDX.match(new RegExp('\\{id:"' + id + '"[^\\n]*'));
      assert.ok(m, id); for (const l of ["it", "ro", "en", "fr", "de", "pl", "es"]) assert.match(m[0], new RegExp('"' + l + '":')); 
      assert.match(m[0], /"fin":\s*"__brass"/); assert.match(m[0], /chk:1/); assert.match(m[0], /est:1/);
    }
  });
  test("oglinda: grosime 4 mm, texturat «mirror», 7 limbi, în MAT_SOURCES și SHELL", () => {
    const m = GL.materiali.find(x => x.id === "specchio_4");
    assert.equal(m.spessore, 4); assert.equal(m.texture, "mirror");
    for (const l of ["it", "ro", "en", "fr", "de", "pl", "es"]) assert.ok(m.nome_i18n[l]);
    assert.match(IDX, /const MAT_SOURCES=\[[^\]]*materials-glass\.json/);
    assert.ok(fs.readFileSync(path.join(__dirname, "..", "app", "sw.js"), "utf8").includes('"./data/materials-glass.json"'));
    assert.match(fs.readFileSync(path.join(__dirname, "..", "app", "viewer3d.js"), "utf8"), /mirror:\s*\{/);
  });
});
