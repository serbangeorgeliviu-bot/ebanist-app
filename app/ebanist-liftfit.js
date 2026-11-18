/* Ebanist — U.16: mecanisme de ridicare pentru uși care se deschid în sus (basculante). PUR: fără DOM, fără stare.
 *
 * Datele vin din EBLiftData (ebanist-lift-data.js, generat din documente oficiale Blum / Hettich / Häfele; ce nu e citit = null).
 * Nimic de aici nu e „verificat”: alegerea mecanismului e o ORIENTARE din tabelul producătorului — în zonele de graniță
 * producătorii recomandă probă; răspunsul „se potrivește” nu înlocuiește fișa lor.
 *
 *   EBLiftFit.list() / .get(key)
 *   EBLiftFit.doorKg(h, w, th, dens)           greutatea unei uși, kg (mm, mm, mm, kg/m³)
 *   EBLiftFit.fit(sys, d)                      d = { kh, h, w, kg, wi, depth }  →  { issues, power, ok }
 *     kh   înălțimea interioară a corpului, mm (cota din tabelele producătorilor)
 *     h, w înălțimea și lățimea frontului, mm
 *     kg   greutatea frontului (cu mâner), kg
 *     wi   lățimea interioară, mm · depth adâncimea interioară, mm · servo true = cu SERVO-DRIVE (Blum)
 *   issues[] = { k: "kh"|"w"|"kg"|"hi"|"wi"|"depth", v, lo, hi }   (cele din afara limitelor citite)
 *   power    = { code, desc, kind } sau null (nicio variantă de forță nu acoperă ușa)
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.EBLiftFit = factory(root);
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";
  function systems() { return (root.EBLiftData && root.EBLiftData.systems) || []; }
  function list() { return systems().slice(); }
  function get(key) { var a = systems(); for (var i = 0; i < a.length; i++) if (a[i].key === key) return a[i]; return null; }
  function doorKg(h, w, th, dens) { return (+h > 0 && +w > 0 && +th > 0 && +dens > 0) ? h * w * th * dens / 1e9 : 0; }
  function inR(v, lo, hi) { return (lo == null || v >= lo) && (hi == null || v <= hi); }

  /* limitele citite (null = necitit, nu se verifică) */
  function limitIssues(sys, d) {
    var L = sys.limits || {}, out = [];
    function chk(k, v, lo, hi) { if (v > 0 && !inR(v, lo, hi)) out.push({ k: k, v: Math.round(v * 100) / 100, lo: lo == null ? null : lo, hi: hi == null ? null : hi }); }
    var khv = (sys.select && sys.select.axis === "flapH") ? (d.h || d.kh) : d.kh;   // Häfele Free flap: limita e pe înălțimea clapei
    if (L.cabH) chk("kh", khv, L.cabH[0], L.cabH[1]);
    if (L.cabW && d.w) chk("w", d.w, L.cabW[0], L.cabW[1]);
    if (L.kg && d.kg) chk("kg", d.kg, L.kg[0], L.kg[1]);
    if (L.hiMin != null && d.kh > 0 && d.kh < L.hiMin) out.push({ k: "hi", v: d.kh, lo: L.hiMin, hi: null });
    if (L.wiMin != null && d.wi > 0 && d.wi < L.wiMin) out.push({ k: "wi", v: d.wi, lo: L.wiMin, hi: null });
    var dmin = (d.servo && sys.servo && sys.servo.depthMin != null) ? sys.servo.depthMin : L.depthMin;   // cu SERVO-DRIVE spațiul cerut crește (Blum HK top: 187 → 235 mm)
    if (dmin != null && d.depth > 0 && d.depth < dmin) out.push({ k: "depth", v: d.depth, lo: dmin, hi: null });
    return out;
  }

  /* intervalul unui model dintr-un tabel pe înălțimi: între două rânduri vecine se ia intersecția (cel mai îngust) — nu se interpolează */
  function gridRange(points, h) {
    if (!points.length || h < points[0][0] || h > points[points.length - 1][0]) return null;
    var lo = null, hi = null;
    for (var i = 0; i < points.length; i++) {
      if (points[i][0] === h) return [points[i][1], points[i][2]];
      if (points[i][0] > h) { var a = points[i - 1], b = points[i]; lo = Math.max(a[1], b[1]); hi = Math.min(a[2], b[2]); break; }
    }
    return lo != null && lo <= hi ? [lo, hi] : null;
  }

  /* între variantele care acoperă ușa: «strongest» (Blum, Hettich: sursele spun să se ia cea mai puternică) sau «center» (intervalul cu centrul cel mai
     aproape de greutate — alegerea aplicației, când sursa nu dă regulă; Häfele) */
  function pick(S, cands, kg) {
    if (!cands.length) return null;
    if (S.overlap === "center") { var b = cands[0]; cands.forEach(function (c) { if (Math.abs(kg - (c.lo + c.hi) / 2) < Math.abs(kg - (b.lo + b.hi) / 2)) b = c; }); return b.p; }
    return cands[cands.length - 1].p;
  }
  /* varianta de forță: cea mai puternică din cele care acoperă ușa (regula producătorilor în suprapuneri) */
  function power(sys, d) {
    var S = sys.select, best = null, h = S.axis === "flapH" ? (d.h || d.kh) : d.kh, kg = d.kg;
    if (!(h > 0) || !(kg > 0)) return null;
    if (S.type === "LF") {
      var lf = h * kg, f = S.pairFactor || 1;
      /* în suprapuneri sursele nu dau o regulă pentru LF (se recomandă probă): aici, intervalul cu centrul cel mai aproape de LF — alegerea aplicației, nu a producătorului */
      var dist = Infinity;
      S.rows.forEach(function (r) {
        var lo = r.lo * f, hi = r.hi * f, dd = Math.abs(lf - (lo + hi) / 2);
        if (lf >= lo && lf <= hi && dd < dist) { dist = dd; best = { code: r.code, desc: "LF " + Math.round(lf) + (f > 1 ? " (×" + f + ")" : ""), kind: r.tipon ? "tipon" : "std" }; }
      });
      if (best && S.extra && S.extra.leverArms) S.extra.leverArms.forEach(function (a) { if (h >= a.khLo && h <= a.khHi) best.code += " + braț " + a.code; });
      return best;
    }
    if (S.type === "KHKG") {
      var ck = [];
      S.rows.forEach(function (r) { if (h >= r.khLo && h <= r.khHi && kg >= r.kgLo && kg <= r.kgHi) ck.push({ lo: r.kgLo, hi: r.kgHi, p: { code: r.code, desc: "KH " + h + " · " + kg + " kg", kind: "std" } }); });
      return pick(S, ck, kg);
    }
    if (S.type === "GRID") {
      var cg = [];
      S.models.forEach(function (m) { var r = gridRange(m.points, h); if (r && kg >= r[0] && kg <= r[1]) cg.push({ lo: r[0], hi: r[1], p: { code: (m.id + (m.code ? " " + m.code : "")), desc: "h " + h + " · " + kg + " kg", kind: "std" } }); });
      return pick(S, cg, kg);
    }
    if (S.type === "springs") {
      var set = null;
      S.sets.forEach(function (s) { if (h >= s.hLo && h <= s.hHi) set = s; });
      if (!set) return null;
      S.springs.forEach(function (sp) { sp.ranges.forEach(function (r) { if (h >= r.hLo && h <= r.hHi && kg >= r.kgLo && kg <= r.kgHi) best = { code: set.code + " + " + sp.code, desc: sp.N + " N · " + kg + " kg", kind: "std" }; }); });
      return best;
    }
    return null;
  }

  function fit(sys, d) {
    if (!sys) return { issues: [], power: null, ok: false };
    var issues = limitIssues(sys, d), p = power(sys, d);
    return { issues: issues, power: p, ok: !issues.length && !!p };
  }

  return { list: list, get: get, doorKg: doorKg, fit: fit, power: power, gridRange: gridRange };
});
