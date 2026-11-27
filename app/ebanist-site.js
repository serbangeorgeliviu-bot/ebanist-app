/* =====================================================================
   Ebanist — modul Șantier (D-192)
   ---------------------------------------------------------------------
   Logica pură a ecranului de șantier de pe telefon: ce unități are
   proiectul, ce s-a montat, cele 7 verificări de recepție, defectele
   și semnarea recepției. Fără DOM, fără stare globală: primește
   proiectul și un `now`, ca să se poată proba în node.

   Date: un câmp opțional `p.site` pe proiect. Un proiect fără el se
   comportă ca până acum. Nimic de aici nu intră în distinctă, geometrie
   sau deviz.

     p.site = {
       mounted: { "<modulo>": <ts> },
       check:   { "1": true, … "7": true },
       defects: [ { id, text, at } ],
       receipt: { name, sig, at, mounted, total, partial } | null
     }

   Semnătura e locală: atestă ce a văzut omul pe șantier. Nu e semnare
   la distanță (D-177).
   ===================================================================== */
(function (global) {
  "use strict";

  var CHECKS = 7;            /* mk1…mk7 din fișa de montaj */
  var NAME_MIN = 2;
  var TEXT_MAX = 300;

  function isObj(x) { return x && typeof x === "object" && !Array.isArray(x); }

  /* o formă curată din orice a rămas pe proiect */
  function norm(site) {
    var s = isObj(site) ? site : {};
    var out = { mounted: {}, check: {}, defects: [], receipt: null };
    if (isObj(s.mounted)) Object.keys(s.mounted).forEach(function (k) {
      var v = +s.mounted[k]; if (v > 0) out.mounted[k] = v;
    });
    if (isObj(s.check)) for (var i = 1; i <= CHECKS; i++) if (s.check[i] === true) out.check[i] = true;
    if (Array.isArray(s.defects)) s.defects.forEach(function (d) {
      if (d && typeof d.text === "string" && d.text.trim() && d.id != null)
        out.defects.push({ id: String(d.id), text: d.text.trim().slice(0, TEXT_MAX), at: +d.at || 0 });
    });
    var r = s.receipt;
    if (isObj(r) && typeof r.name === "string" && r.name.trim().length >= NAME_MIN && typeof r.sig === "string" && r.sig) {
      out.receipt = { name: r.name.trim(), sig: r.sig, at: +r.at || 0, mounted: r.mounted | 0, total: r.total | 0, partial: !!r.partial };
    }
    return out;
  }

  /* unitățile de montat: piesele grupate pe modul, fără accesorii */
  function units(p, isAcc) {
    var order = [], map = {};
    ((p && p.pieces) || []).forEach(function (x) {
      if (!x || x.modulo == null || x.modulo === "") return;
      if (isAcc && isAcc(x)) return;
      var k = String(x.modulo);
      if (!map[k]) { map[k] = { id: k, name: k, pcs: 0 }; order.push(k); }
      map[k].pcs += Math.max(1, x.pz | 0);
    });
    return order.map(function (k) { return map[k]; });
  }

  function progress(site, list) {
    var s = norm(site), total = list.length, done = 0;
    list.forEach(function (u) { if (s.mounted[u.id]) done++; });
    return { done: done, total: total, pct: total ? Math.round(done / total * 100) : 0 };
  }

  /* bifa pe unitate: din nou = anulează. Întoarce site-ul nou, nu-l modifică pe cel vechi. */
  function toggleMounted(site, id, now) {
    var s = norm(site), k = String(id);
    if (s.mounted[k]) delete s.mounted[k]; else s.mounted[k] = now || Date.now();
    s.receipt = s.receipt;       /* semnarea rămâne; se anulează numai explicit */
    return s;
  }

  function toggleCheck(site, i) {
    var n = i | 0; if (n < 1 || n > CHECKS) return norm(site);
    var s = norm(site);
    if (s.check[n]) delete s.check[n]; else s.check[n] = true;
    return s;
  }

  function addDefect(site, text, id, now) {
    var s = norm(site), t = String(text == null ? "" : text).trim().slice(0, TEXT_MAX);
    if (!t) return s;
    s.defects.push({ id: String(id), text: t, at: now || Date.now() });
    return s;
  }

  function removeDefect(site, id) {
    var s = norm(site);
    s.defects = s.defects.filter(function (d) { return d.id !== String(id); });
    return s;
  }

  /* se poate semna? numele și semnătura trebuie să existe; restul nu blochează */
  function canSign(name, sig) {
    if (String(name == null ? "" : name).trim().length < NAME_MIN) return { ok: false, why: "name" };
    if (!sig) return { ok: false, why: "sig" };
    return { ok: true, why: "" };
  }

  /* recepția: dacă nu toate unitățile sunt montate, e „parțială”, iar asta se scrie în ea */
  function sign(site, list, name, sig, now) {
    var c = canSign(name, sig);
    if (!c.ok) return { ok: false, why: c.why, site: norm(site) };
    var s = norm(site), pr = progress(s, list);
    s.receipt = { name: String(name).trim(), sig: sig, at: now || Date.now(), mounted: pr.done, total: pr.total, partial: pr.done < pr.total };
    return { ok: true, why: "", site: s };
  }

  /* anularea semnăturii e explicită; verificările și defectele rămân */
  function unsign(site) { var s = norm(site); s.receipt = null; return s; }

  function checksDone(site) { var s = norm(site), n = 0; for (var i = 1; i <= CHECKS; i++) if (s.check[i]) n++; return n; }

  global.EBSite = {
    CHECKS: CHECKS, NAME_MIN: NAME_MIN, TEXT_MAX: TEXT_MAX,
    norm: norm, units: units, progress: progress, toggleMounted: toggleMounted, toggleCheck: toggleCheck,
    addDefect: addDefect, removeDefect: removeDefect, canSign: canSign, sign: sign, unsign: unsign, checksDone: checksDone
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
