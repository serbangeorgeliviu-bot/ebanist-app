/* Masă extensibilă pe glisiere Häfele 9.22 (D-119): blat în două jumătăți + prelungire, cadru fix.
 *   node --test table-ext.test.js */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
function gen(cfg) {
  S.handleIsProfile = () => false;
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k", matOvr: {},
    matAdd: [MM("__b", 25), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "M", matBody: "__b", matFront: "__b", matBack: "__k" }, cfg);
  const b = S.buildModule(full);
  return { b, o: JSON.parse(JSON.stringify(S.generateOperations({ boxes: b.boxes, cfg: full, G: null }))), full };
}
const T = { type: "tavolo", L: 1600, H: 750, P: 900 };
const MODELS = { haf_642_68_901: [800, 500], haf_642_68_921: [800, 500], haf_642_68_922: [1000, 600] };

test("blatul în două jumătăți care se închid exact pe L, prelungire cu lățimea din catalog, glisierele ca accesoriu", () => {
  for (const [id, [nl, leaf]] of Object.entries(MODELS)) {
    const L = id.endsWith("922") ? 1800 : 1600;
    const { b } = gen({ ...T, L, tableExt: id });
    const half = b.pieces.find(r => /metà/.test(r.elemento)), lf = b.pieces.find(r => r.elemento === "Prolunga tavolo");
    assert.equal(half.pz, 2); assert.equal(half.lung * 2, L); assert.equal(half.larg, 900);
    assert.equal(lf.lung, leaf); assert.equal(lf.larg, 900);
    assert.ok(b.pieces.some(r => r.role === "accessorio" && /Guide tavolo estensibile/.test(r.elemento) && r.lung === nl));
    const tops = b.boxes.filter(x => x.role === "cielo");
    assert.equal(tops.length, 2); assert.equal(tops[0].x1, tops[1].x0); assert.equal(tops[0].x0, 0); assert.equal(tops[1].x1, L);
  }
});
test("L impar: jumătățile au 0,5 mm, închid exact", () => {
  const { b } = gen({ ...T, L: 1601, tableExt: "haf_642_68_901" });
  assert.equal(b.pieces.find(r => /metà/.test(r.elemento)).lung, 800.5);
});
test("glisiere care nu încap pe zarga lungă -> eroare cu lungimea minimă", () => {
  assert.throws(() => gen({ ...T, L: 1200, tableExt: "haf_642_68_922" }), /nu încap pe zarga lungă.*1280/);
  assert.throws(() => gen({ ...T, L: 1000, tableExt: "haf_642_68_901" }), /nu încap/);
});
test("găurire: 2 glisiere × (3 șuruburi în zargă + 3 pe fiecare jumătate de blat), fără erori de pre-flight", () => {
  const { o } = gen({ ...T, tableExt: "haf_642_68_901" });
  assert.equal(o.hw.filter(h => h.type === "guida_tav").length, 2);
  const drills = p => p.operations.filter(x => x.type === "drill").length;
  assert.equal(o.pieces.filter(p => p.role === "cielo").map(drills).join(), "6,6");
  assert.equal(o.pieces.filter(p => p.role === "traversa" && p.length > 1000).map(drills).join(), "3,3");
  assert.ok(!o.pieces.some(p => p.preflight.some(w => w.level === "error")));
});
test("fără glisiere = masa de dinainte, neschimbată", () => {
  const a = gen(T), c = gen({ ...T, tableExt: null });
  assert.deepEqual(a.b.pieces, c.b.pieces); assert.deepEqual(a.o, c.o);
  assert.ok(a.b.pieces.some(r => r.elemento === "Piano tavolo" && r.pz === 1));
});
test("fuzz: dimensiuni aleatoare, fără excepții neprevăzute, fără erori de pre-flight, deterministic", () => {
  let seed = 5; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296, ri = (a, b) => Math.round(a + rnd() * (b - a));
  const ids = Object.keys(MODELS); let ok = 0, refused = 0;
  for (let i = 0; i < 300; i++) {
    const c = { type: "tavolo", L: ri(900, 2800), H: ri(700, 780), P: ri(600, 1100), tableExt: ids[ri(0, 2)] };
    try {
      const r = gen(c);
      assert.ok(!r.o.pieces.some(p => p.preflight.some(w => w.level === "error")), JSON.stringify(c));
      assert.equal(new Set(r.o.pieces.map(p => p.pk)).size, r.o.pieces.length);
      assert.deepEqual(r.o, gen(c).o); ok++;
    } catch (e) { if (/nu încap/.test(e.message)) refused++; else throw e; }
  }
  assert.ok(ok > 100 && refused > 0, ok + "/" + refused);
});
