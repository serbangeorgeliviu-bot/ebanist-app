/* Ebanist — deschidere push / suspendare / îmbinări fără unealtă: găurire, instanțe pentru 3D, nimic nu se schimbă implicit.
 *
 *   node --test test/open-ops.test.js
 *
 * Regulile (HARD): numai valorile din surse; găuri numai unde sursa dă valoarea ȘI reperul, altfel avertisment de operații;
 * cotele de feronerie rămân verificat:false (D-48); fără alegere explicită pe corp: aceleași operații ca înainte.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM, ROOT = path.join(__dirname, "..");
const load = fs => fs.forEach(f => vm.runInContext(require("fs").readFileSync(path.join(ROOT, "app", f), "utf8"), S, { filename: f }));
const J = x => JSON.stringify(x);

/* --- înainte de a încărca familia nouă: operațiile «de dinainte» pentru configurațiile obișnuite --- */
load(["ebanist-lift-data.js", "ebanist-liftfit.js", "ebanist-ops.js", "ebanist-hwgeom.js"]);
function build(cfg, th) {
  S.handleIsProfile = () => false;
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k", matOvr: {}, matAdd: [MM("__b", th || 19), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "M", type: "standard", L: 900, H: 720, P: 350, plinth: 0, tram: 0, shelves: 1, drawers: 0, doors: 2, back: 1, hang: 1, support: "sospeso",
    matBody: "__b", matFront: "__b", matBack: "__k", handles: "push", drawerSys: "legno" }, cfg);
  const b = S.buildModule(full), G = S.deriveCarcass(S.carcassParams(full, {}));
  return { b, full, G, pieces: b.pieces.map(x => Object.assign({}, x)),
    ops: () => JSON.parse(J(S.generateOperations({ boxes: b.boxes, cfg: full, G }))) };
}
const DEFAULTS = [
  {}, { handles: "maniglia" }, { doors: 1, L: 600 }, { hwSel: { conn: "haf_minifix" } }, { hwSel: { conn: "gen_dowel", cern: "blum_71b3550" } }, { hwSel: { conn: "lam_clamex" } },
  { hwSel: { conn: "fes_domino_8x50" } }, { drawers: 3, doors: 0, H: 720, support: "piedini", plinth: 100 }, { support: "zoccolo", plinth: 80, H: 2000, doors: 2, shelves: 3 }
];
const BEFORE = DEFAULTS.map(c => J(build(c).ops()));
const BEFORE_P = DEFAULTS.map(c => J(build(c).pieces));

/* --- acum familia nouă --- */
load(["ebanist-open-data.js", "ebanist-open-i18n.js", "ebanist-open.js", "ebanist-ops.js", "ebanist-hwgeom.js"]);
const O = S.EBOpen;
const ops = (o, re) => o.pieces.flatMap(p => p.operations.filter(x => re.test(x.note || "")).map(x => Object.assign({}, x, { pc: p })));
const fromInner = (x, panelInnerAtMax) => panelInnerAtMax ? x.pc.thickness - x.z : x.z;

describe("Implicit: nimic nu se schimbă (D-39)", () => {
  test("operațiile fără alegere explicită sunt identice cu cele de dinainte de familia nouă (9 configurații, minifix/dowel/clamex/domino/push)", () => {
    DEFAULTS.forEach((c, i) => assert.equal(J(build(c).ops()), BEFORE[i], "configurația " + i + " " + J(c)));
  });
  test("distinta (piesele) e aceeași și cu alegere explicită: familia nouă nu atinge geometria corpului", () => {
    DEFAULTS.forEach((c, i) => assert.equal(J(build(c).pieces), BEFORE_P[i]));
    const sel = { push: "blum_tipon_short", pushd: "blum_tobm_lbx_l3", susp: "het_sah215", suprail: "het_rail_b", conn: "het_rastex15_b24" };
    [{}, { drawers: 3, doors: 0 }].forEach(c => assert.equal(J(build(Object.assign({}, c, { hwSel: sel })).pieces), J(build(c).pieces)));
  });
  test("fără alegere explicită nu apar instanțe push/sertar/suspendare și nici avertismente noi", () => {
    const o = build({}).ops();
    assert.ok(!o.hw.some(h => ["pushunit", "pushdunit", "susphang", "suprail", "housing", "plug"].includes(h.type)));
    assert.ok(!o.warnings.some(w => /^opsOpen|^wOpen/.test(w.k)));
  });
  test("o cheie necunoscută în hwSel nu strică nimic", () => {
    assert.equal(J(build({ hwSel: { push: "nu_exista", susp: "nu_exista", pushd: "x" } }).ops()), BEFORE[0]);
  });
});

