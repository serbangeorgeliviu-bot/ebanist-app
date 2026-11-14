/* Ebanist — Bucătărie (D-143): unități, aparate, rânduri, blat.
 *
 *   node --test test/kitchen.test.js
 *
 * Nu se verifică ce aparat e „bun”: cotele de nișă sunt date `verificat:false`.
 * Se verifică că tot ce iese din catalogul de unități trece prin motorul
 * EXISTENT fără să-l ocolească: corpul se închide la 0 mm, cotele absolute
 * sunt valide, găurirea nu dă erori de pre-flight, același input dă aceeași
 * ieșire; că aparatele încap în nișele lor la milimetru; că rândurile își
 * calculează pozițiile și restul; că blatul își ia decupajele din plită și
 * chiuvetă și se poate îmbina la 45°.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
const APP = path.join(__dirname, "..", "app");
for (const f of ["ebanist-ops.js", "ebanist-worktop.js", "ebanist-kitchen-data.js", "ebanist-kitchen.js", "ebanist-kitchen-i18n.js"])
  vm.runInContext(fs.readFileSync(path.join(APP, f), "utf8"), S, { filename: f });

const J = x => JSON.parse(JSON.stringify(x));
/* motorul rulează într-un alt context vm: se compară datele, nu prototipurile */
const eq = (a, b, m) => assert.deepEqual(J(a), J(b), m);
const arr = x => Array.from(x || []);
function settings() {
  S.handleIsProfile = () => false;
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__b",
    matOvr: {}, matAdd: [MM("__b", 19), MM("__t38", 38), MM("__t12", 12), MM("__t20", 20)], hwProd: { guida: "blum_tandem" } };
}
const K0 = { t: 19 };
const build = (type, o, K) => S.buildUnit(Object.assign({}, K0, K || {}), type, o || {});
const full = (name, cfg) => Object.assign({ name, matBody: "__b", matFront: "__b", matBack: "__b" }, J(cfg));
function check(name, cfg) {
  settings();
  const f = full(name, cfg), b = S.buildModule(f);
  const out = { f, b, pieces: b.pieces.map(x => Object.assign({}, x)) };
  if (f.type === "standard") {
    const G = S.deriveCarcass(S.carcassParams(f, {}));
    const M = S.carcassMaterials(f);
    const ths = [...new Set(Object.values(M.sp).concat(out.pieces.map(x => x.sp)).filter(x => x > 0))];
    out.close = arr(S.validateCarcassClosure(f, out.pieces, G));
    out.layout = arr(S.validateLayout(f, G).errors);
    out.inv = arr(S.failedInvariants(f, out.pieces, G, { materials: M.mats, thicknesses: ths })).map(r => r.id);
    out.ops = J(S.generateOperations({ boxes: b.boxes, cfg: f, G }));
  }
  if (f.type === "angolare") {
    out.close = [];
    out.pieces.forEach(() => {});
  }
  return out;
}

/* ------------------------------------------------------------------ */
describe("Înălțimile: blatul finit stă la 900", () => {
  test("implicit: soclu = 900 − 38 − 720 = 142", () => {
    const h = S.kitchenHeights({});
    assert.equal(h.plinth, 142); assert.equal(h.baseH, 862); eq(arr(h.errors), []);
  });
  test("blat de 20 mm: soclul crește la 160 și avertizează (în afara 100–150)", () => {
    const h = S.kitchenHeights({ topT: 20 });
    assert.equal(h.plinth, 160); assert.equal(h.warnings[0].k, "khPlinth");
  });
  test("blat de 12 mm cu corp de 770: soclul 118", () => {
    assert.equal(S.kitchenHeights({ topT: 12, bodyH: 770 }).plinth, 118);
  });
  test("tavanul mai jos decât pensilele sau coloanele → eroare", () => {
    const h = S.kitchenHeights({ ceiling: 2100 });
    eq(J(h.errors.map(e => e.k).sort()), ["khTallHigh", "khWallHigh"]);
  });
  test("pensila prea jos peste blat → avertisment", () => {
    assert.equal(S.kitchenHeights({ wallBottom: 1300 }).warnings.some(w => w.k === "khWallLow"), true);
  });
});

