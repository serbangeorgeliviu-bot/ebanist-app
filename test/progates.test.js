/* Porțile Pro stau la ieșire, nu la intrare (D-131).
 *
 *   cd test && node --test progates.test.js
 *
 * „În camera ta” și fișa piesei se văd gratuit; ce iese din ele (JPG, AR, A3, DXF, CSV) rămâne Pro,
 * fiecare buton cu poarta lui. Testul citește sursa: un export fără poartă ar fi un export dat gratis.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "app", "index.html"), "utf8");

/* Primele `n` caractere de după un început dat. */
function after(marker, n = 220) {
  const i = SRC.indexOf(marker);
  assert.ok(i >= 0, "lipsește în sursă: " + marker);
  return SRC.slice(i, i + n);
}
const gated = (head, why) => new RegExp('proGate\\("' + why + '"\\)').test(head);

describe("„În camera ta”: se deschide gratuit, iese numai cu Pro", () => {
  test("butonul care deschide previzualizarea nu are poartă", () => assert.ok(!/proGate\(/.test(after('$("btnRoom").addEventListener("click"', 160))));
  test("exportul JPG are poarta „jpg”", () => assert.ok(gated(after('$("roomExport").addEventListener("click"', 120), "jpg")));
  test("AR are poarta „room”", () => assert.ok(gated(after('$("btnAR").addEventListener("click"', 120), "room")));
});

describe("fișa piesei: se vede gratuit, iese numai cu Pro", () => {
  test("deschiderea foii nu are poartă", () => assert.ok(!/proGate\(/.test(after("function openPartSheet(M,pc,face){", 220))));
  for (const fn of ["partA3(M,pc,face)", "partDxf(M,pc)", "partCsv(M,pc)"])
    test("function " + fn + " are poarta „part” la început", () => assert.ok(gated(after("function " + fn + "{", 140), "part")));
});

describe("fiecare motiv rămas în aplicație are text în ecranul Pro", () => {
  test("proSubRoom și proSubPart există în ro, it, en, fr", () => {
    for (const k of ["proSubRoom", "proSubPart"]) assert.ok((SRC.match(new RegExp(k + ":", "g")) || []).length >= 4, k);
  });
  test("textul „room” spune că previzualizarea e gratuită", () => assert.match(SRC, /proSubRoom:"AR and the JPG export of the room photo are in Pro\. The preview is free\."/));
});
