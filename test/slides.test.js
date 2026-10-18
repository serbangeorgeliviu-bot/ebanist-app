/* Pozitiile de fixare ale ghidajelor: din fisele Blum (MOVENTO 760H, TANDEM plus 563H) */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine();
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
const pos = (id, nl) => { S.slideGuidaId = () => id; return JSON.parse(JSON.stringify(S.slidePositions({}, nl))); };

test("MOVENTO 760H: fata 18/37/69 + spatele dupa NL", () => {
  assert.deepEqual(pos("blum_movento", 260).list, [18, 37, 69, 197]);
  assert.deepEqual(pos("blum_movento", 300).list, [18, 37, 69, 261]);
  assert.deepEqual(pos("blum_movento", 350).list, [18, 37, 69, 261]);
  for (const nl of [380, 450, 480, 500, 520, 550, 600]) assert.deepEqual(pos("blum_movento", nl).list, [18, 37, 69, 243, 261, 293], "NL " + nl);
  assert.equal(pos("blum_movento", 450).approx, false);
  assert.equal(pos("blum_movento", 650).approx, true, "peste tabel = cea mai apropiata, marcat");
});
test("TANDEM plus 563H: 37 + 32-grid din fisa, pe NL", () => {
  assert.deepEqual(pos("blum_tandem", 229).list, [37, 133, 229]);
  assert.deepEqual(pos("blum_tandem", 305).list, [37, 165, 261]);
  assert.deepEqual(pos("blum_tandem", 381).list, [37, 165, 357]);
  assert.deepEqual(pos("blum_tandem", 457).list, [37, 261, 453]);
  assert.deepEqual(pos("blum_tandem", 533).list, [37, 261, 517]);
  assert.equal(pos("blum_tandem", 457).approx, false);
  assert.equal(pos("blum_tandem", 600).approx, true);
});
test("fiecare pozitie din tabele sta pe grila de 32 (37 + n×32) sau e din fisa Movento", () => {
  for (const nl of [229, 305, 381, 457, 533]) pos("blum_tandem", nl).list.forEach(d => assert.equal((d - 37) % 32, 0, "NL " + nl + " d " + d));
});
test("fara serie cunoscuta: pozitiile de dinainte", () => {
  assert.deepEqual(pos("haf_matrix", 450).list, [37, 261, 453]);
  assert.equal(pos("haf_matrix", 450).src, null);
});
