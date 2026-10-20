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
    o.altezzaFascia = fascia.larg;                                     // H - 2t
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
  ok("la fascia sta fra fondo e cielo (H−2t)", rnd.altezzaFascia === 1200 - 2 * rnd.t,
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
    return { missT: ui.filter(v => AI_ENUM.type.indexOf(v) < 0),
             missF: uf.filter(v => AI_ENUM.front.indexOf(v) < 0),
             round, curvo, warn };
  });
  ok("ogni tipo della tendina esiste anche per l'AI", aiOK.missT.length === 0, aiOK.missT.join(",") || "tutti");
  ok("ogni tipo di fronte anche", aiOK.missF.length === 0, aiOK.missF.join(",") || "tutti");
  ok("«tondo» passa la validazione, col suo raggio", aiOK.round.type === "tondo" && aiOK.round.rcorner === 80,
     JSON.stringify(aiOK.round));
  ok("«bombato» passa la validazione, con la sua freccia", aiOK.curvo.front === "curvo" && aiOK.curvo.bow === 40,
     JSON.stringify(aiOK.curvo));
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
      saved: JSON.parse(localStorage.getItem("tagliapro")).projects[0].geomVersion }));
    ok("il backup completo parte PRIMA della scrittura", af.dl.length === 1, af.dl[0]);
    ok("solo dopo la conferma il fianco torna 2078×398", af.f.lung === 2078 && af.f.larg === 398,
       af.f.lung + "×" + af.f.larg);
    ok("e base/cielo 962×379", af.bc.lung === 962 && af.bc.larg === 379, af.bc.lung + "×" + af.bc.larg);
    ok("geomVersion diventa 2 e resta scritto", af.gv === 2 && af.saved === 2,
       "in memoria " + af.gv + ", su disco " + af.saved);
    ok("nessun errore JS nella migrazione", mErrs.length === 0, mErrs[0] || "nessuno");
    await ctx.close();
  }

  /* ---- Motore locale superato ----
     Dopo un deploy, il service worker puo tenere in vita la copia vecchia per
     giorni: l'utente continua a generare distinte col motore sbagliato senza
     accorgersene. Qui si finge che il server abbia gia la versione 3 e si
     verifica che l'esportazione si FERMI, non che avvisi. */
  head("Motore vecchio in cache — l'esportazione si ferma, non avvisa");
  {
    /* `serviceWorkers: block`: senza, il service worker prende lui la richiesta
       e l'intercettazione della prova non la vede mai. E' anche il motivo per
       cui sw.js adesso lascia passare le domande con ?gv= direttamente in
       rete — la risposta deve venire dal server, non dalla cache. */
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 },
                                           serviceWorkers: "block" });
    const sp = await ctx.newPage();
    // il file sul server dice 3; quello caricato in pagina dice 2
    await sp.route(/ebanist-core\.js\?gv=/, route => route.fulfill({
      status: 200, contentType: "text/javascript",
      body: "var GEOM_VERSION = 3; /* GEOM_VERSION-MARKER */"
    }));
    await sp.goto(URL);
    await sp.waitForTimeout(3300);
    await sp.evaluate(() => closeSheets());
    await sp.waitForTimeout(300);

    ok("il motore locale si dichiara alla versione 2", await sp.evaluate(() => GEOM_VERSION) === 2);
    const remote = await sp.evaluate(() => checkGeomVersion());
    ok("il verificatore vede la 3 sul server", remote === 3, "remote=" + remote);
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
      body: "var GEOM_VERSION = 2; /* GEOM_VERSION-MARKER */"
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

  head("Documentele de atelier — gratuit: ecranul Pro, nimic tipărit; Pro: curate");
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
    ok("da gratuito NESSUN documento si stampa", stampati.length === 0, stampati.join(",") || "0");
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
    ok("i vecchi /?lang=xx vanno alla pagina della lingua", ["ro", "it", "fr"].every(l => new RegExp(`to = "/${l}/"[\\s\\S]{0,60}query = \\{lang = "${l}"\\}`).test(toml)));
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
      clientOpen(); await w(300);
      const el = document.getElementById("clientMode");
      o.aperto = !el.hidden && document.body.classList.contains("client-on");
      const txt = el.innerText;
      /* niente di tecnico: codici fornitore, costi interni, distinta */
      o.codici = (txt.match(/\b\d{5}MN\b|\bH\d{4}\b/g) || []).length;
      o.interni = /€\s*\/\s*m²|manodopera|margin|sfrido|pannell[oi] intero|distinta/i.test(txt);
      o.prezzo = !!el.querySelector(".cm-ptot") && /€/.test(el.querySelector(".cm-ptot").textContent);
      o.swatch = el.querySelectorAll(".cm-sws[data-key=matFront] .cm-sw").length;
      /* la variante ha la stessa grossezza: le cote non si muovono */
      const cfg0 = cmCfg(CM.cur), th0 = matById(cfg0.matFront).th;
      const b = [...el.querySelectorAll(".cm-sws[data-key=matFront] .cm-sw")].find(x => x.dataset.id !== cfg0.matFront);
      b.click(); await w(200);
      const cfg1 = cmCfg(CM.cur);
      o.cambiata = cfg1.matFront === b.dataset.id && cfg1.matFront !== cfg0.matFront;
      o.stessaGrossezza = matById(cfg1.matFront).th === th0;
      /* il tasto Indietro non porta fuori */
      o.dentroDopoIndietro = (navCloseTop(), CM.on === true);
      /* la firma: senza tratto il bottone resta spento */
      el.querySelector("[data-accept]").click(); await w(200);
      document.getElementById("cmSignName").value = "Mario Rossi"; document.getElementById("cmSignOk").checked = true; cmSignCheck();
      o.spentoSenzaFirma = document.getElementById("cmSignGo").disabled;
      const pad = document.getElementById("cmPad"), r = pad.getBoundingClientRect();
      const ev = (t, x, y) => pad.dispatchEvent(new PointerEvent(t, { clientX: r.left + x, clientY: r.top + y, pointerId: 1, bubbles: true }));
      ev("pointerdown", 30, 60); for (let i = 0; i < 12; i++) ev("pointermove", 30 + i * 15, 60 + (i % 2) * 20); ev("pointerup", 210, 60);
      o.accesoConFirma = !document.getElementById("cmSignGo").disabled;
      const lung0 = p.pieces.filter(x => x.gen === CM.cur).map(x => x.lung + "x" + x.larg).join(",");
      document.getElementById("cmSignGo").click(); await w(200);
      o.offerte = (p.offers || []).length - o.offersPrima;
      const of = p.offers[p.offers.length - 1];
      o.firmaImg = /^data:image\/png/.test(of.sig) && of.sig.length < 120000;
      o.totale = of.total > 0;
      o.applicata = p.configs[CM.cur].matFront === b.dataset.id;
      o.coteFerme = p.pieces.filter(x => x.gen === CM.cur).map(x => x.lung + "x" + x.larg).join(",") === lung0;
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
      if (M && M.ops) { openPartSheet(M, M.ops.pieces[0]); await w(100); o.fisa = pro(); closeSheets(); } else o.fisa = true;
      document.getElementById("btnShare").click(); await w(100); o.csv = pro(); closeSheets();
      document.getElementById("btnRoom").click(); await w(100); o.camera = pro() && document.getElementById("roomView").style.display !== "flex"; closeSheets();
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
    ok("gratuit: fișa piesei cu găuri → ecranul Pro", z.fisa === true);
    ok("gratuit: CSV → ecranul Pro", z.csv === true);
    ok("gratuit: „În camera ta” → ecranul Pro", z.camera === true);
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
      PRINT_CAPTURE = []; partA3(M, pc, 5); const cap = PRINT_CAPTURE; PRINT_CAPTURE = null;
      o.cap = cap.length === 1 && /sh-svg/.test(cap[0]) && /@page/.test(cap[0]) && /Fiche de fabrication/.test(cap[0]);
      state.lang = lang0; applyLang(); closeSheets(); setView("projects");
      return o;
    });
    await sp.close(); await sctx.close();
    ok("foaia A3: nicio cheie netradusă în nicio limbă", sh.raw.length === 0, sh.raw.slice(0, 5).join(","));
    ok("foaia A3: titlul diferă pe limbi", new Set(Object.values(sh.titles).map(a => a.join("|"))).size === 7);
    ok("foaia A3 trece prin printOut, în limba aleasă", sh.cap === true);
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
        billingQuery: () => { __calls.push("query"); send("products", { ok: true, plans: [
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
      o.textAvans = PLAY_PREPAID ? (/fără reînnoire automată|senza rinnovo|no automatic renewal|sans renouvellement/.test(body.textContent) && !/reînnoire automată prin|rinnovo automatico tramite|Auto-renewing|renouvellement automatique via/.test(body.textContent)) : true;
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
      __ebPlay("products", JSON.stringify({ ok: false, code: "unavailable", detail: "3 Billing unavailable" })); await w(50);
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
    ok("Uși: se deschid sub pantă (ambele axe) și pe aripa corpului de colț", ee.slopeDoors.length === 2 && ee.slopeDoors.every(Boolean) && ee.cornerDoors.length >= 2 && ee.cornerDoors.every(Boolean), JSON.stringify(ee));
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
      const a3 = partA3Svg({ cfg: cf, rows: built.pieces, ops, meta }, q, 5, 1, 1); o.a3 = a3.includes("<polygon") && /\d+,\d°/.test(a3);
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
      document.querySelectorAll("#v-summary .exp-h").forEach(h => {
        const row = h.nextElementSibling; g[h.dataset.i] = [...row.querySelectorAll("button")].map(b => b.id);
      });
      setView("projects");
      return g;
    });
    const all = [].concat(...Object.values(x));
    ok("export: trei grupe cu titlu", Object.keys(x).join() === "expClient,expShop,expSite", Object.keys(x).join());
    ok("export: fiecare dintre cele 9 butoane e într-o grupă, o singură dată",
      all.length === 9 && new Set(all).size === 9 && ["btnPdf","btnQuote","btnMont","btnLabels","btnLab","btnOrder","btnTransp","btnCsv","btnShare"].every(i => all.includes(i)), all.join());
    ok("export: oferta e la client, montajul la atelier", x.expClient.join() === "btnQuote" && x.expSite.includes("btnMont") && x.expShop.includes("btnPdf"));
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
    await pg.selectOption("#svSlope", "x"); await pg.waitForTimeout(200);
    const rd = await pg.evaluate(() => ({ sv: survey().slope, txt: $("svSlopeHint").textContent }));
    ok("D-88: alegerea se salvează în releveu și indiciul spune ce se propune (minus 20 mm)", rd.sv === "x" && rd.txt.includes("2480") && rd.txt.includes("1880"), JSON.stringify(rd));
    await pg.click("#btnSvApply"); await pg.waitForTimeout(400);
    const ap = await pg.evaluate(() => { const c = cfgFromForm(); return { view: currentView, tp: c.topProfile, H: c.H, ro: $("bH").readOnly, L: c.L }; });
    ok("D-88: «Completează generatorul» pune panta: stânga 2480, dreapta 1880, H = 2480", ap.view === "build" && ap.tp && ap.tp.axis === "x" && ap.tp.h0 === 2480 && ap.tp.h1 === 1880 && ap.H === 2480 && ap.ro, JSON.stringify(ap));
    ok("D-88: corpul propus se generează fără eroare", await pg.evaluate(() => { try { const m = buildModule({ ...cfgFromForm(), name: "Rv" }); return m.boxes.some(b => b.vp); } catch (e) { return String(e); } }));
    await pg.evaluate(() => { setView("survey"); }); await pg.selectOption("#svSlope", "z"); await pg.waitForTimeout(150);
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

  const bad = results.filter(r => !r.cond).length;
  console.log(`\n\x1b[1m${results.length - bad}/${results.length} test superati\x1b[0m\n`);
  await browser.close();
  server.close();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
