/* ebanist-doc.js — foile A3 de document ale elaboratului tehnic (pasul 4):
 * coperta cu cuprinsul și „cum se citește", prezentarea pentru client (randări
 * 3D, materiale, semnătură) și raportul tehnic (capitole-șablon).
 *
 * Funcții pure: primesc datele pregătite de aplicație și întorc un SVG de
 * 420 × 297 mm, cu cartușul comun din ebanist-sheet.js. Nu calculează nicio
 * cotă și nu scriu text liber: capitolele raportului vin deja asamblate din
 * șabloane traduse și din date ale modelului; modulul doar le așază.
 */
(function (root) {
  "use strict";
  var E = root.EBSheet;
  if (!E) throw new Error("ebanist-doc.js cere ebanist-sheet.js");
  var M = E.M, TB_Y = E.TB_Y, PW = E.PW, INK = E.INK;
  var tx = E.tx, f = E.f, r1 = E.r1, esc = E.esc;

  function wrap(s, max) {
    var words = String(s == null ? "" : s).split(/\s+/), out = [], cur = "";
    words.forEach(function (w) {
      if (cur && (cur + " " + w).length > max) { out.push(cur); cur = w; } else cur = cur ? cur + " " + w : w;
    });
    if (cur) out.push(cur);
    return out;
  }
  function clip(s, n) { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function img(src, x, y, w, h) {
    return '<image href="' + esc(src) + '" x="' + r1(x) + '" y="' + r1(y) + '" width="' + r1(w) + '" height="' + r1(h) + '" preserveAspectRatio="xMidYMid slice"/>';
  }
  function block(title, x, y, w, lines, fs, o) {
    /* un titlu și un text împărțit în rânduri; întoarce {svg, y} */
    o = o || {};
    var out = "", mc = Math.floor(w / (fs * 0.43));
    if (title) { out += tx(x, y, title, fs + 1.2, { bold: true }); y += fs + 2.6; }
    lines.forEach(function (ln) {
      var bullet = o.bullet && ln.charAt(0) !== " ";
      wrap(ln, mc - (bullet ? 3 : 0)).forEach(function (l, i) {
        out += (bullet && i === 0 ? tx(x, y, "•", fs) : "") + tx(x + (bullet ? 3.2 : 0), y, l, fs, o.fill ? { fill: o.fill } : null);
        y += fs + 1.1;
      });
      y += o.gap == null ? 0.9 : o.gap;
    });
    return { svg: out, y: y };
  }
  function tb(tr, d, meta, o, title) {
    return E.titleBlock(
      [[70, tr("shCompany"), meta.company], [100, tr("shProject"), meta.project], [80, tr("shClient"), meta.client], [150, tr("eaUnit"), d.unit || "", 5]],
      [[110, tr("shMat"), d.material || ""], [50, tr("shThk"), d.thick || ""], [40, tr("shScale"), "—"],
       [40, tr("shDate"), meta.date], [30, tr("shSheet"), (o.sheetNo || 1) + "/" + (o.sheetTot || 1)], [130, tr("shGen"), "Ebanist " + (meta.ver || "")]]) +
      tx(PW - M - 2, M + 4.5, title, 3.2, { anchor: "end", fill: "#555" });
  }

  /**
   * COPERTA. d: { logo?, projectName, clientName, units:[[nume, dimensiuni]], index:[[nr, titlu, pentru cine]], read:[text], about:[text] }
   */
  function coverSheetSVG(d, o) {
    var tr = o.tr, meta = o.meta || {}, svg = E.sheetOpen(), L = M + 10, Rx = 232, rw = PW - M - 8 - Rx;
    svg += tx(L, M + 22, tr("dcCover"), 4.2, { fill: "#8a6a1f", bold: true });
    var y = M + 40, fs = 15, mc = Math.floor(190 / (fs * 0.5));
    wrap(d.projectName || "—", mc).slice(0, 3).forEach(function (l) { svg += tx(L, y, l, fs, { bold: true }); y += fs * 1.15; });
    y += 4;
    if (d.clientName) { svg += tx(L, y, tr("dcFor"), 3, { fill: "#666" }); y += 6.5; svg += tx(L, y, clip(d.clientName, 46), 7, { bold: true }); y += 11; }
    svg += tx(L, y, tr("shDate") + ": " + (meta.date || ""), 3.6, { fill: "#444" }); y += 12;
    if (d.logo) svg += '<image href="' + esc(d.logo) + '" x="' + (L) + '" y="' + r1(y) + '" width="70" height="26" preserveAspectRatio="xMinYMid meet"/>';
    /* corpurile proiectului; cu randare, imaginea ocupă mijlocul copertei */
    var uy = Math.max(y + 36, 150);
    if (d.heroImg) {
      var iy = Math.max(y + 6, 96);
      svg += '<rect x="' + L + '" y="' + r1(iy) + '" width="190" height="108" fill="#eef0ea"/>' + img(d.heroImg, L, iy, 190, 108) +
        '<rect x="' + L + '" y="' + r1(iy) + '" width="190" height="108" fill="none" stroke="' + INK + '" stroke-width=".25"/>';
      uy = iy + 108 + 12;
    }
    svg += tx(L, uy, tr("dcUnits"), 4, { bold: true }); uy += 5;
    var urow = Math.min(6.4, (TB_Y - 6 - uy) / Math.max(1, Math.min((d.units || []).length, 12) + 0.6));
    (d.units || []).slice(0, 12).forEach(function (u) {
      svg += '<path d="M' + L + " " + r1(uy + 1.5) + "H" + (L + 190) + '" stroke="#bbb" stroke-width=".2"/>' +
        tx(L, uy, clip(u[0], 40), 3.4, { bold: true }) + tx(L + 190, uy, u[1], 3.4, { anchor: "end" });
      uy += urow;
    });
    /* cuprinsul */
    var cy = M + 16;
    svg += tx(Rx, cy, tr("dcContents"), 5, { bold: true }); cy += 3;
    svg += '<rect x="' + Rx + '" y="' + cy + '" width="' + rw + '" height="5.2" fill="#e8e8e8" stroke="' + INK + '" stroke-width=".15"/>' +
      tx(Rx + 1.5, cy + 3.7, "#", 2.8, { bold: true }) + tx(Rx + 11, cy + 3.7, tr("dcSheet"), 2.8, { bold: true }) + tx(Rx + 100, cy + 3.7, tr("dcAudience"), 2.8, { bold: true });
    cy += 5.2;
    var rows = (d.index || []).slice(0, 22), rh = rows.length > 16 ? 4.6 : 5.4;
    rows.forEach(function (r) {
      svg += '<rect x="' + Rx + '" y="' + r1(cy) + '" width="' + rw + '" height="' + rh + '" fill="none" stroke="' + INK + '" stroke-width=".12"/>' +
        tx(Rx + 1.5, cy + rh * 0.72, String(r[0]), 3, { bold: true }) + tx(Rx + 11, cy + rh * 0.72, clip(r[1], 46), 3) + tx(Rx + 100, cy + rh * 0.72, clip(r[2], 24), 2.8, { fill: "#444" });
      cy += rh;
    });
    var b = block(tr("dcRead"), Rx, cy + 9, rw, d.read || [], 2.8, { bullet: true });
    svg += b.svg;
    var ab = block(tr("dcAbout"), Rx, Math.min(b.y + 4, TB_Y - 36), rw, d.about || [], 2.6, { fill: "#333" });
    svg += ab.svg;
    return svg + tb(tr, d, meta, o, tr("dcCover")) + "</svg>";
  }

  /**
   * PREZENTARE CLIENT. d: { unit, clientName, heroImg, img2, img3, facts:[[eticheta,valoare]], materials:[[eticheta,nume,hex]], highlights:[text] }
   */
  function clientSheetSVG(d, o) {
    var tr = o.tr, meta = o.meta || {}, svg = E.sheetOpen(), L = M + 6, T = M + 6;
    var hw = 236, hh = 156;
    svg += '<rect x="' + L + '" y="' + (T + 10) + '" width="' + hw + '" height="' + hh + '" fill="#eef0ea"/>';
    if (d.heroImg) svg += img(d.heroImg, L, T + 10, hw, hh);
    svg += '<rect x="' + L + '" y="' + (T + 10) + '" width="' + hw + '" height="' + hh + '" fill="none" stroke="' + INK + '" stroke-width=".25"/>';
    var sy = T + 10 + hh + 4, sw = (hw - 4) / 2, sh = TB_Y - 6 - sy;
    [d.img2, d.img3].forEach(function (im, i) {
      var x = L + i * (sw + 4);
      svg += '<rect x="' + r1(x) + '" y="' + r1(sy) + '" width="' + r1(sw) + '" height="' + r1(sh) + '" fill="#eef0ea"/>' + (im ? img(im, x, sy, sw, sh) : "") +
        '<rect x="' + r1(x) + '" y="' + r1(sy) + '" width="' + r1(sw) + '" height="' + r1(sh) + '" fill="none" stroke="' + INK + '" stroke-width=".2"/>';
    });
    var X = L + hw + 10, w = PW - M - 6 - X, y = T + 8;
    svg += tx(X, y, tr("dcClientKicker"), 3.4, { fill: "#8a6a1f", bold: true }); y += 4;
    if (d.clientName) { svg += tx(X, y + 5, tr("dcFor") + " " + clip(d.clientName, 30), 4, { fill: "#555" }); y += 9; }
    var nm = wrap(d.unit || "", Math.floor(w / (9 * 0.5)));
    nm.slice(0, 3).forEach(function (l) { y += 9.5; svg += tx(X, y, l, 9, { bold: true }); });
    y += 8;
    (d.facts || []).forEach(function (r) {
      svg += tx(X, y, r[0], 2.6, { fill: "#777" }) + tx(X, y + 5, clip(r[1], 52), 4, { bold: true }); y += 11;
    });
    y += 3;
    svg += tx(X, y, tr("dcMaterials"), 3.4, { bold: true }); y += 5;
    (d.materials || []).forEach(function (m) {
      svg += '<rect x="' + X + '" y="' + r1(y - 3.6) + '" width="9" height="5.2" fill="' + esc(m[2] || "#ddd") + '" stroke="' + INK + '" stroke-width=".2"/>' +
        tx(X + 12, y, m[0], 2.5, { fill: "#777" }) + tx(X + 12, y + 3.6, clip(m[1], 46), 3.2, { bold: true });
      y += 9.6;
    });
    if (d.highlights && d.highlights.length) { y += 2; var b = block(tr("dcIncluded"), X, y, w, d.highlights, 2.9, { bullet: true }); svg += b.svg; y = b.y; }
    /* validarea clientului */
    var vy = TB_Y - 36;
    svg += tx(X, vy - 2, tr("dcApprove"), 3.4, { bold: true });
    svg += '<path d="M' + X + " " + (vy + 14) + "H" + (X + w * 0.58) + "M" + (X + w * 0.66) + " " + (vy + 14) + "H" + (X + w) + '" stroke="' + INK + '" stroke-width=".3"/>' +
      tx(X, vy + 18, tr("dcSign"), 2.5, { fill: "#555" }) + tx(X + w * 0.66, vy + 18, tr("shDate"), 2.5, { fill: "#555" });
    svg += tx(X, TB_Y - 3, tr("dcColorNote"), 2.2, { fill: "#777" });
    return svg + tb(tr, d, meta, o, tr("dcClientTitle")) + "</svg>";
  }

  /**
   * RAPORT TEHNIC. d: { chapters:[{h, lines:[text]}] }
   */
  function reportSheetSVG(d, o) {
    var tr = o.tr, meta = o.meta || {}, svg = E.sheetOpen(), L = M + 8, T = M + 26;
    svg += tx(L, M + 10, tr("dcReportTitle"), 6, { bold: true });
    svg += tx(L, M + 15.5, (d.unit || ""), 3.6, { fill: "#555" });
    var cols = 3, gap = 8, cw = (PW - 2 * (M + 8) - gap * (cols - 1)) / cols, avail = TB_Y - 6 - T;
    var fs = 3.5, chapters = d.chapters || [], layout;
    function measure(fsz) {
      var mc = Math.floor(cw / (fsz * 0.5)), hs = [];
      chapters.forEach(function (c) {
        var h = fsz + 3.6, ls = [];
        (c.lines || []).forEach(function (l) { var w = wrap(l, mc - 3); ls.push(w); h += w.length * (fsz + 1.1) + 0.9; });
        hs.push({ c: c, h: h + 3, ls: ls });
      });
      /* aranjare în coloane: capitolele în ordine, o coloană nouă când nu mai încape */
      var col = 0, y = 0, pos = [];
      hs.forEach(function (it) { if (y + it.h > avail && y > 0) { col++; y = 0; } pos.push({ it: it, col: col, y: y }); y += it.h; });
      return { pos: pos, cols: col + 1 };
    }
    layout = measure(fs);
    while ((layout.cols > cols) && fs > 2.0) { fs -= 0.1; layout = measure(fs); }
    layout.pos.forEach(function (p) {
      if (p.col >= cols) return;
      var x = L + p.col * (cw + gap), y = T + p.y;
      svg += '<path d="M' + r1(x) + " " + r1(y - 3) + "h" + r1(cw) + '" stroke="' + INK + '" stroke-width=".3"/>';
      y += fs + 0.4; svg += tx(x, y, p.it.c.h, fs + 1, { bold: true }); y += 3.2;
      p.it.ls.forEach(function (wl) {
        wl.forEach(function (l, i) { svg += (i === 0 ? tx(x, y + fs * 0.1, "•", fs) : "") + tx(x + 3, y + fs * 0.1, l, fs); y += fs + 1.1; });
        y += 0.9;
      });
    });
    return svg + tb(tr, d, meta, o, tr("dcReportTitle")) + "</svg>";
  }

  var API = { coverSheetSVG: coverSheetSVG, clientSheetSVG: clientSheetSVG, reportSheetSVG: reportSheetSVG, wrap: wrap };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.EBDoc = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
