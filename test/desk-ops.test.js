/* Birou (D-117): îmbinările blatului și ale spatelui intră în modelul de operații.
 *   node --test desk-ops.test.js */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
function gen(cfg) {
  S.handleIsProfile = () => false;
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k", matOvr: {},
    matAdd: [MM("__b", 18), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "M", matBody: "__b", matFront: "__b", matBack: "__k" }, cfg);
  const b = S.buildModule(full);
  return JSON.parse(JSON.stringify(S.generateOperations({ boxes: b.boxes, cfg: full, G: null })));
}
test("birou: blatul, laterale și spatele au găuri, fiecare în interiorul piesei", () => {
  const o = gen({ type: "scrivania", L: 1400, H: 750, P: 700 });
  assert.equal(o.pieces.length, 4);
  for (const p of o.pieces) {
    const d = p.operations.filter(x => x.type === "drill");
    assert.ok(d.length > 0, p.role + " fără găuri");
    assert.ok(!p.preflight.some(w => w.level === "error"), p.role + " are eroare de pre-flight");
  }
  assert.ok(o.hw.some(h => h.type === "minifix"));
});
test("birou: deterministic", () => {
  const c = { type: "scrivania", L: 1200, H: 740, P: 600 };
  assert.deepEqual(gen(c), gen(c));
});
