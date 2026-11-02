/* Ebanist — DXF per piesă, pe straturi de operație (2B.6, D-106).
 *
 *   node --test test/dxf.test.js
 *
 * Controlează: straturile, sufixul _NEVERIF cât HW_DRILL.verificat e false (D-48),
 * antetul de avertizare, rotunjirea la 0,1 mm numai la emitere, determinismul și
 * că fiecare cerc din fișier e o gaură reală a piesei.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });

function pieces(cfg) {
  S.handleIsProfile = () => false;
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k",
    matOvr: {}, matAdd: [MM("__b", 18), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "M", matBody: "__b", matFront: "__b", matBack: "__k" }, cfg);
  const b = S.buildModule(full), G = S.deriveCarcass(S.carcassParams(full, {}));
  return JSON.parse(JSON.stringify(S.generateOperations({ boxes: b.boxes, cfg: full, G }))).pieces;
}
const ARM = { type: "standard", L: 1000, H: 2200, P: 600, plinth: 80, tram: 1, shelves: 3, drawers: 0,
  doors: 2, back: 1, hang: 0, support: "zoccolo", shelfType: "mobile" };

/* citește perechile cod/valoare și returnează entitățile (tip, strat, câmpuri) */
function parse(txt) {
  const L = txt.split("\n"); L.pop();
  assert.equal(L.length % 2, 0, "perechi cod/valoare complete");
  const ents = []; let cur = null, inEnt = false;
  for (let i = 0; i < L.length; i += 2) {
    const c = +L[i], v = L[i + 1];
    if (c === 2 && v === "ENTITIES") { inEnt = true; continue; }
    if (!inEnt) continue;
    if (c === 0) { if (v === "ENDSEC" || v === "EOF") break; cur = { t: v, f: {} }; ents.push(cur); continue; }
    if (cur) (cur.f[c] = cur.f[c] || []).push(v);
  }
  return ents;
}

describe("DXF per piesă", () => {
  const P = pieces(ARM);
  const side = P.find(p => p.role && /fianco|lat/i.test(p.role)) || P[0];

  test("structură validă R12 și antet de avertizare", () => {
    const t = S.dxfForPiece(side, { ver: "x", name: "n" });
    assert.match(t, /^999\n/);
    assert.ok(t.includes("AC1009"));
    assert.ok(t.trimEnd().endsWith("EOF"));
    assert.match(t, /NU sunt verificate/);
    parse(t);
  });

  test("cât HW_DRILL.verificat e false, orice strat de feronerie e _NEVERIF; conturul nu", () => {
    assert.equal(S.HW_DRILL.verificat, false);
    for (const pc of P) {
      const ents = parse(S.dxfForPiece(pc));
      const hwOps = pc.operations.filter(o => o.hw && o.face >= 5 && o.type !== "contour");
      const layers = new Set(ents.map(e => e.f[8][0]));
      if (hwOps.length) assert.ok([...layers].some(l => /_NEVERIF$/.test(l)), pc.pk + ": strat _NEVERIF lipsă");
      for (const e of ents) if (/^CONTUR/.test(e.f[8][0])) assert.ok(!/NEVERIF/.test(e.f[8][0]));
    }
  });

  test("fiecare gaură de pe fața 5/6 devine un cerc cu cotele ei, la 0,1 mm", () => {
    for (const pc of P) {
      const ents = parse(S.dxfForPiece(pc));
      const circ = ents.filter(e => e.t === "CIRCLE");
      const drills = pc.operations.filter(o => o.type === "drill" && o.face >= 5);
      assert.equal(circ.length, drills.length, pc.pk);
      drills.forEach(o => assert.ok(circ.some(c => +c.f[10][0] === Math.round(o.x * 10) / 10 && +c.f[20][0] === Math.round(o.y * 10) / 10 &&
        Math.abs(+c.f[40][0] - o.dia / 2) < 0.051), pc.pk + " " + o.id));
    }
  });

  test("oalele Ø35 și găurile Ø5 au straturile lor, fața 6 are _F6", () => {
    const all = P.map(pc => S.dxfForPiece(pc)).join("\n");
    assert.match(all, /\nOALA_D35/);
    assert.match(all, /\nSISTEM32_D5/);
    const six = P.find(pc => pc.operations.some(o => o.face === 6 && o.type === "drill"));
    if (six) assert.match(S.dxfForPiece(six), /_F6/);
  });

  test("găurile de pe canturi nu apar în plan, dar sunt numărate în antet", () => {
    const pc = P.find(p => p.operations.some(o => o.face < 5));
    assert.ok(pc, "o piesă cu găuri pe cant");
    const n = pc.operations.filter(o => o.face < 5).length;
    assert.match(S.dxfForPiece(pc), new RegExp("\\n" + n + " operatii pe canturi"));
  });

  test("conturul e un dreptunghi cât piesa", () => {
    const ents = parse(S.dxfForPiece(side));
    const xs = [], ys = [];
    let on = false;
    for (const e of ents) { if (e.t === "VERTEX" && /^CONTUR/.test(e.f[8][0])) { xs.push(+e.f[10][0]); ys.push(+e.f[20][0]); } }
    assert.ok(xs.length >= 4);
    assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - side.outline.reduce((a, r) => Math.max(a, r.x1), 0) + side.outline.reduce((a, r) => Math.min(a, r.x0), 1e9)) < 0.11);
  });

  test("determinist: aceeași piesă, același fișier", () => {
    const a = pieces(ARM).map(pc => S.dxfForPiece(pc, { ver: "x" })).join("\n");
    const b = pieces(ARM).map(pc => S.dxfForPiece(pc, { ver: "x" })).join("\n");
    assert.equal(a, b);
  });
});
