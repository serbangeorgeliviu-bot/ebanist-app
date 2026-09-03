/* Ebanist — nucleo geometrico condiviso.
 *
 * Una distinta e andata a debitare con cote sbagliate. Non per un errore di
 * conto: perche le cote derivate di un corpo si calcolavano in undici punti
 * diversi del codice, ognuno con le sue costanti scritte a mano. Bastava che
 * uno non sapesse che lo schienale era da 19 e non da 18.
 *
 * Qui c'e UNA funzione. Tutte le tipologie a cassa passano di qui. Chi ha
 * bisogno di una cota derivata la chiede, non se la ricalcola.
 *
 * Regole, non negoziabili:
 *   - millimetri, sempre e solo `number`;
 *   - funzione PURA: stesse entrate, stesse uscite, nessuna lettura di stato
 *     globale, nessun effetto laterale;
 *   - nessun valore implicito NASCOSTO: i predefiniti stanno fuori, in
 *     CARCASS_DEFAULTS, e il chiamante li fonde e li vede;
 *   - precisione piena dentro, arrotondamento a 1 mm UNA VOLTA SOLA in uscita.
 *     Mai arrotondamenti in catena.
 *
 * Gira uguale nel browser (<script src>) e in Node (require): in fondo al file
 * c'e la coda che lo pubblica nei due mondi.
 */