/* ------------------------------------------------------------------ */
describe("Fiecare unitate din catalog trece prin motorul existent", () => {
  const SKIP = new Set(["x_gap"]);
  for (const id of Object.keys(S.KITCHEN_UNITS)) {
    if (SKIP.has(id)) continue;
    const u = S.KITCHEN_UNITS[id];
    const widths = u.ws && u.ws.length ? u.ws : [u.w0];
    for (const w of widths) test(`${id} ${w}`, () => {
      const r = build(id, { w });
      if (id === "t_fridgefz") { assert.equal(r.errors[0].k, "kuNoRoom"); return; }
      eq(J(r.errors), []);
      assert.ok(r.cfg, "are cfg");
      const c = check(id + w, r.cfg);
      assert.ok(c.pieces.length || r.spaceOnly || r.cfg.mode === "range", "emite piese");
      if (c.close) eq(c.close, [], "închidere 0 mm");
      if (c.layout) eq(c.layout, [], "cote absolute valide");
      if (c.ops) {
        const err = c.ops.pieces.flatMap(p => p.preflight.filter(x => x.level === "error").map(x => p.role + " " + x.rule));
        eq(err, [], "găurire fără erori de pre-flight");
      }
    });
  }
  test("determinism: aceeași intrare, aceeași ieșire", () => {
    for (const id of ["b_sink", "t_oven", "n_dw", "c_blind", "w_hood"]) {
      assert.equal(JSON.stringify(build(id, {}).cfg), JSON.stringify(build(id, {}).cfg), id);
    }
  });
});

/* ------------------------------------------------------------------ */
describe("Aparatele încap în nișe, la milimetru", () => {
  test("catalog: id-uri unice, nișă ≥ corp, montaje cunoscute", () => {
    const ids = S.KITCHEN_APPL.map(a => a.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const a of S.KITCHEN_APPL) {
      assert.ok(S.KITCHEN_KINDS.includes(a.kind), a.id);
      assert.ok(a.mounts.length && a.mounts.every(m => S.KITCHEN_MOUNTS.includes(m)), a.id);
      assert.equal(a.verificat, false, a.id + " trebuie să rămână neverificat");
      if (a.niche) { assert.ok(a.niche.w > 0 && a.niche.h > 0 && a.niche.d > 0, a.id + " nișă"); assert.ok(a.niche.h >= a.h - 40 || a.mounts[0] === "libera", a.id + " înălțime"); }
      if (a.kind === "hob" || a.kind === "sink") assert.ok(a.cut.w > 0 && a.cut.d > 0 && a.cut.r >= 0, a.id + " decupaj");
    }
  });
  test("coloană cuptor: cuptorul de 595 are exact golul lui, între rafturi", () => {
    const r = build("t_oven", {});
    const bay = r.bays.find(b => b.appl === "oven60");
    assert.equal(bay.h, 595);
    assert.equal(r.appliances.find(a => a.id === "oven60").h, 595);
  });
  test("coloană cuptor + microunde: ambele gauri la cota lor", () => {
    const r = build("t_oven", { micro: "micro38" });
    eq(r.bays.filter(b => b.appl).map(b => [b.appl, b.h]), [["oven60", 595], ["micro38", 380]]);
    const c = check("t", r.cfg); eq(c.close, []); eq(c.layout, []);
  });
  test("frigider integrat: golul 1780 și ușă pe toată înălțimea golului", () => {
    const r = build("t_fridge", {});
    assert.equal(r.bays[0].h, 1780); assert.equal(r.bays[0].front, true);
    assert.equal(r.cfg.fronts.length, 1 + 2);   // ușa frigiderului + 2 uși de deasupra
  });
  test("aparat prea înalt pentru corp → eroare, nu corp greșit", () => {
    const r = build("t_fridgefz", {});
    assert.equal(r.errors[0].k, "kuNoRoom"); assert.equal(r.cfg, null);
    eq(J(build("t_fridgefz", {}, { tallH: 2400 }).errors), []);
  });
  test("aparat mai lat decât golul → eroare", () => {
    const r = build("t_washer", { w: 600 });
    assert.equal(r.errors[0].k, "kuNicheWide");
  });
  test("montaj nepermis pentru aparat → eroare", () => {
    const r = S.composeBays(K0, { W: 600, H: 862, P: 560, support: "zoccolo", plinth: 142, top: "traverse",
      bays: [{ k: "niche", appl: "oven60", mount: "scomparsa" }] });
    assert.equal(r.errors[0].k, "kuMount");
  });
  test("cuptor la baza plitei: stă lipit sub blat (aliniat sus)", () => {
    const r = build("b_hoboven", {});
    const a = r.appliances[0];
    assert.equal(a.y + a.h, r.cfg.H - 19);
  });
  test("aparatele ajung în cutiile 3D ca `m`/`aparat`, nu ca piese", () => {
    settings();
    const r = build("t_oven", {});
    const b = S.buildModule(full("t", r.cfg));
    const m = b.boxes.filter(x => x.role === "aparat");
    assert.equal(m.length, 1); assert.equal(m[0].kind, "m");
    assert.equal(b.pieces.some(p => /cuptor|oven|aparat/i.test(p.elemento)), false);
  });
});

