/* Găurirea mesei fixe și a patului (D-124): colțarele blatului, feroneria patului, suporturile de doagă.
 * Numărul fiecărei piese = cel din deviz (`flatHwCounts`).   node --test fixed-ops.test.js */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
function gen(cfg) {
  S.handleIsProfile = () => false;
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k", matOvr: {},
    matAdd: [MM("__b", 19), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "M", matBody: "__b", matFront: "__b", matBack: "__k" }, cfg);
  const b = S.buildModule(full);
  return { b, o: JSON.parse(JSON.stringify(S.generateOperations({ boxes: b.boxes, cfg: full, G: null }))) };
}
const cnt = (o, t) => o.hw.filter(h => h.type === t).length;
const clean = o => !o.pieces.some(p => p.preflight.some(w => w.level === "error"));

test("masă fixă: colțare de blat = numărul din deviz, un șurub în zargă și unul în blat", () => {
  for (const [L, P] of [[1200, 800], [1600, 900], [2200, 1000]]) {
    const { o } = gen({ type: "tavolo", L, H: 750, P });
    const rl = L - 2 * 130 - 20, rs = P - 2 * 130 - 20;
    const clipsL = Math.max(2, Math.round(rl / 350)), clipsS = Math.max(2, Math.round(rs / 350));
    assert.equal(cnt(o, "colt_blat"), 2 * clipsL + 2 * clipsS, L + "×" + P);
    assert.ok(clean(o));
    const top = o.pieces.find(p => p.role === "cielo");
    assert.equal(top.operations.filter(x => x.type === "drill").length, cnt(o, "colt_blat"));
    o.pieces.filter(p => p.role === "traversa").forEach(r => assert.ok(r.operations.some(x => x.type === "drill")));
  }
});
test("masă extensibilă: fără colțare (blatul stă pe glisiere)", () => {
  const { o } = gen({ type: "tavolo", L: 1600, H: 750, P: 900, tableExt: "haf_642_68_901" });
  assert.equal(cnt(o, "colt_blat"), 0); assert.equal(cnt(o, "guida_tav"), 2);
});
test("pat: feroneria = cea din deviz (4 perechi, 2 console, picioare, suporturi de doagă)", () => {
  for (const L of [900, 1400, 1660]) {
    const { b, o } = gen({ type: "letto", L, H: 950, P: 2060 });
    const slats = b.boxes.filter(x => x.role === "doga").length;
    assert.equal(cnt(o, "beschlag_pat"), 4, "L=" + L);
    assert.equal(cnt(o, "consola_trav"), 2);
    assert.equal(cnt(o, "picior_pat"), L >= 1400 ? 2 : 1);
    assert.equal(o.hw.filter(h => h.type === "suport_doga" && h.catalog === "gen_slathold").length, slats * 2);
    assert.equal(o.hw.filter(h => h.type === "suport_doga" && h.catalog === "gen_slathold2").length, slats);
    assert.ok(clean(o), "pre-flight L=" + L);
  }
});
test("pat: feroneria cade pe suprapunerea sponda–tăblie, inclusiv cu sponda ridicată de sertare", () => {
  const { o } = gen({ type: "letto", L: 1660, H: 950, P: 2060, bedStor: "drawers", bedBox: "both", bedBoxN: 2 });
  assert.ok(clean(o));
  const foot = o.pieces.find(p => p.sub === "pediera");
  foot.operations.filter(x => x.type === "drill" && x.dia === 4).forEach(x => assert.ok(x._w[1] >= 0 && x._w[1] <= foot.max[1] + 0.01));
  assert.equal(cnt(o, "beschlag_pat"), 4);
});
test("pat cu cutii sub pat și masă: determinism și fără erori pe dimensiuni aleatoare", () => {
  let seed = 17; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296, ri = (a, b) => Math.round(a + rnd() * (b - a));
  for (let i = 0; i < 150; i++) {
    const cs = [{ type: "tavolo", L: ri(900, 2800), H: ri(700, 780), P: ri(600, 1100) },
                { type: "letto", L: ri(800, 2000), H: ri(700, 1200), P: ri(1700, 2300), bedStor: ["boxes", "drawers", null][ri(0, 2)], bedBox: ["sx", "dx", "both"][ri(0, 2)], bedBoxN: ri(1, 3), bedDay: ri(0, 1), bedFootH: ri(200, 800) }];
    cs.forEach(c => { try { const r = gen(c); assert.ok(clean(r.o), JSON.stringify(c)); assert.deepEqual(r.o, gen(c).o); } catch (e) { if (!/mai înguste|mai larg|puțin adânci|mai scurte|rămân doar|cel puțin 550/.test(e.message)) throw e; } });
  }
});