(function (root) {
"use strict";

/* La versione del motore viaggia col progetto. Un progetto calcolato col
   motore vecchio NON si ricalcola da solo: l'utente puo avere gia debitato. */
var GEOM_VERSION = 2;

/* Predefiniti di progetto. Stanno QUI, visibili, non dentro la funzione.
   Sono i valori della Rev. C Jacquin, quelli verificati in produzione. */
var CARCASS_DEFAULTS = {
  backMode: "incassato",   // 'incassato' | 'applicato' | 'in_cava'
  overlay: 16,             // quanto l'anta copre il fianco
  gap_ante: 4,             // rost fra due ante
  gap_sup: 3,              // gioco in alto
  gap_inf: 3,              // gioco in basso
  setback_ripiano: 20,     // arretramento del ripiano dal filo anteriore
  clearance_ripiano: 2,    // gioco totale in larghezza del ripiano
  edge_offset: 100,        // prima e ultima cerniera, dai capi dell'anta
  nut_d: 8,                // profondita della cava per lo schienale sottile
  nut_off: 10,             // arretramento della cava dal filo posteriore
  foratura_prof: 12.5,     // tazza cerniera: profondita
  foratura_dist_cant: 5    // tazza cerniera: distanza dal cant. UNA cota, non "3-6"
};

/* Formato della lastra: serve ad A10 (un pezzo piu grande della lastra non e
   un pezzo, e un errore che si scopre in segheria). */
var PANEL_DEFAULTS = { panelL: 2800, panelW: 2070, decor_directional: false };

/* --- utensili ------------------------------------------------------------ */

/* Arrotondamento UNICO, in uscita. `null` resta `null`: una cota che non
   esiste (l'anta di un corpo senza ante) non e zero, e assente. */
function mm(v) { return v == null ? null : Math.round(v); }

function num(p, k) {
  var v = p[k];
  if (typeof v !== "number" || !isFinite(v))
    throw new Error("deriveCarcass: `" + k + "` deve essere un numero finito in mm, ricevuto " + JSON.stringify(v));
  return v;
}

/* Quante cerniere porta un'anta, dalla sua altezza. Questa scala stava
   scritta in TRE punti diversi dell'app — la distinta, il conteggio della
   ferramenta e la scheda di montaggio — e i tre non erano d'accordo fra loro.
   Adesso e una sola, e le tre la chiamano. */
function hingeCount(anta_H) {
  if (!(anta_H > 0)) return 0;
  return anta_H < 900 ? 2 : anta_H < 1600 ? 3 : anta_H < 2000 ? 4 : 5;
}

/* Posizioni delle tazze delle cerniere, dal bordo INFERIORE dell'anta.
   La prima e l'ultima a `edge_offset` dai capi, le altre distribuite
   uniformemente in mezzo. Arrotondate al mm intero. */
function positionsHinges(anta_H, n, edge_offset) {
  n = Math.max(0, Math.round(n || 0));
  if (!n || !(anta_H > 0)) return [];
  if (n === 1) return [Math.round(anta_H / 2)];
  var span = anta_H - 2 * edge_offset;
  /* Anta troppo corta per l'arretramento chiesto: si stringe invece di
     produrre cote negative o cerniere fuori dall'anta. */
  if (span <= 0) {
    var off = Math.max(0, anta_H / 4);
    span = anta_H - 2 * off;
    edge_offset = off;
  }
  var out = [];
  for (var i = 0; i < n; i++) out.push(Math.round(edge_offset + span * i / (n - 1)));
  return out;
}

/* --- la funzione ---------------------------------------------------------- */

function deriveCarcass(params) {
  var p = params || {};

  /* entrate, tutte esplicite */
  var W = num(p, "W"), H = num(p, "H"), D = num(p, "D");
  var t_fianco = num(p, "t_fianco");
  /* t_back NON e una costante: e la grossezza del materiale assegnato allo
     schienale. Se lo schienale e truciolare 19, t_back vale 19. */
  var t_back = num(p, "t_back");
  var backMode = p.backMode;
  if (backMode !== "incassato" && backMode !== "applicato" && backMode !== "in_cava")
    throw new Error("deriveCarcass: `backMode` deve essere 'incassato', 'applicato' o 'in_cava', ricevuto " + JSON.stringify(backMode));
  var h_zoccolo = num(p, "h_zoccolo");
  var n_ante = Math.max(0, Math.round(num(p, "n_ante")));
  var overlay = num(p, "overlay");
  var gap_ante = num(p, "gap_ante");
  var gap_sup = num(p, "gap_sup");
  var gap_inf = num(p, "gap_inf");
  var setback_ripiano = num(p, "setback_ripiano");
  var clearance_ripiano = num(p, "clearance_ripiano");
  /* n_cerniere = 0 vuol dire "decidila tu dall'altezza": e l'unico valore
     dedotto, e il numero scelto torna in uscita, cosi la scheda lo stampa. */
  var n_cerniere = Math.max(0, Math.round(num(p, "n_cerniere")));
  var piedini = Math.max(0, Math.round(num(p, "piedini")));
  var h_picior = num(p, "h_picior");
  var edge_offset = num(p, "edge_offset");
  var nut_d = num(p, "nut_d"), nut_off = num(p, "nut_off");
  var foratura_prof = num(p, "foratura_prof");
  var foratura_dist_cant = num(p, "foratura_dist_cant");

  /* luce interna */
  var Wi = W - 2 * t_fianco;

  /* piedini: o il corpo sta sui piedini, o i fianchi arrivano a pavimento.
     Tutti e due insieme e il mobile che dondola. */
  var H_fianco = piedini > 0 ? H - h_picior : H;
  /* quanto il corpo e sollevato da terra, da zoccolo o da piedini: uno solo
     dei due puo esserci, ma la cassa comincia sopra tutti e due. */
  var h_base = h_zoccolo + (piedini > 0 ? h_picior : 0);

  /* profondita, secondo il modo dello schienale.
     `piano_interno` = quanto la cassa perde in profondita per via dello
     schienale; e l'unico posto dove t_back entra nella catena. */
  var D_fianco, D_bc, back_W, back_H, piano_interno;
  if (backMode === "incassato") {
    /* schienale FRA i fianchi, a filo del piano posteriore */
    D_fianco = D;
    D_bc = D - t_back;
    back_W = Wi;
    /* la specifica dice back_H = H. Con i piedini pero il fianco e alto
       H - h_picior, e uno schienale alto H arriverebbe a toccare il
       pavimento sotto la cassa. Senza piedini le due cose coincidono, ed e
       il caso della Rev. C; con i piedini vince il fianco. */
    back_H = H_fianco;
    piano_interno = t_back;
  } else if (backMode === "applicato") {
    /* schienale APPLICATO sopra tutto, dietro */
    D_fianco = D - t_back;
    D_bc = D - t_back;
    back_W = W;
    back_H = H_fianco;
    piano_interno = t_back;
  } else {
    /* IN CAVA — lo schienale sottile corre in una cava fresata e non ruba
       profondita a base e cielo, che restano interi. E' la costruzione
       normale con l'HDF da 3 mm ed e quella che l'app ha sempre fatto: senza
       questo modo, ogni progetto gia salvato col fondo sottile cambierebbe
       cote da solo. Non e nella specifica — e segnalato. */
    D_fianco = D;
    D_bc = D;
    back_W = Wi + 2 * nut_d;
    back_H = (H - h_base - 2 * t_fianco) + 2 * nut_d;
    piano_interno = nut_off + t_back;
  }

  /* ripiani */
  var ripiano_W = Wi - clearance_ripiano;
  var ripiano_D = (backMode === "in_cava" ? D - piano_interno : D_bc) - setback_ripiano;

  /* zoccolo / traversa frontale */
  var zoccolo_W = Wi;
  var zoccolo_H = h_zoccolo;

  /* ante. `reveal` e la parte di fianco che resta a vista accanto all'anta:
     e la differenza fra la grossezza del fianco e la sovrapposizione. Senza
     il termine (n-1)*gap_ante le ante si toccano. */
  var reveal = t_fianco - overlay;
  var anta_W = null, anta_H = null, anta_y0 = null, anta_y1 = null, cerniere = [];
  if (n_ante > 0) {
    anta_W = (W - 2 * reveal - (n_ante - 1) * gap_ante) / n_ante;
    anta_H = H - h_zoccolo - gap_inf - gap_sup;
    anta_y0 = h_zoccolo + gap_inf;
    anta_y1 = anta_y0 + anta_H;
    if (!n_cerniere) n_cerniere = hingeCount(anta_H);
    cerniere = positionsHinges(anta_H, n_cerniere, edge_offset);
  }

  /* --- uscita: arrotondamento UNA volta sola --------------------------- */
  return {
    geomVersion: GEOM_VERSION,
    /* le entrate viaggiano con le uscite: la scheda di officina deve poter
       ristampare con che numeri e stato calcolato quel pezzo */
    in: {
      W: W, H: H, D: D, t_fianco: t_fianco, t_back: t_back, backMode: backMode,
      h_zoccolo: h_zoccolo, n_ante: n_ante, overlay: overlay, gap_ante: gap_ante,
      gap_sup: gap_sup, gap_inf: gap_inf, setback_ripiano: setback_ripiano,
      clearance_ripiano: clearance_ripiano, n_cerniere: n_cerniere,
      piedini: piedini, h_picior: h_picior, edge_offset: edge_offset,
      nut_d: nut_d, nut_off: nut_off,
      foratura_prof: foratura_prof, foratura_dist_cant: foratura_dist_cant
    },
    Wi: mm(Wi),
    D_fianco: mm(D_fianco),
    H_fianco: mm(H_fianco),
    D_bc: mm(D_bc),
    piano_interno: mm(piano_interno),
    back_W: mm(back_W),
    back_H: mm(back_H),
    ripiano_W: mm(ripiano_W),
    ripiano_D: mm(ripiano_D),
    zoccolo_W: mm(zoccolo_W),
    zoccolo_H: mm(zoccolo_H),
    reveal: mm(reveal),
    anta_W: mm(anta_W),
    anta_H: mm(anta_H),
    anta_y0: mm(anta_y0),
    anta_y1: mm(anta_y1),
    n_cerniere: n_cerniere,
    cerniere: cerniere,
    /* cote di foratura: numeri, non intervalli. "3-6 mm" non e una quota che
       una macchina possa eseguire, ed e quello che prende A8. */
    foratura: { prof: foratura_prof, dist_cant: foratura_dist_cant, diam: 35 }
  };
}

/* --- pubblicazione -------------------------------------------------------- */
var API = {
  GEOM_VERSION: GEOM_VERSION,
  CARCASS_DEFAULTS: CARCASS_DEFAULTS,
  PANEL_DEFAULTS: PANEL_DEFAULTS,
  deriveCarcass: deriveCarcass,
  positionsHinges: positionsHinges,
  hingeCount: hingeCount
};
if (typeof module !== "undefined" && module.exports) module.exports = API;
for (var k in API) if (Object.prototype.hasOwnProperty.call(API, k)) root[k] = API[k];

})(typeof globalThis !== "undefined" ? globalThis : this);
