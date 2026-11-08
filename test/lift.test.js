/* Somiera ridicabilă pe pistoane (D-126): calculul forței și geometria prinderii.   node --test lift.test.js */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const ctx = {}; ctx.self = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-lift.js"), "utf8"), ctx, { filename: "ebanist-lift.js" });
const Lift = ctx.EBLift;
const base = { Lf: 2030, aDepth: 35, wallTop: 70, boxBottom: 300, alphaMax: 45 };

test("rezultat plauzibil: 48 kg la 200 cm cere ~800–1100 N pe piston (comparabil cu seturile comerciale)", () => {
  const r = Lift.design({ ...base, mass: 48 });
  assert.ok(r.ok, JSON.stringify(r));
  assert.ok(r.F >= 600 && r.F <= 1200, "F = " + r.F);
  assert.ok(r.strokeStd >= 100 && r.strokeStd <= 400);
});
test("forța crește cu greutatea și cu lungimea; ratingul e standard și ≥ necesarul", () => {
  let prev = 0;
  for (const m of [25, 40, 60, 80, 100]) { const r = Lift.design({ ...base, mass: m }); assert.ok(r.ok); assert.ok(r.F >= prev, "monoton"); prev = r.F;
    assert.ok(Lift.RATINGS.includes(r.F)); assert.ok(r.F >= Math.min(r.Freq, 1500) - 1e-9); }
  assert.ok(Lift.design({ ...base, mass: 60, Lf: 1800 }).F <= Lift.design({ ...base, mass: 60, Lf: 2030 }).F);
});
test("geometria: pistonul se alungește monoton cu unghiul, cursa în limite, brațul pozitiv, prindere pe perete sub marginea ladei", () => {
  const r = Lift.design({ ...base, mass: 60 });
  assert.ok(r.Le > r.Lc && r.stroke >= 90 && r.stroke <= 400 && r.Le / r.Lc <= 2.6);
  assert.ok(r.B.depth >= base.wallTop + 25 && r.B.depth <= base.boxBottom, "B în afara peretelui");
  let prev = 0;
  for (let a = 0; a <= 45; a += 5) { const lv = Lift.lever(r.A.z, r.A.depth, r.B.z, r.B.depth, a * Math.PI / 180); assert.ok(lv.L >= prev - 1e-6); prev = lv.L; if (a >= 20) assert.ok(lv.b > 0); }
});
test("echilibrul de momente: la fiecare unghi din 20–45° două pistoane de forța aleasă țin somiera (cu rezerva de 10 %)", () => {
  for (const m of [30, 55, 85]) {
    const r = Lift.design({ ...base, mass: m });
    if (r.warn.includes("tooHeavy")) continue;
    for (let a = 20; a <= 45; a += 5) {
      const al = a * Math.PI / 180, lv = Lift.lever(r.A.z, r.A.depth, r.B.z, r.B.depth, al);
      const torqueSprings = 2 * r.F * lv.b, torqueWeight = m * Lift.G * (r.a * Math.cos(al) - 80 * Math.sin(al));
      assert.ok(torqueSprings >= 1.1 * torqueWeight - 1e-6, m + " kg la " + a + "°: " + torqueSprings.toFixed(0) + " < " + (1.1 * torqueWeight).toFixed(0));
    }
  }
});
test("greutate prea mare sau pat prea scurt: avertisment / eșec explicit", () => {
  assert.ok(Lift.design({ ...base, mass: 400 }).warn.includes("tooHeavy"));
  const s = Lift.design({ ...base, mass: 50, Lf: 500 }); assert.equal(s.ok, false); assert.equal(s.why, "short");
  assert.equal(Lift.design({ ...base, mass: 0 }).ok, false);
});
test("determinism", () => { assert.equal(JSON.stringify(Lift.design({ ...base, mass: 62 })), JSON.stringify(Lift.design({ ...base, mass: 62 }))); });
