/* ebanist-sheet.js — foaia tehnică A3 a unei piese, pentru cine o fabrică.
 *
 * Funcție pură: primește piesa din Modelul de Operații (ebanist-ops.js) și
 * întoarce un SVG de 420 × 297 mm. Nu citește DOM-ul, nu citește starea
 * aplicației: textele vin prin `o.tr(cheie)`, deci limba e a meniului.
 *
 * Reguli:
 *   - cotele sunt cele ale piesei (aceleași din Modelul de Operații), nimic
 *     recalculat aici; doar rotunjire la 0,1 mm la emitere;
 *   - cotarea e în lanț, de la muchie la axa găurii; pașii egali (sistemul
 *     de 32) se strâng în „n×pas";
 *   - fiecare gaură/canal poartă o literă, legată de tabelul din dreapta.
 */
(function (root) {
  "use strict";

  var PW = 420, PH = 297, M = 10;                  /* foaia și chenarul, mm */
  var TB_H = 30, TB_Y = PH - M - TB_H;              /* cartușul */
  var COL_X = 304;                                   /* coloana tabelului */
  var SCALES = [1, 2, 2.5, 4, 5, 8, 10, 15, 20, 25, 30, 40, 50, 75, 100];
  var INK = "#111", THIN = "#777";

  function r1(v) { return Math.round(v * 10) / 10; }
  function f(v) { return String(r1(v)).replace(/\.0$/, ""); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function tx(x, y, s, size, o) {
    o = o || {};
    return '<text x="' + r1(x) + '" y="' + r1(y) + '" font-size="' + size + '"' +
      (o.anchor ? ' text-anchor="' + o.anchor + '"' : "") +
      (o.bold ? ' font-weight="700"' : "") +
      (o.fill ? ' fill="' + o.fill + '"' : "") +
      (o.rot ? ' transform="rotate(' + o.rot + " " + r1(x) + " " + r1(y) + ')"' : "") +
      ">" + esc(s) + "</text>";
  }
  /* text într-un grup oglindit pe x: se contra-oglindește ca să se citească */
  function txFlip(x, y, s, size, o) {
    o = o || {};
    return '<text transform="translate(' + r1(x) + " " + r1(y) + ') scale(-1 1)" font-size="' + size + '"' +
      (o.anchor ? ' text-anchor="' + o.anchor + '"' : "") + ">" + esc(s) + "</text>";
  }
  function ln(x1, y1, x2, y2, w, col, dash) {
    return '<path d="M' + r1(x1) + " " + r1(y1) + "L" + r1(x2) + " " + r1(y2) + '" stroke="' + (col || INK) +
      '" stroke-width="' + (w || 0.25) + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : "") + ' fill="none"/>';
  }

  /* scara standard cea mai mare la care încape desenul */
  function pickScale(fitW, fitH, L, W) {
    var best = SCALES[SCALES.length - 1];
    for (var i = 0; i < SCALES.length; i++) {
      var d = SCALES[i];
      if (L / d <= fitW && W / d <= fitH) { best = d; break; }
    }
    return best;
  }

  /* coordonate unice (0,1 mm), crescător */
  function uniq(a) {
    var m = {}; a.forEach(function (v) { m[r1(v)] = 1; });
    return Object.keys(m).map(Number).sort(function (x, y) { return x - y; });
  }

  /* segmentele lanțului: 0 → c1 → … → total; pașii egali consecutivi (≥3) se
     strâng. Întoarce [{a,b,label}] cu a,b în mm de la origine. */
  function chainSegs(coords, total) {
    var pts = [0].concat(coords.filter(function (c) { return c > 0.05 && c < total - 0.05; })).concat([total]);
    var segs = [];
    for (var i = 0; i < pts.length - 1; i++) segs.push({ a: pts[i], b: pts[i + 1], d: r1(pts[i + 1] - pts[i]) });
    var out = [], i2 = 0;
    while (i2 < segs.length) {
      var j = i2;
      while (j + 1 < segs.length && Math.abs(segs[j + 1].d - segs[i2].d) < 0.06) j++;
      var n = j - i2 + 1;
      if (n >= 3) out.push({ a: segs[i2].a, b: segs[j].b, label: n + "×" + f(segs[i2].d), run: true });
      else for (var k = i2; k <= j; k++) out.push({ a: segs[k].a, b: segs[k].b, label: f(segs[k].d) });
      i2 = j + 1;
    }
    return { pts: pts, segs: out };
  }

  /* lanțul de cote, desenat în coordonate locale (x = mm × scară, dimensiunea
     de sus la y = -off); vertical se obține rotind grupul. */
  function chainSvg(coords, total, s, off, fs, ext, flip, open) {
    var T = flip ? txFlip : tx;
    var ch = chainSegs(coords, total), o = "", y = -off;
    /* capăt deschis (detaliu tăiat): fără cota până la linia de ruptură */
    if (open === "end") { ch.pts.pop(); ch.segs.pop(); } else if (open === "start") { ch.pts.shift(); ch.segs.shift(); }
    var X = function (mm) { return mm * s; };
    ch.pts.forEach(function (p) {
      var e = ext && ext[r1(p)];
      o += ln(X(p), y - 1.6, X(p), (e == null ? -1.2 : e), 0.18, THIN, e == null ? "" : "0.8 0.8");
    });
    o += ln(X(ch.pts[0]), y, X(ch.pts[ch.pts.length - 1]), y, 0.25);
    ch.pts.forEach(function (p) { o += ln(X(p) - 1, y + 1, X(p) + 1, y - 1, 0.35); });
    var lvl = 0;
    ch.segs.forEach(function (sg) {
      var w = (sg.b - sg.a) * s, need = sg.label.length * fs * 0.56 + 1.2, cx = X((sg.a + sg.b) / 2);
      if (w >= need) { o += T(cx, y - 1, sg.label, fs, { anchor: "middle" }); lvl = 0; }
      else { o += T(cx, y - 1 - (lvl % 2) * (fs + 0.8), sg.label, fs, { anchor: "middle" }); lvl++; }
    });
    return o;
  }

  /* gruparea operațiilor: același fel de operație = o literă */
  function groupOps(ops, opName) {
    var by = {}, order = [];
    ops.forEach(function (o) {
      var key = [o.type, o.type === "drill" ? o.dia : o.type === "groove" ? o.width : o.w + "x" + o.d,
        o.depth, o.through ? 1 : 0, o.note, o.face < 5 ? "e" + o.face : "f"].join("|");
      if (!by[key]) { by[key] = { key: key, o: o, ops: [], name: opName(o) }; order.push(by[key]); }
      by[key].ops.push(o);
    });
    order.sort(function (a, b) {
      var da = a.o.type === "drill" ? a.o.dia : 0, db = b.o.type === "drill" ? b.o.dia : 0;
      return (db - da) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    });
    order.forEach(function (g, i) { g.tag = String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : ""); });
    return order;
  }


  function cell(x, y, w, h, label, value, fs) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="none" stroke="' + INK + '" stroke-width="0.25"/>' +
      tx(x + 1.4, y + 3.3, label, 2.3, { fill: "#555" }) +
      tx(x + 1.4, y + h - 3.2, value, fs || 4.4, { bold: true });
  }

  /**
   * pc   — piesa (length, width, thickness, outline, operations)
   * o    — { face, tr, opName, meta:{...}, sheetNo, sheetTot }
   */
  function partSheetSVG(pc, o) {
    var tr = o.tr, face = o.face || 5, meta = o.meta || {};
    var L = pc.length, W = pc.width;
    var ops = pc.operations || [];
    var faceOps = ops.filter(function (x) { return x.type !== "drill" || x.face === 5 || x.face === 6; });
    var edgeOps = ops.filter(function (x) { return x.type === "drill" && x.face < 5; });
    var has6 = ops.some(function (x) { return x.face === 6; });
    var views = has6 ? [5, 6] : [face === 6 ? 6 : 5];
    var groups = groupOps(ops, o.opName);
    var tagOf = {}; groups.forEach(function (g) { g.ops.forEach(function (x) { tagOf[x.id] = g.tag; }); });

    var nView = views.length, areaH = TB_Y - M - 6, regH = areaH / nView;
    var padL = 30, padT = 24, areaW = COL_X - M - 6;
    var fitW = areaW - padL - 6, fitH = regH - padT - 8;
    var den = pickScale(fitW, fitH, L, W), s = 1 / den;
    var fs = 3.2;

    var svg = '<svg class="sh-svg" viewBox="0 0 ' + PW + " " + PH + '" width="' + PW + 'mm" height="' + PH + 'mm" ' +
      'xmlns="http://www.w3.org/2000/svg" font-family="Barlow,Arial,sans-serif" fill="' + INK + '">' +
      '<rect width="' + PW + '" height="' + PH + '" fill="#fff"/>' +
      '<rect x="' + M + '" y="' + M + '" width="' + (PW - 2 * M) + '" height="' + (PH - 2 * M) + '" fill="none" stroke="' + INK + '" stroke-width="0.7"/>';

    views.forEach(function (vf, vi) {
      var oy = M + 6 + vi * regH + padT, ox = M + 6 + padL;
      var mir = vf === 6;
      var X = function (x) { return mir ? L - x : x; };
      var PX = function (x) { return ox + X(x) * s; };
      var PY = function (y) { return oy + (W - y) * s; };
      /* contur */
      var rects = mir ? pc.outline.map(function (r) { return { x0: L - r.x1, x1: L - r.x0, y0: r.y0, y1: r.y1 }; }) : pc.outline;
      rects.forEach(function (r) {
        svg += '<rect x="' + r1(ox + r.x0 * s) + '" y="' + r1(oy + (W - r.y1) * s) + '" width="' + r1((r.x1 - r.x0) * s) +
          '" height="' + r1((r.y1 - r.y0) * s) + '" fill="#f3efe6" stroke="' + INK + '" stroke-width="0.5"/>';
      });
      /* cotele: coordonate distincte ale găurilor de pe față */
      var onFace = faceOps.filter(function (x) { return x.face === vf || (x.through && (vf === 5 || vf === 6)); });
      var xs = [], ys = [], extX = {}, extY = {};
      onFace.forEach(function (x) {
        var px, py;
        if (x.type === "groove") {
          px = [X(x.from.x), X(x.to.x)]; py = [x.from.y, x.to.y];
        } else { px = [X(x.x)]; py = [x.y]; }
        px.forEach(function (v) { xs.push(v); }); py.forEach(function (v) { ys.push(v); });
        px.forEach(function (v) { var k = r1(v), yy = (W - Math.min.apply(null, py)) * s; if (extX[k] == null || yy > extX[k]) extX[k] = yy; });
        py.forEach(function (v) { var k = r1(v), xx = Math.max.apply(null, px) * s; if (extY[k] == null || xx > extY[k]) extY[k] = xx; });
      });
      var cx = uniq(xs), cy = uniq(ys);
      /* lanț sus (x), lanț stânga (y, rotit) */
      svg += '<g transform="translate(' + r1(ox) + " " + r1(oy) + ')">' + chainSvg(cx, L, s, 9, fs, extX) + chainSvg([], L, s, 17, fs, null) + "</g>";
      svg += '<g transform="translate(' + r1(ox) + " " + r1(oy + W * s) + ') rotate(-90)">' + chainSvg(cy, W, s, 9, fs, extY) +
        chainSvg([], W, s, 17, fs, null) + "</g>";
      /* canale */
      faceOps.filter(function (x) { return x.type === "groove"; }).forEach(function (x) {
        var x0 = Math.min(X(x.from.x), X(x.to.x)), x1 = Math.max(X(x.from.x), X(x.to.x));
        var y0 = Math.min(x.from.y, x.to.y), y1 = Math.max(x.from.y, x.to.y);
        var hz = Math.abs(x.to.x - x.from.x) >= Math.abs(x.to.y - x.from.y);
        var gx = hz ? x0 : x0 - x.width / 2, gy = hz ? y0 - x.width / 2 : y0, gw = hz ? x1 - x0 : x.width, gh = hz ? x.width : y1 - y0;
        svg += '<rect x="' + r1(ox + gx * s) + '" y="' + r1(oy + (W - gy - gh) * s) + '" width="' + r1(Math.max(gw * s, 0.4)) +
          '" height="' + r1(Math.max(gh * s, 0.4)) + '" fill="#ddd" fill-opacity=".7" stroke="' + INK + '" stroke-width="0.25" stroke-dasharray="1.2 0.8"/>';
        svg += tx(ox + (gx + gw) * s + 1, oy + (W - gy) * s - 0.6, tagOf[x.id] || "", 2.8, { bold: true });
      });
      /* decupaje */
      faceOps.filter(function (x) { return x.type === "mill"; }).forEach(function (x) {
        svg += '<rect x="' + r1(PX(x.x) - x.w * s / 2) + '" y="' + r1(PY(x.y) - x.d * s / 2) + '" width="' + r1(x.w * s) + '" height="' + r1(x.d * s) +
          '" rx="' + r1((x.r || 0) * s) + '" fill="#fff" stroke="' + INK + '" stroke-width="0.35" stroke-dasharray="' + (x.through ? "0" : "1.2 0.8") + '"/>';
        svg += ln(PX(x.x) - 2, PY(x.y), PX(x.x) + 2, PY(x.y), 0.15) + ln(PX(x.x), PY(x.y) - 2, PX(x.x), PY(x.y) + 2, 0.15);
        svg += tx(PX(x.x) + 2.4, PY(x.y) - 1.4, tagOf[x.id] || "", 2.8, { bold: true });
      });
      /* găuri */
      var tagged = onFace.filter(function (x) { return x.type === "drill"; }).length <= 60;
      onFace.filter(function (x) { return x.type === "drill"; }).forEach(function (x) {
        var vis = x.through || x.face === vf, r = Math.max(x.dia * s / 2, 0.7), px = PX(x.x), py = PY(x.y);
        svg += '<circle cx="' + r1(px) + '" cy="' + r1(py) + '" r="' + r1(r) + '" fill="' + (vis ? (x.through ? "#fff" : "#d9d9d9") : "none") +
          '" stroke="' + INK + '" stroke-width="0.25"' + (vis ? "" : ' stroke-dasharray="0.8 0.6"') + "/>";
        var c = Math.max(r * 1.5, 1.6);
        svg += ln(px - c, py, px + c, py, 0.13, INK, "2 0.5 0.4 0.5") + ln(px, py - c, px, py + c, 0.13, INK, "2 0.5 0.4 0.5");
        if (tagged && vis) svg += tx(px + r + 0.6, py - r - 0.2, tagOf[x.id] || "", 2.6, { bold: true });
      });
      /* găuri în cant: o crestătură la muchie */
      edgeOps.forEach(function (x) {
        var d = Math.max(x.depth * s, 0.8), w = Math.max(x.dia * s, 0.9), rx, ry, rw, rh;
        if (x.face === 1) { rx = PX(x.u) - w / 2; ry = PY(0) - d; rw = w; rh = d; }
        else if (x.face === 3) { rx = PX(x.u) - w / 2; ry = PY(W); rw = w; rh = d; }
        else { var atX0 = (x.face === 4) === (vf === 5); rx = atX0 ? ox : ox + L * s - d; ry = PY(x.u) - w / 2; rw = d; rh = w; }
        svg += '<rect x="' + r1(rx) + '" y="' + r1(ry) + '" width="' + r1(rw) + '" height="' + r1(rh) + '" fill="#888" stroke="' + INK + '" stroke-width="0.2"/>';
      });
      /* origine + titlul vederii */
      svg += '<circle cx="' + r1(mir ? ox + L * s : ox) + '" cy="' + r1(oy + W * s) + '" r="1.1" fill="#c0392b"/>' +
        tx(mir ? ox + L * s - 2 : ox + 2, oy + W * s + 5, "0,0", 2.8, { fill: "#c0392b", anchor: mir ? "end" : "start" });
      svg += tx(M + 8, oy - padT + 7, tr("partFace") + " " + vf, 4.6, { bold: true });
      svg += tx(M + 8 + 36, oy - padT + 7, "1:" + den, 3.4, { fill: "#444" });
    });


    /* detalii: la scară mare, în zona liberă de sub desen — numai când e loc
       și când fereastra e clar mai mică decât piesa */
    var detSvg = "", dTop = M + 6 + padT + W * s + 14, dH = TB_Y - 6 - dTop, drills5 = ops.filter(function (x) { return x.type === "drill" && (x.face === 5 || x.face === 6); });
    if (nView === 1 && dH >= 55 && drills5.length) {
      var vf1 = views[0], mir1 = vf1 === 6;
      var pts = drills5.map(function (x) { return { x: mir1 ? L - x.x : x.x, y: x.y, op: x }; });
      var used = {}, boxes = [], bw = 0;
      var seeds = pts.slice().sort(function (a, b) { return b.op.dia - a.op.dia; });
      for (var si = 0; si < seeds.length && boxes.length < 2; si++) {
        var sd = seeds[si]; if (used[sd.op.id]) continue;
        var clu = pts.filter(function (q) { return !used[q.op.id] && Math.abs(q.x - sd.x) <= 130 && Math.abs(q.y - sd.y) <= 130; });
        var axR = sd.x > L / 2, ayT = sd.y > W / 2;
        var lxs = clu.map(function (q) { return axR ? L - q.x : q.x; }), lys = clu.map(function (q) { return ayT ? W - q.y : q.y; });
        var ww = Math.max(60, Math.max.apply(null, lxs) + 25), wh = Math.max(60, Math.max.apply(null, lys) + 25);
        if (ww > L * 0.6 && wh > W * 0.6) continue;
        ww = Math.min(ww, L); wh = Math.min(wh, W);
        clu.forEach(function (q) { used[q.op.id] = 1; });
        boxes.push({ clu: clu, axR: axR, ayT: ayT, ww: ww, wh: wh });
      }
      var bx = M + 6 + padL;
      boxes.forEach(function (b, bi) {
        var avW = (COL_X - 12 - bx) / (boxes.length - bi), avH = dH - 26;
        var dd = pickScale(avW - 34, avH, b.ww, b.wh), ds = 1 / dd;
        if (ds < s * 1.9) return;                             /* nu merită un detaliu */
        var ox2 = bx + 30, oy2 = dTop + 18;
        var LX = function (q) { return b.axR ? L - q.x : q.x; }, LY = function (q) { return b.ayT ? W - q.y : q.y; };
        var PXd = function (lx) { return b.axR ? ox2 + (b.ww - lx) * ds : ox2 + lx * ds; };
        var PYd = function (ly) { return b.ayT ? oy2 + ly * ds : oy2 + (b.wh - ly) * ds; };
        var inW = b.clu;
        detSvg += tx(bx, dTop + 7, tr("shDetail") + " " + String.fromCharCode(65 + bi) + " — 1:" + dd, 4, { bold: true });
        detSvg += '<rect x="' + r1(ox2) + '" y="' + r1(oy2) + '" width="' + r1(b.ww * ds) + '" height="' + r1(b.wh * ds) + '" fill="#f3efe6" stroke="' + INK + '" stroke-width="0.25" stroke-dasharray="3 1.2 0.6 1.2"/>';
        /* muchiile reale ale piesei, continue */
        var ex0 = b.axR ? ox2 + b.ww * ds : ox2, ey0 = b.ayT ? oy2 : oy2 + b.wh * ds;
        detSvg += ln(ex0, oy2, ex0, oy2 + b.wh * ds, 0.7) + ln(ox2, ey0, ox2 + b.ww * ds, ey0, 0.7);
        var cxs = uniq(inW.map(LX)), cys = uniq(inW.map(function (q) { return b.ayT ? b.wh - LY(q) : LY(q); })), eX = {}, eY = {};
        inW.forEach(function (q) {
          var kx = r1(LX(q)), ky = r1(b.ayT ? b.wh - LY(q) : LY(q)), yy = (b.ayT ? LY(q) : b.wh - LY(q)) * ds, xx = (b.axR ? b.ww - LX(q) : LX(q)) * ds;
          if (eX[kx] == null || yy > eX[kx]) eX[kx] = yy; if (eY[ky] == null || xx > eY[ky]) eY[ky] = xx; });
        if (b.axR) detSvg += '<g transform="translate(' + r1(ox2 + b.ww * ds) + " " + r1(oy2) + ') scale(-1 1)">' + chainSvg(cxs, b.ww, ds, 9, fs, eX, true, "end") + "</g>";
        else detSvg += '<g transform="translate(' + r1(ox2) + " " + r1(oy2) + ')">' + chainSvg(cxs, b.ww, ds, 9, fs, eX, false, "end") + "</g>";
        detSvg += '<g transform="translate(' + r1(ox2) + " " + r1(oy2 + b.wh * ds) + ') rotate(-90)">' + chainSvg(cys, b.wh, ds, 9, fs, eY, false, b.ayT ? "start" : "end") + "</g>";
        inW.forEach(function (q) {
          var r = Math.max(q.op.dia * ds / 2, 0.8), px = PXd(LX(q)), py = PYd(LY(q));
          detSvg += '<circle cx="' + r1(px) + '" cy="' + r1(py) + '" r="' + r1(r) + '" fill="' + (q.op.through ? "#fff" : "#d9d9d9") + '" stroke="' + INK + '" stroke-width="0.3"/>';
          var c = Math.max(r * 1.4, 2);
          detSvg += ln(px - c, py, px + c, py, 0.13, INK, "2 0.5 0.4 0.5") + ln(px, py - c, px, py + c, 0.13, INK, "2 0.5 0.4 0.5");
          detSvg += tx(px + r + 0.8, py - r, tagOf[q.op.id] || "", 3, { bold: true }) + tx(px + r + 0.8, py + r + 3, "Ø" + f(q.op.dia), 2.4, { fill: "#444" });
        });
        bx += avW;
      });
    }
    svg += detSvg;

    /* tabelul din dreapta */
    var ty = M + 6, rowH = 5.2;
    svg += tx(COL_X, ty + 3.6, tr("shTable"), 3.6, { bold: true });
    ty += 6;
    svg += '<rect x="' + COL_X + '" y="' + ty + '" width="' + (PW - M - 3 - COL_X) + '" height="' + rowH + '" fill="#e8e8e8" stroke="' + INK + '" stroke-width="0.2"/>';
    var cols = [0, 7, 38, 52, 66, 80];                 /* x relativ: rif, operație, Ø, adânc., × */
    [[0, "shRef"], [1, "opOp"], [2, "shDia"], [3, "opDepth"], [4, "opFace"], [5, "shQty"]].forEach(function (c) {
      svg += tx(COL_X + cols[c[0]] + 1, ty + 3.6, tr(c[1]), 2.4, { bold: true });
    });
    ty += rowH;
    var maxRows = Math.floor((TB_Y - 40 - ty) / rowH), shown = 0;
    groups.forEach(function (g) {
      if (shown >= maxRows) return; shown++;
      var x = g.o, dia = x.type === "drill" ? "Ø" + f(x.dia) : x.type === "groove" ? f(x.width) : f(x.w) + "×" + f(x.d);
      svg += '<rect x="' + COL_X + '" y="' + ty + '" width="' + (PW - M - 3 - COL_X) + '" height="' + rowH + '" fill="none" stroke="' + INK + '" stroke-width="0.15"/>';
      svg += tx(COL_X + 1, ty + 3.7, g.tag, 3, { bold: true });
      var nm = g.name; if (nm.length > 20) nm = nm.slice(0, 19) + "…";
      svg += tx(COL_X + cols[1] + 1, ty + 3.6, nm, 2.6);
      svg += tx(COL_X + cols[2] + 1, ty + 3.6, dia, 2.6);
      svg += tx(COL_X + cols[3] + 1, ty + 3.6, x.through ? tr("partThrough") : f(x.depth), 2.6);
      svg += tx(COL_X + cols[4] + 1, ty + 3.6, String(x.face), 2.6);
      svg += tx(COL_X + cols[5] + 1, ty + 3.6, String(g.ops.length), 2.6, { bold: true });
      ty += rowH;
    });
    if (!groups.length) svg += tx(COL_X, ty + 4, tr("partNoOps"), 2.8);
    ty = Math.max(ty, 0);
    /* pozițiile, ca listă: literă → (x ; y) de la muchia stângă-jos, în vederea de sus */
    var py2 = ty + 4;
    if (groups.length && py2 < TB_Y - 30) {
      svg += tx(COL_X, py2 + 3, tr("shPos"), 3, { bold: true }); py2 += 5.5;
      groups.forEach(function (g) {
        var items = g.ops.filter(function (x) { return x.face >= 5; }).map(function (x) {
          return x.type === "groove" ? f(x.from.x) + "," + f(x.from.y) + "→" + f(x.to.x) + "," + f(x.to.y) : f(x.x) + ";" + f(x.y); });
        if (!items.length) return;
        var line = g.tag + "  ", out = [];
        items.forEach(function (it) { if ((line + it).length > 60) { out.push(line); line = "     "; } line += it + "  "; });
        out.push(line);
        out.forEach(function (l, i) { if (py2 < TB_Y - 24) { svg += tx(COL_X + 1, py2 + 2.6, l.length > 66 ? l.slice(0, 65) + "…" : l, 2.4, i === 0 ? { bold: false } : {}); py2 += 3.6; } });
        py2 += 1.2;
      });
    }
    ty = py2;
    /* pozițiile găurilor din cant: lista (u, z) */
    if (edgeOps.length) {
      ty += 3; svg += tx(COL_X, ty + 3, tr("shEdgeHoles"), 3, { bold: true }); ty += 5;
      var shownE = 0;
      edgeOps.forEach(function (x) {
        if (ty > TB_Y - 18 || shownE > 9) return; shownE++;
        svg += tx(COL_X + 1, ty + 3, (tagOf[x.id] || "") + "  " + tr("shEdgeN").replace("{n}", x.face) + "  u " + f(x.u) + "  z " + f(x.z) + "  Ø" + f(x.dia) + "×" + f(x.depth), 2.6);
        ty += 4.2;
      });
    }
    /* note */
    var ny = TB_Y - 14;
    svg += tx(COL_X, ny, tr("shNote1"), 2.5, { fill: "#333" });
    svg += tx(COL_X, ny + 3.6, tr("hwVerify").length > 70 ? tr("hwVerify").slice(0, 69) + "…" : tr("hwVerify"), 2.2, { fill: "#a33" });

    /* cartuș */
    var X0 = M, Y0 = TB_Y, h = TB_H / 2;
    var row1 = [[70, "shCompany", meta.company], [100, "shProject", meta.project], [80, "shClient", meta.client], [150, tr("shTitle"), meta.name]];
    var xx = X0;
    row1.forEach(function (c, i) { svg += cell(xx, Y0, c[0], h, i === 3 ? tr("shPiece") : tr(c[1]), i === 3 ? (meta.n ? "#" + meta.n + "  " : "") + (c[2] || "") : c[2] || "", i === 3 ? 5.2 : 4.2); xx += c[0]; });
    var row2 = [[90, "shMat", meta.material], [30, "shThk", f(pc.thickness) + " mm"], [30, "shQty", meta.qty == null ? "" : String(meta.qty)],
      [50, "shEdge", meta.edge || "—"], [30, "shScale", "1:" + den], [40, "shDate", meta.date], [30, "shSheet", (o.sheetNo || 1) + "/" + (o.sheetTot || 1)], [100, "shGen", "Ebanist " + (meta.ver || "")]];
    xx = X0;
    row2.forEach(function (c) { svg += cell(xx, Y0 + h, c[0], h, tr(c[1]), c[2] || "", 4.2); xx += c[0]; });
    /* titlul foii, sus în cartuș */
    svg += tx(PW - M - 2, M + 4.5, tr("shTitle"), 3.2, { anchor: "end", fill: "#555" });
    return svg + "</svg>";
  }

  var API = { partSheetSVG: partSheetSVG, chainSegs: chainSegs, pickScale: pickScale, groupOps: groupOps };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.EBSheet = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
