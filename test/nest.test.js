/* ebanist-nest.js — optimizarea tăierii (pur). Mutat din index.html în 5.79.0; rezultatul trebuie să fie același. */
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const N = new Function(fs.readFileSync(path.join(__dirname, "../app/ebanist-nest.js"), "utf8") + "\nreturn globalThis.EBNest;")();
const P = (lung, larg, pz, extra) => Object.assign({ lung, larg, pz }, extra || {});
const cut = x => ({ L: x.lung, W: x.larg });

test("toate piesele încap pe plăci, fără suprapuneri și fără ieșiri din placă", () => {
  const r = N.nest([P(800, 400, 6), P(720, 560, 4), P(2000, 300, 2), P(500, 500, 5)], 2800, 2070, 4, null, cut);
  assert.strictEqual(r.skipped.length, 0);
  let n = 0;
  for (const b of r.panels) {
    for (const a of b.rects) { n++; assert.ok(a.x >= 0 && a.y >= 0 && a.x + a.w <= b.L + 1e-6 && a.y + a.h <= b.W + 1e-6); }
    for (let i = 0; i < b.rects.length; i++) for (let j = i + 1; j < b.rects.length; j++) {
      const a = b.rects[i], c = b.rects[j];
      assert.ok(a.x + a.w <= c.x || c.x + c.w <= a.x || a.y + a.h <= c.y || c.y + c.h <= a.y, "suprapunere");
    }
  }
  assert.strictEqual(n, 17);
});
test("piesă mai mare decât placa → skipped; fibra (grain) nu se rotește", () => {
  const r = N.nest([P(3000, 100, 1), P(2000, 2500, 1, { grain: true })], 2800, 2070, 4, null, cut);
  assert.strictEqual(r.skipped.length, 2);
});
test("determinism: același input → același plan", () => {
  const a = N.nest([P(800, 400, 6), P(720, 560, 4)], 2800, 2070, 4, null, cut);
  const b = N.nest([P(800, 400, 6), P(720, 560, 4)], 2800, 2070, 4, null, cut);
  assert.deepStrictEqual(JSON.stringify(a.panels.map(p => [p.rects, p.cuts])), JSON.stringify(b.panels.map(p => [p.rects, p.cuts])));
});
test("cotele de tăiere vin din cutLW, nu din cota finită", () => {
  const r = N.nest([P(1000, 1000, 1)], 1020, 1020, 4, null, x => ({ L: x.lung + 50, W: x.larg + 50 }));
  assert.strictEqual(r.skipped.length, 1);
});
test("stoc: resturile se folosesc întâi", () => {
  const r = N.nest([P(400, 300, 1)], 2800, 2070, 4, [{ L: 500, W: 400 }], cut);
  assert.strictEqual(r.panels.length, 1);
  assert.ok(r.panels[0].stock);
});
