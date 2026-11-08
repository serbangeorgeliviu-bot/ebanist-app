/* Șabloane de găurire pentru printare 3D (D-125): plase etanșe, cote, bucșe, STL.   node --test jig.test.js */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
/* se evaluează fișierul ca script clasic (cum îl încarcă browserul): `app/` e modul ESM pentru Netlify */
const ctx = {}; ctx.self = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-jig.js"), "utf8"), ctx, { filename: "ebanist-jig.js" });
const J = ctx.EBJig;

const polyArea = (n, R) => 0.5 * n * R * R * Math.sin(2 * Math.PI / n);
const SQ2 = Math.SQRT2;
/* vârfurile unui inel de gaură: toate punctele unei plase aflate la distanță `r` de o axă dată, la ±eps */
const distToAxis = (p, ax) => { const d = [p[0] - ax.p[0], p[1] - ax.p[1], p[2] - ax.p[2]], t = d[0] * ax.d[0] + d[1] * ax.d[1] + d[2] * ax.d[2];
  return Math.hypot(d[0] - t * ax.d[0], d[1] - t * ax.d[1], d[2] - t * ax.d[2]); };

test("rând de găuri: un corp etanș, volum = placă + prag − găuri, cote pe găuri", () => {
  for (const o of [{ n: 6, pitch: 32, dist: 37, bushOD: 8, bushLen: 12 }, { n: 2, pitch: 128, dist: 37, bushOD: 8, bushLen: 12 }, { n: 1, pitch: 0, dist: 20, bushOD: 10, bushLen: 15 }]) {
    const r = J.rowJig(o), m = r.shells[0], I = r.info;
    assert.equal(r.shells.length, 1);
    assert.ok(J.watertight(m), "plasa nu e etanșă: " + JSON.stringify(o));
    const bb = J.bbox(r.shells);
    const len = bb.size[0], W = bb.size[1]; // y de la 0 la W; z de la −F la T
    const seg = Math.max(32, Math.min(96, Math.round(I.seat * 5)));
    const exp = len * (bb.size[1] - 0) * 0 + (len * W * I.plate) + (len * I.fence * I.hook) - o.n * polyArea(seg, I.seat / 2) * I.plate;
    assert.ok(Math.abs(J.volume(m) - exp) < 0.5, "volum " + J.volume(m).toFixed(2) + " ≠ " + exp.toFixed(2));
    assert.ok(J.volume(m) > 0);
    /* găurile: diametrul = bucșă + joc 0,2, la `dist` de planul muchiei panoului, la `pitch` una de alta */
    assert.ok(Math.abs(I.seat - (o.bushOD + 0.2)) < 1e-9);
    I.bores.forEach((b, k) => { assert.ok(Math.abs(b.y - I.panelEdgeY - o.dist) < 1e-9); if (k) assert.ok(Math.abs(b.x - I.bores[k - 1].x - o.pitch) < 1e-9); });
    /* toate vârfurile unei găuri sunt la raza de locaș față de axa ei */
    I.bores.forEach(b => { const ring = m.v.filter(p => Math.abs(Math.hypot(p[0] - b.x, p[1] - b.y) - b.r) < 1e-4 && (Math.abs(p[2]) < 1e-9 || Math.abs(p[2] - I.plate) < 1e-9));
      assert.ok(ring.length >= 2 * 32, "inelul găurii"); });
  }
});
test("rând: joc și bucșă din parametri; pas prea mic = eroare", () => {
  const a = J.rowJig({ n: 2, pitch: 32, dist: 37, bushOD: 8, bushLen: 12, clear: 0.2 }), b = J.rowJig({ n: 2, pitch: 32, dist: 37, bushOD: 8, bushLen: 12, clear: 0.4 });
  assert.ok(Math.abs(a.info.seat - 8.2) < 1e-9 && Math.abs(b.info.seat - 8.4) < 1e-9);
  assert.throws(() => J.rowJig({ n: 3, pitch: 9, dist: 37, bushOD: 8, bushLen: 12 }), /prea mic/);
});
test("rând: pragul se agață pe muchie — nimic din placă nu stă dincolo de planul muchiei sub planul plăcii", () => {
  const { shells, info } = J.rowJig({ n: 3, pitch: 32, dist: 37, bushOD: 8, bushLen: 12 });
  shells[0].v.forEach(p => { if (p[2] < -1e-9) assert.ok(p[1] <= info.panelEdgeY + 1e-9, "material sub placă în dreptul panoului"); });
});
test("colț 45°: corpuri pozitive, nicio parte nu intră în gaura bucșei sau în picior, axa trece prin muchie la cota dată", () => {
  const o = { legW: 70, drop: 40, bushOD: 10, bushLen: 15 }, r = J.cornerJig(o), ax = r.info.axis, R = r.info.R;
  r.shells.forEach((m, i) => { assert.ok(J.watertight(m), "corpul " + i + " nu e etanș"); assert.ok(J.volume(m) > 0, "corpul " + i + " are volum ≤ 0"); });
  assert.equal(JSON.stringify(ax.p), "[0,0,-40]"); assert.ok(Math.abs(ax.d[0] - SQ2 / 2) < 1e-12 && Math.abs(ax.d[1] - SQ2 / 2) < 1e-12);
  /* blocul (ultimul corp): inelul găurii e pe cilindrul din jurul diagonalei, la R = (OD + joc)/2 */
  const blk = r.shells[3], ring = blk.v.filter(p => Math.abs(distToAxis(p, ax) - R) < 1e-3);
  assert.ok(ring.length >= 2 * 32, "inel găurit");
  /* niciun vârf din celelalte corpuri nu e în interiorul cilindrului găurii */
  [0, 1, 2].forEach(i => r.shells[i].v.forEach(p => { const t = (p[0] - ax.p[0]) * ax.d[0] + (p[1] - ax.p[1]) * ax.d[1];
    if (t >= -1e-9 && t <= r.info.blockLen + 1e-9) assert.ok(distToAxis(p, ax) >= R - 1e-6, "corp " + i + " intră în gaură"); }));
  /* nimic nu intră în picior (x < 0 și y < 0) sub capăt */
  r.shells.forEach((m, i) => m.v.forEach(p => { if (p[2] < -1e-9) assert.ok(!(p[0] < -1e-6 && p[1] < -1e-6), "corp " + i + " în picior"); }));
  /* capacul stă pe capătul piciorului (z de la 0 în sus) */
  assert.ok(Math.min(...r.shells[0].v.map(p => p[2])) === 0);
  /* bucșa iese în dreptul muchiei: fața blocului din față conține punctul (0, 0, −drop) pe dreapta de intersecție cu axa */
  const front = blk.v.filter(p => Math.abs(distToAxis(p, ax) - R) < 1e-3 && ((p[0] * ax.d[0] + p[1] * ax.d[1]) < 1e-6));
  assert.ok(front.length >= 32);
});
test("colț 45°: erori la picior prea mic sau gaură prea aproape de capăt", () => {
  assert.throws(() => J.cornerJig({ legW: 30, drop: 40, bushOD: 10, bushLen: 15 }), /prea mic/);
  assert.throws(() => J.cornerJig({ legW: 70, drop: 12, bushOD: 10, bushLen: 15 }), /cel puțin/);
});
test("STL binar: număr de triunghiuri, normale unitare, cutie, orientare de printare pe masă", () => {
  for (const r of [J.rowJig({ n: 3, pitch: 32, dist: 37, bushOD: 8, bushLen: 12 }), J.cornerJig({ legW: 70, drop: 40, bushOD: 10, bushLen: 15 })]) {
    const shells = J.printOrient(r.shells), stl = J.toBinaryStl(shells, "test"), dv = new DataView(stl.buffer);
    const nt = shells.reduce((s, m) => s + m.t.length, 0);
    assert.equal(dv.getUint32(80, true), nt); assert.equal(stl.length, 84 + 50 * nt);
    const bb = J.bbox(shells); assert.ok(Math.abs(bb.lo[2]) < 1e-9, "nu stă pe masă");
    for (let k = 0; k < nt; k += Math.max(1, Math.floor(nt / 40))) { const o = 84 + 50 * k; assert.ok(Math.abs(Math.hypot(dv.getFloat32(o, true), dv.getFloat32(o + 4, true), dv.getFloat32(o + 8, true)) - 1) < 1e-4, "normală neunitară"); }
    shells.forEach(m => assert.ok(J.volume(m) > 0 && J.watertight(m)));
  }
});
test("determinism: aceleași date, același STL", () => {
  const a = J.toBinaryStl(J.rowJig({ n: 4, pitch: 32, dist: 37, bushOD: 8, bushLen: 12 }).shells), b = J.toBinaryStl(J.rowJig({ n: 4, pitch: 32, dist: 37, bushOD: 8, bushLen: 12 }).shells);
  assert.deepEqual(Buffer.from(a), Buffer.from(b));
});
