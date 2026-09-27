/* Ebanist — capturi reale din aplicație pentru site-ul de prezentare.
   -------------------------------------------------------------------
   Nimic nu e desenat de mână: fiecare ecran și fiecare document de pe site
   iese din aplicația din acest repo, pe un proiect curat („Wardrobe W1000",
   dulapul exemplu cu fronturi Nogal Victoria).

   Rulare (din rădăcina repo-ului, cu un server static pornit pe 8765):
     python3 -m http.server 8765 &
     NODE_PATH=test/node_modules node site-src/tools/capture.cjs [en ro it fr]
     python3 site-src/tools/pdf2img.py
   Ieșire:
     site/screens/<lang>/*.png  → convertite de pdf2img.py în AVIF + WebP
     /tmp/ebanist-docs/<lang>-*.pdf → paginile din site/docs/<lang>/        */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const BASE = process.env.BASE || "http://localhost:8765";
const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : ["en", "ro", "it", "fr"];
const TMP = "/tmp/ebanist-docs";
const GL = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const PRO = () => localStorage.setItem("ebanist_lic", JSON.stringify({ kind: "legacy", key: "EBP-TEST", valid: true, activated: true, checkedAt: Date.now() }));

async function project(b, lang, vp, mobile) {
  const c = await b.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: !!mobile, hasTouch: !!mobile });
  await c.addInitScript(PRO);
  const p = await c.newPage();
  p.on("pageerror", e => console.log("  pageerror", e.message));
  await p.goto(`${BASE}/app/?lang=${lang}`); await p.waitForTimeout(2000);
  await p.click("#btnIntroGo").catch(() => {});
  await p.evaluate(() => { window.print = () => {}; });
  await p.click('[data-view="projects"]'); await p.click("#btnNewProject"); await p.waitForTimeout(400);
  await p.fill("#prName", "Wardrobe W1000"); await p.fill("#prClient", "Atelier demo");
  await p.click("#btnProjectSave"); await p.waitForTimeout(600);
  await p.click('[data-view="build"]'); await p.waitForTimeout(900);
  await p.evaluate(() => { const s = document.getElementById("bMatFront"); s.value = "nogal_victoria_19"; s.dispatchEvent(new Event("change", { bubbles: true })); });
  await p.waitForTimeout(700);
  await p.click("#btnGenerate"); await p.waitForTimeout(1200);
  return p;
}

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium", args: GL });
  for (const L of LANGS) {
    console.log("==", L);
    const out = path.join(ROOT, "site/screens", L); fs.mkdirSync(out, { recursive: true });
    /* documentele, exact cum le tipărește aplicația */
    let p = await project(b, L, { width: 1440, height: 900 });
    const docs = [["summary", "btnPdf", "distinta"], ["summary", "btnMont", "montaj"], ["summary", "btnLabels", "etichete"], ["summary", "btnQuote", "oferta"], ["build", "btnDraw", "desen"]];
    for (const [view, btn, name] of docs) {
      await p.click(`[data-view="${view}"]`); await p.waitForTimeout(600);
      await p.evaluate(() => { document.getElementById("printArea").innerHTML = ""; });
      await p.click("#" + btn); await p.waitForTimeout(1300);
      if (btn === "btnPdf") { await p.check("#clOk"); await p.click("#btnClGo"); await p.waitForTimeout(1500); }
      await p.pdf({ path: `${TMP}/${L}-${name}.pdf`, format: "A4", printBackground: true, preferCSSPageSize: true });
      await p.keyboard.press("Escape").catch(() => {});
    }
    /* datele proiectului: site-ul le citește din site-src/data/wardrobe.json */
    if (L === "en") {
      const data = await p.evaluate(() => { const pr = state.projects.find(x => x.id === state.activeId); return pr.pieces.map(x => ({ el: x.elemento, l: x.lung, w: x.larg, pz: x.pz, edge: x.bordo, mat: x.materiale })); });
      fs.writeFileSync(path.join(ROOT, "site-src/data/wardrobe-pieces.json"), JSON.stringify(data, null, 1));
    }
    /* PC: vederea explodată */
    await p.click('[data-view="build"]'); await p.waitForTimeout(900);
    await p.click("#btnExplode"); await p.waitForTimeout(2200);
    await p.screenshot({ path: `${out}/pc-explode.png` });
    await p.context().close();
    /* telefon */
    p = await project(b, L, { width: 390, height: 844 }, true);
    await p.click('[data-view="build"]'); await p.waitForTimeout(900);
    await p.click("#btnOpen3d"); await p.waitForTimeout(1800);
    await p.screenshot({ path: `${out}/phone-build.png` });
    for (const v of ["list", "nest", "summary", "survey"]) {
      await p.click(`[data-view="${v}"]`); await p.waitForTimeout(1100);
      await p.screenshot({ path: `${out}/phone-${v}.png` });
    }
    await p.context().close();
    /* tabletă, modul Client */
    p = await project(b, L, { width: 1180, height: 820 }, true);
    await p.click('[data-view="build"]').catch(() => {}); await p.waitForTimeout(600);
    await p.click("#btnClient"); await p.waitForTimeout(3000);
    await p.screenshot({ path: `${out}/tablet-client.png` });
    await p.context().close();
  }
  await b.close();
})();