/* ------------------------------------------------------------------ */
describe("Nișa (tip `nisa`): fără corp, vecinii sunt pereții", () => {
  test("mașina de spălat vase 60: 2 traverse + soclu + ușă de integrat", () => {
    settings();
    const r = build("n_dw", {}), b = S.buildModule(full("DW", r.cfg));
    const el = b.pieces.map(p => p.elemento + " " + p.lung + "x" + p.larg + "x" + p.pz);
    eq(el, ["Traversa cielo 598x100x2", "Zoccolo 598x142x1", "Anta 715x598x1"]);
    assert.equal(b.pieces.some(p => /Base|Fianco|Schienale/.test(p.elemento)), false, "nu are bază, lateral, spate");
  });
  test("ușa de integrat = înălțimea ușii normale (719 la 862, soclu 142), lățime golul − 2", () => {
    settings();
    const r = build("n_dw", {}); const a = S.buildModule(full("DW", r.cfg)).pieces.find(p => p.elemento === "Anta");
    assert.equal(a.lung, 715); assert.equal(a.larg, 598);
  });
  test("incasso (inox): fără ușă, aparatul își are fața", () => {
    settings();
    const r = build("n_dw", { appl: "dw60_inox" }), b = S.buildModule(full("DW", r.cfg));
    assert.equal(b.pieces.some(p => p.elemento === "Anta"), false);
  });
  test("parțial integrat: ușa scurtată cu comenzile vizibile", () => {
    settings();
    const a = S.buildModule(full("DW", build("n_dw", { appl: "dw60_semi" }).cfg)).pieces.find(p => p.elemento === "Anta");
    assert.equal(a.lung, 715 - 90);
  });
  test("nișa de 45: lățimea vine din aparat, nu din 600", () => {
    const r = build("n_dw", { appl: "dw45_total" });
    assert.equal(r.w, 450); assert.equal(r.cfg.L, 450);
  });
  test("aragaz liber și gol de hotă: fără piese, cu aparatul desenat", () => {
    settings();
    for (const [id, o] of [["n_range", { w: 900 }], ["w_hoodspace", { w: 900 }]]) {
      const r = build(id, o), b = S.buildModule(full(id, r.cfg));
      assert.equal(b.pieces.length, 0, id);
      assert.ok(b.boxes.some(x => x.kind === "m" && x.role === "aparat"), id);
      assert.ok(b.boxes.some(x => x.kind === "p"), id + " are urmă în plan");
    }
  });
  test("panou de completare: front + soclu; panou de capăt: un lateral", () => {
    settings();
    const f = S.buildModule(full("F", build("x_filler", { w: 150 }).cfg)).pieces.map(p => p.elemento + " " + p.lung + "x" + p.larg);
    eq(f, ["Panou de completare 715x148", "Zoccolo 150x142"]);
    const e = S.buildModule(full("E", build("x_end", {}).cfg)).pieces;
    assert.equal(e.length, 1); assert.equal(e[0].lung, 862); assert.equal(e[0].larg, 560);
  });
  test("grosimea vine din material: traversele nu depind de un 19 scris în cod", () => {
    settings();
    const r = build("n_dw", {}), cfg = full("DW", r.cfg); cfg.matBody = "__t38";
    const b = S.buildModule(cfg);
    const box = b.boxes.find(x => x.role === "traversa_cielo");
    assert.equal(box.y1 - box.y0, 38);
  });
});

