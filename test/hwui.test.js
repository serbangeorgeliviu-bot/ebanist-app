/* Ebanist — FAZA H.3: panoul «Feronerie» și selectorul (ebanist-hwui.js, partea pură).
 *
 *   node --test test/hwui.test.js
 *
 * Ce trebuie să rămână adevărat:
 *  - fiecare slot are ținte, fiecare țintă aparține unui singur slot și servește exact un câmp vechi (nu se schimbă formatul cfg);
 *  - alegerea și ștergerea se traduc în operația pe câmpul vechi (ștergere = valoarea «fără» a câmpului: "" sau «legno» la sistemul de sertar);
 *  - sloturile care nu se aplică corpului sunt ascunse; alegerea existentă ține slotul vizibil;
 *  - recente și favorite: normalizare, fără dubluri, limită; datele stricate nu strică nimic;
 *  - secțiunile respectă H.2 (null nu e niciodată «Recomandat»), cu ordinea din secțiune;
 *  - date-cheie: numai din date; limita null nu apare; cel mult 4;
 *  - textele: aceleași chei în cele 7 limbi, iar fiecare cheie folosită în cod există.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = path.join(__dirname, "..", "app");
const ctx = { console }; ctx.globalThis = ctx; vm.createContext(ctx);
["ebanist-hwindex.js", "ebanist-hwindex-i18n.js", "ebanist-hwfit.js", "ebanist-hwfit-i18n.js", "ebanist-hwui.js", "ebanist-hwui-i18n.js"].forEach(f => vm.runInContext(fs.readFileSync(path.join(APP, f), "utf8"), ctx, { filename: f }));
const U = vm.runInContext("EBHwUI", ctx), X = vm.runInContext("EBHwIndex", ctx), F = vm.runInContext("EBHwFit", ctx), I18N = vm.runInContext("HWUI_I18N", ctx);
const SRC = fs.readFileSync(path.join(APP, "ebanist-hwui.js"), "utf8");
const J = o => JSON.parse(JSON.stringify(o)), eq = (a, b, m) => assert.deepStrictEqual(J(a), J(b), m);

describe("Sloturi și ținte", () => {
  test("fiecare slot din index are ținte; fiecare țintă aparține unui singur slot", () => {
    X.SLOTS.forEach(s => assert.ok(U.SLOT_TARGETS[s.id] && U.SLOT_TARGETS[s.id].length, s.id));
    const seen = {};
    Object.entries(U.SLOT_TARGETS).forEach(([slot, tids]) => tids.forEach(tid => { assert.ok(U.TARGETS[tid], tid); assert.ok(!seen[tid], "dublă: " + tid); seen[tid] = slot; assert.equal(U.slotOfTarget(tid), slot); }));
    Object.keys(U.TARGETS).forEach(tid => assert.ok(seen[tid], "țintă fără slot: " + tid));
  });
  test("categoria din index a unei ținte stă în același slot (H.1)", () => {
    Object.entries(U.TARGETS).forEach(([tid, T]) => { if (T.idx) assert.equal(X.slotOf(T.idx), U.slotOfTarget(tid), tid); });
  });
  test("câmpurile vechi: hwSel pe categorii, restul pe id-urile din formular (neschimbate)", () => {
    eq(J(U.TARGETS.lift), { via: "ctl", ctl: "bLift", idx: "lift", clear: "" });
    assert.equal(U.TARGETS.corner.ctl, "bCU"); assert.equal(U.TARGETS.slidesys.ctl, "bSlide"); assert.equal(U.TARGETS.drawsys.ctl, "bDrawSys"); assert.equal(U.TARGETS.led.ctl, "bLed");
    ["cern", "push", "man", "manS", "guida", "pushd", "conn", "susp", "suprail", "sup", "asta", "pied", "aw"].forEach(c => { assert.equal(U.TARGETS[c].via, "hwsel"); assert.equal(U.TARGETS[c].cat, c); });
  });
  test("sub-alegerile (deschidere electrică, mărime, parte oarbă) sunt câmpuri vechi", () => {
    eq(J(U.SUBS.ridicare), [["bLiftElec", "rowLiftElec", "fLiftElec"]]);
    eq(U.SUBS.colt.map(x => x[0]), ["bCUSize", "bCUHand"]);
  });
});

describe("Alegere și ștergere", () => {
  test("alegerea scrie valoarea în câmpul vechi; hwSel pe categoria lui", () => {
    eq(J(U.planOps("cern", "blum_71b3550")), { via: "hwsel", cat: "cern", value: "blum_71b3550" });
    eq(J(U.planOps("lift", "blum_hk_top")), { via: "ctl", ctl: "bLift", value: "blum_hk_top" });
    eq(J(U.planOps("corner", "kb_lemans2")), { via: "ctl", ctl: "bCU", value: "kb_lemans2" });
    eq(J(U.planOps("slidesys", "het_topline_xl")), { via: "ctl", ctl: "bSlide", value: "het_topline_xl" });
  });
  test("ștergerea = valoarea «fără»: «» (sistemul de sertar: «legno»)", () => {
    assert.equal(U.planOps("cern", "").value, ""); assert.equal(U.planOps("lift", null).value, ""); assert.equal(U.planOps("drawsys", "").value, "legno");
    assert.equal(U.planOps("nu_exista", "x"), null);
  });
  test("«explicit» = diferit de valoarea fără; «legno» e implicit", () => {
    assert.equal(U.isExplicit("drawsys", "legno"), false); assert.equal(U.isExplicit("drawsys", "legrabox"), true);
    assert.equal(U.isExplicit("cern", ""), false); assert.equal(U.isExplicit("cern", "x"), true); assert.equal(U.isExplicit("nu_exista", "x"), false);
  });
});

describe("Ce slot se aplică corpului", () => {
  const none = () => false;
  test("ușile și sertarele decid balamalele, deschiderea, ridicarea, sertarele", () => {
    assert.equal(U.slotApplies("balamale", { doors: 0 }, none), false); assert.equal(U.slotApplies("balamale", { doors: 2 }, none), true);
    assert.equal(U.slotApplies("sertare", { drawers: 0 }, none), false); assert.equal(U.slotApplies("sertare", { drawers: 3 }, none), true);
    assert.equal(U.slotApplies("sertare", { drawers: 0, drawerBlocks: true }, none), true);
    assert.equal(U.slotApplies("deschidere", { doors: 0, drawers: 0 }, none), false); assert.equal(U.slotApplies("ridicare", { doors: 1 }, none), true);
  });
  test("glisantele și colțul urmează rândurile vechi (tipul corpului)", () => {
    assert.equal(U.slotApplies("glisante", { slideRow: false }, none), false); assert.equal(U.slotApplies("glisante", { slideRow: true }, none), true);
    assert.equal(U.slotApplies("colt", { cornerRow: false }, none), false); assert.equal(U.slotApplies("colt", { cornerRow: true }, none), true);
  });
  test("suspendarea numai pe corp agățat; rafturile cu rafturi/bară/picioare; îmbinările și iluminatul mereu", () => {
    assert.equal(U.slotApplies("suspendare", { support: "zoccolo" }, none), false); assert.equal(U.slotApplies("suspendare", { support: "sospeso" }, none), true);
    assert.equal(U.slotApplies("rafturi", { shelves: 0, hang: 0, support: "zoccolo" }, none), false); assert.equal(U.slotApplies("rafturi", { support: "piedini" }, none), true);
    assert.equal(U.slotApplies("imbinari", {}, none), true); assert.equal(U.slotApplies("iluminat", {}, none), true);
  });
  test("o alegere existentă ține slotul vizibil chiar dacă corpul nu mai are ușile", () => {
    const has = t => t === "lift" || t === "susp";
    assert.equal(U.slotApplies("ridicare", { doors: 0 }, has), true); assert.equal(U.slotApplies("suspendare", { support: "zoccolo" }, has), true);
    assert.equal(U.slotApplies("balamale", { doors: 0 }, has), false);
  });
});

describe("Recente și favorite", () => {
  test("date stricate → gol; chei nestring scoase; fără dubluri", () => {
    eq(J(U.prefsNormalize(null)), { recent: {}, fav: [] });
    eq(J(U.prefsNormalize("x")), { recent: {}, fav: [] });
    eq(J(U.prefsNormalize({ recent: { balamale: ["a|1", 5, "a|2"] }, fav: ["a|1", "a|1", null, "b|2"] })), { recent: { balamale: ["a|1", "a|2"] }, fav: ["a|1", "b|2"] });
  });
  test("recent: cel mai nou întâi, fără dubluri, cel mult RECENT_MAX", () => {
    const p = U.prefsNormalize(null);
    for (let i = 0; i < 20; i++) U.recentPush(p, "balamale", "cern|h" + i);
    assert.equal(p.recent.balamale.length, U.RECENT_MAX); assert.equal(p.recent.balamale[0], "cern|h19");
    U.recentPush(p, "balamale", "cern|h15"); assert.equal(p.recent.balamale[0], "cern|h15"); assert.equal(p.recent.balamale.filter(k => k === "cern|h15").length, 1);
    U.recentPush(p, "ridicare", "lift|x"); eq(p.recent.ridicare, ["lift|x"]);
  });
  test("favorite: comută și spune starea nouă", () => {
    const p = U.prefsNormalize(null), k = U.keyOf("cern", "blum_71b3550");
    assert.equal(k, "cern|blum_71b3550");
    assert.equal(U.favToggle(p, k), true); eq(p.fav, [k]); assert.equal(U.favToggle(p, k), false); eq(p.fav, []);
  });
});

describe("Secțiunile (H.2) și ordinea lor", () => {
  const mk = (id, ok, unk, rank) => ({ e: { id }, r: { ok, unknownLimits: unk, rank, why: [] } });
  const items = [mk("a", true, false, 5), mk("b", true, true, 1), mk("c", false, false, 0), mk("d", null, true, 1e6), mk("e", true, false, 2), mk("f", true, false, 2)];
  const check = e => items.find(x => x.e.id === e.id).r;
  test("«necunoscut» nu e niciodată Recomandat; ce nu trece cade; ok:null merge în Potrivite", () => {
    const s = U.buildSections(items.map(x => x.e), check, F.section, false);
    eq(s.recomandat.map(x => x.e.id), ["e", "f", "a"]);
    eq(s.potrivit.map(x => x.e.id), ["b", "d"]);
    eq(s.nu_se_potriveste.map(x => x.e.id), ["c"]);
  });
  test("fără interogare: cea mai mică rezervă întâi (rank), apoi ordinea listei; cu interogare rămâne relevanța", () => {
    const s = U.buildSections(items.map(x => x.e), check, F.section, false);
    eq(s.recomandat.map(x => x.e.id), ["e", "f", "a"]);
    const q = U.buildSections(items.map(x => x.e), check, F.section, true);
    eq(q.recomandat.map(x => x.e.id), ["a", "e", "f"]);
  });
  test("nimic nu se pierde: suma secțiunilor = numărul de articole", () => {
    const s = U.buildSections(items.map(x => x.e), check, F.section, false);
    assert.equal(s.recomandat.length + s.potrivit.length + s.nu_se_potriveste.length, items.length);
  });
});

describe("Avertismentele EBOpen → slot", () => {
  const O = { get: id => ({ p1: { model: "TIP-ON", art: "956A" }, d1: { model: "TIP-ON BM", sysname: "LEGRABOX", art: "T60" }, s1: { model: "SAH 500", art: "9385" }, c1: { model: "Minifix", art: "262" } })[id] || null };
  const sel = { push: "p1", pushd: "d1", susp: "s1", conn: "c1" };
  test("după articolul numit în text, apoi după tipul avertismentului", () => {
    assert.equal(U.openWarnSlot({ k: "range", sys: "TIP-ON 956A" }, sel, O), "deschidere");
    assert.equal(U.openWarnSlot({ k: "range", sys: "TIP-ON BM LEGRABOX T60" }, sel, O), "sertare");
    assert.equal(U.openWarnSlot({ k: "load", sys: "SAH 500 9385" }, sel, O), "suspendare");
    assert.equal(U.openWarnSlot({ k: "connT", sys: "Minifix 262" }, sel, O), "imbinari");
    assert.equal(U.openWarnSlot({ k: "noHandle", sys: "TIP-ON" }, sel, O), "deschidere");
    assert.equal(U.openWarnSlot({ k: "noHandle", sys: "TIP-ON BM" }, sel, O), "sertare");
    assert.equal(U.openWarnSlot({ k: "rail", sys: "x" }, {}, O), "suspendare"); assert.equal(U.openWarnSlot({ k: "pushdSys", sys: "x" }, {}, O), "sertare");
  });
});

describe("Date-cheie: numai din date", () => {
  const T = k => ({ hxfAngle: "{v}°", hxfDoor: "ușă {r} mm", hxfGlass: "sticlă", hxfCabH: "H {r}", hxfKg: "{r} kg", hxfCabW: "L {r}", hxfDepth: "adânc. {v}", hxfLoad: "sarcină {v}", hxfLeaves: "{r} uși", hxfW: "L {r}", cuKind_blind: "orb", cuBody_base: "bază", hxfNL: "NL {r}" })[k] || k;
  test("interval cu un capăt null: «≤» / «≥»; ambele null: nimic", () => {
    assert.equal(U.rng(15, 24), "15–24"); assert.equal(U.rng(null, 24), "≤ 24"); assert.equal(U.rng(18, null), "≥ 18"); assert.equal(U.rng(null, null), ""); assert.equal(U.rng(5, 5), "5");
  });
  test("balama: unghi, grosimea ușii (capătul null lipsește), sticlă; fără familie = nimic", () => {
    const M = { EBHingesMore: { isMore: () => true, familyOfHw: () => ({ angle: 105, doorTh: [null, 24], glass: true }) } };
    eq(U.factsOf({ cat: "cern", id: "x" }, T, M), ["105°", "ușă ≤ 24 mm", "sticlă"]);
    eq(U.factsOf({ cat: "cern", id: "x" }, T, {}), []);
    eq(U.factsOf({ cat: "cern", id: "x" }, T, { EBHingesMore: { isMore: () => false }, EBHinges: { familyOfHw: () => ({ angle: 110 }) } }), ["110°"]);
  });
  test("ridicare: limitele null nu se afișează; adâncimea min. da", () => {
    const M = { EBLiftFit: { get: () => ({ limits: { cabH: [205, 600], cabW: [null, null], kg: [null, 18], depthMin: 187 } }) } };
    eq(U.factsOf({ cat: "lift", id: "l" }, T, M), ["H 205–600", "≤ 18 kg", "adânc. 187"]);
    eq(U.factsOf({ cat: "lift", id: "l" }, T, { EBLiftFit: { get: () => ({ limits: { cabH: [null, null], kg: [null, null] } }) } }), []);
  });
  test("cel mult 4 date; datele care lipsesc nu ridică excepții", () => {
    const M = { EBSliding: { get: () => ({ leaves: [2, 4], lim: { kg: [null, 100], w: [600, 2000], th: [18, 40] } }) } };
    const f = U.factsOf({ cat: "slidesys", id: "s" }, T, M); assert.equal(f.length, 4); assert.equal(f[0], "2–4 uși");
    eq(U.factsOf({ cat: "slidesys", id: "s" }, T, { EBSliding: { get: () => null } }), []);
    eq(U.factsOf({ cat: "nu_exista", id: "s" }, T, M), []);
    eq(U.factsOf({ cat: "corner", id: "c" }, T, { EBCornerFit: { get: () => ({ kind: "blind", body: "any", load: { total: null } }) } }), ["orb"]);
  });
});

describe("Texte (7 limbi)", () => {
  test("aceleași chei în toate limbile, toate nevide, fără {…} necunoscute", () => {
    const langs = Object.keys(I18N).sort();
    eq(langs, ["de", "en", "es", "fr", "it", "pl", "ro"]);
    const k0 = Object.keys(I18N.ro).sort();
    langs.forEach(l => { eq(Object.keys(I18N[l]).sort(), k0, l); k0.forEach(k => assert.ok(I18N[l][k] && I18N[l][k].length > 0, l + " " + k)); });
    langs.forEach(l => k0.forEach(k => (I18N[l][k].match(/\{(\w+)\}/g) || []).forEach(p => assert.ok(["{n}", "{m}", "{x}", "{v}", "{r}"].includes(p), l + " " + k + " " + p))));
  });
  test("același set de substituții ({n}, {m}, …) în toate limbile pentru aceeași cheie", () => {
    const ph = s => (s.match(/\{\w+\}/g) || []).sort().join(",");
    Object.keys(I18N.ro).forEach(k => Object.keys(I18N).forEach(l => assert.equal(ph(I18N[l][k]), ph(I18N.ro[k]), l + " " + k)));
  });
  test("fiecare cheie hx… folosită în ebanist-hwui.js există în HWUI_I18N", () => {
    const used = new Set(); let m; const re = /T\("(hx[a-zA-Z_]+)"\)/g;
    while ((m = re.exec(SRC))) used.add(m[1]);
    ["hxpWarnN", "hxfAngle"].forEach(k => used.add(k));
    const defined = new Set(Object.keys(I18N.ro)), idxKeys = new Set(X.SLOTS.map(s => s.key));
    [...used].forEach(k => assert.ok(defined.has(k) || idxKeys.has(k), "cheie lipsă: " + k));
  });
});
