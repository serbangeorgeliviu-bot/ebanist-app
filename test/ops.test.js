/* Ebanist — il Modello di Operazioni (fori per pezzo).
 *
 *   node --test test/ops.test.js
 *
 * Non controlla che le cote di ferramenta siano quelle del catalogo — quelle
 * sono dati, marcati `verificat:false`. Controlla che il generatore sia
 * coerente con se stesso e con il mobile: ogni foro sta DENTRO il suo pezzo,
 * nessun foro buca un pezzo per sbaglio, due fori non si mangiano, e lo
 * stesso mobile da sempre gli stessi fori.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });

function gen(cfg) { return genWith(cfg, {}); }
function genWith(cfg, hwProd) {
  /* il motore di test non carica il catalogo (HWDB sta fuori dalla geometria):
     la domanda «la maniglia scelta e un profilo?» la simula, e il test sotto
     controlla che nel catalogo vero il profilo gola sia marcato cosi */
  S.handleIsProfile = () => !!(hwProd && /^haf_profil$/.test(hwProd.man || ""));
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k",
    matOvr: {}, matAdd: [MM("__b", 18), MM("__k", 3), MM("__k8", 8)], hwProd: Object.assign({ guida: "blum_tandem" }, hwProd) };
  const full = Object.assign({ name: "M", matBody: "__b", matFront: "__b", matBack: "__k" }, cfg);
  const b = S.buildModule(full);
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  return { b, o: JSON.parse(JSON.stringify(S.generateOperations({ boxes: b.boxes, cfg: full, G }))) };
}
const ARM = { type: "standard", L: 1000, H: 2200, P: 600, plinth: 80, tram: 1, shelves: 3, drawers: 0,
  doors: 2, back: 1, hang: 0, support: "zoccolo", shelfType: "mobile" };
const CASE = {
  "armadio 2 ante, tramezzo": ARM,
  "base a cassetti": { ...ARM, L: 600, H: 720, P: 560, tram: 0, shelves: 0, doors: 0, drawers: 3 },
  "libreria ripiani fissi": { ...ARM, L: 1200, H: 1800, P: 350, doors: 0, shelfType: "fisso" },
  "bagno con gradino": { ...ARM, L: 800, H: 850, P: 460, plinth: 100, tram: 0, shelves: 1, stepH: 300, stepP: 80 },
  "sospeso push": { ...ARM, L: 900, H: 600, P: 350, support: "sospeso", plinth: 0, tram: 0, handles: "push", shelves: 1 },
  "angolare": { ...ARM, type: "angolare", L: 1000, L2: 900, H: 720, P: 560, tram: 0, shelves: 1 }
};

for (const [nome, cfg] of Object.entries(CASE)) describe(nome, () => {
  const { o } = gen(cfg);
  const drills = o.pieces.flatMap(p => p.operations.filter(x => x.type === "drill").map(x => ({ p, x })));
  test("genera fori", () => assert.ok(drills.length > 0));
  test("nessun errore di pre-flight (V1 V3 V4 V5)", () => {
    const err = o.pieces.flatMap(p => p.preflight.filter(w => w.level === "error").map(w => p.role + " " + w.rule + " " + w.op));
    assert.deepEqual(err, []);
  });
  test("ogni foro in faccia sta dentro il contorno del pezzo", () => {
    for (const { p, x } of drills) if (x.face >= 5) {
      assert.ok(x.x >= 0 && x.x <= p.length && x.y >= 0 && x.y <= p.width, p.role + " " + x.id + " " + x.x + "," + x.y);
    }
  });
  test("profondita mai oltre la grossezza meno 2, se non passante", () => {
    for (const { p, x } of drills) if (!x.through && x.face >= 5) assert.ok(x.depth <= p.thickness - 2 + 0.05, p.role + " " + x.id);
  });
  test("id delle operazioni unici per pezzo", () => {
    for (const p of o.pieces) { const ids = p.operations.map(x => x.id); assert.equal(new Set(ids).size, ids.length); }
  });
  test("deterministico", () => assert.equal(JSON.stringify(gen(cfg).o), JSON.stringify(o)));
});

describe("La ferramenta genera i suoi fori", () => {
  const { o } = gen(ARM);
  const count = (t) => o.hw.filter(h => h.type === t).length;
  test("cerniere: una per posizione, per anta", () => {
    const doors = o.pieces.filter(p => p.role === "frontale");
    const cups = doors.flatMap(p => p.operations.filter(x => x.note === "tazza cerniera"));
    assert.equal(cups.length, count("cerniera"));
    assert.ok(cups.every(c => c.dia === 35 && c.face === 5));
  });
  test("ogni cerniera ha la sua basetta sul fianco (2 fori)", () => {
    const plates = o.pieces.flatMap(p => p.operations.filter(x => x.note === "basetta cerniera"));
    assert.equal(plates.length, 2 * count("cerniera"));
  });
  test("tazza a 5 mm dal bordo (distanza dal cant di deriveCarcass)", () => {
    const d = o.pieces.find(p => p.role === "frontale");
    const cup = d.operations.find(x => x.note === "tazza cerniera");
    const edge = Math.min(cup.x, d.length - cup.x, cup.y, d.width - cup.y);
    assert.equal(edge - 17.5, 5);
  });
  test("i reggipiani del tramezzo passano da parte a parte", () => {
    const t = o.pieces.find(p => p.role === "divisorio");
    assert.ok(t.operations.some(x => x.note.startsWith("reggipiano") && x.through));
  });
  test("lo schienale in cava da una cava su fianchi, base e cielo", () => {
    for (const r of ["fianco", "base", "cielo"])
      assert.ok(o.pieces.filter(p => p.role === r).every(p => p.operations.some(x => x.type === "groove")), r);
  });
});

