/* Corpuri rotunde (D-117): fâșia cuprinde planurile, iar prinderile intră în modelul de operații.
 *   node --test round-ops.test.js */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
function gen(cfg) {
  S.handleIsProfile = () => false;
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 3, matBody: "__b", matFront: "__b", matBack: "__k", matOvr: {},
    matAdd: [MM("__b", 19), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "M", matBody: "__b", matFront: "__b", matBack: "__k", shelves: 2, back: 0 }, cfg);
  const b = S.buildModule(full);
  return { b, o: JSON.parse(JSON.stringify(S.generateOperations({ boxes: b.boxes, cfg: full, G: null }))) };
}
const band = o => o.pieces.find(p => p.role === "fianco");
const drills = p => p.operations.filter(x => x.type === "drill");

test("fâșia are înălțimea corpului, iar planurile stau în ea (D-117)", () => {
  for (const cfg of [{ type: "tondo", L: 600, H: 900, P: 600 }, { type: "raccordato", L: 800, H: 900, P: 450, rcorner: 80 }]) {
    const { b, o } = gen(cfg);
    const row = b.pieces.find(r => r.role === "fianco");
    assert.equal(row.larg, 900, cfg.type + ": fâșia = H");
    const bb = b.boxes.find(x => x.role === "fianco");
    assert.equal(bb.y0, 0); assert.equal(bb.y1, 900);
    for (const q of b.boxes.filter(x => /^(base|cielo|ripiano)$/.test(x.role)))
      assert.ok(q.y0 >= bb.y0 && q.y1 <= bb.y1, "planul iese din fâșie");
    assert.equal(band(o).width, 900);
  }
});
test("rotund: fixări la 1/4, 1/2, 3/4 din lungimea desfășurată, înălțimea = mijlocul planului", () => {
  const { o } = gen({ type: "tondo", L: 600, H: 900, P: 600 });
  const bp = band(o), dev = bp.length, xs = [...new Set(drills(bp).map(d => d.x))].sort((a, b) => a - b);
  assert.equal(xs.length, 3);
  [0.25, 0.5, 0.75].forEach((f, i) => assert.ok(Math.abs(xs[i] - dev * f) < 0.6, "x " + xs[i] + " ≠ " + dev * f));
  for (const d of drills(bp)) { assert.equal(d.face, 5); assert.ok(d.y > 0 && d.y < 900); }
  for (const p of o.pieces) { assert.ok(drills(p).length > 0, p.role + " fără găuri"); assert.ok(!p.preflight.some(w => w.level === "error")); }
});
test("raccordato: prinderi numai pe porțiunile drepte, în interiorul benzii", () => {
  const { o } = gen({ type: "raccordato", L: 800, H: 900, P: 450, rcorner: 80 });
  const bp = band(o), r = 80, side = 450 - r, arc = Math.PI * r / 2, front = 800 - 2 * r;
  for (const d of drills(bp)) {
    const x = d.x, inSide1 = x <= side + 0.1, inFront = x >= side + arc - 0.1 && x <= side + arc + front + 0.1, inSide2 = x >= side + 2 * arc + front - 0.1;
    assert.ok(inSide1 || inFront || inSide2, "gaură în arc, x=" + x);
    assert.ok(x >= 0 && x <= bp.length);
  }
  assert.ok(drills(bp).length > 0);
  for (const p of o.pieces) assert.ok(!p.preflight.some(w => w.level === "error"));
});
test("fâșie în tronsoane: nu se găurește, avertisment", () => {
  const { o } = gen({ type: "tondo", L: 1400, H: 900, P: 1400 });
  assert.ok(o.warnings.some(w => w.k === "opsBandSeg"));
  assert.equal(drills(band(o)).length, 0);
});
test("deterministic", () => {
  const c = { type: "raccordato", L: 900, H: 800, P: 500, rcorner: 60 };
  assert.deepEqual(gen(c).o, gen(c).o);
});
