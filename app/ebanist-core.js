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
var GEOM_VERSION = 2; /* GEOM_VERSION-MARKER — il verificatore di aggiornamenti
   legge questa riga dal file sul server. Se il numero e piu alto di quello
   caricato qui, il motore locale e vecchio e l'esportazione si blocca: una
   distinta calcolata da un motore superato e esattamente il guasto che questo
   rilascio ripara. Non cambiare la forma della riga senza cambiare il regex. */

/* Predefiniti di progetto. Stanno QUI, visibili, non dentro la funzione.
   Sono i valori della Rev. C Jacquin, quelli verificati in produzione. */
var CARCASS_DEFAULTS = {
  backMode: "incassato",   // 'incassato' | 'applicato' | 'in_cava'
  /* La luce che resta a vista accanto all'anta. E' QUESTA la costante di
     mestiere, non la sovrapposizione: `overlay = t_fianco - reveal`. Scritta
     al contrario (overlay fisso a 16) un corpo in pannello da 16 dava reveal
     zero e uno da 12 lo dava NEGATIVO — ante piu larghe del corpo. */
  reveal: 3,
  overlay: null,           // null = ricavata dal fianco: t_fianco - reveal
  gap_ante: 4,             // rost fra due ante
  gap_sup: 3,              // gioco in alto
  gap_inf: 3,              // gioco in basso
  setback_ripiano: 20,     // arretramento del ripiano dal filo anteriore
  clearance_ripiano: 2,    // gioco totale in larghezza del ripiano
  edge_offset: 100,        // prima e ultima cerniera, dai capi dell'anta
  nut_d: 8,                // profondita della cava per lo schienale sottile
  nut_off: 10,             // arretramento della cava dal filo posteriore
  setback_zoccolo: 50,     // arretramento dello zoccolo dal filo anteriore
  foratura_prof: 12.5,     // tazza cerniera: profondita
  foratura_dist_cant: 5    // tazza cerniera: distanza dal cant. UNA cota, non "3-6"
};

/* Formato della lastra: serve ad A10 (un pezzo piu grande della lastra non e
   un pezzo, e un errore che si scopre in segheria). */
var PANEL_DEFAULTS = { panelL: 2800, panelW: 2070, decor_directional: false };

/* --- I RUOLI ------------------------------------------------------------
 * Il `role` di un pezzo e l'unico modo che ha il controllo di chiusura
 * (Fase 2) di sapere che cosa sta rimontando. Il NOME del pezzo non serve:
 * "Ripiano mobile sez.2" e "Ripiano fisso" sono lo stesso ruolo, e il nome
 * cambia con la lingua. Il ruolo no.
 */
var ROLES = ["fianco", "fianco_sx", "fianco_dx", "base", "cielo", "base_cielo",
             "schienale", "ripiano", "frontale", "cassetto_fianco", "cassetto_fondo",
             "cassetto_frontale", "divisorio", "zoccolo", "traversa", "accessorio"];

/* Perche esiste `fianco` accanto a `fianco_sx`/`fianco_dx`, e `base_cielo`
   accanto a `base`/`cielo`: una RIGA di distinta non e un pezzo, e un
   pezzo per `pz` volte. Il falegname taglia "Fianco — 2 pz", non due righe
   da uno; spezzarle per far tornare un'enumerazione cambierebbe il foglio
   che va in segheria. Il ruolo di riga porta il paio, e `pz` dice quanti
   sono: chi rimonta il gabarito legge tutti e due. */

/* Quale dimensione del pezzo corre lungo quale asse del corpo.
 *   lung = la prima cota in distinta, larg = la seconda, sp = la grossezza.
 *   "L" = larghezza del corpo, "H" = altezza, "P" = profondita.
 * Senza questa tabella il bounding box del corpo assemblato non si puo
 * ricomporre: 2078x398 e un fianco o un'anta a seconda di dove sta.
 */
var ROLE_AXES = {
  fianco:            { lung: "H", larg: "P", sp: "L" },
  base_cielo:        { lung: "L", larg: "P", sp: "H" },
  fianco_sx:         { lung: "H", larg: "P", sp: "L" },
  fianco_dx:         { lung: "H", larg: "P", sp: "L" },
  base:              { lung: "L", larg: "P", sp: "H" },
  cielo:             { lung: "L", larg: "P", sp: "H" },
  schienale:         { lung: "L", larg: "H", sp: "P" },
  ripiano:           { lung: "L", larg: "P", sp: "H" },
  frontale:          { lung: "H", larg: "L", sp: "P" },
  divisorio:         { lung: "H", larg: "P", sp: "L" },
  zoccolo:           { lung: "L", larg: "H", sp: "P" },
  traversa:          { lung: "L", larg: "H", sp: "P" },
  cassetto_fianco:   { lung: "P", larg: "H", sp: "L" },
  cassetto_fondo:    { lung: "L", larg: "P", sp: "H" },
  cassetto_frontale: { lung: "H", larg: "L", sp: "P" },
  accessorio:        null   /* un'asta o un piedino non e un pannello del corpo */
};
function axesFor(role) { return ROLE_AXES[role] || null; }

/* --- le guide ------------------------------------------------------------
 * `rezerva_glisiera` NON e una costante. E' quanto la guida SCELTA si mangia
 * in fondo al vano, e cambia da modello a modello: 12 mm su TANDEM/LEGRABOX,
 * 10 su una guida a sfere, 12,5 su una a rulli. Scritta a mano una volta
 * sola valeva per una guida sola.
 *
 *   rear    = riserva in PROFONDITA, dietro la cassa del cassetto
 *   ded_lat = quanto si stringe la cassa in LARGHEZZA, TOTALE (due lati)
 *
 * Gli id sono gli stessi del catalogo ferramenta dell'app (HWDB.guida): una
 * tabella sola, due file che la leggono.
 */
var SLIDE_CATALOG = {
  blum_tandem:  { brand: "Blum",   rear: 12,   ded_lat: 42 },
  blum_movento: { brand: "Blum",   rear: 12,   ded_lat: 42 },
  blum_230m:    { brand: "Blum",   rear: 12.5, ded_lat: 25 },
  haf_ball:     { brand: "Hafele", rear: 10,   ded_lat: 26 },
  haf_matrix:   { brand: "Hafele", rear: 12,   ded_lat: 75 },
  nessuno:      { brand: "-",      rear: 0,    ded_lat: 0 }
};
function slideById(id) { return SLIDE_CATALOG[id] || SLIDE_CATALOG.blum_tandem; }

/* backMode (come lo scrive il progetto) -> tip_schienale (come lo chiede la
   specifica). Una parola sola per costruzione, non due. */
var BACK_KIND = { incassato: "incassato", applicato: "applicato", in_cava: "scanalato" };

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

/* --- le grossezze, una per ruolo ------------------------------------------
 * UNA grossezza per corpo era la seconda causa radice: il fianco da 19, il
 * cielo da 25 e il fondo da 3 finivano tutti e tre nello stesso numero.
 *
 * Il chiamante passa `sp: { fianco, base, cielo, schienale, ripiano,
 * frontale, zoccolo, divisorio }`. Quello che non c'e EREDITA dalla
 * struttura — `sp.fianco`, o il vecchio `t_fianco`. Quello che non ha
 * nemmeno quello e un errore, non un 18 silenzioso.
 */
var SP_ROLES = ["fianco", "base", "cielo", "schienale", "ripiano",
                "frontale", "zoccolo", "divisorio"];

function readThickness(p) {
  var sp = p.sp || {};
  /* la grossezza di struttura: `sp.fianco`, o il vecchio nome piatto */
  var base = (typeof sp.fianco === "number") ? sp.fianco
           : (typeof p.t_fianco === "number") ? p.t_fianco : null;
  /* lo schienale ha il suo nome piatto storico, e non eredita dalla
     struttura: un fondo in HDF da 3 non e mai spesso come un fianco. */
  var back = (typeof sp.schienale === "number") ? sp.schienale
           : (typeof p.t_back === "number") ? p.t_back : null;
  var out = {}, i, r, v;
  for (i = 0; i < SP_ROLES.length; i++) {
    r = SP_ROLES[i];
    v = (typeof sp[r] === "number") ? sp[r] : (r === "schienale" ? back : base);
    if (typeof v !== "number" || !isFinite(v))
      throw new Error("deriveCarcass: manca la grossezza del ruolo `" + r +
        "` e non c'e una grossezza di struttura da cui ereditarla. " +
        "Assegna un materiale: NON esiste un valore predefinito.");
    if (r !== "schienale" && !(v > 0))
      throw new Error("deriveCarcass: la grossezza del ruolo `" + r + "` deve essere > 0, ricevuto " + v);
    out[r] = v;
  }
  return out;
}

/* --- la funzione ---------------------------------------------------------- */

