/* Ebanist — pannelli scanalati (D-180).
 *
 *   node --test test/fluted.test.js
 *
 * Il pannello scanalato (fluted) si compra già scanalato: è un MATERIALE del catalogo. La porta resta un unico pezzo
 * con le quote finite, quindi la distinta non cambia; le strisce sono solo disegno 3D. Le prove guardano:
 *   - il file ha lo schema giusto (spessore scalare, 7 lingue, nessun prezzo/fornitore/formato inventato);
 *   - nessun id ripetuto con gli altri cataloghi;
 *   - `scan` arriva dal catalogo e torna nell'esportazione; gli altri materiali non ne hanno;
 *   - il viewer disegna le strisce SOLO se il materiale le chiede (gli altri programmi di shader restano identici);
 *   - il service worker e il caricatore conoscono il file.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const APP = path.resolve(__dirname, "..", "app");
const rd = f => fs.readFileSync(path.join(APP, f), "utf8");
const SCAN = JSON.parse(rd("data/materials-scanalati.json"));
const OTHERS = ["centro-legno", "egger", "legacy", "worktops"].map(n => JSON.parse(rd("data/materials-" + n + ".json")));
const LANGS = ["it", "ro", "en", "fr", "de", "pl", "es"];

function sandbox() {
  const html = rd("index.html").split("\n");
  const slice = (a, b) => { const i = html.findIndex(l => a.test(l)); for (let j = i + 1; j < html.length; j++) if (b.test(html[j])) return html.slice(i, j).join("\n"); };
  const s = { console, Math, Number, String, Array, Object, JSON, isFinite, parseInt, parseFloat, Promise, Boolean, Error, Date,
    fetch: async url => { const f = path.join(APP, String(url).replace(/^\.\//, "")); if (!fs.existsSync(f)) return { ok: false }; return { ok: true, json: async () => JSON.parse(fs.readFileSync(f, "utf8")) }; } };
  s.globalThis = s; s.t = k => k;
  s.state = { lang: "it", settings: { matOvr: {}, matAdd: [], panelL: 2800, panelW: 2070 } };
  vm.createContext(s);
  vm.runInContext(slice(/^const MAT_SOURCES=/, /^function matPriceByLabel\(/), s, { filename: "catalogo" });
  return s;
}

describe("Il file dei pannelli scanalati", () => {
  test("ci sono pannelli, ognuno con spessore scalare > 0 e id scan_*", () => {
    assert.ok(SCAN.materiali.length >= 4);
    for (const m of SCAN.materiali) {
      assert.match(m.id, /^scan_/);
      assert.equal(typeof m.spessore, "number"); assert.ok(m.spessore > 0, m.id);
    }
  });
  test("nessun id ripetuto, dentro il file e con gli altri cataloghi", () => {
    const mine = SCAN.materiali.map(m => m.id);
    assert.equal(new Set(mine).size, mine.length);
    const other = new Set([].concat(...OTHERS.map(d => d.materiali.map(m => m.id))));
    for (const id of mine) assert.ok(!other.has(id), id + " esiste gia in un altro file");
  });
  test("nome in tutte e sette le lingue", () => {
    for (const m of SCAN.materiali) for (const l of LANGS) assert.ok(m.nome_i18n && m.nome_i18n[l], m.id + " manca " + l);
  });
  test("niente prezzo, codice, fornitore o formato inventati; colore non verificato", () => {
    for (const m of SCAN.materiali) {
      assert.equal(m.prezzo_mq, null, m.id + ": prezzo inventato"); assert.equal(m.codice, null);
      assert.equal(m.fornitore, "—"); assert.equal(m.formato, null); assert.equal(m.colore_verificato, false);
    }
  });
  test("pas e canal: numeri positivi, canale piu stretto del passo", () => {
    for (const m of SCAN.materiali) {
      const c = m.scanalat; assert.ok(c && c.pas > 0 && c.canal > 0 && c.canal < c.pas, m.id);
    }
  });
});

describe("Il caricatore del catalogo", () => {
  test("legge il file e porta `scan` sulla referenza", async () => {
    const s = sandbox(); await vm.runInContext("loadMaterials()", s);
    const m = vm.runInContext('matById("scan_rovere_19")', s);
    assert.ok(m, "scan_rovere_19 non e nel catalogo");
    assert.deepEqual(JSON.parse(JSON.stringify(m.scan)), { pas: 24, canal: 6 });
    assert.equal(m.th, 19); assert.equal(m.priced, false, "senza prezzo: il preventivo usa il generale e lo segnala");
  });
  test("gli altri materiali NON hanno `scan` (si disegnano come prima)", async () => {
    const s = sandbox(); await vm.runInContext("loadMaterials()", s);
    const bad = vm.runInContext("MATDB.filter(x=>x.scan && !/^scan_/.test(x.id)).map(x=>x.id)", s);
    assert.deepEqual(Array.from(bad), []);
    assert.ok(vm.runInContext("MATDB.length", s) > SCAN.materiali.length);
  });
  test("l'esportazione del catalogo conserva `scanalat`", async () => {
    const s = sandbox(); await vm.runInContext("loadMaterials()", s);
    const out = JSON.parse(vm.runInContext('JSON.stringify(matToCatalog(matById("scan_noce_19")))', s));
    assert.deepEqual(out.scanalat, { pas: 24, canal: 6 });
    const plain = JSON.parse(vm.runInContext('JSON.stringify(matToCatalog(matById("pal18_alb")))', s));
    assert.equal(plain.scanalat, undefined);
  });
  test("un `scanalat` incoerente (canale >= passo) si scarta", async () => {
    const s = sandbox();
    const r = vm.runInContext('matFromCatalog({id:"x",spessore:19,scanalat:{pas:10,canal:12}}).scan', s);
    assert.equal(r, null);
  });
});

describe("Viewer 3D e service worker", () => {
  const V = rd("viewer3d.js");
  test("lo shader scanalato esiste ed e legato all'opzione `flute` del materiale", () => {
    assert.match(V, /const FL_FN = `vec3 ebFl\(\)/);
    assert.match(V, /if \(o\.flute\) sh\.uniforms\.uFl/);
    assert.match(V, /\(o\.flute \? "-fl" : ""\)/, "la chiave del programma deve distinguere i materiali scanalati");
    assert.match(V, /flute: !!info\.scan/);
  });
  test("solo i fronti (kind f) portano le strisce", () => {
    assert.match(V, /if \(b\.kind === "f"\) \{ const mi = .*mi\.scan\) mesh\.userData\.flute/);
  });
  test("il file e nella shell del service worker e nelle sorgenti del catalogo", () => {
    assert.ok(rd("sw.js").includes("./data/materials-scanalati.json"));
    assert.ok(rd("index.html").includes('"./data/materials-scanalati.json"'));
  });
});

describe("Viewer 3D: API pentru filme cinematice", () => {
  const V = rd("viewer3d.js");
  test("focusAt: privire pe un punct al scenei, fără să atingă focusOn pe piesă", () => {
    assert.match(V, /focusAt\(x, y, z, radMm\)/);
    assert.match(V, /R\.focusOv && R\.focusOv\.pt/);
    assert.match(V, /focusOn\(pk, radMm, off\)/);
  });
  test("ease: viteza animațiilor se poate încetini, implicit rămâne 0.2 și offlineEnd o readuce", () => {
    assert.match(V, /let EASE = 0\.2;/);
    assert.match(V, /ease\(v\) \{ EASE = \(v > 0 && v <= 1\) \? \+v : 0\.2; \}/);
    assert.match(V, /offlineEnd\(\) \{ EASE = 0\.2;/);
  });
});
