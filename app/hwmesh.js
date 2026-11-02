/* Ebanist — geometrii pentru feronerie realistă (muchii rotunjite, teșituri, profile rotite).
 *
 * Doar geometrie, fără materiale și fără scenă: viewer3d.js le pune în mesh-uri. Totul în unități de
 * scenă (metri), dimensiunile primite în mm. Geometriile se țin într-un cache pe cheie, ca zecile de
 * șuruburi și cleme identice să partajeze aceleași vârfuri; clearGroup() le eliberează din GPU când
 * mesh-ul e `own`, iar three le reîncarcă singur dacă mai sunt folosite.
 *
 * Bugetul de triunghiuri e verificat în test/hwmesh.test.js.
 */
import { THREE, MM } from "./geo3d.js";

const CACHE = new Map(), MAX = 900;
function memo(key, make) {
  let g = CACHE.get(key);
  if (!g) { g = make(); if (CACHE.size >= MAX) CACHE.delete(CACHE.keys().next().value); CACHE.set(key, g); }
  return g;
}
const f = v => Math.round(v * 100) / 100;

/* Cutie cu muchii rotunjite (r în mm). seg = 1 → o singură fațetă pe muchie (48 de triunghiuri),
   seg = 2 → rotunjire în două trepte (192). Normalele netede dau lumina de pe muchie. */
export function rboxGeom(sx, sy, sz, r, seg = 1) {
  sx = Math.max(sx, 0.2); sy = Math.max(sy, 0.2); sz = Math.max(sz, 0.2);
  r = Math.max(0, Math.min(r, sx * 0.49, sy * 0.49, sz * 0.49));
  return memo(["rb", f(sx), f(sy), f(sz), f(r), seg].join("|"), () => {
    if (r < 0.04) return new THREE.BoxGeometry(sx * MM, sy * MM, sz * MM);
    const n = seg * 2 + 1, half = 0.5 / n;
    const g = new THREE.BoxGeometry(1, 1, 1, n, n, n).toNonIndexed();
    const pos = g.attributes.position, nor = g.attributes.normal;
    const inner = new THREE.Vector3(sx / 2 - r, sy / 2 - r, sz / 2 - r), v = new THREE.Vector3(), q = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      q.copy(v); q.x -= Math.sign(q.x) * half; q.y -= Math.sign(q.y) * half; q.z -= Math.sign(q.z) * half; q.normalize();
      pos.setXYZ(i, (inner.x * Math.sign(v.x) + q.x * r) * MM, (inner.y * Math.sign(v.y) + q.y * r) * MM, (inner.z * Math.sign(v.z) + q.z * r) * MM);
      nor.setXYZ(i, q.x, q.y, q.z);
    }
    return g;
  });
}

/* Profil rotit în jurul axei Y: puncte [raza, y] în mm, y de la 0. Geometria rămâne cu y de la 0 la lungime,
   ca mesh-ul să se poată pune cu originea la capătul `a` al piesei. */
export function latheGeom(profile, seg = 20) {
  return memo(["lt", seg, profile.map(p => f(p[0]) + "," + f(p[1])).join(";")].join("|"), () =>
    new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(Math.max(p[0], 0) * MM, p[1] * MM)), seg));
}

/* Cilindru cu capete teșite, de la y=0 la y=len. */
export function cylGeom(len, dia, ch = 0, seg = 20) {
  const r = dia / 2, c = Math.max(0, Math.min(ch, r * 0.45, len * 0.3));
  const prof = c < 0.04 ? [[0, 0], [r, 0], [r, len], [0, len]] : [[0, 0], [r - c, 0], [r, c], [r, len - c], [r - c, len], [0, len]];
  return latheGeom(prof, seg);
}

/* Număr de triunghiuri al unei geometrii (pentru buget). */
export function triCount(g) { return g.index ? g.index.count / 3 : g.attributes.position.count / 3; }
export function cacheSize() { return CACHE.size; }
