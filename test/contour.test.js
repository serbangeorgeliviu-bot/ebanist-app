/* Piesa cu contur liber (app/ebanist-contour.js). Rulează: node --test contour.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm"), fs = require("node:fs"), path = require("node:path");
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-contour.js"), "utf8"), ctx);
const C = ctx.EBContour, J = x => JSON.parse(JSON.stringify(x));
const near = (a, b, e, m) => assert.ok(Math.abs(a - b) <= e, (m || "") + " " + a + " vs " + b);

test("formele gata: aria și perimetrul exacte (cu arce)", () => {
  const r = C.shape("round", 1000, 500, { r: 100 });
  near(C.area(r), 1000 * 500 - (4 - Math.PI) * 100 * 100, 1e-6, "aria dreptunghiului rotunjit");
  near(C.perimeter(r), 2 * (800 + 300) + 2 * Math.PI * 100, 1e-6, "perimetrul");
  const rect = C.shape("rect", 300, 200); near(C.area(rect), 60000, 1e-9); near(C.perimeter(rect), 1000, 1e-9);
  /* arc cu coarda c și săgeata s: segmentul circular r²/2·(θ − sin θ), r = (c²/4+s²)/(2s) */
  const c = 1000, s = 100, rr = (c * c / 4 + s * s) / (2 * s), th = 2 * Math.asin(c / 2 / rr), seg = rr * rr / 2 * (th - Math.sin(th));
  near(C.area(C.shape("arch", 1000, 500, { rise: 100 })), 1000 * 400 + seg, 1e-6, "arch");
  near(C.area(C.shape("scoop", 1000, 500, { rise: 100 })), 1000 * 500 - seg, 1e-6, "scoop");
  assert.equal(C.shape("rect", 0, 10), null);
  assert.equal(C.shape("nu_exista", 10, 10), null);
});

test("bbox: extremele arcelor intră în gabarit (o semicercă iese în afara vârfurilor)", () => {
  const semi = [[0, 0, 1], [100, 0, 0], [100, 50, 0], [0, 50, 0]];     /* bulge 1 = semicerc, bombat în jos (y negativ) */
  const bb = C.bbox(semi);
  near(bb.y0, -50, 1e-9); near(bb.w, 100, 1e-9); near(bb.h, 100, 1e-9);
  const n = C.normalize(semi); assert.equal(n.ok, true); near(n.h, 100, 1e-6); assert.equal(C.bbox(n.pts).x0, 0); assert.equal(C.bbox(n.pts).y0, 0);
});

test("normalize: mută în origine, orientează antiorar fără a schimba forma; respinge autointersecția și suprafața nulă", () => {
  const cw = [[0, 0, 0], [0, 50, 0], [100, 50, 0], [100, 0, 0]];
  const n = C.normalize(cw); assert.equal(n.ok, true); assert.ok(C.area(n.pts) > 0); near(n.area, 5000, 1e-9);
  /* contur cu arc, parcurs orar: după normalizare aria rămâne aceeași */
  const rr = C.shape("round", 400, 300, { r: 50 }), rev = C.normalize(rr.slice().reverse().map((p, i, a) => [p[0], p[1], -(a[(i + 1) % a.length] ? a[(i + 1) % a.length][2] : 0)]));
  assert.equal(rev.ok, true); near(rev.area, C.area(rr), 1e-3, "aria după inversare");
  assert.equal(C.normalize([[0, 0, 0], [100, 100, 0], [100, 0, 0], [0, 100, 0]]).reason, "self");
  assert.equal(C.normalize([[0, 0, 0], [10, 0, 0], [20, 0, 0]]).reason, "area");
  assert.equal(C.normalize([[0, 0, 0], [1, 1, 0]]).reason, "few");
  const dup = C.normalize([[0, 0, 0], [0, 0, 0], [100, 0, 0], [100, 50, 0], [0, 50, 0], [0, 0, 0]]); assert.equal(dup.ok, true); assert.equal(dup.pts.length, 4);
});

test("triangulare: suma ariilor triunghiurilor = aria poligonului, pe forme concave (L, scobită, stea)", () => {
  const shapes = {
    L: [[0, 0, 0], [100, 0, 0], [100, 40, 0], [40, 40, 0], [40, 100, 0], [0, 100, 0]],
    scoop: C.shape("scoop", 1000, 500, { rise: 150 }),
    star: (() => { const o = []; for (let i = 0; i < 10; i++) { const a = Math.PI / 5 * i, r = i % 2 ? 40 : 100; o.push([r * Math.cos(a), r * Math.sin(a), 0]); } return o; })(),
    round: C.shape("round", 500, 300, { r: 80 })
  };
  for (const [k, pts] of Object.entries(shapes)) {
    const P = C.flatten(pts), tri = C.triangulate(P);
    assert.ok(tri, k);
    const sum = tri.reduce((s, t) => s + Math.abs(C.polyArea([P[t[0]], P[t[1]], P[t[2]]])), 0);
    near(sum, Math.abs(C.polyArea(P)), 1e-6, k);
    assert.equal(tri.length, P.length - 2, k + ": n−2 triunghiuri");
  }
});

