/* =====================================================================
   Ebanist — asistentul de inginerie (consultativ, nu blochează nimic).

   Regulile sunt DATE (ca aserțiunile, D-38): o linie nouă = o regulă nouă.
   Evaluarea e pură: primește rândurile distinctei și grosimea fiecăruia,
   întoarce avertismente. Valorile (modul de elasticitate, sarcina, limita
   de săgeată) sunt ipoteze marcate `verificat:false` până la confirmarea cu
   furnizorul plăcii — avertismentul spune asta, nu pretinde certificare.
   ===================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EBAdvice = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* E în N/mm² pe familie de material; q în N/mm² (1 kPa = 0,001); limita = L / lim */
  var DATA = {
    verificat: false,
    E: { pal: 2800, mdf: 2600, multiplex: 5000, masiv: 9000, default: 2600 },
    shelf: { q: 0.0015, lim: 300 },      // ~150 kg/m²: cărți pe raft, deflexie maximă L/300
    worktop: { q: 0.0030, lim: 400, spanMm: 1000 }, // blat: 300 kg/m² punctual-echivalent, L/400
    door: { minHmm: 1800, maxSlender: 3.2 } // ușă înaltă și îngustă: tendință de curbare
  };

  function famOf(name) {
    var s = String(name || "").toLowerCase();
    if (/mdf|lacc|laccato|lacuit|vopsit/.test(s)) return "mdf";
    if (/multiplex|plywood|multistrat/.test(s)) return "multiplex";
    if (/masiv|massello|solid|stejar|nuc|oak|walnut/.test(s)) return "masiv";
    if (/pal|chip|truciolare|melamin|egger/.test(s)) return "pal";
    return "default";
  }

  /* săgeata unui raft simplu sprijinit, sarcină distribuită q pe aria L × adâncime:
     δ = 5 w L^4 / (384 E I), cu w = q · adâncime și I = adâncime · t³ / 12  =>  δ = 0,15625 · q · L⁴ / (E · t³) */
  function deflection(L, t, E, q) {
    if (!(L > 0 && t > 0 && E > 0 && q >= 0)) return null;
    return 0.15625 * q * Math.pow(L, 4) / (E * Math.pow(t, 3));
  }

  /* rule: { id, check(row, ctx) -> null | { values } } ; ctx = { th(row), mat(row), data } */
  var RULES = [
    { id: "SHELF_SAG", roles: ["ripiano"],
      check: function (r, c) {
        var t = c.th(r), L = r.lung; if (!(t > 0)) return null;
        var E = c.data.E[famOf(c.mat(r))] || c.data.E.default;
        var d = deflection(L, t, E, c.data.shelf.q); if (d == null) return null;
        if (d <= L / c.data.shelf.lim) return null;
        return { span: L, th: t, sag: Math.round(d * 10) / 10, ratio: Math.round(L / d) };
      } },
    { id: "WORKTOP_SPAN", roles: ["blat"],
      check: function (r, c) {
        var t = c.th(r), L = r.lung; if (!(t > 0) || L <= c.data.worktop.spanMm) return null;
        var E = c.data.E[famOf(c.mat(r))] || c.data.E.default;
        var d = deflection(L, t, E, c.data.worktop.q); if (d == null) return null;
        if (d <= L / c.data.worktop.lim) return null;
        return { span: L, th: t, sag: Math.round(d * 10) / 10, ratio: Math.round(L / d) };
      } },
    { id: "TALL_DOOR", roles: ["anta"],
      check: function (r, c) {
        var H = Math.max(r.lung, r.larg), W = Math.min(r.lung, r.larg);
        if (!(W > 0) || H < c.data.door.minHmm || H / W < c.data.door.maxSlender) return null;
        return { h: H, w: W, ratio: Math.round(H / W * 10) / 10 };
      } }
  ];

  /* rows: [{ elemento, role, lung, larg, pz, ... }]; opt: { th(row), mat(row), data }.
     Întoarce [{ id, role, elemento, modulo, values, n }] grupate pe (regulă, modul, element, valori). */
  function advise(rows, opt) {
    opt = opt || {};
    var c = { th: opt.th || function (r) { return +r.sp || 0; }, mat: opt.mat || function (r) { return r.materiale || r.mat || ""; }, data: opt.data || DATA };
    var out = [], idx = {};
    (rows || []).forEach(function (r) {
      var role = r.role || "";
      RULES.forEach(function (rule) {
        if (rule.roles.indexOf(role) < 0) return;
        var v = rule.check(r, c); if (!v) return;
        var key = [rule.id, r.modulo || "", r.elemento || "", JSON.stringify(v)].join("|");
        if (idx[key] != null) { out[idx[key]].n += (r.pz > 0 ? r.pz : 1); return; }
        idx[key] = out.length;
        out.push({ id: rule.id, role: role, modulo: r.modulo || "", elemento: r.elemento || "", values: v, n: r.pz > 0 ? r.pz : 1 });
      });
    });
    return out;
  }

  var TXT = {
    it: { title: "Consigli tecnici", note: "Indicazioni orientative con valori da verificare col fornitore della lastra: non sono una certificazione.",
      SHELF_SAG: "Ripiano di {span} mm in {th} mm: si flette circa {sag} mm sotto carico (1 : {ratio}). Aggiungi un montante o un rinforzo, oppure usa uno spessore maggiore.",
      WORKTOP_SPAN: "Piano di {span} mm in {th} mm: freccia stimata {sag} mm (1 : {ratio}). Prevedi un appoggio intermedio o un rinforzo sotto.",
      TALL_DOOR: "Anta {h}×{w} mm (rapporto {ratio}): alta e stretta, tende a imbarcarsi. Valuta il profilo anti-imbarcamento.", none: "Nessun avviso." },
    ro: { title: "Sfaturi tehnice", note: "Indicații orientative, cu valori de confirmat la furnizorul plăcii: nu sunt o certificare.",
      SHELF_SAG: "Raft de {span} mm în {th} mm: se îndoaie cam {sag} mm sub sarcină (1 : {ratio}). Adaugă un montant sau o întărire, ori folosește o grosime mai mare.",
      WORKTOP_SPAN: "Blat de {span} mm în {th} mm: săgeată estimată {sag} mm (1 : {ratio}). Prevede un reazem intermediar sau o întărire dedesubt.",
      TALL_DOOR: "Ușă {h}×{w} mm (raport {ratio}): înaltă și îngustă, tinde să se curbeze. Ia în calcul profilul anti-curbare.", none: "Niciun avertisment." },
    en: { title: "Technical advice", note: "Orientative guidance with values to be confirmed with the board supplier: not a certification.",
      SHELF_SAG: "Shelf {span} mm in {th} mm board: sags about {sag} mm under load (1 : {ratio}). Add an upright or a stiffener, or use a thicker board.",
      WORKTOP_SPAN: "Worktop {span} mm in {th} mm board: estimated deflection {sag} mm (1 : {ratio}). Plan an intermediate support or a stiffener underneath.",
      TALL_DOOR: "Door {h}×{w} mm (ratio {ratio}): tall and narrow, prone to warping. Consider the anti-warp profile.", none: "No warnings." },
    fr: { title: "Conseils techniques", note: "Indications à titre d'orientation, valeurs à confirmer auprès du fournisseur de panneaux : pas une certification.",
      SHELF_SAG: "Étagère de {span} mm en {th} mm : fléchit d'environ {sag} mm sous charge (1 : {ratio}). Ajoutez un montant ou un renfort, ou une épaisseur supérieure.",
      WORKTOP_SPAN: "Plan de {span} mm en {th} mm : flèche estimée {sag} mm (1 : {ratio}). Prévoyez un appui intermédiaire ou un renfort dessous.",
      TALL_DOOR: "Porte {h}×{w} mm (rapport {ratio}) : haute et étroite, risque de voilage. Envisagez le profil anti-voilage.", none: "Aucun avertissement." },
    de: { title: "Technische Hinweise", note: "Orientierungswerte, mit dem Plattenlieferanten zu bestätigen: keine Zertifizierung.",
      SHELF_SAG: "Regal {span} mm in {th} mm: biegt sich unter Last um ca. {sag} mm durch (1 : {ratio}). Mittelstütze oder Verstärkung ergänzen oder dickere Platte wählen.",
      WORKTOP_SPAN: "Arbeitsplatte {span} mm in {th} mm: geschätzte Durchbiegung {sag} mm (1 : {ratio}). Zwischenauflage oder Verstärkung darunter vorsehen.",
      TALL_DOOR: "Tür {h}×{w} mm (Verhältnis {ratio}): hoch und schmal, neigt zum Verziehen. Verzugsschutzprofil erwägen.", none: "Keine Hinweise." },
    pl: { title: "Wskazówki techniczne", note: "Wartości orientacyjne, do potwierdzenia u dostawcy płyt: to nie certyfikacja.",
      SHELF_SAG: "Półka {span} mm z płyty {th} mm: ugina się ok. {sag} mm pod obciążeniem (1 : {ratio}). Dodaj przegrodę lub wzmocnienie albo grubszą płytę.",
      WORKTOP_SPAN: "Blat {span} mm z płyty {th} mm: szacowane ugięcie {sag} mm (1 : {ratio}). Przewidź podporę pośrednią lub wzmocnienie od spodu.",
      TALL_DOOR: "Front {h}×{w} mm (stosunek {ratio}): wysoki i wąski, skłonny do paczenia. Rozważ profil przeciw paczeniu.", none: "Brak uwag." },
    es: { title: "Consejos técnicos", note: "Valores orientativos, a confirmar con el proveedor de tableros: no es una certificación.",
      SHELF_SAG: "Estante de {span} mm en {th} mm: se flexiona unos {sag} mm bajo carga (1 : {ratio}). Añade un montante o un refuerzo, o usa un grosor mayor.",
      WORKTOP_SPAN: "Encimera de {span} mm en {th} mm: flecha estimada {sag} mm (1 : {ratio}). Prevé un apoyo intermedio o un refuerzo debajo.",
      TALL_DOOR: "Puerta {h}×{w} mm (relación {ratio}): alta y estrecha, tiende a alabearse. Valora el perfil antialabeo.", none: "Sin avisos." }
  };
  function t(lang, key) { return (TXT[lang] && TXT[lang][key]) || TXT.it[key] || key; }
  function text(lang, a) {
    var s = t(lang, a.id), v = a.values || {};
    return s.replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? String(v[k]) : m; });
  }

  return { DATA: DATA, RULES: RULES, advise: advise, deflection: deflection, famOf: famOf, TXT: TXT, t: t, text: text };
});
