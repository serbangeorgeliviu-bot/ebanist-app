/* Ebanist — prove golden del motore geometrico.
 *
 *   node --test test/geom.test.js              (motore corrente)
 *   EBANIST_ENGINE=legacy node --test test/geom.test.js   (motore 4.23)
 *
 * Le cote qui sotto non sono inventate: sono la distinta Rev. C della Camera
 * da letto Jacquin, quella andata in produzione. Se una prova cade, la
 * distinta e sbagliata — non la prova.
 *
 * Niente framework: `node:test` sta dentro Node, non porta dipendenze e gira
 * uguale sul Mac, in officina e su Netlify.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const E = require("./engine.js");

console.log("\n  motore sotto prova: " + E.engineName() + "\n");

/* Parametri del corpo Jacquin. Tutto esplicito: nessun valore implicito
   nascosto nella funzione, e la scheda deve poterli ristampare. */
const JACQUIN = {
  H: 2078, t_fianco: 19, t_back: 19, backMode: "incassato",
  h_zoccolo: 79, overlay: 16, gap_ante: 4, gap_sup: 3, gap_inf: 3,
  setback_ripiano: 20, clearance_ripiano: 2, n_ante: 2, n_cerniere: 4,
  edge_offset: 100, piedini: 0, h_picior: 0
};
const CORPO_1000 = { ...JACQUIN, W: 1000, D: 398, n_ripiani: 5 };
const CORPO_800  = { ...JACQUIN, W:  800, D: 598, n_ripiani: 2 };

/* Una cota che il motore v1 non sa produrre non e un fallimento della prova:
   e il buco che il v2 deve riempire. Si dice, non si nasconde. */
function eq(got, want, what) {
  if (got === undefined) assert.fail(what + ": il motore non produce questa cota");
  assert.equal(got, want, what);
}

describe("Test 1 — spate incassato de 19 mm", () => {
  const d = E.derive(CORPO_1000);
  test("D_bc = 379 (falzul e esact grosimea spatelui)", () => eq(d.D_bc, 379, "D_bc"));
  test("back_W = 962", () => eq(d.back_W, 962, "back_W"));
  test("back_H = 2078", () => eq(d.back_H, 2078, "back_H"));
  test("ripiano_W = 960", () => eq(d.ripiano_W, 960, "ripiano_W"));
  test("ripiano_D = 359", () => eq(d.ripiano_D, 359, "ripiano_D"));
  test("zoccolo_W = 962", () => eq(d.zoccolo_W, 962, "zoccolo_W"));
});

describe("Test 2 — doua usi cu rost", () => {
  const a = E.derive(CORPO_1000), b = E.derive(CORPO_800);
  test("reveal = 3 (t_fianco - overlay)", () => eq(a.reveal, 3, "reveal"));
  test("anta_W = 495 pe corp 1000", () => eq(a.anta_W, 495, "anta_W"));
  test("anta_W = 395 pe corp 800", () => eq(b.anta_W, 395, "anta_W"));
});

describe("Test 3 — usa fata de zoccolo si balamale", () => {
  const d = E.derive(CORPO_1000);
  test("anta_H = 1993", () => eq(d.anta_H, 1993, "anta_H"));
  test("anta_y0 = 82", () => eq(d.anta_y0, 82, "anta_y0"));
  test("anta_y1 = 2075", () => eq(d.anta_y1, 2075, "anta_y1"));
  test("cerniere = 100 / 698 / 1295 / 1893", () => {
    assert.ok(d.cerniere, "cerniere: il motore non produce questa cota");
    assert.deepEqual(d.cerniere, [100, 698, 1295, 1893]);
  });
});

