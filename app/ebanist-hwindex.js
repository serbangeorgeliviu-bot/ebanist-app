/* Ebanist — FAZA H (H.1): indexul unic al feroneriei și căutarea. PUR: fără DOM, fără stare.
 *
 * Specificația: ebanist-hq/01-arhitectura/Ebanist-Feronerie-Selector-v1.md. Indexul NU copiază datele catalogului: construiește, din HWDB și din lista
 * de categorii (HW_CATS), câte o intrare pe articol, cu slotul funcțional, marca, numele în toate limbile, codul și textul de căutare.
 *
 *   EBHwIndex.SLOTS                          grupele funcționale, în ordinea afișării
 *   EBHwIndex.slotOf(cat)                    slotul unei categorii ("altele" dacă nu e cunoscută)
 *   EBHwIndex.build(HWDB, cats, opts)        → [{ id, cat, slot, brand, names:{it,ro,…}, art, price, est, chk, hay }]
 *   EBHwIndex.search(index, query, filters)  → intrările care conțin TOȚI termenii, cele mai bune întâi
 *   EBHwIndex.facets(index, filters)         → { slot:{id:n}, brand:{nume:n}, cat:{id:n} } pe rezultatele filtrate
 *   EBHwIndex.norm(s)                        fără diacritice, litere mici, punctuație → spațiu
 *
 * filters = { slot, brand, cat, text } — toate opționale; `text` e interogarea.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EBHwIndex = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  /* ordinea = ordinea în panou; `key` = cheia I18N a etichetei (adăugată în ebanist-hwindex-i18n.js) */
  var SLOTS = [
    { id: "balamale", key: "hxSlotHinges" },
    { id: "deschidere", key: "hxSlotOpening" },
    { id: "ridicare", key: "hxSlotLift" },
    { id: "glisante", key: "hxSlotSliding" },
    { id: "sertare", key: "hxSlotDrawers" },
    { id: "colt", key: "hxSlotCorner" },
    { id: "imbinari", key: "hxSlotJoints" },
    { id: "suspendare", key: "hxSlotSuspension" },
    { id: "rafturi", key: "hxSlotShelves" },
    { id: "iluminat", key: "hxSlotLight" },
    { id: "altele", key: "hxSlotOther" }
  ];

  var SLOT_OF = {
    cern: "balamale",
    push: "deschidere", man: "deschidere", manS: "deschidere", gola: "deschidere", golac: "deschidere", golaj: "deschidere",
    lift: "ridicare", liftdrv: "ridicare", liftpsu: "ridicare", liftsw: "ridicare", gaspist: "ridicare", lbal: "ridicare",
    slide: "glisante", bin: "glisante", fold: "glisante",
    guida: "sertare", zarga: "sertare", pushd: "sertare", pushpsu: "sertare",
    corner: "colt", rotbox: "colt",
    conn: "imbinari", fissf: "imbinari", fissp: "imbinari",
    susp: "suspendare", suprail: "suspendare",
    sup: "rafturi", asta: "rafturi", pied: "rafturi", gamba: "rafturi", doga: "rafturi", doga2: "rafturi", piecent: "rafturi",
    ledstrip: "iluminat", leddrv: "iluminat", leddim: "iluminat", ledsw: "iluminat", ledmains: "iluminat"
  };
  /* ce rămâne în «altele» e ales: aw (profil anti-curbare), tblext, letto, trav, feltro, soc, picacc */

  function slotOf(cat) { return SLOT_OF[cat] || "altele"; }

  var DIA = { "ă": "a", "â": "a", "î": "i", "ș": "s", "ş": "s", "ț": "t", "ţ": "t", "é": "e", "è": "e", "ê": "e", "ë": "e", "à": "a", "á": "a", "ä": "a", "ö": "o", "ó": "o",
              "ò": "o", "ü": "u", "ú": "u", "ù": "u", "ç": "c", "ñ": "n", "ß": "ss", "ł": "l", "ą": "a", "ę": "e", "ś": "s", "ź": "z", "ż": "z", "ć": "c", "ń": "n", "ì": "i", "í": "i" };
  function norm(s) {
    s = String(s == null ? "" : s).toLowerCase();
    var o = "";
    for (var i = 0; i < s.length; i++) o += DIA[s[i]] != null ? DIA[s[i]] : s[i];
    return o.replace(/[^a-z0-9]+/g, " ").replace(/^ +| +$/g, "");
  }

  var LANGS = ["it", "ro", "en", "fr", "de", "pl", "es"];

  function namesOf(it) {
    var n = it.n, out = {}, i, L;
    if (typeof n === "string") { for (i = 0; i < LANGS.length; i++) out[LANGS[i]] = n; return out; }
    n = n || {};
    for (i = 0; i < LANGS.length; i++) { L = LANGS[i]; out[L] = n[L] || n.it || n.en || it.name || ""; }
    return out;
  }

  /* HWDB: { cat: [articol] }; cats: [[cat, cheieEtichetă]] (HW_CATS); opts.hwAdd: articolele proprii ale utilizatorului ({cat,…}) */
  function build(HWDB, cats, opts) {
    opts = opts || {};
    var idx = [], seen = {}, order = {};
    (cats || []).forEach(function (c) { order[c[0]] = true; });
    function push(cat, it, own) {
      if (!it || !it.id) return;
      var key = cat + "|" + it.id; if (seen[key]) return; seen[key] = 1;
      var names = namesOf(it), brand = it.brand && it.brand !== "—" ? it.brand : "";
      var hay = norm([brand, it.art || "", it.id, cat, names.it, names.ro, names.en, names.fr, names.de, names.pl, names.es].join(" "));
      idx.push({ id: it.id, cat: cat, slot: slotOf(cat), brand: brand, names: names, art: it.art && it.art !== "—" ? String(it.art) : "",
                 price: it.price == null ? null : it.price, est: !!it.est, chk: !!it.chk, own: !!own, hay: hay,
                 nameN: norm(names.it + " " + names.en + " " + names.ro), artN: norm(it.art || ""), brandN: norm(brand) });
    }
    Object.keys(HWDB || {}).forEach(function (cat) { (HWDB[cat] || []).forEach(function (it) { push(cat, it, false); }); });
    (opts.hwAdd || []).forEach(function (it) { if (it && it.cat) push(it.cat, it, true); });
    idx.unknownCats = Object.keys(HWDB || {}).filter(function (c) { return !order[c] && c !== "manS"; });
    return idx;
  }

  function matches(e, f) {
    if (f.slot && e.slot !== f.slot) return false;
    if (f.brand && e.brand !== f.brand) return false;
    if (f.cat && e.cat !== f.cat) return false;
    return true;
  }

  /* scor: cod exact > nume care începe cu termenul > marca > conține; toți termenii trebuie să existe */
  function search(index, query, filters) {
    var f = filters || {}, q = norm(query == null ? f.text : query), terms = q ? q.split(" ") : [], out = [];
    for (var i = 0; i < index.length; i++) {
      var e = index[i]; if (!matches(e, f)) continue;
      var score = 0, ok = true;
      for (var t = 0; t < terms.length; t++) {
        var w = terms[t];
        if (e.artN === w) score += 100;
        else if (e.artN && e.artN.indexOf(w) === 0) score += 60;
        else if (e.nameN.indexOf(w) === 0 || (" " + e.nameN).indexOf(" " + w) >= 0) score += 30;
        else if (e.brandN.indexOf(w) === 0) score += 20;
        else if (e.hay.indexOf(w) >= 0) score += 5;
        else { ok = false; break; }
      }
      if (ok) out.push({ e: e, s: score, i: i });
    }
    out.sort(function (a, b) { return b.s - a.s || a.i - b.i; });
    return out.map(function (x) { return x.e; });
  }

  /* numărul de rezultate pe fațetă, ținând cont de celelalte filtre (nu de al ei) */
  function facets(index, filters) {
    var f = filters || {}, res = { slot: {}, brand: {}, cat: {} };
    ["slot", "brand", "cat"].forEach(function (dim) {
      var g = {}; ["slot", "brand", "cat"].forEach(function (k) { if (k !== dim && f[k]) g[k] = f[k]; });
      g.text = f.text;
      search(index, null, g).forEach(function (e) { var v = e[dim]; if (v !== "") res[dim][v] = (res[dim][v] || 0) + 1; });
    });
    return res;
  }

  return { SLOTS: SLOTS, SLOT_OF: SLOT_OF, slotOf: slotOf, build: build, search: search, facets: facets, norm: norm, LANGS: LANGS };
});
