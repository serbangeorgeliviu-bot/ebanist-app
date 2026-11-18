/* Ebanist U.17 — formularul și notele pentru unitățile de colț / scoase / mecanisme de mișcare (cfg.cu, cfg.cuSize, cfg.cuHand).
 * Încărcat la sfârșit, ca ebanist-kitchen-ui.js: folosește `t`, `state` și `drawPreview` din pagina principală (la apel, nu la încărcare).
 *   EBCornerUI.read()            → { cu, cuSize, cuHand }  (pentru cfgFromForm)
 *   EBCornerUI.write(cfg)        → pune câmpurile în formular (la reîncărcarea unui corp)
 *   EBCornerUI.render()          → reface lista și rândurile (după limbă / tip)
 *   EBCornerUI.notes(wn, built)  → liniile de avertisment și informare pentru Constructor
 */
(function (root) {
  "use strict";
  var ORDER = ["blind", "carousel", "cdrawer", "pullout", "tall", "pulldown", "spin", "turntable", "tvlift", "wardlift", "bracket"];
  function $(id) { return document.getElementById(id); }
  function T(k) { try { return t(k); } catch (e) { return k; } }
  function FIT() { return root.EBCornerFit; }
  function lang() { try { return state.lang; } catch (e) { return "it"; } }
  function fill() {
    var sel = $("bCU"); if (!sel || !FIT()) return;
    var keep = sel.value;
    sel.innerHTML = "";
    var o0 = document.createElement("option"); o0.value = ""; o0.textContent = T("cuNone"); sel.appendChild(o0);
    var by = {}; FIT().list().forEach(function (u) { (by[u.kind] = by[u.kind] || []).push(u); });
    ORDER.forEach(function (k) {
      if (!by[k]) return;
      var g = document.createElement("optgroup"); g.label = T("cuKind_" + k);
      by[k].forEach(function (u) { var o = document.createElement("option"); o.value = u.key; o.textContent = u.brand + " — " + u.name; g.appendChild(o); });
      sel.appendChild(g);
    });
    sel.value = keep || ""; sel.dataset.lang = lang();
  }
  function sizeLabel(s) { return s.label || (s.door ? s.door + " mm" : (s.cab != null && typeof s.cab === "number" ? s.cab + " mm" : String(s.id))); }
  function render() {
    var sel = $("bCU"); if (!sel) return;
    if (sel.dataset.lang !== lang() || !sel.options.length || sel.options.length < 3) fill();
    var ty = $("bTipo") ? $("bTipo").value : "standard", ok = ty === "standard" || ty === "angolare";
    var row = $("rowCU"); if (row) row.style.display = ok ? "" : "none";
    var u = ok && sel.value && FIT() ? FIT().get(sel.value) : null;
    var rs = $("rowCUSize"), rh = $("rowCUHand"), hint = $("cuHint");
    if (rs) {
      var ss = $("bCUSize"), keep = ss.value;
      if (u && u.sizes && u.sizes.length > 1) {
        ss.innerHTML = ""; var a = document.createElement("option"); a.value = ""; a.textContent = T("cuSizeAuto"); ss.appendChild(a);
        u.sizes.forEach(function (s) { var o = document.createElement("option"); o.value = String(s.id); o.textContent = sizeLabel(s); ss.appendChild(o); });
        ss.value = u.sizes.some(function (s) { return String(s.id) === keep; }) ? keep : "";
        rs.style.display = "";
      } else { rs.style.display = "none"; ss.value = ""; }
    }
    /* partea oarbă: la corpul standard o alege omul (blind, carusel); la corpul de colț o hotărăște „Lato del colț” */
    if (rh) rh.style.display = (u && ty === "standard" && (u.kind === "blind" || u.kind === "carousel")) ? "" : "none";
    if (hint) {
      var txt = u ? T("cuHint") + (u.notes || []).map(function (k) { return " " + T(k); }).join("") : "";
      hint.textContent = txt; hint.style.display = txt ? "" : "none";
    }
  }
  function read() {
    var s = $("bCU"), ty = $("bTipo") ? $("bTipo").value : "standard";
    var u = s && s.value && FIT() && (ty === "standard" || ty === "angolare") ? FIT().get(s.value) : null;
    if (!u) return { cu: null, cuSize: null, cuHand: null };
    var sz = $("bCUSize").value, ok = sz && u.sizes.some(function (x) { return String(x.id) === sz; });
    return { cu: u.key, cuSize: ok ? sz : null, cuHand: $("bCUHand").value === "dx" ? "dx" : null };
  }
  function write(cfg) {
    var s = $("bCU"); if (!s) return;
    fill();
    var u = cfg && cfg.cu && FIT() ? FIT().get(cfg.cu) : null;
    s.value = u ? u.key : "";
    render();
    $("bCUSize").value = u && cfg.cuSize ? String(cfg.cuSize) : "";
    $("bCUHand").value = u && cfg.cuHand === "dx" ? "dx" : "sx";
  }
  function fmtLim(v) { return v == null ? "—" : v; }
  function notes(wn, built) {
    var out = [], seen = {};
    function add(m) { if (m && !seen[m]) { seen[m] = 1; out.push(m); } }
    ((wn && wn.cuWarn) || []).forEach(function (w) {
      var m = null, u = w.u;
      if (w.k === "forced") m = T("cuw_forced").replace("{u}", u).replace("{what}", T("cuF_" + w.what)).replace("{from}", w.from).replace("{to}", w.to);
      else if (w.k === "range") {
        if (w.what === "body") m = T("cuw_body").replace("{u}", u).replace("{want}", T("cuBody_" + w.want)).replace("{have}", T("cuBody_" + w.have));
        else { var wh = w.what === "cab" || w.what === "dia" || w.what === "free" || w.what === "wi" || w.what === "depth" ? w.what : w.what;
          var label = T("cuWhat_" + wh) + (w.axis ? " (" + (w.axis === "w" ? "L" : "P") + ")" : "");
          m = T("cuw_range").replace("{u}", u).replace("{what}", label).replace("{v}", w.v).replace("{lo}", fmtLim(w.lo)).replace("{hi}", fmtLim(w.hi)); }
      } else if (w.k) { var s2 = T("cuw_" + w.k); if (s2 !== "cuw_" + w.k) m = s2.replace("{u}", u); }
      add(m ? "⚠︎ " + m : null);
    });
    var c = built && built.cu;
    if (c) {
      var x = "";
      if (c.kg != null) x += T("cuLoadFrag").replace("{kg}", c.kg);
      var cs = (c.codes || []).filter(function (q) { return q.desc !== "band"; }).slice(0, 3).map(function (q) { return q.code; }).concat((c.codes || []).filter(function (q) { return q.desc === "band"; }).map(function (q) { return q.code; }));
      if (cs.length) x += T("cuCodesFrag").replace("{c}", cs.join(" · "));
      var u2 = FIT() && FIT().get(c.key);
      add(T("cuw_info").replace("{u}", u2 ? u2.name : c.key).replace("{s}", c.size || "—").replace("{x}", x) + ".");
      if (c.doorW) add(T("cuw_door").replace("{u}", u2 ? u2.name : c.key).replace("{d}", c.doorW));
      if (c.spin) add(T("cuw_spin").replace("{u}", u2 ? u2.name : c.key).replace(/\{B\}/g, c.spin.B).replace("{H}", c.spin.H).replace("{g}", c.spin.gap));
    }
    return out;
  }
  function init() {
    if (!$("bCU")) return;
    fill(); render();
    ["bCU", "bCUSize", "bCUHand"].forEach(function (id) {
      $(id).addEventListener("change", function () { render(); if (typeof drawPreview === "function") drawPreview(); });
    });
    if ($("bTipo")) $("bTipo").addEventListener("change", render);
  }
  root.EBCornerUI = { read: read, write: write, render: render, notes: notes, fill: fill };
  if (typeof document !== "undefined") { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init(); }
})(typeof window !== "undefined" ? window : globalThis);
