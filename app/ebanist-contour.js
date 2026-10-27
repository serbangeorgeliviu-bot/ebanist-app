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
    function same(u, w) { return Math.abs(P[u][0] - P[w][0]) < 1e-9 && Math.abs(P[u][1] - P[w][1]) < 1e-9; }   // vârf dublat (podul spre o gaură)
    var guard = 0;
    while (idx.length > 3 && guard++ < 100000) {
      var found = false, m = idx.length;
      for (i = 0; i < m; i++) {
        var a = idx[(i + m - 1) % m], b = idx[i], c = idx[(i + 1) % m];
        if (cross(a, b, c) <= 1e-12) continue;                           // vârf concav sau coliniar
        var ok = true;
        for (var k = 0; k < m; k++) { var v = idx[k]; if (v === a || v === b || v === c) continue; if (same(v, a) || same(v, b) || same(v, c)) continue; if (inTri(v, a, b, c)) { ok = false; break; } }
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
    var t = tokens(String(d || "")), i = 0, cmd = null, x = 0, y = 0, sx = 0, sy = 0, pts = [], started = false, closed = false, hadAny = false, loops = [];
    function num() { var v = t[i++]; if (typeof v !== "number") throw new Error("path"); return v; }
    function flag() { return num() ? 1 : 0; }
    function push(px, py, b) { pts.push([px, -py, b || 0]); }
    function endLoop() {                                  // încheie subtraseul curent: închis cu Z sau cu ultimul punct pe primul
      if (!started) return true;
      if (!closed && !(pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.005)) return false;
      loops.push(pts); pts = []; started = false; closed = false; return true;
    }
    try {
      while (i < t.length) {
        if (typeof t[i] === "string") cmd = t[i++];
        else if (!cmd) return { ok: false, reason: "path" };
        var rel = cmd === cmd.toLowerCase() && cmd !== "Z" && cmd !== "z", C = cmd.toUpperCase();
        if (C === "Z") { closed = true; x = sx; y = sy; continue; }
        if (C === "M") { var mx = num(), my = num(); if (!endLoop()) return { ok: false, reason: "open" }; x = rel && hadAny ? x + mx : mx; y = rel && hadAny ? y + my : my; sx = x; sy = y; push(x, y); started = true; hadAny = true; cmd = rel ? "l" : "L"; continue; }
        if (!started) return { ok: false, reason: "path" };
        if (closed) return { ok: false, reason: "path" };              // după Z urmează un subtraseu nou (M), nu o continuare
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
    if (!endLoop()) return { ok: false, reason: "open" };
    return classify(loops);
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
    var loops = [], lw = ents.filter(function (e) { return e.t === "LWPOLYLINE"; }), i2;
    for (i2 = 0; i2 < lw.length; i2++) {
      var e = lw[i2], flag = f(e, 70), vs = [];
      for (var j = 0; j < e.g.length; j++) {
        if (e.g[j][0] === 10) { vs.push([parseFloat(e.g[j][1]), NaN, 0]); }
        else if (e.g[j][0] === 20 && vs.length) vs[vs.length - 1][1] = parseFloat(e.g[j][1]);
        else if (e.g[j][0] === 42 && vs.length) vs[vs.length - 1][2] = parseFloat(e.g[j][1]);
      }
      if ((flag & 1) && vs.length >= 3 && vs.every(function (q) { return isFinite(q[0]) && isFinite(q[1]); }))
        loops.push(vs.map(function (q) { return [q[0] * unitsK, q[1] * unitsK, q[2]]; }));
    }
    /* LINE/ARC înlănțuite; fiecare CIRCLE e un contur închis de sine stătător (două semicercuri) */
    var segs = [];
    ents.forEach(function (e) {
      if (e.t === "LINE") segs.push({ a: [f(e, 10) * unitsK, f(e, 20) * unitsK], b: [f(e, 11) * unitsK, f(e, 21) * unitsK], bulge: 0 });
      else if (e.t === "ARC") {
        var cx = f(e, 10) * unitsK, cy = f(e, 20) * unitsK, r = f(e, 40) * unitsK, a0 = f(e, 50) * Math.PI / 180, a1 = f(e, 51) * Math.PI / 180;
        var sw = a1 - a0; if (sw <= 0) sw += 2 * Math.PI;
        segs.push({ a: [cx + r * Math.cos(a0), cy + r * Math.sin(a0)], b: [cx + r * Math.cos(a1), cy + r * Math.sin(a1)], bulge: Math.tan(sw / 4) });
      } else if (e.t === "CIRCLE") {
        var kx = f(e, 10) * unitsK, ky = f(e, 20) * unitsK, kr = f(e, 40) * unitsK;
        if (![kx, ky, kr].every(isFinite) || !(kr > 0)) segs.push({ a: [NaN, NaN], b: [NaN, NaN], bulge: 0 });
        else loops.push([[kx + kr, ky, 1], [kx - kr, ky, 1]]);
      }
    });
    if (segs.some(function (s) { return ![s.a[0], s.a[1], s.b[0], s.b[1]].every(isFinite); })) return { ok: false, reason: "dxf" };
    var used = segs.map(function () { return false; });
    var close = function (p, q) { return Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.01; };
    for (var s0 = 0; s0 < segs.length; s0++) {
      if (used[s0]) continue;
      var chain = [segs[s0]], end = segs[s0].b; used[s0] = true;
      for (var guard = 0; guard < segs.length; guard++) {
        if (close(end, chain[0].a)) break;
        var nx = -1, rev = false;
        for (var s2 = 0; s2 < segs.length; s2++) { if (used[s2]) continue; if (close(segs[s2].a, end)) { nx = s2; break; } if (close(segs[s2].b, end)) { nx = s2; rev = true; break; } }
        if (nx < 0) return { ok: false, reason: "open" };
        used[nx] = true; var sg = segs[nx];
        if (rev) sg = { a: sg.b, b: sg.a, bulge: -sg.bulge };
        chain.push(sg); end = sg.b;
      }
      if (!close(end, chain[0].a)) return { ok: false, reason: "open" };
      loops.push(chain.map(function (s) { return [s.a[0], s.a[1], s.bulge]; }));
    }
    if (!loops.length) return { ok: false, reason: "empty" };
    return classify(loops);
  }

  /* ---------- mai multe contururi într-un fișier: cel mai mare e conturul piesei, cele dinăuntru sunt găuri ---------- */
  function classify(loops) {
    var L = loops.map(function (l) { return clean(l); });
    for (var i = 0; i < L.length; i++) if (!enough(L[i])) return { ok: false, reason: "few" };
    if (L.length === 1) return { ok: true, pts: loops[0], holes: [] };
    var ai = L.map(function (l) { return Math.abs(area(l)); }), o = 0;
    for (i = 1; i < L.length; i++) if (ai[i] > ai[o]) o = i;
    var OP = flatten(L[o]), holes = [];
    for (i = 0; i < L.length; i++) {
      if (i === o) continue;
      if (!pointInPoly(OP, L[i][0])) return { ok: false, reason: "multi" };       // un contur în afara piesei: se adaugă ca piesă separată
      holes.push(loops[i]);
    }
    return { ok: true, pts: loops[o], holes: holes };
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
    var sc = scale(pts, k), N = normalize(sc);
    if (N.ok && opt.holes && opt.holes.length) {                          // găurile din fișier: aceeași scală și același decalaj ca la conturul exterior
      var b0 = bbox(clean(sc));
      N.holes = opt.holes.map(function (l) {
        return clean(scale(l, k)).map(function (q) { return [round6(q[0] - b0.x0), round6(q[1] - b0.y0), q[2]]; });
      });
    }
    return N;
  }

  /* =====================================================================
     v2 (D-102): găuri și decupaje interioare, canale, validare, triangulare cu găuri
     ===================================================================== */
  /* Datele sunt `verificat:false` până la măsurătoarea pe mașină: pentru găuri, grosimea minimă a punții de material între ele și față de marginea piesei;
     sub diametrul `drillMax` o gaură rotundă se burghiază (operație „drill”), peste el se frezează (contur interior). */
  var HOLE = { minWeb: 3, drillMax: 35, maxN: 60, verificat: false };
  var GROOVE = { maxW: 50, keep: 2, maxN: 40, verificat: false };      // `keep` = cât material rămâne sub canal (adâncime ≤ grosime − keep)

  function pointInPoly(P, q) {
    var inside = false, x = q[0], y = q[1], n = P.length;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      var xi = P[i][0], yi = P[i][1], xj = P[j][0], yj = P[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function segDist(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    var t = l2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  }
  function polyDist(P, Q) {                    // distanța minimă între două contururi (vârf–segment, în ambele sensuri)
    var d = 1e18, i, j;
    for (i = 0; i < P.length; i++) for (j = 0; j < Q.length; j++) d = Math.min(d, segDist(P[i], Q[j], Q[(j + 1) % Q.length]));
    for (i = 0; i < Q.length; i++) for (j = 0; j < P.length; j++) d = Math.min(d, segDist(Q[i], P[j], P[(j + 1) % P.length]));
    return d;
  }
  function polysCross(P, Q) {
    for (var i = 0; i < P.length; i++) for (var j = 0; j < Q.length; j++) if (segInter(P[i], P[(i + 1) % P.length], Q[j], Q[(j + 1) % Q.length])) return true;
    return false;
  }
  function reverse(pts) {                      // sensul invers: vârfurile în ordine inversă, bulge-ul mutat pe segmentul vecin cu semn schimbat
    var n = pts.length, rev = [];
    for (var i = n - 1; i >= 0; i--) { var prev = pts[(i - 1 + n) % n]; rev.push([pts[i][0], pts[i][1], -(+prev[2] || 0)]); }
    return rev;
  }
  function circleOf(pts) {                     // un cerc = două semicercuri (bulge ±1): centrul și diametrul
    if (!pts || pts.length !== 2) return null;
    if (Math.abs(Math.abs(+pts[0][2]) - 1) > 1e-6 || Math.abs(Math.abs(+pts[1][2]) - 1) > 1e-6) return null;
    return { cx: (pts[0][0] + pts[1][0]) / 2, cy: (pts[0][1] + pts[1][1]) / 2, d: Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]) };
  }

  /* găurile din text, o linie per gaură; centrul se măsoară de la colțul stânga-jos al piesei, y în sus:
       c x y d            cerc de diametru d
       r x y w h [raza]   dreptunghi w × h, cu colțuri rotunjite opțional
       s x y w h          canal-ovală (capete rotunde), pe lungime w sau h
     separatori: spațiu, virgulă sau „;”; zecimale cu punct; „#” începe un comentariu. */
  function parseLines(text, kinds, arity) {
    var out = [], L = String(text || "").split(/\r?\n/);
    for (var i = 0; i < L.length; i++) {
      var ln = L[i].replace(/#.*$/, "").trim(); if (!ln) continue;
      var tk = ln.split(/[\s,;]+/).filter(Boolean), k = tk[0].toLowerCase();
      if (!arity[k] || arity[k].indexOf(tk.length - 1) < 0) return { ok: false, line: i + 1 };
      var nums = [];
      for (var j = 1; j < tk.length; j++) { var v = Number(tk[j]); if (!isFinite(v) || tk[j] === "" ) return { ok: false, line: i + 1 }; nums.push(v); }
      out.push({ k: k, n: nums, line: i + 1 });
    }
    return { ok: true, items: out };
  }
  function parseHoles(text) {
    var r = parseLines(text, "crs", { c: [3], r: [4, 5], s: [4] });
    if (!r.ok) return { ok: false, reason: "holeSyntax", line: r.line };
    var holes = [];
    for (var i = 0; i < r.items.length; i++) {
      var it = r.items[i], n = it.n, h;
      if (it.k === "c") { if (!(n[2] > 0)) return { ok: false, reason: "holeSyntax", line: it.line }; h = { k: "c", x: n[0], y: n[1], d: n[2] }; }
      else {
        if (!(n[2] > 0 && n[3] > 0) || (n[4] != null && n[4] < 0)) return { ok: false, reason: "holeSyntax", line: it.line };
        h = { k: it.k, x: n[0], y: n[1], w: n[2], h: n[3], r: it.k === "s" ? Math.min(n[2], n[3]) / 2 : Math.min(n[4] || 0, n[2] / 2, n[3] / 2) };
      }
      h.line = it.line; holes.push(h);
    }
    if (holes.length > HOLE.maxN) return { ok: false, reason: "holeMany" };
    return { ok: true, holes: holes };
  }
  function holeLoop(h) {                       // conturul găurii, antiorar (se inversează la montare)
    if (h.k === "c") { var r = h.d / 2; return [[h.x + r, h.y, 1], [h.x - r, h.y, 1]]; }
    var x0 = h.x - h.w / 2, x1 = h.x + h.w / 2, y0 = h.y - h.h / 2, y1 = h.y + h.h / 2, rr = h.r || 0;
    if (!(rr > 0)) return [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]];
    var b = Math.tan(Math.PI / 8);
    return clean([[x0 + rr, y0, 0], [x1 - rr, y0, b], [x1, y0 + rr, 0], [x1, y1 - rr, b], [x1 - rr, y1, 0], [x0 + rr, y1, b], [x0, y1 - rr, 0], [x0, y0 + rr, b]]);
  }
  /* canalele: x1 y1 x2 y2 lățime adâncime [j]  — dreaptă, pe fața de sus (5); „j” = pe fața de jos (6) */
  function parseGrooves(text) {
    var L = String(text || "").split(/\r?\n/), out = [];
    for (var i = 0; i < L.length; i++) {
      var ln = L[i].replace(/#.*$/, "").trim(); if (!ln) continue;
      var tk = ln.split(/[\s,;]+/).filter(Boolean), back = false;
      if (tk.length === 7 && /^[jJ]$/.test(tk[6])) { back = true; tk.pop(); }
      if (tk.length !== 6) return { ok: false, reason: "grooveSyntax", line: i + 1 };
      var n = tk.map(Number);
      if (!n.every(isFinite) || !(n[4] > 0 && n[5] > 0) || Math.hypot(n[2] - n[0], n[3] - n[1]) < 1) return { ok: false, reason: "grooveSyntax", line: i + 1 };
      out.push({ x1: n[0], y1: n[1], x2: n[2], y2: n[3], w: n[4], d: n[5], back: back, line: i + 1 });
    }
    if (out.length > GROOVE.maxN) return { ok: false, reason: "grooveMany" };
    return { ok: true, grooves: out };
  }

  /* gaură din fișier: curăță, verifică, orientează în sens orar */
  function normalizeHole(raw) {
    var pts = clean(raw || []);
    if (!enough(pts)) return null;
    var P = flatten(pts);
    if (!isSimple(P) || Math.abs(polyArea(P)) < 1) return null;
    return area(pts) > 0 ? reverse(pts) : pts;
  }
  function mkHole(pts, src) { return { pts: pts, circle: circleOf(pts), src: src, area: Math.abs(area(pts)) }; }

  /* Totul despre o piesă, dintr-o specificație:
       { shape, L, H, r, rise, fit, src, contour?, impHoles?, holesTxt, groovesTxt }
     `contour`/`impHoles` (deja normalizate, salvate odată cu modulul) au prioritate față de `shape`/`src`.
     T = grosimea (opțional) — pentru adâncimea canalelor.
     Întoarce { ok, pts, w, h, area, perim, impHoles, holes[{pts(orar), circle, src, area}], grooves[] } sau { ok:false, why, line? }. */
  function resolve(spec, T) {
    spec = spec || {};
    var kind = spec.shape || "custom", N, imp = [], raw = null, rawHoles = [];
    if (Array.isArray(spec.contour) && spec.contour.length >= 2) {
      N = normalize(spec.contour); if (!N.ok) return { ok: false, why: N.reason };
      imp = Array.isArray(spec.impHoles) ? spec.impHoles : [];
    } else {
      if (kind !== "custom") raw = shape(kind, spec.L, spec.H, { r: spec.r, rise: spec.rise });
      else if (spec.src && String(spec.src).trim()) { var pr = parse(spec.src); if (!pr.ok) return { ok: false, why: pr.reason }; raw = pr.pts; rawHoles = pr.holes || []; }
      if (!raw) return { ok: false, why: "empty" };
      var fit = kind === "custom" ? spec.fit : "none";
      N = build(raw, { fitW: fit === "W" ? +spec.L : 0, fitH: fit === "H" ? +spec.H : 0, holes: rawHoles });
      if (!N.ok) return { ok: false, why: N.reason };
      imp = N.holes || [];
    }
    var holes = [], i, j;
    for (i = 0; i < imp.length; i++) { var q = normalizeHole(imp[i]); if (!q) return { ok: false, why: "holeBad", n: i + 1 }; holes.push(mkHole(q, "imp")); }
    if (spec.holesTxt && String(spec.holesTxt).trim()) {
      var ph = parseHoles(spec.holesTxt); if (!ph.ok) return { ok: false, why: ph.reason, line: ph.line };
      ph.holes.forEach(function (h) { holes.push(mkHole(reverse(holeLoop(h)), "txt")); });
    }
    if (holes.length > HOLE.maxN) return { ok: false, why: "holeMany" };
    var OP = flatten(N.pts), HP = holes.map(function (h) { return flatten(h.pts); });
    for (i = 0; i < holes.length; i++) {
      var hp = HP[i];
      if (holes[i].area < 1) return { ok: false, why: "holeBad", n: i + 1 };
      if (!hp.every(function (v) { return pointInPoly(OP, v); }) || polysCross(OP, hp)) return { ok: false, why: "holeOut", n: i + 1 };
      if (polyDist(OP, hp) < HOLE.minWeb - 1e-9) return { ok: false, why: "holeWeb", n: i + 1 };
      for (j = 0; j < i; j++) {
        if (polysCross(HP[j], hp) || pointInPoly(HP[j], hp[0]) || pointInPoly(hp, HP[j][0])) return { ok: false, why: "holeHit", n: i + 1 };
        if (polyDist(HP[j], hp) < HOLE.minWeb - 1e-9) return { ok: false, why: "holeWeb", n: i + 1 };
      }
    }
    var grooves = [];
    if (spec.groovesTxt && String(spec.groovesTxt).trim()) {
      var pg = parseGrooves(spec.groovesTxt); if (!pg.ok) return { ok: false, why: pg.reason, line: pg.line };
      for (i = 0; i < pg.grooves.length; i++) {
        var g = pg.grooves[i];
        if (g.w > GROOVE.maxW) return { ok: false, why: "grooveW", n: i + 1 };
        if (T > 0 && g.d > T - GROOVE.keep + 1e-9) return { ok: false, why: "grooveDepth", n: i + 1 };
        for (var s = 0; s <= 20; s++) {
          var pt = [g.x1 + (g.x2 - g.x1) * s / 20, g.y1 + (g.y2 - g.y1) * s / 20];
          if (!pointInPoly(OP, pt) || HP.some(function (h2) { return pointInPoly(h2, pt); })) return { ok: false, why: "grooveOut", n: i + 1 };
        }
        grooves.push(g);
      }
    }
    var ha = 0; holes.forEach(function (h) { ha += h.area; });
    return { ok: true, pts: N.pts, w: N.w, h: N.h, area: N.area, perim: N.perim, impHoles: holes.filter(function (h) { return h.src === "imp"; }).map(function (h) { return h.pts; }),
             holes: holes, holeArea: ha, grooves: grooves };
  }

  /* triangulare cu găuri: fiecare gaură se leagă de contur printr-un „pod” (două muchii suprapuse), apoi ear clipping.
     Întoarce { P: vârfurile poligonului unit, tri } sau null; suma ariilor triunghiurilor = aria conturului − ariile găurilor. */
  function triangulateH(outer, holes) {
    if (!holes || !holes.length) { var t0 = triangulate(outer); return t0 ? { P: outer, tri: t0 } : null; }
    var O = polyArea(outer) < 0 ? outer.slice().reverse() : outer.slice();
    var Hs = holes.map(function (h) { return polyArea(h) > 0 ? h.slice().reverse() : h.slice(); });
    function maxX(h) { var m = -1e18; for (var i = 0; i < h.length; i++) m = Math.max(m, h[i][0]); return m; }
    Hs.sort(function (a, b) { return maxX(b) - maxX(a); });
    var poly = O.slice(), total = Math.abs(polyArea(O));
    Hs.forEach(function (h) { total -= Math.abs(polyArea(h)); });
    function crossesRing(M, V, R) {
      for (var i = 0; i < R.length; i++) if (segInter(M, V, R[i], R[(i + 1) % R.length])) return true;
      return false;
    }
    for (var hi = 0; hi < Hs.length; hi++) {
      var h = Hs[hi], rest = Hs.slice(hi + 1), mi = 0, k;
      for (k = 1; k < h.length; k++) if (h[k][0] > h[mi][0]) mi = k;
      var M = h[mi], order = [];
      for (k = 0; k < poly.length; k++) order.push(k);
      order.sort(function (a, b) { return Math.hypot(poly[a][0] - M[0], poly[a][1] - M[1]) - Math.hypot(poly[b][0] - M[0], poly[b][1] - M[1]); });
      var bridge = -1;
      for (var oi = 0; oi < order.length && bridge < 0; oi++) {
        var V = poly[order[oi]], mid = [(M[0] + V[0]) / 2, (M[1] + V[1]) / 2];
        if (crossesRing(M, V, poly) || crossesRing(M, V, h)) continue;
        if (rest.some(function (r) { return crossesRing(M, V, r) || pointInPoly(r, mid); })) continue;
        if (!pointInPoly(O, mid) || pointInPoly(h, mid)) continue;
        bridge = order[oi];
      }
      if (bridge < 0) return null;
      var ring = []; for (k = 0; k <= h.length; k++) ring.push(h[(mi + k) % h.length]);
      poly = poly.slice(0, bridge + 1).concat(ring, [poly[bridge]], poly.slice(bridge + 1));
    }
    var ok = function (T) {
      if (!T) return false;
      var sum = 0; T.tri.forEach(function (t3) { sum += Math.abs(polyArea([T.P[t3[0]], T.P[t3[1]], T.P[t3[2]]])); });
      if (Math.abs(sum - total) > 1e-6 * Math.max(1, total)) return false;
      /* fiecare triunghi e în piesă și nu e într-o gaură (centrul lui) */
      return T.tri.every(function (t3) {
        var a = T.P[t3[0]], b = T.P[t3[1]], c = T.P[t3[2]], m = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
        if (Math.abs(polyArea([a, b, c])) < 1e-9) return true;
        return pointInPoly(O, m) && !Hs.some(function (h) { return pointInPoly(h, m); });
      });
    };
    var tri = triangulate(poly), T1 = tri ? { P: poly, tri: tri } : null;
    if (ok(T1)) return T1;
    /* ear clipping se încurcă pe vârfuri dublate (podurile): descompunerea pe fâșii orizontale e mai lungă, dar exactă */
    var T2 = slabs(O, Hs);
    return ok(T2) ? T2 : null;
  }
  /* descompunere în trapeze pe fâșii orizontale între y-urile vârfurilor; fiecare trapez = 2 triunghiuri */
  function slabs(outer, holes) {
    var rings = [outer].concat(holes), edges = [], ys = [], i, j;
    rings.forEach(function (r) {
      for (i = 0; i < r.length; i++) {
        var a = r[i], b = r[(i + 1) % r.length]; ys.push(a[1]);
        if (Math.abs(a[1] - b[1]) < 1e-12) continue;
        edges.push(a[1] < b[1] ? [a, b] : [b, a]);
      }
    });
    ys.sort(function (u, w) { return u - w; });
    var Y = []; ys.forEach(function (y) { if (!Y.length || y - Y[Y.length - 1] > 1e-9) Y.push(y); });
    function xAt(e, y) { var t = (y - e[0][1]) / (e[1][1] - e[0][1]); return e[0][0] + t * (e[1][0] - e[0][0]); }
    var P = [], tri = [];
    for (i = 0; i + 1 < Y.length; i++) {
      var y0 = Y[i], y1 = Y[i + 1], ym = (y0 + y1) / 2;
      var act = edges.filter(function (e) { return e[0][1] <= y0 + 1e-9 && e[1][1] >= y1 - 1e-9; });
      if (act.length % 2) return null;
      act.sort(function (u, w) { return xAt(u, ym) - xAt(w, ym); });
      for (j = 0; j < act.length; j += 2) {
        var L = act[j], R = act[j + 1], l0 = [xAt(L, y0), y0], r0 = [xAt(R, y0), y0], r1 = [xAt(R, y1), y1], l1 = [xAt(L, y1), y1];
        var base = P.length; P.push(l0, r0, r1, l1);
        if (Math.abs(polyArea([l0, r0, r1])) > 1e-12) tri.push([base, base + 1, base + 2]);
        if (Math.abs(polyArea([l0, r1, l1])) > 1e-12) tri.push([base, base + 2, base + 3]);
      }
    }
    return { P: P, tri: tri };
  }

  return { TOL: TOL, SHAPES: SHAPES, arcOf: arcOf, flatten: flatten, area: area, perimeter: perimeter, bbox: bbox, isSimple: isSimple, normalize: normalize,
           scale: scale, triangulate: triangulate, triangulateH: triangulateH, slabs: slabs, resolve: resolve, parseHoles: parseHoles, parseGrooves: parseGrooves, holeLoop: holeLoop, pointInPoly: pointInPoly, polyDist: polyDist, reverse: reverse, circleOf: circleOf, classify: classify, HOLE: HOLE, GROOVE: GROOVE, shape: shape, bulgeFor: bulgeFor, fromPoints: fromPoints, fromPath: fromPath, fromDXF: fromDXF, parse: parse, build: build, polyArea: polyArea };
});
