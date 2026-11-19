/* Ebanist — FAZA H.1: indexul unic al feroneriei și căutarea (ebanist-hwindex.js, pur).
 *
 *   node --test test/hwindex.test.js
 *
 * Ce trebuie să rămână adevărat:
 *  - fiecare categorie are un slot; ce nu e în tabel cade în «altele», nu dispare;
 *  - căutarea nu ține cont de diacritice și de majuscule; toți termenii trebuie să existe; codul exact se pune primul;
 *  - fațetele numără rezultatele ținând cont de celelalte filtre, nu de ale lor;
 *  - indexul nu pierde articole (numărul = suma pe categorii) și nu produce dubluri;
 *  - etichetele sloturilor există în toate cele 7 limbi, cu aceleași chei.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path"), vm = require("vm");
/* ca restul testelor: modulele din app/ se încarcă într-un context (app/ poate fi tratat ca ESM de require) */
const ctx = { console }; ctx.globalThis = ctx; vm.createContext(ctx);
["ebanist-hwindex.js", "ebanist-hwindex-i18n.js"].forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", f), "utf8"), ctx, { filename: f }));
const X = vm.runInContext("EBHwIndex", ctx), I18N = vm.runInContext("HWINDEX_I18N", ctx);

const L7 = s => ({ it: s, ro: s, en: s, fr: s, de: s, pl: s, es: s });
const DB = {
  cern: [{ id: "h1", brand: "Hettich", n: L7("Sensys 8645i 110° suprapunere totală"), art: "9071234", price: 0 },
         { id: "b1", brand: "Blum", n: { it: "CLIP top BLUMOTION 110°", ro: "CLIP top BLUMOTION 110°", en: "CLIP top BLUMOTION 110°" }, art: "71B3550" }],
  guida: [{ id: "g1", brand: "Häfele", n: "Matrix Runner UM A 50 kg", art: "421.50.123" }],
  lift: [{ id: "l1", brand: "Blum", n: L7("AVENTOS HK top"), art: "22K2310" }],
  aw: [{ id: "a1", brand: "—", n: L7("Profil anti-curbare"), art: "—" }],
  neverheard: [{ id: "n1", brand: "X", n: L7("Ceva nou"), art: "1" }]
};
const CATS = [["cern", "hwCern"], ["guida", "hwGuida"], ["lift", "hwLift"], ["aw", "hwAW"]];

describe("Sloturi", () => {
  test("categoriile cunoscute au slot, restul «altele»", () => {
    assert.equal(X.slotOf("cern"), "balamale"); assert.equal(X.slotOf("lift"), "ridicare"); assert.equal(X.slotOf("corner"), "colt");
    assert.equal(X.slotOf("conn"), "imbinari"); assert.equal(X.slotOf("susp"), "suspendare"); assert.equal(X.slotOf("pushd"), "sertare");
    assert.equal(X.slotOf("nu_exista"), "altele");
  });
  test("fiecare slot din tabel e în lista SLOTS și are cheie de etichetă", () => {
    const ids = new Set(X.SLOTS.map(s => s.id));
    Object.values(X.SLOT_OF).forEach(v => assert.ok(ids.has(v), v));
    assert.ok(ids.has("altele"));
    X.SLOTS.forEach(s => assert.ok(s.key && /^hxSlot/.test(s.key)));
  });
  test("etichetele sloturilor: aceleași chei în cele 7 limbi, toate nevide", () => {
    const langs = Object.keys(I18N).sort();
    assert.equal(JSON.stringify(langs), JSON.stringify(["de", "en", "es", "fr", "it", "pl", "ro"]));
    const k0 = Object.keys(I18N.ro).sort();
    langs.forEach(l => assert.equal(JSON.stringify(Object.keys(I18N[l]).sort()), JSON.stringify(k0), l));
    X.SLOTS.forEach(s => langs.forEach(l => assert.ok(I18N[l][s.key] && I18N[l][s.key].length > 2, l + " " + s.key)));
  });
});

