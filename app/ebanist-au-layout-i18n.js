/* =====================================================================
   Ebanist — mesajele validatorilor de cote absolute și de spate/rinforzo/filler
   (`validateLayout`, `validateFit`), în limba interfeței.

   Textele nucleului sunt compuse cu valori (`fmt01`, numere de piese), deci
   nu se pot traduce prin potrivire exactă ca în AU_I18N. Aici fiecare mesaj
   e un TIPAR scris în română exact ca în nucleu, cu `{}` în locul valorii;
   traducerea refolosește valorile ca {1}, {2}… Nucleul nu se atinge.

   Etichetele de piesă din valori («ripiano 2», «decupaj spate 1») se traduc
   separat, cu `AU_NOUN`. Limbile fără tipare proprii (de, pl, es) primesc
   engleza, nu româna.

   test/au-layout-i18n.test.js verifică acoperirea: fiecare fragment de text
   din `errors.push` al nucleului apare într-un tipar.
   ===================================================================== */
var AU_NOUN = {
  it: { "decupaj spate": "foro nel retro", decupaj: "taglio", setto: "setto", ripiano: "ripiano", anta: "anta", sertare: "cassetti",
        rinforzo: "rinforzo", grila: "griglia", filler: "filler", zona: "zona", coloana: "colonna", base: "base", cielo: "cielo" },
  en: { "decupaj spate": "back cutout", decupaj: "cutout", setto: "divider", ripiano: "shelf", anta: "door", sertare: "drawers",
        rinforzo: "back rail", grila: "vent", filler: "filler", zona: "zone", coloana: "column", base: "bottom", cielo: "top" },
  fr: { "decupaj spate": "découpe du fond", decupaj: "découpe", setto: "séparateur", ripiano: "étagère", anta: "porte", sertare: "tiroirs",
        rinforzo: "traverse de renfort", grila: "grille", filler: "filler", zona: "zone", coloana: "colonne", base: "fond", cielo: "dessus" }
};

