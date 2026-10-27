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

  /* ---------- boiserie cu rame și câmpuri (D-97) ----------
     Pe un suport (câmpul) se aplică o grilă de rame: n+1 montanți pe verticală (cât înălțimea), iar între ei,
     pe orizontală, m+1 traverse pe fiecare coloană. Într-o direcție: (n+1)·ramă + n·câmp = lungimea, EXACT,
     cu câmpul în mm întregi; restul (0…n−1 mm) îl iau cele două rame de capăt, ca nimic să nu rămână în aer. */
  LIM.rfW = [20, 200]; LIM.rfFieldMin = 40; LIM.rfTarget = [100, 1500]; LIM.rfRows = [1, 8];

  /* panoul încastrat în ramă (D-100): panoul intră în canal pe toate cele patru laturi cu `gd` mm; canalul e în rame,
     lat cât grosimea panoului. Valorile sunt date generice, `verificat:false`, de confirmat pe o ramă reală. */
  var INSET = { gd: 8, minLeft: 3, verificat: false };
  /* verifică că panoul (grosime tp) încape în rama de grosime tf și lățime fw: rămâne cel puțin `minLeft` mm de fiecare parte */
  function insetOk(fw, tf, tp) {
    return tp > 0 && tf - tp >= 2 * INSET.minLeft && fw - INSET.gd >= 2 * INSET.minLeft;
  }
  /* găurile unui panou din câmpul [fa..fb] × [ya..yb] (în mm de perete), cu panoul mărit cu gd pe fiecare latură;
     în sistemul panoului: lung = pe verticală, larg = pe orizontală (ca la suport) */
  function panelHoles(fa, fb, ya, yb, cuts) {
    var gd = INSET.gd, a = fa - gd, b = fb + gd, y0 = ya - gd, y1 = yb + gd, out = [];
    cuts.forEach(function (c) {
      var x0 = Math.max(c.x, a), x1 = Math.min(c.x + c.w, b), v0 = Math.max(c.y, y0), v1 = Math.min(c.y + c.h, y1);
      if (x1 - x0 > 1e-9 && v1 - v0 > 1e-9) out.push({ l: v1 - v0, w: x1 - x0, x: v0 - y0, y: x0 - a, forma: "R", r: 0, tip: "priza", rif: "sus" });
    });
    return out;
  }

  /* o direcție, cu n câmpuri date: întoarce { ok, n, field, strips:[{a,b}], fields:[{a,b}] } */
  function frameN(span, fw, n) {
    span = Math.round(span); fw = Math.round(fw); n = Math.round(n);
    if (!(span > 0) || !(fw >= LIM.rfW[0] && fw <= LIM.rfW[1]) || !(n >= 1)) return { ok: false, reason: "dim" };
    var field = Math.floor((span - (n + 1) * fw) / n);
    if (!(field >= LIM.rfFieldMin)) return { ok: false, reason: "tooSmall" };
    var r = span - (n + 1) * fw - n * field, ea = Math.floor(r / 2), eb = r - ea, strips = [], fields = [], x = 0, i;
    for (i = 0; i <= n; i++) {
      var sw = fw + (i === 0 ? ea : 0) + (i === n ? eb : 0);
      strips.push({ a: x, b: x + sw }); x += sw;
      if (i < n) { fields.push({ a: x, b: x + field }); x += field; }
    }
    return { ok: true, n: n, field: field, extraA: ea, extraB: eb, strips: strips, fields: fields, span: span, fw: fw };
  }
  /* n cel mai apropiat de lățimea dorită a câmpului; scade dacă nu încape câmpul minim */
  function frameFit(span, fw, target) {
    span = +span; fw = +fw; target = +target;
    if (!(target >= LIM.rfTarget[0] && target <= LIM.rfTarget[1])) return { ok: false, reason: "dim" };
    var n = Math.max(1, Math.round((span - fw) / (target + fw)));
    var r = frameN(span, fw, n);
    while (!r.ok && r.reason === "tooSmall" && n > 1) { n--; r = frameN(span, fw, n); }
    return r;
  }

  /* ---------- colț între doi pereți (D-98) ----------
     Peretele A e cel din față; B e peretele de la colț, pe partea `side` (dx = la capătul din dreapta, sx = la stânga),
     `kind` int (colț de cameră) sau ext (colț ieșit). Grosimea totală t (suport + lamelă/ramă) se scade din B la colțul
     interior: placarea lui B începe la fața placării lui A. B se măsoară de la colț (x local = distanța de la colț). */

  /* decupajele pe pereți: `wall:"B"` merg la B, restul la A; la colțul interior x-ul din B se dă de la colț (planul
     peretelui A) și se mută cu t în sistemul placării. Întoarce { A:[...], B:[...] } sau { ok:false, reason } */
  function splitCuts(raw, t, kind) {
    var A = [], B = [];
    (Array.isArray(raw) ? raw : []).forEach(function (c) {
      if (c && c.wall === "B") { var d = {}; for (var k in c) d[k] = c[k]; d.x = Math.round(+c.x) - (kind === "ext" ? 0 : Math.round(t)); B.push(d); }
      else A.push(c);
    });
    for (var i = 0; i < B.length; i++) if (!(B[i].x >= 0)) return { ok: false, reason: "cutCorner" };
    return { ok: true, A: A, B: B };
  }

  /* cutiile lui B din sistemul local (x de la colț, z adâncime) în sistemul modulului; apoi totul se mută în octantul pozitiv */
  function cornerPlace(boxesB, o) {
    var t = o.t;
    /* (x0,x1,z0,z1) locale → modulul: întoarce { x0,x1,z0,z1 } */
    function map(x0, x1, z0, z1) {
      var r = {};
      if (o.kind === "ext") {
        r.z0 = x0; r.z1 = x1;
        if (o.side === "sx") { r.x0 = -z1; r.x1 = -z0; } else { r.x0 = o.LA + z0; r.x1 = o.LA + z1; }
      } else {
        r.z0 = t + x0; r.z1 = t + x1;
        if (o.side === "sx") { r.x0 = z0; r.x1 = z1; } else { r.x0 = o.LA - z1; r.x1 = o.LA - z0; }
      }
      return r;
    }
    return boxesB.map(function (b) {
      var c = {}; for (var k in b) c[k] = b[k];
      var m = map(b.x0, b.x1, b.z0, b.z1); c.x0 = m.x0; c.x1 = m.x1; c.z0 = m.z0; c.z1 = m.z1;
      /* dreptunghiul întreg al panoului (`ph` = [x0,x1,y0,y1,z0,z1]) se mută la fel */
      if (b.ph) { var q = map(b.ph[0], b.ph[1], b.ph[4], b.ph[5]); c.ph = [q.x0, q.x1, b.ph[2], b.ph[3], q.z0, q.z1]; }
      return c;
    });
  }
  function shiftToOrigin(boxes) {
    var mx = 0, mz = 0;
    boxes.forEach(function (b) { mx = Math.min(mx, b.x0); mz = Math.min(mz, b.z0); });
    if (mx === 0 && mz === 0) return boxes;
    boxes.forEach(function (b) { b.x0 -= mx; b.x1 -= mx; b.z0 -= mz; b.z1 -= mz; if (b.ph) b.ph = [b.ph[0] - mx, b.ph[1] - mx, b.ph[2], b.ph[3], b.ph[4] - mz, b.ph[5] - mz]; });
    return boxes;
  }

  return { LIM: LIM, layout: layout, closure: closure, backSheets: backSheets, normCuts: normCuts, splitEq: splitEq, slatPlan: slatPlan, sheetHoles: sheetHoles, frameN: frameN, frameFit: frameFit, INSET: INSET, insetOk: insetOk, panelHoles: panelHoles, splitCuts: splitCuts, cornerPlace: cornerPlace, shiftToOrigin: shiftToOrigin };
});
