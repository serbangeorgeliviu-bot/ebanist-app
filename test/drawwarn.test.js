/* D-103: avertismente și mânere pe uși joase. Rulează: node --test drawwarn.test.js */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k", matOvr: {}, matAdd: [MM("__b", 19), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
const arr = x => Array.from(x || []);
const base = { name: "W", type: "standard", L: 1800, H: 1191, P: 434, plinth: 100, tram: 1, shelves: 0, drawers: 4, doors: 0, back: 1, hang: 0, drawerSys: "legrabox", drawerDist: "cucina", matBody: "__b", matFront: "__b", matBack: "__k" };

test("sertar metalic jos: cutia intră 4 mm în bază → avertisment cu numărul de sertare și adâncimea; sertarul de lemn nu avertizează", () => {
  const w = S.buildModule(base).warn.boxHit;
  assert.ok(w && w.n === 2 && Math.abs(w.mm - 4) < 0.01, JSON.stringify(w));
  assert.equal(S.buildModule({ ...base, drawerSys: "legno" }).warn.boxHit, 0);
  assert.equal(S.buildModule({ ...base, drawers: 0, doors: 2 }).warn.boxHit, 0);
});

test("sertare prea multe pentru înălțime: cutia de sus intră în tavan → avertisment (înainte tăcere)", () => {
  const w = S.buildModule({ ...base, H: 518, P: 500, L: 2297, tram: 0, shelves: 2, drawers: 5, drawerSys: "legno", drawerDist: "uguali", plinth: 0 }).warn.boxHit;
  assert.ok(w && w.n === 1 && w.mm > 8 && w.mm < 9, JSON.stringify(w));
});

test("corpul de colț nu mai aruncă avertismentele: cele ale aripilor A și B se unesc", () => {
  const cfg = { ...base, type: "angolare", L2: 1100, cornerKind: "int", corner: "dx" };
  const w = S.buildModule(cfg).warn;
  assert.ok(w, "warn există");
  assert.ok(w.boxHit && w.boxHit.n === 4 && Math.abs(w.boxHit.mm - 4) < 0.01, JSON.stringify(w.boxHit));
});

test("mâner pe ușă joasă: nicio gaură nu iese din ușă; pe o ușă normală pozițiile rămân cele de până acum", () => {
  const low = S.buildModule({ ...base, H: 450, P: 680, plinth: 60, drawers: 1, doors: 3, shelves: 3, back: 0, L: 2241 });
  const o = S.generateOperations({ boxes: low.boxes, cfg: { ...base, H: 450, plinth: 60 }, G: undefined });
  arr(o.pieces).filter(p => p.role === "frontale").forEach(p => arr(p.operations).filter(q => q.note === "maniglia").forEach(q =>
    assert.ok(q.y >= 0 && q.y <= p.width && q.x >= 0 && q.x <= p.length, "mâner în ușă " + JSON.stringify(q) + " " + p.length + "×" + p.width)));
  const nrm = S.buildModule({ ...base, drawers: 0, doors: 2, H: 720, plinth: 100, tram: 0, L: 800 });
  const on = S.generateOperations({ boxes: nrm.boxes, cfg: { ...base, H: 720 }, G: undefined });
  const d = arr(on.pieces).filter(p => p.role === "frontale")[0], hs = arr(d.operations).filter(q => q.note === "maniglia");
  assert.equal(hs.length, 2);
  /* mânerul stă pe axa lungă a ușii: interax 128, iar capătul cel mai apropiat de muchia de sus la 60 mm */
  const ax = hs[0].x !== hs[1].x ? "x" : "y", len = ax === "x" ? d.length : d.width, v = hs.map(q => q[ax]).sort((a, b) => a - b);
  assert.equal(v[1] - v[0], 128);
  assert.equal(Math.min(v[0], len - v[1]), 60 - 0, "60 mm de la muchia de sus (centrul la 60 + 64)");
});
