/* Ebanist — generatore del Modello di Operazioni (Fase 2B.1).
 *
 * Ogni pezzo, con i suoi fori. Non per la macchina ancora — per l'occhio:
 * il falegname deve poter aprire un fianco e vedere dove vanno le basette
 * delle cerniere, gli eccentrici, i reggipiani, le guide. Il file macchina
 * verra dopo, dallo stesso modello, quando Centro Legno manda il profilo.
 *
 * La specifica e `01-arhitectura/Ebanist-Model-Operatii-v1.md`. Qui ce n'e il
 * sottoinsieme che non dipende dalla macchina: forature, cave, e le regole di
 * pre-flight V1, V2, V4, V5 che si possono controllare senza profilo.
 *
 * COME FUNZIONA. La ferramenta e un'ISTANZA nello spazio del mobile (una
 * cerniera sta a quella quota, su quell'anta, contro quel fianco). Ogni
 * istanza genera fori in coordinate MONDO. Poi ogni foro si porta nel sistema
 * del pezzo che attraversa: faccia 5/6/1-4, X lungo la lunghezza, Y lungo la
 * larghezza. Togli la cerniera e spariscono la tazza, i tasselli e i fori
 * della basetta — come vuole la specifica (§2.4).
 *
 * Regole, le stesse del nucleo:
 *   - millimetri, precisione piena dentro, arrotondamento a 0,1 mm in uscita;
 *   - PURO: entrano scatole, configurazione e cote derivate; esce il modello;
 *   - deterministico: stesso mobile, stessi fori, stessi id;
 *   - le cote di ferramenta sono DATI (HW_DRILL), visibili e marcate
 *     `verificat:false` finche non sono controllate su catalogo e su un pezzo
 *     vero. Un numero di foratura non verificato non va in macchina.
 *
 * Gira nel browser (<script src>) e in Node (require).
 */
(function (root) {
"use strict";

/* --- LE COTE DI FERRAMENTA ------------------------------------------------
   Valori di catalogo correnti (Blum, Häfele), non misurati su un pezzo del
   laboratorio. Per questo `verificat:false`: la scheda di officina li stampa
   con l'avviso, e l'esportatore macchina non li usera finche non diventano
   `true` — la stessa regola dei golden (D-46). */
var HW_DRILL = {
  verificat: false,
  sys32: { front: 37, pitch: 32 },                         // prima fila dal filo anteriore
  hinge: { cup_dia: 35, dowel_dia: 8, dowel_depth: 11,     // Blum 45/9,5
           dowel_spacing: 45, dowel_offset: 9.5,
           plate_dia: 5, plate_depth: 13, plate_spacing: 32 },
  minifix: { cam_dia: 15, cam_depth_16: 12.5, cam_depth_19: 13.5, // Häfele Minifix 15
             cam_dist: 34, bolt_dia: 5, bolt_depth: 11,
             shank_dia: 8, end_dist: 50, mid_over: 700 },
  dowel: { dia: 8, len: 35, face_depth: 12, offset: 32 },
  pin: { dia: 5, depth: 12, drop: 6, extra: 1 },          // reggipiano: +-1 foro di regolazione
  slide: { dia: 5, depth: 13, positions: [37, 261, 453], lift: 0 },
  handle: { dia: 5, interaxis: 128, from_edge: 40, from_top: 60, tall_y: 1050 }
};

var ORDER = ["fianco", "divisorio", "base", "cielo", "base_cielo", "ripiano", "schienale", "zoccolo", "traversa",
  "frontale", "cassetto_frontale", "cassetto_fianco", "cassetto_fondo"];
var R1 = function (v) { return Math.round(v * 10) / 10; };   // 0,1 mm, UNA volta, in uscita
var AX = ["x", "y", "z"];

/* ------------------------------------------------------------------------ */
/* I PEZZI FISICI: le scatole con lo stesso `pk` sono un pezzo solo (un fianco
   intagliato a L sono due scatole). Si tengono solo i pannelli: il vetro, le
   parti metalliche del cassetto e la ferramenta non si forano qui. */
var PANEL_ROLES = { fianco: 1, base: 1, cielo: 1, base_cielo: 1, schienale: 1, ripiano: 1,
  frontale: 1, divisorio: 1, zoccolo: 1, traversa: 1, cassetto_frontale: 1,
  cassetto_fianco: 1, cassetto_fondo: 1 };

function isRect(b) {
  if (!b.pc) return true;
  if (b.pc.length !== 4) return false;
  var q = b.pc;
  return Math.abs(q[0][0] - q[3][0]) < 0.5 && Math.abs(q[1][0] - q[2][0]) < 0.5;
}

function physicalPieces(boxes) {
  var map = {}, order = [];
  for (var i = 0; i < boxes.length; i++) {
    var b = boxes[i];
    if (!b || b.pk == null || !PANEL_ROLES[b.role] || b.kind === "g" || b.kind === "m") continue;
    var k = String(b.pk);
    if (!map[k]) { map[k] = { pk: b.pk, role: b.role, boxes: [], sub: b.sub || null, grp: b.grp || null, wing: b.wing || null, curved: false }; order.push(k); }
    map[k].boxes.push(b);
    if (!isRect(b)) map[k].curved = true;
  }
  return order.map(function (k) {
    var p = map[k], mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    p.boxes.forEach(function (b) {
      var lo = [b.x0, b.y0, b.z0], hi = [b.x1, b.y1, b.z1];
      for (var a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], lo[a]); mx[a] = Math.max(mx[a], hi[a]); }
    });
    p.min = mn; p.max = mx;
    p.ext = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
    /* l'asse della grossezza e il piu corto: e cosi per ogni pannello */
    var t = 0; for (var a2 = 1; a2 < 3; a2++) if (p.ext[a2] < p.ext[t]) t = a2;
    p.tAx = t; p.T = p.ext[t];
    p.holes = []; p.grooves = [];
    return p;
  });
}

