/* Capturi reale pentru pagina de caz „Dulap de baie, Monaco”.
   node site-src/tools/case-capture.cjs <Ebanist_Backup.json> [index-proiect]
   Backup-ul NU se comite (are datele clientului). Proiectul se anonimizează
   în copie: numele devine cel de mai jos, clientul/telefonul/notițele se golesc.
   Ieșire: site/screens/<l>/case-bagno-{build,list,part}.png + site/img/case/labels-<l>.png
   apoi: python3 site-src/tools/case2img.py */
const { chromium } = require(process.env.PW || "playwright");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const [, , bk, idx = "0"] = process.argv;
const NAME = { en: "Bathroom cabinet · Monaco", ro: "Dulap baie · Monaco", it: "Armadio bagno · Monaco", fr: "Armoire salle de bain · Monaco" };
(async () => {
  const src = JSON.parse(fs.readFileSync(bk, "utf8"));
  const b = await chromium.launch();
  for (const L of Object.keys(NAME)) {
    const p = JSON.parse(JSON.stringify(src.state.projects[+idx]));
    Object.assign(p, { name: NAME[L], client: "", phone: "", notes: "", deadline: "" });
    const st = Object.assign({}, src.state, { projects: [p], activeId: p.id, seenIntro: 1, lang: L });
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: L, colorScheme: "light" });
    await ctx.addInitScript(s => { if (!sessionStorage.getItem("x")) { sessionStorage.setItem("x", 1); localStorage.setItem("tagliapro", s); } }, JSON.stringify(st));
    const pg = await ctx.newPage(); pg.on("pageerror", e => console.log("ERR", e.message));
    await pg.goto(`http://localhost:8765/app/?lang=${L}`); await pg.waitForTimeout(2500);
    const out = path.join(ROOT, "site/screens", L); fs.mkdirSync(out, { recursive: true });
    const shot = async n => { await pg.waitForTimeout(900); await pg.screenshot({ path: `${out}/case-bagno-${n}.png` }); };
    await pg.evaluate(() => { PRO = true; openBuilder(Object.keys(proj().configs)[0]); }); await shot("build");
    await pg.evaluate(() => { setView("list"); render(); window.scrollTo(0, 0); }); await shot("list");
    await pg.evaluate(() => { const q = proj(); openPartFromRow(Object.keys(q.configs)[0], q.pieces[0]); }); await pg.waitForTimeout(800); await shot("part");
    /* etichetele: exact foaia pe care o tipărește butonul Etichete */
    await pg.evaluate(() => { PRINT_CAPTURE = []; window.print = () => {}; $("btnLabels").click(); $("printArea").innerHTML = PRINT_CAPTURE[0] || $("printArea").innerHTML; });
    await pg.setViewportSize({ width: 900, height: 1200 }); await pg.emulateMedia({ media: "print" }); await pg.waitForTimeout(400);
    const box = await pg.evaluate(() => { const a = [...document.querySelectorAll("#printArea .lbl")].slice(0, 6).map(e => e.getBoundingClientRect());
      return { x: Math.min(...a.map(r => r.left)), y: Math.min(...a.map(r => r.top)), width: Math.max(...a.map(r => r.right)) - Math.min(...a.map(r => r.left)), height: Math.max(...a.map(r => r.bottom)) - Math.min(...a.map(r => r.top)) }; });
    await pg.screenshot({ path: path.join(ROOT, `site/img/case/labels-${L}.png`), clip: box });
    console.log(L, "ok"); await ctx.close();
  }
  await b.close();
})();
