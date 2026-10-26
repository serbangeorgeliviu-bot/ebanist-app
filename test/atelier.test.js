/* Modul Atelier E0 (D-92): partea pură — roluri, slug, cod de invitație, texte în 7 limbi.
   Rulează: cd test && node --test atelier.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm"), fs = require("node:fs"), path = require("node:path");
/* ca restul modulelor din app/ (fișiere de browser), se încarcă într-un context izolat */
const ctx = vm.createContext({ URLSearchParams });
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-atelier.js"), "utf8"), ctx);
const A = ctx.EBAtelier;

const LANGS = ["it", "ro", "en", "fr", "de", "pl", "es"];
/* codurile pe care le ridică migrarea 1.5 (`raise exception 'atelier:<cod>'`) */
const SERVER_ERRORS = ["not_authenticated", "slug_invalid", "name_invalid", "slug_taken", "code_invalid",
  "already_member", "not_allowed", "last_owner", "not_found"];

test("rolurile și postazioanele sunt cele din specificație", () => {
  assert.deepEqual([...A.ROLES], ["responsabil", "birou", "operator", "partener"]);
  assert.deepEqual([...A.STATIONS], ["magazzino", "sezionatrice", "bordatrice", "cnc", "verniciatura", "assemblaggio", "spedizione"]);
});

test("aceleași chei de text în toate cele 7 limbi, fără valori goale", () => {
  const ref = Object.keys(A.I18N.it).sort();
  for (const l of LANGS) {
    assert.ok(A.I18N[l], "lipsește limba " + l);
    assert.deepEqual(Object.keys(A.I18N[l]).sort(), ref, "chei diferite în " + l);
    for (const [k, v] of Object.entries(A.I18N[l])) assert.ok(String(v).trim().length > 0, `${l}.${k} e gol`);
  }
});

test("fiecare rol, postazione și cod de eroare de pe server are text", () => {
  for (const l of LANGS) {
    for (const r of A.ROLES) assert.ok(A.I18N[l]["role_" + r], `${l}: rol ${r}`);
    for (const s of A.STATIONS) assert.ok(A.I18N[l]["st_" + s], `${l}: postazione ${s}`);
    for (const e of SERVER_ERRORS) assert.ok(A.I18N[l]["err_" + e], `${l}: eroare ${e}`);
  }
});

test("textele nu sunt copii ale italienei (în afară de nume proprii și termeni identici)", () => {
  const same = ["atTitle", "st_cnc", "atMembers"]; /* termeni care se scriu la fel în unele limbi */
  for (const l of LANGS.filter(x => x !== "it")) {
    let identical = 0;
    for (const k of Object.keys(A.I18N.it)) if (A.I18N[l][k] === A.I18N.it[k] && !same.includes(k)) identical++;
    assert.ok(identical <= 8, `${l}: ${identical} texte identice cu italiana`);
  }
});

test("t(): limba necunoscută cade pe italiană, cheia necunoscută se întoarce ca atare", () => {
  assert.equal(A.t("xx", "atMine"), A.I18N.it.atMine);
  assert.equal(A.t("de", "atMine"), A.I18N.de.atMine);
  assert.equal(A.t("de", "nu_exista"), "nu_exista");
});

test("can(): doar responsabilul administrează, responsabilul și biroul văd membrii", () => {
  assert.equal(A.can("responsabil", "members.manage"), true);
  assert.equal(A.can("birou", "members.manage"), false);
  assert.equal(A.can("birou", "members.list"), true);
  assert.equal(A.can("operator", "members.list"), false);
  assert.equal(A.can("partener", "invite.create"), false);
  assert.equal(A.can("responsabil", "invite.create"), true);
  assert.equal(A.can("responsabil", "nu.exista"), false);
  assert.equal(A.can(undefined, "members.list"), false);
});

