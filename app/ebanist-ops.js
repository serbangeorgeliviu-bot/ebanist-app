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
  /* Alte tipuri de imbinare (alese prin articolul `conn` al corpului). Date de
     catalog generice, verificat:false: se confirma pe o piesa inainte sa mearga
     in masina. end = distanta primei fixari de capete, pitch = pasul maxim. */
  joints: {
    confirmat: { through_dia: 7, pilot_dia: 5, pilot_depth: 50, end: 50, mid_over: 700 },
    dowel:     { dia: 8, len: 35, face_depth: 12, end: 50, pitch: 128 },
    biscuit:   { len: 56, thk: 4, depth: 12.5, depth_face: 12.5, end: 60, pitch: 200 }, // Lamello #20 (23 mm de lamela)
    domino:    { len: 22, thk: 8, depth: 25, depth_face: 15, end: 50, pitch: 128 },  // Festool DF500 8x40 (tenon 8×22×40): 25 + 15 = 40; adancimile NU sunt din fisa
    /* Lamello Clamex P-14, fisa Lamello Clamex P-14/10 Flexus (02/22): freza P-System
       Ø100.4×7×22, canal de 14 mm adancime, 9.8 mm inalt, ~69.6 mm lung (coarda); conector
       64×13.5×9.7; de la capat min. 37 mm, pas max. 300 mm; panou min. 18 mm. */
    clamex:    { len: 69.6, thk: 9.8, depth: 14, depth_face: 14, end: 50, pitch: 300, src: "Lamello Clamex P-14/10 Flexus, 02/22" }
  },
  pin: { dia: 5, depth: 12, drop: 6, extra: 1 },          // reggipiano: +-1 foro di regolazione
  slide: { dia: 5, depth: 13, positions: [37, 261, 453], lift: 0,
    /* pozitiile de fixare pe lateral, de la fata dulapului, dupa lungimea nominala NL,
       din fisele producatorului (nu din memorie). Fara serie sau fara NL in tabel:
       `positions` de mai sus, ca inainte. Randul vertical nu e in aceste fise. */
    series: {
      blum_movento: { src: "Blum MOVENTO 760H, Attachment of runners (BLUMOTION S / TIP-ON), brosura tehnica",
        front: [18, 37, 69],
        nl: [[250, 270, [197]], [300, 350, [261]], [380, 600, [243, 261, 293]]] },
      blum_tandem: { src: "Blum TANDEM plus BLUMOTION 563H, Panel application (instalare, 2013): NL in inci → mm",
        front: [37],
        nlExact: { 229: [133, 229], 305: [165, 261], 381: [165, 357], 457: [261, 453], 533: [261, 517] } }
    } },
  handle: { dia: 5, interaxis: 128, from_edge: 40, from_top: 60, tall_y: 1050 },
  /* gola frezată (D-89): priza pe spatele muchiei de sus a frontului, la 45°. Date generice, de verificat. */
  golaFresata: { w: 20, d: 12, ang: 45, verificat: false },
  /* canalul profilului anti-curbare (U.6, D-76): pe fata dinapoi a usii, pe toata
     inaltimea, paralel cu marginea libera. Date de profil generic, de verificat
     pe un profil real inainte sa mearga in masina. */
  antiwarp: { groove_w: 10, groove_d: 9, from_free_edge: 45, end_margin: 30 },
  /* balamaua dintre două foi ale unui pachet pliant (U.9, D-87): cupa pe fața dinapoi a
     foii din stânga, la marginea ei din dreapta; placa pe fața dinapoi a foii vecine, la
     `plate_from_edge` de margine. Date de catalog generice, de verificat pe un sistem real. */
  fold: { cup_dia: 35, cup_depth: 12.5, dist_cant: 5, plate_from_edge: 37, plate_spacing: 32, plate_dia: 5, plate_depth: 13 }
};

/* tipul de imbinare al corpului: din articolul `conn` ales pe corp (cfg.hwSel.conn),
   altfel din cel implicit din setari (root.jointDefaultId); necunoscut = minifix */
var JOINT_OF_ID = { haf_minifix: "minifix", haf_rafix: "minifix", gen_confirmat: "confirmat",
                    gen_dowel: "dowel", gen_biscuit: "biscuit", fes_domino: "domino", lam_clamex: "clamex" };
function jointKind(input) {
  var cfg = (input && input.cfg) || {}, id = cfg.hwSel && cfg.hwSel.conn;
  if (!id && typeof root.jointDefaultId === "function") id = root.jointDefaultId();
  return JOINT_OF_ID[id] || "minifix";
}

var ORDER = ["fianco", "divisorio", "base", "cielo", "base_cielo", "traversa_cielo", "blat", "ripiano", "schienale", "zoccolo", "traversa",
  "frontale", "cassetto_frontale", "cassetto_fianco", "cassetto_fondo"];
var R1 = function (v) { return Math.round(v * 10) / 10; };   // 0,1 mm, UNA volta, in uscita
var AX = ["x", "y", "z"];

