/* Ebanist — import CSV de prețuri private de furnizor (D-109, varianta A).
 *
 *   node --test test/suppliers.test.js
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path"), fs = require("fs"), vm = require("vm");
/* ca restul modulelor din app/: încărcat prin vm (rădăcina repo-ului e "type":"module") */
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-suppliers.js"), "utf8"), ctx, { filename: "ebanist-suppliers.js" });
const S = ctx.EBSuppliers;
const J = o => JSON.parse(JSON.stringify(o));     // obiectele din vm au alt prototip: se compară ca JSON

const csv = (...lines) => lines.join("\r\n") + "\r\n";

describe("parseNumber", () => {
  test("zecimale cu virgulă sau punct, mii, simboluri", () => {
    assert.equal(S.parseNumber("4,05"), 4.05);
    assert.equal(S.parseNumber("4.05"), 4.05);
    assert.equal(S.parseNumber("1.234,56"), 1234.56);
    assert.equal(S.parseNumber("1,234.56"), 1234.56);
    assert.equal(S.parseNumber("€ 4,05"), 4.05);
    assert.equal(S.parseNumber("4,05 €"), 4.05);
    assert.equal(S.parseNumber("1.234.567"), 1234567);
  });
  test("ambiguu sau invalid → NaN (nu ghicim)", () => {
    assert.ok(Number.isNaN(S.parseNumber("1,234")));
    assert.ok(Number.isNaN(S.parseNumber("abc")));
    assert.ok(Number.isNaN(S.parseNumber("1,2,3")));
    assert.ok(Number.isNaN(S.parseNumber("")));
  });
});

describe("normalizări", () => {
  test("TVA", () => {
    ["incl", "TTC", "brut", "Cu TVA", "IVA inclusa", "gross"].forEach(v => assert.equal(S.normVat(v), "incl", v));
    ["excl", "HT", "net", "Fără TVA", "senza IVA", "netto"].forEach(v => assert.equal(S.normVat(v), "excl", v));
    ["", "poate", "21"].forEach(v => assert.equal(S.normVat(v), null, v));
  });
  test("monedă", () => {
    assert.equal(S.normCurrency("€"), "EUR"); assert.equal(S.normCurrency("lei"), "RON");
    assert.equal(S.normCurrency("chf"), "CHF"); assert.equal(S.normCurrency(""), null);
    assert.equal(S.normCurrency("xx"), null);
  });
  test("data", () => {
    assert.equal(S.normDate("2026-11-01"), "2026-11-01");
    assert.equal(S.normDate("01.11.2026"), "2026-11-01");
    assert.equal(S.normDate("1/11/2026"), "2026-11-01");
    assert.equal(S.normDate("31.02.2026"), null);
    assert.equal(S.normDate(""), "");
    assert.equal(S.normDate("ieri"), null);
  });
});

describe("importCSV", () => {
  const H = "art;name;price;vat;currency;readAt;source";
  test("rând valid; ghilimele, BOM, CRLF", () => {
    const r = S.importCSV("﻿" + csv(H, '71B3550;"CLIP top; BLUMOTION";4,05;excl;EUR;01.11.2026;Oferta Nice'));
    assert.equal(r.ok, true);
    assert.equal(r.items.length, 1);
    const it = r.items[0];
    assert.deepEqual([it.art, it.name, it.price, it.vat, it.currency, it.readAt, it.source],
      ["71B3550", "CLIP top; BLUMOTION", 4.05, "excl", "EUR", "2026-11-01", "Oferta Nice"]);
  });
  test("delimitator detectat: virgulă și tab", () => {
    assert.equal(S.importCSV(csv("art,price,vat,currency", "71B3550,4.05,incl,EUR")).items[0].price, 4.05);
    assert.equal(S.importCSV(csv("art\tprice\tvat\tcurrency", "71B3550\t4,05\tincl\tEUR")).items[0].price, 4.05);
  });
  test("antete în română/italiană/franceză", () => {
    const r = S.importCSV(csv("cod;preț;TVA;monedă", "71B3550;4,05;fără TVA;EUR"));
    assert.equal(r.ok, true);
    assert.equal(r.items[0].vat, "excl");
    assert.equal(S.importCSV(csv("codice;prezzo;iva;valuta", "71B3550;4,05;IVA inclusa;EUR")).items[0].vat, "incl");
  });
  test("fără preț = necunoscut, nu intră și nu e eroare", () => {
    const r = S.importCSV(csv(H, "71B3550;x;;excl;EUR;;"));
    assert.equal(r.items.length, 0); assert.equal(r.unknown, 1); assert.equal(r.errors.length, 0);
  });
  test("TVA sau monedă lipsă pe rând → respins", () => {
    const r = S.importCSV(csv(H, "A1;x;4,05;;EUR;;", "A2;x;4,05;excl;;;", "A3;x;4,05;excl;EUR;;"));
    assert.deepEqual(J(r.errors.map(e => e.code)), ["vat", "cur"]);
    assert.equal(r.items.length, 1);
  });
  test("preț ≤ 0, ambiguu sau text → respins cu linia corectă", () => {
    const r = S.importCSV(csv(H, "A1;x;0;excl;EUR;;", "A2;x;1,234;excl;EUR;;", "A3;x;gratis;excl;EUR;;"));
    assert.deepEqual(J(r.errors.map(e => [e.line, e.code])), [[2, "price"], [3, "price"], [4, "price"]]);
  });
  test("rând fără cod → respins; dată invalidă → respins", () => {
    const r = S.importCSV(csv(H, ";x;4,05;excl;EUR;;", "A2;x;4,05;excl;EUR;31.02.2026;"));
    assert.deepEqual(J(r.errors.map(e => e.code)), ["key", "date"]);
  });
  test("data lipsă = data importului; nu se inventează alta", () => {
    const r = S.importCSV(csv(H, "A1;x;4,05;excl;EUR;;"), { today: "2026-11-01" });
    assert.equal(r.items[0].readAt, "2026-11-01");
  });
  test("coloane obligatorii lipsă → fișier respins, cu lista", () => {
    const r = S.importCSV(csv("art;price", "A1;4,05"));
    assert.equal(r.ok, false); assert.equal(r.reason, "cols"); assert.deepEqual(J(r.missing), ["vat", "currency"]);
    assert.equal(S.importCSV("art;price;vat;currency\r\n").reason, "empty");
  });
  test("cheie duplicată în fișier: ultima câștigă și se numără", () => {
    const r = S.importCSV(csv(H, "71B3550;x;4,05;excl;EUR;;", "71B3550;x;3,90;excl;EUR;;"));
    assert.equal(r.items.length, 1); assert.equal(r.items[0].price, 3.9); assert.equal(r.duplicates, 1);
  });
  test("modelul de fișier se importă fără rânduri (nicio cifră inventată)", () => {
    const r = S.importCSV(S.templateCSV());
    assert.equal(r.ok, true); assert.equal(r.items.length, 0); assert.equal(r.unknown, 1);
  });
});

