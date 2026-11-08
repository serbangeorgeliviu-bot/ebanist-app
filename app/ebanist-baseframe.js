/* =====================================================================
   Ebanist — cadrul de nivelare al unei compoziții (ROADMAP U.14, D-117)
   ---------------------------------------------------------------------
   Funcție PURĂ, după modelul blatului (D-73): intră pereții releveului,
   corpurile așezate pe ei, cotele pardoselii și specificația cadrului; ies
   segmentele de cadru (câte unul pe perete), șinele și traversele lor ca piese
   de PAL pe cant, picioarele reglabile cu extensia fiecăruia și înălțimea la
   care stau corpurile. Nimic nu citește DOM-ul și nu scrie în proiect.

   CADRUL e din PAL pe cant (confirmat de Liviu, 08.11.2026): două șine lungi,
   față și spate, cu traverse între ele, și picioare reglabile sub intersecții.
   Se pune o singură dată la nivel, pe cota CEA MAI ÎNALTĂ a pardoselii din
   zona lui; toate corpurile stau apoi pe același plan, fără picioare proprii.

   Convenții (aceleași ca la corpuri și blat):
     - milimetri, precizie deplină, rotunjire la 0,1 mm doar la ieșire;
     - pe perete, x se măsoară de la colțul de început al peretelui; în piesă,
       x de la capătul ei din stânga; y de la perete spre față;
     - grosimea șinei vine din materialul ales (D-41): fără ea nu se generează;
     - determinism: aceeași intrare, aceleași piese, aceleași ID-uri;
     - cotele din BASEFRAME_DEFAULTS sunt date `verificat:false`, de luat din
       șina și din piciorul folosite în atelier, nu din cod.
   ===================================================================== */
