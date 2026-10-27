/* =====================================================================
   Ebanist — lambriul cu lamele (partea pură, fără DOM; testată în
   test/lambriu.test.js). Același principiu ca la corp: gabaritul se
   recompune din piese, toleranță 0 (D-43).

   Lamelele (n bucăți de lățime w) se așază pe o lungime `span`, cu rosturi
   egale: n·w + (n−1)·rost = span, EXACT. Rostul se calculează o singură
   dată (nu în lanț) și poate fi fracționar; se rotunjește la 0,1 mm numai
   când se afișează. Distinta poartă lățimea lamelei (cota finită) și numărul.
   ===================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EBLambriu = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var LIM = { wMin: 10, wMax: 300, gapMin: 0, gapMax: 200, tightGap: 3 };

  /* span: lungimea pe care se așază lamelele (mm); w: lățimea unei lamele; gap: rostul dorit.
     Întoarce { ok, n, gap, xs[], span, warn[] } sau { ok:false, reason }.
     n e cel mai apropiat de rostul dorit; dacă nu încap nici cu rost 0, n scade. */
  function layout(span, w, gap) {
    span = +span; w = +w; gap = +gap;
    if (!(span > 0)) return { ok: false, reason: "span" };
    if (!(w >= LIM.wMin && w <= LIM.wMax)) return { ok: false, reason: "width" };
    if (!(gap >= LIM.gapMin && gap <= LIM.gapMax)) return { ok: false, reason: "gap" };
    if (w > span) return { ok: false, reason: "tooWide" };
    var n = Math.round((span + gap) / (w + gap));
    if (n < 1) n = 1;
    while (n > 1 && n * w > span) n--;
    var g = n > 1 ? (span - n * w) / (n - 1) : 0;
    var warn = [];
    if (n > 1 && g < LIM.tightGap) warn.push("tightGap");
    if (n > 1 && Math.abs(g - gap) > Math.max(2, gap * 0.25)) warn.push("gapShift");
    var xs = [], off = n === 1 ? (span - w) / 2 : 0;
    for (var i = 0; i < n; i++) xs.push(off + i * (w + g));
    return { ok: true, n: n, gap: g, xs: xs, span: span, w: w, warn: warn };
  }

  /* recompunere: n lamele + n−1 rosturi = span (toleranță de virgulă mobilă) */
  function closure(lay) {
    if (!lay || !lay.ok) return null;
    var sum = lay.n * lay.w + (lay.n > 1 ? (lay.n - 1) * lay.gap : 0), off = lay.n === 1 ? (lay.span - lay.w) : 0;
    return Math.abs(sum + off - lay.span) < 1e-9 || (lay.n === 1 && Math.abs(lay.xs[0] * 2 + lay.w - lay.span) < 1e-9);
  }

  /* suportul din foi: cu lungimea pe înălțime, lățimile egale în mm întregi, iar ultima preia restul,
     ca suma foilor să fie exact span. maxW = lățimea plăcii, maxLung = lungimea ei.
     Întoarce { ok, groups:[{larg, pz}], lung } sau { ok:false, reason } */
  function backSheets(spanW, spanH, maxLung, maxW) {
    spanW = Math.round(spanW); spanH = Math.round(spanH);
    if (!(spanW > 0 && spanH > 0)) return { ok: false, reason: "span" };
    if (spanH > maxLung) return { ok: false, reason: "tooTall" };
    var k = Math.max(1, Math.ceil(spanW / maxW)), a = Math.round(spanW / k);
    while (a * (k - 1) >= spanW && k > 1) k--;
    a = k === 1 ? spanW : Math.round(spanW / k);
    var last = spanW - a * (k - 1), groups = [];
    if (last === a || k === 1) groups.push({ larg: spanW - a * (k - 1), pz: k });
    else { groups.push({ larg: a, pz: k - 1 }); groups.push({ larg: last, pz: 1 }); }
    if (groups.some(function (g) { return g.larg > maxW || g.larg <= 0; })) return { ok: false, reason: "tooWide" };
    return { ok: true, groups: groups, lung: spanH };
  }

  /* ---------- v2 (D-96): decupaje (prize, întrerupătoare), lamele tăiate, lamele peste lungimea plăcii ----------
     Un decupaj e un dreptunghi pe perete: x de la stânga peretelui, y de la pardoseală, w pe orizontală, h pe verticală.
     Lamela se întrerupe pe lățimea ei întreagă acolo unde decupajul o atinge (se taie o lamelă, nu se face un crestat
     pe jumătate); suportul primește gaura exactă. Piesele rămase mai lungi decât placa se taie în părți egale. */
  LIM.maxCuts = 30; LIM.shortPiece = 30;

  function normCuts(raw, L, H) {
    if (raw == null || (Array.isArray(raw) && !raw.length)) return { ok: true, cuts: [] };
    if (!Array.isArray(raw) || raw.length > LIM.maxCuts) return { ok: false, reason: "cuts" };
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var c = raw[i] || {}, x = Math.round(+c.x), y = Math.round(+c.y), w = Math.round(+c.w), h = Math.round(+c.h);
      if (![x, y, w, h].every(isFinite)) return { ok: false, reason: "cuts" };
      if (w < 1 || h < 1 || x < 0 || y < 0 || x + w > L + 1e-9 || y + h > H + 1e-9) return { ok: false, reason: "cutBounds", at: i };
      out.push({ x: x, y: y, w: w, h: h });
    }
    return { ok: true, cuts: out };
  }

  /* părți egale de lungime întreagă, ultima preia restul: suma = total exact */
  function splitEq(total, maxLen) {
    if (!(total > 0)) return [];
    if (total <= maxLen + 1e-9) return [total];
    var k = Math.ceil(total / maxLen - 1e-9), a = Math.round(total / k), out = [], i;
    while (a * (k - 1) >= total && k > 1) k--;
    a = Math.round(total / k);
    for (i = 0; i < k - 1; i++) out.push(a);
    out.push(total - a * (k - 1));
    return out;
  }

  /* pentru fiecare lamelă: piesele rămase după decupaje și după tăierea la lungimea plăcii.
     Întoarce { slats:[{ v0, v1, pieces:[{u0,u1}] }], short } ; u = de-a lungul lamelei, v = pe stivă */
  function slatPlan(lay, horiz, L, H, cuts, maxLen) {
    var len = horiz ? L : H, slats = [], short = 0, splits = 0;
    for (var i = 0; i < lay.n; i++) {
      var v0 = lay.xs[i], v1 = v0 + lay.w, iv = [];
      cuts.forEach(function (c) {
        var cv0 = horiz ? c.y : c.x, cv1 = cv0 + (horiz ? c.h : c.w), cu0 = horiz ? c.x : c.y, cu1 = cu0 + (horiz ? c.w : c.h);
        if (Math.min(v1, cv1) - Math.max(v0, cv0) > 1e-9) iv.push([cu0, cu1]);
      });
      iv.sort(function (a, b) { return a[0] - b[0]; });
      var merged = [];
      iv.forEach(function (q) { var l = merged[merged.length - 1]; if (l && q[0] <= l[1] + 1e-9) l[1] = Math.max(l[1], q[1]); else merged.push([q[0], q[1]]); });
      var free = [], cur = 0;
      merged.forEach(function (q) { if (q[0] > cur + 1e-9) free.push([cur, q[0]]); cur = Math.max(cur, q[1]); });
      if (cur < len - 1e-9) free.push([cur, len]);
      var pieces = [];
      free.forEach(function (f) {
        var u = f[0];
        var parts = splitEq(f[1] - f[0], maxLen); if (parts.length > 1) splits++;
        parts.forEach(function (l) { pieces.push({ u0: u, u1: u + l }); u += l; if (l < LIM.shortPiece) short++; });
      });
      slats.push({ v0: v0, v1: v1, pieces: pieces });
    }
    return { slats: slats, len: len, short: short, splits: splits };
  }

  /* găurile unei foi de suport [a,b] (pe orizontala peretelui), în sistemul foii: lung = H (pe verticală), larg = lățimea foii */
  function sheetHoles(a, b, cuts) {
    var out = [];
    cuts.forEach(function (c) {
      var x0 = Math.max(c.x, a), x1 = Math.min(c.x + c.w, b);
      if (x1 - x0 > 1e-9) out.push({ l: c.h, w: x1 - x0, x: c.y, y: x0 - a, forma: "R", r: 0, tip: "priza", rif: "sus" });
    });
    return out;
  }

  return { LIM: LIM, layout: layout, closure: closure, backSheets: backSheets, normCuts: normCuts, splitEq: splitEq, slatPlan: slatPlan, sheetHoles: sheetHoles };
});