function deriveCarcass(params) {
  var p = params || {};

  /* entrate, tutte esplicite */
  var W = num(p, "W"), H = num(p, "H"), D = num(p, "D");
  /* le grossezze arrivano PER RUOLO. `t_fianco` e `t_back` restano i nomi
     della struttura e dello schienale: sono quelli che scrivono le regole
     e i progetti gia salvati. */
  var SP = readThickness(p);
  var t_fianco = SP.fianco;
  /* t_back NON e una costante: e la grossezza del materiale assegnato allo
     schienale. Se lo schienale e truciolare 19, t_back vale 19. */
  var t_back = SP.schienale;
  var backMode = p.backMode;
  if (backMode !== "incassato" && backMode !== "applicato" && backMode !== "in_cava")
    throw new Error("deriveCarcass: `backMode` deve essere 'incassato', 'applicato' o 'in_cava', ricevuto " + JSON.stringify(backMode));
  var h_zoccolo = num(p, "h_zoccolo");
  var n_ante = Math.max(0, Math.round(num(p, "n_ante")));
  /* la sovrapposizione si puo dichiarare; se non lo e, la si ricava dalla
     luce a vista, che e la cota che il falegname tiene fissa */
  var overlay = (p.overlay == null) ? (t_fianco - num(p, "reveal")) : num(p, "overlay");
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
  var setback_zoccolo = p.setback_zoccolo == null ? 50 : num(p, "setback_zoccolo");
  /* i tramezzi entrano qui perche la larghezza di una sezione — e quindi
     quella di un cassetto — si ricava da loro. Calcolata fuori, in quattro
     posti diversi, era gia quattro volte l'occasione di sbagliarla. */
  var n_divisorio = Math.max(0, Math.round(p.n_divisorio == null ? 0 : num(p, "n_divisorio")));
  /* il modello di guida SCELTO, non una costante: `rezerva_glisiera` esce
     da lui. `glisiera: null` vuol dire "nessun cassetto" e da riserva 0. */
  var glisieraId = p.glisiera == null ? null : String(p.glisiera);
  var GL = glisieraId ? slideById(glisieraId) : SLIDE_CATALOG.nessuno;
  var cassetto_interno = !!p.cassetto_interno;
  var inset_cassetto = p.inset_cassetto == null ? 0 : num(p, "inset_cassetto");
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
    /* lo schienale in cava corre fra base e cielo, e entra di `nut_d` per
       lato. `2 * t_fianco` era giusto finche base, cielo e fianco avevano la
       stessa grossezza: con un cielo da 25 su struttura da 19 lo schienale
       usciva 6 mm troppo lungo e non entrava nella cava. Sono la base e il
       cielo a togliergli altezza, non i fianchi. */
    back_H = (H - h_base - SP.base - SP.cielo) + 2 * nut_d;
    piano_interno = nut_off + t_back;
  }

  /* --- LA TREAPTA DEL MURO ---------------------------------------------
     Un muro che in basso sporge — il gradino del tubo in un bagno, il bordo
     di una vasca murata. Il corpo non si arretra: si intaglia. I fianchi
     prendono un intaglio a L in basso dietro, lo schienale si fa in DUE —
     quello sopra resta sul piano di sempre, quello sotto scende davanti al
     gradino — e la base, se sta piu in basso del gradino, si accorcia di
     quanto il gradino sporge. Cote misurate dal fondo del corpo (y = 0) e
     dal muro (z = 0). Zero e zero = nessun gradino: tutto come prima. */
  var treapta_H = p.treapta_H == null ? 0 : num(p, "treapta_H");
  var treapta_P = p.treapta_P == null ? 0 : num(p, "treapta_P");
  /* IL PROFILO DI PROFONDITA e un altro modo di dire lo stesso gradino:
     «250 sotto la cota 620, 360 sopra». Non e una seconda geometria: si
     risolve QUI nelle stesse due cote, e tutto quello che la treapta sa gia
     fare (intaglio a L, schienale in due, base accorciata) vale uguale.
     Profilo e gradino dichiarati insieme e diversi = errore, non una scelta
     silenziosa fra i due. */
  if (p.depthProfile != null) {
    var DP = depthProfileStep(p.depthProfile, H, D);
    if (DP.errors.length) throw new Error("deriveCarcass: depthProfile — " + DP.errors.join(" · "));
    if ((treapta_H > 0 || treapta_P > 0) && (treapta_H !== DP.stepH || treapta_P !== DP.stepP))
      throw new Error("deriveCarcass: depthProfile (treaptă " + DP.stepH + "×" + DP.stepP +
        ") contrazice stepH/stepP (" + treapta_H + "×" + treapta_P + "). Păstrează unul singur.");
    treapta_H = DP.stepH; treapta_P = DP.stepP;
  }
  var treapta = treapta_H > 0 && treapta_P > 0;
  /* dove comincia lo schienale intero, dal fondo: e da qui che si misura
     quanto ne resta sotto il gradino */
  var back_y0 = backMode === "in_cava" ? h_base + SP.base - nut_d
              : (piedini > 0 ? h_picior : 0);
  var back_split = treapta && t_back > 0 && treapta_H > back_y0;
  var back_jos_H = back_split ? treapta_H - back_y0 : 0;
  var back_sus_H = back_split ? back_H - back_jos_H : back_H;
  /* la base sta sotto il gradino quando il suo fondo e piu basso del gradino */
  var base_scurtata = treapta && treapta_H > h_base;
  var D_base = base_scurtata ? D_bc - treapta_P : D_bc;
  /* il fianco si intaglia dal suo fondo */
  var fianco_y0 = piedini > 0 ? h_picior : 0;
  var intaglio_fianco_H = treapta ? Math.max(0, treapta_H - fianco_y0) : 0;
  /* profondo quanto il gradino in tutti e tre i modi: lo schienale basso
     sta davanti al gradino e il fianco, sotto, comincia davanti a lui */
  var intaglio_fianco_P = treapta ? treapta_P : 0;
  /* il tramezzo poggia sulla base: si intaglia solo la parte sotto il gradino */
  var intaglio_div_H = treapta ? Math.max(0, treapta_H - (h_base + SP.base)) : 0;

  /* ripiani */
  var ripiano_W = Wi - clearance_ripiano;
  var ripiano_D = (backMode === "in_cava" ? D - piano_interno : D_bc) - setback_ripiano;

  /* zoccolo / traversa frontale */
  var zoccolo_W = Wi;
  var zoccolo_H = h_zoccolo;
  /* lo zoccolo sta arretrato dal filo anteriore: la sua posizione in
     profondita e una cota derivata come le altre, non un 50 scritto dentro
     il generatore. */
  var zoccolo_Z = D - setback_zoccolo;

  /* ante. `reveal` e la parte di fianco che resta a vista accanto all'anta:
     e la differenza fra la grossezza del fianco e la sovrapposizione. Senza
     il termine (n-1)*gap_ante le ante si toccano. */
  var reveal = t_fianco - overlay;
  var anta_W = null, anta_H = null, anta_y0 = null, anta_y1 = null, cerniere = [];
  if (n_ante > 0) {
    anta_W = (W - 2 * reveal - (n_ante - 1) * gap_ante) / n_ante;
    /* `h_base`, non `h_zoccolo`: la cassa comincia sopra lo zoccolo O sopra i
       piedini, e l'anta si posa su di lei. Con h_zoccolo l'anta di un mobile
       sui piedini partiva da terra e sporgeva di tutta l'altezza dei piedini
       oltre il cielo — nessuna regola lo prendeva. */
    anta_H = H - h_base - gap_inf - gap_sup;
    anta_y0 = h_base + gap_inf;
    anta_y1 = anta_y0 + anta_H;
    if (!n_cerniere) n_cerniere = hingeCount(anta_H);
    cerniere = positionsHinges(anta_H, n_cerniere, edge_offset);
  }

  /* --- le cote interne, per nome di specifica --------------------------
     P_int / L_int / H_int sono le tre luci interne del corpo. Ogni pezzo che
     sta DENTRO la cassa si misura su queste, e nessun generatore le
     ricalcola piu per conto suo. */
  var P_int = D - piano_interno;
  var L_int = Wi;
  var H_int = H - h_base - SP.base - SP.cielo;

  /* la larghezza di una sezione fra due tramezzi: la cota da cui escono il
     ripiano e la cassa del cassetto. */
  var sectiune_W = (L_int - n_divisorio * SP.divisorio) / (n_divisorio + 1);

  /* la riserva della guida, dal modello scelto in catalogo */
  var rezerva_glisiera = GL.rear;
  /* profondita massima della cassa del cassetto: la luce interna meno la
     riserva della guida. E' la cota che controlla l'invariante di Fase 3. */
  var P_cassetto_max = P_int - rezerva_glisiera;
  /* il cassetto INTERNO sta dietro l'anta e arretra ancora del suo inset */
  var P_cassetto_max_interno = P_cassetto_max - inset_cassetto;
  /* larghezza della cassa in LEGNO: la sezione meno quanto si mangia la guida
     sui due lati. Le casse METALLICHE (LEGRABOX, TANDEMBOX) hanno la loro
     tabella di deduzione nel catalogo cassetti dell'app, che e un catalogo di
     CASSE, non di guide: quella resta la sorgente per loro, e legge da qui
     `sectiune_W`. Due tabelle diverse per due cose diverse, non due verita
     sulla stessa cosa. */
  var L_cassetto = sectiune_W - GL.ded_lat;
  var L_cassetto_interno = L_cassetto - 8;   /* gioco che lascia all'anta */

  /* --- uscita: arrotondamento UNA volta sola ---------------------------
     `Object.freeze`: le cote derivate si LEGGONO. Un generatore che le
     ritoccava per farsi tornare un conto e esattamente come nasce la
     seconda sorgente di verita. Adesso il tentativo fallisce. */
  return Object.freeze({
    geomVersion: GEOM_VERSION,
    /* le entrate viaggiano con le uscite: la scheda di officina deve poter
       ristampare con che numeri e stato calcolato quel pezzo */
    in: {
      W: W, H: H, D: D, t_fianco: t_fianco, t_back: t_back, backMode: backMode,
      h_zoccolo: h_zoccolo, h_base: h_base, n_ante: n_ante, overlay: overlay, gap_ante: gap_ante,
      gap_sup: gap_sup, gap_inf: gap_inf, setback_ripiano: setback_ripiano,
      clearance_ripiano: clearance_ripiano, n_cerniere: n_cerniere,
      piedini: piedini, h_picior: h_picior, edge_offset: edge_offset,
      nut_d: nut_d, nut_off: nut_off, setback_zoccolo: setback_zoccolo,
      foratura_prof: foratura_prof, foratura_dist_cant: foratura_dist_cant,
      n_divisorio: n_divisorio, glisiera: glisieraId,
      cassetto_interno: cassetto_interno, inset_cassetto: inset_cassetto,
      treapta_H: treapta_H, treapta_P: treapta_P,
      sp: { fianco: SP.fianco, base: SP.base, cielo: SP.cielo, schienale: SP.schienale,
            ripiano: SP.ripiano, frontale: SP.frontale, zoccolo: SP.zoccolo,
            divisorio: SP.divisorio }
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
    zoccolo_Z: mm(zoccolo_Z),
    reveal: mm(reveal),
    anta_W: mm(anta_W),
    anta_H: mm(anta_H),
    anta_y0: mm(anta_y0),
    anta_y1: mm(anta_y1),
    n_cerniere: n_cerniere,
    cerniere: cerniere,
    /* cote di foratura: numeri, non intervalli. "3-6 mm" non e una quota che
       una macchina possa eseguire, ed e quello che prende A8. */
    foratura: Object.freeze({ prof: foratura_prof, dist_cant: foratura_dist_cant, diam: 35 }),

    /* ===== NOMI DI SPECIFICA =============================================
       Gli stessi numeri, con i nomi che usano la specifica e i controlli.
       Non sono un secondo calcolo: sono lo stesso, con un altro nome. Chi
       scrive una regola nuova usa questi. */
    P_int: mm(P_int),
    L_int: mm(L_int),
    H_int: mm(H_int),

    sp_fianco:    SP.fianco,
    sp_base:      SP.base,
    sp_cielo:     SP.cielo,
    sp_schienale: SP.schienale,
    sp_ripiano:   SP.ripiano,
    sp_frontale:  SP.frontale,
    sp_zoccolo:   SP.zoccolo,
    sp_divisorio: SP.divisorio,
    sp: Object.freeze({
      fianco: SP.fianco, base: SP.base, cielo: SP.cielo, schienale: SP.schienale,
      ripiano: SP.ripiano, frontale: SP.frontale, zoccolo: SP.zoccolo,
      divisorio: SP.divisorio
    }),

    tip_schienale: BACK_KIND[backMode],

    /* le profondita FINITE, quelle che vanno in distinta */
    P_fianco_finita:  mm(D_fianco),
    P_base_finita:    mm(D_base),
    P_cielo_finita:   mm(D_bc),
    P_ripiano_finita: mm(ripiano_D),

    /* gli arretramenti: quanto un pezzo sta indietro dal filo del corpo */
    retrasare_ripiano:   mm(setback_ripiano),
    /* lo schienale arretra solo quando corre in cava: incassato e applicato
       stanno a filo del piano posteriore. */
    retrasare_schienale: mm(backMode === "in_cava" ? nut_off : 0),

    /* i giochi di montaggio: costanti di mestiere, indipendenti dalla
       grossezza. Restano quelli anche quando il pannello cambia. */
    jocuri: Object.freeze({
      joc_frontale_laterale: mm(gap_ante),
      joc_frontale_verticale: mm(gap_sup + gap_inf),
      joc_frontale_sus: mm(gap_sup),
      joc_frontale_jos: mm(gap_inf),
      joc_ripiano: mm(clearance_ripiano),
      reveal: mm(reveal)
    }),

    /* cassetti: la riserva viene dal MODELLO di guida, non da una costante */
    glisiera: glisieraId,
    glisiera_brand: GL.brand,
    rezerva_glisiera: rezerva_glisiera,
    P_cassetto_max: mm(P_cassetto_max),
    P_cassetto_max_interno: mm(P_cassetto_max_interno),
    L_cassetto: mm(L_cassetto),
    L_cassetto_interno: mm(L_cassetto_interno),

    /* la larghezza di una sezione fra i tramezzi */
    n_divisorio: n_divisorio,
    sectiune_W: mm(sectiune_W),

    /* --- PRECISIONE PIENA, per chi deve ancora calcolarci sopra ---------
       Le cote qui sopra sono arrotondate al mm: sono quelle che vanno in
       distinta. Ma una sezione da 602,67 mm arrotondata a 603 e poi
       diminuita del gioco del ripiano da 601 invece di 600 — un
       arrotondamento in catena, che la regola del progetto vieta.
       Chi usa una cota derivata per calcolarne un'altra legge DA QUI, e
       arrotonda una volta sola, alla fine. */
    exact: Object.freeze({
      P_int: P_int, L_int: L_int, H_int: H_int,
      sectiune_W: sectiune_W,
      D_fianco: D_fianco, D_bc: D_bc, piano_interno: piano_interno,
      ripiano_W: ripiano_W, ripiano_D: ripiano_D,
      anta_W: anta_W, anta_H: anta_H, reveal: reveal,
      P_cassetto_max: P_cassetto_max, L_cassetto: L_cassetto
    }),

    /* il gradino del muro, gia risolto in cote di pezzo. `activa: false`
       e il caso di sempre: nessun chiamante deve controllare altro. */
    treapta: Object.freeze({
      activa: treapta, H: treapta_H, P: treapta_P,
      back_split: back_split, back_y0: mm(back_y0),
      back_sus_H: mm(back_sus_H), back_jos_H: mm(back_jos_H),
      /* lo schienale basso sta avanti di tanto rispetto a quello alto */
      back_jos_Z: back_split ? treapta_P : 0,
      base_scurtata: base_scurtata, D_base: mm(D_base),
      /* la profondita che la base cede al gradino: entra nella catena P */
      P_cedat_base: base_scurtata ? treapta_P : 0,
      intaglio_fianco: Object.freeze({ H: mm(intaglio_fianco_H), P: mm(intaglio_fianco_P) }),
      intaglio_divisorio: Object.freeze({ H: mm(intaglio_div_H), P: treapta ? treapta_P : 0 })
    }),

    /* la tabella degli assi viaggia con le cote: chi rimonta il gabarito
       (Fase 2) non deve andarsela a cercare altrove. */
    ROLE_AXES: ROLE_AXES
  });
}

