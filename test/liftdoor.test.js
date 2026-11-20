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
const LF = vm.runInContext("EBLiftFit", S);

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

describe("SERVO-DRIVE (Blum, deschidere electrică)", () => {
  test("cu servo adâncimea minimă crește (HK top 187 → 235 mm): avertisment pe un corp de 220 mm adâncime", () => {
    const base = build({ lift: "blum_hk_top", P: 230 }), el = build({ lift: "blum_hk_top", liftElec: "servo", P: 230 });
    const dep = r => warn(r).some(w => w.k === "range" && w.what === "depth");
    assert.equal(dep(base), false); assert.equal(dep(el), true, J(warn(el)));
  });
  test("3D: corpul mecanismului ia lățimea și adâncimea din fișa SERVO-DRIVE", () => {
    const l = build({ lift: "blum_hk_top", liftElec: "servo", P: 300 }).b.boxes.find(x => x.sub === "lift").lift;
    assert.equal(l.servo, true); assert.equal(l.bodyW, 67); assert.equal(l.depthMin, 235);
    assert.equal(build({ lift: "blum_hk_top" }).b.boxes.find(x => x.sub === "lift").lift.servo, false);
  });
  test("un sistem fără SERVO-DRIVE în surse rămâne mecanic, cu avertisment", () => {
    const r = build({ lift: "het_la_hk", liftElec: "servo" });
    assert.ok(warn(r).some(w => w.k === "noservo")); assert.equal(r.b.boxes.find(x => x.sub === "lift").lift.servo, false);
  });
  test("datele: patru sisteme Blum top au servo; cota Ø10 și codurile din sursă", () => {
    const withS = LF.list().filter(s => s.servo).map(s => s.key).sort();
    assert.equal(J(withS), J(["blum_hf_top", "blum_hk_top", "blum_hl_top", "blum_hs_top"]));
    assert.equal(LF.get("blum_hk_top").servo.cableHole.y, 82);
    assert.equal(LF.get("blum_hk_top").servo.codes.drive, "23KA000");
  });
});

describe("E-Drive (Häfele, deschidere electrică la Free)", () => {
  test("datele: cinci sisteme Free au edrive (flap 1.7, 3.15, fold, up, swing), Free Slim nu", () => {
    const w = LF.list().filter(s => s.edrive).map(s => s.key).sort();
    assert.equal(J(w), J(["haf_free_flap_17", "haf_free_flap_315", "haf_free_fold", "haf_free_swing", "haf_free_up"]));
    assert.equal(LF.get("haf_free_flap_17").edrive.senderHoleDia, 35);
  });
  test("cfg.liftElec = edrive pe Free flap: marcat în 3D, fără avertisment «noservo»", () => {
    const r = build({ lift: "haf_free_flap_17", liftElec: "edrive", H: 400 });
    const l = r.b.boxes.find(x => x.sub === "lift").lift;
    assert.equal(l.edrive, true); assert.equal(l.servo, false);
    assert.equal(warn(r).some(w => w.k === "noservo"), false);
  });
  test("edrive pe un sistem fără el (Blum) rămâne mecanic, cu avertisment; servo pe Häfele la fel", () => {
    assert.ok(warn(build({ lift: "blum_hk_top", liftElec: "edrive" })).some(w => w.k === "noservo"));
    assert.ok(warn(build({ lift: "haf_free_flap_17", liftElec: "servo", H: 400 })).some(w => w.k === "noservo"));
  });
});


