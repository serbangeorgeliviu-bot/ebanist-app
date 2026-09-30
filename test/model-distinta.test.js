/* Ebanist — il modello 3D (e quindi il Modello di Operazioni e la fisa de
 * montaj) porta le STESSE cote della distinta (D-52: il 3D segue la distinta
 * validata).
 *
 *   node --test test/model-distinta.test.js
 *
 * Per ogni tipologia: ogni pezzo fisico che il 3D disegna deve avere una riga
 * di distinta con lo stesso ruolo e le stesse due cote, alla tolleranza
 * dell'arrotondamento al millimetro con cui esce la distinta (0,5 mm). Prima
 * il confronto accettava 2,5 mm: un ripiano disegnato a filo dei fianchi
 * (471,5) passava per quello tagliato col suo gioco (469), e un fondo di
 * cassetto disegnato fra fronte e retro (462) non combaciava con quello che
 * entra nelle cave (480) senza che niente se ne accorgesse.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });

function gen(cfg) {
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k",
    matOvr: {}, matAdd: [MM("__b", 19), MM("__k", 3), MM("__k8", 8)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({}, cfg, { name: "M", matBody: "__b", matFront: "__b", matBack: "__k" });
  const b = S.buildModule(full);
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  return { b, o: S.generateOperations({ boxes: b.boxes, cfg: full, G }) };
}
const dims = (a, b) => [+a, +b].sort((x, y) => y - x);
const sameRole = (r, p) => r.role === p.role || (r.role === "base_cielo" && (p.role === "base" || p.role === "cielo"));

/* i tipi a pannelli piani, rettangolari: tondi e raccordati hanno pezzi curvi
   che la distinta descrive con lo sviluppo, non con la scatola */
/* i preset si leggono dal file vero, non da una copia: sono quelli che
   l'utente tocca per primi */
const HTML = fs.readFileSync(path.join(__dirname, "..", "app", "index.html"), "utf8");
const PRESETS = vm.runInNewContext("(" + HTML.slice(HTML.indexOf("const PRESETS = {") + 16, HTML.indexOf("\nlet buildCfg")).trim().replace(/;$/, "") + ")");
const SKIP = { tondo: 1, ovale: 1, raccordato: 1 };
const CASES = Object.keys(PRESETS).filter(k => !SKIP[k]).map(k => [k, PRESETS[k]]);
/* l'armadio coi cassetti INTERNI (dietro l'anta): il caso della schermata */
CASES.push(["armadio, cassetti interni", Object.assign({}, PRESETS.armadio, { drawerZone: 640, drawerInset: 35 })]);
CASES.push(["armadio, 3 ripiani per sezione", Object.assign({}, PRESETS.armadio, { drawers: 0, secMode: [], shelves: 3 })]);

for (const [nome, cfg] of CASES) describe(nome, () => {
  const { b, o } = gen(cfg);
  test("ogni pezzo del 3D ha la sua riga di distinta, alle stesse cote", () => {
    const bad = [];
    for (const p of o.pieces) {
      if (p.curved) continue;
      const a = dims(p.length, p.width);
      /* l'anta a vetro e un telaio: in distinta montanti e traversi, in 3D
         un'anta sola. Non e una cota diversa, e un'altra scomposizione. */
      if (p.role === "frontale" && cfg.front === "vetro") continue;
      const rows = b.pieces.filter(r => sameRole(r, p) && !r.seg);
      /* un pannello spezzato perche non entra nel foglio: i tronconi, messi
         in fila lungo `lung`, devono ridare il pezzo intero */
      const segs = b.pieces.filter(r => sameRole(r, p) && r.seg);
      if (segs.length) rows.push({ lung: segs.filter(r => r.larg === segs[0].larg).reduce((a, r) => a + r.lung, 0), larg: segs[0].larg });
      if (!rows.length) continue;
      const ok = rows.some(r => { const d = dims(r.lung, r.larg); return Math.abs(a[0] - d[0]) <= 0.5 && Math.abs(a[1] - d[1]) <= 0.5; });
      if (!ok) bad.push(`${p.role} ${p.length}×${p.width} — distinta: ${rows.map(r => r.lung + "×" + r.larg).join(", ")}`);
    }
    assert.deepEqual([...new Set(bad)], []);
  });
});
