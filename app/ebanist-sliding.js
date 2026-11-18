/* Ebanist — U.17: sisteme glisante, escamotabile (pocket) și cu aripă (wing). PUR: fără DOM, fără stare.
 *
 * Datele vin din EBSlidingData (ebanist-sliding-data.js, generat din documente oficiale Hettich / Hawa / Blum / Häfele; ce nu e citit = null).
 * Nimic de aici nu e „verificat”: formulele producătorilor se aplică așa cum sunt publicate; ce producătorul nu publică (ex. Hettich: lățimea
 * și suprapunerea ușilor) rămâne la regula generică a aplicației, cu avertisment. Găurile NU se generează (cotele din desene nu au reper sigur).
 *
 *   EBSliding.list() / .get(key) / .typeOk(sys, type) / .leavesFor(sys, n)
 *   EBSliding.planSlide(sys, c)   uși glisante pe șină (corpul „scorrevole”)  → lățime, suprapunere, înălțime, poziții, lungimea șinei, BOM
 *   EBSliding.planPocket(sys, c)  uși escamotabile (corp standard)             → lățimi, adâncime minimă, retragere, BOM
 *   EBSliding.planWing(sys, c)    foi pliante pe șină / escamotabile pliante   → verificări pe foaie, balamale centrale, BOM
 *   EBSliding.limitIssues(sys, d) d = { kg, h, w, th, n }  →  [{ k, v, lo, hi }]
 *   EBSliding.catalogEntries(skipIds) articolele de catalog (câte unul pe cod, nume în 7 limbi)
 *   EBSliding.noteText(w, t)      avertisment → text (t = funcția de traducere din aplicație)
 * c (contextul) — vezi comentariul fiecărui plan. Toate cotele în mm, greutăți în kg.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.EBSliding = factory(root);
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";
  var LANGS = ["it", "ro", "en", "fr", "de", "pl", "es"];
  function data() { return root.EBSlidingData || { systems: [], codes: [] }; }
  function systems() { return data().systems; }
  function list() { return systems().slice(); }
  var _by = null, _codes = null;
  function get(key) {
    if (!key) return null;
    if (!_by || _by.n !== systems().length) { _by = { n: systems().length, m: {} }; systems().forEach(function (s) { _by.m[s.key] = s; }); }
    return _by.m[key] || null;
  }
  function codeOf(code) {
    if (!_codes || _codes.n !== data().codes.length) { _codes = { n: data().codes.length, m: {} }; data().codes.forEach(function (c) { _codes.m[c.code] = c; }); }
    return _codes.m[code] || null;
  }
  function san(code) { return String(code).toLowerCase().replace(/[^a-z0-9]+/g, ""); }
  function codeId(code) { return "sl_" + san(code); }
  var TYPE = { slide: "scorrevole", pocket: "standard", wing: "standard" };
  function typeOk(sys, type) { return !!sys && TYPE[sys.kind] === type; }
  function rnd1(v) { return Math.round(v * 10) / 10; }
  function doorKg(h, w, th, dens) { return (+h > 0 && +w > 0 && +th > 0 && +dens > 0) ? h * w * th * dens / 1e9 : 0; }
  function leavesFor(sys, n) {
    var L = sys && sys.leaves, m = Math.round(+n) || 0;
    if (!L) return m;
    return Math.max(L[0], Math.min(L[1], m));
  }
  /* foi pe pachet la sistemele „wing”: fix când intervalul e un punct, altfel alegerea din construcție (cfg.fold) în interval */
  function wingLeaves(sys, fold) {
    var L = sys.leaves || [2, 2]; if (L[0] === L[1]) return L[0];
    var f = Math.round(+fold) || 0; return f >= L[0] && f <= L[1] ? f : L[0];
  }

  /* ---------------------------------------------------------------- limite */
  function limitIssues(sys, d) {
    var L = (sys && sys.lim) || {}, out = [];
    function chk(k, v, lo, hi) { if (v > 0 && ((lo != null && v < lo - 1e-9) || (hi != null && v > hi + 1e-9))) out.push({ k: k, v: rnd1(v), lo: lo == null ? null : lo, hi: hi == null ? null : hi }); }
    var kgHi = L.kg ? L.kg[1] : null;
    if (L.kgTh && d.th > 0) {
      var rows = L.kgTh.filter(function (r) { return d.th >= r.th[0] && d.th <= r.th[1]; });
      if (rows.length) kgHi = Math.max.apply(null, rows.map(function (r) { return r.kg; }));
    }
    if (L.kg || kgHi != null) chk("kg", d.kg, L.kg ? L.kg[0] : null, kgHi);
    if (L.h) chk("h", d.h, L.h[0], L.h[1]);
    var wr = (L.wN && L.wN[String(d.n)]) || L.w; if (wr) chk("w", d.w, wr[0], wr[1]);
    if (L.th) chk("th", d.th, L.th[0], L.th[1]);
    if (L.hRatio && d.w > 0 && d.h > L.hRatio * d.w + 1e-9) out.push({ k: "ratio", v: rnd1(d.h / d.w), lo: null, hi: L.hRatio });
    return out;
  }

  /* ---------------------------------------------------------------- BOM */
  function inR(v, r) { return v != null && (r[0] == null || v >= r[0] - 1e-9) && (r[1] == null || v <= r[1] + 1e-9); }
  function whenOk(w, x) {
    for (var k in w) {
      var v = w[k];
      if (k === "n") { if (v.indexOf(x.n) < 0) return false; }
      else if (k === "th") { if (!inR(x.th, v)) return false; }
      else if (k === "thMin") { if (!(x.th >= v)) return false; }
      else if (k === "kgMax") { if (!(x.kg <= v + 1e-9)) return false; }
      else if (k === "side") { if ((x.side || "L") !== v) return false; }
      else if (k === "sth") { if (v.indexOf(x.sth) < 0) return false; }
      else if (k === "wMin") { if (!(x.w >= v)) return false; }
      else if (k === "plinth") { if (!!x.plinth !== v) return false; }
      else if (k === "lenUp") { if (!(x.len <= v + 1e-9)) return false; }
      else if (k === "nlUp") { if (!(x.nl <= v + 1e-9)) return false; }
      else if (k === "lwaUp") { if (!(x.lwa <= v + 1e-9)) return false; }
      else if (k === "wUp") { if (!(x.wv <= v + 1e-9)) return false; }
      else if (k === "cabWUp") { if (!(x.cabW <= v + 1e-9)) return false; }
      else if (k === "pohFrom") { if (!(x.poh >= v)) return false; }
      else if (k === "doorW") { if (!(x.w <= v + 1e-9)) return false; }
      else if (k === "soft") { if (!!x.soft !== v) return false; }
      else if (k === "mount") { if (x.mount !== v) return false; }
      else if (k === "worktop") { if (!!x.worktop !== v) return false; }
      else if (k === "guideLen") { if (x.guideLen !== v) return false; }
    }
    return true;
  }
  function pickOpt(line, x) {
    var ok = line.opts.filter(function (o) { return whenOk(o.when || {}, x); });
    if (!ok.length) return null;
    var hasFrom = ok.some(function (o) { return o.when && o.when.pohFrom != null; });
    if (hasFrom) return ok.reduce(function (b, o) { return (o.when.pohFrom || 0) > (b.when.pohFrom || 0) ? o : b; });
    return ok[0];
  }
  function qtyOf(q, x, doors) {
    if (typeof q === "number") return q;
    if (q.per === "door") return (doors != null ? doors : x.n) * (q.x || 1);
    if (q.per === "pack") return x.packs != null ? x.packs : x.n;
    if (q.len) return Math.max(1, Math.ceil((x.len || 0) / q.len - 1e-9));
    return 1;
  }
  /* x: valorile cu care se aleg codurile; sides: laturile fiecărei uși (liniile „per door” se evaluează pe latură) */
  function evalBom(sys, x, sides) {
    var out = {}, order = [], issues = [];
    function put(code, qty, line) {
      if (!(qty > 0)) return;
      if (!out[code]) { out[code] = { id: codeId(code), code: code, qty: 0, chk: !!line.chk || !!(codeOf(code) || {}).chk, label: line.label || "" }; order.push(code); }
      out[code].qty += qty;
    }
    (sys.bom || []).forEach(function (line) {
      if (line.opt) return;
      var perDoor = typeof line.q === "object" && line.q.per === "door" && sides && sides.length;
      var runs = perDoor ? sides : [x.side || "L"];
      runs.forEach(function (sd, i) {
        var xx = Object.assign({}, x, { side: sd });
        var o = pickOpt(line, xx);
        if (!o) {
          /* tăiat la lungime: peste cea mai mare lungime standard se iau mai multe bucăți */
          var lu = line.opts.filter(function (p) { return p.when && p.when.lenUp != null; });
          if (lu.length && x.len > 0) { var last = lu[lu.length - 1]; put(last.code, Math.max(1, Math.ceil(x.len / last.when.lenUp - 1e-9)), line); return; }
          if (!issues.some(function (s) { return s.label === line.label; })) issues.push({ k: "nocode", label: line.label || "" });
          return;
        }
        var q = perDoor ? (line.q.x || 1) : qtyOf(line.q, xx, sides && sides.length ? sides.length : null);
        put(o.code, q, line);
      });
    });
    var lines = order.map(function (c) { return out[c]; });
    lines.forEach(function (l) { if (l.chk && !issues.some(function (s) { return s.k === "chk" && s.label === l.label; })) issues.push({ k: "chk", label: l.label }); });
    return { lines: lines, issues: issues };
  }
  function bomIssuesToWarn(sys, issues, warn) {
    issues.forEach(function (i) { warn.push({ k: i.k, sys: sys.name, what: i.label }); });
  }

  /* ---------------------------------------------------------------- uși glisante pe șină
   * c = { n, L, H, Lint, P, tA, tSide, sth, frontX0, frontW, dens, ovGen, y0Gen, y1Gen, zEvenGen, zGapGen, side, plinth }
   *   ovGen = suprapunerea generică a aplicației (SLIDE_OVERLAP); y0Gen/y1Gen = limitele pe y ale ușii generice; zEvenGen = z al ușii pe șina de lângă corp
   * Întoarce { n, aW, ov, aH, y0, y1, xs[], zs[], trackLen, warn[], bom[], used } */
  function planSlide(sys, c) {
    var warn = [], n = Math.max(1, Math.round(+c.n) || 2), nn = leavesFor(sys, n);
    if (sys.leaves && nn !== n) warn.push({ k: "n", sys: sys.name, lo: sys.leaves[0], hi: sys.leaves[1], n: n, m: nn });
    n = nn;
    var aW, ov, x0 = c.frontX0, used = { formula: false }, dw = sys.dw, tot = dw && dw.tot ? dw.tot[String(n)] : null;
    if (dw && dw.tot && n > 1 && tot != null) {
      var base = dw.base === "KIM" ? c.Lint : c.frontW;
      aW = (base + tot) / n; ov = tot / (n - 1); used.formula = true;
      if (dw.base === "KIM") x0 = c.frontX0 + (c.frontW - c.Lint) / 2;
    } else if (dw && dw.lt != null && n > 1) {
      aW = (c.frontW + (n - 1) * dw.lt) / n; ov = dw.lt; used.formula = true;
    } else {
      ov = n > 1 ? c.ovGen : 0;
      /* ușile inset stau în deschidere, nu peste laterale: aceeași regulă generică, aplicată lățimii interioare */
      if (sys.mount === "inset") { aW = (c.Lint + (n - 1) * ov) / n; x0 = c.frontX0 + (c.frontW - c.Lint) / 2; }
      else aW = (c.frontW + (n - 1) * ov) / n;
      if (dw && dw.tot && n > 1) warn.push({ k: "noN", sys: sys.name, n: n });
      else if (n > 1 && !(sys.info || []).some(function (i) { return i.k === "limitsOnly"; })) warn.push({ k: "noFormula", sys: sys.name });
      if ((sys.info || []).some(function (i) { return i.k === "limitsOnly"; })) warn.push({ k: "only", sys: sys.name });
    }
    var cl = sys.clr, y0 = (cl && cl.bottom != null) ? cl.bottom : c.y0Gen, y1 = (cl && cl.top != null) ? c.H - cl.top : c.y1Gen;
    if (cl) warn.push({ k: "drawing", sys: sys.name, top: cl.top == null ? "—" : cl.top, bottom: cl.bottom == null ? "—" : cl.bottom });
    var aH = y1 - y0, gap = sys.tz != null ? sys.tz : c.zGapGen, xs = [], zs = [], tA = c.tA, inset = sys.mount === "inset";
    for (var i = 0; i < n; i++) {
      xs.push(x0 + i * (aW - ov));
      if (inset) zs.push(i % 2 === 0 ? c.P - 8 - 2 * tA - gap : c.P - 8 - tA);
      else zs.push(i % 2 === 0 ? c.zEvenGen : c.zEvenGen + tA + gap);
    }
    var kg = doorKg(aH, aW, tA, c.dens);
    var issues = limitIssues(sys, { kg: kg, h: aH, w: aW, th: tA, n: n });
    issues.forEach(function (s) { warn.push({ k: "range", sys: sys.name, what: s.k, v: s.v, lo: s.lo, hi: s.hi }); });
    var trackLen = rnd1(c.Lint), std = (sys.trk && sys.trk.std) || [], maxStd = std.length ? Math.max.apply(null, std) : 0;
    if (maxStd && trackLen > maxStd) warn.push({ k: "track", sys: sys.name, len: trackLen, std: maxStd });
    var B = evalBom(sys, { n: n, th: tA, kg: kg, side: c.side || "L", sth: c.sth, w: aW, h: aH, len: trackLen, plinth: c.plinth }, null);
    bomIssuesToWarn(sys, B.issues, warn);
    warn.push({ k: "unv", sys: sys.name });
    return { kind: "slide", n: n, aW: aW, ov: ov, aH: aH, y0: y0, y1: y1, xs: xs, zs: zs, x0: x0, trackLen: trackLen, kg: rnd1(kg), warn: warn, bom: B.lines, used: used, inset: inset, run: sys.run, mount: sys.mount };
  }

  /* ---------------------------------------------------------------- uși escamotabile
   * c = { n, L, H, P, Lint, Hint, Pint, tA, tSide, sth, yIntBot, gapSup, gapInf, reveal, gapAnte, sides[], dens, plinth }
   * Ușa escamotabilă intră în corp (în buzunar), deci stă ÎN deschidere (inset): lățimea din interior, înălțimea din înălțimea interioară minus jocurile aplicației,
   * fața la nivelul muchiei din față a corpului (z de la P − grosime la P). Formulele producătorilor înlocuiesc aceste valori numai unde sunt publicate.
   * Întoarce { n, ws[], xs[], aH, y0, z0, z1, open, issues, warn[], bom[], hingesN } */
  function planPocket(sys, c) {
    var warn = [], P = sys.plan || { type: "generic" }, n = Math.max(1, Math.round(+c.n) || 1), nn = leavesFor(sys, n);
    if (sys.leaves && nn !== n) warn.push({ k: "n", sys: sys.name, lo: sys.leaves[0], hi: sys.leaves[1], n: n, m: nn });
    n = nn;
    var sides = []; for (var i = 0; i < n; i++) sides.push((c.sides && c.sides[i]) || (i < n / 2 ? "L" : "R"));
    var tA = c.tA, ws = [], xs = [], open = { t: "none" }, hingesN = 0, extra = null;
    var gA = c.gapAnte != null ? c.gapAnte : 4, rv = c.reveal != null ? c.reveal : 3, gS = c.gapSup != null ? c.gapSup : 3, gI = c.gapInf != null ? c.gapInf : 3;
    var aWin = (c.Lint - 2 * rv - gA * (n - 1)) / n, xIn = []; for (var iw = 0; iw < n; iw++) xIn.push(c.tSide + rv + iw * (aWin + gA));
    var aH = c.Hint - gS - gI, y0 = c.yIntBot + gI, z0 = c.P - tA, z1 = c.P;
    var bx = { n: n, th: tA, side: sides[0], sth: c.sth, plinth: c.plinth, w: aWin, h: aH, packs: n, len: c.Lint }, kgPer, iss = [], trackLen = null;
    function addIss(k, v, lo, hi, what) { if (v > 0 && ((lo != null && v < lo - 1e-9) || (hi != null && v > hi + 1e-9))) iss.push({ k: k, v: rnd1(v), lo: lo == null ? null : lo, hi: hi == null ? null : hi, what: what || k }); }

    if (P.type === "revego") {
      var FD = tA, Fs = P.fsByFd[0][2];
      P.fsByFd.forEach(function (r) { if (FD >= r[0] - 1e-9 && FD <= r[1] + 1e-9) Fs = r[2]; });
      if (FD > P.fsByFd[P.fsByFd.length - 1][1]) Fs = P.fsByFd[P.fsByFd.length - 1][2];
      var EB = c.Lint, uno = P.kind === "uno", Fsm = P.fsmMin;
      var FB = uno ? EB - 2 * Fs : (EB - 2 * Fs - Fsm) / 2, LWA = EB - P.pob, ET = c.Pint, POT = ET - P.fsGap - FD;
      var NLmax = POT - P.potv - P.porw, NL = Math.min(NLmax, FB + P.nlMaxAdd);
      var nom = P.nl[P.nl.length - 1]; for (var q = 0; q < P.nl.length; q++) if (P.nl[q] >= NL - 1e-9) { nom = P.nl[q]; break; }
      var FU = Math.max(P.fuMin, FB - NL + P.fuAdd);
      for (var k = 0; k < n; k++) { ws.push(FB); xs.push(c.tSide + Fs + k * (FB + Fsm)); }
      kgPer = doorKg(aH, FB, tA, c.dens);
      addIss("eb", EB, P.eb[0], P.eb[1], "eb"); addIss("lwa", LWA, P.lwa[0], P.lwa[1], "lwa"); addIss("et", ET, P.etMin, null, "et");
      addIss("depth", POT, P.potMin, null, "depth"); addIss("fb", FB, sys.lim.w[0], sys.lim.w[1], "fb");
      addIss("h", aH, sys.lim.h[0], sys.lim.h[1], "h");
      open = { t: "pivot", E: rnd1(FB - FU), M: rnd1(FU), w: rnd1(FB), th: tA, stack: tA + P.fsGap, sides: sides.map(function () { return sides[0]; }) };
      sides = sides.map(function () { return sides[0]; });     /* ambele uși ale lui „duo” intră în același buzunar */
      bx.nl = NL; bx.lwa = LWA; bx.poh = Math.round(aH); bx.sth = c.sth; bx.side = sides[0];
      extra = { pob: P.pob, FB: rnd1(FB), Fs: Fs, LWA: rnd1(LWA), POT: rnd1(POT), NL: rnd1(NL), NLnom: nom, FU: rnd1(FU), ET: rnd1(ET) };
      if (!uno) trackLen = rnd1(LWA - P.trackSub);           /* șina duo: X = LWA − 12 (BLU-ORD p.77-80) */
      warn.push({ k: "interp", sys: sys.name }); warn.push({ k: "pocket", sys: sys.name, w: P.pob });
    } else if (P.type === "concepta3") {
      var TB = aWin, S = tA, Mmin = S + P.mAddS, Mmax = TB - P.mMaxSub, KT1 = c.Pint, Mneed = TB + P.hw + P.z3 - KT1, M = Math.max(Mmin, Mneed);
      if (M > Mmax + 1e-9) { iss.push({ k: "depth", v: rnd1(KT1), lo: rnd1(TB + P.hw + P.z3 - Mmax), hi: null, what: "depth" }); M = Mmax; }
      var T1 = TB + P.hw + P.z3 - M, E1 = TB - M;
      for (var k2 = 0; k2 < n; k2++) { ws.push(TB); xs.push(xIn[k2]); }
      kgPer = doorKg(aH, TB, tA, c.dens);
      open = { t: "pivot", E: rnd1(E1), M: rnd1(M), w: rnd1(TB), th: tA, stack: tA + 3, sides: sides };
      extra = { T1: rnd1(T1), E1: rnd1(E1), M: rnd1(M), Z3: P.z3 };
    } else if (P.type === "ka5740") {
      var B = c.Lint - P.dW, H = c.Hint - P.dH, Y = tA + P.yAdd, nlSel = P.nl[P.nl.length - 1], found = false;
      for (var q2 = 0; q2 < P.nl.length; q2++) if (P.nl[q2] >= B - 1e-9) { nlSel = P.nl[q2]; found = true; break; }
      var b1 = P.b1[String(nlSel)], b2 = P.b2[String(nlSel)], MKT = b1 + Y + P.zMin;
      ws.push(B); xs.push(c.tSide + P.dW / 2); aH = H; y0 = c.yIntBot + P.dH / 2; z1 = c.P - P.yAdd; z0 = z1 - tA;
      kgPer = doorKg(H, B, tA, c.dens);
      addIss("depth", c.Pint, MKT, null, "depth"); addIss("w", B, sys.lim.w[0], sys.lim.w[1], "lkb"); if (!found) iss.push({ k: "w", v: rnd1(B), lo: null, hi: P.nl[P.nl.length - 1], what: "lkb" });
      open = { t: "slide", dz: b2, w: rnd1(B), th: tA };
      bx.wv = B; extra = { B: rnd1(B), H: rnd1(H), Y: Y, B1: b1, B2: b2, MKT: MKT, nl: nlSel };
      sides = [sides[0]];
    } else if (P.type === "fpark") {
      var W = aWin, fit = null;
      P.guides.forEach(function (g) { if (g[0] <= c.Pint + 1e-9) fit = g; });
      ws.push(W); xs.push(xIn[0]);
      kgPer = doorKg(aH, W, tA, c.dens);
      if (fit) { bx.guideLen = fit[0]; bx.mount = "infront"; var ovl = W - fit[1] - tA;
        warn.push({ k: "overlay", sys: sys.name, v: rnd1(ovl) }); open = { t: "pivot", E: fit[1], M: rnd1(Math.max(0, W - fit[1])), w: rnd1(W), th: tA, stack: tA + 3, sides: sides };
        extra = { guideLen: fit[0], retract: fit[1], overlay: rnd1(ovl) }; }
      else { warn.push({ k: "noguide", sys: sys.name, v: rnd1(c.Pint), lo: P.guides[0][0] }); open = { t: "none" }; }
      var hr = null; P.hingesByH.forEach(function (r) { if (hr == null && aH <= r[0]) hr = r; }); hingesN = hr ? hr[1] + hr[2] : 0;
      sides = [sides[0]];
    } else {        /* generic: Concepta 40/50, Pocket Hideaway: numai limite */
      for (var k3 = 0; k3 < n; k3++) { ws.push(aWin); xs.push(xIn[k3]); }
      kgPer = doorKg(aH, aWin, tA, c.dens);
      open = P.straight ? { t: "straight", w: rnd1(aWin), th: tA, sides: sides } : { t: "none" };
      warn.push({ k: "only", sys: sys.name });
    }
    var d = { kg: kgPer, h: aH, w: ws[0] || aWin, th: tA, n: n };
    var skipK = P.type === "revego" ? ["w", "h"] : P.type === "ka5740" ? ["w"] : [];
    limitIssues(sys, d).forEach(function (s) { if (skipK.indexOf(s.k) < 0) iss.push({ k: s.k, v: s.v, lo: s.lo, hi: s.hi, what: s.k }); });
    iss.forEach(function (s) {
      if (s.k === "depth") warn.push({ k: "depth", sys: sys.name, v: s.v, lo: s.lo });
      else warn.push({ k: "range", sys: sys.name, what: s.what || s.k, v: s.v, lo: s.lo, hi: s.hi });
    });
    bx.kg = kgPer; bx.w = ws[0] || bx.w;
    var Bm = evalBom(sys, bx, sides.length === n ? sides : null);
    bomIssuesToWarn(sys, Bm.issues, warn);
    warn.push({ k: "unv", sys: sys.name }); if (open.t !== "none") warn.push({ k: "open", sys: sys.name });
    return { kind: "pocket", n: n, ws: ws, xs: xs, aH: aH, y0: y0, z0: z0, z1: z1, open: open, sides: sides, issues: iss, warn: warn, bom: Bm.lines, hingesN: hingesN, kg: rnd1(kgPer), extra: extra, type: P.type, trackLen: trackLen };
  }

  /* ---------------------------------------------------------------- foi pe șină (wing) / pocket pliant
   * c = { packs, leaves, leafW, leafH, tA, Pint, dens, side } → verificări pe foaie, balamale centrale, BOM */
  function planWing(sys, c) {
    var warn = [], P = sys.plan || {}, leaves = c.leaves, kg = doorKg(c.leafH, c.leafW, c.tA, c.dens), side = c.side || "L";
    var iss = limitIssues(sys, { kg: kg, h: c.leafH, w: c.leafW, th: c.tA, n: leaves });
    var hinges = null, extra = {};
    if (P.type === "wing") {
      var row = null; P.hingesByH.forEach(function (r) { if (!row && c.leafH <= r[0] + 1e-9 && kg <= r[1] + 1e-9) row = r; });
      hinges = row ? row[2] : null;
      if (hinges) warn.push({ k: "wing", sys: sys.name, n: hinges }); else warn.push({ k: "nohinges", sys: sys.name, h: Math.round(c.leafH), kg: rnd1(kg) });
    }
    if (P.type === "concepta3fold") {
      var TB = c.leafW, S = c.tA, M2min = S + P.m2AddS, M2max = TB - (leaves === 3 ? P.m3MaxSub : P.m2MaxSub), KT = c.Pint, M2 = Math.max(M2min, TB + P.hw + P.z3 - KT);
      if (M2 > M2max + 1e-9) { iss.push({ k: "depth", v: rnd1(KT), lo: rnd1(TB + P.hw + P.z3 - M2max), hi: null }); M2 = M2max; }
      extra = { T2: rnd1(TB + P.hw + P.z3 - M2), E2: rnd1(TB - M2), M2: rnd1(M2) };
    }
    iss.forEach(function (s) {
      if (s.k === "depth") warn.push({ k: "depth", sys: sys.name, v: s.v, lo: s.lo });
      else warn.push({ k: "range", sys: sys.name, what: s.k, v: s.v, lo: s.lo, hi: s.hi });
    });
    if ((sys.info || []).some(function (i) { return i.k === "limitsOnly"; })) warn.push({ k: "only", sys: sys.name });
    var x = { n: leaves, th: c.tA, kg: kg, side: side, w: c.leafW, h: c.leafH, packs: c.packs, len: c.Lint };
    var sides = []; for (var i = 0; i < c.packs; i++) sides.push((c.sides && c.sides[i]) || side);
    var B = evalBom(sys, x, sides);
    var lines = B.lines.slice();
    if (hinges) {                 /* balamale centrale: seturile din catalog (2 sau 3 balamale), combinate pentru 4 și 5 */
      var combos = { 2: [["9 278 694", 1]], 3: [["9 278 742", 1]], 4: [["9 278 694", 2]], 5: [["9 278 694", 1], ["9 278 742", 1]] }[hinges] || [];
      combos.forEach(function (cb) { lines.push({ id: codeId(cb[0]), code: cb[0], qty: cb[1] * c.packs, chk: hinges >= 4, label: "hinge" }); });
      if (hinges >= 4) B.issues.push({ k: "chk", label: "hinge" });
    }
    bomIssuesToWarn(sys, B.issues, warn);
    warn.push({ k: "unv", sys: sys.name }); warn.push({ k: "open", sys: sys.name });
    return { kind: "wing", kg: rnd1(kg), warn: warn, bom: lines, hinges: hinges, extra: extra, leaves: leaves, issues: iss };
  }

  /* ---------------------------------------------------------------- catalog (nume în 7 limbi, compuse din rol + parametri) */
  var ROLE_KEY = {
    setRun: "set", setTop: "set", setCombIS: "set", setCombMS: "set", setCombFS: "set", setCombFSul: "set", setCombL: "set", fitSet: "set", set40: "set", set50: "set", frontinoSet: "set",
    runWing: "runWing", trackSetFlush: "flush", doorSetPair: "pocketSet", basicSet: "basic", slideInSet: "slideIn", foldSet: "foldSet",
    silent: "silent", softClose: "softClose", softCloseHawa: "softClose", softSelf: "softClose", setTopSilent: "softClose", runGearSoft: "softClose", stopperSoft: "softClose",
    softOpen: "softOpen", softColl: "softColl", adapterSoft: "adapter", housing: "adapter", stopperClip: "adapter",
    profileSet: "trackSet", profile1: "track", profile2: "track", profilePlastic: "track", profileAlu: "track", runnerProfile: "track", trackSingle: "track", trackDouble: "track",
    trackCombIS: "track", trackCombMS: "track", trackTopGroove: "track", trackTopScrew: "track", trackTopSingle: "track", trackBottomPress: "track", runGuideTrack: "track",
    runGuideTrack18: "track", runDouble18: "track", trackDuo: "track",
    guideProfile: "guideTrack", guideTrackPlastic: "guideTrack", guideTop: "guideTrack", guideBottom: "guideTrack", guideBottomDouble: "guideTrack", guideDouble18: "guideTrack", guideSetSTB: "guideTrack", guideExtra: "guideTrack",
    clipPanel: "clipPanel", coverProfile: "cover", tape: "tape", tapeAdh: "tape", adjust: "adjust", adjustThin: "adjust", thinDoor: "thinDoor", screwSet: "screws", screwsSys: "screws", screwsChip: "screws",
    runComp: "runComp", guideComp: "guideComp", clipComp: "clipComp", stopNails: "stopNails", stayClosed: "stayClosed", stayClosedMech: "stayClosed", stayClosedMagD: "stayClosed", stayClosedMagS: "stayClosed",
    activator: "activator", doorStop: "doorStop", mountClip: "mountClip", hingeSetWing: "hingeSet", damper: "damper", stayOpen: "stayOpen", protClip: "protClip", pullMove: "pull", pushMove: "push",
    centering: "centering", centreDoorFS: "centering", centreDoorFSol: "centering", accSet: "acc", guideInset: "guideInset", connector55: "conn", connector110: "conn", pocketConn: "conn", pocketConnRear: "conn",
    trackSetCab: "trackSetCab", trackSetFront: "trackSetFront", upright: "upright", uprightSet: "upright", stopSet3: "stopSet", pocketProf: "pocketProf", hingeBracket: "bracket", assemblySet: "assembly",
    parkGuide: "parkGuide", doorFixPark: "doorFix", frameAdaptor: "frame", jointSet: "joint", cavitySet: "cavity"
  };
  function D(lang) { var I = root.SLIDE_I18N || {}; return I[lang] || I.it || {}; }
  function rng(r, d) { if (r == null) return ""; if (typeof r === "number") return String(r); if (r[0] == null) return "≤ " + r[1]; if (r[1] == null) return "≥ " + r[0]; return r[0] === r[1] ? String(r[0]) : r[0] + "–" + r[1]; }
  function paramText(p, lang) {
    var d = D(lang), out = [];
    function w(k) { return d["slw_" + k] || k; }
    if (p.n != null) out.push(p.n + " " + w("doors"));
    if (p.th != null) out.push(rng(p.th) + " mm");
    if (p.kg != null) out.push(rng(p.kg) + " kg");
    if (p.hr) out.push(w("h") + " " + rng(p.hr) + " mm");
    if (p.len) out.push("L " + p.len + " mm");
    if (p.nl) out.push("NL " + p.nl);
    if (p.kind) out.push(w(p.kind));
    if (p.poh) out.push(w("h") + " " + p.poh);
    if (p.lwa) out.push("LWA ≤ " + p.lwa);
    if (p.wMax) out.push("≤ " + p.wMax + " mm");
    if (p.doorW) out.push("≤ " + p.doorW + " mm");
    if (p.guideLen) out.push(w("guideLen") + " " + p.guideLen + " · " + w("retract") + " " + p.retract);
    if (p.cabW) out.push(rng(p.cabW) + " mm");
    if (p.sd) out.push(rng(p.sd) + " mm");
    if (p.maxW) out.push("≤ " + p.maxW + " mm");
    if (p.mode) out.push(w(p.mode));
    if (p.pull) out.push(w("pull")); if (p.push) out.push(w("push"));
    if (p.duty) out.push(w(p.duty));
    if (p.hinges) out.push(p.hinges + " " + w("hinges"));
    if (p.fix) out.push(w(p.fix));
    if (p.screw) out.push(w("screw")); if (p.press) out.push(w("press"));
    if (p.col) out.push(w(p.col));
    if (p.side) out.push(p.side === "L" ? w("left") : w("right"));
    if (p.soft === true) out.push(w("soft")); if (p.soft === false) out.push(w("noSoft"));
    if (p.guide === true) out.push(w("guide")); if (p.guide === false) out.push(w("noGuide"));
    if (p.plinth === true) out.push(w("plinth")); if (p.plinth === false) out.push(w("noPlinth"));
    if (p.worktop) out.push(w("worktop"));
    if (p.mount === "infront" || p.mount === "vorfront") out.push(w(p.mount));
    if (p.size != null && p.size !== "") out.push(String(p.size));
    return out;
  }
  function nameOf(c, lang) {
    var d = D(lang), rk = ROLE_KEY[c.role] || "set", txt = d["slr_" + rk] || c.role, ps = paramText(c.p || {}, lang);
    var sy = (c.sys || []); var pre = sy.length && sy.length <= 3 ? sy.join(" / ") + " — " : "";
    return pre + txt + (ps.length ? " (" + ps.join(", ") + ")" : "");
  }
  function catalogEntries(skip) {
    var seen = {}; (skip || []).forEach(function (i) { seen[i] = 1; });
    var out = [];
    data().codes.forEach(function (c) {
      var id = codeId(c.code); if (seen[id]) return; seen[id] = 1;
      var n = {}; LANGS.forEach(function (L) { n[L] = nameOf(c, L); });
      var e = { id: id, brand: c.brand, n: n, art: c.code, price: 0, slide: 1 };
      if (c.chk) e.chk = 1;
      out.push(e);
    });
    return out;
  }

  /* ---------------------------------------------------------------- texte */
  function fmt(s, o) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return o[k] != null ? o[k] : ""; }); }
  function noteText(w, t) {
    var o = Object.assign({}, w); if (o.lo == null) o.lo = "—"; if (o.hi == null) o.hi = "—";
    var key = { n: "wSlideN", noFormula: "wSlideNoFormula", noN: "wSlideNoN", drawing: "wSlideDrawing", track: "wSlideTrack", nocode: "wSlideNoCode", chk: "wSlideChk", depth: "wSlideDepth",
      pocket: "wSlidePocket", unv: "wSlideUnv", only: "wSlideOnly", front: "wSlideFront", interp: "wSlideInterp", wing: "wSlideWing", nohinges: "wSlideNoHinges", overlay: "wSlideOverlay",
      noguide: "wSlideNoGuide", open: "wSlideOpen", range: "wSlideRange" }[w.k];
    if (!key) return "";
    if (w.k === "range") o.what = fmt(t("slWhat_" + w.what), { k: w.hi });
    if (w.k === "nocode" || w.k === "chk") o.what = w.what;
    return fmt(t(key), o);
  }
  function limitsText(sys, t) {
    var L = sys.lim || {}, wr = L.w;
    return fmt(t("slLimits"), { kg: rng(L.kg) || "—", h: rng(L.h) || "—", w: rng(wr) || "—", th: rng(L.th) || "—" });
  }
  return { list: list, get: get, codeOf: codeOf, codeId: codeId, typeOk: typeOk, leavesFor: leavesFor, wingLeaves: wingLeaves, doorKg: doorKg, limitIssues: limitIssues,
    planSlide: planSlide, planPocket: planPocket, planWing: planWing, evalBom: evalBom, catalogEntries: catalogEntries, nameOf: nameOf, paramText: paramText, noteText: noteText, limitsText: limitsText, ROLE_KEY: ROLE_KEY, rng: rng };
});
