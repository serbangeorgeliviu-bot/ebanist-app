/* =====================================================================
   Ebanist — Pașaportul proiectului (documentul pentru client)

   Partea PURĂ: grupează ce știe deja aplicația despre un proiect (materiale,
   decor, furnizor, grosime, suprafață, cant, feronerie) într-un model gata
   de tipărit și poartă textele în 7 limbi. Nu recalculează nimic: cifrele
   vin din `computeTotals` și `computeHardware`, prin `h`. HTML-ul îl face
   index.html; aici nu există DOM, ca să se poată testa în Node.

   Ce NU face: nu declară conformitate (certificări, emisii, origine) și nu
   inventează date. Ce lipsește apare ca „—” sau ca linie de completat.
   ===================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EBPassport = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function r1(v) { return Math.round(v * 10) / 10; }

  /* p: proiectul. h.tot(p) → {panelPcs, panelArea, edge, mats:{k:{label,area,edge,pcs}}};
     h.matInfo(label) → {decor, code, supplier, thickness}; h.isAcc(label) → bool;
     h.hardware(p) → [{name, product, article, qty}]; h.edgeTh() → mm; h.modules(p) → număr. */
  function model(p, h) {
    var tot = h.tot(p), mats = [];
    Object.keys(tot.mats || {}).forEach(function (k) {
      var m = tot.mats[k];
      if (h.isAcc(m.label)) return;
      var info = h.matInfo(m.label) || {};
      mats.push({ label: m.label, decor: info.decor || "", code: info.code || "", supplier: info.supplier || "",
        thickness: info.thickness == null ? null : +info.thickness, area: r1(m.area * 100) / 100, edgeMl: r1(m.edge), pcs: m.pcs });
    });
    mats.sort(function (a, b) { return a.label < b.label ? -1 : a.label > b.label ? 1 : 0; });
    var hw = (h.hardware(p) || []).filter(function (x) { return x.qty > 0; }).map(function (x) {
      return { name: x.name, product: x.product || "", article: x.article || "", qty: x.qty, verify: !x.article };
    });
    return {
      project: { name: p.name || "", client: p.client || "", date: p.date || "" },
      summary: { pieces: tot.panelPcs, area: Math.round(tot.panelArea * 100) / 100, edge: r1(tot.edge), modules: h.modules(p) },
      materials: mats, edgeTh: h.edgeTh(), hardware: hw
    };
  }

  var TXT = {
    it: { passBtn: "Passaporto progetto", passTitle: "Passaporto del progetto", passSub: "Materiali, ferramenta e produzione di questo progetto",
      passSummary: "In sintesi", passPieces: "Pezzi", passArea: "Superficie", passEdge: "Bordo", passModules: "Mobili",
      passMaterials: "Materiali", passMat: "Materiale", passDecor: "Decoro / codice", passSupplier: "Fornitore", passThick: "Spessore", passM2: "m²", passMl: "ml",
      passEdgeNote: "Bordo ABS in tinta con il pannello, spessore {t} mm.",
      passHardware: "Ferramenta", passItem: "Voce", passProduct: "Prodotto", passArticle: "Articolo", passQty: "Q.tà", passArtCheck: "codice da confermare",
      passFab: "Produzione", passOrder: "Commessa", passDate: "Data di produzione", passQc: "Controllo qualità", passSign: "Firma",
      passTrace: "I pezzi sono numerati e portano un codice QR sull'etichetta: la produzione si segue per postazione.",
      passCare: "Garanzia e manutenzione", passDisclaimer: "Documento informativo generato dal modello del progetto. Non sostituisce le dichiarazioni di conformità dei produttori.",
      passNoteLbl: "Testo per il passaporto (garanzia, manutenzione)", passNoteHint: "Appare nel passaporto del progetto, in «Garanzia e manutenzione»." },
    ro: { passBtn: "Pașaport proiect", passTitle: "Pașaportul proiectului", passSub: "Materialele, feroneria și fabricația acestui proiect",
      passSummary: "Pe scurt", passPieces: "Piese", passArea: "Suprafață", passEdge: "Cant", passModules: "Mobile",
      passMaterials: "Materiale", passMat: "Material", passDecor: "Decor / cod", passSupplier: "Furnizor", passThick: "Grosime", passM2: "m²", passMl: "ml",
      passEdgeNote: "Cant ABS asortat cu panoul, grosime {t} mm.",
      passHardware: "Feronerie", passItem: "Articol", passProduct: "Produs", passArticle: "Cod articol", passQty: "Cant.", passArtCheck: "cod de confirmat",
      passFab: "Fabricație", passOrder: "Comandă", passDate: "Data fabricației", passQc: "Control de calitate", passSign: "Semnătură",
      passTrace: "Piesele sunt numerotate și poartă un cod QR pe etichetă: fabricația se urmărește pe postazione.",
      passCare: "Garanție și întreținere", passDisclaimer: "Document informativ generat din modelul proiectului. Nu înlocuiește declarațiile de conformitate ale producătorilor.",
      passNoteLbl: "Text pentru pașaport (garanție, întreținere)", passNoteHint: "Apare în pașaportul proiectului, la „Garanție și întreținere”." },
    en: { passBtn: "Project passport", passTitle: "Project passport", passSub: "Materials, hardware and production of this project",
      passSummary: "At a glance", passPieces: "Pieces", passArea: "Surface", passEdge: "Edge banding", passModules: "Units",
      passMaterials: "Materials", passMat: "Material", passDecor: "Decor / code", passSupplier: "Supplier", passThick: "Thickness", passM2: "m²", passMl: "m",
      passEdgeNote: "ABS edge banding matched to the panel, {t} mm thick.",
      passHardware: "Hardware", passItem: "Item", passProduct: "Product", passArticle: "Article", passQty: "Qty", passArtCheck: "code to be confirmed",
      passFab: "Production", passOrder: "Job", passDate: "Production date", passQc: "Quality control", passSign: "Signature",
      passTrace: "Pieces are numbered and carry a QR code on the label: production is tracked station by station.",
      passCare: "Warranty and care", passDisclaimer: "Informational document generated from the project model. It does not replace manufacturers' conformity declarations.",
      passNoteLbl: "Passport text (warranty, care)", passNoteHint: "Shown in the project passport under “Warranty and care”." },
    fr: { passBtn: "Passeport du projet", passTitle: "Passeport du projet", passSub: "Matériaux, quincaillerie et fabrication de ce projet",
      passSummary: "En bref", passPieces: "Pièces", passArea: "Surface", passEdge: "Chant", passModules: "Meubles",
      passMaterials: "Matériaux", passMat: "Matériau", passDecor: "Décor / code", passSupplier: "Fournisseur", passThick: "Épaisseur", passM2: "m²", passMl: "ml",
      passEdgeNote: "Chant ABS assorti au panneau, épaisseur {t} mm.",
      passHardware: "Quincaillerie", passItem: "Article", passProduct: "Produit", passArticle: "Référence", passQty: "Qté", passArtCheck: "référence à confirmer",
      passFab: "Fabrication", passOrder: "Commande", passDate: "Date de fabrication", passQc: "Contrôle qualité", passSign: "Signature",
      passTrace: "Les pièces sont numérotées et portent un code QR sur l'étiquette : la fabrication est suivie poste par poste.",
      passCare: "Garantie et entretien", passDisclaimer: "Document informatif généré à partir du modèle du projet. Il ne remplace pas les déclarations de conformité des fabricants.",
      passNoteLbl: "Texte du passeport (garantie, entretien)", passNoteHint: "Affiché dans le passeport du projet, sous « Garantie et entretien »." },
    de: { passBtn: "Projektpass", passTitle: "Projektpass", passSub: "Materialien, Beschläge und Fertigung dieses Projekts",
      passSummary: "Auf einen Blick", passPieces: "Teile", passArea: "Fläche", passEdge: "Kante", passModules: "Möbel",
      passMaterials: "Materialien", passMat: "Material", passDecor: "Dekor / Code", passSupplier: "Lieferant", passThick: "Stärke", passM2: "m²", passMl: "lfm",
      passEdgeNote: "ABS-Kante passend zur Platte, {t} mm stark.",
      passHardware: "Beschläge", passItem: "Artikel", passProduct: "Produkt", passArticle: "Artikelnr.", passQty: "Stk", passArtCheck: "Code zu bestätigen",
      passFab: "Fertigung", passOrder: "Auftrag", passDate: "Fertigungsdatum", passQc: "Qualitätskontrolle", passSign: "Unterschrift",
      passTrace: "Die Teile sind nummeriert und tragen einen QR-Code auf dem Etikett: die Fertigung wird je Station verfolgt.",
      passCare: "Garantie und Pflege", passDisclaimer: "Informatives Dokument, erstellt aus dem Projektmodell. Es ersetzt nicht die Konformitätserklärungen der Hersteller.",
      passNoteLbl: "Text für den Pass (Garantie, Pflege)", passNoteHint: "Erscheint im Projektpass unter „Garantie und Pflege“." },
    pl: { passBtn: "Paszport projektu", passTitle: "Paszport projektu", passSub: "Materiały, okucia i produkcja tego projektu",
      passSummary: "W skrócie", passPieces: "Elementy", passArea: "Powierzchnia", passEdge: "Okleina", passModules: "Meble",
      passMaterials: "Materiały", passMat: "Materiał", passDecor: "Dekor / kod", passSupplier: "Dostawca", passThick: "Grubość", passM2: "m²", passMl: "mb",
      passEdgeNote: "Okleina ABS dobrana do płyty, grubość {t} mm.",
      passHardware: "Okucia", passItem: "Pozycja", passProduct: "Produkt", passArticle: "Nr art.", passQty: "Szt", passArtCheck: "kod do potwierdzenia",
      passFab: "Produkcja", passOrder: "Zlecenie", passDate: "Data produkcji", passQc: "Kontrola jakości", passSign: "Podpis",
      passTrace: "Elementy są numerowane i mają kod QR na etykiecie: produkcja jest śledzona stanowisko po stanowisku.",
      passCare: "Gwarancja i konserwacja", passDisclaimer: "Dokument informacyjny wygenerowany z modelu projektu. Nie zastępuje deklaracji zgodności producentów.",
      passNoteLbl: "Tekst do paszportu (gwarancja, konserwacja)", passNoteHint: "Pojawia się w paszporcie projektu w sekcji „Gwarancja i konserwacja”." },
    es: { passBtn: "Pasaporte del proyecto", passTitle: "Pasaporte del proyecto", passSub: "Materiales, herrajes y fabricación de este proyecto",
      passSummary: "De un vistazo", passPieces: "Piezas", passArea: "Superficie", passEdge: "Canto", passModules: "Muebles",
      passMaterials: "Materiales", passMat: "Material", passDecor: "Decoración / código", passSupplier: "Proveedor", passThick: "Grosor", passM2: "m²", passMl: "ml",
      passEdgeNote: "Canto ABS a juego con el tablero, de {t} mm.",
      passHardware: "Herrajes", passItem: "Artículo", passProduct: "Producto", passArticle: "Referencia", passQty: "Ud", passArtCheck: "código por confirmar",
      passFab: "Fabricación", passOrder: "Pedido", passDate: "Fecha de fabricación", passQc: "Control de calidad", passSign: "Firma",
      passTrace: "Las piezas están numeradas y llevan un código QR en la etiqueta: la fabricación se sigue puesto a puesto.",
      passCare: "Garantía y mantenimiento", passDisclaimer: "Documento informativo generado a partir del modelo del proyecto. No sustituye las declaraciones de conformidad de los fabricantes.",
      passNoteLbl: "Texto del pasaporte (garantía, mantenimiento)", passNoteHint: "Aparece en el pasaporte del proyecto, en «Garantía y mantenimiento»." }
  };
  function t(lang, key) { return (TXT[lang] || TXT.it)[key] || TXT.it[key] || key; }

  return { model: model, TXT: TXT, t: t };
});
