/* =====================================================================
   Ebanist — licenze
   ---------------------------------------------------------------------
   Due formati convivono, per sempre:

   1. CHIAVI STORICHE  `EBP-XXXX-XXXX-XXXX`
      Emesse a mano, verificate offline con un checksum FNV-1a. Chi le ha
      le tiene: non scadono, non chiedono rete, non passano da Lemon
      Squeezy. Il generatore sta in tools/genkey.py.

   2. CHIAVI LEMON SQUEEZY  (un UUID)
      Emesse dal negozio a ogni abbonamento. Si attivano una volta contro
      l'API pubblica delle licenze, poi si ricontrollano ogni 7 giorni
      quando c'e rete.

   Il formato si riconosce da solo — un UUID e un EBP- non si somigliano
   — quindi l'utente incolla e basta: non gli si chiede di sapere quale
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

  /* ---------- chiavi storiche: formato e checksum ---------- */

  /* 32 simboli, senza 0/1/I/O: una chiave si detta al telefono e si
     ricopia a mano da un'email, e "0 o O?" e il modo piu veloce di far
     scrivere un'assistenza. */
  var ALPHA = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  var SALT = "ebanist-pro-2026";

  function fnv1a32(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      /* moltiplicazione FNV a 32 bit senza overflow in virgola mobile:
         Math.imul e l'unico modo corretto in JavaScript. */
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  /* Le due cifre di controllo di un corpo di 10 simboli. */
  function legacyCheck(payload) {
    var h = fnv1a32(SALT + payload);
    return ALPHA.charAt((h >>> 5) & 31) + ALPHA.charAt(h & 31);
  }

  /* Maiuscole, senza spazi, e con i trattini al posto giusto anche se
     l'utente li ha persi nel copia-incolla. */
  function normalize(raw) {
    var s = String(raw || "").trim();
    if (/^[0-9a-fA-F-]{36}$/.test(s)) return s.toLowerCase();     // UUID: resta com'e
    s = s.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (s.indexOf("EBP") === 0) s = s.slice(3);
    if (s.length !== 12) return String(raw || "").trim().toUpperCase();
    return "EBP-" + s.slice(0, 4) + "-" + s.slice(4, 8) + "-" + s.slice(8, 12);
  }

  function isLegacyShape(key) {
    return /^EBP-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/.test(String(key || ""));
  }

  function legacyValid(key) {
    var k = normalize(key);
    if (!isLegacyShape(k)) return false;
    var body = k.slice(4).replace(/-/g, "");          // 12 simboli
    return legacyCheck(body.slice(0, 10)) === body.slice(10);
  }

  /* Un UUID v4 come lo emette Lemon Squeezy. */
  function isLsShape(key) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(String(key || "").toLowerCase());
  }

  function keyKind(key) {
    var k = normalize(key);
    if (isLegacyShape(k)) return "legacy";
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

    if (lic.kind === "legacy") {
      return lic.valid ? { pro: true, reason: "legacy" } : { pro: false, reason: "bad" };
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
    if (!lic || lic.kind !== "ls" || !lic.key) return false;
    return ((now || Date.now()) - (lic.checkedAt || 0)) > RECHECK_MS;
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
    ALPHA: ALPHA,
    SALT: SALT,
    GRACE_MS: GRACE_MS,
    RECHECK_MS: RECHECK_MS,
    fnv1a32: fnv1a32,
    legacyCheck: legacyCheck,
    normalize: normalize,
    isLegacyShape: isLegacyShape,
    isLsShape: isLsShape,
    legacyValid: legacyValid,
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
