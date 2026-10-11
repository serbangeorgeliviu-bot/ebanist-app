/* Ebanist — U.3: corp fără tavan (sub chiuvetă, sub plită), D-72.
 *
 *   node --test test/top.test.js
 *
 * `cfg.top` = "plin" (cielul de sempre) | "traverse" (două traverse, față și
 * spate, aceeași grosime) | "none". Ce trebuie să rămână adevărat:
 *  - fără `top` (sau "plin") distinta de dinainte, rând cu rând (D-39);
 *  - înălțimea interioară, spatele în canal și catenele de închidere (D-43)
 *    țin și cu traverse și fără tavan, la 0 mm;
 *  - grosimea traversei vine din materialul rolului „cielo” (D-41);
 *  - găurirea: traversele se prind de laterale, tramezul urcă la amândouă;
 *  - o traversă care nu încape nu se generează în tăcere.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
const arr = x => Array.from(x || []);
const J = x => JSON.stringify(x);

function build(cfg, mats) {
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k",
    matOvr: {}, matAdd: [MM("__b", 19), MM("__c", 25), MM("__k", 3), MM("pfl5", 5)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "R", matBody: "__b", matFront: "__b", matBack: "__k" }, cfg);
  const b = S.buildModule(full);
  const pieces = b.pieces.map(x => Object.assign({}, x));
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  const M = S.carcassMaterials(full);
  const ths = [...new Set(Object.values(M.sp).concat(pieces.map(x => x.sp)).filter(x => x > 0))];
  return { b, full, pieces, G,
    close: () => arr(S.validateCarcassClosure(full, pieces, G)),
    ko: () => arr(S.failedInvariants(full, pieces, G, { materials: M.mats, thicknesses: ths })).map(r => r.id),
    ops: () => JSON.parse(JSON.stringify(S.generateOperations({ boxes: b.boxes, cfg: full, G }))) };
}
const rows = b => b.pieces.map(p => [p.elemento, p.lung, p.larg, p.pz, p.role, p.sp].join("|"));
const BASE = { type: "standard", L: 900, H: 720, P: 560, plinth: 100, tram: 0, shelves: 1, drawers: 0,
  doors: 2, back: 1, hang: 0, support: "zoccolo", shelfType: "mobile", drawerSys: "legno" };
const role = (r, x) => r.pieces.filter(p => p.role === x);
const boxesOf = (r, x) => r.b.boxes.filter(b => b.role === x);

describe("Fără top sau cu «plin» nimic nu se schimbă", () => {
  test("lipsă, null sau «plin»: aceleași piese și cutii", () => {
    const a = build(BASE);
    for (const t of [undefined, null, "plin", "bogus"]) {
      const c = build({ ...BASE, top: t });
      assert.equal(J(rows(c)), J(rows(a)));
      assert.equal(J(c.b.boxes), J(a.b.boxes));
    }
    assert.equal(role(a, "cielo").length + role(a, "base_cielo").length, 1);
  });
  test("cu «plin» corpul se închide ca înainte", () => {
    const r = build({ ...BASE, top: "plin" });
    assert.equal(J(r.close()), "[]"); assert.equal(J(r.ko()), "[]");
    assert.equal(r.G.H_int, 582);
  });
});

describe("Fără tavan", () => {
  const r = build({ ...BASE, top: "none" });
  test("nicio piesă de tavan, baza rămâne", () => {
    assert.equal(role(r, "cielo").length + role(r, "base_cielo").length + role(r, "traversa_cielo").length, 0);
    assert.equal(role(r, "base").length, 1);
    assert.equal(boxesOf(r, "cielo").length, 0);
  });
  test("lumina interioară câștigă grosimea tavanului", () => {
    assert.equal(r.G.H_int, 601); assert.equal(r.G.sp_top, 0); assert.equal(r.G.top, "none");
  });
  test("spatele în canal: intră numai jos, urcă până la marginea laterală", () => {
    assert.equal(r.G.back_H, 609);
    const back = r.b.boxes.find(b => b.role === "schienale");
    assert.ok(Math.abs(back.y1 - 720) < 1e-6, "spatele ajunge la H");
  });
  test("închiderea, invarianții și găurirea ies curate", () => {
    assert.equal(J(r.close()), "[]"); assert.equal(J(r.ko()), "[]");
    assert.equal(r.ops().warnings.filter(w => w.k !== "opsNoHingePanel").length, 0);
  });
  test("tramezul urcă până sus, fără semn de tăiere pe marginea laterală", () => {
    const t = build({ ...BASE, tram: 1, top: "none" });
    assert.equal(J(t.close()), "[]"); assert.equal(J(t.ko()), "[]");
    const div = role(t, "divisorio")[0];
    assert.equal(div.lung, t.G.H_int);
    const fianco = role(t, "fianco")[0];
    assert.ok(!(fianco.cuts || []).some(c => c >= fianco.lung - 0.01), "fără decupaj fantomă la capătul laturii");
  });
  test("fără tavan și cu spate încastrat: spatele nu se schimbă", () => {
    const a = build({ ...BASE, top: "none", backMode: "incassato" }), b = build({ ...BASE, backMode: "incassato" });
    assert.equal(a.G.back_H, b.G.back_H);
  });
  test("cote absolute: setul urcă până la marginea de sus", () => {
    const l = build({ ...BASE, doors: 0, top: "none", partitions: [{ type: "setto", x: "center" }] });
    const setto = l.pieces.find(p => p.role === "divisorio");
    assert.equal(setto.lung, l.G.H_int);
    assert.equal(J(l.close()), "[]");
  });
});

describe("Tavan din două traverse", () => {
  const r = build({ ...BASE, top: "traverse" });
  test("o linie, două piese: lungimea între laterale, lățimea din date", () => {
    const rl = role(r, "traversa_cielo");
    assert.equal(rl.length, 1);
    assert.equal(rl[0].pz, 2); assert.equal(rl[0].lung, r.G.Wi); assert.equal(rl[0].larg, 100);
    assert.equal(role(r, "base").length, 1);
    assert.equal(role(r, "cielo").length + role(r, "base_cielo").length, 0);
  });
  test("lățimea se alege (topRailW) și vine tot din motor", () => {
    const c = build({ ...BASE, top: "traverse", topRailW: 80 });
    assert.equal(role(c, "traversa_cielo")[0].larg, 80); assert.equal(c.G.rail_W, 80);
  });
  test("aceeași înălțime interioară ca la cielul plin", () => {
    assert.equal(r.G.H_int, build(BASE).G.H_int);
    assert.equal(r.G.back_H, build(BASE).G.back_H);
  });
  test("grosimea vine din materialul rolului «cielo» (D-41)", () => {
    const c = build({ ...BASE, top: "traverse", mat: { cielo: "__c" } });
    assert.equal(role(c, "traversa_cielo")[0].sp, 25);
    assert.equal(c.G.H_int, 576);
    assert.equal(J(c.close()), "[]"); assert.equal(J(c.ko()), "[]");
  });
  test("închiderea (inclusiv lanțul L al traverselor) și invarianții: curate", () => {
    assert.equal(J(r.close()), "[]"); assert.equal(J(r.ko()), "[]");
    const ch = S.reconstructCarcass(r.full, r.pieces, r.G).filter(c => c.chain === "traversa-tavan+2×fianco");
    assert.equal(ch.length, 1); assert.equal(ch[0].delta, 0);
  });
  test("o traversă tăiată prea scurtă cade în închidere", () => {
    const bad = r.pieces.map(p => p.role === "traversa_cielo" ? { ...p, lung: p.lung - 3 } : p);
    const rc = arr(S.validateCarcassClosure(r.full, bad, r.G));
    assert.ok(rc.length > 0 && rc.some(x => /traversele de tavan/.test(x.why || "") || x.chain === "traversa-tavan+2×fianco"));
  });
  test("3D: două cutii, față și spate, sus, cu rolul lor, fiecare piesă fizică a ei", () => {
    const bx = boxesOf(r, "traversa_cielo");
    assert.equal(bx.length, 2);
    assert.equal(new Set(bx.map(b => b.pk)).size, 2);
    bx.forEach(b => { assert.ok(Math.abs(b.y1 - 720) < 1e-6); assert.ok(Math.abs((b.z1 - b.z0) - 100) < 1e-6); });
    const zs = bx.map(b => b.z0).sort((a, c) => a - c);
    assert.ok(Math.abs(zs[1] + 100 - 560) < 1e-6, "una e lipită de față");
  });
  test("găurire: fiecare traversă se prinde de ambele laterale", () => {
    const o = r.ops();
    const rails = o.pieces.filter(p => p.role === "traversa_cielo");
    assert.equal(rails.length, 2);
    for (const p of rails) {
      const j = o.hw.filter(h => h.type === "minifix" && h.piece === p.pk);
      assert.ok(j.length >= 2, "minifix pe ambele capete");
      assert.equal(new Set(j.map(h => h.against)).size, 2, "două laterale diferite");
    }
  });
  test("tramezul se prinde de ambele traverse", () => {
    const t = build({ ...BASE, tram: 1, top: "traverse" });
    const o = t.ops();
    const div = o.pieces.find(p => p.role === "divisorio"), rails = o.pieces.filter(p => p.role === "traversa_cielo").map(p => p.pk);
    const to = new Set(o.hw.filter(h => h.type === "minifix" && h.piece === div.pk).map(h => h.against));
    rails.forEach(pk => assert.ok(to.has(pk), "tramezul e prins de traversa " + pk));
    assert.equal(J(t.close()), "[]"); assert.equal(J(t.ko()), "[]");
  });
});

describe("Ce nu încape nu se generează în tăcere", () => {
  test("traversă sub 30 mm", () => {
    assert.throws(() => build({ ...BASE, top: "traverse", topRailW: 20 }), /cel puțin 30/);
  });
  test("două traverse care umplu adâncimea", () => {
    assert.throws(() => build({ ...BASE, top: "traverse", topRailW: 300 }), /nu încap/);
  });
  test("perete în unghi: tavanul rămâne întreg și avertizează", () => {
    const a = build({ ...BASE, top: "traverse", angL: 100 });
    assert.equal(role(a, "traversa_cielo").length, 0);
    assert.equal(role(a, "cielo").length + role(a, "base_cielo").length, 1);
    assert.equal(a.b.warn.topAng, true);
    assert.equal(build({ ...BASE, top: "traverse" }).b.warn.topAng, false);
  });
  test("«none» pe perete în unghi merge: nu are ce să taie", () => {
    const a = build({ ...BASE, top: "none", angL: 100 });
    assert.equal(role(a, "cielo").length + role(a, "base_cielo").length, 0);
  });
});

describe("Determinism", () => {
  test("aceeași intrare, aceleași piese și ID-uri", () => {
    for (const t of ["plin", "traverse", "none"]) {
      const a = build({ ...BASE, tram: 1, top: t }), b = build({ ...BASE, tram: 1, top: t });
      assert.equal(J(rows(a)), J(rows(b))); assert.equal(J(a.b.boxes), J(b.b.boxes));
    }
  });
});
