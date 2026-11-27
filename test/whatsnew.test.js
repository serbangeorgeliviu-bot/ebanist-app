/* Noutăți (D-184): app/ebanist-whatsnew.js
   Rulează: node --test whatsnew.test.js */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const W = new Function(read("app/ebanist-whatsnew.js") + "\nreturn globalThis.EBWhatsNew;")();
const APP = read("app/index.html");
const L7 = ["en", "ro", "it", "fr", "de", "pl", "es"];
const ver = v => v.split(".").map(Number);
const cmp = (a, b) => { const x = ver(a), y = ver(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };

test("limbile sunt cele 7 ale aplicației", () => assert.deepStrictEqual(W.LANGS, L7));

test("UI: aceleași chei, nimic gol, în toate limbile", () => {
  const keys = Object.keys(W.UI.en);
  for (const l of L7) {
    assert.deepStrictEqual(Object.keys(W.UI[l]), keys, `UI.${l}`);
    for (const k of keys) assert.ok(W.UI[l][k].trim(), `UI.${l}.${k} gol`);
  }
});

test("fiecare versiune: toate limbile, același număr de rânduri, fără gol", () => {
  assert.ok(W.RELEASES.length >= 5);
  const seen = new Set();
  for (const r of W.RELEASES) {
    assert.match(r.v, /^\d+\.\d+\.\d+$/); assert.match(r.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(!seen.has(r.v), "versiune dublă " + r.v); seen.add(r.v);
    const n = r.t.en.items.length;
    assert.ok(n >= 1);
    for (const l of L7) {
      const c = r.t[l];
      assert.ok(c && c.title.trim(), `${r.v}.${l} fără titlu`);
      assert.strictEqual(c.items.length, n, `${r.v}.${l}: alt număr de rânduri`);
      c.items.forEach((it, i) => assert.ok(it.trim(), `${r.v}.${l}[${i}] gol`));
    }
  }
});

test("ordinea: cea mai nouă prima, iar prima = APP_VER", () => {
  for (let i = 1; i < W.RELEASES.length; i++)
    assert.ok(cmp(W.RELEASES[i - 1].v, W.RELEASES[i].v) > 0, "ordine: " + W.RELEASES[i].v);
  const m = APP.match(/const APP_VER="([^"]+)"/);
  assert.ok(m && cmp(W.RELEASES[0].v, m[1]) <= 0, "o intrare e mai nouă decât APP_VER");
});

test("fiecare intrare există în CHANGELOG.md", () => {
  const cl = read("CHANGELOG.md");
  for (const r of W.RELEASES) assert.ok(cl.includes("## " + r.v + " "), "lipsește în CHANGELOG: " + r.v);
});

test("render: HTML-ul are câte un <details> pe versiune, escapat, cu link la blog", () => {
  for (const l of L7) {
    const h = W.render(l);
    assert.strictEqual((h.match(/<details/g) || []).length, W.RELEASES.length);
    assert.ok(h.includes('href="/' + (l === "en" ? "" : l + "/") + 'blog/"'));
    assert.ok(!/<script|\*\*/.test(h), "markup neașteptat în " + l);
  }
  assert.strictEqual(W.md("a <b> **x**"), "a &lt;b&gt; <b>x</b>");
});

test("e legat în aplicație și în Service Worker", () => {
  assert.ok(APP.includes('<script src="./ebanist-whatsnew.js"></script>'));
  assert.ok(APP.includes('id="shNews"') && APP.includes("function newsOpen"));
  assert.ok(/id="btnNews"/.test(APP));
  assert.ok(read("app/sw.js").includes('"./ebanist-whatsnew.js"'));
});
