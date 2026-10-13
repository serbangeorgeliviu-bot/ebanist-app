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
      locked: "Prea multe încercări greșite. Reîncearcă peste 15 minute.",
      notConfigured: "Inbox-ul nu e încă activat pentru acest atelier. Scrie la info@ebanist.com.",
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
      locked: "Troppi tentativi sbagliati. Riprova tra 15 minuti.",
      notConfigured: "L'inbox non è ancora attivato per questo laboratorio. Scrivi a info@ebanist.com.",
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
      locked: "Trop de tentatives erronées. Réessayez dans 15 minutes.",
      notConfigured: "L'inbox n'est pas encore activée pour cet atelier. Écrivez à info@ebanist.com.",
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
      locked: "Too many wrong attempts. Try again in 15 minutes.",
      notConfigured: "The inbox is not activated for this workshop yet. Write to info@ebanist.com.",
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
    },
    de: {
      _locale: "de-DE",
      inbox: "Bestellungen", pin: "PIN", enter: "Eintreten",
      badPin: "Falsche PIN.",
      locked: "Zu viele Fehlversuche. Versuchen Sie es in 15 Minuten erneut.",
      notConfigured: "Der Posteingang ist für diese Werkstatt noch nicht aktiviert. Schreiben Sie an info@ebanist.com.",
      noServer: "Der Server antwortet nicht. Per WhatsApp gesendete Bestellungen sind trotzdem angekommen.",
      insecure: "Posteingang im ungeschützten Modus: Die PIN wird aus der öffentlichen Datei der Werkstatt gelesen. Setzen Sie die Umgebungsvariable INBOX_PIN_… auf Netlify – siehe ORDER_RAIL_README.md.",
      empty: "Noch keine Bestellungen.",
      pieces: "Teile", hash: "Fingerabdruck", frozenAt: "eingefroren am",
      open: "Öffnen", confirm: "Bestätigen",
      confirmAsk: "Bestellung {id} bestätigen? Nach der Bestätigung wird der Snapshot eingefroren und lässt sich nicht mehr ändern. Eine spätere Änderung erzeugt eine neue Bestellung, v2.",
      markAs: "Markieren als {s}",
      status: { received: "eingegangen", confirmed: "bestätigt", cut: "zugeschnitten", collected: "abgeholt" },
      client: "Kunde", order: "Bestellung", total: "Gesamt", docs: "Dokumente",
      dlLab: "Zuschnittpaket (JSON)", dlSnap: "Projekt (JSON)", dlZip: "Alles als ZIP",
      docCut: "Zuschnittliste", docAssy: "Montageanleitung", docLabels: "Etiketten",
      printHint: "Öffnet druckfertig. «Als PDF speichern» finden Sie im Druckdialog.",
      notFound: "Diese Bestellung existiert nicht, oder der Link ist falsch.",
      diffTitle: "Was sich seit {v} geändert hat", diffAdd: "hinzugefügt", diffDel: "entfernt",
      diffQty: "Menge", diffNone: "Keine Änderungen an den Teilen.", parentOf: "Version der Bestellung",
      frozen: "Snapshot eingefroren", appVer: "App-Version"
    },
    pl: {
      _locale: "pl-PL",
      inbox: "zamówienia", pin: "PIN", enter: "Wejdź",
      badPin: "Zły PIN.",
      locked: "Zbyt wiele błędnych prób. Spróbuj ponownie za 15 minut.",
      notConfigured: "Skrzynka nie jest jeszcze aktywowana dla tego warsztatu. Napisz na info@ebanist.com.",
      noServer: "Serwer nie odpowiada. Zamówienia wysłane przez WhatsApp i tak dotarły.",
      insecure: "Skrzynka w trybie niezabezpieczonym: PIN jest odczytywany z publicznego pliku warsztatu. Ustaw zmienną środowiskową INBOX_PIN_… w Netlify — zobacz ORDER_RAIL_README.md.",
      empty: "Brak jeszcze zamówień.",
      pieces: "elementy", hash: "Odcisk", frozenAt: "zamrożone",
      open: "Otwórz", confirm: "Potwierdź",
      confirmAsk: "Potwierdzić zamówienie {id}? Po potwierdzeniu zrzut zostaje zamrożony i nie można go zmienić. Późniejsza zmiana tworzy nowe zamówienie, v2.",
      markAs: "Oznacz jako {s}",
      status: { received: "otrzymane", confirmed: "potwierdzone", cut: "przycięte", collected: "odebrane" },
      client: "Klient", order: "Zamówienie", total: "Razem", docs: "Dokumenty",
      dlLab: "Pakiet do cięcia (JSON)", dlSnap: "Projekt (JSON)", dlZip: "Wszystko w ZIP",
      docCut: "Lista formatek", docAssy: "Instrukcja montażu", docLabels: "Etykiety",
      printHint: "Otwiera się gotowe do druku. «Zapisz jako PDF» jest w oknie drukowania.",
      notFound: "To zamówienie nie istnieje albo link jest błędny.",
      diffTitle: "Co zmieniło się od {v}", diffAdd: "dodano", diffDel: "usunięto",
      diffQty: "ilość", diffNone: "Brak zmian w elementach.", parentOf: "wersja zamówienia",
      frozen: "Zrzut zamrożony", appVer: "Wersja aplikacji"
    },
    es: {
      _locale: "es-ES",
      inbox: "pedidos", pin: "PIN", enter: "Entrar",
      badPin: "PIN incorrecto.",
      locked: "Demasiados intentos fallidos. Vuelve a intentarlo en 15 minutos.",
      notConfigured: "La bandeja aún no está activada para este taller. Escribe a info@ebanist.com.",
      noServer: "El servidor no responde. Los pedidos enviados por WhatsApp han llegado igualmente.",
      insecure: "Bandeja en modo no protegido: el PIN se lee del archivo público del taller. Define la variable de entorno INBOX_PIN_… en Netlify — consulta ORDER_RAIL_README.md.",
      empty: "Aún no hay pedidos.",
      pieces: "piezas", hash: "Huella", frozenAt: "congelado el",
      open: "Abrir", confirm: "Confirmar",
      confirmAsk: "¿Confirmar el pedido {id}? Tras la confirmación la instantánea se congela y ya no puede cambiar. Una modificación posterior crea un pedido nuevo, v2.",
      markAs: "Marcar como {s}",
      status: { received: "recibido", confirmed: "confirmado", cut: "cortado", collected: "recogido" },
      client: "Cliente", order: "Pedido", total: "Total", docs: "Documentos",
      dlLab: "Paquete de corte (JSON)", dlSnap: "Proyecto (JSON)", dlZip: "Todo, en ZIP",
      docCut: "Lista de despiece", docAssy: "Hoja de montaje", docLabels: "Etiquetas",
      printHint: "Se abre listo para imprimir. «Guardar como PDF» está en el cuadro de impresión.",
      notFound: "Ese pedido no existe, o el enlace es incorrecto.",
      diffTitle: "Qué ha cambiado desde {v}", diffAdd: "añadido", diffDel: "eliminado",
      diffQty: "cantidad", diffNone: "Sin cambios en las piezas.", parentOf: "versión del pedido",
      frozen: "Instantánea congelada", appVer: "Versión de la app"
    }
  };

  global.ORI18N = {
    all: L,
    pick: function (lang) { return L[lang] || L.ro; }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = global.ORI18N;
})(typeof window !== "undefined" ? window : globalThis);
