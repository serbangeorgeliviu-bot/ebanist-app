/* Pașaportul proiectului (app/ebanist-passport.js): modelul și textele, fără DOM. Rulează: node --test passport.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm"), fs = require("node:fs"), path = require("node:path");
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-passport.js"), "utf8"), ctx);
const P = ctx.EBPassport;
const LANGS = ["it", "ro", "en", "fr", "de", "pl", "es"];

const H = {
  tot: p => ({ panelPcs: 12, panelArea: 7.3456, edge: 14.04, mats: {
    pal: { label: "PAL Alb", area: 5.5, edge: 10.04, pcs: 8 }, mdf: { label: "MDF 19", area: 1.8456, edge: 4, pcs: 4 }, asta: { label: "Accessorio — asta", area: 0.1, edge: 0, pcs: 1 } } }),
  isAcc: l => /^accessorio/i.test(l),
  matInfo: l => ({ "PAL Alb": { decor: "U999", code: "", supplier: "Egger", thickness: 18 }, "MDF 19": { decor: "", code: "MDF19", supplier: "", thickness: 19 } })[l],
  hardware: () => [{ name: "Cerniere", product: "Blum CLIP top", article: "71B3550", qty: 8 }, { name: "Mânere", product: "", article: "", qty: 4 }, { name: "Zero", product: "x", article: "y", qty: 0 }],
  edgeTh: () => 0.8, modules: () => 3
};
const P0 = { name: "Jacquin", client: "X", date: "2026-10-01" };

test("textele pașaportului: aceleași chei în toate cele 7 limbi, fără valori goale", () => {
  const ref = Object.keys(P.TXT.it).sort();
  for (const l of LANGS) {
    assert.deepEqual(Object.keys(P.TXT[l]).sort(), ref, "chei diferite în " + l);
    for (const [k, v] of Object.entries(P.TXT[l])) assert.ok(String(v).trim(), `${l}.${k} e gol`);
  }
  for (const l of LANGS) assert.ok(P.TXT[l].passEdgeNote.includes("{t}"), l);
  assert.equal(P.t("xx", "passTitle"), P.TXT.it.passTitle);
  assert.equal(P.t("ro", "nu-exista"), "nu-exista");
});

test("model: rezumat din totaluri, materiale fără accesorii, sortate, cu decor/furnizor/grosime", () => {
  const m = P.model(P0, H);
  assert.equal(m.summary.pieces, 12); assert.equal(m.summary.area, 7.35); assert.equal(m.summary.edge, 14); assert.equal(m.summary.modules, 3);
  assert.deepEqual(Array.from(m.materials.map(x => x.label)), ["MDF 19", "PAL Alb"], "accesoriul nu e material de placă");
  const pal = m.materials.find(x => x.label === "PAL Alb");
  assert.equal(pal.decor, "U999"); assert.equal(pal.supplier, "Egger"); assert.equal(pal.thickness, 18); assert.equal(pal.area, 5.5); assert.equal(pal.edgeMl, 10);
  assert.equal(m.edgeTh, 0.8);
});

test("model: ce nu se știe rămâne gol (niciun decor, cod sau furnizor inventat)", () => {
  const m = P.model(P0, Object.assign({}, H, { matInfo: () => undefined }));
  for (const x of m.materials) { assert.equal(x.decor, ""); assert.equal(x.code, ""); assert.equal(x.supplier, ""); assert.equal(x.thickness, null); }
});

test("model: feroneria — numai cantități pozitive; fără cod de articol → de confirmat", () => {
  const hw = P.model(P0, H).hardware;
  assert.equal(hw.length, 2);
  assert.equal(hw[0].article, "71B3550"); assert.equal(hw[0].verify, false);
  assert.equal(hw[1].name, "Mânere"); assert.equal(hw[1].verify, true);
});

test("model: proiect gol sau câmpuri lipsă nu aruncă", () => {
  const m = P.model({}, Object.assign({}, H, { tot: () => ({ panelPcs: 0, panelArea: 0, edge: 0, mats: {} }), hardware: () => null }));
  assert.equal(m.materials.length, 0); assert.equal(m.hardware.length, 0); assert.equal(m.project.name, "");
});
