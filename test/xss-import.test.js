/* XSS la import: un .json modificat extern nu poate injecta noduri sau scripturi.
 *
 * Importă un proiect cu un payload în fiecare câmp text liber, apoi parcurge
 * vederile și documentele care randează proiectul și caută două lucruri:
 *   1. noduri injectate (img[onerror], script, [onclick]… cu marcajul nostru);
 *   2. execuția efectivă a payload-ului (window.__xss).
 *
 *   cd test && node --test xss-import.test.js
 * Browserul: Playwright implicit sau CHROME_PATH=/cale/chrome.
 */
const test = require("node:test");
const assert = require("node:assert");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
  ".svg": "image/svg+xml", ".webmanifest": "application/json", ".css": "text/css", ".png": "image/png" };

function serve() {
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      const f = path.join(ROOT, decodeURIComponent(q.url.split("?")[0]));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" });
      fs.createReadStream(f).pipe(r);
    });
    s.listen(0, "127.0.0.1", () => res(s));
  });
}

const PAYLOADS = [
  '"><img src=x data-xss=1 onerror="window.__xss=(window.__xss||0)+1">',
  "<script data-xss=1>window.__xss=(window.__xss||0)+1</script>",
  "'><svg data-xss=1 onload=\"window.__xss=(window.__xss||0)+1\">"
];

test("import JSON: niciun câmp text liber nu injectează HTML", async () => {
  const server = await serve();
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  try {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
    await ctx.addInitScript(() => { try { localStorage.setItem("ebanist_lic",
      JSON.stringify({ kind: "stripe", key: "comp_TESTTESTTESTTESTTESTTEST", status: "active", activated: true, checkedAt: Date.now() })); } catch (e) {} });
    const pg = await ctx.newPage();
    const dialogs = [];
    pg.on("dialog", d => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
    await pg.goto(`http://127.0.0.1:${server.address().port}/app/index.html`);
    await pg.waitForFunction(() => window.MAT_LOADED === true, null, { timeout: 15000 });
    await pg.waitForTimeout(3300);
    await pg.evaluate(() => closeSheets());

    const found = await pg.evaluate(async (PAYLOADS) => {
      const sel = '[data-xss], [onerror], [onload]';
      const hits = [];
      const P = i => PAYLOADS[i % PAYLOADS.length];
      const base = JSON.parse(JSON.stringify(state.projects[0]));
      let n = 0;
      base.name = P(n++); base.client = P(n++); base.notes = P(n++); base.date = P(n++);
      base.address = P(n++); base.phone = P(n++); base.email = P(n++);
      base.pieces.forEach(x => { x.modulo = P(n++); x.elemento = P(n++); x.materiale = P(n++); x.bordo = P(n++); x.nota = P(n++); x.note = P(n++); });
      delete base.demo;
      const scan = where => { const e = document.querySelector(sel); if (e) hits.push(where + " → " + e.outerHTML.slice(0, 120)); };

      /* control: detectorul trebuie să prindă o injecție reală, altfel testul ar trece degeaba */
      const ctl = document.createElement("div"); ctl.innerHTML = "<b data-xss=1>control</b>"; document.body.appendChild(ctl);
      const detects = !!document.querySelector(sel); ctl.remove();
      if (!detects) hits.push("detectorul nu prinde injecția de control");

      const txt = JSON.stringify(base);
      try { importJson(txt); } catch (e) { hits.push("importJson a aruncat: " + e); }
      await new Promise(r => setTimeout(r, 300));
      scan("după import");

      for (const v of ["projects", "list", "summary", "nest", "build", "survey"]) {
        try { setView(v); } catch (e) { continue; }
        await new Promise(r => setTimeout(r, 350));
        scan("vedere " + v);
      }
      const p = proj();
      for (const fn of ["passportHtml", "handoverHtml"]) {
        try { const h = window[fn] ? window[fn](p) : (0, eval)(fn + "(p)"); const d = document.createElement("div"); d.innerHTML = h; document.body.appendChild(d); scan(fn); d.remove(); } catch (e) {}
      }
      try { openSheet("shProject"); await new Promise(r => setTimeout(r, 200)); scan("shProject"); closeSheets(); } catch (e) {}
      scan("final");
      return { hits, xss: window.__xss || 0 };
    }, PAYLOADS);

    assert.deepStrictEqual(found.hits, [], "noduri injectate:\n" + found.hits.join("\n"));
    assert.strictEqual(found.xss, 0, "payload executat");
    assert.deepStrictEqual(dialogs, []);
  } finally { await browser.close(); server.close(); }
});
