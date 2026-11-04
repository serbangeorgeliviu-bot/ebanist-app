/* =====================================================================
   Ebanist — deblocare biometrică a contului, pe web (D-113)
   ---------------------------------------------------------------------
   Parte pură, fără DOM: dependențele (crypto, credentials, storage) se dau
   din afară, ca să se poată proba în node.

   Ce face: după o logare cu parolă, refresh token-ul sesiunii Supabase se
   păstrează pe dispozitiv numai CRIPTAT. Se deschide numai cu amprenta /
   Face ID / Windows Hello, prin WebAuthn cu extensia PRF: autentificatorul
   dă un secret stabil, DOAR după verificarea utilizatorului.

   De ce nu un simplu AES cu secretul PRF: Supabase rotește refresh token-ul
   (aproximativ o dată pe oră, în fundal, fără omul de față). Un token criptat
   o singură dată ar fi vechi după prima rotație, iar a-l re-cripta ar cere
   o nouă amprentă. De aceea schema e asimetrică (ECIES):
     - cheie publică ECDH P-256, în clar → re-criptarea e tăcută, fără amprentă;
     - cheia privată, învelită cu AES-GCM sub secretul PRF → citirea cere amprentă.

   Fără PRF pe dispozitiv → enroll() refuză (`no-prf`). O poartă numai în
   interfață nu protejează pe cineva cu acces la localStorage: nu o oferim.
   Nimic din ce stă aici nu intră în backup (D-111): e legat de dispozitiv.
   ===================================================================== */
