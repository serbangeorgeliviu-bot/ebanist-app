/* Ebanist — sisteme de sertar dincolo de Blum / Häfele Matrix Box: Hettich AvanTech YOU și ArciTech (cu glisiera Actro), GRASS Nova Pro Scala,
 * Vionaro V8 și V13 (cu Dynapro), plus glisierele pentru sertar din lemn (Actro 5D, Dynapro, Matrix Runner UM, Quadro V6, Accuride 3832SC).
 * PUR: fără DOM, fără stare.
 *
 * Datele vin din EBDrawersMoreData (ebanist-drawers-more-data.js, generat de tools/drawers-more-build.mjs din documente oficiale; ce nu e în
 * sursă = null și NU se calculează). Aici sta numai logica, în același fel ca la lift (ebanist-liftfit.js):
 *   - `drawsys()`      obiectele DRAWSYS ale sistemelor selectabile (înălțimi, NL pe înălțime, deducții, adâncime minimă);
 *   - `planCtx()`      ce are în plus planul unui sertar (drawerPlan din index.html) când sistemul sau glisiera vine de aici;
 *   - `guidaEntries()` / `zargaEntries()` / `slideCatalog()` articolele din catalog (HWDB.guida / HWDB.zarga) și rezerva glisierei din nucleu;
 *   - `holePolicy()`   găurirea glisierei: NICIO gaură nu are reperul ei în text sau tabel (numai pe desen) ⇒ nu se generează, se avertizează;
 *   - `sheetLines()`   rândurile din fișa de montaj (adâncime minimă, articole, prinderea frontului, tabelul de găuri al producătorului).
 *
 * Reguli (D-48, D-74): fără număr scris din memorie; deducția depinde de grosimea laterală a corpului acolo unde sursa o spune (ArciTech,
 * Nova Pro Scala: EB după grosime) — o grosime fără rând în tabel NU primește o valoare ghicită, planul spune de ce nu iese.
 * Valorile de PLASARE (cât coboară frontul sub fundul casei, cât trebuie să depășească frontul lateralul) nu sunt date de producător: sunt
 * valorile aplicației pentru toate sistemele metalice (aceleași ca la Matrix Box P), marcate în `PLACE`.
 *
 *   cd test && node --test drawers-more.test.js
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.EBDrawersMore = factory(root);
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";
  var LANGS = ["it", "ro", "en", "fr", "de", "pl", "es"];
  var PAIR = { it: "cp.", ro: "per.", en: "pair", fr: "paire", de: "Paar", pl: "para", es: "par" };
  var SIDES = { it: "sponde sx/dx", ro: "laterale stânga/dreapta", en: "drawer sides L/R", fr: "côtés G/D", de: "Zargen links/rechts", pl: "boki lewy/prawy", es: "costados izq./dcha." };
  var NODIMS = { it: "dimensioni non disponibili", ro: "dimensiuni indisponibile", en: "dimensions not available", fr: "dimensions non disponibles", de: "Maße nicht verfügbar", pl: "wymiary niedostępne", es: "dimensiones no disponibles" };
  var SIDESET = { it: "set", ro: "set", en: "set", fr: "kit", de: "Set", pl: "zestaw", es: "juego" };
  /* valori de plasare ale aplicației (NU date de producător), aceleași ca la celelalte sisteme metalice: frontul coboară `lift` sub fundul
     casei și trebuie să fie cu `headroom` mai înalt decât lateralul. `sideTh` = grosimea cu care se DESENEAZĂ lateralul când sursa nu o dă. */
  var PLACE = { lift: 13, headroom: 24, sideTh: 8, schematic: true };

  function D() { return root.EBDrawersMoreData || { sources: [], runners: [], boxes: [], sides: [], notes: [], conflicts: [] }; }
  function runners() { return D().runners; }
  function boxes() { return D().boxes; }
  function box(key) { var a = boxes(); for (var i = 0; i < a.length; i++) if (a[i].key === key) return a[i]; return null; }
  function runner(key) { var a = runners(); for (var i = 0; i < a.length; i++) if (a[i].key === key) return a[i]; return null; }
  function sideSet(key) { var a = D().sides; for (var i = 0; i < a.length; i++) if (a[i].key === key) return a[i]; return null; }
  function r1(x) { return Math.round(x * 10) / 10; }
  function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }
  function names(s) { var o = {}; LANGS.forEach(function (l) { o[l] = s; }); return o; }
  function loadText(r) {
    var v = Object.keys(r.load || {}).filter(function (k) { return typeof r.load[k] === "number"; }).map(function (k) { return r.load[k]; });
    v = uniq(v).sort(function (a, b) { return a - b; });
    return v.length ? v.join("/") + " kg" : "";
  }
  function range(a) { return a && a.length ? "NL " + a[0] + "–" + a[a.length - 1] : ""; }

  /* ---- sistemele de casă: obiecte DRAWSYS ------------------------------------------------------------------------------------------ */
  function sysOf(b) {
    var all = []; Object.keys(b.nlBy).forEach(function (h) { b.nlBy[h].forEach(function (n) { all.push(n); }); });
    all = uniq(all).sort(function (a, c) { return a - c; });
    var th = b.vis && b.vis.sideTh != null ? b.vis.sideTh : PLACE.sideTh;
    return { id: b.key, metal: 1, more: 1, brand: b.brand, guida: b.runner, lat: b.side,
      n: names(b.brand + " " + b.name),
      hs: Object.assign({}, b.hs), backHs: Object.assign({}, b.backHs), nlBy: b.nlBy, nl: all,
      baseW: 0, baseL: 0, backW: 0, sideTh: th, sideThSchematic: !(b.vis && b.vis.sideTh != null),
      rear: b.rear, lift: PLACE.lift, headroom: PLACE.headroom, chk: 1 };
  }
  function drawsys() { var o = {}; boxes().forEach(function (b) { if (b.selectable) o[b.key] = sysOf(b); }); return o; }
  function drawsysIds() { return boxes().filter(function (b) { return b.selectable; }).map(function (b) { return b.key; }); }

  /* ---- deducțiile ------------------------------------------------------------------------------------------------------------------- */
  function pick(spec, t) {
    if (!spec) return null;
    if (spec.const !== undefined) return spec.const;
    var v = spec.byT && spec.byT[String(Math.round(t * 10) / 10)];
    if (v == null && spec.byT) v = spec.byT[String(Math.round(t))];
    return v == null ? null : v;
  }
  /* cotele casei dintr-un sistem: lățimea fundului și a spatelui din lățimea liberă `clear`, lungimea fundului din NL; null + `fail` dacă
     grosimea laterală a corpului nu e în tabelul sursei */
  function dims(sysId, nl, clear, t) {
    var b = box(sysId); if (!b) return null;
    var w = pick(b.baseW, t), k = pick(b.backW, t), l = pick(b.baseL, t);
    if (w == null || k == null || l == null) {
      var ok = b.baseW && b.baseW.byT ? Object.keys(b.baseW.byT).join("/") : "";
      return { fail: { k: "wDrawMoreKD", sys: b.brand + " " + b.name, t: t, ok: ok } };
    }
    var out = { baseW: r1(clear + w), backW: r1(clear + k), baseL: r1(nl + l), warn: [] };
    if (b.thRef != null && Math.abs(t - b.thRef) > 0.01) out.warn.push({ k: "wDrawMoreTh", sys: b.brand + " " + b.name, t: t, ref: b.thRef });
    if (b.minBackW != null && out.backW < b.minBackW) out.fail = { k: "wDrawMoreMinW", sys: b.brand + " " + b.name, have: Math.round(out.backW), min: b.minBackW };
    return out;
  }
  function heightOk(sys, code, nl) { return !sys || !sys.nlBy || (sys.nlBy[code] || []).indexOf(nl) >= 0; }

  /* ---- contextul planului de sertar ------------------------------------------------------------------------------------------------ */
  /* sys = obiectul DRAWSYS, cfg = corpul, t = grosimea structurii, slideId = glisiera corpului. Torn null pentru tot ce nu vine de aici
     (sistemele vechi și glisierele vechi): planul lor rămâne exact cel de dinainte. */
  function planCtx(sys, cfg, t, slideId) {
    if (sys && sys.more) return { kind: "box", id: sys.id, rear: sys.rear, nl: sys.nl };
    if (sys && !sys.metal && !sys.none) {
      var r = runner(slideId); if (!r) return null;
      var w = r.wood || {}, ctx = { kind: "wood", id: r.key, rear: r.rear, nl: r.nl, skl: w.skl || 0, minBoxW: w.minBoxW, maxSideTh: w.maxSideTh || null, warn: [] };
      if (r.rear == null) ctx.block = { k: "wDrawMoreNoRear", g: r.brand + " " + r.name };
      else if (w.ded_lat == null) ctx.block = { k: "wDrawMoreNoDed", g: r.brand + " " + r.name };
      else if (w.maxSideTh && t > w.maxSideTh + 0.01) ctx.warn.push({ k: "wDrawMoreSideTh", g: r.brand + " " + r.name, t: t, max: w.maxSideTh });
      return ctx;
    }
    return null;
  }

  /* ---- catalog ---------------------------------------------------------------------------------------------------------------------- */
  function guidaEntries(known) {
    var seen = {}; (known || []).forEach(function (i) { seen[i] = 1; });
    return runners().filter(function (r) { return !seen[r.key]; }).map(function (r) {
      var n = {}; LANGS.forEach(function (l) { n[l] = r.name + (loadText(r) ? " · " + loadText(r) : "") + (r.nl.length ? " · " + range(r.nl) : "") + " (" + PAIR[l] + ")"; });
      return { id: r.key, brand: r.brand, n: n, art: r.art || "—", price: 0, chk: 1, more: 1 };
    });
  }
  function zargaEntries(known) {
    var seen = {}; (known || []).forEach(function (i) { seen[i] = 1; });
    return D().sides.filter(function (s) { return !seen[s.key]; }).map(function (s) {
      var n = {}; LANGS.forEach(function (l) { n[l] = s.brand + " " + s.name.replace(/ — laterale \(set\)$/, "") + (s.load_kg ? " · " + s.load_kg + " kg" : "") + ", " + SIDES[l] + " (" + SIDESET[l] + ")" + (s.stub ? " — " + NODIMS[l] : ""); });
      return { id: s.key, brand: s.brand, n: n, art: s.art || "—", price: 0, chk: 1, more: 1, noDims: s.stub ? 1 : 0 };
    });
  }
  /* rezerva din adâncime și deducția laterală, în tabelul de glisiere al nucleului (SLIDE_CATALOG). null în sursă → 0 aici; planul de sertar
     din lemn verifică datele originale (planCtx.block) și nu lasă un 0 să treacă drept valoare. */
  function slideCatalog() {
    var o = {};
    runners().forEach(function (r) { o[r.key] = { brand: r.brand, rear: r.rear != null ? r.rear : 0, ded_lat: r.wood && r.wood.ded_lat != null ? r.wood.ded_lat : 0, more: 1 }; });
    return o;
  }
  function kind(id) { var r = runner(id); return r ? r.kind : null; }

  /* ---- găurirea --------------------------------------------------------------------------------------------------------------------- */
  /* Nicio cotă de gaură a glisierelor din aceste surse nu are reperul ei în text sau tabel: tabelele b1/b2 și perechile Grass sunt cotate pe
     desene, de la un rând de găuri la 37 mm (sau 28) de fața corpului, iar maparea NL → gaură e numai pe desen. Regula 2 a sarcinii: fără
     reper, nu se generează găuri; planul de găurire primește avertismentul `opsDrawMoreNoHoles`. */
  function holePolicy(id) {
    var r = runner(id); if (!r) return null;
    return { usable: false, ref: r.holes && r.holes.ref || "unknown", key: "opsDrawMoreNoHoles", g: r.brand + " " + r.name };
  }
  /* valorile tabelului producătorului pentru un NL, ca informație (nu pentru mașină) */
  function holeTable(id, nl) {
    var r = runner(id); if (!r || !r.holes) return null; var h = r.holes, s = String(nl);
    if (h.b1b2 && h.b1b2[s]) { var v = h.b1b2[s].filter(function (x) { return x != null; }); return { label: "b1/b2", vals: v }; }
    if (h.b1 && h.b1[s] != null) return { label: "b1", vals: [h.b1[s]] };
    if (h.rearPairs) {
      var k = Object.keys(h.rearPairs).filter(function (q) { return h.rearPairs[q][s]; })[0];
      if (k) return { label: k, vals: h.rearPairs[k][s] };
    }
    return null;
  }

  /* ---- fișa de montaj --------------------------------------------------------------------------------------------------------------- */
  /* rândurile suplimentare pentru un plan de sertar (plan.sys.more sau plan.mo); `t` = funcția de traducere a aplicației */
  function sheetLines(plan, t) {
    var out = [], tr = typeof t === "function" ? t : function (k) { return k; };
    var sys = plan && plan.sys, b = sys && sys.more ? box(sys.id) : null, mo = plan && plan.mo;
    var rid = b ? b.runner : (mo && mo.kind === "wood" ? mo.id : null), r = rid ? runner(rid) : null;
    if (!b && !r) return out;
    var rep = function (s, o) { for (var k in o) s = s.split("{" + k + "}").join(o[k]); return s; };
    if (r) {
      var rear = r.rear;
      if (rear != null && plan.nl) out.push(rep(tr("dwMoreDepth"), { mm: plan.nl + rear, nl: plan.nl, k: rear, g: r.name }));
      out.push(rep(tr("dwMoreSlide"), { g: r.brand + " " + r.name, load: loadText(r), art: r.art }));
    }
    if (b) {
      var s = sideSet(b.side);
      out.push(rep(tr("dwMoreSides"), { g: s ? s.name.replace(/ — laterale \(set\)$/, "") : b.name, art: s ? s.art : "—" }));
      var f = b.front || {}, m = f.method && tr("fx_" + f.method);
      if (m) {
        var jig = (f.jig || []).map(function (j) { return j.name + " (" + j.code + ")"; }).join(", ");
        out.push(rep(tr("dwMoreFront"), { m: m, jig: jig ? " · " + tr("dwMoreJig") + " " + jig : "" }));
      }
      if (f.support) out.push(rep(tr("dwMoreSupport"), { s: f.support }));
      if (b.thRef != null) out.push(rep(tr("dwMoreThRef"), { t: b.thRef }));
    }
    if (r && plan.nl) {
      var ht = holeTable(rid, plan.nl);
      if (ht) out.push(rep(tr("dwMoreHoles"), { lab: ht.label, v: ht.vals.join(" / "), nl: plan.nl }));
    }
    return out;
  }

  /* tabelul de glisiere al nucleului (ebanist-core.js, SLIDE_CATALOG) primește glisierele de aici: rezerva din spate pentru adâncimea maximă
     a casei și deducția laterală pentru sertarul din lemn — aceeași tabelă, nu o copie (D-37) */
  if (root.SLIDE_CATALOG) { var _sc = slideCatalog(); Object.keys(_sc).forEach(function (k) { if (!root.SLIDE_CATALOG[k]) root.SLIDE_CATALOG[k] = _sc[k]; }); }

  function sources() { return D().sources.slice(); }
  function conflicts() { return D().conflicts.slice(); }

  return { PLACE: PLACE, LANGS: LANGS, boxes: boxes, box: box, runners: runners, runner: runner, sideSet: sideSet, drawsys: drawsys, drawsysIds: drawsysIds,
    dims: dims, heightOk: heightOk, planCtx: planCtx, guidaEntries: guidaEntries, zargaEntries: zargaEntries, slideCatalog: slideCatalog,
    kind: kind, holePolicy: holePolicy, holeTable: holeTable, sheetLines: sheetLines, sources: sources, conflicts: conflicts, loadText: loadText };
});