/* il punto e DENTRO il materiale del pezzo (una delle sue scatole)? */
function inside(p, w, eps) {
  eps = eps == null ? 0.01 : eps;
  for (var i = 0; i < p.boxes.length; i++) {
    var b = p.boxes[i];
    if (w[0] >= b.x0 - eps && w[0] <= b.x1 + eps && w[1] >= b.y0 - eps && w[1] <= b.y1 + eps &&
        w[2] >= b.z0 - eps && w[2] <= b.z1 + eps) return true;
  }
  return false;
}
function boxAt(p, w) {
  for (var i = 0; i < p.boxes.length; i++) {
    var b = p.boxes[i];
    if (w[0] >= b.x0 - 0.5 && w[0] <= b.x1 + 0.5 && w[1] >= b.y0 - 0.5 && w[1] <= b.y1 + 0.5 &&
        w[2] >= b.z0 - 0.5 && w[2] <= b.z1 + 0.5) return b;
  }
  return null;
}

/* Un foro in coordinate mondo: entra dalla faccia del pezzo perpendicolare ad
   `ax`, dal lato `side` (+1 = la faccia al valore massimo, si fora verso il
   basso dell'asse; -1 = quella al minimo). `at` = centro sulla superficie. */
function hole(p, ax, side, at, dia, depth, hw, note, through) {
  if (!p) return;
  var w = at.slice();
  p.holes.push({ ax: ax, side: side, w: w, dia: dia, depth: through ? p.ext[ax] : depth,
                 through: !!through, hw: hw || null, note: note || "" });
}

/* un foro sulla stessa faccia che si sovrapporrebbe a questo? */
function clash(p, ax, side, w, dia) {
  for (var i = 0; i < p.holes.length; i++) {
    var h = p.holes[i];
    if (h.ax !== ax || (h.side !== side && !h.through)) continue;
    var d2 = 0;
    for (var a = 0; a < 3; a++) if (a !== ax) d2 += (h.w[a] - w[a]) * (h.w[a] - w[a]);
    if (Math.sqrt(d2) < (h.dia + dia) / 2 + 0.5) return true;
  }
  return false;
}

/* ------------------------------------------------------------------------ */
/* Il pannello VERTICALE (fianco o tramezzo) piu vicino a `x`, nella direzione
   `dir` (-1 = a sinistra, la sua faccia destra; +1 = a destra, la sua faccia
   sinistra), che copre la quota y e la profondita z. */
function panelBeside(pcs, x, dir, y, z, tol) {
  tol = tol == null ? 30 : tol;
  var best = null, bd = 1e9;
  for (var i = 0; i < pcs.length; i++) {
    var p = pcs[i];
    if (p.tAx !== 0 || (p.role !== "fianco" && p.role !== "divisorio")) continue;
    var face = dir < 0 ? p.max[0] : p.min[0];
    var d = dir < 0 ? x - face : face - x;
    if (d < -tol || d > bd) continue;
    if (!inside(p, [(p.min[0] + p.max[0]) / 2, y, z], 0.5)) continue;
    best = p; bd = d;
  }
  return best;
}

