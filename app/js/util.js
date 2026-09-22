"use strict";
/* ===========================================================================
   Ebanist — app/js/util.js

   I mattoni piccoli, quelli che usa tutto il resto. Primo file della fila:
   quando parte il secondo, questi ci sono gia.

   Stavano sparsi per motivi storici — `esc` e `fmt` in mezzo alla licenza,
   `uid` in mezzo allo stato, `$` in mezzo al tema. Niente di rotto, ma per
   leggere come si scappa un nome bisognava aprire il file dei cancelli Pro.
   =========================================================================== */

/* ---- DOM ---- */
const $ = id => document.getElementById(id);

/* ---- testo ----
   L'apostrofo entra nella lista: oggi nessun attributo interpolato usa le
   virgolette semplici, ma il giorno che ne comparisse uno — `style='...'` —
   un nome di progetto con un apostrofo aprirebbe un buco senza che nessuno
   colleghi le due cose. Costa un carattere. */
const ESC_MAP = {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ESC_MAP[c]);

/* ---- numeri ----
   `fmt` segue la lingua dell'app, non quella del telefono: una distinta
   stampata in italiano deve avere le virgole dell'italiano anche se il
   telefono e in inglese. */
const LOCALE = { en: "en-GB", ro: "ro-RO", fr: "fr-FR", it: "it-IT" };
const fmt = (n, d = 2) => n.toLocaleString(LOCALE[state.lang] || LOCALE.it,
  { minimumFractionDigits: d, maximumFractionDigits: d });

/* Una cota si scrive intera quando e intera. 500, non 500,0; 499,5 quando
   e 499,5. Mezzo millimetro in piu sullo schermo non serve a nessuno, e
   uno zero decimale su ogni riga della distinta e solo rumore. */
function fmtMm(v) {
  const n = +v;
  return n === Math.round(n) ? String(n) : String(+n.toFixed(1));
}

/* ---- identita e date ---- */
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

/* La data di oggi in ISO corto, come la scrive un <input type="date">.
   Era ripetuta tredici volte, sempre nella stessa forma. */
const today = () => new Date().toISOString().slice(0, 10);

/* ---- quante volte, e quando ----
   Due freni, per due problemi diversi.

   `rafCoalesce` serve a chi disegna: un dito che trascina manda 60–120
   eventi al secondo, e lo schermo ne mostra 60. Disegnare a ogni evento
   vuol dire buttare via meta del lavoro e far scattare il trascinamento
   proprio sui telefoni che ne hanno di meno. Un disegno per fotogramma,
   con gli ultimi valori.

   `debounce` serve a chi scrive: `persist()` serializza tutto lo stato e
   lo mette in localStorage — una scrittura SINCRONA. Farla a ogni
   millimetro di trascinamento, con dodici commesse aperte, sono 130 KB
   riscritti cento volte al secondo. Si aspetta che il dito si fermi.
   `.flush()` la esegue subito: chi molla il dito non aspetta. */
function rafCoalesce(fn) {
  let queued = false, lastArgs = null, lastThis = null;
  return function () {
    lastThis = this; lastArgs = arguments;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; fn.apply(lastThis, lastArgs); });
  };
}

function debounce(fn, ms) {
  let timer = null;
  const run = function () {
    const self = this, args = arguments;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; fn.apply(self, args); }, ms);
  };
  /* Per le funzioni senza argomenti — `persist()` e' l'unica che passa
     di qui. Se un giorno ne serve una con argomenti, vanno ricordati. */
  run.flush = function () { if (timer) { clearTimeout(timer); timer = null; fn(); } };
  return run;
}
