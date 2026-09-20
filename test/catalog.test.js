/* Ebanist — prove del catalogo materiali.
 *
 *   node --test test/catalog.test.js
 *
 * Il catalogo non sta piu nel codice: sta in due file JSON. Queste prove
 * girano sui file VERI, non su una copia, e guardano le tre cose che se
 * sbagliate mandano a debitare cote sbagliate:
 *   - lo spessore e uno SCALARE (due grossezze = due referenze);
 *   - un id non si ripete MAI (due righe con lo stesso id = due grossezze
 *     per lo stesso materiale, e vince quella che capita);
 *   - le referenze dei progetti gia salvati si risolvono ancora.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const APP = path.resolve(__dirname, "..", "app");
const CL = JSON.parse(fs.readFileSync(path.join(APP, "data/materials-centro-legno.json"), "utf8"));
const LEG = JSON.parse(fs.readFileSync(path.join(APP, "data/materials-legacy.json"), "utf8"));

/* Il banco: lo stesso index.html, con un `fetch` che legge dal disco. */
function sandbox() {
  const html = fs.readFileSync(path.join(APP, "index.html"), "utf8").split("\n");
  const slice = (a, b) => {
    let i = html.findIndex(l => a.test(l));
    for (let j = i + 1; j < html.length; j++) if (b.test(html[j])) return html.slice(i, j).join("\n");
  };
  const s = {
    console, Math, Number, String, Array, Object, JSON, isFinite, parseInt, parseFloat,
    Promise, Boolean, Error, Date,
    fetch: async url => {
      const f = path.join(APP, String(url).replace(/^\.\//, ""));
      if (!fs.existsSync(f)) return { ok: false };
      return { ok: true, json: async () => JSON.parse(fs.readFileSync(f, "utf8")) };
    }
  };
  s.globalThis = s;
  s.t = k => k;
  s.state = { lang: "it", settings: { matOvr: {}, matAdd: [], panelL: 2800, panelW: 2070 } };
  vm.createContext(s);
  vm.runInContext(slice(/^const MAT_SOURCES=/, /^function matPriceByLabel\(/), s, { filename: "catalogo" });
  return s;
}

describe("I file del catalogo", () => {
  test("Centro Legno: 17 referenze, come il pannello campioni", () =>
    assert.equal(CL.materiali.length, 17));
  test("ogni spessore e uno SCALARE > 0, mai una lista", () => {
    for (const m of CL.materiali.concat(LEG.materiali)) {
      assert.equal(typeof m.spessore, "number", m.id + ": spessore non e un numero");
      assert.ok(m.spessore > 0, m.id + ": spessore non positivo");
    }
  });
  test("nessun id ripetuto, dentro e fra i due file", () => {
    const ids = CL.materiali.concat(LEG.materiali).map(m => m.id);
    const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    assert.deepEqual(dup, [], "id ripetuti: " + dup.join(", "));
  });
  test("lo stesso decoro in due grossezze sono due voci distinte", () => {
    /* «Bianco» sta a 19, «Bianco (2)» e «Bianco (3)» a 18: tre voci, tre id */
    const bianchi = CL.materiali.filter(m => /^Bianco( \(\d\))?$/.test(m.nome));
    assert.equal(bianchi.length, 3);
    assert.equal(new Set(bianchi.map(m => m.id)).size, 3);
    assert.deepEqual(bianchi.map(m => m.spessore).sort(), [18, 18, 19]);
  });
  test("nessun codice inventato: i TBD sono null", () => {
    const noti = CL.materiali.filter(m => m.codice).map(m => m.codice).sort();
    assert.deepEqual(noti, ["22458MN", "23196MN", "4375DP", "K2414AH"]);
  });
  test("i colori sono dichiarati NON verificati", () => {
    for (const m of CL.materiali) assert.equal(m.colore_verificato, false, m.id);
  });
  test("prezzo non ancora rilevato = null, non uno inventato", () => {
    for (const m of CL.materiali) assert.equal(m.prezzo_mq, null, m.id);
  });
  test("la famiglia e una di quelle previste", () => {
    const ok = ["tinta_unita", "legno", "tessuto", "cemento", "lucido"];
    for (const m of CL.materiali) assert.ok(ok.includes(m.famiglia), m.id + ": " + m.famiglia);
  });
});

describe("Il caricamento nell'app", () => {
  const S = sandbox();
  test("carica tutte e due le sorgenti", async () => {
    await S.MAT_READY;
    assert.equal(S.MAT_LOADED, true);
    assert.equal(S.MATDB.length, CL.materiali.length + LEG.materiali.length);
  });
  test("lo spessore arriva intero fino a matById", async () => {
    await S.MAT_READY;
    assert.equal(S.matById("bianco_19").th, 19);
    assert.equal(S.matById("bianco_2_18").th, 18);
    assert.equal(S.matById("avocado_green_22458mn_19").th, 19);
  });
  test("codice e famiglia viaggiano con la referenza", async () => {
    await S.MAT_READY;
    const m = S.matById("avocado_green_22458mn_19");
    assert.equal(m.codice, "22458MN");
    assert.equal(m.famiglia, "tinta_unita");
    assert.equal(m.coloreVerificato, false);
    assert.equal(m.c, "#A8B08A");
  });
  test("I PROGETTI VECCHI SI APRONO: le referenze di prima si risolvono", async () => {
    await S.MAT_READY;
    for (const id of ["pal18_alb", "pal25_alb", "pfl3", "mdf18", "dsp_w980_19"]) {
      const m = S.matById(id);
      assert.ok(m, id + ": referenza non piu risolvibile — un progetto che la usa non si aprirebbe");
      assert.ok(m.th > 0, id + ": senza spessore");
    }
  });
  test("le referenze vecchie NON compaiono nei selettori", async () => {
    await S.MAT_READY;
    const vis = S.matVisible().map(m => m.id);
    assert.ok(!vis.includes("pal18_alb"), "il vecchio bianco da 18 e ancora nella lista");
    assert.ok(vis.includes("bianco_19"), "il bianco Centro Legno da 19 manca dalla lista");
    /* le basi tecniche restano: Centro Legno non ha un HDF da 3 per gli schienali */
    assert.ok(vis.includes("pfl3"), "senza HDF da 3 non si puo fare uno schienale");
  });
  test("un id sconosciuto NON si risolve — e quello che blocca l'esportazione", async () => {
    await S.MAT_READY;
    assert.equal(S.matById("questo_non_esiste"), null);
  });
  test("gli spessori del filtro escono dal catalogo, non da una lista fissa", async () => {
    await S.MAT_READY;
    /* `matThicknesses` sta nel blocco del cercatore, fuori da questa fetta:
       qui si misura la stessa cosa dalla sorgente, cioe il catalogo. */
    const ths = [...new Set(S.matVisible().map(m => m.th))].sort((a, b) => a - b);
    assert.ok(ths.includes(18) && ths.includes(19), "mancano 18 o 19: " + ths.join(","));
    assert.ok(ths.includes(3), "manca il 3 dello schienale");
    assert.deepEqual(ths, ths.slice().sort((a, b) => a - b), "non ordinati");
  });
  test("esporta e reimporta senza perdere spessore ne codice", async () => {
    await S.MAT_READY;
    const doc = { materiali: S.matAll().map(S.matToCatalog) };
    const a = doc.materiali.find(m => m.id === "avocado_green_22458mn_19");
    assert.equal(a.spessore, 19);
    assert.equal(a.codice, "22458MN");
    assert.equal(a.colore_verificato, false);
    assert.equal(a.prezzo_mq, null);
    const back = S.matFromCatalog(a);
    assert.equal(back.th, 19);
    assert.equal(back.codice, "22458MN");
  });
});
