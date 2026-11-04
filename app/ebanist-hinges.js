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

/* ---- placuțe (pp. 144–149) ---------------------------------------------------------------------------------------
   front = distanța de la fața dulapului la linia găurilor; pitch = distanța între găuri; D × L = conturul total din
   desenul „Planning" (D pe adâncimea dulapului, L pe înălțimea lui); H = înălțimea pentru spacing 0. */
var PLATES = [
  { id: "173L61", art: ["173L6100", "173L6130"], name: "Cruciform mounting plate 37/32", kind: "cruciform", material: "steel", adj: 3,
    fix: "chipboard Ø3.5 / Ø4, 17 mm", front: 37, pitch: 32, D: 57, L: 53, spacings: [[0, 8.5, "173L6100"], [3, 11.5, "173L6130"]], colours: ["NI", "ONS"], page: 147 },
  { id: "175H71", art: ["175H7100", "175H7130", "175H7190", "175H7190.22"], name: "Cruciform mounting plate 37/32", kind: "cruciform", material: "zinc", adj: 2,
    fix: "chipboard Ø3.5 / Ø4, 17 mm", front: 37, pitch: 32, D: 68, L: 44, spacings: [[0, 8.5, "175H7100"], [3, 11.5, "175H7130"], [9, 17.5, "175H7190"], [18, 26.5, "175H7190.22"]], colours: ["NI"], page: 147 },
  { id: "175H91", art: ["175H9100", "175H9130", "175H9160", "175H9190", "175H9190.22"], name: "Cruciform mounting plate 37/32 (system screws)", kind: "cruciform", material: "zinc", adj: 2,
    fix: "system screws Ø6 × 14.5 (661.1450.HG)", front: 37, pitch: 32, D: 68, L: 44, minDepth: 11.5, spacings: [[0, 8.5, "175H9100"], [3, 11.5, "175H9130"], [6, 14.5, "175H9160"], [9, 17.5, "175H9190"], [18, 26.5, "175H9190.22"]], colours: ["NI", "ONS (6 mm)"], page: 147 },
  { id: "174E61", art: ["174E6100.01", "174E6130.01"], name: "Cruciform mounting plate 37/32 (EXPANDO)", kind: "cruciform", material: "steel", adj: 2,
    fix: "EXPANDO: pre-mounted screws with split dowels", front: 37, pitch: 32, D: 57, L: 53, minDepth: 11.5, spacings: [[0, 8.5, "174E6100.01"], [3, 11.5, "174E6130.01"]], colours: ["NI"], page: 147 },
  { id: "175H31", art: ["175H3100", "175H3130"], name: "Horizontal cam mounting plate 20/32", kind: "horizontal", material: "steel", adj: 2,
    fix: "chipboard Ø3.5, 17 mm", front: 20, pitch: 32, D: 58.3, L: 18.7, spacings: [[0, 8.5, "175H3100"], [3, 11.5, "175H3130"]], colours: ["NI", "ONS"], page: 144 }
];

/* ---- balamale ------------------------------------------------------------------------------------------------------
   Fiecare familie = o pagină de catalog (planning + tabele + order information). */
