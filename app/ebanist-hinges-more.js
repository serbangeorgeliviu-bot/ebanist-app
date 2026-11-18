/* Ebanist — balamale Hettich (Sensys, Intermat, Avosys), Salice (Silentia+, Air, Vetro, pivot, de colț), Grass (Tiomos, Nexis), Häfele (Metalla, 165°,
 * 270°, pie-cut) și Blum CLIP top BLUMOTION 105° / M BLUMOTION 105°. PUR: fără DOM, fără stare.
 *
 * Datele vin din EBHingesMoreData (ebanist-hinges-more-data.js, generat de tools/hw-data-build-hinges.mjs din documente oficiale; ce nu e citit = null).
 * Textele din ebanist-hinges-more-i18n.js. Nimic de aici nu e „verificat" (D-48): găurirea e o ORIENTARE până la o piesă reală.
 *
 * Reguli (cele ale proiectului, D-48 / D-133…D-141):
 *   - o gaură se generează numai dacă datele dau diametrul, adâncimea ȘI repere scrise în tabel/text (`src` "text"/"table"); o valoare citită
 *     numai dintr-un desen (`src` "drawing") nu produce gaură — se spune că se fixează cu șablonul producătorului;
 *   - cupa: diametrul și adâncimea din date; unde sursa dă numai o adâncime MINIMĂ (Grass, Häfele) se folosește cea mai mare dintre minim și
 *     setarea proiectului; unde nu dă nimic, setarea proiectului (ca la Blum);
 *   - numărul de balamale: tabelul producătorului (înălțime și greutate maxime pe număr); fără tabel, regula generală după înălțime;
 *   - desenul 3D: cupa, fixările (acolo unde modelul e cunoscut), placuța (rând de găuri, interax) și lungimea brațului (unde e etichetată) sunt din date;
 *     corpul balamalei și brațul sunt forme de REFERINȚĂ (SCHEM): producătorii nu publică gabaritul.
 *
 *   EBHingesMore.familyOfHw(id) / .partOfHw(id) / .catalogEntries(known) / .geomOf(id, plateId) / .platesOf(id) / .count(id, h, kg)
 *   EBHingesMore.fit(id, {th,h,w,kg}) → [{k,v,lo,hi,n}] · .opsNotes(g) · .doorKg(h,w,th,dens) · .sheetHtml(id,{lang,plate})
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.EBHingesMore = factory(root);
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";
  var DATA = root.EBHingesMoreData || { brands: [], plates: [], families: [] };
  var FAMS = DATA.families, PLATE = {}, IDX = {}, BYKEY = {};
  DATA.plates.forEach(function (p) { PLATE[p.id] = p; });
  FAMS.forEach(function (f) { BYKEY[f.key] = f; f.parts.forEach(function (p) { IDX[p.id] = { fam: f, p: p }; }); });
  /* articol Blum CLIP top din datele existente (ebanist-hinges.js): de aici se iau plăcuțele CLIP pentru CLIP top BLUMOTION 105° */
  var BLUM_REF = "blum_71b3590";

  /* proporții de REFERINȚĂ pentru desenul 3D (mm): nu sunt cotele niciunui produs */
  var SCHEM = { flangeW: 24, flangeT: 1.6, armW: 20, armT: 3, armLen: 66, armTop: 23, armTopInset: 27, plateT: 3, plateW: 40, link: 17 };

  function tr(lang, k) { var T = root.HINGES_MORE_I18N; return (T && ((T[lang] && T[lang][k]) || (T.en && T.en[k]))) || k; }
  function list() { return FAMS.slice(); }
  function family(key) { return BYKEY[key] || null; }
  function familyOfHw(id) { return IDX[id] ? IDX[id].fam : null; }
  function partOfHw(id) { return IDX[id] ? IDX[id].p : null; }
  function isMore(id) { return !!IDX[id]; }
  function round(v, d) { var k = Math.pow(10, d == null ? 1 : d); return Math.round(v * k) / k; }

  /* ---- nume de articol, în 7 limbi, din câmpurile structurate ---- */
  var FIXWORD = { screw: "screw", woodscrew: "woodscrew", press: "press", fix: "fix", premount: "premount", dowel: "dowel", rapido: "rapido", glued: "glued", impresso: "impresso", knockin: "press", expando: "premount" };
  function nameOf(fam, p, lang) {
    var w = function (k) { return tr(lang, "hmw_" + k); }, out = [], ov = p.overlay;
    /* unghiul se scrie o dată: seria care îl conține deja („Tiomos 110”, „165”) primește numai semnul grade */
    out.push(fam.angle ? (new RegExp("(^|\\s)" + fam.angle + "$").test(fam.series) ? fam.series + "°" : fam.series + " " + fam.angle + "°") : fam.series);
    if (ov) {
      if (/^crank/.test(ov)) out.push(w("crank") + " " + ov.slice(5).replace(/_/g, "/"));
      else if (/^overlay\d*$/.test(ov)) out.push(w("overlay"));
      else out.push(w(ov));
    }
    if (p.variant) {
      if (/^(W\d+|MD\d+)$/.test(p.variant)) out.push(p.variant);
      else if (/^arm\d+$/.test(p.variant)) out.push(w("arm") + " " + p.variant.slice(3));
      else if (p.variant === "set") out.push(w("set"));
      else if (p.variant === "glass-3-8") out.push(w("glass38"));
      else if (p.variant === "glass-4-6") out.push(w("glass46"));
    }
    if (p.fix && FIXWORD[p.fix]) out.push(w(FIXWORD[p.fix]));
    else if (p.fix && fam.fix && fam.fix[p.fix]) out.push(w(fam.fix[p.fix].mode) + " (" + p.fix + ")");
    if (p.pattern) out.push(p.pattern.spacing + "/" + p.pattern.offset);
    if (p.soft === true) out.push(w("soft"));
    if (p.spring === "unsprung") out.push(w("unsprung"));
    if (p.push) out.push(w("push"));
    if (p.colour) out.push(w(p.colour));
    if (!p.art) out.push(w("nocode"));
    return out.join(" · ");
  }
  /* articolele pentru HWDB.cern: câte unul pe cod de comandă (sau pe braț, unde codul nu e transcris); prețul 0 = de completat în Catalog */
  function catalogEntries(known) {
    var seen = {}, out = [];
    (known || []).forEach(function (id) { seen[id] = 1; });
    FAMS.forEach(function (f) {
      f.parts.forEach(function (p) {
        if (seen[p.id]) return;
        var n = {}; ["it", "ro", "en", "fr", "de", "pl", "es"].forEach(function (l) { n[l] = nameOf(f, p, l); });
        out.push({ id: p.id, brand: f.brand, n: n, art: p.art || "—", price: 0, chk: 1, hing: f.key, more: 1 });
      });
    });
    return out;
  }

  /* ---- plăcuțe ---- */
  function blumPlates() {
    var B = root.EBHinges, fam = B && B.familyOfHw && B.familyOfHw(BLUM_REF);
    return fam && fam.plates ? fam.plates.map(function (id) { var pl = B.plateById(id); return pl ? { id: id, kind: pl.kind, art: pl.art, name: pl.name, blum: true } : null; }).filter(Boolean) : [];
  }
  function platesOf(hwId) {
    var e = IDX[hwId]; if (!e) return [];
    if (e.fam.plates === "blum-clip") return blumPlates();
    return (e.fam.plates || []).map(function (id) { var p = PLATE[id]; return p ? { id: p.id, kind: p.kind, art: p.art, name: p.name } : null; }).filter(Boolean);
  }
  function plateById(id) { return PLATE[id] || null; }

  /* ---- găurirea pentru motorul de găurire (ebanist-ops.js, prin `hingeGeom(cfg)` din aplicație) ---- */
  var NEEDS_HOLES = { press: 1, fix: 1, premount: 1, dowel: 1 };
  function resolved(src) { return src === "text" || src === "table"; }
  function geomOf(hwId, plateId) {
    var e = IDX[hwId]; if (!e) return null;
    var fam = e.fam, p = e.p, fx = (fam.fix && p.fix && fam.fix[p.fix]) || null, c = fam.cup || {};
    var g = { more: true, hwId: hwId, art: p.art, family: fam.key, brand: fam.brand, noDrill: !!fam.noDrill, glass: !!fam.glass };
    /* cupa */
    if (!g.noDrill && c.dia > 0) g.cup_dia = c.dia;
    var depth = fx && fx.cupDepth != null ? fx.cupDepth : c.depth;
    if (depth != null) g.cup_depth = depth;
    if (c.depthMin != null) g.cup_depth_min = c.depthMin;
    g.tb = c.tb ? c.tb.slice() : null;
    /* dornuri: gaură numai cu diametru + adâncime + interax + decalaj scrise în text/tabel (nu doar pe desen) */
    var mode = fx ? fx.mode : null, pat = p.pattern || (fx && fx.pattern) || null, hole = fx && fx.hole;
    var needs = !g.noDrill && !!NEEDS_HOLES[mode];
    var okD = needs && hole && hole.dia > 0 && hole.depth > 0 && pat && pat.spacing > 0 && pat.offset >= 0 && resolved(pat.src);
    g.dowels = !!okD;
    if (okD) { g.dowel_dia = hole.dia; g.dowel_depth = hole.depth; g.dowel_spacing = pat.spacing; g.dowel_offset = pat.offset; }
    g.dowelOpen = needs && !okD;
    /* placuța */
    var pl = null, blum = fam.plates === "blum-clip", bg = null;
    var bpid = null;
    if (blum && root.EBHinges) { bpid = plateId && blumPlates().some(function (q) { return q.id === plateId; }) ? plateId : null; bg = root.EBHinges.geomOf(BLUM_REF, bpid); }   /* o placuță de altă marcă din setări nu se aplică aici */
    else if (Array.isArray(fam.plates) && fam.plates.length) pl = PLATE[plateId] && fam.plates.indexOf(plateId) >= 0 ? PLATE[plateId] : PLATE[fam.plates[0]];
    var lineKnown = false;
    if (bg && bg.plate_front > 0) {
      g.plate_front = bg.plate_front; g.plate_spacing = bg.plate_spacing; g.plate = bg.plate; g.plateHoles = true; lineKnown = true; g.plateId = bpid;
    } else if (pl) {
      g.plateId = pl.id;
      if (pl.line > 0 && pl.pitch > 0) { g.plate_front = pl.line; g.plate_spacing = pl.pitch; lineKnown = true; }
      var okP = lineKnown && resolved(pl.lineSrc) && pl.hole && pl.hole.dia > 0 && pl.hole.depth > 0 && (pl.kind === "cruciform" || pl.kind === "linear");
      g.plateHoles = !!okP;
      if (okP) { g.plate_dia = pl.hole.dia; g.plate_depth = pl.hole.depth; g.plate = { kind: pl.kind === "linear" ? "horizontal" : "cruciform", art: pl.art[0] }; }
      else if (pl.kind === "linear") g.plate = { kind: "horizontal", art: pl.art[0] };
    } else g.plateHoles = false;
    if (g.noDrill) { g.plateHoles = false; g.dowels = false; delete g.plate_dia; delete g.plate_depth; }   /* sticlă / aluminiu / tăietură specială: nicio gaură de balama (opsNotes spune de ce) */
    g.plateOpen = !g.noDrill && !g.plateHoles;
    /* date pentru desenul 3D (numai ce e din surse; restul = SCHEM) */
    g.d3 = { brand: fam.brand, kind: fam.kind, angle: fam.angle, overlay: p.overlay, fixMode: mode, fixPattern: pat ? { spacing: pat.spacing, offset: pat.offset } : null,
             fixDia: hole && hole.dia ? hole.dia : null, plateKind: pl ? pl.kind : (bg ? (bg.plate && bg.plate.kind === "horizontal" ? "linear" : "cruciform") : null),
             armLen: fam.armLen && fam.armLen.v > 0 ? fam.armLen.v : null, glass: !!fam.glass, noDrill: !!fam.noDrill, lineKnown: lineKnown };
    return g;
  }
  /* avertismentele de găurire ale unei balamale (o dată pe grup de uși) */
  function opsNotes(g) {
    var o = [];
    if (!g || !g.more) return o;
    if (g.glass) o.push("opsHingeGlass"); else if (g.noDrill) o.push("opsHingeNoDrill");
    if (g.dowelOpen) o.push("opsHingeDowelOpen");
    if (g.plateOpen) o.push("opsHingePlateOpen");
    return o;
  }

  /* ---- numărul de balamale și verificările ---- */
  function doorKg(h, w, th, dens) { return (+h > 0 && +w > 0 && +th > 0 && +dens > 0) ? h * w * th * dens / 1e9 : 0; }
  function rowsOf(hwId) { var e = IDX[hwId], c = e && e.fam.count; return c && c.rows && c.rows.length ? c.rows : null; }
  function count(hwId, h, kg) {
    var rows = rowsOf(hwId); if (!rows || !(h > 0)) return null;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.h != null && h > r.h) continue;
      if (kg > 0 && r.kg && r.kg[1] != null && kg > r.kg[1]) continue;
      return r.n;
    }
    return rows[rows.length - 1].n;
  }
  function fit(hwId, d) {
    var e = IDX[hwId], out = []; if (!e) return out;
    var f = e.fam, c = f.count, T = f.doorTh || [null, null];
    if (d.th > 0 && ((T[0] != null && d.th < T[0]) || (T[1] != null && d.th > T[1]))) out.push({ k: "th", v: d.th, lo: T[0], hi: T[1] });
    var rows = rowsOf(hwId);
    if (rows) {
      var last = rows[rows.length - 1];
      if (last.h != null && d.h > last.h) out.push({ k: "h", v: Math.round(d.h), hi: last.h });
      if (c.widthMax != null && d.w > c.widthMax) out.push({ k: "w", v: Math.round(d.w), hi: c.widthMax });
      if (d.kg > 0) { var n = count(hwId, d.h, d.kg), r = rows.filter(function (x) { return x.n === n; })[0]; if (r && r.kg && r.kg[1] != null && d.kg > r.kg[1]) out.push({ k: "kg", v: round(d.kg), n: r.n, hi: r.kg[1] }); }
    }
    if (f.airMax) {
      if (d.h > f.airMax.h) out.push({ k: "h", v: Math.round(d.h), hi: f.airMax.h });
      if (d.w > f.airMax.w) out.push({ k: "w", v: Math.round(d.w), hi: f.airMax.w });
      if (d.kg > f.airMax.kg) out.push({ k: "kg", v: round(d.kg), n: 1, hi: f.airMax.kg });
    }
    return out;
  }

  /* ---- profilul brațului pentru desenul 3D (în planul z–xo, ca hingeArm din ebanist-hwgeom.js), cu lungimea din date unde e etichetată ---- */
  function armProfile(zNear, inset, len, t) {
    var L = len > 0 ? len : SCHEM.armLen, top = inset ? SCHEM.armTopInset : SCHEM.armTop, th = t == null ? 1.3 : t, zFar = zNear - (L - 16);
    var up = [[zNear, top - 3], [zNear - 3, top], [zFar + 16, top - 7.5], [zFar, top - 10]];
    var outer = [[zFar, 3], [zNear, 3]].concat(up);
    var skin = up.concat(up.slice().reverse().map(function (q) { return [q[0], q[1] - th]; }));
    return { outer: outer, skin: skin, zFar: zFar, width: SCHEM.armW, t: th };
  }

  /* ---- fișa tehnică (butonul din Catalog) ---- */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function rng(a) { return a ? (a[0] == null ? "—" : a[0]) + "–" + (a[1] == null ? "—" : a[1]) : "—"; }
  function tableGeneric(t) {
    var cols = t.cols || [], rows = t.rows || {};
    return '<table class="hs-t"><caption>' + esc(t.title || "") + "</caption>" +
      (cols.length ? "<tr><th>" + esc(t.rowLabel || "") + (t.colLabel ? " \\ " + esc(t.colLabel) : "") + "</th>" + cols.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr>" : "") +
      Object.keys(rows).map(function (r) { var v = rows[r]; return "<tr><th>" + esc(r) + "</th>" + (Array.isArray(v) ? v : [v]).map(function (x) { return "<td>" + (x == null ? "" : esc(typeof x === "object" ? JSON.stringify(x) : x)) + "</td>"; }).join("") + "</tr>"; }).join("") + "</table>";
  }
  function sheetHtml(hwId, opts) {
    opts = opts || {}; var e = IDX[hwId]; if (!e) return null;
    var lang = opts.lang || "en", f = e.fam, p = e.p, g = geomOf(hwId, opts.plate), c = f.cup || {}, B = root.EBHinges;
    var h = '<div class="hs"><h4>' + esc(f.brand + " " + nameOf(f, p, lang)) + (p.art ? " · " + esc(p.art) : "") + "</h4>";
    h += '<p class="mini">' + esc(tr(lang, "hmDoorTh")) + ": " + rng(f.doorTh) + " · " + esc(tr(lang, "hmUnv")) + "</p>";
    /* desenul ușii: numai când cupa se găurește în lemn */
    if (!f.noDrill && c.dia > 0 && B && B.svgDoor) {
      var TB = opts.TB != null ? opts.TB : 5; if (c.tb) TB = Math.min(Math.max(TB, c.tb[0]), c.tb[1]);
      var fam = { cup: { dia: c.dia, depth: g.cup_depth != null ? g.cup_depth : null, tb: c.tb }, dowel: g.dowels ? { dia: g.dowel_dia, spacing: g.dowel_spacing, offset: g.dowel_offset, tol: 0 } : null };
      h += '<div class="hs-draw">' + B.svgDoor(fam, TB, lang) + (g.plate_front > 0 && g.plateHoles && B.svgPlate ? B.svgPlate({ kind: g.plate && g.plate.kind === "horizontal" ? "horizontal" : "cruciform", front: g.plate_front, pitch: g.plate_spacing }, lang) : "") + "</div>";
    }
    h += '<table class="hs-t"><tr><th>' + esc(tr(lang, "hmCup")) + "</th><td>" + (c.dia ? "Ø" + c.dia : esc(tr(lang, "hmNoValue"))) + "</td></tr>" +
      "<tr><th>" + esc(tr(lang, "hmCupDepth")) + "</th><td>" + (c.depth != null ? c.depth : esc(tr(lang, "hmNoValue"))) + "</td></tr>" +
      (c.depthMin != null ? "<tr><th>" + esc(tr(lang, "hmCupDepthMin")) + "</th><td>" + c.depthMin + "</td></tr>" : "") +
      "<tr><th>TB</th><td>" + (c.tb ? rng(c.tb) : esc(tr(lang, "hmNoValue"))) + "</td></tr></table>";
    var fk = Object.keys(f.fix || {});
    if (fk.length) h += "<h5>" + esc(tr(lang, "hmFix")) + '</h5><table class="hs-t">' + fk.map(function (k) { var x = f.fix[k]; return "<tr><th>" + esc(k) + "</th><td>" + esc(tr(lang, "hmw_" + (FIXWORD[x.mode] || x.mode))) + "</td><td>" +
      (x.pattern ? esc(tr(lang, "hmPattern")) + " " + x.pattern.spacing + " × " + x.pattern.offset + " (" + esc(x.pattern.src) + ")" : "") + "</td><td>" + (x.hole ? esc(tr(lang, "hmHole")) + " Ø" + x.hole.dia + " × " + (x.hole.depth == null ? "—" : x.hole.depth) : "") + "</td></tr>"; }).join("") + "</table>";
    if (f.glassHoles) h += "<h5>" + esc(tr(lang, "hmGlassHoles")) + '</h5><p class="mini">' + f.glassHoles.n + " × Ø" + f.glassHoles.dia + " · " + f.glassHoles.spacing + " mm</p>";
    var pls = platesOf(hwId);
    if (pls.length) h += "<h5>" + esc(tr(lang, "hmPlates")) + '</h5><table class="hs-t">' + pls.map(function (q) { var P = PLATE[q.id]; return "<tr><td>" + esc((q.art || []).join(" / ")) + "</td><td>" + esc(q.name || "") + "</td><td>" + (P && P.line ? esc(tr(lang, "hmPlateLine")) + " " + P.line + " × " + P.pitch + " (" + esc(P.lineSrc) + ")" : "") + "</td></tr>"; }).join("") + "</table>";
    /* ce generează aplicația și ce nu */
    var yes = [], no = [];
    if (!f.noDrill && c.dia > 0) yes.push(tr(lang, "hmDrillCup") + " Ø" + c.dia);
    if (g.plateHoles) yes.push(tr(lang, "hmDrillPlate")); else if (!f.noDrill) no.push(tr(lang, "hmDrillPlate"));
    if (g.dowels) yes.push(tr(lang, "hmDrillDowel")); else if (g.dowelOpen) no.push(tr(lang, "hmDrillDowel"));
    if (f.noDrill) no.push(tr(lang, f.glass ? "opsHingeGlass" : "opsHingeNoDrill"));
    h += "<h5>" + esc(tr(lang, "hmDrillYes")) + '</h5><p class="mini">' + esc(yes.join(" · ") || "—") + "</p>";
    if (no.length) h += '<p class="mini">' + esc(tr(lang, "hmDrillNo")) + ": " + esc(no.join(" · ")) + "</p>";
    h += '<p class="mini">' + esc(tr(lang, "hm3d")) + "</p>";
    if (f.count && f.count.rows) {
      var hd = tr(lang, "hmCountCols").split("|");
      h += "<h5>" + esc(tr(lang, "hmCount")) + '</h5><table class="hs-t"><tr>' + hd.map(function (x) { return "<th>" + esc(x) + "</th>"; }).join("") + "</tr>" +
        f.count.rows.map(function (r) { return "<tr><td>" + r.n + "</td><td>" + (r.h == null ? "" : r.h) + "</td><td>" + (r.kg ? (r.kg[0] != null ? r.kg[0] + "–" : "≤ ") + (r.kg[1] == null ? "" : r.kg[1]) : "") + "</td></tr>"; }).join("") + "</table>" +
        (f.count.widthMax ? '<p class="mini">' + esc(tr(lang, "hmWidthMax")) + ": " + f.count.widthMax + "</p>" : "");
    } else h += '<p class="mini">' + esc(tr(lang, "hmCountNone")) + "</p>";
    if (f.adjust) h += "<h5>" + esc(tr(lang, "hmAdjust")) + '</h5><p class="mini">' + esc(Object.keys(f.adjust).map(function (k) { return k + " " + JSON.stringify(f.adjust[k]); }).join(" · ")) + "</p>";
    if (f.tables && f.tables.length) h += "<h5>" + esc(tr(lang, "hmTables")) + "</h5>" + f.tables.map(tableGeneric).join("");
    var codes = f.parts.filter(function (x) { return x.art; });
    if (codes.length) h += "<h5>" + esc(tr(lang, "hmCodes")) + '</h5><table class="hs-t">' + codes.map(function (x) { return "<tr" + (x.id === p.id ? ' style="font-weight:700"' : "") + "><td>" + esc(x.art) + "</td><td>" + esc(nameOf(f, x, lang)) + "</td></tr>"; }).join("") + "</table>";
    if (f.conflicts && f.conflicts.length) h += "<h5>" + esc(tr(lang, "hmConf")) + "</h5>" + f.conflicts.map(function (x) { return '<p class="mini">• ' + esc(x) + "</p>"; }).join("");
    if (f.open && f.open.length) h += "<h5>" + esc(tr(lang, "hmOpen")) + "</h5>" + f.open.map(function (x) { return '<p class="mini">• ' + esc(x) + "</p>"; }).join("");
    h += '<p class="mini">' + esc(tr(lang, "hmNote")) + ": " + esc(f.src) + "</p></div>";
    return h;
  }

  return { SCHEM: SCHEM, list: list, family: family, familyOfHw: familyOfHw, partOfHw: partOfHw, isMore: isMore, nameOf: nameOf, catalogEntries: catalogEntries,
           platesOf: platesOf, plateById: plateById, geomOf: geomOf, opsNotes: opsNotes, doorKg: doorKg, count: count, fit: fit, armProfile: armProfile, sheetHtml: sheetHtml,
           OPS_KEYS: root.HINGES_MORE_OPS_KEYS || [], FAMILIES: FAMS };
});
