/* Ebanist — spate pe coloane, decupaje în spate, rinforzo, filler, grile de aerisire (D-103).
 *
 *   node --test test/cetinic.test.js
 *
 * Cazul: dulapul „Entrance unit" pentru Nick Cetinic, în fața unei centrale pe gaz (coloana
 * din dreapta) și a unui tablou electric (coloana din stânga). Nișa are cel mult
 * 1600 × 450 × 2300 mm, filler-ele incluse; golul de sus și cel din dreapta (3–4 cm, pereții
 * nu sunt drepți) se închid cu filler din materialul ușilor.
 *
 * Cifrele de aici sunt cele ale GOLDENULUI Cetinic, nu cele ale comenzii reale: golul față de
 * perete (OFF = 40 → P = 410), decupajul pentru tablou și grilele sunt valori de probă, de
 * înlocuit cu cele măsurate. Verificarea e pe geometrie: cota fiecărei piese se poate recalcula
 * de mână din cotele de intrare (în comentarii).
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });

function settings() {
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__f", matBack: "__k",
    matOvr: {}, matAdd: [MM("__b", 19), MM("__f", 19), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
}
const clone = o => JSON.parse(JSON.stringify(o));
/* motorul gira in alt context vm: array si obiecte au alt prototip, deepEqual strict le-ar zice diferite. Se compara datele. */
const eq = (a, b, m) => assert.deepEqual(clone(a), clone(b), m);
function build(cfg) {
  settings();
  const full = Object.assign({ name: "Entrance unit", matBody: "__b", matFront: "__f", matBack: "__k" }, clone(cfg));
  const b = S.buildModule(full);
  const pieces = b.pieces.map(x => Object.assign({}, x));
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  return { cfg: full, b, pieces, G,
    close: () => Array.from(S.validateCarcassClosure(full, pieces, G)),
    inv: () => Array.from(S.failedInvariants(full, pieces, G, {})),
    ops: () => JSON.parse(JSON.stringify(S.generateOperations({ boxes: b.boxes, cfg: full, G }))) };
}
const errOf = cfg => { settings(); try { S.buildModule(Object.assign({ name: "M", matBody: "__b", matFront: "__f", matBack: "__k" }, clone(cfg))); return ""; } catch (e) { return e.message; } };
const row = (r, role, f) => r.pieces.filter(p => p.role === role && (!f || f(p)));
const dims = (a, b) => [+a, +b].sort((x, y) => y - x);

/* L = 1600 − 40 (filler dreapta), H = 2300 − 40 (filler sus), P = 450 − 40 (golul față de perete, pentru cutia tabloului).
   Setto la mijloc: x = (1560 − 19) / 2 = 770,5 → coloane de 751,5 între laterale (19) și setto. */
const CET = {
  type: "standard", L: 1560, H: 2260, P: 410, plinth: 100, support: "zoccolo", tram: 0, shelves: 0, drawers: 0, doors: 0,
  back: 1, hang: 0, backMode: "applicato", shelfType: "mobile", handles: "push",
  partitions: [{ type: "setto", x: "center" }],
  /* două uși pe fiecare coloană, una peste alta, cu rost de 3 între ele; ușile din dreapta au grile */
  fronts: [
    { x: 0, y: 100, w: 780, h: 1048, hinge: "left" }, { x: 0, y: 1151, w: 780, h: 1106, hinge: "left" },
    { x: 780, y: 100, w: 780, h: 1048, hinge: "right", vents: [{ at: "bottom", w: 300, h: 100 }] },
    { x: 780, y: 1151, w: 780, h: 1106, hinge: "right", vents: [{ at: "top", w: 300, h: 100 }] }],
  backCols: [1],
  backCutouts: [{ x: 300, y: 1200, w: 300, h: 400 }],
  backRails: [{ y: 1051, h: 100 }, { y: 1154, h: 100 }],
  fillers: [{ side: "top", size: 40 }, { side: "right", size: 40 }]
};
const FIT_KEYS = ["backCols", "backCutouts", "backRails", "fillers"];
const without = (c, ...ks) => { const o = clone(c); ks.forEach(k => delete o[k]); return o; };
const withoutVents = c => { const o = clone(c); o.fronts.forEach(f => delete f.vents); return o; };