var HINGES = {
  clip_top_110: {
    name: "CLIP top BLUMOTION | CLIP top 110°", angle: 110, webCode: "DQDELA", pages: [74, 75], fdMax: 24,
    /* alegerea cupei: Ø35, adâncime minimă 13, distanța de găurire TB 3–7 mm de la muchia ușii */
    cup: { dia: 35, depth: 13, tol: "+0.2/0 (INSERTA)", tb: [3, 7] },
    /* INSERTA | knock-in: două găuri Ø8 ±0,1, la 45 mm una de alta, linia lor la 9,5 mm de axa cupei */
    dowel: { dia: 8, tol: 0.1, spacing: 45, offset: 9.5 },
    boss: { L: 57, W: 37.5, WInserta: 43, H: 3.2, HInserta: 6.4 },
    adjust: { height: 3, side: 2, depthPlus: 3, depthMinus: -2 },
    /* Drilling distance TB (mm) = FA − k + MD: citit din tabel (p. 75) pe fiecare coloană. FA = acoperirea frontului,
       MD = spacing-ul placuței. TB valid numai 3…7. k: acoperire normală 11, dual application 1.5, inset −7 (FA negativ). */
    tbRule: { overlay: 11, dual: 1.5, inset: -7 },
    /* tabela pe care se bazează regula (FA → TB), ca testul să prindă o regulă scrisă greșit */
    tbTable: {
      overlay: { 0: { 14: 3, 15: 4, 16: 5, 17: 6, 18: 7 }, 3: { 11: 3, 12: 4, 13: 5, 14: 6, 15: 7 }, 6: { 8: 3, 9: 4, 10: 5, 11: 6, 12: 7 }, 9: { 5: 3, 6: 4, 7: 5, 8: 6, 9: 7 } },
      dual: { 0: { 4.5: 3, 5.5: 4, 6.5: 5, 7.5: 6, 8.5: 7 }, 3: { 1.5: 3, 2.5: 4, 3.5: 5, 4.5: 6, 5.5: 7 }, 6: { "-1.5": 3, "-0.5": 4, 0.5: 5, 1.5: 6, 2.5: 7 }, 9: { "-4.5": 3, "-3.5": 4, "-2.5": 5, "-1.5": 6, "-0.5": 7 } },
      inset: { 0: { "-4": 3, "-3": 4, "-2": 5, "-1": 6, 0: 7 }, 3: { "-7": 3, "-6": 4, "-5": 5, "-4": 6, "-3": 7 } }
    },
    /* rost minim F (mm) la front cu raza R = 1 mm, după TB și grosimea frontului FD; null = „se recomandă probă" (△) */
    gapFD: [16, 18, 19, 20, 21, 22, 23, 24, 25, 26, 28, 30],
    gap: {
      3: [0.5, 0.8, 1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.5, 4.3, null, null],
      4: [0.5, 0.8, 1.0, 1.2, 1.4, 1.7, 2.0, 2.5, 3.1, 3.8, null, null],
      5: [0.5, 0.8, 0.9, 1.2, 1.4, 1.7, 2.0, 2.4, 2.9, 3.4, null, null],
      6: [0.5, 0.8, 0.9, 1.2, 1.3, 1.6, 1.9, 2.3, 2.7, 3.2, null, null],
      7: [0.5, 0.8, 0.9, 1.1, 1.3, 1.6, 1.9, 2.2, 2.6, 3.0, null, null]
    },
    gapSide2: [0.2, 0.4, 0.4, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],   // +F la reglajul lateral de +2 mm, FD 16…26
    /* numere de comandă (p. 74): [boss, braț, BLUMOTION/arc, culori, cod] */
    parts: [
      { boss: "INSERTA", arm: "straight", fn: "CLIP top BLUMOTION", colours: "NI|ONS", art: "71B3590" },
      { boss: "INSERTA", arm: "straight", fn: "CLIP top (spring)", colours: "NI", art: "71T3590" },
      { boss: "INSERTA", arm: "straight", fn: "CLIP top (unsprung)", colours: "NI|ONS", art: "70T3590.TL" },
      { boss: "INSERTA", arm: "half-cranked", fn: "CLIP top BLUMOTION", colours: "NI|ONS", art: "71B3690" },
      { boss: "INSERTA", arm: "half-cranked", fn: "CLIP top (spring)", colours: "NI", art: "71T3690" },
      { boss: "INSERTA", arm: "half-cranked", fn: "CLIP top (unsprung)", colours: "NI|ONS", art: "70T3690.TL" },
      { boss: "INSERTA", arm: "full-cranked", fn: "CLIP top BLUMOTION", colours: "NI|ONS", art: "71B3790" },
      { boss: "INSERTA", arm: "full-cranked", fn: "CLIP top (spring)", colours: "NI", art: "71T3790" },
      { boss: "INSERTA", arm: "full-cranked", fn: "CLIP top (unsprung)", colours: "NI|ONS", art: "70T3790.TL" },
      { boss: "screw-on", arm: "straight", fn: "CLIP top BLUMOTION", colours: "NI|ONS", art: "71B3550" },
      { boss: "screw-on", arm: "straight", fn: "CLIP top (spring)", colours: "NI", art: "71T3550" },
      { boss: "screw-on", arm: "straight", fn: "CLIP top (unsprung)", colours: "NI|ONS", art: "70T3550.TL" },
      { boss: "screw-on", arm: "half-cranked", fn: "CLIP top BLUMOTION", colours: "NI|ONS", art: "71B3650" },
      { boss: "screw-on", arm: "half-cranked", fn: "CLIP top (spring)", colours: "NI", art: "71T3650" },
      { boss: "screw-on", arm: "half-cranked", fn: "CLIP top (unsprung)", colours: "NI|ONS", art: "70T3650.TL" },
      { boss: "screw-on", arm: "full-cranked", fn: "CLIP top BLUMOTION", colours: "NI|ONS", art: "71B3750" },
      { boss: "screw-on", arm: "full-cranked", fn: "CLIP top (spring)", colours: "NI", art: "71T3750" },
      { boss: "screw-on", arm: "full-cranked", fn: "CLIP top (unsprung)", colours: "NI|ONS", art: "70T3750.TL" }
    ],
    /* legătura cu articolele din catalogul aplicației (HWDB.cern) */
    hwIds: ["blum_71b3550", "blum_71t3550"],
    plates: ["173L61", "175H71", "175H91", "174E61", "175H31"]
  }
};

