/* Ebanist — D-86: corp cu tavan înclinat (sub scară, mansardă), pasul 1.
 *
 *   node --test test/topprofile.test.js
 *
 * `topProfile` = {axis, h0, h1}: tavanul urmează o dreaptă între două înălțimi, de la pardoseală,
 * la fața DE SUS a tavanului. axis "x": panta pe lățime (h0 stânga, h1 dreapta); axis "z": pe
 * adâncime (h0 în față, h1 în spate). Ce trebuie să rămână adevărat:
 *  - fără profil nimic nu se schimbă (distinta, G fără `slope`, D-39);
 *  - cotele plate derivate sunt ale corpului la capătul scund; tavanul are t / cos θ pe verticală;
 *  - învelișul urmează panta: laterale, tavan (lungime pe pantă, bevel), despărțitoare, spate, uși;
 *  - închiderea (D-43) se verifică la ambele capete și prinde o piesă greșită cu mai mult de 0,5 mm;
 *  - combinațiile pe care pasul 1 nu le acoperă sunt erori declarate, nu alegeri tăcute;
 *  - în ops, piesele pe pantă sunt marcate și nu primesc îmbinări pe muchia oblică.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
const J = x => JSON.stringify(x);
const TOL = S.TOPPROFILE.tol;

function build(cfg) {
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__b",
    matOvr: {}, matAdd: [MM("__b", 19), MM("pfl5", 5)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "B", type: "standard", L: 1200, H: 2200, P: 560, plinth: 100, tram: 1, shelves: 2, drawers: 0,
    doors: 2, back: 1, hang: 0, support: "zoccolo", matBody: "__b", matFront: "__b", matBack: "__b", drawerSys: "legno" }, cfg);
  const b = S.buildModule(full);
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  return { b, full, G, pieces: b.pieces.map(x => Object.assign({}, x)), boxes: b.boxes,
    closure: pcs => S.validateCarcassClosure({ L: full.L, H: full.H, P: full.P }, pcs || b.pieces, G),
    invariants: () => S.failedInvariants({ L: full.L, H: full.H, P: full.P, doors: full.doors }, b.pieces, G),
    ops: () => JSON.parse(J(S.generateOperations({ boxes: b.boxes, cfg: full, G }))) };
}
const rows = (r, re) => r.pieces.filter(p => re.test(p.elemento));
const X = { axis: "x", h0: 2200, h1: 1600 }, Z = { axis: "z", h0: 2200, h1: 1500 };

describe("Fără profil: nimic nu se schimbă", () => {
  const a = build({}), b = build({ topProfile: null });
  test("G nu are `slope`, iar distinta e aceeași cu sau fără cheie", () => {
    assert.equal(a.G.slope, undefined);
    assert.equal(J(a.pieces.map(x => [x.elemento, x.lung, x.larg, x.pz])), J(b.pieces.map(x => [x.elemento, x.lung, x.larg, x.pz])));
  });
  test("nicio cutie cu profil `vp`, niciun rând cu poly/bevel/xc", () => {
    assert.equal(a.boxes.filter(x => x.vp).length, 0);
    assert.equal(a.pieces.filter(x => x.poly || x.bevel || x.xc != null).length, 0);
  });
});

describe("deriveCarcass: profilul și cotele plate", () => {
  const g = build({ topProfile: X }).G, S0 = g.slope;
  test("unghiul, secanta și lungimea de rulare vin din cote", () => {
    assert.equal(S0.run, g.Wi);
    assert.ok(Math.abs(S0.tan - 600 / g.Wi) < 1e-12);
    assert.ok(Math.abs(S0.sec - Math.sqrt(1 + S0.tan * S0.tan)) < 1e-12);
    assert.ok(Math.abs(S0.deg - Math.atan(S0.tan) * 180 / Math.PI) < 1e-9);
    assert.equal(S0.H_hi, 2200); assert.equal(S0.H_lo, 1600);
  });
  test("tavanul ține pe verticală t / cos θ, cu precizie plină", () => {
    assert.ok(Math.abs(S0.t_vert - g.sp_cielo * S0.sec) < 1e-12);
    assert.equal(g.sp_top, S0.t_vert);
  });
  test("lumina interioară plată e cea a capătului scund", () => {
    const flat = S.deriveCarcass(S.carcassParams({ L: 1200, H: 1600, P: 560, plinth: 100, support: "zoccolo", tram: 1, doors: 2, back: 1,
      matBody: "__b", matFront: "__b", matBack: "__b" }, {}));
    assert.ok(Math.abs(g.H_int - (flat.H_int - (S0.t_vert - flat.sp_top))) <= 1);
  });
  test("linia tavanului trece prin colțurile de sus interioare", () => {
    assert.ok(Math.abs(S.topLineY(g, g.sp_fianco, 0) - 2200) < 1e-9);
    assert.ok(Math.abs(S.topLineY(g, 1200 - g.sp_fianco, 0) - 1600) < 1e-9);
    const gz = build({ topProfile: Z }).G;
    assert.ok(Math.abs(S.topLineY(gz, 0, gz.in.D) - 2200) < 1e-9, "față");
    assert.ok(Math.abs(S.topLineY(gz, 0, 0) - 1500) < 1e-9, "spate");
  });
  test("o cheie `slope` nouă nu atinge cotele de rând ale unui corp drept", () => {
    const a = build({}).G, b = build({ topProfile: null }).G;
    assert.equal(J(a), J(b));
  });
});

describe("Erori declarate", () => {
  const bad = (cfg, re) => assert.throws(() => build(cfg), re);
  test("axă necunoscută", () => bad({ topProfile: { axis: "y", h0: 2200, h1: 1600 } }, /axis/));
  test("H diferit de cota cea mai înaltă", () => bad({ H: 2000, topProfile: X }, /cota cea mai înaltă/));
  test("diferență sub 20 mm", () => bad({ topProfile: { axis: "x", h0: 2200, h1: 2190 } }, /sub 20 mm/));
  test("pantă peste 60°", () => bad({ topProfile: { axis: "z", h0: 2200, h1: 300 } }, /depășește 60/));
  test("lumină interioară prea mică la capătul scund", () => bad({ topProfile: { axis: "x", h0: 2200, h1: 200 } }, /lumină interioară|depășește/));
  test("cote absolute", () => bad({ topProfile: X, partitions: [{ x: 600, y0: 119, y1: 1500 }] }, /cotele absolute/));
  test("unghi în plan", () => bad({ topProfile: X, angL: 80 }, /unghiurile în plan/));
  test("altă tipologie decât standard", () => bad({ topProfile: X, type: "scorrevole" }, /doar pe tipologia standard/));
  test("spate aplicat", () => bad({ topProfile: X, backMode: "applicato" }, /spatele aplicat/));
  test("tavan din două traverse", () => bad({ topProfile: X, top: "traverse", topRailW: 100 }, /traverse/));
  test("treapta din perete", () => bad({ topProfile: X, stepH: 200, stepP: 60 }, /treapta/));
  test("gola", () => bad({ topProfile: X, handles: "gola" }, /gola/));
});

describe("Panta pe lățime (axis x)", () => {
  const r = build({ topProfile: X }), g = r.G, SL = g.slope;
  test("două rânduri de laterale, de înălțimi diferite, câte unul", () => {
    const f = r.pieces.filter(p => p.role === "fianco");
    assert.equal(f.length, 2);
    assert.equal(f.find(p => p.xc < 600).lung, 2200); assert.equal(f.find(p => p.xc > 600).lung, 1600);
    f.forEach(p => assert.equal(p.pz, 1));
  });
  test("tavanul: un singur panou, lungime = ipotenuza, bevel θ la capete", () => {
    const c = rows(r, /^Cielo/);
    assert.equal(c.length, 1); assert.equal(rows(r, /^Base \/ Cielo/).length, 0);
    assert.ok(Math.abs(c[0].lung - g.Wi * SL.sec) <= TOL, `${c[0].lung} vs ${g.Wi * SL.sec}`);
    assert.equal(c[0].larg, g.D_bc);
    assert.equal(c[0].bevel.ends, 2); assert.ok(Math.abs(c[0].bevel.deg - SL.deg) < 0.01);
    assert.equal(c[0].role, "cielo");
  });
  test("despărțitor: înălțimea la poziția lui, cu bevel sus", () => {
    const d = rows(r, /^Tramezzo/)[0], yBot = g.in.h_base + g.sp_base;
    assert.ok(Math.abs(yBot + d.lung + SL.t_vert - S.topLineY(g, d.xc, 0)) <= TOL);
    assert.ok(d.bevel && d.bevel.top > 0);
  });
  test("spatele: trapez, rândul poartă gabaritul și conturul", () => {
    const b = rows(r, /^Schienale/)[0];
    assert.ok(b.poly && b.poly.length === 4);
    const us = b.poly.map(q => q[0]), vs = b.poly.map(q => q[1]);
    assert.ok(Math.max(...us) <= b.lung + 0.11 && Math.max(...vs) <= b.larg + 0.11);
  });
  test("uși: fiecare e un trapez, cu muchia de sus la un joc sub linia tavanului", () => {
    const d = rows(r, /^Anta/).sort((p, q) => q.lung - p.lung);
    assert.equal(d.length, 2); d.forEach(p => { assert.equal(p.pz, 1); assert.equal(p.poly.length, 4); });
    const gap = g.in.gap_sup, doors = r.boxes.filter(b => b.sub === "door").sort((a, b) => a.x0 - b.x0);
    const cl = x => Math.min(1200 - g.sp_fianco, Math.max(g.sp_fianco, x));
    doors.forEach(b => {
      assert.equal(b.vp.ax, "x");
      const [A, B, C, D] = b.vp.pts;                                    /* jos-stânga, jos-dreapta, sus-dreapta, sus-stânga */
      assert.ok(Math.abs(D[1] - (S.topLineY(g, cl(b.x0), 0) - gap)) < 1e-6, "sus-stânga");
      assert.ok(Math.abs(C[1] - (S.topLineY(g, cl(b.x1), 0) - gap)) < 1e-6, "sus-dreapta");
      assert.equal(A[1], B[1]); assert.ok(D[1] <= 2200 && C[1] <= 2200);
      assert.equal(b.edgeH.length, 2);
    });
    /* conturul din rând: (0,0), (înălțime stânga, 0), (înălțime dreapta, lățime), (0, lățime) */
    const p0 = d[0].poly; assert.equal(p0[0][0], 0); assert.equal(p0[3][1], d[0].larg); assert.ok(p0[1][0] > p0[2][0]);
    assert.equal(d[0].lung, Math.round(p0[1][0]));
  });
  test("uși: ușa din stânga (mai înaltă) e mai lungă, iar între uși muchiile se continuă (în rostul de 3 mm)", () => {
    const [a, b] = r.boxes.filter(x => x.sub === "door").sort((p, q) => p.x0 - q.x0);
    assert.ok(a.y1 > b.y1 + 50);
    assert.ok(Math.abs(a.vp.pts[2][1] - b.vp.pts[3][1]) < 4, `${a.vp.pts[2][1]} vs ${b.vp.pts[3][1]}`);
  });
  test("uși: partea balamalelor e scrisă pe cutie (prima la stânga, a doua la dreapta)", () => {
    const h = r.boxes.filter(x => x.sub === "door").sort((p, q) => p.x0 - q.x0).map(x => x.hinge);
    assert.equal(J(h), J(["left", "right"]));
  });
  test("polițele și restul interiorului stau sub partea cea mai joasă", () => {
    r.boxes.filter(b => b.role === "ripiano").forEach(b => assert.ok(b.y1 <= 1600 - SL.t_vert + 0.01));
  });
  test("cutii: laterale la înălțimile lor, tavan paralelogram în planul x–y", () => {
    const f = r.boxes.filter(b => b.role === "fianco").sort((a, b) => a.x0 - b.x0);
    assert.equal(f[0].y1, 2200); assert.equal(f[1].y1, 1600);
    const c = r.boxes.find(b => b.role === "cielo");
    assert.equal(c.vp.ax, "x"); assert.equal(c.vp.pts.length, 4);
    assert.ok(Math.abs(c.vp.pts[0][1] - c.vp.pts[3][1] - SL.t_vert) < 1e-9, "grosime verticală");
    assert.ok(c.dim && Math.abs(c.dim[0] - g.Wi * SL.sec) < 1e-9 && c.dim[2] === g.sp_cielo);
  });
  test("închiderea și invarianții: fără abateri", () => {
    assert.equal(J(r.closure()), "[]"); assert.equal(J(r.invariants()), "[]");
  });
});