/* ------------------------------------------------------------------------ */
/* I PEZZI FISICI: le scatole con lo stesso `pk` sono un pezzo solo (un fianco
   intagliato a L sono due scatole). Si tengono solo i pannelli: il vetro, le
   parti metalliche del cassetto e la ferramenta non si forano qui. */
var PANEL_ROLES = { fianco: 1, base: 1, cielo: 1, base_cielo: 1, traversa_cielo: 1, blat: 1, schienale: 1, ripiano: 1,
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
    if (!map[k]) { map[k] = { pk: b.pk, role: b.role, boxes: [], sub: b.sub || null, grp: b.grp || null, wing: b.wing || null, hinge: b.hinge || null, aw: !!b.aw, fold: b.fold || null, curved: false, sloped: false, dim: null, edgeH: null }; order.push(k); }
    map[k].boxes.push(b);
    if (!isRect(b)) map[k].curved = true;
    /* panou pe pantă (D-86): conturul în planul vertical și, la tavanul înclinat, dimensiunile reale
       (lungime pe pantă, lățime, grosime), fiindcă cutia de gabarit nu le mai dă. */
    if (b.vp) { map[k].sloped = true; if (b.dim) map[k].dim = b.dim; if (!map[k].vpPts) map[k].vpPts = b.vp.pts; }
    if (b.edgeH) map[k].edgeH = b.edgeH;
  }
  return order.map(function (k) {
    var p = map[k], mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    p.boxes.forEach(function (b) {
      var lo = [b.x0, b.y0, b.z0], hi = [b.x1, b.y1, b.z1];
      for (var a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], lo[a]); mx[a] = Math.max(mx[a], hi[a]); }
    });
    p.min = mn; p.max = mx;
    p.ext = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
    /* l'asse della grossezza e il piu corto: e cosi per ogni pannello, salvo
       una striscia piu stretta della sua grossezza (18 x 15 in un pannello da
       18): li il piu corto e la larghezza. Allora decide il ruolo, tabella
       ROLE_AXES del nucleo, purche l'asse indicato non sia il piu lungo. */
    var t = 0; for (var a2 = 1; a2 < 3; a2++) if (p.ext[a2] < p.ext[t]) t = a2;
    var ra = typeof axesFor === "function" ? axesFor(p.role) : null;
    var ta = ra ? { L: 0, H: 1, P: 2 }[ra.sp] : null;
    if (ta != null && ta !== t && !p.curved && p.ext[ta] <= 40) {
      var longest = 0; for (var a3 = 1; a3 < 3; a3++) if (p.ext[a3] > p.ext[longest]) longest = a3;
      if (ta !== longest) t = ta;
    }
    p.tAx = t; p.T = p.ext[t];
    p.holes = []; p.grooves = []; p.mills = []; p.slots = [];
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

/* D-89 — mânerul după modelul lui (catalog, `hm`): găuri trecute la interax, o gaură pentru buton,
   locaș la freză pentru mânerul încastrat, găuri de fixare pe spate pentru mânerul pe muchie.
   Cotele modelelor sunt date de catalog generice (chk), de verificat pe articolul real. */