/* familii din catalog încă neîncărcate (aceleași pagini, același procedeu): angle, pagina din catalog */
var PENDING = [
  ["107° hinge", 78], ["CLIP 100° hinge", 80], ["110° special hinge", 76], ["155° hinge 0-protrusion", 82], ["170° wide-angled hinge", 86],
  ["125° hinge 0-protrusion", 90], ["Profile/thick door hinge 95°", 88], ["Blind corner hinges 95°/83°", 94], ["Aluminium frame door hinges", 98],
  ["Hinge for thin doors 8–14 mm", 102], ["CRISTALLO glass door hinges", 104], ["Mini-hinge 94°", 112], ["Corner cabinet bi-fold 60°", 114],
  ["Angled hinges −30°…+45°", 118]
];

function plateById(id) { for (var i = 0; i < PLATES.length; i++) if (PLATES[i].id === id) return PLATES[i]; return null; }
function plateByArt(art) { for (var i = 0; i < PLATES.length; i++) if (PLATES[i].art.indexOf(art) >= 0) return PLATES[i]; return null; }
function familyOfHw(hwId) { for (var k in HINGES) if (HINGES[k].hwIds.indexOf(hwId) >= 0) return HINGES[k]; return null; }
function familyOfArt(art) { for (var k in HINGES) for (var i = 0; i < HINGES[k].parts.length; i++) if (HINGES[k].parts[i].art === art) return HINGES[k]; return null; }

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
  var k = 5, S = function (v) { return Math.round(v * k * 10) / 10; }, w = 70, h = 70, cx = w / 2, cy = TB + fam.cup.dia / 2, dy = cy + fam.dowel.offset;
  var x1 = cx - fam.dowel.spacing / 2, x2 = cx + fam.dowel.spacing / 2;
  return '<svg class="hs-svg" viewBox="-60 -30 ' + (S(w) + 120) + " " + (S(h) + 70) + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(tr(lang, "drill")) + '">' + CSS +
    '<rect class="p" x="0" y="0" width="' + S(w) + '" height="' + S(h) + '"/>' +
    '<circle class="p" cx="' + S(cx) + '" cy="' + S(cy) + '" r="' + S(fam.cup.dia / 2) + '"/>' +
    '<path class="c" d="M' + S(cx) + " 0 V" + S(h) + " M0 " + S(dy) + " H" + S(w) + '"/>' +
    '<circle class="p" cx="' + S(x1) + '" cy="' + S(dy) + '" r="' + S(fam.dowel.dia / 2) + '"/><circle class="p" cx="' + S(x2) + '" cy="' + S(dy) + '" r="' + S(fam.dowel.dia / 2) + '"/>' +
    dimLine(S(w), 0, S(w), S(TB), "TB " + TB, 22) +
    dimLine(S(x1), S(h), S(x2), S(h), String(fam.dowel.spacing), 22) +
    dimLine(0, S(cy), 0, S(dy), String(fam.dowel.offset), -22) +
    '<text x="' + S(cx) + '" y="' + (S(cy) + 4) + '" text-anchor="middle">Ø' + fam.cup.dia + ' / ' + fam.cup.depth + '</text>' +
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
  var out = '<table class="hs-t"><caption>' + esc(tr(lang, "tbT")) + "</caption>", apps = ["overlay", "dual", "inset"];
  apps.forEach(function (a) {
    var t = fam.tbTable[a], cols = {}; Object.keys(t).forEach(function (md) { Object.keys(t[md]).forEach(function (fa) { cols[fa] = 1; }); });
    var fas = Object.keys(cols).sort(function (x, y) { return x - y; });
    out += '<tr><th>' + esc(a) + " · FA</th>" + fas.map(function (f) { return "<th>" + f + "</th>"; }).join("") + "</tr>";
    Object.keys(t).forEach(function (md) { out += "<tr><th>MD " + md + "</th>" + fas.map(function (f) { return "<td>" + (t[md][f] != null ? t[md][f] : "") + "</td>"; }).join("") + "</tr>"; });
  });
  return out + "</table>";
}
function tableGap(fam, lang) {
  var out = '<table class="hs-t"><caption>' + esc(tr(lang, "gap")) + "</caption><tr><th>TB \\ FD</th>" + fam.gapFD.map(function (f) { return "<th>" + f + "</th>"; }).join("") + "</tr>";
  Object.keys(fam.gap).forEach(function (b) { out += "<tr><th>" + b + "</th>" + fam.gap[b].map(function (v) { return "<td>" + (v == null ? "△" : v) + "</td>"; }).join("") + "</tr>"; });
  out += "<tr><th>" + esc(tr(lang, "ex2")) + "</th>" + fam.gapFD.map(function (f, i) { return "<td>" + (fam.gapSide2[i] != null ? "+" + fam.gapSide2[i] : "") + "</td>"; }).join("") + "</tr></table>";
  return out + '<p class="mini">△ = ' + esc(tr(lang, "trial")) + "</p>";
}

