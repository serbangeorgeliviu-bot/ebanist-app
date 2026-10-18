/* Ebanist — audit 18.10.2026 (#4): axa grosimii a unui pachet fizic.
 *
 *   node --test test/thickaxis.test.js
 *
 * Cea mai scurtă extensie e grosimea, în afară de o fâșie mai îngustă decât
 * grosimea ei; acolo decide rolul (ROLE_AXES), numai dacă axa nu e cea mai lungă.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine();
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });

const box = (role, pk, x0, x1, y0, y1, z0, z1) => ({ role, pk, x0, x1, y0, y1, z0, z1 });
const gen = boxes => Array.from(S.generateOperations({ boxes, cfg: {}, G: {} }).pieces);
const sides = [box("fianco", "f1", 0, 18, 0, 700, 0, 500), box("fianco", "f2", 618, 636, 0, 700, 0, 500)];

test("tavan de 18 mm, adânc doar 15: grosimea rămâne 18", () => {
  const c = gen(sides.concat(box("cielo", "c", 18, 618, 682, 700, 0, 15))).find(p => p.role === "cielo");
  assert.equal(c.thickness, 18);
});
test("panou normal: neschimbat", () => {
  const c = gen(sides.concat(box("cielo", "c", 18, 618, 682, 700, 0, 500))).find(p => p.role === "cielo");
  assert.equal(c.thickness, 18);
});
test("rol necunoscut: rămâne cea mai scurtă extensie", () => {
  const p = gen([box("zzz", "z", 0, 10, 0, 300, 0, 200)]);
  assert.equal(p.length, 0);
});
