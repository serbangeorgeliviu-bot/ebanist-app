/* Ebanist — D-86: prisma cu profil în plan vertical (panouri sub o pantă).
 *   node --test test/vprism.test.mjs
 * Fețele trebuie să privească în afară, indiferent de sensul în care vin vârfurile, iar cutia de
 * gabarit a geometriei trebuie să fie cea a profilului extrudat. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVPrism, MM } from "../app/geo3d.js";

function check(vp, e0, e1, box) {
  const g = buildVPrism(vp, e0, e1), pos = g.getAttribute("position").array;
  assert.equal(pos.length / 9, 2 * (vp.pts.length - 2) + 2 * vp.pts.length, "numărul de triunghiuri");
  const c = [0, 1, 2].map(k => { let s = 0; for (let i = k; i < pos.length; i += 3) s += pos[i]; return s / (pos.length / 3); });
  for (let i = 0; i < pos.length; i += 9) {
    const a = [pos[i], pos[i + 1], pos[i + 2]], b = [pos[i + 3], pos[i + 4], pos[i + 5]], d = [pos[i + 6], pos[i + 7], pos[i + 8]];
    const ab = b.map((v, k) => v - a[k]), ad = d.map((v, k) => v - a[k]);
    const n = [ab[1] * ad[2] - ab[2] * ad[1], ab[2] * ad[0] - ab[0] * ad[2], ab[0] * ad[1] - ab[1] * ad[0]];
    const m = [0, 1, 2].map(k => (a[k] + b[k] + d[k]) / 3 - c[k]);
    assert.ok(n[0] * m[0] + n[1] * m[1] + n[2] * m[2] > 0, "fața " + i / 9 + " privește spre interior");
  }
  g.computeBoundingBox();
  const bb = g.boundingBox;
  [bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z].forEach((v, k) => assert.ok(Math.abs(v - box[k] * MM) < 1e-5, "gabarit " + k));
}

test("trapez în planul z–y, extrudat pe x (lateralele axis z)", () => {
  check({ ax: "z", pts: [[0, 0], [560, 0], [560, 2200], [0, 1500]] }, 0, 19, [0, 0, 0, 19, 2200, 560]);
});
test("același trapez cu vârfurile în sens invers", () => {
  check({ ax: "z", pts: [[0, 1500], [560, 2200], [560, 0], [0, 0]] }, 0, 19, [0, 0, 0, 19, 2200, 560]);
});
test("paralelogram în planul x–y, extrudat pe z (tavanul înclinat axis x)", () => {
  check({ ax: "x", pts: [[19, 2200], [1181, 1600], [1181, 1578.6], [19, 2178.6]] }, 19, 560, [19, 1578.6, 19, 1181, 2200, 560]);
});
test("profil în jurul originii (cum îl construiește viewer-ul)", () => {
  check({ ax: "x", pts: [[-10, -5], [10, -5], [10, 8], [-10, 3]] }, -4, 4, [-10, -5, -4, 10, 8, 4]);
});