/* ------------------------------------------------------------------ */
describe("Colțul", () => {
  test("colț orb: o ușă pe partea liberă, partea orbă fără front", () => {
    const r = build("c_blind", { w: 1000, doorW: 500, side: "left" });
    assert.equal(r.cfg.fronts.length, 1);
    assert.equal(r.cfg.fronts[0].w, 496); assert.equal(r.cfg.fronts[0].x, 2);
    const c = check("C", r.cfg); eq(c.close, []); eq(c.layout, []);
  });
  test("colț orb dreapta: ușa în dreapta", () => {
    const r = build("c_blind", { w: 1000, doorW: 500, side: "right" });
    assert.equal(r.cfg.fronts[0].x, 1000 - 500 + 2);
  });
  test("colț în L: tip angolare cu două aripi; mecanismul de carusel e listat, nu desenat", () => {
    const r = build("c_l", { w: 900, mech: "carousel", side: "right" });
    assert.equal(r.cfg.type, "angolare"); assert.equal(r.mech, "carousel");
    assert.ok(r.notes.includes("kuLNote"));
    settings();
    const b = S.buildModule(full("L", r.cfg));
    assert.equal(b.angCorner.wallB, r.wing.reach, "peretele vecin începe unde spune planul");
  });
  test("acoperirea peretelui vecin: reach = adâncime + t + L2", () => {
    const r = build("c_l", { w: 900 });
    assert.equal(r.wing.reach, 560 + 19 + 900);
  });
});

