/* Ebanist — sisteme de sertar dincolo de Blum/Matrix: texte în cele 7 limbi.
   Un singur tabel: cheie → [it, ro, en, fr, de, pl, es]. Se desface în `DRAWMORE_I18N[lang][cheie]`; index.html îl alipește la I18N
   (o singură linie, lângă `const t`). Testul `drawers-more.test.js` păzește: fiecare cheie are toate cele 7 limbi, același set de {substituții}. */
(function (root) {
"use strict";
var LANGS = ["it", "ro", "en", "fr", "de", "pl", "es"];
var T = {
/* --- avertismente ale planului de sertar --- */
wDrawMoreKD: ["{sys}: nessuna regola di larghezza per una struttura da {t} mm (il costruttore dà: {ok} mm).",
  "{sys}: nicio regulă de lățime pentru o structură de {t} mm (producătorul dă: {ok} mm).",
  "{sys}: no width rule for a {t} mm carcase side (the manufacturer gives: {ok} mm).",
  "{sys} : aucune règle de largeur pour un montant de {t} mm (le fabricant donne : {ok} mm).",
  "{sys}: keine Breitenregel für eine Korpusseite von {t} mm (der Hersteller gibt: {ok} mm).",
  "{sys}: brak reguły szerokości dla boku korpusu {t} mm (producent podaje: {ok} mm).",
  "{sys}: no hay regla de anchura para un lateral de {t} mm (el fabricante da: {ok} mm)."],
wDrawMoreMinW: ["{sys}: la larghezza del retro sarebbe {have} mm, il minimo del costruttore è {min} mm: sezione troppo stretta.",
  "{sys}: lățimea spatelui ar fi {have} mm, minimul producătorului e {min} mm: secțiune prea îngustă.",
  "{sys}: the back would be {have} mm wide, the manufacturer's minimum is {min} mm: section too narrow.",
  "{sys} : le fond arrière ferait {have} mm de large, le minimum du fabricant est {min} mm : section trop étroite.",
  "{sys}: die Rückwand wäre {have} mm breit, das Minimum des Herstellers ist {min} mm: Fach zu schmal.",
  "{sys}: tył miałby {have} mm szerokości, minimum producenta to {min} mm: sekcja za wąska.",
  "{sys}: el trasero mediría {have} mm de ancho, el mínimo del fabricante es {min} mm: sección demasiado estrecha."],
wDrawMoreMinBox: ["{sys}: la cassa in legno sarebbe larga {have} mm, il minimo del costruttore è {min} mm: sezione troppo stretta.",
  "{sys}: sertarul din lemn ar fi lat de {have} mm, minimul producătorului e {min} mm: secțiune prea îngustă.",
  "{sys}: the wooden box would be {have} mm wide, the manufacturer's minimum is {min} mm: section too narrow.",
  "{sys} : le tiroir en bois ferait {have} mm de large, le minimum du fabricant est {min} mm : section trop étroite.",
  "{sys}: der Holzschubkasten wäre {have} mm breit, das Minimum des Herstellers ist {min} mm: Fach zu schmal.",
  "{sys}: szuflada drewniana miałaby {have} mm szerokości, minimum producenta to {min} mm: sekcja za wąska.",
  "{sys}: el cajón de madera mediría {have} mm de ancho, el mínimo del fabricante es {min} mm: sección demasiado estrecha."],
wDrawMoreTh: ["{sys}: le quote del costruttore valgono per fondo e retro da {ref} mm; qui la struttura è {t} mm: controlla il retro.",
  "{sys}: cotele producătorului sunt pentru fund și spate de {ref} mm; aici structura e {t} mm: verifică spatele.",
  "{sys}: the manufacturer's dimensions are for a {ref} mm bottom and back; here the carcase is {t} mm: check the back.",
  "{sys} : les cotes du fabricant valent pour un fond et un dos de {ref} mm ; ici la structure fait {t} mm : vérifiez le dos.",
  "{sys}: die Herstellermaße gelten für Boden und Rückwand mit {ref} mm; hier ist der Korpus {t} mm: Rückwand prüfen.",
  "{sys}: wymiary producenta dotyczą dna i tyłu {ref} mm; tu korpus ma {t} mm: sprawdź tył.",
  "{sys}: las cotas del fabricante valen para fondo y trasero de {ref} mm; aquí la estructura es de {t} mm: revisa el trasero."],
wDrawMoreNoRear: ["{g}: la profondità minima del vano non è nei dati del costruttore: la cassa in legno su questa guida non si calcola.",
  "{g}: adâncimea minimă a corpului nu e în datele producătorului: sertarul din lemn pe această glisieră nu se calculează.",
  "{g}: the minimum cabinet depth is not in the manufacturer's data: the wooden box on this runner is not calculated.",
  "{g} : la profondeur minimale du meuble n'est pas dans les données du fabricant : le tiroir en bois sur cette coulisse n'est pas calculé.",
  "{g}: die Mindest-Korpustiefe steht nicht in den Herstellerdaten: der Holzschubkasten auf diesem Auszug wird nicht berechnet.",
  "{g}: minimalna głębokość korpusu nie jest w danych producenta: szuflada drewniana na tej prowadnicy nie jest liczona.",
  "{g}: la profundidad mínima del mueble no está en los datos del fabricante: el cajón de madera en esta guía no se calcula."],
wDrawMoreNoDed: ["{g}: la deduzione di larghezza per casse in legno non è nei dati del costruttore: scegli un'altra guida.",
  "{g}: deducția de lățime pentru sertar din lemn nu e în datele producătorului: alege altă glisieră.",
  "{g}: the width deduction for wooden boxes is not in the manufacturer's data: choose another runner.",
  "{g} : la déduction de largeur pour tiroir en bois n'est pas dans les données du fabricant : choisissez une autre coulisse.",
  "{g}: der Breitenabzug für Holzschubkästen steht nicht in den Herstellerdaten: anderen Auszug wählen.",
  "{g}: odjęcie szerokości dla szuflady drewnianej nie jest w danych producenta: wybierz inną prowadnicę.",
  "{g}: la deducción de anchura para cajón de madera no está en los datos del fabricante: elige otra guía."],
wDrawMoreSideTh: ["{g}: fianchi del cassetto fino a {max} mm secondo il costruttore; qui {t} mm.",
  "{g}: laterale de sertar până la {max} mm după producător; aici {t} mm.",
  "{g}: drawer sides up to {max} mm according to the manufacturer; here {t} mm.",
  "{g} : côtés de tiroir jusqu'à {max} mm selon le fabricant ; ici {t} mm.",
  "{g}: Schubkastenseiten bis {max} mm laut Hersteller; hier {t} mm.",
  "{g}: boki szuflady do {max} mm według producenta; tu {t} mm.",
  "{g}: laterales del cajón hasta {max} mm según el fabricante; aquí {t} mm."],
wDrawMoreNLH: ["Altezza sponda {h} non esiste a NL {nl}: uso la più alta disponibile.",
  "Înălțimea laterală {h} nu există la NL {nl}: folosesc cea mai înaltă disponibilă.",
  "Side height {h} does not exist at NL {nl}: using the highest available.",
  "Hauteur de côté {h} inexistante à NL {nl} : la plus haute disponible est utilisée.",
  "Zargenhöhe {h} gibt es bei NL {nl} nicht: ich nehme die höchste verfügbare.",
  "Wysokość boku {h} nie istnieje przy NL {nl}: użyto najwyższej dostępnej.",
  "La altura de lateral {h} no existe con NL {nl}: uso la más alta disponible."],
/* --- găurire: avertisment din planul de găurire --- */
opsDrawMoreNoHoles: ["Guida {g}: il costruttore non dà le quote dei fori con il riferimento nel testo o in tabella (solo su disegno): nessun foro generato, usa la dima o la scheda del costruttore.",
  "Glisiera {g}: producătorul nu dă cotele găurilor cu reperul în text sau tabel (numai pe desen): nu s-a generat nicio gaură, folosește șablonul sau fișa producătorului.",
  "Runner {g}: the manufacturer does not give hole positions with their reference in the text or a table (drawing only): no holes generated, use the manufacturer's jig or sheet.",
  "Coulisse {g} : le fabricant ne donne pas les cotes de perçage avec leur repère dans le texte ou un tableau (dessin seulement) : aucun perçage généré, utilisez le gabarit ou la fiche du fabricant.",
  "Auszug {g}: der Hersteller gibt die Bohrpositionen nicht mit Bezugskante in Text oder Tabelle an (nur Zeichnung): keine Bohrungen erzeugt, Bohrlehre oder Datenblatt des Herstellers verwenden.",
  "Prowadnica {g}: producent nie podaje pozycji otworów z bazą w tekście ani w tabeli (tylko rysunek): nie wygenerowano otworów, użyj szablonu lub karty producenta.",
  "Guía {g}: el fabricante no da las cotas de los taladros con su referencia en el texto o en una tabla (solo dibujo): no se genera ningún taladro, usa la plantilla o la ficha del fabricante."],
/* --- fișa de montaj --- */
dwMoreDepth: ["Profondità minima del vano {mm} mm (NL {nl} + {k})", "Adâncime minimă a corpului {mm} mm (NL {nl} + {k})", "Minimum cabinet depth {mm} mm (NL {nl} + {k})",
  "Profondeur minimale du meuble {mm} mm (NL {nl} + {k})", "Mindest-Korpustiefe {mm} mm (NL {nl} + {k})", "Minimalna głębokość korpusu {mm} mm (NL {nl} + {k})", "Profundidad mínima del mueble {mm} mm (NL {nl} + {k})"],
dwMoreSlide: ["Guida {g} ({load}) · art. {art}", "Glisieră {g} ({load}) · art. {art}", "Runner {g} ({load}) · art. {art}", "Coulisse {g} ({load}) · réf. {art}", "Auszug {g} ({load}) · Art. {art}", "Prowadnica {g} ({load}) · nr {art}", "Guía {g} ({load}) · art. {art}"],
dwMoreSides: ["Sponde: {g} · art. {art}", "Laterale: {g} · art. {art}", "Drawer sides: {g} · art. {art}", "Côtés : {g} · réf. {art}", "Zargen: {g} · Art. {art}", "Boki: {g} · nr {art}", "Costados: {g} · art. {art}"],
dwMoreFront: ["Fissaggio del frontale: {m}{jig}", "Prinderea frontului: {m}{jig}", "Front fixing: {m}{jig}", "Fixation de la façade : {m}{jig}", "Frontbefestigung: {m}{jig}", "Mocowanie frontu: {m}{jig}", "Fijación del frente: {m}{jig}"],
dwMoreJig: ["dima", "șablon", "jig", "gabarit", "Bohrlehre", "szablon", "plantilla"],
dwMoreSupport: ["Frontale: {s}", "Front: {s}", "Front: {s}", "Façade : {s}", "Front: {s}", "Front: {s}", "Frente: {s}"],
dwMoreThRef: ["Quote del costruttore per pannello da {t} mm", "Cote ale producătorului pentru panou de {t} mm", "Manufacturer dimensions for a {t} mm panel", "Cotes du fabricant pour un panneau de {t} mm", "Herstellermaße für {t} mm Platte", "Wymiary producenta dla płyty {t} mm", "Cotas del fabricante para tablero de {t} mm"],
dwMoreHoles: ["Fori guida (tabella del costruttore, riferimento solo su disegno, non forati): {lab} = {v} mm (NL {nl})",
  "Găuri glisieră (tabelul producătorului, reper numai pe desen, negăurite): {lab} = {v} mm (NL {nl})",
  "Runner holes (manufacturer table, reference on the drawing only, not drilled): {lab} = {v} mm (NL {nl})",
  "Perçages de la coulisse (tableau du fabricant, repère sur le dessin seulement, non percés) : {lab} = {v} mm (NL {nl})",
  "Auszug-Bohrungen (Herstellertabelle, Bezug nur in der Zeichnung, nicht gebohrt): {lab} = {v} mm (NL {nl})",
  "Otwory prowadnicy (tabela producenta, baza tylko na rysunku, nie wiercone): {lab} = {v} mm (NL {nl})",
  "Taladros de la guía (tabla del fabricante, referencia solo en el dibujo, no taladrados): {lab} = {v} mm (NL {nl})"],
fx_screw: ["a viti (Anschrauben)", "cu șuruburi (Anschrauben)", "screw-on", "à visser (Anschrauben)", "zum Anschrauben", "przykręcany", "atornillado"],
fx_knock: ["a battuta (Einschlagen)", "prin batere (Einschlagen)", "knock-in", "à enfoncer (Einschlagen)", "zum Einschlagen", "wbijany", "a golpe (Einschlagen)"],
fx_hook: ["ganci avvitati al frontale (Einhänge)", "cârlige înșurubate în front (Einhänge)", "hooks screwed to the front (Einhänge)", "crochets vissés à la façade (Einhänge)", "am Front verschraubte Einhänge", "haki przykręcone do frontu (Einhänge)", "ganchos atornillados al frente (Einhänge)"],
fx_lock: ["dispositivo di bloccaggio + supporto frontale", "dispozitiv de blocare + suport de front", "front locking device + front holder", "dispositif de verrouillage + support de façade", "Frontverriegelung + Frontaufnahme", "zatrzask frontu + uchwyt frontu", "dispositivo de bloqueo + soporte del frente"]
};

var DRAWMORE_I18N = {};
LANGS.forEach(function (l) { DRAWMORE_I18N[l] = {}; });
Object.keys(T).forEach(function (k) { LANGS.forEach(function (l, i) { DRAWMORE_I18N[l][k] = T[k][i]; }); });

var API = { DRAWMORE_I18N: DRAWMORE_I18N, DRAWMORE_LANGS: LANGS, DRAWMORE_I18N_RAW: T };
if (typeof module !== "undefined" && module.exports) module.exports = API;
for (var k in API) if (Object.prototype.hasOwnProperty.call(API, k)) root[k] = API[k];
})(typeof globalThis !== "undefined" ? globalThis : this);