function handleOf(cfg, kind) {
  var m = root.handleModel ? root.handleModel(cfg, kind) : null;
  if (m) return m;
  var knob = !!(root.handleIsKnob && root.handleIsKnob(cfg));
  return { id: "gen_man", t: knob ? "knob" : "bar", ia: knob ? 0 : HW_DRILL.handle.interaxis, L: knob ? 30 : HW_DRILL.handle.interaxis + 44, knob: knob };
}
function handleLen(m) { return m.t === "flushR" ? m.d : (m.L || m.ia || 0); }
function placeHandle(out, D, m, o) {
  var hid = "hw_" + out.hw.length, zF = D.max[2], zB = D.min[2], t = m.t, ia = m.ia || 0;
  var ax = o.vertical ? 1 : 0, len = handleLen(m), room = D.ext[ax] - 40;
  if (len > room) out.warnings.push({ piece: D.pk, k: "opsHandleFit" });
  var inst = { id: hid, type: "maniglia", catalog: m.id, piece: D.pk, w: [o.x, o.y, zF], vertical: !!o.vertical,
               ia: ia, knob: !!m.knob, hm: m, T: zF - zB };
  if (m.knob) {
    hole(D, 2, 1, [o.x, o.y, zF], HW_DRILL.handle.dia, 0, hid, "pomello", true);
    inst.note = "Pomello";
  } else if (t === "flush" || t === "flushR") {
    var Lf = t === "flushR" ? m.d : m.L, Wf = t === "flushR" ? m.d : (m.W || 40);
    D.mills.push({ ax: 2, side: 1, c: [o.x, o.y, zF], du: o.vertical ? Wf : Lf, dv: o.vertical ? Lf : Wf,
                   r: Wf / 2, depth: m.depth || 12, through: false, note: "locaș mâner încastrat" });
    inst.note = "Maniglia a incasso " + Lf + (t === "flush" ? "×" + Wf : "") + " mm";
  } else if (t === "edge") {
    /* pe muchia de sus (sertar, ușă joasă) sau pe muchia liberă (ușă înaltă); șuruburi din spate */
    var top = !o.vertical || D.max[1] < 1100, a = Math.max(10, len / 2 - 25);
    if (top) {
      var cx = o.vertical && o.freeX != null ? o.freeX - o.freeS * (len / 2 + 30) : o.x, yt = D.max[1];
      cx = Math.max(D.min[0] + len / 2 + 5, Math.min(D.max[0] - len / 2 - 5, cx));
      hole(D, 2, -1, [cx - a, yt - 10, zB], 3, 8, hid, "vite maniglia a bordo");
      hole(D, 2, -1, [cx + a, yt - 10, zB], 3, 8, hid, "vite maniglia a bordo");
      inst.w = [cx, yt, zF]; inst.vertical = false; inst.edge = { n: 1, s: 1, at: yt };
    } else {
      var xe = o.freeX;
      hole(D, 2, -1, [xe - o.freeS * 10, o.y - a, zB], 3, 8, hid, "vite maniglia a bordo");
      hole(D, 2, -1, [xe - o.freeS * 10, o.y + a, zB], 3, 8, hid, "vite maniglia a bordo");
      inst.w = [xe, o.y, zF]; inst.vertical = true; inst.edge = { n: 0, s: o.freeS, at: xe };
    }
    inst.note = "Maniglia a filo bordo " + len + " mm";
  } else {
    var p1 = [o.x, o.y, zF], p2 = [o.x, o.y, zF]; p1[ax] -= ia / 2; p2[ax] += ia / 2;
    hole(D, 2, 1, p1, HW_DRILL.handle.dia, 0, hid, "maniglia", true);
    hole(D, 2, 1, p2, HW_DRILL.handle.dia, 0, hid, "maniglia", true);
    inst.note = "Maniglia " + ia + " mm";
  }
  out.hw.push(inst);
}
/* ușă: mânerul pe partea liberă, la înălțimea obișnuită */
function doorHandle(out, D, m, freeRight, topD) {
  /* span: cât ocupă pe înălțime la așezare; bara și butonul ca până acum (interaxul), restul lungimea lor */
  var len = m.knob ? HW_DRILL.handle.interaxis : (m.ia || handleLen(m)), fe = (m.t === "flush" || m.t === "flushR") ? Math.max(HW_DRILL.handle.from_edge, (m.t === "flushR" ? m.d : (m.W || 40)) / 2 + 20) : HW_DRILL.handle.from_edge;
  var ox = freeRight ? D.max[0] - fe : D.min[0] + fe;
  topD = topD != null ? topD : D.max[1];
  var yc = topD < 1100 ? topD - HW_DRILL.handle.from_top - len / 2
         : D.min[1] > 1300 ? D.min[1] + HW_DRILL.handle.from_top + len / 2
         : Math.max(D.min[1] + 60 + len / 2, Math.min(topD - 60 - len / 2, HW_DRILL.handle.tall_y));
  placeHandle(out, D, m, { vertical: true, x: ox, y: yc, freeX: freeRight ? D.max[0] : D.min[0], freeS: freeRight ? 1 : -1 });
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
    /* un pannello a oltre `tol` dal bordo non e quello contro cui lavora la
       cerniera: la basetta andrebbe forata su un fianco lontano. Meglio
       nessun pannello (avviso opsNoHingePanel) che un foro sul pezzo sbagliato. */
    if (d < -tol || d > tol || d > bd) continue;
    if (!inside(p, [(p.min[0] + p.max[0]) / 2, y, z], 0.5)) continue;
    best = p; bd = d;
  }
  return best;
}

/* Le posizioni di una giunzione lungo la sua lunghezza [a,b]: due a
   `end_dist` dai capi, una in mezzo oltre `mid_over`. */
function jointPositions(a, b) {
  var M = HW_DRILL.minifix, out = [], span = b - a;
  /* sub 2×end_dist + 30 cele doua pozitii ar cadea una peste alta (sau la mai putin
     de un diametru de excentric): o singura fixare, la mijloc (de ex. traversa de 100 mm) */
  if (span < 2 * M.end_dist + 30) return [(a + b) / 2];
  out.push(b - M.end_dist); if (span > M.mid_over) out.push((a + b) / 2); out.push(a + M.end_dist);
  return out;
}
/* Pozitii echidistante, cu pasul maxim `pitch`: de la `end` de capete, cel putin doua
   (una la mijloc daca nu incap doua). */
function evenPositions(a, b, end, pitch, minSpan) {
  var span = b - a;
  if (span < 2 * end + (minSpan || 30)) return [(a + b) / 2];
  var n = Math.max(2, Math.ceil((span - 2 * end) / pitch) + 1), out = [];
  for (var i = 0; i < n; i++) out.push(a + end + (span - 2 * end) * i / (n - 1));
  return out;
}
/* pozitiile de fixare ale ghidajului, de la fata dulapului: seria din fisele
   producatorului dupa NL; cea mai apropiata NL din tabel daca nu e una exacta */
