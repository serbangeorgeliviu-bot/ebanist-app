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

/* Gli header di sicurezza si leggono da netlify.toml e si servono anche qui:
   la prova deve girare nelle stesse condizioni della produzione, altrimenti
   un CSP che rompe l'app si scopre dal telefono, dopo il deploy. */
const NETLIFY_TOML = fs.readFileSync(path.join(ROOT, "netlify.toml"), "utf8");
const CSP = (NETLIFY_TOML.match(/Content-Security-Policy = "([^"]+)"/) || [])[1] || "";

function serve() {
  return new Promise(res => {
    const s = http.createServer((req, rq) => {
      const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
      const f = path.join(ROOT, rel);
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
  const URL = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const pg = await browser.newPage({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });

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
    const c = buildModule({ ...PRESETS.tondo });                       // Ø600 × H1200
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
  ok("la fascia sta fra fondo e cielo (H−2t)", rnd.altezzaFascia === 1164, rnd.altezzaFascia);
  ok("piano dei tagli entro 0,3 mm dall'arco (non solo il minimo teorico)",
     !!rnd.kerf && rnd.kerf.n > 0 && rnd.kerf.flat <= 0.31,
     rnd.kerf ? rnd.kerf.n + " intagli ogni " + rnd.kerf.spacing + " mm, scarto " + rnd.kerf.flat + " mm" : "—");
  ok("fondo, cielo e 3 ripiani, tutti Ø−2t", rnd.nPiani === 5 && rnd.diamPiano === 564,
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
    const out = {}, oldPrompt = window.prompt, oldConfirm = window.confirm;
    setView("build"); await wait(400);
    state.settings.presetAdd = []; renderPresetChips();
    out.serie = document.querySelectorAll("#presetChips .chip").length;
    out.attesi = Object.keys(PRESETS).length + 1;   // tipi di serie + "tipo nuovo"

    // 1. salvare la configurazione corrente come tipo, con un ostacolo di cantiere presente
    buildObst = [{ x: 100, y: 200, w: 80, h: 80 }];
    buildCfg = { ...PRESETS.cassettiera, name: "Banco utensili", L: 900, H: 1400, drawers: 8, doors: 0 };
    syncBuildForm();
    window.prompt = () => "Banco utensili";
    presetSaveCurrent(); await wait(150);
    const saved = (state.settings.presetAdd || [])[0] || {};
    out.creato = !!saved.name;
    out.senzaOstacoli = !("obstacles" in (saved.cfg || {}));   // il cantiere non entra nel tipo
    out.conValori = saved.cfg && saved.cfg.L === 900 && saved.cfg.drawers === 8;
    out.chipUtente = document.querySelectorAll("#presetChips .chip-user").length;

    // 2. non deve duplicare: stesso nome -> sovrascrive
    window.confirm = () => true;
    buildCfg = { ...buildCfg, L: 1200 }; syncBuildForm();
    presetSaveCurrent(); await wait(150);
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
    document.querySelector("#presetChips .chip-user .chip-x").click(); await wait(200);
    out.tolto = (state.settings.presetAdd || []).length === 0;
    out.serieIntatti = document.querySelectorAll("#presetChips .chip").length === out.serie;

    window.prompt = oldPrompt; window.confirm = oldConfirm;
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
    const oldConfirm = window.confirm; window.confirm = () => true;
    document.getElementById("btnAiKeyDel").click(); await wait(120);
    window.confirm = oldConfirm;
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
  const sw = await (await fetch(URL.replace("index.html", "sw.js"))).text();
  const swName = (sw.match(/const CACHE\s*=\s*"([^"]+)"/) || [])[1];
  const pgName = await pg.evaluate(() => (typeof SW_CACHE === "string" ? SW_CACHE : null));
  const pgVer = await pg.evaluate(() => APP_VER);
  ok("sw.js e index.html puntano alla stessa cache", !!swName && swName === pgName,
     "sw.js=" + swName + " · index.html=" + pgName);
  ok("APP_VER e leggibile dal marcatore che usa l'updater",
     /const APP_VER="[^"]+"; \/\* APP_VER-MARKER \*\//.test(
       await (await fetch(URL)).text()), "v" + pgVer);

  head("Traduzioni — nessuna etichetta deve mostrare il nome della chiave");
  const i18n = await pg.evaluate(() => {
    const dicts = { I18N, SURVEY_I18N, AUTH_I18N, AI_I18N };
    const langs = ["it", "ro", "en", "fr"], out = { missing: [], raw: [] }, keep = state.lang;
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
  ok("tutte le tabelle complete nelle 4 lingue", i18n.missing.length === 0,
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
  const full = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const real = localStorage.setItem.bind(localStorage);
    localStorage.setItem = () => { throw new DOMException("quota", "QuotaExceededError"); };
    let threw = false;
    try { persist(); } catch (e) { threw = true; }
    localStorage.setItem = real;
    await wait(120);
    const bar = document.getElementById("storageBar");
    const visible = !!bar && bar.style.display !== "none";
    const txt = bar ? bar.textContent : "";
    const hasBtn = !!(bar && bar.querySelector("button"));
    if (bar) bar.remove();
    storageBroken = false;
    return { threw, visible, hasBtn, saysIt: /MEMOR|STORAGE|MÉMOIRE/i.test(txt) };
  });
  ok("persist() non lascia passare l'errore all'app", full.threw === false);
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
    const tr = await pg.evaluate(() => {
      const out = {};
      out.hash = assertionsHash();
      out.stabile = assertionsHash() === assertionsHash();
      for (const [k, id] of [["distinta", "btnPdf"], ["montaggio", "btnMont"]]) {
        document.getElementById(id).click();
        out[k] = (document.getElementById("printArea").querySelector(".pr-trace") || {}).textContent || "";
      }
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

  const bad = results.filter(r => !r.cond).length;
  console.log(`\n\x1b[1m${results.length - bad}/${results.length} test superati\x1b[0m\n`);
  await browser.close();
  server.close();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
