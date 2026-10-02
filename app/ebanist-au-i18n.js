/* =====================================================================
   Ebanist — i messaggi delle verifiche di coerenza, nella lingua scelta.
   ---------------------------------------------------------------------
   Il nucleo (ebanist-core.js) scrive il PERCHE di ogni regola in romeno,
   ed e giusto che resti cosi: e puro, gira anche nei test, e i suoi testi
   sono la fonte. Ma la foglia di chiusura e la foglia di verifica li
   mostravano tali e quali anche a chi usa l'app in inglese, italiano o
   francese.

   Qui c'e la traduzione, indicizzata dal testo romeno ESATTO del nucleo.
   Niente codici nuovi nel nucleo, niente cote toccate. Le chiavi che
   finiscono con «: » sono prefissi: il nucleo ci attacca un dettaglio
   (i pezzi, il messaggio di errore) che si lascia com'e.

   test/au-i18n.test.js controlla che OGNI testo del nucleo abbia la sua
   traduzione in it, en, fr: una regola nuova senza traduzione non passa.
   ===================================================================== */
var AU_I18N = {
it: {
  /* --- chiusura del gabarito (Fase 2) --- */
  "Adâncimea recompusă din laterală (plus spatele, dacă e aplicat) nu dă adâncimea nominală a corpului.":
    "La profondità ricomposta dal fianco (più lo schienale, se applicato) non dà la profondità nominale del corpo.",
  "Adâncimea recompusă din bază/tavan nu dă adâncimea nominală: fie baza e prea scurtă, fie spatele nu se scade coerent.":
    "La profondità ricomposta da base/cielo non dà quella nominale: o la base è troppo corta, o lo schienale non viene sottratto in modo coerente.",
  "Lățimea recompusă din bază plus cele două laterale nu dă lățimea nominală.":
    "La larghezza ricomposta dalla base più i due fianchi non dà la larghezza nominale.",
  "Lățimea recompusă din spate nu dă lățimea nominală: spatele nu se potrivește între laterale.":
    "La larghezza ricomposta dallo schienale non dà quella nominale: lo schienale non entra giusto fra i fianchi.",
  "Înălțimea recompusă din laterală (plus picioarele) nu dă înălțimea nominală.":
    "L'altezza ricomposta dal fianco (più i piedini) non dà l'altezza nominale.",
  "Înălțimea recompusă dinăuntru (soclu + bază + lumina interioară + tavan) nu dă înălțimea nominală.":
    "L'altezza ricomposta dall'interno (zoccolo + base + luce interna + cielo) non dà l'altezza nominale.",
  "Distinta e generată înainte de controlul de închidere: piesele nu poartă grosimea lor. S-a folosit grosimea materialului rolului. Regenerează distinta.":
    "Distinta generata prima del controllo di chiusura: i pezzi non portano la loro grossezza. È stata usata quella del materiale del ruolo. Rigenera la distinta.",
  /* --- invarianti per ruolo (Fase 3) --- */
  "Spate aplicat: laterala trebuie scurtata cu grosimea spatelui, altfel corpul iese mai adânc decât nominalul.":
    "Schienale applicato: il fianco va accorciato della grossezza dello schienale, altrimenti il corpo esce più profondo del nominale.",
  "Spate încastrat: laterala merge până la planul din spate, nu se scurtează.":
    "Schienale incassato: il fianco arriva fino al piano posteriore, non si accorcia.",
  "Spate încastrat: intră între laterale, deci e mai îngust cu două grosimi de laterală.":
    "Schienale incassato: entra fra i fianchi, quindi è più stretto di due grossezze di fianco.",
  "O poliță cade în afara golului sau peste alta: una dintre luminile interioare e nulă sau negativă.":
    "Un ripiano cade fuori dal vano o sopra un altro: una delle luci interne è nulla o negativa.",
  "Pila verticală — soclu, bază, polițe, tavan — nu închide înălțimea corpului.":
    "La pila verticale — zoccolo, base, ripiani, cielo — non chiude l'altezza del corpo.",
  "Ușile au cote absolute (x, y, l, h): se verifică în validateLayout, nu prin suma lățimilor.":
    "Le ante hanno cote assolute (x, y, l, h): si verificano nella disposizione, non con la somma delle larghezze.",
  "Ușile glisante se suprapun, nu se acostează: suma lățimilor e mai mare decât deschiderea, și e corect așa.":
    "Le ante scorrevoli si sovrappongono, non si accostano: la somma delle larghezze supera l'apertura, ed è giusto così.",
  "Ușa cu ramă și sticlă nu iese ca o piesă: ies montanții și traversele, late de 70 mm, nu cât ușa.":
    "L'anta a telaio e vetro non esce come un pezzo: escono montanti e traversi, larghi 70 mm, non quanto l'anta.",
  "Fronturile plus jocurile nu acoperă exact deschiderea: fie se ating, fie lasă un gol.":
    "Frontali più giochi non coprono esattamente l'apertura: o si toccano, o lasciano un vuoto.",
  "Sertarul e mai adânc decât lasă ghidajul ales: nu intră până la capăt.":
    "Il cassetto è più profondo di quanto permette la guida scelta: non entra fino in fondo.",
  "Polița e mai adâncă decât lasă retrasarea: ajunge la fața corpului.":
    "Il ripiano è più profondo di quanto permette l'arretramento: arriva al filo del corpo.",
  "Polița nu are jocul declarat: fie freacă în laterale, fie joacă în gol.":
    "Il ripiano non ha il gioco dichiarato: o sfrega sui fianchi, o balla.",
  "Piese cu o cotă nulă, negativă sau mai mare decât placa: nu se pot tăia.":
    "Pezzi con una cota nulla, negativa o più grande del pannello: non si possono tagliare.",
  "Grosimea scrisă pe piesă nu e cea a materialului rolului: ":
    "La grossezza scritta sul pezzo non è quella del materiale del ruolo: ",
  "Grosimea fiecărei piese e cea a materialului alocat rolului ei.":
    "La grossezza di ogni pezzo è quella del materiale assegnato al suo ruolo.",
  "O grosime care nu apare în niciun material al proiectului nu vine dintr-un material: vine din cod.":
    "Una grossezza che non compare in nessun materiale del progetto non viene da un materiale: viene dal codice.",
  /* --- asserzioni (Fase 3, dati) --- */
  "Nu se pot citi cotele pentru verificare: ":
    "Impossibile leggere le cote per la verifica: ",
  "Falțul pentru spate trebuie să fie exact grosimea spatelui, altfel spatele iese din planul lateralei.":
    "La battuta per lo schienale deve essere esattamente la grossezza dello schienale, altrimenti lo schienale esce dal piano del fianco.",
  "Spatele e mai lung decât corpul: nu intră între laterale.":
    "Lo schienale è più lungo del corpo: non entra fra i fianchi.",
  "Ușile nu acoperă exact deschiderea: fie se ating între ele, fie lasă un gol pe o parte.":
    "Le ante non coprono esattamente l'apertura: o si toccano fra loro, o lasciano un vuoto da un lato.",
  "Ușa freacă zoccolo-ul, picioarele sau tavanul corpului: înălțimea ei nu se închide cu jocurile declarate.":
    "L'anta sfrega su zoccolo, piedini o cielo del corpo: la sua altezza non chiude con i giochi dichiarati.",
  "Joc zero între fronturi: la prima variație de umiditate ușile se blochează una în alta.":
    "Gioco zero fra i frontali: alla prima variazione di umidità le ante si bloccano l'una contro l'altra.",
  "Suprapunerea ușii e mai mare decât grosimea lateralei: ușa nu are pe ce să se așeze.":
    "La sovrapposizione dell'anta supera la grossezza del fianco: l'anta non ha dove appoggiare.",
  "Picioare și laterale până la pardoseală în același timp: corpul se sprijină pe laterale, iar picioarele nu ating solul.":
    "Piedini e fianchi fino a terra insieme: il corpo poggia sui fianchi e i piedini non toccano il pavimento.",
  "O cotă de găurire nu poate fi un interval („3–6 mm\"): mașina trebuie să primească un singur număr.":
    "Una cota di foratura non può essere un intervallo («3–6 mm»): la macchina deve ricevere un solo numero.",
  "O piesă are o cotă mai mare decât corpul din care provine: nu e legată de niciun gabarit.":
    "Un pezzo ha una cota più grande del corpo da cui viene: non è legato a nessun ingombro.",
  "O piesă e mai mare decât placa din care se debitează: nu se poate tăia.":
    "Un pezzo è più grande del pannello da cui si taglia: non si può tagliare.",
  "Aria netă amestecă materiale diferite: metrii pătrați trebuie raportați grupat pe material.":
    "L'area netta mescola materiali diversi: i metri quadri vanno riportati raggruppati per materiale.",
  "Cele două laterale sunt împreună mai groase decât lățimea corpului: nu mai rămâne lumină interioară.":
    "I due fianchi insieme sono più spessi della larghezza del corpo: non resta luce interna.",
  "Baza, tavanul și zoccolo-ul ocupă toată înălțimea corpului: nu mai rămâne nimic înăuntru.":
    "Base, cielo e zoccolo occupano tutta l'altezza del corpo: dentro non resta niente.",
  "Spatele ocupă toată adâncimea corpului: nu mai rămâne adâncime utilă.":
    "Lo schienale occupa tutta la profondità del corpo: non resta profondità utile.",
  "Retrasarea poliței depășește adâncimea utilă, sau jocul depășește lățimea: polița iese cu cotă negativă.":
    "L'arretramento del ripiano supera la profondità utile, o il gioco supera la larghezza: il ripiano esce con cota negativa.",
  "Jocurile declarate depășesc gabaritul: ușa iese cu cotă zero sau negativă.":
    "I giochi dichiarati superano l'ingombro: l'anta esce con cota zero o negativa.",
  "Tramezzii sunt împreună mai groși decât lumina interioară: nu mai rămâne nicio secțiune.":
    "I tramezzi insieme sono più spessi della luce interna: non resta nessuna sezione.",
  "Rezerva glisierei depășește adâncimea utilă: sertarul nu are unde să intre.":
    "La riserva della guida supera la profondità utile: il cassetto non ha dove entrare.",
  /* --- fonti delle asserzioni --- */
  "Jacquin rev.B — falț 18 mm, spate 19 mm": "Jacquin rev.B — battuta 18 mm, schienale 19 mm",
  "Jacquin rev.C — două uși de 495 cu rost de 4": "Jacquin rev.C — due ante da 495 con fuga di 4",
  "Jacquin rev.C — ușă 1993 pe corp 2078, zoccolo 79": "Jacquin rev.C — anta 1993 su corpo 2078, zoccolo 79",
  "Blum — joc minim de montaj": "Blum — gioco minimo di montaggio",
  "Blum CLIP top — suprapunere maximă": "Blum CLIP top — sovrapposizione massima",
  "regulă de montaj": "regola di montaggio",
  "Jacquin rev.C — prof. 12,5 mm, distanță de la cant 5,0 mm": "Jacquin rev.C — prof. 12,5 mm, distanza dal bordo 5,0 mm",
  "auditul v4.24": "audit v4.24",
  "format placă din setările proiectului": "formato pannello dalle impostazioni del progetto",
  "grosime derivată din material (v4.27)": "grossezza derivata dal materiale (v4.27)",
  "catalog glisiere (v4.27)": "catalogo guide (v4.27)"
},
en: {
  "Adâncimea recompusă din laterală (plus spatele, dacă e aplicat) nu dă adâncimea nominală a corpului.":
    "The depth rebuilt from the side (plus the back, if surface-mounted) does not give the nominal depth of the carcass.",
  "Adâncimea recompusă din bază/tavan nu dă adâncimea nominală: fie baza e prea scurtă, fie spatele nu se scade coerent.":
    "The depth rebuilt from the bottom/top does not give the nominal depth: either the bottom is too short or the back is not deducted consistently.",
  "Lățimea recompusă din bază plus cele două laterale nu dă lățimea nominală.":
    "The width rebuilt from the bottom plus the two sides does not give the nominal width.",
  "Lățimea recompusă din spate nu dă lățimea nominală: spatele nu se potrivește între laterale.":
    "The width rebuilt from the back does not give the nominal width: the back does not fit between the sides.",
  "Înălțimea recompusă din laterală (plus picioarele) nu dă înălțimea nominală.":
    "The height rebuilt from the side (plus the feet) does not give the nominal height.",
  "Înălțimea recompusă dinăuntru (soclu + bază + lumina interioară + tavan) nu dă înălțimea nominală.":
    "The height rebuilt from inside (plinth + bottom + inner opening + top) does not give the nominal height.",
  "Distinta e generată înainte de controlul de închidere: piesele nu poartă grosimea lor. S-a folosit grosimea materialului rolului. Regenerează distinta.":
    "Cut list generated before the closure check: the parts do not carry their thickness. The thickness of the role's material was used. Regenerate the cut list.",
  "Spate aplicat: laterala trebuie scurtata cu grosimea spatelui, altfel corpul iese mai adânc decât nominalul.":
    "Surface-mounted back: the side must be shortened by the back's thickness, otherwise the carcass comes out deeper than nominal.",
  "Spate încastrat: laterala merge până la planul din spate, nu se scurtează.":
    "Inset back: the side runs to the rear plane and is not shortened.",
  "Spate încastrat: intră între laterale, deci e mai îngust cu două grosimi de laterală.":
    "Inset back: it fits between the sides, so it is narrower by two side thicknesses.",
  "O poliță cade în afara golului sau peste alta: una dintre luminile interioare e nulă sau negativă.":
    "A shelf falls outside the opening or onto another one: one of the inner openings is zero or negative.",
  "Pila verticală — soclu, bază, polițe, tavan — nu închide înălțimea corpului.":
    "The vertical stack (plinth, bottom, shelves, top) does not add up to the carcass height.",
  "Ușile au cote absolute (x, y, l, h): se verifică în validateLayout, nu prin suma lățimilor.":
    "The doors have absolute positions (x, y, w, h): they are checked in the layout, not by summing their widths.",
  "Ușile glisante se suprapun, nu se acostează: suma lățimilor e mai mare decât deschiderea, și e corect așa.":
    "Sliding doors overlap rather than meet: their widths add up to more than the opening, and that is correct.",
  "Ușa cu ramă și sticlă nu iese ca o piesă: ies montanții și traversele, late de 70 mm, nu cât ușa.":
    "A framed glass door is not one part: it is made of stiles and rails 70 mm wide, not a door-sized panel.",
  "Fronturile plus jocurile nu acoperă exact deschiderea: fie se ating, fie lasă un gol.":
    "Fronts plus gaps do not cover the opening exactly: either they touch or they leave a gap.",
  "Sertarul e mai adânc decât lasă ghidajul ales: nu intră până la capăt.":
    "The drawer is deeper than the chosen runner allows: it does not close fully.",
  "Polița e mai adâncă decât lasă retrasarea: ajunge la fața corpului.":
    "The shelf is deeper than the setback allows: it reaches the front edge of the carcass.",
  "Polița nu are jocul declarat: fie freacă în laterale, fie joacă în gol.":
    "The shelf does not have the declared clearance: either it rubs on the sides or it is loose.",
  "Piese cu o cotă nulă, negativă sau mai mare decât placa: nu se pot tăia.":
    "Parts with a zero or negative size, or larger than the board: they cannot be cut.",
  "Grosimea scrisă pe piesă nu e cea a materialului rolului: ":
    "The thickness written on the part is not that of the role's material: ",
  "Grosimea fiecărei piese e cea a materialului alocat rolului ei.":
    "Every part has the thickness of the material assigned to its role.",
  "O grosime care nu apare în niciun material al proiectului nu vine dintr-un material: vine din cod.":
    "A thickness that is not in any of the project's materials does not come from a material: it comes from the code.",
  "Nu se pot citi cotele pentru verificare: ":
    "The sizes cannot be read for checking: ",
  "Falțul pentru spate trebuie să fie exact grosimea spatelui, altfel spatele iese din planul lateralei.":
    "The rebate for the back must be exactly the back's thickness, otherwise the back sticks out of the side's plane.",
  "Spatele e mai lung decât corpul: nu intră între laterale.":
    "The back is longer than the carcass: it does not fit between the sides.",
  "Ușile nu acoperă exact deschiderea: fie se ating între ele, fie lasă un gol pe o parte.":
    "The doors do not cover the opening exactly: either they touch each other or they leave a gap on one side.",
  "Ușa freacă zoccolo-ul, picioarele sau tavanul corpului: înălțimea ei nu se închide cu jocurile declarate.":
    "The door rubs on the plinth, the feet or the top: its height does not add up with the declared gaps.",
  "Joc zero între fronturi: la prima variație de umiditate ușile se blochează una în alta.":
    "Zero gap between fronts: at the first change in humidity the doors jam against each other.",
  "Suprapunerea ușii e mai mare decât grosimea lateralei: ușa nu are pe ce să se așeze.":
    "The door overlay is larger than the side's thickness: the door has nothing to rest on.",
  "Picioare și laterale până la pardoseală în același timp: corpul se sprijină pe laterale, iar picioarele nu ating solul.":
    "Feet and full-height sides at the same time: the carcass stands on the sides and the feet do not touch the floor.",
  "O cotă de găurire nu poate fi un interval („3–6 mm\"): mașina trebuie să primească un singur număr.":
    "A drilling dimension cannot be a range (\"3–6 mm\"): the machine needs a single number.",
  "O piesă are o cotă mai mare decât corpul din care provine: nu e legată de niciun gabarit.":
    "A part has a size larger than the carcass it belongs to: it is not tied to any overall size.",
  "O piesă e mai mare decât placa din care se debitează: nu se poate tăia.":
    "A part is larger than the board it is cut from: it cannot be cut.",
  "Aria netă amestecă materiale diferite: metrii pătrați trebuie raportați grupat pe material.":
    "The net area mixes different materials: square metres must be reported per material.",
  "Cele două laterale sunt împreună mai groase decât lățimea corpului: nu mai rămâne lumină interioară.":
    "The two sides together are thicker than the carcass width: there is no inner opening left.",
  "Baza, tavanul și zoccolo-ul ocupă toată înălțimea corpului: nu mai rămâne nimic înăuntru.":
    "Bottom, top and plinth take up the whole carcass height: nothing is left inside.",
  "Spatele ocupă toată adâncimea corpului: nu mai rămâne adâncime utilă.":
    "The back takes up the whole carcass depth: no usable depth is left.",
  "Retrasarea poliței depășește adâncimea utilă, sau jocul depășește lățimea: polița iese cu cotă negativă.":
    "The shelf setback exceeds the usable depth, or the clearance exceeds the width: the shelf comes out with a negative size.",
  "Jocurile declarate depășesc gabaritul: ușa iese cu cotă zero sau negativă.":
    "The declared gaps exceed the overall size: the door comes out with a zero or negative size.",
  "Tramezzii sunt împreună mai groși decât lumina interioară: nu mai rămâne nicio secțiune.":
    "The dividers together are thicker than the inner opening: no section is left.",
  "Rezerva glisierei depășește adâncimea utilă: sertarul nu are unde să intre.":
    "The runner allowance exceeds the usable depth: the drawer has no room.",
  "Jacquin rev.B — falț 18 mm, spate 19 mm": "Jacquin rev.B: 18 mm rebate, 19 mm back",
  "Jacquin rev.C — două uși de 495 cu rost de 4": "Jacquin rev.C: two 495 doors with a 4 mm gap",
  "Jacquin rev.C — ușă 1993 pe corp 2078, zoccolo 79": "Jacquin rev.C: 1993 door on a 2078 carcass, 79 plinth",
  "Blum — joc minim de montaj": "Blum: minimum fitting gap",
  "Blum CLIP top — suprapunere maximă": "Blum CLIP top: maximum overlay",
  "regulă de montaj": "fitting rule",
  "Jacquin rev.C — prof. 12,5 mm, distanță de la cant 5,0 mm": "Jacquin rev.C: 12.5 mm deep, 5.0 mm from the edge",
  "auditul v4.24": "v4.24 audit",
  "format placă din setările proiectului": "board size from the project settings",
  "grosime derivată din material (v4.27)": "thickness from the material (v4.27)",
  "catalog glisiere (v4.27)": "runner catalogue (v4.27)"
},
fr: {
  "Adâncimea recompusă din laterală (plus spatele, dacă e aplicat) nu dă adâncimea nominală a corpului.":
    "La profondeur recomposée à partir du côté (plus le fond, s'il est rapporté) ne donne pas la profondeur nominale du caisson.",
  "Adâncimea recompusă din bază/tavan nu dă adâncimea nominală: fie baza e prea scurtă, fie spatele nu se scade coerent.":
    "La profondeur recomposée à partir du dessous/dessus ne donne pas la profondeur nominale : soit le dessous est trop court, soit le fond n'est pas déduit de façon cohérente.",
  "Lățimea recompusă din bază plus cele două laterale nu dă lățimea nominală.":
    "La largeur recomposée à partir du dessous et des deux côtés ne donne pas la largeur nominale.",
  "Lățimea recompusă din spate nu dă lățimea nominală: spatele nu se potrivește între laterale.":
    "La largeur recomposée à partir du fond ne donne pas la largeur nominale : le fond ne s'ajuste pas entre les côtés.",
  "Înălțimea recompusă din laterală (plus picioarele) nu dă înălțimea nominală.":
    "La hauteur recomposée à partir du côté (plus les pieds) ne donne pas la hauteur nominale.",
  "Înălțimea recompusă dinăuntru (soclu + bază + lumina interioară + tavan) nu dă înălțimea nominală.":
    "La hauteur recomposée de l'intérieur (socle + dessous + vide intérieur + dessus) ne donne pas la hauteur nominale.",
  "Distinta e generată înainte de controlul de închidere: piesele nu poartă grosimea lor. S-a folosit grosimea materialului rolului. Regenerează distinta.":
    "Fiche de débit générée avant le contrôle de fermeture : les pièces ne portent pas leur épaisseur. L'épaisseur du matériau du rôle a été utilisée. Régénérez la fiche de débit.",
  "Spate aplicat: laterala trebuie scurtata cu grosimea spatelui, altfel corpul iese mai adânc decât nominalul.":
    "Fond rapporté : le côté doit être raccourci de l'épaisseur du fond, sinon le caisson sort plus profond que le nominal.",
  "Spate încastrat: laterala merge până la planul din spate, nu se scurtează.":
    "Fond encastré : le côté va jusqu'au plan arrière, il n'est pas raccourci.",
  "Spate încastrat: intră între laterale, deci e mai îngust cu două grosimi de laterală.":
    "Fond encastré : il entre entre les côtés, il est donc plus étroit de deux épaisseurs de côté.",
  "O poliță cade în afara golului sau peste alta: una dintre luminile interioare e nulă sau negativă.":
    "Une étagère tombe hors du vide ou sur une autre : un des vides intérieurs est nul ou négatif.",
  "Pila verticală — soclu, bază, polițe, tavan — nu închide înălțimea corpului.":
    "L'empilement vertical (socle, dessous, étagères, dessus) ne referme pas la hauteur du caisson.",
  "Ușile au cote absolute (x, y, l, h): se verifică în validateLayout, nu prin suma lățimilor.":
    "Les portes ont des cotes absolues (x, y, l, h) : elles se vérifient dans la disposition, pas par la somme des largeurs.",
  "Ușile glisante se suprapun, nu se acostează: suma lățimilor e mai mare decât deschiderea, și e corect așa.":
    "Les portes coulissantes se chevauchent, elles ne se jouxtent pas : la somme des largeurs dépasse l'ouverture, et c'est normal.",
  "Ușa cu ramă și sticlă nu iese ca o piesă: ies montanții și traversele, late de 70 mm, nu cât ușa.":
    "La porte à cadre et verre n'est pas une pièce : elle donne des montants et traverses de 70 mm de large, pas un panneau de la taille de la porte.",
  "Fronturile plus jocurile nu acoperă exact deschiderea: fie se ating, fie lasă un gol.":
    "Les façades plus les jeux ne couvrent pas exactement l'ouverture : soit elles se touchent, soit elles laissent un vide.",
  "Sertarul e mai adânc decât lasă ghidajul ales: nu intră până la capăt.":
    "Le tiroir est plus profond que la coulisse choisie ne le permet : il ne rentre pas jusqu'au bout.",
  "Polița e mai adâncă decât lasă retrasarea: ajunge la fața corpului.":
    "L'étagère est plus profonde que le retrait ne le permet : elle arrive au nu du caisson.",
  "Polița nu are jocul declarat: fie freacă în laterale, fie joacă în gol.":
    "L'étagère n'a pas le jeu déclaré : soit elle frotte sur les côtés, soit elle a du jeu.",
  "Piese cu o cotă nulă, negativă sau mai mare decât placa: nu se pot tăia.":
    "Pièces avec une cote nulle, négative ou plus grande que le panneau : elles ne peuvent pas être découpées.",
  "Grosimea scrisă pe piesă nu e cea a materialului rolului: ":
    "L'épaisseur écrite sur la pièce n'est pas celle du matériau du rôle : ",
  "Grosimea fiecărei piese e cea a materialului alocat rolului ei.":
    "L'épaisseur de chaque pièce est celle du matériau attribué à son rôle.",
  "O grosime care nu apare în niciun material al proiectului nu vine dintr-un material: vine din cod.":
    "Une épaisseur absente de tous les matériaux du projet ne vient pas d'un matériau : elle vient du code.",
  "Nu se pot citi cotele pentru verificare: ":
    "Impossible de lire les cotes pour la vérification : ",
  "Falțul pentru spate trebuie să fie exact grosimea spatelui, altfel spatele iese din planul lateralei.":
    "La feuillure du fond doit faire exactement l'épaisseur du fond, sinon le fond dépasse du plan du côté.",
  "Spatele e mai lung decât corpul: nu intră între laterale.":
    "Le fond est plus long que le caisson : il n'entre pas entre les côtés.",
  "Ușile nu acoperă exact deschiderea: fie se ating între ele, fie lasă un gol pe o parte.":
    "Les portes ne couvrent pas exactement l'ouverture : soit elles se touchent, soit elles laissent un vide d'un côté.",
  "Ușa freacă zoccolo-ul, picioarele sau tavanul corpului: înălțimea ei nu se închide cu jocurile declarate.":
    "La porte frotte sur le socle, les pieds ou le dessus : sa hauteur ne tombe pas juste avec les jeux déclarés.",
  "Joc zero între fronturi: la prima variație de umiditate ușile se blochează una în alta.":
    "Jeu nul entre façades : à la première variation d'humidité, les portes se bloquent l'une contre l'autre.",
  "Suprapunerea ușii e mai mare decât grosimea lateralei: ușa nu are pe ce să se așeze.":
    "Le recouvrement de la porte dépasse l'épaisseur du côté : la porte n'a pas d'appui.",
  "Picioare și laterale până la pardoseală în același timp: corpul se sprijină pe laterale, iar picioarele nu ating solul.":
    "Pieds et côtés jusqu'au sol en même temps : le caisson repose sur les côtés et les pieds ne touchent pas le sol.",
  "O cotă de găurire nu poate fi un interval („3–6 mm\"): mașina trebuie să primească un singur număr.":
    "Une cote de perçage ne peut pas être un intervalle (« 3–6 mm ») : la machine doit recevoir un seul nombre.",
  "O piesă are o cotă mai mare decât corpul din care provine: nu e legată de niciun gabarit.":
    "Une pièce a une cote plus grande que le caisson dont elle vient : elle n'est liée à aucun gabarit.",
  "O piesă e mai mare decât placa din care se debitează: nu se poate tăia.":
    "Une pièce est plus grande que le panneau dans lequel elle est débitée : elle ne peut pas être découpée.",
  "Aria netă amestecă materiale diferite: metrii pătrați trebuie raportați grupat pe material.":
    "La surface nette mélange des matériaux différents : les mètres carrés doivent être regroupés par matériau.",
  "Cele două laterale sunt împreună mai groase decât lățimea corpului: nu mai rămâne lumină interioară.":
    "Les deux côtés ensemble sont plus épais que la largeur du caisson : il ne reste aucun vide intérieur.",
  "Baza, tavanul și zoccolo-ul ocupă toată înălțimea corpului: nu mai rămâne nimic înăuntru.":
    "Dessous, dessus et socle occupent toute la hauteur du caisson : il ne reste rien à l'intérieur.",
  "Spatele ocupă toată adâncimea corpului: nu mai rămâne adâncime utilă.":
    "Le fond occupe toute la profondeur du caisson : il ne reste aucune profondeur utile.",
  "Retrasarea poliței depășește adâncimea utilă, sau jocul depășește lățimea: polița iese cu cotă negativă.":
    "Le retrait de l'étagère dépasse la profondeur utile, ou le jeu dépasse la largeur : l'étagère sort avec une cote négative.",
  "Jocurile declarate depășesc gabaritul: ușa iese cu cotă zero sau negativă.":
    "Les jeux déclarés dépassent le gabarit : la porte sort avec une cote nulle ou négative.",
  "Tramezzii sunt împreună mai groși decât lumina interioară: nu mai rămâne nicio secțiune.":
    "Les séparations ensemble sont plus épaisses que le vide intérieur : il ne reste aucune section.",
  "Rezerva glisierei depășește adâncimea utilă: sertarul nu are unde să intre.":
    "La réserve de la coulisse dépasse la profondeur utile : le tiroir n'a pas de place.",
  "Jacquin rev.B — falț 18 mm, spate 19 mm": "Jacquin rév.B : feuillure 18 mm, fond 19 mm",
  "Jacquin rev.C — două uși de 495 cu rost de 4": "Jacquin rév.C : deux portes de 495 avec un joint de 4",
  "Jacquin rev.C — ușă 1993 pe corp 2078, zoccolo 79": "Jacquin rév.C : porte 1993 sur caisson 2078, socle 79",
  "Blum — joc minim de montaj": "Blum : jeu minimal de montage",
  "Blum CLIP top — suprapunere maximă": "Blum CLIP top : recouvrement maximal",
  "regulă de montaj": "règle de montage",
  "Jacquin rev.C — prof. 12,5 mm, distanță de la cant 5,0 mm": "Jacquin rév.C : prof. 12,5 mm, à 5,0 mm du chant",
  "auditul v4.24": "audit v4.24",
  "format placă din setările proiectului": "format de panneau des réglages du projet",
  "grosime derivată din material (v4.27)": "épaisseur issue du matériau (v4.27)",
  "catalog glisiere (v4.27)": "catalogue coulisses (v4.27)"
}
};

/* Il testo del nucleo nella lingua `lang`. Il romeno, e qualunque testo
   che non e nella tabella, passa com'e: meglio la frase originale che
   niente. Puro, per poterlo provare fuori dal browser. */
function auTx(s, lang) {
  if (!s || !lang || lang === "ro") return s;
  var D = AU_I18N[lang];
  if (!D) return s;
  if (Object.prototype.hasOwnProperty.call(D, s)) return D[s];
  for (var k in D) {
    if (k.slice(-2) === ": " && s.indexOf(k) === 0) return D[k] + s.slice(k.length);
  }
  return s;
}

if (typeof module !== "undefined" && module.exports) module.exports = { AU_I18N: AU_I18N, auTx: auTx };
