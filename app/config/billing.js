/* =====================================================================
   Ebanist — configurarea încasării pe web (Stripe Managed Payments, D-58)
   ---------------------------------------------------------------------
   Plata pe web trece prin linkurile de plată Stripe, create în
   cruscotto cu „Enable Managed Payments” bifat: Stripe e merchant of
   record (facturează clientul, colectează TVA-ul). Contul e pe Domus
   Renov SRL.

   Aici stau doar cele două linkuri PUBLICE (buy.stripe.com/…). Nicio
   cheie: cea secretă stă numai în Netlify (STRIPE_SECRET_KEY) și o
   folosește doar funcția /api/pro, care verifică plata.

   Fiecare link are în cruscotto, la „After payment”, redirectul:
     https://ebanist.com/app/?stripe=1&session_id={CHECKOUT_SESSION_ID}
   iar prețul lui are lookup key `ebanist_pro_monthly` / `ebanist_pro_yearly`
   — după ea recunoaște /api/pro că plata e pentru Ebanist Pro.

   În aplicația Android nimic de aici nu apare: acolo plata e numai prin
   Google Play (D-54).
   ===================================================================== */
(function (global) {
  "use strict";

  var BILLING = {
    /* Linkurile de plată. Un link lipsă (null) = butonul lui nu apare. */
    LINK_MONTHLY: "https://buy.stripe.com/9B6bJ1a426IbcZM9hAeQM00",
    LINK_YEARLY: null,

    /* --- prețuri afișate ---------------------------------------------- */
    /* Numai pentru textul de pe ecran. Prețul plătit e cel din Stripe
       (cu TVA inclus): cele două trebuie să COINCIDĂ, iar dacă diferă
       comandă Stripe. */
    PRICE_MONTHLY: "9 €",
    PRICE_YEARLY: "79 €"
  };

  function isLink(v) {
    return typeof v === "string" && /^https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+$/.test(v);
  }
  BILLING.hasPlan = function (plan) {
    return isLink(plan === "yearly" ? BILLING.LINK_YEARLY : BILLING.LINK_MONTHLY);
  };
  BILLING.configured = BILLING.hasPlan("monthly") || BILLING.hasPlan("yearly");

  /* Adresa de plată, construită aici și nicăieri altundeva: cine o
     cheamă nu știe nimic de Stripe. Emailul, când îl știm, se
     precompletează — un câmp mai puțin de scris cu telefonul în mână. */
  BILLING.buyUrl = function (plan, email) {
    if (!BILLING.hasPlan(plan)) return "";
    var u = plan === "yearly" ? BILLING.LINK_YEARLY : BILLING.LINK_MONTHLY;
    return email ? u + "?prefilled_email=" + encodeURIComponent(email) : u;
  };

  global.BILLING = BILLING;
})(typeof window !== "undefined" ? window : this);
