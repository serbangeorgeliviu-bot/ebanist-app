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
      if (cam) out.push(cyl("__hw", w, along(w, h.dir.ax, -h.dir.side * cam.op.depth), cam.op.dia, "cam", [cam.op.id]));
      /* bolțul: filetul în F (adâncimea găurii din F) și tija prin E până la axa corpului (adâncimea găurii din muchia lui E) */
      if (shank) {
        var e = h.edge;     // gaura din F poate lipsi: unită cu a altui conector într-una trecută; atunci cotele vin din catalog
        out.push(cyl("__hw", along(e, h.eAx, h.eSide * (bolt ? seat(bolt.op, D.minifix.bolt_depth) : D.minifix.bolt_depth)), along(e, h.eAx, -h.eSide * shank.op.depth),
          bolt ? bolt.op.dia : D.minifix.bolt_dia, "bolt", bolt ? [bolt.op.id, shank.op.id] : [shank.op.id]));
      }
    } else if (h.type === "tassello") {
      /* tasel: un singur cilindru care umple ambele găuri (în F și în E) */
      var holes = ops.filter(function (x) { return x.op.type === "drill"; });
      var inF = holes.filter(function (x) { return String(x.pk) === String(h.against); })[0], inE = holes.filter(function (x) { return String(x.pk) === String(h.piece); })[0];
      if (inE) out.push(cyl("__wooddowel", along(w, h.eAx, h.eSide * (inF ? seat(inF.op, D.dowel.face_depth) : D.dowel.face_depth)), along(w, h.eAx, -h.eSide * seat(inE.op, D.dowel.len - D.dowel.face_depth)),
        inE.op.dia, "dowel", inF ? [inF.op.id, inE.op.id] : [inE.op.id]));
    } else if (h.type === "confirmat") {
      /* șurub 7×50: capul pe fața exterioară a lui F, tija intră în muchia lui E */
      var J = D.joints.confirmat, ext = ctx.thickF > 0 ? ctx.thickF : 19, L = J.screw_len;
      var hd = along(w, h.eAx, h.eSide * ext), tip = along(w, h.eAx, -h.eSide * (L - ext));
      var src = ops.map(function (x) { return x.op.id; });
      out.push(cyl("__brass", hd, tip, J.through_dia, "shank", src));
      out.push(cyl("__brass", hd, along(hd, h.eAx, h.eSide * J.head_h), J.head_dia, "head", src));
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
        out.push(box(mat, lo, hi, "body", [sF.op.id, sE.op.id]));
      }
    }
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

  return { connectorShapes: connectorShapes, opsByHw: opsByHw, TYPES: ["minifix", "tassello", "confirmat", "biscuit", "domino", "clamex"] };
});
