/* Lambriul cu lamele (app/ebanist-lambriu.js). Rulează: node --test lambriu.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm"), fs = require("node:fs"), path = require("node:path");
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-lambriu.js"), "utf8"), ctx);
const E = ctx.EBLambriu;

test("layout: numărul și rostul închid exact lungimea", () => {
  const l = E.layout(3000, 40, 20);
  assert.equal(l.ok, true); assert.equal(l.n, 50);
  assert.ok(Math.abs(l.n * 40 + (l.n - 1) * l.gap - 3000) < 1e-9);
  assert.ok(Math.abs(l.gap - (3000 - 2000) / 49) < 1e-12);
  assert.equal(l.xs[0], 0); assert.ok(Math.abs(l.xs[l.n - 1] + 40 - 3000) < 1e-9, "ultima lamelă se termină exact la capăt");
});

test("layout: un caz fără rost fracționar și unul cu", () => {
  const a = E.layout(1000, 40, 20); /* 17 lamele, 16 rosturi: rost 20 exact? 17*40=680, 320/16=20 */
  assert.equal(a.n, 17); assert.ok(Math.abs(a.gap - 20) < 1e-12);
  const b = E.layout(1003, 40, 20);
  assert.equal(b.n, 17); assert.ok(Math.abs(b.gap - 323 / 16) < 1e-12);
});

test("layout: o lamelă singură se centrează; prea lată și valori ieșite din interval se resping", () => {
  const s = E.layout(60, 50, 20);
  assert.equal(s.n, 1); assert.equal(s.xs[0], 5);
  assert.equal(E.layout(40, 50, 10).reason, "tooWide");
  assert.equal(E.layout(1000, 5, 10).reason, "width");
  assert.equal(E.layout(1000, 40, -1).reason, "gap");
  assert.equal(E.layout(0, 40, 10).reason, "span");
  assert.equal(E.layout(NaN, 40, 10).reason, "span");
});

test("layout: avertismente pentru rost strâns și pentru rost mult diferit de cel dorit", () => {
  assert.ok(E.layout(1000, 99, 2).warn.indexOf("tightGap") >= 0 || E.layout(1000, 99, 2).gap >= 3);
  const t = E.layout(200, 98, 0); /* 2 lamele de 98 -> rost 4 */
  assert.equal(t.n, 2);
  const w = E.layout(130, 60, 10);
  assert.ok(w.ok);
});

test("închidere: pe 3000 de combinații aleatoare suma e exactă", () => {
  let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  let bad = 0, ok = 0;
  for (let i = 0; i < 3000; i++) {
    const span = Math.round(200 + rnd() * 4800), w = Math.round(10 + rnd() * 140), g = Math.round(rnd() * 80);
    const l = E.layout(span, w, g); if (!l.ok) continue; ok++;
    const first = l.xs[0], last = l.xs[l.n - 1] + l.w;
    if (!E.closure(l) || first < -1e-9 || last > span + 1e-9 || (l.n > 1 && (Math.abs(first) > 1e-9 || Math.abs(last - span) > 1e-9))) bad++;
    for (let k = 1; k < l.n; k++) if (Math.abs((l.xs[k] - (l.xs[k - 1] + l.w)) - l.gap) > 1e-9) bad++;
  }
  assert.ok(ok > 2000); assert.equal(bad, 0);
});

test("suportul din foi: suma lățimilor e exact lungimea, nimic nu depășește placa", () => {
  const a = E.backSheets(2501, 2400, 2800, 2070);
  assert.equal(a.ok, true);
  assert.equal(a.groups.reduce((s, g) => s + g.larg * g.pz, 0), 2501);
  assert.ok(a.groups.every(g => g.larg <= 2070));
  const b = E.backSheets(1800, 2600, 2800, 2070);
  assert.deepEqual(JSON.parse(JSON.stringify(b.groups)), [{ larg: 1800, pz: 1 }]);
  assert.equal(E.backSheets(1000, 2900, 2800, 2070).reason, "tooTall");
  const c = E.backSheets(6200, 2400, 2800, 2070);
  assert.equal(c.groups.reduce((s, g) => s + g.larg * g.pz, 0), 6200);
  for (let w = 100; w < 9000; w += 137) { const r = E.backSheets(w, 2000, 2800, 2070);
    assert.equal(r.groups.reduce((s, g) => s + g.larg * g.pz, 0), w, String(w)); assert.ok(r.groups.every(g => g.larg <= 2070 && g.larg > 0)); }
});
