/* Ebanist — deschidere push / TIP-ON / acționare electrică, suspendarea corpurilor, îmbinări demontabile și fără unealtă. PUR: fără DOM, fără stare.
 *
 * Datele vin din EBOpenData (ebanist-open-data.js, generat din documente oficiale: tools/hw-data/open/normalize.py; ce nu e citit = null) și textele din
 * ebanist-open-i18n.js. NIMIC de aici nu e «verificat»: alegerea și controalele sunt o ORIENTARE din fișa producătorului, iar cotele de găurire rămân
 * verificat:false (D-48). Totul e OPT-IN pe corp (cfg.hwSel.push / pushd / susp / suprail / conn): fără alegere explicită, distinta, devizul, găurile și 3D-ul
 * rămân cele de dinainte.
 *
 *   EBOpen.all(cat) / .get(id) / .catalog(cat, haveIds)          articolele (cat: push, pushd, pushpsu, susp, suprail, conn)
 *   EBOpen.doorCheck(item, d) / .doorQty(item, h)                 uși: limite (kg, înălțime, lățime), AVENTOS, câte pe ușă
 *   EBOpen.drawerCheck(item, d)                                    sertare: sistem, NL, lățime interioară
 *   EBOpen.suspCap(item, d) / .suspCheck(item, rail, d)            suspendare: portanță, șină, grosimi
 *   EBOpen.connCheck(item, T)                                      îmbinări: grosimea panoului
 *   EBOpen.joints()                                                 → { kinds, variants, ofId } pentru HW_DRILL.joints (ebanist-ops.js)
 *   EBOpen.opsJoint(kind, J, ctx)                                   găurirea îmbinărilor «housing» / «plug» / «nodrill» (apelată din ebanist-ops.js)
 *   EBOpen.opsDevices(out, ctx)                                     instanțe push / sertar / suspendare + găurile TIP-ON și Tipmatic (din ebanist-ops.js)
 *   EBOpen.shapesOf(h)                                              primitive 3D (cil/cutie) pentru o instanță push / suspendare
 *   EBOpen.warnBody(cfg, env)                                       avertismentele unui corp (pentru Constructor)
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.EBOpen = factory(root);
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";
  var CATS = ["push", "pushd", "pushpsu", "susp", "suprail", "conn"];
  var LANGS = ["it", "ro", "en", "fr", "de", "pl", "es"];
  var G_N = 9.81;                       // N → kg (numai pentru sursele care dau forța în newtoni)
  function D() { return root.EBOpenData || {}; }
  var _byId = null, _src = null;
  function index() {
    var d = D();
    if (_byId && _src === d) return _byId;
    _byId = {}; _src = d;
    CATS.forEach(function (c) { (d[c] || []).forEach(function (it) { _byId[it.id] = it; it._cat = c; }); });
    return _byId;
  }
  function all(cat) { return (D()[cat] || []).slice(); }
  function get(id) { return id ? (index()[id] || null) : null; }
  function phrase(lang, key) { var P = root.OPEN_PH; return (P && ((P[lang] && P[lang][key]) || (P.it && P.it[key]))) || key; }
  function nameOf(it, lang) {
    var s = it.model + (it.sysname ? " " + it.sysname : "");
    return it.ph ? s + " — " + phrase(lang, it.ph) : s;
  }
  /* intrările pentru HWDB: id, brand, n (7 limbi), art, preț 0 de completat în Catalog; cele deja existente în HWDB (`existing` sau în `have`) se sar */
  function catalog(cat, have) {
    var skip = {}; (have || []).forEach(function (i) { skip[i] = 1; });
    return all(cat).filter(function (it) { return !it.existing && !skip[it.id]; }).map(function (it) {
      var n = {}; LANGS.forEach(function (l) { n[l] = nameOf(it, l); });
      return { id: it.id, brand: it.brand, n: n, art: it.art || "—", price: 0, open: 1 };
    });
  }
  function bad(v, r) { return !!r && ((r[0] != null && v < r[0]) || (r[1] != null && v > r[1])); }
  function r1(v) { return Math.round(v * 10) / 10; }

  /* ===== UȘI ===== */
  /* d = { h, w, kg, kh, cabW, lift }   h,w = înălțimea și lățimea ușii (mm), kg = greutatea ei, kh = înălțimea interioară, cabW = lățimea corpului, lift = cheia sistemului basculant sau null */
  function doorCheck(it, d) {
    var out = [], L = (it && it.lim) || {};
    if (!it) return out;
    if (it.lifts) {
      if (!d.lift || it.lifts.indexOf(d.lift) < 0) out.push({ k: "liftOnly", lifts: it.lifts });
    } else if (d.lift) out.push({ k: "notLift" });
    [["h", "h"], ["w", "w"], ["kg", "kg"], ["kh", "kh"], ["cabW", "cabW"]].forEach(function (p) {
      var v = d[p[1]];
      if (v > 0 && L[p[0]] && bad(v, L[p[0]])) out.push({ k: "range", what: p[0], v: r1(v), lo: L[p[0]][0], hi: L[p[0]][1] });
    });
    if (L.sizes && d.h > 0) {
      var ok = L.sizes.some(function (z) { return d.h <= z.hMax && d.w >= z.wLo && d.w <= z.wHi && (!(d.kg > 0) || d.kg <= z.kg); });
      if (!ok) out.push({ k: "sizes", h: Math.round(d.h), w: Math.round(d.w), kg: r1(d.kg || 0) });
    }
    if (L.extraCatchH && d.h > L.extraCatchH) out.push({ k: "extraCatch", h: L.extraCatchH });
    return out;
  }
  /* câte dispozitive pe o ușă de înălțime h: 1, sau tabelul `per` (Salice: 2 peste 1600 mm) */
  function doorQty(it, h) {
    if (!it || !it.per) return 1;
    if (typeof it.per === "number") return it.per;
    var n = 1; it.per.forEach(function (r) { if (h >= r[0]) n = r[1]; });
    return n;
  }

  /* ===== SERTARE ===== */
  /* d = { sys, nl, lw } sys = «legrabox» | «tandembox» | «movento» | … (sistemul de sertar al corpului) */
  function drawerCheck(it, d) {
    var out = [];
    if (!it) return out;
    if (it.sys && d.sys && it.sys.indexOf(d.sys) < 0) out.push({ k: "pushdSys", want: it.sys.join(" / "), have: d.sys });
    var nlr = (it.sysNl && it.sysNl[d.sys]) || (it.lim && it.lim.nl) || null;
    if (nlr && d.nl > 0 && bad(d.nl, nlr)) out.push({ k: "range", what: "nl", v: d.nl, lo: nlr[0], hi: nlr[1] });
    var lw = (it.sysLw && it.sysLw[d.sys]) || (it.lim && it.lim.lwMin);
    if (lw && d.lw > 0 && d.lw < lw) out.push({ k: "range", what: "lw", v: r1(d.lw), lo: lw, hi: null });
    return out;
  }
  /* numărul de alimentatoare pentru n unități de acționare (cu `maxUnits` din sursă; fără el, unul pe corp) */
  function psuCount(psu, nUnits) {
    if (!(nUnits > 0)) return 0;
    var m = psu && psu.lim && psu.lim.maxUnits;
    return m > 0 ? Math.ceil(nUnits / m) : 1;
  }

  /* ===== SUSPENDARE ===== */
  /* portanța unei perechi de cleme (kg): { kg, n, perKg, frame, basis } sau null când sursa nu o dă.
     d = { H, T } înălțimea și adâncimea corpului — la SAH 500 portanța depinde de cadrul de încercare (EN 15939), se ia cel mai apropiat. */
  function suspCap(it, d) {
    if (!it) return null;
    d = d || {};
    if (it.frames) {
      var best = null, bd = Infinity;
      it.frames.forEach(function (f) {
        var dd = (d.H > 0 && d.T > 0) ? Math.hypot((d.H - f.h) / 1000, (d.T - f.t) / 1000) : (f.kg === Math.min.apply(null, it.frames.map(function (x) { return x.kg; })) ? 0 : 9);
        if (dd < bd) { bd = dd; best = f; }
      });
      return { kg: 2 * best.kg, n: 2, perKg: best.kg, frame: best, basis: "bracket" };
    }
    if (it.kgBracket != null) return { kg: 2 * it.kgBracket, n: 2, perKg: it.kgBracket, basis: "bracket" };
    if (it.kgPair != null) return { kg: it.kgPair, n: 2, perKg: null, basis: "pair" };
    if (it.nPoint != null) return { kg: r1(2 * it.nPoint / G_N), n: 2, perKg: r1(it.nPoint / G_N), basis: "bracket" };
    return null;
  }
  function railCap(r) {
    if (!r) return null;
    if (r.kgCab != null) return r.kgCab;
    if (r.nPoint != null) return r1(2 * r.nPoint / G_N);
    return null;
  }
  /* d = { kg (corp + conținut), H, T, sideT, backT, hung } */
  function suspCheck(it, rail, d) {
    var out = [];
    if (!it) return out;
    if (d.hung === false) out.push({ k: "notHung" });
    var cap = suspCap(it, d), kg = d.kg || 0;
    if (cap == null) { if (kg > 0) out.push({ k: "noKg", kg: r1(kg) }); }
    else if (kg > cap.kg) out.push({ k: "load", kg: r1(kg), cap: r1(cap.kg), cp: cap });
    var rc = railCap(rail);
    if (rc != null && kg > rc) out.push({ k: "rail", kg: r1(kg), cap: rc, rail: rail.model });
    if (it.sideT != null && d.sideT > 0 && Math.abs(d.sideT - it.sideT) > 0.01) out.push({ k: "sideT", v: d.sideT, lo: it.sideT });
    if (it.backT && d.backT > 0 && bad(d.backT, it.backT)) out.push({ k: "range", what: "backT", v: d.backT, lo: it.backT[0], hi: it.backT[1] });
    if (it.backTmin != null && d.backT > 0 && d.backT < it.backTmin) out.push({ k: "range", what: "backT", v: d.backT, lo: it.backTmin, hi: null });
    return out;
  }
  /* câte piese de șină/placă pe corp: 1 (șina se taie la lățimea corpului) — alegerea explicită sau prima compatibilă */
  function railFor(it, chosenId) {
    if (chosenId) return get(chosenId);
    return it && it.rails && it.rails.length ? get(it.rails[0]) : null;
  }

  /* ===== ÎMBINĂRI ===== */
  function connCheck(it, T) {
    var out = [];
    if (!it || !it.T || !(T > 0)) return out;
    if (bad(T, it.T)) out.push({ k: "connT", v: T, lo: it.T[0], hi: it.T[1] });
    return out;
  }
  /* geometria pentru HW_DRILL.joints: tipurile de bază și variantele pe articol. Articolele fără date complete de găurire primesc tipul «nodrill»:
     nicio gaură, cu avertisment (nu se cade pe Minifix în tăcere). */
  function joints() {
    var kinds = {
      housing: { end: 50, mid_over: 700, src: "ebanist-open-data.js (locaș în fața lui E, la B de muchie); poziția pe piesă = alegerea aplicației, ca la Minifix", verificat: false },
      plug: { end: 50, pitch: 128, src: "ebanist-open-data.js (gaură în muchia lui E, pe axa grosimii); poziția pe piesă = alegerea aplicației", verificat: false },
      nodrill: { verificat: false }
    };
    var variants = {}, ofId = {};
    all("conn").forEach(function (it) {
      if (it.joint) { variants[it.id] = Object.assign({}, it.joint, { src: it.src, verificat: false }); ofId[it.id] = it.joint.kind; }
      else ofId[it.id] = "nodrill";
    });
    return { kinds: kinds, variants: variants, ofId: ofId };
  }
  function tabAt(tbl, T) { if (!tbl) return null; var v = tbl[String(Math.round(T))]; return v == null ? null : v; }
  function warnOnce(out, w) {
    out.warnings = out.warnings || [];
    for (var i = 0; i < out.warnings.length; i++) { var x = out.warnings[i]; if (x.k === w.k && x.sys === w.sys && String(x.v) === String(w.v)) return; }
    out.warnings.push(w);
  }
  /* ctx = { E, F, eAx, eSide, sAx, lo, hi, camAx, camSide, out, hole, slot, even, mid }  — găurile unei îmbinări «housing» / «plug» / «nodrill» */
  function opsJoint(kind, J, ctx) {
    var E = ctx.E, F = ctx.F, out = ctx.out, eAx = ctx.eAx, eSide = ctx.eSide, sAx = ctx.sAx, camAx = ctx.camAx, camSide = ctx.camSide || -1;
    var sysName = J.note || kind, jid = out.jointId || "";
    if (kind === "nodrill") { warnOnce(out, { piece: E.pk, k: "wOpenConnNoDrill", sys: jid }); return; }
    var T = E.T || 19, dep = J.depthFn ? J.depthFn.k * T + J.depthFn.c : tabAt(J.depthT, T);
    if (dep == null) { warnOnce(out, { piece: E.pk, k: "opsOpenThick", sys: sysName, v: Math.round(T * 10) / 10 }); return; }
    var edge = eSide > 0 ? E.max[eAx] : E.min[eAx], mid = (E.min[camAx] + E.max[camAx]) / 2;
    var pos = kind === "plug" ? ctx.even(ctx.lo, ctx.hi, J.end, J.pitch, 30) : ctx.pos(ctx.lo, ctx.hi, J.end, J.mid_over);
    pos.forEach(function (s) {
      var id = "hw_" + out.hw.length, p = [0, 0, 0]; p[eAx] = edge; p[camAx] = mid; p[sAx] = s;
      if (kind === "plug") {
        /* TAB: gaura Ø în MUCHIA lui E, pe axa grosimii (A = grosimea/2 în sursă), adâncimea X după grosime */
        ctx.hole(E, eAx, eSide, p.slice(), J.dia, dep, id, "foro plug");
        warnOnce(out, { piece: E.pk, k: "opsOpenNoF", sys: sysName });
        out.hw.push({ id: id, type: "plug", catalog: jid, piece: E.pk, against: F.pk, w: p.slice(), eAx: eAx, eSide: eSide, sAx: sAx, camAx: camAx, note: sysName });
      } else {
        /* locaș Ø în FAȚA lui E la B de muchie + canalul/gaura din muchia lui E; gaura din F numai dacă sursa dă Ø și adâncimea */
        var B = J.B != null ? J.B : ctx.legacyB;
        if (J.B == null) warnOnce(out, { piece: E.pk, k: "opsOpenB", sys: sysName });
        var cam = p.slice(); cam[eAx] = edge + (-eSide) * B; cam[camAx] = camSide > 0 ? E.max[camAx] : E.min[camAx];
        ctx.hole(E, camAx, camSide, cam, J.dia, dep, id, "eccentrico housing");
        ctx.hole(E, eAx, eSide, p.slice(), J.shankDia, J.shankDepth != null ? J.shankDepth : B, id, "gambo housing");
        if (J.fDia && J.fDepth) ctx.hole(F, eAx, -eSide, p.slice(), J.fDia, J.fDepth, id, "perno housing");
        else warnOnce(out, { piece: E.pk, k: "opsOpenNoF", sys: sysName });
        out.hw.push({ id: id, type: "housing", catalog: jid, piece: E.pk, against: F.pk, w: cam, dir: { ax: camAx, side: camSide }, edge: p.slice(), eAx: eAx, eSide: eSide, sAx: sAx, camAx: camAx, note: sysName });
      }
    });
  }

  /* ===== MONTAREA DISPOZITIVELOR PE CORP (comun pentru găurire și 3D) ===== */
  /* panels = [{ pk, role, min:[x,y,z], max:[x,y,z] }]; door = { pk, x0,x1,y0,y1,z0,z1, hinge } (coordonate lume, mm).
     Unitatea merge în muchia din față a unui panou vertical aflat în dreptul marginii libere a ușii; dacă nu e niciunul, în muchia din față a tavanului.
     Poziția pe înălțime = locul mânerului (sursele Blum: «ideal acolo unde ar fi mânerul»), poziția pe lățime la tavan = alegerea aplicației. */
  var HANDLE = { fromTop: 60, tallY: 1050 };
  var VERT = { fianco: 1, divisorio: 1 }, HORIZ = { cielo: 1, base_cielo: 1, traversa_cielo: 1 };
  function pushMount(panels, door, fromInner) {
    var free = door.hinge === "right" ? door.x0 : door.x1, toRight = free === door.x1, top = door.y1, bot = door.y0;
    var hy = top < 1100 ? top - HANDLE.fromTop : (bot > 1300 ? bot + HANDLE.fromTop : Math.max(bot + HANDLE.fromTop, Math.min(top - HANDLE.fromTop, HANDLE.tallY)));
    var best = null;
    panels.forEach(function (p) {
      if (!VERT[p.role] || p.max[0] - p.min[0] > 45) return;
      var cx = (p.min[0] + p.max[0]) / 2, dc = (door.x0 + door.x1) / 2;
      if (toRight ? cx < dc : cx > dc) return;
      if (free < p.min[0] - 1 || free > p.max[0] + 8) return;
      if (hy < p.min[1] + 30 || hy > p.max[1] - 30) return;
      if (!best || Math.abs(cx - free) < Math.abs((best.min[0] + best.max[0]) / 2 - free)) best = p;
    });
    var zOf = function (p) { return p.max[2]; };
    if (best) {
      var inner = toRight ? best.min[0] : best.max[0];
      return { panel: best, axis: "x", x: inner + (toRight ? fromInner : -fromInner), y: hy, zf: zOf(best), inner: inner, dir: toRight ? 1 : -1, T: best.max[0] - best.min[0], handleY: hy };
    }
    var tp = null;
    panels.forEach(function (p) { if (HORIZ[p.role] && p.max[1] - p.min[1] <= 45 && (!tp || p.max[1] > tp.max[1])) tp = p; });
    if (!tp) return null;
    var xx = Math.max(door.x0 + 40, Math.min(door.x1 - 40, free + (toRight ? -60 : 60)));
    return { panel: tp, axis: "y", x: xx, y: tp.min[1] + fromInner, zf: zOf(tp), inner: tp.min[1], dir: 1, T: tp.max[1] - tp.min[1], handleY: hy };
  }

  var DRAW = { tipon: "plunger", bumper: "plunger", catch: "disc", magnet: "disc", lock: "disc", pin: "pin", pressure: "disc", battery: "unit", mech: "unit" };
  function pushDims(it) {
    if (!it || !it.dims) return null;
    var k = it.dimsKey || "LWH", d = it.dims;
    return k === "WDH" ? { z: d[0], off: d[1], y: d[2] } : { z: d[0], y: d[1], off: d[2] };
  }
  /* instanțele push / sertar / suspendare din model. ctx = { pcs, cfg, hole, HW_DRILL } — numai pentru alegerile EXPLICITE ale corpului */
  function opsDevices(out, ctx) {
    var cfg = ctx.cfg || {}, sel = cfg.hwSel || {}, pcs = ctx.pcs || [];
    var panels = pcs.map(function (p) { return { pk: p.pk, role: p.role, min: p.min, max: p.max }; });
    /* --- uși cu push explicit --- */
    var it = get(sel.push);
    if (it && cfg.handles === "push") {
      var fam = DRAW[it.note] || null;
      var drs = pcs.filter(function (p) { return p.role === "frontale" && p.sub === "door"; }).sort(function (a, b) { return a.min[0] - b.min[0]; });
      drs.forEach(function (dp, di) {
        /* balamaua implicită: prima jumătate a ușilor la stânga, a doua la dreapta (ca în ebanist-ops.js); cea scrisă pe ușă are prioritate */
        var hinge = dp.hinge || (drs.length === 1 ? "left" : (di < drs.length / 2 ? "left" : "right"));
        var door = { pk: dp.pk, x0: dp.min[0], x1: dp.max[0], y0: dp.min[1], y1: dp.max[1], z0: dp.min[2], z1: dp.max[2], hinge: hinge };
        var pm0 = pushMount(panels, door, 7.5); if (!pm0) return;
        var dr = it.drill, gap = Math.max(0, door.z0 - pm0.zf);
        var fi = dr ? (dr.fromInner === "10+F" ? 10 + gap : dr.fromInner) : 7.5;
        var pm = pushMount(panels, door, fam === "unit" ? 0 : fi); if (!pm) return;
        var id = "hw_" + out.hw.length, qty = doorQty(it, door.y1 - door.y0);
        var inst = { id: id, type: "pushunit", catalog: it.id, piece: pm.panel.pk, against: door.pk, fam: fam, axis: pm.axis, w: pm.axis === "x" ? [pm.x, pm.y, pm.zf] : [pm.x, pm.y, pm.zf],
                     inner: pm.inner, dir: pm.dir, door: [door.x0, door.x1, door.y0, door.y1, door.z0], qty: qty, schem: !(dr || pushDims(it)), dia: dr ? dr.dia : null, depth: dr ? dr.depth : null,
                     dims: pushDims(it), note: it.model };
        out.hw.push(inst);
        var pp = null; pcs.forEach(function (q) { if (String(q.pk) === String(pm.panel.pk)) pp = q; });
        if (dr && pp && ctx.hole && (fam === "plunger" || fam === "disc" || fam === "pin")) {
          if (pm.T - (fi + dr.dia / 2) < (dr.edgeMin || 0)) warnOnce(out, { piece: pm.panel.pk, k: "opsOpenThick", sys: it.model, v: Math.round(pm.T * 10) / 10 });
          else ctx.hole(pp, 2, 1, [pm.x, pm.y, pm.zf], dr.dia, dr.depth, id, "foro push " + it.model);
          warnOnce(out, { piece: pm.panel.pk, k: "opsOpenPlace" });
        } else warnOnce(out, { piece: null, k: "opsOpenNoDrill" });
      });
    }
    /* --- sertare cu push/electric explicit (numai desen + avertisment de găurire) --- */
    var di = get(sel.pushd);
    if (di && cfg.handles === "push") {
      /* fața interioară a spatelui (sau spatele laterelor, fără panou de spate): unitatea stă în corp, în spatele sertarului */
      var back = null; pcs.forEach(function (p) { if (p.role === "schienale") back = back == null ? p.max[2] : Math.max(back, p.max[2]); });
      if (back == null) pcs.forEach(function (p) { if (p.role === "fianco") back = back == null ? p.min[2] : Math.min(back, p.min[2]); });
      pcs.filter(function (p) { return p.role === "cassetto_frontale"; }).forEach(function (fp) {
        var id = "hw_" + out.hw.length, ud = di.unitDims || null, schem = !ud;
        out.hw.push({ id: id, type: "pushdunit", catalog: di.id, piece: fp.pk, against: fp.pk, w: [(fp.min[0] + fp.max[0]) / 2, fp.min[1] + (fp.max[1] - fp.min[1]) / 2, (back == null ? 0 : back) + (ud ? ud[2] : 30) / 2],
                      unit: ud ? { x: ud[0], y: ud[1], z: ud[2] } : { x: 100, y: 30, z: 30 }, schem: schem, note: di.model, elec: !!di.elec });
      });
      if (pcs.some(function (p) { return p.role === "cassetto_frontale"; })) warnOnce(out, { piece: null, k: "opsOpenNoDrill" });
    }
    /* --- suspendare explicită: două cleme sus, spate, + șina --- */
    var su = get(sel.susp);
    if (su) {
      var sides = pcs.filter(function (p) { return p.role === "fianco" && p.tAx === 0; }).sort(function (a, b) { return a.min[0] - b.min[0]; });
      var tops = pcs.filter(function (p) { return p.role === "cielo" || p.role === "base_cielo"; });
      var topY = tops.length ? Math.max.apply(null, tops.map(function (p) { return p.max[1]; })) : (sides.length ? sides[0].max[1] : 0);
      var topIn = tops.length ? Math.max.apply(null, tops.map(function (p) { return p.min[1]; })) : topY;
      var zb = sides.length ? sides[0].min[2] : 0;
      var oh = su.outline ? su.outline[0] : (su.wallElementH || null);
      [sides[0], sides[sides.length - 1]].forEach(function (sp, i) {
        if (!sp || (i === 1 && sides.length < 2)) return;
        var dir = i === 0 ? 1 : -1, inner = i === 0 ? sp.max[0] : sp.min[0];
        out.hw.push({ id: "hw_" + out.hw.length, type: "susphang", catalog: su.id, piece: sp.pk, against: sp.pk, w: [inner, topIn, zb], dir: dir, h: oh || 100, d: su.outline ? su.outline[1] : 40,
                      schem: !(su.outline), wall: su.wall, note: su.model });
      });
      if (sides.length >= 2 && su.wall !== "hook") {
        var rl = railFor(su, sel.suprail);
        out.hw.push({ id: "hw_" + out.hw.length, type: "suprail", catalog: rl ? rl.id : null, piece: sides[0].pk, against: sides[0].pk, w: [sides[0].min[0], topIn - 30, zb], x1: sides[sides.length - 1].max[0],
                      schem: true, note: rl ? rl.model : su.model });
      }
      /* găurile din lateral: numai cu toate cotele și reperele din sursă (SAH 500, Hettich MTA 9 348 672 00 p.5): 2 × 2 Ø10 × 12,5 în fața interioară a lateralului,
         coloana din spate la 43,5 de muchia din spate, a doua la 32 spre față; rândul de sus la C de fața interioară a tavanului (C ≥ 14,5: aici minimul, alegere a aplicației), al doilea la 64 sub el */
      var dd = su.drill, drilled = false;
      if (dd && dd.holes === 4 && dd.fromRear != null && dd.cMin != null && dd.pitchA && dd.pitchB && ctx.hole && sides.length) {
        var yTop = topIn - dd.cMin, yLow = yTop - dd.pitchB, ok = true;
        [sides[0], sides[sides.length - 1]].forEach(function (sp, i) {
          if (!sp || (i === 1 && sides.length < 2)) return;
          if (sp.max[0] - sp.min[0] < dd.depth + 1 || yLow - dd.dia / 2 < sp.min[1] || sp.min[2] + dd.fromRear + dd.pitchA + dd.dia / 2 > sp.max[2]) ok = false;
        });
        if (ok) {
          [sides[0], sides[sides.length - 1]].forEach(function (sp, i) {
            if (!sp || (i === 1 && sides.length < 2)) return;
            var innerX = i === 0 ? sp.max[0] : sp.min[0], side = i === 0 ? 1 : -1;
            [0, dd.pitchA].forEach(function (dz) { [yTop, yLow].forEach(function (y) {
              ctx.hole(sp, 0, side, [innerX, y, sp.min[2] + dd.fromRear + dz], dd.dia, dd.depth, "hw_" + (out.hw.length - 1), "foro sospensione " + su.model);
            }); });
          });
          drilled = true;
        }
      }
      warnOnce(out, drilled ? { piece: null, k: "opsSuspPlace", sys: su.model } : { piece: null, k: "wOpenSuspNoDrill", sys: su.model });
    }
  }

  /* ===== 3D: primitive pure (cil / cutie), în mm, coordonate lume ===== */
  function cyl(mat, a, b, d, role) { return { t: "cyl", mat: mat, a: a, b: b, d: d, role: role }; }
  function box(mat, lo, hi, role, r) { var s = { t: "box", mat: mat, lo: lo, hi: hi, role: role }; if (r) s.r = r; return s; }
  function bx(mat, c, sx, sy, sz, role, r) { return box(mat, [c[0] - sx / 2, c[1] - sy / 2, c[2] - sz / 2], [c[0] + sx / 2, c[1] + sy / 2, c[2] + sz / 2], role, r); }
  function shapesOf(h) {
    var out = [], w = h.w;
    if (h.type === "pushunit") {
      if (h.fam === "plunger" || h.fam === "pin" || h.fam === "disc") {
        var dia = h.dia || 10, dep = h.depth || 50;
        out.push(cyl("__blackmetal", [w[0], w[1], w[2] - dep], [w[0], w[1], w[2] + 0.6], dia - 0.4, "unit"));
        /* placa/discul de pe spatele ușii, în dreptul dispozitivului (Ø15 la Tipmatic, din sursă; altfel o placă schematică) */
        var zd = h.door[4], pd = h.fam === "pin" ? 15 : 16;
        if (h.fam === "plunger" && h.catalog !== "blum_tipon_bumper") out.push(box("__zinc", [w[0] - 8, w[1] - 8, zd - 1.5], [w[0] + 8, w[1] + 8, zd], "plate"));
        else if (h.fam !== "plunger") out.push(cyl("__zinc", [w[0], w[1], zd - 1.5], [w[0], w[1], zd], pd, "plate"));
      } else if (h.fam === "unit" && h.dims) {
        var D2 = h.dims, x0 = h.inner, x1 = h.inner - h.dir * D2.off;   // spre interiorul corpului
        if (h.axis === "y") out.push(box("__blackmetal", [w[0] - D2.y / 2, h.inner - D2.off, w[2] - D2.z], [w[0] + D2.y / 2, h.inner, w[2]], "unit", 2));
        else out.push(box("__blackmetal", [Math.min(x0, x1), w[1] - D2.y / 2, w[2] - D2.z], [Math.max(x0, x1), w[1] + D2.y / 2, w[2]], "unit", 2));
      }
    } else if (h.type === "pushdunit") {
      out.push(bx(h.elec ? "__blackmetal" : "__zinc", h.w, h.unit.x, h.unit.y, h.unit.z, "unit", 2));
    } else if (h.type === "susphang") {
      var xin = h.w[0], x0b = Math.min(xin, xin + h.dir * 6), x1b = Math.max(xin, xin + h.dir * 6);
      out.push(box("__zinc", [x0b, h.w[1] - h.h, h.w[2] + 4], [x1b, h.w[1] - 2, h.w[2] + 4 + h.d], "hanger", 1.5));
    } else if (h.type === "suprail") {
      out.push(box("__inox", [h.w[0], h.w[1] - 20, h.w[2] - 3], [h.x1, h.w[1], h.w[2]], "rail", 0.5));
    }
    return out.map(function (s) { s.src = [h.id]; return s; });
  }

  /* ===== AVERTISMENTELE UNUI CORP =====
     env = { item(cat), lookup(id), doors:[{h,w,kg,pz}], drawers:{n, nl, lw, sys}, bodyKg, G:{H,T}, sideT, backT, hung, lift, cabW }  — toate calculate de index.html */
  function warnBody(cfg, env) {
    var W = [], sel = (cfg && cfg.hwSel) || {};
    var pu = get(sel.push);
    if (pu) {
      if (cfg.handles !== "push") W.push({ k: "noHandle", sys: pu.model });
      (env.doors || []).forEach(function (d) {
        doorCheck(pu, { h: d.h, w: d.w, kg: d.kg, kh: env.kh, cabW: env.cabW, lift: env.lift }).forEach(function (i) { i.sys = pu.model + " " + (pu.art || ""); W.push(i); });
      });
      if (pu.lim && pu.lim.gapMin != null && (env.doors || []).length) W.push({ k: "gapMin", lo: pu.lim.gapMin, sys: pu.model + " " + (pu.art || "") });
    }
    var pd = get(sel.pushd);
    if (pd && env.drawers && env.drawers.n > 0) {
      if (cfg.handles !== "push") W.push({ k: "noHandle", sys: pd.model });
      drawerCheck(pd, env.drawers).forEach(function (i) { i.sys = pd.model + (pd.sysname ? " " + pd.sysname : "") + " " + (pd.art || ""); W.push(i); });
      if (pd.gapMin != null) W.push({ k: "gapMin", lo: pd.gapMin, sys: pd.model + (pd.sysname ? " " + pd.sysname : "") + " " + (pd.art || "") });
    }
    var su = get(sel.susp);
    if (su) {
      var rl = railFor(su, sel.suprail);
      suspCheck(su, rl, { kg: (env.bodyKg || 0) + (+cfg.suspKg || 0), H: env.G && env.G.H, T: env.G && env.G.T, sideT: env.sideT, backT: env.backT, hung: env.hung }).forEach(function (i) { i.sys = su.model + " " + (su.art || ""); W.push(i); });
      if (!sel.suprail && su.rails && su.rails.length) W.push({ k: "suspRails", sys: su.model, rail: rl ? rl.model : "" });
    }
    var cn = get(sel.conn);
    if (cn && cn._cat === "conn") connCheck(cn, env.sideT).forEach(function (i) { i.sys = cn.model + " " + (cn.art || ""); W.push(i); });
    return W;
  }

  /* textul unui avertisment (al corpului sau din operații) în limba aplicației; t = funcția de traducere (cheie → text) */
  function msg(w, t) {
    var rep = function (s, o) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return o[k] == null ? m : o[k]; }); };
    var nm = function (k) { var L = root.EBLiftFit && root.EBLiftFit.get && root.EBLiftFit.get(k); return L ? L.name : k; };
    switch (w.k) {
      case "range": return rep(t("wOpenRange"), { sys: w.sys, what: t("wOpenWhat_" + w.what), v: w.v, lo: w.lo == null ? "—" : w.lo, hi: w.hi == null ? "—" : w.hi });
      case "liftOnly": return rep(t("wOpenLiftOnly"), { sys: w.sys, lifts: (w.lifts || []).map(nm).join(" / ") });
      case "notLift": return rep(t("wOpenNotLift"), { sys: w.sys });
      case "noHandle": return rep(t("wOpenNoHandle"), { sys: w.sys });
      case "sizes": return rep(t("wOpenSizes"), { sys: w.sys, h: w.h, w: w.w, kg: w.kg });
      case "extraCatch": return rep(t("wOpenExtraCatch"), { sys: w.sys, h: w.h });
      case "gapMin": return rep(t("wOpenGap"), { sys: w.sys, lo: w.lo });
      case "pushdSys": return rep(t("wOpenPushdSys"), { sys: w.sys, have: w.have, want: w.want });
      case "notHung": return rep(t("wOpenSuspNotHung"), { sys: w.sys });
      case "noKg": return rep(t("wOpenSuspNoKg"), { sys: w.sys, kg: w.kg });
      case "load": {
        var c = w.cp || {}, basis = c.basis === "pair" ? t("wOpenSuspBasisPair") : rep(t("wOpenSuspBasis"), { n: c.n, kg: c.perKg });
        if (c.frame) basis += ", " + rep(t("wOpenSuspFrame"), { f: c.frame.id, h: c.frame.h, t: c.frame.t });
        return rep(t("wOpenSuspLoad"), { sys: w.sys, kg: w.kg, cap: w.cap, basis: basis });
      }
      case "rail": return rep(t("wOpenSuspRail"), { sys: w.sys, rail: w.rail, cap: w.cap, kg: w.kg });
      case "sideT": return rep(t("wOpenSuspSideT"), { sys: w.sys, v: w.v, lo: w.lo });
      case "suspRails": return rep(t("wOpenSuspRails"), { sys: w.sys, rail: w.rail });
      case "connT": return rep(t("wOpenConnT"), { sys: w.sys, v: w.v, lo: w.lo == null ? "—" : w.lo, hi: w.hi == null ? "—" : w.hi });
      default: return rep(t(w.k), { sys: w.sys, v: w.v });          // opsOpen*, wOpenConnNoDrill, wOpenSuspNoDrill
    }
  }
  var OPS_NOTES = ["opsOpenNoDrill", "opsOpenPlace", "opsOpenB", "opsOpenNoF", "opsOpenThick", "wOpenConnNoDrill", "wOpenSuspNoDrill", "opsSuspPlace"];

  return { OPS_NOTES: OPS_NOTES, msg: msg, CATS: CATS, LANGS: LANGS, all: all, get: get, nameOf: nameOf, catalog: catalog, doorCheck: doorCheck, doorQty: doorQty, drawerCheck: drawerCheck, psuCount: psuCount,
           suspCap: suspCap, railCap: railCap, suspCheck: suspCheck, railFor: railFor, connCheck: connCheck, joints: joints, opsJoint: opsJoint, pushMount: pushMount,
           opsDevices: opsDevices, shapesOf: shapesOf, warnBody: warnBody, pushDims: pushDims, DRAW: DRAW, HANDLE: HANDLE,
           HW_CAT_OF: { hwPushD: "pushd", hwPushPsu: "pushpsu", hwSusp: "susp", hwSuspRail: "suprail" },
           HW_CATS: [["pushd", "hwPushD"], ["pushpsu", "hwPushPsu"], ["susp", "hwSusp"], ["suprail", "hwSuspRail"]],
           HW_BODY_CATS: ["pushd", "susp", "suprail"], HWKEYS: ["hwPushD", "hwPushPsu", "hwSusp", "hwSuspRail"] };
});
