/* =====================================================================
   Ebanist — licenze
   ---------------------------------------------------------------------
   Tre formati, due server:

   0. CHIAVI STORICHE  `EBP-XXXX-XXXX-XXXX`  — RITIRATE (D-81)
      Erano verificate offline con un checksum FNV-1a e un sale scritto nel
      client: chiunque poteva fabbricarne una. Nessuna e mai stata venduta,
      quindi non si accettano piu: `keyKind` le legge come sconosciute e
      una licenza `kind:"legacy"` gia in memoria non da Pro.

   2. CHIAVI LEMON SQUEEZY  (un UUID)
      Emesse dal negozio a ogni abbonamento. Si attivano una volta contro
      l'API pubblica delle licenze, poi si ricontrollano ogni 7 giorni
      quando c'e rete.

   3. ABBONAMENTI STRIPE  `sub_…`  (D-58, sul web)
      Il pagamento passa da Stripe Managed Payments; al ritorno l'app
      manda l'id della sessione a /api/pro (funzione Netlify, che tiene la
      chiave segreta) e riceve l'abbonamento. L'id `sub_…` e il codice che
      l'utente copia su un altro dispositivo. Ricontrollo ogni 7 giorni e
      subito dopo la data di rinnovo.

   Il formato si riconosce da solo — un UUID e un sub_ non si somigliano —
   quindi l'utente incolla e basta: non gli si chiede di sapere quale
   dei due ha in mano.

   OFFLINE E LA CONDIZIONE NORMALE, non l'eccezione. In un cantiere sotto
   una soletta non c'e campo, e un falegname che ha pagato deve poter
   stampare la distinta. Quindi: la rete non e mai una condizione per
   restare Pro. Si perde il Pro solo quando il server, RAGGIUNTO, dice
   che l'abbonamento e finito — e comunque dopo 14 giorni di tolleranza
   oltre la scadenza. I progetti non si cancellano mai, in nessun caso.

   Nessuna chiave segreta qui dentro: le tre rotte sono pubbliche.
   ===================================================================== */