describe("TIP-ON pentru uși: Ø10 în muchia din față, la 7,5 mm de fața interioară", () => {
  test("TIP-ON scurt: Ø10 × 50; lung și cu tampon: Ø10 × 76; axa la 7,5 mm de fața interioară a panoului", () => {
    for (const [id, depth] of [["blum_tipon_short", 50], ["blum_tipon_a", 76], ["blum_tipon_bumper", 76]]) {
      const o = build({ hwSel: { push: id } }).ops(), h = ops(o, /foro push/);
      assert.equal(h.length, 2, id);
      h.forEach(x => { assert.equal(x.dia, 10); assert.equal(x.depth, depth); assert.ok(x.face >= 1 && x.face <= 4, "în muchie"); assert.equal(x.pc.role === "fianco" ? Math.min(x.z, x.pc.thickness - x.z) : x.z, 7.5); });
      assert.ok(o.hw.filter(w => w.type === "pushunit").every(w => w.catalog === id && w.fam === "plunger"));
    }
  });
  test("o ușă pe corp cu un singur front: unitatea stă în fianco, în dreptul marginii libere, la înălțimea mânerului (sus − 60)", () => {
    const r = build({ doors: 1, L: 600, hwSel: { push: "blum_tipon_short" } }), o = r.ops(), u = o.hw.filter(w => w.type === "pushunit");
    assert.equal(u.length, 1); assert.equal(u[0].axis, "x");
    const door = r.b.boxes.find(b => b.sub === "door");
    assert.ok(Math.abs(u[0].w[1] - (door.y1 - 60)) < 0.01, "înălțimea mânerului: " + u[0].w[1]);
    const pc = o.pieces.find(p => String(p.pk) === String(u[0].piece)); assert.equal(pc.role, "fianco");
  });
  test("două uși: unitățile pe tavan (nu există panou în dreptul marginilor libere); numărul de dispozitive = numărul de uși", () => {
    const o = build({ hwSel: { push: "blum_tipon_short" } }).ops();
    assert.equal(o.hw.filter(w => w.type === "pushunit").length, 2);
    assert.ok(ops(o, /foro push/).every(x => x.pc.role === "cielo" || x.pc.role === "fianco"));
  });
  test("avertismentele: poziția pe muchie e alegerea aplicației; fără alegere explicită de push nu e nimic", () => {
    const w = build({ hwSel: { push: "blum_tipon_short" } }).ops().warnings;
    assert.ok(w.some(x => x.k === "opsOpenPlace"));
  });
  test("mere cu push dar handles = maniglia: nicio gaură (dispozitivul e pentru push)", () => {
    const o = build({ handles: "maniglia", hwSel: { push: "blum_tipon_short" } }).ops();
    assert.equal(ops(o, /foro push/).length, 0); assert.ok(!o.hw.some(h => h.type === "pushunit"));
  });
  test("tot ce nu are cotă ȘI reper în sursă: instanță pentru 3D, fără gaură, cu avertisment", () => {
    for (const id of ["het_pto_silent_9239087", "het_pto_magnet_9375985", "het_pto_lock_9381335", "haf_pushsoft_315_11_400", "haf_pushcatch_356_06_460", "haf_pressure_245_50_301", "sal_push_dp4", "sal_mpush_dpm", "blum_tipon_aventos"]) {
      const o = build({ hwSel: { push: id } }).ops();
      assert.equal(ops(o, /foro push/).length, 0, id);
      assert.ok(o.warnings.some(w => w.k === "opsOpenNoDrill"), id);
    }
  });
  test("Tipmatic: știft Ø10 × min 60, la 10 + F de la fața interioară (F = rostul din model)", () => {
    for (const id of ["haf_tipmatic_356_03_520", "grass_tipmatic_68873"]) {
      const o = build({ hwSel: { push: id } }).ops(), h = ops(o, /foro push/);
      assert.equal(h.length, 2);
      h.forEach(x => { assert.equal(x.dia, 10); assert.equal(x.depth, 60); assert.ok([x.z, x.pc.thickness - x.z].some(v => Math.abs(v - 10) < 0.01), "10 + F de la fața interioară: " + x.z); });
    }
  });
  test("grosime prea mică pentru distanța de margine din sursă (1,5 mm): fără gaură, cu avertisment", () => {
    const o = build({ doors: 1, L: 600, hwSel: { push: "blum_tipon_short" } }, 12).ops();   // 12 mm: 7,5 + 5 + 1,5 > 12
    assert.equal(ops(o, /foro push/).filter(x => x.pc.role === "fianco").length, 0);
    assert.ok(o.warnings.some(w => w.k === "opsOpenThick"));
  });
  test("cotele sunt verificat:false (D-48): antetul modelului și datele articolului", () => {
    const o = build({ hwSel: { push: "blum_tipon_short" } }).ops(); assert.equal(o.verificat, false);
    O.all("push").forEach(it => assert.equal(it.verificat, false));
  });
});

