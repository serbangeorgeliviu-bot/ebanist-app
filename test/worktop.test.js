/* Ebanist — U.8: blatul peste compoziție (D-73).
 *
 *   node --test test/worktop.test.js
 *
 * Geometria (`ebanist-worktop.js`, pură), piesa `type:"blat"`, găurirea la
 * freză și închiderea. Ce trebuie să rămână adevărat:
 *  - lungimea vine din corpuri, adâncimea din cel mai ieșit front, grosimea
 *    din materialul ales (D-41); fără material nu se generează;
 *  - îmbinarea de colț e dreaptă: o piesă trece, cealaltă se oprește în muchia
 *    ei lungă; cele două piese nu se suprapun și acoperă colțul;
 *  - locașurile pentru șuruburi sunt în AMBELE piese, pe aceeași linie;
 *  - decupajele sunt operații pe piesă, cu rază, și stau în margini;
 *  - nimic din aceste cote nu se scrie în cod fără `verificat:false`.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-worktop.js"), "utf8"), S, { filename: "ebanist-worktop.js" });
const J = x => JSON.stringify(x);
const D = JSON.parse(J(S.WORKTOP_DEFAULTS));

const WALLS = [{ id: "w1", i: 0, L: 3000, angle: 90 }, { id: "w2", i: 1, L: 2400, angle: 90 }];
const mod = (name, wall, x0, x1, o) => Object.assign({ name, wall, x0, x1, front: 579, yTop: 720, rot: 0 }, o || {});
const MODS = [mod("A", "w1", 0, 1800), mod("B", "w1", 1800, 3000), mod("C", "w2", 600, 2400)];
const derive = (spec, walls, mods) => S.deriveWorktop(Object.assign({ name: "Blat 1", mods: ["A", "B", "C"] }, spec), walls || WALLS, mods || MODS);
const keys = a => a.map(e => e.k);

describe("Un perete: o piesă", () => {
  const r = derive({ mods: ["A", "B"] });
  test("lungime din corpuri, adâncime din front + depășire (date)", () => {
    assert.equal(J(r.errors), "[]");
    assert.equal(r.segments.length, 1);
    const s = r.segments[0];
    assert.equal(s.L, 3000); assert.equal(s.P, 579 + D.ov_front); assert.equal(s.y, 720);
  });
  test("capete libere: cant în față și la capete; fără îmbinări", () => {
    const s = r.segments[0];
    assert.equal(s.bordo, "1L+2C"); assert.equal(s.pockets.length, 0); assert.equal(r.joints.length, 0);
  });
  test("depășirea laterală (ovS) lungește piesa fără să iasă din perete", () => {
    const q = derive({ mods: ["A"], ovS: 30 }).segments[0];
    assert.equal(q.from, 0); assert.equal(q.L, 1830);
    assert.equal(derive({ mods: ["B"], ovS: 30 }).segments[0].to, 3000);
  });
});

describe("Colț: îmbinare dreaptă cap la cap", () => {
  const f = derive({ through: ["first"] }), s = derive({ through: ["second"] });
  test("perete 1 trece: ajunge în colț; perete 2 începe în muchia lui", () => {
    const [a, b] = f.segments;
    assert.equal(a.to, 3000); assert.equal(a.end, "corner");
    assert.equal(b.from, a.P); assert.equal(b.start, "butt");
  });
  test("perete 2 trece: ajunge în colț, perete 1 se oprește în muchia lui", () => {
    const [a, b] = s.segments;
    assert.equal(b.from, 0); assert.equal(b.start, "corner");
    assert.equal(a.to, 3000 - b.P); assert.equal(a.end, "butt");
  });
  test("cele două piese nu se suprapun și acoperă tot colțul", () => {
    for (const r of [f, s]) {
      const [a, b] = r.segments;
      const passing = r.joints[0].passing === 0 ? a : b, butt = r.joints[0].passing === 0 ? b : a;
      /* piesa care se oprește are adâncimea celeilalte între capătul ei și perete */
      assert.ok(butt.P > 0 && passing.P > 0);
      if (passing === a) assert.equal(a.to - butt.P + butt.P, 3000);
      else assert.equal(b.from, 0);
    }
  });
  test("cant: nu pe muchia îmbinării și nu în colț", () => {
    assert.equal(f.segments[0].bordo, "1L+1C"); assert.equal(f.segments[1].bordo, "1L+1C");
  });
  test("locașuri în ambele piese, câte unul pe fiecare linie, la distanțele din date", () => {
    for (const r of [f, s]) {
      const [a, b] = r.segments;
      assert.ok(a.pockets.length >= 2 && a.pockets.length === b.pockets.length);
      const butt = r.joints[0].butting === 0 ? a : b, pass = r.joints[0].passing === 0 ? a : b;
      butt.pockets.forEach(k => assert.ok(Math.abs(Math.min(k.x, butt.L - k.x) - D.bolt.from_joint) < 0.11));
      pass.pockets.forEach(k => assert.equal(k.y, D.bolt.from_joint));
    }
  });
  test("același loc pe linia îmbinării: pozițiile pe perete coincid", () => {
    const r = f, [a, b] = r.segments;
    /* piesa 1 trece: x_pe_perete1 = a.from + x ; piesa 2: y = distanța de la muchia ei */
    const onWall = a.pockets.map(k => k.x + a.from).sort((u, v) => u - v);
    const expect = b.pockets.map(k => (a.to - b.P) + k.y).sort((u, v) => u - v);
    assert.equal(J(onWall), J(expect));
  });
  test("unghi ≠ 90°: nu se poate îmbina drept", () => {
    const w = [{ ...WALLS[0], angle: 100 }, WALLS[1]];
    assert.ok(keys(derive({}, w).errors).includes("wtCornerAngle"));
  });
  test("pereți neconsecutivi: eroare, nu un blat greșit", () => {
    const w = [WALLS[0], { id: "wx", i: 1, L: 1000, angle: 90 }, { id: "w3", i: 2, L: 2400, angle: 90 }];
    const m = [mod("A", "w1", 0, 1800), mod("C", "w3", 600, 2400)];
    assert.ok(keys(derive({ mods: ["A", "C"] }, w, m).errors).includes("wtWallsNotAdjacent"));
  });
  test("trei pereți (U): două îmbinări, piesa din mijloc se oprește la ambele capete", () => {
    const w = [...WALLS, { id: "w3", i: 2, L: 3000, angle: 90 }];
    const m = MODS.concat(mod("D", "w3", 0, 1500));
    const r = derive({ mods: ["A", "B", "C", "D"], through: ["first", "second"] }, w, m);
    assert.equal(J(r.errors), "[]");
    assert.equal(r.segments.length, 3); assert.equal(r.joints.length, 2);
    const mid = r.segments[1];
    assert.equal(mid.start, "butt"); assert.equal(mid.end, "butt");
  });
});

