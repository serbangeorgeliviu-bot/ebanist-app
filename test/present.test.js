/* Ebanist — prezentarea pentru client (5.95.0): module pure + texte.
 *   node --test test/present.test.js
 * Cotele și schema vin din câmpurile de nivel înalt ale lui cfg; nimic tehnic nu ajunge la client. */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const APP = path.join(__dirname, "..", "app");
/* app/ e ESM prin package.json din rădăcină: modulele (IIFE care scriu pe globalThis) se rulează într-un context vm, ca în celelalte teste */
const vm = require("vm"), ctx = vm.createContext({});
for (const f of ["ebanist-present.js", "ebanist-present-i18n.js"]) vm.runInContext(fs.readFileSync(path.join(APP, f), "utf8"), ctx, { filename: f });
const J = x => JSON.parse(JSON.stringify(x));
const P = ctx, T = ctx;
const cfg = { type: "standard", L: 1800, H: 2200, P: 600, plinth: 100, doors: 3, drawers: 2, shelves: 4, handles: "maniglia", back: 1, hang: 1, led: "top" };

describe("presentFacts", () => {
  test("gabaritul și elementele", () => {
    const F = P.presentFacts(cfg);
    assert.deepEqual(J(F.dims), { L: 1800, H: 2200, P: 600 });
    const k = F.items.map(i => i.k);
    for (const x of ["doors", "drawers", "shelves", "hang", "h_maniglia", "led", "plinth", "back"]) assert.ok(k.includes(x), x);
    assert.equal(F.items.find(i => i.k === "doors").n, 3);
  });
  test("scorrevole → ușile sunt glisante; fără uși și sertare nu apare mânerul", () => {
    assert.ok(P.presentFacts({ type: "scorrevole", L: 2000, H: 2400, P: 600, doors: 2 }).items.some(i => i.k === "sliding"));
    assert.ok(!P.presentFacts({ type: "standard", L: 800, H: 800, P: 300, handles: "maniglia" }).items.some(i => i.k.startsWith("h_")));
  });
  test("un tip fără carcasă (masă) are doar gabaritul; cfg gol nu aruncă", () => {
    assert.equal(P.presentFacts({ type: "tavolo", L: 1600, H: 750, P: 900 }).items.length, 0);
    assert.doesNotThrow(() => P.presentFacts()); assert.doesNotThrow(() => P.presentElevation());
  });
});

describe("presentElevation", () => {
  const svg = P.presentElevation(cfg, { front: { c: "#b08a5a", wood: true }, body: { c: "#e8e6df" }, uid: "t" });
  test("SVG valid, cu cotele de gabarit și fără coduri", () => {
    assert.ok(svg.startsWith("<svg") && svg.endsWith("</svg>"));
    assert.equal((svg.match(/<svg/g) || []).length, 1);
    for (const n of ["1800", "2200", "600"]) assert.ok(svg.includes(">" + n + "<"), n);
    assert.ok(!/NaN|undefined|Infinity/.test(svg));
  });
  test("uși și sertare desenate; lemnul poartă model", () => {
    assert.equal((svg.match(/class="pe-door"/g) || []).length, 3 + 2);
    assert.ok(/<pattern id="petf"/.test(svg));
  });
  test("culori invalide și valori absurde nu strică desenul", () => {
    const s = P.presentElevation({ type: "standard", L: -5, H: "x", P: 0, doors: 99, drawers: 99, shelves: 99, plinth: 9999 }, { front: { c: "oops" }, body: { c: "#zzz" } });
    assert.ok(!/NaN|undefined|Infinity/.test(s));
    assert.ok((s.match(/class="pe-door"/g) || []).length <= 16);
  });
  test("injecție în culoare nu iese din atribut", () => {
    const s = P.presentElevation(cfg, { front: { c: '"><script>x</script>' } });
    assert.ok(!/<script/.test(s));
  });
});

