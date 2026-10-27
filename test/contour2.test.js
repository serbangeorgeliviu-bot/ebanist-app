/* Piesa cu contur liber v2 (D-102): găuri și decupaje interioare, canale, mai multe piese pe modul, import cu mai multe contururi.
   Rulează: node --test contour2.test.js */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k", matOvr: {}, matAdd: [MM("__b", 18), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
const C = S.EBContour, arr = x => Array.from(x || []);
const near = (a, b, e, m) => assert.ok(Math.abs(a - b) <= e, (m || "") + " " + a + " vs " + b);
const base = { name: "K", type: "contur", L: 600, H: 400, P: 18, back: 0, matBody: "__b", matFront: "__b", matBack: "__k", cShape: "rect", cPz: 1, cEdge: 1 };

test("găurile din text: cerc, dreptunghi (cu rază), canal-ovală; separatori, comentarii; erori cu numărul liniei", () => {
  const r = C.parseHoles("c 100 100 8\n# un comentariu\nr 300, 200, 80, 40, 6\ns 450;200;100;20\n");
  assert.equal(r.ok, true); assert.equal(r.holes.length, 3);
  assert.equal(r.holes.map(h => h.k).join(""), "crs");
  assert.equal(r.holes[1].r, 6); assert.equal(r.holes[2].r, 10);          /* canal-ovală: raza = jumătate din latura mică */
  assert.equal(r.holes[0].line, 1); assert.equal(r.holes[2].line, 4);
  for (const bad of ["x 1 2 3", "c 1 2", "c 1 2 0", "c a b c", "r 1 2 3", "r 1 2 0 4", "r 1 2 3 4 -1", "s 1 2 3 4 5"]) {
    const e = C.parseHoles(bad); assert.equal(e.ok, false, bad); assert.equal(e.reason, "holeSyntax"); assert.equal(e.line, 1);
  }
  assert.equal(C.parseHoles("c 1 2 3\nzz").line, 2);
  assert.equal(C.parseHoles("").ok, true); assert.equal(C.parseHoles("").holes.length, 0);
  assert.equal(C.parseHoles(Array.from({ length: 61 }, (_, i) => "c " + (10 + i * 5) + " 50 3").join("\n")).reason, "holeMany");
});

test("canalele din text: x1 y1 x2 y2 lățime adâncime [j]", () => {
  const g = C.parseGrooves("50 50 550 50 10 8\n100 100 300 300 6 5 j");
  assert.equal(g.ok, true); assert.equal(g.grooves.length, 2); assert.equal(g.grooves[0].back, false); assert.equal(g.grooves[1].back, true);
  for (const bad of ["1 2 3 4 5", "1 2 3 4 0 5", "1 2 3 4 5 0", "1 1 1 1 5 5", "a b c d e f", "1 2 3 4 5 6 k"]) assert.equal(C.parseGrooves(bad).reason, "grooveSyntax", bad);
});

test("resolve: forma gata + găuri valide — aria = exterior − găuri, cercul se recunoaște, găurile sunt în sens orar", () => {
  const R = C.resolve({ shape: "rect", L: 600, H: 400, holesTxt: "c 100 100 8\nc 300 200 80\nr 450 200 60 40 6\ns 200 320 100 20" }, 19);
  assert.equal(R.ok, true, R.why);
  assert.equal(R.holes.length, 4);
  assert.equal(R.holes.map(h => !!h.circle).join(), "true,true,false,false");
  near(R.holes[0].circle.d, 8, 1e-9); near(R.holes[1].circle.cx, 300, 1e-9);
  R.holes.forEach(h => assert.ok(C.area(h.pts) < 0, "orar"));
  /* aria canalului-ovală: dreptunghiul (w−h)·h + cercul π·(h/2)² */
  const slot = (100 - 20) * 20 + Math.PI * 100, rect = 60 * 40 - (4 - Math.PI) * 36;
  near(R.holeArea, Math.PI * 16 + Math.PI * 1600 + rect + slot, 1e-6, "aria găurilor");
  near(R.area, 600 * 400, 1e-9);
});