/* --- LA RICOSTRUZIONE INVERSA DEL GABARITO --------------------------------
 *
 * Questo e il controllo che avrebbe preso il guasto della libreria SENZA che
 * nessuno sapesse del guasto.
 *
 * L'idea: la distinta non e una lista di numeri, e un mobile smontato. Se si
 * rimettono insieme i pezzi — ognuno con la SUA grossezza e con gli assi che
 * porta scritti addosso — si deve riottenere il gabarito che il cliente ha
 * ordinato. Se non torna, la distinta descrive un altro mobile.
 *
 * Tolleranza: ZERO millimetri. Non e severita per gusto. Le cote in distinta
 * sono intere e il gabarito e intero: se la somma non torna esatta, manca
 * qualcosa — non e rumore di arrotondamento. Il guasto della libreria era di
 * 18 mm, ma quello successivo potrebbe essere di 1, e un millimetro di
 * tolleranza lo lascerebbe passare.
 *
 * Non si misura una catena sola: se ne misurano SEI, che partono da pezzi
 * diversi e devono arrivare allo stesso numero. Una sola catena verifica che
 * il generatore sia d'accordo con se stesso; sei catene verificano che i
 * pezzi stiano davvero insieme.
 *
 * PURA: entra un corpo, dei pezzi e le cote derivate; esce una lista di
 * scostamenti. Nessuno stato, nessun effetto.
 */

/* I tronconi di un pezzo spezzato tornano un pezzo solo. Un fianco da 2800
   tagliato in due da 1400 e ALTO 2800: misurare il primo troncone e
   dichiarare il corpo alto la meta. */
function closureRow(pieces, role) {
  var rows = [], i, p;
  for (i = 0; i < (pieces || []).length; i++) {
    p = pieces[i];
    /* `part` = la seconda meta di un pezzo diviso da un gradino (lo
       schienale basso). Non e un troncone: e un pezzo intero, uguale in
       larghezza al primo, e non va sommato a lui. */
    if (!p || p.role !== role || p.part) continue;
    /* `partial` = un pezzo che NON attraversa il corpo di proposito: un
       setto che si ferma a meta altezza, un ripiano di una sola colonna.
       La catena del gabarito misura i pezzi che vanno da parete a parete;
       questi li controlla `validateLayout`, colonna per colonna. */
    if (p.partial) continue;
    rows.push(p);
  }
  if (!rows.length) return null;
  var segs = rows.filter(function (r) { return r.seg && r.seg.n > 1; });
  if (segs.length) {
    var lung = 0;
    for (i = 0; i < segs.length; i++) lung += +segs[i].lung || 0;
    return { lung: lung, larg: +segs[0].larg || 0, sp: segs[0].sp,
             pz: +segs[0].pz || 0, axes: segs[0].axis_mapping,
             nomi: segs.map(function (r) { return r.elemento; }) };
  }
  return { lung: +rows[0].lung || 0, larg: +rows[0].larg || 0, sp: rows[0].sp,
           pz: +rows[0].pz || 0, axes: rows[0].axis_mapping,
           nomi: [rows[0].elemento] };
}
/* base e cielo escono in una riga sola quando sono lo stesso pezzo, e in due
   quando le grossezze si separano: chi cerca la base le trova in tutti e due
   i casi. */
function closureBC(pieces, which) {
  return closureRow(pieces, which) || closureRow(pieces, "base_cielo");
}
/* Quale cota del pezzo corre lungo l'asse chiesto. Lo dice `axis_mapping`,
   che il generatore ha scritto sul pezzo: NON si indovina dall'ordine. */
function alongAxis(row, axis) {
  var ax = row && (row.axes || row.axis_mapping);
  if (!ax) return null;
  if (ax.lung === axis) return row.lung;
  if (ax.larg === axis) return row.larg;
  return null;
}

/* Ricostruisce il corpo dai pezzi e torna TUTTE le catene, quelle che
   tornano e quelle che no. `validateCarcassClosure` e il filtro di questa:
   due funzioni che ricostruiscono il corpo sarebbero due verita, ed e
   esattamente quello che questo file esiste per impedire. */
function reconstructCarcass(corpo, pieces, geometry) {
  var out = [];
  var c = corpo || {}, G = geometry || {};
  var W = +(c.W != null ? c.W : c.L);
  var H = +c.H;
  var D = +(c.D != null ? c.D : c.P);
  if (!(W > 0 && H > 0 && D > 0)) return out;   /* non e un corpo: niente da chiudere */

  var fianco = closureRow(pieces, "fianco") || closureRow(pieces, "fianco_sx");
  /* nessun fianco = non e una cassa (un tavolo, un letto). Non si inventa un
     corpo che non c'e. */
  if (!fianco) return out;

  var base = closureBC(pieces, "base"), cielo = closureBC(pieces, "cielo");
  var back = closureRow(pieces, "schienale");
  var divis = closureRow(pieces, "divisorio");

  var tip = G.tip_schienale || "incassato";
  /* LA GROSSEZZA DI UN PEZZO NON SI SUPPONE MAI A ZERO. Una riga senza `sp`
     e una riga vecchia, emessa prima che questo controllo esistesse: si usa
     la grossezza che il motore assegna al suo ruolo — lo stesso numero con
     cui e stata tagliata — e si SEGNALA che la distinta va rigenerata.
     Leggere zero al posto suo dichiarerebbe rotto ogni corpo sano, e un
     giorno dichiarerebbe sano un corpo rotto. */
  var presunte = [];
  function spOf(row, fallbackKey) {
    if (row && row.sp != null && +row.sp > 0) return +row.sp;
    if (row) presunte.push(row.nomi.join(", "));
    return +G[fallbackKey] || 0;
  }
  var spBack = back ? spOf(back, "sp_schienale") : 0;
  var spF = spOf(fianco, "sp_fianco") || +G.sp_fianco || 0;
  var spB = base ? spOf(base, "sp_base") : (+G.sp_base || 0);
  var spC = cielo ? spOf(cielo, "sp_cielo") : (+G.sp_cielo || 0);
  var inp = G.in || {};
  var h_base = +inp.h_base || 0;
  var h_picior = (inp.piedini > 0) ? (+inp.h_picior || 0) : 0;
  var nut_d = +inp.nut_d || 0;

  function add(axa, chain, nominal, calc, piese, why) {
    if (calc == null) return;
    /* la catena si registra SEMPRE, anche quando torna: la foglia di
       chiusura stampa il gabarito ricostruito, e non puo stamparlo solo
       quando e sbagliato. */
    out.push({ axa: axa, chain: chain, valoare_nominala: nominal,
               valoare_calculata: calc, delta: +(calc - nominal).toFixed(3),
               piese_implicate: piese, why: why });
  }

  /* ---- PROFONDITA -------------------------------------------------------
     applicato  -> P = P_fianco + sp_schienale   (lo schienale sta DIETRO)
     incassato  -> P = P_fianco                  (sta fra i fianchi)
     scanalato  -> P = P_fianco                  (corre in una cava) */
  var dietro = (tip === "applicato") ? spBack : 0;
  var pF = alongAxis(fianco, "P");
  add("P", "fianco+schienale", D, (pF == null ? null : pF + dietro),
      fianco.nomi.concat(back && dietro ? back.nomi : []),
      "Adâncimea recompusă din laterală (plus spatele, dacă e aplicat) nu dă adâncimea nominală a corpului.");

  if (base) {
    /* base e cielo arretrano di quanto lo schienale ruba in profondita: in
       cava non ruba niente, negli altri due modi ruba la sua grossezza. */
    var pB = alongAxis(base, "P");
    add("P", "base+schienale", D,
        (pB == null ? null : pB + (tip === "scanalato" ? 0 : spBack)
                               + (+(G.treapta && G.treapta.P_cedat_base) || 0)),
        base.nomi.concat(back ? back.nomi : []),
        "Adâncimea recompusă din bază/tavan nu dă adâncimea nominală: fie baza e prea scurtă, fie spatele nu se scade coerent.");
  }

  /* ---- LARGHEZZA --------------------------------------------------------
     Su un corpo FUORI SQUADRO la riga di base porta il rettangolo di sbozzo
     di un trapezio, non la luce interna: la catena non chiude e non deve
     chiudere. Si dichiara saltata invece di dare un falso allarme — o, peggio,
     di essere allentata per tutti. */
  var squadro = !(isAngle(inp.angL) || isAngle(inp.angR) ||
                  isAngle(c.angL) || isAngle(c.angR));
  if (base && squadro)
    add("L", "base+2×fianco", W, alongAxis(base, "L") + 2 * spF,
        base.nomi.concat(fianco.nomi),
        "Lățimea recompusă din bază plus cele două laterale nu dă lățimea nominală.");

  if (back && squadro) {
    var bl = alongAxis(back, "L");
    /* incassato: fra i fianchi. applicato: largo quanto il corpo.
       scanalato: entra di `nut_d` per lato nella cava. */
    var calcL = (bl == null) ? null
      : (tip === "applicato") ? bl
      : (tip === "scanalato") ? bl + 2 * spF - 2 * nut_d
      : bl + 2 * spF;
    add("L", "schienale(" + tip + ")", W, calcL,
        back.nomi.concat(fianco.nomi),
        "Lățimea recompusă din spate nu dă lățimea nominală: spatele nu se potrivește între laterale.");
  }

  /* ---- ALTEZZA ----------------------------------------------------------
     Sui piedini il fianco si ferma sopra di loro; sullo zoccolo arriva a
     terra. In tutti e due i casi il corpo e alto H. */
  add("H", "fianco+piedini", H, alongAxis(fianco, "H") + h_picior,
      fianco.nomi,
      "Înălțimea recompusă din laterală (plus picioarele) nu dă înălțimea nominală.");

  /* La catena che entra DENTRO il corpo: zoccolo/piedini, base, luce interna,
     cielo. E' quella che si accorge di una base o di un cielo tagliati con la
     grossezza sbagliata — il tramezzo e lungo esattamente la luce interna. */
  if (divis) {
    var hi = alongAxis(divis, "H");
    add("H", "zoccolo+base+interno+cielo", H,
        (hi == null ? null : h_base + spB + hi + spC),
        divis.nomi.concat(base ? base.nomi : []).concat(cielo ? cielo.nomi : []),
        "Înălțimea recompusă dinăuntru (soclu + bază + lumina interioară + tavan) nu dă înălțimea nominală.");
  }

  /* La distinta vecchia si controlla lo stesso, ma si dice che e vecchia:
     chi la esporta deve sapere che la grossezza dei pezzi non e stata
     verificata contro quella scritta sulla riga, perche sulla riga non
     c'era. Avviso, non blocco: nessun progetto gia salvato e sbagliato
     per questo. */
  if (presunte.length)
    out.push({ axa: "—", chain: "sp-assente", severity: "warn",
               valoare_nominala: null, valoare_calculata: null, delta: null,
               piese_implicate: presunte.filter(function (v, i, a) { return a.indexOf(v) === i; }),
               why: "Distinta e generată înainte de controlul de închidere: piesele nu poartă grosimea lor. S-a folosit grosimea materialului rolului. Regenerează distinta." });

  /* lo stesso pezzo nominato due volte (base e cielo nella stessa riga) si
     dice una volta sola: in officina si legge un elenco, non un'eco */
  for (var k = 0; k < out.length; k++)
    out[k].piese_implicate = (out[k].piese_implicate || [])
      .filter(function (v, i, a) { return v && a.indexOf(v) === i; });

  return out;
}

/* Gli SCOSTAMENTI: le catene che non tornano, piu gli avvisi. E' quello che
   guarda il cancello di esportazione. */
function validateCarcassClosure(corpo, pieces, geometry) {
  return reconstructCarcass(corpo, pieces, geometry).filter(function (e) {
    return e.delta !== 0;
  });
}

/* Il GABARITO ricostruito, un numero per asse: quello che la foglia di
   chiusura mette accanto al nominale. Si prende la prima catena di ogni
   asse — quella che parte dal fianco, il pezzo che piu somiglia al corpo. */
function reconstructedBBox(corpo, pieces, geometry) {
  var ch = reconstructCarcass(corpo, pieces, geometry), out = {}, i, e;
  for (i = 0; i < ch.length; i++) {
    e = ch[i];
    if (e.valoare_calculata == null) continue;
    if (out[e.axa] == null) out[e.axa] = e.valoare_calculata;
  }
  return { L: out.L, H: out.H, P: out.P };
}
/* un angolo e "fuori squadro" solo se e dichiarato e diverso da 90 */
function isAngle(v) { return typeof v === "number" && isFinite(v) && Math.abs(v - 90) > 0.01; }