test("slugify: fără diacritice, litere mici, liniuțe, maxim 40", () => {
  assert.equal(A.slugify("Tâmplăria Test"), "tamplaria-test");
  assert.equal(A.slugify("  Cafasso  Serramenti!! "), "cafasso-serramenti");
  assert.equal(A.slugify("Înălțime ș ț"), "inaltime-s-t");
  assert.equal(A.slugify("---"), "");
  assert.equal(A.slugify(null), "");
  const long = A.slugify("a".repeat(80));
  assert.ok(long.length <= 40 && A.isSlug(long));
});

test("isSlug: aceeași regulă ca la server", () => {
  for (const ok of ["ab", "tamplaria-test", "a1", "x-y-z", "a".repeat(40)]) assert.equal(A.isSlug(ok), true, ok);
  for (const bad of ["", "a", "-ab", "ab-", "A-b", "a b", "a_b", "ș-t", "a".repeat(41), null, 5]) assert.equal(A.isSlug(bad), false, String(bad));
});

test("slugify produce întotdeauna un slug valid când are cel puțin 2 caractere utile", () => {
  for (const n of ["Atelier Popescu", "Ébéniste d'Azur", "Dolceacqua 1", "Domus Renov SRL"]) {
    const s = A.slugify(n); assert.equal(A.isSlug(s), true, n + " → " + s);
  }
});

test("normCode / fmtCode: orice grupare, litere mici, doar 16 cifre hex", () => {
  assert.equal(A.normCode("0123-4567-89ab-cdef"), "0123456789ABCDEF");
  assert.equal(A.normCode(" 0123456789abcdef "), "0123456789ABCDEF");
  assert.equal(A.normCode("0123456789ABCDEG"), null);
  assert.equal(A.normCode("0123"), null);
  assert.equal(A.normCode(""), null);
  assert.equal(A.normCode(undefined), null);
  assert.equal(A.fmtCode("0123456789ABCDEF"), "0123-4567-89AB-CDEF");
  assert.equal(A.normCode(A.fmtCode("FEDCBA9876543210")), "FEDCBA9876543210");
});

test("errKey: mesajul serverului → cheie de text; orice altceva → err_generic", () => {
  for (const e of SERVER_ERRORS) assert.equal(A.errKey({ message: "atelier:" + e }), "err_" + e);
  assert.equal(A.errKey({ message: "ERROR: atelier:slug_taken (SQLSTATE P0001)" }), "err_slug_taken");
  assert.equal(A.errKey({ message: "network down" }), "err_generic");
  assert.equal(A.errKey({ message: "atelier:ceva_nou" }), "err_generic");
  assert.equal(A.errKey(null), "err_generic");
  assert.equal(A.errKey(undefined), "err_generic");
});

test("flagOn: ?atelier=1 pornește și rămâne, ?atelier=0 oprește, fără parametru păstrează", () => {
  const mk = (search, store = {}) => ({
    location: { search },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }
  });
  const store = {};
  assert.equal(A.flagOn(mk("", store)), false);
  assert.equal(A.flagOn(mk("?atelier=1", store)), true);
  assert.equal(A.flagOn(mk("", store)), true, "rămâne după ce parametrul dispare");
  assert.equal(A.flagOn(mk("?lang=it", store)), true);
  assert.equal(A.flagOn(mk("?atelier=0", store)), false);
  assert.equal(A.flagOn(mk("", store)), false);
  /* localStorage care aruncă (mod privat) nu strică nimic */
  const broken = { location: { search: "?atelier=1" }, localStorage: { getItem() { throw new Error("x"); }, setItem() { throw new Error("x"); }, removeItem() {} } };
  assert.equal(A.flagOn(broken), false);
});

/* ===== E1 (migrarea 1.6): comenzi ===== */
const JOB_ERRORS = ["title_invalid", "snapshot_invalid", "project_not_yours", "partner_invalid",
  "cancelled_final", "not_open", "piece_unknown", "client_id_required", "not_allowed", "not_found"];
