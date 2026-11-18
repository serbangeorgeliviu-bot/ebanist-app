/* Ebanist — U.17: ușile glisante, escamotabile și cu aripă din catalog, în generator (buildModule), ops și 3D.
 *
 *   node --test test/slidingdoor.test.js
 *
 * `cfg.slide` = cheia sistemului (EBSlidingData) sau null = regula generică de dinainte. Ce trebuie să rămână adevărat:
 *  - implicit (și cu id necunoscut sau pe alt tip de corp) distinta e aceeași, rând cu rând (D-39);
 *  - glisante pe corpul «scorrevole»: lățime/suprapunere/jocuri din formula producătorului, rând de accesoriu cu BOM pe coduri, avertismente de limite;
 *  - escamotabile pe corpul standard: «Anta a scomparsa», fără balamale de corp, cutia 3D sub:"pocket" cu datele de retragere; poziția deschisă nu intră în corp;
 *  - cu aripă: foi pliante, fără balamalele generice dintre foi, fără găuri; ops spune că găurile nu sunt generate;
 *  - front de sticlă/curb/în pantă: ușa rămâne pe balamale, cu avertisment.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
["ebanist-sliding-data.js", "ebanist-sliding-i18n.js", "ebanist-sliding.js", "ebanist-ops.js"].forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", f), "utf8"), S, { filename: f }));
const J = x => JSON.stringify(x);

function build(cfg) {
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__b",
    matOvr: {}, matAdd: [MM("__b", 19), MM("pfl5", 5)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "B", type: "standard", L: 900, H: 700, P: 330, plinth: 0, tram: 0, shelves: 0, drawers: 0,
    doors: 1, back: 1, hang: 0, support: "sospeso", matBody: "__b", matFront: "__b", matBack: "__b", drawerSys: "legno" }, cfg);
  const b = S.buildModule(full);
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  return { b, full, G, pieces: b.pieces.map(x => Object.assign({}, x)),
    ops: () => JSON.parse(J(S.generateOperations({ boxes: b.boxes, cfg: full, G }))) };
}
const rows = (r, re) => r.pieces.filter(p => re.test(p.elemento));
const warn = r => (r.b.warn && r.b.warn.slideWarn) || [];
const SLD = { type: "scorrevole", L: 2400, H: 2400, P: 600, doors: 2, shelves: 0, hang: 0 };
const POC = { type: "standard", L: 600, H: 2000, P: 600, doors: 1, shelves: 0, hang: 0, support: "zoccolo", plinth: 80 };
const WNG = { type: "standard", L: 900, H: 1800, P: 500, doors: 1, shelves: 0, hang: 0, support: "zoccolo", plinth: 80 };

describe("Implicit: nimic nu se schimbă", () => {
  test("corp glisant fără sistem = distinta de dinainte; id necunoscut sau de alt tip de corp = la fel", () => {
    const a = build(SLD), b = build(Object.assign({ slide: null }, SLD)), c = build(Object.assign({ slide: "nu_exista" }, SLD)), d = build(Object.assign({ slide: "blum_revego_uno" }, SLD));
    assert.equal(J(a.pieces), J(b.pieces)); assert.equal(J(a.pieces), J(c.pieces)); assert.equal(J(a.pieces), J(d.pieces));
    assert.equal(J(a.b.boxes), J(d.b.boxes)); assert.equal(warn(a).length, 0); assert.equal(warn(d).length, 0);
    const door = rows(a, /^Anta scorrevole/)[0]; assert.equal(door.larg, (2400 + 40) / 2); assert.equal(door.lung, 2400 - 45);       // SLIDE_OVERLAP 40, SLIDE_GAP_TOP 45
  });
  test("corp standard fără sistem (și cu sistem glisant pe corp standard) = distinta de dinainte", () => {
    const a = build(POC), b = build(Object.assign({ slide: null }, POC)), c = build(Object.assign({ slide: "het_topline_xl" }, POC));
    assert.equal(J(a.pieces), J(b.pieces)); assert.equal(J(a.pieces), J(c.pieces)); assert.equal(rows(a, /scomparsa/).length, 0);
  });
  test("fără sistem, uși pliante (cfg.fold) ca înainte: cu «Sistema anta pieghevole» și balamale între foi", () => {
    const r = build(Object.assign({}, WNG, { fold: 2 }));
    assert.equal(rows(r, /^Sistema anta pieghevole/).length, 1); assert.equal(rows(r, /^Sistema ante/).length, 0);
    assert.ok(r.ops().hw.some(h => h.type === "cerniera_pliante"));
  });
});

describe("Glisante pe corpul «scorrevole»", () => {
  test("Hawa Combino 35 H FS, 2 uși: lățime (KAM + 16)/2, suprapunere 16, șina de aceeași lungime cu lățimea interioară", () => {
    const r = build(Object.assign({ slide: "hawa_combino_35_fs" }, SLD)), d = rows(r, /^Anta scorrevole/)[0];
    assert.equal(d.larg, (2400 + 16) / 2); assert.equal(d.pz, 2);
    const x = r.b.boxes.filter(b => b.sub === "slide"); assert.equal(x.length, 2); assert.equal(Math.round(x[1].x0 - x[0].x0), (2400 + 16) / 2 - 16);
    assert.equal(x[0].slide.sys, "hawa_combino_35_fs"); assert.equal(x[0].slide.run, "bottom");
    const sys = rows(r, /^Sistema ante scorrevoli/)[0]; assert.ok(sys && sys.role === "accessorio"); assert.equal(sys.lung, Math.round(r.G.L_int)); assert.ok(sys.slide.bom.length >= 2);
  });
  test("Hawa Combino 35 H IS: ușile stau în corp, de la fața interioară a lateralului", () => {
    const r = build(Object.assign({ slide: "hawa_combino_35_is" }, SLD)), x = r.b.boxes.filter(b => b.sub === "slide");
    assert.equal(Math.round(x[0].x0), 19); assert.ok(x.every(b => b.z1 <= 600)); assert.ok(x.every(b => b.x0 >= 19 - 1e-6 && b.x1 <= 2400 - 19 + 1e-6));
  });
  test("Hettich TopLine XL: formula lățimii lipsește → regula generică + avertisment; jocurile din desen dau înălțimea; lățimea 1220 > 1000 (2 uși) → avertisment de limită", () => {
    const r = build(Object.assign({ slide: "het_topline_xl" }, SLD)), d = rows(r, /^Anta scorrevole/)[0], w = warn(r);
    assert.equal(d.larg, (2400 + 40) / 2); assert.equal(d.lung, 2400 - 45 - 65);
    assert.ok(w.some(x => x.k === "noFormula")); assert.ok(w.some(x => x.k === "drawing" && x.top === 45 && x.bottom === 65));
    assert.ok(w.some(x => x.k === "range" && x.what === "w" && x.hi === 1000)); assert.ok(w.some(x => x.k === "unv"));
    const bx = r.b.boxes.find(b => b.sub === "slide"); assert.equal(Math.round(bx.y0), 65); assert.equal(Math.round(bx.y1), 2400 - 45);
  });
  test("număr de uși în afara intervalului sistemului: se folosesc cele permise, cu avertisment", () => {
    const r = build(Object.assign({ slide: "hawa_combino_20_ms" }, SLD, { doors: 3 }));
    assert.equal(rows(r, /^Anta scorrevole/)[0].pz, 2); assert.ok(warn(r).some(w => w.k === "n" && w.m === 2));
  });
  test("cu sistem, nu mai există «șina generică» în deviz: rândul de sistem poartă codurile", () => {
    const r = build(Object.assign({ slide: "het_slideline_55_ov" }, SLD, { L: 1400, H: 1400, doors: 2 })), s = rows(r, /^Sistema ante scorrevoli/)[0];
    assert.ok(s.slide.bom.some(b => b.id === "sl_9115954" && b.qty === 4), J(s.slide.bom));     // 2 componente de scorrimento pe ușă
  });
  test("3D: cutiile ușilor sunt sub:'slide' (translează la deschidere), unul pe ușă", () => {
    const r = build(Object.assign({ slide: "hawa_combino_35_ms" }, SLD, { doors: 3 })); assert.equal(r.b.boxes.filter(b => b.sub === "slide").length, 3);
    assert.ok(r.b.boxes.filter(b => b.sub === "slide").every(b => b.slide && isFinite(b.slide.x0) && isFinite(b.slide.len)));
  });
  test("ops: se spune că găurile carucioarelor nu sunt generate (numai cu sistem)", () => {
    assert.ok(build(Object.assign({ slide: "het_topline_l" }, SLD)).ops().warnings.some(w => w.k === "opsSlideNoDrill"));
    assert.ok(!build(SLD).ops().warnings.some(w => w.k === "opsSlideNoDrill"));
  });
});

describe("Escamotabile pe corpul standard", () => {
  const r = build(Object.assign({ slide: "blum_revego_uno" }, POC));
  test("«Anta a scomparsa» în loc de «Anta»; lățimea FB = EB − 2·Fs (EB = lățimea interioară); înălțimea = înălțimea interioară − jocurile aplicației", () => {
    const p = rows(r, /^Anta a scomparsa/)[0];
    assert.ok(p && rows(r, /^Anta(?! a scomparsa)/).length === 0); assert.equal(p.larg, Math.round(r.G.L_int - 4)); assert.equal(p.lung, Math.round(r.G.H_int - 6)); assert.equal(p.role, "frontale");
  });
  test("3D: o cutie sub:'pocket' cu datele de retragere (E, M) și al sistemului; nicio ușă pe balamale", () => {
    const x = r.b.boxes.filter(b => b.sub === "pocket"); assert.equal(x.length, 1); assert.equal(r.b.boxes.filter(b => b.sub === "door").length, 0);
    assert.equal(x[0].pocket.open.t, "pivot"); assert.ok(x[0].pocket.open.E > 0 && x[0].pocket.open.M >= 7 && Math.abs(x[0].pocket.open.E + x[0].pocket.open.M - x[0].pocket.w) < 0.2, J(x[0].pocket.open));   // E = FB − FU, M = FU (≥ 7) assert.equal(x[0].pocket.sys, "blum_revego_uno");
  });
  test("ops: nicio cupă de balama pe ușă, nicio bază de balama; se spune că găurile nu sunt generate", () => {
    const o = r.ops(); assert.equal(J(o).includes("tazza cerniera"), false); assert.equal(o.hw.filter(h => h.type === "cerniera").length, 0);
    assert.ok(o.warnings.some(w => w.k === "opsSlideNoDrill"));
  });
  test("avertismente: zona buzunarului liberă, interpretarea EB, cod de verificat, mișcarea schematică, cote neverificate", () => {
    const k = warn(r).map(w => w.k); ["pocket", "interp", "chk", "open", "unv"].forEach(x => assert.ok(k.includes(x), x + " " + k.join()));
  });
  test("poziția DESCHISĂ nu intră în corp: ușa rotită 90° și retrasă cu E stă în buzunar, fără suprapunere cu laterale, cu tavanul sau cu spatele", () => {
    const d = r.b.boxes.find(b => b.sub === "pocket"), K = d.pocket, th = d.z1 - d.z0, o = K.open;
    const sides = r.b.boxes.filter(b => b.role === "fianco"), li = Math.max.apply(null, sides.filter(b => b.x1 <= 300).map(b => b.x1));
    const xl = li + 2, fin = { x0: xl, x1: xl + th, z0: d.z1 - o.E, z1: d.z1 + o.M, y0: d.y0, y1: d.y1 };
    const ov = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 1 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 1 && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > 1;
    const hit = r.b.boxes.filter(b => b.kind === "p" && ov(fin, b));
    assert.equal(hit.length, 0, hit.map(b => b.role + ":" + J([b.x0, b.x1, b.z0, b.z1])).join(" "));
    assert.ok(fin.z0 >= 0 && fin.z1 > d.z1);          // intră în corp (E) și iese în față cu M
  });
  test("Hawa Concepta III 25 Pull: lățimea și înălțimea ca la ușa generică, adâncimea minimă 415 — pe 330 mm avertisment de adâncime", () => {
    const c = build(Object.assign({ slide: "hawa_concepta_iii_25_pull" }, POC, { H: 1500, P: 330 }));
    assert.ok(rows(c, /^Anta a scomparsa/).length === 1); assert.ok(warn(c).some(w => w.k === "depth" && w.lo > 400), J(warn(c)));
  });
  test("Hettich KA 5740: B = LKB − 7, H = LKH − 6, ușa stă în corp (la P − 2)", () => {
    const c = build(Object.assign({ slide: "het_ka_5740" }, POC, { L: 600, H: 800, P: 700 })), p = rows(c, /^Anta a scomparsa/)[0], x = c.b.boxes.find(b => b.sub === "pocket");
    assert.equal(p.larg, Math.round(c.G.L_int - 7)); assert.equal(p.lung, Math.round(c.G.H_int - 6)); assert.equal(Math.round(x.z1), 700 - 2); assert.equal(x.pocket.open.t, "slide");
  });
  test("front de sticlă sau curb: ușa rămâne pe balamale, cu avertisment; pliante cerute: la fel", () => {
    const g = build(Object.assign({ slide: "blum_revego_uno", front: "vetro" }, POC)), f = build(Object.assign({ slide: "blum_revego_uno", fold: 2 }, POC));
    assert.equal(rows(g, /scomparsa/).length, 0); assert.ok(warn(g).some(w => w.k === "front")); assert.equal(rows(f, /scomparsa/).length, 1);
    assert.ok(warn(f).some(w => w.k === "front"));
  });
});

describe("Cu aripă (wing) și pocket pliant", () => {
  const r = build(Object.assign({ slide: "het_wingline_l" }, WNG));
  test("foi pliante pe pachet (2), fără «Sistema anta pieghevole»; rând de sistem cu BOM pe coduri și balamale centrale din tabel", () => {
    assert.equal(rows(r, /^Anta pieghevole/)[0].pz, 2); assert.equal(rows(r, /^Sistema anta pieghevole/).length, 0);
    const s = rows(r, /^Sistema ante scorrevoli/)[0]; assert.ok(s.slide.wing); assert.ok(s.slide.bom.some(b => b.id === "sl_9278742")); assert.ok(s.slide.bom.some(b => b.id === "sl_9277991"));
  });
  test("3D: foile sunt sub:'fold' cu fold.wing (se pliază la deschidere)", () => {
    const x = r.b.boxes.filter(b => b.sub === "fold"); assert.equal(x.length, 2); assert.ok(x.every(b => b.fold.wing === "het_wingline_l"));
  });
  test("ops: nicio cupă generică de balama pliantă; se spune că găurile nu sunt generate", () => {
    const o = r.ops(); assert.equal(o.hw.filter(h => h.type === "cerniera_pliante").length, 0); assert.ok(o.warnings.some(w => w.k === "opsSlideNoDrill"));
  });
  test("limita foii 250–600: ușă de 1500 mm lățime cu 2 foi → foi de 746 mm → avertisment", () => {
    const c = build(Object.assign({ slide: "het_wingline_l" }, WNG, { L: 1500 })); assert.ok(warn(c).some(w => w.k === "range" && w.what === "w" && w.hi === 600), J(warn(c)));
  });
  test("Folding Concepta III: 2–4 foi, alegerea din «pliante»; sistemul cere adâncime (T2 ≥ 344)", () => {
    const c = build(Object.assign({ slide: "hawa_folding_concepta_iii_25_push", fold: 3 }, WNG, { L: 1500, H: 2100, P: 250 }));
    assert.equal(rows(c, /^Anta pieghevole/)[0].pz, 3); assert.ok(warn(c).some(w => w.k === "depth"), J(warn(c)));
  });
});