describe("Cetinic — distinta", () => {
  const r = build(CET);

  test("corpul: laterale, bază/tavan, soclu, setto — cotele de dinainte, pe gabaritul nou", () => {
    const f = row(r, "fianco")[0], bc = row(r, "base_cielo")[0], z = row(r, "zoccolo")[0], s = row(r, "divisorio")[0];
    /* fianco: H 2260 × (P 410 − 3 spate aplicat) = 407, 2 buc */
    eq([f.lung, f.larg, f.pz], [2260, 407, 2]);
    /* bază/tavan: 1560 − 2×19 = 1522 */
    eq([bc.lung, bc.larg, bc.pz], [1522, 407, 2]);
    eq([z.lung, z.larg], [1522, 100]);
    /* setto: 2260 − 100 − 19 − 19 = 2122 */
    eq([s.lung, s.larg], [2122, 407]);
  });

  test("spatele e doar pe coloana din stânga, până la fața setto-ului", () => {
    const back = row(r, "schienale");
    assert.equal(back.length, 1);
    /* aplicat: lat cât corpul, de la fața exterioară (0) până la fața din dreapta a setto-ului (770,5 + 19 = 789,5): 789,5 → 790 */
    eq([back[0].lung, back[0].larg, back[0].pz, back[0].sp], [2260, 790, 1, 3]);
    assert.equal(back[0].backPart, 1);
    assert.equal(back[0].elemento, "Schienale");
  });

  test("decupajul din spate: în coordonatele piesei, interior, fără să strice cotele", () => {
    const back = row(r, "schienale")[0];
    /* lung = înălțimea (y de la pardoseală), larg = lățimea (x de la capătul din stânga al spatelui: 0 la cel aplicat) */
    eq(back.scasso, { l: 400, w: 300, x: 1200, y: 300, forma: "R", r: 0, tip: "back", rif: "fata" });
  });

  test("rinforzo: două traverse între laterala stângă... coloana deschisă, grosime de structură", () => {
    const rl = row(r, "traversa_spate");
    assert.equal(rl.length, 1);
    /* coloana 2: de la fața din dreapta a setto-ului (789,5) la fața laterală (1541): 751,5 → 752; 100 înălțime; 2 buc */
    eq([rl[0].lung, rl[0].larg, rl[0].pz, rl[0].sp], [752, 100, 2, 19]);
    assert.equal(rl[0].bordo, "");
  });

  test("filler: material ca ușile, cota de tăiat = cât se vede + surplusul de potrivit", () => {
    const top = row(r, "filler", p => /sopra/.test(p.elemento))[0], dx = row(r, "filler", p => /dx/.test(p.elemento))[0];
    /* sus: L 1560 + 40 + 10 (filler dreapta cu tot cu surplus: 50) = 1610, înălțime 40 + 10 */
    eq([top.lung, top.larg, top.pz, top.sp], [1610, 50, 1, 19]);
    eq([top.bordo, dx.bordo], ["1L+1C", "1L+1C"]);   /* cantuit pe muchia vizibilă lungă și pe un capăt */
    /* dreapta: H 2260 × (40 + 10) */
    eq([dx.lung, dx.larg, dx.pz, dx.sp], [2260, 50, 1, 19]);
    eq(top.axis_mapping, { lung: "L", larg: "H", sp: "P" });
    eq(dx.axis_mapping, { lung: "H", larg: "L", sp: "P" });
  });

  test("ușile cu grile sunt rânduri separate, cu decupajul în cotele ușii; grila e accesoriu", () => {
    const doors = row(r, "frontale");
    assert.equal(doors.length, 4);
    const withV = doors.filter(d => d.scasso);
    assert.equal(withV.length, 2);
    /* jos: 40 de la marginea de jos, centrată (780 − 300) / 2 = 240 */
    eq(withV.find(d => d.lung === 1048).scasso, { l: 100, w: 300, x: 40, y: 240, forma: "R", r: 0, tip: "vent", rif: "fata" });
    /* sus: 1106 − 40 − 100 = 966 */
    eq(withV.find(d => d.lung === 1106).scasso, { l: 100, w: 300, x: 966, y: 240, forma: "R", r: 0, tip: "vent", rif: "fata" });
    const gr = row(r, "accessorio", p => /Griglia/.test(p.elemento));
    eq([gr[0].lung, gr[0].larg, gr[0].pz], [300, 100, 2]);
  });

  test("închiderea gabaritului și invarianții trec (spatele parțial nu cade pe lățime)", () => {
    eq(r.close(), []);
    eq(r.inv(), []);
  });

  test("același corp, aceleași piese (determinism)", () => {
    eq(JSON.stringify(build(CET).pieces), JSON.stringify(r.pieces));
  });
});

