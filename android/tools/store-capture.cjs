/* Ebanist — capturile paginii din Google Play, în limba fiecărei listări (D-128).
   --------------------------------------------------------------------------
   Nimic nu e desenat de mână: ecranele ies din aplicația din acest repo, pe
   proiectul „Wardrobe W1000" (ca site-src/tools/capture.cjs), apoi fiecare
   ecran primește o bandă cu titlul în limba lui. Ieșire în android/store:
     <limbă>/images/phoneScreenshots/01…07.png   1080×1920
     <limbă>/images/featureGraphic/feature.png   1024×500
   Rulare, din rădăcina repo-ului:
     python3 -m http.server 8765 &
     NODE_PATH=/opt/node-tools/node_modules node android/tools/store-capture.cjs [en-US ro it-IT fr-FR]
   Apoi: workflow-ul play-listing cu cmd=listing, images=da. */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const BASE = process.env.BASE || "http://localhost:8765";
const GL = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
/* Fixture local, numai în browserul de captură: arată ecranele Pro așa cum le vede un abonat. */
const PRO = () => localStorage.setItem("ebanist_lic", JSON.stringify({ kind: "play", key: "capture-fixture", status: "active", activated: true, checkedAt: Date.now() }));
const APPLANG = { "en-US": "en", ro: "ro", "it-IT": "it", "fr-FR": "fr" };
const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(APPLANG);

/* titluri pe ecran: fiecare spune ce primește omul, nu numele ecranului */
const T = {
  "en-US": ["Enter the size. The carcass builds itself.", "Live 3D with real Egger decors", "Cut list to 0.1 mm, edging per part", "Cutting plans that keep your offcuts", "Materials, edging and price, instantly", "Hardware and costs counted for you", "Client Mode: finishes, price, signature"],
  ro: ["Scrii cotele. Carcasa se face singură.", "3D live cu decoruri Egger reale", "Listă de debitare la 0,1 mm, cant pe piesă", "Planuri de debitare care țin resturile", "Materiale, cant și preț, pe loc", "Feroneria și costurile, numărate pentru tine", "Mod Client: finisaje, preț, semnătură"],
  "it-IT": ["Inserisci le misure. La struttura si fa da sola.", "3D dal vivo con decori Egger reali", "Distinta di taglio a 0,1 mm, bordo per pezzo", "Piani di taglio che tengono gli sfridi", "Materiali, bordi e prezzo, subito", "Ferramenta e costi, contati per te", "Modalità Cliente: finiture, prezzo, firma"],
  "fr-FR": ["Saisissez les cotes. Le caisson se fait seul.", "3D en direct avec de vrais décors Egger", "Fiche de débit au 0,1 mm, chant par pièce", "Plans de débit qui gardent les chutes", "Matériaux, chants et prix, en un clin d'œil", "Quincaillerie et coûts comptés pour vous", "Mode Client : finitions, prix, signature"]
};
const TAG = {
  "en-US": ["Furniture design for cabinetmakers", "Cut lists, part labels, quotes. Offline."],
  ro: ["Proiectare mobilier pentru tâmplari", "Liste de debitare, etichete, oferte. Offline."],
  "it-IT": ["Progettazione mobili per falegnami", "Distinte, etichette, preventivi. Offline."],
  "fr-FR": ["Conception de meubles pour ébénistes", "Fiches de débit, étiquettes, devis. Hors ligne."]
};
const FONT = "system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

async function phone(b, lang) {
  const c = await b.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
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
  return { c, p };
}

