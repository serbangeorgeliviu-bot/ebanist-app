/* Ebanist — U.13: l'altezza di ogni frontale di cassetto, scritta a mano.
 *
 *   node --test test/drawerh.test.js
 *
 * `secDrawerH[si]` = le altezze dei frontali della sezione, dall'ALTO in
 * basso, come le scrive l'utente. Se ci sono, i cassetti della sezione sono
 * quelli: il numero viene da loro.
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
  const full = Object.assign({ name: "H", matBody: "__b", matFront: "__b", matBack: "__k" }, cfg);
  const b = S.buildModule(full);
  const pieces = b.pieces.map(x => Object.assign({}, x));
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  const M = S.carcassMaterials(full);
  const ths = [...new Set(Object.values(M.sp).concat(pieces.map(x => x.sp)).filter(x => x > 0))];
  return { b, pieces, G,
    close: () => arr(S.validateCarcassClosure(full, pieces, G)),
    ko: () => arr(S.failedInvariants(full, pieces, G, { materials: M.mats, thicknesses: ths })).map(r => r.id),
    ops: () => S.generateOperations({ boxes: b.boxes, cfg: full, G }) };
}
const fronts = ps => ps.filter(p => /^frontale cassetto/i.test(p.elemento)).map(p => [p.lung, p.pz]);
/* il mobile del tester: alto 800, due sezioni con due cassetti */
const BASE = { type: "standard", L: 1200, H: 800, P: 560, plinth: 100, tram: 1, shelves: 0, drawers: 2,
  doors: 0, back: 1, hang: 0, support: "zoccolo", shelfType: "mobile", drawerSys: "legno", drawerDist: "uguali" };

describe("Un progetto senza secDrawerH non cambia", () => {
  test("vuoto o tutto null", () => {
    const a = JSON.stringify(build(BASE).pieces);
    assert.equal(JSON.stringify(build({ ...BASE, secDrawerH: [null, null] }).pieces), a);
  });
});

