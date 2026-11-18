/* Ebanist — balamale Hettich / Salice / Grass / Häfele / Blum 105° (ebanist-hinges-more.js): datele, alegerea, găurirea, numărul de balamale, verificările.
 *
 *   node --test test/hingesmore.test.js
 *
 * Ce trebuie să rămână adevărat:
 *  - datele generate (ebanist-hinges-more-data.js) sunt cele din tools/hw-data/hinges (nimeni nu le editează de mână), iar fiecare cotă e în raw;
 *  - ce nu e citit rămâne null (adâncimea cupei Grass/Häfele, diametrul Air); nimic nu se completează cu cotele Blum;
 *  - o gaură de dorn / placuță se generează numai cu diametru + adâncime + reper scris în text/tabel; altfel avertisment, nu gaură;
 *  - numărul de balamale și verificările vin din graficul producătorului (înălțime + greutate);
 *  - textele sunt în toate cele 7 limbi, cu aceleași {substituții}; balamalele Blum rămân neschimbate.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const ROOT = path.join(__dirname, "..");
const S = E.appEngine(), MM = E.MM;
["ebanist-hinges-data.js", "ebanist-hinges.js", "ebanist-hinges-more-data.js", "ebanist-hinges-more-i18n.js", "ebanist-hinges-more.js", "ebanist-ops.js"]
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, "app", f), "utf8"), S, { filename: f }));
const M = S.EBHingesMore, H = S.EBHinges, DATA = S.EBHingesMoreData, I = S.HINGES_MORE_I18N;
const clone = o => JSON.parse(JSON.stringify(o));
const eq = (a, b, m) => assert.deepStrictEqual(clone(a), b, m);   // rezultatele vin dintr-un context vm: se compară după clonare
const RAW = JSON.parse(fs.readFileSync(path.join(ROOT, "tools", "hw-data", "raw", "cat-hinges.json"), "utf8"));
const RAWF = Object.fromEntries(RAW.families.map(f => [f.id, f]));
const fam = k => M.family(k);
const part = (k, art) => fam(k).parts.find(p => p.art === art);

describe("Datele", () => {
  test("5 mărci, 39 de familii, 214 articole, ids unice, toate cu sursă și verificat:false", () => {
    assert.equal(DATA.brands.length, 5);
    assert.equal(M.list().length, 39);
    const ids = M.list().flatMap(f => f.parts.map(p => p.id));
    assert.equal(ids.length, 214); assert.equal(new Set(ids).size, 214);
    M.list().forEach(f => { assert.ok(f.src, f.key); assert.equal(f.verificat, false, f.key); assert.ok(f.parts.length, f.key); });
    eq([...new Set(M.list().map(f => f.brand))].sort(), ["Blum", "Grass", "Hettich", "Häfele", "Salice"].sort());
  });
  test("generatorul verifică (node tools/hw-data-build-hinges.mjs --check) și fișierul generat e la zi", () => {
    const { execFileSync } = require("child_process");
    const before = fs.readFileSync(path.join(ROOT, "app", "ebanist-hinges-more-data.js"), "utf8");
    execFileSync("node", [path.join(ROOT, "tools", "hw-data-build-hinges.mjs")], { cwd: ROOT });
    assert.equal(fs.readFileSync(path.join(ROOT, "app", "ebanist-hinges-more-data.js"), "utf8"), before, "rulează python3 tools/hw-data/hinges/normalize.py și node tools/hw-data-build-hinges.mjs");
  });
  test("cotele-cheie sunt exact cele din raw", () => {
    const h = fam("het_8645i"), r = RAWF.hettich_sensys_8645i;
    eq(clone([h.cup.dia, h.cup.depth, h.cup.tb, h.doorTh]), [r.cup.dia, r.cup.depth, r.cup.tb, r.door_th]);
    eq(clone(h.count.rows.map(x => [x.n, x.h, x.kg[1]])), r.hinge_count.rows.map(x => [x.n, x.h_max_mm, x.kg_max]));
    assert.equal(fam("het_9935").cup.dia, 40); assert.equal(fam("sal_s100").cup.depth, 12); assert.equal(fam("sal_s200_94").cup.depth, 15.5);
    assert.equal(fam("het_8646i").cup.depth, 7.8);
  });
  test("ce nu e citit rămâne null: adâncimea cupei Grass/Häfele (numai minim), diametrul Air, graficul Salice S700", () => {
    assert.equal(fam("gra_tiomos110").cup.depth, null); assert.equal(fam("gra_tiomos110").cup.depthMin, 12.6);
    assert.equal(fam("haf_310_110").cup.depth, null); assert.equal(fam("haf_310_110").cup.depthMin, 12);
    assert.equal(fam("sal_air").cup.dia, null);
    assert.equal(fam("sal_s700_110").count, null);
    assert.equal(fam("het_avosys").cup.dia, null);
    M.list().forEach(f => { assert.ok(!("envelope" in f), f.key); });   // gabaritul nu se inventează
  });
  test("familiile fără document tehnic (Evisys, Metalla 510) nu sunt în catalog", () => {
    assert.ok(!M.list().some(f => /evisys|510/i.test(f.key + f.series)));
  });
  test("modelul de fixare: Hettich TH52 e cu șurub (52 × 5.5, desen), TH53 cu presare (Ø10 × 11), fără interax scris pentru presare", () => {
    const f = fam("het_8645i");
    eq(clone(f.fix.TH52), { mode: "screw", hole: null, pattern: { spacing: 52, offset: 5.5, src: "drawing" } });
    eq(clone(f.fix.TH53), { mode: "press", hole: { dia: 10, depth: 11 }, pattern: null });
    eq(clone(f.fix.THS55.hole), { dia: 10, depth: 6 });
  });
  test("Salice: interaxul vine din litera codului (A/P/U = 48/45/52), scris în text", () => {
    eq(clone(part("sal_s100", "C1A6AE9").pattern), { spacing: 48, offset: 6, src: "text", dia: 10 });
    eq(clone(part("sal_s100", "C1P6AE9").pattern), { spacing: 45, offset: 9.5, src: "text", dia: 8 });
    assert.equal(part("sal_s100", "C1U6AE9").pattern.spacing, 52);
  });
  test("Häfele: interaxul vine din descrierea codului (45/9.5, 48/6)", () => {
    eq(clone(part("haf_310_110", "311.60.924").pattern), { spacing: 45, offset: 9.5, src: "text" });
    eq(clone(part("haf_310_110", "311.60.918").pattern), { spacing: 48, offset: 6, src: "text" });
    assert.equal(part("haf_310_110", "311.04.648").colour, "black");
  });
  test("Grass: intervalele de coduri rămân un articol (maparea braț ↔ cod nu e scrisă)", () => {
    assert.equal(fam("gra_tiomos110").parts[0].art, "F028138519..F028138522");
  });
});

describe("Catalogul", () => {
  const known = (H.catalogEntries(["blum_71b3550"]) || []).map(x => x.id).concat(["blum_71b3550"]);
  const E1 = M.catalogEntries(known);
  test("câte un articol pe cod, ids unice și diferite de cele Blum, preț 0 de completat, nume în 7 limbi", () => {
    assert.equal(E1.length, 214); assert.equal(new Set(E1.map(x => x.id)).size, 214);
    assert.ok(!E1.some(x => known.includes(x.id)));
    E1.forEach(x => { assert.equal(x.price, 0); assert.equal(x.more, 1); assert.ok(x.art); ["it", "ro", "en", "fr", "de", "pl", "es"].forEach(l => assert.ok(x.n[l] && x.n[l].length > 5, x.id + l)); });
    assert.equal(M.catalogEntries([E1[0].id]).length, 213, "ids cunoscute se sar");
  });
  test("numele vin din câmpurile structurate: seria, unghiul, suprapunerea, fixarea (în limba cerută)", () => {
    const x = E1.find(y => y.art === "9 071 208");   // 8645i TH53 full
    assert.equal(x.n.en, "Sensys 8645i 110° · Full overlay · Press-in (TH53) · Soft close");
    assert.equal(x.n.it, "Sensys 8645i 110° · Ricoprente · A pressione (TH53) · Chiusura soft");
    assert.notEqual(x.n.de, x.n.fr);
    const y = E1.find(z => z.art === "C1P6AE9");
    assert.equal(y.n.en, "Silentia+ S100 105° · Full overlay · Arm 0 · Wood screw · 45/9.5 · Soft close");
  });
  test("articol fără cod transcris (Salice S300/N): art — și nota «cod de completat»", () => {
    const x = E1.find(y => y.hing === "sal_s300"); assert.equal(x.art, "—"); assert.match(x.n.en, /to be filled in/);
  });
  test("plăcuțele: Hettich 7, Salice 5, Blum 105° = plăcuțele CLIP existente; M BLUMOTION are placa premontată (nicio alegere)", () => {
    assert.equal(M.platesOf("het_9071205").length, 7); assert.equal(M.platesOf("sal_C1A6AE9").length, 5);
    eq(M.platesOf("blum_75B2550").map(p => p.id), clone(H.familyOfHw("blum_71b3590").plates));
    assert.equal(M.platesOf("blum_95B2550L0").length, 0);
    eq(M.platesOf("het_9071205")[0].art, ["9 071 595", "9 071 596", "9 071 597", "9 071 598"]);
    assert.equal(M.platesOf("nu_exista").length, 0);
  });
});

describe("Găurirea: ce se generează și ce nu", () => {
  test("Hettich 8645i șurub (TH52): cupă Ø35 × 12.8, TB 3–7, fără dornuri; placa cu soclu expandabil Ø5 × 12 la 37/32", () => {
    const g = M.geomOf("het_9071205");
    eq([g.cup_dia, g.cup_depth, g.tb, g.dowels, g.dowelOpen], [35, 12.8, [3, 7], false, false]);
    eq([g.plate_front, g.plate_spacing, g.plate_dia, g.plate_depth, g.plateHoles, g.plateOpen], [37, 32, 5, 12, true, false]);
    assert.equal(g.d3.fixPattern.spacing, 52);
  });
  test("Hettich cu presare / Fix / premontat: interaxul nu e scris în text → fără dornuri, cu avertisment", () => {
    ["9 071 208", "9 071 220", "9 073 567"].forEach(a => { const g = M.geomOf(M.catalogEntries([]).find(x => x.art === a).id); assert.equal(g.dowels, false, a); assert.equal(g.dowelOpen, true, a); assert.ok(M.opsNotes(g).includes("opsHingeDowelOpen")); });
  });
  test("Hettich 9936 Fix: adâncimea cupei 11.3 (depth_fix), nu 10.5", () => {
    assert.equal(M.geomOf("het_1063472").cup_depth, 11.3); assert.equal(M.geomOf("het_1058365").cup_depth, 10.5);
  });
  test("Salice: placa BAR* Ø10 × 11.5, BAV* Ø10 × 10 (la alegere), BAP* liniară 21+32; placa 28×32 fără mărime de gaură → avertisment", () => {
    assert.equal(M.geomOf("sal_C1A6AE9").plate_depth, 11.5);
    assert.equal(M.geomOf("sal_C1A6AE9", "salp_cross37_BAV").plate_depth, 10);
    const lin = M.geomOf("sal_C1A6AE9", "salp_linear21_BAP"); eq([lin.plate.kind, lin.plate_front, lin.plate_spacing], ["horizontal", 21, 32]);
    const no = M.geomOf("sal_C1A6AE9", "salp_cross28_S200"); assert.equal(no.plateHoles, false); assert.equal(no.plateOpen, true); assert.equal(no.plate_front, 28);
    assert.equal(M.geomOf("sal_C1A6AE9", "plăcuță_necunoscută").plateId, "salp_cross37_BAR", "alegere necunoscută → prima din familie");
  });
  test("Grass: numai adâncime minimă pentru cupă (12.6), placuțe fără mărime de gaură → nicio gaură de placă, cu avertisment", () => {
    const g = M.geomOf("gra_F028138519F028138522");
    assert.equal(g.cup_depth, undefined); assert.equal(g.cup_depth_min, 12.6); assert.equal(g.plateHoles, false); assert.equal(g.plateOpen, true);
    assert.ok(M.opsNotes(g).includes("opsHingePlateOpen"));
  });
  test("Häfele: minim 12; interaxul din cod există pe articol, dar nu produce gaură fără mărime", () => {
    const g = M.geomOf("haf_31104648"); assert.equal(g.cup_depth_min, 12); assert.equal(g.dowels, false);
    assert.equal(partOfHw("haf_31104648").pattern.spacing, 45);
    function partOfHw(i) { return M.partOfHw(i); }
  });
  test("sticlă / aluminiu / Air: nicio gaură de balama (cupă, dornuri, placă), cu avertisment și motiv", () => {
    ["het_9405214", "het_0072960", "sal_CBG2AE9", "gra_F029140325", "het_9072524", "sal_CEL6DE9XXI", "gra_F028138154157"].forEach(id => {
      const g = M.geomOf(id); assert.ok(g, id); assert.equal(g.noDrill, true, id); assert.equal(g.plateHoles, false, id); assert.equal(g.dowels, false, id); assert.equal(g.cup_dia, undefined, id);
      assert.ok(M.opsNotes(g).some(k => /opsHingeGlass|opsHingeNoDrill/.test(k)), id);
    });
    assert.ok(M.opsNotes(M.geomOf("het_9405214")).includes("opsHingeGlass")); assert.ok(M.opsNotes(M.geomOf("sal_CEL6DE9XXI")).includes("opsHingeNoDrill"));
  });
  test("Blum 105° ia plăcuțele CLIP din datele Blum existente (37/32), cu găurile lor; dornurile knock-in/EXPANDO nu au adâncime în sursă → avertisment", () => {
    const g = M.geomOf("blum_75B2550");
    eq([g.cup_dia, g.tb, g.plate_front, g.plate_spacing, g.plateHoles, g.dowels], [35, [3, 7], 37, 32, true, false]);
    assert.equal(M.geomOf("blum_75B2580").dowelOpen, true); assert.equal(M.geomOf("blum_75B258E").dowelOpen, true);
    assert.equal(M.geomOf("blum_75B2550", "175H31").plate.kind, "horizontal");
    assert.equal(M.geomOf("blum_75B2550", "hetp_9071595").plate_front, 37, "o placuță Hettich din setări nu strică alegerea Blum");
    assert.ok(!Object.values(M.geomOf("blum_75B2550", "hetp_9071595")).some(v => v === undefined), "nicio valoare undefined care să acopere setările implicite din ops");
  });
  test("necunoscut → null (rămâne Blum / catalogul general)", () => { assert.equal(M.geomOf("blum_71b3550"), null); assert.equal(M.geomOf("nu_exista"), null); });
});

describe("Politica de gaură, pe date construite (nu pe cele reale)", () => {
  /* o familie sintetică: dornul se găurește numai dacă interaxul e scris în text/tabel și gaura are Ø și adâncime */
  function withData(fx, pat, patSrc) {
    const ctx = { console }; ctx.globalThis = ctx; vm.createContext(ctx);
    ctx.EBHingesMoreData = { brands: [], plates: [{ id: "p1", kind: "cruciform", name: "x", line: 37, pitch: 32, lineSrc: "table", hole: { dia: 5, depth: 12 }, art: ["P1"] },
                                      { id: "p2", kind: "cruciform", name: "y", line: 37, pitch: 32, lineSrc: "drawing", hole: { dia: 5, depth: 12 }, art: ["P2"] }],
      families: [{ key: "t", brand: "T", series: "T", name: "T", angle: 110, kind: "standard", doorTh: [16, 22], cup: { dia: 35, depth: 12, depthMin: null, tb: [3, 7] }, fix: { F: fx },
        plates: ["p1", "p2"], parts: [{ id: "t1", art: "1", overlay: "full", fix: "F", pattern: pat ? Object.assign({ src: patSrc }, pat) : null }], count: null, verificat: false, src: "x" }] };
    vm.runInContext(fs.readFileSync(path.join(ROOT, "app", "ebanist-hinges-more.js"), "utf8"), ctx);
    return ctx.EBHingesMore;
  }
  const press = { mode: "press", hole: { dia: 10, depth: 11 }, pattern: null };
  test("dorn cu Ø, adâncime și interax din text: gaură; interax numai din desen: avertisment; fără adâncime: avertisment", () => {
    const ok = withData(press, { spacing: 45, offset: 9.5 }, "text").geomOf("t1");
    eq([ok.dowels, ok.dowel_dia, ok.dowel_depth, ok.dowel_spacing, ok.dowel_offset, ok.dowelOpen], [true, 10, 11, 45, 9.5, false]);
    assert.equal(withData(press, { spacing: 45, offset: 9.5 }, "drawing").geomOf("t1").dowels, false);
    assert.equal(withData(press, { spacing: 45, offset: 9.5 }, "drawing").geomOf("t1").dowelOpen, true);
    assert.equal(withData({ mode: "press", hole: { dia: 10, depth: null }, pattern: null }, { spacing: 45, offset: 9.5 }, "text").geomOf("t1").dowels, false);
    assert.equal(withData({ mode: "screw", hole: null, pattern: null }, { spacing: 45, offset: 9.5 }, "text").geomOf("t1").dowelOpen, false, "șurubul nu cere dornuri");
  });
  test("placa: reperul din tabel → găuri; reperul numai din desen → fără găuri", () => {
    const m = withData(press, null);
    assert.equal(m.geomOf("t1", "p1").plateHoles, true); assert.equal(m.geomOf("t1", "p2").plateHoles, false);
    assert.equal(m.geomOf("t1", "p2").plate_front, 37, "poziția rămâne pentru desen");
  });
});

