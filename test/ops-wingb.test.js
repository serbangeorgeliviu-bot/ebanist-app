/* Corpul de colț: operațiile aripii B sunt cele ale unui corp de sine stătător de lățime L2 (D-103), iar referințele în lume
   (min/max, _w, _ax, _side) trec prin aceeași rotație ca cutiile. Rulează: node --test ops-wingb.test.js */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k", matOvr: {}, matAdd: [MM("__b", 19), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
const arr = x => Array.from(x || []);
const base = { name: "C", type: "angolare", L: 900, L2: 1100, H: 720, P: 560, plinth: 100, tram: 0, shelves: 0, drawers: 0, doors: 0, back: 1, hang: 0, matBody: "__b", matFront: "__b", matBack: "__k" };
const sig = o => [o.type, o.note, o.face, o.x, o.y, o.u, o.z, o.dia, o.depth, o.through ? 1 : 0, o.width, o.len, o.thk].join("|");
const opsOf = (p) => arr(p.operations).map(sig).sort();
function gen(cfg) { const b = S.buildModule(cfg); return { b, o: S.generateOperations({ boxes: b.boxes, cfg, G: undefined }) }; }

const CASES = [
  { doors: 2 }, { drawers: 3 }, { doors: 2, drawers: 2, shelves: 3, tram: 1 }, { doors: 3, hang: 1, shelves: 2 },
  { drawers: 4, drawerSys: "legrabox", drawerDist: "cucina" }, { doors: 2, handles: "push" }, { doors: 2, drawers: 2, handles: "gola", golaType: "fresata" }
];

test("aripa B: fiecare piesă are exact operațiile corpului de sine stătător (L = L2), pentru toate cele patru colțuri", () => {
  for (const kind of ["int", "ext"]) for (const corner of ["sx", "dx"]) for (const extra of CASES) {
    const cfg = { ...base, ...extra, cornerKind: kind, corner };
    const A = gen(cfg), solo = gen({ ...cfg, type: "standard", L: cfg.L2 });
    const lbl = kind + "/" + corner + " " + JSON.stringify(extra);
    const pb = arr(A.o.pieces).filter(p => p.wing === "B");
    assert.ok(pb.length > 0, "piese B " + lbl);
    const soloBy = {}; arr(solo.o.pieces).forEach(p => { soloBy[p.pk] = p; });
    pb.forEach(p => {
      const q = soloBy[p.pk - 1000];
      assert.ok(q, "piesa de sine stătătoare pentru pk " + p.pk + " " + lbl);
      assert.equal(p.role, q.role); assert.equal(p.length, q.length); assert.equal(p.width, q.width);
      assert.equal(opsOf(p).join("\n"), opsOf(q).join("\n"), "operații " + p.role + " pk " + p.pk + " " + lbl);
      assert.equal(p.frame, "B-local");
    });
    assert.equal(pb.length, arr(solo.o.pieces).length, "număr de piese " + lbl);
    /* nicio eroare de pre-flight pe aripa B care nu e și pe corpul de sine stătător */
    const errs = o => arr(o.pieces).reduce((a, p) => a + arr(p.preflight).filter(w => w.level === "error").length, 0);
    const bErr = pb.reduce((a, p) => a + arr(p.preflight).filter(w => w.level === "error").length, 0);
    assert.equal(bErr, arr(solo.o.pieces).reduce((a, p) => a + arr(p.preflight).filter(w => w.level === "error").length, 0), "pre-flight " + lbl);
    void errs;
  }
});

test("aripa A rămâne neschimbată; hardware-ul: ID-uri unice, operațiile trimit la un hw existent, B are tot atâta hardware cât corpul singur", () => {
  for (const kind of ["int", "ext"]) for (const corner of ["sx", "dx"]) {
    const cfg = { ...base, doors: 2, drawers: 2, shelves: 2, tram: 1, cornerKind: kind, corner };
    const A = gen(cfg), soloA = gen({ ...cfg, type: "standard" }), soloB = gen({ ...cfg, type: "standard", L: cfg.L2 });
    const pa = arr(A.o.pieces).filter(p => p.wing !== "B");
    assert.equal(pa.length, arr(soloA.o.pieces).length);
    const ids = arr(A.o.hw).map(h => h.id); assert.equal(new Set(ids).size, ids.length, "ID-uri hw unice");
    const idset = new Set(ids);
    arr(A.o.pieces).forEach(p => arr(p.operations).forEach(o => { if (o.hw) assert.ok(idset.has(o.hw), "hw " + o.hw + " există"); }));
    const cnt = (hw, w) => { const m = {}; arr(hw).filter(h => !w || h.wing === w).forEach(h => { m[h.type] = (m[h.type] || 0) + 1; }); return JSON.stringify(Object.keys(m).sort().map(k => [k, m[k]])); };
    assert.equal(cnt(A.o.hw, "B"), cnt(soloB.o.hw), "hardware B " + kind + corner);
    assert.equal(cnt(arr(A.o.hw).filter(h => h.wing !== "B")), cnt(soloA.o.hw), "hardware A " + kind + corner);
  }
});

