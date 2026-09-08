/* =====================================================================
   Ebanist Order Rail — modul atelier
   ---------------------------------------------------------------------
   Ce face: transformă aplicația din CAD cu paywall în linkul de comandă
   al unui atelier de debitare. Se activează cu `?atelier=<slug>`
   (adresa scurtă `/a/<slug>` redirecționează acolo — vezi DECISIONS.md
   §2.1) și schimbă trei lucruri:

     1. identitatea — logo și nume în header și pe toate documentele;
     2. limitele — gating-ul freemium, butonul Pro și filigranul dispar,
        fiindcă nu clientul plătește aplicația, ci atelierul o oferă;
     3. capătul drumului — butonul principal nu mai e „PDF", ci
        „Trimite comanda la <Atelier>".

   Script clasic, fără dependențe, ca tot restul. Se încarcă ÎNAINTE de
   corpul aplicației: slug-ul trebuie știut sincron, fiindcă de el
   depinde dacă prima tipărire pune filigran sau nu. Configurația
   (prețuri, logo) vine asincron și redesenează după.
   ===================================================================== */
(function (global) {
  "use strict";

  var OR = {
    slug: null,        // slug-ul atelierului, sau null în mod normal
    cfg: null,         // configurația încărcată din /ateliers/<slug>.json
    ready: false,      // configurația a ajuns?
    error: null,       // slug care nu există: se spune, nu se ignoră
    quote: null        // ultimul deviz calculat
  };

  /* --- slug: din query, sau din cale dacă serverul face rewrite --- */
  function readSlug() {
    try {
      var q = new URLSearchParams(global.location.search).get("atelier");
      if (q) return clean(q);
      var m = String(global.location.pathname || "").match(/^\/a\/([^\/?#]+)/);
      if (m) return clean(m[1]);
    } catch (e) {}
    return null;
  }
  /* Slug-ul intră într-o cale de fetch. Orice altceva decât litere mici,
     cifre și liniuță se aruncă — altfel `?atelier=../../etc` devine o
     cerere pe care n-am scris-o noi. */
  function clean(s) {
    s = String(s || "").toLowerCase().trim();
    return /^[a-z0-9][a-z0-9-]{0,40}$/.test(s) ? s : null;
  }

  OR.slug = readSlug();
  OR.active = function () { return !!OR.slug; };

  /* --- configurația --------------------------------------------------- */
  OR.load = function () {
    if (!OR.slug) return Promise.resolve(null);
    return fetch("/ateliers/" + OR.slug + ".json", { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("atelier-" + r.status);
        return r.json();
      })
      .then(function (c) {
        if (!c || !c.price_list) throw new Error("atelier-config-incomplete");
        c.slug = c.slug || OR.slug;
        OR.cfg = c; OR.ready = true; OR.error = null;
        return c;
      })
      .catch(function (e) {
        /* Un slug greșit nu trebuie să lase aplicația într-o stare
           ambiguă — jumătate atelier, jumătate normal. Se dezactivează
           modul complet și se spune de ce. */
        OR.error = String((e && e.message) || e);
        OR.slug = null; OR.cfg = null; OR.ready = false;
        return null;
      });
  };

  /* --- listă de cantități, din starea aplicației ----------------------
     Nu se recalculează nicio cotă aici. `computeTotals` și
     `computeHardware` sunt ale aplicației și rămân singura sursă. */
  OR.boq = function (p, deps) {
    deps = deps || {};
    var totals = deps.computeTotals(p);
    var hw = deps.computeHardware(p, deps.settings) || [];
    var byId = deps.matIdByLabel || function () { return null; };
    var isAcc = deps.isAccessoryMat || function () { return false; };

    /* Accesoriile — bara de umeraș, piciorușele, geamul — sunt piese în
       distinta, dar nu se taie din placă. Aplicația le scoate din m² de
       mult; prețul le scoate la fel, altfel o bară de 760 mm ar fi
       facturată ca 0,019 m² de PAL, adică nimic, iar atelierul ar
       plăti-o din buzunar. */
    var materials = [], accessories = 0;
    for (var k in totals.mats) {
      var m = totals.mats[k];
      if (isAcc(m.label)) { accessories += m.pcs; continue; }
      materials.push({ id: byId(m.label), label: m.label, area: m.area, edge: m.edge });
    }

    /* Găurile: OPERAȚII facturabile, nu găuri fizice. O balama e una
       singură, deși are o cupă Ø35 și două șuruburi — așa o socotește și
       atelierul când face devizul cu creionul. */
    var HOLE_KEYS = { hwCern: 1, hwSup: 1, hwConn: 1, hwGuida: 1 };
    var holes = 0;
    for (var i = 0; i < hw.length; i++) {
      if (HOLE_KEYS[hw[i].k]) holes += (+hw[i].qty || 0);
    }

    var cutouts = 0, pieces = 0;
    for (var j = 0; j < p.pieces.length; j++) {
      var x = p.pieces[j];
      pieces += (+x.pz || 0);
      cutouts += (deps.scList(x) || []).length * (+x.pz || 0);
    }

    var boq = {
      materials: materials,
      accessories: accessories,
      edgeTh: deps.settings && deps.settings.edgeTh != null ? deps.settings.edgeTh : 0.8,
      holes: holes, cutouts: cutouts, pieces: pieces
    };

    /* Defalcarea pe corp. Ferăria per corp o dă tot `computeHardware`,
       cu al treilea argument; fără el n-am putea împărți găurile și
       suma corpurilor n-ar mai da totalul. */
    var hwMods = deps.computeHardware(p, deps.settings, true);
    var modsHw = (hwMods && hwMods.mods) || null;
    var per = {};
    for (var q = 0; q < p.pieces.length; q++) {
      var pc = p.pieces[q], mod = pc.modulo || "—";
      if (!per[mod]) per[mod] = { materials: [], _mat: {}, edgeTh: boq.edgeTh, holes: 0, cutouts: 0, pieces: 0, accessories: 0 };
      var e = per[mod];
      e.pieces += (+pc.pz || 0);
      e.cutouts += (deps.scList(pc) || []).length * (+pc.pz || 0);
      if (isAcc(pc.materiale)) { e.accessories += (+pc.pz || 0); continue; }
      var key = deps.normMat(pc.materiale);
      if (!e._mat[key]) {
        e._mat[key] = { id: byId(pc.materiale), label: pc.materiale, area: 0, edge: 0 };
        e.materials.push(e._mat[key]);
      }
      e._mat[key].area += pc.lung * pc.larg / 1e6 * pc.pz;
      e._mat[key].edge += deps.bandingMm(pc.bordo, pc.lung, pc.larg, pc.angL, pc.angR, pc.shape) * pc.pz / 1000;
    }
    if (modsHw) {
      for (var mname in per) {
        var mh = modsHw[mname];
        if (!mh) continue;
        var n = 0;
        for (var kk in HOLE_KEYS) n += (+mh[kk] || 0);
        per[mname].holes = n;
      }
    }
    for (var nm in per) delete per[nm]._mat;
    boq.perModule = per;
    return boq;
  };

  OR.price = function (p, deps) {
    if (!OR.ready || !p) return null;
    var q = global.EBPrice.quote(OR.boq(p, deps), OR.cfg.price_list, { currency: OR.cfg.currency });
    OR.quote = q;
    return q;
  };

  /* --- formatare bani, în limba atelierului --------------------------- */
  OR.fmtMoney = function (n, lang) {
    var cur = (OR.cfg && OR.cfg.currency) || "EUR";
    try {
      return new Intl.NumberFormat(
        lang === "ro" ? "ro-RO" : lang === "fr" ? "fr-FR" : lang === "en" ? "en-GB" : "it-IT",
        { style: "currency", currency: cur, minimumFractionDigits: 2 }
      ).format(n);
    } catch (e) {
      return (Math.round(n * 100) / 100).toFixed(2) + " " + cur;
    }
  };

  /* --- linkul de WhatsApp ---------------------------------------------
     `wa.me` nu cere niciun cont, nicio cheie și niciun serviciu plătit:
     e o adresă. Numărul se scrie fără `+` și fără spații, altfel
     WhatsApp îl refuză în tăcere. */
  OR.waLink = function (text) {
    var num = String((OR.cfg && OR.cfg.whatsapp) || "").replace(/[^0-9]/g, "");
    if (!num) return null;
    return "https://wa.me/" + num + "?text=" + encodeURIComponent(text);
  };

  global.OrderRail = OR;
  if (typeof module !== "undefined" && module.exports) module.exports = OR;
})(typeof window !== "undefined" ? window : globalThis);