describe("Panta pe adâncime (axis z)", () => {
  const r = build({ topProfile: Z }), g = r.G, SL = g.slope;
  test("laterale: un rând cu gabaritul (cota cea mai înaltă) și conturul trapezoidal", () => {
    const f = rows(r, /^Fianco/)[0];
    assert.equal(f.pz, 2); assert.equal(f.lung, 2200);
    assert.equal(J(f.poly), J([[0, 0], [1500, 0], [2200, f.larg], [0, f.larg]]));
  });
  test("tavan: lățimea = Wi, lungimea pe pantă = adâncime × sec θ", () => {
    const c = rows(r, /^Cielo/)[0];
    assert.equal(c.lung, g.Wi);
    assert.ok(Math.abs(c.larg - g.D_bc * SL.sec) <= TOL);
  });
  test("uși: cresc cu diferența de la față (2200 − 1500)", () => {
    const flat = build({ topProfile: null, H: 1500 });
    assert.equal(rows(r, /^Anta/)[0].lung, rows(flat, /^Anta/)[0].lung + 700);
  });
  test("spatele are înălțimea de la spate (aici capătul scund)", () => {
    assert.equal(rows(r, /^Schienale/)[0].larg, rows(build({ H: 1500 }), /^Schienale/)[0].larg);
  });
  test("despărțitor trapezoidal: gabaritul = capătul înalt", () => {
    const d = rows(r, /^Tramezzo/)[0], yBot = g.in.h_base + g.sp_base;
    assert.ok(d.poly && d.poly.length === 4);
    assert.ok(yBot + d.lung + SL.t_vert <= 2200 + TOL);
  });
  test("închiderea și invarianții: fără abateri", () => {
    assert.equal(J(r.closure()), "[]"); assert.equal(J(r.invariants()), "[]");
  });
  test("panta inversă (înalt în spate): ușile rămân la înălțimea din față", () => {
    const q = build({ topProfile: { axis: "z", h0: 1500, h1: 2200 } });
    assert.equal(rows(q, /^Anta/)[0].lung, rows(build({ H: 1500 }), /^Anta/)[0].lung);
    assert.equal(J(q.closure()), "[]");
  });
});