/* ------------------------------------------------------------------ */
describe("Rânduri: poziții, rest, colțuri", () => {
  function plan(walls, corners, K) {
    const built = {};
    for (const w of walls) for (const c of w.cols) {
      built[c.id] = build(c.type, Object.assign({ w: c.w }, c.opts || {}), K);
      if (c.up) built[c.id + ":up"] = build(c.up.type, Object.assign({ w: c.w }, c.up.opts || {}), K);
    }
    return { p: S.planKitchen(Object.assign({}, K0, K || {}), { walls, corners: corners || [] }, built), built };
  }
  test("poziții cumulate de la capătul peretelui; restul rămâne", () => {
    const { p } = plan([{ id: "w1", L: 3000, cols: [{ id: "a", type: "b_door", w: 600 }, { id: "b", type: "b_drawers", w: 800 }] }]);
    eq(p.walls[0].items.map(i => [i.from, i.to]), [[0, 600], [600, 1400]]);
    assert.equal(p.walls[0].rest, 1600);
    assert.ok(p.warnings.some(w => w.k === "kpRest" && w.mm === 1600));
  });
  test("depășire: eroare cu milimetrii", () => {
    const { p } = plan([{ id: "w1", L: 1000, cols: [{ id: "a", type: "b_door", w: 600 }, { id: "b", type: "b_door", w: 600 }] }]);
    eq(J(p.errors), [{ k: "kpOver", wall: 1, mm: 200 }]);
  });
  test("colț: peretele care nu trece începe după adâncimea celuilalt (579)", () => {
    const { p } = plan([{ id: "w1", L: 3000, cols: [] }, { id: "w2", L: 3000, cols: [{ id: "a", type: "b_door", w: 600 }] }], [{ through: "first" }]);
    assert.equal(p.walls[1].floorStart, 579);
    assert.equal(p.walls[1].items[0].from, 579);
  });
  test("colț cu „second”: primul perete se oprește înainte de al doilea", () => {
    const { p } = plan([{ id: "w1", L: 3000, cols: [] }, { id: "w2", L: 3000, cols: [] }], [{ through: "second" }]);
    assert.equal(p.walls[0].floorEnd, 3000 - 579);
    assert.equal(p.walls[1].floorStart, 0);
  });
  test("pensila sus urmează coloana de jos", () => {
    const { p } = plan([{ id: "w1", L: 3000, cols: [{ id: "a", type: "b_door", w: 600, up: { type: "w_door" } }, { id: "b", type: "b_door", w: 800, up: { type: "w_door" } }] }]);
    eq(p.walls[0].upper.map(u => [u.from, u.w]), [[0, 600], [600, 800]]);
  });
  test("lista de aparate însumează, pe tip și montaj", () => {
    const { p } = plan([{ id: "w1", L: 3600, cols: [
      { id: "a", type: "n_dw", w: 600 }, { id: "b", type: "n_dw", w: 600 }, { id: "c", type: "t_oven", w: 600 }] }]);
    const dw = p.appliances.find(a => a.id === "dw60_total");
    assert.equal(dw.n, 2); assert.ok(p.appliances.some(a => a.id === "oven60"));
  });
});

/* ------------------------------------------------------------------ */
describe("Hota: distanța față de plită", () => {
  function hood(hobId, upType, up) {
    const K = K0;
    const cols = [{ id: "h", type: "b_hobdr", w: 600, opts: { hob: hobId }, up: up === null ? null : { type: upType, opts: up || {} } }];
    const built = { h: build("b_hobdr", { w: 600, hob: hobId }) };
    if (cols[0].up) built["h:up"] = build(upType, Object.assign({ w: 600 }, up || {}));
    return S.planKitchen(K, { walls: [{ id: "w", L: 3000, cols }], corners: [] }, built);
  }
  test("inducție + hotă coș: 650 mm se respectă din oficiu", () => {
    const p = hood("hob_ind60", "w_hoodspace");
    assert.equal(p.hoods[0].need, 650); assert.equal(p.hoods[0].dist, 650); assert.equal(p.warnings.some(w => w.k === "khClear"), false);
  });
  test("gaz: 750 mm", () => {
    const p = hood("hob_gas60", "w_hoodspace");
    assert.equal(p.hoods[0].need, 750); assert.equal(p.hoods[0].dist, 750);
  });
  test("hota coborâtă sub minim → avertisment cu cotele", () => {
    const built = { h: build("b_hobdr", { w: 600, hob: "hob_gas60" }), "h:up": build("w_hoodspace", { w: 600, bottom: 1500 }) };
    built["h:up"].cfg.bottom = 1500;
    const p = S.planKitchen(K0, { walls: [{ id: "w", L: 3000, cols: [{ id: "h", type: "b_hobdr", w: 600, up: { type: "w_hoodspace" } }] }], corners: [] }, built);
    const w = p.warnings.find(x => x.k === "khClear");
    eq([w.have, w.need], [600, 750]);
  });
  test("pensilă obișnuită deasupra plitei, mai jos de minim → avertisment", () => {
    const p = hood("hob_gas60", "w_door", {});   // pensila începe la 1450 → 550 față de blat
    const w = p.warnings.find(x => x.k === "khClear");
    eq([w.have, w.need], [550, 750]);
  });
  test("plită fără nimic deasupra → avertisment de hotă lipsă", () => {
    assert.ok(hood("hob_ind60", null, null).warnings.some(w => w.k === "khNoHood"));
  });
});

