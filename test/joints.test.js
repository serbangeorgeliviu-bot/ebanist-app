/* Tipuri de imbinare: minifix / confirmat / tasel / lamela / domino — aceeasi
   geometrie de capat, alta legatura. node --test test/joints.test.js */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
const ARM = { type: "standard", L: 1000, H: 2200, P: 600, plinth: 80, tram: 1, shelves: 3, drawers: 0, doors: 2, back: 1, hang: 0, support: "zoccolo", shelfType: "mobile" };
function gen(conn, cfg) {
  S.handleIsProfile = () => false;
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k", matOvr: {},
    matAdd: [MM("__b", 19), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "M", matBody: "__b", matFront: "__b", matBack: "__k" }, ARM, cfg || {}, conn ? { hwSel: { conn } } : {});
  const b = S.buildModule(full), G = S.deriveCarcass(S.carcassParams(full, {}));
  return JSON.parse(JSON.stringify(S.generateOperations({ boxes: b.boxes, cfg: full, G })));
}
const ops = o => o.pieces.flatMap(p => p.operations.map(x => ({ ...x, pc: p })));

test("implicit: minifix, fara canale", () => {
  const o = gen(null);
  assert.equal(o.joint, "minifix");
  assert.ok(ops(o).some(x => x.note === "eccentrico minifix"));
  assert.ok(!ops(o).some(x => x.type === "slot"));
});
test("confirmat: Ø7 prin fata lui F, pilot Ø5×50 in muchia lui E, nimic de minifix", () => {
  const o = gen("gen_confirmat"), a = ops(o);
  assert.equal(o.joint, "confirmat");
  const th = a.filter(x => x.note === "confirmat"), pl = a.filter(x => x.note === "pilot confirmat");
  assert.ok(th.length > 0 && th.length === pl.length);
  th.forEach(x => { assert.equal(x.dia, 7); assert.ok(x.through); });
  pl.forEach(x => { assert.equal(x.dia, 5); assert.equal(x.depth, 50); assert.ok(x.face < 5, "in muchie"); });
  assert.ok(!a.some(x => /minifix/.test(x.note)));
  assert.ok(o.hw.every(h => h.type !== "minifix"));
});
test("tasel: perechi Ø8 8+23 mm, pas maxim 128, fara eccentric", () => {
  const o = gen("gen_dowel"), a = ops(o).filter(x => x.note === "tassello");
  assert.ok(a.length > 0);
  a.forEach(x => assert.equal(x.dia, 8));
  assert.ok(a.every(x => x.depth === 12 || x.depth === 23));
});
test("lamela si domino: canale in muchia lui E si in fata lui F, centrate pe grosime", () => {
  for (const [id, len, thk, dEdge, dFace] of [["gen_biscuit", 56, 4, 12.5, 12.5], ["fes_domino", 22, 8, 25, 15], ["lam_clamex", 69.6, 9.8, 14, 14]]) {
    const o = gen(id), s = ops(o).filter(x => x.type === "slot");
    assert.ok(s.length > 0, id);
    assert.ok(s.some(x => x.face < 5) && s.some(x => x.face === 5 || x.face === 6), "muchie + fata");
    s.forEach(x => { assert.equal(x.len, len); assert.equal(x.thk, thk); assert.equal(x.depth, x.face < 5 ? dEdge : dFace);
      if (x.face >= 5) assert.ok(x.depth < x.pc.thickness - 2, "nu strapunge"); });
    s.filter(x => x.face < 5).forEach(x => assert.ok(Math.abs(x.z - x.pc.thickness / 2) < 0.2, "z la jumatatea grosimii"));
    assert.equal(s.length % 2, 0, "cate un canal pe fiecare piesa");
  }
});
test("determinism: acelasi corp, aceleasi operatii", () => {
  for (const id of ["gen_confirmat", "gen_dowel", "gen_biscuit", "fes_domino", "lam_clamex"])
    assert.deepEqual(JSON.stringify(gen(id)), JSON.stringify(gen(id)));
});
test("id necunoscut → minifix", () => assert.equal(gen("zzz").joint, "minifix"));

/* Familia Lamello P-System (D-134): articolul din catalog alege varianta; cotele din broșura Lamello */
const LAM = { lam_clamex: ["clamex", 14, 14, "Lamello Clamex P-14"], lam_clamex_p10: ["clamex", 10, 10, "Lamello Clamex P-10"], lam_clamex_medius: ["clamex", 14, 10, "Lamello Clamex P-14/10 Medius"],
  lam_clamex_flexus: ["clamex", 14, 10, "Lamello Clamex P-14/10 Flexus"], lam_clamex_cnc: ["clamex", 14, 14, "Lamello Clamex P-14 CNC"],
  lam_tenso_p14: ["tenso", 14, 14, "Lamello Tenso P-14"], lam_tenso_p10: ["tenso", 10, 10, "Lamello Tenso P-10"], lam_bisco_p14: ["bisco", 14, 14, "Lamello Bisco P-14"], lam_bisco_p10: ["bisco", 10, 10, "Lamello Bisco P-10"] };
