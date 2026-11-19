/* Ebanist — FAZA H (H.2): potrivirea feroneriei cu corpul curent. PUR: fără DOM, fără stare; nu citește decât ce primește.
 *
 * Specificația: ebanist-hq/01-arhitectura/Ebanist-Feronerie-Selector-v1.md (§3 `fits`, §5.2 «Recomandate / Potrivite / Nu se potrivesc»).
 * NU inventează nicio limită și nicio regulă de compatibilitate: fiecare verificare e a modulului familiei, apelat cu aceleași mărimi pe care
 * le primește Constructorul, deci întoarce aceleași încălcări ca avertismentele lui (testele de paritate: test/hwfit.test.js).
 *
 *   EBHwFit.ctxOf(cfg, built, env)  → contextul corpului (mărimi din built.pieces/boxes/fx, G, materiale); env = { matById, structTh, drawSys, guidaIdFor, trial }
 *   EBHwFit.check(entry, ctx)       → { ok: true|false|null, why: [{k, v, lo, hi, …}], rank, unknownLimits, fam }
 *   EBHwFit.section(result)         → "recomandat" | "potrivit" | "nu_se_potriveste"
 *   EBHwFit.msg(why, t)             → texte (în limba lui t) pentru fiecare încălcare
 *
 * ok = true   trece toate verificările care au date (și cel puțin una a avut date)
 * ok = false  o limită citită din datele producătorului e încălcată (`why` le spune pe toate: mărimea, valoarea, limita)
 * ok = null   nicio limită din date nu se aplică (sau toate sunt null) = «necunoscut»; NICIODATĂ potrivit
 * unknownLimits = true când unele dintre limitele de care are nevoie verificarea sunt null în date (articolul nu devine «Recomandat»)
 * rank        ordinea în secțiune (mai mic = mai bun): cea mai mică rezervă suficientă (nu cel mai supradimensionat)
 *
 * Familii (categoria articolului → modulul care hotărăște):
 *   cern (balamale Hettich/Salice/Grass/Häfele/Blum 105°)  EBHingesMore.fit / .count        · lift  EBLiftFit.fit
 *   corner                                                    EBCornerFit.fit (+ EBCorner.interior, .supported)
 *   push / pushd / susp / suprail / conn                      EBOpen.doorCheck / drawerCheck / suspCheck / railCap / connCheck
 *   zarga / guida (sertare din date)                          EBDrawersMore.drawsys / dims / runner / heightOk
 *   slide (uși glisante / escamotabile / cu aripă)            EBSliding.typeOk, apoi planul sistemului prin env.trial (aceeași construcție ca Constructorul)
 *   slidesys / drawsys (H.3: selectorul alege sistemul din formular)  același rezultat, pe cheia sistemului (cfg.slide) / pe lateralul din date al sistemului de sertar
 * Orice altă categorie (sau articol fără limite în date) → ok:null.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.EBHwFit = factory(root);
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  var SECTIONS = ["recomandat", "potrivit", "nu_se_potriveste"];
  function R(name) { return root[name] || null; }
  function r1(v) { return Math.round(v * 10) / 10; }
  function known(a) { return Array.isArray(a) && (a[0] != null || a[1] != null); }       // un interval cu cel puțin un capăt citit
  function num(v) { return typeof v === "number" && isFinite(v); }

  /* densitatea frontului / corpului: regula aplicației (ebanist-advice.js, pe familie de material; 700 când familia nu are una — ca în Constructor) */
  function densOf(label) {
    var AD = R("EBAdvice"); if (!AD) return null;
    return (AD.DATA.density[AD.famOf(label)]) || 700;
  }

  /* ===================================================================== contextul */
  function ctxOf(cfg, built, env) {
    cfg = cfg || {}; env = env || {};
    var fx = (built && built.fx) || null, G = (fx && fx.G) || env.G || null;
    var pieces = (built && built.pieces) || [], boxes = (built && built.boxes) || [];
    var mat = function (id) { return env.matById && cfg[id] ? env.matById(cfg[id]) : null; };
    var mF = mat("matFront"), mB = mat("matBody"), mK = mat("matBack");
    var dF = densOf(mF && mF.label), dB = densOf(mB && mB.label);
    var sideT = env.structTh ? env.structTh(cfg) : (G ? G.sp_fianco : null);
    var ctx = { cfg: cfg, fx: !!fx, type: cfg.type || "standard", hung: cfg.support === "sospeso", sideT: sideT > 0 ? sideT : null, backT: mK && +mK.th > 0 ? +mK.th : null,
                densFront: dF, densBody: dB, env: env, _memo: {} };
    ctx.int = (G && G.L_int > 0) ? { w: G.L_int, h: G.H_int, d: G.P_int } : null;
    /* ușile (rândurile «Anta…», ca la openWarnOf și la ops): h/w după rând (lung = înălțimea, larg = lățimea), hm/wm după max/min (convenția EBOpen) */
    ctx.doors = pieces.filter(function (x) { return x.role === "frontale" && /^anta(?! (scorrevole|pieghevol))/i.test(x.elemento); }).map(function (x) {
      var th = x.sp || sideT || 0;
      return { h: x.lung, w: x.larg, hm: Math.max(x.lung, x.larg), wm: Math.min(x.lung, x.larg), th: th, kg: dF ? x.lung * x.larg * th * dF / 1e9 : 0, pz: x.pz };
    });
    ctx.door = ctx.doors[0] || null;
    var kg = 0; if (dB) pieces.forEach(function (x) { if (x.sp > 0 && x.role !== "accessorio") kg += x.lung * x.larg * x.pz * x.sp * dB / 1e9; });
    ctx.bodyKg = kg;
    /* sertare: planul unui grup (primul ok) și sistemul, ca la openWarnOf */
    var pl = null, plH = null;
    ((built && built.draws) || []).forEach(function (d) {
      if (!pl && d.plan && d.plan.ok && d.plan.nl > 0) pl = d.plan;
      if (!plH && d.plan && d.plan.minH != null) plH = d.plan;      // înălțimile frontului există și când planul nu iese pe alt motiv (ex. sertar din lemn prea scund)
    });
    var ds = env.drawSys ? env.drawSys(cfg.drawerSys || "legno") : null;
    ctx.drawSys = ds;
    ctx.drawers = (ds || pl) ? { n: pieces.filter(function (x) { return x.role === "cassetto_frontale"; }).reduce(function (a, x) { return a + x.pz; }, 0), nl: pl ? pl.nl : 0, lw: pl && pl.clear ? pl.clear : 0,
      sys: ds ? (ds.metal ? cfg.drawerSys : (env.guidaIdFor && env.guidaIdFor(cfg) === "blum_movento" ? "movento" : "legno")) : null, plan: pl } : null;
    ctx.dfx = fx ? { depth: fx.depth, secW: fx.secW, t: fx.tBox, inner: !!fx.inner, minH: plH ? plH.minH : null, availTop: plH && plH.availTop != null ? plH.availTop : null, N: (cfg.drawers | 0) } : null;
    /* colț: interiorul din cutii (EBCorner.interior), ca în EBCorner.apply */
    var C = R("EBCorner"), CF = R("EBCornerFit"), I = C && boxes.length ? C.interior(boxes) : null;
    ctx.corner = (I && CF) ? { supported: C.supported(cfg), d: { L: +cfg.L, H: +cfg.H, P: +cfg.P, wi: I.ix1 - I.ix0, hi: I.iy1 - I.iy0, depth: I.iz1 - I.iz0, body: CF.bodyOf(cfg), doorKg: ctx.door && ctx.door.kg > 0 ? ctx.door.kg : null } } : null;
    var LF = R("EBLiftFit");
    ctx.lift = (typeof cfg.lift === "string" && cfg.lift && LF && LF.get(cfg.lift)) ? cfg.lift : null;
    ctx.liftBlock = (cfg.front === "vetro" || cfg.front === "curvo" || (+cfg.fold >= 2 && +cfg.fold <= 4) || !!cfg.topProfile) ? true : false;
    return ctx;
  }

  /* ===================================================================== rezultatul */
  function newRes() { return { viol: [], checks: 0, unknown: false, rank: 0, fam: "" }; }
  function push(res, why) {
    var key = why.k + "|" + (why.what || ""), i;
    for (i = 0; i < res.viol.length; i++) if (res.viol[i].k + "|" + (res.viol[i].what || "") === key) { if (Math.abs(why.v) > Math.abs(res.viol[i].v)) res.viol[i] = why; return; }
    res.viol.push(why);
  }
  function finish(res) {
    var ok = res.viol.length ? false : (res.checks > 0 ? true : null);
    return { ok: ok, why: res.viol, rank: res.rank, unknownLimits: ok !== false && (ok === null ? true : !!res.unknown), fam: res.fam };
  }
  function nodata(fam) { var r = newRes(); r.fam = fam || ""; r.unknown = true; return finish(r); }

  /* ===================================================================== balamale */
  function checkHinge(e, ctx) {
    var HM = R("EBHingesMore"), res = newRes(); res.fam = "hinge";
    if (!HM || !HM.isMore(e.id) || !ctx.fx || !ctx.doors.length) return nodata("hinge");
    var f = HM.familyOfHw(e.id), nHing = 0;
    ctx.doors.forEach(function (d) {
      HM.fit(e.id, { th: d.th, h: d.h, w: d.w, kg: d.kg }).forEach(function (w) { push(res, { k: w.k, v: w.v, lo: w.lo == null ? null : w.lo, hi: w.hi == null ? null : w.hi, n: w.n }); });
      var n = HM.count(e.id, d.h, d.kg); if (n != null && n > nHing) nHing = n;
    });
    var T = f.doorTh || [null, null], hasRows = HM.count(e.id, ctx.door.h, ctx.door.kg) != null;
    if (known(T)) res.checks++; else res.unknown = true;
    if (hasRows || f.airMax) res.checks++; else res.unknown = true;
    res.rank = nHing;
    return finish(res);
  }

  /* ===================================================================== mecanisme de ridicare */
  function checkLift(e, ctx) {
    var LF = R("EBLiftFit"), res = newRes(); res.fam = "lift";
    var sys = LF && LF.get(e.id);
    if (!sys || !ctx.fx || !ctx.int) return nodata("lift");
    if (ctx.liftBlock && +ctx.cfg.doors > 0) { push(res, { k: "front", v: 0 }); res.checks++; return finish(res); }   // sticlă / curb / pliant / pantă: ușa rămâne pe balamale (liftWarn front)
    if (!ctx.door) return nodata("lift");
    var d = { kh: ctx.int.h, h: ctx.door.h, w: ctx.door.w, kg: ctx.door.kg, wi: ctx.int.w, depth: ctx.int.d, servo: ctx.cfg.liftElec === "servo" && !!sys.servo };
    var ft = LF.fit(sys, d);
    ft.issues.forEach(function (i) { push(res, { k: i.k, v: i.v, lo: i.lo, hi: i.hi }); });
    if (!ft.power) push(res, { k: "power", v: Math.round(d.kg * 10) / 10, h: Math.round(d.h) });
    var L = sys.limits || {};
    [L.cabH, L.cabW, L.kg].forEach(function (a) { if (known(a)) res.checks++; else res.unknown = true; });
    var dmin = d.servo && sys.servo && sys.servo.depthMin != null ? sys.servo.depthMin : L.depthMin;
    if (dmin != null) res.checks++; else res.unknown = true;
    if (L.hiMin != null) res.checks++; if (L.wiMin != null) res.checks++;
    if (ft.power) res.checks++;
    res.rank = (L.kg && L.kg[1] != null) ? Math.max(0, r1(L.kg[1] - d.kg)) : 500;     // cea mai mică rezervă de greutate = cel mai puțin supradimensionat
    return finish(res);
  }

  /* ===================================================================== colț / extractibile */
  function checkCorner(e, ctx) {
    var CF = R("EBCornerFit"), res = newRes(); res.fam = "corner";
    var u = CF && CF.get(e.id);
    if (!u || !ctx.corner) return nodata("corner");
    if (!ctx.corner.supported) { push(res, { k: "unsupported", v: 0 }); res.checks++; return finish(res); }
    var ft = CF.fit(u, ctx.corner.d, {});
    ft.issues.forEach(function (i) { push(res, { k: i.k, v: i.v, lo: i.lo, hi: i.hi, axis: i.axis, want: i.want, have: i.have, rec: i.rec, what: i.axis }); });
    var sz = ft.size || {}, lim = u.limits || {};
    var W = (sz.wi || lim.wi) ? 1 : (sz.cab != null || lim.cab ? 1 : 0), H = (sz.hi || lim.hi || (u.bands && u.bands.length)) ? 1 : 0, D = (sz.depth != null || lim.depth != null) ? 1 : 0;
    res.checks += W + H + D + (u.body !== "any" ? 1 : 0);
    if (!(W && H && D)) res.unknown = true;
    res.rank = 0;
    return finish(res);
  }

  /* ===================================================================== deschidere push / sertare push / suspendare / șine / îmbinări */
  function openItem(e) { var O = R("EBOpen"); return O ? O.get(e.id) : null; }
  function mapOpen(res, i) {
    if (i.k === "noKg") { res.unknown = true; return; }
    if (i.k === "noHandle" || i.k === "gapMin" || i.k === "suspRails") return;       // indicații, nu limite
    var why = { k: i.k, v: i.v, lo: i.lo, hi: i.hi };
    if (i.k === "range") { why.k = i.what; why.q = "open"; }
    else if (i.k === "load") { why.v = i.kg; why.hi = i.cap; }
    else if (i.k === "rail") { why.v = i.kg; why.hi = i.cap; why.rail = i.rail; }
    else if (i.k === "sizes") { why.v = i.kg; why.h = i.h; why.w = i.w; }
    else if (i.k === "extraCatch") { why.v = 0; why.hi = i.h; }
    else if (i.k === "pushdSys") { why.v = 0; why.have = i.have; why.want = i.want; }
    else if (i.k === "liftOnly" || i.k === "notLift") { why.v = 0; why.lifts = i.lifts; }
    else if (i.k === "notHung") { why.v = 0; }
    push(res, why);
  }
  function checkPush(e, ctx) {
    var O = R("EBOpen"), it = openItem(e), res = newRes(); res.fam = "push";
    if (!it || !ctx.fx || !ctx.doors.length || !ctx.int) return nodata("push");
    var seen = {};
    ctx.doors.forEach(function (d) {
      O.doorCheck(it, { h: d.hm, w: d.wm, kg: d.kg, kh: ctx.int.h, cabW: ctx.int.w, lift: ctx.lift }).forEach(function (i) { var k = JSON.stringify(i); if (!seen[k]) { seen[k] = 1; mapOpen(res, i); } });
    });
    var L = it.lim || {};
    if (it.lifts) res.checks++;
    ["h", "w", "kg", "kh", "cabW"].forEach(function (k) { if (known(L[k])) res.checks++; });
    if (L.sizes) res.checks++;
    if (!known(L.h) || !known(L.kg)) res.unknown = true;
    res.rank = (L.kg && L.kg[1] != null) ? Math.max(0, r1(L.kg[1] - ctx.door.kg)) : 500;
    return finish(res);
  }
  function checkPushd(e, ctx) {
    var O = R("EBOpen"), it = openItem(e), res = newRes(); res.fam = "pushd";
    if (!it || !ctx.fx || !ctx.drawers || !(ctx.drawers.n > 0)) return nodata("pushd");
    O.drawerCheck(it, ctx.drawers).forEach(function (i) { mapOpen(res, i); });
    var sys = ctx.drawers.sys, nlr = (it.sysNl && it.sysNl[sys]) || (it.lim && it.lim.nl) || null, lw = (it.sysLw && it.sysLw[sys]) || (it.lim && it.lim.lwMin);
    if (it.sys) res.checks++;
    if (known(nlr)) res.checks++; else res.unknown = true;
    if (lw) res.checks++; else res.unknown = true;
    res.rank = 0;
    return finish(res);
  }
  function checkSusp(e, ctx) {
    var O = R("EBOpen"), it = openItem(e), res = newRes(); res.fam = "susp";
    if (!it || !ctx.fx || !(ctx.bodyKg > 0)) return nodata("susp");
    var sel = ctx.cfg.hwSel || {}, rl = O.railFor(it, sel.suprail || null);
    var d = { kg: ctx.bodyKg + (+ctx.cfg.suspKg || 0), H: ctx.cfg.H, T: ctx.cfg.P, sideT: ctx.sideT, backT: ctx.backT, hung: ctx.hung };
    O.suspCheck(it, rl, d).forEach(function (i) { mapOpen(res, i); });
    var cap = O.suspCap(it, d);
    if (cap) { res.checks++; res.rank = Math.max(0, r1(cap.kg - d.kg)); } else { res.unknown = true; res.rank = 500; }
    if (it.sideT != null) res.checks++;
    if (it.backT || it.backTmin != null) res.checks++;
    res.checks++;      // «agățat» (hung) se verifică întotdeauna
    return finish(res);
  }
  function checkRail(e, ctx) {
    var O = R("EBOpen"), it = openItem(e), res = newRes(); res.fam = "suprail";
    if (!it || !ctx.fx || !(ctx.bodyKg > 0)) return nodata("suprail");
    var rc = O.railCap(it), kg = ctx.bodyKg + (+ctx.cfg.suspKg || 0);
    if (rc == null) { res.unknown = true; return finish(res); }
    res.checks++; res.rank = Math.max(0, r1(rc - kg));
    if (kg > rc) push(res, { k: "rail", v: r1(kg), hi: rc });
    return finish(res);
  }
  function checkConn(e, ctx) {
    var O = R("EBOpen"), it = openItem(e), res = newRes(); res.fam = "conn";
    if (!it || it._cat !== "conn" || !ctx.fx || !(ctx.sideT > 0)) return nodata("conn");
    O.connCheck(it, ctx.sideT).forEach(function (i) { mapOpen(res, i); });
    if (known(it.T)) { res.checks++; res.rank = Math.max(0, r1((it.T[1] != null ? it.T[1] : ctx.sideT) - ctx.sideT)); } else res.unknown = true;
    return finish(res);
  }

  /* ===================================================================== sertare (sisteme și glisiere din ebanist-drawers-more) */
  /* adâncimea utilă și lățimea liberă, ca în drawerPlan (pașii 3 și 4) */
  function drawSpace(ctx, rear) {
    var g = ctx.dfx; if (!g) return null;
    return { usable: g.depth - rear - (g.inner ? (+ctx.cfg.drawerInset || 35) : 0), clear: g.secW - (g.inner ? 8 : 0), t: g.t };
  }
  function checkDrawBox(e, ctx) {
    var DM = R("EBDrawersMore"), res = newRes(); res.fam = "zarga";
    if (!DM || !ctx.dfx) return nodata("zarga");
    var side = null, D = R("EBDrawersMoreData"); (D && D.sides || []).forEach(function (s) { if (s.key === e.id) side = s; });
    var box = side ? (D.boxes || []).filter(function (b) { return b.key === side.box; })[0] : null;
    var sys = box && box.selectable ? DM.drawsys()[box.key] : null;
    if (!sys || sys.rear == null) return nodata("zarga");
    var sp = drawSpace(ctx, sys.rear), nls = sys.nl.filter(function (x) { return x <= sp.usable; }), nl = nls.length ? nls[nls.length - 1] : 0;
    res.checks++;
    if (!nl) { push(res, { k: "depth", v: Math.round(sp.usable), lo: sys.nl[0] }); return finish(res); }
    var dm = DM.dims(sys.id, nl, sp.clear, sp.t); res.checks++;
    if (dm && dm.fail) push(res, { k: dm.fail.k === "wDrawMoreMinW" ? "minW" : "dims", v: dm.fail.have != null ? dm.fail.have : dm.fail.t, lo: dm.fail.min, hi: null, ok: dm.fail.ok });
    if (ctx.dfx.minH != null) {
      var codes = Object.keys(sys.hs), avail = Math.min(ctx.dfx.minH - sys.headroom, ctx.dfx.availTop == null ? Infinity : ctx.dfx.availTop);
      var any = codes.some(function (c) { return sys.hs[c] <= avail && DM.heightOk(sys, c, nl); });
      res.checks++;
      if (!any) push(res, { k: "drFront", v: Math.round(ctx.dfx.minH), lo: Math.ceil(sys.hs[codes[0]] + sys.headroom) });
    }
    res.rank = r1(sp.usable - nl);
    return finish(res);
  }
  function checkRunner(e, ctx) {
    var DM = R("EBDrawersMore"), res = newRes(); res.fam = "guida";
    var r = DM && DM.runner(e.id);
    var ds = ctx.drawSys;
    if (!r || !ctx.dfx || !ds || ds.metal || ds.none) return nodata("guida");       // glisiera contează la sertarul din lemn; la sisteme metalice o dă sistemul
    var pc = DM.planCtx(ds, ctx.cfg, ctx.dfx.t, e.id);
    if (!pc || pc.block) { res.unknown = true; return finish(res); }                // fără rezervă sau deducție în sursă: planul nu iese, nu se ghicește
    var sp = drawSpace(ctx, pc.rear), nls = (pc.nl || []).filter(function (x) { return x <= sp.usable; });
    res.checks++;
    if (!nls.length) push(res, { k: "depth", v: Math.round(sp.usable), lo: (pc.nl || [0])[0] });
    (pc.warn || []).forEach(function (w) { if (w.k === "wDrawMoreSideTh") push(res, { k: "sideTh", v: w.t, lo: null, hi: w.max }); });
    if (pc.maxSideTh) res.checks++;
    var ded = r.wood && r.wood.ded_lat;
    if (pc.minBoxW && ded != null) { res.checks++; var boxW = Math.round(sp.clear - ded); if (boxW < pc.minBoxW) push(res, { k: "minBox", v: boxW, lo: pc.minBoxW, hi: null }); }
    else res.unknown = true;
    res.rank = nls.length ? r1(sp.usable - nls[nls.length - 1]) : 0;
    return finish(res);
  }

  /* ===================================================================== uși glisante / escamotabile / cu aripă */
  var SLIDE_VIOL = { range: 1, depth: 1, n: 1, track: 1, nohinges: 1, front: 1 };
  var SLIDE_UNK = { noFormula: 1, noN: 1, only: 1, drawing: 1, interp: 1 };
  function slideSysResult(sys, ctx) {
    var S = R("EBSliding"), res = newRes(); res.fam = "slide";
    var memo = ctx._memo["sl:" + sys.key]; if (memo) return memo;
    var L = sys.lim || {};
    if (!S.typeOk(sys, ctx.type)) { push(res, { k: "type", v: 0, have: ctx.type, kind: sys.kind }); res.checks++; return (ctx._memo["sl:" + sys.key] = res); }
    if (!ctx.fx || !(+ctx.cfg.doors > 0) || !ctx.env.trial) { res.unknown = true; return (ctx._memo["sl:" + sys.key] = res); }
    var w = null; try { w = ctx.env.trial({ slide: sys.key }); } catch (err) { w = null; }
    var sw = w && w.slideWarn || [], planned = sw.some(function (x) { return x.k === "unv"; });
    if (!planned) { res.unknown = true; return (ctx._memo["sl:" + sys.key] = res); }
    sw.forEach(function (x) {
      if (SLIDE_VIOL[x.k]) push(res, { k: x.k === "range" ? x.what : x.k, v: x.v == null ? 0 : x.v, lo: x.lo == null ? null : x.lo, hi: x.hi == null ? null : x.hi, what: x.what, n: x.n, q: "slide" });
      else if (SLIDE_UNK[x.k]) res.unknown = true;
    });
    [L.kg || L.kgTh, L.h, L.w || L.wN, L.th].forEach(function (a) { if (a && (Array.isArray(a) ? known(a) : true)) res.checks++; else res.unknown = true; });
    res.rank = (L.kg && L.kg[1] != null && ctx.door) ? Math.max(0, r1(L.kg[1] - ctx.door.kg)) : 500;
    return (ctx._memo["sl:" + sys.key] = res);
  }
  function checkSlide(e, ctx) {
    var S = R("EBSliding"), D = R("EBSlidingData");
    if (!S || !D) return nodata("slide");
    var code = null; (D.codes || []).forEach(function (c) { if (S.codeId(c.code) === e.id) code = c; });
    if (!code) return nodata("slide");
    var syss = (code.sys || []).map(function (n) { return (D.systems || []).filter(function (s) { return s.name === n; })[0]; }).filter(Boolean);
    if (!syss.length) return nodata("slide");
    /* un cod de piesă servește mai multe sisteme: trece dacă măcar unul dintre ele trece; altfel se arată motivele celui cu cele mai puține încălcări */
    var best = null;
    syss.forEach(function (s) {
      var r = slideSysResult(s, ctx);
      if (!best || r.viol.length < best.viol.length || (r.viol.length === best.viol.length && r.checks > best.checks)) best = r;
    });
    var out = newRes(); out.fam = "slide"; out.viol = best.viol.slice(); out.checks = best.checks; out.unknown = best.unknown; out.rank = best.rank;
    return finish(out);
  }

  /* H.3: selectorul alege SISTEMUL (nu codul de piesă): același rezultat ca la «slide», pe sistemul cu cheia dată (cfg.slide) */
  function checkSlideSys(e, ctx) {
    var S = R("EBSliding"), D = R("EBSlidingData");
    if (!S || !D) return nodata("slide");
    var sys = (D.systems || []).filter(function (s) { return s.key === e.id; })[0];
    if (!sys) return nodata("slide");
    var r = slideSysResult(sys, ctx), out = newRes(); out.fam = "slide"; out.viol = r.viol.slice(); out.checks = r.checks; out.unknown = r.unknown; out.rank = r.rank;
    return finish(out);
  }
  /* H.3: sistemul de sertar din formular (cfg.drawerSys) se verifică prin laterala lui din date (aceeași verificare ca «zarga»); fără lateral în date = necunoscut */
  function checkDrawSys(e, ctx) {
    var D = R("EBDrawersMoreData"), side = null;
    (D && D.sides || []).forEach(function (s) { if (s.box === e.id) side = s; });
    return side ? checkDrawBox({ id: side.key, cat: "zarga" }, ctx) : nodata("zarga");
  }

  /* ===================================================================== dispecer */
  var FAM = { cern: checkHinge, lift: checkLift, corner: checkCorner, push: checkPush, pushd: checkPushd, susp: checkSusp, suprail: checkRail, conn: checkConn, zarga: checkDrawBox, guida: checkRunner, slide: checkSlide,
              slidesys: checkSlideSys, drawsys: checkDrawSys };

  function check(entry, ctx) {
    var f = entry && FAM[entry.cat];
    if (!f || !ctx) return { ok: null, why: [], rank: 1e6, unknownLimits: true, fam: "" };
    return f(entry, ctx);
  }

  function section(r) {
    if (!r || r.ok === false) return "nu_se_potriveste";
    if (r.ok === true && !r.unknownLimits) return "recomandat";
    return "potrivit";
  }

  /* ===================================================================== texte */
  function rep(s, o) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return o[k] == null ? m : o[k]; }); }
  var SPECIAL = { power: 1, front: 1, type: 1, unsupported: 1, load: 1, rail: 1, notHung: 1, liftOnly: 1, notLift: 1, sizes: 1, extraCatch: 1, pushdSys: 1, dims: 1, nohinges: 1, track: 1, n: 1 };
  function msg(why, t) {
    return (why || []).map(function (w) {
      var lab = t("hfQ_" + w.k);
      if (lab === "hfQ_" + w.k) { var sl = t("slWhat_" + w.k); lab = sl === "slWhat_" + w.k ? w.k : rep(sl, { k: w.hi == null ? "" : w.hi }); }      // mărimile uși glisante (LKB, EB, ET…) au deja text în ebanist-sliding-i18n.js
      var o = { what: lab, v: w.v == null ? "—" : w.v, lo: w.lo == null ? "—" : w.lo, hi: w.hi == null ? "—" : w.hi, n: w.n, h: w.h, w: w.w, have: w.have, want: w.want, kind: w.kind, ok: w.ok, rail: w.rail };
      if (SPECIAL[w.k]) return rep(t("hfV_" + w.k), o);
      if (w.lo != null && w.hi != null) return rep(t("hfRange"), o);
      if (w.hi != null) return rep(t("hfMax"), o);
      if (w.lo != null) return rep(t("hfMin"), o);
      return rep(t("hfRange"), o);
    });
  }

  return { SECTIONS: SECTIONS, ctxOf: ctxOf, check: check, section: section, msg: msg, densOf: densOf };
});
