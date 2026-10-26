/* =====================================================================
   Ebanist — fluxul comercial: plan de plată în ofertă și proces-verbal
   de recepție (partea pură, fără DOM; testată în test/commerce.test.js).

   Planul de plată: trei etape (avans, la începutul fabricației, la livrare),
   în procente care dau 100. Sumele se calculează în CENȚI întregi, iar ultima
   etapă preia diferența de rotunjire, ca suma etapelor să fie exact totalul.
   ===================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EBCommerce = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* pcts: [a, b, c] (numere sau texte). Întoarce un plan valid sau null: toate goale/0 = fără plan;
     orice valoare negativă, nenumerică, sub 0 sau peste 100, sau o sumă ≠ 100 = invalid (null + motiv) */
  function normPlan(pcts) {
    var a = (pcts || []).map(function (v) {
      if (v === "" || v == null) return 0;
      var n = Number(String(v).replace(",", "."));
      return isFinite(n) ? n : NaN;
    });
    while (a.length < 3) a.push(0);
    a = a.slice(0, 3);
    if (a.every(function (n) { return n === 0; })) return { plan: null, reason: "empty" };
    if (a.some(function (n) { return !isFinite(n) || n < 0 || n > 100; })) return { plan: null, reason: "range" };
    var sum = a.reduce(function (s, n) { return s + n; }, 0);
    if (Math.abs(sum - 100) > 1e-9) return { plan: null, reason: "sum", sum: Math.round(sum * 100) / 100 };
    return { plan: a, reason: null };
  }

  /* total în unități (euro, cu zecimale); întoarce [{pct, cents, amount}] cu suma exactă */
  function payPlan(total, plan) {
    var t = Math.round((+total || 0) * 100), out = [], used = 0, last = -1;
    plan.forEach(function (p, i) { if (p > 0) last = i; });
    plan.forEach(function (p, i) {
      if (!(p > 0)) return;
      var c = i === last ? t - used : Math.round(t * p / 100);
      used += c;
      out.push({ step: i + 1, pct: p, cents: c, amount: c / 100 });
    });
    return out;
  }

  var TXT = {
    it: { payTitle: "Piano di pagamento", pay1: "All'ordine (acconto)", pay2: "All'inizio della produzione", pay3: "Alla consegna", payPct: "%", payAmount: "Importo (IVA incl.)",
      payLbl: "Piano di pagamento (%)", payHint: "Acconto, inizio produzione, consegna. Devono dare 100; lascia vuoto per non stamparlo nel preventivo.",
      paySum: "La somma deve essere 100 (ora: {s}).", payRange: "Ogni percentuale deve stare tra 0 e 100.",
      hoBtn: "Verbale di consegna", hoTitle: "Verbale di consegna e collaudo", hoSub: "Da compilare e firmare in cantiere", hoWork: "Lavoro", hoDate: "Data della consegna", hoPlace: "Luogo",
      hoChecks: "Controlli", hoC1: "Ante e frontali allineati, con giochi uniformi", hoC2: "Cassetti e ante scorrono e si chiudono senza sforzo", hoC3: "Cerniere e guide regolate",
      hoC4: "Superfici, bordi e decori senza graffi o scheggiature", hoC5: "Ferramenta e accessori completi, come da distinta", hoC6: "Fissaggi a muro e livelli verificati",
      hoC7: "Mobile pulito, imballaggi e scarti portati via", hoDefects: "Riserve e interventi da fare", hoDefLine: "Riserva", hoDeadline: "Entro il",
      hoDecl: "Il cliente dichiara di aver ricevuto il lavoro", hoOk: "senza riserve", hoRes: "con le riserve sopra indicate",
      hoClient: "Il cliente", hoCompany: "Per l'azienda", hoSign: "Firma", hoNote: "Il presente verbale non sostituisce il contratto né le condizioni di garanzia." },
    ro: { payTitle: "Plan de plată", pay1: "La comandă (avans)", pay2: "La începutul fabricației", pay3: "La livrare", payPct: "%", payAmount: "Sumă (TVA inclus)",
      payLbl: "Plan de plată (%)", payHint: "Avans, începutul fabricației, livrare. Trebuie să dea 100; lasă gol ca să nu apară în ofertă.",
      paySum: "Suma trebuie să fie 100 (acum: {s}).", payRange: "Fiecare procent trebuie să fie între 0 și 100.",
      hoBtn: "Proces-verbal de recepție", hoTitle: "Proces-verbal de recepție", hoSub: "De completat și semnat la fața locului", hoWork: "Lucrare", hoDate: "Data recepției", hoPlace: "Locul",
      hoChecks: "Verificări", hoC1: "Uși și fronturi aliniate, cu rosturi uniforme", hoC2: "Sertarele și ușile se mișcă și se închid fără efort", hoC3: "Balamale și ghidaje reglate",
      hoC4: "Suprafețe, canturi și decoruri fără zgârieturi sau ciobiri", hoC5: "Feroneria și accesoriile complete, conform distinctei", hoC6: "Fixările în perete și nivelele verificate",
      hoC7: "Mobilier curat, ambalaje și resturi duse", hoDefects: "Rezerve și remedieri de făcut", hoDefLine: "Rezervă", hoDeadline: "Până la",
      hoDecl: "Clientul declară că a primit lucrarea", hoOk: "fără rezerve", hoRes: "cu rezervele de mai sus",
      hoClient: "Clientul", hoCompany: "Pentru firmă", hoSign: "Semnătură", hoNote: "Acest proces-verbal nu înlocuiește contractul și nici condițiile de garanție." },
    en: { payTitle: "Payment schedule", pay1: "On order (deposit)", pay2: "At start of production", pay3: "On delivery", payPct: "%", payAmount: "Amount (incl. VAT)",
      payLbl: "Payment schedule (%)", payHint: "Deposit, start of production, delivery. Must add up to 100; leave empty to keep it off the quote.",
      paySum: "The total must be 100 (now: {s}).", payRange: "Each percentage must be between 0 and 100.",
      hoBtn: "Handover report", hoTitle: "Handover and acceptance report", hoSub: "To be completed and signed on site", hoWork: "Work", hoDate: "Handover date", hoPlace: "Place",
      hoChecks: "Checks", hoC1: "Doors and fronts aligned, with even gaps", hoC2: "Drawers and doors move and close smoothly", hoC3: "Hinges and runners adjusted",
      hoC4: "Surfaces, edges and decors free of scratches or chips", hoC5: "Hardware and accessories complete, as per the parts list", hoC6: "Wall fixings and levels checked",
      hoC7: "Furniture clean, packaging and offcuts removed", hoDefects: "Reservations and corrections to make", hoDefLine: "Reservation", hoDeadline: "By",
      hoDecl: "The client confirms receipt of the work", hoOk: "without reservations", hoRes: "with the reservations listed above",
      hoClient: "The client", hoCompany: "For the company", hoSign: "Signature", hoNote: "This report does not replace the contract or the warranty terms." },
    fr: { payTitle: "Échéancier de paiement", pay1: "À la commande (acompte)", pay2: "Au début de la fabrication", pay3: "À la livraison", payPct: "%", payAmount: "Montant (TVA incl.)",
      payLbl: "Échéancier de paiement (%)", payHint: "Acompte, début de fabrication, livraison. Le total doit faire 100 ; laissez vide pour ne pas l'imprimer sur le devis.",
      paySum: "Le total doit faire 100 (actuellement : {s}).", payRange: "Chaque pourcentage doit être compris entre 0 et 100.",
      hoBtn: "Procès-verbal de réception", hoTitle: "Procès-verbal de réception", hoSub: "À compléter et signer sur place", hoWork: "Ouvrage", hoDate: "Date de réception", hoPlace: "Lieu",
      hoChecks: "Contrôles", hoC1: "Portes et façades alignées, jeux réguliers", hoC2: "Tiroirs et portes coulissent et se ferment sans effort", hoC3: "Charnières et coulisses réglées",
      hoC4: "Surfaces, chants et décors sans rayures ni éclats", hoC5: "Quincaillerie et accessoires complets, conformes à la liste", hoC6: "Fixations murales et niveaux vérifiés",
      hoC7: "Meuble nettoyé, emballages et chutes évacués", hoDefects: "Réserves et reprises à effectuer", hoDefLine: "Réserve", hoDeadline: "Avant le",
      hoDecl: "Le client déclare avoir reçu l'ouvrage", hoOk: "sans réserve", hoRes: "avec les réserves ci-dessus",
      hoClient: "Le client", hoCompany: "Pour l'entreprise", hoSign: "Signature", hoNote: "Ce procès-verbal ne remplace ni le contrat ni les conditions de garantie." },
    de: { payTitle: "Zahlungsplan", pay1: "Bei Auftrag (Anzahlung)", pay2: "Bei Fertigungsbeginn", pay3: "Bei Lieferung", payPct: "%", payAmount: "Betrag (inkl. MwSt.)",
      payLbl: "Zahlungsplan (%)", payHint: "Anzahlung, Fertigungsbeginn, Lieferung. Muss 100 ergeben; leer lassen, damit er nicht im Angebot steht.",
      paySum: "Die Summe muss 100 sein (jetzt: {s}).", payRange: "Jeder Prozentsatz muss zwischen 0 und 100 liegen.",
      hoBtn: "Abnahmeprotokoll", hoTitle: "Übergabe- und Abnahmeprotokoll", hoSub: "Vor Ort auszufüllen und zu unterschreiben", hoWork: "Arbeit", hoDate: "Übergabedatum", hoPlace: "Ort",
      hoChecks: "Prüfungen", hoC1: "Türen und Fronten ausgerichtet, gleichmäßige Fugen", hoC2: "Schubladen und Türen laufen und schließen leicht", hoC3: "Scharniere und Auszüge eingestellt",
      hoC4: "Oberflächen, Kanten und Dekore ohne Kratzer oder Abplatzer", hoC5: "Beschläge und Zubehör vollständig laut Stückliste", hoC6: "Wandbefestigungen und Waagerechte geprüft",
      hoC7: "Möbel gereinigt, Verpackung und Reste entfernt", hoDefects: "Vorbehalte und Nacharbeiten", hoDefLine: "Vorbehalt", hoDeadline: "Bis",
      hoDecl: "Der Kunde bestätigt den Erhalt der Arbeit", hoOk: "ohne Vorbehalte", hoRes: "mit den oben genannten Vorbehalten",
      hoClient: "Der Kunde", hoCompany: "Für das Unternehmen", hoSign: "Unterschrift", hoNote: "Dieses Protokoll ersetzt weder den Vertrag noch die Garantiebedingungen." },
    pl: { payTitle: "Harmonogram płatności", pay1: "Przy zamówieniu (zaliczka)", pay2: "Na początku produkcji", pay3: "Przy dostawie", payPct: "%", payAmount: "Kwota (z VAT)",
      payLbl: "Harmonogram płatności (%)", payHint: "Zaliczka, początek produkcji, dostawa. Suma musi wynosić 100; zostaw puste, aby nie drukować w ofercie.",
      paySum: "Suma musi wynosić 100 (teraz: {s}).", payRange: "Każdy procent musi mieścić się między 0 a 100.",
      hoBtn: "Protokół odbioru", hoTitle: "Protokół przekazania i odbioru", hoSub: "Do wypełnienia i podpisania na miejscu", hoWork: "Praca", hoDate: "Data odbioru", hoPlace: "Miejsce",
      hoChecks: "Kontrole", hoC1: "Drzwi i fronty wyrównane, równe szczeliny", hoC2: "Szuflady i drzwi chodzą i zamykają się lekko", hoC3: "Zawiasy i prowadnice wyregulowane",
      hoC4: "Powierzchnie, krawędzie i dekory bez zarysowań i odprysków", hoC5: "Okucia i akcesoria kompletne wg listy", hoC6: "Mocowania do ściany i poziomy sprawdzone",
      hoC7: "Meble czyste, opakowania i odpady usunięte", hoDefects: "Zastrzeżenia i poprawki", hoDefLine: "Zastrzeżenie", hoDeadline: "Do",
      hoDecl: "Klient potwierdza odbiór pracy", hoOk: "bez zastrzeżeń", hoRes: "z powyższymi zastrzeżeniami",
      hoClient: "Klient", hoCompany: "Za firmę", hoSign: "Podpis", hoNote: "Protokół nie zastępuje umowy ani warunków gwarancji." },
    es: { payTitle: "Plan de pagos", pay1: "Al pedir (anticipo)", pay2: "Al inicio de la fabricación", pay3: "En la entrega", payPct: "%", payAmount: "Importe (IVA incl.)",
      payLbl: "Plan de pagos (%)", payHint: "Anticipo, inicio de fabricación, entrega. Debe sumar 100; déjalo vacío para no imprimirlo en el presupuesto.",
      paySum: "La suma debe ser 100 (ahora: {s}).", payRange: "Cada porcentaje debe estar entre 0 y 100.",
      hoBtn: "Acta de entrega", hoTitle: "Acta de entrega y recepción", hoSub: "Para completar y firmar en obra", hoWork: "Trabajo", hoDate: "Fecha de entrega", hoPlace: "Lugar",
      hoChecks: "Comprobaciones", hoC1: "Puertas y frentes alineados, holguras uniformes", hoC2: "Cajones y puertas se mueven y cierran sin esfuerzo", hoC3: "Bisagras y guías reguladas",
      hoC4: "Superficies, cantos y decorados sin arañazos ni astillas", hoC5: "Herrajes y accesorios completos según la lista", hoC6: "Fijaciones a la pared y niveles comprobados",
      hoC7: "Mueble limpio, embalajes y restos retirados", hoDefects: "Reservas y arreglos pendientes", hoDefLine: "Reserva", hoDeadline: "Antes del",
      hoDecl: "El cliente declara haber recibido el trabajo", hoOk: "sin reservas", hoRes: "con las reservas indicadas",
      hoClient: "El cliente", hoCompany: "Por la empresa", hoSign: "Firma", hoNote: "Esta acta no sustituye al contrato ni a las condiciones de garantía." }
  };
  function t(lang, key) { return (TXT[lang] || TXT.it)[key] || TXT.it[key] || key; }

  return { normPlan: normPlan, payPlan: payPlan, TXT: TXT, t: t };
});
