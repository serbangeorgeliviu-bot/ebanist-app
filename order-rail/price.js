/* =====================================================================
   Ebanist Order Rail — motorul de preț
   ---------------------------------------------------------------------
   Pur: intră o listă de cantități, iese un deviz. Fără DOM, fără state,
   fără geometrie. Geometria e treaba lui `ebanist-core.js` și nu se
   atinge de aici — motorul ăsta doar CITEȘTE ce a calculat ea.

   Se rulează și în browser (window.EBPrice) și în node (require), ca să
   poată fi probat fără browser.

   Ce se numără și de ce, pe scurt (lung în DECISIONS.md §4):

     plăci      aria NETĂ a pieselor, per material, × preț/m²
     cant       metri liniari, la grosimea de cant din setări, × preț/ml
     găuri      OPERAȚII de găurire facturabile, nu găuri fizice
     decupaje   fiecare scasso, separat: altă sculă, alt timp
     manoperă   per piesă tăiată

   Aria e cea netă și nu cea a colilor cumpărate: atelierul taie din
   colile lui și își pune marja în preț/m². Să-i facturezi clientului
   final colile întregi plus pierderile ar însemna să-i vinzi deșeul
   altcuiva.
   ===================================================================== */
(function (global) {
  "use strict";

  /* Rotunjire la bani, o SINGURĂ dată, la capăt. Aceeași disciplină ca la
     milimetri: fără rotunjiri în lanț, altfel un deviz cu treizeci de
     linii pierde câțiva bani pe drum și nu se mai potrivește cu suma. */
  function money(n) {
    if (!isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
  }

  /* Grosimea de cant se dă în mm (0.4 / 0.8 / 2) și cheile din listă sunt
     text. Cine scrie 0.80 în config trebuie să nimerească același preț ca
     cine scrie 0.8, altfel prețul se schimbă după cum a fost tastat. */
  function edgeKey(th) {
    var v = parseFloat(th);
    if (!isFinite(v) || v <= 0) return null;
    return String(Math.round(v * 100) / 100);
  }

  function edgePrice(list, th) {
    var tbl = (list && list.edge_ml) || {};
    var k = edgeKey(th);
    if (k != null && tbl[k] != null) return +tbl[k];
    /* Grosime necotată: se ia cea mai apropiată din listă, nu zero. Un
       cant care nu costă nimic e o factură pe care atelierul o pierde. */
    var best = null, bestD = Infinity;
    for (var key in tbl) {
      var d = Math.abs(parseFloat(key) - parseFloat(th));
      if (isFinite(d) && d < bestD) { bestD = d; best = +tbl[key]; }
    }
    return best == null ? 0 : best;
  }

  /* --- devizul ---------------------------------------------------------
     `boq` (bill of quantities) e tot ce trebuie știut, deja măsurat:

       { materials: [{ id, label, area, edge }],   area m², edge m
         edgeTh:    0.8,                            mm
         holes:     42,                             operații
         cutouts:   3,
         pieces:    28,
         perModule: { "Corp 1": {...aceleași câmpuri...} }   opțional }

     Ies liniile, netul, TVA-ul, totalul — și AVERTISMENTELE, care sunt
     partea la fel de importantă: un material care a căzut pe prețul
     implicit trebuie spus, nu ascuns într-o sumă. */
  function quote(boq, list, opt) {
    boq = boq || {};
    list = list || {};
    opt = opt || {};
    var lines = [], warnings = [];
    var m2tbl = list.m2 || {};
    var def = list.default_m2 != null ? +list.default_m2 : 0;

    /* --- plăci, o linie per material --- */
    var mats = boq.materials || [];
    for (var i = 0; i < mats.length; i++) {
      var m = mats[i];
      var area = +m.area || 0;
      if (area <= 0) continue;
      var unit, fallback = false;
      if (m.id && m2tbl[m.id] != null) unit = +m2tbl[m.id];
      else { unit = def; fallback = true; }
      if (fallback) warnings.push({ code: "material_not_priced", material: m.label || m.id, unit: unit });
      lines.push({
        kind: "panel", key: m.id || m.label, label: m.label || m.id,
        qty: Math.round(area * 1000) / 1000, unitName: "m2",
        unit: unit, total: money(area * unit), fallback: fallback
      });
    }

    /* --- cant, o singură linie: e același ABS pe tot proiectul --- */
    var edge = 0;
    for (var j = 0; j < mats.length; j++) edge += +mats[j].edge || 0;
    if (edge > 0) {
      var eu = edgePrice(list, boq.edgeTh);
      lines.push({
        kind: "edge", key: "edge", label: "edge", th: boq.edgeTh,
        qty: Math.round(edge * 100) / 100, unitName: "m",
        unit: eu, total: money(edge * eu), fallback: false
      });
    }

    /* --- găuri, decupaje, manoperă --- */
    function simple(kind, qty, unit) {
      qty = Math.round(+qty || 0);
      if (qty <= 0) return;
      unit = +unit || 0;
      lines.push({ kind: kind, key: kind, label: kind, qty: qty, unitName: "pcs",
                   unit: unit, total: money(qty * unit), fallback: false });
    }
    simple("accessory", boq.accessories, list.accessory);
    simple("hole", boq.holes, list.hole);
    simple("cutout", boq.cutouts, list.cutout);
    simple("labour", boq.pieces, list.labour_piece);

    var net = 0;
    for (var k = 0; k < lines.length; k++) net += lines[k].total;
    net = money(net);

    /* Comanda minimă se aplică pe NET, înainte de TVA, și se arată ca
       linie proprie: un client care vede totalul sărind fără explicație
       crede că a fost păcălit. */
    var minOrder = +list.min_order || 0;
    var minTopUp = 0;
    if (minOrder > 0 && net < minOrder) {
      minTopUp = money(minOrder - net);
      lines.push({ kind: "min_order", key: "min_order", label: "min_order",
                   qty: 1, unitName: "pcs", unit: minTopUp, total: minTopUp, fallback: false });
      net = money(minOrder);
      warnings.push({ code: "below_min_order", min: minOrder });
    }

    var vatPct = +list.vat || 0;
    var vat = money(net * vatPct / 100);

    var out = {
      currency: opt.currency || list.currency || "EUR",
      lines: lines,
      net: net,
      vatPct: vatPct,
      vat: vat,
      total: money(net + vat),
      warnings: warnings
    };

    /* Defalcarea pe corp: aceeași funcție, aplicată pe fiecare corp. TVA-ul
       și comanda minimă NU se aplică pe corp — sunt ale comenzii, iar
       împărțite pe corpuri nu s-ar mai aduna la total. */
    if (boq.perModule) {
      out.modules = {};
      var perList = {};
      for (var p in list) perList[p] = list[p];
      perList.vat = 0; perList.min_order = 0;
      for (var name in boq.perModule) {
        var sub = quote(boq.perModule[name], perList, opt);
        out.modules[name] = { net: sub.net, lines: sub.lines };
      }
    }
    return out;
  }

  /* Suma corpurilor trebuie să dea netul comenzii, mai puțin comanda
     minimă. Dacă nu dă, undeva se numără de două ori — și se vede aici,
     nu în fața clientului. */
  function modulesMatchTotal(q) {
    if (!q || !q.modules) return true;
    var s = 0;
    for (var n in q.modules) s += q.modules[n].net;
    var minLine = 0;
    for (var i = 0; i < q.lines.length; i++) if (q.lines[i].kind === "min_order") minLine = q.lines[i].total;
    return Math.abs(money(s) - money(q.net - minLine)) < 0.05;
  }

  global.EBPrice = { money: money, edgeKey: edgeKey, edgePrice: edgePrice,
                     quote: quote, modulesMatchTotal: modulesMatchTotal };
  if (typeof module !== "undefined" && module.exports) module.exports = global.EBPrice;
})(typeof window !== "undefined" ? window : globalThis);