describe("Numărul de balamale și verificările", () => {
  const id = "het_9071205";
  test("Hettich 8645i: 2 până la 1000 mm / 7.7 kg, 3 până la 1700 / 13.7, 4 până la 2200 / 17.1, 5 până la 2400, 6 până la 2600, 7 până la 2800", () => {
    assert.equal(M.count(id, 900, 3), 2); assert.equal(M.count(id, 1000, 7.7), 2); assert.equal(M.count(id, 1200, 3), 3); assert.equal(M.count(id, 1700, 5), 3);
    assert.equal(M.count(id, 1800, 5), 4); assert.equal(M.count(id, 2300, 5), 5); assert.equal(M.count(id, 2500, 5), 6); assert.equal(M.count(id, 2700, 5), 7);
  });
  test("greutatea împinge numărul în sus: 900 mm și 8 kg → 3 (peste 7.7 kg)", () => {
    assert.equal(M.count(id, 900, 8), 3); assert.equal(M.count(id, 900, 0), 2, "fără greutate: numai înălțimea");
  });
  test("peste grafic: ultimul rând și problemă pe înălțime; lățime peste 600 mm: problemă; greutate peste maxim: problemă", () => {
    assert.equal(M.count(id, 3000, 5), 7);
    eq(M.fit(id, { th: 19, h: 3000, w: 500, kg: 5 }).map(x => x.k), ["h"]);
    eq(M.fit(id, { th: 19, h: 700, w: 700, kg: 3 }).map(x => [x.k, x.hi]), [["w", 600]]);
    eq(M.fit(id, { th: 19, h: 2700, w: 500, kg: 30 }).map(x => [x.k, x.n, x.hi]), [["kg", 7, 22]]);
    assert.equal(M.fit(id, { th: 19, h: 700, w: 500, kg: 3 }).length, 0);
  });
  test("grosimea ușii în afara intervalului producătorului: problemă cu limitele citite (null nu produce nimic)", () => {
    eq(clone(M.fit(id, { th: 12, h: 700, w: 500, kg: 0 })), [{ k: "th", v: 12, lo: 15, hi: 24 }]);
    assert.equal(M.fit(id, { th: 30, h: 700, w: 500 }).length, 1);
    assert.equal(M.fit("sal_C1A6AE9", { th: 40, h: 700, w: 500 }).length, 0, "Salice S100: numai minim 14 în sursă");
    assert.equal(M.fit("sal_C1A6AE9", { th: 10, h: 700, w: 500 }).length, 1);
  });
  test("același grafic pentru 8631i / 8646i / 8657i (trimitere la 8645i); fără grafic (Intermat 9943): null → regula generală", () => {
    assert.equal(M.count("het_9090260", 1200, 0), 3); assert.equal(M.count("het_1029518", 1200, 0), null);
  });
  test("Grass: 2 până la 900 mm / 6 kg, 3 până la 1600 / 10, 4 până la 2200 / 17, 5 până la 2500 / 22; Häfele pe benzi de greutate", () => {
    const g = "gra_F028138519F028138522";
    assert.equal(M.count(g, 800, 2), 2); assert.equal(M.count(g, 800, 7), 3); assert.equal(M.count(g, 1700, 5), 4); assert.equal(M.count(g, 2400, 20), 5);
    eq(clone(fam("haf_310_110").count.rows[1]), { n: 3, h: 1500, kg: [6, 9] });
  });
  test("Salice Air: limite de 25 kg și 2700 × 600", () => {
    const k = M.fit("sal_CEL6DE9XXI", { th: 20, h: 800, w: 500, kg: 26 }).map(x => x.k); assert.ok(k.includes("kg"));
    eq(M.fit("sal_CEL6DE9XXI", { th: 20, h: 2800, w: 700, kg: 5 }).map(x => x.k).sort(), ["h", "w"]);
  });
  test("greutatea ușii: înălțime × lățime × grosime × densitate", () => { assert.equal(Math.round(M.doorKg(700, 400, 19, 700) * 100) / 100, 3.72); assert.equal(M.doorKg(0, 400, 19, 700), 0); });
});

