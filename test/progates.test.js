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
const gatedS = (head, why) => new RegExp('proGateSample\\("' + why + '"\\)').test(head);
const gated = (head, why) => new RegExp('proGate\\("' + why + '"\\)').test(head);

describe("„În camera ta”: se deschide gratuit, iese numai cu Pro", () => {
  test("butonul care deschide previzualizarea nu are poartă", () => assert.ok(!/proGate\(/.test(after('$("btnRoom").addEventListener("click"', 160))));
  test("exportul JPG are poarta „jpg”", () => assert.ok(gated(after('$("roomExport").addEventListener("click"', 120), "jpg")));
  test("video-ul montajului are poarta „export”", () => assert.ok(gated(after('$("btnRec3d").addEventListener("click"', 160), "export")));
  test("AR se folosește gratuit (D-134): fără poartă pe buton", () => assert.ok(!/proGate\(/.test(after('$("btnAR").addEventListener("click"', 420))));
});

describe("fișa piesei: se vede gratuit, iese numai cu Pro", () => {
  test("deschiderea foii nu are poartă", () => assert.ok(!/proGate\(/.test(after("function openPartSheet(M,pc,face){", 220))));
  for (const fn of ["partSheetPrint(M,pc,face)", "partDxf(M,pc)", "partCsv(M,pc)"])
    test("function " + fn + " are poarta „part” la început", () => assert.ok(gated(after("function " + fn + "{", 140), "part")));
});

describe("fiecare motiv rămas în aplicație are text în ecranul Pro", () => {
  test("proSubRoom și proSubPart există în ro, it, en, fr", () => {
    for (const k of ["proSubRoom", "proSubPart"]) assert.ok((SRC.match(new RegExp(k + ":", "g")) || []).length >= 4, k);
  });
  test("textul „room” spune că previzualizarea și AR sunt gratuite", () => assert.match(SRC, /proSubRoom:"The JPG export of the room photo is in Pro\. The preview and AR are free\."/));
});

describe("documentul de probă gratuit, cu filigran (D-180)", () => {
  const PRINT_BTNS = [["btnPdf", "pdf"], ["btnDraw", "doc"], ["btnElab", "doc"], ["btnAsmA3", "doc"], ["btnMont", "doc"], ["btnPassport", "doc"], ["btnHandover", "doc"], ["btnOrder", "doc"], ["btnLabels", "doc"]];
  for (const [id, why] of PRINT_BTNS)
    test(id + " are poarta de probă „" + why + "”", () => assert.ok(gatedS(after('$("' + id + '").addEventListener("click"', 260), why)));
  test("documentele atelierului (cant, vopsea, tăiere) au poarta de probă", () => assert.ok(gatedS(after('if(act==="docedge"||act==="docpaint"||act==="docsaw"){', 260), "doc")));
  test("ce nu trece prin tipărire rămâne cu poarta Pro simplă", () => {
    assert.ok(gated(after('$("btnCsv").addEventListener("click"', 160), "export"));
    assert.ok(gated(after("function packOpen(){", 80), "doc"));
    assert.ok(gated(after('$("btnOrderSend").addEventListener("click"', 160), "doc"));
    assert.ok(gated(after('$("btnShare").addEventListener("click"', 160), "export"));
    assert.ok(gated(after('$("jigDl").addEventListener("click"', 100), "export"));
  });
  test("printOut() deschide Pro numai dacă proba nu se poate lua, iar filigranul se pune tot pentru cine nu e Pro", () => {
    const head = after("function printOut(){", 1500);
    assert.match(head, /if\(!isPro\(\)&&!PRINT_CAPTURE&&!sampleTake\(\)\)\{ openPro\("pdf"\); return; \}/);
    assert.match(head, /if\(!isPro\(\)\)\{\s*const d=document\.createElement\("div"\);\s*d\.className="wm-diag"/);
  });
  test("proba se ia o singură dată: cheie proprie, consumată în sampleTake, armată cel mult 60 s", () => {
    const fn = after("function sampleTake(){", 520);
    assert.match(fn, /Date\.now\(\)-SAMPLE\.armedAt>60000/);
    assert.match(fn, /localStorage\.setItem\(SAMPLE\.key/);
    assert.match(fn, /EBFunnel\.send\("doc_sample"/);
    assert.match(after("function sampleLeft(){", 120), /!localStorage\.getItem\(SAMPLE\.key\)/);
  });
  test("window.print() există într-un singur loc, în printOut(), deci niciun document nu iese fără filigran", () => {
    assert.equal((SRC.match(/window\.print\(\)/g) || []).length, 1);
  });
});