const chord = d => 2 * Math.sqrt(d * (100.4 - d));   // coarda frezei P-System Ø 100,4 la adâncimea d
for (const [id, [fam, dE, dF, note]] of Object.entries(LAM)) {
  test(`P-System · ${id}: canale, adâncimi, coardă, catalog`, () => {
    const o = gen(id);
    assert.equal(o.joint, fam); assert.equal(o.jointId, id);
    const slots = ops(o).filter(x => x.type === "slot");
    assert.ok(slots.length > 0, "fără canale");
    const hws = o.hw.filter(h => h.type === fam);
    assert.ok(hws.length > 0 && hws.every(h => h.catalog === id && h.note === note), "conectorul poartă articolul și numele din catalog");
    for (const x of slots) {
      assert.ok(x.depth === dE || x.depth === dF, `adâncime ${x.depth}`);
      const d = x.depth; assert.ok(Math.abs(x.len - chord(d)) < 0.12, `coarda canalului ${x.len} ≠ ${chord(d).toFixed(1)} la adâncimea ${d}`);
      assert.equal(x.note, "canal " + fam);
    }
    assert.ok(slots.some(x => x.depth === dE) && slots.some(x => x.depth === dF), "ambele adâncimi (muchie și față) apar");
  });
}

/* Festool DOMINO (D-138): canalul are lățimea și grosimea tenonului, adâncimea totală = lungimea lui, în fața lui F cel mult grosimea ei − 4 */
const DOM = { fes_domino: [22, 8, 40], fes_domino_4x20: [17, 4, 20], fes_domino_5x30: [18.8, 5, 30], fes_domino_6x40: [20, 6, 40], fes_domino_8x50: [22, 8, 50], fes_domino_10x50: [23.9, 10, 50],
  fes_domino_xl_8x80: [22, 8, 80], fes_domino_xl_10x80: [23.9, 10, 80], fes_domino_xl_12x100: [26, 12, 100], fes_domino_xl_14x100: [27.9, 14, 100], fes_domino_xl_14x140: [27.9, 14, 140] };
for (const [id, [wd, th, ln]] of Object.entries(DOM)) {
  test(`DOMINO · ${id}: canal ${wd} × ${th}, adâncime totală ${ln}`, () => {
    const o = gen(id), slots = ops(o).filter(x => x.type === "slot");
    assert.equal(o.joint, "domino"); assert.ok(slots.length > 0);
    const hws = o.hw.filter(h => h.type === "domino"); assert.ok(hws.length > 0 && hws.every(h => h.catalog === id));
    for (const h of hws) {
      const sl = slots.filter(x => x.hw === h.id), tot = sl.reduce((q, x) => q + x.depth, 0);
      assert.equal(sl.length, 2, "un canal în fiecare piesă");
      sl.forEach(x => { assert.ok(Math.abs(x.len - wd) < 0.11, `lățime ${x.len}`); assert.ok(Math.abs(x.thk - th) < 0.01, `grosime ${x.thk}`); });
      assert.ok(Math.abs(tot - ln) < 0.11, `adâncime totală ${tot} ≠ ${ln}`);
      assert.ok(sl.every(x => x.depth <= ln - 8 + 0.01), "ambele părți au cel puțin 8 mm");
    }
  });
}

test("lamele clasice Lamello #0 și #10: lungimea canalului = lamela, adâncime din lățime", () => {
  for (const [id, len, d] of [["lam_biscuit_0", 47, 8.5], ["lam_biscuit_10", 53, 10.5]]) {
    const o = gen(id), slots = ops(o).filter(x => x.type === "slot");
    assert.equal(o.joint, "biscuit"); assert.ok(slots.length > 0);
    slots.forEach(x => { assert.equal(x.len, len); assert.equal(x.depth, d); });
    assert.ok(o.hw.filter(h => h.type === "biscuit").every(h => h.catalog === id));
  }
});

/* Festool conectori D8 (D-139): KV D8/50 și MSV D8/25 — 15 mm în fața lui F, 28 mm în muchia lui E, bușon Ø 15 în fața lui E la 18,8 mm de muchie */
for (const id of ["fes_kv_d8_50", "fes_msv_d8_25"]) {
  test(`${id}: canale 15/28, bușon Ø15, hw „kv” cu articolul din catalog`, () => {
    const o = gen(id);
    assert.equal(o.joint, "kv"); assert.equal(o.jointId, id);
    const hws = o.hw.filter(h => h.type === "kv"); assert.ok(hws.length > 0 && hws.every(h => h.catalog === id));
    for (const h of hws) {
      const all = ops(o).filter(x => x.hw === h.id), sl = all.filter(x => x.type === "slot"), dr = all.filter(x => x.type === "drill");
      assert.equal(sl.length, 2); assert.deepEqual(sl.map(x => x.depth).sort((a, b) => a - b), [15, 28]);
      sl.forEach(x => { assert.equal(x.len, 22); assert.equal(x.thk, 8); });
      assert.equal(dr.length, 1); assert.equal(dr[0].dia, 15); assert.equal(dr[0].depth, 15.8);
      assert.equal(dr[0].note, "foro connettore");
      /* bușonul stă la 18,8 mm de muchia lui E, pe axa muchiei */
      const edge = h.w[h.eAx]; assert.ok(Math.abs(Math.abs(dr[0]._w[h.eAx] - edge) - 18.8) < 0.11, `distanța ${Math.abs(dr[0]._w[h.eAx] - edge)}`);
    }
  });
}