/* ------------------------------------------------------------------ */
describe("Blatul bucătăriei: decupaje din aparate, coloane scoase, aragaz care desparte", () => {
  function specs(cols, extra) {
    const built = {}, names = {};
    cols.forEach(c => { built[c.id] = build(c.type, Object.assign({ w: c.w }, c.opts || {})); names[c.id] = "M_" + c.id; });
    const spec = Object.assign({ walls: [{ id: "w1", L: 6000, cols }], corners: [] }, extra || {});
    const pl = S.planKitchen(K0, spec, built);
    return S.worktopSpecs(K0, spec, pl, names);
  }
  test("plită și chiuvetă: decupaj la centrul coloanei, dimensiunile aparatului", () => {
    const w = specs([{ id: "a", type: "b_door", w: 600 }, { id: "b", type: "b_sink", w: 1000, opts: { sink: "sink15" } }, { id: "c", type: "b_hobdr", w: 600 }]);
    assert.equal(w.length, 1);
    eq(w[0].mods, ["M_a", "M_b", "M_c"]);
    const sink = w[0].cutouts.find(c => c.kind === "sink"), hob = w[0].cutouts.find(c => c.kind === "hob");
    eq([sink.x, sink.w, sink.d], [1100, 980, 460]);
    eq([hob.x, hob.w, hob.d], [1900, 560, 490]);
  });
  test("coloana nu poartă blat", () => {
    const w = specs([{ id: "t", type: "t_pantry", w: 600 }, { id: "a", type: "b_door", w: 600 }]);
    eq(w[0].mods, ["M_a"]);
  });
  test("aragazul liber desparte blatul în două", () => {
    const w = specs([{ id: "a", type: "b_door", w: 600 }, { id: "r", type: "n_range", w: 900 }, { id: "b", type: "b_door", w: 600 }]);
    assert.equal(w.length, 2); eq([w[0].mods, w[1].mods], [["M_a"], ["M_b"]]);
  });
  test("nișa mașinii de spălat vase poartă blat (e sub el)", () => {
    const w = specs([{ id: "a", type: "b_door", w: 600 }, { id: "d", type: "n_dw", w: 600 }, { id: "b", type: "b_door", w: 600 }]);
    eq(w[0].mods, ["M_a", "M_d", "M_b"]);
  });
  test("îmbinarea cerută ajunge în specificație", () => {
    const w = specs([{ id: "a", type: "b_door", w: 600 }], { wtJoint: "mitre" });
    assert.equal(w[0].joint, "mitre");
    assert.equal(specs([{ id: "a", type: "b_door", w: 600 }])[0].joint, "butt");
  });
});