/* aceeași listă albă ca `job_snapshot_ok` din migrarea 1.6 */
const SNAP_PIECE_KEYS = ["pk", "modulo", "elemento", "role", "lung", "larg", "sp", "pz", "material", "decor", "bordo", "grain", "note"];

test("E1: stările și evenimentele sunt cele din enumurile serverului, fiecare cu text", () => {
  assert.deepEqual([...A.JOB_STATES], ["draft", "confirmed", "in_progress", "done", "shipped", "installed", "cancelled"]);
  assert.deepEqual([...A.JOB_EVENTS], ["start", "done", "issue"]);
  for (const l of LANGS) {
    for (const s of A.JOB_STATES) assert.ok(A.I18N[l]["state_" + s], `${l}: stare ${s}`);
    for (const e of JOB_ERRORS) assert.ok(A.I18N[l]["err_" + e], `${l}: eroare ${e}`);
  }
});

test("E1: errKey recunoaște și erorile `job:<cod>`", () => {
  assert.equal(A.errKey({ message: "job:not_open" }), "err_not_open");
  assert.equal(A.errKey({ message: "job:cancelled_final" }), "err_cancelled_final");
  assert.equal(A.errKey({ message: "job:nu_exista" }), "err_generic");
});

test("E1: can() pentru comenzi — operatorul doar înregistrează, partenerul doar citește", () => {
  for (const c of ["job.create", "job.state", "job.progress"]) {
    assert.ok(A.can("responsabil", c) && A.can("birou", c));
    assert.ok(!A.can("operator", c) && !A.can("partener", c), c);
  }
  assert.ok(A.can("operator", "job.event"));
  assert.ok(!A.can("partener", "job.event"));
});

const PROJ = { name: "Jacquin", price: 9999, client: "X", phone: "+33", pieces: [
  { modulo: "Corp 1000", elemento: "fianco", lung: 2400, larg: 560, pz: 2, bordo: "2L+1C", materiale: "Egger W1000", prezzo: 12, costo: 5, gen: "Corp 1000" },
  { modulo: "Corp 1000", elemento: "ripiano", lung: 764, larg: 540, pz: 3, materiale: "Egger W1000" }] };

test("E1: buildSnapshot păstrează doar câmpurile din lista albă și niciun preț/client", () => {
  const s = A.buildSnapshot(PROJ, { appVer: "4.78.0", material: x => x.materiale + " [U999]", note: () => "" });
  assert.deepEqual(Object.keys(s).sort(), ["meta", "pieces"]);
  for (const k of Object.keys(s.meta)) assert.ok(["app_ver", "units", "project_name"].includes(k), k);
  for (const p of s.pieces) for (const k of Object.keys(p)) assert.ok(SNAP_PIECE_KEYS.includes(k), "cheie nepermisă: " + k);
  const txt = JSON.stringify(s);
  for (const bad of ["9999", "prezzo", "costo", "+33", "client"]) assert.ok(!txt.includes(bad), bad);
  assert.equal(s.pieces[0].material, "Egger W1000 [U999]");
  assert.equal(s.pieces[1].bordo, undefined);
});

test("E1: pk e stabil, unic și determinist (același proiect → același instantaneu)", () => {
  const a = A.buildSnapshot(PROJ), b = A.buildSnapshot(JSON.parse(JSON.stringify(PROJ)));
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const pks = a.pieces.map(p => p.pk);
  assert.deepEqual(pks, ["r1", "r2"]);
  assert.equal(new Set(pks).size, pks.length);
  assert.ok(pks.every(k => k.length >= 1 && k.length <= 80));
});

