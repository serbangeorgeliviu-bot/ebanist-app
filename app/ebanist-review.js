/* =====================================================================
   Ebanist — cererea de recenzie în Google Play (D-105, condiții relaxate în D-128)
   ---------------------------------------------------------------------
   Numai pe Android, numai prin API-ul Play In-App Review (în aplicație
   nativă: MainActivity.Bridge.requestReview). Aici stă DECIZIA „e momentul
   să cerem?" — pură, fără DOM, ca să se poată proba în node.

   Regula, pe scurt: cerem după ce omul a reușit ceva, nu cât timp e
   blocat. Toate condițiile trebuie să fie adevărate deodată:

     • a trecut cel puțin o zi de la prima pornire (nu în prima sesiune);
     • cel puțin 2 sesiuni (a revenit, nu a trecut o dată);
     • cel puțin 1 „moment bun" de la ultima cerere (un corp generat,
       un document ieșit, o ofertă semnată);
     • cel puțin 45 de zile de la ultima cerere, cel mult 4 cereri în viață
       (Google oricum limitează singur cât de des arată dialogul);
     • în sesiunea asta n-a văzut ecranul Pro (nu cerem 5 stele cuiva pe
       care tocmai l-am oprit din lucru);
     • nu e nicio foaie deschisă și aplicația e în față.

   Nu filtrăm: nu întrebăm „îți place?" ca să trimitem la Play numai
   răspunsurile bune. Politica Play interzice asta.

   Google decide singur dacă arată dialogul (are o cotă) și aplicația nu
   află ce a făcut omul. De aceea contează „am cerut", nu „a votat".

   Starea stă într-o cheie proprie din localStorage, separată de proiecte.
   ===================================================================== */
(function (global) {
  "use strict";

  var KEY = "ebanist_review";
  var DAY = 864e5;
  var CFG = { minDays: 1, minSessions: 2, minGood: 1, gapDays: 45, maxAsks: 4, delayMs: 2500 };

  function num(v) { v = Number(v); return isFinite(v) && v >= 0 ? v : 0; }

  /* Orice zgomot din localStorage devine o stare validă. */
  function norm(s) {
    s = s && typeof s === "object" ? s : {};
    return { first: num(s.first), sessions: Math.floor(num(s.sessions)), good: Math.floor(num(s.good)),
             lastAsk: num(s.lastAsk), asks: Math.floor(num(s.asks)) };
  }

  /* O sesiune nouă. Prima pornire fixează începutul numărătorii. */
  function session(s, now) {
    s = norm(s);
    if (!s.first) s.first = now;
    s.sessions += 1;
    return s;
  }

  function good(s) {
    s = norm(s);
    s.good += 1;
    return s;
  }

  /* Cererea s-a făcut: se pornește de la zero, ca următoarea să ceară din
     nou trei momente bune, nu să le găsească deja strânse. */
  function asked(s, now) {
    s = norm(s);
    s.lastAsk = now; s.asks += 1; s.good = 0;
    return s;
  }

  /* ctx: { can: există puntea nativă, paywall: s-a văzut Pro în sesiune,
            busy: o foaie e deschisă, hidden: aplicația nu e în față } */
  function due(s, now, ctx) {
    s = norm(s); ctx = ctx || {};
    if (!ctx.can) return { ok: false, why: "no-bridge" };
    if (ctx.paywall) return { ok: false, why: "paywall" };
    if (ctx.busy || ctx.hidden) return { ok: false, why: "busy" };
    if (!s.first || now - s.first < CFG.minDays * DAY) return { ok: false, why: "young" };
    if (s.sessions < CFG.minSessions) return { ok: false, why: "sessions" };
    if (s.good < CFG.minGood) return { ok: false, why: "good" };
    if (s.asks >= CFG.maxAsks) return { ok: false, why: "max" };
    if (s.lastAsk && now - s.lastAsk < CFG.gapDays * DAY) return { ok: false, why: "gap" };
    return { ok: true, why: "" };
  }

  function load() {
    try { return norm(JSON.parse(global.localStorage.getItem(KEY) || "null")); } catch (e) { return norm(null); }
  }
  function save(s) {
    try { global.localStorage.setItem(KEY, JSON.stringify(norm(s))); } catch (e) {}
  }

  global.EBReview = { KEY: KEY, CFG: CFG, norm: norm, session: session, good: good, asked: asked, due: due, load: load, save: save };
})(typeof globalThis !== "undefined" ? globalThis : this);