test("resolve: erorile declarate — în afara piesei, atinge marginea, suprapunere, punte prea subțire, canal ieșit/prea adânc/prea lat", () => {
  const w = (h, g, T) => C.resolve({ shape: "rect", L: 600, H: 400, holesTxt: h, groovesTxt: g }, T);
  assert.equal(w("c 3 100 8").why, "holeOut"); assert.equal(w("c 1000 100 8").why, "holeOut");
  assert.equal(w("c 4 100 8").why, "holeWeb");                       /* tangent la margine: 0 mm de material */
  assert.equal(w("c 8 100 8").ok, true);                             /* 4 mm de material de la margine: trece */
  assert.equal(w("c 100 100 80\nc 150 100 80").why, "holeHit"); assert.equal(w("c 100 100 80\nc 150 100 80").n, 2);
  assert.equal(w("c 100 100 80\nc 100 100 8").why, "holeHit");       /* una în alta */
  assert.equal(w("c 100 100 8\nc 110 100 8").why, "holeWeb");        /* 2 mm între ele */
  assert.equal(w("c 100 100 8\nc 115 100 8").ok, true);              /* 7 mm între ele */
  assert.equal(w("c 8 100 9.9").ok, true);                           /* 3,05 mm de la margine */
  assert.equal(w("c 8 100 10.5").why, "holeWeb");                    /* 2,75 mm de la margine */
  assert.equal(w("", "50 50 700 50 10 8").why, "grooveOut");
  assert.equal(w("c 300 50 40", "50 50 550 50 10 8", 19).why, "grooveOut");   /* trece peste gaură */
  assert.equal(w("", "50 50 550 50 10 18", 19).why, "grooveDepth");
  assert.equal(w("", "50 50 550 50 10 17", 19).ok, true);
  assert.equal(w("", "50 50 550 50 60 5", 19).why, "grooveW");
  assert.equal(w("", "50 50 550", 19).why, "grooveSyntax");
  assert.equal(w("", "50 50 550 50 10 8", 0).ok, true, "fără grosime nu se verifică adâncimea");
});

test("găurile într-o formă cu arc: scoop — gaura sub arcul scobit iese din piesă, deasupra intră", () => {
  const sp = { shape: "scoop", L: 600, H: 400, rise: 120 };
  assert.equal(C.resolve({ ...sp, holesTxt: "c 300 20 20" }).why, "holeOut");     /* în scobitura de jos */
  assert.equal(C.resolve({ ...sp, holesTxt: "c 300 200 20" }).ok, true);
  assert.equal(C.resolve({ ...sp, holesTxt: "c 40 200 20" }).ok, true);
});

test("triangulare cu găuri: aria triunghiurilor = exterior − găuri, pe 1200 de piese aleatoare cu 0-6 găuri", () => {
  let seed = 4242; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  let ok = 0, withHoles = 0;
  for (let i = 0; i < 1200; i++) {
    const W = ri(300, 1500), H = ri(250, 900), kind = ["rect", "round", "arch", "scoop"][ri(0, 3)];
    const lines = [], nh = ri(0, 6);
    for (let k = 0; k < nh; k++) {
      const t = ri(0, 2), x = ri(20, W - 20), y = ri(20, H - 20);
      lines.push(t === 0 ? `c ${x} ${y} ${ri(6, 120)}` : t === 1 ? `r ${x} ${y} ${ri(20, 200)} ${ri(20, 150)} ${ri(0, 15)}` : `s ${x} ${y} ${ri(30, 200)} ${ri(10, 40)}`);
    }
    const R = C.resolve({ shape: kind, L: W, H: H, r: ri(0, 80), rise: ri(0, 150), holesTxt: lines.join("\n") }, 19);
    if (!R.ok) continue;
    ok++; if (R.holes.length) withHoles++;
    const O = C.flatten(R.pts, 0.3), HP = R.holes.map(h => C.flatten(h.pts, 0.3));
    const T = C.triangulateH(O, HP); assert.ok(T, "triangulare " + i + " " + JSON.stringify(lines));
    const sum = T.tri.reduce((s, t) => s + Math.abs(C.polyArea([T.P[t[0]], T.P[t[1]], T.P[t[2]]])), 0);
    const want = Math.abs(C.polyArea(O)) - HP.reduce((s, h) => s + Math.abs(C.polyArea(h)), 0);
    near(sum, want, 1e-6 * want + 1e-6, "aria " + i);
    /* nicio găură nu e acoperită: centrul fiecărei găuri nu cade în vreun triunghi */
    HP.forEach(h => {
      const c = h.reduce((a, q) => [a[0] + q[0] / h.length, a[1] + q[1] / h.length], [0, 0]);
      if (!C.pointInPoly(h, c)) return;                                           /* centroid în afara unei găuri concave: sărim */
      const inT = T.tri.some(t => { const a = T.P[t[0]], b = T.P[t[1]], d = T.P[t[2]]; const cr = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); const s1 = cr(a, b, c), s2 = cr(b, d, c), s3 = cr(d, a, c); return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0); });
      assert.equal(inT, false, "gaura acoperită " + i);
    });
  }
  assert.ok(ok > 400 && withHoles > 300, "valide " + ok + ", cu găuri " + withHoles);
});

