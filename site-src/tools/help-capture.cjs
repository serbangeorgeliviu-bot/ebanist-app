/* Ebanist — capturile pentru ajutor (D-109).
   -------------------------------------------------------------------
   Aceleași reguli ca la capture.cjs: nimic nu e desenat de mână. Fiecare
   imagine iese din aplicația din acest repo, pe proiectul curat „Wardrobe
   W1000", în fiecare limbă. Diferența: pe butonul la care se referă pasul
   se pune un cerc de evidențiere (un element DOM temporar, nu pixeli
   retușați), ca cititorul să știe unde să apese.

   Rulare (din rădăcina repo-ului, cu un server static pe 8765):
     python3 -m http.server 8765 &
     NODE_PATH=test/node_modules node site-src/tools/help-capture.cjs [en ro it fr de pl es]
     python3 site-src/tools/help-shots.py
   Ieșire: site/screens/<lang>/help-*.png → help-shots.py le face AVIF + WebP.
   Le folosește app/ebanist-help.js (SHOTS) — aplicația și site-ul.        */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const BASE = process.env.BASE || "http://localhost:8765";
const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : ["en", "ro", "it", "fr", "de", "pl", "es"];
const GL = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const PRO = () => localStorage.setItem("ebanist_lic", JSON.stringify({ kind: "legacy", key: "EBP-TEST", valid: true, activated: true, checkedAt: Date.now() }));

/* cercul: același aspect în toate capturile */
async function ring(p, selectors) {
  await p.evaluate(sels => {
    document.querySelectorAll(".help-ring").forEach(n => n.remove());
    for (const sel of sels) {
      const el = typeof sel === "string" ? document.querySelector(sel) : null;
      if (!el) throw new Error("fără element: " + sel);
      const r = el.getBoundingClientRect(), pad = 6, d = document.createElement("div");
      d.className = "help-ring";
      d.style.cssText = `position:fixed;z-index:99999;pointer-events:none;left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + 2 * pad}px;height:${r.height + 2 * pad}px;` +
        "border:3px solid #ff5a1f;border-radius:14px;box-shadow:0 0 0 4px rgba(255,255,255,.9),0 0 0 8px rgba(255,90,31,.35)";
      document.body.appendChild(d);
    }
  }, selectors);
}

async function start(b, lang, pro) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  if (pro) await c.addInitScript(PRO);
  const p = await c.newPage();
  p.on("pageerror", e => console.log("  pageerror", e.message));
  await p.goto(`${BASE}/app/?lang=${lang}`); await p.waitForTimeout(2000);
  await p.click("#btnIntroGo").catch(() => {});
  await p.evaluate(() => { window.print = () => {}; });
  await p.click('[data-view="projects"]'); await p.click("#btnNewProject"); await p.waitForTimeout(400);
  await p.fill("#prName", "Wardrobe W1000"); await p.fill("#prClient", "Atelier demo");
  await p.click("#btnProjectSave"); await p.waitForTimeout(600);
  return p;
}
/* notificarea („Salvat”, „29 piese”) stă ~2,5 s peste ecran: se așteaptă să dispară */
const shot = async (p, out, name) => { await p.waitForTimeout(3000); await p.screenshot({ path: `${out}/help-${name}.png` }); };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium", args: GL });
  for (const L of LANGS) {
    console.log("==", L);
    const out = path.join(ROOT, "site/screens", L); fs.mkdirSync(out, { recursive: true });

    let p = await start(b, L, true);
    /* 1 · proiectele: butonul „Proiect nou” */
    await p.click('[data-view="projects"]'); await p.waitForTimeout(700);
    await ring(p, ["#btnNewProject"]); await shot(p, out, "projects");

    /* 2 · generatorul: butonul „Generează lista” (apăsarea lui duce la listă, deci captura se face ÎNAINTE) */
    await p.click('[data-view="build"]'); await p.waitForTimeout(900);
    await p.evaluate(() => { const s = document.getElementById("bMatFront"); s.value = "nogal_victoria_19"; s.dispatchEvent(new Event("change", { bubbles: true })); });
    await p.waitForTimeout(700);
    await p.evaluate(() => document.getElementById("btnGenerate").scrollIntoView({ block: "center" })); await p.waitForTimeout(500);
    await ring(p, ["#btnGenerate"]); await shot(p, out, "build");
    await p.evaluate(() => document.querySelectorAll(".help-ring").forEach(n => n.remove()));
    await p.click("#btnGenerate"); await p.waitForTimeout(1500);

    /* 3 · lista (se deschide singură după generare): butonul + */
    await p.waitForTimeout(500);
    await ring(p, ["#fab"]); await shot(p, out, "list");
    await p.evaluate(() => document.querySelectorAll(".help-ring").forEach(n => n.remove()));

    /* 4 · 3D: vederea explodată și ușile deschise, în fila Generator */
    await p.click('[data-view="build"]'); await p.waitForTimeout(1200);
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.click("#btnExplode"); await p.waitForTimeout(2200);
    await p.evaluate(() => document.getElementById("btnExplode").scrollIntoView({ block: "center" })); await p.waitForTimeout(400);
    await ring(p, ["#btnExplode", "#btnOpen3d"]); await shot(p, out, "3d");
    await p.evaluate(() => document.querySelectorAll(".help-ring").forEach(n => n.remove()));

    /* 5 · rezumat: butonul „PDF listă” */
    await p.click('[data-view="summary"]'); await p.waitForTimeout(1000);
    await p.evaluate(() => document.getElementById("btnPdf").scrollIntoView({ block: "center" })); await p.waitForTimeout(500);
    await ring(p, ["#btnPdf"]); await shot(p, out, "docs");

    /* 6 · setări: catalogul propriu */
    await p.evaluate(() => { document.querySelectorAll(".help-ring").forEach(n => n.remove()); });
    await p.click("#btnSettings"); await p.waitForTimeout(700);
    await p.evaluate(() => document.getElementById("btnCatalog").scrollIntoView({ block: "center" })); await p.waitForTimeout(600);
    await ring(p, ["#btnCatalog"]); await shot(p, out, "settings");
    await p.context().close();

    /* 7 · ecranul Pro, în varianta gratuită: „Am deja o cheie” */
    p = await start(b, L, false);
    await p.evaluate(() => { renderPro("projects"); closeSheets(); openSheet("shPro"); }); await p.waitForTimeout(700);
    /* câmpul în care se lipește codul și butonul „Activează” */
    await p.evaluate(() => document.getElementById("proKey").scrollIntoView({ block: "center" })); await p.waitForTimeout(500);
    await ring(p, ["#proKey", "#proGo"]); await shot(p, out, "pro");
    await p.context().close();
  }
  await b.close();
})();
