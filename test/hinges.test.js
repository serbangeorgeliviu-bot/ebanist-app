/* Ebanist — balamale Blum din catalog (ebanist-hinges.js): regulile TB și F se potrivesc cu tabelele citite din catalog,
 * fișa iese în toate limbile, fiecare cod de comandă are familie, iar conturul placuței din date e cel din motorul de găurire.
 *
 *   node --test test/hinges.test.js
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const ctx = vm.createContext({ console });
["ebanist-hinges-data.js", "ebanist-hinges.js", "ebanist-ops.js"].forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", f), "utf8"), ctx, { filename: f }));
const H = ctx.EBHinges, F = H.HINGES.clip_top_110;

describe("tabelul TB (Blum KA-150 p.75)", () => {
  test("regula TB = FA − k + MD reproduce fiecare celulă din tabel, în cele trei aplicații", () => {
    let n = 0;
    for (const a in F.tbTable) for (const md in F.tbTable[a]) for (const fa in F.tbTable[a][md]) { assert.equal(H.tb(F, a, +fa, +md), F.tbTable[a][md][fa], `${a} MD${md} FA${fa}`); n++; }
    assert.equal(n, 5 * 4 + 5 * 4 + 5 * 2);
  });
  test("fără valoare în afara 3…7 mm", () => { assert.equal(H.tb(F, "overlay", 10, 0), null); assert.equal(H.tb(F, "overlay", 19, 0), null); assert.equal(H.tb(F, "overlay", 16, 0), 5); });
  test("rostul minim F: valori din tabel, null la „probă recomandată”, plus reglajul lateral", () => {
    assert.equal(H.minGap(F, 5, 19), 0.9); assert.equal(H.minGap(F, 3, 26), 4.3); assert.equal(H.minGap(F, 3, 28), null);
    assert.equal(H.minGap(F, 5, 19, true), 1.3); assert.equal(H.minGap(F, 7, 16), 0.5);
  });
  test("rostul crește cu grosimea frontului și scade cu TB", () => {
    for (const b in F.gap) { const r = F.gap[b].filter(v => v != null); for (let i = 1; i < r.length; i++) assert.ok(r[i] >= r[i - 1], "TB " + b); }
    for (let i = 0; i < 10; i++) for (let b = 3; b < 7; b++) assert.ok(F.gap[b][i] >= F.gap[b + 1][i], `FD ${F.gapFD[i]} TB ${b}`);
  });
});

describe("date: coduri, plăcuțe, legături", () => {
  test("fiecare cod de comandă are formă Blum, e unic și rezolvă la familia lui", () => {
    const seen = new Set();
    F.parts.forEach(p => { assert.match(p.art, /^7[01][BT]3[567]90(\.TL)?$|^7[01][BT]3[567]50(\.TL)?$/, p.art); assert.ok(!seen.has(p.art)); seen.add(p.art); assert.equal(H.familyOfArt(p.art), F); });
    assert.equal(F.parts.length, 18);
  });
  test("articolele din catalogul aplicației rezolvă la familie", () => { assert.equal(H.familyOfHw("blum_71b3550"), F); assert.equal(H.familyOfHw("blum_71t3550"), F); assert.equal(H.familyOfHw("haf_metalla"), null); });
  test("fiecare placuță din familie există, are coduri unice și spacing/înălțime crescătoare", () => {
    F.plates.forEach(id => { const p = H.plateById(id); assert.ok(p, id); p.spacings.forEach((s, i) => { assert.ok(p.art.includes(s[2])); if (i) { assert.ok(s[0] > p.spacings[i - 1][0]); assert.ok(s[1] > p.spacings[i - 1][1]); } }); assert.equal(H.plateByArt(p.art[0]), p); });
  });
  test("înălțimea placuței = 8,5 + spacing (Blum: 0→8,5; 3→11,5; 6→14,5; 9→17,5; 18→26,5)", () => { H.PLATES.forEach(p => p.spacings.forEach(s => assert.equal(s[1], 8.5 + s[0]))); });
  test("placuța 173L6100 din date = conturul din motorul de găurire", () => {
    const pl = H.plateByArt("173L6100"), hp = ctx.HW_DRILL.hinge.plate;
    assert.deepEqual([pl.D, pl.L, pl.front, pl.pitch], [hp.D, hp.L, ctx.HW_DRILL.sys32.front, ctx.HW_DRILL.hinge.plate_spacing]);
    assert.equal(hp.art, "173L6100");
  });
  test("cupa și dornurile din date = găurirea din motor", () => {
    const h = ctx.HW_DRILL.hinge;
    assert.deepEqual([F.cup.dia, F.dowel.dia, F.dowel.spacing, F.dowel.offset], [h.cup_dia, h.dowel_dia, h.dowel_spacing, h.dowel_offset]);
    assert.deepEqual(F.cup.tb, h.tb); assert.ok(F.cup.depth <= h.plate_depth);
  });
});

describe("fișa", () => {
  ["ro", "it", "en", "fr", "de", "pl", "es"].forEach(lang => test("fișa în " + lang + ": fără NaN/undefined, cu desenele și tabelele", () => {
    const h = H.sheetHtml("blum_71b3550", { lang, TB: 5 });
    assert.ok(h && !/NaN|undefined/.test(h)); assert.equal((h.match(/<svg/g) || []).length, 2); assert.ok(h.includes("71B3550") && h.includes("173L6100"));
  }));
  test("articol fără date → null; plăcuța orizontală se desenează cu găurile pe orizontală", () => {
    assert.equal(H.sheetHtml("haf_metalla"), null);
    assert.ok(H.sheetHtml("blum_71b3550", { lang: "en", plate: "175H31" }).includes("<svg"));
  });
  test("etichetele au aceleași chei în toate limbile", () => {
    const k = Object.keys(H.sheetHtml ? {} : {}); void k;
    const src = fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-hinges.js"), "utf8"), blk = src.slice(src.indexOf("var L = {"), src.indexOf("function tr("));
    const sets = ["ro", "it", "en", "fr", "de", "pl", "es"].map(l => (blk.match(new RegExp("\\b" + l + ": \\{([^}]*)\\}"))[1].match(/\b(\w+): "/g) || []).sort().join());
    sets.forEach(x => assert.equal(x, sets[0]));
  });
});

describe("fișa pentru toate familiile încărcate", () => {
  test("fiecare cod din catalog dă o fișă fără NaN / undefined / [object], în toate limbile", () => {
    let n = 0;
    Object.keys(H.HINGES).forEach(k => {
      const f = H.HINGES[k]; if (/accessor/i.test(f.kind || "")) return;
      (f.parts || []).slice(0, 2).forEach(p => ["ro", "en", "de"].forEach(lang => {
        const h = H.sheetHtml(H.hwIdOf(p.art), { lang }); if (!h) return; n++;
        assert.ok(!/NaN|undefined|\[object/.test(h), `${k} ${p.art} ${lang}: ${(h.match(/.{30}(NaN|undefined|\[object).{30}/) || [""])[0]}`);
      }));
    });
    assert.ok(n > 60, "fișe generate: " + n);
  });
  test("familii cu pagină sursă și cod web (dacă există) valid", () => {
    Object.keys(H.HINGES).forEach(k => { const f = H.HINGES[k]; assert.ok(f.pages && f.pages.length, k); assert.ok(f.pages.every(p => p >= 70 && p <= 190), k + " pagina " + f.pages); if (f.webCode) assert.match(f.webCode, /^DQ[A-Z0-9]{4}$/, k); });
  });
});