describe("Cetinic — spate încastrat și în cavă", () => {
  for (const mode of ["incassato", "applicato"]) test("backMode " + mode + ": închidere 0 mm", () => {
    const c = build(Object.assign(clone(CET), { backMode: mode }));
    eq(c.close(), []);
    eq(c.inv(), []);
  });
  test("spatele subțire în cavă nu se combină cu spatele parțial nesemnalat: construiește și închide", () => {
    const c = build(Object.assign(clone(CET), { backMode: "in_cava" }));
    eq(c.close(), []);
  });
});

describe("Cetinic — fără câmpurile noi, nimic nu se schimbă", () => {
  test("backCols cu toate coloanele = spatele obișnuit, rând cu rând", () => {
    const base = without(CET, ...FIT_KEYS), noVents = withoutVents(base);
    const a = build(noVents).pieces, b = build(Object.assign(clone(noVents), { backCols: [1, 2] })).pieces;
    assert.equal(JSON.stringify(b), JSON.stringify(a));
    const back = a.find(p => p.role === "schienale");
    assert.equal(back.backPart, undefined);
    assert.equal(back.larg, 1560);   // aplicat: lat cât corpul, ca înainte
  });
  test("o listă goală nu schimbă nimic", () => {
    const noVents = withoutVents(without(CET, ...FIT_KEYS));
    const a = build(noVents).pieces, b = build(Object.assign(clone(noVents), { backCutouts: [], backRails: [], fillers: [] })).pieces;
    assert.equal(JSON.stringify(b), JSON.stringify(a));
  });
});

