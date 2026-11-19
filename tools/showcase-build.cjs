/* Ebanist — construiește proiectele demo (FAZA T) prin aplicația însăși și le scrie în app/demo/<id>.json.
 *   node tools/showcase-build.cjs [living|kitchen|bedroom|all] [--out app/demo] [--no-write]
 * Fiecare proiect: tools/showcase/specs/<id>.cjs (date) → tools/showcase/inpage.js (SC.build: generateInto, layout, wtApply, EBKitchenUI.apply)
 * → SC.check (controalele aplicației) → JSON. Cere Chromium (CHROME_PATH sau /usr/bin/google-chrome). Ieșire ≠ 0 dacă un proiect are abateri.
 * Nu se editează niciodată JSON-ul demo de mână: se schimbă specificația și se rulează din nou. */
const http = require("http"), fs = require("fs"), path = require("path");
let chromium; try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = require("/opt/node-tools/node_modules/playwright")); }
const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const which = (args.find(a => !a.startsWith("--")) || "all");
const outDir = args.includes("--out") ? path.resolve(args[args.indexOf("--out") + 1]) : path.join(ROOT, "app", "demo");
const write = !args.includes("--no-write");
const IDS = ["living", "kitchen", "bedroom"].filter(id => which === "all" || which === id);
exports.serve = () => new Promise(res => {
  const s = http.createServer((q, r) => {
    let f = path.join(ROOT, decodeURIComponent(q.url.split("?")[0])); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
    r.setHeader("content-type", { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg" }[path.extname(f)] || "application/octet-stream");
    fs.createReadStream(f).pipe(r);
  });
  s.listen(0, "127.0.0.1", () => res(s));
});
async function main() {
  const srv = await exports.serve();
  const exe = process.env.CHROME_PATH || ["/usr/bin/google-chrome", "/opt/pw-browsers/chromium"].find(p => fs.existsSync(p));
  const b = await chromium.launch({ executablePath: exe, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
  let exit = 0;
  for (const id of IDS) {
    const spec = require(path.join(__dirname, "showcase", "specs", id + ".cjs"));
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.addInitScript(() => { try { localStorage.setItem("ebanist_lic", JSON.stringify({ kind: "stripe", key: "comp_TESTTESTTESTTESTTESTTEST", status: "active", activated: true, checkedAt: Date.now() })); } catch (e) {} });
    const pg = await ctx.newPage(); pg.setDefaultTimeout(600000);
    const errs = []; pg.on("pageerror", e => errs.push("PAGEERR " + String(e).slice(0, 200))); pg.on("console", m => { if (m.type() === "error") errs.push("CONSOLE " + m.text().slice(0, 200)); });
    await pg.goto(`http://127.0.0.1:${srv.address().port}/app/index.html?lang=en`);
    await pg.waitForFunction(() => window.MAT_LOADED === true); await pg.waitForTimeout(2500);
    await pg.locator("#btnIntroGo").click({ timeout: 1500 }).catch(() => {});
    await pg.addScriptTag({ path: path.join(__dirname, "showcase", "inpage.js") });
    const t0 = Date.now();
    const res = await pg.evaluate(async spec => {
      const rep = await SC.build(spec); const p = proj();
      const info = await SC.check(p);
      return { rep, info, project: p };
    }, spec);
    const { rep, info, project } = res;
    const bad = [].concat(rep.errors, info.bad || []); if (rep.fixes && rep.fixes.length) console.log("  corecturi raft (aplicația):", rep.fixes.join("; "));
    const sig = info.cutSig; delete info.cutSig;
    console.log(`\n== ${id} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    console.log(JSON.stringify(info));
    bad.forEach(x => console.log("  ✗", x)); errs.forEach(x => console.log("  !", x));
    if (bad.length || errs.length) exit = 1;
    if (write && !bad.length) {
      fs.mkdirSync(outDir, { recursive: true });
      const out = JSON.parse(JSON.stringify(project));
      delete out.id; delete out.demo; out.showcase = id; out.names = spec.names; out.date = "2026-11-19";
      out.pieces.forEach(x => { delete x.id; });
      fs.writeFileSync(path.join(outDir, id + ".json"), JSON.stringify(out, null, 1) + "\n");
      console.log("  scris", path.join(outDir, id + ".json"), out.pieces.length, "piese");
    }
    if (process.env.KEEP) fs.writeFileSync(process.env.KEEP + "/" + id + ".proj.json", JSON.stringify(project));
    await ctx.close();
  }
  await b.close(); srv.close();
  process.exitCode = exit;
}
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
