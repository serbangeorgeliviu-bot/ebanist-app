/* Scena comună a clipului „Da Pinterest a Ebanist": dulapul din poză, în „Camera în 3D".
   Folosită de pinterest-frames.cjs (cadrele 3D) și pinterest-compose.cjs (foile A3). */
const OAK = process.env.OAK || "egger_h3170_st12_18";
const FRONT = process.env.FRONT || "scan_rovere_19";   /* panou scanalat (D-180) */
const HANDLE = "gen_bar192_black";
const base = { type: "standard", back: 1, matBody: OAK, matFront: FRONT, matBack: OAK, hwSel: { man: HANDLE } };
const CFG = {
  sx: { ...base, name: "Dulap sx", L: 1000, H: 2350, P: 600, plinth: 60, tram: 0, doors: 2, drawers: 2, shelves: 3, hang: 0 },
  desk: { ...base, name: "Birou", type: "scrivania", L: 1300, H: 750, P: 600, plinth: 0, tram: 0, shelves: 0, drawers: 0, doors: 0, back: 0, hang: 0, deskDrw: 1, support: "zoccolo", top: "traverse", boxes: 1 },
  shelf: { ...base, name: "Raft", L: 1300, H: 60, P: 260, plinth: 0, tram: 0, doors: 0, drawers: 0, shelves: 0, hang: 0, back: 0, support: "sospeso", led: "top", ledSw: "visible" },
  dx: { ...base, name: "Dulap dx", L: 1000, H: 2350, P: 600, plinth: 60, tram: 0, doors: 2, drawers: 2, shelves: 3, hang: 0 },
};
const WALLS = [{ id: "w1", len: 3700, angle: 90 }, { id: "w2", len: 1800, angle: 90 }, { id: "w3", len: 3700, angle: 90 }, { id: "w4", len: 1800, angle: 90 }];
const LAY = { "Dulap sx": { wall: "w1", from: 300, off: 0, lift: 0, rot: 0 }, "Birou": { wall: "w1", from: 1300, off: 0, lift: 0, rot: 0 }, "Raft": { wall: "w1", from: 1300, off: 0, lift: 1500, rot: 0 }, "Dulap dx": { wall: "w1", from: 2600, off: 0, lift: 0, rot: 0 } };
/* rulat în pagina aplicației: construiește proiectul */
function buildInPage([CFG, WALLS, LAY, OAK, FRONT]) {
  closeSheets(); const S = state.settings; S.matBody = OAK; S.matFront = FRONT; S.matBack = OAK;
  const p = proj(); p.pieces = []; p.configs = {}; p.layout = {};
  p.survey = { walls: WALLS, heights: [2600], wallH: 2600, obstacles: [] };
  const errs = [];
  for (const k of Object.keys(CFG)) { try { generateInto(p, CFG[k]); } catch (e) { errs.push(k + ": " + e.message); } }
  p.layout = LAY; persist(); setView("build");
  return errs;
}
module.exports = { OAK, FRONT, CFG, WALLS, LAY, buildInPage };