(function (global) {
  "use strict";

  var KEY = "ebanist_bio_v1";
  var PRF_LABEL = "ebanist-bio-prf-v1";
  var AAD = "ebanist-bio-v1";

  function subtle(env) {
    var c = env.crypto;
    if (!c || !c.subtle) throw new Error("no-webcrypto");
    return c.subtle;
  }
  function enc(s) { return new global.TextEncoder().encode(String(s)); }
  function b64(buf) {
    var a = new Uint8Array(buf), s = "";
    for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
    return global.btoa(s);
  }
  function unb64(s) {
    var bin = global.atob(String(s)), a = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }
  function rnd(env, n) { return env.crypto.getRandomValues(new Uint8Array(n)); }

  /* ---- înregistrarea locală ---- */
  function load(env) {
    try {
      var r = JSON.parse(env.storage.getItem(KEY));
      return r && r.v === 1 && r.cid && r.pub && r.wpriv ? r : null;
    } catch (e) { return null; }
  }
  function save(env, rec) { env.storage.setItem(KEY, JSON.stringify(rec)); }
  function has(env) { return !!load(env); }
  function clear(env) { try { env.storage.removeItem(KEY); } catch (e) { /* nimic */ } }

  /* ---- HKDF: secret (bytes) → cheie AES-GCM ---- */
  function hkdfKey(env, secret, info, usages) {
    return subtle(env).importKey("raw", secret, "HKDF", false, ["deriveKey"]).then(function (base) {
      return subtle(env).deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: enc(info) },
        base, { name: "AES-GCM", length: 256 }, false, usages);
    });
  }

  /* ---- WebAuthn: secretul PRF (cere amprenta) ---- */
  function prfSecret(env, credId) {
    var opts = {
      publicKey: {
        challenge: rnd(env, 32),
        rpId: env.rpId,
        allowCredentials: [{ type: "public-key", id: credId }],
        userVerification: "required",
        timeout: 60000,
        extensions: { prf: { eval: { first: enc(PRF_LABEL) } } }
      }
    };
    return env.credentials.get(opts).then(function (a) {
      if (!a) throw new Error("cancelled");
      var ext = a.getClientExtensionResults ? a.getClientExtensionResults() : {};
      var first = ext && ext.prf && ext.prf.results && ext.prf.results.first;
      if (!first) throw new Error("no-prf");
      return new Uint8Array(first.buffer ? first.buffer.slice(first.byteOffset, first.byteOffset + first.byteLength) : first);
    });
  }

  /* ---- ECIES: criptare tăcută cu cheia publică ---- */
  function sealToken(env, pubB64, token) {
    var s = subtle(env);
    return s.importKey("raw", unb64(pubB64), { name: "ECDH", namedCurve: "P-256" }, false, []).then(function (pub) {
      return s.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]).then(function (eph) {
        return s.deriveBits({ name: "ECDH", public: pub }, eph.privateKey, 256).then(function (bits) {
          return hkdfKey(env, bits, "ebanist-bio-ecies-v1", ["encrypt"]).then(function (k) {
            var iv = rnd(env, 12);
            return s.encrypt({ name: "AES-GCM", iv: iv, additionalData: enc(AAD) }, k, enc(token)).then(function (ct) {
              return s.exportKey("raw", eph.publicKey).then(function (epk) {
                return { epk: b64(epk), iv: b64(iv), ct: b64(ct) };
              });
            });
          });
        });
      });
    });
  }

  /* Disponibil? Doar dacă există un autentificator de platformă. PRF se vede abia la enroll(). */
  function available(env) {
    var P = env.PublicKeyCredential;
    if (!P || !env.credentials || !P.isUserVerifyingPlatformAuthenticatorAvailable) return Promise.resolve(false);
    return P.isUserVerifyingPlatformAuthenticatorAvailable().then(function (ok) { return !!ok; }, function () { return false; });
  }

  /* Activare: o singură dată, după o logare reușită. Cere amprenta de două ori
     (creare + citirea secretului PRF), pentru că multe dispozitive nu dau PRF la creare. */
  function enroll(env, who) {
    var s = subtle(env);
    if (!who || !who.refreshToken) return Promise.reject(new Error("no-session"));
    var name = who.email || "Ebanist";
    return env.credentials.create({
      publicKey: {
        rp: { id: env.rpId, name: "Ebanist" },
        user: { id: rnd(env, 16), name: name, displayName: name },
        challenge: rnd(env, 32),
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
        timeout: 60000,
        extensions: { prf: {} }
      }
    }).then(function (cred) {
      if (!cred) throw new Error("cancelled");
      var ext = cred.getClientExtensionResults ? cred.getClientExtensionResults() : {};
      if (!ext || !ext.prf || ext.prf.enabled === false || (!ext.prf.enabled && !ext.prf.results)) throw new Error("no-prf");
      var credId = new Uint8Array(cred.rawId);
      return prfSecret(env, credId).then(function (secret) {
        return s.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]).then(function (pair) {
          return Promise.all([s.exportKey("raw", pair.publicKey), s.exportKey("pkcs8", pair.privateKey), hkdfKey(env, secret, "ebanist-bio-wrap-v1", ["encrypt"])]).then(function (r) {
            var wiv = rnd(env, 12);
            return s.encrypt({ name: "AES-GCM", iv: wiv, additionalData: enc(AAD) }, r[2], r[1]).then(function (wpriv) {
              var pub = b64(r[0]);
              return sealToken(env, pub, who.refreshToken).then(function (tok) {
                save(env, { v: 1, cid: b64(credId), pub: pub, wiv: b64(wiv), wpriv: b64(wpriv), tok: tok, email: who.email || "" });
                return true;
              });
            });
          });
        });
      });
    });
  }

  /* Re-criptare tăcută, la fiecare rotație a token-ului. Fără amprentă: folosește doar cheia publică. */
  function reseal(env, refreshToken) {
    var rec = load(env);
    if (!rec || !refreshToken) return Promise.resolve(false);
    return sealToken(env, rec.pub, refreshToken).then(function (tok) {
      rec.tok = tok; save(env, rec); return true;
    });
  }

  /* Deblocare: cere amprenta, întoarce refresh token-ul. */
  function unlock(env) {
    var rec = load(env), s;
    if (!rec) return Promise.reject(new Error("no-record"));
    s = subtle(env);
    return prfSecret(env, unb64(rec.cid)).then(function (secret) {
      return hkdfKey(env, secret, "ebanist-bio-wrap-v1", ["decrypt"]);
    }).then(function (wk) {
      return s.decrypt({ name: "AES-GCM", iv: unb64(rec.wiv), additionalData: enc(AAD) }, wk, unb64(rec.wpriv));
    }).then(function (pkcs8) {
      return Promise.all([
        s.importKey("pkcs8", pkcs8, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]),
        s.importKey("raw", unb64(rec.tok.epk), { name: "ECDH", namedCurve: "P-256" }, false, [])
      ]);
    }).then(function (keys) {
      return s.deriveBits({ name: "ECDH", public: keys[1] }, keys[0], 256);
    }).then(function (bits) {
      return hkdfKey(env, bits, "ebanist-bio-ecies-v1", ["decrypt"]);
    }).then(function (k) {
      return s.decrypt({ name: "AES-GCM", iv: unb64(rec.tok.iv), additionalData: enc(AAD) }, k, unb64(rec.tok.ct));
    }).then(function (pt) {
      return new global.TextDecoder().decode(pt);
    });
  }

  /* env-ul real, din browser */
  function browserEnv() {
    var w = global, n = w.navigator || {};
    return {
      crypto: w.crypto, credentials: n.credentials, PublicKeyCredential: w.PublicKeyCredential,
      storage: w.localStorage, rpId: (w.location && w.location.hostname) || ""
    };
  }

  global.EBBiometric = {
    KEY: KEY, available: available, has: has, clear: clear, enroll: enroll, reseal: reseal, unlock: unlock, browserEnv: browserEnv,
    email: function (env) { var r = load(env); return r ? r.email : ""; }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