(function (global) {
  "use strict";

  var API = "https://api.lemonsqueezy.com/v1/licenses";

  /* Maiuscole, senza spazi, e con i trattini al posto giusto anche se
     l'utente li ha persi nel copia-incolla. */
  function normalize(raw) {
    var s = String(raw || "").trim();
    if (/^sub_[A-Za-z0-9]+$/.test(s)) return s;                    // Stripe: maiuscole e minuscole contano
    if (/^cs_(live|test)_[A-Za-z0-9]+$/.test(s)) return s;         // Founders: la sessione di pagamento
    if (/^comp_[A-Za-z0-9]+$/.test(s)) return s;                   // Pro gratuito (D-63): maiuscole e minuscole contano
    if (/^[0-9a-fA-F-]{36}$/.test(s)) return s.toLowerCase();     // UUID: resta com'e
    return s.toUpperCase();
  }

  /* Un UUID v4 come lo emette Lemon Squeezy. */
  function isLsShape(key) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(String(key || "").toLowerCase());
  }

  /* I codici che verifica /api/pro: l'id di un abbonamento Stripe, la
     sessione di checkout (Founders, pagamento unico) oppure un codice Pro
     gratuito (D-63), che il server cerca in PRO_COMP_CODES. */
  function isStripeShape(key) {
    var k = String(key || "");
    return /^sub_[A-Za-z0-9]{8,64}$/.test(k) || /^cs_(live|test)_[A-Za-z0-9]{10,200}$/.test(k) ||
      /^comp_[A-Za-z0-9]{24,64}$/.test(k);
  }

  function keyKind(key) {
    var k = normalize(key);
    if (isStripeShape(k)) return "stripe";
    if (isLsShape(k)) return "ls";
    return "unknown";
  }

  /* ---------- lo stato Pro, calcolato da una licenza in cache ---------- */

  var GRACE_MS = 14 * 864e5;        // tolleranza oltre la scadenza
  var RECHECK_MS = 7 * 864e5;       // ogni quanto si ricontrolla, se c'e rete

  /* Uno stato solo, comprensibile senza contesto: `pro` decide, `reason`
     scrive il messaggio. Le due cose non si ricalcolano altrove. */
  function proFrom(lic, now) {
    now = now || Date.now();
    if (!lic || !lic.key) return { pro: false, reason: "none" };

    /* D-81: le chiavi EBP- sono ritirate. Una licenza `legacy` rimasta nella
       memoria di un dispositivo non apre il Pro. */
    if (lic.kind === "legacy") return { pro: false, reason: "bad" };

    /* Abonamentul Google Play (aplicația Android): valabilitatea o decide
       Play la fiecare pornire — aplicația șterge licența când Play spune
       că nu mai e activ. Aici nu se ghicește nimic din date. */
    if (lic.kind === "play") {
      return lic.status === "active" ? { pro: true, reason: "play" } : { pro: false, reason: "none" };
    }

    /* Stripe: /api/pro riduce gli stati a tre. «inactive» qui vuol dire
       un pagamento mai andato a buon fine (incomplete, paused): niente Pro.
       «expired» e la scadenza passano per le regole comuni qui sotto. */
    if (lic.kind === "stripe" && lic.status === "inactive") {
      return { pro: false, reason: "not-activated" };
    }

    /* «expired» e «disabled» sono le due sole risposte del server che
       chiudono la porta: la prima e un abbonamento finito, la seconda una
       chiave revocata (rimborso, frode). Tutto il resto — «inactive»
       compreso, che vuol dire solo "nessun dispositivo attivo" — non e
       un motivo per togliere il Pro a chi sta lavorando. */
    if (lic.status === "expired" || lic.status === "disabled") {
      return { pro: false, reason: lic.status };
    }
    if (!lic.activated) return { pro: false, reason: "not-activated" };

    var exp = lic.expiresAt ? Date.parse(lic.expiresAt) : 0;
    if (exp && isFinite(exp)) {
      if (now > exp + GRACE_MS) return { pro: false, reason: "lapsed" };
      if (now > exp) return { pro: true, reason: "grace" };
    }
    return { pro: true, reason: "ok" };
  }

  function needsRecheck(lic, now) {
    if (!lic || (lic.kind !== "ls" && lic.kind !== "stripe") || !lic.key) return false;
    now = now || Date.now();
    var since = now - (lic.checkedAt || 0);
    if (since > RECHECK_MS) return true;
    /* Passata la data di rinnovo, un abbonamento Stripe si ricontrolla
       subito (al massimo una volta al giorno): il rinnovo sposta la data,
       e senza chiedere si scivolerebbe inutilmente nella tolleranza. */
    if (lic.kind === "stripe" && lic.expiresAt) {
      var exp = Date.parse(lic.expiresAt);
      if (isFinite(exp) && now > exp && since > 864e5) return true;
    }
    return false;
  }

  /* Quanti giorni restano prima che il Pro cada davvero. Serve a
     scrivere «rinnova entro N giorni» invece di «errore». */
  function graceDaysLeft(lic, now) {
    if (!lic || !lic.expiresAt) return null;
    var exp = Date.parse(lic.expiresAt);
    if (!isFinite(exp)) return null;
    return Math.ceil((exp + GRACE_MS - (now || Date.now())) / 864e5);
  }

  /* ---------- l'API pubblica di Lemon Squeezy ---------- */

  function form(obj) {
    var out = [];
    for (var k in obj) if (obj[k] != null) out.push(encodeURIComponent(k) + "=" + encodeURIComponent(obj[k]));
    return out.join("&");
  }

  /* Un solo posto dove si parla col server, con un tetto di tempo: senza
     timeout, su una rete mobile che accetta la connessione e poi tace,
     l'attivazione resta a girare e l'utente crede che l'app sia morta. */
  function post(path, body) {
    var ctl = null, timer = null;
    try { ctl = new AbortController(); } catch (e) {}
    var opt = {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: form(body)
    };
    if (ctl) { opt.signal = ctl.signal; timer = setTimeout(function () { try { ctl.abort(); } catch (e) {} }, 15000); }
    return fetch(API + path, opt).then(function (r) {
      if (timer) clearTimeout(timer);
      /* Il server risponde 400 con un corpo JSON sensato («chiave non
         trovata», «limite di attivazioni raggiunto»): quel messaggio e
         piu utile di uno "HTTP 400" e va letto, non buttato. */
      return r.json().then(function (j) { return j; }, function () {
        throw new Error("http-" + r.status);
      });
    }, function (e) {
      if (timer) clearTimeout(timer);
      throw e;
    });
  }

  function activate(key, instanceName) {
    return post("/activate", { license_key: key, instance_name: instanceName });
  }
  function validate(key, instanceId) {
    return post("/validate", { license_key: key, instance_id: instanceId || null });
  }
  function deactivate(key, instanceId) {
    return post("/deactivate", { license_key: key, instance_id: instanceId });
  }

  /* ---------- Stripe, tramite la nostra funzione /api/pro ----------
     La chiave segreta non esce mai dal server: qui si manda solo l'id
     della sessione di pagamento o dell'abbonamento. */
  var PRO_API = "/api/pro";

  function stripeCheck(body) {
    var ctl = null, timer = null;
    try { ctl = new AbortController(); } catch (e) {}
    var opt = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
    if (ctl) { opt.signal = ctl.signal; timer = setTimeout(function () { try { ctl.abort(); } catch (e) {} }, 15000); }
    return fetch(PRO_API, opt).then(function (r) {
      if (timer) clearTimeout(timer);
      /* 4xx = Stripe ha risposto «no» (sessione non pagata, abbonamento
         inesistente, altro prodotto): la risposta va letta. 5xx = non si
         e potuto chiedere: per chi chiama e come essere offline. */
      if (r.status >= 500) throw new Error("http-" + r.status);
      return r.json().then(function (j) { return j || {}; }, function () { throw new Error("http-" + r.status); });
    }, function (e) {
      if (timer) clearTimeout(timer);
      throw e;
    });
  }
  function stripeFromSession(sessionId) { return stripeCheck({ session: sessionId }); }
  function stripeValidate(code) {
    return /^cs_/.test(String(code || "")) ? stripeCheck({ session: code }) : stripeCheck({ sub: code });
  }

  function shapeFromStripe(j, prev) {
    return {
      kind: "stripe",
      key: j.sub || (prev && prev.key) || "",
      status: j.status || (prev && prev.status) || "",
      expiresAt: j.periodEnd != null ? j.periodEnd : (prev ? prev.expiresAt : null),
      plan: j.plan || (prev && prev.plan) || "",
      email: j.email || (prev && prev.email) || "",
      activated: true,
      checkedAt: Date.now()
    };
  }

  /* La risposta del server, ridotta a quello che ci serve conservare.
     Vale per activate e per validate: hanno la stessa forma, cambia solo
     il nome del booleano in cima. */
  function shapeFromResponse(j, prev) {
    var lk = (j && j.license_key) || {};
    var inst = (j && j.instance) || null;
    var meta = (j && j.meta) || {};
    return {
      kind: "ls",
      key: lk.key || (prev && prev.key) || "",
      status: lk.status || (prev && prev.status) || "",
      expiresAt: lk.expires_at != null ? lk.expires_at : (prev ? prev.expiresAt : null),
      activationLimit: lk.activation_limit != null ? lk.activation_limit : (prev ? prev.activationLimit : null),
      instanceId: (inst && inst.id) || (prev && prev.instanceId) || "",
      instanceName: (inst && inst.name) || (prev && prev.instanceName) || "",
      email: meta.customer_email || (prev && prev.email) || "",
      variantId: meta.variant_id != null ? meta.variant_id : (prev ? prev.variantId : null),
      productName: meta.product_name || (prev && prev.productName) || "",
      activated: true,
      checkedAt: Date.now()
    };
  }

  global.EBLicense = {
    GRACE_MS: GRACE_MS,
    RECHECK_MS: RECHECK_MS,
    normalize: normalize,
    isLsShape: isLsShape,
    isStripeShape: isStripeShape,
    stripeFromSession: stripeFromSession,
    stripeValidate: stripeValidate,
    shapeFromStripe: shapeFromStripe,
    keyKind: keyKind,
    proFrom: proFrom,
    needsRecheck: needsRecheck,
    graceDaysLeft: graceDaysLeft,
    activate: activate,
    validate: validate,
    deactivate: deactivate,
    shapeFromResponse: shapeFromResponse
  };

  /* La rete di regressione gira in node e importa questo file
     direttamente: le parti pure (checksum, forma, decisione Pro) si
     provano senza browser e senza toccare Lemon Squeezy. */
  if (typeof module !== "undefined" && module.exports) module.exports = global.EBLicense;
})(typeof window !== "undefined" ? window : globalThis);