test("SVG: dreptunghi, cerc din arce, traseu relativ, arc exact devine bulge", () => {
  const r = C.fromPath("M 0 0 L 100 0 L 100 50 L 0 50 Z");
  assert.equal(r.ok, true); const n = C.normalize(r.pts); near(n.area, 5000, 1e-9); near(n.w, 100, 1e-9); near(n.h, 50, 1e-9);
  const rel = C.fromPath("m 10 10 h 100 v 50 h -100 z"); assert.equal(rel.ok, true); near(C.normalize(rel.pts).area, 5000, 1e-9);
  /* cerc de rază 50 din două arce */
  const circ = C.fromPath("M 0 50 A 50 50 0 1 1 100 50 A 50 50 0 1 1 0 50 Z");
  assert.equal(circ.ok, true); const cn = C.normalize(circ.pts); assert.equal(cn.ok, true);
  near(cn.area, Math.PI * 2500, 1e-6, "aria cercului"); near(cn.perim, 2 * Math.PI * 50, 1e-6); near(cn.w, 100, 1e-6); near(cn.h, 100, 1e-6);
  /* dreptunghi cu un colț rotunjit printr-un arc de 90° (sfert de cerc de rază 20) */
  const q = C.fromPath("M 0 0 L 80 0 A 20 20 0 0 1 100 20 L 100 60 L 0 60 Z"); assert.equal(q.ok, true);
  near(C.normalize(q.pts).area, 100 * 60 - (20 * 20 - Math.PI * 400 / 4), 1e-6, "colț rotunjit");
  assert.equal(C.fromPath("M 0 0 L 10 0 L 10 10").reason, "open");
  assert.equal(C.fromPath("M 0 0 L 10 0 L 10 10 Z M 20 20 L 30 20 L 30 30 Z").reason, "multi");
  assert.equal(C.fromPath("M 0 0 K 5 5").ok, false);
});

test("SVG: curbe Bézier se aplatizează, aria rămâne aproape de cea reală", () => {
  const r = C.fromPath("M 0 0 Q 50 100 100 0 Z");                      /* parabolă: aria = 2/3 · 100 · 50 */
  assert.equal(r.ok, true); near(C.normalize(r.pts).area, 2 / 3 * 100 * 50, 3, "parabola");
  const c = C.fromPath("M 0 0 C 0 55 45 100 100 100 L 100 0 Z"); assert.equal(c.ok, true); assert.ok(C.normalize(c.pts).ok);
});

test("DXF: LWPOLYLINE închis cu bulge, LINE+ARC înlănțuite, CERC, unități", () => {
  const lw = ["0", "SECTION", "2", "ENTITIES", "0", "LWPOLYLINE", "90", "4", "70", "1", "10", "0", "20", "0", "10", "100", "20", "0", "42", "0.5", "10", "100", "20", "50", "10", "0", "20", "50", "0", "ENDSEC", "0", "EOF"].join("\n");
  const a = C.fromDXF(lw); assert.equal(a.ok, true); assert.equal(a.pts.length, 4); near(a.pts[1][2], 0.5, 1e-12);
  /* LINE + ARC (semicerc) formează o formă „D” */
  const d = ["0", "SECTION", "2", "ENTITIES", "0", "LINE", "10", "0", "20", "0", "11", "0", "21", "100",
    "0", "ARC", "10", "0", "20", "50", "40", "50", "50", "270", "51", "90", "0", "ENDSEC", "0", "EOF"].join("\n");
  /* ARC antiorar de la 270° la 90° trece prin (50, 50): de la (0,0) la (0,100) */
  const b = C.fromDXF(d); assert.equal(b.ok, true, b.reason); const bn = C.normalize(b.pts); assert.equal(bn.ok, true);
  near(bn.area, Math.PI * 50 * 50 / 2, 1e-6, "semicerc");
  const circle = ["0", "SECTION", "2", "ENTITIES", "0", "CIRCLE", "10", "0", "20", "0", "40", "25", "0", "ENDSEC", "0", "EOF"].join("\n");
  near(C.normalize(C.fromDXF(circle).pts).area, Math.PI * 625, 1e-6, "cerc");
  /* unități: INSUNITS 5 = cm */
  const cm = ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "5", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES", "0", "LWPOLYLINE", "90", "4", "70", "1", "10", "0", "20", "0", "10", "10", "20", "0", "10", "10", "20", "5", "10", "0", "20", "5", "0", "ENDSEC", "0", "EOF"].join("\n");
  const m = C.normalize(C.fromDXF(cm).pts); near(m.w, 100, 1e-9); near(m.h, 50, 1e-9);
  assert.equal(C.fromDXF("0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF").ok, false);
  /* lanț deschis */
  const open = ["0", "SECTION", "2", "ENTITIES", "0", "LINE", "10", "0", "20", "0", "11", "10", "21", "0", "0", "LINE", "10", "10", "20", "0", "11", "10", "21", "10", "0", "ENDSEC", "0", "EOF"].join("\n");
  assert.equal(C.fromDXF(open).reason, "open");
});

