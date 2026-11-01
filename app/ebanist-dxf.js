/* ebanist-dxf.js — export „Layered DXF 2D" al pieselor, pentru CNC / CAM.
 *
 * Funcție pură, fără DOM: primește piesa din Modelul de Operații
 * (ebanist-ops.js — aceeași pe care o desenează foaia A3) și întoarce text
 * DXF. Format: AutoCAD R12 (AC1009) ASCII — cel mai larg citit (BiesseWorks,
 * BSolid, SCM Maestro, WoodWOP, VCarve, Fusion 360). Conturul e un POLYLINE
 * închis (R12 nu are LWPOLYLINE); arcele găurilor sunt CIRCLE.
 *
 * Reguli:
 *   - milimetri; calcul în virgulă mobilă, rotunjire la 0,1 mm doar la emitere;
 *   - originea (0,0) = colțul stânga-jos al feței de prelucrare (5 sau 6);
 *     pe fața 6 axa X e oglindită (x → L − x), ca în foaia A3;
 *   - nicio cotă nu se recalculează aici: găurile, canalele și decupajele
 *     sunt cele din operații. Cotele HW_DRILL cu verificat:false rămân
 *     neverificate (vezi fișa de montaj): fișierul NU le verifică.
 *
 * Straturi (culoare ACI):
 *   PANEL_CUT                     7  conturul piesei
 *   PANEL_FINISHED                8  (numai în modul cotă de tăiere) conturul finit, ca referință
 *   DRILL_V_D{d}_Z{z|THRU}        3  găuri verticale (cerc, rază d/2)
 *   DRILL_H_{TOP|BOTTOM|LEFT|RIGHT}_D{d}_Z{z}  5  găuri în cant (axa + cota Z pe grosime)
 *   GROOVE_Z{z}_W{w}              1  canal (nut) dreptunghiular
 *   SLOT_Z{z}_W{w}                6  lamelă / domino / clamex pe față
 *   MILL_Z{z|THRU}                4  decupaj (colțuri rotunjite prin bulge)
 *   INFO_TEXT                     2  ID, rol, material, fibră, canturi
 */
