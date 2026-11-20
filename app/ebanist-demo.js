/* Ebanist — FAZA T: proiectele demo («Proiecte demo» în lista de proiecte). PUR: fără DOM, fără stare.
 *
 * Cele trei fișiere din app/demo/*.json se produc cu `node tools/showcase-build.cjs` (specificațiile din tools/showcase/specs): corpurile trec prin generateInto, blatul prin wtApply,
 * bucătăria prin EBKitchenUI.apply, poziția prin layout() — nicio piesă scrisă de mână. Aici: lista, copia și regula limitei gratuite.
 *
 *   EBDemo.list()                         → [{ id, file, feat:[etichete tehnice, ca în catalog] }]
 *   EBDemo.get(id)                        → intrarea sau null
 *   EBDemo.prepare(json, o)               → copia care se adaugă în state.projects:  o = { lang, uid, names:[nume existente], today }
 *   EBDemo.existing(projects, id)         → copia neatinsă (cu steagul `showcase`) a aceluiași demo, dacă există — se redeschide, nu se dublează
 *   EBDemo.counts(p)                      → true dacă proiectul intră în limita celor gratuite (nu e o copie demo neatinsă)
 *
 * REGULA LIMITEI GRATUITE (D-55: gratuit = 1 proiect): copia poartă `showcase:<id>` și NU se numără în limită (ca exemplul de pornire, `demo`): materialul e al nostru și nu trebuie
 * să ia locul primului proiect al utilizatorului. Steagul cade când copia se redenumește sau se duplică (atunci e proiectul lui și se numără, cu zidul obișnuit). Exportul
 * documentelor rămâne Pro (proGate neschimbat): demo-ul se vede și se rotește gratuit, nu se scoate în fabrică gratuit. Reîncărcarea unui demo neatins îl redeschide.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EBDemo = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  var LIST = [
    { id: "living", file: "demo/living.json", feat: ["AVENTOS SERVO-DRIVE", "Häfele E-Drive", "TV lift", "WingLine", "TIP-ON", "Legrabox", "LED"] },
    { id: "kitchen", file: "demo/kitchen.json", feat: ["Carousel corner", "AVENTOS SERVO-DRIVE", "Gola", "Legrabox", "Ceramic 45°", "LED"] },
    { id: "bedroom", file: "demo/bedroom.json", feat: ["TopLine L", "WingLine", "Lift-up bed", "TIP-ON", "Keyboard shelf", "LED"] }
  ];

  /* Numele corpurilor din demo-uri (cheile `configs`/`layout`, `gen`/`modulo` din piese) sunt scrise o dată în fișierele JSON; la încărcare se traduc în limba aplicației.
   * Ordinea limbilor: ro, it, en, fr, de, pl, es. Cheia = numele din JSON fără sufixul de cotă (« 1.4 ↑», « 1 A»), care se păstrează ca atare. Fără intrare = numele rămâne cum e. */
  var LANGS = ["ro", "it", "en", "fr", "de", "pl", "es"];
  var BN = {
    "S1 Raft deschis": ["S1 Raft deschis", "S1 Scaffale aperto", "S1 Open shelves", "S1 Étagères ouvertes", "S1 Offenes Regal", "S1 Regał otwarty", "S1 Estantería abierta"],
    "S2 Sertare": ["S2 Sertare", "S2 Cassetti", "S2 Drawers", "S2 Tiroirs", "S2 Schubladen", "S2 Szuflady", "S2 Cajones"],
    "S3 Vitrină": ["S3 Vitrină", "S3 Vetrina", "S3 Display cabinet", "S3 Vitrine", "S3 Vitrine", "S3 Witryna", "S3 Vitrina"],
    "S4 Clapă sus": ["S4 Clapă sus", "S4 Ribalta alta", "S4 Top flap", "S4 Abattant haut", "S4 Klappe oben", "S4 Klapa górna", "S4 Abatible superior"],
    "C1 Lambriu": ["C1 Lambriu", "C1 Boiserie", "C1 Wall paneling", "C1 Lambris", "C1 Wandpaneel", "C1 Boazeria", "C1 Panelado"],
    "C2 Console doors": ["C2 Consolă cu uși", "C2 Consolle con ante", "C2 Console doors", "C2 Console à portes", "C2 Konsole mit Türen", "C2 Konsola z drzwiami", "C2 Consola con puertas"],
    "C3 TV lift": ["C3 Lift TV", "C3 Alza-TV", "C3 TV lift", "C3 Lift TV", "C3 TV-Lift", "C3 Winda TV", "C3 Elevador TV"],
    "C4 Console drawers": ["C4 Consolă cu sertare", "C4 Consolle con cassetti", "C4 Console drawers", "C4 Console à tiroirs", "C4 Konsole mit Schubladen", "C4 Konsola z szufladami", "C4 Consola con cajones"],
    "C5 Clapă stânga": ["C5 Clapă stânga", "C5 Ribalta sinistra", "C5 Flap left", "C5 Abattant gauche", "C5 Klappe links", "C5 Klapa lewa", "C5 Abatible izquierdo"],
    "C6 Clapă dreapta": ["C6 Clapă dreapta", "C6 Ribalta destra", "C6 Flap right", "C6 Abattant droit", "C6 Klappe rechts", "C6 Klapa prawa", "C6 Abatible derecho"],
    "D1 Sertare": ["D1 Sertare", "D1 Cassetti", "D1 Drawers", "D1 Tiroirs", "D1 Schubladen", "D1 Szuflady", "D1 Cajones"],
    "D2 Bar uși pliante": ["D2 Bar uși pliante", "D2 Bar ante pieghevoli", "D2 Bar folding doors", "D2 Bar portes pliantes", "D2 Bar Falttüren", "D2 Bar drzwi składane", "D2 Bar puertas plegables"],
    "D3 Free flap": ["D3 Free flap", "D3 Free flap", "D3 Free flap", "D3 Free flap", "D3 Free flap", "D3 Free flap", "D3 Free flap"],
    "D4 Raft deschis": ["D4 Raft deschis", "D4 Scaffale aperto", "D4 Open shelves", "D4 Étagères ouvertes", "D4 Offenes Regal", "D4 Regał otwarty", "D4 Estantería abierta"],
    "R1 Desk": ["R1 Birou", "R1 Scrivania", "R1 Desk", "R1 Bureau", "R1 Schreibtisch", "R1 Biurko", "R1 Escritorio"],
    "B1 Headboard slats": ["B1 Lamele tăblie", "B1 Doghe testiera", "B1 Headboard slats", "B1 Lattes de tête de lit", "B1 Kopfteil-Lamellen", "B1 Listwy wezgłowia", "B1 Lamas del cabecero"],
    "B2 Bed lift-up": ["B2 Pat cu ladă ridicabilă", "B2 Letto contenitore", "B2 Bed lift-up", "B2 Lit coffre relevable", "B2 Bett mit Hubmechanik", "B2 Łóżko z pojemnikiem", "B2 Cama con canapé abatible"],
    "B3 Nightstand left": ["B3 Noptieră stânga", "B3 Comodino sinistro", "B3 Nightstand left", "B3 Chevet gauche", "B3 Nachttisch links", "B3 Szafka nocna lewa", "B3 Mesita izquierda"],
    "B4 Nightstand right": ["B4 Noptieră dreapta", "B4 Comodino destro", "B4 Nightstand right", "B4 Chevet droit", "B4 Nachttisch rechts", "B4 Szafka nocna prawa", "B4 Mesita derecha"],
    "B5 Light shelf": ["B5 Raft luminos", "B5 Mensola luminosa", "B5 Light shelf", "B5 Étagère lumineuse", "B5 Leuchtregal", "B5 Półka podświetlana", "B5 Estante luminoso"],
    "D1 Desk": ["D1 Birou", "D1 Scrivania", "D1 Desk", "D1 Bureau", "D1 Schreibtisch", "D1 Biurko", "D1 Escritorio"],
    "D2 Desk wall unit": ["D2 Pensilă birou", "D2 Pensile scrivania", "D2 Desk wall unit", "D2 Meuble haut bureau", "D2 Hängeschrank Schreibtisch", "D2 Szafka wisząca biurka", "D2 Mueble alto escritorio"],
    "D3 Oval shelf": ["D3 Raft oval", "D3 Mensola ovale", "D3 Oval shelf", "D3 Étagère ovale", "D3 Ovales Regal", "D3 Półka owalna", "D3 Estante oval"],
    "W1 Sliding wardrobe": ["W1 Dulap cu uși glisante", "W1 Armadio scorrevole", "W1 Sliding wardrobe", "W1 Armoire coulissante", "W1 Schiebetürschrank", "W1 Szafa przesuwna", "W1 Armario corredero"],
    "W2 Folding-door dressing": ["W2 Dressing cu uși pliante", "W2 Cabina armadio ante pieghevoli", "W2 Folding-door dressing", "W2 Dressing portes pliantes", "W2 Ankleide Falttüren", "W2 Garderoba drzwi składane", "W2 Vestidor puertas plegables"],
    "W3 Open shelves": ["W3 Rafturi deschise", "W3 Scaffali aperti", "W3 Open shelves", "W3 Étagères ouvertes", "W3 Offene Regale", "W3 Regały otwarte", "W3 Estantes abiertos"],
    "Base unit drawer + doors": ["Bază sertar + uși", "Base cassetto + ante", "Base unit drawer + doors", "Meuble bas tiroir + portes", "Unterschrank Schublade + Türen", "Szafka dolna szuflada + drzwi", "Bajo cajón + puertas"],
    "Base unit with drawers": ["Bază cu sertare", "Base con cassetti", "Base unit with drawers", "Meuble bas à tiroirs", "Unterschrank mit Schubladen", "Szafka dolna z szufladami", "Bajo con cajones"],
    "Blind corner wall unit": ["Pensilă colț mort", "Pensile angolo cieco", "Blind corner wall unit", "Haut d'angle aveugle", "Hängeschrank Blindecke", "Szafka wisząca narożna ślepa", "Alto de esquina ciego"],
    "Dishwasher niche": ["Nișă mașină de spălat vase", "Nicchia lavastoviglie", "Dishwasher niche", "Niche lave-vaisselle", "Nische Geschirrspüler", "Wnęka zmywarki", "Hueco lavavajillas"],
    "Glass-door wall unit": ["Pensilă cu uși de sticlă", "Pensile con ante in vetro", "Glass-door wall unit", "Haut vitré", "Hängeschrank Glastüren", "Szafka wisząca ze szkłem", "Alto con puertas de cristal"],
    "Hob base unit (drawers)": ["Bază plită (sertare)", "Base piano cottura (cassetti)", "Hob base unit (drawers)", "Meuble bas plaque (tiroirs)", "Unterschrank Kochfeld (Schubladen)", "Szafka pod płytę (szuflady)", "Bajo placa (cajones)"],
    "Hood space (chimney)": ["Loc hotă (horn)", "Spazio cappa (camino)", "Hood space (chimney)", "Emplacement hotte (cheminée)", "Platz Dunstabzug (Kamin)", "Miejsce na okap (komin)", "Espacio campana (chimenea)"],
    "Integrated fridge tall unit": ["Coloană frigider încorporat", "Colonna frigo integrato", "Integrated fridge tall unit", "Colonne frigo intégré", "Hochschrank Einbaukühlschrank", "Zabudowa lodówki", "Columna frigorífico integrado"],
    "Island doors": ["Insulă uși", "Isola ante", "Island doors", "Îlot portes", "Insel Türen", "Wyspa drzwi", "Isla puertas"],
    "Island drawers": ["Insulă sertare", "Isola cassetti", "Island drawers", "Îlot tiroirs", "Insel Schubladen", "Wyspa szuflady", "Isla cajones"],
    "Island open": ["Insulă deschisă", "Isola aperta", "Island open", "Îlot ouvert", "Insel offen", "Wyspa otwarta", "Isla abierta"],
    "Island worktop": ["Blat insulă", "Piano isola", "Island worktop", "Plan de travail îlot", "Insel-Arbeitsplatte", "Blat wyspy", "Encimera isla"],
    "Kitchen worktop": ["Blat bucătărie", "Piano cucina", "Kitchen worktop", "Plan de travail cuisine", "Küchenarbeitsplatte", "Blat kuchenny", "Encimera cocina"],
    "L-shaped corner (carousel)": ["Colț în L (carusel)", "Angolo a L (carosello)", "L-shaped corner (carousel)", "Angle en L (carrousel)", "L-Eckschrank (Karussell)", "Narożnik L (karuzela)", "Esquina en L (carrusel)"],
    "Open base unit": ["Bază deschisă", "Base aperta", "Open base unit", "Meuble bas ouvert", "Offener Unterschrank", "Szafka dolna otwarta", "Bajo abierto"],
    "Open wall unit": ["Pensilă deschisă", "Pensile aperto", "Open wall unit", "Haut ouvert", "Offener Hängeschrank", "Szafka wisząca otwarta", "Alto abierto"],
    "Oven tall unit (+ microwave)": ["Coloană cuptor (+ microunde)", "Colonna forno (+ microonde)", "Oven tall unit (+ microwave)", "Colonne four (+ micro-ondes)", "Hochschrank Backofen (+ Mikrowelle)", "Zabudowa piekarnika (+ mikrofala)", "Columna horno (+ microondas)"],
    "Pantry tall unit": ["Coloană cămară", "Colonna dispensa", "Pantry tall unit", "Colonne garde-manger", "Vorratsschrank", "Szafa spiżarniana", "Columna despensa"],
    "Pull-out pantry": ["Cămară extractibilă", "Dispensa estraibile", "Pull-out pantry", "Garde-manger coulissant", "Auszug-Vorratsschrank", "Spiżarnia wysuwana", "Despensa extraíble"],
    "Sink base unit": ["Bază chiuvetă", "Base lavello", "Sink base unit", "Meuble bas évier", "Spülenunterschrank", "Szafka pod zlewem", "Bajo fregadero"],
    "Wall unit with doors": ["Pensilă cu uși", "Pensile con ante", "Wall unit with doors", "Haut à portes", "Hängeschrank mit Türen", "Szafka wisząca z drzwiami", "Alto con puertas"]
  };
  /* numele tradus al unui corp; sufixul de cotă («1.4 ↑», «1 A») și literele A/B ale corpurilor în două părți rămân neschimbate */
  function bodyName(canon, lang) {
    var i = LANGS.indexOf(lang); if (i < 0) i = 2;
    var row = BN[canon], suf = "", m;
    if (!row && (m = /^(.+?)( \d+(?:\.\d+)?(?: [AB])?(?: ↑)?)$/.exec(canon))) { row = BN[m[1]]; suf = m[2]; }
    if (!row && (m = /^(.+) ([AB])$/.exec(canon)) && BN[m[1]]) { row = BN[m[1]]; suf = " " + m[2]; }
    return row ? row[i] + suf : canon;
  }
  /* numele apar întregi și în chei (`configs`, `layout`), în `gen`/`modulo`, în blat (`name`, `names`, `mods`) și în semnătura blatului (`sig`, text JSON):
   * o singură trecere peste toate cheile și textele, cele mai lungi nume întâi, deci „X A” se înlocuiește înaintea lui „X” */
  function renameBodies(p, lang) {
    var names = {};
    Object.keys(p.configs || {}).forEach(function (k) { names[k] = 1; });
    (p.pieces || []).forEach(function (x) { if (x.gen) names[x.gen] = 1; if (x.modulo) names[x.modulo] = 1; });
    (p.worktops || []).forEach(function (w) { if (w.name) names[w.name] = 1; (w.names || []).forEach(function (n) { names[n] = 1; }); });
    var map = {}, used = {}, list = Object.keys(names).sort(function (a, b) { return b.length - a.length; });
    list.forEach(function (k) { var n = bodyName(k, lang); if (n !== k) { if (used[n]) return; used[n] = 1; map[k] = n; } });
    var keys = Object.keys(map); if (!keys.length) return map;
    var re = new RegExp(keys.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|"), "g");
    function sub(str) { return str.indexOf(" ") < 0 && str.length < 3 ? str : str.replace(re, function (m) { return map[m]; }); }
    function walk(o) {
      if (Array.isArray(o)) { for (var i = 0; i < o.length; i++) { if (typeof o[i] === "string") o[i] = sub(o[i]); else walk(o[i]); } return; }
      if (!o || typeof o !== "object") return;
      Object.keys(o).forEach(function (k) {
        var v = o[k], nk = sub(k);
        if (nk !== k) { delete o[k]; o[nk] = v; }
        if (typeof v === "string") o[nk] = sub(v); else walk(v);
      });
    }
    walk(p); return map;
  }
  function list() { return LIST.map(function (d) { return { id: d.id, file: d.file, feat: d.feat.slice() }; }); }
  function get(id) { for (var i = 0; i < LIST.length; i++) if (LIST[i].id === id) return list()[i]; return null; }
  function nameFor(json, lang) { var n = json && json.names; return (n && (n[lang] || n.en || n.ro)) || (json && json.name) || "Demo"; }
  function prepare(json, o) {
    o = o || {};
    var uid = typeof o.uid === "function" ? o.uid : function () { return "d" + Math.random().toString(36).slice(2, 11); };
    var p = JSON.parse(JSON.stringify(json));
    var base = nameFor(json, o.lang || "en"), name = base, taken = o.names || [], n = 2;
    while (taken.indexOf(name) >= 0) name = base + " (" + (n++) + ")";
    p.id = uid(); p.name = name; p.client = ""; p.date = o.today || p.date;
    (p.pieces || []).forEach(function (x) { x.id = uid(); x.done = 0; });
    p.showcase = json.showcase || null; delete p.names; delete p.demo;
    renameBodies(p, o.lang || "en");
    return p;
  }
  function existing(projects, id) { for (var i = 0; i < (projects || []).length; i++) if (projects[i].showcase === id) return projects[i]; return null; }
  function counts(p) { return !(p && (p.demo || p.showcase)); }
  return { list: list, get: get, prepare: prepare, existing: existing, counts: counts, nameFor: nameFor, bodyName: bodyName };
});
