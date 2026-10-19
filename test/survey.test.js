/* Ebanist — Releveu: geometria conturului (ebanist-survey.js, D-82).
 *
 *   node --test test/survey.test.js
 *
 * planPoints e singura sursă a conturului; decalajul de închidere se spune
 * cu cifră și cu ce perete sau colț îl explică; DXF-ul devine pereți fără
 * oglindire (planul arată ca în programul de desen).
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-survey.js"), "utf8");
const S = new Function(SRC + "\nreturn globalThis.EBSurvey;")();
const near = (a, b, t) => Math.abs(a - b) <= (t == null ? 0.6 : t);

/* DXF minimal, ca îl scrie un program de desen */
const dxf = (ents, units) => {
  const h = units != null ? `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n${units}\n0\nENDSEC\n` : "";
  return h + "0\nSECTION\n2\nENTITIES\n" + ents + "0\nENDSEC\n0\nEOF\n";
};
const lw = (pts, closed, bulges) => "0\nLWPOLYLINE\n90\n" + pts.length + "\n70\n" + (closed ? 1 : 0) + "\n" +
  pts.map((p, i) => `10\n${p[0]}\n20\n${p[1]}\n` + (bulges && bulges[i] ? `42\n${bulges[i]}\n` : "")).join("");
const line = (a, b) => `0\nLINE\n10\n${a[0]}\n20\n${a[1]}\n11\n${b[0]}\n21\n${b[1]}\n`;

/* conturul refăcut din pereți, comparat cu poligonul original: același
   poligon prin rotație (fără oglindire) */
function congruentNoMirror(walls, poly) {
  const P = S.planPoints(walls).slice(0, -1);
  if (P.length !== poly.length) return false;
  const n = P.length;
  const sgn = pts => { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a.x * b.y - b.x * a.y; } return Math.sign(s); };
  /* poligonul DXF se citește în y în jos, ca pe ecran */
  const D = poly.map(p => ({ x: p[0], y: -p[1] }));
  for (const order of [D, D.slice().reverse()]) {
    if (sgn(order) !== sgn(P)) continue;
    for (let s = 0; s < n; s++) {
      const R = order.map((_, i) => order[(i + s) % n]);
      let ok = true;
      for (let i = 0; i < n && ok; i++) for (let j = i + 1; j < n; j++)
        if (!near(Math.hypot(P[i].x - P[j].x, P[i].y - P[j].y), Math.hypot(R[i].x - R[j].x, R[i].y - R[j].y), 1.5)) { ok = false; break; }
      if (ok) return true;
    }
  }
  return false;
}

describe("planPoints", () => {
  test("dreptunghi 3200 × 2800 se închide", () => {
    const P = S.planPoints([{ len: 3200, angle: 90 }, { len: 2800, angle: 90 }, { len: 3200, angle: 90 }, { len: 2800, angle: 90 }]);
    assert.equal(P.length, 5);
    assert.ok(near(P[4].x, 0) && near(P[4].y, 0));
    assert.ok(near(P[1].x, 3200) && near(P[2].y, 2800));
  });
  test("fără unghi → 90°", () => {
    const P = S.planPoints([{ len: 1000 }, { len: 1000 }]);
    assert.ok(near(P[2].x, 1000) && near(P[2].y, 1000));
  });
});

describe("decalajul de închidere", () => {
  const rect = (a, b, c, d) => [{ len: a, angle: 90 }, { len: b, angle: 90 }, { len: c, angle: 90 }, { len: d, angle: 90 }];
  test("contur închis: decalaj ~0, fără explicații", () => {
    const c = S.closure(rect(3200, 2800, 3200, 2800));
    assert.ok(c.gap < 1 && c.closed && c.hints.length === 0);
  });
  test("un perete cu 12 mm greșit: decalajul e 12 și hint-ul numește peretele (sau opusul lui)", () => {
    const c = S.closure(rect(3200, 2800, 3188, 2800));
    assert.ok(near(c.gap, 12, 0.5));
    const h = c.hints.filter(x => x.kind === "len").map(x => [x.wall, Math.round(x.delta)]);
    assert.ok(h.some(x => x[0] === 2 && x[1] === 12) && h.some(x => x[0] === 0 && x[1] === -12), JSON.stringify(h));
  });
  test("un colț cu 2° greșit: hint de unghi pe colțul bun", () => {
    const c = S.closure([{ len: 3200, angle: 90 }, { len: 2800, angle: 92 }, { len: 3200, angle: 90 }, { len: 2800, angle: 90 }]);
    const a = c.hints.find(x => x.kind === "angle");
    assert.ok(a && a.wall === 1 && near(a.delta, -2, 0.1), JSON.stringify(c.hints));
  });
  test("hint-urile au mereu restul mic: o cotă singură ar închide conturul", () => {
    const w = [{ len: 3200, angle: 90 }, { len: 2800, angle: 93 }, { len: 3170, angle: 90 }, { len: 2830, angle: 86 }];
    const c = S.closure(w);
    assert.ok(c.gap > 50);
    for (const h of c.hints) assert.ok(h.residual <= Math.max(8, c.gap * 0.08), JSON.stringify(h));
    assert.ok(c.hints.length <= 2);
  });
  test("pereți fără lungime: nu se pretinde nimic", () => {
    const c = S.closure([{ len: 3200, angle: 90 }, { len: null, angle: 90 }, { len: 100, angle: 90 }]);
    assert.equal(c.complete, false);
    assert.equal(c.hints.length, 0);
  });
});

