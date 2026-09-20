/* Ebanist — prove della grossezza derivata dal materiale.
 *
 *   node --test test/thickness.test.js
 *
 * Il secondo guasto arrivato in produzione: il materiale scelto era da 19 e
 * il calcolo restava a 18, perche `18` stava scritto nel codice come rete di
 * sicurezza. Queste prove sono la rete VERA: lo stesso corpo, cambiato solo
 * il materiale, deve produrre una distinta diversa in modo coerente — e il
 * gabarito esterno deve restare quello, perche il cliente ha ordinato quello.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const E = require("./engine.js");

const S = E.appEngine();
const CAT = [E.MM("m18", 18), E.MM("m19", 19), E.MM("m25", 25), E.MM("hdf3", 3)];

/* Un corpo a cassa, con tutto dentro: tramezzo, ripiani, ante, schienale. */
function build(bodyMat, extra) {
  S.state.settings = {
    panelL: 2800, panelW: 2070, kerf: 4,
    matBody: bodyMat, matFront: bodyMat, matBack: "hdf3",
    matOvr: {}, matAdd: CAT, hwProd: { guida: "blum_tandem" }
  };
  const cfg = Object.assign({
    name: "C", type: "standard", L: 1000, H: 2200, P: 600, plinth: 80,
    tram: 1, shelves: 2, drawers: 0, doors: 2, back: 1, hang: 0,
    support: "zoccolo", shelfType: "mobile",
    matBody: bodyMat, matFront: bodyMat, matBack: "hdf3"
  }, extra || {});
  const pieces = S.buildModule(cfg).pieces.map(x => Object.assign({}, x));
  const by = r => pieces.find(x => x.role === r);
  return { cfg, pieces, by };
}

const A = build("m18");   // struttura 18
const B = build("m19");   // struttura 19, tutto il resto uguale

describe("Grossezza dal materiale — il gabarito esterno NON si muove", () => {
  test("altezza del corpo: il fianco resta 2200", () => {
    assert.equal(A.by("fianco").lung, 2200);
    assert.equal(B.by("fianco").lung, 2200);
  });
  test("profondita del corpo: il fianco resta 600", () => {
    assert.equal(A.by("fianco").larg, 600);
    assert.equal(B.by("fianco").larg, 600);
  });
  test("larghezza del corpo: base + due fianchi fa 1000 in tutti e due", () => {
    assert.equal(A.by("base_cielo").lung + 2 * 18, 1000);
    assert.equal(B.by("base_cielo").lung + 2 * 19, 1000);
  });
});

describe("Grossezza dal materiale — le cote INTERNE si spostano", () => {
  test("base e cielo: 964 a 18, 962 a 19", () => {
    assert.equal(A.by("base_cielo").lung, 964);
    assert.equal(B.by("base_cielo").lung, 962);
  });
  test("ripiano: 471 a 18, 469 a 19", () => {
    assert.equal(A.by("ripiano").lung, 471);
    assert.equal(B.by("ripiano").lung, 469);
  });
  test("tramezzo: 2084 a 18, 2082 a 19", () => {
    assert.equal(A.by("divisorio").lung, 2084);
    assert.equal(B.by("divisorio").lung, 2082);
  });
  test("schienale in cava: 2100x980 a 18, 2098x978 a 19", () => {
    assert.equal(A.by("schienale").lung, 2100);
    assert.equal(A.by("schienale").larg, 980);
    assert.equal(B.by("schienale").lung, 2098);
    assert.equal(B.by("schienale").larg, 978);
  });
  test("nessuna riga resta identica per caso: almeno quattro si spostano", () => {
    const moved = ["base_cielo", "ripiano", "divisorio", "schienale", "zoccolo"]
      .filter(r => A.by(r) && B.by(r) &&
        (A.by(r).lung !== B.by(r).lung || A.by(r).larg !== B.by(r).larg));
    assert.ok(moved.length >= 4, "spostate solo: " + moved.join(", "));
  });
});

describe("L'anta NON si sposta, ed e giusto cosi", () => {
  /* La luce a vista accanto all'anta (`reveal`) e la costante di mestiere:
     il falegname la tiene fissa e la sovrapposizione si adatta al fianco.
     Il gabarito esterno non cambia, quindi nemmeno l'anta. Se un giorno
     questa prova cadesse, vorrebbe dire che qualcuno ha rimesso la
     sovrapposizione al posto della luce — ed e il guasto delle ante piu
     larghe del corpo. */
  test("anta 2114 x 495 con la struttura da 18 e da 19", () => {
    assert.equal(A.by("frontale").lung, 2114);
    assert.equal(A.by("frontale").larg, 495);
    assert.equal(B.by("frontale").lung, 2114);
    assert.equal(B.by("frontale").larg, 495);
  });
});