async function compose(b, shotPath, caption, out) {
  const img = "data:image/png;base64," + fs.readFileSync(shotPath).toString("base64");
  const c = await b.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const p = await c.newPage();
  await p.setContent(`<body style="margin:0;width:1080px;height:1920px;background:linear-gradient(160deg,#0E3B2A,#0a2a1e);font-family:${FONT};overflow:hidden;position:relative">
    <div style="position:absolute;left:60px;right:60px;top:70px;height:250px;display:flex;align-items:center;justify-content:center;text-align:center;color:#fff;font-size:68px;font-weight:700;line-height:1.12;letter-spacing:-1px">${caption}</div>
    <div style="position:absolute;left:100px;top:350px;width:880px;height:1716px;border-radius:56px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.55);border:6px solid #D4AF37"><img src="${img}" style="width:100%;display:block"></div></body>`);
  await p.waitForTimeout(300);
  await p.screenshot({ path: out });
  await c.close();
}

async function feature(b, shotPath, lang, out) {
  const img = "data:image/png;base64," + fs.readFileSync(shotPath).toString("base64");
  const c = await b.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  const p = await c.newPage();
  await p.setContent(`<body style="margin:0;width:1024px;height:500px;background:linear-gradient(120deg,#0E3B2A,#0a2a1e);font-family:${FONT};overflow:hidden;position:relative;color:#fff">
    <div style="position:absolute;left:56px;top:96px;width:520px"><div style="font-size:92px;font-weight:800;letter-spacing:-3px;line-height:1">Ebanist</div>
    <div style="margin-top:22px;font-size:32px;font-weight:600;color:#E3C877;line-height:1.2">${TAG[lang][0]}</div>
    <div style="margin-top:14px;font-size:24px;opacity:.85;line-height:1.3">${TAG[lang][1]}</div></div>
    <div style="position:absolute;left:640px;top:38px;width:300px;height:640px;border-radius:30px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.5);border:4px solid #D4AF37;transform:rotate(4deg)"><img src="${img}" style="width:100%;display:block"></div></body>`);
  await p.waitForTimeout(300);
  await p.screenshot({ path: out });
  await c.close();
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium", args: GL });
  const tmp = process.env.TMPDIR_CAP || "/tmp/ebanist-play-cap"; fs.mkdirSync(tmp, { recursive: true });
  for (const L of LANGS) {
    console.log("==", L);
    const base = path.join(ROOT, "android/store", L, "images");
    fs.mkdirSync(path.join(base, "phoneScreenshots"), { recursive: true });
    fs.mkdirSync(path.join(base, "featureGraphic"), { recursive: true });
    const { c, p } = await phone(b, APPLANG[L]);
    const raw = [];
    const shot = async (name) => { const f = `${tmp}/${L}-${name}.png`; await p.screenshot({ path: f }); raw.push(f); };
    await p.click('[data-view="build"]'); await p.waitForTimeout(5500); await shot("1-form");
    await p.click("#btnOpen3d"); await p.waitForTimeout(2000);
    await p.click("#btnExplode").catch(() => {}); await p.waitForTimeout(2200); await shot("2-3d");
    const scroll = async (dy) => { await p.mouse.move(195, 400); await p.mouse.wheel(0, dy); await p.waitForTimeout(700); };
    await p.click('[data-view="list"]'); await p.waitForTimeout(1200); await shot("3-list");
    await p.click('[data-view="nest"]'); await p.waitForTimeout(1200); await scroll(380); await shot("4-nest");
    await p.click('[data-view="summary"]'); await p.waitForTimeout(1200); await shot("5-summary");
    await scroll(620); await shot("6-hardware");
    await p.click('[data-view="build"]').catch(() => {}); await p.waitForTimeout(700);
    await p.click("#btnClient").catch(() => {}); await p.waitForTimeout(3000); await shot("7-client");
    await c.close();
    raw.forEach((f, i) => console.log("  raw", path.basename(f)));
    for (let i = 0; i < raw.length; i++) await compose(b, raw[i], T[L][i], path.join(base, "phoneScreenshots", String(i + 1).padStart(2, "0") + ".png"));
    await feature(b, raw[1], L, path.join(base, "featureGraphic", "feature.png"));
  }
  await b.close();
})();