/* motorul de găurire cu balamaua aleasă */
const proj = JSON.parse(fs.readFileSync(path.join(ROOT, "docs", "Ebanist_Proiect_Cetinic-3-corpuri.json"), "utf8"));
let CUR = { cern: "blum_71b3550", plate: null }, DENS = null;
S.hingeGeom = () => H.geomOf(CUR.cern, CUR.plate) || M.geomOf(CUR.cern, CUR.plate);
S.hingeDensity = () => DENS;
function ops(cern, plate, cfgOver, dist) {
  CUR = { cern, plate };
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__f", matBack: "__k", matOvr: {}, matAdd: [MM("__b", 19), MM("__f", 19), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
  const cfg = Object.assign({}, clone(proj.configs["Entrance dx"]), { matBody: "__b", matFront: "__f", matBack: "__k", name: "Entrance dx" }, cfgOver || {});
  const b = S.buildModule(cfg), G0 = S.deriveCarcass(S.carcassParams(cfg, {})), G = dist ? Object.assign({}, G0, { foratura: Object.assign({}, G0.foratura, { dist_cant: dist }) }) : G0;
  return clone(S.generateOperations({ boxes: b.boxes, cfg, G }));
}
function opsSimple(cern, over) {
  CUR = { cern, plate: null };
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__b", matOvr: {}, matAdd: [MM("__b", 19), MM("pfl5", 5)], hwProd: { guida: "blum_tandem" } };
  const cfg = Object.assign({ name: "B", type: "standard", L: 900, H: 700, P: 330, plinth: 0, tram: 0, shelves: 1, drawers: 0, doors: 1, back: 1, hang: 1, support: "sospeso", matBody: "__b", matFront: "__b", matBack: "__b", drawerSys: "legno" }, over || {});
  const b = S.buildModule(cfg), G = S.deriveCarcass(S.carcassParams(cfg, {}));
  return clone(S.generateOperations({ boxes: b.boxes, cfg, G }));
}
const opsOf = (o, re) => o.pieces.flatMap(p => p.operations).filter(q => re.test(q.note || ""));
const keys = o => [...new Set(o.warnings.map(w => w.k))];