describe("Grossezze MISTE sullo stesso corpo", () => {
  /* struttura 19, cielo 25, schienale 3, frontali 19 */
  const M = build("m19", { mat: { cielo: "m25" } });
  const g = S.carcassMaterials(M.cfg);
  test("ogni ruolo ha la SUA grossezza", () => {
    assert.equal(g.sp.fianco, 19);
    assert.equal(g.sp.cielo, 25);
    assert.equal(g.sp.base, 19);
    assert.equal(g.sp.schienale, 3);
    assert.equal(g.sp.frontale, 19);
  });
  test("il tramezzo si accorcia dei 6 mm in piu del cielo: 2076", () => {
    assert.equal(M.by("divisorio").lung, 2076);
  });
  test("lo schienale in cava segue base e cielo, non i fianchi: 2092", () => {
    /* con `2*t_fianco` sarebbe uscito 2098 e non sarebbe entrato nella cava */
    assert.equal(M.by("schienale").lung, 2092);
  });
  test("base e cielo escono in DUE righe, non in una", () => {
    /* con grossezze diverse non sono piu lo stesso pezzo: una riga sola da
       2 pz manderebbe in segheria due pannelli uguali, uno dei due tagliato
       dalla lastra sbagliata. */
    assert.equal(M.by("base").sp, 19);
    assert.equal(M.by("cielo").sp, 25);
    assert.equal(M.by("base_cielo"), undefined);
  });
  test("il gabarito esterno resta 1000 x 2200 x 600", () => {
    assert.equal(M.by("fianco").lung, 2200);
    assert.equal(M.by("fianco").larg, 600);
    assert.equal(M.by("base").lung + 2 * 19, 1000);
  });
});

describe("Senza materiale non si inventa niente", () => {
  test("nessun materiale e nessuna grossezza dichiarata: errore, non 18", () => {
    S.state.settings = { panelL: 2800, panelW: 2070, matOvr: {}, matAdd: CAT };
    assert.throws(() => S.carcassMaterials({ type: "standard", back: 0 }),
      /errNoStructMat/);
  });
  test("materiale sparito ma grossezza dichiarata: si usa quella e si marca", () => {
    S.state.settings = { panelL: 2800, panelW: 2070, matOvr: {}, matAdd: CAT };
    const r = S.carcassMaterials({ type: "standard", back: 0, matBody: "non_esiste", t: 22 });
    assert.equal(r.sp.fianco, 22);
    assert.equal(r.legacy, true);
  });
  test("il motore rifiuta un ruolo senza grossezza", () => {
    assert.throws(() => S.deriveCarcass(Object.assign({}, S.CARCASS_DEFAULTS, {
      W: 1000, H: 2000, D: 600, t_back: 3, backMode: "incassato",
      h_zoccolo: 0, n_ante: 0, n_cerniere: 0, piedini: 0, h_picior: 0
    })), /grossezza del ruolo/);
  });
});

describe("Le cote che possono diventare negative hanno una regola", () => {
  const ids = S.ASSERTIONS.map(a => a.id);
  for (const id of ["A12", "A13", "A14", "A15", "A16", "A17", "A18"])
    test(id + " esiste ed e bloccante", () => {
      const a = S.ASSERTIONS.find(x => x.id === id);
      assert.ok(a, id + " manca dal set di asserzioni");
      assert.equal(a.severity, "blocking");
    });
  test("un corpo con i fianchi piu larghi del corpo cade su A12", () => {
    const d = S.deriveCarcass(Object.assign({}, S.CARCASS_DEFAULTS, {
      W: 30, H: 2000, D: 600, t_fianco: 19, t_back: 3, backMode: "in_cava",
      h_zoccolo: 0, n_ante: 0, n_cerniere: 0, piedini: 0, h_picior: 0
    }));
    const failed = S.checkAssertions(d, {}).map(a => a.id);
    assert.ok(failed.includes("A12"), "cadute: " + failed.join(", "));
  });
  test("ids unici", () => assert.equal(new Set(ids).size, ids.length));
});
