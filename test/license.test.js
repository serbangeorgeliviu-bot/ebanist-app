/* Ebanist — le parti pure della licenza, senza browser e senza rete.
 *
 *   cd test && npm run test:license
 *
 * Qui dentro non si tocca Lemon Squeezy: si provano il checksum delle
 * chiavi storiche (che deve combaciare con il generatore Python), il
 * riconoscimento del formato, e la decisione «sono Pro?» — che e la sola
 * riga di codice capace di togliere il lavoro a un falegname che ha
 * pagato, quindi merita di essere fissata da una prova.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

/* Il file e uno script classico per il browser (window.EBLicense) e la
   radice del repo si dichiara "type": "module": un require() diretto lo
   caricherebbe come ESM e tornerebbe vuoto. Si valuta il sorgente e si
   prende quello che ha appeso al globale. */
const SRC = fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-license.js"), "utf8");
const L = new Function(SRC + "\nreturn globalThis.EBLicense;")();

const GENKEY = path.join(__dirname, "..", "app", "tools", "genkey.py");
function python(args) {
  return execFileSync("python3", [GENKEY].concat(args), { encoding: "utf8" }).trim();
}

describe("Chiavi storiche EBP — checksum e forma", () => {
  test("una chiave generata dal Python e valida in JavaScript", () => {
    /* La prova che conta davvero: i due checksum sono scritti due volte,
       in due linguaggi, e devono restare d'accordo per sempre. Se un
       giorno si tocca uno solo, questa riga cade. */
    const keys = python(["25"]).split("\n");
    assert.strictEqual(keys.length, 25);
    for (const k of keys) {
      assert.strictEqual(L.keyKind(k), "legacy", k);
      assert.ok(L.legacyValid(k), k + " rifiutata dal validatore JS");
    }
  });

  test("e una chiave valida in JavaScript e valida anche in Python", () => {
    const k = python(["1"]);
    assert.strictEqual(python(["--check", k]), "valida");
  });

  test("un carattere cambiato la invalida", () => {
    const k = python(["1"]);
    const A = L.ALPHA;
    for (let i = 4; i < k.length; i++) {
      if (k[i] === "-") continue;
      const other = A[(A.indexOf(k[i]) + 7) % A.length];
      const bad = k.slice(0, i) + other + k.slice(i + 1);
      assert.ok(!L.legacyValid(bad), "accettata una chiave storpiata: " + bad);
    }
  });

  test("i simboli ambigui non entrano mai nell'alfabeto", () => {
    for (const c of "01IO") assert.ok(L.ALPHA.indexOf(c) < 0, "l'alfabeto contiene " + c);
  });

  test("si normalizza quello che l'utente incolla davvero", () => {
    const k = python(["1"]);
    const nudo = k.replace(/-/g, "").toLowerCase();
    assert.strictEqual(L.normalize(nudo), k);
    assert.strictEqual(L.normalize("  " + k.toLowerCase() + " "), k);
    assert.ok(L.legacyValid(nudo));
  });
});

describe("Riconoscimento del formato", () => {
  test("un UUID di Lemon Squeezy e 'ls'", () => {
    assert.strictEqual(L.keyKind("38b1460a-5104-4067-a91d-77b872934d51"), "ls");
    assert.strictEqual(L.keyKind("38B1460A-5104-4067-A91D-77B872934D51"), "ls");
  });
  test("qualsiasi altra cosa e 'unknown', non un formato indovinato", () => {
    for (const junk of ["", "ciao", "EBP-1234", "1234-5678", "sk-ant-xxxx"])
      assert.strictEqual(L.keyKind(junk), "unknown", junk);
  });
});

