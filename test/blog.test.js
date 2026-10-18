/* blogul: indexul și articolul, în fiecare limbă; videoclipul, posterul și imaginea OG există. node --test blog.test.js */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "site-src/site.config.json"), "utf8"));
const rd = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const dir = l => (l === cfg.DEFAULT_LANG ? "" : l + "/");

test("fiecare limbă are indexul și articolul, cu hreflang către toate", () => {
  for (const l of cfg.LANGS) for (const p of ["blog/", "blog/whats-new-4-63/"]) {
    const h = rd(dir(l) + p + "index.html");
    assert.ok(h.includes(`<html lang="${l}">`), l + p);
    for (const x of cfg.LANGS) assert.ok(h.includes(`hreflang="${x}"`), `${l} ${p} → ${x}`);
    assert.ok(/<link rel="canonical" href="https:\/\/ebanist\.com\//.test(h));
  }
});
test("articolul: JSON-LD valid, video și poster existente, fără chei nerezolvate", () => {
  for (const l of cfg.LANGS) {
    const h = rd(dir(l) + "blog/whats-new-4-63/index.html");
    const j = JSON.parse(h.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.equal(j["@type"], "BlogPosting");
    assert.equal(j.video["@type"], "VideoObject");
    const v = h.match(/<source src="([^"]+)"/)[1], p = h.match(/poster="([^"]+)"/)[1];
    assert.ok(fs.existsSync(path.join(ROOT, v)), v);
    assert.ok(fs.existsSync(path.join(ROOT, p)), p);
    assert.ok(!/\{\{|blog\.[a-z]+\.[a-z]/.test(h.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "")), "cheie nerezolvată în " + l);
  }
  assert.ok(fs.existsSync(path.join(ROOT, "site/og/blog-whats-new.jpg")));
});
test("videoclipurile din VIDEO_LANGS există; celelalte limbi folosesc engleza", () => {
  for (const l of cfg.VIDEO_LANGS) {
    assert.ok(fs.statSync(path.join(ROOT, `site/video/ebanist-whats-new-${l}.mp4`)).size > 100000, l);
    assert.ok(fs.existsSync(path.join(ROOT, `site/video/poster-${l}.webp`)), l);
  }
  const de = rd("de/blog/whats-new-4-63/index.html");
  assert.ok(de.includes("ebanist-whats-new-en.mp4"));
});
test("sitemap: indexul și articolul, în toate limbile", () => {
  const sm = rd("sitemap.xml");
  for (const l of cfg.LANGS) for (const p of ["blog/", "blog/whats-new-4-63/"]) assert.ok(sm.includes(`https://ebanist.com/${dir(l)}${p}`), l + p);
});
test("textele articolului nu sunt copii ale englezei în limbile traduse", () => {
  const en = JSON.parse(rd("site-src/i18n/en.json"));
  for (const l of cfg.LANGS.filter(x => x !== "en")) {
    const d = JSON.parse(rd(`site-src/i18n/${l}.json`));
    for (const k of ["blog.h", "blog.lead", "blog.s1.p", "blog.s5.p", "blog.check.p", "blog.vid.h"]) assert.notEqual(d[k], en[k], `${l} ${k}`);
  }
});
