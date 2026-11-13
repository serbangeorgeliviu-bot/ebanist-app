/* Ebanist — forma 3D a conectorilor, din ACELEAȘI date ca găurile și canalele (D-61, D-48).
 *
 * Partea PURĂ: fără THREE, fără DOM. Primește un conector (`h`, din generateOperations().hw),
 * operațiile lui (găuri și canale, legate prin `hw`) și datele HW_DRILL; întoarce o listă de
 * primitive (cilindri, cutii) în milimetri, pe care vizorul (viewer3d.js) le transformă în
 * mesh-uri. Așa 3D-ul și desenul tehnic (fișa piesei) nu pot diverge: cota unei forme e cota
 * găurii în care stă, nu un număr scris a doua oară în vizor.
 *
 * Etapa 1 (01.11.2026): Minifix, tasel, Confirmat, lamelă, Domino, Clamex. Restul feroneriei
 * (balamale, glisiere, suporturi, mânere, picioare) urmează, tot din date.
 *
 * Primitivă: { t:"cyl", mat, a:[x,y,z], b:[x,y,z], d, role, src }  sau
 *            { t:"box", mat, lo:[…], hi:[…], role, src }
 * `src` = id-urile operațiilor în care stă forma (verificat în test/hwgeom.test.js).
 *
 * Gira nel browser (<script src>) e in Node (require via vm).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EBHwGeom = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function along(p, ax, d) { var q = p.slice(); q[ax] += d; return q; }
  function cyl(mat, a, b, d, role, src) { return { t: "cyl", mat: mat, a: a, b: b, d: d, role: role, src: src || [] }; }
  function box(mat, lo, hi, role, src) { return { t: "box", mat: mat, lo: lo, hi: hi, role: role, src: src || [] }; }
  /* Profil de șurub/bolț de la capul `a` (y=0) la vârf (y=len), în mm, pentru o piesă rotită: cap cu teșitură, gât conic,
     zonă filetată din zigzag și vârf conic. Realism, nu cotă din catalog (forma filetului nu e verificată pe piesă). */
  function screwProfile(o) {
    var sr = o.shaft / 2, hr = o.head / 2, hh = o.headH, len = o.len, tip = o.tip == null ? 2.5 : o.tip, p = [[0, 0], [Math.max(hr - 0.5, 0.1), 0], [hr, 0.5], [hr, hh]];
    p.push([sr + 0.15, hh + (o.cone == null ? 1.5 : o.cone)]);
    if (o.thread) {
      var t = o.thread, r1 = sr + (t.depth == null ? 0.45 : t.depth), step = t.pitch / 2;
      var y0 = Math.max(t.from, hh + (o.cone == null ? 1.5 : o.cone) + 0.1), y1 = Math.min(t.to, len - tip), up = true;
      p.push([sr, y0]);
      for (var y = y0 + step; y < y1; y += step, up = !up) p.push([up ? r1 : sr, y]);
      p.push([sr, y1]);
    }
    if (!o.thread || p[p.length - 1][1] < len - tip) p.push([sr, len - tip]);
    p.push([Math.max(sr * 0.35, 0.3), len], [0, len]);
    return p;
  }
  function lathe(mat, a, b, profile, d, role, src) { return { t: "lathe", mat: mat, a: a, b: b, profile: profile, d: d, role: role, src: src || [] }; }
  function byNote(list, re) { return list.filter(function (x) { return re.test(x.op.note || ""); }); }
  /* două găuri opuse în același punct (un tasel din fiecare parte a unui perete) se unesc în ops într-o singură gaură
     trecută; adâncimea ei e grosimea plăcii, nu cât intră fiecare piesă. Atunci forma ia adâncimea din date. */
  function seat(op, catalogDepth) { return op.through ? catalogDepth : op.depth; }

  /* datele unui conector: familia (HW_DRILL.joints[tip]) cu varianta din catalog peste ea (D-134) */
  function jointK(D, h) {
    var base = D.joints[h.type] || {}, v = (D.joints.variants || {})[h.catalog] || {}, o = {}, k;
    for (k in base) o[k] = base[k];
    for (k in v) o[k] = v[k];
    return o;
  }

  /* ops: [{ pk, op }] — operațiile conectorului (după `hw`), cu piesa în care stau.
     ctx: { thickF } — grosimea piesei F pe direcția conectorului (pentru Confirmat). */
  function connectorShapes(h, ops, D, ctx) {
    ops = ops || []; ctx = ctx || {};
    var out = [], w = h.w;
    if (h.type === "minifix") {
      var cam = byNote(ops, /eccentrico/)[0], bolt = byNote(ops, /perno/)[0], shank = byNote(ops, /gambo/)[0];
      /* corpul: cilindrul exact cât gaura de pe fața lui E (diametru și adâncime din operație) */
      if (cam) {
        var cc = cyl("__zinc", w, along(w, h.dir.ax, -h.dir.side * cam.op.depth), cam.op.dia, "cam", [cam.op.id]);
        cc.ch = 0.7; out.push(cc);
        /* fanta de șurubelniță pe fața corpului (PZ2 + fantă, aici fanta), în lungul muchiei îmbinării */
        var sl = w.slice(), sl2 = w.slice(), t3 = [0, 1, 2].filter(function (i) { return i !== h.dir.ax && i !== h.eAx; })[0], sdn = h.dir.side;
        sl[h.eAx] -= cam.op.dia * 0.42; sl2[h.eAx] += cam.op.dia * 0.42; sl[t3] -= 0.8; sl2[t3] += 0.8;
        sl[h.dir.ax] += sdn * 0.03; sl2[h.dir.ax] -= sdn * 1.0;
        out.push(box("__flushdark", [Math.min(sl[0], sl2[0]), Math.min(sl[1], sl2[1]), Math.min(sl[2], sl2[2])], [Math.max(sl[0], sl2[0]), Math.max(sl[1], sl2[1]), Math.max(sl[2], sl2[2])], "slot", [cam.op.id]));
      }
      /* bolțul: filetul în F (adâncimea găurii din F) și tija prin E până la axa corpului (adâncimea găurii din muchia lui E) */
      if (shank) {
        var e = h.edge;     // gaura din F poate lipsi: unită cu a altui conector într-una trecută; atunci cotele vin din catalog
        var thr = bolt ? seat(bolt.op, D.minifix.bolt_depth) : D.minifix.bolt_depth, blen = thr + shank.op.depth, bd = bolt ? bolt.op.dia : D.minifix.bolt_dia;
        /* de la capul din E (y=0) la filetul din F: gât Ø bolț, cap Ø7 × 5, filet pe lungimea găurii din F */
        out.push(lathe("__zinc", along(e, h.eAx, -h.eSide * shank.op.depth), along(e, h.eAx, h.eSide * thr),
          screwProfile({ len: blen, shaft: bd, head: 7, headH: 5, cone: 1.2, thread: { pitch: 1, from: blen - thr, to: blen }, tip: 1.2 }), bd, "bolt", bolt ? [bolt.op.id, shank.op.id] : [shank.op.id]));
      }
    } else if (h.type === "reggipiano") {
      /* suport de raft Ø5: tija intră cât gaura (adâncimea din ops), iese `out`, plăcuța sub raft din HW_DRILL.pin.plate */
      var sw = h.seat === undefined ? w : h.seat;         // poziția găurii în care stă suportul; null = nicio gaură liberă, deci nimic de desenat
      if (sw) {
        var pin = ops.filter(function (x) { return x.op.type === "drill" && /reggipiano/.test(x.op.note || "") && x.op._w && Math.abs(x.op._w[1] - sw[1]) < 0.05 && Math.abs(x.op._w[2] - sw[2]) < 0.05; })[0];
        var sd = h.dir.side, ax = h.dir.ax, Pn = D.pin;
        var depth = pin ? seat(pin.op, Pn.depth) : Pn.depth, dia = pin ? pin.op.dia : Pn.dia, src = pin ? [pin.op.id] : [];
        var pn = cyl("__hw", along(sw, ax, -sd * depth), along(sw, ax, sd * Pn.out), dia, "pin", src); pn.ch = 0.6; out.push(pn);
        var x0 = sw[0] + sd * Pn.plate.from, x1 = sw[0] + sd * Pn.plate.to;
        out.push(box("__hw", [Math.min(x0, x1), sw[1] + Pn.plate.y0, sw[2] - Pn.plate.zhalf], [Math.max(x0, x1), sw[1] + Pn.plate.y1, sw[2] + Pn.plate.zhalf], "plate", src));
      }
    } else if (h.type === "tassello") {
      /* tasel: un singur cilindru care umple ambele găuri (în F și în E) */
      var holes = ops.filter(function (x) { return x.op.type === "drill"; });
      var inF = holes.filter(function (x) { return String(x.pk) === String(h.against); })[0], inE = holes.filter(function (x) { return String(x.pk) === String(h.piece); })[0];
      if (inE) {
        var dw = cyl("__wooddowel", along(w, h.eAx, h.eSide * (inF ? seat(inF.op, D.dowel.face_depth) : D.dowel.face_depth)), along(w, h.eAx, -h.eSide * seat(inE.op, D.dowel.len - D.dowel.face_depth)),
          inE.op.dia, "dowel", inF ? [inF.op.id, inE.op.id] : [inE.op.id]);
        dw.ch = 1; out.push(dw);       // capete teșite, ca la un tasel real
      }
    } else if (h.type === "confirmat") {
      /* șurub 7×50: capul pe fața exterioară a lui F, tija intră în muchia lui E */
      var J = D.joints.confirmat, ext = ctx.thickF > 0 ? ctx.thickF : 19, L = J.screw_len;
      var hd = along(w, h.eAx, h.eSide * ext), tip = along(w, h.eAx, -h.eSide * (L - ext)), top = along(hd, h.eAx, h.eSide * J.head_h);
      var src = ops.map(function (x) { return x.op.id; });
      /* de la capul exterior (y=0) la vârf: cap Ø10,5 × 3,5, tijă Ø7 cu filet pe ultimii 38 mm, vârf conic */
      out.push(lathe("__brass", top, tip, screwProfile({ len: J.head_h + L, shaft: J.through_dia, head: J.head_dia, headH: J.head_h, cone: 2, thread: { pitch: 2.6, from: J.head_h + 12, to: J.head_h + L, depth: 0.7 }, tip: 3 }), J.through_dia, "screw", src));
      var sk = cyl("__flushdark", along(top, h.eAx, h.eSide * 0.03), along(top, h.eAx, -h.eSide * 1.2), 4.4, "socket", src); sk.ch = 0; out.push(sk);   // locașul hexagonal (aici rotund)
    } else if (h.type === "divario") {
      /* Divario P-18: elementul din canalul lui F (58 × 16 × 9,7: 8 mm în F, 8 mm în afara feței) și cei doi știfturi Ø 8 din găurile din muchia lui E */
      var KD = jointK(D, h), srcD = ops.map(function (x) { return x.op.id; }), dd = -h.eSide, edgeD = w[h.eAx];
      var lo4 = w.slice(), hi4 = w.slice(), f0 = edgeD - dd * KD.depth, f1 = edgeD + dd * (KD.body.w - KD.depth);
      lo4[h.eAx] = Math.min(f0, f1); hi4[h.eAx] = Math.max(f0, f1);
      lo4[h.sAx] = w[h.sAx] - KD.body.l / 2; hi4[h.sAx] = w[h.sAx] + KD.body.l / 2;
      lo4[h.camAx] = w[h.camAx] - KD.body.h / 2; hi4[h.camAx] = w[h.camAx] + KD.body.h / 2;
      var gb = box("__nylongrey", lo4, hi4, "grooveEl", srcD); gb.r = 1.2; out.push(gb);
      [-1, 1].forEach(function (k) { var pa = w.slice(), pb = w.slice(); pa[h.sAx] = pb[h.sAx] = w[h.sAx] + k * KD.hole_pitch / 2; pa[h.eAx] = edgeD + dd * 0.1; pb[h.eAx] = edgeD + dd * KD.hole_depth; out.push(cyl("__nylon", pa, pb, KD.hole_dia - 0.2, "peg", srcD)); });
    } else if (h.type === "cabineo") {
      /* Cabineo: elementul 33,8 × 16,5 × 10,8 în buzunar (la 5,4 mm de capătul lui E, adică centrat în cele trei găuri Ø 15) și șurubul Ø 5 care iese prin capăt în F */
      var K2 = jointK(D, h), L = K2.body.l, W = K2.body.w, H2 = K2.body.h, off0 = K2.from_end + (K2.dia + (K2.n - 1) * K2.step - L) / 2;
      var edgeE = w[h.eAx], dir = -h.eSide, lo2 = w.slice(), hi2 = w.slice();
      var a0 = edgeE + dir * off0, a1 = edgeE + dir * (off0 + L);
      lo2[h.eAx] = Math.min(a0, a1); hi2[h.eAx] = Math.max(a0, a1);
      lo2[h.sAx] = w[h.sAx] - W / 2; hi2[h.sAx] = w[h.sAx] + W / 2;
      lo2[h.camAx] = h.face; hi2[h.camAx] = h.face + H2;
      var srcC = ops.map(function (x) { return x.op.id; });
      var housing = box("__nylon", lo2, hi2, "body", srcC); housing.r = 1.6; out.push(housing);
      var sa = w.slice(), sb = w.slice(); sa[h.camAx] = sb[h.camAx] = h.face + K2.axis; sa[h.eAx] = edgeE + dir * off0; sb[h.eAx] = edgeE - dir * K2.scr_depth;
      out.push(cyl("__blackmetal", sa, sb, K2.scr_dia, "screw", srcC));
    } else if (h.type === "invis") {
      /* Invis Mx2: conectorul Ø 12 × 35 în muchia lui E și știftul Ø 12 × 30/14 în fața lui F, coaxiale */
      var K3 = jointK(D, h), srcI = ops.map(function (x) { return x.op.id; }), e0 = w[h.eAx], d3 = -h.eSide, ia = w.slice(), ib = w.slice(), ic = w.slice();
      ia[h.eAx] = e0 - d3 * 0.1; ib[h.eAx] = e0 + d3 * K3.e_len;
      out.push(cyl("__zinc", ia, ib, K3.dia - 0.4, "connector", srcI));
      ic[h.eAx] = e0 + d3 * 0.1; var id3 = w.slice(); id3[h.eAx] = e0 - d3 * K3.stud;
      out.push(cyl("__inox", ic, id3, K3.dia - 0.4, "stud", srcI));
    } else if (h.type === "kv") {
      /* conector Festool D8: cele cinci piese din STEP-ul oficial (EBFestoolD8), puse în cadrul conectorului: x spre piesa de bază (în E), y pe axa canalului, z spre fața bușonului.
         Ancora transversală și capacul urmăresc fața lui E: capul la nivelul feței, oricare ar fi grosimea (18–28 mm). */
      var ax = function (i, sgn) { var v = [0, 0, 0]; v[i] = sgn; return v; };
      var ex = ax(h.eAx, -h.eSide), ey = ax(h.sAx, 1), ez = ax(h.camAx, h.camSide || 1);
      var dzFace = (h.T || 19) / 2 - 9.1;
      var src = ops.map(function (x) { return x.op.id; });
      [["anchor", "__nylongrey", 0], ["bolt", "__zinc", 0], ["tray", "__nylongrey", 0], ["cross", "__zinc", dzFace], ["cap", "__nylon", dzFace]].forEach(function (q) {
        out.push({ t: "mesh", part: q[0], mat: q[1], o: w.slice(), ex: ex, ey: ey, ez: ez, dz: q[2], role: q[0], src: src });
      });
    } else if (h.type === "biscuit" || h.type === "domino" || h.type === "clamex" || h.type === "tenso" || h.type === "bisco") {
      /* conector în două canale: cel din F (adâncimea lui) și cel din E; lungimea, grosimea și înălțimea elementelor din HW_DRILL.joints
         (familia + varianta din catalog, D-134): fiecare element are cotele lui din broșura producătorului */
      var K = jointK(D, h), slots = ops.filter(function (x) { return x.op.type === "slot"; });
      var sF = slots.filter(function (x) { return String(x.pk) === String(h.against); })[0], sE = slots.filter(function (x) { return String(x.pk) === String(h.piece); })[0];
      if (sF && sE) {
        var mid = w[h.eAx], dF = sF.op.depth, dE = sE.op.depth, S = h.eSide;
        /* un element: de la planul îmbinării (cu jocul g) spre piesa lui, cu înălțimea hh pe axa îmbinării */
        var elem = function (mat, dir, depth, hh, len, thk, g, role, src) {
          var e0 = mid + dir * g, e1 = mid + dir * Math.min(g + hh, depth), lo = w.slice(), hi = w.slice();
          lo[h.eAx] = Math.min(e0, e1); hi[h.eAx] = Math.max(e0, e1);
          lo[h.sAx] = w[h.sAx] - len / 2; hi[h.sAx] = w[h.sAx] + len / 2;
          lo[h.camAx] = w[h.camAx] - thk / 2; hi[h.camAx] = w[h.camAx] + thk / 2;
          var bx = box(mat, lo, hi, role, src); bx.r = Math.min(1.1, thk * 0.2, hh * 0.2); return bx;
        };
        var bE = K.body, bF = K.body_f || K.body;
        if (h.type === "clamex" || h.type === "tenso") {
          /* două elemente cu un joc de 0,3 mm la planul îmbinării: cel din F și cel din E */
          var hE = bE.h || dE, hF = bF.h || dF;
          out.push(elem("__nylongrey", S, dF, hF, bF.len, bF.thk, 0.15, "bodyF", [sF.op.id]));
          out.push(elem("__nylon", -S, dE, hE, bE.len, bE.thk, 0.15, "bodyE", [sE.op.id]));
          if (h.type === "clamex") {
            /* pârghia de zinc a elementului din E (se vede prin orificiul Ø 6 de pe fața piesei) */
            var lc = w.slice(), lc2 = w.slice(); lc[h.eAx] = lc2[h.eAx] = mid - S * (0.15 + hE * 0.55);
            lc[h.camAx] = w[h.camAx] - bE.thk / 2 - 0.2; lc2[h.camAx] = w[h.camAx] + bE.thk / 2 + 0.2;
            lc[h.sAx] = lc2[h.sAx] = w[h.sAx] + bE.len * 0.28;
            out.push(cyl("__zinc", lc, lc2, 6.2, "lever", [sE.op.id]));
          } else {
            /* arcul de oțel al elementului Tenso (cel „cu arc"), pe fața dinspre canalul din F */
            var sp0 = w.slice(), sp1 = w.slice();
            sp0[h.eAx] = mid + S * 0.2; sp1[h.eAx] = mid + S * 0.6;
            sp0[h.sAx] = w[h.sAx] - bF.len * 0.3; sp1[h.sAx] = w[h.sAx] + bF.len * 0.3;
            sp0[h.camAx] = w[h.camAx] - bF.thk * 0.3; sp1[h.camAx] = w[h.camAx] + bF.thk * 0.3;
            out.push(box("__zinc", [0, 1, 2].map(function (i) { return Math.min(sp0[i], sp1[i]); }), [0, 1, 2].map(function (i) { return Math.max(sp0[i], sp1[i]); }), "spring", [sF.op.id]));
          }
        } else {
          var lo = w.slice(), hi = w.slice();
          lo[h.eAx] = Math.min(mid + S * dF, mid - S * dE); hi[h.eAx] = Math.max(mid + S * dF, mid - S * dE);
          lo[h.sAx] = w[h.sAx] - K.body.len / 2; hi[h.sAx] = w[h.sAx] + K.body.len / 2;
          lo[h.camAx] = w[h.camAx] - K.body.thk / 2; hi[h.camAx] = w[h.camAx] + K.body.thk / 2;
          var mat = { biscuit: "__wooddowel", domino: "__domino", bisco: "__nylon" }[h.type];
          var bd = box(mat, lo, hi, "body", [sF.op.id, sE.op.id]);
          bd.r = h.type === "biscuit" ? K.body.thk * 0.45 : h.type === "bisco" ? 1.3 : h.type === "domino" ? Math.min(K.body.thk * 0.48, 6) : 1.2;   // tenonul Domino e un oval plat: capetele late sunt semicirculare    // lamela e aproape un oval, Domino și Bisco au muchii rotunjite
          out.push(bd);
        }
      }
    }
    return out;
  }

  /* cotele balamalei care apar și în fișa de găurire: cupa (Ø și adâncime din operație), tasealele, găurile plăcuței.
     Forma corpului balamalei (flanșă, braț, amortizor) rămâne după fișa Blum 71B3590, neverificată pe piesă. */
  function hingeDims(h, ops, D) {
    ops = ops || [];
    var cup = byNote(ops, /tazza/)[0], H = h.type === "cerniera_pliante" ? D.fold : D.hinge;
    return { cupDia: cup ? cup.op.dia : H.cup_dia, cupDepth: cup ? cup.op.depth : (H.cup_depth || 12.5),
             dowelOffset: D.hinge.dowel_offset, dowelHalf: D.hinge.dowel_spacing / 2, plateHalf: H.plate_spacing / 2,
             plateDia: H.plate_dia, plateDepth: H.plate_depth, src: cup ? [cup.op.id] : [] };
  }


  /* Brațul balamalei Blum CLIP top BLUMOTION 110°, după desenul din broșura Blum (p. 4): corp masiv lung de 66,5 mm măsurat de la fața
     ușii (deci 50,5 mm de la începutul brațului), mai gros spre ușă și îngustat spre capăt, lat de 21 mm. Profilul e în planul (z, xo):
     xo = distanța de la fața lateralului. Fără THREE: viewer3d.js îl extrudează pe lățime. Forma exactă a brațului nu e în desen. */
  function hingeArm(zNear, inset, t) {
    var top = inset ? 27 : 23, zFar = zNear - 50.5;
    var up = [[zNear, top - 3], [zNear - 3, top], [zFar + 16, 15.5], [zFar, 13]];
    var outer = [[zFar, 3], [zNear, 3]].concat(up);
    var skin = up.concat(up.slice().reverse().map(function (q) { return [q[0], q[1] - (t == null ? 1.3 : t)]; }));
    return { outer: outer, skin: skin, zFar: zFar, width: 21, t: t == null ? 1.3 : t };
  }

  /* Gâtul îndoit dintre cupă (în ușă) și braț: o singură piesă groasă (17 mm pe înălțime, 5 mm în plan), cu articulația a pe cupă (se rotește cu ea) și b
     pe braț (rămâne pe lateral). xo(d) = fața lateralului + sd·d. Coordonatele în mm. */
  function hingeLinks(w, sd, zNear, p0, z0) {
    var y = w[1], xo = function (d) { return p0 + sd * d; };
    return { a: [[w[0] + sd * 0.5, y, z0 - 11]], b: [[xo(14), y, zNear - 2]], h: 17, th: 8 };
  }

  /* șuruburile glisierei: câte unul în fiecare gaură «guida cassetto» din fișa piesei (poziții din fișele Blum, Ø și adâncime din operație).
     Șina corpului stă pe fața panoului, cu placa de `plate` mm; capul șurubului e peste ea. */
  function slideScrews(h, ops, D, plate) {
    plate = plate == null ? 1.8 : plate;
    var sd = h.side < 0 ? 1 : -1, out = [];
    byNote(ops || [], /guida cassetto/).forEach(function (x) {
      var o = x.op; if (!o._w) return;
      var f = o._w, seatD = o.depth || D.slide.depth;
      out.push(cyl("__inox", along(f, 0, -sd * seatD), along(f, 0, sd * plate), o.dia, "screw", [o.id]));
      out.push(cyl("__inox", along(f, 0, sd * plate), along(f, 0, sd * (plate + D.slide.head_h)), D.slide.head_dia, "head", [o.id]));
    });
    return out;
  }

  /* operațiile unui model, grupate după conectorul din care fac parte (`hw`) */
  function opsByHw(pieces) {
    var map = {};
    (pieces || []).forEach(function (pc) {
      (pc.operations || []).forEach(function (op) { if (op.hw) (map[op.hw] = map[op.hw] || []).push({ pk: pc.pk, op: op }); });
    });
    return map;
  }

  return { screwProfile: screwProfile, slideScrews: slideScrews, hingeDims: hingeDims, hingeArm: hingeArm, hingeLinks: hingeLinks, connectorShapes: connectorShapes, opsByHw: opsByHw, jointK: jointK, TYPES: ["minifix", "tassello", "confirmat", "biscuit", "domino", "clamex", "tenso", "bisco", "kv", "cabineo", "invis", "divario", "reggipiano"] };
});
