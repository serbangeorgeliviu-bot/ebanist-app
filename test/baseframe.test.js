/* Ebanist — U.14: cadrul de nivelare (D-117), geometria pură.
 *
 *   node --test test/baseframe.test.js
 *
 * `ebanist-baseframe.js`: cadru din PAL pe cant sub o compoziție. Ce trebuie
 * să rămână adevărat:
 *  - grosimea șinei vine din material; fără ea nu se generează (D-41);
 *  - înălțimea se închide la 0 mm: șina + piciorul închis = h;
 *  - picioarele sunt sub intersecțiile traverselor cu șinele, numărate o dată,
 *    iar extensia fiecăruia = cota cea mai înaltă a pardoselii − cota lui;
 *  - o extensie peste cursa piciorului e eroare, nu picior mutat;
 *  - colțul e drept: un cadru trece, celălalt se oprește în muchia lui;
 *  - aceleași date, aceleași piese, aceleași ID-uri (determinism);
 *  - cotele din cod sunt `verificat:false`.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const B = E.appEngine();
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-baseframe.js"), "utf8"), B, { filename: "ebanist-baseframe.js" });
const J = x => JSON.stringify(x);
const D = JSON.parse(J(B.BASEFRAME_DEFAULTS));

const WALLS = [{ id: "w1", i: 0, L: 3000, angle: 90 }, { id: "w2", i: 1, L: 2400, angle: 90 }];
const mod = (name, wall, x0, x1, o) => Object.assign({ name, wall, x0, x1, depth: 560, rot: 0 }, o || {});
const MODS = [mod("A", "w1", 0, 1800), mod("B", "w1", 1800, 3000), mod("C", "w2", 600, 2400)];
const derive = (spec, walls, mods) => B.deriveBaseFrame(Object.assign({ name: "Cadru 1", mods: ["A", "B"], sp: 18 }, spec), walls || WALLS, mods || MODS);
const keys = a => a.map(e => e.k);

describe("Un perete", () => {
  const r = derive({});
  test("fără erori; un segment cât corpurile, adâncime = corp − retragere − joc", () => {
    assert.equal(J(r.errors), "[]");
    assert.equal(r.segments.length, 1);
    const s = r.segments[0];
    assert.equal(s.L, 3000);
    assert.equal(s.P, 560 - D.setback - D.wall_gap);
  });
  test("înălțimea se închide la 0 mm: șină + picior închis = h", () => {
    assert.equal(r.railH + D.foot.base, r.h);
    assert.equal(r.h, D.h);
    r.pieces.forEach(p => assert.equal(p.W, r.railH));
  });
  test("grosimea piesei e cea din material", () => {
    assert.ok(r.pieces.length > 0);
    r.pieces.forEach(p => assert.equal(p.T, 18));
    assert.equal(J(derive({ sp: 19 }).pieces.map(p => p.T).filter((v, i, a) => a.indexOf(v) === i)), "[19]");
  });
  test("două șine lungi și traverse la pas ≤ cross_max, câte una la fiecare capăt", () => {
    const rails = r.pieces.filter(p => p.role === "cadru_lung"), cross = r.pieces.filter(p => p.role === "cadru_transv");
    assert.equal(rails.length, 2);
    assert.ok(rails.every(p => p.L === 3000));
    assert.equal(cross.length, r.segments[0].cross);
    assert.equal(cross[0].x, 0);
    assert.ok(Math.abs(cross[cross.length - 1].x + 18 - 3000) < 0.2, "ultima traversă lipită de capăt");
    for (let i = 1; i < cross.length; i++) assert.ok(cross[i].x - cross[i - 1].x <= D.cross_max + 0.2);
    cross.forEach(c => assert.equal(c.L, r.segments[0].P - 2 * 18));
  });
  test("picioare: pe fața interioară a ambelor șine, la pas ≤ foot_pitch, numărate o dată", () => {
    assert.ok(r.feet.every(f => f.mount === "side"));
    const spate = r.feet.filter(f => f.side === "spate"), fata = r.feet.filter(f => f.side === "fata");
    assert.equal(spate.length, fata.length);
    for (let i = 1; i < spate.length; i++) assert.ok(spate[i].x - spate[i - 1].x <= D.foot_pitch + 0.2);
    assert.equal(spate[0].x, D.foot_inset);
    assert.ok(Math.abs(spate[spate.length - 1].x - (3000 - D.foot_inset)) < 0.2);
    /* fața interioară a șinei: spate = joc + grosime; față = adâncime − grosime */
    assert.equal(spate[0].y, D.wall_gap + 18);
    assert.equal(fata[0].y, r.segments[0].P + D.wall_gap - 18);
    assert.equal(r.segments[0].feet, r.feet.length);
    assert.equal(r.segments[0].feet, r.feet.length);
    const ids = r.feet.map(f => f.id);
    assert.equal(new Set(ids).size, ids.length);
  });
  test("corpurile stau la h peste reper", () => {
    assert.equal(J(r.modules.map(m => m.hBase)), J([D.h, D.h]));
  });
});