describe("Indexul", () => {
  const idx = X.build(DB, CATS);
  test("un articol pe intrare, fără pierderi; categoria necunoscută e raportată", () => {
    assert.equal(idx.length, 6);
    assert.equal(JSON.stringify(idx.unknownCats), JSON.stringify(["neverheard"]));
    assert.equal(idx.find(e => e.id === "n1").slot, "altele");
  });
  test("nume în toate limbile (cade pe it/en), marca «—» devine goală, codul «—» devine gol", () => {
    const a = idx.find(e => e.id === "a1"); assert.equal(a.brand, ""); assert.equal(a.art, "");
    const b = idx.find(e => e.id === "b1"); assert.equal(b.names.fr, "CLIP top BLUMOTION 110°");
    X.LANGS.forEach(l => idx.forEach(e => assert.ok(e.names[l] && e.names[l].length > 0, l + " " + e.id)));
  });
  test("articolele proprii (hwAdd) intră și se marchează", () => {
    const j = X.build(DB, CATS, { hwAdd: [{ id: "own1", cat: "cern", brand: "Propriu", n: "Balama mea" }] });
    assert.equal(j.length, 7); assert.equal(j.find(e => e.id === "own1").own, true);
  });
  test("nicio dublură pe (categorie, id)", () => {
    const dup = X.build({ cern: [DB.cern[0], DB.cern[0]] }, CATS); assert.equal(dup.length, 1);
  });
});

describe("Căutarea", () => {
  const idx = X.build(DB, CATS);
  test("norm: fără diacritice și majuscule", () => {
    assert.equal(X.norm("Häfele ȘI Țăran — 110°"), "hafele si taran 110");
  });
  test("fără diacritice: «hafele» găsește «Häfele», «HAFELE» la fel", () => {
    assert.equal(X.search(idx, "hafele").length, 1); assert.equal(X.search(idx, "HÄFELE").length, 1);
  });
  test("toți termenii trebuie să existe: «blum 110» da, «blum hettich» nu", () => {
    assert.equal(JSON.stringify(X.search(idx, "blum 110").map(e => e.id)), JSON.stringify(["b1"]));
    assert.equal(X.search(idx, "blum hettich").length, 0);
  });
  test("codul exact se pune primul, urmat de potrivirile pe nume", () => {
    const r = X.search(idx, "71B3550"); assert.equal(r[0].id, "b1");
    assert.equal(X.search(idx, "22k2310")[0].id, "l1");
  });
  test("interogare goală = tot indexul, în ordine; filtrele taie", () => {
    assert.equal(X.search(idx, "").length, 6);
    assert.equal(JSON.stringify(X.search(idx, "", { slot: "balamale" }).map(e => e.id)), JSON.stringify(["h1", "b1"]));
    assert.equal(JSON.stringify(X.search(idx, "", { brand: "Blum" }).map(e => e.id)), JSON.stringify(["b1", "l1"]));
    assert.equal(JSON.stringify(X.search(idx, "", { cat: "guida" }).map(e => e.id)), JSON.stringify(["g1"]));
  });
  test("text în filtru = aceeași căutare", () => {
    assert.equal(JSON.stringify(X.search(idx, null, { text: "aventos" }).map(e => e.id)), JSON.stringify(["l1"]));
  });
});

describe("Fațetele", () => {
  const idx = X.build(DB, CATS);
  test("numără fiecare dimensiune ținând cont de celelalte filtre, nu de ale ei", () => {
    const f = X.facets(idx, { slot: "balamale" });
    assert.equal(f.brand.Hettich, 1); assert.equal(f.brand.Blum, 1);
    assert.equal(f.slot.balamale, 2, "fațeta slotului ignoră filtrul de slot");
    assert.equal(f.slot.ridicare, 1);
    const g = X.facets(idx, { brand: "Blum" });
    assert.equal(g.slot.balamale, 1); assert.equal(g.slot.ridicare, 1); assert.equal(g.slot.sertare, undefined);
  });
  test("cu text: numără numai ce se potrivește", () => {
    const f = X.facets(idx, { text: "110" });
    assert.equal(f.brand.Hettich, 1); assert.equal(f.brand.Blum, 1);
  });
});
