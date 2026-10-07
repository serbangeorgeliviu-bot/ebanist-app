/* Ebanist — U.11: un numero di cassetti diverso in ogni sezione.
 *
 *   node --test test/secdrawers.test.js
 *
 * Il caso vero (tester IT, 07.10.2026): un mobile da negozio a quattro
 * sezioni, 4 cassetti nella prima e nella seconda, 3 nella terza, uno solo
 * con ripiani sopra nella quarta. Prima «Cassetti/sez.» era un numero solo e
 * il preventivo si faceva con corpi separati: fianchi doppi invece dei
 * tramezzi.
 *
 * Quello che deve restare vero:
 *  - un progetto senza `secDrawers` genera la distinta di prima, riga per riga;
 *  - i frontali, le casse e le guide sono quelli delle sezioni, sommati;
 *  - il 3D disegna gli stessi cassetti della distinta;
 *  - il gabarito si richiude a 0 mm (D-43) e gli invarianti passano.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
const arr = x => Array.from(x || []);

function build(cfg) {
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k",
    matOvr: {}, matAdd: [MM("__b", 19), MM("__k", 3), MM("pfl5", 5)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "N", matBody: "__b", matFront: "__b", matBack: "__k" }, cfg);
  const b = S.buildModule(full);
  const pieces = b.pieces.map(x => Object.assign({}, x));
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  const M = S.carcassMaterials(full);
  const ths = [...new Set(Object.values(M.sp).concat(pieces.map(x => x.sp)).filter(x => x > 0))];
  return { b, full, pieces, G,
    close: () => arr(S.validateCarcassClosure(full, pieces, G)),
    ko: () => arr(S.failedInvariants(full, pieces, G, { materials: M.mats, thicknesses: ths })).map(r => r.id),
    ops: () => S.generateOperations({ boxes: b.boxes, cfg: full, G }) };
}
const sum = (ps, re) => ps.filter(p => re.test(p.elemento)).reduce((a, p) => a + p.pz, 0);
const fronts = ps => sum(ps, /^frontale cassetto/i);
const rows = ps => ps.map(p => [p.elemento, p.lung, p.larg, p.pz, p.role, p.sp].join("|"));
/* i cassetti del 3D: un gruppo per cassetto */
const drawerGroups = b => new Set(b.boxes.filter(x => x.grp && /^d\d+_\d+$/.test(x.grp)).map(x => x.grp)).size;

/* la base del negozio: quattro sezioni, cassetti a vista, nessuna anta */
const BASE = { type: "standard", L: 2400, H: 850, P: 560, plinth: 100, tram: 3, shelves: 0, drawers: 4,
  doors: 0, back: 1, hang: 0, support: "zoccolo", shelfType: "mobile", drawerSys: "legno", drawerDist: "uguali" };
/* l'armadio della foto: ante, cassetti dietro le ante, l'ultima sezione con un
   cassetto e i ripiani sopra. Frontali ad altezza fissa: con «uguali» la zona
   si divide fra i cassetti, e un cassetto solo la prende tutta. */
const ARM = { type: "standard", L: 2400, H: 900, P: 560, plinth: 100, tram: 3, shelves: 1, drawers: 4,
  doors: 4, back: 1, hang: 0, support: "zoccolo", shelfType: "mobile", drawerSys: "legno",
  drawerDist: "fix", drawerFH: 150, drawerPos: "interno", drawerInset: 35,
  secMode: ["drawers", "drawers", "drawers", "drawerShelf"] };

describe("Un progetto senza secDrawers non cambia", () => {
  for (const [nome, cfg] of [["base a cassetti", BASE], ["armadio, cassetti interni", ARM],
    ["metallici", { ...BASE, drawerSys: "tandembox" }]]) {
    test(nome, () => {
      const a = rows(build(cfg).pieces);
      assert.deepEqual(rows(build({ ...cfg, secDrawers: [null, null, null, null] }).pieces), a, "tutti vuoti");
      assert.deepEqual(rows(build({ ...cfg, secDrawers: [4, 4, 4, 4] }).pieces), a, "tutti uguali al comune");
    });
  }
});

