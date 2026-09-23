/* Capturi de ecran ale tuturor vederilor, telefon + birou. Nu e test:
   e unealta de verificat designul. node shots.js <out-dir> [tag] */
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, "..");
const OUT = process.argv[2] || path.join(__dirname, "shots"); const TAG = process.argv[3] || "";
fs.mkdirSync(OUT, { recursive: true });
const MIME = { ".html":"text/html", ".js":"text/javascript", ".json":"application/json", ".css":"text/css", ".svg":"image/svg+xml", ".png":"image/png", ".webmanifest":"application/manifest+json" };
const srv = http.createServer((q, r) => { const rel = decodeURIComponent(q.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
  const f = path.join(ROOT, rel); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
(async () => {
  await new Promise(r => srv.listen(0, "127.0.0.1", r));
  const URL = `http://127.0.0.1:${srv.address().port}/app/index.html`;
  const br = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  const sizes = (process.env.SIZES || "phone,desk").split(",");
  const VP = { phone: { width: 412, height: 915, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, desk: { width: 1440, height: 900, deviceScaleFactor: 1 }, tab: { width: 1024, height: 1366, deviceScaleFactor: 1, hasTouch: true } };
  for (const s of sizes) {
    const v = VP[s]; const pg = await br.newPage({ viewport: { width: v.width, height: v.height }, isMobile: !!v.isMobile, hasTouch: !!v.hasTouch, deviceScaleFactor: v.deviceScaleFactor });
    const errs = []; pg.on("pageerror", e => errs.push(String(e)));
    await pg.goto(URL); await pg.waitForFunction(() => window.MAT_LOADED === true, null, { timeout: 15000 });
    await pg.waitForTimeout(3300); await pg.evaluate(() => closeSheets()); await pg.waitForTimeout(300);
    const views = (process.env.VIEWS || "projects,build,list,nest,summary,survey").split(",");
    for (const vw of views) {
      await pg.evaluate(x => setView(x), vw); await pg.waitForTimeout(1500);
      await pg.screenshot({ path: path.join(OUT, `${TAG}${s}-${vw}.png`), fullPage: !!process.env.FULL });
    }
    if (process.env.EXTRA) { await pg.evaluate(process.env.EXTRA); await pg.waitForTimeout(1800); await pg.screenshot({ path: path.join(OUT, `${TAG}${s}-extra.png`) }); }
    if (errs.length) console.log(s, "ERRORI:", errs);
    await pg.close();
  }
  await br.close(); srv.close(); console.log("ok", OUT);
})();
