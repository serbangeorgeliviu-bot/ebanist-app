/* Ebanist — picioarele reglabile din catalog (categoria `pied`), U.14 / D-117.
 *
 *   node --test test/feet.test.js
 *
 * Catalogul e date. Ce trebuie să rămână adevărat:
 *  - ID-uri unice; fiecare articol are nume în toate cele 7 limbi și cod;
 *  - gama de reglaj (`range`) e [min, max] cu min < max; sarcina e pozitivă;
 *  - articolele Hettich Korrekt și Häfele din ofertele de furnizor nu au preț (se completează), nu se inventează;
 *  - AXILO 78: codurile 637.76.351/.352/.357 cu gamele din pagina Häfele și din oferte; `foot` = gama (base = minim, travel = max − min);
 *  - avertismentul de înălțime există în toate limbile.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "app", "index.html"), "utf8");
const a = src.indexOf("\n pied:["), b = src.indexOf("\n bin:[", a);
const items = vm.runInNewContext("[" + src.slice(a + "\n pied:[".length, b).replace(/\],?\s*$/, "") + "]");
const LANGS = ["it", "ro", "en", "fr", "de", "pl", "es"];
const byId = Object.fromEntries(items.map(i => [i.id, i]));

describe("catalog picioare", () => {
  test("ID-uri unice, nume în 7 limbi, cod", () => {
    assert.equal(new Set(items.map(i => i.id)).size, items.length);
    items.forEach(i => {
      LANGS.forEach(l => assert.ok(i.n && i.n[l] && i.n[l].length > 5, i.id + " " + l));
      assert.ok(typeof i.art === "string" && i.art.length, i.id);
    });
  });
  test("gama de reglaj și sarcina sunt coerente", () => {
    items.filter(i => i.range).forEach(i => {
      assert.equal(i.range.length, 2); assert.ok(i.range[0] > 0 && i.range[0] < i.range[1], i.id);
    });
    items.filter(i => i.load != null).forEach(i => assert.ok(i.load > 0, i.id));
  });
  test("Hettich Korrekt: 61852, 61853, 70152, cu gamele din oferte, 450 kg, fără preț", () => {
    const k = { het_korrekt_61852: [119, 155], het_korrekt_61853: [139, 175], het_korrekt_70152: [99, 135] };
    Object.keys(k).forEach(id => {
      assert.equal(byId[id].range.join(), k[id].join()); assert.equal(byId[id].load, 450); assert.equal(byId[id].price, 0);
      assert.equal(byId[id].art, id.replace("het_korrekt_", ""));
    });
  });
  test("Häfele 637.24.022 / .024: ≈300 kg, fără gamă inventată, fără preț", () => {
    ["haf_ins_63724022", "haf_ins_63724024"].forEach(id => { assert.equal(byId[id].load, 300); assert.equal(byId[id].range, undefined); assert.equal(byId[id].price, 0); });
    assert.equal(byId.haf_ins_63724022.art, "637.24.022"); assert.equal(byId.haf_ins_63724024.art, "637.24.024");
  });
  test("AXILO 78: coduri, game și cotele piciorului derivate din gamă", () => {
    const k = { haf_axilo_351: ["637.76.351", 53, 80], haf_axilo_352: ["637.76.352", 70, 100], haf_axilo_357: ["637.76.357", 190, 220] };
    Object.keys(k).forEach(id => {
      const x = byId[id], [art, a, b] = k[id];
      assert.equal(x.art, art); assert.equal(x.range.join(), [a, b].join());
      assert.equal(x.foot.base, a); assert.equal(x.foot.travel, b - a); assert.equal(x.foot.dia, 78); assert.equal(x.foot.mount, "under");
      assert.equal(x.price, 0);
    });
    assert.equal(byId.haf_axilo_352.load, 80); assert.equal(byId.haf_axilo_357.load, 150); assert.equal(byId.haf_axilo_351.load, undefined);
  });
  test("Camar nu mai e în catalog (luat din greșeală)", () => assert.equal(byId.camar_300, undefined));
  test("avertismentul de gamă există în toate limbile", () => {
    LANGS.forEach(l => assert.ok(new RegExp('Object\\.assign\\(I18N\\.' + l + ',\\{"wFootRange"').test(src), l));
  });
});
