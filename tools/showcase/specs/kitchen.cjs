/* Demo 2 — BUCĂTĂRIE „Beton & Stejar negru”: L pe doi pereți + insulă. Coloanele, nișele, colțul cu carusel, blatul cu îmbinare la 45° vin din modulul Bucătărie
 * (EBKitchenUI.apply); insula e din corpuri normale + blat (wtApply). Materiale: beton Egger închis (baze), stejar Gladstone tobacco (coloane), ceramică sinterizată (blat). */
const BETON = "egger_f187_st9_18", BETON_L = "egger_f186_st9_18", STEJAR = "egger_h3325_st28_18", NEGRU = "egger_u899_st9_18";
const wall = (cols) => ({ cols });
const spec = {
  id: "kitchen",
  names: { ro: "Bucătărie — insulă și coloane", it: "Cucina — isola e colonne", en: "Kitchen — island and tall units", fr: "Cuisine — îlot et colonnes", de: "Küche — Insel und Hochschränke", pl: "Kuchnia — wyspa i zabudowa", es: "Cocina — isla y columnas" },
  name: "Bucătărie — Beton & Stejar negru",
  survey: { walls: [{ id: "w1", len: 5850, angle: 90, bow: null }, { id: "w2", len: 4170, angle: 90, bow: null }, { id: "w3", len: 5850, angle: 90, bow: null }, { id: "w4", len: 4170, angle: 90, bow: null }], heights: [2700, 2700, 2700, 2700], obstacles: [] },
  settings: { matBody: NEGRU, matFront: BETON, matBack: NEGRU },
  kitchen: {
    K: { tallH: 2300, wallBottom: 1450, wallH: 720, handles: "gola", depthBase: 600, depthTall: 600 },
    wtMat: "blat_ceram_20", wtJoint: "mitre",
    walls: {
      w1: wall([
        { type: "t_fridge", w: 600, opts: { fridge: "fridge178" }, up: null },
        { type: "t_oven", w: 600, opts: {}, up: null },
        { type: "t_pull", w: 450, opts: {}, up: null },
        { type: "n_dw", w: 600, opts: { appl: "dw60_total" }, up: { type: "w_door", opts: { h: 720 } } },
        { type: "b_sink", w: 1000, opts: { sink: "sink15" }, up: { type: "w_glass", opts: { h: 720 } } },
        { type: "b_drawers", w: 800, opts: { n: 3 }, up: { type: "w_door", opts: { h: 720 } } },
        { type: "b_hobdr", w: 900, opts: { hob: "hob_ind90", n: 3 }, up: { type: "w_hoodspace", opts: { hood: "hood_chim90" } } },
        { type: "c_l", w: 900, opts: { mech: "carousel" }, up: { type: "w_corner", opts: { h: 720 } } }
      ]),
      w2: wall([
        { type: "b_drawers", w: 800, opts: { n: 3 }, up: { type: "w_door", opts: { h: 720 } } },
        { type: "b_drdoor", w: 800, opts: {}, up: { type: "w_open", opts: { h: 720 } } },
        { type: "b_open", w: 450, opts: {}, up: { type: "w_door", opts: { h: 720 } } },
        { type: "t_pantry", w: 600, opts: {}, up: null }
      ]),
      w3: wall([]), w4: wall([])
    },
    recolor: [["tall unit|Pull-out", { matFront: STEJAR }],
              ["^(Wall unit|Hood space|Open wall|Glass-door wall|Blind corner wall|Corner wall)", { matFront: BETON_L }],
              ["^Wall unit with doors (1\\.4|1\\.6|2\\.3)", { lift: "blum_hs_top", liftElec: "servo" }],
              ["^Glass-door wall unit", { led: "top", ledSw: "door" }],
              ["^Open wall unit", { led: "top", ledSw: "hidden" }]]
  },
  /* insula: corpuri normale (aceeași înălțime ca bazele: 862 + blat), pe peretele w3, cu fața spre bucătărie; blatul insulei = corp „blat” generat prin generateInto,
     cu surplus de 380 mm spre taburete (wtApply nu face blat liber în cameră: blatul pe perete se calculează la perete). */
  bodies: [
    { cfg: { name: "Island drawers", type: "standard", L: 900, H: 862, P: 600, support: "zoccolo", plinth: 142, drawers: 3, drawerSys: "legrabox", drawerDist: "cucina", doors: 0, shelves: 0, back: 1, hang: 0, top: "traverse", handles: "gola", matBody: NEGRU, matFront: BETON, matBack: NEGRU }, at: { wall: "w3", from: 1500, off: 1870 } },
    { cfg: { name: "Island doors", type: "standard", L: 900, H: 862, P: 600, support: "zoccolo", plinth: 142, drawers: 0, doors: 2, shelves: 2, back: 1, hang: 0, top: "traverse", handles: "gola", matBody: NEGRU, matFront: BETON, matBack: NEGRU }, at: { wall: "w3", from: 2400, off: 1870 } },
    { cfg: { name: "Island open", type: "standard", L: 900, H: 862, P: 600, support: "zoccolo", plinth: 142, drawers: 0, doors: 0, shelves: 2, back: 1, hang: 0, top: "plin", handles: "gola", matBody: NEGRU, matFront: STEJAR, matBack: STEJAR, led: "top", ledSw: "hidden" }, at: { wall: "w3", from: 3300, off: 1870 } },
    { cfg: { name: "Island worktop", type: "blat", L: 2740, P: 1000, matBody: "blat_ceram_20", matFront: "blat_ceram_20", matBack: "blat_ceram_20", bordo: "2L+2C", cutouts: [], pockets: [], mitre: { start: false, end: false } }, at: { wall: "w3", from: 1480, off: 1490, lift: 862 } }
  ],
  floorTone: 4934475,
  worktops: []
};
module.exports = spec;