test("E1: buildSnapshot — fără piese sau peste 2000 → null; pz lipsă devine 1; cote nenumerice sunt omise", () => {
  assert.equal(A.buildSnapshot({ name: "x", pieces: [] }), null);
  assert.equal(A.buildSnapshot({ name: "x" }), null);
  assert.equal(A.buildSnapshot({ name: "x", pieces: Array.from({ length: 2001 }, () => ({ lung: 1, larg: 1 })) }), null);
  const s = A.buildSnapshot({ name: "x", pieces: [{ elemento: "e", lung: "abc", larg: 10 }] });
  assert.equal(s.pieces[0].pz, 1);
  assert.equal(s.pieces[0].lung, undefined);
  assert.equal(s.pieces[0].larg, 10);
});

/* ===== E2: QR pe etichetă, scanare, coadă offline ===== */
const JOB_ID = "6f1c2b7e-9a3d-4c58-8e21-0b5d7a9c4e13";

test("E2: textele de scanare și de coadă există în toate limbile", () => {
  for (const l of LANGS) for (const k of ["scanBtn", "scanTitle", "scanPaste", "scanGo", "scanNoCam", "scanBad", "scanNotFound",
    "scanStation", "scanNoStation", "scanDoneAt", "evQueued", "qPending", "qSent", "scanLogin"]) assert.ok(A.I18N[l][k], `${l}.${k}`);
});

test("E2: qrUrl / parseScan — dus-întors, în orice formă lipită", () => {
  const u = A.qrUrl(JOB_ID.toUpperCase(), "r12");
  assert.equal(u, "https://ebanist.com/#e=" + JOB_ID + ".r12");
  const want = { job: JOB_ID, pk: "r12" };
  assert.deepEqual({ ...A.parseScan(u) }, want);
  assert.deepEqual({ ...A.parseScan("#e=" + JOB_ID + ".r12") }, want);
  assert.deepEqual({ ...A.parseScan("e=" + JOB_ID + ".r12") }, want);
  assert.deepEqual({ ...A.parseScan("  " + JOB_ID + ".r12\n") }, want);
});

test("E2: parseScan respinge orice nu e cod de piesă (injecții, uuid prost, pk lung, alt site cu același fragment)", () => {
  for (const bad of ["", null, undefined, "r12", JOB_ID, JOB_ID + ".", JOB_ID + ".r 12", JOB_ID + ".r12;drop", JOB_ID + "./r12",
    "not-a-uuid.r12", JOB_ID + "." + "a".repeat(81), "javascript:alert(1)", JOB_ID + ".r12" + "\n" + JOB_ID + ".r13"])
    assert.equal(A.parseScan(bad), null, JSON.stringify(bad));
  assert.equal(A.qrUrl("x", "r1"), null);
  assert.equal(A.qrUrl(JOB_ID, "r 1"), null);
  assert.equal(A.qrUrl(JOB_ID, "a".repeat(81)), null);
});

test("E2: rowSig se schimbă cu orice rând modificat, mutat, adăugat sau scos — și nu cu prețul/materialul", () => {
  const base = [{ modulo: "A", elemento: "fianco", lung: 700, larg: 500, pz: 2 }, { modulo: "A", elemento: "ripiano", lung: 600, larg: 400, pz: 1 }];
  const s0 = A.rowSig(base), cl = () => JSON.parse(JSON.stringify(base));
  assert.equal(A.rowSig(cl()), s0);
  const m1 = cl(); m1[0].lung = 701; assert.notEqual(A.rowSig(m1), s0);
  const m2 = cl(); m2[1].pz = 2; assert.notEqual(A.rowSig(m2), s0);
  assert.notEqual(A.rowSig([base[1], base[0]]), s0);
  assert.notEqual(A.rowSig(base.slice(0, 1)), s0);
  assert.notEqual(A.rowSig(base.concat(base[0])), s0);
  const same = cl(); same[0].prezzo = 99; same[0].materiale = "alt"; assert.equal(A.rowSig(same), s0);
});