describe("Sertare cu push/electric și suspendare: instanțe pentru 3D, fără găuri inventate", () => {
  test("sertare: câte o unitate pe front; dimensiunile Easys 170×68×46 din sursă; la mecanice o unitate schematică marcată", () => {
    const e = build({ drawers: 3, doors: 0, hwSel: { pushd: "het_easys_9078139" } }).ops(), u = e.hw.filter(h => h.type === "pushdunit");
    assert.equal(u.length, 3); u.forEach(x => { assert.equal(J([x.unit.x, x.unit.y, x.unit.z]), "[170,68,46]"); assert.equal(x.schem, false); assert.equal(x.elec, true); });
    const m = build({ drawers: 3, doors: 0, hwSel: { pushd: "blum_tobm_lbx_l3" } }).ops();
    assert.ok(m.hw.filter(h => h.type === "pushdunit").every(x => x.schem === true));
    assert.ok(m.warnings.some(w => w.k === "opsOpenNoDrill"));
  });
  test("suspendare: două cleme pe laterale sus-spate și o șină; SAH 305 (cârlig în fond) fără șină; avertisment: găurile nu sunt generate", () => {
    const o = build({ hwSel: { susp: "het_sah216ahs", suprail: "het_rail_b" } }).ops();
    const h = o.hw.filter(w => w.type === "susphang"), r = o.hw.filter(w => w.type === "suprail");
    assert.equal(h.length, 2); assert.equal(r.length, 1); assert.equal(r[0].catalog, "het_rail_b");
    assert.ok(h.every(x => x.w[1] > 600), "sus"); assert.equal(h[0].dir + h[1].dir, 0);
    assert.ok(o.warnings.some(w => w.k === "wOpenSuspNoDrill"));
    const k = build({ hwSel: { susp: "het_sah305" } }).ops(); assert.equal(k.hw.filter(w => w.type === "suprail").length, 0);
    assert.equal(o.pieces.reduce((n, p) => n + p.operations.length, 0), build({}).ops().pieces.reduce((n, p) => n + p.operations.length, 0), "nicio gaură în plus");
  });
  test("SAH 500: elementul de perete de 118 mm din sursă dă înălțimea desenului; la cele fără cotă desenul e schematic", () => {
    const a = build({ hwSel: { susp: "het_sah500" } }).ops().hw.find(w => w.type === "susphang"); assert.equal(a.h, 118);
    const b = build({ hwSel: { susp: "het_sah216" } }).ops().hw.find(w => w.type === "susphang"); assert.equal(b.schem, true);
    const c = build({ hwSel: { susp: "cam_816as" } }).ops().hw.find(w => w.type === "susphang"); assert.equal(c.h, 148); assert.equal(c.schem, false);
  });
  test("SAH 500: 2 × 2 găuri Ø10 × 12,5 în fața interioară a ambelor laterale, la 43,5 de muchia din spate (MTA p.5), 32 între coloane, 64 între rânduri, C = 14,5 sub tavan", () => {
    const o = build({ hwSel: { susp: "het_sah500" } }).ops(), g = ops(o, /foro sospensione/);
    assert.equal(g.length, 8, "4 pe fiecare lateral");
    const sides = [...new Set(g.map(x => x.pc.pk ?? x.pc.id ?? x.pc.ref))]; assert.equal(sides.length, 2, "două laterale");
    g.forEach(x => { assert.equal(x.dia, 10); assert.equal(x.depth, 12.5); });
    const side = g.filter(x => x.pc === g[0].pc), zs = [...new Set(side.map(x => Math.round(x.y * 10) / 10))].sort((a, b) => a - b), ys = [...new Set(side.map(x => Math.round(x.x * 10) / 10))].sort((a, b) => a - b);
    assert.equal(side.length, 4); assert.equal(zs.length, 2); assert.equal(ys.length, 2);
    assert.equal(zs[0], 43.5, "de la muchia din spate"); assert.equal(Math.round((zs[1] - zs[0]) * 10) / 10, 32); assert.equal(Math.round((ys[1] - ys[0]) * 10) / 10, 64);
    assert.ok(o.warnings.some(w => w.k === "opsSuspPlace") && !o.warnings.some(w => w.k === "wOpenSuspNoDrill"));
    ["het_sah305", "het_sah215", "cam_816as"].forEach(id => { const q = build({ hwSel: { susp: id } }).ops(); assert.equal(ops(q, /foro sospensione/).length, 0, id); assert.ok(q.warnings.some(w => w.k === "wOpenSuspNoDrill"), id); });
  });
});

