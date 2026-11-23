/* =====================================================================
   Ebanist — Novități (D-184)
   ---------------------------------------------------------------------
   Ce s-a schimbat la fiecare versiune, în cuvintele utilizatorului, în
   cele 7 limbi ale aplicației. Modul pur: nu atinge DOM-ul, nu citește
   starea. index.html doar pune în foaia „Novități” textul de la render().

   Regula (în CLAUDE.md): o versiune care schimbă ce vede sau ce poate
   face utilizatorul adaugă aici o intrare, în toate cele 7 limbi, în
   aceeași comandă cu CHANGELOG.md. Telemetria, testele și reparațiile
   interne nu intră. Intrările mai vechi sunt articolele din blog.

   Format: RELEASES[i] = { v, date: "AAAA-LL-ZZ", t: { <limbă>: { title, items[] } } }
           cea mai nouă prima.
   ===================================================================== */
(function (global) {
  "use strict";

  var LANGS = ["en", "ro", "it", "fr", "de", "pl", "es"];

  var UI = {
    en: { title: "What's new", version: "Version", older: "Older versions and the full story:", blog: "Ebanist blog" },
    ro: { title: "Novități", version: "Versiunea", older: "Versiuni mai vechi și povestea completă:", blog: "blogul Ebanist" },
    it: { title: "Novità", version: "Versione", older: "Versioni precedenti e la storia completa:", blog: "blog di Ebanist" },
    fr: { title: "Nouveautés", version: "Version", older: "Versions précédentes et l'histoire complète :", blog: "blog Ebanist" },
    de: { title: "Neuigkeiten", version: "Version", older: "Frühere Versionen und die ganze Geschichte:", blog: "Ebanist-Blog" },
    pl: { title: "Nowości", version: "Wersja", older: "Starsze wersje i pełna historia:", blog: "blog Ebanist" },
    es: { title: "Novedades", version: "Versión", older: "Versiones anteriores y la historia completa:", blog: "blog de Ebanist" }
  };

  var RELEASES = [
    { v: "5.105.0", date: "2026-11-23", t: {
      en: { title: "Pro follows your account", items: ["Sign in with your e-mail and password (Account button) and, if you paid for Pro on ebanist.com with that same e-mail, Pro turns on by itself on that device: no code to copy.", "The e-mail must be confirmed. If you paid with another address, the code still works as before.", "On the Android app from Google Play, Pro is still decided only by Google Play."] },
      ro: { title: "Pro te urmează în cont", items: ["Te autentifici cu e-mail și parolă (butonul Cont) și, dacă ai plătit Pro pe ebanist.com cu aceeași adresă, Pro se activează singur pe acel dispozitiv: fără cod de copiat.", "Adresa trebuie să fie confirmată. Dacă ai plătit cu altă adresă, codul merge ca înainte.", "În aplicația Android din Google Play, Pro rămâne decis numai de Google Play."] },
      it: { title: "Il Pro ti segue con l'account", items: ["Accedi con e-mail e password (pulsante Account) e, se hai pagato il Pro su ebanist.com con la stessa e-mail, il Pro si attiva da solo su quel dispositivo: niente codice da copiare.", "L'e-mail deve essere confermata. Se hai pagato con un altro indirizzo, il codice funziona come prima.", "Nell'app Android di Google Play il Pro resta deciso solo da Google Play."] },
      fr: { title: "Le Pro vous suit avec votre compte", items: ["Connectez-vous avec votre e-mail et votre mot de passe (bouton Compte) et, si vous avez payé le Pro sur ebanist.com avec la même adresse, le Pro s'active tout seul sur cet appareil : plus de code à copier.", "L'adresse doit être confirmée. Si vous avez payé avec une autre adresse, le code fonctionne comme avant.", "Dans l'application Android de Google Play, le Pro reste décidé uniquement par Google Play."] },
      de: { title: "Pro folgt Ihrem Konto", items: ["Melden Sie sich mit E-Mail und Passwort an (Taste Konto): Wenn Sie Pro auf ebanist.com mit derselben Adresse bezahlt haben, schaltet sich Pro auf diesem Gerät von selbst ein, ohne Code zum Kopieren.", "Die E-Mail muss bestätigt sein. Haben Sie mit einer anderen Adresse bezahlt, funktioniert der Code wie bisher.", "In der Android-App aus Google Play entscheidet über Pro weiterhin nur Google Play."] },
      pl: { title: "Pro idzie za Twoim kontem", items: ["Zaloguj się e-mailem i hasłem (przycisk Konto), a jeśli za Pro zapłaciłeś na ebanist.com tym samym adresem, Pro włączy się samo na tym urządzeniu: bez kodu do kopiowania.", "Adres musi być potwierdzony. Jeśli płaciłeś innym adresem, kod działa jak dotąd.", "W aplikacji Android z Google Play o Pro nadal decyduje wyłącznie Google Play."] },
      es: { title: "Pro te sigue con tu cuenta", items: ["Inicia sesión con tu e-mail y contraseña (botón Cuenta) y, si pagaste Pro en ebanist.com con ese mismo e-mail, Pro se activa solo en ese dispositivo: sin código que copiar.", "El e-mail debe estar confirmado. Si pagaste con otra dirección, el código funciona como antes.", "En la app de Android de Google Play, Pro sigue decidiéndose solo por Google Play."] }
    } },
    { v: "5.104.0", date: "2026-11-23", t: {
      en: { title: "“What's new” page", items: ["This page: what changed in each update, in plain words.", "Open it from the **?** button, at the top of Help."] },
      ro: { title: "Pagina „Novități”", items: ["Pagina aceasta: ce s-a schimbat la fiecare actualizare, în cuvinte simple.", "O deschizi din butonul **?**, sus în Ajutor."] },
      it: { title: "Pagina «Novità»", items: ["Questa pagina: cosa cambia a ogni aggiornamento, in parole semplici.", "Si apre dal pulsante **?**, in cima alla Guida."] },
      fr: { title: "Page « Nouveautés »", items: ["Cette page : ce qui change à chaque mise à jour, en mots simples.", "Ouvrez-la depuis le bouton **?**, en haut de l'Aide."] },
      de: { title: "Seite „Neuigkeiten“", items: ["Diese Seite: was sich bei jedem Update ändert, in einfachen Worten.", "Sie öffnet sich über die Taste **?**, oben in der Hilfe."] },
      pl: { title: "Strona „Nowości”", items: ["Ta strona: co zmienia się przy każdej aktualizacji, prostymi słowami.", "Otworzysz ją przyciskiem **?**, na górze Pomocy."] },
      es: { title: "Página «Novedades»", items: ["Esta página: qué cambia en cada actualización, con palabras sencillas.", "Se abre desde el botón **?**, arriba en la Ayuda."] }
    } },
    { v: "5.103.0", date: "2026-11-23", t: {
      en: { title: "Open doors and drawers in Room 3D", items: ["The button is now inside the 3D room window and opens all doors and drawers at once.", "Units that collide are flagged, as before."] },
      ro: { title: "Deschide ușile și sertarele în „Camera în 3D”", items: ["Butonul e acum în fereastra camerei 3D și deschide deodată toate ușile și sertarele.", "Corpurile care se lovesc sunt semnalate, ca înainte."] },
      it: { title: "Apri ante e cassetti nella «Stanza in 3D»", items: ["Il pulsante ora è nella finestra della stanza 3D e apre tutte le ante e i cassetti insieme.", "I mobili che si urtano vengono segnalati, come prima."] },
      fr: { title: "Ouvrir portes et tiroirs dans la « Pièce en 3D »", items: ["Le bouton est maintenant dans la fenêtre de la pièce 3D et ouvre toutes les portes et tous les tiroirs d'un coup.", "Les meubles qui se heurtent sont signalés, comme avant."] },
      de: { title: "Türen und Schubladen im „Raum in 3D“ öffnen", items: ["Die Taste sitzt jetzt im 3D-Raumfenster und öffnet alle Türen und Schubladen auf einmal.", "Möbel, die sich berühren, werden wie bisher markiert."] },
      pl: { title: "Otwieranie drzwi i szuflad w „Pokoju w 3D”", items: ["Przycisk jest teraz w oknie pokoju 3D i otwiera naraz wszystkie drzwi i szuflady.", "Szafki, które na siebie wchodzą, są oznaczane jak dotąd."] },
      es: { title: "Abrir puertas y cajones en la «Habitación en 3D»", items: ["El botón ahora está en la ventana de la habitación 3D y abre todas las puertas y cajones a la vez.", "Los muebles que chocan se señalan, como antes."] }
    } },
    { v: "5.102.0", date: "2026-11-23", t: {
      en: { title: "Handles and real part shapes in Room 3D", items: ["Bar handles now appear on doors and drawers, in the finish from the catalog (brass/gold, stainless, black).", "Parts with a free contour (shelves with rounded corners, panels) are drawn in their exact shape.", "LED strip under the unit, on the plinth face (only with a plinth)."] },
      ro: { title: "Mânere și forma reală a pieselor în „Camera în 3D”", items: ["Mânerele bară apar pe uși și pe sertare, în finisajul din catalog (alamă/auriu, inox, negru).", "Piesele cu contur liber (rafturi cu colț rotunjit, panouri) se desenează cu forma lor exactă.", "Bandă LED sub corp, pe fața soclului (numai cu soclu)."] },
      it: { title: "Maniglie e forma reale dei pezzi nella «Stanza in 3D»", items: ["Le maniglie a barra compaiono su ante e cassetti, nella finitura del catalogo (ottone/oro, inox, nero).", "I pezzi con contorno libero (ripiani con angolo arrotondato, pannelli) sono disegnati con la loro forma esatta.", "Striscia LED sotto il mobile, sulla faccia dello zoccolo (solo con zoccolo)."] },
      fr: { title: "Poignées et forme réelle des pièces dans la « Pièce en 3D »", items: ["Les poignées barre apparaissent sur les portes et les tiroirs, dans la finition du catalogue (laiton/or, inox, noir).", "Les pièces à contour libre (étagères à angle arrondi, panneaux) sont dessinées avec leur forme exacte.", "Bandeau LED sous le meuble, sur la face du socle (uniquement avec socle)."] },
      de: { title: "Griffe und echte Teileform im „Raum in 3D“", items: ["Stangengriffe erscheinen auf Türen und Schubladen, in der Oberfläche aus dem Katalog (Messing/Gold, Edelstahl, Schwarz).", "Teile mit freier Kontur (Regalböden mit runder Ecke, Platten) werden in ihrer genauen Form gezeichnet.", "LED-Streifen unter dem Korpus, auf der Sockelblende (nur mit Sockel)."] },
      pl: { title: "Uchwyty i prawdziwy kształt części w „Pokoju w 3D”", items: ["Uchwyty prętowe pojawiają się na drzwiach i szufladach, w wykończeniu z katalogu (mosiądz/złoto, inox, czarny).", "Części o dowolnym konturze (półki z zaokrąglonym rogiem, panele) rysowane są w swoim dokładnym kształcie.", "Taśma LED pod korpusem, na froncie cokołu (tylko z cokołem)."] },
      es: { title: "Tiradores y forma real de las piezas en la «Habitación en 3D»", items: ["Los tiradores de barra aparecen en puertas y cajones, con el acabado del catálogo (latón/oro, inox, negro).", "Las piezas con contorno libre (baldas con esquina redondeada, paneles) se dibujan con su forma exacta.", "Tira LED bajo el mueble, en la cara del zócalo (solo con zócalo)."] }
    } },
    { v: "5.101.0", date: "2026-11-23", t: {
      en: { title: "LED strips, handle-less doors, gold handles, mirror", items: ["Vertical LED strip on the left or right side of a unit, with the light shown in Room 3D.", "Doors without a handle (push-to-open); the other doors of the unit keep theirs.", "Two brass/gold bar handles (192 and 384 mm), generic, marked as estimates.", "Silvered mirror, 4 mm, as a material."] },
      ro: { title: "Benzi LED, uși fără mâner, mânere aurii, oglindă", items: ["Bandă LED verticală pe lateralul stâng sau drept al unui corp, cu lumina văzută în „Camera în 3D”.", "Uși fără mâner (cu apăsare); celelalte uși ale corpului își păstrează mânerul.", "Două mânere bară alamă/auriu (192 și 384 mm), generice, marcate ca estimare.", "Oglindă argintată de 4 mm, ca material."] },
      it: { title: "Strisce LED, ante senza maniglia, maniglie dorate, specchio", items: ["Striscia LED verticale sul fianco sinistro o destro del mobile, con la luce visibile nella «Stanza in 3D».", "Ante senza maniglia (a pressione); le altre ante del mobile mantengono la loro.", "Due maniglie a barra ottone/oro (192 e 384 mm), generiche, segnate come stima.", "Specchio argentato da 4 mm, come materiale."] },
      fr: { title: "Bandeaux LED, portes sans poignée, poignées dorées, miroir", items: ["Bandeau LED vertical sur le côté gauche ou droit d'un meuble, avec la lumière visible dans la « Pièce en 3D ».", "Portes sans poignée (à pression) ; les autres portes du meuble gardent la leur.", "Deux poignées barre laiton/or (192 et 384 mm), génériques, marquées comme estimation.", "Miroir argenté de 4 mm, comme matériau."] },
      de: { title: "LED-Streifen, Türen ohne Griff, goldene Griffe, Spiegel", items: ["Senkrechter LED-Streifen an der linken oder rechten Seite eines Korpus, das Licht ist im „Raum in 3D“ zu sehen.", "Türen ohne Griff (Push-to-open); die anderen Türen des Korpus behalten ihren.", "Zwei Stangengriffe Messing/Gold (192 und 384 mm), allgemein, als Schätzung gekennzeichnet.", "Silberspiegel, 4 mm, als Material."] },
      pl: { title: "Taśmy LED, drzwi bez uchwytu, złote uchwyty, lustro", items: ["Pionowa taśma LED na lewym lub prawym boku korpusu, ze światłem widocznym w „Pokoju w 3D”.", "Drzwi bez uchwytu (push-to-open); pozostałe drzwi korpusu zachowują swój.", "Dwa uchwyty prętowe mosiądz/złoto (192 i 384 mm), ogólne, oznaczone jako szacunek.", "Lustro srebrzone 4 mm jako materiał."] },
      es: { title: "Tiras LED, puertas sin tirador, tiradores dorados, espejo", items: ["Tira LED vertical en el lateral izquierdo o derecho de un mueble, con la luz visible en la «Habitación en 3D».", "Puertas sin tirador (con pulsación); las demás puertas del mueble conservan el suyo.", "Dos tiradores de barra latón/oro (192 y 384 mm), genéricos, marcados como estimación.", "Espejo plateado de 4 mm, como material."] }
    } },
    { v: "5.99.0", date: "2026-11-22", t: {
      en: { title: "One free sample document", items: ["Without Pro you can print one document of your choice, once per device, with a “free version” watermark. After that, Pro is offered.", "CSV, JPG, STL, DXF, packages and sending stay Pro."] },
      ro: { title: "Un document de probă gratuit", items: ["Fără Pro poți tipări o singură dată, pe dispozitiv, un document la alegere, cu filigranul „versiune gratuită”. După aceea se oferă Pro.", "CSV, JPG, STL, DXF, pachetele și trimiterile rămân Pro."] },
      it: { title: "Un documento di prova gratuito", items: ["Senza Pro puoi stampare una sola volta, per dispositivo, un documento a scelta, con la filigrana «versione gratuita». Poi ti viene proposto Pro.", "CSV, JPG, STL, DXF, pacchetti e invii restano Pro."] },
      fr: { title: "Un document d'essai gratuit", items: ["Sans Pro, vous pouvez imprimer une seule fois par appareil un document de votre choix, avec le filigrane « version gratuite ». Ensuite, Pro vous est proposé.", "CSV, JPG, STL, DXF, packs et envois restent Pro."] },
      de: { title: "Ein kostenloses Probedokument", items: ["Ohne Pro können Sie einmal pro Gerät ein Dokument Ihrer Wahl mit dem Wasserzeichen „Gratisversion“ drucken. Danach wird Pro angeboten.", "CSV, JPG, STL, DXF, Pakete und Versand bleiben Pro."] },
      pl: { title: "Jeden darmowy dokument próbny", items: ["Bez Pro możesz raz na urządzeniu wydrukować jeden dokument do wyboru ze znakiem wodnym „wersja bezpłatna”. Potem zaproponujemy Pro.", "CSV, JPG, STL, DXF, paczki i wysyłka pozostają w Pro."] },
      es: { title: "Un documento de prueba gratis", items: ["Sin Pro puedes imprimir una sola vez por dispositivo un documento a tu elección, con la marca de agua «versión gratuita». Después se ofrece Pro.", "CSV, JPG, STL, DXF, paquetes y envíos siguen siendo Pro."] }
    } },
    { v: "5.98.3", date: "2026-11-22", t: {
      en: { title: "Parts list grouped by function", items: ["With 8 or more parts, the parts list in the Builder has headings: Body, Shelves and dividers, Doors and fronts, Drawers, Other, each with its count.", "Display only: cutting list, drilling, 3D and exports do not change."] },
      ro: { title: "Lista pieselor, grupată pe funcție", items: ["Cu 8 piese sau mai multe, lista de piese din Constructor are antete: Corp, Rafturi și despărțitori, Uși și fronturi, Sertare, Altele, fiecare cu numărul pieselor.", "Numai afișare: distinta, găurirea, 3D-ul și exporturile nu se schimbă."] },
      it: { title: "Elenco pezzi raggruppato per funzione", items: ["Con 8 pezzi o più, l'elenco pezzi nel Costruttore ha delle intestazioni: Corpo, Ripiani e divisori, Ante e frontali, Cassetti, Altro, ognuna con il numero dei pezzi.", "Solo visualizzazione: distinta, foratura, 3D ed esportazioni non cambiano."] },
      fr: { title: "Liste des pièces groupée par fonction", items: ["À partir de 8 pièces, la liste des pièces du Constructeur a des intitulés : Caisson, Étagères et séparations, Portes et façades, Tiroirs, Autres, chacun avec son nombre de pièces.", "Affichage seulement : nomenclature, perçage, 3D et exports ne changent pas."] },
      de: { title: "Teileliste nach Funktion gruppiert", items: ["Ab 8 Teilen hat die Teileliste im Konstruktor Überschriften: Korpus, Böden und Trennwände, Türen und Fronten, Schubladen, Sonstiges, jeweils mit der Teileanzahl.", "Nur Anzeige: Stückliste, Bohrungen, 3D und Exporte bleiben unverändert."] },
      pl: { title: "Lista części pogrupowana według funkcji", items: ["Przy 8 częściach lub więcej lista części w Konstruktorze ma nagłówki: Korpus, Półki i przegrody, Drzwi i fronty, Szuflady, Inne, każdy z liczbą części.", "Tylko wyświetlanie: rozkrój, wiercenia, 3D i eksporty się nie zmieniają."] },
      es: { title: "Lista de piezas agrupada por función", items: ["Con 8 piezas o más, la lista de piezas del Constructor tiene encabezados: Cuerpo, Baldas y divisiones, Puertas y frentes, Cajones, Otros, cada uno con su número de piezas.", "Solo visualización: despiece, taladros, 3D y exportaciones no cambian."] }
    } },
    { v: "5.97.0", date: "2026-11-20", t: {
      en: { title: "Client mode: photos, whole room, extras, send the proposal", items: ["Photos on any material or hardware item, shown to the client.", "New 3D button: “In your room” (with a survey) or “Whole composition”.", "Extras with a separate price: LED, one more shelf, one more drawer.", "“Send proposal” makes a JPG image and opens the phone's share sheet. It is a proposal, not a signed offer."] },
      ro: { title: "Modul Client: poze, camera întreagă, extra, propunerea trimisă", items: ["Poze pe orice material sau articol de feronerie, arătate clientului.", "Buton nou în 3D: „În camera ta” (cu releveu) sau „Toată compoziția”.", "Extra cu preț separat: LED, un raft în plus, un sertar în plus.", "„Trimite propunerea” face o imagine JPG și deschide foaia de partajare a telefonului. E o propunere, nu o ofertă semnată."] },
      it: { title: "Modalità Cliente: foto, stanza intera, extra, proposta inviata", items: ["Foto su qualsiasi materiale o articolo di ferramenta, mostrate al cliente.", "Nuovo pulsante 3D: «Nella tua stanza» (con rilievo) o «Intera composizione».", "Extra con prezzo separato: LED, un ripiano in più, un cassetto in più.", "«Invia la proposta» crea un'immagine JPG e apre il foglio di condivisione del telefono. È una proposta, non un'offerta firmata."] },
      fr: { title: "Mode Client : photos, pièce entière, extras, proposition envoyée", items: ["Photos sur n'importe quel matériau ou article de quincaillerie, montrées au client.", "Nouveau bouton 3D : « Dans votre pièce » (avec relevé) ou « Composition entière ».", "Extras avec prix séparé : LED, une étagère en plus, un tiroir en plus.", "« Envoyer la proposition » crée une image JPG et ouvre la feuille de partage du téléphone. C'est une proposition, pas une offre signée."] },
      de: { title: "Kundenmodus: Fotos, ganzer Raum, Extras, Angebot senden", items: ["Fotos zu jedem Material und jedem Beschlagartikel, dem Kunden gezeigt.", "Neue 3D-Taste: „In Ihrem Raum“ (mit Aufmaß) oder „Ganze Komposition“.", "Extras mit eigenem Preis: LED, ein Boden mehr, eine Schublade mehr.", "„Vorschlag senden“ erstellt ein JPG-Bild und öffnet das Teilen-Menü des Telefons. Es ist ein Vorschlag, kein unterschriebenes Angebot."] },
      pl: { title: "Tryb Klienta: zdjęcia, cały pokój, dodatki, wysłanie propozycji", items: ["Zdjęcia przy każdym materiale i elemencie okuć, pokazywane klientowi.", "Nowy przycisk 3D: „W Twoim pokoju” (z pomiarem) lub „Cała kompozycja”.", "Dodatki z osobną ceną: LED, jedna półka więcej, jedna szuflada więcej.", "„Wyślij propozycję” tworzy obraz JPG i otwiera menu udostępniania telefonu. To propozycja, a nie podpisana oferta."] },
      es: { title: "Modo Cliente: fotos, habitación entera, extras, propuesta enviada", items: ["Fotos en cualquier material o artículo de herrajes, mostradas al cliente.", "Nuevo botón 3D: «En tu habitación» (con medición) o «Toda la composición».", "Extras con precio aparte: LED, una balda más, un cajón más.", "«Enviar la propuesta» crea una imagen JPG y abre el menú de compartir del teléfono. Es una propuesta, no una oferta firmada."] }
    } },
    { v: "5.96.0", date: "2026-11-20", t: {
      en: { title: "Client mode: the client also chooses the hardware", items: ["Hinges, drawer slides and handles, by brand and name, without article codes. Only options that do not move any dimension are offered.", "The price is recalculated, and the choice appears in the signing window and on the offer PDF."] },
      ro: { title: "Modul Client: clientul alege și feroneria", items: ["Balamale, glisiere de sertare și mânere, cu marcă și nume, fără coduri de articol. Se oferă numai ce nu mută nicio cotă.", "Prețul se recalculează, iar alegerea apare în fereastra de semnare și pe PDF-ul ofertei."] },
      it: { title: "Modalità Cliente: il cliente sceglie anche la ferramenta", items: ["Cerniere, guide dei cassetti e maniglie, con marca e nome, senza codici articolo. Si offre solo ciò che non sposta nessuna quota.", "Il prezzo si ricalcola e la scelta compare nella finestra di firma e nel PDF dell'offerta."] },
      fr: { title: "Mode Client : le client choisit aussi la quincaillerie", items: ["Charnières, coulisses de tiroirs et poignées, avec marque et nom, sans codes d'article. Seules les options qui ne déplacent aucune cote sont proposées.", "Le prix est recalculé, et le choix apparaît dans la fenêtre de signature et sur le PDF de l'offre."] },
      de: { title: "Kundenmodus: der Kunde wählt auch die Beschläge", items: ["Scharniere, Schubladenführungen und Griffe, mit Marke und Name, ohne Artikelnummern. Angeboten wird nur, was kein Maß verschiebt.", "Der Preis wird neu berechnet, und die Auswahl erscheint im Unterschriftsfenster und im Angebots-PDF."] },
      pl: { title: "Tryb Klienta: klient wybiera też okucia", items: ["Zawiasy, prowadnice szuflad i uchwyty, z marką i nazwą, bez kodów artykułów. Oferowane jest tylko to, co nie przesuwa żadnego wymiaru.", "Cena jest przeliczana, a wybór widać w oknie podpisu i w PDF oferty."] },
      es: { title: "Modo Cliente: el cliente elige también los herrajes", items: ["Bisagras, guías de cajón y tiradores, con marca y nombre, sin códigos de artículo. Solo se ofrece lo que no mueve ninguna cota.", "El precio se recalcula, y la elección aparece en la ventana de firma y en el PDF de la oferta."] }
    } },
    { v: "5.95.0", date: "2026-11-20", t: {
      en: { title: "Client mode: a presentation with graphics", items: ["Proposal header, 3D on a warm background, and width / height / depth in three cards.", "“How it looks”: a front diagram in the chosen finishes (indicative); “What's included”; “What's next”, without promised dates.", "The price counts from the old figure to the new one."] },
      ro: { title: "Modul Client: prezentare cu grafică", items: ["Antet de propunere, 3D pe fundal cald, lățime / înălțime / adâncime în trei carduri.", "„Cum arată”: schemă a frontului cu finisajele alese (orientativă); „Ce include”; „Ce urmează”, fără termene promise.", "Prețul se numără de la cifra veche la cea nouă."] },
      it: { title: "Modalità Cliente: una presentazione con grafica", items: ["Intestazione di proposta, 3D su sfondo caldo, larghezza / altezza / profondità in tre schede.", "«Come appare»: schema del fronte con le finiture scelte (indicativa); «Cosa include»; «Cosa segue», senza tempi promessi.", "Il prezzo scorre dalla cifra vecchia a quella nuova."] },
      fr: { title: "Mode Client : une présentation avec graphiques", items: ["En-tête de proposition, 3D sur fond chaud, largeur / hauteur / profondeur en trois cartes.", "« Aspect » : schéma de la façade avec les finitions choisies (indicatif) ; « Ce qui est inclus » ; « Et ensuite », sans délais promis.", "Le prix défile de l'ancien chiffre au nouveau."] },
      de: { title: "Kundenmodus: eine Präsentation mit Grafik", items: ["Angebotskopf, 3D auf warmem Hintergrund, Breite / Höhe / Tiefe in drei Karten.", "„So sieht es aus“: Frontschema in den gewählten Oberflächen (unverbindlich); „Was enthalten ist“; „Wie es weitergeht“, ohne versprochene Termine.", "Der Preis zählt von der alten zur neuen Zahl."] },
      pl: { title: "Tryb Klienta: prezentacja z grafiką", items: ["Nagłówek propozycji, 3D na ciepłym tle, szerokość / wysokość / głębokość w trzech kartach.", "„Jak to wygląda”: schemat frontu w wybranych wykończeniach (orientacyjny); „Co zawiera”; „Co dalej”, bez obiecanych terminów.", "Cena przelicza się od starej liczby do nowej."] },
      es: { title: "Modo Cliente: una presentación con gráficos", items: ["Encabezado de propuesta, 3D sobre fondo cálido, ancho / alto / fondo en tres tarjetas.", "«Cómo se ve»: esquema del frente con los acabados elegidos (orientativo); «Qué incluye»; «Qué sigue», sin plazos prometidos.", "El precio cuenta desde la cifra anterior hasta la nueva."] }
    } }
  ];

  function lang(l) { return LANGS.indexOf(l) >= 0 ? l : "en"; }
  function ui(l) { return UI[lang(l)]; }
  function tx(rel, l) { return rel.t[lang(l)]; }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  /* `**x**` → <b>x</b>; nimic altceva nu e markup (ca în ebanist-help.js) */
  function md(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); }
  function plain(s) { return String(s).replace(/\*\*/g, ""); }
  function fmtDate(iso, l) {
    try {
      var p = iso.split("-"), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
      return d.toLocaleDateString(lang(l), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    } catch (e) { return iso; }
  }

  /* HTML-ul foii; prima versiune e deschisă. Linkul spre blog: /<limbă>/blog/ (en: /blog/). */
  function render(l) {
    var U = ui(l), h = "";
    for (var i = 0; i < RELEASES.length; i++) {
      var r = RELEASES[i], c = tx(r, l);
      h += '<details class="hp-item wn-item"' + (i === 0 ? " open" : "") + "><summary><span>" + esc(plain(c.title)) +
        '<small class="wn-ver">' + esc(U.version) + " " + esc(r.v) + " · " + esc(fmtDate(r.date, l)) + "</small></span></summary>" +
        '<div class="hp-in"><ul class="wn-list">';
      for (var j = 0; j < c.items.length; j++) h += "<li>" + md(c.items[j]) + "</li>";
      h += "</ul></div></details>";
    }
    var base = "/" + (lang(l) === "en" ? "" : lang(l) + "/") + "blog/";
    h += '<p class="mini hp-foot">' + esc(U.older) + ' <a href="' + base + '" target="_blank" rel="noopener">' + esc(U.blog) + " ↗</a></p>";
    return h;
  }

  var API = { LANGS: LANGS, UI: UI, RELEASES: RELEASES, ui: ui, tx: tx, esc: esc, md: md, plain: plain, fmtDate: fmtDate, render: render };
  global.EBWhatsNew = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
