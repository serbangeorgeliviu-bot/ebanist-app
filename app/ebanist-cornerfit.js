/* Ebanist U.17 — unități de colț, scoase pentru corpuri joase și înalte, mecanisme de rotire și de mișcare: alegerea mărimii și regulile de potrivire.
 * PUR: fără DOM, fără stare.
 *
 * Datele vin din EBCornerData (ebanist-corner-data.js, generat din documente oficiale; ce nu e citit = null). Nimic de aici nu e
 * „verificat”: răspunsul „se potrivește” e o ORIENTARE din tabelele producătorului, nu înlocuiește fișa lor.
 *
 *   EBCornerFit.list() / .get(key) / .bodyOf(cfg)
 *   EBCornerFit.pickSize(u, d, sizeId)    → mărimea aleasă (obiect din u.sizes) sau null
 *   EBCornerFit.pickBand(u, hi)           → varianta după înălțime (obiect din u.bands) sau null
 *   EBCornerFit.fit(u, d, opt)            → { size, band, issues[], info }
 *     d = { L, H, P, wi, hi, depth, doorKg }   (mm / kg; wi, hi, depth = cotele INTERIOARE ale corpului)
 *     opt = { size, hand }
 *   issues[] = { k, v, lo, hi, ... }  k ∈ "body" | "cab" | "wi" | "hi" | "depth" | "dia" | "size" | "kg" | "spinH" | "bbox" | "free" | "rot" | "band"
 *   EBCornerFit.codes(u, size, band)      → codurile potrivite mărimii/variantei
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.EBCornerFit = factory(root);
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";
  function units() { return (root.EBCornerData && root.EBCornerData.units) || []; }
  function list() { return units().slice(); }
  function get(key) { var a = units(); for (var i = 0; i < a.length; i++) if (a[i].key === key) return a[i]; return null; }
  /* tipul corpului, din configurație: agățat = „wall”; altfel după înălțime */
  function bodyOf(cfg) {
    if (!cfg) return "base";
    if (cfg.support === "sospeso") return "wall";
    return (+cfg.H > 1100) ? "tall" : "base";
  }
  function inR(v, lo, hi) { return (lo == null || v >= lo) && (hi == null || v <= hi); }
  function cabOf(s) { return typeof s.cab === "number" ? [s.cab, s.cab] : (Array.isArray(s.cab) ? s.cab : null); }
  function r1(v) { return Math.round(v * 10) / 10; }

  /* mărimea: cea cerută dacă există; altfel cea mai potrivită după felul unității */
  function pickSize(u, d, sizeId) {
    var S = u.sizes || [];
    if (!S.length) return null;
    if (sizeId != null && sizeId !== "") for (var i = 0; i < S.length; i++) if (String(S[i].id) === String(sizeId)) return S[i];
    var k = u.kind, L = +d.L || 0, wi = +d.wi || 0, best = null, bd = 1e9;
    if (k === "blind") {
      /* cea mai lată ușă pentru care lățimea interioară ajunge (și, unde e dată, lățimea corpului); altfel cea mai îngustă */
      var ok = S.filter(function (s) { var m = s.wi && s.wi[0] != null ? s.wi[0] : null, M = s.wi && s.wi[1] != null ? s.wi[1] : null, c = cabOf(s);
        return (m == null || wi >= m) && (M == null || wi <= M) && (!c || c[0] == null || L >= c[0]); });
      if (ok.length) return ok.reduce(function (a, s) { return (s.door || 0) >= (a.door || 0) ? s : a; });
      return S.reduce(function (a, s) { return (s.door || 0) < (a.door || 0) ? s : a; });
    }
    if (k === "spin") {
      /* cea mai mare mărime a cărei casetă încape (cu jocul de mișcare) */
      var avail = Math.min(wi || 1e9, +d.depth || 1e9);
      var fitS = S.filter(function (s) { return avail - 2 * s.gap >= s.bbox[0]; });
      return fitS.length ? fitS[fitS.length - 1] : S[0];
    }
    if (k === "wardlift") {
      for (var j = 0; j < S.length; j++) if (inR(wi, S[j].wi[0], S[j].wi[1])) return S[j];
      return S[0];
    }
    if (k === "cdrawer") {
      var dep = +d.depth || 0, ok2 = S.filter(function (s) { return s.depth != null && dep >= s.depth; });
      return ok2.length ? ok2[ok2.length - 1] : S[0];
    }
    if (k === "pullout" && u.key === "blum_space_twin") return S[L >= 185 ? 0 : 1];
    /* pull-out / tall / carousel / pulldown: cea mai apropiată lățime nominală */
    S.forEach(function (s) { var c = cabOf(s); if (!c) return; var dd = L >= c[0] && L <= (c[1] == null ? c[0] : c[1]) ? 0 : Math.min(Math.abs(L - c[0]), Math.abs(L - (c[1] == null ? c[0] : c[1]))); if (dd < bd) { bd = dd; best = s; } });
    return best || S[0];
  }

  /* varianta după înălțimea interioară: întâi intervalele cu două capete (prima care conține valoarea), apoi pragurile (cel mai mare ≤ valoare) */
  function pickBand(u, hi) {
    var B = u.bands || [];
    if (!B.length || !(hi > 0)) return null;
    var i, rng = B.filter(function (b) { return b.hi && b.hi[0] != null && b.hi[1] != null; });
    for (i = 0; i < rng.length; i++) if (hi >= rng[i].hi[0] && hi <= rng[i].hi[1]) return rng[i];
    var thr = B.filter(function (b) { return b.hi && b.hi[0] != null && b.hi[1] == null && hi >= b.hi[0]; });
    if (thr.length) return thr.reduce(function (a, b) { return b.hi[0] >= a.hi[0] ? b : a; });
    return null;
  }

  function codes(u, size, band) {
    var sid = size ? String(size.id) : null, out = [];
    (u.codes || []).forEach(function (c) {
      if (c.size == null || sid == null || String(c.size) === sid || (typeof c.size === "string" && c.size.indexOf(sid) >= 0)) out.push(c);
    });
    if (band && band.code) { var has = out.some(function (c) { return c.code === band.code; }); if (!has) out.push({ code: band.code, desc: "band", size: null, hand: null }); }
    return out;
  }

  function fit(u, d, opt) {
    opt = opt || {};
    var issues = [], size = pickSize(u, d, opt.size), band = null;
    var L = +d.L || 0, wi = +d.wi || 0, hi = +d.hi || 0, dep = +d.depth || 0, lim = u.limits || {};
    function push(k, v, lo, hh, extra) { var o = { k: k, v: r1(v), lo: lo == null ? null : lo, hi: hh == null ? null : hh }; if (extra) for (var q in extra) o[q] = extra[q]; issues.push(o); }
    /* tipul corpului */
    var bd = d.body || bodyOf(d);
    if (u.body !== "any" && bd && bd !== u.body) push("body", 0, null, null, { want: u.body, have: bd });
    if (u.kind === "spin") return fitSpin(u, d, opt, size, issues);
    var sz = size || {};
    /* lățimea corpului (exterioară): nominală (un singur capăt = exact) sau minimă / interval */
    var c = cabOf(sz) || (lim.cab || null);
    if (c && L > 0) {
      if (typeof sz.cab === "number") { if (Math.abs(L - sz.cab) > 1) push("cab", L, sz.cab, sz.cab); }
      else if (!inR(L, c[0], c[1])) push("cab", L, c[0], c[1]);
    }
    /* lățimea interioară */
    var w = sz.wi || (lim.wi || null), wmin = w ? w[0] : (lim.wiMin != null ? lim.wiMin : null), wmax = w ? w[1] : null;
    if (wi > 0 && !inR(wi, wmin, wmax)) push("wi", wi, wmin, wmax);
    /* înălțimea interioară: a mărimii, a limitelor, apoi a variantelor */
    var h = sz.hi || lim.hi || null;
    if (h && hi > 0 && !inR(hi, h[0], h[1])) push("hi", hi, h[0], h[1]);
    if (u.bands && u.bands.length && hi > 0) {
      band = pickBand(u, hi);
      if (!band && !h) { var lo = null, up = null; u.bands.forEach(function (b) { if (b.hi) { if (b.hi[0] != null && (lo == null || b.hi[0] < lo)) lo = b.hi[0]; if (b.hi[1] != null && (up == null || b.hi[1] > up)) up = b.hi[1]; } }); push("band", hi, lo, up); }
    }
    /* adâncimea interioară */
    var dm = sz.depth != null ? sz.depth : lim.depth;
    if (dm != null && dep > 0 && dep < dm) push("depth", dep, dm, null);
    /* disc de carusel: trebuie să încapă în pătratul interior (diametrul e din sursă) */
    if (u.kind === "carousel" && sz.dia) {
      if (wi > 0 && wi < sz.dia) push("dia", wi, sz.dia, null, { axis: "w" });
      if (dep > 0 && dep < sz.dia) push("dia", dep, sz.dia, null, { axis: "d" });
    }
    /* ușa față de deschiderea liberă minimă: unde ambele sunt date */
    if (u.kind === "blind" && sz.door && sz.open && sz.open[0] != null && sz.door < sz.open[0]) push("door", sz.door, sz.open[0], null);
    /* console (mese rabatabile): greutatea ușii față de sarcina pe pereche */
    if (u.kind === "bracket" && sz.pairKg && d.doorKg > 0 && d.doorKg > sz.pairKg) push("kg", d.doorKg, null, sz.pairKg);
    /* platou rotativ: spațiul 425 × 285 și rotația completă */
    if (u.kind === "turntable") {
      if (wi > 0 && wi < sz.w) push("wi", wi, sz.w, null);
      if (dep > 0 && dep < sz.d) push("depth", dep, sz.d, null);
      var diag = Math.sqrt(sz.w * sz.w + sz.d * sz.d);
      if (dep > 0 && wi > 0 && Math.min(wi, dep) < diag && Math.min(wi, dep) >= Math.min(sz.w, sz.d)) push("rot", Math.min(wi, dep), r1(diag), null);
    }
    if (u.kind === "pulldown" && sz.depth != null && dep > 0 && dep < sz.depth) { /* deja în depth */ }
    return { size: size, band: band, issues: issues, info: infoOf(u, size, band) };
  }

  /* FurnSpin: caseta rotativă (pătrat B), jocurile de mișcare, spațiul liber față de pereți, înălțimea corpului rotativ */
  function fitSpin(u, d, opt, size, issues) {
    var lim = u.limits || {}, wi = +d.wi || 0, dep = +d.depth || 0, hi = +d.hi || 0, s = size;
    function push(k, v, lo, hh, extra) { var o = { k: k, v: r1(v), lo: lo == null ? null : lo, hi: hh == null ? null : hh }; if (extra) for (var q in extra) o[q] = extra[q]; issues.push(o); }
    var avail = Math.min(wi || 1e9, dep || 1e9);
    var bb = null;
    if (avail < 1e8) {
      /* jocul de mișcare: cel din fișă, redus la minim dacă caseta e mai mică decât pragul din fișă */
      var gap = s.gap, B = Math.min(s.bbox[1], avail - 2 * gap);
      if (B < s.gapBelow) { gap = s.gapMin; B = Math.min(s.bbox[1], avail - 2 * gap); }
      if (B < s.bbox[0]) push("bbox", B, s.bbox[0], s.bbox[1]);
      bb = { B: Math.max(s.bbox[0], B), gap: gap };
      /* spațiul liber de la axa de rotație la peretele din spate și la cel lateral: cel puțin jumătate din fiting */
      if (wi > 0 && wi / 2 < s.half) push("free", wi / 2, s.half, null, { axis: "w" });
      if (dep > 0 && dep / 2 < s.half) push("free", dep / 2, s.half, null, { axis: "d" });
    }
    var Hs = hi > 0 ? hi - 2 * s.fitH : 0;
    if (Hs > 0) {
      if (lim.spinH && !inR(Hs, lim.spinH[0], lim.spinH[1])) push("spinH", Hs, lim.spinH[0], lim.spinH[1]);
      else if (s.hiMax != null && Hs > s.hiMax) push("spinH", Hs, null, s.hiMax, { rec: 1 });
    }
    return { size: size, band: null, issues: issues, info: Object.assign(infoOf(u, size, null), { spin: bb ? { B: r1(bb.B), gap: bb.gap, H: Math.max(0, Hs), bottomSpin: s.bottomSpin, bottomOuter: s.bottomOuter } : null }) };
  }

  function infoOf(u, size, band) {
    var L = u.load || {}, s = size || {};
    return { kg: s.pairKg != null ? s.pairKg : (L.tray != null ? L.tray : (L.shelf != null ? L.shelf : (L.basket != null ? L.basket : (L.total != null ? L.total : (L.slide != null ? L.slide : null))))),
      load: L, codes: codes(u, size, band), n: band && band.n != null ? band.n : null };
  }

  return { list: list, get: get, bodyOf: bodyOf, pickSize: pickSize, pickBand: pickBand, fit: fit, codes: codes };
});
