/* Ebanist — FAZA H.2: potrivirea feroneriei cu corpul curent (ebanist-hwfit.js, pur).
 *
 *   node --test test/hwfit.test.js
 *
 * Ce trebuie să rămână adevărat:
 *  - `check` deleagă la modulele familiilor (EBLiftFit, EBHingesMore, EBCornerFit, EBOpen, EBDrawersMore, EBSliding), nu are limite proprii:
 *    ok=true trece tot ce are date; ok=false pune în `why` mărimea, valoarea și limita citită; ok=null = «necunoscut», niciodată «potrivit»;
 *  - secțiunile: «recomandat» numai când ok===true și nicio limită necesară nu e null; ok===true cu limite necunoscute și ok===null → «potrivit»;
 *  - PARITATE: pentru același articol și același corp, `check` dă aceleași încălcări ca avertismentele Constructorului / ale ops
 *    (liftWarn, opsHinge*, cuWarn, openWarn, drawWarn, slideWarn) — corpul de probă e construit cu motorul real, cu articolul ales;
 *  - textele: aceleași chei în cele 7 limbi, fiecare încălcare se scrie în fiecare limbă fără substituții rămase.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const H = require("./drawers-more.helpers.js");
const E = require("./engine.js");
const APP = path.join(__dirname, "..", "app");
const MM = E.MM;
const S = H.load(true);
["ebanist-advice.js", "ebanist-lift-data.js", "ebanist-liftfit.js", "ebanist-hinges-data.js", "ebanist-hinges.js", "ebanist-hinges-more-data.js", "ebanist-hinges-more-i18n.js", "ebanist-hinges-more.js",
 "ebanist-corner-data.js", "ebanist-cornerfit.js", "ebanist-corner.js", "ebanist-open-data.js", "ebanist-open-i18n.js", "ebanist-open.js",
 "ebanist-sliding-data.js", "ebanist-sliding-i18n.js", "ebanist-sliding.js", "ebanist-ops.js", "ebanist-hwfit.js", "ebanist-hwfit-i18n.js"]
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(APP, f), "utf8"), S, { filename: f }));
const X = S.EBHwFit, LF = S.EBLiftFit, HM = S.EBHingesMore, CF = S.EBCornerFit, OP = S.EBOpen, DM = S.EBDrawersMore, SL = S.EBSliding, I18N = S.HWFIT_I18N;
const A = x => JSON.parse(JSON.stringify(x));
const J = x => JSON.stringify(x);
const clone = A;
const LANGS = ["it", "ro", "en", "fr", "de", "pl", "es"];

/* ca în aplicație (index.html): geometria balamalei alese și densitatea frontului vin din cfg */
S.hingeGeom = cfg => { const id = cfg && cfg.hwSel && cfg.hwSel.cern; return id ? (S.EBHinges.geomOf(id, null) || HM.geomOf(id, null)) : null; };
S.hingeDensity = cfg => { const m = S.matById(cfg.matFront); return S.EBAdvice.DATA.density[S.EBAdvice.famOf(m && m.label)] || 700; };
/* guidaIdFor din index.html (în afara feliilor motorului): openWarnOf îl apelează la sertarele din lemn */
S.guidaIdFor = cfg => { const sys = S.drawSys((cfg && cfg.drawerSys) || "legno"), own = cfg && cfg.hwSel && cfg.hwSel.guida; return (sys.metal && sys.guida) ? sys.guida : own ? own : (((S.state.settings || {}).hwProd || {}).guida || "blum_tandem"); };
const MATS = [MM("__b", 19), MM("__k", 3), MM("pfl5", 5), MM("__b16", 16), MM("__b18", 18), MM("__f30", 30), MM("__f15", 15)];
function settings(guida) { return { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k", matOvr: {}, matAdd: MATS, hwProd: { guida: guida || "blum_tandem" } }; }
const BASE = { name: "B", type: "standard", L: 900, H: 720, P: 560, plinth: 100, tram: 0, shelves: 1, drawers: 0, doors: 2, back: 1, hang: 0, support: "zoccolo", matBody: "__b", matFront: "__b", matBack: "__k", drawerSys: "legno" };
const envOf = cfgRef => ({ matById: S.matById, structTh: S.structTh, drawSys: S.drawSys, guidaIdFor: S.guidaIdFor,
  trial: p => S.buildModule(Object.assign({}, cfgRef.cfg, p)).warn });
function mk(over, guida) {
  S.state.settings = settings(guida);
  const cfg = Object.assign({}, BASE, over), b = S.buildModule(cfg), ref = { cfg };
  const G = S.deriveCarcass(S.carcassParams(cfg, {}));
  const ctx = X.ctxOf(cfg, b, envOf(ref));
  return { cfg, b, ctx, G, ops: () => A(S.generateOperations({ boxes: b.boxes, cfg, G })) };
}
const chk = (cat, id, ctx) => X.check({ id, cat }, ctx);
const sec = r => X.section(r);
const ks = r => Array.from(r.why).map(w => w.k).sort();
const key = (a) => a.slice().sort();

/* corpuri de probă */
const LIGHT = { L: 450, H: 500, P: 330, doors: 1, support: "sospeso", plinth: 0, hang: 1 };            // ușă ușoară și îngustă
const HEAVY = { L: 900, H: 2400, P: 600, doors: 2, support: "zoccolo", plinth: 80 };                      // uși înalte și grele
const DEEP = { L: 900, H: 720, P: 700, doors: 2, support: "zoccolo", plinth: 100 };                       // bază adâncă

describe("Secțiuni și reguli generale", () => {
  test("section(): recomandat numai cu ok===true și fără limite necunoscute; ok===null și limite necunoscute → potrivit; ok===false → nu se potrivește", () => {
    assert.equal(X.section({ ok: true, unknownLimits: false }), "recomandat");
    assert.equal(X.section({ ok: true, unknownLimits: true }), "potrivit");
    assert.equal(X.section({ ok: null, unknownLimits: true }), "potrivit");
    assert.equal(X.section({ ok: false, unknownLimits: false }), "nu_se_potriveste");
    assert.deepEqual(Array.from(X.SECTIONS), ["recomandat", "potrivit", "nu_se_potriveste"]);
  });
  test("o categorie fără limite în date (generic) și un articol necunoscut → ok:null, unknownLimits:true, niciodată recomandat", () => {
    const { ctx } = mk(HEAVY);
    ["gaspist", "man", "pied", "ledstrip", "sup"].forEach(cat => { const r = chk(cat, "x", ctx); assert.equal(r.ok, null); assert.equal(r.unknownLimits, true); assert.equal(sec(r), "potrivit"); assert.equal(r.why.length, 0); });
    assert.equal(chk("lift", "nu_exista", ctx).ok, null);
    assert.equal(chk("cern", "blum_71b3550", ctx).ok, null, "balamalele Blum vechi nu au limite în date");
  });
  test("fără contextul de corp (fx lipsă, ex. alt tip de corp) nimic nu se pretinde: ok:null", () => {
    const { cfg, b } = mk(LIGHT), ctx = X.ctxOf(cfg, { pieces: b.pieces, boxes: b.boxes }, {});
    assert.equal(ctx.fx, false);
    assert.equal(chk("lift", "blum_hk_top", ctx).ok, null);
    assert.equal(chk("cern", "het_9071205", ctx).ok, null);
  });
  test("ctxOf: mărimile vin din ce construiește motorul (ușă, interior, greutate din densitate × arie × grosime)", () => {
    const { ctx, b, G } = mk(HEAVY);
    const d = b.pieces.find(p => p.role === "frontale" && /^Anta/.test(p.elemento));
    assert.equal(ctx.door.h, d.lung); assert.equal(ctx.door.w, d.larg); assert.equal(ctx.door.th, d.sp);
    assert.ok(Math.abs(ctx.door.kg - d.lung * d.larg * d.sp * 700 / 1e9) < 1e-9);
    assert.equal(ctx.int.w, G.L_int); assert.equal(ctx.int.h, G.H_int); assert.equal(ctx.int.d, G.P_int);
    assert.equal(ctx.hung, false);
    assert.ok(mk(LIGHT).ctx.hung);
  });
});

describe("Mecanisme de ridicare (EBLiftFit)", () => {
  test("ușă ușoară pe corp mic: trece, cu date complete → recomandat; rezerva de greutate ordonează (rank)", () => {
    const { ctx } = mk(LIGHT), r = chk("lift", "blum_hk_top", ctx);
    assert.equal(r.ok, true, J(r)); assert.equal(r.unknownLimits, false); assert.equal(sec(r), "recomandat");
    const r2 = chk("lift", "blum_hk_xs", ctx);                  // cabW/kg necitite în date → potrivit, nu recomandat
    assert.notEqual(sec(r2), "nu_se_potriveste");
  });
  test("ușă înaltă și grea: depășirea se vede cu valoarea și limita exactă din date", () => {
    const { ctx } = mk(HEAVY), L = LF.get("blum_hk_top").limits, r = chk("lift", "blum_hk_top", ctx);
    assert.equal(r.ok, false); assert.equal(sec(r), "nu_se_potriveste");
    const kh = r.why.find(w => w.k === "kh"); assert.ok(kh, J(r.why));
    assert.deepEqual([kh.v, kh.lo, kh.hi], [ctx.int.h, L.cabH[0], L.cabH[1]]);
    assert.ok(ks(r).includes("power"), "nicio variantă de forță");
  });
  test("limite necitite: Häfele Free flap 17 are cabW null → trece dar rămâne «potrivit» (limite necunoscute)", () => {
    const { ctx } = mk(LIGHT), r = chk("lift", "haf_free_flap_17", ctx);
    assert.ok(!LF.get("haf_free_flap_17").limits.cabW[0] && !LF.get("haf_free_flap_17").limits.cabW[1]);
    if (r.ok === true) { assert.equal(r.unknownLimits, true); assert.equal(sec(r), "potrivit"); } else assert.equal(r.ok, false);
  });
  test("front de sticlă / pliant / în pantă: mecanismul nu se aplică (ca liftWarn front)", () => {
    const { ctx } = mk(Object.assign({}, LIGHT, { front: "vetro" })), r = chk("lift", "blum_hk_top", ctx);
    assert.equal(r.ok, false); assert.ok(ks(r).includes("front"));
  });
});

describe("Balamale (EBHingesMore)", () => {
  const fam = k => HM.family(k);
  test("ușă normală pe Hettich Sensys 8645i: trece, date complete (grosime + grafic) → recomandat", () => {
    const id = fam("het_8645i").parts[0].id, r = chk("cern", id, mk({ L: 600, H: 720, doors: 1 }).ctx);
    assert.equal(r.ok, true, J(r)); assert.equal(sec(r), "recomandat");
  });
  test("grosime în afara intervalului: why are limita din familie (sticlă 4–6.5 mm vs ușă de 19 mm)", () => {
    const id = HM.list().flatMap(f => f.parts).find(p => /het_0072960/.test(p.id)).id, { ctx } = mk({ L: 600, H: 720, doors: 1 }), r = chk("cern", id, ctx);
    const T = HM.familyOfHw(id).doorTh, w = r.why.find(x => x.k === "th");
    assert.equal(r.ok, false); assert.deepEqual([w.v, w.lo, w.hi], [ctx.door.th, T[0], T[1]]);
  });
  test("ușă înaltă: înălțimea peste ultimul rând al graficului și greutatea peste limita rândului se spun cu limita citită", () => {
    const id = "sal_CEL6DE9XXI", F = HM.familyOfHw(id), { ctx } = mk({ L: 900, H: F.airMax.h + 200, doors: 1, support: "pavimento", plinth: 0, hang: 0 }), r = chk("cern", id, ctx);
    assert.equal(r.ok, false);
    const h = r.why.find(w => w.k === "h"), w = r.why.find(x => x.k === "w");
    assert.equal(h.hi, F.airMax.h); assert.ok(h.v > F.airMax.h); assert.equal(w.hi, F.airMax.w); assert.ok(w.v > F.airMax.w);
    assert.ok(r.why.some(x => x.k === "kg" && x.hi === F.airMax.kg), "greutatea peste limita Air");
  });
  test("fără grafic (limite necunoscute): familia fără rânduri nu e niciodată «recomandat»", () => {
    const f = HM.list().find(x => !(x.count && x.count.rows && x.count.rows.length) && !x.airMax), id = f.parts[0].id;
    const r = chk("cern", id, mk({ L: 600, H: 720, doors: 1 }).ctx);
    assert.notEqual(sec(r), "recomandat"); assert.equal(r.unknownLimits, true);
  });
  test("rank = numărul de balamale cerut de grafic (mai puține = mai bine)", () => {
    const { ctx } = mk({ L: 600, H: 1900, doors: 1, support: "zoccolo" }), id = fam("het_8645i").parts[0].id, r = chk("cern", id, ctx);
    assert.equal(r.rank, HM.count(id, ctx.door.h, ctx.door.kg));
  });
});

describe("Colț, extractibile (EBCornerFit)", () => {
  test("corp de bază adânc: unitățile cu limite se verifică; încălcările au valoarea și intervalul din date", () => {
    const { ctx } = mk(DEEP), u = CF.get("blum_space_corner"), r = chk("corner", "blum_space_corner", ctx);
    const ft = CF.fit(u, ctx.corner.d, {});
    assert.deepEqual(r.why.map(w => [w.k, w.v, w.lo, w.hi]), ft.issues.map(i => [i.k, i.v, i.lo, i.hi]));
  });
  test("o unitate pentru corp înalt pe un corp de bază: încălcare «body» (tipul corpului, din date)", () => {
    const { ctx } = mk(DEEP), tall = CF.list().find(u => u.body === "tall"), r = chk("corner", tall.key, ctx);
    assert.equal(r.ok, false); assert.ok(ks(r).includes("body"));
  });
  test("corp cu cote absolute: unitatea nu se aplică (EBCorner.supported)", () => {
    const { ctx } = mk(Object.assign({}, DEEP, { topProfile: { h0: 720, h1: 650, axis: "x" } })), r = chk("corner", "blum_space_corner", ctx);
    assert.equal(ctx.corner.supported, false); assert.ok(ks(r).includes("unsupported"));
  });
  test("o unitate fără limite de lățime/înălțime/adâncime în date nu devine «recomandată»", () => {
    const { ctx } = mk(DEEP), u = CF.list().find(x => !Object.keys(x.limits || {}).length && x.body === "base"), r = chk("corner", u.key, ctx);
    assert.notEqual(sec(r), "recomandat");
  });
});

describe("Deschidere, sertare push, suspendare, șine, îmbinări (EBOpen)", () => {
  test("push (TIP-ON): ușa peste limita de înălțime din date → încălcare cu limita; ușa mică trece", () => {
    const it = OP.get("blum_tipon_short"), hi = it.lim.h[1];
    const tall = mk(Object.assign({}, HEAVY, { handles: "push" })).ctx, r = chk("push", "blum_tipon_short", tall);
    assert.equal(r.ok, false); const w = r.why.find(x => x.k === "h"); assert.equal(w.hi, hi); assert.ok(w.v > hi);
    const small = mk({ L: 600, H: 720, doors: 1 }).ctx, r2 = chk("push", "blum_tipon_short", small);
    assert.equal(r2.ok, true, J(r2)); assert.equal(r2.unknownLimits, true, "kg necunoscut în date → potrivit, nu recomandat"); assert.equal(sec(r2), "potrivit");
  });
  test("sertare push: fără sertare nu se știe (null); cu sertare, sistemul și NL din date", () => {
    assert.equal(chk("pushd", "blum_tobm_lbx_s0", mk(DEEP).ctx).ok, null);
    const { ctx } = mk(Object.assign({}, DEEP, { drawers: 3, doors: 0, drawerSys: "tandembox" })), r = chk("pushd", "blum_tobm_lbx_s0", ctx);
    assert.equal(r.ok, false); assert.ok(ks(r).includes("pushdSys"));
  });
  test("suspendare: corp greu peste portanța din date → încălcare «load» cu kg și portanța; corp neagățat → «notHung»", () => {
    const { ctx } = mk(Object.assign({}, HEAVY, { support: "sospeso", plinth: 0, hang: 1 })), weak = OP.all("susp").filter(it => { const c = OP.suspCap(it, { H: 2400, T: 600 }); return c && c.kg < ctx.bodyKg; });
    assert.ok(weak.length > 0, "trebuie să existe o suspendare mai slabă decât corpul (" + ctx.bodyKg + " kg)");
    const it = weak[0], r = chk("susp", it.id, ctx), cap = OP.suspCap(it, { H: 2400, T: 600 });
    assert.equal(r.ok, false);
    const w = r.why.find(x => x.k === "load"); assert.ok(w); assert.equal(w.hi, Math.round(cap.kg * 10) / 10); assert.equal(w.v, Math.round(ctx.bodyKg * 10) / 10);
    assert.ok(ks(chk("susp", it.id, mk(DEEP).ctx)).includes("notHung"));
  });
  test("șină de suspendare: portanța din date; îmbinare: grosimea panoului față de intervalul din date", () => {
    const { ctx } = mk(HEAVY), rl = OP.all("suprail")[0], r = chk("suprail", rl.id, ctx), cap = OP.railCap(rl);
    if (cap != null) assert.equal(r.ok, ctx.bodyKg > cap ? false : true);
    const cn = OP.all("conn").find(c => c.T), thin = mk(Object.assign({}, DEEP, { matBody: "__b" })).ctx, rr = chk("conn", cn.id, thin);
    assert.equal(rr.ok, thin.sideT >= cn.T[0] && thin.sideT <= cn.T[1]);
    if (rr.ok === false) assert.deepEqual([rr.why[0].v, rr.why[0].lo, rr.why[0].hi], [thin.sideT, cn.T[0], cn.T[1]]);
  });
  test("articol din HWDB.conn fără date EBOpen (generic) → ok:null", () => { assert.equal(chk("conn", "haf_minifix", mk(DEEP).ctx).ok, null); });
});

describe("Sertare din date (EBDrawersMore)", () => {
  test("sistem cu NL minim peste adâncimea utilă: încălcare «depth» cu minimul din date; corp adânc trece", () => {
    const shallow = mk({ L: 600, H: 720, P: 270, doors: 0, drawers: 2 }).ctx, r = chk("zarga", "het_avantech_zarga", shallow);
    const sys = DM.drawsys().het_avantech;
    assert.equal(r.ok, false); const d = r.why.find(w => w.k === "depth"); assert.equal(d.lo, sys.nl[0]);
    const deep = mk({ L: 600, H: 720, P: 560, doors: 0, drawers: 2 }).ctx, r2 = chk("zarga", "het_avantech_zarga", deep);
    assert.equal(r2.ok, true, J(r2));
  });
  test("grosimea laterală fără rând în tabelul sursei (ArciTech cere EB 20/23 etc.): încălcare «dims», nu o valoare ghicită", () => {
    const D = S.EBDrawersMoreData, bx = D.boxes.find(b => b.selectable && b.baseW && b.baseW.byT), thick = Object.keys(bx.baseW.byT).map(Number);
    const miss = [16, 18, 19, 22, 25].find(t => !thick.includes(t));
    if (miss == null) return;
    const mat = { 16: "__b16", 18: "__b18" }[miss]; if (!mat) return;
    const r = chk("zarga", bx.side, mk({ L: 600, H: 720, P: 560, doors: 0, drawers: 2, matBody: mat, matFront: mat }).ctx);
    assert.ok(ks(r).includes("dims"));
  });
  test("glisieră pentru lemn: fără deducție în sursă (Actro YOU) → necunoscut, nu «potrivit»; cu date (Dynapro) se verifică adâncimea", () => {
    const { ctx } = mk({ L: 600, H: 720, P: 560, doors: 0, drawers: 2 });
    const r0 = chk("guida", "het_actro_you", ctx); assert.equal(r0.ok, null); assert.equal(sec(r0), "potrivit");
    const r1 = chk("guida", "gr_dynapro", ctx); assert.notEqual(r1.ok, null);
    const sh = mk({ L: 600, H: 720, P: 250, doors: 0, drawers: 2 }).ctx, r2 = chk("guida", "gr_dynapro", sh);
    assert.equal(r2.ok, false); assert.equal(r2.why.find(w => w.k === "depth").lo, DM.runner("gr_dynapro").nl[0]);
  });
  test("glisiere legacy (Blum Tandem etc.) și sisteme fără date: ok:null", () => {
    const { ctx } = mk({ L: 600, H: 720, P: 560, doors: 0, drawers: 2 });
    assert.equal(chk("guida", "blum_tandem", ctx).ok, null); assert.equal(chk("zarga", "blum_lbx_pure", ctx).ok, null);
  });
});

describe("Sisteme de sertar din formular (drawsys): toate sistemele din DRAWSYS au verificare", () => {
  const IDS = Array.from(vm.runInContext("DRAWSYS_IDS", S));
  test("fiecare sistem din DRAWSYS dă un rezultat; cele fără limite în date (vechi) sunt ok:null → «potrivit», niciodată «recomandat»", () => {
    const { ctx } = mk({ L: 900, H: 720, P: 560, doors: 0, drawers: 3 });
    assert.ok(IDS.length >= 10);
    IDS.forEach(id => {
      const r = chk("drawsys", id, ctx), withData = !!(S.EBDrawersMoreData.sides || []).find(x => x.box === id);
      assert.ok(r && typeof r === "object", id);
      if (!withData) { assert.equal(r.ok, null, id); assert.equal(sec(r), "potrivit", id); assert.equal(r.unknownLimits, true, id); }
      else assert.notEqual(r.ok, null, id);
    });
    ["legno", "legrabox", "tandembox", "matrix", "nessuno"].forEach(id => assert.equal(chk("drawsys", id, ctx).ok, null, id));
  });
  test("sistem din date pe un corp prea puțin adânc: nu se potrivește, cu «depth» și NL minim din date", () => {
    const { ctx } = mk({ L: 900, H: 720, P: 270, doors: 0, drawers: 3 }), id = IDS.find(i => (S.EBDrawersMoreData.sides || []).some(x => x.box === i));
    const r = chk("drawsys", id, ctx); assert.equal(r.ok, false); assert.equal(sec(r), "nu_se_potriveste"); assert.ok(ks(r).includes("depth"));
  });
});

describe("Uși glisante / escamotabile / cu aripă (EBSliding)", () => {
  const codeOf = sysName => SL.list().filter(s => s.name === sysName).length && S.EBSlidingData.codes.find(c => c.sys.length === 1 && c.sys[0] === sysName);
  const SLD = { type: "scorrevole", L: 2400, H: 2400, P: 600, doors: 2, shelves: 0, hang: 0 };
  const POC = { type: "standard", L: 600, H: 2000, P: 600, doors: 1, shelves: 0, hang: 0, support: "zoccolo", plinth: 80 };
  test("sistem de uși glisante pe corp standard: nu se aplică (tipul corpului, regula EBSliding.typeOk)", () => {
    const sys = SL.list().find(s => s.kind === "slide" && codeOf(s.name)), code = codeOf(sys.name), r = chk("slide", SL.codeId(code.code), mk(POC).ctx);
    assert.equal(r.ok, false); assert.equal(r.why[0].k, "type"); assert.equal(r.why[0].have, "standard");
  });
  test("pe corpul «scorrevole» sistemul se evaluează prin planul lui (limitele kg/h/w/th din date); încălcarea poartă limita", () => {
    const ctx = mk(SLD).ctx;
    let hit = 0;
    SL.list().filter(s => s.kind === "slide" && codeOf(s.name)).forEach(s => {
      const r = chk("slide", SL.codeId(codeOf(s.name).code), ctx);
      r.why.filter(w => ["kg", "h", "w", "th", "ratio"].includes(w.k)).forEach(w => { hit++; assert.ok(w.hi != null || w.lo != null); });
    });
    assert.ok(hit > 0, "măcar un sistem trebuie să iasă din limite pe o ușă de 2400 mm");
  });
  test("un cod care servește mai multe sisteme: trece dacă măcar un sistem trece", () => {
    const ctx = mk(POC).ctx, multi = S.EBSlidingData.codes.find(c => c.sys.length > 1);
    if (!multi) return;
    const r = chk("slide", SL.codeId(multi.code), ctx), each = multi.sys.map(n => SL.list().find(s => s.name === n)).filter(Boolean);
    if (each.some(s => SL.typeOk(s, "standard"))) assert.notEqual(r.why[0] && r.why[0].k, "type");
  });
});

/* ================================================================ H.5 — recomandări pe corpuri construite */
["ebanist-hwui.js", "ebanist-hwui-i18n.js"].forEach(f => vm.runInContext(fs.readFileSync(path.join(APP, f), "utf8"), S, { filename: f }));
const U = S.EBHwUI, WI18N = S.HWUI_I18N;
describe("Recomandări (H.5): ordinea din «Recomandate» și sugestia, pe corpuri construite cu motorul real", () => {
  const sect = (cat, ids, ctx) => U.buildSections(ids.map(id => ({ id, cat })), e => X.check(e, ctx), X.section, false);
  const inv = (cat, ids, ctx) => { const s0 = sect(cat, ids, ctx); [...s0.recomandat].forEach(x => { assert.equal(x.r.ok, true); assert.equal(x.r.unknownLimits, false, "recomandat cu limite necunoscute: " + x.e.id); });
    const ord = s0.recomandat.map(x => U.ordOf(x.r)); for (let i = 1; i < ord.length; i++) assert.ok(ord[i] >= ord[i - 1], "ordine " + cat + ": " + J(ord)); return s0; };
  const parts = HM.list().flatMap(f => f.parts.map(p => p.id));
  test("balamale: «Recomandate» ordonate după numărul cerut de grafic (cele mai puține întâi); rank = HM.count; info = n, greutatea ușii, limita rândului din date", () => {
    const { ctx } = mk({ L: 600, H: 1900, doors: 1, support: "zoccolo" }), s0 = inv("cern", parts, ctx);
    assert.ok(s0.recomandat.length > 3, "trebuie să existe balamale recomandate: " + s0.recomandat.length);
    const first = s0.recomandat[0], last = s0.recomandat[s0.recomandat.length - 1];
    assert.ok(first.r.rank <= last.r.rank);
    s0.recomandat.forEach(x => { const n = HM.count(x.e.id, ctx.door.h, ctx.door.kg); assert.equal(x.r.rank, n == null ? 0 : n); assert.equal(x.r.info == null ? null : x.r.info.n == null ? null : x.r.info.n, n == null ? null : n); });
    const wr = s0.recomandat.find(x => x.r.info && x.r.info.n != null); assert.ok(wr, "măcar o balama cu grafic de numărare");
    assert.equal(wr.r.info.kg, Math.round(ctx.door.kg * 10) / 10);
    const rows = HM.familyOfHw(wr.e.id).count.rows, rw = rows.find(x => x.n === wr.r.info.n);
    if (rw && rw.kg && rw.kg[1] != null) assert.equal(wr.r.info.cap, rw.kg[1]);
    assert.ok(/\d/.test(U.reasonOf(wr.r, k => WI18N.en[k], "en")));
    const g = U.suggestFor(parts.map(id => ({ id, cat: "cern" })), e => X.check(e, ctx), X.section); assert.equal(g.e.id, s0.recomandat[0].e.id);
  });
  test("balamale: ușă înaltă și grea → se cer mai multe balamale (rank-urile cresc), iar «Recomandate» nu cresc", () => {
    const a = sect("cern", parts, mk({ L: 600, H: 900, doors: 1 }).ctx), b = sect("cern", parts, mk({ L: 600, H: 2300, doors: 1, support: "zoccolo" }).ctx);
    const sum = s0 => s0.recomandat.reduce((t, x) => t + x.r.rank, 0);
    assert.ok(sum(b) > sum(a), sum(a) + " → " + sum(b)); assert.ok(b.recomandat.length <= a.recomandat.length);
  });
  test("ridicare: «Recomandate» ordonate după rezerva de greutate până la limita citită; info are forța variantei și limita kg din date", () => {
    const { ctx } = mk(LIGHT), s0 = inv("lift", LF.list().map(x => x.key), ctx);
    assert.ok(s0.recomandat.length >= 1);
    s0.recomandat.forEach(x => { const L = LF.get(x.e.id).limits; assert.equal(x.r.rank, Math.max(0, Math.round((L.kg[1] - ctx.door.kg) * 10) / 10)); assert.equal(x.r.info.cap, L.kg[1]); assert.ok(x.r.info.power); });
  });
  test("suspendare: cea MAI MARE rezervă de sarcină întâi (inversul celorlalte familii); limita vine din date", () => {
    const { ctx } = mk(Object.assign({}, DEEP, { support: "sospeso", plinth: 0, hang: 1 })), s0 = inv("susp", OP.all("susp").map(x => x.id), ctx);
    if (s0.recomandat.length >= 2) { const m = s0.recomandat.map(x => x.r.rank); assert.ok(m[0] >= m[m.length - 1], J(m)); }
    s0.recomandat.forEach(x => { assert.equal(x.r.fam, "susp"); assert.ok(x.r.info.cap > x.r.info.kg); assert.equal(Math.round((x.r.info.cap - x.r.info.kg) * 10) / 10, x.r.rank); });
    if (s0.recomandat.length) assert.equal(U.suggestFor(OP.all("susp").map(x => ({ id: x.id, cat: "susp" })), e => X.check(e, ctx), X.section).e.id, s0.recomandat[0].e.id);
  });
  test("sertare: sistemul al cărui NL încape cu cea mai mică pierdere de adâncime primul; info = NL și adâncimea utilă", () => {
    const deepCtx = mk({ L: 900, H: 720, P: 560, doors: 0, drawers: 3 }).ctx, ids = Array.from(vm.runInContext("DRAWSYS_IDS", S)), s0 = inv("drawsys", ids, deepCtx);
    assert.ok(s0.recomandat.length >= 2);
    s0.recomandat.forEach(x => { assert.ok(x.r.info.nl <= x.r.info.usable); assert.equal(Math.round((x.r.info.usable - x.r.info.nl) * 10) / 10, x.r.rank); });
    assert.ok(/NL \d+ mm/.test(U.reasonOf(s0.recomandat[0].r, k => WI18N.en[k], "en")));
    ["legno", "legrabox", "tandembox", "matrix", "nessuno"].forEach(id => assert.ok(!s0.recomandat.some(x => x.e.id === id), id));
  });
  test("uși glisante: pe corpul «scorrevole» niciun sistem cu limite necunoscute nu e «Recomandat»; ordinea e nedescrescătoare", () => {
    const ctx = mk({ type: "scorrevole", L: 2400, H: 2400, P: 600, doors: 2, shelves: 0, hang: 0 }).ctx;
    inv("slidesys", SL.list().filter(x => SL.typeOk(x, "scorrevole")).map(x => x.key), ctx);
  });
  test("«necunoscut» nu se sugerează: balamalele Blum vechi (fără limite în date) → nicio sugestie; corp fără uși → nicio sugestie la balamale", () => {
    const { ctx } = mk({ L: 600, H: 1900, doors: 1, support: "zoccolo" });
    assert.equal(U.suggestFor([{ id: "blum_71b3550", cat: "cern" }, { id: "blum_71t3550", cat: "cern" }], e => X.check(e, ctx), X.section), null);
    const none = mk({ L: 600, H: 720, doors: 0, drawers: 0 }).ctx;
    assert.equal(U.suggestFor(parts.map(id => ({ id, cat: "cern" })), e => X.check(e, none), X.section), null);
  });
  test("sugestia = primul din «Recomandate» (aceeași ordine ca în foaie), pentru fiecare familie cu recomandate", () => {
    const { ctx } = mk(LIGHT);
    [["lift", LF.list().map(x => x.key)], ["cern", parts]].forEach(([cat, ids]) => { const s0 = sect(cat, ids, ctx), g = U.suggestFor(ids.map(id => ({ id, cat })), e => X.check(e, ctx), X.section);
      if (s0.recomandat.length) assert.equal(g.e.id, s0.recomandat[0].e.id, cat); else assert.equal(g, null, cat); });
  });
});

describe("Texte: 7 limbi, aceleași chei, fără substituții rămase", () => {
  test("aceleași chei în toate limbile; toate nevide", () => {
    assert.deepEqual(Object.keys(I18N).sort(), LANGS.slice().sort());
    const k0 = Object.keys(I18N.ro).sort();
    LANGS.forEach(l => { assert.deepEqual(Object.keys(I18N[l]).sort(), k0, l); k0.forEach(k => assert.ok(I18N[l][k] && I18N[l][k].length > 2, l + " " + k)); });
    const ph = s => (s.match(/\{\w+\}/g) || []).sort().join();
    k0.forEach(k => LANGS.forEach(l => assert.equal(ph(I18N[l][k]), ph(I18N.ro[k]), l + " " + k)));
  });
  test("msg(): fiecare încălcare produsă pe corpuri reale se scrie în fiecare limbă, fără {…} rămase și fără chei goale", () => {
    const bodies = [mk(HEAVY).ctx, mk(LIGHT).ctx, mk(DEEP).ctx, mk(Object.assign({}, DEEP, { drawers: 3, doors: 0, drawerSys: "tandembox" })).ctx];
    const seen = new Set(); let n = 0;
    bodies.forEach(ctx => {
      const ents = [["lift", LF.list().map(x => x.key)], ["cern", HM.list().flatMap(f => f.parts.map(p => p.id)).slice(0, 80)], ["corner", CF.list().map(x => x.key)],
        ["push", OP.all("push").map(x => x.id)], ["pushd", OP.all("pushd").map(x => x.id)], ["susp", OP.all("susp").map(x => x.id)], ["suprail", OP.all("suprail").map(x => x.id)], ["conn", OP.all("conn").map(x => x.id)],
        ["zarga", S.EBDrawersMoreData.sides.map(x => x.key)], ["guida", S.EBDrawersMoreData.runners.map(x => x.key)], ["slide", S.EBSlidingData.codes.slice(0, 120).map(c => SL.codeId(c.code))]];
      ents.forEach(([cat, ids]) => ids.forEach(id => {
        const r = chk(cat, id, ctx); r.why.forEach(w => {
          LANGS.forEach(l => { const t = k => I18N[l][k] || (S.SLIDE_I18N[l] && S.SLIDE_I18N[l][k]) || k, m = X.msg([w], t)[0];
            assert.ok(m && !/\{\w+\}/.test(m) && !/^hf[QV]_/.test(m) && !/hfQ_|hfV_/.test(m), l + " " + J(w) + " → " + m); });
          seen.add(w.k); n++;
        });
      }));
    });
    assert.ok(n > 200 && seen.size >= 15, n + " încălcări, " + seen.size + " feluri: " + [...seen].join());
  });
});

/* ================================================================ PARITATE */
/* încălcările Constructorului (avertismente) în forma `why`: {k, v, lo, hi} — numai limitele, nu și indicațiile */
const dash = x => (x === "—" || x == null) ? null : x;
const norm = a => { const m = Array.from(a).map(o => [o.k, o.v == null ? null : Math.round(o.v * 100) / 100, dash(o.lo), dash(o.hi)]).sort((p, q) => J(p) < J(q) ? -1 : 1); return m.filter((x, i) => i === 0 || J(x) !== J(m[i - 1])); };   // o ușă dublă dă același avertisment o dată pe piesă
const normWhy = why => norm(why);

describe("PARITATE: check == avertismentele Constructorului pentru același articol", () => {
  const BODIES = { light: LIGHT, heavy: HEAVY, mid: { L: 900, H: 700, P: 330, doors: 1, support: "sospeso", plinth: 0, hang: 1 }, wide: { L: 1200, H: 900, P: 400, doors: 2, support: "sospeso", plinth: 0, hang: 1 } };

  test("ridicare: pentru toate cele 18 sisteme × 4 corpuri, încălcările și «power» coincid cu liftWarn", () => {
    let n = 0, viol = 0;
    Object.entries(BODIES).forEach(([nm, o]) => {
      const base = mk(o);
      LF.list().forEach(sys => {
        const cand = mk(Object.assign({ lift: sys.key }, o)), lw = cand.b.warn.liftWarn || [];
        const exp = lw.filter(w => w.k === "range").map(w => ({ k: w.what, v: w.v, lo: w.lo, hi: w.hi })), r = chk("lift", sys.key, base.ctx);
        const got = r.why.filter(w => !["power", "front"].includes(w.k));
        assert.deepEqual(normWhy(got), norm(exp), nm + " " + sys.key);
        assert.equal(r.why.some(w => w.k === "power"), lw.some(w => w.k === "power"), nm + " " + sys.key + " power");
        assert.equal(r.ok === false, exp.length > 0 || lw.some(w => w.k === "power"), nm + " " + sys.key);
        n++; if (r.ok === false) viol++;
      });
    });
    assert.equal(n, 72); assert.ok(viol > 5 && viol < n, "trebuie să existe și trecute și căzute: " + viol);
  });
  test("ridicare cu front de sticlă: liftWarn «front» ↔ încălcarea «front»", () => {
    const o = Object.assign({}, LIGHT, { front: "vetro" }), base = mk(o), cand = mk(Object.assign({ lift: "blum_hk_top" }, o));
    assert.ok(cand.b.warn.liftWarn.some(w => w.k === "front")); assert.ok(chk("lift", "blum_hk_top", base.ctx).why.some(w => w.k === "front"));
  });

  test("balamale: pentru fiecare familie (primul și ultimul articol) × 4 corpuri (+ uși groase/subțiri), opsHinge{Th,H,W,Kg} coincid cu why", () => {
    let n = 0, viol = 0; const seen = new Set();
    const ids = HM.list().flatMap(f => [f.parts[0].id, f.parts[f.parts.length - 1].id]);
    const bodies = Object.assign({}, BODIES, { airTall: { L: 900, H: 2650, P: 560, doors: 1, support: "pavimento", plinth: 0, hang: 0 }, airHigh: { L: 900, H: 2900, P: 560, doors: 1, support: "pavimento", plinth: 0, hang: 0 }, thick: { L: 600, H: 720, doors: 1, matFront: "__f30" }, thin: { L: 600, H: 720, doors: 1, matFront: "__f15" } });
    Object.entries(bodies).forEach(([nm, o]) => {
      const base = mk(o);
      ids.forEach(id => {
        const cand = mk(Object.assign({}, o, { hwSel: { cern: id } })), w = cand.ops().warnings.filter(x => /^opsHinge(Th|H|W|Kg)$/.test(x.k));
        const exp = w.map(x => ({ k: { opsHingeTh: "th", opsHingeH: "h", opsHingeW: "w", opsHingeKg: "kg" }[x.k], v: x.v, lo: x.lo, hi: x.hi, n: x.n }));
        const r = chk("cern", id, base.ctx);
        assert.deepEqual(normWhy(r.why), norm(exp), nm + " " + id);
        r.why.forEach(w => seen.add(w.k)); n++; if (r.ok === false) viol++;
      });
    });
    assert.ok(n >= 78 * 6 - 0 && viol > 20, n + " " + viol);
    ["th", "h", "w", "kg"].forEach(k => assert.ok(seen.has(k), "corpurile de probă trebuie să exercite încălcarea «" + k + "»: " + [...seen]));
  });

  test("colț: toate cele 57 de unități × 3 corpuri, încălcările coincid cu cuWarn range (aceleași v/lo/hi)", () => {
    let n = 0, viol = 0;
    const bodies = { base: { L: 600, H: 720, P: 560, doors: 1, support: "zoccolo", plinth: 100 }, wide: { L: 900, H: 720, P: 600, doors: 1, support: "zoccolo", plinth: 100 },
      tall: { L: 600, H: 2000, P: 600, doors: 1, support: "zoccolo", plinth: 80 }, wall: { L: 600, H: 720, P: 330, doors: 1, support: "sospeso", plinth: 0, hang: 1 } };
    Object.entries(bodies).forEach(([nm, o]) => {
      const base = mk(o);
      CF.list().forEach(u => {
        const cand = mk(Object.assign({}, o, { cu: u.key })), cw = (cand.b.warn && cand.b.warn.cuWarn) || [];
        const exp = cw.filter(w => w.k === "range").map(w => ({ k: w.what, v: w.v, lo: w.lo, hi: w.hi })), r = chk("corner", u.key, base.ctx);
        assert.deepEqual(normWhy(r.why), norm(exp), nm + " " + u.key);
        n++; if (r.ok === false) viol++;
      });
    });
    assert.equal(n, 57 * 4); assert.ok(viol > 40 && viol < n);
  });

  /* EBOpen: limitele din warnBody (fără indicațiile noHandle / gapMin / suspRails / noKg) */
  const openExp = (cand) => ((cand.b.warn && cand.b.warn.openWarn) || []).filter(w => !["noHandle", "gapMin", "suspRails", "noKg"].includes(w.k))
    .map(w => w.k === "range" ? { k: w.what, v: w.v, lo: w.lo, hi: w.hi } : w.k === "load" ? { k: "load", v: w.kg, hi: w.cap } : w.k === "rail" ? { k: "rail", v: w.kg, hi: w.cap }
      : w.k === "sizes" ? { k: "sizes", v: w.kg } : w.k === "extraCatch" ? { k: "extraCatch", v: 0, hi: w.h } : (w.k === "pushdSys" || w.k === "liftOnly" || w.k === "notLift" || w.k === "notHung") ? { k: w.k, v: 0 }
      : w.k === "sideT" ? { k: "sideT", v: w.v, lo: w.lo } : { k: w.k, v: w.v, lo: w.lo, hi: w.hi });
  test("push (uși): toate articolele EBOpen × 3 corpuri coincid cu openWarn", () => {
    let n = 0, viol = 0;
    Object.entries({ small: { L: 600, H: 720, doors: 1 }, heavy: HEAVY, wide: BODIES.wide }).forEach(([nm, o]) => {
      const o2 = Object.assign({ handles: "push" }, o), base = mk(o2);
      OP.all("push").forEach(it => {
        const cand = mk(Object.assign({}, o2, { hwSel: { push: it.id } })), r = chk("push", it.id, base.ctx);
        assert.deepEqual(normWhy(r.why), norm(openExp(cand)), nm + " " + it.id); n++; if (r.ok === false) viol++;
      });
    });
    assert.ok(n === 3 * OP.all("push").length && viol > 0);
  });
  test("sertare push: articolele EBOpen pushd × sisteme de sertar coincid cu openWarn", () => {
    let n = 0, viol = 0;
    ["legrabox", "tandembox", "legno"].forEach(sysId => {
      const o = { L: 600, H: 720, P: 560, doors: 0, drawers: 3, drawerSys: sysId, handles: "push" }, base = mk(o);
      OP.all("pushd").forEach(it => {
        const cand = mk(Object.assign({}, o, { hwSel: { pushd: it.id } })), r = chk("pushd", it.id, base.ctx);
        assert.deepEqual(normWhy(r.why), norm(openExp(cand)), sysId + " " + it.id); n++; if (r.ok === false) viol++;
      });
    });
    assert.ok(n === 3 * OP.all("pushd").length && viol > 0);
  });
  test("suspendare: toate cele 23 de articole × 3 corpuri (agățat ușor, agățat greu, pe soclu) coincid cu openWarn", () => {
    let n = 0, viol = 0;
    Object.entries({ light: LIGHT, heavy: Object.assign({}, HEAVY, { support: "sospeso", plinth: 0, hang: 1 }), floor: DEEP }).forEach(([nm, o]) => {
      const base = mk(o);
      OP.all("susp").forEach(it => {
        const cand = mk(Object.assign({}, o, { hwSel: { susp: it.id } })), r = chk("susp", it.id, base.ctx);
        assert.deepEqual(normWhy(r.why), norm(openExp(cand)), nm + " " + it.id); n++; if (r.ok === false) viol++;
      });
    });
    assert.ok(n === 3 * OP.all("susp").length && viol > 0);
  });
  test("îmbinări: toate articolele conn din EBOpen × corpuri cu grosimi 16/18/19 coincid cu openWarn (connT)", () => {
    let n = 0, viol = 0;
    [["__b16", 16], ["__b18", 18], ["__b", 19]].forEach(([m]) => {
      const o = Object.assign({}, DEEP, { matBody: m, matFront: m }), base = mk(o);
      OP.all("conn").forEach(it => {
        const cand = mk(Object.assign({}, o, { hwSel: { conn: it.id } })), r = chk("conn", it.id, base.ctx);
        assert.deepEqual(normWhy(r.why), norm(openExp(cand)), m + " " + it.id); n++; if (r.ok === false) viol++;
      });
    });
    assert.ok(n > 60 && viol > 0);
  });

  /* sertare: warn-urile drawerPlan, mapate pe cheile why */
  const drawExp = cand => Array.from((cand.b.warn && cand.b.warn.drawWarn) || []).map(w => ({ wDrawDeep: "depth", wDrawMoreKD: "dims", wDrawMoreMinW: "minW", wDrawFront: "drFront", wDrawMoreSideTh: "sideTh", wDrawMoreMinBox: "minBox" }[w.k]))
    .filter(Boolean).sort();
  test("sisteme de sertar (Hettich AvanTech/ArciTech, Grass NPS/V8/V13) × adâncimi × grosimi laterale: cheile încălcărilor coincid cu drawWarn", () => {
    let n = 0, viol = 0;
    const D = S.EBDrawersMoreData, boxes = D.boxes.filter(b => b.selectable);
    [{ P: 560 }, { P: 300 }, { P: 280 }].forEach(dep => [["__b", 19], ["__b16", 16], ["__b18", 18]].forEach(([m]) => {
      const o = Object.assign({ L: 600, H: 720, doors: 0, drawers: 3, matBody: m, matFront: m }, dep), base = mk(o);
      boxes.forEach(bx => {
        const cand = mk(Object.assign({}, o, { drawerSys: bx.key })), r = chk("zarga", bx.side, base.ctx), got = Array.from(r.why).map(w => w.k).sort();
        assert.deepEqual(got, drawExp(cand).filter(k => k !== "sideTh"), JSON.stringify(dep) + " " + m + " " + bx.key); n++; if (r.ok === false) viol++;
      });
    }));
    assert.ok(n === 45 && viol > 5 && viol < n, n + " " + viol);
  });
  test("sertar scund (8 sertare într-un corp jos): înălțimea frontului față de laterala sistemului — aceeași încălcare ca wDrawFront", () => {
    const o = { L: 600, H: 500, P: 560, doors: 0, drawers: 8, plinth: 60 }, base = mk(o);
    let any = 0;
    S.EBDrawersMoreData.boxes.filter(b => b.selectable).forEach(bx => {
      const cand = mk(Object.assign({}, o, { drawerSys: bx.key })), exp = drawExp(cand).includes("drFront"), r = chk("zarga", bx.side, base.ctx), got = r.why.some(w => w.k === "drFront");
      if (exp) any++;
      assert.equal(got, exp, bx.key);
    });
    assert.ok(any > 0, "cel puțin un sistem trebuie să pice pe înălțimea frontului");
  });
  test("glisiere pentru sertar din lemn (9 din date): adâncime, grosime laterală, lățime minimă coincid cu drawWarn", () => {
    let n = 0, viol = 0;
    [{ P: 560 }, { P: 260 }, { P: 450 }].forEach(dep => [["__b", 19], ["__b18", 18]].forEach(([m]) => {
      const o = Object.assign({ L: 600, H: 720, doors: 0, drawers: 3, matBody: m, matFront: m }, dep);
      S.EBDrawersMoreData.runners.forEach(r0 => {
        const base = mk(o), cand = mk(o, r0.key), r = chk("guida", r0.key, base.ctx), expAll = drawExp(cand);
        const got = Array.from(r.why).map(w => w.k).sort();
        assert.deepEqual(got, expAll, JSON.stringify(dep) + " " + m + " " + r0.key); n++; if (r.ok === false) viol++;
      });
    }));
    assert.ok(n === 6 * S.EBDrawersMoreData.runners.length && viol > 0, n + " " + viol);
  });

  test("uși glisante / escamotabile / cu aripă: pentru toate sistemele (un cod propriu fiecăruia) × 3 corpuri coincid cu slideWarn (sau «type»)", () => {
    let n = 0, viol = 0;
    const SLD = { type: "scorrevole", L: 2400, H: 2400, P: 600, doors: 2, shelves: 0, hang: 0, support: "zoccolo", plinth: 0 };
    const POC = { type: "standard", L: 600, H: 2000, P: 600, doors: 1, shelves: 0, hang: 0, support: "zoccolo", plinth: 80 };
    const WNG = { type: "standard", L: 900, H: 1800, P: 500, doors: 1, shelves: 0, hang: 0, support: "zoccolo", plinth: 80 };
    const KINDS = ["range", "depth", "n", "track", "nohinges", "front"];
    Object.entries({ SLD, POC, WNG }).forEach(([nm, o]) => {
      const base = mk(o);
      SL.list().forEach(sys => {
        const code = S.EBSlidingData.codes.find(c => c.sys.length === 1 && c.sys[0] === sys.name); if (!code) return;
        const r = chk("slide", SL.codeId(code.code), base.ctx);
        if (!SL.typeOk(sys, o.type)) { assert.deepEqual(ks(r), ["type"], nm + " " + sys.key); n++; viol++; return; }
        const cand = mk(Object.assign({}, o, { slide: sys.key })), sw = Array.from(cand.b.warn.slideWarn || []).filter(w => KINDS.includes(w.k)).map(w => w.k === "range" ? w.what : w.k).sort().filter((x, i, a) => a.indexOf(x) === i);
        assert.deepEqual(ks(r), sw, nm + " " + sys.key); n++; if (r.ok === false) viol++;
      });
    });
    assert.ok(n > 60 && viol > 10 && viol < n, n + " " + viol);
  });
});