describe("ops cu balama de altă marcă", () => {
  test("implicit (Blum 71B3550) = ca înainte, fără câmp g pe instanța din 3D", () => {
    const o = ops("blum_71b3550"); eq([opsOf(o, /tazza cerniera/).length, opsOf(o, /tassello cerniera/).length, opsOf(o, /basetta cerniera/).length], [10, 20, 20]);
    assert.ok(o.hw.filter(h => h.type === "cerniera").every(h => !("g" in h)));
    assert.ok(!keys(o).some(k => /opsHinge(Dowel|Plate|NoDrill|Glass|Th|H|W|Kg)/.test(k)));
  });
  test("Hettich TH52: cupe cu adâncimea 12.8, 20 de găuri de placă Ø5 × 12, fără dornuri; instanța poartă g pentru 3D", () => {
    const o = ops("het_9071205"), cups = opsOf(o, /tazza cerniera/), pl = opsOf(o, /basetta cerniera/);
    assert.equal(cups.length, 10); cups.forEach(q => { assert.equal(q.dia, 35); assert.equal(q.depth, 12.8); });
    assert.equal(pl.length, 20); pl.forEach(q => { assert.equal(q.dia, 5); assert.equal(q.depth, 12); });
    assert.equal(opsOf(o, /tassello cerniera/).length, 0);
    const h = o.hw.find(x => x.type === "cerniera"); assert.equal(h.g.fixPattern.spacing, 52); assert.equal(h.g.plateLine, 37); assert.equal(h.g.platePitch, 32); assert.equal(h.g.brand, "Hettich");
    assert.ok(!keys(o).some(k => /opsHinge(Dowel|Plate|NoDrill|Glass)/.test(k)));
  });
  test("Hettich TH53 (presare): fără dornuri + opsHingeDowelOpen", () => {
    const o = ops("het_9071208"); assert.equal(opsOf(o, /tassello cerniera/).length, 0); assert.ok(keys(o).includes("opsHingeDowelOpen")); assert.equal(opsOf(o, /tazza cerniera/).length, 10);
  });
  test("Salice: placa BAR Ø10 × 11.5, apoi BAV Ø10 × 10; placa 28×32 → fără găuri de placă + opsHingePlateOpen; cupa S100 are 12 mm", () => {
    const o = ops("sal_C1A6AE9"); opsOf(o, /basetta cerniera/).forEach(q => { assert.equal(q.dia, 10); assert.equal(q.depth, 11.5); }); opsOf(o, /tazza cerniera/).forEach(q => assert.equal(q.depth, 12));
    ops("sal_C1A6AE9", "salp_cross37_BAV").pieces.flatMap(p => p.operations).filter(q => /basetta/.test(q.note || "")).forEach(q => assert.equal(q.depth, 10));
    const n = ops("sal_C1A6AE9", "salp_cross28_S200"); assert.equal(opsOf(n, /basetta cerniera/).length, 0); assert.ok(keys(n).includes("opsHingePlateOpen"));
  });
  test("Grass: cupa cu cel puțin minimul de 12.6; fără găuri de placă; avertisment", () => {
    const o = ops("gra_F028138519F028138522"); opsOf(o, /tazza cerniera/).forEach(q => assert.ok(q.depth >= 12.6));
    assert.equal(opsOf(o, /basetta cerniera/).length, 0); assert.ok(keys(o).includes("opsHingePlateOpen"));
    const t160 = ops("gra_F028138561F028138563"); opsOf(t160, /tazza cerniera/).forEach(q => assert.equal(q.depth, 12.5, "minim 10 < setarea proiectului 12.5"));
  });
  test("sticlă / aluminiu / Air: nicio gaură de balama în panou, avertisment cu motivul; instanța există (3D)", () => {
    const g = ops("het_9405214"); assert.equal(opsOf(g, /cerniera/).length, 0); assert.ok(keys(g).includes("opsHingeGlass")); assert.ok(g.hw.some(h => h.type === "cerniera" && h.g && h.g.glass));
    const a = ops("sal_CEL6DE9XXI"); assert.equal(opsOf(a, /cerniera/).length, 0); assert.ok(keys(a).includes("opsHingeNoDrill"));
    const al = ops("gra_F028138154157"); assert.equal(opsOf(al, /cerniera/).length, 0); assert.ok(keys(al).includes("opsHingeNoDrill"));
  });
  test("grosimea ușii de 19 mm față de sticla de 4–6.5 mm: opsHingeTh cu valorile; cu Hettich 8645i (15–24) nu", () => {
    const w = ops("het_0072960").warnings.find(x => x.k === "opsHingeTh"); assert.ok(w); eq([w.v, w.lo, w.hi], [19, 4, 6.5]);
    assert.ok(!keys(ops("het_9071205")).includes("opsHingeTh"));
  });
  test("distanța de găurire în afara intervalului familiei: opsHingeTB; familie fără TB în date (8646i): nu", () => {
    assert.ok(keys(ops("het_9071205", null, null, 9)).includes("opsHingeTB"));
    assert.ok(!keys(ops("het_9094000", null, null, 9)).includes("opsHingeTB"));
  });
  test("greutatea ușii din densitate: ușă de 2650 × 864 mm pe Air (25 kg, 2700 × 600): opsHingeW și opsHingeKg", () => {
    DENS = 700;
    try {
      const o = opsSimple("sal_CEL6DE9XXI", { H: 2650, L: 900, hang: 0, support: "pavimento", plinth: 0 }), w = o.warnings.map(x => x.k);
      assert.ok(w.includes("opsHingeW") && w.includes("opsHingeKg"), w.join());
      const kg = o.warnings.find(x => x.k === "opsHingeKg"); assert.ok(kg.v > 25 && kg.hi === 25 && kg.n === 1, JSON.stringify(kg));
      DENS = null; assert.ok(!opsSimple("sal_CEL6DE9XXI", { H: 2650, L: 900, hang: 0, support: "pavimento", plinth: 0 }).warnings.some(x => x.k === "opsHingeKg"), "fără densitate nu se calculează greutatea");
    } finally { DENS = null; }
  });
  test("numărul de cupe urmează hingeCountFor din aplicație", () => {
    S.hingeCountFor = () => 3;
    try { const o = ops("het_9071205"); const n = new Set(o.hw.filter(h => h.type === "cerniera").map(h => h.piece)).size; assert.equal(opsOf(o, /tazza cerniera/).length, 3 * n); }
    finally { delete S.hingeCountFor; }
  });
  test("TH52 Hettich: 3D primește cotele din date (interax 52 × 5.5, linia plăcuței 37 × 32)", () => {
    const g = ops("het_9071205").hw.find(h => h.type === "cerniera").g; eq([g.fixPattern.spacing, g.fixPattern.offset, g.plateLine, g.platePitch, g.overlay], [52, 5.5, 37, 32, "full"]);
    assert.equal(ops("sal_C1P6AE9").hw.find(h => h.type === "cerniera").g.fixPattern.spacing, 45);
  });
});

