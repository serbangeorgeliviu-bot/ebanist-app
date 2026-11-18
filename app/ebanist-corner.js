/* Ebanist U.17 — unități de colț, scoase pentru corpuri joase și înalte, mecanisme de rotire și de mișcare: configurația, ușa și desenul 3D.
 * PUR: fără DOM, fără stare. Datele: EBCornerData (ebanist-corner-data.js) prin EBCornerFit (ebanist-cornerfit.js).
 *
 * `cfg.cu` = cheia unității din catalog (altfel corpul e cel de dinainte, rând cu rând). Câmpuri: `cuSize` (id-ul mărimii; gol = alegere automată),
 * `cuHand` ("sx"|"dx": de ce parte e partea oarbă a colțului; la corpul de colț `cfg.corner` o hotărăște).
 *
 *   EBCorner.prep(cfg)           → null (cfg.cu lipsește / nu se aplică) sau { cfg2, cfg0, u, forced }  — configurația cu interiorul eliberat
 *   EBCorner.apply(cu, built)    → modifică `built` (ușa, cutii 3D, avertismente, built.cu)
 *   EBCorner.bom(cfg)            → { id, n, fronts }  pentru deviz
 *
 * Desen: cutiile unității sunt `kind:"m"`, `role:"cornerhw"`, `sub:"cu"`, pk ≥ 9500 — numai 3D și plan, NU piese (nu se taie, se cumpără), ca aparatele (D-143).
 * Mișcarea (`cu.an`): { dz } glisare înainte · { dy } coborâre · { rot:{x,z,deg}, follow? } rotire în jurul unei axe verticale (follow = pk-ul ușii cu care merge) ·
 * { hx:{y,z,deg} } rabatare. Dimensiunile din surse (diametre, lățimi de coș, curse) se folosesc ca atare; restul e SCHEMATIC și se spune.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.EBCorner = factory(root);
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";
  function FIT() { return root.EBCornerFit || (typeof require === "function" ? require("./ebanist-cornerfit.js") : null); }
  function unitOf(cfg) { var F = FIT(); return (cfg && typeof cfg.cu === "string" && cfg.cu && F) ? F.get(cfg.cu) : null; }
  var PK0 = 9500;

  /* se aplică doar corpurilor standard și celei de colț (aripa A), fără cote absolute și fără pantă */
  function supported(cfg) {
    var t = cfg.type || "standard";
    if (t !== "standard" && t !== "angolare") return false;
    if (cfg.topProfile) return false;
    if ((cfg.partitions && cfg.partitions.length) || (cfg.fronts && cfg.fronts.length) || (cfg.customCuts && cfg.customCuts.length) || (cfg.drawerBlocks && cfg.drawerBlocks.length) || cfg.depthProfile) return false;
    return true;
  }
  /* ce eliberează unitatea din interior (câmp → valoare) */
  var CLEAR = { shelves: 0, drawers: 0, hang: 0, tram: 0 };
  function forceOf(u) {
    var k = u.kind, o = {};
    function add(a) { for (var q in a) o[q] = a[q]; }
    if (k === "blind") add(CLEAR), o.doors = 1;
    else if (k === "carousel") add(CLEAR);
    else if (k === "cdrawer") add(CLEAR), o.doors = 2;
    else if (k === "pullout" || k === "tall") { add(CLEAR); if (u.front === "frame") o.doors = 1; }
    else if (k === "pulldown") add(CLEAR);
    else if (k === "spin") add(CLEAR), o.doors = 0;
    else if (k === "tvlift") add(CLEAR), o.top = "none";
    else if (k === "wardlift") add(CLEAR);
    else if (k === "bracket") o.doors = 1, o.drawers = 0;
    return o;
  }
  function prep(cfg) {
    var u = unitOf(cfg); if (!u || !supported(cfg)) return null;
    var F = forceOf(u), c2 = Object.assign({}, cfg), forced = [];
    Object.keys(F).forEach(function (k) {
      var cur = cfg[k]; if (k === "top") cur = cfg.top || "plin";
      if ((+cur || 0) !== F[k] && cur !== F[k]) { forced.push({ k: k, from: cur == null ? 0 : cur, to: F[k] }); c2[k] = F[k]; }
      else c2[k] = F[k];
    });
    /* purtătoarele care ar mai putea umple interiorul */
    ["secMode", "secDrawers", "secDrawerH", "secDrawerNL", "secPull"].forEach(function (k) { if (c2[k]) { c2[k] = null; if (u.kind !== "turntable" && u.kind !== "bracket") forced.push({ k: k, from: 1, to: 0 }); } });
    /* carusel / pulldown / turntable: măcar o ușă (nu se forțează dacă utilizatorul a ales 0 pentru turntable) */
    if ((u.kind === "carousel" || u.kind === "pulldown" || u.kind === "tall" && u.front === "hinged") && !(+c2.doors > 0)) { forced.push({ k: "doors", from: 0, to: 1 }); c2.doors = 1; }
    /* ușa acoperă numai deschiderea liberă (partea oarbă nu are front): invariantul de lățime a frontului nu se aplică (ebanist-core.js, I4) */
    if (u.kind === "blind") c2.cuPartial = 1;
    /* aripa B a colțului rămâne ca a ales utilizatorul */
    if ((cfg.type || "standard") === "angolare") c2.cuB = Object.assign({}, cfg, { cu: null });
    return { cfg2: c2, cfg0: cfg, u: u, forced: forced };
  }

  /* ---------- geometrie ---------- */
  function rect(x0, x1, y0, y1, z0, z1, pk, cu, role) {
    return { x0: x0, x1: x1, y0: y0, y1: y1, z0: z0, z1: z1, kind: "m", role: role || "cornerhw", sub: "cu", pk: pk, pc: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], cu: cu };
  }
  function poly(pts, y0, y1, pk, cu) {
    var xs = pts.map(function (q) { return q[0]; }), zs = pts.map(function (q) { return q[1]; });
    return { x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs), y0: y0, y1: y1, z0: Math.min.apply(null, zs), z1: Math.max.apply(null, zs), kind: "m", role: "cornerhw", sub: "cu", pk: pk, pc: pts, cu: cu };
  }
  /* tavă dreptunghiulară cu rebord (o singură piesă fizică: aceleași pk) */
  function tray(x0, x1, y0, h, z0, z1, pk, cu) {
    var w = 3, o = [rect(x0, x1, y0, y0 + 4, z0, z1, pk, cu)];
    if (h > 6 && x1 - x0 > 20 && z1 - z0 > 20) {
      o.push(rect(x0, x1, y0 + 4, y0 + h, z0, z0 + w, pk, cu), rect(x0, x1, y0 + 4, y0 + h, z1 - w, z1, pk, cu),
        rect(x0, x0 + w, y0 + 4, y0 + h, z0 + w, z1 - w, pk, cu), rect(x1 - w, x1, y0 + 4, y0 + h, z0 + w, z1 - w, pk, cu));
    }
    return o;
  }
  /* sector de cerc în plan (x,z); a0 în radiani, span radiani; centrul e primul punct */
  function sector(cx, cz, R, a0, span, N) {
    var p = [[cx, cz]], n = Math.max(8, N || 24);
    for (var i = 0; i <= n; i++) { var a = a0 + span * i / n; p.push([cx + R * Math.cos(a), cz + R * Math.sin(a)]); }
    return p;
  }
  function circle(cx, cz, R, N) { var p = [], n = N || 12; for (var i = 0; i < n; i++) { var a = 2 * Math.PI * i / n; p.push([cx + R * Math.cos(a), cz + R * Math.sin(a)]); } return p; }
  function rnd(v) { return Math.round(v * 10) / 10; }

  /* interiorul corpului (aripa A / corpul standard), din cutiile lui */
  function interior(boxes) {
    var A = boxes.filter(function (b) { return b.wing !== "B" && b.kind !== "w" && b.kind !== "g"; });
    var fi = A.filter(function (b) { return b.role === "fianco"; }).sort(function (a, b) { return (a.x0 + a.x1) - (b.x0 + b.x1); });
    if (fi.length < 2) return null;
    var ba = A.filter(function (b) { return b.role === "base"; }), ci = A.filter(function (b) { return b.role === "cielo"; }), sc = A.filter(function (b) { return b.role === "schienale"; });
    var ix0 = fi[0].x1, ix1 = fi[fi.length - 1].x0;
    var iy0 = ba.length ? Math.max.apply(null, ba.map(function (b) { return b.y1; })) : Math.min.apply(null, fi.map(function (b) { return b.y0; }));
    var iy1 = ci.length ? Math.min.apply(null, ci.map(function (b) { return b.y0; })) : Math.max.apply(null, fi.map(function (b) { return b.y1; }));
    var iz0 = sc.length ? Math.max.apply(null, sc.map(function (b) { return b.z1; })) : 0;
    var iz1 = Math.max.apply(null, fi.map(function (b) { return b.z1; }));
    var shelves = A.filter(function (b) { return b.role === "ripiano"; }).map(function (b) { return b.y1; }).sort(function (a, b) { return a - b; });
    var top = ci.length ? 1 : 0;
    return { ix0: ix0, ix1: ix1, iy0: iy0, iy1: iy1, iz0: iz0, iz1: iz1, shelves: shelves, hasTop: top, A: A };
  }

  function apply(cu, built, env) {
    var u = cu.u, cfg0 = cu.cfg0, F = FIT(), boxes = built.boxes, I = interior(boxes);
    var W = (built.warn = built.warn || {}), cw = (W.cuWarn = []);
    function note(k, x) { var o = { k: k, u: u.name }; if (x) for (var q in x) o[q] = x[q]; cw.push(o); }
    cu.forced.forEach(function (f) { cw.push({ k: "forced", u: u.name, what: f.k, from: f.from, to: f.to }); });
    if (!I) { note("noint"); return built; }
    var ang = (cfg0.type || "standard") === "angolare";
    var hand = ang ? (cfg0.corner === "sx" ? "sx" : "dx") : (cfg0.cuHand === "dx" ? "dx" : "sx");   // de ce parte e partea oarbă
    var wi = I.ix1 - I.ix0, hi = I.iy1 - I.iy0, dp = I.iz1 - I.iz0;
    var d = { L: +cfg0.L, H: +cfg0.H, P: +cfg0.P, wi: wi, hi: hi, depth: dp, body: F.bodyOf(cfg0) };
    /* greutatea ușii, pentru console: din material (aceleași densități orientative ca la ridicare) */
    var doors = boxes.filter(function (b) { return b.wing !== "B" && b.role === "frontale" && b.sub === "door"; });
    if (u.kind === "bracket" && env && env.doorKg != null) d.doorKg = env.doorKg;
    var ft = F.fit(u, d, { size: cfg0.cuSize });
    var sz = ft.size || {}, band = ft.band;
    ft.issues.forEach(function (i) { cw.push({ k: "range", u: u.name, what: i.k, v: i.v, lo: i.lo, hi: i.hi, axis: i.axis, want: i.want, have: i.have, rec: i.rec }); });
    cw.push({ k: "unv", u: u.name });
    var pk = PK0, out = [], info = { key: u.key, size: ft.size ? String(ft.size.id) : null, band: band ? band.id : null, hand: u.hand ? hand : null, issues: ft.issues, codes: ft.info.codes, load: u.load, kg: ft.info.kg, kind: u.kind, n: ft.info.n };
    function C(nm, a) { var o = { u: u.key, nm: nm }; if (a) o.an = a; return o; }
    var iy0 = I.iy0, iy1 = I.iy1, ix0 = I.ix0, ix1 = I.ix1, iz0 = I.iz0, iz1 = I.iz1;
    var doorRows = built.pieces.filter(function (p) { return p.wing !== "B" && p.role === "frontale" && /^Anta/.test(p.elemento); });
    function setDoor(b, x0, x1) { b.x0 = x0; b.x1 = x1; b.pc = [[x0, b.z0], [x1, b.z0], [x1, b.z1], [x0, b.z1]]; }
    function retag(newName, anim) {
      doorRows.forEach(function (r) { r.elemento = r.elemento.replace(/^Anta/, newName); });
      doors.forEach(function (b, i) { b.sub = "cufront"; delete b.hinge; b.cu = C("front", Array.isArray(anim) ? anim[i] || anim[0] : anim); });
    }
    var K = u.kind, dr = u.draw || {}, lev;

    if (K === "blind") {
      var db = doors[0], D = sz.door || (db ? Math.round((db.x1 - db.x0) / 2) : 450);
      if (!sz.door) note("doorsch");
      if (!db) { note("noint"); }
      else {
        var bw = db.x1 - db.x0, Dn = Math.min(D, bw);
        if (hand === "dx") setDoor(db, db.x0, db.x0 + Dn); else setDoor(db, db.x1 - Dn, db.x1);
        db.hinge = hand === "dx" ? "right" : "left";          /* balamaua stă pe partea oarbă (balama de colț), ușa se deschide spre partea liberă */
        doorRows.forEach(function (r) { r.larg = Math.round(Dn); });
        info.doorW = Math.round(Dn);
        lev = dr.levels || 2;
        var px = hand === "dx" ? db.x1 : db.x0, dpk = db.pk, fx0 = db.x0 + 6, fx1 = db.x1 - 6, sg = hand === "dx" ? 98.5 : -98.5;
        var Dt = Math.max(120, Math.min(320, (dp - 70) * 0.5)), zF1 = iz1 - 22, zF0 = zF1 - Dt;
        var bxa = hand === "dx" ? db.x1 + 6 : ix0 + 8, bxb = hand === "dx" ? ix1 - 8 : db.x0 - 6;     /* partea oarbă */
        var step = (hi - 70) / lev, fol = { rot: { x: px, z: db.z1, deg: sg }, follow: dpk };
        for (var l = 0; l < lev; l++) {
          var y = iy0 + 30 + l * step;
          if (dr.split) {
            /* coș din față (merge cu ușa) + coș din spate (alunecă înainte) */
            tray(fx0, fx1, y, 40, zF0, zF1, ++pk, C("ftray", fol)).forEach(function (b) { out.push(b); });
            if (bxb - bxa > 40) { var zR0 = iz0 + 22, zR1 = zR0 + Dt; tray(bxa, bxb, y, 40, zR0, zR1, ++pk, C("rear", { dz: Math.max(0, zF0 - 8 - zR1) })).forEach(function (b) { out.push(b); }); }
          } else {
            /* tavă reniformă dintr-o bucată (merge cu ușa): partea din fața deschiderii + partea din spatele părții oarbe, ca un L */
            var zM = zF0 + Dt * 0.55, pts = hand === "dx"
              ? [[fx0, zF0], [bxb, zF0], [bxb, zM], [fx1, zM], [fx1, zF1], [fx0, zF1]]
              : [[bxa, zF0], [fx1, zF0], [fx1, zF1], [fx0, zF1], [fx0, zM], [bxa, zM]];
            out.push(poly(pts, y, y + 8, ++pk, C("tray", fol)));
          }
        }
        out.push(rect((hand === "dx" ? db.x1 - 18 : db.x0 + 6), (hand === "dx" ? db.x1 - 6 : db.x0 + 18), iy0 + 6, iy1 - 6, iz1 - 36, iz1 - 24, ++pk, C("axle", fol)));
        note("blindfront");
      }
    }
    else if (K === "carousel") {
      var R0 = (sz.dia || Math.min(wi, dp) - 12) / 2, Rr = Math.min(R0, Math.min(wi, dp) / 2 - 2), cx = (ix0 + ix1) / 2, cz = (iz0 + iz1) / 2;
      var span = dr.shape === "12" ? Math.PI : Math.PI * 1.5;
      /* golul sectorului privește spre față, de partea aleasă */
      var wedgeMid = hand === "dx" ? Math.PI / 4 : Math.PI * 3 / 4, a0 = wedgeMid + (2 * Math.PI - span) / 2;
      lev = dr.shelves || 2;
      var an2 = { rot: { x: cx, z: cz, deg: 120 } }, stepC = (hi - 60) / lev;
      for (var q = 0; q < lev; q++) { var yq = iy0 + 25 + q * stepC; out.push(poly(sector(cx, cz, Rr, a0, span, 28), yq, yq + 8, ++pk, C("shelf", an2))); }
      out.push(poly(circle(cx, cz, 14, 10), iy0 + 4, iy1 - 4, ++pk, C("axle", an2)));
      info.dia = rnd(Rr * 2);
      if (!sz.dia) note("sch");
    }
    else if (K === "cdrawer") {
      var NL = sz.depth || dp, bd = Math.min(NL, dp - 24), mid = (ix0 + ix1) / 2, tv = Math.max(60, bd * 0.8);
      [[ix0 + 8, mid - 4], [mid + 4, ix1 - 8]].forEach(function (xr) { var p2 = ++pk; tray(xr[0], xr[1], iy0 + 25, 100, iz1 - 18 - bd, iz1 - 18, p2, C("drawer", { dz: tv })).forEach(function (b) { out.push(b); }); });
      retag("Fronte estraibile", { dz: tv });
      note("cdrawer");
    }
    else if (K === "pullout" || K === "tall") {
      var n = (band && band.n) || dr.levels || (K === "tall" ? 4 : 2);
      if (!band && K === "tall" && dr.levels) n = dr.levels;
      var bw2 = Math.min(sz.basketW || dr.basketW || (wi - 36), wi - 4), bd2 = Math.min(dr.basketD || (dp - 60), dp - 40), bh = dr.basketH || 60;
      var bxx0 = (ix0 + ix1) / 2 - bw2 / 2, bxx1 = bxx0 + bw2, zq1 = iz1 - 30, zq0 = zq1 - bd2, gp = ++pk, tvl = Math.max(60, bd2 - 20), frame = { dz: tvl };
      var stepP = (hi - 80 - bh) / Math.max(1, n - 1);
      for (var m = 0; m < n; m++) { var ym = iy0 + 30 + m * (n > 1 ? stepP : 0); tray(bxx0, bxx1, ym, Math.min(bh, 50), zq0, zq1, gp, C("basket", frame)).forEach(function (b) { out.push(b); }); }
      out.push(rect(bxx0, bxx0 + 5, iy0 + 12, iy1 - 30, zq1 - 24, zq1, gp, C("basket", frame)), rect(bxx1 - 5, bxx1, iy0 + 12, iy1 - 30, zq1 - 24, zq1, gp, C("basket", frame)));
      info.n = n; info.basketW = rnd(bw2);
      if (u.front === "frame") retag("Fronte estraibile", frame);
      else if (u.front === "hinged") note("hingedfront");
      if (!sz.basketW && !dr.basketW) note("sch");
    }
    else if (K === "pulldown") {
      var nb = dr.baskets || 3, bw3 = Math.min(wi - 36, sz.wi && sz.wi[0] != null ? sz.wi[0] - 2 : wi - 36), bd3 = Math.max(100, Math.min(dp - 50, sz.depth != null ? Math.max(sz.depth - 22, 100) : dp - 60));
      var cxm = (ix0 + ix1) / 2, tp = sz.travel != null ? sz.travel : Math.round(hi * 0.5), gp3 = ++pk, an3 = { dy: -tp, dz: bd3 + 10 };
      var step3 = (hi - 90) / Math.max(1, nb - 1);
      for (var z = 0; z < nb; z++) { var yz = iy0 + 30 + z * step3; tray(cxm - bw3 / 2, cxm + bw3 / 2, yz, 40, iz1 - 30 - bd3, iz1 - 30, gp3, C("basket", an3)).forEach(function (b) { out.push(b); }); }
      out.push(rect(cxm - bw3 / 2 - 5, cxm - bw3 / 2, iy0 + 14, iy1 - 30, iz1 - 54, iz1 - 30, gp3, C("basket", an3)), rect(cxm + bw3 / 2, cxm + bw3 / 2 + 5, iy0 + 14, iy1 - 30, iz1 - 54, iz1 - 30, gp3, C("basket", an3)));
      info.travel = tp;
      if (sz.travel == null) note("sch");
    }
    else if (K === "spin") {
      var sp = ft.info.spin, S = ft.size || {};
      if (sp) {
        var Bq = sp.B, cx5 = (ix0 + ix1) / 2, cz5 = (iz0 + iz1) / 2, h5 = Bq / 2, an5 = { rot: { x: cx5, z: cz5, deg: 90 } }, yb = iy0 + S.fitH, yt = iy1 - S.fitH, tb = sp.bottomSpin || 19, tt = (u.limits && u.limits.topSpin) || 16, tp5 = (u.limits && u.limits.panelSpin) || 16;
        out.push(rect(cx5 - S.fit / 2, cx5 + S.fit / 2, iy0 + 1, yb, cz5 - S.fit / 2, cz5 + S.fit / 2, ++pk, C("fitting")));
        out.push(rect(cx5 - S.fit / 2, cx5 + S.fit / 2, yt, iy1 - 1, cz5 - S.fit / 2, cz5 + S.fit / 2, ++pk, C("fitting")));
        out.push(rect(cx5 - h5, cx5 + h5, yb, yb + tb, cz5 - h5, cz5 + h5, ++pk, C("spin", an5)));
        out.push(rect(cx5 - h5, cx5 + h5, yt - tt, yt, cz5 - h5, cz5 + h5, ++pk, C("spin", an5)));
        out.push(rect(cx5 - h5, cx5 - h5 + tp5, yb + tb, yt - tt, cz5 - h5, cz5 + h5, ++pk, C("spin", an5)));
        out.push(rect(cx5 + h5 - tp5, cx5 + h5, yb + tb, yt - tt, cz5 - h5, cz5 + h5, ++pk, C("spin", an5)));
        out.push(rect(cx5 - h5 + tp5, cx5 + h5 - tp5, yb + tb, yt - tt, cz5 + h5 - tp5, cz5 + h5, ++pk, C("spin", an5)));
        info.spin = { B: sp.B, H: rnd(sp.H), gap: sp.gap, bottom: tb };
      }
      note("spinnodrill");
    }
    else if (K === "turntable") {
      var tw = sz.w, td = sz.d, th = sz.h, cx6 = (ix0 + ix1) / 2, cz6 = (iz0 + iz1) / 2, y6 = I.shelves.length ? I.shelves[0] : iy0;
      var ww = Math.min(tw, wi - 4), dd = Math.min(td, dp - 4), canRot = wi >= tw + 2 && dp >= tw + 4 && wi >= td + 2;
      out.push(rect(cx6 - ww / 2, cx6 + ww / 2, y6, y6 + th, cz6 - dd / 2, cz6 + dd / 2, ++pk, C("plate", canRot ? { rot: { x: cx6, z: cz6, deg: 90 } } : null)));
      note("sch");
    }
    else if (K === "tvlift") {
      var T = sz.travel, cx7 = (ix0 + ix1) / 2, zc = iz0 + 12, hs = T / 3 + 30, y7 = iy0 + 6;
      out.push(rect(cx7 - 40, cx7 + 40, y7, y7 + hs, zc, zc + 30, ++pk, C("column")));
      out.push(rect(cx7 - 34, cx7 + 34, y7, y7 + hs, zc + 32, zc + 62, ++pk, C("column", { dy: T / 3 })));
      out.push(rect(cx7 - 28, cx7 + 28, y7, y7 + hs, zc + 64, zc + 94, ++pk, C("column", { dy: 2 * T / 3 })));
      var vw = dr.vesa ? Math.min(dr.vesa[0], wi - 20) : Math.min(300, wi - 20), vh = dr.vesa ? dr.vesa[1] : (dr.screenH ? Math.min(dr.screenH, 300) : 300);
      out.push(rect(cx7 - vw / 2, cx7 + vw / 2, y7, y7 + vh, zc + 96, zc + 108, ++pk, C("carriage", { dy: T })));
      info.travel = T; note("sch");
    }
    else if (K === "wardlift") {
      var dyw = -Math.round(hi * 0.4), dzw = Math.round(Math.min(dp * 0.35, 200)), an8 = { dy: dyw, dz: dzw }, yR = iy1 - 70, cz8 = iz0 + dp * 0.5 - 12;
      var pw = ++pk;
      out.push(rect(ix0 + 10, ix1 - 10, yR, yR + 25, cz8, cz8 + 25, pw, C("rail", an8)));
      out.push(rect(ix0 + 2, ix0 + 14, yR + 25, iy1 - 8, cz8, cz8 + 25, pw, C("rail", an8)), rect(ix1 - 14, ix1 - 2, yR + 25, iy1 - 8, cz8, cz8 + 25, pw, C("rail", an8)));
      note("sch");
    }
    else if (K === "bracket") {
      var fb = doors[0];
      if (fb) {
        var flap = { hx: { y: fb.y0, z: fb.z1, deg: 90 } };
        doorRows.forEach(function (r) { r.elemento = r.elemento.replace(/^Anta/, "Piano ribaltabile"); });
        fb.sub = "flap"; delete fb.hinge; fb.cu = C("flap", flap);
        /* două plăci de balama pe fața ușii, rigide cu ea (poziția reală a consolelor nu e dată în surse) */
        [[fb.x0 + 10, fb.x0 + 60], [fb.x1 - 60, fb.x1 - 10]].forEach(function (xr) { out.push(rect(xr[0], xr[1], fb.y0, fb.y0 + 30, fb.z1, fb.z1 + 4, ++pk, C("hingeplate", flap))); });
        info.flap = { w: Math.round(fb.x1 - fb.x0), d: Math.round(fb.y1 - fb.y0) };
      }
      note("sch");
    }
    out.forEach(function (b) { boxes.push(b); });
    built.cu = info;
    return built;
  }

  function bom(cfg) {
    var u = unitOf(cfg); if (!u || !supported(cfg)) return null;
    var f = forceOf(u), fr = (f.doors != null ? f.doors : (+cfg.doors || 0));
    return { id: u.key, n: 1, fronts: u.front === "frame" || u.kind === "cdrawer" ? Math.max(1, fr) : 0 };
  }

  return { unitOf: unitOf, supported: supported, prep: prep, apply: apply, bom: bom, forceOf: forceOf, interior: interior, PK0: PK0 };
});
