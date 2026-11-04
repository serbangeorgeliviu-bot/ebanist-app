/* Ebanist — balamale Blum CLIP top: date tehnice din catalog, fișă tehnică și desen.
 *
 * SURSA: Blum, „Catalogue and technical manual 2022/2023 (KA-150)", https://publications.blum.com/2022/catalogue/en/
 * Fiecare valoare de aici e citită din pagina indicată în `src` (tabele, cote scrise pe desen, tabelul de comandă).
 * Ce nu are etichetă pe desen (cotele de secțiune 66,5 / 21,5 / 12 / 11 ...) NU e copiat: o cotă fără nume nu se
 * poate folosi. Ce lipsește se spune, nu se inventează. Familiile încă neîncărcate sunt în `PENDING`.
 *
 * Desenele nu sunt ale Blum: se generează din cotele de aici (cerc Ø35, dornuri Ø8, găuri placuță), ca fișa
 * să rămână adevărată pe orice cotă schimbată, iar catalogul să nu fie reprodus.
 *
 *   cd test && node --test hinges.test.js
 */
(function (root) {
"use strict";

var SRC = "Blum, Catalogue and technical manual 2022/2023 (KA-150), publications.blum.com/2022/catalogue/en/";

/* Datele vin din ebanist-hinges-data.js (generat de tools/blum-build.mjs din tools/blum-data/*.json, transcrise de pe paginile catalogului).
   PLATES: front = distanța de la fața dulapului la linia găurilor; pitch = între găuri; D × L = conturul total din „Planning" (D pe adâncime,
   L pe înălțime). HINGES: o familie = o pagină (sau o pereche) de catalog, cu `parts` = codurile din „Order information". */
var DATA = root.EBHingesData || { plates: [], hinges: {} };
var PLATES = DATA.plates, HINGES = DATA.hinges;
/* placuțele CLIP sunt compatibile cu toate balamalele CLIP / CLIP top (catalog p.71: „Compatible with all CLIP mounting plates") */
var CLIP_PLATES = PLATES.filter(function (p) { return p.kind === "cruciform" || p.kind === "horizontal"; }).map(function (p) { return p.id; });
Object.keys(HINGES).forEach(function (k) { var f = HINGES[k]; if (f && (!f.plates || !f.plates.length) && /CLIP/i.test(f.name) && !f.kind) f.plates = CLIP_PLATES.slice(); });
var PENDING = DATA.pending || [];

function plateById(id) { for (var i = 0; i < PLATES.length; i++) if (PLATES[i].id === id) return PLATES[i]; return null; }
function plateByArt(art) { for (var i = 0; i < PLATES.length; i++) if (PLATES[i].art.indexOf(art) >= 0) return PLATES[i]; return null; }
function hwIdOf(art) { return "blum_" + String(art).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/_$/, ""); }
/* index: id-ul articolului din catalogul aplicației → {fam, part}. Id-urile vechi (blum_71b3550, blum_71t3550, blum_71b7550) se potrivesc cu hwIdOf(cod). */
var HW = {}, KIND_ACCESSORY = /accessor/i;
Object.keys(HINGES).forEach(function (k) {
  var f = HINGES[k]; if (KIND_ACCESSORY.test(f.kind || "")) return;
  (f.parts || []).forEach(function (pt) { if (pt.art && !HW[hwIdOf(pt.art)]) HW[hwIdOf(pt.art)] = { fam: f, part: pt }; });
});
function familyOfHw(hwId) { return HW[hwId] ? HW[hwId].fam : null; }
function partOfHw(hwId) { return HW[hwId] ? HW[hwId].part : null; }
function familyOfArt(art) { var e = HW[hwIdOf(art)]; return e ? e.fam : null; }
var LEGACY_DOWELS = { blum_71b3550: 1, blum_71t3550: 1 };   // articolele vechi: găurile pentru dornuri se păstrează (D-48), ca distinta să nu se schimbe
function bossHasDowels(boss) { return /insert|knock|press|expando/i.test(boss || ""); }

/* găurirea balamalei alese, pentru motorul de găurire (ebanist-ops.js): cupă, dornuri, placuță. null = articol fără date (se folosește HW_DRILL).
   `noGeom` = familia nu are cotă de cupă în date: se folosește găurirea standard și se spune. */
function geomOf(hwId, plateId) {
  var e = HW[hwId]; if (!e) return null; var f = e.fam, g = { art: e.part.art, family: f.key };
  if (f.cup && f.cup.dia) { g.cup_dia = f.cup.dia; if (f.cup.tb) g.tb = f.cup.tb.slice(); } else g.noGeom = true;
  g.dowels = LEGACY_DOWELS[hwId] ? true : bossHasDowels(e.part.boss) && !!f.dowel;
  if (f.dowel && f.dowel.spacing) { g.dowel_dia = f.dowel.dia; g.dowel_spacing = f.dowel.spacing; g.dowel_offset = f.dowel.offset; }
  var pl = plateById(plateId || (f.plates && f.plates[0]));
  if (pl) { g.plate_front = pl.front; g.plate_spacing = pl.pitch; g.plate = { L: pl.L, D: pl.D, H: pl.H || 8.5, kind: pl.kind, art: pl.art[0] }; }
  return g;
}
/* articolele de catalog pentru HWDB.cern: câte unul pe cod de comandă, fără cele deja existente (`known` = ids). Prețul e orientativ, de corectat cu lista furnizorului. */
function catalogEntries(known) {
  var out = [], seen = {};
  (known || []).forEach(function (id) { seen[id] = 1; });
  Object.keys(HW).forEach(function (id) {
    if (seen[id]) return; var f = HW[id].fam, pt = HW[id].part;
    var arm = pt.arm && pt.arm !== "other" ? ", " + pt.arm : "", nm = f.name + " · " + pt.art + " (" + [pt.boss, pt.fn].filter(Boolean).join(", ") + arm + ")";
    var price = (f.angle >= 155 ? 7.2 : f.angle >= 125 ? 6 : /BLUMOTION/i.test(pt.fn || "") ? 3.6 : 2.4);
    out.push({ id: id, brand: "Blum", n: { it: nm, ro: nm, en: nm, fr: nm, de: nm, pl: nm, es: nm }, art: pt.art, price: price, chk: 1, hing: f.key });
  });
  return out;
}

/* distanța de găurire TB pentru acoperirea FA și spacing-ul placuței MD; null dacă nu e în 3…7 (cota nu există în tabel) */
function tb(fam, application, FA, MD) {
  var k = fam.tbRule[application]; if (k == null) return null;
  var v = FA - k + MD;
  return v >= fam.cup.tb[0] - 1e-9 && v <= fam.cup.tb[1] + 1e-9 && Math.abs(v - Math.round(v)) < 1e-9 ? Math.round(v) : null;
}
/* rostul minim F (mm) la raza 1 mm; extra2 adaugă reglajul lateral de ±2 mm. null = nu e în tabel sau „probă recomandată" */
function minGap(fam, TB, FD, extra2) {
  var row = fam.gap[TB], i = fam.gapFD.indexOf(FD); if (!row || i < 0 || row[i] == null) return null;
  var add = extra2 ? (fam.gapSide2[i] || 0) : 0; return Math.round((row[i] + add) * 10) / 10;
}

/* ---- text în 7 limbi, numai ce scrie fișa (numele articolelor rămân cele ale Blum) ------------------------------- */
var L = {
  ro: { sheet: "Fișă tehnică", src: "Sursa", drill: "Găurire ușă (vedere pe fața din spate a ușii)", plate: "Găurire plăcuță (pe peretele dulapului, vedere din față)", edge: "muchia ușii", front: "fața dulapului", tb: "TB distanță de găurire", tbT: "Distanța de găurire TB (mm) după acoperirea frontului FA", gap: "Rost minim F (mm), front cu raza 1 mm", adj: "Reglaje", order: "Numere de comandă", plates: "Plăcuțe compatibile", footprint: "contur total din catalog (gabarit)", rows: "MD = spacing placuță", noData: "tabelul nu are valoare pentru această combinație", trial: "probă recomandată", fd: "Grosime front FD (mm)", h: "înălțime", s: "lateral", d: "adâncime", angle: "unghi de deschidere", ex2: "cu reglaj lateral +2 mm" },
  it: { sheet: "Scheda tecnica", src: "Fonte", drill: "Foratura anta (vista sul retro dell'anta)", plate: "Foratura basetta (sul fianco, vista frontale)", edge: "bordo anta", front: "filo anteriore", tb: "TB distanza di foratura", tbT: "Distanza di foratura TB (mm) secondo la sovrapposizione FA", gap: "Fuga minima F (mm), frontale con raggio 1 mm", adj: "Regolazioni", order: "Codici d'ordine", plates: "Basette compatibili", footprint: "ingombro totale da catalogo", rows: "MD = distanziale basetta", noData: "la tabella non ha valore per questa combinazione", trial: "prova consigliata", fd: "Spessore frontale FD (mm)", h: "altezza", s: "laterale", d: "profondità", angle: "angolo di apertura", ex2: "con regolazione laterale +2 mm" },
  en: { sheet: "Data sheet", src: "Source", drill: "Door drilling (view of the door's back face)", plate: "Plate drilling (on the cabinet side, front view)", edge: "door edge", front: "cabinet front", tb: "TB drilling distance", tbT: "Drilling distance TB (mm) by front overlay FA", gap: "Minimum gap F (mm), front with R = 1 mm", adj: "Adjustment", order: "Order information", plates: "Compatible mounting plates", footprint: "overall outline from catalogue", rows: "MD = mounting plate spacing", noData: "the table has no value for this combination", trial: "trial recommended", fd: "Front thickness FD (mm)", h: "height", s: "side", d: "depth", angle: "opening angle", ex2: "with +2 mm side adjustment" },
  fr: { sheet: "Fiche technique", src: "Source", drill: "Perçage de la porte (vue sur la face arrière)", plate: "Perçage de l'embase (sur le côté du caisson, vue de face)", edge: "chant de la porte", front: "façade du caisson", tb: "TB distance de perçage", tbT: "Distance de perçage TB (mm) selon le recouvrement FA", gap: "Jeu minimal F (mm), façade avec R = 1 mm", adj: "Réglages", order: "Références", plates: "Embases compatibles", footprint: "encombrement total du catalogue", rows: "MD = entretoise d'embase", noData: "le tableau n'a pas de valeur pour cette combinaison", trial: "essai conseillé", fd: "Épaisseur de façade FD (mm)", h: "hauteur", s: "latéral", d: "profondeur", angle: "angle d'ouverture", ex2: "avec réglage latéral +2 mm" },
  de: { sheet: "Datenblatt", src: "Quelle", drill: "Türbohrung (Ansicht auf die Rückseite)", plate: "Plattenbohrung (an der Korpusseite, Ansicht von vorn)", edge: "Türkante", front: "Korpusvorderkante", tb: "TB Bohrabstand", tbT: "Bohrabstand TB (mm) nach Überlagerung FA", gap: "Mindestfuge F (mm), Front mit R = 1 mm", adj: "Verstellung", order: "Bestelldaten", plates: "Passende Montageplatten", footprint: "Gesamtkontur aus dem Katalog", rows: "MD = Plattenabstand", noData: "die Tabelle hat für diese Kombination keinen Wert", trial: "Probe empfohlen", fd: "Frontdicke FD (mm)", h: "Höhe", s: "seitlich", d: "Tiefe", angle: "Öffnungswinkel", ex2: "mit +2 mm Seitenverstellung" },
  pl: { sheet: "Karta techniczna", src: "Źródło", drill: "Wiercenie drzwi (widok od tyłu drzwi)", plate: "Wiercenie prowadnika (na boku korpusu, widok z przodu)", edge: "krawędź drzwi", front: "front korpusu", tb: "TB odległość wiercenia", tbT: "Odległość wiercenia TB (mm) wg nakładania FA", gap: "Minimalna szczelina F (mm), front z R = 1 mm", adj: "Regulacja", order: "Numery zamówieniowe", plates: "Pasujące prowadniki", footprint: "gabaryt całkowity z katalogu", rows: "MD = podkładka prowadnika", noData: "tabela nie ma wartości dla tej kombinacji", trial: "zalecana próba", fd: "Grubość frontu FD (mm)", h: "wysokość", s: "boczna", d: "głębokość", angle: "kąt otwarcia", ex2: "z regulacją boczną +2 mm" },
  es: { sheet: "Ficha técnica", src: "Fuente", drill: "Taladrado de la puerta (vista de la cara trasera)", plate: "Taladrado de la base (en el lateral, vista frontal)", edge: "canto de la puerta", front: "frente del mueble", tb: "TB distancia de taladrado", tbT: "Distancia de taladrado TB (mm) según el solape FA", gap: "Holgura mínima F (mm), frente con R = 1 mm", adj: "Ajuste", order: "Referencias", plates: "Bases compatibles", footprint: "contorno total del catálogo", rows: "MD = separación de la base", noData: "la tabla no tiene valor para esta combinación", trial: "prueba recomendada", fd: "Grosor del frente FD (mm)", h: "altura", s: "lateral", d: "profundidad", angle: "ángulo de apertura", ex2: "con ajuste lateral +2 mm" }
};
function tr(lang, k) { return (L[lang] && L[lang][k]) || L.en[k] || k; }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

/* ---- desenele: SVG din cote, scară 1 mm = `k` px ---------------------------------------------------------------------- */
function dimLine(x1, y1, x2, y2, label, off) {
  var vert = Math.abs(x1 - x2) < 0.01, tx = (x1 + x2) / 2 + (vert ? off : 0), ty = (y1 + y2) / 2 + (vert ? 0 : off);
  var ox = vert ? off : 0, oy = vert ? 0 : off;
  return '<g class="dim"><path d="M' + x1 + " " + y1 + " L" + (x1 + ox) + " " + (y1 + oy) + " M" + x2 + " " + y2 + " L" + (x2 + ox) + " " + (y2 + oy) +
    " M" + (x1 + ox) + " " + (y1 + oy) + " L" + (x2 + ox) + " " + (y2 + oy) + '"/><text x="' + tx + '" y="' + ty + '" text-anchor="middle" ' +
    (vert ? 'transform="rotate(-90 ' + tx + " " + ty + ')" dy="-3"' : 'dy="-3"') + ">" + esc(label) + "</text></g>";
}
/* ușa: muchia sus (y=0), cupa Ø35 la TB de muchie; dornurile INSERTA Ø8 la 45 mm între ele, linia lor la 9,5 mm de axa cupei */
var CSS = '<style>.hs-svg text{font:11px sans-serif;fill:currentColor}.hs-svg .dim path{stroke:currentColor;stroke-width:.7;fill:none}.hs-svg .p{fill:none;stroke:currentColor;stroke-width:1.2}.hs-svg .c{stroke:currentColor;stroke-width:.6;stroke-dasharray:4 2;fill:none}</style>';
function svgDoor(fam, TB, lang) {
  var k = 5, S = function (v) { return Math.round(v * k * 10) / 10; }, w = 70, h = 70, cx = w / 2, cy = TB + fam.cup.dia / 2, dw = fam.dowel && fam.dowel.spacing ? fam.dowel : null;
  var dy = dw ? cy + dw.offset : cy, x1 = dw ? cx - dw.spacing / 2 : 0, x2 = dw ? cx + dw.spacing / 2 : 0;
  return '<svg class="hs-svg" viewBox="-60 -30 ' + (S(w) + 120) + " " + (S(h) + 70) + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(tr(lang, "drill")) + '">' + CSS +
    '<rect class="p" x="0" y="0" width="' + S(w) + '" height="' + S(h) + '"/>' +
    '<circle class="p" cx="' + S(cx) + '" cy="' + S(cy) + '" r="' + S(fam.cup.dia / 2) + '"/>' +
    '<path class="c" d="M' + S(cx) + " 0 V" + S(h) + (dw ? " M0 " + S(dy) + " H" + S(w) : "") + '"/>' +
    (dw ? '<circle class="p" cx="' + S(x1) + '" cy="' + S(dy) + '" r="' + S(dw.dia / 2) + '"/><circle class="p" cx="' + S(x2) + '" cy="' + S(dy) + '" r="' + S(dw.dia / 2) + '"/>' : "") +
    dimLine(S(w), 0, S(w), S(TB), "TB " + TB, 22) +
    (dw ? dimLine(S(x1), S(h), S(x2), S(h), String(dw.spacing), 22) + dimLine(0, S(cy), 0, S(dy), String(dw.offset), -22) : "") +
    '<text x="' + S(cx) + '" y="' + (S(cy) + 4) + '" text-anchor="middle">Ø' + fam.cup.dia + (fam.cup.depth ? " / " + fam.cup.depth : "") + '</text>' +
    '<text x="' + S(w) / 2 + '" y="-10" text-anchor="middle">' + esc(tr(lang, "edge")) + "</text></svg>";
}
/* peretele dulapului, vedere din față: fața dulapului = linia din stânga (x=0). Placuța cruciformă: două găuri Ø5 pe verticală, la `front` de față,
   `pitch` între ele; placuța orizontală: două găuri pe orizontală, prima la `front`. Conturul total (D × L) se scrie ca text: forma exactă a crucii
   și poziția găurilor în contur nu sunt cotate în catalog, deci nu se desenează. */
function svgPlate(pl, lang) {
  var k = 5, S = function (v) { return Math.round(v * k * 10) / 10; }, hor = pl.kind === "horizontal", w = hor ? pl.front + pl.pitch + 10 : pl.front + 20, h = hor ? 30 : pl.pitch + 30, cy = h / 2;
  var pts = hor ? [[pl.front, cy], [pl.front + pl.pitch, cy]] : [[pl.front, cy - pl.pitch / 2], [pl.front, cy + pl.pitch / 2]];
  return '<svg class="hs-svg" viewBox="-30 -30 ' + (S(w) + 90) + " " + (S(h) + 70) + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(tr(lang, "plate")) + '">' + CSS +
    '<path class="p" d="M0 -6 V' + S(h) + '"/>' +
    pts.map(function (q) { return '<circle class="p" cx="' + S(q[0]) + '" cy="' + S(q[1]) + '" r="' + S(2.5) + '"/>'; }).join("") +
    dimLine(0, S(pts[0][1]), S(pl.front), S(pts[0][1]), String(pl.front), -18) +
    (hor ? dimLine(S(pts[0][0]), S(cy), S(pts[1][0]), S(cy), String(pl.pitch), 26) : dimLine(S(pl.front), S(pts[0][1]), S(pl.front), S(pts[1][1]), String(pl.pitch), 24)) +
    '<text x="2" y="-14">' + esc(tr(lang, "front")) + "</text></svg>";
}

function tableTB(fam, lang) {
  var out = '<table class="hs-t"><caption>' + esc(tr(lang, "tbT")) + "</caption>", apps = Object.keys(fam.tbTable);
  apps.forEach(function (a) {
    var t = fam.tbTable[a], cols = {}; if (!t) return; Object.keys(t).forEach(function (md) { Object.keys(t[md]).forEach(function (fa) { cols[fa] = 1; }); });
    var fas = Object.keys(cols).sort(function (x, y) { return x - y; });
    out += '<tr><th>' + esc(a) + " · FA</th>" + fas.map(function (f) { return "<th>" + f + "</th>"; }).join("") + "</tr>";
    Object.keys(t).forEach(function (md) { out += "<tr><th>MD " + md + "</th>" + fas.map(function (f) { return "<td>" + (t[md][f] != null ? t[md][f] : "") + "</td>"; }).join("") + "</tr>"; });
  });
  return out + "</table>";
}
function tableGap(fam, lang) {
  var out = '<table class="hs-t"><caption>' + esc(tr(lang, "gap")) + "</caption><tr><th>TB \\ FD</th>" + fam.gapFD.map(function (f) { return "<th>" + f + "</th>"; }).join("") + "</tr>";
  Object.keys(fam.gap).forEach(function (b) { out += "<tr><th>" + b + "</th>" + fam.gap[b].map(function (v) { return "<td>" + (v == null ? "△" : v) + "</td>"; }).join("") + "</tr>"; });
  var g2 = fam.gapSide2 || [];
  if (g2.length) out += "<tr><th>" + esc(tr(lang, "ex2")) + "</th>" + fam.gapFD.map(function (f, i) { return "<td>" + (g2[i] != null ? "+" + g2[i] : "") + "</td>"; }).join("") + "</tr>";
  out += "</table>";
  return out + '<p class="mini">△ = ' + esc(tr(lang, "trial")) + "</p>";
}

/* fișa completă pentru un articol din catalogul aplicației (`hwId`) sau pentru o familie; null dacă articolul nu are date încărcate.
   Familiile au tabele diferite: se arată ce există (TB, rost F, `tables` transcrise, `dims` cu etichetă, `notes`). */
/* reglajele: la 110° {height, side, depthPlus, depthMinus}; la alte familii pot avea alte chei sau valori compuse — se arată ce există */
function adjText(a, lang) {
  var lab = { height: tr(lang, "h"), side: tr(lang, "s"), depthPlus: tr(lang, "d") + " +", depthMinus: tr(lang, "d") + " −" }, parts = [];
  Object.keys(a).forEach(function (k) { var v = a[k]; if (v == null) return; parts.push((lab[k] || k) + " " + (typeof v === "object" ? JSON.stringify(v) : (typeof v === "number" && (k === "height" || k === "side") ? "±" : "") + v)); });
  return esc(parts.join(" · ")) + " mm";
}
function kv(o) { return Object.keys(o).map(function (k) { return "<tr><th>" + esc(k) + "</th><td>" + esc(typeof o[k] === "object" ? JSON.stringify(o[k]) : o[k]) + "</td></tr>"; }).join(""); }
/* rândul unui tabel transcris: listă de valori, sau obiect {coloană: valoare} */
function rowCells(r, cols) {
  if (Array.isArray(r)) return r;
  if (r && typeof r === "object") return cols.length ? cols.map(function (c) { return r[c]; }) : Object.keys(r).map(function (k) { return k + ": " + r[k]; });
  return r == null ? [] : [r];
}
function tableGeneric(t) {
  var cols = t.cols || [], rows = t.rows || {};
  return '<table class="hs-t"><caption>' + esc(t.title || "") + (t.page ? " (p. " + t.page + ")" : "") + "</caption>" +
    (cols.length ? "<tr><th>" + esc(t.rowLabel || "") + (t.colLabel ? " \\ " + esc(t.colLabel) : "") + "</th>" + cols.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr>" : "") +
    Object.keys(rows).map(function (r) { return "<tr><th>" + esc(r) + "</th>" + rowCells(rows[r], cols).map(function (v) { return "<td>" + (v == null ? "" : esc(typeof v === "object" ? JSON.stringify(v) : v)) + "</td>"; }).join("") + "</tr>"; }).join("") + "</table>";
}
function sheetHtml(hwId, opts) {
  opts = opts || {}; var lang = opts.lang || "en", fam = typeof hwId === "string" ? familyOfHw(hwId) : hwId; if (!fam) return null;
  var part = typeof hwId === "string" ? partOfHw(hwId) : null, pl = plateById(opts.plate || (fam.plates && fam.plates[0]));
  var TB = opts.TB != null ? opts.TB : 5; if (fam.cup && fam.cup.tb) TB = Math.min(Math.max(TB, fam.cup.tb[0]), fam.cup.tb[1]);
  var h = '<div class="hs"><h4>' + esc(fam.name) + (part ? " · " + esc(part.art) : "") + "</h4>" +
    '<p class="mini">' + (fam.angle ? esc(tr(lang, "angle")) + " " + fam.angle + "° · " : "") + (fam.fdMax ? "FD ≤ " + fam.fdMax + " mm · " : "") + (fam.fdMin ? "FD ≥ " + fam.fdMin + " mm · " : "") +
    esc(tr(lang, "src")) + ": " + esc(SRC) + ", p. " + fam.pages.join("–") + (fam.webCode ? " · web " + esc(fam.webCode) : "") + "</p>";
  var draw = (fam.cup && fam.cup.dia ? svgDoor(fam, TB, lang) : "") + (pl ? svgPlate(pl, lang) : "");
  if (draw) h += '<div class="hs-draw">' + draw + "</div>";
  if (fam.cup && fam.cup.dia) h += '<p class="mini">' + esc(tr(lang, "tb")) + " " + TB + " mm (" + (fam.cup.tb ? fam.cup.tb[0] + "–" + fam.cup.tb[1] : "") + ") · Ø" + fam.cup.dia + (fam.cup.depth ? " × " + fam.cup.depth : "") +
    (fam.dowel ? " · Ø" + fam.dowel.dia + "±" + fam.dowel.tol : "") + (pl ? " · " + esc(tr(lang, "footprint")) + ": " + pl.D + " × " + pl.L + " mm · " + esc(pl.name) + " " + esc(pl.art.join(" / ")) : "") + "</p>";
  if (fam.adjust && Object.keys(fam.adjust).length) h += "<h5>" + esc(tr(lang, "adj")) + '</h5><p class="mini">' + adjText(fam.adjust, lang) + "</p>";
  if (fam.tbTable && Object.keys(fam.tbTable).length) h += tableTB(fam, lang);
  if (fam.gap && fam.gapFD) h += tableGap(fam, lang);
  (fam.tables || []).forEach(function (t) { h += tableGeneric(t); });
  if (fam.dims && Object.keys(fam.dims).length) h += '<table class="hs-t">' + kv(fam.dims) + "</table>";
  if (fam.boss && Object.keys(fam.boss).length) h += '<table class="hs-t">' + kv(fam.boss) + "</table>";
  (fam.notes || []).forEach(function (n) { h += '<p class="mini">• ' + esc(n) + "</p>"; });
  h += "<h5>" + esc(tr(lang, "order")) + "</h5>" + partsTable(fam, part);
  if (fam.plates && fam.plates.length) h += "<h5>" + esc(tr(lang, "plates")) + '</h5><table class="hs-t">' + fam.plates.map(plateById).filter(Boolean).map(function (p) { return "<tr><td>" + esc(p.art.join(" / ")) + "</td><td>" + esc(p.material) + "</td><td>±" + p.adj + "</td><td>" + p.D + " × " + p.L + "</td><td>" + p.front + "/" + p.pitch + "</td><td>" + esc(p.fix) + "</td></tr>"; }).join("") + "</table>";
  return h + "</div>";
}
function partsTable(fam, cur) {
  var cols = ["art", "boss", "arm", "fn", "colours"], extra = {};
  (fam.parts || []).forEach(function (p) { Object.keys(p).forEach(function (k) { if (cols.indexOf(k) < 0) extra[k] = 1; }); });
  cols = cols.concat(Object.keys(extra));
  return '<table class="hs-t">' + (fam.parts || []).map(function (p) { return "<tr" + (cur && cur.art === p.art ? ' style="font-weight:700"' : "") + ">" + cols.map(function (k) { return "<td>" + (p[k] == null ? "" : esc(p[k])) + "</td>"; }).join("") + "</tr>"; }).join("") + "</table>";
}

var API = { SRC: SRC, PLATES: PLATES, HINGES: HINGES, PENDING: PENDING, plateById: plateById, plateByArt: plateByArt, hwIdOf: hwIdOf, familyOfHw: familyOfHw, partOfHw: partOfHw, familyOfArt: familyOfArt, geomOf: geomOf, catalogEntries: catalogEntries, tb: tb, minGap: minGap, sheetHtml: sheetHtml, svgDoor: svgDoor, svgPlate: svgPlate };
if (typeof module !== "undefined" && module.exports) module.exports = API;
root.EBHinges = API;

})(typeof globalThis !== "undefined" ? globalThis : this);
