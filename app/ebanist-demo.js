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
    return p;
  }
  function existing(projects, id) { for (var i = 0; i < (projects || []).length; i++) if (projects[i].showcase === id) return projects[i]; return null; }
  function counts(p) { return !(p && (p.demo || p.showcase)); }
  return { list: list, get: get, prepare: prepare, existing: existing, counts: counts, nameFor: nameFor };
});
