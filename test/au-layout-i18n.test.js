/* Mesajele validatorilor de cote (validateLayout / validateFit) in limba interfetei.
 *   cd test && node --test au-layout-i18n.test.js
 * Acoperire: fiecare fragment de text din errors.push al nucleului apare intr-un tipar;
 * fiecare tipar, instantiat cu valori, se traduce complet (fara romana ramasa) in it/en/fr;
 * de/pl/es primesc engleza. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = path.join(__dirname, "..", "app");
const S = vm.createContext({ console, Math, JSON, RegExp, Object });
for (const f of ["ebanist-core.js", "ebanist-au-i18n.js", "ebanist-au-layout-i18n.js"])
  vm.runInContext(fs.readFileSync(path.join(APP, f), "utf8"), S, { filename: f });
const { auTx, AU_PAT_ROWS } = S;
const RO = /[ăâîșțĂÂÎȘȚ]|\b(și|nu |sunt|trebuie|iese|spate|lumina|sertare)\b/;

test("fiecare fragment din errors.push are un tipar", () => {
  const src = fs.readFileSync(path.join(APP, "ebanist-core.js"), "utf8").split("\n");
  const start = src.findIndex(l => /^function normProfile|^function validateLayout|depthProfile/.test(l)) ;
  const joined = AU_PAT_ROWS.map(r => r[0]).join("\n");
  const missing = [];
  let inPush = false;
  src.forEach((l, i) => {
    if (i < 1300 || i > 1960) return;
    if (/errors\.push\(/.test(l)) inPush = true;
    if (inPush) {
      for (const m of l.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
        const lit = JSON.parse('"' + m[1] + '"');
        if (lit.length >= 12 && /[a-zăâîșț]{4}/.test(lit) && !/^(top|bottom|left|right)/.test(lit) && !joined.includes(lit.replace(/'$/, "")) && !joined.includes(lit.trim()))
          missing.push(i + 1 + ": " + lit);
      }
      if (/;\s*(return;|continue;)?\s*\}?\s*$/.test(l) || /\);\s*$/.test(l)) inPush = false;
    }
  });
  assert.deepEqual(missing, []);
});

test("tiparele: instantiate, se traduc in it/en/fr fara romana ramasa", () => {
  assert.ok(AU_PAT_ROWS.length >= 80);
  for (const r of AU_PAT_ROWS) {
    let k = 0; const sample = r[0].replace(/\{\}/g, () => String(++k * 7));
    for (const lang of ["it", "en", "fr", "de", "pl", "es"]) {
      const out = auTx(sample, lang);
      if (RO.test(sample.replace(/Cassetti\/sez\.|setto|ripiano|filler|rinforzo|anta/g, ""))) assert.notEqual(out, sample, lang + " netradus: " + sample);
      assert.ok(!/\{\d\}/.test(out), "placeholder ramas: " + out);
      assert.ok(!RO.test(out.replace(/Cassetti\/sez\.|setto|ripiano|filler|rinforzo|anta/g, "")), lang + " are romana: " + out);
    }
    const nums = (sample.match(/\d+/g) || []).sort().join();
    assert.equal((auTx(sample, "en").match(/\d+/g) || []).sort().join(), nums, "valorile se pierd: " + sample);
  }
});

test("etichete de piesa si lista compusa cu prefix", () => {
  assert.equal(auTx("ripiano 2: x = 10 iese din lumina interioară (5–9)", "en"), "shelf 2: x = 10 is outside the inner opening (5–9)");
  assert.equal(auTx("Cote absolute: setto 1 și setto 2 se suprapun · anta 1 și anta 2 se suprapun", "it"),
    "Quote assolute: il setto 1 e il setto 2 si sovrappongono · l'anta 1 e l'anta 2 si sovrappongono");
  assert.equal(auTx("filler 1: două filler-e pe top", "fr"), "filler 1 : deux fillers sur top");
  assert.equal(auTx("coloana 1: ripiano 2 intră în piesa de dedesubt (3 mm)", "en"), "column 1: shelf 2 overlaps the part below (3 mm)");
});

test("romana ramane romana; un text necunoscut ramane neatins", () => {
  const m = "setto 1 și setto 2 se suprapun";
  assert.equal(auTx(m, "ro"), m);
  assert.equal(auTx("altceva", "en"), "altceva");
});