describe("Cetinic — cote care nu au loc = eroare cu motivul ei", () => {
  const E1 = (patch, re) => { const m = errOf(Object.assign(clone(CET), patch)); assert.match(m, re, m); };
  test("coloană inexistentă / dublă / spate lipsă", () => {
    E1({ backCols: [3] }, /coloana 3 nu există/);
    E1({ backCols: [1, 1] }, /scrisă de două ori/);
    E1({ back: 0 }, /cere spate/);
  });
  test("decupaj în coloana fără spate", () => {
    E1({ backCutouts: [{ x: 1000, y: 1200, w: 100, h: 100 }] }, /coloana 2, care nu are spate/);
  });
  test("decupaj peste capătul spatelui, sub 10 mm, ieșit pe înălțime, suprapus", () => {
    E1({ backCutouts: [{ x: 700, y: 1200, w: 200, h: 100 }] }, /nu încape într-un singur spate|coloana 2/);
    E1({ backCutouts: [{ x: 300, y: 1200, w: 5, h: 100 }] }, /sub 10 mm/);
    E1({ backCutouts: [{ x: 300, y: 2200, w: 100, h: 200 }] }, /iese din spate/);
    E1({ backCutouts: [{ x: 300, y: 1200, w: 100, h: 100 }, { x: 350, y: 1250, w: 100, h: 100 }] }, /se suprapun/);
  });
  test("rinforzo: în afara luminii, înălțime, suprapus, coloană fără spate lipsă", () => {
    E1({ backRails: [{ y: 2200, h: 100 }] }, /iese din lumina interioară/);
    E1({ backRails: [{ y: 1051, h: 10 }] }, /între 30 și 400/);
    E1({ backRails: [{ y: 1051, h: 100 }, { y: 1100, h: 100 }] }, /se suprapun în coloana 2/);
    E1({ backRails: [{ y: 1051, cols: [3] }] }, /coloana 3 nu există/);
    E1({ backCols: undefined, back: 1, backRails: [{ y: 1051 }] }, /^$|./);   /* fără backCols, ambele coloane au spate: nimic implicit */
  });
  test("rinforzo fără nicio coloană deschisă cere `cols`", () => {
    const c = without(CET, "backCols"); c.backRails = [{ y: 1051 }];
    assert.match(errOf(c), /nu există nicio coloană fără spate/);
    c.backRails = [{ y: 1051, cols: [2] }];
    assert.equal(errOf(c), "");
  });
  test("rinforzo prin poliță", () => {
    E1({ partitions: [{ type: "setto", x: "center" }, { type: "ripiano", y: 1100, span: "right" }] }, /trece prin polița/);
  });
  test("filler: latură, mărime, dublu", () => {
    E1({ fillers: [{ side: "bottom", size: 40 }] }, /top \/ right \/ left/);
    E1({ fillers: [{ side: "top", size: 5 }] }, /între 10 și 150/);
    E1({ fillers: [{ side: "top", size: 40 }, { side: "top", size: 30 }] }, /două filler-e/);
    E1({ fillers: [{ side: "top", size: 40, scribe: 80 }] }, /între 0 și 50/);
  });
  test("grile: aproape de marginea laterală, prea mari, suprapuse, prea multe", () => {
    const f = clone(CET.fronts); f[2].vents = [{ at: "bottom", w: 700, h: 100 }];
    E1({ fronts: f }, /nu lasă 50 mm până la marginile ușii/);
    const g = clone(CET.fronts); g[2].vents = [{ at: "bottom", w: 300, h: 100 }, { at: "bottom", w: 300, h: 100 }];
    E1({ fronts: g }, /se suprapun/);
    const h = clone(CET.fronts); h[2].vents = [{ at: "bottom", w: 300, h: 1040 }];
    E1({ fronts: h }, /nu lasă 20 mm până la marginea ușii/);
    const k = clone(CET.fronts); k[2].vents = [{ at: "middle", w: 300, h: 100 }];
    E1({ fronts: k }, /top \/ bottom/);
  });
  test("numai pe tipologia standard; nu cu panta / treapta", () => {
    E1({ type: "scrivania" }, /standard|Cote absolute/);
    E1({ stepH: 300, stepP: 50 }, /treapta|nu se combină/);
  });
});

/* spatele ÎNCASTRAT: stă între laterale, deci 3D-ul și rândul au aceeași lățime. La cel aplicat rândul poartă lățimea corpului
   (ca `G.back_W`) și 3D-ul îl desenează între laterale, ca la spatele obișnuit — diferența e a lui, nu a spatelui parțial. */