(function (root) {
"use strict";

var BASEFRAME_DEFAULTS = {
  verificat: false,
  h: 120,            // de la cota cea mai înaltă a pardoselii până la fața de sus a șinelor, mm
  setback: 50,       // retragerea cadrului de la fața corpului (soclul acoperă), mm
  wall_gap: 10,      // joc între cadru și perete, mm
  cross_max: 600,    // pasul maxim între traverse, mm (mai mic sau egal cu pasul picioarelor)
  min_depth: 100,    // un cadru mai puțin adânc nu mai e stabil
  min_rail_h: 30,    // o șină mai joasă nu mai e cadru
  min_len: 100,      // un segment mai scurt nu e cadru
  corner_tol: 0.5,   // grade: peste, îmbinarea dreaptă nu mai e posibilă
  /* piciorul reglabil: înălțimea lui închis, cursa, diametrul bazei. Generice. */
  foot: { base: 25, travel: 30, dia: 50 }
};

var LETTERS = "ABCDEFGH";

function num(v, d) { if (v === null || v === undefined || v === "") return d; var n = +v; return isFinite(n) ? n : d; }
function r1(v) { return Math.round(v * 10) / 10; }

/* cota pardoselii la x pe peretele `wall`: interpolare liniară între punctele
   măsurate; în afara lor, cea mai apropiată. Fără puncte: null. */
function floorAt(floor, wall, x) {
  var pts = (floor || []).filter(function (q) { return q.wall === wall; })
    .map(function (q) { return { x: +q.x, z: +q.z }; })
    .sort(function (a, b) { return a.x - b.x; });
  if (!pts.length) return null;
  if (x <= pts[0].x) return pts[0].z;
  if (x >= pts[pts.length - 1].x) return pts[pts.length - 1].z;
  for (var i = 0; i + 1 < pts.length; i++) {
    if (x >= pts[i].x && x <= pts[i + 1].x) {
      var dx = pts[i + 1].x - pts[i].x;
      return dx < 1e-9 ? pts[i].z : pts[i].z + (pts[i + 1].z - pts[i].z) * (x - pts[i].x) / dx;
    }
  }
  return pts[pts.length - 1].z;
}

/* wall k: { id, i, L, angle }
   mod:    { name, wall, x0, x1, depth, rot }       (depth = adâncimea corpului)
   spec:   { name, mods:[nume], sp (grosimea șinei, din material), h, setback, wallGap,
             through:["first"|"second", ...],
             floor:[{ wall, x, z }]   (cota pardoselii față de un reper oarecare, mm, + = mai sus) } */
function deriveBaseFrame(spec, walls, mods, opts) {
  var D = BASEFRAME_DEFAULTS, F = D.foot;
  var errors = [], warnings = [];
  var out = { errors: errors, warnings: warnings, segments: [], joints: [], pieces: [], feet: [], modules: [], h: null, railH: null };
  var names = (spec && spec.mods) || [];
  if (!names.length) { errors.push({ k: "bfNoMods" }); return out; }

  /* grosimea nu are valoare implicită (D-41) */
  var sp = num(spec.sp, null);
  if (!(sp > 0)) { errors.push({ k: "bfNoThickness" }); return out; }
  var h = num(spec.h, D.h), setback = num(spec.setback, D.setback), wallGap = num(spec.wallGap, D.wall_gap);
  if (!(setback >= 0) || !(wallGap >= 0)) { errors.push({ k: "bfNegative" }); return out; }
  var railH = h - F.base;
  if (!(railH >= D.min_rail_h)) { errors.push({ k: "bfTooLow", h: r1(h), min: D.min_rail_h + F.base }); return out; }
  out.h = r1(h); out.railH = r1(railH);

  var byName = {};
  (mods || []).forEach(function (m) { byName[m.name] = m; });
  var picked = [], i;
  for (i = 0; i < names.length; i++) {
    var m = byName[names[i]];
    if (!m) { errors.push({ k: "bfModMissing", name: names[i] }); continue; }
    if (+m.rot) { errors.push({ k: "bfModRotated", name: m.name }); continue; }
    picked.push(m);
  }
  if (errors.length) return out;

  var order = [];
  (walls || []).forEach(function (w, k) {
    var g = picked.filter(function (m) { return m.wall === w.id; });
    if (g.length) order.push({ wall: w, idx: k, mods: g });
  });
  if (!order.length) { errors.push({ k: "bfNoWall" }); return out; }
  for (i = 1; i < order.length; i++)
    if (order[i].idx !== order[i - 1].idx + 1) { errors.push({ k: "bfWallsNotAdjacent" }); return out; }
  if (order.length > LETTERS.length) { errors.push({ k: "bfTooManyWalls" }); return out; }

  /* adâncimea cadrului pe fiecare perete: cel mai adânc corp, minus retragerea, minus jocul la perete */
  order.forEach(function (g) {
    var dMax = 0;
    g.mods.forEach(function (m) { dMax = Math.max(dMax, num(m.depth, 0)); });
    g.P = dMax - setback;               // de la perete (y = 0) până la fața cadrului
    g.x0 = Math.min.apply(null, g.mods.map(function (m) { return m.x0; }));
    g.x1 = Math.max.apply(null, g.mods.map(function (m) { return m.x1; }));
    if (!(g.P - wallGap >= D.min_depth)) errors.push({ k: "bfTooShallow", wall: g.wall.i + 1, depth: r1(g.P - wallGap), min: D.min_depth });
  });
  if (errors.length) return out;

  var through = spec.through || [];
  for (i = 0; i + 1 < order.length; i++) {
    var ang = num(order[i].wall.angle, 90);
    if (Math.abs(ang - 90) > D.corner_tol) { errors.push({ k: "bfCornerAngle", wall: order[i].wall.i + 1, angle: ang }); return out; }
    order[i].corner = through[i] === "second" ? "second" : "first";
  }

  /* capetele fiecărui segment, pe peretele lui (ca la blat: o piesă trece, cealaltă se oprește în muchia ei) */
  order.forEach(function (g, k) {
    var prev = k > 0 ? order[k - 1] : null, next = k + 1 < order.length ? order[k + 1] : null;
    var L = num(g.wall.L, 0), s, e, sKind, eKind;
    if (prev) { if (prev.corner === "first") { s = prev.P; sKind = "butt"; } else { s = 0; sKind = "corner"; } }
    else { s = Math.max(0, g.x0); sKind = "free"; }
    if (next) { if (g.corner === "first") { e = L; eKind = "corner"; } else { e = L - next.P; eKind = "butt"; } }
    else { e = Math.min(L, g.x1); eKind = "free"; }
    g.s = s; g.e = e; g.sKind = sKind; g.eKind = eKind;
    if ((sKind !== "butt" && g.x0 < s - 0.5) || (eKind !== "butt" && g.x1 > e + 0.5))
      warnings.push({ k: "bfModOutside", wall: g.wall.i + 1 });
    if (e - s < D.min_len) errors.push({ k: "bfTooShort", wall: g.wall.i + 1, len: r1(e - s) });
  });
  if (errors.length) return out;

  /* cota de referință: cea mai înaltă cotă a pardoselii din toată zona cadrului */
  var floor = spec.floor || [];
  var zs = floor.filter(function (q) { return order.some(function (g) { return g.wall.id === q.wall; }); }).map(function (q) { return +q.z; });
  var zMax = zs.length ? Math.max.apply(null, zs) : 0;
  if (!zs.length) warnings.push({ k: "bfNoFloor" });
  out.zMax = r1(zMax);
  out.floorSpan = zs.length ? r1(zMax - Math.min.apply(null, zs)) : 0;

  var crossMax = D.cross_max;
  order.forEach(function (g, k) {
    var L = g.e - g.s, depth = g.P - wallGap;          // adâncimea utilă a cadrului pe acest perete
    var letter = LETTERS.charAt(k), seg = {
      n: k, letter: letter, wall: g.wall.id, wallIndex: g.idx, from: r1(g.s), to: r1(g.e), L: r1(L), P: r1(depth),
      start: g.sKind, end: g.eKind, rails: 2, cross: 0, feet: 0, mods: g.mods.map(function (m) { return m.name; })
    };
    /* traversele: câte una la fiecare capăt, plus cele de la mijloc ca pasul să nu treacă de `cross_max` */
    var nCross = Math.max(2, Math.ceil((L - sp) / crossMax) + 1);
    var step = (L - sp) / (nCross - 1);                  // distanța între axele traverselor
    var crossLen = depth - 2 * sp;
    if (!(crossLen > 0)) { errors.push({ k: "bfTooShallow", wall: g.wall.i + 1, depth: r1(depth), min: r1(2 * sp) }); return; }
    seg.cross = nCross;
    /* șinele: față (y mare) și spate (lângă perete), pe toată lungimea segmentului */
    ["spate", "fata"].forEach(function (side) {
      out.pieces.push({ id: "cadru-" + letter + "-" + side, role: "cadru_lung", seg: k, side: side,
        L: r1(L), W: r1(railH), T: r1(sp), bordo: "1L", x: r1(g.s), y: side === "spate" ? r1(wallGap) : r1(g.P - sp) });
    });
    for (var c = 0; c < nCross; c++) {
      var xc = g.s + c * step;                            // marginea din stânga a traversei
      out.pieces.push({ id: "cadru-" + letter + "-tr" + (c + 1), role: "cadru_transv", seg: k, n: c + 1,
        L: r1(crossLen), W: r1(railH), T: r1(sp), bordo: "1L", x: r1(xc), y: r1(wallGap + sp) });
      /* picioarele: la fiecare traversă, sub ambele șine; axa piciorului pe mijlocul traversei */
      var xf = xc + sp / 2;
      ["spate", "fata"].forEach(function (side) {
        var zf = floorAt(floor, g.wall.id, xf);
        var ext = zf === null ? 0 : zMax - zf;           // cât trebuie scos piciorul peste închis
        if (ext > F.travel + 1e-9) errors.push({ k: "bfFootTravel", seg: letter, x: r1(xf), ext: r1(ext), travel: F.travel });
        seg.feet++;
        out.feet.push({ id: "pic-" + letter + "-" + (c + 1) + (side === "spate" ? "s" : "f"), seg: k, wall: g.wall.id,
          x: r1(xf), y: side === "spate" ? r1(wallGap + sp / 2) : r1(g.P - sp / 2), ext: r1(ext), base: F.base, dia: F.dia });
      });
    }
    out.segments.push(seg);
  });
  if (errors.length) return out;

  /* îmbinările de colț: cadrul care se oprește se prinde de cel care trece */
  for (i = 0; i + 1 < order.length; i++) {
    var a = order[i];
    var passing = a.corner === "first" ? i : i + 1, butting = a.corner === "first" ? i + 1 : i;
    out.joints.push({ n: i, corner: a.wall.i + 1 + "/" + (order[i + 1].wall.i + 1), type: "butt",
                      passing: passing, butting: butting, length: out.segments[butting].P });
  }

  /* înălțimea corpurilor: toate stau pe același plan, la `h` peste reper */
  picked.forEach(function (m) { out.modules.push({ name: m.name, wall: m.wall, hBase: r1(h) }); });
  return out;
}

var API = { BASEFRAME_DEFAULTS: BASEFRAME_DEFAULTS, deriveBaseFrame: deriveBaseFrame, bfFloorAt: floorAt };
if (typeof module !== "undefined" && module.exports) module.exports = API;
for (var k in API) if (Object.prototype.hasOwnProperty.call(API, k)) root[k] = API[k];

})(typeof globalThis !== "undefined" ? globalThis : this);
