/* Ebanist — i casi golden.
 *
 * Un caso e un progetto di riferimento: un `input.json` (il corpo, i
 * materiali, le impostazioni) e un `expected-pieces.json` (la distinta che
 * ne deve uscire, cota per cota).
 *
 * I materiali stanno DENTRO il caso, non nel catalogo dell'app: un golden
 * che cambia perche il fornitore ha cambiato listino non e un golden.
 *
 * Le cote attese NON si scrivono a mano: si generano col codice corrente
 * (`node test/golden/gen.js`) e si VALIDANO a mano prima di diventare
 * golden. Un golden sbagliato e peggio di nessun test: certifica il guasto.
 */
const MM = (id, th) => ({ id, l: { it: id }, th, price: 1, c: "#eeeeee",
                          tx: "solid", pw: 2800, ph: 2070 });

/* Il catalogo del banco di prova: fisso, non quello dell'app. */
const CAT = [MM("m16", 16), MM("m18", 18), MM("m19", 19), MM("m25", 25),
             MM("hdf3", 3), MM("hdf5", 5), MM("m18back", 18)];

function settings(body, front, back) {
  return {
    panelL: 2800, panelW: 2070, kerf: 4, priceM2: 42, priceMl: 1.2, waste: 15,
    matBody: body, matFront: front || body, matBack: back || "hdf3",
    matOvr: {}, matAdd: CAT,
    hwProd: { cern: "blum_71b3550", guida: "blum_tandem", man: "gen_man",
              sup: "haf_sup", asta: "gen_asta", pied: "haf_axilo",
              bin: "haf_slido", conn: "haf_minifix", push: "blum_tipon_a" },
    hwOvr: {}, costMode: "area", decor_directional: false
  };
}
/* base comune: quello che non si dichiara non esiste */
const B = {
  L: 1000, L2: 900, H: 2200, P: 600, plinth: 80, tram: 0, shelves: 0,
  drawers: 0, doors: 0, back: 1, hang: 0, support: "zoccolo",
  front: "piena", handles: "maniglia", shelfType: "mobile", boxes: 1,
  corner: "sx", cornerKind: "int", drawerSys: "legno", drawerDist: "uguali",
  drawerPos: "auto", drawerFH: 200, drawerZone: 0, drawerInset: 35,
  angL: 90, angR: 90, bow: 0, rcorner: 60, hangGap: 1000,
  shelfEven: 1, shelfStep: 320
};
const c = (name, type, body, cfg, back) => ({
  name, settings: settings(body, cfg.matFront || body, back || "hdf3"),
  cfg: Object.assign({}, B, { name: "Corp", type }, cfg,
        { matBody: body, matFront: cfg.matFront || body, matBack: back || "hdf3" })
});