describe("La decisione «sono Pro?»", () => {
  const NOW = Date.parse("2026-09-06T12:00:00Z");
  const ls = o => Object.assign({ kind: "ls", key: "k", activated: true, status: "active", expiresAt: null }, o);

  test("nessuna licenza = gratuito", () => {
    assert.strictEqual(L.proFrom(null, NOW).pro, false);
    assert.strictEqual(L.proFrom({}, NOW).pro, false);
  });

  test("chiave storica valida = Pro, per sempre e senza rete", () => {
    assert.strictEqual(L.proFrom({ kind: "legacy", key: "EBP-…", valid: true }, NOW).pro, true);
    assert.strictEqual(L.proFrom({ kind: "legacy", key: "EBP-…", valid: false }, NOW).pro, false);
  });

  test("abbonamento in corso = Pro", () => {
    const r = L.proFrom(ls({ expiresAt: "2026-10-06T00:00:00Z" }), NOW);
    assert.deepStrictEqual(r, { pro: true, reason: "ok" });
  });

  test("scaduto da poco = Pro, in tolleranza", () => {
    /* Una carta rifiutata di venerdi sera non deve fermare l'officina di
       lunedi mattina. Quattordici giorni per accorgersene e rimediare. */
    const r = L.proFrom(ls({ expiresAt: "2026-09-01T00:00:00Z" }), NOW);
    assert.deepStrictEqual(r, { pro: true, reason: "grace" });
    assert.strictEqual(L.graceDaysLeft(ls({ expiresAt: "2026-09-01T00:00:00Z" }), NOW), 9);   // scadenza + 14 gg = 15/09, da NOW mancano 8,5 gg
  });

  test("il giorno dopo la tolleranza, e finita", () => {
    const day15 = "2026-08-22T11:00:00Z";      // 15 giorni prima di NOW
    assert.strictEqual(L.proFrom(ls({ expiresAt: day15 }), NOW).reason, "lapsed");
  });

  test("revocata dal server = gratuito subito, senza tolleranza", () => {
    assert.strictEqual(L.proFrom(ls({ status: "disabled" }), NOW).pro, false);
    assert.strictEqual(L.proFrom(ls({ status: "expired" }), NOW).pro, false);
  });

  test("«inactive» NON toglie il Pro", () => {
    /* Lemon Squeezy chiama «inactive» una chiave senza dispositivi
       attivi: e lo stato normale subito dopo un cambio di telefono, non
       una revoca. Confonderli vorrebbe dire spegnere il Pro a chi ha solo
       scollegato il vecchio iPhone. */
    assert.strictEqual(L.proFrom(ls({ status: "inactive" }), NOW).pro, true);
  });

  test("senza scadenza (acquisto unico) resta Pro", () => {
    assert.strictEqual(L.proFrom(ls({ expiresAt: null }), NOW).pro, true);
  });

  test("una licenza mai attivata non e Pro", () => {
    assert.strictEqual(L.proFrom(ls({ activated: false }), NOW).pro, false);
  });
});

describe("Ogni quanto si ricontrolla", () => {
  const NOW = Date.parse("2026-09-06T12:00:00Z");
  test("mai controllata → si controlla", () => {
    assert.strictEqual(L.needsRecheck({ kind: "ls", key: "k" }, NOW), true);
  });
  test("controllata ieri → si aspetta", () => {
    assert.strictEqual(L.needsRecheck({ kind: "ls", key: "k", checkedAt: NOW - 864e5 }, NOW), false);
  });
  test("controllata otto giorni fa → si ricontrolla", () => {
    assert.strictEqual(L.needsRecheck({ kind: "ls", key: "k", checkedAt: NOW - 8 * 864e5 }, NOW), true);
  });
  test("una chiave storica non si ricontrolla mai: e offline di natura", () => {
    assert.strictEqual(L.needsRecheck({ kind: "legacy", key: "k", checkedAt: 0 }, NOW), false);
  });
});

describe("La risposta del server, ridotta a quello che si conserva", () => {
  test("attivazione riuscita", () => {
    const j = {
      activated: true, error: null,
      license_key: { id: 1, status: "active", key: "38b1460a-5104-4067-a91d-77b872934d51",
                     activation_limit: 3, activation_usage: 1, expires_at: "2026-10-06T14:15:07.000000Z" },
      instance: { id: "f90ec370-fd83-46a5-8bbd-44a241e78665", name: "Ebanist iPhone a1b2c3" },
      meta: { variant_id: 55, product_name: "Ebanist Pro", customer_email: "x@example.com" }
    };
    const lic = L.shapeFromResponse(j, null);
    assert.strictEqual(lic.kind, "ls");
    assert.strictEqual(lic.status, "active");
    assert.strictEqual(lic.instanceId, "f90ec370-fd83-46a5-8bbd-44a241e78665");
    assert.strictEqual(lic.expiresAt, "2026-10-06T14:15:07.000000Z");
    assert.strictEqual(lic.variantId, 55);
    assert.strictEqual(lic.email, "x@example.com");
    assert.ok(lic.activated);
    assert.ok(lic.checkedAt > 0);
    assert.strictEqual(L.proFrom(lic, Date.parse("2026-09-06T12:00:00Z")).pro, true);
  });

  test("una validazione senza instance non cancella quella che avevamo", () => {
    /* `validate` senza instance_id risponde `instance: null`: se lo si
       copiasse nella cache si perderebbe l'id, e la disattivazione da
       quel dispositivo non funzionerebbe piu. */
    const prev = { kind: "ls", key: "k", instanceId: "abc", instanceName: "iPhone", email: "x@y.z" };
    const lic = L.shapeFromResponse({ valid: true, license_key: { status: "active", key: "k", expires_at: null }, instance: null, meta: {} }, prev);
    assert.strictEqual(lic.instanceId, "abc");
    assert.strictEqual(lic.email, "x@y.z");
  });
});
