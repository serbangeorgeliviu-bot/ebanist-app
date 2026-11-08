/* Cutii joase pe rotile sub pat (D-120).  node --test bed-box.test.js */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
function gen(cfg) {
  S.handleIsProfile = () => false;
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k", matOvr: {},
    matAdd: [MM("__b", 19), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "M", matBody: "__b", matFront: "__b", matBack: "__k" }, cfg);
  const b = S.buildModule(full);
  return { b, o: JSON.parse(JSON.stringify(S.generateOperations({ boxes: b.boxes, cfg: full, G: null }))) };
}
const BED = { type: "letto", L: 1660, H: 950, P: 2060 };

test("cutii sub pat: număr de rânduri și piese după latură și număr", () => {
  for (const [bb, n, k] of [["sx", 1, 1], ["dx", 3, 3], ["both", 2, 4]]) {
    const { b } = gen({ ...BED, bedBox: bb, bedBoxN: n });
    const row = r => b.pieces.find(x => x.elemento === r);
    assert.equal(row("Scatola sotto letto — frontale").pz, k, bb);
    assert.equal(row("Scatola sotto letto — fianco").pz, 2 * k);
    assert.equal(row("Rotella scatola sotto letto").pz, 4 * k);
    assert.equal(b.boxes.filter(x => x.role === "cutie_fond").length, k);
  }
});
test("cutiile stau sub sponde, între pardoseală și sponde, în afara tăbliilor și fără să se atingă", () => {
  const { b } = gen({ ...BED, bedBox: "both", bedBoxN: 3 });
  const side = b.boxes.find(x => x.role === "fianco"), t = 19;
  const bx = b.boxes.filter(x => /^cutie_/.test(x.role));
  bx.forEach(x => { assert.ok(x.y0 >= 0 && x.y1 <= side.y0 - 14.9, "iese din golul de sub sponde"); assert.ok(x.z0 >= t + 19.9 && x.z1 <= 2060 - t - 19.9, "ating tăbliile"); assert.ok(x.x0 >= 0 && x.x1 <= BED.L); });
  /* cutiile din părți opuse nu se ating: stânga se termină înainte de începutul celei din dreapta */
  const gs = {}; bx.forEach(x => { (gs[x.grp] = gs[x.grp] || []).push(x); });
  const ext = Object.values(gs).map(a => ({ x0: Math.min(...a.map(q => q.x0)), x1: Math.max(...a.map(q => q.x1)), z0: Math.min(...a.map(q => q.z0)), z1: Math.max(...a.map(q => q.z1)) }));
  for (let i = 0; i < ext.length; i++) for (let j = i + 1; j < ext.length; j++) {
    const a = ext[i], c = ext[j], overlap = a.x0 < c.x1 - 0.01 && c.x0 < a.x1 - 0.01 && a.z0 < c.z1 - 0.01 && c.z0 < a.z1 - 0.01;
    assert.ok(!overlap, "două cutii se suprapun");
  }
});
test("găurire: diblu între lateral și frontal/retro, confirmat la fund; fără erori de pre-flight; pk unic", () => {
  const { o } = gen({ ...BED, bedBox: "both", bedBoxN: 2 });
  assert.ok(o.hw.some(h => h.type === "tassello") && o.hw.some(h => h.type === "confirmat"));
  assert.ok(!o.pieces.some(p => p.preflight.some(w => w.level === "error")));
  assert.equal(new Set(o.pieces.map(p => p.pk)).size, o.pieces.length);
  const bot = o.pieces.filter(p => p.role === "cutie_fond");
  bot.forEach(p => assert.ok(p.operations.filter(x => x.type === "drill").length >= 6, "fundul fără găuri de confirmat"));
});
test("erori: pereți prea joși cu un panou gros, prea multe cutii pe latură", () => {
  assert.throws(() => gen({ ...BED, bedBox: "sx", bedBoxN: 3, P: 1000 }), /mai scurte de 300/);
  S.state.settings = null;
});
test("fără cutii = patul de dinainte; deterministic", () => {
  const a = gen(BED), c = gen({ ...BED, bedBox: null });
  assert.deepEqual(a.b.pieces, c.b.pieces); assert.deepEqual(a.o, c.o);
  const d = { ...BED, bedBox: "both", bedBoxN: 2 }; assert.deepEqual(gen(d).o, gen(d).o);
});
test("fuzz: dimensiuni aleatoare", () => {
  let seed = 9; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296, ri = (a, b) => Math.round(a + rnd() * (b - a));
  let ok = 0, refused = 0;
  for (let i = 0; i < 300; i++) {
    const c = { type: "letto", L: ri(800, 2000), H: ri(700, 1200), P: ri(1700, 2300), bedBox: ["sx", "dx", "both"][ri(0, 2)], bedBoxN: ri(1, 3) };
    try { const r = gen(c);
      assert.ok(!r.o.pieces.some(p => p.preflight.some(w => w.level === "error")), JSON.stringify(c));
      assert.equal(new Set(r.o.pieces.map(p => p.pk)).size, r.o.pieces.length); ok++;
    } catch (e) { if (/mai scurte|puțin adânci|rămân doar/.test(e.message)) refused++; else throw e; }
  }
  assert.ok(ok > 100, ok + "/" + refused);
});
