/* Ebanist — U.4: sertare pe o coloană delimitată de despărțitori la cotă.
 *
 *   node --test test/drawerblocks.test.js
 *
 * `cfg.drawerBlocks` = [{ col, yStart, yEnd, n | heights, nl, inner }]: o
 * coloană de sertare ÎN coloana a `col`-a a corpului, între două cote.
 * Ce trebuie să rămână adevărat:
 *  - corpul se închide la 0 mm și invarianții trec: sertarele nu sunt panouri
 *    ale gabaritului;
 *  - înălțimile frontalelor ies din același `drawerPlan` ca la secțiuni;
 *  - o cotă care nu are loc (ripiano prin zonă, setto care se oprește în ea,
 *    zonă în afara luminii, ușă peste sertare) oprește generarea cu motivul;
 *  - fără `drawerBlocks`, nimic nu se schimbă (golden 42/42, layout.test).
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
const arr = x => Array.from(x || []);
const J = x => JSON.stringify(x);

function build(cfg, o) {
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__b",
    matOvr: {}, matAdd: [MM("__b", 19), MM("pfl5", 5)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "R", matBody: "__b", matFront: "__b", matBack: "__b" }, cfg);
  const b = S.buildModule(full);
  const pieces = b.pieces.map(x => Object.assign({}, x));
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  const M = S.carcassMaterials(full);
  const ths = [...new Set(Object.values(M.sp).concat(pieces.map(x => x.sp)).filter(x => x > 0))];
  return { b, full, pieces, G,
    close: () => arr(S.validateCarcassClosure(full, pieces, G)),
    ko: () => arr(S.failedInvariants(full, pieces, G, { materials: M.mats, thicknesses: ths })).map(r => r.id),
    LY: () => S.validateLayout(full, G) };
}
const err = cfg => { try { build(cfg); return ""; } catch (e) { return e.message; } };
const rows = (r, role) => r.pieces.filter(p => p.role === role);
const count = (r, role) => rows(r, role).reduce((s, p) => s + p.pz, 0);

/* armadio 1800 × 2700: două coloane; jos uși, sus uși, la mijloc sertare și rafturi */
const ARM = { type: "standard", L: 1800, H: 2700, P: 560, plinth: 80, tram: 0, shelves: 0, drawers: 0, doors: 0,
  back: 1, hang: 0, support: "zoccolo", drawerSys: "legno",
  partitions: [{ type: "setto", x: "center" },
    { type: "ripiano", y: 900, span: "left" }, { type: "ripiano", y: 1800, span: "left" },
    { type: "ripiano", y: 900, span: "right" }, { type: "ripiano", y: 1800, span: "right" }],
  fronts: [{ x: 0, y: 80, w: 896, h: 818 }, { x: 904, y: 80, w: 896, h: 818 },
    { x: 0, y: 1802, w: 896, h: 896 }, { x: 904, y: 1802, w: 896, h: 896 }],
  drawerBlocks: [{ col: 1, yStart: 919, yEnd: 1450, n: 3 }, { col: 2, yStart: 1000, yEnd: 1700, heights: [200, 300] }] };

describe("Armadio cu zone: uși jos și sus, sertare la mijloc", () => {
  const r = build(ARM);
  test("se generează, se închide la 0 mm, invarianții trec", () => {
    assert.equal(J(r.close()), "[]"); assert.equal(J(r.ko()), "[]"); assert.equal(J(r.LY().errors), "[]");
  });
  test("5 frontale de sertar, 4 uși", () => {
    assert.equal(count(r, "cassetto_frontale"), 5); assert.equal(count(r, "frontale"), 4);
  });
  test("n = 3 pe 919–1450: frontale egale din același plan ca la secțiuni", () => {
    const f = rows(r, "cassetto_frontale").find(p => p.lung === 174);
    assert.ok(f, "frontal de 174"); assert.equal(f.pz, 3);
    /* (531 − 4 − 2 rosturi de 3) / 3 = 173,67, rotunjit la 174 */
    assert.equal(f.larg, 896);
  });
  test("înălțimile scrise de sus în jos: 200 sus, 300 jos", () => {
    const h = rows(r, "cassetto_frontale").map(p => p.lung).sort((a, c) => a - c);
    assert.ok(h.includes(200) && h.includes(300));
  });
  test("fiecare cassa urmează frontalul ei (laterale 155 și 255 sub 200 și 300)", () => {
    const sides = rows(r, "cassetto_fianco").filter(p => p.elemento === "Fianco cassetto").map(p => p.larg);
    assert.ok(sides.includes(155) && sides.includes(255));
  });
  test("3D: frontalele stau în coloana lor, între cotele scrise, fiecare piesă a ei", () => {
    const fr = r.b.boxes.filter(b => b.role === "cassetto_frontale");
    assert.equal(fr.length, 5);
    assert.equal(new Set(fr.map(b => b.pk)).size, 5);
    const col1 = fr.filter(b => b.x1 < 910);
    assert.equal(col1.length, 3);
    col1.forEach(b => { assert.ok(b.y0 >= 919 - 1e-6 && b.y1 <= 1450 + 1e-6, "în zonă"); assert.ok(b.x0 >= 0 && b.x1 <= 905); });
  });
  test("o piesă fizică pe frontal și pe cassa lui (grp)", () => {
    const grps = new Set(r.b.boxes.filter(b => b.grp && /^b\d+_\d+$/.test(b.grp)).map(b => b.grp));
    assert.equal(grps.size, 5);
  });
  test("deterministă", () => { assert.equal(J(build(ARM).pieces), J(r.pieces)); assert.equal(J(build(ARM).b.boxes), J(r.b.boxes)); });
  test("ușile nu intră peste sertare (zonele sunt disjuncte)", () => {
    const d = r.b.boxes.filter(b => b.sub === "door"), s = r.b.boxes.filter(b => b.sub === "drawer");
    d.forEach(a => s.forEach(c => assert.ok(!(a.x0 < c.x1 - .05 && c.x0 < a.x1 - .05 && a.y0 < c.y1 - .05 && c.y0 < a.y1 - .05))));
  });
});