/* ------------------------------------------------------------------ */
describe("Îmbinarea la 45° cu freza (blat)", () => {
  const walls = [{ id: "w1", i: 0, L: 3000, angle: 90 }, { id: "w2", i: 1, L: 2400, angle: 90 }];
  const mods = (p2) => [{ name: "a", wall: "w1", x0: 0, x1: 3000, front: 560, yTop: 862 }, { name: "b", wall: "w2", x0: 560, x1: 2400, front: p2 || 560, yTop: 862 }];
  const run = (joint, extra, m) => S.deriveWorktop(Object.assign({ mods: ["a", "b"], joint }, extra || {}), walls, m || mods());

  test("dreaptă: ca înainte (a doua piesă se oprește în muchia primei)", () => {
    const r = run("butt");
    eq(r.segments.map(s => [s.L, s.start, s.end]), [[3000, "free", "corner"], [1820, "butt", "free"]]);
    assert.equal(r.joints[0].type, "butt");
  });
  test("45°: ambele piese ajung în colț, lungimea pe muchia din spate", () => {
    const r = run("mitre");
    eq(r.errors, []);
    eq(r.segments.map(s => [s.L, s.start, s.end]), [[3000, "free", "mitre"], [2400, "mitre", "free"]]);
    eq(r.segments.map(s => s.mitre), [{ start: false, end: true }, { start: true, end: false }]);
    assert.equal(r.joints[0].type, "mitre"); assert.equal(r.joints[0].length, 820.2);
  });
  test("45°: locașurile sunt perpendiculare pe linie, în ambele piese, în interiorul lor", () => {
    const r = run("mitre");
    for (const s of r.segments) {
      assert.equal(s.pockets.length, 3);
      for (const p of s.pockets) { assert.ok(p.x > 0 && p.x < s.L && p.y > 0 && p.y < s.P, JSON.stringify(p)); assert.ok(p.ang === 45 || p.ang === 135); }
    }
  });
  test("45° cere adâncimi egale: 580 față de 630 → eroare", () => {
    const r = run("mitre", {}, mods(610));
    assert.equal(r.errors[0].k, "wtMitreDepth");
    eq(run("butt", {}, mods(610)).errors, []);
  });
  test("un colț la 45° și altul drept în același blat", () => {
    const w3 = walls.concat([{ id: "w3", i: 2, L: 2000, angle: 90 }]);
    const m3 = mods().concat([{ name: "c", wall: "w3", x0: 560, x1: 2000, front: 560, yTop: 862 }]);
    const r = S.deriveWorktop({ mods: ["a", "b", "c"], joints: ["mitre", "butt"] }, w3, m3);
    eq(r.errors, []); eq(r.joints.map(j => j.type), ["mitre", "butt"]);
  });
  test("decupaj prea aproape de diagonală → eroare; mai departe → bun", () => {
    const near = run("mitre", { cutouts: [{ kind: "hob", seg: 0, x: 2650, y: 60, w: 560, d: 490, r: 6 }] });
    assert.equal(near.errors.some(e => e.k === "wtCutOutside"), true);
    const far = run("mitre", { cutouts: [{ kind: "hob", seg: 0, x: 1500, y: 60, w: 560, d: 490, r: 6 }] });
    eq(far.errors, []);
  });
  test("piesa din `buildModule`: unghiul de 45° pe capătul tăiat, lungimea pe muchia din spate", () => {
    settings();
    const r = run("mitre");
    const cfg = (sg) => ({ name: "B" + sg.n, type: "blat", L: sg.L, P: sg.P, matBody: "__t38", matFront: "__t38", matBack: "__t38",
      bordo: sg.bordo, cutouts: sg.cutouts, pockets: sg.pockets, mitre: sg.mitre });
    const a = S.buildModule(cfg(r.segments[0])), b = S.buildModule(cfg(r.segments[1]));
    eq([a.pieces[0].angL, a.pieces[0].angR], [undefined, 45]);
    eq([b.pieces[0].angL, b.pieces[0].angR], [45, undefined]);
    assert.equal(a.pieces[0].lung, 3000);
    /* 3D: fața din față a piesei A se oprește la L − P (3000 − 580), nu la L */
    const pts = a.boxes.flatMap(x => (x.pc || []).map(q => q)).filter(q => q[1] > 579);
    const front = Math.max(...pts.map(q => q[0]));
    assert.ok(Math.abs(front - (3000 - 580)) < 0.5, "front " + front);
    const back = Math.max(...a.boxes.map(x => x.x1));
    assert.ok(Math.abs(back - 3000) < 0.5);
  });
  for (const th of [12, 20, 38]) test(`grosimea blatului vine din material: ${th} mm`, () => {
    settings();
    const r = run("mitre"), id = th === 12 ? "__t12" : th === 20 ? "__t20" : "__t38";
    const b = S.buildModule({ name: "B", type: "blat", L: r.segments[0].L, P: r.segments[0].P, matBody: id, matFront: id, matBack: id, bordo: "1L", cutouts: [], pockets: [], mitre: r.segments[0].mitre });
    assert.equal(b.pieces[0].sp, th); assert.equal(b.boxes[0].y1, th);
  });
});

