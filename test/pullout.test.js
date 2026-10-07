/* Ebanist — U.12: ripiani estraibili.
 *
 *   node --test test/pullout.test.js
 *
 * Nella sezione segnata in `secPull` i ripiani escono su guide: al loro posto
 * un vassoio basso (la cassa di un cassetto senza frontale), alla stessa
 * quota. Quello che deve restare vero:
 *  - un progetto senza `secPull` genera la distinta di prima;
 *  - i ripiani della sezione spariscono, i vassoi e le loro guide compaiono;
 *  - il 3D disegna gli stessi pezzi della distinta e il gabarito si chiude;
 *  - ogni vassoio ha la sua coppia di guide forata sui fianchi.
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
  const full = Object.assign({ name: "R", matBody: "__b", matFront: "__b", matBack: "__k" }, cfg);
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
const rows = ps => ps.map(p => [p.elemento, p.lung, p.larg, p.pz, p.role, p.sp].join("|"));
const trays = b => new Set(b.boxes.filter(x => /^p\d+_\d+$/.test(x.grp || "")).map(x => x.grp));

/* due sezioni a ripiani, ante: il vano attrezzature */
const ARM = { type: "standard", L: 1200, H: 900, P: 560, plinth: 100, tram: 1, shelves: 2, drawers: 0,
  doors: 2, back: 1, hang: 0, support: "zoccolo", shelfType: "mobile", drawerSys: "legno" };
/* l'ultima sezione della foto: un cassetto profondo e sopra il vassoio */
const FOTO = { type: "standard", L: 2400, H: 900, P: 560, plinth: 100, tram: 3, shelves: 1, drawers: 4,
  doors: 4, back: 1, hang: 0, support: "zoccolo", shelfType: "mobile", drawerSys: "legno",
  drawerDist: "fix", drawerFH: 150, drawerPos: "interno", drawerInset: 35,
  secMode: ["drawers", "drawers", "drawers", "drawerShelf"], secDrawers: [null, null, 3, 1], secPull: [0, 0, 0, 1] };

describe("Un progetto senza secPull non cambia", () => {
  test("vuoto, tutto a zero, o segnato su una sezione senza ripiani", () => {
    const a = rows(build(ARM).pieces);
    assert.deepEqual(rows(build({ ...ARM, secPull: [0, 0] }).pieces), a);
    assert.deepEqual(rows(build({ ...ARM, shelves: 0, secPull: [1, 1] }).pieces), rows(build({ ...ARM, shelves: 0 }).pieces));
  });
});

describe("Vano a ripiani, sezione 2 estraibile", () => {
  const B = build({ ...ARM, secPull: [0, 1] });
  const base = build(ARM);
  test("i ripiani della sezione 2 diventano due vassoi", () => {
    assert.equal(sum(B.pieces, /^ripiano/i), sum(base.pieces, /^ripiano/i) - 2);
    assert.equal(sum(B.pieces, /^fondo ripiano estraibile/i), 2);
    assert.equal(sum(B.pieces, /^fianco ripiano estraibile/i), 4);
    assert.equal(trays(B.b).size, 2);
  });
  test("il vassoio sta alla quota del ripiano che sostituisce", () => {
    const ys = arr(base.pieces.find(p => p.role === "ripiano").ys);
    const tR = 19;
    const y0 = [...trays(B.b)].map(g => Math.min(...B.b.boxes.filter(x => x.grp === g).map(x => x.y0))).sort((a, b) => a - b);
    assert.deepEqual(y0.map(Math.round), ys.map(y => Math.round(y - tR / 2)));
  });
  test("sponde basse: 70 mm", () => {
    assert.equal(B.pieces.find(p => /^fianco ripiano estraibile/i.test(p.elemento)).larg, 70);
  });
  test("chiusura e invarianti", () => {
    assert.deepEqual(B.close(), []);
    assert.deepEqual(B.ko(), []);
  });
  test("una coppia di guide forata per ogni vassoio", () => {
    const g = arr(B.ops().hw).filter(h => h.type === "guida");
    assert.equal(g.length, 4);
  });
  test("ogni pezzo del vassoio in 3D ha la sua riga di distinta", () => {
    const bad = [];
    for (const p of B.ops().pieces) {
      if (!/^cassetto/.test(p.role)) continue;
      const a = [+p.length, +p.width].sort((x, y) => y - x);
      if (!B.pieces.some(r => r.role === p.role && Math.abs(Math.max(r.lung, r.larg) - a[0]) <= 0.5 && Math.abs(Math.min(r.lung, r.larg) - a[1]) <= 0.5))
        bad.push(p.role + " " + a.join("×"));
    }
    assert.deepEqual(bad, []);
  });
});

describe("La foto: 4 / 4 / 3 cassetti, poi un cassetto con il vassoio sopra", () => {
  const B = build(FOTO);
  test("12 cassetti, 1 vassoio, nessun ripiano", () => {
    assert.equal(sum(B.pieces, /^frontale cassetto/i), 12);
    assert.equal(sum(B.pieces, /^fondo ripiano estraibile/i), 1);
    assert.equal(sum(B.pieces, /^ripiano/i), 0);
  });
  test("il vassoio sta sopra il cassetto della sua sezione", () => {
    const g1 = arr(B.b.draws).find(g => g.N === 1).plan;
    const y = Math.min(...B.b.boxes.filter(x => x.grp === "p3_0").map(x => x.y0));
    assert.ok(y > g1.top, y + " vs " + g1.top);
  });
  test("chiusura e invarianti", () => {
    assert.deepEqual(B.close(), []);
    assert.deepEqual(B.ko(), []);
  });
});

describe("Sistema metallico", () => {
  test("il vassoio prende l'altezza di listino piu bassa", () => {
    const B = build({ ...ARM, P: 560, drawerSys: "tandembox", secPull: [1, 0] });
    assert.ok(B.b.pull && B.b.pull.plan.ok);
    const codes = Object.keys(B.b.pull.plan.sys.hs);
    assert.equal(B.b.pull.plan.hcode, codes[0]);
    assert.equal(sum(B.pieces, /^fondo ripiano estraibile/i), 2);
    assert.deepEqual(B.close(), []);
  });
});
