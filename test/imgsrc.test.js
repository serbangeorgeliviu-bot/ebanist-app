/* Audit 2026-11-09 (E-04): `imgSrc` — nicio imagine din date persistate nu ajunge
   neescapată într-un atribut src. Se extrage funcția din index.html (un singur loc). */
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "app", "index.html"), "utf8");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const m = /const imgSrc = u => \{[^\n]*\};/.exec(html);
test("imgSrc există în index.html", () => assert.ok(m));
const imgSrc = new Function("esc", m[0] + "; return imgSrc;")(esc);

test("data:image base64 trece", () => assert.strictEqual(imgSrc("data:image/png;base64,iVBORw0KGgo="), "data:image/png;base64,iVBORw0KGgo="));
test("ieșire din atribut respinsă", () => {
  assert.strictEqual(imgSrc('data:image/png;base64,AA" onerror="alert(1)'), "");
  assert.strictEqual(imgSrc('x" onerror="alert(1)'), "");
});
test("javascript:, data:text/html, svg+script respinse", () => {
  assert.strictEqual(imgSrc("javascript:alert(1)"), "");
  assert.strictEqual(imgSrc("data:text/html;base64,PHNjcmlwdD4="), "");
  assert.strictEqual(imgSrc("data:image/svg+xml;base64,PHN2Zz4="), "");
});
test("https și cale relativă trec, goale dau gol", () => {
  assert.strictEqual(imgSrc("https://ebanist.com/a.png"), "https://ebanist.com/a.png");
  assert.strictEqual(imgSrc("./icons/a.png"), "./icons/a.png");
  assert.strictEqual(imgSrc(""), ""); assert.strictEqual(imgSrc(null), "");
});
test("nicio atribuire src din date persistate fără imgSrc (logo, semnătură, poze releveu, catalog, AI)", () => {
  for (const frag of ['src="${o.sig}"', 'src="${S.logo}"', 'src="${sh.img}"', 'src="${img}"', 'src="${im.url}"'])
    assert.ok(!html.includes(frag), "neescapat: " + frag);
});
