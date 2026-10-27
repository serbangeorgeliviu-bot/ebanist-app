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

/* ---------- boiserie cu rame și câmpuri (D-97) ---------- */
test("frameN: (n+1)·ramă + n·câmp + rest = lungimea, exact, în mm întregi", () => {
  const f = E.frameN(2400, 60, 4);
  assert.equal(f.ok, true); assert.equal(f.field, 525); assert.equal(f.extraA + f.extraB, 0);
  assert.equal(f.strips.length, 5); assert.equal(f.fields.length, 4);
  assert.equal(f.strips[0].a, 0); assert.equal(f.strips[4].b, 2400);
  const g = E.frameN(2403, 60, 4); /* rest 3: capetele iau 1 și 2 */
  assert.equal(g.field, 525); assert.equal(g.extraA, 1); assert.equal(g.extraB, 2);
  assert.equal(g.strips[0].b - g.strips[0].a, 61); assert.equal(g.strips[4].b - g.strips[4].a, 62); assert.equal(g.strips[4].b, 2403);
});

test("frameN: câmp prea mic, ramă în afara intervalului, n invalid se resping", () => {
  assert.equal(E.frameN(300, 60, 4).reason, "tooSmall");
  assert.equal(E.frameN(2400, 10, 4).reason, "dim");
  assert.equal(E.frameN(2400, 60, 0).reason, "dim");
  assert.equal(E.frameN(0, 60, 2).reason, "dim");
});

test("frameFit: n cel mai apropiat de câmpul dorit; scade dacă nu încape", () => {
  assert.equal(E.frameFit(2400, 60, 600).n, 4);
  assert.equal(E.frameFit(2400, 60, 1000).n, 2);
  const s = E.frameFit(500, 60, 100); assert.equal(s.ok, true); assert.ok(s.field >= 40);
  assert.equal(E.frameFit(2400, 60, 50).reason, "dim");
});

test("frame: pe 3000 de combinații aleatoare, ramele + câmpurile acoperă exact lungimea, fără goluri sau suprapuneri", () => {
  let seed = 4242; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  let ok = 0;
  for (let i = 0; i < 3000; i++) {
    const span = ri(300, 6000), fw = ri(20, 200), n = ri(1, 12), f = E.frameN(span, fw, n); if (!f.ok) continue; ok++;
    const all = []; for (let k = 0; k < f.n; k++) { all.push(f.strips[k]); all.push(f.fields[k]); } all.push(f.strips[f.n]);
    assert.equal(all[0].a, 0); assert.equal(all[all.length - 1].b, span);
    for (let k = 1; k < all.length; k++) assert.equal(all[k].a, all[k - 1].b);
    assert.ok(all.every(q => q.b > q.a && Number.isInteger(q.a) && Number.isInteger(q.b)));
    assert.ok(f.fields.every(q => q.b - q.a === f.field));
  }
  assert.ok(ok > 1200);
});

/* ---------- colț între doi pereți (D-98) ---------- */
const bx = (x0, x1, y0, y1, z0, z1) => ({ x0, x1, y0, y1, z0, z1, role: "lamela", pk: 1 });
const ovl = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 1e-9 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 1e-9 && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > 1e-9;

test("splitCuts: decupajele din B se dau de la colț; la colțul interior se mută cu grosimea, înaintea ei se resping", () => {
  const r = E.splitCuts([{ x: 100, y: 5, w: 10, h: 10 }, { wall: "B", x: 300, y: 5, w: 10, h: 10 }], 34, "int");
  assert.equal(r.ok, true); assert.equal(r.A.length, 1); assert.equal(r.B[0].x, 266);
  assert.equal(E.splitCuts([{ wall: "B", x: 10, y: 0, w: 5, h: 5 }], 34, "int").reason, "cutCorner");
  assert.equal(E.splitCuts([{ wall: "B", x: 10, y: 0, w: 5, h: 5 }], 34, "ext").B[0].x, 10);
  assert.deepEqual(J(E.splitCuts(null, 34, "int")), { ok: true, A: [], B: [] });
});