/* --- GLI INVARIANTI PER RUOLO (Fase 3) -----------------------------------
 *
 * La chiusura di Fase 2 controlla il GABARITO: che i pezzi, rimessi insieme,
 * facciano il mobile ordinato. Non controlla che ogni pezzo sia quello
 * giusto per il suo posto. Un ripiano lungo quanto la luce interna INTERA
 * chiude il gabarito e non entra: il gioco se l'e mangiato nessuno.
 *
 * Qui c'e l'altra meta. Ogni regola dice tre cose: se e passata, con che
 * numeri, e quali pezzi riguarda. Torna la lista COMPLETA, non solo le
 * cadute: chi stampa la foglia di chiusura deve poter far vedere anche
 * quelle che tornano.
 *
 * `opts`:
 *   materials  { ruolo: {id,label,th} }  per dire QUALE materiale non torna
 *   thicknesses [n, ...]                 le grossezze che il progetto ha
 *   maxDim     n                         la cota oltre la quale un pezzo non
 *                                        e un pezzo (2800 di serie)
 * PURA: nessuno stato, nessun effetto.
 */
function validateInvariants(corpo, pieces, geometry, opts) {
  var out = [], o = opts || {}, G = geometry || {}, c = corpo || {};
  var W = +(c.W != null ? c.W : c.L), H = +c.H, D = +(c.D != null ? c.D : c.P);
  var rows = pieces || [];
  var maxDim = +o.maxDim > 0 ? +o.maxDim : 2800;

  /* `ok` ha TRE stati: true, false, e `null` = non applicabile. Una regola
     che non si puo applicare non e una regola passata: dirlo passata
     vorrebbe dire contare come verificato qualcosa che nessuno ha guardato.
     `failedInvariants` scarta solo i `false`. */
  function rule(id, regola, ok, valori, why, piese) {
    out.push({ id: id, regola: regola, ok: (ok === null ? null : !!ok),
               valori: valori || {}, why: why || "", piese_implicate: piese || [] });
  }
  /* le cote sono intere: uguale vuol dire uguale */
  function eq(a, b) { return a != null && b != null && Math.round(a) === Math.round(b); }

  var fianco = closureRow(rows, "fianco") || closureRow(rows, "fianco_sx");
  if (!fianco || !(W > 0 && H > 0 && D > 0)) return out;   /* non e una cassa */

  var base = closureBC(rows, "base"), cielo = closureBC(rows, "cielo");
  var back = closureRow(rows, "schienale");
  var tip = G.tip_schienale || "incassato";
  var spBack = back ? (back.sp != null ? +back.sp : +G.sp_schienale || 0) : 0;
  var spF = +G.sp_fianco || 0, spB = +G.sp_base || 0, spC = +G.sp_cielo || 0;
  var inp = G.in || {};
  var h_base = +inp.h_base || 0;
  var P_fianco = alongAxis(fianco, "P");

  /* --- lo schienale e la profondita ------------------------------------ */
  if (tip === "applicato")
    rule("I1", "P_fianco == P_nom - sp_schienale",
      eq(P_fianco, D - spBack), { P_fianco: P_fianco, P_nom: D, sp_schienale: spBack },
      "Spate aplicat: laterala trebuie scurtata cu grosimea spatelui, altfel corpul iese mai adânc decât nominalul.",
      fianco.nomi);
  if (tip === "incassato") {
    rule("I2a", "P_fianco == P_nom",
      eq(P_fianco, D), { P_fianco: P_fianco, P_nom: D },
      "Spate încastrat: laterala merge până la planul din spate, nu se scurtează.",
      fianco.nomi);
    if (back)
      rule("I2b", "L_schienale == L_nom - 2*sp_fianco",
        eq(alongAxis(back, "L"), W - 2 * spF),
        { L_schienale: alongAxis(back, "L"), L_nom: W, sp_fianco: spF },
        "Spate încastrat: intră între laterale, deci e mai îngust cu două grosimi de laterală.",
        back.nomi);
  }

  /* --- la pila verticale: zoccolo, base, ripiani, cielo -----------------
     Non e una tautologia: le quote dei ripiani vengono dal generatore, e
     la pila deve arrivare ESATTAMENTE sotto il cielo. */
  var rip = null, i, j;
  for (i = 0; i < rows.length; i++)
    if (rows[i].role === "ripiano" && rows[i].ys && rows[i].ys.length && !rows[i].partial) { rip = rows[i]; break; }
  var spRip = +G.sp_ripiano || 0;
  if (rip) {
    var ys = rip.ys.slice().sort(function (a, b) { return a - b; });
    var sumSp = ys.length * spRip;
    /* Le luci fra base, ripiani e cielo, una per una.
       NOTA sulla regola: «Σ H_interne + Σ sp_ripiani + sp_base + sp_cielo ==
       H_nom», presa alla lettera, e una TAUTOLOGIA — le luci interne sono
       DEFINITE come quello che resta, quindi la somma torna per qualunque
       quota dei ripiani, anche per un ripiano piazzato dentro il cielo.
       Quello che la regola vuole prendere davvero e una luce che sparisce:
       un ripiano fuori dal vano, o due alla stessa quota. Si controlla la
       somma E che ogni luce sia positiva; e la seconda che lavora. */
    var luci = 0, y0 = h_base + spB, minLuce = Infinity, l1;
    for (j = 0; j < ys.length; j++) {
      l1 = (ys[j] - spRip / 2) - y0;
      luci += l1; if (l1 < minLuce) minLuce = l1;
      y0 = ys[j] + spRip / 2;
    }
    l1 = (H - spC) - y0;
    luci += l1; if (l1 < minLuce) minLuce = l1;
    rule("I3", "Σ H_interne + Σ sp_ripiani + h_base + sp_base + sp_cielo == H_nom, si toate luminile > 0",
      eq(luci + sumSp + h_base + spB + spC, H) && minLuce > 0,
      { H_interne: Math.round(luci), sp_ripiani: Math.round(sumSp), h_base: h_base,
        sp_base: spB, sp_cielo: spC, H_nom: H, n_ripiani: ys.length,
        lumina_minima: Math.round(minLuce),
        total: Math.round(luci + sumSp + h_base + spB + spC) },
      minLuce <= 0
        ? "O poliță cade în afara golului sau peste alta: una dintre luminile interioare e nulă sau negativă."
        : "Pila verticală — soclu, bază, polițe, tavan — nu închide înălțimea corpului.",
      [rip.elemento].concat(base ? base.nomi : []).concat(cielo ? cielo.nomi : []));
  }

  /* --- i frontali e la larghezza --------------------------------------- */
  var fronts = rows.filter(function (r) { return r.role === "frontale"; });
  /* Due costruzioni a cui questa regola NON si applica, e si dice invece di
     farla cadere a vuoto:
       - le ante SCORREVOLI si sovrappongono, non si accostano: la somma
         delle larghezze e piu grande dell'apertura, ed e giusto cosi;
       - l'anta a TELAIO E VETRO non esce come un pezzo: escono i montanti e
         le traverse, che sono larghi 70, non quanto l'anta.
     Allentare la regola per farle passare vorrebbe dire non controllare piu
     nemmeno le ante normali. */
  var scorrevole = (c.type === "scorrevole" && +c.doors > 0);
  var telaio = (c.front === "vetro");
  /* ante a COTE ASSOLUTE: due in basso e due in alto non si sommano sulla
     larghezza — la somma farebbe il doppio dell'apertura. Le controlla
     `validateLayout` (dentro il gabarito, nessuna sovrapposizione). */
  var esplicite = !!(c.fronts && c.fronts.length);
  var nA = 0, sumL = 0;
  for (i = 0; i < fronts.length; i++) {
    /* su un'anta curva la larghezza dell'ANTA e la corda; in distinta va lo
       sviluppo, che e piu lungo perche il pannello si piega dopo. */
    var l = (fronts[i].curve && fronts[i].curve.corda > 0)
      ? +fronts[i].curve.corda : alongAxis(fronts[i], "L");
    if (l == null) continue;
    nA += +fronts[i].pz || 0; sumL += l * (+fronts[i].pz || 0);
  }
  if (esplicite) {
    rule("I4", "Σ L_fronturi + Σ jocuri == L_nom", null,
      { motiv: "ante a cote assolute" },
      "Ușile au cote absolute (x, y, l, h): se verifică în validateLayout, nu prin suma lățimilor.",
      fronts.map(function (r) { return r.elemento; }));
  } else if (scorrevole || telaio) {
    rule("I4", "Σ L_fronturi + Σ jocuri == L_nom", null,
      { motiv: scorrevole ? "ante scorrevoli" : "anta a telaio e vetro" },
      scorrevole
        ? "Ușile glisante se suprapun, nu se acostează: suma lățimilor e mai mare decât deschiderea, și e corect așa."
        : "Ușa cu ramă și sticlă nu iese ca o piesă: ies montanții și traversele, late de 70 mm, nu cât ușa.",
      fronts.map(function (r) { return r.elemento; }));
  } else if (nA > 0 && G.jocuri) {
    var gap = +G.jocuri.joc_frontale_laterale || 0, rev = +G.jocuri.reveal || 0;
    var tot = sumL + (nA - 1) * gap + 2 * rev;
    /* le ante escono arrotondate al mm: su una larghezza che non si divide
       esatta la somma non torna MAI al millesimo. Mezzo millimetro per anta
       e l'arrotondamento, non un errore. */
    rule("I4", "Σ L_fronturi + Σ jocuri == L_nom",
      Math.abs(tot - W) <= nA * 0.5 + 0.05,
      { L_fronturi: Math.round(sumL), n_fronturi: nA, joc: gap, reveal: rev,
        total: Math.round(tot), L_nom: W },
      "Fronturile plus jocurile nu acoperă exact deschiderea: fie se ating, fie lasă un gol.",
      fronts.map(function (r) { return r.elemento; }));
  }

  /* --- i cassetti ------------------------------------------------------- */
  var cas = closureRow(rows, "cassetto_fianco");
  if (cas && G.P_cassetto_max != null) {
    var Pc = alongAxis(cas, "P");
    if (Pc != null)
      rule("I5", "P_cassetto <= P_int - rezerva_glisiera",
        Pc <= +G.P_cassetto_max + 0.05,
        { P_cassetto: Pc, P_int: G.P_int, rezerva_glisiera: G.rezerva_glisiera,
          max: G.P_cassetto_max },
        "Sertarul e mai adânc decât lasă ghidajul ales: nu intră până la capăt.",
        cas.nomi);
  }

  /* --- i ripiani -------------------------------------------------------- */
  /* un ripiano `flush` (quello che chiude il gradino) va a filo di
     proposito: la retrasare non lo riguarda. */
  var ripAny = closureRow(rows.filter(function (r) { return !r.flush; }), "ripiano");
  if (ripAny) {
    var Pr = alongAxis(ripAny, "P"), Lr = alongAxis(ripAny, "L");
    if (Pr != null)
      rule("I6", "P_ripiano <= P_fianco - retrasare_ripiano",
        Pr <= P_fianco - (+G.retrasare_ripiano || 0) + 0.05,
        { P_ripiano: Pr, P_fianco: P_fianco, retrasare: G.retrasare_ripiano },
        "Polița e mai adâncă decât lasă retrasarea: ajunge la fața corpului.",
        ripAny.nomi);
    /* su un corpo con tramezzi il ripiano e largo una SEZIONE, non tutta la
       luce interna: la regola si applica alla cota giusta. */
    var attesa = (inp.n_divisorio > 0 ? +G.sectiune_W : +G.L_int) - (+(G.jocuri && G.jocuri.joc_ripiano) || 0);
    if (Lr != null)
      rule("I7", inp.n_divisorio > 0 ? "L_ripiano == sectiune_W - joc_ripiano"
                                     : "L_ripiano == L_int - joc_ripiano",
        Math.abs(Lr - attesa) <= 1,
        { L_ripiano: Lr, asteptat: Math.round(attesa),
          L_int: G.L_int, sectiune_W: G.sectiune_W,
          joc_ripiano: G.jocuri && G.jocuri.joc_ripiano },
        "Polița nu are jocul declarat: fie freacă în laterale, fie joacă în gol.",
        ripAny.nomi);
  }

  /* --- ogni pezzo: cote possibili, e grossezza = quella del suo materiale */
  var fuori = [], grossezze = [], estranee = [];
  var permesse = o.thicknesses || null;
  for (i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!r.role || r.role === "accessorio") continue;
    var L1 = +r.lung, L2 = +r.larg;
    if (!(L1 > 0) || !(L2 > 0) || L1 > maxDim || L2 > maxDim)
      fuori.push(r.elemento + " " + L1 + "×" + L2);
    /* la grossezza SCRITTA sul pezzo deve essere quella del materiale del
       suo ruolo. Se non lo e, uno dei due mente — e in segheria si taglia
       dalla lastra sbagliata. */
    /* un pezzo che porta un materiale SUO (il fondo del cassetto in HDF da
       5) ha gia la grossezza di quel materiale: confrontarla con quella del
       ruolo accuserebbe il pezzo giusto. */
    var key = (r.spSrc === "mat") ? null : ROLE_SP_KEY[r.role];
    if (key && r.sp != null && G[key] != null && !eq(r.sp, G[key])) {
      var m = (o.materials || {})[ROLE_MAT_OF[r.role] || ""] || null;
      grossezze.push({ pezzo: r.elemento, sp_pezzo: +r.sp, sp_material: +G[key],
                       material: (m && (m.label || m.id)) || "?" });
    }
    /* RESIDUO SCRITTO A MANO: una grossezza che non sta fra i materiali del
       progetto non viene da nessun materiale. Viene dal codice. */
    if (permesse && r.sp != null && permesse.indexOf(+r.sp) < 0)
      estranee.push(r.elemento + " " + r.sp + " mm");
  }
  rule("I8", "0 < cota <= " + maxDim, fuori.length === 0,
    { fuori: fuori.length },
    "Piese cu o cotă nulă, negativă sau mai mare decât placa: nu se pot tăia.",
    fuori);
  rule("I9", "sp_pezzo == sp_material(rol)", grossezze.length === 0,
    { discrepante: grossezze },
    grossezze.length
      ? ("Grosimea scrisă pe piesă nu e cea a materialului rolului: " +
         grossezze.map(function (g) {
           return g.pezzo + " " + g.sp_pezzo + " mm ≠ " + g.material + " " + g.sp_material + " mm";
         }).join(" · "))
      : "Grosimea fiecărei piese e cea a materialului alocat rolului ei.",
    grossezze.map(function (g) { return g.pezzo; }));
  if (permesse)
    rule("I10", "sp ∈ materialele proiectului", estranee.length === 0,
      { estranee: estranee, permesse: permesse },
      "O grosime care nu apare în niciun material al proiectului nu vine dintr-un material: vine din cod.",
      estranee);

  return out;
}
/* da che ruolo di pezzo si legge quale grossezza, e di quale materiale */
var ROLE_SP_KEY = {
  fianco: "sp_fianco", fianco_sx: "sp_fianco", fianco_dx: "sp_fianco",
  base: "sp_base", cielo: "sp_cielo", base_cielo: "sp_base",
  schienale: "sp_schienale", ripiano: "sp_ripiano", divisorio: "sp_divisorio",
  zoccolo: "sp_zoccolo", frontale: "sp_frontale", traversa: "sp_frontale",
  cassetto_frontale: "sp_frontale", cassetto_fianco: "sp_fianco",
  cassetto_fondo: "sp_fianco"
};
var ROLE_MAT_OF = {
  fianco: "fianco", fianco_sx: "fianco", fianco_dx: "fianco",
  base: "base", cielo: "cielo", base_cielo: "base", schienale: "schienale",
  ripiano: "ripiano", divisorio: "divisorio", zoccolo: "zoccolo",
  frontale: "frontale", traversa: "frontale", cassetto_frontale: "frontale",
  cassetto_fianco: "fianco", cassetto_fondo: "fianco"
};
/* solo quelle cadute: e quello che guarda il cancello */
function failedInvariants(corpo, pieces, geometry, opts) {
  return validateInvariants(corpo, pieces, geometry, opts)
    .filter(function (r) { return r.ok === false; });
}