describe("Sezione 1: 200 sopra e 450 sotto; sezione 2: uguali", () => {
  const B = build({ ...BASE, secDrawerH: [[200, 450], null] });
  test("i frontali hanno le altezze scritte", () => {
    const f = fronts(B.pieces);
    assert.ok(f.some(([h, n]) => h === 200 && n === 1), JSON.stringify(f));
    assert.ok(f.some(([h, n]) => h === 450 && n === 1), JSON.stringify(f));
  });
  test("dal basso: 450 e poi 200", () => {
    const g = arr(B.b.draws).find(x => arr(x.secs).includes(0)).plan;
    assert.deepEqual(arr(g.fronts).map(f => f.h), [450, 200]);
    assert.ok(g.fronts[1].y0 > g.fronts[0].y0);
  });
  test("ogni cassa segue il SUO frontale: 450 → 405, 200 → 155", () => {
    const sides = B.pieces.filter(p => p.elemento === "Fianco cassetto").map(p => p.larg).sort((a, b) => a - b);
    assert.ok(sides.includes(155) && sides.includes(405), JSON.stringify(sides));
  });
  test("metallico: l'altezza di listino per ogni frontale", () => {
    const M = build({ ...BASE, drawerSys: "tandembox", secDrawerH: [[150, 450], null] });
    const g = arr(M.b.draws).find(x => arr(x.secs).includes(0)).plan;
    const hc = arr(g.fronts).map(f => f.hcode);
    assert.notEqual(hc[0], hc[1], JSON.stringify(hc));
    assert.deepEqual(M.close(), []);
  });
  test("la sezione 2 resta col suo piano di prima", () => {
    assert.equal(arr(B.b.draws).length, 2);
  });
  test("chiusura e invarianti", () => {
    assert.deepEqual(B.close(), []);
    assert.deepEqual(B.ko(), []);
  });
  test("ogni cassetto del 3D ha la sua riga", () => {
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

describe("Il numero viene dalle altezze", () => {
  test("tre altezze = tre cassetti, anche se «Cassetti/sez.» dice 2", () => {
    const B = build({ ...BASE, secDrawerH: [[150, 150, 300], null] });
    const g = arr(B.b.draws).find(x => arr(x.secs).includes(0));
    assert.equal(g.N, 3);
    assert.deepEqual(arr(g.plan.fronts).map(f => f.h), [300, 150, 150]);
  });
  test("altezze che non entrano: l'avviso wDrawOver", () => {
    const B = build({ ...BASE, secDrawerH: [[400, 400], null] });
    assert.ok(arr(B.b.warn.drawWarn).some(w => w.k === "wDrawOver"));
  });
});

describe("Adancimea del cassetto (secDrawerNL)", () => {
  const side = (B, si) => arr(B.b.draws).find(x => arr(x.secs).includes(si)).plan;
  test("NL 400 nella sezione 1, la 2 resta automatica", () => {
    const B = build({ ...BASE, secDrawerNL: [400, null] });
    assert.equal(side(B, 0).nl, 400);
    assert.equal(side(B, 1).nl, build(BASE).b.draw.nl);
    assert.ok(B.pieces.some(p => p.elemento === "Fianco cassetto" && p.lung === 400));
    assert.deepEqual(B.close(), []);
    assert.deepEqual(B.ko(), []);
  });
  test("una lunghezza fuori listino: la piu lunga sotto, con l'avviso", () => {
    const B = build({ ...BASE, secDrawerNL: [420, null] });
    assert.equal(side(B, 0).nl, 400);
    assert.ok(arr(B.b.warn.drawWarn).some(w => w.k === "wDrawNL" && w.got === 400));
  });
  test("piu di quanto entra: resta la massima, con l'avviso", () => {
    const B = build({ ...BASE, secDrawerNL: [900, null] });
    assert.equal(side(B, 0).nl, build(BASE).b.draw.nl);
    assert.ok(arr(B.b.warn.drawWarn).some(w => w.k === "wDrawNL"));
  });
  test("il 3D disegna la cassa corta", () => {
    const B = build({ ...BASE, secDrawerNL: [350, null] });
    const z = B.b.boxes.filter(x => /^d0_/.test(x.grp || "") && x.sub === "dbox");
    const len = Math.max(...z.map(x => x.z1)) - Math.min(...z.map(x => x.z0));
    assert.equal(Math.round(len), 350);
  });
  test("un progetto senza secDrawerNL non cambia", () => {
    assert.equal(JSON.stringify(build({ ...BASE, secDrawerNL: [null, null] }).pieces), JSON.stringify(build(BASE).pieces));
  });
});

describe("Meno altezze che cassetti: quelle scritte stanno in alto (video del tester)", () => {
  /* base 800, quattro cassetti, scrive solo «200» */
  const B = build({ ...BASE, tram: 0, L: 600, drawers: 4, secDrawerH: [[200]] });
  const p = B.b.draw;
  test("restano 4 cassetti", () => assert.equal(p.N, 4));
  test("in alto il 200, sotto tre uguali che riempiono il resto", () => {
    const h = arr(p.fronts).map(f => f.h);           // dal basso
    assert.equal(h[3], 200);
    assert.ok(Math.abs(h[0] - h[1]) < 0.01 && Math.abs(h[1] - h[2]) < 0.01, JSON.stringify(h));
    const full = build({ ...BASE, tram: 0, L: 600, drawers: 4 }).b.draw;
    const span = f => f.fronts[f.fronts.length - 1].y0 + f.fronts[f.fronts.length - 1].h - f.fronts[0].y0;
    assert.ok(Math.abs(span(p) - span(full)) < 0.01, "la colonna non occupa la stessa zona");
  });
  test("chiusura e invarianti", () => {
    assert.deepEqual(B.close(), []);
    assert.deepEqual(B.ko(), []);
  });
  test("«Fisse»: i cassetti che mancano prendono l'altezza fissa", () => {
    const F = build({ ...BASE, tram: 0, L: 600, drawers: 3, drawerDist: "fix", drawerFH: 180, secDrawerH: [[120]] });
    assert.deepEqual(arr(F.b.draw.fronts).map(f => f.h), [180, 180, 120]);
  });
});
