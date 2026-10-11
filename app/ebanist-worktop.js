/* =====================================================================
   Ebanist — blatul peste compoziție (ROADMAP U.8, D-73)
   ---------------------------------------------------------------------
   Funcție PURĂ: intră pereții, corpurile așezate pe ei și specificația
   blatului; ies segmentele de blat (câte unul pe perete), îmbinările de colț
   și decupajele, toate în cote locale ale fiecărei piese. Nimic nu citește
   DOM-ul și nimic nu scrie în proiect: `index.html` face asta, iar testele
   rulează funcția goală.

   ÎMBINAREA DE COLȚ e dreaptă, cap la cap (nu la 45°): un blat trece până în
   colț, celălalt se oprește în muchia lui lungă, din față. Pe dedesubt, la
   freză, se fac locașurile pentru șuruburile de îmbinare ale blatului, în
   AMBELE piese. Cotele locașurilor (`bolt`) sunt DATE, marcate
   `verificat:false`: se iau din dima și din șuruburile folosite în atelier,
   nu din cod.

   Convenții (aceleași ca la corpuri):
     - milimetri, precizie deplină, rotunjire la 0,1 mm doar la ieșire;
     - pe perete, x se măsoară de la colțul de început al peretelui (ca
       `layout[nume].from`); în piesă, x de la capătul ei din stânga;
     - y în piesă: de la muchia din FAȚĂ spre perete;
     - determinism: aceeași intrare, aceleași segmente, în aceeași ordine.
   ===================================================================== */
