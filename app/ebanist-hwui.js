/* Ebanist — FAZA H (H.3): panoul «Feronerie» al corpului și selectorul (foaia) de feronerie.
 *
 * Specificația: ebanist-hq/01-arhitectura/Ebanist-Feronerie-Selector-v1.md (§5.1 panoul pe sloturi, §5.2 selectorul).
 *
 * E UN STRAT DE VEDERE ȘI COMANDĂ PESTE CÂMPURILE VECHI, nu o a doua sursă de adevăr:
 *   - panoul CITEȘTE valorile din câmpurile existente (selectoarele din #hwSelBox, #bLift/#bLiftElec, #bCU/#bCUSize/#bCUHand, #bSlide, #bDrawSys, #bLed);
 *   - când omul alege în selector, SCRIE valoarea în câmpul vechi și declanșează evenimentul lui `change`; restul aplicației (cfgFromForm, proiecte salvate,
 *     cfg.hwSel / cfg.lift / cfg.cu / cfg.slide / cfg.drawerSys) rămâne neschimbat;
 *   - câmpurile vechi rămân în DOM, ascunse vizual (clasa .hwui-off), ca testele și codul existent să le găsească.
 * Un corp fără nicio alegere dă exact aceeași distinctă ca înainte (nu se scrie nimic fără un gest al omului).
 *
 * Partea PURĂ (testată fără DOM, test/hwui.test.js):
 *   EBHwUI.TARGETS, SLOT_TARGETS          ce câmp vechi servește fiecare țintă / slot
 *   EBHwUI.slotApplies(slot, flags)       slotul se aplică corpului? (cele care nu se aplică sunt ascunse, nu dezactivate)
 *   EBHwUI.planOps(target, value)         alegere / ștergere → operația pe câmpul vechi
 *   EBHwUI.prefs*                         recente și favorite (per spectator, nu intră în proiect)
 *   EBHwUI.buildSections(...)             Recomandate / Potrivite / Nu se potrivesc, cu ordinea din secțiune
 *   EBHwUI.openWarnSlot(w, sel, O)        slotul căruia îi aparține un avertisment al EBOpen
 *   EBHwUI.factsOf(entry, T, M)           3–4 date-cheie din datele familiei (nimic inventat)
 * DOM: EBHwUI.init(), EBHwUI.refresh(cfg, built), EBHwUI.relabel(), EBHwUI.open(slot).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.EBHwUI = factory(root);
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  /* ======================================================================== PUR */

  /* ținta = un loc în care formularul vechi ține o alegere. via "hwsel": selectorul #hwSelBox [data-cat] (cfg.hwSel[cat]); via "ctl": un câmp cu id.
     idx = categoria din indexul H.1 din care vin articolele (null = lista vine din altă parte: sisteme, opțiuni). */
  var TARGETS = {
    cern:    { via: "hwsel", cat: "cern", idx: "cern" },
    push:    { via: "hwsel", cat: "push", idx: "push" },
    man:     { via: "hwsel", cat: "man", idx: "man" },
    manS:    { via: "hwsel", cat: "manS", idx: "man" },
    guida:   { via: "hwsel", cat: "guida", idx: "guida" },
    pushd:   { via: "hwsel", cat: "pushd", idx: "pushd" },
    conn:    { via: "hwsel", cat: "conn", idx: "conn" },
    susp:    { via: "hwsel", cat: "susp", idx: "susp" },
    suprail: { via: "hwsel", cat: "suprail", idx: "suprail" },
    sup:     { via: "hwsel", cat: "sup", idx: "sup" },
    asta:    { via: "hwsel", cat: "asta", idx: "asta" },
    pied:    { via: "hwsel", cat: "pied", idx: "pied" },
    aw:      { via: "hwsel", cat: "aw", idx: "aw" },
    lift:     { via: "ctl", ctl: "bLift", idx: "lift", clear: "" },
    slidesys: { via: "ctl", ctl: "bSlide", idx: null, clear: "" },
    corner:   { via: "ctl", ctl: "bCU", idx: "corner", clear: "" },
    drawsys:  { via: "ctl", ctl: "bDrawSys", idx: null, clear: "legno" },
    led:      { via: "ctl", ctl: "bLed", idx: null, clear: "" },
    /* LED pe corp (H.5 / D-157): articolele iluminatului ca orice categorie cu alegere pe corp (cfg.hwSel.ledstrip …); fără alegere = articolul din catalog */
    ledstrip: { via: "hwsel", cat: "ledstrip", idx: "ledstrip" },
    leddrv:   { via: "hwsel", cat: "leddrv", idx: "leddrv" },
    leddim:   { via: "hwsel", cat: "leddim", idx: "leddim" },
    ledsw:    { via: "hwsel", cat: "ledsw", idx: "ledsw" },
    ledmains: { via: "hwsel", cat: "ledmains", idx: "ledmains" }
  };
  /* sloturile din EBHwIndex.SLOTS → țintele lor, în ordinea chipurilor */
  var SLOT_TARGETS = {
    balamale: ["cern"], deschidere: ["push", "man", "manS"], ridicare: ["lift"], glisante: ["slidesys"], sertare: ["drawsys", "guida", "pushd"],
    colt: ["corner"], imbinari: ["conn"], suspendare: ["susp", "suprail"], rafturi: ["sup", "asta", "pied"], iluminat: ["led", "ledstrip", "leddrv", "leddim", "ledsw", "ledmains"], altele: ["aw"]
  };
  /* sub-alegerile unui slot: câmpuri vechi (select) copiate în rând, vizibile numai când rândul lor vechi e vizibil */
  var SUBS = {
    ridicare: [["bLiftElec", "rowLiftElec", "fLiftElec"]],
    colt: [["bCUSize", "rowCUSize", "fCUSize"], ["bCUHand", "rowCUHand", "fCUHand"]]
  };
  /* textele de ajutor ale câmpurilor ascunse, copiate în rândul panoului când sunt vizibile */
  var HINTS = { ridicare: ["liftHint", "liftElecHint"], glisante: ["slideHint"], colt: ["cuHint"] };

  function targetOf(cat) { return TARGETS[cat] || null; }
  function slotOfTarget(tid) { var s = null; Object.keys(SLOT_TARGETS).forEach(function (k) { if (SLOT_TARGETS[k].indexOf(tid) >= 0) s = k; }); return s; }

  /* alegere (value) sau ștergere (value gol → valoarea «fără» a câmpului: "" sau, la sistemul de sertar, "legno") */
  function planOps(tid, value) {
    var T = TARGETS[tid]; if (!T) return null;
    var v = (value == null || value === "") ? (T.clear || "") : String(value);
    return T.via === "hwsel" ? { via: "hwsel", cat: T.cat, value: v } : { via: "ctl", ctl: T.ctl, value: v };
  }
  /* o alegere e «explicită» când valoarea nu e cea fără (sistemul de sertar «legno» e implicit) */
  function isExplicit(tid, v) { var T = TARGETS[tid]; return !!T && v != null && v !== "" && v !== (T.clear || ""); }

  /* flags = { doors, drawers, drawerBlocks, support, shelves, hang, slideRow, cornerRow }; has(tid) → alegere explicită */
  function slotApplies(slot, f, has) {
    f = f || {}; has = has || function () { return false; };
    var any = function () { for (var i = 0; i < arguments.length; i++) if (has(arguments[i])) return true; return false; };
    switch (slot) {
      case "balamale": return +f.doors > 0 || any("cern");
      case "deschidere": return +f.doors > 0 || +f.drawers > 0 || !!f.drawerBlocks || any("push", "man", "manS");
      case "ridicare": return +f.doors > 0 || any("lift");
      case "glisante": return !!f.slideRow || any("slidesys");
      case "sertare": return +f.drawers > 0 || !!f.drawerBlocks || any("drawsys", "guida", "pushd");
      case "colt": return !!f.cornerRow || any("corner");
      case "imbinari": return true;
      case "suspendare": return f.support === "sospeso" || any("susp", "suprail");
      case "rafturi": return +f.shelves > 0 || +f.hang > 0 || f.support === "piedini" || any("sup", "asta", "pied");
      case "iluminat": return true;
      case "altele": return +f.doors > 0 || any("aw");
    }
    return false;
  }

  /* ------------------------------------------------------------------ recente și favorite (per spectator) */
  var RECENT_MAX = 8;
  function keyOf(cat, id) { return cat + "|" + id; }
  function prefsNormalize(o) {
    var out = { recent: {}, fav: [] };
    if (o && typeof o === "object") {
      if (o.recent && typeof o.recent === "object") Object.keys(o.recent).forEach(function (s) { if (Array.isArray(o.recent[s])) out.recent[s] = o.recent[s].filter(function (k) { return typeof k === "string"; }).slice(0, RECENT_MAX); });
      if (Array.isArray(o.fav)) out.fav = o.fav.filter(function (k) { return typeof k === "string"; }).filter(function (k, i, a) { return a.indexOf(k) === i; });
    }
    return out;
  }
  function recentPush(p, slot, key) {
    var a = (p.recent[slot] || []).filter(function (k) { return k !== key; }); a.unshift(key); p.recent[slot] = a.slice(0, RECENT_MAX); return p;
  }
  function favToggle(p, key) { var i = p.fav.indexOf(key); if (i >= 0) p.fav.splice(i, 1); else p.fav.push(key); return i < 0; }

  /* ------------------------------------------------------------------ secțiuni */
  /* entries → { recomandat, potrivit, nu_se_potriveste }; fiecare element {e, r, i}. Fără interogare: în secțiune, cea mai mică rezervă întâi (rank), apoi ordinea din listă;
     cu interogare rămâne ordinea relevanței. */
  function buildSections(entries, checkFn, sectionFn, hasQuery) {
    var out = { recomandat: [], potrivit: [], nu_se_potriveste: [] };
    entries.forEach(function (e, i) { var r = checkFn(e), s = sectionFn(r); (out[s] || out.potrivit).push({ e: e, r: r, i: i }); });
    if (!hasQuery) Object.keys(out).forEach(function (k) { out[k].sort(function (a, b) { return ((a.r && a.r.rank) || 0) - ((b.r && b.r.rank) || 0) || a.i - b.i; }); });
    return out;
  }

  /* ------------------------------------------------------------------ avertismentele EBOpen → slot */
  var OPEN_SUSP = { load: 1, rail: 1, sideT: 1, suspRails: 1, notHung: 1, noKg: 1, wOpenSuspNoDrill: 1 };
  /* w = avertisment din built.warn.openWarn; sel = cfg.hwSel; O = EBOpen. Slotul: după articolul al cărui text `sys` îl poartă, apoi după tipul avertismentului. */
  function openWarnSlot(w, sel, O) {
    sel = sel || {};
    var get = function (id) { return (O && id) ? O.get(id) : null; }, pu = get(sel.push), pd = get(sel.pushd), su = get(sel.susp), cn = get(sel.conn);
    var sys = w && w.sys ? String(w.sys) : "";
    var tag = function (it, extra) { return it ? it.model + (extra || "") + " " + (it.art || "") : null; };
    if (pu && (sys === tag(pu) || sys === pu.model)) return w.k === "noHandle" && pd && sys === pd.model ? "sertare" : "deschidere";
    if (pd && (sys === tag(pd, pd.sysname ? " " + pd.sysname : "") || sys === pd.model)) return "sertare";
    if (su && (sys === tag(su) || sys === su.model)) return "suspendare";
    if (cn && sys === tag(cn)) return "imbinari";
    if (w && w.k === "connT") return "imbinari";
    if (w && OPEN_SUSP[w.k]) return "suspendare";
    if (w && (w.k === "pushdSys" || w.k === "extraCatch")) return "sertare";
    return "deschidere";
  }

  /* ------------------------------------------------------------------ date-cheie (numai din datele familiei) */
  function rng(lo, hi) {
    if (lo == null && hi == null) return "";
    if (lo != null && hi != null) return lo === hi ? String(lo) : lo + "–" + hi;
    return hi != null ? "≤ " + hi : "≥ " + lo;
  }
  function fill(s, o) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return o[k] == null ? m : o[k]; }); }
  /* M = modulele cu date (EBHinges, EBHingesMore, EBLiftFit, EBCornerFit, EBSliding, EBOpen, EBDrawersMore) și DRAWSYS; T = traducerea */
  function factsOf(e, T, M) {
    M = M || {}; var out = [], id = e && e.id, cat = e && e.cat, A = function (k, o) { out.push(fill(T(k), o)); };
    try {
      if (cat === "cern") {
        var f = (M.EBHingesMore && M.EBHingesMore.isMore && M.EBHingesMore.isMore(id) && M.EBHingesMore.familyOfHw(id)) || (M.EBHinges && M.EBHinges.familyOfHw && M.EBHinges.familyOfHw(id));
        if (f) {
          if (f.angle != null) A("hxfAngle", { v: f.angle });
          var th = f.doorTh && rng(f.doorTh[0], f.doorTh[1]); if (th) A("hxfDoor", { r: th });
          if (f.glass) A("hxfGlass", {});
        }
      } else if (cat === "lift") {
        var s = M.EBLiftFit && M.EBLiftFit.get(id), L = s && s.limits;
        if (L) {
          var a = rng(L.cabH && L.cabH[0], L.cabH && L.cabH[1]); if (a) A("hxfCabH", { r: a });
          a = rng(L.kg && L.kg[0], L.kg && L.kg[1]); if (a) A("hxfKg", { r: a });
          a = rng(L.cabW && L.cabW[0], L.cabW && L.cabW[1]); if (a) A("hxfCabW", { r: a });
          if (L.depthMin != null) A("hxfDepth", { v: L.depthMin });
        }
      } else if (cat === "corner") {
        var u = M.EBCornerFit && M.EBCornerFit.get(id);
        if (u) {
          if (u.kind) out.push(T("cuKind_" + u.kind)); if (u.body && u.body !== "any") out.push(T("cuBody_" + u.body));
          if (u.load && u.load.total != null) A("hxfLoad", { v: u.load.total });
        }
      } else if (cat === "slidesys") {
        var y = M.EBSliding && M.EBSliding.get(id), l = y && y.lim;
        if (y) {
          if (y.leaves && (y.leaves[0] != null || y.leaves[1] != null)) A("hxfLeaves", { r: rng(y.leaves[0], y.leaves[1]) });
          if (l) {
            var k = rng(l.kg && l.kg[0], l.kg && l.kg[1]); if (k) A("hxfKg", { r: k });
            k = rng(l.w && l.w[0], l.w && l.w[1]); if (k) A("hxfW", { r: k });
            k = rng(l.th && l.th[0], l.th && l.th[1]); if (k) A("hxfDoor", { r: k });
          }
        }
      } else if (cat === "push" || cat === "pushd" || cat === "susp" || cat === "suprail" || cat === "conn") {
        var it = M.EBOpen && M.EBOpen.get(id), lm = it && it.lim;
        if (it) {
          if (lm && lm.kg) { var g = rng(lm.kg[0], lm.kg[1]); if (g) A("hxfKg", { r: g }); }
          if (lm && lm.h) { var h = rng(lm.h[0], lm.h[1]); if (h) A("hxfH", { r: h }); }
          if (cat === "susp" && Array.isArray(it.frames) && it.frames.length) { var mk = Math.max.apply(null, it.frames.map(function (x) { return x.kg || 0; })); if (mk > 0) A("hxfKg", { r: "≤ " + mk }); }
          if (cat === "suprail" && M.EBOpen.railCap) { var rc = M.EBOpen.railCap(it); if (rc != null) A("hxfKg", { r: "≤ " + rc }); }
          if (cat === "conn" && it.T) { var tt = rng(it.T[0], it.T[1]); if (tt) A("hxfTh", { r: tt }); }
        }
      } else if (cat === "drawsys") {
        var ds = M.DRAWSYS && M.DRAWSYS[id];
        if (ds && Array.isArray(ds.nl) && ds.nl.length) A("hxfNL", { r: rng(ds.nl[0], ds.nl[ds.nl.length - 1]) });
      }
    } catch (x) { /* datele lipsă nu se inventează: fără date-cheie */ }
    return out.filter(Boolean).slice(0, 4);
  }

  var api = {
    TARGETS: TARGETS, SLOT_TARGETS: SLOT_TARGETS, SUBS: SUBS, HINTS: HINTS, RECENT_MAX: RECENT_MAX,
    targetOf: targetOf, slotOfTarget: slotOfTarget, planOps: planOps, isExplicit: isExplicit, slotApplies: slotApplies,
    keyOf: keyOf, prefsNormalize: prefsNormalize, recentPush: recentPush, favToggle: favToggle,
    buildSections: buildSections, openWarnSlot: openWarnSlot, factsOf: factsOf, rng: rng
  };

  /* ======================================================================== DOM */
  if (typeof document === "undefined") return api;

  var PREF_KEY = "ebanist_hwui_v1";
  var inited = false, lastHtml = "", lastCfg = null, lastBuilt = null, warnOpen = false;
  var SH = null;                  // starea foii deschise
  var PREFS = null;

  function $(id) { return document.getElementById(id); }
  function T(k) { try { return t(k); } catch (e) { return k; } }
  function H(s) { return esc(s); }
  function lang() { try { return state.lang; } catch (e) { return "it"; } }
  function el(id) { return document.getElementById(id); }

  function loadPrefs() {
    if (PREFS) return PREFS;
    var o = null; try { o = JSON.parse(localStorage.getItem(PREF_KEY) || "null"); } catch (e) { o = null; }
    PREFS = prefsNormalize(o); return PREFS;
  }
  function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(PREFS)); } catch (e) { /* mod privat / spațiu blocat: preferințele rămân numai în sesiune */ } }

  /* ------------------------------------------------------------------ citirea câmpurilor vechi */
  function hwSelEl(cat) { return document.querySelector('#hwSelBox select[data-cat="' + cat + '"]'); }
  function ensureHwBox() { if ($("hwSelBox") && !hwSelEl("cern") && typeof renderHwSel === "function") { try { renderHwSel(); } catch (e) { /* */ } } }
  function readTarget(tid) {
    var T0 = TARGETS[tid]; if (!T0) return "";
    if (T0.via === "hwsel") { var s = hwSelEl(T0.cat); return s ? s.value : ""; }
    var c = $(T0.ctl); return c ? c.value : "";
  }
  function firstOptText(tid) {
    var T0 = TARGETS[tid]; var c = T0.via === "hwsel" ? hwSelEl(T0.cat) : $(T0.ctl);
    return c && c.options && c.options[0] ? c.options[0].textContent : "";
  }
  function selText(sel) { return sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].textContent : ""; }
  function bn(brand, name) { return (brand && brand !== "—" ? brand + " " : "") + name; }

  /* numele unei alegeri, ca în câmpul vechi (marcă + nume + cod) */
  function describe(tid, v) {
    var T0 = TARGETS[tid];
    try {
      if (T0.via === "hwsel") {
        var s = hwSelEl(T0.cat), o = s && [].filter.call(s.options, function (x) { return x.value === v; })[0];
        if (!o) return v;
        return o.textContent.replace(/ — /, " ") + (o.dataset && o.dataset.art && o.dataset.art !== "—" ? " · " + o.dataset.art : "");
      }
      if (tid === "lift") { var LS = liftSysOf(v); var txt = LS ? bn(LS.brand, LS.name) : v; var e = $("bLiftElec") && $("bLiftElec").value; if (LS && e && liftElecOf(v, e)) txt += " · " + selText($("bLiftElec")); return txt; }
      if (tid === "corner") { var u = root.EBCornerFit && EBCornerFit.get(v); var z = $("bCUSize") && $("bCUSize").value; return (u ? bn(u.brand, u.name) : v) + (z ? " · " + selText($("bCUSize")) : ""); }
      if (tid === "slidesys") { var sy = root.EBSliding && EBSliding.get(v); return sy ? bn(sy.brand, sy.name) : v; }
      if (tid === "drawsys") { var d = DRAWSYS[v]; return d ? ((d.n && (d.n[lang()] || d.n.it)) || v) : v; }
      if (tid === "led") { var le = $("bLed"); var base = selText(le); var ln = $("bLedLen") && +$("bLedLen").value > 0 && le.value === "manual" ? " · " + $("bLedLen").value + " mm" : ""; return base + ln; }
    } catch (e) { /* */ }
    return v;
  }

  function flags(cfg) {
    cfg = cfg || {};
    return { doors: +cfg.doors || 0, drawers: +cfg.drawers || 0, drawerBlocks: (typeof hasDrawerBlocks === "function") ? hasDrawerBlocks(cfg) : false,
             support: cfg.support, shelves: +cfg.shelves || 0, hang: +cfg.hang || 0,
             slideRow: !!$("rowSlide") && $("rowSlide").style.display !== "none", cornerRow: !!$("rowCU") && $("rowCU").style.display !== "none" };
  }
  function hasFn() { return function (tid) { return isExplicit(tid, readTarget(tid)); }; }

  /* ------------------------------------------------------------------ avertismentele unui slot (aceleași ca ale Constructorului) */
  var LIFT_WK = { kh: "hi", w: "w", kg: "kg", hi: "hi", wi: "wi", depth: "depth" };
  function liftMsgs(wn) {
    var out = [];
    ((wn && wn.liftWarn) || []).forEach(function (w) {
      var m = null;
      if (w.k === "front") m = T("wLiftFront");
      else if (w.k === "range") m = T("wLiftRange").replace("{sys}", w.sys).replace("{what}", T("liftWhat_" + (LIFT_WK[w.what] || w.what))).replace("{v}", w.v).replace("{lo}", w.lo == null ? "—" : w.lo).replace("{hi}", w.hi == null ? "—" : w.hi);
      else if (w.k === "power") m = T("wLiftPower").replace("{sys}", w.sys).replace("{kg}", w.kg).replace("{h}", w.h);
      else if (w.k === "unv") m = T("wLiftUnv").replace("{sys}", w.sys);
      else if (w.k === "noservo") m = T("wLiftNoServo").replace("{sys}", w.sys);
      if (m) out.push(m);
    });
    return out;
  }
  function uniq(a) { var s = {}; return a.filter(function (m) { if (!m || s[m]) return false; s[m] = 1; return true; }); }

  function slotWarnings(slot, cfg, built, ctx) {
    var wn = (built && built.warn) || {}, out = [];
    try {
      if (slot === "ridicare") out = liftMsgs(wn);
      else if (slot === "glisante") { if (root.EBSliding) (wn.slideWarn || []).forEach(function (w) { var m = EBSliding.noteText(w, t); if (m) out.push(m); }); }
      else if (slot === "colt") { if (root.EBCornerUI && (wn.cuWarn || (built && built.cu))) out = EBCornerUI.notes(wn, built).filter(function (m) { return m.indexOf("⚠︎") === 0; }).map(function (m) { return m.replace(/^⚠︎\s*/, ""); }); }
      else if (slot === "deschidere" || slot === "sertare" || slot === "imbinari" || slot === "suspendare") {
        (wn.openWarn || []).forEach(function (w) { if (openWarnSlot(w, cfg.hwSel, root.EBOpen) === slot) { var m = EBOpen.msg(w, t); if (m) out.push(m); } });
        if (slot === "sertare") (wn.drawWarn || []).forEach(function (w) { var s = T(w.k); for (var k in w) if (k !== "k") s = s.replace("{" + k + "}", w[k]); out.push(s); });
      } else if (slot === "balamale" && ctx && root.EBHwFit) {
        var id = (cfg.hwSel && cfg.hwSel.cern) || (((state.settings || {}).hwProd || {}).cern) || ((HWDB.cern || [])[0] || {}).id;
        var e = id && hwIndex().filter(function (x) { return x.cat === "cern" && x.id === id; })[0];
        if (e) { var r = EBHwFit.check(e, ctx); if (r.ok === false) out = EBHwFit.msg(r.why, t); }
      }
    } catch (x) { out = []; }
    return uniq(out);
  }

  /* ------------------------------------------------------------------ panoul */
  function slotLabel(sl) { return T(sl.key); }
  /* «implicit — …» în cuvinte: prima opțiune a câmpului vechi spune deja ce e implicit («Catalog — Marcă Nume», «Niciuna», «ca la uși») */
  function implicitText(tid) {
    var fo = firstOptText(tid);
    if (!fo) return T("hxpNoneW");
    return /—/.test(fo) ? T("hxpImplicit").replace("{x}", fo.replace(/^[^—]*—\s*/, "")) : fo;
  }
  function curLinesHtml(slot) {
    var tids = SLOT_TARGETS[slot], lines = [], explicit = 0;
    if (slot === "deschidere" && $("bHandles")) lines.push(esc(selText($("bHandles"))));
    tids.forEach(function (tid) {
      var v = readTarget(tid);
      if (isExplicit(tid, v)) { explicit++; lines.push((tids.length > 1 ? '<span class="hwp-k">' + esc(catLabel(tid)) + ":</span> " : "") + "<b>" + esc(describe(tid, v)) + "</b>"); }
    });
    if (!explicit) {
      if (slot === "sertare") lines.push(esc(T("hxpImplicit").replace("{x}", describe("drawsys", readTarget("drawsys") || "legno"))));
      else if (slot === "iluminat") lines.push(esc(firstOptText("led") || T("hxpNoneW")));
      else if (slot === "deschidere") lines.push(esc(implicitText("man")));
      else lines.push(esc(implicitText(tids[0])));
    }
    return lines.join("<br>");
  }
  function subHtml(slot) {
    var out = "";
    (SUBS[slot] || []).forEach(function (sc) {
      var s = $(sc[0]), row = $(sc[1]); if (!s || !row || row.style.display === "none") return;
      var opts = [].filter.call(s.options, function (o) { return !o.hidden; }).map(function (o) { return '<option value="' + H(o.value) + '"' + (o.value === s.value ? " selected" : "") + ">" + H(o.textContent) + "</option>"; }).join("");
      out += '<label class="hwp-sub"><span>' + H(T(sc[2])) + '</span><select data-hwp-sub="' + sc[0] + '">' + opts + "</select></label>";
    });
    return out;
  }
  function hintHtml(slot) {
    var out = [];
    (HINTS[slot] || []).forEach(function (id) { var p = $(id); if (p && p.style.display !== "none" && p.textContent.trim()) out.push(p.textContent.trim()); });
    /* senzorul pe ușă (833.89.059) ține locul dimmerului și al cablului de întrerupător: alegerea lor pe corp nu se numără (D-157) */
    if (slot === "iluminat" && $("bLedSw") && $("bLedSw").value === "door" && (isExplicit("leddim", readTarget("leddim")) || isExplicit("ledsw", readTarget("ledsw")))) out.push(T("hxpLedDoor"));
    return out.length ? '<div class="hwp-hint">' + out.map(H).join(" ") + "</div>" : "";
  }
  /* la balamale insigna spune LIMITA încălcată (din EBHwFit, aceeași ca în selector), nu numai câte sunt */
  function warnLineHtml(slot, warns) {
    return slot === "balamale" && warns.length ? '<div class="hwp-wl" data-hwp-wl="' + slot + '">' + warns.map(H).join("<br>") + "</div>" : "";
  }

  function badgeTitle(warns) { return T("hxpWarnN").replace("{n}", warns.length) + " — " + warns.join("; "); }
  function paintPanel(cfg, built) {
    var box = $("hwPanel"); if (!box) return;
    ensureHwBox();
    var f = flags(cfg), has = hasFn(), ctx = null;
    try { ctx = hwFitCtx(cfg, built); } catch (e) { ctx = null; }
    var rows = [], nChoices = 0, nWarn = 0, warnList = [];
    Object.keys(TARGETS).forEach(function (tid) { if (isExplicit(tid, readTarget(tid))) nChoices++; });
    root.EBHwIndex.SLOTS.forEach(function (sl) {
      if (!slotApplies(sl.id, f, has)) return;
      var warns = slotWarnings(sl.id, cfg, built, ctx);
      nWarn += warns.length;
      if (warns.length) warnList.push({ label: slotLabel(sl), msgs: warns });
      rows.push('<li class="hwp-row" data-slot="' + sl.id + '"><div class="hwp-txt"><div class="hwp-name">' + H(slotLabel(sl)) + '</div><div class="hwp-cur">' + curLinesHtml(sl.id) + "</div>" + warnLineHtml(sl.id, warns) + hintHtml(sl.id) + subHtml(sl.id) + "</div>" +
        (warns.length ? '<span class="hwp-badge" title="' + H(badgeTitle(warns)) + '" aria-label="' + H(badgeTitle(warns)) + '">' + warns.length + "</span>" : "") +
        '<button type="button" class="btn sm hwp-chg" data-hwp-change="' + sl.id + '" aria-label="' + H(T("hxpChange") + ": " + slotLabel(sl)) + '">' + H(T("hxpChange")) + "</button></li>");
    });
    var sum = T("hxpSum").replace("{n}", nChoices).replace("{m}", nWarn);
    var warnBox = warnOpen ? '<div class="hwp-warns" id="hwpWarns">' + (warnList.length ? warnList.map(function (w) { return '<div class="hwp-w"><b>' + H(w.label) + "</b><ul>" + w.msgs.map(function (m) { return "<li>" + H(m) + "</li>"; }).join("") + "</ul></div>"; }).join("") : '<div class="mini">' + H(T("hxpNoWarn")) + "</div>") + "</div>" : "";
    var html = '<div class="hwp-top"><div class="hwp-sum" role="status">' + H(sum) + '</div><button type="button" class="chip sm" id="hwpWarnBtn" aria-expanded="' + (warnOpen ? "true" : "false") + '" aria-controls="hwpWarns">' + H(T(warnOpen ? "hxpHideWarn" : "hxpAllWarn")) + "</button></div>" + warnBox +
      '<p class="mini hwp-hintp">' + H(T("hxpHint")) + '</p><ul class="hwp-list" aria-label="' + H(T("hxpTitle")) + '">' + rows.join("") + "</ul>";
    if (html !== lastHtml) {
      var act = document.activeElement, keep = act && box.contains(act) ? (act.getAttribute("data-hwp-change") || act.getAttribute("data-hwp-sub") || act.id || "") : "";
      box.innerHTML = html; lastHtml = html;
      if (keep) { var n = box.querySelector('[data-hwp-change="' + keep + '"],[data-hwp-sub="' + keep + '"],#' + keep.replace(/[^\w-]/g, "")); if (n && n.focus) { try { n.focus({ preventScroll: true }); } catch (e) { /* */ } } }
    }
    var sm = $("sumHw"); if (sm) sm.textContent = nChoices ? String(nChoices) : "";
  }

  function refresh(cfg, built) {
    if (!inited) return;
    try {
      if (!cfg) { cfg = cfgFromForm(); built = null; try { built = buildModule(cfg); } catch (e) { built = null; } }
      lastCfg = cfg; lastBuilt = built;
      paintPanel(cfg, built);
    } catch (e) { /* panoul nu trebuie să strice desenul corpului */ if (typeof console !== "undefined" && console.warn) console.warn("EBHwUI.refresh", e); }
  }
  function relabel() {
    if (!inited) return;
    lastHtml = ""; refresh(lastCfg, lastBuilt);
    if (SH && $("shHw").classList.contains("on")) {
      SH.items = slotItems(SH.slot); SH.byKey = {}; SH.items.forEach(function (e) { SH.byKey[keyOf(e.cat, e.id)] = e; }); SH.fit = {};
      buildSkeleton(); renderAll();
    }
  }

  /* ------------------------------------------------------------------ scrierea în câmpul vechi */
  function fire(node) { node.dispatchEvent(new Event("change", { bubbles: true })); }
  function applyOp(op) {
    if (!op) return false;
    if (op.via === "hwsel") {
      ensureHwBox();
      var s = hwSelEl(op.cat);
      if (s) { s.value = op.value; if (s.value !== op.value) { try { renderHwSel(); } catch (e) { /* */ } s = hwSelEl(op.cat); if (s) s.value = op.value; } }
      if (!s || s.value !== op.value) return false;
      fire(s); return true;
    }
    var c = $(op.ctl); if (!c) return false;
    c.value = op.value; if (c.value !== op.value) return false;
    fire(c); return true;
  }
  function subWrite(id, value) { var c = $(id); if (!c) return; c.value = value; fire(c); }

  /* ------------------------------------------------------------------ foaia: elementele */
  var VIRT = ["slidesys", "drawsys", "led"];
  function catLabel(cat) {
    if (cat === "slidesys") return T("hxcSlide"); if (cat === "drawsys") return T("hxcDraw"); if (cat === "led") return T("hxcLed");
    if (cat === "conn") return T("fJoint");
    if (typeof HW_CAT_OF !== "undefined") { var k = Object.keys(HW_CAT_OF).filter(function (x) { return HW_CAT_OF[x] === cat; })[0]; if (k) return T(k); }
    return cat;
  }
  function virtualPseudo() {
    var P = { slidesys: [], drawsys: [], led: [] }, ty = $("bTipo") ? $("bTipo").value : "standard";
    if (root.EBSliding) EBSliding.list().forEach(function (sy) { if (EBSliding.typeOk(sy, ty)) P.slidesys.push({ id: sy.key, brand: sy.brand, n: sy.name, art: "—" }); });
    DRAWSYS_IDS.forEach(function (id) { var d = DRAWSYS[id]; P.drawsys.push({ id: id, brand: (d.brand && d.brand !== "—") ? d.brand : "", n: d.n || id, art: "—" }); });
    if ($("bLed")) [].forEach.call($("bLed").options, function (o) { if (o.value) P.led.push({ id: o.value, brand: "", n: o.textContent, art: "—" }); });
    return P;
  }
  /* articolele unui slot: din indexul H.1 (categoriile alegibile) + listele virtuale (sisteme, opțiuni) */
  function slotItems(slot) {
    var idx = hwIndex(), tids = SLOT_TARGETS[slot], out = [], P = virtualPseudo();
    tids.forEach(function (tid) {
      var T0 = TARGETS[tid];
      if (T0.idx) idx.forEach(function (e) { if (e.cat === T0.idx) out.push(tid === e.cat ? e : Object.assign({}, e, { cat: tid })); });
      else if (VIRT.indexOf(tid) >= 0) {
        var vi = root.EBHwIndex.build(P, [[tid, ""]]);
        vi.forEach(function (e) { if (e.cat === tid) { e.slot = slot; out.push(e); } });
      }
    });
    return out;
  }
  function fitOf(e) {
    var k = e.cat + "|" + e.id; if (SH.fit[k]) return SH.fit[k];
    var r; try { r = EBHwFit.check(e, SH.ctx); } catch (x) { r = { ok: null, why: [], rank: 1e6, unknownLimits: true, fam: "" }; }
    return (SH.fit[k] = r);
  }
  function entryName(e) { return (e.names && (e.names[lang()] || e.names.it)) || e.id; }
  /* sistemul de sertar: laterala (HWDB.zarga) și glisiera lui, din datele sistemului; sertarul din lemn merge pe glisiera aleasă în Catalog / pe corp */
  function drawSysExtra(id) {
    var d = typeof DRAWSYS !== "undefined" ? DRAWSYS[id] : null, out = [];
    function art(cat, aid) { var it = aid && hwList(cat).filter(function (x) { return x.id === aid; })[0]; return it ? bn(it.brand, hwName(it)) + (it.art && it.art !== "—" ? " · " + it.art : "") : ""; }
    if (!d) return out;
    var side = art("zarga", d.lat), run = d.metal ? art("guida", d.guida) : (function () { try { var gid = guidaIdFor(SH && SH.ctx ? SH.ctx.cfg : null); return art("guida", gid); } catch (x) { return ""; } })();
    if (side) out.push(T("hxsSides").replace("{x}", side));
    if (run) out.push(T("hxsRunner").replace("{x}", run));
    return out;
  }
  /* marca nu se repetă când numele ei începe deja cu marca («Blum» + «Blum LEGRABOX») */
  function brandHtml(e) { var b = e.brand || "", n = entryName(e); return b && n.toLowerCase().indexOf(b.toLowerCase()) !== 0 ? '<span class="hxc-brand">' + H(b) + "</span> " : ""; }
  function priceBadge(e) { return e.price === 0 && !e.own ? '<span class="hxb warn">' + H(T("hxbNoPrice")) + "</span>" : ""; }

  function cardHtml(e, r, opt) {
    var key = keyOf(e.cat, e.id), cur = readTarget(e.cat) === e.id && isExplicit(e.cat, e.id), fav = loadPrefs().fav.indexOf(key) >= 0;
    var facts = factsOf(e, T, { EBHinges: root.EBHinges, EBHingesMore: root.EBHingesMore, EBLiftFit: root.EBLiftFit, EBCornerFit: root.EBCornerFit, EBSliding: root.EBSliding, EBOpen: root.EBOpen, DRAWSYS: typeof DRAWSYS !== "undefined" ? DRAWSYS : null });
    var why = (r && r.ok === false) ? EBHwFit.msg(r.why, t) : [];
    var unk = r && r.ok !== false && r.fam && r.unknownLimits;
    return '<li class="hxc' + (cur ? " is-cur" : "") + (r && r.ok === false ? " is-bad" : "") + '" data-key="' + H(key) + '">' +
      '<button type="button" class="hxc-main" data-act="pick" data-key="' + H(key) + '"' + (cur ? ' aria-current="true"' : "") + ">" +
        '<span class="hxc-t">' + brandHtml(e) + '<span class="hxc-name">' + H(entryName(e)) + "</span></span>" +
        (SLOT_TARGETS[SH.slot].length > 1 ? '<span class="hxc-cat">' + H(catLabel(e.cat)) + "</span>" : "") +
        (e.art ? '<span class="hxc-art">' + H(e.art) + "</span>" : "") +
        (facts.length ? '<span class="hxc-facts">' + facts.map(H).join(" · ") + "</span>" : "") +
        (e.cat === "drawsys" ? drawSysExtra(e.id).map(function (x) { return '<span class="hxc-facts">' + H(x) + "</span>"; }).join("") : "") +
        '<span class="hxc-badges"><span class="hxb">' + H(T("hxbUnv")) + "</span>" + priceBadge(e) + (e.chk ? '<span class="hxb warn">' + H(T("artCheck").replace(/^—\s*/, "")) + "</span>" : "") +
          (unk ? '<span class="hxb">' + H(T("hfUnknown")) + "</span>" : "") + (cur ? '<span class="hxb on">' + H(T("hxsChosen")) + "</span>" : "") + "</span>" +
        (why.length ? '<span class="hxc-why">' + why.map(H).join("<br>") + "</span>" : "") +
      "</button>" +
      '<div class="hxc-side"><button type="button" class="hxc-ic" data-act="fav" data-key="' + H(key) + '" aria-pressed="' + (fav ? "true" : "false") + '" aria-label="' + H(T(fav ? "hxsFavDel" : "hxsFavAdd")) + '">' + (fav ? "★" : "☆") + "</button>" +
      '<button type="button" class="hxc-det" data-act="det" data-key="' + H(key) + '">' + H(T("hxsDetails")) + "</button></div></li>";
  }

  function sectionHtml(id, title, list, note) {
    if (!list.length) return "";
    var lim = SH.lim[id] || 30, shown = list.slice(0, lim), left = list.length - shown.length;
    return '<section class="hxs-sec" data-sec="' + id + '"><h4 class="hxs-h">' + H(title) + ' <span class="hxs-n">' + list.length + "</span></h4>" + (note ? '<p class="mini hxs-note">' + H(note) + "</p>" : "") +
      '<ul class="hxs-ul">' + shown.map(function (x) { return cardHtml(x.e, x.r); }).join("") + "</ul>" +
      (left > 0 ? '<button type="button" class="btn sm hxs-more" data-more="' + id + '">' + H(T("hxsMore").replace("{n}", Math.min(left, 40))) + "</button>" : "") + "</section>";
  }

  function buildSkeleton() {
    var slot = SH.slot, sl = root.EBHwIndex.SLOTS.filter(function (x) { return x.id === slot; })[0];
    $("hxsBody").innerHTML =
      '<div class="hxs-head"><h3 id="hxsTitle">' + H(slotLabel(sl)) + "</h3>" +
      '<input type="search" id="hxsQ" class="hxs-q" autocomplete="off" spellcheck="false" enterkeyhint="search" placeholder="🔍 ' + H(T("hxsSearch")) + '" aria-label="' + H(T("hxsSearch")) + '" value="' + H(SH.q) + '">' +
      '<div class="hxs-chips" id="hxsCats" role="group" aria-label="' + H(T("hxsCats")) + '"></div>' +
      '<div class="hxs-chips" id="hxsBrands" role="group" aria-label="' + H(T("hxsBrands")) + '"></div>' +
      '<div class="hxs-row"><label class="hxs-fit"><input type="checkbox" id="hxsFit"' + (SH.fitOn ? " checked" : "") + "> <span>" + H(T("hxsFit")) + '</span></label>' +
      '<span class="mini hxs-count" id="hxsCount" aria-live="polite"></span></div></div><div id="hxsList"></div>';
    $("hxsQ").addEventListener("input", function () { clearTimeout(SH.deb); SH.deb = setTimeout(function () { SH.q = $("hxsQ").value; SH.lim = {}; renderAll(); }, 120); });
    $("hxsFit").addEventListener("change", function () { SH.fitOn = $("hxsFit").checked; SH.lim = {}; renderAll(); });
  }

  function chipHtml(kind, val, label, n, on) {
    return '<button type="button" class="chip sm' + (on ? " on" : "") + '" data-chip="' + kind + '" data-val="' + H(val) + '" aria-pressed="' + (on ? "true" : "false") + '">' + H(label) + (n != null ? ' <span class="hxs-n">' + n + "</span>" : "") + "</button>";
  }

  function renderAll() {
    if (!SH || !SH.items) return;
    if (SH.detail) { renderDetail(); return; }
    var q = SH.q, res = root.EBHwIndex.search(SH.items, q, { cat: SH.cat, brand: SH.brand });
    var fac = root.EBHwIndex.facets(SH.items, { text: q, cat: SH.cat, brand: SH.brand });
    /* chipuri: categorie (numai la sloturile cu mai multe ținte) și marcă */
    var tids = SLOT_TARGETS[SH.slot].filter(function (tid) { return (fac.cat[tid] || 0) > 0 || SH.cat === tid; });
    $("hxsCats").style.display = SLOT_TARGETS[SH.slot].length > 1 ? "" : "none";
    $("hxsCats").innerHTML = chipHtml("cat", "", T("hxsAll"), null, !SH.cat) + tids.map(function (tid) { return chipHtml("cat", tid, catLabel(tid), fac.cat[tid] || 0, SH.cat === tid); }).join("");
    var brands = Object.keys(fac.brand).sort(function (a, b) { return fac.brand[b] - fac.brand[a] || a.localeCompare(b); });
    if (SH.brand && brands.indexOf(SH.brand) < 0) brands.push(SH.brand);
    $("hxsBrands").style.display = brands.length > 1 || SH.brand ? "" : "none";
    $("hxsBrands").innerHTML = chipHtml("brand", "", T("hxsAll"), null, !SH.brand) + brands.map(function (b) { return chipHtml("brand", b, b, fac.brand[b] || 0, SH.brand === b); }).join("");
    $("hxsCount").textContent = T("hxsCount").replace("{n}", res.length);

    var html = "", P = loadPrefs(), byKey = SH.byKey;
    if (SH.slot === "sertare" && SH.cat === "guida") html += '<p class="mini hxs-note">' + H(T("hxsRunnerNote")) + "</p>";
    /* «Niciuna / implicit»: câte un rând pentru ținta cu alegere explicită (sau pentru cea selectată în chip) */
    SLOT_TARGETS[SH.slot].forEach(function (tid) {
      if (SH.cat && SH.cat !== tid) return;
      var v = readTarget(tid), isOn = isExplicit(tid, v);
      if (!isOn && SLOT_TARGETS[SH.slot].length > 1 && !SH.cat) return;
      html += '<ul class="hxs-ul"><li class="hxc hxc-clear' + (!isOn ? " is-cur" : "") + '"><button type="button" class="hxc-main" data-act="clear" data-tid="' + tid + '"' + (!isOn ? ' aria-current="true"' : "") + ">" +
        '<span class="hxc-t"><span class="hxc-name">' + H(T("hxsClear")) + "</span>" + (SLOT_TARGETS[SH.slot].length > 1 ? ' <span class="hxc-brand">· ' + H(catLabel(tid)) + "</span>" : "") + "</span>" +
        '<span class="hxc-facts">' + H(isOn ? describe(tid, v) : (tid === "drawsys" ? T("hxpImplicit").replace("{x}", describe("drawsys", "legno")) : implicitText(tid))) + "</span></button></li></ul>";
    });
    /* Recente și Favorite (numai fără interogare și fără filtre de marcă) */
    if (!q && !SH.brand) {
      var rec = (P.recent[SH.slot] || []).map(function (k) { return byKey[k]; }).filter(function (e) { return e && (!SH.cat || e.cat === SH.cat); }).slice(0, 6);
      var fav = P.fav.map(function (k) { return byKey[k]; }).filter(function (e) { return e && (!SH.cat || e.cat === SH.cat); });
      if (rec.length) html += sectionHtml("recent", T("hxsRecent"), rec.map(function (e) { return { e: e, r: fitOf(e) }; }));
      if (fav.length) html += sectionHtml("fav", T("hxsFav"), fav.map(function (e) { return { e: e, r: fitOf(e) }; }));
    }
    if (!res.length) html += '<p class="mini hxs-none">' + H(T("hxsNoRes")) + "</p>";
    else if (!SH.fitOn) html += sectionHtml("flat", T("hxsFlat"), res.map(function (e, i) { return { e: e, r: fitOf(e), i: i }; }));
    else {
      var sec = buildSections(res, fitOf, EBHwFit.section, !!q), anyFam = res.some(function (e) { return fitOf(e).fam; });
      if (!anyFam) html += sectionHtml("flat", T("hxsFlat"), sec.recomandat.concat(sec.potrivit).concat(sec.nu_se_potriveste).sort(function (a, b) { return a.i - b.i; }));
      else {
        html += sectionHtml("recomandat", T("hfSec_recomandat"), sec.recomandat);
        html += sectionHtml("potrivit", T("hfSec_potrivit"), sec.potrivit, sec.potrivit.some(function (x) { return x.r.unknownLimits; }) ? T("hfUnknown") : "");
        if (sec.nu_se_potriveste.length) {
          html += '<details class="hxs-nofit"' + (SH.openNo ? " open" : "") + "><summary>" + H(T("hfSec_nu_se_potriveste")) + ' <span class="hxs-n">' + sec.nu_se_potriveste.length + "</span></summary>" + sectionHtml("nofit", T("hfSec_nu_se_potriveste"), sec.nu_se_potriveste).replace(/<h4 class="hxs-h">.*?<\/h4>/, "") + "</details>";
        }
      }
    }
    $("hxsList").innerHTML = html;
    var nf = $("hxsList").querySelector(".hxs-nofit"); if (nf) nf.addEventListener("toggle", function () { SH.openNo = nf.open; });
  }

  /* ------------------------------------------------------------------ detalii */
  function detailRows(e, r) {
    var rows = [];
    function R(k, v) { if (v != null && v !== "") rows.push("<dt>" + H(T(k)) + "</dt><dd>" + H(v) + "</dd>"); }
    R("hxdBrand", e.brand); R("hxdCode", e.art);
    if (e.price != null && e.price > 0) R("hxdPrice", e.price + " €");
    var src = null;
    try {
      if (e.cat === "lift" && root.EBLiftFit) { var s = EBLiftFit.get(e.id); src = s && s.src; }
      else if (e.cat === "corner" && root.EBCornerFit) { var u = EBCornerFit.get(e.id); src = u && u.src; }
      else if (e.cat === "slidesys" && root.EBSliding) { var y = EBSliding.get(e.id); src = y && y.src; }
      else if (root.EBOpen && EBOpen.get && ["push", "pushd", "susp", "suprail", "conn"].indexOf(e.cat) >= 0) { var o = EBOpen.get(e.id); src = o && o.src; }
      else if (e.cat === "cern" && root.EBHingesMore && EBHingesMore.isMore(e.id)) { var hf = EBHingesMore.familyOfHw(e.id); src = hf && hf.src; }
    } catch (x) { src = null; }
    R("hxdSource", src);
    return rows;
  }
  function renderDetail() {
    var e = SH.byKey[SH.detail]; if (!e) { SH.detail = null; renderAll(); return; }
    var r = fitOf(e), why = r.ok === false ? EBHwFit.msg(r.why, t) : [];
    var facts = factsOf(e, T, { EBHinges: root.EBHinges, EBHingesMore: root.EBHingesMore, EBLiftFit: root.EBLiftFit, EBCornerFit: root.EBCornerFit, EBSliding: root.EBSliding, EBOpen: root.EBOpen, DRAWSYS: typeof DRAWSYS !== "undefined" ? DRAWSYS : null });
    var rows = detailRows(e, r), extra = "";
    if (e.cat === "slidesys" && root.EBSliding) { var sy = EBSliding.get(e.id); if (sy) extra = '<p class="mini">' + H(EBSliding.limitsText(sy, t)) + "</p>"; }
    var tech = "";
    if (e.cat === "cern" && typeof hingeFamHas === "function" && hingeFamHas(e.id)) tech = '<button type="button" class="btn sm" data-act="tech" data-key="' + H(SH.detail) + '">' + H(T("hxdTech")) + "</button>";
    else if (e.cat === "guida" && typeof slideSysOf === "function" && slideSysOf(e.id)) tech = '<button type="button" class="btn sm" data-act="tech" data-key="' + H(SH.detail) + '">' + H(T("hxdTech")) + "</button>";
    $("hxsList").innerHTML = '<div class="hxd"><button type="button" class="btn sm" data-act="back">← ' + H(T("hxsBack")) + "</button>" +
      '<h4 class="hxd-t">' + H(bn(e.brand, entryName(e))) + "</h4>" +
      (facts.length ? '<p class="hxc-facts">' + facts.map(H).join(" · ") + "</p>" : "") +
      (why.length ? '<div class="hxd-why"><b>' + H(T("hxdWhy")) + ":</b><br>" + why.map(H).join("<br>") + "</div>" : "") +
      (rows.length ? '<dl class="hxd-dl">' + rows.join("") + "</dl>" : '<p class="mini">' + H(T("hxdNoData")) + "</p>") + extra +
      '<p class="mini">' + H(T("hxdUnv")) + "</p>" +
      '<div class="hxd-act"><button type="button" class="btn red" data-act="pick" data-key="' + H(SH.detail) + '">' + H(T("hxsChoose")) + "</button> " + tech + "</div></div>";
    var b = $("hxsList").querySelector('[data-act="back"]'); if (b) b.focus();
  }
  function openTech(e) {
    try {
      if (e.cat === "cern") { $("hsBody").innerHTML = hingeSheet(e.id, { lang: lang(), TB: 5, plate: ((state.settings || {}).hwProd || {}).plate }) || ""; openSheet("hsSheet"); }
      else if (e.cat === "guida") { $("hsBody").innerHTML = EBSlides.sheetHtml(slideSysOf(e.id), { lang: lang() }) || ""; openSheet("hsSheet"); }
    } catch (x) { /* fișa nu se poate construi: rămâne rezumatul */ }
  }

  /* ------------------------------------------------------------------ deschidere / închidere */
  function open(slot) {
    if (!SLOT_TARGETS[slot] || !inited) return false;
    var cfg; try { cfg = cfgFromForm(); } catch (e) { cfg = lastCfg; }
    var ctx = null; try { ctx = hwFitCtx(cfg); } catch (e) { ctx = null; }
    var items = slotItems(slot), byKey = {};
    items.forEach(function (e) { byKey[keyOf(e.cat, e.id)] = e; });
    SH = { slot: slot, q: "", cat: "", brand: "", fitOn: true, lim: {}, fit: {}, ctx: ctx, items: items, byKey: byKey, detail: null, openNo: false, deb: 0,
           opener: document.activeElement && document.activeElement.closest && document.activeElement.closest("[data-hwp-change]") };
    buildSkeleton(); renderAll();
    openSheet("shHw");
    setTimeout(function () { var q = $("hxsQ"); if (q && $("shHw").classList.contains("on")) q.focus(); }, 90);
    return true;
  }
  function closeSheetNow() { var sh = $("shHw"); if (sh.classList.contains("on")) { sh.classList.remove("on"); if (!document.querySelectorAll(".sheet.on").length) $("scrim").classList.remove("on"); if (typeof navSync === "function") navSync(); } }
  function onClosed() {
    var op = SH && SH.opener, slot = SH && SH.slot; SH = null;
    var n = slot && $("hwPanel") && $("hwPanel").querySelector('[data-hwp-change="' + slot + '"]');
    if (n) { try { n.focus({ preventScroll: true }); } catch (e) { /* */ } } else if (op && op.focus) { try { op.focus(); } catch (e) { /* */ } }
  }

  function choose(e) {
    var ok = applyOp(planOps(e.cat, e.id));
    if (!ok) { toast(T("hxsFail")); return; }
    recentPush(loadPrefs(), SH.slot, keyOf(e.cat, e.id)); savePrefs();
    closeSheetNow();
  }
  function clearTarget(tid) {
    var ok = applyOp(planOps(tid, ""));
    if (!ok) { toast(T("hxsFail")); return; }
    closeSheetNow();
  }

  function onListClick(ev) {
    var b = ev.target.closest("[data-act],[data-chip],[data-more]"); if (!b || !SH) return;
    if (b.dataset.chip) { if (b.dataset.chip === "cat") SH.cat = b.dataset.val; else SH.brand = b.dataset.val; SH.lim = {}; renderAll(); return; }
    if (b.dataset.more) { SH.lim[b.dataset.more] = (SH.lim[b.dataset.more] || 30) + 40; var y = $("shHw").scrollTop; renderAll(); $("shHw").scrollTop = y; return; }
    var act = b.dataset.act, e = SH.byKey[b.dataset.key];
    if (act === "pick" && e) choose(e);
    else if (act === "clear") clearTarget(b.dataset.tid);
    else if (act === "fav" && e) { var key = b.dataset.key, on = favToggle(loadPrefs(), key); savePrefs(); b.setAttribute("aria-pressed", on ? "true" : "false"); b.textContent = on ? "★" : "☆"; b.setAttribute("aria-label", T(on ? "hxsFavDel" : "hxsFavAdd")); }
    else if (act === "det" && e) { SH.detail = b.dataset.key; SH.scroll = $("shHw").scrollTop; renderDetail(); $("shHw").scrollTop = 0; }
    else if (act === "back") { SH.detail = null; renderAll(); $("shHw").scrollTop = SH.scroll || 0; }
    else if (act === "tech" && e) openTech(e);
  }

  function focusables(root0) {
    return [].filter.call(root0.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'), function (n) { return n.offsetParent !== null || n === document.activeElement; });
  }
  function onKey(ev) {
    var sh = $("shHw"); if (!sh.classList.contains("on")) return;
    if (ev.key === "Escape" && SH && SH.detail) { ev.stopPropagation(); ev.preventDefault(); SH.detail = null; renderAll(); return; }
    if (ev.key === "Tab") {
      var f = focusables(sh); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && (document.activeElement === first || !sh.contains(document.activeElement))) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && (document.activeElement === last || !sh.contains(document.activeElement))) { ev.preventDefault(); first.focus(); }
      return;
    }
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      var mains = [].slice.call(sh.querySelectorAll(".hxc-main")), a = document.activeElement, i = mains.indexOf(a);
      if (a && a.id === "hxsQ" && ev.key === "ArrowDown" && mains.length) { ev.preventDefault(); mains[0].focus(); }
      else if (i >= 0) { ev.preventDefault(); if (ev.key === "ArrowDown" && i < mains.length - 1) mains[i + 1].focus(); else if (ev.key === "ArrowUp") { if (i > 0) mains[i - 1].focus(); else $("hxsQ").focus(); } }
    }
  }

  /* ------------------------------------------------------------------ init */
  function init() {
    if (inited || !$("hwPanel") || !$("shHw") || !root.EBHwIndex || !root.EBHwFit) return false;
    var offIds = ["rowLift", "rowLiftElec", "rowCU", "rowCUSize", "rowCUHand", "rowSlide", "hwSelBox"];
    offIds.forEach(function (id) { var n = $(id); if (n) n.classList.add("hwui-off"); });
    ["bDrawSys", "bLed"].forEach(function (id) { var n = $(id), p = n && n.closest(".f"); if (p) p.classList.add("hwui-off"); });
    var oldHint = document.querySelector('#grpHw [data-i="hwSelHint"]'); if (oldHint) oldHint.classList.add("hwui-off");   // textul vechi despre «un selector pe categorie»
    /* câmpurile ascunse nu mai sunt în ordinea tastaturii */
    var noTab = function () { document.querySelectorAll(".hwui-off select,.hwui-off input,.hwui-off button").forEach(function (n) { n.setAttribute("tabindex", "-1"); }); };
    noTab(); try { new MutationObserver(noTab).observe($("hwSelBox"), { childList: true }); } catch (e) { /* */ }
    document.querySelectorAll(".hwui-off").forEach(function (n) { n.setAttribute("aria-hidden", "true"); });
    document.documentElement.classList.add("hwui-on");

    $("hwPanel").addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-hwp-change]");
      if (b) { open(b.getAttribute("data-hwp-change")); return; }
      if (ev.target.closest("#hwpWarnBtn")) { warnOpen = !warnOpen; lastHtml = ""; refresh(lastCfg, lastBuilt); var w = $("hwpWarnBtn"); if (w) w.focus(); }
    });
    $("hwPanel").addEventListener("change", function (ev) { var s = ev.target.closest("[data-hwp-sub]"); if (s) subWrite(s.getAttribute("data-hwp-sub"), s.value); });
    $("hxsBody").addEventListener("click", onListClick);
    $("shHw").addEventListener("keydown", onKey);
    try { new MutationObserver(function () { if (SH && !$("shHw").classList.contains("on")) onClosed(); }).observe($("shHw"), { attributes: true, attributeFilter: ["class"] }); } catch (e) { /* */ }
    var g = $("grpHw"); if (g) g.addEventListener("toggle", function () { if (g.open) refresh(); });
    inited = true;
    return true;
  }

  api.init = init; api.refresh = refresh; api.relabel = relabel; api.open = open;
  api._state = function () { return SH; };
  api._readTarget = readTarget;
  return api;
});