/* [română (nucleu), it, en, fr] — cele specifice înaintea celor generale */
var AU_PAT_ROWS = [
  ["profilul de adâncime e gol", "il profilo di profondità è vuoto", "the depth profile is empty", "le profil de profondeur est vide"],
  ["zona {}: yFrom, yTo și depth trebuie să fie numere", "zona {1}: yFrom, yTo e depth devono essere numeri", "zone {1}: yFrom, yTo and depth must be numbers", "zone {1} : yFrom, yTo et depth doivent être des nombres"],
  ["zona {}: yTo ({}) ≤ yFrom ({})", "zona {1}: yTo ({2}) ≤ yFrom ({3})", "zone {1}: yTo ({2}) ≤ yFrom ({3})", "zone {1} : yTo ({2}) ≤ yFrom ({3})"],
  ["zona {}: adâncime {} ≤ 0", "zona {1}: profondità {2} ≤ 0", "zone {1}: depth {2} ≤ 0", "zone {1} : profondeur {2} ≤ 0"],
  ["prima zonă începe la {}, nu la 0 (pardoseala)", "la prima zona inizia a {1}, non a 0 (pavimento)", "the first zone starts at {1}, not at 0 (floor)", "la première zone commence à {1}, pas à 0 (sol)"],
  ["zonele {} și {} nu se ating: {} ≠ {}", "le zone {1} e {2} non si toccano: {3} ≠ {4}", "zones {1} and {2} do not touch: {3} ≠ {4}", "les zones {1} et {2} ne se touchent pas : {3} ≠ {4}"],
  ["ultima zonă se termină la {}, nu la H = {}", "l'ultima zona finisce a {1}, non a H = {2}", "the last zone ends at {1}, not at H = {2}", "la dernière zone finit à {1}, pas à H = {2}"],
  ["P = {} dar adâncimea maximă din profil e {}", "P = {1} ma la profondità massima del profilo è {2}", "P = {1} but the maximum depth in the profile is {2}", "P = {1} mais la profondeur maximale du profil est {2}"],
  ["profil nesuportat: e acceptată o singură treaptă, jos (zona de jos mai puțin adâncă). Profilul are {} zone: {}",
   "profilo non supportato: è accettato un solo gradino, in basso (la zona bassa meno profonda). Il profilo ha {1} zone: {2}",
   "unsupported profile: only one step is accepted, at the bottom (the lower zone is shallower). The profile has {1} zones: {2}",
   "profil non pris en charge : une seule marche est acceptée, en bas (la zone basse moins profonde). Le profil a {1} zones : {2}"],
  ["partiția {}: tip necunoscut {}", "partizione {1}: tipo sconosciuto {2}", "partition {1}: unknown type {2}", "cloison {1} : type inconnu {2}"],
  ["{}: x / yStart / yEnd nu sunt numere", "{1}: x / yStart / yEnd non sono numeri", "{1}: x / yStart / yEnd are not numbers", "{1} : x / yStart / yEnd ne sont pas des nombres"],
  ["{}: x = {} iese din lumina interioară ({}–{})", "{1}: x = {2} esce dalla luce interna ({3}–{4})", "{1}: x = {2} is outside the inner opening ({3}–{4})", "{1} : x = {2} sort de la lumière intérieure ({3}–{4})"],
  ["{}: pornește la {}, sub fața bazei ({})", "{1}: parte da {2}, sotto la faccia della base ({3})", "{1}: starts at {2}, below the face of the bottom ({3})", "{1} : commence à {2}, sous la face du fond ({3})"],
  ["{}: se oprește la {}, peste fața tavanului ({})", "{1}: si ferma a {2}, sopra la faccia del cielo ({3})", "{1}: stops at {2}, above the face of the top ({3})", "{1} : s'arrête à {2}, au-dessus de la face du dessus ({3})"],
  ["{}: yEnd ≤ yStart", "{1}: yEnd ≤ yStart", "{1}: yEnd ≤ yStart", "{1} : yEnd ≤ yStart"],
  ["{}: adâncime {} (maxim {})", "{1}: profondità {2} (massimo {3})", "{1}: depth {2} (maximum {3})", "{1} : profondeur {2} (maximum {3})"],
  ["setto {} și setto {} se suprapun", "il setto {1} e il setto {2} si sovrappongono", "divider {1} and divider {2} overlap", "le séparateur {1} et le séparateur {2} se chevauchent"],
  ["{}: lipsește cota y", "{1}: manca la quota y", "{1}: the y dimension is missing", "{1} : la cote y manque"],
  ["{}: în afara golului interior ({}–{})", "{1}: fuori dalla luce interna ({2}–{3})", "{1}: outside the inner opening ({2}–{3})", "{1} : hors de la lumière intérieure ({2}–{3})"],
  ["{}: traversant, dar setto {} ({}–{}) trece prin el", "{1}: passante, ma il setto {2} ({3}–{4}) lo attraversa", "{1}: full-width, but divider {2} ({3}–{4}) runs through it", "{1} : traversante, mais le séparateur {2} ({3}–{4}) la traverse"],
  ["{}: '{}' cere un setto activ la această cotă, și nu există niciunul", "{1}: '{2}' richiede un setto attivo a questa quota, e non ce n'è nessuno", "{1}: '{2}' needs an active divider at this height, and there is none", "{1} : '{2}' demande un séparateur actif à cette cote, et il n'y en a aucun"],
  ["{}: [{}, {}] nu se sprijină pe o laterală sau pe un setto la ambele capete", "{1}: [{2}, {3}] non poggia su un fianco o su un setto a entrambe le estremità", "{1}: [{2}, {3}] is not supported by a side or a divider at both ends", "{1} : [{2}, {3}] ne repose pas sur un côté ou un séparateur aux deux extrémités"],
  ["{}: span necunoscut {}", "{1}: span sconosciuto {2}", "{1}: unknown span {2}", "{1} : span inconnu {2}"],
  ["{}: taie treapta de la {} (fâșia {}–{})", "{1}: taglia il gradino a {2} (fascia {3}–{4})", "{1}: cuts the step at {2} (strip {3}–{4})", "{1} : coupe la marche à {2} (bande {3}–{4})"],
  ["ripiano {} și ripiano {} se suprapun ({} / {})", "il ripiano {1} e il ripiano {2} si sovrappongono ({3} / {4})", "shelf {1} and shelf {2} overlap ({3} / {4})", "l'étagère {1} et l'étagère {2} se chevauchent ({3} / {4})"],
  ["setto {} se oprește la {} și nu e niciun ripiano (sau tavanul) deasupra lui", "il setto {1} si ferma a {2} e sopra non c'è nessun ripiano (né il cielo)", "divider {1} stops at {2} and there is no shelf (or top) above it", "le séparateur {1} s'arrête à {2} et il n'y a aucune étagère (ni dessus) au-dessus"],
  ["setto {} pornește de la {} și nu stă nici pe bază, nici pe un ripiano", "il setto {1} parte da {2} e non poggia né sulla base né su un ripiano", "divider {1} starts at {2} and rests neither on the bottom nor on a shelf", "le séparateur {1} part de {2} et ne repose ni sur le fond ni sur une étagère"],
  ["{}: x, y, w, h trebuie să fie numere", "{1}: x, y, w, h devono essere numeri", "{1}: x, y, w, h must be numbers", "{1} : x, y, w, h doivent être des nombres"],
  ["{}: {}×{} la ({}, {}) iese din gabaritul {}×{}", "{1}: {2}×{3} a ({4}, {5}) esce dall'ingombro {6}×{7}", "{1}: {2}×{3} at ({4}, {5}) is outside the overall size {6}×{7}", "{1} : {2}×{3} à ({4}, {5}) sort de l'encombrement {6}×{7}"],
  ["{}: {}×{} e sub {} mm", "{1}: {2}×{3} è sotto {4} mm", "{1}: {2}×{3} is below {4} mm", "{1} : {2}×{3} est sous {4} mm"],
  ["{}: balama '{}' — doar left / right", "{1}: cerniera '{2}' — solo left / right", "{1}: hinge '{2}' — only left / right", "{1} : charnière '{2}' — seulement left / right"],
  ["anta {} și anta {} se suprapun", "l'anta {1} e l'anta {2} si sovrappongono", "door {1} and door {2} overlap", "la porte {1} et la porte {2} se chevauchent"],
  ["{}: decupaj înălțime {} × adâncime {} nu încape în piesa {} (înălțime) × {} (adâncime)", "{1}: taglio altezza {2} × profondità {3} non entra nel pezzo {4} (altezza) × {5} (profondità)", "{1}: cutout height {2} × depth {3} does not fit the part {4} (height) × {5} (depth)", "{1} : découpe hauteur {2} × profondeur {3} ne rentre pas dans la pièce {4} (hauteur) × {5} (profondeur)"],
  ["{}: decupaj {} {}×{} (înălțime × adâncime) din text ≠ {}×{} cerut de profilul de adâncime", "{1}: taglio {2} {3}×{4} (altezza × profondità) dal testo ≠ {5}×{6} richiesto dal profilo di profondità", "{1}: cutout {2} {3}×{4} (height × depth) from the text ≠ {5}×{6} required by the depth profile", "{1} : découpe {2} {3}×{4} (hauteur × profondeur) du texte ≠ {5}×{6} exigé par le profil de profondeur"],
  ["{}: două decupaje pe colțul {}", "{1}: due tagli sull'angolo {2}", "{1}: two cutouts on corner {2}", "{1} : deux découpes sur le coin {2}"],
  ["{}: piesa '{}' — doar {}", "{1}: il pezzo '{2}' — solo {3}", "{1}: part '{2}' — only {3}", "{1} : la pièce '{2}' — seulement {3}"],
  ["{}: colțul '{}' necunoscut", "{1}: angolo '{2}' sconosciuto", "{1}: unknown corner '{2}'", "{1} : coin '{2}' inconnu"],
  ["{}: w și h trebuie să fie numere", "{1}: w e h devono essere numeri", "{1}: w and h must be numbers", "{1} : w et h doivent être des nombres"],
  ["{}: coloana (col) trebuie să fie ≥ 1", "{1}: la colonna (col) deve essere ≥ 1", "{1}: the column (col) must be ≥ 1", "{1} : la colonne (col) doit être ≥ 1"],
  ["{}: yStart și yEnd trebuie să fie numere", "{1}: yStart e yEnd devono essere numeri", "{1}: yStart and yEnd must be numbers", "{1} : yStart et yEnd doivent être des nombres"],
  ["{}: numărul de sertare trebuie să fie între 1 și 8", "{1}: il numero di cassetti deve essere tra 1 e 8", "{1}: the number of drawers must be between 1 and 8", "{1} : le nombre de tiroirs doit être entre 1 et 8"],
  ["{}: fiecare înălțime de front trebuie să fie ≥ 20 mm", "{1}: ogni altezza di frontale deve essere ≥ 20 mm", "{1}: each front height must be ≥ 20 mm", "{1} : chaque hauteur de façade doit être ≥ 20 mm"],
  ["{}: {} înălțimi pentru {} sertare", "{1}: {2} altezze per {3} cassetti", "{1}: {2} heights for {3} drawers", "{1} : {2} hauteurs pour {3} tiroirs"],
  ["{}: zona {}–{} e sub 40 mm", "{1}: la zona {2}–{3} è sotto 40 mm", "{1}: the zone {2}–{3} is below 40 mm", "{1} : la zone {2}–{3} est sous 40 mm"],
  ["{}: zona {}–{} iese din lumina interioară ({}–{})", "{1}: la zona {2}–{3} esce dalla luce interna ({4}–{5})", "{1}: the zone {2}–{3} is outside the inner opening ({4}–{5})", "{1} : la zone {2}–{3} sort de la lumière intérieure ({4}–{5})"],
  ["{}: sertarele sub treapta din perete nu sunt suportate încă", "{1}: i cassetti sotto il gradino a muro non sono ancora supportati", "{1}: drawers below the wall step are not supported yet", "{1} : les tiroirs sous la marche du mur ne sont pas encore pris en charge"],
  ["{}: coloana {}, dar la această înălțime sunt doar {}", "{1}: colonna {2}, ma a questa altezza ce ne sono solo {3}", "{1}: column {2}, but at this height there are only {3}", "{1} : colonne {2}, mais à cette hauteur il n'y en a que {3}"],
  ["{}: setto {} se oprește în zona sertarelor", "{1}: il setto {2} si ferma nella zona dei cassetti", "{1}: divider {2} stops inside the drawer zone", "{1} : le séparateur {2} s'arrête dans la zone des tiroirs"],
  ["{}: ripiano {} ({}–{}) trece prin zona sertarelor {}–{}", "{1}: il ripiano {2} ({3}–{4}) attraversa la zona dei cassetti {5}–{6}", "{1}: shelf {2} ({3}–{4}) runs through the drawer zone {5}–{6}", "{1} : l'étagère {2} ({3}–{4}) traverse la zone des tiroirs {5}–{6}"],
  ["sertarele {} și sertarele {} se suprapun", "i cassetti {1} e i cassetti {2} si sovrappongono", "drawers {1} and drawers {2} overlap", "les tiroirs {1} et les tiroirs {2} se chevauchent"],
  ["cotele absolute (partitions / fronts / depthProfile / customCuts) sunt suportate doar pe tipologia standard, nu pe '{}'", "le quote assolute (partitions / fronts / depthProfile / customCuts) sono supportate solo sulla tipologia standard, non su '{1}'", "absolute dimensions (partitions / fronts / depthProfile / customCuts) are supported only on the standard type, not on '{1}'", "les cotes absolues (partitions / fronts / depthProfile / customCuts) ne sont prises en charge que sur le type standard, pas sur '{1}'"],
  ["«Cassetti/sez.» nu se combină cu partiții la cote absolute: pune sertarele în `drawerBlocks`, pe coloană, la cotă", "«Cassetti/sez.» non si combina con partizioni a quote assolute: metti i cassetti in `drawerBlocks`, per colonna, a quota", "“Cassetti/sez.” cannot be combined with partitions at absolute dimensions: put the drawers in `drawerBlocks`, per column, at height", "« Cassetti/sez. » ne se combine pas avec des cloisons à cotes absolues : mettez les tiroirs dans `drawerBlocks`, par colonne, à la cote"],
  ["«Cassetti/sez.» nu se combină cu `drawerBlocks`: scoate unul dintre ele", "«Cassetti/sez.» non si combina con `drawerBlocks`: togli uno dei due", "“Cassetti/sez.” cannot be combined with `drawerBlocks`: remove one of them", "« Cassetti/sez. » ne se combine pas avec `drawerBlocks` : retirez l'un des deux"],
  ["ușile cu cote absolute sunt doar panouri pline (front '{}' nu e suportat)", "le ante a quote assolute sono solo pannelli pieni (il frontale '{1}' non è supportato)", "doors at absolute dimensions are solid panels only (front '{1}' is not supported)", "les portes à cotes absolues sont seulement des panneaux pleins (la façade '{1}' n'est pas prise en charge)"],
  ["decupaj pe setti, dar corpul nu are niciun setto", "taglio sui setti, ma il corpo non ha nessun setto", "cutout on dividers, but the cabinet has no divider", "découpe sur séparateurs, mais le corps n'a aucun séparateur"],
  ["coloana {}: {} intră în piesa de dedesubt ({} mm)", "colonna {1}: {2} entra nel pezzo sottostante ({3} mm)", "column {1}: {2} overlaps the part below ({3} mm)", "colonne {1} : {2} entre dans la pièce du dessous ({3} mm)"],
  ["coloana {}: {} nu lasă nicio lumină sub el", "colonna {1}: {2} non lascia nessuna luce sotto di sé", "column {1}: {2} leaves no clearance below it", "colonne {1} : {2} ne laisse aucun jour en dessous"],
  ["coloana {}: suma verticală {} ≠ H {}", "colonna {1}: la somma verticale {2} ≠ H {3}", "column {1}: the vertical sum {2} ≠ H {3}", "colonne {1} : la somme verticale {2} ≠ H {3}"],
  ["{}: `vents` trebuie să fie o listă", "{1}: `vents` deve essere una lista", "{1}: `vents` must be a list", "{1} : `vents` doit être une liste"],
  ["{}: cel mult {} grile pe ușă, primit {}", "{1}: al massimo {2} griglie per anta, ricevute {3}", "{1}: at most {2} vents per door, got {3}", "{1} : au plus {2} grilles par porte, reçu {3}"],
  ["{}: `at` = top / bottom, primit {}", "{1}: `at` = top / bottom, ricevuto {2}", "{1}: `at` = top / bottom, got {2}", "{1} : `at` = top / bottom, reçu {2}"],
  ["{}: {} mm lățime la x {} nu lasă {} mm până la marginile ușii ({} mm) — acolo stau cuvele balamalelor", "{1}: {2} mm di larghezza a x {3} non lascia {4} mm fino ai bordi dell'anta ({5} mm) — lì stanno le tazze delle cerniere", "{1}: {2} mm wide at x {3} leaves less than {4} mm to the door edges ({5} mm) — the hinge cups are there", "{1} : {2} mm de largeur à x {3} ne laisse pas {4} mm jusqu'aux bords de la porte ({5} mm) — les cuvettes de charnières sont là"],
  ["{}: {} mm înălțime la y {} nu lasă {} mm până la marginea ușii ({} mm)", "{1}: {2} mm di altezza a y {3} non lascia {4} mm fino al bordo dell'anta ({5} mm)", "{1}: {2} mm high at y {3} leaves less than {4} mm to the door edge ({5} mm)", "{1} : {2} mm de hauteur à y {3} ne laisse pas {4} mm jusqu'au bord de la porte ({5} mm)"],
  ["{}: grila {} și grila {} se suprapun", "{1}: la griglia {2} e la griglia {3} si sovrappongono", "{1}: vent {2} and vent {3} overlap", "{1} : la grille {2} et la grille {3} se chevauchent"],
  ["spatele pe coloane, rinforzo-ul, filler-ele și decupajele din spate sunt suportate doar pe tipologia standard, nu pe '{}'", "il retro a colonne, il rinforzo, i filler e i tagli nel retro sono supportati solo sulla tipologia standard, non su '{1}'", "column backs, back rails, fillers and back cutouts are supported only on the standard type, not on '{1}'", "le fond par colonnes, la traverse de renfort, les fillers et les découpes du fond ne sont pris en charge que sur le type standard, pas sur '{1}'"],
  ["spate: coloana {} nu există (corpul are {} coloane)", "retro: la colonna {1} non esiste (il corpo ha {2} colonne)", "back: column {1} does not exist (the cabinet has {2} columns)", "fond : la colonne {1} n'existe pas (le corps a {2} colonnes)"],
  ["spate: coloana {} e scrisă de două ori", "retro: la colonna {1} è scritta due volte", "back: column {1} is listed twice", "fond : la colonne {1} est écrite deux fois"],
  ["spate: `backCols` cere spate (Spate = Da)", "retro: `backCols` richiede il retro (Retro = Sì)", "back: `backCols` needs a back (Back = Yes)", "fond : `backCols` demande un fond (Fond = Oui)"],
  ["spate pe coloane: nu se combină cu panta sau cu treapta din perete (spatele ar trebui tăiat în două direcții)", "retro a colonne: non si combina con la pendenza né con il gradino a muro (il retro andrebbe tagliato in due direzioni)", "column back: cannot be combined with the slope or the wall step (the back would have to be cut in two directions)", "fond par colonnes : ne se combine pas avec la pente ni avec la marche du mur (le fond devrait être coupé dans deux directions)"],
  ["spate: `backCols` nu conține nicio coloană validă", "retro: `backCols` non contiene nessuna colonna valida", "back: `backCols` contains no valid column", "fond : `backCols` ne contient aucune colonne valide"],
  ["decupaj în spate: corpul nu are spate (Spate = Da)", "taglio nel retro: il corpo non ha il retro (Retro = Sì)", "back cutout: the cabinet has no back (Back = Yes)", "découpe du fond : le corps n'a pas de fond (Fond = Oui)"],
  ["decupaj în spate: nu se combină cu panta sau cu treapta din perete (spatele e tăiat în două piese)", "taglio nel retro: non si combina con la pendenza né con il gradino a muro (il retro è tagliato in due pezzi)", "back cutout: cannot be combined with the slope or the wall step (the back is cut in two pieces)", "découpe du fond : ne se combine pas avec la pente ni avec la marche du mur (le fond est coupé en deux pièces)"],
  ["{}: {}×{} la x {} cade în coloana {}, care nu are spate", "{1}: {2}×{3} a x {4} cade nella colonna {5}, che non ha il retro", "{1}: {2}×{3} at x {4} falls in column {5}, which has no back", "{1} : {2}×{3} à x {4} tombe dans la colonne {5}, qui n'a pas de fond"],
  ["{}: {}×{} la x {} nu încape într-un singur spate (iese peste capătul lui sau trece peste un despărțitor care îi desparte)", "{1}: {2}×{3} a x {4} non entra in un solo retro (esce dall'estremità o passa sopra un divisorio che li separa)", "{1}: {2}×{3} at x {4} does not fit in a single back (it goes past its end or over a divider that separates them)", "{1} : {2}×{3} à x {4} ne tient pas dans un seul fond (il dépasse son extrémité ou passe sur une cloison qui les sépare)"],
  ["{}: y {}–{} iese din spate ({}–{})", "{1}: y {2}–{3} esce dal retro ({4}–{5})", "{1}: y {2}–{3} is outside the back ({4}–{5})", "{1} : y {2}–{3} sort du fond ({4}–{5})"],
  ["decupajele {} și {} din spate se suprapun", "i tagli {1} e {2} nel retro si sovrappongono", "back cutouts {1} and {2} overlap", "les découpes {1} et {2} du fond se chevauchent"],
  ["{}: y (fața de jos, de la pardoseală) trebuie să fie număr", "{1}: y (faccia inferiore, dal pavimento) deve essere un numero", "{1}: y (bottom face, from the floor) must be a number", "{1} : y (face du bas, depuis le sol) doit être un nombre"],
  ["{}: înălțimea {} mm trebuie să fie între {} și {}", "{1}: l'altezza {2} mm deve essere tra {3} e {4}", "{1}: the height {2} mm must be between {3} and {4}", "{1} : la hauteur {2} mm doit être entre {3} et {4}"],
  ["{}: {}–{} iese din lumina interioară ({}–{})", "{1}: {2}–{3} esce dalla luce interna ({4}–{5})", "{1}: {2}–{3} is outside the inner opening ({4}–{5})", "{1} : {2}–{3} sort de la lumière intérieure ({4}–{5})"],
  ["{}: `cols` trebuie să fie o listă de coloane", "{1}: `cols` deve essere una lista di colonne", "{1}: `cols` must be a list of columns", "{1} : `cols` doit être une liste de colonnes"],
  ["{}: coloana {} nu există (corpul are {})", "{1}: la colonna {2} non esiste (il corpo ne ha {3})", "{1}: column {2} does not exist (the cabinet has {3})", "{1} : la colonne {2} n'existe pas (le corps en a {3})"],
  ["{}: nu există nicio coloană fără spate; dă `cols` ca să-l pui totuși", "{1}: non c'è nessuna colonna senza retro; indica `cols` per metterlo comunque", "{1}: there is no column without a back; give `cols` to place it anyway", "{1} : il n'y a aucune colonne sans fond ; donnez `cols` pour le placer quand même"],
  ["{}: în coloana {} trece prin polița {} ({}–{})", "{1}: nella colonna {2} passa attraverso il ripiano {3} ({4}–{5})", "{1}: in column {2} it runs through shelf {3} ({4}–{5})", "{1} : dans la colonne {2} il traverse l'étagère {3} ({4}–{5})"],
  ["rinforzo {} și rinforzo {} se suprapun în coloana {}", "il rinforzo {1} e il rinforzo {2} si sovrappongono nella colonna {3}", "back rail {1} and back rail {2} overlap in column {3}", "la traverse {1} et la traverse {2} se chevauchent dans la colonne {3}"],
  ["{}: `side` = top / right / left / capL / capR, primit {}", "{1}: `side` = top / right / left / capL / capR, ricevuto {2}", "{1}: `side` = top / right / left / capL / capR, got {2}", "{1} : `side` = top / right / left / capL / capR, reçu {2}"],
  ["{}: două filler-e pe {}", "{1}: due filler su {2}", "{1}: two fillers on {2}", "{1} : deux fillers sur {2}"],
  ["{}: `size` (cât se vede, mm) trebuie să fie număr", "{1}: `size` (quanto si vede, mm) deve essere un numero", "{1}: `size` (visible part, mm) must be a number", "{1} : `size` (partie visible, mm) doit être un nombre"],
  ["{}: {} mm trebuie să fie între {} și {}", "{1}: {2} mm deve essere tra {3} e {4}", "{1}: {2} mm must be between {3} and {4}", "{1} : {2} mm doit être entre {3} et {4}"],
  ["{}: surplusul de potrivire {} mm trebuie să fie între 0 și 50", "{1}: il surplus di adattamento {2} mm deve essere tra 0 e 50", "{1}: the fitting allowance {2} mm must be between 0 and 50", "{1} : le surplus d'ajustement {2} mm doit être entre 0 et 50"],
  ["{}: `extend` (mm de prelungire spre alt corp, în stânga) trebuie să fie între 0 și 6000", "{1}: `extend` (mm di prolungamento verso un altro corpo, a sinistra) deve essere tra 0 e 6000", "{1}: `extend` (mm of extension towards another cabinet, to the left) must be between 0 and 6000", "{1} : `extend` (mm de prolongement vers un autre corps, à gauche) doit être entre 0 et 6000"],
  ["{}: `extend` e doar pentru filler-ul de sus", "{1}: `extend` vale solo per il filler superiore", "{1}: `extend` is only for the top filler", "{1} : `extend` ne vaut que pour le filler du haut"]
];

