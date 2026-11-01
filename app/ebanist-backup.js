/* =====================================================================
   Ebanist — backup complet: ce intră în fișier și cum se pun cheile (D-111)
   ---------------------------------------------------------------------
   Parte pură, fără DOM, ca să se poată proba în node.

   1. build()  — pachetul `ebanist_backup`: proiecte, setări, STOC (resturile
      de plăci, `state.stock`, lipsea din fișier și din restaurare până la
      D-111) și pozele de releveu. Un fișier vechi, fără stoc, rămâne valid.

   2. seal()/open() — cheile (asistentul AI și codul Pro) intră în fișier
      NUMAI dacă omul bifează, și numai CRIPTATE cu o parolă aleasă de el:
      PBKDF2-SHA256 (600 000 de iterații) → AES-256-GCM. Fără parolă bună,
      blocul nu se poate citi, iar o modificare a lui e respinsă (GCM).
      Fișierul de backup se trimite uneori mai departe; o cheie Anthropic
      în clar ar costa bani, iar un cod `sub_…` ar activa Pro pe alt telefon.

   3. pickSecrets() — ce se salvează: cheia AI proprie și codul Pro de pe
      web (`sub_…`, `cs_…`, `comp_…`, cheie Lemon Squeezy). Licența Google
      Play NU se salvează: Play o restabilește singur din cont, iar un
      token de achiziție nu e un cod pe care să-l repui.

   4. Restaurarea pune cheile numai dacă LIPSESC: nu suprascrie ce are
      omul deja pe dispozitiv.
   ===================================================================== */
(function (global) {
  "use strict";

  var ITER = 600000;
  var SALT_BYTES = 16, IV_BYTES = 12;

  function subtle() {
    var c = global.crypto;
    if (!c || !c.subtle) throw new Error("no-webcrypto");
    return c.subtle;
  }
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
  function key(password, salt, iter) {
    var enc = new global.TextEncoder();
    return subtle().importKey("raw", enc.encode(String(password)), "PBKDF2", false, ["deriveKey"]).then(function (base) {
      return subtle().deriveKey({ name: "PBKDF2", salt: salt, iterations: iter, hash: "SHA-256" },
        base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    });
  }

  /* secrets: obiect simplu (JSON) → bloc {v,kdf,it,salt,iv,ct} */
  function seal(secrets, password) {
    var salt = global.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    var iv = global.crypto.getRandomValues(new Uint8Array(IV_BYTES));
    var plain = new global.TextEncoder().encode(JSON.stringify(secrets));
    return key(password, salt, ITER).then(function (k) {
      return subtle().encrypt({ name: "AES-GCM", iv: iv }, k, plain);
    }).then(function (ct) {
      return { v: 1, kdf: "PBKDF2-SHA256", it: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
    });
  }

  /* bloc + parolă → secrets; parolă greșită sau bloc modificat → Error("bad-password") */
  function open(block, password) {
    if (!block || block.v !== 1 || block.kdf !== "PBKDF2-SHA256") return Promise.reject(new Error("bad-block"));
    var it = Number(block.it);
    if (!(it >= 100000 && it <= 5000000)) return Promise.reject(new Error("bad-block"));
    var salt, iv, ct;
    try { salt = unb64(block.salt); iv = unb64(block.iv); ct = unb64(block.ct); }
    catch (e) { return Promise.reject(new Error("bad-block")); }
    return key(password, salt, it).then(function (k) {
      return subtle().decrypt({ name: "AES-GCM", iv: iv }, k, ct);
    }).then(function (plain) {
      return JSON.parse(new global.TextDecoder().decode(plain));
    }, function () { throw new Error("bad-password"); });
  }

  /* Ce merită salvat, din ce are omul acum. `lic` = licența din aplicație. */
  function pickSecrets(aiKey, lic) {
    var out = {};
    if (aiKey) out.aiKey = String(aiKey);
    if (lic && lic.kind !== "play" && lic.key) out.proCode = String(lic.key);
    return Object.keys(out).length ? out : null;
  }

  /* Pachetul fără chei; `secrets` (bloc criptat) se pune numai dacă există. */
  function build(o) {
    var pkg = {
      ebanist_backup: 1, ver: o.ver, date: o.date,
      state: { projects: o.projects, settings: o.settings, stock: Array.isArray(o.stock) ? o.stock : [] }
    };
    if (o.photos && Object.keys(o.photos).length) pkg.photos = o.photos;
    if (o.secrets) pkg.secrets = o.secrets;
    return pkg;
  }

  /* Stocul dintr-un fișier de restaurat: numai o listă validă îl înlocuiește.
     Un backup vechi (fără stoc) nu are voie să șteargă stocul de acum. */
  function stockFrom(pkg) {
    var s = pkg && pkg.state && pkg.state.stock;
    return Array.isArray(s) ? s : null;
  }

  global.EBBackup = { ITER: ITER, seal: seal, open: open, pickSecrets: pickSecrets, build: build, stockFrom: stockFrom };
})(typeof globalThis !== "undefined" ? globalThis : this);
