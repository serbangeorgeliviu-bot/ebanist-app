/* Ebanist — prove della chiusura del gabarito (Fase 2).
 *
 *   node --test test/closure.test.js
 *
 * La distinta non e una lista di numeri: e un mobile smontato. Se si
 * rimettono insieme i pezzi — ognuno con la SUA grossezza e con gli assi che
 * porta scritti addosso — deve tornare fuori il gabarito ordinato.
 *
 * La prova centrale e l'ultima: la distinta del guasto vero, quello della
 * libreria, ricostruita pezzo per pezzo. Il controllo deve prenderla senza
 * sapere niente del guasto. Se un giorno quella prova passa in silenzio,
 * questo file non serve piu a niente.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const E = require("./engine.js");

const S = E.appEngine();
const MM = E.MM;

/* Il motore gira in un contesto suo: gli array che ne escono hanno i
   prototipi di QUEL contesto, e `deepStrictEqual` li rifiuterebbe per il
   prototipo invece che per il contenuto. Si riportano di qua. */
const arr = x => Array.from(x || []);

function build(cfg, mats) {
  S.state.settings = {
    panelL: 2800, panelW: 2070, kerf: 4,
    matBody: "__b", matFront: "__b", matBack: cfg.matBack || "__k",
    matOvr: {}, matAdd: mats || [MM("__b", cfg.t || 18), MM("__k", 3), MM("__k18", 18), MM("__k19", 19), MM("__m25", 25)],
    hwProd: { guida: "blum_tandem" }
  };
  const full = Object.assign({ name: "C", matBody: "__b", matFront: "__b", matBack: cfg.matBack || "__k" }, cfg);
  const pieces = S.buildModule(full).pieces.map(x => Object.assign({}, x));
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  return { cfg: full, pieces, G, close: () => S.validateCarcassClosure(full, pieces, G) };
}
const BASE = {
  type: "standard", L: 1000, H: 2200, P: 600, t: 18, plinth: 80, tram: 1,
  shelves: 2, drawers: 0, doors: 2, back: 1, hang: 0,
  support: "zoccolo", shelfType: "mobile"
};

describe("Ogni pezzo porta la sua grossezza", () => {
  const b = build(BASE);
  test("le righe di pannello hanno `sp`", () => {
    const senza = b.pieces.filter(p => p.role && p.role !== "accessorio" && p.sp == null);
    assert.deepEqual(arr(senza).map(p => p.elemento), [],
      "senza grossezza il controllo dovrebbe SUPPORRE, ed e la supposizione il guasto");
  });
  test("gli accessori non ne hanno: non si tagliano dal pannello", () => {
    const acc = b.pieces.filter(p => p.role === "accessorio");
    for (const p of acc) assert.equal(p.sp, undefined, p.elemento);
  });
});

describe("Un corpo ben fatto chiude a ZERO", () => {
  const casi = [
    ["armadio con tramezzo e ante", BASE],
    ["libreria bassa e profonda 282", { ...BASE, L: 1880, H: 775, P: 282, tram: 2, doors: 0 }],
    ["pensile sospeso", { ...BASE, H: 720, P: 320, plinth: 0, tram: 0, support: "sospeso" }],
    ["su piedini", { ...BASE, H: 450, P: 400, plinth: 60, support: "piedini" }],
    ["senza schienale", { ...BASE, back: 0 }],
    ["schienale incassato da 19", { ...BASE, matBack: "__k19" }],
    ["schienale applicato da 18", { ...BASE, backMode: "applicato", matBack: "__k18" }],
    ["struttura da 19", { ...BASE, t: 19 }],
    ["cassetti in legno", { ...BASE, drawers: 3, doors: 0, drawerSys: "legno" }],
    ["cassetti metallici", { ...BASE, H: 720, P: 560, drawers: 4, doors: 0, drawerSys: "tandembox" }],
    ["ante scorrevoli", { ...BASE, type: "scorrevole", L: 2400, H: 2400, P: 650, plinth: 0, tram: 2 }],
    ["grossezze miste: cielo da 25", { ...BASE, t: 19, mat: { cielo: "__m25" } }]
  ];
  for (const [nome, cfg] of casi)
    test(nome, () => {
      const errs = arr(build(cfg).close());
      assert.deepEqual(errs, [], nome + ": " + JSON.stringify(errs));
    });
});

describe("Base e cielo di grossezza diversa sono DUE righe", () => {
  /* una riga «Base / Cielo — 2 pz» con un cielo da 25 e una base da 19
     manda in segheria due pezzi uguali, tagliati dalla lastra sbagliata */
  const b = build({ ...BASE, t: 19, mat: { cielo: "__m25" } });
  test("escono separate", () => {
    assert.ok(b.pieces.find(p => p.role === "base"), "manca la riga della base");
    assert.ok(b.pieces.find(p => p.role === "cielo"), "manca la riga del cielo");
    assert.ok(!b.pieces.find(p => p.role === "base_cielo"), "sono ancora in una riga sola");
  });
  test("ognuna con la SUA grossezza", () => {
    assert.equal(b.pieces.find(p => p.role === "base").sp, 19);
    assert.equal(b.pieces.find(p => p.role === "cielo").sp, 25);
  });
  test("e restano una riga sola quando sono lo stesso pezzo", () => {
    const u = build({ ...BASE, t: 19 });
    assert.ok(u.pieces.find(p => p.role === "base_cielo"));
    assert.equal(u.pieces.find(p => p.role === "base_cielo").pz, 2);
  });
});