const CASES = [
  /* --- le tipologie, una per una ------------------------------------- */
  c("01-armadio",      "standard",  "m19", { L: 1000, H: 2200, P: 600, plinth: 80, tram: 1, shelves: 2, drawers: 3, doors: 2, hang: 1 }),
  c("02-base-cassetti","standard",  "m19", { L: 600,  H: 720,  P: 560, plinth: 100, drawers: 4 }),
  c("03-libreria",     "standard",  "m19", { L: 1880, H: 775,  P: 282, plinth: 0, tram: 2, shelves: 2 }),
  c("04-cassettiera",  "standard",  "m19", { L: 450,  H: 600,  P: 500, plinth: 0, drawers: 3 }),
  c("05-mobile-base",  "standard",  "m19", { L: 800,  H: 720,  P: 560, plinth: 100, shelves: 1, doors: 2 }),
  c("06-scorrevole",   "scorrevole","m19", { L: 2400, H: 2400, P: 650, plinth: 0, tram: 2, shelves: 1, doors: 2, hang: 1 }),
  c("07-dressing",     "standard",  "m19", { L: 1800, H: 2200, P: 500, plinth: 80, tram: 2, shelves: 2, drawers: 2, hang: 1 }),
  c("08-mobile-tv",    "standard",  "m19", { L: 1800, H: 450,  P: 400, plinth: 60, tram: 1, drawers: 1, support: "piedini" }),
  c("09-pensile",      "standard",  "m19", { L: 800,  H: 720,  P: 320, plinth: 0, shelves: 1, doors: 2, support: "sospeso" }),
  c("10-colonna",      "standard",  "m19", { L: 600,  H: 2100, P: 560, plinth: 100, shelves: 4, doors: 2 }),
  c("11-bagno",        "standard",  "m19", { L: 900,  H: 550,  P: 460, plinth: 0, drawers: 2, support: "sospeso", handles: "push" }),
  c("12-vetrina",      "standard",  "m19", { L: 900,  H: 1800, P: 400, plinth: 80, shelves: 3, doors: 2, front: "vetro" }),
  c("13-scrivania",    "scrivania", "m25", { L: 1400, H: 750,  P: 650, plinth: 0, back: 0 }),
  c("14-tavolo",       "tavolo",    "m25", { L: 1600, H: 760,  P: 900, plinth: 0, back: 0 }),
  c("15-letto",        "letto",     "m19", { L: 1660, H: 950,  P: 2060, plinth: 0, back: 0 }),
  c("16-tondo",        "tondo",     "m19", { L: 600,  H: 1200, P: 600, plinth: 0, shelves: 3, back: 0 }),
  c("17-ovale",        "tondo",     "m19", { L: 900,  H: 800,  P: 450, plinth: 0, shelves: 2, back: 0 }),
  c("18-raccordato",   "raccordato","m19", { L: 900,  H: 1400, P: 450, plinth: 0, shelves: 3, rcorner: 80 }),

  /* --- corpi d'angolo: le due mani e i due modi ----------------------- */
  c("19-angolare-sx-int", "angolare", "m19", { L: 1000, L2: 900, H: 2200, P: 600, plinth: 80, shelves: 3, doors: 1, hang: 1, corner: "sx", cornerKind: "int" }),
  c("20-angolare-dx-int", "angolare", "m19", { L: 1000, L2: 900, H: 2200, P: 600, plinth: 80, shelves: 3, doors: 1, hang: 1, corner: "dx", cornerKind: "int" }),
  c("21-angolare-sx-ext", "angolare", "m19", { L: 1000, L2: 900, H: 2200, P: 600, plinth: 80, shelves: 3, doors: 1, hang: 1, corner: "sx", cornerKind: "ext" }),
  c("22-angolare-dx-ext", "angolare", "m19", { L: 1000, L2: 900, H: 2200, P: 600, plinth: 80, shelves: 3, doors: 1, hang: 1, corner: "dx", cornerKind: "ext" }),

  /* --- i tre modi dello schienale, sullo STESSO corpo ------------------ */
  c("23-spate-in-cava",   "standard", "m19", { L: 1000, H: 2200, P: 600, plinth: 80, tram: 1, shelves: 2, doors: 2 }, "hdf3"),
  c("24-spate-incastrat", "standard", "m19", { L: 1000, H: 2200, P: 600, plinth: 80, tram: 1, shelves: 2, doors: 2, backMode: "incassato" }, "m18back"),
  c("25-spate-aplicat",   "standard", "m19", { L: 1000, H: 2200, P: 600, plinth: 80, tram: 1, shelves: 2, doors: 2, backMode: "applicato" }, "m18back"),

  /* --- 18 contro 19, la stessa configurazione, cinque tipologie -------- */
  c("26-armadio-18",     "standard", "m18", { L: 1000, H: 2200, P: 600, plinth: 80, tram: 1, shelves: 2, drawers: 3, doors: 2, hang: 1 }),
  c("27-armadio-19",     "standard", "m19", { L: 1000, H: 2200, P: 600, plinth: 80, tram: 1, shelves: 2, drawers: 3, doors: 2, hang: 1 }),
  c("28-libreria-18",    "standard", "m18", { L: 1880, H: 775, P: 282, plinth: 0, tram: 2, shelves: 2 }),
  c("29-libreria-19",    "standard", "m19", { L: 1880, H: 775, P: 282, plinth: 0, tram: 2, shelves: 2 }),
  c("30-cassettiera-18", "standard", "m18", { L: 450, H: 600, P: 500, plinth: 0, drawers: 3 }),
  c("31-cassettiera-19", "standard", "m19", { L: 450, H: 600, P: 500, plinth: 0, drawers: 3 }),
  c("32-base-18",        "standard", "m18", { L: 800, H: 720, P: 560, plinth: 100, shelves: 1, doors: 2 }),
  c("33-base-19",        "standard", "m19", { L: 800, H: 720, P: 560, plinth: 100, shelves: 1, doors: 2 }),
  c("34-colonna-18",     "standard", "m18", { L: 600, H: 2100, P: 560, plinth: 100, shelves: 4, doors: 2 }),
  c("35-colonna-19",     "standard", "m19", { L: 600, H: 2100, P: 560, plinth: 100, shelves: 4, doors: 2 }),

  /* --- grossezze MISTE sullo stesso corpo ------------------------------ */
  c("36-grosimi-mixte", "standard", "m19",
    { L: 1000, H: 2200, P: 600, plinth: 80, tram: 1, shelves: 2, doors: 2,
      /* struttura 19, cielo 25, schienale 3, frontali 19 */
      mat: { cielo: "m25", ripiano: "m16" } }),
  /* e uno con un pannello sottile dappertutto: il caso che prima si
     bloccava da solo */
  c("37-sottile-16", "standard", "m16", { L: 800, H: 1600, P: 350, plinth: 0, shelves: 3, doors: 2, support: "sospeso" })
];

/* le coppie 18/19: il runner controlla che il gabarito NON si muova e che
   le cote interne SI. Scritte qui, non dedotte dal nome. */
const PAIRS = [
  ["26-armadio-18", "27-armadio-19"],
  ["28-libreria-18", "29-libreria-19"],
  ["30-cassettiera-18", "31-cassettiera-19"],
  ["32-base-18", "33-base-19"],
  ["34-colonna-18", "35-colonna-19"]
];

module.exports = { CASES, PAIRS, CAT, MM };
