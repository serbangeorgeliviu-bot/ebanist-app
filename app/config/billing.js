/* =====================================================================
   Ebanist — configurazione dell'incasso (Lemon Squeezy)
   ---------------------------------------------------------------------
   QUESTO FILE VA COMPILATO A MANO da Liviu, una volta sola, coi valori
   veri presi dal cruscotto Lemon Squeezy. Finche i segnaposto restano
   quelli qui sotto, l'app se ne accorge (`BILLING.configured` e false):
   il bottone «Sblocca Pro» non porta a una pagina rotta, dice che il
   negozio non e ancora aperto e propone l'attivazione manuale.

   I passi esatti stanno in MONETIZARE.md, sezione «Lemon Squeezy».

   Qui NON ci sono chiavi segrete e non ce ne devono finire mai. Le tre
   rotte di licenza (activate / validate / deactivate) sono pubbliche di
   progetto: vogliono solo `Accept: application/json` e un corpo
   form-urlencoded. La chiave API di Lemon Squeezy serve ad altro — a
   leggere ordini e clienti — e non ha niente da fare in un browser.
   ===================================================================== */
(function (global) {
  "use strict";

  var BILLING = {
    /* --- da compilare ------------------------------------------------ */

    /* Il sottodominio del negozio, quello che sta prima di
       .lemonsqueezy.com. Cruscotto → Settings → Stores. */
    LS_STORE: "REPLACE-ME-store",

    /* Gli UUID delle due varianti del prodotto «Ebanist Pro».
       Cruscotto → Products → Ebanist Pro → Variants → Share → il link
       finisce con /checkout/buy/<UUID>: e quello. */
    LS_VARIANT_MONTHLY: "REPLACE-ME-variant-uuid-monthly",
    LS_VARIANT_YEARLY: "REPLACE-ME-variant-uuid-yearly",

    /* Il variant id NUMERICO dell'abbonamento (Products → Variants, sta
       nell'URL della variante). Non serve al checkout: serve a
       riconoscere, in fase di attivazione, che la chiave incollata e di
       Ebanist Pro e non di un altro prodotto dello stesso negozio.
       Lasciato a null, il controllo non si fa. */
    LS_VARIANT_ID: null,

    /* --- prezzi mostrati --------------------------------------------- */
    /* Solo per il testo a schermo. Il prezzo che si paga e quello del
       checkout: questi due numeri devono COMBACIARE con Lemon Squeezy,
       e se un giorno divergono comanda Lemon Squeezy. */
    PRICE_MONTHLY: "9 €",
    PRICE_YEARLY: "79 €",

    /* --- costanti del protocollo (non toccare senza motivo) ---------- */
    LS_API: "https://api.lemonsqueezy.com/v1/licenses",

    /* Dove torna il cliente dopo il pagamento. Va incollato uguale nel
       cruscotto: Products → Ebanist Pro → Redirect after purchase.
       Il `?activate=1` e quello che fa aprire da solo il modulo con la
       chiave, invece di scaricare l'utente sulla home senza istruzioni. */
    RETURN_URL: "https://ebanist.com/app/?activate=1"
  };

  /* Un segnaposto non compilato non deve diventare un link a un negozio
     che non esiste: si controlla il prefisso, non la lunghezza. */
  function isPlaceholder(v) {
    return !v || String(v).indexOf("REPLACE-ME") === 0;
  }
  BILLING.configured = !isPlaceholder(BILLING.LS_STORE) &&
    !isPlaceholder(BILLING.LS_VARIANT_MONTHLY) &&
    !isPlaceholder(BILLING.LS_VARIANT_YEARLY);

  /* L'indirizzo del checkout, costruito qui e in nessun altro posto.
     `PRO_BUY_URL` di prima era una costante scritta a mano: adesso e
     questa funzione, e chi la chiama non sa niente di Lemon Squeezy.

     `checkout[custom][app]=ebanist` viaggia fino al webhook e all'ordine:
     e cosi che, il giorno che sullo stesso negozio ci sara anche
     Plaquist, si sapra da quale app e arrivato l'acquisto.  */
  BILLING.buyUrl = function (plan, email) {
    if (!BILLING.configured) return "";
    var v = plan === "yearly" ? BILLING.LS_VARIANT_YEARLY : BILLING.LS_VARIANT_MONTHLY;
    var u = "https://" + BILLING.LS_STORE + ".lemonsqueezy.com/checkout/buy/" + v;
    var q = ["checkout[custom][app]=ebanist"];
    if (email) q.push("checkout[email]=" + encodeURIComponent(email));
    /* Il carrello con un prodotto solo non ha bisogno di essere sfogliato:
       si va dritti al pagamento. */
    q.push("embed=0");
    return u + "?" + q.join("&");
  };

  global.BILLING = BILLING;
})(typeof window !== "undefined" ? window : this);