describe("Închiderea prinde o piesă greșită", () => {
  const r = build({ topProfile: X });
  const corrupt = (re, f) => r.pieces.map(p => re.test(p.elemento) ? f(Object.assign({}, p)) : p);
  test("tavan cu 3 mm mai lung", () => {
    const e = r.closure(corrupt(/^Cielo/, p => { p.lung += 3; return p; }));
    assert.ok(e.some(x => x.chain === "tavan-pe-panta"), J(e));
  });
  test("laterală dreaptă cu 2 mm mai înaltă", () => {
    const e = r.closure(corrupt(/^Fianco dx/, p => { p.lung += 2; return p; }));
    assert.ok(e.some(x => /fianco-dr/.test(x.chain)), J(e));
  });
  test("despărțitor cu 3 mm mai înalt", () => {
    const e = r.closure(corrupt(/^Tramezzo/, p => { p.lung += 3; return p; }));
    assert.ok(e.some(x => /despartitor/.test(x.chain)), J(e));
  });
  test("rotunjirea rândului (până la 0,5 mm) nu e eroare; o abatere de 2 mm da", () => {
    assert.equal(J(r.closure()), "[]");
    assert.ok(r.closure(corrupt(/^Cielo/, p => { p.lung += 2; return p; })).length > 0);
  });
});