test("SVG cu mai multe subtrasee: cel mai mare e conturul, cele dinăuntru sunt găuri (cerc din arce, dreptunghi relativ cu m)", () => {
  const d = "M 0 0 L 400 0 L 400 -300 L 0 -300 Z M 100 -150 A 40 40 0 1 1 180 -150 A 40 40 0 1 1 100 -150 Z m 200 -100 l 60 0 l 0 40 l -60 0 z";
  const r = C.parse(d); assert.equal(r.ok, true, r.reason); assert.equal(r.holes.length, 2);
  assert.equal(r.pts.length, 4);
  const B = C.build(r.pts, { holes: r.holes }); assert.equal(B.ok, true); assert.equal(B.holes.length, 2);
  const R = C.resolve({ shape: "custom", src: d }, 19);
  assert.equal(R.ok, true, R.why); assert.equal(R.holes.length, 2); assert.equal(R.impHoles.length, 2);
  near(R.w, 400, 1e-6); near(R.h, 300, 1e-6);
  near(R.holeArea, Math.PI * 1600 + 60 * 40, 1e-3, "aria găurilor din SVG");
  assert.ok(R.holes.some(h => h.circle && Math.abs(h.circle.d - 80) < 1e-6), "cerc recunoscut");
  /* scalare: găurile se scalează cu conturul */
  const R2 = C.resolve({ shape: "custom", src: d, fit: "W", L: 800 }, 19); assert.equal(R2.ok, true, R2.why);
  near(R2.w, 800, 1e-6); near(R2.holeArea, (Math.PI * 1600 + 60 * 40) * 4, 1e-2);
  /* fișierul salvat (contour + impHoles) dă aceeași piesă fără sursă */
  const R3 = C.resolve({ shape: "custom", contour: R2.pts, impHoles: R2.impHoles }, 19); assert.equal(R3.ok, true, R3.why);
  near(R3.holeArea, R2.holeArea, 1e-6); near(R3.w, R2.w, 1e-9);
});

test("SVG: un traseu în afara conturului = „multi” (se adaugă ca piesă separată); un subtraseu deschis = „open”", () => {
  assert.equal(C.parse("M 0 0 L 100 0 L 100 -100 L 0 -100 Z M 500 0 L 600 0 L 600 -100 L 500 -100 Z").reason, "multi");
  assert.equal(C.parse("M 0 0 L 100 0 L 100 -100 L 0 -100 Z M 20 -20 L 40 -20 L 40 -40").reason, "open");
  assert.equal(C.parse("M 0 0 L 100 0 L 100 -100 L 0 -100 Z L 5 5").ok, false);
});

test("DXF: LWPOLYLINE + CIRCLE înăuntru = contur cu gaură; cercuri singure; lanț de LINE/ARC + cerc", () => {
  const lw = ["0", "SECTION", "2", "ENTITIES", "0", "LWPOLYLINE", "90", "4", "70", "1", "10", "0", "20", "0", "10", "300", "20", "0", "10", "300", "20", "200", "10", "0", "20", "200",
    "0", "CIRCLE", "10", "150", "20", "100", "40", "30", "0", "ENDSEC", "0", "EOF"].join("\n");
  const r = C.parse(lw); assert.equal(r.ok, true, r.reason); assert.equal(r.holes.length, 1);
  const R = C.resolve({ shape: "custom", src: lw }, 19); assert.equal(R.ok, true, R.why);
  near(R.w, 300, 1e-9); near(R.holeArea, Math.PI * 900, 1e-3); assert.ok(R.holes[0].circle); near(R.holes[0].circle.cx, 150, 1e-6);
  const lines = ["0", "SECTION", "2", "ENTITIES",
    ..."0 LINE 10 0 20 0 11 200 21 0 0 LINE 10 200 20 0 11 200 21 100 0 LINE 10 200 20 100 11 0 21 100 0 LINE 10 0 20 100 11 0 21 0".split(" "),
    "0", "CIRCLE", "10", "100", "20", "50", "40", "10", "0", "ENDSEC", "0", "EOF"].join("\n");
  const r2 = C.parse(lines); assert.equal(r2.ok, true, r2.reason); assert.equal(r2.holes.length, 1); assert.equal(r2.pts.length, 4);
  const solo = ["0", "SECTION", "2", "ENTITIES", "0", "CIRCLE", "10", "0", "20", "0", "40", "100", "0", "ENDSEC", "0", "EOF"].join("\n");
  const r3 = C.parse(solo); assert.equal(r3.ok, true); assert.equal(r3.holes.length, 0);
  near(C.resolve({ shape: "custom", src: solo }, 19).area, Math.PI * 10000, 1e-2);
});

