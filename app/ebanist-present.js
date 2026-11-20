/* Ebanist — prezentarea pentru client (modul Client, D-50). Pur: fără DOM, fără stare.
   Din configurația unui corp scoate (1) ce poate citi clientul — cotele de gabarit și ce include mobilierul —
   și (2) o schemă SVG a frontului, cu cote și adâncime în proiecție oblică, colorată cu finisajele alese.
   NU atinge distinta, prețul sau geometria: citește numai câmpurile de nivel înalt ale lui `cfg`
   (L, H, P, plinth, doors, drawers, shelves, hang, handles, led, back, type). Schema e orientativă:
   împărțirea frontului (uși egale, sertare egale) nu e distinta — se spune pe ecran. */
(function (root) {
"use strict";

/* corpuri la care frontul are sens ca schemă; restul (masă, pat, boiserie…) primesc doar gabaritul */
var CARCASS = { standard: 1, scorrevole: 1 };

function num(v, d) { v = +v; return isFinite(v) && v > 0 ? v : d; }
function r1(x) { return Math.round(x * 10) / 10; }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

function hex2rgb(h) {
  h = String(h || "").replace("#", "");
  if (h.length === 3) h = h.replace(/./g, "$&$&");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function tone(h, f) { /* f<1 întunecă, f>1 luminează; culoare invalidă → neutru */
  var c = hex2rgb(h); if (!c) return f < 1 ? "#b9bdb4" : "#e9ebe4";
  return "rgb(" + c.map(function (v) { return Math.max(0, Math.min(255, Math.round(f <= 1 ? v * f : v + (255 - v) * (f - 1)))); }).join(",") + ")";
}

/* ce poate citi clientul: gabarit + elemente (fără coduri, fără prețuri) */
function presentFacts(cfg) {
  cfg = cfg || {};
  var ty = cfg.type || "standard", sliding = ty === "scorrevole" && +cfg.doors > 0;
  var items = [];
  if (CARCASS[ty] || ty === "angolare") {
    var nd = Math.max(0, cfg.doors | 0), nr = Math.max(0, cfg.drawers | 0), ns = Math.max(0, cfg.shelves | 0);
    if (nd > 0) items.push({ k: sliding ? "sliding" : "doors", n: nd });
    if (nr > 0) items.push({ k: "drawers", n: nr });
    if (ns > 0) items.push({ k: "shelves", n: ns });
    if (cfg.hang) items.push({ k: "hang" });
    if (cfg.handles === "maniglia" || cfg.handles === "push" || cfg.handles === "gola" || cfg.handles === "raza")
      if (nd > 0 || nr > 0) items.push({ k: "h_" + cfg.handles });
    if (cfg.led === "top" || cfg.led === "manual") items.push({ k: "led" });
    if (+cfg.plinth > 0) items.push({ k: "plinth", n: Math.round(+cfg.plinth) });
    if (cfg.back) items.push({ k: "back" });
  }
  return { dims: { L: Math.round(num(cfg.L, 0)), H: Math.round(num(cfg.H, 0)), P: Math.round(num(cfg.P, 0)) }, items: items };
}

/* ce urmează după semnătură: trei pași, fără date (nu promitem termene) */
var STEPS = ["step1", "step2", "step3"];

/* schema frontului. o: {front:{c,wood}, body:{c,wood}, uid, w, h}. Returnează un șir <svg>…</svg>. */
function elevation(cfg, o) {
  cfg = cfg || {}; o = o || {};
  var ty = cfg.type || "standard", box = !!CARCASS[ty];
  var L = num(cfg.L, 800), H = num(cfg.H, 800), P = num(cfg.P, 400);
  var VW = o.w || 420, VH = o.h || 330, uid = "pe" + (o.uid || "0");
  var padL = 54, padR = 30, padT = 26, padB = 56, K = 0.32;          // K: cât din adâncime se vede în oblic
  var s = Math.min((VW - padL - padR) / (L + K * P), (VH - padT - padB) / (H + K * P));
  var w = L * s, h = H * s, dx = K * P * s, dy = -K * P * s;
  var x0 = padL + ((VW - padL - padR) - (w + dx)) / 2, y0 = padT + (-dy) + ((VH - padT - padB) - (h - dy)) / 2;
  var pl = box ? Math.min(h * 0.22, (+cfg.plinth || 0) * s) : 0;
  var bh = h - pl;                                                    // înălțimea corpului fără soclu
  var fc = (o.front && o.front.c) || "#d9d4c7", bc = (o.body && o.body.c) || fc;

  function fill(spec, id) {
    if (spec && spec.wood) return { def: '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="14" height="14" patternTransform="rotate(4)">' +
      '<rect width="14" height="14" fill="' + esc(spec.c) + '"/><rect width="2.2" height="14" x="4" fill="' + tone(spec.c, .9) + '"/><rect width="1.2" height="14" x="10" fill="' + tone(spec.c, .94) + '"/></pattern>', ref: "url(#" + id + ")" };
    return { def: "", ref: esc((spec && spec.c) || fc) };
  }
  var F = fill(o.front || { c: fc }, uid + "f"), B = fill(o.body || { c: bc }, uid + "b");
  var g = [];

  g.push('<svg class="pe-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + VW + " " + VH + '" role="img" aria-hidden="true" focusable="false">');
  g.push("<defs>" + F.def + B.def +
    '<linearGradient id="' + uid + 'sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient></defs>');

  /* umbra pe pardoseală */
  g.push('<ellipse cx="' + r1(x0 + (w + dx) / 2) + '" cy="' + r1(y0 + h + 5) + '" rx="' + r1((w + dx) / 2 + 8) + '" ry="5" fill="#000" opacity=".12"/>');

  /* adâncimea: fața de sus și cea din dreapta, în proiecție oblică */
  if (box || ty === "angolare" || ty === "tavolo" || ty === "scrivania" || ty === "letto") {
    g.push('<polygon class="pe-side" points="' + r1(x0) + "," + r1(y0) + " " + r1(x0 + dx) + "," + r1(y0 + dy) + " " + r1(x0 + w + dx) + "," + r1(y0 + dy) + " " + r1(x0 + w) + "," + r1(y0) +
      '" fill="' + tone(bc, 1.25) + '"/>');
    g.push('<polygon class="pe-side" points="' + r1(x0 + w) + "," + r1(y0) + " " + r1(x0 + w + dx) + "," + r1(y0 + dy) + " " + r1(x0 + w + dx) + "," + r1(y0 + h + dy - pl) + " " + r1(x0 + w) + "," + r1(y0 + h - pl) +
      '" fill="' + tone(bc, .8) + '"/>');
  }

  /* corpul */
  g.push('<rect class="pe-body" x="' + r1(x0) + '" y="' + r1(y0) + '" width="' + r1(w) + '" height="' + r1(bh) + '" rx="1.2" fill="' + B.ref + '"/>');
  if (pl > 1) {
    var fw = Math.max(3, w * 0.035);
    g.push('<rect class="pe-foot" x="' + r1(x0 + w * 0.05) + '" y="' + r1(y0 + bh) + '" width="' + r1(fw) + '" height="' + r1(pl) + '"/>' +
      '<rect class="pe-foot" x="' + r1(x0 + w * 0.95 - fw) + '" y="' + r1(y0 + bh) + '" width="' + r1(fw) + '" height="' + r1(pl) + '"/>');
  }

  if (box) {
    var nd = Math.max(0, Math.min(8, cfg.doors | 0)), nr = Math.max(0, Math.min(8, cfg.drawers | 0)), ns = Math.max(0, Math.min(12, cfg.shelves | 0));
    var gap = 1.6, hd = cfg.handles || "maniglia", sliding = ty === "scorrevole" && nd > 0;
    var drawH = nr > 0 ? (nd > 0 ? bh * 0.34 : bh) : 0, doorH = nd > 0 ? bh - drawH : 0;
    var yDoor = y0;
    if (nd === 0 && nr === 0) {                                      // deschis: se văd rafturile și bara
      for (var i = 1; i <= ns; i++) { var yy = y0 + bh * i / (ns + 1); g.push('<line class="pe-shelf" x1="' + r1(x0 + 3) + '" y1="' + r1(yy) + '" x2="' + r1(x0 + w - 3) + '" y2="' + r1(yy) + '"/>'); }
    }
    if (nd > 0) {
      var dw = sliding ? w / Math.max(1, nd) * 1.18 : (w - gap * (nd + 1)) / nd;
      for (var d = 0; d < nd; d++) {
        var dxp = sliding ? x0 + d * (w - dw) / Math.max(1, nd - 1 || 1) : x0 + gap + d * (dw + gap);
        if (sliding && nd === 1) dxp = x0;
        g.push('<rect class="pe-door" x="' + r1(dxp) + '" y="' + r1(yDoor + gap) + '" width="' + r1(dw) + '" height="' + r1(doorH - gap * 2) + '" rx="1" fill="' + F.ref + '"/>');
        g.push('<rect x="' + r1(dxp) + '" y="' + r1(yDoor + gap) + '" width="' + r1(dw) + '" height="' + r1(doorH - gap * 2) + '" rx="1" fill="url(#' + uid + 'sh)"/>');
        if (hd === "maniglia") {                                      // mâner pe latura dinspre mijloc
          var hx = (nd === 1) ? dxp + dw - 7 : (d < nd / 2 ? dxp + dw - 7 : dxp + 5), hl = Math.min(26, (doorH - gap * 2) * 0.22);
          g.push('<rect class="pe-handle" x="' + r1(hx) + '" y="' + r1(yDoor + (doorH - hl) / 2) + '" width="2.4" height="' + r1(hl) + '" rx="1.2"/>');
        }
        if (hd === "gola") g.push('<line class="pe-gola" x1="' + r1(dxp) + '" y1="' + r1(yDoor + gap) + '" x2="' + r1(dxp + dw) + '" y2="' + r1(yDoor + gap) + '"/>');
      }
    }
    if (nr > 0) {
      var rh = (drawH - gap * (nr + 1)) / nr, yD = y0 + bh - drawH;
      for (var r = 0; r < nr; r++) {
        var ry = yD + gap + r * (rh + gap);
        g.push('<rect class="pe-door" x="' + r1(x0 + gap) + '" y="' + r1(ry) + '" width="' + r1(w - gap * 2) + '" height="' + r1(rh) + '" rx="1" fill="' + F.ref + '"/>');
        g.push('<rect x="' + r1(x0 + gap) + '" y="' + r1(ry) + '" width="' + r1(w - gap * 2) + '" height="' + r1(rh) + '" rx="1" fill="url(#' + uid + 'sh)"/>');
        if (hd === "maniglia") { var hl2 = Math.min(34, w * 0.2); g.push('<rect class="pe-handle" x="' + r1(x0 + (w - hl2) / 2) + '" y="' + r1(ry + rh * 0.3) + '" width="' + r1(hl2) + '" height="2.4" rx="1.2"/>'); }
        if (hd === "gola") g.push('<line class="pe-gola" x1="' + r1(x0 + gap) + '" y1="' + r1(ry) + '" x2="' + r1(x0 + w - gap) + '" y2="' + r1(ry) + '"/>');
      }
    }
  }

  /* cotele: lățime jos, înălțime stânga, adâncime pe muchia de sus */
  var yb = y0 + h + 22, xl = x0 - 20;
  g.push('<g class="pe-dim">' +
    '<line x1="' + r1(x0) + '" y1="' + r1(yb) + '" x2="' + r1(x0 + w) + '" y2="' + r1(yb) + '"/>' +
    '<line x1="' + r1(x0) + '" y1="' + r1(yb - 5) + '" x2="' + r1(x0) + '" y2="' + r1(yb + 5) + '"/><line x1="' + r1(x0 + w) + '" y1="' + r1(yb - 5) + '" x2="' + r1(x0 + w) + '" y2="' + r1(yb + 5) + '"/>' +
    '<text x="' + r1(x0 + w / 2) + '" y="' + r1(yb + 17) + '" text-anchor="middle">' + Math.round(L) + '</text>' +
    '<line x1="' + r1(xl) + '" y1="' + r1(y0) + '" x2="' + r1(xl) + '" y2="' + r1(y0 + h) + '"/>' +
    '<line x1="' + r1(xl - 5) + '" y1="' + r1(y0) + '" x2="' + r1(xl + 5) + '" y2="' + r1(y0) + '"/><line x1="' + r1(xl - 5) + '" y1="' + r1(y0 + h) + '" x2="' + r1(xl + 5) + '" y2="' + r1(y0 + h) + '"/>' +
    '<text transform="translate(' + r1(xl - 7) + " " + r1(y0 + h / 2) + ') rotate(-90)" text-anchor="middle">' + Math.round(H) + "</text>" +
    '<text class="pe-d" x="' + r1(x0 + w + dx + 6) + '" y="' + r1(y0 + dy + 4) + '">' + Math.round(P) + "</text>" +
    "</g>");
  g.push("</svg>");
  return g.join("");
}

/* feroneria oferită clientului. Eticheta = marca + numele din catalog, FĂRĂ cod de articol: un articol al cărui nume poartă un cod
   (șir de 5+ cifre, 71B3550, 329.17.100, «cod», «ofertă») nu se oferă. `it` = {brand, n, art}; n = șir sau {limbă: text}. */
var CODE = /\b\d{5,}\b|\b\d{2,3}[A-Z]\d{3,}\b|\b[A-Z]{1,3}\d{4,}[A-Z0-9]*\b|\b\d{3}\.\d{2}\.\d{2,3}\b|\b\d{3}[A-Z]\b|\bNL\s*\d|\bcod(e|ice)?\b|\bofert/i;
function presentHwLabel(it, lang) {
  if (!it) return null;
  var n = it.n, name = typeof n === "string" ? n : ((n || {})[lang] || (n || {}).it || "");
  name = String(name || "").trim().replace(/\s*\((pair|coppia|paire|paar|para|pareja|pereche|set|kit)\)$/i, "");
  if (!name || name.length > 70 || CODE.test(name)) return null;     // nume lungi = fișe tehnice, nu ofertă pentru client
  if (it.art && String(it.art).length > 3 && name.indexOf(String(it.art)) >= 0) return null;
  var b = it.brand && it.brand !== "—" ? String(it.brand) : "";
  return b && name.toLowerCase().indexOf(b.toLowerCase()) !== 0 ? b + " " + name : name;
}
/* o balama pentru ușă încastrată nu se schimbă cu una pentru ușă aplicată (altă construcție, nu doar alt articol): la balamale se oferă
   numai din aceeași clasă ca cea curentă. Celelalte categorii nu au clase. */
var INSET = /inset|incassat|încastrat|encloison|einliegend|wpuszczan|inserci/i;
function presentHwSameKind(cat, a, b) { return cat !== "cern" || INSET.test(String(a)) === INSET.test(String(b)); }

/* ordinea ofertei: cea curentă prima, apoi după potrivire (rank) și preț; etichete unice; cel mult `cap` */
function presentHwPick(list, curId, cap) {
  var seen = {}, out = [], cur = null;
  (list || []).forEach(function (o) { if (o && o.id === curId && !cur) cur = o; });
  var rest = (list || []).filter(function (o) { return o && o.id !== curId; })
    .sort(function (a, b) { return ((a.rank || 0) - (b.rank || 0)) || ((a.price || 0) - (b.price || 0)); });
  (cur ? [cur].concat(rest) : rest).forEach(function (o) {
    var k = String(o.label).toLowerCase(); if (seen[k] || out.length >= (cap || 6)) return; seen[k] = 1; out.push(o); });
  return out;
}

/* extra la preț separat (D-178): LED, un raft, un sertar. Numai pe corpuri `standard` cu împărțire automată (fără cote absolute / blocuri de
   sertare / fronturi proprii: acolo «un raft în plus» n-are un singur înțeles). `patch` e față de cfg-ul corpului, independent pe câmp. */
var CUSTOM_LAYOUT = ["partitions", "depthProfile", "fronts", "customCuts", "drawerBlocks"];
function plainLayout(cfg) { return (cfg.type || "standard") === "standard" && !CUSTOM_LAYOUT.some(function (k) { return Array.isArray(cfg[k]) ? cfg[k].length > 0 : !!cfg[k]; }); }
var EXTRAS = [
  { id: "led", key: "prLed", applies: function (c) { return (c.type || "standard") === "standard" && !(c.led === "top" || c.led === "manual"); }, patch: function () { return { led: "top" }; } },
  { id: "shelf", key: "prExShelf", applies: function (c) { return plainLayout(c) && (c.shelves | 0) >= 1 && (c.shelves | 0) < 10; }, patch: function (c) { return { shelves: (c.shelves | 0) + 1 }; } },
  { id: "drawer", key: "prExDrawer", applies: function (c) { return plainLayout(c) && (c.drawers | 0) >= 1 && (c.drawers | 0) < 8; }, patch: function (c) { return { drawers: (c.drawers | 0) + 1 }; } }
];
function presentExtras(cfg) { return EXTRAS.filter(function (e) { return e.applies(cfg || {}); }); }
function presentExtraCfg(cfg, on) {
  var out = Object.assign({}, cfg);
  EXTRAS.forEach(function (e) { if (on && on[e.id] && e.applies(cfg)) Object.assign(out, e.patch(cfg)); });
  return out;
}

var API = { presentExtras: presentExtras, presentExtraCfg: presentExtraCfg, presentHwSameKind: presentHwSameKind, presentHwLabel: presentHwLabel, presentHwPick: presentHwPick, presentFacts: presentFacts, presentElevation: elevation, PRESENT_STEPS: STEPS, presentTone: tone };
if (typeof module !== "undefined" && module.exports) module.exports = API;
for (var k in API) if (Object.prototype.hasOwnProperty.call(API, k)) root[k] = API[k];
})(typeof globalThis !== "undefined" ? globalThis : this);