describe("Îmbinări: locaș cu adâncimea după grosime, axa A, distanța B — din sursă", () => {
  const joint = (o, re) => ops(o, re);
  for (const th of [16, 19]) {
    test("Rastex 15 B24 la " + th + " mm: locaș Ø15 adânc " + { 16: 12.7, 19: 13.7 }[th] + ", axa pe grosime A, tija Ø8 × B", () => {
      const o = build({ hwSel: { conn: "het_rastex15_b24" } }, th).ops(), cam = joint(o, /eccentrico housing/), sh = joint(o, /gambo housing/);
      assert.ok(cam.length > 0 && cam.length === sh.length); assert.equal(o.joint, "housing");
      cam.forEach(x => { assert.equal(x.dia, 15); assert.equal(x.depth, { 16: 12.7, 19: 13.7 }[th]); });
      sh.forEach(x => { assert.equal(x.dia, 8); assert.equal(x.depth, 24); assert.ok(Math.abs(x.z - th / 2) < 0.01, "axa A = " + th / 2); });
      assert.ok(o.warnings.some(w => w.k === "opsOpenNoF"), "gaura din F: sursa nu dă adâncimea");
      assert.ok(!o.warnings.some(w => w.k === "opsOpenB"), "B e în sursă");
      assert.ok(o.hw.filter(h => h.type === "housing").every(h => h.catalog === "het_rastex15_b24"));
    });
  }
  test("Rastex 15 B34: tija Ø8 × 34 și locașul la 34 de muchie", () => {
    const o = build({ hwSel: { conn: "het_rastex15_b34" } }).ops(); joint(o, /gambo housing/).forEach(x => assert.equal(x.depth, 34));
  });
  test("Rafix-20: Ø20, adâncime 12,7 (16) / 14,2 (19); B lipsește din sursă: se spune, se folosește valoarea Minifix; grosime fără cotă (18): nicio gaură", () => {
    for (const [th, d] of [[16, 12.7], [19, 14.2]]) {
      const o = build({ hwSel: { conn: "haf_rafix" } }, th).ops(); const cam = joint(o, /eccentrico housing/);
      assert.ok(cam.length > 0); cam.forEach(x => { assert.equal(x.dia, 20); assert.equal(x.depth, d); });
      assert.ok(o.warnings.some(w => w.k === "opsOpenB"), "B nu e în sursă"); assert.ok(o.hw.every(h => h.type !== "minifix"));
    }
    const o18 = build({ hwSel: { conn: "haf_rafix" } }, 18).ops();
    assert.equal(joint(o18, /housing/).length, 0); assert.ok(o18.warnings.some(w => w.k === "opsOpenThick"));
  });
  test("Maxifix: Ø35, adâncime ½·grosime + 6,5 (19 mm → 16), B 35, tijă Ø9", () => {
    const o = build({ hwSel: { conn: "haf_maxifix" } }, 19).ops();
    joint(o, /eccentrico housing/).forEach(x => { assert.equal(x.dia, 35); assert.equal(x.depth, 16); });
    joint(o, /gambo housing/).forEach(x => { assert.equal(x.dia, 9); assert.equal(x.depth, 35); });
  });
  test("TAB 18 (plug-fit): Ø18 în muchia raftului, adâncime 13 (16 mm) / 15 (19 mm), la mijlocul grosimii (A)", () => {
    for (const [th, d] of [[16, 13], [19, 15]]) {
      const o = build({ hwSel: { conn: "haf_tab18_plug" }, shelfType: "fisso" }, th).ops(), h = joint(o, /foro plug/);
      assert.ok(h.length > 0); assert.equal(o.joint, "plug");
      h.forEach(x => { assert.equal(x.dia, 18); assert.equal(x.depth, d); assert.ok(Math.abs(x.z - th / 2) < 0.01); assert.ok(x.face <= 4); });
    }
  });
  test("articole fără date complete (VB 20/21, VB 54, VB 135, Alfa/Beta, Rastex 25, Tofix, TAB 15, OneFix, Turn, RV clip, Knapp): nicio gaură, nicio Minifix în tăcere, avertisment", () => {
    for (const id of ["het_vb20", "het_vb21", "het_vb54_16", "het_vb135", "het_alfa_stop", "het_beta", "het_rastex25", "haf_tofix", "haf_tab15", "haf_onefix", "haf_turn", "haf_rvclip", "kn_duo35_ml", "kn_duo30", "kn_uno30"]) {
      const o = build({ handles: "maniglia", hwSel: { conn: id } }).ops();
      assert.equal(o.joint, "nodrill", id);
      assert.ok(o.hw.every(h => !["minifix", "housing", "plug"].includes(h.type)), id);
      assert.ok(!ops(o, /minifix|housing|plug/).length, id);
      assert.ok(o.warnings.some(w => w.k === "wOpenConnNoDrill"), id);
    }
  });
  test("variantele sunt verificat:false și poartă sursa; kind-urile din HW_DRILL.joints", () => {
    const V = S.HW_DRILL.joints.variants; ["het_rastex15_b24", "haf_rafix", "haf_tab18_plug", "haf_maxifix"].forEach(k => { assert.equal(V[k].verificat, false); assert.ok(V[k].src); });
    ["housing", "plug", "nodrill"].forEach(k => assert.ok(S.HW_DRILL.joints[k]));
    assert.equal(S.JOINT_OF_ID === undefined, true, "JOINT_OF_ID rămâne intern");
  });
});

