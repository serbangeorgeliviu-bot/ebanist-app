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

/* al doilea articol: Noutăți 5.46–5.78 (5.79 pe site) */
test("articolul 5.x există în fiecare limbă, cu hreflang, JSON-LD și fără chei nerezolvate", () => {
  for (const l of cfg.LANGS) {
    const h = rd(dir(l) + "blog/whats-new-5-78/index.html");
    assert.ok(h.includes(`<html lang="${l}">`), l);
    for (const x of cfg.LANGS) assert.ok(h.includes(`hreflang="${x}"`), `${l} → ${x}`);
    const j = JSON.parse(h.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.equal(j["@type"], "BlogPosting"); assert.equal(j.datePublished, "2026-11-17");
    assert.ok(!/\{\{|blog5?\.[a-z0-9]+\.[a-z]/.test(h.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "")), "cheie nerezolvată în " + l);
    assert.equal((h.match(/class="blog-item"/g) || []).length, 8, l);
    assert.ok(/LED/.test(h), l);
  }
});
test("indexul blogului listează ambele articole; sitemap-ul le conține pe amândouă în toate limbile", () => {
  for (const l of cfg.LANGS) {
    const h = rd(dir(l) + "blog/index.html");
    assert.ok(h.includes("whats-new-5-78/") && h.includes("whats-new-4-63/"), l);
  }
  const sm = rd("sitemap.xml");
  for (const l of cfg.LANGS) assert.ok(sm.includes(`${cfg.SITE_URL}/${l === cfg.DEFAULT_LANG ? "" : l + "/"}blog/whats-new-5-78/`), l);
});
test("tabelul Gratuit/Pro: rândurile noi (fișa piesei gratuită; animația video și șabloanele STL Pro) în fiecare limbă", () => {
  for (const l of cfg.LANGS) {
    const h = rd(dir(l) + "index.html");
    const rows = [...h.matchAll(/<tr><th scope="row">(.*?)<\/th>(.*?)<\/tr>/g)];
    const free = r => (r[2].match(/class="y"/g) || []).length;
    assert.ok(rows.length >= 15, l + " rânduri " + rows.length);
    /* ordinea din CMP: ... r11 (export JPG/AR, Pro), r14 (animația video, Pro), r15 (șabloane STL, Pro), r12 (logo, Pro) */
    const stl = rows[13], vid = rows[12];
    assert.ok(/STL/.test(stl[1]), l + " rândul STL: " + stl[1]);
    assert.equal(free(rows[4]), 2, l + " fișa piesei: gratuit și Pro");
    assert.equal(free(stl), 1, l + " STL doar Pro"); assert.equal(free(vid), 1, l + " video doar Pro");
  }
});

/* al treilea articol: Noutăți 5.79–5.98 */
test("articolul 5.98 există în fiecare limbă, cu hreflang, JSON-LD și fără chei nerezolvate", () => {
  for (const l of cfg.LANGS) {
    const h = rd(dir(l) + "blog/whats-new-5-98/index.html");
    assert.ok(h.includes(`<html lang="${l}">`), l);
    for (const x of cfg.LANGS) assert.ok(h.includes(`hreflang="${x}"`), `${l} → ${x}`);
    const j = JSON.parse(h.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.equal(j["@type"], "BlogPosting"); assert.equal(j.datePublished, "2026-11-21");
    assert.ok(!/\{\{|blog[56]?\.[a-z0-9]+\.[a-z]/.test(h.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "")), "cheie nerezolvată în " + l);
    assert.equal((h.match(/class="blog-item"/g) || []).length, 8, l);
    const idx = rd(dir(l) + "blog/index.html");
    assert.ok(idx.includes("whats-new-5-98/"), l);
    assert.ok(rd("sitemap.xml").includes(`${cfg.SITE_URL}/${l === cfg.DEFAULT_LANG ? "" : l + "/"}blog/whats-new-5-98/`), l);
  }
  const en = JSON.parse(rd("site-src/i18n/en.json"));
  for (const l of cfg.LANGS.filter(x => x !== "en")) {
    const d = JSON.parse(rd(`site-src/i18n/${l}.json`));
    for (const k of Object.keys(en).filter(k => k.startsWith("blog6.") || /^news\.[1245789]\./.test(k))) assert.notEqual(d[k], en[k], `${l} ${k}`);
  }
});
