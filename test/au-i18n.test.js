/* 4.38.3 — i messaggi delle verifiche nella lingua dell'interfaccia.
   Il nucleo scrive il perche di ogni regola in romeno; app/ebanist-au-i18n.js
   lo traduce. Qui si controlla che NESSUN testo del nucleo resti senza
   traduzione: una regola nuova scritta solo in romeno non passa. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path"), vm = require("vm");

const APP = path.join(__dirname, "..", "app");
const coreSrc = fs.readFileSync(path.join(APP, "ebanist-core.js"), "utf8");
const S = vm.createContext({ console, Math, JSON });
vm.runInContext(coreSrc, S, { filename: "ebanist-core.js" });
/* come nel browser: script classico, globali nel contesto (la radice ha
   "type":"module", quindi niente require) */
vm.runInContext(fs.readFileSync(path.join(APP, "ebanist-au-i18n.js"), "utf8"), S, { filename: "ebanist-au-i18n.js" });
const { AU_I18N, auTx } = S;

/* i letterali romeni nel corpo di una funzione del nucleo (fino alla prossima
   dichiarazione di primo livello) */
function roLiterals(fromMarker, toMarker) {
  const a = coreSrc.indexOf(fromMarker), b = coreSrc.indexOf(toMarker, a + 1);
  assert.ok(a >= 0 && b > a, "marker non trovati: " + fromMarker);
  const body = coreSrc.slice(a, b).split("\n")
    .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  const out = [];
  for (const m of body.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
    const s = JSON.parse('"' + m[1] + '"');
    if (/[ăâîșțĂÂÎȘȚ]/.test(s) && s.length > 12) out.push(s);
  }
  return out;
}

const CLOSURE = roLiterals("function reconstructCarcass", "function validateCarcassClosure");
const INVARIANTS = roLiterals("function validateInvariants", "var ROLE_SP_KEY");
const ENV = roLiterals("function checkAssertions", "function blocking");

test("ci sono davvero dei testi da tradurre (l'estrazione non e vuota)", () => {
  assert.ok(CLOSURE.length >= 7, "chiusura: " + CLOSURE.length);
  assert.ok(INVARIANTS.length >= 16, "invarianti: " + INVARIANTS.length);
  assert.ok(S.ASSERTIONS.length >= 18);
});

for (const lang of ["it", "en", "fr"]) {
  test(`${lang}: ogni testo della chiusura e degli invarianti ha la sua traduzione`, () => {
    for (const s of CLOSURE.concat(INVARIANTS, ENV)) {
      const tx = auTx(s, lang);
      assert.notEqual(tx, s, `senza traduzione in ${lang}: «${s}»`);
    }
  });
  test(`${lang}: ogni asserzione ha perche e fonte tradotti`, () => {
    for (const a of S.ASSERTIONS) {
      assert.notEqual(auTx(a.why, lang), a.why, `${a.id} why in ${lang}`);
      if (/[ăâîșț]/.test(a.source)) assert.notEqual(auTx(a.source, lang), a.source, `${a.id} source in ${lang}`);
    }
  });
  test(`${lang}: nessuna traduzione e rimasta in romeno o vuota`, () => {
    for (const [k, v] of Object.entries(AU_I18N[lang])) {
      assert.ok(v && v.trim(), "vuota: " + k);
      assert.ok(!/[ăâșț]/.test(v), `${lang} contiene diacritici romeni: «${v}»`);
    }
  });
  test(`${lang}: stesse chiavi delle altre lingue`, () => {
    assert.deepEqual(Object.keys(AU_I18N[lang]).sort(), Object.keys(AU_I18N.it).sort());
  });
}

test("i prefissi tengono il dettaglio che il nucleo ci attacca", () => {
  const ro = "Grosimea scrisă pe piesă nu e cea a materialului rolului: Fianco 18 mm ≠ Bianco 19 mm";
  assert.equal(auTx(ro, "en"),
    "The thickness written on the part is not that of the role's material: Fianco 18 mm ≠ Bianco 19 mm");
  assert.equal(auTx("Nu se pot citi cotele pentru verificare: x", "fr"),
    "Impossible de lire les cotes pour la vérification : x");
});

test("romeno, lingua sconosciuta, testo assente: passa com'e", () => {
  const s = CLOSURE[0];
  assert.equal(auTx(s, "ro"), s);
  assert.equal(auTx(s, "de"), s);
  assert.equal(auTx("Un testo qualunque", "en"), "Un testo qualunque");
  assert.equal(auTx("", "en"), "");
  assert.equal(auTx(undefined, "en"), undefined);
});

test("la catena della profondita (laterale accorciata a mano) esce tradotta", () => {
  /* la stessa catena che la foglia di chiusura mostra quando una laterale
     passa da 600 a 560 nella distinta */
  const s = CLOSURE.find(x => x.indexOf("Adâncimea recompusă din laterală") === 0);
  assert.match(auTx(s, "en"), /^The depth rebuilt from the side/);
  assert.match(auTx(s, "it"), /^La profondità ricomposta dal fianco/);
  assert.match(auTx(s, "fr"), /^La profondeur recomposée/);
});