const CETI = Object.assign(clone(CET), { backMode: "incassato" });
describe("Cetinic — 3D = distinta", () => {
  const r = build(CETI), o = r.ops();
  test("fiecare piesă fizică are rândul ei, la aceleași cote (0,5 mm), și în cavă", () => {
    for (const mode of ["incassato", "in_cava"]) {
      const rr = build(Object.assign(clone(CET), { backMode: mode })), oo = rr.ops();
      const bad = [];
      for (const p of oo.pieces) {
        const a = dims(p.length, p.width);
        const rows = rr.pieces.filter(x => x.role === p.role || (x.role === "base_cielo" && (p.role === "base" || p.role === "cielo")));
        if (!rows.length) { bad.push(p.role + " fără rând"); continue; }
        const ok = rows.some(x => { const d = dims(x.lung, x.larg); return Math.abs(a[0] - d[0]) <= 0.5 && Math.abs(a[1] - d[1]) <= 0.5; });
        if (!ok) bad.push(`${mode}: ${p.role} ${p.length}×${p.width} — distinta: ${rows.map(x => x.lung + "×" + x.larg).join(", ")}`);
      }
      eq([...new Set(bad)], []);
    }
  });
  test("(același, pe incassato, pas cu pas)", () => {
    const bad = [];
    for (const p of o.pieces) {
      const a = dims(p.length, p.width);
      const rows = r.pieces.filter(x => x.role === p.role || (x.role === "base_cielo" && (p.role === "base" || p.role === "cielo")));
      if (!rows.length) { bad.push(p.role + " fără rând"); continue; }
      const ok = rows.some(x => { const d = dims(x.lung, x.larg); return Math.abs(a[0] - d[0]) <= 0.5 && Math.abs(a[1] - d[1]) <= 0.5; });
      if (!ok) bad.push(`${p.role} ${p.length}×${p.width} — distinta: ${rows.map(x => x.lung + "×" + x.larg).join(", ")}`);
    }
    eq([...new Set(bad)], []);
  });
  test("numărul pieselor fizice = rândurile fără accesorii, cu bucățile", () => {
    const rows = r.pieces.filter(x => x.role !== "accessorio").reduce((s, x) => s + x.pz, 0);
    assert.equal(o.pieces.length, rows);
  });
  test("spatele are gaura și în 3D: aria cutiilor = aria spatelui − decupaj", () => {
    const bs = r.b.boxes.filter(b => b.sub === "back");
    const area = bs.reduce((s, b) => s + (b.x1 - b.x0) * (b.y1 - b.y0), 0);
    assert.ok(Math.abs(area - (770.5 * 2260 - 300 * 400)) < 1, String(area));
    assert.equal(new Set(bs.map(b => b.pk)).size, 1);
  });
  test("ușa cu grilă = ușa minus gaura, o singură piesă; grila e aceeași piesă (se mișcă cu ea)", () => {
    const d = o.pieces.filter(p => p.role === "frontale");
    assert.equal(d.length, 4);
    const doorBoxes = pk => r.b.boxes.filter(b => b.pk === pk);
    for (const p of d) {
      const bs = doorBoxes(p.pk), panels = bs.filter(b => b.kind === "f"), grilles = bs.filter(b => b.sub === "vent");
      const area = panels.reduce((s, b) => s + (b.x1 - b.x0) * (b.y1 - b.y0), 0);
      const nv = r.cfg.fronts.filter(f => f.x === Math.round(p.min[0]) && f.y === Math.round(p.min[1]))[0];
      const holes = (nv && nv.vents ? nv.vents.length : 0) * 300 * 100;
      assert.ok(Math.abs(area - ((p.max[0] - p.min[0]) * (p.max[1] - p.min[1]) - holes)) < 1, p.pk + " " + area);
      assert.equal(grilles.length, nv && nv.vents ? nv.vents.length : 0);
    }
  });
  test("pivotul ușii cu grilă vine din prima cutie: partea balamalei", () => {
    const right = r.b.boxes.filter(b => b.sub === "door" && b.hinge === "right");
    const firstByPk = {}; right.forEach(b => { if (!firstByPk[b.pk]) firstByPk[b.pk] = b; });
    Object.values(firstByPk).forEach(b => assert.ok(Math.abs(b.x1 - 1560) < 0.01, "prima cutie trebuie să atingă marginea dinspre balama: x1=" + b.x1));
  });
  test("filler-ele stau în planul ușilor", () => {
    const fb = r.b.boxes.filter(b => b.sub === "filler");
    assert.equal(fb.length, 2);
    fb.forEach(b => { assert.equal(b.z0, 410); assert.equal(b.z1, 429); assert.equal(b.kind, "f"); });
    const top = fb.find(b => b.y0 === 2260);
    eq([top.x0, top.x1, top.y1], [0, 1610, 2310]);
    const dx = fb.find(b => b.x0 === 1560);
    eq([dx.x1, dx.y0, dx.y1], [1610, 0, 2260]);
  });
});