/* Le posizioni di una giunzione lungo la sua lunghezza [a,b]: due a
   `end_dist` dai capi, una in mezzo oltre `mid_over`. */
function jointPositions(a, b) {
  var M = HW_DRILL.minifix, out = [], span = b - a;
  if (span < 2 * M.end_dist) return [(a + b) / 2];
  out.push(b - M.end_dist); if (span > M.mid_over) out.push((a + b) / 2); out.push(a + M.end_dist);
  return out;
}

/* Una giunzione di testa: il pezzo `E` (che arriva col suo bordo) contro la
   faccia del pezzo `F`. Minifix + tassello a ogni posizione.
   eAx = l'asse lungo cui E arriva su F (la normale della faccia di F);
   eSide = +1 se il bordo di E che tocca F e al massimo di eAx.
   sAx = l'asse lungo cui si distribuiscono le posizioni.
   camAx/camSide = la faccia di E dove sta la tazza dell'eccentrico. */
function joint(E, F, eAx, eSide, sAx, lo, hi, camAx, camSide, out) {
  var M = HW_DRILL.minifix, D = HW_DRILL.dowel;
  var edge = eSide > 0 ? E.max[eAx] : E.min[eAx];
  var mid = (E.min[camAx] + E.max[camAx]) / 2;          // meta grossezza di E
  var camD = E.T >= 19 ? M.cam_depth_19 : M.cam_depth_16;
  var inward = -eSide;
  var pos = jointPositions(lo, hi), c = (lo + hi) / 2;
  pos.forEach(function (s, i) {
    var id = out.hw.length;
    var inst = { id: "hw_" + id, type: "minifix", catalog: "haf_minifix", piece: E.pk, against: F.pk,
                 w: null, note: "Minifix 15 + perno" };
    var p = [0, 0, 0]; p[eAx] = edge; p[camAx] = mid; p[sAx] = s;
    /* bullone nella faccia di F, gambo nel bordo di E, tazza sulla faccia di E */
    hole(F, eAx, -eSide, p.slice(), M.bolt_dia, M.bolt_depth, inst.id, "perno minifix");
    hole(E, eAx, eSide, p.slice(), M.shank_dia, M.cam_dist, inst.id, "gambo minifix");
    var cam = p.slice(); cam[eAx] = edge + inward * M.cam_dist;
    cam[camAx] = camSide > 0 ? E.max[camAx] : E.min[camAx];
    hole(E, camAx, camSide, cam, M.cam_dia, camD, inst.id, "eccentrico minifix");
    inst.w = cam; inst.dir = { ax: camAx, side: camSide }; inst.edge = p.slice(); inst.eAx = eAx; inst.eSide = eSide;
    out.hw.push(inst);
    /* tassello verso il centro della giunzione */
    var sd = s + (s > c ? -D.offset : D.offset);
    if (sd <= lo + 8 || sd >= hi - 8) return;
    var did = "hw_" + out.hw.length;
    var q = p.slice(); q[sAx] = sd;
    hole(F, eAx, -eSide, q.slice(), D.dia, D.face_depth, did, "tassello");
    hole(E, eAx, eSide, q.slice(), D.dia, D.len - D.face_depth, did, "tassello");
    out.hw.push({ id: did, type: "tassello", catalog: "tassello_8x35", piece: E.pk, against: F.pk,
                  w: q, eAx: eAx, eSide: eSide, note: "Tassello Ø8×35" });
  });
}

