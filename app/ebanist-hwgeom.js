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
    } else if (h.type === "biscuit" || h.type === "domino" || h.type === "clamex") {
      /* conector în două canale: cel din F (adâncimea lui) și cel din E; lungimea și grosimea corpului din HW_DRILL.joints[..].body */
      var K = D.joints[h.type], slots = ops.filter(function (x) { return x.op.type === "slot"; });
      var sF = slots.filter(function (x) { return String(x.pk) === String(h.against); })[0], sE = slots.filter(function (x) { return String(x.pk) === String(h.piece); })[0];
      if (sF && sE) {
        var lo = w.slice(), hi = w.slice();
        var e0 = w[h.eAx] + h.eSide * sF.op.depth, e1 = w[h.eAx] - h.eSide * sE.op.depth;
        lo[h.eAx] = Math.min(e0, e1); hi[h.eAx] = Math.max(e0, e1);
        lo[h.sAx] = w[h.sAx] - K.body.len / 2; hi[h.sAx] = w[h.sAx] + K.body.len / 2;
        lo[h.camAx] = w[h.camAx] - K.body.thk / 2; hi[h.camAx] = w[h.camAx] + K.body.thk / 2;
        var mat = { biscuit: "__wooddowel", domino: "__domino", clamex: "__nylongrey" }[h.type];
        if (h.type === "clamex") {
          /* Clamex P-14: două părți (cea din F și cea din E) cu un joc de 0,3 mm la planul îmbinării, muchii rotunjite */
          var mid = w[h.eAx], lo1 = lo.slice(), hi1 = hi.slice(), lo2 = lo.slice(), hi2 = hi.slice();
          if (h.eSide > 0) { lo1[h.eAx] = mid + 0.15; hi1[h.eAx] = hi[h.eAx]; lo2[h.eAx] = lo[h.eAx]; hi2[h.eAx] = mid - 0.15; }
          else { lo1[h.eAx] = lo[h.eAx]; hi1[h.eAx] = mid - 0.15; lo2[h.eAx] = mid + 0.15; hi2[h.eAx] = hi[h.eAx]; }
          var pa = box("__nylongrey", lo1, hi1, "bodyF", [sF.op.id]), pb = box("__nylon", lo2, hi2, "bodyE", [sE.op.id]);
          pa.r = 1.1; pb.r = 1.1; out.push(pa, pb);
        } else {
          var bd = box(mat, lo, hi, "body", [sF.op.id, sE.op.id]);
          bd.r = h.type === "biscuit" ? K.body.thk * 0.45 : 1.2;    // lamela e aproape un oval, Domino are muchii rotunjite
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


  /* Brațul balamalei Blum CLIP top, ca tablă îndoită în U (fișa 71B3590, forma neverificată pe piesă).
     Profilul e în planul (z, xo): xo = distanța de la fața lateralului. `outer` = pereții laterali (două plăci subțiri),
     `skin` = capacul de sus (bandă de grosime `t`). Fără THREE: viewer3d.js le extrudează. */
  function hingeArm(zNear, inset, t) {
    t = t == null ? 1.3 : t;
    var top = inset ? 27 : 23, zFar = zNear - 56;
    var up = [[zNear, top - 3], [zNear - 3, top], [zFar + 18, 16], [zFar, 13]];
    var outer = [[zFar, 3], [zNear, 3]].concat(up);
    var skin = up.concat(up.slice().reverse().map(function (q) { return [q[0], q[1] - t]; }));
    return { outer: outer, skin: skin, zFar: zFar, t: t };
  }

  /* Cele patru articulații ale patrulaterului balamalei (două legături). a = pe cupa din ușă (se rotește cu ea),
     b = pe braț (rămân pe lateral). xo(d) = fața lateralului + sd·d. Coordonatele în mm, ca restul. */
  function hingeLinks(w, sd, zNear, p0, z0) {
    var y = w[1], xo = function (d) { return p0 + sd * d; };
    return { a: [[w[0] - sd * 2, y, z0 - 5], [w[0] + sd * 6, y, z0 - 10]],
             b: [[xo(14), y, zNear - 1], [xo(10), y, zNear - 9]], h: 9.5, th: 1.6 };
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

  return { screwProfile: screwProfile, slideScrews: slideScrews, hingeDims: hingeDims, hingeArm: hingeArm, hingeLinks: hingeLinks, connectorShapes: connectorShapes, opsByHw: opsByHw, TYPES: ["minifix", "tassello", "confirmat", "biscuit", "domino", "clamex", "reggipiano"] };
});