describe("matchCatalog", () => {
  const cat = [{ id: "blum_71b3550", art: "71B3550 + 173L6100" }, { id: "haf_minifix", art: "262.26.033 + boulon" }, { id: "x1", art: "999.99.001" }, { id: "x2", art: "999.99.001" }];
  test("cod simplu, cu puncte și litere mici; id explicit; ambiguu rămâne nelegat", () => {
    const items = [{ art: "71b3550" }, { art: "26226033" }, { art: "262.26.033" }, { hwId: "x1", art: "" }, { art: "999.99.001" }, { art: "nu-exista" }];
    const n = S.matchCatalog(items, cat);
    assert.equal(items[0].hwId, "blum_71b3550");
    assert.equal(items[1].hwId, "haf_minifix");
    assert.equal(items[2].hwId, "haf_minifix");
    assert.equal(items[4].hwId, undefined);
    assert.equal(items[5].hwId, undefined);
    assert.equal(n, 4);
  });
});

describe("furnizori: îmbinare, căutare, export", () => {
  const mk = (art, price) => S.importCSV(csv("art;price;vat;currency", art + ";" + price + ";excl;EUR"), { today: "2026-11-01" }).items;
  test("același furnizor se actualizează, nu se dublează; rândul cu aceeași cheie se înlocuiește", () => {
    let L = S.mergeSupplier([], { name: "Dispano Nice" }, mk("71B3550", "4,05").concat(mk("560H5000B", "20,10")), "2026-11-01");
    L = S.mergeSupplier(L, { name: "Dispano Nice" }, mk("71B3550", "3,90"), "2026-11-02");
    assert.equal(L.length, 1);
    assert.equal(L[0].id, "dispano-nice");
    assert.equal(L[0].items.length, 2);
    assert.equal(S.find(L, "dispano-nice", "71B3550").price, 3.9);
    assert.equal(S.find(L, "dispano-nice", "560h5000b").price, 20.1);
    assert.equal(S.find(L, "dispano-nice", "lipsa"), null);
    assert.deepEqual(J(S.removeSupplier(L, "dispano-nice")), []);
  });
  test("export → import dă aceleași prețuri (virgulă zecimală, ghilimele)", () => {
    const sup = { id: "s", name: "S", items: [{ key: "art:a1", hwId: null, art: "A1", name: 'Ghid "TANDEM"; 500', price: 29.12, vat: "incl", currency: "EUR", readAt: "2026-11-01", source: "Elmama", pack: "", url: "" }] };
    const back = S.importCSV(S.toCSV(sup)).items[0];
    assert.equal(back.price, 29.12); assert.equal(back.name, 'Ghid "TANDEM"; 500'); assert.equal(back.vat, "incl");
  });
  test("vechimea prețului în zile", () => {
    assert.equal(S.ageDays("2026-11-01", "2026-11-11"), 10);
    assert.equal(S.ageDays("nu", "2026-11-11"), null);
  });
});

describe("confidențialitate: prețurile private nu pleacă în cloud", () => {
  test("stripPrivate scoate `suppliers`, păstrează restul", () => {
    const out = J(S.stripPrivate({ lang: "it", suppliers: [{ id: "x" }], hwOvr: { a: 1 } }));
    assert.equal("suppliers" in out, false); assert.deepEqual(out.hwOvr, { a: 1 }); assert.equal(out.lang, "it");
  });
  test("keepPrivate: setările din cloud nu șterg prețurile locale", () => {
    const next = S.keepPrivate({ lang: "ro", hwOvr: {} }, { suppliers: [{ id: "x" }] });
    assert.deepEqual(J(next.suppliers), [{ id: "x" }]);
    assert.equal("suppliers" in S.keepPrivate({ a: 1 }, {}), false);
  });
  test("index.html folosește ambele funcții în sincronizarea setărilor", () => {
    const html = fs.readFileSync(path.join(__dirname, "..", "app", "index.html"), "utf8");
    const fn = html.slice(html.indexOf("function settingsPayload"), html.indexOf("async function syncSettings"));
    assert.match(fn, /EBSuppliers\.stripPrivate/);
    const sync = html.slice(html.indexOf("async function syncSettings"), html.indexOf("function applyRemoteProject"));
    assert.match(sync, /EBSuppliers\.keepPrivate/);
  });
});
