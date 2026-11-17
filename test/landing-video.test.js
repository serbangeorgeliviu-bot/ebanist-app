/* Clipul de montaj din secțiunea TikTok a landing-ului (5.72.0): în toate cele 7 pagini, încărcat leneș, mic, fără sunet. */
const { test } = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const PAGES = ["index.html", "ro/index.html", "it/index.html", "fr/index.html", "de/index.html", "es/index.html", "pl/index.html"];
for (const p of PAGES) test("landing " + p + ": video de montaj leneș și mut", () => {
  const h = fs.readFileSync(path.join(ROOT, p), "utf8");
  const m = h.match(/<video class="tt-vid"[^>]*>/);
  assert.ok(m, "lipsește .tt-vid");
  assert.ok(/\bmuted\b/.test(m[0]) && /\bloop\b/.test(m[0]) && /playsinline/.test(m[0]), "muted loop playsinline");
  assert.ok(/preload="none"/.test(m[0]), "preload none");
  assert.ok(!/\ssrc=/.test(m[0]), "fără src static: se încarcă la derulare");
  const ds = (m[0].match(/data-src="([^"]+)"/) || [])[1];
  assert.ok(ds && fs.existsSync(path.join(ROOT, ds)), "fișierul " + ds + " există");
});
test("clipul de montaj e sub 600 KB (landing rapid) și media-src permite 'self'", () => {
  assert.ok(fs.statSync(path.join(ROOT, "site/video/ebanist-montaj.mp4")).size < 600 * 1024);
  assert.ok(/media-src 'self'/.test(fs.readFileSync(path.join(ROOT, "netlify.toml"), "utf8")));
});
test("main.js: clipul pornește doar la apariție și respectă „reduce motion”", () => {
  const j = fs.readFileSync(path.join(ROOT, "site/js/main.js"), "utf8");
  assert.ok(/IntersectionObserver/.test(j) && /prefers-reduced-motion/.test(j) && /tt-vid/.test(j));
});
