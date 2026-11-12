/* =====================================================================
   Ebanist — pâlnia de conversie (D-nn)
   ---------------------------------------------------------------------
   Șase evenimente anonime, ca să știm unde se pierde omul între
   „a deschis aplicația" și „a plătit":

     open      aplicația s-a deschis (o dată pe încărcare)
     pw_shown  s-a arătat ecranul Pro        { why }
     pw_buy    a apăsat „cumpără"            { why, plan }
     pro_on    plata a trecut, Pro e activ   { why, plan, kind }
     rv_ask    am cerut recenzia în Google Play
     pw_unavail  ecranul Pro n-a avut ce vinde: Google Play n-a dat planuri { code }
               (D-129: 0 apăsări pe „cumpără" putea însemna și „nu se poate cumpăra")

   Ce NU pleacă niciodată: IP, user agent, id de dispozitiv, e-mail,
   cheia de licență, numele proiectului, nicio cifră din proiect. Singurul
   lucru care leagă două evenimente e un id aleator de 8 caractere,
   născut la deschidere și mort la închidere — nu se scrie nicăieri.

   Lista de valori e închisă (vezi netlify/functions/_funnel.js, care o
   oglindește; testul funnel.test.js le ține identice): o valoare din
   afara listei nu pleacă, iar serverul o respinge oricum.

   Nu trimite din atelier (clientul unui atelier nu e treaba noastră) și
   nu trimite din browsere automate (testele).
   ===================================================================== */
(function (global) {
  "use strict";

  var EVENTS = ["open", "pw_shown", "pw_buy", "pro_on", "rv_ask", "pw_unavail"];
  var WHY = ["projects", "pdf", "lab", "jpg", "doc", "offer", "client", "part", "nest", "export", "room", "plain"];
  var PLAT = ["play", "web"];
  var PLAN = ["monthly", "yearly", "founders"];
  var KIND = ["play", "stripe"];
  var CODE = ["unavailable", "error", "empty"];   // pw_unavail: Play indisponibil / eroare / răspuns fără planuri
  var LAST_KEY = "ebanist_pw_last";
  var LAST_TTL = 864e5;               // 24 h: de la „cumpără" până la întoarcerea din checkout

  function pick(list, v) { return list.indexOf(v) >= 0 ? v : undefined; }

  function platform() {
    try {
      var a = global.EbanistAndroid;
      return a && a.billingAvailable && a.billingAvailable() === "1" ? "play" : "web";
    } catch (e) { return "web"; }
  }

  /* Curăță un eveniment la forma lui scrisă; null dacă nu e al nostru.
     `why` lipsă pe un ecran Pro fără motiv devine „plain". */
  function clean(name, extra) {
    if (EVENTS.indexOf(name) < 0) return null;
    var x = extra || {};
    var rec = { e: name, plat: pick(PLAT, x.plat) || "web" };
    if (name === "pw_shown" || name === "pw_buy" || name === "pro_on") rec.why = pick(WHY, x.why) || "plain";
    if (name === "pw_buy" || name === "pro_on") { var p = pick(PLAN, x.plan); if (p) rec.plan = p; }
    if (name === "pro_on") { var k = pick(KIND, x.kind); if (k) rec.kind = k; }
    if (name === "pw_unavail") rec.code = pick(CODE, x.code) || "empty";
    return rec;
  }

  var SID = null;
  function sid() {
    if (!SID) {
      try { SID = Math.random().toString(36).slice(2, 10) || "x"; } catch (e) { SID = "x"; }
    }
    return SID;
  }

  /* Ultimul „cumpără": pe web plata se face în altă filă și aplicația se
     redeschide la întoarcere, deci motivul și planul trebuie ținute minte
     între cele două încărcări. */
  function remember(rec) {
    try { global.localStorage.setItem(LAST_KEY, JSON.stringify({ why: rec.why, plan: rec.plan, t: Date.now() })); } catch (e) {}
  }
  function recall() {
    try {
      var o = JSON.parse(global.localStorage.getItem(LAST_KEY) || "null");
      if (o && Date.now() - (o.t || 0) < LAST_TTL) return o;
    } catch (e) {}
    return null;
  }

  function off() {
    try {
      if (global.__ebFunnelOff) return true;
      if (global.navigator && global.navigator.webdriver) return true;
      if (global.OrderRail && global.OrderRail.active && global.OrderRail.active()) return true;
    } catch (e) {}
    return false;
  }

  function send(name, extra) {
    if (off()) return false;
    var x = Object.assign({ plat: platform() }, extra || {});
    if (name === "pro_on" && !(x.why && x.plan)) {
      var last = recall();
      if (last) { x.why = x.why || last.why; x.plan = x.plan || last.plan; }
    }
    var rec = clean(name, x);
    if (!rec) return false;
    if (name === "pw_buy") remember(rec);
    rec.s = sid();
    try {
      var body = JSON.stringify(rec);
      if (global.navigator && global.navigator.sendBeacon) {
        global.navigator.sendBeacon("/api/funnel", new global.Blob([body], { type: "application/json" }));
      } else if (global.fetch) {
        global.fetch("/api/funnel", { method: "POST", headers: { "Content-Type": "application/json" }, body: body, keepalive: true }).catch(function () {});
      }
      return true;
    } catch (e) { return false; }
  }

  global.EBFunnel = { EVENTS: EVENTS, WHY: WHY, PLAT: PLAT, PLAN: PLAN, KIND: KIND, CODE: CODE, clean: clean, send: send };
})(typeof globalThis !== "undefined" ? globalThis : this);