/* --- COTE ASSOLUTE: profilo di profondita, partizioni, ante, decupaje ----
 *
 * Il guasto che questo blocco ripara: un prompt con cote assolute («setto che
 * si ferma a 1539, tre ripiani a destra a 620, 926, 1232») non aveva un campo
 * dove atterrare. Il corpo sapeva solo «n sezioni uguali» e «n ripiani
 * equidistanti»: le cote venivano scartate in silenzio e usciva un altro
 * mobile, con due pezzi in meno.
 *
 * Qui le cote assolute diventano pezzi, con le stesse regole del resto:
 *   - le misure derivate escono da `deriveCarcass` (spessori, P_int,
 *     ripiano_D, treapta) — questo blocco decide solo DOVE stanno i pezzi;
 *   - riferimento unico: y = 0 al pavimento (il fondo del corpo, piedini
 *     compresi), x = 0 alla faccia esterna del fianco sinistro. La y di un
 *     ripiano e quella della sua faccia INFERIORE;
 *   - nessuna correzione silenziosa: una cota che non torna e un errore con
 *     il suo perche, mai un pezzo spostato per farla tornare.
 * PURE: entrano cote, escono cote ed errori.
 */
var LAYOUT_EPS = 0.05;
function nearMm(a, b) { return Math.abs(a - b) <= LAYOUT_EPS; }
/* una cota da stampare: precisione piena dentro, 0,1 mm solo in uscita */
function fmt01(v) { var r = Math.round(v * 10) / 10; return String(r).replace(/\.0$/, ""); }
function finiteNum(v) { return typeof v === "number" ? isFinite(v) : (v != null && v !== "" && isFinite(+v)); }

/* depthProfile: [{yFrom, yTo, depth}] -> il gradino che deriveCarcass sa
   gia costruire. Supportati: una zona sola (nessun gradino) e DUE zone con
   quella di sotto meno profonda — il gradino del muro in basso. Qualunque
   altro profilo e un errore dichiarato: un fianco a tre gradini non e un
   rettangolo con un decupaj d'angolo, e la fabbrica taglia solo a 90°. */
function depthProfileStep(profile, H, D) {
  var errors = [], out = { errors: errors, zones: [], D: null, stepH: 0, stepP: 0 };
  if (!Array.isArray(profile) || !profile.length) { errors.push("profilul de adâncime e gol"); return out; }
  var z = [], i, q;
  for (i = 0; i < profile.length; i++) {
    q = profile[i] || {};
    if (!finiteNum(q.yFrom) || !finiteNum(q.yTo) || !finiteNum(q.depth)) {
      errors.push("zona " + (i + 1) + ": yFrom, yTo și depth trebuie să fie numere"); continue; }
    if (!(+q.yTo > +q.yFrom)) { errors.push("zona " + (i + 1) + ": yTo (" + q.yTo + ") ≤ yFrom (" + q.yFrom + ")"); continue; }
    if (!(+q.depth > 0)) { errors.push("zona " + (i + 1) + ": adâncime " + q.depth + " ≤ 0"); continue; }
    z.push({ yFrom: +q.yFrom, yTo: +q.yTo, depth: +q.depth });
  }
  if (errors.length) return out;
  z.sort(function (a, b) { return a.yFrom - b.yFrom; });
  if (!nearMm(z[0].yFrom, 0))
    errors.push("prima zonă începe la " + z[0].yFrom + ", nu la 0 (pardoseala)");
  for (i = 1; i < z.length; i++)
    if (!nearMm(z[i].yFrom, z[i - 1].yTo))
      errors.push("zonele " + i + " și " + (i + 1) + " nu se ating: " + z[i - 1].yTo + " ≠ " + z[i].yFrom);
  if (H != null && !nearMm(z[z.length - 1].yTo, +H))
    errors.push("ultima zonă se termină la " + z[z.length - 1].yTo + ", nu la H = " + H);
  /* due zone consecutive con la stessa profondita sono una zona sola */
  var m = [z[0]];
  for (i = 1; i < z.length; i++) {
    if (nearMm(z[i].depth, m[m.length - 1].depth)) m[m.length - 1] = { yFrom: m[m.length - 1].yFrom, yTo: z[i].yTo, depth: z[i].depth };
    else m.push(z[i]);
  }
  out.zones = m;
  var Dmax = 0;
  for (i = 0; i < m.length; i++) if (m[i].depth > Dmax) Dmax = m[i].depth;
  out.D = Dmax;
  if (D != null && !nearMm(+D, Dmax))
    errors.push("P = " + D + " dar adâncimea maximă din profil e " + Dmax);
  if (m.length === 2 && m[0].depth < m[1].depth) {
    out.stepH = m[1].yFrom; out.stepP = m[1].depth - m[0].depth;
  } else if (m.length > 1) {
    errors.push("profil nesuportat: e acceptată o singură treaptă, jos (zona de jos mai puțin adâncă). " +
      "Profilul are " + m.length + " zone: " + m.map(function (r) { return r.yFrom + "–" + r.yTo + ":" + r.depth; }).join(", "));
  }
  return out;
}

/* Le partizioni a cote assolute.
     { type:'setto',   x:'center'|mm, yStart, yEnd, depth? }
     { type:'ripiano', y, span:'full'|'left'|'right'|[xFrom,xTo], depth? }
   x di un setto = la sua faccia SINISTRA; 'center' = in mezzo al corpo.
   Un setto che non parte dalla base o non arriva al cielo deve poggiare su un
   ripiano (o reggerne uno): altrimenti galleggia, ed e un errore. */