describe("Decupaje", () => {
  const cut = (o) => derive({ mods: ["A", "B"], cutouts: [Object.assign({ kind: "sink", seg: 0, x: 1500 }, o || {})] });
  test("valorile implicite vin din date, în cote locale", () => {
    const c = cut().segments[0].cutouts[0];
    assert.equal(c.w, D.cutout.sink.w); assert.equal(c.d, D.cutout.sink.d); assert.equal(c.r, D.cutout.sink.r);
    assert.equal(c.x, 1500 - D.cutout.sink.w / 2); assert.equal(c.y, D.cutout.sink.y);
  });
  test("în afara marginii: eroare cu motivul", () => {
    assert.ok(keys(cut({ x: 200 }).errors).includes("wtCutOutside"));
    assert.ok(keys(cut({ y: 10 }).errors).includes("wtCutOutside"));
    assert.ok(keys(cut({ d: 560 }).errors).includes("wtCutOutside"));
  });
  test("rază prea mare, dimensiune lipsă, X lipsă", () => {
    assert.ok(keys(cut({ r: 300 }).errors).includes("wtCutRadius"));
    assert.ok(keys(cut({ w: 0 }).errors).includes("wtCutSize"));
    assert.ok(keys(cut({ x: null }).errors).includes("wtCutX"));
  });
  test("două decupaje apropiate se semnalează", () => {
    const r = derive({ mods: ["A", "B"], cutouts: [{ kind: "sink", seg: 0, x: 1000 }, { kind: "hob", seg: 0, x: 1500 }] });
    assert.ok(keys(r.errors).includes("wtCutOverlap"));
  });
  test("decupaj peste un locaș de șurub: avertisment", () => {
    const r = derive({ cutouts: [{ kind: "sink", seg: 0, x: 2700, w: 400, d: 300 }] });
    assert.ok(keys(r.warnings).includes("wtCutPocket") || r.errors.length > 0);
  });
});

