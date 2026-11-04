/* Ebanist — glisiere și casete Blum: date din catalog, fișă tehnică și desen.
 *
 * SURSA: Blum, „Catalogue and technical manual 2022/2023 (KA-150)", https://publications.blum.com/2022/catalogue/en/
 * Datele vin din ebanist-slides-data.js (generat de tools/blum-slides-build.mjs din tools/blum-slides-data/*.json, transcrise pe pagini).
 * Aceeași regulă ca la balamale (D-114): numai cote cu etichetă sau din tabel; ce nu s-a putut atribui (de ex. ce gaură are fiecare NL pe
 * desenele cu lanțuri de cote) e în `unreadable` și NU se folosește la găurire. Desenul se generează din cote, nu se reproduce.
 *
 *   cd test && node --test slides-blum.test.js
 */
(function (root) {
"use strict";

var SRC = "Blum, Catalogue and technical manual 2022/2023 (KA-150), publications.blum.com/2022/catalogue/en/";
var DATA = root.EBSlidesData || { systems: {} }, SYS = DATA.systems;

/* seriile de glisiere care intră în lista „Glisiere" a aplicației (id catalog = "blums_" + cheie). Preț orientativ, de corectat cu lista furnizorului. */
var RUNNERS = {
  movento_blumotion_s:     { price: 25, base: "blum_movento" },
  movento_tipon_blumotion: { price: 27, base: "blum_movento" },
  movento_tipon:           { price: 24, base: "blum_movento" },
  tandem_locking:          { price: 17, base: "blum_tandem" },
  tandem_hook_peg:         { price: 17, base: "blum_tandem" },
  tandem19_locking:        { price: 17, base: "blum_tandem" },
  tandem19_hook_peg:       { price: 17, base: "blum_tandem" }
};
/* sarcina: {kg:[..]} sau {kg: n} sau text */
function loadText(s, sep) {
  var l = s.load; if (l == null) return ""; var kg = l.kg != null ? l.kg : l;
  if (Array.isArray(kg)) return kg.join(sep) + " kg"; if (typeof kg === "number") return kg + " kg"; return typeof kg === "object" ? "" : String(kg);
}
/* codul-model fără NL: 760H2500S → 760H___S (NL × 10, NL + "1" la hook and peg, sau NL) */
function artPattern(p) {
  var nl = p.nl, a = p.art; if (typeof nl !== "number") return a;
  var cands = [String(nl * 10), String(nl) + "1", String(nl)];
  for (var i = 0; i < cands.length; i++) if (a.indexOf(cands[i]) > 0) return a.replace(cands[i], "___");
  return a;
}
function hwIdOf(key) { return "blums_" + key; }
function keyOfHw(id) { return /^blums_/.test(id || "") ? String(id).slice(6) : null; }
function system(key) { return SYS[key] || null; }
function systemOfHw(id) { var k = keyOfHw(id); return k && SYS[k] ? SYS[k] : null; }
function list(kind) { return Object.keys(SYS).filter(function (k) { return !kind || SYS[k].kind === kind; }).map(function (k) { return SYS[k]; }); }

/* lățimea cu care se strânge un sertar din lemn față de lățimea interioară (SKW = LW − x): din formula de tăiere din catalog */
function widthOff(key) {
  var s = SYS[key]; if (!s) return null;
  var c = s.cutting && s.cutting.constants && s.cutting.constants.widthOff; if (typeof c === "number") return -c;
  var f = ((s.cutting && s.cutting.formulas) || []).filter(function (x) { return /SKW|lățime|latime|width/i.test(x.piece || "") && /LW\s*[-–−]\s*(\d+)/.test(x.expr || ""); })[0];
  if (f) return +f.expr.match(/LW\s*[-–−]\s*(\d+)/)[1];
  return null;
}
/* poziții de fixare pe lateral după NL, numai când catalogul le dă fără echivoc: { NL: [mm de la fața dulapului] } */
function holesByNL(key) {
  var s = SYS[key], d = s && s.drill, out = null; if (!d) return null;
  Object.keys(d).forEach(function (k) {
    var o = d[k]; if (!/^byNL/.test(k) || !o || typeof o !== "object" || Array.isArray(o)) return;
    var ok = Object.keys(o).length && Object.keys(o).every(function (nl) { return /^\d+$/.test(nl) && Array.isArray(o[nl]) && o[nl].length && o[nl].every(function (v) { return typeof v === "number" && isFinite(v); }); });
    if (ok) out = o;
  });
  return out;
}
/* lungimile nominale: din `lengths`, altfel din NL-urile codurilor */
function lengthsOf(s) {
  if (s.lengths && s.lengths.length) return s.lengths.slice();
  var u = {}; (s.parts || []).forEach(function (p) { if (typeof p.nl === "number") u[p.nl] = 1; });
  return Object.keys(u).map(Number).sort(function (a, b) { return a - b; });
}
function nearestNL(s, NL) {
  var L = lengthsOf(s); if (!L.length) return null; var best = L[0];
  L.forEach(function (x) { if (Math.abs(x - NL) < Math.abs(best - NL)) best = x; }); return best;
}

/* articole pentru HWDB.guida: câte unul pe serie (codul concret se compune din NL la comandă) */
function catalogEntries(known) {
  var seen = {}, out = []; (known || []).forEach(function (i) { seen[i] = 1; });
  Object.keys(RUNNERS).forEach(function (k) {
    var s = SYS[k], id = hwIdOf(k); if (!s || seen[id]) return;
    var L = lengthsOf(s), nl = L.length ? "NL " + L[0] + "–" + L[L.length - 1] : "", kg = loadText(s, "/");
    var nm = s.name + (kg ? " · " + kg : "") + (nl ? " · " + nl : "") + " (pair)", p0 = (s.parts || [])[0];
    out.push({ id: id, brand: "Blum", n: { it: nm, ro: nm, en: nm, fr: nm, de: nm, pl: nm, es: nm }, art: p0 ? artPattern(p0) : "", price: RUNNERS[k].price, chk: 1, slides: k });
  });
  return out;
}

/* ---- text în 7 limbi, numai etichetele fișei ------------------------------------------------------------------------ */
var L = {
  ro: { src: "Sursa", load: "Sarcină", lengths: "Lungimi nominale NL (mm)", cab: "Cote de dulap (cu etichetă în catalog)", cut: "Tăiere (formule din catalog)", const: "Constante", drill: "Găurire pe lateral (de la fața dulapului)", front: "față", parts: "Coduri de comandă", tables: "Tabele", notes: "Note", unread: "Netranscris (de verificat pe pagina din catalog)", nl: "NL", pick: "pentru NL", noHoles: "Catalogul dă lanțuri de cote, fără poziții pe NL: nu se folosesc la găurire.", piece: "piesă", formula: "formulă", page: "pagina", more: "coduri", kind: { runner: "Glisieră", box: "Casetă metalică", accessory: "Accesorii", drill: "Găurire" } },
  it: { src: "Fonte", load: "Portata", lengths: "Lunghezze nominali NL (mm)", cab: "Quote del mobile (con etichetta nel catalogo)", cut: "Taglio (formule dal catalogo)", const: "Costanti", drill: "Foratura sul fianco (dal filo anteriore)", front: "fronte", parts: "Codici d'ordine", tables: "Tabelle", notes: "Note", unread: "Non trascritto (da verificare sulla pagina del catalogo)", nl: "NL", pick: "per NL", noHoles: "Il catalogo dà catene di quote, senza posizioni per NL: non si usano per forare.", piece: "pezzo", formula: "formula", page: "pagina", more: "codici", kind: { runner: "Guida", box: "Cassetto metallico", accessory: "Accessori", drill: "Foratura" } },
  en: { src: "Source", load: "Load", lengths: "Nominal lengths NL (mm)", cab: "Cabinet dimensions (labelled in the catalogue)", cut: "Cutting (formulas from the catalogue)", const: "Constants", drill: "Side drilling (from the cabinet front)", front: "front", parts: "Order information", tables: "Tables", notes: "Notes", unread: "Not transcribed (check on the catalogue page)", nl: "NL", pick: "for NL", noHoles: "The catalogue gives dimension chains, not positions per NL: they are not used for drilling.", piece: "piece", formula: "formula", page: "page", more: "codes", kind: { runner: "Runner", box: "Metal drawer box", accessory: "Accessories", drill: "Drilling" } },
  fr: { src: "Source", load: "Charge", lengths: "Longueurs nominales NL (mm)", cab: "Cotes du meuble (étiquetées dans le catalogue)", cut: "Débit (formules du catalogue)", const: "Constantes", drill: "Perçage latéral (depuis la façade du meuble)", front: "façade", parts: "Références", tables: "Tableaux", notes: "Notes", unread: "Non transcrit (à vérifier sur la page du catalogue)", nl: "NL", pick: "pour NL", noHoles: "Le catalogue donne des chaînes de cotes, sans positions par NL : elles ne servent pas au perçage.", piece: "pièce", formula: "formule", page: "page", more: "références", kind: { runner: "Coulisse", box: "Tiroir métallique", accessory: "Accessoires", drill: "Perçage" } },
  de: { src: "Quelle", load: "Tragkraft", lengths: "Nennlängen NL (mm)", cab: "Korpusmaße (im Katalog beschriftet)", cut: "Zuschnitt (Formeln aus dem Katalog)", const: "Konstanten", drill: "Seitenbohrung (ab Korpusvorderkante)", front: "Front", parts: "Bestelldaten", tables: "Tabellen", notes: "Hinweise", unread: "Nicht übertragen (auf der Katalogseite prüfen)", nl: "NL", pick: "für NL", noHoles: "Der Katalog gibt Maßketten, keine Positionen je NL: Sie werden nicht zum Bohren verwendet.", piece: "Teil", formula: "Formel", page: "Seite", more: "Nummern", kind: { runner: "Auszug", box: "Metallschubkasten", accessory: "Zubehör", drill: "Bohrung" } },
  pl: { src: "Źródło", load: "Nośność", lengths: "Długości nominalne NL (mm)", cab: "Wymiary korpusu (opisane w katalogu)", cut: "Krojenie (wzory z katalogu)", const: "Stałe", drill: "Wiercenie boku (od frontu korpusu)", front: "front", parts: "Numery zamówieniowe", tables: "Tabele", notes: "Uwagi", unread: "Nieprzepisane (sprawdź na stronie katalogu)", nl: "NL", pick: "dla NL", noHoles: "Katalog podaje łańcuchy wymiarów, bez pozycji dla NL: nie służą do wiercenia.", piece: "element", formula: "wzór", page: "strona", more: "numerów", kind: { runner: "Prowadnica", box: "Szuflada metalowa", accessory: "Akcesoria", drill: "Wiercenie" } },
  es: { src: "Fuente", load: "Carga", lengths: "Longitudes nominales NL (mm)", cab: "Cotas del mueble (rotuladas en el catálogo)", cut: "Despiece (fórmulas del catálogo)", const: "Constantes", drill: "Taladrado lateral (desde el frente del mueble)", front: "frente", parts: "Referencias", tables: "Tablas", notes: "Notas", unread: "No transcrito (revisar en la página del catálogo)", nl: "NL", pick: "para NL", noHoles: "El catálogo da cadenas de cotas, sin posiciones por NL: no se usan para taladrar.", piece: "pieza", formula: "fórmula", page: "página", more: "referencias", kind: { runner: "Guía", box: "Cajón metálico", accessory: "Accesorios", drill: "Taladrado" } }
};
function tr(lang, k) { return (L[lang] && L[lang][k]) || L.en[k] || k; }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function cell(v) { return esc(v != null && typeof v === "object" ? JSON.stringify(v) : v); }
function kv(o) { return Object.keys(o).map(function (k) { return "<tr><th>" + esc(k) + "</th><td>" + cell(o[k]) + "</td></tr>"; }).join(""); }

/* desen: lateralul văzut din lateral, fața dulapului la stânga; găurile pe un rând, cotate de la față */
function svgSide(pos, NL, lang) {
  var k = 0.9, S = function (v) { return Math.round(v * k * 10) / 10; }, len = NL + 20, w = S(len), h = 70;
  var out = '<svg class="hs-svg" viewBox="-20 -30 ' + (w + 60) + " " + (h + 70) + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(tr(lang, "drill")) + '">' +
    '<style>.hs-svg text{font:10px sans-serif;fill:currentColor}.hs-svg .p{fill:none;stroke:currentColor;stroke-width:1.2}.hs-svg .d{stroke:currentColor;stroke-width:.6;fill:none}</style>' +
    '<rect class="p" x="0" y="0" width="' + w + '" height="' + h + '"/><text x="2" y="-8">' + esc(tr(lang, "front")) + "</text><text x=\"" + w + '" y="-8" text-anchor="end">NL ' + NL + "</text>";
  pos.forEach(function (x, i) {
    out += '<circle class="p" cx="' + S(x) + '" cy="' + (h / 2) + '" r="' + S(2.5) + '"/><path class="d" d="M' + S(x) + " " + (h / 2 + 6) + " V" + (h + 8 + (i % 2) * 12) + '"/><text x="' + S(x) + '" y="' + (h + 20 + (i % 2) * 12) + '" text-anchor="middle">' + x + "</text>";
  });
  return out + "</svg>";
}
function tableGeneric(t) {
  var cols = t.cols || [], rows = t.rows || {};
  var cells = function (r) { return Array.isArray(r) ? r : (r && typeof r === "object" ? (cols.length ? cols.map(function (c) { return r[c]; }) : Object.keys(r).map(function (k) { return k + ": " + r[k]; })) : (r == null ? [] : [r])); };
  return '<table class="hs-t"><caption>' + esc(t.title || "") + (t.page ? " (p. " + esc(t.page) + ")" : "") + "</caption>" +
    (cols.length ? "<tr><th>" + esc(t.rowLabel || "") + "</th>" + cols.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr>" : "") +
    (Array.isArray(rows) ? rows.map(function (r) { return "<tr>" + cells(r).map(function (v) { return "<td>" + cell(v) + "</td>"; }).join("") + "</tr>"; }).join("")
      : Object.keys(rows).map(function (r) { return "<tr><th>" + esc(r) + "</th>" + cells(rows[r]).map(function (v) { return "<td>" + cell(v) + "</td>"; }).join("") + "</tr>"; }).join("")) + "</table>";
}
function formulaRow(f) {
  var bits = ["expr", "width", "length", "height", "tol"].filter(function (k) { return f[k] != null; }).map(function (k) { return k + ": " + f[k]; });
  return "<tr><td>" + esc(f.piece) + "</td><td>" + esc(bits.join(" · ")) + "</td><td>" + esc(f.page != null ? f.page : "") + "</td></tr>";
}

/* fișa unui sistem (cheie, sau id-ul articolului din catalogul aplicației); `NL` alege rândul de găuri; null dacă nu există date */
function sheetHtml(ref, opts) {
  opts = opts || {}; var lang = opts.lang || "en", s = typeof ref === "string" ? (SYS[ref] || systemOfHw(ref)) : ref; if (!s) return null;
  var kg = loadText(s, " / ");
  var h = '<div class="hs"><h4>' + esc(s.name) + '</h4><p class="mini">' + esc(tr(lang, "kind")[s.kind] || s.kind) + (kg ? " · " + esc(tr(lang, "load")) + " " + esc(kg) : "") +
    (s.extension ? " · " + esc(s.extension) : "") + " · " + esc(tr(lang, "src")) + ": " + esc(SRC) + ", " + esc(tr(lang, "page")) + " " + esc((s.pages || []).length > 3 ? s.pages[0] + "–" + s.pages[s.pages.length - 1] : (s.pages || []).join(", ")) +
    (s.webCode || s.webcode ? " · web " + esc(s.webCode || s.webcode) : "") + "</p>";
  var LN = lengthsOf(s); if (LN.length) h += "<p class=\"mini\"><b>" + esc(tr(lang, "lengths")) + ":</b> " + esc(LN.join(" · ")) + "</p>";
  var byNL = holesByNL(s.key);
  if (byNL) {
    var NL = opts.NL != null ? nearestNL(s, opts.NL) : nearestNL(s, 450), row = byNL[String(NL)] || byNL[NL], front = s.drill && Array.isArray(s.drill.front) ? s.drill.front : [37];
    if (row) h += '<h5>' + esc(tr(lang, "drill")) + " " + esc(tr(lang, "pick")) + " " + NL + '</h5><div class="hs-draw">' + svgSide(front.filter(function (x) { return x <= 40; }).concat(row).filter(function (v, i, a) { return a.indexOf(v) === i; }), NL, lang) + "</div>";
  } else if (s.drill) h += '<p class="mini">' + esc(tr(lang, "noHoles")) + "</p>";
  if (s.cabinet && s.cabinet.labeled && Object.keys(s.cabinet.labeled).length) h += "<h5>" + esc(tr(lang, "cab")) + '</h5><table class="hs-t">' + kv(s.cabinet.labeled) + "</table>";
  var fm = (s.cutting && s.cutting.formulas) || [];
  if (fm.length) h += "<h5>" + esc(tr(lang, "cut")) + '</h5><table class="hs-t"><tr><th>' + esc(tr(lang, "piece")) + "</th><th>" + esc(tr(lang, "formula")) + "</th><th>" + esc(tr(lang, "page")) + "</th></tr>" + fm.map(formulaRow).join("") + "</table>";
  if (s.cutting && s.cutting.constants && Object.keys(s.cutting.constants).length) h += "<h5>" + esc(tr(lang, "const")) + '</h5><table class="hs-t">' + kv(s.cutting.constants) + "</table>";
  if (s.dims && Object.keys(s.dims).length) h += '<table class="hs-t">' + kv(s.dims) + "</table>";
  if (Array.isArray(s.tables) && s.tables.length) h += "<h5>" + esc(tr(lang, "tables")) + "</h5>" + s.tables.map(tableGeneric).join("");
  var parts = s.parts || [];
  if (parts.length) {
    var cols = ["art", "nl", "load", "fn", "side", "part", "colour", "height"].filter(function (c) { return parts.some(function (p) { return p[c] != null; }); });
    var rows = parts.map(function (p) { return "<tr>" + cols.map(function (c) { return "<td>" + cell(p[c]) + "</td>"; }).join("") + "</tr>"; }).join("");
    h += "<h5>" + esc(tr(lang, "parts")) + "</h5>" + (parts.length > 40 ? "<details><summary>" + parts.length + " " + esc(tr(lang, "more")) + '</summary><table class="hs-t">' + rows + "</table></details>" : '<table class="hs-t">' + rows + "</table>");
  }
  (s.notes || []).slice(0, 12).forEach(function (n) { h += '<p class="mini">• ' + esc(typeof n === "object" ? JSON.stringify(n) : n) + "</p>"; });
  if (s.unreadable && s.unreadable.length) h += "<h5>" + esc(tr(lang, "unread")) + '</h5><p class="mini">' + s.unreadable.map(function (u) { return esc(typeof u === "object" ? JSON.stringify(u) : u); }).join("<br>• ").replace(/^/, "• ") + "</p>";
  return h + "</div>";
}

var API = { SRC: SRC, SYSTEMS: SYS, RUNNERS: RUNNERS, hwIdOf: hwIdOf, keyOfHw: keyOfHw, system: system, systemOfHw: systemOfHw, list: list, widthOff: widthOff, holesByNL: holesByNL, lengthsOf: lengthsOf, nearestNL: nearestNL, catalogEntries: catalogEntries, sheetHtml: sheetHtml };
if (typeof module !== "undefined" && module.exports) module.exports = API;
root.EBSlides = API;

})(typeof globalThis !== "undefined" ? globalThis : this);
