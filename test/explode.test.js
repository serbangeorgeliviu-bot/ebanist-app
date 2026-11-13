/* Ebanist — explozia 3D (geo3d.js, D-136): nicio piesă nu intră în alta după explozie.
 *
 *   node --test test/explode.test.js
 *
 * Regula veche muta fiecare piesă pe axa ei subțire, independent de vecine, deci despărțitoarele, rafturile și sertarele se suprapuneau. Acum o piesă (sau un sertar) se
 * mută cu un câmp liniar în jurul centrului; două piese care se ating ajung depărtate. Aici: pe corpuri generate (cu uși, sertare, despărțitoare), piesele care nu se
 * suprapuneau închise nu se suprapun nici explodate (la 0,5 și la 1), iar o piesă se mișcă rigid.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
let G3; async function geo() { return G3 || (G3 = await import(path.join(__dirname, "..", "app", "geo3d.js"))); }
const ARM = { type: "standard", L: 1000, H: 2200, P: 600, plinth: 80, tram: 1, shelves: 3, drawers: 0, doors: 2, back: 1, hang: 0, support: "zoccolo", shelfType: "mobile" };
const CFGS = { armadio: ARM, "armadio cu sertare": { ...ARM, drawers: 3 }, "4 uși": { ...ARM, L: 1400, doors: 4, drawers: 2 }, libreria: { ...ARM, L: 1200, H: 1800, P: 350, doors: 0, shelfType: "fisso" },
  cassettiera: { ...ARM, L: 600, H: 720, P: 560, tram: 0, shelves: 0, doors: 0, drawers: 4 } };
function boxes(cfg) {
  S.handleIsProfile = () => false;
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k", matOvr: {}, matAdd: [MM("__b", 19), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
  return S.buildModule(Object.assign({ name: "M", matBody: "__b", matFront: "__b", matBack: "__k" }, cfg)).boxes.filter(b => !b.ring);
}
const pen = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0 && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > 0
  ? Math.min(Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0), Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0)) : 0;
for (const [name, cfg] of Object.entries(CFGS)) for (const amt of [0.5, 1]) {
  test(`explozie ${amt} · ${name}: nicio suprapunere nouă`, async () => {
    const { explodeBoxes } = await geo(), bs = boxes(cfg), ex = explodeBoxes(bs, amt);
    assert.ok(bs.length > 5);
    let n = 0;
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      if ((bs[i].pk != null && bs[i].pk === bs[j].pk) || (bs[i].grp && bs[i].grp === bs[j].grp)) continue;
      if (pen(bs[i], bs[j]) > 0.5) continue;                 // se suprapuneau deja închise
      const p = pen(ex[i], ex[j]);
      if (p > 0.5) { n++; assert.fail(`${bs[i].role}#${bs[i].pk} × ${bs[j].role}#${bs[j].pk}: ${p.toFixed(1)} mm după explozie`); }
    }
    assert.equal(n, 0);
  });
}
test("explozia mută o piesă rigid: toate cutiile cu același pk au aceeași deplasare; fără explozie, aceleași cutii", async () => {
  const { explodeBoxes } = await geo(), bs = boxes(CFGS["armadio cu sertare"]), ex = explodeBoxes(bs, 0.7), off = {};
  bs.forEach((b, i) => { const d = [ex[i].x0 - b.x0, ex[i].y0 - b.y0, ex[i].z0 - b.z0].map(v => Math.round(v * 1000) / 1000).join(","); const k = b.grp ? "g" + b.grp : "p" + b.pk;
    if (off[k] && off[k] !== d) assert.fail(`${k}: deplasări diferite ${off[k]} ≠ ${d}`); off[k] = d; });
  assert.equal(explodeBoxes(bs, 0), bs, "fără explozie: aceleași cutii");
});
