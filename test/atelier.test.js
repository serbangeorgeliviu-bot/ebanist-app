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
