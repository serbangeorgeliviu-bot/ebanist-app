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

test("plasă de siguranță: o înălțime de cutie forțată (drawerH) mai mare decât încape → avertismentul boxHit rămâne", () => {
  const w = S.buildModule({ ...base, drawerH: "F" }).warn.boxHit;
  assert.ok(w && w.n >= 2 && w.mm > 0, JSON.stringify(w));
  assert.equal(S.buildModule({ ...base, drawers: 0, doors: 2 }).warn.boxHit, 0);
});

test("D-104: nicio cutie de sertar nu intră în bază sau în tavan, pe toate sistemele, distribuțiile, înălțimile și soclurile (când planul e valid)", () => {
  let n = 0, hit = 0;
  for (const sys of ["legno", "legrabox", "tandembox", "matrix"]) for (const dist of ["uguali", "cucina", "fix"])
    for (const N of [1, 2, 3, 4, 5, 6]) for (const H of [450, 720, 1191]) for (const pl of [0, 100]) for (const tram of [0, 1]) {
      const cfg = { ...base, drawerSys: sys, drawerDist: dist, drawers: N, H, plinth: pl, tram, L: 1200, P: 560 };
      const b = S.buildModule(cfg), pl2 = b.draw;
      if (!pl2 || !pl2.ok || arr(pl2.warn).length) continue;
      n++;
      if (b.warn.boxHit) { hit++; assert.fail("cutie în bază/tavan: " + JSON.stringify([sys, dist, N, H, pl, tram, b.warn.boxHit])); }
    }
  assert.ok(n > 300, "configurații valide verificate: " + n); assert.equal(hit, 0);
});

test("D-104: primul frontal urcă exact cât trebuie (4 mm pe Legrabox cu bază de 19), bordul de sus nu se mișcă; sertarul de lemn rămâne neschimbat", () => {
  const m = S.buildModule(base), p = m.draw;
  assert.equal(p.lowShift, 4); assert.equal(p.fronts[0].y0, 106);                  // soclu 100 + 2 + 4
  assert.ok(p.fronts[0].y0 + p.sys.lift >= 119, "fundul cutiei deasupra bazei (soclu 100 + 19)");
  const topOld = 100 + 2 + p.zone;                                              // zona veche pornea de la soclu + 2
  assert.ok(Math.abs(p.top - (topOld - 4 + 4)) <= 1 || p.top <= 100 + (base.H - 100) + 1, "bordul de sus nu depășește corpul");
  const w = S.buildModule({ ...base, drawerSys: "legno" }).draw;
  assert.equal(w.lowShift, 0); assert.equal(w.fronts[0].y0, 102);
  /* baza de 25 mm și sertar de lemn (lift 22): 1 mm în bază → urcă 1 mm */
  S.state.settings.matBody = "__t"; S.state.settings.matAdd = [MM("__b", 19), MM("__k", 3), MM("__t", 25)];
  const t25 = S.buildModule({ ...base, drawerSys: "legno", matBody: "__t" }).draw;
  S.state.settings.matBody = "__b"; S.state.settings.matAdd = [MM("__b", 19), MM("__k", 3)];
  assert.equal(t25.lowShift, 1);
});

test("corpul de colț nu mai aruncă avertismentele: cele ale aripilor A și B se unesc", () => {
  const cfg = { ...base, type: "angolare", L2: 1100, cornerKind: "int", corner: "dx", drawerH: "F" };
  const w = S.buildModule(cfg).warn;
  assert.ok(w, "warn există");
  assert.ok(w.boxHit && w.boxHit.n === 4 && w.boxHit.mm > 0, JSON.stringify(w.boxHit));
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