function derivePartitions(G, partitions, opts) {
  var o = opts || {}, errors = [], setti = [], ripiani = [];
  var inp = G.in, W = inp.W, H = inp.H, sp = G.sp, ex = G.exact;
  var tF = sp.fianco, tD = sp.divisorio, tR = sp.ripiano;
  var xIn0 = tF, xIn1 = W - tF;
  var yIn0 = inp.h_base + sp.base, yIn1 = H - sp.cielo;
  var TR = G.treapta, stepOn = !!(TR && TR.activa);
  /* la profondita utile: dal piano interno (davanti allo schienale) al
     filo anteriore. In cava include l'arretramento della cava. */
  var Pint = ex.P_int, ripD = ex.ripiano_D;
  var play = o.shelfFix ? 0 : inp.clearance_ripiano;
  var list = Array.isArray(partitions) ? partitions : [];
  var i, j, q, tag;

  for (i = 0; i < list.length; i++) {
    q = list[i];
    if (!q || (q.type !== "setto" && q.type !== "ripiano"))
      errors.push("partiția " + (i + 1) + ": tip necunoscut " + JSON.stringify(q && q.type));
  }

  for (i = 0; i < list.length; i++) {
    q = list[i]; if (!q || q.type !== "setto") continue;
    tag = "setto " + (i + 1);
    var sx0 = (q.x == null || q.x === "center") ? (W - tD) / 2 : +q.x;
    var sy0 = q.yStart == null ? yIn0 : +q.yStart, sy1 = q.yEnd == null ? yIn1 : +q.yEnd;
    if (!isFinite(sx0) || !isFinite(sy0) || !isFinite(sy1)) { errors.push(tag + ": x / yStart / yEnd nu sunt numere"); continue; }
    if (sx0 < xIn0 + 1 || sx0 + tD > xIn1 - 1)
      errors.push(tag + ": x = " + fmt01(sx0) + " iese din lumina interioară (" + fmt01(xIn0) + "–" + fmt01(xIn1 - tD) + ")");
    if (sy0 < yIn0 - LAYOUT_EPS) errors.push(tag + ": pornește la " + fmt01(sy0) + ", sub fața bazei (" + fmt01(yIn0) + ")");
    if (sy1 > yIn1 + LAYOUT_EPS) errors.push(tag + ": se oprește la " + fmt01(sy1) + ", peste fața tavanului (" + fmt01(yIn1) + ")");
    if (!(sy1 - sy0 > 0)) { errors.push(tag + ": yEnd ≤ yStart"); continue; }
    var sd = q.depth != null ? +q.depth : Pint;
    if (!(sd > 0) || sd > Pint + LAYOUT_EPS) errors.push(tag + ": adâncime " + fmt01(sd) + " (maxim " + fmt01(Pint) + ")");
    var notch = null;
    if (stepOn && sy0 < TR.H - LAYOUT_EPS) {
      /* tutto sotto il gradino: il setto e semplicemente meno profondo */
      var cut = TR.P - (Pint - sd);
      if (sy1 <= TR.H + LAYOUT_EPS) { if (cut > 0) sd -= cut; }
      else if (cut > 0) notch = { h: TR.H - sy0, w: cut, corner: "back-bottom", derived: true };
    }
    setti.push({ n: i + 1, x0: sx0, x1: sx0 + tD, y0: sy0, y1: sy1, H: sy1 - sy0, D: sd, notch: notch,
                 partial: !(nearMm(sy0, yIn0) && nearMm(sy1, yIn1)) });
  }
  for (i = 0; i < setti.length; i++) for (j = i + 1; j < setti.length; j++) {
    var a = setti[i], b = setti[j];
    if (a.x0 < b.x1 - LAYOUT_EPS && b.x0 < a.x1 - LAYOUT_EPS && a.y0 < b.y1 - LAYOUT_EPS && b.y0 < a.y1 - LAYOUT_EPS)
      errors.push("setto " + a.n + " și setto " + b.n + " se suprapun");
  }

  for (i = 0; i < list.length; i++) {
    q = list[i]; if (!q || q.type !== "ripiano") continue;
    tag = "ripiano " + (i + 1);
    if (!finiteNum(q.y)) { errors.push(tag + ": lipsește cota y"); continue; }
    var ya = +q.y, yb = ya + tR;
    tag += " @" + fmt01(ya);
    if (ya < yIn0 - LAYOUT_EPS || yb > yIn1 + LAYOUT_EPS) {
      errors.push(tag + ": în afara golului interior (" + fmt01(yIn0) + "–" + fmt01(yIn1 - tR) + ")"); continue; }
    /* i setti che ATTRAVERSANO la fascia del ripiano: quelli che la toccano
       solo (finiscono esattamente sotto di lui) lo reggono, non lo tagliano */
    var cross = setti.filter(function (s) { return s.y0 < yb - LAYOUT_EPS && s.y1 > ya + LAYOUT_EPS; })
                     .sort(function (s1, s2) { return s1.x0 - s2.x0; });
    var span = q.span == null ? "full" : q.span, rx0, rx1, lbl;
    if (span === "full") {
      if (cross.length) { errors.push(tag + ": traversant, dar setto " + cross[0].n + " (" + fmt01(cross[0].y0) + "–" + fmt01(cross[0].y1) + ") trece prin el"); continue; }
      rx0 = xIn0; rx1 = xIn1; lbl = "full";
    } else if (span === "left" || span === "right") {
      if (!cross.length) { errors.push(tag + ": '" + span + "' cere un setto activ la această cotă, și nu există niciunul"); continue; }
      if (span === "left") { rx0 = xIn0; rx1 = cross[0].x0; } else { rx0 = cross[cross.length - 1].x1; rx1 = xIn1; }
      lbl = span;
    } else if (Array.isArray(span) && span.length === 2 && finiteNum(span[0]) && finiteNum(span[1])) {
      rx0 = +span[0]; rx1 = +span[1]; lbl = "x";
      var lefts = [xIn0].concat(cross.map(function (s) { return s.x1; }));
      var rights = [xIn1].concat(cross.map(function (s) { return s.x0; }));
      var okL = lefts.some(function (v) { return nearMm(v, rx0); }), okR = rights.some(function (v) { return nearMm(v, rx1); });
      var inside = cross.some(function (s) { return s.x0 > rx0 + LAYOUT_EPS && s.x1 < rx1 - LAYOUT_EPS; });
      if (!(rx1 > rx0) || !okL || !okR || inside) {
        errors.push(tag + ": [" + fmt01(rx0) + ", " + fmt01(rx1) + "] nu se sprijină pe o laterală sau pe un setto la ambele capete"); continue; }
    } else { errors.push(tag + ": span necunoscut " + JSON.stringify(span)); continue; }

    var rd, flush = false, avail = Pint;
    if (stepOn && yb <= TR.H + LAYOUT_EPS) avail = Pint - TR.P;
    if (stepOn && ya < TR.H - LAYOUT_EPS && yb > TR.H + LAYOUT_EPS) {
      errors.push(tag + ": taie treapta de la " + fmt01(TR.H) + " (fâșia " + fmt01(ya) + "–" + fmt01(yb) + ")"); continue; }
    if (q.depth != null) {
      rd = +q.depth;
      if (!(rd > 0) || rd > avail + LAYOUT_EPS) { errors.push(tag + ": adâncime " + fmt01(rd) + " (maxim " + fmt01(avail) + ")"); continue; }
      flush = nearMm(rd, avail);
    } else if (stepOn && nearMm(ya, TR.H)) {
      /* IL RIPIANO SUL GRADINO lo chiude: va dal piano dello schienale alto
         fino al filo, senza arretramento — copre la battuta dello schienale
         basso, che altrimenti resta a vista. */
      rd = Pint; flush = true;
    } else {
      rd = (stepOn && yb <= TR.H + LAYOUT_EPS) ? ripD - TR.P : ripD;
    }
    ripiani.push({ n: i + 1, y: ya, y1: yb, x0: rx0, x1: rx1, W: (rx1 - rx0) - play, D: rd, span: lbl, flush: flush,
                   partial: !(nearMm(rx0, xIn0) && nearMm(rx1, xIn1)) });
  }
  for (i = 0; i < ripiani.length; i++) for (j = i + 1; j < ripiani.length; j++) {
    var r1 = ripiani[i], r2 = ripiani[j];
    if (r1.x0 < r2.x1 - LAYOUT_EPS && r2.x0 < r1.x1 - LAYOUT_EPS && r1.y < r2.y1 - LAYOUT_EPS && r2.y < r1.y1 - LAYOUT_EPS)
      errors.push("ripiano " + r1.n + " și ripiano " + r2.n + " se suprapun (" + fmt01(r1.y) + " / " + fmt01(r2.y) + ")");
  }
  /* un setto che non tocca base e cielo deve poggiare su qualcosa e reggere
     qualcosa: sotto, la faccia superiore di un ripiano; sopra, quella
     inferiore. Un setto sospeso nel vuoto e una cota letta male. */
  setti.forEach(function (s) {
    function covers(r) { return r.x0 <= s.x0 + LAYOUT_EPS && r.x1 >= s.x1 - LAYOUT_EPS; }
    if (!nearMm(s.y1, yIn1) && !ripiani.some(function (r) { return nearMm(r.y, s.y1) && covers(r); }))
      errors.push("setto " + s.n + " se oprește la " + fmt01(s.y1) + " și nu e niciun ripiano (sau tavanul) deasupra lui");
    if (!nearMm(s.y0, yIn0) && !ripiani.some(function (r) { return nearMm(r.y1, s.y0) && covers(r); }))
      errors.push("setto " + s.n + " pornește de la " + fmt01(s.y0) + " și nu stă nici pe bază, nici pe un ripiano");
  });
  return { errors: errors, setti: setti, ripiani: ripiani,
           box: { xIn0: xIn0, xIn1: xIn1, yIn0: yIn0, yIn1: yIn1 } };
}

/* Le ante a cote assolute: {x, y, w, h, hinge}. x dalla faccia esterna del
   fianco sinistro, y dal pavimento. Dentro il gabarito, nessuna
   sovrapposizione. L'anta puo arrivare fino al filo del corpo, non oltre. */
function validateFronts(fronts, W, H) {
  var errors = [], out = [], i, j, f;
  if (!Array.isArray(fronts)) return { errors: errors, fronts: out };
  for (i = 0; i < fronts.length; i++) {
    f = fronts[i] || {};
    var tag = "anta " + (i + 1);
    if (!finiteNum(f.x) || !finiteNum(f.y) || !finiteNum(f.w) || !finiteNum(f.h)) { errors.push(tag + ": x, y, w, h trebuie să fie numere"); continue; }
    var o = { n: i + 1, x: +f.x, y: +f.y, w: +f.w, h: +f.h, hinge: (f.hinge === "left" || f.hinge === "right") ? f.hinge : null };
    if (!(o.w >= 60 && o.h >= 60)) errors.push(tag + ": " + fmt01(o.w) + "×" + fmt01(o.h) + " e sub 60 mm");
    if (o.x < -LAYOUT_EPS || o.y < -LAYOUT_EPS || o.x + o.w > W + LAYOUT_EPS || o.y + o.h > H + LAYOUT_EPS)
      errors.push(tag + ": " + fmt01(o.w) + "×" + fmt01(o.h) + " la (" + fmt01(o.x) + ", " + fmt01(o.y) + ") iese din gabaritul " + W + "×" + H);
    if (f.hinge != null && !o.hinge) errors.push(tag + ": balama '" + f.hinge + "' — doar left / right");
    out.push(o);
  }
  for (i = 0; i < out.length; i++) for (j = i + 1; j < out.length; j++) {
    var a = out[i], b = out[j];
    if (a.x < b.x + b.w - LAYOUT_EPS && b.x < a.x + a.w - LAYOUT_EPS && a.y < b.y + b.h - LAYOUT_EPS && b.y < a.y + a.h - LAYOUT_EPS)
      errors.push("anta " + a.n + " și anta " + b.n + " se suprapun");
  }
  return { errors: errors, fronts: out };
}

/* I decupaje d'angolo sui pezzi verticali (fianchi, setti). Il pezzo resta in
   distinta al suo RETTANGOLO pieno: la fabbrica taglia a 90°, il decupaj va
   sul PDF e sull'etichetta come linea guida, nella stessa forma dell'intaglio
   del gradino (`scasso`, x lungo la lunghezza dal basso, y lungo la larghezza
   dal filo posteriore). w = lungo la profondita, h = lungo l'altezza. */
var CUT_CORNERS = { "back-bottom": "jos-spate", "front-bottom": "jos-fata",
                    "back-top": "sus-spate", "front-top": "sus-fata" };
var CUT_TARGETS = ["fianchi", "setti"];
function cutToScasso(c, lung, larg) {
  var top = /top$/.test(c.corner), front = /^front/.test(c.corner);
  return { l: Math.round(c.h), w: Math.round(c.w),
           x: Math.round(top ? lung - c.h : 0), y: Math.round(front ? larg - c.w : 0),
           forma: "L", rif: CUT_CORNERS[c.corner] };
}
/* derivati (dal gradino) + espliciti (dal testo) per UN pezzo. Lo stesso
   angolo detto due volte con due misure diverse e un errore: vuol dire che il
   testo e il profilo di profondita descrivono due mobili diversi. */
function mergeCuts(tag, derived, explicit, lung, larg, errors) {
  var byCorner = {}, out = [], i, c;
  for (i = 0; i < derived.length; i++) byCorner[derived[i].corner] = derived[i];
  for (i = 0; i < explicit.length; i++) {
    c = explicit[i];
    if (!(c.w > 0 && c.h > 0) || c.w >= larg || c.h >= lung) {
      errors.push(tag + ": decupaj " + fmt01(c.h) + "×" + fmt01(c.w) + " nu încape în piesa " + fmt01(lung) + "×" + fmt01(larg)); continue; }
    var d = byCorner[c.corner];
    if (d && d.derived) {
      if (!nearMm(Math.round(d.h), Math.round(c.h)) || !nearMm(Math.round(d.w), Math.round(c.w)))
        errors.push(tag + ": decupaj " + c.corner + " " + fmt01(c.h) + "×" + fmt01(c.w) +
          " din text ≠ " + fmt01(d.h) + "×" + fmt01(d.w) + " cerut de profilul de adâncime");
      continue;   /* uguale: e lo stesso decupaj, una volta sola */
    }
    if (d) { errors.push(tag + ": două decupaje pe colțul " + c.corner); continue; }
    byCorner[c.corner] = c;
  }
  for (var k in CUT_CORNERS) if (byCorner[k]) out.push(cutToScasso(byCorner[k], lung, larg));
  return out;
}
function normCustomCuts(list, errors) {
  var out = [];
  (Array.isArray(list) ? list : []).forEach(function (c, i) {
    c = c || {};
    var tag = "decupaj " + (i + 1);
    if (CUT_TARGETS.indexOf(c.on) < 0) { errors.push(tag + ": piesa '" + c.on + "' — doar " + CUT_TARGETS.join(" / ")); return; }
    if (!CUT_CORNERS[c.corner]) { errors.push(tag + ": colțul '" + c.corner + "' necunoscut"); return; }
    if (!finiteNum(c.w) || !finiteNum(c.h)) { errors.push(tag + ": w și h trebuie să fie numere"); return; }
    out.push({ on: c.on, corner: c.corner, w: +c.w, h: +c.h });
  });
  return out;
}

/* IL CONTROLLO PRIMA DI GENERARE. Dice, per un corpo con cote assolute:
     - gli errori (bloccanti): una cota che non ha dove stare, un pezzo che
       galleggia, due pezzi che si sovrappongono;
     - le CATENE: la pila verticale di ogni colonna e quella orizzontale di
       ogni fascia, scritte come le scrive il falegname
       («20 + 19 + 1500 + 19 + 342 + 19 + 342 + 19 = 2280»);
     - le partizioni, le ante e i decupaje gia risolti in cote di pezzo.
   `G` e l'uscita di deriveCarcass sullo stesso corpo. */