/* --- în model --------------------------------------------------------------------------------------------------------------------- */
const sumArea = tris => tris.reduce((a, t) => { const A = t.prism3.A, v = t.y1 - t.y0 > 1e-9 && t.z1 - t.z0 > 1e-9 ? 0 : 0; void v;
  const flat = A.every(p => Math.abs(p[1] - A[0][1]) < 1e-9);        /* culcat: planul (x,z) */
  const [i, j] = flat ? [0, 2] : [0, 1];
  return a + Math.abs((A[1][i] - A[0][i]) * (A[2][j] - A[0][j]) - (A[1][j] - A[0][j]) * (A[2][i] - A[0][i])) / 2; }, 0);

test("modulul: o piesă cu găuri — rândul (gabarit și perimetru exterior), 3D cu aria minus găurile, conturul exact + găurile pe o singură cutie", () => {
  const cfg = { ...base, cHoles: "c 100 100 8\nc 300 200 80\nr 450 200 60 40 6", cGrooves: "50 50 550 50 10 8" };
  for (const ori of ["v", "o"]) {
    const b = S.buildModule({ ...cfg, cOri: ori }), r = b.pieces[0];
    assert.equal(b.pieces.length, 1);
    assert.equal(r.lung, ori === "v" ? 400 : 600); assert.equal(r.larg, ori === "v" ? 600 : 400);
    assert.equal(r.perim, 2000, "cantul = perimetrul exterior, fără găuri");
    const bx = arr(b.boxes);
    const hole = Math.PI * 16 + Math.PI * 1600 + (60 * 40 - (4 - Math.PI) * 36);
    near(sumArea(bx), 600 * 400 - hole, 150, "aria 3D " + ori);       /* aplatizarea 0,3 mm a cercurilor: câteva zeci de mm² */
    const withC = bx.filter(x => x.cont); assert.equal(withC.length, 1);
    assert.equal(withC[0].cont.holes.length, 3); assert.equal(withC[0].cont.grooves.length, 1);
    assert.ok(withC[0].cont.holes[0].circle); assert.equal(withC[0].cont.holes[2].circle, null);
  }
});

test("operațiile: cercul mic se burghiază (trecut, fața 5), cel mare și dreptunghiul se frezează ca contur interior, canalul rămâne cu lățime și adâncime; totul în piesă", () => {
  for (const ori of ["v", "o"]) {
    const cfg = { ...base, cOri: ori, cHoles: "c 100 100 8\nc 300 200 80\nr 450 200 60 40 6", cGrooves: "50 50 550 50 10 8\n100 300 500 350 6 5 j" };
    const b = S.buildModule(cfg), o = S.generateOperations({ boxes: b.boxes, cfg, G: undefined }), p = arr(o.pieces)[0];
    const ops = arr(p.operations);
    const outer = ops.find(q => q.type === "contour" && !q.inner); assert.ok(outer);
    const inner = ops.filter(q => q.type === "contour" && q.inner); assert.equal(inner.length, 2);
    const drills = ops.filter(q => q.type === "drill"); assert.equal(drills.length, 1);
    assert.equal(drills[0].dia, 8); assert.equal(drills[0].through, true); assert.equal(drills[0].face, 5); near(drills[0].depth, 18, 1e-9);
    const OP = C.flatten(outer.pts, 0.2);
    assert.ok(C.pointInPoly(OP, [drills[0].x, drills[0].y]), "gaura burghiată în piesă");
    const areas = inner.map(q => Math.abs(C.area(q.pts))).sort((a, c) => a - c);
    near(areas[0], 60 * 40 - (4 - Math.PI) * 36, 0.5, "aria dreptunghiului"); near(areas[1], Math.PI * 1600, 0.5, "aria cercului");
    inner.forEach(q => { assert.equal(q.face, 5); assert.equal(q.through, true); assert.ok(q.pts.every(v => C.pointInPoly(OP, v)), "decupaj în piesă"); });
    /* sensul: aria cu semn a exteriorului și a găurilor diferă (una pozitivă, alta negativă) ca mașina să le deosebească */
    assert.ok(C.area(outer.pts) * C.area(inner[0].pts) < 0, "sens opus " + ori);
    const gr = ops.filter(q => q.type === "groove"); assert.equal(gr.length, 2);
    gr.forEach(g => { assert.ok(C.pointInPoly(OP, [g.from.x, g.from.y]) && C.pointInPoly(OP, [g.to.x, g.to.y]), "canal în piesă");
      assert.ok(g.width === 10 || g.width === 6); assert.ok(g.depth === 8 || g.depth === 5); });
    assert.equal(gr.map(g => g.face).sort().join(), "5,6");
    near(Math.hypot(gr.find(g => g.width === 10).to.x - gr.find(g => g.width === 10).from.x, gr.find(g => g.width === 10).to.y - gr.find(g => g.width === 10).from.y), 500, 0.2);
    assert.ok(p.polyHoles && p.polyHoles.length === 2, "găurile pentru desen");
    assert.equal(arr(p.preflight).filter(w => w.level === "error").length, 0, JSON.stringify(p.preflight));
  }
});

