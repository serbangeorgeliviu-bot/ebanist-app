/* Clip „Novità" (it), partea 2: capturi reale de interfață (1080×1920): controlul roșu, „Scegli la soluzione", eticheta cu QR.
   node site-src/tools/novita-it-ui.cjs   → OUT/ui/audit.png, fix.png, label.png */
const PW = process.env.PLAYWRIGHT_PATH || "/opt/node-tools/node_modules/playwright";
const { chromium } = require(PW);
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, "../.."), OUT = path.join(process.env.OUT || path.join(root, "vid-novita"), "ui");
fs.mkdirSync(OUT, { recursive: true });
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg" };
const srv = http.createServer((q, r) => {
  let f = path.join(root, decodeURIComponent(q.url.split("?")[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
  r.setHeader("content-type", MIME[path.extname(f)] || "application/octet-stream"); r.end(fs.readFileSync(f));
}).listen(8801, async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
  const ctx = await b.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, colorScheme: "dark" });
  await ctx.addInitScript(() => { try { localStorage.setItem("ebanist_lic", JSON.stringify({ kind: "stripe", key: "comp_TESTTESTTESTTESTTESTTEST", status: "active", activated: true, checkedAt: Date.now() })); } catch (e) { } });
  const pg = await ctx.newPage(); pg.on("pageerror", e => console.log("ERR", String(e).slice(0, 200))); pg.setDefaultTimeout(60000);
  await pg.goto("http://localhost:8801/app/index.html?lang=it"); await pg.waitForFunction(() => window.MAT_LOADED === true); await pg.waitForTimeout(3000);
  await pg.locator("#btnIntroGo").click({ timeout: 1500 }).catch(() => { });
  /* 1–2. controlul roșu și «Scegli la soluzione» (scenariul I7 din e2e: raft fix care devine mobil) */
  await pg.evaluate(async () => {
    closeSheets(); setView("build"); const q = proj(); q.pieces = []; q.configs = {}; q.layout = {};
    generateInto(proj(), { ...PRESETS.armadio, name: "Armadio", L: 600, H: 720, P: 560, shelves: 0, partitions: [{ type: "ripiano", y: 400, span: "full" }], doors: 0, drawers: 0, hang: 0, tram: 0, shelfType: "fisso", support: "zoccolo", plinth: 100 });
    proj().configs["Armadio"].shelfType = "mobile"; auditBadge();
    await new Promise(r => setTimeout(r, 400));
  });
  await pg.evaluate(() => document.getElementById("auditBadge").click()); await pg.waitForTimeout(700);
  await pg.screenshot({ path: path.join(OUT, "audit.png") });
  await pg.evaluate(() => { const btn = document.querySelector("#auditBody [data-fx]"); if (btn) btn.click(); }); await pg.waitForTimeout(700);
  await pg.screenshot({ path: path.join(OUT, "fix.png") });
  /* 3. eticheta cu QR: aceeași generare ca butonul «Etichette», fără fereastra de tipărire */
  await pg.evaluate(async () => {
    closeSheets(); const q = proj(); q.pieces = []; q.configs = {}; q.layout = {};
    generateInto(q, { ...PRESETS.armadio, name: "Armadio W1000", L: 1000, H: 2200, P: 600, matBody: "antracite_storm_grey_19", matFront: "nogal_victoria_19", matBack: "antracite_storm_grey_19" });
    window.printOut = () => { }; document.getElementById("btnLabels").click();
    await new Promise(r => setTimeout(r, 400));
  });
  await pg.emulateMedia({ media: "print" });
  const html = await pg.evaluate(() => document.getElementById("printArea").innerHTML);
  const css = await pg.evaluate(() => [...document.styleSheets].map(s => { try { return [...s.cssRules].map(r => r.cssText).join("\n"); } catch (e) { return ""; } }).join("\n"));
  const pg2 = await ctx.newPage(); await pg2.setViewportSize({ width: 540, height: 960 });
  await pg2.setContent(`<html><head><style>${css}</style><style>body{margin:0;background:#e9ede5}#printArea{display:block!important;position:static!important}.lbl-grid{display:grid!important;grid-template-columns:1fr!important;gap:30px;padding:46px 30px;width:auto!important;margin:0!important}.lbl{transform-origin:top left;font-size:150%;background:#fff!important;color:#111!important;border-color:#bbb!important}.lbl *{color:#111!important}</style></head><body><div id="printArea">${html}</div></body></html>`);
  await pg2.emulateMedia({ media: "print" }); await pg2.waitForTimeout(500);
  const card = await pg2.$(".lbl"); if (card) { const bb = await card.boundingBox(); console.log("card", JSON.stringify(bb)); }
  await pg2.screenshot({ path: path.join(OUT, "label.png") });
  await b.close(); srv.close(); console.log("ui gata");
});