describe("Cetinic — modelul de operații", () => {
  const r = build(CETI), o = r.ops();
  const ofRole = role => o.pieces.filter(p => p.role === role);
  test("rinforzo: fixat de laterală și de setto, câte un minifix la fiecare capăt", () => {
    const rails = ofRole("traversa_spate");
    assert.equal(rails.length, 2);
    rails.forEach(p => {
      const mf = o.hw.filter(h => h.type === "minifix" && h.piece === p.pk);
      assert.equal(mf.length, 2, "minifix la capete");
      const against = mf.map(h => o.pieces.find(q => q.pk === h.against).role).sort();
      eq(against, ["divisorio", "fianco"]);
    });
    assert.equal(o.warnings.filter(w => w.k === "opsNoRailPanel").length, 0);
  });
  test("decupajul din spate și grilele sunt găuri trecute la freză, în cotele piesei", () => {
    const back = ofRole("schienale")[0];
    const m = back.operations.filter(x => x.type === "mill");
    assert.equal(m.length, 1);
    eq([m[0].w, m[0].d, m[0].through], [400, 300, true]);
    const doors = ofRole("frontale").filter(p => p.operations.some(x => x.type === "mill"));
    assert.equal(doors.length, 2);
    doors.forEach(p => { const x = p.operations.find(q => q.type === "mill"); eq([x.w, x.d, x.through], [100, 300, true]); });
  });
  test("balamalele ușilor cu grilă rămân la locul lor, fără coliziune cu grila", () => {
    ofRole("frontale").forEach(p => {
      const cups = p.operations.filter(x => x.type === "drill" && x.dia === 35);
      assert.ok(cups.length >= 2, "cuve de balama");
      p.operations.filter(x => x.type === "mill").forEach(mi => cups.forEach(c => {
        const clear = Math.abs(c.x - mi.x) > mi.w / 2 + 17.5 || Math.abs(c.y - mi.y) > mi.d / 2 + 17.5;
        assert.ok(clear, "cupa balamalei pe grilă");
      }));
    });
  });
  test("pre-flight fără erori", () => {
    o.pieces.forEach(p => eq(p.preflight.filter(w => w.level === "error"), [], p.role));
  });
});

describe("Cetinic — mai multe spate, o singură coloană din trei", () => {
  const c3 = Object.assign(clone(CET), {
    L: 2300, partitions: [{ type: "setto", x: 770 }, { type: "setto", x: 1531 }],
    fronts: [{ x: 0, y: 100, w: 760, h: 2157 }, { x: 770, y: 100, w: 760, h: 2157 }, { x: 1540, y: 100, w: 760, h: 2157 }],
    backCols: [1, 3], backCutouts: [], backRails: [{ y: 1000, h: 100 }], fillers: [] });
  test("coloanele 1 și 3 au spate, coloana 2 rinforzo", () => {
    const r = build(c3);
    const back = row(r, "schienale");
    assert.equal(back.length, 2);
    eq(back.map(b => b.elemento), ["Schienale sez.1", "Schienale sez.2"]);
    eq(row(r, "traversa_spate").map(x => [x.lung, x.larg, x.pz]), [[Math.round(1531 - (770 + 19)), 100, 1]]);
    eq(r.close(), []);
    eq(r.inv(), []);
  });
});
