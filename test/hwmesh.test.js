/* Ebanist — geometriile feroneriei realiste (hwmesh.js) și bugetul lor.
 *
 *   node --test test/hwmesh.test.js
 *
 * Dimensiunile geometriilor sunt cele cerute (în mm), normalele sunt unitare, cache-ul partajează geometriile,
 * iar numărul de triunghiuri al feroneriei unui corp rămâne sub buget (telefon, AR).
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MAT = E.MM, UNIT_MM = 0.001;
for (const f of ["ebanist-ops.js", "ebanist-hwgeom.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", f), "utf8"), S, { filename: f });
const G = S.EBHwGeom, HD = S.HW_DRILL;

let M;       // modulul ES, încărcat o singură dată
async function mesh() { return M || (M = await import(path.join(__dirname, "..", "app", "hwmesh.js"))); }
const size = g => { g.computeBoundingBox(); const b = g.boundingBox; return [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z].map(v => v / UNIT_MM); };
const near = (a, b, m, e = 0.01) => assert.ok(Math.abs(a - b) < e, `${m}: ${a} ≠ ${b}`);

describe("hwmesh: forme", () => {
  test("cutie rotunjită: dimensiunile cerute, normale unitare, cache", async () => {
    const m = await mesh();
    for (const [sx, sy, sz, r, seg] of [[57, 28.5, 1.7, 0.4, 1], [10, 22, 40, 1.1, 1], [64, 9.7, 14, 1.1, 2], [5, 5, 5, 0, 1]]) {
      const g = m.rboxGeom(sx, sy, sz, r, seg), sz3 = size(g);
      near(sz3[0], sx, "x"); near(sz3[1], sy, "y"); near(sz3[2], sz, "z");
      const n = g.attributes.normal; for (let i = 0; i < n.count; i += 7) near(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)), 1, "normală unitară", 1e-3);
      assert.equal(m.rboxGeom(sx, sy, sz, r, seg), g, "aceeași geometrie din cache");
    }
  });
  test("cilindru teșit: Ø și lungime exacte; fără teșitură = cilindru simplu", async () => {
    const m = await mesh(); let g = m.cylGeom(35, 8, 1);
    const s = size(g); near(s[1], 35, "lungime"); near(s[0], 8, "Ø", 0.05);
    near(size(m.cylGeom(12, 15, 0))[1], 12, "lungime fără teșitură");
    assert.ok(m.triCount(m.cylGeom(35, 8, 1)) < m.triCount(m.cylGeom(35, 8, 1, 40)), "mai multe segmente = mai multe triunghiuri");
  });
  test("profil rotit: lungimea = ultimul y, raza = cea mai mare rază", async () => {
    const m = await mesh(); const pr = G.screwProfile({ len: 53.5, shaft: 7, head: 10.5, headH: 3.5, cone: 2, thread: { pitch: 2.6, from: 15.5, to: 53.5, depth: .7 }, tip: 3 });
    const g = m.latheGeom(pr, 18), s = size(g);
    near(s[1], 53.5, "lungime"); near(s[0], 10.5, "Ø cap (poligon cu 18 laturi: până la 2% mai mic)", 0.3);
    assert.ok(pr.every((p, i) => i === 0 || p[1] >= pr[i - 1][1] - 1e-9), "y crește monoton");
  });
});

describe("hwmesh: buget de triunghiuri", () => {
  function tris(m, sh) {
    if (sh.t === "cyl") return m.triCount(m.cylGeom(Math.hypot(...[0, 1, 2].map(i => sh.a[i] - sh.b[i])), sh.d, sh.ch == null ? 0.45 : sh.ch));
    if (sh.t === "lathe") return m.triCount(m.latheGeom(sh.profile, 20));
    return m.triCount(m.rboxGeom(sh.hi[0] - sh.lo[0], sh.hi[1] - sh.lo[1], sh.hi[2] - sh.lo[2], sh.r == null ? 0.6 : sh.r));
  }
  for (const [kind, id] of [["minifix", "haf_minifix"], ["clamex", "lam_clamex"], ["confirmat", "gen_confirmat"], ["domino", "fes_domino"]]) test(`conectori ${kind}: triunghiuri pe corp sub buget`, async () => {
    const m = await mesh();
    S.handleIsProfile = () => false;
    S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k", matOvr: {}, matAdd: [MAT("__b", 19), MAT("__k", 3)], hwProd: { guida: "blum_tandem" } };
    const cfg = { name: "M", matBody: "__b", matFront: "__b", matBack: "__k", type: "standard", L: 1000, H: 2200, P: 600, plinth: 80, tram: 1, shelves: 3, drawers: 0, doors: 2, back: 1, hang: 0, support: "zoccolo", shelfType: "mobile", hwSel: { conn: id } };
    const b = S.buildModule(cfg), Gd = S.deriveCarcass(S.carcassParams(cfg, {}));
    const o = JSON.parse(JSON.stringify(S.generateOperations({ boxes: b.boxes, cfg, G: Gd }))), by = G.opsByHw(o.pieces);
    let total = 0, n = 0;
    for (const h of o.hw.filter(x => G.TYPES.includes(x.type))) for (const sh of G.connectorShapes(h, by[h.id], HD, { thickF: 19 })) { total += tris(m, sh); n++; }
    assert.ok(n > 0);
    assert.ok(total <= 60000, `${kind}: ${total} triunghiuri la ${n} forme (buget 60000)`);
    assert.ok(total / n <= 1500, `${kind}: ${Math.round(total / n)} triunghiuri pe formă (buget 1500)`);
  });
  test("o geometrie de feronerie nu depășește 1500 de triunghiuri", async () => {
    const m = await mesh();
    assert.ok(m.triCount(m.rboxGeom(64, 9.7, 14, 1.1, 2)) <= 1500);
    assert.ok(m.triCount(m.latheGeom(G.screwProfile({ len: 53.5, shaft: 7, head: 10.5, headH: 3.5, thread: { pitch: 2.6, from: 15.5, to: 53.5 } }), 20)) <= 1500);
  });
});