/* ------------------------------------------------------------------------ */
function generate(input) {
  var boxes = (input && input.boxes) || [], cfg = (input && input.cfg) || {}, G = input && input.G;
  var out = { schema_version: "1.0", units: "mm", verificat: HW_DRILL.verificat,
              pieces: [], hw: [], warnings: [] };
  var pcs = physicalPieces(boxes);
  if (!pcs.length) return out;
  var byRole = function (r) { return pcs.filter(function (p) { return p.role === r; }); };
  var H = HW_DRILL;
  var hingeSel = cfg.handles === "push" ? "push" : "maniglia";

  /* --- 1. giunzioni della cassa: base/cielo/ripiani fissi fra i verticali -- */
  var horiz = pcs.filter(function (p) {
    return p.tAx === 1 && !p.curved && (p.role === "base" || p.role === "cielo" || p.role === "base_cielo" ||
           (p.role === "ripiano" && cfg.shelfType === "fisso"));
  });
  horiz.forEach(function (E) {
    var yMid = (E.min[1] + E.max[1]) / 2;
    [-1, 1].forEach(function (end) {
      var edgeX = end < 0 ? E.min[0] : E.max[0];
      var F = null;
      for (var i = 0; i < pcs.length; i++) {
        var q = pcs[i];
        if (q === E || q.tAx !== 0 || (q.role !== "fianco" && q.role !== "divisorio")) continue;
        var face = end < 0 ? q.max[0] : q.min[0];
        if (Math.abs(face - edgeX) > 0.6) continue;
        if (!inside(q, [(q.min[0] + q.max[0]) / 2, yMid, (E.min[2] + E.max[2]) / 2], 0.5)) continue;
        F = q; break;
      }
      if (!F) return;
      /* la profondita comune ai due pezzi, sulla scatola del fianco che la
         base tocca davvero (un fianco a L ne ha due) */
      var fb = boxAt(F, [(F.min[0] + F.max[0]) / 2, yMid, (E.min[2] + E.max[2]) / 2]) || F;
      var lo = Math.max(E.min[2], fb.z0 != null ? fb.z0 : F.min[2]), hi = Math.min(E.max[2], fb.z1 != null ? fb.z1 : F.max[2]);
      /* la tazza sulla faccia nascosta: la base da sotto, il cielo da sopra */
      var camSide = (E.role === "cielo") ? 1 : -1;
      joint(E, F, 0, end, 2, lo, hi, 1, camSide, out);
    });
  });

  /* --- 2. i tramezzi fra base e cielo ------------------------------------- */
  byRole("divisorio").forEach(function (E) {
    if (E.tAx !== 0) return;
    var xMid = (E.min[0] + E.max[0]) / 2;
    [-1, 1].forEach(function (end) {
      var edgeY = end < 0 ? E.min[1] : E.max[1];
      var F = null;
      for (var i = 0; i < pcs.length; i++) {
        var q = pcs[i];
        if (q === E || q.tAx !== 1 || !(q.role === "base" || q.role === "cielo" || q.role === "base_cielo" ||
            (q.role === "ripiano" && cfg.shelfType === "fisso"))) continue;
        var face = end < 0 ? q.max[1] : q.min[1];
        if (Math.abs(face - edgeY) > 0.6) continue;
        if (!inside(q, [xMid, (q.min[1] + q.max[1]) / 2, (E.min[2] + E.max[2]) / 2], 0.5)) continue;
        F = q; break;
      }
      if (!F) return;
      var eb = boxAt(E, [xMid, edgeY - end * 1, (E.min[2] + E.max[2]) / 2]) || E;
      var lo = Math.max(F.min[2], eb.z0 != null ? eb.z0 : E.min[2]), hi = Math.min(F.max[2], eb.z1 != null ? eb.z1 : E.max[2]);
      joint(E, F, 1, end, 2, lo, hi, 0, 1, out);
    });
  });

  /* --- 4. ante: cerniere (tazza + tasselli sull'anta, basetta sul fianco) e
         maniglie. Il lato cerniera: prima meta a sinistra, seconda a destra. */
  var doors = pcs.filter(function (p) { return p.role === "frontale" && p.sub === "door" && p.tAx === 2; });
  var rows = {};
  doors.forEach(function (d) { var k = Math.round(d.min[1]) + "|" + Math.round(d.max[1]); (rows[k] = rows[k] || []).push(d); });
  Object.keys(rows).sort().forEach(function (k) {
    var ds = rows[k].slice().sort(function (a, b) { return a.min[0] - b.min[0]; }), n = ds.length;
    ds.forEach(function (D, i) {
      if (D.curved) { out.warnings.push({ piece: D.pk, k: "opsCurved" }); return; }
      var hingeLeft = n === 1 ? true : i < n / 2;
      var hEdge = hingeLeft ? D.min[0] : D.max[0], inw = hingeLeft ? 1 : -1;
      var h = D.ext[1], nH = root.hingeCount ? root.hingeCount(h) : (h < 900 ? 2 : h < 1600 ? 3 : h < 2000 ? 4 : 5);
      var eo = (G && G.in && G.in.edge_offset) || 100;
      var ys = root.positionsHinges ? root.positionsHinges(h, nH, eo) : [eo, h - eo];
      var distCant = (G && G.foratura && G.foratura.dist_cant) || 5, cupD = (G && G.foratura && G.foratura.prof) || 12.5;
      var cx = hEdge + inw * (distCant + H.hinge.cup_dia / 2), zIn = D.min[2];
      var P = panelBeside(pcs, hEdge + inw * 1, hingeLeft ? -1 : 1, D.min[1] + h / 2, zIn - 30, 30);
      if (!P) out.warnings.push({ piece: D.pk, k: "opsNoHingePanel" });
      ys.forEach(function (yy) {
        var y = D.min[1] + yy, id = "hw_" + out.hw.length;
        hole(D, 2, -1, [cx, y, zIn], H.hinge.cup_dia, cupD, id, "tazza cerniera");
        var dxw = cx + inw * H.hinge.dowel_offset;
        hole(D, 2, -1, [dxw, y - H.hinge.dowel_spacing / 2, zIn], H.hinge.dowel_dia, H.hinge.dowel_depth, id, "tassello cerniera");
        hole(D, 2, -1, [dxw, y + H.hinge.dowel_spacing / 2, zIn], H.hinge.dowel_dia, H.hinge.dowel_depth, id, "tassello cerniera");
        var inst = { id: id, type: "cerniera", catalog: "blum_71b3550", piece: D.pk, against: P ? P.pk : null,
                     w: [cx, y, zIn], hingeLeft: hingeLeft, note: "Cerniera + basetta" };
        if (P) {
          var fx = hingeLeft ? P.max[0] : P.min[0], zp = P.max[2] - H.sys32.front;
          hole(P, 0, hingeLeft ? 1 : -1, [fx, y - H.hinge.plate_spacing / 2, zp], H.hinge.plate_dia, H.hinge.plate_depth, id, "basetta cerniera");
          hole(P, 0, hingeLeft ? 1 : -1, [fx, y + H.hinge.plate_spacing / 2, zp], H.hinge.plate_dia, H.hinge.plate_depth, id, "basetta cerniera");
          inst.plate = [fx, y, zp];
        }
        out.hw.push(inst);
      });
      if (hingeSel === "maniglia") {
        var ia = H.handle.interaxis, ox = hingeLeft ? D.max[0] - H.handle.from_edge : D.min[0] + H.handle.from_edge;
        var yc = D.max[1] < 1100 ? D.max[1] - H.handle.from_top - ia / 2
               : D.min[1] > 1300 ? D.min[1] + H.handle.from_top + ia / 2
               : Math.max(D.min[1] + 60 + ia / 2, Math.min(D.max[1] - 60 - ia / 2, H.handle.tall_y));
        var hid = "hw_" + out.hw.length;
        hole(D, 2, 1, [ox, yc - ia / 2, D.max[2]], H.handle.dia, 0, hid, "maniglia", true);
        hole(D, 2, 1, [ox, yc + ia / 2, D.max[2]], H.handle.dia, 0, hid, "maniglia", true);
        out.hw.push({ id: hid, type: "maniglia", catalog: "gen_man", piece: D.pk, w: [ox, yc, D.max[2]],
                      vertical: true, ia: ia, note: "Maniglia " + ia + " mm" });
      }
    });
  });

  /* --- 5. cassetti: frontale (maniglia) e guide sui pannelli di fianco ----- */
  var grps = {};
  boxes.forEach(function (b) { if (b && b.grp) (grps[b.grp] = grps[b.grp] || []).push(b); });
  Object.keys(grps).sort().forEach(function (g) {
    var bs = grps[g], fr = null, body = bs.filter(function (b) { return b.sub === "dbox"; });
    for (var i = 0; i < pcs.length; i++) if (pcs[i].grp === g && pcs[i].role === "cassetto_frontale") { fr = pcs[i]; break; }
    if (fr && hingeSel === "maniglia" && fr.sub === "drawer") {
      var ia = H.handle.interaxis, xc = (fr.min[0] + fr.max[0]) / 2;
      var yc = fr.ext[1] > 250 ? fr.max[1] - H.handle.from_top : (fr.min[1] + fr.max[1]) / 2;
      var hid = "hw_" + out.hw.length;
      hole(fr, 2, 1, [xc - ia / 2, yc, fr.max[2]], H.handle.dia, 0, hid, "maniglia", true);
      hole(fr, 2, 1, [xc + ia / 2, yc, fr.max[2]], H.handle.dia, 0, hid, "maniglia", true);
      out.hw.push({ id: hid, type: "maniglia", catalog: "gen_man", piece: fr.pk, w: [xc, yc, fr.max[2]],
                    vertical: false, ia: ia, note: "Maniglia " + ia + " mm" });
    }
    if (!body.length) return;
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, z0 = 1e9, z1 = -1e9;
    body.forEach(function (b) { x0 = Math.min(x0, b.x0); x1 = Math.max(x1, b.x1); y0 = Math.min(y0, b.y0); z0 = Math.min(z0, b.z0); z1 = Math.max(z1, b.z1); });
    var y = y0 + H.slide.lift, nl = z1 - z0;
    [-1, 1].forEach(function (side) {
      var P = panelBeside(pcs, side < 0 ? x0 : x1, side, y + 10, (z0 + z1) / 2, 60);
      if (!P) return;
      var fx = side < 0 ? P.max[0] : P.min[0], id = "hw_" + out.hw.length;
      H.slide.positions.forEach(function (d) {
        if (d > nl - 10) return;
        hole(P, 0, side < 0 ? 1 : -1, [fx, y, P.max[2] - d], H.slide.dia, H.slide.depth, id, "guida cassetto");
      });
      out.hw.push({ id: id, type: "guida", catalog: "blum_tandem", piece: P.pk, w: [fx, y, z1], len: nl,
                    side: side, note: "Guida cassetto NL " + Math.round(nl) });
    });
  });

  /* --- 3. reggipiani sotto i ripiani regolabili ----------------------------
         DOPO cerniere e guide: stanno sulla stessa fila del sistema 32, e un
         foro di reggipiano che cade sopra un foro di basetta non si fa. Il
         foro di regolazione si salta; se e occupato quello principale, il
         ripiano poggia su quello di regolazione e lo si dice. */
  if (cfg.shelfType !== "fisso") byRole("ripiano").forEach(function (S) {
    if (S.tAx !== 1 || S.curved) return;
    var y = S.min[1] - H.pin.drop;
    [-1, 1].forEach(function (side) {
      var x = side < 0 ? S.min[0] : S.max[0];
      var P = panelBeside(pcs, x, side, y, (S.min[2] + S.max[2]) / 2, 6);
      if (!P) return;
      var fx = side < 0 ? P.max[0] : P.min[0];
      var zs = [P.max[2] - H.sys32.front, S.min[2] + H.sys32.front];
      zs.forEach(function (z) {
        var id = "hw_" + out.hw.length, sd = side < 0 ? 1 : -1, moved = false;
        for (var k = -H.pin.extra; k <= H.pin.extra; k++) {
          var w = [fx, y + k * H.sys32.pitch, z];
          if (clash(P, 0, sd, w, H.pin.dia)) { if (k === 0) moved = true; continue; }
          hole(P, 0, sd, w, H.pin.dia, H.pin.depth, id,
               k === 0 ? "reggipiano" : "reggipiano (regolazione)");
        }
        if (moved) out.warnings.push({ piece: P.pk, k: "opsPinMoved" });
        out.hw.push({ id: id, type: "reggipiano", catalog: "haf_sup", piece: P.pk, w: [fx, y, z],
                      dir: { ax: 0, side: side < 0 ? 1 : -1 }, note: "Reggipiano Ø5" });
      });
    });
  });

  /* --- 6. cave: lo schienale in cava entra nei pezzi intorno. La cava e
         esattamente dove la sua scatola si sovrappone a un altro pezzo. ----- */
  byRole("schienale").forEach(function (B) {
    B.boxes.forEach(function (bb) {
      pcs.forEach(function (q) {
        if (q === B || q.role === "schienale") return;
        q.boxes.forEach(function (qb) {
          var lo = [Math.max(bb.x0, qb.x0), Math.max(bb.y0, qb.y0), Math.max(bb.z0, qb.z0)];
          var hi = [Math.min(bb.x1, qb.x1), Math.min(bb.y1, qb.y1), Math.min(bb.z1, qb.z1)];
          if (hi[0] - lo[0] < 0.05 || hi[1] - lo[1] < 0.05 || hi[2] - lo[2] < 0.05) return;
          q.grooves.push({ lo: lo, hi: hi, note: "cava schienale" });
        });
      });
    });
  });

  /* --- 7. nel sistema del pezzo, con le regole di pre-flight -------------- */
  /* l'ordine del foglio: prima la cassa, poi l'interno, poi i frontali —
     lo stesso ordine in cui si monta. Il numero del pezzo e la sua
     posizione qui: uguale nel 3D, nell'elenco e sulla scheda. */
  out.pieces = pcs.map(function (p) { return localize(p); }).sort(function (a, b) {
    var ka = typeof a.pk === "number" ? a.pk : 1e9, kb = typeof b.pk === "number" ? b.pk : 1e9;
    return (ORDER.indexOf(a.role) - ORDER.indexOf(b.role)) || (ka - kb) || (String(a.pk) < String(b.pk) ? -1 : 1);
  });
  out.pieces.forEach(function (p, i) { p.n = i + 1; });
  return out;
}