test("E2: coada offline — idempotentă pe client_id, plafonată, expiră după 7 zile", () => {
  const ev = (id, at) => ({ job: JOB_ID, station: "cnc", kind: "done", client_id: id, client_at: at || new Date().toISOString() });
  let q = A.qAdd([], ev("a")); q = A.qAdd(q, ev("b")); q = A.qAdd(q, ev("a"));
  assert.deepEqual(q.map(x => x.client_id).sort(), ["a", "b"]);
  let big = []; for (let i = 0; i < 520; i++) big = A.qAdd(big, ev("i" + i));
  assert.equal(big.length, 500); assert.equal(big[499].client_id, "i519"); assert.equal(big[0].client_id, "i20");
  const old = ev("old", new Date(Date.now() - 8 * 86400e3).toISOString());
  assert.deepEqual(A.qFresh([old, ev("new")], Date.now()).map(x => x.client_id), ["new"]);
});

test("E2: qIsPermanent — erorile de reguli se aruncă, cele de rețea se reîncearcă", () => {
  for (const m of ["job:not_open", "job:piece_unknown", "job:not_allowed", "job:cancelled_final", "atelier:not_allowed"]) assert.equal(A.qIsPermanent({ message: m }), true, m);
  for (const m of ["Failed to fetch", "NetworkError when attempting to fetch resource.", "TypeError: Load failed", "", "JWT expired"]) assert.equal(A.qIsPermanent({ message: m }), false, m);
  assert.equal(A.qIsPermanent(null), false);
});

/* ===== E3: documente pe postazione (bordatrice, vopsitorie) ===== */
const H3 = { isAcc: x => x.role === "accessorio", mm: x => (x.bordo ? 2 * x.lung : 0), decor: x => x.dec || "", mat: x => x.materiale, isMdf: x => /mdf/i.test(x.materiale) };
const ROWS3 = [
  { modulo: "A", elemento: "fianco", lung: 700, larg: 500, pz: 2, bordo: "2L", materiale: "PAL 18", dec: "U999" },
  { modulo: "A", elemento: "front", lung: 500, larg: 300, pz: 1, materiale: "MDF 19" },
  { modulo: "A", elemento: "ripiano", lung: 900, larg: 300, pz: 1, bordo: "1L", materiale: "PAL 18", dec: "U999" },
  { modulo: "B", elemento: "front", lung: 400, larg: 400, pz: 2, bordo: "2L", materiale: "MDF 19" },
  { modulo: "B", elemento: "asta", lung: 800, larg: 20, pz: 1, role: "accessorio", bordo: "2L", materiale: "Alu" },
  { modulo: "B", elemento: "ranforsare", lung: 300, larg: 100, pz: 1, materiale: "PAL 18", dec: "U999" }
];

test("E3: textele documentelor există în toate limbile", () => {
  for (const l of LANGS) for (const k of ["docsTitle", "docsNeedProject", "docEdgeBtn", "docPaintBtn", "docEdgeTitle", "docPaintTitle", "docEdgeNone",
    "docPaintNone", "docEdgeOf", "docEdgeTh", "docMl", "docReserve", "docCode", "docPiece", "docDim", "docQty", "docSides", "docEdgeMl",
    "docPaintColor", "docArea", "docPaintNote", "docCodeNote"]) assert.ok(A.I18N[l][k], `${l}.${k}`);
  assert.ok(A.can("birou", "doc.print") && A.can("responsabil", "doc.print"));
  assert.ok(!A.can("operator", "doc.print") && !A.can("partener", "doc.print"));
});