describe("peretele care închide", () => {
  test("3 pereți dreptunghiulari → al patrulea e 2800 la 90°", () => {
    const cw = S.closingWall([{ len: 3200, angle: 90 }, { len: 2800, angle: 90 }, { len: 3200, angle: 90 }]);
    assert.deepEqual(cw, { prevAngle: 90, wall: { len: 2800, angle: 90 } });
  });
  test("contur neregulat: după închidere decalajul e doar rotunjirea", () => {
    for (const w of [[{ len: 3000, angle: 90 }, { len: 2000, angle: 88 }, { len: 3100, angle: 91 }],
                     [{ len: 4100, angle: 85 }, { len: 1500, angle: 200 }, { len: 900, angle: 120 }]]) {
      const cw = S.closingWall(w), w2 = w.map(x => ({ ...x }));
      w2[w2.length - 1].angle = cw.prevAngle; w2.push(cw.wall);
      assert.ok(S.closure(w2).gap < 3, "gap " + S.closure(w2).gap);
    }
  });
  test("sub 2 pereți: nimic", () => assert.equal(S.closingWall([{ len: 100, angle: 90 }]), null));
});

describe("diagonale", () => {
  const rect = [{ len: 3000, angle: 90 }, { len: 4000, angle: 90 }, { len: 3000, angle: 90 }, { len: 4000, angle: 90 }];
  test("diagonala dreptunghiului 3000×4000 e 5000; delta față de măsurat", () => {
    const d = S.diagonal(rect, { a: 1, b: 3, len: 5012 });
    assert.ok(near(d.plan, 5000) && near(d.delta, 12));
  });
  test("fără cotă măsurată: doar planul; colțuri identice: null", () => {
    assert.equal(S.diagonal(rect, { a: 1, b: 3 }).delta, null);
    assert.equal(S.diagonal(rect, { a: 2, b: 2, len: 10 }), null);
  });
});