test("cornerPlace: patru colțuri, B nu intră în A și atinge fața lui A (interior) sau capătul lui (exterior)", () => {
  const LA = 2000, t = 34;
  const A = [bx(0, LA, 0, 2600, 0, t)];
  const Bl = [bx(0, 40, 0, 2600, 0, t), bx(100, 140, 0, 2600, 0, t), bx(900, 1000, 0, 2600, 0, t)];
  for (const kind of ["int", "ext"]) for (const side of ["sx", "dx"]) {
    const P = E.shiftToOrigin(A.map(b => ({ ...b })).concat(E.cornerPlace(Bl, { LA, t, kind, side })));
    const a = P[0], bs = P.slice(1);
    bs.forEach(b => assert.equal(ovl(a, b), false, kind + side));
    P.forEach(b => assert.ok(b.x0 >= -1e-9 && b.z0 >= -1e-9, "origine " + kind + side));
    if (kind === "int") { /* B începe exact la fața lui A și rămâne în interiorul lățimii lui A */
      const zmin = Math.min(...bs.map(b => b.z0)) - a.z0; assert.ok(Math.abs(zmin - t) < 1e-9, kind + side + " " + zmin);
      bs.forEach(b => assert.ok(b.x0 >= a.x0 - 1e-9 && b.x1 <= a.x1 + 1e-9, "în lățimea lui A")); }
    else { bs.forEach(b => assert.ok(b.x0 >= a.x1 - 1e-9 || b.x1 <= a.x0 + 1e-9, "în afara lățimii lui A")); }
  }
});

test("cornerPlace: B local de la 0 la lungime acoperă exact lungimea pe axa z a modulului", () => {
  const out = E.cornerPlace([bx(0, 1000, 0, 100, 0, 34)], { LA: 2000, t: 34, kind: "int", side: "dx" });
  assert.equal(out[0].z0, 34); assert.equal(out[0].z1, 1034); assert.equal(out[0].x0, 2000 - 34); assert.equal(out[0].x1, 2000);
  const e = E.cornerPlace([bx(0, 1000, 0, 100, 0, 34)], { LA: 2000, t: 34, kind: "ext", side: "dx" });
  assert.equal(e[0].z0, 0); assert.equal(e[0].z1, 1000); assert.equal(e[0].x0, 2000); assert.equal(e[0].x1, 2034);
});

/* ---------- panou încastrat în ramă (D-100) ---------- */
test("insetOk: panoul încape în rama de grosime tf și lățime fw, cu cel puțin 3 mm rămas pe fiecare parte", () => {
  assert.equal(E.insetOk(60, 18, 8), true);
  assert.equal(E.insetOk(60, 18, 12), true);
  assert.equal(E.insetOk(60, 18, 13), false, "rămân 2,5 mm");
  assert.equal(E.insetOk(60, 18, 0), false);
  assert.equal(E.insetOk(12, 18, 8), false, "ramă prea îngustă pentru canal");
  assert.equal(E.INSET.verificat, false);
});

test("panelHoles: gaura în sistemul panoului (lung vertical, larg orizontal), tăiată la marginile panoului", () => {
  const f = [0, 500, 0, 1000];   /* câmp 500×1000, panou 516×1016 (gd 8) */
  const h = E.panelHoles(100, 600, 200, 1200, [{ x: 300, y: 400, w: 80, h: 80 }]);
  assert.deepEqual(J(h.map(q => [q.l, q.w, q.x, q.y])), [[80, 80, 400 - (200 - 8), 300 - (100 - 8)]]);
  assert.equal(E.panelHoles(100, 600, 200, 1200, [{ x: 2000, y: 400, w: 80, h: 80 }]).length, 0);
  /* un decupaj în ramă dar care intră în canal dă gaură numai pe porțiunea din panou */
  const g = E.panelHoles(100, 600, 200, 1200, [{ x: 600, y: 400, w: 100, h: 80 }]);
  assert.equal(g.length, 1); assert.equal(g[0].w, 8);
});
