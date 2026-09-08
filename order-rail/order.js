/* =====================================================================
   Ebanist Order Rail — pachetul de comandă
   ---------------------------------------------------------------------
   Ce pleacă spre atelier când clientul apasă „Trimite comanda":

     lab.json        pachetul de laborator, formatul existent, FĂRĂ prețuri
     snapshot.json   proiectul întreg, ca să se poată redeschide identic
     order.json      client, deviz, hash, versiune de aplicație
     *.html          documentele gata de tipărit (distinta, montaj,
                     etichete) — vezi DECISIONS.md §3 pentru de ce nu
                     sunt fișiere .pdf

   Documentele NU se regenerează aici. Se cheamă exact aceleași funcții
   pe care le folosește butonul de tipărire, cu un întrerupător care
   oprește `window.print()` și predă HTML-ul. Dacă ar exista un al doilea
   generator, în trei luni ar tipări altceva decât primul, și nimeni nu
   ar ști care are dreptate.
   ===================================================================== */
(function (global) {
  "use strict";

  var OrderPkg = {};

  /* --- hash ------------------------------------------------------------
     SHA-256 peste snapshot-ul canonic. Ăsta e numărul care se îngheață
     la confirmare: dacă cineva schimbă o cotă după ce atelierul a
     confirmat, hash-ul nu mai iese și se vede. */
  OrderPkg.sha256 = function (str) {
    try {
      var enc = new TextEncoder().encode(str);
      return crypto.subtle.digest("SHA-256", enc).then(function (buf) {
        var b = new Uint8Array(buf), out = "";
        for (var i = 0; i < b.length; i++) out += b[i].toString(16).padStart(2, "0");
        return out;
      });
    } catch (e) {
      return Promise.resolve("");
    }
  };

  /* JSON canonic: chei sortate, fără spații. Fără asta, două serializări
     ale aceluiași proiect dau hash-uri diferite doar fiindcă browserul a
     enumerat cheile în altă ordine — și „snapshot imutabil" n-ar mai
     însemna nimic. */
  OrderPkg.canonical = function (v) {
    if (v === null || typeof v !== "object") return JSON.stringify(v);
    if (Array.isArray(v)) return "[" + v.map(OrderPkg.canonical).join(",") + "]";
    var keys = Object.keys(v).sort(), parts = [];
    for (var i = 0; i < keys.length; i++) {
      if (v[keys[i]] === undefined) continue;
      parts.push(JSON.stringify(keys[i]) + ":" + OrderPkg.canonical(v[keys[i]]));
    }
    return "{" + parts.join(",") + "}";
  };

  /* --- id de comandă ---------------------------------------------------
     Se citește la telefon, deci fără caractere care se confundă. Data în
     față ca să se sorteze singure în listă. */
  var ID_ALPHA = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  OrderPkg.newId = function (d) {
    d = d || new Date();
    var ymd = d.toISOString().slice(2, 10).replace(/-/g, "");
    var r = "";
    try {
      var a = new Uint8Array(4); crypto.getRandomValues(a);
      for (var i = 0; i < 4; i++) r += ID_ALPHA[a[i] % ID_ALPHA.length];
    } catch (e) {
      for (var j = 0; j < 4; j++) r += ID_ALPHA[Math.floor(Math.random() * ID_ALPHA.length)];
    }
    return ymd + "-" + r;
  };

  /* --- stilul de tipărire, luat din aplicație --------------------------
     Se citește din foaia de stil vie, nu dintr-o copie. O copie ar
     diverge de original la prima modificare, iar documentul din pachet ar
     arăta altfel decât cel tipărit din aplicație. */
  OrderPkg.printCss = function () {
    var out = [];
    try {
      for (var i = 0; i < document.styleSheets.length; i++) {
        var sh = document.styleSheets[i], rules;
        try { rules = sh.cssRules; } catch (e) { continue; }   // foaie din altă origine
        if (!rules) continue;
        for (var j = 0; j < rules.length; j++) {
          var r = rules[j];
          if (r.type === 4 && /print/.test(r.conditionText || r.media.mediaText || "")) {
            for (var k = 0; k < r.cssRules.length; k++) out.push(r.cssRules[k].cssText);
          }
        }
      }
    } catch (e) {}
    return out.join("\n");
  };

  /* Un document autonom: se deschide oriunde, fără rețea, și „Tipărește"
     îl scoate identic cu ce scoate aplicația. */
  OrderPkg.wrapDoc = function (title, bodyHtml, css) {
    return "<!DOCTYPE html>\n<html><head><meta charset=\"UTF-8\">" +
      "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
      "<title>" + esc(title) + "</title><style>\n" +
      "body{margin:0;padding:14px;font-family:'Barlow',Arial,sans-serif;color:#000;background:#fff}\n" +
      "#printArea{display:block}\n" +
      ".ordbar{position:sticky;top:0;background:#0E3B2A;color:#fff;padding:10px 14px;margin:-14px -14px 14px;" +
      "display:flex;gap:12px;align-items:center;font:600 14px/1 'Barlow',Arial,sans-serif}\n" +
      ".ordbar button{margin-left:auto;background:#fff;color:#0E3B2A;border:0;border-radius:8px;" +
      "padding:8px 14px;font:700 14px 'Barlow',Arial,sans-serif;cursor:pointer}\n" +
      "@media print{.ordbar{display:none}}\n" + css + "\n</style></head><body>" +
      "<div class=\"ordbar\"><span>" + esc(title) + "</span>" +
      "<button onclick=\"window.print()\">Print / PDF</button></div>" +
      "<div id=\"printArea\">" + bodyHtml + "</div></body></html>";
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  OrderPkg.esc = esc;

  /* --- ZIP fără compresie, scris de mână -------------------------------
     Fișierele din pachet sunt JSON și HTML, iar pachetul se descarcă
     local: compresia ar economisi o lățime de bandă pe care n-o
     folosim. Metoda `store` e un antet, datele, și un director la
     sfârșit — nu merită o dependență. */
  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(buf) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function dosTime(d) {
    return ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() / 2)) & 0xFFFF;
  }
  function dosDate(d) {
    return (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
  }

  OrderPkg.zip = function (files, when) {
    when = when || new Date();
    var enc = new TextEncoder();
    var chunks = [], central = [], offset = 0;
    var names = Object.keys(files);
    for (var i = 0; i < names.length; i++) {
      var nameBytes = enc.encode(names[i]);
      var data = files[names[i]];
      var body = (data instanceof Uint8Array) ? data : enc.encode(String(data));
      var crc = crc32(body);
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);   // UTF-8 în nume
      lh.setUint16(8, 0, true);                                    // store
      lh.setUint16(10, dosTime(when), true); lh.setUint16(12, dosDate(when), true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, body.length, true); lh.setUint32(22, body.length, true);
      lh.setUint16(26, nameBytes.length, true); lh.setUint16(28, 0, true);
      chunks.push(new Uint8Array(lh.buffer), nameBytes, body);

      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true);
      ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true);
      ch.setUint16(12, dosTime(when), true); ch.setUint16(14, dosDate(when), true);
      ch.setUint32(16, crc, true);
      ch.setUint32(20, body.length, true); ch.setUint32(24, body.length, true);
      ch.setUint16(28, nameBytes.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), nameBytes);
      offset += 30 + nameBytes.length + body.length;
    }
    var cSize = 0;
    for (var c2 = 0; c2 < central.length; c2++) cSize += central[c2].length;
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, names.length, true); end.setUint16(10, names.length, true);
    end.setUint32(12, cSize, true); end.setUint32(16, offset, true);
    var all = chunks.concat(central, [new Uint8Array(end.buffer)]);
    return new Blob(all, { type: "application/zip" });
  };

  /* --- diferența între două versiuni de comandă ------------------------
     Când o comandă confirmată se modifică, nu se suprascrie: se naște v2.
     Atelierul nu are nevoie să compare două distinte cu ochiul — are
     nevoie să vadă CE s-a schimbat, fiindcă poate să fi tăiat deja o
     parte din v1.

     Identitatea unei piese e (corp, element, lungime, lățime, material).
     Numărul de bucăți NU intră în cheie: dacă intra, „3 rafturi în loc de
     2" ar apărea ca o piesă ștearsă plus una adăugată, în loc de ce e —
     o cantitate schimbată. */
  function pieceKey(x) {
    return [x.modulo || "", x.elemento || "", x.lung, x.larg, x.materiale || "", x.bordo || ""].join("|");
  }
  OrderPkg.diffPieces = function (oldPieces, newPieces) {
    var A = {}, B = {}, i;
    for (i = 0; i < (oldPieces || []).length; i++) {
      var a = oldPieces[i], ka = pieceKey(a);
      A[ka] = (A[ka] || { p: a, pz: 0 }); A[ka].pz += (+a.pz || 0);
    }
    for (i = 0; i < (newPieces || []).length; i++) {
      var b = newPieces[i], kb = pieceKey(b);
      B[kb] = (B[kb] || { p: b, pz: 0 }); B[kb].pz += (+b.pz || 0);
    }
    var added = [], removed = [], changed = [], k;
    for (k in B) {
      if (!A[k]) added.push({ piece: B[k].p, pz: B[k].pz });
      else if (A[k].pz !== B[k].pz) changed.push({ piece: B[k].p, from: A[k].pz, to: B[k].pz });
    }
    for (k in A) if (!B[k]) removed.push({ piece: A[k].p, pz: A[k].pz });
    return { added: added, removed: removed, changed: changed,
             none: !added.length && !removed.length && !changed.length };
  };

  global.OrderPkg = OrderPkg;
  if (typeof module !== "undefined" && module.exports) module.exports = OrderPkg;
})(typeof window !== "undefined" ? window : globalThis);
