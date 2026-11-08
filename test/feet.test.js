/* Ebanist — picioarele reglabile din catalog (categoria `pied`), U.14 / D-117.
 *
 *   node --test test/feet.test.js
 *
 * Catalogul e date. Ce trebuie să rămână adevărat:
 *  - ID-uri unice; fiecare articol are nume în toate cele 7 limbi și cod;
 *  - gama de reglaj (`range`) e [min, max] cu min < max; sarcina e pozitivă;
 *  - articolele Hettich Korrekt și Häfele din ofertele de furnizor nu au preț (se completează), nu se inventează;
 *  - Häfele 637.42.950 / 637.42.905 (pagina FC 6.74): picioarele cadrului, cu `foot` (prindere laterală); AXILO 78 (637.76.35x): picioare de soclu cu `range`, fără `foot`;
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
  test("picioarele cadrului: 637.42.950, .942 și .905, prindere laterală, reglaj 20, panou de 19, talpa 4,5", () => {
    const a = byId.haf_42950, c = byId.haf_42942, b = byId.haf_42905;
    assert.equal(a.art, "637.42.950"); assert.equal(a.load, 150); assert.equal(a.foot.dia, 38);
    assert.equal(c.art, "637.42.942"); assert.equal(c.load, 150); assert.equal(c.foot.dia, 38);
    assert.equal(b.art, "637.42.905"); assert.equal(b.load, 100); assert.equal(b.foot.dia, 28);
    [a, b, c].forEach(x => { assert.equal(x.foot.mount, "side"); assert.equal(x.foot.travel, 20); assert.equal(x.foot.base, 4.5); assert.equal(x.foot.plate, 50);
      assert.equal(x.foot.screw, 4); assert.equal(x.foot.bracket, 32); assert.equal(x.foot.panel, 19); assert.equal(x.price, 0); });
  });
  test("637.42.922 (numai șuruburi) și 637.42.932 (dublu, 300 kg): în catalog, fără `foot` (secțiuni diferite)", () => {
    assert.equal(byId.haf_42922.art, "637.42.922"); assert.equal(byId.haf_42922.load, 150); assert.equal(byId.haf_42922.foot, undefined);
    assert.equal(byId.haf_42932.art, "637.42.932"); assert.equal(byId.haf_42932.load, 300); assert.equal(byId.haf_42932.foot, undefined);
  });
  test("AXILO 78 (FC 6.25): toate cele 7 coduri cu gamele din tabel, 150 kg pe picior, fără `foot`", () => {
    const k = { 351: [53, 80], 352: [70, 100], 353: [90, 120], 354: [115, 145], 355: [140, 170], 356: [170, 200], 357: [190, 220] };
    Object.keys(k).forEach(c => {
      const x = byId["haf_axilo_" + c];
      assert.ok(x, c); assert.equal(x.art, "637.76." + c); assert.equal(x.range.join(), k[c].join());
      assert.equal(x.load, 150); assert.equal(x.foot, undefined); assert.equal(x.price, 0);
    });
  });
  test("AXILO: piciorul de profil jos 637.76.460 (soclu 35–48, plăcuță Ø35 inclusă) și plăcuța 637.76.334 (cod din ofertă)", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "app", "index.html"), "utf8");
    const pa = src.slice(src.indexOf(" picacc:["), src.indexOf(" feltro:["));
    ["637.76.460", "637.76.334", "637.76.422", "637.76.423", "637.76.424"].forEach(c => assert.ok(pa.includes('art:"' + c + '"'), c));
  });
  test("Camar 300 nu e în catalog (nu e articol Häfele)", () => assert.equal(byId.camar_300, undefined));
  test("avertismentul de gamă există în toate limbile", () => {
    LANGS.forEach(l => assert.ok(new RegExp('Object\\.assign\\(I18N\\.' + l + ',\\{"wFootRange"').test(src), l));
  });
});
