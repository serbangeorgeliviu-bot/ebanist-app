/* Ebanist — șabloane de găurire pentru printare 3D (D-125). Partea PURĂ: fără DOM, fără dependențe; milimetri; întoarce plase de triunghiuri
 * și fișier STL binar. Orice slicer deschide STL-ul.
 *
 * Reguli (cerute de Liviu, 08.11.2026):
 *   - joc 0,2 mm (implicit): locașul bucșei are diametrul bucșei + joc;
 *   - ÎNTOTDEAUNA bucșe metalice de ghidare: șablonul nu ghidează burghiul direct în plastic;
 *   - PETG; funcție Pro.
 *
 * Plasele sunt construite direct, nu prin operații booleene: fiecare placă cu găuri e o extrudare a unui contur cu găuri circulare (fâșii
 * dreptunghiulare, câte una pe gaură, triangulate în coroană în jurul găurii), așa că rezultatul e o plasă etanșă fără biblioteci.
 * Șablonul rând (placă + prag) e UN SINGUR corp etanș. Șablonul de colț la 45° are mai multe corpuri care se suprapun (capac, două praguri, blocul cu
 * bucșă): slicerele le unesc. Nicio componentă nu intră în gaura bucșei (verificat în test/jig.test.js).
 *
 * Plasă: { v: [[x,y,z],…], t: [[i,j,k],…] }, triunghiurile în sens antiorar văzute din exterior (normala spre afară).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EBJig = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var TAU = Math.PI * 2, SQ2 = Math.SQRT2;

  /* ---------------------------------------------------------------- plasă */
  function Mesh() { this.v = []; this.t = []; this._k = {}; }
  Mesh.prototype.V = function (x, y, z) {
    var key = x.toFixed(5) + "," + y.toFixed(5) + "," + z.toFixed(5), i = this._k[key];
    if (i == null) { i = this.v.length; this.v.push([x, y, z]); this._k[key] = i; }
    return i;
  };
  /* triunghi orientat după `hint` (direcția spre exterior a solidului în acel loc) */
  Mesh.prototype.T = function (a, b, c, hint) {
    var A = this.v[a], B = this.v[b], C = this.v[c];
    var ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], wx = C[0] - A[0], wy = C[1] - A[1], wz = C[2] - A[2];
    var nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    if (nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) this.t.push([a, c, b]); else this.t.push([a, b, c]);
  };
  Mesh.prototype.Q = function (a, b, c, d, hint) { this.T(a, b, c, hint); this.T(a, c, d, hint); };

  function circle(cx, cy, r, n) {
    var out = []; for (var i = 0; i < n; i++) { var a = TAU * i / n; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return out;
  }
  /* contur dreptunghiular în sens antiorar, subdivizat: `xs` pe laturile de jos și de sus, `ys` pe cele din dreapta și din stânga (liste crescătoare,
     cu capetele incluse). Subdivizarea ține triunghiurile coroanei în interiorul ei (un vârf exterior prea departe unghiular ar tăia gaura) și e aceeași
     pentru vecini, așa că muchiile comune nu au joncțiuni în T. */
  function rectLoop(xs, ys) {
    var out = [], i, j, Kx = xs.length - 1, Ky = ys.length - 1, x0 = xs[0], x1 = xs[Kx], y0 = ys[0], y1 = ys[Ky];
    for (i = 0; i < Kx; i++) out.push([xs[i], y0]);
    for (j = 0; j < Ky; j++) out.push([x1, ys[j]]);
    for (i = Kx; i > 0; i--) out.push([xs[i], y1]);
    for (j = Ky; j > 0; j--) out.push([x0, ys[j]]);
    return out;
  }
  function lin(a, b, k) { var o = []; for (var i = 0; i <= k; i++) o.push(a + (b - a) * i / k); return o; }
  function kFor(len, r) { return Math.max(8, Math.ceil(len / Math.max(1.5, r * 0.8))); }
  function nSeg(d) { return Math.max(32, Math.min(96, Math.round(d * 5))); }

  /* Coroana dintre un contur interior (cerc) și unul exterior (dreptunghi), ambele stelate față de (cx, cy): două liste de indici, în sens antiorar.
     Mergând după unghi, se leagă mereu vârful cu unghiul următor cel mai mic; închiderea e pe aceeași diagonală cu începutul. */
  function annulus(mesh, cx, cy, inner, outer, hint) {
    function ang(vi) { var p = mesh.v[vi], a = Math.atan2(p[1] - cy, p[0] - cx); return a < 0 ? a + TAU : a; }
    /* fiecare contur pornește de la ULTIMUL vârf cu unghi ≤ 0 (la conturul exterior, de regulă ultimul din listă, cu unghiul − 2π), ca perechea de start
       să fie corectă pentru ambele; unghiurile se desfășoară crescător */
    function prep(idx) {
      var arr = idx.map(function (vi) { return { vi: vi, a: ang(vi) }; }).sort(function (p, q) { return p.a - q.a; });
      var n = arr.length, st = arr[0].a <= 1e-12 ? 0 : n - 1, A = [st === n - 1 && arr[0].a > 1e-12 ? arr[n - 1].a - TAU : arr[st].a], vi = [];
      for (var k = 0; k < n; k++) vi.push(arr[(st + k) % n].vi);
      for (k = 1; k <= n; k++) { var a = arr[(st + k) % n].a; while (a < A[k - 1] - 1e-12) a += TAU; A.push(a); }
      return { vi: vi, A: A, n: n };
    }
    var I = prep(inner), O = prep(outer), i = 0, j = 0;
    while (i < I.n || j < O.n) {
      var ai = i < I.n ? I.A[i + 1] : Infinity, ao = j < O.n ? O.A[j + 1] : Infinity;
      if (ai <= ao) { mesh.T(I.vi[i % I.n], I.vi[(i + 1) % I.n], O.vi[j % O.n], hint); i++; }
      else { mesh.T(O.vi[j % O.n], O.vi[(j + 1) % O.n], I.vi[i % I.n], hint); j++; }
    }
  }

  /* ------------------------------------------------------------ utilitare */
  function volume(m) {
    var s = 0;
    m.t.forEach(function (t) {
      var a = m.v[t[0]], b = m.v[t[1]], c = m.v[t[2]];
      s += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    });
    return s;
  }
  /* etanș și orientat consecvent: fiecare muchie orientată apare o singură dată, cu perechea ei inversă o singură dată */
  function watertight(m) {
    var cnt = {}, ok = true;
    m.t.forEach(function (t) { for (var k = 0; k < 3; k++) { var a = t[k], b = t[(k + 1) % 3], key = a + ">" + b; cnt[key] = (cnt[key] || 0) + 1; } });
    Object.keys(cnt).forEach(function (key) {
      var p = key.split(">"); if (cnt[key] !== 1 || cnt[p[1] + ">" + p[0]] !== 1) ok = false;
    });
    return ok;
  }
  function bbox(shells) {
    var lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    shells.forEach(function (m) { m.v.forEach(function (p) { for (var a = 0; a < 3; a++) { if (p[a] < lo[a]) lo[a] = p[a]; if (p[a] > hi[a]) hi[a] = p[a]; } }); });
    return { lo: lo, hi: hi, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] };
  }
  function transform(m, f) { var o = new Mesh(); o.v = m.v.map(f); o.t = m.t.map(function (t) { return t.slice(); }); return o; }
  /* orientare de printare: rotire 180° în jurul lui x (x, -y, -z), apoi se pune cea mai joasă față pe masă (z = 0) și se centrează în x, y */
  function printOrient(shells) {
    var rot = shells.map(function (m) { return transform(m, function (p) { return [p[0], -p[1], -p[2]]; }); });
    var b = bbox(rot), dx = -(b.lo[0] + b.hi[0]) / 2, dy = -(b.lo[1] + b.hi[1]) / 2, dz = -b.lo[2];
    return rot.map(function (m) { return transform(m, function (p) { return [p[0] + dx, p[1] + dy, p[2] + dz]; }); });
  }
  function boxMesh(lo, hi) {
    var m = new Mesh(), P = function (x, y, z) { return m.V(x, y, z); };
    var a = P(lo[0], lo[1], lo[2]), b = P(hi[0], lo[1], lo[2]), c = P(hi[0], hi[1], lo[2]), d = P(lo[0], hi[1], lo[2]);
    var e = P(lo[0], lo[1], hi[2]), f = P(hi[0], lo[1], hi[2]), g = P(hi[0], hi[1], hi[2]), h = P(lo[0], hi[1], hi[2]);
    m.Q(a, d, c, b, [0, 0, -1]); m.Q(e, f, g, h, [0, 0, 1]); m.Q(a, b, f, e, [0, -1, 0]); m.Q(d, h, g, c, [0, 1, 0]);
    m.Q(a, e, h, d, [-1, 0, 0]); m.Q(b, c, g, f, [1, 0, 0]);
    return m;
  }

  /* ---------------------------------------------------- bloc cu o gaură */
  /* Extrudare pe z (de la 0 la len) a unui dreptunghi w × h centrat în origine, cu o gaură circulară de diametru `dia` pe axă. */
  function holeBlock(w, h, len, dia) {
    var m = new Mesh(), n = nSeg(dia), r = dia / 2, W = w / 2, H = h / 2;
    var loop = rectLoop(lin(-W, W, kFor(w, r)), lin(-H, H, kFor(h, r)));
    [0, len].forEach(function (z, zi) {
      var ring = circle(0, 0, r, n).map(function (p) { return m.V(p[0], p[1], z); });
      annulus(m, 0, 0, ring, loop.map(function (p) { return m.V(p[0], p[1], z); }), [0, 0, zi ? 1 : -1]);
    });
    for (var i = 0; i < loop.length; i++) {
      var p = loop[i], q = loop[(i + 1) % loop.length];
      m.Q(m.V(p[0], p[1], 0), m.V(q[0], q[1], 0), m.V(q[0], q[1], len), m.V(p[0], p[1], len), [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, 0]);
    }
    var c = circle(0, 0, r, n);
    for (var k = 0; k < n; k++) {
      var a = c[k], b = c[(k + 1) % n];
      m.Q(m.V(a[0], a[1], 0), m.V(b[0], b[1], 0), m.V(b[0], b[1], len), m.V(a[0], a[1], len), [-(a[0] + b[0]) / 2, -(a[1] + b[1]) / 2, 0]);
    }
    return m;
  }

  /* ------------------------------------------------ șablon: rând de găuri */
  /* Placă pe fața panoului, cu un prag care se agață pe muchia lui; n găuri pentru bucșe, la `dist` de muchie, la `pitch` una de alta.
     Un singur corp etanș. Sistemul de coordonate: y = 0 la exteriorul pragului; fața pragului dinspre panou e y = f (planul muchiei panoului);
     placa stă la z ∈ [0, T], pragul coboară la z ∈ [−F, 0]; panoul e la y > f, z < 0. */
  function rowJig(o) {
    var n = Math.max(1, Math.round(o.n)), pitch = o.pitch, dist = o.dist, bushOD = o.bushOD, bushLen = o.bushLen, clear = o.clear == null ? 0.2 : o.clear;
    var seat = bushOD + clear, R = seat / 2, T = bushLen, F = o.hook || 12, f = o.fence || 8, margin = Math.max(R + 5, 9);
    if (n > 1 && pitch < seat + 4) throw new Error("jig: pasul (" + pitch + " mm) e prea mic pentru bucșe de Ø" + bushOD + " mm");
    var yh = f + dist, W = yh + R + 6, xs = []; for (var k = 0; k < n; k++) xs.push(k * pitch);
    var b = [xs[0] - margin]; for (k = 1; k < n; k++) b.push((xs[k - 1] + xs[k]) / 2); b.push(xs[n - 1] + margin);
    var m = new Mesh(), V = function (x, y, z) { return m.V(x, y, z); }, ns = nSeg(seat), Ky = kFor(W, R);
    var YT = lin(0, W, Ky), YB = lin(f, W, Ky);              // puncte pe muchiile laterale ale fețelor de sus și de jos (aceleași la toți vecinii)
    var XS = [];
    for (k = 0; k < n; k++) {
      var x0 = b[k], x1 = b[k + 1], X = lin(x0, x1, kFor(x1 - x0, R)); XS.push(X);
      var c = circle(xs[k], yh, R, ns);
      /* fața de sus (z = T) și fața de jos a plăcii (z = 0, de la prag în spate), fiecare cu gaura ei în coroană */
      annulus(m, xs[k], yh, c.map(function (p) { return V(p[0], p[1], T); }), rectLoop(X, YT).map(function (p) { return V(p[0], p[1], T); }), [0, 0, 1]);
      annulus(m, xs[k], yh, c.map(function (p) { return V(p[0], p[1], 0); }), rectLoop(X, YB).map(function (p) { return V(p[0], p[1], 0); }), [0, 0, -1]);
      for (var i = 0; i < ns; i++) {
        var p = c[i], q = c[(i + 1) % ns];
        m.Q(V(p[0], p[1], 0), V(q[0], q[1], 0), V(q[0], q[1], T), V(p[0], p[1], T), [xs[k] - (p[0] + q[0]) / 2, yh - (p[1] + q[1]) / 2, 0]);
      }
      for (i = 0; i < X.length - 1; i++) {
        var xa = X[i], xb = X[i + 1];
        m.Q(V(xa, 0, -F), V(xb, 0, -F), V(xb, 0, 0), V(xa, 0, 0), [0, -1, 0]);          // peretele din față, sub planul plăcii (pragul)
        m.Q(V(xa, 0, 0), V(xb, 0, 0), V(xb, 0, T), V(xa, 0, T), [0, -1, 0]);            // peretele din față, placa
        m.Q(V(xa, 0, -F), V(xb, 0, -F), V(xb, f, -F), V(xa, f, -F), [0, 0, -1]);        // fața de jos a pragului
        m.Q(V(xa, f, -F), V(xb, f, -F), V(xb, f, 0), V(xa, f, 0), [0, 1, 0]);           // fața pragului dinspre panou
        m.Q(V(xa, W, 0), V(xb, W, 0), V(xb, W, T), V(xa, W, T), [0, 1, 0]);             // peretele din spate
      }
    }
    /* capetele: pragul (dreptunghi) și placa (dreptunghi între două linii frânte, legate în ordinea coordonatei y) */
    [[b[0], -1], [b[n], 1]].forEach(function (e) {
      var x = e[0], h = [e[1], 0, 0];
      m.T(V(x, 0, -F), V(x, f, -F), V(x, f, 0), h); m.T(V(x, 0, -F), V(x, f, 0), V(x, 0, 0), h);
      var low = [[0, 0]].concat(YB.map(function (y) { return [y, 0]; })), up = YT.map(function (y) { return [y, T]; }), i = 0, j = 0;
      while (i < low.length - 1 || j < up.length - 1) {
        var nl = i < low.length - 1 ? low[i + 1][0] : Infinity, nu = j < up.length - 1 ? up[j + 1][0] : Infinity;
        if (nl <= nu) { m.T(V(x, low[i][0], low[i][1]), V(x, low[i + 1][0], low[i + 1][1]), V(x, up[j][0], up[j][1]), h); i++; }
        else { m.T(V(x, low[i][0], low[i][1]), V(x, up[j + 1][0], up[j + 1][1]), V(x, up[j][0], up[j][1]), h); j++; }
      }
    });
    var bore = xs.map(function (x) { return { x: x, y: yh, r: R }; });
    return { shells: [m], info: { kind: "row", seat: seat, bushOD: bushOD, bushLen: bushLen, plate: T, fence: f, hook: F, holeDist: dist, pitch: pitch, n: n, bores: bore, panelEdgeY: f } };
  }

  /* ------------------------------------------- șablon: colț de picior, 45° */
  /* Muchia convexă a piciorului e dreapta x = y = 0 (verticală); piciorul ocupă x ≤ 0, y ≤ 0, iar capătul de sus al piciorului e planul z = 0
     (piciorul coboară la z < 0). Șurubul dublu intră pe DIAGONALA colțului (direcția (−1, −1)/√2), la `drop` mm sub capăt.
     Corpuri (se suprapun, slicerele le unesc): capacul (stă pe capătul piciorului), două praguri pe fețele piciorului, retrase de la muchie ca să
     nu intre în gaură, și blocul cu bucșă, aliniat cu diagonala, cu fața din față în dreptul muchiei. */
  function cornerJig(o) {
    var legW = o.legW, drop = o.drop, bushOD = o.bushOD, bushLen = o.bushLen, clear = o.clear == null ? 0.2 : o.clear;
    var seat = bushOD + clear, R = seat / 2, wall = 5, We = Math.max(24, bushOD + 10), Hb = We, Ls = bushLen;
    var fw = 14, tp = 5, g = R / SQ2 + 1.5, Lf = Math.min(45, legW - 5), Lc = Math.min(30, legW - 5);
    if (legW < 40) throw new Error("jig: piciorul e prea mic pentru șablon (minim 40 mm)");
    if (drop < Hb / 2 + 8) throw new Error("jig: gaura trebuie să fie la cel puțin " + Math.ceil(Hb / 2 + 8) + " mm de capătul piciorului");
    var zc = -drop;
    /* bloc: (px, py, pz) -> s = pz, u = px, v = py; apoi x = (s − u)/√2, y = (s + u)/√2, z = zc + v */
    var blk = holeBlock(We, Hb, Ls, seat);
    blk = transform(blk, function (p) { var s = p[2], u = p[0], v = p[1]; return [(s - u) / SQ2, (s + u) / SQ2, zc + v]; });
    var zb = -(drop + Hb / 2 + 3), zt = tp / 2;
    var fenceA = boxMesh([0, -Lf, zb], [fw, -g, zt]), fenceB = boxMesh([-Lf, 0, zb], [-g, fw, zt]);
    var cap = boxMesh([-Lc, -Lc, 0], [fw, fw, tp]);
    var axis = { p: [0, 0, zc], d: [SQ2 / 2, SQ2 / 2, 0] };
    return { shells: [cap, fenceA, fenceB, blk], info: { kind: "corner", seat: seat, bushOD: bushOD, bushLen: bushLen, drop: drop, legW: legW, axis: axis, R: R, blockLen: Ls } };
  }

  /* --------------------------------------------------------------- STL */
  /* STL binar: 80 de octeți de antet, numărul de triunghiuri, apoi pentru fiecare normala și trei vârfuri (float32) */
  function toBinaryStl(shells, name) {
    var tris = []; shells.forEach(function (m) { m.t.forEach(function (t) { tris.push([m.v[t[0]], m.v[t[1]], m.v[t[2]]]); }); });
    var buf = new ArrayBuffer(84 + tris.length * 50), dv = new DataView(buf), head = ("Ebanist jig " + (name || "")).slice(0, 79);
    for (var i = 0; i < head.length; i++) dv.setUint8(i, head.charCodeAt(i) & 127);
    dv.setUint32(80, tris.length, true);
    tris.forEach(function (T, k) {
      var A = T[0], B = T[1], C = T[2], ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], wx = C[0] - A[0], wy = C[1] - A[1], wz = C[2] - A[2];
      var nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, l = Math.hypot(nx, ny, nz) || 1, off = 84 + k * 50;
      [nx / l, ny / l, nz / l].concat(A, B, C).forEach(function (v, j) { dv.setFloat32(off + j * 4, v, true); });
      dv.setUint16(off + 48, 0, true);
    });
    return new Uint8Array(buf);
  }

  /* date implicite ale bucșelor de ghidare (standard, de comandat): diametrul interior al bucșei = diametrul burghiului */
  var BUSH = {
    4:  { id: 4,  od: 7,  len: 12 },
    5:  { id: 5,  od: 8,  len: 12 },
    6:  { id: 6,  od: 10, len: 15 },
    8:  { id: 8,  od: 12, len: 15 },
    10: { id: 10, od: 15, len: 20 }
  };

  return { rowJig: rowJig, cornerJig: cornerJig, toBinaryStl: toBinaryStl, printOrient: printOrient, volume: volume, watertight: watertight, bbox: bbox, BUSH: BUSH,
           _holeBlock: holeBlock, _boxMesh: boxMesh, _transform: transform };
});
