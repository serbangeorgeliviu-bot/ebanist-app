/* Ajutorul (D-108): app/ebanist-help.js — aceeași sursă pentru foaia din aplicație și pentru /help/.
   Rulează: node --test help.test.js
   Verifică structura, nu stilul: toate cele 7 limbi complete, aceiași pași în fiecare limbă, numele de butoane
   din text există în aplicație, imaginile referite există pe disc, iar paginile site-ului sunt generate. */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const H = new Function(read("app/ebanist-help.js") + "\nreturn globalThis.EBHelp;")();
const APP = read("app/index.html");
const L7 = ["en", "ro", "it", "fr", "de", "pl", "es"];

test("limbile sunt cele 7 ale aplicației", () => assert.deepStrictEqual(H.LANGS, L7));

test("UI: toate cheile, în toate limbile", () => {
  const keys = Object.keys(H.UI.en);
  for (const l of L7) {
    assert.deepStrictEqual(Object.keys(H.UI[l]), keys, `UI.${l}`);
    for (const k of keys) assert.ok(H.UI[l][k].trim(), `UI.${l}.${k} gol`);
  }
});

test("fiecare subiect e complet în toate limbile, cu aceiași pași", () => {
  assert.ok(H.TOPICS.length >= 10);
  const ids = new Set();
  for (const tp of H.TOPICS) {
    assert.ok(!ids.has(tp.id), "id dublu: " + tp.id); ids.add(tp.id);
    const en = tp.t.en;
    for (const l of L7) {
      const c = tp.t[l];
      assert.ok(c, `${tp.id}.${l} lipsește`);
      assert.ok(c.title && c.lead, `${tp.id}.${l}: titlu/lead gol`);
      assert.ok(Array.isArray(c.steps) && c.steps.length >= 2, `${tp.id}.${l}: pași`);
      assert.strictEqual(c.steps.length, en.steps.length, `${tp.id}.${l}: alt număr de pași decât în en`);
      assert.strictEqual(!!c.tip, !!en.tip, `${tp.id}.${l}: sfatul există doar într-o limbă`);
      for (const s of [c.title, c.lead, ...c.steps, c.tip || ""])
        assert.strictEqual((s.match(/\*\*/g) || []).length % 2, 0, `${tp.id}.${l}: ** neînchis în «${s.slice(0, 40)}»`);
      if (l !== "en") assert.notStrictEqual(c.lead, en.lead, `${tp.id}.${l}: lead netradus`);
    }
  }
});

test("FAQ: complet în toate limbile", () => {
  assert.ok(H.FAQ.length >= 5);
  for (const f of H.FAQ) for (const l of L7) {
    const c = f.t[l]; assert.ok(c && c.q && c.a, `${f.id}.${l}`);
    if (l !== "en") assert.notStrictEqual(c.q, f.t.en.q, `${f.id}.${l}: întrebare netradusă`);
  }
});

test("numele de butoane din **text** există în aplicație", () => {
  /* nu verifică limba (dicționarele sunt în index.html, nu în module), dar prinde eticheta redenumită sau tastată greșit */
  const miss = [];
  for (const o of [...H.TOPICS, ...H.FAQ]) for (const l of L7) {
    const c = o.t[l];
    for (const s of [c.title, c.lead, ...(c.steps || []), c.tip, c.q, c.a].filter(Boolean))
      for (const m of s.matchAll(/\*\*([^*]+)\*\*/g))
        if (!APP.includes('"' + m[1] + '"')) miss.push(`${o.id}.${l}: «${m[1]}»`);
  }
  assert.deepStrictEqual(miss, [], "etichete care nu există în aplicație:\n" + miss.join("\n"));
});

test("capturile referite există (AVIF + WebP), în fiecare limbă", () => {
  const miss = [];
  for (const tp of H.TOPICS) {
    if (tp.shot === null) continue;
    const s = H.SHOTS[tp.shot];
    assert.ok(s, `${tp.id}: shot necunoscut ${tp.shot}`);
    for (const l of L7) for (const ext of ["avif", "webp"]) {
      const f = `site/screens/${l}/${s.n}-${s.w}.${ext}`;
      if (!fs.existsSync(path.join(ROOT, f))) miss.push(f);
    }
  }
  assert.deepStrictEqual(miss, [], "lipsesc:\n" + miss.join("\n"));
});

test("randarea: markup-ul se scapă, **x** devine <b>", () => {
  assert.strictEqual(H.md("a <b> **Gen**"), "a &lt;b&gt; <b>Gen</b>");
  const html = H.topicBody(H.TOPICS[0], "ro");
  assert.ok(html.includes("<ol") && html.includes("<b>Proiecte</b>") && html.includes("/site/screens/ro/"));
  assert.ok(!H.topicBody(H.TOPICS[0], "ro", { noFig: true }).includes("<figure"));
  assert.strictEqual(H.tx(H.TOPICS[0], "xx"), H.TOPICS[0].t.en, "limbă necunoscută → en");
});

test("aplicația: butonul ?, foaia, scriptul și cache-ul", () => {
  assert.ok(APP.includes('id="btnHelp"') && APP.includes('id="shHelp"') && APP.includes('src="./ebanist-help.js"'));
  assert.ok(read("app/sw.js").includes('"./ebanist-help.js"'), "ebanist-help.js lipsește din SHELL (offline)");
});

test("site: pagina /help/ există în toate limbile, cu FAQPage și hreflang", () => {
  for (const l of L7) {
    const f = (l === "en" ? "" : l + "/") + "help/index.html";
    assert.ok(fs.existsSync(path.join(ROOT, f)), f + " lipsește — rulează node site-src/build.mjs");
    const h = read(f);
    assert.ok(h.includes('"@type":"FAQPage"') && h.includes('hreflang="x-default"') && h.includes('id="h-start"'), f);
    for (const tp of H.TOPICS) assert.ok(h.includes(`id="h-${tp.id}"`), `${f}: lipsește #h-${tp.id}`);
  }
  assert.ok(read("sitemap.xml").includes("https://ebanist.com/ro/help/"));
});

test("site: paginile /help/ comise sunt cele pe care le generează build.mjs azi", () => {
  const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "ebhelp-"));
  require("child_process").execFileSync(process.execPath, [path.join(ROOT, "site-src/build.mjs")], { env: { ...process.env, OUT_DIR: tmp }, stdio: "ignore" });
  const stale = L7.map(l => (l === "en" ? "" : l + "/") + "help/index.html")
    .filter(f => fs.readFileSync(path.join(tmp, f), "utf8") !== read(f));
  assert.deepStrictEqual(stale, [], "învechite (rulează node site-src/build.mjs): " + stale.join(", "));
});