describe("Push-open: niente fori di maniglia", () => {
  const { o } = gen(CASE["sospeso push"]);
  test("nessuna maniglia", () => assert.equal(o.hw.filter(h => h.type === "maniglia").length, 0));
});

/* Il lato cerniera scritto nelle ante a quota (`fronts[].hinge`) e quello che
   va in macchina: tazza sul bordo giusto dell'anta, basetta sul pezzo da
   quella parte, e il 3D apre di li. Prima andava perso in physicalPieces e
   restava la regola fissa (anta sola a sinistra, coppie sx/dx). */
describe("Ante a quota: il lato cerniera scelto", () => {
  const BASE = { ...ARM, L: 900, H: 720, P: 560, plinth: 100, tram: 0, shelves: 1, doors: 2 };
  const side = o => o.hw.filter(h => h.type === "cerniera");
  const byDoor = o => { const m = {}; side(o).forEach(h => { (m[h.piece] = m[h.piece] || new Set()).add(h.hingeLeft); }); return m; };
  const doorX = (b, pk) => Math.min(...b.boxes.filter(x => String(x.pk) === String(pk)).map(x => x.x0));

  test("anta singola con cerniere a destra", () => {
    const { o } = gen({ ...BASE, L: 450, doors: 1, fronts: [{ x: 0, y: 100, w: 450, h: 620, hinge: "right" }] });
    const hs = side(o);
    assert.ok(hs.length >= 2);
    assert.ok(hs.every(h => h.hingeLeft === false));
    const d = o.pieces.find(p => p.role === "frontale");
    const cup = d.operations.find(x => x.note === "tazza cerniera");
    assert.ok(Math.abs(cup.x - (d.length - 22.5)) < 1e-6 || Math.abs(cup.y - (d.width - 22.5)) < 1e-6, "tazza sul bordo destro");
  });
  test("coppia invertita: sinistra apre a destra, destra apre a sinistra", () => {
    const { b, o } = gen({ ...BASE, fronts: [
      { x: 0, y: 100, w: 448, h: 620, hinge: "right" }, { x: 452, y: 100, w: 448, h: 620, hinge: "left" }] });
    const m = byDoor(o), pks = Object.keys(m).sort((a, c) => doorX(b, a) - doorX(b, c));
    assert.equal(pks.length, 2);
    assert.deepEqual([...m[pks[0]]], [false]);
    assert.deepEqual([...m[pks[1]]], [true]);
  });
  test("senza hinge resta la regola di prima", () => {
    const { b, o } = gen({ ...BASE, fronts: [
      { x: 0, y: 100, w: 448, h: 620 }, { x: 452, y: 100, w: 448, h: 620 }] });
    const m = byDoor(o), pks = Object.keys(m).sort((a, c) => doorX(b, a) - doorX(b, c));
    assert.deepEqual([...m[pks[0]]], [true]);
    assert.deepEqual([...m[pks[1]]], [false]);
  });
  test("invertita con setto al centro: la basetta va sul setto", () => {
    const { o } = gen({ ...BASE, partitions: [{ type: "setto", x: "center" }], fronts: [
      { x: 0, y: 100, w: 448, h: 620, hinge: "right" }, { x: 452, y: 100, w: 448, h: 620, hinge: "left" }] });
    assert.equal(o.hw.filter(h => h.type === "cerniera" && !h.against).length, 0);
    assert.equal(o.warnings.filter(w => w.k === "opsNoHingePanel").length, 0);
  });
});

/* Un profilo gola scelto in catalogo come «maniglia» non fora il frontale:
   prima i frontali uscivano con i due fori da 128 mm di una maniglia vera. */
describe("Profilo gola in catalogo: niente fori di maniglia", () => {
  const CFG = { ...ARM, L: 900, H: 720, P: 560, plinth: 100, tram: 0, shelves: 1, doors: 2 };
  const handles = o => o.hw.filter(h => h.type === "maniglia").length;
  test("con la maniglia di catalogo i fori ci sono", () => assert.ok(handles(gen(CFG).o) > 0));
  test("con il profilo gola no, e le cerniere restano", () => {
    const { o } = genWith(CFG, { man: "haf_profil" });
    assert.equal(handles(o), 0);
    assert.ok(o.hw.filter(h => h.type === "cerniera").length > 0);
  });
  test("cassettiera con profilo gola: nessun foro di maniglia sui frontali", () => {
    const { o } = genWith({ ...CFG, doors: 0, shelves: 0, drawers: 3 }, { man: "haf_profil" });
    assert.equal(handles(o), 0);
  });
});

test("nel catalogo il profilo gola e marcato profile:1, e handleIsProfile lo legge", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "app", "index.html"), "utf8");
  assert.match(html, /\{id:"haf_profil",[^\n]*profile:1\}/);
  assert.match(html, /function handleIsProfile\(\)\{[^\n]*hwItem\("man"\)[^\n]*it\.profile/);
});
