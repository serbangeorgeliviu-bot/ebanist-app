/* Ebanist — lateralul cutiei de sertar (lemn) are gauri: imbinare cu fata/spatele
 * (tasseli) si fixarea glisierei. node --test test/drawerside.test.js */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
const arr = x => Array.from(x || []);

function build(cfg, guida) {
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k",
    matOvr: {}, matAdd: [MM("__b", 19), MM("__k", 3), MM("pfl5", 5)], hwProd: { guida: guida || "blum_tandem" } };
  S.slideGuidaId = () => guida || "blum_tandem";
  const full = Object.assign({ name: "R", matBody: "__b", matFront: "__b", matBack: "__k" }, cfg);
  const b = S.buildModule(full);
  const pieces = b.pieces.map(x => Object.assign({}, x));
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  const M = S.carcassMaterials(full);
  const ths = [...new Set(Object.values(M.sp).concat(pieces.map(x => x.sp)).filter(x => x > 0))];
  return { b, full, pieces, G,
    close: () => arr(S.validateCarcassClosure(full, pieces, G)),
    ko: () => arr(S.failedInvariants(full, pieces, G, { materials: M.mats, thicknesses: ths })).map(r => r.id),
    ops: () => S.generateOperations({ boxes: b.boxes, cfg: full, G }) };
}
const sum = (ps, re) => ps.filter(p => re.test(p.elemento)).reduce((a, p) => a + p.pz, 0);
const rows = ps => ps.map(p => [p.elemento, p.lung, p.larg, p.pz, p.role, p.sp].join("|"));
const trays = b => new Set(b.boxes.filter(x => /^p\d+_\d+$/.test(x.grp || "")).map(x => x.grp));


const CFG = { type: "standard", L: 600, H: 900, P: 560, plinth: 100, tram: 0, shelves: 0, drawers: 3,
  doors: 0, back: 1, hang: 0, support: "zoccolo", shelfType: "mobile", drawerSys: "legno" };

const slideHoles = p => p.operations.filter(h => h.note === "guida cassetto");
const dbox = O => O.pieces.filter(p => p.role === "cassetto_fianco" && p.sub === "dbox");

describe("Lateralul sertarului din lemn: îmbinare cu fața și spatele", () => {
  const B = build(CFG), O = B.ops();
  const sides = dbox(O).filter(p => p.axes.sp === "x");
  test("fiecare lateral are taseli, iar fața și spatele perechea lor", () => {
    assert.equal(sides.length, 6);
    sides.forEach(p => assert.ok(p.operations.filter(h => h.note === "tassello").length >= 2, String(p.pk)));
    dbox(O).filter(p => p.axes.sp !== "x").forEach(p => assert.ok(p.operations.filter(h => h.note === "tassello").length >= 4, String(p.pk)));
  });
  test("distinta si invarianti neschimbate", () => {
    assert.deepEqual(B.close(), []);
    assert.deepEqual(B.ko(), []);
  });
});

describe("Glisiera laterală (Häfele cu bile): găuri pe lateralul sertarului", () => {
  const O = build(CFG, "haf_ball").ops(), sides = dbox(O).filter(p => p.axes.sp === "x");
  test("găuri Ø3 pe fața exterioară, la 26 mm de față apoi din 128 în 128", () => {
    sides.forEach(p => {
      const g = slideHoles(p);
      assert.ok(g.length >= 3, String(p.pk));
      g.forEach(h => assert.equal(h.dia, 3));
      assert.deepEqual(g.map(h => h.x).sort((a, b) => a - b).map((x, i, a) => i ? +(x - a[i - 1]).toFixed(1) : 0).slice(1).filter(d => d !== 128).length, 0);
    });
  });
  test("peretele din spate nu are cârlig", () => {
    dbox(O).filter(p => p.axes.sp !== "x").forEach(p => assert.equal(slideHoles(p).length, 0));
  });
});

describe("Glisiera ascunsă (TANDEM, MOVENTO): cârlig în peretele din spate, nimic pe lateral", () => {
  ["blum_tandem", "blum_movento"].forEach(id => {
    const O = build(CFG, id).ops(), all = dbox(O);
    test(id + ": lateralul fără găuri de glisieră", () => {
      all.filter(p => p.axes.sp === "x").forEach(p => assert.equal(slideHoles(p).length, 0));
    });
    test(id + ": două găuri Ø6 × 10 în spate, la 7 mm de lateral și 24 mm de jos", () => {
      const hooks = all.filter(p => p.axes.sp !== "x").map(slideHoles).filter(g => g.length);
      assert.equal(hooks.length, 3);
      hooks.forEach(g => {
        assert.equal(g.length, 2);
        g.forEach(h => { assert.equal(h.dia, 6); assert.equal(h.depth, 10); });
      });
    });
  });
});
