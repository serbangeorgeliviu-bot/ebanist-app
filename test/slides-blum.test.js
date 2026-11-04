/* Ebanist — glisiere și casete Blum din catalog (ebanist-slides.js) și constantele aplicației comparate cu ele (D-115).
 *
 *   node --test test/slides-blum.test.js
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine();
["ebanist-slides-data.js", "ebanist-slides.js", "ebanist-ops.js"].forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", f), "utf8"), S, { filename: f }));
const H = S.EBSlides;
const clone = o => JSON.parse(JSON.stringify(o));

describe("date", () => {
  test("42 de sisteme din catalog, cu pagina sursă în KA-150 și coduri unice pe sistem", () => {
    const l = H.list(); assert.ok(l.length >= 40, "sisteme: " + l.length);
    l.forEach(s => { assert.ok(s.pages.length && s.pages.every(p => p >= 180 && p <= 520), s.key); const a = (s.parts || []).map(p => p.art); assert.equal(new Set(a).size, a.length, s.key); });
    assert.ok(l.reduce((n, s) => n + (s.parts || []).length, 0) > 800);
  });
  test("lungimile nominale cresc; MOVENTO are 250…750, TANDEM 19 mm 250…650", () => {
    H.list().forEach(s => { const L = H.lengthsOf(s); for (let i = 1; i < L.length; i++) assert.ok(L[i] > L[i - 1], s.key); });
    const m = H.lengthsOf(H.system("movento_blumotion_s")); assert.deepEqual([m[0], m[m.length - 1]], [250, 750]);
    const t = H.lengthsOf(H.system("tandem19_locking")); assert.deepEqual([t[0], t[t.length - 1]], [250, 650]);
  });
  test("fișa se generează pentru fiecare sistem, în 7 limbi, fără NaN / undefined / [object]", () => {
    H.list().forEach(s => ["ro", "it", "en", "fr", "de", "pl", "es"].forEach(lang => {
      const h = H.sheetHtml(s.key, { lang }); assert.ok(h, s.key); assert.ok(!/NaN|undefined|\[object/.test(h), `${s.key} ${lang}: ${(h.match(/.{30}(NaN|undefined|\[object).{30}/) || [""])[0]}`);
    }));
  });
});

describe("glisiere: constantele aplicației = catalogul", () => {
  test("lățimea sertarului din lemn: MOVENTO și TANDEM 11–16 mm SKW = LW − 42; TANDEM 19 mm SKW = LW − 49 (ded_lat din ebanist-core.js)", () => {
    Object.keys(H.RUNNERS).forEach(k => { const w = H.widthOff(k), id = H.hwIdOf(k); assert.ok(w > 0, k); assert.equal(S.slideById(id).ded_lat, w, `${k}: ded_lat ${S.slideById(id).ded_lat}, catalog ${w}`); });
    assert.equal(H.widthOff("tandem19_locking"), 49); assert.equal(H.widthOff("movento_blumotion_s"), 42); assert.equal(S.slideById("blum_tandem").ded_lat, 42);
  });
  test("pozițiile MOVENTO din motor = tabelul din catalog (p. 419: 37 + 160 / 224 / 256, 243 = 261 − 18)", () => {
    const byNL = H.holesByNL("movento_blumotion_s"), ser = S.HW_DRILL.slide.series.blum_movento;
    Object.keys(byNL).forEach(nl => {
      const row = ser.nl.find(r => +nl >= r[0] && +nl <= r[1]); if (!row) return;
      assert.deepEqual(clone(byNL[nl]), clone(row[2]), "NL " + nl);
    });
  });
  test("seriile noi cad pe seria veche de același fel în motor (alias)", () => {
    Object.keys(H.RUNNERS).forEach(k => assert.ok(S.HW_DRILL.slide.alias[H.hwIdOf(k)], k));
  });
  test("catalogEntries: un articol pe serie, id-uri unice, cu cod-model fără NL", () => {
    const e = H.catalogEntries([]); assert.equal(e.length, Object.keys(H.RUNNERS).length); assert.equal(new Set(e.map(x => x.id)).size, e.length);
    e.forEach(x => { assert.match(x.art, /___/); assert.ok(x.price > 0 && x.chk === 1); });
  });
});

describe("casete metalice: constantele din DRAWSYS față de formulele din catalog (constatări D-115)", () => {
  const f = (key, re) => { const s = H.system(key); return (s.cutting.formulas || []).find(x => re.test(x.piece)); };
  test("LEGRABOX: fund LW − 35, NL − 10 (spate PAL), spate LW − 38, laterale N 66.5 / M 90.5 / K 128.5 / C 177 / F 241", () => {
    const c = H.system("legrabox_pure_M").cutting.constants; assert.deepEqual([c.baseW, c.baseL, c.backW], [-35, -10, -38]);
    const d = vm.runInContext("DRAWSYS.legrabox", S); assert.deepEqual([d.baseW, d.baseL, d.backW], [-35, -10, -38]);
    const hs = { N: "legrabox_pure_N", M: "legrabox_pure_M", K: "legrabox_pure_K", C: "legrabox_pure_C", F: "legrabox_pure_F" };
    Object.keys(hs).forEach(k => { const sh = H.system(hs[k]).cabinet.labeled.sideHeight; if (sh != null) assert.equal(+sh, d.hs[k], k); });
  });
  test("TANDEMBOX antaro: fund LW − 75, NL − 24, spate LW − 87 = aplicația", () => {
    const s = H.system("tandembox_antaro_standard"), d = vm.runInContext("DRAWSYS.tandembox", S);
    assert.ok(JSON.stringify(s.cutting).includes("75") && JSON.stringify(s.cutting).includes("87"));
    assert.deepEqual([d.baseW, d.baseL, d.backW], [-75, -24, -87]);
  });
  test("MERIVOBOX și METABOX nu au încă sistem în aplicație: formulele din catalog sunt în date, nu în DRAWSYS", () => {
    const d = vm.runInContext("DRAWSYS", S); assert.ok(!d.merivobox && !d.metabox);
    assert.ok(H.system("merivobox_standard").cutting.constants.baseW === -51 && H.system("metabox_single_extension"));
  });
});
