/* ebanist-elab.js — foaia A3 de prospecte și secțiuni a unui corp (Elaborat
 * tehnic, pasul 2): prospect frontal, secțiune verticală A–A, plan C–C,
 * cu hașuri pe materialul tăiat și cote în lanț.
 *
 * Funcție pură: primește cutiile modelului (aceleași din buildModule, nimic
 * recalculat aici) și întoarce un SVG de 420 × 297 mm. Textele vin prin
 * `o.tr(cheie)`, deci limba e a meniului. Folosește cartușul și lanțurile de
 * cote din ebanist-sheet.js (EBSheet).
 *
 * Convenții: x = lățime, y = înălțime de la podea, z = adâncime (0 = spate,
 * fața la z mare). Secțiunea A–A se privește dinspre dreapta spre stânga,
 * deci fața dulapului e în STÂNGA desenului; planul C–C se privește de sus,
 * fața e jos.
 */
(function (root) {
  "use strict";
  var E = root.EBSheet;
  if (!E) throw new Error("ebanist-elab.js cere ebanist-sheet.js");
  var M = E.M, TB_Y = E.TB_Y, COL_X = E.COL_X, PW = E.PW, INK = E.INK;
  var tx = E.tx, ln = E.ln, f = E.f, r1 = E.r1, esc = E.esc;
  var SCALES = [5, 8, 10, 15, 20, 25, 30, 40, 50, 75, 100];
  var EPS = 0.6;

  var HOR = { base: 1, cielo: 1, base_cielo: 1, ripiano: 1, traversa_cielo: 1, blat: 1 };
  /* ce hașură poartă o cutie tăiată */
  function classify(b) {
    if (b.kind === "g") return "glass";
    if (b.kind === "m") return "metal";
    if (b.kind === "f") return "door";
    if (b.role === "schienale") return "back";
    return "body";
  }

  function bounds(boxes) {
    var lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    boxes.forEach(function (b) {
      lo[0] = Math.min(lo[0], b.x0); hi[0] = Math.max(hi[0], b.x1);
      lo[1] = Math.min(lo[1], b.y0); hi[1] = Math.max(hi[1], b.y1);
      lo[2] = Math.min(lo[2], b.z0); hi[2] = Math.max(hi[2], b.z1);
    });
    return { lo: lo, hi: hi };
  }

  /* planurile de tăiere: la mijlocul celei mai late coloane (A–A) și la
     mijlocul celui mai înalt gol din ea (C–C) — acolo se vede tot ce contează */
  function cutPlanes(boxes) {
    var bb = bounds(boxes), carc = boxes.filter(function (b) { return b.kind === "p" && b.sub !== "dbox"; });
    var vert = carc.filter(function (b) { return (b.role === "fianco" || b.role === "divisorio") && (b.x1 - b.x0) <= 40 && (b.x1 - b.x0) < (b.y1 - b.y0); })
      .sort(function (a, c) { return a.x0 - c.x0; });
    var xs = [bb.lo[0]], cols = [], xcut = (bb.lo[0] + bb.hi[0]) / 2;
    vert.forEach(function (b) { if (b.x0 > xs[xs.length - 1] + 1) cols.push([xs[xs.length - 1], b.x0]); xs.push(Math.max(xs[xs.length - 1], b.x1)); });
    if (bb.hi[0] > xs[xs.length - 1] + 1) cols.push([xs[xs.length - 1], bb.hi[0]]);
    var best = cols.slice().sort(function (a, c) { return (c[1] - c[0]) - (a[1] - a[0]); })[0];
    if (best) xcut = (best[0] + best[1]) / 2;
    /* golurile în coloana tăiată: între fețele panourilor orizontale */
    var hor = carc.filter(function (b) { return HOR[b.role] && (b.y1 - b.y0) <= 40 && (b.y1 - b.y0) < (b.x1 - b.x0) && b.x0 < xcut && b.x1 > xcut; })
      .sort(function (a, c) { return a.y0 - c.y0; });
    var cur = bb.lo[1], gaps = [];
    hor.forEach(function (b) { if (b.y0 - cur > 20) gaps.push([cur, b.y0]); cur = Math.max(cur, b.y1); });
    if (bb.hi[1] - cur > 20) gaps.push([cur, bb.hi[1]]);
    var g = gaps.slice().sort(function (a, c) { return (c[1] - c[0]) - (a[1] - a[0]); })[0];
    var ycut = g ? (g[0] + g[1]) / 2 : (bb.lo[1] + bb.hi[1]) / 2;
    return { x: r1(xcut), y: r1(ycut) };
  }

  /* o vedere: întoarce {cut:[dreptunghiuri tăiate], vis:[vizibile]} în coordonate
     (u,v) de desen, v în jos. mode: "elev" | "secx" | "secy" */
  function project(boxes, mode, c, bb) {
    var out = { cut: [], vis: [] };
    var H = bb.hi[1], Z1 = bb.hi[2];
    boxes.forEach(function (b) {
      var k = classify(b), r;
      if (mode === "elev") { r = { u0: b.x0, u1: b.x1, v0: H - b.y1, v1: H - b.y0, k: k, z: (b.z0 + b.z1) / 2, b: b }; out.vis.push(r); return; }
      if (mode === "secx") {
        if (b.x0 >= c - EPS) return;                                   /* de partea privitorului: se scoate */
        r = { u0: Z1 - b.z1, u1: Z1 - b.z0, v0: H - b.y1, v1: H - b.y0, k: k, z: b.x1, b: b };
        (b.x1 > c + EPS ? out.cut : out.vis).push(r); return;
      }
      if (b.y0 >= c - EPS) return;                                     /* deasupra planului: se scoate */
      r = { u0: b.x0, u1: b.x1, v0: b.z0, v1: b.z1, k: k, z: b.y1, b: b };
      (b.y1 > c + EPS ? out.cut : out.vis).push(r);
    });
    out.vis.sort(function (a, c2) { return a.z - c2.z; });
    return out;
  }

  var HATCH = { body: "eh-body", back: "eh-back", door: "eh-door" };
  function defs() {
    return '<defs>' +
      '<pattern id="eh-body" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.4" height="2.4" fill="#fff"/><path d="M0 0H2.4" stroke="#222" stroke-width=".22"/></pattern>' +
      '<pattern id="eh-door" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="1.6" height="1.6" fill="#fff"/><path d="M0 0H1.6" stroke="#222" stroke-width=".22"/></pattern>' +
      '<pattern id="eh-back" width="1.8" height="1.8" patternUnits="userSpaceOnUse"><rect width="1.8" height="1.8" fill="#fff"/><circle cx=".9" cy=".9" r=".25" fill="#222"/></pattern>' +
      '</defs>';
  }
  function rectSvg(r, ox, oy, s, cut) {
    var x = ox + r.u0 * s, y = oy + r.v0 * s, w = Math.max((r.u1 - r.u0) * s, 0.25), h = Math.max((r.v1 - r.v0) * s, 0.25);
    var fill, stroke = INK, sw = cut ? 0.35 : 0.18, extra = "";
    if (cut) {
      fill = r.k === "glass" ? "#dbe9f4" : r.k === "metal" ? "#666" : "url(#" + HATCH[r.k] + ")";
      if (r.b && r.b.sub === "dbox") sw = 0.3;
    } else {
      fill = r.k === "glass" ? "#eef5fa" : r.k === "metal" ? "#bbb" : r.k === "door" ? "#fff" : "#f6f4ee";
      if (r.b && r.b.sub === "dbox") extra = ' stroke-dasharray="1.2 .6"';
      if (r.k === "door") sw = 0.35;
    }
    return '<rect x="' + r1(x) + '" y="' + r1(y) + '" width="' + r1(w) + '" height="' + r1(h) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"' + extra + "/>";
  }

  /* coordonatele (mm de la origine) ale fețelor pentru lanțurile de cote */
  function faceCoords(rects, axis, lo, hi, thin) {
    var c = [];
    rects.forEach(function (r) {
      var a = axis === "u" ? r.u0 : r.v0, b = axis === "u" ? r.u1 : r.v1, th = b - a, other = axis === "u" ? r.v1 - r.v0 : r.u1 - r.u0;
      if (th <= thin && th < other) { c.push(a - lo); c.push(b - lo); }
    });
    return E.uniq(c).filter(function (v) { return v > 0.05 && v < hi - lo - 0.05; });
  }

  /* o vedere desenată cu cote */
  function viewSvg(spec, ox, oy, s, title, den, doc) {
    var o = "";
    /* ordinea: vizibilele întâi, tăiatele deasupra */
    spec.items.vis.forEach(function (r) { o += rectSvg(r, ox, oy, s, false); });
    spec.items.cut.forEach(function (r) { o += rectSvg(r, ox, oy, s, true); });
    var W = spec.W, Hh = spec.H, all = spec.items.vis.concat(spec.items.cut), fs = 3;
    var cx = faceCoords(all, "u", 0, W, 40), cy = faceCoords(all, "v", 0, Hh, 40);
    /* lanț sus (u) și stânga (v, de jos în sus pentru y; pentru plan, de sus în jos) */
    o += '<g transform="translate(' + r1(ox) + " " + r1(oy) + ')">' + E.chainSvg(cx, W, s, 9, fs, null) + E.chainSvg([], W, s, 17, fs, null) + "</g>";
    var vflip = spec.vFromBottom;
    if (vflip) {
      var cyb = cy.map(function (v) { return Hh - v; }).sort(function (a, b) { return a - b; });
      o += '<g transform="translate(' + r1(ox) + " " + r1(oy + Hh * s) + ') rotate(-90)">' + E.chainSvg(cyb, Hh, s, 9, fs, null) + E.chainSvg([], Hh, s, 17, fs, null) + "</g>";
    } else {
      o += '<g transform="translate(' + r1(ox) + " " + r1(oy + Hh * s) + ') rotate(-90)">' + E.chainSvg(cy.map(function (v) { return Hh - v; }).sort(function (a, b) { return a - b; }), Hh, s, 9, fs, null) +
        E.chainSvg([], Hh, s, 17, fs, null) + "</g>";
    }
    o += tx(ox - 24, oy - 24, title, 4.4, { bold: true }) + tx(ox - 24 + doc.titleW, oy - 24, "1:" + den, 3.4, { fill: "#444" });
    return o;
  }

  function triangle(x, y, dir) {
    var d = { l: "M0 0L5 -1.8V1.8Z", r: "M0 0L-5 -1.8V1.8Z", d: "M0 0L-1.8 -5H1.8Z", u: "M0 0L-1.8 5H1.8Z" }[dir];
    return '<path d="' + d + '" transform="translate(' + r1(x) + " " + r1(y) + ')" fill="' + INK + '"/>';
  }

  /**
   * boxes — cutiile din buildModule
   * o     — { tr, meta:{company,project,client,name,matBody,matFront,matBack,tBody,tBack,date,ver}, sheetNo, sheetTot }
   */
  function elevationsSheetSVG(boxes, o) {
    var tr = o.tr, meta = o.meta || {};
    var bb = bounds(boxes), L = bb.hi[0] - bb.lo[0], H = bb.hi[1], P = bb.hi[2] - bb.lo[2];
    var cut = cutPlanes(boxes);
    var left = M + 6, top = M + 6, areaW = COL_X - left - 4, areaH = TB_Y - top - 6;
    var padL = 26, padT = 24, gap = 12;
    var fitW = areaW - 2 * padL - gap, fitH = areaH - padT - 8;
    var den = SCALES[SCALES.length - 1];
    for (var i = 0; i < SCALES.length; i++) if ((L + P) / SCALES[i] <= fitW && H / SCALES[i] <= fitH) { den = SCALES[i]; break; }
    var s = 1 / den;
    var svg = E.sheetOpen() + defs();
    var oyMain = top + padT + 4;
    var oxFront = left + padL, oxSec = oxFront + L * s + gap + padL;

    var present = {};
    boxes.forEach(function (b) { present[classify(b)] = 1; });

    /* prospect frontal + marcajele de tăiere */
    var front = { items: project(boxes, "elev", 0, bb), W: L, H: H, vFromBottom: true };
    svg += viewSvg(front, oxFront, oyMain, s, tr("eaViewFront"), den, { titleW: 44 });
    var xA = oxFront + (cut.x - bb.lo[0]) * s, yC = oyMain + (H - cut.y) * s, yB = oyMain + H * s;
    svg += ln(xA, oyMain - 6, xA, yB + 6, 0.3, INK, "6 1.2 1 1.2") + triangle(xA - 2, oyMain - 6, "l") + triangle(xA - 2, yB + 6, "l") +
      tx(xA + 1.5, oyMain - 7.5, "A", 4, { bold: true }) + tx(xA + 1.5, yB + 10.5, "A", 4, { bold: true });
    svg += ln(oxFront - 6, yC, oxFront + L * s + 6, yC, 0.3, INK, "6 1.2 1 1.2") + triangle(oxFront - 6, yC + 2, "d") + triangle(oxFront + L * s + 6, yC + 2, "d") +
      tx(oxFront - 9.5, yC + 1.4, "C", 4, { bold: true }) + tx(oxFront + L * s + 7.5, yC + 1.4, "C", 4, { bold: true });

    /* secțiunea A–A */
    var sec = { items: project(boxes, "secx", cut.x, bb), W: P, H: H, vFromBottom: true };
    svg += viewSvg(sec, oxSec, oyMain, s, tr("eaViewSect") + " A–A", den, { titleW: 48 });

    /* planul C–C: în golul din dreapta secțiunii, la aceeași scară dacă încape;
       altfel în coloana din dreapta, la propria scară */
    var xAfter = oxSec + P * s + gap + padL, availMid = COL_X - 8 - xAfter, colW = PW - M - 3 - COL_X;
    var inMid = availMid >= 60, avail = inMid ? availMid : colW - 26 - 4, den2 = SCALES[SCALES.length - 1];
    for (var j = 0; j < SCALES.length; j++) if (SCALES[j] >= den && L / SCALES[j] <= avail && P / SCALES[j] <= (inMid ? fitH : 92)) { den2 = SCALES[j]; break; }
    if (!inMid || den2 < den) den2 = Math.max(den2, SCALES[0]);
    var s2 = 1 / den2, oxP = inMid ? xAfter : COL_X + 26, oyP = top + padT + 4;
    var plan = { items: project(boxes, "secy", cut.y, bb), W: L, H: P, vFromBottom: false };
    svg += viewSvg(plan, oxP, oyP, s2, tr("eaViewPlan") + " C–C", den2, { titleW: 40 });
    var yPb = oyP + P * s2;

    /* legenda hașurilor */
    var ly = inMid ? top + 12 : Math.max(yPb + 22, top + 120), items = [];
    if (present.body) items.push(["body", tr("eaBody"), meta.matBody, meta.tBody]);
    if (present.back) items.push(["back", tr("eaBack"), meta.matBack, meta.tBack]);
    if (present.door) items.push(["door", tr("eaDoor"), meta.matFront]);
    if (present.glass) items.push(["glass", tr("eaGlass")]);
    if (present.metal) items.push(["metal", tr("eaMetal")]);
    svg += tx(COL_X, ly, tr("eaLegend"), 3.6, { bold: true }); ly += 3;
    items.forEach(function (it) {
      var fill = it[0] === "glass" ? "#dbe9f4" : it[0] === "metal" ? "#666" : "url(#" + HATCH[it[0]] + ")";
      svg += '<rect x="' + COL_X + '" y="' + r1(ly) + '" width="12" height="6" fill="' + fill + '" stroke="' + INK + '" stroke-width=".3"/>';
      svg += tx(COL_X + 15, ly + 2.8, it[1], 2.8, { bold: true });
      var det = [it[2], it[3] ? it[3] + " mm" : ""].filter(Boolean).join(" · ");
      if (det) svg += tx(COL_X + 15, ly + 6, det.length > 52 ? det.slice(0, 51) + "…" : det, 2.4, { fill: "#333" });
      ly += 9;
    });
    svg += tx(COL_X, TB_Y - 8, tr("eaNote"), 2.5, { fill: "#333" });

    /* cartuș */
    var dims = f(L) + " × " + f(H) + " × " + f(P) + " mm";
    svg += E.titleBlock(
      [[70, tr("shCompany"), meta.company], [100, tr("shProject"), meta.project], [80, tr("shClient"), meta.client], [150, tr("eaUnit"), (meta.name || "") + "  " + dims, 5]],
      [[110, tr("shMat"), meta.matBody], [50, tr("shThk"), [meta.tBody, meta.tBack].filter(Boolean).join(" / ") + (meta.tBody ? " mm" : "")], [40, tr("shScale"), "1:" + den],
       [40, tr("shDate"), meta.date], [30, tr("shSheet"), (o.sheetNo || 1) + "/" + (o.sheetTot || 1)], [130, tr("shGen"), "Ebanist " + (meta.ver || "")]]);
    svg += tx(PW - M - 2, M + 4.5, tr("eaTitle"), 3.2, { anchor: "end", fill: "#555" });
    return svg + "</svg>";
  }

  var API = { elevationsSheetSVG: elevationsSheetSVG, cutPlanes: cutPlanes, project: project, classify: classify };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.EBElab = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