describe("Base del negozio: 4 / 4 / 3 / 0", () => {
  const cfg = { ...BASE, secDrawers: [null, null, 3, 0] };
  const B = build(cfg);
  test("11 frontali, 11 casse", () => {
    assert.equal(fronts(B.pieces), 11);
    assert.equal(sum(B.pieces, /^fianco cassetto/i), 22);
    assert.equal(sum(B.pieces, /^fondo cassetto/i), 11);
    assert.equal(drawerGroups(B.b), 11);
  });
  test("due piani, uno per numero di cassetti", () => {
    const d = arr(B.b.draws).map(g => [g.N, arr(g.secs).join()]);
    assert.deepEqual(d, [[4, "0,1"], [3, "2"]]);
  });
  test("tre frontali piu alti di quattro, nella stessa zona", () => {
    const g = arr(B.b.draws);
    assert.ok(g[1].plan.fronts[0].h > g[0].plan.fronts[0].h);
  });
  test("il gabarito si richiude e gli invarianti passano", () => {
    assert.deepEqual(B.close(), []);
    assert.deepEqual(B.ko(), []);
  });
  test("nel 3D i cassetti stanno nelle sezioni giuste", () => {
    /* il 3D: nessun cassetto nella quarta sezione, tre nella terza */
    assert.ok(!B.b.boxes.some(x => /^d3_/.test(x.grp || "")));
    assert.equal(new Set(B.b.boxes.filter(x => /^d2_/.test(x.grp || "")).map(x => x.grp)).size, 3);
  });
});

describe("L'armadio della foto: 4 / 4 / 3 / 1 + ripiano", () => {
  const cfg = { ...ARM, secDrawers: [null, null, 3, 1] };
  const B = build(cfg);
  test("12 cassetti interni", () => {
    assert.equal(sum(B.pieces, /^frontale cassetto interno/i), 12);
    assert.equal(drawerGroups(B.b), 12);
  });
  test("il ripiano della quarta sezione sta sopra il SUO cassetto, non sopra quattro", () => {
    const g1 = arr(B.b.draws).find(g => g.N === 1).plan, g4 = arr(B.b.draws).find(g => g.N === 4).plan;
    const sh = B.pieces.find(p => p.role === "ripiano");
    assert.ok(sh, "manca il ripiano");
    const y = arr(sh.ys)[0];
    assert.ok(y > g1.top, "ripiano dentro il cassetto");
    assert.ok(y < g4.top, "il ripiano parte da sopra la colonna da quattro: " + y + " vs " + g4.top);
  });
  test("le ante restano intere (cassetti dietro)", () => {
    const ante = B.pieces.filter(p => /^anta/i.test(p.elemento));
    assert.ok(ante.length);
    assert.ok(ante.every(p => Math.max(p.lung, p.larg) > 700));
  });
  test("chiusura e invarianti", () => {
    assert.deepEqual(B.close(), []);
    assert.deepEqual(B.ko(), []);
  });
  test("ogni cassetto del 3D ha la sua riga di distinta", () => {
    const o = B.ops();
    const bad = [];
    for (const p of o.pieces) {
      if (!/^cassetto/.test(p.role)) continue;
      const a = [+p.length, +p.width].sort((x, y) => y - x);
      const ok = B.pieces.some(r => r.role === p.role &&
        Math.abs(Math.max(r.lung, r.larg) - a[0]) <= 0.5 && Math.abs(Math.min(r.lung, r.larg) - a[1]) <= 0.5);
      if (!ok) bad.push(p.role + " " + a.join("×"));
    }
    assert.deepEqual(bad, []);
  });
});

describe("Valori fuori misura", () => {
  test("oltre 8 si ferma a 8, negativo = 0", () => {
    const B = build({ ...BASE, secDrawers: [12, -2, null, null] });
    const d = arr(B.b.draws).map(g => [g.N, arr(g.secs).join()]);
    assert.deepEqual(d, [[8, "0"], [4, "2,3"]]);
  });
});
