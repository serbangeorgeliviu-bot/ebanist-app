/* =====================================================================
   Ebanist — magazzino durevole (IndexedDB)
   ---------------------------------------------------------------------
   Perche esiste: localStorage sta stretto e si perde. Stretto perche il
   tetto e 5 MB per origine e qui dentro ci finiscono i progetti, il logo
   aziendale in base64 e i rilievi — la barra rossa "memoria piena" non e
   teorica, e gia nel codice. Si perde perche e la prima cosa che un
   browser butta via quando fa pulizia.

   Cosa NON risolve, e va detto chiaro: su iOS il tetto dei 7 giorni di
   inattivita colpisce TUTTA la memoria scrivibile da script — IndexedDB
   compreso, non solo localStorage. Le uniche difese vere sono l'app
   aggiunta alla schermata Home (esentata) e il backup. Questo file da
   spazio e ordine, e insieme all'invito «Aggiungi a Home» e all'export
   automatico fa il resto del lavoro.

   Nessuna dipendenza, script classico: deve partire sui telefoni vecchi
   dell'officina prima di qualsiasi modulo.

   Chiavi in `kv`:
     state    — { savedAt, state }        lo stato dell'app
     license  — { ... }                   la licenza (vedi ebanist-license.js)
     meta     — { migrated, lastManualBk, seenIosTip, ... }
   Record in `backups`: { id, at, ver, json }  — gli export automatici.
   ===================================================================== */
(function (global) {
  "use strict";

  var DB_NAME = "ebanist";
  var DB_VER = 1;
  var KV = "kv";
  var BK = "backups";

  var dbp = null;          // Promise<IDBDatabase> | null
  var broken = false;      // IndexedDB assente o rotta: si lavora senza

  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var idb;
      try { idb = global.indexedDB; } catch (e) { idb = null; }
      if (!idb) { rej(new Error("no-indexeddb")); return; }
      var rq;
      try { rq = idb.open(DB_NAME, DB_VER); } catch (e) { rej(e); return; }
      rq.onupgradeneeded = function () {
        var db = rq.result;
        if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
        if (!db.objectStoreNames.contains(BK)) db.createObjectStore(BK, { keyPath: "id" });
      };
      rq.onsuccess = function () {
        var db = rq.result;
        /* Se un'altra scheda chiede una versione nuova, questa deve
           mollare la presa: altrimenti quella resta bloccata per sempre
           su un `onblocked` che nessuno vede. */
        db.onversionchange = function () { try { db.close(); } catch (e) {} dbp = null; };
        res(db);
      };
      rq.onerror = function () { rej(rq.error || new Error("idb-open")); };
      /* Navigazione privata su alcuni browser: open() non risponde mai.
         Meglio dichiararsi rotti che tenere l'app in attesa. */
      setTimeout(function () { rej(new Error("idb-timeout")); }, 4000);
    }).catch(function (e) {
      broken = true; dbp = null;
      throw e;
    });
    return dbp;
  }

  function tx(store, mode, fn) {
    if (broken) return Promise.reject(new Error("idb-unavailable"));
    return open().then(function (db) {
      return new Promise(function (res, rej) {
        var t, s;
        try { t = db.transaction(store, mode); s = t.objectStore(store); }
        catch (e) { rej(e); return; }
        var rq = fn(s);
        t.oncomplete = function () { res(rq ? rq.result : undefined); };
        t.onabort = t.onerror = function () { rej(t.error || new Error("idb-tx")); };
      });
    });
  }

  var EBStore = {
    /* true se IndexedDB e utilizzabile. Non lancia mai: chi chiama deve
       poter proseguire su localStorage e basta. */
    ready: function () {
      return open().then(function () { return true; }, function () { return false; });
    },
    available: function () { return !broken; },

    get: function (key) { return tx(KV, "readonly", function (s) { return s.get(key); }); },
    set: function (key, val) { return tx(KV, "readwrite", function (s) { return s.put(val, key); }); },
    del: function (key) { return tx(KV, "readwrite", function (s) { return s.delete(key); }); },

    putBackup: function (rec) { return tx(BK, "readwrite", function (s) { return s.put(rec); }); },
    getBackup: function (id) { return tx(BK, "readonly", function (s) { return s.get(id); }); },
    allBackups: function () { return tx(BK, "readonly", function (s) { return s.getAll(); }); },
    delBackup: function (id) { return tx(BK, "readwrite", function (s) { return s.delete(id); }); },

    /* Gli slot automatici sono una rete, non un archivio: si tengono gli
       ultimi `keep` e il resto se ne va. Senza questo la cartella cresce
       a ogni salvataggio finche il telefono dice basta — cioe esattamente
       il guasto che questo file doveva chiudere. */
    pruneBackups: function (keep) {
      var n = keep || 5;
      return EBStore.allBackups().then(function (all) {
        if (!all || all.length <= n) return 0;
        all.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
        var doomed = all.slice(n);
        return Promise.all(doomed.map(function (r) { return EBStore.delBackup(r.id); }))
          .then(function () { return doomed.length; });
      });
    },

    /* --- memoria "persistente" ---
       Chrome la concede in silenzio a chi usa davvero il sito; Safari
       risponde quasi sempre false. Chiederla non costa niente e in un
       caso su due sposta l'app fuori dalla lista di quelle sacrificabili.
       Il risultato si MOSTRA nelle impostazioni: un utente che paga ha
       diritto di sapere se i suoi progetti stanno al sicuro o no. */
    persist: function () {
      try {
        if (!navigator.storage || !navigator.storage.persist) return Promise.resolve(false);
        return navigator.storage.persist().then(function (v) { return !!v; }, function () { return false; });
      } catch (e) { return Promise.resolve(false); }
    },
    persisted: function () {
      try {
        if (!navigator.storage || !navigator.storage.persisted) return Promise.resolve(false);
        return navigator.storage.persisted().then(function (v) { return !!v; }, function () { return false; });
      } catch (e) { return Promise.resolve(false); }
    },
    estimate: function () {
      try {
        if (!navigator.storage || !navigator.storage.estimate) return Promise.resolve(null);
        return navigator.storage.estimate().then(function (v) { return v; }, function () { return null; });
      } catch (e) { return Promise.resolve(null); }
    }
  };

  /* --- l'ambiente, per la sola domanda che conta ---
     "Questo telefono cancella i dati dopo 7 giorni?" Vero su iOS quando
     la pagina gira nel browser; falso quando gira dalla schermata Home,
     perche le PWA installate sono esentate. iPadOS da anni si dichiara
     Macintosh: senza il controllo sul touch il tablet non verrebbe mai
     riconosciuto, ed e il dispositivo del cliente. */
  EBStore.isIOS = function () {
    try {
      var ua = navigator.userAgent || "";
      if (/iPad|iPhone|iPod/.test(ua)) return true;
      return /Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1;
    } catch (e) { return false; }
  };
  EBStore.isStandalone = function () {
    try {
      if (navigator.standalone === true) return true;                       // iOS
      return !!(global.matchMedia && global.matchMedia("(display-mode: standalone)").matches);
    } catch (e) { return false; }
  };
  /* L'unico caso in cui vale la pena interrompere qualcuno con un
     consiglio: iOS, nel browser, non installata. */
  EBStore.atRiskOfEviction = function () {
    return EBStore.isIOS() && !EBStore.isStandalone();
  };

  global.EBStore = EBStore;
})(typeof window !== "undefined" ? window : this);