/* ------------------------------------------------------------------------ */
/* Dal mondo al pezzo. Faccia 5 = la faccia con piu fori (e quella che sta in
   alto in macchina); a parita, quella al valore massimo. X corre lungo la
   lunghezza, Y lungo la larghezza, orientati in modo che guardando la faccia
   5 X vada a destra e Y in alto. */
function localize(p) {
  var t = p.tAx, others = [0, 1, 2].filter(function (a) { return a !== t; });
  /* la lunghezza e la cota maggiore delle due in faccia */
  var aL = p.ext[others[0]] >= p.ext[others[1]] ? others[0] : others[1];
  var aW = aL === others[0] ? others[1] : others[0];
  var cnt = { "1": 0, "-1": 0 };
  p.holes.forEach(function (h) { if (h.ax === t && !h.through) cnt[String(h.side)]++; });
  p.grooves.forEach(function (g) { var s = Math.abs(g.hi[t] - p.max[t]) < 0.05 ? 1 : -1; cnt[String(s)]++; });
  var s5 = cnt["-1"] > cnt["1"] ? -1 : 1;
  /* normale uscente dalla faccia 5, e il verso di Y che rende la terna destra */
  var n = [0, 0, 0]; n[t] = s5;
  var eL = [0, 0, 0]; eL[aL] = 1;
  var eW = [0, 0, 0]; eW[aW] = 1;
  var cr = [eL[1] * eW[2] - eL[2] * eW[1], eL[2] * eW[0] - eL[0] * eW[2], eL[0] * eW[1] - eL[1] * eW[0]];
  var flipY = (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2]) < 0;
  var Lp = p.ext[aL], Wp = p.ext[aW], T = p.ext[t];
  var X = function (w) { return w[aL] - p.min[aL]; };
  var Y = function (w) { return flipY ? p.max[aW] - w[aW] : w[aW] - p.min[aW]; };
  var Z6 = function (w) { return s5 > 0 ? w[t] - p.min[t] : p.max[t] - w[t]; };  // distanza dalla faccia 6

  var ops = [], k = 0, warns = [];
  var push = function (o) { o.id = "op_" + String(++k).padStart(3, "0"); ops.push(o); };
  p.holes.forEach(function (h) {
    var o = { type: "drill", dia: h.dia, depth: R1(h.depth), through: h.through, hw: h.hw, note: h.note };
    if (h.ax === t) {
      o.face = h.through ? 5 : (h.side === s5 ? 5 : 6);
      o.x = R1(X(h.w)); o.y = R1(Y(h.w));
    } else {
      /* sul bordo: faccia 1 = Y 0, 3 = Y max, 4 = X 0, 2 = X max */
      var atMax = h.side > 0;
      if (h.ax === aL) { o.face = atMax ? 2 : 4; o.u = R1(Y(h.w)); }
      else { var yMax = flipY ? !atMax : atMax; o.face = yMax ? 3 : 1; o.u = R1(X(h.w)); }
      o.z = R1(Z6(h.w)); o.x = R1(X(h.w)); o.y = R1(Y(h.w));
    }
    o._w = h.w; o._ax = h.ax; o._side = h.side;
    push(o);
  });
  /* i fori da due facce opposte nello stesso punto si toccano: su un
     tramezzo i reggipiani delle due sezioni diventano UN foro passante. */
  for (var i = 0; i < ops.length; i++) for (var j = i + 1; j < ops.length; j++) {
    var a = ops[i], b = ops[j];
    if (!a || !b || a.face > 6 || a.x == null) continue;
    if ((a.face === 5 && b.face === 6 || a.face === 6 && b.face === 5) && a.dia === b.dia &&
        Math.abs(a.x - b.x) < 0.05 && Math.abs(a.y - b.y) < 0.05 && a.depth + b.depth >= T - 2) {
      a.through = true; a.face = 5; a.depth = R1(T); a.note = a.note + " (passante, due lati)"; ops[j] = null;
    }
  }
  ops = ops.filter(Boolean);
  p.grooves.forEach(function (g) {
    var s = Math.abs(g.hi[t] - p.max[t]) < 0.05 ? 1 : -1;
    var face = s === s5 ? 5 : 6, dep = g.hi[t] - g.lo[t];
    var dl = g.hi[aL] - g.lo[aL], dw = g.hi[aW] - g.lo[aW];
    var along = dl >= dw ? aL : aW, across = along === aL ? aW : aL;
    var mid = (g.lo[across] + g.hi[across]) / 2;
    var a0 = g.lo.slice(), a1 = g.hi.slice(); a0[across] = mid; a1[across] = mid;
    push({ type: "groove", face: face, from: { x: R1(X(a0)), y: R1(Y(a0)) }, to: { x: R1(X(a1)), y: R1(Y(a1)) },
           width: R1(g.hi[across] - g.lo[across]), depth: R1(dep), note: g.note, _lo: g.lo, _hi: g.hi });
  });

  /* il contorno: le scatole del pezzo nel sistema della faccia 5 */
  var rects = p.boxes.map(function (b) {
    var lo = [b.x0, b.y0, b.z0], hi = [b.x1, b.y1, b.z1];
    var xa = X(lo), xb = X(hi), ya = Y(lo), yb = Y(hi);
    return { x0: R1(Math.min(xa, xb)), x1: R1(Math.max(xa, xb)), y0: R1(Math.min(ya, yb)), y1: R1(Math.max(ya, yb)) };
  });

  /* --- pre-flight: V1 dentro il contorno, V2 distanza dal bordo, V4
         profondita, V5 sovrapposizioni. Le altre regole vogliono il profilo
         della macchina, e non si inventano. */
  var inR = function (x, y) { return rects.some(function (r) { return x >= r.x0 - 0.05 && x <= r.x1 + 0.05 && y >= r.y0 - 0.05 && y <= r.y1 + 0.05; }); };
  ops.forEach(function (o) {
    if (o.type !== "drill") return;
    if (o.face === 5 || o.face === 6) {
      var r = o.dia / 2;
      if (!inR(o.x, o.y)) warns.push({ rule: "V1", level: "error", op: o.id });
      else if (!(inR(o.x - r - 3, o.y) && inR(o.x + r + 3, o.y) && inR(o.x, o.y - r - 3) && inR(o.x, o.y + r + 3)))
        warns.push({ rule: "V2", level: "warn", op: o.id });
      if (!o.through && o.depth > T - 2 + 0.05) warns.push({ rule: "V4", level: "error", op: o.id });
    } else {
      if (o.z - o.dia / 2 < -0.05 || o.z + o.dia / 2 > T + 0.05) warns.push({ rule: "V3", level: "error", op: o.id });
    }
  });
  for (var a2 = 0; a2 < ops.length; a2++) for (var b2 = a2 + 1; b2 < ops.length; b2++) {
    var A = ops[a2], B = ops[b2];
    if (A.type !== "drill" || B.type !== "drill" || A.face !== B.face || A.face > 6 || A.face < 5) continue;
    if (Math.hypot(A.x - B.x, A.y - B.y) < (A.dia + B.dia) / 2 - 0.05) warns.push({ rule: "V5", level: "error", op: A.id + "/" + B.id });
  }
  var both = ops.some(function (o) { return o.face === 5 && !o.through; }) && ops.some(function (o) { return o.face === 6; });
  if (both) warns.push({ rule: "V12", level: "info", op: null });

  return {
    pk: p.pk, role: p.role, sub: p.sub, grp: p.grp, wing: p.wing, curved: p.curved,
    length: R1(Lp), width: R1(Wp), thickness: R1(T),
    axes: { lung: AX[aL], larg: AX[aW], sp: AX[t], face5: s5, flipY: flipY },
    min: p.min.slice(), max: p.max.slice(), outline: rects,
    operations: ops, preflight: warns
  };
}

