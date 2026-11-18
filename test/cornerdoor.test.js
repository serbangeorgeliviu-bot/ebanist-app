/* Ebanist — U.17: unitatea de colț / scoasă / mecanismul pe corp (cfg.cu): distinctă, ușă, 3D, găurire, avertismente.
 *
 *   node --test test/cornerdoor.test.js
 *
 * Ce trebuie să rămână adevărat:
 *  - implicit nimic nu se schimbă: un corp fără `cu` (sau cu un id necunoscut) dă aceeași distinctă și aceleași cutii, rând cu rând (D-39);
 *  - cu unitate: interiorul e al ei (rafturi, sertare, tramezzi, bară: 0, spus în avertismente); ușa colțului e cea din date, cu balamalele pe partea oarbă;
 *    scoasele cu front pe cadru nu au balamale («Fronte estraibile»); cutiile 3D ale unității nu sunt piese (nu intră în ops și nu se taie);
 *  - la corpul de colț unitatea e pe aripa A, aripa B rămâne cum era; găurile NU se generează (avertisment), invariantele de închidere trec pe configurația efectivă;
 *  - toate cele 57 de unități se construiesc fără eroare pe corp standard și de colț.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
["ebanist-corner-data.js", "ebanist-cornerfit.js", "ebanist-corner.js", "ebanist-ops.js"].forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", f), "utf8"), S, { filename: f }));
const J = x => JSON.stringify(x);
const A = x => JSON.parse(JSON.stringify(x));
const F = vm.runInContext("EBCornerFit", S), CO = vm.runInContext("EBCorner", S);

function build(cfg) {
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__b",
    matOvr: {}, matAdd: [MM("__b", 19), MM("pfl5", 5)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "B", type: "standard", L: 900, H: 720, P: 560, plinth: 100, tram: 0, shelves: 1, drawers: 0,
    doors: 2, back: 1, hang: 0, support: "zoccolo", matBody: "__b", matFront: "__b", matBack: "__b", drawerSys: "legno" }, cfg);
  const b = S.buildModule(full), G = S.deriveCarcass(S.carcassParams(full, {}));
  return { b, full, G, pieces: A(b.pieces), boxes: A(b.boxes),
    ops: () => A(S.generateOperations({ boxes: b.boxes, cfg: full, G })) };
}
const rows = (r, re) => r.pieces.filter(p => re.test(p.elemento));
const cu = r => r.boxes.filter(x => x.role === "cornerhw");
const warn = r => (r.b.warn && r.b.warn.cuWarn) || [];

describe("Implicit: nimic nu se schimbă", () => {
  test("fără cfg.cu sau cu un id necunoscut: aceeași distinctă și aceleași cutii", () => {
    const a = build({}), b = build({ cu: null }), c = build({ cu: "nu_exista" }), d = build({ cu: "" });
    assert.equal(J(a.pieces), J(b.pieces)); assert.equal(J(a.boxes), J(b.boxes));
    assert.equal(J(a.pieces), J(c.pieces)); assert.equal(J(a.boxes), J(c.boxes)); assert.equal(J(a.pieces), J(d.pieces));
    assert.equal(cu(a).length, 0); assert.equal(warn(a).length, 0); assert.equal(a.b.cu, undefined);
  });
  test("corpul de colț fără unitate e neschimbat, ambele aripi", () => {
    const o = { type: "angolare", L2: 900, corner: "dx" };
    assert.equal(J(build(o).pieces), J(build({ ...o, cu: null }).pieces));
  });
  test("unitatea nu se aplică pe alte tipuri (masă, pat, blat): corpul rămâne cel de dinainte", () => {
    const a = build({ type: "tavolo", L: 1200, P: 700, H: 740, doors: 0, shelves: 0 }), b = build({ type: "tavolo", L: 1200, P: 700, H: 740, doors: 0, shelves: 0, cu: "kb_lemans2" });
    assert.equal(J(a.pieces), J(b.pieces)); assert.equal(cu(b).length, 0);
  });
});

describe("Colț cu parte oarbă (LeMans II, Salso, Magic Corner …)", () => {
  const r = build({ cu: "kb_lemans2", cuHand: "dx", doors: 2, shelves: 2, L: 900, H: 800 });
  test("interiorul e al unității: rafturile și a doua ușă dispar, spus în avertismente", () => {
    assert.equal(rows(r, /^Ripiano/).length, 0);
    assert.equal(rows(r, /^Anta/).length, 1); assert.equal(rows(r, /^Anta/)[0].pz, 1);
    const f = warn(r).filter(w => w.k === "forced").map(w => w.what).sort();
    assert.deepEqual(A(f), ["doors", "shelves"]);
  });
  test("ușa are lățimea din date (450 pentru lățimea interioară 862), balamalele pe partea oarbă", () => {
    const row = rows(r, /^Anta/)[0], d = r.boxes.find(x => x.role === "frontale" && x.sub === "door");
    assert.equal(r.b.cu.size, "450"); assert.equal(row.larg, 450); assert.equal(Math.round(d.x1 - d.x0), 450);
    assert.equal(d.hinge, "right", "partea oarbă la dreapta → balamalele la dreapta");
    assert.equal(build({ cu: "kb_lemans2", cuHand: "sx", H: 800 }).boxes.find(x => x.sub === "door").hinge, "left");
    assert.equal(r.b.cu.doorW, 450);
  });
  test("ușa stă la capătul liber: la partea oarbă dreaptă începe la marginea stângă a frontului", () => {
    const d = r.boxes.find(x => x.sub === "door"), fi = r.boxes.filter(x => x.role === "fianco").sort((a, b) => a.x0 - b.x0);
    assert.ok(d.x0 <= fi[0].x1 + 3, "ușa pornește lângă lateralul stâng");
    const l = build({ cu: "kb_lemans2", cuHand: "sx", H: 800 }).boxes.find(x => x.sub === "door"), fr = build({ cu: "kb_lemans2", cuHand: "sx", H: 800 }).boxes.filter(x => x.role === "fianco").sort((a, b) => a.x0 - b.x0);
    assert.ok(l.x1 >= fr[1].x0 - 3, "partea oarbă la stânga: ușa la capătul din dreapta");
  });
  test("cutiile unității: metal, rol «cornerhw», fără piesă, pk ≥ 9500, nu apar în ops", () => {
    const c = cu(r); assert.ok(c.length >= 3);
    c.forEach(b => { assert.equal(b.kind, "m"); assert.equal(b.sub, "cu"); assert.ok(b.pk >= 9500); assert.ok(b.cu && b.cu.u === "kb_lemans2"); });
    const o = r.ops(); assert.equal(o.pieces.filter(p => p.pk >= 9500).length, 0);
    assert.ok(o.warnings.some(w => w.k === "opsCornerNoDrill"), "găurile nu se generează, se spune");
    assert.ok(o.hw.filter(h => h.type === "cerniera").length >= 2, "balamalele ușii se găuresc ca de obicei");
  });
  test("tăvile merg cu ușa (același pivot) — datele de mișcare sunt în model", () => {
    const door = r.boxes.find(x => x.sub === "door"), trays = cu(r).filter(b => b.cu.an && b.cu.an.follow);
    assert.ok(trays.length >= 2); trays.forEach(b => assert.equal(b.cu.an.follow, door.pk));
  });
  test("tavă dintr-o bucată (LeMans) vs coșuri față + spate (Magic Corner Comfort)", () => {
    const m = build({ cu: "peka_magic_corner_comfort", cuHand: "sx", H: 700, L: 1000 }), mc = cu(m);
    assert.ok(mc.some(b => b.cu.nm === "rear" && b.cu.an.dz > 0), "coșul din spate alunecă înainte");
    assert.ok(mc.some(b => b.cu.nm === "ftray"), "coșul din față merge cu ușa");
    assert.ok(cu(r).every(b => b.cu.nm !== "rear"));
  });
  test("limite din tabel → avertismente, nu alegere în tăcere; mereu «cote neverificate»", () => {
    const x = build({ cu: "kb_lemans2", L: 600, H: 800 }), ks = warn(x).filter(w => w.k === "range").map(w => w.what);
    assert.ok(ks.includes("wi")); assert.ok(warn(x).some(w => w.k === "unv"));
    assert.equal(x.b.cu.issues.find(i => i.k === "wi").lo, 764);
  });
  test("lățimea ușii necitită (Kesseböhmer Magic Corner): jumătate din corp, spus «schematic»", () => {
    const m = build({ cu: "kb_magic_corner", H: 800 });
    assert.ok(warn(m).some(w => w.k === "doorsch"));
    assert.ok(Math.abs(rows(m, /^Anta/)[0].larg - 448) <= 1, "jumătate din ușa de 894–896");
  });
  test("distincta rămâne cea de dinainte pe ce nu se atinge: laterale, bază, cap, spate, ușa aceleași cote", () => {
    const a = build({ L: 900, H: 800, shelves: 0, doors: 1 }), b = build({ cu: "kb_lemans2", L: 900, H: 800, doors: 1, shelves: 0 });
    ["Fianco", "Base", "Schienale", "Zoccolo"].forEach(n => assert.equal(J(rows(a, new RegExp("^" + n)).map(p => [p.lung, p.larg, p.pz])), J(rows(b, new RegExp("^" + n)).map(p => [p.lung, p.larg, p.pz])), n));
    assert.equal(rows(a, /^Anta/)[0].lung, rows(b, /^Anta/)[0].lung, "înălțimea ușii");
  });
});

describe("Corp de colț (angolare): unitatea pe aripa A, aripa B neatinsă", () => {
  const base = { type: "angolare", L: 1000, L2: 900, H: 800, corner: "dx", shelves: 2, doors: 2 };
  const a = build(base), b = build({ ...base, cu: "hettich_salso" });
  test("aripa B are aceleași rânduri; aripa A are interiorul eliberat", () => {
    const wb = x => x.pieces.filter(p => p.wing === "B");
    assert.equal(J(wb(a)), J(wb(b)));
    assert.equal(b.pieces.filter(p => p.wing === "A" && /^Ripiano/.test(p.elemento)).length, 0);
    assert.ok(a.pieces.filter(p => p.wing === "B" && /^Ripiano/.test(p.elemento)).length > 0, "aripa B păstrează rafturile");
    assert.equal(b.pieces.filter(p => p.wing === "A" && /^Anta/.test(p.elemento))[0].pz, 1);
    assert.equal(b.pieces.filter(p => p.wing === "B" && /^Anta/.test(p.elemento))[0].pz, 2);
  });
  test("partea oarbă vine din `cfg.corner` (aici dreapta): balamalele pe dreapta", () => {
    const d = b.boxes.find(x => x.sub === "door" && x.wing !== "B");
    assert.equal(d.hinge, "right"); assert.equal(b.b.cu.hand, "dx");
    assert.equal(build({ ...base, corner: "sx", cu: "hettich_salso" }).boxes.find(x => x.sub === "door" && x.wing !== "B").hinge, "left");
  });
  test("cutiile unității sunt numai pe aripa A (nu primesc rotația aripii B)", () => {
    const c = cu(b); assert.ok(c.length >= 3); c.forEach(x => assert.ok(!x.wing && !x.rot));
  });
});

describe("Scoase cu front pe cadru, carusele, alte mecanisme", () => {
  test("Dispensa: «Fronte estraibile» în loc de «Anta», fără balamale, coșurile din date", () => {
    const r = build({ cu: "kb_dispensa_vvsx", L: 450, H: 2000, P: 600, doors: 2 });
    assert.equal(rows(r, /^Anta/).length, 0); assert.equal(rows(r, /^Fronte estraibile/).length, 1);
    const f = r.boxes.find(x => x.role === "frontale"); assert.equal(f.sub, "cufront"); assert.equal(f.hinge, undefined); assert.ok(f.cu.an.dz > 0);
    const o = r.ops(); assert.equal(o.hw.filter(h => h.type === "cerniera").length, 0, "nicio balama");
    assert.ok(o.warnings.some(w => w.k === "opsCornerNoDrill"));
    assert.equal(r.b.cu.band, "b3"); assert.equal(r.b.cu.n, 5);
    const g = cu(r).filter(x => x.cu.nm === "basket"); assert.ok(g.every(x => x.pk === g[0].pk), "un cadru = o piesă rigidă");
    const tw = Math.max(...g.map(x => x.x1)) - Math.min(...g.map(x => x.x0));
    assert.ok(tw > 400 - 1 - 30 && tw < 450, "lățimea coșului e a corpului: basketW 400 + montanți");
  });
  test("Dispensa 150: lățimea coșului e cea din sursă (100)", () => {
    const r = build({ cu: "kb_dispensa_vvsx", L: 150, H: 1500, P: 560, doors: 1 }), g = cu(r).filter(x => x.cu.nm === "basket" && x.y1 - x.y0 <= 5);
    assert.equal(Math.round(g[0].x1 - g[0].x0), 100);
  });
  test("fronturile frame se reduc la una; handles push: tot nicio balama", () => {
    const r = build({ cu: "peka_pinello_cargo", L: 300, H: 720, doors: 3, handles: "push" });
    assert.equal(rows(r, /^Fronte estraibile/).reduce((s, p) => s + p.pz, 0), 1);
    assert.ok(rows(r, /^Fronte estraibile.*push/).length === 1);
  });
  test("carusel: discul are diametrul din sursă (720) și se rotește în jurul axei", () => {
    const r = build({ cu: "kb_carousel", cuSize: "800", L: 800, P: 800, H: 760, doors: 2 }), sh = cu(r).filter(x => x.cu.nm === "shelf");
    assert.equal(sh.length, 2);
    const w = Math.max(...sh[0].pc.map(p => p[0])) - Math.min(...sh[0].pc.map(p => p[0]));
    assert.ok(Math.abs(w - 720) < 1 || Math.abs(Math.max(...sh[0].pc.map(p => p[1])) - Math.min(...sh[0].pc.map(p => p[1])) - 720) < 1, "diametrul 720");
    assert.ok(sh[0].cu.an.rot && sh[0].cu.an.rot.deg === 120); assert.equal(r.b.cu.dia, 720);
    assert.equal(rows(r, /^Anta/)[0].pz, 2, "ușile rămân ale corpului");
  });
  test("carusel prea mic pentru disc: avertisment «dia»", () => {
    const x = build({ cu: "kb_carousel", cuSize: "800", L: 800, P: 560, H: 760 });
    assert.ok(warn(x).some(w => w.k === "range" && w.what === "dia"));
  });
  test("FurnSpin: fără uși, corpul rotativ din date (caseta din interval), fără găuri, dimensiunile spuse", () => {
    const r = build({ cu: "hettich_furnspin", L: 700, H: 1500, P: 650, doors: 2, shelves: 3 });
    assert.equal(rows(r, /^Anta/).length, 0); assert.equal(rows(r, /^Ripiano/).length, 0);
    assert.ok(r.b.cu.spin && r.b.cu.spin.B >= 564 && r.b.cu.spin.B <= 664, J(r.b.cu.spin));
    assert.ok(warn(r).some(w => w.k === "spinnodrill"));
    assert.ok(cu(r).some(x => x.cu.nm === "spin" && x.cu.an.rot.deg === 90));
    assert.ok(r.b.cu.size === "XL");
  });
  test("pulldown pe corp agățat: coșuri cu cursa din sursă (418)", () => {
    const r = build({ cu: "hafele_easy_down", L: 500, H: 720, P: 340, support: "sospeso", plinth: 0, doors: 2 });
    const g = cu(r).filter(x => x.cu.nm === "basket"); assert.ok(g.length > 3); assert.equal(g[0].cu.an.dy, -418); assert.equal(r.b.cu.travel, 418);
    assert.equal(rows(r, /^Anta/).length, 1, "ușa rămâne pe balamale (Easy Down: uși cu balamale)");
  });
  test("TV lift: cursa 700, cielo scos (fără tavan), nicio verificare de adâncime", () => {
    const r = build({ cu: "hafele_tv_lift", L: 900, H: 900, P: 600 });
    assert.equal(r.boxes.filter(x => x.role === "cielo").length, 0, "fără tavan: TV-ul iese");
    assert.ok(warn(r).some(w => w.k === "forced" && w.what === "top"));
    assert.equal(cu(r).find(x => x.cu.nm === "carriage").cu.an.dy, 700);
    assert.ok(!warn(r).some(w => w.k === "range" && w.what === "depth"));
  });
  test("consolă: ușa devine «Piano ribaltabile», rabatată în jurul muchiei de jos; greutatea ușii față de sarcină", () => {
    const r = build({ cu: "hafele_fold_hinged_spring", L: 600, H: 500, P: 300, doors: 1, support: "sospeso", plinth: 0 });
    assert.equal(rows(r, /^Anta/).length, 0); assert.equal(rows(r, /^Piano ribaltabile/).length, 1);
    const f = r.boxes.find(x => x.sub === "flap"); assert.equal(f.cu.an.hx.deg, 90); assert.equal(Math.round(f.cu.an.hx.y), Math.round(f.y0));
    const heavy = build({ cu: "hafele_fold_hinged_spring", L: 1800, H: 2000, P: 300, doors: 1, support: "sospeso", plinth: 0 });
    assert.ok(warn(heavy).some(w => w.k === "range" && w.what === "kg" && w.hi === 40), "ușa grea depășește 40 kg pe pereche");
    assert.ok(!warn(r).some(w => w.k === "range" && w.what === "kg"));
  });
  test("platou rotativ: se așază pe primul raft (rafturile rămân), rotația 90° numai dacă încape", () => {
    const a = build({ cu: "hettich_comfortspin", L: 800, P: 560, H: 720, shelves: 2, doors: 2 });
    assert.equal(rows(a, /^Ripiano/).length > 0, true, "platoul nu golește corpul");
    const p = cu(a)[0]; assert.equal(Math.round(p.x1 - p.x0), 425); assert.equal(Math.round(p.z1 - p.z0), 285); assert.equal(p.y1 - p.y0, 37);
    assert.equal(p.cu.an.rot.deg, 90);
    const t = build({ cu: "hettich_comfortspin", L: 800, P: 420, H: 720, shelves: 2 });
    assert.equal(cu(t)[0].cu.an, undefined, "adâncime prea mică pentru rotația completă: rămâne nemișcat");
  });
  test("SPACE CORNER: două sertare, două fronturi care ies, avertisment «schematic»", () => {
    const r = build({ cu: "blum_space_corner", doors: 1 });
    assert.equal(rows(r, /^Fronte estraibile/)[0].pz, 2);
    assert.equal(new Set(cu(r).filter(x => x.cu.nm === "drawer").map(x => x.pk)).size, 2);
    assert.ok(warn(r).some(w => w.k === "cdrawer"));
  });
});

describe("Toate unitățile se construiesc", () => {
  test("57 de unități × corp standard (4 forme) și corp de colț: fără eroare, cutii finite, ops fără excepție", () => {
    const overs = [{}, { type: "angolare", L2: 900, corner: "dx" }, { L: 450, H: 2000, P: 600, doors: 1 }, { L: 500, H: 700, P: 330, support: "sospeso", plinth: 0, doors: 2 }, { L: 600, H: 1500, cuHand: "dx" }];
    let n = 0;
    for (const u of F.list()) for (const o of overs) {
      const r = build({ ...o, cu: u.key }); n++;
      assert.ok(Array.isArray(warn(r)), u.key);
      r.boxes.forEach(x => ["x0", "x1", "y0", "y1", "z0", "z1"].forEach(k => assert.ok(isFinite(x[k]), u.key + " " + k)));
      if (u.kind !== "bracket") assert.ok(cu(r).length > 0, u.key + " " + J(o));
      r.ops();
    }
    assert.ok(n >= 57 * 5);
  });
  test("invariantele de închidere trec pe configurația efectivă (ușa de colț îngustă nu pică I4)", () => {
    for (const k of ["kb_lemans2", "hettich_salso", "peka_magic_corner_comfort", "grass_quaturis_s", "kb_magic_corner", "hafele_utensio_inline"]) {
      const r = build({ cu: k, H: 800, L: 1000 }), eff = CO.prep(r.full).cfg2, G = S.deriveCarcass(S.carcassParams(eff, {}));
      assert.equal(eff.cuPartial, 1, k);
      const bad = A(S.validateInvariants(eff, r.b.pieces, G, { materials: {}, thicknesses: [19, 5], maxDim: 2800 })).filter(x => x.ok === false);
      assert.deepEqual(A(bad.map(x => x.id)), [], k);
      assert.equal(A(S.validateCarcassClosure(eff, r.b.pieces, G)).length, 0, k);
    }
  });
  test("deterministă: aceeași cfg → aceleași rânduri și cutii", () => {
    const o = { cu: "kb_lemans2", H: 800, cuHand: "dx" };
    assert.equal(J(build(o).pieces), J(build(o).pieces)); assert.equal(J(build(o).boxes), J(build(o).boxes));
  });
});
