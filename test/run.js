/* Ebanist — suite di regressione.
 *
 *   cd test && npm install && npm test
 *
 * Serve la cartella dell'app su una porta libera, la apre in Chromium a
 * misura di telefono e verifica le cose che si rompono in silenzio: il tasto
 * Indietro, i conti che devono tornare, e che le viste si disegnino senza
 * errori JS. Niente framework: un file, nessuna configurazione.
 *
 * Il browser: di default quello di Playwright. In un container dove i browser
 * stanno altrove si passa CHROME_PATH=/percorso/al/chrome.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const MIME = { ".html":"text/html", ".js":"text/javascript", ".json":"application/json",
               ".webmanifest":"application/manifest+json", ".css":"text/css", ".svg":"image/svg+xml",
               ".png":"image/png", ".ico":"image/x-icon" };

function serve() {
  return new Promise(res => {
    const s = http.createServer((req, rq) => {
      const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
      const f = path.join(ROOT, rel);
      // niente traversal: si serve solo da dentro la cartella dell'app
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rq.writeHead(404); return rq.end(); }
      rq.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" });
      fs.createReadStream(f).pipe(rq);
    });
    s.listen(0, "127.0.0.1", () => res(s));
  });
}

const results = [];
function ok(name, cond, detail) {
  results.push({ name, cond });
  console.log((cond ? "  \x1b[32m✓\x1b[0m " : "  \x1b[31m✗\x1b[0m ") + name + (detail !== undefined ? "  \x1b[2m→ " + detail + "\x1b[0m" : ""));
}
const head = s => console.log("\n\x1b[1m" + s + "\x1b[0m");

(async () => {
  const server = await serve();
  const URL = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const pg = await browser.newPage({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });

  const errs = [];
  pg.on("pageerror", e => errs.push("pageerror: " + e));
  pg.on("console", m => {
    const x = m.text();
    // i CDN esterni (font, supabase) non sono raggiungibili offline: non sono errori dell'app
    if (m.type() === "error" && !/ERR_CONNECTION|ERR_NAME|ERR_INTERNET|Failed to load resource/.test(x)) errs.push("console: " + x);
  });

  await pg.goto(URL);
  await pg.waitForTimeout(3300);                 // intro animata
  await pg.evaluate(() => closeSheets());        // alla prima apertura c'e il pannello introduttivo
  await pg.waitForTimeout(400);

  const depth  = () => pg.evaluate(() => navDepth());
  const view   = () => pg.evaluate(() => currentView);
  const sheets = () => pg.evaluate(() => document.querySelectorAll(".sheet.on").length);

  head("Tasto Indietro — deve chiudere uno strato, non l'app");
  ok("base pulita dopo l'intro", await depth() === 0);

  await pg.evaluate(() => openSheet("shSettings")); await pg.waitForTimeout(200);
  ok("pannello aperto → profondita 1", await depth() === 1 && await sheets() === 1);
  await pg.goBack(); await pg.waitForTimeout(300);
  ok("Indietro chiude il pannello e resta nell'app", await sheets() === 0 && await depth() === 0);

  await pg.evaluate(() => setView("nest")); await pg.waitForTimeout(300);
  ok("cambio vista → profondita 1", await view() === "nest" && await depth() === 1);
  await pg.goBack(); await pg.waitForTimeout(300);
  ok("Indietro torna alla schermata iniziale", await view() === "projects" && await depth() === 0);

  await pg.evaluate(() => setView("summary")); await pg.waitForTimeout(250);
  await pg.evaluate(() => openSheet("shStock"));  await pg.waitForTimeout(250);
  ok("strati impilati → profondita 2", await depth() === 2);
  await pg.goBack(); await pg.waitForTimeout(250);
  ok("1° Indietro: solo il pannello, la vista resta", await sheets() === 0 && await view() === "summary");
  await pg.goBack(); await pg.waitForTimeout(250);
  ok("2° Indietro: torna a projects", await view() === "projects");

  // chiusura dalla UI: la history non deve restare appesa, o il prossimo Indietro non farebbe niente
  await pg.evaluate(() => openSheet("shSettings")); await pg.waitForTimeout(200);
  await pg.evaluate(() => closeSheets());          await pg.waitForTimeout(400);
  ok("chiusura dalla UI riallinea la history", await depth() === 0 && await pg.evaluate(() => NAV.hist) === 0);

  await pg.evaluate(() => openSheet("shSettings")); await pg.waitForTimeout(200);
  await pg.keyboard.press("Escape");               await pg.waitForTimeout(250);
  ok("Esc chiude il pannello (desktop)", await sheets() === 0);

  head("Uscita dalla radice — due pressioni, non una");
  await pg.goBack(); await pg.waitForTimeout(300);
  const alive = await pg.evaluate(() => !!document.getElementById("toast"));
  ok("1° Indietro alla radice NON chiude l'app", alive);
  const msg = alive ? await pg.evaluate(() => document.getElementById("toast").textContent) : "(pagina persa)";
  ok("avvisa invece di uscire", /uscire|ieși|exit|quitter/i.test(msg), msg);
  if (alive) {
    await pg.goBack(); await pg.waitForTimeout(400);
    const gone = await pg.evaluate(() => !!document.getElementById("toast")).catch(() => false);
    ok("2° Indietro entro 2,2s esce davvero", gone === false);
  }

  // da qui in poi serve di nuovo una pagina viva
  await pg.goto(URL); await pg.waitForTimeout(3300);
  await pg.evaluate(() => closeSheets()); await pg.waitForTimeout(300);

  head("Costi — ogni riga si moltiplica, la somma torna");
  await pg.evaluate(() => setView("summary")); await pg.waitForTimeout(600);
  const C = await pg.evaluate(() => {
    const c = projectCosts(proj());
    return { rows: c.rows.map(r => ({ q: r.qty, u: r.unit, t: r.tot })), cP: c.cPanels, pn: c.panelsNew, w: c.cWhole };
  });
  ok("qta × prezzo = importo, su ogni riga", C.rows.every(r => Math.abs(r.q * r.u - r.t) < 0.01));
  const sum = C.rows.reduce((s, r) => s + r.t, 0);
  ok("somma righe = subtotale pannelli", Math.abs(sum - C.cP) < 0.01, "€" + sum.toFixed(2));

  const modes = await pg.evaluate(() => {
    const S = state.settings, keep = S.costMode;
    S.costMode = "panels"; const a = projectCosts(proj());
    S.costMode = "area";   const b = projectCosts(proj());
    S.costMode = keep;
    return { pan: a.cPanels, area: b.cPanels };
  });
  ok("i due modi di costo danno numeri distinti e positivi", modes.pan > 0 && modes.area > 0 && modes.pan !== modes.area,
     "pannelli €" + modes.pan.toFixed(2) + " · m² €" + modes.area.toFixed(2));
  ok("il default resta 'area': i preventivi gia fatti non cambiano da soli",
     await pg.evaluate(() => defaultState().settings.costMode) === "area");
  ok("in modo 'area' mostra comunque i pannelli da comprare", C.pn > 0 && C.w > 0, C.pn + " pannelli = €" + C.w.toFixed(2));

  head("Bordatura — sui pezzi obliqui si misura il lato reale");
  const eb = await pg.evaluate(() => ({
    dritto:  bandingMm("2L+2C", 1000, 600, null, null),
    obliquo: bandingMm("2L+2C", 1000, 600, 60, null),
    cap:     bandingMm("3L",    1000, 600, null, null)
  }));
  ok("pezzo dritto invariato — nessuna regressione", eb.dritto === 3200, eb.dritto);
  ok("pezzo obliquo diverso dal nominale", eb.obliquo !== eb.dritto, eb.obliquo.toFixed(1));
  ok("'3L' limitato a 2 lati lunghi", eb.cap === 2000, eb.cap);

  head("Generatore — quello che non entra si dice, non sparisce");
  const w = await pg.evaluate(() => {
    const r = buildModule(Object.assign({}, PRESETS.armadio, { H: 800, drawers: 6, doors: 2, shelves: 0, hang: 0 }));
    return { skip: (r.warn || {}).doorSkip || 0, ante: r.pieces.filter(x => /^Anta/.test(x.elemento)).length };
  });
  ok("ante non generate → avviso", w.skip > 0, "doorSkip=" + w.skip + ", ante in distinta=" + w.ante);

  head("Preventivo — nessun NaN sotto gli occhi del cliente");
  const q = await pg.evaluate(() => {
    const keepP = state.projects, keepA = state.activeId;
    state.projects = [{ id: "vuoto", name: "vuoto", pieces: [], configs: {} }]; state.activeId = "vuoto";
    let out; try { document.getElementById("btnQuote").click(); out = document.getElementById("printArea").innerHTML; }
    finally { state.projects = keepP; state.activeId = keepA; }
    return out;
  });
  ok("preventivo con area zero non stampa NaN", !/NaN/.test(q));

  head("Pannelli — chiusura raggiungibile ovunque");
  const nx = await pg.evaluate(() => [document.querySelectorAll(".sheet .sheet-x").length, document.querySelectorAll(".sheet").length]);
  ok("ogni pannello ha la sua X", nx[0] === nx[1], nx[0] + "/" + nx[1]);
  await pg.evaluate(() => openSheet("shSettings")); await pg.waitForTimeout(350);
  await pg.evaluate(() => { const s = document.getElementById("shSettings"); s.scrollTop = s.scrollHeight; });
  await pg.waitForTimeout(350);
  ok("la X resta in vista anche scorrendo un pannello lungo", await pg.evaluate(() => {
    const s = document.getElementById("shSettings"), x = s.querySelector(".sheet-x");
    const a = s.getBoundingClientRect(), c = x.getBoundingClientRect();
    return c.top >= a.top - 2 && c.bottom <= a.bottom + 2 && c.width > 0;
  }));
  await pg.click("#shSettings .sheet-x"); await pg.waitForTimeout(350);
  /* l'invariante vera non e "hist a zero" — qui sotto c'e ancora una vista aperta —
     ma "la history conta esattamente gli strati aperti": se si scollano, il
     prossimo Indietro salta uno strato o non fa niente. */
  const [h, d] = await pg.evaluate(() => [NAV.hist, navDepth()]);
  ok("la X chiude il pannello", await sheets() === 0);
  ok("history allineata alla profondita reale", h === d, "hist=" + h + " depth=" + d);

  head("Tutte le viste si disegnano");
  for (const v of ["projects", "survey", "build", "list", "nest", "summary"]) {
    await pg.evaluate(x => setView(x), v);
    await pg.waitForTimeout(450);
  }
  ok("nessun errore JS su nessuna vista", errs.length === 0);
  if (errs.length) console.log("    " + errs.slice(0, 6).join("\n    "));

  const bad = results.filter(r => !r.cond).length;
  console.log(`\n\x1b[1m${results.length - bad}/${results.length} test superati\x1b[0m\n`);
  await browser.close();
  server.close();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
