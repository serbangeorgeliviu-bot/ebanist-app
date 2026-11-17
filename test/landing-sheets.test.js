/* Widgetul „Câte plăci îți trebuie?" de pe landing (5.79.0): aceleași chei în toate limbile, secțiunea în toate paginile, cifrele din ebanist-nest.js */
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const R = p => path.join(__dirname, "..", p);
const LANGS = ["en", "ro", "it", "fr", "de", "es", "pl"], HOME = { en: "index.html" };
const keys = l => Object.keys(JSON.parse(fs.readFileSync(R(`site-src/i18n/${l}.json`), "utf8"))).filter(k => k.startsWith("sheets."));

test("chei sheets.* identice în cele 7 limbi, fără valori goale", () => {
  const ref = keys("en"); assert.ok(ref.length >= 20);
  for (const l of LANGS) {
    assert.deepStrictEqual(keys(l).sort(), ref.slice().sort(), l);
    const d = JSON.parse(fs.readFileSync(R(`site-src/i18n/${l}.json`), "utf8"));
    for (const k of ref) assert.ok(String(d[k]).trim(), `${l} ${k}`);
    for (const k of ["sheets.res", "sheets.use", "sheets.pcs"]) for (const ph of (d[k].match(/\{\w+\}/g) || []))
      assert.ok(JSON.parse(fs.readFileSync(R("site-src/i18n/en.json"), "utf8"))[k].includes(ph), `${l} ${k} ${ph}`);
  }
});
test("fiecare pagină de start are secțiunea și scriptul", () => {
  for (const l of LANGS) {
    const h = fs.readFileSync(R(l === "en" ? "index.html" : `${l}/index.html`), "utf8");
    assert.match(h, /id="sheets"/, l); assert.match(h, /\/site\/js\/sheets\.js/, l);
  }
});
test("5 piese standard încap pe o placă 2800×2070 cu aceleași cifre ca în aplicație", () => {
  const N = new Function(fs.readFileSync(R("app/ebanist-nest.js"), "utf8") + "\nreturn globalThis.EBNest;")();
  const r = N.nest([{ lung: 800, larg: 400, pz: 6 }, { lung: 720, larg: 560, pz: 4 }, { lung: 1200, larg: 300, pz: 2 }], 2800, 2070, 4, null);
  assert.strictEqual(r.panels.length, 1); assert.strictEqual(r.panels[0].rects.length, 12);
});
