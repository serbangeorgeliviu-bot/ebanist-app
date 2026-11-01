/* Avertismentul iOS: o singură dată, numai Safari neinstalat și fără cont.
 *   cd test && node --test ios-hint.test.js */
const test = require("node:test");
const assert = require("node:assert");
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, "..");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".webmanifest": "application/json" };
const IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

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
async function run(browser, port, ua) {
  const ctx = await browser.newContext({ userAgent: ua, viewport: { width: 412, height: 915 } });
  const pg = await ctx.newPage();
  await pg.goto(`http://127.0.0.1:${port}/app/index.html`);
  await pg.waitForFunction(() => window.MAT_LOADED === true, null, { timeout: 15000 });
  await pg.waitForTimeout(3300);
  await pg.evaluate(() => closeSheets());
  const first = await pg.evaluate(() => { iosEvictionHint(); const a = !!document.getElementById("iosHint"); const t = a && document.getElementById("iosHint").textContent; return { a, t }; });
  await pg.evaluate(() => { const b = document.getElementById("iosHint"); if (b) b.remove(); iosEvictionHint(); });
  const again = await pg.evaluate(() => !!document.getElementById("iosHint"));
  await ctx.close();
  return { first, again };
}
test("avertisment iOS: o dată pe iOS/Safari, deloc pe alte platforme", async () => {
  const server = await serve();
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  try {
    const ios = await run(browser, server.address().port, IOS);
    assert.ok(ios.first.a && ios.first.t.length > 40, "bannerul apare pe iOS");
    assert.strictEqual(ios.again, false, "a doua oară nu mai apare");
    const desk = await run(browser, server.address().port, "Mozilla/5.0 (X11; Linux x86_64) Chrome/120 Safari/537.36");
    assert.strictEqual(desk.first.a, false, "nu apare pe desktop");
  } finally { await browser.close(); server.close(); }
});