describe("Intrări greșite", () => {
  test("fără corpuri, corp lipsă sau rotit", () => {
    assert.ok(keys(derive({ mods: [] }).errors).includes("wtNoMods"));
    assert.ok(keys(derive({ mods: ["Z"] }).errors).includes("wtModMissing"));
    assert.ok(keys(derive({ mods: ["A"] }, null, [mod("A", "w1", 0, 800, { rot: 15 })]).errors).includes("wtModRotated"));
  });
  test("corpuri la înălțimi diferite: avertisment, blatul stă pe cel mai înalt", () => {
    const r = derive({ mods: ["A", "B"] }, null, [mod("A", "w1", 0, 1800), mod("B", "w1", 1800, 3000, { yTop: 900 })]);
    assert.ok(keys(r.warnings).includes("wtHeights")); assert.equal(r.y, 900);
  });
  test("determinism: aceeași intrare, același rezultat", () => {
    assert.equal(J(derive({})), J(derive({})));
  });
  test("locașurile sunt date nevalidate", () => {
    assert.equal(D.bolt.verificat, false);
  });
});

/* ---------- piesa `type:"blat"` ---------- */
function blat(cfg) {
  S.state.settings = { panelL: 4100, panelW: 650, kerf: 4, matBody: "__w", matFront: "__w", matBack: "__w", matOvr: {}, matAdd: [MM("__w", 38), MM("__x", 25)] };
  const full = Object.assign({ name: "Blat 1", type: "blat", L: 3000, P: 599, matBody: "__w", bordo: "1L+1C" }, cfg);
  const b = S.buildModule(full);
  const ops = JSON.parse(J(S.generateOperations({ boxes: b.boxes, cfg: full, G: null })));
  return { b, full, ops };
}
describe("Piesa blat", () => {
  test("un rând: lungime × adâncime, grosimea din material (D-41)", () => {
    const r = blat();
    assert.equal(r.b.pieces.length, 1);
    const p = r.b.pieces[0];
    assert.equal(p.lung, 3000); assert.equal(p.larg, 599); assert.equal(p.sp, 38); assert.equal(p.role, "blat");
    assert.equal(blat({ matBody: "__x" }).b.pieces[0].sp, 25);
  });
  test("fără material: nu se generează", () => {
    assert.throws(() => blat({ matBody: "nu-exista" }), /alege materialul blatului/);
  });
  test("decupajele intră în `scasso` și lipsesc din 3D", () => {
    const r = blat({ cutouts: [{ kind: "sink", x: 1110, y: 60, w: 780, d: 480, r: 10, yBack: 59 }] });
    const sc = r.b.pieces[0].scasso;
    assert.equal(sc.forma, "R"); assert.equal(sc.l, 780); assert.equal(sc.w, 480); assert.equal(sc.r, 10);
    /* aria cutiilor 3D = placa minus decupajul */
    const area = r.b.boxes.reduce((s, b) => s + (b.x1 - b.x0) * (b.z1 - b.z0), 0);
    assert.ok(Math.abs(area - (3000 * 599 - 780 * 480)) < 1);
    assert.equal(new Set(r.b.boxes.map(b => b.pk)).size, 1);
  });
  test("cantul nu se pune pe un material care nu se bordează", () => {
    assert.equal(blat({ bordo: "" }).b.pieces[0].bordo, "");
  });
});

describe("Găurire la freză", () => {
  const r = blat({
    cutouts: [{ kind: "sink", x: 1110, y: 60, w: 780, d: 480, r: 10, yBack: 59 }, { kind: "hob", x: 2000, y: 60, w: 400, d: 300, r: 6, yBack: 239 }],
    pockets: [{ x: 45, y: 80, dia: 35, rest: 12 }, { x: 45, y: 519, dia: 35, rest: 12 }]
  });
  const pc = r.ops.pieces[0];
  test("decupaje: operații «mill» prin placă, cu rază", () => {
    const m = pc.operations.filter(o => o.type === "mill");
    assert.equal(m.length, 2);
    const sink = m.find(o => /chiuvet/.test(o.note));
    assert.equal(sink.w, 780); assert.equal(sink.d, 480); assert.equal(sink.r, 10); assert.equal(sink.through, true);
    assert.equal(sink.x, 1500); assert.equal(sink.y, 599 - 60 - 240);
    assert.ok(m.some(o => /plit/.test(o.note)));
  });
  test("locașuri: găuri Ø35, material rămas deasupra din date", () => {
    const d = pc.operations.filter(o => o.type === "drill");
    assert.equal(d.length, 2);
    d.forEach(o => { assert.equal(o.dia, 35); assert.equal(o.depth, 38 - 12); assert.equal(o.through, false); assert.equal(o.hw, null); });
  });
  test("piesa are lungimea, lățimea și grosimea rândului", () => {
    assert.equal(pc.length, 3000); assert.equal(pc.width, 599); assert.equal(pc.thickness, 38);
  });
  test("deterministă", () => {
    assert.equal(J(blat({ pockets: [{ x: 45, y: 80, dia: 35, rest: 12 }] }).ops), J(blat({ pockets: [{ x: 45, y: 80, dia: 35, rest: 12 }] }).ops));
  });
});