describe("Tolleranza ZERO: un millimetro e un errore", () => {
  const guasta = (mut) => {
    const b = build(BASE);
    return S.validateCarcassClosure(b.cfg, b.pieces.map(mut), b.G);
  };
  test("un fianco 1 mm piu profondo", () => {
    const e = guasta(p => p.role === "fianco" ? { ...p, larg: p.larg + 1 } : p);
    assert.ok(e.length, "un millimetro e passato");
    assert.equal(e[0].axa, "P");
    assert.equal(e[0].delta, 1);
  });
  test("una base 1 mm piu larga", () => {
    const e = guasta(p => p.role === "base_cielo" ? { ...p, lung: p.lung + 1 } : p);
    assert.ok(e.some(x => x.axa === "L" && x.delta === 1), JSON.stringify(e));
  });
  test("un fianco 1 mm piu corto", () => {
    const e = guasta(p => p.role === "fianco" ? { ...p, lung: p.lung - 1 } : p);
    assert.ok(e.some(x => x.axa === "H" && x.delta === -1), JSON.stringify(e));
  });
});

describe("Sei catene, non una: un pezzo sbagliato non si nasconde", () => {
  test("un tramezzo tagliato con la grossezza del cielo sbagliata cade sulla catena interna", () => {
    const b = build(BASE);
    /* il tramezzo e lungo esattamente la luce interna: se qualcuno lo
       calcolasse con una grossezza che non e quella di base e cielo, solo
       la catena che entra DENTRO il corpo se ne accorge */
    const e = S.validateCarcassClosure(b.cfg,
      b.pieces.map(p => p.role === "divisorio" ? { ...p, lung: p.lung - 7 } : p), b.G);
    assert.equal(e.length, 1, "doveva cadere UNA catena sola: " + JSON.stringify(e));
    assert.equal(e[0].axa, "H");
    assert.equal(e[0].chain, "zoccolo+base+interno+cielo");
    assert.equal(e[0].delta, -7);
  });
  test("uno schienale troppo stretto cade sulla sua catena, non sulle altre", () => {
    const b = build(BASE);
    const e = S.validateCarcassClosure(b.cfg,
      b.pieces.map(p => p.role === "schienale" ? { ...p, larg: p.larg - 4 } : p), b.G);
    assert.ok(e.some(x => x.axa === "L" && /schienale/.test(x.chain)), JSON.stringify(e));
  });
});

describe("Quello che NON si puo chiudere si dichiara, non si allenta", () => {
  test("corpo fuori squadro: le catene in larghezza si saltano, le altre no", () => {
    /* la riga di base porta il rettangolo di sbozzo di un trapezio: non e la
       luce interna, e la catena non chiuderebbe. Si salta QUELLA, non si
       abbassa la tolleranza per tutti. */
    const b = build({ ...BASE, angL: 87 });
    assert.deepEqual(arr(b.close()), []);
    const e = S.validateCarcassClosure(b.cfg,
      b.pieces.map(p => p.role === "fianco" ? { ...p, larg: p.larg + 5 } : p), b.G);
    assert.ok(e.some(x => x.axa === "P"), "sul fuori squadro la profondita si controlla lo stesso");
  });
  test("un tavolo non e una cassa: niente fianco, niente gabarito da chiudere", () => {
    const b = build({ ...BASE, type: "tavolo", t: 25 }, [MM("__b", 25), MM("__k", 3)]);
    assert.deepEqual(arr(S.validateCarcassClosure(b.cfg, b.pieces, b.G)), []);
  });
});

describe("IL GUASTO VERO — la libreria della commessa", () => {
  /* Fondo applicato da 18: la profondita del fianco e di base/cielo doveva
     scendere a 264. Non e scesa. Il ripiano era GIUSTO, ed e per questo che
     nessun controllo se n'era accorto: due corpi montati in cantiere e 18 mm
     da tagliare a mano su ogni pezzo.
     Questo controllo non sa niente di quel guasto. Lo prende lo stesso. */
  const b = build({ ...BASE, L: 1880, H: 775, P: 282, tram: 2, doors: 0,
                    backMode: "applicato", matBack: "__k18" });
  test("la distinta corretta chiude", () => assert.deepEqual(arr(b.close()), []));

  const rotta = b.pieces.map(p =>
    (p.role === "fianco" || p.role === "base_cielo") ? { ...p, larg: p.larg + 18 } : p);

  test("la distinta del guasto NON chiude", () => {
    const e = S.validateCarcassClosure(b.cfg, rotta, b.G);
    assert.ok(e.length >= 1, "il guasto del 2024 sarebbe passato di nuovo");
  });
  test("dice quale asse: la profondita", () => {
    const e = S.validateCarcassClosure(b.cfg, rotta, b.G);
    for (const x of e) assert.equal(x.axa, "P");
  });
  test("dice di quanto: 18 mm, esatti", () => {
    const e = S.validateCarcassClosure(b.cfg, rotta, b.G);
    for (const x of e) assert.equal(x.delta, 18);
    assert.equal(e[0].valoare_nominala, 282);
    assert.equal(e[0].valoare_calculata, 300);
  });
  test("dice quali pezzi: il fianco e la base, non il ripiano", () => {
    const e = S.validateCarcassClosure(b.cfg, rotta, b.G);
    const tutti = arr(e).reduce((a, x) => a.concat(arr(x.piese_implicate)), []);
    assert.ok(tutti.some(n => /Fianco/.test(n)), "non nomina il fianco");
    assert.ok(tutti.some(n => /Base/.test(n)), "non nomina la base");
    assert.ok(!tutti.some(n => /Ripiano/.test(n)), "accusa il ripiano, che era giusto");
  });
});