function validateLayout(cfg, G, opts) {
  var c = cfg || {}, o = opts || {}, errors = [], warnings = [];
  var hasP = Array.isArray(c.partitions) && c.partitions.length > 0;
  var hasF = Array.isArray(c.fronts) && c.fronts.length > 0;
  var hasC = Array.isArray(c.customCuts) && c.customCuts.length > 0;
  var hasD = Array.isArray(c.depthProfile) && c.depthProfile.length > 0;
  var out = { errors: errors, warnings: warnings, active: hasP || hasF || hasC || hasD,
              parts: null, fronts: [], cuts: { fianchi: [], setti: [] }, chains: { V: [], H: [] } };
  if (!out.active) return out;
  var type = c.type || "standard";
  if (type !== "standard") {
    errors.push("cotele absolute (partitions / fronts / depthProfile / customCuts) sunt suportate doar pe tipologia standard, nu pe '" + type + "'");
    return out;
  }
  var inp = G.in, W = inp.W, H = inp.H, sp = G.sp;
  if (hasP) {
    if (+c.drawers > 0) errors.push("sertarele nu se pot combina încă cu partiții la cote absolute: scoate sertarele sau partițiile");
    out.parts = derivePartitions(G, c.partitions, { shelfFix: c.shelfType === "fisso" });
    errors.push.apply(errors, out.parts.errors);
  }
  if (hasF) {
    if (c.front === "vetro" || c.front === "curvo")
      errors.push("ușile cu cote absolute sunt doar panouri pline (front '" + c.front + "' nu e suportat)");
    var VF = validateFronts(c.fronts, W, H);
    out.fronts = VF.fronts; errors.push.apply(errors, VF.errors);
  }
  /* i decupaje, pezzo per pezzo: fianchi e setti */
  var cuts = normCustomCuts(c.customCuts, errors);
  var TR = G.treapta;
  var fDerived = (TR && TR.activa && TR.intaglio_fianco.H > 0 && TR.intaglio_fianco.P > 0)
    ? [{ corner: "back-bottom", h: TR.intaglio_fianco.H, w: TR.intaglio_fianco.P, derived: true }] : [];
  out.cuts.fianchi = mergeCuts("fianchi", fDerived, cuts.filter(function (x) { return x.on === "fianchi"; }),
                               G.H_fianco, G.D_fianco, errors);
  var sCuts = cuts.filter(function (x) { return x.on === "setti"; });
  var setti = out.parts ? out.parts.setti : [];
  if (sCuts.length && !setti.length) errors.push("decupaj pe setti, dar corpul nu are niciun setto");
  out.cuts.setti = setti.map(function (s) {
    return mergeCuts("setto " + s.n, s.notch ? [s.notch] : [], sCuts, s.H, s.D, errors);
  });

  /* --- le catene -------------------------------------------------------- */
  var yIn0 = inp.h_base + sp.base, rip = out.parts ? out.parts.ripiani : [];
  var faces = [sp.fianco, W - sp.fianco];
  setti.forEach(function (s) { faces.push(s.x0, s.x1); });
  faces = faces.sort(function (a, b) { return a - b; });
  var cols = [];
  for (var i = 0; i + 1 < faces.length; i += 2) if (faces[i + 1] - faces[i] > LAYOUT_EPS) cols.push((faces[i] + faces[i + 1]) / 2);
  cols.forEach(function (xm, ci) {
    var slabs = [{ y0: inp.h_base, y1: yIn0, what: "base" }];
    rip.forEach(function (r) { if (r.x0 < xm && r.x1 > xm) slabs.push({ y0: r.y, y1: r.y1, what: "ripiano " + r.n }); });
    slabs.push({ y0: H - sp.cielo, y1: H, what: "cielo" });
    slabs.sort(function (a, b) { return a.y0 - b.y0; });
    var terms = [], y = 0, ok = true;
    if (inp.h_base > 0) { terms.push(inp.h_base); y = inp.h_base; }
    slabs.forEach(function (sl) {
      var gap = sl.y0 - y;
      if (gap < -LAYOUT_EPS) { ok = false; errors.push("coloana " + (ci + 1) + ": " + sl.what + " intră în piesa de dedesubt (" + fmt01(gap) + " mm)"); }
      else if (gap > LAYOUT_EPS) terms.push(gap);
      else if (y > 0 && sl.what !== "base") { ok = false; errors.push("coloana " + (ci + 1) + ": " + sl.what + " nu lasă nicio lumină sub el"); }
      terms.push(sl.y1 - sl.y0); y = sl.y1;
    });
    var tot = terms.reduce(function (s, v) { return s + v; }, 0);
    if (!nearMm(tot, H)) { ok = false; errors.push("coloana " + (ci + 1) + ": suma verticală " + fmt01(tot) + " ≠ H " + H); }
    out.chains.V.push({ col: ci + 1, x: xm, ok: ok, total: tot, nominal: H,
                        text: terms.map(fmt01).join(" + ") + " = " + fmt01(tot) });
  });
  var ev = [yIn0, H - sp.cielo];
  setti.forEach(function (s) { ev.push(s.y0, s.y1); });
  ev = ev.filter(function (v, k, a) { return a.findIndex(function (u) { return nearMm(u, v); }) === k; })
         .sort(function (a, b) { return a - b; });
  for (var e = 0; e + 1 < ev.length; e++) {
    var ym = (ev[e] + ev[e + 1]) / 2;
    var xs = setti.filter(function (s) { return s.y0 < ym && s.y1 > ym; }).sort(function (a, b) { return a.x0 - b.x0; });
    var terms2 = [sp.fianco], x = sp.fianco, ok2 = true;
    xs.forEach(function (s) {
      var gap = s.x0 - x;
      if (gap <= LAYOUT_EPS) ok2 = false;
      terms2.push(gap, s.x1 - s.x0); x = s.x1;
    });
    terms2.push(W - sp.fianco - x, sp.fianco);
    var tot2 = terms2.reduce(function (s, v) { return s + v; }, 0);
    if (!nearMm(tot2, W)) ok2 = false;
    out.chains.H.push({ y0: ev[e], y1: ev[e + 1], ok: ok2, total: tot2, nominal: W,
                        text: terms2.map(fmt01).join(" + ") + " = " + fmt01(tot2) });
  }
  return out;
}

/* --- LE COTE DEL TESTO: nessuna si perde in silenzio ----------------------
 * Il testo libero del falegname contiene cote. Ognuna deve finire da qualche
 * parte: in un campo della patch, in una cota di un pezzo, in una posizione.
 * Quella che non finisce da nessuna parte e stata ignorata — ed e
 * esattamente il guasto che ha fatto uscire 13 pezzi invece di 16.
 *
 * `extractCotas` legge i numeri del testo. Non sono cote:
 *   - i codici (H1145, ST10: un numero attaccato a una lettera davanti);
 *   - i CONTEGGI: un numero sotto 30 seguito da una parola («2 ripiani»,
 *     «3 decupaje») o da un moltiplicatore aperto («2 × (433×1538)»).
 * Le unita: mm = 1, cm = 10, m = 1000. «1.539» con il punto delle migliaia
 * e 1539; «2,26 m» e 2260.
 */
function extractCotas(text) {
  /* le lettere, SENZA × e ÷ (U+00D7, U+00F7), che stanno nel mezzo di À-ÿ */
  var LET = "A-Za-zÀ-ÖØ-öø-ÿĂÂÎȘȚăâîșț";
  var reLet = new RegExp("[" + LET + "_]"), reUnit = new RegExp("^\\s*(mm|cm|m)(?![" + LET + "])", "i");
  var reWord = new RegExp("^\\s*[" + LET + "]"), rePrep = /^\s*(de|da|di|dal|dalla|dallo|from|du|des)\b/i;
  var s = String(text || ""), out = [], re = /\d+(?:[.,]\d+)?/g, m;
  while ((m = re.exec(s)) !== null) {
    var raw = m[0], a = m.index, b = a + raw.length;
    var prev = a > 0 ? s[a - 1] : "";
    if (reLet.test(prev) && !/[xX]/.test(prev)) continue;     // codice
    if (/[xX]/.test(prev) && a > 1 && /[A-Za-z]/.test(s[a - 2])) continue;          // «ST10x», «Hx12»
    var rest = s.slice(b), unit = 1, mu;
    if ((mu = reUnit.exec(rest))) unit = { mm: 1, cm: 10, m: 1000 }[mu[1].toLowerCase()];
    var v;
    if (/^\d{1,3}\.\d{3}$/.test(raw) && unit === 1) v = +raw.replace(".", "");
    else v = parseFloat(raw.replace(",", "."));
    if (!isFinite(v)) continue;
    v = v * unit;
    if (!mu && v < 30) {
      /* conteggio: «2 ripiani», «3 decupaje», «2 × (433×1538)», «2x(» */
      /* «10 de la față», «20 dal filo»: dopo una preposizione e una cota */
      if (reWord.test(rest) && !/^\s*[xX]\s*\d/.test(rest) && !rePrep.test(rest)) continue;
      if (/^\s*[x×*]\s*\(/.test(rest)) continue;
    }
    out.push({ raw: raw + (mu ? mu[0] : ""), value: v, index: a });
  }
  return out;
}
/* Le cote del testo che nessun numero noto giustifica. `known` = tutti i
   numeri che la patch e i pezzi generati contengono. */
function unconsumedCotas(text, known) {
  var k = (known || []).filter(function (v) { return typeof v === "number" && isFinite(v); });
  return extractCotas(text).filter(function (c) {
    for (var i = 0; i < k.length; i++) if (Math.abs(k[i] - c.value) <= 0.5) return false;
    return true;
  });
}

/* --- asserzioni ----------------------------------------------------------
 * LE ASSERZIONI SONO DATI, NON CODICE. Un array di oggetti: si aggiunge una
 * regola scrivendo una riga, non ricompilando il motore. `when` e `then` sono
 * espressioni valutate su un ambiente CHIUSO — solo le cote derivate, niente
 * altro — da un piccolo valutatore senza eval.
 *
 * Ogni riga porta il perche e da dove viene: quando una regola scatta in
 * officina, il montatore deve leggere il motivo, non un codice di errore.
 */
var ASSERTIONS = [
  { id: "A1", severity: "blocking", confidence: "alta",
    when: 'backMode == "incassato"',
    then: "D_bc + t_back == D",
    why: "Falțul pentru spate trebuie să fie exact grosimea spatelui, altfel spatele iese din planul lateralei.",
    source: "Jacquin rev.B — falț 18 mm, spate 19 mm" },

  { id: "A2", severity: "blocking", confidence: "alta",
    when: "1", then: "back_H <= H",
    why: "Spatele e mai lung decât corpul: nu intră între laterale.",
    source: "Jacquin rev.B" },

  { id: "A3", severity: "blocking", confidence: "alta",
    when: "n_ante > 0",
    then: "abs(anta_sum - W) <= tol_ante",
    why: "Ușile nu acoperă exact deschiderea: fie se ating între ele, fie lasă un gol pe o parte.",
    source: "Jacquin rev.C — două uși de 495 cu rost de 4" },

  { id: "A4", severity: "blocking", confidence: "alta",
    when: "n_ante > 0",
    then: "anta_H + h_base + gap_inf + gap_sup == H && anta_y0 >= h_base",
    why: "Ușa freacă zoccolo-ul, picioarele sau tavanul corpului: înălțimea ei nu se închide cu jocurile declarate.",
    source: "Jacquin rev.C — ușă 1993 pe corp 2078, zoccolo 79" },

  { id: "A5", severity: "blocking", confidence: "alta",
    when: "n_ante > 0",
    then: "gap_ante >= 3 && gap_sup >= 2 && gap_inf >= 2",
    why: "Joc zero între fronturi: la prima variație de umiditate ușile se blochează una în alta.",
    source: "Blum — joc minim de montaj" },

  { id: "A6", severity: "blocking", confidence: "alta",
    when: "n_ante > 0", then: "overlay < t_fianco",
    why: "Suprapunerea ușii e mai mare decât grosimea lateralei: ușa nu are pe ce să se așeze.",
    source: "Blum CLIP top — suprapunere maximă" },

  { id: "A7", severity: "blocking", confidence: "alta",
    when: "piedini > 0", then: "H_fianco == H - h_picior",
    why: "Picioare și laterale până la pardoseală în același timp: corpul se sprijină pe laterale, iar picioarele nu ating solul.",
    source: "regulă de montaj" },

  { id: "A8", severity: "blocking", confidence: "alta",
    when: "n_ante > 0",
    then: "finite(foratura_prof) && finite(foratura_dist_cant) && finite(cerniere)",
    why: "O cotă de găurire nu poate fi un interval („3–6 mm\"): mașina trebuie să primească un singur număr.",
    source: "Jacquin rev.C — prof. 12,5 mm, distanță de la cant 5,0 mm" },

  { id: "A9", severity: "blocking", confidence: "medie",
    when: "1", then: "piesa_max <= max(W, H) + tol",
    why: "O piesă are o cotă mai mare decât corpul din care provine: nu e legată de niciun gabarit.",
    source: "auditul v4.24" },

  { id: "A10", severity: "blocking", confidence: "alta",
    when: "panelL > 0", then: "piesa_L <= panelL && piesa_W <= panelW",
    why: "O piesă e mai mare decât placa din care se debitează: nu se poate tăia.",
    source: "format placă din setările proiectului" },

  { id: "A11", severity: "blocking", confidence: "alta",
    when: "1", then: "aria_per_material == 1",
    why: "Aria netă amestecă materiale diferite: metrii pătrați trebuie raportați grupat pe material.",
    source: "auditul v4.24" },

  /* --- cote care pot deveni negative cand se schimba materialul ---------
     Retrasarile, jocurile si rezerva de glisiera sunt constante de montaj:
     raman aceleasi cand placa trece de la 18 la 25. Corpul insa se strange,
     si o cota interna poate trece prin zero fara ca nimic sa o observe.
     Astea sunt strajile. Fiecare spune ce material sa fie schimbat. */

  { id: "A12", severity: "blocking", confidence: "alta",
    when: "1", then: "L_int > 0",
    why: "Cele două laterale sunt împreună mai groase decât lățimea corpului: nu mai rămâne lumină interioară.",
    source: "grosime derivată din material (v4.27)" },

  { id: "A13", severity: "blocking", confidence: "alta",
    when: "1", then: "H_int > 0",
    why: "Baza, tavanul și zoccolo-ul ocupă toată înălțimea corpului: nu mai rămâne nimic înăuntru.",
    source: "grosime derivată din material (v4.27)" },

  { id: "A14", severity: "blocking", confidence: "alta",
    when: "1", then: "P_int > 0",
    why: "Spatele ocupă toată adâncimea corpului: nu mai rămâne adâncime utilă.",
    source: "grosime derivată din material (v4.27)" },

  { id: "A15", severity: "blocking", confidence: "alta",
    when: "1", then: "ripiano_D > 0 && ripiano_W > 0",
    why: "Retrasarea poliței depășește adâncimea utilă, sau jocul depășește lățimea: polița iese cu cotă negativă.",
    source: "grosime derivată din material (v4.27)" },

  { id: "A16", severity: "blocking", confidence: "alta",
    when: "n_ante > 0", then: "anta_W > 0 && anta_H > 0",
    why: "Jocurile declarate depășesc gabaritul: ușa iese cu cotă zero sau negativă.",
    source: "grosime derivată din material (v4.27)" },

  { id: "A17", severity: "blocking", confidence: "alta",
    when: "n_divisorio > 0", then: "sectiune_W > 0",
    why: "Tramezzii sunt împreună mai groși decât lumina interioară: nu mai rămâne nicio secțiune.",
    source: "grosime derivată din material (v4.27)" },

  { id: "A18", severity: "blocking", confidence: "alta",
    when: "rezerva_glisiera > 0", then: "P_cassetto_max > 0",
    why: "Rezerva glisierei depășește adâncimea utilă: sertarul nu are unde să intre.",
    source: "catalog glisiere (v4.27)" }
];

/* Valutatore minimo: numeri, identificatori, confronti, && || !, + - * / e
   due funzioni. NIENTE eval — un'espressione scritta nei dati non deve poter
   eseguire codice, e la regola del progetto lo vieta esplicitamente. */
function evalExpr(src, env) {
  var i = 0, s = String(src);
  function ws() { while (i < s.length && /\s/.test(s[i])) i++; }
  function peek(tok) { ws(); return s.substr(i, tok.length) === tok; }
  function eat(tok) { if (peek(tok)) { i += tok.length; return true; } return false; }
  function primary() {
    ws();
    if (eat("(")) { var v = or(); ws(); if (!eat(")")) throw new Error("manca )"); return v; }
    if (eat("!")) return !primary();
    if (eat("-")) return -primary();
    var m = /^\d+(\.\d+)?/.exec(s.slice(i));
    if (m) { i += m[0].length; return parseFloat(m[0]); }
    m = /^"([^"]*)"/.exec(s.slice(i));
    if (m) { i += m[0].length; return m[1]; }
    m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
    if (!m) throw new Error("token inatteso in `" + src + "` a " + i);
    i += m[0].length;
    var name = m[0];
    if (peek("(")) {                       // finite(x), max(a,b), abs(x)
      eat("("); var args = [];
      if (!peek(")")) { do { args.push(or()); } while (eat(",")); }
      ws(); if (!eat(")")) throw new Error("manca ) dopo " + name);
      if (name === "finite") return args.every(function (a) {
        return Array.isArray(a) ? a.every(function (v) { return typeof v === "number" && isFinite(v); })
                                : typeof a === "number" && isFinite(a); });
      if (name === "max") return Math.max.apply(Math, args);
      if (name === "min") return Math.min.apply(Math, args);
      if (name === "abs") return Math.abs(args[0]);
      throw new Error("funzione sconosciuta: " + name);
    }
    /* `in` avrebbe pescato anche i membri di Object.prototype: una regola che
       nomina `constructor` avrebbe ricevuto una funzione invece dell'errore. */
    if (!Object.prototype.hasOwnProperty.call(env, name)) throw new Error("cota assente: " + name);
    return env[name];
  }
  function mul() { var v = primary(); for (;;) { ws();
    if (eat("*")) v = v * primary(); else if (eat("/")) v = v / primary(); else return v; } }
  function add() { var v = mul(); for (;;) { ws();
    if (eat("+")) v = v + mul(); else if (peek("-") && s.substr(i, 2) !== "->") { eat("-"); v = v - mul(); } else return v; } }
  function cmp() { var v = add(); ws();
    if (eat("<=")) return v <= add(); if (eat(">=")) return v >= add();
    if (eat("==")) return eq(v, add());  if (eat("!=")) return !eq(v, add());
    if (eat("<"))  return v < add();     if (eat(">"))  return v > add();
    return v; }
  function and() { var v = cmp(); while (eat("&&")) { var r = cmp(); v = v && r; } return v; }
  function or()  { var v = and(); while (eat("||")) { var r = and(); v = v || r; } return v; }
  /* le cote sono in mm con precisione piena: due valori che differiscono di un
     millesimo sono la stessa cota, non due. */
  function eq(a, b) { return (typeof a === "number" && typeof b === "number") ? Math.abs(a - b) < 0.05 : a === b; }
  var out = or(); ws();
  if (i < s.length) throw new Error("resto non letto in `" + src + "`: " + s.slice(i));
  return out;
}

