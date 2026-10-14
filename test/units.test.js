/* Ebanist — unități mm / inch (D-81).
 *   node --test test/units.test.js
 * Motorul rămâne în mm; inch există numai la citire și la afișare.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path"), vm = require("vm");
const S = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-units.js"), "utf8"), S, { filename: "ebanist-units.js" });
const U = S;

const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, a + " != " + b);

describe("parseLen", () => {
  test("fără sufix: unitatea implicită", () => {
    near(U.parseLen("800", "mm"), 800);
    near(U.parseLen("31.5", "in"), 800.1);
    near(U.parseLen("31,5", "in"), 800.1);
  });
  test("fracții", () => {
    near(U.parseLen("31 1/2", "in"), 31.5 * 25.4);
    near(U.parseLen("31-1/2", "in"), 31.5 * 25.4);
    near(U.parseLen('3/4"', "in"), 19.05);
    near(U.parseLen("1/2", "in"), 12.7);
  });
  test("sufixe explicite bat implicitul", () => {
    near(U.parseLen("800mm", "in"), 800);
    near(U.parseLen("80 cm", "in"), 800);
    near(U.parseLen("0.8m", "in"), 800);
    near(U.parseLen('31"', "mm"), 31 * 25.4);
    near(U.parseLen("31in", "mm"), 31 * 25.4);
  });
  test("picioare și inch", () => {
    near(U.parseLen("2'", "in"), 609.6);
    near(U.parseLen(`2'-7 1/2"`, "in"), (24 + 7.5) * 25.4);
    near(U.parseLen("2ft 7in", "mm"), 31 * 25.4);
    near(U.parseLen("8'", "mm"), 96 * 25.4);
    near(U.parseLen("2' 7", "in"), 31 * 25.4);
  });
  test("gol și ilizibil → null", () => {
    assert.equal(U.parseLen("", "in"), null);
    assert.equal(U.parseLen("  ", "in"), null);
    assert.equal(U.parseLen("abc", "in"), null);
    assert.equal(U.parseLen("31 1/", "in"), null);
    assert.equal(U.parseLen("1/0", "in"), null);
    assert.equal(U.parseLen(null, "in"), null);
  });
  test("negativ", () => near(U.parseLen("-1/2", "in"), -12.7));
});

describe("fmtIn / fmtLen", () => {
  test("fracții reduse", () => {
    assert.equal(U.fmtIn(25.4), "1");
    assert.equal(U.fmtIn(19.05), "3/4");
    assert.equal(U.fmtIn(800), "31 1/2");
    assert.equal(U.fmtIn(12.7), "1/2");
    assert.equal(U.fmtIn(0), "0");
  });
  test("1/16 implicit, 1/32 la cerere", () => {
    assert.equal(U.fmtIn(25.4 * (1 + 1 / 32)), "1 1/16");          // 1/32 rotunjit la 1/16 (par → sus)
    assert.equal(U.fmtIn(25.4 * (1 + 1 / 32), { mode: "frac32" }), "1 1/32");
    assert.equal(U.fmtIn(25.4 * (1 + 3 / 64), { mode: "frac32" }), "1 1/16");
  });
  test("zecimal", () => {
    assert.equal(U.fmtIn(800, { mode: "dec" }), "31.496");
    assert.equal(U.fmtIn(25.4, { mode: "dec" }), "1");
  });
  test("rotunjirea merge peste întreg", () => {
    assert.equal(U.fmtIn(25.4 * 31.99), "32");
  });
  test("simbol și picioare", () => {
    assert.equal(U.fmtIn(800, { unit: true }), "31 1/2″");
    assert.equal(U.fmtIn(96 * 25.4, { feet: true }), "8'");
    assert.equal(U.fmtIn(31 * 25.4, { feet: true, unit: true }), "2'-7″");
    assert.equal(U.fmtIn(31.5 * 25.4, { feet: true }), "2'-7 1/2");
  });
  test("negativ", () => assert.equal(U.fmtIn(-12.7), "-1/2"));
  test("fmtLen mm — ca fmt01", () => {
    assert.equal(U.fmtLen(800, "mm"), "800");
    assert.equal(U.fmtLen(800.04, "mm"), "800");
    assert.equal(U.fmtLen(18.25, "mm"), "18.3");
    assert.equal(U.fmtLen("x", "mm"), "");
  });
  test("fmtDual", () => {
    assert.equal(U.fmtDual(800, "mm"), "800");
    assert.equal(U.fmtDual(800, "in"), "31 1/2″ (800)");
  });
});

describe("tur-retur", () => {
  test("mm → inch → mm rămâne în 1/2 fracție (niciodată înapoi în model)", () => {
    for (const mm of [18, 19, 100, 321.5, 600, 720, 800, 2070, 2800, 2438.4]) {
      const back = U.parseLen(U.fmtIn(mm), "in");
      assert.ok(Math.abs(back - mm) <= 25.4 / 32 + 1e-9, mm + " → " + back);
    }
  });
  test("zecimal: eroare sub 0,02 mm", () => {
    for (const mm of [18, 321.5, 800, 2438.4]) {
      const back = U.parseLen(U.fmtIn(mm, { mode: "dec" }), "in");
      assert.ok(Math.abs(back - mm) < 0.02, mm + " → " + back);
    }
  });
  test("o fracție scrisă de utilizator se întoarce exact", () => {
    for (const s of ["31 1/2", "3/4", "23 7/16", "96", "1/16"]) {
      assert.equal(U.fmtIn(U.parseLen(s, "in")), s);
    }
  });
});
