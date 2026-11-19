/* Demo 3 — DORMITOR + DRESSING „Stejar & Textil”: dulap cu uși glisante și sertare, dressing cu uși pliante, pat cu ladă ridicabilă pe pistoane, noptiere suspendate,
 * lambriu canelat, birou cu raft de tastatură și treceri de cablu, un corp oval. Materiale: gri cașmir (dulapuri), stejar Davos (lambriu, noptiere, birou), textil bej (pat). */
const GRI = "egger_u702_st9_18", STEJAR = "egger_h3131_st12_18", TEXTIL = "egger_f416_st10_18";
const D = { type: "standard", matBody: GRI, matFront: GRI, matBack: GRI, tram: 0, drawers: 0, doors: 0, shelves: 0, back: 1, hang: 0, plinth: 0, support: "sospeso", handles: "push", shelfType: "fisso" };
const spec = {
  id: "bedroom",
  names: { ro: "Dormitor și dressing", it: "Camera da letto e cabina armadio", en: "Bedroom and walk-in wardrobe", fr: "Chambre et dressing", de: "Schlafzimmer und Ankleide", pl: "Sypialnia i garderoba", es: "Dormitorio y vestidor" },
  name: "Dormitor — Stejar & Textil",
  survey: { walls: [{ id: "w1", len: 4800, angle: 90, bow: null }, { id: "w2", len: 4200, angle: 90, bow: null }, { id: "w3", len: 4800, angle: 90, bow: null }, { id: "w4", len: 4200, angle: 90, bow: null }], heights: [2600, 2600, 2600, 2600], obstacles: [] },
  settings: { matBody: GRI, matFront: GRI, matBack: GRI },
  defaults: D,
  bodies: [
    /* --- peretele dulapurilor (w1) --- */
    { cfg: { name: "W1 Sliding wardrobe", type: "scorrevole", L: 2700, H: 2400, P: 620, support: "zoccolo", plinth: 0, tram: 2, shelves: 2, drawers: 2, doors: 3, hang: 1, slide: "het_topline_l", drawerSys: "legrabox", drawerDist: "uguali", led: "top", ledSw: "door", handles: "push" }, at: { wall: "w1", from: 0 } },
    { cfg: { name: "W2 Folding-door dressing", L: 1400, H: 2400, P: 600, support: "zoccolo", plinth: 80, tram: 1, shelves: 3, doors: 2, hang: 1, slide: "het_wingline_l", fold: 2, led: "top", ledSw: "hidden" }, at: { wall: "w1", from: 2700 } },
    { cfg: { name: "W3 Open shelves", L: 700, H: 2400, P: 400, support: "zoccolo", plinth: 80, shelves: 7, led: "top", ledSw: "hidden", matBody: STEJAR, matBack: STEJAR }, at: { wall: "w1", from: 4100 } },
    /* --- peretele patului (w2): lambriu canelat, pat cu ladă ridicabilă, noptiere, raft luminos --- */
    { cfg: { name: "B1 Headboard slats", type: "lambriu", L: 2900, H: 1500, P: 34, matBody: STEJAR, matBack: GRI, lamW: 40, lamGap: 20, lamDir: "v", back: 1, support: "zoccolo" }, at: { wall: "w2", from: 650, lift: 800 } },
    { cfg: { name: "B2 Bed lift-up", type: "letto", L: 1660, H: 1100, P: 2060, support: "zoccolo", back: 0, bedStor: "lift", bedFrame: "panel", bedMat: 22, bedFrameKg: 18, matBody: TEXTIL, matFront: TEXTIL, matBack: TEXTIL }, at: { wall: "w2", from: 1270, off: 40 } },
    { cfg: { name: "B3 Nightstand left", L: 450, H: 300, P: 420, drawers: 2, drawerSys: "legrabox", drawerDist: "uguali", hwSel: { pushd: "blum_tipon_lbx_40" }, matBody: STEJAR, matFront: STEJAR, matBack: STEJAR }, at: { wall: "w2", from: 740, off: 40, lift: 350 } },
    { cfg: { name: "B4 Nightstand right", L: 450, H: 300, P: 420, drawers: 2, drawerSys: "legrabox", drawerDist: "uguali", hwSel: { pushd: "blum_tipon_lbx_40" }, matBody: STEJAR, matFront: STEJAR, matBack: STEJAR }, at: { wall: "w2", from: 3010, off: 40, lift: 350 } },
    { cfg: { name: "B5 Light shelf", L: 2700, H: 220, P: 260, shelves: 0, doors: 0, led: "top", ledSw: "hidden", matBody: STEJAR, matFront: STEJAR, matBack: STEJAR }, at: { wall: "w2", from: 650, lift: 2300 } },
    /* --- peretele biroului (w4) --- */
    { cfg: { name: "D1 Desk", type: "scrivania", L: 1600, H: 750, P: 650, back: 0, deskKb: "ka500", deskCable: 2, deskPed: "dx", deskPedDr: 3, deskShelf: 1, matBody: STEJAR, matFront: STEJAR, matBack: STEJAR, support: "zoccolo" }, at: { wall: "w4", from: 500 } },
    { cfg: { name: "D2 Desk wall unit", L: 900, H: 450, P: 320, doors: 1, lift: "blum_hk_top", liftElec: "servo", matBody: GRI, matFront: GRI }, at: { wall: "w4", from: 500, lift: 1700 } },
    { cfg: { name: "D3 Oval shelf", type: "tondo", L: 900, H: 800, P: 450, shelves: 2, back: 0, matBody: STEJAR, matFront: STEJAR, matBack: STEJAR, support: "zoccolo" }, at: { wall: "w4", from: 2200 } }
  ],
  worktops: []
};
module.exports = spec;