test("în lume: min/max ale pieselor B = extinderea cutiilor lor, iar fiecare burghiu cu _w cade în interiorul piesei (după rotație/oglindire)", () => {
  const EPS = 0.6;
  for (const kind of ["int", "ext"]) for (const corner of ["sx", "dx"]) for (const extra of CASES) {
    const cfg = { ...base, ...extra, cornerKind: kind, corner }, lbl = kind + "/" + corner + " " + JSON.stringify(extra);
    const A = gen(cfg), boxesBy = {};
    arr(A.b.boxes).forEach(b => { if (b.wing === "B" && b.pk != null) (boxesBy[b.pk] = boxesBy[b.pk] || []).push(b); });
    arr(A.o.pieces).filter(p => p.wing === "B").forEach(p => {
      const bs = boxesBy[p.pk]; assert.ok(bs, "cutii pentru " + p.pk);
      const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      bs.forEach(b => { [[b.x0, b.y0, b.z0], [b.x1, b.y1, b.z1]].forEach(c => { for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], c[a]); mx[a] = Math.max(mx[a], c[a]); } }); });
      for (let a = 0; a < 3; a++) { assert.ok(Math.abs(p.min[a] - mn[a]) < 0.01 && Math.abs(p.max[a] - mx[a]) < 0.01, "min/max " + p.role + " axa " + a + " " + lbl + " " + p.min + " / " + mn); }
      arr(p.operations).filter(o => o.type === "drill" && o._w).forEach(o => {
        for (let a = 0; a < 3; a++) assert.ok(o._w[a] >= p.min[a] - EPS && o._w[a] <= p.max[a] + EPS, "burghiu în piesă " + p.role + " axa " + a + " " + lbl + " " + o.note + " " + o._w + " in " + p.min + ".." + p.max);
        const t = [0, 1, 2].filter(a => Math.abs(p.max[a] - p.min[a] - p.thickness) < 0.6);
        if (!(o.face === 5 || o.face === 6)) return;
        assert.ok(t.indexOf(o._ax) >= 0, "axa burghiului = axa grosimii pentru fețele 5/6: " + o.note + " ax " + o._ax + " " + lbl);
      });
    });
  }
});

test("mânerul sertarului din aripa B nu mai iese din front (regresie: z = −54,5 / 73,5 pe un front de 19 mm)", () => {
  for (const corner of ["sx", "dx"]) {
    const cfg = { ...base, drawers: 2, cornerKind: "int", corner };
    const A = gen(cfg);
    arr(A.o.pieces).filter(p => p.wing === "B" && p.role === "cassetto_frontale").forEach(p => {
      const hs = arr(p.operations).filter(o => o.note === "maniglia"); assert.ok(hs.length === 2, "două găuri de mâner");
      hs.forEach(o => assert.ok(o.face === 5 && o.x >= 0 && o.x <= p.length && o.y >= 0 && o.y <= p.width, "mâner în front " + JSON.stringify(o)));
    });
    arr(A.o.pieces).forEach(p => assert.equal(arr(p.preflight).filter(w => w.level === "error").length, 0, p.role + " " + JSON.stringify(p.preflight)));
  }
});

test("ușile din aripa B au balamale și mâner (înainte: nicio operație)", () => {
  const A = gen({ ...base, doors: 2, cornerKind: "int", corner: "dx" });
  const doors = arr(A.o.pieces).filter(p => p.wing === "B" && p.role === "frontale");
  assert.equal(doors.length, 2);
  doors.forEach(p => { const o = arr(p.operations); assert.ok(o.filter(q => q.note === "tazza cerniera").length >= 2); assert.ok(o.filter(q => q.note === "maniglia").length === 2); });
});