test("mai multe piese pe modul: rânduri separate, pk consecutive, fiecare cu conturul și găurile ei; o eroare indică piesa", () => {
  const cfg = { ...base, cParts: [
    { shape: "rect", L: 600, H: 400, pz: 2, ori: "v", edge: 1, holesTxt: "c 100 100 40" },
    { shape: "scoop", L: 900, H: 300, rise: 80, pz: 1, ori: "o", edge: 0 },
    { shape: "round", L: 300, H: 300, r: 60, pz: 3, ori: "v", edge: 1, holesTxt: "c 150 150 100", groovesTxt: "40 40 260 40 8 6" }] };
  const b = S.buildModule(cfg);
  assert.equal(b.pieces.length, 3);
  assert.equal(b.pieces.map(x => x.pz).join(), "2,1,3"); assert.equal(b.pieces.map(x => x.bordo).join(), "CONT,,CONT");
  const bx = arr(b.boxes), pks = [...new Set(bx.map(x => x.pk))].sort((a, c) => a - c);
  assert.equal(pks.join(), "1,2,3,4,5,6");
  bx.filter(x => x.cont).forEach(x => assert.ok(pks.includes(x.pk)));
  assert.equal(bx.filter(x => x.cont).length, 6, "câte un contur pe piesă fizică");
  /* nicio suprapunere în plan între piese: x-urile se așază unele lângă altele */
  const ext = pk => { const q = bx.filter(x => x.pk === pk); return [Math.min(...q.map(x => x.x0)), Math.max(...q.map(x => x.x1))]; };
  for (let i = 1; i < pks.length; i++) assert.ok(ext(pks[i])[0] >= ext(pks[i - 1])[1] - 1e-9, "piesa " + pks[i] + " după " + pks[i - 1]);
  assert.equal(b.cont.parts.length, 3); assert.equal(b.cont.parts[2].holes, 1); assert.equal(b.cont.parts[2].grooves, 1);
  /* operațiile: 6 piese fizice, 3 cu găuri */
  const o = S.generateOperations({ boxes: b.boxes, cfg, G: undefined }), pcs = arr(o.pieces);
  assert.equal(pcs.length, 6);
  assert.equal(pcs.filter(p => arr(p.operations).some(q => q.type === "drill" || q.inner)).length, 5, "2 cu o gaură mică burghiată... + 3 cu decupaj");
  /* eroare: indică piesa */
  const bad = { ...cfg, cParts: [cfg.cParts[0], { ...cfg.cParts[1], holesTxt: "c 3 3 9" }] };
  assert.throws(() => S.buildModule(bad), /contPartN.*contErr|contErr/);
  try { S.buildModule(bad); } catch (e) { assert.match(String(e.message), /contPartN/); }
});

test("compatibilitate: un modul vechi (fără cParts, cu contour) dă aceeași piesă ca înainte; cHoles pe câmpurile vechi funcționează", () => {
  const N = C.normalize(C.shape("scoop", 1800, 500, { rise: 120 }));
  const old = S.buildModule({ ...base, L: 1800, H: 500, cShape: "scoop", cRise: 120, cPz: 2, contour: N.pts });
  const neu = S.buildModule({ ...base, L: 1800, H: 500, cParts: [{ shape: "scoop", L: 1800, H: 500, rise: 120, pz: 2, edge: 1, contour: N.pts }] });
  assert.deepEqual(JSON.parse(JSON.stringify(old.pieces)), JSON.parse(JSON.stringify(neu.pieces)));
  assert.equal(old.boxes.length, neu.boxes.length);
  const w = S.buildModule({ ...base, cHoles: "c 300 200 60" });
  assert.equal(arr(w.boxes).filter(x => x.cont)[0].cont.holes.length, 1);
});
