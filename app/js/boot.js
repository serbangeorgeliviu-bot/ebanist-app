"use strict";
/* ===========================================================================
   Ebanist — app/js/boot.js

   Le due decisioni che vanno prese PRIMA della prima pennellata, quando
   ancora non c'e' ne' stato ne' interfaccia:

     1. il tema — se aspettasse il caricamento dello stato, l'app
        lampeggerebbe in bianco a ogni avvio al buio;
     2. l'intro — chi l'ha spenta, o chi ha chiesto meno movimento al
        sistema, non deve vederne nemmeno un fotogramma.

   Per questo e' un file a se', sincrono, in testa al documento: nessun
   altro script dell'app e' ancora partito. E' anche il motivo per cui NON
   e' un blocco inline — con gli script tutti fuori dall'HTML, la regola
   `script-src` della CSP resta 'self' e basta, senza 'unsafe-inline' e
   senza impronte da tenere allineate a mano.

   La chiave del tema e' dedicata e non sincronizzata: il telefono in
   cantiere e il PC in ufficio vogliono temi diversi, quindi non entra in
   `user_settings`.
   =========================================================================== */
(function () {
  var root = document.documentElement;

  try {
    var t = localStorage.getItem("ebanist_theme");
    if (t === "dark" || t === "light") root.setAttribute("data-theme", t);
  } catch (e) { /* localStorage negato: resta il tema automatico */ }

  /* L'intro si spegne per scelta esplicita o per richiesta di sistema.
     Qui si puo' solo MARCARE: #splash non e' ancora stato letto dal
     parser, quindi non lo si puo' togliere. Il segno lo raccolgono due
     lettori: il CSS, che lo nasconde prima che si veda; e initSplash(),
     che lo toglie davvero dal documento — senza quello partirebbe anche
     il suono su un pannello invisibile. */
  try {
    var st = JSON.parse(localStorage.getItem("tagliapro") || "{}");
    var s = (st && st.settings) || {};
    var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (s.intro === 0 || reduced) root.setAttribute("data-intro", "off");
  } catch (e) { /* stato illeggibile: l'intro parte, e' il caso normale */ }
})();
