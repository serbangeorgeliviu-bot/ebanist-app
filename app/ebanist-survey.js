/* =====================================================================
   Ebanist — Releveu: geometria pură a conturului camerei (D-82)
   ---------------------------------------------------------------------
   Nicio dependență de pagină: rulează în aplicație (script clasic, global
   `EBSurvey`) și în testele Node. Aici stau:

   - planPoints   conturul din lungimi și unghiuri (singura sursă);
   - closure      decalajul de închidere, cu cifră, și ce perete sau colț
                  îl explică cel mai bine;
   - closingWall  peretele care închide conturul, calculat;
   - diagonal     o diagonală măsurată față de cea din plan;
   - wallsFromDxf un plan ASCII DXF (LWPOLYLINE, POLYLINE sau LINE) devine
                  pereți și unghiuri.

   Convenția: `angle` e unghiul interior din colțul de DUPĂ perete; conturul
   se desenează în coordonate de ecran (y în jos), pornind spre dreapta, iar
   directia se rotește cu (180° − unghi) la fiecare colț. Unghiuri peste 180°
   sunt colțuri intrânde (camera în L).

   Milimetri. Rotunjirea e numai la afișare și la emitere.
   ===================================================================== */
(function (root) {
  "use strict";

  var DEG = Math.PI / 180;

  function planPoints(walls) {
    var pts = [{ x: 0, y: 0 }], heading = 0;
    for (var i = 0; i < walls.length; i++) {
      var L = +walls[i].len || 0, last = pts[pts.length - 1];
      pts.push({ x: last.x + L * Math.cos(heading), y: last.y + L * Math.sin(heading) });
      heading += Math.PI - (+walls[i].angle || 90) * DEG;
    }
    return pts;
  }

  /* ---- închiderea ---------------------------------------------------- */

  /* Decalajul dintre ultimul punct și primul. Pentru fiecare perete și
     fiecare colț se întreabă: dacă numai ACEA cotă ar fi greșită, cât ar
     trebui să fie ca să se închidă? Rămâne ce explică decalajul aproape
     întreg (restul sub `tol` mm); mai multe erori deodată nu dau nicio
     explicație, și e corect să nu inventăm una. */
  function closure(walls, opts) {
    var o = opts || {}, tol = o.tol != null ? o.tol : 50, fit = o.fit != null ? o.fit : 8;
    var n = walls.length, out = { gap: 0, closed: true, vec: { x: 0, y: 0 }, hints: [], complete: false };
    if (!n) return out;
    var pts = planPoints(walls), first = pts[0], end = pts[n];
    out.complete = walls.every(function (w) { return +w.len > 0; });
    var ex = end.x - first.x, ey = end.y - first.y;
    out.vec = { x: ex, y: ey };
    out.gap = Math.hypot(ex, ey);
    out.closed = out.gap <= tol;
    if (!out.complete || out.gap < 3 || n < 3) return out;
    var tx = -ex, ty = -ey, cands = [], i;
    for (i = 0; i < n; i++) {
      var dx = pts[i + 1].x - pts[i].x, dy = pts[i + 1].y - pts[i].y, L = Math.hypot(dx, dy);
      if (L < 1) continue;
      dx /= L; dy /= L;
      var delta = dx * tx + dy * ty, res = Math.abs(dx * ty - dy * tx);
      cands.push({ kind: "len", wall: i, delta: delta, residual: res, value: (+walls[i].len || 0) + delta });
    }
    for (i = 0; i < n; i++) {
      var pv = pts[i + 1], rx = end.x - pv.x, ry = end.y - pv.y, r2 = rx * rx + ry * ry;
      if (r2 < 100 * 100) continue;
      var px = -ry, py = rx, phi = (px * tx + py * ty) / r2;
      var rr = Math.hypot(tx - phi * px, ty - phi * py);
      cands.push({ kind: "angle", wall: i, delta: -phi / DEG, residual: rr, value: (+walls[i].angle || 90) - phi / DEG });
    }
    cands.sort(function (a, b) { return a.residual - b.residual; });
    out.hints = cands.filter(function (c) { return c.residual <= Math.max(fit, out.gap * 0.08); }).slice(0, 2);
    return out;
  }

  /* Peretele care închide conturul: de la ultimul punct la primul. Unghiul
     ultimului perete real se potrivește ca să țintească spre primul punct,
     iar peretele nou primește unghiul care îl reintoarce pe direcția
     primului perete. Se calculează, nu se măsoară: se spune așa în UI. */
  function closingWall(walls) {
    var n = walls.length;
    if (n < 2) return null;
    var pts = planPoints(walls), first = pts[0], last = pts[n];
    var gx = first.x - last.x, gy = first.y - last.y, len = Math.hypot(gx, gy);
    if (len < 1) return null;
    var h = 0, i;
    for (i = 0; i < n - 1; i++) h += Math.PI - (+walls[i].angle || 90) * DEG;
    var target = Math.atan2(gy, gx);
    /* unghiul din colțul de după ultimul perete real, ca noul perete să țintească primul punct */
    var prevAngle = 180 - (target - h) / DEG;
    /* unghiul din colțul de după peretele nou: îl întoarce pe direcția primului perete (0) */
    var wallAngle = 180 + target / DEG;
    return { prevAngle: norm360(prevAngle), wall: { len: Math.round(len), angle: norm360(wallAngle) } };
  }

  function norm360(a) {
    a = a % 360; if (a <= 0) a += 360;
    return Math.round(a * 100) / 100;
  }

  /* ---- diagonale ------------------------------------------------------ */

  /* `a` și `b` sunt numere de colț (1 = începutul primului perete). */
  function diagonal(walls, d) {
    var pts = planPoints(walls), n = walls.length;
    var ia = (d.a - 1) % Math.max(n, 1), ib = (d.b - 1) % Math.max(n, 1);
    if (!(d.a >= 1 && d.b >= 1) || ia === ib || ia >= pts.length || ib >= pts.length) return null;
    var plan = Math.hypot(pts[ia].x - pts[ib].x, pts[ia].y - pts[ib].y);
    var meas = +d.len;
    if (!(meas > 0)) return { plan: plan, delta: null, a: ia, b: ib };
    return { plan: plan, delta: meas - plan, a: ia, b: ib };
  }

  /* ---- DXF ------------------------------------------------------------ */

  var INSUNITS = { 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000, 8: 25.4e-6, 9: 0.0254, 10: 914.4 };

  function tokens(text) {
    var lines = String(text).replace(/^﻿/, "").split(/\r\n|\r|\n/), out = [];
    for (var i = 0; i + 1 < lines.length; i += 2) {
      var code = parseInt(lines[i].trim(), 10);
      if (!isFinite(code)) return null;
      out.push([code, lines[i + 1].trim()]);
    }
    return out;
  }

  function parseDxf(text) {
    if (/^AutoCAD Binary DXF/.test(String(text))) return { error: "binary" };
    var t = tokens(text);
    if (!t || !t.length) return { error: "format" };
    var units = null, i = 0;
    for (; i < t.length; i++) {
      if (t[i][0] === 9 && t[i][1] === "$INSUNITS" && t[i + 1]) { units = parseInt(t[i + 1][1], 10); break; }
    }
    var ents = [], cur = null, inEnt = false, poly = null;
    function push() { if (cur) { ents.push(cur); cur = null; } }
    for (i = 0; i < t.length; i++) {
      var c = t[i][0], v = t[i][1];
      if (c === 0) {
        if (v === "SECTION" || v === "ENDSEC") { push(); inEnt = false; continue; }
        if (v === "EOF") { push(); break; }
        push();
        if (v === "SEQEND") { poly = null; continue; }
        if (v === "VERTEX" && poly) { cur = { type: "VERTEX", poly: poly, x: 0, y: 0 }; continue; }
        cur = { type: v, v: [], flags: 0, bulges: [] };
        if (v === "POLYLINE") poly = cur;
        continue;
      }
      if (c === 2 && v === "ENTITIES") { inEnt = true; continue; }
      if (!cur) continue;
      if (cur.type === "LWPOLYLINE") {
        if (c === 10) { cur.v.push({ x: parseFloat(v), y: 0 }); cur.bulges.push(0); }
        else if (c === 20 && cur.v.length) cur.v[cur.v.length - 1].y = parseFloat(v);
        else if (c === 42 && cur.bulges.length) cur.bulges[cur.bulges.length - 1] = parseFloat(v);
        else if (c === 70) cur.flags = parseInt(v, 10) || 0;
      } else if (cur.type === "POLYLINE") {
        if (c === 70) cur.flags = parseInt(v, 10) || 0;
      } else if (cur.type === "VERTEX") {
        if (c === 10) cur.x = parseFloat(v);
        else if (c === 20) cur.y = parseFloat(v);
        else if (c === 42) cur.bulge = parseFloat(v);
        else if (c === 70) cur.vflags = parseInt(v, 10) || 0;
      } else if (cur.type === "LINE") {
        if (c === 10) cur.x1 = parseFloat(v); else if (c === 20) cur.y1 = parseFloat(v);
        else if (c === 11) cur.x2 = parseFloat(v); else if (c === 21) cur.y2 = parseFloat(v);
      }
    }
    push();
    void inEnt;
    /* VERTEX-urile se adună în POLYLINE-ul lor */
    ents.forEach(function (e) {
      if (e.type === "VERTEX" && e.poly) { e.poly.v.push({ x: e.x, y: e.y }); e.poly.bulges.push(e.bulge || 0); }
    });
    return { units: units, entities: ents.filter(function (e) { return e.type === "LWPOLYLINE" || e.type === "POLYLINE" || e.type === "LINE"; }) };
  }

  function area(p) {
    var s = 0;
    for (var i = 0; i < p.length; i++) { var a = p[i], b = p[(i + 1) % p.length]; s += a.x * b.y - b.x * a.y; }
    return Math.abs(s) / 2;
  }

  /* LINE-uri separate înlănțuite într-un contur închis (capete egale la 1 mm). */
  function chainLines(lines, tol) {
    var segs = lines.map(function (l) { return [{ x: l.x1, y: l.y1 }, { x: l.x2, y: l.y2 }]; });
    segs = segs.filter(function (s) { return Math.hypot(s[0].x - s[1].x, s[0].y - s[1].y) > tol; });
    if (segs.length < 3) return null;
    var near = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y) <= tol; };
    var used = {}, poly = [segs[0][0], segs[0][1]]; used[0] = 1;
    for (var step = 0; step < segs.length; step++) {
      var tail = poly[poly.length - 1], found = false;
      for (var k = 0; k < segs.length; k++) {
        if (used[k]) continue;
        if (near(segs[k][0], tail)) { poly.push(segs[k][1]); used[k] = 1; found = true; break; }
        if (near(segs[k][1], tail)) { poly.push(segs[k][0]); used[k] = 1; found = true; break; }
      }
      if (!found) break;
    }
    if (poly.length >= 4 && near(poly[0], poly[poly.length - 1])) { poly.pop(); return poly; }
    return null;
  }

  /* DXF → { ok, walls:[{len,angle}], warnings:[], error } */
  function wallsFromDxf(text, opts) {
    var P = parseDxf(text), warnings = [];
    if (P.error) return { ok: false, error: P.error };
    var ents = P.entities, cands = [], bulge = false;
    ents.forEach(function (e) {
      if (e.type === "LINE") return;
      if (e.v.length >= 3 && (e.flags & 1)) { cands.push(e.v); if (e.bulges.some(function (b) { return b; })) bulge = true; }
    });
    var poly = null;
    if (cands.length) poly = cands.sort(function (a, b) { return area(b) - area(a); })[0];
    if (!poly) poly = chainLines(ents.filter(function (e) { return e.type === "LINE"; }), 1);
    if (!poly) {
      /* o polilinie deschisă ale cărei capete se ating */
      var open = ents.filter(function (e) { return e.type !== "LINE" && e.v.length >= 4; })
        .sort(function (a, b) { return b.v.length - a.v.length; })[0];
      if (open && Math.hypot(open.v[0].x - open.v[open.v.length - 1].x, open.v[0].y - open.v[open.v.length - 1].y) <= 1)
        poly = open.v.slice(0, -1);
    }
    if (!poly || poly.length < 3) return { ok: false, error: "nocontour" };
    if (bulge) warnings.push("arc");
    var scale = (opts && opts.unitScale) || (P.units != null && INSUNITS[P.units]) || 1;
    if (P.units == null) warnings.push("units");
    /* y în jos, ca pe ecran: planul arată ca în programul de desen */
    var pts = poly.map(function (p) { return { x: p.x * scale, y: -p.y * scale }; });
    /* puncte duble */
    pts = pts.filter(function (p, i) { var q = pts[(i + pts.length - 1) % pts.length]; return Math.hypot(p.x - q.x, p.y - q.y) > 0.5; });
    /* colțuri de 180°: un perete, nu doi */
    var merged = true;
    while (merged && pts.length > 3) {
      merged = false;
      for (var i = 0; i < pts.length; i++) {
        var a = pts[(i + pts.length - 1) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
        var cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
        var dot = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y);
        if (Math.abs(Math.atan2(cross, dot)) < 0.5 * DEG) { pts.splice(i, 1); merged = true; break; }
      }
    }
    if (pts.length < 3) return { ok: false, error: "nocontour" };
    var n = pts.length;
    function turnAt(k) {      // virajul în vârful k, în sensul parcurgerii
      var a = pts[(k + n - 1) % n], b = pts[k], c = pts[(k + 1) % n];
      return Math.atan2((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x), (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y));
    }
    var sum = 0, k;
    for (k = 0; k < n; k++) sum += turnAt(k);
    if (sum < 0) { pts.reverse(); }
    /* primul perete pornește din vârful 0 spre vârful 1 */
    var walls = [];
    for (k = 0; k < n; k++) {
      var p = pts[k], q = pts[(k + 1) % n];
      walls.push({ len: Math.round(Math.hypot(q.x - p.x, q.y - p.y)), angle: Math.round((180 - turnAt((k + 1) % n) / DEG) * 100) / 100 });
    }
    /* verificare: refăcut din pereți, conturul trebuie să se închidă */
    var cl = closure(walls.map(function (w) { return { len: w.len, angle: w.angle }; }));
    if (cl.gap > 0.5 * n + 5) warnings.push("gap");
    return { ok: true, walls: walls, warnings: warnings, units: P.units, scale: scale, gap: cl.gap };
  }

  /* Tavan înclinat din cele trei înălțimi măsurate (D-86, D-88). Punctul 1 e capătul de la început al
     peretelui (stânga, sau fața la pantă pe adâncime), punctul 3 capătul opus (dreapta, sau spatele); punctul 2
     rămâne de control. `joc` se scade din fiecare cotă. Întoarce null dacă nu s-a ales nicio pantă, altfel
     {axis, h0, h1, H} sau {error:"points"|"flat"}. PURĂ. */
  function slopeProposal(sv, opts) {
    var o = opts || {}, joc = o.joc == null ? 20 : +o.joc, minDiff = o.minDiff == null ? 20 : +o.minDiff;
    var ax = sv && sv.slope;
    if (ax !== "x" && ax !== "z") return null;
    var hs = (sv.heights || []), a = hs[0], b = hs[2];
    if (a == null || b == null || !(isFinite(a) && +a > 0 && isFinite(b) && +b > 0)) return { error: "points" };
    var h0 = Math.round(a - joc), h1 = Math.round(b - joc);
    if (Math.abs(h0 - h1) < minDiff) return { error: "flat", diff: Math.abs(a - b) };
    return { axis: ax, h0: h0, h1: h1, H: Math.max(h0, h1) };
  }
  /* diferența dintre punctele 1 și 3 când e destul de mare ca tavanul să pară înclinat și nu s-a ales nicio pantă;
     altfel null. Pentru sugestia din ecran. */
  function slopeSuggest(sv, minDiff) {
    if (!sv || sv.slope === "x" || sv.slope === "z") return null;
    var hs = sv.heights || [], a = hs[0], b = hs[2];
    if (a == null || b == null || !(isFinite(a) && isFinite(b))) return null;
    var d = Math.abs(a - b);
    return d >= (minDiff == null ? 20 : +minDiff) ? d : null;
  }

  root.EBSurvey = { slopeProposal: slopeProposal, slopeSuggest: slopeSuggest, planPoints: planPoints, closure: closure, closingWall: closingWall, diagonal: diagonal,
                    wallsFromDxf: wallsFromDxf, parseDxf: parseDxf };
  if (typeof module !== "undefined" && module.exports) module.exports = root.EBSurvey;
})(typeof globalThis !== "undefined" ? globalThis : this);
