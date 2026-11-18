/* ebanist-piececode.js — codul QR al piesei, fără comandă și fără cont (pur, fără DOM; 5.85.0, D-160).
   Datele piesei stau în cod, nu pe server: cote, material, cant, găuri și canale. Se deschide din camera telefonului la
   https://ebanist.com/app/#p=… (fragmentul nu pleacă spre niciun server) și arată fișa piesei, în aplicație, fără autentificare.
   Plafon de dimensiune: peste 450 de caractere codul devine prea dens pentru o etichetă mică, deci se trece la „numai antetul"
   (cote, material, cant) cu numărul operațiilor lăsate pe dinafară, scris în cod. Ce nu se poate scrie compact (contururi, frezări,
   canale de lamelă) se numără ca „omise": nu se inventează și nu se rotunjește mai mult de 0,1 mm.
   Format v1: `1~proiect~modul~element~material~cant~buc~n~rol~L~l~g~note~ops~omise`, textele cu encodeURIComponent; note separate prin `_`.
   Operațiile, separate prin `;`, găurile cu același profil într-o singură grupă (un rând de sistem 32 = un antet și pozițiile lui):
   `d<față>,<Ø>,<adânc>,<trecut 0/1>,<notă>:<a>/<b>,<a>/<b>,…` (a,b = x,y pe fețele 5/6, u,z pe canturi; `<notă>` = indice în lista de note, gol = fără)
   și canalele `g<față>,<lățime>,<adânc>,<notă>:<x1>/<y1>/<x2>/<y2>,…`. */
