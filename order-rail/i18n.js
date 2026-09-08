/* =====================================================================
   Ebanist Order Rail — textele paginilor de atelier
   ---------------------------------------------------------------------
   Inbox-ul și pagina de comandă nu sunt aplicația: sunt două fișiere
   proprii, deci nu pot împrumuta `I18N` din `app/index.html`. Textele
   lor stau aici, în aceleași patru limbi, într-un singur loc pentru
   amândouă — două copii ar diverge la prima corectură.

   Limba o dă `language` din configurația atelierului: inbox-ul îl
   citește proprietarul atelierului, nu clientul.
   ===================================================================== */
(function (global) {
  "use strict";

  var L = {
    ro: {
      _locale: "ro-RO",
      inbox: "comenzi", pin: "PIN", enter: "Intră",
      badPin: "PIN greșit.",
      noServer: "Serverul nu răspunde. Comenzile trimise pe WhatsApp au ajuns oricum.",
      insecure: "Inbox în mod nesecurizat: PIN-ul se citește din fișierul public al atelierului. Pune variabila de mediu INBOX_PIN_… în Netlify — vezi ORDER_RAIL_README.md.",
      empty: "Nicio comandă încă.",
      pieces: "piese", hash: "Amprentă", frozenAt: "înghețată la",
      open: "Deschide", confirm: "Confirmă",
      confirmAsk: "Confirmi comanda {id}? După confirmare snapshot-ul se îngheață și nu se mai poate schimba. O modificare ulterioară creează o comandă nouă, v2.",
      markAs: "Marchează {s}",
      status: { received: "primită", confirmed: "confirmată", cut: "tăiată", collected: "ridicată" },
      client: "Client", order: "Comanda", total: "Total", docs: "Documente",
      dlLab: "Pachet debitare (JSON)", dlSnap: "Proiect (JSON)", dlZip: "Tot, ca ZIP",
      docCut: "Listă de debitare", docAssy: "Fișă de asamblare", docLabels: "Etichete",
      printHint: "Se deschide gata de tipărit. „Salvează ca PDF” e în dialogul de tipărire.",
      notFound: "Comanda nu există sau linkul e greșit.",
      diffTitle: "Ce s-a schimbat față de {v}", diffAdd: "adăugat", diffDel: "scos",
      diffQty: "cantitate", diffNone: "Nicio schimbare pe piese.", parentOf: "versiune a comenzii",
      frozen: "Snapshot înghețat", appVer: "Versiune app"
    },
    it: {
      _locale: "it-IT",
      inbox: "ordini", pin: "PIN", enter: "Entra",
      badPin: "PIN sbagliato.",
      noServer: "Il server non risponde. Gli ordini arrivati su WhatsApp ci sono lo stesso.",
      insecure: "Inbox in modalita non protetta: il PIN si legge dal file pubblico del laboratorio. Metti la variabile d'ambiente INBOX_PIN_… su Netlify — vedi ORDER_RAIL_README.md.",
      empty: "Ancora nessun ordine.",
      pieces: "pezzi", hash: "Impronta", frozenAt: "congelato il",
      open: "Apri", confirm: "Conferma",
      confirmAsk: "Confermi l'ordine {id}? Dopo la conferma lo snapshot si congela e non si puo piu cambiare. Una modifica successiva crea un ordine nuovo, v2.",
      markAs: "Segna {s}",
      status: { received: "ricevuto", confirmed: "confermato", cut: "tagliato", collected: "ritirato" },
      client: "Cliente", order: "Ordine", total: "Totale", docs: "Documenti",
      dlLab: "Pacchetto taglio (JSON)", dlSnap: "Progetto (JSON)", dlZip: "Tutto, in ZIP",
      docCut: "Distinta di taglio", docAssy: "Scheda di montaggio", docLabels: "Etichette",
      printHint: "Si apre pronto da stampare. «Salva come PDF» sta nella finestra di stampa.",
      notFound: "L'ordine non esiste o il link e sbagliato.",
      diffTitle: "Cosa e cambiato rispetto a {v}", diffAdd: "aggiunto", diffDel: "tolto",
      diffQty: "quantita", diffNone: "Nessuna modifica sui pezzi.", parentOf: "versione dell'ordine",
      frozen: "Snapshot congelato", appVer: "Versione app"
    },
    fr: {
      _locale: "fr-FR",
      inbox: "commandes", pin: "PIN", enter: "Entrer",
      badPin: "PIN incorrect.",
      noServer: "Le serveur ne répond pas. Les commandes reçues sur WhatsApp sont là quand même.",
      insecure: "Boîte en mode non protégé : le PIN se lit dans le fichier public de l'atelier. Ajoutez la variable d'environnement INBOX_PIN_… sur Netlify — voir ORDER_RAIL_README.md.",
      empty: "Aucune commande pour l'instant.",
      pieces: "pièces", hash: "Empreinte", frozenAt: "figé le",
      open: "Ouvrir", confirm: "Confirmer",
      confirmAsk: "Confirmer la commande {id} ? Après confirmation l'instantané est figé et ne peut plus changer. Une modification ultérieure crée une nouvelle commande, v2.",
      markAs: "Marquer {s}",
      status: { received: "reçue", confirmed: "confirmée", cut: "découpée", collected: "retirée" },
      client: "Client", order: "Commande", total: "Total", docs: "Documents",
      dlLab: "Paquet découpe (JSON)", dlSnap: "Projet (JSON)", dlZip: "Tout, en ZIP",
      docCut: "Liste de débit", docAssy: "Fiche de montage", docLabels: "Étiquettes",
      printHint: "S'ouvre prêt à imprimer. « Enregistrer en PDF » est dans la fenêtre d'impression.",
      notFound: "La commande n'existe pas ou le lien est incorrect.",
      diffTitle: "Ce qui a changé par rapport à {v}", diffAdd: "ajouté", diffDel: "retiré",
      diffQty: "quantité", diffNone: "Aucun changement sur les pièces.", parentOf: "version de la commande",
      frozen: "Instantané figé", appVer: "Version app"
    },
    en: {
      _locale: "en-GB",
      inbox: "orders", pin: "PIN", enter: "Enter",
      badPin: "Wrong PIN.",
      noServer: "The server is not answering. Orders that arrived on WhatsApp are still there.",
      insecure: "Inbox in unprotected mode: the PIN is read from the workshop's public file. Set the INBOX_PIN_… environment variable on Netlify — see ORDER_RAIL_README.md.",
      empty: "No orders yet.",
      pieces: "parts", hash: "Fingerprint", frozenAt: "frozen at",
      open: "Open", confirm: "Confirm",
      confirmAsk: "Confirm order {id}? After confirmation the snapshot is frozen and cannot change. A later edit creates a new order, v2.",
      markAs: "Mark {s}",
      status: { received: "received", confirmed: "confirmed", cut: "cut", collected: "collected" },
      client: "Customer", order: "Order", total: "Total", docs: "Documents",
      dlLab: "Cutting package (JSON)", dlSnap: "Project (JSON)", dlZip: "Everything, as ZIP",
      docCut: "Cutting list", docAssy: "Assembly sheet", docLabels: "Labels",
      printHint: "Opens ready to print. “Save as PDF” is in the print dialog.",
      notFound: "That order does not exist, or the link is wrong.",
      diffTitle: "What changed since {v}", diffAdd: "added", diffDel: "removed",
      diffQty: "quantity", diffNone: "No changes on the parts.", parentOf: "version of order",
      frozen: "Snapshot frozen", appVer: "App version"
    }
  };

  global.ORI18N = {
    all: L,
    pick: function (lang) { return L[lang] || L.ro; }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = global.ORI18N;
})(typeof window !== "undefined" ? window : globalThis);
