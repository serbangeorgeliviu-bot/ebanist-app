/* Ebanist — iluminat LED (D-157): bandă neon flex 6×6 ca accesoriu la metru + transformator, dimmer și cabluri Häfele.
 *
 *   node --test test/led.test.js
 *
 * Ce trebuie să rămână adevărat:
 *  - fără opțiunea `led`, distinta e aceeași, rând cu rând (D-39);
 *  - „top”: banda are lățimea interioară; „manual”: cota introdusă (peste 0 și până la 20 m);
 *  - banda e rând de accesorii (role accesorio, material de accesoriu), nu panou;
 *  - transformatoarele: puterea benzii / (20 W × 0,8), rotunjit în sus, cel puțin unul;
 *  - catalogul poartă codurile de pe etichete, iar atributele electrice sunt cele din constanta LED.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
const LED = vm.runInContext("LED", S);

function build(cfg) {
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__b",
    matOvr: {}, matAdd: [MM("__b", 19), MM("pfl5", 5)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "B", type: "standard", L: 900, H: 2000, P: 400, plinth: 80, tram: 0, shelves: 2, drawers: 0,
    doors: 0, back: 1, hang: 0, support: "zoccolo", matBody: "__b", matFront: "__b", matBack: "__b", drawerSys: "legno" }, cfg);
  const b = S.buildModule(full);
  return { b, pieces: b.pieces.map(x => Object.assign({}, x)) };
}
const strip = r => r.pieces.filter(p => p.elemento === "Striscia LED");
const J = x => JSON.stringify(x);

describe("Implicit: nimic nu se schimbă", () => {
  const a = build({}), b = build({ led: "" }), c = build({ led: "nimic" });
  test("fără LED, cu LED gol sau cu valoare necunoscută: aceeași distinta", () => {
    assert.equal(strip(a).length, 0);
    assert.equal(J(a.pieces), J(b.pieces)); assert.equal(J(a.pieces), J(c.pieces));
  });
  test("cu LED, restul pieselor rămân aceleași și se adaugă exact un rând", () => {
    const on = build({ led: "top" });
    assert.equal(on.pieces.length, a.pieces.length + 1);
    assert.equal(J(on.pieces.filter(p => p.elemento !== "Striscia LED")), J(a.pieces));
  });
});

describe("Lungimea benzii", () => {
  test("«top»: lățimea interioară (900 − 2 × 19 = 862 mm), 6 mm lățime, un rând", () => {
    const r = strip(build({ led: "top" }));
    assert.equal(r.length, 1); assert.equal(r[0].lung, 862); assert.equal(r[0].larg, LED.sect); assert.equal(r[0].pz, 1);
  });
  test("«manual»: cota introdusă; 0, negativ sau peste 20 m: nicio bandă", () => {
    assert.equal(strip(build({ led: "manual", ledLen: 3000 }))[0].lung, 3000);
    assert.equal(strip(build({ led: "manual", ledLen: 0 })).length, 0);
    assert.equal(strip(build({ led: "manual", ledLen: -5 })).length, 0);
    assert.equal(strip(build({ led: "manual", ledLen: LED.maxLen + 1 })).length, 0);
    assert.equal(strip(build({ led: "manual", ledLen: LED.maxLen }))[0].lung, LED.maxLen);
  });
  test("banda e accesoriu, nu panou: rol «accessorio» și material de accesoriu", () => {
    const r = strip(build({ led: "top" }))[0];
    assert.equal(r.role, "accessorio");
    assert.match(String(r.mat || r.materiale || ""), /^accessorio/i);
  });
});

describe("Transformatoare (20 W × 0,8 = 16 W pe unul; 7,2 W/m)", () => {
  const kit = vm.runInContext("ledKit", S);
  test("sub 2,2 m: un transformator; la 2,2 m exact: unul; peste: două", () => {
    assert.equal(kit(1000).drv, 1);
    assert.equal(kit(2222).drv, 1);          // 2,222 m × 7,2 = 16,0 W
    assert.equal(kit(2300).drv, 2);
    assert.equal(kit(4400).drv, 2);          // 31,7 W
    assert.equal(kit(4500).drv, 3);
  });
  test("role de 3,024 m (Emuca 5220220): se cumpără rolele întregi, cel puțin una", () => {
    assert.equal(kit(862).rolls, 1); assert.equal(kit(3000).rolls, 1); assert.equal(kit(3024).rolls, 1);
    assert.equal(kit(3025).rolls, 2); assert.equal(kit(6048).rolls, 2); assert.equal(kit(6049).rolls, 3);
  });
  test("cel puțin unul, chiar la o bandă foarte scurtă; puterea e lungime × W/m", () => {
    assert.equal(kit(50).drv, 1);
    assert.ok(Math.abs(kit(3000).w - 21.6) < 1e-9);
  });
});

describe("Catalogul: codurile de pe etichete", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "app", "index.html"), "utf8");
  for (const [cat, art, brand] of [["ledstrip", "5220220", "Emuca"], ["leddrv", "833.75.933", "Häfele"], ["leddim", "833.89.133", "Häfele"], ["ledsw", "833.89.142", "Häfele"], ["ledmains", "833.89.009", "Häfele"]])
    test(cat + ": " + brand + " " + art, () => {
      const re = new RegExp(" " + cat + ":\\[\\s*\\{id:\"[a-z0-9_]+\",brand:\"" + brand + "\"[^\\n]*art:\"" + art.replace(/\./g, "\\.") + "\"");
      assert.match(src, re);
    });
  test("constantele LED = datele de pe etichete (7,2 W/m, 24 V, 20 W)", () => {
    assert.equal(LED.wpm, 7.2); assert.equal(LED.v, 24); assert.equal(LED.drvW, 20); assert.equal(LED.sect, 6);
    assert.match(src, /emu_5220220[^\n]*wpm:7\.2,v:24/); assert.match(src, /haf_833_75_933[^\n]*w:20,v:24/);
  });
  test("prețurile sunt estimări de pe net (est:1), nu prețuri confirmate; codurile sunt cele de pe etichete (fără chk)", () => {
    for (const [id, pr] of [["emu_5220220", 35], ["haf_833_75_933", 26], ["haf_833_89_133", 22], ["haf_833_89_142", 7], ["haf_833_89_009", 9]])
      assert.match(src, new RegExp("id:\"" + id + "\"[^\\n]*price:" + pr + ",est:1"));
  });
  test("banda: rolă de 3,024 m, la fel în constantă și în catalog", () => {
    assert.equal(LED.roll, 3024); assert.match(src, /emu_5220220[^\n]*roll:3024/);
  });
});

/* ---- canalul din operații (D-157) ---- */
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
function ops(cfg) {
  const { b } = build(cfg);
  const full = Object.assign({ name: "B", type: "standard", L: 900, H: 2000, P: 400, plinth: 80, tram: 0, shelves: 2, drawers: 0, doors: 0, back: 1,
    hang: 0, support: "zoccolo", matBody: "__b", matFront: "__b", matBack: "__b", drawerSys: "legno" }, cfg);
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  return JSON.parse(J(S.generateOperations({ boxes: b.boxes, cfg: full, G })));
}
const ledGrooves = o => o.pieces.flatMap(p => (p.operations || []).filter(op => op.type === "groove" && /LED/.test(op.note || "")).map(op => ({ p, op })));
describe("Canalul 6×6 în operații", () => {
  const HD = vm.runInContext("HW_DRILL", S);
  test("datele canalului: 6×6 mm, 40 mm de la față, nemăsurat (verificat:false)", () => {
    assert.equal(HD.led.w, 6); assert.equal(HD.led.d, 6); assert.equal(HD.led.from_front, 40); assert.equal(HD.led.verificat, false);
  });
  test("«top»: un canal pe tavan, 6 × 6, pe toată lățimea panoului", () => {
    const g = ledGrooves(ops({ led: "top" }));
    assert.equal(g.length, 1);
    assert.equal(g[0].p.role, "cielo"); assert.equal(g[0].op.width, 6); assert.equal(g[0].op.depth, 6);
    assert.ok(Math.abs(g[0].op.from.y - g[0].op.to.y) < 0.2 || Math.abs(g[0].op.from.x - g[0].op.to.x) < 0.2, "paralel cu o muchie");
    const len = Math.hypot(g[0].op.to.x - g[0].op.from.x, g[0].op.to.y - g[0].op.from.y);
    const strip = strip_(build({ led: "top" }));
    assert.ok(Math.abs(len - strip) <= 0.6, "lungimea canalului = a benzii (" + len + " vs " + strip + ")");
  });
  test("la 40 mm de muchia din față, pe fața de dedesubt", () => {
    const g = ledGrooves(ops({ led: "top" }))[0];
    const top = g.p, T = top.thickness;
    assert.ok(T > 6 + 3);
    assert.ok(g.op.face === 5 || g.op.face === 6);
  });
  test("fără LED sau «manual»: nicio operație de canal; restul operațiilor nu se schimbă", () => {
    assert.equal(ledGrooves(ops({})).length, 0); assert.equal(ledGrooves(ops({ led: "manual", ledLen: 2000 })).length, 0);
    const a = ops({}), b = ops({ led: "top" });
    const strip = o => J(o.pieces.map(p => [p.role, (p.operations || []).filter(x => !/LED/.test(x.note || "")).length]));
    assert.equal(strip(a), strip(b));
  });
});
function strip_(r) { return r.pieces.find(p => p.elemento === "Striscia LED").lung; }
