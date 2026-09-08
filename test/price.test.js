/* Ebanist Order Rail — motorul de preț, fără browser.
 *
 *   cd test && npm run test:price
 *
 * Cazurile sunt calculate cu mâna în comentarii. Dacă o probă cade, se
 * verifică întâi aritmetica din comentariu: prețul e cifra pe care o
 * vede clientul, și dacă proba și devizul nu sunt de acord, unul dintre
 * ele minte.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "order-rail", "price.js"), "utf8");
const P = new Function(SRC + "\nreturn globalThis.EBPrice;")();

const LISTA = {
  default_m2: 140,
  m2: { pal18_alb: 120, pfl3: 35 },
  edge_ml: { "0.4": 3.5, "0.8": 4.5, "2": 9 },
  accessory: 45, hole: 0.9, cutout: 14, labour_piece: 4.5,
  vat: 19, min_order: 0
};

describe("Caz 1 — un corp simplu, totul cotat", () => {
  /* 4 m² PAL alb  ×120 = 480,00
     1 m² PFL       ×35  =  35,00
     10 m cant 0,8  ×4,5 =  45,00
     8 găuri        ×0,9 =   7,20
     6 piese        ×4,5 =  27,00
                     net = 594,20 ; TVA 19% = 112,90 ; total = 707,10 */
  const q = P.quote({
    materials: [{ id: "pal18_alb", label: "PAL alb", area: 4, edge: 10 },
                { id: "pfl3", label: "PFL", area: 1, edge: 0 }],
    edgeTh: 0.8, holes: 8, cutouts: 0, pieces: 6
  }, LISTA, { currency: "RON" });

  test("net", () => assert.equal(q.net, 594.20));
  test("TVA", () => assert.equal(q.vat, 112.90));
  test("total", () => assert.equal(q.total, 707.10));
  test("moneda vine din opțiuni, nu din listă", () => assert.equal(q.currency, "RON"));
  test("o linie per material, plus cant, găuri, manoperă", () => {
    assert.deepEqual(q.lines.map(l => l.kind), ["panel", "panel", "edge", "hole", "labour"]);
  });
  test("fără cantități zero nu apar linii", () => {
    assert.ok(!q.lines.some(l => l.kind === "cutout"));
  });
  test("niciun avertisment: toate materialele sunt cotate", () => assert.equal(q.warnings.length, 0));
});

describe("Caz 2 — material necotat, accesorii și decupaje", () => {
  /* 2 m² material necunoscut ×140 (implicit) = 280,00
     3 accesorii ×45  = 135,00
     2 decupaje  ×14  =  28,00
     4 piese     ×4,5 =  18,00
                  net = 461,00 ; TVA 19% = 87,59 ; total = 548,59 */
  const q = P.quote({
    materials: [{ id: null, label: "Furnir exotic", area: 2, edge: 0 }],
    edgeTh: 0.8, accessories: 3, holes: 0, cutouts: 2, pieces: 4
  }, LISTA, { currency: "RON" });

  test("cade pe prețul implicit", () => assert.equal(q.lines[0].unit, 140));
  test("și O SPUNE — un preț tăcut pe o placă necunoscută pierde comanda", () => {
    assert.equal(q.warnings.length, 1);
    assert.equal(q.warnings[0].code, "material_not_priced");
    assert.equal(q.warnings[0].material, "Furnir exotic");
  });
  test("linia e marcată `fallback`, ca interfața să o poată colora", () =>
    assert.equal(q.lines[0].fallback, true));
  test("accesoriile se numără la bucată, nu la m²", () => {
    const a = q.lines.find(l => l.kind === "accessory");
    assert.equal(a.qty, 3); assert.equal(a.total, 135);
  });
  test("net", () => assert.equal(q.net, 461));
  test("total", () => assert.equal(q.total, 548.59));
});