describe("feronerie la client", () => {
  const L = (brand, n, art) => P.presentHwLabel({ brand, n: { it: n }, art }, "it");
  test("eticheta = marcă + nume, fără cod", () => {
    assert.equal(L("Blum", "CLIP top BLUMOTION 110° + basetta CLIP", "71B3550 + 173L6100"), "Blum CLIP top BLUMOTION 110° + basetta CLIP");
    assert.equal(L("Häfele", "Metalla 510 A/SM 110° in applique + basetta", "329.17.100"), "Häfele Metalla 510 A/SM 110° in applique + basetta");
    assert.equal(L("Blum", "MOVENTO BLUMOTION (coppia)"), "Blum MOVENTO BLUMOTION");
  });
  test("un nume cu cod, cu «cod/ofertă» sau prea lung nu se oferă", () => {
    for (const n of ["Striscia LED (Emuca 5220220)", "Piastra (codice da oferta: de confermare)", "TANDEM 19 mm (560F / 550F)", "Ghidaj NL 250", "x".repeat(80)])
      assert.equal(L("Emuca", n), null, n);
    assert.equal(L("—", "Pomolo Ø35"), "Pomolo Ø35");
    assert.equal(P.presentHwLabel(null, "it"), null);
  });
  test("ordinea: cea curentă prima, apoi potrivire și preț; etichete unice; plafon", () => {
    const l = [{ id: "a", label: "A", price: 5, rank: 0 }, { id: "b", label: "B", price: 2, rank: 1000 }, { id: "c", label: "C", price: 1, rank: 0 }, { id: "d", label: "c", price: 9, rank: 0 }, { id: "e", label: "E", price: 3, rank: 0 }];
    assert.deepEqual(J(P.presentHwPick(l, "b", 3).map(o => o.id)), ["b", "c", "e"]);
    assert.deepEqual(J(P.presentHwPick(l, "zzz", 9).map(o => o.id)), ["c", "e", "a", "b"]);
  });
  test("balamalele încastrate nu se schimbă cu cele aplicate; restul categoriilor nu au clase", () => {
    assert.equal(P.presentHwSameKind("cern", "Häfele Metalla 110° inset + plate", "Blum CLIP top 110°"), false);
    assert.equal(P.presentHwSameKind("cern", "Blum CLIP top 110°", "Häfele Metalla 110° full overlay"), true);
    assert.equal(P.presentHwSameKind("man", "inset knob", "bow handle"), true);
  });
});

describe("texte: 7 limbi", () => {
  test("fiecare cheie are 7 texte nevide, cu aceleași {substituții}", () => {
    const ph = x => (x.match(/\{\w+\}/g) || []).sort().join();
    for (const k of Object.keys(T.PRESENT_I18N_RAW)) {
      const r = T.PRESENT_I18N_RAW[k]; assert.equal(r.length, T.PRESENT_LANGS.length, k);
      r.forEach((x, i) => { assert.ok(x && x.trim(), k + " " + i); assert.equal(ph(x), ph(r[0]), k); });
    }
  });
  test("cheile folosite de index.html există", () => {
    const html = fs.readFileSync(path.join(APP, "index.html"), "utf8");
    const used = new Set([...html.matchAll(/ts\("(pr[A-Z]\w+)"\)/g)].map(m => m[1]));
    P.PRESENT_STEPS.forEach(s => { used.add("pr" + s[0].toUpperCase() + s.slice(1) + "T"); used.add("pr" + s[0].toUpperCase() + s.slice(1) + "D"); });
    for (const k of used) assert.ok(T.PRESENT_I18N.it[k], "lipsește " + k);
  });
  test("niciun text nu spune ceva tehnic sau intern", () => {
    const bad = /distinta|manodopera|margine|sfrido|€\s*\/\s*m²|\bcod(e|ice)?\b/i;
    for (const k of Object.keys(T.PRESENT_I18N_RAW)) assert.ok(!bad.test(T.PRESENT_I18N_RAW[k][0]), k);
  });
  test("modulele sunt în service worker și în index.html", () => {
    const sw = fs.readFileSync(path.join(APP, "sw.js"), "utf8"), html = fs.readFileSync(path.join(APP, "index.html"), "utf8");
    for (const f of ["ebanist-present.js", "ebanist-present-i18n.js"]) { assert.ok(sw.includes(f), "sw " + f); assert.ok(html.includes('src="./' + f + '"'), "html " + f); }
  });
});
