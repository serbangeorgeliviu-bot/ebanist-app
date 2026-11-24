/* =====================================================================
   Ebanist — Modul Atelier, etapa E0 (D-92, ebanist-hq/07-atelier/SPEC-ATELIER-v1.md)

   Partea PURĂ a modulului: roluri, capacități, postazioni, ajutoare pentru
   slug și codul de invitație, textele în 7 limbi. Ecranul și apelurile
   Supabase stau în index.html; aici nu există rețea, ca să se poată testa
   în Node (test/atelier.test.js).

   E0 e ASCUNS: apare numai cu ?atelier=1 (rămâne ținut în localStorage
   `ebAtelier`) și numai după login. Nu face parte din Pro (D-55) până nu se
   decide prețul și regula Google Play pentru un plan B2B (D-54).
   ===================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EBAtelier = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* aceleași valori ca în enumul `atelier_role` din migrarea 1.5 */
  var ROLES = ["responsabil", "birou", "operator", "partener"];
  /* cele 7 postazioni din prezentare; E1 le folosește pentru stări */
  /* D-187: postazioni active la Dolceacqua, faza 1 (utilaje clasice). `cnc` și `verniciatura` rămân valori
     valide pe server și în date (STATIONS_ALL), dar nu se mai oferă la invitații și în panou decât dacă
     au deja evenimente; se activează în faza 2 (CNC în 2027). */
  var STATIONS = ["magazzino", "sezionatrice", "bordatrice", "toupie", "foratura", "assemblaggio", "spedizione"];
  var STATIONS_LATER = ["cnc", "verniciatura"];
  /* D-187: traseul unei piese pe hârtie (eticheta): ce postazioni trece, în ordinea din atelier.
     `f` = {acc, edge, shape, drill}; accesoriile nu se prelucrează (traseu gol). */
  function labelRoute(f) {
    f = f || {};
    if (f.acc) return [];
    var r = ["sezionatrice"];
    if (f.shape) r.push("toupie");
    if (f.edge) r.push("bordatrice");
    if (f.drill) r.push("foratura");
    r.push("assemblaggio");
    return r;
  }
  var STATIONS_ALL = ["magazzino", "sezionatrice", "bordatrice", "toupie", "foratura", "cnc", "verniciatura", "assemblaggio", "spedizione"];

  /* ce poate face fiecare rol în E0. Serverul decide oricum (RLS + funcții);
     asta doar ascunde butoanele care ar eșua. */
  var CAPS = {
    "members.list": ["responsabil", "birou"],
    "members.manage": ["responsabil"],
    "invite.create": ["responsabil"],
    /* E1 (migrarea 1.6): comenzi */
    "job.create": ["responsabil", "birou"],
    "job.state": ["responsabil", "birou"],
    "job.progress": ["responsabil", "birou"],
    "job.event": ["responsabil", "birou", "operator"],
    /* E3: documente pe postazione din proiectul deschis */
    "doc.print": ["responsabil", "birou"],
    /* E4: comandă agregată către furnizor din mai multe comenzi */
    "order.agg": ["responsabil", "birou"]
  };
  function can(role, cap) { return (CAPS[cap] || []).indexOf(role) >= 0; }

  var SLUG_RE = /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/;
  function isSlug(s) { return typeof s === "string" && SLUG_RE.test(s); }
  /* „Tâmplăria Test” → „tamplaria-test”: fără diacritice, litere mici, liniuțe */
  function slugify(name) {
    var s = String(name == null ? "" : name).normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (s.length > 40) s = s.slice(0, 40).replace(/-+$/g, "");
    return s;
  }

  /* codul de invitație: 16 cifre hex, afișat 4-4-4-4; se acceptă orice grupare și litere mici */
  function normCode(s) {
    var c = String(s == null ? "" : s).replace(/[^0-9A-Za-z]/g, "").toUpperCase();
    return /^[0-9A-F]{16}$/.test(c) ? c : null;
  }
  function fmtCode(c) { return String(c).replace(/(.{4})(?=.)/g, "$1-"); }

  /* stările comenzii și tipurile de eveniment: aceleași valori ca enumurile din migrarea 1.6 */
  var JOB_STATES = ["draft", "confirmed", "in_progress", "done", "shipped", "installed", "cancelled"];
  var JOB_EVENTS = ["start", "done", "issue"];

  /* Instantaneul comenzii: piesele proiectului, ÎNGHEȚATE. Numai câmpurile din lista albă a
     serverului (`job_snapshot_ok`): niciun preț, niciun client, niciun telefon. Cheia `pk` e
     stabilă la același proiect (r1, r2… în ordinea distinctei). `h` aduce ce nu știe modulul
     pur: etichetă de material și nota de decupaj. Întoarce null dacă nu e nimic de înghețat. */
  function buildSnapshot(p, h) {
    h = h || {};
    var rows = (p && p.pieces) || [];
    if (!rows.length || rows.length > 2000) return null;
    function s(v, n) { v = v == null ? "" : String(v); return v.slice(0, n || 200); }
    var pieces = rows.map(function (x, i) {
      var o = { pk: "r" + (i + 1) };
      if (x.modulo) o.modulo = s(x.modulo);
      if (x.elemento) o.elemento = s(x.elemento);
      if (x.lung != null && isFinite(x.lung)) o.lung = +x.lung;
      if (x.larg != null && isFinite(x.larg)) o.larg = +x.larg;
      o.pz = x.pz > 0 ? Math.round(x.pz) : 1;
      var m = h.material ? h.material(x) : x.materiale; if (m) o.material = s(m);
      var dc = h.decor ? h.decor(x) : ""; if (dc) o.decor = s(dc, 60);
      if (x.bordo) o.bordo = s(x.bordo, 40);
      var n = h.note ? h.note(x) : ""; if (n) o.note = s(n, 200);
      var pt = h.part ? trimPart(h.part(x, i)) : null; if (pt) o.part = pt;
      return o;
    });
    /* fișa piesei (cote, găuri) e partea grea: dacă instantaneul s-ar apropia de plafonul serverului (2 MB),
       comanda se creează fără ea, nu eșuează */
    if (JSON.stringify(pieces).length > PART_BUDGET) pieces.forEach(function (o) { delete o.part; });
    var meta = { units: "mm" };
    if (h.appVer) meta.app_ver = s(h.appVer, 20);
    if (p.name) meta.project_name = s(p.name, 120);
    return { pieces: pieces, meta: meta };
  }

  /* Fișa piesei în instantaneu (D-145): piesa fizică din Modelul de Operații, fără câmpurile de lucru
     (`_w`, `_ax`, `_side`, min/max): rămân cotele, conturul, găurile și verificările. Telefonul din atelier
     n-are proiectul; cu asta redeschide fișa piesei ca pe PC. Cotele nu se recalculează la scanare. */
  var PART_BUDGET = 1700000, PART_MAX = 40000;
  function trimPart(pc) {
    if (!pc || typeof pc !== "object" || !Array.isArray(pc.operations)) return null;
    function clean(v) {
      if (Array.isArray(v)) return v.map(clean);
      if (v && typeof v === "object") {
        var o = {};
        Object.keys(v).forEach(function (k) { if (k.charAt(0) !== "_") o[k] = clean(v[k]); });
        return o;
      }
      return v;
    }
    var o = clean(pc);
    delete o.min; delete o.max;
    return JSON.stringify(o).length > PART_MAX ? null : o;
  }
  /* de la piesa din instantaneu la ce așteaptă `openPartSheet(M, pc)`; null dacă comanda e veche (fără `part`) */
  function scanModel(piece) {
    var pc = piece && piece.part;
    if (!pc || !Array.isArray(pc.operations)) return null;
    var row = { modulo: piece.modulo || "", elemento: piece.elemento || "", role: pc.role, lung: piece.lung, larg: piece.larg,
      pz: piece.pz || 1, materiale: piece.material || "", bordo: piece.bordo || "" };
    var meta = {}; meta[String(pc.pk)] = { n: pc.n || null, row: row, exact: true };
    return { M: { cfg: null, rows: [row], ops: { pieces: [pc] }, meta: meta }, pc: pc };
  }

  /* — E2: cod QR pe etichetă, scanare, coadă offline — */
  /* Codul de pe etichetă e un URL: camera telefonului (și iOS, fără BarcodeDetector) îl deschide
     direct în aplicație. Fragmentul `#e=` nu pleacă niciodată spre un server. */
  var QR_BASE = "https://ebanist.com/app/";   /* 5.84.1: spre aplicație, nu spre pagina de prezentare (acolo #e= nu face nimic) */
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var PK_RE = /^[A-Za-z0-9_-]{1,80}$/;
  function qrUrl(jobId, pk) {
    if (!UUID_RE.test(String(jobId)) || !PK_RE.test(String(pk))) return null;
    return QR_BASE + "#e=" + String(jobId).toLowerCase() + "." + pk;
  }
  /* acceptă URL-ul întreg, fragmentul `#e=…`, `e=…` sau doar `<comandă>.<piesă>` */
  function parseScan(text) {
    var m = /(?:^|[#&?])(?:e=)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{1,80})$/i
      .exec(String(text == null ? "" : text).trim());
    return m ? { job: m[1].toLowerCase(), pk: m[2] } : null;
  }
  /* semnătura rândurilor distinctei: eticheta primește QR numai dacă proiectul nu s-a schimbat de la
     crearea comenzii (altfel `r7` ar putea arăta altă piesă decât cea din instantaneu) */
  function rowSig(rows) {
    var str = (rows || []).map(function (x) {
      return [x.modulo, x.elemento, x.lung, x.larg, x.pz].join("|");
    }).join("\n"), h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36) + "." + (rows || []).length;
  }
  /* coada offline: evenimentele se păstrează până le primește serverul; `client_id` le face idempotente */
  var Q_MAX = 500, Q_TTL = 7 * 24 * 3600 * 1000;
  function qAdd(q, ev) {
    q = (q || []).filter(function (x) { return x.client_id !== ev.client_id; });
    q.push(ev);
    return q.slice(-Q_MAX);
  }
  function qFresh(q, now) {
    return (q || []).filter(function (x) { return now - Date.parse(x.client_at || 0) < Q_TTL; });
  }
  /* o eroare a regulilor (`job:…`, `atelier:…`) nu se repară retrimițând; orice altceva (rețea) se reîncearcă */
  function qIsPermanent(err) {
    return /(?:job|atelier):[a-z_]+/.test(String((err && err.message) || err || ""));
  }

  /* — Panou de birou (E3, partea rămasă): unde stă fiecare comandă, coadă pe postazione și întârzieri.
       Numai citire din `job_status_list` + `job_progress`; nimic nou pe server. `now` vine din afară (testabil).
       Starea unei postazione pe o comandă: `done` (gata), `active` (are activitate: piese gata, probleme sau evenimente),
       `idle` (neîncepută). O comandă e „întârziată” dacă termenul a trecut și nu e terminată, „stagnantă” dacă e
       deschisă și n-a avut nicio mișcare de `waitHours` ore, „neînceput” dacă e confirmată fără niciun eveniment. — */
  var JOB_CLOSED = ["done", "shipped", "installed", "cancelled"];
  function boardModel(jobs, progMap, now, opts) {
    opts = opts || {};
    var waitH = opts.waitHours > 0 ? opts.waitHours : 24;
    var today = new Date(now).toISOString().slice(0, 10);
    var queue = {}; STATIONS_ALL.forEach(function (st) { queue[st] = 0; });
    /* coloanele panoului: postazioni active + cele ulterioare numai dacă au date */
    var used = {}; Object.keys(progMap || {}).forEach(function (k) { (progMap[k] || []).forEach(function (r) { used[r.station] = 1; }); });
    var COLS = STATIONS.concat(STATIONS_LATER.filter(function (st) { return used[st]; }));
    var counts = { open: 0, overdue: 0, stagnant: 0, notStarted: 0 };
    var rows = [];
    (jobs || []).forEach(function (j) {
      if (j.state !== "confirmed" && j.state !== "in_progress") return;
      var prog = (progMap && progMap[j.id]) || [], byStation = {}, last = 0;
      prog.forEach(function (r) {
        byStation[r.station] = r;
        var t = r.last_at ? Date.parse(r.last_at) : 0; if (t > last) last = t;
      });
      var cells = COLS.map(function (st) {
        var r = byStation[st], status = "idle", pct = 0, issues = 0;
        if (r) {
          issues = +r.issues || 0;
          pct = r.total_pieces > 0 ? Math.min(100, Math.round(100 * (+r.done_pieces || 0) / r.total_pieces)) : 0;
          if (r.station_done) { status = "done"; pct = 100; }
          else if ((+r.done_pieces || 0) > 0 || issues > 0 || r.last_at) status = "active";
        }
        if (status === "active") queue[st]++;
        return { station: st, status: status, pct: pct, issues: issues };
      });
      var notStarted = last === 0;
      var idleH = notStarted ? null : Math.max(0, Math.floor((now - last) / 3600000));
      var overdue = !!j.due_date && String(j.due_date).slice(0, 10) < today && JOB_CLOSED.indexOf(j.state) < 0;
      var daysLate = overdue ? Math.floor((Date.parse(today) - Date.parse(String(j.due_date).slice(0, 10))) / 86400000) : 0;
      var stagnant = idleH != null && idleH >= waitH;
      counts.open++; if (overdue) counts.overdue++; if (stagnant) counts.stagnant++; if (notStarted) counts.notStarted++;
      rows.push({ job: j, cells: cells, idleH: idleH, overdue: overdue, daysLate: daysLate, stagnant: stagnant, notStarted: notStarted,
        issues: cells.reduce(function (a, c) { return a + c.issues; }, 0) });
    });
    rows.sort(function (a, b) {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      var da = a.job.due_date || "9999", db = b.job.due_date || "9999";
      if (da !== db) return da < db ? -1 : 1;
      return String(a.job.title) < String(b.job.title) ? -1 : 1;
    });
    return { rows: rows, queue: queue, counts: counts };
  }

  /* — E4: comandă agregată. Rândurile unei comenzi (din instantaneu) înapoi în forma distinctei, ca să treacă prin
       același plan de tăiere ca orice proiect. Comenzile mai vechi (E1) au decorul lipit de material, `Material [decor]`:
       se scoate. Cele noi poartă `decor` separat și `material` curat. — */
  function snapshotRows(snap) {
    var pcs = (snap && snap.pieces) || [];
    return pcs.map(function (p) {
      var mat = String(p.material == null ? "" : p.material);
      if (p.decor == null) mat = mat.replace(/\s\[[^\]]*\]$/, "");
      var r = { modulo: p.modulo || "", elemento: p.elemento || "", lung: +p.lung, larg: +p.larg, pz: +p.pz > 0 ? +p.pz : 1, materiale: mat };
      if (p.bordo) r.bordo = p.bordo;
      return r;
    }).filter(function (r) { return isFinite(r.lung) && isFinite(r.larg); });
  }

  /* — E3: documente pe postazione (bordatrice, vopsitorie). Numai grupare: cotele vin din rânduri,
       fără recalculări. `h` aduce ce știe aplicația: isAcc(x), mm(x) = lungimea de cant a unui rând
       (bandingMm), decor(x), mat(x), isMdf(x). `ri` e indexul rândului în distinctă: același `r<ri+1>` ca
       în `pk`-ul comenzii și în QR-ul de pe etichetă. — */
  function groupBy(items, keyOf, labelOf) {
    var map = {}, order = [];
    items.forEach(function (it) {
      var k = keyOf(it.x);
      if (!map[k]) { map[k] = { key: k, label: labelOf(it.x), pieces: [] }; order.push(k); }
      map[k].pieces.push(it);
    });
    return order.map(function (k) { return map[k]; })
      .sort(function (a, b) { return a.label < b.label ? -1 : a.label > b.label ? 1 : 0; });
  }
  /* Cantul se ia în decorul panoului (ABS asortat); grosimea e cea din Setări (`edgeTh`).
     Rândurile fără cant sau cu 0 mm de cant nu apar. Rezerva de 10% e aceeași ca la comanda către furnizor. */
  function edgeGroups(rows, h) {
    var items = [];
    (rows || []).forEach(function (x, ri) {
      if (h.isAcc(x)) return;
      var mm = h.mm(x);
      if (!(mm > 0)) return;
      items.push({ x: x, ri: ri, pk: "r" + (ri + 1), mm: mm, total: mm * (+x.pz || 1) });
    });
    var gs = groupBy(items, function (x) { return String(h.decor(x) || h.mat(x) || "").toLowerCase(); },
      function (x) { return h.decor(x) ? h.decor(x) : h.mat(x); });
    gs.forEach(function (g) {
      g.pieces.sort(function (a, b) { return b.mm - a.mm || a.ri - b.ri; });
      var sum = g.pieces.reduce(function (a, it) { return a + it.total; }, 0);
      g.meters = sum / 1000;
      g.metersReserve = Math.ceil(sum * 1.1 / 100) / 10; /* ml, rotunjit în sus la 0,1 */
      g.count = g.pieces.reduce(function (a, it) { return a + (+it.x.pz || 1); }, 0);
    });
    return gs;
  }
  /* Vopsitorie: numai panourile din MDF, pe material. Suprafața = cele două fețe; canturile se vopsesc și ele, dar
     nu se adună aici (nu avem grosimea reală a rândului). */
  function paintGroups(rows, h) {
    var items = [];
    (rows || []).forEach(function (x, ri) {
      if (h.isAcc(x) || !h.isMdf(x)) return;
      var pz = +x.pz || 1;
      items.push({ x: x, ri: ri, pk: "r" + (ri + 1), faces: 2 * (+x.lung || 0) * (+x.larg || 0) / 1e6 * pz });
    });
    var gs = groupBy(items, function (x) { return String(h.mat(x) || "").toLowerCase(); }, function (x) { return h.mat(x); });
    gs.forEach(function (g) {
      g.pieces.sort(function (a, b) { return a.ri - b.ri; });
      g.area = g.pieces.reduce(function (a, it) { return a + it.faces; }, 0);
      g.count = g.pieces.reduce(function (a, it) { return a + (+it.x.pz || 1); }, 0);
    });
    return gs;
  }

  /* erorile serverului au forma `atelier:<cod>` sau `job:<cod>`; întoarce cheia de text */
  function errKey(err) {
    var m = err && /(?:atelier|job):([a-z_]+)/.exec(String(err.message || err));
    var k = m ? "err_" + m[1] : "err_generic";
    return I18N.it[k] ? k : "err_generic";
  }

  /* — texte, 7 limbi, aceleași chei peste tot (verificat în test/atelier.test.js) — */
  var I18N = {
    it: {
      atTitle: "Atelier", atBeta: "Funzione in prova. Non fa parte di Pro.",
      atNeedLogin: "Accedi con il tuo account per usare l'Atelier.", atOpenAccount: "Apri account",
      atNoNet: "Serve la connessione.", atMine: "I tuoi atelier", atNone: "Non fai ancora parte di nessun atelier.",
      atOpen: "Apri", atBack: "Indietro", atLoading: "Carico…",
      atCreateTitle: "Crea un atelier", atName: "Nome dell'atelier", atSlug: "Indirizzo (minuscole, cifre, trattino)",
      atCreate: "Crea atelier", atJoinTitle: "Ho un codice d'invito", atCode: "Codice", atJoin: "Entra",
      atRole: "Ruolo", role_responsabil: "Responsabile", role_birou: "Ufficio tecnico", role_operator: "Operatore", role_partener: "Partner",
      atMembers: "Membri", atYou: "tu", atRemove: "Rimuovi", atLeave: "Esci dall'atelier",
      atConfirmRemove: "Rimuovere questo membro?", atConfirmLeave: "Uscire da questo atelier?",
      atInviteTitle: "Invita", atInviteBtn: "Crea invito", atInviteHint: "Il codice vale 7 giorni e si usa una sola volta.",
      atStations: "Postazioni", atPending: "Inviti in sospeso", atNoPending: "Nessun invito in sospeso.",
      atCopy: "Copia", atCopied: "Codice copiato", atDone: "Fatto",
      st_magazzino: "Magazzino", st_sezionatrice: "Sezionatrice", st_bordatrice: "Bordatrice", st_toupie: "Toupie", st_foratura: "Foratura", stl_sezionatrice: "Sez", stl_toupie: "Toup", stl_bordatrice: "Bord", stl_foratura: "Fori", stl_assemblaggio: "Mont", atLabelStale: "Il progetto è cambiato dopo la creazione dell'ordine: i codici QR di ordine non si stampano. Aggiorna l'ordine prima delle etichette.", fsOpen: "Fogli per postazione", fsHint: "Un foglio per ogni postazione del laboratorio, nell'ordine in cui passa il pezzo. Non servono account né scansione: tutto su carta.", fsNoProject: "Apri un progetto con dei pezzi.", fsPieces: "{n} pezzi", fsNothing: "niente da fare qui", fsDesc_magazzino: "Pannelli, bordo e ferramenta da prelevare", fsDesc_sezionatrice: "Piano di taglio per pannello, con i tagli, ed etichette da incollare sui pezzi", fsDesc_toupie: "Pezzi con canali e fresature, con misure", fsDesc_bordatrice: "Foglio del bordo: quali pezzi, quali lati, quale spessore", fsDesc_foratura: "Una scheda A4 per ogni pezzo con fori, con le quote", fsDesc_assemblaggio: "Scheda di montaggio illustrata", fsDesc_spedizione: "Verbale di consegna", fsB_order: "Lista ordine", fsB_saw: "Piano di taglio", fsB_labels: "Etichette", fsB_router: "Foglio toupie", fsB_edge: "Foglio bordo", fsB_drill: "Schede di foratura", fsB_mont: "Scheda montaggio", fsB_hand: "Verbale", fsRTitle: "FOGLIO TOUPIE — canali e fresature", fsRNone: "Nessun pezzo con canali o fresature.", fsRC1: "Codice", fsRC2: "Pezzo", fsRC3: "Misure", fsRC4: "Lavorazioni (lunghezza × larghezza × profondità, mm)", fsCodeNote: "Il codice rX è lo stesso del piano di taglio e dell'etichetta.", fsUnits: "{n} corpi", fsFace: "faccia", fsThrough: "passante", fsSheets: "{n} fogli", fsB_route: "Scheda di percorso", fsDesc_route: "Una pagina per progetto: ogni postazione spunta, data e firma quando ha finito. Si stampa per prima.", fsPTitle: "SCHEDA DI PERCORSO", fsPDeadline: "Scadenza", fsPUnits: "Corpi", fsPC1: "Postazione", fsPC2: "Pezzi", fsPC3: "Fogli", fsPC4: "Inizio", fsPC5: "Fine", fsPC6: "Sigla", fsPIssues: "Problemi, rifacimenti, note", fsPNone: "niente da fare", fsDNone: "Nessun pezzo con fori.", st_cnc: "CNC",
      st_verniciatura: "Verniciatura", st_assemblaggio: "Assemblaggio", st_spedizione: "Spedizione",
      err_not_authenticated: "Devi accedere.", err_slug_invalid: "Indirizzo non valido: usa minuscole, cifre e trattini.",
      err_name_invalid: "Nome troppo corto.", err_slug_taken: "Questo indirizzo è già preso.",
      err_code_invalid: "Codice non valido, scaduto o già usato.", err_already_member: "Fai già parte di questo atelier.",
      err_not_allowed: "Non hai il permesso per farlo.", err_last_owner: "Deve restare almeno un responsabile.",
      err_not_found: "Non trovato.", err_generic: "Non è andata. Riprova."
    },
    ro: {
      atTitle: "Atelier", atBeta: "Funcție în probă. Nu face parte din Pro.",
      atNeedLogin: "Conectează-te cu contul tău ca să folosești Atelierul.", atOpenAccount: "Deschide contul",
      atNoNet: "Trebuie conexiune.", atMine: "Atelierele tale", atNone: "Nu faci încă parte din niciun atelier.",
      atOpen: "Deschide", atBack: "Înapoi", atLoading: "Se încarcă…",
      atCreateTitle: "Creează un atelier", atName: "Numele atelierului", atSlug: "Adresă (litere mici, cifre, liniuță)",
      atCreate: "Creează atelier", atJoinTitle: "Am un cod de invitație", atCode: "Cod", atJoin: "Intră",
      atRole: "Rol", role_responsabil: "Responsabil", role_birou: "Birou tehnic", role_operator: "Operator", role_partener: "Partener",
      atMembers: "Membri", atYou: "tu", atRemove: "Scoate", atLeave: "Ieși din atelier",
      atConfirmRemove: "Scoți acest membru?", atConfirmLeave: "Ieși din acest atelier?",
      atInviteTitle: "Invită", atInviteBtn: "Creează invitație", atInviteHint: "Codul e valabil 7 zile și se folosește o singură dată.",
      atStations: "Posturi de lucru", atPending: "Invitații în așteptare", atNoPending: "Nicio invitație în așteptare.",
      atCopy: "Copiază", atCopied: "Cod copiat", atDone: "Gata",
      st_magazzino: "Magazie", st_sezionatrice: "Ferăstrău format", st_bordatrice: "Mașină de cantuit", st_toupie: "Freză de banc (toupie)", st_foratura: "Găurire", stl_sezionatrice: "Tăiere", stl_toupie: "Freză", stl_bordatrice: "Cant", stl_foratura: "Găurire", stl_assemblaggio: "Montaj", atLabelStale: "Proiectul s-a schimbat după crearea comenzii: codurile QR de comandă nu se tipăresc. Actualizează comanda înainte de etichete.", fsOpen: "Foi pe postazione", fsHint: "O foaie pentru fiecare postazione a atelierului, în ordinea în care trece piesa. Nu cere cont și nici scanare: totul pe hârtie.", fsNoProject: "Deschide un proiect cu piese.", fsPieces: "{n} piese", fsNothing: "nimic de făcut aici", fsDesc_magazzino: "Plăci, cant și feronerie de scos din magazie", fsDesc_sezionatrice: "Plan de tăiere pe placă, cu tăieturile, și etichetele de lipit pe piese", fsDesc_toupie: "Piese cu canale și frezări, cu cote", fsDesc_bordatrice: "Foaia cantului: ce piese, ce laturi, ce grosime", fsDesc_foratura: "Câte o fișă A4 pentru fiecare piesă cu găuri, cu cote", fsDesc_assemblaggio: "Fișa de montaj ilustrată", fsDesc_spedizione: "Proces-verbal de predare", fsB_order: "Lista de comandă", fsB_saw: "Plan de tăiere", fsB_labels: "Etichete", fsB_router: "Foaia toupie", fsB_edge: "Foaia cantului", fsB_drill: "Fișe de găurire", fsB_mont: "Fișa de montaj", fsB_hand: "Proces-verbal", fsRTitle: "FOAIE TOUPIE — canale și frezări", fsRNone: "Nicio piesă cu canale sau frezări.", fsRC1: "Cod", fsRC2: "Piesa", fsRC3: "Cote", fsRC4: "Operații (lungime × lățime × adâncime, mm)", fsCodeNote: "Codul rX e cel din planul de tăiere și de pe etichetă.", fsUnits: "{n} corpuri", fsFace: "fața", fsThrough: "trecere", fsSheets: "{n} foi", fsB_route: "Fișa de parcurs", fsDesc_route: "O pagină pe proiect: fiecare postazione bifează, datează și semnează când termină. Se tipărește prima.", fsPTitle: "FIȘĂ DE PARCURS", fsPDeadline: "Termen", fsPUnits: "Corpuri", fsPC1: "Postazione", fsPC2: "Piese", fsPC3: "Foi", fsPC4: "Început", fsPC5: "Gata", fsPC6: "Inițiale", fsPIssues: "Probleme, reluări, note", fsPNone: "nimic de făcut", fsDNone: "Nicio piesă cu găuri.", st_cnc: "CNC",
      st_verniciatura: "Vopsitorie", st_assemblaggio: "Asamblare", st_spedizione: "Expediție",
      err_not_authenticated: "Trebuie să te conectezi.", err_slug_invalid: "Adresă nevalidă: folosește litere mici, cifre și liniuțe.",
      err_name_invalid: "Nume prea scurt.", err_slug_taken: "Adresa aceasta e deja luată.",
      err_code_invalid: "Cod nevalid, expirat sau deja folosit.", err_already_member: "Faci deja parte din acest atelier.",
      err_not_allowed: "Nu ai permisiunea să faci asta.", err_last_owner: "Trebuie să rămână cel puțin un responsabil.",
      err_not_found: "Nu s-a găsit.", err_generic: "Nu a mers. Încearcă din nou."
    },
    en: {
      atTitle: "Workshop", atBeta: "Trial feature. Not part of Pro.",
      atNeedLogin: "Sign in with your account to use the Workshop.", atOpenAccount: "Open account",
      atNoNet: "A connection is required.", atMine: "Your workshops", atNone: "You are not in any workshop yet.",
      atOpen: "Open", atBack: "Back", atLoading: "Loading…",
      atCreateTitle: "Create a workshop", atName: "Workshop name", atSlug: "Address (lowercase, digits, hyphen)",
      atCreate: "Create workshop", atJoinTitle: "I have an invite code", atCode: "Code", atJoin: "Join",
      atRole: "Role", role_responsabil: "Manager", role_birou: "Technical office", role_operator: "Operator", role_partener: "Partner",
      atMembers: "Members", atYou: "you", atRemove: "Remove", atLeave: "Leave workshop",
      atConfirmRemove: "Remove this member?", atConfirmLeave: "Leave this workshop?",
      atInviteTitle: "Invite", atInviteBtn: "Create invite", atInviteHint: "The code is valid for 7 days and works once.",
      atStations: "Stations", atPending: "Pending invites", atNoPending: "No pending invites.",
      atCopy: "Copy", atCopied: "Code copied", atDone: "Done",
      st_magazzino: "Warehouse", st_sezionatrice: "Panel saw", st_bordatrice: "Edge bander", st_toupie: "Spindle moulder", st_foratura: "Drilling", stl_sezionatrice: "Saw", stl_toupie: "Mould", stl_bordatrice: "Edge", stl_foratura: "Drill", stl_assemblaggio: "Assy", atLabelStale: "The project changed after the order was created: order QR codes are not printed. Update the order before printing labels.", fsOpen: "Sheets per station", fsHint: "One sheet for each workshop station, in the order the piece travels. No account or scanning needed: everything on paper.", fsNoProject: "Open a project that has pieces.", fsPieces: "{n} pieces", fsNothing: "nothing to do here", fsDesc_magazzino: "Panels, edging and hardware to pick", fsDesc_sezionatrice: "Cutting plan per panel, with the cuts, and labels to stick on the pieces", fsDesc_toupie: "Pieces with grooves and millings, with dimensions", fsDesc_bordatrice: "Edge sheet: which pieces, which sides, which thickness", fsDesc_foratura: "One A4 sheet per piece with holes, with positions", fsDesc_assemblaggio: "Illustrated assembly sheet", fsDesc_spedizione: "Handover record", fsB_order: "Order list", fsB_saw: "Cutting plan", fsB_labels: "Labels", fsB_router: "Spindle moulder sheet", fsB_edge: "Edge sheet", fsB_drill: "Drilling sheets", fsB_mont: "Assembly sheet", fsB_hand: "Handover record", fsRTitle: "SPINDLE MOULDER SHEET — grooves and millings", fsRNone: "No piece has grooves or millings.", fsRC1: "Code", fsRC2: "Piece", fsRC3: "Size", fsRC4: "Operations (length × width × depth, mm)", fsCodeNote: "The rX code is the same as on the cutting plan and the label.", fsUnits: "{n} units", fsFace: "face", fsThrough: "through", fsSheets: "{n} sheets", fsB_route: "Routing sheet", fsDesc_route: "One page per project: each station ticks, dates and initials when done. Print it first.", fsPTitle: "ROUTING SHEET", fsPDeadline: "Due", fsPUnits: "Units", fsPC1: "Station", fsPC2: "Pieces", fsPC3: "Sheets", fsPC4: "Start", fsPC5: "Done", fsPC6: "Initials", fsPIssues: "Problems, rework, notes", fsPNone: "nothing to do", fsDNone: "No piece has holes.", st_cnc: "CNC",
      st_verniciatura: "Paint shop", st_assemblaggio: "Assembly", st_spedizione: "Shipping",
      err_not_authenticated: "You need to sign in.", err_slug_invalid: "Invalid address: use lowercase letters, digits and hyphens.",
      err_name_invalid: "Name too short.", err_slug_taken: "That address is already taken.",
      err_code_invalid: "Invalid, expired or already used code.", err_already_member: "You are already in this workshop.",
      err_not_allowed: "You are not allowed to do this.", err_last_owner: "At least one manager must remain.",
      err_not_found: "Not found.", err_generic: "That didn't work. Try again."
    },
    fr: {
      atTitle: "Atelier", atBeta: "Fonction en test. Ne fait pas partie de Pro.",
      atNeedLogin: "Connectez-vous avec votre compte pour utiliser l'Atelier.", atOpenAccount: "Ouvrir le compte",
      atNoNet: "Une connexion est nécessaire.", atMine: "Vos ateliers", atNone: "Vous ne faites encore partie d'aucun atelier.",
      atOpen: "Ouvrir", atBack: "Retour", atLoading: "Chargement…",
      atCreateTitle: "Créer un atelier", atName: "Nom de l'atelier", atSlug: "Adresse (minuscules, chiffres, tiret)",
      atCreate: "Créer l'atelier", atJoinTitle: "J'ai un code d'invitation", atCode: "Code", atJoin: "Rejoindre",
      atRole: "Rôle", role_responsabil: "Responsable", role_birou: "Bureau technique", role_operator: "Opérateur", role_partener: "Partenaire",
      atMembers: "Membres", atYou: "vous", atRemove: "Retirer", atLeave: "Quitter l'atelier",
      atConfirmRemove: "Retirer ce membre ?", atConfirmLeave: "Quitter cet atelier ?",
      atInviteTitle: "Inviter", atInviteBtn: "Créer l'invitation", atInviteHint: "Le code est valable 7 jours et ne sert qu'une fois.",
      atStations: "Postes", atPending: "Invitations en attente", atNoPending: "Aucune invitation en attente.",
      atCopy: "Copier", atCopied: "Code copié", atDone: "Fait",
      st_magazzino: "Magasin", st_sezionatrice: "Scie à panneaux", st_bordatrice: "Plaqueuse de chants", st_toupie: "Toupie", st_foratura: "Perçage", stl_sezionatrice: "Scie", stl_toupie: "Toup.", stl_bordatrice: "Chant", stl_foratura: "Perç.", stl_assemblaggio: "Mont.", atLabelStale: "Le projet a changé depuis la création de la commande : les QR de commande ne sont pas imprimés. Mettez la commande à jour avant les étiquettes.", fsOpen: "Fiches par poste", fsHint: "Une feuille pour chaque poste de l'atelier, dans l'ordre où la pièce circule. Ni compte ni scan : tout sur papier.", fsNoProject: "Ouvrez un projet avec des pièces.", fsPieces: "{n} pièces", fsNothing: "rien à faire ici", fsDesc_magazzino: "Panneaux, chants et quincaillerie à sortir", fsDesc_sezionatrice: "Plan de coupe par panneau, avec les coupes, et étiquettes à coller sur les pièces", fsDesc_toupie: "Pièces avec rainures et fraisages, avec cotes", fsDesc_bordatrice: "Feuille des chants : quelles pièces, quels côtés, quelle épaisseur", fsDesc_foratura: "Une fiche A4 par pièce percée, avec les cotes", fsDesc_assemblaggio: "Fiche de montage illustrée", fsDesc_spedizione: "Procès-verbal de livraison", fsB_order: "Liste de commande", fsB_saw: "Plan de coupe", fsB_labels: "Étiquettes", fsB_router: "Fiche toupie", fsB_edge: "Feuille des chants", fsB_drill: "Fiches de perçage", fsB_mont: "Fiche de montage", fsB_hand: "PV de livraison", fsRTitle: "FICHE TOUPIE — rainures et fraisages", fsRNone: "Aucune pièce avec rainures ou fraisages.", fsRC1: "Code", fsRC2: "Pièce", fsRC3: "Cotes", fsRC4: "Opérations (longueur × largeur × profondeur, mm)", fsCodeNote: "Le code rX est le même que sur le plan de coupe et l'étiquette.", fsUnits: "{n} corps", fsFace: "face", fsThrough: "traversant", fsSheets: "{n} fiches", fsB_route: "Fiche de parcours", fsDesc_route: "Une page par projet : chaque poste coche, date et paraphe quand il a fini. À imprimer en premier.", fsPTitle: "FICHE DE PARCOURS", fsPDeadline: "Échéance", fsPUnits: "Corps", fsPC1: "Poste", fsPC2: "Pièces", fsPC3: "Fiches", fsPC4: "Début", fsPC5: "Fin", fsPC6: "Paraphe", fsPIssues: "Problèmes, reprises, notes", fsPNone: "rien à faire", fsDNone: "Aucune pièce percée.", st_cnc: "CNC",
      st_verniciatura: "Peinture", st_assemblaggio: "Assemblage", st_spedizione: "Expédition",
      err_not_authenticated: "Vous devez vous connecter.", err_slug_invalid: "Adresse invalide : minuscules, chiffres et tirets.",
      err_name_invalid: "Nom trop court.", err_slug_taken: "Cette adresse est déjà prise.",
      err_code_invalid: "Code invalide, expiré ou déjà utilisé.", err_already_member: "Vous faites déjà partie de cet atelier.",
      err_not_allowed: "Vous n'avez pas l'autorisation.", err_last_owner: "Il doit rester au moins un responsable.",
      err_not_found: "Introuvable.", err_generic: "Ça n'a pas marché. Réessayez."
    },
    de: {
      atTitle: "Werkstatt", atBeta: "Testfunktion. Nicht Teil von Pro.",
      atNeedLogin: "Melde dich mit deinem Konto an, um die Werkstatt zu nutzen.", atOpenAccount: "Konto öffnen",
      atNoNet: "Verbindung erforderlich.", atMine: "Deine Werkstätten", atNone: "Du gehörst noch keiner Werkstatt an.",
      atOpen: "Öffnen", atBack: "Zurück", atLoading: "Lädt…",
      atCreateTitle: "Werkstatt anlegen", atName: "Name der Werkstatt", atSlug: "Adresse (Kleinbuchstaben, Ziffern, Bindestrich)",
      atCreate: "Werkstatt anlegen", atJoinTitle: "Ich habe einen Einladungscode", atCode: "Code", atJoin: "Beitreten",
      atRole: "Rolle", role_responsabil: "Leiter", role_birou: "Technisches Büro", role_operator: "Bediener", role_partener: "Partner",
      atMembers: "Mitglieder", atYou: "du", atRemove: "Entfernen", atLeave: "Werkstatt verlassen",
      atConfirmRemove: "Dieses Mitglied entfernen?", atConfirmLeave: "Diese Werkstatt verlassen?",
      atInviteTitle: "Einladen", atInviteBtn: "Einladung erstellen", atInviteHint: "Der Code gilt 7 Tage und nur einmal.",
      atStations: "Stationen", atPending: "Offene Einladungen", atNoPending: "Keine offenen Einladungen.",
      atCopy: "Kopieren", atCopied: "Code kopiert", atDone: "Fertig",
      st_magazzino: "Lager", st_sezionatrice: "Plattensäge", st_bordatrice: "Kantenanleimmaschine", st_toupie: "Tischfräse", st_foratura: "Bohren", stl_sezionatrice: "Säge", stl_toupie: "Fräse", stl_bordatrice: "Kante", stl_foratura: "Bohren", stl_assemblaggio: "Mont.", atLabelStale: "Das Projekt wurde nach dem Auftrag geändert: Auftrags-QR-Codes werden nicht gedruckt. Aktualisieren Sie den Auftrag vor den Etiketten.", fsOpen: "Blätter je Station", fsHint: "Ein Blatt für jede Werkstattstation, in der Reihenfolge, in der das Teil läuft. Weder Konto noch Scan nötig: alles auf Papier.", fsNoProject: "Öffnen Sie ein Projekt mit Teilen.", fsPieces: "{n} Teile", fsNothing: "hier nichts zu tun", fsDesc_magazzino: "Platten, Kanten und Beschläge zum Bereitstellen", fsDesc_sezionatrice: "Zuschnittplan je Platte mit den Schnitten und Etiketten zum Aufkleben", fsDesc_toupie: "Teile mit Nuten und Fräsungen, mit Maßen", fsDesc_bordatrice: "Kantenblatt: welche Teile, welche Seiten, welche Stärke", fsDesc_foratura: "Je ein A4-Blatt pro Teil mit Bohrungen, mit Maßen", fsDesc_assemblaggio: "Illustriertes Montageblatt", fsDesc_spedizione: "Übergabeprotokoll", fsB_order: "Bestellliste", fsB_saw: "Zuschnittplan", fsB_labels: "Etiketten", fsB_router: "Fräsblatt", fsB_edge: "Kantenblatt", fsB_drill: "Bohrblätter", fsB_mont: "Montageblatt", fsB_hand: "Übergabeprotokoll", fsRTitle: "FRÄSBLATT — Nuten und Fräsungen", fsRNone: "Kein Teil hat Nuten oder Fräsungen.", fsRC1: "Code", fsRC2: "Teil", fsRC3: "Maße", fsRC4: "Arbeitsgänge (Länge × Breite × Tiefe, mm)", fsCodeNote: "Der Code rX ist derselbe wie auf Zuschnittplan und Etikett.", fsUnits: "{n} Korpusse", fsFace: "Seite", fsThrough: "durchgehend", fsSheets: "{n} Blätter", fsB_route: "Laufzettel", fsDesc_route: "Eine Seite pro Projekt: Jede Station hakt ab, datiert und zeichnet ab, wenn sie fertig ist. Zuerst drucken.", fsPTitle: "LAUFZETTEL", fsPDeadline: "Termin", fsPUnits: "Korpusse", fsPC1: "Station", fsPC2: "Teile", fsPC3: "Blätter", fsPC4: "Beginn", fsPC5: "Fertig", fsPC6: "Kürzel", fsPIssues: "Probleme, Nacharbeit, Notizen", fsPNone: "nichts zu tun", fsDNone: "Kein Teil hat Bohrungen.", st_cnc: "CNC",
      st_verniciatura: "Lackiererei", st_assemblaggio: "Montage", st_spedizione: "Versand",
      err_not_authenticated: "Du musst dich anmelden.", err_slug_invalid: "Ungültige Adresse: Kleinbuchstaben, Ziffern und Bindestriche.",
      err_name_invalid: "Name zu kurz.", err_slug_taken: "Diese Adresse ist schon vergeben.",
      err_code_invalid: "Code ungültig, abgelaufen oder bereits benutzt.", err_already_member: "Du gehörst dieser Werkstatt schon an.",
      err_not_allowed: "Dafür fehlt dir die Berechtigung.", err_last_owner: "Mindestens ein Leiter muss bleiben.",
      err_not_found: "Nicht gefunden.", err_generic: "Das hat nicht geklappt. Versuche es erneut."
    },
    pl: {
      atTitle: "Warsztat", atBeta: "Funkcja testowa. Nie należy do Pro.",
      atNeedLogin: "Zaloguj się na swoje konto, aby korzystać z Warsztatu.", atOpenAccount: "Otwórz konto",
      atNoNet: "Wymagane połączenie.", atMine: "Twoje warsztaty", atNone: "Nie należysz jeszcze do żadnego warsztatu.",
      atOpen: "Otwórz", atBack: "Wstecz", atLoading: "Ładowanie…",
      atCreateTitle: "Utwórz warsztat", atName: "Nazwa warsztatu", atSlug: "Adres (małe litery, cyfry, myślnik)",
      atCreate: "Utwórz warsztat", atJoinTitle: "Mam kod zaproszenia", atCode: "Kod", atJoin: "Dołącz",
      atRole: "Rola", role_responsabil: "Kierownik", role_birou: "Biuro techniczne", role_operator: "Operator", role_partener: "Partner",
      atMembers: "Członkowie", atYou: "ty", atRemove: "Usuń", atLeave: "Opuść warsztat",
      atConfirmRemove: "Usunąć tego członka?", atConfirmLeave: "Opuścić ten warsztat?",
      atInviteTitle: "Zaproś", atInviteBtn: "Utwórz zaproszenie", atInviteHint: "Kod jest ważny 7 dni i działa jeden raz.",
      atStations: "Stanowiska", atPending: "Oczekujące zaproszenia", atNoPending: "Brak oczekujących zaproszeń.",
      atCopy: "Kopiuj", atCopied: "Skopiowano kod", atDone: "Gotowe",
      st_magazzino: "Magazyn", st_sezionatrice: "Piła formatowa", st_bordatrice: "Okleiniarka", st_toupie: "Frezarka dolnowrzecionowa", st_foratura: "Wiercenie", stl_sezionatrice: "Cięcie", stl_toupie: "Frez.", stl_bordatrice: "Okl.", stl_foratura: "Wiercenie", stl_assemblaggio: "Mont.", atLabelStale: "Projekt zmienił się po utworzeniu zamówienia: kody QR zamówienia nie są drukowane. Zaktualizuj zamówienie przed etykietami.", fsOpen: "Karty na stanowisko", fsHint: "Jedna karta na każde stanowisko warsztatu, w kolejności, w jakiej element przechodzi. Bez konta i skanowania: wszystko na papierze.", fsNoProject: "Otwórz projekt z elementami.", fsPieces: "{n} elementów", fsNothing: "nic do zrobienia", fsDesc_magazzino: "Płyty, okleina i okucia do pobrania", fsDesc_sezionatrice: "Plan cięcia na płytę z cięciami i etykiety do naklejenia na elementy", fsDesc_toupie: "Elementy z rowkami i frezowaniami, z wymiarami", fsDesc_bordatrice: "Arkusz okleiny: które elementy, które boki, jaka grubość", fsDesc_foratura: "Jedna karta A4 na element z otworami, z wymiarami", fsDesc_assemblaggio: "Ilustrowana karta montażu", fsDesc_spedizione: "Protokół odbioru", fsB_order: "Lista zamówienia", fsB_saw: "Plan cięcia", fsB_labels: "Etykiety", fsB_router: "Karta frezarki", fsB_edge: "Arkusz okleiny", fsB_drill: "Karty wiercenia", fsB_mont: "Karta montażu", fsB_hand: "Protokół", fsRTitle: "KARTA FREZARKI — rowki i frezowania", fsRNone: "Żaden element nie ma rowków ani frezowań.", fsRC1: "Kod", fsRC2: "Element", fsRC3: "Wymiary", fsRC4: "Operacje (długość × szerokość × głębokość, mm)", fsCodeNote: "Kod rX jest taki sam jak na planie cięcia i etykiecie.", fsUnits: "{n} korpusów", fsFace: "strona", fsThrough: "przelotowe", fsSheets: "{n} kart", fsB_route: "Karta przebiegu", fsDesc_route: "Jedna strona na projekt: każde stanowisko zaznacza, datuje i parafuje po zakończeniu. Drukuj ją pierwszą.", fsPTitle: "KARTA PRZEBIEGU", fsPDeadline: "Termin", fsPUnits: "Korpusy", fsPC1: "Stanowisko", fsPC2: "Elementy", fsPC3: "Karty", fsPC4: "Start", fsPC5: "Koniec", fsPC6: "Parafa", fsPIssues: "Problemy, poprawki, uwagi", fsPNone: "nic do zrobienia", fsDNone: "Żaden element nie ma otworów.", st_cnc: "CNC",
      st_verniciatura: "Lakiernia", st_assemblaggio: "Montaż", st_spedizione: "Wysyłka",
      err_not_authenticated: "Musisz się zalogować.", err_slug_invalid: "Nieprawidłowy adres: małe litery, cyfry i myślniki.",
      err_name_invalid: "Nazwa zbyt krótka.", err_slug_taken: "Ten adres jest już zajęty.",
      err_code_invalid: "Kod nieprawidłowy, wygasły lub już użyty.", err_already_member: "Już należysz do tego warsztatu.",
      err_not_allowed: "Nie masz uprawnień do tej czynności.", err_last_owner: "Musi pozostać co najmniej jeden kierownik.",
      err_not_found: "Nie znaleziono.", err_generic: "Nie udało się. Spróbuj ponownie."
    },
    es: {
      atTitle: "Taller", atBeta: "Función en prueba. No forma parte de Pro.",
      atNeedLogin: "Inicia sesión con tu cuenta para usar el Taller.", atOpenAccount: "Abrir cuenta",
      atNoNet: "Hace falta conexión.", atMine: "Tus talleres", atNone: "Todavía no formas parte de ningún taller.",
      atOpen: "Abrir", atBack: "Atrás", atLoading: "Cargando…",
      atCreateTitle: "Crear un taller", atName: "Nombre del taller", atSlug: "Dirección (minúsculas, cifras, guion)",
      atCreate: "Crear taller", atJoinTitle: "Tengo un código de invitación", atCode: "Código", atJoin: "Entrar",
      atRole: "Rol", role_responsabil: "Responsable", role_birou: "Oficina técnica", role_operator: "Operario", role_partener: "Socio",
      atMembers: "Miembros", atYou: "tú", atRemove: "Quitar", atLeave: "Salir del taller",
      atConfirmRemove: "¿Quitar a este miembro?", atConfirmLeave: "¿Salir de este taller?",
      atInviteTitle: "Invitar", atInviteBtn: "Crear invitación", atInviteHint: "El código vale 7 días y se usa una sola vez.",
      atStations: "Puestos", atPending: "Invitaciones pendientes", atNoPending: "No hay invitaciones pendientes.",
      atCopy: "Copiar", atCopied: "Código copiado", atDone: "Hecho",
      st_magazzino: "Almacén", st_sezionatrice: "Seccionadora", st_bordatrice: "Canteadora", st_toupie: "Tupí", st_foratura: "Taladrado", stl_sezionatrice: "Corte", stl_toupie: "Tupí", stl_bordatrice: "Canto", stl_foratura: "Taladro", stl_assemblaggio: "Montaje", atLabelStale: "El proyecto cambió después de crear el pedido: los QR de pedido no se imprimen. Actualiza el pedido antes de las etiquetas.", fsOpen: "Hojas por puesto", fsHint: "Una hoja por cada puesto del taller, en el orden en que pasa la pieza. Sin cuenta ni escaneo: todo en papel.", fsNoProject: "Abre un proyecto con piezas.", fsPieces: "{n} piezas", fsNothing: "nada que hacer aquí", fsDesc_magazzino: "Tableros, cantos y herrajes a sacar", fsDesc_sezionatrice: "Plano de corte por tablero, con los cortes, y etiquetas para pegar en las piezas", fsDesc_toupie: "Piezas con ranuras y fresados, con medidas", fsDesc_bordatrice: "Hoja de cantos: qué piezas, qué lados, qué grosor", fsDesc_foratura: "Una ficha A4 por pieza con taladros, con medidas", fsDesc_assemblaggio: "Hoja de montaje ilustrada", fsDesc_spedizione: "Acta de entrega", fsB_order: "Lista de pedido", fsB_saw: "Plano de corte", fsB_labels: "Etiquetas", fsB_router: "Hoja de tupí", fsB_edge: "Hoja de cantos", fsB_drill: "Fichas de taladrado", fsB_mont: "Hoja de montaje", fsB_hand: "Acta", fsRTitle: "HOJA DE TUPÍ — ranuras y fresados", fsRNone: "Ninguna pieza tiene ranuras ni fresados.", fsRC1: "Código", fsRC2: "Pieza", fsRC3: "Medidas", fsRC4: "Operaciones (largo × ancho × profundidad, mm)", fsCodeNote: "El código rX es el mismo del plano de corte y de la etiqueta.", fsUnits: "{n} cuerpos", fsFace: "cara", fsThrough: "pasante", fsSheets: "{n} hojas", fsB_route: "Hoja de ruta", fsDesc_route: "Una página por proyecto: cada puesto marca, fecha y firma al terminar. Se imprime primero.", fsPTitle: "HOJA DE RUTA", fsPDeadline: "Plazo", fsPUnits: "Cuerpos", fsPC1: "Puesto", fsPC2: "Piezas", fsPC3: "Hojas", fsPC4: "Inicio", fsPC5: "Fin", fsPC6: "Rúbrica", fsPIssues: "Problemas, repetidos, notas", fsPNone: "nada que hacer", fsDNone: "Ninguna pieza tiene taladros.", st_cnc: "CNC",
      st_verniciatura: "Pintura", st_assemblaggio: "Montaje", st_spedizione: "Expedición",
      err_not_authenticated: "Debes iniciar sesión.", err_slug_invalid: "Dirección no válida: minúsculas, cifras y guiones.",
      err_name_invalid: "Nombre demasiado corto.", err_slug_taken: "Esa dirección ya está en uso.",
      err_code_invalid: "Código no válido, caducado o ya usado.", err_already_member: "Ya formas parte de este taller.",
      err_not_allowed: "No tienes permiso para hacerlo.", err_last_owner: "Debe quedar al menos un responsable.",
      err_not_found: "No encontrado.", err_generic: "No ha funcionado. Inténtalo de nuevo."
    }
  };

  /* — texte E1: comenzi — */
  var JOB_TXT = {
    it: { jobsTitle: "Commesse", jobNone: "Nessuna commessa.", jobNew: "Nuova commessa dal progetto aperto",
      jobName: "Titolo", jobClient: "Cliente (etichetta)", jobDue: "Consegna", jobCreate: "Crea commessa",
      jobNoProject: "Apri prima un progetto con dei pezzi.", jobCreated: "Commessa creata (bozza)",
      jobPieces: "pezzi", jobSnapNote: "Si congelano solo i pezzi: nessun prezzo, nessun dato del cliente.",
      jobState: "Stato", state_draft: "Bozza", state_confirmed: "Confermata", state_in_progress: "In lavorazione",
      state_done: "Finita", state_shipped: "Spedita", state_installed: "Montata", state_cancelled: "Annullata",
      jobProgress: "Avanzamento", evStart: "Inizio", evDone: "Fatto", evIssue: "Problema", evSent: "Registrato",
      jobConfirmCancel: "Annullare la commessa? Non si può più cambiare.",
      err_title_invalid: "Titolo troppo corto.", err_snapshot_invalid: "Elenco pezzi non valido.",
      err_project_not_yours: "Il progetto non è tuo.", err_partner_invalid: "Partner non valido.",
      err_cancelled_final: "Commessa annullata: non si cambia più.", err_not_open: "La commessa non è aperta.",
      err_piece_unknown: "Pezzo sconosciuto.", err_client_id_required: "Richiesta non valida." },
    ro: { jobsTitle: "Comenzi", jobNone: "Nicio comandă.", jobNew: "Comandă nouă din proiectul deschis",
      jobName: "Titlu", jobClient: "Client (etichetă)", jobDue: "Termen", jobCreate: "Creează comanda",
      jobNoProject: "Deschide mai întâi un proiect cu piese.", jobCreated: "Comandă creată (ciornă)",
      jobPieces: "piese", jobSnapNote: "Se îngheață doar piesele: fără prețuri, fără datele clientului.",
      jobState: "Stare", state_draft: "Ciornă", state_confirmed: "Confirmată", state_in_progress: "În lucru",
      state_done: "Terminată", state_shipped: "Expediată", state_installed: "Montată", state_cancelled: "Anulată",
      jobProgress: "Progres", evStart: "Început", evDone: "Gata", evIssue: "Problemă", evSent: "Înregistrat",
      jobConfirmCancel: "Anulezi comanda? Nu se mai poate schimba.",
      err_title_invalid: "Titlu prea scurt.", err_snapshot_invalid: "Lista de piese nu e validă.",
      err_project_not_yours: "Proiectul nu e al tău.", err_partner_invalid: "Partener nevalid.",
      err_cancelled_final: "Comandă anulată: nu se mai schimbă.", err_not_open: "Comanda nu e deschisă.",
      err_piece_unknown: "Piesă necunoscută.", err_client_id_required: "Cerere nevalidă." },
    en: { jobsTitle: "Jobs", jobNone: "No jobs.", jobNew: "New job from the open project",
      jobName: "Title", jobClient: "Client (label)", jobDue: "Due", jobCreate: "Create job",
      jobNoProject: "Open a project with pieces first.", jobCreated: "Job created (draft)",
      jobPieces: "pieces", jobSnapNote: "Only the pieces are frozen: no prices, no client data.",
      jobState: "State", state_draft: "Draft", state_confirmed: "Confirmed", state_in_progress: "In progress",
      state_done: "Done", state_shipped: "Shipped", state_installed: "Installed", state_cancelled: "Cancelled",
      jobProgress: "Progress", evStart: "Start", evDone: "Done", evIssue: "Issue", evSent: "Recorded",
      jobConfirmCancel: "Cancel the job? It can't be changed afterwards.",
      err_title_invalid: "Title too short.", err_snapshot_invalid: "Invalid piece list.",
      err_project_not_yours: "This project is not yours.", err_partner_invalid: "Invalid partner.",
      err_cancelled_final: "Job cancelled: it can't change any more.", err_not_open: "The job is not open.",
      err_piece_unknown: "Unknown piece.", err_client_id_required: "Invalid request." },
    fr: { jobsTitle: "Commandes", jobNone: "Aucune commande.", jobNew: "Nouvelle commande depuis le projet ouvert",
      jobName: "Titre", jobClient: "Client (étiquette)", jobDue: "Échéance", jobCreate: "Créer la commande",
      jobNoProject: "Ouvrez d'abord un projet avec des pièces.", jobCreated: "Commande créée (brouillon)",
      jobPieces: "pièces", jobSnapNote: "Seules les pièces sont figées : ni prix, ni données du client.",
      jobState: "État", state_draft: "Brouillon", state_confirmed: "Confirmée", state_in_progress: "En cours",
      state_done: "Terminée", state_shipped: "Expédiée", state_installed: "Posée", state_cancelled: "Annulée",
      jobProgress: "Avancement", evStart: "Début", evDone: "Fait", evIssue: "Problème", evSent: "Enregistré",
      jobConfirmCancel: "Annuler la commande ? Elle ne pourra plus changer.",
      err_title_invalid: "Titre trop court.", err_snapshot_invalid: "Liste de pièces invalide.",
      err_project_not_yours: "Ce projet n'est pas le vôtre.", err_partner_invalid: "Partenaire invalide.",
      err_cancelled_final: "Commande annulée : elle ne change plus.", err_not_open: "La commande n'est pas ouverte.",
      err_piece_unknown: "Pièce inconnue.", err_client_id_required: "Requête invalide." },
    de: { jobsTitle: "Aufträge", jobNone: "Keine Aufträge.", jobNew: "Neuer Auftrag aus dem offenen Projekt",
      jobName: "Titel", jobClient: "Kunde (Bezeichnung)", jobDue: "Termin", jobCreate: "Auftrag anlegen",
      jobNoProject: "Öffne zuerst ein Projekt mit Teilen.", jobCreated: "Auftrag angelegt (Entwurf)",
      jobPieces: "Teile", jobSnapNote: "Eingefroren werden nur die Teile: keine Preise, keine Kundendaten.",
      jobState: "Status", state_draft: "Entwurf", state_confirmed: "Bestätigt", state_in_progress: "In Arbeit",
      state_done: "Fertig", state_shipped: "Versendet", state_installed: "Montiert", state_cancelled: "Storniert",
      jobProgress: "Fortschritt", evStart: "Start", evDone: "Fertig", evIssue: "Problem", evSent: "Erfasst",
      jobConfirmCancel: "Auftrag stornieren? Danach lässt er sich nicht mehr ändern.",
      err_title_invalid: "Titel zu kurz.", err_snapshot_invalid: "Teileliste ungültig.",
      err_project_not_yours: "Das Projekt gehört dir nicht.", err_partner_invalid: "Ungültiger Partner.",
      err_cancelled_final: "Auftrag storniert: keine Änderung mehr.", err_not_open: "Der Auftrag ist nicht offen.",
      err_piece_unknown: "Unbekanntes Teil.", err_client_id_required: "Ungültige Anfrage." },
    pl: { jobsTitle: "Zlecenia", jobNone: "Brak zleceń.", jobNew: "Nowe zlecenie z otwartego projektu",
      jobName: "Tytuł", jobClient: "Klient (etykieta)", jobDue: "Termin", jobCreate: "Utwórz zlecenie",
      jobNoProject: "Najpierw otwórz projekt z elementami.", jobCreated: "Zlecenie utworzone (szkic)",
      jobPieces: "elementy", jobSnapNote: "Zamrażane są tylko elementy: bez cen i danych klienta.",
      jobState: "Status", state_draft: "Szkic", state_confirmed: "Potwierdzone", state_in_progress: "W toku",
      state_done: "Gotowe", state_shipped: "Wysłane", state_installed: "Zamontowane", state_cancelled: "Anulowane",
      jobProgress: "Postęp", evStart: "Start", evDone: "Gotowe", evIssue: "Problem", evSent: "Zapisano",
      jobConfirmCancel: "Anulować zlecenie? Nie będzie można go już zmienić.",
      err_title_invalid: "Tytuł zbyt krótki.", err_snapshot_invalid: "Nieprawidłowa lista elementów.",
      err_project_not_yours: "To nie jest twój projekt.", err_partner_invalid: "Nieprawidłowy partner.",
      err_cancelled_final: "Zlecenie anulowane: nie można go już zmienić.", err_not_open: "Zlecenie nie jest otwarte.",
      err_piece_unknown: "Nieznany element.", err_client_id_required: "Nieprawidłowe żądanie." },
    es: { jobsTitle: "Pedidos", jobNone: "Ningún pedido.", jobNew: "Nuevo pedido desde el proyecto abierto",
      jobName: "Título", jobClient: "Cliente (etiqueta)", jobDue: "Entrega", jobCreate: "Crear pedido",
      jobNoProject: "Abre primero un proyecto con piezas.", jobCreated: "Pedido creado (borrador)",
      jobPieces: "piezas", jobSnapNote: "Solo se congelan las piezas: sin precios ni datos del cliente.",
      jobState: "Estado", state_draft: "Borrador", state_confirmed: "Confirmado", state_in_progress: "En curso",
      state_done: "Terminado", state_shipped: "Enviado", state_installed: "Montado", state_cancelled: "Cancelado",
      jobProgress: "Avance", evStart: "Inicio", evDone: "Hecho", evIssue: "Problema", evSent: "Registrado",
      jobConfirmCancel: "¿Cancelar el pedido? Ya no se podrá cambiar.",
      err_title_invalid: "Título demasiado corto.", err_snapshot_invalid: "Lista de piezas no válida.",
      err_project_not_yours: "Este proyecto no es tuyo.", err_partner_invalid: "Socio no válido.",
      err_cancelled_final: "Pedido cancelado: ya no cambia.", err_not_open: "El pedido no está abierto.",
      err_piece_unknown: "Pieza desconocida.", err_client_id_required: "Solicitud no válida." }
  };
  /* — texte E2 — */
  var SCAN_TXT = {
    it: { scanDetails: "Dettagli pezzo e fori", scanBtn: "Scansiona etichetta", scanTitle: "Pezzo", scanPaste: "Incolla il codice dell'etichetta", scanGo: "Apri",
      scanNoCam: "Fotocamera non disponibile: usa la fotocamera del telefono sull'etichetta, oppure incolla il codice.",
      scanBad: "Codice non riconosciuto.", scanNotFound: "Commessa o pezzo non trovati (o la commessa non è aperta).",
      scanStation: "Postazione", scanNoStation: "Nessuna postazione assegnata.", scanDoneAt: "già fatto",
      evQueued: "Salvato offline: parte appena torna la connessione.", qPending: "in attesa di invio", qSent: "Inviati",
      scanLogin: "Accedi per registrare i pezzi." },
    ro: { scanDetails: "Detalii piesă și găuri", scanBtn: "Scanează eticheta", scanTitle: "Piesă", scanPaste: "Lipește codul de pe etichetă", scanGo: "Deschide",
      scanNoCam: "Camera nu e disponibilă: folosește camera telefonului pe etichetă sau lipește codul.",
      scanBad: "Cod nerecunoscut.", scanNotFound: "Comanda sau piesa nu s-au găsit (sau comanda nu e deschisă).",
      scanStation: "Post de lucru", scanNoStation: "Nicio postazione atribuită.", scanDoneAt: "deja gata",
      evQueued: "Salvat offline: pleacă imediat ce revine conexiunea.", qPending: "în așteptare", qSent: "Trimise",
      scanLogin: "Conectează-te ca să înregistrezi piesele." },
    en: { scanDetails: "Piece details and holes", scanBtn: "Scan label", scanTitle: "Piece", scanPaste: "Paste the label code", scanGo: "Open",
      scanNoCam: "Camera not available: point the phone camera at the label, or paste the code.",
      scanBad: "Code not recognised.", scanNotFound: "Job or piece not found (or the job is not open).",
      scanStation: "Station", scanNoStation: "No station assigned.", scanDoneAt: "already done",
      evQueued: "Saved offline: it will be sent when the connection returns.", qPending: "waiting to send", qSent: "Sent",
      scanLogin: "Sign in to record pieces." },
    fr: { scanDetails: "Détails de la pièce et perçages", scanBtn: "Scanner l'étiquette", scanTitle: "Pièce", scanPaste: "Collez le code de l'étiquette", scanGo: "Ouvrir",
      scanNoCam: "Caméra indisponible : pointez l'appareil photo du téléphone sur l'étiquette, ou collez le code.",
      scanBad: "Code non reconnu.", scanNotFound: "Commande ou pièce introuvable (ou commande non ouverte).",
      scanStation: "Poste", scanNoStation: "Aucun poste attribué.", scanDoneAt: "déjà fait",
      evQueued: "Enregistré hors ligne : envoi dès le retour de la connexion.", qPending: "en attente d'envoi", qSent: "Envoyés",
      scanLogin: "Connectez-vous pour enregistrer les pièces." },
    de: { scanDetails: "Teildetails und Bohrungen", scanBtn: "Etikett scannen", scanTitle: "Teil", scanPaste: "Etikett-Code einfügen", scanGo: "Öffnen",
      scanNoCam: "Kamera nicht verfügbar: Handykamera auf das Etikett richten oder den Code einfügen.",
      scanBad: "Code nicht erkannt.", scanNotFound: "Auftrag oder Teil nicht gefunden (oder Auftrag nicht offen).",
      scanStation: "Station", scanNoStation: "Keine Station zugewiesen.", scanDoneAt: "schon erledigt",
      evQueued: "Offline gespeichert: wird gesendet, sobald die Verbindung zurück ist.", qPending: "wartet auf Versand", qSent: "Gesendet",
      scanLogin: "Melde dich an, um Teile zu erfassen." },
    pl: { scanDetails: "Szczegóły części i otwory", scanBtn: "Skanuj etykietę", scanTitle: "Element", scanPaste: "Wklej kod z etykiety", scanGo: "Otwórz",
      scanNoCam: "Kamera niedostępna: skieruj aparat telefonu na etykietę lub wklej kod.",
      scanBad: "Nierozpoznany kod.", scanNotFound: "Nie znaleziono zlecenia lub elementu (albo zlecenie nie jest otwarte).",
      scanStation: "Stanowisko", scanNoStation: "Brak przypisanego stanowiska.", scanDoneAt: "już zrobione",
      evQueued: "Zapisano offline: zostanie wysłane po powrocie połączenia.", qPending: "czeka na wysłanie", qSent: "Wysłano",
      scanLogin: "Zaloguj się, aby rejestrować elementy." },
    es: { scanDetails: "Detalles de la pieza y taladros", scanBtn: "Escanear etiqueta", scanTitle: "Pieza", scanPaste: "Pega el código de la etiqueta", scanGo: "Abrir",
      scanNoCam: "Cámara no disponible: apunta la cámara del móvil a la etiqueta o pega el código.",
      scanBad: "Código no reconocido.", scanNotFound: "Pedido o pieza no encontrados (o el pedido no está abierto).",
      scanStation: "Puesto", scanNoStation: "Ningún puesto asignado.", scanDoneAt: "ya hecho",
      evQueued: "Guardado sin conexión: se enviará cuando vuelva la conexión.", qPending: "pendiente de envío", qSent: "Enviados",
      scanLogin: "Inicia sesión para registrar piezas." }
  };
  Object.keys(SCAN_TXT).forEach(function (l) { Object.assign(I18N[l], SCAN_TXT[l]); });

  /* — texte E3 — */
  var DOC_TXT = {
    it: { docsTitle: "Documenti per postazione", docsNeedProject: "Apri un progetto con dei pezzi per stampare i documenti.",
      docEdgeBtn: "Foglio bordatrice", docPaintBtn: "Elenco verniciatura",
      docEdgeTitle: "Bordatrice: bordi per pezzo", docPaintTitle: "Verniciatura: pannelli MDF",
      docEdgeNone: "Nessun pezzo con bordo in questo progetto.", docPaintNone: "Nessun pannello in MDF in questo progetto.",
      docEdgeOf: "Bordo", docEdgeTh: "spessore", docMl: "ml", docReserve: "con +10%", docCode: "Cod.", docPiece: "Pezzo",
      docDim: "Misura", docQty: "Pz", docSides: "Lati", docEdgeMl: "Bordo (ml)", docPaintColor: "Colore / finitura", docArea: "m² (due facce)",
      docPaintNote: "Anche i bordi dell'MDF si stuccano e si verniciano: la superficie indicata conta solo le facce.",
      docCodeNote: "Il codice corrisponde a quello dell'etichetta (QR)." },
    ro: { docsTitle: "Documente pe postazione", docsNeedProject: "Deschide un proiect cu piese ca să tipărești documentele.",
      docEdgeBtn: "Foaie bordatrice", docPaintBtn: "Listă vopsitorie",
      docEdgeTitle: "Bordatrice: cant pe piesă", docPaintTitle: "Vopsitorie: panouri MDF",
      docEdgeNone: "Nicio piesă cu cant în acest proiect.", docPaintNone: "Niciun panou din MDF în acest proiect.",
      docEdgeOf: "Cant", docEdgeTh: "grosime", docMl: "ml", docReserve: "cu +10%", docCode: "Cod", docPiece: "Piesă",
      docDim: "Cotă", docQty: "Buc", docSides: "Laturi", docEdgeMl: "Cant (ml)", docPaintColor: "Culoare / finisaj", docArea: "m² (două fețe)",
      docPaintNote: "Și canturile MDF-ului se chitează și se vopsesc: suprafața indicată numără doar fețele.",
      docCodeNote: "Codul e cel de pe etichetă (QR)." },
    en: { docsTitle: "Station documents", docsNeedProject: "Open a project with pieces to print the documents.",
      docEdgeBtn: "Edge bander sheet", docPaintBtn: "Paint shop list",
      docEdgeTitle: "Edge bander: banding per piece", docPaintTitle: "Paint shop: MDF panels",
      docEdgeNone: "No piece with edge banding in this project.", docPaintNone: "No MDF panel in this project.",
      docEdgeOf: "Edge", docEdgeTh: "thickness", docMl: "m", docReserve: "with +10%", docCode: "Code", docPiece: "Piece",
      docDim: "Size", docQty: "Qty", docSides: "Sides", docEdgeMl: "Edge (m)", docPaintColor: "Colour / finish", docArea: "m² (two faces)",
      docPaintNote: "MDF edges are also filled and painted: the area shown counts the faces only.",
      docCodeNote: "The code matches the label (QR)." },
    fr: { docsTitle: "Documents par poste", docsNeedProject: "Ouvrez un projet avec des pièces pour imprimer les documents.",
      docEdgeBtn: "Feuille plaqueuse", docPaintBtn: "Liste peinture",
      docEdgeTitle: "Plaqueuse de chants : chants par pièce", docPaintTitle: "Peinture : panneaux MDF",
      docEdgeNone: "Aucune pièce avec chant dans ce projet.", docPaintNone: "Aucun panneau MDF dans ce projet.",
      docEdgeOf: "Chant", docEdgeTh: "épaisseur", docMl: "ml", docReserve: "avec +10 %", docCode: "Code", docPiece: "Pièce",
      docDim: "Cote", docQty: "Qté", docSides: "Côtés", docEdgeMl: "Chant (ml)", docPaintColor: "Couleur / finition", docArea: "m² (deux faces)",
      docPaintNote: "Les chants du MDF se bouchent et se peignent aussi : la surface indiquée ne compte que les faces.",
      docCodeNote: "Le code correspond à celui de l'étiquette (QR)." },
    de: { docsTitle: "Dokumente je Station", docsNeedProject: "Öffne ein Projekt mit Teilen, um die Dokumente zu drucken.",
      docEdgeBtn: "Blatt Kantenanleimer", docPaintBtn: "Liste Lackiererei",
      docEdgeTitle: "Kantenanleimmaschine: Kanten je Teil", docPaintTitle: "Lackiererei: MDF-Platten",
      docEdgeNone: "Kein Teil mit Kante in diesem Projekt.", docPaintNone: "Keine MDF-Platte in diesem Projekt.",
      docEdgeOf: "Kante", docEdgeTh: "Stärke", docMl: "lfm", docReserve: "mit +10 %", docCode: "Code", docPiece: "Teil",
      docDim: "Maß", docQty: "Stk", docSides: "Seiten", docEdgeMl: "Kante (lfm)", docPaintColor: "Farbe / Oberfläche", docArea: "m² (zwei Flächen)",
      docPaintNote: "Auch die MDF-Kanten werden gespachtelt und lackiert: die Fläche zählt nur die Flächen.",
      docCodeNote: "Der Code entspricht dem auf dem Etikett (QR)." },
    pl: { docsTitle: "Dokumenty dla stanowisk", docsNeedProject: "Otwórz projekt z elementami, aby wydrukować dokumenty.",
      docEdgeBtn: "Arkusz okleiniarki", docPaintBtn: "Lista lakierni",
      docEdgeTitle: "Okleiniarka: okleina na element", docPaintTitle: "Lakiernia: płyty MDF",
      docEdgeNone: "Brak elementów z okleiną w tym projekcie.", docPaintNone: "Brak płyt MDF w tym projekcie.",
      docEdgeOf: "Okleina", docEdgeTh: "grubość", docMl: "mb", docReserve: "z +10%", docCode: "Kod", docPiece: "Element",
      docDim: "Wymiar", docQty: "Szt", docSides: "Boki", docEdgeMl: "Okleina (mb)", docPaintColor: "Kolor / wykończenie", docArea: "m² (dwie strony)",
      docPaintNote: "Krawędzie MDF też się szpachluje i maluje: podana powierzchnia liczy tylko strony.",
      docCodeNote: "Kod odpowiada kodowi z etykiety (QR)." },
    es: { docsTitle: "Documentos por puesto", docsNeedProject: "Abre un proyecto con piezas para imprimir los documentos.",
      docEdgeBtn: "Hoja de canteadora", docPaintBtn: "Lista de pintura",
      docEdgeTitle: "Canteadora: cantos por pieza", docPaintTitle: "Pintura: paneles MDF",
      docEdgeNone: "Ninguna pieza con canto en este proyecto.", docPaintNone: "Ningún panel MDF en este proyecto.",
      docEdgeOf: "Canto", docEdgeTh: "grosor", docMl: "ml", docReserve: "con +10 %", docCode: "Cód.", docPiece: "Pieza",
      docDim: "Medida", docQty: "Ud", docSides: "Lados", docEdgeMl: "Canto (ml)", docPaintColor: "Color / acabado", docArea: "m² (dos caras)",
      docPaintNote: "Los cantos del MDF también se masillan y se pintan: la superficie indicada cuenta solo las caras.",
      docCodeNote: "El código coincide con el de la etiqueta (QR)." }
  };
  Object.keys(DOC_TXT).forEach(function (l) { Object.assign(I18N[l], DOC_TXT[l]); });

  /* — Setări: funcții în probă — */
  var EXP_TXT = {
    it: { expTitle: "Funzioni in prova", expAtelier: "Modulo Atelier",
      expAtelierHint: "Per officine: commesse, scansione etichette, documenti per postazione. In prova, non fa parte di Pro. Poi compare in Account, dopo l'accesso." },
    ro: { expTitle: "Funcții în probă", expAtelier: "Modul Atelier",
      expAtelierHint: "Pentru ateliere: comenzi, scanare etichete, documente pe postazione. În probă, nu face parte din Pro. Apoi apare în Cont, după login." },
    en: { expTitle: "Trial features", expAtelier: "Workshop module",
      expAtelierHint: "For workshops: jobs, label scanning, station documents. Trial, not part of Pro. It then appears in Account, after sign-in." },
    fr: { expTitle: "Fonctions en test", expAtelier: "Module Atelier",
      expAtelierHint: "Pour les ateliers : commandes, scan d'étiquettes, documents par poste. En test, ne fait pas partie de Pro. Il apparaît ensuite dans Compte, après connexion." },
    de: { expTitle: "Testfunktionen", expAtelier: "Werkstatt-Modul",
      expAtelierHint: "Für Werkstätten: Aufträge, Etiketten scannen, Dokumente je Station. Test, nicht Teil von Pro. Erscheint danach unter Konto, nach der Anmeldung." },
    pl: { expTitle: "Funkcje testowe", expAtelier: "Moduł Warsztat",
      expAtelierHint: "Dla warsztatów: zlecenia, skanowanie etykiet, dokumenty dla stanowisk. Test, nie należy do Pro. Potem pojawia się w Koncie, po zalogowaniu." },
    es: { expTitle: "Funciones en prueba", expAtelier: "Módulo Taller",
      expAtelierHint: "Para talleres: pedidos, escaneo de etiquetas, documentos por puesto. En prueba, no forma parte de Pro. Luego aparece en Cuenta, tras iniciar sesión." }
  };
  Object.keys(EXP_TXT).forEach(function (l) { Object.assign(I18N[l], EXP_TXT[l]); });

  /* — texte E4 — */
  var AGG_TXT = {
    it: { aggPick: "Includi nell'ordine aggregato", aggBtn: "Ordine aggregato (commesse spuntate)",
      aggNone: "Spunta almeno una commessa aperta.", aggTitle: "Ordine fornitore aggregato", aggJobs: "Commesse incluse",
      aggSeparate: "Separato", aggTogether: "Insieme", aggFromStock: "Da magazzino", aggToOrder: "Da ordinare",
      aggSaved: "Pannelli risparmiati ordinando insieme (senza magazzino)",
      aggNoteHw: "La ferramenta non è inclusa: si ordina dai progetti.",
      aggNoteShape: "Il bordo dei pezzi sagomati (angoli, curve) è calcolato sul rettangolo.",
      aggNoteStock: "I ritagli di magazzino sono quelli di questo dispositivo." },
    ro: { aggPick: "Include în comanda agregată", aggBtn: "Comandă agregată (comenzile bifate)",
      aggNone: "Bifează cel puțin o comandă deschisă.", aggTitle: "Comandă furnizor agregată", aggJobs: "Comenzi incluse",
      aggSeparate: "Separat", aggTogether: "Împreună", aggFromStock: "Din stoc", aggToOrder: "De comandat",
      aggSaved: "Panouri economisite comandând împreună (fără stoc)",
      aggNoteHw: "Feroneria nu e inclusă: se comandă din proiecte.",
      aggNoteShape: "Cantul pieselor profilate (colțuri, curbe) e socotit pe dreptunghi.",
      aggNoteStock: "Resturile din stoc sunt cele de pe acest dispozitiv." },
    en: { aggPick: "Include in the combined order", aggBtn: "Combined order (ticked jobs)",
      aggNone: "Tick at least one open job.", aggTitle: "Combined supplier order", aggJobs: "Jobs included",
      aggSeparate: "Separate", aggTogether: "Together", aggFromStock: "From stock", aggToOrder: "To order",
      aggSaved: "Panels saved by ordering together (ignoring stock)",
      aggNoteHw: "Hardware is not included: it is ordered from the projects.",
      aggNoteShape: "Edge banding of shaped pieces (corners, curves) is counted on the rectangle.",
      aggNoteStock: "Offcut stock is the one on this device." },
    fr: { aggPick: "Inclure dans la commande groupée", aggBtn: "Commande groupée (commandes cochées)",
      aggNone: "Cochez au moins une commande ouverte.", aggTitle: "Commande fournisseur groupée", aggJobs: "Commandes incluses",
      aggSeparate: "Séparé", aggTogether: "Ensemble", aggFromStock: "En stock", aggToOrder: "À commander",
      aggSaved: "Panneaux économisés en commandant ensemble (hors stock)",
      aggNoteHw: "La quincaillerie n'est pas incluse : elle se commande depuis les projets.",
      aggNoteShape: "Le chant des pièces profilées (angles, courbes) est calculé sur le rectangle.",
      aggNoteStock: "Les chutes en stock sont celles de cet appareil." },
    de: { aggPick: "In die Sammelbestellung aufnehmen", aggBtn: "Sammelbestellung (angekreuzte Aufträge)",
      aggNone: "Kreuze mindestens einen offenen Auftrag an.", aggTitle: "Sammelbestellung Lieferant", aggJobs: "Enthaltene Aufträge",
      aggSeparate: "Einzeln", aggTogether: "Zusammen", aggFromStock: "Aus Lager", aggToOrder: "Zu bestellen",
      aggSaved: "Eingesparte Platten bei gemeinsamer Bestellung (ohne Lager)",
      aggNoteHw: "Beschläge sind nicht enthalten: sie werden aus den Projekten bestellt.",
      aggNoteShape: "Die Kante geformter Teile (Ecken, Kurven) wird am Rechteck berechnet.",
      aggNoteStock: "Der Restebestand ist der auf diesem Gerät." },
    pl: { aggPick: "Dołącz do zamówienia zbiorczego", aggBtn: "Zamówienie zbiorcze (zaznaczone zlecenia)",
      aggNone: "Zaznacz co najmniej jedno otwarte zlecenie.", aggTitle: "Zbiorcze zamówienie u dostawcy", aggJobs: "Uwzględnione zlecenia",
      aggSeparate: "Osobno", aggTogether: "Razem", aggFromStock: "Ze stanu", aggToOrder: "Do zamówienia",
      aggSaved: "Płyty zaoszczędzone przez wspólne zamówienie (bez stanu)",
      aggNoteHw: "Okucia nie są uwzględnione: zamawia się je z projektów.",
      aggNoteShape: "Okleina elementów kształtowych (narożniki, krzywe) liczona jest po prostokącie.",
      aggNoteStock: "Resztki ze stanu są te z tego urządzenia." },
    es: { aggPick: "Incluir en el pedido agrupado", aggBtn: "Pedido agrupado (pedidos marcados)",
      aggNone: "Marca al menos un pedido abierto.", aggTitle: "Pedido agrupado al proveedor", aggJobs: "Pedidos incluidos",
      aggSeparate: "Por separado", aggTogether: "Juntos", aggFromStock: "De stock", aggToOrder: "A pedir",
      aggSaved: "Paneles ahorrados pidiendo juntos (sin stock)",
      aggNoteHw: "La herrajería no está incluida: se pide desde los proyectos.",
      aggNoteShape: "El canto de las piezas con forma (esquinas, curvas) se calcula sobre el rectángulo.",
      aggNoteStock: "Los retales en stock son los de este dispositivo." }
  };
  Object.keys(AGG_TXT).forEach(function (l) { Object.assign(I18N[l], AGG_TXT[l]); });

  /* — texte plan de tăiere (sezionatrice) — */
  var SAW_TXT = {
    it: { docSawBtn: "Piano sezionatrice (QR)", docSawTitle: "Sezionatrice: piano di taglio", docSawPanel: "Pannello", docSawCuts: "Ordine dei tagli",
      docSawNoLink: "Nessuna commessa collegata a questo progetto (o il progetto è cambiato): i codici ci sono, ma senza QR. Crea la commessa da questo progetto.",
      docSawPcs: "Pezzi su questo pannello", docSawNone: "Nessun pannello da tagliare in questo progetto." },
    ro: { docSawBtn: "Plan sezionatrice (QR)", docSawTitle: "Sezionatrice: plan de tăiere", docSawPanel: "Panou", docSawCuts: "Ordinea tăierilor",
      docSawNoLink: "Nicio comandă legată de acest proiect (sau proiectul s-a schimbat): codurile apar, dar fără QR. Creează comanda din acest proiect.",
      docSawPcs: "Piese pe acest panou", docSawNone: "Niciun panou de tăiat în acest proiect." },
    en: { docSawBtn: "Panel saw plan (QR)", docSawTitle: "Panel saw: cutting plan", docSawPanel: "Panel", docSawCuts: "Cut order",
      docSawNoLink: "No job linked to this project (or the project changed): the codes show, but without QR. Create the job from this project.",
      docSawPcs: "Pieces on this panel", docSawNone: "No panel to cut in this project." },
    fr: { docSawBtn: "Plan scie à panneaux (QR)", docSawTitle: "Scie à panneaux : plan de coupe", docSawPanel: "Panneau", docSawCuts: "Ordre des coupes",
      docSawNoLink: "Aucune commande liée à ce projet (ou le projet a changé) : les codes y sont, mais sans QR. Créez la commande depuis ce projet.",
      docSawPcs: "Pièces sur ce panneau", docSawNone: "Aucun panneau à couper dans ce projet." },
    de: { docSawBtn: "Plattensägeplan (QR)", docSawTitle: "Plattensäge: Zuschnittplan", docSawPanel: "Platte", docSawCuts: "Schnittfolge",
      docSawNoLink: "Kein Auftrag mit diesem Projekt verknüpft (oder das Projekt hat sich geändert): die Codes stehen da, aber ohne QR. Lege den Auftrag aus diesem Projekt an.",
      docSawPcs: "Teile auf dieser Platte", docSawNone: "Keine Platte zum Zuschneiden in diesem Projekt." },
    pl: { docSawBtn: "Plan piły formatowej (QR)", docSawTitle: "Piła formatowa: plan cięcia", docSawPanel: "Płyta", docSawCuts: "Kolejność cięć",
      docSawNoLink: "Żadne zlecenie nie jest powiązane z tym projektem (albo projekt się zmienił): kody są, ale bez QR. Utwórz zlecenie z tego projektu.",
      docSawPcs: "Elementy na tej płycie", docSawNone: "Brak płyt do cięcia w tym projekcie." },
    es: { docSawBtn: "Plan de seccionadora (QR)", docSawTitle: "Seccionadora: plan de corte", docSawPanel: "Panel", docSawCuts: "Orden de los cortes",
      docSawNoLink: "Ningún pedido vinculado a este proyecto (o el proyecto cambió): los códigos aparecen, pero sin QR. Crea el pedido desde este proyecto.",
      docSawPcs: "Piezas en este panel", docSawNone: "Ningún panel que cortar en este proyecto." }
  };
  Object.keys(SAW_TXT).forEach(function (l) { Object.assign(I18N[l], SAW_TXT[l]); });

  /* — texte panou de birou — */
  var BOARD_TXT = {
    it: { boardTitle: "Pannello", boardNone: "Nessuna commessa aperta.", boardOverdue: "in ritardo", boardLate: "{n} g di ritardo",
      boardIdle: "fermo da {h} h", boardNotStarted: "non iniziata", boardStagnant: "ferme", boardOpen: "aperte",
      boardQueue: "In lavorazione per postazione", boardLegend: "✓ fatto · % in lavorazione · ⚠ problemi · — non iniziato" },
    ro: { boardTitle: "Panou", boardNone: "Nicio comandă deschisă.", boardOverdue: "întârziate", boardLate: "{n} z întârziere",
      boardIdle: "fără mișcare de {h} h", boardNotStarted: "neînceput", boardStagnant: "stagnante", boardOpen: "deschise",
      boardQueue: "În lucru pe postazione", boardLegend: "✓ gata · % în lucru · ⚠ probleme · — neînceput" },
    en: { boardTitle: "Board", boardNone: "No open jobs.", boardOverdue: "overdue", boardLate: "{n} d late",
      boardIdle: "no movement for {h} h", boardNotStarted: "not started", boardStagnant: "stalled", boardOpen: "open",
      boardQueue: "In progress per station", boardLegend: "✓ done · % in progress · ⚠ issues · — not started" },
    fr: { boardTitle: "Tableau", boardNone: "Aucune commande ouverte.", boardOverdue: "en retard", boardLate: "{n} j de retard",
      boardIdle: "immobile depuis {h} h", boardNotStarted: "non commencée", boardStagnant: "à l'arrêt", boardOpen: "ouvertes",
      boardQueue: "En cours par poste", boardLegend: "✓ fait · % en cours · ⚠ problèmes · — non commencé" },
    de: { boardTitle: "Tafel", boardNone: "Keine offenen Aufträge.", boardOverdue: "überfällig", boardLate: "{n} T überfällig",
      boardIdle: "seit {h} Std. ohne Bewegung", boardNotStarted: "nicht begonnen", boardStagnant: "stillstehend", boardOpen: "offen",
      boardQueue: "In Arbeit je Station", boardLegend: "✓ fertig · % in Arbeit · ⚠ Probleme · — nicht begonnen" },
    pl: { boardTitle: "Tablica", boardNone: "Brak otwartych zleceń.", boardOverdue: "opóźnione", boardLate: "{n} d opóźnienia",
      boardIdle: "bez ruchu od {h} godz.", boardNotStarted: "nierozpoczęte", boardStagnant: "stoją", boardOpen: "otwarte",
      boardQueue: "W toku na stanowisku", boardLegend: "✓ gotowe · % w toku · ⚠ problemy · — nierozpoczęte" },
    es: { boardTitle: "Panel", boardNone: "Ningún pedido abierto.", boardOverdue: "atrasados", boardLate: "{n} d de retraso",
      boardIdle: "sin movimiento desde hace {h} h", boardNotStarted: "sin empezar", boardStagnant: "detenidos", boardOpen: "abiertos",
      boardQueue: "En curso por puesto", boardLegend: "✓ hecho · % en curso · ⚠ problemas · — sin empezar" }
  };
  Object.keys(BOARD_TXT).forEach(function (l) { Object.assign(I18N[l], BOARD_TXT[l]); });
  Object.keys(JOB_TXT).forEach(function (l) { Object.assign(I18N[l], JOB_TXT[l]); });

  function t(lang, key) { return (I18N[lang] || I18N.it)[key] || I18N.it[key] || key; }

  /* Pornirea din Setări (aplicația Android nu are bară de adresă): aceeași cheie ca ?atelier=1 */
  function setFlag(win, on) {
    try {
      if (on) win.localStorage.setItem("ebAtelier", "1"); else win.localStorage.removeItem("ebAtelier");
      return win.localStorage.getItem("ebAtelier") === "1";
    } catch (e) { return false; }
  }
  function hasFlag(win) { try { return win.localStorage.getItem("ebAtelier") === "1"; } catch (e) { return false; } }

  /* flag E0: ?atelier=1 lo pornește (și rămâne), ?atelier=0 îl oprește */
  function flagOn(win) {
    try {
      var q = new URLSearchParams(win.location.search).get("atelier");
      /* un cod de piesă scanat cu camera telefonului pornește modul pe acel dispozitiv */
      if (q == null && parseScan(String(win.location.hash || "").replace(/^#/, ""))) q = "1";
      if (q === "1") win.localStorage.setItem("ebAtelier", "1");
      else if (q === "0") win.localStorage.removeItem("ebAtelier");
      return win.localStorage.getItem("ebAtelier") === "1";
    } catch (e) { return false; }
  }

  return { trimPart: trimPart, scanModel: scanModel, boardModel: boardModel, snapshotRows: snapshotRows, setFlag: setFlag, hasFlag: hasFlag, edgeGroups: edgeGroups, paintGroups: paintGroups, qrUrl: qrUrl, parseScan: parseScan, rowSig: rowSig, qAdd: qAdd, qFresh: qFresh, qIsPermanent: qIsPermanent,
           JOB_STATES: JOB_STATES, JOB_EVENTS: JOB_EVENTS, buildSnapshot: buildSnapshot,
           ROLES: ROLES, STATIONS: STATIONS, STATIONS_ALL: STATIONS_ALL, STATIONS_LATER: STATIONS_LATER, labelRoute: labelRoute, CAPS: CAPS, can: can, isSlug: isSlug, slugify: slugify,
           normCode: normCode, fmtCode: fmtCode, errKey: errKey, I18N: I18N, t: t, flagOn: flagOn };
});
