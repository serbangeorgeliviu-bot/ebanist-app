/* Ebanist — U.16: ușa care se deschide în sus (basculantă), cu mecanism de ridicare din catalog.
 *
 *   node --test test/liftdoor.test.js
 *
 * `cfg.lift` = id-ul sistemului (Blum AVENTOS, Hettich Lift Advanced, Häfele Free) sau null = ușa pe balamale, ca înainte.
 * Ce trebuie să rămână adevărat:
 *  - implicit nimic nu se schimbă (distinta de dinainte, rând cu rând, D-39);
 *  - cu mecanism: rândul se numește «Anta basculante», nu are balamale în lista de feronerie, e un set de mecanism pe ușă;
 *  - 3D: o cutie pe ușă, sub:"lift", cu datele mecanismului; ops: nicio bază de balama pe lateral, nicio cupă pe ușă;
 *  - greutatea ușii vine din material; limitele din tabelul producătorului dau avertismente, nu o alegere în tăcere;
 *  - front de sticlă, curb, pliant sau înclinat: ușa rămâne pe balamale, cu avertisment.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
["ebanist-lift-data.js", "ebanist-liftfit.js", "ebanist-ops.js"].forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", f), "utf8"), S, { filename: f }));
const J = x => JSON.stringify(x);

function build(cfg) {
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__b",
    matOvr: {}, matAdd: [MM("__b", 19), MM("pfl5", 5)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "B", type: "standard", L: 900, H: 700, P: 330, plinth: 0, tram: 0, shelves: 1, drawers: 0,
    doors: 1, back: 1, hang: 1, support: "sospeso", matBody: "__b", matFront: "__b", matBack: "__b", drawerSys: "legno" }, cfg);
  const b = S.buildModule(full);
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  return { b, full, G, pieces: b.pieces.map(x => Object.assign({}, x)),
    ops: () => JSON.parse(J(S.generateOperations({ boxes: b.boxes, cfg: full, G }))) };
}
const rows = (r, re) => r.pieces.filter(p => re.test(p.elemento));
const warn = r => (r.b.warn && r.b.warn.liftWarn) || [];

describe("Implicit: nimic nu se schimbă", () => {
  test("fără cfg.lift distinta e aceeași, rând cu rând, și nu apare nicio ușă basculantă", () => {
    const a = build({}), b = build({ lift: null });
    assert.equal(J(a.pieces), J(b.pieces));
    assert.equal(rows(a, /basculante/i).length, 0);
    assert.equal(warn(a).length, 0);
  });
  test("un id necunoscut = ca fără mecanism", () => {
    assert.equal(J(build({ lift: "nu_exista" }).pieces), J(build({}).pieces));
  });
});

describe("Cu mecanism", () => {
  const r = build({ lift: "blum_hk_top", doors: 1 });
  test("rând «Anta basculante» în loc de «Anta», aceleași cote ca ușa pe balamale", () => {
    const a = build({}), d = rows(a, /^Anta/)[0], l = rows(r, /^Anta basculante/)[0];
    assert.ok(l, "lipsește rândul");
    assert.equal(rows(r, /^Anta(?! basculante)/).length, 0);
    assert.equal(l.lung, d.lung); assert.equal(l.larg, d.larg); assert.equal(l.pz, d.pz);
    assert.equal(l.role, "frontale");
  });
  test("3D: o cutie pe ușă, sub:'lift', cu datele mecanismului", () => {
    const bx = r.b.boxes.filter(x => x.sub === "lift");
    assert.equal(bx.length, 1);
    assert.equal(bx[0].lift.sys, "blum_hk_top"); assert.equal(bx[0].lift.motion, "stay");
    assert.ok(bx[0].lift.kg > 0 && bx[0].lift.kh > 0);
    assert.equal(r.b.boxes.filter(x => x.sub === "door").length, 0);
  });
  test("ops: nicio cupă de balama pe ușă, nicio bază de balama pe lateral", () => {
    const o = r.ops();
    assert.equal(J(o).includes("tazza cerniera"), false);
    assert.equal(o.hw.filter(h => h.type === "cerniera").length, 0);
    assert.ok(o.warnings.some(w => w.k === "opsLiftNoDrill"), "se spune că găurile mecanismului nu sunt generate");
    const d = build({}).ops();                                   // control: ușa pe balamale are cupă și balamale
    assert.ok(J(d).includes("tazza cerniera") && d.hw.some(h => h.type === "cerniera"));
  });
  test("mai multe uși = un set pe ușă", () => {
    const m = build({ lift: "het_la_hk", doors: 2, L: 1200 });
    assert.equal(m.b.boxes.filter(x => x.sub === "lift").length, 2);
    assert.equal(rows(m, /^Anta basculante/)[0].pz, 2);
  });
});

describe("Limite și avertismente", () => {
  test("mereu avertismentul «cote neverificate» (nimic nu e verificat:false→true înainte de o piesă reală)", () => {
    assert.ok(warn(build({ lift: "blum_hk_top" })).some(w => w.k === "unv"));
  });
  test("ușă prea grea pentru Blum HK top (18 kg): avertisment de interval pe kg", () => {
    const w = warn(build({ lift: "blum_hk_top", H: 700, L: 1800, doors: 1, P: 600 }));
    assert.ok(w.some(x => x.k === "range" || x.k === "power"), J(w));
  });
  test("corp prea scund pentru Blum HK top (înălțime interioară minimă 173): avertisment", () => {
    const w = warn(build({ lift: "blum_hk_top", H: 200 }));
    assert.ok(w.some(x => x.k === "range" && (x.what === "hi" || x.what === "kh")), J(w));
  });
  test("front de sticlă: ușa rămâne pe balamale, cu avertisment", () => {
    const g = build({ lift: "blum_hk_top", front: "vetro", H: 1200, doors: 1 });
    assert.equal(rows(g, /basculante/i).length, 0);
    assert.ok(warn(g).some(w => w.k === "front"));
  });
  test("uși pliante: rămân pliante, cu avertisment", () => {
    const g = build({ lift: "blum_hk_top", fold: 2, H: 1200, L: 1200, doors: 1 });
    assert.equal(rows(g, /basculante/i).length, 0);
    assert.ok(warn(g).some(w => w.k === "front"));
  });
});
