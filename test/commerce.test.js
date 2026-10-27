/* Plan de plată și proces-verbal (app/ebanist-commerce.js). Rulează: node --test commerce.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm"), fs = require("node:fs"), path = require("node:path");
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-commerce.js"), "utf8"), ctx);
const C = ctx.EBCommerce, LANGS = ["it", "ro", "en", "fr", "de", "pl", "es"];

test("normPlan: gol = fără plan; valid doar dacă fiecare e 0–100 și suma e 100", () => {
  assert.equal(C.normPlan([]).reason, "empty"); assert.equal(C.normPlan(["", "", ""]).reason, "empty"); assert.equal(C.normPlan([0, 0, 0]).plan, null);
  assert.deepEqual(Array.from(C.normPlan([30, 40, 30]).plan), [30, 40, 30]);
  assert.deepEqual(Array.from(C.normPlan(["30", "40,5", "29.5"]).plan), [30, 40.5, 29.5], "text și virgulă zecimală");
  assert.deepEqual(Array.from(C.normPlan([100]).plan), [100, 0, 0], "un singur pas");
  const bad = C.normPlan([30, 40, 20]); assert.equal(bad.plan, null); assert.equal(bad.reason, "sum"); assert.equal(bad.sum, 90);
  for (const v of [[-10, 60, 50], [150, 0, 0], ["abc", 50, 50], [NaN, 50, 50]]) assert.equal(C.normPlan(v).reason, "range", JSON.stringify(v));
});

test("payPlan: sumele în cenți se adună EXACT la total; ultima etapă preia rotunjirea", () => {
  for (const total of [1000, 12345.67, 0.01, 99999.99, 333.33, 7]) {
    for (const plan of [[30, 40, 30], [33.33, 33.33, 33.34], [50, 0, 50], [100, 0, 0], [20, 30, 50]]) {
      const r = C.payPlan(total, plan), sum = r.reduce((s, x) => s + x.cents, 0);
      assert.equal(sum, Math.round(total * 100), `${total} ${plan}`);
      assert.ok(r.every(x => Number.isInteger(x.cents) && x.cents >= 0));
    }
  }
  const r = C.payPlan(100, [33.33, 33.33, 33.34]);
  assert.deepEqual(Array.from(r.map(x => x.amount)), [33.33, 33.33, 33.34]);
  assert.deepEqual(Array.from(C.payPlan(1000, [50, 0, 50]).map(x => x.step)), [1, 3], "pasul cu 0% nu apare");
});

test("payPlan: total 0 sau nenumeric nu aruncă", () => {
  assert.equal(C.payPlan(0, [30, 40, 30]).reduce((s, x) => s + x.cents, 0), 0);
  assert.equal(C.payPlan(undefined, [30, 40, 30]).length, 3);
});

test("texte: aceleași chei în cele 7 limbi, fără valori goale; mesajele cu {s} păstrează substituentul", () => {
  const ref = Object.keys(C.TXT.it).sort();
  for (const l of LANGS) {
    assert.deepEqual(Object.keys(C.TXT[l]).sort(), ref, "chei diferite în " + l);
    for (const [k, v] of Object.entries(C.TXT[l])) assert.ok(String(v).trim(), `${l}.${k} e gol`);
    assert.ok(C.TXT[l].paySum.includes("{s}"), l);
  }
  assert.equal(C.t("xx", "payTitle"), C.TXT.it.payTitle);
});
