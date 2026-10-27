/* =====================================================================
   Ebanist — piesa cu contur liber (partea pură, fără DOM; testată în
   test/contour.test.js).

   Un contur = listă de vârfuri [x, y, bulge], închis (ultimul vârf se leagă de
   primul). `bulge` e ca în DXF (LWPOLYLINE): 0 = segment drept, altfel arc de
   cerc între vârful i și i+1, cu unghiul cuprins 4·atan(bulge) (pozitiv =
   în sens antiorar). Arcele rămân arce exacte (mașina primește G2/G3, nu mii
   de segmente); numai ce nu e cerc se aproximează cu segmente drepte.
   Unitatea e mm; y în sus. Toleranța de aplatizare 0,1 mm.
   ===================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EBContour = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var TOL = 0.1, EPS = 1e-9;

  /* ---------- aritmetică de arc ---------- */
  function arcOf(p, q) {                       // arc între vârfurile p și q (cu p[2] = bulge), sau null dacă e drept
    var b = +p[2] || 0; if (Math.abs(b) < 1e-12) return null;
    var dx = q[0] - p[0], dy = q[1] - p[1], c = Math.hypot(dx, dy); if (c < EPS) return null;
    var th = 4 * Math.atan(b), r = c / (2 * Math.sin(th / 2));    // r poate fi negativ (bulge negativ): îl luăm în modul
    var rr = Math.abs(r), mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    var h = Math.sqrt(Math.max(0, rr * rr - c * c / 4)), nx = -dy / c, ny = dx / c;   // normala spre stânga coardei
    var sgn = (Math.abs(th) > Math.PI ? -1 : 1) * (b > 0 ? 1 : -1);                    // centrul față de coardă
    var cx = mx + nx * h * sgn, cy = my + ny * h * sgn;
    var a0 = Math.atan2(p[1] - cy, p[0] - cx);
    return { cx: cx, cy: cy, r: rr, a0: a0, sweep: th, len: rr * Math.abs(th) };
  }
  function arcPoint(A, t) { var a = A.a0 + A.sweep * t; return [A.cx + A.r * Math.cos(a), A.cy + A.r * Math.sin(a)]; }

  /* aplatizare: arcul în segmente cu săgeata ≤ tol */
  function flatten(pts, tol) {
    tol = tol || TOL;
    var out = [], n = pts.length;
    for (var i = 0; i < n; i++) {
      var p = pts[i], q = pts[(i + 1) % n], A = arcOf(p, q);
      out.push([p[0], p[1]]);
      if (A) {
        var da = Math.acos(Math.max(-1, Math.min(1, 1 - tol / A.r))) * 2 || 0.5;      // unghiul unui segment pentru săgeata tol
        var k = Math.max(2, Math.ceil(Math.abs(A.sweep) / Math.max(da, 1e-3))), ts = [], j;
        for (j = 1; j < k; j++) ts.push(j / k);
        /* extremele cercului (0°, 90°, 180°, 270°) care cad în arc intră mereu în poligon: gabaritul aplatizat = gabaritul exact */
        for (var q = 0; q < 4; q++) {
          var d = (q * Math.PI / 2 - A.a0) * (A.sweep > 0 ? 1 : -1); d = ((d % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
          var tt = d / Math.abs(A.sweep); if (tt > 1e-6 && tt < 1 - 1e-6) ts.push(tt);
        }
        ts.sort(function (a1, b1) { return a1 - b1; });
        for (j = 0; j < ts.length; j++) if (j === 0 || ts[j] - ts[j - 1] > 1e-6) out.push(arcPoint(A, ts[j]));
      }
    }
    return out;
  }

  function polyArea(P) {                       // cu semn (pozitiv = antiorar)
    var s = 0; for (var i = 0; i < P.length; i++) { var a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; }
    return s / 2;
  }
  /* aria exactă: poligonul vârfurilor + segmentele circulare ale arcelor */
  function area(pts) {
    var s = polyArea(pts.map(function (p) { return [p[0], p[1]]; })), n = pts.length;
    for (var i = 0; i < n; i++) {
      var A = arcOf(pts[i], pts[(i + 1) % n]); if (!A) continue;
      var seg = A.r * A.r / 2 * (Math.abs(A.sweep) - Math.sin(Math.abs(A.sweep)));  // aria segmentului circular
      s += (A.sweep > 0 ? 1 : -1) * seg;
    }
    return s;
  }
  function perimeter(pts) {
    var s = 0, n = pts.length;
    for (var i = 0; i < n; i++) { var p = pts[i], q = pts[(i + 1) % n], A = arcOf(p, q); s += A ? A.len : Math.hypot(q[0] - p[0], q[1] - p[1]); }
    return s;
  }
  function bbox(pts) {
    var x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18, n = pts.length;
    function add(x, y) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (var i = 0; i < n; i++) {
      var p = pts[i], q = pts[(i + 1) % n]; add(p[0], p[1]);
      var A = arcOf(p, q); if (!A) continue;
      for (var k = 0; k < 4; k++) {                    // extremele cercului care cad în arc: unghiurile 0, 90, 180, 270
        var ang = k * Math.PI / 2, d = (ang - A.a0) * (A.sweep > 0 ? 1 : -1);
        d = ((d % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        if (d <= Math.abs(A.sweep) + 1e-12) add(A.cx + A.r * Math.cos(ang), A.cy + A.r * Math.sin(ang));
      }
    }
    return { x0: x0, y0: y0, x1: x1, y1: y1, w: x1 - x0, h: y1 - y0 };
  }

  /* ---------- verificări ---------- */
  function segInter(a, b, c, d) {              // intersecție proprie (fără capete comune)
    function o(p, q, r) { return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); }
    var o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
    return ((o1 > EPS && o2 < -EPS) || (o1 < -EPS && o2 > EPS)) && ((o3 > EPS && o4 < -EPS) || (o3 < -EPS && o4 > EPS));
  }
  function isSimple(P) {                       // fără autointersecții
    var n = P.length;
    for (var i = 0; i < n; i++) for (var j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segInter(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n])) return false;
    }
    return true;
  }

  /* cel puțin trei vârfuri, sau două cu arce (un cerc = două semicercuri) */
  function enough(pts) { return pts.length >= 3 || (pts.length === 2 && pts.some(function (p) { return Math.abs(+p[2] || 0) > 1e-9; })); }

  /* ---------- curățare și normalizare ---------- */
  function clean(pts) {
    var out = [];
    pts.forEach(function (p) {
      var q = [+p[0], +p[1], +p[2] || 0], l = out[out.length - 1];
      if (!isFinite(q[0]) || !isFinite(q[1])) return;
      if (l && Math.hypot(q[0] - l[0], q[1] - l[1]) < 0.005) { if (Math.abs(q[2]) > Math.abs(l[2])) l[2] = q[2]; return; }
      out.push(q);
    });
    if (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 0.005) out.pop();
    return out;
  }
  /* mută în (0,0), orientează antiorar (întoarce semnul bulge-ului la inversare), verifică */
  function normalize(raw) {
    var pts = clean(raw || []);
    if (!enough(pts)) return { ok: false, reason: "few" };
    var P = flatten(pts);
    if (!isSimple(P)) return { ok: false, reason: "self" };
    if (Math.abs(polyArea(P)) < 1) return { ok: false, reason: "area" };
    if (area(pts) < 0) {                       // inversează sensul: vârfurile în ordine inversă, bulge mutat pe segmentul vecin cu semn schimbat
      var n = pts.length, rev = [];
      for (var i = n - 1; i >= 0; i--) { var prev = pts[(i - 1 + n) % n]; rev.push([pts[i][0], pts[i][1], -(+prev[2] || 0)]); }
      pts = rev;
    }
    var bb = bbox(pts);
    pts = pts.map(function (p) { return [round6(p[0] - bb.x0), round6(p[1] - bb.y0), p[2]]; });
    if (pts.length > 2000) return { ok: false, reason: "many" };
    var fb = bbox(pts);
    return { ok: true, pts: pts, w: fb.w, h: fb.h, area: area(pts), perim: perimeter(pts) };
  }
  function round6(v) { return Math.round(v * 1e6) / 1e6; }
  function scale(pts, k) { return pts.map(function (p) { return [p[0] * k, p[1] * k, p[2] || 0]; }); }   // scală uniformă: arcele rămân arce

  /* ---------- triangulare (ear clipping) pe poligonul aplatizat, simplu, orice formă ---------- */
  function triangulate(P) {
    var n = P.length, idx = [], tri = [], i;
    for (i = 0; i < n; i++) idx.push(i);
    if (polyArea(P) < 0) idx.reverse();
    function cross(a, b, c) { return (P[b][0] - P[a][0]) * (P[c][1] - P[a][1]) - (P[b][1] - P[a][1]) * (P[c][0] - P[a][0]); }
    function inTri(v, a, b, c) { return cross(a, b, v) >= -EPS && cross(b, c, v) >= -EPS && cross(c, a, v) >= -EPS; }
    var guard = 0;
    while (idx.length > 3 && guard++ < 100000) {
      var found = false, m = idx.length;
      for (i = 0; i < m; i++) {
        var a = idx[(i + m - 1) % m], b = idx[i], c = idx[(i + 1) % m];
        if (cross(a, b, c) <= 1e-12) continue;                           // vârf concav sau coliniar
        var ok = true;
        for (var k = 0; k < m; k++) { var v = idx[k]; if (v === a || v === b || v === c) continue; if (inTri(v, a, b, c)) { ok = false; break; } }
        if (!ok) continue;
        tri.push([a, b, c]); idx.splice(i, 1); found = true; break;
      }
      if (!found) {                                                      // coliniare: elimină un vârf plat și continuă
        var rem = -1; for (i = 0; i < idx.length; i++) { var q0 = idx[(i + idx.length - 1) % idx.length], q1 = idx[i], q2 = idx[(i + 1) % idx.length]; if (Math.abs(cross(q0, q1, q2)) <= 1e-12) { rem = i; break; } }
        if (rem < 0) return null;
        idx.splice(rem, 1);
      }
    }
    if (idx.length === 3 && Math.abs(cross(idx[0], idx[1], idx[2])) > 1e-12) tri.push([idx[0], idx[1], idx[2]]);
    return tri;
  }

  /* ---------- forme gata (exacte, cu arce) ---------- */
  var SHAPES = ["rect", "round", "arch", "scoop"];
  /* W × H, `r` = raza colțurilor (round), `rise` = săgeata arcului (arch: bombat sus; scoop: scobit jos) */
  function shape(kind, W, H, opt) {
    W = +W; H = +H; opt = opt || {};
    if (!(W > 0 && H > 0)) return null;
    if (kind === "rect") return [[0, 0, 0], [W, 0, 0], [W, H, 0], [0, H, 0]];
    if (kind === "round") {
      var r = Math.max(0, Math.min(+opt.r || 0, W / 2, H / 2)); if (!(r > 0)) return [[0, 0, 0], [W, 0, 0], [W, H, 0], [0, H, 0]];
      var b = Math.tan(Math.PI / 8);                     // sfert de cerc: bulge = tan(θ/4), θ = 90°
      return [[r, 0, 0], [W - r, 0, b], [W, r, 0], [W, H - r, b], [W - r, H, 0], [r, H, b], [0, H - r, 0], [0, r, b]];
    }
    var rs = Math.max(0, Math.min(+opt.rise || 0, H - 1, W / 2));          /* cel mult un semicerc: peste, arcul iese în afara laturilor */
    if (kind === "arch") {                               // dreptunghi cu partea de sus bombată: săgeată rs, corpul H−rs
      if (!(rs > 0)) return [[0, 0, 0], [W, 0, 0], [W, H, 0], [0, H, 0]];
      var bb = bulgeFor(W, rs);
      return [[0, 0, 0], [W, 0, 0], [W, H - rs, bb], [0, H - rs, 0]];
    }
    if (kind === "scoop") {                              // dreptunghi cu partea de jos scobită (arc spre interior): ca bufetul cu picioare arcuite
      if (!(rs > 0)) return [[0, 0, 0], [W, 0, 0], [W, H, 0], [0, H, 0]];
      var bs = -bulgeFor(W, rs);
      return [[0, 0, bs], [W, 0, 0], [W, H, 0], [0, H, 0]];
    }
    return null;
  }
  /* bulge pentru un arc cu coarda c și săgeata s: tan(θ/4), cu tan(θ/2)=... → b = 2s/c */
  function bulgeFor(c, s) { return 2 * s / c; }

  /* ---------- import: puncte "x,y x,y …" ---------- */
  function fromPoints(text) {
    var nums = String(text || "").replace(/[;\n\r\t]+/g, " ").trim().split(/\s+/).filter(Boolean), pts = [];
    for (var i = 0; i < nums.length; i++) {
      var xy = nums[i].split(",");                      // „x,y” sau „x,y,bulge”; zecimalele cu punct
      if (xy.length !== 2 && xy.length !== 3) return { ok: false, reason: "points" };
      var x = parseFloat(xy[0]), y = parseFloat(xy[1]), b = xy.length === 3 ? parseFloat(xy[2]) : 0;
      if (!isFinite(x) || !isFinite(y) || !isFinite(b)) return { ok: false, reason: "points" };
      pts.push([x, y, b]);
    }
    return pts.length >= 3 ? { ok: true, pts: pts } : { ok: false, reason: "few" };
  }

  /* ---------- import: calea unui SVG (d="…"), primul subtraseu ----------
     M L H V Z (relative și absolute), A (cerc exact; elipsă aproximată), C și Q (aplatizate la 48 de segmente). y SVG se întoarce (în sus). */
  function tokens(d) { var re = /([MmLlHhVvAaCcQqZzSsTt])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/gi, o = [], m; while ((m = re.exec(d))) o.push(m[1] ? m[1] : parseFloat(m[2])); return o; }
  function fromPath(d) {
    var t = tokens(String(d || "")), i = 0, cmd = null, x = 0, y = 0, sx = 0, sy = 0, pts = [], started = false, closed = false;
    function num() { var v = t[i++]; if (typeof v !== "number") throw new Error("path"); return v; }
    function flag() { return num() ? 1 : 0; }
    function push(px, py, b) { pts.push([px, -py, b || 0]); }
    try {
      while (i < t.length) {
        if (typeof t[i] === "string") cmd = t[i++];
        else if (!cmd) return { ok: false, reason: "path" };
        var rel = cmd === cmd.toLowerCase() && cmd !== "Z" && cmd !== "z", C = cmd.toUpperCase();
        if (C === "Z") { closed = true; x = sx; y = sy; if (i < t.length) return { ok: false, reason: "multi" }; break; }
        if (C === "M") { var mx = num(), my = num(); if (started) return { ok: false, reason: "multi" }; x = rel && pts.length ? x + mx : mx; y = rel && pts.length ? y + my : my; sx = x; sy = y; push(x, y); started = true; cmd = rel ? "l" : "L"; continue; }
        if (!started) return { ok: false, reason: "path" };
        if (C === "L") { var lx = num(), ly = num(); x = rel ? x + lx : lx; y = rel ? y + ly : ly; push(x, y); }
        else if (C === "H") { var hx = num(); x = rel ? x + hx : hx; push(x, y); }
        else if (C === "V") { var vy = num(); y = rel ? y + vy : vy; push(x, y); }
        else if (C === "A") {
          var rx = Math.abs(num()), ry = Math.abs(num()), rot = num(), large = flag(), sweep = flag(), ex = num(), ey = num();
          if (rel) { ex += x; ey += y; }
          var r = arcSvg(x, y, rx, ry, rot, large, sweep, ex, ey);
          if (r.type === "bulge") pts[pts.length - 1][2] = r.bulge;                  // arcul pornește din ultimul vârf
          else if (r.type === "poly") r.pts.forEach(function (q) { push(q[0], q[1]); });
          x = ex; y = ey; push(x, y);
        }
        else if (C === "C") {
          var a1 = num(), b1 = num(), a2 = num(), b2 = num(), a3 = num(), b3 = num();
          if (rel) { a1 += x; b1 += y; a2 += x; b2 += y; a3 += x; b3 += y; }
          for (var k = 1; k <= 48; k++) { var u = k / 48, w = 1 - u; push(w * w * w * x + 3 * w * w * u * a1 + 3 * w * u * u * a2 + u * u * u * a3, w * w * w * y + 3 * w * w * u * b1 + 3 * w * u * u * b2 + u * u * u * b3); }
          x = a3; y = b3;
        }
        else if (C === "Q") {
          var q1 = num(), r1 = num(), q2 = num(), r2 = num();
          if (rel) { q1 += x; r1 += y; q2 += x; r2 += y; }
          for (var k2 = 1; k2 <= 48; k2++) { var u2 = k2 / 48, w2 = 1 - u2; push(w2 * w2 * x + 2 * w2 * u2 * q1 + u2 * u2 * q2, w2 * w2 * y + 2 * w2 * u2 * r1 + u2 * u2 * r2); }
          x = q2; y = r2;
        }
        else return { ok: false, reason: "cmd" };
      }
    } catch (e) { return { ok: false, reason: "path" }; }
    if (!closed && !(pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.005)) return { ok: false, reason: "open" };
    return enough(pts) ? { ok: true, pts: pts } : { ok: false, reason: "few" };
  }
  /* arc SVG (F.6.5): cerc exact → bulge; elipsă → puncte */
  function arcSvg(x1, y1, rx, ry, rotDeg, large, sweep, x2, y2) {
    if (rx < EPS || ry < EPS || (Math.abs(x1 - x2) < EPS && Math.abs(y1 - y2) < EPS)) return { type: "line" };
    var phi = rotDeg * Math.PI / 180, cp = Math.cos(phi), sp = Math.sin(phi);
    var dx = (x1 - x2) / 2, dy = (y1 - y2) / 2, x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
    var lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry); if (lam > 1) { var s = Math.sqrt(lam); rx *= s; ry *= s; }
    var sign = (large === sweep ? -1 : 1);
    var num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p, den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
    var co = sign * Math.sqrt(Math.max(0, num / den)), cxp = co * rx * y1p / ry, cyp = -co * ry * x1p / rx;
    var cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
    function ang(ux, uy, vx, vy) { var a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; }
    var th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry), dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!sweep && dth > 0) dth -= 2 * Math.PI; else if (sweep && dth < 0) dth += 2 * Math.PI;
    if (Math.abs(rx - ry) < 1e-6 * Math.max(rx, ry)) {
      /* în coordonate SVG (y în jos) sweep=1 e „în sensul cresterii unghiului”; după întoarcerea lui y devine sens orar → bulge negativ */
      var b = Math.tan(Math.abs(dth) / 4) * (sweep ? -1 : 1);
      return { type: "bulge", bulge: b };
    }
    var out = [], K = Math.max(8, Math.ceil(Math.abs(dth) / (Math.PI / 24)));
    for (var k = 1; k < K; k++) { var a = th1 + dth * k / K; out.push([cx + rx * Math.cos(a) * cp - ry * Math.sin(a) * sp, cy + rx * Math.cos(a) * sp + ry * Math.sin(a) * cp]); }
    return { type: "poly", pts: out };
  }

  /* ---------- import: DXF (ASCII) — LWPOLYLINE închis, sau LINE/ARC/CIRCLE înlănțuite ---------- */
  function fromDXF(text) {
    var L = String(text || "").split(/\r?\n/), pairs = [], i;
    for (i = 0; i + 1 < L.length; i += 2) pairs.push([parseInt(L[i].trim(), 10), L[i + 1].trim()]);
    var unitsK = 1, ins = null;
    for (i = 0; i < pairs.length; i++) if (pairs[i][0] === 9 && pairs[i][1] === "$INSUNITS" && pairs[i + 1] && pairs[i + 1][0] === 70) ins = parseInt(pairs[i + 1][1], 10);
    if (ins === 1) unitsK = 25.4; else if (ins === 2) unitsK = 304.8; else if (ins === 5) unitsK = 10; else if (ins === 6) unitsK = 1000; else if (ins === 4 || ins == null || ins === 0) unitsK = 1; else return { ok: false, reason: "units" };
    var ents = [], cur = null;
    for (i = 0; i < pairs.length; i++) {
      var c = pairs[i][0], v = pairs[i][1];
      if (c === 0) { if (cur) ents.push(cur); cur = (v === "LWPOLYLINE" || v === "LINE" || v === "ARC" || v === "CIRCLE") ? { t: v, g: [] } : null; continue; }
      if (cur) cur.g.push([c, v]);
    }
    if (cur) ents.push(cur);
    function f(e, code, nth) { var k = 0; for (var j = 0; j < e.g.length; j++) if (e.g[j][0] === code) { if (k === (nth || 0)) return parseFloat(e.g[j][1]); k++; } return NaN; }
    var lw = ents.filter(function (e) { return e.t === "LWPOLYLINE"; });
    for (i = 0; i < lw.length; i++) {
      var e = lw[i], flag = f(e, 70), vs = [], cx0 = null;
      for (var j = 0; j < e.g.length; j++) {
        if (e.g[j][0] === 10) { vs.push([parseFloat(e.g[j][1]), NaN, 0]); }
        else if (e.g[j][0] === 20 && vs.length) vs[vs.length - 1][1] = parseFloat(e.g[j][1]);
        else if (e.g[j][0] === 42 && vs.length) vs[vs.length - 1][2] = parseFloat(e.g[j][1]);
      }
      if ((flag & 1) && vs.length >= 3 && vs.every(function (q) { return isFinite(q[0]) && isFinite(q[1]); }))
        return { ok: true, pts: vs.map(function (q) { return [q[0] * unitsK, q[1] * unitsK, q[2]]; }) };
    }
    /* LINE/ARC/CIRCLE: înlănțuire */
    var segs = [];
    ents.forEach(function (e) {
      if (e.t === "LINE") segs.push({ a: [f(e, 10) * unitsK, f(e, 20) * unitsK], b: [f(e, 11) * unitsK, f(e, 21) * unitsK], bulge: 0 });
      else if (e.t === "ARC") {
        var cx = f(e, 10) * unitsK, cy = f(e, 20) * unitsK, r = f(e, 40) * unitsK, a0 = f(e, 50) * Math.PI / 180, a1 = f(e, 51) * Math.PI / 180;
        var sw = a1 - a0; if (sw <= 0) sw += 2 * Math.PI;
        segs.push({ a: [cx + r * Math.cos(a0), cy + r * Math.sin(a0)], b: [cx + r * Math.cos(a1), cy + r * Math.sin(a1)], bulge: Math.tan(sw / 4) });
      } else if (e.t === "CIRCLE") {
        var kx = f(e, 10) * unitsK, ky = f(e, 20) * unitsK, kr = f(e, 40) * unitsK;
        segs.push({ a: [kx + kr, ky], b: [kx - kr, ky], bulge: 1 }); segs.push({ a: [kx - kr, ky], b: [kx + kr, ky], bulge: 1 });
      }
    });
    if (!segs.length) return { ok: false, reason: "empty" };
    if (segs.some(function (s) { return ![s.a[0], s.a[1], s.b[0], s.b[1]].every(isFinite); })) return { ok: false, reason: "dxf" };
    var used = segs.map(function () { return false; }), chain = [segs[0]], end = segs[0].b; used[0] = true;
    var close = function (p, q) { return Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.01; };
    for (var guard = 0; guard < segs.length; guard++) {
      if (close(end, chain[0].a)) break;
      var nx = -1, rev = false;
      for (var s2 = 0; s2 < segs.length; s2++) { if (used[s2]) continue; if (close(segs[s2].a, end)) { nx = s2; break; } if (close(segs[s2].b, end)) { nx = s2; rev = true; break; } }
      if (nx < 0) return { ok: false, reason: "open" };
      used[nx] = true; var sg = segs[nx];
      if (rev) sg = { a: sg.b, b: sg.a, bulge: -sg.bulge };
      chain.push(sg); end = sg.b;
    }
    if (!close(end, chain[0].a) || used.some(function (u) { return !u; })) return { ok: false, reason: used.some(function (u) { return !u; }) ? "multi" : "open" };
    return { ok: true, pts: chain.map(function (s) { return [s.a[0], s.a[1], s.bulge]; }) };
  }

  /* detectează formatul și importă */
  function parse(text) {
    var s = String(text || "").trim();
    if (!s) return { ok: false, reason: "empty" };
    if (/^\s*0\s*\r?\n\s*SECTION/m.test(s) || /\r?\nENTITIES\r?\n/.test(s)) return fromDXF(s);
    var m = s.match(/\sd\s*=\s*["']([^"']+)["']/i); if (m) return fromPath(m[1]);
    if (/^[MmLlHhVvAaCcQqZz]/.test(s)) return fromPath(s);
    return fromPoints(s);
  }

  /* ---------- un contur gata de pus pe piesă: parse + scală + normalizare ---------- */
  function build(raw, opt) {
    opt = opt || {};
    var pts = raw; var k = +opt.scale > 0 ? +opt.scale : 1;
    if (opt.fitW > 0 || opt.fitH > 0) {                                   // scală uniformă: lățimea sau înălțimea dorită
      var bb = bbox(pts);
      k = opt.fitW > 0 && bb.w > 0 ? opt.fitW / bb.w : (opt.fitH > 0 && bb.h > 0 ? opt.fitH / bb.h : 1);
    }
    return normalize(scale(pts, k));
  }

  return { TOL: TOL, SHAPES: SHAPES, arcOf: arcOf, flatten: flatten, area: area, perimeter: perimeter, bbox: bbox, isSimple: isSimple, normalize: normalize,
           scale: scale, triangulate: triangulate, shape: shape, bulgeFor: bulgeFor, fromPoints: fromPoints, fromPath: fromPath, fromDXF: fromDXF, parse: parse, build: build, polyArea: polyArea };
});