describe("DXF → pereți", () => {
  test("dreptunghi LWPOLYLINE închis, în milimetri", () => {
    const r = S.wallsFromDxf(dxf(lw([[0, 0], [3200, 0], [3200, 2800], [0, 2800]], true), 4));
    assert.ok(r.ok, r.error);
    assert.deepEqual(r.walls.map(w => w.len).sort(), [2800, 2800, 3200, 3200]);
    assert.ok(r.walls.every(w => near(w.angle, 90, 0.1)));
    assert.ok(r.gap < 3);
  });
  test("aceeași formă în sens orar și antiorar: același contur, fără oglindire", () => {
    const poly = [[0, 0], [5000, 0], [5000, 2000], [2500, 2000], [2500, 4000], [0, 4000]];     // cameră în L
    for (const pts of [poly, poly.slice().reverse()]) {
      const r = S.wallsFromDxf(dxf(lw(pts, true), 4));
      assert.ok(r.ok && r.walls.length === 6, r.error);
      assert.ok(r.walls.some(w => w.angle > 180), "colț intrând (unghi > 180)");
      assert.ok(congruentNoMirror(r.walls, poly), "forma diferă sau e oglindită");
    }
  });
  test("unități: metri (INSUNITS 6) și centimetri (5)", () => {
    const m = S.wallsFromDxf(dxf(lw([[0, 0], [3.2, 0], [3.2, 2.8], [0, 2.8]], true), 6));
    assert.deepEqual(m.walls.map(w => w.len).sort(), [2800, 2800, 3200, 3200]);
    const c = S.wallsFromDxf(dxf(lw([[0, 0], [320, 0], [320, 280], [0, 280]], true), 5));
    assert.deepEqual(c.walls.map(w => w.len).sort(), [2800, 2800, 3200, 3200]);
  });
  test("fără $INSUNITS: se iau milimetri și se avertizează", () => {
    const r = S.wallsFromDxf(dxf(lw([[0, 0], [3200, 0], [3200, 2800], [0, 2800]], true)));
    assert.ok(r.ok && r.warnings.includes("units"));
    assert.equal(r.walls[0].len === 3200 || r.walls[0].len === 2800, true);
  });
  test("LINE-uri separate se înlănțuie", () => {
    const p = [[0, 0], [4000, 0], [4000, 3000], [0, 3000]];
    const e = line(p[0], p[1]) + line(p[2], p[1]) + line(p[2], p[3]) + line(p[3], p[0]);   // unele inversate, dezordonate
    const r = S.wallsFromDxf(dxf(e, 4));
    assert.ok(r.ok, r.error);
    assert.deepEqual(r.walls.map(w => w.len).sort(), [3000, 3000, 4000, 4000]);
  });
  test("vârfuri coliniare nu fac pereți în plus; vârfuri duble nici", () => {
    const r = S.wallsFromDxf(dxf(lw([[0, 0], [1600, 0], [3200, 0], [3200, 0], [3200, 2800], [0, 2800]], true), 4));
    assert.equal(r.walls.length, 4);
  });
  test("mai multe contururi: se alege cel mai mare (camera, nu mobila)", () => {
    const e = lw([[0, 0], [3200, 0], [3200, 2800], [0, 2800]], true) + lw([[500, 500], [900, 500], [900, 900], [500, 900]], true);
    const r = S.wallsFromDxf(dxf(e, 4));
    assert.deepEqual(r.walls.map(w => w.len).sort(), [2800, 2800, 3200, 3200]);
  });
  test("arce (bulge): se avertizează, se ia coarda", () => {
    const r = S.wallsFromDxf(dxf(lw([[0, 0], [3200, 0], [3200, 2800], [0, 2800]], true, [0, 0.4, 0, 0]), 4));
    assert.ok(r.ok && r.warnings.includes("arc"));
  });
  test("erori cunoscute, nu excepții", () => {
    assert.equal(S.wallsFromDxf("AutoCAD Binary DXF\r\n\u001a\u0000").error, "binary");
    assert.equal(S.wallsFromDxf("nu e dxf").error, "format");
    assert.equal(S.wallsFromDxf(dxf(lw([[0, 0], [100, 0], [100, 100]], false), 4)).error, "nocontour");
    assert.equal(S.wallsFromDxf(dxf("", 4)).error, "nocontour");
  });
});

/* D-88: panta tavanului din cele trei înălțimi măsurate */
describe("Panta tavanului din Releveu (D-86, D-88)", () => {
  const sv = (o) => Object.assign({ heights: [2400, 2300, 1800], slope: "x" }, o);
  test("fără pantă aleasă: nicio propunere", () => {
    assert.equal(S.slopeProposal(sv({ slope: null })), null);
    assert.equal(S.slopeProposal(sv({ slope: "" })), null);
    assert.equal(S.slopeProposal({ heights: [1, 2, 3] }), null);
  });
  test("punctul 1 și 3 devin h0 și h1, minus jocul; H = cea mai mare", () => {
    const p = S.slopeProposal(sv({}));
    assert.deepEqual({ ...p }, { axis: "x", h0: 2380, h1: 1780, H: 2380 });
    const q = S.slopeProposal(sv({ slope: "z", heights: [1500, 1900, 2200] }));
    assert.deepEqual({ ...q }, { axis: "z", h0: 1480, h1: 2180, H: 2180 });
  });
  test("jocul și diferența minimă se pot da", () => {
    assert.equal(S.slopeProposal(sv({}), { joc: 0 }).h0, 2400);
    assert.equal(S.slopeProposal(sv({ heights: [2400, 0, 2390] }), { minDiff: 5 }).h1, 2370);
  });
  test("punctul 1 sau 3 lipsă → eroare «points»", () => {
    assert.equal(S.slopeProposal(sv({ heights: [2400, 2300, null] })).error, "points");
    assert.equal(S.slopeProposal(sv({ heights: [null, 2300, 1800] })).error, "points");
    assert.equal(S.slopeProposal(sv({ heights: [] })).error, "points");
  });
  test("diferență sub minim → eroare «flat», cu diferența măsurată", () => {
    const p = S.slopeProposal(sv({ heights: [2400, 2300, 2390] }));
    assert.equal(p.error, "flat"); assert.equal(p.diff, 10);
  });
  test("sugestia: apare când punctele 1 și 3 diferă destul și nu s-a ales nimic", () => {
    assert.equal(S.slopeSuggest(sv({ slope: null })), 600);
    assert.equal(S.slopeSuggest(sv({ slope: "x" })), null);
    assert.equal(S.slopeSuggest(sv({ slope: null, heights: [2400, 2300, 2390] })), null);
    assert.equal(S.slopeSuggest(sv({ slope: null, heights: [2400, 2300, null] })), null);
    assert.equal(S.slopeSuggest(null), null);
  });
});
