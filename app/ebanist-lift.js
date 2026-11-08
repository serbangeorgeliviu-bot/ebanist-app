/* Ebanist — somiera ridicabilă pe pistoane cu gaz (D-126). Partea PURĂ: fără DOM, milimetri și kilograme. Alege geometria prinderii pistoanelor și
 * forța lor din greutatea somierei și a saltelei.
 *
 * Construcția (cerută de Liviu, 08.11.2026): balamale la capul patului, somiera se ridică la picioare, câte un piston pe fiecare lateral; sub somieră e o
 * ladă cu fundul ei. Nu există o fișă publică cu cote pentru seturile de ridicare (diferă de la producător la producător): geometria o alege acest
 * modul din fizică, iar rezultatul rămâne `verificat:false` până se încearcă pe un pat real.
 *
 * Sistem de coordonate (în plan vertical, pe lungimea patului): origine = axa balamalei; z spre picioare, y în sus; planul somierei = y 0 (fața de sus).
 *   A = prinderea pistonului pe somieră, la (p, −aDepth)          — se rotește cu somiera
 *   B = prinderea pistonului pe peretele lateral al ladei, la (zb, −hb) — fixă
 * Somiera se rotește cu unghiul α în jurul axei (sens: picioarele în sus). Forța pistonului pe somieră are brațul b(α) față de axă.
 * Pistonul (forța nominală F, același în tot cursul: aproximare prudentă) trebuie să țină somiera deschisă la orice unghi din [αmin, αmax]:
 *      2·F·b(α) ≥ 1,1 · M·g · (a·cos α − hcg·sin α)       (a = brațul greutății, hcg = înălțimea centrului de greutate peste plan)
 * și să nu o împingă singur în sus când e închisă: 2·F·b(0) < M·g·a.
 * Sursele metodei: ghidul de dimensionare al pistoanelor de pat (principiul pârghiei, +10 % rezervă, împărțit la două) și datele seturilor comerciale
 * (800–1200 N pe piston la 90–200 cm, cursă 200–360 mm).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EBLift = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var G = 9.81, RAD = Math.PI / 180;
  /* forțe nominale comerciale de piston, N (cea mai apropiată în sus) și curse standard, mm */
  var RATINGS = [100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000, 1100, 1200, 1300, 1500];
  var STROKES = [100, 150, 200, 250, 300, 350, 400];

  function Apt(p, ad, a) { var c = Math.cos(a), s = Math.sin(a), z = p, y = -ad; return [z * c - y * s, z * s + y * c]; }
  /* brațul forței pistonului față de axă și lungimea lui, la unghiul α (rad) */
  function lever(p, ad, zb, hb, a) {
    var A = Apt(p, ad, a), dz = A[0] - zb, dy = A[1] + hb, L = Math.hypot(dz, dy);
    var uz = dz / L, uy = dy / L;
    return { b: A[0] * uy - A[1] * uz, L: L };
  }

  /* o.mass (kg, saltea + somieră), o.Lf (mm, de la axă la capătul dinspre picioare al somierei), o.aDepth (mm, prinderea de pe somieră sub planul ei),
     o.wallTop (mm, cât coboară marginea ladei sub plan), o.boxBottom (mm, cât de jos se poate pune prinderea de pe perete), o.alphaMax (grade, implicit 45),
     o.hcg (mm, implicit 80). Întoarce { ok, … } cu cea mai bună geometrie (forța necesară cea mai mică) sau { ok:false, why }. */
  function design(o) {
    var r = design1(o, o.refMass || 60);
    /* geometria aleasă cu greutatea de referință poate fi prea slabă pentru o greutate mult mai mare: se reia căutarea cu greutatea reală */
    if (r.ok && r.warn.indexOf("tooHeavy") >= 0 && Math.abs(o.mass - (o.refMass || 60)) > 1) { var r2 = design1(o, o.mass); if (r2.ok) return r2; }
    return r;
  }
  function design1(o, Mr) {
    var M = o.mass, Lf = o.Lf, ad = o.aDepth, wallTop = o.wallTop, boxBottom = o.boxBottom, amax = (o.alphaMax || 45) * RAD, amin = 20 * RAD, hcg = o.hcg == null ? 80 : o.hcg;
    if (!(M > 0)) return { ok: false, why: "mass" };
    if (!(Lf > 600)) return { ok: false, why: "short" };
    var a = Lf / 2, W = M * G * a, best = null, Wr = Mr * G * a;   /* geometria se alege cu o greutate de referință: depinde doar de patul */
    for (var p = 200; p <= Math.min(0.55 * Lf, 800); p += 25) {
      for (var zb = Math.max(100, p - 400); zb <= p + 300; zb += 25) {
        for (var hb = wallTop + 25; hb <= boxBottom; hb += 25) {
          var L0 = lever(p, ad, zb, hb, 0).L, Lm = lever(p, ad, zb, hb, amax).L, stroke = Lm - L0, ok = stroke >= 90 && stroke <= 360 && L0 >= 100 && Lm / L0 <= 2.6;
          if (!ok) continue;
          var Freq = 0, mono = true, prev = L0, bmin = 1e9, al;
          for (al = amin; al <= amax + 1e-9; al += 2 * RAD) {
            var lv = lever(p, ad, zb, hb, al);
            if (lv.L < prev - 1e-6) { mono = false; break; }
            prev = lv.L;
            if (lv.b < 40) { Freq = Infinity; break; }
            var f = 1.1 * Mr * G * (a * Math.cos(al) - hcg * Math.sin(al)) / (2 * lv.b);
            if (f > Freq) Freq = f; if (lv.b < bmin) bmin = lv.b;
          }
          if (!mono || !isFinite(Freq)) continue;
          var b0 = lever(p, ad, zb, hb, 0).b;
          /* cursa standard cea mai apropiată, cu 10 mm de rezervă la capătul de cursă */
          var std = null; for (var si = 0; si < STROKES.length; si++) if (STROKES[si] >= stroke + 10) { std = STROKES[si]; break; }
          if (!std) continue;
          /* forța comercială care acoperă necesarul; cu ea, pistoanele preiau r0 din greutatea somierei când e închisă: nu mai mult de 90 % (altfel o împing
             singure în sus), ideal ~65 % (se ridică ușor și nu sare dacă salteaua e mai ușoară decât s-a trecut) */
          var Fs = null; for (var ri = 0; ri < RATINGS.length; ri++) if (RATINGS[ri] >= Freq) { Fs = RATINGS[ri]; break; }
          var r0 = Fs == null ? 1 : 2 * Fs * b0 / Wr;
          if (r0 >= 0.9) continue;
          var score = Math.abs(r0 - 0.65) + (Fs == null ? 10 : 0);
          if (!best || score < best.score - 1e-9 || (Math.abs(score - best.score) < 1e-9 && Freq < best.Freq)) {
            best = { p: p, zb: zb, hb: hb, Freq: Freq, stroke: stroke, std: std, Lc: L0, Le: Lm, bmin: bmin, b0: b0, r0: r0, score: score, b45: lever(p, ad, zb, hb, 45 * RAD).b };
          }
        }
      }
    }
    if (!best) return { ok: false, why: "geometry" };
    /* forța pentru greutatea reală, pe geometria aleasă: maximul necesarului pe unghiurile 20°…αmax */
    var Freal = 0, al2;
    for (al2 = amin; al2 <= amax + 1e-9; al2 += 2 * RAD) {
      var lv2 = lever(best.p, ad, best.zb, best.hb, al2), f2 = 1.1 * M * G * (a * Math.cos(al2) - hcg * Math.sin(al2)) / (2 * lv2.b);
      if (f2 > Freal) Freal = f2;
    }
    best.Freq = Freal;
    var Fsel = null; for (var rj = 0; rj < RATINGS.length; rj++) if (RATINGS[rj] >= Freal) { Fsel = RATINGS[rj]; break; }
    var warn = [];
    if (Fsel == null) { Fsel = RATINGS[RATINGS.length - 1]; warn.push("tooHeavy"); }
    best.r0 = 2 * Fsel * best.b0 / W;
    var closedPush = best.r0 >= 0.9;                       // pistoanele ar împinge somiera în sus singure când e închisă
    if (closedPush) warn.push("closedPush");
    return { ok: true, mass: M, a: a, Lf: Lf, aDepth: ad, wallTop: wallTop,
             A: { z: best.p, depth: ad }, B: { z: best.zb, depth: best.hb }, stroke: best.stroke, strokeStd: best.std, Lc: best.Lc, Le: best.Le,
             Freq: best.Freq, F: Fsel, b0: best.b0, r0: best.r0, b45: best.b45, bmin: best.bmin, alphaMax: amax / RAD, torqueWeight: W, closedPush: closedPush, warn: warn };
  }

  return { design: design, lever: lever, RATINGS: RATINGS, STROKES: STROKES, G: G };
});
