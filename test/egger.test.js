/* Ebanist — prove pentru catalogul Egger si texturile 3D.
 *
 *   cd test && node --test egger.test.js
 *
 * Ruleaza pe fisierele REALE. Apara trei lucruri:
 *   - niciun cod/nume inventat: fiecare intrare are codul, structura, numele in 7 limbi, culoare valida si URL-ul paginii Egger din care vine;
 *   - referintele vechi nu se misca: valorile rezolvate ale celor 54 de materiale din 5.89.0 sunt identice (golden);
 *   - fiecare `grana` indica un fisier care exista, e in SHELL-ul service worker-ului si are o regula in viewer.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const APP = path.resolve(__dirname, "..", "app");
const rd = f => fs.readFileSync(path.join(APP, f), "utf8");
const EG = JSON.parse(rd("data/materials-egger.json"));
const CL = JSON.parse(rd("data/materials-centro-legno.json"));
const LEG = JSON.parse(rd("data/materials-legacy.json"));
const WTP = JSON.parse(rd("data/materials-worktops.json"));
const INDEX = rd("index.html"), VIEWER = rd("viewer3d.js"), SW = rd("sw.js");
const GOLD = JSON.parse(fs.readFileSync(path.join(__dirname, "materials-resolved.golden.json"), "utf8")).materials;
const LANGS = ["it", "ro", "en", "fr", "de", "pl", "es"];

const FAMILIES = (INDEX.match(/^const FAMIGLIE=\[([^\]]*)\]/m)[1].match(/"([a-z_]+)"/g) || []).map(x => x.replace(/"/g, ""));
const KINDS = (() => { const b = VIEWER.match(/const GRAIN_KINDS = \{([\s\S]*?)\n\};/)[1]; return [...b.matchAll(/^\s{2}([a-z]+):\s*\{/gm)].map(m => m[1]).concat([...b.matchAll(/, ([a-z]+): \{ m:/g)].map(m => m[1])); })();

function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const mk = buf[i + 1];
    if (mk >= 0xc0 && mk <= 0xc3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

function sandbox() {
  const html = INDEX.split("\n");
  const slice = (a, b) => { let i = html.findIndex(l => a.test(l)); for (let j = i + 1; j < html.length; j++) if (b.test(html[j])) return html.slice(i, j).join("\n"); };
  const s = { console, Math, Number, String, Array, Object, JSON, isFinite, parseInt, parseFloat, Promise, Boolean, Error, Date,
    fetch: async url => { const f = path.join(APP, String(url).replace(/^\.\//, "")); if (!fs.existsSync(f)) return { ok: false }; return { ok: true, json: async () => JSON.parse(fs.readFileSync(f, "utf8")) }; } };
  s.globalThis = s; s.t = k => k;
  s.state = { lang: "it", settings: { matOvr: {}, matAdd: [], panelL: 2800, panelW: 2070 } };
  vm.createContext(s);
  vm.runInContext(slice(/^const MAT_SOURCES=/, /^function matPriceByLabel\(/), s, { filename: "catalogo" });
  vm.runInContext(slice(/^function matQueryHit\(/, /^function renderMatPick\(/), s, { filename: "cerca" });
  return s;
}

describe("Catalogul Egger: fiecare intrare", () => {
  test("sunt intre 60 si 130 de decoruri", () => assert.ok(EG.materiali.length >= 60 && EG.materiali.length <= 130, String(EG.materiali.length)));
  test("furnizorul e Egger, formatul fisierului e cel al celorlalte", () => {
    assert.equal(EG.schema, 1); assert.equal(EG.fornitore, "Egger");
    for (const k of ["_nota_fonte", "_nota_colori", "_nota_spessore", "_nota_nomi"]) assert.ok(EG[k] && EG[k].length > 40, k);
    assert.match(EG._nota_fonte, /egger\.com/);
  });
  test("id unic, in fisier si fata de celelalte trei catalog", () => {
    const old = new Set([CL, LEG, WTP].flatMap(d => d.materiali.map(m => m.id)));
    const seen = new Set();
    for (const m of EG.materiali) {
      assert.ok(m.id && /^egger_[a-z0-9_]+$/.test(m.id), "id: " + m.id);
      assert.ok(!seen.has(m.id), "id repetat: " + m.id); seen.add(m.id);
      assert.ok(!old.has(m.id), "id ciocneste cu un catalog existent: " + m.id);
    }
  });
  test("cod si structura nenule, coerente cu id-ul si cu URL-ul sursei; nicio pereche cod+structura repetata", () => {
    const pairs = new Set();
    for (const m of EG.materiali) {
      assert.match(m.codice, /^[UWHF]\d{3,4} ST\d+$/, m.id + ": cod");
      assert.equal(m.decor + " " + m.struttura, m.codice, m.id);
      assert.equal(m.id, `egger_${m.decor.toLowerCase()}_${m.struttura.toLowerCase()}_${m.spessore}`, m.id + ": id nu urmeaza codul");
      assert.ok(m.fonte.startsWith("https://www.egger.com/en/furniture-interior-design/decors/" + m.decor + "_"), m.id + ": fonte");
      assert.ok(m.fonte.includes("_" + m.struttura.slice(2) + "?"), m.id + ": fonte nu e a structurii");
      assert.ok(!pairs.has(m.codice), "dublura " + m.codice); pairs.add(m.codice);
      assert.ok(m.nome_ufficiale && m.nome_ufficiale.length > 2, m.id + ": nume oficial");
    }
  });
  test("numele exista in cele 7 limbi (siruri nevide)", () => {
    for (const m of EG.materiali) {
      assert.deepEqual(Object.keys(m.nome_i18n).sort(), [...LANGS].sort(), m.id);
      for (const l of LANGS) assert.ok(typeof m.nome_i18n[l] === "string" && m.nome_i18n[l].trim().length > 1, m.id + " " + l);
      assert.equal(m.nome, m.nome_i18n.it, m.id);
      assert.equal(m.nome_i18n.en, m.nome_ufficiale, m.id + ": engleza trebuie sa fie numele publicat");
    }
  });
  test("culoare hex valida, NEverificata (e media unei reproduceri), cu sursa; pret null; texture_url null", () => {
    for (const m of EG.materiali) {
      assert.match(m.colore_hex, /^#[0-9A-Fa-f]{6}$/, m.id);
      assert.equal(m.colore_verificato, false, m.id);
      assert.ok(m.colore_fonte, m.id);
      assert.equal(m.prezzo_mq, null, m.id + ": pretul e al utilizatorului");
      assert.equal(m.texture_url, null, m.id + ": nicio imagine Egger in repo");
    }
  });
  test("grosimea e un SCALAR numeric > 0 (D-41)", () => {
    for (const m of EG.materiali) { assert.equal(typeof m.spessore, "number", m.id); assert.ok(m.spessore > 0, m.id); }
  });
  test("familia e una pe care selectorul o stie, si are eticheta in 7 limbi", () => {
    for (const m of EG.materiali) assert.ok(FAMILIES.includes(m.famiglia), m.id + ": " + m.famiglia);
    for (const f of new Set(EG.materiali.map(m => m.famiglia)))
      assert.equal((INDEX.match(new RegExp('"?fam_' + f + '"?:"', "g")) || []).length, 7, "fam_" + f + " nu e in toate cele 7 limbi");
  });
  test("tipul de textura (`grana`) exista ca fisier, are regula in viewer si e in SHELL", () => {
    for (const m of EG.materiali) {
      if (!m.grana) continue;
      assert.ok(fs.existsSync(path.join(APP, "img/grain", m.grana + ".jpg")), m.id + ": lipseste img/grain/" + m.grana + ".jpg");
      assert.ok(KINDS.includes(m.grana), m.id + ": GRAIN_KINDS nu cunoaste " + m.grana);
      assert.ok(SW.includes(`"./img/grain/${m.grana}.jpg"`), m.id + ": " + m.grana + ".jpg nu e in SHELL");
    }
  });
  test("familiile din lista Egger sunt mapate sensibil la texturi", () => {
    const by = f => new Set(EG.materiali.filter(m => m.famiglia === f).map(m => m.grana || null));
    for (const g of by("cemento")) assert.equal(g, "concrete");
    for (const g of by("metallo")) assert.equal(g, "metal");
    for (const g of by("tessuto")) assert.equal(g, "linen");
    for (const g of by("legno")) assert.ok(["oak", "ash", "walnut", "beech", "maple", "cherry", "pine", "wenge", null].includes(g));
    for (const m of EG.materiali.filter(x => x.famiglia === "tinta_unita")) assert.ok(!m.grana, m.id + ": uni nu are fibra");
  });
});

describe("Texturile 3D", () => {
  const files = fs.readdirSync(path.join(APP, "img/grain")).filter(f => f.endsWith(".jpg"));
  test("sunt cele 12 asteptate, 1024x1024, <= ~205 KB", () => {
    assert.deepEqual(files.map(f => f.slice(0, -4)).sort(), ["ash", "beech", "cherry", "concrete", "linen", "maple", "metal", "oak", "pine", "stone", "walnut", "wenge"]);
    for (const f of files) {
      const b = fs.readFileSync(path.join(APP, "img/grain", f));
      assert.ok(b.length <= 210000, f + " " + b.length);
      const d = jpegSize(b); assert.deepEqual(d, { w: 1024, h: 1024 }, f);
    }
  });
  test("fiecare fisier din img/grain e in SHELL si in GRAIN_KINDS", () => {
    for (const f of files) { assert.ok(SW.includes(`"./img/grain/${f}"`), f + " lipseste din SHELL"); assert.ok(KINDS.includes(f.slice(0, -4)), f); }
  });
  test("LICENSE.txt numeste sursa si licenta fiecarui fisier", () => {
    const L = fs.readFileSync(path.join(APP, "img/grain/LICENSE.txt"), "utf8");
    assert.match(L, /CC0/);
    for (const f of files) assert.ok(L.includes(f), "LICENSE.txt nu pomeneste " + f);
  });
  test("fara `grana`, regula de luminanta ramane (grainKind + ramura r.grain intacte)", () => {
    assert.match(VIEWER, /return l > 0\.55 \? "ash" : l > 0\.27 \? "oak" : "walnut"/);
    assert.match(VIEWER, /grainApply\(grainKind\(info\.c\), m\)/);
    assert.match(VIEWER, /info\.grana && info\.tx !== "gloss" && !ID_OVR\[key\]/);
  });
});

describe("Incarcarea in aplicatie", () => {
  const S = sandbox();
  test("MAT_SOURCES include fisierul Egger, in SHELL, iar totalul e suma fisierelor", async () => {
    assert.match(INDEX, /const MAT_SOURCES=\[[^\]]*materials-egger\.json/);
    assert.ok(SW.includes('"./data/materials-egger.json"'));
    await S.MAT_READY;
    assert.equal(S.MATDB.length, CL.materiali.length + EG.materiali.length + LEG.materiali.length + WTP.materiali.length);
  });
  test("un decor Egger se rezolva cu grosime, cod, familie, grana si furnizor", async () => {
    await S.MAT_READY;
    const m = S.matById("egger_h1180_st37_18");
    assert.equal(m.th, 18); assert.equal(m.codice, "H1180 ST37"); assert.equal(m.famiglia, "legno");
    assert.equal(m.grana, "oak"); assert.equal(m.sup, "Egger"); assert.equal(m.tx, "wood"); assert.equal(m.priced, false);
    assert.equal(m.label, "Rovere Halifax naturale");
    S.state.lang = "en"; assert.equal(S.matById("egger_h1180_st37_18").label, "Natural Halifax Oak"); S.state.lang = "it";
    assert.equal(S.matById("egger_f186_st9_18").tx, "solid");
  });
  test("toate decorurile Egger sunt vizibile si selectabile", async () => {
    await S.MAT_READY;
    const vis = new Set(S.matVisible().map(m => m.id));
    for (const m of EG.materiali) assert.ok(vis.has(m.id), m.id);
  });
  test("REGRESIE: valorile rezolvate ale celor 54 de materiale vechi sunt identice cu 5.89.0", async () => {
    await S.MAT_READY;
    const keys = ["th", "c", "tx", "price", "priced", "famiglia", "finitura", "codice", "sup", "pw", "ph", "noEdge", "attivo", "coloreVerificato", "l", "label"];
    assert.equal(Object.keys(GOLD).length, 54);
    for (const [id, g] of Object.entries(GOLD)) {
      const e = S.matById(id); assert.ok(e, id + ": nu se mai rezolva");
      for (const k of keys) assert.deepEqual(e[k], g[k], id + "." + k);
      assert.ok(!e.grana, id + ": un material vechi nu poate primi `grana`");
    }
  });
  test("ordinea vechi→nou: primul fisier castiga, deci niciun id vechi nu poate fi acoperit de Egger", async () => {
    await S.MAT_READY;
    const ids = S.MATDB.map(m => m.id);
    assert.equal(new Set(ids).size, ids.length);
  });
  test("cautarea gaseste dupa cod (cu/fara spatii), nume in orice limba, nume oficial", async () => {
    await S.MAT_READY;
    const hit = (id, q) => S.matQueryHit(S.matById(id), q);
    assert.ok(hit("egger_h1145_st10_18", "h1145"));
    assert.ok(hit("egger_h1145_st10_18", "h1145 st10"));
    assert.ok(hit("egger_h1145_st10_18", "h1145st10"));
    assert.ok(hit("egger_h1180_st37_18", "halifax"));
    assert.ok(hit("egger_h1180_st37_18", "eiche"));           // nume german, afisarea e in italiana
    assert.ok(hit("egger_h1180_st37_18", "egger"));
    assert.ok(!hit("egger_h1180_st37_18", "u702"));
    assert.ok(hit("bianco_19", "bianco"));                     // vechiul continua sa mearga
  });
  test("proiect nou: materialul implicit nu s-a schimbat (19 mm, Centro Legno)", () => {
    const m = INDEX.match(/matBody:\s*"([^"]+)"/);
    assert.ok(!m || !/^egger_/.test(m[1]), "matBody implicit nu poate fi Egger");
    assert.ok(!/matBody:\s*"egger_/.test(INDEX) && !/matFront:\s*"egger_/.test(INDEX));
  });
});

describe("Interfata", () => {
  test("cheile i18n noi exista in toate cele 7 limbi", () => {
    for (const k of ["catMatMore", "fam_pietra", "fam_metallo"])
      assert.equal((INDEX.match(new RegExp('"?' + k + '"?:"', "g")) || []).length, 7, k);
  });
  test("selectorul are filtre de furnizor si familie, cautarea de catalog exista", () => {
    for (const id of ["matPickSup", "matPickFam", "catMatQ", "catMatSup"]) assert.ok(INDEX.includes('id="' + id + '"'), id);
  });
});