test("parse: recunoaște formatul (DXF, <path d=…>, cale goală, puncte) și respinge gunoiul", () => {
  assert.equal(C.parse("M 0 0 L 10 0 L 10 10 L 0 10 Z").ok, true);
  assert.equal(C.parse('<svg><path d="M 0 0 L 10 0 L 10 10 L 0 10 Z"/></svg>').ok, true);
  assert.equal(C.parse("0,0 100,0 100,50 0,50").ok, true);
  assert.equal(C.parse("0,0 100,0,0.5 100,50 0,50").pts[1][2], 0.5);
  assert.equal(C.parse("").reason, "empty");
  assert.equal(C.parse("blabla").ok, false);
  assert.equal(C.parse("0,0 5,5").ok, false);
});

test("build: scală uniformă la lățime sau înălțime dorită; arcele rămân arce (aria scalează cu k²)", () => {
  const r = C.shape("round", 400, 300, { r: 50 });
  const b = C.build(r, { fitW: 800 }); assert.equal(b.ok, true); near(b.w, 800, 1e-6); near(b.h, 600, 1e-6); near(b.area, C.area(r) * 4, 1e-3);
  const c = C.build(r, { fitH: 150 }); near(c.h, 150, 1e-6); near(c.w, 200, 1e-6);
  const d = C.build(r, { scale: 2 }); near(d.w, 800, 1e-6);
  assert.equal(C.build(r, {}).w, 400);
});

test("aleator: 1500 de poligoane simple cu arce — triangularea acoperă exact aria, nicio triangulare nu cade", () => {
  let seed = 777; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  let ok = 0;
  for (let i = 0; i < 1500; i++) {
    /* poligon stelat: vârfuri pe raze aleatoare la unghiuri crescătoare (simplu prin construcție), cu arce mici pe unele laturi */
    const n = ri(3, 14), pts = [];
    for (let k = 0; k < n; k++) { const a = 2 * Math.PI * k / n + (rnd() - .5) * 0.5 * (2 * Math.PI / n), r = 50 + rnd() * 250; pts.push([r * Math.cos(a), r * Math.sin(a), rnd() < .3 ? (rnd() - .5) * 0.3 : 0]); }
    const nn = C.normalize(pts); if (!nn.ok) continue; ok++;
    const P = C.flatten(nn.pts), tri = C.triangulate(P); assert.ok(tri, "triangulare " + i);
    const sum = tri.reduce((s, t) => s + Math.abs(C.polyArea([P[t[0]], P[t[1]], P[t[2]]])), 0);
    near(sum, Math.abs(C.polyArea(P)), 1e-6 * Math.max(1, sum), "aria " + i);
    /* aria exactă cu arce vs aria aplatizată: diferența mică (toleranța de aplatizare) */
    assert.ok(Math.abs(nn.area - Math.abs(C.polyArea(P))) < 0.07 * nn.perim + 1, "aplatizare " + i);
  }
  assert.ok(ok > 900, "poligoane valide: " + ok);
});

test("shape: săgeata arcului nu depășește un semicerc și nici înălțimea; arch și scoop rămân poligoane simple", () => {
  const a = C.shape("scoop", 200, 600, { rise: 900 });          /* cerut 900 → 100 (jumătate din lățime) */
  const n = C.normalize(a); assert.equal(n.ok, true); near(n.w, 200, 1e-9);
  const b = C.shape("arch", 200, 600, { rise: 900 }); assert.equal(C.normalize(b).ok, true);
  for (let W = 100; W <= 1200; W += 173) for (let H = 100; H <= 900; H += 131) for (const k of ["arch", "scoop", "round"])
    assert.equal(C.normalize(C.shape(k, W, H, { rise: 5000, r: 5000 })).ok, true, k + W + "x" + H);
});
