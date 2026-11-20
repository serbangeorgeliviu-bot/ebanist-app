/* Ebanist — prezentarea pentru client: texte în cele 7 limbi (modul Client, D-50).
   Un singur tabel: cheie → [it, ro, en, fr, de, pl, es]. Se desface în `PRESENT_I18N[lang][cheie]`;
   `ts()` și `tAny()` din index.html cad aici. Testul `present.test.js` păzește: toate cele 7 limbi, aceleași {substituții}.
   Nimic tehnic: fără coduri de articol, fără costuri — doar ce citește clientul. */
(function (root) {
"use strict";
var LANGS = ["it", "ro", "en", "fr", "de", "pl", "es"];
var T = {
prEyebrow: ["Proposta per", "Propunere pentru", "Proposal for", "Proposition pour", "Vorschlag für", "Propozycja dla", "Propuesta para"],
prEyebrowNoClient: ["La tua proposta", "Propunerea ta", "Your proposal", "Votre proposition", "Ihr Vorschlag", "Twoja propozycja", "Su propuesta"],
prDimW: ["Larghezza", "Lățime", "Width", "Largeur", "Breite", "Szerokość", "Ancho"],
prDimH: ["Altezza", "Înălțime", "Height", "Hauteur", "Höhe", "Wysokość", "Alto"],
prDimD: ["Profondità", "Adâncime", "Depth", "Profondeur", "Tiefe", "Głębokość", "Fondo"],
prSecLook: ["Come appare", "Cum arată", "How it looks", "Aperçu", "So sieht es aus", "Jak wygląda", "Cómo se ve"],
prSchema: ["Schema indicativa, quote in mm", "Schemă orientativă, cote în mm", "Indicative drawing, sizes in mm", "Schéma indicatif, cotes en mm", "Prinzipskizze, Maße in mm", "Szkic poglądowy, wymiary w mm", "Esquema orientativo, medidas en mm"],
prSecInc: ["Cosa comprende", "Ce include", "What is included", "Ce qui est inclus", "Das ist enthalten", "Co zawiera", "Qué incluye"],
prDoors: ["Ante", "Uși", "Doors", "Portes", "Türen", "Drzwi", "Puertas"],
prSliding: ["Ante scorrevoli", "Uși glisante", "Sliding doors", "Portes coulissantes", "Schiebetüren", "Drzwi przesuwne", "Puertas correderas"],
prDrawers: ["Cassetti", "Sertare", "Drawers", "Tiroirs", "Schubladen", "Szuflady", "Cajones"],
prShelves: ["Ripiani", "Rafturi", "Shelves", "Étagères", "Einlegeböden", "Półki", "Baldas"],
prHang: ["Barra appendiabiti", "Bară de haine", "Hanging rail", "Tringle de penderie", "Kleiderstange", "Drążek na ubrania", "Barra para colgar"],
prLed: ["Illuminazione LED", "Iluminat LED", "LED lighting", "Éclairage LED", "LED-Beleuchtung", "Oświetlenie LED", "Iluminación LED"],
prPlinth: ["Zoccolo", "Soclu", "Plinth", "Plinthe", "Sockel", "Cokół", "Zócalo"],
prBack: ["Schiena chiusa", "Spate închis", "Closed back", "Dos fermé", "Geschlossene Rückwand", "Zamknięte plecy", "Trasera cerrada"],
prSecNext: ["Cosa succede dopo", "Ce urmează", "What happens next", "La suite", "Wie es weitergeht", "Co dalej", "Qué sigue"],
prStep1T: ["Conferma", "Confirmarea", "Confirmation", "Confirmation", "Bestätigung", "Potwierdzenie", "Confirmación"],
prStep1D: ["Accetti l'offerta con la tua firma.", "Accepți oferta prin semnătura ta.", "You accept the offer with your signature.", "Vous acceptez l'offre par votre signature.", "Sie nehmen das Angebot mit Ihrer Unterschrift an.", "Akceptujesz ofertę swoim podpisem.", "Acepta la oferta con su firma."],
prStep2T: ["Produzione", "Producția", "Production", "Fabrication", "Fertigung", "Produkcja", "Fabricación"],
prStep2D: ["Il mobile viene realizzato in laboratorio, con le finiture scelte.", "Mobilierul se execută în atelier, cu finisajele alese.", "The furniture is built in the workshop, in the finishes you chose.", "Le meuble est fabriqué en atelier, dans les finitions choisies.", "Das Möbel wird in der Werkstatt mit den gewählten Oberflächen gefertigt.", "Mebel powstaje w pracowni, w wybranych wykończeniach.", "El mueble se fabrica en el taller, con los acabados elegidos."],
prStep3T: ["Montaggio", "Montajul", "Installation", "Pose", "Montage", "Montaż", "Montaje"],
prStep3D: ["Consegna e montaggio a cura del nostro team.", "Livrare și montaj de către echipa noastră.", "Delivered and installed by our team.", "Livraison et pose par notre équipe.", "Lieferung und Montage durch unser Team.", "Dostawa i montaż przez nasz zespół.", "Entrega y montaje por nuestro equipo."],
prRecap: ["Riepilogo", "Rezumat", "Summary", "Récapitulatif", "Zusammenfassung", "Podsumowanie", "Resumen"],
prSwipe: ["Tocca e trascina per girare il mobile", "Atinge și trage ca să rotești mobilierul", "Touch and drag to turn the furniture", "Touchez et glissez pour faire tourner le meuble", "Berühren und ziehen, um das Möbel zu drehen", "Dotknij i przeciągnij, aby obrócić mebel", "Toque y arrastre para girar el mueble"],
prSecHw: ["Ferramenta", "Feronerie", "Hardware", "Quincaillerie", "Beschläge", "Okucia", "Herrajes"],
prHwHint: ["Scegli: il prezzo si aggiorna subito.", "Alege: prețul se actualizează pe loc.", "Choose: the price updates instantly.", "Choisissez : le prix se met à jour aussitôt.", "Wählen Sie: der Preis aktualisiert sich sofort.", "Wybierz: cena zmienia się od razu.", "Elija: el precio se actualiza al instante."],
prRoomReal: ["Nella tua stanza", "În camera ta", "In your room", "Dans votre pièce", "In Ihrem Raum", "W Twoim pokoju", "En su habitación"],
prRoomAll: ["Tutta la composizione", "Toată compoziția", "The whole composition", "Toute la composition", "Die ganze Zusammenstellung", "Cała zabudowa", "Toda la composición"],
prRoomOne: ["In ambiente", "În ambient", "In a room", "En situation", "Im Raum", "W pomieszczeniu", "En un ambiente"],
prSecExtra: ["Opzioni extra", "Opțiuni extra", "Extras", "Options en plus", "Extras", "Opcje dodatkowe", "Extras"],
prExShelf: ["Un ripiano in più", "Un raft în plus", "One more shelf", "Une étagère de plus", "Ein zusätzlicher Einlegeboden", "Dodatkowa półka", "Una balda más"],
prExDrawer: ["Un cassetto in più", "Un sertar în plus", "One more drawer", "Un tiroir de plus", "Eine zusätzliche Schublade", "Dodatkowa szuflada", "Un cajón más"],
prSend: ["Invia la proposta", "Trimite propunerea", "Send the proposal", "Envoyer la proposition", "Vorschlag senden", "Wyślij propozycję", "Enviar la propuesta"],
prSendErr: ["Non riesco a creare l'immagine della proposta", "Nu am putut crea imaginea propunerii", "Could not create the proposal image", "Impossible de créer l'image de la proposition", "Das Bild des Vorschlags konnte nicht erstellt werden", "Nie udało się utworzyć obrazu propozycji", "No se pudo crear la imagen de la propuesta"],
prChosen: ["Scelta attuale", "Alegerea curentă", "Current choice", "Choix actuel", "Aktuelle Wahl", "Obecny wybór", "Elección actual"]
};

var PRESENT_I18N = {};
LANGS.forEach(function (l) { PRESENT_I18N[l] = {}; });
Object.keys(T).forEach(function (k) { LANGS.forEach(function (l, i) { PRESENT_I18N[l][k] = T[k][i]; }); });

var API = { PRESENT_I18N: PRESENT_I18N, PRESENT_LANGS: LANGS, PRESENT_I18N_RAW: T };
if (typeof module !== "undefined" && module.exports) module.exports = API;
for (var k in API) if (Object.prototype.hasOwnProperty.call(API, k)) root[k] = API[k];
})(typeof globalThis !== "undefined" ? globalThis : this);