/* prefixele cu care aplicația lipește erorile (index.html: throw new Error(...)) */
var AU_PAT_PREFIX = {
  it: { "Cote absolute: ": "Quote assolute: ", "Spate / rinforzo / filler: ": "Retro / rinforzo / filler: " },
  en: { "Cote absolute: ": "Absolute dimensions: ", "Spate / rinforzo / filler: ": "Back / back rail / filler: " },
  fr: { "Cote absolute: ": "Cotes absolues : ", "Spate / rinforzo / filler: ": "Fond / traverse / filler : " }
};

var AU_PAT_COMPILED = null;
function auPatCompile() {
  if (AU_PAT_COMPILED) return AU_PAT_COMPILED;
  AU_PAT_COMPILED = AU_PAT_ROWS.map(function (r) {
    var src = r[0].replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{\}/g, "(.+?)");
    return { re: new RegExp("^" + src + "$"), tr: { it: r[1], en: r[2], fr: r[3] } };
  });
  return AU_PAT_COMPILED;
}
function auNoun(v, lang) {
  var N = AU_NOUN[lang]; if (!N) return v;
  if (N.hasOwnProperty(v)) return N[v];
  return v.replace(/\b(decupaj spate|decupaj|setto|ripiano|anta|sertare|rinforzo|grila|filler|zona|coloana)\b(?= \d)/g, function (w) { return N[w]; });
}
/* un mesaj compus → limba cerută; null dacă nu e un mesaj de acest fel */
function auPatTx(s, lang) {
  var L = (lang === "it" || lang === "en" || lang === "fr") ? lang : "en";
  var P = auPatCompile();
  for (var i = 0; i < P.length; i++) {
    var m = P[i].re.exec(s);
    if (m) return P[i].tr[L].replace(/\{(\d+)\}/g, function (_, k) { return auNoun(m[+k], L); });
  }
  return null;
}
/* lista întreagă («a · b · c»), cu prefixul aplicației */
function auLayoutTx(s, lang) {
  if (!s || !lang || lang === "ro") return s;
  var L = (lang === "it" || lang === "en" || lang === "fr") ? lang : "en", pre = "", rest = s;
  var PF = AU_PAT_PREFIX[L];
  for (var k in PF) if (s.indexOf(k) === 0) { pre = PF[k]; rest = s.slice(k.length); break; }
  var parts = rest.split(" · "), changed = !!pre;
  var out = parts.map(function (p) { var t = auPatTx(p, lang); if (t != null) { changed = true; return t; } return p; });
  return changed ? pre + out.join(" · ") : s;
}
if (typeof module !== "undefined" && module.exports) module.exports.auLayoutTx = auLayoutTx;