/* L'ambiente e CHIUSO: solo le cote derivate, le entrate, e i pochi valori che
   riguardano i pezzi gia emessi. Un'asserzione non puo leggere altro. */
function assertionEnv(d, ctx) {
  var e = {}, k;
  for (k in d.in) if (Object.prototype.hasOwnProperty.call(d.in, k)) e[k] = d.in[k];
  var outs = ["Wi", "D_fianco", "H_fianco", "D_bc", "piano_interno", "back_W", "back_H",
              "ripiano_W", "ripiano_D", "zoccolo_W", "zoccolo_H", "reveal",
              "anta_W", "anta_H", "anta_y0", "anta_y1", "n_cerniere",
              /* le cote con i nomi di specifica: le regole nuove usano queste */
              "P_int", "L_int", "H_int", "sectiune_W", "rezerva_glisiera",
              "P_cassetto_max", "L_cassetto",
              "sp_fianco", "sp_base", "sp_cielo", "sp_schienale", "sp_ripiano",
              "sp_frontale", "sp_zoccolo", "sp_divisorio"];
  for (var j = 0; j < outs.length; j++) if (d[outs[j]] != null) e[outs[j]] = d[outs[j]];
  /* le cote che possono valere zero (un corpo senza ante, senza cassetti)
     devono comunque ESISTERE nell'ambiente, o la regola cade per "cota
     assente" invece di dire la verita. */
  var zeros = ["rezerva_glisiera", "n_divisorio"];
  for (var z = 0; z < zeros.length; z++)
    if (e[zeros[z]] == null) e[zeros[z]] = (d[zeros[z]] != null ? d[zeros[z]] : (d.in[zeros[z]] || 0));
  e.cerniere = d.cerniere || [];
  e.h_base = (d.in.h_zoccolo || 0) + (d.in.piedini > 0 ? (d.in.h_picior || 0) : 0);
  /* Le ante escono arrotondate al mm: su una larghezza che non si divide
     esattamente, la somma non torna MAI al millesimo. Si controlla quello che
     conta davvero — che non si tocchino e non lascino un buco — con la
     tolleranza dell'arrotondamento, mezzo millimetro per anta. */
  e.anta_sum = (d.anta_W != null)
    ? d.in.n_ante * d.anta_W + (d.in.n_ante - 1) * d.in.gap_ante + 2 * (d.reveal || 0)
    : 0;
  e.tol_ante = (d.in.n_ante || 0) * 0.5 + 0.05;
  e.tol = 1;
  ctx = ctx || {};
  e.panelL = ctx.panelL || 0; e.panelW = ctx.panelW || 0;
  /* le tre cote che riguardano i pezzi emessi, non il corpo: chi non passa i
     pezzi non fa scattare A9/A10/A11, invece di farle cadere a vuoto. */
  e.piesa_max = ctx.piesa_max != null ? ctx.piesa_max : 0;
  e.piesa_L = ctx.piesa_L != null ? ctx.piesa_L : 0;
  e.piesa_W = ctx.piesa_W != null ? ctx.piesa_W : 0;
  e.aria_per_material = ctx.aria_per_material != null ? ctx.aria_per_material : 1;
  return e;
}

/* Torna SOLO le asserzioni cadute. Lista vuota = tutto a posto.
   Una regola che non si riesce nemmeno a valutare e essa stessa un guasto:
   si segnala, non si ingoia. */
function checkAssertions(derived, ctx, rules) {
  var list = rules || ASSERTIONS, out = [], env;
  try { env = assertionEnv(derived, ctx); }
  catch (e) { return [{ id: "ENV", severity: "blocking", why: "Nu se pot citi cotele pentru verificare: " + e.message }]; }
  for (var i = 0; i < list.length; i++) {
    var a = list[i];
    try {
      if (!evalExpr(a.when, env)) continue;
      if (!evalExpr(a.then, env)) out.push(a);
    } catch (e) {
      out.push({ id: a.id, severity: "blocking", confidence: a.confidence, why: a.why,
                 source: a.source, error: "regola non valutabile: " + e.message });
    }
  }
  return out;
}
function blocking(failed) {
  return (failed || []).filter(function (a) { return a.severity === "blocking"; });
}

/* Impronta del set di asserzioni attivo: 8 caratteri, stampata sul PDF.
   Da li si risale a CON QUALI regole e stata calcolata quella distinta. */
function assertionsHash(rules) {
  var src = JSON.stringify((rules || ASSERTIONS).map(function (a) {
    return [a.id, a.when, a.then, a.severity];
  }));
  var h1 = 0x811c9dc5, h2 = 0x01000193;
  for (var i = 0; i < src.length; i++) {
    h1 = (h1 ^ src.charCodeAt(i)) >>> 0; h1 = (h1 * 0x01000193) >>> 0;
    h2 = (h2 + src.charCodeAt(i) * (i + 1)) >>> 0;
  }
  return (("0000000" + h1.toString(16)).slice(-8).slice(0, 4) +
          ("0000000" + h2.toString(16)).slice(-8).slice(0, 4));
}

/* --- pubblicazione -------------------------------------------------------- */
var API = {
  GEOM_VERSION: GEOM_VERSION,
  CARCASS_DEFAULTS: CARCASS_DEFAULTS,
  PANEL_DEFAULTS: PANEL_DEFAULTS,
  ROLES: ROLES,
  ROLE_AXES: ROLE_AXES,
  axesFor: axesFor,
  SLIDE_CATALOG: SLIDE_CATALOG,
  slideById: slideById,
  BACK_KIND: BACK_KIND,
  /* IL NOME CANONICO. `deriveCarcass` resta come alias perche lo chiamano
     index.html, le prove golden e i progetti gia in giro — ma e LA STESSA
     funzione, non una seconda. Una seconda funzione di cote derivate sarebbe
     esattamente il guasto che questo file esiste per impedire. */
  computeCarcassGeometry: deriveCarcass,
  deriveCarcass: deriveCarcass,
  validateCarcassClosure: validateCarcassClosure,
  validateInvariants: validateInvariants,
  failedInvariants: failedInvariants,
  reconstructCarcass: reconstructCarcass,
  reconstructedBBox: reconstructedBBox,
  positionsHinges: positionsHinges,
  hingeCount: hingeCount,
  ASSERTIONS: ASSERTIONS,
  evalExpr: evalExpr,
  checkAssertions: checkAssertions,
  blocking: blocking,
  assertionsHash: assertionsHash,
  depthProfileStep: depthProfileStep,
  derivePartitions: derivePartitions,
  validateFronts: validateFronts,
  validateLayout: validateLayout,
  CUT_CORNERS: CUT_CORNERS,
  extractCotas: extractCotas,
  unconsumedCotas: unconsumedCotas
};
if (typeof module !== "undefined" && module.exports) module.exports = API;
for (var k in API) if (Object.prototype.hasOwnProperty.call(API, k)) root[k] = API[k];

})(typeof globalThis !== "undefined" ? globalThis : this);
