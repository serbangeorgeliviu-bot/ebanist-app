/* ebanist-asm.js — foaia A3 de montaj a unui corp (Elaborat tehnic, pasul 3):
 * vederea explodată cu poziții numerotate, lista de piese pe poziții,
 * feroneria și secvența de montaj, pe același cartuș ca foaia piesei.
 *
 * Funcție pură: primește datele deja pregătite de aplicație (imaginea
 * explodată cu etichetele ei, rândurile din Modelul de Operații, pașii din
 * `mSteps`) și întoarce un SVG de 420 × 297 mm. Nu calculează nicio cotă:
 * numerele din imagine sunt pozițiile din listă, aceleași ca pe etichetele
 * pieselor și pe fișa A4 de montaj. Textele vin prin `o.tr(cheie)`.
 */
(function (root) {
  "use strict";
  var E = root.EBSheet;
  if (!E) throw new Error("ebanist-asm.js cere ebanist-sheet.js");
  var M = E.M, TB_Y = E.TB_Y, COL_X = E.COL_X, PW = E.PW, INK = E.INK;
  var tx = E.tx, ln = E.ln, f = E.f, r1 = E.r1, esc = E.esc;

  /* împarte un text în rânduri de cel mult `max` caractere, la spații */
  function wrap(s, max) {
    var words = String(s == null ? "" : s).split(/\s+/), out = [], cur = "";
    words.forEach(function (w) {
      if (cur && (cur + " " + w).length > max) { out.push(cur); cur = w; } else cur = cur ? cur + " " + w : w;
    });
    if (cur) out.push(cur);
    return out;
  }
  function clip(s, n) { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

  /* etichetele care se citesc: nu pe margine, nu două peste aceeași piesă */
  function keepLabels(labels) {
    var keep = [];
    (labels || []).forEach(function (l) {
      if (l.x < 0.03 || l.x > 0.97 || l.y < 0.03 || l.y > 0.97) return;
      if (/^cassetto_(fianco|fondo)$/.test(l.role || "")) return;
      if (keep.some(function (k) { return Math.hypot((k.x - l.x) * 1.22, k.y - l.y) < 0.045; })) return;
      keep.push(l);
    });
    return keep;
  }

  /**
   * d — { name, dims, image:{img,labels} | null, imageSvg?, parts:[[n,nume,L,l,gr,cant,găuri]],
   *       hw:[[nume,produs,art,cant]], steps:[text], tools:[text], kg, material }
   * o — { tr, meta:{company,project,client,date,ver}, sheetNo, sheetTot }
   */
  function assemblySheetSVG(d, o) {
    var tr = o.tr, meta = o.meta || {}, svg = E.sheetOpen(), left = M + 6, top = M + 6;

    /* titlu + vederea explodată */
    svg += tx(left, top + 5, tr("asView"), 4.4, { bold: true });
    var imgW = 200, imgH = 164, ix = left, iy = top + 9;
    svg += '<rect x="' + ix + '" y="' + iy + '" width="' + imgW + '" height="' + imgH + '" fill="#fff" stroke="#bbb" stroke-width="0.25"/>';
    if (d.image && d.image.img) {
      svg += '<image href="' + esc(d.image.img) + '" x="' + ix + '" y="' + iy + '" width="' + imgW + '" height="' + imgH + '" preserveAspectRatio="xMidYMid meet"/>';
      keepLabels(d.image.labels).forEach(function (l) {
        var cx = ix + l.x * imgW, cy = iy + l.y * imgH;
        svg += '<circle cx="' + r1(cx) + '" cy="' + r1(cy) + '" r="2.7" fill="#0e3b2a" stroke="#fff" stroke-width=".3"/>' +
          tx(cx, cy + 1.05, String(l.n), 2.9, { anchor: "middle", bold: true, fill: "#fff" });
      });
    } else if (d.imageSvg) {
      svg += '<svg x="' + ix + '" y="' + iy + '" width="' + imgW + '" height="' + imgH + '" viewBox="' + esc(d.imageSvg.viewBox) + '" preserveAspectRatio="xMidYMid meet">' + d.imageSvg.inner + "</svg>";
    }
    svg += tx(ix, iy + imgH + 4, tr("asNote"), 2.4, { fill: "#444" });

    /* feroneria, sub imagine */
    var hy = iy + imgH + 10;
    svg += tx(left, hy, tr("hardware"), 3.6, { bold: true }); hy += 2.4;
    var hcols = [0, 78, 152, 188];
    svg += '<rect x="' + left + '" y="' + hy + '" width="200" height="4.6" fill="#e8e8e8" stroke="' + INK + '" stroke-width=".15"/>';
    [[0, "item"], [1, "catProd"], [2, "catArt"], [3, "qty"]].forEach(function (c) { svg += tx(left + hcols[c[0]] + 1, hy + 3.3, tr(c[1]), 2.4, { bold: true }); });
    hy += 4.6;
    var hwMax = Math.max(1, Math.floor((TB_Y - 4 - hy) / 4.2));
    (d.hw || []).slice(0, hwMax).forEach(function (r) {
      svg += '<rect x="' + left + '" y="' + hy + '" width="200" height="4.2" fill="none" stroke="' + INK + '" stroke-width=".12"/>' +
        tx(left + 1, hy + 3, clip(r[0], 44), 2.5) + tx(left + hcols[1] + 1, hy + 3, clip(r[1], 42), 2.5) +
        tx(left + hcols[2] + 1, hy + 3, clip(r[2], 20), 2.5) + tx(left + hcols[3] + 1, hy + 3, String(r[3]), 2.6, { bold: true });
      hy += 4.2;
    });

    /* secvența de montaj, coloana din mijloc */
    var sx = left + imgW + 6, sw = COL_X - 4 - sx, y = top + 5, fs = 2.6, maxc = Math.floor(sw / (fs * 0.54));
    svg += tx(sx, y, tr("mStepsT"), 4, { bold: true }); y += 5;
    var steps = d.steps || [], total = 0;
    steps.forEach(function (s) { total += wrap(s, maxc).length; });
    var avail = TB_Y - 6 - y;
    while (fs > 1.8 && (total * (fs + 0.9) + steps.length * 2.2) > avail) { fs -= 0.1; maxc = Math.floor(sw / (fs * 0.54)); total = 0; steps.forEach(function (s) { total += wrap(s, maxc).length; }); }
    steps.forEach(function (s, i) {
      var lines = wrap(s, maxc - 3);
      if (y + lines.length * (fs + 0.9) > TB_Y - 3) { if (!steps.cut) { steps.cut = 1; svg += tx(sx + 5, y, "…", fs); } return; }
      svg += '<circle cx="' + r1(sx + 1.8) + '" cy="' + r1(y - 0.8) + '" r="1.9" fill="#0e3b2a"/>' + tx(sx + 1.8, y + 0.2, String(i + 1), 2.3, { anchor: "middle", bold: true, fill: "#fff" });
      lines.forEach(function (l, k) { svg += tx(sx + 5, y + k * (fs + 0.9), l, fs); });
      y += lines.length * (fs + 0.9) + 2.2;
    });

    /* lista de piese pe poziții, coloana din dreapta */
    var ty = top + 5, cw = PW - M - 3 - COL_X;
    svg += tx(COL_X, ty, tr("mParts"), 4, { bold: true }); ty += 2.4;
    var cols = [0, 7, 52, 65, 78, 90], rowH = Math.min(4.4, Math.max(2.9, (TB_Y - 12 - ty - 6) / Math.max(1, (d.parts || []).length + 1)));
    svg += '<rect x="' + COL_X + '" y="' + r1(ty) + '" width="' + cw + '" height="' + r1(rowH) + '" fill="#e8e8e8" stroke="' + INK + '" stroke-width=".15"/>';
    [[0, "#"], [1, tr("fElement")], [2, "L"], [3, tr("partW")], [4, tr("partT")], [5, tr("partEdge")]].forEach(function (c) { svg += tx(COL_X + cols[c[0]] + 1, ty + rowH * 0.72, c[1], Math.min(2.4, rowH * 0.6), { bold: true }); });
    ty += rowH;
    var pfs = Math.min(2.6, rowH * 0.62);
    (d.parts || []).forEach(function (r) {
      svg += '<rect x="' + COL_X + '" y="' + r1(ty) + '" width="' + cw + '" height="' + r1(rowH) + '" fill="none" stroke="' + INK + '" stroke-width=".12"/>' +
        tx(COL_X + 1, ty + rowH * 0.72, String(r[0]), pfs, { bold: true }) + tx(COL_X + cols[1] + 1, ty + rowH * 0.72, clip(r[1], 24), pfs) +
        tx(COL_X + cols[2] + 1, ty + rowH * 0.72, String(r[2]), pfs) + tx(COL_X + cols[3] + 1, ty + rowH * 0.72, String(r[3]), pfs) +
        tx(COL_X + cols[4] + 1, ty + rowH * 0.72, String(r[4]), pfs) + tx(COL_X + cols[5] + 1, ty + rowH * 0.72, clip(r[5], 8), pfs);
      ty += rowH;
    });
    if (d.tools && d.tools.length) {
      var ky = Math.min(ty + 5, TB_Y - 5 - Math.ceil(d.tools.join(", ").length / 60) * 3.4 - 5);
      svg += tx(COL_X, ky, tr("mTools"), 3.2, { bold: true }); ky += 3.8;
      wrap(d.tools.join(" · "), 62).forEach(function (l, i) { svg += tx(COL_X, ky + i * 3.3, l, 2.4, { fill: "#333" }); });
    }

    /* cartuș */
    svg += E.titleBlock(
      [[70, tr("shCompany"), meta.company], [100, tr("shProject"), meta.project], [80, tr("shClient"), meta.client], [150, tr("eaUnit"), (d.name || "") + "  " + (d.dims || ""), 5]],
      [[110, tr("shMat"), d.material], [50, tr("mWeight"), d.kg ? "≈ " + Math.round(d.kg) + " kg" : "—"], [40, tr("shScale"), "—"],
       [40, tr("shDate"), meta.date], [30, tr("shSheet"), (o.sheetNo || 1) + "/" + (o.sheetTot || 1)], [130, tr("shGen"), "Ebanist " + (meta.ver || "")]]);
    svg += tx(PW - M - 2, M + 4.5, tr("asTitle"), 3.2, { anchor: "end", fill: "#555" });
    return svg + "</svg>";
  }

  var API = { assemblySheetSVG: assemblySheetSVG, wrap: wrap, keepLabels: keepLabels };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.EBAsm = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