describe("Front în două piese (D-174): Blum HF top, Hettich Lift Advanced HF, Häfele Free fold", () => {
  const BF = ["blum_hf_top", "het_la_hf", "haf_free_fold"];
  test("sistemele cu două clape sunt cele din date (flaps = 2); celelalte au una", () => {
    for (const k of BF) assert.equal(LF.get(k).flaps, 2, k);
    for (const k of ["blum_hk_top", "blum_hl_top", "haf_free_flap_17", "het_la_hk"]) assert.equal(LF.get(k).flaps, 1, k);
  });
  test("două rânduri «Anta basculante (1/2)» și «(2/2)»: aceeași lățime, înălțimi întregi, suma + rostul de 3 mm = înălțimea frontului de dinainte", () => {
    for (const k of BF) for (const doors of [1, 2]) {
      const one = build({ lift: "blum_hk_top", doors }), r = build({ lift: k, doors });
      const up = rows(r, /^Anta basculante \(1\/2\)$/)[0], lo = rows(r, /^Anta basculante \(2\/2\)$/)[0], full = rows(one, /^Anta basculante$/)[0];
      assert.ok(up && lo, k + " " + doors + ": rânduri lipsă");
      assert.equal(up.larg, full.larg, "lățimea ca la ușa întreagă"); assert.equal(lo.larg, up.larg);
      assert.equal(up.pz, doors); assert.equal(lo.pz, doors);
      assert.ok(Number.isInteger(up.lung) && Number.isInteger(lo.lung));
      assert.ok(Math.abs(up.lung - lo.lung) <= 1, "clape egale (diferă cel mult 1 mm)");
      assert.equal(up.lung + lo.lung + 3, full.lung, k + ": clape + rost = frontul întreg");
      assert.equal(rows(r, /^Anta basculante$/).length, 0, "nu mai există rândul întreg");
    }
  });
  test("3D: două cutii pe ușă (flap 1 sus, 2 jos), stivuite fără suprapunere, cu rost de 3 mm; datele mecanismului pe ambele", () => {
    const r = build({ lift: "blum_hf_top", doors: 2 }), bx = r.b.boxes.filter(x => x.sub === "lift");
    assert.equal(bx.length, 4);
    for (let i = 0; i < 2; i++) {
      const u = bx.find(x => x.lift.i === i && x.lift.flap === 1), l = bx.find(x => x.lift.i === i && x.lift.flap === 2);
      assert.ok(u && l); assert.equal(u.x0, l.x0); assert.equal(u.x1, l.x1);
      assert.ok(Math.abs((u.y0 - l.y1) - 3) < 1e-9, "rost de 3 mm: " + (u.y0 - l.y1));
      assert.equal(u.lift.sys, "blum_hf_top"); assert.equal(l.lift.flaps, 2); assert.equal(u.lift.jointY, l.lift.jointY);
      assert.ok(l.lift.jointY > l.y1 && l.lift.jointY < u.y0, "rostul între clape");
    }
  });
  test("avertisment «flaps» (balamalele de legătură nu sunt în catalog) + cote neverificate; o clapă nu are avertismentul", () => {
    assert.ok(warn(build({ lift: "blum_hf_top" })).some(w => w.k === "flaps"));
    assert.ok(!warn(build({ lift: "blum_hk_top" })).some(w => w.k === "flaps"));
  });
  test("controalele de închidere nu cad (clapa de jos nu se numără a doua oară la lățime)", () => {
    for (const k of BF) {
      const r = build({ lift: k, doors: 2 }), M = S.carcassMaterials(r.full), ths = [...new Set(Object.values(M.sp).concat(r.pieces.map(x => x.sp)).filter(x => x > 0))];
      const ko = Array.from(S.failedInvariants(r.full, r.pieces, r.G, { materials: M.mats, thicknesses: ths })).map(x => x.id);
      assert.deepEqual(J(ko), "[]", k);
    }
  });
  test("ops: nicio balama și nicio gaură pe cele două clape; ca la ușa dintr-o bucată", () => {
    const o = build({ lift: "blum_hf_top", doors: 1 }).ops(), fr = o.pieces.filter(p => p.role === "frontale");
    assert.equal(fr.length, 2); fr.forEach(p => assert.equal(p.operations.length, 0));
    assert.ok(!o.hw.some(h => h.type === "cerniera"));
  });
  test("o singură clapă: nimic nu se schimbă față de 5.94.1 (rând «Anta basculante», o cutie pe ușă)", () => {
    const r = build({ lift: "blum_hk_top", doors: 2 });
    assert.equal(rows(r, /^Anta basculante$/).length, 1); assert.equal(r.b.boxes.filter(x => x.sub === "lift").length, 2);
    assert.ok(r.b.boxes.filter(x => x.sub === "lift").every(x => x.lift.flap === undefined));
  });
});