describe("Caz 3 — defalcarea pe corp și comanda minimă", () => {
  const boq = {
    materials: [{ id: "pal18_alb", label: "PAL alb", area: 3, edge: 6 }],
    edgeTh: 0.8, holes: 4, cutouts: 0, pieces: 5,
    perModule: {
      "Corp A": { materials: [{ id: "pal18_alb", label: "PAL alb", area: 2, edge: 4 }],
                  edgeTh: 0.8, holes: 3, cutouts: 0, pieces: 3 },
      "Corp B": { materials: [{ id: "pal18_alb", label: "PAL alb", area: 1, edge: 2 }],
                  edgeTh: 0.8, holes: 1, cutouts: 0, pieces: 2 }
    }
  };
  const q = P.quote(boq, LISTA, { currency: "RON" });

  /* 3 m² ×120 = 360 ; 6 m ×4,5 = 27 ; 4 găuri ×0,9 = 3,60 ; 5 piese ×4,5 = 22,50
     net = 413,10 */
  test("net", () => assert.equal(q.net, 413.10));
  test("suma corpurilor dă exact netul comenzii", () => {
    assert.ok(P.modulesMatchTotal(q));
    const s = Object.values(q.modules).reduce((a, m) => a + m.net, 0);
    assert.equal(P.money(s), q.net);
  });
  test("TVA-ul NU se aplică pe corp: ar fi numărat de două ori", () => {
    /* Corp A: 2×120 + 4×4,5 + 3×0,9 + 3×4,5 = 240 + 18 + 2,70 + 13,50 = 274,20 */
    assert.equal(q.modules["Corp A"].net, 274.20);
  });

  const qMin = P.quote(boq, { ...LISTA, min_order: 500 }, { currency: "RON" });
  test("comanda minimă ridică netul", () => assert.equal(qMin.net, 500));
  test("și apare ca linie proprie, nu ca o sumă care sare fără explicație", () => {
    const l = qMin.lines.find(x => x.kind === "min_order");
    assert.ok(l); assert.equal(l.total, P.money(500 - 413.10));
  });
  test("avertisment dedicat", () =>
    assert.ok(qMin.warnings.some(w => w.code === "below_min_order")));
  test("suma corpurilor rămâne coerentă și cu comandă minimă", () =>
    assert.ok(P.modulesMatchTotal(qMin)));
});

describe("Grosimea cantului", () => {
  test("0.80 și 0.8 dau același preț — nu contează cum a fost tastat", () => {
    assert.equal(P.edgePrice(LISTA, 0.8), P.edgePrice(LISTA, "0.80"));
  });
  test("o grosime necotată ia cea mai apropiată, NU zero", () => {
    /* 1 mm nu e în listă; cel mai apropiat e 0,8 → 4,5. Un cant care nu
       costă nimic e o factură pe care atelierul o pierde. */
    assert.equal(P.edgePrice(LISTA, 1), 4.5);
  });
  test("fără cant în listă, prețul e zero, nu NaN", () => {
    assert.equal(P.edgePrice({}, 0.8), 0);
  });
});

describe("Rotunjirea", () => {
  test("o singură dată, la bani", () => {
    const q = P.quote({ materials: [{ id: "pal18_alb", label: "x", area: 1 / 3, edge: 0 }],
                        edgeTh: 0.8, pieces: 0 }, LISTA);
    /* 0,333… × 120 = 40,00 (nu 39,96 dintr-o arie rotunjită înainte) */
    assert.equal(q.lines[0].total, 40);
  });
  test("suma liniilor e egală cu netul, la bani", () => {
    const q = P.quote({
      materials: [{ id: "pal18_alb", label: "a", area: 1.234, edge: 2.345 },
                  { id: "pfl3", label: "b", area: 0.777, edge: 0 }],
      edgeTh: 0.8, holes: 7, cutouts: 1, pieces: 9
    }, LISTA);
    const s = q.lines.reduce((a, l) => a + l.total, 0);
    assert.equal(P.money(s), q.net);
  });
});

describe("Intrări degenerate — nu se produce niciodată NaN", () => {
  test("boq gol", () => {
    const q = P.quote({}, LISTA);
    assert.equal(q.net, 0); assert.equal(q.total, 0);
    assert.equal(q.lines.length, 0);
  });
  test("fără listă de prețuri", () => {
    const q = P.quote({ materials: [{ id: "x", label: "x", area: 2 }], pieces: 3 }, {});
    assert.ok(isFinite(q.net) && isFinite(q.total));
  });
  test("arie negativă se ignoră, nu se scade din total", () => {
    const q = P.quote({ materials: [{ id: "pal18_alb", label: "x", area: -5 }], pieces: 0 }, LISTA);
    assert.equal(q.net, 0);
  });
});
