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

/* ---------- v2: decupaje, tăiere la lungimea plăcii ---------- */
const J = x => JSON.parse(JSON.stringify(x));

test("normCuts: valori întregi în perete; în afara peretelui sau goale se resping", () => {
  assert.deepEqual(J(E.normCuts(null, 2400, 2600)), { ok: true, cuts: [] });
  assert.deepEqual(J(E.normCuts([{ x: "100", y: 300.4, w: 80, h: 80 }], 2400, 2600).cuts), [{ x: 100, y: 300, w: 80, h: 80 }]);
  assert.equal(E.normCuts([{ x: 2350, y: 0, w: 100, h: 80 }], 2400, 2600).reason, "cutBounds");
  assert.equal(E.normCuts([{ x: 0, y: 0, w: 0, h: 80 }], 2400, 2600).reason, "cutBounds");
  assert.equal(E.normCuts([{ x: "a", y: 0, w: 5, h: 5 }], 2400, 2600).reason, "cuts");
  assert.equal(E.normCuts(new Array(31).fill({ x: 0, y: 0, w: 5, h: 5 }), 2400, 2600).reason, "cuts");
});

test("splitEq: părți egale, suma exactă, nimic peste maxim", () => {
  assert.deepEqual(J(E.splitEq(1000, 2800)), [1000]);
  assert.deepEqual(J(E.splitEq(3000, 2800)), [1500, 1500]);
  for (let t = 1; t < 9000; t += 37) { const p = E.splitEq(t, 2800); assert.equal(p.reduce((a, b) => a + b, 0), t); assert.ok(p.every(v => v > 0 && v <= 2800), String(t)); }
});

test("slatPlan: o priză întrerupe numai lamelele atinse, restul rămân întregi; bucățile + decupajul = lungimea", () => {
  const lay = E.layout(2400, 40, 20), cut = { x: 1000, y: 300, w: 80, h: 80 };
  const pl = E.slatPlan(lay, false, 2400, 2600, [cut], 2800);
  const hit = pl.slats.filter(s => s.pieces.length !== 1 || s.pieces[0].u1 - s.pieces[0].u0 !== 2600);
  assert.ok(hit.length >= 1 && hit.length <= 3, "lamele atinse: " + hit.length);
  hit.forEach(s => { assert.equal(s.pieces.length, 2); assert.equal(s.pieces[0].u0, 0); assert.equal(s.pieces[0].u1, 300); assert.equal(s.pieces[1].u0, 380); assert.equal(s.pieces[1].u1, 2600); });
  /* lamelele nu se ating de decupaj dacă nu îl intersectează pe orizontală */
  pl.slats.forEach(s => { const touch = Math.min(s.v1, 1080) - Math.max(s.v0, 1000) > 1e-9; assert.equal(s.pieces.length === 2, touch); });
});

test("slatPlan: decupajele care se suprapun se unesc; unul la capăt lasă o singură bucată; peste lungimea plăcii se taie egal", () => {
  const lay = E.layout(400, 40, 20);
  const a = E.slatPlan(lay, false, 400, 2000, [{ x: 0, y: 0, w: 400, h: 100 }, { x: 0, y: 50, w: 400, h: 100 }], 2800);
  a.slats.forEach(s => { assert.equal(s.pieces.length, 1); assert.equal(s.pieces[0].u0, 150); assert.equal(s.pieces[0].u1, 2000); });
  const b = E.slatPlan(lay, false, 400, 3000, [], 2800);
  b.slats.forEach(s => { assert.equal(s.pieces.length, 2); assert.equal(s.pieces[0].u1 - s.pieces[0].u0 + s.pieces[1].u1 - s.pieces[1].u0, 3000); assert.equal(s.pieces[1].u0, s.pieces[0].u1); });
  const h = E.slatPlan(E.layout(1000, 50, 10), true, 3300, 1000, [], 2800);
  h.slats.forEach(s => assert.equal(s.pieces.reduce((q, p) => q + p.u1 - p.u0, 0), 3300));
  assert.equal(E.slatPlan(lay, false, 400, 2000, [{ x: 0, y: 1990, w: 400, h: 10 }], 2800).short, 0);
});

test("slatPlan: pe 2000 de combinații aleatoare, fiecare lamelă = bucăți + decupaje, fără bucată peste placă", () => {
  let seed = 99; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  let n = 0;
  for (let i = 0; i < 2000; i++) {
    const L = ri(300, 4000), H = ri(300, 3200), horiz = rnd() < .5, w = ri(15, 200), g = ri(0, 60);
    const lay = E.layout(horiz ? H : L, w, g); if (!lay.ok) continue;
    const cuts = []; for (let k = ri(0, 4); k > 0; k--) { const cw = ri(20, 200), ch = ri(20, 200); cuts.push({ x: ri(0, Math.max(0, L - cw)), y: ri(0, Math.max(0, H - ch)), w: Math.min(cw, L), h: Math.min(ch, H) }); }
    const nc = E.normCuts(cuts, L, H); if (!nc.ok) continue; n++;
    const plan = E.slatPlan(lay, horiz, L, H, nc.cuts, 2800);
    plan.slats.forEach(s => {
      const covered = (() => { /* uniunea decupajelor pe lungimea lamelei */
        const iv = []; nc.cuts.forEach(c => { const v0 = horiz ? c.y : c.x, v1 = v0 + (horiz ? c.h : c.w), u0 = horiz ? c.x : c.y, u1 = u0 + (horiz ? c.w : c.h);
          if (Math.min(s.v1, v1) - Math.max(s.v0, v0) > 1e-9) iv.push([u0, u1]); });
        iv.sort((a, b) => a[0] - b[0]); let tot = 0, cur = -1;
        iv.forEach(q => { const a = Math.max(q[0], cur); if (q[1] > a) { tot += q[1] - a; cur = q[1]; } }); return tot; })();
      const sum = s.pieces.reduce((q, p) => q + p.u1 - p.u0, 0);
      assert.ok(Math.abs(sum + covered - plan.len) < 1e-6, `lamelă ${s.v0}: ${sum}+${covered}≠${plan.len}`);
      assert.ok(s.pieces.every(p => p.u1 - p.u0 > 0 && p.u1 - p.u0 <= 2800));
    });
  }
  assert.ok(n > 1200);
});

test("sheetHoles: gaura în sistemul foii (lung = H, larg = lățimea foii); decupajul peste două foi se împarte", () => {
  const cut = { x: 1150, y: 300, w: 100, h: 80 };
  const h1 = E.sheetHoles(0, 1200, [cut]), h2 = E.sheetHoles(1200, 2400, [cut]);
  assert.deepEqual(J(h1.map(h => [h.l, h.w, h.x, h.y])), [[80, 50, 300, 1150]]);
  assert.deepEqual(J(h2.map(h => [h.l, h.w, h.x, h.y])), [[80, 50, 300, 0]]);
  assert.equal(E.sheetHoles(0, 1160, [cut]).length, 1); assert.equal(E.sheetHoles(0, 1100, [cut]).length, 0);
});