/* Lamello Cabineo și Invis Mx2 (D-140), cotele din broșura Lamello Drilling System, „Technical information” */
for (const [id, scr] of [["lam_cabineo_8", 8], ["lam_cabineo_12", 12]]) {
  test(`${id}: buzunar din trei găuri Ø15×11 la 11,2 mm, șurub Ø5×${scr} în F la 5 mm de fața lui E`, () => {
    const o = gen(id); assert.equal(o.joint, "cabineo");
    const hws = o.hw.filter(h => h.type === "cabineo"); assert.ok(hws.length > 0 && hws.every(h => h.catalog === id));
    for (const h of hws) {
      const all = ops(o).filter(x => x.hw === h.id), pk = all.filter(x => x.dia === 15), sc = all.filter(x => x.dia === 5);
      assert.equal(pk.length, 3); pk.forEach(x => assert.equal(x.depth, 11));
      const d = pk.map(x => Math.abs(x._w[h.eAx] - h.w[h.eAx])).sort((a, b) => a - b);
      [11.1, 22.3, 33.5].forEach((v, i) => assert.ok(Math.abs(d[i] - v) < 0.11, `centrul ${i}: ${d[i]} ≠ ${v}`));
      assert.equal(sc.length, 1); assert.equal(sc[0].depth, scr);
      assert.ok(Math.abs(Math.abs(sc[0]._w[h.camAx] - pk[0]._w[h.camAx]) - 5) < 0.11, "axa șurubului la 5 mm de fața cu buzunar");
    }
  });
}
for (const [id, fd] of [["lam_invis_mx2_30", 32], ["lam_invis_mx2_14", 14]]) {
  test(`${id}: două găuri Ø12 coaxiale, 37 mm în E și ${fd} mm în F, axa la 9–15 mm de fața lui E`, () => {
    const o = gen(id); assert.equal(o.joint, "invis");
    const hws = o.hw.filter(h => h.type === "invis"); assert.ok(hws.length > 0 && hws.every(h => h.catalog === id));
    for (const h of hws) {
      const all = ops(o).filter(x => x.hw === h.id); assert.equal(all.length, 2); all.forEach(x => assert.equal(x.dia, 12));
      assert.deepEqual(all.map(x => x.depth).sort((a, b) => a - b), [fd, 37].sort((a, b) => a - b));
      assert.ok(Math.abs(all[0]._w[h.camAx] - all[1]._w[h.camAx]) < 0.01 && Math.abs(all[0]._w[h.sAx] - all[1]._w[h.sAx]) < 0.01, "găurile nu sunt coaxiale");
    }
  });
}

/* Lamello Divario P-18 (D-141): canal P-System de 78 × 9,8 × 8 în F, două găuri Ø 8 × 10 la 32 mm în muchia lui E */
test("lam_divario_p18: canal 78 × 9,8 × 8 în F și două găuri Ø8 × 10 la 32 mm în E", () => {
  const o = gen("lam_divario_p18"); assert.equal(o.joint, "divario");
  const hws = o.hw.filter(h => h.type === "divario"); assert.ok(hws.length > 0 && hws.every(h => h.catalog === "lam_divario_p18"));
  for (const h of hws) {
    const all = ops(o).filter(x => x.hw === h.id), sl = all.filter(x => x.type === "slot"), dr = all.filter(x => x.type === "drill");
    assert.equal(sl.length, 1); assert.equal(sl[0].len, 78); assert.equal(sl[0].thk, 9.8); assert.equal(sl[0].depth, 8); assert.equal(sl[0].note, "canal divario");
    assert.equal(dr.length, 2); dr.forEach(x => { assert.equal(x.dia, 8); assert.equal(x.depth, 10); });
    assert.ok(Math.abs(Math.abs(dr[0]._w[h.sAx] - dr[1]._w[h.sAx]) - 32) < 0.11, "găurile nu sunt la 32 mm");
  }
});

/* A3 audit 14.11: o ușă prea joasă pentru balamale (83 mm) are cupa și tasealele în afara piesei: se spune (opsHingeShort); o ușă normală nu are avertismentul */
test("balamale: ușă de 83 mm → opsHingeShort; ușă normală → fără", () => {
  const short = gen(null, { L: 600, H: 1000, P: 450, plinth: 100, tram: 0, shelves: 0, drawers: 4, doors: 1, back: 1, hang: 0, drawerSys: "legrabox", drawerDist: "cucina" });
  assert.ok(short.warnings.some(w => w.k === "opsHingeShort"), "ușa joasă trebuie să avertizeze: " + JSON.stringify(short.warnings));
  const ok = gen(null, {});
  assert.ok(!ok.warnings.some(w => w.k === "opsHingeShort"), "ușa normală nu avertizează");
});