test("E3: edgeGroups — pe decorul panoului, fără piese fără cant și fără accesorii, cu rezervă de 10%", () => {
  const g = A.edgeGroups(ROWS3, H3);
  assert.equal(g.length, 2); /* U999 și MDF 19 */
  const u = g.find(x => x.label === "U999"), m = g.find(x => x.label === "MDF 19");
  assert.deepEqual(Array.from(u.pieces.map(p => p.pk)), ["r3", "r1"]); /* cele mai lungi întâi */
  assert.equal(u.meters, 4.6); /* 2·1400 + 1800 = 4600 mm */
  assert.equal(u.metersReserve, 5.1); /* 5060 mm → 5,1 */
  assert.equal(u.count, 3);
  assert.deepEqual(Array.from(m.pieces.map(p => p.pk)), ["r4"]);
  assert.equal(m.meters, 1.6);
  assert.ok(!g.some(x => x.pieces.some(p => p.pk === "r5" || p.pk === "r6" || p.pk === "r2")), "accesoriul, piesa fără cant și MDF-ul fără cant nu apar");
});

test("E3: codul piesei e același cu pk-ul din comandă (r<index+1>), chiar dacă rândurile dinainte nu apar în document", () => {
  const snap = A.buildSnapshot({ name: "x", pieces: ROWS3 });
  const pks = new Set(snap.pieces.map(p => p.pk));
  for (const g of A.edgeGroups(ROWS3, H3).concat(A.paintGroups(ROWS3, H3))) for (const it of g.pieces) assert.ok(pks.has(it.pk), it.pk);
  assert.equal(A.edgeGroups(ROWS3, H3).find(x => x.label === "U999").pieces[1].x.elemento, "fianco");
});

test("E3: paintGroups — numai MDF, fără accesorii, cu suprafața celor două fețe", () => {
  const g = A.paintGroups(ROWS3, H3);
  assert.equal(g.length, 1); assert.equal(g[0].label, "MDF 19");
  assert.deepEqual(Array.from(g[0].pieces.map(p => p.pk)), ["r2", "r4"]); /* în ordinea distinctei */
  assert.equal(g[0].count, 3);
  assert.ok(Math.abs(g[0].area - (2 * 0.5 * 0.3 + 2 * 0.4 * 0.4 * 2)) < 1e-9);
});

test("E3: liste goale și intrări ciudate nu aruncă", () => {
  assert.equal(A.edgeGroups([], H3).length, 0);
  assert.equal(A.paintGroups(null, H3).length, 0);
  assert.equal(A.edgeGroups([{ lung: 1, larg: 1 }], H3).length, 0);
  assert.equal(A.paintGroups([{ lung: "x", larg: 2, materiale: "mdf" }], H3)[0].area, 0);
});

test("E3: mutarea unui rând schimbă codurile (de aceea QR-ul și rowSig depind de ordine)", () => {
  const rev = ROWS3.slice().reverse();
  const a = A.edgeGroups(ROWS3, H3).find(x => x.label === "MDF 19").pieces[0].pk, b = A.edgeGroups(rev, H3).find(x => x.label === "MDF 19").pieces[0].pk;
  assert.notEqual(a, b);
});


/* ===== Setări: pornirea modulului fără ?atelier=1 ===== */
test("Setări: setFlag/hasFlag pornesc și opresc aceeași cheie ca ?atelier=1, și nu aruncă fără stocare", () => {
  const store = {}, win = { localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }, location: { search: "", hash: "" } };
  assert.equal(A.hasFlag(win), false);
  assert.equal(A.setFlag(win, true), true); assert.equal(A.hasFlag(win), true); assert.equal(A.flagOn(win), true);
  assert.equal(A.setFlag(win, false), false); assert.equal(A.hasFlag(win), false); assert.equal(A.flagOn(win), false);
  const broken = { localStorage: { getItem() { throw new Error("x"); }, setItem() { throw new Error("x"); }, removeItem() { throw new Error("x"); } }, location: { search: "", hash: "" } };
  assert.equal(A.setFlag(broken, true), false); assert.equal(A.hasFlag(broken), false);
});

test("Setări: textele funcțiilor în probă există în toate limbile", () => {
  for (const l of LANGS) for (const k of ["expTitle", "expAtelier", "expAtelierHint"]) assert.ok(A.I18N[l][k], `${l}.${k}`);
});
