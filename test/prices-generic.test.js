/* Ebanist — prețurile generice orientative (D-109, C.7): fișierul de date publicat.
 *
 *   node --test test/prices-generic.test.js
 *
 * Regula: un preț publicat are sursă, dată, TVA declarat și monedă; se leagă de un
 * articol real din catalog; nu are cifre imposibile. Aplicația le arată sub articol,
 * nu le pune în deviz (verificat separat în e2e / manual).
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");

const root = path.join(__dirname, "..");
const doc = JSON.parse(fs.readFileSync(path.join(root, "app", "data", "prices-generic.json"), "utf8"));
const html = fs.readFileSync(path.join(root, "app", "index.html"), "utf8");
const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;

describe("prices-generic.json", () => {
  test("structură", () => {
    assert.equal(doc.schema, 1);
    assert.ok(validDate(doc.updated));
    assert.ok(Array.isArray(doc.items) && doc.items.length > 0);
  });
  test("fiecare hwId există în catalogul din aplicație, o singură dată", () => {
    const seen = new Set();
    for (const it of doc.items) {
      assert.ok(html.includes('{id:"' + it.hwId + '"'), "hwId necunoscut: " + it.hwId);
      assert.ok(!seen.has(it.hwId), "hwId dublat: " + it.hwId);
      seen.add(it.hwId);
      assert.ok(Array.isArray(it.refs) && it.refs.length > 0, it.hwId);
    }
  });
  test("fiecare referință: sursă, dată, TVA incl/excl, monedă, unitate, preț > 0", () => {
    for (const it of doc.items) for (const r of it.refs) {
      const w = it.hwId + " / " + r.source;
      assert.ok(r.source && typeof r.source === "string", w);
      assert.ok(validDate(r.readAt), w + " readAt");
      assert.ok(["incl", "excl"].includes(r.vat), w + " vat");
      assert.match(r.currency, /^[A-Z]{3}$/, w);
      assert.ok(["piece", "pair", "set"].includes(r.unit), w + " unit");
      assert.ok(r.partial === undefined || ["body", "noPlate"].includes(r.partial), w + " partial");
      assert.ok(!r.url || /^https:\/\//.test(r.url), w + " url");
      if (r.lengths) {
        const v = Object.entries(r.lengths);
        assert.ok(v.length > 0, w);
        for (const [mm, p] of v) { assert.ok(+mm > 0 && Number.isInteger(+mm), w + " lungime " + mm); assert.ok(p > 0 && isFinite(p), w + " preț " + mm); }
        assert.equal(r.price, undefined, w + ": ori preț unic, ori pe lungimi");
      } else assert.ok(r.price > 0 && isFinite(r.price), w + " price");
      for (const tr of r.tiers || []) { assert.ok(tr.from > 1 && tr.price > 0, w + " tier"); assert.ok(tr.price < r.price, w + " tier mai mic decât prețul de bază"); }
    }
  });
  test("prețurile pe lungime nu scad când lungimea crește", () => {
    for (const it of doc.items) for (const r of it.refs) if (r.lengths) {
      const e = Object.entries(r.lengths).map(([k, v]) => [+k, +v]).sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < e.length; i++) assert.ok(e[i][1] >= e[i - 1][1], it.hwId + ": " + e[i - 1] + " → " + e[i]);
    }
  });
  test("nimic secret în fișier: fără cod de client, parolă, listino privat", () => {
    const txt = JSON.stringify(doc).toLowerCase();
    for (const bad of ["password", "parola", "token", "pin\"", "dispano", "centro legno", "listino"]) assert.ok(!txt.includes(bad), bad);
  });
  test("aplicația nu pune prețurile generice în deviz", () => {
    /* GENERIC_PRICES se citește numai în paintGenericPrices / genRefLine; hwItem (sursa devizului) nu le atinge */
    const uses = html.split("\n").map((l, i) => [i, l]).filter(([, l]) => l.includes("GENERIC_PRICES"));
    const fnStart = html.indexOf("let GENERIC_PRICES"), fnEnd = html.indexOf("function supCatalog(){");
    assert.ok(fnStart > 0 && fnEnd > fnStart);
    const outside = html.slice(0, fnStart).includes("GENERIC_PRICES") || html.slice(fnEnd).includes("GENERIC_PRICES");
    assert.equal(outside, false, "GENERIC_PRICES folosit în afara blocului de referință: " + uses.length + " apariții");
    const hw = html.slice(html.indexOf("function hwItem(cat)"), html.indexOf("function hwItem(cat)") + 400);
    assert.ok(!hw.includes("GENERIC"), "hwItem nu trebuie să citească prețuri generice");
  });
});
