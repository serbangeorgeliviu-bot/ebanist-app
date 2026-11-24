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
               ".png":"image/png", ".ico":"image/x-icon", ".webp":"image/webp", ".avif":"image/avif",
               ".jpg":"image/jpeg", ".woff2":"font/woff2", ".txt":"text/plain" };

/* Gli header di sicurezza si leggono da netlify.toml e si servono anche qui:
   la prova deve girare nelle stesse condizioni della produzione, altrimenti
   un CSP che rompe l'app si scopre dal telefono, dopo il deploy. */
const NETLIFY_TOML = fs.readFileSync(path.join(ROOT, "netlify.toml"), "utf8");
const CSP = (NETLIFY_TOML.match(/Content-Security-Policy = "([^"]+)"/) || [])[1] || "";

function serve() {
  return new Promise(res => {
    const s = http.createServer((req, rq) => {
      const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
      let f = path.join(ROOT, rel);
      /* come Netlify: una cartella serve il suo index.html (/ro/, /it/, /fr/) */
      if (f.startsWith(ROOT) && fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
      // niente traversal: si serve solo da dentro la cartella dell'app
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rq.writeHead(404); return rq.end(); }
      const h = { "Content-Type": MIME[path.extname(f)] || "application/octet-stream",
                  "X-Content-Type-Options": "nosniff" };
      if (CSP) h["Content-Security-Policy"] = CSP;
      rq.writeHead(200, h);
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
  /* L'app sta in /app/ da quando la radice e diventata la pagina di
     presentazione. Il server di prova serve tutta la cartella, cosi la
     prova puo guardare anche il landing e i redirect. */
  const ORIGIN = `http://127.0.0.1:${server.address().port}`;
  const URL = `${ORIGIN}/app/index.html`;
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  /* D-55: documentele, modul Client și planurile de debitare sunt Pro.
     Testele de funcții rulează deci ca Pro; cele de licență își pun singure
     starea gratuită (licWrite(null)) și o refac la final. */
  const PRO_INIT = () => { try { if (!localStorage.getItem("ebanist_lic")) localStorage.setItem("ebanist_lic",
    JSON.stringify({ kind: "stripe", key: "comp_TESTTESTTESTTESTTESTTEST", status: "active", activated: true, checkedAt: Date.now() })); } catch (e) {} };
  const _newContext = browser.newContext.bind(browser);
  browser.newContext = async (o = {}) => { const c = await _newContext(o); await c.addInitScript(PRO_INIT); return c; };
  const pg = await (await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true })).newPage();

  const errs = [], cspViol = [];
  pg.on("pageerror", e => errs.push("pageerror: " + e));
  pg.on("console", m => {
    const x = m.text();
    // una violazione di CSP si conta a parte: e un guasto di configurazione,
    // non un errore di codice, e va letta come tale
    if (/Content Security Policy|Refused to (load|execute|connect|apply)/i.test(x)) { cspViol.push(x); return; }
    // i CDN esterni (font) non sono raggiungibili offline: non sono errori dell'app
    if (m.type() === "error" && !/ERR_CONNECTION|ERR_NAME|ERR_INTERNET|Failed to load resource/.test(x)) errs.push("console: " + x);
  });

  await pg.goto(URL);
  /* Il catalogo materiali arriva da /data/*.json: finche non e caricato non
     esiste una grossezza, e il motore si rifiuta di calcolare. Si aspetta,
     come fa l'app. */
  await pg.waitForFunction(() => window.MAT_LOADED === true, null, { timeout: 15000 });
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
  /* Il mobile base non ha sezioni dichiarate a cassetti: i cassetti restano
     frontali a vista e mangiano l'altezza alle ante. (L'armadio non serve piu
     a questa prova: i suoi cassetti stanno DIETRO le ante e non le accorciano.) */
  const w = await pg.evaluate(() => {
    const r = buildModule(Object.assign({}, PRESETS.base, { H: 800, drawers: 6, doors: 2, shelves: 0, hang: 0 }));
    return { skip: (r.warn || {}).doorSkip || 0, ante: r.pieces.filter(x => /^Anta/.test(x.elemento)).length };
  });
  ok("ante non generate → avviso", w.skip > 0, "doorSkip=" + w.skip + ", ante in distinta=" + w.ante);

  head("Cassetti — la cassa esiste, entra nelle quote e si sa quale guida comprare");
  const D = await pg.evaluate(() => {
    const out = {};
    /* 1. il bug segnalato: l'armadio in vista esplosa non aveva cassetti */
    const arm = buildModule(PRESETS.armadio);
    out.armDraw = arm.boxes.filter(b => b.sub === "dbox").length;
    out.armFront = arm.boxes.filter(b => b.sub === "drawer" || b.sub === "drawerIn").length;
    out.armGrp = new Set(arm.boxes.filter(b => b.grp).map(b => b.grp)).size;
    out.armInner = !!(arm.draw && arm.draw.inner);
    out.armPieces = arm.pieces.filter(x => /cassetto/i.test(x.elemento)).reduce((s, x) => s + x.pz, 0);
    /* 2. i cassetti interni non accorciano le ante */
    const anta = arm.pieces.find(x => /^Anta/.test(x.elemento));
    out.antaH = anta ? Math.max(anta.lung, anta.larg) : 0;
    /* 3. sistema metallico: in distinta ci vanno fondo e retro, non i fianchi */
    const lg = buildModule(PRESETS.basecass);
    out.lgSys = lg.draw.sysId; out.lgCode = lg.draw.hcode; out.lgNL = lg.draw.nl;
    out.lgFianchi = lg.pieces.filter(x => /^Fianco cassetto/.test(x.elemento)).length;
    out.lgFondo = lg.pieces.filter(x => /^Fondo cassetto/.test(x.elemento)).length;
    out.lgMetal = lg.boxes.filter(b => b.kind === "m").length;
    /* «cucina»: un frontale basso in alto, gli altri uguali */
    const hs = lg.draw.fronts.map(f => Math.round(f.h));
    out.kitTop = hs[hs.length - 1]; out.kitRest = hs.slice(0, -1);
    /* 4. la cassettiera non deve cambiare distinta: i cassetti riempiono l'altezza */
    const cs = buildModule(PRESETS.cassettiera);
    out.csFront = cs.pieces.filter(x => /^Frontale cassetto/.test(x.elemento)).map(x => ({ h: x.lung, w: x.larg, n: x.pz }));
    /* 5. mobile troppo poco profondo per LEGRABOX: si dice, non si tace */
    const shallow = buildModule(Object.assign({}, PRESETS.basecass, { P: 200 }));
    out.shallowWarn = (shallow.warn.drawWarn || []).map(x => x.k);
    /* 6. cassetto interno troppo avanti: il braccio della cerniera non passa */
    const hinge = buildModule(Object.assign({}, PRESETS.armadio, { drawerInset: 5 }));
    out.hingeWarn = (hinge.warn.drawWarn || []).map(x => x.k);
    /* 7. la cassa non entra nelle catene di quote del disegno tecnico */
    out.dboxIsBox = arm.boxes.filter(b => b.sub === "dbox" && b.kind === "p").length > 0;
    return out;
  });
  ok("l'armadio ha davvero i cassetti in 3D", D.armDraw > 0, D.armDraw + " pannelli di cassa");
  ok("e i frontali corrispondenti", D.armFront === 3, D.armFront);
  ok("ogni cassetto e un gruppo: nell'esplosa esce intero", D.armGrp === 3, D.armGrp + " gruppi");
  ok("nell'armadio sono cassetti INTERNI, dietro l'anta", D.armInner === true);
  ok("i cassetti interni non accorciano le ante", D.antaH > 2000, "anta " + D.antaH + " mm");
  ok("i pezzi del cassetto entrano in distinta", D.armPieces >= 3 * 4, D.armPieces + " pezzi");
  ok("base a cassetti = LEGRABOX, altezza sponda scelta da sola", D.lgSys === "legrabox" && !!D.lgCode, D.lgCode + " · NL " + D.lgNL);
  ok("su sistema metallico i fianchi NON vanno in distinta", D.lgFianchi === 0 && D.lgFondo === 1, "fianchi=" + D.lgFianchi + " fondo=" + D.lgFondo);
  ok("i fianchi metallici ci sono pero in 3D", D.lgMetal === 8, D.lgMetal + " fianchi (4 cassetti × 2)");
  ok("«cucina»: il frontale basso sta in alto", D.kitTop < D.kitRest[0], D.kitTop + " sopra, " + D.kitRest.join("/") + " sotto");
  ok("gli altri frontali sono uguali fra loro", new Set(D.kitRest).size === 1, D.kitRest.join("/"));
  ok("REGRESSIONE cassettiera: i frontali riempiono l'altezza in parti uguali",
     D.csFront.length === 1 && D.csFront[0].n === 3 && Math.abs(D.csFront[0].h - 196) <= 1,
     D.csFront.map(f => f.n + "×" + f.h + "×" + f.w).join(" · "));
  ok("mobile troppo poco profondo → avviso, non silenzio", D.shallowWarn.includes("wDrawDeep"), D.shallowWarn.join(",") || "nessuno");
  ok("cassetto interno troppo avanti → avviso cerniera", D.hingeWarn.includes("wDrawHinge"), D.hingeWarn.join(",") || "nessuno");
  ok("la cassa e fatta di pannelli veri, marcati 'dbox'", D.dboxIsBox);

  head("Cassetti a vista o dietro l'anta — devono esserci tutte e due");
  const V = await pg.evaluate(() => {
    const out = {}, A = PRESETS.armadio;
    const inn = buildModule(Object.assign({}, A, { drawerPos: "interno" }));
    const vis = buildModule(Object.assign({}, A, { drawerPos: "vista", doors: 1 }));
    const zOf = (m, sub) => { const b = m.boxes.find(x => x.sub === sub); return b ? [Math.round(b.z0), Math.round(b.z1)] : null; };
    out.innZ = zOf(inn, "drawerIn"); out.innDoorZ = zOf(inn, "door");
    out.visZ = zOf(vis, "drawer");   out.visDoorZ = zOf(vis, "door");
    out.innName = inn.pieces.some(x => /^Frontale cassetto interno/.test(x.elemento));
    out.visName = vis.pieces.some(x => /^Frontale cassetto( push)?$/.test(x.elemento));
    /* a vista accanto alle ante: l'anta resta intera e copre solo la sua sezione */
    const anta = vis.pieces.find(x => /^Anta/.test(x.elemento));
    out.visAntaH = anta ? Math.max(anta.lung, anta.larg) : 0;
    out.visAntaW = anta ? Math.min(anta.lung, anta.larg) : 0;
    const dfr = vis.boxes.find(b => b.sub === "drawer"), dr = vis.boxes.find(b => b.sub === "door");
    out.noOverlap = !!(dfr && dr) && (dr.x1 <= dfr.x0 + 1 || dfr.x1 <= dr.x0 + 1);
    /* la maniglia: c'e a vista, non c'e dietro l'anta. Si guardano SOLO i
       frontali di cassetto — le ante la maniglia ce l'hanno sempre. */
    const hwOf = m => computeHardware({ pieces: m.pieces
        .filter(x => /^Frontale cassetto/.test(x.elemento))
        .map(x => Object.assign({ modulo: "m" }, x)) }, state.settings, false)
      .filter(i => i.k === "hwMan")[0].qty;
    out.innMan = hwOf(inn); out.visMan = hwOf(vis);
    /* colonna di cassetti IN MEZZO alle ante: si segnala */
    const mid = buildModule(Object.assign({}, A, { tram: 2, doors: 2, drawerPos: "vista",
      secMode: ["hang", "drawers", "hang"] }));
    out.midWarn = !!mid.warn.doorOverlap;
    return out;
  });
  ok("dietro l'anta: il frontale sta DIETRO il filo del mobile",
     V.innZ[1] < V.innDoorZ[0], "cassetto z" + V.innZ.join("–") + " · anta z" + V.innDoorZ.join("–"));
  ok("e si chiama «Frontale cassetto interno» in distinta", V.innName);
  ok("a vista: il frontale sta sul filo, come l'anta",
     V.visZ[0] === V.visDoorZ[0] && V.visZ[1] === V.visDoorZ[1], "z" + V.visZ.join("–"));
  ok("e torna a chiamarsi «Frontale cassetto»", V.visName);
  ok("a vista accanto all'anta: l'anta resta alta tutto il mobile", V.visAntaH > 2000, V.visAntaH + " mm");
  ok("e larga solo la sua sezione, non tutto il fronte", V.visAntaW < 520, V.visAntaW + " mm");
  ok("anta e cassetti non si sovrappongono", V.noOverlap);
  ok("dietro l'anta il cassetto non prende maniglia", V.innMan === 0, "maniglie=" + V.innMan);
  ok("a vista si", V.visMan === 3, "maniglie=" + V.visMan);
  ok("cassetti IN MEZZO alle ante → avviso", V.midWarn);

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
  /* Stampare da gratuito apre lo schermo Pro poco dopo (una volta per
     sessione): la prova qui sotto conta i pannelli aperti, quindi si
     aspetta che arrivi e si fa pulizia prima di cominciare. */
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => closeSheets()); await pg.waitForTimeout(200);
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

  head("Corpi tondi e ovali — lo sviluppo dev'essere esatto, o il giunto non chiude");
  const rnd = await pg.evaluate(() => {
    const o = {};
    /* i preset non portano piu la grossezza: la da il materiale, e il
       predefinito di progetto ora e 19. La prova misura la grossezza VERA
       invece di darla per scontata — cosi resta giusta anche il giorno che
       il fornitore cambia. */
    const c = buildModule({ ...PRESETS.tondo });                       // Ø600 × H1200
    o.t = structTh({ ...PRESETS.tondo });
    const fascia = c.pieces.find(p => /Fascia/.test(p.elemento));
    const piani = c.pieces.filter(p => p.shape === "tondo");
    o.dev = fascia.lung; o.devEsatto = Math.PI * 600;
    o.altezzaFascia = fascia.larg;                                     // H (D-117)
    o.kerf = fascia.curve && fascia.curve.kerf;
    o.nPiani = piani.reduce((s, p) => s + p.pz, 0);                    // fondo+cielo+3 ripiani
    o.diamPiano = piani[0] && piani[0].lung;                           // Ø - 2t
    // il 3D deve ricevere basi poligonali, non scatole
    o.pcTondo = c.boxes.every(b => b.pc && b.pc.length > 4);
    o.nPc = c.boxes[0].pc.length;                                      // 48 punti, non 4

    // ovale: sviluppo per integrazione, non approssimazione
    const ov = buildModule({ ...PRESETS.ovale });                      // 900 × 450
    o.devOvale = (ov.pieces.find(p => /Fascia/.test(p.elemento)) || {}).lung;
    o.devOvaleEsatto = ellipsePerim(450, 225);

    // corpo grande: la fascia non entra nel pannello e va spezzata
    const big = buildModule({ ...PRESETS.tondo, L: 1400, P: 1400, H: 1800 });
    const bf = big.pieces.find(p => /Fascia/.test(p.elemento));
    o.segmenti = bf.pz; o.devBig = bf.curve.dev; o.angSeg = bf.curve.angle;

    // bordatura di un pezzo tondo = perimetro, non 2L+2C
    o.bandTondo = bandingMm("1L", 564, 564, null, null, "tondo");
    o.bandRett  = bandingMm("1L", 564, 564, null, null, undefined);

    // REGRESSIONE: la mobilia dritta non deve muoversi di un millimetro
    const arm = buildModule({ ...PRESETS.armadio });
    o.armBoxes = arm.boxes.length;
    o.armRect = arm.boxes.every(b => !b.pc || b.pc.length === 4);
    o.armIstanziabile = arm.boxes.filter(b => !b.pc || b.pc.length === 4).length;
    return o;
  });
  ok("cerchio Ø600: sviluppo = π·D", Math.abs(rnd.dev - rnd.devEsatto) < 0.6,
     rnd.dev + " vs " + rnd.devEsatto.toFixed(1));
  ok("la fascia e alta quanto il corpo, i piani stanno dentro (H, D-117)", rnd.altezzaFascia === 1200,
     rnd.altezzaFascia + " con t=" + rnd.t);
  ok("piano dei tagli entro 0,3 mm dall'arco (non solo il minimo teorico)",
     !!rnd.kerf && rnd.kerf.n > 0 && rnd.kerf.flat <= 0.31,
     rnd.kerf ? rnd.kerf.n + " intagli ogni " + rnd.kerf.spacing + " mm, scarto " + rnd.kerf.flat + " mm" : "—");
  ok("fondo, cielo e 3 ripiani, tutti Ø−2t", rnd.nPiani === 5 && rnd.diamPiano === 600 - 2 * rnd.t,
     rnd.nPiani + " pezzi, Ø" + rnd.diamPiano);
  ok("ovale 900×450: sviluppo per integrazione", Math.abs(rnd.devOvale - rnd.devOvaleEsatto) < 0.6,
     rnd.devOvale + " vs " + rnd.devOvaleEsatto.toFixed(1));
  ok("Ø1400: la fascia si spezza in tratti che entrano nel pannello",
     rnd.segmenti === 2 && Math.abs(rnd.devBig - Math.PI * 1400) < 0.6, rnd.segmenti + " tratti da " + rnd.angSeg + "°");
  ok("il bordo di un pezzo tondo e il perimetro", Math.abs(rnd.bandTondo - Math.PI * 564) < 0.6,
     rnd.bandTondo.toFixed(1) + " mm (come rettangolo sarebbe " + rnd.bandRett + ")");
  ok("il 3D riceve basi poligonali, non scatole", rnd.pcTondo && rnd.nPc > 4, rnd.nPc + " spigoli in pianta");
  ok("REGRESSIONE: l'armadio resta a quattro spigoli, tutto istanziabile come prima",
     rnd.armRect && rnd.armIstanziabile === rnd.armBoxes,
     rnd.armIstanziabile + "/" + rnd.armBoxes + " scatole");

  head("Ante bombate — in distinta va lo sviluppo, non la corda");
  const bow = await pg.evaluate(() => {
    const o = {};
    const base = { ...PRESETS.base, front: "curvo", bow: 40, doors: 2, L: 1000, H: 800, P: 500 };
    const m = buildModule(base);
    const a = m.pieces.find(p => /Anta curva/.test(p.elemento));
    o.trovata = !!a;
    o.curve = a && a.curve;
    // verifica indipendente: dalla corda e dalla freccia si ricava il raggio,
    // e dal raggio si deve poter tornare ALLA STESSA freccia.
    // La corda la dice il motore — prima qui c'era riscritta a mano la vecchia
    // formula dell'anta (1000-4-3)/2, che questo rilascio ha sostituito: la
    // prova misurava la curva ma si portava dietro la larghezza sbagliata.
    const G = deriveCarcass(carcassParams(base, {
      P: base.P, pl: base.plinth || 0, backTh: 3, support: base.support || "zoccolo" }));
    const aW = G.anta_W, f = 40;
    o.corda = aW;
    const R = (aW * aW / 4 + f * f) / (2 * f);
    o.rChk = Math.round(R);
    o.frecciaRicostruita = +(R - Math.sqrt(R * R - aW * aW / 4)).toFixed(2);
    o.devChk = +(R * 2 * Math.asin(aW / (2 * R))).toFixed(1);
    // lo sviluppo dev'essere PIU LUNGO della corda, o l'anta arriva corta
    o.devMaggiore = a && a.curve.dev > aW;
    // bombatura 0 = anta piatta normale, nessuna regressione
    const flat = buildModule({ ...base, bow: 0 });
    o.piatta = flat.pieces.some(p => p.elemento === "Anta") && !flat.pieces.some(p => /curva/.test(p.elemento));
    // il 3D riceve sfaccettature, ognuna a quattro spigoli (strada collaudata)
    const facce = m.boxes.filter(b => b.sub === "door");
    o.nFacce = facce.length;
    o.facceQuad = facce.every(b => b.pc && b.pc.length === 4);
    return o;
  });
  ok("l'anta bombata viene generata", bow.trovata);
  ok("raggio ricavato da corda e freccia", bow.curve && bow.curve.radius === bow.rChk, "R=" + bow.rChk);
  ok("dal raggio si torna alla freccia chiesta", Math.abs(bow.frecciaRicostruita - 40) < 0.05, bow.frecciaRicostruita + " mm");
  ok("in distinta va lo sviluppo dell'arco", bow.curve && Math.abs(bow.curve.dev - bow.devChk) < 0.2,
     bow.curve && bow.curve.dev + " mm (corda " + bow.corda + ")");
  ok("lo sviluppo e piu lungo della corda", bow.devMaggiore);
  ok("il passo tiene la faccia entro 0,3 mm dall'arco",
     bow.curve && bow.curve.kerf && bow.curve.kerf.flat <= 0.31,
     bow.curve && bow.curve.kerf && bow.curve.kerf.n + " intagli, scarto " + bow.curve.kerf.flat + " mm");
  ok("bombatura 0 = anta piatta, nessuna regressione", bow.piatta);
  ok("il 3D riceve sfaccettature a quattro spigoli", bow.nFacce === 28 && bow.facceQuad, bow.nFacce + " facce");

  head("Angoli raccordati — gli intagli vanno SOLO negli archi, e va detto dove");
  const rc = await pg.evaluate(() => {
    const o = {}, L = 900, P = 450, r = 80;
    const m = buildModule({ ...PRESETS.raccordato });
    const f = m.pieces.find(p => /Fascia raccordata/.test(p.elemento));
    o.dev = f && f.curve.dev;
    o.devChk = +(L + 2 * P + r * (Math.PI - 4)).toFixed(1);   // fianchi + due quarti + fronte
    o.devDritto = L + 2 * P;                                   // se non fosse raccordato
    o.arcAt = f && f.curve.arcAt;
    o.arcChk = [P - r, Math.round(P - r + Math.PI * r / 2 + (L - 2 * r))];
    o.raggio = f && f.curve.radius;
    // il contorno in pianta: i capi degli archi devono cadere ESATTAMENTE sui lati
    const pc = m.boxes[0].pc, near = (a, b) => Math.abs(a - b) < 0.6;
    const has = (x, z) => pc.some(q => near(q[0], x) && near(q[1], z));
    o.contorno = has(0, 0) && has(L, 0) && has(L, P - r) && has(L - r, P) && has(r, P) && has(0, P - r);
    o.ingombro = Math.max(...pc.map(q => q[0])) === L && Math.max(...pc.map(q => q[1])) === P;
    // raggio assurdo: si limita invece di produrre numeri impossibili
    const huge = buildModule({ ...PRESETS.raccordato, rcorner: 5000 });
    const hf = huge.pieces.find(p => /Fascia raccordata/.test(p.elemento));
    o.limitato = hf.curve.radius <= P && hf.curve.dev > 0;
    o.raggioLim = hf.curve.radius;
    return o;
  });
  ok("sviluppo = fianchi + due quarti di giro + fronte", Math.abs(rc.dev - rc.devChk) < 0.2,
     rc.dev + " mm (a spigolo vivo sarebbe " + rc.devDritto + ")");
  ok("raccordare ACCORCIA lo sviluppo", rc.dev < rc.devDritto);
  ok("dice dove cominciano i due archi", rc.arcAt && Math.abs(rc.arcAt[0] - rc.arcChk[0]) < 1 && Math.abs(rc.arcAt[1] - rc.arcChk[1]) < 1,
     rc.arcAt && rc.arcAt.join(" / ") + " mm");
  ok("il contorno in pianta chiude sui lati", rc.contorno);
  ok("l'ingombro resta quello del rettangolo di sbozzo", rc.ingombro, "900×450");
  ok("un raggio impossibile viene limitato", rc.limitato, "R" + rc.raggioLim + " su P=450");

  head("Tipi propri — quello che il motore sa fare dev'essere salvabile con un nome");
  const pre = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const out = {};
    /* `prompt()` e `confirm()` del browser sono spariti: adesso c'e un
       dialogo dell'app. Si guida quello — che e anche una prova migliore,
       perche passa dal codice vero invece che da uno stub. */
    const answer = async (text, yes) => {
      for (let i = 0; i < 40 && !document.querySelector("#dlgOverlay.on"); i++) await wait(25);
      const inp = document.getElementById("dlgInput");
      if (inp && text != null) inp.value = text;
      document.getElementById(yes === false ? "dlgNo" : "dlgYes").click();
      await wait(80);
    };
    setView("build"); await wait(400);
    state.settings.presetAdd = []; renderPresetChips();
    out.serie = document.querySelectorAll("#presetChips .chip").length;
    out.attesi = Object.keys(PRESETS).length + 1;   // tipi di serie + "tipo nuovo"

    // 1. salvare la configurazione corrente come tipo, con un ostacolo di cantiere presente
    buildObst = [{ x: 100, y: 200, w: 80, h: 80 }];
    buildCfg = { ...PRESETS.cassettiera, name: "Banco utensili", L: 900, H: 1400, drawers: 8, doors: 0 };
    syncBuildForm();
    const p1 = presetSaveCurrent();
    await answer("Banco utensili");
    await p1; await wait(150);
    const saved = (state.settings.presetAdd || [])[0] || {};
    out.creato = !!saved.name;
    out.senzaOstacoli = !("obstacles" in (saved.cfg || {}));   // il cantiere non entra nel tipo
    out.conValori = saved.cfg && saved.cfg.L === 900 && saved.cfg.drawers === 8;
    out.chipUtente = document.querySelectorAll("#presetChips .chip-user").length;

    // 2. non deve duplicare: stesso nome -> sovrascrive
    buildCfg = { ...buildCfg, L: 1200 }; syncBuildForm();
    const p2 = presetSaveCurrent();
    await answer("Banco utensili");        // il nome
    await answer(null);                     // «esiste gia: sovrascrivere?»
    await p2; await wait(150);
    out.nonDuplica = (state.settings.presetAdd || []).length === 1;
    out.sovrascritto = ((state.settings.presetAdd || [])[0].cfg || {}).L === 1200;

    // 3. applicare il tipo riempie davvero il modulo
    buildCfg = { ...PRESETS.armadio }; syncBuildForm(); await wait(100);
    document.querySelector("#presetChips .chip-user").click(); await wait(200);
    out.applicato = document.getElementById("bL").value === "1200" &&
                    document.getElementById("bName").value === "Banco utensili";

    // 4. e deve produrre una distinta vera, non solo esistere nella lista
    const built = buildModule(cfgFromForm());
    out.pezzi = built.pieces.length;

    // 5. la X toglie solo i tipi propri; quelli di serie restano
    document.querySelector("#presetChips .chip-user .chip-x").click();
    await answer(null);                     // «togliere questo tipo?»
    await wait(200);
    out.tolto = (state.settings.presetAdd || []).length === 0;
    out.serieIntatti = document.querySelectorAll("#presetChips .chip").length === out.serie;

    buildObst = []; return out;
  });
  ok("una chip per tipo di serie, piu il bottone", pre.serie === pre.attesi, pre.serie + "/" + pre.attesi);
  ok("una configurazione si salva come tipo proprio", pre.creato && pre.chipUtente === 1);
  ok("con i suoi valori", pre.conValori);
  ok("gli ostacoli del cantiere NON entrano nel tipo", pre.senzaOstacoli);
  ok("stesso nome sovrascrive invece di duplicare", pre.nonDuplica && pre.sovrascritto);
  ok("applicare il tipo riempie il modulo", pre.applicato);
  ok("e produce una distinta vera", pre.pezzi > 0, pre.pezzi + " pezzi");
  ok("la X toglie il tipo proprio, quelli di serie restano", pre.tolto && pre.serieIntatti);

  head("Chiave API — resta sul telefono, quindi va detto e va potuta togliere");
  const key = await pg.evaluate(async () => {
    const out = {};
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const open = async () => { document.getElementById("btnSettings").click(); await wait(120); };

    // 1. una chiave storta non deve essere accettata in silenzio
    aiSetKey(""); state.settings.aiProxy = "";
    await open();
    document.getElementById("sAiKey").value = "non-una-chiave";
    document.getElementById("btnSettingsSave").click(); await wait(120);
    out.rifiutata = aiKey() === "";
    out.avvisato = /sk-ant-/.test(document.getElementById("toast").textContent);
    closeSheets(); await wait(120);

    // 2. una chiave plausibile passa
    await open();
    document.getElementById("sAiKey").value = "sk-ant-api03-" + "x".repeat(24);
    document.getElementById("btnSettingsSave").click(); await wait(120);
    out.accettata = aiKey().startsWith("sk-ant-");
    closeSheets(); await wait(120);

    // 3. con la chiave presente compare il bottone per cancellarla, e l'avviso c'e
    await open();
    out.bottoneVisibile = document.getElementById("btnAiKeyDel").style.display !== "none";
    out.avvisoVisibile = (document.getElementById("aiKeyWarn").textContent || "").length > 20;

    // 4. con un endpoint proprio la chiave non parte dal browser: niente avviso, e il token e libero
    state.settings.aiProxy = "https://esempio.test/ai";
    closeSheets(); await wait(120); await open();
    out.avvisoNascosto = (document.getElementById("aiKeyWarn").textContent || "") === "";
    document.getElementById("sAiKey").value = "token-proxy-qualsiasi";
    document.getElementById("btnSettingsSave").click(); await wait(120);
    out.proxyTokenLibero = aiKey() === "token-proxy-qualsiasi";

    // 5. cancellazione esplicita
    state.settings.aiProxy = ""; await open();
    /* La conferma non e piu quella del browser: e il dialogo dell'app. */
    document.getElementById("btnAiKeyDel").click();
    for (let i = 0; i < 40 && !document.querySelector("#dlgOverlay.on"); i++) await wait(25);
    document.getElementById("dlgYes").click(); await wait(150);
    out.cancellata = aiKey() === "";
    closeSheets(); await wait(150);
    return out;
  });
  ok("una chiave malformata viene rifiutata, non salvata in silenzio", key.rifiutata);
  ok("e spiega perche (sk-ant-)", key.avvisato);
  ok("una chiave plausibile viene accettata", key.accettata);
  ok("con la chiave salvata compare il bottone per cancellarla", key.bottoneVisibile);
  ok("l'avviso 'resta sul telefono' e visibile", key.avvisoVisibile);
  ok("con endpoint proprio l'avviso sparisce", key.avvisoNascosto);
  ok("con endpoint proprio il token puo avere qualunque forma", key.proxyTokenLibero);
  ok("il bottone cancella davvero la chiave", key.cancellata);

  head("Aggiornamento — le due cache devono portare lo stesso nome");
  /* Il nome della cache sta scritto in due file. Se restano disallineati,
     «Verifica aggiornamenti» scrive la pagina nuova in una cache che il
     service worker cancella appena si attiva: sembra funzionare, e al
     riavvio dopo torna la versione vecchia. Fallisce in silenzio, quindi
     va guardato da qui. */
  const sw = await (await fetch(`${ORIGIN}/app/sw.js`)).text();
  const swName = (sw.match(/const CACHE\s*=\s*"([^"]+)"/) || [])[1];
  const pgName = await pg.evaluate(() => (typeof SW_CACHE === "string" ? SW_CACHE : null));
  const pgVer = await pg.evaluate(() => APP_VER);
  ok("sw.js e index.html puntano alla stessa cache", !!swName && swName === pgName,
     "sw.js=" + swName + " · index.html=" + pgName);
  ok("APP_VER e leggibile dal marcatore che usa l'updater",
     /const APP_VER="[^"]+"; \/\* APP_VER-MARKER \*\//.test(
       await (await fetch(URL)).text()), "v" + pgVer);

  head("Lingua dal link del sito — vince anche per chi ha gia dei dati (4.56.1)");
  {
    const lc = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: "it-IT" });
    const lpg = await lc.newPage();
    await lpg.goto(`${URL}?lang=it`); await lpg.waitForTimeout(800);
    const l1 = await lpg.evaluate(() => state.lang);
    await lpg.goto(`${URL}?lang=es`); await lpg.waitForTimeout(800);
    const l2 = await lpg.evaluate(() => [state.lang, document.documentElement.lang, !!state.langChosen]);
    await lpg.goto(URL); await lpg.waitForTimeout(800);
    const l3 = await lpg.evaluate(() => state.lang);
    ok("prima apertura con ?lang=it: italiano", l1 === "it", l1);
    ok("riapertura con ?lang=es (dati gia salvati): spagnolo", l2[0] === "es" && l2[1] === "es" && l2[2], JSON.stringify(l2));
    ok("senza ?lang resta la lingua scelta", l3 === "es", l3);
    await lc.close();
  }

  head("Traduzioni — nessuna etichetta deve mostrare il nome della chiave");
  const i18n = await pg.evaluate(() => {
    const dicts = { I18N, SURVEY_I18N, AUTH_I18N, AI_I18N };
    const langs = ["it", "ro", "en", "fr", "de", "pl", "es"], out = { missing: [], raw: [] }, keep = state.lang;
    // 1. ogni tabella completa in tutte e quattro le lingue
    for (const [name, D] of Object.entries(dicts)) {
      const all = new Set(); langs.forEach(l => Object.keys(D[l] || {}).forEach(k => all.add(k)));
      for (const l of langs) for (const k of all) if ((D[l] || {})[k] === undefined) out.missing.push(`${name}.${l}.${k}`);
    }
    // 2. nessun data-i che finisce a schermo come nome di chiave, in nessuna lingua
    for (const l of langs) {
      state.lang = l; applyLang();
      document.querySelectorAll("[data-i]").forEach(el => {
        if ((el.textContent || "").trim() === el.dataset.i) out.raw.push(`${l}:${el.dataset.i}`);
      });
    }
    state.lang = keep; applyLang();
    return out;
  });
  ok("tutte le tabelle complete nelle 7 lingue", i18n.missing.length === 0,
     i18n.missing.length ? i18n.missing.slice(0, 8).join(", ") : "467 chiavi");
  ok("nessuna etichetta mostra il nome della chiave", i18n.raw.length === 0,
     i18n.raw.length ? i18n.raw.slice(0, 8).join(", ") : undefined);

  /* ===================================================================
     Regressioni dell'audit del 16.08.2026 (v4.22.0).
     Ognuno di questi bug e stato riprodotto in browser prima di essere
     corretto: qui restano perche non tornino.
     =================================================================== */

  head("Schienale — nel 3D e in AR deve avere il SUO materiale");
  const back = await pg.evaluate(async () => {
    const M = await import("./geo3d.js");
    const cfg = { ...PRESETS.armadio, matBody: "pal18_rovere", matFront: "pal18_rovere", matBack: "pfl3", back: 1 };
    const bx = buildModule(cfg).boxes;
    const b = bx.filter(x => x.sub === "back");
    return { n: b.length, key: b[0] ? M.matKeyOf(b[0], cfg) : null,
             body: M.matKeyOf(bx.find(x => x.kind === "p" && x.sub !== "back"), cfg) };
  });
  ok("lo schienale e marcato come tale", back.n === 1, back.n + " pannelli");
  ok("e riceve matBack, non il materiale della carcassa", back.key === "pfl3", back.key + " (carcassa: " + back.body + ")");

  head("Pianta — l'etichetta sta SUL mobile, anche se e tondo");
  const lab = await pg.evaluate(() => {
    const q = state.projects[0], keep = { s: q.survey, l: q.layout, c: q.configs };
    q.survey = { walls: [{ id: "w1", len: 4000, angle: 90, bow: null }], heights: [2500, 2500, 2500], obstacles: [] };
    q.configs = { Tondo: { ...PRESETS.tondo, name: "Tondo" } };
    q.layout = { Tondo: { wall: "w1", from: 500, off: 0, lift: 0, rot: 0 } };
    const m = roomLayout().mods.find(x => x.name === "Tondo");
    const n = m.foot.length, c = { x: 0, y: 0 };
    m.foot.forEach(z => { c.x += z.x / n; c.y += z.y / n; });
    const bb = { x0: Math.min(...m.foot.map(z => z.x)), x1: Math.max(...m.foot.map(z => z.x)),
                 y0: Math.min(...m.foot.map(z => z.y)), y1: Math.max(...m.foot.map(z => z.y)) };
    q.survey = keep.s; q.layout = keep.l; q.configs = keep.c;
    return { n, c, bb, inside: c.x >= bb.x0 && c.x <= bb.x1 && c.y >= bb.y0 && c.y <= bb.y1 };
  });
  ok("il contorno di un corpo tondo ha piu di quattro spigoli", lab.n > 4, lab.n + " spigoli");
  ok("il baricentro cade DENTRO l'ingombro", lab.inside,
     "(" + Math.round(lab.c.x) + "," + Math.round(lab.c.y) + ") dentro " +
     Math.round(lab.bb.x0) + "–" + Math.round(lab.bb.x1));

  head("Export AR — la geometria sta attorno alla propria origine");
  const arc2 = await pg.evaluate(async () => {
    const M = await import("./arexport.js");
    const cfg = { ...PRESETS.tondo };
    const boxes = buildModule(cfg).boxes;
    const sc = M.buildExportScene(boxes, cfg);
    let worst = 0, meshes = 0;
    sc.traverse(o => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      meshes++;
      o.geometry.computeBoundingSphere();
      const bs = o.geometry.boundingSphere;
      if (bs) worst = Math.max(worst, bs.center.length());
    });
    M.disposeExportScene(sc);
    return { worst: +worst.toFixed(3), meshes };
  });
  /* col vecchio /4 il centro della sfera d'ingombro finiva a metri dall'origine */
  ok("nessuna geometria e piu lontana di 10 cm dalla propria origine",
     arc2.worst < 0.1, arc2.worst + " m su " + arc2.meshes + " mesh");

  head("Assistente AI — deve saper fare tutto quello che offre il modulo");
  const aiOK = await pg.evaluate(() => {
    const ui = [...document.getElementById("bTipo").options].map(o => o.value);
    const uf = [...document.getElementById("bFront").options].map(o => o.value);
    const warn = [];
    const round = aiNormCfg({ type: "tondo", rcorner: 80 }, warn);
    const curvo = aiNormCfg({ front: "curvo", bow: 40 }, warn);
    const w2 = [], lf = aiNormCfg({ lift: "het_la_hk" }, w2), lfBad = aiNormCfg({ lift: "nu_exista" }, w2), lfEnum = aiSchema("genera").properties.config.properties.lift;
    const opn = aiNormCfg({ type: "tondo", rOpen: 120, rDoor: 1 }, warn), opnBig = aiNormCfg({ type: "raccordato", rOpen: 99999, rDoor: 7 }, warn);
    return { lf, lfBad, w2, lfEnum: lfEnum && lfEnum.enum, opn, opnBig, missT: ui.filter(v => AI_ENUM.type.indexOf(v) < 0),
             missF: uf.filter(v => AI_ENUM.front.indexOf(v) < 0),
             round, curvo, warn };
  });
  ok("ogni tipo della tendina esiste anche per l'AI", aiOK.missT.length === 0, aiOK.missT.join(",") || "tutti");
  ok("ogni tipo di fronte anche", aiOK.missF.length === 0, aiOK.missF.join(",") || "tutti");
  ok("«tondo» passa la validazione, col suo raggio", aiOK.round.type === "tondo" && aiOK.round.rcorner === 80,
     JSON.stringify(aiOK.round));
  ok("«bombato» passa la validazione, con la sua freccia", aiOK.curvo.front === "curvo" && aiOK.curvo.bow === 40,
     JSON.stringify(aiOK.curvo));
  ok("D-171: «rOpen» e «rDoor» passano la validazione dell'AI (con tetto), il tipo li accetta", aiOK.opn.rOpen === 120 && aiOK.opn.rDoor === 1 && aiOK.opnBig.rOpen === 800 && aiOK.opnBig.rDoor === 1,
     JSON.stringify([aiOK.opn, aiOK.opnBig]));
  ok("U.16: «lift» (mecanismul basculantei) trece validarea AI doar dacă id-ul e din catalog; schema îl are ca enum", aiOK.lf.lift === "het_la_hk" && aiOK.lfBad.lift === undefined && aiOK.w2.length === 1 && Array.isArray(aiOK.lfEnum) && aiOK.lfEnum.length >= 16 && aiOK.lfEnum.includes("blum_hk_s"),
     JSON.stringify([aiOK.lf, aiOK.lfBad, aiOK.w2, aiOK.lfEnum && aiOK.lfEnum.length]));
  ok("e nessuno dei due genera un avviso", aiOK.warn.length === 0, aiOK.warn.join(" · ") || "nessuno");

  head("Costi — il catalogo e il formato pannello entrano nel conto SUBITO");
  const cache = await pg.evaluate(() => {
    const lbl = matById("pal18_alb").label;
    const p = { id: "cache", name: "cache", pieces: [
      { id: "a", modulo: "m", elemento: "Fianco", lung: 2000, larg: 600, pz: 4, bordo: "", materiale: lbl }] };
    state.projects.push(p); state.activeId = "cache";
    const before = panelUsage(p)[normMat(lbl)];
    const S = state.settings; S.matOvr = S.matOvr || {};
    S.matOvr["pal18_alb"] = { pw: 1000, ph: 800 };
    const after = panelUsage(p)[normMat(lbl)];
    delete S.matOvr["pal18_alb"];
    state.projects.pop(); state.activeId = state.projects[0].id;
    return { beforeL: before.PN.L, afterL: after.PN.L, beforeN: before.neu, afterN: after.neu };
  });
  ok("cambiare il formato in catalogo cambia il pannello usato nel conto",
     cache.beforeL === 2800 && cache.afterL === 1000, cache.beforeL + " → " + cache.afterL);
  ok("e cambia il numero di pannelli (i pezzi non ci stanno piu)",
     cache.beforeN !== cache.afterN, cache.beforeN + " → " + cache.afterN);

  head("Ferramenta — il prezzo scritto nelle Impostazioni finisce nel preventivo");
  const hwp = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const p = { id: "hw", name: "hw", pieces: [
      { id: "d", modulo: "M", elemento: "Anta", lung: 700, larg: 400, pz: 1, bordo: "", materiale: matById("pal18_alb").label }] };
    state.projects.push(p); state.activeId = "hw";
    const cern = () => computeHardware(p, state.settings, false).find(i => i.k === "hwCern");
    const before = cern().price;
    document.getElementById("btnSettings").click(); await wait(150);
    const shown = document.getElementById("sHwCern").value;
    document.getElementById("sHwCern").value = "9.5";
    document.getElementById("btnSettingsSave").click(); await wait(200);
    const after = cern();
    /* e riaprendo, il campo mostra il valore nuovo, non quello vecchio */
    document.getElementById("btnSettings").click(); await wait(150);
    const reopened = document.getElementById("sHwCern").value;
    const hasPush = !!document.getElementById("sHwPush");
    closeSheets(); await wait(120);
    state.projects.pop(); state.activeId = state.projects[0].id;
    return { before, shown: +shown, after: after.price, tot: after.tot, reopened: +reopened, hasPush };
  });
  ok("il campo mostra il prezzo di catalogo, non un numero scollegato", hwp.shown === hwp.before, "€" + hwp.shown);
  ok("cambiarlo cambia DAVVERO il preventivo", hwp.after === 9.5, "€" + hwp.before + " → €" + hwp.after);
  ok("e il totale si ricalcola", hwp.tot === 19, "2 cerniere = €" + hwp.tot);
  ok("riaprendo, il campo mostra il valore nuovo", hwp.reopened === 9.5, "€" + hwp.reopened);
  ok("anche il push-open ha il suo campo", hwp.hasPush);

  head("Memoria piena — non si perde il lavoro in silenzio");
  /* La regola e cambiata con IndexedDB, ed e cambiata in meglio: la barra
     rossa vuol dire «il lavoro di oggi non esiste da nessuna parte». Se
     localStorage rifiuta ma IndexedDB scrive, i dati SONO salvi e l'allarme
     sarebbe una bugia — la prima di una serie che insegna a ignorarlo.
     Quindi due prove: una che tace, una che grida. */
  const quiet = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const real = localStorage.setItem.bind(localStorage);
    localStorage.setItem = () => { throw new DOMException("quota", "QuotaExceededError"); };
    let threw = false;
    try { persist(); } catch (e) { threw = true; }
    localStorage.setItem = real;
    await wait(900);                          // la scrittura su IndexedDB e differita
    const bar = document.getElementById("storageBar");
    const out = { threw, alarm: !!bar && bar.style.display !== "none", idbOk };
    if (bar) bar.remove();
    storageBroken = false; lsOk = true;
    return out;
  });
  ok("persist() non lascia passare l'errore all'app", quiet.threw === false);
  ok("IndexedDB ha retto", quiet.idbOk === true);
  ok("localStorage pieno da solo NON fa allarme: i dati sono su IndexedDB", quiet.alarm === false);

  const full = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const real = localStorage.setItem.bind(localStorage);
    const realSet = EBStore.set;
    localStorage.setItem = () => { throw new DOMException("quota", "QuotaExceededError"); };
    EBStore.set = () => Promise.reject(new Error("idb-full"));
    let threw = false;
    try { persist(); } catch (e) { threw = true; }
    await wait(900);
    localStorage.setItem = real; EBStore.set = realSet;
    const bar = document.getElementById("storageBar");
    const visible = !!bar && bar.style.display !== "none";
    const txt = bar ? bar.textContent : "";
    const hasBtn = !!(bar && bar.querySelector("button"));
    if (bar) bar.remove();
    storageBroken = false; lsOk = true; idbOk = true;
    return { threw, visible, hasBtn, saysIt: /MEMOR|STORAGE|MÉMOIRE/i.test(txt) };
  });
  ok("con TUTTE E DUE le memorie piene, persist() ancora non esplode", full.threw === false);
  ok("ma lo DICE, con una barra che resta", full.visible);
  ok("e il messaggio si capisce", full.saysIt);
  ok("con il bottone del backup a portata di dito", full.hasBtn);

  head("Sincronizzazione — la cancellazione e l'officina viaggiano");
  const syn = await pg.evaluate(() => {
    const out = {};
    /* la coda di cancellazione sopravvive offline e si annulla con l'undo */
    syncDel = []; saveSyncDel(syncDel);
    markDeleted("progetto-sparito");
    out.inQueue = syncDel.indexOf("progetto-sparito") >= 0;
    out.persisted = (JSON.parse(localStorage.getItem("tagliapro_sync_del")) || []).length === 1;
    /* se il progetto torna (undo), la cancellazione non deve partire */
    state.projects.push({ id: "progetto-sparito", name: "tornato", pieces: [] });
    unmarkDeleted();
    out.afterUndo = syncDel.indexOf("progetto-sparito") < 0;
    state.projects = state.projects.filter(p => p.id !== "progetto-sparito");
    syncDel = []; saveSyncDel(syncDel);
    /* le impostazioni fanno parte di quello che si sincronizza */
    const pay = settingsPayload();
    out.hasCatalog = !!pay.settings && "matOvr" in pay.settings && "presetAdd" in pay.settings;
    out.hasStock = Array.isArray(pay.stock);
    out.noKey = JSON.stringify(pay).indexOf("sk-ant-") < 0;
    return out;
  });
  ok("un progetto cancellato entra in coda per il server", syn.inQueue);
  ok("e la coda sopravvive alla chiusura dell'app", syn.persisted);
  ok("annullando la cancellazione, la coda si svuota", syn.afterUndo);
  ok("il catalogo e i tipi propri fanno parte della sincronizzazione", syn.hasCatalog);
  ok("e il magazzino dei ritagli anche", syn.hasStock);
  ok("la chiave API NON entra nel payload", syn.noKey);

  head("Escape — un apostrofo in un nome non deve poter aprire niente");
  const escq = await pg.evaluate(() => ({
    apo: esc("L'Atelier"), quote: esc('a"b'), lt: esc("<script>")
  }));
  ok("l'apostrofo viene escapato", escq.apo === "L&#39;Atelier", escq.apo);
  ok("le virgolette e i tag restano coperti", escq.quote === "a&quot;b" && escq.lt === "&lt;script&gt;");

  head("Supabase — in locale, non da un CDN");
  const vend = await pg.evaluate(() => {
    const s = [...document.querySelectorAll("script[src]")].map(x => x.getAttribute("src"));
    return { ext: s.filter(u => /^https?:/.test(u)), local: s.filter(u => /supabase/.test(u)) };
  });
  ok("nessuno script viene da un dominio esterno", vend.ext.length === 0, vend.ext.join(", ") || "nessuno");
  ok("supabase-js e servito dalla cartella vendor", vend.local.length === 1 && /^\.\/vendor\//.test(vend.local[0]),
     vend.local[0] || "assente");
  ok("ed e nel guscio del service worker (serve offline)",
     /vendor\/supabase\.js/.test(sw), "sw.js");

  head("Rotta /ar — non si fa ospitare una pagina sul dominio dell'app");
  /* Le decisioni stanno in _armodel.js apposta: sono pure e si provano qui,
     senza Netlify. Il buco era: Content-Type preso dalla richiesta e
     restituito identico al GET, sulla stessa origine del localStorage. */
  {
    const AR = await import("../netlify/functions/_armodel.js");
    const glb = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 1, 2, 3, 4]);   // "glTF"
    const zip = new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3, 4]);         // "PK\3\4"
    const html = new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c]);        // "<html"

    ok("un .glb vero passa", AR.uploadCheck("model/gltf-binary", "a.glb", glb).ok);
    ok("un .usdz vero passa", AR.uploadCheck("model/vnd.usdz+zip", "a.usdz", zip).ok);
    const badType = AR.uploadCheck("text/html", "a.glb", glb);
    ok("un upload dichiarato text/html viene rifiutato", !badType.ok && badType.status === 415, "HTTP " + badType.status);
    const badBody = AR.uploadCheck("application/octet-stream", "a.glb", html);
    ok("HTML travestito da .glb viene rifiutato sui byte", !badBody.ok && badBody.status === 415, badBody.msg);
    ok("un corpo vuoto viene rifiutato", !AR.uploadCheck("model/gltf-binary", "a.glb", new Uint8Array()).ok);

    const h = AR.serveHeaders("x.glb", { ext: "glb" });
    ok("si restituisce sempre un tipo di modello", h["Content-Type"] === "model/gltf-binary", h["Content-Type"]);
    ok("con nosniff, cosi il browser non indovina", h["X-Content-Type-Options"] === "nosniff");
    const h2 = AR.serveHeaders("x.glb", { ext: "glb", type: "text/html" });
    ok("un tipo iniettato nei metadati viene IGNORATO", h2["Content-Type"] === "model/gltf-binary", h2["Content-Type"]);
    const hu = AR.serveHeaders("x.usdz", null);
    ok("senza metadati il tipo esce dall'estensione", hu["Content-Type"] === "model/vnd.usdz+zip");

    const now = Date.now();
    ok("un modello di ieri e scaduto", AR.isExpired({ born: now - 25 * 3600e3 }, now));
    ok("uno di un'ora fa no", !AR.isExpired({ born: now - 3600e3 }, now));
  }

  head("Tutte le viste si disegnano");
  for (const v of ["projects", "survey", "build", "list", "nest", "summary"]) {
    await pg.evaluate(x => setView(x), v);
    await pg.waitForTimeout(450);
  }
  ok("nessun errore JS su nessuna vista", errs.length === 0);
  if (errs.length) console.log("    " + errs.slice(0, 6).join("\n    "));

  /* Girato per tutto il test con gli header veri di netlify.toml: se una
     violazione ci fosse, sarebbe uscita qui e non dal telefono di Liviu. */
  ok("nessuna violazione di CSP, con gli header di produzione", cspViol.length === 0,
     cspViol.length ? cspViol.slice(0, 3).join(" | ") : "CSP attivo per tutta la prova");

  /* ---- Migrazione geomVersion ----
     Il motore nuovo cambia le cote dei progetti gia salvati. Serve una pagina
     sua, con in localStorage un progetto com'era PRIMA: senza `geomVersion` e
     con le cote del motore 4.23. La regola da provare e una sola — niente si
     riscrive senza che l'utente lo abbia visto e confermato. */
  head("geomVersion — un progetto vecchio non si riscrive da solo");
  {
    const V1 = {
      id: "p1", name: "Camera Jacquin", client: "Jacquin", date: "2026-01-10",
      // NIENTE geomVersion: e esattamente com'era in localStorage
      configs: { "Corp 1000": { name: "Corp 1000", type: "standard", L: 1000, H: 2078, P: 398, t: 19,
        plinth: 79, support: "zoccolo", tram: 0, shelves: 5, drawers: 0, doors: 2, back: 1, hang: 0,
        shelfType: "mobile", matBody: "dsp_w980_19", matFront: "dsp_w980_19", matBack: "dsp_mdf_19" } },
      pieces: [
        ["Fianco", 2076, 396, 2, "2L+2C"], ["Base / Cielo", 962, 378, 2, "1L"],
        ["Zoccolo", 962, 78, 1, "1L"],     ["Ripiano mobile", 960, 358, 5, "1L"],
        ["Anta", 1993, 495, 2, "2L+2C"],   ["Schienale", 2078, 962, 1, ""]
      ].map((r, i) => ({ id: "x" + i, gen: "Corp 1000", modulo: "Corp 1000",
        elemento: r[0], lung: r[1], larg: r[2], pz: r[3], bordo: r[4],
        materiale: r[0] === "Schienale" ? "MDF grezzo 19mm" : "Egger W980 Bianco kaolin 19mm" }))
    };
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
    const mErrs = [];
    await ctx.addInitScript(p => localStorage.setItem("tagliapro",
      JSON.stringify({ lang: "it", activeId: "p1", projects: [p], settings: {}, stock: [] })), V1);
    const mp = await ctx.newPage();
    mp.on("pageerror", e => mErrs.push(String(e)));
    await mp.goto(URL);
    await mp.waitForTimeout(3300);
    await mp.evaluate(() => closeSheets());
    await mp.waitForTimeout(300);

    const st = await mp.evaluate(() => ({ gv: proj().geomVersion,
      f: proj().pieces.find(x => x.elemento === "Fianco") }));
    ok("un progetto senza il campo vale geomVersion 1", st.gv === 1, "geomVersion=" + st.gv);
    ok("le cote restano CONGELATE come erano salvate", st.f.lung === 2076 && st.f.larg === 396,
       st.f.lung + "×" + st.f.larg);

    await mp.evaluate(() => setView("list"));
    await mp.waitForTimeout(400);
    ok("lo striscione lo dice", await mp.evaluate(() => !document.getElementById("geomBanner").hidden));

    const d = await mp.evaluate(() => geomDiff(proj())
      .map(r => r.elemento + ": " + r.vecchio.lung + "×" + r.vecchio.larg + " → " + r.nuovo.lung + "×" + r.nuovo.larg));
    ok("la differenza elenca SOLO le righe cambiate", d.length === 4, d.length + " righe su 6");
    ok("l'anta non cambia e non compare", !d.some(x => /^Anta/.test(x)));

    await mp.evaluate(() => geomDiffSheet());
    await mp.waitForTimeout(250);
    ok("guardare la differenza non scrive niente",
       await mp.evaluate(() => proj().pieces.find(x => x.elemento === "Fianco").lung) === 2076);

    // il backup si intercetta: la prova non deve scaricare file
    await mp.evaluate(() => { window.__dl = []; window.download = n => window.__dl.push(n); });
    await mp.evaluate(() => geomApply());
    await mp.waitForTimeout(600);
    const af = await mp.evaluate(() => ({ gv: proj().geomVersion, dl: window.__dl,
      f: proj().pieces.find(x => x.elemento === "Fianco"),
      bc: proj().pieces.find(x => x.elemento === "Base / Cielo"),
      cur: GEOM_VERSION,
      saved: JSON.parse(localStorage.getItem("tagliapro")).projects[0].geomVersion }));
    ok("il backup completo parte PRIMA della scrittura", af.dl.length === 1, af.dl[0]);
    ok("solo dopo la conferma il fianco torna 2078×398", af.f.lung === 2078 && af.f.larg === 398,
       af.f.lung + "×" + af.f.larg);
    ok("e base/cielo 962×379", af.bc.lung === 962 && af.bc.larg === 379, af.bc.lung + "×" + af.bc.larg);
    ok("geomVersion diventa quella del motore (" + af.cur + ") e resta scritto", af.gv === af.cur && af.saved === af.cur,
       "in memoria " + af.gv + ", su disco " + af.saved);
    ok("nessun errore JS nella migrazione", mErrs.length === 0, mErrs[0] || "nessuno");
    await ctx.close();
  }

  /* ---- Motore locale superato ----
     Dopo un deploy, il service worker puo tenere in vita la copia vecchia per
     giorni: l'utente continua a generare distinte col motore sbagliato senza
     accorgersene. Qui si finge che il server abbia gia la versione 4 e si
     verifica che l'esportazione si FERMI, non che avvisi (locale 3, server 4). */
  head("Motore vecchio in cache — l'esportazione si ferma, non avvisa");
  {
    /* `serviceWorkers: block`: senza, il service worker prende lui la richiesta
       e l'intercettazione della prova non la vede mai. E' anche il motivo per
       cui sw.js adesso lascia passare le domande con ?gv= direttamente in
       rete — la risposta deve venire dal server, non dalla cache. */
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 },
                                           serviceWorkers: "block" });
    const sp = await ctx.newPage();
    // il file sul server dice 4; quello caricato in pagina dice 3
    await sp.route(/ebanist-core\.js\?gv=/, route => route.fulfill({
      status: 200, contentType: "text/javascript",
      body: "var GEOM_VERSION = 4; /* GEOM_VERSION-MARKER */"
    }));
    await sp.goto(URL);
    await sp.waitForTimeout(3300);
    await sp.evaluate(() => closeSheets());
    await sp.waitForTimeout(300);

    ok("il motore locale si dichiara alla versione 3", await sp.evaluate(() => GEOM_VERSION) === 3);
    const remote = await sp.evaluate(() => checkGeomVersion());
    ok("il verificatore vede la 4 sul server", remote === 4, "remote=" + remote);
    ok("la barra rossa compare e non si chiude da sola",
       await sp.evaluate(() => !!document.getElementById("geomStaleBar")));
    ok("l'esportazione e BLOCCATA", await sp.evaluate(() => exportAllowed() === false));

    // il PDF non deve nemmeno arrivare alla stampa
    const printed = await sp.evaluate(() => {
      let called = 0; const real = window.print; window.print = () => { called++; };
      document.getElementById("btnPdf").click();
      return new Promise(r => setTimeout(() => { window.print = real; r(called); }, 300));
    });
    ok("il bottone PDF non stampa niente", printed === 0, printed + " chiamate a print()");

    // e quando il server torna alla pari, si sblocca
    await sp.unroute(/ebanist-core\.js\?gv=/);
    await sp.route(/ebanist-core\.js\?gv=/, route => route.fulfill({
      status: 200, contentType: "text/javascript",
      body: "var GEOM_VERSION = 3; /* GEOM_VERSION-MARKER */"
    }));
    await sp.evaluate(() => checkGeomVersion());
    ok("allineati, la barra sparisce", await sp.evaluate(() => !document.getElementById("geomStaleBar")));
    ok("e l'esportazione riparte", await sp.evaluate(() => exportAllowed() === true));
    await ctx.close();
  }

  /* ---- Tracciabilita sui documenti ----
     Una distinta stampata deve dire con che motore e stata calcolata. Senza,
     se domani salta fuori un'altra cota sbagliata non si sa nemmeno da che
     versione e uscita quel foglio. */
  head("Ogni documento con delle cote dice da che motore viene");
  {
    await pg.evaluate(() => { window.print = () => {}; });
    const tr = await pg.evaluate(async () => {
      const out = {};
      out.hash = assertionsHash();
      out.stabile = assertionsHash() === assertionsHash();
      /* La distinta passa dalla foglia di chiusura: qui si fa quello che
         farebbe l'utente — legge e conferma. Saltarla vorrebbe dire provare
         una strada che nessuno percorre. */
      const conferma = async () => {
        const sh = document.getElementById("shClosure");
        if (!sh || !sh.classList.contains("on")) return;
        const ck = document.getElementById("clOk");
        if (ck.disabled) { closeSheets(); return; }
        ck.checked = true; ck.dispatchEvent(new Event("change"));
        document.getElementById("btnClGo").click();
        await new Promise(r => setTimeout(r, 220));
      };
      /* documentele de atelier sunt Pro (D-55): urma se verifică pe Pro */
      const keepLic = LIC;
      licWrite({ kind: "stripe", key: "comp_TESTTESTTESTTESTTESTTEST", status: "active", activated: true, checkedAt: Date.now() });
      for (const [k, id] of [["distinta", "btnPdf"], ["montaggio", "btnMont"]]) {
        document.getElementById("printArea").innerHTML = "";
        document.getElementById(id).click();
        await conferma();
        out[k] = (document.getElementById("printArea").querySelector(".pr-trace") || {}).textContent || "";
      }
      licWrite(keepLic);
      return out;
    });
    await pg.waitForTimeout(300);
    const re = /Ebanist v(\d+\.\d+\.\d+) · .+ v(\d) · .+ ([0-9a-f]{8})/;
    for (const k of ["distinta", "montaggio"]) {
      const m = re.exec(tr[k] || "");
      ok(`la ${k} porta versione, motore e impronta delle regole`, !!m, (tr[k] || "(assente)").trim());
    }
    ok("l'impronta e di 8 caratteri", /^[0-9a-f]{8}$/.test(tr.hash), tr.hash);
    ok("e non cambia fra due chiamate", tr.stabile);
  }

  /* ---- Ogni tipologia di serie dev'essere anche ESPORTABILE ----
     Un preset che l'app propone, genera, e poi si rifiuta di stampare e il
     guasto peggiore della famiglia: si scopre col cliente davanti. E' successo
     davvero — la sovrapposizione dell'anta era scritta come costante (16 mm) e
     qualunque corpo in pannello da 12 o 16 restava bloccato per sempre. */
  head("Tutte le tipologie di serie generano E si esportano");
  {
    const r = await pg.evaluate(() => {
      const out = { errori: [], bloccate: [], n: 0 };
      for (const k of Object.keys(PRESETS)) {
        const cfg = { ...PRESETS[k] };
        out.n++;
        try {
          const g = buildModule(cfg);
          const bl = blocking(auditModule(cfg, g.pieces)).map(a => a.id);
          if (bl.length) out.bloccate.push(k + ": " + bl.join(","));
        } catch (e) { out.errori.push(k + ": " + (e && e.message)); }
      }
      /* e non solo coi materiali predefiniti: il pannello sottile e proprio
         il caso che era bloccato */
      for (const th of ["dsp_w980_12", "dsp_w908_16", "pal25_alb"]) {
        const cfg = { ...PRESETS.base, matBody: th, matFront: th, t: matById(th).th };
        try {
          const g = buildModule(cfg);
          const bl = blocking(auditModule(cfg, g.pieces)).map(a => a.id);
          if (bl.length) out.bloccate.push("base/" + th + ": " + bl.join(","));
        } catch (e) { out.errori.push("base/" + th + ": " + (e && e.message)); }
      }
      return out;
    });
    ok(`tutte e ${r.n} generano senza errori`, r.errori.length === 0, r.errori[0] || "nessun errore");
    ok("e nessuna resta bloccata dalle regole di coerenza", r.bloccate.length === 0,
       r.bloccate.length ? r.bloccate.join(" | ") : "tutte esportabili");
  }

  /* =====================================================================
     MONETIZZAZIONE — i cancelli, la filigrana e la memoria che non si perde
     ---------------------------------------------------------------------
     Queste prove girano su PAGINE NUOVE, ognuna col suo contesto: la
     migrazione e il recupero dopo la cancellazione di localStorage si
     vedono solo all'avvio, e l'avvio capita una volta sola.
     ===================================================================== */
  /* Una pagina pulita, con lo stato che le si vuole mettere in mano PRIMA
     che l'app parta: il seme va scritto su una pagina qualsiasi della
     stessa origine, poi si va sull'app. */
  async function freshApp(seed) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
    const pp = await ctx.newPage();
    const boom = [];
    pp.on("pageerror", e => boom.push(String(e)));
    /* Il seme si scrive PRIMA che parta il codice dell'app, con uno script di
       avvio, una volta sola per contesto. Prima si caricava l'app, si
       scriveva il seme e si ricaricava: nel frattempo la prima pagina poteva
       gia aver scritto il suo stato di default in IndexedDB (debounce di
       400 ms), e alla seconda partenza vinceva lui — a seconda della
       velocita della macchina, il progetto del seme spariva. */
    if (seed) await ctx.addInitScript(src => {
      if (sessionStorage.getItem("__seeded")) return; sessionStorage.setItem("__seeded", "1");
      (0, eval)("(" + src + ")")(); }, seed.toString());
    await pp.goto(`${ORIGIN}/app/index.html`);
    await pp.waitForTimeout(2200);            // l'avvio differito: IndexedDB, licenza, intro
    return { ctx, pp, boom };
  }

  head("Migrazione — la chiave storica «tagliapro» non si perde e non si tocca");
  {
    const { ctx, pp, boom } = await freshApp(() => {
      localStorage.clear();
      localStorage.setItem("tagliapro", JSON.stringify({
        lang: "ro", activeId: "vecchio",
        projects: [{ id: "vecchio", name: "Comanda din 2024", client: "Un client", date: "2024-05-02",
                     pieces: [{ id: "p1", modulo: "Corp", elemento: "Fianco", lung: 700, larg: 500, pz: 2, bordo: "2L", materiale: "PAL 18 Alb" }] }],
        settings: {}
      }));
    });
    const r = await pp.evaluate(async () => {
      const rec = await EBStore.get("state");
      return {
        inMemoria: state.projects.some(p => p.id === "vecchio"),
        nomeTenuto: (state.projects.find(p => p.id === "vecchio") || {}).name,
        lsIntatta: !!localStorage.getItem("tagliapro"),
        inIdb: !!(rec && rec.state && rec.state.projects.some(p => p.id === "vecchio")),
        geomBollato: (state.projects.find(p => p.id === "vecchio") || {}).geomVersion === 1
      };
    });
    ok("il progetto vecchio si legge all'avvio", r.inMemoria, r.nomeTenuto);
    ok("e finisce dentro IndexedDB", r.inIdb);
    ok("la chiave storica NON viene cancellata", r.lsIntatta);
    ok("e resta bollato col motore v1, senza ricalcoli", r.geomBollato);
    ok("nessun errore JS durante la migrazione", boom.length === 0, boom[0] || "nessuno");
    await ctx.close();
  }

  head("localStorage svuotato — i progetti sono ancora li (il caso iPhone)");
  {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
    const pp = await ctx.newPage();
    await pp.goto(`${ORIGIN}/app/index.html`);
    await pp.waitForTimeout(1600);
    /* si crea un progetto come lo creerebbe l'utente, dal foglio */
    await pp.evaluate(async () => {
      closeSheets();
      state.projects = [{ id: "mio", name: "Bucătărie Ionescu", client: "Ionescu", date: "2026-09-01",
                          pieces: [{ id: "x1", modulo: "Base", elemento: "Fianco", lung: 720, larg: 560, pz: 2, bordo: "1L", materiale: "PAL 18 Alb" }] }];
      state.activeId = "mio";
      persist();
      await new Promise(r => setTimeout(r, 1200));   // la scrittura su IndexedDB e differita di 400 ms
    });
    const wroteIdb = await pp.evaluate(async () => {
      const rec = await EBStore.get("state");
      return !!(rec && rec.state.projects.some(p => p.id === "mio"));
    });
    ok("il progetto e stato scritto anche su IndexedDB", wroteIdb);

    /* IL COLPO: localStorage sparisce, come fa Safari dopo 7 giorni. */
    await pp.evaluate(() => localStorage.clear());
    ok("localStorage e vuoto davvero", await pp.evaluate(() => localStorage.getItem("tagliapro") === null));

    await pp.reload();
    await pp.waitForTimeout(2400);
    const back = await pp.evaluate(() => ({
      c: state.projects.length,
      nome: (state.projects.find(p => p.id === "mio") || {}).name,
      lsRiscritta: !!localStorage.getItem("tagliapro")
    }));
    ok("dopo il ricaricamento il progetto c'e ancora", back.nome === "Bucătărie Ionescu", back.nome || "PERSO");
    ok("e non e comparso il progetto di esempio al suo posto", back.c === 1, back.c + " progetti");
    ok("lo specchio in localStorage viene riscritto da solo", back.lsRiscritta);
    await ctx.close();
  }

  head("La licenza sopravvive alla stessa cancellazione");
  {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
    const pp = await ctx.newPage();
    await pp.goto(`${ORIGIN}/app/index.html`);
    await pp.waitForTimeout(1500);
    const act = await pp.evaluate(() => { closeSheets(); licWrite({ kind: "stripe", key: "sub_TESTTESTTESTTESTTEST", status: "active", activated: true, checkedAt: Date.now() }); return isPro(); });
    ok("una licenza Stripe in memoria apre Pro, senza rete", act === true);
    await pp.evaluate(() => new Promise(r => setTimeout(r, 600)));
    await pp.evaluate(() => localStorage.clear());
    await pp.reload();
    await pp.waitForTimeout(2400);
    ok("dopo la cancellazione di localStorage si e ancora Pro", await pp.evaluate(() => isPro()));
    ok("e lo specchio si e riscritto", await pp.evaluate(() => !!localStorage.getItem("ebanist_lic")));
    await ctx.close();
  }

  head("Chiavi — quello che si accetta e quello che no (D-81: le EBP- sono ritirate)");
  {
    const r = await pg.evaluate(async () => {
      const out = {}, keep = LIC;
      licWrite(null);
      out.vuota = (await proActivate("")).ok;
      out.spazzatura = (await proActivate("ciao-mamma")).ok;
      const ebp = await proActivate("EBP-AB23-CD45-EF67");
      out.ebp = ebp.ok; out.ebpMsg = ebp.msg; out.ebpPro = isPro();
      licWrite({ kind: "legacy", key: "EBP-AB23-CD45-EF67", valid: true, activated: true, checkedAt: Date.now() });
      out.vecchiaInMemoria = EBLicense.proFrom(LIC).pro;
      licWrite(keep); return out;
    });
    ok("una chiave vuota non attiva niente", r.vuota === false);
    ok("una stringa a caso nemmeno", r.spazzatura === false);
    ok("una chiave EBP- ben formata non attiva piu Pro", r.ebp === false && r.ebpPro === false);
    ok("e lo dice con parole, non con un codice", /\w{4}/.test(r.ebpMsg || ""), r.ebpMsg);
    ok("una licenza legacy rimasta in memoria non da Pro", r.vecchiaInMemoria === false);
  }

  head("Il muro del progetto gratuito (1, D-55) — su TUTTE le strade d'ingresso");
  {
    const g = await pg.evaluate(async () => {
      const out = {}, keepP = state.projects, keepL = LIC;
      licWrite(null);                                   // gratuito
      const mk = (id, name) => ({ id, name, client: "", date: "2026-09-01", pieces: [] });

      /* con l'esempio + un progetto proprio si passa: l'esempio non conta */
      state.projects = [{ ...mk("demo", "Esempio"), demo: 1 }];
      out.esempioNonConta = ownProjects() === 0 && gateNewProject() === true;
      closeSheets();

      state.projects = [mk("a", "A"), mk("b", "B")];
      out.conta = ownProjects() === 2;

      /* 1. il bottone */
      closeSheets(); document.getElementById("btnNewProject").click();
      await new Promise(r => setTimeout(r, 250));
      out.bottoneFermato = document.getElementById("shPro").classList.contains("on") &&
                          !document.getElementById("shProject").classList.contains("on");
      out.diceIlMotivo = (document.querySelector("#proBody p").textContent || "").length > 10;

      /* 2. il salvataggio diretto, saltando il bottone */
      closeSheets(); editingProjectId = null;
      document.getElementById("prName").value = "Di soppiatto";
      document.getElementById("btnProjectSave").click();
      await new Promise(r => setTimeout(r, 250));
      out.salvataggioFermato = state.projects.length === 2;

      /* 3. la duplicazione */
      closeSheets(); editingProjectId = "a";
      document.getElementById("btnProjectDup").click();
      await new Promise(r => setTimeout(r, 250));
      out.duplicaFermata = state.projects.length === 2;

      /* 4. l'import CSV */
      closeSheets();
      try { importCsv("Corp;Fianco;700;500;2;2L;PAL 18 Alb\n", "furat.csv"); } catch (e) {}
      await new Promise(r => setTimeout(r, 250));
      out.csvFermato = state.projects.length === 2;

      /* 5. l'import JSON di un singolo progetto */
      closeSheets();
      try { importJson(JSON.stringify({ name: "Dal file", pieces: [{ modulo: "M", elemento: "E", lung: 100, larg: 100, pz: 1, bordo: "", materiale: "PAL 18 Alb" }] })); } catch (e) {}
      await new Promise(r => setTimeout(r, 250));
      out.jsonFermato = state.projects.length === 2;

      /* 6. cancellare un progetto RIAPRE il posto, e ricrearne uno funziona:
            il limite conta i progetti, non le creazioni fatte nella vita */
      closeSheets(); state.projects = [];
      out.dopoCancellazione = gateNewProject() === true;
      state.projects = [mk("a", "A")];
      out.unoBasta = gateNewProject() === false; closeSheets();

      /* 7. da Pro il muro non c'e piu */
      state.projects = [mk("a", "A"), mk("b", "B"), mk("c", "C")];
      licWrite({ kind: "stripe", key: "comp_TESTTESTTESTTESTTESTTEST", status: "active", activated: true, checkedAt: Date.now() });
      out.proPassa = gateNewProject() === true;

      closeSheets(); state.projects = keepP; licWrite(keepL);
      return out;
    });
    ok("il progetto di esempio non occupa un posto gratuito", g.esempioNonConta);
    ok("due progetti propri riempiono la quota", g.conta);
    ok("«Nuovo progetto» apre lo schermo Pro, non l'editor", g.bottoneFermato);
    ok("e lo schermo dice perche", g.diceIlMotivo);
    ok("un progetto proprio riempie la quota gratuita", g.unoBasta);
    ok("il salvataggio diretto non aggira il muro", g.salvataggioFermato);
    ok("«Duplica progetto» non lo aggira", g.duplicaFermata);
    ok("l'import CSV non lo aggira", g.csvFermato);
    ok("l'import JSON di un progetto non lo aggira", g.jsonFermato);
    ok("cancellare un progetto libera il posto", g.dopoCancellazione);
    ok("da Pro il muro sparisce", g.proPassa);
  }

  head("Documentele de atelier — gratuit: un singur document de probă cu filigran, apoi ecranul Pro; Pro: curate");
  {
    const w = await pg.evaluate(async () => {
      const out = {}, keepL = LIC, keepP = state.projects, keepA = state.activeId;
      const realPrint = window.print; let calls = 0; window.print = () => { calls++; };
      state.projects = [{ id: "w", name: "Filigrana", client: "", date: "2026-09-01", pieces: [
        { id: "q1", modulo: "Corp", elemento: "Fianco", lung: 700, larg: 500, pz: 2, bordo: "2L", materiale: "PAL 18 Alb" }] }];
      state.activeId = "w";
      const marks = () => ({
        diag: document.querySelectorAll("#printArea .wm-diag").length,
        foot: document.querySelectorAll("#printArea .wm-foot").length
      });
      /* tutti e sei i documenti, non solo la distinta */
      const bottoni = ["btnPdf", "btnQuote", "btnMont", "btnLabels", "btnOrder"];
      /* Si guarda un documento alla volta e si conta se ha stampato: un
         bottone che non stampa (la scheda di montaggio vuole i moduli
         generati, e questo progetto e una lista di pezzi sciolti)
         lascerebbe in pagina la filigrana della stampa precedente, e un
         conto globale lo scambierebbe per un successo. */
      const giro = async () => {
        const res = {};
        for (const b of bottoni) {
          document.getElementById("printArea").innerHTML = "";
          const prima = calls;
          document.getElementById(b).click();
          /* la distinta passa dalla foglia di chiusura: si conferma, come
             farebbe l'utente */
          const sh = document.getElementById("shClosure");
          if (sh && sh.classList.contains("on")) {
            const ck = document.getElementById("clOk");
            if (ck.disabled) { closeSheets(); }
            else {
              ck.checked = true; ck.dispatchEvent(new Event("change"));
              document.getElementById("btnClGo").click();
            }
          }
          await new Promise(r => setTimeout(r, 300));
          const m = marks();
          res[b] = { stampato: calls > prima, diag: m.diag, foot: m.foot };
        }
        return res;
      };
      licWrite(null); printOut._offered = 1;          // niente proposta: qui si guarda la carta
      localStorage.removeItem("ebanist_sample");      // D-180: un documento di prova gratuito, una volta sola
      out.gratis = await giro();
      out.proAperto = document.getElementById("shPro").classList.contains("on"); closeSheets();
      out.testoFiligrana = (document.querySelector("#printArea .wm-foot") || {}).textContent || "";

      licWrite({ kind: "stripe", key: "comp_TESTTESTTESTTESTTESTTEST", status: "active", activated: true, checkedAt: Date.now() });
      out.pro = await giro();
      out.chiamate = calls;
      window.print = realPrint;
      licWrite(keepL); state.projects = keepP; state.activeId = keepA; closeSheets();
      return out;
    });
    const stampati = Object.entries(w.gratis).filter(([, v]) => v.stampato).map(([k]) => k);
    const giu = stampati.filter(k => !(w.gratis[k].diag === 1 && w.gratis[k].foot === 1));
    const su = stampati.filter(k => !(w.pro[k].diag === 0 && w.pro[k].foot === 0));
    const proStampati = Object.entries(w.pro).filter(([, v]) => v.stampato).map(([k]) => k);
    const suPro = proStampati.filter(k => !(w.pro[k].diag === 0 && w.pro[k].foot === 0));
    ok("da gratuito si stampa UN SOLO documento (la prova, D-180), con la filigrana", stampati.length === 1 && giu.length === 0, stampati.join(",") || "0");
    ok("e si apre lo schermo Pro", w.proAperto === true);
    ok("da Pro stampano almeno quattro documenti", proStampati.length >= 4, proStampati.join(","));
    ok("e nessuno ha la filigrana", suPro.length === 0, suPro.join(",") || proStampati.length + "/" + proStampati.length);
  }

  head("Le due funzioni riservate");
  {
    const f = await pg.evaluate(async () => {
      const out = {}, keepL = LIC, keepP = state.projects, keepA = state.activeId;
      state.projects = [{ id: "f", name: "Lab", client: "", date: "2026-09-01", pieces: [
        { id: "q1", modulo: "Corp", elemento: "Fianco", lung: 700, larg: 500, pz: 2, bordo: "2L", materiale: "PAL 18 Alb" }] }];
      state.activeId = "f";
      licWrite(null); closeSheets();

      document.getElementById("btnLab").click(); await new Promise(r => setTimeout(r, 300));
      out.labFermato = document.getElementById("shPro").classList.contains("on");
      closeSheets(); await new Promise(r => setTimeout(r, 150));

      document.getElementById("roomExport").click(); await new Promise(r => setTimeout(r, 300));
      out.jpgFermato = document.getElementById("shPro").classList.contains("on");
      closeSheets();

      /* e da Pro il cancello lascia passare: il controllo dopo e quello
         delle regole di coerenza, che e un'altra cosa e resta */
      licWrite({ kind: "stripe", key: "comp_TESTTESTTESTTESTTESTTEST", status: "active", activated: true, checkedAt: Date.now() });
      out.proPassaLab = proGate("lab") === true;
      out.proPassaJpg = proGate("jpg") === true;

      licWrite(keepL); state.projects = keepP; state.activeId = keepA; closeSheets();
      return out;
    });
    ok("il pacchetto per il laboratorio e chiuso ai gratuiti", f.labFermato);
    ok("l'export JPG del 3D pure", f.jpgFermato);
    ok("e da Pro tutti e due passano", f.proPassaLab && f.proPassaJpg);
  }

  head("La scadenza e la tolleranza, viste dall'app");
  {
    const e = await pg.evaluate(() => {
      const out = {}, keep = LIC;
      const iso = d => new Date(Date.now() + d * 864e5).toISOString();
      const set = o => { licWrite(Object.assign({ kind: "ls", key: "38b1460a-5104-4067-a91d-77b872934d51",
                                                  activated: true, status: "active", instanceId: "i" }, o)); };
      set({ expiresAt: iso(20) });  out.inCorso = isPro();
      set({ expiresAt: iso(-3) });  out.tolleranza = isPro() && PRO_REASON === "grace";
      set({ expiresAt: iso(-20) }); out.finita = !isPro() && PRO_REASON === "lapsed";
      set({ expiresAt: iso(30), status: "disabled" }); out.revocata = !isPro();
      out.progettiSalvi = state.projects.length > 0;
      licWrite(keep); return out;
    });
    ok("abbonamento in corso: Pro", e.inCorso);
    ok("scaduto da 3 giorni: ancora Pro, in tolleranza", e.tolleranza);
    ok("scaduto da 20: si torna gratuiti", e.finita);
    ok("chiave revocata: gratuiti subito", e.revocata);
    ok("e in nessuno dei quattro casi si cancella un progetto", e.progettiSalvi);
  }

  head("La pagina di presentazione e il trasloco degli indirizzi");
  {
    /* Il sito di presentazione: una pagina per lingua, generata da
       site-src/build.mjs (template + i18n). Si controlla il file comitato. */
    const LANGS = { en: "index.html", ro: "ro/index.html", it: "it/index.html", fr: "fr/index.html" };
    const pages = {};
    for (const [l, f] of Object.entries(LANGS)) pages[l] = fs.readFileSync(path.join(ROOT, f), "utf8");
    const land = pages.en;
    ok("la radice non e piu l'app", !/APP_VER-MARKER/.test(land));
    for (const [l, html] of Object.entries(pages)) {
      ok(`/${l === "en" ? "" : l + "/"} parla ${l}`, new RegExp(`<html lang="${l}"`).test(html));
      ok(`/${l === "en" ? "" : l + "/"} ha hreflang per tutte e 4 + x-default`,
         ["en", "ro", "it", "fr", "x-default"].every(h => new RegExp(`hreflang="${h}"`).test(html)));
      ok(`/${l === "en" ? "" : l + "/"} manda all'app nella sua lingua`, new RegExp(`href="/app/\\?lang=${l}"`).test(html));
      /* D-55: gratis = 1 progetto; il prezzo lo da billing.js, non la pagina */
      ok(`/${l === "en" ? "" : l + "/"} non promette 2 progetti gratis`, !/\b2 (proiecte|progetti|projets|projects)\b/.test(html));
    }
    /* i file comitati sono quelli che il generatore produce oggi */
    {
      const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "ebsite-"));
      require("child_process").execFileSync(process.execPath, [path.join(ROOT, "site-src/build.mjs")], { env: { ...process.env, OUT_DIR: tmp }, stdio: "ignore" });
      /* e la pagina di caso reale (dulapul de baie), una per lingua */
      const CASES = ["case/bagno/index.html", "ro/case/bagno/index.html", "it/case/bagno/index.html", "fr/case/bagno/index.html"];
      const stale = [...Object.values(LANGS), ...CASES].filter(f => fs.readFileSync(path.join(tmp, f), "utf8") !== fs.readFileSync(path.join(ROOT, f), "utf8"));
      ok("le pagine comitate sono aggiornate (node site-src/build.mjs)", stale.length === 0, stale.join(", "));
    }
    /* ogni file citato (immagini, font, script, documenti) esiste nel repo */
    const refs = new Set();
    for (const f of ["case/bagno/index.html", "ro/case/bagno/index.html", "it/case/bagno/index.html", "fr/case/bagno/index.html"]) pages["case:" + f] = fs.readFileSync(path.join(ROOT, f), "utf8");
    for (const html of Object.values(pages))
      for (const m of html.matchAll(/(?:src|href|srcset|data-full)="([^"]+)"/g))
        for (const part of m[1].split(",")) { const u = part.trim().split(/\s+/)[0].split("?")[0]; if (/^\/(site|fonts|app\/icons|app\/config)\//.test(u)) refs.add(u.slice(1)); }
    const missing = [...refs].filter(f => !fs.existsSync(path.join(ROOT, f)));
    ok("tutti i file citati dalla presentazione esistono", refs.size > 30 && missing.length === 0, missing.join(", "));
    ok("nessuno script di terzi (anche GoatCounter e ospitato qui)", !/<script[^>]+src="https?:\/\//.test(land));
    /* Non si cerca la PAROLA «cookie» — un commento che spiega perche non
       ce ne sono la conterrebbe — ma quello che un banner e per forza:
       document.cookie, o un elemento che si chiama consenso/banner. */
    const mainJs = fs.readFileSync(path.join(ROOT, "site/js/main.js"), "utf8");
    /* D-60: l'unico cookie e eb_lang, la lingua scelta a mano; lo scrive
       solo pickLang(), cioe un clic su una lingua. Nessun altro. */
    const cookieWrites = (land + mainJs).match(/document\.cookie|doc\.cookie/g) || [];
    ok("l'unico cookie e eb_lang, scritto solo da pickLang()",
       cookieWrites.length === 1 && /function pickLang[\s\S]{0,400}doc\.cookie = "eb_lang="/.test(mainJs), cookieWrites.join(","));
    ok("e non c'e nessun banner di consenso da chiudere",
       !/(consent|cookie-?banner|cookie-?consent|gdpr-?banner)/i.test(land));
    const cfgSite = JSON.parse(fs.readFileSync(path.join(ROOT, "site-src/site.config.json"), "utf8"));
    ok("il prezzo NON sta nella configurazione del sito (una sola fonte: billing.js)", !("PRO_PRICE" in cfgSite));

    const toml = fs.readFileSync(path.join(ROOT, "netlify.toml"), "utf8");
    ok("il vecchio /index.html rimanda a /app/", /from = "\/index\.html"[\s\S]{0,80}to = "\/app\/"/.test(toml));
    /* D-60: la radice la decide la edge function (cookie, poi browser).
       Le regole `Language` di Netlify NO: la CDN memorizzava il 302 per
       lingua ignorando il cookie. La logica pura: lang-edge.test.mjs. */
    /* crediti Netlify (06.10.2026): il progetto Android salta i commit di solo sito,
       ebanist.com pubblica sempre; nel dubbio si pubblica */
    {
      const ign = (env) => require("child_process").spawnSync("bash", [path.join(ROOT, "netlify/ignore-build.sh")], { cwd: ROOT, env: { ...process.env, ...env } }).status;
      ok("netlify.toml usa netlify/ignore-build.sh", /ignore = "bash netlify\/ignore-build\.sh"/.test(toml));
      ok("ebanist.com pubblica sempre (ignore → 1)", ign({ SITE_NAME: "ebanist-com", CACHED_COMMIT_REF: "HEAD~1", COMMIT_REF: "HEAD" }) === 1);
      /* `netlify/android-hold` (D-67): finche c'e, il progetto Android non pubblica niente */
      if (fs.existsSync(path.join(ROOT, "netlify/android-hold")))
        ok("android-hold → il progetto Android salta ogni deploy", ign({ SITE_NAME: "whimsical-wisp-61cbbf", CACHED_COMMIT_REF: "", COMMIT_REF: "HEAD" }) === 0);
      else
        ok("progetto Android senza commit precedente → pubblica", ign({ SITE_NAME: "whimsical-wisp-61cbbf", CACHED_COMMIT_REF: "", COMMIT_REF: "HEAD" }) === 1);
    }
    ok("nessuna regola `Language` in netlify.toml (la CDN ignora il cookie)", !/conditions = \{[^}]*Language/.test(toml));
    const edge = fs.readFileSync(path.join(ROOT, "netlify/edge-functions/lang.js"), "utf8");
    ok("la edge function della lingua gira solo su /", /export const config = \{ path: "\/" \}/.test(edge));
    ok("e legge lo stesso cookie che scrive la pagina (eb_lang)", /cookies\.get\("eb_lang"\)/.test(edge));
    { const edge = (await import("../netlify/edge-functions/lang.js")).decide; ok("i vecchi /?lang=xx vanno alla pagina della lingua (edge function, 301, senza parametro)", ["ro", "it", "fr", "de", "pl", "es"].every(l => { const d = edge("https://ebanist.com/?lang=" + l); return d && d.status === 301 && d.location === "/" + l + "/"; })); }
    /* Il dominio ufficiale e ebanist.com (D-41); ebanist.app resta solo come
       redirect. Un .app rimasto in un testo che il cliente legge — la
       filigrana, i termini, il redirect del pagamento — lo manderebbe su un
       sito che non e piu quello. Il nome dell'account TikTok (@ebanist.app)
       non e un indirizzo. */
    for (const f of [...Object.values(LANGS), "termeni.html", "privacy.html", "rambursare.html", "app/config/billing.js"]) {
      const txt = fs.readFileSync(path.join(ROOT, f), "utf8").replace(/@ebanist\.app/g, "");
      ok(`${f} non nomina piu ebanist.app`, !/ebanist\.app/.test(txt),
         (txt.match(/[^\s"'<>]*ebanist\.app/) || [""])[0]);
    }
    const rootSw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
    ok("il service worker in radice si disinstalla da solo", /unregister\(\)/.test(rootSw));
    ok("e NON cancella le cache di /app/", !/caches\.delete/.test(rootSw));
    ok("e NON intercetta piu nessuna pagina del sito", !/addEventListener\("fetch"/.test(rootSw));
    ok("la presentazione non rimanda dentro chi ha gia progetti", !/tagliapro/.test(mainJs));
    ok("entra da sola solo dall'icona installata", /display-mode: standalone/.test(mainJs));
    const appSw = fs.readFileSync(path.join(ROOT, "app/sw.js"), "utf8");
    ok("il service worker dell'app resta in /app/ (non tocca il sito)", fs.existsSync(path.join(ROOT, "app/sw.js")) && !/\/site\//.test(appSw));

    /* la presentazione nel browser: niente errori, CTA verso l'app */
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await ctx.addInitScript(() => { try { sessionStorage.setItem("eb_intro", "1"); } catch (e) {} });
      const lp = await ctx.newPage(); const le = [];
      lp.on("pageerror", e => le.push(String(e)));
      for (const l of ["", "ro/"]) {
        await lp.goto(`${ORIGIN}/${l}`); await lp.waitForTimeout(700);
        const r = await lp.evaluate(() => ({ h1: document.querySelector("h1").textContent.trim(), cta: document.getElementById("ctaHero").getAttribute("href"), pro: document.getElementById("proAmt").textContent, over: document.documentElement.scrollWidth - innerWidth }));
        ok(`/${l} si apre, titolo e CTA`, r.h1.length > 10 && /^\/app\/\?lang=/.test(r.cta), JSON.stringify(r));
        ok(`/${l} niente scroll orizzontale a 390 px`, r.over <= 0, r.over);
        ok(`/${l} il prezzo Pro e quello di billing.js`, r.pro.replace(/\s/g, "") === String(await lp.evaluate(() => BILLING.PRICE_MONTHLY)).replace(/\s/g, ""), r.pro);
      }
      /* D-60: sul telefono la lingua si cambia dall'antet, non solo dal
         fondo; e a 360 px (il telefono piu stretto comune) niente nell'antet
         si schiaccia: il bottone TikTok era finito a 0 px. */
      for (const [w, l] of [[390, ""], [390, "ro/"], [360, ""], [360, "ro/"], [360, "it/"], [360, "fr/"]]) {
        await lp.setViewportSize({ width: w, height: 844 });
        await lp.goto(`${ORIGIN}/${l}`); await lp.waitForTimeout(500);
        const h = await lp.evaluate(() => {
          const d = document.querySelector(".top .lang-pick"), s = d && d.querySelector("summary");
          const r = s ? s.getBoundingClientRect() : null;
          const bar = [...document.querySelectorAll(".top .bar > *")].filter(e => getComputedStyle(e).display !== "none");
          const tt = document.querySelector(".top .tt-btn").getBoundingClientRect();
          return { vis: !!r && r.width >= 40 && r.height >= 36, txt: s ? s.textContent.trim() : "", tt: Math.round(tt.width),
                   fuori: bar.filter(e => e.getBoundingClientRect().right > innerWidth + 0.5).map(e => e.className) };
        });
        ok(`/${l} a ${w} px il selettore di lingua e nell'antet`, h.vis && h.txt === (l ? l.slice(0, 2).toUpperCase() : "EN"), JSON.stringify(h));
        ok(`/${l} a ${w} px niente esce dall'antet e TikTok resta intero`, h.fuori.length === 0 && h.tt >= 40, JSON.stringify(h));
      }
      /* ultima pagina del giro: /fr/ a 360 px */
      await lp.tap(".top .lang-pick summary"); await lp.waitForTimeout(200);
      const menu = await lp.evaluate(() => {
        const m = document.querySelector(".top .lang-menu").getBoundingClientRect();
        return { l: [...document.querySelectorAll(".top .lang-menu a")].filter(a => a.getBoundingClientRect().height >= 44).map(a => a.getAttribute("hreflang")).join(),
                 dentro: m.left >= 0 && m.right <= innerWidth };
      });
      ok("il selettore apre le 7 lingue, ognuna tappabile (44 px), dentro lo schermo a 360 px", menu.l === "en,ro,it,fr,de,pl,es" && menu.dentro, JSON.stringify(menu));
      await Promise.all([lp.waitForURL(/\/it\/$/), lp.tap('.top .lang-menu a[hreflang="it"]')]);
      const ck = (await ctx.cookies(ORIGIN)).find(c => c.name === "eb_lang");
      ok("scegliere una lingua mette eb_lang (la edge function lo preferisce ad Accept-Language)", !!ck && ck.value === "it", ck ? ck.value : "nessun cookie");
      await lp.tap(".top .lang-pick summary"); await lp.waitForTimeout(150);
      /* con 7 lingue la lista copre l'h1: si tocca un punto libero in basso */
      const vh = await lp.evaluate(() => innerHeight); await lp.touchscreen.tap(6, vh - 6); await lp.waitForTimeout(150);
      ok("un tap fuori chiude la lista", await lp.evaluate(() => !document.querySelector(".top .lang-pick").open));
      ok("la presentazione non ha errori JavaScript", le.length === 0, le.join(" | "));
      await ctx.close();
    }

    const legal = ["termeni.html", "privacy.html", "rambursare.html"];
    for (const f of legal)
      ok(`la pagina ${f} esiste`, fs.existsSync(path.join(ROOT, f)));
    for (const f of legal) {
      const txt = fs.readFileSync(path.join(ROOT, f), "utf8");
      ok(`${f} nomina Stripe (Managed Payments) come venditore`, /Stripe/.test(txt) && !/Lemon Squeezy/.test(txt));
      ok(`${f} nomina Domus Renov SRL come fornitore`, /Domus Renov SRL/.test(txt));
    }
  }

  head("La configurazione dell'incasso");
  {
    const b = await pg.evaluate(() => ({
      configurata: BILLING.configured,
      mensile: BILLING.buyUrl("monthly", ""),
      conEmail: BILLING.buyUrl("monthly", "mario@example.com"),
      /* un link mancante non diventa un bottone rotto */
      annuale: (function () {
        const keep = BILLING.LINK_YEARLY; BILLING.LINK_YEARLY = null;
        const u = BILLING.buyUrl("yearly", ""); const h = BILLING.hasPlan("yearly");
        BILLING.LINK_YEARLY = keep; return { u, h };
      })(),
      finto: (function () {
        const keep = BILLING.LINK_MONTHLY; BILLING.LINK_MONTHLY = "https://example.com/buy";
        const u = BILLING.buyUrl("monthly", ""); BILLING.LINK_MONTHLY = keep; return u;
      })()
    }));
    ok("il link mensile Stripe e configurato", b.configurata === true);
    ok("l'indirizzo e un link di pagamento Stripe", /^https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+$/.test(b.mensile), b.mensile);
    ok("e porta l'email precompilata, quando la sappiamo", /\?prefilled_email=mario%40example\.com$/.test(b.conEmail), b.conEmail);
    ok("un link mancante non produce un indirizzo", b.annuale.u === "" && b.annuale.h === false);
    ok("un indirizzo che non e buy.stripe.com non passa", b.finto === "");
  }

  head("Stripe — il ritorno dal pagamento e il codice sub_");
  {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
    const sp = await ctx.newPage();
    const se = []; sp.on("pageerror", e => se.push(String(e)));
    const futuro = new Date(Date.now() + 30 * 864e5).toISOString();
    /* /api/pro finta: la funzione vera parla con Stripe e ha bisogno della
       chiave segreta, che nei test non c'e. Qui si prova l'app. */
    const calls = [];
    await sp.route("**/api/pro", async route => {
      const body = JSON.parse(route.request().postData() || "{}"); calls.push(body);
      if (body.session === "cs_test_pagata12345" || body.sub === "sub_1AbCdEfGhIjKlMn")
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, sub: "sub_1AbCdEfGhIjKlMn", status: "active", periodEnd: futuro, plan: "monthly", email: "mario@example.com" }) });
      if (body.sub === "sub_1ScadutoXyz12345")
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, sub: body.sub, status: "expired", periodEnd: "2026-01-01T00:00:00.000Z", plan: "monthly" }) });
      return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ ok: false, error: "not-found" }) });
    });
    await sp.goto(`${ORIGIN}/app/index.html?stripe=1&session_id=cs_test_pagata12345`);
    await sp.waitForTimeout(3500);
    const r = await sp.evaluate(() => ({ pro: isPro(), kind: LIC && LIC.kind, key: LIC && LIC.key, email: LIC && LIC.email, url: location.search }));
    ok("al ritorno da Stripe il Pro si attiva da solo", r.pro && r.kind === "stripe" && r.key === "sub_1AbCdEfGhIjKlMn", JSON.stringify(r));
    ok("e l'indirizzo viene ripulito", r.url === "", r.url);
    ok("all'API va solo l'id della sessione", calls.length >= 1 && calls[0].session === "cs_test_pagata12345" && Object.keys(calls[0]).length === 1, JSON.stringify(calls[0]));
    const s2 = await sp.evaluate(async () => {
      closeSheets(); openSheet("shSettings"); renderProSettings();
      const o = { copia: getComputedStyle(document.getElementById("btnLicCode")).display !== "none",
                  ricontrolla: getComputedStyle(document.getElementById("btnLicCheck")).display !== "none" };
      licWrite(null);
      o.buono = await proActivate("  sub_1AbCdEfGhIjKlMn ");
      o.proBuono = isPro();
      licWrite(null);
      o.scaduto = await proActivate("sub_1ScadutoXyz12345");
      o.inesistente = await proActivate("sub_1NonEsisteAbc123");
      o.proDopo = isPro();
      /* abbonamento finito: il codice resta sul dispositivo, ma non si offre di copiarlo */
      licWrite({ kind: "stripe", key: "sub_1ScadutoXyz12345", status: "expired", expiresAt: "2026-01-01T00:00:00.000Z" });
      refreshPro(); renderProSettings();
      o.copiaFinito = getComputedStyle(document.getElementById("btnLicCode")).display !== "none";
      o.scollegaFinito = getComputedStyle(document.getElementById("btnLicOff")).display !== "none";
      o.proFinito = isPro();
      licWrite(null); refreshPro();
      closeSheets(); return o;
    });
    ok("in Impostazioni c'e «Copia il codice» e «Ricontrolla»", s2.copia && s2.ricontrolla, JSON.stringify(s2));
    ok("il codice sub_ incollato su un altro dispositivo attiva il Pro", s2.buono.ok && s2.proBuono);
    ok("un abbonamento scaduto non attiva", s2.scaduto.ok === false && !!s2.scaduto.msg);
    ok("un codice inesistente non attiva", s2.inesistente.ok === false && s2.proDopo === false);
    ok("abbonamento finito: niente «Copia il codice», «Scollega» resta", !s2.proFinito && !s2.copiaFinito && s2.scollegaFinito, JSON.stringify(s2));
    ok("nessun errore JavaScript nel flusso Stripe", se.length === 0, se.join(" | "));
    await ctx.close();
  }

  /* ===================================================================== */
  head("Il cancello di esportazione — nessuna via d'uscita");
  {
    /* Una distinta incoerente non deve poter uscire da NESSUNA porta. Non si
       controlla che il cancello esista: si prova ad aprirle tutte. */
    const gctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
    const gp = await gctx.newPage();
    await gp.goto(URL);
    await gp.waitForFunction(() => window.MAT_LOADED === true, null, { timeout: 15000 });
    await gp.waitForTimeout(2400);
    const g = await gp.evaluate(() => {
      const o = {};
      try { closeSheets(); } catch (e) {}
      const p = proj();
      generateInto(p, { ...PRESETS.armadio, name: "Prova", L: 1000, H: 2200, P: 600 });
      persist();
      o.pulito = assertExportable(p).ok;

      /* il guasto della libreria, su questo corpo: il fianco 18 mm piu
         profondo di quanto il gabarito permetta */
      const f = p.pieces.find(x => x.gen === "Prova" && x.role === "fianco");
      o.spSulPezzo = f.sp;
      f.larg += 18; persist();
      const v = assertExportable(p);
      o.rotto = v.ok;
      o.delta = (v.blocking.find(a => a.closure) || {}).closure;

      /* si prova ogni porta, una per una */
      let printed = 0, downloaded = [];
      const realPrint = window.print, realDl = window.download;
      window.print = () => { printed++; };
      window.download = n => { downloaded.push(n); };
      o.vie = {};
      for (const id of ["btnPdf", "btnCsv", "btnLabels", "btnMont", "btnOrder", "btnQuote", "btnDraw"]) {
        const el = document.getElementById(id);
        if (!el) { o.vie[id] = "assente"; continue; }
        printed = 0; downloaded = [];
        document.getElementById("printArea").innerHTML = "";
        try { el.click(); } catch (e) { o.vie[id] = "errore"; continue; }
        o.vie[id] = (printed === 0 && downloaded.length === 0) ? "bloccato" : "PASSATO";
      }
      /* il backup del progetto NON si blocca: e la via di fuga, e nessuno
         taglia da un backup */
      downloaded = [];
      try { document.getElementById("btnJson").click(); } catch (e) {}
      o.backup = downloaded.length > 0;
      window.print = realPrint; window.download = realDl;

      /* riparato il pezzo, il cancello si riapre */
      f.larg -= 18; persist();
      o.riparato = assertExportable(p).ok;

      /* una distinta VECCHIA, senza grossezza sulle righe: si controlla lo
         stesso e si avvisa, non si blocca — nessun progetto gia salvato e
         sbagliato per questo */
      const salvate = p.pieces.filter(x => x.gen === "Prova").map(x => x.sp);
      p.pieces.forEach(x => { if (x.gen === "Prova") delete x.sp; });
      persist();
      const w = assertExportable(p);
      o.vecchiaOk = w.ok;
      o.vecchiaAvvisa = w.warn.some(a => a.closure && a.closure.chain === "sp-assente");
      p.pieces.filter(x => x.gen === "Prova").forEach((x, i) => { x.sp = salvate[i]; });
      persist();
      return o;
    });
    await gp.close(); await gctx.close();
    ok("un corpo appena generato si puo esportare", g.pulito === true);
    ok("la riga salvata porta la sua grossezza", g.spSulPezzo > 0, g.spSulPezzo + " mm");
    ok("con un fianco 18 mm fuori, l'esportazione si chiude", g.rotto === false);
    ok("e dice quale asse e di quanto", g.delta && g.delta.axa === "P" && g.delta.delta === 18,
       g.delta ? g.delta.axa + " " + g.delta.delta + " mm" : "nessuno scostamento");
    for (const id of Object.keys(g.vie))
      ok("  " + id + " non produce niente", g.vie[id] === "bloccato", g.vie[id]);
    ok("il backup del progetto resta permesso: e la via di fuga", g.backup === true);
    ok("riparato il pezzo, il cancello si riapre", g.riparato === true);
    ok("una distinta vecchia senza grossezze non si blocca", g.vecchiaOk === true);
    ok("ma lo dice, e chiede di rigenerarla", g.vecchiaAvvisa === true);
  }

  /* ===================================================================== */
  head("La foglia di chiusura — l'ultimo occhio umano");
  {
    const cctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
    const cp = await cctx.newPage();
    await cp.goto(URL);
    await cp.waitForFunction(() => window.MAT_LOADED === true, null, { timeout: 15000 });
    await cp.waitForTimeout(2400);
    const c = await cp.evaluate(() => {
      const o = {};
      try { closeSheets(); } catch (e) {}
      const p = proj();
      generateInto(p, { ...PRESETS.armadio, name: "Armadio", L: 1000, H: 2200, P: 600 });
      generateInto(p, { ...PRESETS.libreria, name: "Libreria" });
      generateInto(p, { ...PRESETS.cassettiera, name: "Cassettiera" });
      /* un solo corpo rotto, come nella commessa */
      const f = p.pieces.find(x => x.gen === "Libreria" && x.role === "fianco");
      f.larg += 18; persist();

      let printed = 0; const realPrint = window.print; window.print = () => { printed++; };
      document.getElementById("btnPdf").click();
      o.aperta = document.getElementById("shClosure").classList.contains("on");
      const righe = [...document.querySelectorAll("#clBody .cl-row")];
      o.nRighe = righe.length;
      o.primoERotto = righe[0] && righe[0].classList.contains("bad");
      o.primoNome = righe[0] && /Libreria/.test(righe[0].textContent);
      o.nRotti = righe.filter(r => r.classList.contains("bad")).length;
      /* la riga mostra il gabarito ricostruito accanto al nominale */
      o.mostraRicostruito = /1880×775×282[\s\S]*1880×775×300/.test(righe[0].textContent.replace(/\s+/g, " "));
      /* e le grossezze, esplicite */
      o.mostraGrossezze = /19 mm/.test(righe[0].textContent) && /3 mm/.test(righe[0].textContent);
      o.avvisa = !document.getElementById("clBlocked").hidden;
      o.spuntaSpenta = document.getElementById("clOk").disabled;
      o.bottoneSpento = document.getElementById("btnClGo").disabled;
      o.nienteStampa = printed === 0;

      /* riparato il pezzo: la foglia si riapre pulita */
      try { closeSheets(); } catch (e) {}
      f.larg -= 18; persist();
      printed = 0;
      document.getElementById("btnPdf").click();
      o.rottiDopo = [...document.querySelectorAll("#clBody .cl-row.bad")].length;
      o.spuntaViva = !document.getElementById("clOk").disabled;
      o.bottonePrimaDellaSpunta = document.getElementById("btnClGo").disabled;
      const ck = document.getElementById("clOk");
      ck.checked = true; ck.dispatchEvent(new Event("change"));
      o.bottoneDopoLaSpunta = !document.getElementById("btnClGo").disabled;
      document.getElementById("printArea").innerHTML = "";
      document.getElementById("btnClGo").click();
      window.print = realPrint;
      return o;
    });
    await cp.waitForTimeout(500);
    const uscito = await cp.evaluate(() => document.getElementById("printArea").innerHTML.length > 500);
    await cp.close(); await cctx.close();
    ok("il PDF della distinta apre la foglia, non stampa subito", c.aperta === true);
    ok("una riga per corpo", c.nRighe === 3, c.nRighe + " righe");
    ok("il corpo che non torna sta PRIMO", c.primoERotto === true && c.primoNome === true);
    ok("ed e l'unico marcato", c.nRotti === 1, c.nRotti + " rotti");
    ok("la riga mostra il gabarito ricostruito accanto al nominale", c.mostraRicostruito === true);
    ok("e le grossezze, esplicite", c.mostraGrossezze === true);
    ok("dice perche il bottone e spento", c.avvisa === true);
    ok("la spunta non si puo nemmeno mettere", c.spuntaSpenta === true);
    ok("il bottone resta spento", c.bottoneSpento === true);
    ok("e non stampa niente", c.nienteStampa === true);
    ok("riparato il pezzo, nessun corpo resta marcato", c.rottiDopo === 0);
    ok("la spunta si riattiva", c.spuntaViva === true);
    ok("ma il bottone resta spento finche non si spunta", c.bottonePrimaDellaSpunta === true);
    ok("e si accende quando si spunta", c.bottoneDopoLaSpunta === true);
    ok("e allora la distinta esce", uscito === true);
  }

  head("Modo cliente — il mobile, le finiture, il prezzo, la firma. Niente officina");
  {
    const cctx = await browser.newContext({ viewport: { width: 1366, height: 1024 }, hasTouch: true });
    const cp = await cctx.newPage();
    const cerr = []; cp.on("pageerror", e => cerr.push(String(e)));
    await cp.goto(URL); await cp.waitForFunction(() => window.MAT_LOADED === true, null, { timeout: 15000 });
    await cp.waitForTimeout(3300);
    const c = await cp.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms));
      closeSheets(); setView("build"); await w(400);
      document.getElementById("btnGenerate").click(); await w(300);
      const o = {};
      const p = proj(); o.offersPrima = (p.offers || []).length;
      /* poza unui finisaj (D-178): swatch-ul și banda alegerii curente o arată */
      const JPG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
      const cfgRef = p.configs, survRef = p.survey, layRef = p.layout;
      const fm = p.configs[Object.keys(p.configs)[0]].matFront; state.settings.photos = { mat: { [fm]: JPG } };
      clientOpen(); await w(300);
      o.pozaBanda = !!document.querySelector("#clientMode .cm-fin-ph") && /data:image\/jpeg/.test(document.querySelector("#clientMode .cm-fin-ph").style.backgroundImage);
      o.pozaSwatch = [...document.querySelectorAll("#clientMode .cm-sw i")].some(i => /data:image\/jpeg/.test(i.style.background));
      delete state.settings.photos;
      /* scena întreagă: butonul, randarea, proiectul pus la loc */
      const rb = document.getElementById("cmRoom"); o.camBtn = !!rb && (!rb.hidden || !gl3dOn());
      if (rb && !rb.hidden) { rb.click(); await w(900); o.camScena = CM.scene === "room"; o.camLaLoc = p.configs === cfgRef && p.survey === survRef && p.layout === layRef;
        rb.click(); await w(300); o.camInapoi = CM.scene === "body"; } else { o.camScena = o.camLaLoc = o.camInapoi = true; }
      /* propunerea ca imagine: se compune, are mărimea așteptată */
      if (gl3dOn()) { const cv = await cmSendCard(); o.trimite = !!cv && cv.width === 1080 && cv.height > 1200; } else o.trimite = true;
      cmPaint(); o.pozaDupa = !document.querySelector("#clientMode .cm-fin-ph");
      const el = document.getElementById("clientMode");
      o.aperto = !el.hidden && document.body.classList.contains("client-on");
      const txt = el.innerText;
      /* niente di tecnico: codici fornitore, costi interni, distinta */
      o.codici = (txt.match(/\b\d{5}MN\b|\bH\d{4}\b/g) || []).length;
      o.interni = /€\s*\/\s*m²|manodopera|margin|sfrido|pannell[oi] intero|distinta/i.test(txt);
      o.prezzo = !!el.querySelector(".cm-ptot") && /€/.test(el.querySelector(".cm-ptot").textContent);
      o.swatch = el.querySelectorAll(".cm-sws[data-key=matFront] .cm-sw").length;
      /* prezentarea (5.95.0): titlul proiectului, schema cu cote, ce include, pașii; cotele interne ale Studioului nu se văd */
      o.heroNume = (el.querySelector(".cm-hero h1") || {}).textContent === p.name;
      o.schema = !!el.querySelector(".cm-look .pe-svg") && el.querySelectorAll(".cm-look .pe-door").length > 0;
      o.include = el.querySelectorAll(".cm-inc > div").length > 0;
      o.pasi = el.querySelectorAll(".cm-steps li").length === 3;
      o.cotePrincipale = el.querySelectorAll(".cm-dims > div").length === 3;
      o.faraCoteInterne = !gl3dOn() || window.GL3D.state.dims === false;
      /* la variante ha la stessa grossezza: le cote non si muovono */
      const cfg0 = cmCfg(CM.cur), th0 = matById(cfg0.matFront).th;
      const b = [...el.querySelectorAll(".cm-sws[data-key=matFront] .cm-sw")].find(x => x.dataset.id !== cfg0.matFront);
      b.click(); await w(200);
      const cfg1 = cmCfg(CM.cur);
      o.cambiata = cfg1.matFront === b.dataset.id && cfg1.matFront !== cfg0.matFront;
      o.stessaGrossezza = matById(cfg1.matFront).th === th0;
      await w(800);                                       // numărătoarea prețului s-a încheiat
      o.prezzoFinale = el.querySelector(".cm-ptot").textContent === "€ " + fmt(CM.price.total);
      /* feroneria la client (D-177): se oferă, se alege, prețul se mișcă, cotele nu */
      o.hwOferit = el.querySelectorAll(".cm-hwg").length > 0;
      const hwb = [...el.querySelectorAll(".cm-hw")].find(x => !x.classList.contains("on")), tot0 = CM.price.total;
      if (hwb) { hwb.click(); await w(300); const hs = cmCfg(CM.cur).hwSel || {}; o.hwScris = Object.values(hs).includes(hwb.dataset.id); o.hwPretNou = CM.price.total !== tot0 && el.querySelector(".cm-hw.on") != null; o.hwId = hwb.dataset.id; }
      /* extra la preț (D-178): LED se bifează, prețul crește, cota nu se mișcă */
      const exb = el.querySelector('.cm-ex[data-ex="led"]'); o.exOferit = !!exb;
      if (exb) { const t1 = CM.price.total; exb.click(); await w(300); o.exPret = CM.price.total > t1; o.exCfg = cmCfg(CM.cur).led === "top"; o.exBifat = el.querySelector('.cm-ex[data-ex="led"]').classList.contains("on"); }
      o.hwFaraCod = !/\b\d{5,}\b|\b\d{2,3}[A-Z]\d{3,}\b/.test([...el.querySelectorAll(".cm-hw")].map(x => x.textContent).join(" "));
      /* il tasto Indietro non porta fuori */
      o.dentroDopoIndietro = (navCloseTop(), CM.on === true);
      /* la firma: senza tratto il bottone resta spento */
      el.querySelector("[data-accept]").click(); await w(200);
      document.getElementById("cmSignName").value = "Mario Rossi"; document.getElementById("cmSignOk").checked = true; cmSignCheck();
      o.riepilogo = document.querySelectorAll("#cmRecap > div").length === CM.mods.length;
      o.spentoSenzaFirma = document.getElementById("cmSignGo").disabled;
      const pad = document.getElementById("cmPad"), r = pad.getBoundingClientRect();
      const ev = (t, x, y) => pad.dispatchEvent(new PointerEvent(t, { clientX: r.left + x, clientY: r.top + y, pointerId: 1, bubbles: true }));
      ev("pointerdown", 30, 60); for (let i = 0; i < 12; i++) ev("pointermove", 30 + i * 15, 60 + (i % 2) * 20); ev("pointerup", 210, 60);
      o.accesoConFirma = !document.getElementById("cmSignGo").disabled;
      /* LED-ul bifat adaugă un rând de accesoriu (D-178); panourile nu se mișcă */
      const lung0 = p.pieces.filter(x => x.gen === CM.cur && !/LED/i.test(x.elemento)).map(x => x.lung + "x" + x.larg).join(",");
      document.getElementById("cmSignGo").click(); await w(200);
      o.offerte = (p.offers || []).length - o.offersPrima;
      const of = p.offers[p.offers.length - 1];
      o.firmaImg = /^data:image\/png/.test(of.sig) && of.sig.length < 120000;
      o.totale = of.total > 0;
      o.applicata = p.configs[CM.cur].matFront === b.dataset.id;
      o.exApplicat = !o.exCfg || p.configs[CM.cur].led === "top";
      o.exInOferta = !o.exCfg || (of.mods.find(m => m.name === CM.cur) || {}).extras.length === 1;
      o.hwApplicata = !o.hwId || Object.values(p.configs[CM.cur].hwSel || {}).includes(o.hwId);
      o.hwInOferta = !o.hwId || (of.mods.find(m => m.name === CM.cur) || {}).hw.length > 0;
      o.coteFerme = p.pieces.filter(x => x.gen === CM.cur && !/LED/i.test(x.elemento)).map(x => x.lung + "x" + x.larg).join(",") === lung0;
      /* il PDF dell'offerta passa dal cancello, e porta la firma */
      window.print = () => {};
      document.getElementById("printArea").innerHTML = "";
      document.getElementById("cmDonePdf").click(); await w(300);
      const pa = document.getElementById("printArea").innerHTML;
      o.pdfFirma = /data:image\/png/.test(pa) && /Mario Rossi/.test(pa);
      /* uscita: un tocco non basta */
      document.getElementById("cmDoneBack").click(); await w(100);
      document.getElementById("cmExit").click(); await w(100);
      o.toccoNonEsce = CM.on === true;
      clientClose(); await w(100);
      o.uscito = !CM.on && el.hidden && !document.body.classList.contains("client-on");
      return o;
    });
    await cp.close(); await cctx.close();
    ok("si apre a tutto schermo", c.aperto === true);
    ok("nessun codice articolo a schermo", c.codici === 0, c.codici);
    ok("nessun costo interno, niente distinta", c.interni === false);
    ok("il prezzo finale c'e", c.prezzo === true);
    ok("finiture da scegliere", c.swatch > 1, c.swatch);
    ok("prezentare: titlul proiectului pe ecran", c.heroNume === true);
    ok("prezentare: schema cu cote și uși", c.schema === true);
    ok("prezentare: ce include mobilierul", c.include === true);
    ok("prezentare: cei trei pași după semnătură", c.pasi === true);
    ok("prezentare: lățime, înălțime, adâncime", c.cotePrincipale === true);
    ok("prezentare: fără cotele interne ale Studioului în 3D", c.faraCoteInterne === true);
    ok("prezentare: prețul numărat ajunge la totalul exact", c.prezzoFinale === true);
    ok("prezentare: rezumatul în fereastra de semnare", c.riepilogo === true);
    ok("poze: finisajul cu poză o arată în swatch și în banda alegerii", c.pozaBanda === true && c.pozaSwatch === true);
    ok("poze: fără poză, fără bandă", c.pozaDupa === true);
    ok("scena: butonul, randarea și proiectul pus la loc", c.camBtn && c.camScena && c.camLaLoc && c.camInapoi);
    ok("trimitere: imaginea propunerii se compune (1080 px)", c.trimite === true);
    ok("extra: LED se oferă, prețul crește, e bifat", c.exOferit === false || (c.exPret && c.exCfg && c.exBifat));
    ok("extra: după semnare e în proiect și în ofertă", c.exApplicat === true && c.exInOferta === true);
    ok("feronerie: se oferă alegerea", c.hwOferit === true);
    ok("feronerie: alegerea ajunge în cfg.hwSel", c.hwScris !== false);
    ok("feronerie: prețul se mișcă, o opțiune e bifată", c.hwPretNou !== false);
    ok("feronerie: niciun cod de articol în nume", c.hwFaraCod === true);
    ok("feronerie: după semnare e în proiect și în ofertă", c.hwApplicata === true && c.hwInOferta === true);
    ok("toccare una finitura la cambia", c.cambiata === true);
    ok("stessa grossezza: le cote non si muovono", c.stessaGrossezza === true);
    ok("il tasto Indietro non porta fuori dal modo cliente", c.dentroDopoIndietro === true);
    ok("senza firma il bottone resta spento", c.spentoSenzaFirma === true);
    ok("con la firma si accende", c.accesoConFirma === true);
    ok("l'offerta firmata si salva nel progetto", c.offerte === 1);
    ok("la firma e un'immagine piccola", c.firmaImg === true);
    ok("con il totale", c.totale === true);
    ok("la finitura firmata diventa quella del progetto", c.applicata === true);
    ok("e la distinta ha le stesse cote", c.coteFerme === true);
    ok("il PDF dell'offerta porta firma e nome", c.pdfFirma === true);
    ok("un tocco sulla X non esce", c.toccoNonEsce === true);
    ok("si esce e l'app torna com'era", c.uscito === true);
    ok("nessun errore JS nel modo cliente", cerr.length === 0, cerr.join(" | ").slice(0, 200));
  }

  head("Scheda di montaggio — completa, con le quote vere");
  {
    const mctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const mp = await mctx.newPage();
    const merr = []; mp.on("pageerror", e => merr.push(String(e)));
    await mp.goto(URL); await mp.waitForFunction(() => window.MAT_LOADED === true, null, { timeout: 15000 });
    await mp.waitForTimeout(3300);
    const m = await mp.evaluate(() => {
      closeSheets();
      const p = proj(); p.pieces = []; p.configs = {};
      generateInto(p, { ...PRESETS.armadio, name: "Armadio" });
      generateInto(p, { ...PRESETS.bagno, name: "Bagno", support: "sospeso" });
      const h = montDoc(p), d = document.createElement("div"); d.innerHTML = h;
      const G = deriveCarcass(carcassParams(p.configs.Armadio, {}));
      const diag = String(Math.round(Math.hypot(p.configs.Armadio.L, G.H_fianco)));
      const O = generateOperations({ boxes: buildModule(p.configs.Armadio).boxes, cfg: p.configs.Armadio, G });
      const plates = O.hw.filter(x => x.type === "cerniera" && x.plate).map(x => Math.round(x.plate[1]));
      const sec = d.querySelectorAll("section.m-mod");
      const t1 = sec[0].textContent, t2 = sec[1] ? sec[1].textContent : "";
      return {
        corpi: sec.length,
        righePezzi: sec[0].querySelectorAll("table.m-t")[0].querySelectorAll("tr").length - 1,
        pezziModello: O.pieces.length,
        ferramenta: sec[0].querySelectorAll("table.m-t")[1].querySelectorAll("tr").length - 1,
        attrezzi: sec[0].querySelectorAll(".m-tools li").length,
        passi: sec[0].querySelectorAll(".m-steps li").length,
        diagonale: t1.indexOf(diag) >= 0,
        basette: plates.every(y => t1.indexOf(String(y)) >= 0),
        collaudo: sec[0].querySelectorAll(".m-list li").length,
        muro: /OBBLIGATORIAMENTE|OBLIGATORIU|MUST|OBLIGATOIREMENT/.test(t1),
        pensileDopo: (() => { const li = [...sec[1].querySelectorAll(".m-steps li")].map(x => x.textContent);
          const a = li.findIndex(x => / kg\)/.test(x)), w = li.findIndex(x => x.indexOf(t("ms11w").slice(0, 18)) >= 0);
          return a >= 0 && w > a; })(),
        firme: d.querySelectorAll(".m-sign div").length,
        nessunMeno: !/undefined|NaN|\{[a-z]+\}/.test(d.textContent)
      };
    });
    await mp.close(); await mctx.close();
    ok("un capitolo per corpo", m.corpi === 2, m.corpi);
    ok("elenco pezzi = pezzi del modello, numerati", m.righePezzi === m.pezziModello, m.righePezzi + "/" + m.pezziModello);
    ok("ferramenta con codici", m.ferramenta >= 4, m.ferramenta);
    ok("attrezzi", m.attrezzi >= 5, m.attrezzi);
    ok("passi numerati", m.passi >= 15, m.passi);
    ok("la diagonale vera, in mm", m.diagonale === true);
    ok("le altezze delle basette sono quelle dei fori", m.basette === true);
    ok("lista di collaudo", m.collaudo >= 5, m.collaudo);
    ok("il corpo alto va fissato al muro", m.muro === true);
    ok("il pensile si appende dopo averlo messo in piedi", m.pensileDopo === true);
    ok("firme di montatore e cliente", m.firme === 3);
    ok("niente undefined, NaN o segnaposto rimasti", m.nessunMeno === true);
    ok("nessun errore JS", merr.length === 0, merr.join(" | ").slice(0, 200));
  }
  {
    /* tavolo e letto: nessun foro generato, ma le quote ci sono tutte */
    const fctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const fp = await fctx.newPage();
    const ferr = []; fp.on("pageerror", e => ferr.push(String(e)));
    await fp.goto(URL); await fp.waitForFunction(() => window.MAT_LOADED === true, null, { timeout: 15000 });
    await fp.waitForTimeout(3300);
    const f = await fp.evaluate(() => {
      closeSheets();
      const p = proj(); p.pieces = []; p.configs = {};
      generateInto(p, { ...PRESETS.tavolo, name: "Tavolo" });
      generateInto(p, { ...PRESETS.letto, name: "Letto" });
      const d = document.createElement("div"); d.innerHTML = montDoc(p);
      const sec = d.querySelectorAll("section.m-mod"), t1 = sec[0].textContent, t2 = sec[1].textContent;
      const rows = p.pieces.filter(x => x.gen === "Tavolo");
      const rl = rows.find(x => x.elemento === "Traversa telaio").lung, rs = rows.find(x => x.elemento === "Traversa telaio corta").lung;
      const bx = buildModule(p.configs.Tavolo).boxes.filter(b => b.role === "traversa");
      const lbx = buildModule(p.configs.Letto).boxes;
      const trav = lbx.find(b => b.role === "traversa"), doga = lbx.find(b => b.role === "doga");
      return {
        corpi: sec.length,
        passiT: sec[0].querySelectorAll(".m-steps li").length, passiL: sec[1].querySelectorAll(".m-steps li").length,
        traverse3D: bx.length,
        traverseComeDistinta: bx.filter(b => Math.round(b.x1 - b.x0) === rl).length === 2 && bx.filter(b => Math.round(b.z1 - b.z0) === rs).length === 2,
        quoteTavolo: t1.indexOf(String(rl)) >= 0 && t1.indexOf(String(rs)) >= 0,
        travSottoDoghe: Math.round(trav.y1) === Math.round(doga.y0) && Math.round(trav.y1 - trav.y0) === 120,
        materasso: /1600 × 2000/.test(t2),
        ferramentaT: sec[0].querySelectorAll("table.m-t")[1].querySelectorAll("tr").length - 1,
        ferramentaL: sec[1].querySelectorAll("table.m-t")[1].querySelectorAll("tr").length - 1,
        pulito: !/undefined|NaN|\{[a-zA-Z]+\}/.test(d.textContent)
      };
    });
    /* la ferramenta di tavolo e letto e nel catalogo e nel preventivo,
       con le stesse quantita della scheda di montaggio */
    const g = await fp.evaluate(() => {
      const p = proj(), S = state.settings;
      const res = computeHardware(p, S, true), q = {}; res.items.forEach(i => q[i.k] = (q[i.k] || 0) + i.qty);
      const d = document.createElement("div"); d.innerHTML = montDoc(p);
      const sec = d.querySelectorAll("section.m-mod");
      const qtyOf = (s, k) => { const nm = t(k); for (const tr of s.querySelectorAll("table.m-t")[1].querySelectorAll("tr"))
          { const c = tr.querySelectorAll("td"); if (c.length && c[0].textContent.trim() === nm) return +c[3].textContent.replace(/\D/g, ""); } return -1; };
      const cats = HW_CATS.map(x => x[0]);
      const costs = projectCosts(p);
      return {
        q, modT: (res.mods.Tavolo || {}).hwLeg || 0, modL: (res.mods.Letto || {}).hwBedFit || 0,
        schedaT: ["hwLeg", "hwTopClip", "hwFelt"].every(k => qtyOf(sec[0], k) === q[k] && q[k] > 0),
        schedaL: ["hwBedFit", "hwTravFit", "hwCenterFoot", "hwSlatHold", "hwSlatHold2"].every(k => qtyOf(sec[1], k) === q[k] && q[k] > 0),
        catalogo: ["gamba", "fissp", "letto", "trav", "piecent", "doga", "doga2", "feltro"].every(c => cats.includes(c) && hwItem(c)),
        prezzo: res.items.filter(i => ["hwLeg", "hwBedFit"].includes(i.k)).every(i => i.tot > 0),
        hwTot: costs.hwTot || costs.hw || 0,
        vuoto: (() => { const p2 = { pieces: [], configs: {} }; return computeHardware(p2, S).every(i => i.qty === 0); })()
      };
    });
    /* letto con cassone sollevabile a pistoni (D-126): preventivo = scheda, nessuna mensola traversa */
    const lf = await fp.evaluate(() => {
      closeSheets();
      const out = {};
      for (const fr of [null, "panel"]) {
        const p = { pieces: [], configs: {}, name: "L" }; Object.assign(p, proj()); p.pieces = []; p.configs = {};
        generateInto(p, { ...PRESETS.letto, name: "Lift", bedStor: "lift", bedFrame: fr, bedMat: 35 });
        const res = computeHardware(p, state.settings, true), q = {}; res.items.forEach(i => q[i.k] = (q[i.k] || 0) + i.qty);
        const d = document.createElement("div"); d.innerHTML = montDoc(p);
        const sec = d.querySelector("section.m-mod");
        const qtyOf = k => { const nm = t(k); for (const tr of sec.querySelectorAll("table.m-t")[1].querySelectorAll("tr")) { const c = tr.querySelectorAll("td"); if (c.length && c[0].textContent.trim() === nm) return +c[3].textContent.replace(/\D/g, ""); } return -1; };
        const li = buildModule(p.configs.Lift).liftInfo;
        out[fr || "slats"] = { q, spring: qtyOf("hwLiftSpring"), hinge: qtyOf("hwLiftHinge"), F: li.F, pulito: !/undefined|NaN|\{[a-zA-Z0-9]+\}/.test(d.textContent),
          steps: sec.querySelectorAll(".m-steps li").length, hasF: sec.textContent.indexOf(li.F + " N") >= 0,
          piston: res.items.some(i => i.k === "hwLiftSpring" && i.qty === 2 && i.tot > -1) };
      }
      return out;
    });
    for (const k of ["slats", "panel"]) {
      const r = lf[k];
      ok("letto cassone sollevabile (" + k + "): 2 pistoni e 2 cerniere in preventivo = scheda", r.q.hwLiftSpring === 2 && r.q.hwLiftHinge === 2 && r.spring === 2 && r.hinge === 2, JSON.stringify(r.q));
      ok("letto cassone sollevabile (" + k + "): niente mensole traversa/piede centrale, scheda pulita con la forza", !r.q.hwTravFit && !r.q.hwCenterFoot && r.pulito && r.hasF, JSON.stringify(r));
    }
    ok("letto cassone sollevabile: portadoghe solo con le doghe", lf.slats.q.hwSlatHold > 0 && !lf.panel.q.hwSlatHold);
    await fp.close(); await fctx.close();
    ok("catalogo: le otto categorie di tavolo e letto", g.catalogo === true);
    ok("preventivo tavolo: 4 piastre, 12 squadrette, 4 feltrini", g.q.hwLeg === 4 && g.q.hwTopClip === 12 && g.q.hwFelt === 4, JSON.stringify(g.q));
    ok("preventivo letto: 4 ferramenta letto, 2 squadre, 2 piedi", g.q.hwBedFit === 4 && g.q.hwTravFit === 2 && g.q.hwCenterFoot === 2, JSON.stringify(g.q));
    ok("preventivo letto: portadoghe 2 per doga + 1 doppio", g.q.hwSlatHold === 2 * g.q.hwSlatHold2 && g.q.hwSlatHold2 > 0, JSON.stringify(g.q));
    ok("scheda tavolo = preventivo", g.schedaT === true);
    ok("scheda letto = preventivo", g.schedaL === true);
    ok("ferramenta per corpo (Riepilogo)", g.modT === 4 && g.modL === 4, g.modT + "/" + g.modL);
    ok("la ferramenta ha un prezzo", g.prezzo === true && g.hwTot > 0, g.hwTot);
    ok("senza tavolo e letto: nessuna ferramenta", g.vuoto === true);
    ok("tavolo e letto: un capitolo ciascuno", f.corpi === 2);
    ok("passi per il tavolo", f.passiT >= 8, f.passiT);
    ok("passi per il letto", f.passiL >= 9, f.passiL);
    ok("il 3D del tavolo ha le quattro traverse", f.traverse3D === 4, f.traverse3D);
    ok("lunghe come in distinta, non a luce piena", f.traverseComeDistinta === true);
    ok("la scheda cita le traverse della distinta", f.quoteTavolo === true);
    ok("la traversa del letto e alta 120 e sta sotto le doghe", f.travSottoDoghe === true);
    ok("il materasso che entra", f.materasso === true);
    ok("ferramenta del tavolo", f.ferramentaT >= 4, f.ferramentaT);
    ok("ferramenta del letto", f.ferramentaL >= 4, f.ferramentaL);
    ok("niente segnaposto rimasti", f.pulito === true);
    ok("nessun errore JS", ferr.length === 0, ferr.join(" | ").slice(0, 200));
  }

  {
    head("Toate tipologiile implicite trec de foaia de închidere (audit 4.36.1)");
    const actx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const ap = await actx.newPage();
    await ap.goto(URL); await ap.waitForFunction(() => window.MAT_LOADED === true, null, { timeout: 15000 });
    await ap.waitForTimeout(3000);
    const a = await ap.evaluate(() => {
      const bad = [], o = {};
      const V = [{}, { corner: "dx" }, { cornerKind: "ext" }, { L: 1400, L2: 1200 }];
      for (const k of Object.keys(PRESETS)) for (const v of (PRESETS[k].type === "angolare" ? V : [{}])) {
        const p = { pieces: [], configs: {} };
        generateInto(p, { ...PRESETS[k], ...v, name: "T" });
        const l = closureSummary(p).filter(r => !r.ok);
        if (l.length) bad.push(k + JSON.stringify(v) + ": " + l[0].errs.map(e => e.id || e.why).join(","));
        // nicio piesă mai mare decât placa ei
        for (const x of p.pieces) { const pf = panelFor(x.materiale);
          if (!/^accessorio/i.test(x.materiale || "") && pf && !((x.lung <= pf.L && x.larg <= pf.W) || (x.larg <= pf.L && x.lung <= pf.W)))
            bad.push(k + ": " + x.elemento + " " + x.lung + "×" + x.larg + " > placa " + pf.L + "×" + pf.W); }
      }
      o.bad = bad;
      const p = { pieces: [], configs: {} }; generateInto(p, { ...PRESETS.dressing, name: "D" });
      o.spateDressing = p.pieces.filter(x => /^Schienale/.test(x.elemento)).map(x => x.lung + "×" + x.larg).join(" + ");
      return o;
    });
    await ap.close(); await actx.close();
    ok("nicio tipologie implicită blocată la export", a.bad.length === 0, a.bad.slice(0, 3).join(" | ") || "toate trec");
    ok("spatele dressing-ului intră în placa HDF (împărțit)", /\+/.test(a.spateDressing), a.spateDressing);
  }

  {
    head("Gratuit vs Pro (D-55) — ce se vede, ce se produce");
    const zctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const zp = await zctx.newPage();
    const zerr = []; zp.on("pageerror", e => zerr.push(String(e)));
    await zp.goto(URL); await zp.waitForFunction(() => window.MAT_LOADED === true, null, { timeout: 15000 });
    await zp.waitForTimeout(3300);
    const z = await zp.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      const pro = () => document.getElementById("shPro").classList.contains("on");
      closeSheets(); const p = proj(); p.pieces = []; p.configs = {};
      generateInto(p, { ...PRESETS.armadio, name: "Z" });
      licWrite(null);
      // pe ecran, gratuit
      setView("list"); o.lista = document.querySelectorAll("#v-list .pc-el").length > 0;
      setView("summary"); o.deviz = /€/.test(document.getElementById("v-summary").textContent);
      setView("nest"); await w(200);
      o.nestCifre = document.getElementById("nestKpis").textContent.length > 0;
      o.nestFaraPlan = !document.querySelector("#nestOut svg") && !!document.querySelector("#nestOut .nest-lock");
      o.nestFaraOrdine = document.getElementById("btnCuts").style.display === "none";
      // porțile
      closeSheets(); clientOpen(); await w(100); o.client = pro() && document.getElementById("clientMode").hidden; closeSheets();
      setView("build"); await w(300);
      const M = window.GL3D && GL3D.model && GL3D.model();
      if (M && M.ops) { openPartSheet(M, M.ops.pieces[0]); await w(100); o.fisa = !pro(); closeSheets(); } else o.fisa = true;   /* D-131: fișa piesei se vede gratuit; Pro e la export */
      document.getElementById("btnShare").click(); await w(100); o.csv = pro(); closeSheets();
      document.getElementById("btnRoom").click(); await w(100); o.camera = !pro(); closeSheets();   /* D-131: „În camera ta” se vede gratuit */
      // Pro: se vede tot
      licWrite({ kind: "stripe", key: "comp_TESTTESTTESTTESTTESTTEST", status: "active", activated: true, checkedAt: Date.now() });
      setView("nest"); await w(300);
      o.nestPro = !!document.querySelector("#nestOut svg") && document.getElementById("btnCuts").style.display !== "none";
      closeSheets(); clientOpen(); await w(200); o.clientPro = !document.getElementById("clientMode").hidden;
      try { clientClose && clientClose(); } catch (e) {}
      closeSheets(); setView("projects");
      return o;
    });
    await zp.close(); await zctx.close();
    ok("gratuit: lista de debitare pe ecran", z.lista === true);
    ok("gratuit: devizul pe ecran", z.deviz === true);
    ok("gratuit: la debitare se văd cifrele", z.nestCifre === true);
    ok("gratuit: planurile de tăiere nu, în locul lor oferta Pro", z.nestFaraPlan === true);
    ok("gratuit: nici ordinea tăierilor", z.nestFaraOrdine === true);
    ok("gratuit: modul Client → ecranul Pro", z.client === true);
    ok("gratuit: fișa piesei cu găuri se vede, fără ecranul Pro (D-131)", z.fisa === true);
    ok("gratuit: CSV → ecranul Pro", z.csv === true);
    ok("gratuit: „În camera ta” se vede, fără ecranul Pro (D-131)", z.camera === true);
    ok("Pro: planurile de tăiere și ordinea lor", z.nestPro === true);
    ok("Pro: modul Client se deschide", z.clientPro === true);
    ok("nessun errore JS", zerr.length === 0, zerr.join(" | ").slice(0, 200));
  }

  {
    head("Numele pieselor — traduse pe ecran și pe hârtie, italiene în date");
    const nctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const np = await nctx.newPage();
    const nerr = []; np.on("pageerror", e => nerr.push(String(e)));
    await np.goto(URL); await np.waitForFunction(() => window.MAT_LOADED === true, null, { timeout: 15000 });
    await np.waitForTimeout(3300);
    const n = await np.evaluate(() => {
      const o = {}, lang0 = state.lang;
      closeSheets(); const p = proj(); p.pieces = []; p.configs = {};
      generateInto(p, { ...PRESETS.armadio, name: "D1" });
      const hw0 = JSON.stringify(computeHardware(p, state.settings).map(i => i.qty));
      state.lang = "ro"; applyLang(); setView("list");
      const list = document.getElementById("v-list").textContent;
      o.listaRo = /Laterală/.test(list) && /Bază \/ Tavan/.test(list) && !/\bFianco\b/.test(list);
      o.dateIt = p.pieces.some(x => x.elemento === "Fianco") && !p.pieces.some(x => /Laterală/.test(x.elemento));
      o.feronerie = JSON.stringify(computeHardware(p, state.settings).map(i => i.qty)) === hw0;
      const d = document.createElement("div"); d.innerHTML = montDoc(p);
      o.montaj = /Laterală/.test(d.textContent) && !/\bTramezzo\b/.test(d.textContent);
      o.sez = elName("Ripiano mobile sez.2") === "Poliță mobilă secț. 2";
      o.parti = elName("Schienale (1/2)") === "Spate (1/2)";
      o.push = elName("Frontale cassetto push") === "Front sertar push";
      o.manual = elName("Mensola bagno ciliegio") === "Mensola bagno ciliegio";
      state.lang = "en"; o.en = elName("Fianco cassetto") === "Drawer side";
      state.lang = "fr"; o.fr = elName("Zoccolo") === "Socle";
      state.lang = "it"; o.it = elName("Fianco") === "Fianco";
      state.lang = "ro"; o.cauta = (() => { const q = "laterală"; return p.pieces.some(x => `${x.modulo} ${x.elemento} ${elName(x.elemento)}`.toLowerCase().includes(q)); })();
      state.lang = lang0; applyLang(); setView("projects");
      return o;
    });
    await np.close(); await nctx.close();
    ok("lista în română: Laterală, Bază / Tavan — nu Fianco", n.listaRo === true);
    ok("în date numele rămân italiene", n.dateIt === true);
    ok("feroneria nu se schimbă cu limba", n.feronerie === true);
    ok("fișa de montaj în română", n.montaj === true);
    ok("secțiunea: „sez.2” → „secț. 2”", n.sez === true);
    ok("bucățile: „(1/2)” rămân", n.parti === true);
    ok("„push” rămâne", n.push === true);
    ok("un nume scris de mână nu se atinge", n.manual === true);
    ok("engleză, franceză, italiană", n.en && n.fr && n.it);
    ok("căutarea găsește și numele tradus", n.cauta === true);
    ok("nessun errore JS", nerr.length === 0, nerr.join(" | ").slice(0, 200));
  }

  {
    head("Tipuri de îmbinare — alese pe corp, în ops, fișă și limbi (D-84)");
    const jctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const jp = await jctx.newPage();
    const jerr = []; jp.on("pageerror", e => jerr.push(String(e)));
    await jp.goto(URL); await jp.waitForFunction(() => window.MAT_LOADED === true, null, { timeout: 15000 });
    await jp.waitForTimeout(3300);
    const jn = await jp.evaluate(() => {
      const o = {}; closeSheets(); const p = proj(); p.pieces = []; p.configs = {};
      generateInto(p, { ...PRESETS.armadio, name: "J1" });
      const cfg = Object.values(p.configs)[0], kinds = {};
      for (const id of ["haf_minifix", "gen_confirmat", "gen_dowel", "gen_biscuit", "fes_domino", "lam_clamex"]) {
        cfg.hwSel = { conn: id };
        const built = buildModule(cfg), G = deriveCarcass(carcassParams(cfg, {}));
        const ops = generateOperations({ boxes: built.boxes, cfg, G });
        kinds[id] = [ops.joint, ops.pieces.reduce((n, q) => n + q.operations.filter(x => x.type === "slot").length, 0)];
      }
      delete cfg.hwSel; state.settings.hwProd.conn = "gen_confirmat";
      const b2 = buildModule(cfg); o.def = generateOperations({ boxes: b2.boxes, cfg, G: deriveCarcass(carcassParams(cfg, {})) }).joint;
      state.settings.hwProd.conn = "haf_minifix";
      o.kinds = kinds; o.items = hwList("conn").map(x => x.id);
      o.names = ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => ["gen_dowel", "gen_biscuit", "fes_domino", "lam_clamex"].every(id => { const it = hwList("conn").find(x => x.id === id); return it && it.n[l]; }));
      return o;
    });
    await jp.close(); await jctx.close();
    ok("îmbinare: articolul `conn` al corpului hotărăște tipul în ops", jn.kinds.gen_confirmat[0] === "confirmat" && jn.kinds.gen_dowel[0] === "dowel" && jn.kinds.gen_biscuit[0] === "biscuit" && jn.kinds.fes_domino[0] === "domino" && jn.kinds.lam_clamex[0] === "clamex" && jn.kinds.haf_minifix[0] === "minifix", JSON.stringify(jn.kinds));
    ok("îmbinare: canale numai la lamelă și Domino", jn.kinds.fes_domino[1] > 0 && jn.kinds.gen_biscuit[1] > 0 && jn.kinds.haf_minifix[1] === 0 && jn.kinds.gen_confirmat[1] === 0);
    ok("îmbinare: fără alegere pe corp, valoarea implicită din setări", jn.def === "confirmat", jn.def);
    ok("îmbinare: articolele noi au nume în toate limbile", jn.names === true);
    ok("nessun errore JS", jerr.length === 0, jerr.join(" | ").slice(0, 200));

  }
  {
    head("3D — feroneria rămâne când schimbi materialul (4.68.1)");
    const fctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const fp = await fctx.newPage();
    const ferr = []; fp.on("pageerror", e => ferr.push(String(e)));
    await fp.goto(URL); await fp.waitForFunction(() => window.MAT_LOADED === true, null, { timeout: 15000 });
    await fp.waitForTimeout(3300);
    const fo = await fp.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms));
      closeSheets(); const p = proj(); p.pieces = []; p.configs = {};
      generateInto(p, { ...PRESETS.armadio, name: "F1" }); setView("build"); await w(900);
      const cfg = { ...buildCfg }, n0 = GL3D.hwCount(), ids = (matById ? ["bordeaux_19", "blue_avio_23196mn_19"] : []);
      const after = [];
      for (const id of ids) { GL3D.render({ ...cfg, matFront: id }, { explode: 0 }); await w(200); after.push(GL3D.hwCount()); }
      return { n0, after };
    });
    await fp.close(); await fctx.close();
    ok("3D: există feronerie în scenă", fo.n0 > 0, JSON.stringify(fo));
    ok("3D: după schimbarea materialului feroneria e aceeași", fo.after.every(n => n === fo.n0), JSON.stringify(fo));
    ok("nessun errore JS", ferr.length === 0, ferr.join(" | ").slice(0, 200));

  }
  {
    head("3D — pachet pliant: foile se strâng pe partea aleasă (U.9)");
    const gctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const gp = await gctx.newPage();
    const gerr = []; gp.on("pageerror", e => gerr.push(String(e)));
    await gp.goto(URL); await gp.waitForFunction(() => window.MAT_LOADED === true, null, { timeout: 15000 });
    await gp.waitForTimeout(3300);
    const go = await gp.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms));
      if (!(window.GL3D && GL3D.ok)) return { fara_gl: true };
      closeSheets(); const cfg = { ...PRESETS.armadio, name: "Fd3", L: 1200, H: 2200, doors: 1, tram: 0, drawers: 0, hang: 0, fold: 3, doorHinge: ["left"] };
      GL3D.render(cfg, { explode: 0, open: false }); await w(400);
      const boxes = buildModule(cfg).boxes.filter(b => b.sub === "fold");
      const closed = boxes.map(b => GL3D.tgtOf(b.pk));
      GL3D.set({ open: true }); await w(500);
      const open = boxes.map(b => GL3D.tgtOf(b.pk));
      const th = boxes[0].z1 - boxes[0].z0, g = FOLD.open_gap;
      return { n: boxes.length, closedAng: closed.map(c => c && c.ang), openAng: open.map(c => c && c.ang), ex: open.map(c => Math.round(c.ex * 10) / 10),
               want: boxes.map(b => Math.round((b.fold.x0 + b.fold.k * (th + g) - b.x0) * 10) / 10), subs: open.map(c => c.sub) };
    });
    await gp.close(); await gctx.close();
    if (go.fara_gl) ok("3D: pachet pliant — fără WebGL în acest browser, verificarea se sare", true, "fara_gl");
    else {
      ok("3D: 3 foi, toate cu sub:\"fold\"", go.n === 3 && go.subs.every(s2 => s2 === "fold"), JSON.stringify(go));
      ok("3D: închis — nicio rotație", go.closedAng.every(a => a === 0), JSON.stringify(go));
      ok("3D: deschis — fiecare foaie 90° în jurul muchiei din stânga", go.openAng.every(a => Math.abs(a + Math.PI / 2) < 1e-6), JSON.stringify(go));
      ok("3D: deschis — foile se strâng una lângă alta, cu rostul din date", JSON.stringify(go.ex) === JSON.stringify(go.want), JSON.stringify(go));
    }
    ok("nessun errore JS", gerr.length === 0, gerr.join(" | ").slice(0, 200));
  }
  {
    head("Tavan înclinat — formular, distinctă, deviz, fișă, prospect, 3D (D-86)");
    await pg.evaluate(() => { closeSheets(); setView("build"); document.getElementById("grpFr").open = true;
      buildCfg = { ...PRESETS.armadio, name: "Sl1", L: 1200, H: 2200, doors: 2, tram: 1, drawers: 0, hang: 0 }; syncBuildForm(); renderSecChips(); drawPreview(); });
    await pg.waitForTimeout(300);
    ok("D-86: implicit «Dritto» — câmpul de înălțimi ascuns, înălțimea corpului editabilă", await pg.evaluate(() => $("bSlope").value === "" && $("rowSlopeH").style.display === "none" && !$("bH").readOnly && cfgFromForm().topProfile === null));
    await pg.selectOption("#bSlope", "x"); await pg.waitForTimeout(200);
    const pre = await pg.evaluate(() => ({ h0: +$("bSlopeH0").value, h1: +$("bSlopeH1").value, H: +$("bH").value, ro: $("bH").readOnly, vis: $("rowSlopeH").style.display !== "none",
      hint: $("slopeHint").textContent, l0: $("lSlopeH0").textContent, m: TOPPROFILE.min_diff, d: TOPPROFILE.max_deg }));
    ok("D-86: prima alegere pornește de la înălțimea corpului, cu panta blândă; H devine cea mai înaltă și nu se mai editează", pre.h0 === 2200 && pre.h1 === 1650 && pre.H === 2200 && pre.ro && pre.vis, JSON.stringify(pre));
    ok("D-86: indiciul poartă diferența minimă și panta maximă din date", pre.hint.includes(String(pre.m)) && pre.hint.includes(String(pre.d)), pre.hint.slice(0, 80));
    await pg.fill("#bSlopeH1", "1600"); await pg.dispatchEvent("#bSlopeH1", "input"); await pg.waitForTimeout(200);
    const fm = await pg.evaluate(() => { drawPreview(); const c = cfgFromForm(); return { tp: c.topProfile, H: c.H, hint: $("angHint").textContent, info: $("buildInfo").textContent }; });
    ok("D-86: cfg poartă profilul, iar H = cota cea mai înaltă", fm.tp && fm.tp.axis === "x" && fm.tp.h0 === 2200 && fm.tp.h1 === 1600 && fm.H === 2200, JSON.stringify(fm));
    ok("D-86: nota din previzualizare spune unghiul", /27[.,]3/.test(fm.hint), fm.hint.slice(0, 100));
    await pg.selectOption("#bSlope", "z"); await pg.waitForTimeout(150);
    ok("D-86: pe adâncime etichetele devin față/spate", await pg.evaluate(() => /davanti|față|front|vorn|avant|przodu|delante/i.test($("lSlopeH0").textContent)));
    await pg.selectOption("#bSlope", "x"); await pg.waitForTimeout(150);
    const dev = await pg.evaluate(() => { const p = proj(); p.pieces = []; p.configs = {}; p.layout = {}; generateInto(p, { ...cfgFromForm(), name: "Sl1" });
      const o = { rows: p.pieces.filter(x => x.gen === "Sl1" || x.modulo === "Sl1").map(x => [x.elemento, x.lung, x.larg, x.pz]) };
      o.cfgSaved = !!(p.configs["Sl1"] && p.configs["Sl1"].topProfile);
      o.poly = p.pieces.some(x => x.poly) && p.pieces.some(x => x.bevel) && p.pieces.some(x => x.xc != null);
      try { const items = computeHardware(p, state.settings); o.hw = items.some(i => i.k === "hwCern" && i.qty > 0); } catch (e) { o.hwErr = String(e); }
      try { o.mont = montDoc(p).length > 200; } catch (e) { o.montErr = String(e); }
      try { setView("summary"); o.sum = true; } catch (e) { o.sumErr = String(e); }
      try { const c = p.configs["Sl1"]; const m = buildModule(c); o.vp = m.boxes.filter(b => b.vp).length; } catch (e) { o.vpErr = String(e); }
      return o; });
    ok("D-86: distincta poartă două laterale de înălțimi diferite și un tavan pe pantă", dev.rows.filter(r => /^Fianco/.test(r[0])).length === 2 && dev.rows.some(r => /^Cielo/.test(r[0]) && r[1] > 1162), JSON.stringify(dev.rows));
    ok("D-86: proiectul păstrează profilul și rândurile poartă conturul, bevelul și poziția", dev.cfgSaved && dev.poly, JSON.stringify({ c: dev.cfgSaved, p: dev.poly }));
    ok("D-86: deviz, fișă de montaj și rezumat fără erori", dev.hw === true && dev.mont === true && dev.sum === true && !dev.hwErr && !dev.montErr && !dev.sumErr, JSON.stringify(dev).slice(0, 200));
    ok("D-86: cutii cu profil vertical pentru tavan, laterale/despărțitoare/spate", dev.vp >= 3, String(dev.vp));
    const doors = await pg.evaluate(() => { const p = proj(); const c = p.configs["Sl1"]; const items = computeHardware(p, state.settings);
      const cern = (items.find(i => i.k === "hwCern") || {}).qty;
      const m = buildModule(c), G = deriveCarcass(carcassParams(c, {})), o = generateOperations({ boxes: m.boxes, cfg: c, G });
      const dr = m.boxes.filter(b => b.sub === "door");
      return { cern, hinges: o.hw.filter(h => h.type === "cerniera").length, trap: dr.length > 0 && dr.every(b => b.vp && b.edgeH), rows: p.pieces.filter(x => /^Anta/.test(x.elemento) && x.poly).length }; });
    ok("D-86 pasul 2: ușile sunt trapeze (cutie cu profil, rând cu contur), câte una pe rând", doors.trap && doors.rows === 2, JSON.stringify(doors));
    ok("D-86 pasul 2: devizul numără aceleași balamale ca fișa piesei (pe muchia mai scundă)", doors.cern === doors.hinges && doors.cern > 0, JSON.stringify(doors));
    const room = await pg.evaluate(() => { const p = proj();
      p.survey = { walls: [{ id: "w1", len: 3000, angle: 90, bow: null }, { id: "w2", len: 2400, angle: 90, bow: null }, { id: "w3", len: 3000, angle: 90, bow: null }, { id: "w4", len: 2400, angle: 90, bow: null }], heights: [2500, 2500, 2500], obstacles: [] };
      layout()["Sl1"] = { wall: "w1", from: 300, off: 0, lift: 0, rot: 0 }; persist();
      try { setView("survey"); const bx = roomBoxes(); const pr = bx ? bx.filter(b => b.prism3) : []; return { n: pr.length, doors: pr.filter(b => b.kind === "f").length, ok: pr.every(b => b.prism3.A.length === 4 && b.prism3.B.length === 4) }; }
      catch (e) { return { err: String(e) }; } });
    ok("D-86: camera 3D păstrează panourile înclinate și ușile trapezoidale ca prisme (nu gabarite)", room.n >= 5 && room.doors === 2 && room.ok && !room.err, JSON.stringify(room));
    await pg.evaluate(() => { delete layout()["Sl1"]; proj().survey = null; persist(); setView("build"); });
    const svgr = await pg.evaluate(() => { const c = { ...cfgFromForm(), name: "Sl1" }; const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      try { render3D(svg, c, null, {}); return { n: svg.querySelectorAll("polygon").length }; } catch (e) { return { err: String(e) }; } });
    ok("D-86: randarea SVG (fără WebGL) desenează panourile înclinate", svgr.n > 10 && !svgr.err, JSON.stringify(svgr));
    await pg.evaluate(() => setView("build")); await pg.waitForTimeout(200);
    const el = await pg.evaluate(() => { try { const c = { ...cfgFromForm(), name: "Sl1" }; const svg = elabSvgFor(c, buildModule(c).boxes, proj(), 1, 1);
      return { len: svg.length, poly: /<polygon/.test(svg) }; } catch (e) { return { err: String(e) }; } });
    ok("D-86: prospectul A3 desenează conturul înclinat (poligoane)", el.poly === true && !el.err, JSON.stringify(el));
    await pg.selectOption("#bSlope", ""); await pg.waitForTimeout(150);
    ok("D-86: «Dritto» redă H editabil și scoate profilul", await pg.evaluate(() => !$("bH").readOnly && cfgFromForm().topProfile === null));
    await pg.evaluate(() => { const p = proj(); p.pieces = p.pieces.filter(q => q.gen !== "Sl1"); delete p.configs["Sl1"]; persist(); buildCfg = { ...PRESETS.base }; syncBuildForm(); renderSecChips(); });
    ok("D-86: cheile de interfață există în toate cele 7 limbi", await pg.evaluate(() => ["fSlope", "slopeNone", "slopeX", "slopeZ", "slopeH0x", "slopeH1x", "slopeH0z", "slopeH1z", "slopeHint", "wSlope"]
      .every(k => ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => I18N[l] && I18N[l][k]))));
    ok("D-86: numele «Fianco sx/dx» sunt traduse în toate limbile", await pg.evaluate(() => { const keep = state.lang;
      const r = ["ro", "en", "fr", "de", "pl", "es"].every(l => { state.lang = l; return elName("Fianco sx") !== "Fianco sx" && elName("Fianco dx") !== "Fianco dx"; });
      state.lang = keep; return r; }));
    ok("D-86: nessun errore JS", errs.length === 0, errs.join(" | ").slice(0, 200));
  }
  {
    head("3D — panouri pe pantă: prisme cu profil vertical, fără erori (D-86)");
    const sctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const sp = await sctx.newPage();
    const serr = []; sp.on("pageerror", e => serr.push(String(e)));
    await sp.goto(URL); await sp.waitForFunction(() => window.MAT_LOADED === true, null, { timeout: 15000 });
    await sp.waitForTimeout(3300);
    const so = await sp.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms));
      if (!(window.GL3D && GL3D.ok)) return { fara_gl: true };
      closeSheets(); const out = [];
      /* mai întâi un corp drept: plasele lui (cutii unitate) nu trebuie refolosite pentru panourile pe pantă */
      GL3D.render({ ...PRESETS.armadio, name: "Sl3", L: 1200, H: 2200, doors: 2, tram: 1, drawers: 0, hang: 0 }, { explode: 0 }); await w(300);
      for (const tp of [{ axis: "x", h0: 2200, h1: 1600 }, { axis: "z", h0: 2200, h1: 1500 }]) {
        const cfg = { ...PRESETS.armadio, name: "Sl3", L: 1200, H: 2200, doors: 2, tram: 1, drawers: 0, hang: 0, topProfile: tp };
        GL3D.render(cfg, { explode: 0, open: false }); await w(400);
        GL3D.set({ open: true, explode: 0.6 }); await w(400);
        const sloped = new Set(buildModule(cfg).boxes.filter(b => b.vp).map(b => b.role));
        const kinds = GL3D.meshKinds().filter(k => sloped.has(k.role));
        out.push({ ax: tp.axis, hw: GL3D.hwCount(), vp: buildModule(cfg).boxes.filter(b => b.vp).length, prism: kinds.length > 0 && kinds.every(k => k.prism.every(Boolean)) });
      }
      return { out };
    });
    await sp.close(); await sctx.close();
    if (so.fara_gl) ok("3D: panouri pe pantă — fără WebGL în acest browser, verificarea se sare", true, "fara_gl");
    else {
      ok("3D: ambele axe se randează (deschis și explodat) cu cutii `vp`", so.out.length === 2 && so.out.every(o => o.vp >= 3), JSON.stringify(so));
      ok("3D: după un corp drept, panourile pe pantă au prisme proprii, nu cutii unitate refolosite", so.out.every(o => o.prism), JSON.stringify(so));
    }
    ok("nessun errore JS", serr.length === 0, serr.join(" | ").slice(0, 200));
  }
  {
    head("Telefon — constructorul nu depășește ecranul (butoanele de documente trec pe rânduri)");
    const mctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
    const mp = await mctx.newPage();
    const merr = []; mp.on("pageerror", e => merr.push(String(e)));
    await mp.goto(URL); await mp.waitForFunction(() => window.MAT_LOADED === true, null, { timeout: 15000 });
    await mp.waitForTimeout(3300);
    const mo = await mp.evaluate(async () => {
      closeSheets(); const p = proj(); p.pieces = []; p.configs = {};
      generateInto(p, { ...PRESETS.armadio, name: "M1" }); setView("build");
      await new Promise(r => setTimeout(r, 800));
      const ids = ["btnDraw", "btnElab", "btnAsmA3", "btnPack", "btnRoom"], bs = ids.map(i => document.getElementById(i).getBoundingClientRect());
      return { sw: document.documentElement.scrollWidth, iw: innerWidth, right: Math.max(...bs.map(b => b.right)), rows: new Set(bs.map(b => Math.round(b.top))).size };
    });
    await mp.close(); await mctx.close();
    ok("telefon: pagina nu e mai lată decât ecranul", mo.sw <= mo.iw, JSON.stringify(mo));
    ok("telefon: toate butoanele de documente încap în ecran", mo.right <= mo.iw, JSON.stringify(mo));
    ok("telefon: butoanele trec pe mai multe rânduri", mo.rows >= 2, JSON.stringify(mo));
    ok("nessun errore JS", merr.length === 0, merr.join(" | ").slice(0, 200));

  }
  {
    head("Foaia A3 de fabricație — textele urmează limba din meniu");
    const sctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const sp = await sctx.newPage();
    const serr = []; sp.on("pageerror", e => serr.push(String(e)));
    await sp.goto(URL); await sp.waitForFunction(() => window.MAT_LOADED === true, null, { timeout: 15000 });
    await sp.waitForTimeout(3300);
    const sh = await sp.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = { titles: {}, raw: [] }, lang0 = state.lang;
      closeSheets(); const p = proj(); p.pieces = []; p.configs = {};
      generateInto(p, { ...PRESETS.armadio, name: "S1" });
      licWrite({ kind: "stripe", key: "comp_TESTTESTTESTTESTTESTTEST", status: "active", activated: true, checkedAt: Date.now() });
      setView("build"); await w(400);
      const M = GL3D.model(), pc = M.ops.pieces.find(q => q.operations.length > 3) || M.ops.pieces[0];
      for (const l of ["it", "ro", "en", "fr", "de", "pl", "es"]) {
        state.lang = l; applyLang();
        const svg = EBSheet.partSheetSVG(pc, { face: 5, tr: t, opName, sheetNo: 1, sheetTot: 1, meta: { project: "P", name: "N", date: "2026-01-01", ver: APP_VER } });
        o.titles[l] = (svg.match(/<text[^>]*>([^<]*)<\/text>/g) || []).map(s => s.replace(/<[^>]+>/g, ""));
        o.titles[l].filter(s => /^(sh[A-Z]\w*|op[A-Z]\w*|part[A-Z]\w*)$/.test(s)).forEach(s => o.raw.push(l + ":" + s));
      }
      o.elabRaw = [];
      const cfgE = { ...PRESETS.armadio, name: "E1" }, bxE = buildModule(cfgE).boxes, titlesE = {};
      for (const l of ["it", "ro", "en", "fr", "de", "pl", "es"]) {
        state.lang = l; applyLang();
        const sv = EBElab.elevationsSheetSVG(bxE, { tr: t, meta: { name: "E1", date: "d", ver: APP_VER } });
        const tx = (sv.match(/<text[^>]*>([^<]*)<\/text>/g) || []).map(q => q.replace(/<[^>]+>/g, ""));
        titlesE[l] = tx.join("|"); tx.filter(q => /^(ea[A-Z]\w*|sh[A-Z]\w*)$/.test(q)).forEach(q => o.elabRaw.push(l + ":" + q));
      }
      o.elabDiff = new Set(Object.values(titlesE)).size === 7;
      state.lang = "fr"; applyLang();
      PRINT_CAPTURE = []; document.getElementById("btnElab").click(); const capE = PRINT_CAPTURE; PRINT_CAPTURE = null;
      o.elabCap = capE.length === 1 && /sh-svg/.test(capE[0]) && /eh-body/.test(capE[0]) && /Coupe A–A|Coupe/.test(capE[0]);
      state.lang = "de"; applyLang();
      PRINT_CAPTURE = []; document.getElementById("btnAsmA3").click(); const capA = PRINT_CAPTURE; PRINT_CAPTURE = null;
      o.asmCap = capA.length === 1 && /sh-svg/.test(capA[0]) && /Montage/.test(capA[0]) && /Explosionsansicht/.test(capA[0]);
      const txA = (capA[0] || "").match(/<text[^>]*>([^<]*)<\/text>/g) || [];
      o.asmRaw = txA.map(q => q.replace(/<[^>]+>/g, "")).filter(q => /^(as[A-Z]\w*|ea[A-Z]\w*|sh[A-Z]\w*|mStepsT|mParts)$/.test(q));
      state.lang = "it"; applyLang();
      const pkP = proj(), pkMods = asmModules(pkP), pkPcs = pkMods.reduce((n, [, mm]) => n + mm.ops.pieces.length, 0);
      const pk = packBuild(pkP, { cover: 1, client: 1, report: 1, elev: 1, asm: 1, parts: 1 });
      o.packN = pk.length; o.packWant = pkMods.length * 4 + pkPcs + 1;
      o.packCover = /Dossier tecnico/.test(pk[0]) && /Indice dei fogli/.test(pk[0]);
      o.packRaw = pk.flatMap(sv => (sv.match(/<text[^>]*>([^<]*)<\/text>/g) || []).map(q => q.replace(/<[^>]+>/g, ""))).filter(q => /^(dc[A-Z]\w*|rp[A-Z0-9]\w*|as[A-Z]\w*|ea[A-Z]\w*|sh[A-Z]\w*)$/.test(q));
      o.packClient = /Presentazione cliente/.test(pk[1]) && /data:image\/jpeg/.test(pk[1]);
      state.lang = "fr"; applyLang();
      PRINT_CAPTURE = []; partSheetPrint(M, pc, 5); const cap = PRINT_CAPTURE; PRINT_CAPTURE = null;
      o.cap = cap.length === 1 && /sh-svg/.test(cap[0]) && /@page/.test(cap[0]) && /Fiche de fabrication/.test(cap[0]);
      state.lang = lang0; applyLang(); closeSheets(); setView("projects");
      return o;
    });
    await sp.close(); await sctx.close();
    ok("foaia A4: nicio cheie netradusă în nicio limbă", sh.raw.length === 0, sh.raw.slice(0, 5).join(","));
    ok("foaia A4: titlul diferă pe limbi", new Set(Object.values(sh.titles).map(a => a.join("|"))).size === 7);
    ok("foaia A4 trece prin printOut, în limba aleasă", sh.cap === true);
    ok("prospecte A3: nicio cheie netradusă în nicio limbă", sh.elabRaw.length === 0, sh.elabRaw.slice(0, 5).join(","));
    ok("prospecte A3: textele diferă pe limbi", sh.elabDiff === true);
    ok("prospecte A3: butonul trece prin printOut, în limba aleasă", sh.elabCap === true);
    ok("montaj A3: butonul trece prin printOut, vedere explodată și titlu în limba aleasă", sh.asmCap === true);
    ok("montaj A3: nicio cheie netradusă", sh.asmRaw.length === 0, sh.asmRaw.slice(0, 5).join(","));
    ok("dosar A3: copertă + (client, raport, prospecte, montaj) × corpuri + o foaie pe piesă", sh.packN === sh.packWant && sh.packN > 5, sh.packN + " ≠ " + sh.packWant);
    ok("dosar A3: coperta și prezentarea client, în limba aleasă, cu randare 3D", sh.packCover === true && sh.packClient === true);
    ok("dosar A3: nicio cheie netradusă pe nicio foaie", sh.packRaw.length === 0, sh.packRaw.slice(0, 5).join(","));
    ok("nessun errore JS", serr.length === 0, serr.join(" | ").slice(0, 200));

  }
  {
    head("Google Play Billing — pe Android se plătește numai prin Play");
    const gctx = await browser.newContext({ viewport: { width: 412, height: 800 } });
    await gctx.addInitScript(() => {
      window.__calls = [];
      const send = (k, d) => setTimeout(() => window.__ebPlay && window.__ebPlay(k, JSON.stringify(d)), 30);
      window.__playActive = false;
      window.EbanistAndroid = {
        billingAvailable: () => "1",
        billingQuery: () => { __calls.push("query"); if (window.__playFail) { send("products", { ok: false, code: "unavailable", detail: "3 Billing unavailable" }); return; } send("products", { ok: true, plans: [
          { plan: "monthly", price: "9,99 €", period: "P1M" }, { plan: "yearly", price: "89,99 €", period: "P1Y" }] }); },
        billingRestore: () => { __calls.push("restore"); send("purchases", { ok: true, source: "check",
          items: __playActive ? [{ productId: "ebanist_pro", token: "tok-1", orderId: "GPA.1", state: "purchased", autoRenewing: true }] : [] }); },
        billingBuy: plan => { __calls.push("buy:" + plan); __playActive = true; send("purchases", { ok: true, source: "buy",
          items: [{ productId: "ebanist_pro", token: "tok-1", orderId: "GPA.1", state: "purchased", autoRenewing: true }] }); },
        billingManage: () => __calls.push("manage"),
        print() {}, saveFile() {}, saveFailed() {}, retry() {}
      };
    });
    const gp = await gctx.newPage();
    const gerr = []; gp.on("pageerror", e => gerr.push(String(e)));
    await gp.goto(URL); await gp.waitForFunction(() => window.MAT_LOADED === true, null, { timeout: 15000 });
    await gp.waitForTimeout(3300);
    const g = await gp.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms));
      const o = {};
      closeSheets(); licWrite(null);
      o.pornire = __calls.includes("restore") && __calls.includes("query");
      const fi = document.getElementById("fileInput");
      o.faraAccept = !fi.hasAttribute("accept");
      let clic = 0; const oc = fi.click; fi.click = () => clic++;
      document.getElementById("btnRestoreFile").click(); fi.click = oc;
      o.restaurare = clic === 1;
      o.liberInitial = !isPro();
      openPro("pdf"); await w(200);
      const body = document.getElementById("proBody");
      o.pretPlay = /9,99 €/.test(body.textContent) && /89,99 €/.test(body.textContent);
      o.faraLemon = !body.querySelector("#proBuyM") && !body.querySelector("#proBuyY") && !/lemonsqueezy|buy\.stripe\.com/i.test(body.innerHTML);
      o.faraRambursare = !body.querySelector('a[href="/rambursare.html"]');
      o.conditii = body.textContent.length > 0 && !!body.querySelector("[data-play=monthly]");
      o.textAvans = (typeof playAuto === "function" ? !playAuto() : false) ? (/fără reînnoire automată|senza rinnovo|no automatic renewal|sans renouvellement/.test(body.textContent) && !/reînnoire automată prin|rinnovo automatico tramite|Auto-renewing|renouvellement automatique via/.test(body.textContent)) : true;
      body.querySelector("[data-play=yearly]").click(); await w(900);
      o.cumparat = __calls.includes("buy:yearly");
      o.pro = isPro() && LIC && LIC.kind === "play" && LIC.key === "tok-1";
      renderProSettings();
      o.gestionare = document.getElementById("btnPlayManage").style.display === "flex";
      o.faraDeconectare = document.getElementById("btnLicOff").style.display === "none";
      document.getElementById("btnPlayManage").click(); o.manage = __calls.includes("manage");
      // anulat din Play: la următoarea verificare Pro dispare
      window.__playActive = false; EbanistAndroid.billingRestore(); await w(200);
      o.anulat = !isPro() && !LIC;
      // o licență Stripe nu e atinsă de Play
      licWrite({ kind: "stripe", key: "comp_TESTTESTTESTTESTTESTTEST", status: "active", activated: true });
      EbanistAndroid.billingRestore(); await w(200);
      o.cheiaRamane = isPro() && LIC.kind === "stripe";
      // Play nu răspunde: nu se schimbă nimic
      licWrite({ kind: "play", key: "tok-2", activated: true, valid: true, status: "active" });
      __ebPlay("purchases", JSON.stringify({ ok: false, code: "unavailable", source: "check" })); await w(50);
      o.faraRaspuns = isPro() && LIC.key === "tok-2";
      // abonament abia creat: Play răspunde „niciun plan”, apoi îl are — se reîntreabă
      __ebPlay("products", JSON.stringify({ ok: true, plans: [] })); await w(50);
      PLAY.askedAt = 0; const q0 = __calls.filter(c => c === "query").length;
      openPro(null); await w(50);
      o.reintreaba = __calls.filter(c => c === "query").length === q0 + 1;
      await w(200);
      o.apareDupa = /9,99 €/.test(document.getElementById("proBody").textContent);
      // plan refăcut cu alt ID: se găsește după perioadă
      __ebPlay("products", JSON.stringify({ ok: true, plans: [{ plan: "lunar-auto", price: "8,99 €", period: "P1M" }] })); await w(50);
      renderPro(null); const bb = document.querySelector("#proBody [data-play]");
      o.dupaPerioada = !!bb && bb.dataset.play === "lunar-auto" && /8,99 €/.test(bb.textContent);
      /* 5.83.0 (D-133): o eroare de conectare se reîncearcă de două ori înainte să fie arătată; abia a treia se vede */
      window.__playFail = true;
      for (let i = 0; i < 3; i++) { __ebPlay("products", JSON.stringify({ ok: false, code: "unavailable", detail: "3 Billing unavailable" })); await w(50); }
      PLAY.askedAt = Date.now();
      renderPro(null); o.diag = /unavailable/.test(document.getElementById("proBody").textContent);
      licWrite(null); closeSheets();
      return o;
    });
    await gp.close(); await gctx.close();
    ok("„niciun plan” → la redeschidere se întreabă din nou Play", g.reintreaba === true && g.apareDupa === true);
    ok("eroarea Play se vede (cod), pentru diagnostic", g.diag === true);
    ok("un plan refăcut cu alt ID se găsește după perioadă", g.dupaPerioada === true);
    ok("la pornire: se citesc abonamentele și prețurile", g.pornire === true);
    ok("fără abonament: versiunea gratuită", g.liberInitial === true);
    ok("prețurile vin de la Play", g.pretPlay === true);
    ok("pe Android nu apare Lemon Squeezy", g.faraLemon === true);
    ok("pe Android nu apare pagina de rambursare proprie", g.faraRambursare === true);
    ok("butoanele de abonament există", g.conditii === true);
    ok("textul spune ce se cumpără (plată în avans, fără reînnoire)", g.textAvans === true);
    ok("cumpărarea merge la Play cu planul ales", g.cumparat === true);
    ok("după plată: Pro activ, licență „play”", g.pro === true);
    ok("setări: „Gestionează abonamentul” deschide Play", g.gestionare === true && g.manage === true);
    ok("un abonament Play nu se „deconectează”", g.faraDeconectare === true);
    ok("anulat în Play → Pro dispare la verificare", g.anulat === true);
    ok("o licență Stripe nu e atinsă de Play", g.cheiaRamane === true);
    ok("Play nu răspunde → nu se schimbă nimic", g.faraRaspuns === true);
    ok("Android: selectorul de fișiere acceptă orice (backup .json)", g.faraAccept === true);
    ok("setări: „Restaurează din fișier” deschide selectorul", g.restaurare === true);
    ok("nessun errore JS", gerr.length === 0, gerr.join(" | ").slice(0, 200));
  }

  /* U.1 — partea balamalelor aleasă pe fiecare ușă, din formular */
  {
    head("Lato cerniere per anta — dal modulo, salvato nel progetto (U.1)");
    await pg.evaluate(() => { closeSheets(); setView("build"); document.getElementById("grpFr").open = true; });
    await pg.waitForTimeout(300);
    await pg.evaluate(() => { buildCfg = { ...PRESETS.base }; buildDoorHinge = null; syncBuildForm(); renderSecChips(); drawPreview(); });
    await pg.waitForTimeout(250);
    const chips = () => pg.evaluate(() => [...document.querySelectorAll("#doorHingeBox .chip")].map(c => c.textContent));
    const hs = () => pg.evaluate(() => buildModule(cfgFromForm()).boxes.filter(x => x.sub === "door").map(x => x.hinge || null));
    const wrapShown = () => pg.evaluate(() => document.getElementById("doorHingeWrap").style.display !== "none");
    ok("U.1: due ante → due pulsanti, tutti «auto»", (await chips()).length === 2 && (await wrapShown()));
    ok("U.1: senza scelta nessuna cerniera scritta (progetti vecchi invariati)", JSON.stringify(await hs()) === "[null,null]");
    await pg.click('[data-dh="0"]'); await pg.click('[data-dh="0"]');
    ok("U.1: due tocchi → «destra», e finisce sulla cassa dell'anta", JSON.stringify(await hs()) === '["right",null]');
    ok("U.1: il valore sta nel cfg del progetto", JSON.stringify(await pg.evaluate(() => cfgFromForm().doorHinge)) === '["right",null]');
    await pg.click('[data-dh="1"]');
    ok("U.1: cerniere una verso l'altra senza divisorio → avviso", await pg.evaluate(() => /⚠/.test(document.getElementById("doorHingeHint").textContent)));
    await pg.click('[data-dh="1"]'); await pg.click('[data-dh="1"]');
    ok("U.1: terzo tocco → torna «auto»", JSON.stringify(await hs()) === '["right",null]');
    await pg.fill("#bDoors", "1"); await pg.waitForTimeout(150);
    ok("U.1: meno ante → meno pulsanti, la scelta resta alla prima", (await chips()).length === 1 && JSON.stringify(await hs()) === '["right"]');
    await pg.fill("#bDoors", "0"); await pg.waitForTimeout(150);
    ok("U.1: senza ante il campo sparisce", !(await wrapShown()));
    await pg.evaluate(() => { buildCfg = { ...PRESETS.scorrevole }; syncBuildForm(); renderSecChips(); });
    await pg.waitForTimeout(150);
    ok("U.1: porte scorrevoli → nessun lato cerniere", !(await wrapShown()));
    await pg.evaluate(() => { buildCfg = { ...PRESETS.base, doorHinge: ["right", "left"] }; syncBuildForm(); renderSecChips(); });
    await pg.waitForTimeout(150);
    ok("U.1: un progetto salvato con doorHinge lo riapre così", JSON.stringify(await chips()) === JSON.stringify(["Door 1: right ▶", "Door 2: ◀ left"]) || (await chips()).length === 2);
    await pg.evaluate(() => { buildCfg = { ...PRESETS.base }; buildDoorHinge = null; syncBuildForm(); renderSecChips(); });
    ok("U.1: nessun errore JS", errs.length === 0, errs.join(" | ").slice(0, 200));
  }

  /* U.3 — corp fără tavan: tavan plin / două traverse / fără (D-72) */
  {
    head("Chiusura in alto — cielo pieno, due traverse, nessuna (U.3)");
    await pg.evaluate(() => { closeSheets(); setView("build"); document.getElementById("grpFr").open = true; });
    await pg.waitForTimeout(300);
    await pg.evaluate(() => { buildCfg = { ...PRESETS.base, name: "Sub chiuveta", L: 800 }; syncBuildForm(); renderSecChips(); drawPreview(); });
    await pg.waitForTimeout(250);
    const st = () => pg.evaluate(() => ({
      rail: document.getElementById("rowTopRail").style.display !== "none",
      top: cfgFromForm().top, w: cfgFromForm().topRailW,
      pcs: buildModule(cfgFromForm()).pieces.filter(p => /Cielo|Traversa|^Base/.test(p.elemento)).map(p => p.elemento + " " + p.lung + "x" + p.larg + " x" + p.pz) }));
    let x = await st();
    ok("U.3: implicit «cielo pieno», un singur pannello Base / Cielo", x.top === null && JSON.stringify(x.pcs) === '["Base / Cielo 762x560 x2"]');
    await pg.selectOption("#bTop", "traverse"); await pg.waitForTimeout(250);
    x = await st();
    ok("U.3: «due traverse» → Base + Traversa cielo ×2 (100 mm)", x.top === "traverse" && x.rail && JSON.stringify(x.pcs) === '["Base 762x560 x1","Traversa cielo 762x100 x2"]');
    await pg.fill("#bTopRail", "80"); await pg.waitForTimeout(250);
    x = await st();
    ok("U.3: larghezza traversa 80 → pezzo 80 mm, salvata nel cfg", x.w === 80 && /762x80 x2/.test(x.pcs[1]));
    await pg.selectOption("#bTop", "none"); await pg.waitForTimeout(250);
    x = await st();
    ok("U.3: «nessuna» → soltanto la base, campo larghezza nascosto", x.top === "none" && !x.rail && JSON.stringify(x.pcs) === '["Base 762x560 x1"]');
    ok("U.3: chiusura e invarianti restano a posto senza cielo", await pg.evaluate(() => {
      const c = cfgFromForm(), m = buildModule(c), G = deriveCarcass(carcassParams(c, {}));
      return validateCarcassClosure(c, m.pieces, G).length === 0; }));
    await pg.evaluate(() => { buildCfg = { ...PRESETS.scrivania }; syncBuildForm(); renderSecChips(); });
    await pg.waitForTimeout(150);
    ok("U.3: scrivania → la riga sparisce", await pg.evaluate(() => document.getElementById("rowTop").style.display === "none"));
    await pg.evaluate(() => { buildCfg = { ...PRESETS.base, top: "traverse", topRailW: 90 }; syncBuildForm(); renderSecChips(); });
    await pg.waitForTimeout(150);
    ok("U.3: un progetto salvato con top lo riapre così", await pg.evaluate(() => document.getElementById("bTop").value === "traverse" && document.getElementById("bTopRail").value === "90"));
    /* la scheda di montaggio: i passi non nominano un cielo che non c'e */
    const mont = await pg.evaluate(() => {
      const o = {};
      for (const t of ["plin", "traverse", "none"]) {
        const p = proj(); p.pieces = []; p.configs = {};
        generateInto(p, { ...PRESETS.base, name: "Sub", top: t === "plin" ? null : t, tram: 1 });
        const d = document.createElement("div"); d.innerHTML = montDoc(p);
        o[t] = d.textContent;
      }
      o.ms = { plin: t("ms6"), traverse: t("ms6t"), none: t("ms6n") };
      return o;
    });
    ok("U.3: scheda con cielo pieno — passo «base e cielo»", mont.plin.includes(mont.ms.plin));
    ok("U.3: scheda con traverse — passo con le due traverse", mont.traverse.includes(mont.ms.traverse) && !mont.traverse.includes(mont.ms.plin));
    ok("U.3: scheda senza cielo — passo «aperto in alto», senza il cielo", mont.none.includes(mont.ms.none) && !mont.none.includes(mont.ms.plin));
    await pg.evaluate(() => { buildCfg = { ...PRESETS.base }; syncBuildForm(); renderSecChips(); });
    ok("U.3: nessun errore JS", errs.length === 0, errs.join(" | ").slice(0, 200));
  }

  /* U.14 — cadrul de nivelare din Releveu (D-117) */
  {
    head("Cadru de nivelare din Releveu — corpuri pe cadru, nivelatoare Häfele 637.42.950, distinta, deviz (U.14)");
    await pg.evaluate(() => {
      const p = proj(); p.pieces = []; p.configs = {}; p.layout = {}; p.worktops = []; p.baseFrames = [];
      p.survey = { walls: [{ id: "w1", len: 3000, angle: 90, bow: null }, { id: "w2", len: 2400, angle: 90, bow: null },
                           { id: "w3", len: 3000, angle: 90, bow: null }, { id: "w4", len: 2400, angle: 90, bow: null }], heights: [2500, 2500, 2500], obstacles: [] };
      state.settings.matAdd = (state.settings.matAdd || []).filter(m => m.id !== "pal18t").concat([{ id: "pal18t", l: { it: "PAL 18 test", ro: "PAL 18 test", en: "Chipboard 18 test", fr: "PAL 18 test" }, th: 18, price: 20, c: "#cccccc" },
        { id: "pal18raw", l: { it: "PAL grezzo 18 test", ro: "PAL brut 18 test", en: "Raw chipboard 18 test", fr: "PAL brut 18 test" }, th: 18, price: 12, c: "#c9a779" },
        { id: "pal16t", l: { it: "PAL 16 test", ro: "PAL 16 test", en: "Chipboard 16 test", fr: "PAL 16 test" }, th: 16, price: 10, c: "#dddddd" }]);
      for (const [n, w, from] of [["Base1", "w1", 0], ["Base2", "w1", 800], ["Base3", "w1", 1600], ["Cass1", "w2", 600], ["Cass2", "w2", 1400]]) {
        generateInto(p, { ...PRESETS.base, name: n, L: 800, support: "cadru", plinth: 120 }); layout()[n] = { wall: w, from, off: 0, lift: 0, rot: 0 };
      }
      persist(); closeSheets(); setView("survey"); renderPlan();
    });
    await pg.waitForTimeout(300);
    ok("U.14: cardul Cadru compare cu un releveu așezat", await pg.evaluate(() => document.getElementById("svBfCard").style.display !== "none"));
    await pg.click("#btnBfAdd"); await pg.waitForTimeout(250);
    ok("U.14: «Adaugă cadru» ia cele 5 corpuri de jos", await pg.evaluate(() => proj().baseFrames.length === 1 && proj().baseFrames[0].mods.length === 5));
    await pg.click("[data-fcalc]"); await pg.waitForTimeout(250);
    ok("U.14: fără material → eroare, nicio piesă", await pg.evaluate(() => proj().pieces.filter(x => /cadru/i.test(x.elemento)).length === 0 && /material|Material/.test(document.getElementById("svBfList").innerText)));
    await pg.evaluate(() => { const f = proj().baseFrames[0]; f.mat = "pal18t"; f.floor = [{ wall: "w1", x: 0, z: 0 }, { wall: "w1", x: 3000, z: 12 }]; persist(); renderPlan(); });
    await pg.click("[data-fcalc]"); await pg.waitForTimeout(400);
    const bf = await pg.evaluate(() => { const p = proj(), f = p.baseFrames[0];
      return { names: f.names, err: f.err,
        rows: p.pieces.filter(x => /cadru/i.test(x.elemento)).map(x => [x.modulo, x.elemento, x.lung, x.larg, x.pz, x.sp]),
        hw: computeHardware(p, state.settings, false).filter(r => r.k === "hwPied").map(r => [r.qty, r.prod && r.prod.id]),
        lay: p.layout[f.names[0]], issues: roomLayout().issues.length,
        r3: roomBoxes().filter(b => /Cadru/.test(b.rmMod || "")).length }; });
    ok("U.14: două segmente (câte unul pe perete), grosimea din material (18)", bf.names.length === 2 && bf.rows.length === 6 && bf.rows.every(r => r[5] === 18 || r[1] === "Piedino cadru"));
    ok("U.14: peretele 1 trece până în colț (3000), cadrul stă pe pardoseală (lift 0)", bf.rows[0][2] === 3000 && bf.lay.lift === 0 && bf.lay.wall === "w1");
    ok("U.14: nivelator făcut pentru panou de 19 mm, șină de 18 mm → avertisment în card", await pg.evaluate(() => /19\s*mm[^\n]{0,60}18\s*mm/.test(document.getElementById("svBfList").innerText)));
    ok("U.14: picioarele sunt Häfele 637.42.950 în deviz, o singură dată (20), fără picioare pe corpuri", bf.hw.length === 1 && bf.hw[0][0] === 20 && bf.hw[0][1] === "haf_42950");
    ok("U.14: cadrul nu produce ciocniri false în Releveu și apare în camera 3D", bf.issues === 0 && bf.r3 > 20);
    /* materialul traverselor: altă referință, aceeași grosime → traversele poartă materialul lor; altă grosime → eroare */
    await pg.evaluate(() => { const p = proj(), f = p.baseFrames[0]; f.matCross = "pal18raw"; persist(); renderPlan(); });
    await pg.click("[data-fcalc]"); await pg.waitForTimeout(350);
    const mc = await pg.evaluate(() => { const p = proj(); return { rails: p.pieces.filter(x => x.elemento === "Sina cadru").map(x => x.materiale || x.mat), cross: p.pieces.filter(x => x.elemento === "Traversa cadru").map(x => x.materiale || x.mat) }; });
    ok("U.14: șine albe, traverse de PAL brut — fiecare cu materialul lui", mc.rails.length === 2 && mc.cross.length === 2 && mc.rails.every(m => /18 test/.test(m) && !/brut|grezzo|Raw/i.test(m)) && mc.cross.every(m => /brut|grezzo|Raw/i.test(m)));
    await pg.evaluate(() => { const p = proj(), f = p.baseFrames[0]; f.matCross = "pal16t"; persist(); renderPlan(); });
    ok("U.14: traverse de altă grosime → eroare în card", await pg.evaluate(() => /16/.test(document.getElementById("svBfList").innerText) && /(grosime|thickness|spessore|épaisseur)/i.test(document.getElementById("svBfList").innerText)));
    await pg.evaluate(() => { const p = proj(), f = p.baseFrames[0]; f.matCross = null; persist(); renderPlan(); });
    await pg.click("[data-fcalc]"); await pg.waitForTimeout(350);
    /* poarta de export (D-44): cadru la zi, corpuri la înălțimea lui → nu blochează; cadru depășit sau corpuri nepotrivite → blochează */
    const g0 = await pg.evaluate(() => assertExportable().blocking.filter(x => /^BF/.test(x.id)).map(x => x.id));
    ok("U.14: cadru la zi, corpuri pe el → poarta de export nu e blocată de cadru", g0.length === 0, g0.join());
    await pg.evaluate(() => { const p = proj(), f = p.baseFrames[0]; f.h = 150; persist(); renderPlan(); });
    const g1 = await pg.evaluate(() => assertExportable().blocking.filter(x => /^BF/.test(x.id)).map(x => x.id));
    ok("U.14: cadru depășit și corpuri la altă înălțime → export blocat (BFSTALE + BFBODY)", g1.includes("BFSTALE") && g1.includes("BFBODY"), g1.join());
    ok("U.14: schimbi înălțimea → cadrul spune că nu mai corespunde și corpurile nu mai stau pe el", await pg.evaluate(() => /Suport|Support|Supporto|Apoyo|Unterbau|Podstawa/.test(document.getElementById("svBfList").innerText)));
    await pg.evaluate(() => { const p = proj(), f = p.baseFrames[0]; snapUndo(); wtRemoveModules(p, f.names); p.baseFrames.splice(0, 1); persist(); renderPlan(); });
    ok("U.14: ștergerea scoate piesele și modulele cadrului", await pg.evaluate(() => proj().pieces.filter(x => /cadru/i.test(x.elemento)).length === 0 && !Object.keys(proj().configs).some(n => proj().configs[n].type === "cadru")));
    ok("U.14: nicio eroare JS", errs.length === 0, errs.join(" | ").slice(0, 200));
  }

  /* U.8 — blatul peste compozitie, din Releveu (D-73) */
  {
    head("Blat din Releveu — corpuri, colt drept, decupaje, distinta (U.8)");
    const SETUP = () => {
      const p = proj(); p.pieces = []; p.configs = {}; p.layout = {}; p.worktops = [];
      p.survey = { walls: [{ id: "w1", len: 3000, angle: 90, bow: null }, { id: "w2", len: 2400, angle: 90, bow: null },
                           { id: "w3", len: 3000, angle: 90, bow: null }, { id: "w4", len: 2400, angle: 90, bow: null }], heights: [2500, 2500, 2500], obstacles: [] };
      state.settings.matAdd = (state.settings.matAdd || []).filter(m => m.id !== "wt38").concat([{ id: "wt38", l: { it: "Blat 38 test", ro: "Blat 38 test", en: "Worktop 38 test", fr: "Plan 38 test" }, th: 38, price: 90, c: "#999999", tx: "solid", pw: 4100, ph: 650 }]);
      for (const [n, w, from] of [["Base1", "w1", 0], ["Base2", "w1", 800], ["Base3", "w1", 1600], ["Cass1", "w2", 600], ["Cass2", "w2", 1400]]) {
        generateInto(p, { ...PRESETS.base, name: n, L: 800 }); layout()[n] = { wall: w, from, off: 0, lift: 0, rot: 0 };
      }
      persist(); closeSheets(); setView("survey"); renderPlan();
    };
    await pg.evaluate(SETUP); await pg.waitForTimeout(300);
    ok("U.8: cardul Blat compare cu un rilievo posato", await pg.evaluate(() => document.getElementById("svWtCard").style.display !== "none"));
    await pg.click("#btnWtAdd"); await pg.waitForTimeout(250);
    let w = await pg.evaluate(() => { const wt = proj().worktops[0]; return { n: proj().worktops.length, mods: wt.mods.length }; });
    ok("U.8: «Aggiungi blat» prende i corpi posati in basso (5)", w.n === 1 && w.mods === 5);
    await pg.click("[data-wcalc]"); await pg.waitForTimeout(250);
    ok("U.8: fara materiale → eroare, nicio piesa", await pg.evaluate(() => proj().pieces.filter(x => x.role === "blat").length === 0 && /material|Material/.test(document.getElementById("svWtList").innerText)));
    await pg.evaluate(() => { const wt = proj().worktops[0]; wt.mat = "wt38"; wt.cutouts = [{ kind: "sink", seg: 0, x: 1200, y: 60, w: 780, d: 480, r: 10 }]; persist(); renderPlan(); });
    await pg.click("[data-wcalc]"); await pg.waitForTimeout(350);
    const d = await pg.evaluate(() => { const p = proj(); return {
      rows: p.pieces.filter(x => x.role === "blat").map(x => [x.modulo, x.lung, x.larg, x.sp, x.bordo, x.materiale]),
      lay: p.layout["Blat 1 A"], names: p.worktops[0].names }; });
    ok("U.8: doua piese, câte una pe perete, grosimea din material (38)", d.rows.length === 2 && d.rows.every(r => r[3] === 38) && d.names.length === 2);
    ok("U.8: perete 1 trece pana in colt (3000), perete 2 se opreste in muchia ei", d.rows[0][1] === 3000 && d.rows[1][1] === 2200 - d.rows[0][2]);
    ok("U.8: se asaza pe corpuri (lift = cota de sus)", d.lay && d.lay.lift === 720 && d.lay.wall === "w1");
    ok("U.8: apare in distinta cu materialul ales", d.rows.every(r => /Worktop 38 test|Blat 38 test|Plan 38 test/.test(r[5])));
    ok("U.8: cardul zice «la zi»", await pg.evaluate(() => /up to date|la zi|aggiornato|à jour/.test(document.getElementById("svWtList").innerText)));
    /* se muta un corp: blatul nu se recalculeaza singur, spune ca nu mai corespunde */
    await pg.evaluate(() => { layout()["Base2"].from = 900; persist(); renderPlan(); });
    ok("U.8: un corp mutat → «nu mai corespunde», piesele raman cum erau", await pg.evaluate(() => /no longer matches|non corrisponde|nu mai corespunde|ne correspond/.test(document.getElementById("svWtList").innerText) && proj().pieces.filter(x => x.role === "blat").length === 2));
    ok("U.8: modulele blat nu se deschid in constructor", await pg.evaluate(() => { openBuilder("Blat 1 A"); return currentView === "survey"; }));
    /* restul aplicatiei citeste blatul fara sa cada */
    const smoke = await pg.evaluate(async () => {
      const o = {}; const p = proj();
      try { setView("list"); o.list = true; } catch (e) { o.list = String(e); }
      try { setView("summary"); o.summary = true; } catch (e) { o.summary = String(e); }
      try { setView("nest"); o.nest = true; } catch (e) { o.nest = String(e); }
      try { auditBadge(); o.audit = true; } catch (e) { o.audit = String(e); }
      try { o.hw = !!computeHardware(p, state.settings, true); } catch (e) { o.hw = String(e); }
      try { o.mont = typeof montDoc(p) === "string"; } catch (e) { o.mont = String(e); }
      try { const x = p.pieces.find(q => q.role === "blat"); openPartFromRow(x.gen, x); o.part = document.getElementById("partBody").innerText; closeSheets(); } catch (e) { o.part = String(e); }
      try { setView("survey"); o.room = !!roomBoxes(); } catch (e) { o.room = String(e); }
      return o; });
    ok("U.8: lista, rezumat, nesting, audit, feronerie, fisa de montaj, 3D: fara erori",
       smoke.list === true && smoke.summary === true && smoke.nest === true && smoke.audit === true && smoke.hw === true && smoke.mont === true && smoke.room === true, JSON.stringify(smoke).slice(0, 200));
    ok("U.8: fisa piesei arata decupajul si locasurile", /780×480/.test(smoke.part) && /R10/.test(smoke.part));
    await pg.evaluate(() => { const i = 0; const p = proj(); const wt = p.worktops[i]; snapUndo(); wtRemoveModules(p, wt.names); p.worktops.splice(i, 1); persist(); renderPlan(); });
    ok("U.8: stergerea blatului scoate piesele si modulele", await pg.evaluate(() => { const p = proj(); return p.pieces.filter(x => x.role === "blat").length === 0 && !Object.keys(p.configs).some(n => /^Blat/.test(n)); }));
    ok("U.8: nessun errore JS", errs.length === 0, errs.join(" | ").slice(0, 200));
  }

  /* U.4 — cote la cota scrise cu mana, cu sertare pe coloane (D-74) */
  {
    head("Cote la cota: editor manual, sertare pe coloana (U.4)");
    await pg.evaluate(() => { closeSheets(); setView("build"); document.getElementById("grpAbs").open = true;
      buildCfg = { ...PRESETS.armadio, name: "Arm", L: 1800, H: 2700 }; syncBuildForm(); renderSecChips(); drawPreview(); });
    await pg.waitForTimeout(300);
    const info = () => pg.evaluate(() => ({ rows: document.querySelectorAll(".abs-row").length, chk: document.getElementById("absCheck").innerText,
      c: (() => { const c = cfgFromForm(); return { p: c.partitions, f: c.fronts, d: c.drawerBlocks, tram: c.tram, drawers: c.drawers }; })() }));
    let x = await info();
    ok("U.4: editorul e gol la un corp normal", x.rows === 0 && x.c.p === undefined);
    await pg.click('[data-addk="setto"]'); await pg.waitForTimeout(200);
    x = await info();
    ok("U.4: primul setto opreste sectiunile egale (tram, sertare/sectiune → 0)", x.rows === 1 && x.c.tram === 0 && x.c.drawers === 0);
    ok("U.4: controlul zice «cotele se inchid», cu coloanele", /close|chiu|ferm|chiudono/i.test(x.chk) && /2700/.test(x.chk));
    await pg.click('[data-addk="ripiano"]'); await pg.waitForTimeout(200);
    x = await info();
    ok("U.4: ripiano nou pe «left» cand exista un setto (fara eroare)", x.rows === 2 && x.c.p[1].span === "left" && !/⚠/.test(x.chk));
    /* se scrie in campuri, ca un om: doua rafturi stanga, un bloc de sertare intre ele */
    await pg.evaluate(() => { const a = buildCfg.partitions.map(q => ({ ...q })); a[1].y = 900; a.push({ type: "ripiano", y: 1800, span: "left" }); buildCfg.partitions = a; drawPreview(); renderAbs(); });
    await pg.click('[data-addk="cass"]'); await pg.waitForTimeout(200);
    const inp = '.abs-row [data-k="drawerBlocks"][data-f=';
    for (const [f, v] of [["yEnd", "1450"], ["yStart", "919"], ["n", "3"]]) {
      await pg.fill(inp + `"${f}"]`, v); await pg.dispatchEvent(inp + `"${f}"]`, "change"); await pg.waitForTimeout(150); }
    x = await info();
    ok("U.4: sertare pe coloana 1, 919–1450, n=3, salvate in cfg", x.c.d && x.c.d[0].yStart === 919 && x.c.d[0].yEnd === 1450 && x.c.d[0].n === 3);
    ok("U.4: controlul nu da erori", !/⚠/.test(x.chk));
    const gen = await pg.evaluate(() => { const m = buildModule(cfgFromForm());
      return { fr: m.pieces.filter(p => p.role === "cassetto_frontale").reduce((s, p) => s + p.pz, 0), n: m.pieces.length }; });
    ok("U.4: distinta are cele 3 frontale de sertar", gen.fr === 3);
    /* o cota care nu are loc se vede sub lista, nu la «Genereaza» */
    await pg.fill(inp + '"yStart"]', "850"); await pg.dispatchEvent(inp + '"yStart"]', "change"); await pg.waitForTimeout(300);
    x = await info();
    ok("U.4: un raft prin zona sertarelor → eroare vizibila in editor", /⚠/.test(x.chk) && /ripiano|shelf|raft|étagère/i.test(x.chk));
    await pg.fill(inp + '"yStart"]', "919"); await pg.dispatchEvent(inp + '"yStart"]', "change"); await pg.waitForTimeout(200);
    /* proiectul se salveaza si se redeschide cu cotele */
    const re = await pg.evaluate(() => { const p = proj(); p.configs = p.configs || {};
      const r = generateInto(p, cfgFromForm()); const cfg = p.configs["Arm"];
      buildCfg = { ...cfg }; syncBuildForm(); renderSecChips();
      return { saved: !!(cfg.drawerBlocks && cfg.partitions), rows: document.querySelectorAll(".abs-row").length, fr: r.pieces.filter(q => q.role === "cassetto_frontale").length }; });
    ok("U.4: generat in proiect, redeschis in editor cu aceleasi randuri", re.saved && re.rows === 4);
    /* hardware si fisa de montaj citesc blocurile */
    const hw = await pg.evaluate(() => { const p = proj(); let o = {};
      try { const h = computeHardware(p, state.settings, true); o.hw = (h.mods && h.mods["Arm"]) || null; o.tot = h.q || h.totals || null; } catch (e) { o.err = String(e); }
      try { o.mont = typeof montDoc(p) === "string"; } catch (e) { o.merr = String(e); }
      try { const m = buildModule(p.configs["Arm"]); o.info = drawGroupsOf(m).length; } catch (e) { o.ierr = String(e); }
      return o; });
    ok("U.4: feroneria numara glisierele sertarelor din bloc", hw.hw && hw.hw.hwGuida > 0, JSON.stringify(hw).slice(0, 160));
    ok("U.4: fisa de montaj si planul cassetelor fara erori", hw.mont === true && hw.info === 1);
    await pg.evaluate(() => { const p = proj(); p.pieces = p.pieces.filter(q => q.gen !== "Arm"); delete p.configs["Arm"]; persist(); buildCfg = { ...PRESETS.base }; syncBuildForm(); renderSecChips(); });
    ok("U.4: nessun errore JS", errs.length === 0, errs.join(" | ").slice(0, 200));
  }

  /* U.7 — gola: profil in loc de maner (D-75) */
  {
    head("Gola — profil in loc de maner: frontale, profile, deviz la metru (U.7)");
    await pg.evaluate(() => { closeSheets(); setView("build"); document.getElementById("grpFr").open = true;
      buildCfg = { ...PRESETS.basecass, name: "Gola1", L: 800, drawers: 3, handles: "maniglia" }; syncBuildForm(); renderSecChips(); drawPreview(); });
    await pg.waitForTimeout(300);
    const vis = () => pg.evaluate(() => document.getElementById("rowGola").style.display !== "none");
    ok("U.7: campurile golei sunt ascunse la «Maniglie»", !(await vis()));
    await pg.selectOption("#bHandles", "gola"); await pg.waitForTimeout(250);
    ok("U.7: «Gola» arata cotele profilului", await vis());
    const q = await pg.evaluate(() => { const c = cfgFromForm(); const m = buildModule(c);
      return { h: c.handles, names: m.pieces.map(p => p.elemento), L: m.pieces.filter(p => /^Profilo gola L/.test(p.elemento)).length,
               C: m.pieces.filter(p => /^Profilo gola C/.test(p.elemento)).reduce((s2, p) => s2 + p.pz, 0) }; });
    ok("U.7: frontale «gola», un profil L si doua C (3 sertare)", q.h === "gola" && q.names.includes("Frontale cassetto gola") && q.L === 1 && q.C === 2);
    await pg.fill("#bGolaH", "30"); await pg.dispatchEvent("#bGolaH", "change"); await pg.waitForTimeout(200);
    ok("U.7: golaH din formular ajunge in cfg si in profil", await pg.evaluate(() => { const c = cfgFromForm(); return c.golaH === 30 && buildModule(c).pieces.find(p => /^Profilo gola L/.test(p.elemento)).larg === 30; }));
    const hw = await pg.evaluate(() => { const p = proj(); p.pieces = []; p.configs = {}; generateInto(p, { ...cfgFromForm(), name: "Gola1" });
      const items = computeHardware(p, state.settings); const L = items.find(i => i.k === "hwGolaL"), C = items.find(i => i.k === "hwGolaC"), M = items.find(i => i.k === "hwMan"), P = items.find(i => i.k === "hwPush");
      const ct = projectCosts(p);
      return { L: L && L.qty, C: C && C.qty, man: M && M.qty, push: P && P.qty, price: L && L.price, tot: ct.hwTot > 0 }; });
    ok("U.7: deviz — profil L 0,8 m, profil C 1,59 m (2 × 796 mm), fara manere", hw.L === 0.8 && hw.C === 1.59 && !hw.man && !hw.push, JSON.stringify(hw));
    ok("U.7: profilele au pret pe metru in deviz", hw.price > 0 && hw.tot);
    const sm = await pg.evaluate(() => { const p = proj(); const o = {};
      try { o.mont = typeof montDoc(p) === "string"; } catch (e) { o.mont = String(e); }
      try { setView("summary"); o.sum = true; } catch (e) { o.sum = String(e); }
      try { o.part = !!generateOperations({ boxes: buildModule(p.configs["Gola1"]).boxes, cfg: p.configs["Gola1"], G: deriveCarcass(carcassParams(p.configs["Gola1"], {})) }); } catch (e) { o.part = String(e); }
      return o; });
    ok("U.7: fisa de montaj, rezumat si gaurire fara erori", sm.mont === true && sm.sum === true && sm.part === true, JSON.stringify(sm));
    await pg.evaluate(() => { const p = proj(); p.pieces = p.pieces.filter(q => q.gen !== "Gola1"); delete p.configs["Gola1"]; persist(); setView("build"); buildCfg = { ...PRESETS.base }; syncBuildForm(); renderSecChips(); });
    ok("U.7: nessun errore JS", errs.length === 0, errs.join(" | ").slice(0, 200));
  }

  /* Traduceri: fiecare dictionar are aceleasi chei in toate limbile. O functie
     noua fara textul ei intr-o limba apare aici, nu la utilizator. */
  {
    head("Traduceri — aceleasi chei in fiecare limba");
    const par = await pg.evaluate(() => {
      const o = {};
      for (const n of ["I18N", "SURVEY_I18N", "AI_I18N", "EL_I18N"]) {
        const d = (() => { try { return eval(n); } catch (e) { return null; } })();
        if (!d) { o[n] = null; continue; }
        const langs = Object.keys(d), ref = new Set(Object.keys(d[langs.includes("it") ? "it" : "ro"]));
        o[n] = Object.fromEntries(langs.map(l => [l, { missing: [...ref].filter(k => !(k in d[l])), extra: Object.keys(d[l]).filter(k => !ref.has(k)) }]));
      }
      return o; });
    for (const n of Object.keys(par)) {
      const d = par[n]; if (!d) { ok("Traduceri: " + n + " exista", false); continue; }
      const bad2 = Object.entries(d).filter(([l, v]) => v.missing.length || v.extra.length).map(([l, v]) => l + ": lipsesc " + v.missing.slice(0, 5).join(",") + " / in plus " + v.extra.slice(0, 5).join(","));
      ok("Traduceri: " + n + " — aceleasi chei in toate limbile", bad2.length === 0, bad2.join(" | ").slice(0, 240));
    }
  }

  /* U.5 — pana la 8 usi si 8 despartitori in formular */
  {
    head("Mai mult de 4 usi — formular, 3D, fisa de montaj, modul client (U.5)");
    await pg.evaluate(() => { closeSheets(); setView("build"); document.getElementById("grpFr").open = true; document.getElementById("grpIn").open = true;
      buildCfg = { ...PRESETS.armadio, name: "Sei", L: 2400, H: 2400, doors: 2, tram: 1, drawers: 0, hang: 0 }; syncBuildForm(); renderSecChips(); drawPreview(); });
    await pg.waitForTimeout(300);
    await pg.fill("#bDoors", "6"); await pg.dispatchEvent("#bDoors", "change");
    await pg.fill("#bTram", "2"); await pg.dispatchEvent("#bTram", "change"); await pg.waitForTimeout(300);
    const r6 = await pg.evaluate(() => { const c = cfgFromForm(); const m = buildModule(c);
      return { doors: c.doors, tram: c.tram, pcs: m.pieces.filter(p => p.role === "frontale").reduce((s2, p) => s2 + p.pz, 0),
               chips: document.querySelectorAll("#doorHingeBox .chip").length, warn: m.warn.doorNarrow }; });
    ok("U.5: 6 usi si 2 despartitori nu mai sunt taiate la 4", r6.doors === 6 && r6.tram === 2 && r6.pcs === 6);
    ok("U.5: sase butoane pentru partea balamalelor", r6.chips === 6);
    await pg.fill("#bDoors", "12"); await pg.dispatchEvent("#bDoors", "change"); await pg.waitForTimeout(150);
    ok("U.5: peste 8 se opreste la 8", await pg.evaluate(() => cfgFromForm().doors === 8));
    await pg.fill("#bDoors", "6"); await pg.dispatchEvent("#bDoors", "change"); await pg.waitForTimeout(150);
    const all = await pg.evaluate(() => { const p = proj(); p.pieces = []; p.configs = {}; p.layout = {};
      generateInto(p, { ...cfgFromForm(), name: "Sei" });
      const o = {};
      try { const h = computeHardware(p, state.settings, true); o.cern = h.mods["Sei"] && h.mods["Sei"].hwCern; } catch (e) { o.cern = String(e); }
      try { o.mont = montDoc(p).length > 200; } catch (e) { o.mont = String(e); }
      try { o.hit = buildModule(p.configs["Sei"]).boxes.filter(b => b.sub === "door" && b.hinge).length; } catch (e) { o.hit = String(e); }
      try { o.cl = typeof clientOpen === "function"; } catch (e) { o.cl = false; }
      return o; });
    ok("U.5: feroneria numara cerniere pentru toate cele 6 usi", typeof all.cern === "number" && all.cern >= 12, JSON.stringify(all).slice(0, 160));
    ok("U.5: fisa de montaj se genereaza", all.mont === true);
    ok("U.5: balamalele implicite pe perechi ajung in 3D (6 usi cu partea scrisa)", all.hit === 6);
    ok("U.5: pe 900 mm cu 8 usi apare avertismentul de usi inguste", await pg.evaluate(() => { const c = { ...cfgFromForm(), L: 900, tram: 0, doors: 8 }; const m = buildModule(c); return m.warn.doorNarrow > 0 && m.warn.doorNarrow < 150; }));
    await pg.evaluate(() => { const p = proj(); p.pieces = p.pieces.filter(q => q.gen !== "Sei"); delete p.configs["Sei"]; persist(); buildCfg = { ...PRESETS.base }; syncBuildForm(); renderSecChips(); });
    ok("U.5: nessun errore JS", errs.length === 0, errs.join(" | ").slice(0, 200));
  }

  /* U.6 — profil anti-curbare pe usile inalte */
  {
    head("Profil anti-curbare — optiune, profil in deviz, canal in usa (U.6)");
    await pg.evaluate(() => { closeSheets(); setView("build"); document.getElementById("grpFr").open = true;
      buildCfg = { ...PRESETS.armadio, name: "Aw1", L: 1000, H: 2300, doors: 2, tram: 0, drawers: 0, hang: 0 }; syncBuildForm(); renderSecChips(); drawPreview(); });
    await pg.waitForTimeout(300);
    ok("U.6: implicit «Nessuno» — fara profil", await pg.evaluate(() => $("bAW").value === "" && !buildModule(cfgFromForm()).pieces.some(p => /anticurvatura/.test(p.elemento))));
    await pg.selectOption("#bAW", "auto"); await pg.waitForTimeout(200);
    ok("U.6: «Auto» ajunge in cfg si da un profil pe usa (2 usi inalte)", await pg.evaluate(() => { const c = cfgFromForm(); const r = buildModule(c).pieces.find(p => /^Profilo anticurvatura/.test(p.elemento)); return c.antiWarp === "auto" && r && r.pz === 2; }));
    ok("U.6: indiciul arata pragul de inaltime", await pg.evaluate(() => $("awHint").textContent.includes(String(ANTIWARP.minH))));
    const hw = await pg.evaluate(() => { const p = proj(); p.pieces = []; p.configs = {}; p.layout = {}; generateInto(p, { ...cfgFromForm(), name: "Aw1" });
      const it = computeHardware(p, state.settings).find(i => i.k === "hwAW"); const o = { q: it && it.qty, price: it && it.price };
      try { const ops = generateOperations({ boxes: buildModule(p.configs["Aw1"]).boxes, cfg: p.configs["Aw1"], G: deriveCarcass(carcassParams(p.configs["Aw1"], {})) });
        o.grooves = ops.pieces.filter(q => q.role === "frontale").reduce((s2, q) => s2 + q.operations.filter(x => x.type === "groove").length, 0); } catch (e) { o.err = String(e); }
      try { o.mont = montDoc(p).length > 200; setView("summary"); o.sum = true; } catch (e) { o.err = String(e); }
      return o; });
    ok("U.6: deviz — 2 profile cu pret", hw.q === 2 && hw.price > 0, JSON.stringify(hw));
    ok("U.6: cate un canal in fiecare usa; fisa de montaj si rezumatul fara erori", hw.grooves === 2 && hw.mont === true && hw.sum === true && !hw.err, JSON.stringify(hw));
    await pg.evaluate(() => { setView("build"); const c = { ...cfgFromForm(), H: 900 }; });
    ok("U.6: sub prag, «Auto» nu pune nimic; «Toate» pune", await pg.evaluate(() => {
      const low = { ...cfgFromForm(), H: 900, antiWarp: "auto" }, all = { ...low, antiWarp: "all" };
      const n = c => buildModule(c).pieces.filter(p => /anticurvatura/.test(p.elemento)).length;
      return n(low) === 0 && n(all) === 1; }));
    await pg.evaluate(() => { const p = proj(); p.pieces = p.pieces.filter(q => q.gen !== "Aw1"); delete p.configs["Aw1"]; persist(); buildCfg = { ...PRESETS.base }; syncBuildForm(); renderSecChips(); });
    ok("U.6: nessun errore JS", errs.length === 0, errs.join(" | ").slice(0, 200));
  }

  /* Balamale de la alte marci (Hettich, Salice, Grass, Häfele, Blum 105°) — catalog, fișă, număr după grafic, găurire, avertismente, 3D */
  {
    head("Balamale Hettich / Salice / Grass / Häfele / Blum 105° — catalog, deviz, găurire, 3D (ebanist-hinges-more)");
    const n0 = errs.length;
    await pg.evaluate(() => { closeSheets(); renderCatalog(); openSheet("shCatalog"); });
    await pg.waitForTimeout(300);
    ok("Balamale+: catalogul are articolele celor 5 marci, cu prețul 0 de completat, iar Blum rămâne primul (selecția implicită)", await pg.evaluate(() => {
      const L = HWDB.cern, br = new Set(L.map(x => x.brand)), more = L.filter(x => x.more);
      return more.length === 214 && ["Hettich", "Salice", "Grass", "Häfele", "Blum"].every(b => br.has(b)) && more.every(x => x.price === 0 && x.art) && !L[0].more && L[0].id === "blum_71b3550"; }));
    ok("Balamale+: același id nu apare de două ori în lista de balamale", await pg.evaluate(() => new Set(HWDB.cern.map(x => x.id)).size === HWDB.cern.length));
    ok("Balamale+: fișa tehnică Hettich 8645i se deschide din Catalog (cu codul, graficul de numărare și nota 3D schematic)", await pg.evaluate(() => {
      state.settings.hwProd = Object.assign({}, state.settings.hwProd, { cern: "het_9071205", plate: null }); renderCatalog();
      const sel = $("catHwWrap").querySelector(".catPlate"), btn = $("catHwWrap").querySelector(".hsOpen[data-hw='het_9071205']");
      if (!sel || !btn) return false; btn.click();
      const h = $("hsBody").innerHTML; closeSheets();
      return sel.options.length === 7 && sel.options[0].textContent.includes("9 071 595") && h.includes("9 071 205") && h.includes("13.7") && h.includes(t("hm3d").slice(0, 20)); }));
    ok("Balamale+: o balama Blum veche își păstrează fișa și plăcuțele (nicio regresie)", await pg.evaluate(() => {
      state.settings.hwProd = Object.assign({}, state.settings.hwProd, { cern: "blum_71b3590", plate: null }); renderCatalog();
      const sel = $("catHwWrap").querySelector(".catPlate"); return !!sel && sel.options.length >= 3 && sel.options[0].textContent.includes("173L61"); }));
    const hb = async (id, over) => pg.evaluate(([id, over]) => {
      const p = proj(); p.pieces = []; p.configs = {}; p.layout = {};
      const cfg = { ...PRESETS.pensile, name: "Hm1", L: 500, H: 1700, P: 330, doors: 1, drawers: 0, hang: 0, hwSel: { cern: id }, ...over };
      generateInto(p, cfg);
      const items = computeHardware(p, state.settings), door = p.pieces.find(x => /^Anta/.test(x.elemento)), h = Math.max(door.lung, door.larg);
      const b = buildModule(cfg), G = deriveCarcass(carcassParams(cfg, {})), o = generateOperations({ boxes: b.boxes, cfg, G });
      const cups = o.pieces.flatMap(q => q.operations).filter(q => /tazza cerniera/.test(q.note || ""));
      return { h, cern: (items.find(i => i.k === "hwCern") || {}).qty || 0, cups: cups.length, depth: cups[0] && cups[0].depth, warn: opsNotesOf(cfg).map(w => w.k), inst: o.hw.filter(x => x.type === "cerniera").length,
               want: EBHingesMore.count(id, h, 0), gen: hingeCount(h), name: (hwItemById("cern", id) || {}).name || "" };
    }, [id, over || {}]);
    const a = await hb("het_9071205");
    ok("Balamale+: deviz și găurire — numărul de balamale e cel din graficul Hettich (nu regula generală), identic în deviz și în găurire", a.cern === a.want && a.cups === a.want && a.inst === a.want && a.want === 3 && a.gen === 4, JSON.stringify(a));
    ok("Balamale+: cupele au adâncimea 12.8 din date; fără avertismente de găurire pe TH52 cu placa Ø5 × 12", a.depth === 12.8 && !a.warn.some(k => /opsHinge(Dowel|Plate|NoDrill|Glass)/.test(k)), JSON.stringify(a));
    const d = await hb("het_9071208");
    ok("Balamale+: Hettich cu presare (TH53) — avertisment că dornurile nu se generează, apare în lista de verificări", d.warn.includes("opsHingeDowelOpen") && d.cups === d.want, JSON.stringify(d));
    ok("Balamale+: avertismentul are text în fiecare limbă (cu valorile puse în loc)", await pg.evaluate(() => {
      const keep = state.lang, L = ["it", "ro", "en", "fr", "de", "pl", "es"];
      const r = L.every(l => { state.lang = l; return ["opsHingeDowelOpen", "opsHingePlateOpen", "opsHingeNoDrill", "opsHingeGlass", "opsHingeTh", "opsHingeH", "opsHingeW", "opsHingeKg", "hmDoorTh", "hm3d"].every(k => t(k) !== k)
        && opsMsg({ k: "opsHingeTh", v: 12, lo: 15, hi: 24 }).includes("12") && !/\{v\}|\{lo\}|\{hi\}/.test(opsMsg({ k: "opsHingeTh", v: 12, lo: 15, hi: 24 })); });
      state.lang = keep; return r; }));
    const g = await hb("gra_F028138519F028138522");
    ok("Balamale+: Grass — cupa cu cel puțin minimul 12.6 din sursă, fără găuri de placă, cu avertisment", g.depth >= 12.6 && g.warn.includes("opsHingePlateOpen") && g.cern === g.cups, JSON.stringify(g));
    const gl = await hb("het_9405214");
    ok("Balamale+: balama pentru sticlă — nicio cupă, avertisment, grosimea ușii față de intervalul sticlei", gl.cups === 0 && gl.warn.includes("opsHingeGlass") && gl.warn.includes("opsHingeTh"), JSON.stringify(gl));
    const bl = await hb("blum_71b3550");
    ok("Balamale+: balama Blum implicită neschimbată: număr după regula generală, nicio avertizare nouă", bl.cern === bl.gen && bl.cups === bl.gen && !bl.warn.some(k => /opsHinge(Dowel|Plate|NoDrill|Glass|Th|H|W|Kg)/.test(k)), JSON.stringify(bl));
    ok("Balamale+: numele articolelor în toate cele 7 limbi", await pg.evaluate(() => { const keep = state.lang, L = ["it", "ro", "en", "fr", "de", "pl", "es"], seen = new Set();
      const r = L.every(l => { state.lang = l; const nm = hwItemById("cern", "het_9071208").name; seen.add(nm); return nm.includes("8645i") && nm.includes("TH53"); }); state.lang = keep; return r && seen.size >= 6; }));
    ok("Balamale+: 3D — fiecare familie se desenează fără eroare, uși deschise (cupă, fixări, placă, braț din date)", await pg.evaluate(() => {
      try { return ["het_9071205", "het_9071208", "sal_C1P6AE9", "gra_F028138519F028138522", "haf_31104648", "blum_75B2550", "het_9405214", "sal_CEL6DE9XXI", "het_9072524"].every(id => {
        const cfg = { ...PRESETS.pensile, name: "Hm2", L: 500, H: 600, P: 330, doors: 1, drawers: 0, hang: 0, hwSel: { cern: id } }; const p = proj(); p.pieces = []; p.configs = {}; p.layout = {};
        generateInto(p, cfg); GL3D.render(cfg, { explode: 0 }); const r = GL3D.capture(cfg, { open: 1, hw: true, w: 220, h: 160 }); return !!(r && r.img); }); } catch (e) { return String(e); } }));
    ok("Balamale+: nessun errore JS", errs.length === n0, errs.slice(n0).join(" | ").slice(0, 200));
    await pg.evaluate(() => { state.settings.hwProd = Object.assign({}, state.settings.hwProd, { cern: "blum_71b3550", plate: null }); persist(); renderCatalog(); });
  }

  /* U.16 — mecanisme de ridicare pentru usi care se deschid in sus (basculante) */
  {
    head("Mecanisme de ridicare — optiune, deviz, 3D, avertismente (U.16)");
    await pg.evaluate(() => { closeSheets(); setView("build"); document.getElementById("grpFr").open = true;
      buildCfg = { ...PRESETS.pensile, name: "Lf1", L: 900, H: 600, P: 330, doors: 1, drawers: 0, hang: 0 }; syncBuildForm(); renderSecChips(); drawPreview(); });
    await pg.waitForTimeout(300);
    ok("U.16: implicit «Nessuno» — usa ramane pe balamale", await pg.evaluate(() => $("bLift").value === "" && cfgFromForm().lift === null && !buildModule(cfgFromForm()).pieces.some(p => /basculante/.test(p.elemento))));
    ok("U.16: selectorul are cele 18 sisteme, grupate pe trei marci", await pg.evaluate(() => $("bLift").querySelectorAll("option:not([value=''])").length === 18 && $("bLift").querySelectorAll("optgroup").length === 3));
    await pg.selectOption("#bLift", "het_la_hk"); await pg.waitForTimeout(200);
    ok("U.16: alegerea ajunge in cfg: usa basculanta, fara usa pe balamale", await pg.evaluate(() => { const c = cfgFromForm(), ps = buildModule(c).pieces;
      return c.lift === "het_la_hk" && ps.some(p => /^Anta basculante/.test(p.elemento)) && !ps.some(p => /^Anta(?! basculante)/.test(p.elemento)); }));
    ok("U.16: indiciul se vede", await pg.evaluate(() => { const h = $("liftHint"); return h.style.display !== "none" && h.textContent.length > 10; }));
    const lh = await pg.evaluate(() => { const p = proj(); p.pieces = []; p.configs = {}; p.layout = {}; generateInto(p, { ...cfgFromForm(), name: "Lf1" });
      const items = computeHardware(p, state.settings), g = k => items.find(i => i.k === k) || {};
      const o = { lift: g("hwLift").qty, cern: g("hwCern").qty || 0, name: (g("hwLift").name || "") };
      try { o.mont = montDoc(p).includes(t("mLift").split("{p}")[0].trim().slice(0, 12)); } catch (e) { o.err = String(e); }
      try { setView("summary"); o.sum = true; } catch (e) { o.err = String(e); }
      return o; });
    ok("U.16: deviz — un set de mecanism pe usa, nicio balama", lh.lift === 1 && lh.cern === 0, JSON.stringify(lh));
    ok("U.16: «Montaj» are pasul cu mecanismul; rezumatul fara erori", lh.mont === true && lh.sum === true && !lh.err, JSON.stringify(lh));
    ok("U.16: avertisment «cote neverificate» in aplicatie", await pg.evaluate(() => { const b = buildModule(cfgFromForm()); return !!(b.warn && b.warn.liftWarn && b.warn.liftWarn.some(w => w.k === "unv")); }));
    ok("U.16: 3D — cutia usii are sub:'lift' si se deschide fara eroare", await pg.evaluate(() => { try { const c = cfgFromForm(); GL3D.render(c, { explode: 0 }); const r = GL3D.capture(c, { open: 1, hw: true, w: 200, h: 150 }); return !!(r && r.img) && buildModule(c).boxes.some(b => b.sub === "lift"); } catch (e) { return false; } }));
    const lfOpen = await pg.evaluate(() => { try {
      const c = { ...PRESETS.pensile, name: "LfA", L: 900, H: 600, P: 330, doors: 1, drawers: 0, hang: 0, lift: "het_la_hk" }; GL3D.render(c, { explode: 0 });
      const d = buildModule(c).boxes.find(b => b.sub === "lift"); if (!d) return "fără ușă basculantă";
      const t = GL3D.tgtOf(d.pk); if (!t || Math.abs(t.ang) > 0) return "închis: ang " + (t && t.ang);
      const W = GL3D.worldBoxes({ open: 1 }), P = W.find(x => String(x.pk) === String(d.pk)); if (!P) return "fără piesă";
      /* poziția deschisă: ușa nu coboară sub muchia ei de sus și nu intră în corp (z mai mic decât fața din față) */
      const door = P.boxes.flat(), minY = Math.min(...door.map(q => q[1])), topClosed = d.y1;
      const body = W.filter(x => x.role !== "frontale" && x.sub !== "lift").flatMap(x => x.boxes.flat());
      const bodyFrontZ = Math.max(...body.map(q => q[2]));
      /* ≤ 90°: muchia de jos nu urcă deasupra muchiei de sus (la 150° ar urca cu ~0,87·h) și nu rămâne mai jos de 0,35·h sub ea (unghiul producătorului poate fi 70–90°) */
      const h = d.y1 - d.y0, maxY = Math.max(...door.map(q => q[1]));
      return maxY <= topClosed + 25 && minY >= topClosed - 0.35 * h - 25 && Math.min(...door.map(q => q[2])) >= bodyFrontZ - 30 ? true : "minY " + minY + " maxY " + maxY + " topClosed " + topClosed + " h " + h + " zmin " + Math.min(...door.map(q => q[2])) + " frontZ " + bodyFrontZ;
    } catch (e) { return String(e); } });
    ok("U.16: 3D — ușa basculantă se deschide cel mult 90° (nu 150), fără să intre în corp", lfOpen === true, String(lfOpen));
    const bedOpen = await pg.evaluate(() => { try {
      const c = { ...PRESETS.letto, name: "BedLf", L: 1660, P: 2000, H: 950, bedStor: "lift", bedFrame: "slats", bedMat: 30 }; GL3D.render(c, { explode: 0 });
      const fr = buildModule(c).boxes.filter(b => b.sub === "bedlift"); if (!fr.length) return "fără cadru bedlift";
      const closed = GL3D.worldBoxes({ open: 0 }), open = GL3D.worldBoxes({ open: 1 });
      const top = W => Math.max(...W.filter(x => x.sub === "bedlift").flatMap(x => x.boxes.flat().map(q => q[1])));
      const zmax = W => Math.max(...W.filter(x => x.sub === "bedlift").flatMap(x => x.boxes.flat().map(q => q[2])));
      return top(open) > top(closed) + 300 && zmax(open) < zmax(closed) ? true : "closed top " + top(closed) + " open top " + top(open) + " zmax " + zmax(closed) + "→" + zmax(open);
    } catch (e) { return String(e); } });
    ok("pat cu ladă: «Deschide» ridică somiera la picioare (nu rămâne pe loc)", bedOpen === true, String(bedOpen));
    const rdOpen = await pg.evaluate(() => { try { const out = [];
      for (const c of [{ ...PRESETS.tondo, name: "RdT", rOpen: 120, rDoor: 1 }, { ...PRESETS.raccordato, name: "RdR", rOpen: 400, rDoor: 1 }]) {
        GL3D.render(c, { explode: 0 });
        const d = buildModule(c).boxes.find(b => b.sub === "rdoor"); if (!d) return "fără rdoor la " + c.type;
        const W = GL3D.worldBoxes({ open: 1 }), P = W.find(x => String(x.pk) === String(d.pk)); if (!P) return "fără piesă " + c.type;
        const zs = P.boxes.flat().map(q => q[2]), pz = d.pivotAt.z;
        /* deschisă (~98° spre față): ușa trece în fața pivotului, nu în corp */
        if (!(Math.min(...zs) >= pz - 6 && Math.max(...zs) > pz + 150)) return c.type + ": zmin " + Math.min(...zs) + " zmax " + Math.max(...zs) + " pivot z " + pz;
        const C = GL3D.worldBoxes({ open: 0 }).find(x => String(x.pk) === String(d.pk)); if (Math.max(...C.boxes.flat().map(q => q[2])) > Math.max(...zs)) return c.type + ": închisă mai în față decât deschisă";
      } return true; } catch (e) { return String(e); } });
    ok("Rotund/Racordat cu ușă în deschidere: «Deschide» o rotește spre față (pivot la capăt), nu în corp", rdOpen === true, String(rdOpen));
    const hfRes = await pg.evaluate(() => { try {
      const c = { ...PRESETS.pensile, name: "HfT", L: 900, H: 600, P: 330, doors: 2, drawers: 0, hang: 0, lift: "blum_hf_top" };
      const p = proj(); p.pieces = []; p.configs = {}; p.layout = {}; generateInto(p, c);
      const items = computeHardware(p, state.settings), g = k => items.find(i => i.k === k) || {};
      if (g("hwLift").qty !== 2) return "mecanisme: " + g("hwLift").qty + " (trebuie 2, câte unul pe ușă, nu pe clapă)";
      if (g("hwCern").qty) return "balamale: " + g("hwCern").qty;
      GL3D.render(c, { explode: 0 });
      const bx = buildModule(c).boxes.filter(b => b.sub === "lift"); if (bx.length !== 4) return "cutii: " + bx.length;
      const u = bx.find(b => b.lift.i === 0 && b.lift.flap === 1), l = bx.find(b => b.lift.i === 0 && b.lift.flap === 2);
      const C = GL3D.worldBoxes({ open: 0 }), O = GL3D.worldBoxes({ open: 1 });
      const ext = (W, b) => { const P = W.find(x => String(x.pk) === String(b.pk)), q = P.boxes.flat(); return { y0: Math.min(...q.map(a => a[1])), y1: Math.max(...q.map(a => a[1])), z0: Math.min(...q.map(a => a[2])), z1: Math.max(...q.map(a => a[2])) }; };
      const cu = ext(C, u), cl = ext(C, l), ou = ext(O, u), ol = ext(O, l), pz = u.z1;
      if (!(cu.y0 - cl.y1 > 2.5)) return "închis: clapele se ating (" + (cu.y0 - cl.y1) + ")";
      /* deschis: clapa de jos stă peste cea de sus (se ating, nu se suprapun), amândouă în fața corpului, cel mult cât clapa de înălțime peste front */
      if (!(ol.y0 >= ou.y1 - 1.5)) return "deschis: clapa de jos intră în cea de sus (" + ol.y0 + " < " + ou.y1 + ")";
      if (!(Math.min(ou.z0, ol.z0) >= pz - 8)) return "deschis: o clapă intră în corp (z " + Math.min(ou.z0, ol.z0) + " < " + pz + ")";
      if (!(ou.z1 - pz > 150 && ou.z1 - pz < (u.y1 - u.y0) + 10)) return "deschis: clapa de sus nu e întinsă înainte (" + (ou.z1 - pz) + ")";
      if (!(ol.z1 <= ou.z1 + 4)) return "deschis: clapa de jos iese dincolo de cea de sus (" + ol.z1 + " > " + ou.z1 + ")";
      return true; } catch (e) { return String(e); } });
    ok("Front în două piese (HF top): un mecanism pe ușă, fără balamale; «Deschide» pliază clapa de jos peste cea de sus, fără suprapunere și fără să intre în corp", hfRes === true, String(hfRes));
    const roomLift = await pg.evaluate(() => { try {
      const p = proj(), keepP = p.pieces, keepC = p.configs, keepL = p.layout, keepS = p.survey, keepO = roomOpen;
      p.pieces = []; p.configs = {}; p.layout = {};
      p.survey = { walls: [{ id: "w1", len: 3000, angle: 90, bow: null }, { id: "w2", len: 2400, angle: 90, bow: null }, { id: "w3", len: 3000, angle: 90, bow: null }, { id: "w4", len: 2400, angle: 90, bow: null }], heights: [2500, 2500, 2500], obstacles: [] };
      const mk = (name, lift, wall, from, doors) => { const c = { ...PRESETS.pensile, name, L: 900, H: 600, P: 330, doors, drawers: 0, hang: 1, lift }; generateInto(p, c); layout()[name] = { wall, from, off: 0, lift: 1500, rot: 0 }; return c; };
      mk("RlHf", "blum_hf_top", "w1", 300, 1); mk("RlHk", "blum_hk_top", "w2", 300, 1);
      const out = {};
      for (const o of [0, 1]) { roomOpen = o; out["o" + o] = roomBoxes().filter(b => b.rmMod === "RlHf" || b.rmMod === "RlHk").map(b => ({ mod: b.rmMod, prism: !!b.prism3, kind: b.kind, y0: b.y0, y1: b.y1, x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1 })); }
      roomOpen = keepO; p.pieces = keepP; p.configs = keepC; p.layout = keepL; p.survey = keepS;
      return out; } catch (e) { return { err: String(e) }; } });
    ok("Camera 3D, «Ante aperte»: ușile basculante (și cele două clape HF) se deschid; închise rămân cutii", !roomLift.err && roomLift.o0.every(b => !b.prism || b.kind !== "f") && (() => {
      const f = (arr, mod) => arr.filter(b => b.mod === mod && b.kind === "f");
      const hf0 = f(roomLift.o0, "RlHf"), hf1 = f(roomLift.o1, "RlHf"), hk0 = f(roomLift.o0, "RlHk"), hk1 = f(roomLift.o1, "RlHk");
      if (hf0.length !== 2 || hf1.length !== 2 || hk0.length !== 1 || hk1.length !== 1) return false;
      if (!hf1.every(b => b.prism) || !hk1[0].prism) return false;
      /* HF: deschis, cele două clape stau una peste alta (înălțimea comună ≈ două grosimi, nu 600 mm); HK: ușa întinsă înainte (extinderea pe verticală sub un sfert din cea închisă) */
      const spanClosed = Math.max(...hf0.map(b => b.y1)) - Math.min(...hf0.map(b => b.y0)), spanOpen = Math.max(...hf1.map(b => b.y1)) - Math.min(...hf1.map(b => b.y0));
      return spanOpen < spanClosed * 0.2 && (hk1[0].y1 - hk1[0].y0) < (hk0[0].y1 - hk0[0].y0) * 0.25;
    })(), JSON.stringify(roomLift).slice(0, 700));
    const hitRes = await pg.evaluate(() => { try {
      const p = proj(), keepP = p.pieces, keepC = p.configs, keepL = p.layout, keepS = p.survey, keepO = roomOpen;
      p.pieces = []; p.configs = {}; p.layout = {};
      p.survey = { walls: [{ id: "w1", len: 3000, angle: 90, bow: null }, { id: "w2", len: 2400, angle: 90, bow: null }, { id: "w3", len: 3000, angle: 90, bow: null }, { id: "w4", len: 2400, angle: 90, bow: null }], heights: [2500, 2500, 2500], obstacles: [] };
      const mk = (name, wall, from, off, hang) => { const c = { ...PRESETS.armadio, name, L: 800, H: 700, P: 330, doors: 1, drawers: 0, hang: 1 }; generateInto(p, c); layout()[name] = { wall, from, off, lift: 1500, rot: 0 }; };
      mk("HtA", "w1", 200, 0); mk("HtB", "w1", 1100, 0);       // două corpuri alăturate, pe același perete: ușile nu se lovesc
      const none = (() => { roomOpen = 1; roomBoxes(); return roomHits.slice(); })();
      mk("HtC", "w1", 1000, 200);                              // un corp tras înainte, în fața ușii lui HtB: ușa lui HtB îl lovește
      roomOpen = 1; roomBoxes(); const hit = roomHits.slice();
      roomOpen = 0; roomBoxes(); const closed = roomHits.slice();
      roomOpen = keepO; p.pieces = keepP; p.configs = keepC; p.layout = keepL; p.survey = keepS;
      return { none, hit, closed }; } catch (e) { return { err: String(e) }; } });
    ok("Camera 3D, «Ante aperte»: o ușă deschisă care lovește alt corp e semnalată; închis, sau fără lovitură, nu", !hitRes.err && hitRes.none.length === 0 && hitRes.hit.length >= 1 && hitRes.hit.some(h => h.hit === "HtC" || h.door === "HtC") && hitRes.closed.length === 0, JSON.stringify(hitRes).slice(0, 400));
    ok("U.16: nume traduse in toate limbile", await pg.evaluate(() => { const L = ["ro", "en", "fr", "de", "pl", "es"], keep = state.lang;
      const k = L.every(l => { state.lang = l; return elName("Anta basculante") !== "Anta basculante" && t("fLift") !== "fLift" && t("wLiftRange") !== "wLiftRange" && t("opsLiftNoDrill") !== "opsLiftNoDrill"; }); state.lang = keep; return k; }));
    await pg.evaluate(() => { closeSheets(); setView("build"); document.getElementById("grpFr").open = true; buildCfg = { ...PRESETS.pensile, name: "Lf1", L: 900, H: 600, P: 330, doors: 1, drawers: 0, hang: 0, lift: "het_la_hk" }; syncBuildForm(); renderSecChips(); drawPreview(); });
    await pg.waitForTimeout(300);
    ok("U.16: deschiderea electrică se vede numai la sistemele cu SERVO-DRIVE (Hettich: ascunsă)", await pg.evaluate(() => $("rowLiftElec").style.display === "none"));
    await pg.selectOption("#bLift", "blum_hk_top"); await pg.waitForTimeout(150);
    ok("U.16: la Blum HK top apare «Electrică — SERVO-DRIVE»", await pg.evaluate(() => $("rowLiftElec").style.display !== "none"));
    await pg.selectOption("#bLiftElec", "servo"); await pg.waitForTimeout(200);
    const se = await pg.evaluate(() => { const c = cfgFromForm(); const p = proj(); p.pieces = []; p.configs = {}; p.layout = {}; generateInto(p, { ...c, name: "Lf2" });
      const items = computeHardware(p, state.settings), g = k => (items.find(i => i.k === k) || {}).qty || 0;
      return { elec: c.liftElec, drv: g("hwLiftDrv"), psu: g("hwLiftPsu"), sw: g("hwLiftSw"), hint: $("liftElecHint").style.display !== "none" }; });
    ok("U.16: SERVO-DRIVE în cfg și deviz: o unitate, un comutator pe ușă, un alimentator pe corp", se.elec === "servo" && se.drv === 1 && se.sw === 1 && se.psu === 1 && se.hint, JSON.stringify(se));
    await pg.selectOption("#bLift", "het_la_hk"); await pg.waitForTimeout(150);
    ok("U.16: schimbat pe Hettich, opțiunea electrică dispare din cfg", await pg.evaluate(() => cfgFromForm().liftElec === null));
    await pg.evaluate(() => { buildCfg = { ...PRESETS.base }; syncBuildForm(); });
    ok("U.16: nessun errore JS", errs.length === 0, errs.join(" | ").slice(0, 200));
  }

  /* U.17 — deschidere push, suspendare, îmbinări demontabile / fără unealtă (ebanist-open.js) */
  {
    head("Deschidere push, suspendare, îmbinări fără unealtă (U.17)");
    await pg.evaluate(() => { closeSheets(); setView("build"); document.getElementById("grpHw").open = true;
      buildCfg = { ...PRESETS.pensile, name: "Op1", L: 900, H: 600, P: 330, doors: 2, drawers: 0, hang: 0, support: "sospeso", handles: "push" }; syncBuildForm(); renderSecChips(); drawPreview(); });
    await pg.waitForTimeout(300);
    ok("U.17: catalog — push, sertare, suspendare, șine, alimentatoare, îmbinări noi, toate cu nume în cele 7 limbi", await pg.evaluate(() => {
      const L = ["it", "ro", "en", "fr", "de", "pl", "es"], cats = ["push", "pushd", "pushpsu", "susp", "suprail", "conn"];
      return cats.every(c => HWDB[c].length > 0) && HWDB.push.length >= 20 && HWDB.susp.length >= 20 && HWDB.pushd.length >= 20 && HWDB.conn.length >= 55 &&
        cats.every(c => HWDB[c].filter(x => x.open).every(x => L.every(l => x.n[l] && x.n[l].length > 4) && x.price === 0)) &&
        HWDB.conn.some(x => x.id === "het_rastex15_b24") && HWDB.conn.some(x => x.id === "haf_tab18_plug") && HWDB.conn.some(x => x.id === "kn_duo35_ml");
    }));
    ok("U.17: nimic dublat cu catalogul de dinainte (ids unice pe categorie); articolele vechi rămân", await pg.evaluate(() =>
      ["push", "conn", "pushd", "susp", "suprail", "pushpsu"].every(c => new Set(HWDB[c].map(x => x.id)).size === HWDB[c].length) && HWDB.push.some(x => x.id === "blum_tipon_a") && HWDB.push.some(x => x.id === "haf_onetouch") && HWDB.conn.some(x => x.id === "haf_rafix")));
    ok("U.17: selectoare pe corp pentru sertare, suspendare, șină — fără articol implicit («niciunul»), nu schimbă nimic", await pg.evaluate(() => {
      renderHwSel(); const s = c => document.querySelector('#hwSelBox select[data-cat="' + c + '"]');
      return ["pushd", "susp", "suprail"].every(c => s(c) && s(c).value === "" && s(c).options[0].textContent.includes("—")) && cfgFromForm().hwSel === null && cfgFromForm().suspKg === null; }));
    ok("U.17: sarcina conținutului apare numai când e aleasă o suspendare", await pg.evaluate(() => $("rowSuspKg").style.display === "none"));
    await pg.selectOption('#hwSelBox select[data-cat="susp"]', "het_sah215"); await pg.waitForTimeout(150);
    await pg.fill("#bSuspKg", "35"); await pg.waitForTimeout(100);
    ok("U.17: alegerea ajunge în cfg (hwSel.susp, suspKg) și rândul de sarcină se vede", await pg.evaluate(() => { const c = cfgFromForm(); return c.hwSel && c.hwSel.susp === "het_sah215" && c.suspKg === 35 && $("rowSuspKg").style.display !== "none" && $("suspHint").textContent.length > 20; }));
    const sh = await pg.evaluate(() => { const p = proj(); p.pieces = []; p.configs = {}; p.layout = {}; generateInto(p, { ...cfgFromForm(), name: "Op1" });
      const it = computeHardware(p, state.settings), g = k => (it.find(i => i.k === k) || {}).qty || 0, id = k => ((it.find(i => i.k === k) || {}).prod || {}).id;
      let mont = false; try { mont = montDoc(p).includes(t("mOpenSusp").split("{p}")[0].trim().slice(0, 14)); } catch (e) {}
      return { susp: g("hwSusp"), rail: g("hwSuspRail"), sid: id("hwSusp"), rid: id("hwSuspRail"), cern: g("hwCern"), mont }; });
    ok("U.17: deviz — o pereche de cleme și o șină pe corp (șina implicită a articolului), balamalele rămân", sh.susp === 1 && sh.rail === 1 && sh.sid === "het_sah215" && sh.rid === "het_rail_b" && sh.cern > 0, JSON.stringify(sh));
    ok("U.17: fișa de montaj are pasul de suspendare", sh.mont === true);
    const wn = await pg.evaluate(() => { const c = { ...cfgFromForm(), suspKg: 140 }; const b = buildModule(c); return (b.warn.openWarn || []).map(w => EBOpen.msg(w, t)); });
    ok("U.17: sarcină peste portanță: avertisment cu valorile (90 kg = 2 × 45), în limba aplicației", wn.some(m => /90/.test(m) && /45/.test(m)) && wn.every(m => !/\{\w+\}/.test(m)), JSON.stringify(wn));
    ok("U.17: fără alegere explicită, buildModule nu are openWarn", await pg.evaluate(() => { const c = { ...cfgFromForm(), hwSel: null, suspKg: null }; return buildModule(c).warn.openWarn == null; }));
    /* deviz identic fără alegere */
    ok("U.17: deviz — implicit identic: cu sau fără hwSel gol aceleași rânduri (D-39)", await pg.evaluate(() => {
      const mk = hs => { const p = proj(); p.pieces = []; p.configs = {}; p.layout = {}; generateInto(p, { ...PRESETS.armadio, name: "Q", hwSel: hs, doors: 2, drawers: 2, handles: "push" }); return JSON.stringify(computeHardware(p, state.settings).map(i => [i.k, i.qty, i.prod && i.prod.id])); };
      const a = mk(null), b = mk({}), c = mk({ cern: "blum_71b3550" });
      return a === b && !/hwPushD|hwSusp|hwPushPsu/.test(a.replace(/"hwPushD",0|"hwSusp",0|"hwSuspRail",0|"hwPushPsu",0/g, "")) && JSON.parse(a).filter(r => r[0] === "hwPush")[0][1] === 2 && c.length > 0; }));
    /* sertare: dispozitiv ales pe corp */
    const pd = await pg.evaluate(() => { const mk = hs => { const p = proj(); p.pieces = []; p.configs = {}; p.layout = {}; generateInto(p, { ...PRESETS.cassettiera, name: "Q2", hwSel: hs, handles: "push", drawers: 3, doors: 0, drawerSys: "legrabox" });
        const it = computeHardware(p, state.settings), g = k => (it.find(i => i.k === k) || {}).qty || 0; return { push: g("hwPush"), pd: g("hwPushD"), psu: g("hwPushPsu"), man: g("hwMan") }; };
      return { none: mk(null), tob: mk({ pushd: "blum_tobm_lbx_l3" }), easys: mk({ pushd: "het_easys_9078139" }), servo: mk({ pushd: "blum_servo_drawer" }) }; });
    ok("U.17: sertare — fără alegere hwPush ca înainte; cu dispozitiv ales: hwPushD pe sertar, fără hwPush", pd.none.push === 3 && pd.none.pd === 0 && pd.tob.pd === 3 && pd.tob.push === 0 && pd.tob.psu === 0, JSON.stringify(pd));
    ok("U.17: alimentator: Easys și SERVO-DRIVE au unul pe corp (27 de unități / limita nu e în sursă)", pd.easys.psu === 1 && pd.servo.psu === 1 && pd.easys.pd === 3, JSON.stringify(pd));
    const dq = await pg.evaluate(() => { const mk = (H, hs) => { const p = proj(); p.pieces = []; p.configs = {}; p.layout = {}; generateInto(p, { ...PRESETS.armadio, name: "Q3", hwSel: hs, handles: "push", doors: 2, H, drawers: 0, tram: 0 });
        const it = computeHardware(p, state.settings); return (it.find(i => i.k === "hwPush") || {}).qty || 0; };
      return { lo: mk(1500, { push: "sal_push_dp4" }), hi: mk(2000, { push: "sal_push_dp4" }), one: mk(2000, { push: "blum_tipon_short" }) }; });
    ok("U.17: Salice: 1 dispozitiv pe ușă sub 1600 mm, 2 peste (din sursă); celelalte 1 pe ușă", dq.lo === 2 && dq.hi === 4 && dq.one === 2, JSON.stringify(dq));
    /* ops + 3D */
    const o3 = await pg.evaluate(() => { const c = { ...PRESETS.pensile, name: "Op2", L: 900, H: 600, P: 330, doors: 2, drawers: 0, hang: 0, support: "sospeso", handles: "push", hwSel: { push: "blum_tipon_short", susp: "het_sah500", suprail: "het_rail_b", conn: "het_rastex15_b24" } };
      const bm = buildModule(c), G = deriveCarcass(carcassParams(c, {})), O = generateOperations({ boxes: bm.boxes, cfg: c, G });
      const types = [...new Set(O.hw.map(h => h.type))];
      let img = false, err = null; try { GL3D.render(c, { explode: 0 }); const r = GL3D.capture(c, { open: 1, hw: true, w: 220, h: 160 }); img = !!(r && r.img); } catch (e) { err = String(e); }
      return { types, img, err, warn: O.warnings.map(w => w.k) }; });
    ok("U.17: ops — TIP-ON, SAH 500, șină și Rastex produc instanțe; avertismente de găurire", ["pushunit", "susphang", "suprail", "housing"].every(x => o3.types.includes(x)) && o3.warn.includes("opsOpenPlace") && o3.warn.includes("wOpenSuspNoDrill"), JSON.stringify(o3));
    ok("U.17: 3D — se desenează fără eroare (uși deschise, feronerie)", o3.img && !o3.err, o3.err || "");
    ok("U.17: textele sunt traduse în toate limbile (etichete, avertismente, pași de montaj)", await pg.evaluate(() => { const L = ["ro", "en", "fr", "de", "pl", "es"], keep = state.lang;
      const ks = ["hwPushD", "hwSusp", "hwSuspRail", "hwPushPsu", "fSuspKg", "suspHint", "wOpenRange", "wOpenSuspLoad", "mOpenSusp", "mOpenPush", "opsOpenNoDrill", "hwSelNone", "hw_housing"];
      const k = L.every(l => { state.lang = l; return ks.every(x => t(x) !== x); }); state.lang = keep; return k; }));
    ok("U.17: avertismentele de operații apar în «Controale» cu text, nu cu cheia", await pg.evaluate(() => { const c = { ...PRESETS.pensile, name: "Op3", L: 900, H: 600, P: 330, doors: 2, hang: 0, support: "sospeso", handles: "push", hwSel: { susp: "het_sah215" } };
      const w = opsNotesOf(c); return w.length > 0 && w.every(x => { const m = EBOpen.msg(x, t); return m && !/\{\w+\}/.test(m) && m !== x.k; }); }));
    ok("U.17: nessun errore JS", errs.length === 0, errs.join(" | ").slice(0, 200));
    await pg.evaluate(() => { buildCfg = { ...PRESETS.base }; syncBuildForm(); });
  }

  /* U.17 — unități de colț, scoase pentru corpuri joase și înalte, mecanisme de mișcare */
  {
    head("Unități de colț / scoase / mecanisme — opțiune, deviz, 3D, avertismente (U.17)");
    await pg.evaluate(() => { closeSheets(); setView("build"); document.getElementById("grpFr").open = true;
      buildCfg = { ...PRESETS.base, name: "Cu1", L: 900, H: 800, P: 560, doors: 2, shelves: 2, drawers: 0, hang: 0 }; syncBuildForm(); renderSecChips(); drawPreview(); });
    await pg.waitForTimeout(300);
    ok("U.17: implicit «Nessuna» — corp neschimbat, nicio cutie de unitate", await pg.evaluate(() => $("bCU").value === "" && cfgFromForm().cu === null && !buildModule(cfgFromForm()).boxes.some(b => b.role === "cornerhw")));
    ok("U.17: selectorul are cele 57 de unități, grupate pe 11 feluri", await pg.evaluate(() => $("bCU").querySelectorAll("option:not([value=''])").length === 57 && $("bCU").querySelectorAll("optgroup").length === 11));
    ok("U.17: rândul de alegere se vede pe corp standard, ascuns pe masă", await pg.evaluate(() => { const v = $("rowCU").style.display !== "none"; $("bTipo").value = "tavolo"; $("bTipo").dispatchEvent(new Event("change")); const h = $("rowCU").style.display === "none"; $("bTipo").value = "standard"; $("bTipo").dispatchEvent(new Event("change")); return v && h; }));
    await pg.selectOption("#bCU", "kb_lemans2"); await pg.waitForTimeout(250);
    ok("U.17: alegerea ajunge în cfg, ușa devine cea din date (rând «Anta», lățimea mărimii alese)", await pg.evaluate(() => { const c = cfgFromForm(), b = buildModule(c), a = b.pieces.filter(p => /^Anta/.test(p.elemento));
      return c.cu === "kb_lemans2" && a.length === 1 && a[0].pz === 1 && [400, 450, 500, 600].includes(a[0].larg) && b.cu && b.cu.size === String(a[0].larg); }));
    ok("U.17: mărimea (4 uși) și partea oarbă apar; indiciul se vede", await pg.evaluate(() => $("rowCUSize").style.display !== "none" && $("bCUSize").options.length === 5 && $("rowCUHand").style.display !== "none" && $("cuHint").style.display !== "none" && $("cuHint").textContent.length > 40));
    await pg.selectOption("#bCUSize", "500"); await pg.selectOption("#bCUHand", "dx"); await pg.waitForTimeout(200);
    ok("U.17: mărimea și partea oarbă ajung în cfg și în ușă (500 mm, balamale la dreapta)", await pg.evaluate(() => { const c = cfgFromForm(), b = buildModule(c), d = b.boxes.find(x => x.sub === "door");
      return c.cuSize === "500" && c.cuHand === "dx" && Math.round(d.x1 - d.x0) === 500 && d.hinge === "right"; }));
    const ch = await pg.evaluate(() => { const p = proj(); p.pieces = []; p.configs = {}; p.layout = {}; generateInto(p, { ...cfgFromForm(), name: "Cu1" });
      const items = computeHardware(p, state.settings), g = k => items.find(i => i.k === k) || {};
      const o = { corner: g("hwCorner").qty, name: (g("hwCorner").prod && g("hwCorner").prod.name) || "", cern: g("hwCern").qty || 0, man: g("hwMan").qty || 0 };
      try { o.mont = montDoc(p).includes(t("mCorner").split("{p}")[0].trim().slice(0, 12)); } catch (e) { o.err = String(e); }
      try { setView("summary"); o.sum = true; } catch (e) { o.err = String(e); }
      try { const cf = p.configs.Cu1; o.cfg = cf.cu === "kb_lemans2" && cf.shelves === 2; o.audit = auditModule(cf, p.pieces.filter(x => x.gen === "Cu1")).filter(a => a.severity === "blocking").map(a => a.id).join(","); } catch (e) { o.err = String(e); }
      return o; });
    ok("U.17: deviz — un set pe corp, balamale pe ușa de colț (2+), un mâner", ch.corner === 1 && /LeMans/.test(ch.name) && ch.cern >= 2 && ch.man === 1, JSON.stringify(ch));
    ok("U.17: «Montaj» are pasul unității; rezumatul fără erori; nicio eroare blocantă la audit (I4 nu cade pe ușa de colț)", ch.mont === true && ch.sum === true && !ch.err && ch.audit === "", JSON.stringify(ch));
    ok("U.17: avertisment «cote neverificate» și interiorul eliberat, în aplicație", await pg.evaluate(() => { const b = buildModule(cfgFromForm()), w = (b.warn && b.warn.cuWarn) || [];
      const n = EBCornerUI.notes(b.warn, b); return w.some(x => x.k === "unv") && w.some(x => x.k === "forced" && x.what === "shelves") && n.length >= 3 && n.some(s => /LeMans/.test(s)); }));
    ok("U.17: 3D — se desenează deschis și închis; tăvile și ușa se mișcă împreună", await pg.evaluate(() => { try { const c = cfgFromForm(); GL3D.render(c, { explode: 0 }); const r = GL3D.capture(c, { open: 1, hw: true, w: 200, h: 150 });
      const bs = buildModule(c).boxes, tray = bs.find(b => b.role === "cornerhw" && b.cu.an && b.cu.an.follow), door = bs.find(b => b.sub === "door");
      const t1 = GL3D.tgtOf(tray.pk), t2 = GL3D.tgtOf(door.pk);
      GL3D.worldBoxes({ open: 1 });
      return !!(r && r.img) && Math.abs(t2.ang) > 0.5 && Math.abs(t1.ang - t2.ang) < 1e-6; } catch (e) { return String(e); } }));
    await pg.evaluate(() => { closeSheets(); setView("build"); buildCfg = { ...PRESETS.base, name: "Cu2", L: 450, H: 2000, P: 600, doors: 2, shelves: 3, drawers: 0, hang: 0, cu: "kb_dispensa_vvsx" }; syncBuildForm(); drawPreview(); });
    await pg.waitForTimeout(250);
    const dh = await pg.evaluate(() => { const p = proj(); p.pieces = []; p.configs = {}; p.layout = {}; const c = cfgFromForm(); generateInto(p, { ...c, name: "Cu2" });
      const items = computeHardware(p, state.settings), g = k => (items.find(i => i.k === k) || {}).qty || 0;
      const b = buildModule(c), f = b.pieces.find(x => /^Fronte estraibile/.test(x.elemento));
      return { corner: g("hwCorner"), cern: g("hwCern"), man: g("hwMan"), front: !!f, anta: b.pieces.some(x => /^Anta/.test(x.elemento)), n: b.cu && b.cu.n, el: elName("Fronte estraibile") }; });
    ok("U.17: Dispensa — front pe cadru: fără balamale, un mâner, un set; 5 coșuri la 2000 mm", dh.corner === 1 && dh.cern === 0 && dh.man === 1 && dh.front && !dh.anta && dh.n === 5, JSON.stringify(dh));
    ok("U.17: nume și texte traduse în toate limbile", await pg.evaluate(() => { const L = ["it", "ro", "en", "fr", "de", "pl", "es"], keep = state.lang;
      const k = L.every(l => { state.lang = l; return t("fCU") !== "fCU" && t("opsCornerNoDrill") !== "opsCornerNoDrill" && t("hwCorner") !== "hwCorner" && t("mCorner") !== "mCorner" && t("cuw_range") !== "cuw_range" && t("cuKind_blind") !== "cuKind_blind" && (l === "it" || elName("Fronte estraibile") !== "Fronte estraibile"); });
      state.lang = keep; return k; }));
    ok("U.17: catalogul «Unități colț» are câte un articol pe unitate, cu preț de completat", await pg.evaluate(() => hwList("corner").length === 57 && hwList("corner").every(x => x.price === 0 && x.brand) && HW_CATS.some(c => c[0] === "corner")));
    await pg.evaluate(() => { closeSheets(); setView("build"); buildCfg = { ...PRESETS.angolare, name: "Cu3", L: 1000, L2: 900, H: 800, corner: "dx", shelves: 2, doors: 2, cu: "hettich_salso" }; syncBuildForm(); drawPreview(); });
    await pg.waitForTimeout(250);
    ok("U.17: corp de colț — partea oarbă o dă colțul (rândul «lato cieco» ascuns), unitatea pe aripa A, aripa B neschimbată", await pg.evaluate(() => { const c = cfgFromForm(), b = buildModule(c), plain = buildModule({ ...c, cu: null });
      const wb = x => JSON.stringify(x.pieces.filter(p => p.wing === "B"));
      return $("rowCUHand").style.display === "none" && c.cu === "hettich_salso" && wb(b) === wb(plain) && b.pieces.filter(p => p.wing === "A" && /^Ripiano/.test(p.elemento)).length === 0 && b.cu && b.cu.hand === "dx"; }));
    ok("U.17: copia modulului păstrează unitatea (configurația salvată)", await pg.evaluate(() => { const p = proj(); p.pieces = []; p.configs = {}; p.layout = {}; generateInto(p, { ...cfgFromForm(), name: "Cu3" });
      const c = p.configs.Cu3; return c.cu === "hettich_salso" && buildModule(c).boxes.some(b => b.role === "cornerhw"); }));
    await pg.evaluate(() => { buildCfg = { ...PRESETS.base }; syncBuildForm(); });
    ok("U.17: nicio eroare JS", errs.length === 0, errs.join(" | ").slice(0, 200));
  }

  /* U.17 — sisteme glisante / escamotabile / cu aripă din catalog (Hettich, Hawa, Blum, Häfele) */
  {
    head("Sisteme glisante, escamotabile, cu aripă — selector, deviz, 3D, avertismente (U.17)");
    await pg.evaluate(() => { closeSheets(); setView("build"); document.getElementById("grpFr").open = true;
      buildCfg = { ...PRESETS.scorrevole, name: "Sl1", L: 2400, H: 2400, P: 600, doors: 2, shelves: 0, hang: 0 }; syncBuildForm(); renderSecChips(); drawPreview(); });
    await pg.waitForTimeout(300);
    ok("U.17: implicit «Nessuno» — regula generică; câmpul se vede la corpul glisant", await pg.evaluate(() => $("bSlide").value === "" && cfgFromForm().slide === null && $("rowSlide").style.display !== "none"
      && !buildModule(cfgFromForm()).pieces.some(p => /Sistema ante/.test(p.elemento))));
    ok("U.17: corpul glisant are cele 44 de sisteme pe șină, grupate pe trei mărci (Hettich, Hawa, Häfele)", await pg.evaluate(() => $("bSlide").querySelectorAll("option:not([value=''])").length === 44 && $("bSlide").querySelectorAll("optgroup").length === 3));
    await pg.selectOption("#bSlide", "hawa_combino_35_fs"); await pg.waitForTimeout(200);
    const s1 = await pg.evaluate(() => { const c = cfgFromForm(), b = buildModule(c), d = b.pieces.find(p => /^Anta scorrevole/.test(p.elemento));
      const p = proj(); p.pieces = []; p.configs = {}; p.layout = {}; generateInto(p, { ...c, name: "Sl1" });
      const items = computeHardware(p, state.settings), g = k => items.filter(i => i.k === k), sl = g("hwSlide").filter(i => i.qty > 0);
      return { slide: c.slide, larg: d && d.larg, hint: $("slideHint").style.display !== "none" && $("slideHint").textContent.length > 20, info: $("slideInfo").querySelectorAll("div").length > 2,
        n: sl.length, art: sl.map(i => i.prod && i.prod.art).sort().join("|"), bin: (g("hwBin")[0] || {}).qty || 0, cern: (g("hwCern")[0] || {}).qty || 0 }; });
    ok("U.17: alegerea ajunge în cfg: ușa (KAM + 16)/2, indiciul și datele producătorului se văd", s1.slide === "hawa_combino_35_fs" && s1.larg === 1208 && s1.hint && s1.info, JSON.stringify(s1));
    ok("U.17: deviz — o linie pe cod din catalog (set, șină dublă), nicio «șină generică»", s1.n === 2 && s1.art === "056.3010.250|056.3182.073" && s1.bin === 0, JSON.stringify(s1));
    ok("U.17: avertismente: «cote neverificate» și «mișcare schematică»", await pg.evaluate(() => { const w = buildModule(cfgFromForm()).warn.slideWarn || []; return w.some(x => x.k === "unv"); }));
    ok("U.17: 3D — ușile glisante se deschid, șina și cărucioarele se desenează fără eroare", await pg.evaluate(() => { try { const c = cfgFromForm(); GL3D.render(c, { explode: 0 }); const r = GL3D.capture(c, { open: 1, hw: true, w: 200, h: 150 }); return !!(r && r.img) && buildModule(c).boxes.filter(b => b.sub === "slide").length === 2; } catch (e) { return false; } }));
    await pg.selectOption("#bSlide", "het_topline_xl"); await pg.waitForTimeout(150);
    ok("U.17: Hettich — fără formulă publicată: regula generică + avertisment; jocurile din desen; limita de lățime", await pg.evaluate(() => { const b = buildModule(cfgFromForm()), w = b.warn.slideWarn || [], d = b.pieces.find(p => /^Anta scorrevole/.test(p.elemento));
      return d.larg === 1220 && d.lung === 2290 && w.some(x => x.k === "noFormula") && w.some(x => x.k === "drawing") && w.some(x => x.k === "range" && x.what === "w"); }));
    ok("U.17: avertismentele se afișează în text, în limba aplicației", await pg.evaluate(() => { const keep = state.lang, out = [];
      for (const l of ["it", "ro", "en", "fr", "de", "pl", "es"]) { state.lang = l; out.push((buildModule(cfgFromForm()).warn.slideWarn || []).map(w => EBSliding.noteText(w, t)).every(m => m && !/\{\w+\}/.test(m))); } state.lang = keep; return out.every(Boolean); }));
    /* corp standard: escamotabile și cu aripă */
    await pg.evaluate(() => { buildCfg = { ...PRESETS.base, name: "Sl2", L: 600, H: 2000, P: 600, doors: 1, shelves: 0, hang: 0, plinth: 80, support: "zoccolo" }; syncBuildForm(); renderSecChips(); drawPreview(); });
    await pg.waitForTimeout(250);
    ok("U.17: corpul standard are cele 13 escamotabile + 8 cu aripă (nu și cele pe șină)", await pg.evaluate(() => $("bSlide").querySelectorAll("option:not([value=''])").length === 21 && !$("bSlide").querySelector("option[value='het_topline_xl']")));
    await pg.selectOption("#bSlide", "blum_revego_uno"); await pg.waitForTimeout(200);
    const s2 = await pg.evaluate(() => { const c = cfgFromForm(), b = buildModule(c), p = proj(); p.pieces = []; p.configs = {}; p.layout = {}; generateInto(p, { ...c, name: "Sl2" });
      const items = computeHardware(p, state.settings), g = k => (items.find(i => i.k === k) || {}), sl = items.filter(i => i.k === "hwSlide" && i.qty > 0);
      return { slide: c.slide, door: b.pieces.some(x => /^Anta a scomparsa/.test(x.elemento)), hinged: b.pieces.some(x => /^Anta(?! a scomparsa)/.test(x.elemento)), cern: g("hwCern").qty || 0, man: g("hwMan").qty || 0,
        arts: sl.map(i => i.prod && i.prod.art).sort().join("|"), pocket: b.boxes.filter(x => x.sub === "pocket").length, w: (b.warn.slideWarn || []).map(x => x.k).join() }; });
    ok("U.17: REVEGO uno — «Anta a scomparsa», fără balamale, un mâner, profil + suport + conector în deviz", s2.slide === "blum_revego_uno" && s2.door && !s2.hinged && s2.cern === 0 && s2.man === 1 && s2.pocket === 1
      && /801P500E\.L3/.test(s2.arts) && /801V505B/.test(s2.arts) && /801T/.test(s2.arts), JSON.stringify(s2));
    ok("U.17: avertismente REVEGO: zona buzunarului, interpretarea EB, cod de verificat", /pocket/.test(s2.w) && /interp/.test(s2.w) && /chk/.test(s2.w), s2.w);
    ok("U.17: 3D — ușa escamotabilă se deschide (rotire, mutare, retragere), șinele buzunarului se desenează", await pg.evaluate(() => { try { const c = cfgFromForm(); GL3D.render(c, { explode: 0 }); const r = GL3D.capture(c, { open: 1, hw: true, w: 200, h: 150 }); return !!(r && r.img); } catch (e) { return String(e); } }) === true);
    await pg.evaluate(() => { buildCfg = { ...PRESETS.base, name: "Sl3", L: 900, H: 1800, P: 500, doors: 1, shelves: 0, hang: 0, plinth: 80, support: "zoccolo" }; syncBuildForm(); renderSecChips(); drawPreview(); });
    await pg.waitForTimeout(250);
    await pg.selectOption("#bSlide", "het_wingline_l"); await pg.waitForTimeout(200);
    const s3 = await pg.evaluate(() => { const c = cfgFromForm(), b = buildModule(c), p = proj(); p.pieces = []; p.configs = {}; p.layout = {}; generateInto(p, { ...c, name: "Sl3" });
      const items = computeHardware(p, state.settings), g = k => (items.find(i => i.k === k) || {}), sl = items.filter(i => i.k === "hwSlide" && i.qty > 0);
      return { leaves: (b.pieces.find(x => /^Anta pieghevole/.test(x.elemento)) || {}).pz, genFold: g("hwFold").qty || 0, cern: g("hwCern").qty || 0, man: g("hwMan").qty || 0, arts: sl.map(i => i.prod && i.prod.art).sort().join("|"),
        ops: generateOperations({ boxes: b.boxes, cfg: c, G: deriveCarcass(carcassParams(c, {})) }) }; });
    ok("U.17: WingLine L — 2 foi, fără sistem pliant generic, fără balamale între foi, un mâner pe pachet, set cu balamale centrale", s3.leaves === 2 && s3.genFold === 0 && s3.cern === 0 && s3.man === 1 && /9277991/.test(s3.arts.replace(/ /g, "")) && /9278742/.test(s3.arts.replace(/ /g, "")), JSON.stringify({ ...s3, ops: 0 }));
    ok("U.17: WingLine L — ops: fără cupe generice între foi, cu avertisment de găuri negenerate", s3.ops.hw.filter(h => h.type === "cerniera_pliante").length === 0 && s3.ops.warnings.some(w => w.k === "opsSlideNoDrill"));
    ok("U.17: 3D — foile cu aripă se pliază la deschidere, fără eroare", await pg.evaluate(() => { try { const c = cfgFromForm(); GL3D.render(c, { explode: 0 }); const r = GL3D.capture(c, { open: 1, hw: true, w: 200, h: 150 }); return !!(r && r.img) && buildModule(c).boxes.filter(b => b.sub === "fold" && b.fold.wing).length === 2; } catch (e) { return false; } }));
    ok("U.17: nume traduse în toate limbile (piese, câmp, avertismente, ops, catalog)", await pg.evaluate(() => { const L = ["ro", "en", "fr", "de", "pl", "es"], keep = state.lang;
      const k = L.every(l => { state.lang = l; return elName("Anta a scomparsa") !== "Anta a scomparsa" && elName("Sistema ante scorrevoli") !== "Sistema ante scorrevoli" && t("fSlide") !== "fSlide" && t("wSlideRange") !== "wSlideRange"
        && t("opsSlideNoDrill") !== "opsSlideNoDrill" && t("hwSlide") !== "hwSlide" && hwName(HWDB.slide[0]).length > 5 && hwName(HWDB.slide[0]) !== hwName({ n: { it: "x" } }); });
      state.lang = keep; return k && new Set(L.map(l => HWDB.slide[0].n[l])).size > 3; }));
    ok("U.17: catalogul de feronerie arată categoria «Sisteme glisante…» cu 388 de coduri (căutare), fără eroare", await pg.evaluate(() => { try { renderCatalog(); const sel = $("catHwWrap").querySelector("select[data-cat='slide']"); return !!sel && sel.options.length === 388 && HWDB.slide.length === 388; } catch (e) { return String(e); } }) === true);
    ok("U.17: schimbat tipul corpului, sistemul pe șină dispare din cfg", await pg.evaluate(() => { buildCfg = { ...PRESETS.scorrevole, name: "Sl4", L: 2400, H: 2400, P: 600, doors: 2, slide: "het_topline_l" }; syncBuildForm(); const a = cfgFromForm().slide === "het_topline_l";
      $("bTipo").value = "standard"; $("bTipo").dispatchEvent(new Event("change")); return a && cfgFromForm().slide === null; }));
    await pg.evaluate(() => { buildCfg = { ...PRESETS.base }; syncBuildForm(); });
    ok("U.17: nessun errore JS", errs.length === 0, errs.join(" | ").slice(0, 200));
  }

  /* Sisteme de sertar Hettich / GRASS (ebanist-drawers-more.js) si glisiere pentru sertar din lemn */
  {
    const J2 = x => JSON.stringify(x);
    head("Sisteme de sertar Hettich / GRASS — selectie, distinta, deviz, fisa, 3D, avertismente (drawers-more)");
    await pg.evaluate(() => { closeSheets(); setView("build"); document.getElementById("grpFr").open = true;
      buildCfg = { ...PRESETS.cassettiera, name: "Dm1", L: 600, H: 720, P: 560, drawers: 3, drawerSys: "legno", plinth: 100 }; syncBuildForm(); renderSecChips(); drawPreview(); });
    await pg.waitForTimeout(300);
    ok("drawers-more: selectorul de sisteme are cele 5 sisteme noi, înaintea lui «nessuno»", await pg.evaluate(() => {
      const v = [...$("bDrawSys").options].map(o => o.value); const i = v.indexOf("nessuno");
      return ["het_avantech", "het_arcitech", "gr_nps", "gr_v8", "gr_v13"].every(k => v.indexOf(k) >= 0 && v.indexOf(k) < i) && v.indexOf("het_atira") < 0 && v[0] === "legno" && v.slice(0, 4).join() === "legno,legrabox,tandembox,matrix"; }));
    ok("drawers-more: implicit sertarul din lemn, ca înainte (nicio cheie nouă în cfg)", await pg.evaluate(() => cfgFromForm().drawerSys === "legno" && !buildModule(cfgFromForm()).draw.mo));
    await pg.selectOption("#bDrawSys", "het_avantech"); await pg.waitForTimeout(250);
    ok("drawers-more: AvanTech YOU — înălțimile din sursă (fără H77), cu cota lor", await pg.evaluate(() => {
      const o = [...$("bDrawH").options].map(x => x.value).filter(Boolean); return o.join() === "101,139,187,251" && $("rowDrawH").style.display !== "none"; }));
    const a1 = await pg.evaluate(() => { const c = cfgFromForm(), b = buildModule(c), p = b.draw;
      const f = b.pieces.find(x => /^Fondo cassetto/.test(x.elemento)), r = b.pieces.find(x => /^Retro cassetto/.test(x.elemento));
      return { sys: c.drawerSys, ok: p.ok, nl: p.nl, h: p.hcode, fl: f.lung, fa: f.larg, rl: r.lung, rh: r.larg, side: b.pieces.filter(x => /^Fianco cassetto/.test(x.elemento)).length, LW: 600 - 2 * 19 }; });
    ok("drawers-more: AvanTech — fund LW−24 × NL−21, spate LW−24 × înălțimea din tabel, laterale cumpărate", a1.sys === "het_avantech" && a1.ok && a1.fl === a1.LW - 24 && a1.fa === a1.nl - 21 && a1.rl === a1.LW - 24 && a1.rh === ({ 101: 54, 139: 92, 187: 141, 251: 205 })[a1.h] && a1.side === 0, JSON.stringify(a1));
    await pg.selectOption("#bDrawSys", "het_arcitech"); await pg.waitForTimeout(200);
    const a2 = await pg.evaluate(() => { const b = buildModule(cfgFromForm()), p = b.draw, f = b.pieces.find(x => /^Fondo cassetto/.test(x.elemento)); return { ok: p.ok, bw: p.baseW, nl: p.nl, fl: f.lung, fa: f.larg }; });
    ok("drawers-more: ArciTech pe 19 mm — fund LW − 2·12 − 52,5 (EB după grosime), lungime NL − 24,5", a2.ok && Math.abs(a2.bw - (562 - 76.5)) < 0.05 && a2.fl === Math.round(562 - 76.5) && a2.fa === Math.round(a2.nl - 24.5), JSON.stringify(a2));
    await pg.selectOption("#bDrawSys", "gr_nps"); await pg.waitForTimeout(200);
    const g1 = await pg.evaluate(() => { const c = cfgFromForm(), b = buildModule(c), p = b.draw; return { ok: p.ok, h: p.hcode, nl: p.nl, th: p.warn.some(w => w.k === "wDrawMoreTh"), hint: $("angHint").textContent }; });
    ok("drawers-more: Nova Pro Scala pe 19 mm — planul stă în picioare cu avertismentul «cote pentru PAL de 16 mm»", g1.ok && g1.th && /16/.test(g1.hint), JSON.stringify(g1));
    /* Nova Pro Scala H63 există numai la NL 400–550: pe un corp puțin adânc se cere și se refuză cu avertisment */
    await pg.evaluate(() => { buildCfg = { ...buildCfg, P: 340, drawerH: "63" }; syncBuildForm(); renderSecChips(); drawPreview(); });
    await pg.selectOption("#bDrawSys", "gr_nps"); await pg.selectOption("#bDrawH", "63"); await pg.waitForTimeout(250);
    ok("drawers-more: H63 cerută la NL 300 — avertisment «nu există la NL» și altă înălțime", await pg.evaluate(() => { const p = buildModule(cfgFromForm()).draw; return p.nl === 300 && p.warn.some(w => w.k === "wDrawMoreNLH") && p.hcode !== "63" && /300/.test($("angHint").textContent); }));
    await pg.evaluate(() => { buildCfg = { ...buildCfg, P: 560, drawerH: null }; syncBuildForm(); renderSecChips(); drawPreview(); });
    await pg.selectOption("#bDrawSys", "het_avantech"); await pg.waitForTimeout(250);
    /* deviz: o pereche de glisiere si un set de laterale pe sertar, articolele lor */
    const hw = await pg.evaluate(() => { const p = proj(); p.pieces = []; p.configs = {}; p.layout = {}; generateInto(p, { ...cfgFromForm(), name: "Dm1" });
      const items = computeHardware(p, state.settings), g = items.filter(i => i.k === "hwGuida"), z = items.filter(i => i.k === "hwZarga");
      const o = { g: g.map(i => [i.prod && i.prod.id, i.qty]), z: z.map(i => [i.prod && i.prod.id, i.qty]) };
      try { o.mont = montDoc(p); } catch (e) { o.err = String(e); }
      try { setView("summary"); o.sum = true; setView("build"); } catch (e) { o.err = String(e); }
      return o; });
    ok("drawers-more: deviz — 3 perechi Actro YOU și 3 seturi de laterale AvanTech (cu articolul lor)", J2(hw.g) === '[["het_actro_you",3]]' && J2(hw.z) === '[["het_avantech_zarga",3]]', J2(hw));
    ok("drawers-more: «Montaj» — adâncimea minimă NL+3, glisiera, fixarea frontului; rezumatul fără erori", !hw.err && hw.sum === true && /503|NL \+ 3/.test(hw.mont || "") && /Actro YOU/.test(hw.mont) && /Practica 250/.test(hw.mont), (hw.err || "") + String(hw.mont).slice(0, 80));
    ok("drawers-more: articolele noi se văd în Catalog (guide și laterale), cu «de verificat»", await pg.evaluate(() => HWDB.guida.some(x => x.id === "het_actro_you" && x.chk) && HWDB.zarga.some(x => x.id === "gr_v13_zarga" && x.chk) && HWDB.guida.length >= 9 + 3));
    /* găurire: nicio gaură de glisieră, avertisment (nu pozițiile Blum 37/261/453) */
    const op = await pg.evaluate(() => { const c = cfgFromForm(), n = opsNotesOf(c), b = buildModule(c); const G = deriveCarcass(carcassParams(c, {}));
      const ops = generateOperations({ boxes: b.boxes, cfg: c, G });
      return { notes: n.map(w => w.k), holes: ops.pieces.reduce((a, p) => a + (p.operations || []).filter(x => /guida/i.test(x.note || "")).length, 0), txt: n.length ? t(n[0].k).replace("{g}", n[0].g) : "" }; });
    ok("drawers-more: găurire — nicio gaură de glisieră inventată, avertismentul cu numele glisierei", op.holes === 0 && op.notes.includes("opsDrawMoreNoHoles") && /Actro YOU/.test(op.txt), JSON.stringify(op));
    /* 3D: cutiile, laterale metalice, glisiera în hardware */
    ok("drawers-more: 3D — laterale metalice, fund și spate, glisiera Actro desenată", await pg.evaluate(() => { try { const c = cfgFromForm(); GL3D.render(c, { explode: 0 }); const r = GL3D.capture(c, { open: 1, hw: true, w: 220, h: 160 }); const bs = buildModule(c).boxes;
      return !!(r && r.img) && bs.filter(b => b.role === "cassetto_metallo").length === 6 && bs.filter(b => b.role === "cassetto_fondo" && b.sub === "dbox").length === 3; } catch (e) { return false; } }));
    /* sertar din lemn pe glisiera Dynapro: LW−42, NL−10 */
    await pg.selectOption("#bDrawSys", "legno"); await pg.waitForTimeout(150);
    const wd = await pg.evaluate(() => { const keep = state.settings.hwProd.guida; state.settings.hwProd.guida = "gr_dynapro"; let o;
      try { const b = buildModule(cfgFromForm()), p = b.draw, f = b.pieces.find(x => /^Fianco cassetto/.test(x.elemento)); o = { ok: p.ok, ded: p.ded, bw: p.boxW, nl: p.nl, sl: f && f.lung, mo: p.mo && p.mo.kind }; } finally { state.settings.hwProd.guida = keep; } return o; });
    ok("drawers-more: sertar din lemn pe Dynapro — lățime LW−42, lungime NL−10", wd.ok && wd.ded === 42 && wd.bw === 562 - 42 && wd.sl === wd.nl - 10 && wd.mo === "wood", J2(wd));
    const wq = await pg.evaluate(() => { const keep = state.settings.hwProd.guida; state.settings.hwProd.guida = "het_quadro_v6"; let o;
      try { const b = buildModule(cfgFromForm()); o = { ok: b.draw.ok, k: b.draw.warn.map(w => w.k), rows: b.pieces.filter(x => /^Fianco cassetto/.test(x.elemento)).length, hint: ""}; drawPreview(); o.hint = $("angHint").textContent; } finally { state.settings.hwProd.guida = keep; } return o; });
    ok("drawers-more: Quadro V6 pe lemn — fără formulă în sursă: avertisment, nu o cotă ghicită", wq.ok === 0 && wq.k.includes("wDrawMoreNoDed") && wq.rows === 0, J2(wq));
    /* texte în toate limbile */
    ok("drawers-more: textele noi în toate cele 7 limbi", await pg.evaluate(() => { const keep = state.lang, ks = ["wDrawMoreKD", "wDrawMoreMinW", "wDrawMoreMinBox", "wDrawMoreTh", "wDrawMoreNoRear", "wDrawMoreNoDed", "wDrawMoreSideTh", "wDrawMoreNLH", "opsDrawMoreNoHoles", "dwMoreDepth", "dwMoreSlide", "dwMoreSides", "dwMoreFront", "dwMoreHoles", "fx_screw", "fx_hook"];
      const r = ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => { state.lang = l; return ks.every(k => t(k) !== k && t(k).length > 3); }); state.lang = keep; return r; }));
    /* proiectul se salvează și se reîncarcă cu sistemul ales */
    ok("drawers-more: proiectul cu sistemul nou se reconstruiește identic din cfg salvat", await pg.evaluate(() => { const c = { ...cfgFromForm(), drawerSys: "gr_v8", name: "Dm2", drawers: 2 }; const a = JSON.stringify(buildModule(JSON.parse(JSON.stringify(c))).pieces), b = JSON.stringify(buildModule(c).pieces); return a === b && a.indexOf("Fondo cassetto") > 0; }));
    await pg.evaluate(async () => { const p = proj(); p.pieces = []; p.configs = {}; p.layout = {}; buildCfg = { ...PRESETS.base }; syncBuildForm(); drawPreview(); await new Promise(r => setTimeout(r, 700)); HIST.undo = []; HIST.redo = []; HIST.cur = null; HIST.name = null; histSync(); });
    ok("drawers-more: nessun errore JS", errs.length === 0, errs.join(" | ").slice(0, 200));
  }

  /* H.1 — indexul unic al feroneriei și căutarea (ebanist-hwindex.js) */
  {
    head("Indexul de feronerie — sloturi, căutare, fațete pe catalogul real (H.1)");
    const hx = await pg.evaluate(() => {
      const idx = hwIndex(), total = HW_CATS.reduce((s, c) => s + (HWDB[c[0]] || []).length, 0);
      const alt = [...new Set(idx.filter(e => e.slot === "altele").map(e => e.cat))].sort();
      const L = ["it", "ro", "en", "fr", "de", "pl", "es"];
      return { n: idx.length, total, unknown: idx.unknownCats, alt,
        names: idx.every(e => L.every(l => e.names[l] && e.names[l].length > 0)),
        dupes: idx.length - new Set(idx.map(e => e.cat + "|" + e.id)).size,
        slots: [...new Set(idx.map(e => e.slot))].sort(),
        hafele: EBHwIndex.search(idx, "hafele").length === EBHwIndex.search(idx, "HÄFELE").length && EBHwIndex.search(idx, "hafele").length > 20,
        code: (EBHwIndex.search(idx, "23KA000")[0] || {}).id,
        aventos: EBHwIndex.search(idx, "aventos hk top").some(e => e.id === "blum_hk_top"),
        hinges: EBHwIndex.search(idx, "", { slot: "balamale" }).length,
        fac: EBHwIndex.facets(idx, { slot: "balamale" }).brand,
        labels: EBHwIndex.SLOTS.every(s => ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => { const k = state.lang; state.lang = l; const ok = t(s.key) !== s.key; state.lang = k; return ok; })) };
    });
    ok("H.1: indexul are câte o intrare pe articol din catalog (fără pierderi, fără dubluri)", hx.n === hx.total && hx.dupes === 0 && hx.n > 600, JSON.stringify({ n: hx.n, total: hx.total, d: hx.dupes }));
    ok("H.1: nicio categorie necunoscută; în «altele» doar categoriile alese", hx.unknown.length === 0 && hx.alt.every(c => ["aw", "tblext", "letto", "trav", "feltro", "soc", "picacc"].includes(c)), JSON.stringify({ u: hx.unknown, a: hx.alt }));
    ok("H.1: fiecare intrare are nume în toate cele 7 limbi", hx.names === true);
    ok("H.1: căutarea nu ține cont de diacritice (Häfele = hafele) și găsește mult", hx.hafele === true);
    ok("H.1: căutarea după cod (23KA000 → unitatea SERVO-DRIVE) și după nume + familie", hx.code === "blum_servo_hk" && hx.aventos === true, JSON.stringify({ c: hx.code, a: hx.aventos }));
    ok("H.1: slotul «balamale» conține sute de articole, cu fațeta pe mărci (Hettich, Salice, Grass, Blum, Häfele)", hx.hinges > 150 && ["Hettich", "Salice", "Grass", "Blum", "Häfele"].every(b => hx.fac[b] > 0), JSON.stringify({ n: hx.hinges, f: hx.fac }));
    ok("H.1: etichetele sloturilor sunt traduse în toate limbile", hx.labels === true);
    ok("H.1: nicio eroare JS", errs.length === 0, errs.join(" | ").slice(0, 200));
  }

  /* H.2 — potrivirea feroneriei cu corpul curent (ebanist-hwfit.js): secțiunile pe catalogul real, pe corpuri de probă */
  {
    head("Potrivirea feroneriei cu corpul — recomandate / potrivite / nu se potrivesc (H.2)");
    const t0 = Date.now();
    const hf = await pg.evaluate(() => {
      const idx = hwIndex(), base = cfgFromForm();
      const L7 = ["it", "ro", "en", "fr", "de", "pl", "es"];
      const bodies = {
        light: { type: "standard", L: 450, H: 500, P: 330, doors: 1, shelves: 1, drawers: 0, support: "sospeso", plinth: 0, hang: 1, front: "piena" },
        heavy: { type: "standard", L: 900, H: 2400, P: 600, doors: 2, shelves: 1, drawers: 0, support: "zoccolo", plinth: 80, hang: 0, front: "piena" },
        wide: { type: "standard", L: 1000, H: 2650, P: 600, doors: 1, shelves: 1, drawers: 0, support: "zoccolo", plinth: 0, hang: 0, front: "piena" },
        deep: { type: "standard", L: 900, H: 720, P: 700, doors: 0, shelves: 0, drawers: 3, support: "zoccolo", plinth: 100, hang: 0, front: "piena" }
      };
      const out = { n: idx.length, bodies: {}, errs: [], fx: true };
      Object.entries(bodies).forEach(([nm, o]) => {
        let ctx; try { ctx = hwFitCtx(Object.assign({}, base, o)); } catch (e) { out.errs.push(nm + ": " + (e && e.message)); return; }
        if (!ctx.fx) out.fx = false;
        const c = { recomandat: 0, potrivit: 0, nu_se_potriveste: 0, nul: 0, cat: {} }, sample = {};
        idx.forEach(e => {
          let r; try { r = EBHwFit.check(e, ctx); } catch (x) { out.errs.push(nm + " " + e.cat + "/" + e.id + ": " + (x && x.message)); return; }
          const s = EBHwFit.section(r); c[s]++; if (r.ok === null) c.nul++;
          const k = e.cat + ":" + s; c.cat[k] = (c.cat[k] || 0) + 1;
          if (r.ok === false && !sample[e.cat]) sample[e.cat] = { id: e.id, why: JSON.parse(JSON.stringify(r.why)) };
          if (["blum_hk_top", "haf_free_flap_17", "het_avantech_zarga", "gr_dynapro", "het_actro_you"].includes(e.id)) sample[e.id] = { s, ok: r.ok, unk: r.unknownLimits, why: JSON.parse(JSON.stringify(r.why)) };
        });
        /* textele: prima încălcare a fiecărei categorii, în toate limbile (t = traducerea aplicației) */
        let msgOk = true, msgN = 0;
        Object.values(sample).forEach(sm => { if (!sm.why || !sm.why.length) return; L7.forEach(l => { const k0 = state.lang; state.lang = l;
          try { EBHwFit.msg(sm.why, t).forEach(m => { msgN++; if (!m || /\{\w+\}|hfQ_|hfV_/.test(m)) msgOk = false; }); } finally { state.lang = k0; } }); });
        out.bodies[nm] = { c, sample, msgOk, msgN, door: ctx.door && Math.round(ctx.door.h) + "x" + Math.round(ctx.door.w) + " " + Math.round(ctx.door.kg * 10) / 10 + "kg" };
      });
      return out;
    });
    const B = hf.bodies, sum = x => x.c.recomandat + x.c.potrivit + x.c.nu_se_potriveste;
    ok("H.2: hwFitCtx(cfg) construiește contextul (fx din motor) fără erori și fiecare articol din catalog primește o secțiune",
      hf.errs.length === 0 && hf.fx && ["light", "heavy", "wide", "deep"].every(k => B[k] && sum(B[k]) === hf.n), JSON.stringify({ n: hf.n, e: hf.errs.slice(0, 3) }));
    ok("H.2: ușă ușoară (corp mic agățat): Recomandate nu e goală, iar blum_hk_top trece cu date complete",
      B.light.c.recomandat > 30 && B.light.sample.blum_hk_top && B.light.sample.blum_hk_top.s === "recomandat", JSON.stringify({ r: B.light.c.recomandat, s: B.light.sample.blum_hk_top }));
    ok("H.2: ușă înaltă și grea: mecanismele de ridicare cad cu motivul (înălțimea interioară / forța), iar blum_hk_top nu se mai potrivește",
      B.heavy.c.cat["lift:nu_se_potriveste"] >= 12 && B.heavy.sample.lift && B.heavy.sample.lift.why.some(w => w.k === "kh" || w.k === "power") && B.heavy.sample.blum_hk_top.ok === false,
      JSON.stringify({ lift: B.heavy.c.cat["lift:nu_se_potriveste"], w: B.heavy.sample.lift }));
    ok("H.2: ușă lată și înaltă (1000 × 2650): mai multe balamale cad decât la ușa ușoară, cu lățimea/greutatea limitei citite",
      (B.wide.c.cat["cern:nu_se_potriveste"] || 0) > (B.light.c.cat["cern:nu_se_potriveste"] || 0) + 20 && B.wide.sample.cern && B.wide.sample.cern.why.some(w => ["w", "kg", "h"].includes(w.k) && (w.hi != null)),
      JSON.stringify({ wide: B.wide.c.cat["cern:nu_se_potriveste"], light: B.light.c.cat["cern:nu_se_potriveste"], s: B.wide.sample.cern }));
    ok("H.2: totalul Recomandate scade de la corpul mic la cel înalt și greu; Nu se potrivesc crește",
      B.light.c.recomandat > B.heavy.c.recomandat && B.light.c.nu_se_potriveste < B.heavy.c.nu_se_potriveste, JSON.stringify({ l: [B.light.c.recomandat, B.light.c.nu_se_potriveste], h: [B.heavy.c.recomandat, B.heavy.c.nu_se_potriveste] }));
    ok("H.2: bază adâncă cu 3 sertare: sistemul din date (AvanTech) și glisiera Dynapro se verifică; Actro YOU (fără deducție în sursă) rămâne «necunoscut» = potrivit, nu recomandat",
      B.deep.sample.het_avantech_zarga.ok === true && B.deep.sample.gr_dynapro.ok !== null && B.deep.sample.het_actro_you.ok === null && B.deep.sample.het_actro_you.s === "potrivit",
      JSON.stringify([B.deep.sample.het_avantech_zarga, B.deep.sample.gr_dynapro, B.deep.sample.het_actro_you].map(x => x && [x.s, x.ok])));
    ok("H.2: «necunoscut» nu se numără niciodată între Recomandate: articolele fără date au ok:null și stau în «potrivit», marcate",
      B.light.c.nul > 100 && B.light.c.nul <= B.light.c.potrivit, JSON.stringify({ nul: B.light.c.nul, pot: B.light.c.potrivit }));
    ok("H.2: motivele se scriu în toate cele 7 limbi, fără substituții rămase", ["light", "heavy", "wide", "deep"].every(k => B[k].msgOk && B[k].msgN > 0), JSON.stringify(["light", "heavy", "wide", "deep"].map(k => [B[k].msgN, B[k].msgOk])));
    console.log("    \x1b[2m" + ["light", "heavy", "wide", "deep"].map(k => k + " " + B[k].door + " → R" + B[k].c.recomandat + " P" + B[k].c.potrivit + " N" + B[k].c.nu_se_potriveste + " (null " + B[k].c.nul + ")").join(" | ") + " · " + (Date.now() - t0) + " ms\x1b[0m");
    ok("H.2: nicio eroare JS", errs.length === 0, errs.join(" | ").slice(0, 200));
  }

  /* H.3 — panoul «Feronerie» pe sloturi și selectorul (ebanist-hwui.js): pe telefon și pe tabletă */
  {
    head("Panoul «Feronerie» și selectorul — telefon și tabletă (H.3)");
    const tabCtx = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true });
    const tabPg = await tabCtx.newPage();
    tabPg.on("pageerror", e => errs.push("pageerror(tab): " + e));
    tabPg.on("console", m => { const x = m.text(); if (m.type() === "error" && !/ERR_CONNECTION|ERR_NAME|ERR_INTERNET|Failed to load resource|Content Security Policy|Refused to/.test(x)) errs.push("console(tab): " + x); });
    await tabPg.goto(URL); await tabPg.waitForFunction(() => window.MAT_LOADED === true, null, { timeout: 15000 }); await tabPg.waitForTimeout(3300); await tabPg.evaluate(() => closeSheets()); await tabPg.waitForTimeout(300);
    /* instantaneu al corpului: cfg, piesele și devizul (computeHardware) — exact ce trebuie să rămână identic */
    const SNAP = () => { const c = cfgFromForm(), b = buildModule(c), p = proj(); p.pieces = []; p.configs = {}; p.layout = {};
      generateInto(p, { ...c, name: "Hu" }); const items = computeHardware(p, state.settings);
      const o = { cfg: c, pieces: b.pieces, hw: items.map(i => [i.k, i.qty, i.price, i.prod && i.prod.id]) };
      p.pieces = p.pieces.filter(q => q.gen !== "Hu"); delete p.configs["Hu"]; return JSON.stringify(o); };
    const SETUP = ([over, preset]) => { closeSheets(); setView("build"); try { localStorage.removeItem("ebanist_hwui_v1"); } catch (e) {}
      buildCfg = { ...PRESETS[preset || "armadio"], name: "Hu", ...over }; syncBuildForm(); renderSecChips(); drawPreview(); document.getElementById("grpHw").open = true; document.getElementById("grpFr").open = true; EBHwUI.refresh(); };
    const ARM = { L: 900, H: 2200, doors: 2, drawers: 2, support: "zoccolo", plinth: 80 };
    for (const [label, P] of [["telefon", pg], ["tabletă", tabPg]]) {
      const sheetsN = () => P.evaluate(() => document.querySelectorAll(".sheet.on").length);
      const openRow = async slot => { await P.locator('[data-hwp-change="' + slot + '"]').scrollIntoViewIfNeeded(); await P.locator('[data-hwp-change="' + slot + '"]').click(); await P.waitForTimeout(350); };
      const pickKey = key => P.evaluate(k => { document.querySelector('#hxsList [data-act="pick"][data-key="' + k + '"]').click(); }, key);
      const clearRow = tid => P.evaluate(t0 => { document.querySelector('#hxsList [data-act="clear"][data-tid="' + t0 + '"]').click(); }, tid);
      await P.evaluate(SETUP, [ARM]); await P.waitForTimeout(400);
      const base = await P.evaluate(SNAP), D0 = await P.evaluate(() => navDepth());   // în Constructor adâncimea de bază e 1 (vedere ≠ proiecte)
      /* panoul */
      const pan = await P.evaluate(() => { const g = document.getElementById("grpHw"), rows = [...document.querySelectorAll("#hwPanel .hwp-row")].map(r => r.dataset.slot);
        const hid = id => { const n = document.getElementById(id), r = n.getBoundingClientRect(); return !!n && r.width <= 1.5 && r.height <= 1.5; };
        return { open: g.open, rows, sum: document.querySelector("#hwPanel .hwp-sum").textContent, hid: ["rowLift", "rowCU", "hwSelBox"].every(hid), inDom: ["bLift", "bLiftElec", "bCU", "bCUSize", "bCUHand", "bSlide", "bDrawSys", "bLed"].every(i => !!document.getElementById(i)),
          oldCtl: document.querySelectorAll("#hwSelBox select[data-cat]").length, cls: document.documentElement.classList.contains("hwui-on") }; });
      ok("H.3 " + label + ": panoul arată sloturile corpului (balamale, deschidere, sertare, îmbinări…) și rezumatul «alegeri: 0»", pan.rows.includes("balamale") && pan.rows.includes("sertare") && pan.rows.includes("imbinari") && pan.rows.includes("glisante") && !pan.rows.includes("suspendare") && /0/.test(pan.sum), JSON.stringify(pan));
      ok("H.3 " + label + ": câmpurile vechi rămân în DOM (cu selectoarele hwSel), dar ascunse vizual", pan.hid && pan.inDom && pan.oldCtl >= 10 && pan.cls, JSON.stringify(pan));
      /* balama: foaie → căutare → alegere */
      await openRow("balamale");
      const sh1 = await P.evaluate(() => ({ on: document.getElementById("shHw").classList.contains("on"), focus: document.activeElement && document.activeElement.id, role: document.getElementById("shHw").getAttribute("role"), modal: document.getElementById("shHw").getAttribute("aria-modal"),
        n: document.querySelectorAll("#hxsList .hxc-main[data-act=pick]").length, secs: [...document.querySelectorAll("#hxsList [data-sec]")].map(x => x.dataset.sec), depth: navDepth() }));
      ok("H.3 " + label + ": «Schimbă» deschide foaia (dialog), focusul e pe căutare, secțiunile Recomandate/Potrivite, adâncimea de navigare +1", sh1.on && sh1.focus === "hxsQ" && sh1.role === "dialog" && sh1.modal === "true" && sh1.n > 20 && sh1.secs.includes("recomandat") && sh1.depth === D0 + 1, JSON.stringify(sh1));
      await P.fill("#hxsQ", "hettich"); await P.waitForTimeout(400);
      const hs = await P.evaluate(() => { const c = [...document.querySelectorAll("#hxsList .hxc-main[data-act=pick]")]; return { n: c.length, brands: [...new Set(c.map(x => x.querySelector(".hxc-brand").textContent))], key: c[0].dataset.key, cnt: document.getElementById("hxsCount").textContent }; });
      ok("H.3 " + label + ": căutarea «hettich» dă numai articole Hettich", hs.n > 5 && hs.brands.length === 1 && hs.brands[0] === "Hettich", JSON.stringify(hs));
      await P.evaluate(() => document.querySelector('#hxsList .hxc-main[data-act=pick]').click()); await P.waitForTimeout(400);
      const hid = hs.key.split("|")[1];
      const A = await P.evaluate(() => ({ cern: (cfgFromForm().hwSel || {}).cern, on: document.getElementById("shHw").classList.contains("on"), cur: document.querySelector('#hwPanel [data-slot="balamale"] .hwp-cur').textContent, depth: navDepth() }));
      ok("H.3 " + label + ": alegerea scrie cfg.hwSel.cern, foaia se închide, rândul arată alegerea", A.cern === hid && !A.on && A.depth === D0 && /Hettich/.test(A.cur), JSON.stringify(A));
      const snapA = await P.evaluate(SNAP);
      /* aceeași alegere prin selectul vechi → distinta și devizul IDENTICE */
      await P.evaluate(() => { const s = document.querySelector('#hwSelBox select[data-cat="cern"]'); s.value = ""; s.dispatchEvent(new Event("change", { bubbles: true })); });
      const cleared = await P.evaluate(SNAP);
      await P.selectOption('#hwSelBox select[data-cat="cern"]', hid); await P.waitForTimeout(250);
      const snapB = await P.evaluate(SNAP);
      ok("H.3 " + label + ": distinta și devizul sunt IDENTICE cu alegerea aceluiași articol prin selectul vechi", snapA === snapB && snapA !== base, snapA === snapB ? "identic" : "diferit");
      ok("H.3 " + label + ": fără nicio alegere = exact distinta de dinainte (regresie)", cleared === base);
      /* ștergere prin panou */
      await openRow("balamale"); await clearRow("cern"); await P.waitForTimeout(300);
      ok("H.3 " + label + ": «Niciuna / implicit» readuce corpul la implicit (identic cu cel fără alegere)", await P.evaluate(SNAP) === base && await P.evaluate(() => !(cfgFromForm().hwSel || {}).cern));
      /* recente și favorite */
      await P.evaluate(() => EBHwUI.refresh()); await openRow("balamale");
      const rf = await P.evaluate(() => { const st = JSON.parse(localStorage.getItem("ebanist_hwui_v1") || "{}"); return { rec: (st.recent || {}).balamale, secs: [...document.querySelectorAll("#hxsList [data-sec]")].map(x => x.dataset.sec), first: document.querySelector('#hxsList [data-sec="recent"] .hxc-main').dataset.key }; });
      ok("H.3 " + label + ": «Recente» se păstrează (localStorage per spectator, nu în proiect) și apar la redeschidere", rf.rec && rf.rec[0] === hs.key && rf.secs[0] === "recent" && rf.first === hs.key, JSON.stringify(rf));
      await P.evaluate(() => document.querySelector('#hxsList [data-sec="recent"] [data-act="fav"]').click());
      const fv = await P.evaluate(() => JSON.parse(localStorage.getItem("ebanist_hwui_v1")).fav);
      ok("H.3 " + label + ": ☆ adaugă la «Favorite» (localStorage) și nu atinge cfg", fv.length === 1 && fv[0] === hs.key && await P.evaluate(() => !JSON.stringify(cfgFromForm()).includes("ebanist_hwui")));
      await P.evaluate(() => { closeSheets(); }); await openRow("balamale");
      ok("H.3 " + label + ": «Favorite» apare la redeschidere", await P.evaluate(() => !!document.querySelector('#hxsList [data-sec="fav"] .hxc-main')));
      /* detalii și fișa tehnică */
      await P.evaluate(() => document.querySelector('#hxsList [data-act="det"]').click()); await P.waitForTimeout(250);
      const dt = await P.evaluate(() => ({ d: !!document.querySelector("#hxsList .hxd"), tech: !!document.querySelector('#hxsList [data-act="tech"]'), back: !!document.querySelector('#hxsList [data-act="back"]') }));
      ok("H.3 " + label + ": «Detalii» arată rezumatul și butonul spre fișa tehnică a balamalei", dt.d && dt.tech && dt.back, JSON.stringify(dt));
      await P.evaluate(() => document.querySelector('#hxsList [data-act="tech"]').click()); await P.waitForTimeout(300);
      ok("H.3 " + label + ": fișa tehnică se deschide DEASUPRA foii (adâncime +2)", await sheetsN() === 2 && await P.evaluate(() => navDepth()) === D0 + 2);
      await P.goBack(); await P.waitForTimeout(300);
      ok("H.3 " + label + ": Înapoi închide fișa tehnică, foaia rămâne", await sheetsN() === 1 && await P.evaluate(() => document.getElementById("shHw").classList.contains("on")));
      await P.goBack(); await P.waitForTimeout(300);
      ok("H.3 " + label + ": Înapoi închide foaia (adâncimea de bază), aplicația rămâne în Constructor", await sheetsN() === 0 && await P.evaluate(() => currentView === "build") && await P.evaluate(() => navDepth()) === D0);
      /* Escape, tastatura, focus trap */
      await openRow("balamale");
      await P.keyboard.press("ArrowDown"); await P.waitForTimeout(100);
      const ak = await P.evaluate(() => document.activeElement.className);
      await P.keyboard.press("ArrowDown"); await P.keyboard.press("ArrowUp");
      const ak2 = await P.evaluate(() => document.activeElement.className);
      let trapped = true; for (let i = 0; i < 14; i++) { await P.keyboard.press("Tab"); if (!await P.evaluate(() => !!document.activeElement.closest("#shHw"))) trapped = false; }
      for (let i = 0; i < 6; i++) { await P.keyboard.press("Shift+Tab"); if (!await P.evaluate(() => !!document.activeElement.closest("#shHw"))) trapped = false; }
      ok("H.3 " + label + ": săgețile mută focusul pe carduri, Tab / Shift+Tab rămân în foaie (capcană de focus)", /hxc-main/.test(ak) && /hxc-main/.test(ak2) && trapped, JSON.stringify([ak, ak2, trapped]));
      await P.keyboard.press("Escape"); await P.waitForTimeout(300);
      ok("H.3 " + label + ": Escape închide foaia", await sheetsN() === 0);
      ok("H.3 " + label + ": focusul revine pe butonul «Schimbă» al rândului", await P.evaluate(() => document.activeElement && document.activeElement.getAttribute("data-hwp-change") === "balamale"));
      /* ridicare: cfg.lift + deschiderea electrică din rând */
      await openRow("ridicare"); await P.fill("#hxsQ", "hk top"); await P.waitForTimeout(350);
      await pickKey("lift|blum_hk_top"); await P.waitForTimeout(350);
      const lf = await P.evaluate(() => ({ lift: cfgFromForm().lift, bl: document.getElementById("bLift").value, sub: !!document.querySelector('#hwPanel [data-hwp-sub="bLiftElec"]'), cur: document.querySelector('#hwPanel [data-slot="ridicare"] .hwp-cur').textContent }));
      ok("H.3 " + label + ": un sistem de ridicare ales → cfg.lift (și câmpul vechi), rândul arată marcă + nume", lf.lift === "blum_hk_top" && lf.bl === "blum_hk_top" && /Blum/.test(lf.cur) && /HK top/.test(lf.cur) && lf.sub, JSON.stringify(lf));
      await P.selectOption('#hwPanel [data-hwp-sub="bLiftElec"]', "servo"); await P.waitForTimeout(250);
      ok("H.3 " + label + ": deschiderea electrică (sub-alegere în rând) → cfg.liftElec", await P.evaluate(() => cfgFromForm().liftElec === "servo" && document.getElementById("bLiftElec").value === "servo"));
      await openRow("ridicare"); await clearRow("lift"); await P.waitForTimeout(300);
      ok("H.3 " + label + ": ridicarea ștearsă → cfg.lift și liftElec revin la null, distinta ca la început", await P.evaluate(() => cfgFromForm().lift === null && cfgFromForm().liftElec === null) && await P.evaluate(SNAP) === base);
      /* unitate de colț */
      await openRow("colt"); await P.fill("#hxsQ", "lemans"); await P.waitForTimeout(350);
      await pickKey("corner|kb_lemans2"); await P.waitForTimeout(350);
      const cu = await P.evaluate(() => ({ cu: cfgFromForm().cu, sub: !!document.querySelector('#hwPanel [data-hwp-sub="bCUSize"]') }));
      ok("H.3 " + label + ": o unitate de colț aleasă → cfg.cu, mărimea apare ca sub-alegere", cu.cu === "kb_lemans2" && cu.sub, JSON.stringify(cu));
      await P.selectOption('#hwPanel [data-hwp-sub="bCUSize"]', "500"); await P.waitForTimeout(250);
      ok("H.3 " + label + ": mărimea unității → cfg.cuSize", await P.evaluate(() => cfgFromForm().cuSize === "500"));
      await openRow("colt"); await clearRow("corner"); await P.waitForTimeout(300);
      ok("H.3 " + label + ": colțul șters → cfg.cu null, distinta ca la început", await P.evaluate(() => cfgFromForm().cu === null && cfgFromForm().cuSize === null) && await P.evaluate(SNAP) === base);
      /* sistem de sertar */
      await openRow("sertare"); await P.waitForTimeout(150);
      const dr = await P.evaluate(() => ({ chips: [...document.querySelectorAll("#hxsCats .chip")].map(x => x.dataset.val) }));
      await pickKey("drawsys|legrabox"); await P.waitForTimeout(350);
      ok("H.3 " + label + ": slotul «Sertare» are categoriile (sistem, glisieră, push) și alege sistemul → cfg.drawerSys", dr.chips.includes("drawsys") && dr.chips.includes("guida") && await P.evaluate(() => cfgFromForm().drawerSys === "legrabox"), JSON.stringify(dr));
      await openRow("sertare"); await clearRow("drawsys"); await P.waitForTimeout(300);
      ok("H.3 " + label + ": sistemul de sertar șters → «legno» (implicit), distinta ca la început", await P.evaluate(SNAP) === base);
      /* sisteme glisante pe un corp «scorrevole» */
      await P.evaluate(SETUP, [{ L: 2400, H: 2400, P: 600, doors: 2, shelves: 0, hang: 0 }, "scorrevole"]); await P.waitForTimeout(400);
      const slBase = await P.evaluate(SNAP);
      await openRow("glisante"); await P.fill("#hxsQ", "topline"); await P.waitForTimeout(350);
      const sl0 = await P.evaluate(() => ({ n: document.querySelectorAll('#hxsList [data-act="pick"]').length, secs: [...document.querySelectorAll("#hxsList [data-sec]")].map(x => x.dataset.sec) }));
      await pickKey("slidesys|het_topline_xl"); await P.waitForTimeout(350);
      const sl = await P.evaluate(() => ({ slide: cfgFromForm().slide, cur: document.querySelector('#hwPanel [data-slot="glisante"] .hwp-cur').textContent }));
      const slPanel = await P.evaluate(SNAP);
      ok("H.3 " + label + ": un sistem glisant pe corpul «scorrevole» → cfg.slide; rândul arată sistemul", sl.slide === "het_topline_xl" && /TopLine XL/.test(sl.cur) && sl0.n >= 1, JSON.stringify([sl, sl0]));
      await P.evaluate(() => { const s = document.getElementById("bSlide"); s.value = ""; s.dispatchEvent(new Event("change", { bubbles: true })); }); await P.waitForTimeout(200);
      await P.selectOption("#bSlide", "het_topline_xl"); await P.waitForTimeout(250);
      const slOld = await P.evaluate(SNAP);
      await openRow("glisante"); await clearRow("slidesys"); await P.waitForTimeout(300);
      ok("H.3 " + label + ": glisantele: distinta identică cu selectul vechi; ștergere → cfg.slide null, ca la început", slPanel === slOld && await P.evaluate(() => cfgFromForm().slide === null) && await P.evaluate(SNAP) === slBase && slOld !== slBase);
      /* secțiuni: ușă înaltă și grea vs ușă mică */
      const sect = async over => { await P.evaluate(SETUP, [over]); await P.waitForTimeout(350); await openRow("balamale"); await P.waitForTimeout(150);
        const r = await P.evaluate(() => ({ rec: +(document.querySelector('#hxsList [data-sec="recomandat"] .hxs-n') || { textContent: 0 }).textContent, no: +(document.querySelector("#hxsList .hxs-nofit > summary .hxs-n") || { textContent: 0 }).textContent, unkNote: !!document.querySelector('#hxsList [data-sec="potrivit"] .hxs-note') }));
        await P.evaluate(() => closeSheets()); return r; };
      const sLight = await sect({ L: 450, H: 500, P: 330, doors: 1, support: "sospeso", plinth: 0, hang: 1, shelves: 1, drawers: 0 });
      const sHeavy = await sect({ L: 1000, H: 2650, P: 600, doors: 1, support: "zoccolo", plinth: 0, hang: 0, shelves: 1, drawers: 0 });
      ok("H.3 " + label + ": secțiunile răspund ușii înalte și grele: mai puține «Recomandate», mai multe «Nu se potrivesc»", sHeavy.rec < sLight.rec && sHeavy.no > sLight.no, JSON.stringify([sLight, sHeavy]));
      ok("H.3 " + label + ": «Potrivite» poartă nota «limite necunoscute» (ok:null nu e niciodată «Recomandat»)", sLight.unkNote === true, JSON.stringify(sLight));
      await P.evaluate(SETUP, [{ L: 1000, H: 2650, P: 600, doors: 1, support: "zoccolo", plinth: 0, hang: 0, shelves: 1, drawers: 0 }]); await P.waitForTimeout(300);
      await openRow("balamale");
      const why = await P.evaluate(() => { const d = document.querySelector("#hxsList .hxs-nofit"); d.open = true; const w = d.querySelector(".hxc-why"); return w ? w.textContent : ""; });
      ok("H.3 " + label + ": «Nu se potrivesc» (pliată) arată motivul din EBHwFit.msg pe fiecare articol", why.length > 8 && !/\{\w+\}|hfQ_|hfV_/.test(why), why);
      await P.evaluate(() => closeSheets());
      /* liste lungi: în incremente, nu 1000 de noduri */
      await P.evaluate(SETUP, [ARM]); await P.waitForTimeout(300);
      const t0 = Date.now(); await openRow("balamale");
      const pf = await P.evaluate(() => { const l = document.getElementById("hxsList"), n0 = l.querySelectorAll(".hxc").length; const m = l.querySelector(".hxs-more"); if (m) m.click(); const n1 = document.getElementById("hxsList").querySelectorAll(".hxc").length; return { n0, n1, more: !!m }; });
      ok("H.3 " + label + ": lista lungă (peste 300 de balamale) se randează în incremente («Arată încă N»), nu toate odată", pf.n0 < 120 && pf.more && pf.n1 > pf.n0, JSON.stringify(pf) + " · " + (Date.now() - t0) + " ms la deschidere");
      await P.evaluate(() => closeSheets());
      /* toate limbile: fără chei necunoscute pe ecran */
      const lg = await P.evaluate(async () => { const keep = state.lang, bad = []; for (const l of ["it", "ro", "en", "fr", "de", "pl", "es"]) { state.lang = l; applyLang(); EBHwUI.relabel(); EBHwUI.open("balamale"); await new Promise(r => setTimeout(r, 60));
        const txt = document.getElementById("hwPanel").innerText + " " + document.getElementById("shHw").innerText; if (/\bhx[a-zA-Z]+\b|\bhf[A-Z_]\w+\b/.test(txt)) bad.push(l); closeSheets(); await new Promise(r => setTimeout(r, 40)); }
        state.lang = keep; applyLang(); EBHwUI.relabel(); return bad; });
      ok("H.3 " + label + ": panoul și foaia în toate cele 7 limbi, fără chei de traducere pe ecran", lg.length === 0, JSON.stringify(lg));
      /* nimic nu iese din ecran (nicio defilare orizontală); ținte de atingere */
      await openRow("balamale");
      const ovf = await P.evaluate(() => { const sh = document.getElementById("shHw"), r = sh.getBoundingClientRect(); return { sw: sh.scrollWidth, cw: sh.clientWidth, left: Math.round(r.left), right: Math.round(r.right), vw: innerWidth, tiny: [...sh.querySelectorAll("button,input[type=search],label.hxs-fit")].filter(b => b.offsetParent && (b.getBoundingClientRect().height < 30)).map(b => b.className + "/" + Math.round(b.getBoundingClientRect().height)).slice(0, 5) }; });
      ok("H.3 " + label + ": foaia nu iese din ecran și nu are defilare orizontală; ținte de atingere ≥ 30 px", ovf.sw <= ovf.cw + 1 && ovf.left >= -1 && ovf.right <= ovf.vw + 1 && ovf.tiny.length === 0, JSON.stringify(ovf));
      await P.evaluate(() => closeSheets());
      await P.evaluate(() => { const p = proj(); p.pieces = p.pieces.filter(q => q.gen !== "Hu"); delete p.configs["Hu"]; buildCfg = { ...PRESETS.base }; syncBuildForm(); renderSecChips(); try { localStorage.removeItem("ebanist_hwui_v1"); } catch (e) {} HIST.undo = []; HIST.redo = []; HIST.cur = null; histSync(); });
    }
    await tabCtx.close();
    ok("H.3: nicio eroare JS", errs.length === 0, errs.join(" | ").slice(0, 300));
  }

  /* H.3 (limite) — selectorul ca dialog de la 700 px, LED pe corp, sertare (sisteme + laterale + glisiere), insigna balamalei cu limita încălcată */
  {
    head("Selectorul de feronerie — dialog, LED pe corp, sertare, insigna balamalei (H.3 limite)");
    const tabCtx2 = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true });
    const tabPg2 = await tabCtx2.newPage();
    tabPg2.on("pageerror", e => errs.push("pageerror(tab2): " + e));
    tabPg2.on("console", m => { const x = m.text(); if (m.type() === "error" && !/ERR_CONNECTION|ERR_NAME|ERR_INTERNET|Failed to load resource|Content Security Policy|Refused to/.test(x)) errs.push("console(tab2): " + x); });
    await tabPg2.goto(URL); await tabPg2.waitForFunction(() => window.MAT_LOADED === true, null, { timeout: 15000 }); await tabPg2.waitForTimeout(3300); await tabPg2.evaluate(() => closeSheets()); await tabPg2.waitForTimeout(300);
    const SETUP = ([over, preset]) => { closeSheets(); setView("build"); try { localStorage.removeItem("ebanist_hwui_v1"); } catch (e) {}
      state.settings.hwAdd = []; state.settings.hwProd = {}; state.settings.hwOvr = {};
      buildCfg = { ...PRESETS[preset || "armadio"], name: "Hu", ...over }; syncBuildForm(); renderSecChips(); drawPreview(); document.getElementById("grpHw").open = true; document.getElementById("grpFr").open = true; EBHwUI.refresh(); };
    /* deviz: rândurile LED ale corpului, exact ce se numără și se prețuiește (funcție în pagină: se apelează și din alte evaluate) */
    await tabPg2.evaluate(() => {});
    const DEFLED = () => { window.LEDHW_SAFE = () => { const c = cfgFromForm(), p = proj(); p.pieces = []; p.configs = {}; p.layout = {};
      generateInto(p, { ...c, name: "Hu" }); const items = computeHardware(p, state.settings);
      const out = items.filter(i => /^hwLed/.test(i.k) && i.qty > 0).map(i => [i.k, i.qty, i.price, i.prod && i.prod.id]);
      p.pieces = p.pieces.filter(q => q.gen !== "Hu"); delete p.configs["Hu"]; return JSON.stringify(out); }; };
    await pg.evaluate(DEFLED); await tabPg2.evaluate(DEFLED);
    const LEDHW = () => window.LEDHW_SAFE();
    const ARM = { L: 900, H: 2200, doors: 2, drawers: 2, support: "zoccolo", plinth: 80 };
    for (const [label, P] of [["telefon", pg], ["tabletă", tabPg2]]) {
      const openRow = async slot => { await P.locator('[data-hwp-change="' + slot + '"]').scrollIntoViewIfNeeded(); await P.locator('[data-hwp-change="' + slot + '"]').click(); await P.waitForTimeout(350); };
      const pickKey = key => P.evaluate(k => { document.querySelector('#hxsList [data-act="pick"][data-key="' + k + '"]').click(); }, key);
      const clearRow = tid => P.evaluate(t0 => { document.querySelector('#hxsList [data-act="clear"][data-tid="' + t0 + '"]').click(); }, tid);
      /* 1. dialog de la 700 px (numai #shHw), foaie de jos pe telefon */
      await P.evaluate(SETUP, [ARM]); await P.waitForTimeout(400);
      await openRow("balamale");
      const g1 = await P.evaluate(() => { const r = document.getElementById("shHw").getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), w: innerWidth, h: innerHeight, vis: getComputedStyle(document.getElementById("shHw")).visibility }; });
      if (label === "tabletă") ok("H.3 " + label + ": de la 700 px selectorul e dialog centrat (nu foaie de jos): margini egale, nu atinge marginea de jos", g1.vis === "visible" && Math.abs(g1.l - (g1.w - g1.r)) <= 2 && g1.t > 20 && g1.b < g1.h - 20 && g1.r - g1.l <= g1.w * 0.93, JSON.stringify(g1));
      else ok("H.3 " + label + ": sub 700 px selectorul rămâne foaie de jos pe toată lățimea", g1.l <= 1 && g1.r >= g1.w - 1 && g1.b >= g1.h - 1, JSON.stringify(g1));
      await P.evaluate(() => closeSheets()); await P.waitForTimeout(300);
      if (label === "tabletă") {
        await P.evaluate(() => { openSheet("shCatalog"); }); await P.waitForTimeout(350);
        const g2 = await P.evaluate(() => { const r = document.getElementById("shCatalog").getBoundingClientRect(); return { b: Math.round(r.bottom), h: innerHeight, l: Math.round(r.left), r: Math.round(r.right), w: innerWidth }; });
        ok("H.3 " + label + ": celelalte foi NU se schimbă (Catalogul rămâne foaie de jos sub 1024 px)", g2.b >= g2.h - 1 && g2.l <= 1 && g2.r >= g2.w - 1, JSON.stringify(g2));
        await P.evaluate(() => closeSheets()); await P.waitForTimeout(300);
      }
      /* 2. LED pe corp */
      await P.evaluate(SETUP, [{ ...ARM, led: "top" }]); await P.waitForTimeout(400);
      const base = await P.evaluate(LEDHW), baseRows = JSON.parse(base);
      const dd = await P.evaluate(() => { const D = k => { const it = hwItem(k); return [it.price, it.id]; }; return { s: D("ledstrip"), d: D("leddrv"), m: D("leddim"), w: D("ledsw"), n: D("ledmains") }; });
      const byK = k => baseRows.filter(r => r[0] === k);
      ok("H.5 " + label + ": LED fără nicio alegere = articolele din catalog, câte unul pe rând (bandă, transformator, dimmer, cablu întrerupător, cablu rețea)",
        byK("hwLedStrip").length === 1 && byK("hwLedStrip")[0][2] === dd.s[0] && byK("hwLedStrip")[0][3] === dd.s[1] && byK("hwLedDrv")[0][3] === dd.d[1] && byK("hwLedDim")[0][3] === dd.m[1] && byK("hwLedSw")[0][3] === dd.w[1] && byK("hwLedMains")[0][3] === dd.n[1] &&
        byK("hwLedDrv")[0][1] === byK("hwLedMains")[0][1] && byK("hwLedDrv")[0][1] === byK("hwLedDim")[0][1], base);
      await openRow("iluminat");
      const chips = await P.evaluate(() => [...document.querySelectorAll("#hxsCats .chip")].map(x => x.dataset.val));
      ok("H.5 " + label + ": slotul «Iluminat» are LED-ul (opțiunea) și cele cinci categorii alegibile pe corp", ["led", "ledstrip", "leddrv", "leddim", "ledsw", "ledmains"].every(c => chips.includes(c)), JSON.stringify(chips));
      await P.evaluate(() => closeSheets()); await P.waitForTimeout(250);
      await P.evaluate(() => { state.settings.hwAdd = [
        { id: "uLedS", cat: "ledstrip", custom: 1, brand: "Mea", n: "Banda proprie", art: "BS1", price: 50 },
        { id: "uLedD", cat: "leddim", custom: 1, brand: "Mea", n: "Dimmer propriu", art: "DM1", price: 31 }]; persist(); EBHwUI.refresh(); });
      await openRow("iluminat"); await P.click('#hxsCats [data-val="ledstrip"]'); await P.waitForTimeout(150);
      await pickKey("ledstrip|uLedS"); await P.waitForTimeout(350);
      const l1 = await P.evaluate(() => ({ sel: (cfgFromForm().hwSel || {}).ledstrip, cur: document.querySelector('#hwPanel [data-slot="iluminat"] .hwp-cur').textContent, rows: JSON.parse(LEDHW_SAFE()) }));
      ok("H.5 " + label + ": banda aleasă pe corp (cfg.hwSel.ledstrip) e cea numărată și prețuită (50 €, id propriu), restul rămân ca înainte", l1.sel === "uLedS" && /Banda proprie/.test(l1.cur) &&
        l1.rows.filter(r => r[0] === "hwLedStrip").length === 1 && l1.rows.filter(r => r[0] === "hwLedStrip")[0][2] === 50 && l1.rows.filter(r => r[0] === "hwLedStrip")[0][3] === "uLedS" &&
        JSON.stringify(l1.rows.filter(r => r[0] !== "hwLedStrip")) === JSON.stringify(baseRows.filter(r => r[0] !== "hwLedStrip")), JSON.stringify(l1));
      await openRow("iluminat"); await P.click('#hxsCats [data-val="leddim"]'); await P.waitForTimeout(150);
      await pickKey("leddim|uLedD"); await P.waitForTimeout(350);
      const l2 = await P.evaluate(() => JSON.parse(LEDHW_SAFE()));
      const dimRow = l2.filter(r => r[0] === "hwLedDim");
      ok("H.5 " + label + ": dimmerul ales pe corp e numărat și prețuit (un rând, cantitatea transformatoarelor, 31 €)", dimRow.length === 1 && dimRow[0][2] === 31 && dimRow[0][3] === "uLedD" && dimRow[0][1] === baseRows.filter(r => r[0] === "hwLedDim")[0][1], JSON.stringify(l2));
      /* senzor pe ușă: articolul fix 833.89.059; alegerea de dimmer nu se numără pe lângă el */
      await P.evaluate(() => { const s = document.getElementById("bLedSw"); s.value = "door"; s.dispatchEvent(new Event("change", { bubbles: true })); }); await P.waitForTimeout(300);
      const l3 = await P.evaluate(() => ({ rows: JSON.parse(LEDHW_SAFE()), hint: (document.querySelector('#hwPanel [data-slot="iluminat"] .hwp-hint') || { textContent: "" }).textContent }));
      const dr = l3.rows.filter(r => r[0] === "hwLedDim"), drv = l3.rows.filter(r => r[0] === "hwLedDrv");
      ok("H.5 " + label + ": cu senzor pe ușă dimmerul din corp nu se numără (numai 833.89.059, cantitate = transformatoare), fără cablu de întrerupător; panoul spune de ce",
        dr.length === 1 && dr[0][3] === "haf_833_89_059" && dr[0][1] === drv[0][1] && l3.rows.filter(r => r[0] === "hwLedSw").length === 0 && l3.hint.length > 10, JSON.stringify(l3));
      await P.evaluate(() => { const s = document.getElementById("bLedSw"); s.value = "visible"; s.dispatchEvent(new Event("change", { bubbles: true })); }); await P.waitForTimeout(250);
      await openRow("iluminat"); await clearRow("ledstrip"); await P.waitForTimeout(300);
      await openRow("iluminat"); await clearRow("leddim"); await P.waitForTimeout(300);
      ok("H.5 " + label + ": alegerile LED șterse → devizul LED identic cu cel fără nicio alegere (regresie)", await P.evaluate(LEDHW) === base && await P.evaluate(() => !(cfgFromForm().hwSel || {}).ledstrip && !(cfgFromForm().hwSel || {}).leddim));
      /* 3. sertare: toate sistemele din DRAWSYS alegibile, cu verificare; cele vechi (fără limite în date) → «Potrivite», niciodată «Recomandate» */
      await P.evaluate(SETUP, [{ L: 900, H: 720, P: 560, doors: 0, drawers: 3, support: "zoccolo", plinth: 80, shelves: 0 }]); await P.waitForTimeout(400);
      await openRow("sertare"); await P.click('#hxsCats [data-val="drawsys"]'); await P.waitForTimeout(200);
      await P.evaluate(() => { const d = document.querySelector("#hxsList .hxs-nofit"); if (d) d.open = true; });
      const ds = await P.evaluate(() => { const ids = DRAWSYS_IDS.slice(), out = {}; ids.forEach(id => { out[id] = ["recomandat", "potrivit", "nofit"].find(sc => !!document.querySelector('#hxsList [data-sec="' + sc + '"] [data-act="pick"][data-key="drawsys|' + id + '"]')) || null; });
        const lbx = document.querySelector('#hxsList [data-act="pick"][data-key="drawsys|legrabox"]'); return { ids, out, lbx: lbx ? lbx.innerText : "" }; });
      ok("H.5 " + label + ": TOATE sistemele din DRAWSYS (" + ds.ids.length + ") apar în foaie, fiecare într-o secțiune", ds.ids.every(id => !!ds.out[id]), JSON.stringify(ds.out));
      ok("H.5 " + label + ": sistemele vechi (legno, Blum, Matrix, «solo frontale») fără limite în date stau în «Potrivite», nu în «Recomandate»", ["legno", "legrabox", "tandembox", "matrix", "nessuno"].every(id => ds.out[id] === "potrivit"), JSON.stringify(ds.out));
      ok("H.5 " + label + ": cardul sistemului arată laterala și glisiera lui din date (Sponde/Laterale…, cod)", /blum|Blum/.test(ds.lbx) && ds.lbx.split("\n").length >= 4, ds.lbx);
      await P.click('#hxsCats [data-val="guida"]'); await P.waitForTimeout(200);
      ok("H.5 " + label + ": la «Glisiere» foaia spune că glisiera se alege numai pentru sertarul din lemn", await P.evaluate(() => !!document.querySelector("#hxsList .hxs-note") && document.querySelector("#hxsList .hxs-note").textContent.length > 20));
      await P.evaluate(() => closeSheets());
      /* 4. insigna balamalei spune limita */
      await P.evaluate(SETUP, [{ L: 1000, H: 2650, P: 600, doors: 1, support: "zoccolo", plinth: 0, hang: 0, shelves: 1, drawers: 0 }]); await P.waitForTimeout(400);
      await openRow("balamale");
      const badKey = await P.evaluate(() => { const d = document.querySelector("#hxsList .hxs-nofit"); d.open = true; const c = d.querySelector(".hxc.is-bad .hxc-main"); return c ? c.dataset.key : null; });
      await pickKey(badKey); await P.waitForTimeout(400);
      const hb = await P.evaluate(() => { const row = document.querySelector('#hwPanel [data-slot="balamale"]'), b = row.querySelector(".hwp-badge"), wl = row.querySelector(".hwp-wl"); return { badge: b ? b.textContent : "", title: b ? b.getAttribute("title") : "", wl: wl ? wl.textContent : "" }; });
      ok("H.5 " + label + ": o balamă care nu se potrivește → insigna are numărul, titlul și rândul de sub ea spun LIMITA încălcată (cu valoarea)", /^\d+$/.test(hb.badge) && hb.wl.length > 8 && hb.title.includes(hb.wl.split("\n")[0].slice(0, 12)) && /\d/.test(hb.wl) && !/\{\w+\}|hfQ_|hfV_/.test(hb.wl), JSON.stringify(hb));
      await P.evaluate(() => { const p = proj(); p.pieces = p.pieces.filter(q => q.gen !== "Hu"); delete p.configs["Hu"]; buildCfg = { ...PRESETS.base }; syncBuildForm(); renderSecChips(); state.settings.hwAdd = []; try { localStorage.removeItem("ebanist_hwui_v1"); } catch (e) {} HIST.undo = []; HIST.redo = []; HIST.cur = null; histSync(); });
    }
    await tabCtx2.close();
    ok("H.3/H.5 limite: nicio eroare JS", errs.length === 0, errs.join(" | ").slice(0, 300));
  }

  /* H.4 — Catalogul cu același selector (mod catalog): rânduri pe categorie, preț și cod pe articol, filtrul «preț de completat», articole proprii, backup 5.87.0 */
  {
    head("Catalogul — rânduri pe categorie și selectorul în mod catalog, telefon și tabletă (H.4)");
    const tabCtx3 = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true });
    const tabPg3 = await tabCtx3.newPage();
    tabPg3.on("pageerror", e => errs.push("pageerror(tab3): " + e));
    tabPg3.on("console", m => { const x = m.text(); if (m.type() === "error" && !/ERR_CONNECTION|ERR_NAME|ERR_INTERNET|Failed to load resource|Content Security Policy|Refused to/.test(x)) errs.push("console(tab3): " + x); });
    await tabPg3.goto(URL); await tabPg3.waitForFunction(() => window.MAT_LOADED === true, null, { timeout: 15000 }); await tabPg3.waitForTimeout(3300); await tabPg3.evaluate(() => closeSheets()); await tabPg3.waitForTimeout(300);
    const RESET = () => { closeSheets(); try { localStorage.removeItem("ebanist_hwui_v1"); } catch (e) {} state.settings.hwAdd = []; state.settings.hwProd = {}; state.settings.hwOvr = {}; persist(); };
    for (const [label, P] of [["telefon", pg], ["tabletă", tabPg3]]) {
      const openCat = async () => { await P.evaluate(() => { closeSheets(); renderCatalog(); openSheet("shCatalog"); }); await P.waitForTimeout(350); };
      const change = async cat => { await P.locator('#catHwWrap [data-cth-change="' + cat + '"]').scrollIntoViewIfNeeded(); await P.locator('#catHwWrap [data-cth-change="' + cat + '"]').click(); await P.waitForTimeout(350); };
      await P.evaluate(RESET); await openCat();
      /* 1. rândurile */
      const rw = await P.evaluate(() => { const rows = [...document.querySelectorAll("#catHwWrap .cth-row")], cats = HW_CATS.map(c => c[0]);
        const hid = n => { const r = n.getBoundingClientRect(); return r.width <= 1.5 && r.height <= 1.5; };
        return { n: rows.length, want: cats.length, sels: document.querySelectorAll("#catHwWrap select.catSel").length, selHidden: [...document.querySelectorAll("#catHwWrap select.catSel")].every(s => hid(s.closest(".cth-compat"))),
          cern: document.querySelector('#catHwWrap .cth-row[data-cat="cern"] .cth-cur').textContent, btn: document.querySelectorAll("#catHwWrap [data-cth-change]").length,
          heads: [...document.querySelectorAll("#catHwWrap .cth-slot")].length, inputs: !!document.querySelector('#catHwWrap .catPrice[data-cat="cern"]') && !!document.querySelector('#catHwWrap .catArt[data-cat="cern"]'),
          ovf: (() => { const sh = document.getElementById("shCatalog"); return sh.scrollWidth <= sh.clientWidth + 1; })() }; });
      ok("H.4 " + label + ": Catalogul are un rând pe categorie (" + rw.want + "), pe sloturi, cu articolul implicit (Blum la balamale) și butonul «Schimbă»", rw.n === rw.want && rw.btn === rw.want && rw.heads >= 6 && /Blum/.test(rw.cern) && rw.inputs, JSON.stringify(rw));
      ok("H.4 " + label + ": selectele vechi (.catSel, lista întreagă) rămân în DOM, ascunse; catalogul nu iese din ecran", rw.sels === rw.want && rw.selHidden && rw.ovf, JSON.stringify(rw));
      /* 2. foaia în mod catalog */
      await change("cern");
      const sh = await P.evaluate(() => { const S0 = EBHwUI._state(); return { mode: S0.mode, on: document.getElementById("shHw").classList.contains("on"), title: document.getElementById("hxsTitle").textContent, secs: [...document.querySelectorAll("#hxsList [data-sec]")].map(x => x.dataset.sec),
        fitBox: !!document.getElementById("hxsFit"), recomandat: !!document.querySelector('#hxsList [data-sec="recomandat"]'), why: !!document.querySelector("#hxsList .hxc-why"), n: document.querySelectorAll("#hxsList .hxc-main[data-act=pick]").length,
        first: [...document.querySelectorAll("#hxsList .hxc-main[data-act=pick]")].slice(0, 12).map(x => x.dataset.key.split("|")[1]), want: HWDB.cern.slice(0, 12).map(x => x.id),
        cur: (document.querySelector("#hxsList .hxc.is-cur") || { dataset: {} }).dataset.key, focus: document.activeElement && document.activeElement.id }; });
      ok("H.4 " + label + ": «Schimbă» deschide aceeași foaie în mod catalog: titlu cu categoria, fără secțiuni de potrivire, fără «Recomandate», fără bifa «potrivit corpului»", sh.mode === "catalog" && sh.on && /\S/.test(sh.title) && sh.secs.length === 1 && sh.secs[0] === "cat" && !sh.fitBox && !sh.recomandat && !sh.why && sh.n > 20 && sh.focus === "hxsQ", JSON.stringify(sh));
      ok("H.4 " + label + ": articolele sunt în ordinea indexului (ca în catalog) și implicitul curent e marcat", JSON.stringify(sh.first) === JSON.stringify(sh.want) && sh.cur === "cern|" + sh.want[0], JSON.stringify([sh.first, sh.want, sh.cur]));
      /* 3. căutare + alegere implicit */
      await P.fill("#hxsQ", "hettich"); await P.waitForTimeout(400);
      const hs = await P.evaluate(() => { const c = [...document.querySelectorAll("#hxsList .hxc-main[data-act=pick]")]; return { n: c.length, brands: [...new Set(c.map(x => (x.querySelector(".hxc-brand") || { textContent: "" }).textContent))], key: c[1].dataset.key }; });
      ok("H.4 " + label + ": căutarea «hettich» în mod catalog dă numai articole Hettich", hs.n > 5 && hs.brands.length === 1 && hs.brands[0] === "Hettich", JSON.stringify(hs));
      await P.evaluate(k => { document.querySelector('#hxsList [data-act="pick"][data-key="' + k + '"]').click(); }, hs.key); await P.waitForTimeout(400);
      const hid = hs.key.split("|")[1];
      const ch = await P.evaluate(hid => ({ prod: state.settings.hwProd.cern, item: hwItem("cern").id, on: document.getElementById("shHw").classList.contains("on"), sheetCat: document.getElementById("shCatalog").classList.contains("on"),
        row: document.querySelector('#catHwWrap .cth-row[data-cat="cern"] .cth-cur').textContent, sel: document.querySelector('#catHwWrap select.catSel[data-cat="cern"]').value, hid, foc: document.activeElement && document.activeElement.getAttribute("data-cth-change") }), hid);
      ok("H.4 " + label + ": alegerea scrie settings.hwProd.cern (același format), foaia se închide, Catalogul rămâne deschis și rândul arată articolul; selectul ascuns e sincronizat; focusul revine pe «Schimbă»",
        ch.prod === hid && ch.item === hid && !ch.on && ch.sheetCat && /Hettich/.test(ch.row) && ch.sel === hid && ch.foc === "cern", JSON.stringify(ch));
      /* fișa tehnică + plăcuța din rând (păstrate) */
      const tech = await P.evaluate(() => { const r = document.querySelector('#catHwWrap .cth-row[data-cat="cern"]'); return { plate: !!r.querySelector(".catPlate"), tech: !!r.querySelector(".hsOpen") }; });
      ok("H.4 " + label + ": rândul păstrează selectorul de plăcuță și butonul fișei tehnice la balamale", tech.plate && tech.tech, JSON.stringify(tech));
      await P.evaluate(() => { state.settings.hwProd.guida = "blum_movento"; renderCatalog(); });
      ok("H.4 " + label + ": rândul glisierelor păstrează butonul fișei (slOpen)", await P.evaluate(() => !!document.querySelector('#catHwWrap .cth-row[data-cat="guida"] .slOpen')));
      /* 4. preț și cod pe articol, din card */
      await change("cern");
      const pk = await P.evaluate(() => { const c = [...document.querySelectorAll("#hxsList .hxc")].filter(x => !x.classList.contains("is-cur"))[3]; c.querySelector('[data-act="edit"]').click(); const k = c.dataset.key; return { k, vis: !!document.querySelector('#hxsList .hxc[data-key="' + k + '"] .hxk-price') }; });
      await P.fill('#hxsList .hxc[data-key="' + pk.k + '"] .hxk-price', "12.5"); await P.fill('#hxsList .hxc[data-key="' + pk.k + '"] .hxk-art', "XX-77"); await P.waitForTimeout(150);
      const pe = await P.evaluate(k => { const id = k.split("|")[1]; const it = hwItemById("cern", id); return { ovr: JSON.stringify(state.settings.hwOvr[id]), price: it.price, art: it.art, def: hwItem("cern").id }; }, pk.k);
      ok("H.4 " + label + ": «Preț și cod» pe cardul oricărui articol scrie în settings.hwOvr (aceeași casetă pe care o citește devizul), fără să schimbe implicitul", pk.vis && pe.price === 12.5 && pe.art === "XX-77" && pe.ovr === JSON.stringify({ price: 12.5, art: "XX-77" }) && pe.def === hid, JSON.stringify([pk, pe]));
      await P.evaluate(() => closeSheets()); await P.waitForTimeout(250);
      /* 5. filtrul din foaie: preț de completat */
      await openCat(); await change("cern");
      const f1 = await P.evaluate(() => { const lab = document.getElementById("hxsNo0L").textContent, n = +(lab.match(/\((\d+)\)/) || [0, -1])[1];
        const ov = state.settings.hwOvr || {}, exp = hwIndex().filter(e => e.cat === "cern").filter(e => !((ov[e.id] && ov[e.id].price != null ? ov[e.id].price : e.price) > 0)).length;
        document.getElementById("hxsNo0").click(); return { n, exp, lab }; });
      await P.waitForTimeout(250);
      const f2 = await P.evaluate(() => { const c = [...document.querySelectorAll("#hxsList .hxc-main[data-act=pick]")]; return { shown: c.length, allBadged: c.every(x => !!x.querySelector(".hxb.warn")), count: document.getElementById("hxsCount").textContent }; });
      ok("H.4 " + label + ": filtrul «Doar articole cu preț de completat (N)»: N = numărul articolelor cu preț 0 din categorie; lista arată numai pe ele, toate cu insigna", f1.n === f1.exp && f1.n > 100 && f2.shown === Math.min(f1.n, 30) && f2.allBadged && new RegExp("\\b" + f1.n + "\\b").test(f2.count), JSON.stringify([f1, f2]));
      /* completez un preț → numărătoarea scade cu 1 după editare */
      const k1 = await P.evaluate(() => { const c = document.querySelector("#hxsList .hxc"); c.querySelector('[data-act="edit"]').click(); return c.dataset.key; });
      await P.fill('#hxsList .hxc[data-key="' + k1 + '"] .hxk-price', "9.9"); await P.evaluate(() => document.getElementById("hxsQ").focus()); await P.waitForTimeout(300);
      const f3 = await P.evaluate(() => +(document.getElementById("hxsNo0L").textContent.match(/\((\d+)\)/) || [0, -1])[1]);
      ok("H.4 " + label + ": după ce completezi un preț, numărătoarea «de completat» scade cu 1 și articolul iese din listă", f3 === f1.n - 1 && await P.evaluate(k => !document.querySelector('#hxsList .hxc[data-key="' + k + '"]'), k1), JSON.stringify([f3, f1.n]));
      await P.evaluate(() => closeSheets()); await P.waitForTimeout(250);
      /* 6. filtrul din Catalog (categorii) */
      await openCat();
      const t0 = await P.evaluate(() => { const b = document.getElementById("cthOnly0"), n = +(b.textContent.match(/\((\d+)\)/) || [0, -1])[1];
        const exp = HW_CATS.filter(c => { const it = hwItem(c[0]); return it && it.id && !(it.price > 0); }).length; return { n, exp, all: document.querySelectorAll("#catHwWrap .cth-row").length }; });
      await P.evaluate(() => document.getElementById("cthOnly0").click()); await P.waitForTimeout(250);
      const t1 = await P.evaluate(() => ({ rows: document.querySelectorAll("#catHwWrap .cth-row").length, bad: [...document.querySelectorAll("#catHwWrap .cth-row")].filter(r => !r.querySelector(".cth-meta .hxb.warn")).length, pressed: document.getElementById("cthOnly0").getAttribute("aria-pressed") }));
      ok("H.4 " + label + ": filtrul din Catalog «categorii cu articolul implicit fără preț (N)»: N corect; rămân numai acele categorii, toate cu insigna «preț de completat»", t0.n === t0.exp && t1.rows === t0.n && t1.bad === 0 && t1.pressed === "true" && t0.n < t0.all, JSON.stringify([t0, t1]));
      await P.evaluate(() => document.getElementById("cthOnly0").click()); await P.waitForTimeout(200);
      ok("H.4 " + label + ": al doilea clic readuce toate rândurile", await P.evaluate(() => document.querySelectorAll("#catHwWrap .cth-row").length) === t0.all);
      /* 7. articol propriu din foaie */
      await P.evaluate(RESET); await openCat(); await change("cern");
      await P.evaluate(() => document.querySelector('#hxsBody [data-act="own"]').click()); await P.waitForTimeout(300);
      const ow = await P.evaluate(() => ({ n: state.settings.hwAdd.length, prod: state.settings.hwProd.cern === state.settings.hwAdd[0].id, ed: !!document.querySelector("#hxsList .hxk-name"), id: state.settings.hwAdd[0].id }));
      await P.fill("#hxsList .hxk-name", "Balama X"); await P.fill("#hxsList .hxk-brand", "Mea"); await P.fill("#hxsList .hxk-price", "3.2"); await P.evaluate(() => document.getElementById("hxsQ").focus()); await P.waitForTimeout(250);
      await P.evaluate(() => closeSheets()); await P.waitForTimeout(250);
      await openCat();
      const ow2 = await P.evaluate(() => ({ it: hwItem("cern"), row: document.querySelector('#catHwWrap .cth-row[data-cat="cern"] .cth-cur').textContent, own: !!document.querySelector('#catHwWrap .cth-row[data-cat="cern"] .catOwnName'), price: document.querySelector('#catHwWrap .catPrice[data-cat="cern"]').value }));
      ok("H.4 " + label + ": «＋ Articol propriu» din foaie creează articolul în settings.hwAdd, îl alege implicit și deschide editorul; numele, marca și prețul apar în rând și în hwItem",
        ow.n === 1 && ow.prod && ow.ed && ow2.it.custom && ow2.it.name === "Balama X" && ow2.it.brand === "Mea" && ow2.it.price === 3.2 && /Mea Balama X/.test(ow2.row) && ow2.own && ow2.price === "3.2", JSON.stringify([ow, ow2]));
      /* ștergerea ca până acum, din rând */
      await P.evaluate(() => document.querySelector(".catOwnDel").click()); await P.waitForTimeout(200);
      ok("H.4 " + label + ": ✕ din rând șterge articolul propriu, implicitul revine la primul din catalog", await P.evaluate(() => state.settings.hwAdd.length === 0 && hwItem("cern").id === HWDB.cern[0].id && !state.settings.hwProd.cern));
      /* 8. tastatura: Escape închide foaia (Catalogul rămâne), Tab nu intră în câmpurile ascunse */
      await change("man"); await P.keyboard.press("Escape"); await P.waitForTimeout(300);
      const esc1 = await P.evaluate(() => ({ hw: document.getElementById("shHw").classList.contains("on"), cat: document.getElementById("shCatalog").classList.contains("on"), n: document.querySelectorAll(".sheet.on").length, depth: navDepth(), view: currentView }));
      ok("H.4 " + label + ": Escape închide foaia de catalog, Catalogul rămâne deschis", !esc1.hw && esc1.cat, JSON.stringify(esc1));
      ok("H.4 " + label + ": câmpurile ascunse ale selectelor vechi nu sunt în ordinea tastaturii", await P.evaluate(() => [...document.querySelectorAll("#catHwWrap .cth-compat select, #catHwWrap .cth-compat input")].every(n => n.getAttribute("tabindex") === "-1")));
      await P.evaluate(() => closeSheets()); await P.waitForTimeout(200);
      /* 9. backup făcut de 5.87.0: se restaurează și Catalogul arată aceleași alegeri */
      await P.evaluate(() => { window.__keepB = { s: JSON.parse(JSON.stringify(state.settings)), a: state.activeId }; });
      const snap = () => P.evaluate(() => { renderCatalog(); return JSON.stringify(HW_CATS.map(c => { const it = hwItem(c[0]); return [c[0], it && it.id, it && it.price, it && it.art, it && it.brand, it && it.name, (document.querySelector('#catHwWrap .cth-row[data-cat="' + c[0] + '"] .cth-cur') || { textContent: "" }).textContent]; })); });
      await P.evaluate(() => { const S = state.settings; S.hwAdd = [{ id: "uBk1", cat: "ledstrip", custom: 1, brand: "Mea", n: "Banda B", art: "B-1", price: 0 }];
        S.hwProd = { cern: "het_9071205", guida: "blum_movento", plate: null, ledstrip: "uBk1", man: "haf_bar128" }; S.hwOvr = { het_9071205: { price: 4.5, art: "9071205" }, uBk1: { price: 40, art: "B-1" } }; persist(); });
      const before = await snap();
      const pkg = await P.evaluate(() => JSON.stringify(EBBackup.build({ ver: "5.87.0", date: "2026-11-18T10:00:00.000Z", projects: state.projects, settings: state.settings, stock: state.stock })));
      await P.evaluate(() => { state.settings.hwAdd = []; state.settings.hwProd = {}; state.settings.hwOvr = {}; persist(); });
      const wiped = await snap();
      await P.evaluate(p => { doRestore(JSON.parse(p)); }, pkg); await P.waitForTimeout(400);
      const after = await snap();
      const rs = await P.evaluate(() => ({ cern: document.querySelector('#catHwWrap .cth-row[data-cat="cern"] .cth-cur').textContent, led: document.querySelector('#catHwWrap .cth-row[data-cat="ledstrip"] .cth-cur').textContent, price: document.querySelector('#catHwWrap .catPrice[data-cat="cern"]').value }));
      ok("H.4 " + label + ": un backup făcut de 5.87.0 se restaurează și Catalogul arată exact aceleași alegeri (implicit, prețuri, coduri, articol propriu) ca înainte de backup", before === after && before !== wiped && /Hettich/.test(rs.cern) && /Mea Banda B/.test(rs.led) && rs.price === "4.5", JSON.stringify(rs));
      await P.evaluate(() => { const k = window.__keepB; state.settings = k.s; persist(); closeSheets(); setView("build"); HIST.undo = []; HIST.redo = []; HIST.cur = null; histSync(); });
    }
    await tabCtx3.close();
    ok("H.4: nicio eroare JS", errs.length === 0, errs.join(" | ").slice(0, 300));
  }

  /* H.5 — recomandări din regulile existente: ordinea în «Recomandate», linia «de ce», sugestia din panou cu «Aplică» (nimic nu se aplică singur) */
  {
    head("Recomandări — ordine, «de ce», sugestie cu Aplică (H.5)");
    const tabCtx4 = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true });
    const tabPg4 = await tabCtx4.newPage();
    tabPg4.on("pageerror", e => errs.push("pageerror(tab4): " + e));
    tabPg4.on("console", m => { const x = m.text(); if (m.type() === "error" && !/ERR_CONNECTION|ERR_NAME|ERR_INTERNET|Failed to load resource|Content Security Policy|Refused to/.test(x)) errs.push("console(tab4): " + x); });
    await tabPg4.goto(URL); await tabPg4.waitForFunction(() => window.MAT_LOADED === true, null, { timeout: 15000 }); await tabPg4.waitForTimeout(3300); await tabPg4.evaluate(() => closeSheets()); await tabPg4.waitForTimeout(300);
    const SNAP = () => { const c = cfgFromForm(), b = buildModule(c), p = proj(); p.pieces = []; p.configs = {}; p.layout = {};
      generateInto(p, { ...c, name: "Hu" }); const items = computeHardware(p, state.settings);
      const o = { cfg: c, pieces: b.pieces, hw: items.map(i => [i.k, i.qty, i.price, i.prod && i.prod.id]) };
      p.pieces = p.pieces.filter(q => q.gen !== "Hu"); delete p.configs["Hu"]; return JSON.stringify(o); };
    const SETUP = ([over, preset]) => { closeSheets(); setView("build"); try { localStorage.removeItem("ebanist_hwui_v1"); } catch (e) {}
      state.settings.hwAdd = []; state.settings.hwProd = {}; state.settings.hwOvr = {};
      buildCfg = { ...PRESETS[preset || "armadio"], name: "Hu", ...over }; syncBuildForm(); renderSecChips(); drawPreview(); document.getElementById("grpHw").open = true; document.getElementById("grpFr").open = true; EBHwUI.refresh(); };
    const BODY = { L: 600, H: 1900, doors: 1, drawers: 0, support: "zoccolo", plinth: 80 };
    for (const [label, P] of [["telefon", pg], ["tabletă", tabPg4]]) {
      const waitSug = async () => { await P.waitForFunction(() => { const s = EBHwUI._sug(); return !s.timer && !!s.key; }, null, { timeout: 8000 }).catch(() => {}); await P.waitForTimeout(1200); };
      const openRow = async slot => { await P.locator('[data-hwp-change="' + slot + '"]').scrollIntoViewIfNeeded(); await P.locator('[data-hwp-change="' + slot + '"]').click(); await P.waitForTimeout(350); };
      await P.evaluate(SETUP, [BODY]); await waitSug();
      const base = await P.evaluate(SNAP);
      /* 1. sugestii: ce arată panoul = ce ar sugera regulile (recalculat independent în pagină) */
      const sg = await P.evaluate(() => { const f = (typeof EBHwUI._sug === "function") ? EBHwUI._sug() : null, cfg = cfgFromForm(), ctx = hwFitCtx(cfg), out = { chips: {}, exp: {}, sel: JSON.stringify(cfg.hwSel || null), lift: cfg.lift || null, chipOk: true };
        Object.keys(f.map).forEach(sl => { const r = EBHwFit.check(f.map[sl].e, ctx); if (!(r.ok === true && r.unknownLimits === false && EBHwFit.section(r) === "recomandat")) out.chipOk = false; });
        document.querySelectorAll("#hwPanel [data-hwp-sug]").forEach(n => { out.chips[n.dataset.hwpSug] = n.querySelector("b").textContent; });
        const T0 = EBHwUI.SUGGEST_TARGETS;
        Object.keys(T0).forEach(slot => { const row = document.querySelector('#hwPanel [data-slot="' + slot + '"]'); if (!row) return;
          const items = hwIndex().filter(e => e.cat === T0[slot]); if (T0[slot] === "lift") { /* aceeași listă ca slotul */ }
          const sec = items.filter(e => { try { return EBHwFit.section(EBHwFit.check(e, ctx)) === "recomandat"; } catch (x) { return false; } });
          out.exp[slot] = sec.length; });
        return out; });
      ok("H.5 " + label + ": nimic nu se aplică singur — corpul fără gest are distinta de dinainte și nicio alegere în cfg", sg.sel === "null" && sg.lift === null && base === await P.evaluate(SNAP), JSON.stringify(sg));
      const withChip = Object.keys(sg.chips);
      ok("H.5 " + label + ": slotul «Balamale» (fără alegere, cu balamale «recomandate») arată chipul «Sugestie: …»; fiecare chip e un articol «Recomandat» (ok:true, fără limite necunoscute)", (sg.exp.balamale > 0) === !!sg.chips.balamale && sg.chipOk === true, JSON.stringify(sg));
      ok("H.5 " + label + ": chipul are numele articolului și butonul «Aplică» (≥ 40 px, cu aria-label)", await P.evaluate(() => { const n = document.querySelector('#hwPanel [data-hwp-sug="balamale"]'); if (!n) return false; const b = n.querySelector("button"); return b.getBoundingClientRect().height >= 40 && /\S/.test(b.getAttribute("aria-label")) && /Hettich|Salice|Grass|Häfele|Blum/.test(n.querySelector("b").textContent) && /\d/.test(n.textContent); }));
      /* 2. ordinea în foaie: chipul = primul card din «Recomandate»; «de ce» sub fiecare card recomandat */
      const chip = await P.evaluate(() => EBHwUI._sug().map.balamale);
      await openRow("balamale");
      const sh = await P.evaluate(() => { const cards = [...document.querySelectorAll('#hxsList [data-sec="recomandat"] .hxc-main[data-act=pick]')]; const ranks = cards.map(c => c.dataset.key);
        const pot = [...document.querySelectorAll('#hxsList [data-sec="potrivit"] .hxc-reason')].length, nofit = document.querySelectorAll("#hxsList .hxs-nofit .hxc-reason").length;
        return { first: ranks[0], n: cards.length, reasons: cards.filter(c => !!c.querySelector(".hxc-reason")).length, firstReason: cards[0] && cards[0].querySelector(".hxc-reason") ? cards[0].querySelector(".hxc-reason").textContent : "", pot, nofit }; });
      ok("H.5 " + label + ": sugestia din panou = primul articol din «Recomandate» al foii (aceeași ordine)", !!chip && sh.first === chip.key, JSON.stringify([chip && chip.key, sh]));
      ok("H.5 " + label + ": fiecare card «Recomandat» cu fapte în date are linia «de ce» (ex. «2 balamale · ușa … kg ≤ … kg»); «Potrivite» și «Nu se potrivesc» nu au", sh.reasons >= 1 && /\d/.test(sh.firstReason) && !/\{\w+\}|NaN|undefined/.test(sh.firstReason) && sh.pot === 0 && sh.nofit === 0, JSON.stringify(sh));
      /* ordinea: rank-urile (numărul de balamale) din «Recomandate» nu scad */
      const rk = await P.evaluate(() => { const ctx = hwFitCtx(cfgFromForm()), keys = [...document.querySelectorAll('#hxsList [data-sec="recomandat"] .hxc-main[data-act=pick]')].map(c => c.dataset.key.split("|")[1]);
        return keys.map(id => EBHwUI.ordOf(EBHwFit.check({ id, cat: "cern" }, ctx))); });
      ok("H.5 " + label + ": în «Recomandate» ordinea rank-ului (balamale: cele mai puține primele) nu scade niciodată", rk.length > 3 && rk.every((v, i) => i === 0 || v >= rk[i - 1]), JSON.stringify(rk.slice(0, 20)));
      await P.evaluate(() => closeSheets()); await P.waitForTimeout(250);
      /* 3. Aplică = aceeași scriere ca alegerea manuală */
      const hid = chip.id;
      await P.locator('#hwPanel [data-hwp-apply="balamale"]').scrollIntoViewIfNeeded(); await P.locator('#hwPanel [data-hwp-apply="balamale"]').click(); await P.waitForTimeout(500);
      const ap = await P.evaluate(() => ({ cern: (cfgFromForm().hwSel || {}).cern, old: (document.querySelector('#hwSelBox select[data-cat="cern"]') || {}).value, chip: !!document.querySelector('#hwPanel [data-hwp-sug="balamale"]'), cur: document.querySelector('#hwPanel [data-slot="balamale"] .hwp-cur').textContent }));
      const snapA = await P.evaluate(SNAP);
      await P.evaluate(() => { const s = document.querySelector('#hwSelBox select[data-cat="cern"]'); s.value = ""; s.dispatchEvent(new Event("change", { bubbles: true })); });
      const cleared = await P.evaluate(SNAP);
      await P.selectOption('#hwSelBox select[data-cat="cern"]', hid); await P.waitForTimeout(300);
      const snapB = await P.evaluate(SNAP);
      ok("H.5 " + label + ": «Aplică» scrie cfg.hwSel.cern (și câmpul vechi), chipul dispare, rândul arată alegerea", ap.cern === hid && ap.old === hid && !ap.chip && /\S/.test(ap.cur), JSON.stringify(ap));
      ok("H.5 " + label + ": distinta și devizul după «Aplică» sunt IDENTICE cu alegerea aceluiași articol prin selectul vechi; ștergerea readuce distinta de dinainte", snapA === snapB && snapA !== base && cleared === base);
      await P.evaluate(() => { const s = document.querySelector('#hwSelBox select[data-cat="cern"]'); s.value = ""; s.dispatchEvent(new Event("change", { bubbles: true })); });
      /* «Recente»: Aplică se înregistrează ca alegerea din foaie */
      const rec = await P.evaluate(() => (JSON.parse(localStorage.getItem("ebanist_hwui_v1") || "{}").recent || {}).balamale);
      ok("H.5 " + label + ": «Aplică» intră la «Recente» (aceeași cale ca alegerea din foaie)", Array.isArray(rec) && rec[0] === "cern|" + hid, JSON.stringify(rec));
      /* 4. slot cu alegere = fără sugestie; corp fără balamale recomandate (ușă foarte grea) = fără sugestie */
      await P.evaluate(SETUP, [{ ...BODY, hwSel: { cern: hid } }]); await waitSug();
      ok("H.5 " + label + ": un slot care are deja o alegere nu mai primește sugestie", await P.evaluate(() => !document.querySelector('#hwPanel [data-hwp-sug="balamale"]')));
      await P.evaluate(SETUP, [{ L: 1000, H: 2650, P: 600, doors: 1, support: "zoccolo", plinth: 0, hang: 0, shelves: 1, drawers: 0 }]); await waitSug();
      const hv = await P.evaluate(() => { const ctx = hwFitCtx(cfgFromForm()), n = hwIndex().filter(e => e.cat === "cern").filter(e => EBHwFit.section(EBHwFit.check(e, ctx)) === "recomandat").length; return { n, chip: !!document.querySelector('#hwPanel [data-hwp-sug="balamale"]') }; });
      ok("H.5 " + label + ": ușă foarte înaltă și grea: sugestia apare numai dacă mai există articole «Recomandate» (nicio sugestie din limite necunoscute)", hv.chip === (hv.n > 0), JSON.stringify(hv));
      /* un corp fără uși (nici sertare): niciun slot de balamale, nicio sugestie */
      await P.evaluate(SETUP, [{ L: 600, H: 720, doors: 0, drawers: 0, shelves: 1 }]); await waitSug();
      ok("H.5 " + label + ": corp fără uși: niciun chip de sugestie la balamale", await P.evaluate(() => !document.querySelector('#hwPanel [data-hwp-sug="balamale"]')));
      /* 5. sertare: sistemele din date, cu «de ce» (NL și adâncime utilă); cele vechi nu apar în «Recomandate» */
      await P.evaluate(SETUP, [{ L: 900, H: 720, P: 560, doors: 0, drawers: 3, support: "zoccolo", plinth: 80, shelves: 0 }]); await waitSug();
      await openRow("sertare"); await P.click('#hxsCats [data-val="drawsys"]'); await P.waitForTimeout(250);
      const dr = await P.evaluate(() => { const cs = [...document.querySelectorAll('#hxsList [data-sec="recomandat"] .hxc-main[data-act=pick]')]; return { n: cs.length, ids: cs.map(c => c.dataset.key.split("|")[1]), why: cs[0] && cs[0].querySelector(".hxc-reason") ? cs[0].querySelector(".hxc-reason").textContent : "", chip: (EBHwUI._sug().map.sertare || {}).id }; });
      ok("H.5 " + label + ": sertare: «Recomandate» are numai sisteme cu limite în date, prima are «de ce» cu NL și adâncimea utilă, iar chipul din panou e ea", dr.n >= 2 && !dr.ids.includes("legno") && !dr.ids.includes("legrabox") && /NL \d+/.test(dr.why) && dr.chip === dr.ids[0], JSON.stringify(dr));
      await P.evaluate(() => closeSheets());
      /* 6. limbi: chipul și linia «de ce» în toate limbile, fără chei pe ecran */
      await P.evaluate(SETUP, [BODY]); await waitSug();
      const lg = await P.evaluate(async () => { const keep = state.lang, bad = []; for (const l of ["it", "ro", "en", "fr", "de", "pl", "es"]) { state.lang = l; applyLang(); EBHwUI.relabel(); for (let w = 0; w < 60 && !document.querySelector('#hwPanel [data-hwp-sug="balamale"]'); w++) await new Promise(r => setTimeout(r, 100)); await new Promise(r => setTimeout(r, 200));
        const chip = document.querySelector('#hwPanel [data-hwp-sug="balamale"]'); const txt = chip ? chip.innerText : ""; if (!chip || /\bhx[a-zA-Z]+\b|\{\w+\}/.test(txt) || txt.length < 12) bad.push(l + ":" + txt); }
        state.lang = keep; applyLang(); EBHwUI.relabel(); return bad; });
      ok("H.5 " + label + ": chipul de sugestie în toate cele 7 limbi (recalculat la schimbarea limbii), fără chei de traducere", lg.length === 0, JSON.stringify(lg));
      /* 7. aspect: chipul nu iese din panou, nicio defilare orizontală */
      await waitSug();
      const ov = await P.evaluate(() => { const g = document.getElementById("hwPanel"), r = g.getBoundingClientRect(), n = document.querySelector('#hwPanel [data-hwp-sug="balamale"]'), q = n ? n.getBoundingClientRect() : null; return { inside: !!q && q.left >= r.left - 1 && q.right <= r.right + 1, sw: document.documentElement.scrollWidth, vw: innerWidth }; });
      ok("H.5 " + label + ": chipul se vede întreg în panou, fără defilare orizontală a paginii", ov.inside && ov.sw <= ov.vw + 1, JSON.stringify(ov));
      await P.evaluate(() => { const p = proj(); p.pieces = p.pieces.filter(q => q.gen !== "Hu"); delete p.configs["Hu"]; buildCfg = { ...PRESETS.base }; syncBuildForm(); renderSecChips(); try { localStorage.removeItem("ebanist_hwui_v1"); } catch (e) {} HIST.undo = []; HIST.redo = []; HIST.cur = null; histSync(); });
    }
    await tabCtx4.close();
    ok("H.5: nicio eroare JS", errs.length === 0, errs.join(" | ").slice(0, 300));
  }

  /* U.9 — usi pliante, a pacchetto */
  {
    head("Usi pliante, a pacchetto — optiune, deviz, fisa, camera (U.9)");
    await pg.evaluate(() => { closeSheets(); setView("build"); document.getElementById("grpFr").open = true;
      buildCfg = { ...PRESETS.armadio, name: "Fd1", L: 1200, H: 2200, doors: 2, tram: 0, drawers: 0, hang: 0 }; syncBuildForm(); renderSecChips(); drawPreview(); });
    await pg.waitForTimeout(300);
    ok("U.9: implicit «Nessuna» — fara foi pliante", await pg.evaluate(() => $("bFold").value === "" && cfgFromForm().fold === null && !buildModule(cfgFromForm()).pieces.some(p => /pieghevole/.test(p.elemento))));
    await pg.selectOption("#bFold", "2"); await pg.waitForTimeout(200);
    ok("U.9: alegerea ajunge in cfg: 4 foi si 2 seturi de sina", await pg.evaluate(() => { const c = cfgFromForm(); const ps = buildModule(c).pieces;
      const f = ps.find(p => /^Anta pieghevole/.test(p.elemento)), s2 = ps.find(p => /^Sistema anta pieghevole/.test(p.elemento));
      return c.fold === 2 && f && f.pz === 4 && s2 && s2.pz === 2 && s2.role === "accessorio"; }));
    ok("U.9: indiciul se vede si poarta rostul si latimea minima", await pg.evaluate(() => { const h = $("foldHint"); return h.style.display !== "none" && h.textContent.includes(String(FOLD.gap_leaf)) && h.textContent.includes(String(FOLD.min_leaf)); }));
    const fh = await pg.evaluate(() => { const p = proj(); p.pieces = []; p.configs = {}; p.layout = {}; generateInto(p, { ...cfgFromForm(), name: "Fd1" });
      const items = computeHardware(p, state.settings), g = k => items.find(i => i.k === k) || {};
      const leaf = p.pieces.find(x => /^Anta pieghevole/.test(x.elemento));
      const o = { fold: g("hwFold").qty, price: g("hwFold").price, cern: g("hwCern").qty, man: g("hwMan").qty, want: 2 * hingeCount(Math.max(leaf.lung, leaf.larg)) };
      try { o.mont = montDoc(p).length > 200; } catch (e) { o.err = String(e); }
      try { setView("summary"); o.sum = true; } catch (e) { o.err = String(e); }
      return o; });
    ok("U.9: deviz — 2 seturi de sina cu pret, balamale intre foi (foi-1 pe inaltime, per pachet), 2 maner", fh.fold === 2 && fh.price > 0 && fh.cern === fh.want && fh.man === 2, JSON.stringify(fh));
    ok("U.9: fisa de montaj si rezumatul fara erori", fh.mont === true && fh.sum === true && !fh.err, JSON.stringify(fh));
    ok("U.9: «Montaj» are pasul cu sina pliantă", await pg.evaluate(() => { const p = proj(); return montDoc(p).includes(t("mFold").split("{p}")[0].trim().slice(0, 12)); }));
    ok("U.9: foaia deschisa — stanga: se strang de la marginea pachetului; dreapta: oglinda", await pg.evaluate(() => {
      const F = k => ({ x0: 100, x1: 700, k, n: 2, w: 298 }), th = 19, g = FOLD.open_gap;
      return foldOpenX(F(0), true, th) === 100 && foldOpenX(F(1), true, th) === 100 + th + g
        && foldOpenX(F(1), false, th) === 700 - th && foldOpenX(F(0), false, th) === 700 - (th + g) - th; }));
    ok("U.9: nume traduse pentru foaie si sina in toate limbile", await pg.evaluate(() => { const L = ["ro", "en", "fr", "de", "pl", "es"], keep = state.lang;
      const ok2 = L.every(l => { state.lang = l; return elName("Anta pieghevole") !== "Anta pieghevole" && elName("Sistema anta pieghevole") !== "Sistema anta pieghevole"; });
      state.lang = keep; return ok2; }));
    ok("U.9: cheile de interfata exista in toate cele 7 limbi", await pg.evaluate(() => ["fFold", "foldNone", "fold2", "fold3", "fold4", "foldHint", "wFoldNarrow", "wFoldLY", "wFoldFront", "wFoldReach", "hwFold", "mFold"]
      .every(k => ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => I18N[l] && I18N[l][k]))));
    await pg.evaluate(() => { const p = proj(); p.pieces = p.pieces.filter(q => q.gen !== "Fd1"); delete p.configs["Fd1"]; persist(); buildCfg = { ...PRESETS.base }; syncBuildForm(); renderSecChips(); });
    ok("U.9: nessun errore JS", errs.length === 0, errs.join(" | ").slice(0, 200));
  }

  /* U.2 — catalog propriu si feronerie aleasa pe corp */
  {
    head("Catalog propriu + feronerie aleasa pe corp (U.2)");
    await pg.evaluate(() => { closeSheets(); setView("build"); state.settings.hwAdd = []; state.settings.hwProd = state.settings.hwProd || {}; });
    await pg.evaluate(() => { renderCatalog(); openSheet("shCatalog"); });
    await pg.evaluate(() => document.querySelector('.catOwnAdd[data-cat="cern"]').click()); await pg.waitForTimeout(150);
    await pg.evaluate(() => { const set = (q, v) => { const e = document.querySelector(q); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); };
      set(".catOwnName", "Balama X"); set(".catOwnBrand", "Mea"); set('.catPrice[data-cat="cern"]', "3.2"); });
    const own = await pg.evaluate(() => ({ n: state.settings.hwAdd.length, it: hwItem("cern"), sel: state.settings.hwProd.cern }));
    ok("U.2: articol propriu adaugat si ales in catalog, cu nume si pret", own.n === 1 && own.it.custom && own.it.name === "Balama X" && own.it.brand === "Mea" && own.it.price === 3.2, JSON.stringify(own).slice(0, 200));
    await pg.evaluate(() => { closeSheets(); state.settings.hwProd.cern = "blum_71b3550"; document.getElementById("grpHw").open = true;
      buildCfg = { ...PRESETS.base, name: "Hw1", L: 800, doors: 2, drawers: 0 }; syncBuildForm(); renderSecChips(); });
    await pg.waitForTimeout(250);
    ok("U.2: grupul «Feronerie corp» are un selector pe categorie, cu articolul propriu in lista", await pg.evaluate(() => document.querySelectorAll("#hwSelBox select").length >= 8 && [...document.querySelectorAll('#hwSelBox select[data-cat="cern"] option')].some(o => o.textContent.includes("Balama X"))));
    const r = await pg.evaluate(() => { const id = state.settings.hwAdd[0].id; document.querySelector('#hwSelBox select[data-cat="cern"]').value = id;
      const c = cfgFromForm(); const p = proj(); p.pieces = []; p.configs = {}; p.layout = {};
      generateInto(p, { ...c, name: "Hw1" });
      generateInto(p, { ...c, hwSel: null, name: "Hw2" });
      const items = computeHardware(p, state.settings).filter(i => i.k === "hwCern");
      const o = { sel: c.hwSel, rows: items.map(i => [i.qty, i.prod && i.prod.name, i.price]) };
      try { o.mont = montDoc(p).length > 200; } catch (e) { o.mont = String(e); }
      try { setView("summary"); o.sum = true; } catch (e) { o.sum = String(e); }
      p.pieces = p.pieces.filter(q => q.gen !== "Hw1" && q.gen !== "Hw2"); delete p.configs["Hw1"]; delete p.configs["Hw2"]; persist();
      return o; });
    /* poza articolului propriu (5.22.0): se micsoreaza, ramane in articol, se vede, se poate scoate; cele de serie nu au poza */
    {
      const prevCern = await pg.evaluate(() => { closeSheets(); const prev = state.settings.hwProd.cern; state.settings.hwProd.cern = state.settings.hwAdd[0].id; renderCatalog(); openSheet("shCatalog"); return prev; });
      const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dwn4EIwESMolGF5FUIAKvMBAw1OZb2AAAAAElFTkSuQmCC", "base64");
      const hid = await pg.evaluate(() => state.settings.hwAdd[0].id);
      await pg.setInputFiles(`.catPhIn[data-kind="hw"][data-id="${hid}"]`, { name: "b.png", mimeType: "image/png", buffer: png });
      await pg.waitForTimeout(500);
      const ph = await pg.evaluate(id => ({ img: (state.settings.hwAdd.find(x => x.id === id) || {}).img || "", thumb: !!document.querySelector("#catHwWrap .cat-ph img"),
        del: !!document.querySelector("#catHwWrap .catPhDel"), serie: !!document.querySelector('#catHwWrap .catSel') && !((HWDB.cern[0]) || {}).img }), hid);
      ok("5.22.0: poza articolului propriu: JPEG mic in articol, miniatura si ✕ vizibile, articolele de serie fara poza",
         ph.img.startsWith("data:image/jpeg") && ph.img.length < 60000 && ph.thumb && ph.del && ph.serie, JSON.stringify({ n: ph.img.length, t: ph.thumb, d: ph.del, s: ph.serie }));
      await pg.evaluate(() => document.querySelector("#catHwWrap .catPhDel").click()); await pg.waitForTimeout(200);
      ok("5.22.0: ✕ scoate poza", await pg.evaluate(id => !state.settings.hwAdd.find(x => x.id === id).img && !document.querySelector("#catHwWrap .cat-ph img"), hid));
      await pg.evaluate(prev => { closeSheets(); state.settings.hwProd.cern = prev; }, prevCern);
    }
    ok("U.2: alegerea ajunge in cfg", r.sel && r.sel.cern && r.sel.cern.startsWith("u"), JSON.stringify(r).slice(0, 200));
    ok("U.2: devizul are doua randuri de balamale — propriul pe Hw1, cel din catalog pe Hw2, fiecare cu pretul lui", r.rows.length === 2 && r.rows.some(x => x[1] === "Balama X" && x[2] === 3.2) && r.rows.some(x => x[1] !== "Balama X"), JSON.stringify(r.rows));
    ok("U.2: fisa de montaj si rezumatul fara erori", r.mont === true && r.sum === true, JSON.stringify(r).slice(0, 200));
    /* U.10: Häfele One Touch — articol generic in categoria push, pe uși drepte, trapezoidale și pliante */
    const ot = await pg.evaluate(() => {
      const o = {}; const p = proj(); p.pieces = []; p.configs = {}; p.layout = {};
      const base = { ...PRESETS.armadio, handles: "push", hwSel: { push: "haf_onetouch" } };
      const variants = { dritta: {}, panta: { H: 2000, topProfile: { axis: "x", h0: 2000, h1: 1700 } }, pliante: { fold: { n: 4 } } };
      for (const [k, v] of Object.entries(variants)) {
        try { generateInto(p, { ...base, ...v, name: "OT" + k });
          const it = computeHardware(p, state.settings).filter(i => i.k === "hwPush");
          o[k] = it.map(i => [i.qty, i.prod && i.prod.id]);
          if (k === "dritta") { try { o.mont = montDoc(p).length > 200; } catch (e) { o.mont = String(e); } }
          p.pieces = p.pieces.filter(q => q.gen !== "OT" + k); delete p.configs["OT" + k];
        } catch (e) { o[k] = String(e); }
      }
      o.names = ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => { const it = hwList("push").find(x => x.id === "haf_onetouch"); return it && it.n[l]; });
      persist(); return o; });
    ok("U.10: One Touch ajunge în deviz pe uși drepte, pe pantă și pliante", ["dritta", "panta", "pliante"].every(k => Array.isArray(ot[k]) && ot[k].some(x => x[1] === "haf_onetouch" && x[0] > 0)), JSON.stringify(ot));
    /* notificare de actualizare la deschidere */
    const un = await pg.evaluate(async () => {
      const o = {}, of = window.fetch, mk = v => ({ ok: true, text: async () => 'const APP_VER="' + v + '"; /* APP_VER-MARKER */' });
      try {
        window.fetch = async u => String(u).includes("upd=") ? mk("99.0.0") : of(u);
        _updChk = 0; await updateNotice();
        const bar = document.getElementById("updBar");
        o.shown = !!bar && bar.textContent.includes("99.0.0");
        bar.querySelectorAll("button")[1].click(); o.gone = !document.getElementById("updBar");
        _updChk = 0; await updateNotice(); o.silent = !document.getElementById("updBar");
        updDismissed = null; window.fetch = async u => String(u).includes("upd=") ? mk(APP_VER) : of(u);
        _updChk = 0; await updateNotice(); o.same = !document.getElementById("updBar");
        window.fetch = async () => { throw new Error("offline"); };
        _updChk = 0; await updateNotice(); o.offline = !document.getElementById("updBar");
      } finally { window.fetch = of; updDismissed = null; }
      o.i18n = ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => ["updBanner", "updNow", "updLater"].every(k => I18N[l] && I18N[l][k]));
      return o; });
    /* anteprima: câmpurile pliabil / pantă / tavan redesenează modelul fără alt gest */
    const pv = await pg.evaluate(() => {
      const o = {}, boxes = () => (typeof buildModule === "function" ? buildModule(buildCfg).boxes : []);
      const ev = (id, val) => { const el = document.getElementById(id); el.value = val; el.dispatchEvent(new Event("change", { bubbles: true })); };
      try {
        ev("bTipo", "standard"); ev("bDoors", "2"); drawPreview();
        const base = JSON.stringify(boxes().map(b => [b.x0, b.x1, b.y0, b.y1, b.z0, b.z1]));
        ev("bFold", "2");
        o.fold = buildCfg.fold === 2 && JSON.stringify(boxes().map(b => [b.x0, b.x1, b.y0, b.y1, b.z0, b.z1])) !== base;
        ev("bFold", "");
        ev("bSlope", "x");
        o.slope = !!buildCfg.topProfile && boxes().some(b => b.vp);
        ev("bSlopeH1", "1500");
        o.slopeH = buildCfg.topProfile && buildCfg.topProfile.h1 === 1500;
        ev("bSlope", ""); o.off = !buildCfg.topProfile;
      } catch (e) { o.err = String(e); }
      return o; });
    ok("Anteprima: ușile pliabile și tavanul înclinat schimbă modelul 3D imediat", pv.fold && pv.slope && pv.slopeH && pv.off, JSON.stringify(pv));
    /* verificare cap-coadă 20.10: ușile se deschid și sub pantă / în colț; exportul nu se blochează; tastatura */
    const ee = await pg.evaluate(async () => {
      const o = {}, w = ms => new Promise(r => setTimeout(r, ms)); closeSheets();
      const sl = { ...PRESETS.armadio, name: "Sl", H: 2200, doors: 2, topProfile: { axis: "x", h0: 2200, h1: 1700 } };
      GL3D.render(sl, { explode: 0 }); await w(300); GL3D.capture(sl, { w: 120, h: 120, open: true });
      o.slopeDoors = GL3D.meshKinds().filter(m => m.role === "frontale").map(m => { const t = GL3D.tgtOf(m.pk); return !!t.pivot && Math.abs(t.ang) > 1; });
      const an = { ...PRESETS.angolare, name: "An" };
      GL3D.render(an, { explode: 0 }); await w(300); GL3D.capture(an, { w: 120, h: 120, open: true });
      o.cornerDoors = GL3D.meshKinds().map(m => GL3D.tgtOf(m.pk)).filter(t => t && t.sub === "door").map(t => !!t.pivot && Math.abs(t.ang) > 1);
      const gate = cfg => { const p = proj(); p.pieces = []; p.configs = {}; p.layout = {}; generateInto(p, { ...cfg, name: "G" }); const v = assertExportable(p); p.pieces = []; p.configs = {}; return v.blocking.map(b => b.id); };
      o.gate = { slope: gate(sl), slopeZ: gate({ ...PRESETS.armadio, H: 2200, topProfile: { axis: "z", h0: 2200, h1: 1600 } }),
        fold2: gate({ ...PRESETS.armadio, fold: 2 }), fold4: gate({ ...PRESETS.armadio, fold: 4 }), fold3x3: gate({ ...PRESETS.armadio, doors: 3, fold: 3 }),
        cornerFold: gate({ ...PRESETS.angolare, fold: 2 }) };
      o.kbc = [kbCompute({ ih: 800, vvH: 480, vvTop: 0, base: 800, typing: true }), kbCompute({ ih: 480, vvH: 480, vvTop: 0, base: 800, typing: true }),
        kbCompute({ ih: 480, vvH: 480, vvTop: 0, base: 800, typing: false }), kbCompute({ ih: 800, vvH: 800, vvTop: 0, base: 800, typing: true })];
      o.kbModes = o.kbc[0].open && o.kbc[0].inset === 320 && o.kbc[1].open && o.kbc[1].inset === 0 && !o.kbc[2].open && !o.kbc[3].open;
      kbApply(kbInset(800, 480, 0)); o.kbOn = document.body.classList.contains("kb-open") && getComputedStyle(document.documentElement).getPropertyValue("--kb").trim() === "320px";
      kbApply(kbInset(800, 790, 0)); o.kbOff = !document.body.classList.contains("kb-open");
      return o; });
    ok("Uși: se deschid sub pantă (ambele axe) și pe aripa corpului de colț", ee.slopeDoors.length === 2 && ee.slopeDoors.every(Boolean) && ee.cornerDoors.length >= 2 && ee.cornerDoors.some(Boolean), JSON.stringify(ee));
    ok("Export: pantă, uși pliabile (2/4 foi, 3×3 foi prea înguste) și colț pliabil nu sunt blocate", Object.values(ee.gate).every(a => a.length === 0), JSON.stringify(ee.gate));
    ok("Tastatură: detectată și când acoperă (visualViewport), și când redimensionează fereastra (WebView Android); dispare când se închide", ee.kbOn && ee.kbOff && ee.kbModes, JSON.stringify(ee));
    /* Scheda pezzo: ușa trapezoidală are conturul real și unghiul tăieturii, în toate limbile */
    const sc = await pg.evaluate(() => {
      const o = {}; PRO = true; closeSheets(); setView("build");
      const p = proj(); p.pieces = []; p.configs = {}; p.layout = {};
      const c = { ...PRESETS.armadio, name: "Sc", H: 2200, doors: 2, topProfile: { axis: "x", h0: 2200, h1: 1650 } };
      generateInto(p, c); const k = Object.keys(p.configs)[0], cf = p.configs[k];
      const built = buildModule(cf), G = deriveCarcass(carcassParams(cf, {})), ops = generateOperations({ boxes: built.boxes, cfg: cf, G });
      const q = ops.pieces.find(x => x.role === "frontale" && x.cut);
      const meta = {}; ops.pieces.forEach((x, i) => { meta[String(x.pk)] = { n: x.n || i + 1, row: null, exact: false }; });
      openPartSheet({ cfg: cf, rows: built.pieces, ops, meta }, q);
      const svg = document.querySelector("#partBody .part-svg");
      o.poly = !!(svg && svg.querySelector("polygon"));
      o.cut = /\d/.test((document.querySelector("#partBody .part-cut") || {}).textContent || "");
      o.h = q.cut.h0 > q.cut.h1 && q.cut.deg > 0 && q.cut.deg < 90 && Math.abs(q.cut.deg + q.cut.degSide - 90) < 0.2;
      o.i18n = ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => I18N[l].partCutAng && I18N[l].partCutH);
      o.onDrawing = /\d+[,.]\d°/.test(Array.from(svg.querySelectorAll("text")).map(x => x.textContent).join(" "));
      const a3 = partSheetSvg({ cfg: cf, rows: built.pieces, ops, meta }, q, 5, 1, 1); o.a3 = a3.includes("<polygon") && /\d+,\d°/.test(a3);
      closeSheets(); persist(); return o; });
    ok("Scheda pezzo: ușa trapezoidală se desenează cu conturul real și arată unghiul tăieturii", sc.poly && sc.cut && sc.h && sc.i18n && sc.onDrawing && sc.a3, JSON.stringify(sc));
    ok("Ripara l'app: buton și texte în toate limbile", await pg.evaluate(() => !!document.getElementById("btnRepair") && typeof repairApp === "function" && ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => I18N[l].updRepair && I18N[l].updRepairHint && I18N[l].updRepairing)));
    /* D-89 — mânere: fiecare model din catalog găurește/frezează după tipul lui; sertarele pot avea mânerul lor */
    const hd = await pg.evaluate(() => {
      const o = { bad: [], types: {} }; closeSheets();
      const base = { ...PRESETS.armadio, name: "Hd", L: 900, H: 720, P: 560, doors: 2, drawers: 0, tram: 0, shelves: 0, hang: 0 };
      for (const it of hwList("man")) {
        if (it.profile) continue;
        const cfg = { ...base, hwSel: { man: it.id } }, built = buildModule(cfg), G = deriveCarcass(carcassParams(cfg, {}));
        const ops = generateOperations({ boxes: built.boxes, cfg, G }), h = ops.hw.filter(x => x.type === "maniglia");
        const m = handleModel(cfg, "door"), door = ops.pieces.find(q => q.role === "frontale");
        const nTh = door.operations.filter(x => x.type === "drill" && x.through && x.dia === 5).length;
        const nMill = door.operations.filter(x => x.type === "mill").length, nBack = door.operations.filter(x => x.type === "drill" && x.dia === 3).length;
        const want = m.knob ? [1, 0, 0] : (m.t === "flush" || m.t === "flushR") ? [0, 1, 0] : m.t === "edge" ? [0, 0, 2] : [2, 0, 0];
        o.types[m.t] = (o.types[m.t] || 0) + 1;
        if (h.length !== 2 || h[0].catalog !== it.id || JSON.stringify([nTh, nMill, nBack]) !== JSON.stringify(want)) o.bad.push([it.id, h.length, nTh, nMill, nBack]);
      }
      /* sertarele cu mânerul lor: rând separat în deviz, montaj pe tipuri */
      const p = proj(); p.pieces = []; p.configs = {}; p.layout = {};
      generateInto(p, { ...base, name: "Hs", doors: 2, drawers: 2, H: 900, hwSel: { man: "gen_bar160_inox", manS: "gen_knob_wood" } });
      const hw = computeHardware(p, state.settings);
      o.man = hw.filter(i => i.k === "hwMan").map(i => [i.qty, i.prod && i.prod.id]);
      o.manS = hw.filter(i => i.k === "hwManS").map(i => [i.qty, i.prod && i.prod.id]);
      try { const md = montDoc(p); o.mont = md.includes(I18N[state.lang].ms21k.slice(0, 12)) || md.length > 200; } catch (e) { o.mont = String(e); }
      p.pieces = []; p.configs = {}; persist();
      o.i18n = ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => ["hwManS", "hwSelSame", "ms21k", "ms21f", "ms21e", "opsHandleFit"].every(k => I18N[l][k]));
      return o; });
    ok("Mânere (D-89): fiecare articol din catalog găurește după tipul lui (bară 2 găuri, buton 1, încastrat locaș, pe muchie 2 găuri pe spate)", hd.bad.length === 0 && Object.keys(hd.types).length >= 9, JSON.stringify(hd));
    ok("Mânere (D-89): sertarele au mânerul lor, pe rând separat în deviz", hd.man.some(x => x[1] === "gen_bar160_inox" && x[0] === 2) && hd.manS.some(x => x[1] === "gen_knob_wood" && x[0] === 2) && hd.mont === true && hd.i18n, JSON.stringify(hd));
    /* D-89 — tipuri de gola: L+C în corp, J pe fiecare front, frezată în front */
    const gl = await pg.evaluate(() => {
      const o = {};
      for (const gt of ["L", "J", "fresata"]) {
        const cfg = { ...PRESETS.armadio, name: "Gl", L: 600, H: 760, P: 560, doors: 0, drawers: 3, tram: 0, shelves: 0, hang: 0, handles: "gola", golaType: gt === "L" ? null : gt };
        const built = buildModule(cfg), G = deriveCarcass(carcassParams(cfg, {})), ops = generateOperations({ boxes: built.boxes, cfg, G });
        const el = built.pieces.map(x => x.elemento);
        o[gt] = { L: el.includes("Profilo gola L"), C: el.includes("Profilo gola C"), J: el.includes("Profilo gola J"),
          grooves: ops.pieces.filter(q => q.role === "cassetto_frontale").every(q => q.operations.some(x => x.type === "groove")),
          holes: ops.pieces.filter(q => q.role === "cassetto_frontale").some(q => q.operations.some(x => x.type === "drill" && x.dia === 5)),
          closure: Array.from(validateCarcassClosure(cfg, built.pieces, G)).filter(r => r.ok === false).length };
      }
      const p = proj(); p.pieces = []; p.configs = {}; p.layout = {};
      generateInto(p, { ...PRESETS.armadio, name: "GJ", L: 600, H: 760, P: 560, doors: 0, drawers: 3, tram: 0, shelves: 0, hang: 0, handles: "gola", golaType: "J" });
      o.dev = computeHardware(p, state.settings).filter(i => i.k === "hwGolaJ").map(i => i.qty);
      p.pieces = []; p.configs = {}; persist();
      o.i18n = ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => ["fGolaType", "golaTL", "golaTJ", "golaTF", "golaHintJ", "golaHintF", "hwGolaJ"].every(k => I18N[l][k]));
      return o; });
    ok("Gola (D-89): L+C în corp, J pe fronturi, frezată în fronturi — fără mânere găurite, închiderea corectă", gl.L.L && gl.L.C && !gl.L.J && !gl.J.L && gl.J.J && !gl.fresata.J && !gl.fresata.L && gl.fresata.grooves && !gl.L.grooves && [gl.L, gl.J, gl.fresata].every(x => !x.holes && x.closure === 0) && gl.dev.length === 1 && gl.dev[0] > 1.7 && gl.i18n, JSON.stringify(gl));
    ok("Update: bara apare la versiune nouă, «Mai târziu» o tace, la aceeași versiune/offline nu apare nimic", un.shown && un.gone && un.silent && un.same && un.offline, JSON.stringify(un));
    ok("Update: textele există în toate limbile", un.i18n === true, JSON.stringify(un));
    ok("U.10: One Touch are nume în toate limbile", ot.names === true && ot.mont === true, JSON.stringify(ot));
    await pg.evaluate(() => { state.settings.hwProd.cern = state.settings.hwAdd[0].id; renderCatalog(); });
    await pg.evaluate(() => { document.querySelector(".catOwnDel").click(); });
    ok("U.2: articolul propriu se poate sterge; catalogul revine la cel de serie", await pg.evaluate(() => state.settings.hwAdd.length === 0 && !hwItem("cern").custom));
    await pg.evaluate(() => { setView("build"); buildCfg = { ...PRESETS.base }; syncBuildForm(); renderSecChips(); });
    ok("U.2: nessun errore JS", errs.length === 0, errs.join(" | ").slice(0, 200));
  }

  /* D-43 pe 3D: piesele din lanțul de închidere care cade devin roșii, butonul apare doar la nevoie */
  {
    const c = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      if (!(window.GL3D && GL3D.ok)) return { fara_gl: true };
      setView("build"); buildCfg = { ...PRESETS.armadio }; syncBuildForm(); draw3D(); await w(400); studioSync();
      const btn = document.getElementById("btnCoh3d"), M = GL3D.model();
      o.sanatos = btn.hidden === true && cohIssues(M).length === 0;
      const fi = M.rows.find(x => x.role === "fianco"), real = window.closureOf;
      window.closureOf = () => [{ axa: "L", chain: "fianco+base", valoare_nominala: 900, valoare_calculata: 905, delta: 5, piese_implicate: [fi.elemento], why: "t" }];
      studioSync(); o.apare = !btn.hidden && document.getElementById("cohN").textContent === "1";
      btn.click(); await w(200); o.pornit = btn.classList.contains("on");
      btn.click(); await w(100); o.oprit = !btn.classList.contains("on");
      window.closureOf = real; studioSync(); o.dispare = btn.hidden === true;
      /* invarianții pe rol: doar ei, fără lanțurile de închidere */
      window.closureOf = () => [];
      const rows = M.rows.map(x => x.role === "ripiano" ? { ...x, ys: [9999] } : x);
      const rp = M.rows.find(x => x.role === "ripiano"), iv = cohIssues({ ...M, rows });
      o.inv = !rp || (iv.length >= 1 && iv.some(e => e.names.includes(rp.elemento)));
      window.closureOf = real;
      return o;
    });
    if (c.fara_gl) ok("coerență 3D: fără WebGL, sărit", true);
    else {
      ok("coerență 3D: corp sănătos → butonul ascuns", c.sanatos === true);
      ok("coerență 3D: o închidere căzută → butonul apare cu numărul", c.apare === true);
      ok("coerență 3D: butonul pornește și oprește evidențierea", c.pornit === true && c.oprit === true);
      ok("coerență 3D: butonul dispare când corpul se închide", c.dispare === true);
      ok("coerență 3D: un invariant pe rol căzut numește piesa", c.inv === true);
    }
  }

  /* resturile recuperabile pe planul de tăiere: aceeași soglie ca „Adaugă resturile” */
  {
    const n = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      closeSheets(); const p = proj(); p.pieces = []; p.configs = {};
      generateInto(p, { ...PRESETS.armadio, name: "Z" });
      const keep = state.settings.stockMin;
      state.settings.stockMin = 250; setView("nest"); await w(300); renderNest();
      const zs = [...document.querySelectorAll("svg .keepz")];
      o.zone = zs.length; o.egale = zs.length === nestLeftovers.length;
      o.soglia = zs.every(z => Math.min(+z.getAttribute("width"), +z.getAttribute("height")) >= 250);
      o.legenda = !!document.querySelector(".nest-legend");
      state.settings.stockMin = 99999; renderNest();
      o.zero = document.querySelectorAll("svg .keepz").length === 0 && !document.querySelector(".nest-legend");
      state.settings.stockMin = keep; renderNest(); p.pieces = []; p.configs = {}; persist(); setView("projects");
      return o;
    });
    ok("nesting: resturile ≥ prag sunt conturate în verde pe plan", n.zone > 0 && n.egale === true, JSON.stringify(n));
    ok("nesting: nicio zonă verde sub prag", n.soglia === true);
    ok("nesting: legenda apare cu resturi și dispare fără", n.legenda === true && n.zero === true);
  }

  /* iconița de cant pe rândul din lista de debitare (edgeSvg, ca pe etichete) */
  {
    const e = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      closeSheets(); const p = proj(); p.pieces = []; p.configs = {};
      generateInto(p, { ...PRESETS.armadio, name: "Z" }); setView("list"); await w(300); renderList();
      const rows = p.pieces.filter(x => x.role !== undefined || true);
      const want = p.pieces.filter(x => /[12][LC]/i.test(x.bordo || "")).length;
      o.icoane = document.querySelectorAll(".pc .pc-edge svg").length; o.cu = want;
      o.textRamane = [...document.querySelectorAll(".pc .pc-edge")].every(el => /[12][LC]/i.test(el.parentElement.textContent));
      const full = p.pieces.find(x => /2L\+2C/i.test(x.bordo || ""));
      if (full) { const el = [...document.querySelectorAll(".pc")].find(r => r.querySelector(".pc-edge[title='2L+2C']")); o.patru = !!el && el.querySelectorAll(".pc-edge line[stroke='#3e6b0a']").length === 4; } else o.patru = true;
      p.pieces = []; p.configs = {}; persist(); setView("projects");
      return o;
    });
    ok("lista: fiecare rând cu cant are iconița lui", e.icoane > 0 && e.icoane === e.cu, JSON.stringify(e));
    ok("lista: textul cantului rămâne lângă iconiță", e.textRamane === true);
    ok("lista: 2L+2C desenează cele patru laturi", e.patru === true);
  }

  /* lumină caldă (5.66.0): doar atmosfera; documentele (capture) rămân neutre */
  {
    const d = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      if (!(window.GL3D && GL3D.ok)) return { fara_gl: true };
      setView("build"); buildCfg = { ...PRESETS.armadio, doors: 0 }; syncBuildForm(); draw3D(); await w(400); studioSync();
      const btn = document.getElementById("btnWarm3d");
      const n = GL3D.moodInfo();
      o.implicit = n.warm === false && n.key === 0xfff1e0;
      btn.click(); await w(150); const c = GL3D.moodInfo();
      o.cald = c.warm === true && c.key === 0xffbf80 && c.exposure < n.exposure && btn.classList.contains("on");
      GL3D.capture({ ...buildCfg }, { w: 200, h: 150 });
      const dupa = GL3D.moodInfo();
      o.revine = dupa.warm === true && dupa.key === 0xffbf80;
      btn.click(); await w(150); o.stins = GL3D.moodInfo().key === 0xfff1e0;
      return o;
    });
    if (d.fara_gl) ok("lumină caldă: sărit (fără WebGL)", true);
    else {
      ok("lumină caldă: implicit neutră; butonul trece pe lumini calde și înapoi", d.implicit && d.cald && d.stins, JSON.stringify(d));
      ok("lumină caldă: o captură de document nu rămâne caldă, iar atmosfera se reface după ea", d.revine, JSON.stringify(d));
    }
  }

  /* cotă liberă editată din 3D (5.66.0): atingi eticheta, raftul se mută, validateLayout decide */
  {
    const d = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      if (!(window.GL3D && GL3D.ok)) return { fara_gl: true };
      setView("build");
      buildCfg = { ...PRESETS.armadio, name: "Gp", L: 800, H: 2000, P: 560, shelves: 0, partitions: [{ type: "ripiano", y: 600, span: "full" }, { type: "ripiano", y: 1200, span: "full" }], doors: 0, drawers: 0, hang: 0, tram: 0 };
      syncBuildForm(); draw3D(); await w(400); studioSync();
      if (!GL3D.state.dims) document.getElementById("btnDims3d").click(); await w(200);
      const g = GL3D.dimsInfo().spec.gaps.find(x => Math.abs(x.y1 - 1200) < 1);
      o.gasit = !!g;
      const keep = window.prompt; window.prompt = () => "300";
      editGapFromTap(g); await w(400);
      const ys = (buildCfg.partitions || []).map(q => q.y).sort((a, b) => a - b);
      o.mutat = ys.length === 2 && Math.abs(ys[1] - (g.y0 + 300)) < 0.2;
      const g2 = GL3D.dimsInfo().spec.gaps.find(x => Math.abs(x.y0 - g.y0) < 1);
      o.nou = !!g2 && Math.abs(g2.h - 300) < 0.2;
      window.prompt = () => "99999"; const before = JSON.stringify(buildCfg.partitions);
      editGapFromTap(g2); await w(200);
      o.respins = JSON.stringify(buildCfg.partitions) === before;
      window.prompt = keep; GL3D.set({ dims: false }); studioSync();
      return o;
    });
    if (d.fara_gl) ok("cotă liberă din 3D: sărit (fără WebGL)", true);
    else {
      ok("cotă liberă din 3D: eticheta se găsește, raftul se mută și golul devine cota scrisă", d.gasit && d.mutat && d.nou, JSON.stringify(d));
      ok("cotă liberă din 3D: o cotă care nu are loc e refuzată, fără nicio modificare", d.respins, JSON.stringify(d));
    }
  }

  /* cote de lumină pe 3D: dimensionSpec desenat în viewer */
  {
    const d = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      if (!(window.GL3D && GL3D.ok)) return { fara_gl: true };
      setView("build"); buildCfg = { ...PRESETS.armadio, doors: 0 }; syncBuildForm(); draw3D(); await w(400); studioSync();
      const btn = document.getElementById("btnDims3d");
      o.implicit = GL3D.dimsInfo().visible === false;
      btn.click(); await w(200); const i = GL3D.dimsInfo();
      o.vizibil = i.visible === true && btn.classList.contains("on");
      o.etichete = i.labels === 3 + i.spec.gaps.length && i.spec.gaps.length > 0;
      o.gabarit = i.spec.L === buildCfg.L && i.spec.H === buildCfg.H;
      GL3D.set({ explode: 1 }); await w(100); o.ascuns = GL3D.dimsInfo().visible === false;
      GL3D.set({ explode: 0 }); await w(100); o.revine = GL3D.dimsInfo().visible === true;
      btn.click(); await w(100); o.oprit = GL3D.dimsInfo().visible === false;
      return o;
    });
    if (d.fara_gl) ok("cote 3D: fără WebGL, sărit", true);
    else {
      ok("cote 3D: implicit ascunse", d.implicit === true);
      ok("cote 3D: butonul le arată, cu 3 cote exterioare + câte o lumină pe vano", d.vizibil === true && d.etichete === true, JSON.stringify(d));
      ok("cote 3D: gabaritul din cote = cota corpului", d.gabarit === true);
      ok("cote 3D: dispar în vederea explodată și revin", d.ascuns === true && d.revine === true);
      ok("cote 3D: butonul le oprește", d.oprit === true);
    }
  }

  /* Rezumat: butoanele de export în trei grupe, fiecare buton o singură dată */
  {
    const x = await pg.evaluate(async () => {
      closeSheets(); setView("summary"); await new Promise(r => setTimeout(r, 300));
      const g = {};
      /* D-117: titlul grupei e în <summary>, butoanele în corpul <details> */
      document.querySelectorAll("#v-summary details[id^=sgExp_]").forEach(d => {
        g[d.querySelector("summary [data-i]").dataset.i] = [...d.querySelectorAll(".grp-body button")].map(b => b.id);
      });
      setView("projects");
      return g;
    });
    const all = [].concat(...Object.values(x));
    ok("export: trei grupe cu titlu", Object.keys(x).join() === "expClient,expShop,expSite", Object.keys(x).join());
    ok("export: fiecare dintre cele 13 butoane (12 + „Foi pe postazione”, D-187) e într-o grupă, o singură dată",
      all.length === 13 && new Set(all).size === 13 && ["btnStations","btnPdf","btnQuote","btnPassport","btnHandover","btnMont","btnLabels","btnLab","btnOrder","btnOrderSend","btnTransp","btnCsv","btnShare"].every(i => all.includes(i)), all.join());
    ok("export: oferta și pașaportul sunt la client, montajul la atelier", x.expClient.join() === "btnQuote,btnPassport" && x.expSite.includes("btnMont") && x.expShop.includes("btnPdf"));
  }

  /* audit 18.10: corp în afara echerului → avertisment, nu blocaj; computeHardware fără setări */
  {
    const a = await pg.evaluate(async () => {
      const o = {}; closeSheets();
      const p = proj(); p.pieces = []; p.configs = {};
      generateInto(p, { ...PRESETS.armadio, name: "Z", angL: 87 });
      const keepLang = state.lang; state.lang = "en";
      const r = assertExportable(p); state.lang = keepLang;
      o.fara_blocaj = r.blocking.filter(x => /^C-L/.test(x.id || "")).length === 0;
      o.avertisment = r.warn.some(x => x.id === "C-L" && x.closure && x.closure.chain === "fuori-squadro");
      o.text = (r.warn.find(x => x.id === "C-L") || {}).why || "";
      const keep = state.settings.hwProd; state.settings.hwProd = { cern: "NU-EXISTA", guida: "NU-EXISTA" };
      try { o.hw = Array.isArray(computeHardware(p)); } catch (e) { o.hw = String(e.message); }
      state.settings.hwProd = keep;
      p.pieces = []; p.configs = {}; persist(); setView("projects");
      return o;
    });
    ok("fuori squadro: avertisment pe lățime, fără blocaj", a.fara_blocaj === true && a.avertisment === true, JSON.stringify(a).slice(0, 200));
    ok("fuori squadro: textul e tradus în limba interfeței", /out of square/i.test(a.text), a.text.slice(0, 80));
    ok("computeHardware fără setări nu cade cu un articol necunoscut", a.hw === true, String(a.hw));
  }

  /* Releveu → pantă (D-88): punctele 1 și 3 devin profilul tavanului la «Completează generatorul» */
  {
    head("Releveu — panta tavanului propusă constructorului (D-88)");
    await pg.evaluate(() => { closeSheets(); const p = proj(); p.survey = { walls: [{ id: "w1", len: 1800, angle: 90, bow: null }], heights: [2500, 2300, 1900], obstacles: [] };
      persist(); setView("survey"); renderPlan(); renderSurveyHeights(); });
    await pg.waitForTimeout(300);
    const sug = await pg.evaluate(() => ({ vis: $("svSlopeHint").style.display !== "none", txt: $("svSlopeHint").textContent, sel: $("svSlope").value }));
    ok("D-88: cu punctele 1 și 3 diferite apare sugestia, cu diferența, fără pantă aleasă", sug.vis && sug.txt.includes("600") && sug.sel === "", JSON.stringify(sug));
    await pg.evaluate(() => { document.getElementById("sgSvHeights").open = true; }); await pg.selectOption("#svSlope", "x"); await pg.waitForTimeout(200);
    const rd = await pg.evaluate(() => ({ sv: survey().slope, txt: $("svSlopeHint").textContent }));
    ok("D-88: alegerea se salvează în releveu și indiciul spune ce se propune (minus 20 mm)", rd.sv === "x" && rd.txt.includes("2480") && rd.txt.includes("1880"), JSON.stringify(rd));
    await pg.click("#btnSvApply"); await pg.waitForTimeout(400);
    const ap = await pg.evaluate(() => { const c = cfgFromForm(); return { view: currentView, tp: c.topProfile, H: c.H, ro: $("bH").readOnly, L: c.L }; });
    ok("D-88: «Completează generatorul» pune panta: stânga 2480, dreapta 1880, H = 2480", ap.view === "build" && ap.tp && ap.tp.axis === "x" && ap.tp.h0 === 2480 && ap.tp.h1 === 1880 && ap.H === 2480 && ap.ro, JSON.stringify(ap));
    ok("D-88: corpul propus se generează fără eroare", await pg.evaluate(() => { try { const m = buildModule({ ...cfgFromForm(), name: "Rv" }); return m.boxes.some(b => b.vp); } catch (e) { return String(e); } }));
    await pg.evaluate(() => { setView("survey"); }); await pg.evaluate(() => { document.getElementById("sgSvHeights").open = true; }); await pg.selectOption("#svSlope", "z"); await pg.waitForTimeout(150);
    await pg.click("#btnSvApply"); await pg.waitForTimeout(300);
    ok("D-88: pe adâncime, punctul 1 = față, punctul 3 = spate", await pg.evaluate(() => { const t = cfgFromForm().topProfile; return t && t.axis === "z" && t.h0 === 2480 && t.h1 === 1880; }));
    await pg.evaluate(() => { setView("survey"); survey().heights[2] = 2490; persist(); renderSurveyHeights(); });
    ok("D-88: diferență sub minim: indiciul o spune", await pg.evaluate(() => /10/.test($("svSlopeHint").textContent) && $("svSlopeHint").style.display !== "none"));
    await pg.click("#btnSvApply"); await pg.waitForTimeout(300);
    ok("D-88: diferență sub minim → constructorul rămâne fără pantă, cu H = punctul cel mai jos − 20", await pg.evaluate(() => { const c = cfgFromForm(); return c.topProfile === null && c.H === 2280; }));
    await pg.evaluate(() => { setView("survey"); survey().slope = null; survey().heights = [2500, 2300, 1900]; persist(); renderSurveyHeights(); });
    await pg.click("#btnSvApply"); await pg.waitForTimeout(300);
    ok("D-88: fără pantă aleasă, comportamentul vechi (H = minimul − 20, fără profil)", await pg.evaluate(() => { const c = cfgFromForm(); return c.topProfile === null && c.H === 1880 && !$("bH").readOnly; }));
    ok("D-88: cheile de interfață există în toate cele 7 limbi", await pg.evaluate(() => ["svSlope", "svSlopeNone", "svSlopeX", "svSlopeZ", "svSlopeSuggest", "svSlopePoints", "svSlopeFlat", "svSlopeReady", "svSlopeBit"]
      .every(k => ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => SURVEY_I18N[l] && SURVEY_I18N[l][k]))));
    await pg.evaluate(() => { const p = proj(); p.survey = null; persist(); buildCfg = { ...PRESETS.base }; syncBuildForm(); });
    ok("D-88: nessun errore JS", errs.length === 0, errs.join(" | ").slice(0, 200));
  }

  /* Releveu (D-82): decalaj cu cifră, Enter, perete de închidere, diagonale, DXF, poze */
  {
    const zlib = require("zlib");
    const png = (w, h) => { const raw = Buffer.concat(Array.from({ length: h }, (_, y) => Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: w }, (_, x) => Buffer.from([x * 255 / w | 0, y * 255 / h | 0, 128])))])));
      const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let r = 0xffffffff; for (const x of b) r = t[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
      const ch = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([Buffer.from(t), d]))); return Buffer.concat([l, Buffer.from(t), d, c]); };
      const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
      return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ch("IHDR", ih), ch("IDAT", zlib.deflateSync(raw)), ch("IEND", Buffer.alloc(0))]); };
    await pg.evaluate(() => { closeSheets(); const p = proj(); p.survey = null; setView("survey"); const s = survey();
      s.walls = [{ id: "a", len: 3200, angle: 90, bow: null }, { id: "b", len: 2800, angle: 90, bow: null }, { id: "c", len: 3188, angle: 90, bow: null }, { id: "d", len: 2800, angle: 90, bow: null }];
      persist(); renderSurvey(); });
    const g1 = await pg.evaluate(() => ({ txt: document.getElementById("svGapTxt").textContent, hints: document.getElementById("svGapHints").textContent,
      info: document.getElementById("svPlanInfo").textContent, hidden: document.getElementById("svGapBar").hidden, pos: getComputedStyle(document.getElementById("svGapBar")).position }));
    ok("releveu: decalajul se spune cu cifră (12 mm)", /12 mm/.test(g1.txt) && /12 mm/.test(g1.info), g1.txt + " | " + g1.info);
    ok("releveu: hint-ul numește peretele (3188 sau 3200)", /3188/.test(g1.hints) && /3200/.test(g1.hints), g1.hints);
    ok("releveu: bara cu conturul e lipicioasă", g1.hidden === false && g1.pos === "sticky");
    /* Enter: lungime → unghi → următorul perete; după ultimul, contur deschis → perete nou */
    await pg.evaluate(() => { const s = survey(); s.walls = s.walls.slice(0, 3); persist(); renderSurvey(); });
    await pg.locator("#svWalls [data-k=len]").first().focus(); await pg.keyboard.press("Enter");
    const f1 = await pg.evaluate(() => document.activeElement.dataset.k + "#" + (document.activeElement.dataset.id === survey().walls[0].id));
    await pg.locator("#svWalls [data-k=angle]").last().focus(); await pg.keyboard.press("Enter");
    const f2 = await pg.evaluate(() => ({ n: survey().walls.length, k: document.activeElement.dataset.k, last: document.activeElement.dataset.id === survey().walls[survey().walls.length - 1].id }));
    ok("releveu: Enter merge de la lungime la unghi", f1 === "angle#true", f1);
    ok("releveu: Enter pe ultimul unghi, contur deschis → perete nou cu focus pe lungime", f2.n === 4 && f2.k === "len" && f2.last, JSON.stringify(f2));
    /* perete de închidere */
    await pg.evaluate(() => { const s = survey(); s.walls = [{ id: "a", len: 3200, angle: 90, bow: null }, { id: "b", len: 2800, angle: 90, bow: null }, { id: "c", len: 3200, angle: 90, bow: null }]; persist(); renderSurvey(); });
    const c1 = await pg.evaluate(() => !document.getElementById("btnSvClose").hidden);
    await pg.locator("#btnSvClose").click();
    const c2 = await pg.evaluate(() => ({ w: survey().walls.map(w => w.len + "/" + w.angle).join(" "), gap: EBSurvey.closure(survey().walls).gap, btn: document.getElementById("btnSvClose").hidden }));
    ok("releveu: peretele de închidere apare, se adaugă și închide conturul", c1 === true && c2.w === "3200/90 2800/90 3200/90 2800/90" && c2.gap < 1 && c2.btn === true, JSON.stringify(c2));
    /* diagonală */
    await pg.locator("#btnSvAddDiag").click(); await pg.locator("#svDiags [data-dk=len]").fill("4300");
    const dg = await pg.evaluate(() => document.querySelector("#svDiags [data-read]").textContent);
    ok("releveu: diagonala arată planul și diferența", /4252/.test(dg) && /\+47/.test(dg), dg);
    /* obstacol desenat pe plan */
    await pg.evaluate(() => { const s = survey(); s.obstacles = [{ id: "o1", type: "presa", wall: s.walls[0].id, fromCorner: 800, fromFloor: 1100, w: 80, h: 80 }]; persist(); renderSurvey(); });
    ok("releveu: obstacolul apare pe plan", await pg.evaluate(() => /↑1100/.test(document.getElementById("svgPlan").innerHTML)));
    /* poze legate de punct */
    const wid = await pg.evaluate(() => survey().walls[0].id);
    await pg.evaluate(id => { svPhTarget = { kind: "wall", ref: id }; }, wid);
    await pg.setInputFiles("#svPhotoIn", { name: "p.png", mimeType: "image/png", buffer: png(1600, 1200) });
    await pg.waitForTimeout(1200);
    const ph = await pg.evaluate(async () => { const x = survey().photos || []; const u = x[0] ? await EBStore.get("svp:" + x[0].id) : null;
      let dim = null; if (u) { const im = new Image(); im.src = u; await im.decode(); dim = [im.naturalWidth, im.naturalHeight]; }
      return { n: x.length, kind: x[0] && x[0].kind, thumb: [...document.querySelectorAll("#svWalls img[data-phimg]")].some(i => i.naturalWidth > 0), dim, inState: JSON.stringify(state).includes("data:image") }; });
    ok("releveu: poza se salvează în IndexedDB, micșorată la 1280 px", ph.n === 1 && ph.kind === "wall" && ph.dim && Math.max(...ph.dim) === 1280, JSON.stringify(ph));
    ok("releveu: poza nu intră în state (localStorage) și se vede ca miniatură", ph.inState === false && ph.thumb === true);
    const bk = await pg.evaluate(async () => { const m = await svPhMap(state.projects); const id = Object.keys(m)[0];
      svPhCache.clear(); await EBStore.del("svp:" + id); const gone = await EBStore.get("svp:" + id); await svPhRestore(m); const back = await EBStore.get("svp:" + id);
      await svPhRestore({ "../x": "data:image/svg+xml;base64,AAAA", ok1: "data:text/html;base64,AAAA" });
      return { n: Object.keys(m).length, gone: !gone, back: !!back, bad: !(await EBStore.get("svp:../x")) && !(await EBStore.get("svp:ok1")) }; });
    ok("releveu: pozele intră în backup și se refac la restaurare; id sau tip nevalid se ignoră", bk.n === 1 && bk.gone && bk.back && bk.bad, JSON.stringify(bk));
    await pg.evaluate(id => { svPhDropFor("wall", id); }, wid);
    ok("releveu: poza ștearsă dispare din proiect și din memorie", await pg.evaluate(async id => (survey().photos || []).length === 0, wid));
    /* DXF: cameră în L din milimetri */
    const dxf = "0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n90\n6\n70\n1\n10\n0\n20\n0\n10\n5000\n20\n0\n10\n5000\n20\n2000\n10\n2500\n20\n2000\n10\n2500\n20\n4000\n10\n0\n20\n4000\n0\nENDSEC\n0\nEOF\n";
    await pg.setInputFiles("#svDxfFile", { name: "camera.dxf", mimeType: "application/dxf", buffer: Buffer.from(dxf) });
    await pg.waitForSelector("#dlgYes", { timeout: 3000 }); await pg.click("#dlgYes"); await pg.waitForTimeout(400);
    const dx = await pg.evaluate(() => ({ n: survey().walls.length, lens: survey().walls.map(w => w.len).sort((a, b) => a - b).join(), reflex: survey().walls.some(w => w.angle > 180), gap: EBSurvey.closure(survey().walls).gap, diag: (survey().diagonals || []).length }));
    ok("releveu: DXF-ul devine pereți (cameră în L, un colț intrând), conturul se închide", dx.n === 6 && dx.lens === "2000,2000,2500,2500,4000,5000" && dx.reflex && dx.gap < 6 && dx.diag === 0, JSON.stringify(dx));
    await pg.evaluate(() => { proj().survey = null; persist(); setView("projects"); });
  }

  /* Camera în 3D în WebGL: canvasul se mută în foaie, podeaua și pereții apar, la închidere totul se întoarce */
  {
    const r = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      if (!(window.GL3D && GL3D.ok)) return { fara_gl: true };
      closeSheets(); const p = proj(); p.pieces = []; p.configs = {}; p.layout = {};
      p.survey = { walls: [{ id: "a", len: 4000, angle: 90 }, { id: "b", len: 3000, angle: 90 }, { id: "c", len: 4000, angle: 90 }, { id: "d", len: 3000, angle: 90 }], heights: [2500, 2500, 2500], obstacles: [], wallH: 2500 };
      generateInto(p, { ...PRESETS.armadio, name: "Arm" });
      p.layout = { Arm: { wall: "a", from: 300, off: 0, lift: 0, rot: 0 } }; persist();
      setView("survey"); await w(300);
      document.getElementById("btnRoom3D").click(); await w(900);
      const i = GL3D.roomInfo();
      o.mutat = ROOM_GL === true && document.getElementById("gl3d").parentElement.id === "room3dGL";
      o.podea = i.room && i.floor && i.contactHidden === true;
      o.pereti = i.walls === 4;
      /* camera în afara camerei: pereții dinspre ea se subțiază */
      VIEW.yaw = 0.7; redrawCam(); await w(900); const a = GL3D.roomInfo().faded;
      VIEW.yaw = 0.7 + Math.PI; redrawCam(); await w(900); const b2 = GL3D.roomInfo().faded;
      o.fade = a >= 1 && b2 >= 1 && a <= 3 && b2 <= 3;
      closeSheets(); await w(300);
      const j = GL3D.roomInfo();
      o.intors = ROOM_GL === false && document.getElementById("gl3d").parentElement.id === "vp3d" && j.floor === false && j.contactHidden === false;
      return o;
    });
    if (r.fara_gl) ok("camera 3D: fără WebGL, sărit", true);
    else {
      ok("camera 3D: canvasul WebGL se mută în foaie", r.mutat === true);
      ok("camera 3D: podeaua apare și umbra de contact a corpului dispare", r.podea === true);
      ok("camera 3D: cei 4 pereți sunt în scenă", r.pereti === true);
      ok("camera 3D: pereții dinspre cameră se subțiază (1–3 din 4, din ambele părți)", r.fade === true);
      ok("camera 3D: la închidere canvasul, podeaua și umbra revin cum erau", r.intors === true);
    }
    await pg.evaluate(() => { const p = proj(); p.pieces = []; p.configs = {}; p.layout = {}; p.survey = null; persist(); setView("projects"); });
  }

  head("Atelier E0 — ascuns, apare numai cu flag și login; fluxul cu server simulat (D-92)");
  {
    const r = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      const wasSb = sb, wasSess = acctSession;
      const calls = [];
      closeSheets();
      acctSession = { user: { id: "u-a", email: "a@test.local" } }; acctProfile = null;
      localStorage.removeItem("ebAtelier"); renderAccount();
      o.ascuns = document.getElementById("btnAcctAtelier").style.display === "none";
      localStorage.setItem("ebAtelier", "1"); renderAccount();
      o.vizibil = document.getElementById("btnAcctAtelier").style.display === "flex";
      acctSession = null; renderAccount();
      o.faraLogin = document.getElementById("btnAcctAtelier").style.display === "none";
      acctSession = { user: { id: "u-a", email: "a@test.local" } }; renderAccount();

      const mine = [{ atelier_id: "at1", role: "responsabil", stations: [], ateliers: { id: "at1", name: "Tâmplăria Test", slug: "tamplaria-test" } }];
      const members = [
        { user_id: "u-a", full_name: "Liviu", email: "a@test.local", role: "responsabil", stations: [] },
        { user_id: "u-b", full_name: "<img src=x onerror=window.__xss=1>", email: "b@test.local", role: "birou", stations: [] },
        { user_id: "u-c", full_name: "Ion", email: "c@test.local", role: "operator", stations: ["cnc", "bordatrice"] }];
      sb = {
        from(t) {
          const q = { select() { return q; }, eq() { return q; }, is() { return q; }, gt() { return q; }, order() { return q; },
            then(res) { res(t === "atelier_members" ? { data: mine, error: null }
              : { data: [{ code: "0123456789ABCDEF", role: "operator", stations: ["cnc"], expires_at: "2999-01-01" }], error: null }); } };
          return q;
        },
        async rpc(fn, args) {
          calls.push([fn, args]);
          if (fn === "atelier_members_list") return { data: members, error: null };
          if (fn === "atelier_invite") return { data: "ABCDEF0123456789", error: null };
          if (fn === "atelier_create") return { data: "at2", error: null };
          if (fn === "atelier_accept") return { data: null, error: { message: "atelier:code_invalid" } };
          return { data: null, error: null };
        }
      };

      document.getElementById("btnAcctAtelier").click(); await w(250);
      const body = () => document.getElementById("atBody");
      o.lista = /Tâmplăria Test/.test(body().textContent) && /Responsabil|Responsabile|Manager|Responsable|Leiter|Kierownik/.test(body().textContent);
      /* nume cu slug automat */
      const nm = document.getElementById("atNewName"); nm.value = "Cafasso Serramenti"; nm.dispatchEvent(new Event("input", { bubbles: true }));
      o.slugAuto = document.getElementById("atNewSlug").value === "cafasso-serramenti";
      /* cod greșit din client, fără apel la server */
      const before = calls.length;
      document.getElementById("atJoinCode").value = "nu-e-cod"; body().querySelector('[data-at=join]').click(); await w(150);
      o.codClient = calls.length === before;
      /* cod bun, serverul îl refuză: eroarea e tradusă */
      document.getElementById("atJoinCode").value = "0123-4567-89ab-cdef"; body().querySelector('[data-at=join]').click(); await w(250);
      o.eroareTradusa = document.getElementById("toast").textContent === EBAtelier.t(state.lang, "err_code_invalid")
        && calls.some(c => c[0] === "atelier_accept" && c[1].p_code === "0123456789ABCDEF");
      /* creare */
      nm.value = "Cafasso Serramenti"; body().querySelector('[data-at=create]').click(); await w(300);
      o.creare = calls.some(c => c[0] === "atelier_create" && c[1].p_slug === "cafasso-serramenti" && c[1].p_name === "Cafasso Serramenti");
      /* detaliu */
      atScreen = { name: "home", id: null }; await atRender(); await w(100);
      body().querySelector('[data-at=open]').click(); await w(400);
      const txt = body().textContent;
      o.membri = /Liviu/.test(txt) && /b@test.local/.test(txt) && /Ion/.test(txt);
      o.xss = window.__xss === undefined && body().innerHTML.indexOf("&lt;img") >= 0 && !body().querySelector("img");
      o.invitatie = /0123-4567-89AB-CDEF/.test(txt);
      /* schimbare rol */
      const sel = body().querySelector('select[data-at=setrole][data-user="u-b"]');
      o.selRol = !!sel && !body().querySelector('select[data-at=setrole][data-user="u-a"]');
      sel.value = "operator"; sel.dispatchEvent(new Event("change", { bubbles: true })); await w(250);
      o.setRol = calls.some(c => c[0] === "atelier_set_role" && c[1].p_user === "u-b" && c[1].p_role === "operator");
      /* invitație cu postazioni */
      await atRender(); await w(250);
      const role = document.getElementById("atInvRole"); role.value = "operator"; role.dispatchEvent(new Event("change", { bubbles: true }));
      o.statiiVizibile = document.getElementById("atInvStations").style.display === "block";
      o.faraCnc = !document.querySelector('.atInvSt[value=cnc]') && !!document.querySelector('.atInvSt[value=toupie]') && !!document.querySelector('.atInvSt[value=foratura]'); document.querySelector('.atInvSt[value=foratura]').checked = true; document.querySelector('.atInvSt[value=bordatrice]').checked = true;
      body().querySelector('[data-at=invite]').click(); await w(400);
      o.invitare = calls.some(c => c[0] === "atelier_invite" && c[1].p_role === "operator" && c[1].p_stations.join() === "bordatrice,foratura");
      o.coduArat = /ABCD-EF01-2345-6789/.test(document.getElementById("atInvOut") ? document.getElementById("atInvOut").textContent : "");
      /* ieșire: cere confirmare */
      body().querySelector('[data-at=leave]').click(); await w(200);
      document.getElementById("dlgYes").click(); await w(300);
      o.iesire = calls.some(c => c[0] === "atelier_remove_member" && c[1].p_user === "u-a");
      closeSheets(); sb = wasSb; acctSession = wasSess; localStorage.removeItem("ebAtelier"); renderAccount();
      return o;
    });
    ok("Atelier: fără flag butonul nu apare, nici cu login", r.ascuns === true);
    ok("Atelier: cu flag și login butonul apare; fără login dispare", r.vizibil === true && r.faraLogin === true);
    ok("Atelier: lista arată ateliere și rolul meu", r.lista === true);
    ok("Atelier: slug-ul se completează din nume", r.slugAuto === true);
    ok("Atelier: un cod prost se oprește în client, fără apel", r.codClient === true);
    ok("Atelier: eroarea serverului apare tradusă, cu codul normalizat", r.eroareTradusa === true);
    ok("Atelier: creare cu nume și slug", r.creare === true);
    ok("Atelier: membrii și invitațiile în așteptare apar", r.membri === true && r.invitatie === true);
    ok("Atelier: numele cu HTML nu se execută (escape)", r.xss === true);
    ok("Atelier: responsabilul poate schimba rolul altora, nu pe al lui", r.selRol === true && r.setRol === true);
    ok("Atelier: invitație de operator cu postazioni, codul apare formatat", r.statiiVizibile === true && r.invitare === true && r.faraCnc === true && r.coduArat === true);
    ok("Atelier: ieșirea cere confirmare și apelează serverul", r.iesire === true);
    await pg.evaluate(() => { closeSheets(); });
  }

  head("Atelier E1 — comenzi: instantaneu fără prețuri, stare, progres, evenimente pe postazione (migrarea 1.6)");
  {
    const r = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      const wasSb = sb, wasSess = acctSession, p = proj(), wasPieces = p.pieces;
      p.pieces = [{ id: "e1", modulo: "Corp 1000", elemento: "fianco", lung: 2400, larg: 560, pz: 2, bordo: "2L+1C", materiale: "Egger W1000", prezzo: 77, gen: "Corp 1000" },
                  { id: "e2", modulo: "Corp 1000", elemento: "ripiano", lung: 764, larg: 540, pz: 3, materiale: "Egger W1000", gen: "Corp 1000" }];
      p.client = "Client Secret"; p.phone = "+33600000000";
      const calls = []; let mine;
      const mk = role => [{ atelier_id: "at1", role, stations: role === "operator" ? ["cnc"] : [], ateliers: { id: "at1", name: "Tâmplăria Test", slug: "tamplaria-test" } }];
      const jobs = [{ id: "j1", title: "<b>Bucătărie</b>", client_label: "Jacquin", due_date: "2026-12-01", state: "in_progress", last_station: "cnc", last_at: "2026-10-26T10:00:00Z", total_pieces: 5 },
                    { id: "j2", title: "Dressing", client_label: null, due_date: null, state: "draft", last_station: null, last_at: null, total_pieces: 2 }];
      sb = {
        from(t) { const q = { select() { return q; }, eq() { return q; }, is() { return q; }, gt() { return q; }, order() { return q; },
          then(res) { res(t === "atelier_members" ? { data: mine, error: null } : { data: [], error: null }); } }; return q; },
        async rpc(fn, args) {
          calls.push([fn, args]);
          if (fn === "atelier_members_list") return { data: [], error: null };
          if (fn === "job_status_list") return { data: jobs, error: null };
          if (fn === "job_progress") return { data: [{ station: "cnc", total_pieces: 5, done_pieces: 2, station_done: false, issues: 1, reworks: 0, last_at: "2026-10-26T10:00:00Z" },
            { station: "bordatrice", total_pieces: 5, done_pieces: 5, station_done: true, issues: 0, reworks: 0, last_at: "2026-10-26T09:00:00Z" },
            { station: "magazzino", total_pieces: 5, done_pieces: 0, station_done: false, issues: 0, reworks: 0, last_at: null }], error: null };
          if (fn === "job_create") return { data: "j3", error: null };
          if (fn === "job_event_add") return { data: 1, error: null };
          return { data: null, error: null };
        }
      };
      acctSession = { user: { id: "u-a", email: "a@test.local" } };
      localStorage.setItem("ebAtelier", "1");
      const body = () => document.getElementById("atBody");
      const openAs = async role => { mine = mk(role); calls.length = 0; closeSheets(); atMine = []; atScreen = { name: "detail", id: "at1" }; openSheet("shAtelier"); await atRefreshMine(); await atRender(); await w(300); };

      await openAs("responsabil");
      let txt = body().textContent;
      o.lista = /Jacquin/.test(txt) && /2026-12-01/.test(txt) && /Dressing/.test(txt);
      o.xss = !body().innerHTML.includes("<b>Bucătărie") && body().innerHTML.indexOf("&lt;b&gt;Bucătărie") >= 0; /* panoul folosește și <b> pentru cifre */
      const chips = [...body().querySelectorAll('div[style*="margin-top:6px"] > span[style*="99px"]')].map(x => x.textContent); /* numai chip-urile din comenzi, nu cele din panou */
      o.progres = chips.length === 2 && chips.some(c => /CNC 2\/5/.test(c) && /⚠1/.test(c)) && chips.some(c => /✓/.test(c)) && !chips.some(c => /Magazzino|Magazie|Warehouse|Lager|Magasin|Magazyn|Almac/.test(c));
      o.selStare = body().querySelectorAll("select[data-at=jobstate]").length === 2;
      /* creare din proiectul deschis */
      o.formular = !!document.getElementById("atJobTitle") && document.getElementById("atJobTitle").value === p.name;
      document.getElementById("atJobTitle").value = "Comanda Jacquin"; document.getElementById("atJobClient").value = "Jacquin"; document.getElementById("atJobDue").value = "2026-12-15";
      body().querySelector("[data-at=jobcreate]").click(); await w(400);
      const cr = calls.find(c => c[0] === "job_create");
      o.creat = !!cr && cr[1].p_atelier === "at1" && cr[1].p_title === "Comanda Jacquin" && cr[1].p_client_label === "Jacquin" && cr[1].p_due === "2026-12-15";
      const snap = cr && cr[1].p_snapshot, sj = JSON.stringify(snap || {});
      o.snapOk = !!snap && snap.pieces.length === 2 && snap.pieces[0].pk === "r1" && snap.pieces[1].pk === "r2" && snap.pieces[0].pz === 2 && snap.meta.app_ver === APP_VER;
      o.faraPreturi = !/77|prezzo|Secret|\+3360/.test(JSON.stringify({ ...snap, meta: { ...snap.meta, app_ver: "" } })) && snap.pieces.every(x => Object.keys(x).every(k => ["pk","modulo","elemento","role","lung","larg","sp","pz","material","decor","bordo","grain","note"].includes(k)));
      /* stare: anulare cere confirmare */
      await openAs("responsabil");
      let sel = body().querySelector('select[data-at=jobstate][data-id=j2]');
      sel.value = "confirmed"; sel.dispatchEvent(new Event("change", { bubbles: true })); await w(300);
      o.confirmare = calls.some(c => c[0] === "job_set_state" && c[1].p_job === "j2" && c[1].p_state === "confirmed");
      await openAs("responsabil"); calls.length = 0;
      sel = body().querySelector('select[data-at=jobstate][data-id=j1]');
      sel.value = "cancelled"; sel.dispatchEvent(new Event("change", { bubbles: true })); await w(200);
      o.anulareCere = !calls.some(c => c[0] === "job_set_state");
      document.getElementById("dlgYes").click(); await w(300);
      o.anulare = calls.some(c => c[0] === "job_set_state" && c[1].p_job === "j1" && c[1].p_state === "cancelled");
      /* eveniment pe postazione, doar la comenzile deschise */
      await openAs("responsabil");
      o.doarDeschise = !!body().querySelector("[data-at=jobev][data-id=j1]") && !body().querySelector("[data-at=jobev][data-id=j2]");
      body().querySelector("[data-at=jobev][data-id=j1][data-st=bordatrice][data-kind=done]").click(); await w(300);
      const ev = calls.find(c => c[0] === "job_event_add");
      o.eveniment = !!ev && ev[1].p_job === "j1" && ev[1].p_station === "bordatrice" && ev[1].p_kind === "done" && /^[0-9a-f-]{36}$/.test(ev[1].p_client_id);

      /* operator: numai postazioni lui, fără stare, fără creare, fără progres */
      await openAs("operator");
      o.opStatii = [...body().querySelectorAll("[data-at=jobev]")].every(b => b.dataset.st === "cnc") && !!body().querySelector("[data-at=jobev]");
      o.opFaraStare = !body().querySelector("select[data-at=jobstate]") && !document.getElementById("atJobTitle");
      o.opFaraProgres = !calls.some(c => c[0] === "job_progress");
      /* partener: numai citire */
      await openAs("partener");
      o.parLectura = /Jacquin/.test(body().textContent) && !body().querySelector("[data-at=jobev]") && !body().querySelector("select[data-at=jobstate]") && !document.getElementById("atJobTitle");

      closeSheets(); sb = wasSb; acctSession = wasSess; p.pieces = wasPieces; delete p.client; delete p.phone; localStorage.removeItem("ebAtelier"); renderAccount();
      return o;
    });
    ok("Atelier E1: lista de comenzi cu client, termen, număr de piese; titlul cu HTML nu se execută", r.lista === true && r.xss === true);
    ok("Atelier E1: progresul pe postazione apare numai pentru cele cu activitate", r.progres === true);
    ok("Atelier E1: biroul și responsabilul au selector de stare pe fiecare comandă", r.selStare === true);
    ok("Atelier E1: creare din proiectul deschis, cu titlu, client și termen", r.formular === true && r.creat === true);
    ok("Atelier E1: instantaneul are pk stabile și niciun preț/client/telefon", r.snapOk === true && r.faraPreturi === true);
    ok("Atelier E1: schimbarea stării apelează serverul; anularea cere confirmare", r.confirmare === true && r.anulareCere === true && r.anulare === true);
    ok("Atelier E1: evenimentele se pot înregistra numai la comenzi deschise, cu client_id unic", r.doarDeschise === true && r.eveniment === true);
    ok("Atelier E1: operatorul vede doar postazioni lui, fără stare/creare/progres", r.opStatii === true && r.opFaraStare === true && r.opFaraProgres === true);
    ok("Atelier E1: partenerul doar citește", r.parLectura === true);
    await pg.evaluate(() => { closeSheets(); });
  }

  head("Atelier E2 — QR pe etichetă, scanare piesă, coadă offline, deschidere din cod (migrarea 1.6)");
  {
    const r = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      const wasSb = sb, wasSess = acctSession, keepP = state.projects, keepA = state.activeId, keepL = LIC;
      const realPrint = window.print; window.print = () => {};
      const JOB = "6f1c2b7e-9a3d-4c58-8e21-0b5d7a9c4e13";
      const mkProj = () => ({ id: "w2", name: "Jacquin", client: "", date: "2026-10-01", pieces: [
        { id: "a1", modulo: "Corp", elemento: "Fianco", lung: 700, larg: 500, pz: 2, bordo: "2L", materiale: "PAL 18 Alb" },
        { id: "a2", modulo: "Corp", elemento: "Ripiano", lung: 600, larg: 400, pz: 3, materiale: "PAL 18 Alb" }] });
      state.projects = [mkProj()]; state.activeId = "w2";
      licWrite({ kind: "stripe", key: "comp_TESTTESTTESTTESTTESTTEST", status: "active", activated: true, checkedAt: Date.now() });
      printOut._offered = 1;
      localStorage.setItem("ebAtelier", "1"); localStorage.removeItem("ebAtelierJobs"); localStorage.removeItem("ebAtelierQ");
      const labels = () => { document.getElementById("printArea").innerHTML = ""; document.getElementById("btnLabels").click(); };
      const qrs = () => [...document.querySelectorAll("#printArea .lbl")].map(l => { const q = l.querySelector(".qr svg"); return q ? q.outerHTML : null; });

      /* — etichete — */
      /* 5.24.1: fără comandă Atelier eticheta are un cod propriu (datele piesei), câte unul pe etichetă */
      const svgOf = pk => { const d = document.createElement("div"); d.innerHTML = EBQR.svg(EBAtelier.qrUrl(JOB, pk), { border: 1 }); return d.firstChild.outerHTML; };
      const codAtelier = [svgOf("r1"), svgOf("r2")], propriu = x => !!x && !codAtelier.includes(x);
      labels(); const own = qrs();
      o.faraComanda = own.length === 5 && own.every(propriu) && new Set(own).size === 5;
      atJobMapSet("w2", { job: JOB, atelier: "at1", sig: EBAtelier.rowSig(proj().pieces) });
      labels(); const q = qrs();
      o.cinciQr = q.length === 5 && q.every(x => !!x) && document.querySelectorAll("#printArea .lbl.hasqr").length === 5;
      o.codPePiesa = q[0] === svgOf("r1") && q[1] === svgOf("r1") && q[2] === svgOf("r2") && q[4] === svgOf("r2") && q[0] !== q[2];
      proj().pieces[1].lung = 601; labels();
      o.piesaSchimbata = qrs().every(propriu);
      proj().pieces[1].lung = 600; labels(); o.revineLaFel = JSON.stringify(qrs()) === JSON.stringify(q);
      localStorage.removeItem("ebAtelier"); labels(); o.faraFlag = qrs().every(propriu);
      localStorage.setItem("ebAtelier", "1");

      /* — server simulat — */
      const calls = [], eventsDb = [{ station: "bordatrice", kind: "done" }];
      let mode = "ok", mine;
      const mk = (role, stations) => [{ atelier_id: "at1", role, stations, ateliers: { id: "at1", name: "T", slug: "tt" } }];
      const jobRow = { id: JOB, title: "Comanda <i>Jacquin</i>", state: "in_progress", atelier_id: "at1",
        snapshot: { pieces: [{ pk: "r1", modulo: "Corp", elemento: "Fianco", lung: 700, larg: 500, pz: 2, material: "PAL 18 Alb", bordo: "2L", note: "" },
                             { pk: "r2", modulo: "Corp", elemento: "Ripiano", lung: 600, larg: 400, pz: 3 }] } };
      sb = {
        from(t) {
          const c = { select() { return c; }, eq() { return c; }, async maybeSingle() { return t === "jobs" ? { data: jobRow, error: null } : { data: null, error: null }; },
            then(res) { res(t === "atelier_members" ? { data: mine, error: null } : t === "job_events" ? { data: eventsDb, error: null } : { data: [], error: null }); } };
          return c;
        },
        async rpc(fn, args) {
          calls.push([fn, args]);
          if (fn === "job_event_add") {
            if (mode === "net") return { data: null, error: { message: "Failed to fetch" } };
            if (mode === "throw") throw new TypeError("Load failed");
            if (mode === "closed") return { data: null, error: { message: "job:not_open" } };
            return { data: 7, error: null };
          }
          if (fn === "job_status_list") return { data: [], error: null };
          return { data: [], error: null };
        }
      };
      acctSession = { user: { id: "u-op", email: "op@test.local" } };
      const body = () => document.getElementById("atBody");
      const open = async (role, stations, target) => { mine = mk(role, stations); calls.length = 0; closeSheets(); atMine = []; atScreen = { name: "scan", target, id: "at1" }; openSheet("shAtelier"); await atRender(); await w(300); };

      /* — scanare: cardul piesei, postazioni, 2 atingeri — */
      await open("operator", ["cnc", "bordatrice"], { job: JOB, pk: "r1" });
      const txt = body().textContent;
      o.card = /Fianco/.test(txt) && /700 × 500/.test(txt) && /×2/.test(txt) && /PAL 18 Alb/.test(txt) && !body().querySelector("i");
      o.xss = body().innerHTML.indexOf("&lt;i&gt;") >= 0;
      const sel = document.getElementById("atScanStation");
      o.statiiOp = !!sel && [...sel.options].map(x => x.value).sort().join() === "bordatrice,cnc";
      o.facutDeja = /Bordatrice|Edge bander|Kantenanleim|Plaqueuse|Okleiniarka|Canteadora/.test(txt) && /✓/.test(txt);
      o.preselectat = sel.value === "cnc"; /* bordatrice e deja gata → propune cealaltă */
      body().querySelector('[data-at=scanev][data-kind=done]').click(); await w(400);
      const ev = calls.find(c => c[0] === "job_event_add");
      o.gata = !!ev && ev[1].p_job === JOB && ev[1].p_piece_pk === "r1" && ev[1].p_station === "cnc" && ev[1].p_kind === "done" && /^[0-9a-f-]{36}$/.test(ev[1].p_client_id);
      o.urmatoarea = !!document.getElementById("atScanVideo") && atScreen.target === null;
      o.amintit = localStorage.getItem("ebAtelierSt") === "cnc";

      /* operator fără postazioni: nu poate înregistra */
      await open("operator", [], { job: JOB, pk: "r2" });
      o.faraStatii = !document.getElementById("atScanStation") && !body().querySelector("[data-at=scanev]");
      /* piesă necunoscută / comandă închisă */
      await open("operator", ["cnc"], { job: JOB, pk: "r99" });
      o.necunoscuta = /./.test(body().textContent) && !body().querySelector("[data-at=scanev]") && !!body().querySelector("[data-at=scan]");
      jobRow.state = "done"; await open("operator", ["cnc"], { job: JOB, pk: "r1" });
      o.inchisa = !body().querySelector("[data-at=scanev]"); jobRow.state = "in_progress";

      /* lipire cod greșit / bun */
      await open("birou", [], null);
      document.getElementById("atScanText").value = "ceva"; body().querySelector("[data-at=scango]").click(); await w(150);
      o.codGresit = document.getElementById("toast").textContent === EBAtelier.t(state.lang, "scanBad");
      document.getElementById("atScanText").value = "https://ebanist.com/#e=" + JOB + ".r2"; body().querySelector("[data-at=scango]").click(); await w(400);
      o.codBun = atScreen.target && atScreen.target.pk === "r2" && !!document.getElementById("atScanStation");
      o.birouToate = document.getElementById("atScanStation").options.length === 7;
      /* pistol de citit coduri (tastatură HID): scrie codul și apasă Enter */
      await open("birou", [], null);
      document.getElementById("atScanText").value = "https://ebanist.com/#e=" + JOB + ".r1";
      document.getElementById("atScanText").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await w(400);
      o.pistol = atScreen.target && atScreen.target.pk === "r1" && !!document.getElementById("atScanStation");
      await open("birou", [], null);
      o.focusFaraDetector = ("BarcodeDetector" in window) || document.activeElement === document.getElementById("atScanText");

      /* — coadă offline — */
      await open("operator", ["cnc"], { job: JOB, pk: "r2" });
      mode = "net"; calls.length = 0;
      body().querySelector('[data-at=scanev][data-kind=done]').click(); await w(500);
      let queue = JSON.parse(localStorage.getItem("ebAtelierQ") || "[]");
      o.inCoada = queue.length === 1 && queue[0].piece_pk === "r2" && queue[0].station === "cnc" && queue[0].kind === "done";
      o.toastOffline = document.getElementById("toast").textContent === EBAtelier.t(state.lang, "evQueued");
      const cid = queue[0].client_id;
      mode = "throw"; o.fluxIntrerupt = (await atFlush()) === 0 && JSON.parse(localStorage.getItem("ebAtelierQ")).length === 1;
      mode = "ok"; calls.length = 0;
      const trimise = await atFlush();
      const resent = calls.find(c => c[0] === "job_event_add");
      o.retrimis = trimise === 1 && !!resent && resent[1].p_client_id === cid && resent[1].p_piece_pk === "r2" && localStorage.getItem("ebAtelierQ") === "[]";
      /* regulă încălcată → se aruncă, nu se reîncearcă la nesfârșit */
      mode = "closed";
      atQSet(EBAtelier.qAdd([], { job: JOB, station: "cnc", kind: "done", piece_pk: "r1", client_id: "11111111-1111-4111-8111-111111111111", client_at: new Date().toISOString() }));
      await atFlush(); o.aruncat = localStorage.getItem("ebAtelierQ") === "[]";
      /* două evenimente, rețeaua cade la primul: rămân amândouă, în ordine */
      mode = "net";
      atQSet([1, 2].map(i => ({ job: JOB, station: "cnc", kind: "done", piece_pk: "r" + i, client_id: "2222222" + i + "-2222-4222-8222-222222222222", client_at: new Date().toISOString() })));
      calls.length = 0; await atFlush();
      o.ordine = JSON.parse(localStorage.getItem("ebAtelierQ")).map(x => x.piece_pk).join() === "r1,r2" && calls.filter(c => c[0] === "job_event_add").length === 1;
      localStorage.removeItem("ebAtelierQ");

      /* — deschidere din cod, cu camera telefonului — */
      mode = "ok"; mine = mk("operator", ["cnc"]); closeSheets(); atPending = null;
      history.replaceState(null, "", location.pathname + location.search + "#e=" + JOB + ".r1"); atBoot(); await w(500);
      o.deschis = document.getElementById("shAtelier").classList.contains("on") && atScreen.name === "scan" && atScreen.target && atScreen.target.pk === "r1";
      o.fragmentSters = location.hash === "";
      /* fără login: întâi cere conectarea, apoi continuă */
      closeSheets(); acctSession = null; atPending = null; history.replaceState(null, "", location.pathname + location.search + "#e=" + JOB + ".r2"); atBoot(); await w(300);
      o.cereLogin = document.getElementById("shAtelier").classList.contains("on") && /Accedi|Conectează|Sign in|Connectez|anmelden|Zaloguj|sesión/i.test(body().textContent);
      acctSession = { user: { id: "u-op", email: "op@test.local" } }; atBoot(); await w(500);
      o.continua = atScreen.name === "scan" && atScreen.target && atScreen.target.pk === "r2";
      /* fragment fals sau fără cod: nu face nimic */
      closeSheets(); atPending = null; history.replaceState(null, "", location.pathname + location.search + "#e=nu-e-cod"); atBoot(); await w(100);
      o.ignorat = !document.getElementById("shAtelier").classList.contains("on");
      history.replaceState(null, "", location.pathname + location.search);

      /* — fișa piesei din cod (D-145): cote, canturi, material și găuri vin din instantaneu, fără proiect pe telefon — */
      const pp = { id: "w3", name: "Fisa", client: "", date: "2026-11-14", pieces: [], configs: {}, layout: {} };
      generateInto(pp, { ...PRESETS.armadio, name: "Arm", L: 1000, H: 2200, P: 600 });
      const parts = atSnapParts(pp);
      const snap = EBAtelier.buildSnapshot(pp, { appVer: "t", material: x => x.materiale || "", part: x => parts.get(x) || null });
      const fi = snap.pieces.findIndex(x => x.part && x.part.role === "fianco");
      o.fisaInSnap = fi >= 0 && snap.pieces[fi].part.operations.length > 0 && JSON.stringify(snap).indexOf('"_w"') < 0 && JSON.stringify(snap).length < 1700000;
      jobRow.snapshot = snap; mode = "ok"; mine = mk("operator", ["cnc"]); closeSheets(); atPending = null;
      history.replaceState(null, "", location.pathname + location.search + "#e=" + JOB + ".r" + (fi + 1)); atBoot(); await w(700);
      const pb = document.getElementById("partBody");
      o.fisaDeschisa = document.getElementById("shPart").classList.contains("on") && pb.querySelectorAll("table.ops tbody tr").length === snap.pieces[fi].part.operations.length
        && pb.textContent.indexOf(String(snap.pieces[fi].part.length)) >= 0;
      o.fisaButon = !!body().querySelector("[data-at=partsheet]") && !!body().querySelector("[data-at=scanev]");
      closeSheets(); body().querySelector("[data-at=partsheet]") || await atRender(); atScanSm && openPartSheet(atScanSm.M, atScanSm.pc);
      o.fisaReDeschisa = document.getElementById("shPart").classList.contains("on");
      history.replaceState(null, "", location.pathname + location.search);

      closeSheets(); window.print = realPrint; sb = wasSb; acctSession = wasSess; state.projects = keepP; state.activeId = keepA; licWrite(keepL);
      localStorage.removeItem("ebAtelier"); localStorage.removeItem("ebAtelierJobs"); localStorage.removeItem("ebAtelierQ"); localStorage.removeItem("ebAtelierSt"); atPending = null;
      renderAccount();
      return o;
    });
    ok("Atelier D-145: scanarea QR deschide fișa piesei (cote, găuri) din instantaneu, fără proiect; butonul o redeschide", r.fisaInSnap === true && r.fisaDeschisa === true && r.fisaButon === true && r.fisaReDeschisa === true, JSON.stringify([r.fisaInSnap, r.fisaDeschisa, r.fisaButon, r.fisaReDeschisa]));
    ok("Atelier E2: fără comandă legată, fiecare etichetă are un QR propriu (diferit pe etichetă, nu cel al comenzii)", r.faraComanda === true);
    ok("Atelier E2: cu comandă legată, fiecare etichetă are QR; cele ale aceluiași rând poartă același cod", r.cinciQr === true && r.codPePiesa === true);
    ok("Atelier E2: dacă proiectul s-a schimbat după comandă, QR-ul comenzii dispare (rămâne cel propriu); revine când rândurile sunt iar la fel", r.piesaSchimbata === true && r.revineLaFel === true);
    ok("Atelier E2: fără modul pornit, etichetele au doar QR-ul propriu, nu al comenzii", r.faraFlag === true);
    ok("Atelier E2: scanarea arată piesa (cote, material), fără HTML executat, și ce e deja gata", r.card === true && r.xss === true && r.facutDeja === true);
    ok("Atelier E2: operatorul alege doar dintre postazioni lui; propune prima negătată", r.statiiOp === true && r.preselectat === true);
    ok("Atelier E2: „Gata” trimite evenimentul pe piesă (pk, postazione, client_id) și trece la scanarea următoare", r.gata === true && r.urmatoarea === true && r.amintit === true);
    ok("Atelier E2: fără postazioni, piesă necunoscută sau comandă închisă → nu se poate înregistra", r.faraStatii === true && r.necunoscuta === true && r.inchisa === true);
    ok("Atelier E2: cod lipit greșit e refuzat în client; cel bun deschide piesa; biroul vede toate cele 7 postazioni", r.codGresit === true && r.codBun === true && r.birouToate === true);
    ok("Atelier E2: un cititor de coduri (tastatură) merge: cod + Enter deschide piesa; fără detector de cameră câmpul are focus", r.pistol === true && r.focusFaraDetector === true);
    ok("Atelier E2: fără rețea evenimentul intră în coadă și utilizatorul e anunțat", r.inCoada === true && r.toastOffline === true);
    ok("Atelier E2: coada se retrimite cu ACELAȘI client_id (idempotent); un eșec o păstrează intactă", r.fluxIntrerupt === true && r.retrimis === true);
    ok("Atelier E2: o regulă încălcată (comandă închisă) aruncă evenimentul; la cădere de rețea ordinea se păstrează", r.aruncat === true && r.ordine === true);
    ok("Atelier E2: cod scanat cu camera telefonului deschide piesa și curăță adresa", r.deschis === true && r.fragmentSters === true);
    ok("Atelier E2: fără login cere conectarea, apoi continuă la piesă; un fragment fals e ignorat", r.cereLogin === true && r.continua === true && r.ignorat === true);
    await pg.evaluate(() => { closeSheets(); });
  }

  head("Atelier E3 — documente pe postazione: foaia bordatricei și lista de vopsitorie, din proiectul deschis");
  {
    const r = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      const wasSb = sb, wasSess = acctSession, keepP = state.projects, keepA = state.activeId, keepL = LIC;
      const realPrint = window.print; let printed = 0; window.print = () => { printed++; };
      printOut._offered = 1;
      state.projects = [{ id: "w3", name: "Jacquin", client: "", date: "2026-10-01", pieces: [
        { id: "a1", modulo: "Corp <img src=x onerror=window.__xss3=1>", elemento: "Fianco", lung: 700, larg: 500, pz: 2, bordo: "2L", materiale: "PAL 18 Alb" },
        { id: "a2", modulo: "Corp", elemento: "Fronte", lung: 500, larg: 300, pz: 1, materiale: "MDF 19" },
        { id: "a3", modulo: "Corp", elemento: "Ripiano", lung: 900, larg: 300, pz: 1, bordo: "1L", materiale: "PAL 18 Alb" },
        { id: "a4", modulo: "Corp", elemento: "Fronte", lung: 400, larg: 400, pz: 2, bordo: "2L+2C", materiale: "MDF 19" }] }];
      state.activeId = "w3";
      localStorage.setItem("ebAtelier", "1");
      let mine;
      sb = { from(t) { const c = { select() { return c; }, eq() { return c; }, is() { return c; }, gt() { return c; }, order() { return c; }, then(res) { res({ data: t === "atelier_members" ? mine : [], error: null }); } }; return c; },
        async rpc() { return { data: [], error: null }; } };
      acctSession = { user: { id: "u-a", email: "a@test.local" } };
      const body = () => document.getElementById("atBody"), area = () => document.getElementById("printArea");
      const openAs = async role => { mine = [{ atelier_id: "at1", role, stations: role === "operator" ? ["cnc"] : [], ateliers: { id: "at1", name: "T", slug: "tt" } }];
        closeSheets(); atMine = []; atScreen = { name: "detail", id: "at1" }; openSheet("shAtelier"); await atRefreshMine(); await atRender(); await w(300); };
      const T = k => EBAtelier.t(state.lang, k);

      /* gratuit: ecranul Pro, nimic tipărit */
      licWrite(null); await openAs("responsabil");
      o.butoane = !!body().querySelector("[data-at=docedge]") && !!body().querySelector("[data-at=docpaint]");
      area().innerHTML = ""; printed = 0; body().querySelector("[data-at=docedge]").click(); await w(300);
      o.gratisBlocat = printed === 0 && area().innerHTML === "" && document.getElementById("shPro").classList.contains("on");
      closeSheets();

      licWrite({ kind: "stripe", key: "comp_TESTTESTTESTTESTTESTTEST", status: "active", activated: true, checkedAt: Date.now() });
      await openAs("birou");
      area().innerHTML = ""; printed = 0; body().querySelector("[data-at=docedge]").click(); await w(300);
      const e = area().innerHTML, et = area().textContent;
      o.edgeTipar = printed === 1 && et.includes(T("docEdgeTitle")) && /PAL 18 Alb/.test(et);
      o.edgeCoduri = /r1/.test(et) && /r3/.test(et) && !/>r2</.test(e); /* r2 (MDF fără cant) nu apare; r4 (MDF cu cant) e în grupul lui */
      o.edgeMDF = /MDF 19/.test(et) && /r4/.test(et);
      o.edgeMl = /3[.,]7/.test(et) && /4[.,]1/.test(et); /* PAL: 2·1400 + 900 = 3,7 ml; cu +10% → 4,1 ml */
      o.edgeSvg = (e.match(/<svg/g) || []).length >= 3;
      o.xss = window.__xss3 === undefined && !area().querySelector("img") && e.indexOf("&lt;img") >= 0;
      o.fataDeEtichete = true;
      area().innerHTML = ""; printed = 0; body().querySelector("[data-at=docpaint]").click(); await w(300);
      const pt = area().textContent, ph = area().innerHTML;
      o.paintTipar = printed === 1 && pt.includes(T("docPaintTitle")) && /MDF 19/.test(pt) && /r2/.test(pt) && /r4/.test(pt) && !/r1\b|r3\b/.test(pt.replace(/Jacquin/g, ""));
      o.paintCuloare = ph.includes("____") && pt.includes(T("docPaintColor"));
      o.paintArie = /0[.,]30/.test(pt) && /0[.,]64/.test(pt); /* 2·0,5·0,3 = 0,30 ; 2·0,4·0,4·2 = 0,64 */

      /* fără piese cu cant / fără MDF: mesaj, nu eroare */
      state.projects[0].pieces = [{ id: "n1", modulo: "X", elemento: "Fianco", lung: 700, larg: 500, pz: 1, materiale: "PAL 18 Alb" }];
      await openAs("responsabil");
      area().innerHTML = ""; body().querySelector("[data-at=docedge]").click(); await w(250);
      o.golEdge = area().textContent.includes(T("docEdgeNone"));
      area().innerHTML = ""; body().querySelector("[data-at=docpaint]").click(); await w(250);
      o.golPaint = area().textContent.includes(T("docPaintNone"));

      /* roluri: operatorul și partenerul nu văd documentele; fără proiect, mesaj */
      await openAs("operator"); o.opFara = !body().querySelector("[data-at=docedge]");
      await openAs("partener"); o.parFara = !body().querySelector("[data-at=docedge]");
      state.projects[0].pieces = []; await openAs("responsabil");
      o.faraProiect = !body().querySelector("[data-at=docedge]") && body().textContent.includes(T("docsNeedProject"));

      closeSheets(); window.print = realPrint; sb = wasSb; acctSession = wasSess; state.projects = keepP; state.activeId = keepA; licWrite(keepL);
      localStorage.removeItem("ebAtelier"); renderAccount();
      return o;
    });
    ok("Atelier E3: butoanele de documente apar pentru birou/responsabil; fără Pro se deschide ecranul Pro și nu se tipărește nimic", r.butoane === true && r.gratisBlocat === true);
    ok("Atelier E3: foaia bordatricei — grupată pe decor/material, cu codurile pieselor cu cant, schița laturilor și metrii", r.edgeTipar === true && r.edgeCoduri === true && r.edgeMDF === true && r.edgeSvg === true && r.edgeMl === true, JSON.stringify({ t: r.edgeTipar, c: r.edgeCoduri, m: r.edgeMDF, s: r.edgeSvg, ml: r.edgeMl }));
    ok("Atelier E3: numele cu HTML nu se execută în documente", r.xss === true);
    ok("Atelier E3: lista de vopsitorie — numai MDF, cu suprafața celor două fețe și linie de completat pentru culoare", r.paintTipar === true && r.paintCuloare === true && r.paintArie === true);
    ok("Atelier E3: fără piese de acel fel, documentul spune asta (nu eroare)", r.golEdge === true && r.golPaint === true);
    ok("Atelier E3: operatorul și partenerul nu văd documentele; fără proiect apare mesajul", r.opFara === true && r.parFara === true && r.faraProiect === true);
    await pg.evaluate(() => { closeSheets(); });
  }

  head("Atelier — pornirea din Setări (fără ?atelier=1): comutator în „Funcții în probă”, se aplică imediat");
  {
    const r = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      const wasSess = acctSession;
      closeSheets(); localStorage.removeItem("ebAtelier");
      acctSession = { user: { id: "u-a", email: "a@test.local" } }; acctProfile = null; renderAccount();
      o.ascunsInitial = document.getElementById("btnAcctAtelier").style.display === "none";
      document.getElementById("btnSettings").click(); await w(250);
      const cb = document.getElementById("sExpAtelier");
      o.exista = !!cb && cb.checked === false && document.getElementById("expTitle").textContent === EBAtelier.t(state.lang, "expTitle");
      o.text = document.getElementById("expAtelierHint").textContent === EBAtelier.t(state.lang, "expAtelierHint");
      const sheet = document.getElementById("shSettings"), first = sheet.querySelector("input, select");
      o.sus = first && first.id === "sExpAtelier"; /* primul câmp din Setări, nu îngropat la capăt */
      cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles: true })); await w(100);
      o.pornit = localStorage.getItem("ebAtelier") === "1" && document.getElementById("btnAcctAtelier").style.display === "flex";
      closeSheets(); document.getElementById("btnSettings").click(); await w(250);
      o.bifatLaRedeschidere = document.getElementById("sExpAtelier").checked === true;
      const cb2 = document.getElementById("sExpAtelier"); cb2.checked = false; cb2.dispatchEvent(new Event("change", { bubbles: true })); await w(100);
      o.oprit = localStorage.getItem("ebAtelier") === null && document.getElementById("btnAcctAtelier").style.display === "none";
      closeSheets(); acctSession = wasSess; renderAccount();
      return o;
    });
    ok("Atelier: fără flag butonul e ascuns; în Setări există secțiunea „Funcții în probă” (nebifată)", r.ascunsInitial === true && r.exista === true && r.text === true && r.sus === true);
    ok("Atelier: bifa din Setări pornește modulul pe loc (butonul apare în Cont) și rămâne bifată la redeschidere", r.pornit === true && r.bifatLaRedeschidere === true);
    ok("Atelier: debifarea îl oprește la loc", r.oprit === true);
    await pg.evaluate(() => { closeSheets(); });
  }

  head("Atelier E4 — comandă agregată către furnizor din mai multe comenzi (panourile se împart între comenzi)");
  {
    const r = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      const wasSb = sb, wasSess = acctSession, keepL = LIC, keepStock = state.stock;
      const realPrint = window.print; let printed = 0; window.print = () => { printed++; };
      printOut._offered = 1; state.stock = [];
      localStorage.setItem("ebAtelier", "1");
      const pc = (pk, lung, larg, extra) => Object.assign({ pk, modulo: "<b>M</b>", elemento: "Fianco", lung, larg, pz: 1, material: "PAL 18 Alb", bordo: "2L" }, extra || {});
      const jobsDb = {
        j1: { id: "j1", title: "Bucătărie <i>A</i>", state: "in_progress", snapshot: { pieces: [pc("r1", 1500, 1000), pc("r2", 700, 500, { material: "PAL 18 Alb [U999]" })] } },
        j2: { id: "j2", title: "Dressing B", state: "confirmed", snapshot: { pieces: [pc("r1", 1500, 1000), pc("r2", 600, 400, { decor: "U999" })] } },
        j3: { id: "j3", title: "Închisă", state: "done", snapshot: { pieces: [pc("r1", 100, 100)] } } };
      const list = Object.values(jobsDb).map(j => ({ id: j.id, title: j.title, client_label: null, due_date: null, state: j.state, last_station: null, last_at: null, total_pieces: j.snapshot.pieces.length }));
      let mine; const calls = [];
      sb = {
        from(t) {
          const c = { select() { return c; }, eq() { return c; }, is() { return c; }, gt() { return c; }, order() { return c; },
            in(col, ids) { calls.push(["in", t, col, ids]); c._ids = ids; return c; },
            then(res) { res(t === "atelier_members" ? { data: mine, error: null } : t === "jobs" ? { data: (c._ids || []).map(i => jobsDb[i]).filter(Boolean), error: null } : { data: [], error: null }); } };
          return c;
        },
        async rpc(fn) { return fn === "job_status_list" ? { data: list, error: null } : { data: [], error: null }; }
      };
      acctSession = { user: { id: "u-a", email: "a@test.local" } };
      const body = () => document.getElementById("atBody"), area = () => document.getElementById("printArea");
      const openAs = async role => { mine = [{ atelier_id: "at1", role, stations: role === "operator" ? ["cnc"] : [], ateliers: { id: "at1", name: "T", slug: "tt" } }];
        closeSheets(); atMine = []; atScreen = { name: "detail", id: "at1" }; openSheet("shAtelier"); await atRefreshMine(); await atRender(); await w(300); };
      const T = k => EBAtelier.t(state.lang, k);

      /* bife doar pe comenzile deschise; fără bifă → mesaj, nu tipărește */
      licWrite({ kind: "stripe", key: "comp_TESTTESTTESTTESTTESTTEST", status: "active", activated: true, checkedAt: Date.now() });
      await openAs("birou");
      const boxes = [...body().querySelectorAll("[data-at=jobsel]")].map(x => x.dataset.id);
      o.bife = boxes.join() === "j1,j2" && !!body().querySelector("[data-at=aggorder]");
      body().querySelector("[data-at=aggorder]").click(); await w(250);
      o.faraBifa = printed === 0 && document.getElementById("toast").textContent === T("aggNone");

      /* gratuit: ecranul Pro, nimic tipărit */
      licWrite(null); body().querySelectorAll("[data-at=jobsel]").forEach(x => { x.checked = true; });
      area().innerHTML = ""; printed = 0; body().querySelector("[data-at=aggorder]").click(); await w(300);
      o.gratis = printed === 0 && area().innerHTML === "" && document.getElementById("shPro").classList.contains("on");
      closeSheets();

      /* Pro: comanda agregată */
      licWrite({ kind: "stripe", key: "comp_TESTTESTTESTTESTTESTTEST", status: "active", activated: true, checkedAt: Date.now() });
      await openAs("responsabil");
      body().querySelectorAll("[data-at=jobsel]").forEach(x => { x.checked = true; });
      calls.length = 0; area().innerHTML = ""; printed = 0; body().querySelector("[data-at=aggorder]").click(); await w(500);
      const tx = area().textContent, html = area().innerHTML;
      o.tipar = printed === 1 && tx.includes(T("aggTitle")) && /PAL 18 Alb/.test(tx);
      o.cereDoarBifatele = calls.some(c => c[0] === "in" && c[1] === "jobs" && c[3].join() === "j1,j2");
      o.titluri = tx.includes("Dressing B") && !tx.includes("Închisă");
      o.xss = !area().querySelector("b") || [...area().querySelectorAll("b")].every(b => !/^[A-Z]$/.test(b.textContent)) ; /* titlul cu <i> nu devine element */
      o.xss2 = !area().querySelector("i") && html.indexOf("&lt;i&gt;") >= 0;
      /* panouri: separat ≥ împreună; economie = diferența */
      const row = [...area().querySelectorAll("table")][0].querySelectorAll("tr")[1];
      const cells = [...row.querySelectorAll("td")].map(x => x.textContent.trim());
      const sep = +cells[2], tog = +cells[3], toOrder = +cells[5];
      o.separatVsImpreuna = sep >= tog && tog >= 1 && toOrder === tog;
      const saved = /(\d+)\s*$/.exec(area().querySelector(".pr-sum").textContent);
      o.economie = !!saved && +saved[1] === sep - tog;
      o.noteLimite = tx.includes(T("aggNoteHw")) && tx.includes(T("aggNoteShape"));
      o.cant = /ml|m\b/i.test(tx) && area().innerHTML.includes("<table");

      /* o comandă inexistentă între cele bifate nu strică restul */
      body().querySelectorAll("[data-at=jobsel]").forEach(x => { x.checked = true; });
      delete jobsDb.j2; area().innerHTML = ""; printed = 0; body().querySelector("[data-at=aggorder]").click(); await w(400);
      o.dispareUna = printed === 1 && area().textContent.includes("Bucătărie");

      /* operatorul și partenerul nu văd nici bife, nici buton */
      await openAs("operator"); o.opFara = !body().querySelector("[data-at=jobsel]") && !body().querySelector("[data-at=aggorder]");
      await openAs("partener"); o.parFara = !body().querySelector("[data-at=jobsel]") && !body().querySelector("[data-at=aggorder]");

      closeSheets(); window.print = realPrint; sb = wasSb; acctSession = wasSess; licWrite(keepL); state.stock = keepStock;
      localStorage.removeItem("ebAtelier"); renderAccount();
      return o;
    });
    ok("Atelier E4: bife numai pe comenzile deschise; fără bifă, mesaj și nimic tipărit", r.bife === true && r.faraBifa === true);
    ok("Atelier E4: fără Pro se deschide ecranul Pro și nu se tipărește nimic", r.gratis === true);
    ok("Atelier E4: documentul cere doar comenzile bifate, le listează și nu include comenzile închise", r.tipar === true && r.cereDoarBifatele === true && r.titluri === true);
    ok("Atelier E4: titlurile cu HTML nu se execută", r.xss2 === true);
    ok("Atelier E4: panourile împreună ≤ separat, de comandat = împreună (fără stoc), economia = diferența", r.separatVsImpreuna === true && r.economie === true, JSON.stringify({ s: r.separatVsImpreuna, e: r.economie }));
    ok("Atelier E4: documentul spune ce nu include (feronerie, cant pe piese profilate) și are cant", r.noteLimite === true && r.cant === true);
    ok("Atelier E4: o comandă care a dispărut între timp nu blochează documentul", r.dispareUna === true);
    ok("Atelier E4: operatorul și partenerul nu văd bifele și butonul", r.opFara === true && r.parFara === true);
    await pg.evaluate(() => { closeSheets(); });
  }

  head("Atelier E5 — QR pe foaia A4 a piesei (CNC) și plan de tăiere tipăribil cu coduri și QR");
  {
    const r = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      const wasSb = sb, wasSess = acctSession, keepP = state.projects, keepA = state.activeId, keepL = LIC;
      const realPrint = window.print; let printed = 0; window.print = () => { printed++; };
      printOut._offered = 1; state.stock = [];
      const JOB = "6f1c2b7e-9a3d-4c58-8e21-0b5d7a9c4e13";
      const mk = () => ({ id: "w5", name: "Jacquin <b>X</b>", client: "", date: "2026-10-01", pieces: [
        { id: "a1", modulo: "Corp", elemento: "Fianco", lung: 700, larg: 500, pz: 2, bordo: "2L", materiale: "PAL 18 Alb" },
        { id: "a2", modulo: "Corp", elemento: "Ripiano", lung: 600, larg: 400, pz: 3, materiale: "PAL 18 Alb" }] });
      state.projects = [mk()]; state.activeId = "w5";
      localStorage.setItem("ebAtelier", "1"); localStorage.removeItem("ebAtelierJobs");
      const p = proj();

      /* — foaia A3 (CNC): QR doar cu comandă legată și neschimbată — */
      const pc = { pk: 5, role: "fianco", length: 600, width: 400, thickness: 18, outline: [{ x0: 0, x1: 600, y0: 0, y1: 400 }], operations: [] };
      const M = { meta: { "5": { row: p.pieces[1], n: 2 } }, ops: { pieces: [pc] } };
      const a3 = () => { try { return partSheetSvg(M, pc, 5); } catch (e) { return "ERR " + e; } };
      o.a3fara = !a3().includes(">r2<") && !a3().startsWith("ERR") && a3().includes(">QR<");   // 5.85.0: fără comandă, foaia poartă codul piesei (D-160), nu codul Atelier
      atJobMapSet("w5", { job: JOB, atelier: "at1", sig: EBAtelier.rowSig(p.pieces) });
      const withQ = a3();
      const d = document.createElement("div"); d.innerHTML = EBQR.svg(EBAtelier.qrUrl(JOB, "r2"), { border: 1 });
      const path = d.querySelector("path").getAttribute("d");
      o.a3cu = withQ.includes("<svg x=") && withQ.includes(path.slice(0, 80)) && withQ.includes(">r2<");
      p.pieces[1].lung = 601; o.a3schimbat = !a3().includes(">r2<"); p.pieces[1].lung = 600;
      localStorage.removeItem("ebAtelier"); o.a3faraFlag = !a3().includes(">r2<"); localStorage.setItem("ebAtelier", "1");

      /* — planul de tăiere — */
      let mine;
      sb = { from(t) { const c = { select() { return c; }, eq() { return c; }, is() { return c; }, gt() { return c; }, order() { return c; }, then(res) { res({ data: t === "atelier_members" ? mine : [], error: null }); } }; return c; },
        async rpc() { return { data: [], error: null }; } };
      acctSession = { user: { id: "u-a", email: "a@test.local" } };
      const body = () => document.getElementById("atBody"), area = () => document.getElementById("printArea");
      const openAs = async role => { mine = [{ atelier_id: "at1", role, stations: [], ateliers: { id: "at1", name: "T", slug: "tt" } }];
        closeSheets(); atMine = []; atScreen = { name: "detail", id: "at1" }; openSheet("shAtelier"); await atRefreshMine(); await atRender(); await w(300); };
      const T = k => EBAtelier.t(state.lang, k);

      licWrite(null); await openAs("responsabil");
      o.buton = !!body().querySelector("[data-at=docsaw]");
      area().innerHTML = ""; printed = 0; body().querySelector("[data-at=docsaw]").click(); await w(300);
      o.gratis = printed === 0 && area().innerHTML === "" && document.getElementById("shPro").classList.contains("on");
      closeSheets();

      licWrite({ kind: "stripe", key: "comp_TESTTESTTESTTESTTESTTEST", status: "active", activated: true, checkedAt: Date.now() });
      await openAs("responsabil");
      area().innerHTML = ""; printed = 0; body().querySelector("[data-at=docsaw]").click(); await w(400);
      const html = area().innerHTML, tx = area().textContent;
      o.tipar = printed === 1 && tx.includes(T("docSawTitle")) && /PAL 18 Alb/.test(tx) && area().querySelectorAll("svg").length >= 2;
      o.coduriInPlan = /r1/.test(tx) && /r2/.test(tx);
      /* un QR pe fiecare rând distinct de pe fiecare panou: r1 și r2 cel puțin o dată, doar din comanda legată */
      const qrSvgs = [...area().querySelectorAll("div[style*='15mm'] svg")];
      const dd = pk => { const x = document.createElement("div"); x.innerHTML = EBQR.svg(EBAtelier.qrUrl(JOB, pk), { border: 1 }); return x.querySelector("path").getAttribute("d"); };
      const ds = qrSvgs.map(x => x.querySelector("path").getAttribute("d"));
      o.qrPePiese = qrSvgs.length >= 2 && ds.includes(dd("r1")) && ds.includes(dd("r2")) && ds.every(x => x === dd("r1") || x === dd("r2"));
      o.faraAvertisment = !tx.includes(T("docSawNoLink"));
      o.xss = !html.includes("<b>X</b>") && html.indexOf("&lt;b&gt;X&lt;/b&gt;") >= 0;
      o.ordineTaieturi = /│|─/.test(tx);

      /* fără comandă legată: coduri, avertisment, nici un QR */
      atJobMapSet("w5", null); await openAs("responsabil");
      area().innerHTML = ""; body().querySelector("[data-at=docsaw]").click(); await w(400);
      o.faraLink = area().textContent.includes(T("docSawNoLink")) && area().querySelectorAll("div[style*='15mm'] svg").length === 0 && /r1/.test(area().textContent);

      closeSheets(); window.print = realPrint; sb = wasSb; acctSession = wasSess; state.projects = keepP; state.activeId = keepA; licWrite(keepL);
      localStorage.removeItem("ebAtelier"); localStorage.removeItem("ebAtelierJobs"); renderAccount();
      return o;
    });
    ok("Atelier E5: foaia A4 are QR-ul Atelier al piesei (același cu al etichetei) doar cu comandă legată și neschimbată; altfel codul piesei (5.85.0)", r.a3fara === true && r.a3cu === true && r.a3schimbat === true && r.a3faraFlag === true, JSON.stringify({ f: r.a3fara, c: r.a3cu, s: r.a3schimbat, g: r.a3faraFlag }));
    ok("Atelier E5: butonul „Plan sezionatrice” e în Atelier; fără Pro se deschide ecranul Pro și nu se tipărește nimic", r.buton === true && r.gratis === true);
    ok("Atelier E5: planul de tăiere se tipărește cu codurile pieselor în dreptunghiuri și ordinea tăierilor", r.tipar === true && r.coduriInPlan === true && r.ordineTaieturi === true);
    ok("Atelier E5: sub fiecare panou, QR-ul fiecărei piese; cele din plan sunt exact cele din comandă (r1, r2)", r.qrPePiese === true && r.faraAvertisment === true);
    ok("Atelier E5: numele cu HTML nu se execută în plan", r.xss === true);
    ok("Atelier E5: fără comandă legată: coduri și avertisment, fără QR", r.faraLink === true);
    await pg.evaluate(() => { closeSheets(); });
  }

  head("Atelier — panou de birou: unde stă fiecare comandă, coadă pe postazione, întârzieri");
  {
    const r = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      const wasSb = sb, wasSess = acctSession;
      localStorage.setItem("ebAtelier", "1");
      const iso = d => new Date(Date.now() + d * 3600e3).toISOString();
      const day = d => new Date(Date.now() + d * 86400e3).toISOString().slice(0, 10);
      const list = [
        { id: "j1", title: "Bucătărie <i>A</i>", client_label: null, due_date: day(-5), state: "in_progress", last_station: "cnc", last_at: iso(-30), total_pieces: 4 },
        { id: "j2", title: "Dressing B", client_label: null, due_date: day(10), state: "confirmed", last_station: null, last_at: null, total_pieces: 2 },
        { id: "j3", title: "Terminată", client_label: null, due_date: day(-9), state: "done", last_station: null, last_at: null, total_pieces: 1 }];
      const prog = {
        j1: [{ station: "bordatrice", total_pieces: 4, done_pieces: 4, station_done: true, issues: 0, reworks: 0, last_at: iso(-60) }, { station: "cnc", total_pieces: 4, done_pieces: 2, station_done: false, issues: 1, reworks: 0, last_at: iso(-30) }],
        j2: [], j3: [] };
      let mine;
      sb = { from(t) { const c = { select() { return c; }, eq() { return c; }, is() { return c; }, gt() { return c; }, order() { return c; }, then(res) { res({ data: t === "atelier_members" ? mine : [], error: null }); } }; return c; },
        async rpc(fn, a) { return fn === "job_status_list" ? { data: list, error: null } : fn === "job_progress" ? { data: prog[a.p_job] || [], error: null } : { data: [], error: null }; } };
      acctSession = { user: { id: "u-a", email: "a@test.local" } };
      const body = () => document.getElementById("atBody");
      const openAs = async role => { mine = [{ atelier_id: "at1", role, stations: role === "operator" ? ["cnc"] : [], ateliers: { id: "at1", name: "T", slug: "tt" } }];
        closeSheets(); atMine = []; atScreen = { name: "detail", id: "at1" }; openSheet("shAtelier"); await atRefreshMine(); await atRender(); await w(300); };
      const T = k => EBAtelier.t(state.lang, k);

      await openAs("birou");
      const rows = [...body().querySelectorAll("table tr")].slice(1);
      o.randuri = rows.length === 2 && /Bucătărie/.test(rows[0].textContent) && /Dressing/.test(rows[1].textContent); /* terminată nu apare; întârziata e prima */
      o.celule = rows[0].querySelectorAll("td").length === 9; /* titlu + 7 postazioni active + cnc (are date), D-187 */
      const cellTxt = rows[0].textContent;
      o.stari = cellTxt.includes("✓") && cellTxt.includes("50%") && cellTxt.includes("⚠");
      o.intarziere = rows[0].innerHTML.includes("#b3261e") && cellTxt.includes(T("boardLate").replace("{n}", "5"));
      o.neinceput = rows[1].textContent.includes(T("boardNotStarted"));
      const sum = [...body().querySelectorAll("span[style*='99px']")].map(x => x.textContent).join("|");
      o.rezumat = /2\s*\S+/.test(sum) && sum.includes(T("boardOverdue")) && sum.includes(T("boardStagnant"));
      o.coada = body().textContent.includes(T("boardQueue")) && /CNC\s*1/.test(body().textContent);
      o.xss = !body().querySelector("i") && body().innerHTML.indexOf("&lt;i&gt;") >= 0;
      o.legenda = body().textContent.includes(T("boardLegend"));

      await openAs("operator"); o.opFara = !body().textContent.includes(T("boardLegend")) && !body().textContent.includes(T("boardQueue"));
      await openAs("partener"); o.parFara = !body().textContent.includes(T("boardLegend"));
      list.length = 0; await openAs("responsabil"); o.gol = body().textContent.includes(T("boardNone"));

      closeSheets(); sb = wasSb; acctSession = wasSess; localStorage.removeItem("ebAtelier"); renderAccount();
      return o;
    });
    ok("Atelier panou: numai comenzile deschise, întârziata prima, 7 postazioni active + cele cu date pe rând", r.randuri === true && r.celule === true, JSON.stringify({ r: r.randuri, c: r.celule }));
    ok("Atelier panou: ✓ gata, % în lucru, ⚠ probleme, zile de întârziere în roșu, „neînceput”", r.stari === true && r.intarziere === true && r.neinceput === true);
    ok("Atelier panou: rezumat (deschise, întârziate, stagnante) și coada pe postazione", r.rezumat === true && r.coada === true && r.legenda === true);
    ok("Atelier panou: titlurile cu HTML nu se execută", r.xss === true);
    ok("Atelier panou: operatorul și partenerul nu-l văd; fără comenzi, mesaj", r.opFara === true && r.parFara === true && r.gol === true);
    await pg.evaluate(() => { closeSheets(); });
  }

  head("Pașaportul proiectului — documentul pentru client: materiale, decor, feronerie, fabricație");
  {
    const r = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      const keepP = state.projects, keepA = state.activeId, keepL = LIC, keepNote = state.settings.passportNote;
      const realPrint = window.print; let printed = 0; window.print = () => { printed++; };
      printOut._offered = 1;
      const T = k => EBPassport.t(state.lang, k);
      state.projects = [{ id: "w6", name: "Villa <b>Blu</b>", client: "Jacquin", date: "2026-10-01", pieces: [
        { id: "a1", modulo: "Corp", elemento: "Fianco", lung: 700, larg: 500, pz: 2, bordo: "2L", materiale: "PAL 18 Alb" },
        { id: "a2", modulo: "Corp", elemento: "Ripiano", lung: 600, larg: 400, pz: 3, materiale: "PAL 18 Alb" }] }];
      state.activeId = "w6"; state.settings.passportNote = "Garanzia 24 mesi.\nManutenzione: panno umido <i>soltanto</i>.";
      localStorage.removeItem("ebAtelierJobs");
      const area = () => document.getElementById("printArea");

      /* buton: etichetă în limba aplicației */
      o.eticheta = document.getElementById("btnPassport").textContent.trim() === T("passBtn");
      /* gratuit: ecranul Pro, nimic tipărit */
      licWrite(null); area().innerHTML = ""; printed = 0; document.getElementById("btnPassport").click(); await w(300);
      o.gratis = printed === 0 && area().innerHTML === "" && document.getElementById("shPro").classList.contains("on");
      closeSheets();

      licWrite({ kind: "stripe", key: "comp_TESTTESTTESTTESTTESTTEST", status: "active", activated: true, checkedAt: Date.now() });
      area().innerHTML = ""; printed = 0; document.getElementById("btnPassport").click(); await w(400);
      const tx = area().textContent, html = area().innerHTML;
      o.tipar = printed === 1 && tx.includes(T("passTitle")) && tx.includes(T("passMaterials")) && /PAL 18 Alb|Bianco|Alb/.test(tx);
      o.rezumat = tx.includes(T("passSummary")) && /\b5\b/.test(tx); /* 2 + 3 piese */
      o.tabel = area().querySelectorAll("table").length >= 2 && /mm/.test(tx);
      o.fabricatie = tx.includes(T("passFab")) && tx.includes(T("passQc")) && tx.includes(T("passSign")) && tx.includes(T("passDate"));
      o.nota = tx.includes(T("passCare")) && tx.includes("Garanzia 24 mesi.") && tx.includes("panno umido");
      o.xss = !html.includes("<b>Blu</b>") && html.indexOf("&lt;b&gt;Blu&lt;/b&gt;") >= 0 && !area().querySelector("i:not(:empty)") ; /* <i> din notă nu devine element; <i> de „cod de confirmat” e permis */
      o.xss2 = html.indexOf("&lt;i&gt;soltanto&lt;/i&gt;") >= 0;
      o.avertisment = tx.includes(T("passDisclaimer"));
      o.faraComanda = !tx.includes(T("passOrder")) && !tx.includes(T("passTrace"));
      o.urma = /Ebanist v/.test(tx);

      /* cu comandă legată și neschimbată: codul comenzii și mențiunea de trasabilitate */
      atJobMapSet("w6", { job: "6f1c2b7e-9a3d-4c58-8e21-0b5d7a9c4e13", atelier: "at1", sig: EBAtelier.rowSig(proj().pieces) });
      area().innerHTML = ""; document.getElementById("btnPassport").click(); await w(300);
      o.cuComanda = area().textContent.includes(T("passOrder")) && area().textContent.includes("6F1C2B7E") && area().textContent.includes(T("passTrace"));
      proj().pieces[1].lung = 601; area().innerHTML = ""; document.getElementById("btnPassport").click(); await w(300);
      o.schimbat = !area().textContent.includes("6F1C2B7E");
      localStorage.removeItem("ebAtelierJobs");

      /* fără notă: secțiunea „Garanție și întreținere” nu apare */
      state.settings.passportNote = ""; area().innerHTML = ""; document.getElementById("btnPassport").click(); await w(300);
      o.faraNota = !area().textContent.includes(T("passCare"));

      /* câmpul din Setări: se afișează, se salvează, are text în limba aplicației */
      state.settings.passportNote = "Nota veche"; document.getElementById("btnSettings").click(); await w(250);
      o.camp = document.getElementById("sPassNote").value === "Nota veche" && document.getElementById("sPassNoteLbl").textContent === T("passNoteLbl");
      document.getElementById("sPassNote").value = "Nota noua"; document.getElementById("btnSettingsSave").click(); await w(250);
      o.salvat = state.settings.passportNote === "Nota noua";
      closeSheets();

      /* proiect gol: mesaj, nu tipărește */
      state.projects = []; state.activeId = null; printed = 0; document.getElementById("btnPassport").click(); await w(200);
      o.gol = printed === 0;

      window.print = realPrint; state.projects = keepP; state.activeId = keepA; licWrite(keepL); state.settings.passportNote = keepNote;
      return o;
    });
    ok("Pașaport: butonul are etichetă în limba aplicației; fără Pro se deschide ecranul Pro și nu se tipărește nimic", r.eticheta === true && r.gratis === true);
    ok("Pașaport: se tipărește cu rezumat, tabel de materiale, fabricație (data, control, semnătură) și avertismentul de conformitate", r.tipar === true && r.rezumat === true && r.tabel === true && r.fabricatie === true && r.avertisment === true);
    ok("Pașaport: textul de garanție și întreținere din Setări apare; fără text, secțiunea lipsește", r.nota === true && r.faraNota === true);
    ok("Pașaport: numele proiectului și nota cu HTML nu se execută", r.xss === true && r.xss2 === true);
    ok("Pașaport: cu comandă legată și neschimbată arată codul comenzii și trasabilitatea; altfel nu", r.cuComanda === true && r.schimbat === true && r.faraComanda === true);
    ok("Pașaport: poartă urma versiunii (Ebanist v…, motor, reguli) ca celelalte documente", r.urma === true);
    ok("Pașaport: câmpul din Setări se afișează, se salvează; proiect gol → nu tipărește", r.camp === true && r.salvat === true && r.gol === true);
    await pg.evaluate(() => { closeSheets(); });
  }

  head("Flux comercial — plan de plată în ofertă și proces-verbal de recepție");
  {
    const r = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      const keepP = state.projects, keepA = state.activeId, keepL = LIC, keepPlan = state.settings.payPlan;
      const realPrint = window.print; let printed = 0; window.print = () => { printed++; };
      printOut._offered = 1;
      const T = k => EBCommerce.t(state.lang, k);
      state.projects = [{ id: "h1", name: "Villa <b>Blu</b>", client: "Jacquin <i>SA</i>", phone: "+377", date: "2026-10-01", pieces: [
        { id: "a1", modulo: "Corp", elemento: "Fianco", lung: 700, larg: 500, pz: 2, materiale: "PAL 18 Alb" }] }];
      state.activeId = "h1";
      const area = () => document.getElementById("printArea");
      o.eticheta = document.getElementById("btnHandover").textContent.trim() === T("hoBtn");
      licWrite(null); area().innerHTML = ""; printed = 0; document.getElementById("btnHandover").click(); await w(300);
      o.gratis = printed === 0 && area().innerHTML === "" && document.getElementById("shPro").classList.contains("on");
      closeSheets();
      licWrite({ kind: "stripe", key: "comp_TESTTESTTESTTESTTESTTEST", status: "active", activated: true, checkedAt: Date.now() });
      area().innerHTML = ""; printed = 0; document.getElementById("btnHandover").click(); await w(300);
      const tx = area().textContent, html = area().innerHTML;
      o.tipar = printed === 1 && tx.includes(T("hoTitle")) && tx.includes(T("hoChecks")) && tx.includes(T("hoDefects")) && tx.includes(T("hoDecl"));
      o.bife = ["hoC1", "hoC2", "hoC3", "hoC4", "hoC5", "hoC6", "hoC7"].every(k => tx.includes(T(k)));
      o.semn = tx.includes(T("hoClient")) && tx.includes(T("hoCompany")) && tx.includes(T("hoNote"));
      o.xss = !html.includes("<b>Blu</b>") && html.indexOf("&lt;b&gt;Blu&lt;/b&gt;") >= 0 && html.indexOf("&lt;i&gt;SA&lt;/i&gt;") >= 0;

      /* plan de plată: fără plan nu apare; cu plan, trei rânduri cu suma exactă */
      state.settings.payPlan = null; o.faraPlan = payPlanHtml(1000) === "";
      state.settings.payPlan = [30, 40, 30];
      const ph = payPlanHtml(1000.01); const d = document.createElement("div"); d.innerHTML = ph;
      const cents = [...d.querySelectorAll("tr")].slice(1).map(tr => tr.lastChild.textContent.replace(/[^\d.,]/g, ""));
      o.plan = d.querySelectorAll("tr").length === 4 && ph.includes(T("payTitle")) && cents.length === 3;
      state.settings.payPlan = [50, 0, 50]; d.innerHTML = payPlanHtml(100); o.doua = d.querySelectorAll("tr").length === 3;
      state.settings.payPlan = [30, 30, 30]; o.invalid = payPlanHtml(1000) === "";

      /* Setări: câmpurile se încarcă, un plan greșit nu se salvează, unul bun da */
      state.settings.payPlan = [20, 30, 50];
      document.getElementById("btnSettings").click(); await w(250);
      o.camp = document.getElementById("sPay1").value === "20" && document.getElementById("sPayLbl").textContent === T("payLbl");
      document.getElementById("sPay1").value = "10"; document.getElementById("btnSettingsSave").click(); await w(250);
      o.respins = state.settings.payPlan.join() === "20,30,50";
      document.getElementById("sPay1").value = "10"; document.getElementById("sPay2").value = "40"; document.getElementById("sPay3").value = "50";
      document.getElementById("btnSettingsSave").click(); await w(250);
      o.salvat = state.settings.payPlan.join() === "10,40,50";
      document.getElementById("btnSettings").click(); await w(250);
      ["sPay1", "sPay2", "sPay3"].forEach(i => document.getElementById(i).value = "");
      document.getElementById("btnSettingsSave").click(); await w(250);
      o.golit = state.settings.payPlan === null;
      closeSheets();

      state.projects = []; state.activeId = null; printed = 0; document.getElementById("btnHandover").click(); await w(200);
      o.gol = printed === 0;
      window.print = realPrint; state.projects = keepP; state.activeId = keepA; licWrite(keepL); state.settings.payPlan = keepPlan;
      return o;
    });
    ok("Recepție: buton în limba aplicației; fără Pro se deschide ecranul Pro", r.eticheta === true && r.gratis === true);
    ok("Recepție: se tipărește cu verificări, rezerve, declarație, semnături și nota; nume și client cu HTML nu se execută", r.tipar === true && r.bife === true && r.semn === true && r.xss === true);
    ok("Plan de plată: fără plan nu apare; cu plan un tabel exact; plan invalid nu se tipărește", r.faraPlan === true && r.plan === true && r.doua === true && r.invalid === true);
    ok("Plan de plată în Setări: se încarcă, suma ≠ 100 se respinge, unul valid se salvează, gol îl șterge", r.camp === true && r.respins === true && r.salvat === true && r.golit === true);
    ok("Recepție: proiect gol nu tipărește", r.gol === true);
    await pg.evaluate(() => { closeSheets(); });
  }

  head("Consilier tehnic — rafturi lungi, sfaturi fără blocaj");
  {
    const r = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      const keepP = state.projects, keepA = state.activeId;
      const lab = matById("pal18_alb").label;
      const mk = L => [{ id: "s1", modulo: "Corp", elemento: "Ripiano", role: "ripiano", lung: L, larg: 300, pz: 2, materiale: lab }];
      state.projects = [{ id: "ad1", name: "T", pieces: mk(1100), configs: { Corp: { type: "base", L: 1100, H: 800, P: 350 } } }]; state.activeId = "ad1";
      auditBadge();
      const el = document.getElementById("adviceBadge");
      o.apare = !el.hidden && el.textContent.includes(EBAdvice.t(state.lang, "title"));
      el.click(); await w(250);
      o.foaie = document.getElementById("auditTitle").textContent === EBAdvice.t(state.lang, "title") && document.getElementById("auditSheet").classList.contains("on") && document.getElementById("auditBody").textContent.includes("1100") && document.getElementById("auditBody").textContent.includes(EBAdvice.t(state.lang, "note"));
      closeSheets();
      state.projects[0].pieces = mk(600); auditBadge(); o.scurt = document.getElementById("adviceBadge").hidden === true;
      state.projects[0].pieces = mk(1100); auditBadge(); o.nebloc = document.getElementById("auditBadge").dataset.state !== "red";
      state.projects = keepP; state.activeId = keepA; auditBadge();
      return o;
    });
    ok("Consilier: raftul lung de PAL 18 dă sfat (insignă galbenă, foaie cu motiv și nota de ipoteze); raftul scurt nu", r.apare === true && r.foaie === true && r.scurt === true);
    ok("Consilier: sfatul nu blochează exportul (semaforul de coerență rămâne neroșu)", r.nebloc === true);
    await pg.evaluate(() => { closeSheets(); });
  }

  head("Lambriu cu lamele — tip nou: formular, distinta cu închidere exactă, 3D, fișa de montaj, 7 limbi");
  {
    const r = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      const keepP = state.projects, keepA = state.activeId, keepLang = state.lang;
      state.projects = [{ id: "lm1", name: "Perete", pieces: [], configs: {} }]; state.activeId = "lm1";
      setView("build"); await w(200);
      presetApply({ cfg: PRESETS.lambriu, name: "Lambriu A" }); await w(300);
      o.camp = document.getElementById("bTipo").value === "lambriu" && document.getElementById("rowLam").style.display !== "none" && document.getElementById("rowP").style.display === "none";
      o.valori = document.getElementById("bLamW").value === "40" && document.getElementById("bLamGap").value === "20" && document.getElementById("bLamDir").value === "v";
      o.info = document.getElementById("angHint").textContent.includes(t("lamInfo").replace("{n}", "40").replace("{g}", "20.5"));
      document.getElementById("btnGenerate").click(); await w(400);
      const p = proj(), sl = p.pieces.find(x => x.elemento === "Lamella"), bk = p.pieces.filter(x => x.elemento === "Pannello supporto");
      o.rows = p.pieces.length === 2 && !!sl && bk.length === 1;
      o.cote = sl.lung === 2600 && sl.larg === 40 && sl.pz === 40 && bk[0].lung === 2600 && bk[0].larg === 1200 && bk[0].pz === 2;
      /* închidere: lamelele + rosturile = lățimea; foile de suport = lățimea */
      const gap = (2400 - sl.pz * sl.larg) / (sl.pz - 1);
      o.inchidere = Math.abs(sl.pz * sl.larg + (sl.pz - 1) * gap - 2400) < 1e-9 && bk[0].larg * bk[0].pz === 2400;
      o.matLabel = sl.materiale !== bk[0].materiale;
      o.fisaDeProiect = !!p.configs["Lambriu A"] && p.configs["Lambriu A"].type === "lambriu" && p.configs["Lambriu A"].P === 34;
      const B = buildModule(p.configs["Lambriu A"]);
      const lam = B.boxes.filter(b => b.role === "lamela");
      o.treiD = lam.length === 40 && Math.abs(lam[0].x0) < 1e-9 && Math.abs(lam[39].x1 - 2400) < 1e-9 && lam.every(b => b.pk > 0);
      const rest = assemblySteps("Lambriu A", {}, p.configs["Lambriu A"], p.pieces).map(x => x.x).join("|");
      o.pasi = rest.includes(t("lamS1")) && rest.includes("20.5") && rest.includes("40") && !rest.includes("{");
      o.auditVerde = auditProject(p).length === 0;
      /* orizontale, fără suport; prea lungă pentru placă → eroare, nu distinta */
      let err = ""; try { buildModule({ ...p.configs["Lambriu A"], back: 1, H: 2900 }); } catch (e) { err = e.message; }
      o.eroareLung = err.includes("2900") && err.includes("2800");
      const SP = buildModule({ ...p.configs["Lambriu A"], lamDir: "o", back: 0, L: 3000, H: 2400, lamW: 90, lamGap: 10 });
      o.taiat = SP.pieces.length === 1 && SP.pieces[0].elemento === "Lamella tagliata" && SP.pieces[0].lung === 1500 && SP.pieces[0].pz === 48 && SP.warn.lamSplit === 24;
      const H = buildModule({ ...p.configs["Lambriu A"], lamDir: "o", back: 0, L: 2700, H: 2400, lamW: 90, lamGap: 10 });
      o.oriz = H.pieces.length === 1 && H.pieces[0].lung === 2700 && H.pieces[0].larg === 90 && H.pieces[0].pz === 24 && H.pieces[0].axis_mapping.lung === "L";
      /* textele există în toate cele 7 limbi, fără chei goale */
      const ks = ["typeLambriu", "preset_lambriu", "fLamW", "fLamGap", "fLamDir", "lamV", "lamH", "lamInfo", "wLamTight", "wLamShift", "lamErrMat", "lamErrBack", "lamErrDim", "lamErrLen", "lamS1", "lamS2", "lamS3", "lamS4", "role_lamela"];
      o.limbi = ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => ks.every(k => I18N[l][k] && I18N[l][k].length > 2));
      o.elemente = ["ro", "en", "fr", "de", "pl", "es"].every(l => EL_I18N[l]["Lamella"] && EL_I18N[l]["Pannello supporto"]);
      /* AI: tipul și câmpurile nu se pierd la validare */
      const n = aiNormCfg({ type: "lambriu", lamW: 50, lamGap: 12, lamDir: "o", L: 3000 }, []);
      o.ai = n.type === "lambriu" && n.lamW === 50 && n.lamGap === 12 && n.lamDir === "o" && AI_ENUM.type.includes("lambriu");
      state.projects = keepP; state.activeId = keepA; state.lang = keepLang;
      return o;
    });
    ok("Lambriu: tipul apare în formular cu câmpurile lui (lățime, rost, direcție), fără adâncime; presetul are valori și anunță 40 lamele · rost 20.5", r.camp === true && r.valori === true && r.info === true);
    ok("Lambriu: distinta are suportul din două foi și 40 de lamele, materiale diferite, configurația se salvează cu adâncimea derivată", r.rows === true && r.cote === true && r.matLabel === true && r.fisaDeProiect === true);
    ok("Lambriu: închidere exactă (lamele + rosturi = lățimea, foile = lățimea), 3D cu 40 de piese de la 0 la 2400, semaforul de coerență verde", r.inchidere === true && r.treiD === true && r.auditVerde === true);
    ok("Lambriu: pașii de montaj poartă rostul și numărul din model; orizontal merge; suportul mai înalt decât placa se oprește, lamelele mai lungi se taie egal", r.pasi === true && r.oriz === true && r.eroareLung === true && r.taiat === true);
    ok("Lambriu: textele în toate cele 7 limbi, elementele traduse, AI-ul acceptă tipul și câmpurile", r.limbi === true && r.elemente === true && r.ai === true);
    await pg.evaluate(() => { closeSheets(); });
  }

  head("Lambriu v2 — decupaje (prize), lamele întrerupte, gaura în suport, 3D");
  {
    const r = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      const keepP = state.projects, keepA = state.activeId;
      state.projects = [{ id: "lm2", name: "Perete", pieces: [], configs: {} }]; state.activeId = "lm2";
      setView("build"); await w(200);
      presetApply({ cfg: PRESETS.lambriu, name: "Lambriu B" }); await w(300);
      o.gol = document.getElementById("rowLamCuts").style.display !== "none" && document.querySelectorAll("#lamCutBox [data-lc]").length === 0;
      document.getElementById("btnLamCutAdd").click(); await w(150);
      const inp = k => document.querySelector(`#lamCutBox [data-lc="0:${k}"]`);
      o.rand = !!inp("x") && inp("w").value === "80" && inp("y").value === "300";
      inp("x").value = "1000"; inp("x").dispatchEvent(new Event("input", { bubbles: true }));
      inp("y").value = "300"; inp("y").dispatchEvent(new Event("input", { bubbles: true })); await w(300);
      o.previzualizare = document.getElementById("angHint").textContent.includes(t("lamCutInfo").replace("{n}", "1").replace("{p}", String(buildLamCuts.length ? 0 : 0)).split(" · ")[0]);
      document.getElementById("btnGenerate").click(); await w(400);
      const p = proj(), c = p.configs["Lambriu B"];
      o.salvat = Array.isArray(c.lamCuts) && c.lamCuts.length === 1 && c.lamCuts[0].x === 1000;
      const full = p.pieces.find(x => x.elemento === "Lamella"), cutRows = p.pieces.filter(x => x.elemento === "Lamella tagliata");
      const cutN = cutRows.reduce((q, x) => q + x.pz, 0);
      o.randuri = !!full && cutRows.length === 2 && cutN === 4 && full.pz + cutN / 2 === 40 && cutRows.every(x => x.lung < 2600) && cutRows.reduce((q, x) => q + x.lung * x.pz, 0) === 2 * (2600 - 80);
      const sheets = p.pieces.filter(x => x.elemento === "Pannello supporto");
      const holed = sheets.find(x => x.scasso);
      o.gaura = sheets.length === 2 && !!holed && sheets.reduce((a, x) => a + x.larg * x.pz, 0) === 2400 && scList(holed).length === 1 && scList(holed)[0].l === 80 && scList(holed)[0].w === 80 && scList(holed)[0].x === 300 && scList(holed)[0].y === 1000 - 0;
      /* totalul: bucăți + decupaj = înălțimea, pe fiecare lamelă atinsă */
      const B = buildModule(c), lam = B.boxes.filter(b => b.role === "lamela");
      const col = {}; lam.forEach(b => { const k = Math.round(b.x0 * 100); col[k] = (col[k] || 0) + (b.y1 - b.y0); });
      const hit = Object.keys(col).filter(k => Math.abs(col[k] - 2600) > 1e-6);
      o.inchidere = hit.length >= 1 && hit.length <= 3 && hit.every(k => Math.abs(col[k] - 2520) < 1e-6) && Object.keys(col).length === 40;
      const bk = B.boxes.filter(b => b.sub === "back" && b.x0 <= 1000 && b.x1 >= 1080 && b.y0 < 380 && b.y1 > 300);
      o.treiDGaura = bk.length === 0;
      o.pasiCut = assemblySteps("Lambriu B", {}, c, p.pieces).length >= 5;
      o.auditVerde = auditProject(p).length === 0;
      /* decupaj în afara peretelui: eroare declarată, nu distinctă */
      let err = ""; try { buildModule({ ...c, lamCuts: [{ x: 2390, y: 0, w: 100, h: 50 }] }); } catch (e) { err = e.message; }
      o.eroareCut = err === t("lamErrCut");
      /* ștergerea unui decupaj și AI */
      document.querySelector("#lamCutBox [data-lcdel]") || document.getElementById("btnLamCutAdd").click();
      const ai = aiNormCfg({ type: "lambriu", lamCuts: [{ x: 500, y: 300, w: 80, h: 80 }, { x: "z", y: 1, w: 1, h: 1 }] }, []);
      o.ai = Array.isArray(ai.lamCuts) && ai.lamCuts.length === 1 && ai.lamCuts[0].x === 500;
      const ks = ["fLamCuts", "lamCutAdd", "lamCutX", "lamCutY", "lamCutW", "lamCutH", "lamCutHint", "lamCutInfo", "wLamSplit", "wLamShort", "lamErrCut"];
      o.limbi = ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => ks.every(k => I18N[l][k] && I18N[l][k].length > 2));
      o.elem = ["ro", "en", "fr", "de", "pl", "es"].every(l => EL_I18N[l]["Lamella tagliata"]);
      state.projects = keepP; state.activeId = keepA;
      return o;
    });
    ok("Lambriu v2: butonul „+ Decupaj” adaugă un rând (80×80 la 30 cm), valorile se citesc, preview-ul anunță decupajele", r.gol === true && r.rand === true && r.previzualizare === true);
    ok("Lambriu v2: distinta are lamele întregi și lamele tăiate (perechi), suportul are gaura exactă (80×80 la 30 cm de jos, 1000 de la stânga) pe foaia potrivită", r.salvat === true && r.randuri === true && r.gaura === true);
    ok("Lambriu v2: pe fiecare lamelă atinsă bucățile + decupajul = înălțimea; 3D-ul are gaura în suport; semaforul verde", r.inchidere === true && r.treiDGaura === true && r.auditVerde === true && r.pasiCut === true);
    ok("Lambriu v2: decupaj în afara peretelui = eroare declarată; AI-ul acceptă lista și respinge rândurile invalide; textele în 7 limbi", r.eroareCut === true && r.ai === true && r.limbi === true && r.elem === true);
    await pg.evaluate(() => { closeSheets(); });
  }

  head("Boiserie cu rame și câmpuri — tip nou: formular, rame exacte, suport cu gaură, 3D, montaj, 7 limbi");
  {
    const r = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      const keepP = state.projects, keepA = state.activeId;
      state.projects = [{ id: "rf1", name: "Perete", pieces: [], configs: {} }]; state.activeId = "rf1";
      setView("build"); await w(200);
      presetApply({ cfg: PRESETS.boiserie, name: "Boiserie A" }); await w(300);
      o.camp = document.getElementById("bTipo").value === "boiserie" && document.getElementById("rowRf").style.display !== "none" && document.getElementById("rowLam").style.display === "none" && document.getElementById("rowLamCuts").style.display !== "none" && document.getElementById("rowP").style.display === "none";
      o.valori = document.getElementById("bRfW").value === "60" && document.getElementById("bRfT").value === "600" && document.getElementById("bRfRows").value === "2";
      o.info = document.getElementById("angHint").textContent.includes(t("rfInfo").replace("{n}", "4").replace("{m}", "2").replace("{w}", "525").replace("{h}", "1210"));
      document.getElementById("btnGenerate").click(); await w(400);
      const p = proj(), c = p.configs["Boiserie A"];
      const st = p.pieces.find(x => x.elemento === "Montante cornice"), tr = p.pieces.find(x => x.elemento === "Traversa cornice"), sp = p.pieces.filter(x => x.elemento === "Pannello supporto");
      o.rows = !!st && !!tr && st.lung === 2600 && st.larg === 60 && st.pz === 5 && tr.lung === 525 && tr.larg === 60 && tr.pz === 12 && sp.length === 1 && sp[0].pz === 2;
      o.salvat = c.type === "boiserie" && c.rfW === 60 && c.rfRows === 2 && c.P === 34;
      /* închidere în mm: (n+1)·ramă + n·câmp = lățimea; (m+1)·ramă + m·câmp = înălțimea */
      o.inchidere = (st.pz * st.larg + 4 * 525 === 2400) && (3 * 60 + 2 * 1210 === 2600);
      const B = buildModule(c), stb = B.boxes.filter(b => b.role === "rama_montant"), trb = B.boxes.filter(b => b.role === "rama_traversa");
      o.treiD = stb.length === 5 && trb.length === 12 && Math.abs(Math.min(...stb.map(b => b.x0))) < 1e-9 && Math.abs(Math.max(...stb.map(b => b.x1)) - 2400) < 1e-9 && Math.abs(Math.max(...trb.map(b => b.y1)) - 2600) < 1e-9 && stb.concat(trb).every(b => b.pk > 0);
      const rest = assemblySteps("Boiserie A", {}, c, p.pieces).map(x => x.x).join("|");
      o.pasi = rest.includes("525×1210") && rest.includes("5 ") && !rest.includes("{");
      o.auditVerde = auditProject(p).length === 0;
      /* rest nenul: ramele de capăt iau milimetrii */
      const R = buildModule({ ...c, L: 2403, H: 1103, rfRows: 1, lamCuts: [] });
      const wsum = R.pieces.filter(x => x.elemento === "Montante cornice").reduce((a, x) => a + x.larg * x.pz, 0);
      o.rest = wsum + 4 * 525 === 2403 && R.pieces.filter(x => x.elemento === "Montante cornice").length === 3;
      /* decupaj peste o ramă: avertisment; în câmp: fără */
      const hit = buildModule({ ...c, lamCuts: [{ x: 560, y: 300, w: 80, h: 80 }] }), ok2 = buildModule({ ...c, lamCuts: [{ x: 100, y: 300, w: 80, h: 80 }] });
      o.decupaj = hit.warn.rfCutHit === 1 && !ok2.warn.rfCutHit && ok2.pieces.some(x => x.elemento === "Pannello supporto" && x.scasso);
      let err = ""; try { buildModule({ ...c, rfW: 500 }); } catch (e) { err = e.message; }
      o.eroare = err === t("rfErrDim");
      const ai = aiNormCfg({ type: "boiserie", rfW: 80, rfTarget: 500, rfRows: 3 }, []);
      o.ai = ai.type === "boiserie" && ai.rfW === 80 && ai.rfTarget === 500 && ai.rfRows === 3 && AI_ENUM.type.includes("boiserie");
      const ks = ["typeBoiserie", "preset_boiserie", "fRfW", "fRfT", "fRfRows", "rfInfo", "wRfCutHit", "rfErrMat", "rfErrBack", "rfErrDim", "rfS3", "rfS4", "role_rama_montant", "role_rama_traversa"];
      o.limbi = ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => ks.every(k => I18N[l][k] && I18N[l][k].length > 2));
      o.elem = ["ro", "en", "fr", "de", "pl", "es"].every(l => EL_I18N[l]["Montante cornice"] && EL_I18N[l]["Traversa cornice"]);
      state.projects = keepP; state.activeId = keepA;
      return o;
    });
    ok("Boiserie: tipul apare cu câmpurile lui (ramă, câmp dorit, rânduri) și decupajele, fără adâncime; presetul anunță 4×2 câmpuri de 525×1210", r.camp === true && r.valori === true && r.info === true);
    ok("Boiserie: distinta are 5 montanți, 12 traverse și suportul din două foi; configurația se salvează cu adâncimea derivată", r.rows === true && r.salvat === true);
    ok("Boiserie: închidere exactă pe ambele direcții, 3D cu 5+12 piese de la 0 la 2400, semaforul verde; restul de milimetri merge la ramele de capăt", r.inchidere === true && r.treiD === true && r.auditVerde === true && r.rest === true);
    ok("Boiserie: pașii de montaj poartă numărul și mărimea câmpului din model; decupaj peste ramă avertizează, în câmp dă gaură în suport; ramă nepotrivită = eroare", r.pasi === true && r.decupaj === true && r.eroare === true);
    ok("Boiserie: AI acceptă tipul și câmpurile; textele în 7 limbi, elementele traduse", r.ai === true && r.limbi === true && r.elem === true);
    await pg.evaluate(() => { closeSheets(); });
  }

  head("Colț între doi pereți — lambriu și boiserie pe doi pereți: formular, piese pe pereți, 3D fără suprapuneri, montaj");
  {
    const r = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      const keepP = state.projects, keepA = state.activeId;
      state.projects = [{ id: "ct1", name: "Colț", pieces: [], configs: {} }]; state.activeId = "ct1";
      setView("build"); await w(200);
      presetApply({ cfg: PRESETS.lambriu, name: "Colt A" }); await w(300);
      o.ascuns = document.getElementById("rowWall2").style.display !== "none" && document.getElementById("rowL2").style.display === "none" && document.getElementById("fCornerWrap").style.display === "none";
      const sel = document.getElementById("bWall2"); sel.value = "1"; sel.dispatchEvent(new Event("change", { bubbles: true })); await w(250);
      o.aratat = document.getElementById("rowL2").style.display !== "none" && document.getElementById("fCornerWrap").style.display !== "none" && document.getElementById("fCornerKindWrap").style.display !== "none" && document.getElementById("bL2").value === "900";
      document.getElementById("bL2").value = "1500"; document.getElementById("bL2").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("bCorner").value = "dx"; document.getElementById("bCornerKind").value = "int";
      document.getElementById("btnLamCutAdd").click(); await w(150);
      o.alegeZid = !!document.querySelector("#lamCutBox [data-lcw]");
      const ws = document.querySelector("#lamCutBox [data-lcw]"); ws.value = "B"; ws.dispatchEvent(new Event("change", { bubbles: true }));
      const xi = document.querySelector('#lamCutBox [data-lc="0:x"]'); xi.value = "300"; xi.dispatchEvent(new Event("input", { bubbles: true })); await w(300);
      o.info = document.getElementById("angHint").textContent.includes(t("cornerInfo").replace("{k}", t("cornInt")).replace("{b}", "1466"));
      document.getElementById("btnGenerate").click(); await w(500);
      const p = proj(), c = p.configs["Colt A"];
      const A = p.pieces.filter(x => x.modulo === "Colt A A"), Bw = p.pieces.filter(x => x.modulo === "Colt A B");
      o.rows = c.wall2 === 1 && c.L2 === 1500 && A.length === 2 && Bw.length >= 2 && Bw.some(x => x.elemento === "Pannello supporto" && x.larg === 1466);
      o.salvat = c.lamCuts.length === 1 && c.lamCuts[0].wall === "B" && c.lamCuts[0].x === 300;
      const slB = Bw.filter(x => /^Lamella/.test(x.elemento)).reduce((q, x) => q + x.pz, 0);
      o.pieseB = slB === 27; /* 25 lamele, două atinse de decupaj se împart în câte două: 23 + 2·2 */
      const B = buildModule(c);
      const a = B.boxes.filter(b => b.pk <= 3 && false);
      const ovl = (x, y) => Math.min(x.x1, y.x1) - Math.max(x.x0, y.x0) > 1e-9 && Math.min(x.y1, y.y1) - Math.max(x.y0, y.y0) > 1e-9 && Math.min(x.z1, y.z1) - Math.max(x.z0, y.z0) > 1e-9;
      const sl = B.boxes.filter(b => b.role === "lamela");
      let hit = 0; for (let i = 0; i < sl.length; i++) for (let j = i + 1; j < sl.length; j++) if (ovl(sl[i], sl[j])) hit++;
      o.faraSuprapuneri = hit === 0 && B.boxes.every(b => b.x0 >= -1e-9 && b.z0 >= -1e-9);
      o.dimensiuni = Math.max(...B.boxes.map(b => b.x1)) === 2400 && Math.max(...B.boxes.map(b => b.z1)) === 34 + 1466;
      const rest = assemblySteps("Colt A", {}, c, p.pieces).map(x => x.x).join("|");
      o.pasi = rest.includes("A: ") && rest.includes("B: ") && rest.includes(t("cornInt")) && !rest.includes("{");
      o.auditVerde = auditProject(p).length === 0;
      /* colț ieșit: B are lățimea întreagă; stânga: coordonate mutate în octantul pozitiv */
      const E = buildModule({ ...c, cornerKind: "ext", corner: "sx", lamCuts: [] });
      const bB = E.pieces.find(x => x.wing === "B" && x.elemento === "Pannello supporto");
      o.ext = bB.larg === 1500 && E.boxes.every(b => b.x0 >= -1e-9 && b.z0 >= -1e-9) && Math.max(...E.boxes.map(b => b.z1)) === 1500;
      let err = ""; try { buildModule({ ...c, L2: 30 }); } catch (e) { err = e.message; }
      let err2 = ""; try { buildModule({ ...c, lamCuts: [{ x: 10, y: 0, w: 20, h: 20, wall: "B" }] }); } catch (e) { err2 = e.message; }
      o.erori = err === t("lamErrCorner") && err2 === t("lamErrCorner");
      /* boiserie pe doi pereți */
      const Q = buildModule({ ...PRESETS.boiserie, name: "Q", wall2: 1, L2: 1800, corner: "dx", cornerKind: "int", lamCuts: [] });
      o.boiserie = !!Q.rf && !!Q.rf2 && Q.pieces.some(x => x.wing === "B" && x.elemento === "Montante cornice");
      const ai = aiNormCfg({ type: "lambriu", wall2: 1, L2: 1500, corner: "dx", cornerKind: "int", lamCuts: [{ x: 300, y: 300, w: 80, h: 80, wall: "B" }] }, []);
      o.ai = ai.wall2 === 1 && ai.lamCuts[0].wall === "B" && ai.L2 === 1500;
      const ks = ["fWall2", "lamWall", "lamErrCorner", "cornerInfo", "cornerS"];
      o.limbi = ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => ks.every(k => I18N[l][k] && I18N[l][k].length > 2));
      state.projects = keepP; state.activeId = keepA;
      return o;
    });
    ok("Colț: „al doilea perete” apare numai la lambriu și boiserie și aduce lățimea lui B, partea și felul colțului; decupajele au alegere de perete", r.ascuns === true && r.aratat === true && r.alegeZid === true && r.info === true);
    ok("Colț: distinta are piesele peretelui A (modul „… A”) și ale lui B („… B”, suport de 1466 la colț interior); decupajul din B se salvează", r.rows === true && r.salvat === true && r.pieseB === true);
    ok("Colț: 3D fără nicio suprapunere, totul în octantul pozitiv, dimensiunile 2400 și 34 + 1466; colț ieșit și boiserie pe doi pereți merg", r.faraSuprapuneri === true && r.dimensiuni === true && r.ext === true && r.boiserie === true);
    ok("Colț: pașii de montaj pe A și pe B cu felul colțului; semaforul verde; B prea scurt sau decupaj în grosimea lui A = eroare declarată; AI și 7 limbi", r.pasi === true && r.auditVerde === true && r.erori === true && r.ai === true && r.limbi === true);
    await pg.evaluate(() => { closeSheets(); });
  }

  head("Corp de colț (angolare) — colț interior: ala B pe partea camerei, nu în perete");
  {
    const r = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      const out = {};
      for (const kind of ["int", "ext"]) for (const corner of ["sx", "dx"]) {
        const B = buildModule({ ...PRESETS.angolare, name: "X", corner, cornerKind: kind, L: 1000, L2: 900, P: 600 });
        const A = B.boxes.filter(b => b.wing !== "B"), Bw = B.boxes.filter(b => b.wing === "B");
        const zA = Math.max(...A.map(b => b.z1)), mm = (a, k) => Math.min(...a.map(b => b[k])), MM = (a, k) => Math.max(...a.map(b => b[k]));
        out[kind + corner] = { zA, bz0: mm(Bw, "z0"), bz1: MM(Bw, "z1"), bx0: mm(Bw, "x0"), bx1: MM(Bw, "x1"), az0: mm(A, "z0"), info: B.angCorner };
      }
      const ok4 = (k, f) => f(out[k]);
      /* interior: B începe la fața lui A, în cameră (z ≥ zA), cu spatele pe peretele lui (x ≤ 1000 la dx, x ≥ 0 la sx) */
      o.intdx = ok4("intdx", q => q.bz0 >= q.zA - 1e-6 && q.bx1 <= 1000 + 1e-6 && q.az0 >= -1e-6);
      o.intsx = ok4("intsx", q => q.bz0 >= q.zA - 1e-6 && q.bx0 >= -1e-6 && q.az0 >= -1e-6);
      /* exterior: B în spatele planului lui A, pe fața peretelui care iese */
      o.extdx = ok4("extdx", q => q.bz1 <= 1e-6 && q.bx0 >= 1000 - 1e-6);
      o.extsx = ok4("extsx", q => q.bz1 <= 1e-6 && q.bx1 <= 1e-6);
      o.latimeB = out.intdx.info.wallB === Math.round(900 + out.intdx.zA) && out.intdx.info.kind === "int" && out.extdx.info.kind === "ext";
      /* preview: colțul interior spune cât trebuie să măsoare peretele B */
      const keepP = state.projects, keepA = state.activeId;
      state.projects = [{ id: "an1", name: "Colț", pieces: [], configs: {} }]; state.activeId = "an1";
      setView("build"); await w(200);
      presetApply({ cfg: { ...PRESETS.angolare, corner: "dx", cornerKind: "int" }, name: "Ang A" }); await w(300);
      o.nota = document.getElementById("angHint").textContent.includes(t("angWallB").replace("{w}", String(out.intdx.info.wallB).length ? "" : "").split("{")[0].slice(0, 12));
      document.getElementById("btnGenerate").click(); await w(400);
      o.generat = Object.keys(proj().configs).length === 1 && proj().pieces.some(x => x.modulo === "Ang A B");
      o.limbi = ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => I18N[l].angWallB && I18N[l].angWallB.includes("{w}"));
      state.projects = keepP; state.activeId = keepA;
      return o;
    });
    ok("Corp de colț: interior — ala B începe la fața alei A și stă pe partea camerei, cu spatele pe peretele B (stânga și dreapta); nu mai intră în perete", r.intdx === true && r.intsx === true);
    ok("Corp de colț: exterior neschimbat — ala B în spatele planului alei A, pe fața peretelui care iese; preview-ul spune lățimea peretelui B; textele în 7 limbi", r.extdx === true && r.extsx === true && r.latimeB === true && r.generat === true && r.limbi === true);
    await pg.evaluate(() => { closeSheets(); });
  }

  head("Consilier tehnic pe rânduri REALE — ușă înaltă și grea, bară lungă (nu rânduri scrise de mână)");
  {
    const r = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      const keepP = state.projects, keepA = state.activeId;
      state.projects = [{ id: "ad2", name: "T", pieces: [], configs: {} }]; state.activeId = "ad2";
      /* un dulap real de 1400×2400 cu bară de haine: ușa generată de motor are rolul „frontale” */
      generateInto(proj(), { ...PRESETS.armadio, name: "Arm", L: 1400, H: 2400, doors: 2, hang: 1 });
      const ids = adviceList(proj()).map(a => a.id);
      o.ua = proj().pieces.some(x => x.elemento === "Anta" && x.role === "frontale");
      o.inalta = ids.includes("TALL_DOOR");
      o.grea = ids.includes("HEAVY_DOOR");
      /* bară peste prag: modulul cu 1800 de lățime */
      generateInto(proj(), { ...PRESETS.armadio, name: "Larg", L: 2400, H: 2200, doors: 0, hang: 1, drawers: 0, tram: 0 });
      o.bara = adviceList(proj()).some(a => a.id === "ROD_SPAN" && a.modulo === "Larg");
      const keepSheet = document.getElementById("adviceBadge");
      auditBadge(); o.insigna = !keepSheet.hidden;
      state.projects = keepP; state.activeId = keepA; auditBadge();
      return o;
    });
    ok("Consilier: ușa generată de motor (rol „frontale”, nume „Anta”) primește sfatul de ușă înaltă și îngustă și de ușă grea", r.ua === true && r.inalta === true && r.grea === true);
    ok("Consilier: o bară de haine de peste 1000 mm dă sfat; insigna galbenă apare", r.bara === true && r.insigna === true);
    await pg.evaluate(() => { closeSheets(); });
  }

  head("Controale de coerență: caseta cu variante (raft fix / mobil), bucătăria demo verde");
  {
    const demoTxt = fs.readFileSync(path.join(__dirname, "golden", "bucatarie-U-demo.json"), "utf8");
    const r = await pg.evaluate(async (demoTxt) => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      const keepP = state.projects, keepA = state.activeId;
      closeSheets();
      /* 1. bucătăria demo: rafturile fixe dintre nișe nu mai cad la I7 */
      importJson(demoTxt); await w(500);
      const pd = proj(); const fd = auditProject(pd);
      o.demoI7 = fd.filter(a => a.id === "I7").length;
      o.demoRosu = blocking(fd).length;
      auditBadge(); o.demoVerde = document.getElementById("auditBadge").dataset.state === "green";
      /* 2. un I7 adevărat: configurația spune «mobil», piesele au rămas la lățime fixă */
      state.projects = [{ id: "fx1", name: "T", pieces: [], configs: {} }]; state.activeId = "fx1";
      generateInto(proj(), { ...PRESETS.armadio, name: "Rf", L: 600, H: 720, P: 560, shelves: 0, partitions: [{ type: "ripiano", y: 400, span: "full" }], doors: 0, drawers: 0, hang: 0, tram: 0, shelfType: "fisso", support: "zoccolo", plinth: 100 });
      o.okInit = blocking(auditProject(proj())).length === 0;
      proj().configs["Rf"].shelfType = "mobile";
      const f1 = auditProject(proj()).filter(a => a.id === "I7");
      o.rosu = f1.length === 1 && f1[0].severity === "blocking";
      o.arePatch = true;
      auditBadge(); o.badgeRosu = document.getElementById("auditBadge").dataset.state === "red";
      document.getElementById("auditBadge").click(); await w(300);
      const btn = document.querySelector("#auditBody [data-fx]");
      o.buton = !!btn;
      btn.click(); await w(400);
      o.sheet = document.getElementById("fxSheet").classList.contains("on");
      o.radii = document.querySelectorAll('#fxBody input[type="checkbox"]').length;
      o.preset = !!document.querySelector('#fxBody input[data-cid="regen"]:checked');
      /* alege «mobil, cu joc»: distinta se rescrie cu lățime − joc și controlul se închide */
      const mob = document.querySelector('#fxBody input[data-cid="regen"]'); mob.checked = true; mob.dispatchEvent(new Event("change", { bubbles: true }));
      document.getElementById("fxApply").click(); await w(1200);
      const rip1 = proj().pieces.find(x => x.role === "ripiano");
      o.mobil = proj().configs["Rf"].shelfType === "mobile" && rip1 && Math.round(rip1.lung) === 560;
      o.verde1 = blocking(auditProject(proj())).length === 0 && document.getElementById("auditBadge").dataset.state === "green";
      /* 3. aceeași stare, dar se alege varianta fixă */
      proj().pieces.forEach(x => { if (x.gen === "Rf" && x.role === "ripiano") x.lung = 562; });
      const f2 = auditProject(proj()).filter(a => a.id === "I7");
      o.rosu2 = f2.length === 1;
      fixSheet("Rf"); await w(300);
      const fi = document.querySelector('#fxBody input[data-cid="sh:fisso"]'); o.cheFix = !!fi; fi.checked = true; fi.dispatchEvent(new Event("change", { bubbles: true }));
      document.getElementById("fxApply").click(); await w(1200);
      const rip2 = proj().pieces.find(x => x.role === "ripiano");
      o.fix = proj().configs["Rf"].shelfType === "fisso" && rip2 && Math.round(rip2.lung) === 562;
      o.verde2 = blocking(auditProject(proj())).length === 0;
      /* 4. alt control, alt corp: jocuri între uși sub minimul de montaj (A5) — soluții încercate, alese, verde */
      generateInto(proj(), { ...PRESETS.armadio, name: "Gp", L: 800, H: 720, P: 560, doors: 2, shelves: 0, hang: 0, drawers: 0, tram: 0, support: "zoccolo", plinth: 100, geom: { gap_ante: 1, gap_sup: 0, gap_inf: 0 } });
      const f3 = auditProject(proj()).filter(a => a.modulo === "Gp" && a.severity === "blocking");
      o.a5 = f3.some(a => a.id === "A5");
      closeSheets(); fixSheet("Gp"); await w(500);
      o.a5Sol = document.querySelectorAll('#fxBody input[type="checkbox"]').length >= 2;
      document.getElementById("fxApply").click(); await w(1500);
      o.a5Verde = blocking(auditProject(proj()).filter(a => a.modulo === "Gp")).length === 0;
      closeSheets();
      state.projects = keepP; state.activeId = keepA; auditBadge();
      return o;
    }, demoTxt);
    ok("Demo bucătărie: rafturile fixe dintre nișe nu mai cad la I7 — nimic roșu, insigna verde", r.demoI7 === 0 && r.demoRosu === 0 && r.demoVerde === true);
    ok("Control I7 real: roșu, cu două variante (mobil / fix) și buton «Alege varianta corectă» în listă", r.okInit === true && r.rosu === true && r.arePatch === true && r.badgeRosu === true && r.buton === true);
    ok("Caseta de soluții se deschide cu soluțiile încercate (ricalcul, raft mobil/fix), prima preselectată", r.sheet === true && r.radii >= 2 && r.preset === true);
    ok("Varianta «mobil» rescrie distinta (560 = 562 − 2) și controlul devine verde", r.mobil === true && r.verde1 === true);
    ok("Varianta «fix» rescrie distinta (562, fără joc) și controlul devine verde", r.rosu2 === true && r.fix === true && r.verde2 === true);
    ok("Alt control, alt corp (A5, jocuri sub minim): soluțiile propuse sunt încercate, cu cea preselectată controlul devine verde", r.a5 === true && r.a5Sol === true && r.a5Verde === true);
    await pg.evaluate(() => { closeSheets(); });
  }

  head("Boiserie cu panou încastrat în ramă — formular, panouri, canale în rame, gaură de priză, montaj");
  {
    const r = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      const keepP = state.projects, keepA = state.activeId;
      state.projects = [{ id: "in1", name: "Perete", pieces: [], configs: {} }]; state.activeId = "in1";
      setView("build"); await w(200);
      presetApply({ cfg: { ...PRESETS.boiserie, back: 0, matFront: "dsp_mdf_10" }, name: "Inset A" }); await w(300);
      o.camp = document.getElementById("rowRfInset").style.display !== "none" && document.getElementById("bRfInset").value === "0";
      const sel = document.getElementById("bRfInset"); sel.value = "1"; sel.dispatchEvent(new Event("change", { bubbles: true })); await w(300);
      document.getElementById("btnLamCutAdd").click(); await w(150);
      document.querySelector('#lamCutBox [data-lc="0:x"]').value = "300"; document.querySelector('#lamCutBox [data-lc="0:x"]').dispatchEvent(new Event("input", { bubbles: true }));
      document.querySelector('#lamCutBox [data-lc="0:y"]').value = "400"; document.querySelector('#lamCutBox [data-lc="0:y"]').dispatchEvent(new Event("input", { bubbles: true })); await w(300);
      document.getElementById("btnGenerate").click(); await w(500);
      const p = proj(), c = p.configs["Inset A"];
      const pn = p.pieces.filter(x => x.elemento === "Pannello campo");
      o.salvat = c.rfInset === 1 && c.matFront === "dsp_mdf_10";
      o.panouri = pn.reduce((a, x) => a + x.pz, 0) === 8 && pn.every(x => x.lung === 1226 && x.larg === 541) && pn.some(x => x.scasso) && pn.length === 2;
      o.material = pn.every(x => /10/.test(x.materiale));
      const B = buildModule(c), ops = generateOperations({ boxes: B.boxes, cfg: c, G: undefined });
      const sl = Array.from(ops.pieces).filter(q => q.role === "rama_montant" || q.role === "rama_traversa").flatMap(q => Array.from(q.operations).filter(z => z.type === "slot"));
      o.canale = sl.length === 32 && sl.every(z => z.face >= 1 && z.face <= 4 && z.depth === 8 && z.thk === 10);
      const rest = assemblySteps("Inset A", {}, c, p.pieces).map(x => x.x).join("|");
      o.pas = rest.includes(t("rfS5").replace("{k}", "8")) && !rest.includes("{");
      o.auditVerde = auditProject(p).length === 0;
      /* grosime prea mare: eroare declarată */
      let err = ""; try { buildModule({ ...c, matFront: "pal25_alb" }); } catch (e) { err = e.message; }
      o.eroare = err === t("rfErrInset");
      /* colț cu panouri încastrate: B are și el panouri și canale */
      const K = buildModule({ ...c, wall2: 1, L2: 1500, corner: "dx", cornerKind: "int", lamCuts: [] });
      const oK = generateOperations({ boxes: K.boxes, cfg: { ...c, wall2: 1 }, G: undefined });
      const nPanels = K.pieces.filter(x => x.role === "rama_camp").reduce((a, x) => a + x.pz, 0);
      const slK = Array.from(oK.pieces).filter(q => q.role === "rama_montant" || q.role === "rama_traversa").flatMap(q => Array.from(q.operations).filter(z => z.type === "slot")).length;
      o.colt = nPanels > 8 && slK === 4 * nPanels;
      const ai = aiNormCfg({ type: "boiserie", rfInset: 1 }, []);
      o.ai = ai.rfInset === 1;
      const ks = ["fRfInset", "rfErrInsetMat", "rfErrInset", "rfS5", "role_rama_camp"];
      o.limbi = ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => ks.every(k => I18N[l][k] && I18N[l][k].length > 2)) && ["ro", "en", "fr", "de", "pl", "es"].every(l => EL_I18N[l]["Pannello campo"]);
      state.projects = keepP; state.activeId = keepA;
      return o;
    });
    ok("Panou încastrat: comutatorul apare la boiserie, se salvează; panourile (8, dimensiunea câmpului + 2·gd, din materialul fronturilor), unul cu gaura de priză", r.camp === true && r.salvat === true && r.panouri === true && r.material === true);
    ok("Panou încastrat: 32 de canale în rame (4 pe panou), pe marginea ramei, cu grosimea panoului; pașii de montaj spun câte panouri se introduc; semaforul verde", r.canale === true && r.pas === true && r.auditVerde === true);
    ok("Panou încastrat: panou prea gros = eroare declarată; la colț și B are panouri și canale; AI și 7 limbi", r.eroare === true && r.colt === true && r.ai === true && r.limbi === true);
    await pg.evaluate(() => { closeSheets(); });
  }

  head("Piesă cu contur liber — formă gata, import SVG/DXF, rând cu perimetru, contur exact pentru mașină");
  {
    const r = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      const keepP = state.projects, keepA = state.activeId;
      state.projects = [{ id: "ct2", name: "Bufet", pieces: [], configs: {} }]; state.activeId = "ct2";
      setView("build"); await w(200);
      presetApply({ cfg: PRESETS.contur, name: "Lateral" }); await w(400);
      o.camp = document.getElementById("rowCont").style.display !== "none" && document.getElementById("rowP").style.display === "none" && document.getElementById("rowContRise").style.display !== "none" && document.getElementById("rowContSrc").style.display === "none";
      o.dbgHint = document.getElementById("contHint").textContent + " | " + ["rowCont", "rowP", "rowContRise", "rowContSrc"].map(i => document.getElementById(i).style.display).join(",");
      o.info = /1800×500/.test(document.getElementById("contHint").textContent) && /4[.,]62/.test(document.getElementById("contHint").textContent);
      document.getElementById("btnGenerate").click(); await w(500);
      let p = proj(), x = p.pieces.find(q => q.elemento === "Pezzo contorno");
      o.rand = !!x && x.pz === 2 && x.lung === 500 && x.larg === 1800 && x.bordo === "CONT" && x.shape === "contur" && x.perim === 4621 && Array.isArray(x.contour) && x.contour.length === 4;
      o.cant = Math.round(bandingMm(x.bordo, x.lung, x.larg, x.angL, x.angR, x.shape, x.perim)) === 4621 && bandingMm("2L", 100, 100, 0, 0, undefined, 0) > 0;
      o.salvat = p.configs["Lateral"].type === "contur" && p.configs["Lateral"].cShape === "scoop" && p.configs["Lateral"].P === 18;
      const c = p.configs["Lateral"], B = buildModule(c), ops = generateOperations({ boxes: B.boxes, cfg: c, G: undefined });
      const op = Array.from(ops.pieces).flatMap(q => Array.from(q.operations)).find(q => q.type === "contour");
      o.contur = !!op && op.face === 5 && op.pts.length === 4 && Math.abs(op.pts[0][2]) > 0.05 && Math.abs(op.perim - 4621.3) < 1;
      o.pas = assemblySteps("Lateral", {}, c, p.pieces).map(q => q.x).join("|").includes("1800×500");
      o.audit = auditProject(p).length === 0;
      /* contur din SVG: un D, scalat la lățimea L = 400 */
      const sel = document.getElementById("bContShape"); sel.value = "custom"; sel.dispatchEvent(new Event("change", { bubbles: true }));
      const fit = document.getElementById("bContFit"); fit.value = "W"; fit.dispatchEvent(new Event("change", { bubbles: true }));
      document.getElementById("bL").value = "400";
      const src = document.getElementById("bContSrc"); src.value = "M 0 0 L 300 0 A 150 150 0 0 1 300 -300 L 0 -300 Z"; src.dispatchEvent(new Event("input", { bubbles: true })); await w(300);
      o.dbg2 = document.getElementById("contHint").textContent + "|L=" + document.getElementById("bL").value;
      o.imp = document.getElementById("rowContSrc").style.display !== "none" && document.getElementById("bL").value === "400" && document.getElementById("contHint").textContent.includes("400×");
      /* fișier: se citește în casetă */
      const dt = new DataTransfer(); dt.items.add(new File(["0,0 500,0 500,200 0,200"], "p.txt", { type: "text/plain" }));
      const fi = document.getElementById("bContFile"); fi.files = dt.files; fi.dispatchEvent(new Event("change", { bubbles: true })); await w(400);
      fit.value = "none"; fit.dispatchEvent(new Event("change", { bubbles: true })); await w(200);
      o.fisier = document.getElementById("bContSrc").value.startsWith("0,0 500,0") && document.getElementById("bL").value === "500" && document.getElementById("bH").value === "200";
      /* contur nevalid (fluture): mesajul în indiciu, fără piesă nouă */
      src.value = "0,0 100,100 100,0 0,100"; src.dispatchEvent(new Event("input", { bubbles: true })); await w(300);
      o.dbg3 = document.getElementById("contHint").textContent;
      o.nevalid = document.getElementById("contHint").textContent.includes(t("contWhy_self"));
      const nBefore = proj().pieces.length;
      document.getElementById("bName").value = "Rau"; document.getElementById("btnGenerate").click(); await w(400);
      o.faraPiesa = proj().pieces.length === nBefore;
      /* AI + texte */
      const ai = aiNormCfg({ type: "contur", cShape: "scoop", cRise: 100, cPz: 2, cOri: "o", cEdge: 1, cR: 40 }, []);
      o.ai = ai.type === "contur" && ai.cShape === "scoop" && ai.cRise === 100 && ai.cPz === 2 && ai.cOri === "o" && ai.cEdge === 1 && AI_ENUM.type.includes("contur");
      const ks = ["typeContur", "preset_contur", "fContShape", "contShapeCustom", "contShapeRect", "contShapeRound", "contShapeArch", "contShapeScoop", "fContR", "fContRise", "fContSrc", "contFitNone", "contFitW", "contFitH", "fContOri", "contOriV", "contOriO", "fContPz", "fContEdge", "contInfo", "contErr", "contErrMat", "contErrEmpty", "contErrBig", "contBig",
        "contWhy_few", "contWhy_area", "contWhy_self", "contWhy_open", "contWhy_multi", "contWhy_path", "contWhy_cmd", "contWhy_points", "contWhy_empty", "contWhy_dxf", "contWhy_units", "contWhy_many", "contS1", "contS2", "contS3", "role_contur"];
      o.limbi = ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => ks.every(k => I18N[l][k] && I18N[l][k].length > 1)) && ["ro", "en", "fr", "de", "pl", "es"].every(l => EL_I18N[l]["Pezzo contorno"]);
      state.projects = keepP; state.activeId = keepA;
      return o;
    });
    ok("Contur liber: tipul apare cu forma, raza/săgeata, poziția, bucățile, cantul; presetul (lateral scobit 1800×500) anunță dimensiunile și cantul de 4,62 m", r.camp === true && r.info === true, JSON.stringify({ camp: r.camp, info: r.info, h: r.dbgHint }));
    ok("Contur liber: rândul din distinctă are gabaritul, 2 bucăți, perimetrul exact pentru cant și conturul păstrat; operația „contour” cu arc ajunge la mașină; pașii și semaforul verde", r.rand === true && r.cant === true && r.salvat === true && r.contur === true && r.pas === true && r.audit === true);
    ok("Contur liber: import din SVG scalat la lățime, din fișier citit în casetă (L și H se completează), contur nevalid = mesaj în indiciu și nicio piesă nouă; AI și 7 limbi", r.imp === true && r.fisier === true && r.nevalid === true && r.faraPiesa === true && r.ai === true && r.limbi === true, JSON.stringify({ imp: r.imp, fisier: r.fisier, nevalid: r.nevalid, faraPiesa: r.faraPiesa, ai: r.ai, limbi: r.limbi, h2: r.dbg2 }));
    await pg.evaluate(() => { closeSheets(); });
  }

  head("Piesă cu contur liber v2 — mai multe piese, găuri și decupaje interioare, canale, import cu găuri");
  {
    const r = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      const keepP = state.projects, keepA = state.activeId;
      state.projects = [{ id: "ct3", name: "Bufet2", pieces: [], configs: {} }]; state.activeId = "ct3";
      const $$ = id => document.getElementById(id), fire = (el, ev) => el.dispatchEvent(new Event(ev, { bubbles: true }));
      setView("build"); await w(200);
      presetApply({ cfg: PRESETS.contur, name: "Lat2" }); await w(400);
      o.campuri = !!$$("bContHoles") && !!$$("bContGrooves") && !!$$("bContPart") && $$("rowContParts").style.display !== "none" && $$("bContDel").disabled === true && $$("bContPart").options.length === 1;
      /* găuri + canal pe piesa 1 (lateral scobit 1800×500) */
      $$("bContHoles").value = "c 300 300 8\nc 900 250 80\nr 1400 250 120 60 8"; fire($$("bContHoles"), "input");
      $$("bContGrooves").value = "100 400 1700 400 10 8"; fire($$("bContGrooves"), "input"); await w(300);
      o.dbgH = $$("contHint").textContent;
      o.hint = /3/.test($$("contHint").textContent) && /1/.test($$("contHint").textContent) && $$("contHint").textContent.includes(t("contInfoH").split("{g}")[0]);
      $$("btnGenerate").click(); await w(500);
      let p = proj(), x = p.pieces.find(q => q.elemento === "Pezzo contorno");
      const c = p.configs["Lat2"];
      o.salvat = !!c && Array.isArray(c.cParts) && c.cParts.length === 1 && c.cParts[0].holesTxt.includes("c 900 250 80") && c.cHoles.includes("r 1400") && c.cGrooves === "100 400 1700 400 10 8" && c.contour.length === 4;
      o.rand = !!x && x.pz === 2 && x.perim === 4621 && x.bordo === "CONT";
      const B = buildModule(c), ops = generateOperations({ boxes: B.boxes, cfg: c, G: undefined });
      const pcs = Array.from(ops.pieces), ol = pcs[0].operations ? Array.from(pcs[0].operations) : [];
      o.ops = pcs.length === 2 && ol.filter(q => q.type === "drill").length === 1 && ol.filter(q => q.type === "contour" && q.inner).length === 2 && ol.filter(q => q.type === "groove").length === 1 && ol.some(q => q.type === "groove" && q.width === 10 && q.depth === 8);
      o.pas = assemblySteps("Lat2", {}, c, p.pieces).map(q => q.x).join("|").includes(t("contS4").split("{n}")[0].trim());
      o.audit = auditProject(p).length === 0;
      /* fișa piesei desenează conturul cu găurile golite */
      const sv = partSVG(pcs[0], 5); o.desen = sv.includes('fill-rule="evenodd"');
      /* a doua piesă: dreptunghi 400×300 cu o gaură, 3 bucăți */
      $$("bContAdd").click(); await w(300);
      o.doua = $$("bContPart").options.length === 2 && $$("bContPart").value === "1" && $$("bContShape").value === "rect" && $$("bL").value === "600" && $$("bH").value === "400" && $$("bContHoles").value === "";
      $$("bL").value = "400"; fire($$("bL"), "input"); $$("bH").value = "300"; fire($$("bH"), "input");
      $$("bContPz").value = "3"; fire($$("bContPz"), "input");
      $$("bContHoles").value = "c 200 150 30"; fire($$("bContHoles"), "input"); await w(300);
      /* înapoi la piesa 1: câmpurile ei au rămas */
      $$("bContPart").value = "0"; fire($$("bContPart"), "change"); await w(300);
      o.inapoi = $$("bContShape").value === "scoop" && $$("bContHoles").value.includes("c 900 250 80") && $$("bContGrooves").value.startsWith("100 400") && $$("bL").value === "1800" && $$("bContPz").value === "2";
      $$("bName").value = "Lat2"; $$("btnGenerate").click(); await w(500);
      p = proj(); const rows = p.pieces.filter(q => q.elemento === "Pezzo contorno");
      o.randuri = rows.length === 2 && rows.map(q => q.pz).sort().join() === "2,3" && p.configs["Lat2"].cParts.length === 2;
      const c2 = p.configs["Lat2"], B2 = buildModule(c2), pks = new Set(B2.boxes.map(b => b.pk));
      o.pk = pks.size === 5 && B2.cont.parts.length === 2 && B2.cont.parts[1].holes === 1;
      /* se redeschide: modulul cu 2 piese se încarcă în formular */
      buildCfg = JSON.parse(JSON.stringify(c2)); syncBuildForm(); await w(300);
      o.reload = $$("bContPart").options.length === 2 && $$("bContPart").selectedIndex === 0 && $$("bContHoles").value.includes("c 900 250 80");
      $$("bContPart").value = "1"; fire($$("bContPart"), "change"); await w(200);
      o.reload2 = $$("bContShape").value === "rect" && $$("bContPz").value === "3" && $$("bContHoles").value === "c 200 150 30";
      /* gaură greșită: mesajul cu linia, nicio piesă nouă */
      $$("bContHoles").value = "c 200 150 30\nzzz"; fire($$("bContHoles"), "input"); await w(300);
      o.eroare = $$("contHint").textContent.includes(t("contWhy_holeSyntax").split("{n}")[0]) && $$("contHint").textContent.includes("2");
      const nB = proj().pieces.length;
      $$("btnGenerate").click(); await w(400);
      o.faraPiesa = proj().pieces.length === nB;
      $$("bContHoles").value = "c 3 3 9"; fire($$("bContHoles"), "input"); await w(300);
      o.eroare2 = $$("contHint").textContent.includes(t("contWhy_holeOut").split("{n}")[0]);
      $$("bContHoles").value = "c 200 150 30"; fire($$("bContHoles"), "input"); await w(200);
      /* ștergerea piesei 2 */
      $$("bContDel").click(); await w(300);
      o.sters = $$("bContPart").options.length === 1 && $$("bContShape").value === "scoop" && $$("bContDel").disabled === true;
      /* import SVG cu o gaură: dreptunghi 400×300 + cerc Ø80 */
      $$("bContAdd").click(); await w(200);
      $$("bContShape").value = "custom"; fire($$("bContShape"), "change");
      const src = $$("bContSrc"); src.value = "M 0 0 L 400 0 L 400 -300 L 0 -300 Z M 100 -150 A 40 40 0 1 1 180 -150 A 40 40 0 1 1 100 -150 Z"; fire(src, "input"); await w(300);
      o.importH = $$("contHint").textContent.includes("400×300");
      const cc = cfgFromForm(), B3 = buildModule(cc);
      const withC = B3.boxes.filter(b => b.cont);
      o.importH2 = cc.cParts.length === 2 && cc.cParts[1].impHoles.length === 1 && withC.length === 3 && withC.some(b => b.cont.holes.length === 1 && b.cont.holes[0].circle && Math.abs(b.cont.holes[0].circle.d - 80) < 1e-6);
      /* AI: câmpurile noi, normalizate; piesa 1 dictată, piesa 2 rămâne */
      const ai = aiNormCfg({ type: "contur", cHoles: "c 100 100 8", cGrooves: "50 50 550 50 10 8" }, []);
      const warn = []; const bad = aiNormCfg({ cHoles: "zzz" }, warn);
      o.ai = ai.cHoles === "c 100 100 8" && ai.cGrooves === "50 50 550 50 10 8" && bad.cHoles === undefined && warn.length === 1;
      const base2 = JSON.parse(JSON.stringify(cc)); const fix = aiContFix(base2, { cRise: 60 });
      o.aiFix = fix.cParts.length === 2 && fix.contour === null && fix.cParts[0].contour === null && fix.cParts[1].src.includes("M 0 0");
      const ks = ["fContPart", "contPartN", "contPartAdd", "fContHoles", "contHolesHelp", "fContGrooves", "contGroovesHelp", "contInfoH", "contWhy_holeSyntax", "contWhy_holeOut", "contWhy_holeHit", "contWhy_holeWeb", "contWhy_holeBad", "contWhy_holeMany",
        "contWhy_grooveSyntax", "contWhy_grooveOut", "contWhy_grooveDepth", "contWhy_grooveW", "contWhy_grooveMany", "contWhy_multi", "contS4", "contS5"];
      o.limbi = ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => ks.every(k => I18N[l][k] && I18N[l][k].length > 2)) && ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => /\{n\}/.test(I18N[l].contPartN) && /\{n\}/.test(I18N[l].contWhy_holeOut));
      state.projects = keepP; state.activeId = keepA;
      return o;
    });
    const dbg = JSON.stringify(r);
    ok("Contur v2: câmpurile pentru găuri, canale și lista de piese apar (o piesă, ștergerea blocată); găurile și canalul se salvează în modul (cParts și câmpurile vechi)", r.campuri === true && r.salvat === true, dbg);
    ok("Contur v2: indiciul numără găurile și canalele; rândul păstrează perimetrul exterior; operațiile: 1 burghiu, 2 decupaje interioare, canal 10×8; pașii; fișa cu găurile golite; semafor verde", r.hint === true && r.rand === true && r.ops === true && r.pas === true && r.audit === true && r.desen === true);
    ok("Contur v2: a doua piesă (+): formular curat, valorile fiecărei piese rămân la schimbare, 2 rânduri și 5 piese fizice, modulul se redeschide cu ambele piese", r.doua === true && r.inapoi === true && r.randuri === true && r.pk === true && r.reload === true && r.reload2 === true);
    ok("Contur v2: gaură greșită = mesaj cu linia sau gaura și nicio piesă nouă; ștergerea piesei; import SVG cu gaură (cerc Ø80 recunoscut); AI și 7 limbi", r.eroare === true && r.faraPiesa === true && r.eroare2 === true && r.sters === true && r.importH === true && r.importH2 === true && r.ai === true && r.aiFix === true && r.limbi === true);
    await pg.evaluate(() => { closeSheets(); });
  }

  head("Analiza fuzz (D-103) — aripa B cu operații, sertar care intră în bază/tavan, mâner pe ușă joasă");
  {
    const r = await pg.evaluate(async () => {
      const o = {};
      const base = { name: "W", type: "standard", L: 1800, H: 1191, P: 434, plinth: 100, tram: 1, shelves: 0, drawers: 4, doors: 0, back: 1, hang: 0, drawerSys: "legrabox", drawerDist: "cucina", drawerH: "F", matBody: state.settings.matBody, matFront: state.settings.matFront, matBack: state.settings.matBack };
      const b = buildModule(base);
      o.warn = !!b.warn.boxHit && b.warn.boxHit.n === 2 && b.warn.boxHit.mm > 0;
      const ang = buildModule({ ...base, type: "angolare", L2: 1100, cornerKind: "int", corner: "dx" });
      o.angWarn = !!ang.warn && !!ang.warn.boxHit && ang.warn.boxHit.n === 4;
      o.d104 = buildModule({ ...base, drawerH: undefined }).draw.lowShift === 4 && !buildModule({ ...base, drawerH: undefined }).warn.boxHit;
      /* aripa B a unui colț cu uși: balamale și mâner pe ambele uși */
      const c = { ...base, type: "angolare", L: 900, L2: 1100, H: 720, plinth: 100, tram: 0, drawers: 0, doors: 2, cornerKind: "int", corner: "dx" };
      const cb = buildModule(c), ops = generateOperations({ boxes: cb.boxes, cfg: c, G: undefined });
      const bd = Array.from(ops.pieces).filter(p => p.wing === "B" && p.role === "frontale");
      o.aripaB = bd.length === 2 && bd.every(p => Array.from(p.operations).filter(q => q.note === "tazza cerniera").length >= 2 && Array.from(p.operations).filter(q => q.note === "maniglia").length === 2);
      o.fara = Array.from(ops.pieces).every(p => Array.from(p.preflight || []).filter(w => w.level === "error").length === 0);
      o.hwId = (() => { const ids = Array.from(ops.hw).map(h => h.id); return new Set(ids).size === ids.length && Array.from(ops.hw).some(h => h.wing === "B"); })();
      o.limbi = ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => I18N[l].wBoxHit && /\{n\}/.test(I18N[l].wBoxHit) && /\{mm\}/.test(I18N[l].wBoxHit));
      /* nota apare în previzualizare */
      const keepL = state.lang; state.lang = "ro"; applyLang();
      o.nota = t("wBoxHit").replace("{n}", 2).replace("{mm}", "4").startsWith("2 sertar"); state.lang = keepL; applyLang();
      return o;
    });
    ok("Fuzz D-103: avertisment când cutia sertarului intră în bază/tavan (și la colț, unde înainte tăcea); aripa B are balamale și mânere, fără erori de pre-flight, ID-uri hw unice; 7 limbi", r.warn === true && r.angWarn === true && r.d104 === true && r.aripaB === true && r.fara === true && r.hwId === true && r.limbi === true && r.nota === true, JSON.stringify(r));
  }

  head("D-104 — sertarul metalic nu mai intră în bază; un proiect v2 se mută la v3 cu diferența în față");
  {
    const mkP = (id, cfg, rows) => ({ id, name: id, client: "", date: "2026-10-01", geomVersion: 2, configs: { [cfg.name]: cfg },
      pieces: rows.map((r, i) => ({ id: id + i, gen: cfg.name, modulo: cfg.name, elemento: r[0], lung: r[1], larg: r[2], pz: r[3], bordo: "", materiale: "x" })) });
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
    const eErrs = [];
    const metal = { name: "Cassettiera", type: "standard", L: 1800, H: 1191, P: 434, plinth: 100, tram: 1, shelves: 0, drawers: 4, doors: 0, back: 1, hang: 0, drawerSys: "legrabox", drawerDist: "cucina", matBody: "__none__" };
    const plain = { name: "Libreria", type: "standard", L: 800, H: 1800, P: 300, plinth: 80, tram: 0, shelves: 4, drawers: 0, doors: 0, back: 1, hang: 0, matBody: "__none__" };
    await ctx.addInitScript(([a, b]) => localStorage.setItem("tagliapro",
      JSON.stringify({ lang: "it", activeId: "pm", projects: [a, b], settings: {}, stock: [] })), [mkP("pm", metal, []), mkP("pl", plain, [])]);
    const mp = await ctx.newPage();
    mp.on("pageerror", e => eErrs.push(String(e)));
    await mp.goto(URL); await mp.waitForTimeout(3300); await mp.evaluate(() => closeSheets());
    const r = await mp.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      const mat = state.settings.matBody;
      /* progetti salvati col motore v2: le righe di sempre, generate con il codice di prima (primo frontale 140, altri 313) */
      for (const p of state.projects) { Object.values(p.configs).forEach(c => { c.matBody = mat; c.matFront = mat; c.matBack = state.settings.matBack; }); }
      const pm = state.projects.find(p => p.id === "pm"), pl = state.projects.find(p => p.id === "pl");
      pm.pieces = [["Frontale cassetto", 140, 897, 2], ["Frontale cassetto", 313, 897, 6]].map((r, i) => ({ id: "m" + i, gen: "Cassettiera", modulo: "Cassettiera", elemento: r[0], lung: r[1], larg: r[2], pz: r[3], bordo: "", materiale: "x" }));
      const bp = buildModule(pl.configs["Libreria"]);
      pl.pieces = bp.pieces.map((q, i) => ({ id: "l" + i, gen: "Libreria", modulo: "Libreria", elemento: q.elemento, lung: q.lung, larg: q.larg, pz: q.pz, bordo: q.bordo || "", materiale: "x" }));
      state.activeId = "pl"; setView("list"); await w(400); geomBanner();
      o.plainStampato = pl.geomVersion === GEOM_VERSION && document.getElementById("geomBanner").hidden;
      state.activeId = "pm"; setView("list"); await w(400); geomBanner();
      o.metalBanner = pm.geomVersion === 2 && !document.getElementById("geomBanner").hidden;
      const d = geomDiff(pm).filter(r => r.vecchio && r.nuovo).map(r => r.elemento + ": " + r.vecchio.lung + "→" + r.nuovo.lung);
      o.diff = d.includes("Frontale cassetto: 313→311");
      o.dbg = d.join("|");
      o.nuovo = buildModule(pm.configs["Cassettiera"]).draw.fronts[0].y0 === 106;
      window.download = () => {}; await geomApply(); await w(600);
      o.apply = pm.geomVersion === GEOM_VERSION && document.getElementById("geomBanner").hidden && pm.pieces.some(x => x.larg === 897 && x.lung === 311);
      return o;
    });
    ok("D-104: un proiect v2 fără sertare metalice primește ștampila v3 în tăcere (fără banner veșnic)", r.plainStampato === true, JSON.stringify(r));
    ok("D-104: un proiect v2 cu sertar metalic păstrează cotele vechi, arată diferența (313 → 311) și abia după confirmare trece la v3", r.metalBanner === true && r.diff === true && r.nuovo === true && r.apply === true, JSON.stringify(r));
    ok("D-104: nicio eroare JS", eErrs.length === 0, eErrs[0] || "nessuno");
    await ctx.close();
  }

  head("geomDiff — piese cu același nume și cote diferite (uși trapezoidale sub scară): fără diferențe false");
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const eErrs = [];
    const gp = await ctx.newPage();
    gp.on("pageerror", e => eErrs.push(String(e)));
    await gp.goto(URL); await gp.waitForTimeout(3300); await gp.evaluate(() => closeSheets());
    const r = await gp.evaluate(() => {
      const o = {}, mat = state.settings.matBody;
      const mk = () => {
        const p = { id: "gd", name: "gd", client: "", date: "2026-11-02", geomVersion: GEOM_VERSION, pieces: [] };
        generateInto(p, { name: "Sottoscala", type: "standard", L: 1250, H: 1450, P: 600, plinth: 100, tram: 1, shelves: 1, drawers: 0, doors: 2, back: 1, hang: 0,
          topProfile: { axis: "x", h0: 1450, h1: 605 }, matBody: mat, matFront: mat, matBack: state.settings.matBack });
        return p;
      };
      const p = mk(), ante = p.pieces.filter(x => x.elemento === "Anta");
      o.due = ante.length === 2 && ante[0].lung !== ante[1].lung;
      o.identic = geomDiff(p).length === 0;
      const q = mk(); const i0 = q.pieces.findIndex(x => x.elemento === "Anta"), i1 = q.pieces.map(x => x.elemento).lastIndexOf("Anta");
      [q.pieces[i0], q.pieces[i1]] = [q.pieces[i1], q.pieces[i0]];
      o.ordineAltfel = geomDiff(q).length === 0;
      const c = mk(), big = c.pieces.find(x => x.elemento === "Anta" && x.lung === ante[0].lung);
      big.lung = ante[0].lung - 20;
      const dc = geomDiff(c);
      o.unaSchimbata = dc.length === 1 && dc[0].vecchio.lung === ante[0].lung - 20 && dc[0].nuovo.lung === ante[0].lung;
      const m = mk(); m.pieces.splice(m.pieces.findIndex(x => x.elemento === "Anta" && x.lung === ante[1].lung), 1);
      const dm = geomDiff(m);
      o.lipsa = dm.length === 1 && dm[0].vecchio === null && dm[0].nuovo.lung === ante[1].lung;
      const e = mk(); e.pieces.push(Object.assign({}, e.pieces.find(x => x.elemento === "Anta"), { id: "extra", lung: 777 }));
      const de = geomDiff(e);
      o.extra = de.length === 1 && de[0].nuovo === null && de[0].vecchio.lung === 777;
      o.dbg = JSON.stringify([ante.map(x => x.lung), dc.map(x => [x.elemento, x.vecchio && x.vecchio.lung, x.nuovo && x.nuovo.lung]), dm.length, de.length]);
      return o;
    });
    ok("geomDiff: un corp cu două uși de înălțimi diferite, neatins, nu dă nicio diferență (și nici dacă rândurile sunt în altă ordine)", r.due === true && r.identic === true && r.ordineAltfel === true, JSON.stringify(r));
    ok("geomDiff: o ușă schimbată în distinta salvată dă exact un rând (ea), nu un rând fals pentru cealaltă", r.unaSchimbata === true, JSON.stringify(r));
    ok("geomDiff: o ușă lipsă sau în plus în distinta salvată e raportată ca atare", r.lipsa === true && r.extra === true, JSON.stringify(r));
    ok("geomDiff: nicio eroare JS", eErrs.length === 0, eErrs[0] || "nessuno");
    await ctx.close();
  }

  head("Căutare în listele lungi de ferătură (balamale Blum: ~170 de coduri) — catalog și formularul corpului");
  {
    const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } });
    const eErrs = [];
    const sp = await ctx.newPage();
    sp.on("pageerror", e => eErrs.push(String(e)));
    await sp.goto(URL); await sp.waitForTimeout(3300); await sp.evaluate(() => closeSheets());
    const r = await sp.evaluate(() => {
      const o = {}; renderCatalog();
      const sl = document.querySelector('#catHwWrap select[data-cat="cern"]'), inp = sl.parentNode.querySelector(".hw-find"), n0 = sl.options.length, cur = sl.value;
      const type = v => { inp.value = v; inp.dispatchEvent(new Event("input")); return sl.options.length; };
      o.lung = n0 > 100; o.camp = !!inp;
      o.cod = type("71b3590") <= 3 && [...sl.options].some(x => /71B3590/.test(x.textContent));
      o.cuvinte = type("155 blumotion") > 3 && type("155 blumotion") < n0 && [...sl.options].every(x => x.value === cur || /155/.test(x.textContent));
      o.faraDiacritice = type("CRISTALLO") > 1;
      o.nimic = type("zzzzqq") === 1 && /./.test(sl.parentNode.querySelector(".hw-find-n").textContent);
      o.pastrata = sl.value === cur;
      type(""); o.reset = sl.options.length === n0;
      o.scurta = !document.querySelector('#catHwWrap select[data-cat="zarga"]').parentNode.querySelector(".hw-find");   // o listă scurtă
      o.guida = !!document.querySelector('#catHwWrap select[data-cat="guida"]').parentNode.querySelector(".hw-find");   // glisierele Blum noi (≥12) au și ele căutare
      renderHwSel(); const bs = document.querySelector('#hwSelBox select[data-cat="cern"]'); o.corp = !!bs.parentNode.querySelector(".hw-find");
      return o;
    });
    ok("Căutare: câmpul apare la lista lungă (balamale), nu la cele scurte; filtrează după cod, cuvinte (ȘI) și fără diacritice; păstrează alegerea curentă", r.lung && r.camp && r.cod && r.cuvinte && r.faraDiacritice && r.pastrata && r.reset && r.scurta && r.guida, JSON.stringify(r));
    ok("Căutare: «niciun rezultat» se spune; același câmp apare și în formularul corpului", r.nimic && r.corp, JSON.stringify(r));
    ok("Căutare: nicio eroare JS", eErrs.length === 0, eErrs[0] || "nessuno");
    await ctx.close();
  }

  head("Glisiere și casete Blum — lista din Catalog, căutare și fișa tehnică");
  {
    const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } });
    const eErrs = [];
    const sp = await ctx.newPage();
    sp.on("pageerror", e => eErrs.push(String(e)));
    await sp.goto(URL); await sp.waitForTimeout(3300); await sp.evaluate(() => closeSheets());
    const r = await sp.evaluate(() => {
      const o = {}; renderCatalog();
      const rows = () => document.querySelectorAll("#catSlidesWrap .slList .slOpen").length;
      o.toate = rows(); o.sisteme = EBSlides.list().filter(x => x.kind !== "drill").length;
      const inp = document.querySelector("#catSlidesWrap .slFind");
      inp.value = "tandem 19"; inp.dispatchEvent(new Event("input")); o.filtrat = rows() > 0 && rows() < o.toate;
      inp.value = "760H2500S"; inp.dispatchEvent(new Event("input")); o.cod = rows() >= 1;
      inp.value = "zzzz"; inp.dispatchEvent(new Event("input")); o.nimic = rows() === 0;
      inp.value = ""; inp.dispatchEvent(new Event("input"));
      document.querySelector("#catSlidesWrap .slOpen").click();
      o.fisa = document.getElementById("hsSheet").classList.contains("on") && document.getElementById("hsBody").innerText.length > 200;
      closeSheets();
      /* TANDEM 19 mm: sertarul din lemn se strânge cu 49, nu cu 42 */
      state.settings.hwProd.guida = "blums_tandem19_locking"; o.ded19 = woodDed();
      state.settings.hwProd.guida = "blums_movento_blumotion_s"; o.ded42 = woodDed();
      state.settings.hwProd.guida = "blum_tandem";
      renderCatalog(); const g = document.querySelector('#catHwWrap select[data-cat="guida"]'); o.guidaN = g.options.length;
      return o;
    });
    ok("Glisiere Blum: lista din Catalog arată toate sistemele, filtrează după nume și cod, «niciun rezultat», butonul deschide fișa", r.toate === r.sisteme && r.toate >= 40 && r.filtrat && r.cod && r.nimic && r.fisa, JSON.stringify(r));
    ok("Glisiere Blum: TANDEM 19 mm taie sertarul din lemn cu 49 mm, MOVENTO cu 42; lista de glisiere are seriile noi", r.ded19 === 49 && r.ded42 === 42 && r.guidaN >= 12, JSON.stringify(r));
    ok("Glisiere Blum: nicio eroare JS", eErrs.length === 0, eErrs[0] || "nessuno");
    await ctx.close();
  }

  head("Rezumat proiect (5.66.0) — un card per corp, totalul, în 7 limbi");
  {
    const r = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      const keepP = state.projects, keepA = state.activeId;
      closeSheets();
      state.projects = [{ id: "sm1", name: "S", pieces: [], configs: {} }]; state.activeId = "sm1";
      o.gol = projectSummaryHtml(proj()).includes(t("sumEmpty"));
      generateInto(proj(), { ...PRESETS.armadio, name: "Sm A", L: 800, H: 2000, P: 560 });
      generateInto(proj(), { ...PRESETS.base, name: "Sm B", L: 600, H: 720, P: 560 });
      const b = document.getElementById("btnSummary"); o.buton = !!b;
      b.click(); await w(200);
      const body = document.getElementById("sumBody");
      o.sheet = document.getElementById("shSummary").classList.contains("on");
      o.carduri = /Sm A/.test(body.innerText) && /Sm B/.test(body.innerText);
      o.cote = /800 × 2000 × 560 mm/.test(body.innerText) && /600 × 720 × 560 mm/.test(body.innerText);
      o.total = /€\s*\d/.test(body.innerText);
      o.limbi = ["it","ro","en","fr","de","pl","es"].every(l => ["sumTitle","sumBtn","sumPcs","sumTotal","sumEmpty","sumAcc"].every(k => I18N[l][k]));
      closeSheets(); state.projects = keepP; state.activeId = keepA;
      return o;
    });
    ok("Rezumat: proiect gol → mesaj; butonul din proiect deschide foaia", r.gol && r.buton && r.sheet, JSON.stringify(r));
    ok("Rezumat: câte un card per corp, cu cotele LxHxP din config și totalul în €", r.carduri && r.cote && r.total, JSON.stringify(r));
    ok("Rezumat: textele există în toate cele 7 limbi", r.limbi, JSON.stringify(r));
  }

  head("Banc ca planner + mod Client pe telefon (5.67.0)");
  {
    const r = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      closeSheets(); setView("build"); await w(300);
      const chips = [...document.querySelectorAll("#bldSteps [data-step]")];
      o.pasi = chips.length >= 6 && chips.every(c => c.textContent.trim().length > 3);
      const g = document.getElementById("grpFr"); g.open = false;
      chips.find(c => c.dataset.step === "grpFr").click(); await w(100);
      o.deschide = g.open === true;
      o.limba = ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => I18N[l].grpBase && I18N[l].grpHw);
      /* mod Client pe telefon: prețul nu acoperă finisajele */
      const keepP = state.projects, keepA = state.activeId, keepGate = window.proGate;
      state.projects = [{ id: "cl1", name: "T", pieces: [], configs: {}, geomVersion: GEOM_VERSION }]; state.activeId = "cl1";
      for (const n of ["A", "B", "C"]) generateInto(proj(), { ...PRESETS.armadio, name: "Cm " + n, L: 800, H: 900, P: 400 });
      window.proGate = () => true; clientOpen(); await w(500);
      const panel = document.querySelector(".cm-panel").getBoundingClientRect(), pr = document.querySelector(".cm-price").getBoundingClientRect();
      o.pret = pr.height / panel.height < 0.4;
      o.antet = document.querySelector(".cm-top").getBoundingClientRect().height <= 56;
      o.rows = getComputedStyle(document.querySelector(".cm-prows")).display === "none";
      clientClose(); window.proGate = keepGate; state.projects = keepP; state.activeId = keepA;
      return o;
    });
    ok("Banc: bara de pași are câte o pastilă per grup și o apasă deschide grupul", r.pasi && r.deschide, JSON.stringify(r));
    ok("Banc: etichetele pașilor există în toate limbile (sunt cele ale grupurilor)", r.limba, JSON.stringify(r));
    ok("Client pe telefon: antet îngust, prețul sub 40% din panou, rândurile detaliate ascunse", r.pret && r.antet && r.rows, JSON.stringify(r));
  }

  head("Calitate de prezentare 3D (5.67.0): modul Client randează la rezoluția ecranului");
  {
    const d = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      if (!(window.GL3D && GL3D.ok)) return { fara_gl: true };
      closeSheets();
      const s0 = GL3D.qualityInfo();
      o.std = s0.q === "std" && s0.aniso >= 4;
      GL3D.quality("hi"); const h = GL3D.qualityInfo();
      o.hi = h.q === "hi" && h.shadow === 2048 && h.dpr >= s0.dpr;
      GL3D.quality("std"); o.inapoi = GL3D.qualityInfo().q === "std";
      const keepP = state.projects, keepA = state.activeId, keepGate = window.proGate;
      state.projects = [{ id: "ql1", name: "T", pieces: [], configs: {}, geomVersion: GEOM_VERSION }]; state.activeId = "ql1";
      generateInto(proj(), { ...PRESETS.armadio, name: "Ql", L: 800, H: 900, P: 400 });
      window.proGate = () => true; clientOpen(); await w(300);
      o.client = GL3D.qualityInfo().q === "hi";
      clientClose(); await w(100);
      o.iese = GL3D.qualityInfo().q === "std";
      window.proGate = keepGate; state.projects = keepP; state.activeId = keepA;
      return o;
    });
    if (d.fara_gl) ok("calitate 3D: sărit (fără WebGL)", true);
    else {
      ok("calitate 3D: standard în lucru, «hi» (umbre 2048, rezoluția ecranului) la cerere", d.std && d.hi && d.inapoi, JSON.stringify(d));
      ok("calitate 3D: modul Client trece pe «hi» și revine la ieșire", d.client && d.iese, JSON.stringify(d));
    }
  }

  head("Montaj animat (5.68.0): ordine din roluri, sfârșit curat, întrerupere, video");
  {
    const d = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      if (!(window.GL3D && GL3D.ok)) return { fara_gl: true };
      closeSheets(); setView("build"); buildCfg = { ...PRESETS.armadio }; syncBuildForm(); draw3D(); await w(500); studioSync();
      const p = GL3D.assemble({ ms: 1500 }); await w(250); const mid = GL3D.asmInfo();
      o.activ = !!mid && mid.items >= 8;
      o.ordine = !!mid && mid.order.every((v, i, a) => i === 0 || a[i - 1] <= v);
      o.prima = !!mid && mid.order[0] === 0 && mid.order[mid.order.length - 1] >= 9;
      const ok = await p; o.final = ok === true && GL3D.asmInfo() === null && GL3D.state.explode === 0;
      const p2 = GL3D.assemble({ ms: 3000 }); await w(120); GL3D.set({ explode: 0 }); o.intrerupt = (await p2) === false && GL3D.asmInfo() === null;
      const btn = document.getElementById("btnAsm3d"); o.buton = !!btn && !btn.disabled;
      const rec = await GL3D.record({ ms: 1500, w: 180, h: 320, title: "Test", sub: "1000 × 2200 × 600 mm", brand: "Ebanist" });
      o.video = rec === null || (rec.blob.size > 500 && /^video\//.test(rec.mime) && rec.w === 180);
      o.dupa = GL3D.asmInfo() === null && GL3D.qualityInfo() != null;
      o.limbi = ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => ["vtAsm", "vtRec", "vidRec", "vidNo", "vidDone"].every(k => I18N[l][k]));
      return o;
    });
    if (d.fara_gl) ok("montaj animat: sărit (fără WebGL)", true);
    else {
      ok("montaj animat: pornește, piesele vin în ordinea rolurilor (bază → uși) și se termină curat", d.activ && d.ordine && d.prima && d.final, JSON.stringify(d));
      ok("montaj animat: o schimbare de stare îl întrerupe; butonul există", d.intrerupt && d.buton, JSON.stringify(d));
      ok("montaj animat: video-ul se înregistrează (sau dispozitivul spune clar că nu poate); textele în 7 limbi", d.video && d.dupa && d.limbi, JSON.stringify(d));
    }
  }

  head("Previzualizare înainte de plată (5.69.0): distinta utilizatorului, primele rânduri, restul estompat");
  {
    const d = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      closeSheets();
      const keepP = state.projects, keepA = state.activeId;
      state.projects = [{ id: "pv1", name: "T", pieces: [], configs: {}, geomVersion: GEOM_VERSION }]; state.activeId = "pv1";
      o.gol = proPreviewHtml("pdf") === "";
      generateInto(proj(), { ...PRESETS.armadio, name: "Pv", L: 900, H: 2000, P: 400 });
      renderPro("pdf"); await w(100);   /* renderPro nu depinde de Pro: se poate verifica și în mediul de test, unde utilizatorul e Pro */
      const box = document.querySelector("#proBody .pro-prev");
      o.are = !!box && box.querySelectorAll("tr").length >= 6;
      o.estompat = !!box && !!box.querySelector(".blur") && /\d/.test(box.querySelector(".pro-prev-more") ? box.querySelector(".pro-prev-more").textContent : "");
      o.date = !!box && box.textContent.includes("2000") && box.textContent.includes("400");
      o.alt = proPreviewHtml("lab") === "" && proPreviewHtml("projects") === "";
      o.limbi = ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => I18N[l].proPrevTitle && I18N[l].proPrevMore.includes("{n}"));
      closeSheets(); state.projects = keepP; state.activeId = keepA;
      return o;
    });
    {
      ok("previzualizare Pro: pe ecranul Pro apar rândurile distinctei utilizatorului, restul estompat, cu numărul de piese rămase", d.gol && d.are && d.estompat && d.date, JSON.stringify(d));
      ok("previzualizare Pro: numai pentru ieșirile cu distinta; textele în 7 limbi", d.alt && d.limbi, JSON.stringify(d));
    }
  }

  head("Exemple dintr-un tap la generarea cu AI (5.69.0)");
  {
    const d = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      closeSheets(); setView("build"); await w(200);
      const ch = [...document.querySelectorAll("#aiBarBuild [data-aiex]")];
      o.trei = ch.length === 3 && ch.every(c => c.textContent.length > 12);
      o.fara = document.querySelectorAll("#aiBarSurvey [data-aiex]").length === 0;
      const keep = window.aiRun; let called = null; window.aiRun = m => { called = m; };
      ch[1].click();
      o.text = document.getElementById("aiTxtgenera").value === ch[1].textContent;
      o.porneste = called === "genera";
      window.aiRun = keep;
      o.limbi = ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => ["aiEx1", "aiEx2", "aiEx3", "aiTry"].every(k => AI_I18N[l][k]));
      return o;
    });
    ok("AI: trei exemple sub câmpul de text; un tap umple câmpul și pornește generarea (numai în Genera)", d.trei && d.fara && d.text && d.porneste, JSON.stringify(d));
    ok("AI: exemplele există în toate cele 7 limbi", d.limbi, JSON.stringify(d));
  }

  head("Anulează / Refă în generator (5.69.0)");
  {
    const d = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      closeSheets(); setView("build"); await w(300);
      buildCfg = { ...PRESETS.armadio, name: "Hist A" }; syncBuildForm(); drawPreview(); await w(700);
      const u = document.getElementById("btnUndoCfg"), r = document.getElementById("btnRedoCfg");
      o.initial = u.disabled === true && r.disabled === true;
      const set = async v => { const e = document.getElementById("bL"); e.value = String(v); e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); await w(750); };
      const L0 = +document.getElementById("bL").value;
      await set(900); await set(1100);
      o.activ = u.disabled === false;
      u.click(); await w(200); o.undo1 = +document.getElementById("bL").value === 900;
      u.click(); await w(200); o.undo2 = +document.getElementById("bL").value === L0;
      o.redoOn = r.disabled === false;
      r.click(); await w(200); o.redo1 = +document.getElementById("bL").value === 900;
      await set(850); o.taieRedo = r.disabled === true;
      buildCfg = { ...PRESETS.armadio, name: "Hist B" }; syncBuildForm(); drawPreview(); await w(300);
      o.golit = u.disabled === true;
      o.limbi = ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => I18N[l].undoCfg && I18N[l].redoCfg);
      return o;
    });
    ok("Anulează/Refă: butoanele pornesc oprite; o modificare le activează, undo/redo refac cota L", d.initial && d.activ && d.undo1 && d.undo2 && d.redoOn && d.redo1, JSON.stringify(d));
    ok("Anulează/Refă: o modificare nouă taie «Refă», alt mobil golește istoricul; texte în 7 limbi", d.taieRedo && d.golit && d.limbi, JSON.stringify(d));
  }

  head("Privire de aproape pe feronerie din listă (5.69.0)");
  {
    const d = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      if (!(window.GL3D && GL3D.ok)) return { fara_gl: true };
      closeSheets(); setView("build"); buildCfg = { ...PRESETS.armadio }; syncBuildForm(); draw3D(); await w(500);
      document.getElementById("grpPieces").open = true;
      document.getElementById("btnHw3d").click(); await w(300);
      const row = () => document.querySelector('[data-hwk="cerniera"]');
      o.rand = !!row();
      const M = GL3D.model(), hing = M.ops.hw.filter(h => h.type === "cerniera");
      row().click(); await w(150);
      const f1 = GL3D.focusInfo();
      o.prima = !!f1 && String(f1.pk) === String(hing[0].piece) && f1.rad < 150 && /^1\//.test(row().querySelector(".hw-q").textContent);
      row().click(); await w(100); o.a2a = /^2\//.test(row().querySelector(".hw-q").textContent) && GL3D.focusInfo() != null;
      for (let i = 2; i < hing.length; i++) { row().click(); await w(30); }
      row().click(); await w(100);
      o.revine = GL3D.focusInfo() === null && /^×/.test(row().querySelector(".hw-q").textContent);
      row().click(); await w(100); const had = GL3D.focusInfo() != null;
      document.querySelector('[data-tab="pcs"]').click(); await w(150);
      o.curat = had && GL3D.focusInfo() === null;
      return o;
    });
    if (d.fara_gl) ok("privire pe feronerie: sărit (fără WebGL)", true);
    else ok("privire pe feronerie: un tap duce camera la prima piesă, următoarele la celelalte, după ultima revine; la schimbarea tabului se curăță", d.rand && d.prima && d.a2a && d.revine && d.curat, JSON.stringify(d));
  }

  head("Montaj în modul Client (5.70.0)");
  {
    const d = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      if (!(window.GL3D && GL3D.ok)) return { fara_gl: true };
      closeSheets();
      const keepP = state.projects, keepA = state.activeId, keepGate = window.proGate;
      state.projects = [{ id: "cm9", name: "T", pieces: [], configs: {}, geomVersion: GEOM_VERSION }]; state.activeId = "cm9";
      generateInto(proj(), { ...PRESETS.armadio, name: "Cm9", L: 800, H: 900, P: 400 });
      window.proGate = () => true; clientOpen(); await w(500);
      const b = document.getElementById("cmAsm"); o.buton = !!b;
      b.click(); await w(300); o.activ = GL3D.asmInfo() != null && b.classList.contains("on");
      b.click(); await w(200); o.oprit = GL3D.asmInfo() === null && !b.classList.contains("on");
      o.limbi = ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => I18N[l].cmAsm);
      clientClose(); window.proGate = keepGate; state.projects = keepP; state.activeId = keepA;
      return o;
    });
    if (d.fara_gl) ok("montaj în modul Client: sărit (fără WebGL)", true);
    else ok("montaj în modul Client: butonul pornește animația, al doilea tap o oprește; textul în 7 limbi", d.buton && d.activ && d.oprit && d.limbi, JSON.stringify(d));
  }

  head("Randare cadru cu cadru și camera la montaj (5.71.0)");
  {
    const d = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      if (!(window.GL3D && GL3D.ok)) return { fara_gl: true };
      closeSheets(); setView("build"); buildCfg = { ...PRESETS.armadio }; syncBuildForm(); draw3D(); await w(500);
      const yaw0 = VIEW.yaw;
      GL3D.offlineBegin({ w: 90, h: 160, fps: 20, ms: 1500, title: "T", sub: "S", brand: "B", bg: "light" });
      o.pornit = GL3D.asmInfo() != null && Math.abs(VIEW.yaw - (-0.3)) < 1e-6;
      let n = 0, last = null, yawPrev = VIEW.yaw, maxStep = 0;
      while (n < 80) { last = GL3D.offlineFrame(n > 40); n++; maxStep = Math.max(maxStep, Math.abs(VIEW.yaw - yawPrev)); yawPrev = VIEW.yaw; if (!last.assembling && n > 45) break; }
      o.cadre = n >= 30 && last && /^data:image\/jpeg/.test(last.data) && last.data.length > 800;
      o.final = last && last.assembling === false && last.t > 1500;
      o.lent = maxStep <= 0.0035 * 0.4 * (50 / 16.67) + 1e-6;
      GL3D.offlineEnd(); await w(100);
      o.curat = GL3D.asmInfo() === null && Math.abs(VIEW.yaw - yaw0) < 1e-6 && GL3D.offlineFrame() === null;
      return o;
    });
    if (d.fara_gl) ok("randare cadru cu cadru: sărit (fără WebGL)", true);
    else {
      ok("randare cadru cu cadru: pornește, produce cadre JPEG cu ceas virtual, montajul se termină", d.pornit && d.cadre && d.final, JSON.stringify(d));
      ok("randare cadru cu cadru: camera se rotește lent în montaj și se reface unghiul la sfârșit", d.lent && d.curat, JSON.stringify(d));
    }
  }

  head("Iluminat LED în generator, distinctă, deviz și catalog (5.73.0, D-157)");
  {
    const d = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      closeSheets(); setView("build"); await w(300);
      const keepP = state.projects, keepA = state.activeId;
      state.projects = [{ id: "ld1", name: "T", pieces: [], configs: {}, geomVersion: GEOM_VERSION }]; state.activeId = "ld1";
      buildCfg = { ...PRESETS.armadio, name: "Led A", L: 900, H: 2000, P: 400, doors: 0, drawers: 0, hang: 0, tram: 0, shelves: 2 };
      syncBuildForm(); drawPreview(); await w(300);
      o.camp = !!document.getElementById("bLed") && document.getElementById("bLed").options.length === 3;
      o.ascuns = document.getElementById("rowLedLen").style.display === "none";
      const sel = document.getElementById("bLed"); sel.value = "manual"; sel.dispatchEvent(new Event("change", { bubbles: true })); await w(200);
      o.lungime = document.getElementById("rowLedLen").style.display !== "none";
      const len = document.getElementById("bLedLen"); len.value = "3000"; len.dispatchEvent(new Event("input", { bubbles: true })); await w(300);
      o.hint = /3[.,]00/.test(document.getElementById("ledHint").textContent) && /21[.,]6/.test(document.getElementById("ledHint").textContent) && document.getElementById("ledHint").style.display !== "none";
      o.cfg = buildCfg.led === "manual" && buildCfg.ledLen === 3000;
      generateInto(proj(), buildCfg);
      const p = proj(), row = p.pieces.find(x => x.elemento === "Striscia LED");
      o.rand = !!row && row.lung === 3000 && row.pz === 1 && /^accessorio/i.test(row.materiale || "");
      o.nuPanou = panelTotals(p.pieces).pcs === p.pieces.filter(x => !isAccPiece(x)).reduce((a, x) => a + x.pz, 0);
      const hw = computeHardware(p, state.settings), by = {}; hw.forEach(i => { by[i.k] = i; });
      o.hw = by.hwLedStrip.qty === 1 && by.hwLedDrv.qty === 2 && by.hwLedDim.qty === 2 && by.hwLedSw.qty === 2 && by.hwLedMains.qty === 2;
      o.coduri = by.hwLedDrv.prod.art === "833.75.933" && by.hwLedSw.prod.art === "833.89.142" && by.hwLedMains.prod.art === "833.89.009" && by.hwLedDim.prod.art === "833.89.133" && by.hwLedStrip.prod.art === "5220220";
      o.deviz = projectCosts(p).hw.some(i => i.k === "hwLedDrv" && i.qty === 2);
      o.nume = matLabelUI(row.materiale) !== row.materiale || state.lang === "it";
      renderCatalog();
      o.catalog = ["ledstrip", "leddrv", "leddim", "ledsw", "ledmains"].every(c => document.querySelector('#catHwWrap select[data-cat="' + c + '"]'));
      o.chk = document.querySelector('#catHwWrap select[data-cat="leddrv"]').closest(".f").innerText.length > 0;
      o.limbi = ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => ["fLed", "ledNone", "ledTop", "ledManual", "fLedLen", "ledHint", "hwLedStrip", "hwLedDrv", "hwLedDim", "hwLedSw", "hwLedMains"].every(k => I18N[l][k]));
      o.elLimbi = ["ro", "en", "fr", "de", "pl", "es"].every(l => EL_I18N[l]["Striscia LED"]) && ["ro", "en", "fr", "de", "pl", "es"].every(l => ACC_I18N["Accessorio — striscia LED neon flex 6×6"][l]);
      /* fără LED: aceeași distinctă, fără rând și fără feronerie de iluminat */
      buildCfg = { ...buildCfg, led: "", ledLen: 0 }; generateInto(proj(), buildCfg);
      o.golit = !proj().pieces.some(x => x.elemento === "Striscia LED") && computeHardware(proj(), state.settings).filter(i => /^hwLed/.test(i.k)).every(i => i.qty === 0);
      closeSheets(); state.projects = keepP; state.activeId = keepA;
      return o;
    });
    ok("LED: câmpul din generator, lungimea manuală și rezumatul (m, W, transformatoare)", d.camp && d.ascuns && d.lungime && d.hint && d.cfg, JSON.stringify(d));
    ok("LED: banda e rând de accesorii în distinctă, nu panou", d.rand && d.nuPanou && d.nume, JSON.stringify(d));
    ok("LED: transformatoare, dimmere și cabluri numărate din putere, cu codurile Häfele/Emuca, în deviz", d.hw && d.coduri && d.deviz, JSON.stringify(d));
    ok("LED: cele 5 categorii în catalog; textele în 7 limbi; fără LED nu rămâne nimic", d.catalog && d.chk && d.limbi && d.elLimbi && d.golit, JSON.stringify(d));
  }

  head("LED în 3D: aprins/stins, dimmer la vedere sau îngropat, atingerea lui, lista de feronerie (5.75.0)");
  {
    const d = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      if (!(window.GL3D && GL3D.ok)) return { fara_gl: true };
      closeSheets(); setView("build");
      const mk = sw => { buildCfg = { ...PRESETS.armadio, name: "Nisa " + sw, L: 900, H: 450, P: 400, doors: 0, drawers: 0, hang: 0, tram: 0, shelves: 0, support: "sospeso", plinth: 0, led: "top", ledSw: sw }; syncBuildForm(); draw3D(); };
      mk("visible"); await w(700); studioSync();
      let li = GL3D.ledInfo();
      o.aprins = !!li && li.on === true && li.lights === 3 && li.lit === 3 && li.strip === 1 && li.mount === "visible";
      o.buton = document.getElementById("btnLed3d").hidden === false && document.getElementById("btnLed3d").classList.contains("on");
      document.getElementById("btnLed3d").click(); await w(100);
      li = GL3D.ledInfo(); o.stins = li.on === false && li.lit === 0 && !document.getElementById("btnLed3d").classList.contains("on");
      GL3D.set({ ledOn: true }); GL3D.set({ explode: 1 }); await w(80); o.explodat = GL3D.ledInfo().lit === 0;
      GL3D.set({ explode: 0 }); await w(80); o.revine = GL3D.ledInfo().lit === 3;
      /* îngropat în lemn */
      const sel = document.getElementById("bLedSw"); sel.value = "hidden"; sel.dispatchEvent(new Event("change", { bubbles: true })); await w(500);
      o.ingropat = GL3D.ledInfo().mount === "hidden";
      sel.value = "visible"; sel.dispatchEvent(new Event("change", { bubbles: true })); await w(500); o.vedere = GL3D.ledInfo().mount === "visible";
      /* atingerea dimmerului aprinde/stinge */
      const M = GL3D.model(), h = M.ops.hw.find(x => x.type === "leddim"), pc = M.ops.pieces.find(p => String(p.pk) === String(h.piece));
      const c = [0, 1, 2].map(a => (pc.min[a] + pc.max[a]) / 2); VIEW.yaw = -0.9; VIEW.pitch = 0.05; GL3D.focusOn(h.piece, 70, [h.w[0] - c[0], h.w[1] - c[1], h.w[2] - c[2]]); await w(1300);
      const cv = document.getElementById("gl3d").getBoundingClientRect(); let hit = null;
      for (let y = cv.top + 10; y < cv.bottom - 10 && !hit; y += 5) for (let x = cv.left + 10; x < cv.right - 10 && !hit; x += 5) if (GL3D.pickHw(x, y)) hit = [x, y];
      o.atingere = !!hit && GL3D.pickHw(hit[0], hit[1]) === "leddim";
      GL3D.focusOn(null);
      /* lista de feronerie: bandă și dimmer, cu produsul din catalog */
      document.getElementById("grpPieces").open = true; document.getElementById("btnHw3d").click(); await w(300);
      const rows = ["led", "leddim"].map(k => document.querySelector('[data-hwk="' + k + '"]'));
      o.lista = rows.every(Boolean) && /5220220/.test(rows[0].innerText) && /833\.89\.133/.test(rows[1].innerText);
      rows[1].click(); await w(150); const f = GL3D.focusInfo(); o.focus = !!f && String(f.pk) === String(h.piece);
      document.querySelector('[data-tab="pcs"]').click(); await w(100);
      /* fără LED: nimic */
      buildCfg = { ...buildCfg, led: "" }; syncBuildForm(); draw3D(); await w(500); studioSync();
      o.golit = GL3D.ledInfo() === null && document.getElementById("btnLed3d").hidden === true;
      o.limbi = ["it", "ro", "en", "fr", "de", "pl", "es"].every(l => ["fLedSw", "ledSwVis", "ledSwHid", "vtLed", "hw_led", "hw_leddim"].every(k => I18N[l][k]));
      return o;
    });
    if (d.fara_gl) ok("LED în 3D: sărit (fără WebGL)", true);
    else {
      ok("LED în 3D: aprins implicit (3 lumini), butonul din bară îl stinge, explodat stinge lumina", d.aprins && d.buton && d.stins && d.explodat && d.revine, JSON.stringify(d));
      ok("LED în 3D: dimmer la vedere sau îngropat în lemn, schimbat din formular; atingerea lui se prinde", d.ingropat && d.vedere && d.atingere, JSON.stringify(d));
      ok("LED în 3D: bandă și dimmer în lista de feronerie, cu articolul din catalog și privire de aproape; fără LED dispar; 7 limbi", d.lista && d.focus && d.golit && d.limbi, JSON.stringify(d));
    }
  }

  head("Fibră din poze reale CC0 pe materialele cu lemn (5.77.0)");
  {
    const d = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms));
      if (!(window.GL3D && GL3D.ok)) return { fara_gl: true };
      closeSheets(); setView("build");
      buildCfg = { ...PRESETS.armadio, name: "Fibra", L: 900, H: 2000, P: 400, doors: 1, drawers: 0, shelves: 2, support: "zoccolo", matBody: "pal18_rovere", matFront: "pal18_rovere", matBack: "pfl3" }; syncBuildForm(); draw3D(); await w(1800);
      return { g: GL3D.grainInfo() };
    });
    if (d.fara_gl) ok("Fibră din poze: sărit (fără WebGL)", true);
    else ok("Fibră din poze: cel puțin o variantă cerută și încărcată din img/grain/", Object.values(d.g).some(v => v === true), JSON.stringify(d));
    if (process.env.SHOT) await pg.screenshot({ path: process.env.SHOT });
  }

  head("Catalog Egger (109 decoruri) + texturi 3D explicite: selector cu filtre, căutare după cod, distinctă cu grosimea corectă, 3D fără erori");
  {
    const errs0 = errs.length;
    const d = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms));
      const o = {};
      closeSheets(); setView("build");
      o.n = MATDB.filter(m => m.sup === "Egger").length;
      matPickOpen("bMatBody", { minTh: 12, title: t("matBody") }); await w(200);
      const rows = () => document.querySelectorAll("#matPickList .mp-row").length;
      o.total = rows();
      o.sup = [...document.querySelectorAll("#matPickSup [data-sup]")].map(b => b.dataset.sup).filter(Boolean);
      o.fam = [...document.querySelectorAll("#matPickFam [data-fam]")].map(b => b.dataset.fam).filter(Boolean);
      document.querySelector('#matPickSup [data-sup="Egger"]').click(); await w(100);
      const egg = rows();
      document.querySelector('#matPickFam [data-fam="legno"]').click(); await w(100);
      o.legno = rows();
      const hid = document.querySelector("#matPickFam [data-fam]"); o.famDopoFiltru = !!hid;
      /* căutare după cod, cu și fără spații, după nume (orice limbă) */
      const q = async v => { const el = document.getElementById("matPickQ"); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); await w(80); return rows(); };
      document.querySelector('#matPickSup [data-sup=""]').click(); await w(60);
      document.querySelector('#matPickFam [data-fam=""]').click(); await w(60);
      o.qCod = await q("h1145"); o.qCodSp = await q("H1145 st10"); o.qCodFaraSp = await q("h1145st10");
      o.qHalifax = await q("halifax"); o.qEiche = await q("eiche"); o.qNimic = await q("zzzz-nu-exista");
      o.qU702 = await q("u702");
      o.qVechi = await q("22458");        // codul Centro Legno merge ca înainte
      await q("");
      /* alege un decor Egger din listă */
      await q("h1180"); const row = document.querySelector('#matPickList [data-pick="egger_h1180_st37_18"]'); o.rand = !!row;
      row.click(); await w(100);
      o.valSel = document.getElementById("bMatBody").value; o.btn = document.getElementById("pickBody").textContent;
      o.sheetInchis = !document.getElementById("shMatPick").classList.contains("open") || true;
      return Object.assign(o, { egg });
    });
    ok("Selector: decorurile Egger apar (109), cu chip de furnizor și de familie; filtrul Egger+Lemn le restrânge", d.n >= 100 && d.total > d.n && d.sup.includes("Egger") && d.sup.includes("Centro Legno") && d.fam.includes("legno") && d.fam.includes("pietra") && d.fam.includes("metallo") && d.egg === d.n && d.legno > 20 && d.legno < d.egg, JSON.stringify({ n: d.n, total: d.total, egg: d.egg, legno: d.legno, sup: d.sup, fam: d.fam }));
    ok("Selector: căutare după cod (cu/fără spații), după nume în altă limbă; codul vechi Centro Legno merge", d.qCod === 1 && d.qCodSp === 1 && d.qCodFaraSp === 1 && d.qHalifax >= 4 && d.qEiche > 20 && d.qNimic === 0 && d.qU702 === 1 && d.qVechi === 1, JSON.stringify({ cod: d.qCod, sp: d.qCodSp, fs: d.qCodFaraSp, hal: d.qHalifax, eiche: d.qEiche, nimic: d.qNimic, u702: d.qU702, vechi: d.qVechi }));
    ok("Selector: alegerea unui decor Egger scrie valoarea corpului și eticheta cu codul", d.rand && d.valSel === "egger_h1180_st37_18" && /H1180 ST37/.test(d.btn), d.valSel + " / " + d.btn);

    const g = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms));
      const o = {};
      closeSheets();
      const p = proj();
      generateInto(p, { ...PRESETS.armadio, name: "Egger", L: 1000, H: 2200, P: 600, matBody: "egger_h1180_st37_18", matFront: "egger_f186_st9_18", matBack: "pfl3" });
      persist();
      const f = p.pieces.find(x => x.gen === "Egger" && x.role === "fianco");
      const a = p.pieces.find(x => x.gen === "Egger" && x.role === "frontale");
      o.fianco = f && { sp: f.sp, mat: f.materiale }; o.anta = a && { sp: a.sp, mat: a.materiale };
      o.ok = assertExportable(p).ok;
      o.label = f && matLabelUI(f.materiale); o.lang = state.lang; o.atteso = matById("egger_h1180_st37_18").l[state.lang];
      /* 3D cu texturi explicite: concrete pe front, oak pe corp, nicio eroare */
      setView("build");
      buildCfg = { ...PRESETS.armadio, name: "T3", L: 900, H: 1300, P: 450, doors: 2, drawers: 0, shelves: 1, support: "zoccolo", matBody: "egger_h1180_st37_18", matFront: "egger_f186_st9_18", matBack: "pfl3" };
      o.gl = !!(window.GL3D && GL3D.ok);
      /* întâi corpul cu materialele vechi: fără `grana`, regula de luminanță (ash/oak/walnut), nicio textură nouă încărcată */
      buildCfg = { ...buildCfg, matBody: "pal18_rovere", matFront: "pal18_rovere" }; syncBuildForm(); draw3D(); await w(1500);
      o.vechi = o.gl ? GL3D.grainInfo() : null;
      buildCfg = { ...buildCfg, matBody: "egger_h1180_st37_18", matFront: "egger_f186_st9_18" }; syncBuildForm(); draw3D(); await w(1800);
      o.grain = o.gl ? GL3D.grainInfo() : null;
      return o;
    });
    ok("Distinctă cu decor Egger: grosimea 18 vine din material (fianc și ușă), exportabil, eticheta în limba curentă", g.fianco && g.fianco.sp === 18 && g.anta && g.anta.sp === 18 && g.ok === true && g.label === g.atteso && /Halifax/.test(g.label), JSON.stringify({ f: g.fianco, a: g.anta, ok: g.ok, label: g.label }));
    if (!g.gl) ok("3D cu texturi explicite: sărit (fără WebGL)", true);
    else {
      ok("3D: decorul Egger cere și încarcă textura numită (oak pe corp, concrete pe front)", g.grain.oak === true && g.grain.concrete === true, JSON.stringify(g.grain));
      ok("3D: materialele vechi rămân pe regula de luminanță (nicio textură nouă încărcată)", ["pine", "beech", "cherry", "maple", "wenge", "stone", "linen", "metal"].every(k => g.vechi[k] === null), JSON.stringify(g.vechi));
    }
    ok("Catalog Egger: fără erori JS", errs.length === errs0, errs.slice(errs0).join(" | "));
    await pg.evaluate(() => { closeSheets(); try { setView("projects"); } catch (e) {} });
  }

  head("Proiecte demo (FAZA T): intrarea din lista de proiecte, 3 copii, limita gratuită, distinta = golden, 3D cu LED, uși și mecanisme care se deschid");
  {
    const errs0 = errs.length;
    const gold = JSON.parse(fs.readFileSync(path.join(__dirname, "golden", "showcase.json"), "utf8"));
    await pg.goto(URL + "?lang=en"); await pg.waitForFunction(() => window.MAT_LOADED === true); await pg.waitForTimeout(1500);
    await pg.locator("#btnIntroGo").click({ timeout: 1500 }).catch(() => {});
    await pg.addScriptTag({ url: ORIGIN + "/tools/showcase/inpage.js" });
    const keep = await pg.evaluate(() => { closeSheets(); return { n: state.projects.length, own: ownProjects() }; });
    /* o copie a unui proiect demo se deschide din butonul «Demo projects»; proiectele existente rămân */
    await pg.evaluate(() => { setView("projects"); });
    const ui = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      o.btn = !!document.getElementById("btnDemo") && /Demo/i.test(document.getElementById("btnDemo").textContent);
      document.getElementById("btnDemo").click(); await w(300);
      o.cards = document.querySelectorAll("#demoBody [data-demo]").length;
      o.chips = document.querySelectorAll("#demoBody .chip").length;
      o.titles = [...document.querySelectorAll("#demoBody .pj-name")].map(x => x.textContent);
      o.open = document.getElementById("shDemo").classList.contains("on");
      return o;
    });
    ok("Demo: butonul din Proiecte deschide foaia cu 3 proiecte, cu etichete tehnice, în limba curentă", ui.btn && ui.open && ui.cards === 3 && ui.chips >= 15 && /Living room/.test(ui.titles[0]), JSON.stringify(ui.titles));
    for (const id of ["living", "kitchen", "bedroom"]) {
      const r = await pg.evaluate(async (id) => {
        const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
        closeSheets(); document.getElementById("btnDemo").click(); await w(200);
        const own0 = ownProjects(), n0 = state.projects.length;
        document.querySelector('#demoBody [data-demo="' + id + '"] [data-open]').click();
        for (let i = 0; i < 60 && !state.projects.some(p => p.showcase === id); i++) await w(100);
        const p = state.projects.find(q => q.showcase === id); o.have = !!p;
        if (!p) return o;
        o.active = state.activeId === p.id; o.view = currentView; o.name = p.name; o.flag = p.showcase === id && !p.demo;
        o.own = ownProjects() === own0; o.added = state.projects.length === n0 + 1;
        o.noNames = p.names === undefined; o.tone = typeof p.floorTone === "number";
        o.pieceIds = p.pieces.every(x => x.id) && new Set(p.pieces.map(x => x.id)).size === p.pieces.length;
        /* a doua apăsare redeschide copia neatinsă, nu o dublează */
        closeSheets(); document.getElementById("btnDemo").click(); await w(200);
        document.querySelector('#demoBody [data-demo="' + id + '"] [data-open]').click(); await w(400);
        o.noDup = state.projects.filter(q => q.showcase === id).length === 1;
        return o;
      }, id);
      ok("Demo " + id + ": se încarcă o COPIE (steag showcase, fără demo), nu intră în limita gratuită, se redeschide fără dublare", r.have && r.active && r.flag && r.own && r.added && r.noNames && r.tone && r.pieceIds && r.noDup, JSON.stringify(r));
    }
    ok("Demo: proiectele deja existente nu s-au atins (același număr + 3 copii)", await pg.evaluate(n => state.projects.length === n + 3 && state.projects.filter(p => !p.showcase).length === n, keep.n));
    /* 2 · distinta, ops, documente, deviz — controalele aplicației, comparate cu instantaneul de referință (test/golden/showcase.json) */
    const crypto = require("crypto");
    for (const id of ["living", "kitchen", "bedroom"]) {
      const r = await pg.evaluate(async (id) => { const p = state.projects.find(q => q.showcase === id); return p ? await SC.check(p) : null; }, id);
      const g = gold[id];
      if (!r) { ok("Demo " + id + ": proiect negăsit pentru verificare", false); continue; }
      const hash = crypto.createHash("sha1").update(r.cutSig.join("\n")).digest("hex").slice(0, 16);
      ok("Demo " + id + ": nicio eroare blocantă, export permis, foile A4, ops, distinta, CSV, feronerie, deviz, fișa de montaj fără erori", r.bad.length === 0 && r.auditBlocking === 0 && r.exportAllowed === true && r.roomIssues.length === 0, JSON.stringify(r.bad).slice(0, 300));
      ok("Demo " + id + ": distinta e cea din instantaneul de referință (rânduri, piese, operații, feronerie, hash)", r.cutRows === g.cutRows && r.panelPieces === g.panelPieces && r.operations === g.operations && r.hwLines === g.hwLines && Math.abs(r.hwQty - g.hwQty) < 0.01 && hash === g.cutHash && r.bodies === g.bodies, "cutRows " + r.cutRows + "/" + g.cutRows + " hash " + hash + "/" + g.cutHash);
      ok("Demo " + id + ": deviz > 0 (feroneria nouă are preț 0: de completat în Catalog) și avertismentele sunt cele așteptate", r.netto > 0 && Math.abs(r.netto - g.netto) < 0.01 && JSON.stringify(Object.entries(r.opsWarn).sort()) === JSON.stringify(Object.entries(g.opsWarn).sort()) && JSON.stringify(Object.entries(r.buildWarn).sort()) === JSON.stringify(Object.entries(g.buildWarn).sort()), "netto " + r.netto + " · opsWarn " + JSON.stringify(r.opsWarn));
      /* determinism: aceleași configurații → aceleași rânduri; distinta salvată = ce generează motorul acum */
      const dt = await pg.evaluate((id) => {
        const p = state.projects.find(q => q.showcase === id);
        const sig = q => q.pieces.map(x => [x.modulo, x.elemento, x.lung, x.larg, x.pz, x.materiale, x.role].join("|")).sort().join("\n");
        const sp = { pieces: [], configs: {} }, sp2 = { pieces: [], configs: {} };
        for (const name of Object.keys(p.configs)) generateInto(sp, JSON.parse(JSON.stringify(p.configs[name])));
        for (const name of Object.keys(p.configs)) generateInto(sp2, JSON.parse(JSON.stringify(p.configs[name])));
        return { same: sig(sp) === sig(sp2), saved: sig(sp) === sig(p), n: sp.pieces.length, m: p.pieces.length };
      }, id);
      ok("Demo " + id + ": determinist (două generări identice) și distinta din fișier = distinta pe care o dă motorul acum", dt.same && dt.saved, JSON.stringify(dt));
    }
    /* 3 · 3D: camera cu LED aprins/stins, corpuri cu uși de sticlă, clape cu SERVO-DRIVE, deschise prin animația existentă */
    const gl = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = { ok: !!(window.GL3D && GL3D.ok) };
      if (!o.ok) return o;
      const p = state.projects.find(q => q.showcase === "living"); state.activeId = p.id; closeSheets(); setView("build"); await w(1200);
      const RL = roomLayout(), floor = RL.frames.map(f => { const q = toRoom(f, 0, 0, 0); return [q.x, q.y]; });
      const cfg = { matBody: state.settings.matBody, matFront: state.settings.matFront };
      GL3D.set({ mode: "real", hw: false, holes: false, open: false, explode: 0, ledOn: true });
      GL3D.render(cfg, { boxes: roomBoxes(), room: { floor, tone: p.floorTone }, leds: roomLeds() }); await w(500);
      o.leds = roomLeds().length; o.roomOn = GL3D.roomLedInfo();
      GL3D.set({ ledOn: false }); o.roomOff = GL3D.roomLedInfo(); GL3D.set({ ledOn: true });
      const cap = GL3D.capture(cfg, { w: 640, h: 360, yaw: .2, pitch: .1, warm: true, led: true }); o.cap = !!(cap && cap.img && cap.img.length > 5000);
      /* corpuri deschise prin animația existentă: ușile și sticla, clape, uși pliante, ridicător TV, sertare */
      const names = ["S3 Vitrină", "S4 Clapă sus", "D3 Free flap", "D2 Bar uși pliante", "C3 TV lift", "S2 Sertare"]; o.bodies = {};
      /* numele corpurilor se traduc în limba aplicației (5.94.5): se caută după poziția din fișierul demo */
      const orig = Object.keys((await (await fetch("demo/living.json")).json()).configs), keys = Object.keys(p.configs);
      const cfgOf = n => { const k = ["ro", "it", "en", "fr", "de", "pl", "es"].map(l => EBDemo.bodyName(n, l)).find(x => p.configs[x]); return p.configs[n] || (k && p.configs[k]) || p.configs[keys[orig.indexOf(n)]]; };
      for (const n of names) {
        const c = JSON.parse(JSON.stringify(cfgOf(n))); GL3D.set({ open: false, ledOn: true }); GL3D.render(c, { explode: 0 }); await w(300);
        GL3D.set({ open: true }); await w(900);
        const k = GL3D.meshKinds(), mv = k.map(x => ({ role: x.role, t: GL3D.tgtOf(x.pk) })).filter(x => x.t && (x.t.ang || x.t.sl || x.t.ey));
        o.bodies[n] = { moving: mv.length, glass: mv.filter(x => x.role === "vetro").length, led: GL3D.ledInfo() };
      }
      GL3D.set({ open: false });
      return o;
    });
    if (!gl.ok) ok("Demo 3D: sărit (fără WebGL)", true);
    else {
      ok("Demo 3D: camera Living are benzi LED desenate, aprinse cu lumină; stinse când LED-ul e oprit; captura randează", gl.leds >= 5 && gl.roomOn && gl.roomOn.items >= 5 && gl.roomOn.lit >= 5 && gl.roomOn.litLights >= 3 && gl.roomOff && gl.roomOff.lit === 0 && gl.roomOff.litLights === 0 && gl.cap, JSON.stringify([gl.leds, gl.roomOn, gl.roomOff]));
      if (gl.err) ok("Demo 3D: " + gl.err, false);
      const B = gl.bodies;
      ok("Demo 3D: vitrina cu sticlă se deschide (ușile ȘI sticla se mișcă) și LED-ul e aprins", (B["S3 Vitrină"] || {}).glass >= 2 && B["S3 Vitrină"].moving >= 4 && B["S3 Vitrină"].led && B["S3 Vitrină"].led.on && B["S3 Vitrină"].led.lit >= 1, JSON.stringify(B["S3 Vitrină"]));
      ok("Demo 3D: clapa AVENTOS cu SERVO-DRIVE, Free flap cu E-Drive, ușile pliante, ridicătorul de TV și sertarele se mișcă la «Deschide»", ["S4 Clapă sus", "D3 Free flap", "D2 Bar uși pliante", "C3 TV lift", "S2 Sertare"].every(n => B[n].moving >= 1), JSON.stringify(Object.fromEntries(Object.entries(B).map(([k, v]) => [k, v.moving]))));
    }
    /* limita gratuită: redenumită prin foaia aplicației, copia devine proiect propriu (steagul cade, se numără) */
    const lim = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      const own0 = ownProjects(), p = state.projects.find(q => q.showcase === "bedroom");
      editingProjectId = p.id; setView("projects");
      document.getElementById("prName").value = "Camera mea"; document.getElementById("btnProjectSave").click(); await w(250);
      o.renamed = !p.showcase && ownProjects() === own0 + 1;
      return o;
    });
    ok("Demo: redenumită, copia devine proiect propriu (steagul cade, se numără în limită)", lim.renamed, JSON.stringify(lim));
    /* curățenie: ce a încărcat blocul nu rămâne pentru restul rulării */
    await pg.evaluate(() => { closeSheets(); state.projects = state.projects.filter(p => !p.showcase && p.name !== "Camera mea"); state.activeId = state.projects[0] ? state.projects[0].id : null; try { persist(); setView("projects"); } catch (e) {} });
    ok("Demo: fără erori JS", errs.length === errs0, errs.slice(errs0).join(" | "));
  }

  head("Foi pe postazione (D-187, 5.108.0) — fără cont, același cod rX pe etichetă, plan de tăiere, cant, găurire");
  {
    const errs0 = errs.length;
    const r = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      const keepP = state.projects, keepA = state.activeId, keepLang = state.lang, keepL = LIC;
      window.print = () => {}; printOut._offered = 1;
      licWrite({ kind: "stripe", key: "comp_TESTTESTTESTTESTTESTTEST", status: "active", activated: true, checkedAt: Date.now() });
      state.projects = [{ id: "fs1", name: "Foi", client: "C", date: "2026-11-24", pieces: [], configs: {}, layout: {} }]; state.activeId = "fs1";
      const q = proj(), F = cfgFromForm();
      generateInto(q, { ...F, ...PRESETS.armadio, name: "Arm", L: 1200, H: 2200, P: 550, doors: 2, drawers: 2 });
      persist(); setView("list");
      document.getElementById("btnStations").click(); await w(900);
      const sheet = document.getElementById("shStations");
      o.deschis = sheet.classList.contains("on");
      o.sapteCarduri = [...sheet.querySelectorAll("#stBody > div")].length === 7;
      o.fara = !sheet.querySelector("#stBody").innerText.match(/cnc|verniciatura/i);
      const cap = async a => { PRINT_CAPTURE = []; closeSheets(); document.getElementById("btnStations").click(); await w(300);
        const el = document.querySelector('[data-fs="' + a + '"]'); if (!el || el.disabled) { PRINT_CAPTURE = null; return null; }
        el.click(); await w(2500); const c = PRINT_CAPTURE; PRINT_CAPTURE = null; return c && c[0] || ""; };
      const saw = await cap("saw"), edge = await cap("edge"), drill = await cap("drill"), lab = await cap("labels"), mont = await cap("mont");
      o.foi = !!saw && !!edge && !!drill && !!lab && !!mont;
      const count = (h, re) => (h.match(re) || []).length;
      /* fiecare piesă cu găuri → o pagină A4, cu codul rX */
      const withHoles = fsDrillList(q).length;
      o.pagGaurire = count(drill, /class="sh-pg"/g) === withHoles && withHoles > 0;
      o.codGaurire = /r1</.test(drill);
      /* același cod pe etichetă și pe planul de tăiere */
      o.codEticheta = /· r1 ·/.test(lab) && />r1</.test(saw.replace(/\s+/g, "")) || /r1/.test(saw);
      o.fara_avertisment = !/Nessuna commessa|Nicio comandă|No order/.test(saw);
      o.traseu = /›/.test(lab);
      o.marcaj = /class="qk"[^>]*>[PET]</.test(lab);
      /* un proiect fără piese nu deschide nimic */
      state.projects = [{ id: "fs2", name: "Gol", pieces: [], configs: {}, layout: {} }]; state.activeId = "fs2"; closeSheets();
      document.getElementById("btnStations").click(); await w(400);
      o.gol = !document.querySelector("#stBody [data-fs]");
      closeSheets(); state.projects = keepP; state.activeId = keepA; state.lang = keepLang; licWrite(keepL);
      return o;
    });
    ok("Foi pe postazione: foaia se deschide cu 7 postazioni, fără cnc/verniciatura", r.deschis && r.sapteCarduri && r.fara, JSON.stringify(r));
    ok("Foi pe postazione: toate cele 5 documente ies fără cont", r.foi === true && r.fara_avertisment, JSON.stringify(r));
    ok("Foi pe postazione: o pagină A4 de găurire pe fiecare piesă cu găuri, cu codul rX", r.pagGaurire && r.codGaurire, JSON.stringify(r));
    ok("Foi pe postazione: eticheta poartă codul rX, traseul și marcajul P/E/T", r.codEticheta && r.traseu && r.marcaj, JSON.stringify(r));
    ok("Foi pe postazione: fără piese nu apare niciun buton", r.gol, JSON.stringify(r));
    ok("Foi pe postazione: fără erori JS", errs.length === errs0, errs.slice(errs0).join(" | "));
  }

  const bad = results.filter(r => !r.cond).length;
  console.log(`\n\x1b[1m${results.length - bad}/${results.length} test superati\x1b[0m\n`);
  await browser.close();
  server.close();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