function slidePositions(cfg, nl) {
  var S = HW_DRILL.slide, id = typeof root.slideGuidaId === "function" ? root.slideGuidaId(cfg) : null, ser = id && S.series[id];
  if (!ser) return { list: S.positions, src: null, approx: false };
  if (ser.nl) {
    var row = null;
    ser.nl.forEach(function (r) { if (nl >= r[0] - 0.5 && nl <= r[1] + 0.5) row = r; });
    var approx = !row;
    if (!row) row = nl < ser.nl[0][0] ? ser.nl[0] : ser.nl[ser.nl.length - 1];
    return { list: ser.front.concat(row[2]).sort(function (a, b) { return a - b; }), src: ser.src, approx: approx };
  }
  var best = null, bd = 1e9;
  Object.keys(ser.nlExact).forEach(function (k) { var d = Math.abs(+k - nl); if (d < bd) { bd = d; best = +k; } });
  return { list: ser.front.concat(ser.nlExact[best]), src: ser.src, approx: bd > 12 };
}

/* canal drept in fata unei piese: centrul `at`, axa lunga `la`, lungime, grosime, adancime */
function slot(p, ax, side, at, la, len, thk, depth, hw, note) {
  if (!p) return;
  p.slots.push({ ax: ax, side: side, w: at.slice(), la: la, len: len, thk: thk, depth: depth, hw: hw || null, note: note || "" });
}

/* Una giunzione di testa: il pezzo `E` (che arriva col suo bordo) contro la
   faccia del pezzo `F`. Minifix + tassello a ogni posizione.
   eAx = l'asse lungo cui E arriva su F (la normale della faccia di F);
   eSide = +1 se il bordo di E che tocca F e al massimo di eAx.
   sAx = l'asse lungo cui si distribuiscono le posizioni.
   camAx/camSide = la faccia di E dove sta la tazza dell'eccentrico. */
