/* Demo 1 — LIVING, peretele TV „Noir & Noce”. Date, nu cod: SC.build (inpage.js) le trece prin generateInto / layout / wtApply.
 * Materiale: grafit (structură + fronturi), nuc Lincoln (fond, rafturi, lambriu), un accent metalic.  Ținte: pereți 5600 × 2700. */
const GRAF = "egger_u961_st7_18", NUC = "egger_h1714_st19_18";
const D = { type: "standard", matBody: GRAF, matFront: GRAF, matBack: NUC, tram: 0, drawers: 0, doors: 0, shelves: 0, back: 1, hang: 0, plinth: 0, support: "sospeso", handles: "push", shelfType: "fisso" };
const mat = { ripiano: NUC };
const SUS = 150;           /* tot ce e jos „plutește” la 150 mm de pardoseală */
const spec = {
  id: "living",
  names: { ro: "Living — peretele TV", it: "Soggiorno — parete TV", en: "Living room — TV wall", fr: "Salon — mur TV", de: "Wohnzimmer — TV-Wand", pl: "Salon — ściana TV", es: "Salón — pared TV" },
  name: "Living — Noir & Noce",
  survey: { walls: [{ id: "w1", len: 5600, angle: 90, bow: null }, { id: "w2", len: 4200, angle: 90, bow: null }, { id: "w3", len: 5600, angle: 90, bow: null }, { id: "w4", len: 4200, angle: 90, bow: null }], heights: [2700, 2700, 2700, 2700], obstacles: [] },
  settings: { matBody: GRAF, matFront: GRAF, matBack: NUC },
  defaults: D,
  bodies: [
    /* --- stânga: coloană de raft deschis, de la pardoseală la tavan --- */
    { cfg: { name: "S1 Raft deschis", L: 500, H: 2700, P: 380, support: "zoccolo", plinth: 60, shelves: 7, led: "top", ledSw: "hidden", mat }, at: { from: 0 } },
    /* --- stânga: dulap jos cu sertare, vitrină cu sticlă și LED, clapă sus cu SERVO-DRIVE --- */
    { cfg: { name: "S2 Sertare", L: 800, H: 600, P: 420, drawers: 3, drawerSys: "legrabox", drawerDist: "cucina", hwSel: { pushd: "blum_tipon_lbx_70" } }, at: { from: 500, lift: SUS } },
    { cfg: { name: "S3 Vitrină", L: 800, H: 1400, P: 380, doors: 2, shelves: 4, front: "vetro", handles: "push", led: "top", ledSw: "door", mat }, at: { from: 500, lift: SUS + 600 } },
    { cfg: { name: "S4 Clapă sus", L: 800, H: 550, P: 380, doors: 1, shelves: 0, lift: "blum_hk_top", liftElec: "servo" }, at: { from: 500, lift: 2150 } },
    /* --- centru: lambriu nuc canelat + consolă suspendată cu TV --- */
    { cfg: { name: "C1 Lambriu", type: "lambriu", L: 3000, H: 2050, P: 34, matBody: NUC, matBack: GRAF, lamW: 40, lamGap: 20, lamDir: "v", back: 1, support: "zoccolo" }, at: { from: 1300, lift: 200 } },
    { cfg: { name: "C2 Consolă stânga", L: 1000, H: 450, P: 420, doors: 2, shelves: 0, led: "top", ledSw: "hidden" }, at: { from: 1300, off: 40, lift: SUS } },
    { cfg: { name: "C3 Consolă sertare", L: 1000, H: 450, P: 420, drawers: 2, drawerSys: "legrabox", drawerDist: "uguali", hwSel: { pushd: "blum_tipon_lbx_70" } }, at: { from: 2300, off: 40, lift: SUS } },
    { cfg: { name: "C4 Consolă dreapta", L: 1000, H: 450, P: 420, doors: 2, shelves: 0, led: "top", ledSw: "hidden" }, at: { from: 3300, off: 40, lift: SUS } },
    { cfg: { name: "C5 Clapă stânga", L: 1500, H: 450, P: 380, doors: 1, lift: "blum_hk_top", liftElec: "servo" }, at: { from: 1300, lift: 2250 } },
    { cfg: { name: "C6 Clapă dreapta", L: 1500, H: 450, P: 380, doors: 1, lift: "blum_hk_top", liftElec: "servo" }, at: { from: 2800, lift: 2250 } },
    /* --- dreapta: stivă cu uși pliante pentru bar, Free flap cu E-Drive --- */
    { cfg: { name: "D1 Sertare", L: 800, H: 600, P: 420, drawers: 3, drawerSys: "legrabox", drawerDist: "cucina", hwSel: { pushd: "blum_tipon_lbx_70" } }, at: { from: 4300, lift: SUS } },
    { cfg: { name: "D2 Bar uși pliante", L: 800, H: 1400, P: 380, doors: 2, shelves: 2, slide: "het_wingline_l", fold: 2, led: "top", ledSw: "hidden", mat }, at: { from: 4300, lift: SUS + 600 } },
    { cfg: { name: "D3 Free flap", L: 800, H: 550, P: 380, doors: 1, lift: "haf_free_flap_315", liftElec: "edrive" }, at: { from: 4300, lift: 2150 } },
    { cfg: { name: "D4 Raft deschis", L: 500, H: 2700, P: 380, support: "zoccolo", plinth: 60, shelves: 7, led: "top", ledSw: "hidden", mat }, at: { from: 5100 } }
  ],
  worktops: []
};
module.exports = spec;
