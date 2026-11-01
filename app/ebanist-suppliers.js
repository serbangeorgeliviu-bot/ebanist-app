/* Ebanist — prețurile private de furnizor, importate din CSV (D-109, varianta A).
 *
 * Partea PURĂ: parsare CSV, validare, potrivire cu catalogul, îmbinare, export.
 * Fără rețea, fără DOM, ca să se poată testa în Node (test/suppliers.test.js).
 * Ecranul (Setări → Catalog → Furnizori) stă în index.html.
 *
 * REGULI (D-109, 01-arhitectura/Ebanist-Furnizori-Preturi-v1.md):
 *   - prețurile de furnizor sunt PRIVATE: stau în `settings.suppliers`, local, și
 *     NU pleacă niciodată în sincronizarea cloud (stripPrivate / keepPrivate);
 *   - un rând fără preț = necunoscut, nu intră; nimic nu se inventează;
 *   - un rând fără TVA (`incl`/`excl`) sau fără monedă e respins;
 *   - fiecare preț păstrează sursa, data și TVA-ul, fără rotunjiri în lanț
 *     (prețul se păstrează cum a venit; se rotunjește numai la afișare).
 *
 * Gira nel browser (<script src>) e in Node (require).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EBSuppliers = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* chei din `settings` care nu ies niciodată din dispozitiv */
  var PRIVATE_KEYS = ["suppliers"];

  function stripPrivate(settings) {
    var out = {}, k;
    for (k in settings) if (Object.prototype.hasOwnProperty.call(settings, k) && PRIVATE_KEYS.indexOf(k) < 0) out[k] = settings[k];
    return out;
  }
  /* la preluarea setărilor din cloud, cheile private rămân cele locale */
  function keepPrivate(next, prev) {
    prev = prev || {};
    PRIVATE_KEYS.forEach(function (k) { if (prev[k] !== undefined) next[k] = prev[k]; });
    return next;
  }

  /* ---------- CSV ---------- */
  function detectDelimiter(text) {
    var line = "", inQ = false, i, c;
    for (i = 0; i < text.length; i++) {
      c = text.charAt(i);
      if (c === '"') inQ = !inQ;
      if (!inQ && (c === "\n" || c === "\r")) break;
      line += c;
    }
    var best = ";", bestN = -1;
    [";", "\t", ","].forEach(function (d) {
      var n = 0, q = false, j;
      for (j = 0; j < line.length; j++) { if (line.charAt(j) === '"') q = !q; else if (!q && line.charAt(j) === d) n++; }
      if (n > bestN) { best = d; bestN = n; }
    });
    return best;
  }
  function parseCSV(text, delimiter) {
    text = String(text == null ? "" : text).replace(/^﻿/, "");
    var d = delimiter || detectDelimiter(text);
    var rows = [], row = [], cell = "", inQ = false, i, c;
    for (i = 0; i < text.length; i++) {
      c = text.charAt(i);
      if (inQ) {
        if (c === '"') { if (text.charAt(i + 1) === '"') { cell += '"'; i++; } else inQ = false; }
        else cell += c;
      } else if (c === '"') inQ = true;
      else if (c === d) { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text.charAt(i + 1) === "\n") i++;
        row.push(cell); cell = ""; rows.push(row); row = [];
      } else cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return { rows: rows.filter(function (r) { return r.some(function (x) { return String(x).trim() !== ""; }); }), delimiter: d };
  }

  /* ---------- normalizări ---------- */
  function fold(s) { return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function normHeader(h) { return fold(h).replace(/[^a-z0-9]/g, ""); }
  var ALIASES = {
    hwid: ["hwid", "idcatalog", "catalogid"],
    art: ["art", "cod", "code", "codice", "codarticol", "articol", "article", "sku", "artnr", "codproducator", "mfrcode"],
    name: ["name", "nume", "denumire", "descrizione", "description", "descriere", "produs"],
    price: ["price", "pret", "prezzo", "preis", "prix", "pretunitar", "pretbucata"],
    vat: ["vat", "tva", "iva", "mwst", "taxe"],
    currency: ["currency", "moneda", "valuta", "wahrung", "devise", "cur"],
    readat: ["readat", "data", "date", "datum", "dataletturii", "datapret"],
    source: ["source", "sursa", "fonte", "quelle", "furnizor", "supplier"],
    pack: ["pack", "conf", "confezione", "bucati", "buc", "unitate", "unit"],
    url: ["url", "link", "pagina"]
  };
  function mapColumns(header) {
    var idx = {};
    header.forEach(function (h, i) {
      var n = normHeader(h), k;
      for (k in ALIASES) if (idx[k] === undefined && ALIASES[k].indexOf(n) >= 0) { idx[k] = i; break; }
    });
    return idx;
  }

  /* 4,05 · 4.05 · 1.234,56 · 1,234.56 · "€ 4,05" · "4,05 €". NaN dacă e ambiguu sau nu e număr. */
  function parseNumber(s) {
    var t = String(s == null ? "" : s).replace(/[^\d.,\-]/g, "");
    if (!t || !/\d/.test(t)) return NaN;
    var hasDot = t.indexOf(".") >= 0, hasCom = t.indexOf(",") >= 0;
    if (hasDot && hasCom) {
      var dec = t.lastIndexOf(".") > t.lastIndexOf(",") ? "." : ",", th = dec === "." ? "," : ".";
      t = t.split(th).join("").replace(dec, ".");
    } else if (hasCom || hasDot) {
      var sep = hasCom ? "," : ".", parts = t.split(sep);
      if (parts.length > 2) {                       // 1.234.567 = mii; 1,2,3 = nu e preț
        if (parts.slice(1).every(function (p) { return p.length === 3; })) t = parts.join("");
        else return NaN;
      } else if (parts[1].length === 3 && sep === ",") return NaN;   // „1,234”: mii sau zecimale, nu ghicim
      else t = parts.join(".");
    }
    var v = Number(t);
    return isFinite(v) ? v : NaN;
  }
  var VAT_INCL = ["incl", "inclus", "inclusa", "included", "ttc", "brut", "brutto", "gross", "cutva", "ivainclusa", "ivato", "con iva", "coniva"];
  var VAT_EXCL = ["excl", "exclus", "exclusa", "excluded", "ht", "net", "netto", "faratva", "senzaiva", "senza iva", "imponibile", "ohnemwst"];
  function normVat(s) {
    var n = fold(s).replace(/[^a-z]/g, "");
    if (!n) return null;
    if (VAT_INCL.map(function (x) { return x.replace(/ /g, ""); }).indexOf(n) >= 0) return "incl";
    if (VAT_EXCL.map(function (x) { return x.replace(/ /g, ""); }).indexOf(n) >= 0) return "excl";
    return null;
  }
  var CUR_SYM = { "€": "EUR", "eur": "EUR", "euro": "EUR", "lei": "RON", "leu": "RON", "ron": "RON", "chf": "CHF", "fr": "CHF", "sek": "SEK", "kr": "SEK",
    "pln": "PLN", "zl": "PLN", "usd": "USD", "$": "USD", "gbp": "GBP", "£": "GBP" };
  function normCurrency(s) {
    var t = String(s == null ? "" : s).trim().toLowerCase();
    if (!t) return null;
    if (CUR_SYM[t]) return CUR_SYM[t];
    return /^[a-z]{3}$/.test(t) ? t.toUpperCase() : null;
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function validDate(y, m, d) { var x = new Date(Date.UTC(y, m - 1, d)); return x.getUTCFullYear() === y && x.getUTCMonth() === m - 1 && x.getUTCDate() === d; }
  function normDate(s) {
    var t = String(s == null ? "" : s).trim(), m;
    if (!t) return "";
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t))) return validDate(+m[1], +m[2], +m[3]) ? m[1] + "-" + pad(+m[2]) + "-" + pad(+m[3]) : null;
    if ((m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(t))) return validDate(+m[3], +m[2], +m[1]) ? m[3] + "-" + pad(+m[2]) + "-" + pad(+m[1]) : null;
    return null;
  }
  function normArt(s) { return fold(s).replace(/[^a-z0-9]/g, ""); }

  /* ---------- import ---------- */
  /* Întoarce { ok, reason?, delimiter, items, unknown, errors:[{line,code}], duplicates }.
     Coduri de eroare: key, price, vat, cur, date. Fișier fără coloanele obligatorii: ok:false, reason:"cols". */
  function importCSV(text, opts) {
    opts = opts || {};
    var today = opts.today || new Date().toISOString().slice(0, 10);
    var p = parseCSV(text);
    var res = { ok: false, delimiter: p.delimiter, items: [], unknown: 0, errors: [], duplicates: 0, missing: [] };
    if (p.rows.length < 2) { res.reason = "empty"; return res; }
    var idx = mapColumns(p.rows[0]);
    if (idx.hwid === undefined && idx.art === undefined) res.missing.push("art");
    ["price", "vat", "currency"].forEach(function (k) { if (idx[k] === undefined) res.missing.push(k); });
    if (res.missing.length) { res.reason = "cols"; return res; }
    var byKey = {}, i, r, g = function (k) { return idx[k] === undefined ? "" : String(r[idx[k]] == null ? "" : r[idx[k]]).trim(); };
    for (i = 1; i < p.rows.length; i++) {
      r = p.rows[i];
      var line = i + 1, hwId = g("hwid"), art = g("art");
      if (!hwId && !art) { res.errors.push({ line: line, code: "key" }); continue; }
      var rawPrice = g("price");
      if (rawPrice === "") { res.unknown++; continue; }             // fără preț = necunoscut
      var price = parseNumber(rawPrice);
      if (!(price > 0)) { res.errors.push({ line: line, code: "price" }); continue; }
      var vat = normVat(g("vat"));
      if (!vat) { res.errors.push({ line: line, code: "vat" }); continue; }
      var cur = normCurrency(g("currency"));
      if (!cur) { res.errors.push({ line: line, code: "cur" }); continue; }
      var rawDate = g("readat"), readAt = normDate(rawDate);
      if (readAt === null) { res.errors.push({ line: line, code: "date" }); continue; }
      var item = { key: hwId || ("art:" + normArt(art)), hwId: hwId || null, art: art, name: g("name"), price: price, vat: vat, currency: cur,
        readAt: readAt || today, source: g("source"), pack: g("pack"), url: g("url") };
      if (byKey[item.key] !== undefined) { res.duplicates++; res.items[byKey[item.key]] = item; }
      else { byKey[item.key] = res.items.length; res.items.push(item); }
    }
    res.ok = true;
    return res;
  }

  /* leagă rândurile fără hwId de catalog după cod ({id, art}); un cod care se potrivește la mai multe articole rămâne nelegat */
  function matchCatalog(items, catalog) {
    var byId = {}, byArt = {};
    (catalog || []).forEach(function (c) {
      byId[c.id] = true;
      String(c.art || "").split(/[\s+,;]+/).forEach(function (tok) {
        var n = normArt(tok); if (n.length < 4) return;
        (byArt[n] = byArt[n] || {})[c.id] = true;
      });
    });
    var matched = 0;
    items.forEach(function (it) {
      if (it.hwId) { if (byId[it.hwId]) matched++; return; }
      var ids = byArt[normArt(it.art)];
      var keys = ids ? Object.keys(ids) : [];
      if (keys.length === 1) { it.hwId = keys[0]; matched++; }
    });
    return matched;
  }

  function slug(s) { return fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "furnizor"; }
  /* adaugă/actualizează un furnizor; un rând cu aceeași cheie se înlocuiește, nu se dublează */
  function mergeSupplier(list, meta, items, now) {
    list = (list || []).map(function (s) { return s; });
    var id = meta.id || slug(meta.name), at = (now || new Date().toISOString().slice(0, 10));
    var k = -1, i;
    for (i = 0; i < list.length; i++) if (list[i].id === id) { k = i; break; }
    var cur = k >= 0 ? list[k] : { id: id, name: meta.name, country: meta.country || "", items: [] };
    var map = {}, out = [];
    cur.items.forEach(function (it) { map[it.key] = out.length; out.push(it); });
    items.forEach(function (it) { if (map[it.key] !== undefined) out[map[it.key]] = it; else { map[it.key] = out.length; out.push(it); } });
    var next = { id: id, name: meta.name || cur.name, country: meta.country || cur.country || "", items: out, importedAt: at };
    if (k >= 0) list[k] = next; else list.push(next);
    return list;
  }
  function removeSupplier(list, id) { return (list || []).filter(function (s) { return s.id !== id; }); }
  function find(list, supplierId, hwIdOrArt) {
    var s = (list || []).filter(function (x) { return x.id === supplierId; })[0];
    if (!s) return null;
    var a = normArt(hwIdOrArt);
    for (var i = 0; i < s.items.length; i++) {
      var it = s.items[i];
      if (it.hwId === hwIdOrArt || it.key === hwIdOrArt || (a && normArt(it.art) === a)) return it;
    }
    return null;
  }
  function ageDays(readAt, today) {
    var a = Date.parse(readAt), b = Date.parse(today || new Date().toISOString().slice(0, 10));
    return isFinite(a) && isFinite(b) ? Math.round((b - a) / 86400000) : null;
  }

  /* ---------- export ---------- */
  var HEADER = ["hwId", "art", "name", "price", "vat", "currency", "readAt", "source", "pack", "url"];
  function q(v) { v = String(v == null ? "" : v); return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function toCSV(supplier) {
    var lines = [HEADER.join(";")];
    (supplier.items || []).forEach(function (it) {
      lines.push([it.hwId || "", it.art, it.name, String(it.price).replace(".", ","), it.vat, it.currency, it.readAt, it.source, it.pack, it.url].map(q).join(";"));
    });
    return "﻿" + lines.join("\r\n") + "\r\n";
  }
  /* model de fișier: antet + un rând fără preț (necunoscut, nu se importă) */
  function templateCSV() {
    return "﻿" + HEADER.join(";") + "\r\n" + ["", "71B3550", "CLIP top BLUMOTION 110°", "", "excl", "EUR", "", "Oferta Furnizor", "", ""].join(";") + "\r\n";
  }

  return { PRIVATE_KEYS: PRIVATE_KEYS, stripPrivate: stripPrivate, keepPrivate: keepPrivate, parseCSV: parseCSV, parseNumber: parseNumber,
    normVat: normVat, normCurrency: normCurrency, normDate: normDate, importCSV: importCSV, matchCatalog: matchCatalog,
    mergeSupplier: mergeSupplier, removeSupplier: removeSupplier, find: find, ageDays: ageDays, toCSV: toCSV, templateCSV: templateCSV, slug: slug };
});