(function (root) {
  "use strict";
  var BASE = "https://ebanist.com/app/#p=", MAX = 450, V = "1";   /* 450 de caractere ≈ QR v14 (73 de module): ~21 mm pe etichetă la 0,28 mm pe modul */
  var r1 = function (v) { return Math.round(+v * 10) / 10; };
  /* encodeURIComponent lasă `~` și `_` neschimbate, iar ele sunt separatori aici */
  var enc = function (s) { return encodeURIComponent(String(s == null ? "" : s).replace(/[\r\n]+/g, " ").trim().slice(0, 80)).replace(/~/g, "%7E").replace(/_/g, "%5F"); };
  var dec = function (s) { try { return decodeURIComponent(s); } catch (e) { return ""; } };
  var num = function (s, lo, hi, def) { var v = parseFloat(s); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };

  function opsOf(pc) {
    var notes = [], idx = {}, groups = {}, order = [], omitted = 0;
    function nid(n) { n = String(n || "").slice(0, 40); if (!n) return ""; if (idx[n] == null) { idx[n] = notes.length; notes.push(n); } return idx[n]; }
    function add(head, pos) { if (!groups[head]) { groups[head] = []; order.push(head); } groups[head].push(pos); }
    ((pc && pc.operations) || []).forEach(function (o) {
      if (o.type === "drill" && isFinite(+o.dia) && isFinite(+o.depth)) {
        var edge = o.face < 5, a = edge ? o.u : o.x, b = edge ? o.z : o.y;
        if (!isFinite(+a) || !isFinite(+b)) { omitted++; return; }
        add("d" + [o.face, r1(o.dia), r1(o.depth), o.through ? 1 : 0, nid(o.note)].join(","), r1(a) + "/" + r1(b));
      } else if (o.type === "groove" && o.from && o.to && isFinite(+o.width) && isFinite(+o.depth)) {
        add("g" + [o.face, r1(o.width), r1(o.depth), nid(o.note)].join(","), [r1(o.from.x), r1(o.from.y), r1(o.to.x), r1(o.to.y)].join("/"));
      } else omitted++;
    });
    var n = 0; order.forEach(function (h) { n += groups[h].length; });
    return { ops: order.map(function (h) { return h + ":" + groups[h].join(","); }), count: n, notes: notes, omitted: omitted };
  }

  /* `piece` = rândul din distinctă (modulo, elemento, material, bordo, pz); `pc` = piesa fizică din Modelul de Operații; `ctx` = {project, n}
     → { url, mode: "full" | "head", omitted } */
  function encode(piece, pc, ctx) {
    ctx = ctx || {};
    var o = opsOf(pc);
    function build(withOps) {
      var f = [V, enc(ctx.project), enc(piece.modulo), enc(piece.elemento), enc(piece.materiale || piece.material), enc(piece.bordo), +piece.pz || 1,
        ctx.n == null ? "" : ctx.n, enc(pc.role), r1(pc.length), r1(pc.width), r1(pc.thickness), o.notes.map(enc).join("_"),
        withOps ? o.ops.join(";") : "", withOps ? o.omitted : o.omitted + o.count];
      return BASE + f.join("~");
    }
    var full = build(true);
    if (full.length <= MAX) return { url: full, mode: "full", omitted: o.omitted };
    return { url: build(false), mode: "head", omitted: o.omitted + o.count };
  }

  /* text (URL întreg, `#p=…` sau `p=…`) → modelul pe care îl așteaptă openPartSheet, sau null */
  function parse(text) {
    var m = /(?:^|[#&?])p=(1~[^\s#&]*)$/.exec(String(text == null ? "" : text).trim());
    if (!m) return null;
    var f = m[1].split("~");
    if (f.length !== 15 || f[0] !== V) return null;
    if (!(parseFloat(f[9]) > 0 && parseFloat(f[10]) > 0 && parseFloat(f[11]) > 0)) return null;     // fără cote nu e o piesă
    var L = num(f[9], 1, 10000, 0), W = num(f[10], 1, 10000, 0), T = num(f[11], 0.1, 500, 0);
    var notes = f[12] ? f[12].split("_").map(dec) : [], ops = [];
    (f[13] ? f[13].split(";") : []).forEach(function (s) {
      var c = s.indexOf(":"); if (c < 2) return;
      var k = s.charAt(0), h = s.slice(1, c).split(","), fc = parseInt(h[0], 10);
      if (!(fc >= 1 && fc <= 6) || (k !== "d" && k !== "g")) return;
      var nt = function (v) { var i = parseInt(v, 10); return isFinite(i) && notes[i] ? notes[i] : null; };
      s.slice(c + 1).split(",").forEach(function (pos) {
        if (ops.length >= 400) return;
        var q = pos.split("/").map(parseFloat), id = "op_" + ("00" + (ops.length + 1)).slice(-3);
        if (q.some(function (v) { return !isFinite(v); })) return;
        if (k === "d" && h.length === 5 && q.length === 2) {
          var d = { type: "drill", face: fc, dia: Math.max(0.1, parseFloat(h[1])), depth: Math.max(0, parseFloat(h[2])), through: h[3] === "1", id: id };
          if (!isFinite(d.dia) || !isFinite(d.depth)) return;
          if (fc < 5) { d.u = q[0]; d.z = q[1]; } else { d.x = q[0]; d.y = q[1]; }
          if (nt(h[4])) d.note = nt(h[4]);
          ops.push(d);
        } else if (k === "g" && h.length === 4 && q.length === 4) {
          var g = { type: "groove", face: fc, from: { x: q[0], y: q[1] }, to: { x: q[2], y: q[3] }, width: parseFloat(h[1]), depth: parseFloat(h[2]), id: id };
          if (!isFinite(g.width) || !isFinite(g.depth)) return;
          if (nt(h[3])) g.note = nt(h[3]);
          ops.push(g);
        }
      });
    });
    var omitted = Math.max(0, parseInt(f[14], 10) || 0);
    var pc = { fromCode: true, pk: "qr", role: dec(f[8]) || "pannello", length: L, width: W, thickness: T, outline: [{ x0: 0, x1: L, y0: 0, y1: W }], operations: ops, preflight: [], n: parseInt(f[7], 10) || null };
    var row = { modulo: dec(f[2]), elemento: dec(f[3]), role: pc.role, lung: L, larg: W, pz: num(f[6], 1, 999, 1), materiale: dec(f[4]), bordo: dec(f[5]) };
    var meta = {}; meta[pc.pk] = { n: pc.n, row: row, exact: true };
    return { M: { cfg: null, rows: [row], ops: { pieces: [pc] }, meta: meta }, pc: pc, project: dec(f[1]), omitted: omitted };
  }

  root.EBPieceCode = { encode: encode, parse: parse, MAX: MAX };
})(typeof globalThis !== "undefined" ? globalThis : this);
