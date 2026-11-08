/* Ebanist — U.14: `support:"cadru"`, corpul pe cadrul de nivelare (D-117).
 *
 *   node --test test/cadru.test.js
 *
 * Corpul stă ridicat pe cadru ca pe picioare (`plinth` = înălțimea cadrului),
 * dar picioarele sunt ale cadrului: corpul nu are accesoriu „Piedino” și nu le
 * numără în deviz. Ce trebuie să rămână adevărat:
 *  - aceleași piese și aceleași cote ca pe picioare, în afară de accesoriul picior;
 *  - închiderea gabaritului și invarianții trec la 0 mm, cu cadrul de 100 sau 150;
 *  - laterala începe la înălțimea cadrului și are H − h;
 *  - ușa nu pornește de la pardoseală, ci de la cadru;
 *  - fără „cadru”, proiectul vechi neschimbat (D-39).
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
const arr = x => Array.from(x || []);
const J = x => JSON.stringify(x);

function build(cfg) {
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__b",
    matOvr: {}, matAdd: [MM("__b", 19)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "B", type: "standard", L: 800, H: 720, P: 560, plinth: 120, tram: 0, shelves: 1, drawers: 0,
    doors: 2, back: 1, hang: 0, support: "cadru", matBody: "__b", matFront: "__b", matBack: "__b", drawerSys: "legno" }, cfg);
  const b = S.buildModule(full);
  const pieces = b.pieces.map(x => Object.assign({}, x));
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  const M = S.carcassMaterials(full);
  const ths = [...new Set(Object.values(M.sp).concat(pieces.map(x => x.sp)).filter(x => x > 0))];
  return { b, full, pieces, G,
    close: () => arr(S.validateCarcassClosure(full, pieces, G)),
    ko: () => arr(S.failedInvariants(full, pieces, G, { materials: M.mats, thicknesses: ths })).map(r => r.id),
    A: () => arr(S.checkAssertions(G, {})).map(a => a.id) };
}
const dims = r => r.pieces.filter(p => !/piedino/i.test(p.elemento || "")).map(p => [p.elemento, p.lung, p.larg, p.pz]);

describe("corp pe cadru", () => {
  test("aceleași piese ca pe picioare, fără accesoriul picior", () => {
    const c = build({ support: "cadru" }), f = build({ support: "piedini" });
    assert.equal(J(dims(c)), J(dims(f)));
    assert.ok(f.pieces.some(p => /piedino/i.test(p.elemento || "")), "pe picioare: accesoriul există");
    assert.ok(!c.pieces.some(p => /piedino/i.test(p.elemento || "")), "pe cadru: nu există");
    assert.ok(!c.b.boxes.some(b => b.role === "piedino"));
  });
  test("închiderea, invarianții și aserțiunile trec, la 100 și la 150 mm", () => {
    [100, 120, 150].forEach(h => {
      const c = build({ plinth: h });
      assert.equal(J(c.close().filter(x => x && x.ok === false)), "[]", "închidere la " + h);
      assert.equal(J(c.ko()), "[]", "invarianți la " + h);
      assert.equal(J(c.A()), "[]", "aserțiuni la " + h);
    });
  });
  test("lateralele pornesc la înălțimea cadrului și au H − h", () => {
    const c = build({ plinth: 120 });
    const sides = c.b.boxes.filter(b => b.role === "fianco");
    assert.ok(sides.length >= 2);
    sides.forEach(b => { assert.equal(b.y0, 120); assert.equal(Math.round(b.y1 - b.y0), 720 - 120); });
    assert.equal(c.G.in.h_base, 120, "înălțimea corpului de la pardoseală = cadrul");
    assert.equal(c.G.H_fianco, 720 - 120);
  });
  test("ușa stă deasupra cadrului, nu coboară la pardoseală", () => {
    const c = build({});
    const doors = c.b.boxes.filter(b => b.sub === "door");
    assert.ok(doors.length === 2);
    doors.forEach(b => assert.ok(b.y0 >= 120, "ușa începe la " + b.y0));
  });
  test("zoccolo, picioare și sospeso rămân cum erau", () => {
    const z = build({ support: "zoccolo" });
    assert.ok(z.b.boxes.some(b => b.role === "zoccolo"));
    const s = build({ support: "sospeso", hang: 1 });
    assert.ok(!s.b.boxes.some(b => b.role === "piedino" || b.role === "zoccolo"));
  });
});
