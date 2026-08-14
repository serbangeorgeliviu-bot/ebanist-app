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
  ok("piano dei tagli calcolato", !!rnd.kerf && rnd.kerf.n > 0,
     rnd.kerf ? rnd.kerf.n + " intagli ogni " + rnd.kerf.spacing + " mm, profondi " + rnd.kerf.depth : "—");
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
