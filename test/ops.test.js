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

function gen(cfg) {
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k",
    matOvr: {}, matAdd: [MM("__b", 18), MM("__k", 3), MM("__k8", 8)], hwProd: { guida: "blum_tandem" } };
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