describe("3D: forma = operațiile (ebanist-hwgeom.js) și instanțele (ebanist-open.js)", () => {
  const G = S.EBHwGeom;
  function shapesFor(o, type) {
    const OPS = G.opsByHw(o.pieces);
    return o.hw.filter(h => h.type === type).flatMap(h => G.connectorShapes(h, OPS[h.id], S.HW_DRILL, { thickF: 19 }).map(s => ({ h, s })));
  }
  test("housing: cilindrul locașului are Ø și adâncimea găurii; tija are Ø găurii − 1,2", () => {
    const o = build({ hwSel: { conn: "het_rastex15_b24" } }).ops(), sh = shapesFor(o, "housing");
    assert.ok(sh.length > 0); const cams = sh.filter(x => x.s.role === "cam"), shanks = sh.filter(x => x.s.role === "shank");
    assert.ok(cams.length > 0 && shanks.length === cams.length);
    cams.forEach(x => assert.ok(Math.abs(x.s.d - 14.7) < 0.01 && x.s.src.length)); shanks.forEach(x => assert.ok(Math.abs(x.s.d - 6.8) < 0.01));
    sh.forEach(x => { const len = Math.hypot(...x.s.a.map((v, i) => v - x.s.b[i])); assert.ok(len > 5 && len < 40, "lungime " + len); });
  });
  test("plug: cilindru Ø18 − 0,4 cât adâncimea găurii", () => {
    const o = build({ hwSel: { conn: "haf_tab18_plug" }, shelfType: "fisso" }, 19).ops(), sh = shapesFor(o, "plug");
    assert.ok(sh.length > 0); sh.forEach(x => { assert.ok(Math.abs(x.s.d - 17.6) < 0.01); assert.ok(Math.abs(Math.hypot(...x.s.a.map((v, i) => v - x.s.b[i])) - 15.2) < 0.1); });
  });
  test("TYPES conține tipurile noi (altfel viewerul nu le desenează)", () => { ["housing", "plug"].forEach(t => assert.ok(G.TYPES.includes(t))); });
  test("push: TIP-ON = cilindru Ø9,6 cât gaura + placă pe spatele ușii; unitate Hettich = cutie 155×60×32 (dimensiunile din sursă)", () => {
    const o = build({ hwSel: { push: "blum_tipon_short" } }).ops(), u = o.hw.filter(h => h.type === "pushunit");
    u.forEach(h => { const sh = O.shapesOf(h); assert.ok(sh.some(s => s.t === "cyl" && Math.abs(s.d - 9.6) < 0.01 && Math.abs(s.a[2] - (h.w[2] - 50)) < 0.01)); assert.ok(sh.some(s => s.role === "plate" && s.t === "box")); sh.forEach(s => assert.ok(s.src.includes(h.id))); });
    const p = build({ doors: 1, L: 600, hwSel: { push: "het_pto_silent_9239087" } }).ops().hw.find(h => h.type === "pushunit"), b = O.shapesOf(p).find(s => s.role === "unit");
    const ext = [0, 1, 2].map(i => Math.round((b.hi[i] - b.lo[i]) * 10) / 10).sort((a, c) => c - a); assert.equal(J(ext), "[155,60,32]");
    const f = build({ doors: 1, L: 600, hwSel: { push: "haf_pushsoft_315_11_401" } }).ops().hw.find(h => h.type === "pushunit"), fb = O.shapesOf(f).find(s => s.role === "unit");
    assert.equal(J([0, 1, 2].map(i => Math.round(fb.hi[i] - fb.lo[i])).sort((a, c) => c - a)), "[202,72,18]");
  });
  test("unitățile stau ÎN corp: Easys în spatele sertarului (între spate și față), unitatea Hettich pe fața interioară a laterala", () => {
    const r = build({ drawers: 3, doors: 0, hwSel: { pushd: "het_easys_9078139" } }), o = r.ops();
    O.shapesOf(o.hw.find(h => h.type === "pushdunit")).forEach(sh => { assert.ok(sh.lo[2] >= 0 && sh.hi[2] <= r.full.P, "z " + sh.lo[2] + ".." + sh.hi[2]); assert.ok(sh.lo[0] >= 0 && sh.hi[0] <= r.full.L); });
    const q = build({ doors: 1, L: 600, hwSel: { push: "het_pto_silent_9239087" } }), u = O.shapesOf(q.ops().hw.find(h => h.type === "pushunit")).find(s => s.role === "unit");
    assert.ok(u.lo[0] >= 19 - 0.01 && u.hi[0] <= 600 - 19 + 0.01, "între laterale: x " + u.lo[0] + ".." + u.hi[0]); assert.ok(u.hi[2] <= q.full.P + 0.01);
  });
  test("sertare și suspendare: primitivele stau în corp (nu mai mari decât corpul) și poartă src", () => {
    const r = build({ drawers: 2, doors: 0, hwSel: { pushd: "het_easys_9078139", susp: "het_sah500", suprail: "het_rail_b" } }), o = r.ops();
    const all = o.hw.filter(h => ["pushdunit", "susphang", "suprail"].includes(h.type)).flatMap(h => O.shapesOf(h));
    assert.ok(all.length >= 4);
    all.forEach(s => { assert.ok(s.src.length === 1); if (s.t === "box") { const sz = [0, 1, 2].map(i => s.hi[i] - s.lo[i]); sz.forEach(v => assert.ok(v > 0 && v < 1000)); } });
  });
});

describe("Ordinea și determinism", () => {
  test("același corp, aceleași instanțe și aceleași id-uri (determinism, D-39)", () => {
    const c = { hwSel: { push: "blum_tipon_short", susp: "het_sah215", conn: "het_rastex15_b24" } };
    assert.equal(J(build(c).ops()), J(build(c).ops()));
  });
  test("id-urile hw sunt unice și operațiile se leagă de o instanță existentă", () => {
    const o = build({ hwSel: { push: "blum_tipon_short", susp: "het_sah215", suprail: "het_rail_b", conn: "het_rastex15_b24" } }).ops();
    const ids = o.hw.map(h => h.id); assert.equal(new Set(ids).size, ids.length);
    o.pieces.forEach(p => p.operations.forEach(x => { if (x.hw) assert.ok(ids.includes(x.hw), x.hw); }));
  });
});