(function (root) {
"use strict";

var WORKTOP_DEFAULTS = {
  ov_front: 20,        // cât iese blatul în față de cel mai ieșit front, mm
  ov_side: 0,          // la un capăt liber, mm
  corner_tol: 0.5,     // grade: peste, îmbinarea dreaptă nu mai e posibilă
  min_len: 100,        // un segment mai scurt nu e blat
  cut_margin: 30,      // un decupaj nu se apropie mai mult de o muchie, mm
  /* decupajele tipice, ca PUNCT DE PORNIRE: cotele reale se iau de pe fișa
     chiuvetei și a plitei. Nu sunt valori de catalog. */
  cutout: {
    sink:  { w: 780, d: 480, r: 10, y: 60 },
    hob:   { w: 560, d: 490, r: 6,  y: 60 },
    other: { w: 300, d: 200, r: 5,  y: 60 }
  },
  /* locașurile pentru șuruburile de îmbinare, pe dedesubt, în fiecare piesă.
     verificat:false — la fel ca HW_DRILL (D-48): nu merg în mașină până nu
     sunt verificate pe dima și pe șurubul folosit. */
  bolt: {
    verificat: false,
    dia: 35,           // locaș rotund
    rest: 12,          // cât material rămâne deasupra locașului, mm
    from_joint: 45,    // centrul locașului, de la muchia îmbinării, mm
    edge: 80,          // primul/ultimul locaș, de la muchiile lungi ale îmbinării
    mid_over: 800      // peste această lungime a îmbinării, se adaugă unul la mijloc
  }
};

var KINDS = ["sink", "hob", "other"];
var LETTERS = "ABCDEFGH";

/* gol / null / lipsa = valoarea implicita (`+null` ar da 0) */
function num(v, d) { if (v === null || v === undefined || v === "") return d; var n = +v; return isFinite(n) ? n : d; }
function r1(v) { return Math.round(v * 10) / 10; }

/* wall k: { id, i, L, angle }   (angle = unghiul de la capătul peretelui)
   mod:    { name, wall, x0, x1, front, yTop, rot }
   spec:   { name, mods:[nume], ovF, ovS, through:["first"|"second", ...],
             cutouts:[{ kind, seg, x, y, w, d, r }], thickness } */
function deriveWorktop(spec, walls, mods, opts) {
  var D = WORKTOP_DEFAULTS, o = opts || {};
  var errors = [], warnings = [];
  var out = { errors: errors, warnings: warnings, segments: [], joints: [], y: null };
  var names = (spec && spec.mods) || [];
  if (!names.length) { errors.push({ k: "wtNoMods" }); return out; }

  var byName = {};
  (mods || []).forEach(function (m) { byName[m.name] = m; });
  var picked = [], i, j;
  for (i = 0; i < names.length; i++) {
    var m = byName[names[i]];
    if (!m) { errors.push({ k: "wtModMissing", name: names[i] }); continue; }
    if (+m.rot) { errors.push({ k: "wtModRotated", name: m.name }); continue; }
    picked.push(m);
  }
  if (errors.length) return out;

  /* un grup pe perete, în ordinea pereților din releveu */
  var order = [];
  (walls || []).forEach(function (w, k) {
    var g = picked.filter(function (m) { return m.wall === w.id; });
    if (g.length) order.push({ wall: w, idx: k, mods: g });
  });
  if (!order.length) { errors.push({ k: "wtNoWall" }); return out; }
  for (i = 1; i < order.length; i++)
    if (order[i].idx !== order[i - 1].idx + 1) { errors.push({ k: "wtWallsNotAdjacent" }); return out; }
  if (order.length > LETTERS.length) { errors.push({ k: "wtTooManyWalls" }); return out; }

  var ovF = num(spec.ovF, D.ov_front), ovS = num(spec.ovS, D.ov_side);
  if (!(ovF >= 0) || !(ovS >= 0)) { errors.push({ k: "wtOverhangNeg" }); return out; }

  /* adâncimea fiecărui segment: cel mai ieșit front, plus depășirea */
  order.forEach(function (g) {
    g.depth = 0;
    g.mods.forEach(function (m) { g.depth = Math.max(g.depth, num(m.front, 0)); });
    g.depth += ovF;
    g.x0 = Math.min.apply(null, g.mods.map(function (m) { return m.x0; }));
    g.x1 = Math.max.apply(null, g.mods.map(function (m) { return m.x1; }));
  });

  /* colțurile: unghi drept, și care piesă trece */
  var through = spec.through || [];
  for (i = 0; i + 1 < order.length; i++) {
    var ang = num(order[i].wall.angle, 90);
    if (Math.abs(ang - 90) > D.corner_tol) { errors.push({ k: "wtCornerAngle", wall: order[i].wall.i + 1, angle: ang }); return out; }
    order[i].corner = through[i] === "second" ? "second" : "first";
  }

  /* capetele fiecărui segment, pe peretele lui */
  order.forEach(function (g, k) {
    var prev = k > 0 ? order[k - 1] : null, next = k + 1 < order.length ? order[k + 1] : null;
    var L = num(g.wall.L, 0);
    var s, e, sKind, eKind;
    if (prev) {
      /* începe în colț: dacă trece piesa dinainte, ne oprim în muchia ei */
      if (prev.corner === "first") { s = prev.depth; sKind = "butt"; } else { s = 0; sKind = "corner"; }
    } else { s = Math.max(0, g.x0 - ovS); sKind = "free"; }
    if (next) {
      if (g.corner === "first") { e = L; eKind = "corner"; } else { e = L - next.depth; eKind = "butt"; }
    } else { e = Math.min(L, g.x1 + ovS); eKind = "free"; }
    g.s = s; g.e = e; g.sKind = sKind; g.eKind = eKind;
    /* un corp care iese din blat; pe un capăt „butt” e normal: colțul îl
       acoperă piesa care trece */
    if ((sKind !== "butt" && g.x0 < s - 0.5) || (eKind !== "butt" && g.x1 > e + 0.5))
      warnings.push({ k: "wtModOutside", wall: g.wall.i + 1 });
    if (e - s < D.min_len) errors.push({ k: "wtTooShort", wall: g.wall.i + 1, len: r1(e - s) });
    /* colțul rămas fără corp sub blat: blatul ar sta în gol */
    if (next && g.corner === "first" && L - g.x1 > next.depth + 5)
      warnings.push({ k: "wtGapCorner", wall: g.wall.i + 1, mm: r1(L - g.x1 - next.depth) });
    if (prev && prev.corner === "first" && g.x0 - prev.depth > 5)
      warnings.push({ k: "wtGapStart", wall: g.wall.i + 1, mm: r1(g.x0 - prev.depth) });
  });
  if (errors.length) return out;

  /* înălțimea: blatul stă pe cel mai înalt corp */
  var ys = picked.map(function (m) { return num(m.yTop, 0); });
  var yTop = Math.max.apply(null, ys), yMin = Math.min.apply(null, ys);
  if (yTop - yMin > 5) warnings.push({ k: "wtHeights", mm: r1(yTop - yMin) });
  out.y = yTop;

  order.forEach(function (g, k) {
    var ends = (g.sKind === "free" ? 1 : 0) + (g.eKind === "free" ? 1 : 0);
    out.segments.push({
      n: k, letter: LETTERS.charAt(k), wall: g.wall.id, wallIndex: g.idx, from: r1(g.s), to: r1(g.e),
      L: r1(g.e - g.s), P: r1(g.depth), y: yTop,
      start: g.sKind, end: g.eKind,
      /* cantul se pune în față și la capetele libere; în colț și pe muchia
         îmbinării nu se vede */
      bordo: ends ? "1L+" + ends + "C" : "1L",
      mods: g.mods.map(function (m) { return m.name; }),
      pockets: [], cutouts: []
    });
  });

  /* îmbinările și locașurile pentru șuruburi, în ambele piese */
  var B = D.bolt;
  for (i = 0; i + 1 < order.length; i++) {
    var a = order[i], b = order[i + 1], sa = out.segments[i], sb = out.segments[i + 1];
    var passing = a.corner === "first" ? sa : sb, butting = a.corner === "first" ? sb : sa;
    /* linia îmbinării: muchia din față a piesei care trece, pe lungimea
       adâncimii piesei care se oprește */
    var jl = butting.P;
    var ys2 = [B.edge, jl - B.edge];
    if (jl > B.mid_over) ys2.splice(1, 0, jl / 2);
    if (!(jl > 2 * B.edge)) ys2 = [jl / 2];
    /* piesa care se oprește: locaș la `from_joint` de capătul ei care atinge
       îmbinarea, la `ys2` de muchia ei din față */
    var buttAtStart = butting === sb;
    ys2.forEach(function (yy) {
      var bx = buttAtStart ? B.from_joint : butting.L - B.from_joint;
      butting.pockets.push({ x: r1(bx), y: r1(yy), dia: B.dia, rest: B.rest, joint: i });
    });
    /* poziția pe peretele piesei care trece: muchia ei din față, pe ultimii
       `jl` mm dinspre colț (la „first”: spre capătul peretelui; la „second”,
       spre începutul lui) */
    var corner0 = passing === sa ? (sa.to - jl) : (sb.from + jl);
    ys2.forEach(function (yy) {
      var along = passing === sa ? (corner0 + yy) : (corner0 - yy);
      passing.pockets.push({ x: r1(along - passing.from), y: r1(B.from_joint), dia: B.dia, rest: B.rest, joint: i });
    });
    out.joints.push({ n: i, corner: a.wall.i + 1 + "/" + (b.wall.i + 1), type: "butt",
                      passing: passing.n, butting: butting.n, length: r1(jl), bolts: ys2.length });
  }

  /* decupajele: pe piesa lor, cu margine față de muchii și între ele */
  var cuts = (spec.cutouts || []);
  cuts.forEach(function (c, ci) {
    var seg = out.segments[Math.max(0, Math.min(out.segments.length - 1, num(c.seg, 0)))];
    var kind = KINDS.indexOf(c.kind) >= 0 ? c.kind : "other";
    var def = D.cutout[kind];
    var w = num(c.w, def.w), d = num(c.d, def.d), r = num(c.r, def.r), yf = num(c.y, def.y);
    var xc = num(c.x, null);
    if (!(w > 0) || !(d > 0)) { errors.push({ k: "wtCutSize", n: ci + 1 }); return; }
    if (xc === null) { errors.push({ k: "wtCutX", n: ci + 1 }); return; }
    if (r < 0 || r > Math.min(w, d) / 2 + 1e-6) { errors.push({ k: "wtCutRadius", n: ci + 1, r: r }); return; }
    var xl = xc - w / 2 - seg.from;   // de la capătul din stânga al piesei
    var yb = seg.P - yf - d;          // de la muchia din spate (perete), ca la `scasso`
    var m = D.cut_margin;
    if (xl < m - 1e-6 || xl + w > seg.L - m + 1e-6 || yf < m - 1e-6 || yb < m - 1e-6)
      errors.push({ k: "wtCutOutside", n: ci + 1, seg: seg.letter });
    seg.cutouts.push({ kind: kind, n: ci + 1, x: r1(xl), y: r1(yf), w: r1(w), d: r1(d), r: r1(r), yBack: r1(yb) });
  });
  out.segments.forEach(function (sg) {
    var cs = sg.cutouts;
    for (var p1 = 0; p1 < cs.length; p1++) for (var p2 = p1 + 1; p2 < cs.length; p2++) {
      var A = cs[p1], Bc = cs[p2];
      if (A.x < Bc.x + Bc.w + D.cut_margin && Bc.x < A.x + A.w + D.cut_margin &&
          A.y < Bc.y + Bc.d + D.cut_margin && Bc.y < A.y + A.d + D.cut_margin)
        errors.push({ k: "wtCutOverlap", a: A.n, b: Bc.n });
    }
    /* un decupaj peste un locaș de șurub: slăbește piesa */
    cs.forEach(function (c) {
      sg.pockets.forEach(function (pk) {
        var rr = pk.dia / 2 + 5;
        if (pk.x > c.x - rr && pk.x < c.x + c.w + rr && pk.y > c.y - rr && pk.y < c.y + c.d + rr)
          warnings.push({ k: "wtCutPocket", n: c.n, seg: sg.letter });
      });
    });
  });
  return out;
}

var API = { WORKTOP_DEFAULTS: WORKTOP_DEFAULTS, WORKTOP_KINDS: KINDS, deriveWorktop: deriveWorktop };
if (typeof module !== "undefined" && module.exports) module.exports = API;
for (var k in API) if (Object.prototype.hasOwnProperty.call(API, k)) root[k] = API[k];

})(typeof globalThis !== "undefined" ? globalThis : this);