/* fișa completă pentru un articol din catalogul aplicației (`hwId`) sau pentru o familie; null dacă articolul nu are date încărcate */
function sheetHtml(hwId, opts) {
  opts = opts || {}; var lang = opts.lang || "en", fam = typeof hwId === "string" ? familyOfHw(hwId) : hwId; if (!fam) return null;
  var TB = opts.TB != null ? opts.TB : 5, pl = plateById(opts.plate || fam.plates[0]);
  var h = '<div class="hs"><h4>' + esc(fam.name) + "</h4>" +
    '<p class="mini">' + esc(tr(lang, "angle")) + " " + fam.angle + "° · FD ≤ " + fam.fdMax + " mm · " + esc(tr(lang, "src")) + ": " + esc(SRC) + ", p. " + fam.pages.join("–") + " · web " + esc(fam.webCode) + "</p>" +
    '<div class="hs-draw">' + svgDoor(fam, TB, lang) + svgPlate(pl, lang) + "</div>" +
    '<p class="mini">' + esc(tr(lang, "tb")) + " " + TB + " mm (" + fam.cup.tb[0] + "–" + fam.cup.tb[1] + ") · Ø" + fam.cup.dia + " × " + fam.cup.depth + " · Ø" + fam.dowel.dia + "±" + fam.dowel.tol + " · " +
    esc(tr(lang, "footprint")) + ": " + pl.D + " × " + pl.L + " mm · " + esc(pl.name) + " " + esc(pl.art.join(" / ")) + "</p>" +
    "<h5>" + esc(tr(lang, "adj")) + "</h5><p class=\"mini\">" + esc(tr(lang, "h")) + " ±" + fam.adjust.height + " · " + esc(tr(lang, "s")) + " ±" + fam.adjust.side + " · " + esc(tr(lang, "d")) + " +" + fam.adjust.depthPlus + " / " + fam.adjust.depthMinus + " mm</p>" +
    tableTB(fam, lang) + tableGap(fam, lang) +
    "<h5>" + esc(tr(lang, "order")) + "</h5><table class=\"hs-t\">" + fam.parts.map(function (p) { return "<tr><td>" + esc(p.art) + "</td><td>" + esc(p.boss) + "</td><td>" + esc(p.arm) + "</td><td>" + esc(p.fn) + "</td><td>" + esc(p.colours) + "</td></tr>"; }).join("") + "</table>" +
    "<h5>" + esc(tr(lang, "plates")) + "</h5><table class=\"hs-t\">" + fam.plates.map(plateById).map(function (p) { return "<tr><td>" + esc(p.art.join(" / ")) + "</td><td>" + esc(p.material) + "</td><td>±" + p.adj + "</td><td>" + p.D + " × " + p.L + "</td><td>" + p.front + "/" + p.pitch + "</td><td>" + esc(p.fix) + "</td></tr>"; }).join("") + "</table></div>";
  return h;
}

var API = { SRC: SRC, PLATES: PLATES, HINGES: HINGES, PENDING: PENDING, plateById: plateById, plateByArt: plateByArt, familyOfHw: familyOfHw, familyOfArt: familyOfArt, tb: tb, minGap: minGap, sheetHtml: sheetHtml, svgDoor: svgDoor, svgPlate: svgPlate };
if (typeof module !== "undefined" && module.exports) module.exports = API;
root.EBHinges = API;

})(typeof globalThis !== "undefined" ? globalThis : this);
