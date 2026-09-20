/* Ebanist — prove degli invarianti per ruolo (Fase 3).
 *
 *   node --test test/invariants.test.js
 *
 * La chiusura di Fase 2 controlla il GABARITO: che i pezzi, rimessi insieme,
 * facciano il mobile ordinato. Non controlla che ogni pezzo sia quello
 * giusto per il suo posto. Un ripiano lungo quanto la luce interna INTERA
 * chiude il gabarito e non entra.
 *
 * Ogni prova qui rompe UNA cosa e chiede alla regola che la sorveglia di
 * accorgersene. Una regola che non cade quando si rompe quello che guarda
 * non sta guardando niente.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const E = require("./engine.js");

const S = E.appEngine();
const MM = E.MM;
const arr = x => Array.from(x || []);

function build(cfg, mats) {
  S.state.settings = {
    panelL: 2800, panelW: 2070, kerf: 4,
    matBody: "__b", matFront: "__b", matBack: cfg.matBack || "__k",
    matOvr: {}, matAdd: mats || [MM("__b", cfg.t || 18), MM("__k", 3),
      MM("__k18", 18), MM("__m25", 25), MM("pfl5", 5)],
    hwProd: { guida: "blum_tandem" }
  };
  const full = Object.assign({ name: "C", matBody: "__b", matFront: "__b",
    matBack: cfg.matBack || "__k" }, cfg);
  const pieces = S.buildModule(full).pieces.map(x => Object.assign({}, x));
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  const M = S.carcassMaterials(full);
  const ths = [...new Set(Object.values(M.sp).concat(pieces.map(x => x.sp)).filter(x => x > 0))];
  const opts = { materials: M.mats, thicknesses: ths };
  return {
    cfg: full, pieces, G, M, opts,
    all: () => arr(S.validateInvariants(full, pieces, G, opts)),
    ko: (rows) => arr(S.failedInvariants(full, rows || pieces, G, opts)).map(r => r.id),
    rule: id => arr(S.validateInvariants(full, pieces, G, opts)).find(r => r.id === id)
  };
}
const BASE = {
  type: "standard", L: 1000, H: 2200, P: 600, t: 18, plinth: 80, tram: 1,
  shelves: 2, drawers: 0, doors: 2, back: 1, hang: 0,
  support: "zoccolo", shelfType: "mobile"
};

describe("Un corpo ben fatto passa TUTTE le regole", () => {
  const casi = [
    ["armadio con tramezzo, ripiani e ante", BASE],
    ["libreria", { ...BASE, L: 1880, H: 775, P: 282, tram: 2, doors: 0 }],
    ["schienale applicato", { ...BASE, backMode: "applicato", matBack: "__k18" }],
    ["cassetti in legno", { ...BASE, drawers: 3, doors: 0 }],
    ["cassetti metallici", { ...BASE, H: 720, P: 560, drawers: 4, doors: 0, drawerSys: "tandembox" }],
    ["senza schienale", { ...BASE, back: 0 }],
    ["grossezze miste", { ...BASE, t: 19, mat: { cielo: "__m25" } }],
    ["su piedini", { ...BASE, H: 450, P: 400, plinth: 60, support: "piedini" }]
  ];
  for (const [nome, cfg] of casi)
    test(nome, () => {
      const b = build(cfg);
      assert.deepEqual(b.ko(), [], nome + ": " + JSON.stringify(b.all().filter(r => r.ok === false)));
    });
});

describe("Ogni regola prende quello che sorveglia", () => {
  const rompi = (cfg, mut) => build(cfg).ko(build(cfg).pieces.map(mut));

  test("I1 — spate aplicat, laterala non accorciata (il guasto della libreria)", () => {
    const cfg = { ...BASE, backMode: "applicato", matBack: "__k18" };
    assert.ok(rompi(cfg, p => p.role === "fianco" ? { ...p, larg: p.larg + 18 } : p).includes("I1"));
  });
  /* il fondo da 3 mm va IN CAVA: le regole dello schienale incassato
     vogliono un fondo spesso, altrimenti non si applicano */
  const INCASS = { ...BASE, matBack: "__k18" };
  test("I2a — spate incastrat, laterala accorciata per sbaglio", () => {
    assert.ok(rompi(INCASS, p => p.role === "fianco" ? { ...p, larg: p.larg - 3 } : p).includes("I2a"));
  });
  test("I2b — spate incastrat piu largo del vano", () => {
    assert.ok(rompi(INCASS, p => p.role === "schienale" ? { ...p, larg: p.larg + 10 } : p).includes("I2b"));
  });
  test("I3 — un ripiano fuori dal vano azzera una luce", () => {
    /* la SOMMA torna comunque (le luci sono definite come quello che resta):
       quello che si prende e la luce che sparisce */
    assert.ok(rompi(BASE, p => p.role === "ripiano" && p.ys
      ? { ...p, ys: p.ys.map((y, i) => i === 0 ? 2185 : y) } : p).includes("I3"));
  });
  test("I3 — due ripiani alla stessa quota", () => {
    assert.ok(rompi(BASE, p => p.role === "ripiano" && p.ys && p.ys.length > 1
      ? { ...p, ys: p.ys.map(() => p.ys[0]) } : p).includes("I3"));
  });
  test("I4 — un'anta piu stretta lascia un buco", () => {
    assert.ok(rompi(BASE, p => p.role === "frontale" ? { ...p, larg: p.larg - 6 } : p).includes("I4"));
  });
  test("I5 — il cassetto piu profondo di quanto lascia la guida", () => {
    const cfg = { ...BASE, drawers: 3, doors: 0 };
    assert.ok(rompi(cfg, p => p.role === "cassetto_fianco" && p.elemento === "Fianco cassetto"
      ? { ...p, lung: p.lung + 60 } : p).includes("I5"));
  });
  test("I6 — il ripiano arriva al filo anteriore", () => {
    assert.ok(rompi(BASE, p => p.role === "ripiano" ? { ...p, larg: p.larg + 40 } : p).includes("I6"));
  });
  test("I7 — il ripiano senza il suo gioco", () => {
    assert.ok(rompi(BASE, p => p.role === "ripiano" ? { ...p, lung: p.lung + 2 } : p).includes("I7"));
  });
  test("I8 — una cota negativa, e una piu grande della lastra", () => {
    assert.ok(rompi(BASE, p => p.role === "ripiano" ? { ...p, lung: 0 } : p).includes("I8"));
    assert.ok(rompi(BASE, p => p.role === "fianco" ? { ...p, lung: 3200 } : p).includes("I8"));
  });
  test("I9 — la grossezza scritta sul pezzo non e quella del suo materiale", () => {
    const b = build(BASE);
    const ko = arr(S.failedInvariants(b.cfg,
      b.pieces.map(p => p.role === "ripiano" ? { ...p, sp: 25 } : p), b.G, b.opts));
    const r = ko.find(x => x.id === "I9");
    assert.ok(r, "I9 non e caduta");
    /* deve NOMINARE il materiale e tutte e due le cote */
    assert.match(r.why, /25 mm/);
    assert.match(r.why, /18 mm/);
    assert.match(r.why, /__b/);
  });
  test("I10 — una grossezza che non sta in nessun materiale del progetto", () => {
    const b = build(BASE);
    const ko = arr(S.failedInvariants(b.cfg,
      b.pieces.map(p => p.role === "zoccolo" ? { ...p, sp: 21, spSrc: "mat" } : p), b.G, b.opts));
    assert.ok(ko.some(x => x.id === "I10"), "una grossezza da 21 e passata: " + ko.map(x => x.id));
  });
});