describe("Ops: piese pe pantă", () => {
  test("tavanul înclinat: marcat, fără operații, cu dimensiunile reale; avertisment opsSlope", () => {
    const r = build({ topProfile: X }), o = r.ops();
    const c = o.pieces.find(p => p.role === "cielo");
    assert.equal(c.sloped, true); assert.equal(c.operations.length, 0);
    assert.ok(Math.abs(c.length - r.G.Wi * r.G.slope.sec) < 0.2, String(c.length));
    assert.equal(c.thickness, r.G.sp_cielo);
    assert.ok(o.warnings.some(w => w.k === "opsSlope" && w.piece === c.pk));
  });
  test("baza se îmbină cu laterale ca până acum; tavanul nu se îmbină", () => {
    const o = build({ topProfile: X }).ops();
    const base = o.pieces.find(p => p.role === "base");
    assert.ok(base.operations.length > 0);
  });
  test("corp drept: niciun avertisment opsSlope, nicio cheie `sloped`", () => {
    const o = build({}).ops();
    assert.ok(!o.warnings.some(w => w.k === "opsSlope")); assert.ok(!o.pieces.some(p => "sloped" in p));
  });
  test("laterale trapez (axis z): marcate, cu operații pe față", () => {
    const o = build({ topProfile: Z }).ops(), f = o.pieces.filter(p => p.role === "fianco");
    f.forEach(p => { assert.equal(p.sloped, true); assert.ok(p.operations.length > 0); });
  });
});