describe("Pardoseala", () => {
  test("fără cote: extensie 0 și avertisment", () => {
    const r = derive({});
    assert.ok(keys(r.warnings).includes("bfNoFloor"));
    assert.ok(r.feet.every(f => f.ext === 0));
  });
  test("extensia = cota cea mai înaltă − cota de la picior, interpolată", () => {
    const floor = [{ wall: "w1", x: 0, z: 0 }, { wall: "w1", x: 3000, z: 12 }];
    const r = derive({ floor });
    assert.equal(r.zMax, 12);
    const f0 = r.feet[0], fl = r.feet[r.feet.length - 1];
    assert.ok(Math.abs(f0.ext - (12 - 12 * (f0.x / 3000))) < 0.15, "ext " + f0.ext);
    assert.ok(Math.abs(fl.ext - (12 - 12 * (fl.x / 3000))) < 0.15);
    assert.ok(r.feet.every(f => f.ext >= 0 && f.ext <= D.foot.travel));
    assert.equal(r.floorSpan, 12);
  });
  test("o pardoseală mai denivelată decât cursa piciorului e eroare", () => {
    const r = derive({ floor: [{ wall: "w1", x: 0, z: 0 }, { wall: "w1", x: 3000, z: D.foot.travel + 10 }] });
    assert.ok(keys(r.errors).includes("bfFootTravel"));
  });
  test("interpolarea: în afara punctelor, cel mai apropiat; între ele, liniar", () => {
    const f = [{ wall: "w1", x: 100, z: 2 }, { wall: "w1", x: 300, z: 6 }];
    assert.equal(B.bfFloorAt(f, "w1", 0), 2);
    assert.equal(B.bfFloorAt(f, "w1", 200), 4);
    assert.equal(B.bfFloorAt(f, "w1", 999), 6);
    assert.equal(B.bfFloorAt(f, "w2", 100), null);
  });
});

describe("Erori, nu valori inventate", () => {
  test("fără grosime nu se generează", () => assert.ok(keys(derive({ sp: null }).errors).includes("bfNoThickness")));
  test("fără corpuri", () => assert.ok(keys(derive({ mods: [] }).errors).includes("bfNoMods")));
  test("corp lipsă / rotit", () => {
    assert.ok(keys(derive({ mods: ["Z"] }).errors).includes("bfModMissing"));
    assert.ok(keys(derive({ mods: ["A"] }, null, [mod("A", "w1", 0, 900, { rot: 90 })]).errors).includes("bfModRotated"));
  });
  test("prea jos sau prea puțin adânc", () => {
    assert.ok(keys(derive({ h: 30 }).errors).includes("bfTooLow"));
    assert.ok(keys(derive({ setback: 500 }).errors).includes("bfTooShallow"));
  });
  test("negativ", () => assert.ok(keys(derive({ setback: -1 }).errors).includes("bfNegative")));
});

describe("Colț", () => {
  const r = derive({ mods: ["A", "B", "C"] });
  test("un cadru trece, celălalt se oprește în muchia lui", () => {
    assert.equal(J(r.errors), "[]");
    assert.equal(r.segments.length, 2);
    const [a, b] = r.segments;
    assert.equal(a.end, "corner"); assert.equal(b.start, "butt");
    assert.equal(b.from, 560 - D.setback, "începe la fața cadrului care trece, nu la perete");
    assert.equal(r.joints.length, 1);
    assert.equal(r.joints[0].passing, 0); assert.equal(r.joints[0].butting, 1);
  });
  test("«second» inversează: al doilea cadru trece", () => {
    const s = derive({ mods: ["A", "B", "C"], through: ["second"] });
    assert.equal(s.joints[0].passing, 1);
    assert.equal(s.segments[0].end, "butt"); assert.equal(s.segments[1].start, "corner");
  });
  test("unghi neortogonal e eroare", () => {
    const w = [{ id: "w1", i: 0, L: 3000, angle: 80 }, WALLS[1]];
    assert.ok(keys(derive({ mods: ["A", "C"] }, w).errors).includes("bfCornerAngle"));
  });
  test("pereți neadiacenți", () => {
    const w3 = [WALLS[0], { id: "wx", i: 1, L: 1000, angle: 90 }, { id: "w3", i: 2, L: 2000, angle: 90 }];
    const m = [mod("A", "w1", 0, 900), mod("C", "w3", 0, 900)];
    assert.ok(keys(derive({ mods: ["A", "C"] }, w3, m).errors).includes("bfWallsNotAdjacent"));
  });
});