describe("Quello che la regola NON puo dire, lo dice", () => {
  test("ante scorrevoli: I4 non si applica, e si dichiara", () => {
    const b = build({ ...BASE, type: "scorrevole", L: 2400, H: 2400, P: 650, plinth: 0, tram: 2 });
    const r = b.rule("I4");
    assert.equal(r.ok, null, "una regola non applicabile non e una regola passata");
    assert.match(r.why, /glisante|suprapun/i);
    assert.deepEqual(b.ko(), []);
  });
  test("anta a telaio e vetro: idem", () => {
    const b = build({ ...BASE, front: "vetro", H: 1800 });
    assert.equal(b.rule("I4").ok, null);
    assert.deepEqual(b.ko(), []);
  });
  test("anta curva: la regola usa la CORDA, non lo sviluppo", () => {
    /* in distinta va lo sviluppo, che e piu lungo: misurare quello farebbe
       cadere la regola su un'anta giusta */
    const b = build({ ...BASE, front: "curvo", bow: 40, H: 800, plinth: 100 });
    const curva = b.pieces.find(p => /curva/i.test(p.elemento));
    assert.ok(curva && curva.curve && curva.curve.corda > 0, "la corda non viaggia col pezzo");
    assert.ok(curva.curve.dev > curva.curve.corda, "lo sviluppo deve essere piu lungo della corda");
    assert.deepEqual(b.ko(), []);
  });
  test("un tavolo non e una cassa: nessuna regola da applicare", () => {
    const b = build({ ...BASE, type: "tavolo", t: 25 }, [MM("__b", 25), MM("__k", 3)]);
    assert.deepEqual(b.all(), []);
  });
});

describe("Il fondo del cassetto in HDF non e un errore", () => {
  /* si taglia dall'HDF da 5, non dal pannello della carcassa: confrontarlo
     col ruolo accuserebbe il pezzo giusto */
  const b = build({ ...BASE, drawers: 3, doors: 0 });
  test("porta la grossezza del SUO materiale", () => {
    const f = b.pieces.find(p => p.elemento === "Fondo cassetto");
    assert.ok(f, "manca il fondo del cassetto");
    assert.equal(f.sp, 5);
    assert.equal(f.spSrc, "mat");
  });
  test("e I9 non lo accusa", () => assert.ok(!b.ko().includes("I9")));
});