/* ------------------------------------------------------------------ */
describe("Texte: toate cheile în toate cele 7 limbi", () => {
  const raw = S.KITCHEN_I18N_RAW, L = S.KITCHEN_LANGS;
  test("fiecare cheie are 7 texte, nevide, cu aceleași {substituții}", () => {
    for (const k of Object.keys(raw)) {
      assert.equal(raw[k].length, L.length, k);
      const ph = s => (s.match(/\{\w+\}/g) || []).sort().join();
      for (let i = 0; i < L.length; i++) { assert.ok(raw[k][i] && raw[k][i].trim(), k + " " + L[i]); assert.equal(ph(raw[k][i]), ph(raw[k][0]), k + " " + L[i]); }
    }
  });
  test("fiecare unitate, categorie, tip de aparat, montaj și notă are text", () => {
    const need = [];
    Object.keys(S.KITCHEN_UNITS).forEach(id => need.push("ku_" + id));
    ["base", "niche", "corner", "tall", "wall", "fill"].forEach(c => need.push("kcat_" + c));
    S.KITCHEN_KINDS.forEach(k => need.push("ka_" + k));
    S.KITCHEN_MOUNTS.forEach(m => need.push("km_" + m));
    S.KITCHEN_APPL.forEach(a => { if (a.sub) need.push("kas_" + a.sub); });
    for (const k of need) assert.ok(raw[k], "lipsește " + k);
  });
  test("toate mesajele motorului au text", () => {
    const src = fs.readFileSync(path.join(APP, "ebanist-kitchen.js"), "utf8") + fs.readFileSync(path.join(APP, "ebanist-worktop.js"), "utf8");
    const keys = new Set([...src.matchAll(/k: "((?:kp|kh|ku|wt)[A-Za-z]+)"/g)].map(m => m[1]));
    const existing = fs.readFileSync(path.join(APP, "index.html"), "utf8");
    for (const k of keys) assert.ok(raw[k] || existing.includes('"' + k + '"') || existing.includes(k + ":"), "mesaj fără text: " + k);
    const notes = [...src.matchAll(/"(ku[A-Z][A-Za-z]+Note)"/g)].map(m => m[1]);
    for (const n of notes) assert.ok(raw[n], n);
  });
});

describe("Lățime liberă și „Completează peretele”", () => {
  test("orice lățime e acceptată fără avertisment de listă; doar intervalul se verifică", () => {
    const r = build("b_door", { w: 537 });
    eq(r.errors, []); assert.equal(r.warnings.some(w => w.k === "kuWidthRange"), false);
    assert.equal(build("b_door", { w: 90 }).warnings.some(w => w.k === "kuWidthRange"), true);
    const c = check("odd", r.cfg); eq(c.close, []); eq(c.layout, []);
  });
  test("restul se împarte între coloanele libere; nișele de aparat rămân fixe", () => {
    const cols = [{ type: "n_dw", w: 600 }, { type: "b_door", w: 600 }, { type: "b_drawers", w: 600 }];
    const r = S.fitWidths(cols, 301);
    eq(r.widths, [600, 750, 751]); assert.equal(r.changed, true);
  });
  test("fără coloane libere sau fără rest: nimic nu se schimbă", () => {
    eq(S.fitWidths([{ type: "n_dw", w: 600 }], 200).widths, [600]);
    assert.equal(S.fitWidths([{ type: "b_door", w: 600 }], 0).changed, false);
  });
  test("rest negativ (depășire): coloanele libere se strâng", () => {
    eq(S.fitWidths([{ type: "b_door", w: 800 }, { type: "b_door", w: 800 }], -100).widths, [750, 750]);
  });
});