(function (root) {
  "use strict";

  var VERSION = "1";

  function r1(v) { return Math.round(v * 10) / 10; }
  /* număr pentru DXF: fără exponent, fără „-0" */
  function n(v) {
    var s = String(r1(v)); if (s === "-0") s = "0";
    return s;
  }
  function nr(v) { var s = String(Math.round(v * 100) / 100); return s === "-0" ? "0" : s; }  /* rază = diametru/2 */
  function lnum(v) { return String(r1(v)).replace(/\.0$/, "").replace("-", "m").replace(".", "_"); }

  /* DXF R12 e ASCII: diacriticele se descompun, restul devine „?" */
  function ascii(s) {
    s = String(s == null ? "" : s).replace(/Ø|ø/g, "D");
    try { s = s.normalize("NFD").replace(/[̀-ͯ]/g, ""); } catch (e) {}
    return s.replace(/[\r\n\t]+/g, " ").replace(/[^\x20-\x7e]/g, "?");
  }

  var COLORS = { PANEL_CUT: 7, PANEL_FINISHED: 8, V: 3, H: 5, GROOVE: 1, SLOT: 6, MILL: 4, INFO_TEXT: 2 };

  /* ---------- scriitor de entități ---------- */
  function Doc() { this.ents = []; this.layers = {}; }
  Doc.prototype.layer = function (name, color) { if (!this.layers[name]) this.layers[name] = color; return name; };
  Doc.prototype.push = function (pairs) { this.ents.push(pairs.map(function (p) { return p[0] + "\n" + p[1]; }).join("\n")); };
  Doc.prototype.circle = function (layer, x, y, dia) {
    this.push([[0, "CIRCLE"], [8, layer], [10, n(x)], [20, n(y)], [30, 0], [40, nr(r1(dia) / 2)]]);
  };
  Doc.prototype.line = function (layer, x1, y1, x2, y2) {
    this.push([[0, "LINE"], [8, layer], [10, n(x1)], [20, n(y1)], [30, 0], [11, n(x2)], [21, n(y2)], [31, 0]]);
  };
  Doc.prototype.text = function (layer, x, y, h, s) {
    this.push([[0, "TEXT"], [8, layer], [10, n(x)], [20, n(y)], [30, 0], [40, nr(h)], [1, ascii(s)]]);
  };
  /* polilinie închisă: pts = [[x,y,bulge?]…] */
  Doc.prototype.poly = function (layer, pts) {
    var out = [[0, "POLYLINE"], [8, layer], [66, 1], [10, 0], [20, 0], [30, 0], [70, 1]];
    var self = this; self.push(out);
    pts.forEach(function (p) {
      var v = [[0, "VERTEX"], [8, layer], [10, n(p[0])], [20, n(p[1])], [30, 0]];
      if (p[2]) v.push([42, String(Math.round(p[2] * 1e6) / 1e6)]);
      self.push(v);
    });
    self.push([[0, "SEQEND"], [8, layer]]);
  };
  Doc.prototype.rect = function (layer, x0, y0, x1, y1) {
    this.poly(layer, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  };
  Doc.prototype.toString = function (ext, header) {
    var L = [];
    (header || []).forEach(function (c) { L.push("999\n" + ascii(c)); });
    L.push("0\nSECTION\n2\nHEADER", "9\n$ACADVER\n1\nAC1009",
      "9\n$EXTMIN\n10\n" + n(ext[0]) + "\n20\n" + n(ext[1]) + "\n30\n0",
      "9\n$EXTMAX\n10\n" + n(ext[2]) + "\n20\n" + n(ext[3]) + "\n30\n0", "0\nENDSEC");
    var names = Object.keys(this.layers);
    L.push("0\nSECTION\n2\nTABLES", "0\nTABLE\n2\nLTYPE\n70\n1", "0\nLTYPE\n2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0",
      "0\nENDTAB", "0\nTABLE\n2\nLAYER\n70\n" + names.length);
    names.forEach(function (nm, i) {
      L.push("0\nLAYER\n2\n" + nm + "\n70\n0\n62\n" + this.layers[nm] + "\n6\nCONTINUOUS");
    }, this);
    L.push("0\nENDTAB", "0\nENDSEC", "0\nSECTION\n2\nENTITIES");
    this.ents.forEach(function (e) { L.push(e); });
    L.push("0\nENDSEC", "0\nEOF");
    return L.join("\n") + "\n";
  };

  /* ---------- muchii ---------- */
  /* fața operației pe vederea feței 5: 1 jos, 2 dreapta, 3 sus, 4 stânga
     (la fel ca foaia A3). Pe fața 6 stânga/dreapta se schimbă. */
  function edgeName(face, mir) {
    var m = { 1: "BOTTOM", 3: "TOP", 4: mir ? "RIGHT" : "LEFT", 2: mir ? "LEFT" : "RIGHT" };
    return m[face] || null;
  }

  function zName(op, thk) { return op.through ? "THRU" : lnum(op.depth); }

  /* colțuri rotunjite cu bulge = tan(θ/4) = tan(π/8) pentru un sfert de cerc */
  var BULGE90 = Math.tan(Math.PI / 8);
  function roundedRect(x0, y0, x1, y1, r) {
    r = Math.max(0, Math.min(r || 0, (x1 - x0) / 2, (y1 - y0) / 2));
    if (!(r > 0)) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    return [[x0 + r, y0, 0], [x1 - r, y0, BULGE90], [x1, y0 + r, 0], [x1, y1 - r, BULGE90],
      [x1 - r, y1, 0], [x0 + r, y1, BULGE90], [x0, y1 - r, 0], [x0, y0 + r, BULGE90]];
  }

  /* ---------- un fișier = o piesă, o față ----------
   * pc   piesa din Modelul de Operații
   * o.face      5 | 6 (implicit 5)
   * o.cutMode   "final" (implicit) | "cut"  — „cut" cere o.cut = {L, W}
   * o.meta      { n, total, role, material, grain, edge, project, ver }
   */
  function partDXF(pc, o) {
    o = o || {}; var meta = o.meta || {};
    var face = o.face === 6 ? 6 : 5, mir = face === 6;
    var L = pc.length, W = pc.width, T = pc.thickness;
    var X = function (x) { return mir ? L - x : x; };
    var ops = pc.operations || [];
    var doc = new Doc();
    var cutMode = o.cutMode === "cut" && o.cut && o.cut.L > 0 && o.cut.W > 0 && !pc.poly;

    /* contur (finit) */
    var finished = [];
    if (pc.poly) finished.push(pc.poly.map(function (q) { return [X(q[0]), q[1]]; }));
    else (pc.outline || [{ x0: 0, y0: 0, x1: L, y1: W }]).forEach(function (r) {
      var a = X(r.x0), b = X(r.x1);
      finished.push([[Math.min(a, b), r.y0], [Math.max(a, b), r.y0], [Math.max(a, b), r.y1], [Math.min(a, b), r.y1]]);
    });
    var cl = doc.layer("PANEL_CUT", COLORS.PANEL_CUT);
    if (cutMode) {
      doc.poly(cl, [[0, 0], [o.cut.L, 0], [o.cut.L, o.cut.W], [0, o.cut.W]]);
      var fl = doc.layer("PANEL_FINISHED", COLORS.PANEL_FINISHED);
      finished.forEach(function (pts) { doc.poly(fl, pts); });
    } else finished.forEach(function (pts) { doc.poly(cl, pts); });

    var occupied = [];               /* puncte ocupate de operații, pentru plasarea textului */
    function occ(x, y, rad) { occupied.push([x, y, rad || 0]); }

    ops.forEach(function (x) {
      if (x.type === "drill" && x.face >= 5) {
        if (!(x.through || x.face === face)) return;
        var lay = doc.layer("DRILL_V_D" + lnum(x.dia) + "_Z" + zName(x, T), COLORS.V);
        doc.circle(lay, X(x.x), x.y, x.dia); occ(X(x.x), x.y, x.dia / 2);
      } else if (x.type === "drill" && x.face < 5) {
        var en = edgeName(x.face, mir); if (!en) return;
        var h = doc.layer("DRILL_H_" + en + "_D" + lnum(x.dia) + "_Z" + lnum(x.depth), COLORS.H);
        var u = x.u, z = x.z != null ? x.z : T / 2, px, py, qx, qy;
        if (x.face === 1) { px = X(u); py = 0; qx = px; qy = x.depth; }
        else if (x.face === 3) { px = X(u); py = W; qx = px; qy = W - x.depth; }
        else if (en === "LEFT") { px = 0; py = u; qx = x.depth; qy = py; }
        else { px = L; py = u; qx = L - x.depth; qy = py; }
        doc.line(h, px, py, qx, qy);
        doc.text(h, qx, qy, 2, "Z=" + n(z));
        occ(qx, qy, 6);
      } else if (x.type === "groove" && x.face >= 5 && (x.face === face || x.through)) {
        var gx0 = Math.min(X(x.from.x), X(x.to.x)), gx1 = Math.max(X(x.from.x), X(x.to.x));
        var gy0 = Math.min(x.from.y, x.to.y), gy1 = Math.max(x.from.y, x.to.y);
        var hz = Math.abs(x.to.x - x.from.x) >= Math.abs(x.to.y - x.from.y);
        var rx0 = hz ? gx0 : gx0 - x.width / 2, rx1 = hz ? gx1 : gx0 + x.width / 2;
        var ry0 = hz ? gy0 - x.width / 2 : gy0, ry1 = hz ? gy0 + x.width / 2 : gy1;
        doc.rect(doc.layer("GROOVE_Z" + lnum(x.depth) + "_W" + lnum(x.width), COLORS.GROOVE), rx0, ry0, rx1, ry1);
        occ((rx0 + rx1) / 2, (ry0 + ry1) / 2, Math.max(rx1 - rx0, ry1 - ry0) / 2);
      } else if (x.type === "slot" && x.face >= 5 && x.face === face) {
        var sw = x.ori === "X" ? x.len : x.thk, sh = x.ori === "X" ? x.thk : x.len, sx = X(x.x);
        doc.rect(doc.layer("SLOT_Z" + lnum(x.depth) + "_W" + lnum(x.thk), COLORS.SLOT), sx - sw / 2, x.y - sh / 2, sx + sw / 2, x.y + sh / 2);
        occ(sx, x.y, Math.max(sw, sh) / 2);
      } else if (x.type === "mill" && x.face >= 5 && (x.face === face || x.through)) {
        var mx = X(x.x);
        doc.poly(doc.layer("MILL_Z" + (x.through ? "THRU" : lnum(x.depth)), COLORS.MILL), roundedRect(mx - x.w / 2, x.y - x.d / 2, mx + x.w / 2, x.y + x.d / 2, x.r));
        occ(mx, x.y, Math.max(x.w, x.d) / 2);
      }
    });

    /* ---- INFO_TEXT: în interiorul piesei, în afara zonelor de găurire ---- */
    var nn = meta.n == null ? "" : "#" + String(meta.n).padStart(3, "0") + (meta.total ? "/" + meta.total : "");
    var lines = [];
    var l1 = [nn, meta.role].filter(Boolean).join(" ");
    if (l1) lines.push(l1);
    if (meta.material) lines.push(meta.material);
    if (meta.grain) lines.push("---->");
    if (meta.edge) lines.push(meta.edge);
    if (lines.length) {
      var il = doc.layer("INFO_TEXT", COLORS.INFO_TEXT);
      var minX = Math.min.apply(null, finished.map(function (p) { return Math.min.apply(null, p.map(function (q) { return q[0]; })); }));
      var maxX = Math.max.apply(null, finished.map(function (p) { return Math.max.apply(null, p.map(function (q) { return q[0]; })); }));
      var maxLen = Math.max.apply(null, lines.map(function (s) { return ascii(s).length; }));
      var hgt = Math.max(2.5, Math.min(10, (maxX - minX) / (maxLen * 0.75 + 2), (W - 4) / (lines.length * 1.6 + 1)));
      var bw = maxLen * hgt * 0.75, bh = lines.length * hgt * 1.6;
      /* cea mai liberă poziție: grilă peste piesă, scor = distanța minimă până la o operație */
      var best = null;
      for (var gi = 0; gi <= 12; gi++) for (var gj = 0; gj <= 12; gj++) {
        var tx0 = minX + 2 + (maxX - minX - bw - 4) * gi / 12, ty0 = 2 + (W - bh - 4) * gj / 12;
        if (bw > maxX - minX - 2 || bh > W - 2) { tx0 = minX + 1; ty0 = 1; }
        var d = 1e9, cx = tx0 + bw / 2, cy = ty0 + bh / 2;
        occupied.forEach(function (q) {
          var dx = Math.max(Math.abs(cx - q[0]) - bw / 2, 0), dy = Math.max(Math.abs(cy - q[1]) - bh / 2, 0);
          d = Math.min(d, Math.sqrt(dx * dx + dy * dy) - q[2]);
        });
        if (!best || d > best.d + 1e-9) best = { d: d, x: tx0, y: ty0 };
      }
      lines.forEach(function (s, i) { doc.text(il, best.x, best.y + bh - hgt * 1.6 * (i + 1) + hgt * 0.4, hgt, s); });
    }

    var ext = [Math.min(0, minOf(finished, 0)), 0, Math.max(L, cutMode ? o.cut.L : 0), Math.max(W, cutMode ? o.cut.W : 0)];
    return doc.toString(ext, ["Ebanist " + (meta.ver || "") + " - DXF R12, units: mm, face " + face + ", dxf-module " + VERSION,
      "origin (0,0) = bottom-left of face " + face + (mir ? " (X mirrored)" : ""),
      cutMode ? "PANEL_CUT = cut size; operations stay in FINISHED-panel coordinates (PANEL_FINISHED)" : "PANEL_CUT = finished size",
      "hardware drill positions marked verified:false in the app are NOT machine-verified"]);
  }
  function minOf(polys, k) { return Math.min.apply(null, polys.map(function (p) { return Math.min.apply(null, p.map(function (q) { return q[k]; })); })); }

  /* un nume de fișier sigur */
  function safeName(s) { return ascii(s).replace(/[^\w.\-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "piece"; }

  /* fișierele unei piese: fața 5, plus fața 6 dacă are operații acolo */
  function dxfFilesForPart(pc, o) {
    o = o || {};
    var base = safeName(o.name || ("piece_" + (pc.pk != null ? pc.pk : "")));
    var out = [{ name: base + (pc.operations && pc.operations.some(function (x) { return x.face === 6; }) ? "_F5" : "") + ".dxf", text: partDXF(pc, Object.assign({}, o, { face: 5 })) }];
    if ((pc.operations || []).some(function (x) { return x.face === 6; }))
      out.push({ name: base + "_F6.dxf", text: partDXF(pc, Object.assign({}, o, { face: 6 })) });
    return out;
  }

  /* ---------- ZIP „stored" (fără compresie), fără dependențe ---------- */
  var CRC_T = null;
  function crc32(u8) {
    if (!CRC_T) { CRC_T = []; for (var i = 0; i < 256; i++) { var c = i; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC_T[i] = c >>> 0; } }
    var crc = 0xFFFFFFFF;
    for (var j = 0; j < u8.length; j++) crc = CRC_T[(crc ^ u8[j]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function zipStore(files) {
    var enc = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
    var chunks = [], central = [], off = 0;
    function w16(a, v) { a.push(v & 255, (v >>> 8) & 255); }
    function w32(a, v) { a.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255); }
    var names = {};
    files.forEach(function (f) {
      var nm = f.name; if (names[nm]) { var k = 2; while (names[nm.replace(/(\.[^.]*)?$/, "_" + k + "$1")]) k++; nm = nm.replace(/(\.[^.]*)?$/, "_" + k + "$1"); }
      names[nm] = 1;
      var nb = enc.encode(nm), data = typeof f.data === "string" ? enc.encode(f.data) : f.data, crc = crc32(data);
      var h = []; w32(h, 0x04034b50); w16(h, 20); w16(h, 0x0800); w16(h, 0); w16(h, 0); w16(h, 0x21);
      w32(h, crc); w32(h, data.length); w32(h, data.length); w16(h, nb.length); w16(h, 0);
      chunks.push(Uint8Array.from(h), nb, data);
      var c = []; w32(c, 0x02014b50); w16(c, 20); w16(c, 20); w16(c, 0x0800); w16(c, 0); w16(c, 0); w16(c, 0x21);
      w32(c, crc); w32(c, data.length); w32(c, data.length); w16(c, nb.length); w16(c, 0); w16(c, 0); w16(c, 0); w16(c, 0); w32(c, 0); w32(c, off);
      central.push(Uint8Array.from(c), nb);
      off += h.length + nb.length + data.length;
    });
    var csize = 0; central.forEach(function (a) { csize += a.length; });
    var e = []; w32(e, 0x06054b50); w16(e, 0); w16(e, 0); w16(e, files.length); w16(e, files.length); w32(e, csize); w32(e, off); w16(e, 0);
    var all = chunks.concat(central, [Uint8Array.from(e)]), tot = 0; all.forEach(function (a) { tot += a.length; });
    var out = new Uint8Array(tot), p = 0; all.forEach(function (a) { out.set(a, p); p += a.length; });
    return out;
  }

  /* pachetul proiectului: items = [{ pc, name, meta, cut }] */
  function projectZip(items, o) {
    o = o || {};
    var files = [];
    items.forEach(function (it) {
      dxfFilesForPart(it.pc, { name: it.name, meta: it.meta, cutMode: o.cutMode, cut: it.cut }).forEach(function (f) {
        files.push({ name: f.name, data: f.text });
      });
    });
    return zipStore(files);
  }

  var API = { partDXF: partDXF, dxfFilesForPart: dxfFilesForPart, projectZip: projectZip, zipStore: zipStore, crc32: crc32,
    safeName: safeName, ascii: ascii, VERSION: VERSION };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.EBDxf = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
