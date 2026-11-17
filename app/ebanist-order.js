/* ebanist-order.js — lista de feronerie pentru furnizor, grupată pe marcă (pur, fără DOM; 5.80.0).
   Intrare: rândurile din computeHardware ({qty, prod:{brand, art, name}}). Ieșire: grupe, text pentru e-mail/WhatsApp și CSV.
   Nimic nu se inventează: un articol fără cod apare fără cod, nu cu unul presupus. Prețurile nu intră (sunt private, D-109). */
(function (root) {
  "use strict";
  var NOBRAND = "—";
  function qtyOf(v) { v = +v; return Math.round(v * 100) / 100; }
  function nameOf(p, fallback) { return String((p && (p.name || p.nm)) || fallback || "").trim(); }
  /* grupe pe marcă, articolele identice (aceeași marcă + cod + nume) însumate, în ordinea: mărci A–Z, „fără marcă" la urmă */
  function group(rows, fallbackName) {
    var by = {}, order = [];
    (rows || []).forEach(function (r) {
      var q = qtyOf(r && r.qty); if (!(q > 0)) return;
      var p = r.prod || null, brand = (p && p.brand) || NOBRAND, art = (p && p.art) ? String(p.art).trim() : "", name = nameOf(p, fallbackName ? fallbackName(r) : "");
      var g = by[brand] || (by[brand] = { brand: brand, items: [], idx: {} });
      if (!order.length || order.indexOf(brand) < 0) order.push(brand);
      var k = art + "\u0000" + name, i = g.idx[k];
      if (i == null) { g.idx[k] = g.items.length; g.items.push({ art: art, name: name, qty: q }); } else g.items[i].qty = qtyOf(g.items[i].qty + q);
    });
    return order.sort(function (a, b) { return a === NOBRAND ? 1 : b === NOBRAND ? -1 : a.localeCompare(b); })
      .map(function (b) { var g = by[b]; return { brand: g.brand, items: g.items }; });
  }
  function text(groups, meta) {
    meta = meta || {};
    var out = [];
    if (meta.header) out.push(meta.header + (meta.project ? " — " + meta.project : ""));
    if (meta.company) out.push(meta.company);
    if (meta.date) out.push(meta.date);
    groups.forEach(function (g) {
      out.push("", g.brand === NOBRAND ? "" : g.brand);
      g.items.forEach(function (it) { out.push(it.qty + " × " + (it.art ? it.art + " — " : "") + it.name); });
    });
    if (meta.note) out.push("", meta.note);
    return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }
  function csvCell(v) { v = String(v == null ? "" : v); return /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  /* CSV cu ; (Excel în RO/IT/FR), UTF-8; coloane: marcă, cod, denumire, cantitate */
  function csv(groups, head) {
    var lines = [(head || ["brand", "code", "name", "qty"]).map(csvCell).join(";")];
    groups.forEach(function (g) { g.items.forEach(function (it) { lines.push([g.brand === NOBRAND ? "" : g.brand, it.art, it.name, it.qty].map(csvCell).join(";")); }); });
    return lines.join("\r\n") + "\r\n";
  }
  root.EBOrder = { group: group, text: text, csv: csv };
})(typeof globalThis !== "undefined" ? globalThis : this);