describe("Brațul din desenul 3D", () => {
  test("lungimea din date (Grass 84.5) mută capătul brațului; fără lungime: forma de referință; înseriat = mai înalt", () => {
    const a = M.armProfile(100, false, 84.5, 1.3), b = M.armProfile(100, false, null, 1.3), c = M.armProfile(100, true, null, 1.3);
    assert.equal(a.zFar, 100 - (84.5 - 16)); assert.equal(b.zFar, 100 - (M.SCHEM.armLen - 16));
    assert.ok(c.outer[3][1] > b.outer[3][1]);
    assert.equal(M.geomOf("gra_F028138519F028138522").d3.armLen, 84.5); assert.equal(M.geomOf("het_9071205").d3.armLen, null);
  });
});

describe("Textele", () => {
  const L = ["it", "ro", "en", "fr", "de", "pl", "es"], subs = s => (s.match(/\{[a-z]+\}/g) || []).sort().join();
  test("fiecare cheie are toate cele 7 limbi, nevidă, cu aceleași {substituții}", () => {
    const raw = S.HINGES_MORE_I18N_RAW; assert.ok(Object.keys(raw).length > 60);
    Object.keys(raw).forEach(k => { assert.equal(raw[k].length, 7, k); raw[k].forEach((v, i) => { assert.ok(v && v.length > 0, k + L[i]); assert.equal(subs(v), subs(raw[k][2]), k + " " + L[i]); }); });
  });
  test("avertismentele pe care le poate emite modulul au text în I18N-ul lui, iar cheile lor sunt în lista OPS", () => {
    const need = ["opsHingeDowelOpen", "opsHingePlateOpen", "opsHingeNoDrill", "opsHingeGlass", "opsHingeTh", "opsHingeH", "opsHingeW", "opsHingeKg"];
    need.forEach(k => { L.forEach(l => assert.ok(I[l][k], k + l)); assert.ok(S.HINGES_MORE_OPS_KEYS.includes(k), k); });
    assert.match(I.en.opsHingeKg, /\{v\}.*\{n\}.*\{hi\}/);
  });
  test("fiecare cuvânt din numele articolelor (overlay, fixare, flag, culoare, variantă) există în 7 limbi", () => {
    const used = new Set();
    M.list().forEach(f => f.parts.forEach(p => {
      if (p.overlay && !/^(crank|overlay\d)/.test(p.overlay)) used.add("hmw_" + p.overlay);
      if (p.colour) used.add("hmw_" + p.colour);
      if (p.fix) used.add("hmw_" + ({ knockin: "press", expando: "premount" }[p.fix] || (f.fix && f.fix[p.fix] && !["screw", "woodscrew", "press", "fix", "premount", "dowel", "rapido", "glued", "impresso"].includes(p.fix) ? f.fix[p.fix].mode : p.fix)));
    }));
    used.add("hmw_crank"); used.add("hmw_overlay"); used.add("hmw_arm");
    used.forEach(k => L.forEach(l => assert.ok(I[l][k], k + " " + l)));
  });
  test("fișa tehnică: titlu cu codul, ce se generează / ce nu, graficul de numărare, desen schematic 3D, în fiecare limbă", () => {
    L.forEach(l => { const h = M.sheetHtml("het_9071208", { lang: l }); assert.ok(h.includes("9 071 208")); assert.ok(h.includes(I[l].hm3d.slice(0, 20))); assert.ok(h.includes(I[l].hmDrillNo)); });
    assert.equal(M.sheetHtml("nu_exista", {}), null);
    assert.ok(M.sheetHtml("het_9071205", { lang: "en" }).includes("13.7"));
  });
});
