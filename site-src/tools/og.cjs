/* Imaginile OG (1200 × 630), una pe limbă: dulapul randat + titlul.
   python3 -m http.server 8765 &  →  NODE_PATH=test/node_modules node site-src/tools/og.cjs */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../.."), BASE = process.env.BASE || "http://localhost:8765";
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium" });
  const p = await (await b.newContext({ viewport: { width: 1200, height: 630 } })).newPage();
  for (const L of ["en", "ro", "it", "fr"]) {
    const t = JSON.parse(fs.readFileSync(path.join(ROOT, `site-src/i18n/${L}.json`), "utf8"));
    const h1 = t["hero.h1"].replace(/&nbsp;/g, " ");
    await p.goto(`${BASE}/robots.txt`);
    await p.setContent(`<!doctype html><html><head><link rel="stylesheet" href="${BASE}/site/css/site.css"><style>
      body::after{display:none}body{width:1200px;height:630px;overflow:hidden;position:relative;background:#eaeee4}
      .g{position:absolute;inset:0;background-image:linear-gradient(rgba(14,59,42,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(14,59,42,.07) 1px,transparent 1px);background-size:32px 32px}
      img{position:absolute;right:10px;top:-20px;width:670px;height:670px}
      .c{position:absolute;left:64px;top:64px;width:600px}
      h1{font:400 76px/.96 Fraunces,serif;letter-spacing:-2.5px;color:#1d221b;margin-top:26px}h1 em{color:#16513a}
      .k{font:500 16px/1 "JetBrains Mono",monospace;letter-spacing:.14em;color:#6b5410;display:flex;gap:14px;align-items:center}.k::before{content:"";width:34px;height:3px;background:#D4AF37}
      .u{position:absolute;left:64px;bottom:54px;font:500 18px/1 "JetBrains Mono",monospace;color:#0E3B2A;letter-spacing:.06em}
    </style></head><body><div class="g"></div><img src="${BASE}/site/img/hero-carcass-900.webp"><div class="c"><div class="k">EBANIST</div><h1>${h1}</h1></div><div class="u">ebanist.com${L === "en" ? "" : "/" + L}</div></body></html>`);
    await p.waitForTimeout(900);
    await p.screenshot({ path: path.join(ROOT, `site/og/og-${L}.jpg`), type: "jpeg", quality: 86 });
    console.log("✓ og-" + L);
  }
  await b.close();
})();