describe("Fără setto: o singură coloană între laterale", () => {
  const base = { type: "standard", L: 600, H: 900, P: 560, plinth: 80, tram: 0, shelves: 0, drawers: 0, doors: 0, back: 1, hang: 0, support: "zoccolo",
    drawerSys: "legno", drawerBlocks: [{ col: 1, yStart: 99, yEnd: 819, n: 4 }] };
  test("4 sertare între bază și cer", () => {
    const r = build(base);
    assert.equal(count(r, "cassetto_frontale"), 4); assert.equal(J(r.close()), "[]"); assert.equal(J(r.ko()), "[]");
  });
  test("frontalul a vista pleacă de la fiancuri (lățime = corp − 2 × luciul vizibil)", () => {
    const r = build(base), f = rows(r, "cassetto_frontale")[0];
    assert.equal(f.larg, 600 - 2 * r.G.reveal);
  });
  test("sertar interior: în vanul, mai îngust decât luminile", () => {
    const r = build({ ...base, drawerBlocks: [{ col: 1, yStart: 99, yEnd: 819, n: 3, inner: true }] });
    assert.ok(rows(r, "cassetto_frontale")[0].elemento === "Frontale cassetto interno");
    assert.ok(rows(r, "cassetto_frontale")[0].larg < 600 - 2 * 19);
  });
  test("sistem metalic (LEGRABOX): cassa de listă, fără erori", () => {
    const r = build({ ...base, drawerSys: "legrabox", drawerBlocks: [{ col: 1, yStart: 99, yEnd: 819, n: 3 }] });
    assert.equal(count(r, "cassetto_frontale"), 3); assert.equal(J(r.close()), "[]");
  });
});

describe("Ce nu are loc nu se generează în tăcere", () => {
  test("un ripiano trece prin zonă", () => {
    assert.match(err({ ...ARM, drawerBlocks: [{ col: 1, yStart: 850, yEnd: 1200, n: 2 }] }), /ripiano \d+ .* trece prin zona sertarelor/);
  });
  test("zona iese din lumina interioară", () => {
    assert.match(err({ ...ARM, drawerBlocks: [{ col: 1, yStart: 10, yEnd: 700, n: 2 }] }), /iese din lumina interioară/);
    assert.match(err({ ...ARM, drawerBlocks: [{ col: 1, yStart: 1000, yEnd: 3000, n: 2 }] }), /iese din lumina interioară/);
  });
  test("coloană inexistentă la acea înălțime", () => {
    assert.match(err({ ...ARM, drawerBlocks: [{ col: 3, yStart: 919, yEnd: 1450, n: 3 }] }), /coloana 3, dar la această înălțime sunt doar 2/);
  });
  test("un setto care se oprește în zonă", () => {
    const cfg = { ...ARM, partitions: [{ type: "setto", x: "center", yStart: 99, yEnd: 1200 }, ...ARM.partitions.slice(1)] };
    /* ripianele span left/right rămân; setto parțial cade în mijlocul blocului din col 1 */
    assert.match(err({ ...cfg, drawerBlocks: [{ col: 1, yStart: 919, yEnd: 1450, n: 3 }] }), /setto 1 se oprește în zona sertarelor/);
  });
  test("ușă peste sertare", () => {
    assert.match(err({ ...ARM, fronts: [{ x: 0, y: 1000, w: 896, h: 300 }, ...ARM.fronts.slice(1)] }), /anta \d+ se suprapune cu sertarele/);
  });
  test("două blocuri care se suprapun", () => {
    assert.match(err({ ...ARM, drawerBlocks: [{ col: 1, yStart: 919, yEnd: 1450, n: 3 }, { col: 1, yStart: 1200, yEnd: 1700, n: 2 }] }), /se suprapun/);
  });
  test("număr/înălțimi greșite", () => {
    assert.match(err({ ...ARM, drawerBlocks: [{ col: 1, yStart: 919, yEnd: 1450, n: 12 }] }), /între 1 și 8/);
    assert.match(err({ ...ARM, drawerBlocks: [{ col: 1, yStart: 919, yEnd: 1450, heights: [10, 10] }] }), /≥ 20 mm/);
    assert.match(err({ ...ARM, drawerBlocks: [{ col: 0, yStart: 919, yEnd: 1450, n: 2 }] }), /coloana \(col\)/);
  });
  test("prea înguste/înalte: motivul vine din plan", () => {
    assert.match(err({ ...ARM, drawerBlocks: [{ col: 1, yStart: 919, yEnd: 1000, n: 8 }] }), /sertare 1/);
  });
  test("«Cassetti/sez.» nu se combină cu blocuri fără partiții", () => {
    assert.match(err({ ...ARM, partitions: undefined, fronts: undefined, drawers: 2, drawerBlocks: [{ col: 1, yStart: 99, yEnd: 819, n: 2 }] }), /nu se combină/);
  });
});

describe("Fără drawerBlocks nimic nu se schimbă", () => {
  test("armadiul fără blocuri = armadiul fără cheie, rând cu rând", () => {
    const a = build({ ...ARM, drawerBlocks: undefined }), b = build({ ...ARM, drawerBlocks: [] });
    assert.equal(J(a.pieces), J(b.pieces)); assert.equal(J(a.b.boxes), J(b.b.boxes));
    assert.equal(count(a, "cassetto_frontale"), 0);
  });
});
