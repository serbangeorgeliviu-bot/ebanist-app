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

  return { LIM: LIM, layout: layout, closure: closure, backSheets: backSheets };
});
