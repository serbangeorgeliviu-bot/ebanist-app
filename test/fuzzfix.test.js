/* Ebanist — corecturile din triajul fuzz D-78 (20.11.2026, 5.93.2).
 *
 *   node --test test/fuzzfix.test.js
 *
 *  - pat: câte doage încap fără să se suprapună; un pat de lungime normală rămâne cu 14 (distinta nu se schimbă);
 *  - masă: prea mică pentru patru picioare + zargile = eroare declarată, nu picioare suprapuse;
 *  - fuzz: coliziunea pe corpuri rotunde/ovale/racordate se măsoară pe banda lateralului, nu pe dreptunghiul întreg.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;

function build(cfg) {
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k",
    matOvr: {}, matAdd: [MM("__b", 19), MM("__k", 3), MM("pfl5", 5), MM("__p", 8)], hwProd: { guida: "blum_tandem" } };
  return S.buildModule(Object.assign({ name: "F", matBody: "__b", matFront: "__b", matBack: "__k" }, cfg));
}
const BED = { type: "letto", L: 1660, L2: 900, H: 950, tram: 0, shelves: 0, drawers: 0, doors: 0, back: 0, hang: 0 };
const slats = b => b.boxes.filter(x => x.role === "doga").sort((a, c) => a.z0 - c.z0);
const nPieces = b => (b.pieces.find(p => /^Doga faggio/.test(p.elemento)) || {}).pz;

describe("pat: doagele nu se suprapun", () => {
  test("pat de lungime normală: 14 doage, ca înainte", () => {
    for (const P of [2000, 2100, 1400, 1100]) {
      const b = build({ ...BED, P }); assert.equal(slats(b).length, 14, "P=" + P); assert.equal(nPieces(b), 14);
    }
  });
  test("pat scurt: mai puține doage, fără suprapunere, distinta = 3D", () => {
    for (const P of [900, 650, 624, 400]) {
      const b = build({ ...BED, P }), s = slats(b);
      assert.ok(s.length >= 2 && s.length < 14, "P=" + P + " n=" + s.length);
      assert.equal(nPieces(b), s.length, "distinta numără ca 3D-ul");
      for (let i = 1; i < s.length; i++) assert.ok(s[i].z0 >= s[i - 1].z1 - 0.01, "P=" + P + " doagele " + (i - 1) + "/" + i + " se suprapun");
    }
  });
  test("pat prea scurt pentru 2 doage: eroare declarată", () => {
    assert.throws(() => build({ ...BED, P: 150 }), /prea mică/);
  });
});

describe("masă: picioarele nu se suprapun", () => {
  const TAB = { type: "tavolo", H: 760, tram: 0, shelves: 0, drawers: 0, doors: 0, back: 0, hang: 0 };
  test("masă obișnuită: patru picioare distincte", () => {
    const b = build({ ...TAB, L: 1600, P: 800 }), g = b.boxes.filter(x => x.role === "gamba"); assert.equal(g.length, 4);
    const ov = (a, c) => Math.min(a.x1, c.x1) - Math.max(a.x0, c.x0) > 0.6 && Math.min(a.z1, c.z1) - Math.max(a.z0, c.z0) > 0.6;
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) assert.ok(!ov(g[i], g[j]));
  });
  test("masă prea mică pentru picioare + zargile: eroare declarată", () => {
    assert.throws(() => build({ ...TAB, L: 386, P: 242 }), /Masă: prea mică/);
    assert.throws(() => build({ ...TAB, L: 250, P: 800 }), /Masă: prea mică/);
  });
});

describe("fuzz: coliziunea pe corpuri cu lateral curb", () => {
  const src = fs.readFileSync(path.join(__dirname, "fuzz.js"), "utf8");
  test("coll() măsoară aria piesei în banda lateralului (out/inn), nu în dreptunghiul întreg", () => {
    assert.match(src, /ring\.out/); assert.match(src, /ring\.inn/); assert.match(src, /rg\.ring\.open \? n - 1 : n/);
  });
  test("rotund și racordat: nicio piesă nu intră în bandă", () => {
    for (const cfg of [{ type: "tondo", L: 679, H: 1200, P: 427, shelves: 3 }, { type: "raccordato", L: 2021, H: 1400, P: 450, shelves: 8, rcorner: 80, back: 1 }]) {
      const b = build({ L2: 900, tram: 0, drawers: 0, doors: 0, back: 0, hang: 0, ...cfg }), f = b.boxes.find(x => x.role === "fianco");
      assert.ok(f && f.ring && f.ring.out && f.ring.inn, cfg.type + ": banda");
      for (const x of b.boxes.filter(q => q.role === "base" || q.role === "ripiano" || q.role === "cielo")) {
        /* toate vârfurile piesei stau în interiorul conturului interior (sau pe el), la 0,6 mm */
        const pc = x.pc || [[x.x0, x.z0], [x.x1, x.z0], [x.x1, x.z1], [x.x0, x.z1]];
        const minX = Math.min(...f.ring.inn.map(p => p[0])) - 0.6, maxX = Math.max(...f.ring.inn.map(p => p[0])) + 0.6;
        for (const p of pc) assert.ok(p[0] >= minX && p[0] <= maxX, cfg.type + " " + x.role + " în afara benzii în x");
      }
    }
  });
});