describe("Piciorul din catalog", () => {
  test("cotele piciorului ales înlocuiesc pe cele generice: înălțimea șinei și cursa", () => {
    const r = derive({ foot: { base: 40, travel: 15, dia: 60 } });
    assert.equal(r.railH, D.h - 40);
    assert.ok(r.feet.every(f => f.base === 40 && f.dia === 60));
    const bad = derive({ foot: { base: 40, travel: 15 }, floor: [{ wall: "w1", x: 0, z: 0 }, { wall: "w1", x: 3000, z: 20 }] });
    assert.ok(keys(bad.errors).includes("bfFootTravel"), "cursa 15 < denivelare 20");
  });
  test("fără `foot`, cotele din date", () => assert.equal(derive({}).railH, D.h - D.foot.base));
  test("piciorul sub șină (mount:\"under\") stă pe axa șinei", () => {
    const ru = derive({ foot: { base: 30, travel: 20, dia: 38, mount: "under" } });
    const sp = ru.feet.find(f => f.side === "spate"), fa = ru.feet.find(f => f.side === "fata");
    assert.equal(sp.y, D.wall_gap + 9); assert.equal(fa.y, ru.segments[0].P + D.wall_gap - 9);
  });
  test("articolul implicit din catalog (Häfele 637.42.950) poartă aceleași cote ca datele implicite", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "app", "index.html"), "utf8");
    const m = src.match(/id:"haf_42950"[^\n]*foot:\{base:([\d.]+),travel:(\d+),dia:(\d+),plate:(\d+),screw:(\d+),mount:"side",bracket:(\d+)\}/);
    assert.ok(m, "haf_42950 cu foot:{…} în categoria pied");
    assert.equal(J([+m[1], +m[2], +m[3], +m[4], +m[5], +m[6]]), J([D.foot.base, D.foot.travel, D.foot.dia, D.foot.plate, D.foot.screw, D.foot.bracket]));
    assert.equal(D.foot.mount, "side");
  });
});

describe("Modulul de proiect (type:\"cadru\")", () => {
  const MM = E.MM;
  B.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__b", matOvr: {}, matAdd: [MM("__b", 18)], hwProd: {} };
  const r = derive({ mods: ["A", "B", "C"], floor: [{ wall: "w1", x: 0, z: 0 }, { wall: "w1", x: 3000, z: 12 }] });
  const cfgOf = k => Object.assign(B.baseFrameSegCfg(r, k, "Cadru " + k), { matBody: "__b", matFront: "__b", matBack: "__b" });
  test("segmentul devine rânduri: șine, traverse, picioare, cu aceleași numere ca geometria", () => {
    [0, 1].forEach(k => {
      const m = B.buildModule(cfgOf(k)), sg = r.segments[k];
      const row = el => m.pieces.find(p => p.elemento === el);
      assert.equal(row("Sina cadru").pz, 2); assert.equal(row("Sina cadru").lung, Math.round(sg.L));
      assert.equal(row("Traversa cadru").pz, sg.cross);
      assert.equal(row("Piedino cadru").pz, sg.feet);
      assert.equal(row("Piedino cadru").lung, D.foot.plate);
      assert.ok(m.pieces.every(p => p.elemento === "Piedino cadru" || p.sp === 18));
    });
  });
  test("cutiile 3D: de la pardoseală (picioare) până la h; șinele de la capătul picioarelor; nimic sub 0", () => {
    const m = B.buildModule(cfgOf(0));
    const ys = m.boxes.map(b => [b.y0, b.y1]);
    assert.equal(Math.min(...ys.map(y => y[0])), 0); assert.equal(Math.max(...ys.map(y => y[1])), D.h);
    m.boxes.filter(b => b.role === "cadru").forEach(b => { assert.equal(b.y0, D.foot.base); assert.equal(b.y1, D.h); });
    m.boxes.forEach(b => assert.ok(b.x1 > b.x0 && b.z1 > b.z0));
  });
  test("cutiile nu sunt piese de panou (nu intră în găurire) și rolul picioarelor e accesoriu", () => {
    const m = B.buildModule(cfgOf(0));
    assert.ok(m.boxes.filter(b => b.role === "cadru").length > 0);
    assert.equal(m.pieces.find(p => p.elemento === "Piedino cadru").role, "accessorio");
  });
  test("fără material nu se generează", () => {
    assert.throws(() => B.buildModule(Object.assign(cfgOf(0), { matBody: "nu-exista" })), /Cadru/);
  });
  test("segmentul se potrivește cu geometria: x local pornește de la capătul segmentului", () => {
    const c = B.baseFrameSegCfg(r, 1, "n");
    assert.equal(c.cross[0].x, 0); assert.ok(c.feet.every(f => f.x >= 0 && f.x <= r.segments[1].L));
    assert.equal(c.P, r.segments[1].P + D.wall_gap);
  });
});

describe("Determinism și date", () => {
  test("același input, aceleași piese și ID-uri", () => {
    const fl = [{ wall: "w1", x: 0, z: 0 }, { wall: "w1", x: 3000, z: 8 }];
    assert.equal(J(derive({ floor: fl, mods: ["A", "B", "C"] })), J(derive({ floor: fl, mods: ["A", "B", "C"] })));
  });
  test("cotele din cod sunt marcate verificat:false", () => assert.equal(D.verificat, false));
  test("un corp care iese din cadru avertizează", () => {
    const m = [mod("A", "w1", 0, 1800), mod("B", "w1", 1800, 3000)];
    const r = derive({ mods: ["A", "B"] }, [{ id: "w1", i: 0, L: 2500, angle: 90 }], m);
    assert.ok(keys(r.warnings).includes("bfModOutside"));
  });
});