/* La riga di distinta di un pezzo fisico: stesso ruolo, stesse due cote a
   un millimetro. Se non si trova (un pezzo spezzato in tronconi, un
   trapezio) si prende la prima riga del ruolo e lo si dice. */
function matchRow(piece, rows) {
  var a = [piece.length, piece.width].sort(function (x, y) { return y - x; });
  var same = (rows || []).filter(function (r) {
    if (!r) return false;
    if (r.role === piece.role) return true;
    /* base e cielo in una riga sola */
    return r.role === "base_cielo" && (piece.role === "base" || piece.role === "cielo");
  });
  for (var i = 0; i < same.length; i++) {
    var b = [+same[i].lung || 0, +same[i].larg || 0].sort(function (x, y) { return y - x; });
    if (Math.abs(a[0] - b[0]) <= 2.5 && Math.abs(a[1] - b[1]) <= 2.5) return { row: same[i], exact: true };
  }
  return same.length ? { row: same[0], exact: false } : null;
}

var API = { HW_DRILL: HW_DRILL, generateOperations: generate, matchOpsRow: matchRow };
if (typeof module !== "undefined" && module.exports) module.exports = API;
for (var k in API) if (Object.prototype.hasOwnProperty.call(API, k)) root[k] = API[k];

})(typeof globalThis !== "undefined" ? globalThis : this);