function joint(E, F, eAx, eSide, sAx, lo, hi, camAx, camSide, out) {
  var kind = out.joint || "minifix";
  if (kind !== "minifix") return jointOther(kind, E, F, eAx, eSide, sAx, lo, hi, camAx, out);
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


/* confirmat / tasel / lamelle / domino: aceeasi geometrie de capat (E vine cu
   muchia pe fata lui F), alt fel de legatura. Pozitia pe grosimea lui E: la mijloc. */
function jointOther(kind, E, F, eAx, eSide, sAx, lo, hi, camAx, out) {
  var J = HW_DRILL.joints[kind], edge = eSide > 0 ? E.max[eAx] : E.min[eAx];
  var mid = (E.min[camAx] + E.max[camAx]) / 2;
  var pos = kind === "confirmat" ? jointPositions2(lo, hi, J.end, J.mid_over) : evenPositions(lo, hi, J.end, J.pitch, kind === "dowel" ? 30 : J.len);
  pos.forEach(function (s) {
    var id = "hw_" + out.hw.length, p = [0, 0, 0]; p[eAx] = edge; p[camAx] = mid; p[sAx] = s;
    if (kind === "confirmat") {
      /* surubul trece prin fata exterioara a lui F si intra in muchia lui E */
      hole(F, eAx, eSide, p.slice(), J.through_dia, 0, id, "confirmat", true);
      hole(E, eAx, eSide, p.slice(), J.pilot_dia, J.pilot_depth, id, "pilot confirmat");
      out.hw.push({ id: id, type: "confirmat", catalog: "gen_confirmat", piece: E.pk, against: F.pk, w: p.slice(), eAx: eAx, eSide: eSide, sAx: sAx, camAx: camAx, note: "Confirmat 7×50" });
    } else if (kind === "dowel") {
      hole(F, eAx, -eSide, p.slice(), J.dia, J.face_depth, id, "tassello");
      hole(E, eAx, eSide, p.slice(), J.dia, J.len - J.face_depth, id, "tassello");
      out.hw.push({ id: id, type: "tassello", catalog: "gen_dowel", piece: E.pk, against: F.pk, w: p.slice(), eAx: eAx, eSide: eSide, note: "Tassello Ø8×35" });
    } else {
      var nm = kind === "biscuit" ? "lamella" : kind === "clamex" ? "clamex" : "domino";
      slot(F, eAx, -eSide, p.slice(), sAx, J.len, J.thk, J.depth_face, id, "canal " + nm);
      slot(E, eAx, eSide, p.slice(), sAx, J.len, J.thk, J.depth, id, "canal " + nm);
      out.hw.push({ id: id, type: kind, catalog: kind === "biscuit" ? "gen_biscuit" : kind === "clamex" ? "lam_clamex" : "fes_domino", piece: E.pk, against: F.pk, w: p.slice(), eAx: eAx, eSide: eSide, sAx: sAx, camAx: camAx,
                    note: kind === "biscuit" ? "Lamello #20" : kind === "clamex" ? "Lamello Clamex P-14" : "Festool Domino 8×40" });
    }
  });
}
function jointPositions2(a, b, end, over) {
  var span = b - a;
  if (span < 2 * end + 30) return [(a + b) / 2];
  var o = [b - end]; if (span > over) o.push((a + b) / 2); o.push(a + end); return o;
}

/* ------------------------------------------------------------------------ */
function generate(input) {
  var boxes = (input && input.boxes) || [], cfg = (input && input.cfg) || {}, G = input && input.G;
  var out = { schema_version: "1.0", units: "mm", verificat: HW_DRILL.verificat,
              pieces: [], hw: [], warnings: [], joint: jointKind(input) };
  var pcs = physicalPieces(boxes);
  if (!pcs.length) return out;
  var byRole = function (r) { return pcs.filter(function (p) { return p.role === r; }); };
  var H = HW_DRILL;
  /* push = niente maniglia; un profilo gola scelto in catalogo, nemmeno: in
     tutti e due i casi il frontale non ha fori di maniglia */
  var hingeSel = (cfg.handles === "push" || cfg.handles === "gola") ? "push"
    : (root.handleIsProfile && root.handleIsProfile(cfg)) ? "profilo" : "maniglia";

  /* --- 1. giunzioni della cassa: base/cielo/ripiani fissi fra i verticali -- */
  var horiz = pcs.filter(function (p) {
    return p.tAx === 1 && !p.curved && !p.sloped && (p.role === "base" || p.role === "cielo" || p.role === "base_cielo" ||
           p.role === "traversa_cielo" || (p.role === "ripiano" && cfg.shelfType === "fisso"));
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
      var camSide = (E.role === "cielo" || E.role === "traversa_cielo") ? 1 : -1;
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
        if (q === E || q.tAx !== 1 || q.sloped || !(q.role === "base" || q.role === "cielo" || q.role === "base_cielo" ||
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

  /* --- 2b. tavanul din doua traverse (D-72): tramezzul urca pana la ele si se
         prinde de amandoua, fata si spate. Cu cielo plin il gaseste bucla de sus. */
  byRole("divisorio").forEach(function (E) {
    if (E.tAx !== 0) return;
    var xMid = (E.min[0] + E.max[0]) / 2;
    pcs.forEach(function (q) {
      if (q.role !== "traversa_cielo" || q.tAx !== 1) return;
      if (Math.abs(q.min[1] - E.max[1]) > 0.6) return;
      if (xMid < q.min[0] - 0.5 || xMid > q.max[0] + 0.5) return;
      var lo = Math.max(q.min[2], E.min[2]), hi = Math.min(q.max[2], E.max[2]);
      if (hi - lo < 20) return;
      joint(E, q, 1, 1, 2, lo, hi, 0, 1, out);
    });
  });

  /* --- 3b. tavan înclinat (D-86): îmbinările cu un panou înclinat sau cu muchie oblică nu se găuresc
         în pasul 1. Piesa iese în model fără operații pe muchia oblică, cu avertisment: cotele cer
         o piesă reală (bevel) înainte să meargă în mașină. */
  pcs.forEach(function (p) { if (p.sloped && p.role !== "frontale") out.warnings.push({ piece: p.pk, k: "opsSlope" }); });

  /* --- 4. ante: cerniere (tazza + tasselli sull'anta, basetta sul fianco) e
         maniglie. Il lato cerniera e quello scritto sull'anta (`fronts[].hinge`);
         se non c'e, prima meta a sinistra, seconda a destra. */
  var doors = pcs.filter(function (p) { return p.role === "frontale" && p.sub === "door" && p.tAx === 2; });
  var rows = {};
  doors.forEach(function (d) { var k = Math.round(d.min[1]) + "|" + Math.round(d.max[1]); (rows[k] = rows[k] || []).push(d); });
  Object.keys(rows).sort().forEach(function (k) {
    var ds = rows[k].slice().sort(function (a, b) { return a.min[0] - b.min[0]; }), n = ds.length;
    ds.forEach(function (D, i) {
      if (D.curved) { out.warnings.push({ piece: D.pk, k: "opsCurved" }); return; }
      var hingeLeft = D.hinge === "left" ? true : D.hinge === "right" ? false : (n === 1 ? true : i < n / 2);
      var hEdge = hingeLeft ? D.min[0] : D.max[0], inw = hingeLeft ? 1 : -1;
      /* ușă trapezoidală (D-86, pasul 2): balamalele se așază pe înălțimea muchiei mai scunde, ca să rămână în contur */
      var h = D.edgeH ? Math.min(D.edgeH[0], D.edgeH[1]) : D.ext[1], topD = D.min[1] + h, nH = root.hingeCount ? root.hingeCount(h) : (h < 900 ? 2 : h < 1600 ? 3 : h < 2000 ? 4 : 5);
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
      if (D.aw) {
        var A = H.antiwarp, fx0 = hingeLeft ? D.max[0] - A.from_free_edge : D.min[0] + A.from_free_edge;
        if (D.ext[1] > 2 * A.end_margin + 50 && D.T > A.groove_d + 3) {
          D.grooves.push({ lo: [fx0 - A.groove_w / 2, D.min[1] + A.end_margin, D.min[2]],
                           hi: [fx0 + A.groove_w / 2, D.max[1] - A.end_margin, D.min[2] + A.groove_d],
                           note: "canal profil anti-curbare" });
        } else out.warnings.push({ piece: D.pk, k: "opsAwThin" });
      }
      if (hingeSel === "maniglia") doorHandle(out, D, handleOf(cfg, "door"), hingeLeft, topD);
    });
  });

  /* --- 4b. pachete pliante (U.9, D-87): balamale între foi și mâner pe foaia liberă.
         Foile nu se prind de lateral: atârnă pe șină, deci nu au bază pe flanc. */
  var packs = {};
  pcs.forEach(function (p) {
    if (p.role === "frontale" && p.sub === "fold" && p.fold && p.tAx === 2) (packs[p.fold.i] = packs[p.fold.i] || []).push(p);
  });
  Object.keys(packs).sort(function (a, b) { return a - b; }).forEach(function (pi) {
    var ls = packs[pi].slice().sort(function (a, b) { return a.min[0] - b.min[0]; });
    var F = H.fold, eo = (G && G.in && G.in.edge_offset) || 100;
    for (var j = 0; j < ls.length - 1; j++) {
      var A = ls[j], B = ls[j + 1];
      var h = A.ext[1], nH = root.hingeCount ? root.hingeCount(h) : (h < 900 ? 2 : h < 1600 ? 3 : h < 2000 ? 4 : 5);
      var ys = root.positionsHinges ? root.positionsHinges(h, nH, eo) : [eo, h - eo];
      var cx = A.max[0] - (F.dist_cant + F.cup_dia / 2), zA = A.min[2], zB = B.min[2];
      ys.forEach(function (yy) {
        var y = A.min[1] + yy, id = "hw_" + out.hw.length;
        hole(A, 2, -1, [cx, y, zA], F.cup_dia, F.cup_depth, id, "tazza cerniera pliante");
        var px = B.min[0] + F.plate_from_edge;
        hole(B, 2, -1, [px, y - F.plate_spacing / 2, zB], F.plate_dia, F.plate_depth, id, "basetta cerniera pliante");
        hole(B, 2, -1, [px, y + F.plate_spacing / 2, zB], F.plate_dia, F.plate_depth, id, "basetta cerniera pliante");
        out.hw.push({ id: id, type: "cerniera_pliante", catalog: "blum_71b3550", piece: A.pk, against: B.pk,
                      w: [cx, y, zA], plate: [px, y, zB], note: "Cerniera tra le ante (pacchetto)" });
      });
    }
    /* mânerul stă pe foaia de la capătul liber al pachetului */
    var stackLeft = ls[0].hinge === "left", D = stackLeft ? ls[ls.length - 1] : ls[0];
    if (hingeSel === "maniglia" && D) doorHandle(out, D, handleOf(cfg, "door"), stackLeft);
  });

  /* --- 4c. gola frezată (D-89): canal pe spatele muchiei de sus, pe fiecare front --- */
  if (cfg.handles === "gola" && cfg.golaType === "fresata") {
    var GF = H.golaFresata;
    pcs.forEach(function (p) {
      var isF = (p.role === "frontale" && (p.sub === "door" || p.sub === "fold")) || (p.role === "cassetto_frontale" && p.sub === "drawer");
      if (!isF || p.tAx !== 2 || p.sloped) return;
      p.grooves.push({ lo: [p.min[0], p.max[1] - GF.w, p.min[2]], hi: [p.max[0], p.max[1], p.min[2] + GF.d], note: "gola fresata 45°" });
      out.hw.push({ id: "hw_" + out.hw.length, type: "gola_fresata", catalog: null, piece: p.pk,
                    w: [(p.min[0] + p.max[0]) / 2, p.max[1], p.max[2]], x0: p.min[0], x1: p.max[0], zB: p.min[2], d: GF.d, note: "Gola fresata" });
    });
  }

  /* --- 5. cassetti: frontale (maniglia) e guide sui pannelli di fianco ----- */
  var grps = {};
  boxes.forEach(function (b) { if (b && b.grp) (grps[b.grp] = grps[b.grp] || []).push(b); });
  Object.keys(grps).sort().forEach(function (g) {
    var bs = grps[g], fr = null, body = bs.filter(function (b) { return b.sub === "dbox"; });
    for (var i = 0; i < pcs.length; i++) if (pcs[i].grp === g && pcs[i].role === "cassetto_frontale") { fr = pcs[i]; break; }
    if (fr && hingeSel === "maniglia" && fr.sub === "drawer") {
      var hmS = handleOf(cfg, "drawer"), lenS = handleLen(hmS);
      var yc = fr.ext[1] > 250 ? fr.max[1] - H.handle.from_top : (fr.min[1] + fr.max[1]) / 2;
      if (hmS.t === "edge") yc = fr.max[1];
      placeHandle(out, fr, hmS, { vertical: false, x: (fr.min[0] + fr.max[0]) / 2, y: yc });
    }
    if (!body.length) return;
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, z0 = 1e9, z1 = -1e9;
    body.forEach(function (b) { x0 = Math.min(x0, b.x0); x1 = Math.max(x1, b.x1); y0 = Math.min(y0, b.y0); z0 = Math.min(z0, b.z0); z1 = Math.max(z1, b.z1); });
    var y = y0 + H.slide.lift, nl = z1 - z0;
    var spos = slidePositions(cfg, nl);
    [-1, 1].forEach(function (side) {
      var P = panelBeside(pcs, side < 0 ? x0 : x1, side, y + 10, (z0 + z1) / 2, 60);
      if (!P) return;
      var fx = side < 0 ? P.max[0] : P.min[0], id = "hw_" + out.hw.length;
      spos.list.forEach(function (d) {
        if (d > nl - 10) return;
        hole(P, 0, side < 0 ? 1 : -1, [fx, y, P.max[2] - d], H.slide.dia, H.slide.depth, id, "guida cassetto");
      });
      out.hw.push({ id: id, type: "guida", catalog: "blum_tandem", piece: P.pk, w: [fx, y, z1], len: nl,
                    side: side, note: "Guida cassetto NL " + Math.round(nl), slideSrc: spos.src, slideApprox: spos.approx });
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

  /* --- 6b. blatul (U.8, D-73): decupajele la freza, trecute prin placa, si
         locasurile rotunde pentru suruburile de imbinare, pe dedesubt. Pozitiile
         vin calculate in cfg (`cutouts`, `pockets`), in cotele locale ale piesei:
         x de la capatul din stanga, y de la muchia din fata. Cotele locasurilor
         sunt date nevalidate (WORKTOP_DEFAULTS.bolt, verificat:false). */
  byRole("blat").forEach(function (q) {
    if (q.tAx !== 1) return;
    var zFront = q.max[2];
    (cfg.pockets || []).forEach(function (k) {
      hole(q, 1, -1, [q.min[0] + k.x, q.min[1], zFront - k.y], k.dia, Math.max(1, q.T - (k.rest || 0)), null, "buzunar bulon blat");
    });
    (cfg.cutouts || []).forEach(function (c) {
      q.mills.push({ ax: 1, side: 1, c: [q.min[0] + c.x + c.w / 2, q.max[1], zFront - c.y - c.d / 2],
                     du: c.w, dv: c.d, r: c.r || 0, through: true, depth: q.T,
                     note: c.kind === "hob" ? "decupaj plită" : c.kind === "sink" ? "decupaj chiuvetă" : "decupaj blat" });
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
  if (p.dim) { Lp = p.dim[0]; Wp = p.dim[1]; T = p.dim[2]; }
  var X = function (w) { return w[aL] - p.min[aL]; };
  var Y = function (w) { return flipY ? p.max[aW] - w[aW] : w[aW] - p.min[aW]; };
  var Z6 = function (w) { return s5 > 0 ? w[t] - p.min[t] : p.max[t] - w[t]; };  // distanza dalla faccia 6

  /* contur pe pantă (ușa trapezoidală, D-86): punctele din planul vertical, în coordonatele feței 5 */
  var poly = null;
  if (p.vpPts && p.vpPts.length >= 3) poly = p.vpPts.map(function (q) {
    var w = [0, 0, 0]; w[aW] = q[0]; w[aL] = q[1]; return [X(w), Y(w)];
  });
  /* tăietura de sus: unghiul față de lățime și față de înălțime */
  var cut = null;
  if (poly && p.vpPts) {
    var C0 = p.vpPts[2], D0 = p.vpPts[3];
    var topL = Math.abs(C0[1] - D0[1]), topW = Math.abs(C0[0] - D0[0]);
    var fromW = Math.atan2(topL, topW) * 180 / Math.PI;
    cut = { h0: R1(D0[1] - p.min[aL]), h1: R1(C0[1] - p.min[aL]),
            deg: R1(fromW), degSide: R1(90 - fromW) };
  }
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
  (p.slots || []).forEach(function (h) {
    var o = { type: "slot", len: R1(h.len), thk: R1(h.thk), depth: R1(h.depth), hw: h.hw, note: h.note };
    if (h.ax === t) {
      o.face = h.side === s5 ? 5 : 6; o.x = R1(X(h.w)); o.y = R1(Y(h.w)); o.ori = h.la === aL ? "X" : "Y";
    } else {
      var atMax = h.side > 0;
      if (h.ax === aL) { o.face = atMax ? 2 : 4; o.u = R1(Y(h.w)); }
      else { var yMax = flipY ? !atMax : atMax; o.face = yMax ? 3 : 1; o.u = R1(X(h.w)); }
      o.z = R1(Z6(h.w)); o.x = R1(X(h.w)); o.y = R1(Y(h.w));
    }
    push(o);
  });
  /* i fori da due facce opposte nello stesso punto si toccano: su un
     tramezzo i reggipiani delle due sezioni diventano UN foro passante. */
  for (var i = 0; i < ops.length; i++) for (var j = i + 1; j < ops.length; j++) {
    var a = ops[i], b = ops[j];
    if (!a || !b || a.face > 6 || a.x == null || a.type !== "drill" || b.type !== "drill") continue;
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

  /* i decupaje la freza: dreptunghi cu colturi rotunjite, centrat in `c`;
     `du` merge pe axa 0 a modulului, `dv` pe axa 2 */
  (p.mills || []).forEach(function (m) {
    var wX = aL === 0 ? m.du : m.dv, dY = aL === 0 ? m.dv : m.du;
    push({ type: "mill", shape: "rect", face: m.through ? 5 : (m.side === s5 ? 5 : 6),
           x: R1(X(m.c)), y: R1(Y(m.c)), w: R1(wX), d: R1(dY), r: R1(m.r), depth: R1(m.depth),
           through: !!m.through, note: m.note });
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

  var res = {
    pk: p.pk, role: p.role, sub: p.sub, grp: p.grp, wing: p.wing, curved: p.curved,
    length: R1(Lp), width: R1(Wp), thickness: R1(T),
    axes: { lung: AX[aL], larg: AX[aW], sp: AX[t], face5: s5, flipY: flipY },
    min: p.min.slice(), max: p.max.slice(), outline: rects,
    operations: ops, preflight: warns
  };
  if (poly) { res.poly = poly; res.cut = cut; }
  if (p.sloped) res.sloped = true;      /* panou pe pantă (D-86): numai când e cazul, ca modelul vechi să rămână identic */
  return res;
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

/* ------------------------------------------------------------------------ */
/* COTE DE LUMINA PE 3D: dai pezzi fisici (stesso `pieces` di generate), le tre
   cote esterne del corpo e, colonna per colonna, le luci libere fra base,
   ripiani e cielo. Niente cote scritte a mano: tutto da min/max dei pezzi, cosi
   il 3D mostra quello che la distinta taglia. */
var DIM_EXT = { fianco: 1, base: 1, cielo: 1, base_cielo: 1, schienale: 1, ripiano: 1, divisorio: 1,
  zoccolo: 1, traversa_cielo: 1, traversa: 1 };
var DIM_HOR = { base: 1, cielo: 1, base_cielo: 1, ripiano: 1, traversa_cielo: 1 };
function dimensionSpec(pieces, opts) {
  var minGap = (opts && opts.minGap) || 20;
  var ps = (pieces || []).filter(function (p) { return p && p.min && p.max && DIM_EXT[p.role]; });
  if (!ps.length) return null;
  var lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], a, i;
  ps.forEach(function (p) { for (a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], p.min[a]); hi[a] = Math.max(hi[a], p.max[a]); } });
  var H = hi[1] - lo[1];
  /* i pezzi verticali che chiudono una colonna: fianchi e tramezzi alti quasi quanto il corpo */
  var vert = ps.filter(function (p) {
    return (p.role === "fianco" || p.role === "divisorio") && p.max[1] - p.min[1] > 0.6 * H &&
      Math.abs((p.max[0] - p.min[0]) - (p.thickness || 0)) < 1;
  }).sort(function (x, y) { return x.min[0] - y.min[0]; });
  var hor = ps.filter(function (p) { return DIM_HOR[p.role] && Math.abs((p.max[1] - p.min[1]) - (p.thickness || 0)) < 1; });
  var gaps = [];
  for (i = 0; i + 1 < vert.length; i++) {
    var cl = vert[i].max[0], ch = vert[i + 1].min[0];
    if (ch - cl < 40) continue;
    var stack = hor.filter(function (p) { return p.min[0] < ch - 1 && p.max[0] > cl + 1; })
      .sort(function (x, y) { return x.min[1] - y.min[1]; });
    for (var j = 0; j + 1 < stack.length; j++) {
      var g0 = stack[j].max[1], g1 = stack[j + 1].min[1];
      if (g1 - g0 >= minGap) gaps.push({ x: (cl + ch) / 2, y0: g0, y1: g1, h: Math.round((g1 - g0) * 10) / 10, col: i });
    }
  }
  return { min: lo, max: hi, L: Math.round((hi[0] - lo[0]) * 10) / 10, H: Math.round(H * 10) / 10,
           P: Math.round((hi[2] - lo[2]) * 10) / 10, gaps: gaps };
}

var API = { HW_DRILL: HW_DRILL, slidePositions: slidePositions, generateOperations: generate, matchOpsRow: matchRow, dimensionSpec: dimensionSpec };
if (typeof module !== "undefined" && module.exports) module.exports = API;
for (var k in API) if (Object.prototype.hasOwnProperty.call(API, k)) root[k] = API[k];

})(typeof globalThis !== "undefined" ? globalThis : this);