describe("Uși trapezoidale în ops", () => {
  const r = build({ topProfile: X }), o = r.ops(), hingeCount = S.hingeCount;
  const doors = o.pieces.filter(p => p.role === "frontale").sort((p, q) => q.length - p.length);
  test("piesele sunt marcate, dar nu dau avertismentul opsSlope (balamalele se găuresc normal)", () => {
    doors.forEach(p => assert.equal(p.sloped, true));
    assert.ok(!o.warnings.some(w => w.k === "opsSlope" && doors.some(p => p.pk === w.piece)));
  });
  test("numărul de balamale urmează muchia mai scundă a fiecărei uși", () => {
    const boxes = r.boxes.filter(b => b.sub === "door").sort((p, q) => p.x0 - q.x0);
    boxes.forEach(b => {
      const n = hingeCount(Math.min(b.edgeH[0], b.edgeH[1]));
      const pc = o.pieces.find(p => p.role === "frontale" && Math.abs(p.min[0] - b.x0) < 0.6);
      const cups = pc.operations.filter(op => /tazza cerniera/.test(op.note || ""));
      assert.equal(cups.length, n, `balamale ${cups.length} vs ${n}`);
    });
  });
  test("balamalele cad în contur: sub muchia mai scundă", () => {
    r.boxes.filter(b => b.sub === "door").forEach(b => {
      const lowTop = b.vp.pts[0][1] + Math.min(b.edgeH[0], b.edgeH[1]);
      const pc = o.pieces.find(p => p.role === "frontale" && Math.abs(p.min[0] - b.x0) < 0.6);
      pc.operations.filter(op => op.type === "drill" && /tazza cerniera/.test(op.note || "")).forEach(op => assert.ok(op._w[1] <= lowTop - 50, "tazza la y=" + op._w[1]));
    });
  });
  test("mânerul stă sub muchia mai scundă", () => {
    r.boxes.filter(b => b.sub === "door").forEach(b => {
      const lowTop = b.vp.pts[0][1] + Math.min(b.edgeH[0], b.edgeH[1]);
      const pc = o.pieces.find(p => p.role === "frontale" && Math.abs(p.min[0] - b.x0) < 0.6);
      pc.operations.filter(op => /aniglia/.test(op.note || "")).forEach(op => assert.ok(op._w[1] <= lowTop, "mâner la y=" + op._w[1]));
    });
  });
});

describe("Determinism", () => {
  test("același profil → aceleași rânduri și aceleași cutii", () => {
    const a = build({ topProfile: X }), b = build({ topProfile: X });
    assert.equal(J(a.pieces), J(b.pieces)); assert.equal(J(a.boxes), J(b.boxes));
  });
  test("cu `top:none` merge: fără tavan, laterale înclinate", () => {
    const r = build({ topProfile: Z, top: "none" });
    assert.equal(rows(r, /^Cielo/).length, 0);
    assert.equal(J(r.closure()), "[]");
  });
  test("corp pe picioare: laterale cu picioarele scăzute din înălțime", () => {
    const r = build({ topProfile: X, support: "piedini", plinth: 100 });
    const f = r.pieces.filter(p => p.role === "fianco").sort((a, b) => a.xc - b.xc);
    assert.equal(f[0].lung, 2100); assert.equal(f[1].lung, 1500);
    assert.equal(J(r.closure()), "[]");
  });
});