describe("Test 4 — coerenta picioare", () => {
  const d = E.derive({ ...CORPO_1000, piedini: 4, h_picior: 100, h_zoccolo: 0 });
  test("H_fianco = 1978", () => eq(d.H_fianco, 1978, "H_fianco"));
  test("caz negativ: picioare + laterala la pardoseala => A7 pica", () => {
    const C = E.coreEngine();
    if (!C) { assert.fail("A7: il modulo delle asserzioni non esiste"); return; }
    const par = { ...C.CARCASS_DEFAULTS, ...CORPO_1000, piedini: 4, h_picior: 100, h_zoccolo: 0 };
    const bad = { ...C.deriveCarcass(par), H_fianco: 2078 };
    const failed = C.checkAssertions(bad).filter(a => a.id === "A7");
    assert.equal(failed.length, 1, "A7 doveva cadere e non e caduta");
  });
});

/* La prova piu importante: se una di queste esce 380, c'e ancora una
   grossezza scritta a mano da qualche parte nella catena della profondita. */
describe("Test 5 — grosime variabila a spatelui", () => {
  for (const [t_back, want] of [[8, 390], [12, 386], [16, 382], [19, 379]])
    test(`t_back = ${t_back} => D_bc = ${want}`, () => {
      eq(E.derive({ ...CORPO_1000, t_back }).D_bc, want, "D_bc");
    });
});

/* Le prove qui sopra descrivono UNA forma di corpo: zoccolo, pannello da 19,
   pareti in squadro, due ante, larghezza che si divide esatta. E' la Rev. C, ed
   e giusto che sia il criterio — ma un motore provato su una forma sola e
   provato male. Quelle che seguono sono le forme che la Rev. C non tocca, e
   ognuna corrisponde a un guasto trovato davvero. */
describe("Test 7 — le forme che la Rev. C non tocca", () => {
  const C = E.coreEngine();
  const D = p => C.deriveCarcass({ ...C.CARCASS_DEFAULTS, ...p });
  /* Il motore gira in un contesto suo: quello che ne esce ha i prototipi di
     quel contesto e deepStrictEqual lo rifiuterebbe per il prototipo invece
     che per il contenuto. Si riportano di qua. */
  const cadute = (d, ctx) => Array.from(C.checkAssertions(d, ctx)).map(a => a.id);
  const nuda = { W: 1000, H: 2078, D: 398, t_fianco: 19, t_back: 19,
                 backMode: "incassato", h_zoccolo: 79, n_ante: 2, n_cerniere: 0,
                 piedini: 0, h_picior: 0 };

  /* La sovrapposizione scritta come costante (16 mm) rendeva impossibile
     qualunque corpo in pannello da 16 o da 12: la luce a vista usciva zero o
     NEGATIVA, e A6 bloccava l'esportazione per sempre. */
  describe("pannelli sottili: 12 e 16 mm", () => {
    for (const t_fianco of [12, 16, 18, 19, 25])
      test(`fianco ${t_fianco} mm → luce a vista 3 mm, nessuna regola caduta`, () => {
        const d = D({ ...nuda, t_fianco });
        assert.equal(d.reveal, 3, "reveal");
        assert.ok(d.anta_W > 0 && d.anta_W < d.in.W, "anta larga quanto il corpo");
        assert.deepEqual(cadute(d), []);
      });
  });

  /* anta_W esce arrotondata al mm: su una larghezza che non si divide esatta
     la somma non torna mai al millesimo, e A3 bloccava mobili normalissimi. */
  describe("larghezze che non si dividono esatte", () => {
    for (const [W, n] of [[1000, 3], [901, 2], [750, 2], [1200, 3], [1000, 2]])
      test(`${W} mm in ${n} ante`, () => {
        const d = D({ ...nuda, W, n_ante: n });
        assert.deepEqual(cadute(d), [],
          `anta_W=${d.anta_W}, somma=${n * d.anta_W + (n - 1) * d.in.gap_ante + 2 * d.reveal}`);
      });
  });

  /* L'anta si posa sulla cassa. Con i piedini la cassa comincia a h_picior:
     un'anta che partiva da terra sporgeva oltre il cielo di tutta l'altezza
     dei piedini, e nessuna regola lo prendeva. */
  describe("mobile sui piedini", () => {
    const g = D({ W: 900, H: 720, D: 560, t_fianco: 18, t_back: 3, backMode: "in_cava",
                  h_zoccolo: 0, n_ante: 2, n_cerniere: 0, piedini: 4, h_picior: 100 });
    test("il fianco si accorcia dell'altezza dei piedini", () => eq(g.H_fianco, 620, "H_fianco"));
    test("l'anta comincia SOPRA i piedini", () => eq(g.anta_y0, 103, "anta_y0"));
    test("e finisce col cielo, non oltre", () => {
      assert.equal(g.anta_y1, 717, "anta_y1");
      assert.ok(g.anta_y1 <= g.in.H, "anta oltre il corpo");
    });
    test("nessuna regola caduta", () => assert.deepEqual(cadute(g), []));
  });

  /* Il fondo sottile in cava: base e cielo restano interi, e questa e la
     configurazione predefinita dell'app — se cambiasse, cambierebbero le cote
     di ogni progetto gia salvato. */
  test("schienale sottile in cava: base e cielo non perdono profondita", () => {
    const d = D({ ...nuda, t_back: 3, backMode: "in_cava" });
    eq(d.D_bc, 398, "D_bc");
    eq(d.ripiano_D, 398 - 13 - 20, "ripiano_D");
  });

  /* Il numero di cerniere stava scritto in tre punti che non erano d'accordo. */
  test("una scala sola per il numero di cerniere", () => {
    for (const [h, n] of [[600, 2], [1200, 3], [1800, 4], [1993, 4], [2200, 5]])
      assert.equal(C.hingeCount(h), n, `anta ${h} mm`);
  });
});

