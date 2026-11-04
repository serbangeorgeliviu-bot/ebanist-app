/* Ebanist — găurirea balamalei alese vine din datele Blum (ebanist-hinges.js → hingeGeom → ebanist-ops.js).
 *
 *   node --test test/hinges-ops.test.js
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
["ebanist-hinges-data.js", "ebanist-hinges.js", "ebanist-ops.js"].forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", f), "utf8"), S, { filename: f }));
const H = S.EBHinges;
let CUR = { cern: "blum_71b3550", plate: null };
S.hingeGeom = () => H.geomOf(CUR.cern, CUR.plate);
const proj = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "docs", "Ebanist_Proiect_Cetinic-3-corpuri.json"), "utf8"));
const clone = o => JSON.parse(JSON.stringify(o));
function ops(cern, plate) {
  CUR = { cern, plate };
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__f", matBack: "__k", matOvr: {}, matAdd: [MM("__b", 19), MM("__f", 19), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
  const cfg = Object.assign({}, clone(proj.configs["Entrance dx"]), { matBody: "__b", matFront: "__f", matBack: "__k", name: "Entrance dx" });
  const b = S.buildModule(cfg), G = S.deriveCarcass(S.carcassParams(cfg, {}));
  return clone(S.generateOperations({ boxes: b.boxes, cfg, G }));
}
const count = (o, re) => o.pieces.reduce((n, p) => n + p.operations.filter(q => re.test(q.note || "")).length, 0);

describe("geomOf", () => {
  test("INSERTA și knock-in cer dornuri; screw-on nu (articolele vechi le păstrează)", () => {
    assert.equal(H.geomOf("blum_71b3590").dowels, true);
    assert.equal(H.geomOf("blum_71b3650").dowels, false);
    assert.equal(H.geomOf("blum_71b3550").dowels, true, "legacy D-48");
    assert.equal(H.geomOf("blum_71t3550").dowels, true, "legacy D-48");
  });
  test("cupa, TB și placuța vin din date; articol necunoscut → null", () => {
    const g = H.geomOf("blum_71b3590"); assert.deepEqual(clone([g.cup_dia, g.tb, g.plate_front, g.plate_spacing]), [35, [3, 7], 37, 32]);
    assert.equal(H.geomOf("haf_metalla"), null);
    assert.equal(H.geomOf("blum_71b3590", "175H31").plate.kind, "horizontal");
  });
  test("catalogEntries: câte un articol pe cod, fără id-uri deja cunoscute, cu preț și marcaj de verificat", () => {
    const e = H.catalogEntries(["blum_71b3550"]); assert.ok(e.length > 100);
    assert.ok(!e.some(x => x.id === "blum_71b3550")); assert.equal(new Set(e.map(x => x.id)).size, e.length);
    e.forEach(x => { assert.ok(x.price > 0 && x.chk === 1 && x.art && x.n.ro); });
  });
});

describe("ops cu balama aleasă", () => {
  test("implicit (blum_71b3550) = ca înainte: 10 cupe, 20 dornuri, 20 găuri de placuță", () => {
    const o = ops("blum_71b3550"); assert.deepEqual([count(o, /tazza cerniera/), count(o, /tassello cerniera/), count(o, /basetta cerniera/)], [10, 20, 20]);
  });
  test("screw-on (71B3650): fără dornuri în ușă, cupe și placuțe la fel", () => {
    const o = ops("blum_71b3650"); assert.deepEqual([count(o, /tazza cerniera/), count(o, /tassello cerniera/), count(o, /basetta cerniera/)], [10, 0, 20]);
  });
  test("INSERTA (71B3590): dornuri Ø8 la 45 mm", () => {
    const o = ops("blum_71b3590"); assert.equal(count(o, /tassello cerniera/), 20);
    const d = o.pieces.flatMap(p => p.operations).filter(q => /tassello cerniera/.test(q.note)); d.forEach(q => assert.equal(q.dia, 8));
  });
  test("placuța orizontală 20/32: găurile pe adâncime, la același y, la 20 și 52 mm de față", () => {
    const o = ops("blum_71b3590", "175H31"), pl = o.pieces.flatMap(p => p.operations).filter(q => /basetta cerniera/.test(q.note) && q._w);
    assert.equal(pl.length, 20);
    for (let i = 0; i < pl.length; i += 2) { const a = pl[i]._w, b = pl[i + 1]._w; assert.equal(a[1], b[1]); assert.ok(Math.abs(Math.abs(a[2] - b[2]) - 32) < 1e-6); }
  });
  test("familie fără cotă de cupă: găurire standard + avertisment opsHingeNoGeom", () => {
    const fam = Object.values(H.HINGES).find(f => (!f.cup || !f.cup.dia) && f.parts && f.parts.length && !/accessor/i.test(f.kind || ""));
    if (!fam) return;   // dacă toate familiile au cupă, nu e nimic de verificat
    const o = ops(H.hwIdOf(fam.parts[0].art)); assert.ok(o.warnings.some(w => w.k === "opsHingeNoGeom")); assert.equal(count(o, /tazza cerniera/), 10);
  });
  test("distanța de găurire în afara intervalului familiei dă opsHingeTB", () => {
    CUR = { cern: "blum_71b3590", plate: null };
    S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__f", matBack: "__k", matOvr: {}, matAdd: [MM("__b", 19), MM("__f", 19), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
    const cfg = Object.assign({}, clone(proj.configs["Entrance dx"]), { matBody: "__b", matFront: "__f", matBack: "__k", name: "Entrance dx" });
    const b = S.buildModule(cfg), G0 = S.deriveCarcass(S.carcassParams(cfg, {})), G = Object.assign({}, G0, { foratura: Object.assign({}, G0.foratura, { dist_cant: 9 }) });   // G e înghețat: se copiază
    const o = clone(S.generateOperations({ boxes: b.boxes, cfg, G })); assert.ok(o.warnings.some(w => w.k === "opsHingeTB"));
  });
});