/* Criterio di accettazione del rilascio. */
describe("Test 6 — regresie pe proiectul Jacquin (Rev. C)", () => {
  const REVC = {
    "corp 1000": { params: CORPO_1000, righe: [
      ["Fianco",       2078, 398, 2],
      ["Base / Cielo",  962, 379, 2],
      ["Zoccolo",       962,  79, 1],
      ["Ripiano",       960, 359, 5],
      ["Anta",         1993, 495, 2],
      ["Schienale",    2078, 962, 1]
    ]},
    "corp 800": { params: CORPO_800, righe: [
      ["Fianco",       2078, 598, 2],
      ["Base / Cielo",  762, 579, 2],
      ["Zoccolo",       762,  79, 1],
      ["Ripiano",       760, 559, 2],
      ["Anta",         1993, 395, 2],
      ["Schienale",    2078, 762, 1]
    ]}
  };
  for (const [nome, spec] of Object.entries(REVC)) {
    describe(nome, () => {
      const d = E.derive(spec.params);
      const pieces = d.pieces || [];
      for (const [el, lung, larg, pz] of spec.righe) {
        test(`${el} ${lung}x${larg} (${pz})`, () => {
          const p = pieces.find(x => new RegExp("^" + el.replace(/[/]/g, "\\/")).test(x.elemento));
          assert.ok(p, `${el}: riga assente dalla distinta`);
          assert.equal(p.lung, lung, `${el}.lung`);
          assert.equal(p.larg, larg, `${el}.larg`);
          assert.equal(p.pz, pz, `${el}.pz`);
        });
      }
    });
  }
  test("balamale identice pe ambele corpuri: 100 / 698 / 1295 / 1893", () => {
    for (const spec of Object.values(REVC)) {
      const d = E.derive(spec.params);
      assert.deepEqual(d.cerniere, [100, 698, 1295, 1893]);
    }
  });
  /* Rev. C da una cota sola, non un intervallo: "3-6 mm" non e una quota
     che una macchina possa eseguire. E' esattamente cio che prende A8. */
  test("cote de gaurire finite: prof. 12,5 mm, distanta de la muchie 5,0 mm", () => {
    const d = E.derive(CORPO_1000);
    assert.ok(d.foratura, "foratura: il motore non produce queste cote");
    assert.equal(d.foratura.prof, 12.5);
    assert.equal(d.foratura.dist_cant, 5);
    assert.ok(Number.isFinite(d.foratura.prof) && Number.isFinite(d.foratura.dist_cant));
  });
});
